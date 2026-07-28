import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import {
  CHAT_COLUMN_MIGRATIONS,
  CHAT_HASH_TABLES,
  TRANSFER_COLUMN_MIGRATIONS,
  chatColumnMigrationSql,
  chatHashColumnMigrationSql,
  hasIpHashKeyId,
  transferColumnMigrationSql
} from "../scripts/d1-migrate-local.mjs";

const schema = readFileSync(new URL("../cloudflare/schema.sql", import.meta.url), "utf8");
const schemaIndexes = readFileSync(new URL("../cloudflare/schema-indexes.sql", import.meta.url), "utf8");
const mobileOsArticleId = "seed-update-2026-07-10-premium-interaction-mobile-os";
const aiAgentWorkflowArticleId = "seed-ai-agent-workflow-guide-2026-06-14";
const aiAgentWorkflowPinRepairKey = "article_ai_agent_workflow_pin_repair_v1";

test("D1 schema initializes an empty database and remains idempotent", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec("PRAGMA foreign_keys = ON;");
    db.exec(schema);
    db.exec(schemaIndexes);

    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
    assert.equal(
      db.prepare("select count(*) as count from articles where article_id = ?").get(mobileOsArticleId).count,
      1
    );
    assert.equal(
      db.prepare("select count(*) as count from article_translations where article_id = ?").get(mobileOsArticleId).count,
      3
    );
    assert.equal(
      db.prepare("select is_pinned from articles where article_id = ?").get(aiAgentWorkflowArticleId).is_pinned,
      0
    );
    assert.equal(
      db.prepare("select count(*) as count from site_runtime_state where key = ?")
        .get(aiAgentWorkflowPinRepairKey).count,
      1
    );
    assert.deepEqual(
      { ...db.prepare(`
        select channel_key, category, enabled, auto_publish, token_hash
        from article_delivery_channels where channel_key = 'daily-ai-news'
      `).get() },
      {
        channel_key: "daily-ai-news",
        category: "daily-ai-news",
        enabled: 0,
        auto_publish: 0,
        token_hash: ""
      }
    );
    assert.ok(
      db.prepare("pragma table_info(article_delivery_channels)").all()
        .some((column) => column.name === "auto_publish" && column.notnull === 1)
    );
    assert.equal(
      db.prepare(`
        select count(*) as count from sqlite_master
        where type = 'index' and name = 'article_delivery_events_channel_created_idx'
      `).get().count,
      1
    );
    assert.ok(
      db.prepare("pragma table_info(article_delivery_events)").all()
        .some((column) => column.name === "payload_hash" && column.notnull === 1)
    );
    assert.equal(
      db.prepare(`
        select count(*) as count from articles
        where article_id = 'seed-daily-ai-news-test-placeholder'
      `).get().count,
      0
    );
    assert.equal(
      db.prepare(`
        select count(*) as count from article_translations
        where article_id = 'seed-daily-ai-news-test-placeholder'
      `).get().count,
      0
    );
    assert.ok(
      db.prepare("pragma table_info(anonymous_chat_messages)").all().some((column) => column.name === "ip_hash_key_id")
    );
    assert.ok(
      db.prepare("pragma table_info(chat_bans)").all().some((column) => column.name === "ip_hash_key_id")
    );
    assert.ok(
      db.prepare("pragma table_info(anonymous_chat_messages)").all().some((column) => column.name === "client_request_id")
    );
    assert.equal(
      db.prepare("select count(*) as count from sqlite_master where type = 'index' and name in (?, ?)")
        .get("anonymous_chat_messages_room_ip_generation_idx", "chat_bans_active_ip_generation_idx").count,
      2
    );
    assert.equal(
      db.prepare("select count(*) as count from sqlite_master where type = 'index' and name = ?")
        .get("anonymous_chat_messages_request_idx").count,
      1
    );

    db.prepare("update articles set is_pinned = 1, updated_at = ? where article_id = ?")
      .run("2026-07-28T05:30:00.000Z", aiAgentWorkflowArticleId);
    db.exec(schema);
    db.exec(schemaIndexes);
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
    assert.equal(
      db.prepare("select count(*) as count from article_translations where article_id = ?").get(mobileOsArticleId).count,
      3
    );
    assert.equal(
      db.prepare("select count(*) as count from article_delivery_channels where channel_key = 'daily-ai-news'").get().count,
      1
    );
    assert.deepEqual(
      { ...db.prepare("select is_pinned, updated_at from articles where article_id = ?").get(aiAgentWorkflowArticleId) },
      {
        is_pinned: 1,
        updated_at: "2026-07-28T05:30:00.000Z"
      },
      "reapplying schema seeds must preserve later admin pin choices and row revisions"
    );
  } finally {
    db.close();
  }
});

