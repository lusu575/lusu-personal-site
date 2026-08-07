import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
  handleAgentArticlesApi,
  isAgentArticlesApiPath
} from "../functions/api/agent-articles.mjs";

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
    this.batchTail = Promise.resolve();
    this.failBatchSqlPattern = null;
  }

  prepare(sql) {
    return new D1Statement(this, sql);
  }

  async batch(statements) {
    const previous = this.batchTail;
    let release;
    this.batchTail = new Promise((resolveBatch) => {
      release = resolveBatch;
    });
    await previous;
    this.sqlite.exec("begin immediate");
    try {
      const results = [];
      for (const statement of statements) {
        if (this.failBatchSqlPattern?.test(statement.sql)) {
          throw new Error("Injected D1 batch failure containing private SQL details");
        }
        const result = this.sqlite.prepare(statement.sql).run(...statement.values);
        results.push({
          success: true,
          meta: {
            changes: Number(result.changes || 0),
            last_row_id: result.lastInsertRowid
          }
        });
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
    create table articles (
      article_id text primary key,
      slug text not null unique,
      category text not null default 'note',
      tags text not null default '[]',
      cover_image text not null default '',
      status text not null default 'draft',
      is_pinned integer not null default 0,
      view_count integer not null default 0,
      created_at text not null,
      updated_at text not null,
      published_at text
    );
    create table article_translations (
      translation_id text primary key,
      article_id text not null references articles(article_id) on delete cascade,
      lang text not null,
      title text not null,
      summary text not null default '',
      content_markdown text not null default '',
      created_at text not null,
      updated_at text not null,
      unique(article_id, lang)
    );
  `);
  const now = "2026-08-07T00:00:00.000Z";
  DB.sqlite.prepare(`
    insert into users (id, email, password_hash, role, created_at, updated_at)
    values (?, ?, 'unused', ?, ?, ?)
  `).run("admin-1", "admin@example.test", "admin", now, now);
  DB.sqlite.prepare(`
    insert into users (id, email, password_hash, role, created_at, updated_at)
    values (?, ?, 'unused', ?, ?, ?)
  `).run("user-1", "user@example.test", "user", now, now);

  const tokens = {
    adminWrite: `lusu_agent_${"a".repeat(48)}`,
    adminDelete: `lusu_agent_${"b".repeat(48)}`,
    adminBoth: `lusu_agent_${"c".repeat(48)}`,
    adminRead: `lusu_agent_${"d".repeat(48)}`,
    userWrite: `lusu_agent_${"e".repeat(48)}`
  };
  insertToken(DB, "token-admin-write", tokens.adminWrite, "admin-1", ["content:write"]);
  insertToken(DB, "token-admin-delete", tokens.adminDelete, "admin-1", ["content:delete"]);
  insertToken(DB, "token-admin-both", tokens.adminBoth, "admin-1", [
    "content:write",
    "content:delete"
  ]);
  insertToken(DB, "token-admin-read", tokens.adminRead, "admin-1", ["content:read"]);
  insertToken(DB, "token-user-write", tokens.userWrite, "user-1", ["content:write"]);
  return { DB, env: { DB }, tokens };
}

function insertToken(DB, tokenId, token, userId, scopes) {
  const now = "2026-08-07T00:00:00.000Z";
  const expiresAt = "2099-01-01T00:00:00.000Z";
  DB.sqlite.prepare(`
    insert into agent_access_tokens (
      token_id, token_hash, token_hint, user_id, client_name, scopes,
      created_at, expires_at, last_used_at, revoked_at, revoked_event_id
    ) values (?, ?, '', ?, 'Agent article test', ?, ?, ?, '', '', '')
  `).run(tokenId, sha256(token), userId, JSON.stringify(scopes), now, expiresAt);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function publishPayload(operationId, slug = "agent-article") {
  return {
    operationId,
    slug,
    category: "notes",
    tags: ["AI", "MCP"],
    coverImage: "assets/images/articles/example.webp",
    isPinned: false,
    publishedAt: "2026-08-07T08:30:00+08:00",
    translations: {
      zh: {
        title: "中文标题",
        summary: "中文简介",
        contentMarkdown: "# 中文标题\n\n中文正文"
      },
      en: {
        title: "English title",
        summary: "English summary",
        contentMarkdown: "# English title\n\nEnglish body"
      },
      ja: {
        title: "日本語タイトル",
        summary: "日本語の概要",
        contentMarkdown: "# 日本語タイトル\n\n日本語本文"
      }
    }
  };
}

async function callApi(env, token, path, options = {}) {
  const method = options.method || "GET";
  const headers = new Headers({ Authorization: `Bearer ${token}` });
  let body;
  if (options.body !== undefined) {
    headers.set("Content-Type", options.contentType || "application/json");
    body = options.raw ? options.body : JSON.stringify(options.body);
  }
  const request = new Request(`${origin}/api/${path}`, { method, headers, body });
  const parts = new URL(request.url).pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  const response = await handleAgentArticlesApi({ request, env }, parts);
  return { response, payload: await response.json() };
}

function seedArticle(DB, options = {}) {
  const articleId = options.articleId || crypto.randomUUID();
  const slug = options.slug || `seed-${articleId}`;
  const category = options.category || "notes";
  const status = options.status || "published";
  const updatedAt = options.updatedAt || "2026-08-07T01:00:00.000Z";
  DB.sqlite.prepare(`
    insert into articles (
      article_id, slug, category, tags, cover_image, status, is_pinned,
      view_count, created_at, updated_at, published_at
    ) values (?, ?, ?, '[]', '', ?, 0, 0, ?, ?, ?)
  `).run(
    articleId,
    slug,
    category,
    status,
    updatedAt,
    updatedAt,
    status === "published" ? updatedAt : null
  );
  const insertTranslation = DB.sqlite.prepare(`
    insert into article_translations (
      translation_id, article_id, lang, title, summary, content_markdown,
      created_at, updated_at
    ) values (?, ?, ?, ?, '', ?, ?, ?)
  `);
  for (const lang of ["zh", "en", "ja"]) {
    insertTranslation.run(
      `${articleId}-${lang}`,
      articleId,
      lang,
      `${lang} title`,
      `# ${lang}\n\nbody`,
      updatedAt,
      updatedAt
    );
  }
  return { articleId, slug, category, updatedAt };
}

