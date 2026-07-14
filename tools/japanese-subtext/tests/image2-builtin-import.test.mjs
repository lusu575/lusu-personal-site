import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import { importBuiltinImage2Asset } from "../scripts/import-builtin-image2-asset.mjs";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const toolRunId = "exec-bc1a58ae-79f2-46c4-9761-f3fcbf5667b8";

function stageJob() {
  const designIdentity = "stage:l1-001:cast:test";
  const designSeed = createHash("sha256")
    .update("japanese-subtext-cast-design-v2\0stage:l1-001:cast:test", "utf8")
    .digest("hex")
    .slice(0, 16);
  const prompt = `Create the unique four-panel manga page for L1-001. Design identity ${designIdentity}; seed ${designSeed}.`;
  return {
    prompt,
    model: "gpt-image-2",
    size: "1536x1152",
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
  };
}

function desktopBackgroundJob() {
  const prompt = "Create the restrained desktop background for the trainer.";
  return {
    prompt,
    model: "gpt-image-2",
    size: "2048x1152",
    quality: "high",
    output_format: "png",
    n: 1,
    out: "japanese-subtext-background-desktop.png",
    backgroundId: "desktop",
    promptHash: sha256(prompt),
    styleBibleHash: "a".repeat(64),
    generatorProvenance: {
      schemaVersion: 1,
      requestedGenerator: "image2",
      provider: "OpenAI Images",
      model: "gpt-image-2",
      operation: "generate",
      promptSchemaVersion: "japanese-subtext-image2-background-prompt-v1",
    },
  };
}

async function fixture(
  t,
  { width = 1448, height = 1086, sourceRelative = "l1-001.png" } = {},
) {
  const root = await mkdtemp(path.join(os.tmpdir(), "jp-image2-builtin-import-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const generatedRoot = path.join(root, "generated");
  const outputRoot = path.join(root, "raw");
  const sourcePath = path.join(generatedRoot, sourceRelative);
  await mkdir(path.dirname(sourcePath), { recursive: true });
  await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 32, g: 48, b: 64 },
    },
  })
    .png()
    .toFile(sourcePath);
  const source = await readFile(sourcePath);
  const generatedAt = (await stat(sourcePath)).mtime.toISOString();
  const reviewEvidence = {
    schemaVersion: 1,
    status: "codex-approved",
    jobId: "L1-001",
    toolRunId,
    sourceArtifactSha256: sha256(source),
    reviewedAt: generatedAt,
    reviewer: "codex-visual-review",
    checks: {
      promptRelevant: true,
      compositionMatchesTask: true,
      noAnswerLeak: true,
      noReadableText: true,
      noWatermark: true,
      aspectRatioApproved: true,
    },
  };
  return {
    root,
    generatedRoot,
    outputRoot,
    sourcePath,
    generatedAt,
    reviewEvidence,
  };
}

test("imports a reviewed built-in image_gen PNG without fabricating API request evidence", async (t) => {
  const value = await fixture(t);
  const result = await importBuiltinImage2Asset({
    selector: "L1-001",
    inputPath: value.sourcePath,
    outputRoot: value.outputRoot,
    generatedRoot: value.generatedRoot,
    generatedAt: value.generatedAt,
    toolRunId,
    reviewEvidence: value.reviewEvidence,
    jobs: [stageJob()],
  });

  assert.equal(result.status, "imported");
  const outputPath = path.join(value.outputRoot, "l1-001.png");
  const metadata = await sharp(outputPath).metadata();
  assert.deepEqual([metadata.width, metadata.height], [1536, 1152]);
  const state = JSON.parse(
    await readFile(
      path.join(value.outputRoot, ".image2-state", "l1-001.png.json"),
      "utf8",
    ),
  );
  assert.equal(state.evidenceType, "codex-builtin-imagegen-v1");
  assert.equal(state.generator.tool, "image_gen.imagegen");
  assert.equal(state.generator.toolRunId, toolRunId);
  assert.equal(state.sourceArtifact.filename, "l1-001.png");
  assert.equal(state.sourceArtifact.width, 1448);
  assert.equal(state.sourceArtifact.height, 1086);
  assert.equal(state.reviewEvidence.status, "codex-approved");
  assert.match(state.reviewEvidenceSha256, /^[a-f0-9]{64}$/);
  assert.equal(Object.hasOwn(state.generator, "endpoint"), false);
  assert.equal(Object.hasOwn(state.generator, "requestId"), false);

  const reused = await importBuiltinImage2Asset({
    selector: "L1-001",
    inputPath: value.sourcePath,
    outputRoot: value.outputRoot,
    generatedRoot: value.generatedRoot,
    generatedAt: value.generatedAt,
    toolRunId,
    reviewEvidence: value.reviewEvidence,
    jobs: [stageJob()],
  });
  assert.equal(reused.status, "reused");
});

test("rejects a wrong aspect ratio and review evidence that does not bind the source", async (t) => {
  const wrongAspect = await fixture(t, { width: 1672, height: 941 });
  await assert.rejects(
    importBuiltinImage2Asset({
      selector: "L1-001",
      inputPath: wrongAspect.sourcePath,
      outputRoot: wrongAspect.outputRoot,
      generatedRoot: wrongAspect.generatedRoot,
      generatedAt: wrongAspect.generatedAt,
      toolRunId,
      reviewEvidence: wrongAspect.reviewEvidence,
      jobs: [stageJob()],
    }),
    /aspect ratio/i,
  );

  const value = await fixture(t);
  const badReview = {
    ...value.reviewEvidence,
    sourceArtifactSha256: "f".repeat(64),
  };
  await assert.rejects(
    importBuiltinImage2Asset({
      selector: "L1-001",
      inputPath: value.sourcePath,
      outputRoot: value.outputRoot,
      generatedRoot: value.generatedRoot,
      generatedAt: value.generatedAt,
      toolRunId,
      reviewEvidence: badReview,
      jobs: [stageJob()],
    }),
    /reviewEvidence.*bind/i,
  );
});

