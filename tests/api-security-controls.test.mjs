import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const CHAT_SECRET = "api-security-chat-secret-00000000000000001";
const ANALYTICS_SECRET = "api-security-analytics-secret-00000000001";
const WHITEBOARD_ROOM_SECRET = "api-security-whiteboard-room-secret-0000000001";
const WHITEBOARD_TICKET_SECRET = "api-security-whiteboard-ticket-secret-00000002";
const WHITEBOARD_INTERNAL_SECRET = "api-security-whiteboard-internal-secret-000003";
const WHITEBOARD_IP_SECRET = "api-security-whiteboard-ip-secret-00000000004";
const ORIGIN = "https://example.test";
const source = await readFile(new URL("../functions/api/[[route]].js", import.meta.url), "utf8");

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

async function freshApi(label) {
  const moduleUrl = new URL("../functions/api/[[route]].js", import.meta.url);
  moduleUrl.searchParams.set("api-security-controls", `${label}-${Date.now()}-${Math.random()}`);
  return import(moduleUrl.href);
}

function apiRequest(path, {
  method = "GET",
  body,
  headers = {},
  origin = ORIGIN
} = {}) {
  const requestHeaders = new Headers(headers);
  const init = { method, headers: requestHeaders };
  if (body !== undefined) {
    requestHeaders.set("Content-Type", requestHeaders.get("Content-Type") || "application/json");
    init.body = typeof body === "string" ? body : JSON.stringify(body);
  }
  if (method !== "GET" && method !== "HEAD") {
    requestHeaders.set("Origin", origin);
    requestHeaders.set("Sec-Fetch-Site", origin === ORIGIN ? "same-origin" : "cross-site");
  }
  return new Request(`${ORIGIN}/api/${path}`, init);
}

function envFor(DB) {
  return {
    DB,
    CHAT_IP_HASH_SALT: CHAT_SECRET,
    ANALYTICS_IP_HASH_SALT: ANALYTICS_SECRET,
    WHITEBOARD_ROOM_HMAC_SECRET: WHITEBOARD_ROOM_SECRET,
    WHITEBOARD_TICKET_SECRET,
    WHITEBOARD_INTERNAL_SECRET,
    WHITEBOARD_IP_HASH_SALT: WHITEBOARD_IP_SECRET,
    WHITEBOARD_ROOMS: {
      getByName() {
        return {
          async fetch(request) {
            if (
              request.method === "POST"
              && new URL(request.url).pathname === "/assets"
            ) {
              return Response.json({
                ok: true,
                asset: {
                  assetId: "asset_root_route000000001",
                  contentType: "image/png",
                  byteLength: Number(request.headers.get("content-length") || 0),
                  width: 2,
                  height: 2
                }
              }, { status: 201 });
            }
            return Response.json({ ok: false }, { status: 404 });
          }
        };
      }
    }
  };
}

async function invoke(onRequest, DB, request) {
  return onRequest({
    request,
    env: envFor(DB),
    waitUntil() {}
  });
}

async function invokeAndWait(onRequest, DB, request) {
  const pending = [];
  const response = await onRequest({
    request,
    env: envFor(DB),
    waitUntil(promise) {
      pending.push(Promise.resolve(promise));
    }
  });
  await Promise.all(pending);
  return response;
}

async function legacyPasswordHash(password, iterations = 25000) {
  const salt = webcrypto.getRandomValues(new Uint8Array(16));
  const key = await webcrypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = new Uint8Array(await webcrypto.subtle.deriveBits({
    name: "PBKDF2",
    salt,
    iterations,
    hash: "SHA-256"
  }, key, 256));
  const encode = (bytes) => Buffer.from(bytes).toString("base64url");
  return `pbkdf2_sha256$${iterations}$${encode(salt)}$${encode(bits)}`;
}

function visitorCookie(response) {
  const match = String(response.headers.get("set-cookie") || "").match(/lusu_visitor=([^;]+)/);
  return match ? `lusu_visitor=${match[1]}` : "";
}

async function sha256HexValue(value) {
  const digest = await webcrypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Buffer.from(digest).toString("hex");
}

