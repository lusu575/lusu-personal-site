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
const multiplayerWhiteboardArticleId = "seed-update-2026-07-30-multiplayer-whiteboard";
const serviceReliabilityArticleId = "seed-update-2026-08-01-service-reliability";
const passwordRoomGuideArticleId = "seed-site-guide-whiteboard-chat-password-rooms-2026-08-06";
const agentCapabilitiesUpdateId = "seed-update-2026-08-06-agent-capabilities";
const whiteboard2048AgentUpdateId = "seed-update-2026-08-06-whiteboard-2048-agent";
const agentReadBreadthUpdateId = "seed-update-2026-08-06-agent-read-breadth";
const japaneseAgentProgressUpdateId = "seed-update-2026-08-06-japanese-agent-progress";
const hextrisAgentUpdateId = "seed-update-2026-08-07-hextris-agent";

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
      db.prepare("select count(*) as count from articles where article_id = ?").get(multiplayerWhiteboardArticleId).count,
      1
    );
    assert.equal(
      db.prepare("select count(*) as count from article_translations where article_id = ?").get(multiplayerWhiteboardArticleId).count,
      3
    );
    assert.equal(
      db.prepare("select count(*) as count from articles where article_id = ?").get(serviceReliabilityArticleId).count,
      1
    );
    assert.equal(
      db.prepare("select count(*) as count from article_translations where article_id = ?").get(serviceReliabilityArticleId).count,
      3
    );
    assert.equal(
      db.prepare("select count(*) as count from articles where article_id = ? and category = 'site-guides'").get(passwordRoomGuideArticleId).count,
      1
    );
    assert.equal(
      db.prepare("select count(*) as count from article_translations where article_id = ?").get(passwordRoomGuideArticleId).count,
      3
    );
    assert.equal(
      db.prepare("select count(*) as count from articles where article_id = ? and category = 'site-updates'").get(agentCapabilitiesUpdateId).count,
      1
    );
    assert.equal(
      db.prepare("select count(*) as count from article_translations where article_id = ?").get(agentCapabilitiesUpdateId).count,
      3
    );
    assert.equal(
      db.prepare("select count(*) as count from articles where article_id = ? and category = 'site-updates'").get(whiteboard2048AgentUpdateId).count,
      1
    );
    assert.equal(
      db.prepare("select count(*) as count from article_translations where article_id = ?").get(whiteboard2048AgentUpdateId).count,
      3
    );
    assert.equal(
      db.prepare("select count(*) as count from articles where article_id = ? and category = 'site-updates'").get(agentReadBreadthUpdateId).count,
      1
    );
    assert.equal(
      db.prepare("select count(*) as count from article_translations where article_id = ?").get(agentReadBreadthUpdateId).count,
      3
    );
    assert.equal(
      db.prepare("select count(*) as count from articles where article_id = ? and category = 'site-updates'").get(japaneseAgentProgressUpdateId).count,
      1
    );
    assert.equal(
      db.prepare("select count(*) as count from article_translations where article_id = ?").get(japaneseAgentProgressUpdateId).count,
      3
    );
    assert.equal(
      db.prepare("select count(*) as count from articles where article_id = ? and category = 'site-updates'").get(hextrisAgentUpdateId).count,
      1
    );
    assert.equal(
      db.prepare("select count(*) as count from article_translations where article_id = ?").get(hextrisAgentUpdateId).count,
      3
    );
    const trafficSettings = JSON.parse(
      db.prepare("select value from site_runtime_state where key = 'traffic_control_settings_v1'").get().value
    );
    assert.equal(trafficSettings.warningRows, 30000);
    assert.equal(trafficSettings.hardRows, 50000);
    assert.equal(trafficSettings.adaptiveProtectionEnabled, true);
    assert.equal(trafficSettings.sampling.hard.clicks, 0);
    assert.equal(
      db.prepare("select value from site_runtime_state where key = 'article_seed_version'").get().value,
      "20260807-hextris-agent-r1"
    );
    assert.deepEqual(
      db.prepare("pragma table_info(whiteboard_rooms)").all().map((column) => column.name),
      [
        "room_id", "room_type", "created_at", "last_active_at", "empty_since",
        "delete_at", "online_count", "document_version", "snapshot_version",
        "is_locked", "resource_usage", "resource_bytes", "resource_count",
        "object_count", "status", "epoch", "updated_at", "last_error"
      ]
    );
    assert.deepEqual(
      db.prepare("pragma table_info(anonymous_identities)").all().map((column) => column.name),
      [
        "anonymous_id", "credential_hash", "legacy_visitor_id", "display_name",
        "color", "identity_version", "created_at", "updated_at",
        "name_changed_at", "name_window_start", "name_change_count", "revoked_at"
      ]
    );
    assert.deepEqual(
      db.prepare("pragma table_info(agent_device_authorizations)").all().map((column) => column.name),
      [
        "device_id", "device_code_hash", "user_code_hash", "client_name",
        "requested_scopes", "granted_scopes", "user_id", "status", "csrf_hash",
        "ip_hash", "created_at", "expires_at", "approved_at", "consumed_at",
        "poll_count", "last_polled_at", "decision_event_id"
      ]
    );
    assert.deepEqual(
      db.prepare("pragma table_info(agent_access_tokens)").all().map((column) => column.name),
      [
        "token_id", "token_hash", "token_hint", "user_id", "client_name", "scopes",
        "created_at", "expires_at", "last_used_at", "revoked_at", "revoked_event_id"
      ]
    );
    assert.deepEqual(
      db.prepare("pragma table_info(agent_audit_log)").all().map((column) => column.name),
      [
        "event_id", "actor_user_id", "token_id", "action", "target_type",
        "target_id", "scopes", "result", "created_at"
      ]
    );
    assert.equal(
      db.prepare(`
        select count(*) as count from sqlite_master
        where type = 'index' and name in (
          'agent_device_status_expires_idx',
          'agent_device_ip_created_idx',
          'agent_access_tokens_user_idx',
          'agent_access_tokens_expires_idx',
          'agent_audit_created_idx'
        )
      `).get().count,
      5
    );
    assert.equal(db.prepare("select count(*) as count from agent_access_tokens").get().count, 0);
    assert.deepEqual(
      db.prepare("pragma table_info(japanese_subtext_profiles)").all().map((column) => column.name),
      [
        "user_id", "schema_version", "content_version", "revision", "current_level",
        "current_stage", "settings_json", "last_agent_operation_id",
        "last_agent_payload_hash", "progress_updated_at", "settings_updated_at",
        "created_at", "updated_at"
      ]
    );
    assert.deepEqual(
      db.prepare("pragma table_info(japanese_subtext_agent_attempts)").all().map((column) => column.name),
      [
        "attempt_id", "user_id", "token_id", "operation_id", "payload_hash",
        "stage_id", "stage_revision", "content_hash", "expected_revision",
        "resulting_revision", "answers_json", "score", "cleared", "medal",
        "attempt_mode", "used_translation", "used_kana", "used_listening_mode",
        "replay_count", "hint_count", "created_at"
      ]
    );
    assert.deepEqual(
      db.prepare("pragma table_info(japanese_subtext_agent_receipts)").all().map((column) => column.name),
      ["user_id", "operation_id", "payload_hash", "attempt_id", "response_json", "created_at"]
    );
    assert.equal(
      db.prepare(`
        select count(*) as count from sqlite_master
        where type = 'index' and name in (
          'japanese_subtext_agent_attempts_created_idx',
          'japanese_subtext_agent_receipts_created_idx'
        )
      `).get().count,
      2
    );
    assert.equal(db.prepare("select count(*) as count from japanese_subtext_agent_attempts").get().count, 0);
    assert.equal(db.prepare("select count(*) as count from japanese_subtext_agent_receipts").get().count, 0);
    assert.equal(
      db.prepare("select count(*) as count from sqlite_master where type = 'index' and name = ?")
        .get("whiteboard_rooms_live_overview_idx").count,
      1
    );
    assert.equal(
      db.prepare("select count(*) as count from sqlite_master where type = 'index' and name = ?")
        .get("whiteboard_bans_scope_subject_idx").count,
      1
    );
    assert.equal(
      db.prepare("select count(*) as count from sqlite_master where type = 'index' and name = ?")
        .get("whiteboard_bans_active_scope_subject_idx").count,
      0
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
    assert.deepEqual(
      { ...db.prepare(`
        select channel_key, category, enabled, auto_publish, token_hash
        from article_delivery_channels where channel_key = 'tool-radar'
      `).get() },
      {
        channel_key: "tool-radar",
        category: "tool-radar",
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
    assert.deepEqual(
      db.prepare("pragma table_info(tool_radar_catalog)").all()
        .map((column) => column.name),
      ["tool_key", "canonical_url", "name", "article_id", "created_at"]
    );
    assert.equal(
      db.prepare(`
        select count(*) as count from sqlite_master
        where type = 'index' and name = 'tool_radar_catalog_created_idx'
      `).get().count,
      1
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
      db.prepare("select count(*) as count from article_translations where article_id = ?").get(multiplayerWhiteboardArticleId).count,
      3
    );
    assert.equal(
      db.prepare("select count(*) as count from article_translations where article_id = ?").get(serviceReliabilityArticleId).count,
      3
    );
    assert.equal(
      db.prepare("select count(*) as count from article_delivery_channels where channel_key = 'daily-ai-news'").get().count,
      1
    );
    assert.equal(
      db.prepare("select count(*) as count from article_delivery_channels where channel_key = 'tool-radar'").get().count,
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

test("D1 whiteboard ban migration replaces the legacy partial index and deduplicates safely", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(schema);
    db.exec(`
      create unique index whiteboard_bans_active_scope_subject_idx
        on whiteboard_bans(room_id, subject_type, subject_value)
        where active = 1;

      insert into whiteboard_bans (
        ban_id, room_id, subject_type, subject_value, reason, expires_at,
        active, created_by, created_at, updated_at
      ) values
        (
          'legacy-inactive-old', 'public-v1', 'anonymous_id',
          'anonymous_target_identifier_legacy', 'old', '2000-01-01T00:00:00.000Z',
          0, 'admin', '2025-01-01T00:00:00.000Z', '2025-01-01T00:00:00.000Z'
        ),
        (
          'legacy-inactive-new', 'public-v1', 'anonymous_id',
          'anonymous_target_identifier_legacy', 'new', '2099-01-01T00:00:00.000Z',
          0, 'admin', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'
        );
    `);

    db.exec(schemaIndexes);
    db.exec(schemaIndexes);

    assert.equal(
      db.prepare(`
        select count(*) as count
        from sqlite_master
        where type = 'index' and name = 'whiteboard_bans_active_scope_subject_idx'
      `).get().count,
      0
    );
    assert.equal(
      db.prepare(`
        select count(*) as count
        from sqlite_master
        where type = 'index' and name = 'whiteboard_bans_scope_subject_idx'
      `).get().count,
      1
    );
    assert.deepEqual(
      {
        ...db.prepare(`
          select ban_id, reason
          from whiteboard_bans
          where room_id = 'public-v1'
            and subject_type = 'anonymous_id'
            and subject_value = 'anonymous_target_identifier_legacy'
        `).get()
      },
      { ban_id: "legacy-inactive-new", reason: "new" }
    );
    assert.throws(
      () => db.prepare(`
        insert into whiteboard_bans (
          ban_id, room_id, subject_type, subject_value, expires_at,
          active, created_by, created_at, updated_at
        ) values (
          'duplicate-blocked', 'public-v1', 'anonymous_id',
          'anonymous_target_identifier_legacy', '2099-01-01T00:00:00.000Z',
          0, 'admin', '2026-02-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z'
        )
      `).run(),
      /UNIQUE constraint failed/
    );
  } finally {
    db.close();
  }
});
