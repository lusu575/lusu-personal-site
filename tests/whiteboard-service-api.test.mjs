import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
  derivePrivateWhiteboardRoomId,
  handleWhiteboardApi,
  parseWhiteboardProtocols,
  signWhiteboardToken
} from "../functions/api/whiteboard-service.mjs";

const ORIGIN = "https://example.test";
const ROOM_SECRET = "whiteboard-room-hmac-secret-for-tests-000000000001";
const TICKET_SECRET = "whiteboard-ticket-secret-for-tests-0000000000002";
const INTERNAL_SECRET = "whiteboard-internal-secret-for-tests-00000000003";
const IP_SALT = "whiteboard-ip-hash-salt-for-tests-00000000000004";
const CHAT_IP_SALT = "chat-ip-hash-salt-for-tests-000000000000000005";
const ANALYTICS_IP_SALT = "analytics-ip-hash-salt-for-tests-000000000006";

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

class WhiteboardRoomStub {
  constructor(roomId) {
    this.roomId = roomId;
    this.calls = [];
    this.assets = new Map();
  }

  async fetch(request) {
    const headers = Object.fromEntries(request.headers.entries());
    const pathname = new URL(request.url).pathname;
    let body = "";
    let bodyByteLength = 0;
    if (request.method !== "GET" && request.body) {
      if (pathname === "/assets") {
        bodyByteLength = (await request.clone().arrayBuffer()).byteLength;
      } else {
        body = await request.clone().text();
        bodyByteLength = new TextEncoder().encode(body).byteLength;
      }
    }
    this.calls.push({
      method: request.method,
      url: request.url,
      headers,
      body,
      bodyByteLength
    });

    if (request.method === "GET" && pathname.startsWith("/assets/")) {
      const assetId = decodeURIComponent(pathname.slice("/assets/".length));
      const bytes = this.assets.get(assetId);
      if (!bytes) {
        return Response.json(
          { error: "not found", code: "WHITEBOARD_ASSET_NOT_FOUND" },
          { status: 404 }
        );
      }
      return new Response(bytes, {
        status: 200,
        headers: { "Content-Type": "image/png" }
      });
    }

    if (request.method === "POST" && pathname === "/assets") {
      return Response.json({
        assetId: "asset_uploaded0000000001",
        roomBound: this.roomId
      }, { status: 201 });
    }

    if (request.method === "POST" && pathname === "/admin") {
      const action = JSON.parse(body || "{}");
      return Response.json({
        ok: true,
        action: action.action,
        roomId: this.roomId
      });
    }

    return Response.json(
      { error: "rejected", code: "WHITEBOARD_REALTIME_REJECTED" },
      { status: 400 }
    );
  }
}

class WhiteboardNamespace {
  constructor() {
    this.rooms = new Map();
    this.requestedNames = [];
  }

  getByName(roomId) {
    this.requestedNames.push(roomId);
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new WhiteboardRoomStub(roomId));
    }
    return this.rooms.get(roomId);
  }

  room(roomId) {
    return this.getByName(roomId);
  }
}

function createHarness() {
  const DB = new D1Database();
  const WHITEBOARD_ROOMS = new WhiteboardNamespace();
  return {
    DB,
    WHITEBOARD_ROOMS,
    env: {
      DB,
      WHITEBOARD_ROOMS,
      WHITEBOARD_ROOM_HMAC_SECRET: ROOM_SECRET,
      WHITEBOARD_TICKET_SECRET: TICKET_SECRET,
      WHITEBOARD_INTERNAL_SECRET: INTERNAL_SECRET,
      WHITEBOARD_IP_HASH_SALT: IP_SALT,
      CHAT_IP_HASH_SALT: CHAT_IP_SALT,
      ANALYTICS_IP_HASH_SALT: ANALYTICS_IP_SALT
    },
    close() {
      DB.close();
    }
  };
}

