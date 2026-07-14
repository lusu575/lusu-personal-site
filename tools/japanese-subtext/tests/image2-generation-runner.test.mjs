import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import {
  acquireImage2OutputLock,
  assertExternalImage2OutputRoot,
  generateImage2Job,
  requestImage2,
  runConcurrentImage2Jobs,
  selectImage2GenerationJobs,
  validateImage2GenerationJob,
} from "../scripts/generate-image2-assets.mjs";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function job(overrides = {}) {
  const designIdentity = "stage:l1-001:cast:test";
  const designSeed = createHash("sha256")
    .update("japanese-subtext-cast-design-v2\0stage:l1-001:cast:test", "utf8")
    .digest("hex")
    .slice(0, 16);
  const prompt = overrides.prompt ??
    `Create a finished four-panel manga page without text. Design identity ${designIdentity}; seed ${designSeed}.`;
  return {
    prompt,
    model: "gpt-image-2",
    size: "1024x1024",
    quality: "high",
    output_format: "png",
    n: 1,
    out: "l1-001.png",
    stageId: "L1-001",
    promptHash: sha256(prompt),
    styleBibleHash: "a".repeat(64),
    sourceTextHash: "b".repeat(64),
    sourceTextHashSchemaVersion: "japanese-subtext-image-source-text-v1",
    castDesigns: [{
      castRef: "L1-001/test",
      castId: "test",
      designIdentity,
      kind: "independent",
      variant: "source-defined",
      designSeed,
      description: "A deterministic grayscale source-defined design.",
    }],
    generatorProvenance: {
      schemaVersion: 3,
      requestedGenerator: "image2",
      provider: "OpenAI Images",
      model: "gpt-image-2",
      operation: "generate",
      promptSchemaVersion: "japanese-subtext-image2-prompt-v4",
      sourceHashField: "sourceTextHash",
      sourceHashSchemaVersion: "japanese-subtext-image-source-text-v1",
      designIdentityRegistry: "tools/japanese-subtext/image2/design-identities.json",
      designIdentityRegistrySchemaVersion: "japanese-subtext-design-identities-v1",
      designIdentityRegistrySha256: "c".repeat(64),
      designSeedNamespace: "japanese-subtext-cast-design-v2",
    },
    ...overrides,
  };
}

async function png(width = 1024, height = 1024, red = 32) {
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: red, g: 48, b: 64, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
}

function response({ status = 200, body, requestId = "req_test" }) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({
      "content-type": "application/json",
      "x-request-id": requestId,
      ...(status === 429 ? { "retry-after": "0" } : {}),
    }),
    async json() {
      return body;
    },
    async text() {
      return JSON.stringify(body);
    },
  };
}

test("generation jobs are locked to audited gpt-image-2 high PNG requests", () => {
  assert.equal(validateImage2GenerationJob(job()).out, "l1-001.png");
  assert.throws(
    () => validateImage2GenerationJob(job({ model: "gpt-image-1.5" })),
    /model must be gpt-image-2/,
  );
  assert.throws(
    () => validateImage2GenerationJob(job({ quality: "medium" })),
    /quality must be high/,
  );
  assert.throws(
    () => validateImage2GenerationJob(job({ out: "../escape.png" })),
    /safe PNG basename/,
  );
  assert.throws(
    () => validateImage2GenerationJob(job({ promptHash: "0".repeat(64) })),
    /promptHash does not match/,
  );
});

test("requestImage2 sends the exact Images API contract and decodes base64 PNG", async () => {
  const image = await png();
  let captured;
  const result = await requestImage2(job(), {
    apiKey: "secret-never-log",
    fetchImpl: async (url, options) => {
      captured = { url, options };
      return response({ body: { data: [{ b64_json: image.toString("base64") }] } });
    },
    sleep: async () => {},
    maxAttempts: 1,
  });

  assert.equal(captured.url, "https://api.openai.com/v1/images/generations");
  assert.equal(captured.options.headers.Authorization, "Bearer secret-never-log");
  assert.deepEqual(JSON.parse(captured.options.body), {
    model: "gpt-image-2",
    prompt: job().prompt,
    size: "1024x1024",
    quality: "high",
    output_format: "png",
    background: "opaque",
    n: 1,
  });
  assert.deepEqual(result.bytes, image);
  assert.equal(result.requestId, "req_test");
});

