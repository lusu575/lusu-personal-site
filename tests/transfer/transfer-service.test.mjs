import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { handleTransferApi, runTransferCleanup, transferInternals } from "../../functions/api/transfer-service.mjs";

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

  exec(sql) {
    this.sqlite.exec(sql);
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

class R2Mock {
  constructor() {
    this.objects = new Map();
    this.uploads = new Map();
    this.failDeleteKeys = new Set();
    this.onPut = null;
    this.onMultipartComplete = null;
  }

  async put(key, body, metadata = {}) {
    const bytes = new Uint8Array(await new Response(body).arrayBuffer());
    const object = {
      key,
      bytes,
      size: bytes.byteLength,
      etag: `etag-${key}-${bytes.byteLength}`,
      httpMetadata: metadata.httpMetadata || {},
      uploaded: new Date()
    };
    this.objects.set(key, object);
    await this.onPut?.(object, metadata);
    return object;
  }

  async head(key) {
    return this.objects.get(key) || null;
  }

  async get(key, options = {}) {
    const object = this.objects.get(key);
    if (!object) return null;
    const range = options.range;
    const bytes = range
      ? object.bytes.slice(range.offset, range.offset + range.length)
      : object.bytes;
    return { ...object, body: new Response(bytes).body };
  }

  async delete(key) {
    if (this.failDeleteKeys.has(key)) {
      throw new Error("simulated R2 delete failure");
    }
    this.objects.delete(key);
  }

  async list() {
    return { objects: [...this.objects.values()] };
  }

  async createMultipartUpload(key, metadata = {}) {
    const uploadId = crypto.randomUUID();
    this.uploads.set(uploadId, { key, metadata, parts: new Map(), expectedSize: 0, aborted: false });
    return this.resumeMultipartUpload(key, uploadId);
  }

  resumeMultipartUpload(key, uploadId) {
    const bucket = this;
    const upload = this.uploads.get(uploadId);
    if (!upload || upload.key !== key) {
      throw new Error("multipart upload not found");
    }
    return {
      uploadId,
      uploadPart: async (partNumber, body) => {
        await body?.cancel?.().catch(() => {});
        const etag = `part-${partNumber}`;
        upload.parts.set(partNumber, etag);
        return { partNumber, etag };
      },
      complete: async (parts) => {
        assert.equal(parts.length, upload.parts.size);
        const object = {
          key,
          bytes: new Uint8Array(0),
          size: upload.expectedSize,
          etag: `multipart-${uploadId}`,
          httpMetadata: upload.metadata.httpMetadata || {},
          uploaded: new Date()
        };
        this.objects.set(key, object);
        await bucket.onMultipartComplete?.(object);
        return object;
      },
      abort: async () => {
        upload.aborted = true;
      }
    };
  }
}

const origin = "https://example.test";
const roomKey = `transfer_${"A".repeat(43)}`;
const userToken = "user-session-token";
const adminToken = "admin-session-token";
const db = new D1Mock();
const bucket = new R2Mock();
const env = { DB: db, TRANSFER_BUCKET: bucket };

db.exec(`
  create table users (
    id text primary key, email text not null unique, password_hash text not null,
    role text not null default 'user', created_at text not null, updated_at text not null
  );
  create table sessions (
    token_hash text primary key, user_id text not null references users(id) on delete cascade,
    created_at text not null, expires_at text not null
  );
  create table agent_access_tokens (
    token_id text primary key, token_hash text not null unique, token_hint text not null default '',
    user_id text not null references users(id) on delete cascade, client_name text not null,
    scopes text not null default '[]', created_at text not null, expires_at text not null,
    last_used_at text not null default '', revoked_at text not null default ''
  );
`);

const now = new Date().toISOString();
const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
db.sqlite.prepare("insert into users values (?, ?, '', ?, ?, ?)").run("user-1", "user@example.test", "user", now, now);
db.sqlite.prepare("insert into users values (?, ?, '', ?, ?, ?)").run("admin-1", "admin@example.test", "admin", now, now);
db.sqlite.prepare("insert into sessions values (?, ?, ?, ?)").run(await sha256Hex(userToken), "user-1", now, future);
db.sqlite.prepare("insert into sessions values (?, ?, ?, ?)").run(await sha256Hex(adminToken), "admin-1", now, future);
const agentToken = `lusu_agent_${"R".repeat(43)}`;
const adminAgentToken = `lusu_agent_${"A".repeat(43)}`;
const readOnlyAgentToken = `lusu_agent_${"Q".repeat(43)}`;
db.sqlite.prepare(`
  insert into agent_access_tokens (
    token_id, token_hash, token_hint, user_id, client_name, scopes,
    created_at, expires_at, last_used_at, revoked_at
  ) values (?, ?, ?, ?, ?, ?, ?, ?, '', '')
`).run(
  "agent-token-user",
  await sha256Hex(agentToken),
  agentToken.slice(-6),
  "user-1",
  "Transfer test agent",
  JSON.stringify(["transfer:read", "transfer:write"]),
  now,
  future
);
db.sqlite.prepare(`
  insert into agent_access_tokens (
    token_id, token_hash, token_hint, user_id, client_name, scopes,
    created_at, expires_at, last_used_at, revoked_at
  ) values (?, ?, ?, ?, ?, ?, ?, ?, '', '')
`).run(
  "agent-token-admin-account",
  await sha256Hex(adminAgentToken),
  adminAgentToken.slice(-6),
  "admin-1",
  "Admin account agent",
  JSON.stringify(["transfer:read", "transfer:write", "transfer:delete"]),
  now,
  future
);
db.sqlite.prepare(`
  insert into agent_access_tokens (
    token_id, token_hash, token_hint, user_id, client_name, scopes,
    created_at, expires_at, last_used_at, revoked_at
  ) values (?, ?, ?, ?, ?, ?, ?, ?, '', '')
`).run(
  "agent-token-read-only",
  await sha256Hex(readOnlyAgentToken),
  readOnlyAgentToken.slice(-6),
  "user-1",
  "Read-only transfer agent",
  JSON.stringify(["transfer:read"]),
  now,
  future
);

async function call(path, { method = "GET", token = "", body, headers = {}, includeOrigin = true, envOverride = env } = {}) {
  const requestHeaders = new Headers(headers);
  if (token) requestHeaders.set("Cookie", `lusu_session=${token}`);
  if (includeOrigin && method !== "GET" && method !== "HEAD") requestHeaders.set("Origin", origin);
  const request = new Request(`${origin}/api/${path}`, { method, headers: requestHeaders, body });
  const routeParts = new URL(request.url).pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  const waits = [];
  const response = await handleTransferApi({
    request,
    env: envOverride,
    waitUntil(promise) {
      waits.push(Promise.resolve(promise));
    }
  }, routeParts);
  await Promise.all(waits);
  return response;
}

function jsonBody(value) {
  return {
    body: JSON.stringify(value),
    headers: { "Content-Type": "application/json" }
  };
}

test("transfer endpoints require the existing HttpOnly session", async () => {
  const response = await call("transfer/config");
  assert.equal(response.status, 401);
  assert.equal((await response.json()).code, "TRANSFER_LOGIN_REQUIRED");
});

test("missing R2 keeps text rooms available but rejects file routes with a stable code", async () => {
  const envWithoutBucket = { DB: db };
  const config = await call("transfer/config", { token: userToken, envOverride: envWithoutBucket });
  assert.equal(config.status, 200);
  assert.equal((await config.json()).r2Ready, false);

  const upload = await call(`transfer/upload/simple?room=${roomKey}&filename=probe.txt&mime=text%2Fplain&size=1`, {
    method: "POST",
    token: userToken,
    body: new Uint8Array([1]),
    headers: { "Content-Type": "text/plain", "Content-Length": "1" },
    envOverride: envWithoutBucket
  });
  assert.equal(upload.status, 503);
  assert.equal((await upload.json()).code, "TRANSFER_R2_NOT_BOUND");
});

test("mutating endpoints enforce same-origin requests", async () => {
  const response = await call("transfer/room/join", {
    method: "POST",
    token: userToken,
    includeOrigin: false,
    ...jsonBody({ roomKey })
  });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, "TRANSFER_ORIGIN_REJECTED");
});

