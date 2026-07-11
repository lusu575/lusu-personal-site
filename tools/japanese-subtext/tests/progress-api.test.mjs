import assert from "node:assert/strict";
import test from "node:test";

import { onRequest } from "../../../functions/api/[[route]].js";
import { defaultProgress, mergeProgress, sanitizeProgress } from "../lib/storage.mjs";

function createEmptyD1() {
  function statement(sql) {
    return {
      sql,
      params: [],
      bind(...params) {
        this.params = params;
        return this;
      },
      async run() {
        return { success: true };
      },
      async first() {
        return null;
      },
      async all() {
        if (/pragma\s+table_info\(users\)/i.test(sql)) {
          return { results: [{ name: "role" }] };
        }
        return { results: [] };
      }
    };
  }

  return {
    prepare(sql) {
      return statement(sql);
    },
    async batch(statements) {
      for (const item of statements) {
        await item.run();
      }
      return [];
    }
  };
}

function createProgressD1({ signedIn = true, profile = null, stages = [] } = {}) {
  const state = {
    profile,
    stages: new Map(stages.map((stage) => [stage.stage_id, stage])),
    writes: []
  };

  function statement(sql) {
    const normalized = sql.replace(/\s+/g, " ").trim().toLowerCase();
    return {
      sql,
      params: [],
      bind(...params) {
        this.params = params;
        return this;
      },
      async run() {
        if (normalized.startsWith("insert into japanese_subtext_profiles")) {
          const [
            user_id, schema_version, content_version, revision, current_level, current_stage,
            settings_json, progress_updated_at, settings_updated_at, created_at, updated_at
          ] = this.params;
          state.profile = {
            user_id, schema_version, content_version, revision, current_level, current_stage,
            settings_json, progress_updated_at, settings_updated_at,
            created_at: state.profile?.created_at || created_at,
            updated_at
          };
          state.writes.push({ table: "profile", params: [...this.params] });
        }
        if (normalized.startsWith("insert into japanese_subtext_stage_progress")) {
          const [
            user_id, stage_id, level, stage, cleared, best_score, best_medal, attempts,
            first_accuracy, first_clear_mode, used_translation, used_kana,
            used_listening_mode, replay_count, hint_count, progress_updated_at, updated_at
          ] = this.params;
          const before = state.stages.get(stage_id);
          state.stages.set(stage_id, {
            user_id,
            stage_id,
            level,
            stage,
            cleared: Math.max(Number(before?.cleared || 0), Number(cleared)),
            best_score: Math.max(Number(before?.best_score || 0), Number(best_score)),
            best_medal: Math.max(Number(before?.best_medal || 0), Number(best_medal)),
            attempts: Math.max(Number(before?.attempts || 0), Number(attempts)),
            first_accuracy: Math.max(Number(before?.first_accuracy || 0), Number(first_accuracy)),
            first_clear_mode: before?.first_clear_mode || first_clear_mode,
            used_translation: Math.max(Number(before?.used_translation || 0), Number(used_translation)),
            used_kana: Math.max(Number(before?.used_kana || 0), Number(used_kana)),
            used_listening_mode: Math.max(Number(before?.used_listening_mode || 0), Number(used_listening_mode)),
            replay_count: Math.max(Number(before?.replay_count || 0), Number(replay_count)),
            hint_count: Math.max(Number(before?.hint_count || 0), Number(hint_count)),
            progress_updated_at: [before?.progress_updated_at || "", progress_updated_at].sort().at(-1),
            updated_at
          });
          state.writes.push({ table: "stage", params: [...this.params] });
        }
        return { success: true };
      },
      async first() {
        if (/from sessions\s+join users/i.test(sql)) {
          return signedIn
            ? { token_hash: "mock-token-hash", id: "user-123", email: "reader@example.test", role: "user" }
            : null;
        }
        if (/from japanese_subtext_profiles/i.test(sql)) {
          return state.profile;
        }
        return null;
      },
      async all() {
        if (/pragma\s+table_info\(users\)/i.test(sql)) {
          return { results: [{ name: "role" }] };
        }
        if (/from japanese_subtext_stage_progress/i.test(sql)) {
          return { results: [...state.stages.values()] };
        }
        return { results: [] };
      }
    };
  }

  return {
    state,
    prepare(sql) {
      return statement(sql);
    },
    async batch(statements) {
      for (const item of statements) {
        await item.run();
      }
      return [];
    }
  };
}

