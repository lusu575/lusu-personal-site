import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import {
  publishImage2Assets,
  verifyPublishedImage2Assets,
} from "../scripts/publish-image2-assets.mjs";
import { acquireImage2OutputLock } from "../scripts/generate-image2-assets.mjs";

const sha256Text = (value) =>
  createHash("sha256").update(value, "utf8").digest("hex");
const sha256Buffer = (value) => createHash("sha256").update(value).digest("hex");

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

async function writeJsonl(filePath, values) {
  await writeFile(
    filePath,
    `${values.map((value) => JSON.stringify(value)).join("\n")}\n`,
    "utf8",
  );
}

async function createFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "jp-image2-pipeline-"));
  const pngRoot = path.join(root, "png");
  const publicRoot = path.join(root, "public");
  const stageOutRoot = path.join(publicRoot, "assets", "stages", "v-test");
  const backgroundOutRoot = path.join(publicRoot, "assets", "backgrounds");
  const manifestPath = path.join(stageOutRoot, "manifest.json");
  const styleBiblePath = path.join(root, "style-bible.md");
  const designIdentityRegistryPath = path.join(root, "design-identities.json");
  const stageJobsPath = path.join(root, "stage-jobs.jsonl");
  const backgroundJobsPath = path.join(root, "background-jobs.jsonl");
  const backgroundJobsManifestPath = path.join(root, "background-jobs-manifest.json");
  await mkdir(pngRoot, { recursive: true });

  const styleBible = "image2 raster style contract\n";
  const styleBibleHash = sha256Text(styleBible);
  const designIdentityRegistry = "fixture design identity registry\n";
  const designIdentityRegistryHash = sha256Text(designIdentityRegistry);
  await writeFile(styleBiblePath, styleBible, "utf8");
  await writeFile(
    designIdentityRegistryPath,
    designIdentityRegistry,
    "utf8",
  );

  const stageJobs = ["L1-001", "L1-002"].map((stageId, index) => {
    const castId = `fixture-${index + 1}`;
    const designIdentity = `stage:${stageId.toLowerCase()}:cast:${castId}`;
    const designSeed = createHash("sha256")
      .update(`japanese-subtext-cast-design-v2\0${designIdentity}`, "utf8")
      .digest("hex")
      .slice(0, 16);
    const prompt = `Raster stage prompt ${index + 1}; design identity ${designIdentity}; seed ${designSeed}`;
    return {
      prompt,
      model: "gpt-image-2",
      size: "1536x1152",
      quality: "high",
      output_format: "png",
      n: 1,
      out: `${stageId.toLowerCase()}.png`,
      stageId,
      sourceTextHash: sha256Text(`source-text:${stageId}`),
      sourceTextHashSchemaVersion: "japanese-subtext-image-source-text-v1",
      promptHash: sha256Text(prompt),
      styleBibleHash,
      castDesigns: [{
        castRef: `${stageId}/${castId}`,
        castId,
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
        designIdentityRegistrySha256: designIdentityRegistryHash,
        designSeedNamespace: "japanese-subtext-cast-design-v2",
      },
    };
  });
  const backgroundJobs = [
    {
      backgroundId: "desktop",
      out: "japanese-subtext-background-desktop.png",
      size: "2048x1152",
    },
    {
      backgroundId: "mobile",
      out: "japanese-subtext-background-mobile.png",
      size: "1024x1536",
    },
  ].map((spec) => {
    const prompt = `Raster ${spec.backgroundId} background prompt`;
    return {
      prompt,
      model: "gpt-image-2",
      size: spec.size,
      quality: "high",
      output_format: "png",
      n: 1,
      out: spec.out,
      backgroundId: spec.backgroundId,
      promptHash: sha256Text(prompt),
      styleBibleHash,
      generatorProvenance: {
        schemaVersion: 1,
        requestedGenerator: "image2",
        provider: "OpenAI Images",
        model: "gpt-image-2",
        operation: "generate",
        promptSchemaVersion: "japanese-subtext-image2-background-prompt-v1",
      },
    };
  });
  await writeJsonl(stageJobsPath, stageJobs);
  await writeJsonl(backgroundJobsPath, backgroundJobs);
  await writeFile(
    backgroundJobsManifestPath,
    `${JSON.stringify({
      schemaVersion: 1,
      jobCount: 2,
      model: "gpt-image-2",
      quality: "high",
      styleBibleHash,
      jobs: backgroundJobs.map(({ backgroundId, out, size, promptHash }) => ({
        backgroundId,
        out,
        size,
        promptHash,
        styleBibleHash,
      })),
    })}\n`,
    "utf8",
  );

  for (const [index, job] of stageJobs.entries()) {
    await sharp({
      create: {
        width: 1536,
        height: 1152,
        channels: 3,
        background: index === 0 ? { r: 220, g: 80, b: 80 } : { r: 80, g: 80, b: 220 },
      },
    })
      .png()
      .toFile(path.join(pngRoot, job.out));
  }
  for (const job of backgroundJobs) {
    const [width, height] = job.size.split("x").map(Number);
    const color =
      job.backgroundId === "desktop"
        ? { r: 64, g: 96, b: 128 }
        : { r: 128, g: 96, b: 64 };
    await sharp({
      create: {
        width,
        height,
        channels: 3,
        background: color,
      },
    })
      .png()
      .toFile(path.join(pngRoot, job.out));
  }

  const generationStateRoot = path.join(pngRoot, ".image2-state");
  await mkdir(generationStateRoot, { recursive: true });
  for (const job of [...stageJobs, ...backgroundJobs]) {
    const bytes = await readFile(path.join(pngRoot, job.out));
    const [width, height] = job.size.split("x").map(Number);
    const state = {
      schemaVersion: 1,
      status: "complete",
      evidenceType: "openai-images-api-v1",
      generatedAt: "2026-07-12T00:00:00.000Z",
      stageId: job.stageId ?? null,
      backgroundId: job.backgroundId ?? null,
      out: job.out,
      model: "gpt-image-2",
      quality: "high",
      outputFormat: "png",
      requestSchemaVersion: "openai-images-gpt-image-2-v1",
      size: job.size,
      width,
      height,
      bytes: bytes.length,
      sha256: sha256Buffer(bytes),
      promptHash: job.promptHash,
      styleBibleHash: job.styleBibleHash,
      sourceTextHash: job.sourceTextHash ?? null,
      sourceTextHashSchemaVersion: job.sourceTextHashSchemaVersion ?? null,
      promptSchemaVersion: job.generatorProvenance.promptSchemaVersion,
      generator: {
        provider: "OpenAI Images",
        model: "gpt-image-2",
        endpoint: "/v1/images/generations",
        requestId: `req_fixture_${job.stageId ?? job.backgroundId}`,
        attempts: 1,
      },
      revisedPromptSha256: null,
      usage: null,
    };
    await writeFile(
      path.join(generationStateRoot, `${job.out}.json`),
      `${JSON.stringify(state, null, 2)}\n`,
      "utf8",
    );
  }

  return {
    root,
    pngRoot,
    publicRoot,
    stageOutRoot,
    backgroundOutRoot,
    manifestPath,
    styleBiblePath,
    designIdentityRegistryPath,
    stageJobsPath,
    backgroundJobsPath,
    backgroundJobsManifestPath,
    generationStateRoot,
    expectedStageIds: stageJobs.map((job) => job.stageId),
  };
}