async function callApi(
  harness,
  path,
  {
    method = "GET",
    json,
    body,
    cookie = "",
    origin = ORIGIN,
    includeOrigin = true,
    ip = "203.0.113.10",
    headers = {},
    options
  } = {}
) {
  const requestHeaders = new Headers(headers);
  if (includeOrigin && origin !== null) requestHeaders.set("Origin", origin);
  if (cookie) requestHeaders.set("Cookie", cookie);
  if (ip) requestHeaders.set("CF-Connecting-IP", ip);

  let requestBody = body;
  if (json !== undefined) {
    requestHeaders.set("Content-Type", "application/json");
    requestBody = JSON.stringify(json);
  }
  const request = new Request(`${ORIGIN}/api/${path}`, {
    method,
    headers: requestHeaders,
    body: requestBody
  });
  const parts = new URL(request.url).pathname
    .replace(/^\/api\/?/, "")
    .split("/")
    .filter(Boolean);
  return handleWhiteboardApi(
    { request, env: harness.env },
    parts,
    options
  );
}

function cookiePair(response) {
  return String(response.headers.get("Set-Cookie") || "").split(";")[0];
}

function tamperToken(token) {
  const index = Math.max(8, token.length - 12);
  const replacement = token[index] === "A" ? "B" : "A";
  return `${token.slice(0, index)}${replacement}${token.slice(index + 1)}`;
}

function decodeBase64UrlUtf8(value) {
  const normalized = String(value).replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - normalized.length % 4) % 4);
  return new TextDecoder().decode(
    Uint8Array.from(atob(`${normalized}${padding}`), (character) => (
      character.charCodeAt(0)
    ))
  );
}

async function join(
  harness,
  room,
  { cookie = "", ip = "203.0.113.10" } = {}
) {
  const response = await callApi(harness, "whiteboard/rooms/join", {
    method: "POST",
    json: room,
    cookie,
    ip
  });
  const text = await response.text();
  return {
    response,
    text,
    payload: JSON.parse(text),
    cookie: cookie || cookiePair(response)
  };
}

function identityRow(harness) {
  return harness.DB.sqlite.prepare(`
    select anonymous_id, identity_version
    from anonymous_identities
    order by created_at asc
    limit 1
  `).get();
}

function tokenClaims({
  kind,
  roomId,
  anonymousId,
  identityVersion = 1,
  issuedAt,
  expiresAt
}) {
  return {
    v: 1,
    aud: "lusu-whiteboard",
    kind,
    rid: roomId,
    rt: roomId === "public-v1" ? "public" : "private",
    sub: anonymousId,
    iv: identityVersion,
    iat: issuedAt,
    exp: expiresAt,
    jti: "ticket_test_identifier_0001"
  };
}

test("public and private joins return only opaque credentials and a shared anonymous identity", async (t) => {
  const harness = createHarness();
  t.after(() => harness.close());

  const publicJoin = await join(harness, { type: "public" });
  assert.equal(publicJoin.response.status, 200);
  assert.equal(publicJoin.payload.room.type, "public");
  assert.equal(publicJoin.payload.wsUrl, "/api/whiteboard/realtime");
  assert.equal(publicJoin.payload.wsProtocol, "whiteboard.v1");
  assert.equal("roomId" in publicJoin.payload, false);
  assert.equal("anonymousId" in publicJoin.payload.identity, false);
  assert.doesNotMatch(publicJoin.text, /public-v1/);
  assert.match(publicJoin.payload.ticket, /^wbt1\./);
  assert.match(publicJoin.payload.accessToken, /^wbt1\./);
  assert.match(publicJoin.response.headers.get("Set-Cookie"), /lusu_anonymous=/);
  assert.match(publicJoin.response.headers.get("Set-Cookie"), /HttpOnly/);
  assert.equal(publicJoin.response.headers.get("Cache-Control"), "no-store");
  assert.equal(publicJoin.response.headers.get("X-Content-Type-Options"), "nosniff");

  const privateJoin = await join(
    harness,
    { type: "private", password: "same-room-password" },
    { cookie: publicJoin.cookie }
  );
  assert.equal(privateJoin.response.status, 200);
  assert.equal(privateJoin.payload.room.type, "private");
  assert.deepEqual(privateJoin.payload.identity, publicJoin.payload.identity);
  assert.equal("roomId" in privateJoin.payload.room, false);
  assert.doesNotMatch(privateJoin.text, /same-room-password/);
  assert.doesNotMatch(privateJoin.payload.wsUrl, /password|room/i);

  const rows = harness.DB.sqlite.prepare(`
    select room_id, room_type
    from whiteboard_rooms
    order by room_type
  `).all();
  assert.deepEqual(rows.map((row) => row.room_type), ["public"]);
  assert.equal(rows.some((row) => row.room_id === "same-room-password"), false);

  const reconnected = await callApi(harness, "whiteboard/rooms/reconnect", {
    method: "POST",
    cookie: privateJoin.cookie,
    json: { accessToken: privateJoin.payload.accessToken }
  });
  assert.equal(reconnected.status, 200);
  assert.equal(
    harness.DB.sqlite.prepare(`
      select count(*) as count
      from whiteboard_rooms
      where room_type = 'private'
    `).get().count,
    0,
    "private HTTP joins and reconnects must not create durable room metadata before an accepted WebSocket"
  );
});

