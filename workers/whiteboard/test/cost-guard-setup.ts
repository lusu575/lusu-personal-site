import { env } from "cloudflare:workers";
import { beforeEach } from "vitest";
import { seedCostGuardTestBudget } from "../../../tests/helpers/cost-guard-fixture.mjs";

const testEnv = env as unknown as { DB: D1Database };
async function ensureWhiteboardIndexSchema(): Promise<void> {
  if (!testEnv.DB) return;
  await testEnv.DB.prepare(`
    CREATE TABLE IF NOT EXISTS whiteboard_rooms (
      room_id TEXT PRIMARY KEY,
      room_type TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_active_at TEXT NOT NULL,
      empty_since TEXT,
      delete_at TEXT,
      online_count INTEGER NOT NULL DEFAULT 0,
      document_version INTEGER NOT NULL DEFAULT 0,
      snapshot_version INTEGER NOT NULL DEFAULT 0,
      is_locked INTEGER NOT NULL DEFAULT 0,
      resource_usage TEXT NOT NULL DEFAULT '{"bytes":0,"images":0}',
      resource_bytes INTEGER NOT NULL DEFAULT 0,
      resource_count INTEGER NOT NULL DEFAULT 0,
      object_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      epoch INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL,
      last_error TEXT NOT NULL DEFAULT ''
    )
  `).run();
  await testEnv.DB.prepare(`
    CREATE TABLE IF NOT EXISTS whiteboard_assets (
      asset_id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      object_key TEXT NOT NULL UNIQUE,
      content_type TEXT NOT NULL,
      byte_size INTEGER NOT NULL,
      width INTEGER NOT NULL,
      height INTEGER NOT NULL,
      sha256 TEXT NOT NULL,
      ref_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      unreferenced_at TEXT,
      delete_attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT NOT NULL DEFAULT ''
    )
  `).run();
  await testEnv.DB.prepare(`
    CREATE TABLE IF NOT EXISTS whiteboard_bans (
      ban_id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      subject_type TEXT NOT NULL,
      subject_value TEXT NOT NULL,
      ip_hash_key_id TEXT NOT NULL DEFAULT '',
      reason TEXT NOT NULL DEFAULT '',
      expires_at TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `).run();
  await testEnv.DB.prepare(`
    CREATE TABLE IF NOT EXISTS whiteboard_metrics (
      metric_key TEXT PRIMARY KEY,
      metric_value INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    )
  `).run();
}


beforeEach(async () => {
  await seedCostGuardTestBudget(testEnv.DB);
  await ensureWhiteboardIndexSchema();
});
