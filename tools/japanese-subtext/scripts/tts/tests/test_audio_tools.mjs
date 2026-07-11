import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { estimateAudio } from "../../estimate-audio-size.mjs";
import { validateManifest } from "../../validate-audio.mjs";

const ttsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const audioRoot = path.join(ttsRoot, "audio", ".work", "tests", "node-audio-tools");
const sourceContentHash = "d".repeat(64);
function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
const pronunciationsSha256 = createHash("sha256")
  .update(canonicalJson(JSON.parse(readFileSync(path.join(ttsRoot, "config", "pronunciations.json"), "utf8"))), "utf8")
  .digest("hex");
const modelFilesManifest = JSON.parse(readFileSync(path.join(ttsRoot, "scripts", "tts", "model-files.sha256.json"), "utf8"));
const generator = {
  name: "kokoro-onnx-offline",
  pipelineVersion: "kokoro-ja-mp3-v4",
  executionProvider: "CPUExecutionProvider",
  output: {
    format: "mp3",
    sampleRate: 24000,
    channels: 1,
    bitrate: "64k",
    targetLufs: -18,
    leadingSilenceMs: 60,
    trailingSilenceMs: 100,
    sceneGapMs: 180,
  },
  pronunciationsSha256,
  files: modelFilesManifest.files,
  runtime: modelFilesManifest.runtime,
};

const stage = {
  id: "L1-001",
  level: 1,
  stage: 1,
  contentVersion: "1.0.2",
  contentHash: sourceContentHash,
  audio: {
    sceneAudioId: "L1-001-scene",
    timelineId: "L1-001-timeline",
  },
  lines: [
    {
      id: "line-001",
      audioId: "L1-001-line-001",
      ttsTextJa: "今日はいい天気ですね。",
      pauseAfterMs: 250,
      tokens: [{ id: "token-001", audioId: "L1-001-line-001-token-001", reading: "きょう" }],
    },
    {
      id: "line-002",
      audioId: "L1-001-line-002",
      ttsTextJa: "そうですね。",
      tokens: [{ id: "token-001", audioId: "L1-001-line-002-token-001", reading: "そう" }],
    },
  ],
  questions: [
    {
      id: "q1",
      options: [
        { id: "a", audioId: "L1-001-q1-a", ttsTextJa: "はい" },
        { id: "b", audioId: "L1-001-q1-b", ttsTextJa: "いいえ" },
        { id: "c", audioId: "L1-001-q1-c", ttsTextJa: "たぶん" },
      ],
    },
  ],
};

function item(id, type, relativePath, durationSeconds = 1) {
  const result = {
    id,
    type,
    stageId: "L1-001",
    level: 1,
    voiceKey: type === "scene" ? "mixed" : "female-soft",
    modelVoice: type === "scene" ? ["jf_alpha"] : "jf_alpha",
    path: relativePath,
    contentHash: "a".repeat(64),
    sha256: createHash("sha256").update("mp3").digest("hex"),
    codec: "mp3",
    sampleRate: 24000,
    channels: 1,
    bitrate: 64000,
    durationSeconds,
    bytes: 1000,
  };
  if (type !== "scene") {
    result.readingSha256 = "e".repeat(64);
    result.phonemeSha256 = "f".repeat(64);
  }
  return result;
}

test("validateManifest accepts safe artifacts and a bounded timeline", async () => {
  await mkdir(path.join(audioRoot, "level-1", "L1-001"), { recursive: true });
  await writeFile(path.join(audioRoot, "level-1", "L1-001", "line.mp3"), "mp3");
  await writeFile(path.join(audioRoot, "level-1", "L1-001", "scene.mp3"), "mp3");
  await writeFile(
    path.join(audioRoot, "level-1", "L1-001", "timeline.json"),
    JSON.stringify({
      schemaVersion: 1,
      timelineId: "L1-001-timeline",
      sceneAudioId: "L1-001-scene",
      stageId: "L1-001",
      sampleRate: 24000,
      duration: 1,
      contentHash: "c".repeat(64),
      sourceContentHash,
      cues: [{ lineId: "line-001", audioId: "L1-001-line-001", start: 0.06, end: 0.8 }],
    }),
  );
  const manifest = {
    schemaVersion: 1,
    contentVersion: "1.0.2",
    generatedAt: "2026-07-11T00:00:00Z",
    audioBaseUrl: "https://cdn.example.com/japanese-subtext/audio/",
    generator,
    voices: {},
    items: {
      "L1-001-line-001": item("L1-001-line-001", "line", "level-1/L1-001/line.mp3"),
      "L1-001-scene": {
        ...item("L1-001-scene", "scene", "level-1/L1-001/scene.mp3"),
        contentHash: "c".repeat(64),
      },
    },
    stages: {
      "L1-001": {
        stageId: "L1-001",
        level: 1,
        contentVersion: "1.0.2",
        sceneAudioId: "L1-001-scene",
        timelineId: "L1-001-timeline",
        timelinePath: "level-1/L1-001/timeline.json",
        contentHash: "c".repeat(64),
        sourceContentHash,
        sampleRate: 24000,
        duration: 1,
        cues: [{ lineId: "line-001", audioId: "L1-001-line-001", start: 0.06, end: 0.8 }],
        lineAudioIds: ["L1-001-line-001"],
        optionAudioIds: [],
        tokenAudioIds: [],
      },
    },
    stats: { scene: 1, line: 1, option: 0, token: 0, durationSeconds: 2, bytes: 2000 },
  };
  const lockedStage = {
    id: stage.id,
    contentVersion: stage.contentVersion,
    contentHash: stage.contentHash,
    audio: stage.audio,
    lines: [{ id: "line-001", audioId: "L1-001-line-001" }],
    questions: [],
  };
  const result = validateManifest({ manifest, audioRoot, stages: [lockedStage], skipProbe: true });
  assert.deepEqual(result.errors, []);
  assert.equal(result.stats.items, 2);

  manifest.stages[stage.id].sourceContentHash = "e".repeat(64);
  const stale = validateManifest({ manifest, audioRoot, stages: [lockedStage], skipProbe: true });
  assert.ok(stale.errors.some((error) => error.includes("sourceContentHash does not match locked content")));

  manifest.stages[stage.id].sourceContentHash = sourceContentHash;
  const wrongCue = [{ lineId: "line-wrong", audioId: "L1-001-line-001", start: 0.06, end: 0.8 }];
  manifest.stages[stage.id].cues = wrongCue;
  await writeFile(
    path.join(audioRoot, "level-1", "L1-001", "timeline.json"),
    JSON.stringify({
      schemaVersion: 1,
      timelineId: "L1-001-timeline",
      sceneAudioId: "L1-001-scene",
      stageId: "L1-001",
      sampleRate: 24000,
      duration: 1,
      contentHash: "c".repeat(64),
      sourceContentHash,
      cues: wrongCue,
    }),
  );
  const mislinked = validateManifest({ manifest, audioRoot, stages: [lockedStage], skipProbe: true });
  assert.ok(mislinked.errors.some((error) => error.includes("cue line/audio mapping does not exactly match content order")));

  const orphan = path.join(audioRoot, "level-1", "L1-001", "orphan.mp3");
  await writeFile(orphan, "mp3");
  const withOrphan = validateManifest({ manifest, audioRoot, stages: [lockedStage], skipProbe: true });
  assert.ok(withOrphan.errors.some((error) => error.includes("orphan published MP3")));
  await rm(orphan, { force: true });
});