test("requestImage2 retries only transient failures and never exposes the API key", async () => {
  const image = await png();
  let calls = 0;
  const delays = [];
  const result = await requestImage2(job(), {
    apiKey: "super-secret-key",
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) {
        return response({
          status: 429,
          requestId: "req_rate",
          body: { error: { message: "rate limited" } },
        });
      }
      return response({ body: { data: [{ b64_json: image.toString("base64") }] } });
    },
    sleep: async (milliseconds) => delays.push(milliseconds),
    maxAttempts: 2,
  });

  assert.equal(calls, 2);
  assert.equal(delays.length, 1);
  assert.deepEqual(result.bytes, image);

  await assert.rejects(
    requestImage2(job(), {
      apiKey: "super-secret-key",
      fetchImpl: async () =>
        response({ status: 400, body: { error: { message: "bad image request" } } }),
      sleep: async () => {},
      maxAttempts: 3,
    }),
    (error) => {
      assert.doesNotMatch(String(error), /super-secret-key/);
      assert.match(String(error), /bad image request/);
      return true;
    },
  );

  await assert.rejects(
    requestImage2(job(), {
      apiKey: "sk-proj-super-secret-key-123456",
      fetchImpl: async () =>
        response({
          status: 401,
          body: {
            error: { message: "Incorrect API key: sk-proj-super-secret-key-123456" },
          },
        }),
      sleep: async () => {},
      maxAttempts: 1,
    }),
    (error) => {
      assert.doesNotMatch(String(error), /sk-proj-super-secret-key-123456/);
      assert.match(String(error), /\[REDACTED\]/);
      return true;
    },
  );
});

test("non-JSON transient responses retry and the timeout covers response-body reads", async () => {
  const image = await png();
  let calls = 0;
  const result = await requestImage2(job(), {
    apiKey: "test-key",
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) {
        return {
          ok: false,
          status: 503,
          headers: new Headers({ "content-type": "text/plain" }),
          async text() {
            return "upstream unavailable";
          },
        };
      }
      return response({ body: { data: [{ b64_json: image.toString("base64") }] } });
    },
    sleep: async () => {},
    maxAttempts: 2,
  });
  assert.equal(calls, 2);
  assert.deepEqual(result.bytes, image);

  const started = Date.now();
  await assert.rejects(
    requestImage2(job(), {
      apiKey: "test-key",
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        text: async () => new Promise(() => {}),
      }),
      sleep: async () => {},
      maxAttempts: 1,
      timeoutMs: 15,
    }),
    /failed after 1 attempt/,
  );
  assert.ok(Date.now() - started < 250, "response body timeout must not hang the queue");
});

test("successful image responses must include OpenAI request provenance", async () => {
  const image = await png();
  await assert.rejects(
    requestImage2(job(), {
      apiKey: "test-key",
      maxAttempts: 1,
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        async text() {
          return JSON.stringify({ data: [{ b64_json: image.toString("base64") }] });
        },
      }),
    }),
    /request id/i,
  );
});

test("generation publishes atomically, resumes by provenance, and rejects stale artifacts", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "jp-image2-generate-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const image = await png();
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return response({ body: { data: [{ b64_json: image.toString("base64") }] } });
  };
  const options = {
    outputRoot: root,
    apiKey: "test-key",
    fetchImpl,
    sleep: async () => {},
    maxAttempts: 1,
  };

  const generated = await generateImage2Job(job(), options);
  assert.equal(generated.status, "generated");
  assert.equal(calls, 1);
  assert.deepEqual(await readFile(path.join(root, "l1-001.png")), image);

  const state = JSON.parse(
    await readFile(path.join(root, ".image2-state", "l1-001.png.json"), "utf8"),
  );
  assert.equal(state.evidenceType, "openai-images-api-v1");
  assert.equal(state.model, "gpt-image-2");
  assert.equal(state.promptHash, job().promptHash);
  assert.equal(state.sha256, sha256(image));
  assert.equal(state.width, 1024);
  assert.equal(state.height, 1024);

  const reused = await generateImage2Job(job(), options);
  assert.equal(reused.status, "reused");
  assert.equal(calls, 1);

  const statePath = path.join(root, ".image2-state", "l1-001.png.json");
  for (const invalidState of [
    { ...state, generatedAt: "not-a-date" },
    { ...state, width: 1 },
    { ...state, height: 1 },
    { ...state, bytes: 1 },
    { ...state, generator: { ...state.generator, requestId: null } },
    { ...state, generator: { ...state.generator, attempts: 999 } },
  ]) {
    await writeFile(statePath, `${JSON.stringify(invalidState, null, 2)}\n`, "utf8");
    await assert.rejects(generateImage2Job(job(), options), /stale or unverifiable/);
    assert.equal(calls, 1, "invalid provenance must never be silently reused");
  }
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");

  await writeFile(path.join(root, "l1-001.png"), Buffer.from("tampered"));
  await assert.rejects(generateImage2Job(job(), options), /stale or unverifiable/);

  const replaced = await generateImage2Job(job(), { ...options, replace: true });
  assert.equal(replaced.status, "generated");
  assert.equal(calls, 2);
  assert.deepEqual(await readFile(path.join(root, "l1-001.png")), image);
  assert.equal((await readdir(root)).some((name) => name.includes(".part-")), false);
});

test("generation rejects a PNG that has metadata but cannot be fully decoded", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "jp-image2-truncated-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const valid = await png();
  const truncated = valid.subarray(0, Math.max(64, Math.floor(valid.length / 2)));
  await assert.rejects(
    generateImage2Job(job(), {
      outputRoot: root,
      apiKey: "test-key",
      maxAttempts: 1,
      fetchImpl: async () =>
        response({ body: { data: [{ b64_json: truncated.toString("base64") }] } }),
    }),
    /png|decode|corrupt|unexpected/i,
  );
  await assert.rejects(access(path.join(root, "l1-001.png")), /ENOENT/);
});

