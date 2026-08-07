import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
  AGENT_SCOPE_DEFINITIONS,
  authenticateAgentBearer,
  handleAgentAuthApi
} from "../functions/api/agent-auth.mjs";

class D1StatementMock {
  constructor(database, sql, values = []) {
    this.database = database;
    this.sql = sql;
    this.values = values;
  }

  bind(...values) {
    return new D1StatementMock(this.database, this.sql, values);
  }

  async first() {
    return this.database.prepare(this.sql).get(...this.values) || null;
  }

  async all() {
    return { results: this.database.prepare(this.sql).all(...this.values) };
  }

  async run() {
    const result = this.database.prepare(this.sql).run(...this.values);
    return { meta: { changes: Number(result.changes || 0), last_row_id: result.lastInsertRowid } };
  }
}

class D1Mock {
  constructor() {
    this.sqlite = new DatabaseSync(":memory:");
    this.sqlite.exec("pragma foreign_keys = on");
  }

  prepare(sql) {
    return new D1StatementMock(this.sqlite, sql);
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
}

const origin = "https://example.test";
const sessionToken = "browser-session-token";

function createFixture() {
  const db = new D1Mock();
  db.sqlite.exec(`
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
    create table agent_device_authorizations (
      device_id text primary key,
      device_code_hash text not null unique,
      user_code_hash text not null unique,
      client_name text not null,
      requested_scopes text not null default '[]',
      granted_scopes text not null default '[]',
      user_id text references users(id) on delete cascade,
      status text not null default 'pending',
      csrf_hash text not null default '',
      ip_hash text not null default '',
      created_at text not null,
      expires_at text not null,
      approved_at text not null default '',
      consumed_at text not null default '',
      poll_count integer not null default 0,
      last_polled_at text not null default '',
      decision_event_id text not null default ''
    );
    create table agent_access_tokens (
      token_id text primary key,
      token_hash text not null unique,
      token_hint text not null default '',
      user_id text not null references users(id) on delete cascade,
      client_name text not null,
      scopes text not null default '[]',
      created_at text not null,
      expires_at text not null,
      last_used_at text not null default '',
      revoked_at text not null default '',
      revoked_event_id text not null default ''
    );
    create table agent_audit_log (
      event_id text primary key,
      actor_user_id text not null default '',
      token_id text not null default '',
      action text not null,
      target_type text not null default '',
      target_id text not null default '',
      scopes text not null default '[]',
      result text not null default '',
      created_at text not null
    );
    create table api_rate_limits (
      bucket_key text primary key,
      window_started_at integer not null,
      request_count integer not null default 0,
      blocked_until integer not null default 0,
      updated_at text not null
    );
  `);
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  db.sqlite.prepare("insert into users values (?, ?, '', ?, ?, ?)")
    .run("user-1", "user@example.test", "user", createdAt, createdAt);
  return sha256Hex(sessionToken).then((sessionHash) => {
    db.sqlite.prepare("insert into sessions values (?, ?, ?, ?)")
      .run(sessionHash, "user-1", createdAt, expiresAt);
    return {
      db,
      env: {
        DB: db,
        ANALYTICS_IP_HASH_SALT: "agent-auth-test-salt-that-is-longer-than-thirty-two-bytes"
      }
    };
  });
}

async function call(env, path, {
  method = "GET",
  body,
  headers = {},
  browserSession = false
} = {}) {
  const requestHeaders = new Headers(headers);
  if (browserSession) {
    const existingCookie = requestHeaders.get("Cookie");
    requestHeaders.set(
      "Cookie",
      existingCookie
        ? `${existingCookie}; lusu_session=${sessionToken}`
        : `lusu_session=${sessionToken}`
    );
  }
  const requestUrl = new URL(`/api/agent-auth/${path}`, origin);
  const request = new Request(requestUrl, {
    method,
    headers: requestHeaders,
    body
  });
  return handleAgentAuthApi(
    { request, env },
    requestUrl.pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean)
  );
}

function jsonRequest(value) {
  return {
    body: JSON.stringify(value),
    headers: { "Content-Type": "application/json" }
  };
}

