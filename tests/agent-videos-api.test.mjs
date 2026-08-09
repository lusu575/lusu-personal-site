import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
  handleAgentVideosApi,
  isAgentVideosApiPath
} from "../functions/api/agent-videos.mjs";
import {
  createAgentVideoService,
  ensureAgentVideoSchema,
  listAgentVideosService
} from "../functions/api/agent-video-service.mjs";

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
    return this.database.sqlite.prepare(this.sql).get(...this.values) || null;
  }

  async all() {
    return { results: this.database.sqlite.prepare(this.sql).all(...this.values) };
  }

  async run() {
    const result = this.database.sqlite.prepare(this.sql).run(...this.values);
    return { success: true, meta: { changes: Number(result.changes || 0) } };
  }
}

class D1Database {
  constructor() {
    this.sqlite = new DatabaseSync(":memory:");
    this.sqlite.exec("pragma foreign_keys = on");
    this.batchTail = Promise.resolve();
    this.failBatchSqlPattern = null;
  }

  prepare(sql) {
    return new D1Statement(this, sql);
  }

  async batch(statements) {
    const previous = this.batchTail;
    let release;
    this.batchTail = new Promise((resolve) => {
      release = resolve;
    });
    await previous;
    this.sqlite.exec("begin immediate");
    try {
      const results = [];
      for (const statement of statements) {
        if (this.failBatchSqlPattern?.test(statement.sql)) {
          throw new Error("Injected video batch failure with private SQL details");
        }
        const result = this.sqlite.prepare(statement.sql).run(...statement.values);
        results.push({ success: true, meta: { changes: Number(result.changes || 0) } });
      }
      this.sqlite.exec("commit");
      return results;
    } catch (error) {
      this.sqlite.exec("rollback");
      throw error;
    } finally {
      release();
    }
  }
}

const origin = "https://example.test";

function createFixture() {
  const DB = new D1Database();
  DB.sqlite.exec(`
    create table users (
      id text primary key,
      email text not null unique,
      password_hash text not null,
      role text not null default 'user',
      created_at text not null,
      updated_at text not null
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
    create table videos (
      video_id text primary key,
      platform text not null,
      original_url text not null,
      external_id text not null,
      embed_url text not null,
      title text not null,
      description text not null default '',
      thumbnail_url text not null default '',
      author_name text not null default '',
      published_at text,
      status text not null default 'draft',
      sort_order integer not null default 0,
      pinned integer not null default 0,
      pinned_sort_order integer not null default 0,
      metadata_error text not null default '',
      created_at text not null,
      updated_at text not null
    );
    create table video_categories (
      category_id text primary key,
      slug text not null unique,
      name_zh text not null,
      name_en text not null default '',
      name_ja text not null default '',
      sort_order integer not null default 0,
      enabled integer not null default 1,
      created_at text not null,
      updated_at text not null
    );
    create table video_category_relations (
      video_id text not null references videos(video_id) on delete cascade,
      category_id text not null references video_categories(category_id) on delete cascade,
      sort_order integer not null default 0,
      created_at text not null,
      primary key (video_id, category_id)
    );
  `);
  const now = "2026-08-09T00:00:00.000Z";
  DB.sqlite.prepare(`
    insert into users (id, email, password_hash, role, created_at, updated_at)
    values (?, ?, 'unused', ?, ?, ?)
  `).run("admin-1", "admin@example.test", "admin", now, now);
  DB.sqlite.prepare(`
    insert into users (id, email, password_hash, role, created_at, updated_at)
    values (?, ?, 'unused', ?, ?, ?)
  `).run("user-1", "user@example.test", "user", now, now);
  DB.sqlite.prepare(`
    insert into video_categories (
      category_id, slug, name_zh, name_en, name_ja, sort_order,
      enabled, created_at, updated_at
    ) values (?, ?, ?, ?, ?, ?, 1, ?, ?)
  `).run("video-cat-ai", "ai", "AI", "AI", "AI", 20, now, now);
  DB.sqlite.prepare(`
    insert into video_categories (
      category_id, slug, name_zh, name_en, name_ja, sort_order,
      enabled, created_at, updated_at
    ) values (?, ?, ?, ?, ?, ?, 1, ?, ?)
  `).run("video-cat-games", "games", "游戏", "Games", "ゲーム", 10, now, now);

  const tokens = {
    adminWrite: `lusu_agent_${"a".repeat(48)}`,
    adminDelete: `lusu_agent_${"b".repeat(48)}`,
    adminBoth: `lusu_agent_${"c".repeat(48)}`,
    adminRead: `lusu_agent_${"d".repeat(48)}`,
    userWrite: `lusu_agent_${"e".repeat(48)}`
  };
  insertToken(DB, "token-admin-write", tokens.adminWrite, "admin-1", ["content:write"]);
  insertToken(DB, "token-admin-delete", tokens.adminDelete, "admin-1", ["content:delete"]);
  insertToken(DB, "token-admin-both", tokens.adminBoth, "admin-1", ["content:write", "content:delete"]);
  insertToken(DB, "token-admin-read", tokens.adminRead, "admin-1", ["content:read"]);
  insertToken(DB, "token-user-write", tokens.userWrite, "user-1", ["content:write"]);
  return { DB, env: { DB }, tokens };
}