test("ordinary accounts cannot access transfer administration", async () => {
  const response = await call("admin/transfer/overview", { token: userToken });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, "TRANSFER_ADMIN_REQUIRED");
});

test("scoped agent tokens can use user routes without Origin but never inherit admin access", async () => {
  const authorization = { Authorization: `Bearer ${agentToken}` };
  const config = await call("transfer/config", { headers: authorization });
  assert.equal(config.status, 200);

  const joined = await call("transfer/room/join", {
    method: "POST",
    includeOrigin: false,
    headers: { ...authorization, "Content-Type": "application/json" },
    body: JSON.stringify({ roomKey })
  });
  assert.equal(joined.status, 200);

  const crossOrigin = await call("transfer/room/join", {
    method: "POST",
    includeOrigin: false,
    headers: {
      ...authorization,
      "Content-Type": "application/json",
      Origin: "https://attacker.example"
    },
    body: JSON.stringify({ roomKey })
  });
  assert.equal(crossOrigin.status, 403);
  assert.equal((await crossOrigin.json()).code, "TRANSFER_ORIGIN_REJECTED");

  const readOnlyJoin = await call("transfer/room/join", {
    method: "POST",
    includeOrigin: false,
    headers: {
      Authorization: `Bearer ${readOnlyAgentToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ roomKey })
  });
  assert.equal(readOnlyJoin.status, 403);
  assert.equal((await readOnlyJoin.json()).code, "AGENT_SCOPE_REQUIRED");

  const readOnlyAbort = await call("transfer/upload/abort", {
    method: "POST",
    includeOrigin: false,
    headers: {
      Authorization: `Bearer ${readOnlyAgentToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ roomKey, sessionId: "session-not-used" })
  });
  assert.equal(readOnlyAbort.status, 403);
  assert.equal((await readOnlyAbort.json()).code, "AGENT_SCOPE_REQUIRED");

  const missingDeleteScope = await call("transfer/items/not-found", {
    method: "DELETE",
    includeOrigin: false,
    headers: authorization
  });
  assert.equal(missingDeleteScope.status, 403);
  assert.equal((await missingDeleteScope.json()).code, "AGENT_SCOPE_REQUIRED");

  const adminRoute = await call("admin/transfer/overview", {
    headers: { Authorization: `Bearer ${adminAgentToken}` }
  });
  assert.equal(adminRoute.status, 401);
  assert.equal((await adminRoute.json()).code, "TRANSFER_ADMIN_BROWSER_SESSION_REQUIRED");

  const malformedBearerWithCookie = await call("transfer/config", {
    token: userToken,
    headers: { Authorization: "Bearer malformed" }
  });
  assert.equal(malformedBearerWithCookie.status, 401);
  assert.equal((await malformedBearerWithCookie.json()).code, "TRANSFER_AGENT_AUTHORIZATION_INVALID");
});

