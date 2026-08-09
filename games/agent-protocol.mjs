export const GAME_AGENT_PROTOCOL_VERSION = 1;

const GAME_AGENT_MAX_REVISION = 1_000_000_000;
const SESSION_ID_PATTERN = /^game_[a-z0-9][a-z0-9_-]{0,63}_[a-f0-9]{24,64}$/;
const CLIENT_ACTION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const FORBIDDEN_OBJECT_KEYS = new Set(["__proto__", "prototype", "constructor"]);

class BrowserAgentProtocolError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "BrowserAgentProtocolError";
    this.code = code;
  }
}

export function normalizeGameSessionId(value) {
  const sessionId = String(value || "").trim();
  if (!SESSION_ID_PATTERN.test(sessionId)) {
    throw new BrowserAgentProtocolError("The game session id is invalid.", "GAME_SESSION_ID_INVALID");
  }
  return sessionId;
}

export function normalizeGameRevision(value) {
  const revision = Number(value);
  if (!Number.isSafeInteger(revision) || revision < 0 || revision > GAME_AGENT_MAX_REVISION) {
    throw new BrowserAgentProtocolError("The game revision is invalid.", "GAME_REVISION_INVALID");
  }
  return revision;
}

export function normalizeClientActionId(value) {
  const clientActionId = String(value || "").trim();
  if (!CLIENT_ACTION_ID_PATTERN.test(clientActionId)) {
    throw new BrowserAgentProtocolError("The client action id is invalid.", "GAME_CLIENT_ACTION_ID_INVALID");
  }
  return clientActionId;
}

export function cloneBoundedJson(value, options = {}) {
  const label = options.label || "JSON value";
  inspectPlainJson(value, {
    label,
    maxDepth: options.maxDepth || 16,
    maxNodes: options.maxNodes || 10_000
  });
  let serialized;
  try {
    serialized = JSON.stringify(value);
  } catch (error) {
    throw new BrowserAgentProtocolError(`${label} could not be serialized.`, "GAME_JSON_INVALID");
  }
  const maxBytes = options.maxBytes || 64 * 1024;
  if (new TextEncoder().encode(serialized).byteLength > maxBytes) {
    throw new BrowserAgentProtocolError(`${label} is too large.`, "GAME_JSON_TOO_LARGE");
  }
  return JSON.parse(serialized);
}

function inspectPlainJson(root, options) {
  let nodes = 0;
  const ancestors = new Set();
  const visit = (value, depth) => {
    nodes += 1;
    if (nodes > options.maxNodes || depth > options.maxDepth) {
      throw new BrowserAgentProtocolError(`${options.label} is too complex.`, "GAME_JSON_TOO_COMPLEX");
    }
    if (value === null || typeof value === "string" || typeof value === "boolean") return;
    if (typeof value === "number") {
      if (!Number.isFinite(value)) {
        throw new BrowserAgentProtocolError(`${options.label} contains a non-finite number.`, "GAME_JSON_INVALID");
      }
      return;
    }
    if (typeof value !== "object") {
      throw new BrowserAgentProtocolError(`${options.label} contains a non-JSON value.`, "GAME_JSON_INVALID");
    }
    const prototype = Object.getPrototypeOf(value);
    const tag = Object.prototype.toString.call(value);
    const plainObject = tag === "[object Object]"
      && (prototype === null || Object.getPrototypeOf(prototype) === null);
    const plainArray = Array.isArray(value);
    if (!plainObject && !plainArray) {
      throw new BrowserAgentProtocolError(`${options.label} contains a non-plain object.`, "GAME_JSON_INVALID");
    }
    if (ancestors.has(value)) {
      throw new BrowserAgentProtocolError(`${options.label} contains a cycle.`, "GAME_JSON_INVALID");
    }
    ancestors.add(value);
    if (Array.isArray(value)) {
      if (value.length > options.maxNodes) {
        throw new BrowserAgentProtocolError(`${options.label} contains an oversized array.`, "GAME_JSON_TOO_COMPLEX");
      }
      value.forEach((child) => visit(child, depth + 1));
    } else {
      Object.keys(value).forEach((key) => {
        if (FORBIDDEN_OBJECT_KEYS.has(key) || key.length > 128) {
          throw new BrowserAgentProtocolError(`${options.label} contains an unsafe object key.`, "GAME_JSON_INVALID");
        }
        visit(value[key], depth + 1);
      });
    }
    ancestors.delete(value);
  };
  visit(root, 0);
}
