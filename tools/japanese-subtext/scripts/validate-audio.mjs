import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptFile = fileURLToPath(import.meta.url);
const scriptRoot = path.dirname(scriptFile);
const toolRoot = path.resolve(scriptRoot, "..");

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

function sha256(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function semanticJsonSha256(file) {
  return createHash("sha256").update(canonicalJson(readJson(file)), "utf8").digest("hex");
}

function isSafeRelativePath(value) {
  if (typeof value !== "string" || !value || value.includes("\\")) return false;
  if (path.posix.isAbsolute(value) || /^[A-Za-z]:/.test(value)) return false;
  const segments = value.split("/");
  return segments.every((segment) => segment && segment !== "." && segment !== "..");
}

function artifactPath(audioRoot, relativePath) {
  if (!isSafeRelativePath(relativePath)) return null;
  const root = path.resolve(audioRoot);
  const candidate = path.resolve(root, ...relativePath.split("/"));
  return candidate === root || candidate.startsWith(`${root}${path.sep}`) ? candidate : null;
}

function publishedArtifacts(audioRoot) {
  const root = path.resolve(audioRoot);
  if (!existsSync(root)) return [];
  const found = [];
  const visit = (directory, relative = "") => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (!relative && entry.name === ".work") continue;
      const childRelative = relative ? `${relative}/${entry.name}` : entry.name;
      const child = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(child, childRelative);
      else if (entry.isFile() && childRelative !== "manifest.json") found.push(childRelative);
    }
  };
  visit(root);
  return found;
}

function probe(file, executable) {
  const result = spawnSync(
    executable,
    [
      "-v", "error",
      "-select_streams", "a:0",
      "-show_entries", "stream=codec_name,sample_rate,channels,bit_rate:format=duration,size,bit_rate",
      "-of", "json",
      file,
    ],
    { encoding: "utf8", windowsHide: true },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error((result.stderr || result.stdout || "ffprobe failed").trim());
  const payload = JSON.parse(result.stdout);
  const stream = payload.streams?.[0];
  if (!stream) throw new Error("no audio stream");
  return {
    codec: stream.codec_name,
    sampleRate: Number(stream.sample_rate || 0),
    channels: Number(stream.channels || 0),
    bitrate: Number(stream.bit_rate || payload.format?.bit_rate || 0),
    durationSeconds: Number(payload.format?.duration || 0),
    bytes: Number(payload.format?.size || statSync(file).size),
  };
}

function meanVolume(file, executable) {
  const result = spawnSync(
    executable,
    ["-hide_banner", "-nostats", "-i", file, "-af", "volumedetect", "-f", "null", "-"],
    { encoding: "utf8", windowsHide: true },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || "ffmpeg failed").trim());
  }
  const match = String(result.stderr || "").match(/mean_volume:\s*(-?inf|-?[0-9.]+)\s*dB/i);
  if (!match) throw new Error("ffmpeg did not report mean_volume");
  return match[1].toLowerCase() === "-inf" ? -Infinity : Number(match[1]);
}