test("NFKC and trim produce a stable HMAC room while different passwords stay isolated", async (t) => {
  const harness = createHarness();
  t.after(() => harness.close());

  const normalized = await derivePrivateWhiteboardRoomId("ABCD-room", ROOM_SECRET);
  const compatibilityForm = await derivePrivateWhiteboardRoomId(
    "  ＡＢＣＤ-room  ",
    ROOM_SECRET
  );
  const different = await derivePrivateWhiteboardRoomId("ABCD-room-2", ROOM_SECRET);
  assert.equal(compatibilityForm, normalized);
  assert.notEqual(different, normalized);
  assert.match(normalized, /^wb_[A-Za-z0-9_-]{43}$/);

  const first = await join(harness, {
    type: "private",
    password: "  ＡＢＣＤ-room  "
  });
  assert.equal(first.response.status, 200);
  const same = await join(
    harness,
    { type: "private", password: "ABCD-room" },
    { cookie: first.cookie }
  );
  assert.equal(same.response.status, 200);
  const isolated = await join(
    harness,
    { type: "private", password: "ABCD-room-2" },
    { cookie: first.cookie }
  );
  assert.equal(isolated.response.status, 200);

  const roomIds = harness.DB.sqlite.prepare(`
    select room_id
    from whiteboard_rooms
    where room_type = 'private'
    order by room_id
  `).all().map((row) => row.room_id);
  assert.deepEqual(roomIds, []);
});

test("passwords never enter responses, URLs, D1 rows, or service logs", async (t) => {
  const harness = createHarness();
  t.after(() => harness.close());
  const password = "  ＮＥＶＥＲ-LOG-This-Password-9274  ";
  const normalizedPassword = password.normalize("NFKC").trim();
  const logged = [];
  const original = {
    log: console.log,
    warn: console.warn,
    error: console.error
  };
  console.log = (...values) => logged.push(values.join(" "));
  console.warn = (...values) => logged.push(values.join(" "));
  console.error = (...values) => logged.push(values.join(" "));
  try {
    const result = await join(harness, { type: "private", password });
    assert.equal(result.response.status, 200);
    assert.equal(result.text.includes(password), false);
    assert.equal(result.text.includes(normalizedPassword), false);
    assert.equal(result.payload.wsUrl.includes(password), false);
    assert.equal(result.payload.wsUrl.includes(normalizedPassword), false);
    assert.equal(JSON.stringify(logged).includes(password), false);
    assert.equal(JSON.stringify(logged).includes(normalizedPassword), false);

    const persisted = [
      ...harness.DB.sqlite.prepare("select * from whiteboard_rooms").all(),
      ...harness.DB.sqlite.prepare("select * from api_rate_limits").all()
    ];
    const persistedText = JSON.stringify(persisted);
    assert.equal(persistedText.includes(password), false);
    assert.equal(persistedText.includes(normalizedPassword), false);
  } finally {
    console.log = original.log;
    console.warn = original.warn;
    console.error = original.error;
  }
});