test("main API mutation gate rejects cross-origin and non-JSON requests before business writes", async () => {
  const { onRequest } = await freshApi("mutation-gate");
  const DB = new D1Database();
  try {
    const crossOrigin = await invoke(onRequest, DB, apiRequest("auth/login", {
      method: "POST",
      origin: "https://evil.example",
      body: { email: "user@example.test", password: "ValidPass123!" }
    }));
    assert.equal(crossOrigin.status, 403);
    assert.match((await crossOrigin.json()).error, /来源/);
    assert.equal(
      DB.sqlite.prepare("select count(*) as count from sqlite_master where type = 'table'").get().count,
      0,
      "origin rejection must happen before runtime schema writes"
    );

    const nonJson = await invoke(onRequest, DB, apiRequest("auth/login", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "{}"
    }));
    assert.equal(nonJson.status, 415);
    assert.equal(
      DB.sqlite.prepare("select count(*) as count from sqlite_master where type = 'table'").get().count,
      0,
      "content-type rejection must happen before runtime schema writes"
    );
  } finally {
    DB.close();
  }
});

test("main API mutation gate permits only safe raster uploads for the whiteboard", async () => {
  const { onRequest } = await freshApi("whiteboard-raster-gate");
  const DB = new D1Database();
  try {
    const identityResponse = await invoke(
      onRequest,
      DB,
      apiRequest("anonymous-identity")
    );
    assert.equal(identityResponse.status, 200);
    const cookie = String(identityResponse.headers.get("set-cookie") || "")
      .split(";", 1)[0];

    const join = await invoke(onRequest, DB, apiRequest("whiteboard/rooms/join", {
      method: "POST",
      headers: {
        Cookie: cookie,
        "CF-Connecting-IP": "203.0.113.80"
      },
      body: { type: "public" }
    }));
    assert.equal(join.status, 200, await join.clone().text());
    const { accessToken } = await join.json();

    const upload = new Request(`${ORIGIN}/api/whiteboard/assets`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Cookie: cookie,
        "CF-Connecting-IP": "203.0.113.80",
        "Content-Type": "image/png",
        Origin: ORIGIN,
        "Sec-Fetch-Site": "same-origin"
      },
      body: new Uint8Array([0x89, 0x50, 0x4e, 0x47])
    });
    const response = await invoke(onRequest, DB, upload);
    assert.equal(response.status, 201, await response.clone().text());

    const agentUpload = new Request(`${ORIGIN}/api/whiteboard/agent/assets`, {
      method: "POST",
      headers: {
        "CF-Connecting-IP": "203.0.113.80",
        "Content-Type": "image/png",
        "X-Whiteboard-Operation-Id": "agent-raster-gate-smoke"
      },
      body: new Uint8Array([0x89, 0x50, 0x4e, 0x47])
    });
    const agentResponse = await invoke(onRequest, DB, agentUpload);
    assert.equal(agentResponse.status, 401, await agentResponse.clone().text());
    assert.equal((await agentResponse.json()).code, "AGENT_TOKEN_REQUIRED");

    const crossOriginAgent = new Request(`${ORIGIN}/api/whiteboard/agent/assets`, {
      method: "POST",
      headers: {
        "CF-Connecting-IP": "203.0.113.80",
        "Content-Type": "image/png",
        Origin: "https://evil.example",
        "Sec-Fetch-Site": "cross-site",
        "X-Whiteboard-Operation-Id": "agent-raster-gate-cross-origin"
      },
      body: new Uint8Array([0x89, 0x50, 0x4e, 0x47])
    });
    const crossOriginAgentResponse = await invoke(onRequest, DB, crossOriginAgent);
    assert.equal(crossOriginAgentResponse.status, 403);

    const unsafe = await invoke(onRequest, DB, apiRequest("whiteboard/assets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Cookie: cookie,
        "CF-Connecting-IP": "203.0.113.80",
        "Content-Type": "image/svg+xml"
      },
      body: "<svg></svg>"
    }));
    assert.equal(unsafe.status, 415);

    const unsafeAgent = await invoke(onRequest, DB, apiRequest("whiteboard/agent/assets", {
      method: "POST",
      headers: {
        "CF-Connecting-IP": "203.0.113.80",
        "Content-Type": "image/svg+xml",
        "X-Whiteboard-Operation-Id": "agent-raster-gate-unsafe"
      },
      body: "<svg></svg>"
    }));
    assert.equal(unsafeAgent.status, 415);

    const adjacentAgentPath = await invoke(onRequest, DB, apiRequest("whiteboard/agent/assets/extra", {
      method: "POST",
      headers: {
        "CF-Connecting-IP": "203.0.113.80",
        "Content-Type": "image/png",
        "X-Whiteboard-Operation-Id": "agent-raster-gate-adjacent"
      },
      body: new Uint8Array([0x89, 0x50, 0x4e, 0x47])
    }));
    assert.equal(adjacentAgentPath.status, 415);
  } finally {
    DB.close();
  }
});

