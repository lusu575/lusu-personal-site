import {
  GAME_AGENT_PROTOCOL_VERSION,
  cloneBoundedJson,
  normalizeClientActionId,
  normalizeGameRevision,
  normalizeGameSessionId
} from "./agent-protocol.mjs";

const ACTION_TOKEN_PATTERN = /^act_[A-Za-z0-9_-]{22}$/;
const ACTION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SAFE_RISKS = new Set(["low", "medium", "high"]);
const FORBIDDEN_ACTION_KEYS = new Set(["selector", "script", "key", "keyCode", "code", "x", "y", "coordinates", "url"]);
const MAX_RECEIPTS = 128;

export class BrowserGameAgentError extends Error {
  constructor(message, code = "BROWSER_GAME_AGENT_ERROR") {
    super(message);
    this.name = "BrowserGameAgentError";
    this.code = code;
  }
}

export async function createBrowserGameAgentHost({ frame, gameId, timeoutMs = 15_000 } = {}) {
  if (!(frame instanceof HTMLIFrameElement)) {
    throw new BrowserGameAgentError("The game frame is unavailable.", "GAME_FRAME_UNAVAILABLE");
  }
  const normalizedGameId = String(gameId || "").trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(normalizedGameId)) {
    throw new BrowserGameAgentError("The game id is invalid.", "GAME_ID_INVALID");
  }

  const provider = await waitForProvider(frame, normalizedGameId, timeoutMs);
  return createHost(provider, normalizedGameId);
}

function createHost(provider, gameId) {
  let paused = false;
  let controlActive = false;
  let actionCatalog = null;
  const receipts = new Map();

  function readObservation() {
    const observation = cloneBoundedJson(provider.observe(), {
      label: "browser game observation",
      maxBytes: 64 * 1024,
      maxDepth: 16,
      maxNodes: 10_000
    });
    validateEnvelope(observation, gameId, "observation", provider.sessionId);
    return observation;
  }

  function readActions(observation = readObservation()) {
    const envelope = cloneBoundedJson(provider.actions(), {
      label: "browser game actions",
      maxBytes: 64 * 1024,
      maxDepth: 12,
      maxNodes: 4_000
    });
    validateEnvelope(envelope, gameId, "actions", provider.sessionId);
    if (!Array.isArray(envelope.actions) || envelope.revision !== observation.revision) {
      throw new BrowserGameAgentError("The provider returned an inconsistent action catalog.", "GAME_ACTIONS_INVALID");
    }
    if (actionCatalog && actionCatalog.sessionId === envelope.sessionId && actionCatalog.revision === envelope.revision) {
      return actionCatalog.publicEnvelope;
    }

    const tokenMap = new Map();
    const publicActions = envelope.actions.map((entry, index) => {
      const normalized = normalizeProviderAction(entry, index);
      const actionId = createOpaqueActionId();
      tokenMap.set(actionId, normalized.action);
      return Object.freeze({
        actionId,
        id: normalized.id,
        label: normalized.label,
        group: normalized.group,
        description: normalized.description,
        risk: normalized.risk,
        requiresConfirmation: normalized.requiresConfirmation
      });
    });
    const publicEnvelope = Object.freeze({
      protocolVersion: GAME_AGENT_PROTOCOL_VERSION,
      gameId,
      sessionId: envelope.sessionId,
      revision: envelope.revision,
      actions: Object.freeze(publicActions)
    });
    actionCatalog = {
      sessionId: envelope.sessionId,
      revision: envelope.revision,
      tokenMap,
      publicEnvelope
    };
    return publicEnvelope;
  }

  function snapshot() {
    const observation = readObservation();
    const actions = readActions(observation);
    return Object.freeze({
      revision: observation.revision,
      observation,
      actions: actions.actions
    });
  }

  function act(request) {
    const normalized = normalizeHostActionRequest(request);
    const fingerprint = `${normalized.expectedRevision}:${normalized.actionId}`;
    const prior = receipts.get(normalized.clientActionId);
    if (prior) {
      if (prior.fingerprint !== fingerprint) {
        throw new BrowserGameAgentError(
          "The client action id was already used for another action.",
          "GAME_CLIENT_ACTION_ID_REUSED"
        );
      }
      return Object.freeze({ ...cloneBoundedJson(prior.result), deduplicated: true });
    }
    if (paused || !controlActive) {
      throw new BrowserGameAgentError("AI control is not active.", "GAME_CONTROL_NOT_ACTIVE");
    }

    const before = readObservation();
    if (!actionCatalog
      || actionCatalog.sessionId !== before.sessionId
      || actionCatalog.revision !== before.revision
      || normalized.expectedRevision !== before.revision) {
      actionCatalog = null;
      throw new BrowserGameAgentError("The action revision is stale.", "GAME_REVISION_CONFLICT");
    }
    const semanticAction = actionCatalog.tokenMap.get(normalized.actionId);
    if (!semanticAction) {
      throw new BrowserGameAgentError("The action token is stale or unknown.", "GAME_ACTION_TOKEN_INVALID");
    }

    const result = cloneBoundedJson(provider.act({
      expectedRevision: normalized.expectedRevision,
      clientActionId: normalized.clientActionId,
      action: semanticAction
    }), {
      label: "browser game action result",
      maxBytes: 80 * 1024,
      maxDepth: 18,
      maxNodes: 12_000
    });
    validateActionResult(result, gameId, provider.sessionId, normalized.clientActionId);
    actionCatalog = null;
    const frozen = Object.freeze({ ...result, deduplicated: result.deduplicated === true });
    receipts.set(normalized.clientActionId, { fingerprint, result: frozen });
    while (receipts.size > MAX_RECEIPTS) receipts.delete(receipts.keys().next().value);
    return frozen;
  }

  function setPaused(value) {
    paused = value === true;
  }

  function setControlActive(value) {
    controlActive = value === true;
    actionCatalog = null;
    if (typeof provider.setControlMode === "function") {
      provider.setControlMode(controlActive);
    }
  }

  return Object.freeze({
    protocolVersion: GAME_AGENT_PROTOCOL_VERSION,
    gameId,
    sessionId: provider.sessionId,
    observe: readObservation,
    actions: readActions,
    snapshot,
    act,
    setPaused,
    setControlActive
  });
}

