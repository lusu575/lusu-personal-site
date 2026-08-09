import {
  AuthorizationError,
  type AuthRequest,
  type ClientInfo
} from "@cloudflare/workers-oauth-provider";
import { z } from "zod";

import {
  activateMcpOAuthGrant,
  createPendingMcpOAuthGrant,
  mcpOAuthAuditIpHash,
  recordMcpOAuthAudit,
  revokeMcpOAuthGrant
} from "../../../functions/api/mcp-oauth-ledger.mjs";
import {
  AUTHORIZE_PATH,
  CANONICAL_ISSUER,
  CONSENT_FLOW_TTL_SECONDS,
  MCP_RESOURCE,
  OWNER_SCOPES,
  REFRESH_TOKEN_TTL_SECONDS,
  SCOPE_DESCRIPTIONS,
  type OwnerScope
} from "./constants";
import {
  WorkerHttpError,
  escapeHtml,
  htmlResponse,
  randomUrlSafeToken,
  readBoundedForm,
  readCookie,
  safeErrorCode,
  sha256Hex,
  timingSafeEqualText
} from "./security";

const SESSION_COOKIE = "lusu_session";
const CONSENT_FLOW_PREFIX = "lusu:owner-mcp:consent:";
const MAX_FORM_BYTES = 16 * 1024;
const CONSENT_COMPLETION_TTL_SECONDS = 2 * 60;
const CONSENT_COMPLETION_POLL_ATTEMPTS = 24;
const CONSENT_COMPLETION_POLL_INTERVAL_MS = 125;
const OWNER_SCOPE_SET = new Set<string>(OWNER_SCOPES);
const LOOPBACK_REDIRECT_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

const StoredAuthRequestSchema = z.object({
  responseType: z.literal("code"),
  clientId: z.string().min(1).max(2_048),
  redirectUri: z.string().url().max(2_048),
  scope: z.array(z.string().min(1).max(128)).max(32),
  state: z.string().max(2_048),
  codeChallenge: z.string().min(43).max(256),
  codeChallengeMethod: z.literal("S256"),
  resource: z.literal(MCP_RESOURCE),
  issuer: z.literal(CANONICAL_ISSUER)
}).strict();

const StoredConsentFlowSchema = z.object({
  version: z.literal(1),
  oauthRequest: StoredAuthRequestSchema,
  userId: z.string().min(1).max(128),
  sessionTokenHash: z.string().regex(/^[a-f0-9]{64}$/),
  csrfHash: z.string().regex(/^[a-f0-9]{64}$/),
  requestFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  clientName: z.string().max(240),
  grantedScopes: z.array(z.enum(OWNER_SCOPES)).min(1).max(OWNER_SCOPES.length),
  grantRef: z.string().regex(/^[A-Za-z0-9_-]{16,128}$/),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime()
}).strict();

type StoredConsentFlow = z.infer<typeof StoredConsentFlowSchema>;

const StoredConsentCompletionSchema = z.object({
  version: z.literal(1),
  kind: z.literal("completed"),
  decision: z.enum(["approve", "deny"]),
  userId: z.string().min(1).max(128),
  sessionTokenHash: z.string().regex(/^[a-f0-9]{64}$/),
  csrfHash: z.string().regex(/^[a-f0-9]{64}$/),
  requestFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  redirectTo: z.string().url().max(8_192),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime()
}).strict();

type StoredConsentCompletion = z.infer<typeof StoredConsentCompletionSchema>;

type BrowserSession = {
  tokenHash: string;
  user: {
    id: string;
    email: string;
    role: "admin" | "user";
  };
};

type LocalizedText = Readonly<{ zh: string; en: string; ja: string }>;