test("silence checking still runs when ffprobe is skipped", async () => {
  await mkdir(path.join(audioRoot, "level-1", "L1-001"), { recursive: true });
  await writeFile(path.join(audioRoot, "level-1", "L1-001", "line.mp3"), "mp3");
  const manifest = {
    schemaVersion: 1,
    contentVersion: "1.0.2",
    audioBaseUrl: "./",
    generator,
    voices: {},
    items: {
      "L1-001-line-001": item("L1-001-line-001", "line", "level-1/L1-001/line.mp3"),
    },
    stages: {},
    stats: { scene: 0, line: 1, option: 0, token: 0, durationSeconds: 1, bytes: 1000 },
  };
  const result = validateManifest({
    manifest,
    audioRoot,
    stages: [],
    skipProbe: true,
    checkSilence: true,
    ffmpeg: "__missing_ffmpeg_for_test__",
  });
  assert.ok(result.errors.some((error) => error.includes("silence check failed")));

  const nonzero = validateManifest({
    manifest,
    audioRoot,
    stages: [],
    skipProbe: true,
    checkSilence: true,
    ffmpeg: process.execPath,
  });
  assert.ok(nonzero.errors.some((error) => error.includes("silence check failed")));
});

test("validator rejects stale pipelines and missing reading or phoneme provenance", async () => {
  await mkdir(path.join(audioRoot, "level-1", "L1-001"), { recursive: true });
  await writeFile(path.join(audioRoot, "level-1", "L1-001", "line.mp3"), "mp3");
  const unproven = item("L1-001-line-001", "line", "level-1/L1-001/line.mp3");
  delete unproven.readingSha256;
  delete unproven.phonemeSha256;
  const result = validateManifest({
    manifest: {
      schemaVersion: 1,
      contentVersion: "1.0.2",
      audioBaseUrl: "./",
      generator: { ...generator, pipelineVersion: "kokoro-ja-mp3-v3" },
      voices: {},
      items: { [unproven.id]: unproven },
      stages: {},
      stats: { scene: 0, line: 1, option: 0, token: 0, durationSeconds: 1, bytes: 1000 },
    },
    audioRoot,
    stages: [],
    skipProbe: true,
  });
  assert.ok(result.errors.some((error) => error.includes("pipelineVersion")));
  assert.ok(result.errors.some((error) => error.includes("readingSha256")));
  assert.ok(result.errors.some((error) => error.includes("phonemeSha256")));
});

test("validateManifest rejects traversal, duplicate paths, leaked local paths, and bad cues", async () => {
  const manifest = {
    schemaVersion: 1,
    contentVersion: "1.0.2",
    generatedAt: "2026-07-11T00:00:00Z",
    audioBaseUrl: "./",
    generator: { localModel: "F:\\private\\model.onnx" },
    voices: {},
    items: {
      first: item("first", "line", "../secret.mp3"),
      second: item("second", "line", "../secret.mp3"),
    },
    stages: {},
    stats: {},
  };
  const result = validateManifest({ manifest, audioRoot, stages: [], skipProbe: true });
  assert.ok(result.errors.some((error) => error.includes("unsafe path")));
  assert.ok(result.errors.some((error) => error.includes("duplicate path")));
  assert.ok(result.errors.some((error) => error.includes("absolute local path")));
});

test("estimateAudio combines actual artifacts with missing stage estimates", () => {
  const manifest = {
    items: {
      "L1-001-line-001": item("L1-001-line-001", "line", "line.mp3", 2),
    },
  };
  const report = estimateAudio({ manifest, stages: [stage] });
  assert.deepEqual(report.counts.expected, { scene: 1, line: 2, option: 3, token: 2 });
  assert.equal(report.counts.actual, 1);
  assert.equal(report.counts.missing, 7);
  assert.ok(report.estimatedTotalBytes > 1000);
  assert.equal(report.levels["1"].expected, 8);
});