test("transfer settings use an expectedUpdatedAt revision and reject stale admin tabs", async () => {
  const loaded = await call("admin/transfer/settings", { token: adminToken });
  assert.equal(loaded.status, 200);
  const baseline = (await loaded.json()).settings;
  assert.match(baseline.updatedAt, /^\d{4}-\d{2}-\d{2}T/);

  const saved = await call("admin/transfer/settings", {
    method: "PUT",
    token: adminToken,
    ...jsonBody({
      normal_user_daily_files: 42,
      expectedUpdatedAt: baseline.updatedAt
    })
  });
  assert.equal(saved.status, 200);
  const current = (await saved.json()).settings;
  assert.equal(current.normalUserDailyFiles, 42);
  assert.notEqual(current.updatedAt, baseline.updatedAt);

  const stale = await call("admin/transfer/settings", {
    method: "PUT",
    token: adminToken,
    ...jsonBody({
      normal_user_daily_files: 77,
      expectedUpdatedAt: baseline.updatedAt
    })
  });
  assert.equal(stale.status, 409);
  assert.equal((await stale.json()).code, "TRANSFER_SETTINGS_CONFLICT");

  const reloaded = await call("admin/transfer/settings", { token: adminToken });
  assert.equal((await reloaded.json()).settings.normalUserDailyFiles, 42);
});

test("admins can page stored files with sender and expiry metadata, then delete the R2 object", async () => {
  await call("transfer/config", { token: adminToken });
  const adminRoomKey = `transfer_${"M".repeat(43)}`;
  const roomId = "admin-room-file-manager-0001";
  const itemId = "admin-file-manager-item-0001";
  const secondItemId = "admin-file-manager-item-0002";
  const objectKey = "transfer/2099-01-01/admin-file-manager-item-0001";
  const secondObjectKey = "transfer/2099-01-01/admin-file-manager-item-0002";
  const createdAt = "2026-07-19T01:02:03.000Z";
  const secondCreatedAt = "2026-07-19T01:02:04.000Z";
  const expiresAt = "2099-07-20T01:02:03.000Z";
  db.sqlite.prepare(`
    insert into transfer_rooms (id, room_key, created_by, status, created_at, last_activity_at)
    values (?, ?, 'user-1', 'open', ?, ?)
  `).run(roomId, adminRoomKey, createdAt, createdAt);
  await bucket.put(objectKey, new TextEncoder().encode("managed-file"));
  await bucket.put(secondObjectKey, new TextEncoder().encode("managed-file-2"));
  const insertManagedItem = db.sqlite.prepare(`
    insert into transfer_items (
      id, room_id, uploader_user_id, uploader_role_snapshot, item_type, original_filename,
      display_filename, r2_object_key, mime_type, size_bytes, upload_mode, upload_status,
      created_at, completed_at, expires_at
    ) values (?, ?, 'user-1', 'user', 'file', ?, ?, ?, 'text/plain', 12, 'simple', 'ready', ?, ?, ?)
  `);
  insertManagedItem.run(itemId, roomId, "managed-one.txt", "managed-one.txt", objectKey, createdAt, createdAt, expiresAt);
  insertManagedItem.run(secondItemId, roomId, "managed-two.txt", "managed-two.txt", secondObjectKey, secondCreatedAt, secondCreatedAt, expiresAt);

  const listed = await call("admin/transfer/items?limit=1&offset=0&search=managed", { token: adminToken });
  assert.equal(listed.status, 200);
  const listedPayload = await listed.json();
  assert.equal(listedPayload.pagination.total, 2);
  assert.equal(listedPayload.pagination.offset, 0);
  assert.equal(listedPayload.pagination.hasNext, true);
  assert.deepEqual(listedPayload.items.map((item) => ({
    id: item.id,
    sender: item.uploader_email,
    createdAt: item.created_at,
    expiresAt: item.expires_at
  })), [{
    id: secondItemId,
    sender: "user@example.test",
    createdAt: secondCreatedAt,
    expiresAt
  }]);

  const nextPage = await call("admin/transfer/items?limit=1&offset=1&search=managed", { token: adminToken });
  const nextPagePayload = await nextPage.json();
  assert.equal(nextPagePayload.pagination.offset, 1);
  assert.equal(nextPagePayload.pagination.hasPrevious, true);
  assert.deepEqual(nextPagePayload.items.map((item) => item.id), [itemId]);

  const removed = await call(`admin/transfer/item/${itemId}`, { method: "DELETE", token: adminToken });
  assert.equal(removed.status, 200);
  assert.equal(await bucket.head(objectKey), null);
  assert.equal(db.sqlite.prepare("select id from transfer_items where id = ?").get(itemId), undefined);
  const removedSecond = await call(`admin/transfer/item/${secondItemId}`, { method: "DELETE", token: adminToken });
  assert.equal(removedSecond.status, 200);
  assert.equal(await bucket.head(secondObjectKey), null);
});