export const oauthDefaultHandler = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== AUTHORIZE_PATH) {
      return htmlResponse(errorPage(
        localized("页面不存在", "Not found", "ページが見つかりません"),
        localized(
          "请求的 OAuth 页面不存在。",
          "The requested OAuth page does not exist.",
          "指定された OAuth ページは存在しません。"
        )
      ), 404);
    }
    try {
      if (request.method === "GET") {
        return await showConsent(request, env);
      }
      if (request.method === "POST") {
        return await decideConsent(request, env);
      }
      return htmlResponse(
        errorPage(
          localized("不支持此请求方法", "Method not allowed", "許可されていないメソッド"),
          localized(
            "请使用浏览器 GET 请求或页面上的授权表单。",
            "Use a browser GET request or the approval form shown on this page.",
            "ブラウザの GET リクエストまたはこのページの承認フォームを使用してください。"
          )
        ),
        405
      );
    } catch (error) {
      if (error instanceof AuthorizationError) {
        return authorizationErrorResponse(error);
      }
      const status = error instanceof WorkerHttpError ? error.status : 500;
      const code = safeErrorCode(error);
      logSecurityEvent("oauth_authorization_failed", code, status);
      return htmlResponse(
        errorPage(
          status === 401
            ? localized("请先登录", "Sign in first", "先にログインしてください")
            : localized("授权失败", "Authorization failed", "認可に失敗しました"),
          status === 401
            ? localized(
              "请先在 lusu575.com 登录站长账号，然后返回此页面刷新。",
              "Sign in to the owner account on lusu575.com, then return and refresh this page.",
              "lusu575.com でサイト管理者アカウントにログインし、このページに戻って更新してください。"
            )
            : localized(
              "本次授权没有完成。请回到 AI 客户端重新发起连接。",
              "Authorization was not completed. Return to the AI client and start the connection again.",
              "認可は完了しませんでした。AI クライアントに戻り、接続をやり直してください。"
            ),
          `Error code: ${code}`
        ),
        status
      );
    }
  }
} satisfies ExportedHandler<Env>;

async function showConsent(request: Request, env: Env): Promise<Response> {
  const session = await requireOwnerSession(request, env);
  assertExplicitAuthorizationResource(request);
  const parsedRequest = await env.OAUTH_PROVIDER.parseAuthRequest(request);
  const redirectOrigin = validateAuthorizationRedirectUri(parsedRequest.redirectUri);
  const oauthRequest = normalizeAuthRequest(parsedRequest);
  const client = await env.OAUTH_PROVIDER.lookupClient(oauthRequest.clientId);
  if (!client) {
    throw new WorkerHttpError("OAuth client was not found.", 400, "OAUTH_CLIENT_NOT_FOUND");
  }
  if (!client.redirectUris.includes(oauthRequest.redirectUri)) {
    throw new WorkerHttpError(
      "OAuth redirect URI is not registered for this client.",
      400,
      "OAUTH_REDIRECT_URI_NOT_REGISTERED"
    );
  }

  const grantedScopes = normalizeRequestedScopes(oauthRequest);
  const clientName = normalizeClientName(client, oauthRequest.clientId);
  const flowId = randomUrlSafeToken(32);
  const csrfToken = randomUrlSafeToken(32);
  const grantRef = randomUrlSafeToken(24);
  const requestFingerprint = await authorizationRequestFingerprint(oauthRequest, flowId);
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + CONSENT_FLOW_TTL_SECONDS * 1_000);
  const flow: StoredConsentFlow = {
    version: 1,
    oauthRequest,
    userId: session.user.id,
    sessionTokenHash: session.tokenHash,
    csrfHash: await sha256Hex(csrfToken),
    requestFingerprint,
    clientName,
    grantedScopes,
    grantRef,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString()
  };

  await env.OAUTH_KV.put(
    `${CONSENT_FLOW_PREFIX}${flowId}`,
    JSON.stringify(flow),
    { expirationTtl: CONSENT_FLOW_TTL_SECONDS }
  );

  return htmlResponse(
    consentPage({
      clientName,
      clientId: oauthRequest.clientId,
      redirectUri: oauthRequest.redirectUri,
      resource: MCP_RESOURCE,
      scopes: grantedScopes,
      email: session.user.email,
      flowId,
      csrfToken,
      requestFingerprint
    }),
    200,
    consentCookie(request, flowId, csrfToken, CONSENT_FLOW_TTL_SECONDS),
    { formActionOrigin: redirectOrigin }
  );
}

