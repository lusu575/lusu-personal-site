/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (C) 2026 LuSu personal site contributors
 *
 * This program is free software: you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation, either version 3 of the License, or any later version.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  HEXTRIS_COLOR_IDS,
  HEXTRIS_LANE_COUNT,
  HEXTRIS_MAX_BLOCKS_PER_LANE,
  HextrisEngineError,
  applyHextrisAction,
  createHextrisState,
  listHextrisActions,
  normalizeHextrisAction,
  observeHextrisState,
  restoreHextrisState,
  serializeHextrisState
} from "../engine.mjs";

test("Hextris creation and placement are reproducible with exactly two RNG draws per spawn", () => {
  const seed = 0x12345678;
  const first = createHextrisState({ seed });
  const second = createHextrisState({ seed });
  const afterInitialSpawn = advanceRng(seed, 2);

  assert.deepEqual(serializeHextrisState(first), serializeHextrisState(second));
  assert.equal(first.rngState, afterInitialSpawn);
  assert.deepEqual(first.incoming, incomingFromDraws(seed));

  const firstPlacement = applyHextrisAction(first, { type: "place", lane: 4 });
  const secondPlacement = applyHextrisAction(second, { type: "place", lane: 4 });
  assert.deepEqual(serializeHextrisState(firstPlacement.state), serializeHextrisState(secondPlacement.state));
  assert.deepEqual(firstPlacement.events, secondPlacement.events);
  assert.equal(firstPlacement.state.rngState, advanceRng(seed, 4));
  assert.deepEqual(firstPlacement.state.incoming, incomingFromDraws(afterInitialSpawn));
});

test("Hextris placement targets the requested lane and emits deterministic semantic events", () => {
  const before = createHextrisState({ seed: 17 });
  const piece = { ...before.incoming };
  const result = applyHextrisAction(before, { type: "place", lane: 3 });

  assert.equal(result.status, "applied");
  assert.equal(result.reason, "placed");
  assert.deepEqual(result.state.lanes[3], [piece.color]);
  assert.deepEqual(result.state.lanes.filter((_, lane) => lane !== 3), [[], [], [], [], []]);
  assert.equal(result.state.placementCount, 1);
  assert.equal(result.state.revision, 1);
  assert.equal(result.state.score, 0);
  assert.deepEqual(result.events[0], {
    type: "piece_placed",
    sourceLane: piece.sourceLane,
    lane: 3,
    level: 0,
    color: piece.color,
    placementCount: 1
  });
  assert.equal(result.events.at(-1).type, "piece_spawned");
  assert.equal(Object.isFrozen(result.state), true);
  assert.equal(Object.isFrozen(result.state.lanes[3]), true);
  assert.equal(Object.isFrozen(result.events), true);
});

test("Hextris repeatedly clears the first clockwise adjacent match at the shared level", () => {
  const before = stateFrom({
    lanes: [
      ["red", "blue"],
      ["red", "blue"],
      ["red"],
      [],
      [],
      []
    ],
    incoming: { sourceLane: 5, color: "blue" }
  });
  const result = applyHextrisAction(before, { type: "place", lane: 2 });
  const clears = result.events.filter((event) => event.type === "match_cleared");

  assert.deepEqual(result.state.lanes, [[], [], [], [], [], []]);
  assert.equal(result.state.score, 60);
  assert.equal(result.state.best, 60);
  assert.deepEqual(clears, [
    {
      type: "match_cleared",
      lanes: [0, 1, 2],
      level: 1,
      color: "blue",
      delta: 30,
      score: 30
    },
    {
      type: "match_cleared",
      lanes: [0, 1, 2],
      level: 0,
      color: "red",
      delta: 30,
      score: 60
    }
  ]);
});

test("Hextris terminal placement performs no next-piece RNG draw and exposes only reset", () => {
  const rngState = 0x76543210;
  const before = stateFrom({
    lanes: [
      ["red", "yellow", "green", "blue", "purple", "orange", "red", "yellow"],
      [],
      [],
      [],
      [],
      []
    ],
    incoming: { sourceLane: 1, color: "green" },
    rngState
  });
  const result = applyHextrisAction(before, { type: "place", lane: 0 });

  assert.equal(result.state.lanes[0].length, HEXTRIS_MAX_BLOCKS_PER_LANE);
  assert.equal(result.state.over, true);
  assert.equal(result.state.incoming, null);
  assert.equal(result.state.rngState, rngState);
  assert.equal(result.events.some((event) => event.type === "piece_spawned"), false);
  assert.equal(result.events.at(-1).type, "game_over");
  assert.deepEqual(listHextrisActions(result.state), [{ type: "reset", confirm: true }]);
  assert.deepEqual(observeHextrisState(result.state).state.availableLanes, []);

  const rejected = applyHextrisAction(result.state, { type: "place", lane: 1 });
  assert.equal(rejected.status, "rejected");
  assert.equal(rejected.reason, "game-over");
  assert.deepEqual(serializeHextrisState(rejected.state), serializeHextrisState(result.state));
});