test("room clear reports partial failure as non-2xx and preserves retryable objects", async () => {
  const adminRoomKey = `transfer_${"Q".repeat(43)}`;
  const roomId = "admin-room-partial-clear-0001";
  const failedItemId = "admin-partial-item-failed-0001";
  const deletedItemId = "admin-partial-item-deleted-0001";
  const failedKey = "transfer/2099-01-01/admin-partial-item-failed-0001";
  const deletedKey = "transfer/2099-01-01/admin-partial-item-deleted-0001";
  const createdAt = "2026-07-20T01:02:03.000Z";
  const expiresAt = "2099-07-20T01:02:03.000Z";
  db.sqlite.prepare(`
    insert into transfer_rooms (id, room_key, created_by, status, created_at, last_activity_at)
    values (?, ?, 'user-1', 'open', ?, ?)
  `).run(roomId, adminRoomKey, createdAt, createdAt);
  await bucket.put(failedKey, new Uint8Array([1]));
  await bucket.put(deletedKey, new Uint8Array([2]));
  const insert = db.sqlite.prepare(`
    insert into transfer_items (
      id, room_id, uploader_user_id, uploader_role_snapshot, item_type, original_filename,
      display_filename, r2_object_key, mime_type, size_bytes, upload_mode, upload_status,
      created_at, completed_at, expires_at
    ) values (?, ?, 'user-1', 'user', 'file', ?, ?, ?, 'application/octet-stream', 1, 'simple', 'ready', ?, ?, ?)
  `);
  insert.run(failedItemId, roomId, "failed.bin", "failed.bin", failedKey, createdAt, createdAt, expiresAt);
  insert.run(deletedItemId, roomId, "deleted.bin", "deleted.bin", deletedKey, createdAt, createdAt, expiresAt);
  bucket.failDeleteKeys.add(failedKey);

  const response = await call(`admin/transfer/room/${roomId}/clear`, {
    method: "POST",
    token: adminToken,
    ...jsonBody({})
  });
  bucket.failDeleteKeys.delete(failedKey);
  assert.equal(response.status, 502);
  const payload = await response.json();
  assert.equal(payload.ok, false);
  assert.equal(payload.status, "partial");
  assert.equal(payload.deleted, 1);
  assert.equal(payload.failed, 1);
  assert.deepEqual(payload.failures.map((failure) => failure.id), [failedItemId]);
  assert.equal(
    db.sqlite.prepare("select upload_status from transfer_items where id = ?").get(failedItemId).upload_status,
    "delete_failed"
  );
  assert.equal(db.sqlite.prepare("select id from transfer_items where id = ?").get(deletedItemId), undefined);

  const retry = await call(`admin/transfer/room/${roomId}/clear`, {
    method: "POST",
    token: adminToken,
    ...jsonBody({})
  });
  assert.equal(retry.status, 200);
  assert.equal((await retry.json()).failed, 0);
  assert.equal(db.sqlite.prepare("select id from transfer_items where id = ?").get(failedItemId), undefined);
});

test("a logged-in user can join a room and send encrypted text", async () => {
  const joined = await call("transfer/room/join", {
    method: "POST",
    token: userToken,
    ...jsonBody({ roomKey })
  });
  assert.equal(joined.status, 200);

  const sent = await call("transfer/text", {
    method: "POST",
    token: userToken,
    ...jsonBody({ roomKey, encryptedContent: "YWJj.ZGVm" })
  });
  assert.equal(sent.status, 201);
  const sentBody = await sent.json();
  assert.equal(sentBody.item.encrypted, true);
  assert.equal(sentBody.item.encryptedContent, "YWJj.ZGVm");
  assert.equal(sentBody.item.canDelete, true);
  assert.equal("uploaderUserId" in sentBody.item, false);

  const config = await call("transfer/config", { token: userToken });
  const configBody = await config.json();
  assert.equal(configBody.user.role, "user");
  assert.equal("id" in configBody.user, false);
});

