import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  COMPATIBILITY_COLUMN_MIGRATIONS
} from "./d1-migrate-local.mjs";

const root = resolve(import.meta.dirname, "..");
const database = "lusu_personal_site";
const wranglerCli = resolve(root, "node_modules", "wrangler", "bin", "wrangler.js");
const D1_MAX_COMPOUND_SELECT_TERMS = 5;
const REMOTE_D1_READ_RETRY_DELAYS_MS = Object.freeze([750, 1500]);

export async function retryRemoteD1Read(
  operation,
  {
    delays = REMOTE_D1_READ_RETRY_DELAYS_MS,
    wait = (delayMs) => new Promise((resolveWait) => setTimeout(resolveWait, delayMs))
  } = {}
) {
  let lastError;
  for (let attempt = 0; attempt <= delays.length; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === delays.length) break;
      await wait(delays[attempt]);
    }
  }
  throw lastError;
}

export const REMOTE_MIGRATION_VERIFICATION_QUERIES = Object.freeze([
  `
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
  `,
  `
    select 'chat-request-column' as item, count(*) as present
    from pragma_table_info('anonymous_chat_messages') where name = 'client_request_id'
    union all
    select 'chat-request-index', count(*)
    from sqlite_master where type = 'index' and name = 'anonymous_chat_messages_request_idx'
  `,
  `
    select 'transfer-generation-column' as item, count(*) as present
    from pragma_table_info('transfer_rooms') where name = 'sync_generation'
    union all
    select 'transfer-idempotency-column', count(*)
    from pragma_table_info('transfer_items') where name = 'idempotency_key'
    union all
    select 'transfer-idempotency-index', count(*)
    from sqlite_master where type = 'index' and name = 'transfer_items_idempotency_idx'
  `,
  `
    select 'agent-device-authorizations-table' as item, count(*) as present
    from sqlite_master where type = 'table' and name = 'agent_device_authorizations'
    union all
    select 'agent-access-tokens-table', count(*)
    from sqlite_master where type = 'table' and name = 'agent_access_tokens'
    union all
    select 'agent-audit-log-table', count(*)
    from sqlite_master where type = 'table' and name = 'agent_audit_log'
  `,
  `
    select 'agent-device-status-expires-index' as item, count(*) as present
    from sqlite_master where type = 'index' and name = 'agent_device_status_expires_idx'
    union all
    select 'agent-device-ip-created-index', count(*)
    from sqlite_master where type = 'index' and name = 'agent_device_ip_created_idx'
    union all
    select 'agent-access-tokens-user-index', count(*)
    from sqlite_master where type = 'index' and name = 'agent_access_tokens_user_idx'
    union all
    select 'agent-access-tokens-expires-index', count(*)
    from sqlite_master where type = 'index' and name = 'agent_access_tokens_expires_idx'
    union all
    select 'agent-audit-created-index', count(*)
    from sqlite_master where type = 'index' and name = 'agent_audit_created_idx'
  `,
  `
    select 'article-delivery-auto-publish-column' as item, count(*) as present
    from pragma_table_info('article_delivery_channels') where name = 'auto_publish'
    union all
    select 'article-delivery-payload-hash-column', count(*)
    from pragma_table_info('article_delivery_events') where name = 'payload_hash'
  `,
  `
    select 'anonymous-identities-table' as item, count(*) as present
    from sqlite_master where type = 'table' and name = 'anonymous_identities'
    union all
    select 'whiteboard-rooms-table', count(*)
    from sqlite_master where type = 'table' and name = 'whiteboard_rooms'
    union all
    select 'whiteboard-assets-table', count(*)
    from sqlite_master where type = 'table' and name = 'whiteboard_assets'
    union all
    select 'whiteboard-bans-table', count(*)
    from sqlite_master where type = 'table' and name = 'whiteboard_bans'
    union all
    select 'whiteboard-admin-audit-table', count(*)
    from sqlite_master where type = 'table' and name = 'whiteboard_admin_audit'
  `,
  `
    select 'whiteboard-metrics-table' as item, count(*) as present
    from sqlite_master where type = 'table' and name = 'whiteboard_metrics'
    union all
    select 'whiteboard-overview-index', count(*)
    from sqlite_master where type = 'index' and name = 'whiteboard_rooms_live_overview_idx'
    union all
    select 'whiteboard-ban-scope-index', count(*)
    from sqlite_master where type = 'index' and name = 'whiteboard_bans_scope_subject_idx'
    union all
    select 'whiteboard-ban-legacy-index-removed',
      case when count(*) = 0 then 1 else 0 end
    from sqlite_master
    where type = 'index' and name = 'whiteboard_bans_active_scope_subject_idx'
  `,
  `
    select 'japanese-agent-operation-column' as item, count(*) as present
    from pragma_table_info('japanese_subtext_profiles') where name = 'last_agent_operation_id'
    union all
    select 'japanese-agent-payload-column', count(*)
    from pragma_table_info('japanese_subtext_profiles') where name = 'last_agent_payload_hash'
    union all
    select 'japanese-agent-attempts-table', count(*)
    from sqlite_master where type = 'table' and name = 'japanese_subtext_agent_attempts'
    union all
    select 'japanese-agent-receipts-table', count(*)
    from sqlite_master where type = 'table' and name = 'japanese_subtext_agent_receipts'
  `,
  `
    select 'japanese-agent-attempts-index' as item, count(*) as present
    from sqlite_master where type = 'index' and name = 'japanese_subtext_agent_attempts_created_idx'
    union all
    select 'japanese-agent-receipts-index', count(*)
    from sqlite_master where type = 'index' and name = 'japanese_subtext_agent_receipts_created_idx'
  `,
  `
    select 'traffic-control-default-state' as item, count(*) as present
    from site_runtime_state where key = 'traffic_control_settings_v1'
    union all
    select 'article-seed-release-marker', count(*)
    from site_runtime_state
    where key = 'article_seed_version' and value = '20260806-japanese-agent-progress-r1'
    union all
    select 'whiteboard-reliable-sketch-update-article', count(*)
    from articles where article_id = 'seed-update-2026-08-01-whiteboard-reliable-sketch'
  `
]);

