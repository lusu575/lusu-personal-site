import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";

import { createBrowserGameAgentHost } from "../games/game-agent-host.mjs";
import { cloneBoundedJson } from "../games/agent-protocol.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

class TestFrame {
  constructor(provider) {
    this.contentWindow = {
      location: { origin: "https://lusu575.com" },
      gamePage: { agent: provider }
    };
  }
}

function createProvider(options = {}) {
  let revision = 0;
  let value = 0;
  const sessionId = "game_2048_0123456789abcdef0123456789abcdef";
  const observation = () => Object.freeze({
    protocolVersion: 1,
    gameId: "2048",
    sessionId,
    revision,
    phase: "active",
    terminal: false,
    score: Object.freeze({ current: value }),
    state: Object.freeze({ value })
  });
  return Object.freeze({
    protocolVersion: 1,
    gameId: "2048",
    sessionId,
    observe: observation,
    actions: () => Object.freeze({
      protocolVersion: 1,
      gameId: "2048",
      sessionId,
      revision,
      actions: Object.freeze([Object.freeze({
        id: "increment",
        label: "Increment",
        group: "board",
        description: "Increment the fixture value.",
        risk: "low",
        requiresConfirmation: false,
        action: Object.freeze({ type: "increment" })
      })])
    }),
    act: ({ expectedRevision, clientActionId, action }) => {
      assert.deepEqual(action, { type: "increment" });
      const beforeRevision = revision;
      if (expectedRevision === revision) {
        value += 1;
        revision += 1;
      }
      const resultObservation = options.invalidNestedObservation
        ? { revision }
        : observation();
      return Object.freeze({
        protocolVersion: 1,
        gameId: "2048",
        sessionId,
        clientActionId,
        status: "applied",
        reason: "incremented",
        beforeRevision,
        revision,
        deduplicated: false,
        events: Object.freeze([]),
        observation: resultObservation
      });
    },
    setControlMode: () => {}
  });
}

test("browser protocol accepts plain JSON returned by a same-origin iframe realm", () => {
  const crossRealm = runInNewContext("({ state: { value: 1 }, actions: [{ id: 'move' }] })");
  assert.deepEqual(cloneBoundedJson(crossRealm), {
    state: { value: 1 },
    actions: [{ id: "move" }]
  });
  assert.throws(
    () => cloneBoundedJson(new (class UnsafeValue {})()),
    (error) => error?.code === "GAME_JSON_INVALID"
  );
});

test("browser host freezes semantic actions behind revision-bound opaque actionId tokens", async () => {
  const previousFrame = globalThis.HTMLIFrameElement;
  const previousWindow = globalThis.window;
  globalThis.HTMLIFrameElement = TestFrame;
  globalThis.window = { location: { origin: "https://lusu575.com" }, setTimeout };
  try {
    const host = await createBrowserGameAgentHost({ frame: new TestFrame(createProvider()), gameId: "2048" });
    const first = host.snapshot();
    assert.equal(first.revision, 0);
    assert.equal(first.actions.length, 1);
    assert.equal(first.actions[0].id, "increment");
    assert.match(first.actions[0].actionId, /^act_[A-Za-z0-9_-]{22}$/);
    assert.equal("action" in first.actions[0], false);

    host.setControlActive(true);
    const controlled = host.snapshot();
    assert.notEqual(controlled.actions[0].actionId, first.actions[0].actionId);
    const result = host.act({
      expectedRevision: controlled.revision,
      clientActionId: "fixture.action:1",
      actionId: controlled.actions[0].actionId
    });
    assert.equal(result.status, "applied");
    assert.equal(result.revision, 1);
    assert.equal(result.observation.revision, 1);
    const second = host.snapshot();
    assert.equal(second.revision, 1);
    assert.notEqual(second.actions[0].actionId, first.actions[0].actionId);
    assert.throws(
      () => host.act({
        expectedRevision: second.revision,
        clientActionId: "fixture.action:2",
        actionId: controlled.actions[0].actionId
      }),
      (error) => error?.code === "GAME_ACTION_TOKEN_INVALID"
    );
  } finally {
    globalThis.HTMLIFrameElement = previousFrame;
    globalThis.window = previousWindow;
  }
});

