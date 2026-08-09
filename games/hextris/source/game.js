/*
 * Hextris compatibility implementation for LuSu's Personal Site.
 * Copyright (C) 2026 LuSu
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * This implementation was adapted for trilingual site integration and local
 * saves. See COPYING and ../NOTICE.md. Modified 2026-08-07.
 */

const params = new URLSearchParams(window.location.search);
const lang = ["zh", "en", "ja"].includes(params.get("lang")) ? params.get("lang") : "zh";
const saveKey = "lusu.hextris.save";
const bestKey = "lusu.hextris.best";
const langKey = "lusu.hextris.lang";
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const overlay = document.getElementById("overlay");
const colors = ["#f45b69", "#ffd166", "#06d6a0", "#118ab2", "#8b5cf6", "#ff9f1c"];

const dict = {
  zh: {
    eyebrow: "LuSu 游戏舱",
    score: "分数",
    best: "最佳",
    left: "左转",
    right: "右转",
    newGame: "新游戏",
    over: "游戏结束",
    overCopy: "色块堆到中心了，重新开一局吧。",
    hint: "用方向键、A/D 或按钮旋转六边形。三个相邻同色会消除。"
  },
  en: {
    eyebrow: "LuSu Games",
    score: "Score",
    best: "Best",
    left: "Left",
    right: "Right",
    newGame: "New Game",
    over: "Game Over",
    overCopy: "Blocks reached the center. Start a fresh run.",
    hint: "Rotate with arrow keys, A/D, or buttons. Three adjacent matching colors clear."
  },
  ja: {
    eyebrow: "LuSu ゲーム",
    score: "スコア",
    best: "ベスト",
    left: "左回転",
    right: "右回転",
    newGame: "新規ゲーム",
    over: "ゲーム終了",
    overCopy: "ブロックが中心まで届きました。新しく始めましょう。",
    hint: "矢印キー、A/D、ボタンで六角形を回転します。同じ色が3つ並ぶと消えます。"
  }
};

let lanes = [];
let active = null;
let rotation = 0;
let score = 0;
let best = Number(localStorage.getItem(bestKey) || "0");
let running = true;
let lastTime = 0;
let spawnTimer = 0;
let agentControlMode = false;
let agentRevision = 0;
let agentFingerprint = "";
const agentSessionId = `game_hextris_${secureHex(16)}`;
const agentReceipts = [];

function text(key) {
  return dict[lang][key] || dict.zh[key] || key;
}

function applyLang() {
  document.documentElement.lang = lang === "zh" ? "zh-CN" : lang;
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = text(node.dataset.i18n);
  });
  localStorage.setItem(langKey, lang);
}

function newGame() {
  lanes = Array.from({ length: 6 }, () => []);
  active = null;
  rotation = 0;
  score = 0;
  running = true;
  spawnTimer = 0;
  overlay.hidden = true;
  save();
  draw();
}

function save() {
  localStorage.setItem(saveKey, JSON.stringify({ lanes, active, rotation, score, running, savedAt: new Date().toISOString() }));
  localStorage.setItem(bestKey, String(best));
}

function load() {
  const raw = localStorage.getItem(saveKey);
  try {
    const data = raw ? JSON.parse(raw) : null;
    if (Array.isArray(data?.lanes) && data.lanes.length === 6) {
      lanes = data.lanes;
      active = data.active || null;
      rotation = Number(data.rotation || 0);
      score = Number(data.score || 0);
      running = data.running !== false;
      if (!running || lanes.some((lane) => Array.isArray(lane) && lane.length > 8)) {
        newGame();
      }
      return;
    }
  } catch {}
  newGame();
}

function rotate(delta) {
  rotation = (rotation + delta + 6) % 6;
  save();
  draw();
}

function spawn() {
  if (active) return;
  active = {
    lane: Math.floor(Math.random() * 6),
    distance: 280,
    color: colors[Math.floor(Math.random() * colors.length)]
  };
}

function step(delta) {
  if (!running || agentControlMode) return;
  spawnTimer += delta;
  if (spawnTimer > 850) {
    spawn();
    spawnTimer = 0;
  }
  if (active) {
    active.distance -= delta * 0.075;
    const laneIndex = (active.lane + rotation) % 6;
    const stackDistance = 52 + lanes[laneIndex].length * 24;
    if (active.distance <= stackDistance) {
      lanes[laneIndex].push(active.color);
      active = null;
      clearMatches();
      if (lanes.some((lane) => lane.length > 8)) {
        running = false;
        overlay.hidden = false;
      }
      save();
    }
  }
}

function colorId(value) {
  const index = colors.indexOf(value);
  return index >= 0 ? index : null;
}

function currentAgentFingerprint() {
  return JSON.stringify({
    agentControlMode,
    lanes: lanes.map((lane) => lane.map(colorId)),
    active: active ? { lane: active.lane, color: colorId(active.color) } : null,
    rotation,
    score,
    best,
    running
  });
}