export function compatibilityColumnMigrations() {
  return [...COMPATIBILITY_COLUMN_MIGRATIONS];
}

export async function inspectMissingColumns(queryRows) {
  const columnsByTable = new Map();
  const missing = [];

  for (const migration of compatibilityColumnMigrations()) {
    if (!columnsByTable.has(migration.table)) {
      columnsByTable.set(
        migration.table,
        await queryRows(`pragma table_info('${migration.table}')`)
      );
    }
    const columns = columnsByTable.get(migration.table);
    // An absent table is a fresh install and will be created by schema.sql.
    // Existing legacy tables must be upgraded before schema.sql creates any
    // indexes that depend on newer columns.
    if (!columns.length) {
      continue;
    }
    if (!columns.some((column) => column.name === migration.column)) {
      missing.push(migration);
    }
  }

  return missing;
}

export async function migrateRemoteD1({
  executeFile = executeRemoteFile,
  executeCommand = executeRemoteCommand,
  queryRows = queryRemoteRows,
  log = console.log
} = {}) {
  assertVerificationQueryLimits();
  log("remote-d1-migrate: inspecting legacy compatibility columns");
  const missingMigrations = await inspectMissingColumns(queryRows);
  for (const migration of missingMigrations) {
    log(`remote-d1-migrate: adding ${migration.table}.${migration.column}`);
    await executeCommand(migration.sql);
  }

  log("remote-d1-migrate: applying base schema");
  await executeFile("cloudflare/schema.sql");

  log("remote-d1-migrate: applying dependent indexes");
  await executeFile("cloudflare/schema-indexes.sql");

  const verification = [];
  for (const sql of REMOTE_MIGRATION_VERIFICATION_QUERIES) {
    verification.push(...await queryRows(sql));
  }
  const missing = verification
    .filter((row) => Number(row.present) !== 1)
    .map((row) => row.item);
  if (missing.length) {
    throw new Error(`Remote D1 migration verification failed: ${missing.join(", ")}`);
  }

  log("remote-d1-migrate: ok");
  return { alteredColumns: missingMigrations.map(({ table, column }) => ({ table, column })) };
}

function assertVerificationQueryLimits() {
  for (const sql of REMOTE_MIGRATION_VERIFICATION_QUERIES) {
    const terms = 1 + (sql.match(/\bunion\s+all\b/gi)?.length || 0);
    if (terms > D1_MAX_COMPOUND_SELECT_TERMS) {
      throw new Error(
        `Remote D1 verification query has ${terms} compound SELECT terms; maximum is ${D1_MAX_COMPOUND_SELECT_TERMS}.`
      );
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await migrateRemoteD1();
}

async function executeRemoteFile(file) {
  await runWrangler(["d1", "execute", database, "--remote", `--file=${file}`]);
}

async function executeRemoteCommand(sql) {
  await runWrangler(["d1", "execute", database, "--remote", "--command", sql]);
}

async function queryRemoteRows(sql) {
  const output = await retryRemoteD1Read(() => runWrangler([
      "d1",
      "execute",
      database,
      "--remote",
      "--command",
      sql.replace(/\s+/g, " ").trim(),
      "--json"
    ], { captureStdout: true }));
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
  if (!existsSync(wranglerCli)) {
    return Promise.reject(new Error("Wrangler is not installed. Run npm ci before migrating remote D1."));
  }
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
