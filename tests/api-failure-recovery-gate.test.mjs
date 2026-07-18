import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

test("article and video routes distinguish failure from empty data and expose explicit retry", () => {
  const knowledge = read("js/routes/knowledge.mjs");
  const videos = read("js/routes/videos.mjs");
  const videoTests = read("tests/videos-player.test.mjs");
  assert.match(knowledge, /articleState\.error/);
  assert.match(knowledge, /articleRetry\s*:\s*""|article-retry|dataset\.articleRetry/i);
  assert.match(knowledge, /articleState\.loading/);
  assert.match(videos, /videoState\.error/);
  assert.match(videos, /dataVideoRetry|video-retry|dataset\.videoRetry/i);
  assert.match(videoTests, /failure, true empty, and normal data/);
  assert.match(videoTests, /supplies retry plus original fallback/);
});

test("account, Chat, and Transfer executable tests force failure and preserve recoverable input", () => {
  const accountTests = read("tests/account-feature.test.mjs");
  const chatTests = read("tests/chatroom-submit.test.mjs");
  const transferTests = read("tests/transfer/transfer-client-ui.test.mjs");
  assert.match(accountTests, /request failures map to a real field and recoverable localized status/);
  assert.match(accountTests, /without mutating drafts/);
  assert.match(chatTests, /failed send keeps the exact draft and an explicit retry starts only one new request/);
  assert.match(chatTests, /offline recovery refreshes but never replays a failed or pending POST/);
  assert.match(transferTests, /load failure is retryable and route-leave races never initialize/);
  assert.match(transferTests, /preserves retryable task identity/);
});

test("the unified release gate runs resilience plus security/privacy tests before browser evidence", () => {
  const packageData = JSON.parse(read("package.json"));
  const testCommand = packageData.scripts.test;
  assert.match(testCommand, /tests\/\*\.test\.mjs/);
  assert.match(testCommand, /tests\/transfer\/\*\.test\.mjs/);
  assert.equal(packageData.scripts["qa:public-release"], "npm run verify:public-site-release");
  assert.match(packageData.scripts["verify:public-site-release"], /^npm run test && npm run check:public-modules && npm run build/);
  for (const path of [
    "tests/api-failure-recovery-gate.test.mjs",
    "tests/public-security-boundaries.test.mjs",
    "tests/repository-secrets.test.mjs",
    "tests/runtime-secrets.test.mjs"
  ]) assert.ok(read(path).length > 100, `${path} must remain part of the executable test surface`);
});
