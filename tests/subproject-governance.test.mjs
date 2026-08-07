import assert from "node:assert/strict";
import test from "node:test";
import {
  checkSubprojectGovernance,
  hasAnchoredVisibleVersion,
} from "../scripts/check-subproject-governance.mjs";

test("whiteboard and Quick Transfer keep independent patch versions and synchronized project docs", () => {
  assert.deepEqual(checkSubprojectGovernance(), [
    "online-whiteboard@1.0.7",
    "quick-transfer@1.0.7",
  ]);
});

test("a matching version elsewhere in a shared catalog cannot mask a stale governed tool card", () => {
  const catalog = `
    { "toolId": "quick-transfer", "version": "v1.0.2" },
    { "toolId": "japanese-subtext", "version": "v1.0.3" }
  `;
  const check = {
    anchor: '"toolId": "quick-transfer"',
    template: '"version": "v{{version}}"',
    maxChars: 64,
  };
  assert.equal(hasAnchoredVisibleVersion(catalog, check, "1.0.6"), false);
  assert.equal(hasAnchoredVisibleVersion(catalog.replace("v1.0.2", "v1.0.6"), check, "1.0.6"), true);
});