async function decideConsent(request: Request, env: Env): Promise<Response> {
  const session = await requireOwnerSession(request, env);
  const form = await readBoundedForm(request, MAX_FORM_BYTES);
  const flowId = String(form.get("flow_id") || "");
  const csrfToken = String(form.get("csrf_token") || "");
  const requestFingerprint = String(form.get("request_fingerprint") || "");
  const decision = String(form.get("decision") || "");
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(flowId)) {
    throw new WorkerHttpError("OAuth consent confirmation expired.", 403, "OAUTH_CONSENT_CSRF_INVALID");
  }
  const cookieToken = readCookie(request, consentCookieName(request, flowId));
  if (!csrfToken || !cookieToken
    || !await timingSafeEqualText(csrfToken, cookieToken)) {
    throw new WorkerHttpError("OAuth consent confirmation expired.", 403, "OAUTH_CONSENT_CSRF_INVALID");
  }
  if (!/^[a-f0-9]{64}$/.test(requestFingerprint)) {
    throw new WorkerHttpError(
      "OAuth consent request binding is invalid.",
      403,
      "OAUTH_CONSENT_REQUEST_MISMATCH"
    );
  }

  const flowKey = `${CONSENT_FLOW_PREFIX}${flowId}`;
  const rawFlow = await env.OAUTH_KV.get<unknown>(flowKey, "json");
  const parsedCompletion = StoredConsentCompletionSchema.safeParse(rawFlow);
  if (parsedCompletion.success) {
    return completedConsentResponse(
      request,
      flowId,
      session,
      csrfToken,
      requestFingerprint,
      decision,
      parsedCompletion.data
    );
  }
  const parsedFlow = StoredConsentFlowSchema.safeParse(rawFlow);
  if (!parsedFlow.success || parsedFlow.data.expiresAt <= new Date().toISOString()) {
    throw new WorkerHttpError("OAuth consent confirmation expired.", 409, "OAUTH_CONSENT_EXPIRED");
  }
  const flow = parsedFlow.data;
  if (flow.userId !== session.user.id
    || !await timingSafeEqualText(flow.sessionTokenHash, session.tokenHash)
    || !await timingSafeEqualText(flow.csrfHash, await sha256Hex(csrfToken))) {
    throw new WorkerHttpError("OAuth consent is not bound to this session.", 403, "OAUTH_CONSENT_SESSION_MISMATCH");
  }
  if (!await timingSafeEqualText(flow.requestFingerprint, requestFingerprint)) {
    throw new WorkerHttpError(
      "OAuth consent request binding does not match.",
      403,
      "OAUTH_CONSENT_REQUEST_MISMATCH"
    );
  }

  const completionCookie = consentCookie(
    request,
    flowId,
    csrfToken,
    CONSENT_COMPLETION_TTL_SECONDS
  );
  if (decision === "deny") {
    await recordConsentAudit(env, request, flow, "mcp-oauth-consent-denied", "denied", "access_denied");
    const redirect = authorizationDeniedRedirect(flow.oauthRequest);
    await storeConsentCompletion(env, flowKey, flow, decision, redirect);
    return redirectResponse(redirect, completionCookie);
  }
  if (decision !== "approve") {
    throw new WorkerHttpError("OAuth consent decision is invalid.", 400, "OAUTH_CONSENT_DECISION_INVALID");
  }

  let redirect: string;
  try {
    redirect = await approveConsent(env, request, flow);
  } catch (error) {
    if (safeErrorCode(error) !== "MCP_OAUTH_GRANT_CONFLICT") throw error;
    const completion = await waitForConsentCompletion(env, flowKey);
    return completedConsentResponse(
      request,
      flowId,
      session,
      csrfToken,
      requestFingerprint,
      decision,
      completion
    );
  }
  await storeConsentCompletion(env, flowKey, flow, decision, redirect);
  return redirectResponse(redirect, completionCookie);
}

