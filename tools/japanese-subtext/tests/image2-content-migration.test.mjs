import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";

import { contentHash } from "../scripts/content-utils.mjs";
import {
  IMAGE2_STAGE_STYLE,
  migrateImage2Content,
} from "../scripts/migrate-image2-content.mjs";
import {
  SOURCE_TEXT_HASH_SCHEMA_VERSION,
  buildStageImageJob,
  computeStageSourceTextHash,
  extractStyleContract,
} from "../scripts/prepare-image2-prompts.mjs";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const FIXTURE_STYLE_BIBLE = [
  "<!-- IMAGE2_PROMPT_START -->",
  "Use exactly four 2-by-2 panels.",
  "Black, white, and neutral grayscale only.",
  "Use rich ink, shading, and screentone rather than sparse line art.",
  "<!-- IMAGE2_PROMPT_END -->",
].join("\n");
let fixtureRasterBuffersPromise;

function rawPatternForDHash(value) {
  const pixels = Buffer.alloc(9 * 8 * 3);
  for (let row = 0; row < 8; row += 1) {
    let shade = 128;
    for (let column = 0; column < 9; column += 1) {
      const offset = (row * 9 + column) * 3;
      pixels[offset] = shade;
      pixels[offset + 1] = shade;
      pixels[offset + 2] = shade;
      if (column < 8) {
        const bitOffset = BigInt(63 - (row * 8 + column));
        const bit = (value >> bitOffset) & 1n;
        shade += bit === 1n ? -8 : 8;
      }
    }
  }
  return pixels;
}

function fixtureRasterBuffers() {
  fixtureRasterBuffersPromise ??= Promise.all([
    sharp({
      create: {
        width: 960,
        height: 720,
        channels: 3,
        background: { r: 0, g: 0, b: 0 },
      },
    }).webp({ lossless: true }).toBuffer(),
    ...Array.from({ length: 250 }, async (_, index) => {
      const dHash = BigInt(index + 1).toString(16).padStart(16, "0");
      const input = rawPatternForDHash(BigInt(index + 1));
      const buffer = await sharp(input, {
        raw: { width: 9, height: 8, channels: 3 },
      })
        .resize(960, 720, { fit: "fill", kernel: "nearest" })
        .webp({ lossless: true })
        .toBuffer();
      return { buffer, dHash };
    }),
  ]).then(([old, ...published]) => ({ old, published }));
  return fixtureRasterBuffersPromise;
}

function stageId(level, stage) {
  return `L${level}-${String(stage).padStart(3, "0")}`;
}

