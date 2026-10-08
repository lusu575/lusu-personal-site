// One SQL statement charges all buckets or none. Refusals never extend a ban or
// update timestamps/counts; otherwise repeated 429s themselves amplify writes.
export async function consumeBoundedRateLimits(env, entries) {
  const now = Date.now();
  const normalized = entries.map(([key, policy, weight = 1]) => ({
    key, limit: Math.max(1, Number(policy.limit) || 1),
    window: Math.max(1000, Number(policy.windowMs) || 60000),
    weight: Math.max(1, Math.floor(Number(weight) || 1))
  }));
  if (!normalized.length) return { allowed: true, retryAfterSeconds: 0 };
  if (normalized.length > 8) throw new Error("Too many rate limit buckets.");
  const retryAfterSeconds = Math.max(1, Math.ceil(Math.max(...normalized.map((entry) => entry.window)) / 1000));
  if (normalized.some((entry) => entry.weight > entry.limit)) return { allowed: false, retryAfterSeconds };
  const values = normalized.flatMap((entry) => [entry.key, entry.limit, now - entry.window, entry.weight]);
  const requested = normalized.map(() => "(?, ?, ?, ?)").join(",");
  const eligible = `
    not exists (
      select 1 from requested r join api_rate_limits a on a.bucket_key = r.bucket
      where a.blocked_until > ?
        or (a.window_started_at > r.reset_before and a.request_count + r.weight > r.cap)
    )`;
  const check = await env.DB.prepare(`
    with requested(bucket, cap, reset_before, weight) as (values ${requested})
    select ${eligible} as allowed
  `).bind(...values, now).first();
  if (!check?.allowed) return { allowed: false, retryAfterSeconds };
  const result = await env.DB.prepare(`
    with requested(bucket, cap, reset_before, weight) as (values ${requested}),
    eligibility as materialized (select ${eligible} as allowed)
    insert into api_rate_limits (bucket_key, window_started_at, request_count, blocked_until, updated_at)
    select r.bucket,
      case when a.window_started_at > r.reset_before then a.window_started_at else ? end,
      case when a.window_started_at > r.reset_before then a.request_count + r.weight else r.weight end,
      0, ?
    from requested r cross join eligibility e left join api_rate_limits a on a.bucket_key = r.bucket
    where e.allowed = 1
    on conflict(bucket_key) do update set
      window_started_at = excluded.window_started_at, request_count = excluded.request_count,
      blocked_until = 0, updated_at = excluded.updated_at
  `).bind(...values, now, now, new Date(now).toISOString()).run();
  return { allowed: Number(result?.meta?.changes) === normalized.length, retryAfterSeconds };
}
