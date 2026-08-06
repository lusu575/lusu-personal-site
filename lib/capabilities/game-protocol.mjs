export const GAME_AGENT_PROTOCOL_VERSION = 1;
export const GAME_AGENT_MAX_REVISION = 1_000_000_000;
export const GAME_AGENT_MAX_ACTION_BYTES = 8 * 1024;
export const GAME_AGENT_MAX_OBSERVATION_BYTES = 64 * 1024;

const SESSION_ID_PATTERN = /^game_[a-z0-9][a-z0-9_-]{0,63}_[a-f0-9]{24,64}$/;
const GAME_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const CLIENT_ACTION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const RESERVED_OBSERVATION_KEYS = new Set(["protocolVersion", "gameId", "sessionId", "revision"]);
const FORBIDDEN_OBJECT_KEYS = new Set(["__proto__", "prototype", "constructor"]);

export class GameProtocolError extends Error {
  constructor(message, code = "GAME_PROTOCOL_ERROR", options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = "GameProtocolError";
    this.code = code;
  }
}

export function normalizeGameId(value) {
  const gameId = String(value || "").trim().toLowerCase();
  if (!GAME_ID_PATTERN.test(gameId)) {
    throw new GameProtocolError("The game id is invalid.", "GAME_ID_INVALID");
  }
  return gameId;
}

export function normalizeGameSessionId(value) {
  const sessionId = String(value || "").trim();
  if (!SESSION_ID_PATTERN.test(sessionId)) {
    throw new GameProtocolError("The game session id is invalid.", "GAME_SESSION_ID_INVALID");
  }
  return sessionId;
}

export function createGameSessionId(gameId, options = {}) {
  const normalizedGameId = normalizeGameId(gameId);
  const randomUUID = options.randomUUID || globalThis.crypto?.randomUUID?.bind(globalThis.crypto);
  if (typeof randomUUID !== "function") {
    throw new GameProtocolError("A secure session id generator is unavailable.", "GAME_SESSION_RANDOM_UNAVAILABLE");
  }
  const randomPart = String(randomUUID()).replace(/-/g, "").toLowerCase();
  return normalizeGameSessionId(`game_${normalizedGameId}_${randomPart}`);
}

export function normalizeGameRevision(value) {
  const revision = Number(value);
  if (!Number.isSafeInteger(revision) || revision < 0 || revision > GAME_AGENT_MAX_REVISION) {
    throw new GameProtocolError("The game revision is invalid.", "GAME_REVISION_INVALID");
  }
  return revision;
}

export function normalizeClientActionId(value) {
  const clientActionId = String(value || "").trim();
  if (!CLIENT_ACTION_ID_PATTERN.test(clientActionId)) {
    throw new GameProtocolError("The client action id is invalid.", "GAME_CLIENT_ACTION_ID_INVALID");
  }
  return clientActionId;
}

export function normalizeGameActionRequest(value, options = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new GameProtocolError("The game action request must be an object.", "GAME_ACTION_REQUEST_INVALID");
  }
  assertExactKeys(value, ["action", "clientActionId", "expectedRevision"], "GAME_ACTION_REQUEST_INVALID");
  const action = cloneBoundedJson(value.action, {
    label: "game action",
    maxBytes: options.maxActionBytes || GAME_AGENT_MAX_ACTION_BYTES,
    maxDepth: 8,
    maxNodes: 256
  });
  return Object.freeze({
    expectedRevision: normalizeGameRevision(value.expectedRevision),
    clientActionId: normalizeClientActionId(value.clientActionId),
    action: deepFreezeJson(action)
  });
}

export function createGameObservationEnvelope(input, options = {}) {
  const gameId = normalizeGameId(input?.gameId);
  const sessionId = normalizeGameSessionId(input?.sessionId);
  const revision = normalizeGameRevision(input?.revision);
  const observation = cloneBoundedJson(input?.observation, {
    label: "game observation",
    maxBytes: options.maxBytes || GAME_AGENT_MAX_OBSERVATION_BYTES,
    maxDepth: 16,
    maxNodes: 10_000
  });
  if (!observation || typeof observation !== "object" || Array.isArray(observation)) {
    throw new GameProtocolError("The game observation must be an object.", "GAME_OBSERVATION_INVALID");
  }
  for (const key of Object.keys(observation)) {
    if (RESERVED_OBSERVATION_KEYS.has(key)) {
      throw new GameProtocolError("The game observation uses a reserved key.", "GAME_OBSERVATION_RESERVED_KEY");
    }
  }
  return deepFreezeJson({
    protocolVersion: GAME_AGENT_PROTOCOL_VERSION,
    gameId,
    sessionId,
    revision,
    ...observation
  });
}

export function createGameActionsEnvelope(input, options = {}) {
  const actions = cloneBoundedJson(input?.actions, {
    label: "game actions",
    maxBytes: options.maxBytes || GAME_AGENT_MAX_OBSERVATION_BYTES,
    maxDepth: 12,
    maxNodes: 2_000
  });
  if (!Array.isArray(actions)) {
    throw new GameProtocolError("The game actions must be an array.", "GAME_ACTIONS_INVALID");
  }
  return deepFreezeJson({
    protocolVersion: GAME_AGENT_PROTOCOL_VERSION,
    gameId: normalizeGameId(input?.gameId),
    sessionId: normalizeGameSessionId(input?.sessionId),
    revision: normalizeGameRevision(input?.revision),
    actions
  });
}

