import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const ORIGIN = "https://example.test";
const SESSION_TOKEN = "daily-ai-news-admin-session";
const ADMIN_ID = "daily-ai-news-admin";
const INITIAL_TIME = "2026-07-27T00:00:00.000Z";
const FUTURE_EXPIRY = "2099-01-01T00:00:00.000Z";

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

function request(path, {
  method = "GET",
  body,
  token = "",
  admin = false,
  includeBrowserOrigin = admin
} = {}) {
  const headers = new Headers();
  if (admin) {
    headers.set("Cookie", `lusu_session=${SESSION_TOKEN}`);
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (body !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  if (includeBrowserOrigin && method !== "GET" && method !== "HEAD") {
    headers.set("Origin", ORIGIN);
    headers.set("Sec-Fetch-Site", "same-origin");
  }
  return new Request(`${ORIGIN}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

async function invoke(onRequest, DB, apiRequest) {
  return onRequest({
    request: apiRequest,
    env: {
      DB,
      CHAT_IP_HASH_SALT: "daily-ai-news-chat-secret-00000000001",
      ANALYTICS_IP_HASH_SALT: "daily-ai-news-analytics-secret-0000001"
    },
    waitUntil() {}
  });
}

function translations(label = "first") {
  return {
    zh: {
      title: `测试新闻 ${label}`,
      summary: "测试简介",
      content_markdown: `# 测试新闻 ${label}\n\n这是一篇自动投递草稿。`
    },
    en: {
      title: `Test news ${label}`,
      summary: "Test summary",
      content_markdown: `# Test news ${label}\n\nThis is an automated draft.`
    },
    ja: {
      title: `テストニュース ${label}`,
      summary: "テスト概要",
      content_markdown: `# テストニュース ${label}\n\n自動投稿の下書きです。`
    }
  };
}

test("Daily AI News automation defaults to drafts and can explicitly auto-publish idempotently", async () => {
  const moduleUrl = new URL("../functions/api/[[route]].js", import.meta.url);
  moduleUrl.searchParams.set("daily-ai-news", `${Date.now()}-${Math.random()}`);
  const { onRequest } = await import(moduleUrl.href);
  const DB = new D1Database();

  try {
    const initialized = await invoke(onRequest, DB, request("/api/health"));
    assert.equal(initialized.status, 200, await initialized.clone().text());

    const anonymousDelivery = await invoke(onRequest, DB, request(
      "/api/automation/daily-ai-news",
      {
        method: "POST",
        token: "lusu_ai_news_invalid-credential-that-will-not-match",
        body: {
          idempotencyKey: "daily-ai-news-anonymous-test",
          slug: "daily-ai-news-anonymous-test",
          translations: translations("anonymous")
        }
      }
    ));
    assert.equal(anonymousDelivery.status, 401);
    assert.equal((await anonymousDelivery.json()).code, "AUTOMATION_UNAUTHORIZED");
    assert.equal(
      DB.sqlite.prepare(
        "select count(*) as count from sqlite_master where type = 'table' and name = 'articles'"
      ).get().count,
      0
    );
    assert.equal(
      DB.sqlite.prepare(
        "select count(*) as count from sqlite_master where type = 'table' and name = 'article_delivery_channels'"
      ).get().count,
      1
    );
    assert.equal(
      DB.sqlite.prepare(
        "select count(*) as count from sqlite_master where type = 'table' and name = 'article_delivery_events'"
      ).get().count,
      0
    );

    DB.sqlite.prepare(`
      insert into users (id, email, password_hash, role, created_at, updated_at)
      values (?, 'admin@example.test', '', 'admin', ?, ?)
    `).run(ADMIN_ID, INITIAL_TIME, INITIAL_TIME);
    DB.sqlite.prepare(`
      insert into sessions (token_hash, user_id, created_at, expires_at)
      values (?, ?, ?, ?)
    `).run(await sha256Hex(SESSION_TOKEN), ADMIN_ID, INITIAL_TIME, FUTURE_EXPIRY);

    const firstRead = await invoke(
      onRequest,
      DB,
      request("/api/admin/automation/daily-ai-news", { admin: true })
    );
    assert.equal(firstRead.status, 200, await firstRead.clone().text());
    const initial = await firstRead.json();
    assert.equal(initial.channel.category, "daily-ai-news");
    assert.equal(initial.channel.enabled, false);
    assert.equal(initial.channel.autoPublish, false);
    assert.equal(initial.channel.tokenConfigured, false);
    assert.equal(JSON.stringify(initial).includes("token_hash"), false);

    const generatedResponse = await invoke(onRequest, DB, request(
      "/api/admin/automation/daily-ai-news/token",
      {
        method: "POST",
        admin: true,
        body: { expectedUpdatedAt: initial.channel.updatedAt }
      }
    ));
    assert.equal(generatedResponse.status, 200, await generatedResponse.clone().text());
    const generated = await generatedResponse.json();
    assert.match(generated.token, /^lusu_ai_news_[a-zA-Z0-9_-]{32,128}$/);
    assert.equal(generated.channel.tokenConfigured, true);
    assert.equal(generated.channel.enabled, false);
    assert.equal(generated.channel.autoPublish, false);
    const storedCredential = DB.sqlite.prepare(`
      select token_hash, token_hint from article_delivery_channels where channel_key = 'daily-ai-news'
    `).get();
    assert.equal(storedCredential.token_hash, await sha256Hex(generated.token));
    assert.notEqual(storedCredential.token_hash, generated.token);
    assert.equal(storedCredential.token_hint, generated.token.slice(-6));

    const secondRead = await invoke(
      onRequest,
      DB,
      request("/api/admin/automation/daily-ai-news", { admin: true })
    );
    const secondPayload = await secondRead.json();
    assert.equal(Object.hasOwn(secondPayload.channel, "token"), false);
    assert.equal(JSON.stringify(secondPayload).includes(generated.token), false);

    const pausedDelivery = await invoke(onRequest, DB, request(
      "/api/automation/daily-ai-news",
      {
        method: "POST",
        token: generated.token,
        body: {
          idempotencyKey: "daily-ai-news-paused-test",
          slug: "daily-ai-news-paused-test",
          translations: translations("paused")
        }
      }
    ));
    assert.equal(pausedDelivery.status, 409);
    assert.equal((await pausedDelivery.json()).code, "AUTOMATION_DISABLED");

    const staleEnable = await invoke(onRequest, DB, request(
      "/api/admin/automation/daily-ai-news",
      {
        method: "PUT",
        admin: true,
        body: { enabled: true, expectedUpdatedAt: initial.channel.updatedAt }
      }
    ));
    assert.equal(staleEnable.status, 409);
    assert.equal((await staleEnable.json()).code, "CONTENT_CONFLICT");

    const enabledResponse = await invoke(onRequest, DB, request(
      "/api/admin/automation/daily-ai-news",
      {
        method: "PUT",
        admin: true,
        body: { enabled: true, expectedUpdatedAt: generated.channel.updatedAt }
      }
    ));
    assert.equal(enabledResponse.status, 200, await enabledResponse.clone().text());
    const enabled = await enabledResponse.json();
    assert.equal(enabled.channel.enabled, true);
    assert.equal(enabled.channel.autoPublish, false);

    const rejectedOverride = await invoke(onRequest, DB, request(
      "/api/automation/daily-ai-news",
      {
        method: "POST",
        token: generated.token,
        body: {
          idempotencyKey: "daily-ai-news-override-test",
          slug: "daily-ai-news-override-test",
          status: "published",
          translations: translations("override")
        }
      }
    ));
    assert.equal(rejectedOverride.status, 400);

    const deliveryBody = {
      idempotencyKey: "daily-ai-news-2026-07-27-test",
      slug: "daily-ai-news-2026-07-27-test",
      tags: ["测试来源"],
      source: "Codex local test",
      translations: translations()
    };
    const deliveredResponse = await invoke(onRequest, DB, request(
      "/api/automation/daily-ai-news",
      { method: "POST", token: generated.token, body: deliveryBody }
    ));
    assert.equal(deliveredResponse.status, 201, await deliveredResponse.clone().text());
    const delivered = await deliveredResponse.json();
    assert.equal(delivered.duplicate, false);
    assert.equal(delivered.category, "daily-ai-news");
    assert.equal(delivered.status, "draft");

    const storedArticle = DB.sqlite.prepare(`
      select category, status, is_pinned, cover_image, published_at
      from articles where article_id = ?
    `).get(delivered.articleId);
    assert.deepEqual({ ...storedArticle }, {
      category: "daily-ai-news",
      status: "draft",
      is_pinned: 0,
      cover_image: "",
      published_at: null
    });
    assert.equal(
      DB.sqlite.prepare(
        "select count(*) as count from article_translations where article_id = ?"
      ).get(delivered.articleId).count,
      3
    );

    const repeatedResponse = await invoke(onRequest, DB, request(
      "/api/automation/daily-ai-news",
      { method: "POST", token: generated.token, body: deliveryBody }
    ));
    assert.equal(repeatedResponse.status, 200, await repeatedResponse.clone().text());
    const repeated = await repeatedResponse.json();
    assert.equal(repeated.duplicate, true);
    assert.equal(repeated.articleId, delivered.articleId);
    assert.equal(
      DB.sqlite.prepare(
        "select count(*) as count from article_delivery_events where idempotency_key = ?"
      ).get(deliveryBody.idempotencyKey).count,
      1
    );
    assert.match(
      DB.sqlite.prepare(
        "select payload_hash from article_delivery_events where idempotency_key = ?"
      ).get(deliveryBody.idempotencyKey).payload_hash,
      /^[a-f0-9]{64}$/
    );

    const conflictingReplay = await invoke(onRequest, DB, request(
      "/api/automation/daily-ai-news",
      {
        method: "POST",
        token: generated.token,
        body: {
          ...deliveryBody,
          slug: "daily-ai-news-different-content",
          translations: translations("different")
        }
      }
    ));
    assert.equal(conflictingReplay.status, 409);
    assert.equal((await conflictingReplay.json()).code, "IDEMPOTENCY_CONFLICT");

    const publicList = await invoke(
      onRequest,
      DB,
      request("/api/articles?lang=zh&category=daily-ai-news")
    );
    assert.equal(publicList.status, 200, await publicList.clone().text());
    const publicPayload = await publicList.json();
    assert.ok(publicPayload.articles.some((article) => article.slug === "daily-ai-news-test-placeholder"));
    assert.equal(publicPayload.articles.some((article) => article.slug === deliveryBody.slug), false);

    const adminSnapshot = await invoke(
      onRequest,
      DB,
      request("/api/admin/automation/daily-ai-news", { admin: true })
    );
    const snapshot = await adminSnapshot.json();
    assert.equal(snapshot.channel.draftCount, 1);
    assert.equal(snapshot.deliveries.length, 1);
    assert.equal(snapshot.deliveries[0].slug, deliveryBody.slug);
    assert.equal(JSON.stringify(snapshot).includes("自动投递草稿"), false);
    assert.equal(JSON.stringify(snapshot).includes(generated.token), false);

    const autoPublishResponse = await invoke(onRequest, DB, request(
      "/api/admin/automation/daily-ai-news",
      {
        method: "PUT",
        admin: true,
        body: { autoPublish: true, expectedUpdatedAt: snapshot.channel.updatedAt }
      }
    ));
    assert.equal(autoPublishResponse.status, 200, await autoPublishResponse.clone().text());
    const autoPublishEnabled = await autoPublishResponse.json();
    assert.equal(autoPublishEnabled.channel.enabled, true);
    assert.equal(autoPublishEnabled.channel.autoPublish, true);

    const publishedBody = {
      idempotencyKey: "daily-ai-news-2026-07-27-published-test",
      slug: "daily-ai-news-2026-07-27-published-test",
      tags: ["测试来源"],
      source: "Codex local published test",
      translations: translations("published")
    };
    const publishedResponse = await invoke(onRequest, DB, request(
      "/api/automation/daily-ai-news",
      { method: "POST", token: generated.token, body: publishedBody }
    ));
    assert.equal(publishedResponse.status, 201, await publishedResponse.clone().text());
    const published = await publishedResponse.json();
    assert.equal(published.duplicate, false);
    assert.equal(published.status, "published");
    const storedPublishedArticle = DB.sqlite.prepare(`
      select category, status, is_pinned, cover_image, published_at
      from articles where article_id = ?
    `).get(published.articleId);
    assert.equal(storedPublishedArticle.category, "daily-ai-news");
    assert.equal(storedPublishedArticle.status, "published");
    assert.equal(storedPublishedArticle.is_pinned, 0);
    assert.equal(storedPublishedArticle.cover_image, "");
    assert.ok(Number.isFinite(Date.parse(storedPublishedArticle.published_at)));
    assert.equal(
      DB.sqlite.prepare(
        "select count(*) as count from article_translations where article_id = ?"
      ).get(published.articleId).count,
      3
    );
    assert.equal(
      DB.sqlite.prepare(
        "select status from article_delivery_events where idempotency_key = ?"
      ).get(publishedBody.idempotencyKey).status,
      "published"
    );

    const repeatedPublishedResponse = await invoke(onRequest, DB, request(
      "/api/automation/daily-ai-news",
      { method: "POST", token: generated.token, body: publishedBody }
    ));
    assert.equal(
      repeatedPublishedResponse.status,
      200,
      await repeatedPublishedResponse.clone().text()
    );
    const repeatedPublished = await repeatedPublishedResponse.json();
    assert.equal(repeatedPublished.duplicate, true);
    assert.equal(repeatedPublished.articleId, published.articleId);
    assert.equal(repeatedPublished.status, "published");
    assert.equal(
      DB.sqlite.prepare(
        "select count(*) as count from article_delivery_events where idempotency_key = ?"
      ).get(publishedBody.idempotencyKey).count,
      1
    );

    const publicListAfterAutoPublish = await invoke(
      onRequest,
      DB,
      request("/api/articles?lang=zh&category=daily-ai-news")
    );
    assert.equal(
      publicListAfterAutoPublish.status,
      200,
      await publicListAfterAutoPublish.clone().text()
    );
    const publicAfterAutoPublish = await publicListAfterAutoPublish.json();
    assert.ok(publicAfterAutoPublish.articles.some((article) => article.slug === publishedBody.slug));
    assert.equal(publicAfterAutoPublish.articles.some((article) => article.slug === deliveryBody.slug), false);

    const publishedSnapshotResponse = await invoke(
      onRequest,
      DB,
      request("/api/admin/automation/daily-ai-news", { admin: true })
    );
    const publishedSnapshot = await publishedSnapshotResponse.json();
    assert.equal(publishedSnapshot.channel.draftCount, 1);
    assert.equal(publishedSnapshot.deliveries.length, 2);
    assert.equal(
      publishedSnapshot.deliveries.find((item) => item.slug === publishedBody.slug)?.status,
      "published"
    );

    DB.sqlite.prepare("delete from articles where article_id = ?").run(delivered.articleId);
    const missingTargetReplay = await invoke(onRequest, DB, request(
      "/api/automation/daily-ai-news",
      { method: "POST", token: generated.token, body: deliveryBody }
    ));
    assert.equal(missingTargetReplay.status, 409);
    assert.equal((await missingTargetReplay.json()).code, "IDEMPOTENCY_TARGET_MISSING");

    const revokedResponse = await invoke(onRequest, DB, request(
      "/api/admin/automation/daily-ai-news/token",
      {
        method: "DELETE",
        admin: true,
        body: { expectedUpdatedAt: publishedSnapshot.channel.updatedAt }
      }
    ));
    assert.equal(revokedResponse.status, 200, await revokedResponse.clone().text());
    const revoked = await revokedResponse.json();
    assert.equal(revoked.channel.enabled, false);
    assert.equal(revoked.channel.autoPublish, false);
    assert.equal(revoked.channel.tokenConfigured, false);
    assert.equal(
      DB.sqlite.prepare(
        "select auto_publish from article_delivery_channels where channel_key = 'daily-ai-news'"
      ).get().auto_publish,
      0
    );

    const rejectedOldToken = await invoke(onRequest, DB, request(
      "/api/automation/daily-ai-news",
      {
        method: "POST",
        token: generated.token,
        body: {
          idempotencyKey: "daily-ai-news-revoked-token",
          slug: "daily-ai-news-revoked-token",
          translations: translations("revoked")
        }
      }
    ));
    assert.equal(rejectedOldToken.status, 401);
    assert.equal((await rejectedOldToken.json()).code, "AUTOMATION_UNAUTHORIZED");
  } finally {
    DB.close();
  }
});

test("Daily AI News runtime schema adds auto_publish before seeding a legacy channel table", async () => {
  const moduleUrl = new URL("../functions/api/[[route]].js", import.meta.url);
  moduleUrl.searchParams.set("daily-ai-news-legacy", `${Date.now()}-${Math.random()}`);
  const { onRequest } = await import(moduleUrl.href);
  const DB = new D1Database();

  try {
    const initialized = await invoke(onRequest, DB, request("/api/health"));
    assert.equal(initialized.status, 200, await initialized.clone().text());
    DB.sqlite.exec(`
      create table article_delivery_channels (
        channel_key text primary key,
        category text not null,
        enabled integer not null default 0,
        token_hash text not null default '',
        token_hint text not null default '',
        token_created_at text,
        last_used_at text,
        created_at text not null,
        updated_at text not null
      );
      insert into article_delivery_channels (
        channel_key, category, enabled, token_hash, token_hint,
        token_created_at, last_used_at, created_at, updated_at
      ) values (
        'daily-ai-news', 'daily-ai-news', 0, '', '',
        null, null, '2026-07-27T00:00:00.000Z', '2026-07-27T00:00:00.000Z'
      );
    `);
    DB.sqlite.prepare(`
      insert into users (id, email, password_hash, role, created_at, updated_at)
      values (?, 'legacy-admin@example.test', '', 'admin', ?, ?)
    `).run(ADMIN_ID, INITIAL_TIME, INITIAL_TIME);
    DB.sqlite.prepare(`
      insert into sessions (token_hash, user_id, created_at, expires_at)
      values (?, ?, ?, ?)
    `).run(await sha256Hex(SESSION_TOKEN), ADMIN_ID, INITIAL_TIME, FUTURE_EXPIRY);

    const response = await invoke(
      onRequest,
      DB,
      request("/api/admin/automation/daily-ai-news", { admin: true })
    );
    assert.equal(response.status, 200, await response.clone().text());
    const payload = await response.json();
    assert.equal(payload.channel.autoPublish, false);
    assert.ok(
      DB.sqlite.prepare("pragma table_info(article_delivery_channels)").all()
        .some((column) => (
          column.name === "auto_publish"
          && column.notnull === 1
          && String(column.dflt_value) === "0"
        ))
    );
    assert.equal(
      DB.sqlite.prepare(
        "select auto_publish from article_delivery_channels where channel_key = 'daily-ai-news'"
      ).get().auto_publish,
      0
    );
  } finally {
    DB.close();
  }
});