function syncAgentRevision() {
  const next = currentAgentFingerprint();
  if (agentFingerprint && next !== agentFingerprint) agentRevision += 1;
  agentFingerprint = next;
  return agentRevision;
}

function agentObservation() {
  syncAgentRevision();
  return Object.freeze({
    protocolVersion: 1,
    gameId: "hextris",
    sessionId: agentSessionId,
    revision: agentRevision,
    phase: running ? "active" : "over",
    terminal: !running,
    score: Object.freeze({ current: score, best }),
    state: Object.freeze({
      mode: agentControlMode ? "semantic-step" : "realtime",
      lanes: Object.freeze(lanes.map((lane) => Object.freeze(lane.map(colorId)))),
      heights: Object.freeze(lanes.map((lane) => lane.length)),
      active: active ? Object.freeze({
        sourceLane: active.lane,
        displayedLane: (active.lane + rotation) % 6,
        colorId: colorId(active.color)
      }) : null,
      rotation,
      availableLanes: Object.freeze(running ? [0, 1, 2, 3, 4, 5] : [])
    })
  });
}

function agentActions() {
  const observation = agentObservation();
  const actions = observation.terminal ? [] : [0, 1, 2, 3, 4, 5].map((lane) => Object.freeze({
    id: `place-lane-${lane}`,
    label: `Place the current color in lane ${lane}`,
    group: "board",
    description: `Commit the current falling color to semantic lane ${lane}.`,
    action: Object.freeze({ type: "place", lane }),
    risk: "low",
    requiresConfirmation: false
  }));
  actions.push(Object.freeze({
    id: "reset",
    label: "Start a new Hextris game",
    group: "game",
    description: "Clear the current board and score.",
    action: Object.freeze({ type: "reset", confirm: true }),
    risk: "high",
    requiresConfirmation: true
  }));
  return Object.freeze({
    protocolVersion: 1,
    gameId: "hextris",
    sessionId: agentSessionId,
    revision: observation.revision,
    actions: Object.freeze(actions)
  });
}

function normalizeAgentRequest(request) {
  if (!request || typeof request !== "object" || Array.isArray(request)
    || Object.keys(request).sort().join(",") !== "action,clientActionId,expectedRevision") {
    throw agentError("GAME_ACTION_REQUEST_INVALID", "Invalid Hextris action request.");
  }
  const expectedRevision = Number(request.expectedRevision);
  const clientActionId = String(request.clientActionId || "");
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0
    || !/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(clientActionId)) {
    throw agentError("GAME_ACTION_REQUEST_INVALID", "Invalid Hextris action identity.");
  }
  const action = request.action;
  if (!action || typeof action !== "object" || Array.isArray(action)) {
    throw agentError("GAME_ACTION_INVALID", "Invalid Hextris semantic action.");
  }
  const keys = Object.keys(action).sort().join(",");
  if (action.type === "place" && keys === "lane,type"
    && Number.isInteger(action.lane) && action.lane >= 0 && action.lane < 6) {
    return { expectedRevision, clientActionId, action: { type: "place", lane: action.lane } };
  }
  if (action.type === "reset" && keys === "confirm,type" && action.confirm === true) {
    return { expectedRevision, clientActionId, action: { type: "reset", confirm: true } };
  }
  throw agentError("GAME_ACTION_UNSUPPORTED", "Unsupported Hextris semantic action.");
}

function agentAct(request) {
  const normalized = normalizeAgentRequest(request);
  const fingerprint = JSON.stringify({
    expectedRevision: normalized.expectedRevision,
    action: normalized.action
  });
  const prior = agentReceipts.find((entry) => entry.clientActionId === normalized.clientActionId);
  if (prior) {
    if (prior.fingerprint !== fingerprint) {
      throw agentError("GAME_CLIENT_ACTION_ID_REUSED", "The client action id was reused.");
    }
    return Object.freeze({ ...prior.result, deduplicated: true });
  }

  const beforeRevision = syncAgentRevision();
  let status = "rejected";
  let reason = "revision-conflict";
  let events = [];
  if (normalized.expectedRevision === beforeRevision) {
    if (normalized.action.type === "reset") {
      newGame();
      status = "applied";
      reason = "reset";
      events = [{ type: "game_reset" }];
    } else if (!running) {
      reason = "game-over";
    } else {
      if (!active) spawn();
      const placedColor = active.color;
      rotation = (normalized.action.lane - active.lane + 6) % 6;
      lanes[normalized.action.lane].push(placedColor);
      active = null;
      clearMatches();
      if (lanes.some((lane) => lane.length > 8)) {
        running = false;
        overlay.hidden = false;
        events.push({ type: "game_over", score });
      } else {
        spawn();
      }
      save();
      draw();
      status = "applied";
      reason = "placed";
      events.unshift({ type: "color_placed", lane: normalized.action.lane, colorId: colorId(placedColor) });
    }
  }

  if (status === "applied") agentRevision = beforeRevision + 1;
  agentFingerprint = currentAgentFingerprint();
  const observation = agentObservation();
  const result = Object.freeze({
    protocolVersion: 1,
    gameId: "hextris",
    sessionId: agentSessionId,
    clientActionId: normalized.clientActionId,
    status,
    reason,
    beforeRevision,
    revision: observation.revision,
    deduplicated: false,
    events: Object.freeze(events.map((event) => Object.freeze(event))),
    observation
  });
  agentReceipts.push({ clientActionId: normalized.clientActionId, fingerprint, result });
  if (agentReceipts.length > 128) agentReceipts.splice(0, agentReceipts.length - 128);
  return result;
}