test("main API mutation gate permits only exact Agent Yjs scene updates", async () => {
  const { onRequest } = await freshApi("whiteboard-agent-scene-gate");
  const DB = new D1Database();
  try {
    const crossOriginRequest = new Request(`${ORIGIN}/api/whiteboard/agent/scene`, {
      method: "POST",
      headers: {
        "CF-Connecting-IP": "203.0.113.81",
        "Content-Type": "application/vnd.yjs-update",
        Origin: "https://evil.example",
        "Sec-Fetch-Site": "cross-site",
        "X-Whiteboard-Operation-Id": "agent-scene-gate-cross-origin"
      },
      body: new Uint8Array([0x00, 0x01])
    });
    const crossOriginResponse = await invoke(onRequest, DB, crossOriginRequest);
    assert.equal(crossOriginResponse.status, 403);
    assert.equal(
      DB.sqlite.prepare("select count(*) as count from sqlite_master where type = 'table'").get().count,
      0,
      "cross-origin Agent scene rejection must happen before runtime schema writes"
    );

    const exactRequest = new Request(`${ORIGIN}/api/whiteboard/agent/scene`, {
      method: "POST",
      headers: {
        "CF-Connecting-IP": "203.0.113.81",
        "Content-Type": "application/vnd.yjs-update",
        Origin: ORIGIN,
        "Sec-Fetch-Site": "same-origin",
        "X-Whiteboard-Operation-Id": "agent-scene-gate-smoke"
      },
      body: new Uint8Array([0x00, 0x01])
    });
    const exactResponse = await invoke(onRequest, DB, exactRequest);
    assert.equal(exactResponse.status, 401, await exactResponse.clone().text());
    assert.equal((await exactResponse.json()).code, "AGENT_TOKEN_REQUIRED");

    const adjacentPathRequest = new Request(`${ORIGIN}/api/whiteboard/agent/scene/extra`, {
      method: "POST",
      headers: {
        "CF-Connecting-IP": "203.0.113.81",
        "Content-Type": "application/vnd.yjs-update",
        Origin: ORIGIN,
        "Sec-Fetch-Site": "same-origin",
        "X-Whiteboard-Operation-Id": "agent-scene-gate-adjacent"
      },
      body: new Uint8Array([0x00, 0x01])
    });
    const adjacentPathResponse = await invoke(onRequest, DB, adjacentPathRequest);
    assert.equal(adjacentPathResponse.status, 415);

    const wrongMimeRequest = new Request(`${ORIGIN}/api/whiteboard/agent/scene`, {
      method: "POST",
      headers: {
        "CF-Connecting-IP": "203.0.113.81",
        "Content-Type": "application/octet-stream",
        Origin: ORIGIN,
        "Sec-Fetch-Site": "same-origin",
        "X-Whiteboard-Operation-Id": "agent-scene-gate-wrong-mime"
      },
      body: new Uint8Array([0x00, 0x01])
    });
    const wrongMimeResponse = await invoke(onRequest, DB, wrongMimeRequest);
    assert.equal(wrongMimeResponse.status, 415);

    const wrongMethodRequest = new Request(`${ORIGIN}/api/whiteboard/agent/scene`, {
      method: "PUT",
      headers: {
        "CF-Connecting-IP": "203.0.113.81",
        "Content-Type": "application/vnd.yjs-update",
        Origin: ORIGIN,
        "Sec-Fetch-Site": "same-origin",
        "X-Whiteboard-Operation-Id": "agent-scene-gate-wrong-method"
      },
      body: new Uint8Array([0x00, 0x01])
    });
    const wrongMethodResponse = await invoke(onRequest, DB, wrongMethodRequest);
    assert.equal(wrongMethodResponse.status, 415);
  } finally {
    DB.close();
  }
});