test("forged and expired access tokens and WebSocket tickets are rejected before the DO", async (t) => {
  const harness = createHarness();
  t.after(() => harness.close());
  const password = "token-test-room";
  const joined = await join(harness, { type: "private", password });
  assert.equal(joined.response.status, 200);
  const roomId = await derivePrivateWhiteboardRoomId(password, ROOM_SECRET);
  const identity = identityRow(harness);
  const now = Math.floor(Date.now() / 1000);

  const forgedAccess = await callApi(harness, "whiteboard/rooms/reconnect", {
    method: "POST",
    cookie: joined.cookie,
    json: { accessToken: tamperToken(joined.payload.accessToken) }
  });
  assert.equal(forgedAccess.status, 401);
  assert.equal((await forgedAccess.json()).code, "WHITEBOARD_ACCESS_DENIED");

  const expiredAccess = await signWhiteboardToken(tokenClaims({
    kind: "access",
    roomId,
    anonymousId: identity.anonymous_id,
    identityVersion: identity.identity_version,
    issuedAt: now - 120,
    expiresAt: now - 1
  }), TICKET_SECRET);
  const expiredReconnect = await callApi(harness, "whiteboard/rooms/reconnect", {
    method: "POST",
    cookie: joined.cookie,
    json: { accessToken: expiredAccess }
  });
  assert.equal(expiredReconnect.status, 401);

  const forgedTicket = await callApi(harness, "whiteboard/realtime", {
    cookie: joined.cookie,
    headers: {
      Upgrade: "websocket",
      "Sec-WebSocket-Protocol": `whiteboard.v1, ${tamperToken(joined.payload.ticket)}`
    }
  });
  assert.equal(forgedTicket.status, 401);

  const expiredTicketValue = await signWhiteboardToken(tokenClaims({
    kind: "ws",
    roomId,
    anonymousId: identity.anonymous_id,
    identityVersion: identity.identity_version,
    issuedAt: now - 60,
    expiresAt: now - 1
  }), TICKET_SECRET);
  const expiredTicket = await callApi(harness, "whiteboard/realtime", {
    cookie: joined.cookie,
    headers: {
      Upgrade: "websocket",
      "Sec-WebSocket-Protocol": `whiteboard.v1, ${expiredTicketValue}`
    }
  });
  assert.equal(expiredTicket.status, 401);
  assert.equal(harness.WHITEBOARD_ROOMS.requestedNames.length, 0);
});

test("exact Origin and the two-part WebSocket subprotocol are mandatory", async (t) => {
  const harness = createHarness();
  t.after(() => harness.close());

  const missingOrigin = await callApi(harness, "whiteboard/rooms/join", {
    method: "POST",
    includeOrigin: false,
    json: { type: "public" }
  });
  assert.equal(missingOrigin.status, 403);
  assert.equal((await missingOrigin.json()).code, "WHITEBOARD_ORIGIN_REJECTED");

  const crossOrigin = await callApi(harness, "whiteboard/rooms/join", {
    method: "POST",
    origin: "https://attacker.example",
    json: { type: "public" }
  });
  assert.equal(crossOrigin.status, 403);

  const joined = await join(harness, { type: "public" });
  const withoutWsOrigin = await callApi(harness, "whiteboard/realtime", {
    cookie: joined.cookie,
    includeOrigin: false,
    headers: {
      Upgrade: "websocket",
      "Sec-WebSocket-Protocol": `whiteboard.v1, ${joined.payload.ticket}`
    }
  });
  assert.equal(withoutWsOrigin.status, 403);

  const missingTicket = await callApi(harness, "whiteboard/realtime", {
    cookie: joined.cookie,
    headers: {
      Upgrade: "websocket",
      "Sec-WebSocket-Protocol": "whiteboard.v1"
    }
  });
  assert.equal(missingTicket.status, 401);

  const extraProtocol = await callApi(harness, "whiteboard/realtime", {
    cookie: joined.cookie,
    headers: {
      Upgrade: "websocket",
      "Sec-WebSocket-Protocol": `whiteboard.v1, ${joined.payload.ticket}, other.v1`
    }
  });
  assert.equal(extraProtocol.status, 401);
  assert.deepEqual(
    parseWhiteboardProtocols(`whiteboard.v1, ${joined.payload.ticket}`),
    { protocol: "whiteboard.v1", ticket: joined.payload.ticket }
  );
  assert.equal(harness.WHITEBOARD_ROOMS.requestedNames.length, 0);
});

