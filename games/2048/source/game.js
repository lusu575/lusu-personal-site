import {
  GAME_2048_DIRECTIONS,
  apply2048Action,
  create2048State,
  observe2048State,
  restore2048State,
  serialize2048State
} from "./engine.mjs?v=20260806-whiteboard-2048-agent-r1";

const GAME_AGENT_PROTOCOL_VERSION = 1;
const GAME_AGENT_MAX_REVISION = 1_000_000_000;
const GAME_2048_MAX_SCORE = 1_000_000_000_000_000;
const CLIENT_ACTION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const FORBIDDEN_OBJECT_KEYS = new Set(["__proto__", "prototype", "constructor"]);

class GameProtocolError extends Error {
  constructor(message, code = "GAME_PROTOCOL_ERROR") {
    super(message);
    this.name = "GameProtocolError";
    this.code = code;
  }
}

function createBrowser2048Adapter() {
  return Object.freeze({
    gameId: "2048",
    create(options = {}) {
      return create2048State(options);
    },
    restore(value, options = {}) {
      return restore2048State(value, options);
    },
    serialize(value) {
      return serialize2048State(value);
    },
    revision(value) {
      return restore2048State(value).revision;
    },
    observe(value) {
      return deepFreezeJson(observe2048State(value));
    },
    actions(value) {
      const observation = observe2048State(value);
      const actions = observation.state.availableMoves.map((direction) => ({
        id: `move-${direction}`,
        action: { type: "move", direction },
        risk: "low",
        requiresConfirmation: false
      }));
      actions.push({
        id: "reset",
        action: { type: "reset", confirm: true },
        risk: "high",
        requiresConfirmation: true
      });
      return deepFreezeJson(actions);
    },
    normalizeAction(action) {
      return normalize2048Action(action);
    },
    act(value, action) {
      const outcome = apply2048Action(restore2048State(value), normalize2048Action(action));
      return Object.freeze({
        status: outcome.status,
        reason: outcome.reason,
        state: outcome.state,
        events: outcome.events
      });
    }
  });
}

function normalize2048Action(action) {
  const normalized = cloneBoundedJson(action, {
    label: "2048 action",
    maxBytes: 1024,
    maxDepth: 3,
    maxNodes: 16
  });
  if (!normalized || typeof normalized !== "object" || Array.isArray(normalized)) {
    throw new GameProtocolError("The 2048 action must be an object.", "GAME_2048_ACTION_INVALID");
  }
  if (normalized.type === "move") {
    assertExactKeys(normalized, ["type", "direction"], "GAME_2048_ACTION_INVALID");
    if (!GAME_2048_DIRECTIONS.includes(normalized.direction)) {
      throw new GameProtocolError("The 2048 direction is invalid.", "GAME_2048_ACTION_INVALID");
    }
    return Object.freeze({ type: "move", direction: normalized.direction });
  }
  if (normalized.type === "reset") {
    const keys = Object.keys(normalized);
    if (keys.some((key) => key !== "type" && key !== "confirm") || !keys.includes("type")) {
      throw new GameProtocolError("The 2048 reset action is invalid.", "GAME_2048_ACTION_INVALID");
    }
    return Object.freeze({ type: "reset", confirm: normalized.confirm === true });
  }
  throw new GameProtocolError("Unsupported 2048 action type.", "GAME_2048_ACTION_UNSUPPORTED");
}

