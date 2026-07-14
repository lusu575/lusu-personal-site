import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
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

function createProgressD1({ signedIn = true, profile = null, stages = [], activities = [] } = {}) {
  const state = {
    profile,
    stages: new Map(stages.map((stage) => [stage.stage_id, stage])),
    activities: new Map(activities.map((activity) => [`${activity.local_date}|${activity.stage_id}`, activity])),
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
          const rows = normalized.includes("json_each")
            ? JSON.parse(this.params[2]).map((row) => ({
                user_id: this.params[0],
                stage_id: row.stageId,
                level: row.level,
                stage: row.stage,
                cleared: row.cleared,
                best_score: row.bestScore,
                best_medal: row.bestMedal,
                attempts: row.attempts,
                first_accuracy: row.firstAccuracy,
                first_clear_mode: row.firstClearMode,
                used_translation: row.usedTranslation,
                used_kana: row.usedKana,
                used_listening_mode: row.usedListeningMode,
                replay_count: row.replayCount,
                hint_count: row.hintCount,
                progress_updated_at: row.updatedAt,
                updated_at: this.params[1]
              }))
            : [Object.fromEntries([
                "user_id", "stage_id", "level", "stage", "cleared", "best_score", "best_medal", "attempts",
                "first_accuracy", "first_clear_mode", "used_translation", "used_kana", "used_listening_mode",
                "replay_count", "hint_count", "progress_updated_at", "updated_at"
              ].map((key, index) => [key, this.params[index]]))];
          for (const row of rows) {
            const before = state.stages.get(row.stage_id);
            state.stages.set(row.stage_id, {
              ...row,
              cleared: Math.max(Number(before?.cleared || 0), Number(row.cleared)),
              best_score: Math.max(Number(before?.best_score || 0), Number(row.best_score)),
              best_medal: Math.max(Number(before?.best_medal || 0), Number(row.best_medal)),
              attempts: Math.max(Number(before?.attempts || 0), Number(row.attempts)),
              first_accuracy: Math.max(Number(before?.first_accuracy || 0), Number(row.first_accuracy)),
              first_clear_mode: before?.first_clear_mode || row.first_clear_mode,
              used_translation: Math.max(Number(before?.used_translation || 0), Number(row.used_translation)),
              used_kana: Math.max(Number(before?.used_kana || 0), Number(row.used_kana)),
              used_listening_mode: Math.max(Number(before?.used_listening_mode || 0), Number(row.used_listening_mode)),
              replay_count: Math.max(Number(before?.replay_count || 0), Number(row.replay_count)),
              hint_count: Math.max(Number(before?.hint_count || 0), Number(row.hint_count)),
              progress_updated_at: [before?.progress_updated_at || "", row.progress_updated_at].sort().at(-1)
            });
            state.writes.push({ table: "stage", params: row });
          }
        }
        if (normalized.startsWith("insert into japanese_subtext_daily_activity")) {
          const rows = normalized.includes("json_each")
            ? JSON.parse(this.params[2]).map((row) => ({
                user_id: this.params[0],
                local_date: row.localDate,
                stage_id: row.stageId,
                cleared: row.cleared,
                best_medal: row.bestMedal,
                activity_updated_at: row.updatedAt,
                updated_at: this.params[1]
              }))
            : [Object.fromEntries([
                "user_id", "local_date", "stage_id", "cleared", "best_medal", "activity_updated_at", "updated_at"
              ].map((key, index) => [key, this.params[index]]))];
          for (const row of rows) {
            const key = `${row.local_date}|${row.stage_id}`;
            const before = state.activities.get(key);
            state.activities.set(key, {
              ...row,
              cleared: Math.max(Number(before?.cleared || 0), Number(row.cleared)),
              best_medal: Math.max(Number(before?.best_medal || 0), Number(row.best_medal)),
              activity_updated_at: [before?.activity_updated_at || "", row.activity_updated_at].sort().at(-1)
            });
            state.writes.push({ table: "activity", params: row });
          }
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
        if (/from japanese_subtext_daily_activity/i.test(sql)) {
          return { results: [...state.activities.values()] };
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

function createSqliteProgressD1() {
  const database = new DatabaseSync(":memory:");
  database.exec(`
    pragma foreign_keys = on;
    create table users (
      id text primary key,
      email text not null unique,
      password_hash text not null,
      role text not null default 'user',
      created_at text not null,
      updated_at text not null
    );
    create table sessions (
      token_hash text primary key,
      user_id text not null references users(id) on delete cascade,
      created_at text not null,
      expires_at text not null
    );
    create table japanese_subtext_profiles (
      user_id text primary key references users(id) on delete cascade,
      schema_version integer not null default 1 check(schema_version = 1),
      content_version text not null,
      revision integer not null default 1 check(revision between 1 and 1000000),
      current_level integer not null default 1 check(current_level between 1 and 5),
      current_stage integer not null default 1 check(current_stage between 1 and 50),
      settings_json text not null default '{}',
      progress_updated_at text not null,
      settings_updated_at text not null,
      created_at text not null,
      updated_at text not null
    );
    create table japanese_subtext_stage_progress (
      user_id text not null references users(id) on delete cascade,
      stage_id text not null,
      level integer not null check(level between 1 and 5),
      stage integer not null check(stage between 1 and 50),
      cleared integer not null default 0 check(cleared in (0, 1)),
      best_score integer not null default 0 check(best_score between 0 and 100),
      best_medal integer not null default 0 check(best_medal between 0 and 3),
      attempts integer not null default 0 check(attempts between 0 and 1000000),
      first_accuracy integer not null default 0 check(first_accuracy between 0 and 100),
      first_clear_mode text not null default '',
      used_translation integer not null default 0 check(used_translation in (0, 1)),
      used_kana integer not null default 0 check(used_kana in (0, 1)),
      used_listening_mode integer not null default 0 check(used_listening_mode in (0, 1)),
      replay_count integer not null default 0 check(replay_count between 0 and 1000000),
      hint_count integer not null default 0 check(hint_count between 0 and 1000000),
      progress_updated_at text not null,
      updated_at text not null,
      primary key (user_id, stage_id)
    );
    create table japanese_subtext_daily_activity (
      user_id text not null references users(id) on delete cascade,
      local_date text not null,
      stage_id text not null,
      cleared integer not null default 0 check(cleared in (0, 1)),
      best_medal integer not null default 0 check(best_medal between 0 and 3),
      activity_updated_at text not null,
      updated_at text not null,
      primary key (user_id, local_date, stage_id)
    );
  `);
  const sessionHash = createHash("sha256").update("mock-session").digest("hex");
  const createdAt = "2026-07-10T00:00:00.000Z";
  database.prepare(`
    insert into users (id, email, password_hash, role, created_at, updated_at)
    values (?, ?, ?, ?, ?, ?)
  `).run("user-123", "reader@example.test", "unused", "user", createdAt, createdAt);
  database.prepare(`
    insert into sessions (token_hash, user_id, created_at, expires_at)
    values (?, ?, ?, ?)
  `).run(sessionHash, "user-123", createdAt, "2099-01-01T00:00:00.000Z");

  const state = {
    progressQueries: 0,
    changedProgressRows: 0,
    maxProgressBindBytes: 0,
    maxProgressBindCount: 0,
    maxProgressStatementBytes: 0
  };
  const isProgressQuery = (sql) => (
    /\bjapanese_subtext_(?:profiles|stage_progress|daily_activity)\b/i.test(sql)
    && !/^\s*create\b/i.test(sql)
  );
  const recordProgressQuery = (sql, params, changes = 0) => {
    if (!isProgressQuery(sql)) return;
    state.progressQueries += 1;
    state.changedProgressRows += changes;
    state.maxProgressBindCount = Math.max(state.maxProgressBindCount, params.length);
    state.maxProgressStatementBytes = Math.max(state.maxProgressStatementBytes, Buffer.byteLength(sql, "utf8"));
    for (const value of params) {
      if (typeof value === "string") {
        state.maxProgressBindBytes = Math.max(state.maxProgressBindBytes, Buffer.byteLength(value, "utf8"));
      }
    }
  };

  function statement(sql) {
    return {
      sql,
      params: [],
      bind(...params) {
        this.params = params;
        return this;
      },
      async run() {
        const result = database.prepare(sql).run(...this.params);
        recordProgressQuery(sql, this.params, Number(result.changes || 0));
        return { success: true, meta: { changes: Number(result.changes || 0) } };
      },
      async first() {
        const row = database.prepare(sql).get(...this.params);
        recordProgressQuery(sql, this.params);
        return row || null;
      },
      async all() {
        const rows = database.prepare(sql).all(...this.params);
        recordProgressQuery(sql, this.params);
        return { results: rows };
      }
    };
  }

  function seedLegacyProgress({ profile = null, stages = [], activities = [] } = {}) {
    database.exec("begin");
    try {
      if (profile) {
        database.prepare(`
          insert into japanese_subtext_profiles (
            user_id, schema_version, content_version, revision, current_level, current_stage,
            settings_json, progress_updated_at, settings_updated_at, created_at, updated_at
          ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          profile.user_id,
          profile.schema_version,
          profile.content_version,
          profile.revision,
          profile.current_level,
          profile.current_stage,
          profile.settings_json,
          profile.progress_updated_at,
          profile.settings_updated_at,
          profile.created_at,
          profile.updated_at
        );
      }
      const stageStatement = database.prepare(`
        insert into japanese_subtext_stage_progress (
          user_id, stage_id, level, stage, cleared, best_score, best_medal, attempts,
          first_accuracy, first_clear_mode, used_translation, used_kana,
          used_listening_mode, replay_count, hint_count, progress_updated_at, updated_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const stage of stages) {
        stageStatement.run(
          stage.user_id,
          stage.stage_id,
          stage.level,
          stage.stage,
          stage.cleared,
          stage.best_score,
          stage.best_medal,
          stage.attempts,
          stage.first_accuracy,
          stage.first_clear_mode,
          stage.used_translation,
          stage.used_kana,
          stage.used_listening_mode,
          stage.replay_count,
          stage.hint_count,
          stage.progress_updated_at,
          stage.updated_at
        );
      }
      const activityStatement = database.prepare(`
        insert into japanese_subtext_daily_activity (
          user_id, local_date, stage_id, cleared, best_medal, activity_updated_at, updated_at
        ) values (?, ?, ?, ?, ?, ?, ?)
      `);
      for (const activity of activities) {
        activityStatement.run(
          activity.user_id,
          activity.local_date,
          activity.stage_id,
          activity.cleared,
          activity.best_medal,
          activity.activity_updated_at,
          activity.updated_at
        );
      }
      database.exec("commit");
    } catch (error) {
      database.exec("rollback");
      throw error;
    }
  }

  function rawProgress() {
    return {
      profile: database.prepare(`
        select * from japanese_subtext_profiles where user_id = ?
      `).get("user-123") || null,
      stages: database.prepare(`
        select * from japanese_subtext_stage_progress where user_id = ? order by level, stage
      `).all("user-123"),
      activities: database.prepare(`
        select * from japanese_subtext_daily_activity
        where user_id = ? order by local_date, stage_id
      `).all("user-123")
    };
  }

  function installActivityConstraintFailure() {
    database.exec(`
      create trigger test_japanese_subtext_activity_constraint_failure
      before insert on japanese_subtext_daily_activity
      begin
        select raise(abort, 'forced activity constraint failure');
      end
    `);
  }

  return {
    state,
    prepare(sql) {
      return statement(sql);
    },
    async batch(statements) {
      // D1 batch() is transactional; mirror that contract explicitly in SQLite.
      database.exec("begin");
      try {
        const results = [];
        for (const item of statements) results.push(await item.run());
        database.exec("commit");
        return results;
      } catch (error) {
        database.exec("rollback");
        throw error;
      }
    },
    resetMetrics() {
      state.progressQueries = 0;
      state.changedProgressRows = 0;
      state.maxProgressBindBytes = 0;
      state.maxProgressBindCount = 0;
      state.maxProgressStatementBytes = 0;
    },
    seedLegacyProgress,
    rawProgress,
    installActivityConstraintFailure,
    close() {
      database.close();
    }
  };
}

function validPayload() {
  return {
    progress: {
      schemaVersion: 1,
      contentVersion: "1.0.3",
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
      activityDays: {
        "2026-07-11": {
          stages: {
            "L1-001": { cleared: true, medal: "gold", updatedAt: "2026-07-10T17:00:00.000Z" }
          },
          updatedAt: "2026-07-10T17:00:00.000Z"
        }
      },
      updatedAt: "2026-07-10T17:00:00.000Z"
    },
    settings: {
      schemaVersion: 1,
      contentVersion: "1.0.3",
      uiLanguage: "zh",
      displayMode: "japanese",
      optionLanguage: "ja",
      kana: false,
      optionText: true,
      optionAudio: true,
      autoReadOptions: false,
      autoplay: false,
      playbackRate: 1,
      muted: false,
      updatedAt: "2026-07-10T17:00:00.000Z"
    }
  };
}

function fullProgressPayload() {
  const payload = validPayload();
  const stageProgress = {};
  const unlockedStageIds = [];
  for (let level = 1; level <= 5; level += 1) {
    for (let stage = 1; stage <= 50; stage += 1) {
      const stageId = `L${level}-${String(stage).padStart(3, "0")}`;
      unlockedStageIds.push(stageId);
      stageProgress[stageId] = {
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
        updatedAt: "2025-01-01T00:00:00.000Z"
      };
    }
  }
  const activityDays = {};
  for (let day = 1; day <= 20; day += 1) {
    const localDate = `2025-01-${String(day).padStart(2, "0")}`;
    activityDays[localDate] = {
      stages: Object.fromEntries(unlockedStageIds.map((stageId) => [stageId, {
        cleared: true,
        medal: "gold",
        updatedAt: "2025-01-01T00:00:00.000Z"
      }])),
      updatedAt: "2025-01-01T00:00:00.000Z"
    };
  }
  payload.progress = {
    ...payload.progress,
    revision: 250,
    currentLevel: 5,
    currentStage: 50,
    unlockedStageIds,
    stageProgress,
    activityDays,
    updatedAt: "2025-01-01T00:00:00.000Z"
  };
  payload.settings.updatedAt = "2025-01-01T00:00:00.000Z";
  return payload;
}

function utcDateOffset(days) {
  const date = new Date();
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days))
    .toISOString()
    .slice(0, 10);
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
  assert.equal(db.state.activities.get("2026-07-11|L1-001").best_medal, 3);
  assert.equal(payload.profile.currentLevel, 1);
  assert.equal(payload.profile.currentStage, 2);
  assert.equal(payload.stages[0].stageId, "L1-001");
  assert.equal(payload.progress.stageProgress["L1-001"].medal, "gold");
  assert.equal(payload.progress.activityDays["2026-07-11"].stages["L1-001"].medal, "gold");
  assert.equal(payload.settings.uiLanguage, "zh");
  assert.equal(typeof payload.updatedAt, "string");
  assert.equal(payload.user, undefined);
  assert.equal(JSON.stringify(payload).includes("reader@example.test"), false);

  const second = await apiRequest(db, { method: "PUT", body: validPayload() });
  assert.equal(second.status, 200);
  assert.equal(db.state.stages.size, 1);
});

test("PUT bulk sync stays below ten progress queries at the 250-stage and 5000-activity limits", async (t) => {
  const db = createSqliteProgressD1();
  t.after(() => db.close());
  const body = fullProgressPayload();
  assert.ok(Buffer.byteLength(JSON.stringify(body), "utf8") < 1024 * 1024);

  const response = await apiRequest(db, { method: "PUT", body });

  assert.equal(response.status, 200);
  assert.equal(db.state.progressQueries, 8);
  assert.ok(db.state.maxProgressBindBytes < 2_000_000);
  assert.ok(db.state.maxProgressBindCount <= 100);
  assert.ok(db.state.maxProgressStatementBytes < 100_000);
});

test("PUT does not rewrite unchanged profile, stage, or activity rows", async (t) => {
  const db = createSqliteProgressD1();
  t.after(() => db.close());
  const body = validPayload();
  assert.equal((await apiRequest(db, { method: "PUT", body })).status, 200);
  db.resetMetrics();

  const response = await apiRequest(db, { method: "PUT", body });

  assert.equal(response.status, 200);
  assert.equal(db.state.progressQueries, 8);
  assert.equal(db.state.changedProgressRows, 0);
});

test("accepted forward clock skew does not force unchanged rows to rewrite", async (t) => {
  const db = createSqliteProgressD1();
  t.after(() => db.close());
  const body = validPayload();
  const nearFuture = new Date(Date.now() + 4 * 60 * 1000).toISOString();
  body.progress.updatedAt = nearFuture;
  body.settings.updatedAt = nearFuture;
  body.progress.stageProgress["L1-001"].updatedAt = nearFuture;
  body.progress.activityDays["2026-07-11"].updatedAt = nearFuture;
  body.progress.activityDays["2026-07-11"].stages["L1-001"].updatedAt = nearFuture;
  assert.equal((await apiRequest(db, { method: "PUT", body })).status, 200);
  db.resetMetrics();

  const response = await apiRequest(db, { method: "PUT", body });

  assert.equal(response.status, 200);
  assert.equal(db.state.progressQueries, 8);
  assert.equal(db.state.changedProgressRows, 0);
});

test("PUT repairs legacy future timestamps and removes future or orphaned activity in SQLite", async (t) => {
  const db = createSqliteProgressD1();
  t.after(() => db.close());
  const future = "2099-01-01T00:00:00.000Z";
  const settings = { ...validPayload().settings, uiLanguage: "ja", updatedAt: future };
  db.seedLegacyProgress({
    profile: {
      user_id: "user-123",
      schema_version: 1,
      content_version: "1.0.3",
      revision: 2,
      current_level: 1,
      current_stage: 2,
      settings_json: JSON.stringify(settings),
      progress_updated_at: future,
      settings_updated_at: future,
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
      progress_updated_at: future,
      updated_at: "2026-07-10T17:00:01.000Z"
    }],
    activities: [
      {
        user_id: "user-123",
        local_date: "2026-07-11",
        stage_id: "L1-001",
        cleared: 1,
        best_medal: 3,
        activity_updated_at: future,
        updated_at: "2026-07-10T17:00:02.000Z"
      },
      {
        user_id: "user-123",
        local_date: "2099-01-01",
        stage_id: "L1-001",
        cleared: 1,
        best_medal: 3,
        activity_updated_at: future,
        updated_at: "2026-07-10T17:00:02.000Z"
      },
      {
        user_id: "user-123",
        local_date: "2026-07-10",
        stage_id: "L1-002",
        cleared: 1,
        best_medal: 1,
        activity_updated_at: "2026-07-10T17:00:00.000Z",
        updated_at: "2026-07-10T17:00:02.000Z"
      }
    ]
  });

  const response = await apiRequest(db, { method: "PUT", body: validPayload() });
  const stored = db.rawProgress();

  assert.equal(response.status, 200);
  assert.equal(stored.profile.progress_updated_at, "2026-07-10T17:00:00.000Z");
  assert.equal(stored.profile.settings_updated_at, "2026-07-10T17:00:00.000Z");
  assert.equal(JSON.parse(stored.profile.settings_json).uiLanguage, "zh");
  assert.equal(stored.stages[0].progress_updated_at, "2026-07-10T17:00:00.000Z");
  assert.deepEqual(
    stored.activities.map((row) => `${row.local_date}|${row.stage_id}|${row.activity_updated_at}`),
    ["2026-07-11|L1-001|2026-07-10T17:00:00.000Z"]
  );
});

test("PUT rolls back profile and stage writes when a later SQLite batch constraint fails", async (t) => {
  const db = createSqliteProgressD1();
  t.after(() => db.close());
  db.installActivityConstraintFailure();

  const response = await withoutExpectedApiErrorLog(() => apiRequest(db, {
    method: "PUT",
    body: validPayload()
  }));
  const stored = db.rawProgress();

  assert.equal(response.status, 500);
  assert.ok(db.state.changedProgressRows >= 2);
  assert.equal(stored.profile, null);
  assert.deepEqual(stored.stages, []);
  assert.deepEqual(stored.activities, []);
});

test("PUT rejects ISO timestamps beyond the allowed clock skew", async (t) => {
  const future = "2099-01-01T00:00:00.000Z";
  const cases = [
    ["progress", (payload) => { payload.progress.updatedAt = future; }],
    ["settings", (payload) => { payload.settings.updatedAt = future; }],
    ["stage", (payload) => { payload.progress.stageProgress["L1-001"].updatedAt = future; }],
    ["activity day", (payload) => { payload.progress.activityDays["2026-07-11"].updatedAt = future; }],
    ["activity stage", (payload) => { payload.progress.activityDays["2026-07-11"].stages["L1-001"].updatedAt = future; }]
  ];
  for (const [label, mutate] of cases) {
    await t.test(label, async () => {
      const db = createProgressD1();
      const payload = validPayload();
      mutate(payload);
      const response = await withoutExpectedApiErrorLog(() => apiRequest(db, { method: "PUT", body: payload }));
      assert.equal(response.status, 400);
      assert.equal(db.state.writes.length, 0);
    });
  }
});

test("PUT accepts small client clock skew but rejects local dates beyond UTC plus one day", async () => {
  const nearFuture = new Date(Date.now() + 4 * 60 * 1000).toISOString();
  const accepted = validPayload();
  accepted.progress.updatedAt = nearFuture;
  accepted.settings.updatedAt = nearFuture;
  accepted.progress.stageProgress["L1-001"].updatedAt = nearFuture;
  accepted.progress.activityDays = {
    [utcDateOffset(1)]: {
      stages: {
        "L1-001": { cleared: true, medal: "gold", updatedAt: nearFuture }
      },
      updatedAt: nearFuture
    }
  };
  assert.equal((await apiRequest(createProgressD1(), { method: "PUT", body: accepted })).status, 200);

  const rejected = validPayload();
  rejected.progress.activityDays = {
    [utcDateOffset(2)]: rejected.progress.activityDays["2026-07-11"]
  };
  const response = await withoutExpectedApiErrorLog(() => apiRequest(createProgressD1(), { method: "PUT", body: rejected }));
  assert.equal(response.status, 400);
});

test("PUT rejects activity rows that are absent from or exceed stage progress", async (t) => {
  const cases = [
    ["missing stage progress", (payload) => {
      payload.progress.stageProgress = {};
      payload.progress.unlockedStageIds = ["L1-001"];
      payload.progress.currentStage = 1;
    }],
    ["activity clear exceeds uncleared stage", (payload) => {
      Object.assign(payload.progress.stageProgress["L1-001"], {
        cleared: false,
        medal: "none",
        firstClearMode: ""
      });
      payload.progress.unlockedStageIds = ["L1-001"];
      payload.progress.currentStage = 1;
    }],
    ["activity medal exceeds best stage medal", (payload) => {
      payload.progress.stageProgress["L1-001"].medal = "silver";
    }]
  ];
  for (const [label, mutate] of cases) {
    await t.test(label, async () => {
      const db = createProgressD1();
      const payload = validPayload();
      mutate(payload);
      const response = await withoutExpectedApiErrorLog(() => apiRequest(db, { method: "PUT", body: payload }));
      assert.equal(response.status, 400);
      assert.equal(db.state.writes.length, 0);
    });
  }
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
      content_version: "1.0.3",
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
    }],
    activities: [{
      user_id: "user-123",
      local_date: "2026-07-10",
      stage_id: "L1-001",
      cleared: 1,
      best_medal: 3,
      activity_updated_at: "2026-07-10T17:00:00.000Z",
      updated_at: "2026-07-10T17:00:02.000Z"
    }]
  });

  const response = await apiRequest(db);
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(payload.profile.unlockedStageIds, ["L1-001", "L1-002"]);
  assert.equal(payload.stages.length, 1);
  assert.equal(payload.progress.revision, 4);
  assert.equal(payload.progress.activityDays["2026-07-10"].stages["L1-001"].medal, "gold");
  assert.equal(payload.settings.contentVersion, "1.0.3");
  assert.equal(payload.updatedAt, "2026-07-10T17:00:02.000Z");
});

