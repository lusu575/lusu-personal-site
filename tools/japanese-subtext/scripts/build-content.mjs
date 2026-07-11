import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { contentHash, contentRoot, jsonText, loadStageBatches, stageSort } from "./content-utils.mjs";

const batches = await loadStageBatches();
if (!batches.length) throw new Error("No stage batches found. Generate reviewed content before building indexes.");

for (const batch of batches) {
  batch.stages.sort(stageSort);
  batch.stages.forEach((stage) => {
    stage.textLocked = true;
    stage.contentHash = contentHash(stage);
  });
  batch.payload.schemaVersion = 1;
  batch.payload.contentVersion = "1.0.0";
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
    contentVersion: "1.0.0",
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
  contentVersion: "1.0.0",
  title: { ja: "日本語の裏側", zh: "日本語の裏側", en: "日本語の裏側" },
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
