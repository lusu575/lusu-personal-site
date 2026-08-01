const JSON_HEADERS = Object.freeze({
  Accept: "application/json",
  "Content-Type": "application/json",
});

const TELEMETRY_EVENTS = new Set([
  "whiteboard_page_view",
  "whiteboard_public_join",
  "whiteboard_private_join",
  "whiteboard_join_failed",
  "whiteboard_reconnect_failed",
  "whiteboard_export_png",
  "whiteboard_export_svg",
  "whiteboard_image_upload_success",
  "whiteboard_image_upload_failed",
  "whiteboard_name_rotate",
  "whiteboard_share_entry",
  "whiteboard_session_end",
]);
const IDENTITY_SYNC_CHANNEL = "lusu:anonymous-identity-sync-v1";
const IDENTITY_SYNC_STORAGE_KEY = "lusu-anonymous-identity-sync-v1";
const IDENTITY_SYNC_CONTEXT_ID = createContextId();

export class ApiError extends Error {
  constructor(message, status = 0, code = "") {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = typeof code === "string" ? code.slice(0, 80) : "";
  }
}

async function parseJsonResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new ApiError("Unexpected response.", response.status);
  }
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError("Invalid response.", response.status);
  }
  if (!response.ok) {
    throw new ApiError(
      typeof payload?.error === "string" ? payload.error : "Request failed.",
      response.status,
      payload?.code,
    );
  }
  return payload;
}

async function jsonRequest(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || "GET",
    credentials: "include",
    cache: "no-store",
    headers: options.body === undefined ? { Accept: "application/json" } : JSON_HEADERS,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  });
  return parseJsonResponse(response);
}

function normalizeIdentity(payload) {
  const source = payload?.identity && typeof payload.identity === "object"
    ? payload.identity
    : payload;
  const displayName = String(source?.displayName || source?.name || "").trim().slice(0, 32);
  const color = /^#[0-9a-f]{6}$/i.test(String(source?.color || ""))
    ? String(source.color).toLowerCase()
    : "#64748b";
  if (!displayName) {
    throw new ApiError("Identity unavailable.");
  }
  return {
    anonymousId: typeof source?.anonymousId === "string" ? source.anonymousId : "",
    displayName,
    color,
    createdAt: source?.createdAt || null,
    version: Number(source?.version || source?.identityVersion || 1),
  };
}

export async function getAnonymousIdentity(signal) {
  return normalizeIdentity(await jsonRequest("/api/anonymous-identity", { signal }));
}

export async function rotateAnonymousIdentity(signal) {
  const identity = normalizeIdentity(await jsonRequest("/api/anonymous-identity/name/rotate", {
    method: "POST",
    body: {},
    signal,
  }));
  publishIdentityChange(identity);
  return identity;
}

export function subscribeAnonymousIdentityChanges(callback) {
  if (typeof callback !== "function" || typeof window === "undefined") return () => {};
  let active = true;
  let refreshPromise = null;
  let channel = null;

  const refresh = () => {
    if (!active || refreshPromise) return refreshPromise;
    refreshPromise = getAnonymousIdentity()
      .then((identity) => {
        if (active) callback(identity);
        return identity;
      })
      .catch(() => null)
      .finally(() => {
        refreshPromise = null;
      });
    return refreshPromise;
  };
  const handleSignal = (value) => {
    if (!isIdentitySyncSignal(value) || value.source === IDENTITY_SYNC_CONTEXT_ID) return;
    void refresh();
  };
  const handleStorage = (event) => {
    if (event.key !== IDENTITY_SYNC_STORAGE_KEY || !event.newValue) return;
    try {
      handleSignal(JSON.parse(event.newValue));
    } catch {
      // Local storage is a wake-up signal only, never an identity authority.
    }
  };
  const handleVisibility = () => {
    if (document.visibilityState === "visible") void refresh();
  };

  if (typeof globalThis.BroadcastChannel === "function") {
    try {
      channel = new globalThis.BroadcastChannel(IDENTITY_SYNC_CHANNEL);
      channel.addEventListener("message", (event) => handleSignal(event.data));
    } catch {
      channel = null;
    }
  }
  window.addEventListener("storage", handleStorage);
  document.addEventListener("visibilitychange", handleVisibility);
  window.addEventListener("pageshow", refresh);
  return () => {
    active = false;
    channel?.close();
    window.removeEventListener("storage", handleStorage);
    document.removeEventListener("visibilitychange", handleVisibility);
    window.removeEventListener("pageshow", refresh);
  };
}

export function normalizeRoomPassword(password) {
  return String(password || "").normalize("NFKC").trim();
}