function createGameSessionId(gameId) {
  let randomPart = "";
  if (typeof globalThis.crypto?.randomUUID === "function") {
    randomPart = globalThis.crypto.randomUUID().replaceAll("-", "").toLowerCase();
  } else if (typeof globalThis.crypto?.getRandomValues === "function") {
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
    randomPart = [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
  }
  if (!/^[a-f0-9]{32}$/.test(randomPart)) {
    throw new GameProtocolError("A secure session id generator is unavailable.", "GAME_SESSION_RANDOM_UNAVAILABLE");
  }
  return `game_${gameId}_${randomPart}`;
}

function normalizeGameActionRequest(value) {
  const request = cloneBoundedJson(value, {
    label: "game action request",
    maxBytes: 8 * 1024,
    maxDepth: 8,
    maxNodes: 256
  });
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    throw new GameProtocolError("The game action request must be an object.", "GAME_ACTION_REQUEST_INVALID");
  }
  assertExactKeys(request, ["action", "clientActionId", "expectedRevision"], "GAME_ACTION_REQUEST_INVALID");
  const revision = Number(request.expectedRevision);
  if (!Number.isSafeInteger(revision) || revision < 0 || revision > GAME_AGENT_MAX_REVISION) {
    throw new GameProtocolError("The game revision is invalid.", "GAME_REVISION_INVALID");
  }
  const clientActionId = String(request.clientActionId || "").trim();
  if (!CLIENT_ACTION_ID_PATTERN.test(clientActionId)) {
    throw new GameProtocolError("The client action id is invalid.", "GAME_CLIENT_ACTION_ID_INVALID");
  }
  return Object.freeze({
    expectedRevision: revision,
    clientActionId,
    action: deepFreezeJson(request.action)
  });
}

function createGameObservationEnvelope(input) {
  const observation = cloneBoundedJson(input.observation, {
    label: "game observation",
    maxBytes: 64 * 1024,
    maxDepth: 16,
    maxNodes: 10_000
  });
  if (!observation || typeof observation !== "object" || Array.isArray(observation)) {
    throw new GameProtocolError("The game observation must be an object.", "GAME_OBSERVATION_INVALID");
  }
  if (["protocolVersion", "gameId", "sessionId", "revision"].some((key) => Object.hasOwn(observation, key))) {
    throw new GameProtocolError("The game observation uses a reserved key.", "GAME_OBSERVATION_RESERVED_KEY");
  }
  return deepFreezeJson({
    protocolVersion: GAME_AGENT_PROTOCOL_VERSION,
    gameId: input.gameId,
    sessionId: input.sessionId,
    revision: input.revision,
    ...observation
  });
}

function createGameActionsEnvelope(input) {
  const actions = cloneBoundedJson(input.actions, {
    label: "game actions",
    maxBytes: 64 * 1024,
    maxDepth: 12,
    maxNodes: 2_000
  });
  if (!Array.isArray(actions)) {
    throw new GameProtocolError("The game actions must be an array.", "GAME_ACTIONS_INVALID");
  }
  return deepFreezeJson({
    protocolVersion: GAME_AGENT_PROTOCOL_VERSION,
    gameId: input.gameId,
    sessionId: input.sessionId,
    revision: input.revision,
    actions
  });
}

function createGameActionResult(input) {
  const events = cloneBoundedJson(input.events || [], {
    label: "game action events",
    maxBytes: 16 * 1024,
    maxDepth: 10,
    maxNodes: 2_000
  });
  const observation = createGameObservationEnvelope({
    gameId: input.gameId,
    sessionId: input.sessionId,
    revision: input.revision,
    observation: input.observation
  });
  return deepFreezeJson({
    protocolVersion: GAME_AGENT_PROTOCOL_VERSION,
    gameId: input.gameId,
    sessionId: input.sessionId,
    clientActionId: input.clientActionId,
    status: input.status,
    reason: input.reason,
    beforeRevision: input.beforeRevision,
    revision: input.revision,
    deduplicated: input.deduplicated === true,
    events,
    observation
  });
}

