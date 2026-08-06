const SESSION_COOKIE = "lusu_session";
const AGENT_TOKEN_PREFIX = "lusu_agent_";
const DEVICE_TTL_MS = 10 * 60 * 1000;
const ACCESS_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const POLL_INTERVAL_SECONDS = 5;
const MAX_JSON_BYTES = 16 * 1024;
const MAX_FORM_BYTES = 8 * 1024;
const DEVICE_RATE_WINDOW_MS = 10 * 60 * 1000;
const DEVICE_RATE_LIMIT = 10;
const DEVICE_TOKEN_RATE_WINDOW_MS = 10 * 60 * 1000;
const DEVICE_TOKEN_RATE_LIMIT = 300;
const DEVICE_LOOKUP_WINDOW_MS = 10 * 60 * 1000;
const DEVICE_LOOKUP_LIMIT = 20;
const DEVICE_LOOKUP_BACKOFF_MS = 10 * 60 * 1000;
const MAX_ACTIVE_TOKENS_PER_USER = 20;
const USER_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const AGENT_SCOPE_DEFINITIONS = Object.freeze({
  "content:read": Object.freeze({ readOnly: true }),
  "transfer:read": Object.freeze({ readOnly: true }),
  "transfer:write": Object.freeze({ readOnly: false }),
  "transfer:delete": Object.freeze({ readOnly: false }),
  "whiteboard:read": Object.freeze({ readOnly: true }),
  "whiteboard:write": Object.freeze({ readOnly: false }),
  "japanese-subtext:progress:read": Object.freeze({ readOnly: true }),
  "japanese-subtext:progress:write": Object.freeze({ readOnly: false })
});

const DEFAULT_SCOPES = Object.freeze([
  "content:read",
  "transfer:read",
  "transfer:write"
]);

export function isAgentAuthApiPath(parts) {
  return parts[0] === "agent-auth";
}

export function isAgentBearerRequest(request) {
  return Boolean(readAgentBearer(request));
}

export async function handleAgentAuthApi(context, parts) {
  if (!isAgentAuthApiPath(parts)) {
    return null;
  }

  const { request, env } = context;
  const route = parts.slice(1).join("/");
  try {
    if (request.method === "POST" && route === "device/start") {
      return await startDeviceAuthorization(request, env);
    }
    if (request.method === "GET" && route === "device/authorize") {
      return await showDeviceAuthorization(request, env);
    }
    if (request.method === "POST" && route === "device/authorize") {
      return await decideDeviceAuthorization(request, env);
    }
    if (request.method === "POST" && route === "device/token") {
      return await exchangeDeviceAuthorization(request, env);
    }
    if (request.method === "GET" && route === "me") {
      const principal = await authenticateAgentBearer(request, env);
      return agentJson({
        user: principal.user,
        scopes: principal.scopes,
        expiresAt: principal.expiresAt,
        clientName: principal.clientName
      });
    }
    if (request.method === "DELETE" && route === "tokens/current") {
      const principal = await authenticateAgentBearer(request, env);
      const now = new Date().toISOString();
      const revokeEventId = crypto.randomUUID();
      await env.DB.batch([
        env.DB.prepare(`
          update agent_access_tokens
          set revoked_at = ?, revoked_event_id = ?
          where token_id = ? and revoked_at = ''
        `).bind(now, revokeEventId, principal.tokenId),
        conditionalAgentAuditStatement(env, {
          actorUserId: principal.user.id,
          tokenId: principal.tokenId,
          action: "agent-token-revoked",
          targetType: "agent-token",
          targetId: principal.tokenId,
          scopes: principal.scopes,
          result: "success",
          createdAt: now
        }, "select 1 from agent_access_tokens where token_id = ? and revoked_event_id = ?", [
          principal.tokenId,
          revokeEventId
        ])
      ]);
      return agentJson({ ok: true });
    }
    if (request.method === "GET" && route === "tokens/manage") {
      return await showTokenManagement(request, env);
    }
    if (request.method === "POST" && route === "tokens/manage") {
      return await updateTokenManagement(request, env);
    }
    return agentJson({ error: "Agent authorization endpoint not found.", code: "AGENT_AUTH_NOT_FOUND" }, 404);
  } catch (error) {
    const expected = error instanceof AgentAuthError;
    const status = expected ? error.status : 500;
    if (status >= 500) {
      console.error(JSON.stringify({
        message: "agent authorization request failed",
        path: new URL(request.url).pathname,
        error: error instanceof Error ? error.message : String(error)
      }));
    }
    const response = agentJson({
      error: expected ? error.message : "Agent authorization is temporarily unavailable.",
      code: expected ? error.code : "AGENT_AUTH_INTERNAL_ERROR"
    }, status);
    if (expected && error.retryAfter > 0) {
      response.headers.set("Retry-After", String(error.retryAfter));
    }
    if (status === 401) {
      response.headers.set("WWW-Authenticate", "Bearer realm=\"lusu-agent\"");
    }
    return response;
  }
}