function makeStage(level, stage, oldIllustrationHash) {
  const id = stageId(level, stage);
  const value = {
    schemaVersion: 1,
    contentVersion: "1.0.2",
    id,
    level,
    stage,
    revision: 4,
    title: {
      ja: `${id} の題名`,
      zh: `${id} 的标题`,
      en: `${id} title`,
    },
    setting: {
      ja: `${id} の場面。`,
      zh: `${id} 的场景。`,
      en: `${id} setting.`,
    },
    genres: ["fixture"],
    skills: ["fixture-inference"],
    cast: [
      {
        id: "speaker-a",
        name: { ja: "話者", zh: "说话者", en: "Speaker" },
        voiceKey: "fixture-voice",
      },
    ],
    lines: [
      {
        id: "line-001",
        speaker: "speaker-a",
        text: {
          ja: `${id} の台詞。`,
          zh: `${id} 的台词。`,
          en: `${id} dialogue.`,
        },
      },
    ],
    questions: [
      {
        id: "q1",
        prompt: {
          ja: `${id} の質問。`,
          zh: `${id} 的问题。`,
          en: `${id} question.`,
        },
      },
    ],
    illustration: {
      enabled: true,
      src: `assets/stages/${id.toLowerCase()}.webp`,
      alt: {
        ja: `${id} の挿絵`,
        zh: `${id} 的插图`,
        en: `${id} illustration`,
      },
      style: "monochrome-four-panel",
      sha256: oldIllustrationHash,
    },
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

async function snapshotContent(contentRoot) {
  const values = [];
  for (let level = 1; level <= 5; level += 1) {
    const levelRoot = path.join(contentRoot, `level-${level}`);
    for (const name of [
      "batch-001-010.json",
      "batch-011-020.json",
      "batch-021-030.json",
      "batch-031-040.json",
      "batch-041-050.json",
      "index.json",
    ]) {
      values.push([`level-${level}/${name}`, await readFile(path.join(levelRoot, name), "utf8")]);
    }
  }
  for (const name of ["catalog.json", "generation-state.json"]) {
    values.push([name, await readFile(path.join(contentRoot, name), "utf8")]);
  }
  return values;
}

async function createFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "jp-subtext-image2-migrate-"));
  const toolRoot = path.join(root, "tools", "japanese-subtext");
  const contentRoot = path.join(toolRoot, "content");
  const assetRoot = path.join(toolRoot, "assets", "stages", "v1.0.3");
  const manifestPath = path.join(assetRoot, "manifest.json");
  await mkdir(assetRoot, { recursive: true });
  const { old: oldWebp, published: publishedWebps } = await fixtureRasterBuffers();
  const oldWebpHash = sha256(oldWebp);
  await mkdir(path.join(toolRoot, "image2"), { recursive: true });
  await writeFile(path.join(toolRoot, "image2", "style-bible.md"), FIXTURE_STYLE_BIBLE, "utf8");
  const fixtureStyleContract = extractStyleContract(FIXTURE_STYLE_BIBLE);
  const fixtureStyleBibleHash = sha256(FIXTURE_STYLE_BIBLE);
  const stages = [];
  const manifestStages = [];
  const promptJobs = [];
  let rasterIndex = 0;

  for (let level = 1; level <= 5; level += 1) {
    for (let start = 1; start <= 50; start += 10) {
      const end = start + 9;
      const batchStages = [];
      for (let stage = start; stage <= end; stage += 1) {
        const value = makeStage(level, stage, oldWebpHash);
        const id = value.id;
        const filename = `${id.toLowerCase()}.webp`;
        const publishedFixture = publishedWebps[rasterIndex];
        rasterIndex += 1;
        const webp = publishedFixture.buffer;
        const webpHash = sha256(webp);
        await writeFile(path.join(assetRoot, filename), webp);
        await writeFile(path.join(toolRoot, "assets", "stages", filename), oldWebp);
        stages.push(value);
        batchStages.push(value);
        const job = buildStageImageJob(
          value,
          fixtureStyleContract,
          fixtureStyleBibleHash,
        );
        promptJobs.push(job);
        manifestStages.push({
          stageId: id,
          model: "gpt-image-2",
          quality: "high",
          sourceHashKind: "stage-source-text",
          sourceTextHash: job.sourceTextHash,
          sourceTextHashSchemaVersion: SOURCE_TEXT_HASH_SCHEMA_VERSION,
          promptHash: job.promptHash,
          styleBibleHash: fixtureStyleBibleHash,
          reviewStatus: "codex-approved",
          dHash: publishedFixture.dHash,
          generatorProvenance: {
            provider: "OpenAI Images",
            model: "gpt-image-2",
            operation: "generate",
            evidenceType: "openai-images-api-v1",
          },
          generationEvidence: {
            evidenceType: "openai-images-api-v1",
          },
          published: {
            path: `assets/stages/v1.0.3/${filename}`,
            width: 960,
            height: 720,
            format: "webp",
            sha256: webpHash,
            bytes: webp.byteLength,
          },
        });
      }
      await writeJson(
        path.join(
          contentRoot,
          `level-${level}`,
          `batch-${String(start).padStart(3, "0")}-${String(end).padStart(3, "0")}.json`,
        ),
        { schemaVersion: 1, contentVersion: "1.0.2", level, stages: batchStages },
      );
    }
  }

  await writeFile(
    path.join(toolRoot, "image2", "prompts.jsonl"),
    `${promptJobs.map((job) => JSON.stringify(job)).join("\n")}\n`,
    "utf8",
  );

  const manifest = {
    schemaVersion: 3,
    kind: "japanese-subtext-image2-assets",
    contentVersion: "1.0.3",
    model: "gpt-image-2",
    quality: "high",
    styleBibleHash: fixtureStyleBibleHash,
    webp: { quality: 82, stageWidth: 960, stageHeight: 720 },
    stageCount: 250,
    backgroundCount: 0,
    reviewStatus: "codex-approved",
    stages: manifestStages,
    backgrounds: [],
  };
  await writeJson(manifestPath, manifest);
  await writeJson(path.join(contentRoot, "catalog.json"), {
    schemaVersion: 1,
    contentVersion: "1.0.2",
    title: { ja: "日本語の裏側", zh: "日语的言外之意", en: "Behind the Japanese" },
    stageCount: 250,
    levels: [],
  });
  await writeJson(path.join(contentRoot, "generation-state.json"), {
    schemaVersion: 1,
    contentVersion: "1.0.2",
    updatedAt: "2026-07-11",
    formalContent: { status: "reviewed-and-locked" },
    audio: { status: "fixture-preserved" },
    illustrations: { status: "legacy" },
    needsReworkStageIds: [],
  });

  return { root, toolRoot, contentRoot, manifestPath, manifest, stages };
}