test("asset access is bound to the token room and strips client credentials before proxying", async (t) => {
  const harness = createHarness();
  t.after(() => harness.close());
  const roomAPassword = "asset-room-alpha";
  const roomBPassword = "asset-room-bravo";
  const roomAId = await derivePrivateWhiteboardRoomId(roomAPassword, ROOM_SECRET);
  const roomBId = await derivePrivateWhiteboardRoomId(roomBPassword, ROOM_SECRET);
  const assetId = "asset_sharedidentifier001";
  const imageBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
  harness.WHITEBOARD_ROOMS.room(roomBId).assets.set(assetId, imageBytes);
  harness.WHITEBOARD_ROOMS.requestedNames.length = 0;

  const roomA = await join(harness, {
    type: "private",
    password: roomAPassword
  });
  const roomB = await join(
    harness,
    { type: "private", password: roomBPassword },
    { cookie: roomA.cookie }
  );

  const denied = await callApi(
    harness,
    `whiteboard/assets/${assetId}`,
    {
      cookie: roomA.cookie,
      headers: {
        Authorization: `Bearer ${roomA.payload.accessToken}`,
        "X-Whiteboard-Access-Token": roomA.payload.accessToken
      }
    }
  );
  assert.equal(denied.status, 404, await denied.clone().text());

  const allowed = await callApi(
    harness,
    `whiteboard/assets/${assetId}`,
    {
      cookie: roomA.cookie,
      headers: {
        Authorization: `Bearer ${roomB.payload.accessToken}`
      }
    }
  );
  assert.equal(allowed.status, 200);
  assert.deepEqual(new Uint8Array(await allowed.arrayBuffer()), imageBytes);
  assert.deepEqual(
    harness.WHITEBOARD_ROOMS.requestedNames,
    [roomAId, roomBId]
  );

  const firstCall = harness.WHITEBOARD_ROOMS.rooms.get(roomAId).calls[0];
  assert.equal(firstCall.headers["x-whiteboard-room-id"], roomAId);
  assert.equal(firstCall.headers.authorization, undefined);
  assert.equal(firstCall.headers.cookie, undefined);
  assert.equal(firstCall.headers["x-whiteboard-access-token"], undefined);
  assert.equal(firstCall.url.includes(roomA.payload.accessToken), false);
  assert.equal(firstCall.url.includes(roomB.payload.accessToken), false);
  assert.equal(firstCall.headers["x-whiteboard-internal-secret"], INTERNAL_SECRET);
  assert.equal(firstCall.headers["x-whiteboard-display-name"], undefined);
  assert.equal(
    decodeBase64UrlUtf8(firstCall.headers["x-whiteboard-display-name-b64"]),
    roomA.payload.identity.displayName
  );
});

