import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const gameShellCss = read("games/game-shell.css");
const game2048Css = read("games/2048/source/styles.css");
const gameHextrisCss = read("games/hextris/source/styles.css");
const gameEntries = [
  "games/2048/index.html",
  "games/a-dark-room/index.html",
  "games/hextris/index.html",
  "games/kittens-game/index.html",
  "games/life-restart/index.html"
].map((path) => [path, read(path)]);
const shellCacheVersion = "20260812-wallpaper-game-display-r1";

function mediaBlock(css, query, nextQuery = null) {
  const start = css.indexOf(`@media ${query}`);
  assert.notEqual(start, -1, `missing media query ${query}`);
  const end = nextQuery ? css.indexOf(`@media ${nextQuery}`, start + 1) : css.length;
  assert.notEqual(end, -1, `missing following media query ${nextQuery}`);
  return css.slice(start, end);
}

test("shared game shell owns exactly one viewport and gives remaining space to the iframe", () => {
  assert.match(gameShellCss, /html\s*\{[\s\S]*?height:\s*100%;[\s\S]*?overflow:\s*hidden;/);
  assert.match(gameShellCss, /body\s*\{[\s\S]*?height:\s*100vh;[\s\S]*?min-height:\s*0;[\s\S]*?overflow:\s*hidden;/);
  assert.match(gameShellCss, /@supports\s*\(height:\s*100dvh\)\s*\{[\s\S]*?body\s*\{[\s\S]*?height:\s*100dvh;/);
  assert.match(gameShellCss, /\.game-shell\s*\{[\s\S]*?grid-template-rows:\s*auto minmax\(0,\s*1fr\);[\s\S]*?min-height:\s*0;/);
  assert.match(gameShellCss, /\.game-frame-card\s*\{[\s\S]*?grid-template-rows:\s*auto auto auto auto minmax\(0,\s*1fr\);/);
  assert.match(gameShellCss, /\.game-frame-card\s*\{[\s\S]*?height:\s*calc\(100%\s*-\s*20px\);[\s\S]*?min-height:\s*0;/);
  assert.match(gameShellCss, /\.game-frame-card\s*\{[\s\S]*?width:\s*calc\(100%\s*-\s*20px\);/);
  assert.doesNotMatch(gameShellCss, /width:\s*min\(1280px/);
  assert.match(gameShellCss, /data-tools-collapsed="true"[\s\S]*?grid-template-rows:\s*auto minmax\(0,\s*1fr\);/);
  assert.match(gameShellCss, /\.game-frame\s*\{[\s\S]*?height:\s*100%;[\s\S]*?min-height:\s*0;/);
  assert.doesNotMatch(gameShellCss, /\.game-frame\s*\{[^}]*min-height:\s*(?:260|360|420|620)px/);
});

test("short game shells expose an accessible tool toggle so gameplay keeps the viewport", () => {
  const shell = read("games/game-shell.js");
  assert.match(shell, /function initializeGameToolsToggle\(\)/);
  assert.match(shell, /\(max-width: 860px\), \(max-height: 720px\)/);
  assert.match(shell, /button\.setAttribute\("aria-expanded", String\(!collapsed\)\)/);
  assert.match(shell, /card\.dataset\.toolsCollapsed = String\(collapsed\)/);
  assert.match(gameShellCss, /\.game-tools-toggle\s*\{[\s\S]*?min-height:\s*44px;/);
});

test("shared shell mobile return, save, import, sign-in, and cloud actions keep 44px targets", () => {
  const mobile = mediaBlock(
    gameShellCss,
    "(max-width: 560px) {",
    "(min-width: 700px) and (max-width: 860px) and (max-height: 460px) {"
  );
  assert.match(mobile, /\.game-topbar\s*\{[\s\S]*?flex-direction:\s*row;/);
  assert.match(mobile, /\.cloud-login input,\s*\.cloud-actions \.tool-button\s*\{[\s\S]*?min-height:\s*44px;/);
  assert.match(
    mobile,
    /\.tool-button,\s*\.file-button,\s*\.play-button,\s*\.back-link\s*\{[\s\S]*?min-height:\s*44px;/
  );
  assert.doesNotMatch(mobile, /min-height:\s*(?:30|32|34)px/);
  const coarse = mediaBlock(
    gameShellCss,
    "(pointer: coarse) {",
    "(min-width: 700px) and (max-width: 860px) and (max-height: 460px) {"
  );
  assert.match(
    coarse,
    /\.tool-button,\s*\.file-button,\s*\.play-button,\s*\.back-link,\s*\.cloud-login input,\s*\.cloud-actions \.tool-button\s*\{[\s\S]*?min-height:\s*44px;/
  );
});

test("2048 and Hextris mobile primary controls keep 44px targets", () => {
  const game2048Mobile = mediaBlock(game2048Css, "(max-width: 520px) {");
  const gameHextrisMobile = mediaBlock(gameHextrisCss, "(max-width: 540px) {");
  assert.match(game2048Mobile, /button\s*\{[\s\S]*?min-height:\s*44px;/);
  assert.match(gameHextrisMobile, /button\s*\{[\s\S]*?min-height:\s*44px;/);
  assert.match(game2048Css, /@media\s*\(pointer:\s*coarse\)\s*\{[\s\S]*?button\s*\{[\s\S]*?min-height:\s*44px;/);
  assert.match(gameHextrisCss, /@media\s*\(pointer:\s*coarse\)\s*\{[\s\S]*?button\s*\{[\s\S]*?min-height:\s*44px;/);
});

test("all game entries share one explicit shell cache version", () => {
  for (const [path, html] of gameEntries) {
    assert.match(html, new RegExp(`game-shell\\.css\\?v=${shellCacheVersion}`), path);
    assert.match(html, new RegExp(`game-shell\\.js\\?v=${shellCacheVersion}`), path);
  }
  assert.match(read("games/2048/source/index.html"), /styles\.css\?v=20260726-mobile-touch-r1/);
  assert.match(read("games/hextris/source/index.html"), /styles\.css\?v=20260807-hextris-agent-gpl-r1/);
});
