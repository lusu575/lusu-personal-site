import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(import.meta.dirname, "..");
const database = "lusu_personal_site";
const wranglerCli = resolve(root, "node_modules", "wrangler", "bin", "wrangler.js");
export const CHAT_HASH_TABLES = Object.freeze(["anonymous_chat_messages", "chat_bans"]);
export const CHAT_COLUMN_MIGRATIONS = Object.freeze({
  anonymous_chat_messages: Object.freeze({
    column: "client_request_id",
    sql: "alter table anonymous_chat_messages add column client_request_id text not null default ''"
  })
});
export const TRANSFER_COLUMN_MIGRATIONS = Object.freeze({
  transfer_rooms: Object.freeze({
    column: "sync_generation",
    sql: "alter table transfer_rooms add column sync_generation integer not null default 0"
  }),
  transfer_items: Object.freeze({
    column: "idempotency_key",
    sql: "alter table transfer_items add column idempotency_key text not null default ''"
  })
});
export const ARTICLE_DELIVERY_COLUMN_MIGRATIONS = Object.freeze({
  article_delivery_channels: Object.freeze({
    column: "auto_publish",
    sql: "alter table article_delivery_channels add column auto_publish integer not null default 0"
  }),
  article_delivery_events: Object.freeze({
    column: "payload_hash",
    sql: "alter table article_delivery_events add column payload_hash text not null default ''"
  })
});

const COMPATIBILITY_TABLES = new Set([
  "anonymous_chat_messages",
  "chat_bans",
  "transfer_rooms",
  "transfer_items",
  "article_delivery_channels",
  "article_delivery_events"
]);

export const COMPATIBILITY_COLUMN_MIGRATIONS = Object.freeze([
  ["chat", "anonymous_chat_messages", "client_id", "text not null default ''"],
  ["chat", "anonymous_chat_messages", "edited_at", "text"],
  ["chat-hash", "anonymous_chat_messages", "ip_hash_key_id", "text not null default 'legacy'"],
  ["chat", "anonymous_chat_messages", "ip_prefix", "text not null default ''"],
  ["chat", "anonymous_chat_messages", "room_key", "text not null default 'public'"],
  ["chat", "anonymous_chat_messages", "encrypted", "integer not null default 0"],
  ["chat", "anonymous_chat_messages", "client_request_id", "text not null default ''"],
  ["chat-hash", "chat_bans", "ip_hash_key_id", "text not null default 'legacy'"],
  ["chat", "chat_bans", "ip_prefix", "text not null default ''"],
  ["transfer", "transfer_rooms", "sync_generation", "integer not null default 0"],
  ["transfer", "transfer_items", "idempotency_key", "text not null default ''"],
  ["article-delivery", "article_delivery_channels", "auto_publish", "integer not null default 0"],
  ["article-delivery", "article_delivery_events", "payload_hash", "text not null default ''"]
].map(([group, table, column, definition]) => Object.freeze({
  group,
  table,
  column,
  definition,
  sql: compatibilityColumnMigrationSql(table, column, definition)
})));

export function compatibilityColumnMigrationSql(table, column, definition) {
  if (
    !COMPATIBILITY_TABLES.has(table)
    || !/^[a-z][a-z0-9_]*$/.test(column)
    || !/^(?:text|integer)(?:\s+not null)?(?:\s+default\s+(?:''|'legacy'|'public'|0))?$/.test(definition)
  ) {
    throw new Error(`Unsupported compatibility column migration: ${table}.${column}`);
  }
  return `alter table ${table} add column ${column} ${definition}`;
}

export function hasIpHashKeyId(columns) {
  return columns.some((column) => column.name === "ip_hash_key_id");
}

export function chatHashColumnMigrationSql(table) {
  if (!CHAT_HASH_TABLES.includes(table)) {
    throw new Error(`Unsupported chat hash table: ${table}`);
  }
  return `alter table ${table} add column ip_hash_key_id text not null default 'legacy'`;
}

export function transferColumnMigrationSql(table) {
  const migration = TRANSFER_COLUMN_MIGRATIONS[table];
  if (!migration) {
    throw new Error(`Unsupported transfer table: ${table}`);
  }
  return migration.sql;
}

export function chatColumnMigrationSql(table) {
  const migration = CHAT_COLUMN_MIGRATIONS[table];
  if (!migration) {
    throw new Error(`Unsupported chat table: ${table}`);
  }
  return migration.sql;
}

