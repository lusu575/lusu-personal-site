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
  "article_delivery_events",
  "japanese_subtext_profiles"
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
  ["article-delivery", "article_delivery_events", "payload_hash", "text not null default ''"],
  ["japanese-subtext-agent", "japanese_subtext_profiles", "last_agent_operation_id", "text not null default ''"],
  ["japanese-subtext-agent", "japanese_subtext_profiles", "last_agent_payload_hash", "text not null default ''"]
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
    select 'agent-article-receipts-table' as item, count(*) as present
    from sqlite_master where type = 'table' and name = 'agent_article_receipts'
    union all
    select 'agent-article-receipts-created-index', count(*)
    from sqlite_master where type = 'index' and name = 'agent_article_receipts_created_idx'
    `),
    ...await queryRows(`
    select 'article-delivery-auto-publish-column' as item, count(*) as present
    from pragma_table_info('article_delivery_channels') where name = 'auto_publish'
    union all
    select 'article-delivery-payload-hash-column', count(*)
    from pragma_table_info('article_delivery_events') where name = 'payload_hash'
    `),
    ...await queryRows(`
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
    `),
    ...await queryRows(`
    select 'whiteboard-overview-index' as item, count(*) as present
    from sqlite_master where type = 'index' and name = 'whiteboard_rooms_live_overview_idx'
    union all
    select 'whiteboard-ban-scope-index', count(*)
    from sqlite_master where type = 'index' and name = 'whiteboard_bans_scope_subject_idx'
    union all
    select 'whiteboard-metrics-table', count(*)
    from sqlite_master where type = 'table' and name = 'whiteboard_metrics'
    union all
    select 'whiteboard-ban-legacy-index-removed',
      case when count(*) = 0 then 1 else 0 end
    from sqlite_master
    where type = 'index' and name = 'whiteboard_bans_active_scope_subject_idx'
    `),
    ...await queryRows(`
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
    `),
    ...await queryRows(`
    select 'japanese-agent-attempts-index' as item, count(*) as present
    from sqlite_master where type = 'index' and name = 'japanese_subtext_agent_attempts_created_idx'
    union all
    select 'japanese-agent-receipts-index', count(*)
    from sqlite_master where type = 'index' and name = 'japanese_subtext_agent_receipts_created_idx'
    `),
    ...await queryRows(`
    select 'traffic-control-default-state' as item, count(*) as present
    from site_runtime_state where key = 'traffic_control_settings_v1'
    union all
    select 'article-seed-release-marker', count(*)
    from site_runtime_state
    where key = 'article_seed_version' and value = '20260810-wallpaper-switch-route-motion-r1'
    union all
    select 'game-video-mcp-candidate-update-article',
      case when count(*) = 1 then 1 else 0 end
    from articles
    where article_id = 'seed-update-2026-08-09-game-video-mcp-candidate'
      and slug = '2026-08-09-game-video-mcp-candidate'
      and category = 'site-updates'
      and status = 'published'
      and published_at = '2026-08-09T09:30:00.000Z'
    union all
    select 'game-video-mcp-candidate-update-translations',
      case
        when count(*) = 3
          and count(distinct lang) = 3
          and sum(case when lang in ('zh', 'en', 'ja') then 1 else 0 end) = 3
          and sum(case
            when length(trim(title)) > 0
              and length(trim(summary)) > 0
              and length(trim(content_markdown)) > 0
            then 1 else 0 end) = 3
        then 1 else 0
      end
    from article_translations
    where article_id = 'seed-update-2026-08-09-game-video-mcp-candidate'
    union all
    select 'whiteboard-agent-images-update-article', count(*)
    from articles where article_id = 'seed-update-2026-08-06-whiteboard-agent-images'
    `),
    ...await queryRows(`
    select 'wallpaper-switch-slim-dawn-update-article' as item,
      case when count(*) = 1 then 1 else 0 end as present
    from articles
    where article_id = 'seed-update-2026-08-10-wallpaper-switch-slim-dawn'
      and slug = '2026-08-10-wallpaper-switch-slim-dawn'
      and category = 'site-updates'
      and status = 'published'
      and is_pinned = 0
      and cover_image = ''
      and published_at = '2026-08-10T04:10:00.000Z'
    union all
    select 'wallpaper-switch-slim-dawn-update-translations',
      case
        when count(*) = 3
          and count(distinct lang) = 3
          and sum(case when lang in ('zh', 'en', 'ja') then 1 else 0 end) = 3
          and sum(case
            when length(trim(title)) > 0
              and length(trim(summary)) > 0
              and length(trim(content_markdown)) > 0
            then 1 else 0 end) = 3
        then 1 else 0
      end
    from article_translations
    where article_id = 'seed-update-2026-08-10-wallpaper-switch-slim-dawn'
    `),
    ...await queryRows(`
    select 'wallpaper-switch-ceramic-roll-update-article' as item,
      case when count(*) = 1 then 1 else 0 end as present
    from articles
    where article_id = 'seed-update-2026-08-10-wallpaper-switch-ceramic-roll'
      and slug = '2026-08-10-wallpaper-switch-ceramic-roll'
      and category = 'site-updates'
      and status = 'published'
      and is_pinned = 0
      and cover_image = ''
      and published_at = '2026-08-10T00:20:00.000Z'
    union all
    select 'wallpaper-switch-ceramic-roll-update-translations',
      case
        when count(*) = 3
          and count(distinct lang) = 3
          and sum(case when lang in ('zh', 'en', 'ja') then 1 else 0 end) = 3
          and sum(case
            when length(trim(title)) > 0
              and length(trim(summary)) > 0
              and length(trim(content_markdown)) > 0
            then 1 else 0 end) = 3
        then 1 else 0
      end
    from article_translations
    where article_id = 'seed-update-2026-08-10-wallpaper-switch-ceramic-roll'
    `),
    ...await queryRows(`
    select 'wallpaper-switch-calm-redesign-update-article' as item,
      case when count(*) = 1 then 1 else 0 end as present
    from articles
    where article_id = 'seed-update-2026-08-10-wallpaper-switch-calm-redesign'
      and slug = '2026-08-10-wallpaper-switch-calm-redesign'
      and category = 'site-updates'
      and status = 'published'
      and is_pinned = 0
      and cover_image = ''
      and published_at = '2026-08-09T16:00:00.000Z'
    union all
    select 'wallpaper-switch-calm-redesign-update-translations',
      case
        when count(*) = 3
          and count(distinct lang) = 3
          and sum(case when lang in ('zh', 'en', 'ja') then 1 else 0 end) = 3
          and sum(case
            when length(trim(title)) > 0
              and length(trim(summary)) > 0
              and length(trim(content_markdown)) > 0
            then 1 else 0 end) = 3
        then 1 else 0
      end
    from article_translations
    where article_id = 'seed-update-2026-08-10-wallpaper-switch-calm-redesign'
    `),
    ...await queryRows(`
    select 'wallpaper-switch-scene-redesign-update-article' as item,
      case when count(*) = 1 then 1 else 0 end as present
    from articles
    where article_id = 'seed-update-2026-08-09-wallpaper-switch-scene-redesign'
      and slug = '2026-08-09-wallpaper-switch-scene-redesign'
      and category = 'site-updates'
      and status = 'published'
      and is_pinned = 0
      and cover_image = ''
      and published_at = '2026-08-09T11:15:00.000Z'
    union all
    select 'wallpaper-switch-scene-redesign-update-translations',
      case
        when count(*) = 3
          and count(distinct lang) = 3
          and sum(case when lang in ('zh', 'en', 'ja') then 1 else 0 end) = 3
          and sum(case
            when length(trim(title)) > 0
              and length(trim(summary)) > 0
              and length(trim(content_markdown)) > 0
            then 1 else 0 end) = 3
        then 1 else 0
      end
    from article_translations
    where article_id = 'seed-update-2026-08-09-wallpaper-switch-scene-redesign'
    `),
    ...await queryRows(`
    select 'wallpaper-time-switch-update-article' as item,
      case when count(*) = 1 then 1 else 0 end as present
    from articles
    where article_id = 'seed-update-2026-08-09-wallpaper-time-switch'
      and slug = '2026-08-09-wallpaper-time-switch'
      and category = 'site-updates'
      and status = 'published'
      and published_at = '2026-08-09T05:40:00.000Z'
    union all
    select 'wallpaper-time-switch-update-translations',
      case
        when count(*) = 3
          and count(distinct lang) = 3
          and sum(case when lang in ('zh', 'en', 'ja') then 1 else 0 end) = 3
          and sum(case
            when length(trim(title)) > 0
              and length(trim(summary)) > 0
              and length(trim(content_markdown)) > 0
            then 1 else 0 end) = 3
        then 1 else 0
      end
    from article_translations
    where article_id = 'seed-update-2026-08-09-wallpaper-time-switch'
    union all
    select 'motion-polish-update-article',
      case when count(*) = 1 then 1 else 0 end
    from articles
    where article_id = 'seed-update-2026-08-09-motion-polish'
      and slug = '2026-08-09-motion-polish'
      and category = 'site-updates'
      and status = 'published'
      and published_at = '2026-08-09T02:50:00.000Z'
    union all
    select 'motion-polish-update-translations',
      case
        when count(*) = 3
          and count(distinct lang) = 3
          and sum(case when lang in ('zh', 'en', 'ja') then 1 else 0 end) = 3
          and sum(case
            when length(trim(title)) > 0
              and length(trim(summary)) > 0
              and length(trim(content_markdown)) > 0
            then 1 else 0 end) = 3
        then 1 else 0
      end
    from article_translations
    where article_id = 'seed-update-2026-08-09-motion-polish'
    `),
    ...await queryRows(`
    select 'remote-mcp-oauth-update-article' as item,
      case when count(*) = 1 then 1 else 0 end as present
    from articles
    where article_id = 'seed-update-2026-08-07-remote-mcp-oauth'
      and slug = '2026-08-07-remote-mcp-oauth'
      and category = 'site-updates'
      and status = 'published'
      and published_at = '2026-08-09T01:00:00.000Z'
    union all
    select 'remote-mcp-oauth-update-translations',
      case
        when count(*) = 3
          and count(distinct lang) = 3
          and sum(case when lang in ('zh', 'en', 'ja') then 1 else 0 end) = 3
          and sum(case
            when length(trim(title)) > 0
              and length(trim(summary)) > 0
              and length(trim(content_markdown)) > 0
            then 1 else 0 end) = 3
        then 1 else 0
      end
    from article_translations
    where article_id = 'seed-update-2026-08-07-remote-mcp-oauth'
    `),
    ...await queryRows(`
    select 'whiteboard-reliable-sketch-update-article' as item, count(*) as present
    from articles where article_id = 'seed-update-2026-08-01-whiteboard-reliable-sketch'
    union all
    select 'whiteboard-agent-images-update-translations',
      case when count(*) = 3 then 1 else 0 end
    from article_translations
    where article_id = 'seed-update-2026-08-06-whiteboard-agent-images'
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
    const wranglerEnv = {
      ...process.env,
      WRANGLER_SEND_METRICS: "false"
    };
    for (const key of [
      "HTTP_PROXY",
      "HTTPS_PROXY",
      "ALL_PROXY",
      "http_proxy",
      "https_proxy",
      "all_proxy",
      "npm_config_proxy",
      "npm_config_http_proxy",
      "npm_config_https_proxy"
    ]) {
      delete wranglerEnv[key];
    }
    const child = spawn(process.execPath, [wranglerCli, ...args], {
      cwd: root,
      // Local D1 never needs the network. Removing proxy variables also avoids
      // Wrangler keeping Miniflare alive while it attempts proxy telemetry.
      env: wranglerEnv,
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
