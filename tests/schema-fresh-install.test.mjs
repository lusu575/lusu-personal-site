import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import {
  CHAT_HASH_TABLES,
  chatHashColumnMigrationSql,
  hasIpHashKeyId
} from "../scripts/d1-migrate-local.mjs";

const schema = readFileSync(new URL("../cloudflare/schema.sql", import.meta.url), "utf8");
const schemaIndexes = readFileSync(new URL("../cloudflare/schema-indexes.sql", import.meta.url), "utf8");
const mobileOsArticleId = "seed-update-2026-07-10-premium-interaction-mobile-os";

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
    assert.ok(
      db.prepare("pragma table_info(anonymous_chat_messages)").all().some((column) => column.name === "ip_hash_key_id")
    );
    assert.ok(
      db.prepare("pragma table_info(chat_bans)").all().some((column) => column.name === "ip_hash_key_id")
    );
    assert.equal(
      db.prepare("select count(*) as count from sqlite_master where type = 'index' and name in (?, ?)")
        .get("anonymous_chat_messages_room_ip_generation_idx", "chat_bans_active_ip_generation_idx").count,
      2
    );

    db.exec(schema);
    db.exec(schemaIndexes);
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
    assert.equal(
      db.prepare("select count(*) as count from article_translations where article_id = ?").get(mobileOsArticleId).count,
      3
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
    assert.throws(() => chatHashColumnMigrationSql("articles"), /Unsupported chat hash table/);
  } finally {
    db.close();
  }
});