function insertToken(DB, tokenId, token, userId, scopes) {
  DB.sqlite.prepare(`
    insert into agent_access_tokens (
      token_id, token_hash, token_hint, user_id, client_name, scopes,
      created_at, expires_at, last_used_at, revoked_at, revoked_event_id
    ) values (?, ?, '', ?, 'Agent video test', ?, ?, ?, '', '', '')
  `).run(
    tokenId,
    createHash("sha256").update(token).digest("hex"),
    userId,
    JSON.stringify(scopes),
    "2026-08-09T00:00:00.000Z",
    "2099-01-01T00:00:00.000Z"
  );
}

async function callApi(env, token, path, options = {}) {
  const method = options.method || "GET";
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let body;
  if (options.body !== undefined) {
    headers.set("Content-Type", options.contentType || "application/json");
    body = options.raw ? options.body : JSON.stringify(options.body);
  }
  const request = new Request(`${origin}/api/${path}`, { method, headers, body });
  const parts = new URL(request.url).pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  const response = await handleAgentVideosApi({ request, env }, parts);
  return { response, payload: await response.json() };
}

function createPayload(operationId, overrides = {}) {
  return {
    operationId,
    originalUrl: "https://youtu.be/dQw4w9WgXcQ?feature=shared#ignored",
    title: "Agent video",
    description: "Managed through the Agent API.",
    authorName: "LuSu",
    publishedAt: "2026-08-09T08:00:00+08:00",
    status: "published",
    pinned: true,
    categoryIds: ["video-cat-ai"],
    ...overrides
  };
}

function seedVideo(DB, options = {}) {
  const videoId = options.videoId || crypto.randomUUID();
  const externalId = options.externalId || "M7lc1UVf-VE";
  const updatedAt = options.updatedAt || "2026-08-09T01:00:00.000Z";
  const platform = options.platform || "youtube";
  const originalUrl = options.originalUrl || `https://www.youtube.com/watch?v=${externalId}`;
  const embedUrl = options.embedUrl || `https://www.youtube.com/embed/${externalId}`;
  DB.sqlite.prepare(`
    insert into videos (
      video_id, platform, original_url, external_id, embed_url, title,
      description, thumbnail_url, author_name, published_at, status,
      sort_order, pinned, pinned_sort_order, metadata_error, created_at, updated_at
    ) values (?, ?, ?, ?, ?, ?, '', '', '', null, ?, 10, 0, 0, '', ?, ?)
  `).run(
    videoId,
    platform,
    originalUrl,
    externalId,
    embedUrl,
    options.title || "Seed video",
    options.status || "draft",
    updatedAt,
    updatedAt
  );
  return { videoId, externalId, updatedAt };
}

function count(DB, table, where = "") {
  return Number(DB.sqlite.prepare(`select count(*) as count from ${table} ${where}`).get().count);
}