export async function authenticateAgentBearer(request, env, requiredScopes = []) {
  const token = readAgentBearer(request);
  if (!token) {
    throw new AgentAuthError("Agent access token is required.", 401, "AGENT_TOKEN_REQUIRED");
  }
  const row = await env.DB.prepare(`
    select
      agent_access_tokens.token_id,
      agent_access_tokens.client_name,
      agent_access_tokens.scopes,
      agent_access_tokens.expires_at,
      users.id as user_id,
      users.email,
      users.role
    from agent_access_tokens
    join users on users.id = agent_access_tokens.user_id
    where agent_access_tokens.token_hash = ?
      and agent_access_tokens.revoked_at = ''
      and agent_access_tokens.expires_at > ?
    limit 1
  `).bind(await sha256Hex(token), new Date().toISOString()).first();

  if (!row) {
    throw new AgentAuthError("Agent access token is invalid or expired.", 401, "AGENT_TOKEN_INVALID");
  }

  const scopes = parseStoredScopes(row.scopes);
  const missing = normalizeScopeList(requiredScopes).filter((scope) => !scopeIsGranted(scopes, scope));
  if (missing.length) {
    throw new AgentAuthError(
      `Agent access token is missing required scope: ${missing.join(", ")}.`,
      403,
      "AGENT_SCOPE_REQUIRED"
    );
  }

  return {
    authType: "agent-token",
    tokenId: row.token_id,
    clientName: row.client_name || "Agent client",
    scopes,
    expiresAt: row.expires_at,
    user: {
      id: row.user_id,
      email: row.email,
      role: "user"
    }
  };
}

async function startDeviceAuthorization(request, env) {
  assertJsonRequest(request);
  const body = await readBoundedJson(request, MAX_JSON_BYTES);
  const clientName = normalizeClientName(body.clientName);
  const scopes = normalizeRequestedScopes(body.scopes);
  const ipHash = await agentIpHash(request, env);
  await assertDeviceStartRate(env, ipHash);

  const deviceCode = randomToken(32);
  const userCode = randomUserCode();
  const deviceId = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + DEVICE_TTL_MS).toISOString();
  await env.DB.prepare(`
    insert into agent_device_authorizations (
      device_id, device_code_hash, user_code_hash, client_name,
      requested_scopes, granted_scopes, user_id, status,
      csrf_hash, ip_hash, created_at, expires_at, approved_at, consumed_at
    ) values (?, ?, ?, ?, ?, '[]', null, 'pending', '', ?, ?, ?, '', '')
  `).bind(
    deviceId,
    await sha256Hex(deviceCode),
    await sha256Hex(normalizeUserCode(userCode)),
    clientName,
    JSON.stringify(scopes),
    ipHash,
    now.toISOString(),
    expiresAt
  ).run();

  const verificationUrl = new URL("/api/agent-auth/device/authorize", request.url);
  verificationUrl.searchParams.set("user_code", userCode);
  return agentJson({
    deviceCode,
    userCode,
    verificationUri: new URL("/api/agent-auth/device/authorize", request.url).toString(),
    verificationUriComplete: verificationUrl.toString(),
    expiresIn: Math.floor(DEVICE_TTL_MS / 1000),
    interval: POLL_INTERVAL_SECONDS,
    scopes
  }, 201);
}

async function showDeviceAuthorization(request, env) {
  const url = new URL(request.url);
  assertTrustedAuthorizationNavigation(request);
  await assertDeviceLookupRate(request, env);
  const userCode = normalizeUserCode(url.searchParams.get("user_code"));
  const row = await findActiveDeviceByUserCode(env, userCode);
  if (!row) {
    return authorizationHtml(request, {
      title: "授权码无效或已过期 / Authorization code expired / 認証コードの期限切れ",
      body: "请回到 CLI 重新开始登录。 / Return to the CLI and start again. / CLI に戻って再試行してください。"
    }, 404);
  }

  const session = await getBrowserSession(request, env);
  if (!session) {
    return authorizationHtml(request, {
      title: "请先登录网站 / Sign in first / 先にログインしてください",
      body: "请在本站首页登录，然后重新打开此授权链接。 / Sign in on the site, then reopen this authorization link. / サイトにログインしてから、このリンクを再度開いてください。",
      homeUrl: new URL("/", request.url).toString()
    }, 401);
  }

  const csrfToken = randomToken(24);
  await env.DB.prepare(`
    update agent_device_authorizations
    set csrf_hash = ?
    where device_id = ? and status = 'pending' and expires_at > ?
  `).bind(await sha256Hex(csrfToken), row.device_id, new Date().toISOString()).run();

  const scopes = parseStoredScopes(row.requested_scopes);
  const response = authorizationConsentHtml(request, {
    clientName: row.client_name,
    userCode,
    scopes,
    csrfToken,
    email: session.user.email
  });
  response.headers.append("Set-Cookie", csrfCookieValue(request, csrfToken, 600));
  return response;
}