test("GET progress neutralizes legacy future timestamps and future-dated activity", async () => {
  const future = "2099-01-01T00:00:00.000Z";
  const settings = { ...validPayload().settings, uiLanguage: "ja", updatedAt: future };
  const db = createProgressD1({
    profile: {
      user_id: "user-123",
      schema_version: 1,
      content_version: "1.0.3",
      revision: 4,
      current_level: 1,
      current_stage: 2,
      settings_json: JSON.stringify(settings),
      progress_updated_at: future,
      settings_updated_at: future,
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
      progress_updated_at: future,
      updated_at: "2026-07-10T17:00:01.000Z"
    }],
    activities: [{
      user_id: "user-123",
      local_date: "2099-01-01",
      stage_id: "L1-001",
      cleared: 1,
      best_medal: 3,
      activity_updated_at: future,
      updated_at: "2026-07-10T17:00:02.000Z"
    }]
  });

  const response = await apiRequest(db);
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.settings.uiLanguage, "ja");
  assert.equal(payload.settings.updatedAt, "1970-01-01T00:00:00.000Z");
  assert.equal(payload.progress.updatedAt, "1970-01-01T00:00:00.000Z");
  assert.equal(payload.progress.stageProgress["L1-001"].updatedAt, "1970-01-01T00:00:00.000Z");
  assert.deepEqual(payload.progress.activityDays, {});
});

