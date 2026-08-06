import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  apply2048Action,
  create2048State,
  observe2048State,
  restore2048State,
  serialize2048State
} from "../games/2048/source/engine.mjs";
import {
  GameProtocolError,
  cloneBoundedJson,
  createGameSessionId,
  createGameObservationEnvelope,
  normalizeGameActionRequest
} from "../lib/capabilities/game-protocol.mjs";
import {
  create2048Adapter,
  normalize2048Action
} from "../lib/capabilities/games/2048-adapter.mjs";

test("2048 engine merges once, scores correctly, and spawns exactly one tile", () => {
  const before = stateWithGrid([
    [2, 2, 2, 2],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ]);
  const result = apply2048Action(before, { type: "move", direction: "left" });

  assert.equal(result.status, "applied");
  assert.deepEqual(result.state.grid[0].slice(0, 2), [4, 4]);
  assert.equal(result.state.score, 8);
  assert.equal(result.state.revision, 1);
  assert.equal(result.state.moveCount, 1);
  assert.equal(result.state.grid.flat().filter(Boolean).length, 3);
  assert.equal(result.events.filter((event) => event.type === "tile_spawned").length, 1);
  assert.deepEqual(
    result.events.find((event) => event.type === "score_changed"),
    { type: "score_changed", delta: 8, score: 8 }
  );
});

test("2048 invalid move is a true noop with no random draw or revision change", () => {
  const before = stateWithGrid([
    [2, 0, 0, 0],
    [4, 0, 0, 0],
    [8, 0, 0, 0],
    [16, 0, 0, 0]
  ], { rngState: 123456, revision: 9, moveCount: 9 });
  const snapshot = serialize2048State(before);
  const result = apply2048Action(before, { type: "move", direction: "left" });

  assert.equal(result.status, "noop");
  assert.equal(result.reason, "no-change");
  assert.deepEqual(serialize2048State(result.state), snapshot);
  assert.deepEqual(result.events, []);
});

test("2048 win is a non-terminal milestone while an immovable board is terminal", () => {
  const winning = stateWithGrid([
    [1024, 1024, 4, 8],
    [16, 32, 64, 128],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ]);
  const won = apply2048Action(winning, { type: "move", direction: "left" });
  const wonObservation = observe2048State(won.state);
  assert.equal(wonObservation.phase, "won");
  assert.equal(wonObservation.terminal, false);
  assert.equal(wonObservation.state.maxTile, 2048);
  assert.ok(wonObservation.state.availableMoves.length > 0);

  const over = stateWithGrid([
    [2, 4, 2, 4],
    [4, 2, 4, 2],
    [2, 4, 2, 4],
    [4, 2, 4, 2]
  ]);
  const overObservation = observe2048State(over);
  assert.equal(overObservation.phase, "over");
  assert.equal(overObservation.terminal, true);
  assert.deepEqual(overObservation.state.availableMoves, []);
  assert.equal(Object.hasOwn(overObservation.state, "rngState"), false);
});

test("2048 reset requires confirmation and unsupported action surfaces are rejected", () => {
  const before = create2048State({ seed: 42 });
  const rejected = apply2048Action(before, { type: "reset" });
  assert.equal(rejected.status, "rejected");
  assert.equal(rejected.reason, "confirmation-required");
  assert.equal(rejected.state.revision, 0);

  const reset = apply2048Action(before, { type: "reset", confirm: true });
  assert.equal(reset.status, "applied");
  assert.equal(reset.reason, "reset");
  assert.equal(reset.state.revision, 1);
  assert.equal(reset.state.grid.flat().filter(Boolean).length, 2);

  assert.throws(
    () => normalize2048Action({ type: "move", direction: "left", selector: "#board" }),
    (error) => error instanceof GameProtocolError && error.code === "GAME_2048_ACTION_INVALID"
  );
  assert.throws(
    () => normalize2048Action({ type: "key", key: "ArrowLeft" }),
    (error) => error instanceof GameProtocolError && error.code === "GAME_2048_ACTION_UNSUPPORTED"
  );
});