function cleanupFixture(t, root) {
  t.after(async () => rm(root, { recursive: true, force: true }));
}

test("image2 migration is read-only in check mode and idempotent after the first real replacement", async (t) => {
  const fixture = await createFixture();
  cleanupFixture(t, fixture.root);

  const checked = await migrateImage2Content({
    toolRoot: fixture.toolRoot,
    manifestPath: fixture.manifestPath,
    contentVersion: "1.0.3",
    write: false,
  });
  assert.equal(checked.mode, "check");
  assert.equal(checked.stageCount, 250);
  assert.equal(checked.replacedStageCount, 250);
  assert.equal(checked.wouldWrite, true);
  assert.equal(
    (await readJson(path.join(fixture.contentRoot, "level-1", "batch-001-010.json"))).stages[0].revision,
    4,
  );

  const written = await migrateImage2Content({
    toolRoot: fixture.toolRoot,
    manifestPath: fixture.manifestPath,
    contentVersion: "1.0.3",
    write: true,
  });
  assert.equal(written.mode, "write");
  assert.equal(written.replacedStageCount, 250);
  const firstStage = (
    await readJson(path.join(fixture.contentRoot, "level-1", "batch-001-010.json"))
  ).stages[0];
  assert.equal(firstStage.revision, 5);
  assert.equal(firstStage.contentVersion, "1.0.3");
  assert.equal(firstStage.illustration.style, IMAGE2_STAGE_STYLE);
  assert.equal(firstStage.illustration.src, "assets/stages/v1.0.3/l1-001.webp");
  assert.equal(firstStage.illustration.provenance.model, "gpt-image-2");
  assert.equal(firstStage.illustration.provenance.sourceTextHash, computeStageSourceTextHash(firstStage));
  assert.equal(firstStage.contentHash, contentHash(firstStage));

  for (let level = 1; level <= 5; level += 1) {
    const index = await readJson(path.join(fixture.contentRoot, `level-${level}`, "index.json"));
    assert.equal(index.contentVersion, "1.0.3");
    assert.equal(index.stages.length, 50);
  }
  const catalog = await readJson(path.join(fixture.contentRoot, "catalog.json"));
  assert.equal(catalog.contentVersion, "1.0.3");
  assert.equal(catalog.levels.length, 5);
  const generationState = await readJson(path.join(fixture.contentRoot, "generation-state.json"));
  assert.equal(generationState.contentVersion, "1.0.3");
  assert.equal(generationState.audio.status, "fixture-preserved");
  assert.equal(generationState.illustrations.model, "gpt-image-2");
  assert.equal(generationState.illustrations.styleCounts[IMAGE2_STAGE_STYLE], 250);

  const firstSnapshot = await snapshotContent(fixture.contentRoot);
  const repeated = await migrateImage2Content({
    toolRoot: fixture.toolRoot,
    manifestPath: fixture.manifestPath,
    contentVersion: "1.0.3",
    write: true,
  });
  const secondSnapshot = await snapshotContent(fixture.contentRoot);
  assert.equal(repeated.replacedStageCount, 0);
  assert.equal(repeated.wouldWrite, false);
  assert.deepEqual(secondSnapshot, firstSnapshot);
});