async function waitForProvider(frame, gameId, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    let provider = null;
    try {
      const gameWindow = frame.contentWindow;
      if (gameWindow?.location?.origin !== window.location.origin) {
        throw new BrowserGameAgentError("Cross-origin game control is forbidden.", "GAME_ORIGIN_FORBIDDEN");
      }
      provider = gameWindow?.gamePage?.agent || null;
    } catch (error) {
      if (error instanceof BrowserGameAgentError) throw error;
      throw new BrowserGameAgentError("The game frame cannot be inspected safely.", "GAME_FRAME_UNAVAILABLE");
    }
    if (provider) {
      validateProvider(provider, gameId);
      return provider;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 100));
  }
  throw new BrowserGameAgentError("This game does not expose an audited semantic provider.", "GAME_AGENT_UNAVAILABLE");
}

function validateProvider(provider, gameId) {
  if (!Object.isFrozen(provider)
    || provider.protocolVersion !== GAME_AGENT_PROTOCOL_VERSION
    || provider.gameId !== gameId
    || !["observe", "actions", "act"].every((method) => typeof provider[method] === "function")) {
    throw new BrowserGameAgentError("The semantic provider contract is invalid.", "GAME_PROVIDER_INVALID");
  }
  if (provider.setControlMode !== undefined && typeof provider.setControlMode !== "function") {
    throw new BrowserGameAgentError("The semantic provider control hook is invalid.", "GAME_PROVIDER_INVALID");
  }
  normalizeGameSessionId(provider.sessionId);
}