test("text idempotency replays the original item without duplicates", async () => {
  const idempotencyKey = "text-idempotency-0001";
  const request = {
    method: "POST",
    token: userToken,
    ...jsonBody({ roomKey, encryptedContent: "YWJj.ZGVm", idempotencyKey })
  };
  const first = await call("transfer/text", request);
  const replay = await call("transfer/text", request);
  assert.equal(first.status, 201);
  assert.equal(replay.status, 201);
  const firstItem = (await first.json()).item;
  const replayItem = (await replay.json()).item;
  assert.equal(replayItem.id, firstItem.id);
  const count = db.sqlite.prepare("select count(*) as count from transfer_items where idempotency_key = ?").get(idempotencyKey);
  assert.equal(Number(count.count), 1);
});

test("cursor sync pages 500 items once, then returns only deltas and explicit deletion reset", async () => {
  await call("transfer/config", { token: userToken });
  const bulkRoomKey = `transfer_${"B".repeat(43)}`;
  const roomId = "room-bulk-cursor-0001";
  const createdAt = "2026-07-18T01:00:00.000Z";
  const expiresAt = "2099-07-19T01:00:00.000Z";
  db.sqlite.prepare(`
    insert into transfer_rooms (id, room_key, created_by, status, created_at, last_activity_at)
    values (?, ?, 'user-1', 'open', ?, ?)
  `).run(roomId, bulkRoomKey, createdAt, createdAt);
  const insert = db.sqlite.prepare(`
    insert into transfer_items (
      id, room_id, uploader_user_id, uploader_role_snapshot, item_type, encrypted,
      text_ciphertext, upload_mode, upload_status, created_at, completed_at, expires_at
    ) values (?, ?, 'user-1', 'user', 'text', 1, 'YWJj.ZGVm', 'text', 'ready', ?, ?, ?)
  `);
  for (let index = 0; index < 500; index += 1) {
    insert.run(`bulk-item-${String(index).padStart(6, "0")}`, roomId, createdAt, createdAt, expiresAt);
  }
  let cursor = "";
  let total = 0;
  let requestCount = 0;
  do {
    const response = await call(`transfer/room/items?room=${bulkRoomKey}&limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`, { token: userToken });
    const payload = await response.json();
    assert.equal(response.status, 200);
    total += payload.items.length;
    requestCount += 1;
    cursor = payload.nextCursor;
    if (!payload.hasMore) break;
  } while (requestCount < 10);
  assert.equal(total, 500);
  assert.equal(requestCount, 5);

  insert.run("bulk-item-999999", roomId, "2026-07-18T01:00:01.000Z", "2026-07-18T01:00:01.000Z", expiresAt);
  const delta = await call(`transfer/room/items?room=${bulkRoomKey}&limit=100&cursor=${encodeURIComponent(cursor)}`, { token: userToken });
  const deltaPayload = await delta.json();
  assert.deepEqual(deltaPayload.items.map((item) => item.id), ["bulk-item-999999"]);
  assert.equal(deltaPayload.syncMode, "incremental");

  const expiredCursorPayload = JSON.parse(Buffer.from(deltaPayload.nextCursor, "base64url").toString("utf8"));
  expiredCursorPayload.validUntil = "2000-01-01T00:00:00.000Z";
  const expiredCursor = Buffer.from(JSON.stringify(expiredCursorPayload)).toString("base64url");
  const expiredReset = await call(`transfer/room/items?room=${bulkRoomKey}&limit=100&cursor=${encodeURIComponent(expiredCursor)}`, { token: userToken });
  const expiredResetPayload = await expiredReset.json();
  assert.equal(expiredResetPayload.resetRequired, true);
  assert.equal(expiredResetPayload.resetReason, "items-expired");

  const removed = await call(`transfer/item/bulk-item-000000?room=${bulkRoomKey}`, { method: "DELETE", token: userToken });
  assert.equal(removed.status, 200);
  const reset = await call(`transfer/room/items?room=${bulkRoomKey}&limit=100&cursor=${encodeURIComponent(deltaPayload.nextCursor)}`, { token: userToken });
  const resetPayload = await reset.json();
  assert.equal(resetPayload.resetRequired, true);
  assert.equal(resetPayload.resetReason, "items-removed");
  assert.deepEqual(resetPayload.items, []);
});

test("ordinary accounts cannot initialize multipart uploads", async () => {
  const response = await call("transfer/upload/init", {
    method: "POST",
    token: userToken,
    ...jsonBody({ roomKey, filename: "large.bin", mimeType: "application/octet-stream", sizeBytes: 500 * 1024 * 1024 })
  });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, "TRANSFER_MULTIPART_ADMIN_ONLY");
});

