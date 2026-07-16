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
`);

const now = new Date().toISOString();
const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
db.sqlite.prepare("insert into users values (?, ?, '', ?, ?, ?)").run("user-1", "user@example.test", "user", now, now);
db.sqlite.prepare("insert into users values (?, ?, '', ?, ?, ?)").run("admin-1", "admin@example.test", "admin", now, now);
db.sqlite.prepare("insert into sessions values (?, ?, ?, ?)").run(await sha256Hex(userToken), "user-1", now, future);
db.sqlite.prepare("insert into sessions values (?, ?, ?, ?)").run(await sha256Hex(adminToken), "admin-1", now, future);

async function call(path, { method = "GET", token = "", body, headers = {}, includeOrigin = true } = {}) {
  const requestHeaders = new Headers(headers);
  if (token) requestHeaders.set("Cookie", `lusu_session=${token}`);
  if (includeOrigin && method !== "GET" && method !== "HEAD") requestHeaders.set("Origin", origin);
  const request = new Request(`${origin}/api/${path}`, { method, headers: requestHeaders, body });
  const routeParts = new URL(request.url).pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  const waits = [];
  const response = await handleTransferApi({
    request,
    env,
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
  const upload = await call(`transfer/upload/simple?room=${roomKey}&filename=note.txt&mime=text%2Fplain&size=${bytes.byteLength}`, {
    method: "POST",
    token: userToken,
    body: bytes,
    headers: { "Content-Type": "text/plain", "Content-Length": String(bytes.byteLength) }
  });
  assert.equal(upload.status, 201);
  const item = (await upload.json()).item;
  assert.equal(item.filename, "note.txt");

  const ranged = await call(`transfer/file/${item.id}?room=${roomKey}`, {
    token: userToken,
    headers: { Range: "bytes=0-8" }
  });
  assert.equal(ranged.status, 206);
  assert.equal(ranged.headers.get("Content-Range"), `bytes 0-8/${bytes.byteLength}`);
  assert.equal(await ranged.text(), "temporary");
});

test("only a database admin can plan and resume simulated GiB multipart uploads", async () => {
  await call("transfer/room/join", {
    method: "POST",
    token: adminToken,
    ...jsonBody({ roomKey })
  });
  const declaredSize = 1024 * 1024 * 1024;
  const initialized = await call("transfer/upload/init", {
    method: "POST",
    token: adminToken,
    ...jsonBody({ roomKey, filename: "admin-video.mp4", mimeType: "video/mp4", sizeBytes: declaredSize })
  });
  assert.equal(initialized.status, 201);
  const task = await initialized.json();
  assert.equal(task.expectedParts, 32);
  assert.equal(task.partSizeBytes, 32 * 1024 * 1024);

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

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
