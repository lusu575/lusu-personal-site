import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { contentHash, jsonText, readJson, stageSort } from "./content-utils.mjs";
import {
  APPROVED_IMAGE2_REVIEW_STATUSES,
  IMAGE2_STAGE_STYLE,
  LEGACY_STAGE_STYLE,
  TRANSITIONAL_AUDIO_FIRST_MODE,
  TRANSITIONAL_AUDIO_FIRST_STATUS,
  classifyIllustrationContract,
  normalizeIllustrationManifestEntries,
} from "./migrate-image2-content.mjs";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const DEFAULT_TOOL_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "..");
const EXPECTED_STAGE_COUNT = 250;
const EXPECTED_LEVEL_COUNT = 5;
const EXPECTED_STAGES_PER_LEVEL = 50;

function fail(message) {
  throw new Error(message);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function isSafeIllustrationManifestPath(value) {
  return (
    typeof value === "string" &&
    /^assets\/stages\/[a-z0-9._/-]*manifest\.json$/i.test(value) &&
    !value.includes("..")
  );
}

function isSafeStageAssetPath(value) {
  return (
    typeof value === "string" &&
    /^assets\/stages\/[a-z0-9._/-]+\.webp$/i.test(value) &&
    !value.includes("..")
  );
}

function insideRoot(root, relativePath, label) {
  if (!isSafeStageAssetPath(relativePath)) fail(`${label} is not a safe stage WebP path.`);
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, ...relativePath.split("/"));
  if (!resolved.startsWith(`${resolvedRoot}${path.sep}`)) fail(`${label} escapes the tool root.`);
  return resolved;
}

async function loadStageBatches(contentRoot) {
  const result = [];
  for (let level = 1; level <= EXPECTED_LEVEL_COUNT; level += 1) {
    const directory = path.join(contentRoot, `level-${level}`);
    const names = (await readdir(directory))
      .filter((name) => /^batch-[0-9]{3}-[0-9]{3}\.json$/.test(name))
      .sort();
    for (const name of names) {
      const file = path.join(directory, name);
      const payload = await readJson(file);
      result.push({
        level,
        name,
        file,
        payload,
        stages: Array.isArray(payload?.stages) ? payload.stages : [],
      });
    }
  }
  return result;
}

async function validateLegacyEntries(toolRoot, entries) {
  for (const entry of entries) {
    const label = `${entry?.stageId || "<missing-stage>"} legacy illustration`;
    if (
      !/^L[1-5]-[0-9]{3}$/.test(entry?.stageId || "") ||
      !isSafeStageAssetPath(entry?.path) ||
      entry?.width !== 960 ||
      entry?.height !== 720 ||
      entry?.style !== LEGACY_STAGE_STYLE ||
      entry?.reviewStatus !== "automated-scene-mapped" ||
      !/^[a-f0-9]{64}$/.test(entry?.sha256 || "")
    ) {
      fail(`${label} metadata is incomplete or invalid.`);
    }
    const file = insideRoot(toolRoot, entry.path, `${label}.path`);
    let bytes;
    try {
      bytes = await readFile(file);
    } catch (error) {
      fail(`${label} file is missing: ${error.message}`);
    }
    if (sha256(bytes) !== entry.sha256) {
      fail(`${label} SHA-256 does not match its file.`);
    }
  }
}

function transitionalGenerationState({
  generationState,
  contentVersion,
  illustrationManifest,
  illustrationManifestPath,
  illustrationManifestSha256,
}) {
  return {
    ...generationState,
    schemaVersion: 1,
    contentVersion,
    illustrations: {
      ...(generationState.illustrations || {}),
      status: TRANSITIONAL_AUDIO_FIRST_STATUS,
      stageAssetCount: EXPECTED_STAGE_COUNT,
      manifest: illustrationManifestPath,
      manifestSha256: illustrationManifestSha256,
      assetContentVersion: illustrationManifest.contentVersion,
      targetContentVersion: contentVersion,
      styleCounts: { [LEGACY_STAGE_STYLE]: EXPECTED_STAGE_COUNT },
      transition: {
        mode: TRANSITIONAL_AUDIO_FIRST_MODE,
        requiredFinalManifest: `assets/stages/v${contentVersion}/manifest.json`,
        requiredFinalStyle: IMAGE2_STAGE_STYLE,
      },
    },
  };
}

