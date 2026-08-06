import {
  ensureAnonymousIdentity,
  publicAnonymousIdentity,
  withAnonymousIdentityCookie
} from "./anonymous-identity.mjs";
import { authenticateAgentBearer } from "./agent-auth.mjs";

const PUBLIC_ROOM_ID = "public-v1";
const PUBLIC_ROOM_TYPE = "public";
const PRIVATE_ROOM_TYPE = "private";
const WS_PROTOCOL = "whiteboard.v1";
const AGENT_ACCESS_KIND = "agent-access";
const TOKEN_PREFIX = "wbt1";
const TOKEN_AUDIENCE = "lusu-whiteboard";
const TOKEN_VERSION = 1;
const TICKET_LIFETIME_SECONDS = 90;
const ACCESS_LIFETIME_SECONDS = 12 * 60 * 60;
const CLOCK_SKEW_SECONDS = 30;
const MAX_JSON_BYTES = 16 * 1024;
const MAX_TOKEN_CHARS = 4096;
const MAX_PROTOCOL_HEADER_CHARS = 8192;
const MAX_ASSET_BYTES = 5 * 1024 * 1024;
const MAX_AGENT_SCENE_BYTES = 256 * 1024;
const AGENT_SCENE_CONTENT_TYPE = "application/vnd.yjs";
const AGENT_UPDATE_CONTENT_TYPE = "application/vnd.yjs-update";
const MAX_ADMIN_PAGE = 100;
const MAX_ADMIN_OFFSET = 10_000;
const ROOM_ID_PATTERN = /^wb_[A-Za-z0-9_-]{43}$/;
const ANONYMOUS_ID_PATTERN = /^[A-Za-z0-9_-]{20,160}$/;
const ASSET_ID_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;
const CONNECTION_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;
const IP_HASH_PATTERN = /^[a-f0-9]{64}$/;
const AGENT_TOKEN_ID_PATTERN = /^[A-Za-z0-9_-]{8,160}$/;
const AGENT_OPERATION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,79}$/;
const SAFE_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const API_SECURITY_HEADERS = Object.freeze({
  "Cache-Control": "no-store",
  "Content-Security-Policy": "default-src 'none'; base-uri 'none'; frame-ancestors 'none'",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "Referrer-Policy": "no-referrer",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY"
});
const INTERNAL_HEADERS = Object.freeze({
  secret: "x-whiteboard-internal-secret",
  roomId: "x-whiteboard-room-id",
  roomType: "x-whiteboard-room-type",
  anonymousId: "x-whiteboard-anonymous-id",
  displayName: "x-whiteboard-display-name-b64",
  color: "x-whiteboard-identity-color",
  identityVersion: "x-whiteboard-identity-version",
  ipHash: "x-whiteboard-ip-hash",
  ticketJti: "x-whiteboard-ticket-jti",
  clientOrigin: "x-whiteboard-client-origin",
  adminAuthorized: "x-whiteboard-admin-authorized",
  adminUserId: "x-whiteboard-admin-user-id",
  agentAuthorized: "x-whiteboard-agent-authorized",
  agentSubject: "x-whiteboard-agent-subject",
  agentOperationId: "x-whiteboard-agent-operation-id"
});

const schemaPromises = new WeakMap();

