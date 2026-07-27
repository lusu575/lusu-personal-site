import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { onRequest } from "../functions/api/[[route]].js";

const SESSION_TOKEN = "game-save-cas-session";
const USER_ID = "game-save-cas-user";
const CONFLICT_ERROR = "云端存档状态已变化，请重新获取后再试。";
const RUNTIME_SECRETS = Object.freeze({
  CHAT_IP_HASH_SALT: "game-save-cas-chat-secret-000000000001",
  ANALYTICS_IP_HASH_SALT: "game-save-cas-analytics-secret-0000001"
});

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
    return { success: true, meta: { changes: Number(result.changes || 0) } };
  }
}

class D1Database {
  constructor() {
    this.sqlite = new DatabaseSync(":memory:");
    this.sqlite.exec("pragma foreign_keys = on");
    this.sqlite.exec(`
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
      create table game_saves (
        user_id text not null references users(id) on delete cascade,
        game_id text not null,
        save_data text not null,
        updated_at text not null,
        primary key (user_id, game_id)
      );
    `);
  }

  prepare(sql) {
    return new D1Statement(this.sqlite, sql);
  }

  async batch(statements) {
    const results = [];
    this.sqlite.exec("begin immediate");
    try {
      for (const statement of statements) {
        results.push(await statement.run());
      }
      this.sqlite.exec("commit");
      return results;
    } catch (error) {
      this.sqlite.exec("rollback");
      throw error;
    }
  }

