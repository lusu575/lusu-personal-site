import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const SESSION_TOKEN = "content-edit-cas-session";
const ADMIN_ID = "content-edit-cas-admin";
const ADMIN_EMAIL = "content-edit-cas@example.test";
const INITIAL_VERSION = "2026-07-25T00:00:00.000Z";
const FUTURE_EXPIRY = "2099-01-01T00:00:00.000Z";
const CONFLICT_BODY = Object.freeze({
  error: "内容已被其他编辑更新，请刷新后重试。",
  code: "CONTENT_CONFLICT"
});

const adminSource = await readFile(new URL("../admin/admin.js", import.meta.url), "utf8");
const apiSource = await readFile(new URL("../functions/api/[[route]].js", import.meta.url), "utf8");

test("admin editors carry loaded revisions through saves, refreshes, and deletes", () => {
  for (const revision of [
    "articleUpdatedAt",
    "videoUpdatedAt",
    "videoCategoryUpdatedAt",
    "socialLinksUpdatedAt"
  ]) {
    assert.match(adminSource, new RegExp(`state\\.${revision}`));
  }
  assert.match(adminSource, /payload\.expectedUpdatedAt = state\.articleUpdatedAt/);
  assert.match(adminSource, /payload\.expectedUpdatedAt = state\.videoUpdatedAt/);
  assert.match(adminSource, /payload\.expectedUpdatedAt = state\.videoCategoryUpdatedAt/);
  assert.match(adminSource, /expectedUpdatedAt:\s*state\.socialLinksUpdatedAt/);
  assert.match(adminSource, /refresh-metadata[\s\S]{0,260}expectedUpdatedAt:\s*state\.videoUpdatedAt/);
  assert.match(adminSource, /method:\s*"DELETE"[\s\S]{0,180}expectedUpdatedAt:\s*state\.articleUpdatedAt/);
  assert.match(adminSource, /CONTENT_CONFLICT[\s\S]{0,280}当前输入已保留/);
  assert.match(apiSource, /refreshVideoMetadata[\s\S]*where video_id = \? and updated_at = \?/);
});

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

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Buffer.from(digest).toString("hex");
}

async function callApi(onRequest, db, path, { method = "GET", body } = {}) {
  const headers = new Headers({
    Cookie: `lusu_session=${SESSION_TOKEN}`,
    Origin: "https://example.test"
  });
  const init = { method, headers };
  if (body !== undefined) {
    headers.set("Content-Type", "application/json");
    init.body = JSON.stringify(body);
  }
  const pending = [];
  const response = await onRequest({
    request: new Request(`https://example.test${path}`, init),
    env: {
      DB: db,
      CHAT_IP_HASH_SALT: "content-cas-chat-secret-0000000000001",
      ANALYTICS_IP_HASH_SALT: "content-cas-analytics-secret-00000001"
    },
    waitUntil(promise) {
      pending.push(promise);
    }
  });
  await Promise.all(pending);
  return response;
}

function assertConflict(payload, currentVersion) {
  assert.deepEqual(payload, {
    ...CONFLICT_BODY,
    updatedAt: currentVersion
  });
}

