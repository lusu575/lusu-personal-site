/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (C) 2026 LuSu personal site contributors
 *
 * This program is free software: you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation, either version 3 of the License, or any later version.
 */

export const HEXTRIS_STATE_VERSION = 1;
export const HEXTRIS_LANE_COUNT = 6;
export const HEXTRIS_MAX_BLOCKS_PER_LANE = 9;
export const HEXTRIS_MATCH_LENGTH = 3;
export const HEXTRIS_MATCH_SCORE = 30;
export const HEXTRIS_COLOR_IDS = Object.freeze([
  "red",
  "yellow",
  "green",
  "blue",
  "purple",
  "orange"
]);

const DEFAULT_NON_ZERO_SEED = 0x6d2b79f5;
const UINT32_MAX = 0xffffffff;
const UINT32_RANGE = 0x100000000;
const MAX_SCORE = 1_000_000_000_000_000;
const MAX_COUNTER = 1_000_000_000;
const STATE_KEYS = Object.freeze([
  "best",
  "incoming",
  "lanes",
  "over",
  "placementCount",
  "revision",
  "rngState",
  "score",
  "version"
]);
const INCOMING_KEYS = Object.freeze(["color", "sourceLane"]);
const CREATE_OPTION_KEYS = Object.freeze(["best", "seed"]);

export class HextrisEngineError extends Error {
  constructor(message, code = "HEXTRIS_ENGINE_ERROR") {
    super(message);
    this.name = "HextrisEngineError";
    this.code = code;
  }
}

export function createHextrisState(options = {}) {
  assertPlainRecord(options, "Hextris create options", "HEXTRIS_CREATE_OPTIONS_INVALID");
  assertAllowedKeys(options, CREATE_OPTION_KEYS, "Hextris create options", "HEXTRIS_CREATE_OPTIONS_INVALID");

  const best = normalizeScore(options.best ?? 0, "best");
  const seed = normalizeCreateSeed(options.seed);
  const spawned = spawnIncoming(seed);
  return freezeHextrisState({
    version: HEXTRIS_STATE_VERSION,
    lanes: emptyHextrisLanes(),
    incoming: spawned.incoming,
    score: 0,
    best,
    placementCount: 0,
    revision: 0,
    over: false,
    rngState: spawned.rngState
  });
}

export function restoreHextrisState(value) {
  assertPlainRecord(value, "Hextris state", "HEXTRIS_STATE_INVALID");
  assertExactKeys(value, STATE_KEYS, "Hextris state", "HEXTRIS_STATE_INVALID");
  if (value.version !== HEXTRIS_STATE_VERSION) {
    throw new HextrisEngineError(
      "The Hextris state version is unsupported.",
      "HEXTRIS_STATE_VERSION_UNSUPPORTED"
    );
  }

  const lanes = normalizeLanes(value.lanes);
  const score = normalizeScore(value.score, "score");
  const best = normalizeScore(value.best, "best");
  const placementCount = normalizeCounter(value.placementCount, "placementCount");
  const revision = normalizeCounter(value.revision, "revision");
  const rngState = normalizeStoredRngState(value.rngState);

  if (best < score) {
    throw new HextrisEngineError("best cannot be lower than score.", "HEXTRIS_STATE_INVALID");
  }
  if (placementCount > revision) {
    throw new HextrisEngineError(
      "placementCount cannot exceed revision.",
      "HEXTRIS_STATE_INVALID"
    );
  }
  if (typeof value.over !== "boolean") {
    throw new HextrisEngineError("over must be a boolean.", "HEXTRIS_STATE_INVALID");
  }

  const derivedOver = lanes.some((lane) => lane.length > HEXTRIS_MAX_BLOCKS_PER_LANE - 1);
  if (value.over !== derivedOver) {
    throw new HextrisEngineError(
      "over does not match the lane capacity.",
      "HEXTRIS_STATE_INVALID"
    );
  }

  let incoming = null;
  if (derivedOver) {
    if (value.incoming !== null) {
      throw new HextrisEngineError(
        "A terminal Hextris state cannot contain an incoming piece.",
        "HEXTRIS_STATE_INVALID"
      );
    }
  } else {
    incoming = normalizeIncoming(value.incoming);
  }

  return freezeHextrisState({
    version: HEXTRIS_STATE_VERSION,
    lanes,
    incoming,
    score,
    best,
    placementCount,
    revision,
    over: derivedOver,
    rngState
  });
}

