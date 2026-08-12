import assert from "node:assert/strict";
import test from "node:test";

import {
  H3ProtocolError,
  H3_STATE_TRANSITIONS,
  assertTransition,
  canonicalJobPayload,
  normalizeJobCreateRequest,
  normalizeSeed
} from "../lib/minimax-h3/protocol.mjs";
import { assertMvpJobRequest, handleMinimaxH3Api } from "../functions/api/minimax-h3-service.mjs";

const baseRequest = () => ({
  operationId: "op_12345678",
  runnerId: "runner_12345678",
  projectTitle: "测试短片",
  sourceLanguage: "zh-CN",
  job: {
    mode: "t2v",
    workflowVariant: null,
    durationSeconds: 5,
    targetFrames: null,
    aspectRatio: "16:9",
    preset: "safe",
    prompt: "A quiet city at blue hour.",
    references: [],
    includeVideoAudio: true,
    seed: null
  }
});

test("H3 remote job contract rejects extras and preserves canonical field semantics", () => {
  const request = baseRequest();
  const normalized = normalizeJobCreateRequest(request);
  assert.equal(normalized.job.durationSeconds, 5);
  assert.equal(normalized.job.seed, null);
  assert.equal(canonicalJobPayload(request), canonicalJobPayload({ ...request, job: { ...request.job } }));

  assert.throws(
    () => normalizeJobCreateRequest({ ...request, debug: true }),
    (error) => error instanceof H3ProtocolError && error.code === "H3_EXTRA_FIELDS"
  );
});

test("H3 uint64 seed is decimal-string-only and duration/frame relation is exact", () => {
  assert.equal(normalizeSeed("18446744073709551615"), "18446744073709551615");
  assert.throws(() => normalizeSeed(1), /seed must be null or an unsigned decimal string/);
  assert.throws(() => normalizeSeed("18446744073709551616"), /seed exceeds uint64/);

  const valid = baseRequest();
  valid.job.targetFrames = 124;
  valid.job.durationSeconds = 124 / 24;
  assert.equal(normalizeJobCreateRequest(valid).job.targetFrames, 124);

  assert.throws(
    () => normalizeJobCreateRequest({ ...valid, job: { ...valid.job, durationSeconds: 5 } }),
    (error) => error instanceof H3ProtocolError && error.code === "H3_DURATION_FRAMES_MISMATCH"
  );
});

test("H3 state machine has no terminal escape hatch", () => {
  assertTransition("queued", "leased");
  assertTransition("retrieving", "ready");
  assert.deepEqual(H3_STATE_TRANSITIONS.ready, ["expired", "deleted"]);
  assert.throws(() => assertTransition("ready", "running"), /Illegal H3 state transition/);
  assert.throws(() => assertTransition("failed", "queued"), /Illegal H3 state transition/);
});

test("H3 MVP gate keeps reference modes closed until their phase is implemented", () => {
  assert.doesNotThrow(() => assertMvpJobRequest({ job: { mode: "t2v", references: [] } }));
  assert.throws(
    () => assertMvpJobRequest({ job: { mode: "i2v", references: [] } }),
    (error) => error instanceof H3ProtocolError && error.code === "H3_PHASE_NOT_OPEN"
  );
  assert.throws(
    () => assertMvpJobRequest({ job: { mode: "t2v", references: [{ role: "first_frame" }] } }),
    (error) => error instanceof H3ProtocolError && error.code === "H3_PHASE_NOT_OPEN"
  );
});

test("H3 rejects unauthenticated requests before creating its feature schema", async () => {
  let schemaBatches = 0;
  const env = {
    DB: {
      batch() {
        schemaBatches += 1;
      }
    }
  };
  const request = new Request("https://example.test/api/admin/minimax-h3/runners");
  await assert.rejects(
    () => handleMinimaxH3Api({ request, env, parts: ["admin", "minimax-h3", "runners"] }),
    (error) => error instanceof H3ProtocolError && error.code === "H3_ADMIN_AUTH_REQUIRED"
  );
  assert.equal(schemaBatches, 0);
});