test("rejects a misleading human-approved status for a Codex visual review", async (t) => {
  const value = await fixture(t);
  await assert.rejects(
    importBuiltinImage2Asset({
      selector: "L1-001",
      inputPath: value.sourcePath,
      outputRoot: value.outputRoot,
      generatedRoot: value.generatedRoot,
      generatedAt: value.generatedAt,
      toolRunId,
      reviewEvidence: { ...value.reviewEvidence, status: "human-approved" },
      jobs: [stageJob()],
    }),
    /reviewEvidence.*bind|codex-approved/i,
  );
});

test("rejects an arbitrary PNG outside the configured generated source root", async (t) => {
  const value = await fixture(t);
  const otherRoot = path.join(value.root, "other-generated-root");
  await mkdir(otherRoot);
  await assert.rejects(
    importBuiltinImage2Asset({
      selector: "L1-001",
      inputPath: value.sourcePath,
      outputRoot: value.outputRoot,
      generatedRoot: otherRoot,
      generatedAt: value.generatedAt,
      toolRunId,
      reviewEvidence: value.reviewEvidence,
      jobs: [stageJob()],
    }),
    /must stay under/i,
  );
});

test("accepts the built-in toolRunId PNG in a nested per-stage source directory", async (t) => {
  const value = await fixture(t, {
    sourceRelative: path.join("L1-001", `${toolRunId}.png`),
  });
  const result = await importBuiltinImage2Asset({
    selector: "L1-001",
    inputPath: value.sourcePath,
    outputRoot: value.outputRoot,
    generatedRoot: value.generatedRoot,
    generatedAt: value.generatedAt,
    toolRunId,
    reviewEvidence: value.reviewEvidence,
    jobs: [stageJob()],
  });

  assert.equal(result.status, "imported");
  assert.equal(result.state.sourceArtifact.filename, `${toolRunId}.png`);
});

test("allows the built-in near-16:9 desktop background without cropping while stages stay strict", async (t) => {
  const value = await fixture(t, {
    width: 1672,
    height: 941,
    sourceRelative: path.join("background-desktop", `${toolRunId}.png`),
  });
  value.reviewEvidence.jobId = "background:desktop";
  const result = await importBuiltinImage2Asset({
    selector: "background:desktop",
    inputPath: value.sourcePath,
    outputRoot: value.outputRoot,
    generatedRoot: value.generatedRoot,
    generatedAt: value.generatedAt,
    toolRunId,
    reviewEvidence: value.reviewEvidence,
    jobs: [desktopBackgroundJob()],
  });
  const metadata = await sharp(
    path.join(value.outputRoot, "japanese-subtext-background-desktop.png"),
  ).metadata();
  assert.deepEqual([metadata.width, metadata.height], [2048, 1152]);
  assert.equal(result.state.normalization.maximumAspectRelativeError, 0.002);
  assert.ok(result.state.normalization.observedAspectRelativeError > 0);
  assert.ok(result.state.normalization.observedAspectRelativeError < 0.002);

  const nearlyFourThree = await fixture(t, { width: 1448, height: 1085 });
  await assert.rejects(
    importBuiltinImage2Asset({
      selector: "L1-001",
      inputPath: nearlyFourThree.sourcePath,
      outputRoot: nearlyFourThree.outputRoot,
      generatedRoot: nearlyFourThree.generatedRoot,
      generatedAt: nearlyFourThree.generatedAt,
      toolRunId,
      reviewEvidence: nearlyFourThree.reviewEvidence,
      jobs: [stageJob()],
    }),
    /aspect ratio/i,
  );
});

test("package exposes the explicit built-in image2 import command", async () => {
  const packageJson = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8"));
  assert.equal(
    packageJson.scripts["jp-subtext:image2:import-builtin"],
    "node tools/japanese-subtext/scripts/import-builtin-image2-asset.mjs",
  );
});

test("checked-in Codex visual reviews use truthful status and retain six bound checks", async () => {
  const reviewsRoot = path.join(repoRoot, "tools", "japanese-subtext", "image2", "reviews");
  const files = (await readdir(reviewsRoot)).filter((name) => name.endsWith(".json")).sort();
  assert.ok(files.length > 0);
  const expectedChecks = [
    "aspectRatioApproved",
    "compositionMatchesTask",
    "noAnswerLeak",
    "noReadableText",
    "noWatermark",
    "promptRelevant",
  ];
  for (const name of files) {
    const review = JSON.parse(await readFile(path.join(reviewsRoot, name), "utf8"));
    assert.equal(review.status, "codex-approved", `${name} must not claim human approval`);
    assert.equal(typeof review.reviewer, "string", `${name} reviewer must be preserved`);
    assert.notEqual(review.reviewer.trim(), "", `${name} reviewer must be preserved`);
    assert.deepEqual(Object.keys(review.checks ?? {}).sort(), expectedChecks, `${name} checks`);
    assert.ok(expectedChecks.every((check) => review.checks[check] === true), `${name} checks`);
  }
});