function normalizeJoinPayload(payload) {
  const source = payload?.room && typeof payload.room === "object"
    ? { ...payload, ...payload.room }
    : payload;
  const accessToken = String(source?.accessToken || "");
  const ticket = String(source?.ticket || "");
  const wsProtocol = String(source?.wsProtocol || "");
  const wsUrl = String(source?.wsUrl || "");
  if (!accessToken || !ticket || !wsProtocol || !wsUrl) {
    throw new ApiError("Incomplete room response.");
  }
  return {
    identity: normalizeIdentity(source?.identity || payload?.identity || {}),
    accessToken,
    ticket,
    ticketExpiresAt: source?.ticketExpiresAt || null,
    wsProtocol,
    wsUrl,
    roomType: (source?.roomType || source?.type) === "private" ? "private" : "public",
  };
}

export async function joinRoom(roomType, password, signal) {
  const body = roomType === "private"
    ? { type: roomType, password: normalizeRoomPassword(password) }
    : { type: "public" };
  return normalizeJoinPayload(await jsonRequest("/api/whiteboard/rooms/join", {
    method: "POST",
    body,
    signal,
  }));
}

export async function reconnectRoom(accessToken, signal) {
  return normalizeJoinPayload(await jsonRequest("/api/whiteboard/rooms/reconnect", {
    method: "POST",
    body: { accessToken },
    signal,
  }));
}

function websocketToken(value, maximumLength) {
  const token = String(value || "");
  if (
    !token
    || token.length > maximumLength
    || !/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(token)
  ) {
    throw new ApiError("Invalid WebSocket token.");
  }
  return token;
}

export function validatedWebSocketConfig(roomSession) {
  const url = new URL(roomSession.wsUrl, window.location.origin);
  const expectedProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  if (url.protocol === "https:") url.protocol = "wss:";
  if (url.protocol === "http:") url.protocol = "ws:";
  if (url.host !== window.location.host || url.protocol !== expectedProtocol) {
    throw new ApiError("Unsafe WebSocket URL.");
  }
  url.username = "";
  url.password = "";
  return {
    url: url.href,
    protocols: [
      websocketToken(roomSession.wsProtocol, 128),
      websocketToken(roomSession.ticket, 4096),
    ],
  };
}

export function trackWhiteboardEvent(eventName, metricBuckets = {}) {
  if (!TELEMETRY_EVENTS.has(eventName)) return;
  const lang = (document.documentElement.lang || "zh").toLowerCase().slice(0, 2);
  const telemetryDetail = [
    ["duration", metricBuckets.duration],
    ["online", metricBuckets.online],
  ]
    .filter(([, value]) => /^[a-z0-9_-]{1,24}$/.test(String(value || "")))
    .map(([key, value]) => `${key}:${value}`)
    .join("|");
  const payload = {
    targetKey: eventName,
    targetText: telemetryDetail ? `${eventName}|${telemetryDetail}` : eventName,
    tagName: "CUSTOM",
    elementId: "",
    elementClasses: "",
    href: "",
    dataRoute: "tools",
    path: `/tools/whiteboard?lang=${["zh", "en", "ja"].includes(lang) ? lang : "zh"}`,
    route: "tools",
    screenWidth: Math.max(0, Math.round(window.innerWidth || 0)),
    screenHeight: Math.max(0, Math.round(window.innerHeight || 0)),
    x: 0,
    y: 0,
  };
  fetch("/api/analytics/click", {
    method: "POST",
    credentials: "include",
    keepalive: true,
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  }).catch(() => {});
}

function publishIdentityChange(identity) {
  const signal = {
    type: "identity-changed",
    source: IDENTITY_SYNC_CONTEXT_ID,
    version: Number(identity?.version || 0),
    at: Date.now(),
  };
  if (typeof globalThis.BroadcastChannel === "function") {
    try {
      const channel = new globalThis.BroadcastChannel(IDENTITY_SYNC_CHANNEL);
      channel.postMessage(signal);
      window.setTimeout(() => channel.close(), 0);
    } catch {
      // The storage wake-up remains available when BroadcastChannel is blocked.
    }
  }
  try {
    window.localStorage.setItem(IDENTITY_SYNC_STORAGE_KEY, JSON.stringify(signal));
    window.localStorage.removeItem(IDENTITY_SYNC_STORAGE_KEY);
  } catch {
    // The signed HttpOnly identity credential remains the source of truth.
  }
}

function isIdentitySyncSignal(value) {
  return value?.type === "identity-changed"
    && typeof value.source === "string"
    && value.source.length <= 80
    && Number.isInteger(Number(value.version))
    && Number(value.version) > 0;
}

function createContextId() {
  if (typeof crypto?.getRandomValues !== "function") {
    return `context_${Date.now().toString(36)}`;
  }
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return `context_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}
