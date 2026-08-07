import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { GameProtocolError } from "../lib/capabilities/game-protocol.mjs";
import { createGameSessionStore } from "../lib/capabilities/game-session-store.mjs";
import {
  LIFE_RESTART_DATA_SHA256,
  LIFE_RESTART_MODE,
  LIFE_RESTART_SOURCE_COMMIT,
  LIFE_RESTART_STATE_VERSION,
  createLifeRestartAdapter,
  normalizeLifeRestartAction
} from "../lib/capabilities/games/life-restart-adapter.mjs";

const EXPECTED_SOURCE_COMMIT = "a10861eed93296c96d0e0fca98c82e86f4dfda4b";

test("Life Restart pins and verifies the bundled Chinese Custom-mode data", async () => {
  for (const name of ["age", "talents", "events"]) {
    const bytes = await readFile(new URL(`../games/life-restart/source/data/zh-cn/${name}.json`, import.meta.url));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), LIFE_RESTART_DATA_SHA256[name]);
  }

  const notice = await readFile(new URL("../games/life-restart/NOTICE.md", import.meta.url), "utf8");
  const license = await readFile(new URL("../games/life-restart/source/LICENSE.txt", import.meta.url), "utf8");
  assert.equal(LIFE_RESTART_SOURCE_COMMIT, EXPECTED_SOURCE_COMMIT);
  assert.equal(LIFE_RESTART_STATE_VERSION, 2);
  assert.match(notice, new RegExp("Pinned upstream commit: `" + EXPECTED_SOURCE_COMMIT + "`"));
  assert.match(notice, /source\/LICENSE\.txt/);
  assert.match(license, /MIT License/);

  const adapter = createLifeRestartAdapter({ seedFactory: () => 123, calendarYearFactory: () => 2026 });
  const state = adapter.create();
  assert.equal(state.mode, LIFE_RESTART_MODE);
  assert.equal(state.sourceCommit, EXPECTED_SOURCE_COMMIT);
  assert.equal(state.version, 2);
  assert.deepEqual(state.dataHashes, LIFE_RESTART_DATA_SHA256);
  assert.equal(state.calendarYear, 2026);
  assert.equal(state.phase, "talent-selection");
  assert.equal(state.offeredTalentIds.length, 10);
  assert.equal(new Set(state.offeredTalentIds).size, 10);
  assert.equal(Object.isFrozen(state), true);

  const observation = adapter.observe(state);
  assert.equal(observation.state.data.language, "zh-cn");
  assert.equal(observation.state.mode, "custom");
  assert.equal(Object.hasOwn(observation.state, "rngState"), false);
  assert.equal(JSON.stringify(observation).length < 56 * 1024, true);

  const actions = adapter.actions(state);
  assert.deepEqual(actions.map((entry) => entry.id), ["choose-talents", "reset"]);
  assert.equal(actions[0].constraints.noConflicts, true);
  assert.equal(actions[0].action.talentIds.length, 3);
  assert.equal(JSON.stringify(actions).length < 16 * 1024, true);
  assert.doesNotMatch(JSON.stringify(actions), /selector|script|\burl\b|\bpath\b|save/i);
});

test("Life Restart is deterministic across create, restore, and replay", () => {
  const firstAdapter = createFixtureAdapter(77, 2031);
  const secondAdapter = createFixtureAdapter(77, 2031);
  let first = firstAdapter.create();
  let second = secondAdapter.create();
  assert.deepEqual(firstAdapter.serialize(first), secondAdapter.serialize(second));

  const actions = [
    { type: "choose_talents", talentIds: [6, 3, 4] },
    { type: "allocate_properties", properties: { CHR: 10, INT: 10, STR: 2, MNY: 0 } },
    { type: "advance", steps: 1 },
    { type: "advance", steps: 1 }
  ];
  for (const action of actions) {
    first = firstAdapter.act(first, action).state;
    const restored = secondAdapter.restore(JSON.parse(JSON.stringify(second)));
    second = secondAdapter.act(restored, action).state;
    assert.deepEqual(firstAdapter.serialize(first), secondAdapter.serialize(second));
  }
  assert.equal(first.phase, "summary");
  assert.equal(first.revision, 4);
});

