export const MCP_OWNER_RESOURCE = "https://lusu575.com/mcp";

const GRANT_REF_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;
const SCOPE_PATTERN = /^[a-z0-9][a-z0-9:._-]{0,127}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const schemaReadyBindings = new WeakSet();

export class McpOAuthLedgerError extends Error {
  constructor(message, status = 400, code = "MCP_OAUTH_LEDGER_ERROR", details = null) {
    super(message);
    this.name = "McpOAuthLedgerError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function ensureMcpOAuthLedgerSchema(env) {
  const db = requireDatabase(env);
  if (schemaReadyBindings.has(db)) {
    return;
  }

  await db.batch([
    db.prepare(`
      create table if not exists mcp_oauth_grants (
        grant_ref text primary key,
        user_id text not null references users(id) on delete cascade,
        client_id text not null,
        client_name text not null default '',
        resource text not null,
        authorized_scopes text not null default '[]',
        status text not null default 'pending',
        created_at text not null,
        activated_at text not null default '',
        expires_at text not null default '',
        revoked_at text not null default '',
        revoked_reason text not null default '',
        last_used_at text not null default ''
      )
    `),
    db.prepare(`
      create table if not exists mcp_oauth_audit_log (
        event_id text primary key,
        user_id text not null default '',
        client_id text not null default '',
        grant_ref text not null default '',
        token_ref_hash text not null default '',
        resource text not null default '',
        capability_id text not null default '',
        tool_name text not null default '',
        operation_id text not null default '',
        target_type text not null default '',
        target_id_hash text not null default '',
        requested_scopes text not null default '[]',
        effective_scopes text not null default '[]',
        action text not null,
        result text not null default '',
        error_code text not null default '',
        ip_hash text not null default '',
        created_at text not null
      )
    `),
    db.prepare(`
      create table if not exists mcp_oauth_registration_limits (
        bucket_key text primary key,
        request_count integer not null default 0,
        expires_at text not null,
        updated_at text not null
      )
    `),
    db.prepare(`
      create index if not exists mcp_oauth_grants_user_status_idx
      on mcp_oauth_grants(user_id, status, created_at)
    `),
    db.prepare(`
      create index if not exists mcp_oauth_grants_client_resource_idx
      on mcp_oauth_grants(client_id, resource, status)
    `),
    db.prepare(`
      create index if not exists mcp_oauth_audit_created_idx
      on mcp_oauth_audit_log(created_at, action)
    `),
    db.prepare(`
      create index if not exists mcp_oauth_audit_grant_idx
      on mcp_oauth_audit_log(grant_ref, created_at)
    `),
    db.prepare(`
      create index if not exists mcp_oauth_registration_limits_expires_idx
      on mcp_oauth_registration_limits(expires_at)
    `)
  ]);

  schemaReadyBindings.add(db);
}

export async function consumeMcpOAuthRegistrationLimit({
  env,
  bucketKey,
  limit,
  expiresAt,
  now = new Date().toISOString()
}) {
  await ensureMcpOAuthLedgerSchema(env);
  const normalizedBucketKey = normalizeText(bucketKey, "bucketKey", 160);
  const normalizedLimit = Number(limit);
  if (!Number.isInteger(normalizedLimit) || normalizedLimit < 1 || normalizedLimit > 1_000) {
    throw new McpOAuthLedgerError(
      "Invalid OAuth registration rate limit.",
      500,
      "MCP_OAUTH_RATE_LIMIT_INVALID"
    );
  }
  const normalizedNow = normalizeTimestamp(now, "now");
  const normalizedExpiresAt = normalizeTimestamp(expiresAt, "expiresAt");
  const results = await env.DB.batch([
    env.DB.prepare(`
      delete from mcp_oauth_registration_limits
      where expires_at <= ?
    `).bind(normalizedNow),
    env.DB.prepare(`
      insert into mcp_oauth_registration_limits (
        bucket_key, request_count, expires_at, updated_at
      ) values (?, 1, ?, ?)
      on conflict(bucket_key) do update set
        request_count = mcp_oauth_registration_limits.request_count + 1,
        updated_at = excluded.updated_at
      where mcp_oauth_registration_limits.request_count < ?
    `).bind(
      normalizedBucketKey,
      normalizedExpiresAt,
      normalizedNow,
      normalizedLimit
    )
  ]);
  return { allowed: changes(results?.[1]) === 1 };
}

export async function createPendingMcpOAuthGrant({
  env,
  grantRef,
  userId,
  clientId,
  clientName = "",
  resource = MCP_OWNER_RESOURCE,
  authorizedScopes,
  expiresAt = "",
  createdAt = new Date().toISOString()
}) {
  await ensureMcpOAuthLedgerSchema(env);
  const normalized = normalizeGrantInput({
    grantRef,
    userId,
    clientId,
    clientName,
    resource,
    authorizedScopes,
    expiresAt,
    createdAt
  });

  try {
    await env.DB.prepare(`
      insert into mcp_oauth_grants (
        grant_ref, user_id, client_id, client_name, resource,
        authorized_scopes, status, created_at, expires_at
      ) values (?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    `).bind(
      normalized.grantRef,
      normalized.userId,
      normalized.clientId,
      normalized.clientName,
      normalized.resource,
      JSON.stringify(normalized.authorizedScopes),
      normalized.createdAt,
      normalized.expiresAt
    ).run();
  } catch (error) {
    throw new McpOAuthLedgerError(
      "The OAuth grant could not be created.",
      409,
      "MCP_OAUTH_GRANT_CONFLICT"
    );
  }

  return getMcpOAuthGrant(env, normalized.grantRef);
}

export async function activateMcpOAuthGrant({ env, grantRef, activatedAt = new Date().toISOString() }) {
  await ensureMcpOAuthLedgerSchema(env);
  const normalizedGrantRef = normalizeGrantRef(grantRef);
  const normalizedActivatedAt = normalizeTimestamp(activatedAt, "activatedAt");
  const pending = await env.DB.prepare(`
    select user_id, client_id, resource
    from mcp_oauth_grants
    where grant_ref = ? and status = 'pending'
    limit 1
  `).bind(normalizedGrantRef).first();
  if (!pending) {
    throw new McpOAuthLedgerError(
      "The OAuth grant is no longer pending.",
      409,
      "MCP_OAUTH_GRANT_NOT_PENDING"
    );
  }
  const results = await env.DB.batch([
    env.DB.prepare(`
      update mcp_oauth_grants
      set status = 'revoked', revoked_at = ?, revoked_reason = 'superseded'
      where user_id = ? and client_id = ? and resource = ?
        and grant_ref <> ? and status = 'active' and revoked_at = ''
    `).bind(
      normalizedActivatedAt,
      pending.user_id,
      pending.client_id,
      pending.resource,
      normalizedGrantRef
    ),
    env.DB.prepare(`
      update mcp_oauth_grants
      set status = 'active', activated_at = ?, revoked_at = '', revoked_reason = ''
      where grant_ref = ? and status = 'pending'
    `).bind(normalizedActivatedAt, normalizedGrantRef)
  ]);
  if (changes(results?.[1]) !== 1) {
    throw new McpOAuthLedgerError(
      "The OAuth grant changed while it was being activated.",
      409,
      "MCP_OAUTH_GRANT_CHANGED"
    );
  }
  return getMcpOAuthGrant(env, normalizedGrantRef);
}

export async function revokeMcpOAuthGrant({
  env,
  grantRef,
  reason = "revoked",
  revokedAt = new Date().toISOString()
}) {
  await ensureMcpOAuthLedgerSchema(env);
  const normalizedGrantRef = normalizeGrantRef(grantRef);
  const result = await env.DB.prepare(`
    update mcp_oauth_grants
    set status = 'revoked', revoked_at = ?, revoked_reason = ?
    where grant_ref = ? and status <> 'revoked'
  `).bind(
    normalizeTimestamp(revokedAt, "revokedAt"),
    normalizeText(reason, "reason", 160),
    normalizedGrantRef
  ).run();
  return { revoked: changes(result) === 1 };
}

export async function getMcpOAuthGrant(env, grantRef) {
  await ensureMcpOAuthLedgerSchema(env);
  const row = await env.DB.prepare(`
    select grant_ref, user_id, client_id, client_name, resource,
      authorized_scopes, status, created_at, activated_at, expires_at,
      revoked_at, revoked_reason, last_used_at
    from mcp_oauth_grants
    where grant_ref = ?
    limit 1
  `).bind(normalizeGrantRef(grantRef)).first();
  return row ? publicGrant(row) : null;
}

export async function assertActiveMcpOAuthGrant({
  env,
  principal,
  requiredScopes = /** @type {string[]} */ ([]),
  requireAdmin = false,
  touch = true,
  now = new Date().toISOString()
}) {
  await ensureMcpOAuthLedgerSchema(env);
  const normalizedPrincipal = normalizePrincipal(principal);
  const normalizedRequiredScopes = normalizeScopes(requiredScopes);
  const normalizedNow = normalizeTimestamp(now, "now");
  const row = await env.DB.prepare(`
    select mcp_oauth_grants.grant_ref, mcp_oauth_grants.user_id,
      mcp_oauth_grants.client_id, mcp_oauth_grants.client_name,
      mcp_oauth_grants.resource, mcp_oauth_grants.authorized_scopes,
      mcp_oauth_grants.status, mcp_oauth_grants.created_at,
      mcp_oauth_grants.activated_at, mcp_oauth_grants.expires_at,
      mcp_oauth_grants.revoked_at, mcp_oauth_grants.revoked_reason,
      mcp_oauth_grants.last_used_at, users.role as user_role
    from mcp_oauth_grants
    join users on users.id = mcp_oauth_grants.user_id
    where mcp_oauth_grants.grant_ref = ?
      and mcp_oauth_grants.user_id = ?
      and mcp_oauth_grants.client_id = ?
      and mcp_oauth_grants.resource = ?
    limit 1
  `).bind(
    normalizedPrincipal.grantRef,
    normalizedPrincipal.userId,
    normalizedPrincipal.clientId,
    normalizedPrincipal.resource
  ).first();

  if (!row || row.status !== "active" || row.revoked_at
    || (row.expires_at && row.expires_at <= normalizedNow)) {
    throw new McpOAuthLedgerError(
      "The OAuth grant is inactive or revoked.",
      401,
      "MCP_OAUTH_GRANT_INACTIVE"
    );
  }

  const authorizedScopes = parseStoredScopes(row.authorized_scopes);
  const effectiveScopeSet = new Set(normalizedPrincipal.effectiveScopes);
  const authorizedScopeSet = new Set(authorizedScopes);
  const missingScopes = normalizedRequiredScopes.filter((scope) => (
    !effectiveScopeSet.has(scope) || !authorizedScopeSet.has(scope)
  ));
  if (missingScopes.length) {
    throw new McpOAuthLedgerError(
      `The OAuth grant is missing required scope: ${missingScopes.join(", ")}.`,
      403,
      "MCP_OAUTH_SCOPE_REQUIRED",
      { requiredScopes: missingScopes }
    );
  }
  if (requireAdmin && row.user_role !== "admin") {
    throw new McpOAuthLedgerError(
      "The current account is no longer an administrator.",
      403,
      "MCP_OAUTH_ADMIN_REQUIRED"
    );
  }

  if (touch) {
    const result = await env.DB.prepare(`
      update mcp_oauth_grants
      set last_used_at = ?
      where grant_ref = ? and status = 'active' and revoked_at = ''
    `).bind(normalizedNow, normalizedPrincipal.grantRef).run();
    if (changes(result) !== 1) {
      throw new McpOAuthLedgerError(
        "The OAuth grant changed while the request was being authorized.",
        409,
        "MCP_OAUTH_GRANT_CHANGED"
      );
    }
  }

  return {
    ...publicGrant(row),
    authorizedScopes,
    effectiveScopes: normalizedPrincipal.effectiveScopes,
    currentRole: row.user_role || "user"
  };
}

export async function recordMcpOAuthAudit({
  env,
  principal = {},
  eventId = crypto.randomUUID(),
  capabilityId = "",
  toolName = "",
  operationId = "",
  targetType = "",
  targetId = "",
  requestedScopes = /** @type {string[]} */ ([]),
  action,
  result,
  errorCode = "",
  tokenRefHash = "",
  ipHash = "",
  createdAt = new Date().toISOString()
}) {
  await ensureMcpOAuthLedgerSchema(env);
  const normalizedPrincipal = normalizeAuditPrincipal(principal);
  const normalizedTokenRefHash = String(tokenRefHash || "").toLowerCase();
  const normalizedIpHash = String(ipHash || "").toLowerCase();
  const targetIdHash = targetId ? await sha256Hex(`mcp-audit-target:${String(targetId)}`) : "";

  await env.DB.prepare(`
    insert into mcp_oauth_audit_log (
      event_id, user_id, client_id, grant_ref, token_ref_hash, resource,
      capability_id, tool_name, operation_id, target_type, target_id_hash,
      requested_scopes, effective_scopes, action, result, error_code,
      ip_hash, created_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    normalizeText(eventId, "eventId", 128),
    normalizedPrincipal.userId,
    normalizedPrincipal.clientId,
    normalizedPrincipal.grantRef,
    SHA256_PATTERN.test(normalizedTokenRefHash) ? normalizedTokenRefHash : "",
    normalizedPrincipal.resource,
    normalizeText(capabilityId, "capabilityId", 160, true),
    normalizeText(toolName, "toolName", 160, true),
    normalizeText(operationId, "operationId", 160, true),
    normalizeText(targetType, "targetType", 80, true),
    targetIdHash,
    JSON.stringify(normalizeScopes(requestedScopes)),
    JSON.stringify(normalizedPrincipal.effectiveScopes),
    normalizeText(action, "action", 160),
    normalizeText(result, "result", 80),
    normalizeText(errorCode, "errorCode", 160, true),
    SHA256_PATTERN.test(normalizedIpHash) ? normalizedIpHash : "",
    normalizeTimestamp(createdAt, "createdAt")
  ).run();

  return { eventId: String(eventId) };
}

export async function mcpOAuthAuditIpHash(request, env) {
  const ip = String(request?.headers?.get?.("CF-Connecting-IP") || "").trim();
  const secret = String(env?.ANALYTICS_IP_HASH_SALT || "").trim();
  if (!ip || secret.length < 32) {
    return "";
  }
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return bytesToHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`mcp-oauth:${ip}`)));
}

function requireDatabase(env) {
  if (!env?.DB || typeof env.DB.prepare !== "function" || typeof env.DB.batch !== "function") {
    throw new McpOAuthLedgerError("D1 binding is unavailable.", 500, "MCP_OAUTH_DB_UNAVAILABLE");
  }
  return env.DB;
}

function normalizeGrantInput(value) {
  return {
    grantRef: normalizeGrantRef(value.grantRef),
    userId: normalizeText(value.userId, "userId", 128),
    clientId: normalizeText(value.clientId, "clientId", 2048),
    clientName: normalizeText(value.clientName, "clientName", 240, true),
    resource: normalizeResource(value.resource),
    authorizedScopes: normalizeScopes(value.authorizedScopes),
    expiresAt: value.expiresAt ? normalizeTimestamp(value.expiresAt, "expiresAt") : "",
    createdAt: normalizeTimestamp(value.createdAt, "createdAt")
  };
}

function normalizePrincipal(value) {
  if (!value || value.authType !== "oauth") {
    throw new McpOAuthLedgerError("A verified OAuth principal is required.", 401, "MCP_OAUTH_PRINCIPAL_REQUIRED");
  }
  return {
    authType: "oauth",
    userId: normalizeText(value.userId, "principal.userId", 128),
    clientId: normalizeText(value.clientId, "principal.clientId", 2048),
    grantRef: normalizeGrantRef(value.grantRef),
    resource: normalizeResource(value.resource),
    effectiveScopes: normalizeScopes(value.effectiveScopes)
  };
}

function normalizeAuditPrincipal(value) {
  return {
    userId: normalizeText(value.userId, "principal.userId", 128, true),
    clientId: normalizeText(value.clientId, "principal.clientId", 2048, true),
    grantRef: value.grantRef ? normalizeGrantRef(value.grantRef) : "",
    resource: value.resource ? normalizeResource(value.resource) : "",
    effectiveScopes: normalizeScopes(value.effectiveScopes || [])
  };
}

function normalizeGrantRef(value) {
  const normalized = String(value || "").trim();
  if (!GRANT_REF_PATTERN.test(normalized)) {
    throw new McpOAuthLedgerError("Invalid OAuth grant reference.", 400, "MCP_OAUTH_GRANT_REF_INVALID");
  }
  return normalized;
}

function normalizeResource(value) {
  const normalized = String(value || "").trim();
  if (normalized !== MCP_OWNER_RESOURCE) {
    throw new McpOAuthLedgerError("Invalid OAuth resource.", 401, "MCP_OAUTH_RESOURCE_INVALID");
  }
  return normalized;
}

function normalizeScopes(values) {
  if (!Array.isArray(values)) {
    throw new McpOAuthLedgerError("OAuth scopes must be an array.", 400, "MCP_OAUTH_SCOPES_INVALID");
  }
  const scopes = [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))].sort();
  if (scopes.length > 32 || scopes.some((scope) => !SCOPE_PATTERN.test(scope))) {
    throw new McpOAuthLedgerError("OAuth scopes are invalid.", 400, "MCP_OAUTH_SCOPES_INVALID");
  }
  return scopes;
}

function parseStoredScopes(value) {
  try {
    return normalizeScopes(JSON.parse(String(value || "[]")));
  } catch {
    throw new McpOAuthLedgerError("Stored OAuth scopes are invalid.", 500, "MCP_OAUTH_SCOPES_CORRUPT");
  }
}

function normalizeText(value, field, maxLength, allowEmpty = false) {
  const normalized = String(value ?? "").trim();
  if ((!allowEmpty && !normalized) || normalized.length > maxLength || /[\u0000-\u001f\u007f]/.test(normalized)) {
    throw new McpOAuthLedgerError(`Invalid ${field}.`, 400, "MCP_OAUTH_FIELD_INVALID", { field });
  }
  return normalized;
}

function normalizeTimestamp(value, field) {
  const normalized = normalizeText(value, field, 64);
  if (!Number.isFinite(Date.parse(normalized))) {
    throw new McpOAuthLedgerError(`Invalid ${field}.`, 400, "MCP_OAUTH_TIMESTAMP_INVALID", { field });
  }
  return normalized;
}

function publicGrant(row) {
  return {
    grantRef: String(row.grant_ref || ""),
    userId: String(row.user_id || ""),
    clientId: String(row.client_id || ""),
    clientName: String(row.client_name || ""),
    resource: String(row.resource || ""),
    authorizedScopes: parseStoredScopes(row.authorized_scopes),
    status: String(row.status || ""),
    createdAt: String(row.created_at || ""),
    activatedAt: String(row.activated_at || ""),
    expiresAt: String(row.expires_at || ""),
    revokedAt: String(row.revoked_at || ""),
    revokedReason: String(row.revoked_reason || ""),
    lastUsedAt: String(row.last_used_at || "")
  };
}

function changes(result) {
  return Number(result?.meta?.changes ?? result?.changes ?? 0);
}

async function sha256Hex(value) {
  return bytesToHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

function bytesToHex(value) {
  return [...new Uint8Array(value)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
