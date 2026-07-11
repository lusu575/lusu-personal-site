import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptFile = fileURLToPath(import.meta.url);
const scriptRoot = path.dirname(scriptFile);
const toolRoot = path.resolve(scriptRoot, "..");
const artifactTypes = ["scene", "line", "option", "token"];

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

function speechSeconds(text, charactersPerSecond) {
  const characters = [...String(text || "").normalize("NFKC").replace(/\s/gu, "")].length;
  return Math.max(0.32, characters / charactersPerSecond);
}

function estimateBytes(durationSeconds, bitrateKbps) {
  return Math.ceil((durationSeconds * bitrateKbps * 1000) / 8 + 512);
}

export function expectedArtifacts(
  stages,
  {
    charactersPerSecond = 7.5,
    leadingSilenceMs = 60,
    trailingSilenceMs = 100,
    sceneGapMs = 180,
  } = {},
) {
  const artifacts = [];
  const padSeconds = (leadingSilenceMs + trailingSilenceMs) / 1000;
  for (const stage of stages) {
    const level = Number(stage.level);
    const lineDurations = [];
    for (const line of stage.lines || []) {
      const speech = speechSeconds(line.ttsTextJa, charactersPerSecond);
      lineDurations.push(speech);
      artifacts.push({ id: line.audioId, type: "line", level, stageId: stage.id, durationSeconds: speech + padSeconds });
      for (const token of line.tokens || []) {
        artifacts.push({
          id: token.audioId,
          type: "token",
          level,
          stageId: stage.id,
          durationSeconds: speechSeconds(token.reading || token.text, charactersPerSecond) + padSeconds,
        });
      }
    }
    for (const question of stage.questions || []) {
      for (const option of question.options || []) {
        artifacts.push({
          id: option.audioId,
          type: "option",
          level,
          stageId: stage.id,
          durationSeconds: speechSeconds(option.ttsTextJa, charactersPerSecond) + padSeconds,
        });
      }
    }
    const gaps = (stage.lines || []).slice(0, -1).reduce(
      (sum, line) => sum + Number(line.pauseAfterMs ?? sceneGapMs) / 1000,
      0,
    );
    artifacts.push({
      id: stage.audio?.sceneAudioId,
      type: "scene",
      level,
      stageId: stage.id,
      durationSeconds: leadingSilenceMs / 1000 + lineDurations.reduce((sum, value) => sum + value, 0) + gaps + trailingSilenceMs / 1000,
    });
  }
  return artifacts.filter((artifact) => artifact.id);
}

function blankTypeCounts() {
  return { scene: 0, line: 0, option: 0, token: 0 };
}

function blankGroup() {
  return {
    expected: 0,
    actual: 0,
    missing: 0,
    durationSeconds: 0,
    estimatedBytes: 0,
  };
}

export function estimateAudio({
  manifest = { items: {} },
  stages = [],
  bitrateKbps = 64,
  charactersPerSecond = 7.5,
  leadingSilenceMs = 60,
  trailingSilenceMs = 100,
  sceneGapMs = 180,
  audioRoot = null,
} = {}) {
  const actualItems = manifest?.items && typeof manifest.items === "object" ? manifest.items : {};
  let expected = expectedArtifacts(stages, {
    charactersPerSecond,
    leadingSilenceMs,
    trailingSilenceMs,
    sceneGapMs,
  });
  if (!expected.length) {
    expected = Object.values(actualItems).map((item) => ({
      id: item.id,
      type: item.type,
      level: Number(item.level),
      stageId: item.stageId,
      durationSeconds: Number(item.durationSeconds || 0),
    }));
  }

  const typeExpected = blankTypeCounts();
  const typeActual = blankTypeCounts();
  const levels = {};
  const types = Object.fromEntries(artifactTypes.map((type) => [type, blankGroup()]));
  let actualCount = 0;
  let actualBytes = 0;
  let actualDurationSeconds = 0;
  let estimatedTotalBytes = 0;
  let estimatedTotalDurationSeconds = 0;

  for (const artifact of expected) {
    let actual = actualItems[artifact.id];
    if (actual && audioRoot) {
      const root = path.resolve(audioRoot);
      const relative = String(actual.path || "");
      const file = path.resolve(root, ...relative.split("/"));
      const safe = relative && !relative.includes("\\") && !relative.split("/").includes("..")
        && file.startsWith(`${root}${path.sep}`);
      if (!safe || !existsSync(file) || !statSync(file).isFile() || statSync(file).size <= 0) actual = null;
    }
    const levelKey = String(artifact.level);
    levels[levelKey] ||= blankGroup();
    typeExpected[artifact.type] += 1;
    levels[levelKey].expected += 1;
    types[artifact.type].expected += 1;
    const duration = actual ? Number(actual.durationSeconds || 0) : artifact.durationSeconds;
    const bytes = actual ? Number(actual.bytes || 0) : estimateBytes(duration, bitrateKbps);
    estimatedTotalDurationSeconds += duration;
    estimatedTotalBytes += bytes;
    levels[levelKey].durationSeconds += duration;
    levels[levelKey].estimatedBytes += bytes;
    types[artifact.type].durationSeconds += duration;
    types[artifact.type].estimatedBytes += bytes;
    if (actual) {
      actualCount += 1;
      actualBytes += Number(actual.bytes || 0);
      actualDurationSeconds += Number(actual.durationSeconds || 0);
      typeActual[artifact.type] += 1;
      levels[levelKey].actual += 1;
      types[artifact.type].actual += 1;
    }
  }

  for (const group of [...Object.values(levels), ...Object.values(types)]) {
    group.missing = group.expected - group.actual;
    group.durationSeconds = Math.round(group.durationSeconds * 100) / 100;
  }
  const expectedCount = expected.length;
  return {
    assumptions: {
      bitrateKbps,
      charactersPerSecond,
      leadingSilenceMs,
      trailingSilenceMs,
      sceneGapMs,
      containerOverheadBytesPerArtifact: 512,
    },
    counts: {
      expected: typeExpected,
      actual: actualCount,
      actualByType: typeActual,
      missing: expectedCount - actualCount,
      totalExpected: expectedCount,
    },
    actualBytes,
    actualDurationSeconds: Math.round(actualDurationSeconds * 100) / 100,
    estimatedTotalBytes,
    estimatedTotalDurationSeconds: Math.round(estimatedTotalDurationSeconds * 100) / 100,
    levels,
    types,
  };
}