export async function buildContent(options = {}) {
  const toolRoot = path.resolve(options.toolRoot ?? DEFAULT_TOOL_ROOT);
  const contentRoot = path.join(toolRoot, "content");
  const currentCatalog = await readJson(path.join(contentRoot, "catalog.json"));
  const contentVersion = options.contentVersion ?? currentCatalog.contentVersion;
  if (!/^\d+\.\d+\.\d+$/.test(contentVersion || "")) {
    fail("contentVersion must be a semantic x.y.z version.");
  }
  if (!["1.0.2", "1.0.3"].includes(contentVersion)) {
    fail("build-content only supports the maintained 1.0.2/1.0.3 content contracts.");
  }

  const batches = await loadStageBatches(contentRoot);
  if (!batches.length) fail("No stage batches found. Generate reviewed content before building indexes.");
  const generationStatePath = path.join(contentRoot, "generation-state.json");
  const generationState = await readJson(generationStatePath);
  const illustrationManifestPath =
    generationState.illustrations?.manifest || "assets/stages/manifest.json";
  if (!isSafeIllustrationManifestPath(illustrationManifestPath)) {
    fail("generation-state illustrations.manifest must be a safe assets/stages manifest path.");
  }
  const illustrationManifestFile = path.join(toolRoot, illustrationManifestPath);
  const illustrationManifestBytes = await readFile(illustrationManifestFile);
  const illustrationManifest = JSON.parse(illustrationManifestBytes.toString("utf8"));
  const illustrationContract = normalizeIllustrationManifestEntries(illustrationManifest);
  const illustrationMode = classifyIllustrationContract({
    contentVersion,
    manifestContentVersion: illustrationManifest.contentVersion,
    contractKind: illustrationContract.kind,
    allowLegacyIllustrations: options.allowLegacyIllustrations === true,
  });
  const illustrationByStage = new Map(
    illustrationContract.entries.map((entry) => [entry.stageId, entry]),
  );
  if (
    illustrationContract.entries.length !== EXPECTED_STAGE_COUNT ||
    illustrationByStage.size !== EXPECTED_STAGE_COUNT
  ) {
    fail(
      `Illustration manifest must contain exactly ${EXPECTED_STAGE_COUNT} unique stage entries; found ${illustrationContract.entries.length}/${illustrationByStage.size}.`,
    );
  }
  if (illustrationContract.kind === "legacy-v1") {
    if (illustrationManifest.schemaVersion !== 1) {
      fail("Legacy illustration manifest schemaVersion must be 1.");
    }
    await validateLegacyEntries(toolRoot, illustrationContract.entries);
  }
  if (
    illustrationContract.kind === "image2-v3" &&
    (
      new Set(illustrationContract.entries.map((entry) => entry.sha256)).size !== EXPECTED_STAGE_COUNT ||
      new Set(illustrationContract.entries.map((entry) => entry.dHash)).size !== EXPECTED_STAGE_COUNT
    )
  ) {
    fail("Image2 illustration manifest must contain 250 distinct published SHA-256 and dHash values.");
  }
  if (
    illustrationContract.kind === "image2-v3" &&
    (
      illustrationManifestPath !== `assets/stages/v${contentVersion}/manifest.json` ||
      illustrationManifest.schemaVersion !== 3 ||
      illustrationManifest.model !== "gpt-image-2" ||
      illustrationManifest.quality !== "high" ||
      !APPROVED_IMAGE2_REVIEW_STATUSES.includes(illustrationManifest.reviewStatus)
    )
  ) {
    fail("Image2 illustration manifest must be schema v3, gpt-image-2 high, and approved/reviewed.");
  }

  for (const batch of batches) {
    batch.stages.sort(stageSort);
    batch.stages.forEach((stage) => {
      const illustration = illustrationByStage.get(stage.id);
      if (
        !illustration ||
        illustration.path !== stage.illustration?.src ||
        illustration.style !== stage.illustration?.style ||
        illustration.sha256 !== stage.illustration?.sha256
      ) {
        fail(`${stage.id}: illustration metadata diverges from the published asset manifest.`);
      }
      if (
        illustrationContract.kind === "image2-v3" &&
        (
          stage.illustration.style !== IMAGE2_STAGE_STYLE ||
          stage.illustration.provenance?.sourceTextHash !== illustration.sourceTextHash ||
          stage.illustration.provenance?.model !== "gpt-image-2" ||
          stage.illustration.provenance?.quality !== "high"
        )
      ) {
        fail(`${stage.id}: run migrate-image2-content.mjs before rebuilding image2 content.`);
      }
      stage.illustration.sha256 = illustration.sha256;
      stage.contentVersion = contentVersion;
      stage.textLocked = true;
      stage.contentHash = contentHash(stage);
    });
    batch.payload.schemaVersion = 1;
    batch.payload.contentVersion = contentVersion;
    batch.payload.level = batch.level;
    batch.payload.stages = batch.stages;
    await writeFile(batch.file, jsonText(batch.payload), "utf8");
  }

  const levels = [];
  for (let level = 1; level <= EXPECTED_LEVEL_COUNT; level += 1) {
    const levelBatches = batches.filter((batch) => batch.level === level);
    const stages = levelBatches
      .flatMap((batch) => batch.stages.map((stage) => ({ stage, batch: batch.name })))
      .sort((left, right) => stageSort(left.stage, right.stage));
    if (stages.length !== EXPECTED_STAGES_PER_LEVEL) {
      fail(`Level ${level} has ${stages.length} stages; expected ${EXPECTED_STAGES_PER_LEVEL}.`);
    }
    const jlptTarget = ["N3", "N2", "N1", "N1-advanced", "N1-pragmatics"][level - 1];
    const index = {
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
    };
    const directory = path.join(contentRoot, `level-${level}`);
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, "index.json"), jsonText(index), "utf8");
    levels.push({
      level,
      jlptTarget,
      index: `level-${level}/index.json`,
      cover: `assets/covers/level-${level}.webp`,
      description: levelDescription(level),
    });
  }

  await writeFile(
    path.join(contentRoot, "catalog.json"),
    jsonText({
      schemaVersion: 1,
      contentVersion,
      title: { ja: "日本語の裏側", zh: "日语的言外之意", en: "Behind the Japanese" },
      stageCount: EXPECTED_STAGE_COUNT,
      levels,
    }),
    "utf8",
  );

  if (illustrationMode.transitional) {
    await writeFile(
      generationStatePath,
      jsonText(
        transitionalGenerationState({
          generationState,
          contentVersion,
          illustrationManifest,
          illustrationManifestPath,
          illustrationManifestSha256: sha256(illustrationManifestBytes),
        }),
      ),
      "utf8",
    );
  }

  return {
    contentVersion,
    stageCount: batches.reduce((count, batch) => count + batch.stages.length, 0),
    batchCount: batches.length,
    illustrationMode: illustrationMode.mode,
    transitional: illustrationMode.transitional,
  };
}