export async function migrateLocalD1() {
  if (!existsSync(wranglerCli)) {
    throw new Error("Wrangler is not installed. Run npm ci before initializing local D1.");
  }

  const columnsByTable = new Map();
  for (const migration of COMPATIBILITY_COLUMN_MIGRATIONS) {
    if (!columnsByTable.has(migration.table)) {
      columnsByTable.set(
        migration.table,
        await queryRows(`pragma table_info('${migration.table}')`)
      );
    }
    const columns = columnsByTable.get(migration.table);
    // A missing table is a fresh install. The full schema below creates it with
    // every current column; ALTER is only needed for an existing legacy table.
    if (!columns.length || columns.some((column) => column.name === migration.column)) {
      continue;
    }
    await runWrangler([
      "d1",
      "execute",
      database,
      "--local",
      "--command",
      migration.sql
    ]);
    columns.push({ name: migration.column });
  }

  await runWrangler(["d1", "execute", database, "--local", "--file=cloudflare/schema.sql"]);

  await runWrangler(["d1", "execute", database, "--local", "--file=cloudflare/schema-indexes.sql"]);

  const verification = [
    ...await queryRows(`
    select 'messages-column' as item, count(*) as present
    from pragma_table_info('anonymous_chat_messages') where name = 'ip_hash_key_id'
    union all
    select 'bans-column', count(*)
    from pragma_table_info('chat_bans') where name = 'ip_hash_key_id'
    union all
    select 'messages-index', count(*)
    from sqlite_master where type = 'index' and name = 'anonymous_chat_messages_room_ip_generation_idx'
    union all
    select 'bans-index', count(*)
    from sqlite_master where type = 'index' and name = 'chat_bans_active_ip_generation_idx'
    `),
    ...await queryRows(`
    select 'chat-request-column' as item, count(*) as present
    from pragma_table_info('anonymous_chat_messages') where name = 'client_request_id'
    union all
    select 'chat-request-index', count(*)
    from sqlite_master where type = 'index' and name = 'anonymous_chat_messages_request_idx'
    `),
    ...await queryRows(`
    select 'transfer-generation-column' as item, count(*) as present
    from pragma_table_info('transfer_rooms') where name = 'sync_generation'
    union all
    select 'transfer-idempotency-column', count(*)
    from pragma_table_info('transfer_items') where name = 'idempotency_key'
    union all
    select 'transfer-idempotency-index', count(*)
    from sqlite_master where type = 'index' and name = 'transfer_items_idempotency_idx'
    `),
    ...await queryRows(`
    select 'article-delivery-auto-publish-column' as item, count(*) as present
    from pragma_table_info('article_delivery_channels') where name = 'auto_publish'
    union all
    select 'article-delivery-payload-hash-column', count(*)
    from pragma_table_info('article_delivery_events') where name = 'payload_hash'
    `)
  ];

  const missing = verification.filter((row) => Number(row.present) !== 1).map((row) => row.item);
  if (missing.length) {
    throw new Error(`Local D1 migration verification failed: ${missing.join(", ")}`);
  }

  console.log("local-d1-migrate: ok");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await migrateLocalD1();
}

async function queryRows(sql) {
  const output = await runWrangler([
    "d1",
    "execute",
    database,
    "--local",
    "--command",
    sql.replace(/\s+/g, " ").trim(),
    "--json"
  ], { captureStdout: true });
  let payload;
  try {
    payload = JSON.parse(output);
  } catch (error) {
    throw new Error(`Wrangler returned invalid JSON: ${error.message}`);
  }
  return Array.isArray(payload)
    ? payload.flatMap((entry) => Array.isArray(entry?.results) ? entry.results : [])
    : [];
}

function runWrangler(args, { captureStdout = false } = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, [wranglerCli, ...args], {
      cwd: root,
      env: process.env,
      stdio: captureStdout ? ["ignore", "pipe", "inherit"] : "inherit",
      windowsHide: true
    });
    let stdout = "";
    if (captureStdout) {
      child.stdout.setEncoding("utf8");
      child.stdout.on("data", (chunk) => {
        stdout += chunk;
      });
    }
    child.on("error", rejectRun);
    child.on("close", (code, signal) => {
      if (code === 0) {
        resolveRun(stdout);
        return;
      }
      rejectRun(new Error(`Wrangler exited with ${signal || `code ${code}`}.`));
    });
  });
}