function loadStages(contentRoot) {
  const stages = [];
  for (let level = 1; level <= 5; level += 1) {
    const directory = path.join(contentRoot, `level-${level}`);
    if (!existsSync(directory)) continue;
    for (const name of readdirSync(directory).filter((value) => /^batch-\d{3}-\d{3}\.json$/.test(value)).sort()) {
      const payload = readJson(path.join(directory, name));
      if (Array.isArray(payload.stages)) stages.push(...payload.stages);
    }
  }
  return stages;
}

function formatBytes(value) {
  const units = ["B", "KiB", "MiB", "GiB"];
  let amount = Number(value);
  let unit = 0;
  while (amount >= 1024 && unit < units.length - 1) {
    amount /= 1024;
    unit += 1;
  }
  return `${amount.toFixed(unit ? 2 : 0)} ${units[unit]}`;
}

function parseArgs(argv) {
  const options = {
    manifest: path.join(toolRoot, "audio", "manifest.json"),
    contentRoot: path.join(toolRoot, "content"),
    bitrateKbps: 64,
    charactersPerSecond: 7.5,
    audioRoot: null,
    json: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--manifest") options.manifest = path.resolve(argv[++index]);
    else if (arg === "--audio-root") options.audioRoot = path.resolve(argv[++index]);
    else if (arg === "--content-root") options.contentRoot = path.resolve(argv[++index]);
    else if (arg === "--bitrate-kbps") options.bitrateKbps = Number(argv[++index]);
    else if (arg === "--characters-per-second") options.charactersPerSecond = Number(argv[++index]);
    else if (arg === "--json") options.json = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!(options.bitrateKbps > 0) || !(options.charactersPerSecond > 0)) {
    throw new Error("bitrate and characters-per-second must be positive");
  }
  return options;
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    const manifest = existsSync(options.manifest) ? readJson(options.manifest) : { items: {} };
    const audioRoot = options.audioRoot || path.dirname(options.manifest);
    const report = estimateAudio({
      manifest,
      stages: loadStages(options.contentRoot),
      bitrateKbps: options.bitrateKbps,
      charactersPerSecond: options.charactersPerSecond,
      audioRoot,
    });
    if (options.json) console.log(JSON.stringify(report, null, 2));
    else {
      console.log(`Audio artifacts: ${report.counts.actual}/${report.counts.totalExpected} present (${report.counts.missing} missing)`);
      console.log(`Current size: ${formatBytes(report.actualBytes)}`);
      console.log(`Estimated completed size: ${formatBytes(report.estimatedTotalBytes)}`);
      console.log(`Estimated completed duration: ${(report.estimatedTotalDurationSeconds / 60).toFixed(1)} minutes`);
      for (const [level, values] of Object.entries(report.levels)) {
        console.log(`Level ${level}: ${values.actual}/${values.expected}, ${formatBytes(values.estimatedBytes)}`);
      }
    }
  } catch (error) {
    console.error(`FAIL: ${error.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(scriptFile)) main();