test("ordinary accounts are rejected above the 95 MiB request-safe limit", async () => {
  const size = 96 * 1024 * 1024;
  const response = await call(`transfer/upload/simple?room=${roomKey}&filename=too-large.bin&mime=application%2Foctet-stream&size=${size}`, {
    method: "POST",
    token: userToken,
    body: new Uint8Array([1]),
    headers: { "Content-Type": "application/octet-stream", "Content-Length": String(size) }
  });
  assert.equal(response.status, 413);
  assert.equal((await response.json()).code, "TRANSFER_NORMAL_FILE_LIMIT");
});

test("a small upload is private, downloadable, and supports a single byte range", async () => {
  const bytes = new TextEncoder().encode("temporary-transfer");
  const idempotencyKey = "simple-idempotency-0001";
  const upload = await call(`transfer/upload/simple?room=${roomKey}&filename=note.txt&mime=text%2Fplain&size=${bytes.byteLength}`, {
    method: "POST",
    token: userToken,
    body: bytes,
    headers: { "Content-Type": "text/plain", "Content-Length": String(bytes.byteLength), "Idempotency-Key": idempotencyKey }
  });
  assert.equal(upload.status, 201);
  const item = (await upload.json()).item;
  assert.equal(item.filename, "note.txt");

  const replay = await call(`transfer/upload/simple?room=${roomKey}&filename=note.txt&mime=text%2Fplain&size=${bytes.byteLength}`, {
    method: "POST",
    token: userToken,
    body: bytes,
    headers: { "Content-Type": "text/plain", "Content-Length": String(bytes.byteLength), "Idempotency-Key": idempotencyKey }
  });
  assert.equal(replay.status, 201);
  assert.equal((await replay.json()).item.id, item.id);
  assert.equal(Number(db.sqlite.prepare("select count(*) as count from transfer_items where idempotency_key = ?").get(idempotencyKey).count), 1);

  const ranged = await call(`transfer/file/${item.id}?room=${roomKey}`, {
    token: userToken,
    headers: { Range: "bytes=0-8" }
  });
  assert.equal(ranged.status, 206);
  assert.equal(ranged.headers.get("Content-Range"), `bytes 0-8/${bytes.byteLength}`);
  assert.equal(await ranged.text(), "temporary");
});

test("a simple upload deleted while R2 is writing never becomes ready and cleans the orphan object", async () => {
  const raceRoomKey = `transfer_${"R".repeat(43)}`;
  const joined = await call("transfer/room/join", {
    method: "POST",
    token: adminToken,
    ...jsonBody({ roomKey: raceRoomKey })
  });
  assert.equal(joined.status, 200);
  let writtenKey = "";
  bucket.onPut = async (object, metadata) => {
    const itemId = metadata.customMetadata?.transferItemId;
    if (!itemId) return;
    writtenKey = object.key;
    db.sqlite.prepare("delete from transfer_items where id = ?").run(itemId);
  };
  const uploadBytes = new TextEncoder().encode("race-cleanup");
  const response = await call(
    `transfer/upload/simple?room=${raceRoomKey}&filename=race.txt&mime=text%2Fplain&size=${uploadBytes.byteLength}`,
    {
      method: "POST",
      token: adminToken,
      body: uploadBytes,
      headers: {
        "Content-Type": "text/plain",
        "Content-Length": String(uploadBytes.byteLength),
        "Idempotency-Key": "simple-race-cleanup-0001"
      }
    }
  );
  bucket.onPut = null;
  assert.equal(response.status, 409);
  assert.equal((await response.json()).code, "TRANSFER_UPLOAD_CANCELLED");
  assert.ok(writtenKey);
  assert.equal(await bucket.head(writtenKey), null);
});

test("only a database admin can plan and resume simulated GiB multipart uploads", async () => {
  await call("transfer/room/join", {
    method: "POST",
    token: adminToken,
    ...jsonBody({ roomKey })
  });
  const declaredSize = 1024 * 1024 * 1024;
  const multipartIdempotencyKey = "multipart-idempotency-0001";
  const initialized = await call("transfer/upload/init", {
    method: "POST",
    token: adminToken,
    ...jsonBody({ roomKey, filename: "admin-video.mp4", mimeType: "video/mp4", sizeBytes: declaredSize, idempotencyKey: multipartIdempotencyKey })
  });
  assert.equal(initialized.status, 201);
  const task = await initialized.json();
  assert.equal(task.expectedParts, 32);
  assert.equal(task.partSizeBytes, 32 * 1024 * 1024);
  const replay = await call("transfer/upload/init", {
    method: "POST",
    token: adminToken,
    ...jsonBody({ roomKey, filename: "admin-video.mp4", mimeType: "video/mp4", sizeBytes: declaredSize, idempotencyKey: multipartIdempotencyKey })
  });
  const replayTask = await replay.json();
  assert.equal(replay.status, 201);
  assert.equal(replayTask.sessionId, task.sessionId);
  assert.equal(replayTask.idempotentReplay, true);

  const upload = [...bucket.uploads.values()].find((entry) => entry.key.includes(task.itemId));
  upload.expectedSize = declaredSize;
  for (let part = 1; part <= task.expectedParts; part += 1) {
    const response = await call(
      `transfer/upload/part?session=${task.sessionId}&room=${roomKey}&part=${part}&size=${task.partSizeBytes}`,
      {
        method: "PUT",
        token: adminToken,
        body: new Uint8Array([part]),
        headers: { "Content-Type": "application/octet-stream", "Content-Length": String(task.partSizeBytes) }
      }
    );
    assert.equal(response.status, 200);
  }

  const completed = await call("transfer/upload/complete", {
    method: "POST",
    token: adminToken,
    ...jsonBody({ roomKey, sessionId: task.sessionId })
  });
  assert.equal(completed.status, 200);
  assert.equal((await completed.json()).item.sizeBytes, declaredSize);

  const fiveGiB = await call("transfer/upload/init", {
    method: "POST",
    token: adminToken,
    ...jsonBody({ roomKey, filename: "archive.bin", mimeType: "application/octet-stream", sizeBytes: 5 * 1024 * 1024 * 1024 })
  });
  assert.equal(fiveGiB.status, 201);
  const fiveGiBTask = await fiveGiB.json();
  assert.equal(fiveGiBTask.partSizeBytes, 64 * 1024 * 1024);
  assert.equal(fiveGiBTask.expectedParts, 80);
});

