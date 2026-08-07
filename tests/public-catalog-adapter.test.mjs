import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resourcesContent } from "../js/data/resources-content.mjs";
import {
  PublicCatalogError,
  getPublicGame,
  getPublicTool,
  listPublicTools,
  projectPublicGameCatalog
} from "../lib/capabilities/public-catalog-adapter.mjs";

async function gameCatalog() {
  return JSON.parse(await readFile(new URL("../games/catalog.json", import.meta.url), "utf8"));
}

function withToolMutation(index, changes, assertion) {
  const entry = resourcesContent.resources[index];
  const previous = new Map(Object.keys(changes).map((key) => [
    key,
    { present: Object.hasOwn(entry, key), value: entry[key] }
  ]));
  try {
    Object.assign(entry, changes);
    assertion();
  } finally {
    for (const [key, state] of previous) {
      if (state.present) entry[key] = state.value;
      else delete entry[key];
    }
  }
}

test("public tool catalog exposes only stable ready tools and registered capabilities", () => {
  const catalog = listPublicTools({ lang: "en" });
  assert.equal(catalog.lang, "en");
  assert.deepEqual(catalog.tools.map((tool) => tool.id), [
    "whiteboard",
    "quick-transfer",
    "japanese-subtext"
  ]);
  assert.equal(catalog.tools[0].title, "Online Whiteboard");
  assert.deepEqual(catalog.tools[0].open, { type: "path", path: "/tools/whiteboard/" });
  assert.deepEqual(catalog.tools[1].open, { type: "site-action", action: "quick-transfer" });
  assert.ok(catalog.tools.every((tool) => tool.capabilities.length > 0));
  assert.ok(catalog.tools.every((tool) => tool.capabilities.some((capability) => (
    capability.availableTransports.includes("local-mcp")
  ))));

  const serialized = JSON.stringify(catalog);
  assert.equal(serialized.includes("iconSrc"), false);
  assert.equal(serialized.includes("placeholder"), false);
});

test("public tool lookup localizes output and distinguishes invalid ids from misses", () => {
  assert.equal(getPublicTool("japanese-subtext", { lang: "ja" }).title, "日本語の裏側");
  assert.throws(
    () => getPublicTool("../whiteboard"),
    (error) => error instanceof PublicCatalogError && error.code === "invalid_input" && error.status === 400
  );
  assert.throws(
    () => getPublicTool("missing-tool"),
    (error) => error instanceof PublicCatalogError && error.code === "not_found" && error.status === 404
  );
  assert.throws(
    () => listPublicTools({ lang: "fr" }),
    (error) => error instanceof PublicCatalogError && error.code === "invalid_input" && error.status === 400
  );
});

test("public tools fail closed unless id, domain, and launch target match the fixed contract", () => {
  const invalidMutations = [
    [0, { toolId: undefined }],
    [0, { toolId: "unknown-tool" }],
    [0, { capabilityDomain: "transfer" }],
    [0, { url: "/admin/" }],
    [0, { url: "/tools/%2e%2e/admin" }],
    [0, { action: "quick-transfer" }],
    [1, { action: "whiteboard" }],
    [1, { url: "/tools/whiteboard/" }],
    [2, { url: "/tools/whiteboard/" }]
  ];
  for (const [index, changes] of invalidMutations) {
    withToolMutation(index, changes, () => {
      assert.throws(
        () => listPublicTools(),
        (error) => error instanceof PublicCatalogError
          && error.code === "invalid_catalog"
          && error.status === 500
      );
    });
  }
  assert.deepEqual(listPublicTools().tools.map((tool) => tool.id), [
    "whiteboard",
    "quick-transfer",
    "japanese-subtext"
  ]);
});

test("public game projection distinguishes integrated and dedicated Agent sessions", async () => {
  const payload = await gameCatalog();
  const catalog = projectPublicGameCatalog(payload, { lang: "ja" });
  assert.equal(catalog.games.length, 5);
  assert.deepEqual(catalog.games.filter((game) => game.agent.localSession).map((game) => game.id), [
    "2048",
    "hextris",
    "life-restart"
  ]);
  assert.deepEqual(catalog.games.find((game) => game.id === "2048").agent, {
    localSession: true,
    browserBridge: true,
    browserPairing: false,
    surface: "integrated",
    contentLanguages: []
  });
  assert.deepEqual(catalog.games.find((game) => game.id === "hextris").agent, {
    localSession: true,
    browserBridge: false,
    browserPairing: false,
    surface: "dedicated-process",
    contentLanguages: []
  });
  assert.deepEqual(catalog.games.find((game) => game.id === "life-restart").agent, {
    localSession: true,
    browserBridge: false,
    browserPairing: false,
    surface: "integrated",
    contentLanguages: ["zh"]
  });
  assert.ok(catalog.games.filter((game) => !["2048", "hextris", "life-restart"].includes(game.id)).every((game) => (
    game.agent.localSession === false
    && game.agent.browserBridge === false
    && game.agent.browserPairing === false
    && game.agent.surface === "none"
  )));
  assert.deepEqual(projectPublicGameCatalog(payload, { agentOnly: true }).games.map((game) => game.id), [
    "2048",
    "hextris",
    "life-restart"
  ]);
  assert.match(catalog.games[0].launchPath, /^\/games\/[a-z0-9-]+\/\?lang=ja$/);
  assert.equal(getPublicGame(payload, "life-restart", { lang: "en" }).title, "Life Restart");

  const serialized = JSON.stringify(catalog);
  for (const forbidden of ["sourceEntry", "storage", "languageMap", "launchQuery", "languageQueryParam"]) {
    assert.equal(serialized.includes(forbidden), false, `did not expose ${forbidden}`);
  }
});

test("public game projection rejects duplicate ids, unsafe entries, and non-GitHub URLs", async () => {
  const payload = await gameCatalog();
  assert.throws(
    () => projectPublicGameCatalog(payload, { lang: "fr" }),
    (error) => error instanceof PublicCatalogError && error.code === "invalid_input" && error.status === 400
  );
  assert.throws(
    () => projectPublicGameCatalog(payload, { agentOnly: "false" }),
    (error) => error instanceof PublicCatalogError && error.code === "invalid_input" && error.status === 400
  );
  const duplicate = structuredClone(payload);
  duplicate.games.push(structuredClone(duplicate.games[0]));
  assert.throws(() => projectPublicGameCatalog(duplicate), (error) => error.code === "invalid_catalog");

  const unsafeEntry = structuredClone(payload);
  unsafeEntry.games[0].entry = "../admin/";
  assert.throws(() => projectPublicGameCatalog(unsafeEntry), (error) => error.code === "invalid_catalog");

  const unsafeRepo = structuredClone(payload);
  unsafeRepo.games[0].repo = "https://example.com/owner/repo";
  assert.throws(() => projectPublicGameCatalog(unsafeRepo), (error) => error.code === "invalid_catalog");

  const portedRepo = structuredClone(payload);
  portedRepo.games[0].repo = "https://github.com:444/owner/repo";
  assert.throws(() => projectPublicGameCatalog(portedRepo), (error) => error.code === "invalid_catalog");
});