export function serializeHextrisState(value) {
  const state = restoreHextrisState(value);
  return {
    version: state.version,
    lanes: state.lanes.map((lane) => [...lane]),
    incoming: state.incoming ? { ...state.incoming } : null,
    score: state.score,
    best: state.best,
    placementCount: state.placementCount,
    revision: state.revision,
    over: state.over,
    rngState: state.rngState
  };
}

export function observeHextrisState(value) {
  const state = restoreHextrisState(value);
  const availableLanes = state.over
    ? Object.freeze([])
    : Object.freeze(Array.from({ length: HEXTRIS_LANE_COUNT }, (_, lane) => lane));
  const lanes = Object.freeze(state.lanes.map((lane) => Object.freeze([...lane])));
  const laneHeights = Object.freeze(state.lanes.map((lane) => lane.length));
  const incoming = state.incoming ? Object.freeze({ ...state.incoming }) : null;

  return Object.freeze({
    phase: state.over ? "over" : "active",
    terminal: state.over,
    score: Object.freeze({ current: state.score, best: state.best }),
    state: Object.freeze({
      lanes,
      laneHeights,
      incoming,
      placementCount: state.placementCount,
      availableLanes
    })
  });
}

export function listHextrisActions(value) {
  const state = restoreHextrisState(value);
  const actions = [];
  if (!state.over) {
    for (let lane = 0; lane < HEXTRIS_LANE_COUNT; lane += 1) {
      actions.push(Object.freeze({ type: "place", lane }));
    }
  }
  actions.push(Object.freeze({ type: "reset", confirm: true }));
  return Object.freeze(actions);
}

export function normalizeHextrisAction(action) {
  assertPlainRecord(action, "Hextris action", "HEXTRIS_ACTION_INVALID");

  if (action.type === "place") {
    assertExactKeys(action, ["lane", "type"], "Hextris place action", "HEXTRIS_ACTION_INVALID");
    if (!Number.isInteger(action.lane) || action.lane < 0 || action.lane >= HEXTRIS_LANE_COUNT) {
      throw new HextrisEngineError(
        "The Hextris placement lane must be an integer from 0 to 5.",
        "HEXTRIS_ACTION_INVALID"
      );
    }
    return Object.freeze({ type: "place", lane: action.lane });
  }

  if (action.type === "reset") {
    assertExactKeys(action, ["confirm", "type"], "Hextris reset action", "HEXTRIS_ACTION_INVALID");
    if (typeof action.confirm !== "boolean") {
      throw new HextrisEngineError(
        "The Hextris reset confirmation must be a boolean.",
        "HEXTRIS_ACTION_INVALID"
      );
    }
    return Object.freeze({ type: "reset", confirm: action.confirm });
  }

  throw new HextrisEngineError(
    "Unsupported Hextris action type.",
    "HEXTRIS_ACTION_UNSUPPORTED"
  );
}