test("2048 serialization is bounded, validated, and round-trips", () => {
  const original = create2048State({ seed: 987654321, best: 100 });
  const serialized = serialize2048State(original, { savedAt: "2026-08-06T00:00:00.000Z" });
  const restored = restore2048State(JSON.parse(JSON.stringify(serialized)));
  assert.deepEqual(serialize2048State(restored), serialize2048State(original));

  assert.throws(() => restore2048State({
    ...serialized,
    grid: [[3, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]
  }), /invalid tile/i);
  assert.throws(
    () => restore2048State({ ...serialized, version: 2 }),
    (error) => error?.code === "GAME_2048_STATE_VERSION_UNSUPPORTED"
  );

  const maximumTiles = stateWithGrid([
    [2 ** 40, 2 ** 40, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ]);
  assert.throws(
    () => apply2048Action(maximumTiles, { type: "move", direction: "left" }),
    (error) => error?.code === "GAME_2048_TILE_LIMIT"
  );
});

test("2048 adapter exposes only semantic actions and protocol envelopes", () => {
  const adapter = create2048Adapter({ seedFactory: () => 7 });
  const state = adapter.create();
  const actions = adapter.actions(state);
  assert.ok(actions.some((entry) => entry.action.type === "move"));
  assert.deepEqual(actions.at(-1), {
    id: "reset",
    action: { type: "reset", confirm: true },
    risk: "high",
    requiresConfirmation: true
  });

  const request = normalizeGameActionRequest({
    expectedRevision: 0,
    clientActionId: "action_0001",
    action: actions.find((entry) => entry.action.type === "move").action
  });
  assert.equal(request.expectedRevision, 0);
  assert.equal(Object.isFrozen(request.action), true);

  const envelope = createGameObservationEnvelope({
    gameId: "2048",
    sessionId: "game_2048_1234567890abcdef12345678",
    revision: 0,
    observation: adapter.observe(state)
  });
  assert.equal(envelope.protocolVersion, 1);
  assert.equal(Object.isFrozen(envelope), true);
});

test("game protocol bounds identifiers, observations, and unsafe JSON", () => {
  const sessionId = createGameSessionId("x", {
    randomUUID: () => "12345678-90ab-cdef-1234-567890abcdef"
  });
  assert.equal(sessionId, "game_x_1234567890abcdef1234567890abcdef");

  assert.throws(
    () => createGameObservationEnvelope({
      gameId: "2048",
      sessionId: "game_2048_1234567890abcdef12345678",
      revision: 0,
      observation: null
    }),
    (error) => error instanceof GameProtocolError && error.code === "GAME_OBSERVATION_INVALID"
  );
  assert.throws(
    () => cloneBoundedJson(JSON.parse('{"__proto__":{"polluted":true}}')),
    (error) => error instanceof GameProtocolError && error.code === "GAME_JSON_INVALID"
  );
});

test("2048 browser entry retains save compatibility and installs a frozen agent bridge", async () => {
  const source = await readFile(new URL("../games/2048/source/game.js", import.meta.url), "utf8");
  const html = await readFile(new URL("../games/2048/source/index.html", import.meta.url), "utf8");
  assert.match(source, /window\.gamePage = Object\.freeze\(\{ save, agent: agentBridge \}\)/);
  assert.match(source, /const agentBridge = Object\.freeze/);
  assert.match(source, /normalizeGameActionRequest/);
  assert.match(source, /from "\.\/engine\.mjs\?v=20260806-whiteboard-2048-agent-r1"/);
  assert.doesNotMatch(source, /\.\.\/\.\.\/\.\.\/lib\//);
  assert.doesNotMatch(source, /querySelector\(request|eval\(|new Function\(/);
  assert.match(html, /<script type="module" src="game\.js\?v=20260806-whiteboard-2048-agent-r1"><\/script>/);
});

function stateWithGrid(grid, overrides = {}) {
  return restore2048State({
    version: 1,
    grid,
    score: overrides.score ?? 0,
    best: overrides.best ?? 0,
    won: overrides.won ?? false,
    over: overrides.over ?? false,
    moveCount: overrides.moveCount ?? 0,
    revision: overrides.revision ?? 0,
    rngState: overrides.rngState ?? 12345
  });
}
