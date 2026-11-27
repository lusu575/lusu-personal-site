import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  checkSubprojectGovernance,
  hasAnchoredVisibleVersion,
} from "../scripts/check-subproject-governance.mjs";

const whiteboardVersion = readFileSync(new URL("../docs/whiteboard/VERSION", import.meta.url), "utf8").trim();
const transferVersion = readFileSync(new URL("../docs/transfer/VERSION", import.meta.url), "utf8").trim();

test("whiteboard and Quick Transfer keep independent patch versions and synchronized project docs", () => {
  assert.deepEqual(checkSubprojectGovernance(), [
    `online-whiteboard@${whiteboardVersion}`,
    `quick-transfer@${transferVersion}`,
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
