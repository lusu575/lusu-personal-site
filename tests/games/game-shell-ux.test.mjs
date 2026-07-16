import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const catalogPath = path.join(repositoryRoot, "games/catalog.json");
const shellScriptPath = path.join(repositoryRoot, "games/game-shell.js");
const shellStylePath = path.join(repositoryRoot, "games/game-shell.css");
const supportedLanguages = ["zh", "en", "ja"];

const [catalog, shellScript, shellStyle] = await Promise.all([
  readFile(catalogPath, "utf8").then(JSON.parse),
  readFile(shellScriptPath, "utf8"),
  readFile(shellStylePath, "utf8")
]);

test("every catalog game explains controls, save scope, and browser requirements", async () => {
  assert.equal(catalog.games.length, 5);

  for (const game of catalog.games) {
    for (const language of supportedLanguages) {
      assert.ok(game.controls?.[language]?.trim(), `${game.id} is missing ${language} controls`);
      assert.ok(game.storage?.scope?.[language]?.trim(), `${game.id} is missing ${language} save scope`);
    }
    assert.ok(Array.isArray(game.browserRequirements), `${game.id} browserRequirements must be an array`);
    assert.ok(game.browserRequirements.length > 0, `${game.id} needs at least one browser requirement`);
    assert.match(game.sourceEntry, /^source\/[a-z0-9][a-z0-9._/-]*\.html$/i);
    await access(path.join(repositoryRoot, "games", game.id, game.sourceEntry));
  }
});

test("game shell presents localized play information and an accurate iframe title", () => {
  assert.match(shellScript, /function renderPlayInfo\(game\)/);
  assert.match(shellScript, /t\("controlsLabel"\)/);
  assert.match(shellScript, /t\("saveScopeLabel"\)/);
  assert.match(shellScript, /t\("gameFrameTitle", \{ title: displayTitle \}\)/);

  for (const language of supportedLanguages) {
    assert.match(shellScript, new RegExp(`${language}: \\{`));
  }
});

test("game load failures distinguish network, missing resources, and unsupported browsers", () => {
  assert.match(shellScript, /class GameShellError extends Error/);
  assert.match(shellScript, /new GameShellError\("network"/);
  assert.match(shellScript, /new GameShellError\("missing"/);
  assert.match(shellScript, /new GameShellError\(\s*"unsupported"/);
  assert.match(shellScript, /fetch\(entry, \{ method: "HEAD", cache: "no-store" \}\)/);
  assert.match(shellScript, /dataset\.gameRetry/);
  assert.match(shellScript, /retryButton\.addEventListener\("click", retryGame\)/);
  assert.match(shellStyle, /\.game-load-state\.is-network/);
  assert.match(shellStyle, /\.game-load-state\.is-missing/);
  assert.match(shellStyle, /\.game-load-state\.is-unsupported/);
});

test("game shell uses a stable media stage and aligned touch-sized actions", () => {
  assert.match(shellStyle, /\.game-stage\s*\{[^}]*aspect-ratio:\s*16\s*\/\s*9/s);
  assert.match(shellStyle, /\.tool-row\s*\{[^}]*display:\s*grid/s);
  assert.match(shellStyle, /\.tool-row\s*\{[^}]*grid-template-columns:\s*repeat\(2,/s);
  assert.match(shellStyle, /\.back-link,[\s\S]*?min-height:\s*44px/);
  assert.match(shellStyle, /\.game-play-info\s*\{/);
});

test("return navigation leaves both history and query/session focus fallbacks", () => {
  assert.match(shellScript, /focusGame=/);
  assert.match(shellScript, /lusu\.games\.returnFocus/);
  assert.match(shellScript, /window\.sessionStorage\.setItem\(returnFocusStorageKey/);
  assert.match(shellScript, /window\.history\.back\(\)/);
  assert.match(shellScript, /bindBackLink\(loginLink\)/);
});