function validPayload() {
  return {
    progress: {
      schemaVersion: 1,
      contentVersion: "1.0.0",
      revision: 2,
      currentLevel: 1,
      currentStage: 2,
      unlockedStageIds: ["L1-001", "L1-002"],
      stageProgress: {
        "L1-001": {
          cleared: true,
          bestScore: 100,
          medal: "gold",
          attempts: 1,
          firstAccuracy: 100,
          firstClearMode: "listening",
          usedTranslation: false,
          usedKana: false,
          usedListeningMode: true,
          replayCount: 1,
          hintCount: 0,
          updatedAt: "2026-07-10T17:00:00.000Z"
        }
      },
      updatedAt: "2026-07-10T17:00:00.000Z"
    },
    settings: {
      schemaVersion: 1,
      contentVersion: "1.0.0",
      uiLanguage: "zh",
      displayMode: "japanese",
      optionLanguage: "ja",
      kana: false,
      optionText: true,
      optionAudio: true,
      autoReadOptions: false,
      autoplay: true,
      playbackRate: 1,
      muted: false,
      updatedAt: "2026-07-10T17:00:00.000Z"
    }
  };
}

async function apiRequest(db, { method = "GET", body, headers = {} } = {}) {
  const requestHeaders = new Headers({ Cookie: "lusu_session=mock-session", ...headers });
  let requestBody;
  if (body !== undefined) {
    requestHeaders.set("Content-Type", requestHeaders.get("Content-Type") || "application/json");
    requestBody = typeof body === "string" ? body : JSON.stringify(body);
  }
  return onRequest({
    request: new Request("https://example.test/api/tools/japanese-subtext/progress", {
      method,
      headers: requestHeaders,
      body: requestBody
    }),
    env: { DB: db }
  });
}

async function withoutExpectedApiErrorLog(callback) {
  const original = console.error;
  console.error = () => {};
  try {
    return await callback();
  } finally {
    console.error = original;
  }
}

test("GET progress rejects an anonymous visitor", async () => {
  const response = await withoutExpectedApiErrorLog(() => onRequest({
    request: new Request("https://example.test/api/tools/japanese-subtext/progress"),
    env: { DB: createEmptyD1() }
  }));

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "请先登录。" });
});

test("PUT progress stores only the authenticated user's normalized state", async () => {
  const db = createProgressD1();
  const response = await apiRequest(db, { method: "PUT", body: validPayload() });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(db.state.profile.user_id, "user-123");
  assert.equal(db.state.stages.get("L1-001").user_id, "user-123");
  assert.equal(payload.profile.currentLevel, 1);
  assert.equal(payload.profile.currentStage, 2);
  assert.equal(payload.stages[0].stageId, "L1-001");
  assert.equal(payload.progress.stageProgress["L1-001"].medal, "gold");
  assert.equal(payload.settings.uiLanguage, "zh");
  assert.equal(typeof payload.updatedAt, "string");
  assert.equal(payload.user, undefined);
  assert.equal(JSON.stringify(payload).includes("reader@example.test"), false);

  const second = await apiRequest(db, { method: "PUT", body: validPayload() });
  assert.equal(second.status, 200);
  assert.equal(db.state.stages.size, 1);
});