test("image2 migration rejects a tampered published file hash", async (t) => {
  const fixture = await createFixture();
  cleanupFixture(t, fixture.root);
  const target = path.join(fixture.toolRoot, fixture.manifest.stages[0].published.path);
  const tampered = Buffer.from(await readFile(target));
  tampered[Math.floor(tampered.length / 2)] ^= 1;
  await writeFile(target, tampered);

  await assert.rejects(
    migrateImage2Content({
      toolRoot: fixture.toolRoot,
      manifestPath: fixture.manifestPath,
      contentVersion: "1.0.3",
      write: false,
    }),
    /L1-001.*SHA-256.*manifest/i,
  );
});

test("image2 migration rejects a missing published WebP", async (t) => {
  const fixture = await createFixture();
  cleanupFixture(t, fixture.root);
  await unlink(path.join(fixture.toolRoot, fixture.manifest.stages[17].published.path));

  await assert.rejects(
    migrateImage2Content({
      toolRoot: fixture.toolRoot,
      manifestPath: fixture.manifestPath,
      contentVersion: "1.0.3",
      write: false,
    }),
    /L1-018.*missing/i,
  );
});

test("image2 migration rejects stale current illustration bytes before changing revision", async (t) => {
  const fixture = await createFixture();
  cleanupFixture(t, fixture.root);
  const currentPath = path.join(fixture.toolRoot, "assets", "stages", "l1-001.webp");
  const stale = Buffer.from(await readFile(currentPath));
  stale[Math.floor(stale.length / 2)] ^= 1;
  await writeFile(currentPath, stale);

  await assert.rejects(
    migrateImage2Content({
      toolRoot: fixture.toolRoot,
      manifestPath: fixture.manifestPath,
      contentVersion: "1.0.3",
      write: false,
    }),
    /L1-001 current illustration SHA-256 does not match its current file/i,
  );
});

test("image2 migration rejects a sourceTextHash that does not match the stage projection", async (t) => {
  const fixture = await createFixture();
  cleanupFixture(t, fixture.root);
  fixture.manifest.stages[31].sourceTextHash = "f".repeat(64);
  await writeJson(fixture.manifestPath, fixture.manifest);

  await assert.rejects(
    migrateImage2Content({
      toolRoot: fixture.toolRoot,
      manifestPath: fixture.manifestPath,
      contentVersion: "1.0.3",
      write: false,
    }),
    /L1-032.*sourceTextHash.*stage source text/i,
  );
});

test("image2 migration requires exactly 250 codex-approved image2 entries", async (t) => {
  const fixture = await createFixture();
  cleanupFixture(t, fixture.root);
  fixture.manifest.reviewStatus = "pending-codex-review";
  fixture.manifest.stages[0].reviewStatus = "pending-codex-review";
  await writeJson(fixture.manifestPath, fixture.manifest);

  await assert.rejects(
    migrateImage2Content({
      toolRoot: fixture.toolRoot,
      manifestPath: fixture.manifestPath,
      contentVersion: "1.0.3",
      write: false,
    }),
    /reviewStatus.*codex-approved/i,
  );
});

test("image2 migration rejects an incomplete stages publication", async (t) => {
  const fixture = await createFixture();
  cleanupFixture(t, fixture.root);
  fixture.manifest.stages.pop();
  fixture.manifest.stageCount = 249;
  await writeJson(fixture.manifestPath, fixture.manifest);

  await assert.rejects(
    migrateImage2Content({
      toolRoot: fixture.toolRoot,
      manifestPath: fixture.manifestPath,
      contentVersion: "1.0.3",
      write: false,
    }),
    /exactly 250 stages\[\] entries/i,
  );
});

test("image2 migration rejects non-960x720 published metadata", async (t) => {
  const fixture = await createFixture();
  cleanupFixture(t, fixture.root);
  fixture.manifest.stages[72].published.width = 959;
  await writeJson(fixture.manifestPath, fixture.manifest);

  await assert.rejects(
    migrateImage2Content({
      toolRoot: fixture.toolRoot,
      manifestPath: fixture.manifestPath,
      contentVersion: "1.0.3",
      write: false,
    }),
    /L2-023.*960x720/i,
  );
});

