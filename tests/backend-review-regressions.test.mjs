import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { normalizeArticleTags, normalizeHistoricalArticleTags } from "../functions/api/article-tags.mjs";
import { runPeriodicDataCleanup, DATA_CLEANUP_STATE_KEY, DATA_CLEANUP_LEASE_KEY } from "../functions/api/data-cleanup-service.mjs";

class D1 {
  constructor() { this.sqlite = new DatabaseSync(":memory:"); this.sqlite.exec("pragma foreign_keys=on"); this.failBatches = 0; }
  prepare(sql) {
    const DB = this;
    function statement(values = []) {
      return {
        sql, values, bind: (...values) => statement(values),
        first: async () => {
          const row = DB.sqlite.prepare(sql).get(...values) || null;
          if (DB.afterFirst) await DB.afterFirst(sql, values, row);
          return row;
        },
        all: async () => ({ results: DB.sqlite.prepare(sql).all(...values) }),
        run: async () => ({ success: true, meta: { changes: Number(DB.sqlite.prepare(sql).run(...values).changes) } })
      };
    }
    return statement();
  }
  async batch(statements) {
    if (this.beforeBatch) await this.beforeBatch(statements);
    if (this.failBatches > 0) { this.failBatches -= 1; throw new Error("Injected database failure"); }
    this.sqlite.exec("begin immediate");
    try {
      const result = [];
      for (const item of statements) result.push(await item.run());
      this.sqlite.exec("commit");
      return result;
    } catch (error) { this.sqlite.exec("rollback"); throw error; }
  }
}

async function authFixture(t) {
  const DB = new D1();
  t.after(() => DB.sqlite.close());
  const { onRequest } = await import(`../functions/api/[[route]].js?auth-regression=${crypto.randomUUID()}`);
  const env = { DB, CHAT_IP_HASH_SALT: "fixture-chat-private-salt-for-test-000000", ANALYTICS_IP_HASH_SALT: "fixture-analytics-private-test-salt-0000" };
  const call = async (path, body) => {
    const request = new Request(`https://example.test/api/${path}`, body ? {
      method: "POST", headers: { "Content-Type": "application/json", Origin: "https://example.test", "CF-Connecting-IP": "203.0.113.89" },
      body: JSON.stringify(body)
    } : undefined);
    const pending = [];
    const response = await onRequest({ request, env, waitUntil: (promise) => pending.push(promise) });
    await Promise.all(pending);
    return response;
  };
  assert.equal((await call("health")).status, 200);
  return { DB, call, env, onRequest };
}

test("registration and login issue valid sessions even when login-event writes fail", async (t) => {
  const { DB, call } = await authFixture(t);
  DB.sqlite.exec("create trigger reject_auth_telemetry before insert on user_login_events begin select raise(abort, 'telemetry unavailable'); end");
  const account = { email: "analytics-fixture@example.test", password: "test-fixture-password" };
  const registered = await call("auth/register", account);
  assert.equal(registered.status, 201, await registered.clone().text());
  assert.match(registered.headers.get("Set-Cookie"), /lusu_session=/);
  assert.equal(DB.sqlite.prepare("select count(*) as n from sessions").get().n, 1);
  assert.equal(DB.sqlite.prepare("select count(*) as n from users").get().n, 1);
  const loggedIn = await call("auth/login", account);
  assert.equal(loggedIn.status, 200, await loggedIn.clone().text());
  assert.equal(DB.sqlite.prepare("select count(*) as n from sessions").get().n, 2);
});

test("a failed first session rolls registration back so the same credentials can retry", async (t) => {
  const { DB, call } = await authFixture(t);
  DB.sqlite.exec("create trigger reject_session before insert on sessions begin select raise(abort, 'session unavailable'); end");
  const account = { email: "rollback-fixture@example.test", password: "test-fixture-password" };
  const failed = await call("auth/register", account);
  assert.equal(failed.status, 500);
  assert.equal(failed.headers.get("Set-Cookie"), null);
  assert.equal(DB.sqlite.prepare("select count(*) as n from users").get().n, 0);
  assert.equal(DB.sqlite.prepare("select count(*) as n from sessions").get().n, 0);
  DB.sqlite.exec("drop trigger reject_session");
  const recovered = await call("auth/register", account);
  assert.equal(recovered.status, 201, await recovered.clone().text());
  assert.equal(DB.sqlite.prepare("select count(*) as n from users").get().n, 1);
});

test("delivery tag normalization deduplicates case and localized aliases after truncation", () => {
  assert.deepEqual(normalizeArticleTags(["每日AI新闻", "AI", "Daily AI News", " ai ", "AＩ", "Custom"]), ["每日AI新闻", "AI", "Custom"]);
  assert.deepEqual(normalizeArticleTags(["longer-one", "longer-two"], { maxLength: 6 }), ["longer"]);
});