function count(DB, table, where = "") {
  return DB.sqlite.prepare(`select count(*) as count from ${table} ${where}`).get().count;
}

test("Agent article routing requires mutation scope and a currently-admin backing account", async () => {
  assert.equal(isAgentArticlesApiPath(["agent", "articles"]), true);
  assert.equal(isAgentArticlesApiPath(["articles"]), false);
  const fixture = createFixture();

  const missingScope = await callApi(fixture.env, fixture.tokens.adminRead, "agent/articles");
  assert.equal(missingScope.response.status, 403);
  assert.equal(missingScope.payload.code, "AGENT_SCOPE_REQUIRED");

  const nonAdmin = await callApi(fixture.env, fixture.tokens.userWrite, "agent/articles");
  assert.equal(nonAdmin.response.status, 403);
  assert.equal(nonAdmin.payload.code, "AGENT_ADMIN_REQUIRED");

  const deleteWithoutScope = await callApi(
    fixture.env,
    fixture.tokens.adminWrite,
    "agent/articles/missing",
    {
      method: "DELETE",
      body: {
        operationId: "delete-scope-0001",
        expectedUpdatedAt: "2026-08-07T00:00:00.000Z",
        confirm: true
      }
    }
  );
  assert.equal(deleteWithoutScope.response.status, 403);
  assert.equal(deleteWithoutScope.payload.code, "AGENT_SCOPE_REQUIRED");

  fixture.DB.sqlite.prepare("update users set role = 'user' where id = 'admin-1'").run();
  const downgraded = await callApi(fixture.env, fixture.tokens.adminWrite, "agent/articles");
  assert.equal(downgraded.response.status, 403);
  assert.equal(downgraded.payload.code, "AGENT_ADMIN_REQUIRED");
});