function cloneBoundedJson(value, options = {}) {
  inspectPlainJson(value, {
    label: options.label || "JSON value",
    maxDepth: options.maxDepth || 16,
    maxNodes: options.maxNodes || 10_000
  });
  const text = JSON.stringify(value);
  if (new TextEncoder().encode(text).byteLength > (options.maxBytes || 64 * 1024)) {
    throw new GameProtocolError(`${options.label || "JSON value"} is too large.`, "GAME_JSON_TOO_LARGE");
  }
  return JSON.parse(text);
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
      for (const key of Object.keys(value)) {
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

function deepFreezeJson(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreezeJson);
  return Object.freeze(value);
}

function assertExactKeys(value, allowedKeys, code) {
  const allowed = new Set(allowedKeys);
  const keys = Object.keys(value);
  if (keys.length !== allowed.size || keys.some((key) => !allowed.has(key))) {
    throw new GameProtocolError("The object contains unsupported fields.", code);
  }
}

const params = new URLSearchParams(window.location.search);
const lang = ["zh", "en", "ja"].includes(params.get("lang")) ? params.get("lang") : "zh";
const saveKey = "lusu.2048.save";
const bestKey = "lusu.2048.best";
const langKey = "lusu.2048.lang";
const adapter = createBrowser2048Adapter();
const bridgeSessionId = createGameSessionId(adapter.gameId);
const bridgeDedupe = [];

const dict = {
  zh: {
    eyebrow: "LuSu 游戏舱",
    score: "分数",
    best: "最佳",
    newGame: "新游戏",
    hint: "使用方向键或滑动移动方块。",
    keepPlaying: "继续玩",
    win: "合成成功！",
    winCopy: "你已经拼出 2048，还可以继续挑战更高分。",
    over: "游戏结束",
    overCopy: "没有可移动的方块了，重新开一局吧。"
  },
  en: {
    eyebrow: "LuSu Games",
    score: "Score",
    best: "Best",
    newGame: "New Game",
    hint: "Use arrow keys or swipe to move tiles.",
    keepPlaying: "Keep Playing",
    win: "Tile reached!",
    winCopy: "You made 2048. Keep going for a higher score.",
    over: "Game Over",
    overCopy: "No moves left. Start a fresh run."
  },
  ja: {
    eyebrow: "LuSu ゲーム",
    score: "スコア",
    best: "ベスト",
    newGame: "新規ゲーム",
    hint: "矢印キーまたはスワイプでタイルを動かします。",
    keepPlaying: "続ける",
    win: "合成成功！",
    winCopy: "2048 ができました。さらに高得点を目指せます。",
    over: "ゲーム終了",
    overCopy: "動かせるタイルがありません。新しく始めましょう。"
  }
};

const boardEl = document.getElementById("board");
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayCopy = document.getElementById("overlay-copy");
let state = loadState();

function text(key) {
  return dict[lang][key] || dict.zh[key] || key;
}

function applyLang() {
  document.documentElement.lang = lang === "zh" ? "zh-CN" : lang;
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = text(node.dataset.i18n);
  });
  safeSetStorageItem(langKey, lang);
}

function draw() {
  const observation = adapter.observe(state);
  boardEl.replaceChildren();
  observation.state.board.flat().forEach((value) => {
    const cell = document.createElement("div");
    cell.className = `cell tile-${value || 0}`;
    cell.textContent = value || "";
    boardEl.appendChild(cell);
  });
  scoreEl.textContent = String(observation.score.current);
  bestEl.textContent = String(observation.score.best);
  safeSetStorageItem(bestKey, String(observation.score.best));
  save();
}

function move(direction) {
  const outcome = adapter.act(state, { type: "move", direction });
  if (outcome.status !== "applied") return outcome;
  state = outcome.state;
  draw();
  showOutcomeOverlay(outcome.events);
  return outcome;
}

function resetGame() {
  const outcome = adapter.act(state, { type: "reset", confirm: true });
  state = outcome.state;
  overlay.hidden = true;
  draw();
  return outcome;
}

function save() {
  const payload = adapter.serialize(state);
  safeSetStorageItem(saveKey, JSON.stringify({
    ...payload,
    savedAt: new Date().toISOString()
  }));
}

function loadState() {
  const best = readBestScore();
  const raw = safeGetStorageItem(saveKey);
  try {
    const restored = raw ? adapter.restore(JSON.parse(raw), { best }) : null;
    if (restored && !adapter.observe(restored).terminal) return restored;
  } catch {
    // Invalid or legacy saves fall back to a fresh bounded engine state.
  }
  return adapter.create({ best });
}

function showOutcomeOverlay(events) {
  if (events.some((event) => event.type === "game_over")) {
    showOverlay(text("over"), text("overCopy"));
    return;
  }
  if (events.some((event) => event.type === "won")) {
    showOverlay(text("win"), text("winCopy"));
  }
}

function showOverlay(title, copy) {
  overlayTitle.textContent = title;
  overlayCopy.textContent = copy;
  overlay.hidden = false;
}