  close() {
    this.sqlite.close();
  }
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function callSave(db, gameId, { method = "GET", body } = {}) {
  const headers = new Headers({ Cookie: `lusu_session=${SESSION_TOKEN}` });
  const init = { method, headers };
  if (body !== undefined) {
    headers.set("Content-Type", "application/json");
    init.body = JSON.stringify(body);
  }
  return onRequest({
    request: new Request(`https://example.test/api/saves/${gameId}`, init),
    env: { DB: db, ...RUNTIME_SECRETS },
    waitUntil() {}
  });
}

function saveRow(db, gameId) {
  return db.sqlite.prepare(
    "select save_data, updated_at from game_saves where user_id = ? and game_id = ?"
  ).get(USER_ID, gameId);
}

test("game save PUT enforces an atomic expectedUpdatedAt contract", async (t) => {
  const db = new D1Database();
  const now = "2026-07-26T00:00:00.000Z";
  const future = "2099-01-01T00:00:00.000Z";
  db.sqlite.prepare(
    "insert into users (id, email, password_hash, role, created_at, updated_at) values (?, ?, '', 'user', ?, ?)"
  ).run(USER_ID, "game-save-cas@example.test", now, now);
  db.sqlite.prepare(
    "insert into sessions (token_hash, user_id, created_at, expires_at) values (?, ?, ?, ?)"
  ).run(await sha256Hex(SESSION_TOKEN), USER_ID, now, future);

  try {
    await t.test("null creates only the first cloud save and GET exposes its version", async () => {
      const emptyResponse = await callSave(db, "first-write");
      assert.equal(emptyResponse.status, 200);
      assert.deepEqual(await emptyResponse.json(), { save: null, updatedAt: null });

      const firstResponse = await callSave(db, "first-write", {
        method: "PUT",
        body: { saveData: { slot: "first" }, expectedUpdatedAt: null }
      });
      assert.equal(firstResponse.status, 200, await firstResponse.clone().text());
      const firstPayload = await firstResponse.json();
      assert.equal(firstPayload.ok, true);
      assert.match(firstPayload.updatedAt, /^\d{4}-\d{2}-\d{2}T/);
      assert.deepEqual(JSON.parse(saveRow(db, "first-write").save_data), { slot: "first" });

      const repeatedResponse = await callSave(db, "first-write", {
        method: "PUT",
        body: { saveData: { slot: "must-not-replace" }, expectedUpdatedAt: null }
      });
      assert.equal(repeatedResponse.status, 409);
      assert.deepEqual(await repeatedResponse.json(), {
        error: CONFLICT_ERROR,
        code: "SAVE_CONFLICT",
        updatedAt: firstPayload.updatedAt
      });
      assert.deepEqual(JSON.parse(saveRow(db, "first-write").save_data), { slot: "first" });
    });

    await t.test("an exact updatedAt match performs one atomic update", async () => {
      const expectedUpdatedAt = "2026-01-01T00:00:00.000Z";
      db.sqlite.prepare(
        "insert into game_saves (user_id, game_id, save_data, updated_at) values (?, ?, ?, ?)"
      ).run(USER_ID, "matching-update", JSON.stringify({ slot: "old" }), expectedUpdatedAt);

      const response = await callSave(db, "matching-update", {
        method: "PUT",
        body: { saveData: { slot: "updated" }, expectedUpdatedAt }
      });
      assert.equal(response.status, 200, await response.clone().text());
      const payload = await response.json();
      assert.equal(payload.ok, true);
      assert.notEqual(payload.updatedAt, expectedUpdatedAt);
      assert.deepEqual(JSON.parse(saveRow(db, "matching-update").save_data), { slot: "updated" });
      assert.equal(saveRow(db, "matching-update").updated_at, payload.updatedAt);
    });

    await t.test("a successful update always advances the version, even beyond the server clock", async () => {
      const expectedUpdatedAt = "2099-01-01T00:00:00.000Z";
      db.sqlite.prepare(
        "insert into game_saves (user_id, game_id, save_data, updated_at) values (?, ?, ?, ?)"
      ).run(USER_ID, "monotonic-version", JSON.stringify({ slot: "old" }), expectedUpdatedAt);

      const response = await callSave(db, "monotonic-version", {
        method: "PUT",
        body: { saveData: { slot: "updated" }, expectedUpdatedAt }
      });
      assert.equal(response.status, 200, await response.clone().text());
      const payload = await response.json();
      assert.ok(
        Date.parse(payload.updatedAt) > Date.parse(expectedUpdatedAt),
        `${payload.updatedAt} should be newer than ${expectedUpdatedAt}`
      );
      assert.equal(saveRow(db, "monotonic-version").updated_at, payload.updatedAt);
    });

    await t.test("a stale version returns SAVE_CONFLICT without changing remote data", async () => {
      const currentUpdatedAt = "2026-06-02T00:00:00.000Z";
      db.sqlite.prepare(
        "insert into game_saves (user_id, game_id, save_data, updated_at) values (?, ?, ?, ?)"
      ).run(USER_ID, "stale-update", JSON.stringify({ slot: "newer-remote" }), currentUpdatedAt);

      const response = await callSave(db, "stale-update", {
        method: "PUT",
        body: {
          saveData: { slot: "stale-client" },
          expectedUpdatedAt: "2026-06-01T00:00:00.000Z"
        }
      });
      assert.equal(response.status, 409);
      assert.deepEqual(await response.json(), {
        error: CONFLICT_ERROR,
        code: "SAVE_CONFLICT",
        updatedAt: currentUpdatedAt
      });
      assert.deepEqual(JSON.parse(saveRow(db, "stale-update").save_data), { slot: "newer-remote" });
      assert.equal(saveRow(db, "stale-update").updated_at, currentUpdatedAt);
    });

    await t.test("a missing expectedUpdatedAt precondition is rejected before writing", async () => {
      const response = await callSave(db, "missing-precondition", {
        method: "PUT",
        body: { saveData: { slot: "must-not-write" } }
      });
      assert.equal(response.status, 400);
      assert.deepEqual(await response.json(), { error: "存档同步前提不正确。" });
      assert.equal(saveRow(db, "missing-precondition"), undefined);
    });

    await t.test("a non-ISO expectedUpdatedAt precondition is rejected before writing", async () => {
      const response = await callSave(db, "invalid-precondition", {
        method: "PUT",
        body: {
          saveData: { slot: "must-not-write" },
          expectedUpdatedAt: "yesterday"
        }
      });
      assert.equal(response.status, 400);
      assert.deepEqual(await response.json(), { error: "存档同步前提不正确。" });
      assert.equal(saveRow(db, "invalid-precondition"), undefined);
    });
  } finally {
    db.close();
  }
});
