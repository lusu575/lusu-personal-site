-- Additive private MCP browser queue; no production data updates.
create table if not exists private_mcp_browser_jobs (
  job_id text primary key, user_id text not null, browser_id text not null,
  request_json text not null, state text not null, result_json text,
  created_at text not null, expires_at text not null
);
create index if not exists private_mcp_browser_jobs_claim_idx
  on private_mcp_browser_jobs(user_id, browser_id, state, created_at);