export class WhiteboardHttpError extends Error {
  constructor(message, status = 400, code = "WHITEBOARD_REQUEST_FAILED", retryAfter = 0) {
    super(message);
    this.name = "WhiteboardHttpError";
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

/**
 * Handles only /api/whiteboard/* and /api/admin/whiteboards/*.
 * The parent router remains responsible for its normal admin-session validation;
 * this module additionally requires the explicit isAdmin capability.
 */
export async function handleWhiteboardApi(
  context,
  parts,
  options = { isAdmin: false, adminUser: null }
) {
  const isPublicRoute = parts[0] === "whiteboard";
  const isAdminRoute = parts[0] === "admin" && parts[1] === "whiteboards";
  if (!isPublicRoute && !isAdminRoute) return null;

  const { request, env } = context;
  let identity = null;
  try {
    assertBaseBindings(env);
    await ensureWhiteboardSchema(env);

    let response;
    if (isAdminRoute) {
      if (options?.isAdmin !== true) {
        throw new WhiteboardHttpError("没有权限访问此接口。", 403, "WHITEBOARD_ADMIN_REQUIRED");
      }
      response = await handleAdminWhiteboardApi(
        context,
        parts.slice(2),
        options.adminUser || null
      );
    } else if (parts[1] === "agent") {
      response = await handleAgentWhiteboardApi(context, parts.slice(2));
    } else {
      identity = await ensureAnonymousIdentity(request, env);
      response = await handlePublicWhiteboardApi(context, parts.slice(1), identity);
    }
    return identity
      ? withAnonymousIdentityCookie(response, request, identity)
      : response;
  } catch (error) {
    const response = whiteboardErrorResponse(error);
    return identity
      ? withAnonymousIdentityCookie(response, request, identity)
      : response;
  }
}

async function handleAgentWhiteboardApi(context, parts) {
  const { request, env } = context;
  assertAgentRequestOrigin(request);

  if (
    request.method === "POST"
    && parts.length === 2
    && parts[0] === "rooms"
    && parts[1] === "join"
  ) {
    const principal = await authenticateWhiteboardAgent(request, env, "join");
    const body = await readBoundedJson(request);
    return joinWhiteboardRoomAsAgent(context, principal, body);
  }

  if (
    (request.method === "GET" || request.method === "POST")
    && parts.length === 1
    && parts[0] === "scene"
  ) {
    const principal = await authenticateWhiteboardAgent(
      request,
      env,
      request.method === "POST" ? "write" : "read"
    );
    return proxyWhiteboardAgentScene(context, principal);
  }

  return whiteboardJson({
    error: "Agent whiteboard endpoint not found.",
    code: "WHITEBOARD_AGENT_NOT_FOUND"
  }, 404);
}

async function joinWhiteboardRoomAsAgent(context, principal, body) {
  assertPlainObject(body);
  const allowedKeys = new Set(["type", "password"]);
  if (Object.keys(body).some((key) => !allowedKeys.has(key))) {
    throw joinFailedError();
  }
  const roomType = normalizeRoomType(body.type);
  if (
    (roomType === PRIVATE_ROOM_TYPE && typeof body.password !== "string")
    || (roomType === PUBLIC_ROOM_TYPE && body.password !== undefined)
  ) {
    throw joinFailedError();
  }
  const ip = await whiteboardIpContext(context.request, context.env);
  await consumeAgentWhiteboardAttempt(
    context.env,
    principal.tokenId,
    ip.ipHash,
    "join"
  );
  if (roomType === PRIVATE_ROOM_TYPE) {
    await consumeJoinAttempt(context.env, ip.ipHash, roomType);
  }

  const roomId = roomType === PUBLIC_ROOM_TYPE
    ? PUBLIC_ROOM_ID
    : await derivePrivateWhiteboardRoomId(
        body.password,
        requiredSecret(context.env, "WHITEBOARD_ROOM_HMAC_SECRET")
      );
  assertRealtimeBindings(context.env);
  const credentials = await issueAgentRoomCredential(
    context.env,
    principal,
    roomId,
    roomType
  );
  return whiteboardJson({
    room: { type: roomType },
    accessToken: credentials.accessToken,
    accessExpiresAt: credentials.accessExpiresAt
  });
}

async function proxyWhiteboardAgentScene(context, principal) {
  const { request, env } = context;
  assertRealtimeBindings(env);
  const accessToken = agentAccessTokenFromRequest(request);
  const claims = await verifyWhiteboardToken(
    accessToken,
    requiredSecret(env, "WHITEBOARD_TICKET_SECRET"),
    { expectedKind: AGENT_ACCESS_KIND }
  );
  if (claims.tid !== principal.tokenId) {
    throw accessDeniedError();
  }
  const ip = await whiteboardIpContext(request, env);
  const method = request.method;
  await consumeAgentWhiteboardAttempt(
    env,
    principal.tokenId,
    ip.ipHash,
    method === "POST" ? "write" : "read"
  );

  const headers = await agentInternalRoomHeaders({
    env,
    claims,
    principal,
    ipHash: ip.ipHash
  });
  let body;
  let operationId = "";
  if (method === "POST") {
    const contentType = String(request.headers.get("Content-Type") || "")
      .split(";", 1)[0]
      .trim()
      .toLowerCase();
    if (contentType !== AGENT_UPDATE_CONTENT_TYPE) {
      throw new WhiteboardHttpError(
        `Agent scene writes must use ${AGENT_UPDATE_CONTENT_TYPE}.`,
        415,
        "WHITEBOARD_AGENT_CONTENT_TYPE_INVALID"
      );
    }
    operationId = normalizeAgentOperationId(
      request.headers.get("X-Whiteboard-Operation-Id")
    );
    body = await readBoundedBytes(request, MAX_AGENT_SCENE_BYTES);
    if (body.byteLength === 0) {
      throw new WhiteboardHttpError(
        "Agent scene update is empty.",
        422,
        "WHITEBOARD_AGENT_UPDATE_INVALID"
      );
    }
    await consumeAgentWhiteboardByteBudget(
      env,
      principal.tokenId,
      ip.ipHash,
      body.byteLength
    );
    headers.set(INTERNAL_HEADERS.agentOperationId, operationId);
    headers.set("Content-Type", AGENT_UPDATE_CONTENT_TYPE);
    headers.set("Content-Length", String(body.byteLength));
  }

  const stub = whiteboardRoomStub(env, claims.rid);
  const upstream = await stub.fetch(new Request(
    "https://whiteboard.internal/agent-scene",
    { method, headers, body }
  ));
  if (method === "GET") {
    if (!upstream.ok) {
      return safeUpstreamJson(upstream, "WHITEBOARD_AGENT_SCENE_READ_FAILED");
    }
    return safeAgentSceneResponse(upstream);
  }
  const response = await safeUpstreamJson(
    upstream,
    "WHITEBOARD_AGENT_SCENE_WRITE_FAILED"
  );
  if (response.ok) {
    await recordWhiteboardAgentWriteAudit(env, principal, claims.rid, operationId);
  }
  return response;
}

async function handlePublicWhiteboardApi(context, parts, identity) {
  const { request } = context;

  if (
    request.method === "POST"
    && parts.length === 2
    && parts[0] === "rooms"
    && parts[1] === "join"
  ) {
    assertExactOrigin(request);
    const body = await readBoundedJson(request);
    return joinWhiteboardRoom(context, identity, body);
  }

  if (
    request.method === "POST"
    && parts.length === 2
    && parts[0] === "rooms"
    && parts[1] === "reconnect"
  ) {
    assertExactOrigin(request);
    const body = await readBoundedJson(request);
    return reconnectWhiteboardRoom(context, identity, body);
  }

  if (
    request.method === "GET"
    && parts.length === 1
    && parts[0] === "realtime"
  ) {
    return connectWhiteboardRealtime(context, identity);
  }

  if (
    request.method === "POST"
    && parts.length === 1
    && parts[0] === "assets"
  ) {
    assertExactOrigin(request);
    return proxyWhiteboardAssetUpload(context, identity);
  }

  if (
    request.method === "GET"
    && parts[0] === "assets"
    && parts.length <= 2
  ) {
    assertTrustedSameOriginRead(request);
    const assetId = parts[1] || new URL(request.url).searchParams.get("assetId");
    return proxyWhiteboardAssetDownload(context, identity, assetId);
  }

  return whiteboardJson({
    error: "未找到在线画板接口。",
    code: "WHITEBOARD_NOT_FOUND"
  }, 404);
}

async function joinWhiteboardRoom(context, identity, body) {
  assertPlainObject(body);
  const roomType = normalizeRoomType(body.type);
  const ip = await whiteboardIpContext(context.request, context.env);
  await consumeJoinAttempt(context.env, ip.ipHash, roomType);

  let roomId = PUBLIC_ROOM_ID;
  if (roomType === PRIVATE_ROOM_TYPE) {
    if (typeof body.password !== "string") {
      throw joinFailedError();
    }
    roomId = await derivePrivateWhiteboardRoomId(
      body.password,
      requiredSecret(context.env, "WHITEBOARD_ROOM_HMAC_SECRET")
    );
  }

  assertRealtimeBindings(context.env);
  if (roomType === PUBLIC_ROOM_TYPE) {
    await ensureRoomMetadata(context.env, roomId, roomType);
  }
  const credentials = await issueRoomCredentials(
    context.env,
    identity,
    roomId,
    roomType
  );
  return whiteboardJson(roomCredentialResponse(identity, roomType, credentials));
}

async function reconnectWhiteboardRoom(context, identity, body) {
  assertPlainObject(body);
  const accessToken = accessTokenFromRequest(context.request, body);
  const claims = await verifyWhiteboardToken(
    accessToken,
    requiredSecret(context.env, "WHITEBOARD_TICKET_SECRET"),
    { expectedKind: "access" }
  );
  assertClaimsMatchIdentity(claims, identity);
  assertRealtimeBindings(context.env);

  const ip = await whiteboardIpContext(context.request, context.env);
  await consumeReconnectAttempt(context.env, ip.ipHash);
  if (claims.rt === PUBLIC_ROOM_TYPE) {
    await ensureRoomMetadata(context.env, claims.rid, claims.rt);
  }
  const credentials = await issueRoomCredentials(
    context.env,
    identity,
    claims.rid,
    claims.rt,
    {
      accessToken,
      accessExpiry: claims.exp
    }
  );
  return whiteboardJson(roomCredentialResponse(identity, claims.rt, credentials));
}

async function connectWhiteboardRealtime(context, identity) {
  const { request, env } = context;
  assertExactOrigin(request);
  if (String(request.headers.get("Upgrade") || "").toLowerCase() !== "websocket") {
    throw new WhiteboardHttpError(
      "实时连接请求无效。",
      426,
      "WHITEBOARD_WEBSOCKET_REQUIRED"
    );
  }
  assertRealtimeBindings(env);

  const { ticket } = parseWhiteboardProtocols(
    request.headers.get("Sec-WebSocket-Protocol")
  );
  const claims = await verifyWhiteboardToken(
    ticket,
    requiredSecret(env, "WHITEBOARD_TICKET_SECRET"),
    { expectedKind: "ws" }
  );
  assertClaimsMatchIdentity(claims, identity);
  const ip = await whiteboardIpContext(request, env);
  const stub = whiteboardRoomStub(env, claims.rid);
  const headers = internalRoomHeaders({
    env,
    request,
    identity,
    claims,
    ipHash: ip.ipHash
  });
  headers.set("Upgrade", "websocket");
  headers.set("Sec-WebSocket-Protocol", WS_PROTOCOL);

  const upstreamRequest = new Request("https://whiteboard.internal/realtime", {
    method: "GET",
    headers
  });
  const upstream = await stub.fetch(upstreamRequest);
  if (upstream.status !== 101) {
    return safeUpstreamJson(upstream, "WHITEBOARD_REALTIME_REJECTED");
  }

  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.set("Sec-WebSocket-Protocol", WS_PROTOCOL);
  return new Response(null, {
    status: 101,
    headers: responseHeaders,
    webSocket: upstream.webSocket
  });
}

async function proxyWhiteboardAssetUpload(context, identity) {
  const { request, env } = context;
  assertRealtimeBindings(env);
  const claims = await verifiedAccessClaims(request, env, identity);
  const contentType = normalizeAssetContentType(request.headers.get("Content-Type"));
  const ip = await whiteboardIpContext(request, env);
  await consumeUploadAttempt(env, ip.ipHash);
  const bytes = await readBoundedBytes(request, MAX_ASSET_BYTES);
  if (bytes.byteLength === 0) {
    throw new WhiteboardHttpError(
      "图片内容无效。",
      422,
      "WHITEBOARD_ASSET_INVALID"
    );
  }
  await consumeUploadByteBudget(env, ip.ipHash, bytes.byteLength);

  const headers = internalRoomHeaders({
    env,
    request,
    identity,
    claims,
    ipHash: ip.ipHash
  });
  headers.set("Content-Type", contentType);
  headers.set("Content-Length", String(bytes.byteLength));
  const stub = whiteboardRoomStub(env, claims.rid);
  const upstream = await stub.fetch(new Request("https://whiteboard.internal/assets", {
    method: "POST",
    headers,
    body: bytes
  }));
  return safeUpstreamJson(upstream, "WHITEBOARD_ASSET_UPLOAD_FAILED");
}

async function proxyWhiteboardAssetDownload(context, identity, value) {
  const { request, env } = context;
  assertRealtimeBindings(env);
  const assetId = normalizeAssetId(value);
  const claims = await verifiedAccessClaims(request, env, identity);
  const ip = await whiteboardIpContext(request, env);
  const headers = internalRoomHeaders({
    env,
    request,
    identity,
    claims,
    ipHash: ip.ipHash
  });
  const stub = whiteboardRoomStub(env, claims.rid);
  const upstream = await stub.fetch(new Request(
    `https://whiteboard.internal/assets/${encodeURIComponent(assetId)}`,
    { method: "GET", headers }
  ));
  return safeAssetResponse(upstream);
}

async function handleAdminWhiteboardApi(context, parts, adminUser) {
  const { request, env } = context;
  if (request.method === "GET") {
    assertTrustedSameOriginRead(request);
  } else {
    assertExactOrigin(request);
  }

  if (
    request.method === "GET"
    && parts.length === 1
    && parts[0] === "overview"
  ) {
    return whiteboardJson(await adminWhiteboardOverview(env));
  }

  if (
    request.method === "GET"
    && parts.length === 1
    && parts[0] === "rooms"
  ) {
    return whiteboardJson(await adminWhiteboardRooms(env, new URL(request.url)));
  }

  if (
    request.method === "POST"
    && parts.length === 2
    && parts[0] === "public"
    && parts[1] === "clear"
  ) {
    assertRealtimeBindings(env);
    await ensureRoomMetadata(env, PUBLIC_ROOM_ID, PUBLIC_ROOM_TYPE);
    return performAdminRoomAction(
      context,
      PUBLIC_ROOM_ID,
      PUBLIC_ROOM_TYPE,
      { action: "clear" },
      adminUser,
      "public-clear"
    );
  }

  if (
    request.method === "PUT"
    && parts.length === 2
    && parts[0] === "public"
    && parts[1] === "lock"
  ) {
    const body = await readBoundedJson(request);
    assertPlainObject(body);
    if (typeof body.locked !== "boolean") {
      throw new WhiteboardHttpError(
        "锁定状态无效。",
        422,
        "WHITEBOARD_LOCK_STATE_INVALID"
      );
    }
    assertRealtimeBindings(env);
    await ensureRoomMetadata(env, PUBLIC_ROOM_ID, PUBLIC_ROOM_TYPE);
    const response = await performAdminRoomAction(
      context,
      PUBLIC_ROOM_ID,
      PUBLIC_ROOM_TYPE,
      { action: "set-lock", locked: body.locked },
      adminUser,
      body.locked ? "public-lock" : "public-unlock"
    );
    if (response.ok) {
      await env.DB.prepare(`
        update whiteboard_rooms
        set is_locked = ?, updated_at = ?
        where room_id = ?
      `).bind(body.locked ? 1 : 0, new Date().toISOString(), PUBLIC_ROOM_ID).run();
    }
    return response;
  }

  if (
    request.method === "GET"
    && parts.length === 3
    && parts[0] === "rooms"
    && parts[2] === "status"
  ) {
    assertRealtimeBindings(env);
    const room = await adminRoomRecord(env, parts[1]);
    return performAdminRoomAction(
      context,
      room.room_id,
      room.room_type,
      { action: "status" },
      adminUser,
      ""
    );
  }

  if (
    request.method === "DELETE"
    && parts.length === 2
    && parts[0] === "rooms"
  ) {
    assertRealtimeBindings(env);
    const room = await adminRoomRecord(env, parts[1]);
    if (room.room_type === PUBLIC_ROOM_TYPE) {
      throw new WhiteboardHttpError(
        "公共画板不能删除。",
        409,
        "WHITEBOARD_PUBLIC_DELETE_FORBIDDEN"
      );
    }
    const response = await performAdminRoomAction(
      context,
      room.room_id,
      room.room_type,
      { action: "delete-room" },
      adminUser,
      "room-delete"
    );
    if (response.ok) {
      const now = new Date().toISOString();
      await env.DB.batch([
        env.DB.prepare(`
          update whiteboard_rooms
          set status = 'deleting', updated_at = ?
          where room_id = ?
        `).bind(now, room.room_id),
        env.DB.prepare(`
          update whiteboard_bans
          set active = 0, updated_at = ?
          where room_id = ? and active = 1
        `).bind(now, room.room_id)
      ]);
    }
    return response;
  }

  if (
    request.method === "POST"
    && parts.length === 3
    && parts[0] === "rooms"
    && parts[2] === "kick"
  ) {
    const room = await adminRoomRecord(env, parts[1]);
    const body = await readBoundedJson(request);
    assertPlainObject(body);
    const connectionId = optionalConnectionId(body.connectionId);
    const anonymousId = optionalAnonymousId(body.anonymousId);
    if (!connectionId && !anonymousId) {
      throw new WhiteboardHttpError(
        "需要指定要移除的连接或匿名身份。",
        422,
        "WHITEBOARD_KICK_TARGET_INVALID"
      );
    }
    assertRealtimeBindings(env);
    return performAdminRoomAction(
      context,
      room.room_id,
      room.room_type,
      { action: "kick", connectionId, anonymousId },
      adminUser,
      "connection-kick"
    );
  }

  if (
    request.method === "POST"
    && parts.length === 3
    && parts[0] === "rooms"
    && parts[2] === "ban"
  ) {
    const room = await adminRoomRecord(env, parts[1]);
    const body = await readBoundedJson(request);
    const ban = normalizeAdminBan(body);
    assertRealtimeBindings(env);
    const response = await performAdminRoomAction(
      context,
      room.room_id,
      room.room_type,
      {
        action: "ban",
        kind: ban.kind,
        key: ban.key,
        durationSeconds: ban.durationSeconds
      },
      adminUser,
      "room-ban"
    );
    if (response.ok) {
      await persistAdminWhiteboardBan(env, room.room_id, ban, adminUser);
    }
    return response;
  }

  return whiteboardJson({
    error: "未找到在线画板管理接口。",
    code: "WHITEBOARD_ADMIN_NOT_FOUND"
  }, 404);
}

async function performAdminRoomAction(
  context,
  roomId,
  roomType,
  action,
  adminUser,
  auditAction
) {
  const { request, env } = context;
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    [INTERNAL_HEADERS.secret]: requiredSecret(env, "WHITEBOARD_INTERNAL_SECRET"),
    [INTERNAL_HEADERS.roomId]: roomId,
    [INTERNAL_HEADERS.roomType]: roomType,
    [INTERNAL_HEADERS.clientOrigin]: new URL(request.url).origin,
    [INTERNAL_HEADERS.adminAuthorized]: "1",
    [INTERNAL_HEADERS.adminUserId]: adminActorId(adminUser)
  });
  const stub = whiteboardRoomStub(env, roomId);
  const upstream = await stub.fetch(new Request("https://whiteboard.internal/admin", {
    method: "POST",
    headers,
    body: JSON.stringify(action)
  }));
  const response = await safeUpstreamJson(upstream, "WHITEBOARD_ADMIN_ACTION_FAILED");
  if (response.ok && auditAction) {
    await recordWhiteboardAudit(
      env,
      adminUser,
      auditAction,
      roomId,
      safeAuditDetails(action)
    );
  }
  return response;
}