async function convertFixtureEvidenceToBuiltin(fixture) {
  const stateFiles = (await readdir(fixture.generationStateRoot))
    .filter((name) => name.endsWith(".json"))
    .sort();
  for (const [index, name] of stateFiles.entries()) {
    const statePath = path.join(fixture.generationStateRoot, name);
    const state = JSON.parse(await readFile(statePath, "utf8"));
    const toolRunId = `exec-00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
    const reviewEvidence = {
      schemaVersion: 1,
      status: "codex-approved",
      jobId: state.stageId ?? `background:${state.backgroundId}`,
      toolRunId,
      sourceArtifactSha256: state.sha256,
      reviewedAt: state.generatedAt,
      reviewer: "fixture-reviewer",
      checks: {
        promptRelevant: true,
        compositionMatchesTask: true,
        noAnswerLeak: true,
        noReadableText: true,
        noWatermark: true,
        aspectRatioApproved: true,
      },
    };
    state.evidenceType = "codex-builtin-imagegen-v1";
    delete state.requestSchemaVersion;
    delete state.revisedPromptSha256;
    delete state.usage;
    state.generator = {
      provider: "OpenAI Images",
      model: "gpt-image-2",
      tool: "image_gen.imagegen",
      toolRunId,
    };
    state.sourceArtifact = {
      filename: state.out,
      generatedAt: state.generatedAt,
      width: state.width,
      height: state.height,
      bytes: state.bytes,
      sha256: state.sha256,
    };
    state.normalization = {
      schemaVersion: "codex-builtin-imagegen-normalization-v1",
      operation: "aspect-verified-resize",
      kernel: "lanczos3",
      sourceWidth: state.width,
      sourceHeight: state.height,
      targetWidth: state.width,
      targetHeight: state.height,
      maximumAspectRelativeError: state.stageId ? 0.00001 : 0.002,
      observedAspectRelativeError: 0,
    };
    state.reviewEvidence = reviewEvidence;
    state.reviewEvidenceSha256 = sha256Text(canonicalJson(reviewEvidence));
    await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  }
}

function cleanFixtureAfter(t, root) {
  t.after(async () => {
    sharp.cache(false);
    await new Promise((resolve) => setTimeout(resolve, 100));
    await rm(root, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 100,
    });
  });
}

test("publishes image2 PNG jobs as audited WebP assets and verifies the result", async (t) => {
  const fixture = await createFixture();
  cleanFixtureAfter(t, fixture.root);

  const result = await publishImage2Assets({
    ...fixture,
    schemaVersion: 3,
    contentVersion: "9.9.9",
    reviewStatus: "pending-codex-review",
    webpQuality: 82,
    nearDuplicateThreshold: 0,
  });

  assert.equal(result.manifest.stageCount, 2);
  assert.equal(result.manifest.backgroundCount, 2);
  assert.match(result.manifest.stages[0].generationEvidence.requestId, /^req_fixture_/);
  assert.equal(
    result.manifest.stages[0].generationEvidence.evidenceType,
    "openai-images-api-v1",
  );
  assert.match(result.manifest.stages[0].generationEvidence.stateSha256, /^[a-f0-9]{64}$/);
  assert.equal(result.manifest.model, "gpt-image-2");
  assert.equal(result.manifest.quality, "high");
  assert.equal(result.manifest.schemaVersion, 3);
  assert.equal(result.manifest.contentVersion, "9.9.9");
  assert.equal(result.manifest.stages[0].reviewStatus, "pending-codex-review");
  assert.equal(result.manifest.stages[0].sourceHashKind, "stage-source-text");
  assert.match(result.manifest.stages[0].sourceTextHash, /^[a-f0-9]{64}$/);
  assert.equal(
    result.manifest.stages[0].sourceTextHashSchemaVersion,
    "japanese-subtext-image-source-text-v1",
  );
  assert.equal("sourceContentHash" in result.manifest.stages[0], false);
  assert.match(result.manifest.stages[0].dHash, /^[a-f0-9]{16}$/);
  assert.match(result.manifest.stages[0].original.sha256, /^[a-f0-9]{64}$/);
  assert.match(result.manifest.stages[0].published.sha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(
    [result.manifest.stages[0].original.width, result.manifest.stages[0].original.height],
    [1536, 1152],
  );
  assert.deepEqual(
    [result.manifest.stages[0].published.width, result.manifest.stages[0].published.height],
    [960, 720],
  );
  assert.equal(
    result.manifest.stages[0].published.path,
    "assets/stages/v-test/l1-001.webp",
  );
  assert.deepEqual(
    result.manifest.backgrounds.map((entry) => [
      entry.backgroundId,
      entry.published.width,
      entry.published.height,
    ]),
    [
      ["desktop", 2048, 1152],
      ["mobile", 1024, 1536],
    ],
  );
  assert.equal(result.manifest.nearDuplicateReport.threshold, 0);
  assert.equal(result.manifest.nearDuplicateReport.action, "report-only");
  assert.equal(result.manifest.nearDuplicateReport.pairs.length, 1);

  const savedManifest = JSON.parse(await readFile(fixture.manifestPath, "utf8"));
  assert.deepEqual(savedManifest, result.manifest);
  assert.deepEqual(
    await sharp(path.join(fixture.stageOutRoot, "l1-001.webp")).metadata().then((metadata) => [
      metadata.width,
      metadata.height,
      metadata.format,
    ]),
    [960, 720, "webp"],
  );

  const checked = await verifyPublishedImage2Assets({
    ...fixture,
    schemaVersion: 3,
    contentVersion: "9.9.9",
    webpQuality: 82,
    nearDuplicateThreshold: 0,
  });
  assert.equal(checked.stageCount, 2);
  assert.equal(checked.backgroundCount, 2);
});

test("publishes Codex built-in image_gen evidence without fabricating API request fields", async (t) => {
  const fixture = await createFixture();
  cleanFixtureAfter(t, fixture.root);
  await convertFixtureEvidenceToBuiltin(fixture);

  const result = await publishImage2Assets({
    ...fixture,
    schemaVersion: 3,
    contentVersion: "9.9.9",
    reviewStatus: "codex-approved",
    webpQuality: 82,
    nearDuplicateThreshold: 0,
  });

  for (const entry of [...result.manifest.stages, ...result.manifest.backgrounds]) {
    assert.equal(entry.generationEvidence.evidenceType, "codex-builtin-imagegen-v1");
    assert.equal(entry.generationEvidence.tool, "image_gen.imagegen");
    assert.match(entry.generationEvidence.toolRunId, /^exec-/);
    assert.equal(entry.generationEvidence.reviewStatus, "codex-approved");
    assert.equal(entry.generatorProvenance.tool, "image_gen.imagegen");
    assert.equal("endpoint" in entry.generationEvidence, false);
    assert.equal("requestId" in entry.generationEvidence, false);
    assert.equal("attempts" in entry.generationEvidence, false);
  }

  const verified = await verifyPublishedImage2Assets({
    ...fixture,
    schemaVersion: 3,
    contentVersion: "9.9.9",
    reviewStatus: "codex-approved",
    webpQuality: 82,
    nearDuplicateThreshold: 0,
    verifyOriginals: false,
  });
  assert.equal(verified.manifest.stageCount, 2);
  assert.equal(verified.manifest.backgroundCount, 2);
});

test("rejects built-in evidence contaminated with an API endpoint", async (t) => {
  const fixture = await createFixture();
  cleanFixtureAfter(t, fixture.root);
  await convertFixtureEvidenceToBuiltin(fixture);
  const statePath = path.join(fixture.generationStateRoot, "l1-001.png.json");
  const state = JSON.parse(await readFile(statePath, "utf8"));
  state.generator.endpoint = "/v1/images/generations";
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");

  await assert.rejects(
    publishImage2Assets({
      ...fixture,
      schemaVersion: 3,
      contentVersion: "9.9.9",
      reviewStatus: "codex-approved",
      webpQuality: 82,
      nearDuplicateThreshold: 0,
    }),
    /built-in generation state is invalid or mixes API request evidence/i,
  );
});

test("publishing rejects a PNG that lacks matching OpenAI generation state", async (t) => {
  const fixture = await createFixture();
  cleanFixtureAfter(t, fixture.root);
  await rm(path.join(fixture.generationStateRoot, "l1-001.png.json"));

  await assert.rejects(
    publishImage2Assets({
      ...fixture,
      schemaVersion: 3,
      contentVersion: "9.9.9",
      reviewStatus: "pending-codex-review",
    }),
    /generation state|sidecar|missing/i,
  );
});

test("publishing rejects a generation sidecar containing a bare sk credential", async (t) => {
  const fixture = await createFixture();
  cleanFixtureAfter(t, fixture.root);
  const statePath = path.join(
    fixture.generationStateRoot,
    "l1-001.png.json",
  );
  const state = JSON.parse(await readFile(statePath, "utf8"));
  state.debugToken = "sk-proj-fixtureCredential123456789";
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");

  await assert.rejects(
    publishImage2Assets({
      ...fixture,
      schemaVersion: 3,
      contentVersion: "9.9.9",
      reviewStatus: "pending-codex-review",
    }),
    /forbidden credential metadata/i,
  );
  await assert.rejects(stat(fixture.stageOutRoot), /ENOENT/);
});

test("publishing rejects a Unicode-escaped credential after sidecar JSON decoding", async (t) => {
  const fixture = await createFixture();
  cleanFixtureAfter(t, fixture.root);
  const statePath = path.join(
    fixture.generationStateRoot,
    "l1-001.png.json",
  );
  const state = JSON.parse(await readFile(statePath, "utf8"));
  state.debug = "ESCAPED_CREDENTIAL_FIXTURE";
  const escapedSource = `${JSON.stringify(state, null, 2)}\n`.replace(
    "ESCAPED_CREDENTIAL_FIXTURE",
    "\\u0073k-proj-fixtureCredential123456789",
  );
  assert.doesNotMatch(escapedSource, /\bsk-/i);
  assert.match(JSON.parse(escapedSource).debug, /^sk-proj-/);
  await writeFile(statePath, escapedSource, "utf8");

  await assert.rejects(
    publishImage2Assets({
      ...fixture,
      schemaVersion: 3,
      contentVersion: "9.9.9",
      reviewStatus: "pending-codex-review",
    }),
    /forbidden credential metadata/i,
  );
  await assert.rejects(stat(fixture.stageOutRoot), /ENOENT/);
});

test("publisher and generator use the same raw-output lease", async (t) => {
  const fixture = await createFixture();
  cleanFixtureAfter(t, fixture.root);
  const releaseGeneratorLease = await acquireImage2OutputLock(fixture.pngRoot);
  try {
    await assert.rejects(
      publishImage2Assets({
        ...fixture,
        schemaVersion: 3,
        contentVersion: "9.9.9",
      }),
      /image2 output root is locked/i,
    );
  } finally {
    await releaseGeneratorLease();
  }
  await assert.rejects(stat(fixture.stageOutRoot), /ENOENT/);
});

test("publisher can explicitly recover a dead raw-output lock before journal recovery", async (t) => {
  const fixture = await createFixture();
  cleanFixtureAfter(t, fixture.root);
  await writeFile(
    path.join(fixture.pngRoot, ".image2-generate.lock"),
    `${JSON.stringify({
      pid: 2147483647,
      token: "a".repeat(32),
      startedAt: "2026-07-12T00:00:00.000Z",
    })}\n`,
    "utf8",
  );

  const result = await publishImage2Assets({
    ...fixture,
    schemaVersion: 3,
    contentVersion: "9.9.9",
    recoverStaleOutputLock: true,
  });

  assert.equal(result.manifest.stageCount, 2);
  await assert.rejects(
    stat(path.join(fixture.pngRoot, ".image2-generate.lock")),
    /ENOENT/,
  );
});

test("content 1.0.3 cannot publish with a pre-v3 manifest schema", async (t) => {
  const fixture = await createFixture();
  cleanFixtureAfter(t, fixture.root);

  await assert.rejects(
    publishImage2Assets({
      ...fixture,
      schemaVersion: 1,
      contentVersion: "1.0.3",
    }),
    /1\.0\.3.*schema(?:Version)? 3|schema(?:Version)? 3.*1\.0\.3/i,
  );
});

test("published-only check revalidates current background prompt, style, and dHash without raw PNGs", async (t) => {
  const fixture = await createFixture();
  cleanFixtureAfter(t, fixture.root);
  const options = {
    ...fixture,
    schemaVersion: 3,
    contentVersion: "1.0.3",
    reviewStatus: "codex-approved",
    webpQuality: 82,
    nearDuplicateThreshold: 0,
  };
  await publishImage2Assets(options);
  await rm(fixture.pngRoot, { recursive: true, force: true });

  const checked = await verifyPublishedImage2Assets({
    ...options,
    pngRoot: undefined,
    verifyOriginals: false,
  });
  assert.equal(checked.backgroundCount, 2);

  const manifest = JSON.parse(await readFile(fixture.manifestPath, "utf8"));
  const originalDHash = manifest.backgrounds[0].dHash;
  manifest.backgrounds[0].dHash = originalDHash === "0".repeat(16)
    ? "f".repeat(16)
    : "0".repeat(16);
  await writeFile(fixture.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await assert.rejects(
    verifyPublishedImage2Assets({
      ...options,
      pngRoot: undefined,
      verifyOriginals: false,
    }),
    /background desktop.*dHash does not match/i,
  );

  manifest.backgrounds[0].dHash = originalDHash;
  await writeFile(fixture.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  const originalJobs = (await readFile(fixture.backgroundJobsPath, "utf8"))
    .trim()
    .split(/\r?\n/)
    .map(JSON.parse);
  const changedJobs = structuredClone(originalJobs);
  changedJobs[0].prompt += " changed";
  changedJobs[0].promptHash = sha256Text(changedJobs[0].prompt);
  await writeJsonl(fixture.backgroundJobsPath, changedJobs);
  const backgroundPromptManifest = JSON.parse(
    await readFile(fixture.backgroundJobsManifestPath, "utf8"),
  );
  backgroundPromptManifest.jobs[0].promptHash = changedJobs[0].promptHash;
  await writeFile(
    fixture.backgroundJobsManifestPath,
    `${JSON.stringify(backgroundPromptManifest, null, 2)}\n`,
    "utf8",
  );
  await assert.rejects(
    verifyPublishedImage2Assets({
      ...options,
      pngRoot: undefined,
      verifyOriginals: false,
    }),
    /background desktop source\/prompt\/style hash mismatch/i,
  );

  await writeJsonl(fixture.backgroundJobsPath, originalJobs);
  backgroundPromptManifest.jobs[0].promptHash = originalJobs[0].promptHash;
  await writeFile(
    fixture.backgroundJobsManifestPath,
    `${JSON.stringify(backgroundPromptManifest, null, 2)}\n`,
    "utf8",
  );
  await writeFile(fixture.styleBiblePath, "changed image2 raster style contract\n", "utf8");
  await assert.rejects(
    verifyPublishedImage2Assets({
      ...options,
      pngRoot: undefined,
      verifyOriginals: false,
    }),
    /styleBibleHash does not match style-bible\.md/i,
  );
});

test("accepts a clearly labeled legacy v2 stage-content hash bundle", async (t) => {
  const fixture = await createFixture();
  cleanFixtureAfter(t, fixture.root);
  const jobs = (await readFile(fixture.stageJobsPath, "utf8"))
    .trim()
    .split(/\r?\n/)
    .map(JSON.parse);
  for (const job of jobs) {
    job.sourceContentHash = sha256Text(`legacy-content:${job.stageId}`);
    delete job.sourceTextHash;
    delete job.sourceTextHashSchemaVersion;
    job.generatorProvenance.promptSchemaVersion =
      "japanese-subtext-image2-prompt-v2";
    job.generatorProvenance.sourceHashField = "sourceContentHash";
    delete job.generatorProvenance.sourceHashSchemaVersion;
  }
  await writeJsonl(fixture.stageJobsPath, jobs);
  for (const job of jobs) {
    const statePath = path.join(fixture.generationStateRoot, `${job.out}.json`);
    const state = JSON.parse(await readFile(statePath, "utf8"));
    state.sourceTextHash = null;
    state.sourceTextHashSchemaVersion = null;
    state.sourceContentHash = job.sourceContentHash;
    state.promptSchemaVersion = job.generatorProvenance.promptSchemaVersion;
    await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  }

  const result = await publishImage2Assets({
    ...fixture,
    schemaVersion: 2,
    contentVersion: "1.0.2",
    nearDuplicateThreshold: 0,
  });

  assert.equal(
    result.manifest.stages[0].sourceHashKind,
    "legacy-stage-content",
  );
  assert.equal(
    result.manifest.stages[0].sourceContentHash,
    jobs[0].sourceContentHash,
  );
  assert.equal("sourceTextHash" in result.manifest.stages[0], false);
});

test("rejects a former v3 sourceTextHash job under the v4 prompt contract", async (t) => {
  const fixture = await createFixture();
  cleanFixtureAfter(t, fixture.root);
  const jobs = (await readFile(fixture.stageJobsPath, "utf8"))
    .trim()
    .split(/\r?\n/)
    .map(JSON.parse);
  jobs[0].generatorProvenance.promptSchemaVersion =
    "japanese-subtext-image2-prompt-v3";
  await writeJsonl(fixture.stageJobsPath, jobs);

  await assert.rejects(
    publishImage2Assets({
      ...fixture,
      schemaVersion: 3,
      contentVersion: "9.9.9",
    }),
    /sourceTextHash requires prompt schema v4/,
  );
});

test("check mode rejects an orphan stage WebP without deleting it", async (t) => {
  const fixture = await createFixture();
  cleanFixtureAfter(t, fixture.root);
  const options = {
    ...fixture,
    schemaVersion: 3,
    contentVersion: "9.9.9",
    nearDuplicateThreshold: 0,
  };
  await publishImage2Assets(options);
  const orphanPath = path.join(fixture.stageOutRoot, "orphan.webp");
  await writeFile(
    orphanPath,
    await readFile(path.join(fixture.stageOutRoot, "l1-001.webp")),
  );

  await assert.rejects(
    verifyPublishedImage2Assets(options),
    /orphan published stage WebP: orphan\.webp/i,
  );
  assert.equal((await stat(orphanPath)).isFile(), true);
});

test("publishing swaps a complete candidate set instead of retaining stale final files", async (t) => {
  const fixture = await createFixture();
  cleanFixtureAfter(t, fixture.root);
  const options = {
    ...fixture,
    schemaVersion: 3,
    contentVersion: "9.9.9",
    nearDuplicateThreshold: 0,
  };
  await publishImage2Assets(options);
  const orphanPath = path.join(fixture.stageOutRoot, "orphan.webp");
  await writeFile(
    orphanPath,
    await readFile(path.join(fixture.stageOutRoot, "l1-001.webp")),
  );

  await publishImage2Assets(options);

  await assert.rejects(stat(orphanPath), /ENOENT/);
  const checked = await verifyPublishedImage2Assets(options);
  assert.equal(checked.stageCount, 2);
  assert.equal(checked.backgroundCount, 2);
});

test("a failed multi-directory commit restores the complete previous publication", async (t) => {
  const fixture = await createFixture();
  cleanFixtureAfter(t, fixture.root);
  const options = {
    ...fixture,
    schemaVersion: 3,
    contentVersion: "9.9.9",
    nearDuplicateThreshold: 0,
  };
  await publishImage2Assets(options);
  const oldManifest = await readFile(fixture.manifestPath);
  const oldStage = await readFile(path.join(fixture.stageOutRoot, "l1-001.webp"));
  const oldBackground = await readFile(
    path.join(fixture.backgroundOutRoot, "trainer-backdrop-desktop.webp"),
  );

  await sharp({
    create: {
      width: 1536,
      height: 1152,
      channels: 3,
      background: { r: 40, g: 220, b: 80 },
    },
  })
    .png()
    .toFile(path.join(fixture.pngRoot, "l1-001.png"));
  const changedSource = await readFile(path.join(fixture.pngRoot, "l1-001.png"));
  const statePath = path.join(
    fixture.generationStateRoot,
    "l1-001.png.json",
  );
  const state = JSON.parse(await readFile(statePath, "utf8"));
  state.bytes = changedSource.length;
  state.sha256 = sha256Buffer(changedSource);
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");

  let injected = false;
  await assert.rejects(
    publishImage2Assets(options, {
      rename: async (from, to) => {
        if (!injected && path.resolve(to) === path.resolve(fixture.stageOutRoot)) {
          injected = true;
          throw new Error("injected stage directory install failure");
        }
        return rename(from, to);
      },
    }),
    /injected stage directory install failure/,
  );

  assert.deepEqual(await readFile(fixture.manifestPath), oldManifest);
  assert.deepEqual(
    await readFile(path.join(fixture.stageOutRoot, "l1-001.webp")),
    oldStage,
  );
  assert.deepEqual(
    await readFile(
      path.join(fixture.backgroundOutRoot, "trainer-backdrop-desktop.webp"),
    ),
    oldBackground,
  );
  await verifyPublishedImage2Assets({
    ...options,
    pngRoot: undefined,
    verifyOriginals: false,
  });
});

test("a rollback failure retains the transaction containing the only backup", async (t) => {
  const fixture = await createFixture();
  cleanFixtureAfter(t, fixture.root);
  const options = {
    ...fixture,
    schemaVersion: 3,
    contentVersion: "9.9.9",
    nearDuplicateThreshold: 0,
  };
  await publishImage2Assets(options);

  await assert.rejects(
    publishImage2Assets(options, {
      rename: async (from, to) => {
        const sourceName = path.basename(from);
        if (
          path.resolve(to) === path.resolve(fixture.stageOutRoot) &&
          sourceName === "candidate-stage"
        ) {
          throw new Error("injected commit failure");
        }
        if (
          path.resolve(to) === path.resolve(fixture.stageOutRoot) &&
          sourceName === "backup-stage"
        ) {
          throw new Error("injected rollback failure");
        }
        return rename(from, to);
      },
    }),
    /commit failed.*rollback failed/i,
  );

  const transactionParent = path.join(
    fixture.publicRoot,
    ".image2-publish-staging",
  );
  const transactionNames = await readdir(transactionParent);
  assert.equal(transactionNames.length, 1);
  const retainedBackup = path.join(
    transactionParent,
    transactionNames[0],
    "backup-stage",
  );
  assert.equal((await stat(retainedBackup)).isDirectory(), true);
});

test("the next publisher run recovers an interrupted transaction before reading raw inputs", async (t) => {
  const fixture = await createFixture();
  cleanFixtureAfter(t, fixture.root);
  const options = {
    ...fixture,
    schemaVersion: 3,
    contentVersion: "9.9.9",
    nearDuplicateThreshold: 0,
  };
  await publishImage2Assets(options);
  const oldStage = await readFile(path.join(fixture.stageOutRoot, "l1-001.webp"));

  await assert.rejects(
    publishImage2Assets(options, {
      rename: async (from, to) => {
        const sourceName = path.basename(from);
        if (
          path.resolve(to) === path.resolve(fixture.stageOutRoot) &&
          sourceName === "candidate-stage"
        ) {
          throw new Error("injected commit failure");
        }
        if (
          path.resolve(to) === path.resolve(fixture.stageOutRoot) &&
          sourceName === "backup-stage"
        ) {
          throw new Error("injected rollback failure");
        }
        return rename(from, to);
      },
    }),
    /commit failed.*rollback failed/i,
  );

  await rm(path.join(fixture.generationStateRoot, "l1-002.png.json"));
  await assert.rejects(publishImage2Assets(options), /generation state|missing/i);

  assert.deepEqual(
    await readFile(path.join(fixture.stageOutRoot, "l1-001.webp")),
    oldStage,
  );
  assert.deepEqual(
    await readdir(path.join(fixture.publicRoot, ".image2-publish-staging")),
    [],
  );
});

test("rejects undeclared fallback renderer metadata before publishing", async (t) => {
  const fixture = await createFixture();
  cleanFixtureAfter(t, fixture.root);
  const jobs = (await readFile(fixture.stageJobsPath, "utf8"))
    .trim()
    .split(/\r?\n/)
    .map(JSON.parse);
  jobs[0].generatorMetadata = {
    renderer: "local-fallback-svg",
  };
  await writeJsonl(fixture.stageJobsPath, jobs);

  await assert.rejects(
    publishImage2Assets({
      ...fixture,
      schemaVersion: 3,
      contentVersion: "9.9.9",
    }),
    /forbidden local-fallback generator metadata/i,
  );
});

test("rejects SVG renderer metadata even when embedded in a renderer name", async (t) => {
  const fixture = await createFixture();
  cleanFixtureAfter(t, fixture.root);
  const jobs = (await readFile(fixture.stageJobsPath, "utf8"))
    .trim()
    .split(/\r?\n/)
    .map(JSON.parse);
  jobs[0].generatorMetadata = {
    renderer: "vectorSvgRenderer",
  };
  await writeJsonl(fixture.stageJobsPath, jobs);

  await assert.rejects(
    publishImage2Assets({
      ...fixture,
      schemaVersion: 3,
      contentVersion: "9.9.9",
    }),
    /forbidden SVG generator metadata/,
  );
});

test("rejects a job that does not identify OpenAI Images provenance", async (t) => {
  const fixture = await createFixture();
  cleanFixtureAfter(t, fixture.root);
  const jobs = (await readFile(fixture.stageJobsPath, "utf8"))
    .trim()
    .split(/\r?\n/)
    .map(JSON.parse);
  jobs[0].generatorProvenance.provider = "Unknown image provider";
  await writeJsonl(fixture.stageJobsPath, jobs);

  await assert.rejects(
    publishImage2Assets({
      ...fixture,
      schemaVersion: 3,
      contentVersion: "9.9.9",
    }),
    /generatorProvenance\.provider must be OpenAI Images/,
  );
});

test("rejects orphan raw PNG output before writing published assets", async (t) => {
  const fixture = await createFixture();
  cleanFixtureAfter(t, fixture.root);
  await writeFile(
    path.join(fixture.pngRoot, "extra.png"),
    await readFile(path.join(fixture.pngRoot, "l1-001.png")),
  );

  await assert.rejects(
    publishImage2Assets({
      ...fixture,
      schemaVersion: 3,
      contentVersion: "9.9.9",
    }),
    /orphan: extra\.png/i,
  );
  await assert.rejects(stat(fixture.stageOutRoot), /ENOENT/);
});

test("rejects a stage PNG with the wrong source dimensions", async (t) => {
  const fixture = await createFixture();
  cleanFixtureAfter(t, fixture.root);
  await sharp({
    create: {
      width: 1535,
      height: 1152,
      channels: 3,
      background: { r: 40, g: 50, b: 60 },
    },
  })
    .png()
    .toFile(path.join(fixture.pngRoot, "l1-002.png"));

  await assert.rejects(
    publishImage2Assets({
      ...fixture,
      schemaVersion: 3,
      contentVersion: "9.9.9",
    }),
    /stage L1-002 source must be 1536x1152; found 1535x1152/i,
  );
  await assert.rejects(stat(fixture.stageOutRoot), /ENOENT/);
});

test("creates a separately configured manifest parent directory", async (t) => {
  const fixture = await createFixture();
  cleanFixtureAfter(t, fixture.root);
  fixture.manifestPath = path.join(
    fixture.publicRoot,
    "manifests",
    "image2-test.json",
  );

  await publishImage2Assets({
    ...fixture,
    schemaVersion: 3,
    contentVersion: "9.9.9",
    nearDuplicateThreshold: 0,
  });
  const manifest = JSON.parse(await readFile(fixture.manifestPath, "utf8"));
  assert.equal(manifest.stageCount, 2);
});

test("check mode rejects tampered published provenance", async (t) => {
  const fixture = await createFixture();
  cleanFixtureAfter(t, fixture.root);
  const options = {
    ...fixture,
    schemaVersion: 3,
    contentVersion: "9.9.9",
    nearDuplicateThreshold: 0,
  };
  await publishImage2Assets(options);
  const manifest = JSON.parse(await readFile(fixture.manifestPath, "utf8"));
  manifest.stages[0].generatorProvenance.provider = "Unknown image provider";
  await writeFile(fixture.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  await assert.rejects(
    verifyPublishedImage2Assets(options),
    /stage L1-001 generatorProvenance\.provider must be OpenAI Images/,
  );
});

test("check mode rejects a manifest with a tampered sourceTextHash", async (t) => {
  const fixture = await createFixture();
  cleanFixtureAfter(t, fixture.root);
  const options = {
    ...fixture,
    schemaVersion: 3,
    contentVersion: "9.9.9",
    nearDuplicateThreshold: 0,
  };
  await publishImage2Assets(options);
  const manifest = JSON.parse(await readFile(fixture.manifestPath, "utf8"));
  manifest.stages[0].sourceTextHash = "f".repeat(64);
  await writeFile(fixture.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  await assert.rejects(
    verifyPublishedImage2Assets(options),
    /sourceTextHash does not match prompt job/,
  );
});

test("check mode does not allow review status to be silently promoted", async (t) => {
  const fixture = await createFixture();
  cleanFixtureAfter(t, fixture.root);
  const options = {
    ...fixture,
    schemaVersion: 3,
    contentVersion: "9.9.9",
    reviewStatus: "pending-codex-review",
    nearDuplicateThreshold: 0,
  };
  await publishImage2Assets(options);
  const manifest = JSON.parse(await readFile(fixture.manifestPath, "utf8"));
  manifest.reviewStatus = "approved";
  for (const entry of [...manifest.stages, ...manifest.backgrounds]) {
    entry.reviewStatus = "approved";
  }
  await writeFile(fixture.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  await assert.rejects(
    verifyPublishedImage2Assets(options),
    /Manifest reviewStatus mismatch/,
  );
});

test("check mode rejects a stale WebP publication profile", async (t) => {
  const fixture = await createFixture();
  cleanFixtureAfter(t, fixture.root);
  const options = {
    ...fixture,
    schemaVersion: 3,
    contentVersion: "9.9.9",
    webpQuality: 82,
    nearDuplicateThreshold: 0,
  };
  await publishImage2Assets(options);
  const manifest = JSON.parse(await readFile(fixture.manifestPath, "utf8"));
  manifest.webp.quality = 10;
  await writeFile(fixture.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  await assert.rejects(
    verifyPublishedImage2Assets(options),
    /Manifest WebP profile mismatch/,
  );
});