async function storeConsentCompletion(
  env: Env,
  flowKey: string,
  flow: StoredConsentFlow,
  decision: StoredConsentCompletion["decision"],
  redirectTo: string
): Promise<void> {
  const createdAt = new Date();
  const completion: StoredConsentCompletion = {
    version: 1,
    kind: "completed",
    decision,
    userId: flow.userId,
    sessionTokenHash: flow.sessionTokenHash,
    csrfHash: flow.csrfHash,
    requestFingerprint: flow.requestFingerprint,
    redirectTo,
    createdAt: createdAt.toISOString(),
    expiresAt: new Date(
      createdAt.getTime() + CONSENT_COMPLETION_TTL_SECONDS * 1_000
    ).toISOString()
  };
  await env.OAUTH_KV.put(flowKey, JSON.stringify(completion), {
    expirationTtl: CONSENT_COMPLETION_TTL_SECONDS
  });
}

async function waitForConsentCompletion(
  env: Env,
  flowKey: string
): Promise<StoredConsentCompletion> {
  for (let attempt = 0; attempt < CONSENT_COMPLETION_POLL_ATTEMPTS; attempt += 1) {
    const raw = await env.OAUTH_KV.get<unknown>(flowKey, "json");
    const parsed = StoredConsentCompletionSchema.safeParse(raw);
    if (parsed.success && parsed.data.expiresAt > new Date().toISOString()) {
      return parsed.data;
    }
    if (attempt + 1 < CONSENT_COMPLETION_POLL_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, CONSENT_COMPLETION_POLL_INTERVAL_MS));
    }
  }
  throw new WorkerHttpError(
    "OAuth consent is already being completed.",
    409,
    "OAUTH_CONSENT_IN_PROGRESS"
  );
}

async function completedConsentResponse(
  request: Request,
  flowId: string,
  session: BrowserSession,
  csrfToken: string,
  requestFingerprint: string,
  decision: string,
  completion: StoredConsentCompletion
): Promise<Response> {
  if (completion.expiresAt <= new Date().toISOString()) {
    throw new WorkerHttpError("OAuth consent confirmation expired.", 409, "OAUTH_CONSENT_EXPIRED");
  }
  if (completion.userId !== session.user.id
    || !await timingSafeEqualText(completion.sessionTokenHash, session.tokenHash)
    || !await timingSafeEqualText(completion.csrfHash, await sha256Hex(csrfToken))) {
    throw new WorkerHttpError("OAuth consent is not bound to this session.", 403, "OAUTH_CONSENT_SESSION_MISMATCH");
  }
  if (!await timingSafeEqualText(completion.requestFingerprint, requestFingerprint)) {
    throw new WorkerHttpError(
      "OAuth consent request binding does not match.",
      403,
      "OAUTH_CONSENT_REQUEST_MISMATCH"
    );
  }
  if (completion.decision !== decision) {
    throw new WorkerHttpError(
      "OAuth consent decision does not match the completed request.",
      409,
      "OAUTH_CONSENT_DECISION_MISMATCH"
    );
  }
  return redirectResponse(
    completion.redirectTo,
    consentCookie(
      request,
      flowId,
      csrfToken,
      CONSENT_COMPLETION_TTL_SECONDS
    )
  );
}

async function approveConsent(env: Env, request: Request, flow: StoredConsentFlow): Promise<string> {
  const ledgerExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1_000).toISOString();
  let providerGrantCreated = false;
  let ledgerCreated = false;
  try {
    await createPendingMcpOAuthGrant({
      env,
      grantRef: flow.grantRef,
      userId: flow.userId,
      clientId: flow.oauthRequest.clientId,
      clientName: flow.clientName,
      resource: MCP_RESOURCE,
      authorizedScopes: flow.grantedScopes,
      expiresAt: ledgerExpiresAt
    });
    ledgerCreated = true;
    await recordConsentAudit(env, request, flow, "mcp-oauth-grant-created", "pending", "");

    const { redirectTo } = await env.OAUTH_PROVIDER.completeAuthorization({
      request: flow.oauthRequest,
      userId: flow.userId,
      metadata: {
        grantRef: flow.grantRef,
        clientName: flow.clientName,
        resource: MCP_RESOURCE
      },
      scope: flow.grantedScopes,
      props: {
        version: 1,
        userId: flow.userId,
        grantRef: flow.grantRef,
        resource: MCP_RESOURCE
      },
      revokeExistingGrants: true
    });
    providerGrantCreated = true;

    await activateMcpOAuthGrant({ env, grantRef: flow.grantRef });
    await recordConsentAudit(env, request, flow, "mcp-oauth-grant-activated", "success", "");
    return redirectTo;
  } catch (error) {
    if (!providerGrantCreated && !ledgerCreated
      && safeErrorCode(error) === "MCP_OAUTH_GRANT_CONFLICT") {
      throw error;
    }
    if (providerGrantCreated) {
      await revokeProviderGrantByReference(env, flow.userId, flow.grantRef);
    }
    if (ledgerCreated) {
      await revokeMcpOAuthGrant({
        env,
        grantRef: flow.grantRef,
        reason: "authorization-failed"
      });
    }
    await recordConsentAudit(
      env,
      request,
      flow,
      "mcp-oauth-grant-activation-failed",
      "error",
      safeErrorCode(error)
    );
    throw new WorkerHttpError("OAuth authorization could not be completed.", 500, "OAUTH_GRANT_ACTIVATION_FAILED");
  }
}