export function normalizeWhiteboardPassword(value) {
  if (typeof value !== "string") {
    throw joinFailedError();
  }
  const normalized = value.normalize("NFKC").trim();
  const length = Array.from(normalized).length;
  if (
    length < 4
    || length > 128
    || /\p{Cc}/u.test(normalized)
  ) {
    throw joinFailedError();
  }
  return normalized;
}

export async function derivePrivateWhiteboardRoomId(password, secret) {
  const normalized = normalizeWhiteboardPassword(password);
  assertSecretValue(secret);
  const signature = await hmacSha256(
    secret,
    `lusu:whiteboard:room:v1\u0000${normalized}`
  );
  return `wb_${base64UrlEncode(signature)}`;
}

/**
 * Produces an opaque encrypted envelope plus an independent HMAC signature.
 * The room identifier is therefore not exposed by merely decoding the token.
 */
export async function signWhiteboardToken(payload, secret) {
  assertSecretValue(secret);
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  if (plaintext.byteLength > MAX_JSON_BYTES) {
    throw new WhiteboardHttpError(
      "画板凭证内容无效。",
      500,
      "WHITEBOARD_TOKEN_PAYLOAD_INVALID"
    );
  }
  const iv = randomBytes(12);
  const encryptionKey = await tokenEncryptionKey(secret);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: new TextEncoder().encode("lusu:whiteboard:token:v1"),
      tagLength: 128
    },
    encryptionKey,
    plaintext
  ));
  const ivText = base64UrlEncode(iv);
  const ciphertextText = base64UrlEncode(ciphertext);
  const signingInput = `${TOKEN_PREFIX}.${ivText}.${ciphertextText}`;
  const signature = await hmacSha256(
    await tokenSigningMaterial(secret),
    `lusu:whiteboard:token-signature:v1\u0000${signingInput}`
  );
  return `${signingInput}.${base64UrlEncode(signature)}`;
}

export async function verifyWhiteboardToken(
  token,
  secret,
  { expectedKind = "", now = Date.now() } = {}
) {
  assertSecretValue(secret);
  const value = String(token || "");
  if (!value || value.length > MAX_TOKEN_CHARS) {
    throw accessDeniedError();
  }
  const parts = value.split(".");
  if (
    parts.length !== 4
    || parts[0] !== TOKEN_PREFIX
    || !parts.slice(1).every((part) => /^[A-Za-z0-9_-]+$/.test(part))
  ) {
    throw accessDeniedError();
  }

  const signingInput = parts.slice(0, 3).join(".");
  let signature;
  let iv;
  let ciphertext;
  try {
    signature = base64UrlDecode(parts[3]);
    iv = base64UrlDecode(parts[1]);
    ciphertext = base64UrlDecode(parts[2]);
  } catch {
    throw accessDeniedError();
  }
  if (signature.byteLength !== 32 || iv.byteLength !== 12 || ciphertext.byteLength < 17) {
    throw accessDeniedError();
  }

  const signingKey = await crypto.subtle.importKey(
    "raw",
    await tokenSigningMaterial(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const signatureValid = await crypto.subtle.verify(
    "HMAC",
    signingKey,
    signature,
    new TextEncoder().encode(
      `lusu:whiteboard:token-signature:v1\u0000${signingInput}`
    )
  );
  if (!signatureValid) throw accessDeniedError();

  let payload;
  try {
    const plaintext = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv,
        additionalData: new TextEncoder().encode("lusu:whiteboard:token:v1"),
        tagLength: 128
      },
      await tokenEncryptionKey(secret),
      ciphertext
    );
    payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(plaintext));
  } catch {
    throw accessDeniedError();
  }
  return validateTokenClaims(payload, expectedKind, now);
}

export function parseWhiteboardProtocols(value) {
  const raw = String(value || "");
  if (!raw || raw.length > MAX_PROTOCOL_HEADER_CHARS) {
    throw accessDeniedError();
  }
  const protocols = raw.split(",").map((item) => item.trim()).filter(Boolean);
  const tickets = protocols.filter((protocol) => protocol.startsWith(`${TOKEN_PREFIX}.`));
  const unexpected = protocols.filter((
    protocol
  ) => protocol !== WS_PROTOCOL && !protocol.startsWith(`${TOKEN_PREFIX}.`));
  if (
    !protocols.includes(WS_PROTOCOL)
    || tickets.length !== 1
    || unexpected.length > 0
    || protocols.length !== 2
  ) {
    throw accessDeniedError();
  }
  return { protocol: WS_PROTOCOL, ticket: tickets[0] };
}

export async function deriveWhiteboardIpHash(ip, secret) {
  assertSecretValue(secret);
  const normalized = String(ip || "").trim().slice(0, 160) || "unknown";
  const digest = await hmacSha256(
    secret,
    `lusu:whiteboard:ip:v1\u0000${normalized}`
  );
  return hexEncode(digest);
}

