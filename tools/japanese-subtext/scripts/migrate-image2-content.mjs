import { createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import sharp from "sharp";

import {
  contentHash,
  jsonText,
  stageSort,
} from "./content-utils.mjs";
import {
  SOURCE_TEXT_HASH_SCHEMA_VERSION,
  buildStageImageJob,
  computeStageSourceTextHash,
  extractStyleContract,
} from "./prepare-image2-prompts.mjs";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const DEFAULT_TOOL_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "..");
const EXPECTED_STAGE_COUNT = 250;
const EXPECTED_STAGE_WIDTH = 960;
const EXPECTED_STAGE_HEIGHT = 720;
const EXPECTED_MODEL = "gpt-image-2";
const EXPECTED_QUALITY = "high";
const EXPECTED_MANIFEST_KIND = "japanese-subtext-image2-assets";
const EXPECTED_SOURCE_HASH_KIND = "stage-source-text";
const API_EVIDENCE_TYPE = "openai-images-api-v1";
const BUILTIN_EVIDENCE_TYPE = "codex-builtin-imagegen-v1";
const BUILTIN_TOOL = "image_gen.imagegen";
const EXPECTED_BATCH_NAMES = Object.freeze([
  "batch-001-010.json",
  "batch-011-020.json",
  "batch-021-030.json",
  "batch-031-040.json",
  "batch-041-050.json",
]);

export const IMAGE2_STAGE_STYLE = "image2-monochrome-four-panel-v1";
export const IMAGE2_GENERATOR_VERSION = "gpt-image-2-high-v1";
export const LEGACY_STAGE_STYLE = "monochrome-four-panel";
export const APPROVED_IMAGE2_REVIEW_STATUSES = Object.freeze([
  "codex-approved",
]);

export function normalizeIllustrationManifestEntries(manifest) {
  if (Array.isArray(manifest?.stages)) {
    return {
      kind: "image2-v3",
      style: IMAGE2_STAGE_STYLE,
      entries: manifest.stages.map((entry) => ({
        stageId: entry.stageId,
        path: entry.published?.path,
        sha256: entry.published?.sha256,
        width: entry.published?.width,
        height: entry.published?.height,
        format: entry.published?.format,
        style: IMAGE2_STAGE_STYLE,
        reviewStatus: entry.reviewStatus,
        dHash: entry.dHash,
        sourceTextHash: entry.sourceTextHash,
        sourceTextHashSchemaVersion: entry.sourceTextHashSchemaVersion,
        raw: entry,
      })),
    };
  }
  if (Array.isArray(manifest?.entries)) {
    return {
      kind: "legacy-v1",
      style: LEGACY_STAGE_STYLE,
      entries: manifest.entries.map((entry) => ({ ...entry, raw: entry })),
    };
  }
  fail("Illustration manifest must contain stages[] or legacy entries[]");
}

function fail(message) {
  throw new Error(message);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function isSha256(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function isDHash(value) {
  return typeof value === "string" && /^[a-f0-9]{16}$/.test(value);
}

function isApprovedReviewStatus(value) {
  return APPROVED_IMAGE2_REVIEW_STATUSES.includes(value);
}

function canonicalStageIds() {
  return Array.from({ length: 5 }, (_, levelIndex) =>
    Array.from(
      { length: 50 },
      (_, stageIndex) =>
        `L${levelIndex + 1}-${String(stageIndex + 1).padStart(3, "0")}`,
    ),
  ).flat();
}

function requiredString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    fail(`${label} is required`);
  }
  return value.trim();
}

