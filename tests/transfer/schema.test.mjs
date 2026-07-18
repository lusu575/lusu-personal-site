import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

test("the checked-in D1 schema creates the transfer tables and safe defaults", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(new URL("../../cloudflare/schema.sql", import.meta.url), "utf8"));
  db.exec(readFileSync(new URL("../../cloudflare/schema-indexes.sql", import.meta.url), "utf8"));
  const tables = db.prepare(`
    select name from sqlite_master where type = 'table' and name like 'transfer_%' order by name
  `).all().map((row) => row.name);
  assert.deepEqual(tables, [
    "transfer_alerts",
    "transfer_audit_log",
    "transfer_cleanup_runs",
    "transfer_items",
    "transfer_rooms",
    "transfer_settings",
    "transfer_storage_daily",
    "transfer_upload_parts",
    "transfer_upload_sessions",
    "transfer_usage_daily",
    "transfer_usage_monthly"
  ]);
  const maxFile = db.prepare("select setting_value from transfer_settings where setting_key = 'normal_max_file_bytes'").get();
  assert.equal(Number(maxFile.setting_value), 95 * 1024 * 1024);
  const thresholds = db.prepare("select setting_value from transfer_settings where setting_key = 'alert_thresholds'").get();
  assert.equal(thresholds.setting_value, "1,3,5");
  const roomColumns = db.prepare("pragma table_info(transfer_rooms)").all().map((column) => column.name);
  const itemColumns = db.prepare("pragma table_info(transfer_items)").all().map((column) => column.name);
  assert.equal(roomColumns.includes("sync_generation"), true);
  assert.equal(itemColumns.includes("idempotency_key"), true);
  const indexes = db.prepare("select name from sqlite_master where type = 'index' and name like 'transfer_items_%' order by name").all().map((row) => row.name);
  assert.equal(indexes.includes("transfer_items_room_cursor_idx"), true);
  assert.equal(indexes.includes("transfer_items_idempotency_idx"), true);
});