test("historical tag cleanup preserves every distinct custom label and malformed legacy rows", async (t) => {
  const DB = new D1(); t.after(() => DB.sqlite.close());
  DB.sqlite.exec("create table articles (article_id text primary key, tags text, updated_at text)");
  const tags = ["AI", "ai", ...Array.from({ length: 20 }, (_, index) => `custom-${index}`), "工具雷达", "Tool Radar", "ＡＢＣ Custom Label"];
  DB.sqlite.prepare("insert into articles values (?, ?, ?)").run("one", JSON.stringify(tags), "editor-date");
  DB.sqlite.prepare("insert into articles values ('two', 'malformed-json', 'editor-date')").run();
  assert.equal(await normalizeHistoricalArticleTags({ DB }), 1);
  const row = DB.sqlite.prepare("select * from articles where article_id = 'one'").get();
  assert.equal(JSON.parse(row.tags).length, 23);
  assert.equal(JSON.parse(row.tags).at(-1), "ＡＢＣ Custom Label");
  assert.equal(row.updated_at, "editor-date");
  assert.equal(DB.sqlite.prepare("select tags from articles where article_id = 'two'").get().tags, "malformed-json");
  assert.equal(await normalizeHistoricalArticleTags({ DB }), 0);
});

function cleanupFixture(t, count = 6001) {
  const DB = new D1(); t.after(() => DB.sqlite.close());
  DB.sqlite.exec("create table site_runtime_state (key text primary key, value text not null, updated_at text not null); create table analytics_page_views (event_id text primary key, created_at text not null)");
  const insert = DB.sqlite.prepare("insert into analytics_page_views values (?, ?)");
  DB.sqlite.exec("begin");
  for (let index = 0; index < count; index += 1) insert.run(`expired-${index}`, "2000-01-01T00:00:00.000Z");
  insert.run("current", "2099-01-01T00:00:00.000Z");
  DB.sqlite.exec("commit");
  return DB;
}

test("cleanup drains more than a single batch and marks success only after catching up", async (t) => {
  const DB = cleanupFixture(t);
  assert.equal(await runPeriodicDataCleanup({ DB }), true);
  assert.equal(DB.sqlite.prepare("select count(*) as n from analytics_page_views").get().n, 1);
  assert.equal(DB.sqlite.prepare("select value from site_runtime_state where key = ?").get(DATA_CLEANUP_STATE_KEY).value, "complete");
  assert.equal(await runPeriodicDataCleanup({ DB }), false);
});

test("failed cleanup releases its lease without suppressing a subsequent retry", async (t) => {
  const DB = cleanupFixture(t);
  DB.failBatches = 2;
  await assert.rejects(runPeriodicDataCleanup({ DB }), /Injected/);
  assert.equal(DB.sqlite.prepare("select count(*) as n from site_runtime_state").get().n, 0);
  assert.equal(await runPeriodicDataCleanup({ DB }), true);
  assert.equal(DB.sqlite.prepare("select count(*) as n from analytics_page_views").get().n, 1);
});

test("cleanup resumes bounded work and never steals an active lease", async (t) => {
  const DB = cleanupFixture(t);
  assert.equal(await runPeriodicDataCleanup({ DB }, { maxRounds: 1 }), false);
  assert.equal(DB.sqlite.prepare("select count(*) as n from analytics_page_views").get().n, 1002);
  assert.equal(DB.sqlite.prepare("select count(*) as n from site_runtime_state where key = ?").get(DATA_CLEANUP_STATE_KEY).n, 0);
  DB.sqlite.prepare("insert into site_runtime_state values (?, 'other-owner', '2099-01-01T00:00:00.000Z')").run(DATA_CLEANUP_LEASE_KEY);
  assert.equal(await runPeriodicDataCleanup({ DB }), false);
  DB.sqlite.prepare("delete from site_runtime_state where key = ?").run(DATA_CLEANUP_LEASE_KEY);
  assert.equal(await runPeriodicDataCleanup({ DB }), true);
  assert.equal(DB.sqlite.prepare("select count(*) as n from analytics_page_views").get().n, 1);
});