export function applyHextrisAction(value, action) {
  const state = restoreHextrisState(value);
  const normalizedAction = normalizeHextrisAction(action);

  if (normalizedAction.type === "reset") {
    if (!normalizedAction.confirm) {
      return unchangedOutcome(state, "rejected", "confirmation-required");
    }
    assertCounterCanAdvance(state.revision, "revision", "HEXTRIS_REVISION_LIMIT");
    const resetState = createHextrisState({ seed: state.rngState, best: state.best });
    const nextState = freezeHextrisState({
      ...resetState,
      revision: state.revision + 1
    });
    return {
      status: "applied",
      reason: "reset",
      state: nextState,
      events: freezeEvents([
        { type: "game_reset" },
        {
          type: "piece_spawned",
          sourceLane: nextState.incoming.sourceLane,
          color: nextState.incoming.color
        }
      ])
    };
  }

  if (state.over) {
    return unchangedOutcome(state, "rejected", "game-over");
  }

  assertCounterCanAdvance(state.revision, "revision", "HEXTRIS_REVISION_LIMIT");
  assertCounterCanAdvance(
    state.placementCount,
    "placementCount",
    "HEXTRIS_PLACEMENT_LIMIT"
  );

  const placedPiece = state.incoming;
  const lanes = state.lanes.map((lane) => [...lane]);
  lanes[normalizedAction.lane].push(placedPiece.color);
  const placedLevel = lanes[normalizedAction.lane].length - 1;
  const cleared = clearAllMatches(lanes, state.score);
  const nextScore = state.score + cleared.scoreDelta;
  if (!Number.isSafeInteger(nextScore) || nextScore > MAX_SCORE) {
    throw new HextrisEngineError(
      "The Hextris score exceeded its supported bound.",
      "HEXTRIS_SCORE_LIMIT"
    );
  }

  const nextOver = lanes.some((lane) => lane.length > HEXTRIS_MAX_BLOCKS_PER_LANE - 1);
  const spawned = nextOver
    ? { incoming: null, rngState: state.rngState }
    : spawnIncoming(state.rngState);
  const nextPlacementCount = state.placementCount + 1;
  const nextState = freezeHextrisState({
    version: HEXTRIS_STATE_VERSION,
    lanes,
    incoming: spawned.incoming,
    score: nextScore,
    best: Math.max(state.best, nextScore),
    placementCount: nextPlacementCount,
    revision: state.revision + 1,
    over: nextOver,
    rngState: spawned.rngState
  });

  const events = [
    {
      type: "piece_placed",
      sourceLane: placedPiece.sourceLane,
      lane: normalizedAction.lane,
      level: placedLevel,
      color: placedPiece.color,
      placementCount: nextPlacementCount
    },
    ...cleared.events
  ];
  if (nextOver) {
    events.push({ type: "game_over", score: nextScore, placementCount: nextPlacementCount });
  } else {
    events.push({
      type: "piece_spawned",
      sourceLane: nextState.incoming.sourceLane,
      color: nextState.incoming.color
    });
  }

  return {
    status: "applied",
    reason: "placed",
    state: nextState,
    events: freezeEvents(events)
  };
}

function emptyHextrisLanes() {
  return Array.from({ length: HEXTRIS_LANE_COUNT }, () => []);
}

function clearAllMatches(lanes, initialScore) {
  let scoreDelta = 0;
  const events = [];
  while (true) {
    const match = findFirstClockwiseMatch(lanes);
    if (!match) break;
    for (const lane of match.lanes) lanes[lane].splice(match.level, 1);
    scoreDelta += HEXTRIS_MATCH_SCORE;
    const score = initialScore + scoreDelta;
    if (!Number.isSafeInteger(score) || score > MAX_SCORE) {
      throw new HextrisEngineError(
        "The Hextris score exceeded its supported bound.",
        "HEXTRIS_SCORE_LIMIT"
      );
    }
    events.push({
      type: "match_cleared",
      lanes: match.lanes,
      level: match.level,
      color: match.color,
      delta: HEXTRIS_MATCH_SCORE,
      score
    });
  }
  return { scoreDelta, events };
}

