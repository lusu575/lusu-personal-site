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
    assert.equal(events[0], "file:cloudflare/schema.sql");

    const indexFilePosition = events.indexOf("file:cloudflare/schema-indexes.sql");
    const alterPositions = events
      .map((event, index) => event.startsWith("command:") ? index : -1)
      .filter((index) => index >= 0);
    assert.equal(alterPositions.length, expectedColumns.length);
    assert.ok(alterPositions.every((position) => position > 0 && position < indexFilePosition));
    assert.equal(events.filter((event) => event.startsWith("query:pragma table_info")).length, 4);
    assert.equal(
      events.filter((event) => event.startsWith("query:select ")).length,
      REMOTE_MIGRATION_VERIFICATION_QUERIES.length
    );
    assert.ok(events
      .filter((event) => event.startsWith("command:"))
      .every((event) => !/\b(?:delete|drop|truncate|replace)\b/i.test(event)));

    assert.deepEqual(
      { ...db.prepare("select content, ip_hash_key_id, client_request_id from anonymous_chat_messages where message_id = ?")
        .get("legacy-message") },
      { content: "kept", ip_hash_key_id: "legacy", client_request_id: "" }
    );
    assert.equal(
      db.prepare("select ip_hash_key_id from chat_bans where ban_id = ?").get("legacy-ban").ip_hash_key_id,
      "legacy"
    );
    assert.equal(db.prepare("select sync_generation from transfer_rooms where id = ?").get("legacy-room").sync_generation, 0);
    assert.equal(db.prepare("select idempotency_key from transfer_items where id = ?").get("legacy-item").idempotency_key, "");
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

test("the remote migration package command uses the compatibility runner without a local fallback", () => {
  assert.equal(packageData.scripts["d1:migrate:remote"], "node scripts/d1-migrate-remote.mjs");
  assert.match(remoteRunnerSource, /from "\.\/d1-migrate-local\.mjs"/);
  assert.match(remoteRunnerSource, /"--remote"/);
  assert.doesNotMatch(remoteRunnerSource, /"--local"/);
});