test("incremental content migration preserves edited history and records a durable release version", async (t) => {
  const { readFile } = await import("node:fs/promises");
  const { ARTICLE_SEED_VERSION, HISTORICAL_ARTICLE_BASELINE } = await import("../functions/api/content-migrations.mjs");
  const { DB, call } = await authFixture(t);
  DB.sqlite.exec(await readFile(new URL("../cloudflare/schema.sql", import.meta.url), "utf8"));
  DB.sqlite.prepare("update site_runtime_state set value = ? where key = 'article_seed_version'").run(HISTORICAL_ARTICLE_BASELINE);
  DB.sqlite.exec("delete from site_data_migrations");
  const historicalId = "seed-update-2026-09-02-mobile-blog-retired";
  DB.sqlite.prepare("update article_translations set title = 'Administrator revised this title' where article_id = ? and lang = 'zh'").run(historicalId);
  DB.sqlite.exec("update article_translations set title = 'Administrator revised this release' where article_id = 'seed-update-2026-09-08-site-review-optimization' and lang = 'zh'");
  DB.sqlite.prepare("update articles set tags = ?, updated_at = '2026-09-07T09:00:00.000Z' where article_id = ?")
    .run(JSON.stringify(["AI", "ai", "Keep this tag"]), historicalId);
  const migrated = await call("articles?lang=zh");
  assert.equal(migrated.status, 200, await migrated.clone().text());
  assert.equal(DB.sqlite.prepare("select title from article_translations where article_id = ? and lang = 'zh'").get(historicalId).title, "Administrator revised this title");
  assert.equal(DB.sqlite.prepare("select title from article_translations where article_id = 'seed-update-2026-09-08-site-review-optimization' and lang = 'zh'").get().title, "Administrator revised this release");
  assert.deepEqual(JSON.parse(DB.sqlite.prepare("select tags from articles where article_id = ?").get(historicalId).tags), ["AI", "Keep this tag"]);
  assert.equal(DB.sqlite.prepare("select updated_at from articles where article_id = ?").get(historicalId).updated_at, "2026-09-07T09:00:00.000Z");
  assert.equal(DB.sqlite.prepare("select value from site_runtime_state where key = 'article_seed_version'").get().value, ARTICLE_SEED_VERSION);
  assert.equal(DB.sqlite.prepare("select count(*) as n from site_data_migrations where version = ?").get(ARTICLE_SEED_VERSION).n, 1);
  assert.equal((await call("articles?lang=en")).status, 200);
  assert.equal(DB.sqlite.prepare("select count(*) as n from site_data_migrations").get().n, 1);
});

test("a failed content migration retains the previous version and can retry", async (t) => {
  const { readFile } = await import("node:fs/promises");
  const { ARTICLE_SEED_VERSION, HISTORICAL_ARTICLE_BASELINE } = await import("../functions/api/content-migrations.mjs");
  const { DB, call } = await authFixture(t);
  DB.sqlite.exec(await readFile(new URL("../cloudflare/schema.sql", import.meta.url), "utf8"));
  DB.sqlite.prepare("update site_runtime_state set value = ? where key = 'article_seed_version'").run(HISTORICAL_ARTICLE_BASELINE);
  DB.sqlite.exec("delete from site_data_migrations; delete from articles where article_id = 'seed-update-2026-09-08-site-review-optimization'; create trigger reject_release before insert on article_translations when new.article_id = 'seed-update-2026-09-08-site-review-optimization' and new.lang = 'ja' begin select raise(abort, 'release temporarily unavailable'); end");
  const failed = await call("articles?lang=zh");
  assert.equal(failed.status, 500);
  assert.equal(DB.sqlite.prepare("select count(*) as n from articles where article_id = 'seed-update-2026-09-08-site-review-optimization'").get().n, 0);
  assert.equal(DB.sqlite.prepare("select count(*) as n from article_translations where article_id = 'seed-update-2026-09-08-site-review-optimization'").get().n, 0);
  assert.equal(DB.sqlite.prepare("select count(*) as n from site_data_migrations").get().n, 0);
  assert.equal(DB.sqlite.prepare("select value from site_runtime_state where key = 'article_seed_version'").get().value, HISTORICAL_ARTICLE_BASELINE);
  DB.sqlite.exec("drop trigger reject_release");
  const recovered = await call("articles?lang=zh");
  assert.equal(recovered.status, 200, await recovered.clone().text());
  assert.equal(DB.sqlite.prepare("select value from site_runtime_state where key = 'article_seed_version'").get().value, ARTICLE_SEED_VERSION);
});

