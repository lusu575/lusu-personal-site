import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { authenticateAgentBearer } from "../functions/api/agent-auth.mjs";
import {
  japaneseSubtextActivityDate,
  onRequest
} from "../functions/api/[[route]].js";

class D1Statement {
  constructor(database, sql, values = []) {
    this.database = database;
    this.sql = sql;
    this.values = values;
  }

  bind(...values) {
    return new D1Statement(this.database, this.sql, values);
  }

  async first() {
    return this.database.prepare(this.sql).get(...this.values) || null;
  }

  async all() {
    return { results: this.database.prepare(this.sql).all(...this.values) };
  }

  async run() {
    const result = this.database.prepare(this.sql).run(...this.values);
    return {
      success: true,
      meta: {
        changes: Number(result.changes || 0),
        last_row_id: result.lastInsertRowid
      }
    };
  }
}

class D1Database {
  constructor() {
    this.sqlite = new DatabaseSync(":memory:");
    this.sqlite.exec("pragma foreign_keys = on");
    this.batchTail = Promise.resolve();
    this.failBatchSqlPattern = null;
  }

  prepare(sql) {
    return new D1Statement(this.sqlite, sql);
  }

  async batch(statements) {
    const previous = this.batchTail;
    let release;
    this.batchTail = new Promise((resolveBatch) => {
      release = resolveBatch;
    });
    await previous;
    const results = [];
    this.sqlite.exec("begin immediate");
    try {
      for (const statement of statements) {
        if (this.failBatchSqlPattern?.test(statement.sql)) {
          throw new Error("Injected D1 batch failure");
        }
        const result = this.sqlite.prepare(statement.sql).run(...statement.values);
        results.push({
          success: true,
          meta: {
            changes: Number(result.changes || 0),
            last_row_id: result.lastInsertRowid
          }
        });
      }
      this.sqlite.exec("commit");
      return results;
    } catch (error) {
      this.sqlite.exec("rollback");
      throw error;
    } finally {
      release();
    }
  }
}

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const contentRoot = resolve(repositoryRoot, "tools", "japanese-subtext", "content");
const origin = "https://example.test";

function createFixture() {
  const db = new D1Database();
  db.sqlite.exec(readFileSync(resolve(repositoryRoot, "cloudflare", "schema.sql"), "utf8"));
  const now = new Date().toISOString();
  db.sqlite.prepare(`
    insert into users (id, email, password_hash, role, created_at, updated_at)
    values ('owner-1', 'owner@example.test', 'unused', 'admin', ?, ?)
  `).run(now, now);

  const tokens = {
    read: "lusu_agent_read_test_token_000000000000000000000001",
    write: "lusu_agent_write_test_token_00000000000000000000001",
    both: "lusu_agent_both_test_token_000000000000000000000001"
  };
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const insertToken = db.sqlite.prepare(`
    insert into agent_access_tokens (
      token_id, token_hash, token_hint, user_id, client_name, scopes,
      created_at, expires_at, last_used_at, revoked_at, revoked_event_id
    ) values (?, ?, ?, 'owner-1', ?, ?, ?, ?, '', '', '')
  `);
  insertToken.run(
    "token-read",
    hash(tokens.read),
    "000001",
    "Read fixture",
    JSON.stringify(["japanese-subtext:progress:read"]),
    now,
    expiresAt
  );
  insertToken.run(
    "token-write",
    hash(tokens.write),
    "000002",
    "Write fixture",
    JSON.stringify(["japanese-subtext:progress:write"]),
    now,
    expiresAt
  );
  insertToken.run(
    "token-both",
    hash(tokens.both),
    "000003",
    "Both fixture",
    JSON.stringify([
      "japanese-subtext:progress:read",
      "japanese-subtext:progress:write"
    ]),
    now,
    expiresAt
  );

  const overrides = new Map();
  const env = {
    DB: db,
    CHAT_IP_HASH_SALT: "test-chat-ip-hash-secret-0000000000000001",
    ANALYTICS_IP_HASH_SALT: "test-analytics-ip-hash-secret-00000001",
    ASSETS: {
      async fetch(request) {
        const pathname = new URL(request.url).pathname;
        if (overrides.has(pathname)) {
          return jsonAsset(overrides.get(pathname));
        }
        const prefix = "/tools/japanese-subtext/content/";
        if (!pathname.startsWith(prefix)) return new Response("Not found", { status: 404 });
        const relative = pathname.slice(prefix.length).split("/").join(sep);
        const target = resolve(contentRoot, relative);
        if (!target.startsWith(`${contentRoot}${sep}`)) return new Response("Not found", { status: 404 });
        try {
          return new Response(readFileSync(target), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          });
        } catch {
          return new Response("Not found", { status: 404 });
        }
      }
    }
  };
  return { db, env, overrides, tokens };
}