test("atomic publish rolls back article, translations, audit, and receipt together", async () => {
  const fixture = createFixture();
  fixture.DB.failBatchSqlPattern = /insert into article_translations/i;
  const failed = await callApi(
    fixture.env,
    fixture.tokens.adminWrite,
    "agent/articles/publish",
    { method: "POST", body: publishPayload("publish-atomic-0001", "atomic-article") }
  );
  assert.equal(failed.response.status, 500);
  assert.equal(failed.payload.code, "AGENT_ARTICLES_INTERNAL_ERROR");
  assert.doesNotMatch(JSON.stringify(failed.payload), /private SQL|insert into/i);
  assert.equal(count(fixture.DB, "articles"), 0);
  assert.equal(count(fixture.DB, "article_translations"), 0);
  assert.equal(count(fixture.DB, "agent_audit_log"), 0);
  assert.equal(count(fixture.DB, "agent_article_receipts"), 0);

  fixture.DB.failBatchSqlPattern = null;
  const published = await callApi(
    fixture.env,
    fixture.tokens.adminWrite,
    "agent/articles/publish",
    { method: "POST", body: publishPayload("publish-atomic-0001", "atomic-article") }
  );
  assert.equal(published.response.status, 201);
  assert.equal(published.payload.duplicate, false);
  assert.equal(published.payload.status, "published");
  assert.equal(count(fixture.DB, "articles"), 1);
  assert.equal(count(fixture.DB, "article_translations"), 3);
  assert.equal(count(fixture.DB, "agent_audit_log"), 1);
  assert.equal(count(fixture.DB, "agent_article_receipts"), 1);
  const stored = fixture.DB.sqlite.prepare(
    "select status, published_at from articles where article_id = ?"
  ).get(published.payload.articleId);
  assert.equal(stored.status, "published");
  assert.equal(stored.published_at, "2026-08-07T00:30:00.000Z");
});

test("publish receipt is canonical, retry-safe, and separate from slug conflicts", async () => {
  const fixture = createFixture();
  const original = publishPayload("publish-idempotent-0001", "idempotent-article");
  const first = await callApi(
    fixture.env,
    fixture.tokens.adminWrite,
    "agent/articles/publish",
    { method: "POST", body: original }
  );
  assert.equal(first.response.status, 201);

  const reordered = {
    translations: {
      ja: { ...original.translations.ja },
      zh: { ...original.translations.zh },
      en: { ...original.translations.en }
    },
    publishedAt: original.publishedAt,
    isPinned: original.isPinned,
    coverImage: original.coverImage,
    tags: [...original.tags],
    category: original.category,
    slug: original.slug,
    operationId: original.operationId
  };
  const retry = await callApi(
    fixture.env,
    fixture.tokens.adminWrite,
    "agent/articles/publish",
    { method: "POST", body: reordered }
  );
  assert.equal(retry.response.status, 200);
  assert.equal(retry.payload.duplicate, true);
  assert.equal(retry.payload.articleId, first.payload.articleId);
  assert.equal(count(fixture.DB, "articles"), 1);
  assert.equal(count(fixture.DB, "agent_audit_log"), 1);

  const changed = structuredClone(original);
  changed.translations.en.title = "Changed title";
  const operationConflict = await callApi(
    fixture.env,
    fixture.tokens.adminWrite,
    "agent/articles/publish",
    { method: "POST", body: changed }
  );
  assert.equal(operationConflict.response.status, 409);
  assert.equal(operationConflict.payload.code, "ARTICLE_OPERATION_CONFLICT");

  const slugConflict = await callApi(
    fixture.env,
    fixture.tokens.adminWrite,
    "agent/articles/publish",
    {
      method: "POST",
      body: publishPayload("publish-idempotent-0002", "idempotent-article")
    }
  );
  assert.equal(slugConflict.response.status, 409);
  assert.equal(slugConflict.payload.code, "ARTICLE_SLUG_CONFLICT");
  assert.equal(count(fixture.DB, "agent_article_receipts"), 1);
});