async function issueRoomCredentials(
  env,
  identity,
  roomId,
  roomType,
  existingAccess = null
) {
  const secret = requiredSecret(env, "WHITEBOARD_TICKET_SECRET");
  const now = Math.floor(Date.now() / 1000);
  const ticketExpiry = now + TICKET_LIFETIME_SECONDS;
  const accessExpiry = existingAccess
    ? Number(existingAccess.accessExpiry)
    : now + ACCESS_LIFETIME_SECONDS;
  const common = {
    v: TOKEN_VERSION,
    aud: TOKEN_AUDIENCE,
    rid: roomId,
    rt: roomType,
    sub: identity.anonymousId,
    iv: identity.version,
    iat: now
  };
  const ticket = await signWhiteboardToken({
    ...common,
    kind: "ws",
    exp: ticketExpiry,
    jti: randomToken(18)
  }, secret);
  const accessToken = existingAccess
    ? existingAccess.accessToken
    : await signWhiteboardToken({
      ...common,
      kind: "access",
      exp: accessExpiry,
      jti: randomToken(18)
    }, secret);
  return {
    ticket,
    accessToken,
    ticketExpiresAt: new Date(ticketExpiry * 1000).toISOString(),
    accessExpiresAt: new Date(accessExpiry * 1000).toISOString()
  };
}

async function issueAgentRoomCredential(
  env,
  principal,
  roomId,
  roomType
) {
  const now = Math.floor(Date.now() / 1000);
  const bearerExpiry = Math.floor(Date.parse(principal.expiresAt) / 1000);
  const accessExpiry = Math.min(now + ACCESS_LIFETIME_SECONDS, bearerExpiry);
  if (!Number.isInteger(accessExpiry) || accessExpiry <= now) {
    throw accessDeniedError();
  }
  const accessToken = await signWhiteboardToken({
    v: TOKEN_VERSION,
    aud: TOKEN_AUDIENCE,
    kind: AGENT_ACCESS_KIND,
    rid: roomId,
    rt: roomType,
    tid: principal.tokenId,
    iat: now,
    exp: accessExpiry,
    jti: randomToken(18)
  }, requiredSecret(env, "WHITEBOARD_TICKET_SECRET"));
  return {
    accessToken,
    accessExpiresAt: new Date(accessExpiry * 1000).toISOString()
  };
}

function roomCredentialResponse(identity, roomType, credentials) {
  return {
    identity: publicAnonymousIdentity(identity),
    room: { type: roomType },
    wsUrl: "/api/whiteboard/realtime",
    wsProtocol: WS_PROTOCOL,
    ticket: credentials.ticket,
    accessToken: credentials.accessToken,
    ticketExpiresAt: credentials.ticketExpiresAt,
    accessExpiresAt: credentials.accessExpiresAt
  };
}

function validateTokenClaims(value, expectedKind, nowMs) {
  if (!isPlainObject(value)) throw accessDeniedError();
  const now = Math.floor(Number(nowMs) / 1000);
  const kind = value.kind;
  const maximumLifetime = kind === "ws"
    ? 5 * 60
    : kind === "access" || kind === AGENT_ACCESS_KIND
      ? 24 * 60 * 60
      : 0;
  const browserCredential = kind === "ws" || kind === "access";
  const agentCredential = kind === AGENT_ACCESS_KIND;
  if (
    value.v !== TOKEN_VERSION
    || value.aud !== TOKEN_AUDIENCE
    || (!browserCredential && !agentCredential)
    || (expectedKind && kind !== expectedKind)
    || !isValidRoomId(value.rid)
    || ![PUBLIC_ROOM_TYPE, PRIVATE_ROOM_TYPE].includes(value.rt)
    || (value.rid === PUBLIC_ROOM_ID) !== (value.rt === PUBLIC_ROOM_TYPE)
    || (browserCredential && !ANONYMOUS_ID_PATTERN.test(String(value.sub || "")))
    || (browserCredential && (!Number.isInteger(value.iv) || value.iv < 1))
    || (agentCredential && !AGENT_TOKEN_ID_PATTERN.test(String(value.tid || "")))
    || !Number.isInteger(value.iat)
    || !Number.isInteger(value.exp)
    || value.iat > now + CLOCK_SKEW_SECONDS
    || value.exp <= now
    || value.exp - value.iat <= 0
    || value.exp - value.iat > maximumLifetime
    || !/^[A-Za-z0-9_-]{16,80}$/.test(String(value.jti || ""))
  ) {
    throw accessDeniedError();
  }
  return Object.freeze({
    v: TOKEN_VERSION,
    kind,
    rid: value.rid,
    rt: value.rt,
    ...(browserCredential ? { sub: value.sub, iv: value.iv } : {}),
    ...(agentCredential ? { tid: value.tid } : {}),
    iat: value.iat,
    exp: value.exp,
    jti: value.jti
  });
}

function agentAccessTokenFromRequest(request) {
  const token = String(
    request.headers.get("X-Whiteboard-Access-Token") || ""
  ).trim();
  if (!token || token.length > MAX_TOKEN_CHARS || /\s/.test(token)) {
    throw accessDeniedError();
  }
  return token;
}

async function verifiedAccessClaims(request, env, identity) {
  const token = accessTokenFromRequest(request);
  const claims = await verifyWhiteboardToken(
    token,
    requiredSecret(env, "WHITEBOARD_TICKET_SECRET"),
    { expectedKind: "access" }
  );
  assertClaimsMatchIdentity(claims, identity);
  return claims;
}

function assertClaimsMatchIdentity(claims, identity) {
  if (!identity || claims.sub !== identity.anonymousId) {
    throw accessDeniedError();
  }
}

function accessTokenFromRequest(request, body = null) {
  const direct = String(request.headers.get("X-Whiteboard-Access-Token") || "").trim();
  const authorization = String(request.headers.get("Authorization") || "").trim();
  const bearer = /^Bearer ([^\s]+)$/i.exec(authorization)?.[1] || "";
  const bodyToken = isPlainObject(body) && typeof body.accessToken === "string"
    ? body.accessToken.trim()
    : "";
  const supplied = [direct, bearer, bodyToken].filter(Boolean);
  if (
    supplied.length === 0
    || supplied.some((value) => value.length > MAX_TOKEN_CHARS)
    || new Set(supplied).size !== 1
  ) {
    throw accessDeniedError();
  }
  return supplied[0];
}

async function authenticateWhiteboardAgent(request, env, capability) {
  let principal;
  try {
    principal = await authenticateAgentBearer(request, env);
  } catch (error) {
    const status = Number.isInteger(error?.status) ? error.status : 500;
    throw new WhiteboardHttpError(
      status >= 500
        ? "Agent authorization is temporarily unavailable."
        : String(error?.message || "Agent access token is invalid."),
      status,
      typeof error?.code === "string"
        ? error.code
        : "WHITEBOARD_AGENT_AUTH_FAILED",
      Number(error?.retryAfter || 0)
    );
  }
  const scopes = Array.isArray(principal.scopes) ? principal.scopes : [];
  const hasWrite = scopes.includes("whiteboard:write")
    || scopes.includes("whiteboard:*");
  const hasRead = hasWrite || scopes.includes("whiteboard:read");
  const granted = capability === "write" ? hasWrite : hasRead;
  if (!granted) {
    throw new WhiteboardHttpError(
      `Agent access token is missing required scope: whiteboard:${capability === "write" ? "write" : "read"}.`,
      403,
      "AGENT_SCOPE_REQUIRED"
    );
  }
  return principal;
}

async function agentInternalRoomHeaders({ env, claims, principal, ipHash }) {
  const subjectDigest = new Uint8Array(await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(
      `lusu:whiteboard:agent-subject:v1\u0000${principal.tokenId}`
    )
  ));
  return new Headers({
    [INTERNAL_HEADERS.secret]: requiredSecret(env, "WHITEBOARD_INTERNAL_SECRET"),
    [INTERNAL_HEADERS.roomId]: claims.rid,
    [INTERNAL_HEADERS.roomType]: claims.rt,
    [INTERNAL_HEADERS.ipHash]: ipHash,
    [INTERNAL_HEADERS.agentAuthorized]: "1",
    [INTERNAL_HEADERS.agentSubject]: hexEncode(subjectDigest)
  });
}

function internalRoomHeaders({ env, request, identity, claims, ipHash }) {
  return new Headers({
    [INTERNAL_HEADERS.secret]: requiredSecret(env, "WHITEBOARD_INTERNAL_SECRET"),
    [INTERNAL_HEADERS.roomId]: claims.rid,
    [INTERNAL_HEADERS.roomType]: claims.rt,
    [INTERNAL_HEADERS.anonymousId]: identity.anonymousId,
    [INTERNAL_HEADERS.displayName]: base64UrlEncode(
      new TextEncoder().encode(identity.displayName)
    ),
    [INTERNAL_HEADERS.color]: identity.color,
    [INTERNAL_HEADERS.identityVersion]: String(identity.version),
    [INTERNAL_HEADERS.ipHash]: ipHash,
    [INTERNAL_HEADERS.ticketJti]: claims.jti,
    [INTERNAL_HEADERS.clientOrigin]: new URL(request.url).origin
  });
}

function normalizeAgentOperationId(value) {
  const operationId = String(value || "").trim();
  if (!AGENT_OPERATION_ID_PATTERN.test(operationId)) {
    throw new WhiteboardHttpError(
      "Agent operation id is invalid.",
      422,
      "WHITEBOARD_AGENT_OPERATION_ID_INVALID"
    );
  }
  return operationId;
}

