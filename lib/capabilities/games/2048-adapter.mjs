import {
  GAME_2048_DIRECTIONS,
  apply2048Action,
  create2048State,
  observe2048State,
  restore2048State,
  serialize2048State
} from "../../../games/2048/source/engine.mjs";
import {
  GameProtocolError,
  assertExactKeys,
  cloneBoundedJson,
  deepFreezeJson
} from "../game-protocol.mjs";

export const GAME_2048_ID = "2048";

export function create2048Adapter(options = {}) {
  const seedFactory = options.seedFactory;
  if (seedFactory !== undefined && typeof seedFactory !== "function") {
    throw new GameProtocolError("seedFactory must be a function.", "GAME_2048_ADAPTER_OPTIONS_INVALID");
  }

  return Object.freeze({
    gameId: GAME_2048_ID,

    create(createOptions = {}) {
      const normalized = normalizeCreateOptions(createOptions);
      const seed = normalized.seed ?? seedFactory?.();
      return create2048State({ best: normalized.best, seed });
    },

    restore(value, restoreOptions = {}) {
      return restore2048State(value, restoreOptions);
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
      const state = restore2048State(value);
      const normalizedAction = normalize2048Action(action);
      const outcome = apply2048Action(state, normalizedAction);
      return Object.freeze({
        status: outcome.status,
        reason: outcome.reason,
        state: outcome.state,
        events: outcome.events
      });
    }
  });
}

export function normalize2048Action(action) {
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

export const game2048Adapter = create2048Adapter();

function normalizeCreateOptions(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new GameProtocolError("The 2048 create options must be an object.", "GAME_2048_CREATE_OPTIONS_INVALID");
  }
  const keys = Object.keys(value);
  if (keys.some((key) => key !== "best" && key !== "seed")) {
    throw new GameProtocolError("The 2048 create options contain unsupported fields.", "GAME_2048_CREATE_OPTIONS_INVALID");
  }
  const best = value.best ?? 0;
  const seed = value.seed;
  return { best, seed };
}