async function decideDeviceAuthorization(request, env) {
  assertSameOrigin(request);
  await assertDeviceLookupRate(request, env);
  const form = await readBoundedForm(request, MAX_FORM_BYTES);
  const userCode = normalizeUserCode(form.get("user_code"));
  const decision = String(form.get("decision") || "");
  const csrfToken = String(form.get("csrf_token") || "");
  const cookieToken = readCookie(request, csrfCookieName(request));
  if (!csrfToken || !cookieToken || csrfToken !== cookieToken) {
    throw new AgentAuthError("Authorization confirmation expired.", 403, "AGENT_CSRF_INVALID");
  }

  const row = await findActiveDeviceByUserCode(env, userCode);
  if (!row || !row.csrf_hash || row.csrf_hash !== await sha256Hex(csrfToken)) {
    throw new AgentAuthError("Authorization confirmation expired.", 403, "AGENT_CSRF_INVALID");
  }
  const session = await requireBrowserSession(request, env);
  const now = new Date().toISOString();
  const approved = decision === "approve";
  const status = approved ? "approved" : "denied";
  const grantedScopes = approved ? parseStoredScopes(row.requested_scopes) : [];
  const decisionEventId = crypto.randomUUID();
  const result = await env.DB.batch([
    env.DB.prepare(`
      update agent_device_authorizations
      set user_id = ?, status = ?, granted_scopes = ?, approved_at = ?,
        csrf_hash = '', decision_event_id = ?
      where device_id = ? and status = 'pending' and expires_at > ?
    `).bind(
      session.user.id,
      status,
      JSON.stringify(grantedScopes),
      now,
      decisionEventId,
      row.device_id,
      now
    ),
    conditionalAgentAuditStatement(env, {
      actorUserId: session.user.id,
      tokenId: "",
      action: approved ? "agent-device-approved" : "agent-device-denied",
      targetType: "agent-device",
      targetId: row.device_id,
      scopes: grantedScopes,
      result: status,
      createdAt: now
    }, "select 1 from agent_device_authorizations where device_id = ? and decision_event_id = ?", [
      row.device_id,
      decisionEventId
    ])
  ]);
  if (Number(result[0]?.meta?.changes || 0) !== 1) {
    throw new AgentAuthError("Authorization request is no longer pending.", 409, "AGENT_DEVICE_NOT_PENDING");
  }

  const response = authorizationHtml(request, {
    title: approved
      ? "授权成功 / Authorized / 認証しました"
      : "已拒绝授权 / Authorization denied / 認証を拒否しました",
    body: approved
      ? "现在可以返回 CLI。此页面可以关闭。 / Return to the CLI; you may close this page. / CLI に戻り、このページを閉じてください。"
      : "没有签发任何令牌。 / No token was issued. / トークンは発行されていません。"
  });
  response.headers.append("Set-Cookie", clearCsrfCookieValue(request));
  return response;
}

async function exchangeDeviceAuthorization(request, env) {
  assertJsonRequest(request);
  const body = await readBoundedJson(request, MAX_JSON_BYTES);
  await assertDeviceTokenRate(request, env);
  const deviceCode = normalizeDeviceCode(body.deviceCode);
  const now = new Date();
  const row = await env.DB.prepare(`
    select * from agent_device_authorizations
    where device_code_hash = ?
    limit 1
  `).bind(await sha256Hex(deviceCode)).first();
  if (!row) {
    throw new AgentAuthError("Device authorization is invalid.", 400, "AGENT_DEVICE_INVALID");
  }
  if (Date.parse(row.expires_at) <= now.getTime()) {
    throw new AgentAuthError("Device authorization expired.", 410, "AGENT_DEVICE_EXPIRED");
  }
  if (row.status === "pending") {
    const cutoff = new Date(now.getTime() - POLL_INTERVAL_SECONDS * 1000).toISOString();
    const polled = await env.DB.prepare(`
      update agent_device_authorizations
      set poll_count = poll_count + 1, last_polled_at = ?
      where device_id = ? and status = 'pending'
        and (last_polled_at = '' or last_polled_at <= ?)
      returning poll_count
    `).bind(now.toISOString(), row.device_id, cutoff).first();
    if (!polled) {
      throw new AgentAuthError(
        "Device authorization is being polled too quickly.",
        429,
        "SLOW_DOWN",
        POLL_INTERVAL_SECONDS + 5
      );
    }
    throw new AgentAuthError(
      "Authorization is still pending.",
      428,
      "AUTHORIZATION_PENDING",
      POLL_INTERVAL_SECONDS
    );
  }
  if (row.status === "denied") {
    throw new AgentAuthError("Authorization was denied.", 403, "AUTHORIZATION_DENIED");
  }
  if (row.status !== "approved" || !row.user_id) {
    throw new AgentAuthError("Device authorization was already used.", 409, "AGENT_DEVICE_CONSUMED");
  }

  const accessToken = `${AGENT_TOKEN_PREFIX}${randomToken(32)}`;
  const tokenId = crypto.randomUUID();
  const expiresAt = new Date(now.getTime() + ACCESS_TOKEN_TTL_MS).toISOString();
  const scopes = parseStoredScopes(row.granted_scopes);
  const batch = await env.DB.batch([
    env.DB.prepare(`
      insert into agent_access_tokens (
        token_id, token_hash, token_hint, user_id, client_name, scopes,
        created_at, expires_at, last_used_at, revoked_at
      )
      select ?, ?, ?, user_id, client_name, granted_scopes, ?, ?, '', ''
      from agent_device_authorizations
      where device_id = ? and status = 'approved' and expires_at > ?
        and (
          select count(*)
          from agent_access_tokens
          where user_id = agent_device_authorizations.user_id
            and revoked_at = '' and expires_at > ?
        ) < ?
    `).bind(
      tokenId,
      await sha256Hex(accessToken),
      accessToken.slice(-6),
      now.toISOString(),
      expiresAt,
      row.device_id,
      now.toISOString(),
      now.toISOString(),
      MAX_ACTIVE_TOKENS_PER_USER
    ),
    env.DB.prepare(`
      update agent_device_authorizations
      set status = 'consumed', consumed_at = ?
      where device_id = ? and status = 'approved' and expires_at > ?
        and exists (select 1 from agent_access_tokens where token_id = ?)
    `).bind(now.toISOString(), row.device_id, now.toISOString(), tokenId),
    conditionalAgentAuditStatement(env, {
      actorUserId: row.user_id,
      tokenId,
      action: "agent-token-issued",
      targetType: "agent-token",
      targetId: tokenId,
      scopes,
      result: "success",
      createdAt: now.toISOString()
    }, "select 1 from agent_access_tokens where token_id = ?", [tokenId])
  ]);
  if (Number(batch[0]?.meta?.changes || 0) !== 1 || Number(batch[1]?.meta?.changes || 0) !== 1) {
    const stillApproved = await env.DB.prepare(`
      select 1 as approved
      from agent_device_authorizations
      where device_id = ? and status = 'approved' and expires_at > ?
      limit 1
    `).bind(row.device_id, now.toISOString()).first();
    if (stillApproved) {
      throw new AgentAuthError(
        "Too many active agent tokens. Revoke an old token before continuing.",
        409,
        "AGENT_TOKEN_LIMIT_REACHED"
      );
    }
    throw new AgentAuthError("Device authorization was already used.", 409, "AGENT_DEVICE_CONSUMED");
  }

  const user = await env.DB.prepare("select id, email, role from users where id = ? limit 1")
    .bind(row.user_id).first();
  return agentJson({
    accessToken,
    tokenType: "Bearer",
    expiresAt,
    scopes,
    user: {
      id: user?.id || row.user_id,
      email: user?.email || "",
      role: "user"
    }
  }, 201);
}