function jsonAsset(value) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function lockedStage(level, batch, stageId) {
  const payload = JSON.parse(readFileSync(
    resolve(contentRoot, `level-${level}`, batch),
    "utf8"
  ));
  return payload.stages.find((stage) => stage.id === stageId);
}

function correctPayload(stage, operationId, expectedRevision) {
  return {
    stageId: stage.id,
    stageRevision: stage.revision,
    contentHash: stage.contentHash,
    answers: stage.questions.map((question) => ({
      questionId: question.id,
      optionIds: [...question.correctOptionIds]
    })),
    expectedRevision,
    operationId
  };
}

function incorrectPayload(stage, operationId, expectedRevision) {
  const payload = correctPayload(stage, operationId, expectedRevision);
  const question = stage.questions[0];
  const wrongOption = question.options.find((option) => !question.correctOptionIds.includes(option.id));
  payload.answers[0].optionIds = [wrongOption.id];
  return payload;
}

test("Japanese Subtext Agent activity uses the fixed Asia/Shanghai day boundary", () => {
  assert.equal(japaneseSubtextActivityDate("2026-08-06T15:59:59.999Z"), "2026-08-06");
  assert.equal(japaneseSubtextActivityDate("2026-08-06T16:00:00.000Z"), "2026-08-07");
});

async function call(env, tokens, path, {
  method = "GET",
  token = tokens.both,
  body,
  ip = "203.0.113.80"
} = {}) {
  const headers = {
    Authorization: `Bearer ${token}`,
    "CF-Connecting-IP": ip
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const waits = [];
  const response = await onRequest({
    request: new Request(`${origin}/api/${path}`, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {})
    }),
    env,
    waitUntil(promise) {
      waits.push(promise);
    }
  });
  await Promise.all(waits);
  return response;
}

function businessCounts(db) {
  const scalar = (table) => db.sqlite.prepare(`select count(*) as count from ${table}`).get().count;
  return {
    profiles: scalar("japanese_subtext_profiles"),
    stages: scalar("japanese_subtext_stage_progress"),
    activity: scalar("japanese_subtext_daily_activity"),
    attempts: scalar("japanese_subtext_agent_attempts"),
    receipts: scalar("japanese_subtext_agent_receipts"),
    audits: db.sqlite.prepare(`
      select count(*) as count from agent_audit_log
      where action = 'japanese-subtext-agent-attempt'
    `).get().count
  };
}

