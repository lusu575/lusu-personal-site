import { authenticateAgentBearer } from "./agent-auth.mjs";
import {
  AgentArticleServiceError,
  assertAgentArticleAccess,
  deleteAgentArticleService,
  getAgentArticleService,
  listAgentArticlesService,
  publishAgentArticleService,
  updateAgentArticleService
} from "./agent-article-service.mjs";

const MAX_ARTICLE_JSON_BYTES = 700 * 1024;

export function isAgentArticlesApiPath(parts) {
  return Array.isArray(parts) && parts[0] === "agent" && parts[1] === "articles";
}

export async function handleAgentArticlesApi(context, parts) {
  if (!isAgentArticlesApiPath(parts)) {
    return null;
  }

  const { request, env } = context;
  try {
    const requiredScope = request.method === "DELETE" ? "content:delete" : "content:write";
    const authenticated = await authenticateAgentBearer(request, env, [requiredScope]);
    const principal = deviceArticlePrincipal(authenticated);
    const route = parts.slice(2);

    if (request.method === "GET" && route.length === 0) {
      await assertAgentArticleAccess({ env, principal, requiredScope });
      return resultResponse(await listAgentArticlesService({
        env,
        principal,
        query: parseAgentArticleListQuery(request)
      }));
    }
    if (request.method === "GET" && route.length === 1) {
      return resultResponse(await getAgentArticleService({
        env,
        principal,
        articleId: route[0]
      }));
    }

    if (request.method === "POST" && route.length === 1 && route[0] === "publish") {
      await assertAgentArticleAccess({ env, principal, requiredScope });
      return resultResponse(await publishAgentArticleService({
        env,
        principal,
        payload: await readStrictJson(request)
      }));
    }
    if (request.method === "PUT" && route.length === 1) {
      await assertAgentArticleAccess({ env, principal, requiredScope });
      return resultResponse(await updateAgentArticleService({
        env,
        principal,
        articleId: route[0],
        payload: await readStrictJson(request)
      }));
    }
    if (request.method === "DELETE" && route.length === 1) {
      await assertAgentArticleAccess({ env, principal, requiredScope });
      return resultResponse(await deleteAgentArticleService({
        env,
        principal,
        articleId: route[0],
        payload: await readStrictJson(request)
      }));
    }

    await assertAgentArticleAccess({ env, principal, requiredScope });
    throw new AgentArticleServiceError(
      "Agent article endpoint not found.",
      404,
      "AGENT_ARTICLES_NOT_FOUND"
    );
  } catch (error) {
    return agentArticlesErrorResponse(error);
  }
}

function deviceArticlePrincipal(principal) {
  return {
    authType: principal.authType,
    userId: principal.user.id,
    tokenRef: principal.tokenId,
    effectiveScopes: principal.scopes
  };
}

function parseAgentArticleListQuery(request) {
  const searchParams = new URL(request.url).searchParams;
  const allowed = new Set(["status", "category", "limit"]);
  for (const key of searchParams.keys()) {
    if (!allowed.has(key) || searchParams.getAll(key).length !== 1) {
      throw new AgentArticleServiceError(
        "Article list query is invalid.",
        400,
        "ARTICLE_QUERY_INVALID"
      );
    }
  }
  const query = {};
  for (const key of allowed) {
    if (searchParams.has(key)) {
      query[key] = searchParams.get(key);
    }
  }
  return query;
}

async function readStrictJson(request) {
  const contentType = String(request.headers.get("Content-Type") || "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (contentType !== "application/json") {
    throw new AgentArticleServiceError(
      "Article requests must use application/json.",
      415,
      "ARTICLE_CONTENT_TYPE_INVALID"
    );
  }
  const declaredLength = Number(request.headers.get("Content-Length") || 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_ARTICLE_JSON_BYTES) {
    throw articleBodyTooLargeError();
  }
  if (!request.body) {
    throw new AgentArticleServiceError(
      "Article request JSON is invalid.",
      400,
      "ARTICLE_JSON_INVALID"
    );
  }
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_ARTICLE_JSON_BYTES) {
        await reader.cancel();
        throw articleBodyTooLargeError();
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
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new AgentArticleServiceError(
      "Article request must contain valid UTF-8.",
      400,
      "ARTICLE_UTF8_INVALID"
    );
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new AgentArticleServiceError(
      "Article request JSON is invalid.",
      400,
      "ARTICLE_JSON_INVALID"
    );
  }
}

function articleBodyTooLargeError() {
  return new AgentArticleServiceError(
    "Article request body is too large.",
    413,
    "ARTICLE_BODY_TOO_LARGE"
  );
}

function resultResponse(result) {
  return agentArticlesJson(result.payload, result.status);
}

function agentArticlesErrorResponse(error) {
  if (error instanceof AgentArticleServiceError) {
    return agentArticlesJson({
      error: error.message,
      code: error.code,
      ...(error.details || {})
    }, error.status);
  }
  const status = Number(error?.status || 0);
  const code = String(error?.code || "");
  if (status >= 400 && status < 500 && /^AGENT_[A-Z0-9_]+$/.test(code)) {
    return agentArticlesJson({
      error: String(error?.message || "Agent authorization failed."),
      code
    }, status, status === 401);
  }
  console.error(JSON.stringify({
    message: "agent article request failed",
    code: "AGENT_ARTICLES_INTERNAL_ERROR"
  }));
  return agentArticlesJson({
    error: "Agent article service is temporarily unavailable.",
    code: "AGENT_ARTICLES_INTERNAL_ERROR"
  }, 500);
}

function agentArticlesJson(payload, status = 200, authenticate = false) {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY"
  });
  if (authenticate || status === 401) {
    headers.set("WWW-Authenticate", "Bearer realm=\"lusu-agent\"");
  }
  return new Response(JSON.stringify(payload), { status, headers });
}