test("D1 chat hash migration upgrades legacy tables without losing historical rows", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(`
      create table anonymous_chat_messages (
        message_id text primary key,
        visitor_id text not null,
        client_id text not null default '',
        nickname text not null,
        content text not null,
        created_at text not null,
        edited_at text,
        hidden integer not null default 0,
        ip_hash text not null,
        ip_prefix text not null default '',
        room_key text not null default 'public',
        encrypted integer not null default 0
      );
      create table chat_bans (
        ban_id text primary key,
        ban_type text not null,
        visitor_id text not null default '',
        ip_hash text not null default '',
        ip_prefix text not null default '',
        reason text not null default '',
        active integer not null default 1,
        created_by text not null,
        created_at text not null,
        expires_at text
      );
      insert into anonymous_chat_messages (
        message_id, visitor_id, nickname, content, created_at, ip_hash
      ) values (
        'legacy-message', 'legacy-visitor', 'Legacy', 'kept', '2026-01-01T00:00:00.000Z', 'legacy-message-hash'
      );
      insert into chat_bans (
        ban_id, ban_type, ip_hash, created_by, created_at
      ) values (
        'legacy-ban', 'ip', 'legacy-ban-hash', 'admin', '2026-01-01T00:00:00.000Z'
      );
    `);

    db.exec(schema);
    for (const table of CHAT_HASH_TABLES) {
      const columns = db.prepare(`pragma table_info('${table}')`).all();
      assert.equal(hasIpHashKeyId(columns), false);
      db.exec(chatHashColumnMigrationSql(table));
      assert.equal(hasIpHashKeyId(db.prepare(`pragma table_info('${table}')`).all()), true);
    }
    for (const [table, migration] of Object.entries(CHAT_COLUMN_MIGRATIONS)) {
      const columns = db.prepare(`pragma table_info('${table}')`).all();
      assert.equal(columns.some((column) => column.name === migration.column), false);
      db.exec(chatColumnMigrationSql(table));
      assert.equal(db.prepare(`pragma table_info('${table}')`).all().some((column) => column.name === migration.column), true);
    }

    db.exec(schemaIndexes);
    db.exec(schema);
    db.exec(schemaIndexes);

    assert.equal(
      db.prepare("select ip_hash_key_id from anonymous_chat_messages where message_id = ?")
        .get("legacy-message").ip_hash_key_id,
      "legacy"
    );
    assert.equal(
      db.prepare("select ip_hash_key_id from chat_bans where ban_id = ?").get("legacy-ban").ip_hash_key_id,
      "legacy"
    );
    assert.equal(
      db.prepare("select count(*) as count from sqlite_master where type = 'index' and name in (?, ?)")
        .get("anonymous_chat_messages_room_ip_generation_idx", "chat_bans_active_ip_generation_idx").count,
      2
    );
    assert.equal(
      db.prepare("select count(*) as count from sqlite_master where type = 'index' and name = ?")
        .get("anonymous_chat_messages_request_idx").count,
      1
    );
    assert.throws(() => chatHashColumnMigrationSql("articles"), /Unsupported chat hash table/);
    assert.throws(() => chatColumnMigrationSql("articles"), /Unsupported chat table/);
  } finally {
    db.close();
  }
});

test("D1 transfer migration adds cursor generation and idempotency before dependent indexes", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(`
      create table transfer_rooms (
        id text primary key,
        status text not null default 'open',
        last_activity_at text not null
      );
      create table transfer_items (
        id text primary key,
        room_id text not null,
        uploader_user_id text not null,
        uploader_role_snapshot text not null default 'user',
        upload_status text not null,
        created_at text not null,
        expires_at text not null
      );
      insert into transfer_rooms (id, last_activity_at) values ('legacy-room', '2026-01-01T00:00:00.000Z');
      insert into transfer_items (
        id, room_id, uploader_user_id, upload_status, created_at, expires_at
      ) values (
        'legacy-item', 'legacy-room', 'legacy-user', 'ready',
        '2026-01-01T00:00:00.000Z', '2026-01-02T00:00:00.000Z'
      );
    `);

    db.exec(schema);
    for (const [table, migration] of Object.entries(TRANSFER_COLUMN_MIGRATIONS)) {
      const columns = db.prepare(`pragma table_info('${table}')`).all();
      assert.equal(columns.some((column) => column.name === migration.column), false);
      db.exec(transferColumnMigrationSql(table));
    }
    db.exec(schemaIndexes);

    assert.equal(db.prepare("select sync_generation from transfer_rooms where id = 'legacy-room'").get().sync_generation, 0);
    assert.equal(db.prepare("select idempotency_key from transfer_items where id = 'legacy-item'").get().idempotency_key, "");
    assert.equal(
      db.prepare("select count(*) as count from sqlite_master where type = 'index' and name = 'transfer_items_idempotency_idx'").get().count,
      1
    );
    assert.throws(() => transferColumnMigrationSql("articles"), /Unsupported transfer table/);

    db.exec(schema);
    db.exec(schemaIndexes);
    assert.equal(db.prepare("select count(*) as count from transfer_items where id = 'legacy-item'").get().count, 1);
  } finally {
    db.close();
  }
});