test("Japanese Subtext Agent API enforces scopes, locked content, CAS and atomic receipts", async () => {
  const { db, env, overrides, tokens } = createFixture();
  const stage1 = lockedStage(1, "batch-001-010.json", "L1-001");
  const stage2 = lockedStage(1, "batch-001-010.json", "L1-002");

  const principal = await authenticateAgentBearer(new Request(`${origin}/api/agent-auth/me`, {
    headers: { Authorization: `Bearer ${tokens.both}` }
  }), env, ["japanese-subtext:progress:read"]);
  assert.equal(principal.user.role, "user", "an admin account must remain an ordinary Agent principal");

  const beforeRead = businessCounts(db);
  const missingBearer = await call(env, tokens, "tools/japanese-subtext/agent-progress", {
    token: ""
  });
  assert.equal(missingBearer.status, 401);
  assert.equal((await missingBearer.clone().json()).code, "AGENT_TOKEN_REQUIRED");
  assert.match(missingBearer.headers.get("WWW-Authenticate") || "", /^Bearer\b/);
  const initial = await call(env, tokens, "tools/japanese-subtext/agent-progress", {
    token: tokens.read
  });
  assert.equal(initial.status, 200);
  assert.deepEqual(await initial.json(), {
    schemaVersion: 1,
    contentVersion: "1.0.2",
    revision: 1,
    currentStageId: "L1-001",
    unlockedStageIds: ["L1-001"],
    summary: {
      trackedStages: 0,
      clearedStages: 0,
      totalAttempts: 0,
      bestScore: 0,
      medals: { bronze: 0, silver: 0, gold: 0 }
    },
    activity: { days: 30, timeZone: "Asia/Shanghai", entries: [] },
    updatedAt: "1970-01-01T00:00:00.000Z"
  });
  assert.deepEqual(businessCounts(db), beforeRead, "GET must not mutate Japanese progress or audit data");
  assert.ok(
    db.sqlite.prepare("select count(*) as count from api_rate_limits").get().count > 0,
    "read rate limiting may write only infrastructure counters"
  );

  const missingReadScope = await call(env, tokens, "tools/japanese-subtext/agent-progress", {
    token: tokens.write
  });
  assert.equal(missingReadScope.status, 403);
  assert.equal((await missingReadScope.json()).code, "AGENT_SCOPE_REQUIRED");
  const invalidDays = await call(env, tokens, "tools/japanese-subtext/agent-progress?days=91", {
    token: tokens.read
  });
  assert.equal(invalidDays.status, 400);
  assert.equal((await invalidDays.json()).code, "JAPANESE_SUBTEXT_AGENT_QUERY_INVALID");

  const missingWriteScope = await call(env, tokens, "tools/japanese-subtext/attempts", {
    method: "POST",
    token: tokens.read,
    body: correctPayload(stage1, "scope-denied-0001", 1)
  });
  assert.equal(missingWriteScope.status, 403);
  assert.equal((await missingWriteScope.json()).code, "AGENT_SCOPE_REQUIRED");

  const derived = { ...correctPayload(stage1, "derived-fields-0001", 1), score: 100 };
  const derivedResponse = await call(env, tokens, "tools/japanese-subtext/attempts", {
    method: "POST",
    token: tokens.write,
    body: derived
  });
  assert.equal(derivedResponse.status, 400);
  assert.equal((await derivedResponse.json()).code, "JAPANESE_SUBTEXT_AGENT_INPUT_INVALID");
  assert.deepEqual(businessCounts(db), beforeRead);

  const locked = await call(env, tokens, "tools/japanese-subtext/attempts", {
    method: "POST",
    token: tokens.write,
    body: correctPayload(stage2, "locked-stage-0001", 1)
  });
  assert.equal(locked.status, 409);
  assert.equal((await locked.json()).code, "JAPANESE_SUBTEXT_AGENT_STAGE_LOCKED");
  assert.deepEqual(businessCounts(db), beforeRead);

  const staleStage = correctPayload(stage1, "stale-stage-rev-0001", 1);
  staleStage.stageRevision += 1;
  const staleStageResponse = await call(env, tokens, "tools/japanese-subtext/attempts", {
    method: "POST",
    token: tokens.write,
    body: staleStage
  });
  assert.equal(staleStageResponse.status, 409);
  assert.equal(
    (await staleStageResponse.json()).code,
    "JAPANESE_SUBTEXT_AGENT_STAGE_REVISION_MISMATCH"
  );
  assert.deepEqual(businessCounts(db), beforeRead);

  const staleHash = correctPayload(stage1, "stale-content-hash-0001", 1);
  staleHash.contentHash = "0".repeat(64);
  const staleHashResponse = await call(env, tokens, "tools/japanese-subtext/attempts", {
    method: "POST",
    token: tokens.write,
    body: staleHash
  });
  assert.equal(staleHashResponse.status, 409);
  assert.equal(
    (await staleHashResponse.json()).code,
    "JAPANESE_SUBTEXT_AGENT_CONTENT_HASH_MISMATCH"
  );
  assert.deepEqual(businessCounts(db), beforeRead);

  const operationId = "concurrent-clear-0001";
  const clearPayload = correctPayload(stage1, operationId, 1);
  const [first, replay] = await Promise.all([
    call(env, tokens, "tools/japanese-subtext/attempts", {
      method: "POST",
      token: tokens.write,
      body: clearPayload,
      ip: "203.0.113.81"
    }),
    call(env, tokens, "tools/japanese-subtext/attempts", {
      method: "POST",
      token: tokens.write,
      body: clearPayload,
      ip: "203.0.113.81"
    })
  ]);
  assert.equal(first.status, 200);
  assert.equal(replay.status, 200, await replay.clone().text());
  const firstText = await first.text();
  const replayText = await replay.text();
  assert.equal(replayText, firstText, "same operation and payload must replay the exact receipt bytes");
  const clearResult = JSON.parse(firstText);
  assert.equal(clearResult.revision, 2);
  assert.equal(clearResult.attempt.score, 100);
  assert.equal(clearResult.attempt.cleared, true);
  assert.equal(clearResult.attempt.medal, "bronze");
  assert.equal(clearResult.attempt.attemptMode, "bilingual");
  assert.equal(clearResult.attempt.usedTranslation, true);
  assert.equal(clearResult.attempt.usedKana, true);
  assert.equal(clearResult.attempt.usedListeningMode, false);
  assert.deepEqual(businessCounts(db), {
    profiles: 1,
    stages: 1,
    activity: 1,
    attempts: 1,
    receipts: 1,
    audits: 1
  });
  assert.deepEqual(
    { ...db.sqlite.prepare(`
      select revision, current_level, current_stage, last_agent_operation_id
      from japanese_subtext_profiles where user_id = 'owner-1'
    `).get() },
    { revision: 2, current_level: 1, current_stage: 2, last_agent_operation_id: operationId }
  );
  assert.deepEqual(
    { ...db.sqlite.prepare(`
      select attempts, best_score, best_medal, cleared, first_clear_mode,
        used_translation, used_kana, used_listening_mode
      from japanese_subtext_stage_progress
      where user_id = 'owner-1' and stage_id = 'L1-001'
    `).get() },
    {
      attempts: 1,
      best_score: 100,
      best_medal: 1,
      cleared: 1,
      first_clear_mode: "bilingual",
      used_translation: 1,
      used_kana: 1,
      used_listening_mode: 0
    }
  );

  const conflictingReplay = incorrectPayload(stage1, operationId, 1);
  const conflict = await call(env, tokens, "tools/japanese-subtext/attempts", {
    method: "POST",
    token: tokens.write,
    body: conflictingReplay
  });
  assert.equal(conflict.status, 409);
  assert.equal((await conflict.json()).code, "JAPANESE_SUBTEXT_AGENT_OPERATION_CONFLICT");
  assert.equal(businessCounts(db).attempts, 1);

  const staleProgress = await call(env, tokens, "tools/japanese-subtext/attempts", {
    method: "POST",
    token: tokens.write,
    body: correctPayload(stage2, "stale-progress-0001", 1)
  });
  assert.equal(staleProgress.status, 409);
  const staleProgressBody = await staleProgress.json();
  assert.equal(staleProgressBody.code, "JAPANESE_SUBTEXT_AGENT_REVISION_CONFLICT");
  assert.equal(staleProgressBody.details.currentRevision, 2);
  assert.equal(businessCounts(db).attempts, 1);

  const failedAttempt = await call(env, tokens, "tools/japanese-subtext/attempts", {
    method: "POST",
    token: tokens.write,
    body: incorrectPayload(stage2, "failed-stage-0001", 2)
  });
  assert.equal(failedAttempt.status, 200);
  const failedAttemptBody = await failedAttempt.json();
  assert.equal(failedAttemptBody.revision, 3);
  assert.equal(failedAttemptBody.attempt.cleared, false);
  assert.equal(failedAttemptBody.attempt.medal, "none");
  assert.ok(failedAttemptBody.attempt.score < 100);
  assert.equal(businessCounts(db).attempts, 2);

  const projection = await call(
    env,
    tokens,
    "tools/japanese-subtext/agent-progress?stageId=L1-002&days=90",
    { token: tokens.read }
  );
  assert.equal(projection.status, 200);
  const projectionBody = await projection.json();
  assert.equal(projectionBody.revision, 3);
  assert.equal(projectionBody.currentStageId, "L1-002");
  assert.deepEqual(projectionBody.unlockedStageIds, ["L1-001", "L1-002"]);
  assert.equal(projectionBody.summary.totalAttempts, 2);
  assert.equal(projectionBody.stage.stageId, "L1-002");
  assert.equal(projectionBody.stage.unlocked, true);
  assert.equal(projectionBody.stage.attempts, 1);
  assert.equal(projectionBody.activity.days, 90);
  assert.equal(projectionBody.activity.entries.length, 1);
  assert.equal(projectionBody.activity.entries[0].stageCount, 2);
  assert.equal(projectionBody.activity.entries[0].clearedStages, 1);
  assert.equal(Object.hasOwn(projectionBody, "settings"), false);

  const indexPath = "/tools/japanese-subtext/content/level-1/index.json";
  const index = JSON.parse(readFileSync(resolve(contentRoot, "level-1", "index.json"), "utf8"));
  index.stages.find((entry) => entry.id === "L1-002").contentHash = "f".repeat(64);
  overrides.set(indexPath, index);
  const tamperedIndex = await call(env, tokens, "tools/japanese-subtext/attempts", {
    method: "POST",
    token: tokens.write,
    body: correctPayload(stage2, "tampered-index-0001", 3)
  });
  assert.equal(tamperedIndex.status, 500);
  assert.equal((await tamperedIndex.json()).code, "JAPANESE_SUBTEXT_AGENT_STAGE_INVALID");
  overrides.delete(indexPath);

  const batchPath = "/tools/japanese-subtext/content/level-1/batch-001-010.json";
  const batch = JSON.parse(readFileSync(resolve(contentRoot, "level-1", "batch-001-010.json"), "utf8"));
  batch.stages.find((entry) => entry.id === "L1-002").title.en += " tampered";
  overrides.set(batchPath, batch);
  const tamperedBatch = await call(env, tokens, "tools/japanese-subtext/attempts", {
    method: "POST",
    token: tokens.write,
    body: correctPayload(stage2, "tampered-batch-0001", 3)
  });
  assert.equal(tamperedBatch.status, 500);
  assert.equal((await tamperedBatch.json()).code, "JAPANESE_SUBTEXT_AGENT_STAGE_INVALID");
  overrides.delete(batchPath);
  assert.equal(businessCounts(db).attempts, 2);
});