test("auth requests are bounded, rate limited, enumeration-safe, and upgrade legacy PBKDF2 hashes", async () => {
  const { onRequest } = await freshApi("auth");
  const DB = new D1Database();
  const password = "ValidPass123!";
  try {
    const initialize = await invoke(onRequest, DB, apiRequest("auth/me"));
    assert.equal(initialize.status, 200);
    const now = "2026-07-26T00:00:00.000Z";
    DB.sqlite.prepare(`
      insert into users (id, email, password_hash, role, created_at, updated_at)
      values (?, ?, ?, 'user', ?, ?)
    `).run("legacy-user", "legacy@example.test", await legacyPasswordHash(password), now, now);
    const compatibleHash = await legacyPasswordHash(password, 100000);
    DB.sqlite.prepare(`
      insert into users (id, email, password_hash, role, created_at, updated_at)
      values (?, ?, ?, 'user', ?, ?)
    `).run(
      "legacy-100k-user",
      "legacy-100k@example.test",
      compatibleHash,
      now,
      now
    );

    const login = await invoke(onRequest, DB, apiRequest("auth/login", {
      method: "POST",
      headers: { "CF-Connecting-IP": "203.0.113.10" },
      body: { email: "LEGACY@example.test", password }
    }));
    assert.equal(login.status, 200, await login.clone().text());
    const stored = DB.sqlite.prepare("select password_hash from users where id = ?").get("legacy-user").password_hash;
    assert.match(stored, /^pbkdf2_sha256\$100000\$/);

    const login100k = await invoke(onRequest, DB, apiRequest("auth/login", {
      method: "POST",
      headers: { "CF-Connecting-IP": "203.0.113.13" },
      body: { email: "legacy-100k@example.test", password }
    }));
    assert.equal(login100k.status, 200, await login100k.clone().text());
    const stored100k = DB.sqlite.prepare(
      "select password_hash from users where id = ?"
    ).get("legacy-100k-user").password_hash;
    assert.equal(stored100k, compatibleHash, "a runtime-compatible hash must not be rewritten on login");

    const registered = await invoke(onRequest, DB, apiRequest("auth/register", {
      method: "POST",
      headers: { "CF-Connecting-IP": "203.0.113.14" },
      body: { email: "new-account@example.test", password }
    }));
    assert.equal(registered.status, 201, await registered.clone().text());
    const registeredHash = DB.sqlite.prepare(
      "select password_hash from users where email = ?"
    ).get("new-account@example.test").password_hash;
    assert.match(registeredHash, /^pbkdf2_sha256\$100000\$/);

    const duplicate = await invoke(onRequest, DB, apiRequest("auth/register", {
      method: "POST",
      headers: { "CF-Connecting-IP": "203.0.113.11" },
      body: { email: "legacy@example.test", password }
    }));
    assert.equal(duplicate.status, 400);
    const duplicatePayload = await duplicate.json();
    assert.equal(duplicatePayload.code, "REGISTRATION_FAILED");
    assert.match(duplicatePayload.error, /无法完成注册/);
    assert.doesNotMatch(duplicatePayload.error, /已经注册|存在|legacy@example\.test/i);

    const oversized = await invoke(onRequest, DB, apiRequest("auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: "oversized@example.test",
        password: "x".repeat(9 * 1024)
      })
    }));
    assert.equal(oversized.status, 413);

    let limitedResponse;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      limitedResponse = await invoke(onRequest, DB, apiRequest("auth/login", {
        method: "POST",
        headers: { "CF-Connecting-IP": "203.0.113.12" },
        body: { email: "missing@example.test", password }
      }));
    }
    assert.equal(limitedResponse.status, 429);
    assert.equal((await limitedResponse.json()).code, "RATE_LIMITED");
    assert.ok(Number(limitedResponse.headers.get("Retry-After")) >= 1);
  } finally {
    DB.close();
  }
});

