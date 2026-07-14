import path from "node:path";
import { writeFile } from "node:fs/promises";
import { loadAllStages, readJson, toolRoot } from "./content-utils.mjs";

const stages = await loadAllStages();
const voices = (await readJson(path.join(toolRoot, "content", "voices.json"))).voices || {};
const audioManifest = await readJson(path.join(toolRoot, "audio", "manifest.json"));
const contentVersions = new Set(stages.map((stage) => stage.contentVersion));
if (contentVersions.size !== 1) throw new Error("All stages must share one contentVersion before statistics are published.");
const [contentVersion] = contentVersions;
const questions = stages.flatMap((stage) => stage.questions);
const lines = stages.flatMap((stage) => stage.lines.map((line) => ({ line, stage })));
const options = questions.flatMap((question) => question.options);
const singleChoiceQuestions = questions.filter((question) => question.type === "single");
const uniqueLongestCorrect = singleChoiceQuestions.filter((question) => {
  const lengths = question.options.map((option) => Array.from(option.text.ja).length);
  const correctIndex = question.options.findIndex((option) => question.correctOptionIds.includes(option.id));
  const max = Math.max(...lengths);
  return correctIndex >= 0 && lengths[correctIndex] === max && lengths.filter((length) => length === max).length === 1;
}).length;
const result = {
  contentVersion,
  audioContentVersion: audioManifest.contentVersion,
  totalStages: stages.length,
  stagesByLevel: count(stages, (stage) => `level-${stage.level}`),
  totalLines: lines.length,
  totalQuestions: questions.length,
  singleChoice: singleChoiceQuestions.length,
  multipleChoice: questions.filter((question) => question.type === "multiple").length,
  multiQuestionStages: stages.filter((stage) => stage.questions.length > 1).length,
  totalOptions: options.length,
  uniqueLongestCorrect: {
    count: uniqueLongestCorrect,
    eligible: singleChoiceQuestions.length,
    percent: Number(((uniqueLongestCorrect / Math.max(1, singleChoiceQuestions.length)) * 100).toFixed(1))
  },
  genres: count(stages.flatMap((stage) => stage.genres), (value) => value),
  skills: count(stages.flatMap((stage) => stage.skills), (value) => value),
  illustratedStages: stages.filter((stage) => stage.illustration.enabled).length,
  illustrationStyles: count(
    stages.filter((stage) => stage.illustration.enabled),
    (stage) => stage.illustration.style || "unknown",
  ),
  illustrationModels: count(
    stages.filter((stage) => stage.illustration.enabled),
    (stage) => stage.illustration.provenance?.model || "legacy-unversioned",
  ),
  voiceLines: count(lines, ({ line, stage }) => {
    const voiceKey = stage.cast.find((person) => person.id === line.speaker)?.voiceKey;
    return voices[voiceKey]?.gender || "unknown";
  }),
  voiceKeys: count(lines, ({ line, stage }) => stage.cast.find((person) => person.id === line.speaker)?.voiceKey || "unknown"),
  expectedAudio: {
    scenes: stages.length,
    lines: lines.length,
    options: options.length,
    tokens: lines.reduce((sum, { line }) => sum + line.tokens.length, 0),
    total: stages.length + lines.length + options.length + lines.reduce((sum, { line }) => sum + line.tokens.length, 0)
  },
  generatedAudio: audioManifest.stats || {},
  lengthProgression: Object.fromEntries(Array.from({ length: 5 }, (_, index) => {
    const level = index + 1;
    const selected = stages.filter((stage) => stage.level === level).sort((a, b) => a.stage - b.stage);
    return [`level-${level}`, {
      first10AverageLines: average(selected.slice(0, 10).map((stage) => stage.lines.length)),
      last10AverageLines: average(selected.slice(-10).map((stage) => stage.lines.length))
    }];
  }))
};
const serialized = `${JSON.stringify(result, null, 2)}\n`;
const outputFlag = process.argv.indexOf("--output");
if (outputFlag >= 0) {
  const requested = process.argv[outputFlag + 1];
  if (!requested) throw new Error("--output requires a path");
  const outputPath = path.resolve(process.cwd(), requested);
  const reportsRoot = path.resolve(toolRoot, "reports");
  if (outputPath !== reportsRoot && !outputPath.startsWith(`${reportsRoot}${path.sep}`)) {
    throw new Error("stats output must stay inside tools/japanese-subtext/reports");
  }
  await writeFile(outputPath, serialized, "utf8");
  console.log(`Wrote ${path.relative(process.cwd(), outputPath)}`);
} else {
  console.log(serialized.trimEnd());
}

function count(values, keyOf) {
  return Object.fromEntries([...values.reduce((map, value) => {
    const key = keyOf(value);
    map.set(key, (map.get(key) || 0) + 1);
    return map;
  }, new Map())].sort(([a], [b]) => String(a).localeCompare(String(b))));
}

function average(values) {
  return Number((values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length)).toFixed(2));
}
