import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { onRequest } from "../functions/api/[[route]].js";

const source = await readFile(new URL("../functions/api/[[route]].js", import.meta.url), "utf8");
const RUNTIME_SECRETS = Object.freeze({
  CHAT_IP_HASH_SALT: "test-chat-ip-hash-secret-0000000000000001",
  ANALYTICS_IP_HASH_SALT: "test-analytics-ip-hash-secret-00000001"
});

function createRegistrationD1() {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      const statement = {
        sql,
        params: [],
        bind(...params) {
          this.params = params;
          return this;
        },
        async first() {
          calls.push({ method: "first", sql, params: [...this.params] });
          return null;
        },
        async all() {
          calls.push({ method: "all", sql, params: [...this.params] });
          if (/^pragma table_info\(users\)$/i.test(String(sql).trim())) {
            return { results: [{ name: "role" }] };
          }
          return { results: [] };
        },
        async run() {
          calls.push({ method: "run", sql, params: [...this.params] });
          return { success: true, meta: { changes: 1 } };
        }
      };
      return statement;
    },
    async batch(statements) {
      calls.push({ method: "batch", count: statements.length });
      return [];
    }
  };
}

test("configured owner emails are protection metadata and never an automatic grant", () => {
  assert.match(source, /if \(existing \|\| ownerAdminEmails\(env\)\.has\(email\)\)/);
  assert.doesNotMatch(source, /ensureOwnerAdminRole/);
  assert.doesNotMatch(source, /update users set role = 'admin'[^;]*where email = \?/i);
});

test("public registration cannot claim a configured owner email", async () => {
  const db = createRegistrationD1();
  const response = await onRequest({
    request: new Request("https://lusu575.com/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "OWNER@example.test", password: "ValidPass123!" })
    }),
    env: {
      DB: db,
      ...RUNTIME_SECRETS,
      OWNER_ADMIN_EMAILS: "owner@example.test"
    },
    waitUntil() {}
  });

  assert.equal(response.status, 409);
  assert.match((await response.json()).error, /已经注册/);
  assert.equal(db.calls.some((call) => /insert into users/i.test(call.sql || "")), false);
});

test("Cloudflare preview API fails closed before touching shared bindings", async () => {
  for (const scenario of [
    {
      url: "https://feature.lusu-personal-site.pages.dev/api/health",
      env: {}
    },
    {
      url: "https://preview.example.test/api/health",
      env: { PREVIEW_API_DISABLED: "true" }
    }
  ]) {
    let dbTouched = false;
    const response = await onRequest({
      request: new Request(scenario.url),
      env: {
        DB: {
          prepare() {
            dbTouched = true;
            throw new Error("preview must not touch D1");
          }
        },
        ...scenario.env
      },
      waitUntil() {}
    });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, "PREVIEW_API_DISABLED");
    assert.equal(dbTouched, false);
  }
});