function resolveInside(root, relativePath, label) {
  const normalized = requiredString(relativePath, label).replaceAll("\\", "/");
  if (
    path.posix.isAbsolute(normalized) ||
    normalized.split("/").some((part) => part === "" || part === "..")
  ) {
    fail(`${label} must be a safe relative path`);
  }
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, ...normalized.split("/"));
  if (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}${path.sep}`)) {
    fail(`${label} resolves outside ${resolvedRoot}`);
  }
  return resolved;
}

function relativeInside(root, absolutePath, label) {
  const relative = path.relative(path.resolve(root), path.resolve(absolutePath));
  if (!relative || relative === "." || relative.startsWith("..") || path.isAbsolute(relative)) {
    fail(`${label} must be inside ${path.resolve(root)}`);
  }
  return relative.replaceAll("\\", "/");
}

async function readJson(filePath, label) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    fail(`Cannot read ${label} at ${filePath}: ${error.message}`);
  }
}

async function readJsonl(filePath, label) {
  let source;
  try {
    source = await readFile(filePath, "utf8");
  } catch (error) {
    fail(`Cannot read ${label} at ${filePath}: ${error.message}`);
  }
  return source
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "")
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        fail(`${label} line ${index + 1} is invalid JSON: ${error.message}`);
      }
    });
}

function normalizeOptions(options) {
  const toolRoot = path.resolve(options.toolRoot ?? DEFAULT_TOOL_ROOT);
  const manifestPath = path.resolve(requiredString(options.manifestPath, "manifestPath"));
  const contentVersion = requiredString(options.contentVersion, "contentVersion");
  if (!/^\d+\.\d+\.\d+$/.test(contentVersion)) {
    fail("contentVersion must be an x.y.z semantic version");
  }
  if (contentVersion !== "1.0.3") {
    fail("This migration contract only publishes contentVersion 1.0.3");
  }
  const manifestPublicPath = relativeInside(toolRoot, manifestPath, "manifestPath");
  const expectedManifestPath = `assets/stages/v${contentVersion}/manifest.json`;
  if (manifestPublicPath !== expectedManifestPath) {
    fail(`manifestPath must be ${expectedManifestPath}`);
  }
  return {
    toolRoot,
    contentRoot: path.join(toolRoot, "content"),
    manifestPath,
    contentVersion,
    write: options.write === true,
  };
}

async function assertCurrentIllustration(stage, config) {
  const label = `${stage.id} current illustration`;
  const source = requiredString(stage.illustration?.src, `${label}.src`).replaceAll("\\", "/");
  if (
    !/^assets\/stages\/[a-z0-9._/-]+\.webp$/.test(source) ||
    path.posix.basename(source) !== `${stage.id.toLowerCase()}.webp`
  ) {
    fail(`${label}.src must be a safe stage-specific WebP path`);
  }
  if (!isSha256(stage.illustration?.sha256)) {
    fail(`${label}.sha256 is invalid`);
  }
  const absolute = resolveInside(config.toolRoot, source, `${label}.src`);
  let buffer;
  try {
    buffer = await readFile(absolute);
  } catch (error) {
    fail(`${label} file is missing: ${error.message}`);
  }
  if (sha256(buffer) !== stage.illustration.sha256) {
    fail(`${label} SHA-256 does not match its current file`);
  }
}

async function loadStageBatches(contentRoot) {
  const batches = [];
  for (let level = 1; level <= 5; level += 1) {
    const levelRoot = path.join(contentRoot, `level-${level}`);
    let names;
    try {
      names = (await readdir(levelRoot))
        .filter((name) => /^batch-\d{3}-\d{3}\.json$/.test(name))
        .sort();
    } catch (error) {
      fail(`Cannot read level-${level} batches: ${error.message}`);
    }
    if (JSON.stringify(names) !== JSON.stringify(EXPECTED_BATCH_NAMES)) {
      fail(
        `level-${level} must contain the five canonical ten-stage batches; found ${names.join(", ") || "none"}`,
      );
    }
    for (const name of names) {
      const file = path.join(levelRoot, name);
      const payload = await readJson(file, `level-${level}/${name}`);
      if (!Array.isArray(payload?.stages) || payload.stages.length !== 10) {
        fail(`level-${level}/${name} must contain exactly 10 stages`);
      }
      const [, startText, endText] = name.match(/^batch-(\d{3})-(\d{3})\.json$/) || [];
      const start = Number(startText);
      const end = Number(endText);
      if (
        payload.level !== level ||
        end - start !== 9 ||
        payload.stages.some(
          (stage, index) =>
            stage?.level !== level ||
            stage?.stage !== start + index ||
            stage?.id !== `L${level}-${String(start + index).padStart(3, "0")}`,
        )
      ) {
        fail(`level-${level}/${name} stage IDs must match its canonical batch range`);
      }
      batches.push({ level, name, file, payload, stages: payload.stages });
    }
  }
  const stages = batches.flatMap((batch) => batch.stages);
  const expectedIds = canonicalStageIds();
  if (stages.length !== EXPECTED_STAGE_COUNT) {
    fail(`Content must contain exactly ${EXPECTED_STAGE_COUNT} stages; found ${stages.length}`);
  }
  const sorted = [...stages].sort(stageSort);
  sorted.forEach((stage, index) => {
    if (stage?.id !== expectedIds[index]) {
      fail(`Content stage ${index + 1} must be ${expectedIds[index]}; found ${stage?.id ?? "missing"}`);
    }
    if (stage.level !== Math.floor(index / 50) + 1 || stage.stage !== (index % 50) + 1) {
      fail(`${stage.id} level/stage numbering is invalid`);
    }
    if (!Number.isInteger(stage.revision) || stage.revision < 1) {
      fail(`${stage.id} revision must be a positive integer`);
    }
    if (stage.textLocked !== true) {
      fail(`${stage.id} must remain textLocked before image migration`);
    }
    if (stage.contentHash !== contentHash(stage)) {
      fail(`${stage.id} current contentHash is stale; rebuild or review it before image migration`);
    }
  });
  return { batches, stages: sorted };
}

async function loadPromptContract(config, stages) {
  const styleBiblePath = path.join(config.toolRoot, "image2", "style-bible.md");
  const promptsPath = path.join(config.toolRoot, "image2", "prompts.jsonl");
  let styleBible;
  try {
    styleBible = await readFile(styleBiblePath);
  } catch (error) {
    fail(`Cannot read image2 style-bible.md: ${error.message}`);
  }
  const styleBibleHash = sha256(styleBible);
  const styleContract = extractStyleContract(styleBible.toString("utf8"));
  const jobs = await readJsonl(promptsPath, "image2 prompts.jsonl");
  if (jobs.length !== EXPECTED_STAGE_COUNT) {
    fail(`image2 prompts.jsonl must contain exactly ${EXPECTED_STAGE_COUNT} jobs; found ${jobs.length}`);
  }
  jobs.forEach((job, index) => {
    const stage = stages[index];
    const label = `image2 job ${stage.id}`;
    const expected = buildStageImageJob(stage, styleContract, styleBibleHash);
    for (const field of [
      "stageId",
      "out",
      "model",
      "size",
      "quality",
      "output_format",
      "n",
      "sourceTextHash",
      "sourceTextHashSchemaVersion",
      "promptHash",
      "styleBibleHash",
    ]) {
      if (job[field] !== expected[field]) {
        fail(`${label}.${field} does not match the deterministic stage prompt`);
      }
    }
    if (job.prompt !== expected.prompt) {
      fail(`${label}.prompt does not match the deterministic stage prompt`);
    }
    if (
      JSON.stringify(job.castDesigns) !== JSON.stringify(expected.castDesigns) ||
      JSON.stringify(job.generatorProvenance) !== JSON.stringify(expected.generatorProvenance)
    ) {
      fail(`${label} cast/generator provenance does not match the deterministic stage prompt`);
    }
  });
  return { jobs, styleBibleHash };
}

async function differenceHash(buffer) {
  const { data } = await sharp(buffer)
    .greyscale()
    .resize(9, 8, { fit: "fill", kernel: "nearest" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  let value = 0n;
  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      const offset = row * 9 + column;
      value = (value << 1n) | BigInt(data[offset] > data[offset + 1] ? 1 : 0);
    }
  }
  return value.toString(16).padStart(16, "0");
}

function assertManifestHeader(manifest, config) {
  if (manifest.schemaVersion !== 3 || manifest.kind !== EXPECTED_MANIFEST_KIND) {
    fail(`Image2 manifest must use schemaVersion 3 and kind ${EXPECTED_MANIFEST_KIND}`);
  }
  if (manifest.contentVersion !== config.contentVersion) {
    fail(
      `Image2 manifest contentVersion ${manifest.contentVersion ?? "missing"} does not match ${config.contentVersion}`,
    );
  }
  if (manifest.model !== EXPECTED_MODEL || manifest.quality !== EXPECTED_QUALITY) {
    fail(`Image2 manifest must use ${EXPECTED_MODEL} with ${EXPECTED_QUALITY} quality`);
  }
  if (!isSha256(manifest.styleBibleHash)) {
    fail("Image2 manifest styleBibleHash is invalid");
  }
  if (
    manifest.webp?.stageWidth !== EXPECTED_STAGE_WIDTH ||
    manifest.webp?.stageHeight !== EXPECTED_STAGE_HEIGHT
  ) {
    fail(`Image2 manifest WebP profile must be ${EXPECTED_STAGE_WIDTH}x${EXPECTED_STAGE_HEIGHT}`);
  }
  if (!isApprovedReviewStatus(manifest.reviewStatus)) {
    fail(
      `Image2 manifest reviewStatus must be codex-approved; found ${manifest.reviewStatus ?? "missing"}`,
    );
  }
  if (
    manifest.stageCount !== EXPECTED_STAGE_COUNT ||
    !Array.isArray(manifest.stages) ||
    manifest.stages.length !== EXPECTED_STAGE_COUNT
  ) {
    fail(`Image2 manifest must contain exactly ${EXPECTED_STAGE_COUNT} stages[] entries`);
  }
}

async function assertPublishedStage(entry, job, stage, config, manifest, seenPaths, seenHashes, seenDHashes) {
  const label = entry?.stageId ?? stage.id;
  if (entry?.stageId !== stage.id) {
    fail(`Image2 manifest stage order mismatch: expected ${stage.id}; found ${entry?.stageId ?? "missing"}`);
  }
  if (entry.model !== EXPECTED_MODEL || entry.quality !== EXPECTED_QUALITY) {
    fail(`${label} must use ${EXPECTED_MODEL} with ${EXPECTED_QUALITY} quality`);
  }
  if (
    entry.sourceHashKind !== EXPECTED_SOURCE_HASH_KIND ||
    entry.sourceTextHashSchemaVersion !== SOURCE_TEXT_HASH_SCHEMA_VERSION
  ) {
    fail(
      `${label} must use ${EXPECTED_SOURCE_HASH_KIND} ${SOURCE_TEXT_HASH_SCHEMA_VERSION}`,
    );
  }
  if (!isSha256(entry.sourceTextHash)) {
    fail(`${label} sourceTextHash is invalid`);
  }
  const expectedSourceTextHash = computeStageSourceTextHash(stage);
  if (entry.sourceTextHash !== expectedSourceTextHash) {
    fail(`${label} sourceTextHash does not match the current stage source text`);
  }
  if (
    entry.promptHash !== job.promptHash ||
    entry.styleBibleHash !== job.styleBibleHash ||
    entry.styleBibleHash !== manifest.styleBibleHash
  ) {
    fail(`${label} promptHash/styleBibleHash diverges from the checked-in prompt contract`);
  }
  if (!isApprovedReviewStatus(entry.reviewStatus) || entry.reviewStatus !== manifest.reviewStatus) {
    fail(`${label} reviewStatus must be codex-approved and match the manifest`);
  }
  if (
    entry.generatorProvenance?.provider !== "OpenAI Images" ||
    entry.generatorProvenance?.model !== EXPECTED_MODEL ||
    entry.generatorProvenance?.operation !== "generate" ||
    entry.generatorProvenance?.evidenceType !== entry.generationEvidence?.evidenceType ||
    ![API_EVIDENCE_TYPE, BUILTIN_EVIDENCE_TYPE].includes(
      entry.generationEvidence?.evidenceType,
    ) ||
    (entry.generationEvidence?.evidenceType === BUILTIN_EVIDENCE_TYPE
      ? entry.generatorProvenance?.tool !== BUILTIN_TOOL ||
        entry.generationEvidence?.tool !== BUILTIN_TOOL
      : Object.hasOwn(entry.generatorProvenance ?? {}, "tool"))
  ) {
    fail(`${label} generator provenance must bind one supported OpenAI Images evidence branch`);
  }
  if (!isDHash(entry.dHash)) {
    fail(`${label} dHash is invalid`);
  }
  const published = entry.published;
  if (
    published?.width !== EXPECTED_STAGE_WIDTH ||
    published?.height !== EXPECTED_STAGE_HEIGHT ||
    published?.format !== "webp" ||
    !isSha256(published?.sha256) ||
    !Number.isInteger(published?.bytes) ||
    published.bytes <= 0
  ) {
    fail(`${label} published WebP metadata must be complete and ${EXPECTED_STAGE_WIDTH}x${EXPECTED_STAGE_HEIGHT}`);
  }
  const publicPath = requiredString(published.path, `${label}.published.path`).replaceAll("\\", "/");
  const expectedPublicPath = `assets/stages/v${config.contentVersion}/${stage.id.toLowerCase()}.webp`;
  if (publicPath !== expectedPublicPath) {
    fail(`${label} published.path must be ${expectedPublicPath}`);
  }
  if (seenPaths.has(publicPath)) {
    fail(`${label} reuses published path ${publicPath}`);
  }
  seenPaths.add(publicPath);
  if (seenHashes.has(published.sha256)) {
    fail(`${label} reuses a published SHA-256; every stage must have a distinct image`);
  }
  seenHashes.add(published.sha256);
  if (seenDHashes.has(entry.dHash)) {
    fail(`${label} reuses a published dHash; exact perceptual duplicates must be regenerated`);
  }
  seenDHashes.add(entry.dHash);
  const absolute = resolveInside(config.toolRoot, publicPath, `${label}.published.path`);
  let buffer;
  try {
    buffer = await readFile(absolute);
  } catch (error) {
    fail(`${label} published WebP is missing: ${error.message}`);
  }
  if (buffer.byteLength !== published.bytes) {
    fail(`${label} published WebP byte count does not match the manifest`);
  }
  if (sha256(buffer) !== published.sha256) {
    fail(`${label} published WebP SHA-256 does not match the manifest`);
  }
  let metadata;
  try {
    metadata = await sharp(buffer).metadata();
  } catch (error) {
    fail(`${label} published WebP cannot be decoded: ${error.message}`);
  }
  if (
    metadata.format !== "webp" ||
    metadata.width !== EXPECTED_STAGE_WIDTH ||
    metadata.height !== EXPECTED_STAGE_HEIGHT
  ) {
    fail(
      `${label} published file must decode as ${EXPECTED_STAGE_WIDTH}x${EXPECTED_STAGE_HEIGHT} WebP`,
    );
  }
  if ((await differenceHash(buffer)) !== entry.dHash) {
    fail(`${label} dHash does not match the published WebP`);
  }
}

function buildIllustration(stage, entry, manifest, manifestPublicPath) {
  return {
    enabled: true,
    src: entry.published.path,
    alt: structuredClone(stage.illustration?.alt),
    style: IMAGE2_STAGE_STYLE,
    sha256: entry.published.sha256,
    provenance: {
      schemaVersion: 1,
      assetManifest: manifestPublicPath,
      manifestSchemaVersion: manifest.schemaVersion,
      provider: entry.generatorProvenance.provider,
      model: entry.model,
      quality: entry.quality,
      operation: entry.generatorProvenance.operation,
      evidenceType: entry.generatorProvenance.evidenceType,
      ...(entry.generatorProvenance.evidenceType === BUILTIN_EVIDENCE_TYPE
        ? { tool: BUILTIN_TOOL }
        : {}),
      sourceHashKind: entry.sourceHashKind,
      sourceTextHash: entry.sourceTextHash,
      sourceTextHashSchemaVersion: entry.sourceTextHashSchemaVersion,
      promptHash: entry.promptHash,
      styleBibleHash: entry.styleBibleHash,
      dHash: entry.dHash,
      reviewStatus: entry.reviewStatus,
    },
  };
}

function levelDescription(level) {
  return [
    { ja: "N3の日常表現と分かりやすい手がかり", zh: "N3 日常表达与明显线索", en: "N3 daily language and clear clues" },
    { ja: "N2の省略・逆接・敬語の距離", zh: "N2 省略、转折与敬语距离", en: "N2 ellipsis, contrast, and polite distance" },
    { ja: "N1の複雑な語気・皮肉・情報差", zh: "N1 复杂语气、讽刺与信息差", en: "N1 tone, irony, and information gaps" },
    { ja: "N1上級の複数人物・横断推理", zh: "N1 高阶多人对话与跨句推理", en: "Advanced N1 multi-speaker inference" },
    { ja: "N1語用論の多義性・開かれた結末", zh: "N1 高阶语用、多义性与开放结局", en: "N1 pragmatics and open endings" },
  ][level - 1];
}

function buildIndexes(batches, contentVersion) {
  const indexes = [];
  for (let level = 1; level <= 5; level += 1) {
    const stages = batches
      .filter((batch) => batch.level === level)
      .flatMap((batch) => batch.stages.map((stage) => ({ stage, batch: batch.name })))
      .sort((left, right) => stageSort(left.stage, right.stage));
    if (stages.length !== 50) {
      fail(`Level ${level} has ${stages.length} stages after migration; expected 50`);
    }
    const jlptTarget = ["N3", "N2", "N1", "N1-advanced", "N1-pragmatics"][level - 1];
    indexes.push({
      level,
      value: {
        schemaVersion: 1,
        contentVersion,
        level,
        jlptTarget,
        stages: stages.map(({ stage, batch }) => ({
          id: stage.id,
          stage: stage.stage,
          title: stage.title,
          shortLabel: stage.title,
          genres: stage.genres,
          skills: stage.skills,
          batch,
          contentHash: stage.contentHash,
        })),
      },
    });
  }
  return indexes;
}

async function buildCatalog(contentRoot, contentVersion) {
  const current = await readJson(path.join(contentRoot, "catalog.json"), "catalog.json");
  const currentLevels = new Map((current.levels || []).map((entry) => [entry.level, entry]));
  return {
    ...current,
    schemaVersion: 1,
    contentVersion,
    title: current.title ?? {
      ja: "日本語の裏側",
      zh: "日语的言外之意",
      en: "Behind the Japanese",
    },
    stageCount: EXPECTED_STAGE_COUNT,
    levels: Array.from({ length: 5 }, (_, index) => {
      const level = index + 1;
      const currentLevel = currentLevels.get(level) || {};
      return {
        ...currentLevel,
        level,
        jlptTarget: ["N3", "N2", "N1", "N1-advanced", "N1-pragmatics"][index],
        index: `level-${level}/index.json`,
        cover: currentLevel.cover ?? `assets/covers/level-${level}.webp`,
        description: currentLevel.description ?? levelDescription(level),
      };
    }),
  };
}

async function buildGenerationState(config, manifest, manifestBytes, manifestPublicPath) {
  const statePath = path.join(config.contentRoot, "generation-state.json");
  const current = await readJson(statePath, "generation-state.json");
  return {
    ...current,
    schemaVersion: 1,
    contentVersion: config.contentVersion,
    illustrations: {
      status: "complete",
      stageAssetCount: EXPECTED_STAGE_COUNT,
      manifest: manifestPublicPath,
      manifestSha256: sha256(manifestBytes),
      generatorVersion: IMAGE2_GENERATOR_VERSION,
      provider: "OpenAI Images",
      model: EXPECTED_MODEL,
      quality: EXPECTED_QUALITY,
      sourceHashKind: EXPECTED_SOURCE_HASH_KIND,
      sourceTextHashSchemaVersion: SOURCE_TEXT_HASH_SCHEMA_VERSION,
      reviewStatus: manifest.reviewStatus,
      imagegenStatus: "approved-published",
      styleCounts: { [IMAGE2_STAGE_STYLE]: EXPECTED_STAGE_COUNT },
      generatedBatches: [path.posix.dirname(manifestPublicPath)],
    },
  };
}

async function atomicWrite(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  try {
    await writeFile(temporary, value, "utf8");
    await rename(temporary, filePath);
  } finally {
    await rm(temporary, { force: true }).catch(() => {});
  }
}

export async function migrateImage2Content(options) {
  const config = normalizeOptions(options);
  const manifestBytes = await readFile(config.manifestPath);
  const manifest = await readJson(config.manifestPath, "image2 manifest");
  assertManifestHeader(manifest, config);
  const { batches, stages } = await loadStageBatches(config.contentRoot);
  const promptContract = await loadPromptContract(config, stages);
  if (manifest.styleBibleHash !== promptContract.styleBibleHash) {
    fail("Image2 manifest styleBibleHash does not match image2/style-bible.md");
  }
  const manifestPublicPath = relativeInside(config.toolRoot, config.manifestPath, "manifestPath");
  const seenPaths = new Set();
  const seenHashes = new Set();
  const seenDHashes = new Set();
  for (const [index, stage] of stages.entries()) {
    await assertCurrentIllustration(stage, config);
    await assertPublishedStage(
      manifest.stages[index],
      promptContract.jobs[index],
      stage,
      config,
      manifest,
      seenPaths,
      seenHashes,
      seenDHashes,
    );
  }

  const entryByStage = new Map(manifest.stages.map((entry) => [entry.stageId, entry]));
  let replacedStageCount = 0;
  for (const batch of batches) {
    batch.stages = batch.stages.sort(stageSort).map((stage) => {
      const entry = entryByStage.get(stage.id);
      const imageChanged = stage.illustration?.sha256 !== entry.published.sha256;
      const next = structuredClone(stage);
      if (imageChanged) {
        next.revision += 1;
        replacedStageCount += 1;
      }
      next.contentVersion = config.contentVersion;
      next.illustration = buildIllustration(stage, entry, manifest, manifestPublicPath);
      next.textLocked = true;
      next.contentHash = contentHash(next);
      return next;
    });
    batch.payload = {
      ...batch.payload,
      schemaVersion: 1,
      contentVersion: config.contentVersion,
      level: batch.level,
      stages: batch.stages,
    };
  }

  const indexes = buildIndexes(batches, config.contentVersion);
  const catalog = await buildCatalog(config.contentRoot, config.contentVersion);
  const generationState = await buildGenerationState(
    config,
    manifest,
    manifestBytes,
    manifestPublicPath,
  );
  const outputs = [
    ...batches.map((batch) => ({ file: batch.file, value: jsonText(batch.payload) })),
    ...indexes.map(({ level, value }) => ({
      file: path.join(config.contentRoot, `level-${level}`, "index.json"),
      value: jsonText(value),
    })),
    { file: path.join(config.contentRoot, "catalog.json"), value: jsonText(catalog) },
    {
      file: path.join(config.contentRoot, "generation-state.json"),
      value: jsonText(generationState),
    },
  ];
  const changedOutputs = [];
  for (const output of outputs) {
    let current = null;
    try {
      current = await readFile(output.file, "utf8");
    } catch {
      // A derived index may not exist yet. It is included in the write plan.
    }
    if (current !== output.value) changedOutputs.push(output);
  }
  if (config.write) {
    for (const output of changedOutputs) {
      await atomicWrite(output.file, output.value);
    }
  }
  return {
    mode: config.write ? "write" : "check",
    stageCount: stages.length,
    replacedStageCount,
    wouldWrite: changedOutputs.length > 0,
    changedFileCount: changedOutputs.length,
    changedFiles: changedOutputs.map((output) =>
      path.relative(config.toolRoot, output.file).replaceAll("\\", "/"),
    ),
    contentVersion: config.contentVersion,
    manifest: manifestPublicPath,
    model: manifest.model,
    quality: manifest.quality,
    reviewStatus: manifest.reviewStatus,
    style: IMAGE2_STAGE_STYLE,
  };
}

function usage() {
  return `Usage:
  node tools/japanese-subtext/scripts/migrate-image2-content.mjs \\
    --manifest <published image2 manifest.json> \\
    --content-version <x.y.z> (--check | --write)

