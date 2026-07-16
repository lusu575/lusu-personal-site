import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import { onRequest } from "../functions/api/[[route]].js";

const CHAT_SECRET = "test-chat-ip-hash-secret-0000000000000001";
const ROTATED_CHAT_SECRET = "test-chat-ip-hash-secret-rotated-00000000001";
const ANALYTICS_SECRET = "test-analytics-ip-hash-secret-00000001";

function createRecordingD1({ firstResult } = {}) {
  const calls = [];

  function statement(sql) {
    return {
      sql,
      params: [],
      bind(...params) {
        this.params = params;
        calls.push({ sql, params: [...params] });
        return this;
      },
      async run() {
        return { success: true, meta: { changes: 1 } };
      },
      async first() {
        return firstResult ? (await firstResult({ sql, params: [...this.params] })) ?? null : null;
      },
      async all() {
        return { results: [] };
      }
    };
  }

  return {
    calls,
    prepare(sql) {
      assert.equal(typeof sql, "string", "D1 prepare requires a SQL string");
      return statement(sql);
    },
    async batch(statements) {
      for (const item of statements) {
        if (item && typeof item.run === "function") {
          await item.run();
        }
      }
      return [];
    }
  };
}

function expectedChatKeyId(secret) {
  const fingerprint = createHmac("sha256", secret)
    .update("hmac-sha256-v1:key-id", "utf8")
    .digest("hex");
  return `hmac-sha256-v1:${fingerprint.slice(0, 24)}`;
}

function normalizedSql(sql) {
  return String(sql || "").replace(/\s+/g, " ").trim();
}

function insertCalls(db, tableName) {
  const pattern = new RegExp(`^insert\\s+into\\s+${tableName}\\b`, "i");
  return db.calls.filter((call) => pattern.test(normalizedSql(call.sql)));
}

function insertColumn(call, columnName) {
  const match = normalizedSql(call.sql).match(/^insert\s+into\s+[^\s(]+\s*\(([^)]+)\)\s*values\s*\(([^)]+)\)/i);
  assert.ok(match, `expected an INSERT column list for ${columnName}`);
  const columns = match[1].split(",").map((column) => column.trim().toLowerCase());
  const index = columns.indexOf(columnName.toLowerCase());
  assert.notEqual(index, -1, `INSERT must include ${columnName}`);
  const values = match[2].split(",").map((value) => value.trim());
  assert.equal(values[index], "?", `${columnName} must be bound rather than embedded in SQL`);
  const parameterIndex = values.slice(0, index + 1).filter((value) => value === "?").length - 1;
  return call.params[parameterIndex];
}

function expectedHmac(secret, purpose, ip) {
  return createHmac("sha256", secret).update(`${purpose}:${ip}`, "utf8").digest("hex");
}

async function postChat(db, { ip, forwardedIp, suffix, chatSecret = CHAT_SECRET }) {
  const response = await onRequest({
    request: new Request("https://example.test/api/chat/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "CF-Connecting-IP": ip,
        "x-forwarded-for": `${forwardedIp}, 198.51.100.250`
      },
      body: JSON.stringify({
        visitorId: `client-${suffix}`,
        nickname: `测试${suffix}`,
        content: `IP hash behavior ${suffix}`
      })
    }),
    env: {
      DB: db,
      CHAT_IP_HASH_SALT: chatSecret,
      ANALYTICS_IP_HASH_SALT: ANALYTICS_SECRET
    },
    waitUntil() {}
  });

  assert.equal(response.status, 201, await response.text());
}