test("asset uploads enforce persistent per-IP request and byte budgets before reaching the room", async (t) => {
  const harness = createHarness();
  t.after(() => harness.close());
  const ip = "198.51.100.89";
  const joined = await join(
    harness,
    { type: "public" },
    { ip }
  );
  assert.equal(joined.response.status, 200);

  const fiveMiB = new Uint8Array(5 * 1024 * 1024);
  for (let count = 0; count < 10; count += 1) {
    const uploaded = await callApi(harness, "whiteboard/assets", {
      method: "POST",
      body: fiveMiB,
      cookie: joined.cookie,
      ip,
      headers: {
        Authorization: `Bearer ${joined.payload.accessToken}`,
        "Content-Type": "image/png"
      }
    });
    assert.equal(uploaded.status, 201, await uploaded.clone().text());
  }

  const blocked = await callApi(harness, "whiteboard/assets", {
    method: "POST",
    body: fiveMiB,
    cookie: joined.cookie,
    ip,
    headers: {
      Authorization: `Bearer ${joined.payload.accessToken}`,
      "Content-Type": "image/png"
    }
  });
  assert.equal(blocked.status, 429);
  assert.equal((await blocked.json()).code, "WHITEBOARD_UPLOAD_RATE_LIMITED");
  assert.ok(Number(blocked.headers.get("Retry-After")) >= 1);

  const room = harness.WHITEBOARD_ROOMS.rooms.get("public-v1");
  const uploads = room.calls.filter(
    (call) => call.method === "POST" && new URL(call.url).pathname === "/assets"
  );
  assert.equal(uploads.length, 10);
  assert.ok(uploads.every((call) => call.bodyByteLength === fiveMiB.byteLength));

  const persisted = JSON.stringify(
    harness.DB.sqlite.prepare(`
      select bucket_key, request_count
      from api_rate_limits
      order by request_count desc
    `).all()
  );
  assert.equal(persisted.includes(ip), false);
  assert.match(persisted, /rl_[a-f0-9]{64}/);
  assert.ok(
    harness.DB.sqlite.prepare(`
      select max(request_count) as count
      from api_rate_limits
    `).get().count > 50 * 1024 * 1024
  );
});

test("private-room attempts use persistent per-IP limits without storing the raw IP", async (t) => {
  const harness = createHarness();
  t.after(() => harness.close());
  const ip = "198.51.100.77";
  let cookie = "";

  for (let count = 0; count < 8; count += 1) {
    const result = await join(
      harness,
      { type: "private", password: "rate-limited-room" },
      { cookie, ip }
    );
    assert.equal(result.response.status, 200);
    cookie = result.cookie;
  }

  const blocked = await join(
    harness,
    { type: "private", password: "rate-limited-room" },
    { cookie, ip }
  );
  assert.equal(blocked.response.status, 429);
  assert.equal(blocked.payload.code, "WHITEBOARD_JOIN_RATE_LIMITED");
  assert.ok(Number(blocked.response.headers.get("Retry-After")) >= 1);

  const buckets = harness.DB.sqlite.prepare(`
    select bucket_key, request_count
    from api_rate_limits
    order by bucket_key
  `).all();
  assert.equal(buckets.length, 2);
  assert.equal(JSON.stringify(buckets).includes(ip), false);
  assert.ok(buckets.every((row) => /^rl_[a-f0-9]{64}$/.test(row.bucket_key)));

  const independentIp = await join(
    harness,
    { type: "private", password: "rate-limited-room" },
    { cookie, ip: "198.51.100.78" }
  );
  assert.equal(independentIp.response.status, 200);
});