function findFirstClockwiseMatch(lanes) {
  for (let startLane = 0; startLane < HEXTRIS_LANE_COUNT; startLane += 1) {
    const adjacentLanes = Array.from(
      { length: HEXTRIS_MATCH_LENGTH },
      (_, offset) => (startLane + offset) % HEXTRIS_LANE_COUNT
    );
    const sharedLevel = Math.min(...adjacentLanes.map((lane) => lanes[lane].length)) - 1;
    if (sharedLevel < 0) continue;
    const color = lanes[adjacentLanes[0]][sharedLevel];
    if (adjacentLanes.every((lane) => lanes[lane][sharedLevel] === color)) {
      return { lanes: adjacentLanes, level: sharedLevel, color };
    }
  }
  return null;
}

function spawnIncoming(rngState) {
  const sourceDraw = nextRandom(rngState);
  const colorDraw = nextRandom(sourceDraw.rngState);
  const sourceLane = Math.min(
    HEXTRIS_LANE_COUNT - 1,
    Math.floor(sourceDraw.value * HEXTRIS_LANE_COUNT)
  );
  const colorIndex = Math.min(
    HEXTRIS_COLOR_IDS.length - 1,
    Math.floor(colorDraw.value * HEXTRIS_COLOR_IDS.length)
  );
  return {
    incoming: { sourceLane, color: HEXTRIS_COLOR_IDS[colorIndex] },
    rngState: colorDraw.rngState
  };
}

function nextRandom(value) {
  let rngState = normalizeStoredRngState(value);
  rngState ^= rngState << 13;
  rngState ^= rngState >>> 17;
  rngState ^= rngState << 5;
  rngState >>>= 0;
  if (rngState === 0) {
    throw new HextrisEngineError(
      "The Hextris random generator entered an invalid zero state.",
      "HEXTRIS_RNG_STATE_INVALID"
    );
  }
  return { rngState, value: rngState / UINT32_RANGE };
}

function normalizeLanes(value) {
  if (!Array.isArray(value) || value.length !== HEXTRIS_LANE_COUNT) {
    throw new HextrisEngineError(
      "Hextris lanes must contain exactly six lane arrays.",
      "HEXTRIS_LANES_INVALID"
    );
  }
  assertDenseArray(value, "Hextris lanes", "HEXTRIS_LANES_INVALID");
  return value.map((lane) => {
    if (!Array.isArray(lane) || lane.length > HEXTRIS_MAX_BLOCKS_PER_LANE) {
      throw new HextrisEngineError(
        "Every Hextris lane must contain at most nine blocks.",
        "HEXTRIS_LANES_INVALID"
      );
    }
    assertDenseArray(lane, "Hextris lane", "HEXTRIS_LANES_INVALID");
    return lane.map((color) => normalizeColor(color));
  });
}

function normalizeIncoming(value) {
  assertPlainRecord(value, "Hextris incoming piece", "HEXTRIS_INCOMING_INVALID");
  assertExactKeys(
    value,
    INCOMING_KEYS,
    "Hextris incoming piece",
    "HEXTRIS_INCOMING_INVALID"
  );
  if (
    !Number.isInteger(value.sourceLane)
    || value.sourceLane < 0
    || value.sourceLane >= HEXTRIS_LANE_COUNT
  ) {
    throw new HextrisEngineError(
      "The Hextris incoming sourceLane must be an integer from 0 to 5.",
      "HEXTRIS_INCOMING_INVALID"
    );
  }
  return { sourceLane: value.sourceLane, color: normalizeColor(value.color) };
}

function normalizeColor(value) {
  if (typeof value !== "string" || !HEXTRIS_COLOR_IDS.includes(value)) {
    throw new HextrisEngineError(
      "The Hextris state contains an unsupported color ID.",
      "HEXTRIS_COLOR_INVALID"
    );
  }
  return value;
}

function normalizeScore(value, name) {
  if (
    !Number.isSafeInteger(value)
    || value < 0
    || value > MAX_SCORE
    || value % HEXTRIS_MATCH_SCORE !== 0
  ) {
    throw new HextrisEngineError(
      `${name} must be a supported non-negative multiple of ${HEXTRIS_MATCH_SCORE}.`,
      "HEXTRIS_STATE_INVALID"
    );
  }
  return value;
}

