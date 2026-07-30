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
    DB.sqlite.prepare(`
      insert into users (id, email, password_hash, role, created_at, updated_at)
      values (?, ?, ?, 'user', ?, ?)
    `).run(
      "legacy-100k-user",
      "legacy-100k@example.test",
      await legacyPasswordHash(password, 100000),
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
    assert.match(stored, /^pbkdf2_sha256\$600000\$/);

    const login100k = await invoke(onRequest, DB, apiRequest("auth/login", {
      method: "POST",
      headers: { "CF-Connecting-IP": "203.0.113.13" },
      body: { email: "legacy-100k@example.test", password }
    }));
    assert.equal(login100k.status, 200, await login100k.clone().text());
    const stored100k = DB.sqlite.prepare(
      "select password_hash from users where id = ?"
    ).get("legacy-100k-user").password_hash;
    assert.match(stored100k, /^pbkdf2_sha256\$600000\$/);

    const registered = await invoke(onRequest, DB, apiRequest("auth/register", {
      method: "POST",
      headers: { "CF-Connecting-IP": "203.0.113.14" },
      body: { email: "new-account@example.test", password }
    }));
    assert.equal(registered.status, 201, await registered.clone().text());
    const registeredHash = DB.sqlite.prepare(
      "select password_hash from users where email = ?"
    ).get("new-account@example.test").password_hash;
    assert.match(registeredHash, /^pbkdf2_sha256\$600000\$/);

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