test("analytics writes are source checked and duplicate page views are collapsed", async () => {
  const { onRequest } = await freshApi("analytics");
  const DB = new D1Database();
  try {
    const first = await invoke(onRequest, DB, apiRequest("analytics/page-view", {
      method: "POST",
      headers: { "CF-Connecting-IP": "203.0.113.20" },
      body: { path: "/#knowledge", route: "knowledge", lang: "zh" }
    }));
    assert.equal(first.status, 200, await first.clone().text());
    const cookie = visitorCookie(first);
    assert.ok(cookie);

    const second = await invoke(onRequest, DB, apiRequest("analytics/page-view", {
      method: "POST",
      headers: {
        "CF-Connecting-IP": "203.0.113.20",
        Cookie: cookie
      },
      body: { path: "/#knowledge", route: "knowledge", lang: "zh" }
    }));
    assert.equal(second.status, 200);
    assert.equal(
      DB.sqlite.prepare("select count(*) as count from analytics_page_views").get().count,
      1,
      "the duplicate time bucket must not create a second raw event"
    );

    const crossOrigin = await invoke(onRequest, DB, apiRequest("analytics/click", {
      method: "POST",
      origin: "https://evil.example",
      body: { path: "/", targetKey: "button#fake" }
    }));
    assert.equal(crossOrigin.status, 403);
    assert.equal(
      DB.sqlite.prepare("select count(*) as count from analytics_click_events").get().count,
      0
    );
  } finally {
    DB.close();
  }
});

test("admin traffic controls expose honest write pressure, use CAS, and can shed telemetry writes", async () => {
  const { onRequest } = await freshApi("traffic-control");
  const DB = new D1Database();
  const sessionToken = "traffic-control-admin-session-token";
  try {
    const initialize = await invoke(onRequest, DB, apiRequest("auth/me"));
    assert.equal(initialize.status, 200);
    const now = "2026-08-01T00:00:00.000Z";
    DB.sqlite.prepare(`
      insert into users (id, email, password_hash, role, created_at, updated_at)
      values (?, ?, ?, 'admin', ?, ?)
    `).run("traffic-admin", "traffic-admin@example.test", "not-used", now, now);
    DB.sqlite.prepare(`
      insert into sessions (token_hash, user_id, created_at, expires_at)
      values (?, ?, ?, ?)
    `).run(
      await sha256HexValue(sessionToken),
      "traffic-admin",
      now,
      "2099-01-01T00:00:00.000Z"
    );
    const adminHeaders = { Cookie: `lusu_session=${sessionToken}` };

    const snapshotResponse = await invoke(onRequest, DB, apiRequest("admin/traffic-control", {
      headers: adminHeaders
    }));
    assert.equal(snapshotResponse.status, 200, await snapshotResponse.clone().text());
    const snapshot = await snapshotResponse.json();
    assert.equal(snapshot.settings.warningRows, 30000);
    assert.equal(snapshot.settings.hardRows, 50000);
    assert.deepEqual(snapshot.settings.sampling.warning, {
      pageViews: 25,
      clicks: 10,
      articleViews: 50
    });
    assert.deepEqual(snapshot.settings.sampling.hard, {
      pageViews: 0,
      clicks: 0,
      articleViews: 10
    });
    assert.equal(snapshot.usage.scope, "site-telemetry-estimate");
    assert.match(snapshot.usage.note, /估算/);
    assert.equal(snapshot.official.status, "not-configured");
    assert.equal("token" in snapshot.official, false);

    const missingVersion = await invoke(onRequest, DB, apiRequest("admin/traffic-control", {
      method: "PUT",
      headers: adminHeaders,
      body: { settings: snapshot.settings }
    }));
    assert.equal(missingVersion.status, 428);
    assert.equal((await missingVersion.json()).code, "TRAFFIC_CONTROL_VERSION_REQUIRED");

    const nextSettings = structuredClone(snapshot.settings);
    nextSettings.pageViewsEnabled = false;
    const update = await invoke(onRequest, DB, apiRequest("admin/traffic-control", {
      method: "PUT",
      headers: adminHeaders,
      body: { expectedUpdatedAt: snapshot.updatedAt, settings: nextSettings }
    }));
    assert.equal(update.status, 200, await update.clone().text());
    const updated = await update.json();
    assert.equal(updated.settings.pageViewsEnabled, false);
    assert.notEqual(updated.updatedAt, snapshot.updatedAt);

    const staleUpdate = await invoke(onRequest, DB, apiRequest("admin/traffic-control", {
      method: "PUT",
      headers: adminHeaders,
      body: { expectedUpdatedAt: snapshot.updatedAt, settings: snapshot.settings }
    }));
    assert.equal(staleUpdate.status, 409);
    assert.equal((await staleUpdate.json()).code, "TRAFFIC_CONTROL_CONFLICT");

    const pageView = await invoke(onRequest, DB, apiRequest("analytics/page-view", {
      method: "POST",
      headers: { "CF-Connecting-IP": "203.0.113.90" },
      body: { path: "/#knowledge", route: "knowledge", lang: "zh" }
    }));
    assert.equal(pageView.status, 200, await pageView.clone().text());
    assert.equal((await pageView.json()).recorded, false);
    assert.equal(DB.sqlite.prepare("select count(*) as count from analytics_page_views").get().count, 0);
  } finally {
    DB.close();
  }
});