test("PUT accepts a merged clear when a newer failed attempt came from another device", async () => {
  const clearedCloud = sanitizeProgress({
    ...defaultProgress(),
    unlockedStageIds: ["L1-001", "L1-002"],
    stageProgress: {
      "L1-001": {
        cleared: true,
        bestScore: 80,
        medal: "silver",
        attempts: 1,
        firstAccuracy: 80,
        firstClearMode: "japanese",
        updatedAt: "2026-07-11T00:00:00.000Z"
      }
    }
  });
  const newerLocalFailure = sanitizeProgress({
    ...defaultProgress(),
    stageProgress: {
      "L1-001": {
        cleared: false,
        bestScore: 20,
        medal: "none",
        attempts: 2,
        firstAccuracy: 20,
        updatedAt: "2026-07-11T01:00:00.000Z"
      }
    }
  });
  const payload = validPayload();
  payload.progress = mergeProgress(newerLocalFailure, clearedCloud);
  const response = await apiRequest(createProgressD1(), { method: "PUT", body: payload });
  assert.equal(response.status, 200);
  const saved = await response.json();
  assert.equal(saved.progress.stageProgress["L1-001"].cleared, true);
  assert.equal(saved.progress.stageProgress["L1-001"].firstClearMode, "japanese");
});

test("GET progress returns profile, stages, and compatibility state", async () => {
  const settings = validPayload().settings;
  const db = createProgressD1({
    profile: {
      user_id: "user-123",
      schema_version: 1,
      content_version: "1.0.0",
      revision: 4,
      current_level: 1,
      current_stage: 2,
      settings_json: JSON.stringify(settings),
      progress_updated_at: "2026-07-10T17:00:00.000Z",
      settings_updated_at: settings.updatedAt,
      created_at: "2026-07-10T16:00:00.000Z",
      updated_at: "2026-07-10T17:00:01.000Z"
    },
    stages: [{
      user_id: "user-123",
      stage_id: "L1-001",
      level: 1,
      stage: 1,
      cleared: 1,
      best_score: 100,
      best_medal: 3,
      attempts: 1,
      first_accuracy: 100,
      first_clear_mode: "listening",
      used_translation: 0,
      used_kana: 0,
      used_listening_mode: 1,
      replay_count: 1,
      hint_count: 0,
      progress_updated_at: "2026-07-10T17:00:00.000Z",
      updated_at: "2026-07-10T17:00:01.000Z"
    }]
  });

  const response = await apiRequest(db);
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(payload.profile.unlockedStageIds, ["L1-001", "L1-002"]);
  assert.equal(payload.stages.length, 1);
  assert.equal(payload.progress.revision, 4);
  assert.equal(payload.settings.contentVersion, "1.0.0");
  assert.equal(payload.updatedAt, "2026-07-10T17:00:01.000Z");
});

test("PUT progress rejects unknown fields and invalid stage IDs", async () => {
  const db = createProgressD1();
  const unknown = validPayload();
  unknown.userId = "someone-else";
  const unknownResponse = await withoutExpectedApiErrorLog(() => apiRequest(db, { method: "PUT", body: unknown }));
  assert.equal(unknownResponse.status, 400);

  const invalidStage = validPayload();
  invalidStage.progress.stageProgress["L6-001"] = invalidStage.progress.stageProgress["L1-001"];
  const invalidResponse = await withoutExpectedApiErrorLog(() => apiRequest(db, { method: "PUT", body: invalidStage }));
  assert.equal(invalidResponse.status, 400);
  assert.equal(db.state.writes.length, 0);
});

test("PUT progress rejects a valid-looking stage that skips the unlock chain", async () => {
  const db = createProgressD1();
  const skipped = validPayload();
  skipped.progress.currentLevel = 2;
  skipped.progress.currentStage = 2;
  skipped.progress.unlockedStageIds = ["L1-001", "L2-001", "L2-002"];
  skipped.progress.stageProgress = {
    "L2-001": skipped.progress.stageProgress["L1-001"]
  };

  const response = await withoutExpectedApiErrorLog(() => apiRequest(db, { method: "PUT", body: skipped }));
  assert.equal(response.status, 400);
  assert.equal(db.state.writes.length, 0);
});

test("PUT progress enforces the request byte limit before schema parsing", async () => {
  const db = createProgressD1();
  const response = await withoutExpectedApiErrorLog(() => apiRequest(db, {
    method: "PUT",
    body: JSON.stringify({ padding: "x".repeat(300 * 1024) })
  }));

  assert.equal(response.status, 413);
  assert.equal(db.state.writes.length, 0);
});
