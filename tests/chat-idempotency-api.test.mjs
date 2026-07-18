import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { onRequest } from "../functions/api/[[route]].js";

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
    this.sqlite.exec(readFileSync(new URL("../cloudflare/schema.sql", import.meta.url), "utf8"));
    this.sqlite.exec(readFileSync(new URL("../cloudflare/schema-indexes.sql", import.meta.url), "utf8"));
  }

  prepare(sql) {
    return new D1Statement(this.sqlite, sql);
  }

  async batch(statements) {
    const results = [];
    this.sqlite.exec("begin immediate");
    try {
      for (const statement of statements) results.push(await statement.run());
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

const envSecrets = Object.freeze({
  CHAT_IP_HASH_SALT: "chat-idempotency-test-secret-000000000001",
  ANALYTICS_IP_HASH_SALT: "analytics-idempotency-test-secret-000001"
});

async function postMessage(db, body) {
  return onRequest({
    request: new Request("https://example.test/api/chat/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "CF-Connecting-IP": "203.0.113.44",
        Cookie: "lusu_visitor=vis_idempotencyvisitor01"
      },
      body: JSON.stringify({ visitorId: "client-idempotency", nickname: "RetryGuest", ...body })
    }),
    env: { DB: db, ...envSecrets },
    waitUntil() {}
  });
}

test("Chat replays one committed public/private message for a stable client request id", async () => {
  const db = new D1Database();
  try {
    const publicRequestId = "chat_public_retry_00000001";
    const firstPublic = await postMessage(db, {
      clientRequestId: publicRequestId,
      content: "committed before response loss"
    });
    assert.equal(firstPublic.status, 201);
    const firstPublicPayload = await firstPublic.json();

    const replayedPublic = await postMessage(db, {
      clientRequestId: publicRequestId,
      content: "committed before response loss"
    });
    assert.equal(replayedPublic.status, 200);
    const replayedPublicPayload = await replayedPublic.json();
    assert.equal(replayedPublicPayload.idempotentReplay, true);
    assert.equal(replayedPublicPayload.message.message_id, firstPublicPayload.message.message_id);

    const room = `room_${"a".repeat(32)}`;
    const privateRequestId = "chat_private_retry_0000001";
    const firstCiphertext = "abcdefgh.ABCDEFGHIJKLMNOP";
    const secondCiphertext = "ijklmnop.QRSTUVWXYZabcdef";
    const firstPrivate = await postMessage(db, {
      room,
      clientRequestId: privateRequestId,
      encryptedContent: firstCiphertext
    });
    assert.equal(firstPrivate.status, 201);
    const firstPrivatePayload = await firstPrivate.json();

    const replayedPrivate = await postMessage(db, {
      room,
      clientRequestId: privateRequestId,
      encryptedContent: secondCiphertext
    });
    assert.equal(replayedPrivate.status, 200);
    const replayedPrivatePayload = await replayedPrivate.json();
    assert.equal(replayedPrivatePayload.idempotentReplay, true);
    assert.equal(replayedPrivatePayload.message.message_id, firstPrivatePayload.message.message_id);
    assert.equal(replayedPrivatePayload.message.content, firstCiphertext, "random-IV retry must replay stored ciphertext");

    assert.equal(
      db.sqlite.prepare("select count(*) as count from anonymous_chat_messages where client_request_id <> ''").get().count,
      2
    );
  } finally {
    db.close();
  }
});