async function findActiveDeviceByUserCode(env, userCode) {
  if (!userCode) return null;
  return env.DB.prepare(`
    select * from agent_device_authorizations
    where user_code_hash = ? and status = 'pending' and expires_at > ?
    limit 1
  `).bind(await sha256Hex(userCode), new Date().toISOString()).first();
}

async function getBrowserSession(request, env) {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const row = await env.DB.prepare(`
    select users.id, users.email, users.role
    from sessions
    join users on users.id = sessions.user_id
    where sessions.token_hash = ? and sessions.expires_at > ?
    limit 1
  `).bind(await sha256Hex(token), new Date().toISOString()).first();
  if (!row) return null;
  return {
    user: {
      id: row.id,
      email: row.email,
      role: row.role === "admin" ? "admin" : "user"
    }
  };
}

async function requireBrowserSession(request, env) {
  const session = await getBrowserSession(request, env);
  if (!session) {
    throw new AgentAuthError("Sign in to approve this device.", 401, "AGENT_BROWSER_LOGIN_REQUIRED");
  }
  return session;
}

async function showTokenManagement(request, env) {
  const session = await requireBrowserSession(request, env);
  const tokens = await env.DB.prepare(`
    select token_id, token_hint, client_name, scopes, created_at, expires_at, last_used_at
    from agent_access_tokens
    where user_id = ? and revoked_at = '' and expires_at > ?
    order by created_at desc
    limit ?
  `).bind(session.user.id, new Date().toISOString(), MAX_ACTIVE_TOKENS_PER_USER).all();
  const csrfToken = randomToken(24);
  const response = tokenManagementHtml(request, {
    email: session.user.email,
    tokens: tokens?.results || [],
    csrfToken
  });
  response.headers.append("Set-Cookie", managementCsrfCookieValue(request, csrfToken, 600));
  return response;
}

