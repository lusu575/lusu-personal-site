import test from "node:test";
import assert from "node:assert/strict";
import { questionActionState } from "../lib/question-flow.mjs";

test("question recovery actions follow the current attempt instead of historical clears", () => {
  assert.deepEqual(questionActionState(), { showRetry: false, showNext: false });
  assert.deepEqual(
    questionActionState({ submitted: true, attemptCleared: false }),
    { showRetry: true, showNext: false }
  );
  assert.deepEqual(
    questionActionState({ submitted: true, attemptCleared: true }),
    { showRetry: false, showNext: true }
  );
  assert.deepEqual(
    questionActionState({ submitted: true, attemptCleared: false, cleared: true }),
    { showRetry: true, showNext: false }
  );
});