test("GET progress filters legacy activity that exceeds its stage aggregate", async () => {
  const settings = validPayload().settings;
  const db = createProgressD1({
    profile: {
      user_id: "user-123",
      schema_version: 1,
      content_version: "1.0.3",
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
      best_score: 80,
      best_medal: 2,
      attempts: 2,
      first_accuracy: 60,
      first_clear_mode: "japanese",
      used_translation: 0,
      used_kana: 0,
      used_listening_mode: 0,
      replay_count: 0,
      hint_count: 0,
      progress_updated_at: "2026-07-10T17:00:00.000Z",
      updated_at: "2026-07-10T17:00:01.000Z"
    }],
    activities: [
      {
        user_id: "user-123",
        local_date: "2026-07-09",
        stage_id: "L1-001",
        cleared: 1,
        best_medal: 3,
        activity_updated_at: "2026-07-10T17:00:00.000Z",
        updated_at: "2026-07-10T17:00:02.000Z"
      },
      {
        user_id: "user-123",
        local_date: "2026-07-10",
        stage_id: "L1-001",
        cleared: 1,
        best_medal: 1,
        activity_updated_at: "2026-07-10T17:00:00.000Z",
        updated_at: "2026-07-10T17:00:02.000Z"
      }
    ]
  });

  const response = await apiRequest(db);
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.progress.activityDays["2026-07-09"], undefined);
  assert.equal(payload.progress.activityDays["2026-07-10"].stages["L1-001"].medal, "bronze");
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
    body: JSON.stringify({ padding: "x".repeat(1100 * 1024) })
  }));

  assert.equal(response.status, 413);
  assert.equal(db.state.writes.length, 0);
});