function checkTimeline({ timeline, stageId, stageEntry, manifest, errors }) {
  const prefix = `${stageId} timeline`;
  if (timeline?.schemaVersion !== 1) errors.push(`${prefix}: schemaVersion must be 1`);
  if (timeline?.stageId !== stageId) errors.push(`${prefix}: stageId mismatch`);
  if (timeline?.timelineId !== stageEntry.timelineId) errors.push(`${prefix}: timelineId mismatch`);
  if (timeline?.sceneAudioId !== stageEntry.sceneAudioId) errors.push(`${prefix}: sceneAudioId mismatch`);
  if (timeline?.contentHash !== stageEntry.contentHash) errors.push(`${prefix}: contentHash mismatch`);
  if (timeline?.sourceContentHash !== stageEntry.sourceContentHash) errors.push(`${prefix}: sourceContentHash mismatch`);
  if (stageEntry.sampleRate !== timeline?.sampleRate) errors.push(`${prefix}: embedded sampleRate is stale`);
  if (Math.abs(Number(stageEntry.duration) - Number(timeline?.duration)) > 0.000001) {
    errors.push(`${prefix}: embedded duration is stale`);
  }
  if (JSON.stringify(stageEntry.cues) !== JSON.stringify(timeline?.cues)) {
    errors.push(`${prefix}: embedded cues are stale`);
  }
  if (!Number.isFinite(timeline?.duration) || timeline.duration <= 0) {
    errors.push(`${prefix}: duration must be positive`);
  }
  if (!Array.isArray(timeline?.cues)) {
    errors.push(`${prefix}: cues must be an array`);
    return;
  }
  let previousEnd = 0;
  const seenLines = new Set();
  const seenAudioIds = new Set();
  for (const [index, cue] of timeline.cues.entries()) {
    const label = `${prefix} cue ${index + 1}`;
    if (seenLines.has(cue.lineId)) errors.push(`${label}: duplicate lineId ${cue.lineId}`);
    seenLines.add(cue.lineId);
    if (seenAudioIds.has(cue.audioId)) errors.push(`${label}: duplicate audioId ${cue.audioId}`);
    seenAudioIds.add(cue.audioId);
    if (!stageEntry.lineAudioIds?.includes(cue.audioId)) errors.push(`${label}: audioId is not a stage line`);
    if (manifest.items?.[cue.audioId]?.type !== "line") errors.push(`${label}: missing line manifest item ${cue.audioId}`);
    if (!Number.isFinite(cue.start) || !Number.isFinite(cue.end) || cue.start < 0 || cue.end <= cue.start) {
      errors.push(`${label}: invalid start/end`);
      continue;
    }
    if (cue.start + 0.000001 < previousEnd) errors.push(`${label}: overlaps the previous cue`);
    if (Number.isFinite(timeline.duration) && cue.end > timeline.duration + 0.001) {
      errors.push(`${label}: exceeds timeline duration`);
    }
    previousEnd = cue.end;
  }
  if (timeline.cues.length !== (stageEntry.lineAudioIds?.length || 0)) {
    errors.push(`${prefix}: cue count does not match lineAudioIds`);
  }
  const scene = manifest.items?.[stageEntry.sceneAudioId];
  if (scene && Number.isFinite(timeline.duration) && Math.abs(scene.durationSeconds - timeline.duration) > 0.25) {
    errors.push(`${prefix}: duration differs from scene MP3 by more than 0.25s`);
  }
}

