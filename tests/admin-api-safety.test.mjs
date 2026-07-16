import assert from "node:assert/strict";
import test from "node:test";

import { onRequest } from "../functions/api/[[route]].js";

const RUNTIME_SECRETS = Object.freeze({
  CHAT_IP_HASH_SALT: "test-chat-ip-hash-secret-0000000000000001",
  ANALYTICS_IP_HASH_SALT: "test-analytics-ip-hash-secret-00000001"
});
const SESSION_TOKEN = "admin-api-safety-session";
const ADMIN_USER = Object.freeze({
  id: "operator-admin",
  email: "operator@example.test",
  role: "admin"
});

function normalizedSql(sql) {
  return String(sql || "").replace(/\s+/g, " ").trim();
}

function createAdminD1({ targetAccount, otherAdminExists = true } = {}) {
  const calls = [];
  const account = targetAccount
    ? {
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        ...targetAccount
      }
    : null;

  function statement(sql) {
    return {
      sql,
      params: [],
      bind(...params) {
        this.params = params;
        return this;
      },
      async run() {
        const call = { method: "run", sql, params: [...this.params] };
        calls.push(call);
        const normalized = normalizedSql(sql);

        if (/^update users set .+where id = \? and \(/i.test(normalized)) {
          const nextRole = this.params.at(-1);
          const demotesLastAdmin = account?.role === "admin"
            && nextRole !== "admin"
            && !otherAdminExists;
          if (demotesLastAdmin) {
            return { success: true, meta: { changes: 0 } };
          }
          if (account) {
            account.email = this.params[0];
            account.role = this.params[1];
            account.updated_at = "2026-07-16T00:00:00.000Z";
          }
          return { success: true, meta: { changes: account ? 1 : 0 } };
        }

        return { success: true, meta: { changes: 1 } };
      },
      async first() {
        calls.push({ method: "first", sql, params: [...this.params] });
        const normalized = normalizedSql(sql);

        if (/from sessions join users/i.test(normalized)) {
          return {
            token_hash: "mock-session-token-hash",
            id: ADMIN_USER.id,
            email: ADMIN_USER.email,
            role: ADMIN_USER.role
          };
        }
        if (/^select id, email, role from users where id = \?$/i.test(normalized)) {
          return account && account.id === this.params[0]
            ? { id: account.id, email: account.email, role: account.role }
            : null;
        }
        if (/^select id from users where email = \? and id <> \?$/i.test(normalized)) {
          return null;
        }
        if (/^select id, role from users where id = \?$/i.test(normalized)) {
          return account && account.id === this.params[0]
            ? { id: account.id, role: account.role }
            : null;
        }
        if (/from users where id = \?$/i.test(normalized)) {
          return account && account.id === this.params[0]
            ? {
                ...account,
                password_scheme: "pbkdf2"
              }
            : null;
        }
        return null;
      },
      async all() {
        calls.push({ method: "all", sql, params: [...this.params] });
        if (/^pragma table_info\(users\)$/i.test(normalizedSql(sql))) {
          return { results: [{ name: "role" }] };
        }
        return { results: [] };
      }
    };
  }

  return {
    calls,
    account,
    prepare(sql) {
      assert.equal(typeof sql, "string", "D1 prepare requires a SQL string");
      return statement(sql);
    },
    async batch() {
      return [];
    }
  };
}

function adminRequest(path, body) {
  return new Request(`https://example.test/api/admin/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `lusu_session=${SESSION_TOKEN}`
    },
    body: JSON.stringify(body)
  });
}

function accountRequest(userId, body) {
  return new Request(`https://example.test/api/admin/accounts/${userId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Cookie: `lusu_session=${SESSION_TOKEN}`
    },
    body: JSON.stringify(body)
  });
}

async function api(request, db) {
  return onRequest({
    request,
    env: { DB: db, ...RUNTIME_SECRETS },
    waitUntil() {}
  });
}