async function revokeProviderGrantByReference(
  env: Env,
  userId: string,
  grantRef: string
): Promise<void> {
  let cursor: string | undefined;
  do {
    const page = await env.OAUTH_PROVIDER.listUserGrants(userId, { limit: 100, cursor });
    for (const grant of page.items) {
      const metadata = isPlainRecord(grant.metadata) ? grant.metadata : null;
      if (metadata?.grantRef === grantRef) {
        await env.OAUTH_PROVIDER.revokeGrant(grant.id, userId);
      }
    }
    cursor = page.cursor;
  } while (cursor);
}

async function recordConsentAudit(
  env: Env,
  request: Request,
  flow: StoredConsentFlow,
  action: string,
  result: string,
  errorCode: string
): Promise<void> {
  await recordMcpOAuthAudit({
    env,
    principal: {
      authType: "oauth",
      userId: flow.userId,
      clientId: flow.oauthRequest.clientId,
      grantRef: flow.grantRef,
      resource: MCP_RESOURCE,
      effectiveScopes: flow.grantedScopes
    },
    requestedScopes: flow.grantedScopes,
    action,
    result,
    errorCode,
    ipHash: await mcpOAuthAuditIpHash(request, env)
  });
}

async function requireOwnerSession(request: Request, env: Env): Promise<BrowserSession> {
  const sessionToken = readCookie(request, SESSION_COOKIE);
  if (!sessionToken) {
    throw new WorkerHttpError("Sign in before authorizing this client.", 401, "OAUTH_LOGIN_REQUIRED");
  }
  const tokenHash = await sha256Hex(sessionToken);
  const row = await env.DB.prepare(`
    select users.id, users.email, users.role
    from sessions
    join users on users.id = sessions.user_id
    where sessions.token_hash = ? and sessions.expires_at > ?
    limit 1
  `).bind(tokenHash, new Date().toISOString()).first();
  if (!row) {
    throw new WorkerHttpError("Sign in before authorizing this client.", 401, "OAUTH_LOGIN_REQUIRED");
  }
  if (String(row.role || "").toLowerCase() !== "admin") {
    throw new WorkerHttpError("Only the site owner can authorize this MCP.", 403, "OAUTH_ADMIN_REQUIRED");
  }
  return {
    tokenHash,
    user: {
      id: String(row.id || ""),
      email: String(row.email || ""),
      role: "admin"
    }
  };
}

function normalizeAuthRequest(value: AuthRequest): z.infer<typeof StoredAuthRequestSchema> {
  const resources = Array.isArray(value.resource)
    ? value.resource
    : value.resource === undefined
      ? []
      : [value.resource];
  if (resources.length !== 1 || resources[0] !== MCP_RESOURCE) {
    throw new AuthorizationError("invalid_target", {
      description: `Authorization requests must contain exactly one resource=${MCP_RESOURCE}.`,
      redirectUri: value.redirectUri,
      state: value.state,
      issuer: value.issuer
    });
  }
  const parsed = StoredAuthRequestSchema.safeParse({
    ...value,
    resource: resources[0]
  });
  if (!parsed.success) {
    throw new AuthorizationError("invalid_request", {
      description: "Authorization parameters are invalid.",
      redirectUri: value.redirectUri,
      state: value.state,
      issuer: value.issuer
    });
  }
  return parsed.data;
}