test("Japanese Subtext Agent attempts and receipts are cleaned after 180 days", async () => {
  const { db, env, tokens } = createFixture();
  const old = "2025-01-01T00:00:00.000Z";
  const attemptId = "jst_attempt_old-retention-fixture";
  db.sqlite.prepare(`
    insert into japanese_subtext_agent_attempts (
      attempt_id, user_id, token_id, operation_id, payload_hash, stage_id,
      stage_revision, content_hash, expected_revision, resulting_revision,
      answers_json, score, cleared, medal, attempt_mode, used_translation,
      used_kana, used_listening_mode, replay_count, hint_count, created_at
    ) values (?, 'owner-1', 'token-write', 'old-retention-op', ?, 'L1-001',
      1, ?, 1, 2, '[]', 0, 0, 0, 'bilingual', 1, 1, 0, 0, 0, ?)
  `).run(attemptId, "a".repeat(64), "b".repeat(64), old);
  db.sqlite.prepare(`
    insert into japanese_subtext_agent_receipts (
      user_id, operation_id, payload_hash, attempt_id, response_json, created_at
    ) values ('owner-1', 'old-retention-op', ?, ?, '{}', ?)
  `).run("a".repeat(64), attemptId, old);
  db.sqlite.prepare("delete from site_runtime_state where key = 'api_periodic_data_cleanup'").run();

  const response = await call(env, tokens, "health", { token: tokens.read });
  assert.equal(response.status, 200);
  assert.equal(
    db.sqlite.prepare("select count(*) as count from japanese_subtext_agent_receipts").get().count,
    0
  );
  assert.equal(
    db.sqlite.prepare("select count(*) as count from japanese_subtext_agent_attempts").get().count,
    0
  );
});

test("Japanese Subtext Agent batch failure rolls back every business write", async () => {
  const { db, env, tokens } = createFixture();
  const stage = lockedStage(1, "batch-001-010.json", "L1-001");
  const payload = correctPayload(stage, "atomic-rollback-0001", 1);
  db.failBatchSqlPattern = /insert into japanese_subtext_agent_receipts/i;

  const failed = await call(env, tokens, "tools/japanese-subtext/attempts", {
    method: "POST",
    token: tokens.write,
    body: payload
  });
  assert.equal(failed.status, 500);
  assert.deepEqual(businessCounts(db), {
    profiles: 0,
    stages: 0,
    activity: 0,
    attempts: 0,
    receipts: 0,
    audits: 0
  });

  db.failBatchSqlPattern = null;
  const retried = await call(env, tokens, "tools/japanese-subtext/attempts", {
    method: "POST",
    token: tokens.write,
    body: payload
  });
  assert.equal(retried.status, 200);
  assert.deepEqual(businessCounts(db), {
    profiles: 1,
    stages: 1,
    activity: 1,
    attempts: 1,
    receipts: 1,
    audits: 1
  });
});