test("Life Restart replay counts actions rather than trusting an AGE value changed by an event", () => {
  const data = fixtureData();
  data.events[100].effect = { MNY: 1, AGE: -5 };
  const adapter = createLifeRestartAdapter({
    seedFactory: () => 77,
    calendarYearFactory: () => 2031,
    data,
    allowTestData: true
  });
  let state = adapter.create();
  state = adapter.act(state, { type: "choose_talents", talentIds: [6, 3, 4] }).state;
  state = adapter.act(state, {
    type: "allocate_properties",
    properties: { CHR: 10, INT: 10, STR: 2, MNY: 0 }
  }).state;
  state = adapter.act(state, { type: "advance", steps: 1 }).state;

  assert.equal(state.properties.AGE, -5);
  assert.equal(state.history.at(-1).age, 0);
  assert.deepEqual(adapter.serialize(adapter.restore(structuredClone(state))), adapter.serialize(state));
});

test("Life Restart enforces phase, selection conflicts, exact allocation, and one-year advance", () => {
  const adapter = createFixtureAdapter();
  let state = adapter.create();

  const wrongPhase = adapter.act(state, { type: "restart_life", inheritedTalentId: null });
  assert.equal(wrongPhase.status, "rejected");
  assert.equal(wrongPhase.reason, "wrong-phase");
  assert.equal(wrongPhase.state.revision, 0);

  const conflict = adapter.act(state, { type: "choose_talents", talentIds: [1, 2, 3] });
  assert.equal(conflict.status, "rejected");
  assert.equal(conflict.reason, "talent-conflict");
  assert.equal(conflict.state.revision, 0);

  const chosen = adapter.act(state, { type: "choose_talents", talentIds: [6, 3, 4] });
  assert.equal(chosen.status, "applied");
  assert.equal(chosen.reason, "talents-chosen");
  assert.equal(chosen.state.phase, "property-allocation");
  assert.equal(chosen.state.revision, 1);
  assert.deepEqual(chosen.state.selectedTalentIds, [6, 3, 4]);
  assert.deepEqual(chosen.state.activeTalentIds, [6, 3, 4, 7]);
  assert.equal(chosen.state.propertyPoints, 22);
  assert.deepEqual(chosen.events[0].replacements, [{ sourceTalentId: 6, targetTalentId: 7 }]);
  state = chosen.state;

  const actionDescriptor = adapter.actions(state).find((entry) => entry.id === "allocate-properties");
  assert.equal(actionDescriptor.constraints.exactTotal, 22);
  assert.equal(Object.values(actionDescriptor.action.properties).reduce((sum, value) => sum + value, 0), 22);

  const mismatch = adapter.act(state, {
    type: "allocate_properties",
    properties: { CHR: 5, INT: 5, STR: 5, MNY: 5 }
  });
  assert.equal(mismatch.status, "rejected");
  assert.equal(mismatch.reason, "allocation-total-mismatch");
  assert.equal(mismatch.state.revision, 1);

  const started = adapter.act(state, {
    type: "allocate_properties",
    properties: { CHR: 10, INT: 10, STR: 2, MNY: 0 }
  });
  assert.equal(started.status, "applied");
  assert.equal(started.state.phase, "trajectory");
  assert.equal(started.state.revision, 2);
  assert.deepEqual(started.state.allocation, { CHR: 10, INT: 10, STR: 2, MNY: 0 });
  assert.equal(started.state.properties.CHR, 11);
  assert.equal(started.state.properties.INT, 11);
  assert.equal(started.state.properties.SPR, 5);
  assert.equal(started.state.talentTriggerCounts[4], undefined);

  assert.throws(
    () => adapter.act(started.state, { type: "advance", steps: 2 }),
    (error) => error instanceof GameProtocolError && error.code === "GAME_LIFE_RESTART_ACTION_INVALID"
  );
});