test("admin content editors enforce atomic expectedUpdatedAt preconditions", async (t) => {
  const { onRequest } = await import(
    `../functions/api/[[route]].js?content-edit-cas=${Date.now()}-${Math.random()}`
  );
  const db = new D1Database();

  try {
    const health = await callApi(onRequest, db, "/api/health");
    assert.equal(health.status, 200);
    assert.equal(health.headers.get("X-Content-Type-Options"), "nosniff");
    assert.match(health.headers.get("Content-Security-Policy") || "", /default-src 'none'/);
    assert.equal(health.headers.get("X-Frame-Options"), "DENY");
    db.sqlite.prepare(`
      insert into users (id, email, password_hash, role, created_at, updated_at)
      values (?, ?, '', 'admin', ?, ?)
    `).run(ADMIN_ID, ADMIN_EMAIL, INITIAL_VERSION, INITIAL_VERSION);
    db.sqlite.prepare(`
      insert into sessions (token_hash, user_id, created_at, expires_at)
      values (?, ?, ?, ?)
    `).run(await sha256Hex(SESSION_TOKEN), ADMIN_ID, INITIAL_VERSION, FUTURE_EXPIRY);

    await t.test("articles reject a stale editor without overwriting the newer row", async () => {
      const initialized = await callApi(onRequest, db, "/api/admin/articles");
      assert.equal(initialized.status, 200, await initialized.clone().text());
      db.sqlite.prepare(`
        insert into articles (
          article_id, slug, category, tags, cover_image, status, is_pinned,
          view_count, created_at, updated_at, published_at
        ) values ('cas-article', 'cas-article', 'note', '[]', '', 'draft', 0, 0, ?, ?, null)
      `).run(INITIAL_VERSION, INITIAL_VERSION);
      db.sqlite.prepare(`
        insert into article_translations (
          translation_id, article_id, lang, title, summary, content_markdown, created_at, updated_at
        ) values ('cas-article-zh', 'cas-article', 'zh', '旧标题', '', '旧正文', ?, ?)
      `).run(INITIAL_VERSION, INITIAL_VERSION);

      const saved = await callApi(onRequest, db, "/api/admin/articles/cas-article", {
        method: "PUT",
        body: {
          expectedUpdatedAt: INITIAL_VERSION,
          status: "published",
          translations: {
            zh: { title: "新标题", summary: "", content_markdown: "新正文" }
          }
        }
      });
      assert.equal(saved.status, 200, await saved.clone().text());
      const savedPayload = await saved.json();
      assert.equal(savedPayload.ok, true);
      assert.ok(Date.parse(savedPayload.updatedAt) > Date.parse(INITIAL_VERSION));

      const stale = await callApi(onRequest, db, "/api/admin/articles/cas-article", {
        method: "PUT",
        body: {
          expectedUpdatedAt: INITIAL_VERSION,
          status: "draft",
          translations: {
            zh: { title: "陈旧标题", summary: "", content_markdown: "陈旧正文" }
          }
        }
      });
      assert.equal(stale.status, 409);
      assertConflict(await stale.json(), savedPayload.updatedAt);
      const row = db.sqlite.prepare(
        "select status, updated_at from articles where article_id = 'cas-article'"
      ).get();
      assert.deepEqual({ ...row }, { status: "published", updated_at: savedPayload.updatedAt });
      const translation = db.sqlite.prepare(
        "select title, content_markdown, updated_at from article_translations where article_id = 'cas-article' and lang = 'zh'"
      ).get();
      assert.deepEqual({ ...translation }, {
        title: "新标题",
        content_markdown: "新正文",
        updated_at: savedPayload.updatedAt
      });
      const staleDelete = await callApi(onRequest, db, "/api/admin/articles/cas-article", {
        method: "DELETE",
        body: { expectedUpdatedAt: INITIAL_VERSION }
      });
      assert.equal(staleDelete.status, 409);
      assertConflict(await staleDelete.json(), savedPayload.updatedAt);
      assert.equal(
        db.sqlite.prepare("select count(*) as count from articles where article_id = 'cas-article'").get().count,
        1
      );
    });

    await t.test("videos reject stale writes before replacing category relations", async () => {
      const initialized = await callApi(onRequest, db, "/api/admin/video-categories");
      assert.equal(initialized.status, 200, await initialized.clone().text());
      db.sqlite.prepare(`
        insert into video_categories (
          category_id, slug, name_zh, name_en, name_ja, sort_order, enabled, created_at, updated_at
        ) values (?, ?, ?, '', '', 0, 1, ?, ?)
      `).run("cas-video-new-category", "cas-video-new-category", "新关系", INITIAL_VERSION, INITIAL_VERSION);
      db.sqlite.prepare(`
        insert into video_categories (
          category_id, slug, name_zh, name_en, name_ja, sort_order, enabled, created_at, updated_at
        ) values (?, ?, ?, '', '', 0, 1, ?, ?)
      `).run("cas-video-stale-category", "cas-video-stale-category", "陈旧关系", INITIAL_VERSION, INITIAL_VERSION);
      db.sqlite.prepare(`
        insert into videos (
          video_id, platform, original_url, external_id, embed_url, title, description,
          thumbnail_url, author_name, published_at, status, sort_order, pinned,
          pinned_sort_order, metadata_error, created_at, updated_at
        ) values (
          'cas-video', 'youtube', 'https://www.youtube.com/watch?v=casvideo001',
          'casvideo001', 'https://www.youtube.com/embed/casvideo001', 'Old title', '',
          '', '', null, 'draft', 0, 0, 0, '', ?, ?
        )
      `).run(INITIAL_VERSION, INITIAL_VERSION);

      const videoBody = {
        expectedUpdatedAt: INITIAL_VERSION,
        original_url: "https://www.youtube.com/watch?v=casvideo001",
        title: "New title",
        description: "",
        thumbnail_url: "",
        author_name: "",
        published_at: null,
        status: "published",
        sort_order: 0,
        pinned: false,
        pinned_sort_order: 0,
        category_ids: ["cas-video-new-category"]
      };
      const saved = await callApi(onRequest, db, "/api/admin/videos/cas-video", {
        method: "PUT",
        body: videoBody
      });
      assert.equal(saved.status, 200, await saved.clone().text());
      const savedPayload = await saved.json();

      const stale = await callApi(onRequest, db, "/api/admin/videos/cas-video", {
        method: "PUT",
        body: {
          ...videoBody,
          title: "Stale title",
          category_ids: ["cas-video-stale-category"]
        }
      });
      assert.equal(stale.status, 409);
      assertConflict(await stale.json(), savedPayload.updatedAt);
      const row = db.sqlite.prepare(
        "select title, status, updated_at from videos where video_id = 'cas-video'"
      ).get();
      assert.deepEqual({ ...row }, {
        title: "New title",
        status: "published",
        updated_at: savedPayload.updatedAt
      });
      const relations = db.sqlite.prepare(`
        select category_id from video_category_relations
        where video_id = 'cas-video'
        order by sort_order asc
      `).all().map((item) => item.category_id);
      assert.deepEqual(relations, ["cas-video-new-category"]);
      const staleDelete = await callApi(onRequest, db, "/api/admin/videos/cas-video", {
        method: "DELETE",
        body: { expectedUpdatedAt: INITIAL_VERSION }
      });
      assert.equal(staleDelete.status, 409);
      assertConflict(await staleDelete.json(), savedPayload.updatedAt);
    });

    await t.test("video categories use the same versioned 409 contract", async () => {
      db.sqlite.prepare(`
        insert into video_categories (
          category_id, slug, name_zh, name_en, name_ja, sort_order, enabled, created_at, updated_at
        ) values ('cas-category', 'cas-category', '旧分类', 'Old', '旧', 1, 1, ?, ?)
      `).run(INITIAL_VERSION, INITIAL_VERSION);
      const saved = await callApi(onRequest, db, "/api/admin/video-categories/cas-category", {
        method: "PUT",
        body: {
          expectedUpdatedAt: INITIAL_VERSION,
          slug: "cas-category",
          name_zh: "新分类",
          name_en: "New",
          name_ja: "新",
          sort_order: 2,
          enabled: true
        }
      });
      assert.equal(saved.status, 200, await saved.clone().text());
      const savedPayload = await saved.json();

      const stale = await callApi(onRequest, db, "/api/admin/video-categories/cas-category", {
        method: "PUT",
        body: {
          expectedUpdatedAt: INITIAL_VERSION,
          slug: "cas-category",
          name_zh: "陈旧分类",
          name_en: "Stale",
          name_ja: "古い",
          sort_order: 3,
          enabled: false
        }
      });
      assert.equal(stale.status, 409);
      assertConflict(await stale.json(), savedPayload.updatedAt);
      const row = db.sqlite.prepare(
        "select name_zh, enabled, updated_at from video_categories where category_id = 'cas-category'"
      ).get();
      assert.deepEqual({ ...row }, {
        name_zh: "新分类",
        enabled: 1,
        updated_at: savedPayload.updatedAt
      });
      const staleDelete = await callApi(onRequest, db, "/api/admin/video-categories/cas-category", {
        method: "DELETE",
        body: { expectedUpdatedAt: INITIAL_VERSION }
      });
      assert.equal(staleDelete.status, 409);
      assertConflict(await staleDelete.json(), savedPayload.updatedAt);
    });

    await t.test("social links support null first-write CAS and reject stale tabs", async () => {
      const first = await callApi(onRequest, db, "/api/admin/social-links", {
        method: "PUT",
        body: {
          expectedUpdatedAt: null,
          links: { github: "https://github.com/first" }
        }
      });
      assert.equal(first.status, 200, await first.clone().text());
      const firstPayload = await first.json();
      assert.match(firstPayload.updatedAt, /^\d{4}-\d{2}-\d{2}T/);

      const saved = await callApi(onRequest, db, "/api/admin/social-links", {
        method: "PUT",
        body: {
          expectedUpdatedAt: firstPayload.updatedAt,
          links: { github: "https://github.com/newer" }
        }
      });
      assert.equal(saved.status, 200, await saved.clone().text());
      const savedPayload = await saved.json();

      const stale = await callApi(onRequest, db, "/api/admin/social-links", {
        method: "PUT",
        body: {
          expectedUpdatedAt: firstPayload.updatedAt,
          links: { github: "https://github.com/stale" }
        }
      });
      assert.equal(stale.status, 409);
      assertConflict(await stale.json(), savedPayload.updatedAt);
      const row = db.sqlite.prepare(
        "select value, updated_at from site_runtime_state where key = 'about_social_links'"
      ).get();
      assert.equal(JSON.parse(row.value).github, "https://github.com/newer");
      assert.equal(row.updated_at, savedPayload.updatedAt);
    });
  } finally {
    db.close();
  }
});
