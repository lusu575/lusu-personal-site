import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { MINIMAX_H3_SCHEMA_STATEMENTS, MINIMAX_H3_TABLE_NAMES } from "../lib/minimax-h3/schema.mjs";

test("H3 schema creates control-plane tables and required indexes without media columns", () => {
  const db = new DatabaseSync(":memory:");
  db.exec("create table users (id text primary key)");
  for (const statement of MINIMAX_H3_SCHEMA_STATEMENTS) db.exec(statement);

  for (const table of MINIMAX_H3_TABLE_NAMES) {
    assert.equal(
      db.prepare("select count(*) as count from sqlite_master where type = 'table' and name = ?").get(table).count,
      1,
      `missing ${table}`
    );
  }
  const columns = db.prepare("select name from pragma_table_info('minimax_h3_jobs')").all().map((row) => row.name);
  for (const forbidden of ["media_blob", "output_path", "comfy_prompt_id", "stderr"]) {
    assert.equal(columns.includes(forbidden), false, `forbidden column ${forbidden}`);
  }
  for (const index of [
    "minimax_h3_jobs_runner_state_created_idx",
    "minimax_h3_jobs_owner_created_idx",
    "minimax_h3_job_events_job_seq_idx",
    "minimax_h3_transfer_tickets_job_status_idx"
  ]) {
    assert.equal(
      db.prepare("select count(*) as count from sqlite_master where type = 'index' and name = ?").get(index).count,
      1,
      `missing ${index}`
    );
  }
});

test("production H3 migration is additive and does not replay the historical seed", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(`
      pragma foreign_keys = on;
      create table users (id text primary key, email text unique not null, password_hash text not null, role text not null, created_at text not null, updated_at text not null);
      create table articles (article_id text primary key, slug text unique not null, category text not null, tags text not null, cover_image text not null, status text not null, is_pinned integer not null, view_count integer not null, created_at text not null, updated_at text not null, published_at text);
      create table article_translations (translation_id text primary key, article_id text not null references articles(article_id) on delete cascade, lang text not null, title text not null, summary text not null, content_markdown text not null, created_at text not null, updated_at text not null, unique(article_id, lang));
      create table site_runtime_state (key text primary key, value text not null, updated_at text not null);
      insert into users values ('admin-1', 'admin@example.test', 'hash', 'admin', '2026-01-01', '2026-01-01');
      insert into articles values ('existing', 'existing', 'site-updates', '[]', '', 'published', 0, 0, '2026-01-01', '2026-01-01', '2026-01-01');
    `);
    const sql = readFileSync(fileURLToPath(new URL("../cloudflare/migrations/20260812-minimax-h3-control-plane.sql", import.meta.url)), "utf8");
    db.exec(sql);
    assert.equal(db.prepare("select count(*) as n from sqlite_master where type = 'table' and name like 'minimax_h3_%'").get().n, 6);
    assert.equal(db.prepare("select count(*) as n from article_translations where article_id = 'seed-update-2026-08-12-minimax-h3-console'").get().n, 3);
    assert.equal(db.prepare("select count(*) as n from article_translations where lang = 'ja' and article_id = 'seed-update-2026-08-12-minimax-h3-console'").get().n, 1);
    assert.equal(db.prepare("select count(*) as n from articles where article_id = 'existing'").get().n, 1);
  } finally {
    db.close();
  }
});