test("Life Restart applies conditions, branches, effects, terminal summary, and inherited restart", () => {
  const adapter = createFixtureAdapter(77, 2031);
  let state = adapter.create();
  state = adapter.act(state, { type: "choose_talents", talentIds: [6, 3, 4] }).state;
  state = adapter.act(state, {
    type: "allocate_properties",
    properties: { CHR: 10, INT: 10, STR: 2, MNY: 0 }
  }).state;

  const ageZero = adapter.act(state, { type: "advance", steps: 1 });
  assert.equal(ageZero.status, "applied");
  assert.equal(ageZero.reason, "year-advanced");
  assert.equal(ageZero.state.properties.AGE, 0);
  assert.equal(ageZero.state.properties.MNY, 1);
  assert.deepEqual(ageZero.events[0].lifeEvents.map((entry) => entry.id), [100]);
  assert.match(ageZero.events[0].lifeEvents[0].description, /2031/);
  state = ageZero.state;

  const ageOne = adapter.act(state, { type: "advance", steps: 1 });
  assert.equal(ageOne.status, "applied");
  assert.equal(ageOne.reason, "life-ended");
  assert.equal(ageOne.state.phase, "summary");
  assert.equal(ageOne.state.properties.LIF, 0);
  assert.equal(ageOne.state.talentTriggerCounts[4], 1);
  assert.deepEqual(ageOne.events[0].talentTriggers.map((entry) => entry.id), [4]);
  assert.deepEqual(ageOne.events[0].lifeEvents.map((entry) => entry.id), [101, 102]);
  assert.equal(ageOne.events[0].lifeEvents[0].postEvent, null);
  assert.equal(ageOne.state.summary.age, 1);
  assert.equal(ageOne.state.history.at(-1).terminal, true);
  state = ageOne.state;

  const invalidInheritance = adapter.act(state, { type: "restart_life", inheritedTalentId: 5 });
  assert.equal(invalidInheritance.status, "rejected");
  assert.equal(invalidInheritance.reason, "inherited-talent-invalid");
  assert.equal(invalidInheritance.state.revision, 4);

  const restarted = adapter.act(state, { type: "restart_life", inheritedTalentId: 4 });
  assert.equal(restarted.status, "applied");
  assert.equal(restarted.state.phase, "talent-selection");
  assert.equal(restarted.state.revision, 5);
  assert.equal(restarted.state.generation, 2);
  assert.equal(restarted.state.completedLives, 1);
  assert.equal(restarted.state.inheritedTalentId, 4);
  assert.equal(restarted.state.offeredTalentIds[0], 4);
  assert.deepEqual(restarted.state.seenEventIds, []);
  assert.deepEqual(restarted.state.allSeenEventIds, [100, 101, 102]);

  const unconfirmed = adapter.act(restarted.state, { type: "reset" });
  assert.equal(unconfirmed.status, "rejected");
  assert.equal(unconfirmed.reason, "confirmation-required");
  assert.equal(unconfirmed.state.revision, 5);

  const reset = adapter.act(restarted.state, { type: "reset", confirm: true });
  assert.equal(reset.status, "applied");
  assert.equal(reset.reason, "reset");
  assert.equal(reset.state.revision, 6);
  assert.equal(reset.state.completedLives, 0);
  assert.equal(reset.state.inheritedTalentId, null);
  assert.deepEqual(reset.state.allSeenEventIds, []);
});

