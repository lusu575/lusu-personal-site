import assert from "node:assert/strict";
import test from "node:test";

import { onRequest } from "../functions/api/[[route]].js";

const VALID_CHAT_SECRET = "test-chat-ip-hash-secret-0000000000000001";
const VALID_ANALYTICS_SECRET = "test-analytics-ip-hash-secret-00000001";

async function requestWithConfig(overrides = {}) {
  let dbTouched = false;
  const DB = new Proxy({}, {
    get() {
      dbTouched = true;
      throw new Error("D1 must not be touched when runtime secrets are invalid.");
    }
  });
  const logs = [];
  const originalConsoleError = console.error;
  console.error = (...args) => logs.push(args);
  try {
    const response = await onRequest({
      request: new Request("https://example.test/api/health"),
      env: {
        DB,
        CHAT_IP_HASH_SALT: VALID_CHAT_SECRET,
        ANALYTICS_IP_HASH_SALT: VALID_ANALYTICS_SECRET,
        ...overrides
      }
    });
    return { response, dbTouched, logs };
  } finally {
    console.error = originalConsoleError;
  }
}

test("missing runtime secrets fail before any D1 access", async () => {
  const { response, dbTouched, logs } = await requestWithConfig({ ANALYTICS_IP_HASH_SALT: "" });

  assert.equal(response.status, 503);
  assert.equal(dbTouched, false);
  assert.deepEqual(await response.json(), {
    error: "Service privacy configuration is unavailable."
  });
  const serializedLogs = JSON.stringify(logs);
  assert.match(serializedLogs, /ANALYTICS_IP_HASH_SALT/);
  assert.doesNotMatch(serializedLogs, new RegExp(VALID_CHAT_SECRET));
  assert.doesNotMatch(serializedLogs, /CF-Connecting-IP|unknown/);
});

test("short runtime secrets are rejected without logging their values", async () => {
  const shortSecret = "short-secret-value";
  const { response, dbTouched, logs } = await requestWithConfig({ CHAT_IP_HASH_SALT: shortSecret });

  assert.equal(response.status, 503);
  assert.equal(dbTouched, false);
  const serializedLogs = JSON.stringify(logs);
  assert.match(serializedLogs, /CHAT_IP_HASH_SALT/);
  assert.doesNotMatch(serializedLogs, new RegExp(shortSecret));
});

test("identical chat and analytics secrets fail before D1 access without leaking the shared value", async () => {
  const sharedSecret = "test-shared-ip-hash-secret-000000000000001";
  const { response, dbTouched, logs } = await requestWithConfig({
    CHAT_IP_HASH_SALT: sharedSecret,
    ANALYTICS_IP_HASH_SALT: sharedSecret
  });

  assert.equal(response.status, 503);
  assert.equal(dbTouched, false);
  assert.deepEqual(await response.json(), {
    error: "Service privacy configuration is unavailable."
  });
  const serializedLogs = JSON.stringify(logs);
  assert.match(serializedLogs, /CHAT_IP_HASH_SALT/);
  assert.match(serializedLogs, /ANALYTICS_IP_HASH_SALT/);
  assert.doesNotMatch(serializedLogs, new RegExp(sharedSecret));
});