async function updateTokenManagement(request, env) {
  assertSameOrigin(request);
  const form = await readBoundedForm(request, MAX_FORM_BYTES);
  const csrfToken = String(form.get("csrf_token") || "");
  const cookieToken = readCookie(request, managementCsrfCookieName(request));
  if (!csrfToken || !cookieToken || csrfToken !== cookieToken) {
    throw new AgentAuthError("Token-management confirmation expired.", 403, "AGENT_MANAGEMENT_CSRF_INVALID");
  }
  const session = await requireBrowserSession(request, env);
  const action = String(form.get("action") || "");
  const tokenId = String(form.get("token_id") || "").trim();
  if (action !== "revoke" && action !== "revoke-all") {
    throw new AgentAuthError("Token-management action is invalid.", 422, "AGENT_MANAGEMENT_ACTION_INVALID");
  }
  if (action === "revoke" && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tokenId)) {
    throw new AgentAuthError("Agent token identifier is invalid.", 422, "AGENT_TOKEN_ID_INVALID");
  }

  const now = new Date().toISOString();
  const selected = await env.DB.prepare(`
    select token_id, scopes
    from agent_access_tokens
    where user_id = ? and revoked_at = '' and expires_at > ?
      ${action === "revoke" ? "and token_id = ?" : ""}
    order by created_at desc
    limit ?
  `).bind(
    session.user.id,
    now,
    ...(action === "revoke" ? [tokenId] : []),
    MAX_ACTIVE_TOKENS_PER_USER
  ).all();
  const targets = selected?.results || [];
  if (action === "revoke" && targets.length !== 1) {
    throw new AgentAuthError("Agent token was not found.", 404, "AGENT_TOKEN_NOT_FOUND");
  }

  if (action === "revoke-all") {
    const revokeEventId = crypto.randomUUID();
    await env.DB.batch([
      env.DB.prepare(`
        update agent_device_authorizations
        set status = 'denied', granted_scopes = '[]', csrf_hash = ''
        where user_id = ? and status = 'approved' and consumed_at = '' and expires_at > ?
      `).bind(session.user.id, now),
      env.DB.prepare(`
        update agent_access_tokens
        set revoked_at = ?, revoked_event_id = ?
        where user_id = ? and revoked_at = '' and expires_at > ?
      `).bind(now, revokeEventId, session.user.id, now),
      ...targets.map((row) => conditionalAgentAuditStatement(env, {
        actorUserId: session.user.id,
        tokenId: row.token_id,
        action: "agent-token-revoked-by-owner",
        targetType: "agent-token",
        targetId: row.token_id,
        scopes: parseStoredScopes(row.scopes),
        result: "success",
        createdAt: now
      }, "select 1 from agent_access_tokens where token_id = ? and revoked_event_id = ?", [
        row.token_id,
        revokeEventId
      ])),
      conditionalAgentAuditStatement(env, {
        actorUserId: session.user.id,
        tokenId: "",
        action: "agent-token-revoked-all",
        targetType: "agent-user-access",
        targetId: session.user.id,
        scopes: [],
        result: "success",
        createdAt: now
      }, "select 1")
    ]);
  } else if (targets.length) {
    const targetIds = targets.map((row) => row.token_id);
    const placeholders = targetIds.map(() => "?").join(", ");
    const revokeEventId = crypto.randomUUID();
    await env.DB.batch([
      env.DB.prepare(`
        update agent_access_tokens
        set revoked_at = ?, revoked_event_id = ?
        where user_id = ? and revoked_at = '' and token_id in (${placeholders})
      `).bind(now, revokeEventId, session.user.id, ...targetIds),
      ...targets.map((row) => conditionalAgentAuditStatement(env, {
        actorUserId: session.user.id,
        tokenId: row.token_id,
        action: "agent-token-revoked-by-owner",
        targetType: "agent-token",
        targetId: row.token_id,
        scopes: parseStoredScopes(row.scopes),
        result: "success",
        createdAt: now
      }, "select 1 from agent_access_tokens where token_id = ? and revoked_event_id = ?", [
        row.token_id,
        revokeEventId
      ]))
    ]);
  }

  const response = new Response(null, {
    status: 303,
    headers: authorizationSecurityHeaders({
      Location: new URL("/api/agent-auth/tokens/manage", request.url).toString()
    })
  });
  response.headers.append("Set-Cookie", clearManagementCsrfCookieValue(request));
  return response;
}

function normalizeClientName(value) {
  const name = String(value || "lusu CLI").trim();
  const length = Array.from(name).length;
  if (!name || length > 80 || /[\u0000-\u001f\u007f]/.test(name)) {
    throw new AgentAuthError("Client name is invalid.", 422, "AGENT_CLIENT_NAME_INVALID");
  }
  return name;
}

function normalizeRequestedScopes(value) {
  const scopes = value === undefined ? [...DEFAULT_SCOPES] : normalizeScopeList(value);
  if (!scopes.length || scopes.length > 12) {
    throw new AgentAuthError("At least one valid scope is required.", 422, "AGENT_SCOPES_INVALID");
  }
  const invalid = scopes.filter((scope) => !Object.hasOwn(AGENT_SCOPE_DEFINITIONS, scope));
  if (invalid.length) {
    throw new AgentAuthError(`Unsupported agent scope: ${invalid.join(", ")}.`, 422, "AGENT_SCOPES_INVALID");
  }
  return scopes;
}

function normalizeScopeList(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((scope) => String(scope || "").trim()).filter(Boolean))].sort();
}

function parseStoredScopes(value) {
  try {
    return normalizeScopeList(JSON.parse(String(value || "[]")));
  } catch {
    return [];
  }
}

function scopeIsGranted(grantedScopes, requiredScope) {
  return grantedScopes.includes(requiredScope)
    || grantedScopes.some((scope) => scope.endsWith(":*") && requiredScope.startsWith(scope.slice(0, -1)));
}

function readAgentBearer(request) {
  const authorization = String(request.headers.get("Authorization") || "").trim();
  const match = authorization.match(/^Bearer\s+(lusu_agent_[A-Za-z0-9_-]{40,180})$/i);
  return match ? match[1] : "";
}

