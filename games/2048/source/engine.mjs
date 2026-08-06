export const GAME_2048_STATE_VERSION = 1;
export const GAME_2048_BOARD_SIZE = 4;
export const GAME_2048_TARGET_TILE = 2048;
export const GAME_2048_DIRECTIONS = Object.freeze(["up", "down", "left", "right"]);

const DEFAULT_NON_ZERO_SEED = 0x6d2b79f5;
const MAX_TILE_VALUE = 2 ** 40;
const MAX_SCORE_VALUE = 1_000_000_000_000_000;
const MAX_REVISION = 1_000_000_000;

export class Game2048EngineError extends Error {
  constructor(message, code = "GAME_2048_ENGINE_ERROR") {
    super(message);
    this.name = "Game2048EngineError";
    this.code = code;
  }
}

export function create2048State(options = {}) {
  const best = normalizeBoundedInteger(options.best ?? 0, "best", MAX_SCORE_VALUE);
  let state = {
    version: GAME_2048_STATE_VERSION,
    grid: empty2048Grid(),
    score: 0,
    best,
    won: false,
    over: false,
    moveCount: 0,
    revision: 0,
    rngState: normalize2048Seed(options.seed)
  };

  const initialTiles = options.initialTiles ?? 2;
  if (!Number.isInteger(initialTiles) || initialTiles < 0 || initialTiles > 2) {
    throw new Game2048EngineError(
      "initialTiles must be an integer from 0 to 2.",
      "GAME_2048_INITIAL_TILES_INVALID"
    );
  }
  for (let index = 0; index < initialTiles; index += 1) {
    const spawned = spawn2048Tile(state.grid, state.rngState);
    state = { ...state, grid: spawned.grid, rngState: spawned.rngState };
  }
  return freeze2048State(state);
}

export function restore2048State(value, options = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Game2048EngineError("The 2048 state must be an object.", "GAME_2048_STATE_INVALID");
  }
  if (value.version !== undefined && value.version !== GAME_2048_STATE_VERSION) {
    throw new Game2048EngineError("The 2048 state version is unsupported.", "GAME_2048_STATE_VERSION_UNSUPPORTED");
  }
  const grid = normalize2048Grid(value.grid);
  const score = normalizeBoundedInteger(value.score ?? 0, "score", MAX_SCORE_VALUE);
  const suppliedBest = normalizeBoundedInteger(value.best ?? 0, "best", MAX_SCORE_VALUE);
  const fallbackBest = normalizeBoundedInteger(options.best ?? 0, "best", MAX_SCORE_VALUE);
  const moveCount = normalizeBoundedInteger(value.moveCount ?? 0, "moveCount", MAX_REVISION);
  const revision = normalizeBoundedInteger(value.revision ?? 0, "revision", MAX_REVISION);
  const maximum = max2048Tile(grid);
  const state = {
    version: GAME_2048_STATE_VERSION,
    grid,
    score,
    best: Math.max(suppliedBest, fallbackBest, score),
    won: Boolean(value.won) || maximum >= GAME_2048_TARGET_TILE,
    over: Boolean(value.over) || !canMove2048Grid(grid),
    moveCount,
    revision,
    rngState: normalize2048Seed(value.rngState ?? options.seed)
  };
  return freeze2048State(state);
}

export function serialize2048State(value, options = {}) {
  const state = restore2048State(value, options);
  return {
    version: state.version,
    grid: state.grid.map((row) => [...row]),
    score: state.score,
    best: state.best,
    won: state.won,
    over: state.over,
    moveCount: state.moveCount,
    revision: state.revision,
    rngState: state.rngState,
    ...(options.savedAt ? { savedAt: String(options.savedAt) } : {})
  };
}

export function observe2048State(value) {
  const state = restore2048State(value);
  const availableMoves = getAvailable2048Moves(state.grid);
  return {
    phase: state.over ? "over" : state.won ? "won" : "active",
    terminal: state.over,
    score: {
      current: state.score,
      best: state.best
    },
    state: {
      board: state.grid.map((row) => [...row]),
      maxTile: max2048Tile(state.grid),
      moveCount: state.moveCount,
      wonMilestone: state.won,
      availableMoves
    }
  };
}

