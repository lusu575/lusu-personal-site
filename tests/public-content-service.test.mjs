import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
  queryPublishedArticle,
  queryPublishedArticles,
  toPublicArticle
} from "../functions/api/public-content-service.mjs";

class D1Statement {
  constructor(database, queries, sql, values = []) {
    this.database = database;
    this.queries = queries;
    this.sql = sql;
    this.values = values;
  }

  bind(...values) {
    return new D1Statement(this.database, this.queries, this.sql, values);
  }

  async first() {
    this.queries.push({ method: "first", sql: this.sql, values: this.values });
    return this.database.prepare(this.sql).get(...this.values) || null;
  }

  async all() {
    this.queries.push({ method: "all", sql: this.sql, values: this.values });
    return { results: this.database.prepare(this.sql).all(...this.values) };
  }
}

class D1Database {
  constructor() {
    this.sqlite = new DatabaseSync(":memory:");
    this.queries = [];
  }

  prepare(sql) {
    return new D1Statement(this.sqlite, this.queries, sql);
  }

  close() {
    this.sqlite.close();
  }
}

function createDatabase() {
  const DB = new D1Database();
  DB.sqlite.exec(`
    create table articles (
      article_id text primary key,
      slug text not null unique,
      category text not null,
      tags text not null default '[]',
      cover_image text not null default '',
      status text not null,
      is_pinned integer not null default 0,
      view_count integer not null default 0,
      created_at text not null,
      updated_at text not null,
      published_at text
    );
    create table article_translations (
      translation_id text primary key,
      article_id text not null,
      lang text not null,
      title text not null,
      summary text not null default '',
      content_markdown text not null default ''
    );

    insert into articles values
      ('a-new', 'new-article', 'daily-ai-news', '["AI","release"]', '/new.png', 'published', 0, 7,
        '2026-08-05T00:00:00.000Z', '2026-08-05T00:00:00.000Z', '2026-08-05T00:00:00.000Z'),
      ('a-pinned', 'pinned-article', 'note', 'not-json', '', 'published', 1, 3,
        '2026-07-01T00:00:00.000Z', '2026-07-01T00:00:00.000Z', '2026-07-01T00:00:00.000Z'),
      ('a-loop-old', '2026-06-18-hidden-loop', 'site-updates', '[]', '', 'published', 0, 0,
        '2026-06-18T00:00:00.000Z', '2026-06-18T00:00:00.000Z', '2026-06-18T00:00:00.000Z'),
      ('a-loop-kept', '2026-06-18-main-visual-polish-cycle', 'site-updates', '[]', '', 'published', 0, 0,
        '2026-06-18T01:00:00.000Z', '2026-06-18T01:00:00.000Z', '2026-06-18T01:00:00.000Z'),
      ('a-draft', 'draft-article', 'note', '[]', '', 'draft', 0, 0,
        '2026-08-06T00:00:00.000Z', '2026-08-06T00:00:00.000Z', null);

    insert into article_translations values
      ('t-new-zh', 'a-new', 'zh', '新闻标题', '中文概要', '中文正文'),
      ('t-new-en', 'a-new', 'en', 'Release headline', 'Searchable beta summary', 'English body'),
      ('t-pinned-en', 'a-pinned', 'en', 'Pinned fallback', 'English only', 'Fallback body'),
      ('t-loop-old-zh', 'a-loop-old', 'zh', '隐藏的循环更新', '', ''),
      ('t-loop-kept-zh', 'a-loop-kept', 'zh', '保留的循环更新', '', ''),
      ('t-draft-zh', 'a-draft', 'zh', '草稿', '', '');
  `);
  return DB;
}

test("published article queries preserve filtering, fallback, ordering, category, and search", async (t) => {
  const DB = createDatabase();
  t.after(() => DB.close());

  const rows = await queryPublishedArticles({ DB }, { lang: "ja", limit: 20 });
  assert.deepEqual(rows.map(({ slug }) => slug), [
    "pinned-article",
    "new-article",
    "2026-06-18-main-visual-polish-cycle"
  ]);
  assert.equal(rows[0].requested_lang, null);
  assert.equal(rows[0].lang, "en");
  assert.equal(rows[0].title, "Pinned fallback");
  assert.ok(!rows.some(({ slug }) => slug === "2026-06-18-hidden-loop"));
  assert.ok(!rows.some(({ slug }) => slug === "draft-article"));

  const matches = await queryPublishedArticles({ DB }, {
    lang: "en",
    category: "daily-ai-news",
    search: "beta",
    limit: 10
  });
  assert.deepEqual(matches.map(({ slug }) => slug), ["new-article"]);
  assert.deepEqual(DB.queries.at(-1).values, ["en", "daily-ai-news", "beta", 10]);
});

test("article detail query is read-only and its public mapper keeps the existing response shape", async (t) => {
  const DB = createDatabase();
  t.after(() => DB.close());

  const row = await queryPublishedArticle({ DB }, { lang: "en", slug: "new-article" });
  assert.equal(row.article_id, "a-new");
  assert.equal(row.lang, "en");
  assert.equal(row.content_markdown, "English body");
  assert.ok(DB.queries.every(({ sql }) => /^\s*select\b/i.test(sql)));

  assert.deepEqual(toPublicArticle(row, { includeContent: true }), {
    slug: "new-article",
    category: "daily-ai-news",
    tags: ["AI", "release"],
    cover_image: "/new.png",
    status: "published",
    is_pinned: 0,
    view_count: 7,
    created_at: "2026-08-05T00:00:00.000Z",
    updated_at: "2026-08-05T00:00:00.000Z",
    published_at: "2026-08-05T00:00:00.000Z",
    lang: "en",
    requested_lang: "en",
    title: "Release headline",
    summary: "Searchable beta summary",
    content_markdown: "English body"
  });
  assert.deepEqual(toPublicArticle({ ...row, tags: "broken" }).tags, []);
  assert.equal(await queryPublishedArticle({ DB }, { lang: "zh", slug: "missing" }), null);
});
