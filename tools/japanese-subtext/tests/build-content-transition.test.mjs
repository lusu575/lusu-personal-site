import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { buildContent } from "../scripts/build-content.mjs";
import { contentHash } from "../scripts/content-utils.mjs";
import {
  IMAGE2_STAGE_STYLE,
  LEGACY_STAGE_STYLE,
  TRANSITIONAL_AUDIO_FIRST_MODE,
  TRANSITIONAL_AUDIO_FIRST_STATUS,
} from "../scripts/migrate-image2-content.mjs";

const STAGE_COUNT = 250;

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function stageId(level, stage) {
  return `L${level}-${String(stage).padStart(3, "0")}`;
}

function localized(id, label) {
  return {
    ja: `${id} ${label}`,
    zh: `${id} ${label}`,
    en: `${id} ${label}`,
  };
}

function makeStage({ level, stage, contentVersion, illustration }) {
  const id = stageId(level, stage);
  const value = {
    schemaVersion: 1,
    contentVersion,
    id,
    level,
    stage,
    revision: 1,
    title: localized(id, "title"),
    setting: localized(id, "setting"),
    genres: ["fixture"],
    skills: ["fixture-inference"],
    questions: [{ id: "q1", prompt: localized(id, "question") }],
    illustration,
    textLocked: true,
  };
  value.contentHash = contentHash(value);
  return value;
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function readAllStages(contentRoot) {
  const stages = [];
  for (let level = 1; level <= 5; level += 1) {
    const payload = await readJson(
      path.join(contentRoot, `level-${level}`, "batch-001-050.json"),
    );
    stages.push(...payload.stages);
  }
  return stages;
}

async function createFixture(contract) {
  const root = await mkdtemp(path.join(os.tmpdir(), "jp-subtext-build-transition-"));
  const toolRoot = path.join(root, "tools", "japanese-subtext");
  const contentRoot = path.join(toolRoot, "content");
  const legacyAssetRoot = path.join(toolRoot, "assets", "stages");
  const image2AssetRoot = path.join(legacyAssetRoot, "v1.0.3");
  const legacyEntries = [];
  const image2Stages = [];
  const assetWrites = [];
  const initialContentVersion = contract === "legacy" ? "1.0.2" : "1.0.3";
  const manifestPublicPath =
    contract === "legacy"
      ? "assets/stages/manifest.json"
      : "assets/stages/v1.0.3/manifest.json";

  await mkdir(image2AssetRoot, { recursive: true });
  for (let level = 1; level <= 5; level += 1) {
    const batchStages = [];
    for (let stage = 1; stage <= 50; stage += 1) {
      const id = stageId(level, stage);
      const filename = `${id.toLowerCase()}.webp`;
      let illustration;
      if (contract === "legacy") {
        const bytes = Buffer.from(`legacy-stage-fixture:${id}`);
        const assetHash = sha256(bytes);
        const publicPath = `assets/stages/${filename}`;
        assetWrites.push(writeFile(path.join(legacyAssetRoot, filename), bytes));
        legacyEntries.push({
          stageId: id,
          path: publicPath,
          sha256: assetHash,
          width: 960,
          height: 720,
          style: LEGACY_STAGE_STYLE,
          reviewStatus: "automated-scene-mapped",
        });
        illustration = {
          enabled: true,
          src: publicPath,
          alt: localized(id, "illustration"),
          style: LEGACY_STAGE_STYLE,
          sha256: assetHash,
        };
      } else {
        const sequence = (image2Stages.length + 1).toString(16);
        const bytes = Buffer.from(`image2-stage-fixture:${id}`);
        const assetHash = sha256(bytes);
        const dHash = sequence.padStart(16, "0");
        const sourceTextHash = sha256(`source-text:${id}`);
        const publicPath = `assets/stages/v1.0.3/${filename}`;
        assetWrites.push(writeFile(path.join(image2AssetRoot, filename), bytes));
        image2Stages.push({
          stageId: id,
          model: "gpt-image-2",
          quality: "high",
          sourceTextHash,
          sourceTextHashSchemaVersion: 1,
          reviewStatus: "codex-approved",
          dHash,
          published: {
            path: publicPath,
            width: 960,
            height: 720,
            format: "webp",
            sha256: assetHash,
            bytes: bytes.byteLength,
          },
        });
        illustration = {
          enabled: true,
          src: publicPath,
          alt: localized(id, "illustration"),
          style: IMAGE2_STAGE_STYLE,
          sha256: assetHash,
          provenance: {
            model: "gpt-image-2",
            quality: "high",
            sourceTextHash,
          },
        };
      }
      batchStages.push(
        makeStage({
          level,
          stage,
          contentVersion: initialContentVersion,
          illustration,
        }),
      );
    }
    await writeJson(
      path.join(contentRoot, `level-${level}`, "batch-001-050.json"),
      {
        schemaVersion: 1,
        contentVersion: initialContentVersion,
        level,
        stages: batchStages,
      },
    );
  }
  await Promise.all(assetWrites);

  const manifest =
    contract === "legacy"
      ? {
          schemaVersion: 1,
          contentVersion: "1.0.2",
          generatorVersion: "legacy-fixture-v1",
          entries: legacyEntries,
        }
      : {
          schemaVersion: 3,
          kind: "japanese-subtext-image2-assets",
          contentVersion: "1.0.3",
          model: "gpt-image-2",
          quality: "high",
          stageCount: STAGE_COUNT,
          reviewStatus: "codex-approved",
          stages: image2Stages,
        };
  const manifestPath = path.join(toolRoot, ...manifestPublicPath.split("/"));
  await writeJson(manifestPath, manifest);
  await writeJson(path.join(contentRoot, "catalog.json"), {
    schemaVersion: 1,
    contentVersion: initialContentVersion,
    title: localized("fixture", "catalog"),
    stageCount: STAGE_COUNT,
    levels: [],
  });
  await writeJson(path.join(contentRoot, "generation-state.json"), {
    schemaVersion: 1,
    contentVersion: initialContentVersion,
    audio: { status: "fixture-preserved" },
    illustrations: {
      status: contract === "legacy" ? "complete" : "approved-published",
      stageAssetCount: STAGE_COUNT,
      manifest: manifestPublicPath,
    },
  });

  return { root, toolRoot, contentRoot, manifestPath };
}

function cleanupFixture(t, root) {
  t.after(async () => rm(root, { recursive: true, force: true }));
}

test("buildContent rejects 1.0.3 legacy by default and accepts only the explicit transition", async (t) => {
  const fixture = await createFixture("legacy");
  cleanupFixture(t, fixture.root);
  const catalogPath = path.join(fixture.contentRoot, "catalog.json");
  const firstBatchPath = path.join(
    fixture.contentRoot,
    "level-1",
    "batch-001-050.json",
  );
  const catalogBefore = await readFile(catalogPath, "utf8");
  const firstBatchBefore = await readFile(firstBatchPath, "utf8");

  await assert.rejects(
    buildContent({
      toolRoot: fixture.toolRoot,
      contentVersion: "1.0.3",
    }),
    /requires image2-v3 illustrations.*allow-legacy-illustrations/i,
  );
  assert.equal(await readFile(catalogPath, "utf8"), catalogBefore);
  assert.equal(await readFile(firstBatchPath, "utf8"), firstBatchBefore);

  const built = await buildContent({
    toolRoot: fixture.toolRoot,
    contentVersion: "1.0.3",
    allowLegacyIllustrations: true,
  });
  assert.deepEqual(built, {
    contentVersion: "1.0.3",
    stageCount: STAGE_COUNT,
    batchCount: 5,
    illustrationMode: TRANSITIONAL_AUDIO_FIRST_MODE,
    transitional: true,
  });

  const catalog = await readJson(catalogPath);
  const generationState = await readJson(
    path.join(fixture.contentRoot, "generation-state.json"),
  );
  const manifestBytes = await readFile(fixture.manifestPath);
  const stages = await readAllStages(fixture.contentRoot);
  assert.equal(catalog.contentVersion, "1.0.3");
  assert.equal(generationState.contentVersion, "1.0.3");
  assert.equal(
    generationState.illustrations.status,
    TRANSITIONAL_AUDIO_FIRST_STATUS,
  );
  assert.equal(
    generationState.illustrations.transition.mode,
    TRANSITIONAL_AUDIO_FIRST_MODE,
  );
  assert.equal(generationState.illustrations.assetContentVersion, "1.0.2");
  assert.equal(generationState.illustrations.targetContentVersion, "1.0.3");
  assert.equal(generationState.illustrations.manifestSha256, sha256(manifestBytes));
  assert.equal(generationState.audio.status, "fixture-preserved");
  assert.equal(stages.length, STAGE_COUNT);
  assert.ok(
    stages.every(
      (stage) =>
        stage.contentVersion === "1.0.3" &&
        stage.illustration.style === LEGACY_STAGE_STYLE &&
        stage.contentHash === contentHash(stage),
    ),
  );
});

test("buildContent keeps the formal 1.0.3 image2 path accepted without the transition flag", async (t) => {
  const fixture = await createFixture("image2");
  cleanupFixture(t, fixture.root);

  const built = await buildContent({
    toolRoot: fixture.toolRoot,
    contentVersion: "1.0.3",
  });
  assert.equal(built.illustrationMode, "image2");
  assert.equal(built.transitional, false);
  assert.equal(built.stageCount, STAGE_COUNT);

  const catalog = await readJson(path.join(fixture.contentRoot, "catalog.json"));
  const generationState = await readJson(
    path.join(fixture.contentRoot, "generation-state.json"),
  );
  const stages = await readAllStages(fixture.contentRoot);
  assert.equal(catalog.contentVersion, "1.0.3");
  assert.equal(generationState.contentVersion, "1.0.3");
  assert.equal(generationState.illustrations.transition, undefined);
  assert.equal(stages.length, STAGE_COUNT);
  assert.ok(
    stages.every(
      (stage) =>
        stage.contentVersion === "1.0.3" &&
        stage.illustration.style === IMAGE2_STAGE_STYLE &&
        stage.illustration.provenance.model === "gpt-image-2" &&
        stage.contentHash === contentHash(stage),
    ),
  );
});