test("Life Restart restore rejects malformed identity, unsafe shape, and inconsistent derived state", () => {
  const adapter = createFixtureAdapter();
  let state = adapter.create();
  state = adapter.act(state, { type: "choose_talents", talentIds: [6, 3, 4] }).state;
  state = adapter.act(state, {
    type: "allocate_properties",
    properties: { CHR: 10, INT: 10, STR: 2, MNY: 0 }
  }).state;
  state = adapter.act(state, { type: "advance", steps: 1 }).state;
  const serialized = adapter.serialize(state);
  assert.deepEqual(adapter.serialize(adapter.restore(serialized)), serialized);

  const forgedHistoryAge = structuredClone(serialized);
  forgedHistoryAge.history.at(-1).age = 999;
  const forgedHistoryText = structuredClone(serialized);
  forgedHistoryText.history.at(-1).lifeEvents[0].description = "forged";
  const forgedSeenEvents = structuredClone(serialized);
  forgedSeenEvents.seenEventIds.push(103);
  forgedSeenEvents.allSeenEventIds.push(103);
  const forgedActiveTalent = structuredClone(serialized);
  forgedActiveTalent.activeTalentIds.push(5);
  const forgedRngState = structuredClone(serialized);
  forgedRngState.rngState = serialized.rngState === 0xffffffff ? 1 : serialized.rngState + 1;
  const forgedLogicalRevision = structuredClone(serialized);
  forgedLogicalRevision.revision += 1;
  const forgedCheckpointOrigin = structuredClone(serialized);
  forgedCheckpointOrigin.currentLifeCheckpoint.origin = "reset";
  const forgedCheckpointDigest = structuredClone(serialized);
  forgedCheckpointDigest.currentLifeCheckpoint.allSeenEventSha256 = "0".repeat(64);

  for (const malformed of [
    { ...serialized, unknown: true },
    { ...serialized, rngState: 0 },
    { ...serialized, revision: String(serialized.revision) },
    { ...serialized, dataHashes: { ...serialized.dataHashes, events: "0".repeat(64) } },
    { ...serialized, activeTalentIds: [...serialized.activeTalentIds, 999] },
    { ...serialized, properties: { ...serialized.properties, CHR: serialized.properties.CHR + 1 } },
    { ...serialized, offeredTalentIds: serialized.offeredTalentIds.slice(0, 9) },
    forgedHistoryAge,
    forgedHistoryText,
    forgedSeenEvents,
    forgedActiveTalent,
    forgedRngState,
    forgedLogicalRevision,
    forgedCheckpointOrigin,
    forgedCheckpointDigest
  ]) {
    assert.throws(
      () => adapter.restore(malformed),
      (error) => error instanceof GameProtocolError && /^GAME_LIFE_RESTART_/.test(error.code)
    );
  }
});

test("Life Restart rejects selector, script, URL, path, save import, and unbounded action forms", () => {
  const rejected = [
    { type: "choose_talents", talentIds: [1, 2, 3], selector: "#game" },
    { type: "allocate_properties", properties: { CHR: 5, INT: 5, STR: 5, MNY: 5 }, url: "https://example.com" },
    { type: "advance", steps: 1, script: "alert(1)" },
    { type: "restart_life", inheritedTalentId: null, path: "../save.json" },
    { type: "save_import", save: "opaque" },
    { type: "reset", confirm: true, command: "rm" },
    { type: "choose_talents", talentIds: [1, 2] },
    { type: "choose_talents", talentIds: ["1", 2, 3] },
    { type: "allocate_properties", properties: { CHR: "5", INT: 5, STR: 5, MNY: 5 } },
    { type: "allocate_properties", properties: { CHR: 11, INT: 5, STR: 5, MNY: 1 } }
  ];
  for (const action of rejected) {
    assert.throws(
      () => normalizeLifeRestartAction(action),
      (error) => error instanceof GameProtocolError && /^GAME_LIFE_RESTART_ACTION_/.test(error.code)
    );
  }
});

test("Life Restart keeps long official sessions and observations bounded", () => {
  const adapter = createLifeRestartAdapter();
  let state = adapter.create({ seed: 4, calendarYear: 2026 });
  state = adapter.act(state, adapter.actions(state)[0].action).state;
  state = adapter.act(state, adapter.actions(state)[0].action).state;
  let advances = 0;
  while (state.phase === "trajectory" && advances < 501) {
    state = adapter.act(state, { type: "advance", steps: 1 }).state;
    advances += 1;
  }
  assert.equal(state.phase, "summary");
  assert.equal(state.history.length <= 24, true);
  assert.equal(Buffer.byteLength(JSON.stringify(adapter.serialize(state)), "utf8") < 64 * 1024, true);
  assert.equal(Buffer.byteLength(JSON.stringify(adapter.observe(state)), "utf8") < 56 * 1024, true);
  assert.equal(Buffer.byteLength(JSON.stringify(adapter.actions(state)), "utf8") < 16 * 1024, true);
});

