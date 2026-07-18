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

  await runWrangler(["d1", "execute", database, "--local", "--file=cloudflare/schema.sql"]);

  for (const table of CHAT_HASH_TABLES) {
    const columns = await queryRows(`pragma table_info('${table}')`);
    if (!hasIpHashKeyId(columns)) {
      await runWrangler([
        "d1",
        "execute",
        database,
        "--local",
        "--command",
        chatHashColumnMigrationSql(table)
      ]);
    }
  }

  for (const [table, migration] of Object.entries(CHAT_COLUMN_MIGRATIONS)) {
    const columns = await queryRows(`pragma table_info('${table}')`);
    if (!columns.some((column) => column.name === migration.column)) {
      await runWrangler([
        "d1",
        "execute",
        database,
        "--local",
        "--command",
        chatColumnMigrationSql(table)
      ]);
    }
  }

  for (const [table, migration] of Object.entries(TRANSFER_COLUMN_MIGRATIONS)) {
    const columns = await queryRows(`pragma table_info('${table}')`);
    if (!columns.some((column) => column.name === migration.column)) {
      await runWrangler([
        "d1",
        "execute",
        database,
        "--local",
        "--command",
        transferColumnMigrationSql(table)
      ]);
    }
  }

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