test("Hextris restoration rejects structural, range, and semantic tampering", () => {
  const serialized = serializeHextrisState(createHextrisState({ seed: 99 }));
  const sparseLanes = serialized.lanes.map((lane) => [...lane]);
  sparseLanes[0] = Array(1);
  const annotatedLanes = serialized.lanes.map((lane) => [...lane]);
  annotatedLanes[0].tampered = true;

  assert.throws(
    () => restoreHextrisState({ ...serialized, selector: "#canvas" }),
    (error) => error instanceof HextrisEngineError && error.code === "HEXTRIS_STATE_INVALID"
  );
  assert.throws(
    () => restoreHextrisState({ ...serialized, lanes: [...serialized.lanes, []] }),
    (error) => error?.code === "HEXTRIS_LANES_INVALID"
  );
  assert.throws(
    () => restoreHextrisState({
      ...serialized,
      lanes: [Array(10).fill("red"), [], [], [], [], []],
      over: true,
      incoming: null
    }),
    (error) => error?.code === "HEXTRIS_LANES_INVALID"
  );
  assert.throws(
    () => restoreHextrisState({ ...serialized, lanes: sparseLanes }),
    (error) => error?.code === "HEXTRIS_LANES_INVALID"
  );
  assert.throws(
    () => restoreHextrisState({ ...serialized, lanes: annotatedLanes }),
    (error) => error?.code === "HEXTRIS_LANES_INVALID"
  );
  assert.throws(
    () => restoreHextrisState({
      ...serialized,
      lanes: [["cyan"], [], [], [], [], []]
    }),
    (error) => error?.code === "HEXTRIS_COLOR_INVALID"
  );
  assert.throws(
    () => restoreHextrisState({ ...serialized, incoming: null }),
    (error) => error?.code === "HEXTRIS_INCOMING_INVALID"
  );
  assert.throws(
    () => restoreHextrisState({ ...serialized, over: true, incoming: null }),
    (error) => error?.code === "HEXTRIS_STATE_INVALID"
  );
  assert.throws(
    () => restoreHextrisState({ ...serialized, score: 30, best: 0 }),
    (error) => error?.code === "HEXTRIS_STATE_INVALID"
  );
  assert.throws(
    () => restoreHextrisState({ ...serialized, rngState: 0 }),
    (error) => error?.code === "HEXTRIS_RNG_STATE_INVALID"
  );

  for (const action of [
    { type: "place", lane: 0, key: "ArrowLeft" },
    { type: "place", lane: "0" },
    { type: "place", lane: HEXTRIS_LANE_COUNT },
    { type: "reset" },
    { type: "reset", confirm: 1 }
  ]) {
    assert.throws(
      () => normalizeHextrisAction(action),
      (error) => error instanceof HextrisEngineError && error.code === "HEXTRIS_ACTION_INVALID"
    );
  }
  assert.throws(
    () => normalizeHextrisAction({ type: "rotate", direction: "left" }),
    (error) => error?.code === "HEXTRIS_ACTION_UNSUPPORTED"
  );
});

test("Hextris reset requires an exact boolean confirmation and preserves best", () => {
  const before = stateFrom({
    lanes: [["red"], [], [], [], [], []],
    score: 60,
    best: 120,
    placementCount: 7,
    revision: 9,
    rngState: 0x13572468
  });
  const snapshot = serializeHextrisState(before);
  const rejected = applyHextrisAction(before, { type: "reset", confirm: false });

  assert.equal(rejected.status, "rejected");
  assert.equal(rejected.reason, "confirmation-required");
  assert.deepEqual(serializeHextrisState(rejected.state), snapshot);
  assert.deepEqual(rejected.events, []);

  const reset = applyHextrisAction(before, { type: "reset", confirm: true });
  assert.equal(reset.status, "applied");
  assert.equal(reset.reason, "reset");
  assert.deepEqual(reset.state.lanes, [[], [], [], [], [], []]);
  assert.equal(reset.state.score, 0);
  assert.equal(reset.state.best, 120);
  assert.equal(reset.state.placementCount, 0);
  assert.equal(reset.state.revision, 10);
  assert.equal(reset.state.over, false);
  assert.equal(reset.state.rngState, advanceRng(before.rngState, 2));
  assert.equal(reset.events[0].type, "game_reset");
  assert.equal(reset.events[1].type, "piece_spawned");
});

function stateFrom(overrides = {}) {
  return restoreHextrisState({
    version: 1,
    lanes: overrides.lanes ?? Array.from({ length: HEXTRIS_LANE_COUNT }, () => []),
    incoming: overrides.incoming ?? { sourceLane: 0, color: HEXTRIS_COLOR_IDS[0] },
    score: overrides.score ?? 0,
    best: overrides.best ?? overrides.score ?? 0,
    placementCount: overrides.placementCount ?? 0,
    revision: overrides.revision ?? overrides.placementCount ?? 0,
    over: overrides.over ?? false,
    rngState: overrides.rngState ?? 0x24681357
  });
}

function advanceRng(seed, draws) {
  let state = seed >>> 0;
  for (let index = 0; index < draws; index += 1) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
  }
  return state;
}

function incomingFromDraws(seed) {
  const sourceState = advanceRng(seed, 1);
  const colorState = advanceRng(sourceState, 1);
  return {
    sourceLane: Math.floor((sourceState / 0x100000000) * HEXTRIS_LANE_COUNT),
    color: HEXTRIS_COLOR_IDS[Math.floor((colorState / 0x100000000) * HEXTRIS_COLOR_IDS.length)]
  };
}