function levelDescription(level) {
  const values = [
    { ja: "N3の日常表現と分かりやすい手がかり", zh: "N3 日常表达与明显线索", en: "N3 daily language and clear clues" },
    { ja: "N2の省略・逆接・敬語の距離", zh: "N2 省略、转折与敬语距离", en: "N2 ellipsis, contrast, and polite distance" },
    { ja: "N1の複雑な語気・皮肉・情報差", zh: "N1 复杂语气、讽刺与信息差", en: "N1 tone, irony, and information gaps" },
    { ja: "N1上級の複数人物・横断推理", zh: "N1 高阶多人对话与跨句推理", en: "Advanced N1 multi-speaker inference" },
    { ja: "N1語用論の多義性・開かれた結末", zh: "N1 高阶语用、多义性与开放结局", en: "N1 pragmatics and open endings" },
  ];
  return values[level - 1];
}

function usage() {
  return `Usage:
  node tools/japanese-subtext/scripts/build-content.mjs [options]

Options:
  --content-version <x.y.z>       Target maintained content version; defaults to catalog
  --allow-legacy-illustrations   Explicitly build the 1.0.3 audio-first transition
  --tool-root <directory>        Override tool root (primarily for tests)
  --help                         Show this help`;
}

function parseCli(argv) {
  if (argv.includes("--help") || argv.includes("-h")) return { help: true };
  const options = { allowLegacyIllustrations: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--allow-legacy-illustrations") {
      options.allowLegacyIllustrations = true;
      continue;
    }
    if (!["--content-version", "--tool-root"].includes(token)) {
      fail(`Unknown argument: ${token}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) fail(`${token} requires a value`);
    if (token === "--content-version") options.contentVersion = value;
    if (token === "--tool-root") options.toolRoot = path.resolve(value);
    index += 1;
  }
  return { help: false, options };
}

async function runCli() {
  const parsed = parseCli(process.argv.slice(2));
  if (parsed.help) {
    console.log(usage());
    return;
  }
  const result = await buildContent(parsed.options);
  console.log(
    `Built catalog and five level indexes from ${result.batchCount} batches / ${result.stageCount} stages (${result.illustrationMode}).`,
  );
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === pathToFileURL(SCRIPT_PATH).href
) {
  runCli().catch((error) => {
    console.error(`FAIL: ${error.message}`);
    process.exitCode = 1;
  });
}
