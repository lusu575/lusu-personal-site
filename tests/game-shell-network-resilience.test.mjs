import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const gameShell = readFileSync(new URL("../games/game-shell.js", import.meta.url), "utf8");

function productionApiFetch() {
  const match = gameShell.match(
    /  async function apiFetch\(path, options = \{\}\) \{[\s\S]*?\r?\n  \}\r?\n\r?\n  async function loadAuthSession/
  );
  assert.ok(match, "production apiFetch should remain extractable for the hanging-request regression");
  return match[0].replace(/\r?\n\r?\n  async function loadAuthSession[\s\S]*$/, "");
}

test("a hanging cloud request is aborted by the production timeout helper", async () => {
  let requestSignal = null;
  const context = vm.createContext({
    AbortController,
    Error,
    Promise,
    cloudRequestTimeoutMs: 7000,
    t: (key) => key === "requestTimedOut" ? "request timed out" : key,
    window: { setTimeout, clearTimeout },
    fetch: (_path, options) => {
      requestSignal = options.signal;
      return new Promise((_resolve, reject) => {
        options.signal.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        }, { once: true });
      });
    }
  });
  vm.runInContext(`${productionApiFetch()}\nglobalThis.runApiFetch = apiFetch;`, context);

  await assert.rejects(
    context.runApiFetch("/api/auth/me", { timeoutMs: 15 }),
    (error) => error?.name === "TimeoutError"
      && error?.code === "REQUEST_TIMEOUT"
      && error?.message === "request timed out"
  );
  assert.equal(requestSignal?.aborted, true);
});

test("the game iframe enters local mode before optional account and cloud recovery", () => {
  const frameStart = gameShell.indexOf("frame.src = buildEntry(game);");
  const cloudStart = gameShell.indexOf("void initializeCloudAccess(game);");
  assert.ok(frameStart > 0 && cloudStart > frameStart, "the game must start before optional cloud initialization");
  assert.doesNotMatch(
    gameShell.slice(gameShell.indexOf("applyStorageDefaults(game);"), frameStart),
    /await\s+(?:loadAuthSession|restoreOrUpload)\s*\(/
  );
  assert.match(gameShell, /const cloudRequestTimeoutMs = 7000;/);
  assert.equal(gameShell.split("retryCloud:").length - 1, 3, "cloud retry copy should exist in all three languages");
  assert.match(gameShell, /addCloudRetryButton\(actions\)/);
});