test("admin routes require the server-side capability and ignore spoofed client headers", async (t) => {
  const harness = createHarness();
  t.after(() => harness.close());

  const spoofed = await callApi(harness, "admin/whiteboards/overview", {
    headers: {
      "X-Whiteboard-Admin-Authorized": "1",
      Cookie: "lusu_session=forged"
    }
  });
  assert.equal(spoofed.status, 403);
  assert.equal((await spoofed.json()).code, "WHITEBOARD_ADMIN_REQUIRED");

  const overview = await callApi(harness, "admin/whiteboards/overview", {
    options: { isAdmin: true, adminUser: { id: "admin_1" } }
  });
  assert.equal(overview.status, 200);
  assert.equal((await overview.json()).summary.roomCount, 0);

  const now = new Date().toISOString();
  harness.DB.sqlite.prepare(`
    insert into whiteboard_rooms (
      room_id, room_type, created_at, last_active_at, online_count,
      document_version, snapshot_version, is_locked, resource_usage,
      resource_bytes, resource_count, object_count, status, epoch,
      updated_at, last_error
    ) values (?, 'private', ?, ?, 0, 2, 1, 0, ?, 1024, 1, 3, 'empty', 1, ?, ?)
  `).run(
    `wb_${"e".repeat(43)}`,
    now,
    now,
    '{"bytes":1024,"images":1}',
    now,
    "room_cleanup_failed"
  );
  harness.DB.sqlite.prepare(`
    insert into whiteboard_metrics (metric_key, metric_value, updated_at)
    values ('error_count', 4, ?), ('cleaned_room_count', 7, ?)
  `).run(now, now);
  const measuredOverview = await callApi(
    harness,
    "admin/whiteboards/overview",
    { options: { isAdmin: true, adminUser: { id: "admin_1" } } }
  );
  const measuredSummary = (await measuredOverview.json()).summary;
  assert.equal(measuredSummary.errorRoomCount, 1);
  assert.equal(measuredSummary.errorCount, 4);
  assert.equal(measuredSummary.cleanedRoomCount, 7);
  assert.equal(measuredSummary.resourceBytes, 1024);

  const rejectedOrigin = await callApi(
    harness,
    "admin/whiteboards/public/clear",
    {
      method: "POST",
      origin: "https://attacker.example",
      options: { isAdmin: true, adminUser: { id: "admin_1" } }
    }
  );
  assert.equal(rejectedOrigin.status, 403);
  assert.equal(harness.WHITEBOARD_ROOMS.requestedNames.length, 0);

  const cleared = await callApi(
    harness,
    "admin/whiteboards/public/clear",
    {
      method: "POST",
      headers: {
        Cookie: "lusu_session=server-validated-session",
        "X-Whiteboard-Internal-Secret": "client-spoof"
      },
      options: { isAdmin: true, adminUser: { id: "admin_1" } }
    }
  );
  assert.equal(cleared.status, 200);
  const clearPayload = await cleared.json();
  assert.equal(clearPayload.action, "clear");
  const call = harness.WHITEBOARD_ROOMS.rooms.get("public-v1").calls[0];
  assert.equal(call.headers["x-whiteboard-admin-authorized"], "1");
  assert.equal(call.headers["x-whiteboard-admin-user-id"], "admin_1");
  assert.equal(call.headers["x-whiteboard-internal-secret"], INTERNAL_SECRET);
  assert.equal(call.headers.cookie, undefined);

  const audit = harness.DB.sqlite.prepare(`
    select action, room_id, admin_user_id
    from whiteboard_admin_audit
  `).get();
  assert.deepEqual({ ...audit }, {
    action: "public-clear",
    room_id: "public-v1",
    admin_user_id: "admin_1"
  });
});

test("admin bans are idempotent across active and expired re-bans", async (t) => {
  const harness = createHarness();
  t.after(() => harness.close());
  const joined = await join(harness, { type: "public" });
  assert.equal(joined.response.status, 200);
  const anonymousId = "anonymous_target_identifier_0001";
  const adminOptions = {
    isAdmin: true,
    adminUser: { id: "admin_1" }
  };

  for (const [reason, durationSeconds] of [
    ["first", 60],
    ["extended", 120]
  ]) {
    const response = await callApi(
      harness,
      "admin/whiteboards/rooms/public-v1/ban",
      {
        method: "POST",
        json: {
          kind: "anonymousId",
          key: anonymousId,
          durationSeconds,
          reason
        },
        options: adminOptions
      }
    );
    assert.equal(response.status, 200, await response.clone().text());
  }

  harness.DB.sqlite.prepare(`
    update whiteboard_bans
    set expires_at = '2000-01-01T00:00:00.000Z', active = 1
    where room_id = ? and subject_type = 'anonymous_id' and subject_value = ?
  `).run("public-v1", anonymousId);
  const rebound = await callApi(
    harness,
    "admin/whiteboards/rooms/public-v1/ban",
    {
      method: "POST",
      json: {
        kind: "anonymousId",
        key: anonymousId,
        durationSeconds: 180,
        reason: "rebound"
      },
      options: adminOptions
    }
  );
  assert.equal(rebound.status, 200, await rebound.clone().text());

  const rows = harness.DB.sqlite.prepare(`
    select reason, expires_at, active
    from whiteboard_bans
    where room_id = ? and subject_type = 'anonymous_id' and subject_value = ?
  `).all("public-v1", anonymousId);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].reason, "rebound");
  assert.equal(rows[0].active, 1);
  assert.ok(Date.parse(rows[0].expires_at) > Date.now());
  assert.equal(
    harness.WHITEBOARD_ROOMS.rooms.get("public-v1").calls
      .filter((call) => new URL(call.url).pathname === "/admin").length,
    3
  );
});