function normalizeDeviceCode(value) {
  const code = String(value || "").trim();
  if (!/^[A-Za-z0-9_-]{40,180}$/.test(code)) {
    throw new AgentAuthError("Device authorization is invalid.", 400, "AGENT_DEVICE_INVALID");
  }
  return code;
}

function normalizeUserCode(value) {
  const compact = String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return compact.length === 8 ? compact : "";
}

function randomUserCode() {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const compact = Array.from(bytes, (byte) => USER_CODE_ALPHABET[byte % USER_CODE_ALPHABET.length]).join("");
  return `${compact.slice(0, 4)}-${compact.slice(4)}`;
}

function randomToken(byteLength) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(value)));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function agentIpHash(request, env) {
  const ip = String(
    request.headers.get("CF-Connecting-IP")
      || request.headers.get("x-forwarded-for")?.split(",")[0]
      || "unknown"
  ).trim();
  const secret = String(env.ANALYTICS_IP_HASH_SALT || "");
  if (new TextEncoder().encode(secret).byteLength < 32) {
    throw new AgentAuthError("Agent authorization privacy configuration is unavailable.", 503, "AGENT_AUTH_CONFIG_INVALID");
  }
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`agent-auth:${ip}`));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function assertDeviceStartRate(env, ipHash) {
  const bucketKey = `rl_${await sha256Hex(`agent-auth:device-start:${ipHash}`)}`;
  const result = await consumeAgentRateLimit(env, bucketKey, {
    windowMs: DEVICE_RATE_WINDOW_MS,
    limit: DEVICE_RATE_LIMIT,
    backoffMs: DEVICE_RATE_WINDOW_MS,
    maxBackoffMs: 60 * 60 * 1000
  });
  if (!result.allowed) {
    throw new AgentAuthError(
      "Too many device authorization requests. Try again later.",
      429,
      "AGENT_DEVICE_RATE_LIMITED",
      result.retryAfterSeconds
    );
  }
}

async function assertDeviceTokenRate(request, env) {
  const ipHash = await agentIpHash(request, env);
  const bucketKey = `rl_${await sha256Hex(`agent-auth:device-token:${ipHash}`)}`;
  const result = await consumeAgentRateLimit(env, bucketKey, {
    windowMs: DEVICE_TOKEN_RATE_WINDOW_MS,
    limit: DEVICE_TOKEN_RATE_LIMIT,
    backoffMs: DEVICE_TOKEN_RATE_WINDOW_MS,
    maxBackoffMs: 60 * 60 * 1000
  });
  if (!result.allowed) {
    throw new AgentAuthError(
      "Too many device-token requests. Try again later.",
      429,
      "AGENT_DEVICE_TOKEN_RATE_LIMITED",
      result.retryAfterSeconds
    );
  }
}

async function assertDeviceLookupRate(request, env) {
  const ipHash = await agentIpHash(request, env);
  const bucketKey = `rl_${await sha256Hex(`agent-auth:device-lookup:${ipHash}`)}`;
  const result = await consumeAgentRateLimit(env, bucketKey, {
    windowMs: DEVICE_LOOKUP_WINDOW_MS,
    limit: DEVICE_LOOKUP_LIMIT,
    backoffMs: DEVICE_LOOKUP_BACKOFF_MS,
    maxBackoffMs: 60 * 60 * 1000
  });
  if (!result.allowed) {
    throw new AgentAuthError(
      "Too many authorization-code checks. Try again later.",
      429,
      "AGENT_DEVICE_LOOKUP_RATE_LIMITED",
      result.retryAfterSeconds
    );
  }
}

async function consumeAgentRateLimit(env, bucketKey, policy) {
  const now = Date.now();
  const windowMs = Math.max(1000, Number(policy.windowMs) || 60_000);
  const limit = Math.max(1, Number(policy.limit) || 1);
  const backoffMs = Math.max(1000, Number(policy.backoffMs) || windowMs);
  const maxBackoffMs = Math.max(backoffMs, Number(policy.maxBackoffMs) || backoffMs);
  const resetBefore = now - windowMs;
  const row = await env.DB.prepare(`
    insert into api_rate_limits (
      bucket_key, window_started_at, request_count, blocked_until, updated_at
    ) values (?, ?, 1, 0, ?)
    on conflict(bucket_key) do update set
      window_started_at = case
        when api_rate_limits.window_started_at <= ? then excluded.window_started_at
        else api_rate_limits.window_started_at
      end,
      request_count = case
        when api_rate_limits.window_started_at <= ? then 1
        else api_rate_limits.request_count + 1
      end,
      blocked_until = case
        when api_rate_limits.window_started_at <= ? then 0
        when api_rate_limits.blocked_until > ? then api_rate_limits.blocked_until
        when api_rate_limits.request_count + 1 > ? then
          ? + min(?, ? * (1 << min(api_rate_limits.request_count - ?, 4)))
        else 0
      end,
      updated_at = excluded.updated_at
    returning request_count, blocked_until
  `).bind(
    bucketKey,
    now,
    new Date(now).toISOString(),
    resetBefore,
    resetBefore,
    resetBefore,
    now,
    limit,
    now,
    maxBackoffMs,
    backoffMs,
    limit
  ).first();
  const blockedUntil = Number(row?.blocked_until || 0);
  return {
    allowed: blockedUntil <= now,
    retryAfterSeconds: blockedUntil > now
      ? Math.max(1, Math.ceil((blockedUntil - now) / 1000))
      : 0
  };
}