test("a multipart item deleted during completion cannot leave a ready orphan in R2", async () => {
  const raceRoomKey = `transfer_${"S".repeat(43)}`;
  await call("transfer/room/join", {
    method: "POST",
    token: adminToken,
    ...jsonBody({ roomKey: raceRoomKey })
  });
  const declaredSize = 5 * 1024 * 1024;
  const initialized = await call("transfer/upload/init", {
    method: "POST",
    token: adminToken,
    ...jsonBody({
      roomKey: raceRoomKey,
      filename: "multipart-race.bin",
      mimeType: "application/octet-stream",
      sizeBytes: declaredSize,
      idempotencyKey: "multipart-race-cleanup-0001"
    })
  });
  assert.equal(initialized.status, 201);
  const task = await initialized.json();
  const upload = [...bucket.uploads.values()].find((entry) => entry.key.includes(task.itemId));
  upload.expectedSize = declaredSize;
  const part = await call(
    `transfer/upload/part?session=${task.sessionId}&room=${raceRoomKey}&part=1&size=${declaredSize}`,
    {
      method: "PUT",
      token: adminToken,
      body: new Uint8Array([1]),
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Length": String(declaredSize)
      }
    }
  );
  assert.equal(part.status, 200);
  let completedKey = "";
  bucket.onMultipartComplete = async (object) => {
    completedKey = object.key;
    db.sqlite.prepare("delete from transfer_items where id = ?").run(task.itemId);
  };
  const completed = await call("transfer/upload/complete", {
    method: "POST",
    token: adminToken,
    ...jsonBody({ roomKey: raceRoomKey, sessionId: task.sessionId })
  });
  bucket.onMultipartComplete = null;
  assert.equal(completed.status, 409);
  assert.equal((await completed.json()).code, "TRANSFER_UPLOAD_CANCELLED");
  assert.equal(await bucket.head(completedKey), null);
  assert.equal(db.sqlite.prepare("select id from transfer_items where id = ?").get(task.itemId), undefined);
});

test("multipart completion preserves the object when another request wins the ready-state race", async () => {
  const raceRoomKey = `transfer_${"U".repeat(43)}`;
  await call("transfer/room/join", {
    method: "POST",
    token: adminToken,
    ...jsonBody({ roomKey: raceRoomKey })
  });
  const declaredSize = 5 * 1024 * 1024;
  const initialized = await call("transfer/upload/init", {
    method: "POST",
    token: adminToken,
    ...jsonBody({
      roomKey: raceRoomKey,
      filename: "multipart-concurrent.bin",
      mimeType: "application/octet-stream",
      sizeBytes: declaredSize,
      idempotencyKey: "multipart-concurrent-complete-0001"
    })
  });
  assert.equal(initialized.status, 201);
  const task = await initialized.json();
  const upload = [...bucket.uploads.values()].find((entry) => entry.key.includes(task.itemId));
  upload.expectedSize = declaredSize;
  const part = await call(
    `transfer/upload/part?session=${task.sessionId}&room=${raceRoomKey}&part=1&size=${declaredSize}`,
    {
      method: "PUT",
      token: adminToken,
      body: new Uint8Array([1]),
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Length": String(declaredSize)
      }
    }
  );
  assert.equal(part.status, 200);

  let completedKey = "";
  bucket.onMultipartComplete = async (object) => {
    completedKey = object.key;
    const completedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    db.sqlite.prepare(`
      update transfer_items set upload_status = 'ready', size_bytes = ?, etag = ?,
        completed_at = ?, expires_at = ?, last_error = ''
      where id = ? and upload_status = 'uploading'
    `).run(object.size, object.etag, completedAt, expiresAt, task.itemId);
    db.sqlite.prepare(`
      update transfer_upload_sessions set status = 'completed', updated_at = ?, completed_at = ?
      where id = ?
    `).run(completedAt, completedAt, task.sessionId);
  };
  let completed;
  try {
    completed = await call("transfer/upload/complete", {
      method: "POST",
      token: adminToken,
      ...jsonBody({ roomKey: raceRoomKey, sessionId: task.sessionId })
    });
  } finally {
    bucket.onMultipartComplete = null;
  }

  assert.equal(completed.status, 200);
  const payload = await completed.json();
  assert.equal(payload.alreadyCompleted, true);
  assert.equal(payload.item.id, task.itemId);
  assert.notEqual(await bucket.head(completedKey), null);
  const stored = db.sqlite.prepare(`
    select i.upload_status, s.status as session_status
    from transfer_items i join transfer_upload_sessions s on s.item_id = i.id
    where i.id = ?
  `).get(task.itemId);
  assert.equal(stored.upload_status, "ready");
  assert.equal(stored.session_status, "completed");
});

