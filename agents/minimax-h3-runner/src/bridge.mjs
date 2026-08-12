import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { join, relative, resolve } from "node:path";

const SESSION_COOKIE = "__Host-h3_bridge_session";
const SESSION_TTL_MS = 30 * 60 * 1000;
const SESSION_ABSOLUTE_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_SESSIONS = 128;
const MAX_JSON_BYTES = 16 * 1024;
const ALLOWED_METHODS = "GET, HEAD, POST, DELETE, OPTIONS";
const ALLOWED_HEADERS = "Content-Type, X-H3-CSRF";

export function createLoopbackBridge({
  host = "127.0.0.1",
  port = 8791,
  config,
  site,
  getRunnerId = () => "",
  siteOrigin
} = {}) {
  if (!config?.stateRoot || !site || typeof site.request !== "function") {
    throw new Error("H3 Bridge requires the Runner config and site client.");
  }
  const allowedOrigin = new URL(siteOrigin || config.baseUrl).origin;
  const sessions = new Map();
  const server = createServer((request, response) => {
    void handleRequest(request, response).catch((error) => {
      sendError(response, error);
    });
  });

  return {
    server,
    listen() {
      return new Promise((resolvePromise, reject) => {
        server.once("error", reject);
        server.listen(port, host, () => resolvePromise());
      });
    },
    close() {
      sessions.clear();
      return new Promise((resolvePromise, reject) => server.close((error) => error ? reject(error) : resolvePromise()));
    }
  };

  async function handleRequest(request, response) {
    const url = new URL(request.url || "/", `http://${host}:${port}`);
    const origin = String(request.headers.origin || "");
    applyHeaders(response, origin, allowedOrigin);

    if (request.method === "OPTIONS") {
      if (origin !== allowedOrigin) throw new BridgeHttpError("Origin is not allowed.", 403, "H3_BRIDGE_ORIGIN_DENIED");
      response.writeHead(204);
      response.end();
      return;
    }
    if (url.pathname === "/v1/health" && request.method === "GET") {
      sendJson(response, 200, { ok: true, bridge: "loopback", host, port });
      return;
    }
    if (url.pathname === "/v1/bootstrap" && request.method === "GET") {
      sendJson(response, 200, { ok: true, bridge: "h3-loopback", session: "/v1/session/exchange" });
      return;
    }
    if (url.pathname === "/v1/session/exchange" && request.method === "POST") {
      requireOrigin(origin, allowedOrigin);
      await exchangeSession(request, response);
      return;
    }
    if (url.pathname === "/v1/session" && request.method === "DELETE") {
      requireOrigin(origin, allowedOrigin);
      const session = authenticateSession(request, sessions);
      requireCsrf(request, session);
      sessions.delete(session.id);
      sendJson(response, 200, { ok: true });
      return;
    }

    const resultMatch = url.pathname.match(/^\/v1\/jobs\/(job_[A-Za-z0-9_-]{8,120})\/result$/u);
    if (resultMatch && (request.method === "GET" || request.method === "HEAD")) {
      const session = authenticateSession(request, sessions);
      if (session.jobId !== resultMatch[1]) {
        throw new BridgeHttpError("The Bridge session is not valid for this job.", 403, "H3_BRIDGE_JOB_FORBIDDEN");
      }
      await serveResult(request, response, session);
      return;
    }
    throw new BridgeHttpError("Not found.", 404, "H3_BRIDGE_NOT_FOUND");
  }

  async function exchangeSession(request, response) {
    const body = await readJson(request);
    assertExactKeys(body, ["ticketId", "secret"], "session exchange");
    const ticketId = requireOpaque(body.ticketId, "ticketId", "ticket_");
    const secret = requireTicketSecret(body.secret);
    const runnerId = requireOpaque(getRunnerId(), "runnerId", "runner_");
    let ticket;
    try {
      ticket = await site.request("/api/agent/minimax-h3/transfers/introspect", {
        method: "POST",
        body: { ticketId, secret, runnerId }
      });
    } catch (error) {
      const code = String(error?.code || "H3_TICKET_UNAVAILABLE");
      throw new BridgeHttpError("The H3 transfer ticket could not be exchanged.", 409, code);
    }
    const now = Date.now();
    const sessionId = `h3s_${randomBytes(32).toString("base64url")}`;
    const csrfToken = `h3c_${randomBytes(24).toString("base64url")}`;
    const session = {
      id: sessionId,
      csrfToken,
      jobId: ticket.jobId,
      result: ticket.result,
      createdAt: now,
      absoluteExpiresAt: now + SESSION_ABSOLUTE_TTL_MS,
      idleExpiresAt: now + SESSION_TTL_MS
    };
    evictSessions(sessions);
    sessions.set(sessionId, session);
    response.setHeader("Set-Cookie", `${SESSION_COOKIE}=${sessionId}; Path=/; Secure; HttpOnly; SameSite=Strict`);
    sendJson(response, 200, {
      ok: true,
      jobId: session.jobId,
      expiresAt: new Date(Math.min(session.absoluteExpiresAt, session.idleExpiresAt)).toISOString(),
      csrfToken
    });
  }

  async function serveResult(request, response, session) {
    const now = Date.now();
    if (now >= session.absoluteExpiresAt || now >= session.idleExpiresAt) {
      sessions.delete(session.id);
      throw new BridgeHttpError("The Bridge session has expired.", 401, "H3_BRIDGE_SESSION_EXPIRED");
    }
    session.idleExpiresAt = now + SESSION_TTL_MS;
    const resultName = safeResultName(session.result?.name);
    const resultPath = resolve(join(resolve(config.stateRoot), "results", session.jobId, resultName));
    if (!isWithin(resolve(config.stateRoot), resultPath)) {
      throw new BridgeHttpError("The Bridge result path is invalid.", 500, "H3_BRIDGE_RESULT_PATH_INVALID");
    }
    let file;
    try {
      file = await stat(resultPath);
    } catch {
      throw new BridgeHttpError("The H3 result is not available locally.", 404, "H3_RESULT_NOT_AVAILABLE");
    }
    if (!file.isFile() || file.size <= 0 || file.size !== Number(session.result?.bytes || 0)) {
      throw new BridgeHttpError("The local H3 result failed its size check.", 409, "H3_RESULT_SIZE_MISMATCH");
    }
    const etag = `"sha256-${String(session.result?.sha256 || "")}"`;
    const ifRange = String(request.headers["if-range"] || "");
    const range = ifRange && ifRange !== etag ? null : parseSingleRange(request.headers.range, file.size);
    const start = range?.offset ?? 0;
    const end = range ? range.offset + range.length - 1 : file.size - 1;
    const headers = new Map([
      ["Content-Type", String(session.result?.mime || "video/mp4")],
      ["Content-Length", String(end - start + 1)],
      ["Accept-Ranges", "bytes"],
      ["ETag", etag],
      ["Cache-Control", "private, no-store, no-transform"],
      ["Content-Disposition", `attachment; filename="${resultName}"`],
      ["X-Content-Type-Options", "nosniff"],
      ["Content-Security-Policy", "default-src 'none'; sandbox"]
    ]);
    if (range) headers.set("Content-Range", `bytes ${start}-${end}/${file.size}`);
    response.writeHead(range ? 206 : 200, Object.fromEntries(headers));
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    createReadStream(resultPath, { start, end }).on("error", () => response.destroy()).pipe(response);
  }
}