test("the package exposes only the gpt-image-2 generator, not the legacy SVG renderer", async () => {
  const packageJson = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8"));
  assert.equal(
    packageJson.scripts["jp-subtext:image2:generate"],
    "node tools/japanese-subtext/scripts/generate-image2-assets.mjs",
  );
  assert.equal(packageJson.scripts["jp-subtext:illustrations"], undefined);
  await assert.rejects(
    readFile(
      path.join(repoRoot, "tools", "japanese-subtext", "scripts", "generate-manga-assets.mjs"),
    ),
    /ENOENT/,
  );
});

test("concurrent generation drains in-flight work before surfacing a failure", async () => {
  const events = [];
  await assert.rejects(
    runConcurrentImage2Jobs(["fail", "slow", "must-not-start"], 2, async (value) => {
      events.push(`start:${value}`);
      if (value === "fail") {
        await new Promise((resolve) => setTimeout(resolve, 5));
        events.push("failed");
        throw new Error("expected worker failure");
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
      events.push(`done:${value}`);
      return value;
    }),
    /expected worker failure/,
  );
  assert.ok(events.indexOf("done:slow") > events.indexOf("failed"));
  assert.equal(events.includes("start:must-not-start"), false);
});

test("selection never invents background:undefined aliases", () => {
  const stage = job();
  const background = job({
    stageId: undefined,
    sourceTextHash: undefined,
    sourceTextHashSchemaVersion: undefined,
    backgroundId: "desktop",
    out: "japanese-subtext-background-desktop.png",
    generatorProvenance: {
      schemaVersion: 1,
      requestedGenerator: "image2",
      provider: "OpenAI Images",
      model: "gpt-image-2",
      operation: "generate",
      promptSchemaVersion: "japanese-subtext-image2-background-prompt-v1",
    },
  });
  assert.throws(
    () => selectImage2GenerationJobs([stage, background], "background:undefined"),
    /unknown --only/,
  );
  assert.deepEqual(
    selectImage2GenerationJobs([stage, background], "background:desktop"),
    [background],
  );
});

test("the output lock never auto-removes an unknown owner and verifies release ownership", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "jp-image2-lock-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const lockPath = path.join(root, ".image2-generate.lock");
  await writeFile(lockPath, "", "utf8");
  await assert.rejects(
    acquireImage2OutputLock(root, { recoverStale: true }),
    /invalid|unknown|locked/i,
  );
  await access(lockPath);
  await rm(lockPath);

  const release = await acquireImage2OutputLock(root);
  await assert.rejects(acquireImage2OutputLock(root), /locked/i);
  await rm(lockPath);
  await writeFile(
    lockPath,
    `${JSON.stringify({ pid: process.pid, token: "different-owner" })}\n`,
    "utf8",
  );
  await assert.rejects(release(), /ownership/i);
  await access(lockPath);
});

test("stale-lock recovery is serialized by an OS lease", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "jp-image2-stale-race-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const lockPath = path.join(root, ".image2-generate.lock");
  await writeFile(
    lockPath,
    `${JSON.stringify({
      pid: 2_147_483_647,
      token: "a".repeat(32),
      startedAt: "2026-07-12T00:00:00.000Z",
    })}\n`,
    "utf8",
  );

  const contenders = await Promise.allSettled([
    acquireImage2OutputLock(root, { recoverStale: true }),
    acquireImage2OutputLock(root, { recoverStale: true }),
  ]);
  const winners = contenders.filter((result) => result.status === "fulfilled");
  const losers = contenders.filter((result) => result.status === "rejected");
  assert.equal(winners.length, 1);
  assert.equal(losers.length, 1);
  assert.match(String(losers[0].reason), /locked/i);
  await winners[0].value();
  await assert.rejects(access(lockPath), /ENOENT/);
});

test("release always drops the OS lease when the audit lock becomes unreadable", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "jp-image2-release-failure-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const lockPath = path.join(root, ".image2-generate.lock");
  const release = await acquireImage2OutputLock(root);
  await rm(lockPath);
  await mkdir(lockPath);
  await assert.rejects(release(), /EISDIR|directory|ownership/i);

  await rm(lockPath, { recursive: true });
  const nextRelease = await acquireImage2OutputLock(root);
  await nextRelease();
});

test("real paths prevent an external junction from targeting the project tree", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "jp-image2-realpath-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const protectedRoot = path.join(root, "protected");
  const outsideRoot = path.join(root, "outside");
  const junction = path.join(outsideRoot, "junction");
  await mkdir(protectedRoot);
  await mkdir(outsideRoot);
  await symlink(protectedRoot, junction, process.platform === "win32" ? "junction" : "dir");
  await assert.rejects(
    assertExternalImage2OutputRoot(junction, protectedRoot),
    /outside/i,
  );
  await assert.rejects(access(path.join(protectedRoot, ".image2-state")), /ENOENT/);
});