test("managed list filters records and managed get returns camelCase full trilingual source", async () => {
  const fixture = createFixture();
  const published = await callApi(
    fixture.env,
    fixture.tokens.adminWrite,
    "agent/articles/publish",
    { method: "POST", body: publishPayload("publish-readback-0001", "readback-article") }
  );
  seedArticle(fixture.DB, {
    articleId: "draft-article",
    slug: "draft-article",
    category: "notes",
    status: "draft",
    updatedAt: "2026-08-07T02:00:00.000Z"
  });

  const listing = await callApi(
    fixture.env,
    fixture.tokens.adminWrite,
    "agent/articles?status=draft&category=notes&limit=1"
  );
  assert.equal(listing.response.status, 200);
  assert.equal(listing.payload.articles.length, 1);
  assert.equal(listing.payload.articles[0].articleId, "draft-article");
  assert.equal(listing.payload.articles[0].translationCount, 3);
  assert.ok(listing.payload.articles[0].updatedAt);

  const item = await callApi(
    fixture.env,
    fixture.tokens.adminWrite,
    `agent/articles/${published.payload.articleId}`
  );
  assert.equal(item.response.status, 200);
  assert.equal(item.payload.article.articleId, published.payload.articleId);
  assert.equal(item.payload.article.coverImage, "assets/images/articles/example.webp");
  assert.equal(item.payload.article.translations.zh.title, "中文标题");
  assert.equal(item.payload.article.translations.en.contentMarkdown, "# English title\n\nEnglish body");
  assert.equal(item.payload.article.translations.ja.summary, "日本語の概要");
  assert.equal(item.payload.article.updatedAt, published.payload.updatedAt);

  const strictQuery = await callApi(
    fixture.env,
    fixture.tokens.adminWrite,
    "agent/articles?limit=1&unknown=1"
  );
  assert.equal(strictQuery.response.status, 400);
  assert.equal(strictQuery.payload.code, "ARTICLE_QUERY_INVALID");
});

test("article update applies metadata and selected translations only after CAS succeeds", async () => {
  const fixture = createFixture();
  const published = await callApi(
    fixture.env,
    fixture.tokens.adminBoth,
    "agent/articles/publish",
    { method: "POST", body: publishPayload("publish-update-0001", "before-update") }
  );
  const updateBody = {
    operationId: "article-update-0001",
    expectedUpdatedAt: published.payload.updatedAt,
    slug: "after-update",
    tags: ["updated"],
    translations: {
      en: {
        title: "Updated English title",
        summary: "Updated summary",
        contentMarkdown: "# Updated\n\nUpdated body"
      }
    }
  };
  const updated = await callApi(
    fixture.env,
    fixture.tokens.adminBoth,
    `agent/articles/${published.payload.articleId}`,
    { method: "PUT", body: updateBody }
  );
  assert.equal(updated.response.status, 200);
  assert.equal(updated.payload.duplicate, false);
  assert.notEqual(updated.payload.updatedAt, published.payload.updatedAt);
  const stored = fixture.DB.sqlite.prepare(
    "select slug, tags, status, updated_at from articles where article_id = ?"
  ).get(published.payload.articleId);
  assert.equal(stored.slug, "after-update");
  assert.deepEqual(JSON.parse(stored.tags), ["updated"]);
  assert.equal(stored.status, "published");
  assert.equal(stored.updated_at, updated.payload.updatedAt);
  assert.equal(fixture.DB.sqlite.prepare(`
    select title from article_translations where article_id = ? and lang = 'en'
  `).get(published.payload.articleId).title, "Updated English title");
  assert.equal(fixture.DB.sqlite.prepare(`
    select title from article_translations where article_id = ? and lang = 'zh'
  `).get(published.payload.articleId).title, "中文标题");

  const stale = await callApi(
    fixture.env,
    fixture.tokens.adminBoth,
    `agent/articles/${published.payload.articleId}`,
    {
      method: "PUT",
      body: {
        operationId: "article-update-stale-0001",
        expectedUpdatedAt: published.payload.updatedAt,
        isPinned: true
      }
    }
  );
  assert.equal(stale.response.status, 409);
  assert.equal(stale.payload.code, "CONTENT_CONFLICT");
  assert.equal(stale.payload.updatedAt, updated.payload.updatedAt);
  assert.equal(count(
    fixture.DB,
    "agent_article_receipts",
    "where operation_id = 'article-update-stale-0001'"
  ), 0);

  const retry = await callApi(
    fixture.env,
    fixture.tokens.adminBoth,
    `agent/articles/${published.payload.articleId}`,
    { method: "PUT", body: updateBody }
  );
  assert.equal(retry.response.status, 200);
  assert.equal(retry.payload.duplicate, true);
  assert.equal(retry.payload.updatedAt, updated.payload.updatedAt);

  const actionReuse = await callApi(
    fixture.env,
    fixture.tokens.adminBoth,
    `agent/articles/${published.payload.articleId}`,
    {
      method: "DELETE",
      body: {
        operationId: updateBody.operationId,
        expectedUpdatedAt: updated.payload.updatedAt,
        confirm: true
      }
    }
  );
  assert.equal(actionReuse.response.status, 409);
  assert.equal(actionReuse.payload.code, "ARTICLE_OPERATION_CONFLICT");
});

