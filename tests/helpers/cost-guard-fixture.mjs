import { COST_GUARD_VERSION } from "../../functions/api/cost-guard.mjs";

// Test data only. Production never creates a missing policy or renews its lease.
export function costGuardTestConfig() {
  return {
    COST_GUARD_MODE: "strict", COST_GUARD_CLEANUP: "enabled",
    COST_GUARD_FEATURES: "api,admin,articles,transfer,whiteboard,public-mcp,owner-mcp",
    COST_GUARD_WORKERS_PLAN: "free", COST_GUARD_REVIEW: COST_GUARD_VERSION,
    COST_GUARD_UNTIL: new Date(Date.now() + 29 * 86400000).toISOString()
  };
}

export async function seedCostGuardTestBudget(DB) {
  await DB.prepare(`create table if not exists cost_guard_budgets (
    id text primary key, revision text, enabled integer, valid_until integer,
    day text, day_used integer, month_used integer, day_limit integer, month_limit integer
  )`).run();
  await DB.prepare(`create table if not exists cost_guard_storage (
    id integer primary key, revision text, verified integer, reserved_bytes integer, limit_bytes integer
  )`).run();
  const now = new Date().toISOString();
  for (const [lane, daily, monthly] of [["dynamic", 500, 5000], ["realtime", 2880, 10000], ["cleanup", 24, 744], ["whiteboard-cleanup", 2880, 30000], ["relay-cleanup", 240, 5000]]) {
    await DB.prepare("insert or replace into cost_guard_budgets values (?, ?, 1, ?, ?, 0, 0, ?, ?)")
      .bind(lane, COST_GUARD_VERSION, Date.now() + 29 * 86400000, now.slice(0, 10), daily, monthly).run();
  }
  await DB.prepare("insert or replace into cost_guard_storage values (1, ?, 1, 0, 8589934592)").bind(COST_GUARD_VERSION).run();
}
