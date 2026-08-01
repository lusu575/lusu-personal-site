import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import {
  REMOTE_MIGRATION_VERIFICATION_QUERIES,
  compatibilityColumnMigrations,
  migrateRemoteD1
} from "../scripts/d1-migrate-remote.mjs";

const schema = readFileSync(new URL("../cloudflare/schema.sql", import.meta.url), "utf8");
const schemaIndexes = readFileSync(new URL("../cloudflare/schema-indexes.sql", import.meta.url), "utf8");
const remoteRunnerSource = readFileSync(new URL("../scripts/d1-migrate-remote.mjs", import.meta.url), "utf8");
const packageData = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

function createAdapter(db, events) {
  return {
    executeFile: async (file) => {
      events.push(`file:${file}`);
      db.exec(file === "cloudflare/schema.sql" ? schema : schemaIndexes);
    },
    executeCommand: async (sql) => {
      events.push(`command:${sql}`);
      db.exec(sql);
    },
    queryRows: async (sql) => {
      const normalized = sql.replace(/\s+/g, " ").trim();
      events.push(`query:${normalized}`);
      return db.prepare(normalized).all();
    },
    log: () => {}
  };
}

function createLegacyDatabase() {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    pragma foreign_keys = on;
    create table anonymous_chat_messages (
      message_id text primary key,
      visitor_id text not null,
      nickname text not null,
      content text not null,
      created_at text not null,
      hidden integer not null default 0,
      ip_hash text not null
    );
    create table chat_bans (
      ban_id text primary key,
      ban_type text not null,
      visitor_id text not null default '',
      ip_hash text not null default '',
      reason text not null default '',
      active integer not null default 1,
      created_by text not null,
      created_at text not null,
      expires_at text
    );
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
    create table article_delivery_events (
      event_id text primary key,
      channel_key text not null references article_delivery_channels(channel_key) on delete cascade,
      idempotency_key text not null,
      article_id text references articles(article_id) on delete set null,
      slug text not null,
      title_zh text not null default '',
      source_label text not null default '',
      status text not null default 'draft',
      created_at text not null,
      unique(channel_key, idempotency_key)
    );
    insert into anonymous_chat_messages (
      message_id, visitor_id, nickname, content, created_at, ip_hash
    ) values (
      'legacy-message', 'legacy-visitor', 'Legacy', 'kept',
      '2026-01-01T00:00:00.000Z', 'legacy-message-hash'
    );
    insert into chat_bans (
      ban_id, ban_type, ip_hash, created_by, created_at
    ) values (
      'legacy-ban', 'ip', 'legacy-ban-hash', 'admin', '2026-01-01T00:00:00.000Z'
    );
    insert into transfer_rooms (id, last_activity_at)
      values ('legacy-room', '2026-01-01T00:00:00.000Z');
    insert into transfer_items (
      id, room_id, uploader_user_id, upload_status, created_at, expires_at
    ) values (
      'legacy-item', 'legacy-room', 'legacy-user', 'ready',
      '2026-01-01T00:00:00.000Z', '2026-01-02T00:00:00.000Z'
    );
  `);
  return db;
}

test("remote D1 runner upgrades only missing compatibility columns before dependent indexes", async () => {
  const db = createLegacyDatabase();
  const events = [];
  try {
    const result = await migrateRemoteD1(createAdapter(db, events));
    const expectedColumns = compatibilityColumnMigrations().map(({ table, column }) => ({ table, column }));
    assert.deepEqual(result.alteredColumns, expectedColumns);
    assert.match(events[0], /^query:pragma table_info/);

    const indexFilePosition = events.indexOf("file:cloudflare/schema-indexes.sql");
    const schemaFilePosition = events.indexOf("file:cloudflare/schema.sql");
    const alterPositions = events
      .map((event, index) => event.startsWith("command:") ? index : -1)
      .filter((index) => index >= 0);
    assert.equal(alterPositions.length, expectedColumns.length);
    assert.ok(alterPositions.every((position) => position > 0 && position < schemaFilePosition));
    assert.ok(schemaFilePosition < indexFilePosition);
    assert.equal(events.filter((event) => event.startsWith("query:pragma table_info")).length, 6);
    assert.equal(
      events.filter((event) => event.startsWith("query:select ")).length,
      REMOTE_MIGRATION_VERIFICATION_QUERIES.length
    );
    assert.ok(events
      .filter((event) => event.startsWith("command:"))
      .every((event) => !/\b(?:delete|drop|truncate|replace)\b/i.test(event)));

    assert.deepEqual(
      { ...db.prepare("select content, room_key, encrypted, ip_hash_key_id, client_request_id from anonymous_chat_messages where message_id = ?")
        .get("legacy-message") },
      {
        content: "kept",
        room_key: "public",
        encrypted: 0,
        ip_hash_key_id: "legacy",
        client_request_id: ""
      }
    );
    assert.equal(
      db.prepare("select ip_hash_key_id from chat_bans where ban_id = ?").get("legacy-ban").ip_hash_key_id,
      "legacy"
    );
    assert.equal(db.prepare("select sync_generation from transfer_rooms where id = ?").get("legacy-room").sync_generation, 0);
    assert.equal(db.prepare("select idempotency_key from transfer_items where id = ?").get("legacy-item").idempotency_key, "");
    assert.ok(
      db.prepare("pragma table_info(article_delivery_events)").all()
        .some((column) => column.name === "payload_hash")
    );
    assert.ok(
      db.prepare("pragma table_info(article_delivery_channels)").all()
        .some((column) => column.name === "auto_publish")
    );
    assert.equal(
      db.prepare(`
        select auto_publish from article_delivery_channels
        where channel_key = 'daily-ai-news'
      `).get().auto_publish,
      0
    );
    assert.deepEqual(db.prepare("pragma foreign_key_check").all(), []);
  } finally {
    db.close();
  }
});

test("remote D1 runner is idempotent on a fresh schema and does not issue ALTER statements", async () => {
  const db = new DatabaseSync(":memory:");
  const events = [];
  try {
    db.exec(schema);
    db.exec(schemaIndexes);
    const result = await migrateRemoteD1(createAdapter(db, events));

    assert.deepEqual(result.alteredColumns, []);
    assert.equal(events.some((event) => event.startsWith("command:")), false);
    assert.deepEqual(db.prepare("pragma foreign_key_check").all(), []);
  } finally {
    db.close();
  }
});

test("remote D1 runner replaces the legacy whiteboard partial ban index idempotently", async () => {
  const db = new DatabaseSync(":memory:");
  const events = [];
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
          'legacy-ban-old', 'public-v1', 'anonymous_id',
          'anonymous_target_identifier_remote', 'old', '2000-01-01T00:00:00.000Z',
          0, 'admin', '2025-01-01T00:00:00.000Z', '2025-01-01T00:00:00.000Z'
        ),
        (
          'legacy-ban-new', 'public-v1', 'anonymous_id',
          'anonymous_target_identifier_remote', 'new', '2099-01-01T00:00:00.000Z',
          0, 'admin', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'
        );
    `);

    await migrateRemoteD1(createAdapter(db, events));
    await migrateRemoteD1(createAdapter(db, events));

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
            and subject_value = 'anonymous_target_identifier_remote'
        `).get()
      },
      { ban_id: "legacy-ban-new", reason: "new" }
    );
  } finally {
    db.close();
  }
});

test("remote D1 runner fails closed when grouped verification is incomplete", async () => {
  const files = [];
  await assert.rejects(
    migrateRemoteD1({
      executeFile: async (file) => files.push(file),
      executeCommand: async () => {},
      queryRows: async (sql) => sql.trim().startsWith("pragma table_info")
        ? compatibilityColumnMigrations().map(({ column }) => ({ name: column }))
        : [{ item: "missing-index", present: 0 }],
      log: () => {}
    }),
    /Remote D1 migration verification failed: missing-index/
  );
  assert.deepEqual(files, ["cloudflare/schema.sql", "cloudflare/schema-indexes.sql"]);
});

test("remote D1 verification groups stay within the production compound SELECT limit", () => {
  for (const sql of REMOTE_MIGRATION_VERIFICATION_QUERIES) {
    const terms = 1 + (sql.match(/\bunion\s+all\b/gi)?.length || 0);
    assert.ok(terms <= 5, `verification query has ${terms} compound SELECT terms`);
  }
  const verificationSql = REMOTE_MIGRATION_VERIFICATION_QUERIES.join("\n");
  assert.match(verificationSql, /whiteboard_admin_audit/);
  assert.match(verificationSql, /whiteboard_metrics/);
  assert.match(verificationSql, /traffic_control_settings_v1/);
  assert.match(verificationSql, /article_seed_version/);
  assert.match(verificationSql, /seed-update-2026-08-01-service-reliability/);
});

test("the remote migration package command uses the compatibility runner without a local fallback", () => {
  assert.equal(packageData.scripts["d1:migrate:remote"], "node scripts/d1-migrate-remote.mjs");
  assert.match(remoteRunnerSource, /from "\.\/d1-migrate-local\.mjs"/);
  assert.match(remoteRunnerSource, /"--remote"/);
  assert.doesNotMatch(remoteRunnerSource, /"--local"/);
});