class BridgeHttpError extends Error {
  constructor(message, status, code, details = null) {
    super(message);
    this.name = "BridgeHttpError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function applyHeaders(response, origin, allowedOrigin) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
  response.setHeader("Vary", "Origin");
  if (origin === allowedOrigin) {
    response.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    response.setHeader("Access-Control-Allow-Credentials", "true");
    response.setHeader("Access-Control-Allow-Methods", ALLOWED_METHODS);
    response.setHeader("Access-Control-Allow-Headers", ALLOWED_HEADERS);
  }
}

function requireOrigin(origin, allowedOrigin) {
  if (origin !== allowedOrigin) throw new BridgeHttpError("Origin is not allowed.", 403, "H3_BRIDGE_ORIGIN_DENIED");
}

function authenticateSession(request, sessions) {
  const id = readCookie(request.headers.cookie, SESSION_COOKIE);
  const session = id ? sessions.get(id) : null;
  if (!session) throw new BridgeHttpError("The Bridge session is required.", 401, "H3_BRIDGE_SESSION_REQUIRED");
  const now = Date.now();
  if (now >= session.absoluteExpiresAt || now >= session.idleExpiresAt) {
    sessions.delete(id);
    throw new BridgeHttpError("The Bridge session has expired.", 401, "H3_BRIDGE_SESSION_EXPIRED");
  }
  session.idleExpiresAt = now + SESSION_TTL_MS;
  return session;
}

function requireCsrf(request, session) {
  if (String(request.headers["x-h3-csrf"] || "") !== session.csrfToken) {
    throw new BridgeHttpError("The Bridge CSRF check failed.", 403, "H3_BRIDGE_CSRF_INVALID");
  }
}

function evictSessions(sessions) {
  const now = Date.now();
  for (const [key, session] of sessions) {
    if (now >= session.absoluteExpiresAt || now >= session.idleExpiresAt) sessions.delete(key);
  }
  while (sessions.size >= MAX_SESSIONS) {
    const first = sessions.keys().next().value;
    if (!first) break;
    sessions.delete(first);
  }
}

function parseSingleRange(header, totalSize) {
  if (!header) return null;
  if (String(header).includes(",")) throw rangeError(totalSize);
  const match = String(header).match(/^bytes=(\d*)-(\d*)$/iu);
  if (!match || (!match[1] && !match[2])) throw rangeError(totalSize);
  let start;
  let end;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) throw rangeError(totalSize);
    start = Math.max(0, totalSize - suffix);
    end = totalSize - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : totalSize - 1;
  }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= totalSize || end < start) {
    throw rangeError(totalSize);
  }
  end = Math.min(end, totalSize - 1);
  return { offset: start, length: end - start + 1 };
}