function whiteboardRoomStub(env, roomId) {
  assertRealtimeBindings(env);
  if (!isValidRoomId(roomId)) {
    throw accessDeniedError();
  }
  if (typeof env.WHITEBOARD_ROOMS.getByName === "function") {
    return env.WHITEBOARD_ROOMS.getByName(roomId);
  }
  if (
    typeof env.WHITEBOARD_ROOMS.idFromName === "function"
    && typeof env.WHITEBOARD_ROOMS.get === "function"
  ) {
    return env.WHITEBOARD_ROOMS.get(env.WHITEBOARD_ROOMS.idFromName(roomId));
  }
  throw new WhiteboardHttpError(
    "在线画板服务暂时不可用。",
    503,
    "WHITEBOARD_REALTIME_UNAVAILABLE"
  );
}

async function whiteboardIpContext(request, env) {
  const salt = requiredSecret(env, "WHITEBOARD_IP_HASH_SALT");
  for (const otherName of [
    "CHAT_IP_HASH_SALT",
    "ANALYTICS_IP_HASH_SALT",
    "WHITEBOARD_ROOM_HMAC_SECRET",
    "WHITEBOARD_TICKET_SECRET",
    "WHITEBOARD_INTERNAL_SECRET"
  ]) {
    const other = String(env?.[otherName] || "");
    if (other && other === salt) {
      throw new WhiteboardHttpError(
        "在线画板服务暂时不可用。",
        503,
        "WHITEBOARD_SECRET_CONFIGURATION_INVALID"
      );
    }
  }
  const rawIp = String(
    request.headers.get("CF-Connecting-IP")
    || request.headers.get("X-Forwarded-For")?.split(",")[0]
    || "unknown"
  ).trim();
  return {
    ipHash: await deriveWhiteboardIpHash(rawIp, salt),
    keyId: await whiteboardIpHashKeyId(salt)
  };
}

async function whiteboardIpHashKeyId(secret) {
  const digest = new Uint8Array(await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`lusu:whiteboard:ip-key:v1\u0000${secret}`)
  ));
  return hexEncode(digest).slice(0, 16);
}

async function consumeJoinAttempt(env, ipHash, roomType) {
  const policies = [
    {
      scope: "whiteboard:join:ip:minute",
      limit: roomType === PRIVATE_ROOM_TYPE ? 8 : 20,
      windowMs: 60_000,
      backoffMs: 60_000,
      maxBackoffMs: 15 * 60_000
    },
    {
      scope: "whiteboard:join:ip:hour",
      limit: roomType === PRIVATE_ROOM_TYPE ? 40 : 240,
      windowMs: 60 * 60_000,
      backoffMs: 5 * 60_000,
      maxBackoffMs: 60 * 60_000
    }
  ];
  for (const policy of policies) {
    const bucketKey = await rateLimitBucketKey(policy.scope, ipHash);
    const result = await consumeRateLimit(env, bucketKey, policy);
    if (!result.allowed) {
      throw new WhiteboardHttpError(
        "进入画板的尝试过于频繁，请稍后再试。",
        429,
        "WHITEBOARD_JOIN_RATE_LIMITED",
        result.retryAfterSeconds
      );
    }
  }
}

async function consumeReconnectAttempt(env, ipHash) {
  const result = await consumeRateLimit(
    env,
    await rateLimitBucketKey("whiteboard:reconnect:ip:minute", ipHash),
    {
      limit: 60,
      windowMs: 60_000,
      backoffMs: 30_000,
      maxBackoffMs: 10 * 60_000
    }
  );
  if (!result.allowed) {
    throw new WhiteboardHttpError(
      "重新连接过于频繁，请稍后再试。",
      429,
      "WHITEBOARD_RECONNECT_RATE_LIMITED",
      result.retryAfterSeconds
    );
  }
}

async function consumeUploadAttempt(env, ipHash) {
  const policies = [
    {
      scope: "whiteboard:upload:ip:minute",
      limit: 20,
      windowMs: 60_000,
      backoffMs: 60_000,
      maxBackoffMs: 15 * 60_000
    },
    {
      scope: "whiteboard:upload:ip:hour",
      limit: 200,
      windowMs: 60 * 60_000,
      backoffMs: 5 * 60_000,
      maxBackoffMs: 60 * 60_000
    }
  ];
  for (const policy of policies) {
    const result = await consumeRateLimit(
      env,
      await rateLimitBucketKey(policy.scope, ipHash),
      policy
    );
    if (!result.allowed) {
      throw new WhiteboardHttpError(
        "图片上传过于频繁，请稍后再试。",
        429,
        "WHITEBOARD_UPLOAD_RATE_LIMITED",
        result.retryAfterSeconds
      );
    }
  }
}

async function consumeUploadByteBudget(env, ipHash, byteLength) {
  const policies = [
    {
      scope: "whiteboard:upload-bytes:ip:minute",
      limit: 50 * 1024 * 1024,
      windowMs: 60_000,
      backoffMs: 60_000,
      maxBackoffMs: 15 * 60_000
    },
    {
      scope: "whiteboard:upload-bytes:ip:hour",
      limit: 250 * 1024 * 1024,
      windowMs: 60 * 60_000,
      backoffMs: 5 * 60_000,
      maxBackoffMs: 60 * 60_000
    }
  ];
  for (const policy of policies) {
    const result = await consumeRateLimit(
      env,
      await rateLimitBucketKey(policy.scope, ipHash),
      policy,
      byteLength
    );
    if (!result.allowed) {
      throw new WhiteboardHttpError(
        "图片上传容量过高，请稍后再试。",
        429,
        "WHITEBOARD_UPLOAD_RATE_LIMITED",
        result.retryAfterSeconds
      );
    }
  }
}

async function consumeAgentWhiteboardAttempt(
  env,
  tokenId,
  ipHash,
  action
) {
  const policy = action === "write"
    ? { windowMs: 60_000, limit: 20, backoffMs: 60_000, maxBackoffMs: 30 * 60_000 }
    : action === "read"
      ? { windowMs: 60_000, limit: 60, backoffMs: 60_000, maxBackoffMs: 15 * 60_000 }
      : { windowMs: 10 * 60_000, limit: 30, backoffMs: 10 * 60_000, maxBackoffMs: 60 * 60_000 };
  const result = await consumeRateLimit(
    env,
    await rateLimitBucketKey(
      `whiteboard:agent:${action}:token-ip`,
      `${tokenId}\u0000${ipHash}`
    ),
    policy
  );
  if (!result.allowed) {
    throw new WhiteboardHttpError(
      "Agent whiteboard request rate limit exceeded.",
      429,
      "WHITEBOARD_AGENT_RATE_LIMITED",
      result.retryAfterSeconds
    );
  }
}

async function consumeAgentWhiteboardByteBudget(
  env,
  tokenId,
  ipHash,
  byteLength
) {
  const result = await consumeRateLimit(
    env,
    await rateLimitBucketKey(
      "whiteboard:agent:write-bytes:token-ip",
      `${tokenId}\u0000${ipHash}`
    ),
    {
      windowMs: 60_000,
      limit: 4 * 1024 * 1024,
      backoffMs: 60_000,
      maxBackoffMs: 30 * 60_000
    },
    byteLength
  );
  if (!result.allowed) {
    throw new WhiteboardHttpError(
      "Agent whiteboard byte budget exceeded.",
      429,
      "WHITEBOARD_AGENT_RATE_LIMITED",
      result.retryAfterSeconds
    );
  }
}

