import { authenticateAgentBearer } from "./agent-auth.mjs";
import {
  AgentVideoServiceError,
  abortAgentVideoUploadService,
  beginAgentVideoUploadService,
  commitAgentVideoUploadService,
  createAgentVideoService,
  deleteAgentVideoService,
  getAgentVideoService,
  getAgentVideoUploadService,
  listAgentVideosService,
  refreshAgentVideoService,
  updateAgentVideoService
} from "./agent-video-service.mjs";

const MAX_VIDEO_JSON_BYTES = 64 * 1024;

export function isAgentVideosApiPath(parts) {
  return Array.isArray(parts) && parts[0] === "agent" && parts[1] === "videos";
}

export async function handleAgentVideosApi(context, parts) {
  if (!isAgentVideosApiPath(parts)) return null;
  const { request, env } = context;
  try {
    const route = parts.slice(2);
    const requiredScope = request.method === "DELETE" ? "content:delete" : "content:write";
    const authenticated = await authenticateAgentBearer(request, env, [requiredScope]);
    const principal = deviceVideoPrincipal(authenticated);

    if (request.method === "GET" && route.length === 0) {
      return resultResponse(await listAgentVideosService({
        env,
        principal,
        query: parseAgentVideoListQuery(request)
      }));
    }
    if (request.method === "POST" && route.length === 0) {
      return resultResponse(await createAgentVideoService({
        env,
        principal,
        payload: await readStrictJson(request)
      }));
    }

    if (route[0] === "uploads") {
      return await handleAgentVideoUploads({ request, env, principal, route: route.slice(1) });
    }

    if (request.method === "GET" && route.length === 1) {
      return resultResponse(await getAgentVideoService({ env, principal, videoId: route[0] }));
    }
    if (request.method === "PUT" && route.length === 1) {
      return resultResponse(await updateAgentVideoService({
        env,
        principal,
        videoId: route[0],
        payload: await readStrictJson(request)
      }));
    }
    if (request.method === "DELETE" && route.length === 1) {
      return resultResponse(await deleteAgentVideoService({
        env,
        principal,
        videoId: route[0],
        payload: await readStrictJson(request)
      }));
    }
    if (request.method === "POST" && route.length === 2 && route[1] === "refresh") {
      return resultResponse(await refreshAgentVideoService({
        env,
        principal,
        videoId: route[0],
        payload: await readStrictJson(request)
      }));
    }

    throw new AgentVideoServiceError(
      "Agent video endpoint not found.",
      404,
      "AGENT_VIDEOS_NOT_FOUND"
    );
  } catch (error) {
    return agentVideosErrorResponse(error);
  }
}

async function handleAgentVideoUploads({ request, env, principal, route }) {
  if (request.method === "POST" && route.length === 1 && route[0] === "begin") {
    return resultResponse(await beginAgentVideoUploadService({
      env,
      principal,
      payload: await readStrictJson(request)
    }));
  }
  if (request.method === "GET" && route.length === 1) {
    return resultResponse(await getAgentVideoUploadService({
      env,
      principal,
      uploadSessionId: route[0]
    }));
  }
  if (request.method === "POST" && route.length === 2 && route[1] === "abort") {
    return resultResponse(await abortAgentVideoUploadService({
      env,
      principal,
      uploadSessionId: route[0],
      payload: await readStrictJson(request)
    }));
  }
  if (request.method === "POST" && route.length === 2 && route[1] === "commit") {
    return resultResponse(await commitAgentVideoUploadService({
      env,
      principal,
      uploadSessionId: route[0],
      payload: await readStrictJson(request)
    }));
  }
  throw new AgentVideoServiceError(
    "Agent video upload endpoint not found.",
    404,
    "AGENT_VIDEO_UPLOAD_NOT_FOUND"
  );
}

function deviceVideoPrincipal(principal) {
  return {
    authType: principal.authType,
    userId: principal.user.id,
    tokenRef: principal.tokenId,
    effectiveScopes: principal.scopes
  };
}

function parseAgentVideoListQuery(request) {
  const searchParams = new URL(request.url).searchParams;
  const allowed = new Set(["status", "platform", "limit"]);
  for (const key of searchParams.keys()) {
    if (!allowed.has(key) || searchParams.getAll(key).length !== 1) {
      throw new AgentVideoServiceError(
        "Video list query is invalid.",
        400,
        "VIDEO_QUERY_INVALID"
      );
    }
  }
  const query = {};
  for (const key of allowed) {
    if (searchParams.has(key)) query[key] = searchParams.get(key);
  }
  return query;
}

async function readStrictJson(request) {
  const contentType = String(request.headers.get("Content-Type") || "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (contentType !== "application/json") {
    throw new AgentVideoServiceError(
      "Video requests must use application/json.",
      415,
      "VIDEO_CONTENT_TYPE_INVALID"
    );
  }
  const declaredLength = Number(request.headers.get("Content-Length") || 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_VIDEO_JSON_BYTES) {
    throw videoBodyTooLargeError();
  }
  if (!request.body) {
    throw new AgentVideoServiceError("Video request JSON is invalid.", 400, "VIDEO_JSON_INVALID");
  }
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_VIDEO_JSON_BYTES) {
        await reader.cancel();
        throw videoBodyTooLargeError();
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
    throw new AgentVideoServiceError(
      "Video request must contain valid UTF-8.",
      400,
      "VIDEO_UTF8_INVALID"
    );
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new AgentVideoServiceError("Video request JSON is invalid.", 400, "VIDEO_JSON_INVALID");
  }
}

function videoBodyTooLargeError() {
  return new AgentVideoServiceError(
    "Video request body is too large.",
    413,
    "VIDEO_BODY_TOO_LARGE"
  );
}

function resultResponse(result) {
  return agentVideosJson(result.payload, result.status);
}

function agentVideosErrorResponse(error) {
  if (error instanceof AgentVideoServiceError) {
    return agentVideosJson({
      error: error.message,
      code: error.code,
      ...(error.details || {})
    }, error.status);
  }
  const status = Number(error?.status || 0);
  const code = String(error?.code || "");
  if (status >= 400 && status < 500 && /^AGENT_[A-Z0-9_]+$/.test(code)) {
    return agentVideosJson({
      error: String(error?.message || "Agent authorization failed."),
      code
    }, status, status === 401);
  }
  console.error(JSON.stringify({
    message: "agent video request failed",
    code: "AGENT_VIDEOS_INTERNAL_ERROR"
  }));
  return agentVideosJson({
    error: "Agent video service is temporarily unavailable.",
    code: "AGENT_VIDEOS_INTERNAL_ERROR"
  }, 500);
}

function agentVideosJson(payload, status = 200, authenticate = false) {
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
