import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { contentHash, contentRoot, jsonText, loadStageBatches, readJson, stageSort, toolRoot } from "./content-utils.mjs";
import {
  APPROVED_IMAGE2_REVIEW_STATUSES,
  IMAGE2_STAGE_STYLE,
  normalizeIllustrationManifestEntries,
} from "./migrate-image2-content.mjs";

const currentCatalog = await readJson(path.join(contentRoot, "catalog.json"));
const CONTENT_VERSION = currentCatalog.contentVersion;
if (!/^\d+\.\d+\.\d+$/.test(CONTENT_VERSION || "")) {
  throw new Error("content/catalog.json must declare a semantic contentVersion before building indexes.");
}
if (!["1.0.2", "1.0.3"].includes(CONTENT_VERSION)) {
  throw new Error("build-content only supports the maintained 1.0.2/1.0.3 content contracts.");
}

const batches = await loadStageBatches();
if (!batches.length) throw new Error("No stage batches found. Generate reviewed content before building indexes.");
const generationState = await readJson(path.join(contentRoot, "generation-state.json"));
const illustrationManifestPath = generationState.illustrations?.manifest || "assets/stages/manifest.json";
if (!/^assets\/stages\/[a-z0-9._/-]*manifest\.json$/i.test(illustrationManifestPath) || illustrationManifestPath.includes("..")) {
  throw new Error("generation-state illustrations.manifest must be a safe assets/stages manifest path.");
}
const illustrationManifest = await readJson(path.join(toolRoot, illustrationManifestPath));
const illustrationContract = normalizeIllustrationManifestEntries(illustrationManifest);
const illustrationByStage = new Map(illustrationContract.entries.map((entry) => [entry.stageId, entry]));
if (illustrationContract.entries.length !== 250 || illustrationByStage.size !== 250) {
  throw new Error(`Illustration manifest must contain exactly 250 unique stage entries; found ${illustrationContract.entries.length}/${illustrationByStage.size}.`);
}
if (
  (CONTENT_VERSION === "1.0.2" && illustrationContract.kind !== "legacy-v1") ||
  (CONTENT_VERSION === "1.0.3" && illustrationContract.kind !== "image2-v3")
) {
  throw new Error(`Content ${CONTENT_VERSION} must use its matching legacy/image2 illustration manifest shape.`);
}
if (
  illustrationContract.kind === "image2-v3" &&
  (
    new Set(illustrationContract.entries.map((entry) => entry.sha256)).size !== 250 ||
    new Set(illustrationContract.entries.map((entry) => entry.dHash)).size !== 250
  )
) {
  throw new Error("Image2 illustration manifest must contain 250 distinct published SHA-256 and dHash values.");
}
if (illustrationManifest.contentVersion !== CONTENT_VERSION) {
  throw new Error(`Illustration manifest contentVersion ${illustrationManifest.contentVersion} does not match catalog ${CONTENT_VERSION}.`);
}
if (
  illustrationContract.kind === "image2-v3" &&
  (
    illustrationManifestPath !== `assets/stages/v${CONTENT_VERSION}/manifest.json` ||
    illustrationManifest.schemaVersion !== 3 ||
    illustrationManifest.model !== "gpt-image-2" ||
    illustrationManifest.quality !== "high" ||
    !APPROVED_IMAGE2_REVIEW_STATUSES.includes(illustrationManifest.reviewStatus)
  )
) {
  throw new Error("Image2 illustration manifest must be schema v3, gpt-image-2 high, and approved/reviewed.");
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
      throw new Error(`${stage.id}: illustration metadata diverges from the published asset manifest.`);
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
      throw new Error(`${stage.id}: run migrate-image2-content.mjs before rebuilding image2 content.`);
    }
    stage.illustration.sha256 = illustration.sha256;
    stage.contentVersion = CONTENT_VERSION;
    stage.textLocked = true;
    stage.contentHash = contentHash(stage);
  });
  batch.payload.schemaVersion = 1;
  batch.payload.contentVersion = CONTENT_VERSION;
  batch.payload.level = batch.level;
  batch.payload.stages = batch.stages;
  await writeFile(batch.file, jsonText(batch.payload), "utf8");
}

const levels = [];
for (let level = 1; level <= 5; level += 1) {
  const levelBatches = batches.filter((batch) => batch.level === level);
  const stages = levelBatches.flatMap((batch) => batch.stages.map((stage) => ({ stage, batch: batch.name }))).sort((a, b) => stageSort(a.stage, b.stage));
  if (stages.length !== 50) throw new Error(`Level ${level} has ${stages.length} stages; expected 50.`);
  const jlptTarget = ["N3", "N2", "N1", "N1-advanced", "N1-pragmatics"][level - 1];
  const index = {
    schemaVersion: 1,
    contentVersion: CONTENT_VERSION,
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
      contentHash: stage.contentHash
    }))
  };
  const directory = path.join(contentRoot, `level-${level}`);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, "index.json"), jsonText(index), "utf8");
  levels.push({
    level,
    jlptTarget,
    index: `level-${level}/index.json`,
    cover: `assets/covers/level-${level}.webp`,
    description: levelDescription(level)
  });
}

await writeFile(path.join(contentRoot, "catalog.json"), jsonText({
  schemaVersion: 1,
  contentVersion: CONTENT_VERSION,
  title: { ja: "日本語の裏側", zh: "日语的言外之意", en: "Behind the Japanese" },
  stageCount: 250,
  levels
}), "utf8");

console.log(`Built catalog and five level indexes from ${batches.length} batches / 250 stages.`);

function levelDescription(level) {
  const values = [
    { ja: "N3の日常表現と分かりやすい手がかり", zh: "N3 日常表达与明显线索", en: "N3 daily language and clear clues" },
    { ja: "N2の省略・逆接・敬語の距離", zh: "N2 省略、转折与敬语距离", en: "N2 ellipsis, contrast, and polite distance" },
    { ja: "N1の複雑な語気・皮肉・情報差", zh: "N1 复杂语气、讽刺与信息差", en: "N1 tone, irony, and information gaps" },
    { ja: "N1上級の複数人物・横断推理", zh: "N1 高阶多人对话与跨句推理", en: "Advanced N1 multi-speaker inference" },
    { ja: "N1語用論の多義性・開かれた結末", zh: "N1 高阶语用、多义性与开放结局", en: "N1 pragmatics and open endings" }
  ];
  return values[level - 1];
}