test("Agent video routes require mutation scope and a current administrator", async () => {
  assert.equal(isAgentVideosApiPath(["agent", "videos"]), true);
  assert.equal(isAgentVideosApiPath(["videos"]), false);
  const fixture = createFixture();

  const noToken = await callApi(fixture.env, "", "agent/videos");
  assert.equal(noToken.response.status, 401);
  assert.equal(noToken.payload.code, "AGENT_TOKEN_REQUIRED");
  assert.match(noToken.response.headers.get("WWW-Authenticate"), /lusu-agent/);

  const missingScope = await callApi(fixture.env, fixture.tokens.adminRead, "agent/videos");
  assert.equal(missingScope.response.status, 403);
  assert.equal(missingScope.payload.code, "AGENT_SCOPE_REQUIRED");

  const nonAdmin = await callApi(fixture.env, fixture.tokens.userWrite, "agent/videos");
  assert.equal(nonAdmin.response.status, 403);
  assert.equal(nonAdmin.payload.code, "AGENT_ADMIN_REQUIRED");

  const badQuery = await callApi(fixture.env, fixture.tokens.adminWrite, "agent/videos?unknown=1");
  assert.equal(badQuery.response.status, 400);
  assert.equal(badQuery.payload.code, "VIDEO_QUERY_INVALID");
});

test("Transport-neutral video service accepts OAuth principals and rechecks the live admin role", async () => {
  const fixture = createFixture();
  const grantRef = "oauthGrantRef_1234567890-ABCD";
  const principal = {
    authType: "oauth",
    userId: "admin-1",
    clientId: "oauth-client",
    grantRef,
    effectiveScopes: ["content:write"]
  };
  const created = await createAgentVideoService({
    env: fixture.env,
    principal,
    payload: createPayload("video-oauth-create-001")
  });
  assert.equal(created.status, 201);
  assert.equal(
    fixture.DB.sqlite.prepare("select token_id from agent_audit_log where target_id = ?")
      .get(created.payload.videoId).token_id,
    `oauth:${grantRef}`
  );
  fixture.DB.sqlite.prepare("update users set role = 'user' where id = 'admin-1'").run();
  await assert.rejects(
    listAgentVideosService({ env: fixture.env, principal }),
    (error) => error?.code === "AGENT_ADMIN_REQUIRED" && error?.status === 403
  );
});