function conditionalAgentAuditStatement(env, event, conditionSql, conditionBinds = []) {
  return env.DB.prepare(`
    insert into agent_audit_log (
      event_id, actor_user_id, token_id, action, target_type, target_id,
      scopes, result, created_at
    )
    select ?, ?, ?, ?, ?, ?, ?, ?, ?
    where exists (${conditionSql})
  `).bind(
    crypto.randomUUID(),
    event.actorUserId || "",
    event.tokenId || "",
    event.action,
    event.targetType || "",
    event.targetId || "",
    JSON.stringify(normalizeScopeList(event.scopes || [])),
    event.result || "",
    event.createdAt || new Date().toISOString(),
    ...conditionBinds
  );
}

function assertJsonRequest(request) {
  const contentType = String(request.headers.get("Content-Type") || "").split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    throw new AgentAuthError("Request must use application/json.", 415, "AGENT_CONTENT_TYPE_INVALID");
  }
}

function assertSameOrigin(request) {
  const origin = request.headers.get("Origin");
  const expected = new URL(request.url).origin;
  if (!origin || origin !== expected) {
    throw new AgentAuthError("Request origin is not trusted.", 403, "AGENT_ORIGIN_REJECTED");
  }
}

function assertTrustedAuthorizationNavigation(request) {
  const site = String(request.headers.get("Sec-Fetch-Site") || "").toLowerCase();
  const mode = String(request.headers.get("Sec-Fetch-Mode") || "").toLowerCase();
  const destination = String(request.headers.get("Sec-Fetch-Dest") || "").toLowerCase();
  if (site === "cross-site"
    || (mode && mode !== "navigate")
    || (destination && destination !== "document")) {
    throw new AgentAuthError(
      "Authorization links must be opened as a top-level site page.",
      403,
      "AGENT_AUTH_NAVIGATION_REJECTED"
    );
  }
}

async function readBoundedJson(request, limit) {
  const text = await readBoundedText(request, limit);
  try {
    return JSON.parse(text || "{}");
  } catch {
    throw new AgentAuthError("Request body is not valid JSON.", 400, "AGENT_JSON_INVALID");
  }
}

async function readBoundedForm(request, limit) {
  const contentType = String(request.headers.get("Content-Type") || "").split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/x-www-form-urlencoded") {
    throw new AgentAuthError("Authorization form is invalid.", 415, "AGENT_FORM_INVALID");
  }
  return new URLSearchParams(await readBoundedText(request, limit));
}

async function readBoundedText(request, limit) {
  const declared = Number(request.headers.get("Content-Length") || 0);
  if (declared > limit) {
    throw new AgentAuthError("Request body is too large.", 413, "AGENT_BODY_TOO_LARGE");
  }
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel();
        throw new AgentAuthError("Request body is too large.", 413, "AGENT_BODY_TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new AgentAuthError("Request body must be valid UTF-8.", 400, "AGENT_UTF8_INVALID");
  }
}

function readCookie(request, name) {
  const cookie = request.headers.get("Cookie") || "";
  for (const item of cookie.split(";")) {
    const [key, ...rest] = item.trim().split("=");
    if (key === name) {
      return decodeURIComponent(rest.join("="));
    }
  }
  return "";
}

function csrfCookieName(request) {
  return new URL(request.url).protocol === "https:" ? "__Host-lusu_agent_csrf" : "lusu_agent_csrf";
}

function managementCsrfCookieName(request) {
  return new URL(request.url).protocol === "https:"
    ? "__Host-lusu_agent_manage_csrf"
    : "lusu_agent_manage_csrf";
}

function csrfCookieValue(request, value, maxAge) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${csrfCookieName(request)}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

function clearCsrfCookieValue(request) {
  return csrfCookieValue(request, "", 0);
}

function managementCsrfCookieValue(request, value, maxAge) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${managementCsrfCookieName(request)}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

function clearManagementCsrfCookieValue(request) {
  return managementCsrfCookieValue(request, "", 0);
}

function authorizationConsentHtml(request, details) {
  const scopeItems = details.scopes.map((scope) => `<li><code>${escapeHtml(scope)}</code></li>`).join("");
  const body = `
    <p>客户端 / Client / クライアント：<strong>${escapeHtml(details.clientName)}</strong></p>
    <p>账号 / Account / アカウント：<strong>${escapeHtml(details.email)}</strong></p>
    <p>请核对授权码 / Confirm code / コードを確認：<code class="user-code">${escapeHtml(formatUserCode(details.userCode))}</code></p>
    <p>请求权限 / Requested scopes / 要求権限：</p>
    <ul>${scopeItems}</ul>
    <form method="post" action="/api/agent-auth/device/authorize">
      <input type="hidden" name="user_code" value="${escapeHtml(details.userCode)}">
      <input type="hidden" name="csrf_token" value="${escapeHtml(details.csrfToken)}">
      <div class="actions">
        <button type="submit" name="decision" value="approve">允许 / Allow / 許可</button>
        <button type="submit" name="decision" value="deny" class="secondary">拒绝 / Deny / 拒否</button>
      </div>
    </form>
    <p class="warning">只在你刚刚运行了 lusu CLI 时允许。不要把授权码或令牌发给任何人。<br>Approve only if you just started lusu CLI. Never share authorization codes or tokens.<br>lusu CLI を開始した場合のみ許可し、コードやトークンを共有しないでください。</p>
    <p><a href="/api/agent-auth/tokens/manage">管理已有 AI / CLI 令牌 / Manage agent tokens / AI・CLI トークンを管理</a></p>
  `;
  return authorizationHtml(request, {
    title: "授权 AI / CLI 访问 / Authorize AI or CLI / AI・CLI を認証",
    bodyHtml: body
  });
}