export function apply2048Action(value, action) {
  const state = restore2048State(value);
  const normalizedAction = normalize2048EngineAction(action);

  if (normalizedAction.type === "reset") {
    if (!normalizedAction.confirm) {
      return unchangedOutcome(state, "rejected", "confirmation-required");
    }
    assertRevisionCanAdvance(state.revision);
    const resetState = create2048State({ seed: state.rngState, best: state.best });
    return {
      status: "applied",
      reason: "reset",
      state: freeze2048State({
        ...resetState,
        revision: state.revision + 1
      }),
      events: Object.freeze([{ type: "game_reset" }])
    };
  }

  if (state.over) {
    return unchangedOutcome(state, "rejected", "game-over");
  }

  const moved = slide2048Grid(state.grid, normalizedAction.direction);
  if (!moved.changed) {
    return unchangedOutcome(state, "noop", "no-change");
  }

  assertRevisionCanAdvance(state.revision);
  if (state.moveCount >= MAX_REVISION) {
    throw new Game2048EngineError("The 2048 move limit was reached.", "GAME_2048_MOVE_LIMIT");
  }
  const spawned = spawn2048Tile(moved.grid, state.rngState);
  const nextScore = state.score + moved.scoreDelta;
  if (!Number.isSafeInteger(nextScore) || nextScore > MAX_SCORE_VALUE) {
    throw new Game2048EngineError("The 2048 score exceeded its supported bound.", "GAME_2048_SCORE_LIMIT");
  }
  const nextWon = state.won || max2048Tile(spawned.grid) >= GAME_2048_TARGET_TILE;
  const nextOver = !canMove2048Grid(spawned.grid);
  const nextState = freeze2048State({
    ...state,
    grid: spawned.grid,
    score: nextScore,
    best: Math.max(state.best, nextScore),
    won: nextWon,
    over: nextOver,
    moveCount: state.moveCount + 1,
    revision: state.revision + 1,
    rngState: spawned.rngState
  });
  const events = [];
  if (moved.scoreDelta > 0) {
    events.push({ type: "score_changed", delta: moved.scoreDelta, score: nextScore });
  }
  events.push({
    type: "tile_spawned",
    row: spawned.row,
    column: spawned.column,
    value: spawned.value
  });
  if (!state.won && nextWon) events.push({ type: "won", tile: GAME_2048_TARGET_TILE });
  if (nextOver) events.push({ type: "game_over", score: nextScore });

  return {
    status: "applied",
    reason: "moved",
    state: nextState,
    events: Object.freeze(events.map((event) => Object.freeze({ ...event })))
  };
}

export function getAvailable2048Moves(value) {
  const grid = Array.isArray(value?.grid) ? normalize2048Grid(value.grid) : normalize2048Grid(value);
  return GAME_2048_DIRECTIONS.filter((direction) => slide2048Grid(grid, direction).changed);
}

export function canMove2048Grid(value) {
  const grid = normalize2048Grid(value);
  if (grid.some((row) => row.some((tile) => tile === 0))) return true;
  for (let row = 0; row < GAME_2048_BOARD_SIZE; row += 1) {
    for (let column = 0; column < GAME_2048_BOARD_SIZE; column += 1) {
      if (column + 1 < GAME_2048_BOARD_SIZE && grid[row][column] === grid[row][column + 1]) return true;
      if (row + 1 < GAME_2048_BOARD_SIZE && grid[row][column] === grid[row + 1][column]) return true;
    }
  }
  return false;
}

export function empty2048Grid() {
  return Array.from({ length: GAME_2048_BOARD_SIZE }, () => Array(GAME_2048_BOARD_SIZE).fill(0));
}

export function normalize2048Seed(value) {
  if (value === undefined || value === null || value === "") {
    return createRandomSeed();
  }
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 0 || numeric > 0xffffffff) {
    throw new Game2048EngineError("The 2048 random seed is invalid.", "GAME_2048_SEED_INVALID");
  }
  return (numeric >>> 0) || DEFAULT_NON_ZERO_SEED;
}

function normalize2048EngineAction(action) {
  if (!action || typeof action !== "object" || Array.isArray(action)) {
    throw new Game2048EngineError("The 2048 action must be an object.", "GAME_2048_ACTION_INVALID");
  }
  const keys = Object.keys(action).sort();
  if (action.type === "move") {
    if (keys.join(",") !== "direction,type" || !GAME_2048_DIRECTIONS.includes(action.direction)) {
      throw new Game2048EngineError("The 2048 move action is invalid.", "GAME_2048_ACTION_INVALID");
    }
    return { type: "move", direction: action.direction };
  }
  if (action.type === "reset") {
    if (!keys.every((key) => key === "confirm" || key === "type") || keys.some((key) => !["confirm", "type"].includes(key))) {
      throw new Game2048EngineError("The 2048 reset action is invalid.", "GAME_2048_ACTION_INVALID");
    }
    return { type: "reset", confirm: action.confirm === true };
  }
  throw new Game2048EngineError("Unsupported 2048 action type.", "GAME_2048_ACTION_UNSUPPORTED");
}

function slide2048Grid(value, direction) {
  if (!GAME_2048_DIRECTIONS.includes(direction)) {
    throw new Game2048EngineError("Unsupported 2048 direction.", "GAME_2048_DIRECTION_INVALID");
  }
  const grid = normalize2048Grid(value);
  const next = empty2048Grid();
  let scoreDelta = 0;

  for (let index = 0; index < GAME_2048_BOARD_SIZE; index += 1) {
    const line = readMovementLine(grid, direction, index);
    const compressed = compress2048Line(line);
    scoreDelta += compressed.scoreDelta;
    writeMovementLine(next, direction, index, compressed.line);
  }

  return {
    grid: next,
    scoreDelta,
    changed: !same2048Grid(grid, next)
  };
}