function rangeError(totalSize) {
  return new BridgeHttpError("The requested byte range is invalid.", 416, "H3_BRIDGE_RANGE_INVALID", {
    contentRange: `bytes */${totalSize}`
  });
}

function safeResultName(value) {
  const name = String(value || "");
  if (!/^result\.(?:mp4|webm|mov|mkv)$/iu.test(name)) {
    throw new BridgeHttpError("The H3 result name is invalid.", 500, "H3_BRIDGE_RESULT_NAME_INVALID");
  }
  return name;
}

function isWithin(root, target) {
  const child = relative(root, target);
  return child === "" || (child !== ".." && !child.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) && !/^[A-Za-z]:/u.test(child));
}

function requireOpaque(value, label, prefix) {
  const text = String(value || "");
  if (!new RegExp(`^${prefix}[A-Za-z0-9_-]{8,120}$`, "u").test(text)) {
    throw new BridgeHttpError(`${label} is invalid.`, 422, "H3_BRIDGE_INPUT_INVALID");
  }
  return text;
}

function requireTicketSecret(value) {
  const text = String(value || "");
  if (!/^h3t_[A-Za-z0-9_-]{20,180}$/u.test(text)) {
    throw new BridgeHttpError("The ticket secret is invalid.", 422, "H3_BRIDGE_INPUT_INVALID");
  }
  return text;
}

function assertExactKeys(value, keys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BridgeHttpError(`${label} must be an object.`, 422, "H3_BRIDGE_INPUT_INVALID");
  }
  const allowed = new Set(keys);
  if (Object.keys(value).some((key) => !allowed.has(key))) {
    throw new BridgeHttpError(`${label} contains unsupported fields.`, 422, "H3_BRIDGE_INPUT_INVALID");
  }
}

async function readJson(request) {
  const contentType = String(request.headers["content-type"] || "").split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") throw new BridgeHttpError("Bridge JSON is required.", 415, "H3_BRIDGE_CONTENT_TYPE_REQUIRED");
  const declared = Number(request.headers["content-length"]);
  if (Number.isFinite(declared) && declared > MAX_JSON_BYTES) throw new BridgeHttpError("Bridge request is too large.", 413, "H3_BRIDGE_BODY_TOO_LARGE");
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    total += chunk.length;
    if (total > MAX_JSON_BYTES) throw new BridgeHttpError("Bridge request is too large.", 413, "H3_BRIDGE_BODY_TOO_LARGE");
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new BridgeHttpError("Bridge JSON is invalid.", 400, "H3_BRIDGE_JSON_INVALID");
  }
}

function readCookie(header, name) {
  return String(header || "").split(";").map((part) => part.trim()).map((part) => {
    const separator = part.indexOf("=");
    return separator > 0 ? [part.slice(0, separator), part.slice(separator + 1)] : ["", ""];
  }).find(([key]) => key === name)?.[1] || "";
}

function sendJson(response, status, payload) {
  const body = JSON.stringify(payload);
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Content-Length", Buffer.byteLength(body));
  response.writeHead(status);
  response.end(body);
}

function sendError(response, error) {
  if (response.headersSent) {
    response.destroy();
    return;
  }
  const status = Number.isInteger(error?.status) ? error.status : 500;
  const headers = {};
  if (error?.details?.contentRange) headers["Content-Range"] = error.details.contentRange;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Content-Length", "0");
  for (const [key, value] of Object.entries(headers)) response.setHeader(key, value);
  response.writeHead(status);
  response.end();
}