test("range and multipart planning helpers enforce platform-safe geometry", () => {
  assert.deepEqual(transferInternals.parseSingleRange("bytes=5-9", 20), { offset: 5, length: 5 });
  assert.throws(() => transferInternals.parseSingleRange("bytes=0-1,4-5", 20), /多个 Range/);
  assert.equal(
    transferInternals.choosePartSize(500 * 1024 * 1024, 0, transferInternals.DEFAULTS),
    16 * 1024 * 1024
  );
});

test("cleanup makes expired objects unavailable and removes their R2 data", async () => {
  const room = db.sqlite.prepare("select id from transfer_rooms where room_key = ?").get(roomKey);
  const itemId = crypto.randomUUID();
  const key = `transfer/2000-01-01/${crypto.randomUUID()}`;
  const expired = "2000-01-01T00:00:00.000Z";
  await bucket.put(key, new TextEncoder().encode("expired"));
  db.sqlite.prepare(`
    insert into transfer_items (
      id, room_id, uploader_user_id, uploader_role_snapshot, item_type, original_filename,
      display_filename, r2_object_key, mime_type, size_bytes, upload_mode, upload_status,
      created_at, completed_at, expires_at
    ) values (?, ?, 'user-1', 'user', 'file', 'expired.txt', 'expired.txt', ?, 'text/plain', 7, 'simple', 'ready', ?, ?, ?)
  `).run(itemId, room.id, key, expired, expired, expired);

  const cleaned = await runTransferCleanup(env, { limit: 100 });
  assert.equal(cleaned.status, "success");
  assert.equal(cleaned.deletedItems >= 1, true);
  assert.equal(await bucket.head(key), null);
  assert.equal(db.sqlite.prepare("select id from transfer_items where id = ?").get(itemId), undefined);
});

test("admin cleanup returns a retryable non-2xx payload when an R2 object cannot be deleted", async () => {
  const cleanupRoomKey = `transfer_${"T".repeat(43)}`;
  const roomId = "cleanup-partial-room-0001";
  const itemId = "cleanup-partial-item-0001";
  const objectKey = "transfer/2000-01-01/cleanup-partial-item-0001";
  const expired = "2000-01-01T00:00:00.000Z";
  db.sqlite.prepare(`
    insert into transfer_rooms (id, room_key, created_by, status, created_at, last_activity_at)
    values (?, ?, 'user-1', 'open', ?, ?)
  `).run(roomId, cleanupRoomKey, expired, expired);
  await bucket.put(objectKey, new Uint8Array([1]));
  db.sqlite.prepare(`
    insert into transfer_items (
      id, room_id, uploader_user_id, uploader_role_snapshot, item_type, original_filename,
      display_filename, r2_object_key, mime_type, size_bytes, upload_mode, upload_status,
      created_at, completed_at, expires_at
    ) values (?, ?, 'user-1', 'user', 'file', 'partial.bin', 'partial.bin', ?,
      'application/octet-stream', 1, 'simple', 'ready', ?, ?, ?)
  `).run(itemId, roomId, objectKey, expired, expired, expired);
  bucket.failDeleteKeys.add(objectKey);
  const response = await call("admin/transfer/cleanup", {
    method: "POST",
    token: adminToken,
    ...jsonBody({ reconcile: false, limit: 100 })
  });
  bucket.failDeleteKeys.delete(objectKey);
  assert.equal(response.status, 502);
  const payload = await response.json();
  assert.equal(payload.status, "partial");
  assert.equal(payload.ok, false);
  assert.equal(payload.failed, 1);
  assert.deepEqual(payload.failures.map((failure) => failure.id), [itemId]);
  assert.deepEqual(payload.retry, { reconcile: false, limit: 100 });

  const retry = await call("admin/transfer/cleanup", {
    method: "POST",
    token: adminToken,
    ...jsonBody(payload.retry)
  });
  assert.equal(retry.status, 200);
  assert.equal((await retry.json()).status, "success");
  assert.equal(await bucket.head(objectKey), null);
});

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