test("Agent video create is atomic, canonical, audited, and replayable without another URL resolution", async () => {
  const fixture = createFixture();
  let shortLinkFetches = 0;
  fixture.env.VIDEO_METADATA_FETCH = async (url) => {
    shortLinkFetches += 1;
    assert.match(String(url), /^https:\/\/b23\.tv\//);
    return new Response(null, {
      status: 302,
      headers: { Location: "https://www.bilibili.com/video/BV1xx411c7mD?p=2&utm_source=ignored" }
    });
  };
  const payload = createPayload("video-create-0001", {
    originalUrl: "https://b23.tv/test-video",
    title: "Bilibili video"
  });
  const created = await callApi(fixture.env, fixture.tokens.adminWrite, "agent/videos", {
    method: "POST",
    body: payload
  });
  assert.equal(created.response.status, 201);
  assert.equal(created.payload.duplicate, false);
  assert.equal(shortLinkFetches, 1);

  const row = fixture.DB.sqlite.prepare("select * from videos where video_id = ?")
    .get(created.payload.videoId);
  assert.equal(row.platform, "bilibili");
  assert.equal(row.external_id, "BV1xx411c7mD");
  assert.equal(row.original_url, "https://www.bilibili.com/video/BV1xx411c7mD?p=2");
  assert.match(row.embed_url, /page=2/);
  assert.equal(count(fixture.DB, "video_category_relations"), 1);
  assert.equal(count(fixture.DB, "agent_video_receipts"), 1);
  assert.equal(count(fixture.DB, "agent_audit_log", "where action = 'agent-video-created'"), 1);

  const replay = await callApi(fixture.env, fixture.tokens.adminWrite, "agent/videos", {
    method: "POST",
    body: payload
  });
  assert.equal(replay.response.status, 200);
  assert.equal(replay.payload.duplicate, true);
  assert.equal(replay.payload.videoId, created.payload.videoId);
  assert.equal(shortLinkFetches, 1);
  assert.equal(count(fixture.DB, "videos"), 1);
  assert.equal(count(fixture.DB, "agent_audit_log"), 1);

  const operationConflict = await callApi(fixture.env, fixture.tokens.adminWrite, "agent/videos", {
    method: "POST",
    body: { ...payload, title: "Different title" }
  });
  assert.equal(operationConflict.response.status, 409);
  assert.equal(operationConflict.payload.code, "VIDEO_OPERATION_CONFLICT");
  assert.equal(shortLinkFetches, 1);

  const duplicateVideo = await callApi(fixture.env, fixture.tokens.adminWrite, "agent/videos", {
    method: "POST",
    body: { ...payload, operationId: "video-create-0002" }
  });
  assert.equal(duplicateVideo.response.status, 409);
  assert.equal(duplicateVideo.payload.code, "VIDEO_DUPLICATE");
  assert.equal(count(fixture.DB, "agent_video_receipts"), 1);
});

test("Agent video list/get expose managed fields and strict provider boundaries", async () => {
  const fixture = createFixture();
  const created = await callApi(fixture.env, fixture.tokens.adminWrite, "agent/videos", {
    method: "POST",
    body: createPayload("video-create-0010")
  });
  assert.equal(created.response.status, 201);
  const listing = await callApi(
    fixture.env,
    fixture.tokens.adminWrite,
    "agent/videos?status=published&platform=youtube&limit=10"
  );
  assert.equal(listing.response.status, 200);
  assert.equal(listing.payload.videos.length, 1);
  assert.equal(listing.payload.videos[0].videoId, created.payload.videoId);
  assert.deepEqual(listing.payload.videos[0].categoryIds, ["video-cat-ai"]);

  const detail = await callApi(
    fixture.env,
    fixture.tokens.adminWrite,
    `agent/videos/${created.payload.videoId}`
  );
  assert.equal(detail.response.status, 200);
  assert.equal(detail.payload.video.originalUrl, "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  assert.equal(detail.payload.video.thumbnailUrl, "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");

  for (const [operationId, originalUrl] of [
    ["video-reject-001", "http://www.youtube.com/watch?v=dQw4w9WgXcQ"],
    ["video-reject-002", "https://user:pass@www.youtube.com/watch?v=dQw4w9WgXcQ"],
    ["video-reject-003", "https://cdn.example.test/video.mp4"],
    ["video-reject-004", "https://evil.test/watch?v=dQw4w9WgXcQ"]
  ]) {
    const rejected = await callApi(fixture.env, fixture.tokens.adminWrite, "agent/videos", {
      method: "POST",
      body: createPayload(operationId, { originalUrl })
    });
    assert.equal(rejected.response.status, 400);
    assert.equal(rejected.payload.code, "VIDEO_URL_INVALID");
  }
  const dataThumbnail = await callApi(fixture.env, fixture.tokens.adminWrite, "agent/videos", {
    method: "POST",
    body: createPayload("video-reject-005", {
      originalUrl: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
      thumbnailUrl: "data:image/png;base64,AAAA"
    })
  });
  assert.equal(dataThumbnail.response.status, 400);
  assert.equal(dataThumbnail.payload.code, "VIDEO_THUMBNAIL_URL_INVALID");
});

test("Agent video update keeps CAS, category relations, idempotency, and duplicate-provider checks atomic", async () => {
  const fixture = createFixture();
  const seeded = seedVideo(fixture.DB);
  seedVideo(fixture.DB, { videoId: "second-video", externalId: "aqz-KE-bpKQ" });
  fixture.DB.sqlite.prepare(`
    insert into video_category_relations (video_id, category_id, sort_order, created_at)
    values (?, 'video-cat-ai', 0, ?)
  `).run(seeded.videoId, seeded.updatedAt);

  const updateBody = {
    operationId: "video-update-0001",
    expectedUpdatedAt: seeded.updatedAt,
    title: "Updated title",
    status: "published",
    pinned: true,
    pinnedSortOrder: 50,
    categoryIds: ["video-cat-games"]
  };
  const updated = await callApi(
    fixture.env,
    fixture.tokens.adminWrite,
    `agent/videos/${seeded.videoId}`,
    { method: "PUT", body: updateBody }
  );
  assert.equal(updated.response.status, 200);
  const row = fixture.DB.sqlite.prepare("select * from videos where video_id = ?").get(seeded.videoId);
  assert.equal(row.title, "Updated title");
  assert.equal(row.status, "published");
  assert.equal(row.pinned_sort_order, 50);
  assert.deepEqual(
    fixture.DB.sqlite.prepare("select category_id from video_category_relations where video_id = ?")
      .all(seeded.videoId).map((item) => item.category_id),
    ["video-cat-games"]
  );

  const replay = await callApi(
    fixture.env,
    fixture.tokens.adminWrite,
    `agent/videos/${seeded.videoId}`,
    { method: "PUT", body: updateBody }
  );
  assert.equal(replay.response.status, 200);
  assert.equal(replay.payload.duplicate, true);
  assert.equal(count(fixture.DB, "agent_audit_log", "where action = 'agent-video-updated'"), 1);

  const stale = await callApi(
    fixture.env,
    fixture.tokens.adminWrite,
    `agent/videos/${seeded.videoId}`,
    {
      method: "PUT",
      body: {
        operationId: "video-update-0002",
        expectedUpdatedAt: seeded.updatedAt,
        title: "Stale title",
        categoryIds: ["video-cat-ai"]
      }
    }
  );
  assert.equal(stale.response.status, 409);
  assert.equal(stale.payload.code, "CONTENT_CONFLICT");
  assert.equal(count(fixture.DB, "agent_video_receipts", "where operation_id = 'video-update-0002'"), 0);
  assert.equal(fixture.DB.sqlite.prepare("select title from videos where video_id = ?").get(seeded.videoId).title, "Updated title");

  const duplicateProvider = await callApi(
    fixture.env,
    fixture.tokens.adminWrite,
    `agent/videos/${seeded.videoId}`,
    {
      method: "PUT",
      body: {
        operationId: "video-update-0003",
        expectedUpdatedAt: updated.payload.updatedAt,
        originalUrl: "https://youtu.be/aqz-KE-bpKQ"
      }
    }
  );
  assert.equal(duplicateProvider.response.status, 409);
  assert.equal(duplicateProvider.payload.code, "VIDEO_DUPLICATE");
});

test("Agent video refresh replays before row reads or metadata fetches", async () => {
  const fixture = createFixture();
  const seeded = seedVideo(fixture.DB);
  let metadataFetches = 0;
  fixture.env.VIDEO_METADATA_FETCH = async (url) => {
    metadataFetches += 1;
    assert.match(String(url), /^https:\/\/www\.youtube\.com\/oembed\?/);
    return Response.json({
      title: "Fresh metadata title",
      author_name: "Fresh author",
      thumbnail_url: "https://i.ytimg.com/vi/M7lc1UVf-VE/maxresdefault.jpg"
    });
  };
  const body = {
    operationId: "video-refresh-001",
    expectedUpdatedAt: seeded.updatedAt
  };
  const refreshed = await callApi(
    fixture.env,
    fixture.tokens.adminWrite,
    `agent/videos/${seeded.videoId}/refresh`,
    { method: "POST", body }
  );
  assert.equal(refreshed.response.status, 200);
  assert.equal(refreshed.payload.metadataUpdated, true);
  assert.equal(metadataFetches, 1);
  assert.equal(
    fixture.DB.sqlite.prepare("select title from videos where video_id = ?").get(seeded.videoId).title,
    "Fresh metadata title"
  );

  const replay = await callApi(
    fixture.env,
    fixture.tokens.adminWrite,
    `agent/videos/${seeded.videoId}/refresh`,
    { method: "POST", body }
  );
  assert.equal(replay.response.status, 200);
  assert.equal(replay.payload.duplicate, true);
  assert.equal(metadataFetches, 1);
  assert.equal(count(fixture.DB, "agent_audit_log", "where action = 'agent-video-metadata-refreshed'"), 1);

  const operationConflict = await callApi(
    fixture.env,
    fixture.tokens.adminWrite,
    `agent/videos/${seeded.videoId}/refresh`,
    {
      method: "POST",
      body: { ...body, expectedUpdatedAt: refreshed.payload.updatedAt }
    }
  );
  assert.equal(operationConflict.response.status, 409);
  assert.equal(operationConflict.payload.code, "VIDEO_OPERATION_CONFLICT");
  assert.equal(metadataFetches, 1);

  const stale = await callApi(
    fixture.env,
    fixture.tokens.adminWrite,
    `agent/videos/${seeded.videoId}/refresh`,
    {
      method: "POST",
      body: { operationId: "video-refresh-002", expectedUpdatedAt: seeded.updatedAt }
    }
  );
  assert.equal(stale.response.status, 409);
  assert.equal(stale.payload.code, "CONTENT_CONFLICT");
  assert.equal(metadataFetches, 1);
});

test("Agent video delete requires delete scope, confirmation, CAS, and remains replayable after removal", async () => {
  const fixture = createFixture();
  const seeded = seedVideo(fixture.DB);
  const denied = await callApi(
    fixture.env,
    fixture.tokens.adminWrite,
    `agent/videos/${seeded.videoId}`,
    {
      method: "DELETE",
      body: {
        operationId: "video-delete-0001",
        expectedUpdatedAt: seeded.updatedAt,
        confirm: true
      }
    }
  );
  assert.equal(denied.response.status, 403);
  assert.equal(denied.payload.code, "AGENT_SCOPE_REQUIRED");

  const unconfirmed = await callApi(
    fixture.env,
    fixture.tokens.adminDelete,
    `agent/videos/${seeded.videoId}`,
    {
      method: "DELETE",
      body: {
        operationId: "video-delete-0001",
        expectedUpdatedAt: seeded.updatedAt,
        confirm: false
      }
    }
  );
  assert.equal(unconfirmed.response.status, 400);
  assert.equal(unconfirmed.payload.code, "VIDEO_DELETE_CONFIRMATION_REQUIRED");

  const body = {
    operationId: "video-delete-0002",
    expectedUpdatedAt: seeded.updatedAt,
    confirm: true
  };
  const deleted = await callApi(
    fixture.env,
    fixture.tokens.adminDelete,
    `agent/videos/${seeded.videoId}`,
    { method: "DELETE", body }
  );
  assert.equal(deleted.response.status, 200);
  assert.equal(deleted.payload.deleted, true);
  assert.equal(count(fixture.DB, "videos"), 0);
  assert.equal(count(fixture.DB, "agent_audit_log", "where action = 'agent-video-deleted'"), 1);

  const replay = await callApi(
    fixture.env,
    fixture.tokens.adminDelete,
    `agent/videos/${seeded.videoId}`,
    { method: "DELETE", body }
  );
  assert.equal(replay.response.status, 200);
  assert.equal(replay.payload.duplicate, true);
  assert.equal(count(fixture.DB, "agent_audit_log"), 1);
});

test("Hosted video upload control plane is strict and fail-closed without R2/data-plane", async () => {
  const fixture = createFixture();
  const validManifest = {
    operationId: "video-upload-0001",
    filename: "clip.mp4",
    mimeType: "video/mp4",
    sizeBytes: 1_024,
    sha256: "a".repeat(64),
    title: "Hosted clip",
    status: "draft",
    categoryIds: ["video-cat-ai"]
  };
  const unavailable = await callApi(
    fixture.env,
    fixture.tokens.adminWrite,
    "agent/videos/uploads/begin",
    { method: "POST", body: validManifest }
  );
  assert.equal(unavailable.response.status, 503);
  assert.equal(unavailable.payload.code, "VIDEO_UPLOAD_NOT_CONFIGURED");
  assert.equal(unavailable.payload.uploadAvailable, false);
  assert.equal(count(fixture.DB, "video_upload_sessions"), 0);

  for (const forbidden of [
    { filePath: "C:\\secret\\clip.mp4" },
    { data: "AAAA" },
    { base64: "AAAA" }
  ]) {
    const rejected = await callApi(
      fixture.env,
      fixture.tokens.adminWrite,
      "agent/videos/uploads/begin",
      { method: "POST", body: { ...validManifest, ...forbidden } }
    );
    assert.equal(rejected.response.status, 400);
    assert.equal(rejected.payload.code, "VIDEO_UPLOAD_PAYLOAD_INVALID");
  }

  const sessionId = `vup_${"z".repeat(24)}`;
  const status = await callApi(
    fixture.env,
    fixture.tokens.adminWrite,
    `agent/videos/uploads/${sessionId}`
  );
  assert.equal(status.response.status, 503);
  assert.equal(status.payload.code, "VIDEO_UPLOAD_NOT_CONFIGURED");

  const commit = await callApi(
    fixture.env,
    fixture.tokens.adminWrite,
    `agent/videos/uploads/${sessionId}/commit`,
    { method: "POST", body: { operationId: "video-upload-commit-01" } }
  );
  assert.equal(commit.response.status, 503);
  assert.equal(commit.payload.code, "VIDEO_UPLOAD_NOT_CONFIGURED");

  const abortWithoutConfirm = await callApi(
    fixture.env,
    fixture.tokens.adminWrite,
    `agent/videos/uploads/${sessionId}/abort`,
    { method: "POST", body: { operationId: "video-upload-abort-001", confirm: false } }
  );
  assert.equal(abortWithoutConfirm.response.status, 400);
  assert.equal(abortWithoutConfirm.payload.code, "VIDEO_UPLOAD_ABORT_CONFIRMATION_REQUIRED");
  const abort = await callApi(
    fixture.env,
    fixture.tokens.adminWrite,
    `agent/videos/uploads/${sessionId}/abort`,
    { method: "POST", body: { operationId: "video-upload-abort-001", confirm: true } }
  );
  assert.equal(abort.response.status, 503);
  assert.equal(abort.payload.code, "VIDEO_UPLOAD_NOT_CONFIGURED");
  assert.equal(count(fixture.DB, "video_upload_sessions"), 0);
});

test("Agent video schema migration is idempotent on a legacy video database", async () => {
  const fixture = createFixture();
  await ensureAgentVideoSchema(fixture.env);
  await ensureAgentVideoSchema(fixture.env);
  assert.deepEqual(
    fixture.DB.sqlite.prepare("pragma table_info(agent_video_receipts)").all().map((column) => column.name),
    [
      "receipt_id", "user_id", "operation_id", "action", "payload_hash",
      "video_id", "response_json", "created_at"
    ]
  );
  assert.deepEqual(
    fixture.DB.sqlite.prepare("pragma table_info(video_upload_sessions)").all().map((column) => column.name),
    [
      "upload_session_id", "user_id", "operation_id", "payload_hash", "video_id",
      "filename", "mime_type", "size_bytes", "sha256", "upload_token_hash",
      "object_key", "r2_upload_id", "part_size_bytes", "expected_parts",
      "uploaded_bytes", "status", "expires_at", "created_at", "updated_at",
      "completed_at", "aborted_at", "last_error"
    ]
  );
  assert.equal(
    fixture.DB.sqlite.prepare(`
      select count(*) as count from sqlite_master
      where type = 'index' and name in (
        'agent_video_receipts_created_idx',
        'video_upload_sessions_user_status_idx',
        'video_upload_sessions_status_expires_idx'
      )
    `).get().count,
    3
  );
  assert.deepEqual(fixture.DB.sqlite.prepare("pragma foreign_key_check").all(), []);
});

test("Agent video mutation batch failure rolls back video, receipt, category, and audit together", async () => {
  const fixture = createFixture();
  await ensureAgentVideoSchema(fixture.env);
  fixture.DB.failBatchSqlPattern = /insert into agent_video_receipts/i;
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    const failed = await callApi(fixture.env, fixture.tokens.adminWrite, "agent/videos", {
      method: "POST",
      body: createPayload("video-create-failure")
    });
    assert.equal(failed.response.status, 500);
    assert.equal(failed.payload.code, "AGENT_VIDEOS_INTERNAL_ERROR");
  } finally {
    console.error = originalConsoleError;
  }
  assert.equal(count(fixture.DB, "videos"), 0);
  assert.equal(count(fixture.DB, "video_category_relations"), 0);
  assert.equal(count(fixture.DB, "agent_video_receipts"), 0);
  assert.equal(count(fixture.DB, "agent_audit_log"), 0);
});