test("browser host rejects a partial nested action observation", async () => {
  const previousFrame = globalThis.HTMLIFrameElement;
  const previousWindow = globalThis.window;
  globalThis.HTMLIFrameElement = TestFrame;
  globalThis.window = { location: { origin: "https://lusu575.com" }, setTimeout };
  try {
    const host = await createBrowserGameAgentHost({
      frame: new TestFrame(createProvider({ invalidNestedObservation: true })),
      gameId: "2048"
    });
    host.snapshot();
    host.setControlActive(true);
    const controlled = host.snapshot();
    assert.throws(
      () => host.act({
        expectedRevision: controlled.revision,
        clientActionId: "fixture.action:3",
        actionId: controlled.actions[0].actionId
      }),
      (error) => error?.code === "GAME_PROVIDER_INVALID"
    );
  } finally {
    globalThis.HTMLIFrameElement = previousFrame;
    globalThis.window = previousWindow;
  }
});

test("game shells expose explicit safe pairing for four games and license-gate Kittens", async () => {
  const [catalogText, shell, css, kittensIndex] = await Promise.all([
    read("games/catalog.json"),
    read("games/game-shell.js"),
    read("games/game-shell.css"),
    read("games/kittens-game/index.html")
  ]);
  const catalog = JSON.parse(catalogText);
  const byId = new Map(catalog.games.map((game) => [game.id, game]));
  for (const gameId of ["2048", "life-restart", "hextris", "a-dark-room"]) {
    assert.equal(byId.get(gameId)?.agentControl?.enabled, true, gameId);
  }
  assert.deepEqual(byId.get("kittens-game")?.agentControl, {
    enabled: false,
    reason: "license-review-required"
  });
  assert.doesNotMatch(kittensIndex, /lusu-agent-bridge/i);

  assert.match(shell, /import\("\/games\/game-agent-host\.mjs\?v=20260809-browser-game-agent-v1"\)/);
  assert.match(shell, /new URL\("\/mcp\/browser-games\/connect", window\.location\.origin\)/);
  assert.match(shell, /new WebSocket\(relayUrl\.href, \["lusu-game-v1", `pair\.\$\{browserAgentPairCode\}`\]\)/);
  assert.match(shell, /\^\[A-Z2-7\]\{26\}\$/);
  assert.match(shell, /frame\.inert = true;[\s\S]*?frame\.blur\(\);/);
  assert.match(shell, /type: "user_resume",[\s\S]*?revision: snapshot\.revision,[\s\S]*?actions: snapshot\.actions/);
  assert.doesNotMatch(shell, /sendBrowserAgentSnapshot\(commandId\);\s*return;\s*}\s*\n\s*if \(message\.type === "close"\)/);
  assert.doesNotMatch(shell, /localStorage[\s\S]{0,120}browserAgentPairCode|browserAgentPairCode[\s\S]{0,120}localStorage/);
  assert.match(css, /\.game-agent-controls \.tool-button\s*\{[\s\S]*?min-height:\s*44px;/);
});

test("production browser host stays reachable under games without a public lib dependency", async () => {
  const [shell, host, protocol, productionPolicy] = await Promise.all([
    read("games/game-shell.js"),
    read("games/game-agent-host.mjs"),
    read("games/agent-protocol.mjs"),
    read("config/public-production-build.json")
  ]);
  const policy = JSON.parse(productionPolicy);
  assert.match(shell, /\/games\/game-agent-host\.mjs/);
  assert.match(host, /from "\.\/agent-protocol\.mjs"/);
  assert.doesNotMatch(host, /\.\.\/lib\//);
  assert.match(protocol, /SESSION_ID_PATTERN/);
  assert.ok(policy.copyTrees.some((entry) => entry.source === "games"));
});

test("all four supported game runtimes install an audited semantic bridge", async () => {
  const [game2048, hextris, adr, life, adrIndex, lifeIndex] = await Promise.all([
    read("games/2048/source/game.js"),
    read("games/hextris/source/game.js"),
    read("games/a-dark-room/source/script/lusu-agent-bridge.js"),
    read("games/life-restart/source/lusu-agent-bridge.js"),
    read("games/a-dark-room/source/index.html"),
    read("games/life-restart/source/index.html")
  ]);
  assert.match(game2048, /setControlMode: setAgentControlMode/);
  assert.match(game2048, /if \(agentControlMode\) return;/);
  assert.match(hextris, /agentControlMode,[\s\S]*?lanes:/);
  assert.match(hextris, /if \(!running \|\| agentControlMode\) return;/);
  assert.match(hextris, /requiresConfirmation: true/);
  assert.match(adr, /Object\.freeze\(\{[\s\S]*?observe: observe,[\s\S]*?actions: actions,[\s\S]*?act: act/);
  assert.match(adr, /forbiddenEvent/);
  assert.match(life, /identifyPhase/);
  assert.match(life, /advance-one-year/);
  assert.match(adrIndex, /lusu-agent-bridge\.js\?v=20260809-browser-game-agent-v1/);
  assert.match(lifeIndex, /lusu-agent-bridge\.js\?v=20260809-browser-game-agent-v1/);
});
