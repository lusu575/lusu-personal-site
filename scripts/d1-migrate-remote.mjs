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
    select 'agent-article-receipts-table' as item, count(*) as present
    from sqlite_master where type = 'table' and name = 'agent_article_receipts'
    union all
    select 'agent-article-receipts-created-index', count(*)
    from sqlite_master where type = 'index' and name = 'agent_article_receipts_created_idx'
  `,
  `
    select 'agent-video-receipts-table' as item, count(*) as present
    from sqlite_master where type = 'table' and name = 'agent_video_receipts'
    union all
    select 'agent-video-receipts-all-columns',
      case
        when count(*) = 8
          and sum(case when name in (
            'receipt_id', 'user_id', 'operation_id', 'action',
            'payload_hash', 'video_id', 'response_json', 'created_at'
          ) then 1 else 0 end) = 8
        then 1 else 0
      end
    from pragma_table_info('agent_video_receipts')
    union all
    select 'video-upload-sessions-table', count(*)
    from sqlite_master where type = 'table' and name = 'video_upload_sessions'
    union all
    select 'video-upload-sessions-all-columns',
      case
        when count(*) = 22
          and sum(case when name in (
            'upload_session_id', 'user_id', 'operation_id', 'payload_hash',
            'video_id', 'filename', 'mime_type', 'size_bytes', 'sha256',
            'upload_token_hash', 'object_key', 'r2_upload_id', 'part_size_bytes',
            'expected_parts', 'uploaded_bytes', 'status', 'expires_at',
            'created_at', 'updated_at', 'completed_at', 'aborted_at', 'last_error'
          ) then 1 else 0 end) = 22
        then 1 else 0
      end
    from pragma_table_info('video_upload_sessions')
  `,
  `
    select 'agent-video-receipts-created-index' as item, count(*) as present
    from sqlite_master where type = 'index' and name = 'agent_video_receipts_created_idx'
    union all
    select 'video-upload-sessions-user-status-index', count(*)
    from sqlite_master where type = 'index' and name = 'video_upload_sessions_user_status_idx'
    union all
    select 'video-upload-sessions-status-expires-index', count(*)
    from sqlite_master where type = 'index' and name = 'video_upload_sessions_status_expires_idx'
  `,
  `
    select 'mcp-oauth-grants-table' as item, count(*) as present
    from sqlite_master where type = 'table' and name = 'mcp_oauth_grants'
    union all
    select 'mcp-oauth-grants-critical-columns',
      case when count(*) = 13 then 1 else 0 end
    from pragma_table_info('mcp_oauth_grants')
    where name in (
      'grant_ref', 'user_id', 'client_id', 'client_name', 'resource',
      'authorized_scopes', 'status', 'created_at', 'activated_at',
      'expires_at', 'revoked_at', 'revoked_reason', 'last_used_at'
    )
    union all
    select 'mcp-oauth-audit-log-table', count(*)
    from sqlite_master where type = 'table' and name = 'mcp_oauth_audit_log'
    union all
    select 'mcp-oauth-audit-log-critical-columns',
      case when count(*) = 18 then 1 else 0 end
    from pragma_table_info('mcp_oauth_audit_log')
    where name in (
      'event_id', 'user_id', 'client_id', 'grant_ref', 'token_ref_hash',
      'resource', 'capability_id', 'tool_name', 'operation_id', 'target_type',
      'target_id_hash', 'requested_scopes', 'effective_scopes', 'action',
      'result', 'error_code', 'ip_hash', 'created_at'
    )
    union all
    select 'mcp-oauth-registration-limits-table', count(*)
    from sqlite_master where type = 'table' and name = 'mcp_oauth_registration_limits'
  `,
  `
    select 'mcp-oauth-registration-limits-critical-columns' as item,
      case when count(*) = 4 then 1 else 0 end as present
    from pragma_table_info('mcp_oauth_registration_limits')
    where name in ('bucket_key', 'request_count', 'expires_at', 'updated_at')
    union all
    select 'mcp-oauth-grants-user-status-index', count(*)
    from sqlite_master where type = 'index' and name = 'mcp_oauth_grants_user_status_idx'
    union all
    select 'mcp-oauth-grants-client-resource-index', count(*)
    from sqlite_master where type = 'index' and name = 'mcp_oauth_grants_client_resource_idx'
    union all
    select 'mcp-oauth-audit-created-index', count(*)
    from sqlite_master where type = 'index' and name = 'mcp_oauth_audit_created_idx'
    union all
    select 'mcp-oauth-audit-grant-index', count(*)
    from sqlite_master where type = 'index' and name = 'mcp_oauth_audit_grant_idx'
  `,
  `
    select 'mcp-oauth-registration-limits-expires-index' as item, count(*) as present
    from sqlite_master
    where type = 'index' and name = 'mcp_oauth_registration_limits_expires_idx'
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
    where key = 'article_seed_version' and value = '20260811-video-link-autofill-r1'
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
  `,
  `
    select 'video-link-autofill-update-article' as item,
      case when count(*) = 1 then 1 else 0 end as present
    from articles
    where article_id = 'seed-update-2026-08-11-video-link-autofill'
      and slug = '2026-08-11-video-link-autofill'
      and category = 'site-updates'
      and status = 'published'
      and is_pinned = 0
      and cover_image = ''
      and published_at = '2026-08-11T00:20:00.000Z'
    union all
    select 'video-link-autofill-update-translations',
      case
        when count(*) = 3
          and count(distinct lang) = 3
          and sum(case when lang in ('zh', 'en', 'ja') then 1 else 0 end) = 3
          and sum(case when length(trim(title)) > 0 and length(trim(summary)) > 0 and length(trim(content_markdown)) > 0 then 1 else 0 end) = 3
        then 1 else 0
      end
    from article_translations
    where article_id = 'seed-update-2026-08-11-video-link-autofill'
  `,
  `
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
            then 1 else 0
          end) = 3
        then 1 else 0
      end
    from article_translations
    where article_id = 'seed-update-2026-08-10-wallpaper-switch-slim-dawn'
  `,
  `
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
            then 1 else 0
          end) = 3
        then 1 else 0
      end
    from article_translations
    where article_id = 'seed-update-2026-08-10-wallpaper-switch-ceramic-roll'
  `,
  `
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
            then 1 else 0
          end) = 3
        then 1 else 0
      end
    from article_translations
    where article_id = 'seed-update-2026-08-10-wallpaper-switch-calm-redesign'
  `,
  `
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
            then 1 else 0
          end) = 3
        then 1 else 0
      end
    from article_translations
    where article_id = 'seed-update-2026-08-09-wallpaper-switch-scene-redesign'
  `,
  `
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
  `,
  `
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
  `,
  `
    select 'whiteboard-reliable-sketch-update-article' as item, count(*) as present
    from articles where article_id = 'seed-update-2026-08-01-whiteboard-reliable-sketch'
    union all
    select 'whiteboard-agent-images-update-translations',
      case when count(*) = 3 then 1 else 0 end
    from article_translations
    where article_id = 'seed-update-2026-08-06-whiteboard-agent-images'
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
