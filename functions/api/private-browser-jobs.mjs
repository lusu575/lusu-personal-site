import { assertActiveMcpOAuthGrant } from "./mcp-oauth-ledger.mjs";

const ACTIONS = new Set(["observe", "gather", "build", "research", "assign", "whiteboard_snapshot"]);

/** Commands are consumed once; uncertain execution is never automatically replayed. */
export async function privateBrowserJob({ env, principal, operation, input }) {
  if (!env.MCP_OWNER_USER_ID || principal?.userId !== env.MCP_OWNER_USER_ID) throw new Error("MCP_OWNER_REQUIRED");
  await assertActiveMcpOAuthGrant({ env, principal, requireAdmin: true,
    requiredScopes: [operation === "result" ? "admin:read" : "admin:write"] });
  await env.DB.prepare(`create table if not exists private_mcp_browser_jobs (
    job_id text primary key, user_id text not null, browser_id text not null,
    request_json text not null, state text not null, result_json text,
    created_at text not null, expires_at text not null
  )`).run();
  const now = new Date().toISOString();
  if (operation === "submit") {
    if (!/^[A-Za-z0-9_-]{16,100}$/.test(input.browserId || "")) throw new Error("BROWSER_ID_INVALID");
    if (!ACTIONS.has(input.action)) throw new Error("BROWSER_ACTION_INVALID");
    if (input.count !== undefined && (!Number.isInteger(input.count) || input.count < 1 || input.count > 10)) throw new Error("BROWSER_COUNT_INVALID");
    if (["build", "research", "observe"].includes(input.action) && (input.count ?? 1) !== 1) throw new Error("BROWSER_SINGLE_ACTION_REQUIRED");
    if (["build", "research", "assign"].includes(input.action) && !/^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(input.id || "")) throw new Error("BROWSER_TARGET_INVALID");
    const jobId = crypto.randomUUID();
    // Keep potentially sensitive snapshots only briefly; bound outstanding work atomically.
    await env.DB.prepare("delete from private_mcp_browser_jobs where user_id=? and expires_at<?")
      .bind(principal.userId, new Date(Date.now() - 86400_000).toISOString()).run();
    const inserted = await env.DB.prepare(`insert into private_mcp_browser_jobs
      (job_id,user_id,browser_id,request_json,state,created_at,expires_at)
      select ?,?,?,?,'queued',?,? where
      (select count(*) from private_mcp_browser_jobs where user_id=? and state in ('queued','running') and expires_at>?) < 32`).bind(jobId, principal.userId, input.browserId,
      JSON.stringify({ action: input.action, id: input.id, count: input.count }), now,
      new Date(Date.now() + 60_000).toISOString(), principal.userId, now).run();
    if (Number(inserted.meta?.changes) !== 1) throw new Error("BROWSER_QUEUE_FULL");
    return { jobId, state: "queued", execution: "pending-real-browser", expiresInSeconds: 60 };
  }
  if (operation === "claim") {
    const row = await env.DB.prepare(`select job_id,request_json from private_mcp_browser_jobs
      where user_id=? and browser_id=? and state='queued' and expires_at>?
      order by created_at limit 1`).bind(principal.userId, input.browserId, now).first();
    if (!row) return { job: null };
    const changed = await env.DB.prepare(`update private_mcp_browser_jobs set state='running'
      where job_id=? and user_id=? and browser_id=? and state='queued' and expires_at>?`)
      .bind(row.job_id, principal.userId, input.browserId, now).run();
    return { job: Number(changed.meta?.changes) === 1 ? { jobId: row.job_id, request: JSON.parse(row.request_json) } : null };
  }
  if (operation === "complete") {
    const result = JSON.stringify(input.result);
    if (new TextEncoder().encode(result).byteLength > 3_000_000) throw new Error("BROWSER_RESULT_TOO_LARGE");
    const changed = await env.DB.prepare(`update private_mcp_browser_jobs set state=?,result_json=?
      where job_id=? and user_id=? and browser_id=? and state='running' and expires_at>?`)
      .bind(input.failed ? "failed" : "done", result, input.jobId, principal.userId, input.browserId, now).run();
    if (Number(changed.meta?.changes) !== 1) throw new Error("BROWSER_RESULT_CONFLICT_OR_EXPIRED");
    return { accepted: true };
  }
  if (operation !== "result") throw new Error("BROWSER_OPERATION_INVALID");
  const row = await env.DB.prepare(`select state,result_json,expires_at from private_mcp_browser_jobs
    where job_id=? and user_id=?`).bind(input.jobId, principal.userId).first();
  if (!row) throw new Error("BROWSER_JOB_NOT_FOUND");
  return { state: row.expires_at <= now && ["queued", "running"].includes(row.state)
    ? (row.state === "running" ? "execution-unknown" : "expired") : row.state,
    result: row.result_json ? JSON.parse(row.result_json) : null };
}