test("IP hashes use the trusted CF address, purpose-specific secrets, and stable HMAC-SHA256", async () => {
  const db = createRecordingD1();
  const firstIp = "203.0.113.10";
  const secondIp = "203.0.113.11";
  const spoofedForwardedIp = "192.0.2.99";

  await postChat(db, { ip: firstIp, forwardedIp: spoofedForwardedIp, suffix: "aa" });
  await postChat(db, { ip: firstIp, forwardedIp: "192.0.2.100", suffix: "bb" });
  await postChat(db, { ip: secondIp, forwardedIp: spoofedForwardedIp, suffix: "cc" });
  await postChat(db, {
    ip: firstIp,
    forwardedIp: spoofedForwardedIp,
    suffix: "dd",
    chatSecret: ROTATED_CHAT_SECRET
  });

  const chatCalls = insertCalls(db, "anonymous_chat_messages");
  const analyticsCalls = insertCalls(db, "site_visitors");
  assert.equal(chatCalls.length, 4, "each chat request should persist one chat message");
  assert.equal(analyticsCalls.length, 4, "each chat request should update one visitor profile");

  const chatHashes = chatCalls.map((call) => insertColumn(call, "ip_hash"));
  const chatKeyIds = chatCalls.map((call) => insertColumn(call, "ip_hash_key_id"));
  const analyticsHashes = analyticsCalls.map((call) => insertColumn(call, "ip_hash"));
  const expectedFirstChatHash = expectedHmac(CHAT_SECRET, "chat", firstIp);
  const expectedFirstAnalyticsHash = expectedHmac(ANALYTICS_SECRET, "analytics", firstIp);

  assert.equal(chatHashes[0], expectedFirstChatHash, "chat must use CHAT_IP_HASH_SALT and CF-Connecting-IP");
  assert.equal(analyticsHashes[0], expectedFirstAnalyticsHash, "analytics must use ANALYTICS_IP_HASH_SALT and CF-Connecting-IP");
  assert.notEqual(
    chatHashes[0],
    expectedHmac(CHAT_SECRET, "chat", spoofedForwardedIp),
    "x-forwarded-for must not override CF-Connecting-IP"
  );

  assert.equal(chatHashes[1], chatHashes[0], "same chat input must produce a stable hash");
  assert.equal(analyticsHashes[1], analyticsHashes[0], "same analytics input must produce a stable hash");
  assert.notEqual(chatHashes[0], analyticsHashes[0], "chat and analytics must remain purpose-separated");
  assert.notEqual(chatHashes[2], chatHashes[0], "different IPs must produce different chat hashes");
  assert.notEqual(analyticsHashes[2], analyticsHashes[0], "different IPs must produce different analytics hashes");
  assert.equal(chatHashes[3], expectedHmac(ROTATED_CHAT_SECRET, "chat", firstIp));
  assert.notEqual(chatHashes[3], chatHashes[0], "rotating the chat Secret must change the chat hash");
  assert.equal(chatKeyIds[1], chatKeyIds[0], "one chat Secret must keep a stable non-sensitive generation id");
  assert.equal(chatKeyIds[2], chatKeyIds[0], "the generation id must not depend on the request IP");
  assert.notEqual(chatKeyIds[3], chatKeyIds[0], "rotating the chat Secret must change its generation id");
  for (const keyId of chatKeyIds) {
    assert.match(keyId, /^hmac-sha256-v1:[a-f0-9]{24}$/, "chat generation ids must be versioned and non-secret");
  }

  for (const hash of [...chatHashes, ...analyticsHashes]) {
    assert.match(hash, /^[a-f0-9]{64}$/, "IP hashes must stay 64-character lowercase hex");
  }
});

test("admin IP bans reject legacy message hashes and persist only the current generation", async () => {
  const currentKeyId = expectedChatKeyId(CHAT_SECRET);
  const ipHash = expectedHmac(CHAT_SECRET, "chat", "203.0.113.20");
  const db = createRecordingD1({
    firstResult({ sql, params }) {
      const normalized = normalizedSql(sql);
      if (/from sessions join users/i.test(normalized)) {
        return {
          token_hash: "mock-token-hash",
          id: "admin-user",
          email: "admin@example.test",
          role: "admin"
        };
      }
      if (/select ip_hash, ip_hash_key_id, ip_prefix from anonymous_chat_messages/i.test(normalized)) {
        return {
          ip_hash: ipHash,
          ip_hash_key_id: params[0] === "current-message-1" ? currentKeyId : "legacy",
          ip_prefix: "203.0.113.0/24"
        };
      }
      return null;
    }
  });

  async function createBan(messageId) {
    return onRequest({
      request: new Request("https://example.test/api/admin/chat/bans", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: "lusu_session=test-session-token"
        },
        body: JSON.stringify({ type: "ip_hash", messageId, reason: "test" })
      }),
      env: {
        DB: db,
        CHAT_IP_HASH_SALT: CHAT_SECRET,
        ANALYTICS_IP_HASH_SALT: ANALYTICS_SECRET
      },
      waitUntil() {}
    });
  }

  const legacyResponse = await createBan("legacy-message-1");
  assert.equal(legacyResponse.status, 409);
  assert.match((await legacyResponse.json()).error, /旧代次网络指纹/);
  assert.equal(insertCalls(db, "chat_bans").length, 0, "legacy hashes must never create a ban row");

  const currentResponse = await createBan("current-message-1");
  assert.equal(currentResponse.status, 200, await currentResponse.text());
  const banCalls = insertCalls(db, "chat_bans");
  assert.equal(banCalls.length, 1);
  assert.equal(insertColumn(banCalls[0], "ip_hash"), ipHash);
  assert.equal(insertColumn(banCalls[0], "ip_hash_key_id"), currentKeyId);
});