test("a D1 index failure cannot prevent the Durable Object from enforcing a ban", async (t) => {
  const harness = createHarness();
  t.after(() => harness.close());
  const joined = await join(harness, { type: "public" });
  assert.equal(joined.response.status, 200);

  const originalBatch = harness.DB.batch.bind(harness.DB);
  harness.DB.batch = async (statements) => {
    if (statements.some((statement) => /\binsert\s+into\s+whiteboard_bans\b/i.test(statement.sql))) {
      throw new Error("simulated D1 write failure");
    }
    return originalBatch(statements);
  };

  const response = await callApi(
    harness,
    "admin/whiteboards/rooms/public-v1/ban",
    {
      method: "POST",
      json: {
        kind: "anonymousId",
        key: "anonymous_target_identifier_0002",
        durationSeconds: 60
      },
      options: { isAdmin: true, adminUser: { id: "admin_1" } }
    }
  );
  assert.equal(response.status, 500);
  assert.equal(harness.WHITEBOARD_ROOMS.requestedNames.length, 1);
  assert.equal(
    harness.WHITEBOARD_ROOMS.rooms.get("public-v1").calls
      .filter((call) => (
        new URL(call.url).pathname === "/admin"
        && JSON.parse(call.body || "{}").action === "ban"
      )).length,
    1
  );
  assert.equal(
    harness.DB.sqlite.prepare("select count(*) as count from whiteboard_bans").get().count,
    0
  );
});

test("deleting a private room deactivates its D1 bans", async (t) => {
  const harness = createHarness();
  t.after(() => harness.close());
  const password = "delete-room-ban-cleanup";
  const joined = await join(harness, { type: "private", password });
  assert.equal(joined.response.status, 200);
  const roomId = await derivePrivateWhiteboardRoomId(password, ROOM_SECRET);
  const now = new Date().toISOString();
  harness.DB.sqlite.prepare(`
    insert into whiteboard_rooms (
      room_id, room_type, created_at, last_active_at, empty_since, delete_at,
      online_count, document_version, snapshot_version, is_locked,
      resource_usage, resource_bytes, resource_count, object_count,
      status, epoch, updated_at, last_error
    ) values (?, 'private', ?, ?, ?, ?, 0, 0, 0, 0, ?, 0, 0, 0, 'empty', 1, ?, '')
  `).run(
    roomId,
    now,
    now,
    now,
    new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    '{"bytes":0,"images":0}',
    now
  );
  harness.DB.sqlite.prepare(`
    insert into whiteboard_bans (
      ban_id, room_id, subject_type, subject_value, reason, expires_at,
      active, created_by, created_at, updated_at
    ) values (?, ?, 'anonymous_id', ?, '', ?, 1, 'admin_1', ?, ?)
  `).run(
    "wban_delete_cleanup_1",
    roomId,
    "anonymous_target_identifier_0003",
    new Date(Date.now() + 60_000).toISOString(),
    now,
    now
  );

  const response = await callApi(
    harness,
    `admin/whiteboards/rooms/${roomId}`,
    {
      method: "DELETE",
      options: { isAdmin: true, adminUser: { id: "admin_1" } }
    }
  );
  assert.equal(response.status, 200, await response.clone().text());
  assert.deepEqual(
    {
      ...harness.DB.sqlite.prepare(`
        select r.status, b.active
        from whiteboard_rooms r
        join whiteboard_bans b on b.room_id = r.room_id
        where r.room_id = ?
      `).get(roomId)
    },
    { status: "deleting", active: 0 }
  );
});