function cookieValue(setCookie, name) {
  const match = String(setCookie || "").match(new RegExp(`(?:^|,\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : "";
}

async function startAndApproveDevice(env, {
  ip = "203.0.113.60",
  clientName = "Approved test device",
  scopes = ["content:read"]
} = {}) {
  const started = await call(env, "device/start", {
    method: "POST",
    ...jsonRequest({ clientName, scopes }),
    headers: { "CF-Connecting-IP": ip, "Content-Type": "application/json" }
  });
  assert.equal(started.status, 201);
  const device = await started.json();
  const consent = await call(env, `device/authorize?user_code=${device.userCode}`, {
    browserSession: true,
    headers: { "CF-Connecting-IP": ip }
  });
  assert.equal(consent.status, 200);
  const csrf = cookieValue(consent.headers.get("Set-Cookie"), "__Host-lusu_agent_csrf");
  const approved = await call(env, "device/authorize", {
    method: "POST",
    body: new URLSearchParams({
      user_code: device.userCode,
      csrf_token: csrf,
      decision: "approve"
    }).toString(),
    browserSession: true,
    headers: {
      "CF-Connecting-IP": ip,
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: origin,
      Cookie: `__Host-lusu_agent_csrf=${encodeURIComponent(csrf)}`
    }
  });
  assert.equal(approved.status, 200);
  return device;
}

test("governed tool scopes are supported but never granted by default", async () => {
  const { env } = await createFixture();
  assert.equal(AGENT_SCOPE_DEFINITIONS["content:write"].readOnly, false);
  assert.equal(AGENT_SCOPE_DEFINITIONS["content:write"].adminOnly, true);
  assert.equal(AGENT_SCOPE_DEFINITIONS["content:delete"].readOnly, false);
  assert.equal(AGENT_SCOPE_DEFINITIONS["content:delete"].adminOnly, true);
  assert.equal(AGENT_SCOPE_DEFINITIONS["whiteboard:read"].readOnly, true);
  assert.equal(AGENT_SCOPE_DEFINITIONS["whiteboard:write"].readOnly, false);
  assert.equal(AGENT_SCOPE_DEFINITIONS["whiteboard:assets"].readOnly, false);
  assert.equal(AGENT_SCOPE_DEFINITIONS["japanese-subtext:progress:read"].readOnly, true);
  assert.equal(AGENT_SCOPE_DEFINITIONS["japanese-subtext:progress:write"].readOnly, false);

  const defaults = await call(env, "device/start", {
    method: "POST",
    ...jsonRequest({ clientName: "Default scope test" }),
    headers: {
      "CF-Connecting-IP": "203.0.113.201",
      "Content-Type": "application/json"
    }
  });
  assert.equal(defaults.status, 201);
  assert.deepEqual((await defaults.json()).scopes, [
    "content:read",
    "transfer:read",
    "transfer:write"
  ]);

  const explicit = await call(env, "device/start", {
    method: "POST",
    ...jsonRequest({
      clientName: "Whiteboard scope test",
      scopes: ["whiteboard:write", "whiteboard:assets", "whiteboard:read"]
    }),
    headers: {
      "CF-Connecting-IP": "203.0.113.202",
      "Content-Type": "application/json"
    }
  });
  assert.equal(explicit.status, 201);
  assert.deepEqual((await explicit.json()).scopes, [
    "whiteboard:assets",
    "whiteboard:read",
    "whiteboard:write"
  ]);

  const japaneseSubtext = await call(env, "device/start", {
    method: "POST",
    ...jsonRequest({
      clientName: "Japanese Subtext scope test",
      scopes: ["japanese-subtext:progress:write", "japanese-subtext:progress:read"]
    }),
    headers: {
      "CF-Connecting-IP": "203.0.113.203",
      "Content-Type": "application/json"
    }
  });
  assert.equal(japaneseSubtext.status, 201);
  assert.deepEqual((await japaneseSubtext.json()).scopes, [
    "japanese-subtext:progress:read",
    "japanese-subtext:progress:write"
  ]);

  const contentMutation = await call(env, "device/start", {
    method: "POST",
    ...jsonRequest({
      clientName: "Knowledge management scope test",
      scopes: ["content:delete", "content:write", "content:read"]
    }),
    headers: {
      "CF-Connecting-IP": "203.0.113.204",
      "Content-Type": "application/json"
    }
  });
  assert.equal(contentMutation.status, 201);
  assert.deepEqual((await contentMutation.json()).scopes, [
    "content:delete",
    "content:read",
    "content:write"
  ]);
});

test("content mutation scopes can only be approved by the current site administrator", async () => {
  const { db, env } = await createFixture();
  const started = await call(env, "device/start", {
    method: "POST",
    ...jsonRequest({ clientName: "Knowledge publisher", scopes: ["content:write", "content:delete"] }),
    headers: { "CF-Connecting-IP": "203.0.113.205", "Content-Type": "application/json" }
  });
  assert.equal(started.status, 201);
  const device = await started.json();

  const blocked = await call(env, `device/authorize?user_code=${device.userCode}`, {
    browserSession: true,
    headers: { "CF-Connecting-IP": "203.0.113.205" }
  });
  assert.equal(blocked.status, 403);

  db.sqlite.prepare("update users set role = 'admin' where id = 'user-1'").run();
  const consent = await call(env, `device/authorize?user_code=${device.userCode}`, {
    browserSession: true,
    headers: { "CF-Connecting-IP": "203.0.113.205" }
  });
  assert.equal(consent.status, 200);
  const csrf = cookieValue(consent.headers.get("Set-Cookie"), "__Host-lusu_agent_csrf");
  const approved = await call(env, "device/authorize", {
    method: "POST",
    body: new URLSearchParams({
      user_code: device.userCode,
      csrf_token: csrf,
      decision: "approve"
    }).toString(),
    browserSession: true,
    headers: {
      "CF-Connecting-IP": "203.0.113.205",
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: origin,
      Cookie: `__Host-lusu_agent_csrf=${encodeURIComponent(csrf)}`
    }
  });
  assert.equal(approved.status, 200);
});

test("device authorization issues one hashed, scoped and revocable agent token", async () => {
  const { db, env } = await createFixture();
  const started = await call(env, "device/start", {
    method: "POST",
    ...jsonRequest({ clientName: "Codex local", scopes: ["content:read", "transfer:read"] }),
    headers: { "CF-Connecting-IP": "203.0.113.10", "Content-Type": "application/json" }
  });
  assert.equal(started.status, 201);
  assert.equal(started.headers.get("Cache-Control"), "no-store");
  const device = await started.json();
  assert.match(device.deviceCode, /^[A-Za-z0-9_-]{40,}$/);
  assert.match(device.userCode, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  assert.deepEqual(device.scopes, ["content:read", "transfer:read"]);

  const storedDevice = db.sqlite.prepare("select * from agent_device_authorizations").get();
  assert.notEqual(storedDevice.device_code_hash, device.deviceCode);
  assert.notEqual(storedDevice.user_code_hash, device.userCode.replace("-", ""));

  const pending = await call(env, "device/token", {
    method: "POST",
    ...jsonRequest({ deviceCode: device.deviceCode })
  });
  assert.equal(pending.status, 428);
  assert.equal(pending.headers.get("Retry-After"), "5");
  assert.equal((await pending.json()).code, "AUTHORIZATION_PENDING");

  const tooFast = await call(env, "device/token", {
    method: "POST",
    ...jsonRequest({ deviceCode: device.deviceCode })
  });
  assert.equal(tooFast.status, 429);
  assert.equal(tooFast.headers.get("Retry-After"), "10");
  assert.equal((await tooFast.json()).code, "SLOW_DOWN");

  const signInRequired = await call(env, `device/authorize?user_code=${device.userCode}`);
  assert.equal(signInRequired.status, 401);
  assert.doesNotMatch(await signInRequired.text(), /Codex local/);

  const consent = await call(env, `device/authorize?user_code=${device.userCode}`, {
    browserSession: true
  });
  assert.equal(consent.status, 200);
  assert.match(consent.headers.get("Content-Security-Policy"), /form-action 'self'/);
  const csrfCookie = cookieValue(consent.headers.get("Set-Cookie"), "__Host-lusu_agent_csrf");
  assert.match(csrfCookie, /^[A-Za-z0-9_-]{30,}$/);
  const consentHtml = await consent.text();
  assert.match(consentHtml, /Codex local/);
  assert.match(consentHtml, new RegExp(device.userCode));

  const form = new URLSearchParams({
    user_code: device.userCode,
    csrf_token: csrfCookie,
    decision: "approve"
  });
  const approved = await call(env, "device/authorize", {
    method: "POST",
    body: form.toString(),
    browserSession: true,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: origin,
      Cookie: `__Host-lusu_agent_csrf=${encodeURIComponent(csrfCookie)}`
    }
  });
  assert.equal(approved.status, 200);

  const exchanged = await call(env, "device/token", {
    method: "POST",
    ...jsonRequest({ deviceCode: device.deviceCode })
  });
  assert.equal(exchanged.status, 201);
  const credentials = await exchanged.json();
  assert.match(credentials.accessToken, /^lusu_agent_[A-Za-z0-9_-]{40,}$/);
  assert.deepEqual(credentials.scopes, ["content:read", "transfer:read"]);
  const storedToken = db.sqlite.prepare("select * from agent_access_tokens").get();
  assert.notEqual(storedToken.token_hash, credentials.accessToken);
  assert.equal(storedToken.token_hint, credentials.accessToken.slice(-6));

  const replay = await call(env, "device/token", {
    method: "POST",
    ...jsonRequest({ deviceCode: device.deviceCode })
  });
  assert.equal(replay.status, 409);
  assert.equal((await replay.json()).code, "AGENT_DEVICE_CONSUMED");

  const bearerRequest = new Request(`${origin}/api/agent-auth/me`, {
    headers: { Authorization: `Bearer ${credentials.accessToken}` }
  });
  const principal = await authenticateAgentBearer(bearerRequest, env, ["content:read"]);
  assert.equal(principal.user.id, "user-1");
  assert.equal(principal.authType, "agent-token");
  await assert.rejects(
    authenticateAgentBearer(bearerRequest, env, ["transfer:delete"]),
    (error) => error?.status === 403 && error?.code === "AGENT_SCOPE_REQUIRED"
  );

  const management = await call(env, "tokens/manage", {
    browserSession: true
  });
  assert.equal(management.status, 200);
  const managementCsrf = cookieValue(
    management.headers.get("Set-Cookie"),
    "__Host-lusu_agent_manage_csrf"
  );
  const managementHtml = await management.text();
  assert.match(managementHtml, /Codex local/);
  assert.match(managementHtml, new RegExp(credentials.accessToken.slice(-6)));
  assert.doesNotMatch(managementHtml, new RegExp(credentials.accessToken));

  const revokeForm = new URLSearchParams({
    csrf_token: managementCsrf,
    action: "revoke",
    token_id: storedToken.token_id
  });
  const ownerRevoked = await call(env, "tokens/manage", {
    method: "POST",
    body: revokeForm.toString(),
    browserSession: true,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: origin,
      Cookie: `__Host-lusu_agent_manage_csrf=${encodeURIComponent(managementCsrf)}`
    }
  });
  assert.equal(ownerRevoked.status, 303);
  const afterRevoke = await call(env, "me", {
    headers: { Authorization: `Bearer ${credentials.accessToken}` }
  });
  assert.equal(afterRevoke.status, 401);
  assert.equal((await afterRevoke.json()).code, "AGENT_TOKEN_INVALID");

  const selfToken = `lusu_agent_${"S".repeat(43)}`;
  db.sqlite.prepare(`
    insert into agent_access_tokens (
      token_id, token_hash, token_hint, user_id, client_name, scopes,
      created_at, expires_at, last_used_at, revoked_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, '', '')
  `).run(
    "11111111-1111-4111-8111-111111111111",
    await sha256Hex(selfToken),
    selfToken.slice(-6),
    "user-1",
    "Self revoke test",
    JSON.stringify(["content:read"]),
    new Date().toISOString(),
    new Date(Date.now() + 60 * 60 * 1000).toISOString()
  );
  const selfRevoked = await call(env, "tokens/current", {
    method: "DELETE",
    headers: { Authorization: `Bearer ${selfToken}` }
  });
  assert.equal(selfRevoked.status, 200);

  const auditActions = db.sqlite.prepare("select action from agent_audit_log order by rowid").all()
    .map((row) => row.action);
  assert.deepEqual(auditActions, [
    "agent-device-approved",
    "agent-token-issued",
    "agent-token-revoked-by-owner",
    "agent-token-revoked"
  ]);
});

test("device authorization validates origin, content type and per-IP rate limits", async () => {
  const { env } = await createFixture();
  const invalidType = await call(env, "device/start", {
    method: "POST",
    body: "{}",
    headers: { "Content-Type": "text/plain" }
  });
  assert.equal(invalidType.status, 415);

  for (let index = 0; index < 10; index += 1) {
    const response = await call(env, "device/start", {
      method: "POST",
      ...jsonRequest({ clientName: `rate-test-${index}`, scopes: ["content:read"] }),
      headers: { "CF-Connecting-IP": "203.0.113.20", "Content-Type": "application/json" }
    });
    assert.equal(response.status, 201);
  }
  const limited = await call(env, "device/start", {
    method: "POST",
    ...jsonRequest({ clientName: "rate-test-limited", scopes: ["content:read"] }),
    headers: { "CF-Connecting-IP": "203.0.113.20", "Content-Type": "application/json" }
  });
  assert.equal(limited.status, 429);
  assert.equal((await limited.json()).code, "AGENT_DEVICE_RATE_LIMITED");

  for (let index = 0; index < 25; index += 1) {
    const crossSiteSubresource = await call(env, "device/authorize?user_code=AAAA-BBBB", {
      headers: {
        "CF-Connecting-IP": "203.0.113.30",
        "Sec-Fetch-Site": "cross-site",
        "Sec-Fetch-Mode": "no-cors",
        "Sec-Fetch-Dest": "image"
      }
    });
    assert.equal(crossSiteSubresource.status, 403);
    assert.equal((await crossSiteSubresource.json()).code, "AGENT_AUTH_NAVIGATION_REJECTED");
  }

  for (let index = 0; index < 20; index += 1) {
    const lookup = await call(env, "device/authorize?user_code=AAAA-BBBB", {
      headers: { "CF-Connecting-IP": "203.0.113.30" }
    });
    assert.equal(lookup.status, 404);
  }
  const lookupLimited = await call(env, "device/authorize?user_code=AAAA-BBBB", {
    headers: { "CF-Connecting-IP": "203.0.113.30" }
  });
  assert.equal(lookupLimited.status, 429);
  assert.equal((await lookupLimited.json()).code, "AGENT_DEVICE_LOOKUP_RATE_LIMITED");

  const crossOriginDevice = await call(env, "device/start", {
    method: "POST",
    ...jsonRequest({ clientName: "Origin test", scopes: ["content:read"] }),
    headers: { "CF-Connecting-IP": "203.0.113.21", "Content-Type": "application/json" }
  });
  assert.equal(crossOriginDevice.status, 201);
  const crossOriginDetails = await crossOriginDevice.json();
  const crossOriginConsent = await call(
    env,
    `device/authorize?user_code=${crossOriginDetails.userCode}`,
    { browserSession: true, headers: { "CF-Connecting-IP": "203.0.113.21" } }
  );
  const crossOriginCsrf = cookieValue(
    crossOriginConsent.headers.get("Set-Cookie"),
    "__Host-lusu_agent_csrf"
  );
  const crossOriginDecision = await call(env, "device/authorize", {
    method: "POST",
    browserSession: true,
    body: new URLSearchParams({
      user_code: crossOriginDetails.userCode,
      csrf_token: crossOriginCsrf,
      decision: "approve"
    }).toString(),
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: "https://attacker.example",
      Cookie: `__Host-lusu_agent_csrf=${encodeURIComponent(crossOriginCsrf)}`
    }
  });
  assert.equal(crossOriginDecision.status, 403);
  assert.equal((await crossOriginDecision.json()).code, "AGENT_ORIGIN_REJECTED");

  const randomDeviceCode = "A".repeat(43);
  for (let index = 0; index < 300; index += 1) {
    const invalidExchange = await call(env, "device/token", {
      method: "POST",
      headers: { "CF-Connecting-IP": "203.0.113.40", "Content-Type": "application/json" },
      body: JSON.stringify({ deviceCode: randomDeviceCode })
    });
    assert.equal(invalidExchange.status, 400);
    assert.equal((await invalidExchange.json()).code, "AGENT_DEVICE_INVALID");
  }
  const exchangeLimited = await call(env, "device/token", {
    method: "POST",
    headers: { "CF-Connecting-IP": "203.0.113.40", "Content-Type": "application/json" },
    body: JSON.stringify({ deviceCode: randomDeviceCode })
  });
  assert.equal(exchangeLimited.status, 429);
  assert.equal((await exchangeLimited.json()).code, "AGENT_DEVICE_TOKEN_RATE_LIMITED");
});

test("authorization HTML preserves exact POST origins without leaking device-code paths", async () => {
  const { env, db } = await createFixture();
  const started = await call(env, "device/start", {
    method: "POST",
    ...jsonRequest({ clientName: "Browser form policy test", scopes: ["transfer:read"] }),
    headers: { "CF-Connecting-IP": "203.0.113.81", "Content-Type": "application/json" }
  });
  assert.equal(started.status, 201);
  assert.equal(started.headers.get("Referrer-Policy"), "no-referrer");
  const device = await started.json();
  for (const headers of [
    { "CF-Connecting-IP": "203.0.113.81" },
    { "CF-Connecting-IP": "203.0.113.81", "Sec-Fetch-Site": "none", "Sec-Fetch-Mode": "navigate", "Sec-Fetch-Dest": "document" },
    { "CF-Connecting-IP": "203.0.113.81", "Sec-Fetch-Site": "same-origin", "Sec-Fetch-Mode": "navigate", "Sec-Fetch-Dest": "document" },
    { "CF-Connecting-IP": "203.0.113.81", "Sec-Fetch-Site": "same-site", "Sec-Fetch-Mode": "navigate", "Sec-Fetch-Dest": "document" },
    { "CF-Connecting-IP": "203.0.113.81", "Sec-Fetch-Site": "cross-site", "Sec-Fetch-Mode": "navigate", "Sec-Fetch-Dest": "document" }
  ]) {
    const navigation = await call(env, `device/authorize?user_code=${device.userCode}`, {
      browserSession: true,
      headers
    });
    assert.equal(navigation.status, 200);
    assert.equal(navigation.headers.get("Referrer-Policy"), "strict-origin");
  }
  for (const headers of [
    { "Sec-Fetch-Site": "cross-site", "Sec-Fetch-Mode": "navigate", "Sec-Fetch-Dest": "iframe" },
    { "Sec-Fetch-Site": "same-origin", "Sec-Fetch-Mode": "cors", "Sec-Fetch-Dest": "empty" }
  ]) {
    const rejected = await call(env, `device/authorize?user_code=${device.userCode}`, {
      browserSession: true,
      headers: { "CF-Connecting-IP": "203.0.113.83", ...headers }
    });
    assert.equal(rejected.status, 403);
    assert.equal((await rejected.json()).code, "AGENT_AUTH_NAVIGATION_REJECTED");
  }
  const consent = await call(env, `device/authorize?user_code=${device.userCode}`, {
    browserSession: true,
    headers: { "CF-Connecting-IP": "203.0.113.81" }
  });
  const csrf = cookieValue(consent.headers.get("Set-Cookie"), "__Host-lusu_agent_csrf");
  const formBody = new URLSearchParams({
    user_code: device.userCode,
    csrf_token: csrf,
    decision: "approve"
  }).toString();
  const fallbackHeaders = {
    "CF-Connecting-IP": "203.0.113.81",
    "Content-Type": "application/x-www-form-urlencoded",
    Cookie: `__Host-lusu_agent_csrf=${encodeURIComponent(csrf)}`
  };

  for (const rejectedOrigin of [
    null,
    "null",
    "https://www.example.test",
    "https://attacker.example"
  ]) {
    const headers = { ...fallbackHeaders };
    if (rejectedOrigin !== null) headers.Origin = rejectedOrigin;
    const response = await call(env, "device/authorize", {
      method: "POST",
      browserSession: true,
      body: formBody,
      headers
    });
    assert.equal(response.status, 403);
    assert.equal((await response.json()).code, "AGENT_ORIGIN_REJECTED");
    assert.equal(
      db.sqlite.prepare("select status from agent_device_authorizations limit 1").get().status,
      "pending"
    );
  }

  for (const { body, cookie } of [
    { body: formBody, cookie: "" },
    {
      body: new URLSearchParams({
        user_code: device.userCode,
        csrf_token: "invalid-csrf-token",
        decision: "approve"
      }).toString(),
      cookie: `__Host-lusu_agent_csrf=${encodeURIComponent(csrf)}`
    }
  ]) {
    const response = await call(env, "device/authorize", {
      method: "POST",
      browserSession: true,
      body,
      headers: {
        "CF-Connecting-IP": "203.0.113.81",
        "Content-Type": "application/x-www-form-urlencoded",
        Origin: origin,
        ...(cookie ? { Cookie: cookie } : {})
      }
    });
    assert.equal(response.status, 403);
    assert.equal((await response.json()).code, "AGENT_CSRF_INVALID");
    assert.equal(
      db.sqlite.prepare("select status from agent_device_authorizations limit 1").get().status,
      "pending"
    );
  }

  const approved = await call(env, "device/authorize", {
    method: "POST",
    browserSession: true,
    body: formBody,
    headers: { ...fallbackHeaders, Origin: origin }
  });
  assert.equal(approved.status, 200);
  assert.equal(
    db.sqlite.prepare("select status from agent_device_authorizations limit 1").get().status,
    "approved"
  );

  const management = await call(env, "tokens/manage", { browserSession: true });
  assert.equal(management.status, 200);
  assert.equal(management.headers.get("Referrer-Policy"), "strict-origin");
});

test("revoke-all invalidates active tokens and approved unconsumed device grants", async () => {
  const { db, env } = await createFixture();
  const started = await call(env, "device/start", {
    method: "POST",
    ...jsonRequest({ clientName: "Outstanding device", scopes: ["content:read"] }),
    headers: { "CF-Connecting-IP": "203.0.113.50", "Content-Type": "application/json" }
  });
  assert.equal(started.status, 201);
  const device = await started.json();

  const consent = await call(env, `device/authorize?user_code=${device.userCode}`, {
    browserSession: true,
    headers: { "CF-Connecting-IP": "203.0.113.50" }
  });
  assert.equal(consent.status, 200);
  const authorizeCsrf = cookieValue(
    consent.headers.get("Set-Cookie"),
    "__Host-lusu_agent_csrf"
  );
  const approveForm = new URLSearchParams({
    user_code: device.userCode,
    csrf_token: authorizeCsrf,
    decision: "approve"
  });
  const approved = await call(env, "device/authorize", {
    method: "POST",
    body: approveForm.toString(),
    browserSession: true,
    headers: {
      "CF-Connecting-IP": "203.0.113.50",
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: origin,
      Cookie: `__Host-lusu_agent_csrf=${encodeURIComponent(authorizeCsrf)}`
    }
  });
  assert.equal(approved.status, 200);

  const activeToken = `lusu_agent_${"R".repeat(43)}`;
  db.sqlite.prepare(`
    insert into agent_access_tokens (
      token_id, token_hash, token_hint, user_id, client_name, scopes,
      created_at, expires_at, last_used_at, revoked_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, '', '')
  `).run(
    "22222222-2222-4222-8222-222222222222",
    await sha256Hex(activeToken),
    activeToken.slice(-6),
    "user-1",
    "Existing agent",
    JSON.stringify(["content:read"]),
    new Date().toISOString(),
    new Date(Date.now() + 60 * 60 * 1000).toISOString()
  );

  const management = await call(env, "tokens/manage", { browserSession: true });
  assert.equal(management.status, 200);
  const managementCsrf = cookieValue(
    management.headers.get("Set-Cookie"),
    "__Host-lusu_agent_manage_csrf"
  );
  const revokeAllForm = new URLSearchParams({
    csrf_token: managementCsrf,
    action: "revoke-all"
  });
  const revoked = await call(env, "tokens/manage", {
    method: "POST",
    body: revokeAllForm.toString(),
    browserSession: true,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: origin,
      Cookie: `__Host-lusu_agent_manage_csrf=${encodeURIComponent(managementCsrf)}`
    }
  });
  assert.equal(revoked.status, 303);

  const storedGrant = db.sqlite.prepare(`
    select status, granted_scopes from agent_device_authorizations where device_id = ?
  `).get(db.sqlite.prepare("select device_id from agent_device_authorizations limit 1").get().device_id);
  assert.equal(storedGrant.status, "denied");
  assert.equal(storedGrant.granted_scopes, "[]");
  assert.notEqual(
    db.sqlite.prepare("select revoked_at from agent_access_tokens where token_id = ?").get(
      "22222222-2222-4222-8222-222222222222"
    ).revoked_at,
    ""
  );

  const exchangeAfterRevokeAll = await call(env, "device/token", {
    method: "POST",
    ...jsonRequest({ deviceCode: device.deviceCode }),
    headers: { "CF-Connecting-IP": "203.0.113.50", "Content-Type": "application/json" }
  });
  assert.equal(exchangeAfterRevokeAll.status, 403);
  assert.equal((await exchangeAfterRevokeAll.json()).code, "AUTHORIZATION_DENIED");

  const activeTokenAfterRevokeAll = await call(env, "me", {
    headers: { Authorization: `Bearer ${activeToken}` }
  });
  assert.equal(activeTokenAfterRevokeAll.status, 401);
  assert.equal((await activeTokenAfterRevokeAll.json()).code, "AGENT_TOKEN_INVALID");

  const auditActions = db.sqlite.prepare("select action from agent_audit_log order by rowid").all()
    .map((row) => row.action);
  assert.deepEqual(auditActions, [
    "agent-device-approved",
    "agent-token-revoked-by-owner",
    "agent-token-revoked-all"
  ]);
});

test("the transactional token cap preserves the grant and machine principals never inherit admin", async () => {
  const { db, env } = await createFixture();
  db.sqlite.prepare("update users set role = 'admin' where id = 'user-1'").run();
  const device = await startAndApproveDevice(env, {
    ip: "203.0.113.60",
    clientName: "Admin-owned agent"
  });
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const insert = db.sqlite.prepare(`
    insert into agent_access_tokens (
      token_id, token_hash, token_hint, user_id, client_name, scopes,
      created_at, expires_at, last_used_at, revoked_at
    ) values (?, ?, ?, 'user-1', 'Cap fixture', '["content:read"]', ?, ?, '', '')
  `);
  for (let index = 0; index < 20; index += 1) {
    insert.run(
      `cap-token-${index}`,
      await sha256Hex(`cap-secret-${index}`),
      String(index).padStart(6, "0"),
      createdAt,
      expiresAt
    );
  }

  const capped = await call(env, "device/token", {
    method: "POST",
    ...jsonRequest({ deviceCode: device.deviceCode }),
    headers: { "CF-Connecting-IP": "203.0.113.60", "Content-Type": "application/json" }
  });
  assert.equal(capped.status, 409);
  assert.equal((await capped.json()).code, "AGENT_TOKEN_LIMIT_REACHED");
  assert.equal(
    db.sqlite.prepare("select status from agent_device_authorizations limit 1").get().status,
    "approved"
  );
  assert.equal(
    db.sqlite.prepare("select count(*) as count from agent_audit_log where action = 'agent-token-issued'").get().count,
    0
  );

  db.sqlite.prepare("update agent_access_tokens set revoked_at = ? where token_id = 'cap-token-0'")
    .run(new Date().toISOString());
  const exchanged = await call(env, "device/token", {
    method: "POST",
    ...jsonRequest({ deviceCode: device.deviceCode }),
    headers: { "CF-Connecting-IP": "203.0.113.60", "Content-Type": "application/json" }
  });
  assert.equal(exchanged.status, 201);
  const credentials = await exchanged.json();
  assert.equal(credentials.user.role, "user");

  const me = await call(env, "me", {
    headers: { Authorization: `Bearer ${credentials.accessToken}` }
  });
  assert.equal(me.status, 200);
  assert.equal((await me.json()).user.role, "user");
  const principal = await authenticateAgentBearer(new Request(`${origin}/api/agent-auth/me`, {
    headers: { Authorization: `Bearer ${credentials.accessToken}` }
  }), env);
  assert.equal(principal.user.role, "user");
  assert.equal(
    db.sqlite.prepare(`
      select count(*) as count from agent_access_tokens
      where revoked_at = '' and expires_at > ?
    `).get(new Date().toISOString()).count,
    20
  );
  assert.equal(
    db.sqlite.prepare("select count(*) as count from agent_audit_log where action = 'agent-token-issued'").get().count,
    1
  );
});

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(value)));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