function bridgeObserve() {
  return createGameObservationEnvelope({
    gameId: adapter.gameId,
    sessionId: bridgeSessionId,
    revision: adapter.revision(state),
    observation: adapter.observe(state)
  });
}

function bridgeActions() {
  return createGameActionsEnvelope({
    gameId: adapter.gameId,
    sessionId: bridgeSessionId,
    revision: adapter.revision(state),
    actions: adapter.actions(state)
  });
}

function bridgeAct(request) {
  const normalizedRequest = normalizeGameActionRequest(request);
  const normalizedAction = adapter.normalizeAction(normalizedRequest.action);
  const fingerprint = JSON.stringify({
    expectedRevision: normalizedRequest.expectedRevision,
    action: normalizedAction
  });
  const prior = bridgeDedupe.find((entry) => entry.clientActionId === normalizedRequest.clientActionId);
  if (prior) {
    if (prior.fingerprint !== fingerprint) {
      throw new GameProtocolError(
        "The client action id was already used for another browser action.",
        "GAME_CLIENT_ACTION_ID_REUSED"
      );
    }
    return deepFreezeJson({ ...cloneBoundedJson(prior.result), deduplicated: true });
  }

  const beforeRevision = adapter.revision(state);
  let result;
  if (normalizedRequest.expectedRevision !== beforeRevision) {
    result = createGameActionResult({
      gameId: adapter.gameId,
      sessionId: bridgeSessionId,
      clientActionId: normalizedRequest.clientActionId,
      status: "rejected",
      reason: "revision-conflict",
      beforeRevision,
      revision: beforeRevision,
      deduplicated: false,
      events: [],
      observation: adapter.observe(state)
    });
  } else {
    const outcome = adapter.act(state, normalizedAction);
    state = outcome.state;
    const revision = adapter.revision(state);
    result = createGameActionResult({
      gameId: adapter.gameId,
      sessionId: bridgeSessionId,
      clientActionId: normalizedRequest.clientActionId,
      status: outcome.status,
      reason: outcome.reason,
      beforeRevision,
      revision,
      deduplicated: false,
      events: outcome.events,
      observation: adapter.observe(state)
    });
    if (outcome.status === "applied") {
      draw();
      showOutcomeOverlay(outcome.events);
    }
  }

  bridgeDedupe.push({
    clientActionId: normalizedRequest.clientActionId,
    fingerprint,
    result: cloneBoundedJson(result)
  });
  if (bridgeDedupe.length > 128) bridgeDedupe.splice(0, bridgeDedupe.length - 128);
  return result;
}

function readBestScore() {
  const value = Number(safeGetStorageItem(bestKey) || 0);
  return Number.isSafeInteger(value) && value >= 0 && value <= GAME_2048_MAX_SCORE ? value : 0;
}

function safeGetStorageItem(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetStorageItem(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // The game remains playable when storage is unavailable or full.
  }
}

const agentBridge = Object.freeze({
  protocolVersion: GAME_AGENT_PROTOCOL_VERSION,
  gameId: adapter.gameId,
  sessionId: bridgeSessionId,
  observe: bridgeObserve,
  actions: bridgeActions,
  act: bridgeAct
});

window.gamePage = Object.freeze({ save, agent: agentBridge });
applyLang();
draw();

document.getElementById("new-game").addEventListener("click", resetGame);
document.getElementById("keep-playing").addEventListener("click", () => {
  if (adapter.observe(state).terminal) {
    resetGame();
  } else {
    overlay.hidden = true;
  }
});

window.addEventListener("keydown", (event) => {
  const map = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" };
  if (map[event.key]) {
    event.preventDefault();
    move(map[event.key]);
  }
});

let touchStart = null;
boardEl.addEventListener("touchstart", (event) => {
  const touch = event.touches[0];
  touchStart = { x: touch.clientX, y: touch.clientY };
}, { passive: true });

boardEl.addEventListener("touchend", (event) => {
  if (!touchStart) return;
  const touch = event.changedTouches[0];
  const dx = touch.clientX - touchStart.x;
  const dy = touch.clientY - touchStart.y;
  touchStart = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 28) return;
  move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
}, { passive: true });