function completeArticlePayload() {
  return {
    slug: "admin-api-safety-regression",
    category: "note",
    tags: ["regression"],
    status: "draft",
    translations: {
      zh: { title: "中文标题", summary: "", content_markdown: "# 中文正文" },
      en: { title: "English title", summary: "", content_markdown: "# English body" },
      ja: { title: "日本語タイトル", summary: "", content_markdown: "# 日本語本文" }
    }
  };
}

function accountFixture(overrides = {}) {
  return {
    id: "target-account",
    email: "target@example.test",
    role: "user",
    ...overrides
  };
}

test("admin article creation requires non-empty zh, en, and ja bodies on the server", async () => {
  const db = createAdminD1();

  for (const lang of ["zh", "en", "ja"]) {
    const payload = completeArticlePayload();
    payload.translations[lang].content_markdown = "   ";
    const response = await api(adminRequest("articles", payload), db);
    const result = await response.json();

    assert.equal(response.status, 400, `${lang} empty body must be rejected`);
    assert.equal(result.error, `${lang} 正文不能为空。`);
  }

  const missingLanguagePayload = completeArticlePayload();
  delete missingLanguagePayload.translations.ja;
  const missingLanguageResponse = await api(adminRequest("articles", missingLanguagePayload), db);
  assert.equal(missingLanguageResponse.status, 400);
  assert.match((await missingLanguageResponse.json()).error, /zh \/ en \/ ja/);
});

test("password updates honor revokeSessions false, true, and the secure default", async () => {
  const cases = [
    { label: "explicit false", revokeSessions: false, expectedDeletes: 0 },
    { label: "explicit true", revokeSessions: true, expectedDeletes: 1 },
    { label: "omitted defaults to true", expectedDeletes: 1 }
  ];

  for (const scenario of cases) {
    const db = createAdminD1({ targetAccount: accountFixture() });
    const body = {
      email: db.account.email,
      role: db.account.role,
      password: "ValidPass123!"
    };
    if ("revokeSessions" in scenario) {
      body.revokeSessions = scenario.revokeSessions;
    }

    const response = await api(accountRequest(db.account.id, body), db);
    assert.equal(response.status, 200, `${scenario.label}: ${await response.clone().text()}`);

    const sessionDeletes = db.calls.filter((call) => (
      call.method === "run"
      && /^delete from sessions where user_id = \?$/i.test(normalizedSql(call.sql))
    ));
    assert.equal(sessionDeletes.length, scenario.expectedDeletes, scenario.label);
    if (sessionDeletes.length) {
      assert.deepEqual(sessionDeletes[0].params, [db.account.id]);
    }
  }
});

test("account demotion atomically rejects the last admin and allows it when another admin exists", async () => {
  const lastAdminDb = createAdminD1({
    targetAccount: accountFixture({ role: "admin" }),
    otherAdminExists: false
  });
  const rejected = await api(accountRequest(lastAdminDb.account.id, {
    email: lastAdminDb.account.email,
    role: "user"
  }), lastAdminDb);
  assert.equal(rejected.status, 409);
  assert.match((await rejected.json()).error, /最后一个管理员/);

  const guardedUpdate = lastAdminDb.calls.find((call) => (
    call.method === "run"
    && /^update users set .+where id = \? and \(/i.test(normalizedSql(call.sql))
  ));
  assert.ok(guardedUpdate, "the role update must use one guarded UPDATE statement");
  assert.match(normalizedSql(guardedUpdate.sql), /or exists \( select 1 from users as other_admin/i);
  assert.match(normalizedSql(guardedUpdate.sql), /other_admin\.id <> users\.id/i);
  assert.equal(guardedUpdate.params.at(-1), "user", "the requested role must participate in the atomic guard");

  const multiAdminDb = createAdminD1({
    targetAccount: accountFixture({ role: "admin" }),
    otherAdminExists: true
  });
  const allowed = await api(accountRequest(multiAdminDb.account.id, {
    email: multiAdminDb.account.email,
    role: "user"
  }), multiAdminDb);
  assert.equal(allowed.status, 200, await allowed.clone().text());
  assert.equal(multiAdminDb.account.role, "user");
});