function setAgentControlMode(value) {
  agentControlMode = value === true;
  if (agentControlMode && running && !active) spawn();
  syncAgentRevision();
  draw();
}

function secureHex(length) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function agentError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function clearMatches() {
  let cleared = 0;
  for (let i = 0; i < 6; i += 1) {
    const left = lanes[(i + 5) % 6];
    const mid = lanes[i];
    const right = lanes[(i + 1) % 6];
    const level = Math.min(left.length, mid.length, right.length) - 1;
    if (level >= 0) {
      const color = mid[level];
      if (left[level] === color && right[level] === color) {
        left.splice(level, 1);
        mid.splice(level, 1);
        right.splice(level, 1);
        cleared += 3;
      }
    }
  }
  if (cleared) {
    score += cleared * 10;
    best = Math.max(best, score);
    clearMatches();
  }
}

function point(cx, cy, angle, radius) {
  return {
    x: cx + Math.cos(angle) * radius,
    y: cy + Math.sin(angle) * radius
  };
}

function drawHex(cx, cy, radius, fill, stroke = "#23477f") {
  ctx.beginPath();
  for (let i = 0; i < 6; i += 1) {
    const p = point(cx, cy, Math.PI / 6 + i * Math.PI / 3, radius);
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = stroke;
  ctx.stroke();
}

function drawBlock(lane, distance, color) {
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const angle = -Math.PI / 2 + lane * Math.PI / 3;
  const p = point(cx, cy, angle, distance);
  drawHex(p.x, p.y, 18, color, "#ffffff");
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  for (let lane = 0; lane < 6; lane += 1) {
    const angle = -Math.PI / 2 + lane * Math.PI / 3;
    const end = point(cx, cy, angle, 296);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(end.x, end.y);
    ctx.strokeStyle = "rgba(24, 80, 173, 0.16)";
    ctx.lineWidth = 5;
    ctx.stroke();
  }
  lanes.forEach((stack, lane) => {
    stack.forEach((color, index) => drawBlock(lane, 52 + index * 24, color));
  });
  if (active) {
    drawBlock((active.lane + rotation) % 6, active.distance, active.color);
  }
  drawHex(cx, cy, 46, "#fff8d7", "#1850ad");
  ctx.fillStyle = "#1542a0";
  ctx.font = "900 26px Tahoma";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String((rotation * 60) % 360), cx, cy);
  scoreEl.textContent = score;
  best = Math.max(best, score);
  bestEl.textContent = best;
}

function loop(time) {
  const delta = Math.min(time - lastTime || 16, 40);
  lastTime = time;
  step(delta);
  draw();
  requestAnimationFrame(loop);
}

applyLang();
load();
if (!running) overlay.hidden = false;
draw();
agentFingerprint = currentAgentFingerprint();
const agentBridge = Object.freeze({
  protocolVersion: 1,
  gameId: "hextris",
  sessionId: agentSessionId,
  observe: agentObservation,
  actions: agentActions,
  act: agentAct,
  setControlMode: setAgentControlMode
});
window.gamePage = Object.freeze({ save, agent: agentBridge });
requestAnimationFrame(loop);

document.getElementById("rotate-left").addEventListener("click", () => { if (!agentControlMode) rotate(-1); });
document.getElementById("rotate-right").addEventListener("click", () => { if (!agentControlMode) rotate(1); });
document.getElementById("new-game").addEventListener("click", () => { if (!agentControlMode) newGame(); });
document.getElementById("restart").addEventListener("click", () => { if (!agentControlMode) newGame(); });

window.addEventListener("keydown", (event) => {
  if (agentControlMode) return;
  if (["ArrowLeft", "a", "A"].includes(event.key)) {
    event.preventDefault();
    rotate(-1);
  }
  if (["ArrowRight", "d", "D"].includes(event.key)) {
    event.preventDefault();
    rotate(1);
  }
});

let touchStart = null;
canvas.addEventListener("touchstart", (event) => {
  if (agentControlMode) return;
  const touch = event.touches[0];
  touchStart = { x: touch.clientX, y: touch.clientY };
}, { passive: true });

canvas.addEventListener("touchend", (event) => {
  if (agentControlMode) return;
  if (!touchStart) return;
  const touch = event.changedTouches[0];
  const dx = touch.clientX - touchStart.x;
  touchStart = null;
  if (Math.abs(dx) > 24) rotate(dx > 0 ? 1 : -1);
}, { passive: true });