export function validateManifest({
  manifest,
  audioRoot,
  stages = [],
  skipProbe = false,
  ffprobe = "ffprobe",
  checkSilence = false,
  ffmpeg = "ffmpeg",
} = {}) {
  const errors = [];
  const warnings = [];
  const items = manifest?.items && typeof manifest.items === "object" ? manifest.items : {};
  const stageEntries = manifest?.stages && typeof manifest.stages === "object" ? manifest.stages : {};
  const allowedTypes = new Set(["scene", "line", "option", "token"]);
  const paths = new Map();

  if (manifest?.schemaVersion !== 1) errors.push("manifest schemaVersion must be 1");
  if (typeof manifest?.contentVersion !== "string") errors.push("manifest contentVersion is missing");
  if (typeof manifest?.audioBaseUrl !== "string") errors.push("manifest audioBaseUrl is missing");
  if (manifest?.generator?.executionProvider !== "CPUExecutionProvider") {
    errors.push("generator executionProvider must remain CPUExecutionProvider");
  }
  const expectedOutput = {
    format: "mp3",
    sampleRate: 24000,
    channels: 1,
    bitrate: "64k",
    targetLufs: -18,
    leadingSilenceMs: 60,
    trailingSilenceMs: 100,
    sceneGapMs: 180,
  };
  for (const [key, value] of Object.entries(expectedOutput)) {
    if (manifest?.generator?.output?.[key] !== value) errors.push(`generator output.${key} must be ${JSON.stringify(value)}`);
  }
  const pronunciationsFile = path.join(toolRoot, "config", "pronunciations.json");
  const expectedPronunciationsSha256 = semanticJsonSha256(pronunciationsFile);
  if (manifest?.generator?.pronunciationsSha256 !== expectedPronunciationsSha256) {
    errors.push("generator pronunciationsSha256 does not match the published pronunciation table");
  }
  if (!manifest?.items || typeof manifest.items !== "object" || Array.isArray(manifest.items)) {
    errors.push("manifest items must be an object");
  }
  if (!manifest?.stages || typeof manifest.stages !== "object" || Array.isArray(manifest.stages)) {
    errors.push("manifest stages must be an object");
  }
  const serialized = JSON.stringify(manifest);
  if (/(?:^|["'\s])(?:[A-Za-z]:[\\/]|file:\/\/|\\\\[^\\])/i.test(serialized)) {
    errors.push("manifest contains an absolute local path");
  }

  for (const [id, item] of Object.entries(items)) {
    const prefix = `item ${id}`;
    if (!item || typeof item !== "object") {
      errors.push(`${prefix}: must be an object`);
      continue;
    }
    if (item.id !== id) errors.push(`${prefix}: embedded id mismatch`);
    if (!allowedTypes.has(item.type)) errors.push(`${prefix}: invalid type ${item.type}`);
    if (!/^L[1-5]-[0-9]{3}$/.test(item.stageId || "")) errors.push(`${prefix}: invalid stageId`);
    if (!Number.isInteger(item.level) || item.level < 1 || item.level > 5) errors.push(`${prefix}: invalid level`);
    if (!/^[a-f0-9]{64}$/.test(item.contentHash || "")) errors.push(`${prefix}: invalid contentHash`);
    if (!/^[a-f0-9]{64}$/.test(item.sha256 || "")) errors.push(`${prefix}: invalid sha256`);
    if (item.codec !== "mp3") errors.push(`${prefix}: codec must be mp3`);
    if (item.sampleRate !== 24000) errors.push(`${prefix}: sampleRate must be 24000`);
    if (item.channels !== 1) errors.push(`${prefix}: channels must be 1`);
    if (!Number.isFinite(item.bitrate) || item.bitrate < 56000 || item.bitrate > 72000) {
      errors.push(`${prefix}: bitrate must be approximately 64kbps`);
    }
    if (!Number.isFinite(item.durationSeconds) || item.durationSeconds <= 0) errors.push(`${prefix}: invalid durationSeconds`);
    if (!Number.isInteger(item.bytes) || item.bytes <= 0) errors.push(`${prefix}: invalid bytes`);
    if (!isSafeRelativePath(item.path)) errors.push(`${prefix}: unsafe path ${JSON.stringify(item.path)}`);
    if (paths.has(item.path)) errors.push(`${prefix}: duplicate path also used by ${paths.get(item.path)}`);
    else paths.set(item.path, id);

    const file = artifactPath(audioRoot, item.path);
    if (!file) continue;
    if (!existsSync(file) || !statSync(file).isFile() || statSync(file).size <= 0) {
      errors.push(`${prefix}: file is missing or empty`);
      continue;
    }
    if (sha256(file) !== item.sha256) errors.push(`${prefix}: sha256 differs from manifest`);
    if (!skipProbe) {
      try {
        const actual = probe(file, ffprobe);
        if (actual.codec !== "mp3") errors.push(`${prefix}: probed codec is ${actual.codec}`);
        if (actual.sampleRate !== 24000) errors.push(`${prefix}: probed sample rate is ${actual.sampleRate}`);
        if (actual.channels !== 1) errors.push(`${prefix}: probed channel count is ${actual.channels}`);
        if (actual.bitrate < 56000 || actual.bitrate > 72000) errors.push(`${prefix}: probed bitrate is ${actual.bitrate}`);
        if (actual.durationSeconds <= 0) errors.push(`${prefix}: probed duration is not positive`);
        if (Math.abs(actual.durationSeconds - item.durationSeconds) > 0.02) errors.push(`${prefix}: duration differs from manifest`);
        if (actual.bytes !== item.bytes) errors.push(`${prefix}: byte count differs from manifest`);
      } catch (error) {
        errors.push(`${prefix}: ffprobe failed: ${error.message}`);
      }
    }
    if (checkSilence) {
      try {
        const volume = meanVolume(file, ffmpeg);
        if (!Number.isFinite(volume) || volume < -55) errors.push(`${prefix}: audio is silent or nearly silent (${volume} dB)`);
      } catch (error) {
        errors.push(`${prefix}: silence check failed: ${error.message}`);
      }
    }
  }

  for (const [stageId, stageEntry] of Object.entries(stageEntries)) {
    const prefix = `stage ${stageId}`;
    if (!stageEntry || typeof stageEntry !== "object") {
      errors.push(`${prefix}: manifest entry must be an object`);
      continue;
    }
    if (stageEntry.stageId !== stageId) errors.push(`${prefix}: embedded stageId mismatch`);
    if (typeof stageEntry.contentVersion !== "string") errors.push(`${prefix}: contentVersion is missing`);
    if (!/^[a-f0-9]{64}$/.test(stageEntry.sourceContentHash || "")) {
      errors.push(`${prefix}: sourceContentHash must be a SHA-256 hash`);
    }
    if (!Array.isArray(stageEntry.cues)) errors.push(`${prefix}: cues must be an array`);
    const sceneItem = items[stageEntry.sceneAudioId];
    if (sceneItem?.type !== "scene") errors.push(`${prefix}: missing scene item`);
    else {
      if (sceneItem.stageId !== stageId) errors.push(`${prefix}: scene item belongs to another stage`);
      if (sceneItem.contentHash !== stageEntry.contentHash) errors.push(`${prefix}: scene contentHash mismatch`);
    }
    if (!isSafeRelativePath(stageEntry.timelinePath)) errors.push(`${prefix}: unsafe timeline path`);
    for (const [field, type] of [
      ["lineAudioIds", "line"],
      ["optionAudioIds", "option"],
      ["tokenAudioIds", "token"],
    ]) {
      if (!Array.isArray(stageEntry[field])) {
        errors.push(`${prefix}: ${field} must be an array`);
        continue;
      }
      if (new Set(stageEntry[field]).size !== stageEntry[field].length) errors.push(`${prefix}: ${field} contains duplicates`);
      for (const audioId of stageEntry[field]) {
        if (items[audioId]?.type !== type || items[audioId]?.stageId !== stageId) {
          errors.push(`${prefix}: invalid ${field} reference ${audioId}`);
        }
      }
    }
    const timelineFile = artifactPath(audioRoot, stageEntry.timelinePath);
    if (!timelineFile || !existsSync(timelineFile)) {
      errors.push(`${prefix}: timeline file is missing`);
      continue;
    }
    try {
      checkTimeline({ timeline: readJson(timelineFile), stageId, stageEntry, manifest, errors });
    } catch (error) {
      errors.push(`${prefix}: timeline JSON failed: ${error.message}`);
    }
  }

  const timelinePaths = new Set(Object.values(stageEntries).map((entry) => entry?.timelinePath).filter(isSafeRelativePath));
  for (const relative of publishedArtifacts(audioRoot)) {
    if (relative.endsWith(".mp3")) {
      if (!paths.has(relative)) errors.push(`orphan published MP3 ${relative}`);
    } else if (relative.endsWith("/timeline.json")) {
      if (!timelinePaths.has(relative)) errors.push(`orphan published timeline ${relative}`);
    } else {
      errors.push(`unexpected published audio artifact ${relative}`);
    }
  }

  const contentAudioIds = new Set();
  for (const stage of stages) {
    const expectedByType = {
      scene: [stage.audio?.sceneAudioId].filter(Boolean),
      line: (stage.lines || []).map((line) => line.audioId),
      token: (stage.lines || []).flatMap((line) => (line.tokens || []).map((token) => token.audioId)),
      option: (stage.questions || []).flatMap((question) => (question.options || []).map((option) => option.audioId)),
    };
    const expected = Object.values(expectedByType).flat();
    expected.forEach((id) => contentAudioIds.add(id));
    const stageEntry = stageEntries[stage.id];
    if (!stageEntry) errors.push(`content stage ${stage.id}: missing manifest stage entry`);
    for (const id of expected) if (!items[id]) errors.push(`content stage ${stage.id}: missing item ${id}`);
    if (stageEntry) {
      for (const [field, type] of [["lineAudioIds", "line"], ["optionAudioIds", "option"], ["tokenAudioIds", "token"]]) {
        const actual = [...(stageEntry[field] || [])].sort();
        const wanted = [...expectedByType[type]].sort();
        if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
          errors.push(`content stage ${stage.id}: ${field} does not exactly match content`);
        }
      }
      if (stageEntry.sceneAudioId !== stage.audio?.sceneAudioId) {
        errors.push(`content stage ${stage.id}: sceneAudioId does not match content`);
      }
      if (stageEntry.contentVersion !== stage.contentVersion) {
        errors.push(`content stage ${stage.id}: contentVersion does not match`);
      }
      if (stageEntry.sourceContentHash !== stage.contentHash) {
        errors.push(`content stage ${stage.id}: sourceContentHash does not match locked content`);
      }
      const actualCueLinks = (stageEntry.cues || []).map((cue) => [cue.lineId, cue.audioId]);
      const expectedCueLinks = (stage.lines || []).map((line) => [line.id, line.audioId]);
      if (JSON.stringify(actualCueLinks) !== JSON.stringify(expectedCueLinks)) {
        errors.push(`content stage ${stage.id}: cue line/audio mapping does not exactly match content order`);
      }
    }
  }
  if (stages.length) {
    for (const [id, item] of Object.entries(items)) {
      if (!contentAudioIds.has(id)) errors.push(`orphan manifest item ${id} (${item.stageId || "unknown stage"})`);
    }
    for (const stageId of Object.keys(stageEntries)) {
      if (!stages.some((stage) => stage.id === stageId)) errors.push(`orphan manifest stage ${stageId}`);
    }
  }

  const typeCounts = { scene: 0, line: 0, option: 0, token: 0 };
  let durationSeconds = 0;
  let bytes = 0;
  for (const item of Object.values(items)) {
    if (typeCounts[item.type] !== undefined) typeCounts[item.type] += 1;
    durationSeconds += Number(item.durationSeconds || 0);
    bytes += Number(item.bytes || 0);
  }
  const expectedStats = { ...typeCounts, durationSeconds: Math.round(durationSeconds * 1000) / 1000, bytes };
  if (manifest?.stats && Object.keys(items).length > 0) {
    for (const type of Object.keys(typeCounts)) {
      if (manifest.stats[type] !== expectedStats[type]) errors.push(`manifest stats.${type} is stale`);
    }
    if (manifest.stats.bytes !== bytes) errors.push("manifest stats.bytes is stale");
    if (Math.abs(Number(manifest.stats.durationSeconds) - expectedStats.durationSeconds) > 0.001) {
      errors.push("manifest stats.durationSeconds is stale");
    }
  }

  if (!Object.keys(items).length) warnings.push("audio manifest is empty; there are no artifacts to probe");
  return {
    ok: errors.length === 0,
    errors,
    warnings,
    stats: { items: Object.keys(items).length, stages: Object.keys(stageEntries).length, ...expectedStats },
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

function parseArgs(argv) {
  const options = {
    manifest: path.join(toolRoot, "audio", "manifest.json"),
    audioRoot: path.join(toolRoot, "audio"),
    contentRoot: path.join(toolRoot, "content"),
    ffprobe: "ffprobe",
    ffmpeg: "ffmpeg",
    skipProbe: false,
    checkSilence: false,
    json: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--manifest") options.manifest = path.resolve(argv[++index]);
    else if (arg === "--audio-root") options.audioRoot = path.resolve(argv[++index]);
    else if (arg === "--content-root") options.contentRoot = path.resolve(argv[++index]);
    else if (arg === "--ffprobe") options.ffprobe = argv[++index];
    else if (arg === "--ffmpeg") options.ffmpeg = argv[++index];
    else if (arg === "--skip-probe") options.skipProbe = true;
    else if (arg === "--check-silence") options.checkSilence = true;
    else if (arg === "--json") options.json = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  const localConfig = path.join(toolRoot, "config", "tts.local.json");
  if (existsSync(localConfig)) {
    const config = readJson(localConfig);
    if (options.ffprobe === "ffprobe" && config.ffprobe) options.ffprobe = config.ffprobe;
    if (options.ffmpeg === "ffmpeg" && config.ffmpeg) options.ffmpeg = config.ffmpeg;
  }
  return options;
}

function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
    const result = validateManifest({
      manifest: readJson(options.manifest),
      audioRoot: options.audioRoot,
      stages: loadStages(options.contentRoot),
      skipProbe: options.skipProbe,
      ffprobe: options.ffprobe,
      checkSilence: options.checkSilence,
      ffmpeg: options.ffmpeg,
    });
    if (options.json) console.log(JSON.stringify(result, null, 2));
    else {
      if (result.ok) console.log(`PASS: ${result.stats.items} audio artifacts across ${result.stats.stages} stages are valid.`);
      else {
        console.error(`FAIL: audio validation found ${result.errors.length} error(s):`);
        for (const error of result.errors) console.error(`- ${error}`);
      }
      for (const warning of result.warnings) console.warn(`WARN: ${warning}`);
    }
    if (!result.ok) process.exitCode = 1;
  } catch (error) {
    console.error(`FAIL: ${error.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(scriptFile)) main();