function validateEnvelope(value, gameId, kind, expectedSessionId) {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || value.protocolVersion !== GAME_AGENT_PROTOCOL_VERSION
    || value.gameId !== gameId) {
    throw new BrowserGameAgentError(`The provider ${kind} envelope is invalid.`, "GAME_PROVIDER_INVALID");
  }
  const sessionId = normalizeGameSessionId(value.sessionId);
  if (expectedSessionId !== undefined && sessionId !== normalizeGameSessionId(expectedSessionId)) {
    throw new BrowserGameAgentError(`The provider ${kind} session changed.`, "GAME_PROVIDER_INVALID");
  }
  normalizeGameRevision(value.revision);
}

function normalizeProviderAction(entry, index) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    throw new BrowserGameAgentError("A provider action is invalid.", "GAME_ACTIONS_INVALID");
  }
  const id = String(entry.id || `action-${index + 1}`).trim();
  if (!ACTION_ID_PATTERN.test(id)) {
    throw new BrowserGameAgentError("A provider action id is invalid.", "GAME_ACTIONS_INVALID");
  }
  const action = cloneBoundedJson(entry.action, {
    label: "provider semantic action",
    maxBytes: 8 * 1024,
    maxDepth: 8,
    maxNodes: 256
  });
  rejectUnsafeActionShape(action);
  const risk = SAFE_RISKS.has(entry.risk) ? entry.risk : "low";
  return Object.freeze({
    id,
    label: boundedText(entry.label || id, 180),
    group: boundedText(entry.group || "game", 80),
    description: boundedText(entry.description || "", 500),
    risk,
    requiresConfirmation: entry.requiresConfirmation === true,
    action
  });
}

function rejectUnsafeActionShape(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BrowserGameAgentError("A semantic action must be an object.", "GAME_ACTIONS_INVALID");
  }
  const pending = [value];
  while (pending.length) {
    const current = pending.pop();
    for (const [key, child] of Object.entries(current)) {
      if (FORBIDDEN_ACTION_KEYS.has(key)) {
        throw new BrowserGameAgentError("Unsafe browser control fields are forbidden.", "GAME_ACTION_UNSAFE");
      }
      if (child && typeof child === "object") pending.push(child);
    }
  }
}

function normalizeHostActionRequest(request) {
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    throw new BrowserGameAgentError("The browser action request is invalid.", "GAME_ACTION_REQUEST_INVALID");
  }
  const keys = Object.keys(request).sort().join(",");
  if (keys !== "actionId,clientActionId,expectedRevision") {
    throw new BrowserGameAgentError("Only an opaque actionId is accepted.", "GAME_ACTION_REQUEST_INVALID");
  }
  const actionId = String(request.actionId || "").trim();
  if (!ACTION_TOKEN_PATTERN.test(actionId)) {
    throw new BrowserGameAgentError("The action token is invalid.", "GAME_ACTION_TOKEN_INVALID");
  }
  return Object.freeze({
    actionId,
    clientActionId: normalizeClientActionId(request.clientActionId),
    expectedRevision: normalizeGameRevision(request.expectedRevision)
  });
}

function validateActionResult(result, gameId, sessionId, clientActionId) {
  validateEnvelope(result, gameId, "action result", sessionId);
  validateEnvelope(result?.observation, gameId, "action result observation", sessionId);
  if (result.clientActionId !== clientActionId
    || !["applied", "noop", "rejected"].includes(result.status)
    || result.observation.revision !== result.revision) {
    throw new BrowserGameAgentError("The provider action result is invalid.", "GAME_ACTION_RESULT_INVALID");
  }
}

function createOpaqueActionId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let binary = "";
  bytes.forEach((value) => { binary += String.fromCharCode(value); });
  return `act_${btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "")}`;
}

function boundedText(value, maxLength) {
  const text = String(value || "").normalize("NFKC").trim();
  if (text.length > maxLength || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(text)) {
    throw new BrowserGameAgentError("A provider label is invalid.", "GAME_ACTIONS_INVALID");
  }
  return text;
}