test("image2 migration rejects one published image copied across stages", async (t) => {
  const fixture = await createFixture();
  cleanupFixture(t, fixture.root);
  const first = fixture.manifest.stages[0];
  const second = fixture.manifest.stages[1];
  const firstBytes = await readFile(path.join(fixture.toolRoot, first.published.path));
  await writeFile(path.join(fixture.toolRoot, second.published.path), firstBytes);
  second.published.sha256 = first.published.sha256;
  second.published.bytes = first.published.bytes;
  second.dHash = first.dHash;
  await writeJson(fixture.manifestPath, fixture.manifest);

  await assert.rejects(
    migrateImage2Content({
      toolRoot: fixture.toolRoot,
      manifestPath: fixture.manifestPath,
      contentVersion: "1.0.3",
      write: false,
    }),
    /L1-002 reuses a published SHA-256/i,
  );
});

test("image2 migration binds manifest prompt hashes to checked-in prompt jobs", async (t) => {
  const fixture = await createFixture();
  cleanupFixture(t, fixture.root);
  fixture.manifest.stages[5].promptHash = "e".repeat(64);
  await writeJson(fixture.manifestPath, fixture.manifest);

  await assert.rejects(
    migrateImage2Content({
      toolRoot: fixture.toolRoot,
      manifestPath: fixture.manifestPath,
      contentVersion: "1.0.3",
      write: false,
    }),
    /L1-006 promptHash\/styleBibleHash diverges from the checked-in prompt contract/i,
  );
});

test("image2 migration rejects a self-consistent prompt that drops stage dialogue", async (t) => {
  const fixture = await createFixture();
  cleanupFixture(t, fixture.root);
  const promptsPath = path.join(fixture.toolRoot, "image2", "prompts.jsonl");
  const jobs = (await readFile(promptsPath, "utf8"))
    .trim()
    .split(/\r?\n/)
    .map(JSON.parse);
  const omittedDialogue = fixture.stages[0].lines[0].text.ja;
  jobs[0].prompt = jobs[0].prompt.replace(omittedDialogue, "");
  jobs[0].promptHash = sha256(jobs[0].prompt);
  fixture.manifest.stages[0].promptHash = jobs[0].promptHash;
  await writeFile(
    promptsPath,
    `${jobs.map((job) => JSON.stringify(job)).join("\n")}\n`,
    "utf8",
  );
  await writeJson(fixture.manifestPath, fixture.manifest);

  await assert.rejects(
    migrateImage2Content({
      toolRoot: fixture.toolRoot,
      manifestPath: fixture.manifestPath,
      contentVersion: "1.0.3",
      write: false,
    }),
    /image2 job L1-001\.promptHash does not match the deterministic stage prompt/i,
  );
});

test("image2 migration binds style hashes to the checked-in style bible", async (t) => {
  const fixture = await createFixture();
  cleanupFixture(t, fixture.root);
  await writeFile(
    path.join(fixture.toolRoot, "image2", "style-bible.md"),
    `${FIXTURE_STYLE_BIBLE}\ntampered`,
    "utf8",
  );

  await assert.rejects(
    migrateImage2Content({
      toolRoot: fixture.toolRoot,
      manifestPath: fixture.manifestPath,
      contentVersion: "1.0.3",
      write: false,
    }),
    /styleBibleHash does not match the deterministic stage prompt/i,
  );
});

test("image2 migration recomputes dHash from the published WebP", async (t) => {
  const fixture = await createFixture();
  cleanupFixture(t, fixture.root);
  fixture.manifest.stages[90].dHash = "f".repeat(16);
  await writeJson(fixture.manifestPath, fixture.manifest);

  await assert.rejects(
    migrateImage2Content({
      toolRoot: fixture.toolRoot,
      manifestPath: fixture.manifestPath,
      contentVersion: "1.0.3",
      write: false,
    }),
    /L2-041 dHash does not match the published WebP/i,
  );
});