function tokenManagementHtml(request, details) {
  const rows = details.tokens.length
    ? details.tokens.map((token) => {
      const scopes = parseStoredScopes(token.scopes).map(escapeHtml).join(", ");
      return `<li>
        <p><strong>${escapeHtml(token.client_name || "Agent client")}</strong> · …${escapeHtml(token.token_hint || "")}</p>
        <p><code>${scopes}</code><br>${escapeHtml(token.created_at)} → ${escapeHtml(token.expires_at)}</p>
        <form method="post" action="/api/agent-auth/tokens/manage">
          <input type="hidden" name="csrf_token" value="${escapeHtml(details.csrfToken)}">
          <input type="hidden" name="action" value="revoke">
          <input type="hidden" name="token_id" value="${escapeHtml(token.token_id)}">
          <button type="submit">撤销 / Revoke / 取り消す</button>
        </form>
      </li>`;
    }).join("")
    : "<li>没有有效令牌 / No active tokens / 有効なトークンはありません</li>";
  const revokeAll = `<form method="post" action="/api/agent-auth/tokens/manage">
        <input type="hidden" name="csrf_token" value="${escapeHtml(details.csrfToken)}">
        <input type="hidden" name="action" value="revoke-all">
        <p class="warning">此操作也会取消已批准但尚未兑换的设备授权。<br>This also cancels approved device authorizations that have not issued a token.<br>この操作では、承認済みで未発行のデバイス認可も取り消します。</p>
        <button type="submit" class="secondary">令牌与待兑换授权全部撤销 / Revoke all access / すべてのアクセスを取り消す</button>
      </form>`;
  return authorizationHtml(request, {
    title: "管理 AI / CLI 令牌 / Manage agent tokens / AI・CLI トークン管理",
    bodyHtml: `
      <p>${escapeHtml(details.email)}</p>
      <ul class="token-list">${rows}</ul>
      ${revokeAll}
      <p><a href="/">返回网站 / Open site / サイトを開く</a></p>
    `
  });
}

function formatUserCode(value) {
  const compact = normalizeUserCode(value);
  return compact ? `${compact.slice(0, 4)}-${compact.slice(4)}` : "";
}

function authorizationHtml(request, details, status = 200) {
  const body = details.bodyHtml || `<p>${escapeHtml(details.body || "")}</p>`;
  const home = details.homeUrl
    ? `<p><a href="${escapeHtml(details.homeUrl)}">返回网站 / Open site / サイトを開く</a></p>`
    : "";
  const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(details.title)}</title>
  <style>
    :root{color-scheme:light;font-family:"Microsoft YaHei",Tahoma,sans-serif;background:#0a246a}
    body{margin:0;min-height:100vh;display:grid;place-items:center;padding:20px;box-sizing:border-box}
    main{width:min(620px,100%);background:#ece9d8;border:3px solid #fff;box-shadow:0 0 0 2px #003c74,8px 8px 0 rgba(0,0,0,.28)}
    h1{margin:0;padding:10px 14px;color:#fff;font-size:18px;background:linear-gradient(90deg,#0058b8,#3a93e6)}
    section{padding:18px;color:#111;line-height:1.55}code{overflow-wrap:anywhere}.user-code{font-size:22px;font-weight:700;letter-spacing:.12em}.token-list{display:grid;gap:12px;padding-left:22px}.token-list li{border-bottom:1px solid #aaa;padding-bottom:12px}button,a{min-height:44px;font:inherit}
    button{padding:8px 18px;border:2px outset #fff;background:#ece9d8;cursor:pointer}.secondary{margin-left:8px}.warning{font-size:13px;color:#7a1b00}
  </style>
</head>
<body><main><h1>${escapeHtml(details.title)}</h1><section>${body}${home}</section></main></body>
</html>`;
  return new Response(html, {
    status,
    headers: authorizationSecurityHeaders({ "Content-Type": "text/html; charset=utf-8" })
  });
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function authorizationSecurityHeaders(initial = {}) {
  const headers = new Headers(initial);
  headers.set("Cache-Control", "no-store");
  headers.set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  return headers;
}

function agentJson(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: authorizationSecurityHeaders({ "Content-Type": "application/json; charset=utf-8" })
  });
}

class AgentAuthError extends Error {
  constructor(message, status, code, retryAfter = 0) {
    super(message);
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}