The command validates all 250 approved/reviewed gpt-image-2 high WebPs, their
sourceTextHash bindings, dimensions, and SHA-256 values before planning or
writing any content files. --check is read-only. --write is idempotent.`;
}

function parseCli(argv) {
  if (argv.includes("--help") || argv.includes("-h")) return { help: true };
  const check = argv.includes("--check");
  const write = argv.includes("--write");
  if (check === write) fail("Choose exactly one of --check or --write");
  const values = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!["--manifest", "--content-version", "--tool-root"].includes(token)) continue;
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) fail(`${token} requires a value`);
    values.set(token, value);
    index += 1;
  }
  if (!values.has("--manifest")) fail("--manifest is required");
  if (!values.has("--content-version")) fail("--content-version is required");
  return {
    help: false,
    options: {
      toolRoot: values.has("--tool-root")
        ? path.resolve(values.get("--tool-root"))
        : DEFAULT_TOOL_ROOT,
      manifestPath: path.resolve(values.get("--manifest")),
      contentVersion: values.get("--content-version"),
      write,
    },
  };
}

async function runCli() {
  try {
    const parsed = parseCli(process.argv.slice(2));
    if (parsed.help) {
      console.log(usage());
      return;
    }
    console.log(JSON.stringify(await migrateImage2Content(parsed.options), null, 2));
  } catch (error) {
    console.error(`Image2 content migration failed: ${error.message}`);
    process.exitCode = 1;
  }
}

const directInvocation = process.argv[1]
  ? import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
  : false;
if (directInvocation) await runCli();