async function rateLimitBucketKey(scope, identity) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${scope}\u0000${identity}`)
  );
  return `rl_${hexEncode(new Uint8Array(digest))}`;
}

async function consumeRateLimit(env, bucketKey, policy, weight = 1) {
  const now = Date.now();
  const windowMs = Math.max(1000, Number(policy.windowMs) || 60_000);
  const limit = Math.max(1, Number(policy.limit) || 1);
  const increment = Math.max(1, Math.floor(Number(weight) || 1));
  const backoffMs = Math.max(1000, Number(policy.backoffMs) || windowMs);
  const maxBackoffMs = Math.max(backoffMs, Number(policy.maxBackoffMs) || backoffMs);
  const resetBefore = now - windowMs;
  const row = await env.DB.prepare(`
    insert into api_rate_limits (
      bucket_key, window_started_at, request_count, blocked_until, updated_at
    ) values (?, ?, ?, 0, ?)
    on conflict(bucket_key) do update set
      window_started_at = case
        when api_rate_limits.window_started_at <= ? then excluded.window_started_at
        else api_rate_limits.window_started_at
      end,
      request_count = case
        when api_rate_limits.window_started_at <= ? then excluded.request_count
        else api_rate_limits.request_count + excluded.request_count
      end,
      blocked_until = case
        when api_rate_limits.window_started_at <= ? then 0
        when api_rate_limits.blocked_until > ? then api_rate_limits.blocked_until
        when api_rate_limits.request_count + excluded.request_count > ? then
          ? + min(?, ? * (1 << min(api_rate_limits.request_count + excluded.request_count - ?, 4)))
        else 0
      end,
      updated_at = excluded.updated_at
    returning request_count, blocked_until
  `).bind(
    bucketKey,
    now,
    increment,
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

async function ensureRoomMetadata(env, roomId, roomType) {
  const now = new Date().toISOString();
  await env.DB.prepare(`
    insert into whiteboard_rooms (
      room_id, room_type, created_at, last_active_at, empty_since, delete_at,
      online_count, document_version, snapshot_version, is_locked,
      resource_usage, resource_bytes, resource_count, object_count,
      status, epoch, updated_at, last_error
    ) values (?, ?, ?, ?, null, null, 0, 0, 0, 0, ?, 0, 0, 0, 'active', 1, ?, '')
    on conflict(room_id) do nothing
  `).bind(roomId, roomType, now, now, '{"bytes":0,"images":0}', now).run();
}

async function adminWhiteboardOverview(env) {
  const summary = await env.DB.prepare(`
    select
      count(*) as room_count,
      sum(case when room_type = 'private' then 1 else 0 end) as private_room_count,
      sum(case when status = 'active' then 1 else 0 end) as active_room_count,
      coalesce(sum(online_count), 0) as connection_count,
      coalesce(sum(resource_bytes), 0) as resource_bytes,
      coalesce(sum(resource_count), 0) as resource_count,
      coalesce(sum(object_count), 0) as object_count,
      coalesce(sum(case when last_error <> '' then 1 else 0 end), 0) as error_room_count
    from whiteboard_rooms
  `).first();
  const publicRoom = await env.DB.prepare(`
    select *
    from whiteboard_rooms
    where room_id = ?
  `).bind(PUBLIC_ROOM_ID).first();
  const activeBans = await env.DB.prepare(`
    select count(*) as count
    from whiteboard_bans
    where active = 1 and expires_at > ?
  `).bind(new Date().toISOString()).first();
  const metricRows = await env.DB.prepare(`
    select metric_key, metric_value
    from whiteboard_metrics
    where metric_key in ('error_count', 'cleaned_room_count')
  `).all();
  const metrics = new Map(
    (metricRows?.results || []).map((row) => [
      String(row.metric_key || ""),
      Number(row.metric_value || 0)
    ])
  );
  return {
    summary: {
      roomCount: Number(summary?.room_count || 0),
      privateRoomCount: Number(summary?.private_room_count || 0),
      activeRoomCount: Number(summary?.active_room_count || 0),
      connectionCount: Number(summary?.connection_count || 0),
      resourceBytes: Number(summary?.resource_bytes || 0),
      resourceCount: Number(summary?.resource_count || 0),
      objectCount: Number(summary?.object_count || 0),
      activeBanCount: Number(activeBans?.count || 0),
      errorRoomCount: Number(summary?.error_room_count || 0),
      errorCount: metrics.get("error_count") || 0,
      cleanedRoomCount: metrics.get("cleaned_room_count") || 0
    },
    publicRoom: publicRoom ? publicAdminRoom(publicRoom) : null
  };
}

async function adminWhiteboardRooms(env, url) {
  const limit = boundedInteger(url.searchParams.get("limit"), 1, MAX_ADMIN_PAGE, 50);
  const offset = boundedInteger(
    url.searchParams.get("offset"),
    0,
    MAX_ADMIN_OFFSET,
    0
  );
  const roomTypeValue = String(url.searchParams.get("type") || "").trim();
  const statusValue = String(url.searchParams.get("status") || "").trim();
  const roomType = roomTypeValue
    ? normalizeRoomType(roomTypeValue)
    : "";
  if (statusValue && !["active", "empty", "deleting", "error"].includes(statusValue)) {
    throw new WhiteboardHttpError(
      "房间状态筛选无效。",
      422,
      "WHITEBOARD_ADMIN_FILTER_INVALID"
    );
  }

  const clauses = [];
  const bindings = [];
  if (roomType) {
    clauses.push("room_type = ?");
    bindings.push(roomType);
  }
  if (statusValue) {
    clauses.push("status = ?");
    bindings.push(statusValue);
  }
  const where = clauses.length ? `where ${clauses.join(" and ")}` : "";
  const result = await env.DB.prepare(`
    select *
    from whiteboard_rooms
    ${where}
    order by last_active_at desc, room_id asc
    limit ? offset ?
  `).bind(...bindings, limit + 1, offset).all();
  const rows = result.results || [];
  return {
    rooms: rows.slice(0, limit).map(publicAdminRoom),
    pagination: {
      limit,
      offset,
      hasMore: rows.length > limit,
      nextOffset: rows.length > limit ? offset + limit : null
    }
  };
}

async function adminRoomRecord(env, value) {
  const roomId = normalizeRoomId(value);
  const row = await env.DB.prepare(`
    select room_id, room_type, status
    from whiteboard_rooms
    where room_id = ?
  `).bind(roomId).first();
  if (!row || ![PUBLIC_ROOM_TYPE, PRIVATE_ROOM_TYPE].includes(row.room_type)) {
    throw new WhiteboardHttpError(
      "未找到该画板房间。",
      404,
      "WHITEBOARD_ROOM_NOT_FOUND"
    );
  }
  return row;
}

function publicAdminRoom(row) {
  return {
    roomId: row.room_id,
    roomType: row.room_type,
    createdAt: row.created_at,
    lastActiveAt: row.last_active_at,
    emptySince: row.empty_since || null,
    deleteAt: row.delete_at || null,
    onlineCount: Number(row.online_count || 0),
    documentVersion: Number(row.document_version || 0),
    snapshotVersion: Number(row.snapshot_version || 0),
    isLocked: Boolean(row.is_locked),
    resourceUsage: safeResourceUsage(row),
    objectCount: Number(row.object_count || 0),
    status: row.status || "active",
    epoch: Number(row.epoch || 1),
    updatedAt: row.updated_at,
    hasError: Boolean(row.last_error),
    lastError: String(row.last_error || "").slice(0, 80)
  };
}

function safeResourceUsage(row) {
  try {
    const parsed = JSON.parse(String(row.resource_usage || "{}"));
    return {
      bytes: Number.isFinite(Number(parsed.bytes))
        ? Math.max(0, Number(parsed.bytes))
        : Math.max(0, Number(row.resource_bytes || 0)),
      images: Number.isFinite(Number(parsed.images))
        ? Math.max(0, Number(parsed.images))
        : Math.max(0, Number(row.resource_count || 0))
    };
  } catch {
    return {
      bytes: Math.max(0, Number(row.resource_bytes || 0)),
      images: Math.max(0, Number(row.resource_count || 0))
    };
  }
}

async function recordWhiteboardAudit(env, adminUser, action, roomId, details) {
  const now = new Date().toISOString();
  await env.DB.prepare(`
    insert into whiteboard_admin_audit (
      audit_id, admin_user_id, action, room_id, target_type,
      target_key, details, created_at
    ) values (?, ?, ?, ?, 'room', ?, ?, ?)
  `).bind(
    `waud_${randomToken(18)}`,
    adminActorId(adminUser),
    action,
    roomId,
    roomId,
    JSON.stringify(details),
    now
  ).run();
}

async function recordWhiteboardAgentWriteAudit(
  env,
  principal,
  roomId,
  operationId
) {
  const eventDigest = new Uint8Array(await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(
      `lusu:whiteboard:agent-audit:v1\u0000${principal.tokenId}\u0000${roomId}\u0000${operationId}`
    )
  ));
  const roomDigest = new Uint8Array(await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`lusu:whiteboard:agent-room:v1\u0000${roomId}`)
  ));
  try {
    await env.DB.prepare(`
      insert or ignore into agent_audit_log (
        event_id, actor_user_id, token_id, action, target_type, target_id,
        scopes, result, created_at
      ) values (?, ?, ?, 'whiteboard-scene-applied', 'whiteboard-room', ?, ?, 'success', ?)
    `).bind(
      `waev_${hexEncode(eventDigest).slice(0, 48)}`,
      principal.user?.id || "",
      principal.tokenId,
      `wbar_${hexEncode(roomDigest).slice(0, 48)}`,
      JSON.stringify(
        [...new Set((principal.scopes || []).map((scope) => String(scope)))].sort()
      ),
      new Date().toISOString()
    ).run();
  } catch {
    console.error(JSON.stringify({
      message: "whiteboard agent audit write failed",
      action: "whiteboard-scene-applied"
    }));
  }
}

function safeAuditDetails(action) {
  if (action.action === "set-lock") {
    return { locked: Boolean(action.locked) };
  }
  if (action.action === "kick") {
    return {
      connectionTargeted: Boolean(action.connectionId),
      anonymousTargeted: Boolean(action.anonymousId)
    };
  }
  if (action.action === "ban") {
    return {
      kind: action.kind,
      durationSeconds: action.durationSeconds
    };
  }
  return { action: action.action };
}

function adminActorId(adminUser) {
  const value = String(
    adminUser?.id
    || adminUser?.userId
    || adminUser?.user_id
    || "admin"
  ).trim();
  return /^[A-Za-z0-9_-]{1,128}$/.test(value) ? value : "admin";
}

function normalizeAdminBan(value) {
  assertPlainObject(value);
  const kindValue = String(value.kind || value.subjectType || "").trim();
  const kind = kindValue === "anonymousId" || kindValue === "anonymous_id"
    ? "anonymousId"
    : kindValue === "ipHash" || kindValue === "ip_hash"
      ? "ipHash"
      : "";
  const key = String(value.key || value.subjectValue || "").trim();
  if (
    !kind
    || (kind === "anonymousId" && !ANONYMOUS_ID_PATTERN.test(key))
    || (kind === "ipHash" && !IP_HASH_PATTERN.test(key))
  ) {
    throw new WhiteboardHttpError(
      "封禁目标无效。",
      422,
      "WHITEBOARD_BAN_TARGET_INVALID"
    );
  }
  const durationSeconds = boundedInteger(
    value.durationSeconds,
    60,
    7 * 24 * 60 * 60,
    60 * 60
  );
  const reason = String(value.reason || "")
    .normalize("NFKC")
    .replace(/\p{Cc}/gu, "")
    .trim()
    .slice(0, 240);
  return { kind, key, durationSeconds, reason };
}

async function persistAdminWhiteboardBan(env, roomId, ban, adminUser) {
  const now = Date.now();
  const nowText = new Date(now).toISOString();
  const subjectType = ban.kind === "anonymousId" ? "anonymous_id" : "ip_hash";
  const ipHashKeyId = ban.kind === "ipHash"
    ? await whiteboardIpHashKeyId(requiredSecret(env, "WHITEBOARD_IP_HASH_SALT"))
    : "";
  await env.DB.batch([
    env.DB.prepare(`
      update whiteboard_bans
      set active = 0, updated_at = ?
      where active = 1 and expires_at <= ?
    `).bind(nowText, nowText),
    env.DB.prepare(`
      insert into whiteboard_bans (
        ban_id, room_id, subject_type, subject_value, ip_hash_key_id,
        reason, expires_at, active, created_by, created_at, updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
      on conflict(room_id, subject_type, subject_value) do update set
        ip_hash_key_id = excluded.ip_hash_key_id,
        reason = excluded.reason,
        expires_at = excluded.expires_at,
        active = 1,
        created_by = excluded.created_by,
        updated_at = excluded.updated_at
    `).bind(
      `wban_${randomToken(18)}`,
      roomId,
      subjectType,
      ban.key,
      ipHashKeyId,
      ban.reason,
      new Date(now + ban.durationSeconds * 1000).toISOString(),
      adminActorId(adminUser),
      nowText,
      nowText
    )
  ]);
}

async function ensureWhiteboardSchema(env) {
  if (!env?.DB || typeof env.DB.prepare !== "function") {
    throw new WhiteboardHttpError(
      "在线画板服务暂时不可用。",
      503,
      "WHITEBOARD_STORAGE_UNAVAILABLE"
    );
  }
  if (schemaPromises.has(env.DB)) {
    return schemaPromises.get(env.DB);
  }
  const promise = env.DB.batch([
    env.DB.prepare(`
      create table if not exists api_rate_limits (
        bucket_key text primary key,
        window_started_at integer not null,
        request_count integer not null default 0,
        blocked_until integer not null default 0,
        updated_at text not null
      )
    `),
    env.DB.prepare(`
      create table if not exists whiteboard_rooms (
        room_id text primary key,
        room_type text not null,
        created_at text not null,
        last_active_at text not null,
        empty_since text,
        delete_at text,
        online_count integer not null default 0,
        document_version integer not null default 0,
        snapshot_version integer not null default 0,
        is_locked integer not null default 0,
        resource_usage text not null default '{"bytes":0,"images":0}',
        resource_bytes integer not null default 0,
        resource_count integer not null default 0,
        object_count integer not null default 0,
        status text not null default 'active',
        epoch integer not null default 1,
        updated_at text not null,
        last_error text not null default ''
      )
    `),
    env.DB.prepare(`
      create table if not exists whiteboard_assets (
        asset_id text primary key,
        room_id text not null,
        object_key text not null unique,
        content_type text not null,
        byte_size integer not null,
        width integer not null,
        height integer not null,
        sha256 text not null default '',
        ref_count integer not null default 0,
        status text not null default 'active',
        created_at text not null,
        updated_at text not null,
        unreferenced_at text,
        delete_attempts integer not null default 0,
        last_error text not null default ''
      )
    `),
    env.DB.prepare(`
      create table if not exists whiteboard_bans (
        ban_id text primary key,
        room_id text not null,
        subject_type text not null,
        subject_value text not null,
        ip_hash_key_id text not null default '',
        reason text not null default '',
        expires_at text not null,
        active integer not null default 1,
        created_by text not null,
        created_at text not null,
        updated_at text not null
      )
    `),
    env.DB.prepare(`
      create table if not exists whiteboard_admin_audit (
        audit_id text primary key,
        admin_user_id text not null,
        action text not null,
        room_id text not null default '',
        target_type text not null default '',
        target_key text not null default '',
        details text not null default '{}',
        created_at text not null
      )
    `),
    env.DB.prepare(`
      create table if not exists whiteboard_metrics (
        metric_key text primary key,
        metric_value integer not null default 0,
        updated_at text not null
      )
    `),
    env.DB.prepare(
      "create index if not exists api_rate_limits_updated_idx on api_rate_limits(updated_at)"
    ),
    env.DB.prepare(
      "create index if not exists whiteboard_rooms_activity_idx on whiteboard_rooms(last_active_at desc, room_id)"
    ),
    env.DB.prepare(
      "create index if not exists whiteboard_rooms_cleanup_idx on whiteboard_rooms(status, delete_at)"
    ),
    env.DB.prepare(
      "create index if not exists whiteboard_assets_room_idx on whiteboard_assets(room_id, status, created_at)"
    ),
    env.DB.prepare(
      "create index if not exists whiteboard_assets_cleanup_idx on whiteboard_assets(status, unreferenced_at)"
    ),
    env.DB.prepare(
      "create index if not exists whiteboard_bans_active_idx on whiteboard_bans(room_id, active, expires_at)"
    ),
    env.DB.prepare(
      "create index if not exists whiteboard_bans_subject_idx on whiteboard_bans(subject_type, subject_value, active)"
    ),
    env.DB.prepare(`
      update whiteboard_bans
      set active = 0, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      where active = 1
        and expires_at <= strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    `),
    env.DB.prepare(
      "drop index if exists whiteboard_bans_active_scope_subject_idx"
    ),
    env.DB.prepare(`
      delete from whiteboard_bans
      where rowid in (
        select rowid
        from (
          select
            rowid,
            row_number() over (
              partition by room_id, subject_type, subject_value
              order by active desc, expires_at desc, updated_at desc, created_at desc, rowid desc
            ) as duplicate_rank
          from whiteboard_bans
        )
        where duplicate_rank > 1
      )
    `),
    env.DB.prepare(
      "create unique index if not exists whiteboard_bans_scope_subject_idx on whiteboard_bans(room_id, subject_type, subject_value)"
    ),
    env.DB.prepare(
      "create index if not exists whiteboard_admin_audit_created_idx on whiteboard_admin_audit(created_at desc)"
    )
  ]).then(() => undefined).catch((error) => {
    schemaPromises.delete(env.DB);
    throw error;
  });
  schemaPromises.set(env.DB, promise);
  return promise;
}

function assertBaseBindings(env) {
  if (!env?.DB || typeof env.DB.prepare !== "function") {
    throw new WhiteboardHttpError(
      "在线画板服务暂时不可用。",
      503,
      "WHITEBOARD_STORAGE_UNAVAILABLE"
    );
  }
}

function assertRealtimeBindings(env) {
  if (!env?.WHITEBOARD_ROOMS) {
    throw new WhiteboardHttpError(
      "在线画板实时服务暂时不可用。",
      503,
      "WHITEBOARD_REALTIME_UNAVAILABLE"
    );
  }
  requiredSecret(env, "WHITEBOARD_TICKET_SECRET");
  requiredSecret(env, "WHITEBOARD_INTERNAL_SECRET");
  requiredSecret(env, "WHITEBOARD_IP_HASH_SALT");
}

function requiredSecret(env, name) {
  const value = String(env?.[name] || "");
  try {
    assertSecretValue(value);
  } catch {
    throw new WhiteboardHttpError(
      "在线画板服务暂时不可用。",
      503,
      "WHITEBOARD_SECRET_CONFIGURATION_INVALID"
    );
  }
  return value;
}

function assertSecretValue(value) {
  if (
    typeof value !== "string"
    || new TextEncoder().encode(value).byteLength < 32
    || value.trim() !== value
  ) {
    throw new WhiteboardHttpError(
      "在线画板密钥配置无效。",
      503,
      "WHITEBOARD_SECRET_CONFIGURATION_INVALID"
    );
  }
}

function normalizeRoomType(value) {
  if (value === PUBLIC_ROOM_TYPE || value === PRIVATE_ROOM_TYPE) return value;
  throw joinFailedError();
}

function normalizeRoomId(value) {
  const roomId = String(value || "");
  if (!isValidRoomId(roomId)) {
    throw new WhiteboardHttpError(
      "画板房间标识无效。",
      422,
      "WHITEBOARD_ROOM_ID_INVALID"
    );
  }
  return roomId;
}

function isValidRoomId(value) {
  return value === PUBLIC_ROOM_ID || ROOM_ID_PATTERN.test(String(value || ""));
}

function normalizeAssetId(value) {
  const assetId = String(value || "").trim();
  if (!ASSET_ID_PATTERN.test(assetId)) {
    throw new WhiteboardHttpError(
      "图片资源标识无效。",
      422,
      "WHITEBOARD_ASSET_ID_INVALID"
    );
  }
  return assetId;
}

function optionalConnectionId(value) {
  if (value === undefined || value === null || value === "") return undefined;
  const candidate = String(value).trim();
  if (!CONNECTION_ID_PATTERN.test(candidate)) {
    throw new WhiteboardHttpError(
      "连接标识无效。",
      422,
      "WHITEBOARD_CONNECTION_ID_INVALID"
    );
  }
  return candidate;
}

function optionalAnonymousId(value) {
  if (value === undefined || value === null || value === "") return undefined;
  const candidate = String(value).trim();
  if (!ANONYMOUS_ID_PATTERN.test(candidate)) {
    throw new WhiteboardHttpError(
      "匿名身份标识无效。",
      422,
      "WHITEBOARD_ANONYMOUS_ID_INVALID"
    );
  }
  return candidate;
}

function normalizeAssetContentType(value) {
  const contentType = String(value || "").split(";", 1)[0].trim().toLowerCase();
  if (!SAFE_IMAGE_TYPES.has(contentType)) {
    throw new WhiteboardHttpError(
      "仅支持安全的 PNG、JPEG 或 WebP 图片。",
      415,
      "WHITEBOARD_ASSET_TYPE_UNSUPPORTED"
    );
  }
  return contentType;
}

function assertPlainObject(value) {
  if (!isPlainObject(value)) {
    throw new WhiteboardHttpError(
      "请求内容格式不正确。",
      400,
      "WHITEBOARD_JSON_INVALID"
    );
  }
}

function isPlainObject(value) {
  return Boolean(
    value
    && typeof value === "object"
    && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype
      || Object.getPrototypeOf(value) === null)
  );
}

function assertExactOrigin(request) {
  const expected = new URL(request.url).origin;
  const origin = String(request.headers.get("Origin") || "");
  if (origin !== expected) {
    throw new WhiteboardHttpError(
      "请求来源校验失败。",
      403,
      "WHITEBOARD_ORIGIN_REJECTED"
    );
  }
}

function assertAgentRequestOrigin(request) {
  const expected = new URL(request.url).origin;
  const origin = String(request.headers.get("Origin") || "");
  const fetchSite = String(
    request.headers.get("Sec-Fetch-Site") || ""
  ).toLowerCase();
  if (fetchSite === "cross-site" || (origin && origin !== expected)) {
    throw new WhiteboardHttpError(
      "Agent request origin is not trusted.",
      403,
      "WHITEBOARD_ORIGIN_REJECTED"
    );
  }
}

function assertTrustedSameOriginRead(request) {
  const expected = new URL(request.url).origin;
  const origin = String(request.headers.get("Origin") || "");
  const fetchSite = String(request.headers.get("Sec-Fetch-Site") || "").toLowerCase();
  if (
    (origin && origin !== expected)
    || (fetchSite && !["same-origin", "none"].includes(fetchSite))
  ) {
    throw new WhiteboardHttpError(
      "请求来源校验失败。",
      403,
      "WHITEBOARD_ORIGIN_REJECTED"
    );
  }
}

async function readBoundedJson(request) {
  const contentType = String(request.headers.get("Content-Type") || "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (contentType !== "application/json") {
    throw new WhiteboardHttpError(
      "请求必须使用 application/json。",
      415,
      "WHITEBOARD_CONTENT_TYPE_REQUIRED"
    );
  }
  const bytes = await readBoundedBytes(request, MAX_JSON_BYTES);
  let value;
  try {
    value = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes) || "{}"
    );
  } catch {
    throw new WhiteboardHttpError(
      "请求内容不是有效 JSON。",
      400,
      "WHITEBOARD_JSON_INVALID"
    );
  }
  return value;
}

async function readBoundedBytes(request, maximumBytes) {
  const declaredText = request.headers.get("Content-Length");
  const declared = declaredText === null ? NaN : Number(declaredText);
  if (
    Number.isFinite(declared)
    && (!Number.isInteger(declared) || declared < 0 || declared > maximumBytes)
  ) {
    throw new WhiteboardHttpError(
      "请求内容过大。",
      413,
      "WHITEBOARD_REQUEST_TOO_LARGE"
    );
  }
  if (!request.body) return new Uint8Array();

  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
      total += chunk.byteLength;
      if (total > maximumBytes) {
        await reader.cancel();
        throw new WhiteboardHttpError(
          "请求内容过大。",
          413,
          "WHITEBOARD_REQUEST_TOO_LARGE"
        );
      }
      chunks.push(chunk);
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
  return bytes;
}

function boundedInteger(value, minimum, maximum, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum) {
    throw new WhiteboardHttpError(
      "数值参数无效。",
      422,
      "WHITEBOARD_NUMBER_INVALID"
    );
  }
  return number;
}

function whiteboardJson(payload, status = 200) {
  const headers = apiSecurityHeaders({
    "Content-Type": "application/json; charset=utf-8"
  });
  return new Response(JSON.stringify(payload), { status, headers });
}

function whiteboardErrorResponse(error) {
  const ownError = error instanceof WhiteboardHttpError;
  const identityError = error?.name === "AnonymousIdentityError";
  const status = ownError
    ? error.status
    : identityError && Number.isInteger(error.status)
      ? error.status
      : 500;
  const code = ownError
    ? error.code
    : identityError
      ? "WHITEBOARD_IDENTITY_UNAVAILABLE"
      : "WHITEBOARD_INTERNAL_ERROR";
  const message = status >= 500
    ? "在线画板服务暂时不可用，请稍后重试。"
    : ownError
      ? error.message
      : "匿名身份不可用，请刷新后重试。";
  const response = whiteboardJson({ error: message, code }, status);
  const retryAfter = ownError
    ? Number(error.retryAfter || 0)
    : Number(error?.retryAfter || 0);
  if (retryAfter > 0) {
    response.headers.set("Retry-After", String(Math.ceil(retryAfter)));
  }
  if (status === 426) {
    response.headers.set("Upgrade", "websocket");
  }
  return response;
}

async function safeUpstreamJson(upstream, fallbackCode) {
  let payload = null;
  try {
    const text = await upstream.text();
    if (new TextEncoder().encode(text).byteLength <= 64 * 1024) {
      const parsed = JSON.parse(text || "{}");
      if (isPlainObject(parsed)) payload = parsed;
    }
  } catch {
    payload = null;
  }
  if (!upstream.ok) {
    return whiteboardJson({
      error: upstream.status >= 500
        ? "在线画板服务暂时不可用，请稍后重试。"
        : "无法完成画板操作，请稍后重试。",
      code: typeof payload?.code === "string"
        ? payload.code.slice(0, 80)
        : fallbackCode
    }, normalizeUpstreamStatus(upstream.status));
  }
  return whiteboardJson(payload || { ok: true }, upstream.status);
}

function safeAgentSceneResponse(upstream) {
  const contentType = String(upstream.headers.get("Content-Type") || "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  const documentVersion = String(
    upstream.headers.get("X-Whiteboard-Document-Version") || ""
  );
  const locked = String(upstream.headers.get("X-Whiteboard-Locked") || "");
  if (
    contentType !== AGENT_SCENE_CONTENT_TYPE
    || !/^(0|[1-9][0-9]{0,15})$/.test(documentVersion)
    || !/^[01]$/.test(locked)
  ) {
    return whiteboardJson({
      error: "Agent whiteboard scene response is invalid.",
      code: "WHITEBOARD_AGENT_SCENE_INVALID"
    }, 502);
  }
  const headers = apiSecurityHeaders({
    "Content-Type": AGENT_SCENE_CONTENT_TYPE,
    "X-Whiteboard-Document-Version": documentVersion,
    "X-Whiteboard-Locked": locked
  });
  const contentLength = upstream.headers.get("Content-Length");
  if (contentLength && /^[1-9][0-9]{0,8}$/.test(contentLength)) {
    headers.set("Content-Length", contentLength);
  }
  return new Response(upstream.body, { status: 200, headers });
}

function safeAssetResponse(upstream) {
  const headers = apiSecurityHeaders();
  const contentType = String(upstream.headers.get("Content-Type") || "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (upstream.ok && !SAFE_IMAGE_TYPES.has(contentType)) {
    return whiteboardJson({
      error: "图片资源不可用。",
      code: "WHITEBOARD_ASSET_INVALID"
    }, 502);
  }
  for (const name of ["Content-Length", "ETag", "Last-Modified"]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (contentType) headers.set("Content-Type", contentType);
  headers.set("Content-Disposition", "inline");
  return new Response(upstream.body, {
    status: normalizeUpstreamStatus(upstream.status),
    headers
  });
}

function normalizeUpstreamStatus(value) {
  const status = Number(value);
  return Number.isInteger(status) && status >= 200 && status <= 599 ? status : 502;
}

function apiSecurityHeaders(initial = {}) {
  const headers = new Headers(initial);
  for (const [name, value] of Object.entries(API_SECURITY_HEADERS)) {
    headers.set(name, value);
  }
  return headers;
}

function joinFailedError() {
  return new WhiteboardHttpError(
    "无法进入画板，请检查输入后重试。",
    422,
    "WHITEBOARD_JOIN_FAILED"
  );
}

function accessDeniedError() {
  return new WhiteboardHttpError(
    "画板访问凭证无效或已过期。",
    401,
    "WHITEBOARD_ACCESS_DENIED"
  );
}

async function tokenEncryptionKey(secret) {
  const material = await deriveSecretMaterial(secret, "encryption");
  return crypto.subtle.importKey(
    "raw",
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function tokenSigningMaterial(secret) {
  return deriveSecretMaterial(secret, "signature");
}

async function deriveSecretMaterial(secret, purpose) {
  return new Uint8Array(await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(
      `lusu:whiteboard:token-key:v1:${purpose}\u0000${secret}`
    )
  ));
}

async function hmacSha256(secretOrBytes, value) {
  const raw = typeof secretOrBytes === "string"
    ? new TextEncoder().encode(secretOrBytes)
    : secretOrBytes;
  const key = await crypto.subtle.importKey(
    "raw",
    raw,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return new Uint8Array(await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value)
  ));
}

function randomToken(byteLength) {
  return base64UrlEncode(randomBytes(byteLength));
}

function randomBytes(byteLength) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytes;
}

function base64UrlEncode(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - normalized.length % 4) % 4);
  const binary = atob(`${normalized}${padding}`);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function hexEncode(bytes) {
  return [...bytes]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