test("the default persistent store completes a long Life Restart run within its 512 KiB bound", async (t) => {
  const rootDirectory = await mkdtemp(path.join(os.tmpdir(), "lusu-life-store-test-"));
  t.after(() => rm(rootDirectory, { recursive: true, force: true }));
  const store = createGameSessionStore({ rootDirectory });
  const created = await store.createSession("life-restart", { seed: 4, calendarYear: 2026 });
  const sessionId = created.observation.sessionId;
  let observation = created.observation;
  let available = created.actions;
  let lastRequest;
  let lastResult;
  let applied = 0;

  while (!observation.terminal && applied < 600) {
    const descriptor = available.actions.find((entry) => (
      ["choose_talents", "allocate_properties", "advance"].includes(entry.action.type)
    ));
    assert.ok(descriptor, `missing semantic action in phase ${observation.phase}`);
    lastRequest = {
      expectedRevision: observation.revision,
      clientActionId: `life_store_action_${String(applied).padStart(4, "0")}`,
      action: descriptor.action
    };
    lastResult = await store.actSession(sessionId, lastRequest);
    assert.equal(lastResult.status, "applied");
    observation = lastResult.observation;
    applied += 1;
    if (!observation.terminal) available = await store.actionsForSession(sessionId);
  }

  assert.equal(observation.terminal, true);
  assert.ok(applied > 40, `expected a long run, received ${applied} actions`);
  const sessionFile = path.join(rootDirectory, `${sessionId}.json`);
  assert.ok((await stat(sessionFile)).size <= 512 * 1024);
  const retried = await store.actSession(sessionId, lastRequest);
  assert.deepEqual(retried, { ...lastResult, deduplicated: true });
});

function createFixtureAdapter(seed = 77, calendarYear = 2031) {
  return createLifeRestartAdapter({
    seedFactory: () => seed,
    calendarYearFactory: () => calendarYear,
    data: fixtureData(),
    allowTestData: true
  });
}

function fixtureData() {
  const talents = {
    "1": { id: 1, name: "冲突甲", description: "与冲突乙不兼容", grade: 0, exclude: [2] },
    "2": { id: 2, name: "冲突乙", description: "与冲突甲不兼容", grade: 0, exclude: [1] },
    "3": { id: 3, name: "聪慧", description: "初始智力增加", grade: 0, effect: { INT: 1 } },
    "4": { id: 4, name: "成长", description: "一岁和两岁时快乐增加", grade: 1, condition: "AGE?[1,2]", effect: { SPR: 1 } },
    "5": { id: 5, name: "平常", description: "没有额外效果", grade: 0 },
    "6": { id: 6, name: "转盘", description: "替换出额外天赋", grade: 0, replacement: { talent: [7] } },
    "7": { id: 7, name: "额外", description: "属性点和颜值增加", grade: 1, status: 2, effect: { CHR: 1 } },
    "8": { id: 8, name: "八号", description: "测试天赋八", grade: 0 },
    "9": { id: 9, name: "九号", description: "测试天赋九", grade: 0 },
    "10": { id: 10, name: "十号", description: "测试天赋十", grade: 0 }
  };
  const events = {
    "100": { id: 100, event: "你出生于 {currentyear} 年。", effect: { MNY: 1 } },
    "101": {
      id: 101,
      event: "你长大了一岁。",
      postEvent: "这段文字在分支命中时不显示。",
      effect: { SPR: 1 },
      branch: ["TLT?[4]:102"]
    },
    "102": { id: 102, event: "这一生结束了。", effect: { LIF: -1 }, NoRandom: 1 },
    "103": { id: 103, event: "不满足条件的事件。", include: "MNY>99" }
  };
  return {
    age: {
      "0": { age: 0, event: ["100*1", "103*100"] },
      "1": { age: 1, event: [101] }
    },
    talents,
    events
  };
}