async function seededMigrationFixture(t) {
  const fixture = await authFixture(t);
  const { readFile } = await import("node:fs/promises");
  const { HISTORICAL_ARTICLE_BASELINE } = await import("../functions/api/content-migrations.mjs");
  fixture.DB.sqlite.exec(await readFile(new URL("../cloudflare/schema.sql", import.meta.url), "utf8"));
  fixture.DB.sqlite.prepare("update site_runtime_state set value = ? where key = 'article_seed_version'").run(HISTORICAL_ARTICLE_BASELINE);
  return fixture;
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

test("an older worker rejects future and unfamiliar same-day release markers without content writes", async (t) => {
  const { DB, call } = await seededMigrationFixture(t);
  DB.sqlite.exec("update article_translations set title = 'Future editor title' where lang = 'zh'");
  for (const marker of ["20260909-test", "20260908-site-review-r2", "20260908-another-release-r1"]) {
    DB.sqlite.prepare("update site_runtime_state set value = ? where key = 'article_seed_version'").run(marker);
    const response = await call("articles?lang=zh");
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, "CONTENT_MIGRATION_NEWER_RELEASE");
    assert.equal(DB.sqlite.prepare("select value from site_runtime_state where key = 'article_seed_version'").get().value, marker);
    assert.equal(DB.sqlite.prepare("select count(*) as n from article_translations where lang='zh' and title <> 'Future editor title'").get().n, 0);
    assert.equal(DB.sqlite.prepare("select count(*) as n from site_runtime_state where key = 'article_seed_version:lease'").get().n, 0);
  }
});

test("separate database wrappers recheck the marker after another isolate completes", async (t) => {
  const { DB, call, env, onRequest } = await seededMigrationFixture(t);
  const reached = deferred();
  const release = deferred();
  let paused = false;
  DB.afterFirst = async (sql, values) => {
    if (!paused && sql.includes("select value from site_runtime_state") && values[0] === "article_seed_version") {
      paused = true;
      reached.resolve();
      await release.promise;
    }
  };
  const first = call("articles?lang=zh");
  await reached.promise;
  const secondDB = { prepare: DB.prepare.bind(DB), batch: DB.batch.bind(DB) };
  const second = await onRequest({ request: new Request("https://example.test/api/articles?lang=en"), env: { ...env, DB: secondDB } });
  assert.equal(second.status, 200, await second.clone().text());
  DB.sqlite.exec("update article_translations set title = 'Edited after the newer isolate completed' where article_id = 'seed-update-2026-09-08-site-review-optimization' and lang = 'zh'");
  release.resolve();
  const firstResult = await first;
  assert.equal(firstResult.status, 200, await firstResult.clone().text());
  assert.equal(DB.sqlite.prepare("select title from article_translations where article_id = 'seed-update-2026-09-08-site-review-optimization' and lang='zh'").get().title, "Edited after the newer isolate completed");
  assert.equal(DB.sqlite.prepare("select count(*) as n from site_runtime_state where key='article_seed_version:lease'").get().n, 0);
});

test("migration ownership and version fences independently abort stale content writes", async (t) => {
  for (const fault of ["lease", "marker", "both", "expired"]) {
    await t.test(fault, async (t) => {
      const { DB, call } = await seededMigrationFixture(t);
      DB.sqlite.exec("delete from articles where article_id = 'seed-update-2026-09-08-site-review-optimization'");
      let intercepted = false;
      DB.beforeBatch = async (statements) => {
        if (intercepted || !statements[0].sql.includes("case when exists")) return;
        intercepted = true;
        if (fault === "lease" || fault === "both") {
          DB.sqlite.exec("update site_runtime_state set value='successor', updated_at='2099-01-01T00:00:00.000Z' where key='article_seed_version:lease'");
        }
        if (fault === "marker" || fault === "both") {
          DB.sqlite.exec("update site_runtime_state set value='20260909-successor-r1' where key='article_seed_version'");
        }
        if (fault === "expired") {
          DB.sqlite.exec("update site_runtime_state set updated_at='2000-01-01T00:00:00.000Z' where key='article_seed_version:lease'");
        }
      };
      const response = await call("articles?lang=zh");
      assert.equal(response.status, 500);
      assert.equal(DB.sqlite.prepare("select count(*) as n from articles where article_id='seed-update-2026-09-08-site-review-optimization'").get().n, 0);
      assert.equal(DB.sqlite.prepare("select value from site_runtime_state where key='article_seed_version'").get().value,
        fault === "marker" || fault === "both" ? "20260909-successor-r1" : "20260902-mobile-blog-retired-r1");
      const lease = DB.sqlite.prepare("select value from site_runtime_state where key='article_seed_version:lease'").get();
      assert.equal(lease?.value, fault === "lease" || fault === "both" ? "successor" : undefined);
    });
  }
});

test("a live migration lease returns a retryable response instead of running overlapping writes", async (t) => {
  const { DB, call } = await seededMigrationFixture(t);
  DB.sqlite.exec("insert into site_runtime_state values ('article_seed_version:lease', 'other-isolate', '2099-01-01T00:00:00.000Z')");
  const busy = await call("articles?lang=zh");
  assert.equal(busy.status, 503);
  assert.equal(busy.headers.get("Retry-After"), "1");
  assert.equal((await busy.json()).code, "CONTENT_MIGRATION_BUSY");
  DB.sqlite.exec("delete from site_runtime_state where key = 'article_seed_version:lease'");
  assert.equal((await call("articles?lang=zh")).status, 200);
});