test("traffic defaults migrate only an untouched legacy policy", async () => {
  const { ensureTrafficControlSettings } = await import("../functions/api/traffic-control.mjs");
  const legacy = {
    schemaVersion: 1,
    analyticsEnabled: true,
    identifyEnabled: true,
    pageViewsEnabled: true,
    clicksEnabled: true,
    articleViewsEnabled: true,
    adaptiveProtectionEnabled: true,
    warningRows: 60000,
    hardRows: 80000,
    sampling: {
      normal: { pageViews: 100, clicks: 100, articleViews: 100 },
      warning: { pageViews: 50, clicks: 25, articleViews: 75 },
      hard: { pageViews: 10, clicks: 0, articleViews: 25 }
    }
  };

  const untouchedDb = new D1Database();
  const customDb = new D1Database();
  try {
    for (const DB of [untouchedDb, customDb]) {
      DB.sqlite.exec(`
        create table site_runtime_state (
          key text primary key,
          value text not null,
          updated_at text not null
        )
      `);
    }
    const oldUpdatedAt = "2026-08-01T07:10:00.000Z";
    untouchedDb.sqlite.prepare(`
      insert into site_runtime_state (key, value, updated_at) values (?, ?, ?)
    `).run("traffic_control_settings_v1", JSON.stringify(legacy), oldUpdatedAt);
    const migrated = await ensureTrafficControlSettings({ DB: untouchedDb });
    assert.equal(migrated.settings.warningRows, 30000);
    assert.equal(migrated.settings.hardRows, 50000);
    assert.notEqual(migrated.updatedAt, oldUpdatedAt);

    const custom = { ...legacy, clicksEnabled: false };
    customDb.sqlite.prepare(`
      insert into site_runtime_state (key, value, updated_at) values (?, ?, ?)
    `).run("traffic_control_settings_v1", JSON.stringify(custom), oldUpdatedAt);
    const preserved = await ensureTrafficControlSettings({ DB: customDb });
    assert.equal(preserved.settings.warningRows, 60000);
    assert.equal(preserved.settings.hardRows, 80000);
    assert.equal(preserved.settings.clicksEnabled, false);
    assert.equal(preserved.updatedAt, oldUpdatedAt);
  } finally {
    untouchedDb.close();
    customDb.close();
  }
});