function assertExplicitAuthorizationResource(request: Request): void {
  const resources = new URL(request.url).searchParams.getAll("resource");
  if (resources.length !== 1 || resources[0] !== MCP_RESOURCE) {
    throw new AuthorizationError("invalid_target", {
      description: `Authorization requests must contain exactly one resource=${MCP_RESOURCE}.`
    });
  }
}

function normalizeRequestedScopes(
  request: StoredConsentFlow["oauthRequest"]
): OwnerScope[] {
  const requested = [...new Set(["content:read", ...request.scope])];
  if (requested.some((scope) => !OWNER_SCOPE_SET.has(scope))) {
    throw new AuthorizationError("invalid_scope", {
      description: "The client requested an unsupported scope.",
      redirectUri: request.redirectUri,
      state: request.state,
      issuer: request.issuer
    });
  }
  return OWNER_SCOPES.filter((scope) => requested.includes(scope));
}

function normalizeClientName(client: ClientInfo, fallback: string): string {
  const name = String(client.clientName || fallback).trim();
  return name.slice(0, 240);
}

async function authorizationRequestFingerprint(
  request: StoredConsentFlow["oauthRequest"],
  flowId: string
): Promise<string> {
  return sha256Hex(JSON.stringify({
    flowId,
    clientId: request.clientId,
    redirectUri: request.redirectUri,
    resource: request.resource,
    scope: request.scope,
    codeChallenge: request.codeChallenge,
    codeChallengeMethod: request.codeChallengeMethod,
    state: request.state,
    issuer: request.issuer
  }));
}

function authorizationErrorResponse(error: AuthorizationError): Response {
  if (!error.redirectUri || !safeAuthorizationRedirectOrigin(error.redirectUri)) {
    return htmlResponse(errorPage(
      localized("OAuth 请求已拒绝", "OAuth request rejected", "OAuth リクエストが拒否されました"),
      localized(
        "请检查 AI 客户端的回调、resource、PKCE 和 scope 设置后重试。",
        "Check the AI client's redirect, resource, PKCE, and scope settings, then try again.",
        "AI クライアントのリダイレクト、resource、PKCE、scope 設定を確認して再試行してください。"
      ),
      `${error.code}: ${error.description}`
    ), 400);
  }
  const redirect = new URL(error.redirectUri);
  redirect.searchParams.set("error", error.code);
  redirect.searchParams.set("error_description", error.description);
  if (error.state) redirect.searchParams.set("state", error.state);
  if (error.issuer) redirect.searchParams.set("iss", error.issuer);
  return redirectResponse(redirect.toString());
}

function validateAuthorizationRedirectUri(value: string): string {
  if (typeof value !== "string"
    || value.length < 1
    || value.length > 2_048
    || /[\u0000-\u0020\u007f]/.test(value)
    || value.includes("\\")
    || value.includes("#")) {
    throw new WorkerHttpError(
      "OAuth redirect URI is unsafe.",
      400,
      "OAUTH_REDIRECT_URI_UNSAFE"
    );
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new WorkerHttpError(
      "OAuth redirect URI is unsafe.",
      400,
      "OAUTH_REDIRECT_URI_UNSAFE"
    );
  }
  const allowedScheme = url.protocol === "https:"
    || (url.protocol === "http:" && LOOPBACK_REDIRECT_HOSTS.has(url.hostname));
  if (!allowedScheme || !url.hostname || url.username || url.password) {
    throw new WorkerHttpError(
      "OAuth redirect URI is unsafe.",
      400,
      "OAUTH_REDIRECT_URI_UNSAFE"
    );
  }
  return url.origin;
}

function safeAuthorizationRedirectOrigin(value: string): string | null {
  try {
    return validateAuthorizationRedirectUri(value);
  } catch {
    return null;
  }
}