function normalizeCounter(value, name) {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_COUNTER) {
    throw new HextrisEngineError(
      `${name} is outside its supported bound.`,
      "HEXTRIS_STATE_INVALID"
    );
  }
  return value;
}

function normalizeCreateSeed(value) {
  if (value === undefined) return createRandomSeed();
  if (!Number.isInteger(value) || value < 0 || value > UINT32_MAX) {
    throw new HextrisEngineError(
      "The Hextris random seed must be a uint32 integer.",
      "HEXTRIS_SEED_INVALID"
    );
  }
  return (value >>> 0) || DEFAULT_NON_ZERO_SEED;
}

function normalizeStoredRngState(value) {
  if (!Number.isInteger(value) || value <= 0 || value > UINT32_MAX) {
    throw new HextrisEngineError(
      "The Hextris rngState must be a non-zero uint32 integer.",
      "HEXTRIS_RNG_STATE_INVALID"
    );
  }
  return value >>> 0;
}

function freezeHextrisState(value) {
  const lanes = Object.freeze(value.lanes.map((lane) => Object.freeze([...lane])));
  const incoming = value.incoming ? Object.freeze({ ...value.incoming }) : null;
  return Object.freeze({ ...value, lanes, incoming });
}

function freezeEvents(events) {
  return Object.freeze(events.map((event) => {
    const frozen = { ...event };
    if (Array.isArray(frozen.lanes)) frozen.lanes = Object.freeze([...frozen.lanes]);
    return Object.freeze(frozen);
  }));
}

function unchangedOutcome(state, status, reason) {
  return {
    status,
    reason,
    state,
    events: Object.freeze([])
  };
}

function assertCounterCanAdvance(value, name, code) {
  if (value >= MAX_COUNTER) {
    throw new HextrisEngineError(`The Hextris ${name} limit was reached.`, code);
  }
}

function assertPlainRecord(value, name, code) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HextrisEngineError(`${name} must be an object.`, code);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new HextrisEngineError(`${name} must be a plain object.`, code);
  }
}

function assertExactKeys(value, expectedKeys, name, code) {
  const actualKeys = Reflect.ownKeys(value);
  if (actualKeys.some((key) => typeof key !== "string")) {
    throw new HextrisEngineError(`${name} has an invalid field set.`, code);
  }
  actualKeys.sort();
  const sortedExpected = [...expectedKeys].sort();
  if (
    actualKeys.length !== sortedExpected.length
    || actualKeys.some((key, index) => key !== sortedExpected[index])
  ) {
    throw new HextrisEngineError(`${name} has an invalid field set.`, code);
  }
}

function assertAllowedKeys(value, allowedKeys, name, code) {
  const invalidKey = Reflect.ownKeys(value).find(
    (key) => typeof key !== "string" || !allowedKeys.includes(key)
  );
  if (invalidKey !== undefined) {
    throw new HextrisEngineError(`${name} contains an unsupported field.`, code);
  }
}

function assertDenseArray(value, name, code) {
  const expectedKeys = new Set([
    ...Array.from({ length: value.length }, (_, index) => String(index)),
    "length"
  ]);
  const actualKeys = Reflect.ownKeys(value);
  if (
    actualKeys.length !== expectedKeys.size
    || actualKeys.some((key) => typeof key !== "string" || !expectedKeys.has(key))
  ) {
    throw new HextrisEngineError(`${name} must be a dense array without extra fields.`, code);
  }
}

function createRandomSeed() {
  const buffer = new Uint32Array(1);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(buffer);
    return buffer[0] || DEFAULT_NON_ZERO_SEED;
  }
  return (Math.floor(Math.random() * UINT32_RANGE) >>> 0) || DEFAULT_NON_ZERO_SEED;
}