export function createGameActionResult(input, options = {}) {
  const status = String(input?.status || "");
  if (!new Set(["applied", "noop", "rejected"]).has(status)) {
    throw new GameProtocolError("The game action result status is invalid.", "GAME_ACTION_RESULT_INVALID");
  }
  const reason = String(input?.reason || "").trim();
  if (!/^[a-z][a-z0-9-]{0,63}$/.test(reason)) {
    throw new GameProtocolError("The game action result reason is invalid.", "GAME_ACTION_RESULT_INVALID");
  }
  const beforeRevision = normalizeGameRevision(input?.beforeRevision);
  const revision = normalizeGameRevision(input?.revision);
  if (revision < beforeRevision || revision - beforeRevision > 1) {
    throw new GameProtocolError("The game action result revision is invalid.", "GAME_ACTION_RESULT_INVALID");
  }
  if (status === "applied" ? revision !== beforeRevision + 1 : revision !== beforeRevision) {
    throw new GameProtocolError("The game action result does not match its revision.", "GAME_ACTION_RESULT_INVALID");
  }
  const events = cloneBoundedJson(input?.events || [], {
    label: "game action events",
    maxBytes: options.maxEventsBytes || 16 * 1024,
    maxDepth: 10,
    maxNodes: 2_000
  });
  if (!Array.isArray(events)) {
    throw new GameProtocolError("The game action events must be an array.", "GAME_ACTION_RESULT_INVALID");
  }
  const observation = createGameObservationEnvelope({
    gameId: input?.gameId,
    sessionId: input?.sessionId,
    revision,
    observation: input?.observation
  }, options);
  return deepFreezeJson({
    protocolVersion: GAME_AGENT_PROTOCOL_VERSION,
    gameId: observation.gameId,
    sessionId: observation.sessionId,
    clientActionId: normalizeClientActionId(input?.clientActionId),
    status,
    reason,
    beforeRevision,
    revision,
    deduplicated: input?.deduplicated === true,
    events,
    observation
  });
}

export function cloneBoundedJson(value, options = {}) {
  const label = options.label || "JSON value";
  inspectPlainJson(value, {
    label,
    maxDepth: options.maxDepth || 16,
    maxNodes: options.maxNodes || 10_000
  });
  let text;
  try {
    text = JSON.stringify(value);
  } catch (error) {
    throw new GameProtocolError(`${label} could not be serialized.`, "GAME_JSON_INVALID", { cause: error });
  }
  const maxBytes = options.maxBytes || GAME_AGENT_MAX_OBSERVATION_BYTES;
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    throw new GameProtocolError(`${label} is too large.`, "GAME_JSON_TOO_LARGE");
  }
  return JSON.parse(text);
}

export function deepFreezeJson(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreezeJson(child);
  return Object.freeze(value);
}

export function assertExactKeys(value, allowedKeys, code = "GAME_OBJECT_KEYS_INVALID") {
  const allowed = new Set(allowedKeys);
  const keys = Object.keys(value);
  if (keys.length !== allowed.size || keys.some((key) => !allowed.has(key))) {
    throw new GameProtocolError("The object contains unsupported fields.", code);
  }
}

function inspectPlainJson(root, options) {
  let nodes = 0;
  const ancestors = new Set();

  const visit = (value, depth) => {
    nodes += 1;
    if (nodes > options.maxNodes || depth > options.maxDepth) {
      throw new GameProtocolError(`${options.label} is too complex.`, "GAME_JSON_TOO_COMPLEX");
    }
    if (value === null || typeof value === "string" || typeof value === "boolean") return;
    if (typeof value === "number") {
      if (!Number.isFinite(value)) {
        throw new GameProtocolError(`${options.label} contains a non-finite number.`, "GAME_JSON_INVALID");
      }
      return;
    }
    if (typeof value !== "object") {
      throw new GameProtocolError(`${options.label} contains a non-JSON value.`, "GAME_JSON_INVALID");
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== Array.prototype && prototype !== null) {
      throw new GameProtocolError(`${options.label} contains a non-plain object.`, "GAME_JSON_INVALID");
    }
    if (ancestors.has(value)) {
      throw new GameProtocolError(`${options.label} contains a cycle.`, "GAME_JSON_INVALID");
    }
    ancestors.add(value);
    if (Array.isArray(value)) {
      if (value.length > options.maxNodes) {
        throw new GameProtocolError(`${options.label} contains an oversized array.`, "GAME_JSON_TOO_COMPLEX");
      }
      value.forEach((child) => visit(child, depth + 1));
    } else {
      const keys = Object.keys(value);
      for (const key of keys) {
        if (FORBIDDEN_OBJECT_KEYS.has(key) || key.length > 128) {
          throw new GameProtocolError(`${options.label} contains an unsafe object key.`, "GAME_JSON_INVALID");
        }
        visit(value[key], depth + 1);
      }
    }
    ancestors.delete(value);
  };

  visit(root, 0);
}