function compress2048Line(line) {
  const values = line.filter((value) => value !== 0);
  const output = [];
  let scoreDelta = 0;
  for (let index = 0; index < values.length; index += 1) {
    if (values[index] === values[index + 1]) {
      if (values[index] >= MAX_TILE_VALUE) {
        throw new Game2048EngineError("The 2048 tile limit was reached.", "GAME_2048_TILE_LIMIT");
      }
      const merged = values[index] * 2;
      output.push(merged);
      scoreDelta += merged;
      index += 1;
    } else {
      output.push(values[index]);
    }
  }
  while (output.length < GAME_2048_BOARD_SIZE) output.push(0);
  return { line: output, scoreDelta };
}

function readMovementLine(grid, direction, index) {
  if (direction === "left") return [...grid[index]];
  if (direction === "right") return [...grid[index]].reverse();
  if (direction === "up") return grid.map((row) => row[index]);
  return grid.map((row) => row[index]).reverse();
}

function writeMovementLine(grid, direction, index, line) {
  if (direction === "left" || direction === "right") {
    grid[index] = direction === "right" ? [...line].reverse() : [...line];
    return;
  }
  const values = direction === "down" ? [...line].reverse() : line;
  for (let row = 0; row < GAME_2048_BOARD_SIZE; row += 1) grid[row][index] = values[row];
}

function spawn2048Tile(value, rngState) {
  const grid = normalize2048Grid(value);
  const empty = [];
  grid.forEach((row, rowIndex) => row.forEach((tile, columnIndex) => {
    if (tile === 0) empty.push([rowIndex, columnIndex]);
  }));
  if (!empty.length) {
    throw new Game2048EngineError("A tile cannot spawn on a full board.", "GAME_2048_SPAWN_UNAVAILABLE");
  }
  const positionRandom = next2048Random(rngState);
  const valueRandom = next2048Random(positionRandom.rngState);
  const emptyIndex = Math.min(empty.length - 1, Math.floor(positionRandom.value * empty.length));
  const [row, column] = empty[emptyIndex];
  const tileValue = valueRandom.value < 0.9 ? 2 : 4;
  grid[row][column] = tileValue;
  return {
    grid,
    rngState: valueRandom.rngState,
    row,
    column,
    value: tileValue
  };
}

function next2048Random(value) {
  let state = normalize2048Seed(value);
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  state >>>= 0;
  if (state === 0) state = DEFAULT_NON_ZERO_SEED;
  return { rngState: state, value: state / 0x100000000 };
}

function normalize2048Grid(value) {
  if (!Array.isArray(value) || value.length !== GAME_2048_BOARD_SIZE) {
    throw new Game2048EngineError("The 2048 board must contain four rows.", "GAME_2048_GRID_INVALID");
  }
  return value.map((row) => {
    if (!Array.isArray(row) || row.length !== GAME_2048_BOARD_SIZE) {
      throw new Game2048EngineError("Every 2048 board row must contain four tiles.", "GAME_2048_GRID_INVALID");
    }
    return row.map(normalizeTile);
  });
}

function normalizeTile(value) {
  const numeric = Number(value);
  if (numeric === 0) return 0;
  if (
    !Number.isSafeInteger(numeric)
    || numeric < 2
    || numeric > MAX_TILE_VALUE
    || !Number.isInteger(Math.log2(numeric))
  ) {
    throw new Game2048EngineError("The 2048 board contains an invalid tile.", "GAME_2048_TILE_INVALID");
  }
  return numeric;
}

function normalizeBoundedInteger(value, name, maximum) {
  const numeric = Number(value);
  if (!Number.isSafeInteger(numeric) || numeric < 0 || numeric > maximum) {
    throw new Game2048EngineError(`${name} is outside its supported bound.`, "GAME_2048_STATE_INVALID");
  }
  return numeric;
}

function freeze2048State(value) {
  const grid = value.grid.map((row) => Object.freeze([...row]));
  return Object.freeze({ ...value, grid: Object.freeze(grid) });
}

function unchangedOutcome(state, status, reason) {
  return {
    status,
    reason,
    state,
    events: Object.freeze([])
  };
}

function same2048Grid(left, right) {
  for (let row = 0; row < GAME_2048_BOARD_SIZE; row += 1) {
    for (let column = 0; column < GAME_2048_BOARD_SIZE; column += 1) {
      if (left[row][column] !== right[row][column]) return false;
    }
  }
  return true;
}

function max2048Tile(grid) {
  return Math.max(0, ...grid.flat());
}

function assertRevisionCanAdvance(revision) {
  if (revision >= MAX_REVISION) {
    throw new Game2048EngineError("The 2048 revision limit was reached.", "GAME_2048_REVISION_LIMIT");
  }
}

function createRandomSeed() {
  const buffer = new Uint32Array(1);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(buffer);
    return buffer[0] || DEFAULT_NON_ZERO_SEED;
  }
  return (Math.floor(Math.random() * 0x100000000) >>> 0) || DEFAULT_NON_ZERO_SEED;
}
