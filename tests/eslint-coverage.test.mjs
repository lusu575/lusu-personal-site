import assert from "node:assert/strict";
import test from "node:test";
import { ESLint } from "eslint";

const eslint = new ESLint();

test("recommended lint rules apply to every first-party execution surface, including future modules", async () => {
  for (const filePath of [
    "js/main.js", "js/routes/knowledge.mjs", "admin/admin.js",
    "functions/api/[[route]].js", "lib/capabilities/site-client.mjs",
    "cli/lusu.mjs", "mcp/local/server.mjs", "scripts/production-smoke.mjs",
    "tests/future-regression.test.mjs", "agents/minimax-h3-runner/src/main.mjs",
    "tools/japanese-subtext/lib/audio-player.mjs", "tools/whiteboard/src/main.jsx",
    "games/hextris/source/game.js", "games/a-dark-room/source/script/lusu-agent-bridge.js",
    "games/life-restart/source/lusu-agent-bridge.js", "workers/transfer-cleanup/index.mjs",
    "自动新闻/integrations/lusu-site/network-fetch.mjs"
  ]) {
    const [result] = await eslint.lintText("const unusedReleaseFixture = undefinedReleaseFixture;", { filePath });
    assert.ok(result.messages.some((message) => message.ruleId === "no-unused-vars"), `${filePath}: unused variables must fail`);
    assert.ok(result.messages.some((message) => message.ruleId === "no-undef"), `${filePath}: undefined names must fail`);
  }
});

test("third-party engines and generated assets are explicitly excluded while LuSu bridges are included", async () => {
  for (const path of [
    "games/a-dark-room/source/script/engine.js",
    "games/kittens-game/source/game.js",
    "games/life-restart/source/assets/index-ZpiTsTqN.js",
    "dist/_assets/main.test.js"
  ]) assert.equal(await eslint.isPathIgnored(path), true, path);
  assert.equal(await eslint.isPathIgnored("games/a-dark-room/source/script/lusu-agent-bridge.js"), false);
  assert.equal(await eslint.isPathIgnored("games/life-restart/source/lusu-mobile-touch.js"), false);
});
