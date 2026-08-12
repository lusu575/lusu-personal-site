import assert from "node:assert/strict";
import test from "node:test";

import { FIXED } from "../agents/minimax-h3-runner/src/config.mjs";
import { buildLocalT2VPlan, RunnerJobError } from "../agents/minimax-h3-runner/src/runner-loop.mjs";
import { createSiteClient } from "../agents/minimax-h3-runner/src/site-client.mjs";

const validSpec = () => ({
  projectTitle: "Runner test",
  sourceLanguage: "zh-CN",
  job: {
    mode: "t2v",
    durationSeconds: 5,
    targetFrames: null,
    aspectRatio: "16:9",
    preset: "safe",
    prompt: "A quiet blue-hour city with restrained camera motion.",
    references: [],
    includeVideoAudio: true,
    seed: null
  }
});

test("H3 Runner keeps fixed local targets and builds only the reference-free T2V plan", () => {
  assert.equal(FIXED.comfyHost, "127.0.0.1");
  assert.equal(FIXED.comfyPort, 8188);
  assert.equal(FIXED.bridgeHost, "127.0.0.1");
  assert.equal(FIXED.bridgePort, 8791);
  const plan = buildLocalT2VPlan(validSpec());
  assert.equal(plan.schema_version, "1.0");
  assert.equal(plan.jobs.length, 1);
  assert.equal(plan.jobs[0].mode, "t2v");
  assert.deepEqual(plan.jobs[0].references, []);
});

test("H3 Runner closes unsupported reference phases and unsafe seeds", () => {
  assert.throws(
    () => buildLocalT2VPlan({ ...validSpec(), job: { ...validSpec().job, mode: "i2v" } }),
    (error) => error instanceof RunnerJobError && error.code === "H3_PHASE_NOT_OPEN"
  );
  assert.throws(
    () => buildLocalT2VPlan({ ...validSpec(), job: { ...validSpec().job, seed: "18446744073709551615" } }),
    (error) => error instanceof RunnerJobError && error.code === "H3_SEED_UNSUPPORTED"
  );
});

test("H3 Runner site client rejects non-origin URLs and malformed bearer tokens", () => {
  assert.throws(
    () => createSiteClient({ baseUrl: "http://lusu575.com" }, "lusu_agent_invalid"),
    /HTTPS origin/
  );
  assert.throws(
    () => createSiteClient({ baseUrl: "https://lusu575.com/path" }, "lusu_agent_invalid"),
    /HTTPS origin/
  );
  assert.throws(
    () => createSiteClient({ baseUrl: "https://lusu575.com" }, "lusu_agent_invalid"),
    /Agent token/
  );
});