test("delete requires confirmation, commits with its receipt, and replays after the row is gone", async () => {
  const fixture = createFixture();
  const published = await callApi(
    fixture.env,
    fixture.tokens.adminBoth,
    "agent/articles/publish",
    { method: "POST", body: publishPayload("publish-delete-0001", "delete-article") }
  );
  const deleteBody = {
    operationId: "article-delete-0001",
    expectedUpdatedAt: published.payload.updatedAt,
    confirm: true
  };
  const unconfirmed = await callApi(
    fixture.env,
    fixture.tokens.adminDelete,
    `agent/articles/${published.payload.articleId}`,
    { method: "DELETE", body: { ...deleteBody, operationId: "article-delete-no-0001", confirm: false } }
  );
  assert.equal(unconfirmed.response.status, 400);
  assert.equal(unconfirmed.payload.code, "ARTICLE_DELETE_CONFIRMATION_REQUIRED");

  const deleted = await callApi(
    fixture.env,
    fixture.tokens.adminDelete,
    `agent/articles/${published.payload.articleId}`,
    { method: "DELETE", body: deleteBody }
  );
  assert.equal(deleted.response.status, 200);
  assert.equal(deleted.payload.deleted, true);
  assert.equal(deleted.payload.duplicate, false);
  assert.equal(count(fixture.DB, "articles"), 0);
  assert.equal(count(fixture.DB, "article_translations"), 0);
  assert.equal(count(
    fixture.DB,
    "agent_audit_log",
    "where action = 'agent-article-deleted'"
  ), 1);

  const retry = await callApi(
    fixture.env,
    fixture.tokens.adminDelete,
    `agent/articles/${published.payload.articleId}`,
    { method: "DELETE", body: deleteBody }
  );
  assert.equal(retry.response.status, 200);
  assert.equal(retry.payload.duplicate, true);
  assert.equal(retry.payload.articleId, published.payload.articleId);

  const changedRetry = await callApi(
    fixture.env,
    fixture.tokens.adminDelete,
    `agent/articles/${published.payload.articleId}`,
    {
      method: "DELETE",
      body: { ...deleteBody, expectedUpdatedAt: "2026-08-07T00:00:00.000Z" }
    }
  );
  assert.equal(changedRetry.response.status, 409);
  assert.equal(changedRetry.payload.code, "ARTICLE_OPERATION_CONFLICT");
});

test("governed categories cannot be updated, deleted, or targeted by recategorization", async () => {
  const fixture = createFixture();
  for (const [index, category] of ["site-updates", "daily-ai-news", "tool-radar"].entries()) {
    const protectedPublish = publishPayload(
      `protected-publish-00${index}`,
      `protected-publish-${index}`
    );
    protectedPublish.category = category;
    const publish = await callApi(
      fixture.env,
      fixture.tokens.adminBoth,
      "agent/articles/publish",
      { method: "POST", body: protectedPublish }
    );
    assert.equal(publish.response.status, 409);
    assert.equal(publish.payload.code, "ARTICLE_CATEGORY_PROTECTED");

    const seeded = seedArticle(fixture.DB, {
      articleId: `protected-${index}`,
      slug: `protected-${index}`,
      category,
      updatedAt: `2026-08-07T0${index + 1}:00:00.000Z`
    });
    const update = await callApi(
      fixture.env,
      fixture.tokens.adminBoth,
      `agent/articles/${seeded.articleId}`,
      {
        method: "PUT",
        body: {
          operationId: `protected-update-000${index}`,
          expectedUpdatedAt: seeded.updatedAt,
          isPinned: false
        }
      }
    );
    assert.equal(update.response.status, 409);
    assert.equal(update.payload.code, "ARTICLE_CATEGORY_PROTECTED");

    const deletion = await callApi(
      fixture.env,
      fixture.tokens.adminBoth,
      `agent/articles/${seeded.articleId}`,
      {
        method: "DELETE",
        body: {
          operationId: `protected-delete-000${index}`,
          expectedUpdatedAt: seeded.updatedAt,
          confirm: true
        }
      }
    );
    assert.equal(deletion.response.status, 409);
    assert.equal(deletion.payload.code, "ARTICLE_CATEGORY_PROTECTED");
  }
  const normal = seedArticle(fixture.DB, {
    articleId: "normal-category",
    slug: "normal-category",
    category: "notes",
    updatedAt: "2026-08-07T05:00:00.000Z"
  });
  const recategorize = await callApi(
    fixture.env,
    fixture.tokens.adminBoth,
    `agent/articles/${normal.articleId}`,
    {
      method: "PUT",
      body: {
        operationId: "protected-target-0001",
        expectedUpdatedAt: normal.updatedAt,
        category: "tool-radar"
      }
    }
  );
  assert.equal(recategorize.response.status, 409);
  assert.equal(recategorize.payload.code, "ARTICLE_CATEGORY_PROTECTED");
  assert.equal(count(fixture.DB, "agent_article_receipts"), 0);
});

