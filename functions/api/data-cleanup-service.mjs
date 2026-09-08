export const DATA_CLEANUP_STATE_KEY = "api_periodic_data_cleanup";
export const DATA_CLEANUP_LEASE_KEY = `${DATA_CLEANUP_STATE_KEY}:lease`;
const DAY = 24 * 60 * 60 * 1000;
const LEASE_MS = 60 * 1000;
const DELETE_LIMIT = 5000;
const MAX_ROUNDS = 20;
const BUDGET_MS = 8000;
const POLICIES = Object.freeze([
  ["sessions", "token_hash", "expires_at", 0, "<="],
  ["user_login_events", "event_id", "created_at", 365],
  ["api_rate_limits", "bucket_key", "updated_at", 2],
  ["agent_device_authorizations", "device_id", "expires_at", 0, "<="],
  ["agent_access_tokens", "token_id", "expires_at", 0, "<=", " or revoked_at <> ''"],
  ["agent_audit_log", "event_id", "created_at", 180],
  ["agent_article_receipts", "rowid", "created_at", 180],
  ["agent_video_receipts", "rowid", "created_at", 180],
  ["japanese_subtext_agent_receipts", "rowid", "created_at", 180],
  ["japanese_subtext_agent_attempts", "attempt_id", "created_at", 180],
  ["analytics_page_views", "event_id", "created_at", 180],
  ["analytics_click_events", "event_id", "created_at", 180],
  ["article_view_events", "event_id", "created_at", 180]
]);

export async function runPeriodicDataCleanup(env, { now = new Date(), budgetMs = BUDGET_MS, maxRounds = MAX_ROUNDS } = {}) {
  const startedAt = Date.now();
  const dueBefore = new Date(now.getTime() - DAY).toISOString();
  const state = await env.DB.prepare("select updated_at from site_runtime_state where key = ?")
    .bind(DATA_CLEANUP_STATE_KEY).first();
  if (state?.updated_at && state.updated_at > dueBefore) return false;

  const owner = crypto.randomUUID();
  const claimed = await env.DB.prepare(`
    insert into site_runtime_state (key, value, updated_at) values (?, ?, ?)
    on conflict(key) do update set value = excluded.value, updated_at = excluded.updated_at
    where site_runtime_state.updated_at <= ?
  `).bind(DATA_CLEANUP_LEASE_KEY, owner, new Date(now.getTime() + LEASE_MS).toISOString(), now.toISOString()).run();
  if (Number(claimed?.meta?.changes || 0) !== 1) return false;

  try {
    const tables = new Set((await env.DB.prepare("select name from sqlite_master where type = 'table'").all())
      .results.map((row) => row.name));
    let pending = POLICIES.filter(([table]) => tables.has(table));
    let rounds = 0;
    while (pending.length && rounds < maxRounds && Date.now() - startedAt < budgetMs) {
      const statements = pending.map(([table, key, time, days, operator = "<", extra = ""]) => (
        env.DB.prepare(`delete from ${table} where ${key} in (
          select ${key} from ${table} where ${time} ${operator} ?${extra}
          order by ${time}, ${key} limit ?
        )`).bind(new Date(now.getTime() - days * DAY).toISOString(), DELETE_LIMIT)
      ));
      let results;
      // D1 batches roll back on failure. One bounded retry handles transient errors;
      // failure or an exhausted time budget leaves the success marker untouched.
      try { results = await env.DB.batch(statements); } catch (error) {
        if (Date.now() - startedAt >= budgetMs) throw error;
        results = await env.DB.batch(statements);
      }
      pending = pending.filter((_policy, index) => Number(results[index]?.meta?.changes || 0) >= DELETE_LIMIT);
      rounds += 1;
    }
    if (pending.length) return false;
    const marked = await env.DB.prepare(`
      insert into site_runtime_state (key, value, updated_at)
      select ?, 'complete', ? where exists (
        select 1 from site_runtime_state where key = ? and value = ?
      )
      on conflict(key) do update set value = excluded.value, updated_at = excluded.updated_at
    `).bind(DATA_CLEANUP_STATE_KEY, now.toISOString(), DATA_CLEANUP_LEASE_KEY, owner).run();
    return Number(marked?.meta?.changes || 0) === 1;
  } finally {
    await env.DB.prepare("delete from site_runtime_state where key = ? and value = ?")
      .bind(DATA_CLEANUP_LEASE_KEY, owner).run();
  }
}
