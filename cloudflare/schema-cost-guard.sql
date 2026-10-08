-- Run as an additive migration while all dynamic writers are paused.
-- Empty budgets and an unverified bucket intentionally grant NO access.
create table if not exists cost_guard_budgets (
  id text primary key,
  revision text not null,
  enabled integer not null default 0 check (enabled in (0, 1)),
  valid_until integer not null,
  day text not null,
  day_used integer not null default 0 check (day_used >= 0),
  month_used integer not null default 0 check (month_used >= 0),
  day_limit integer not null check (day_limit > 0),
  month_limit integer not null check (month_limit > 0)
);
create table if not exists cost_guard_storage (
  id integer primary key check (id = 1),
  revision text not null,
  verified integer not null default 0 check (verified in (0, 1)),
  reserved_bytes integer not null check (reserved_bytes >= 0),
  limit_bytes integer not null check (limit_bytes > 0 and limit_bytes <= 8589934592)
);
