import assert from "node:assert/strict";
import test from "node:test";
import { checkSubprojectGovernance } from "../scripts/check-subproject-governance.mjs";

test("whiteboard and Quick Transfer keep independent patch versions and synchronized project docs", () => {
  assert.deepEqual(checkSubprojectGovernance(), [
    "online-whiteboard@1.0.1",
    "quick-transfer@1.0.1",
  ]);
});