function authorizationDeniedRedirect(request: StoredConsentFlow["oauthRequest"]): string {
  const redirect = new URL(request.redirectUri);
  redirect.searchParams.set("error", "access_denied");
  redirect.searchParams.set("error_description", "The site owner denied this authorization request.");
  if (request.state) redirect.searchParams.set("state", request.state);
  if (request.issuer) redirect.searchParams.set("iss", request.issuer);
  return redirect.toString();
}

function redirectResponse(location: string, setCookie?: string): Response {
  const headers = new Headers({
    "Cache-Control": "no-store",
    Location: location,
    "X-Content-Type-Options": "nosniff"
  });
  if (setCookie) headers.append("Set-Cookie", setCookie);
  return new Response(null, { status: 302, headers });
}

function consentCookieName(request: Request, flowId: string): string {
  const prefix = new URL(request.url).protocol === "https:"
    ? "__Host-lusu_mcp_consent_"
    : "lusu_mcp_consent_";
  return `${prefix}${flowId}`;
}

function consentCookie(
  request: Request,
  flowId: string,
  token: string,
  maxAge: number
): string {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${consentCookieName(request, flowId)}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

function consentPage(input: {
  clientName: string;
  clientId: string;
  redirectUri: string;
  resource: string;
  scopes: OwnerScope[];
  email: string;
  flowId: string;
  csrfToken: string;
  requestFingerprint: string;
}): string {
  const scopeItems = input.scopes.map((scope) => (
    `<li><code>${escapeHtml(scope)}</code>`
      + `<span lang="zh-CN">${escapeHtml(SCOPE_DESCRIPTIONS[scope].zh)}</span>`
      + `<span lang="en">${escapeHtml(SCOPE_DESCRIPTIONS[scope].en)}</span>`
      + `<span lang="ja">${escapeHtml(SCOPE_DESCRIPTIONS[scope].ja)}</span></li>`
  )).join("");
  const loopbackWarning = isLoopbackRedirect(input.redirectUri)
    ? `<div class="warning danger"><strong>本机回调 / Local callback / ローカルコールバック</strong>
      <p lang="zh-CN">授权结果将返回这台电脑上的应用。只有在你刚刚主动打开该本机 AI 客户端时才继续。</p>
      <p lang="en">The result returns to an app on this computer. Continue only if you just initiated this connection from that local AI client.</p>
      <p lang="ja">認可結果はこのコンピュータ上のアプリに返されます。そのローカル AI クライアントから直前に開始した場合のみ続行してください。</p></div>`
    : "";
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>授权 LuSu MCP / Authorize / 認可</title><style>
*{box-sizing:border-box}body{font-family:Tahoma,"Microsoft YaHei",sans-serif;background:#3a6ea5;color:#111;margin:0;padding:18px}.window{max-width:760px;margin:2vh auto;border:3px solid #0a246a;background:#ece9d8;box-shadow:8px 8px 0 rgba(0,0,0,.35)}.titlebar{padding:7px 9px;color:#fff;font-weight:700;background:linear-gradient(90deg,#0a246a,#3a6ea5,#a6caf0);text-shadow:1px 1px #000}.panel{padding:20px}h1{font-size:22px;margin:0 0 8px}h2{font-size:17px}.sub{font-size:13px;color:#444;margin-top:2px}.meta{display:grid;grid-template-columns:190px 1fr;gap:8px;margin:18px 0;padding:12px;border:2px inset #fff;background:#fff}.meta dt{font-weight:700}.meta dd{margin:0;overflow-wrap:anywhere}ul{padding-left:24px}li{margin:12px 0}li span{display:block;color:#414141;margin-top:3px}.warning{background:#fff7c7;border:2px solid #9a6d00;padding:10px;margin:12px 0}.warning p{margin:6px 0}.danger{background:#ffe4df;border-color:#a62c1f}.actions{display:flex;justify-content:flex-end;gap:12px;margin-top:22px}button{min-height:44px;padding:0 18px;font-weight:700;border:2px outset #fff;background:#ece9d8;color:#111}.approve{background:#dbe9ff;border-color:#fff}button:focus{outline:2px dotted #111;outline-offset:-5px}@media(max-width:560px){body{padding:8px}.panel{padding:14px}.meta{grid-template-columns:1fr}.actions{flex-direction:column-reverse}button{width:100%}}</style></head>
<body><main class="window"><div class="titlebar">LuSu Site Owner MCP — OAuth 2.1</div><section class="panel"><h1>允许 AI 连接站长 MCP？ / Allow this AI client? / AI クライアントを許可しますか？</h1>
<p class="sub">请仔细核对客户端、回调和权限。 / Verify the client, callback, and permissions. / クライアント、コールバック、権限を確認してください。</p>
<p>当前账号 / Signed in / ログイン中：<strong>${escapeHtml(input.email)}</strong></p>
<dl class="meta"><dt>客户端 / Client / クライアント</dt><dd>${escapeHtml(input.clientName)}</dd><dt>Client ID</dt><dd>${escapeHtml(input.clientId)}</dd><dt>回调 / Callback / コールバック</dt><dd>${escapeHtml(input.redirectUri)}</dd><dt>资源 / Resource / リソース</dt><dd>${escapeHtml(input.resource)}</dd></dl>
${loopbackWarning}
<h2>申请权限 / Requested permissions / 要求された権限</h2><ul>${scopeItems}</ul>
<div class="warning"><p lang="zh-CN">写入和删除会实时复核管理员身份、授权账本与最小 scope。发布使用 operationId 并由服务端原子执行。</p>
<p lang="en">Write and delete operations re-check the administrator role, authorization ledger, and minimum scope. Publishing is atomic and requires an operationId.</p>
<p lang="ja">書き込みと削除の際は、管理者ロール、認可元帳、最小 scope を再確認します。公開は operationId を必須とし、サーバー側でアトミックに実行されます。</p></div>
<form method="post" action="${AUTHORIZE_PATH}">
<input type="hidden" name="flow_id" value="${escapeHtml(input.flowId)}"><input type="hidden" name="csrf_token" value="${escapeHtml(input.csrfToken)}"><input type="hidden" name="request_fingerprint" value="${escapeHtml(input.requestFingerprint)}">
<div class="actions"><button type="submit" name="decision" value="deny">拒绝 / Deny / 拒否</button><button class="approve" type="submit" name="decision" value="approve">同意授权 / Allow / 許可</button></div>
</form></section></main></body></html>`;
}

function errorPage(title: LocalizedText, message: LocalizedText, detail = ""): string {
  const detailBlock = detail ? `<p><code>${escapeHtml(detail)}</code></p>` : "";
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title.zh)} / ${escapeHtml(title.en)}</title><style>*{box-sizing:border-box}body{font-family:Tahoma,"Microsoft YaHei",sans-serif;background:#3a6ea5;margin:0;padding:18px}.window{max-width:720px;margin:5vh auto;border:3px solid #0a246a;background:#ece9d8;box-shadow:8px 8px 0 rgba(0,0,0,.35)}.title{background:linear-gradient(90deg,#0a246a,#3a6ea5,#a6caf0);color:#fff;font-weight:700;padding:7px 9px}.body{padding:22px}h1{font-size:22px}p{overflow-wrap:anywhere}code{display:block;background:#fff;border:2px inset #fff;padding:8px}</style></head><body><main class="window"><div class="title">LuSu MCP — OAuth</div><section class="body"><h1>${escapeHtml(title.zh)} / ${escapeHtml(title.en)} / ${escapeHtml(title.ja)}</h1><p lang="zh-CN">${escapeHtml(message.zh)}</p><p lang="en">${escapeHtml(message.en)}</p><p lang="ja">${escapeHtml(message.ja)}</p>${detailBlock}</section></main></body></html>`;
}

function localized(zh: string, en: string, ja: string): LocalizedText {
  return Object.freeze({ zh, en, ja });
}

function isLoopbackRedirect(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" && LOOPBACK_REDIRECT_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function logSecurityEvent(event: string, code: string, status: number): void {
  console.error(JSON.stringify({
    service: "lusu-site-admin-mcp",
    event,
    code,
    status
  }));
}