test("periodic cleanup applies the 180-day boundary to every raw analytics table", async () => {
  const { onRequest } = await freshApi("analytics-retention");
  const DB = new D1Database();
  try {
    const initialized = await invoke(onRequest, DB, apiRequest("analytics/page-view", {
      method: "POST",
      headers: { "CF-Connecting-IP": "203.0.113.91" },
      body: { path: "/", route: "home", lang: "zh" }
    }));
    assert.equal(initialized.status, 200, await initialized.clone().text());

    for (const [eventId, createdAt] of [
      ["article-view-expired", "2000-01-01T00:00:00.000Z"],
      ["article-view-current", "2099-01-01T00:00:00.000Z"]
    ]) {
      DB.sqlite.prepare(`
        insert into article_view_events (event_id, article_id, slug, lang, visitor_id, created_at)
        values (?, 'retention-article', 'retention-article', 'zh', 'retention-visitor', ?)
      `).run(eventId, createdAt);
    }

    const health = await invokeAndWait(onRequest, DB, apiRequest("health"));
    assert.equal(health.status, 200, await health.clone().text());
    assert.equal(
      DB.sqlite.prepare("select count(*) as count from article_view_events where event_id = ?")
        .get("article-view-expired").count,
      0
    );
    assert.equal(
      DB.sqlite.prepare("select count(*) as count from article_view_events where event_id = ?")
        .get("article-view-current").count,
      1
    );
  } finally {
    DB.close();
  }
});

test("sitemap output stays on the canonical origin with stable multilingual alternates", async () => {
  const { onRequest } = await freshApi("canonical-sitemap");
  const DB = new D1Database();
  try {
    const response = await invoke(onRequest, DB, apiRequest("sitemap.xml"));
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") || "", /application\/xml/);
    const xml = await response.text();
    assert.match(xml, /xmlns:xhtml="http:\/\/www\.w3\.org\/1999\/xhtml"/);
    assert.doesNotMatch(xml, /https:\/\/example\.test/);
    assert.match(xml, /<loc>https:\/\/lusu575\.com\/\?lang=zh<\/loc>/);
    assert.match(xml, /<lastmod>2026-08-07<\/lastmod>/);
    for (const lang of ["zh", "en", "ja", "x-default"]) {
      assert.match(xml, new RegExp(`hreflang="${lang}"`));
    }
  } finally {
    DB.close();
  }
});

test("unknown unauthenticated admin routes do not initialize feature schemas or seed content", async () => {
  const { onRequest } = await freshApi("admin-order");
  const DB = new D1Database();
  try {
    const response = await invoke(onRequest, DB, apiRequest("admin/not-a-real-feature"));
    assert.equal(response.status, 401);
    const tables = DB.sqlite.prepare(
      "select name from sqlite_master where type = 'table' order by name"
    ).all().map((row) => row.name);
    assert.equal(tables.includes("articles"), false);
    assert.equal(tables.includes("analytics_page_views"), false);
    assert.equal(tables.includes("videos"), false);
  } finally {
    DB.close();
  }
});

test("unexpected server failures are logged but never reflected to clients", async () => {
  const { onRequest } = await freshApi("error-redaction");
  const internalMessage = "sensitive database topology detail";
  const logs = [];
  const originalConsoleError = console.error;
  console.error = (...args) => logs.push(args);
  try {
    const response = await onRequest({
      request: apiRequest("auth/me"),
      env: {
        ...envFor(null),
        DB: {
          async batch() {
            throw new Error(internalMessage);
          },
          prepare() {
            throw new Error(internalMessage);
          }
        }
      },
      waitUntil() {}
    });
    assert.equal(response.status, 500);
    const payload = await response.json();
    assert.equal(payload.error, "服务暂时不可用，请稍后重试。");
    assert.doesNotMatch(JSON.stringify(payload), new RegExp(internalMessage));
    assert.match(JSON.stringify(logs), new RegExp(internalMessage));
  } finally {
    console.error = originalConsoleError;
  }
});

test("article view counters are gated by the deduplicated telemetry result", () => {
  assert.match(source, /if \(view\.recorded\) \{\s*await env\.DB\.prepare\("update articles set view_count = view_count \+ 1/i);
  assert.match(source, /analytics:article:visitor/);
  assert.match(source, /ANALYTICS_RATE_LIMITS\.articleVisitor/);
});