test("article mutation JSON is strict and enforces field, translation, text, and byte limits", async () => {
  const fixture = createFixture();
  const cases = [];

  const unknown = publishPayload("strict-unknown-0001", "strict-unknown");
  unknown.status = "draft";
  cases.push([unknown, "ARTICLE_PAYLOAD_INVALID"]);

  const missingLanguage = publishPayload("strict-language-0001", "strict-language");
  delete missingLanguage.translations.ja;
  cases.push([missingLanguage, "ARTICLE_TRANSLATIONS_INVALID"]);

  const unknownTranslation = publishPayload("strict-translation-0001", "strict-translation");
  unknownTranslation.translations.zh.html = "<script>";
  cases.push([unknownTranslation, "ARTICLE_TRANSLATIONS_INVALID"]);

  const longTitle = publishPayload("strict-title-0001", "strict-title");
  longTitle.translations.en.title = "x".repeat(181);
  cases.push([longTitle, "ARTICLE_TRANSLATIONS_INVALID"]);

  const longContent = publishPayload("strict-content-0001", "strict-content");
  longContent.translations.en.contentMarkdown = "x".repeat(200_001);
  cases.push([longContent, "ARTICLE_TRANSLATIONS_INVALID"]);

  const tooManyTags = publishPayload("strict-tags-0001", "strict-tags");
  tooManyTags.tags = Array.from({ length: 13 }, (_, index) => `tag-${index}`);
  cases.push([tooManyTags, "ARTICLE_TAGS_INVALID"]);

  const longTag = publishPayload("strict-long-tag-0001", "strict-long-tag");
  longTag.tags = ["x".repeat(41)];
  cases.push([longTag, "ARTICLE_TAGS_INVALID"]);

  const longSlug = publishPayload("strict-long-slug-0001", `a${"b".repeat(120)}`);
  cases.push([longSlug, "ARTICLE_SLUG_INVALID"]);

  const badTimestamp = publishPayload("strict-time-0001", "strict-time");
  badTimestamp.publishedAt = "2026-02-30T00:00:00Z";
  cases.push([badTimestamp, "ARTICLE_TIMESTAMP_INVALID"]);

  for (const [body, expectedCode] of cases) {
    const result = await callApi(
      fixture.env,
      fixture.tokens.adminWrite,
      "agent/articles/publish",
      { method: "POST", body }
    );
    assert.equal(result.response.status, 400);
    assert.equal(result.payload.code, expectedCode);
  }

  const malformed = await callApi(
    fixture.env,
    fixture.tokens.adminWrite,
    "agent/articles/publish",
    { method: "POST", body: "{not-json", raw: true }
  );
  assert.equal(malformed.response.status, 400);
  assert.equal(malformed.payload.code, "ARTICLE_JSON_INVALID");

  const wrongType = await callApi(
    fixture.env,
    fixture.tokens.adminWrite,
    "agent/articles/publish",
    {
      method: "POST",
      body: publishPayload("strict-type-0001", "strict-type"),
      contentType: "text/plain"
    }
  );
  assert.equal(wrongType.response.status, 415);
  assert.equal(wrongType.payload.code, "ARTICLE_CONTENT_TYPE_INVALID");

  const oversized = await callApi(
    fixture.env,
    fixture.tokens.adminWrite,
    "agent/articles/publish",
    {
      method: "POST",
      body: JSON.stringify({ padding: "x".repeat(700 * 1024) }),
      raw: true
    }
  );
  assert.equal(oversized.response.status, 413);
  assert.equal(oversized.payload.code, "ARTICLE_BODY_TOO_LARGE");
  assert.equal(count(fixture.DB, "articles"), 0);
  assert.equal(count(fixture.DB, "agent_audit_log"), 0);
  assert.equal(count(fixture.DB, "agent_article_receipts"), 0);
});
