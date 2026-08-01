export const anonymousIdentityChangeEvent = "lusu:anonymous-identity-change";
export const anonymousIdentitySyncChannel = "lusu:anonymous-identity-sync-v1";

let cachedIdentity = null;
let pendingIdentity = null;
let clientPresenceId = "";
const identitySyncStorageKey = "lusu-anonymous-identity-sync-v1";
const identitySyncContextId = createContextId();

export async function getAnonymousIdentity(options = {}) {
  if (cachedIdentity && options.refresh !== true) return cachedIdentity;
  if (pendingIdentity && options.refresh !== true) return pendingIdentity;
  pendingIdentity = requestIdentity("/api/anonymous-identity", {
    method: "GET",
    signal: options.signal,
    fetcher: options.fetcher
  }).finally(() => {
    pendingIdentity = null;
  });
  return pendingIdentity;
}

export async function rotateAnonymousIdentityName(options = {}) {
  const identity = await requestIdentity("/api/anonymous-identity/name/rotate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
    signal: options.signal,
    fetcher: options.fetcher
  });
  publishAnonymousIdentityChange(identity, options.safeStorageSet);
  return identity;
}

export function subscribeAnonymousIdentityChanges(callback, options = {}) {
  if (typeof callback !== "function" || typeof window === "undefined") {
    return () => {};
  }
  let active = true;
  let refreshPromise = null;
  let channel = null;

  const refresh = () => {
    if (!active || refreshPromise) return refreshPromise;
    refreshPromise = getAnonymousIdentity({
      refresh: true,
      fetcher: options.fetcher
    }).then((identity) => {
      if (active) callback(identity);
      return identity;
    }).catch(() => null).finally(() => {
      refreshPromise = null;
    });
    return refreshPromise;
  };
  const handleSignal = (value) => {
    if (!isIdentitySyncSignal(value) || value.source === identitySyncContextId) return;
    void refresh();
  };
  const handleStorage = (event) => {
    if (event.key !== identitySyncStorageKey || !event.newValue) return;
    try {
      handleSignal(JSON.parse(event.newValue));
    } catch {
      // Storage is only a wake-up signal. Invalid values never become identity data.
    }
  };
  const handleVisibility = () => {
    if (document.visibilityState === "visible") void refresh();
  };

  if (typeof globalThis.BroadcastChannel === "function") {
    try {
      channel = new globalThis.BroadcastChannel(anonymousIdentitySyncChannel);
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

function publishAnonymousIdentityChange(identity, safeStorageSet) {
  if (
    typeof window !== "undefined"
    && typeof window.dispatchEvent === "function"
    && typeof CustomEvent === "function"
  ) {
    window.dispatchEvent(new CustomEvent(anonymousIdentityChangeEvent, {
      detail: { identity }
    }));
  }
  const signal = {
    type: "identity-changed",
    source: identitySyncContextId,
    version: Number(identity?.version || 0),
    at: Date.now()
  };
  if (typeof globalThis.BroadcastChannel === "function") {
    try {
      const channel = new globalThis.BroadcastChannel(anonymousIdentitySyncChannel);
      channel.postMessage(signal);
      window.setTimeout(() => channel.close(), 0);
    } catch {
      // The storage wake-up below remains available when BroadcastChannel is blocked.
    }
  }
  if (typeof safeStorageSet === "function") {
    safeStorageSet(identitySyncStorageKey, JSON.stringify(signal));
  }
}

export function anonymousClientPresenceId() {
  if (clientPresenceId) return clientPresenceId;
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  clientPresenceId = `client_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  return clientPresenceId;
}

async function requestIdentity(url, init) {
  const { fetcher = globalThis.fetch, ...requestInit } = init;
  if (typeof fetcher !== "function") {
    throw new Error("匿名身份请求不可用。");
  }
  const response = await fetcher(url, {
    credentials: "same-origin",
    cache: "no-store",
    ...requestInit
  });
  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }
  if (!response.ok) {
    const error = new Error(payload.error || "匿名身份服务暂时不可用。");
    error.code = payload.code || "";
    error.retryAfter = Number(response.headers.get("Retry-After") || 0);
    throw error;
  }
  const identity = normalizeIdentity(payload.identity);
  if (!identity) throw new Error("匿名身份响应不完整。");
  cachedIdentity = identity;
  return identity;
}

function normalizeIdentity(value) {
  const displayName = String(value?.displayName || "").trim();
  const color = String(value?.color || "").trim();
  const createdAt = String(value?.createdAt || "").trim();
  const version = Number(value?.version || 0);
  if (
    Array.from(displayName).length < 2
    || Array.from(displayName).length > 12
    || !/^#[0-9a-f]{6}$/i.test(color)
    || !Number.isInteger(version)
    || version < 1
  ) {
    return null;
  }
  return Object.freeze({ displayName, color, createdAt, version });
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
