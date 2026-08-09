import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const gameShell = read("games/game-shell.js");
const gameShellCss = read("games/game-shell.css");
const gameEntries = [
  "games/2048/index.html",
  "games/a-dark-room/index.html",
  "games/hextris/index.html",
  "games/kittens-game/index.html",
  "games/life-restart/index.html"
].map((path) => [path, read(path)]);
const cacheVersion = "20260809-browser-game-agent-v1";

test("game shell pauses every upload path while a cloud-save conflict is unresolved", () => {
  assert.doesNotMatch(gameShell, /window\.confirm\s*\(/);
  assert.match(gameShell, /if\s*\(\s*cloudConflict\s*&&\s*!options\.allowConflict\s*\)/);
  assert.match(gameShell, /if\s*\(\s*!authUser\s*\|\|\s*!cloudVersionReady\s*\|\|\s*cloudConflict\s*\)\s*\{\s*return;/);
  assert.match(gameShell, /expectedUpdatedAt:\s*expectedCloudUpdatedAt/);
  assert.match(gameShell, /error\.status\s*===\s*409\s*&&\s*error\.code\s*===\s*"SAVE_CONFLICT"/);
  assert.match(gameShell, /stopAutoSync\(\);[\s\S]*renderCloudPanel\(t\(statusKey\)\)/);
});

test("each tab keeps its own cloud-version baseline before any automatic upload", () => {
  const baselineBlock = gameShell.match(
    /function\s+getKnownCloudTime\(game\)[\s\S]*?function\s+rememberCloudTime\(game,\s*updatedAt\)[\s\S]*?\n\s*\}/
  )?.[0] || "";
  assert.match(gameShell, /window\.sessionStorage\.getItem\(key\)/);
  assert.match(gameShell, /window\.sessionStorage\.setItem\(key,\s*textValue\)/);
  assert.match(baselineBlock, /safeGetTabStorageItem\(getCloudMetaKey\(game\)\)/);
  assert.match(baselineBlock, /safeSetTabStorageItem\(getCloudMetaKey\(game\),\s*updatedAt\)/);
  assert.doesNotMatch(baselineBlock, /safe(?:Get|Set)StorageItem/);
  assert.match(gameShell, /cloudSave\s*&&\s*localExists\s*&&\s*cloudTime\s*>\s*knownCloudTime/);
});

test("cloud conflict UI is explicit, trilingual, modal, and backup-first", () => {
  for (const token of [
    "cloudConflictTitle",
    "cloudConflictAdvice",
    "restoreCloud",
    "keepLocalOverwrite",
    "downloadLocalBackup",
    "cancelConflict",
    "reviewConflict"
  ]) {
    assert.equal(gameShell.split(`${token}:`).length - 1, 3, `${token} should exist in zh/en/ja`);
  }
  assert.match(gameShell, /setAttribute\("role",\s*"dialog"\)/);
  assert.match(gameShell, /setAttribute\("aria-modal",\s*"true"\)/);
  assert.match(gameShell, /setAttribute\("inert",\s*""\)/);
  assert.match(gameShell, /event\.key\s*===\s*"Escape"/);
  assert.match(gameShell, /backupButton\.focus\(\{\s*preventScroll:\s*true\s*\}\)/);
  assert.match(
    gameShell,
    /choice\s*===\s*"restore"[\s\S]*?currentPayload\s*=\s*await\s+apiFetch\(`\/api\/saves\/\$\{game\.id\}`\)[\s\S]*?currentPayload\.updatedAt\s*!==\s*payload\.updatedAt[\s\S]*?continue;[\s\S]*?applySaveData\(game,\s*currentPayload\.save\)/
  );
  assert.doesNotMatch(gameShell, /choice\s*===\s*"restore"[\s\S]{0,200}?applySaveData\(game,\s*payload\.save\)/);
  assert.match(gameShellCss, /\.cloud-conflict-overlay\s*\{/);
  assert.match(gameShellCss, /\.cloud-conflict-actions\s+\.tool-button\s*\{[\s\S]*min-height:\s*44px/);
  assert.match(gameShellCss, /\.cloud-account\.is-conflict\s+\.cloud-conflict-message\s*\{[\s\S]*display:\s*block/);
});

test("every game entry cache-busts the shared conflict-safe shell assets", () => {
  for (const [path, html] of gameEntries) {
    assert.match(html, new RegExp(`game-shell\\.css\\?v=${cacheVersion}`), path);
    assert.match(html, new RegExp(`game-shell\\.js\\?v=${cacheVersion}`), path);
  }
});
