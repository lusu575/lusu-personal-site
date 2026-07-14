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
  name: "aivisspeech-engine-local-ai",
  pipelineVersion: "aivisspeech-1.2.0-aivmx-v3",
  claritySchemaVersion: 3,
  ratePolicy: {
    policy: "post-synthesis-active-mora-rate-v3",
    targetMoraPerSecond: 6.5,
    maximumCalibratedMoraPerSecond: 6.6,
    maximumMoraPerSecond: 7.2,
    maximumCalibrationAttempts: 6,
  },
  executionProvider: "CPU",
  output: {
    format: "mp3",
    sampleRate: 44100,
    channels: 1,
    bitrate: "96k",
    targetLufs: -18,
    leadingSilenceMs: 60,
    trailingSilenceMs: 100,
    sceneGapMs: 180,
  },
  pronunciationsSha256,
  engine: { name: modelFilesManifest.engine.name, version: modelFilesManifest.engine.version },
  models: modelFilesManifest.models.map(({ source: _source, ...model }) => model),
  license: "ACML-1.0",
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
  const baseClarity = {
    leadingSilenceMs: 60,
    trailingSilenceMs: 100,
    voicedDurationSeconds: 0.5,
    speechRateDurationSeconds: 0.5,
    speechRateDurationPolicy: "exclude-long-internal-pauses-v1",
    excludedSpeechPauseMs: 0,
    speechPauseThresholdMs: 250,
    peakDbfs: -3,
    rmsDbfs: -18,
    noiseFloorDbfs: -70,
    crestFactorDb: 15,
    clippingSampleRatio: 0,
    tailEnergyRatio: 0.8,
    activityIslandCount: 1,
    longestInternalSilenceMs: 0,
    finalActivityIslandMs: 500,
    finalInternalSilenceMs: 0,
    expectedSokuonClosure: false,
    detachedTailGapThresholdMs: 180,
    detachedTailCheckEnabled: type !== "scene",
    detachedTailObserved: false,
    detachedTailRisk: false,
    truncationRisk: false,
    integratedLufs: -18.2,
    truePeakDbtp: -2.5,
    loudnessRangeLu: 0.2,
    loudnessMeasurementMode: "integrated-lufs",
    targetLufs: -18,
    loudnessErrorLufs: 0.2,
    loudnessToleranceLufs: 1.5,
    loudnessPass: true,
    pass: true,
  };
  const result = {
    id,
    type,
    stageId: "L1-001",
    level: 1,
    voiceKey: type === "scene" ? "mixed" : "female-soft",
    modelVoice: type === "scene" ? ["model:normal"] : "model:normal",
    path: relativePath,
    contentHash: "a".repeat(64),
    sha256: createHash("sha256").update("mp3").digest("hex"),
    claritySchemaVersion: 3,
    clarityAudit: baseClarity,
    codec: "mp3",
    sampleRate: 44100,
    channels: 1,
    bitrate: 96000,
    durationSeconds,
    bytes: 1000,
  };
  if (type !== "scene") {
    Object.assign(result.clarityAudit, {
      speechRateMoraPerSecond: 4,
      spokenMoraCount: 2,
      speechRateBand: "short",
      speechRateMinimum: 1.5,
      speechRateMaximum: 7.2,
      speechRatePass: true,
    });
    result.readingSha256 = "e".repeat(64);
    result.phonemeSha256 = "f".repeat(64);
    result.moraSha256 = "1".repeat(64);
    result.querySha256 = "2".repeat(64);
    result.queryParameters = { speedScale: 0.88, kanaSource: "surface" };
    result.ratePolicy = { ...generator.ratePolicy };
    result.readingKana = "きょう";
    result.sourceBoundaryAudit = {
      schemaVersion: 1,
      claritySchemaVersion: 3,
      artifactHash: result.contentHash,
      normalizedSha256: "3".repeat(64),
      raw: {
        boundaryKind: "raw",
        leadingSilenceMs: 80,
        trailingSilenceMs: 120,
        absoluteActiveSpanMs: 820,
        activeSpanMs: 500,
        peakDbfs: -3,
        boundaryThresholdDbfs: -50,
        activeSpanThresholdDbfs: -43,
        activeSpanDbBelowPeak: 40,
        clippingSampleRatio: 0,
        edgeClippingSampleRatio: 0,
        minimumLeadingSilenceMs: 15,
        minimumTrailingSilenceMs: 30,
        truncationRisk: false,
        pass: true,
      },
      normalized: {
        boundaryKind: "normalized",
        leadingSilenceMs: 0,
        trailingSilenceMs: 22,
        absoluteActiveSpanMs: 490,
        activeSpanMs: 490,
        peakDbfs: -2,
        boundaryThresholdDbfs: -50,
        activeSpanThresholdDbfs: -42,
        activeSpanDbBelowPeak: 40,
        clippingSampleRatio: 0,
        edgeClippingSampleRatio: 0,
        rawActiveSpanMs: 500,
        activeSpanRatio: 0.98,
        minimumActiveSpanRatio: 0.65,
        maximumActiveSpanRatio: 1.35,
        activeSpanCollapseRisk: false,
        edgeClippingRisk: false,
        pass: true,
      },
      pass: true,
    };
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
      sampleRate: 44100,
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
        sampleRate: 44100,
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
      sampleRate: 44100,
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

test("validator rejects stale pipelines and missing Aivis clarity or pronunciation provenance", async () => {
  await mkdir(path.join(audioRoot, "level-1", "L1-001"), { recursive: true });
  await writeFile(path.join(audioRoot, "level-1", "L1-001", "line.mp3"), "mp3");
  const unproven = item("L1-001-line-001", "line", "level-1/L1-001/line.mp3");
  delete unproven.readingSha256;
  delete unproven.phonemeSha256;
  delete unproven.moraSha256;
  delete unproven.querySha256;
  delete unproven.sourceBoundaryAudit;
  delete unproven.claritySchemaVersion;
  delete unproven.ratePolicy;
  const result = validateManifest({
    manifest: {
      schemaVersion: 1,
      contentVersion: "1.0.2",
      audioBaseUrl: "./",
      generator: { ...generator, pipelineVersion: "aivisspeech-1.2.0-aivmx-v1" },
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
  assert.ok(result.errors.some((error) => error.includes("moraSha256")));
  assert.ok(result.errors.some((error) => error.includes("querySha256")));
  assert.ok(result.errors.some((error) => error.includes("sourceBoundaryAudit")));
  assert.ok(result.errors.some((error) => error.includes("claritySchemaVersion")));
  assert.ok(result.errors.some((error) => error.includes("ratePolicy")));
});

test("validator rejects a stale rate policy even on unadjusted teaching audio", async () => {
  await mkdir(path.join(audioRoot, "level-1", "L1-001"), { recursive: true });
  await writeFile(path.join(audioRoot, "level-1", "L1-001", "line.mp3"), "mp3");
  const stale = item("L1-001-line-001", "line", "level-1/L1-001/line.mp3");
  stale.ratePolicy = { ...stale.ratePolicy, targetMoraPerSecond: 7.0 };
  const staleGenerator = {
    ...generator,
    ratePolicy: { ...generator.ratePolicy, maximumCalibrationAttempts: 3 },
  };

  const result = validateManifest({
    manifest: {
      schemaVersion: 1,
      contentVersion: "1.0.2",
      audioBaseUrl: "./",
      generator: staleGenerator,
      voices: {},
      items: { [stale.id]: stale },
      stages: {},
      stats: { scene: 0, line: 1, option: 0, token: 0, durationSeconds: 1, bytes: 1000 },
    },
    audioRoot,
    stages: [],
    skipProbe: true,
  });

  assert.ok(result.errors.some((error) => error.includes("generator ratePolicy")));
  assert.ok(result.errors.some((error) => error.includes("item L1-001-line-001: ratePolicy")));
});

test("validator accepts only the natural one-mora hesitation rate band", async (t) => {
  const hesitationRoot = path.join(audioRoot, "level-4", "L4-001");
  t.after(() => rm(hesitationRoot, { recursive: true, force: true }));
  await mkdir(hesitationRoot, { recursive: true });
  await writeFile(path.join(hesitationRoot, "hesitation.mp3"), "mp3");
  const hesitation = item(
    "L4-001-line-004",
    "line",
    "level-4/L4-001/hesitation.mp3",
  );
  hesitation.stageId = "L4-001";
  hesitation.level = 4;
  hesitation.readingKana = "ん……。";
  Object.assign(hesitation.clarityAudit, {
    voicedDurationSeconds: 0.714444,
    speechRateDurationSeconds: 0.714444,
    speechRateMoraPerSecond: 1.39969,
    spokenMoraCount: 1,
    speechRateBand: "hesitation",
    speechRateMinimum: 1.2,
    speechRateMaximum: 7.2,
    speechRatePass: true,
    pass: true,
  });
  const manifest = {
    schemaVersion: 1,
    contentVersion: "1.0.2",
    audioBaseUrl: "./",
    generator,
    voices: {},
    items: { [hesitation.id]: hesitation },
    stages: {},
    stats: { scene: 0, line: 1, option: 0, token: 0, durationSeconds: 1, bytes: 1000 },
  };

  const accepted = validateManifest({ manifest, audioRoot, stages: [], skipProbe: true });
  assert.ok(!accepted.errors.some((error) => error.includes("speech-rate band")));

  hesitation.clarityAudit.speechRateBand = "short";
  hesitation.clarityAudit.speechRateMinimum = 1.5;
  const staleBand = validateManifest({ manifest, audioRoot, stages: [], skipProbe: true });
  assert.ok(staleBand.errors.some((error) => error.includes("speech-rate band")));

  hesitation.clarityAudit.speechRateBand = "hesitation";
  hesitation.clarityAudit.speechRateMinimum = 1.2;
  hesitation.clarityAudit.speechRateMoraPerSecond = 1.1;
  hesitation.clarityAudit.speechRatePass = true;
  const tooSlow = validateManifest({ manifest, audioRoot, stages: [], skipProbe: true });
  assert.ok(tooSlow.errors.some((error) => error.includes("below its speech-rate minimum")));

  hesitation.readingKana = "め。";
  hesitation.clarityAudit.speechRateMoraPerSecond = 1.39969;
  hesitation.clarityAudit.speechRateBand = "hesitation";
  hesitation.clarityAudit.speechRateMinimum = 1.2;
  const ordinaryWord = validateManifest({ manifest, audioRoot, stages: [], skipProbe: true });
  assert.ok(ordinaryWord.errors.some((error) => error.includes("speech-rate band")));

  const lockedStage = {
    id: "L4-001",
    contentVersion: "1.0.2",
    contentHash: "d".repeat(64),
    audio: { sceneAudioId: "L4-001-scene", timelineId: "L4-001-timeline" },
    lines: [{ id: "line-004", audioId: hesitation.id, readingJa: "あ。", tokens: [] }],
    questions: [],
  };
  hesitation.readingKana = "ん。";
  hesitation.readingSha256 = createHash("sha256").update("ん。", "utf8").digest("hex");
  const forgedReading = validateManifest({ manifest, audioRoot, stages: [lockedStage], skipProbe: true });
  assert.ok(forgedReading.errors.some((error) => error.includes("readingKana does not match locked content")));
  assert.ok(forgedReading.errors.some((error) => error.includes("readingSha256 does not match locked content")));
});

test("validator enforces the 7.2 mora ceiling and audited integrated loudness", async () => {
  await mkdir(path.join(audioRoot, "level-1", "L1-001"), { recursive: true });
  await writeFile(path.join(audioRoot, "level-1", "L1-001", "line.mp3"), "mp3");
  const fast = item("L1-001-line-001", "line", "level-1/L1-001/line.mp3");
  fast.clarityAudit.speechRateMoraPerSecond = 7.21;
  fast.clarityAudit.speechRatePass = true;
  fast.rateAdjustment = {
    policy: "unknown-policy",
    baseArtifactHash: "4".repeat(64),
    baseQuerySha256: "5".repeat(64),
    configuredSpeedScale: 0.88,
    adjustedSpeedScale: 0.77,
    observedMoraPerSecond: 8,
    maximumMoraPerSecond: 7.2,
    targetMoraPerSecond: 6.5,
  };
  fast.postProcessing = { profile: "unknown-profile" };
  fast.loudnessCorrection = { gainDb: 4.501, limiterRequired: true };
  fast.clarityAudit.truePeakDbtp = -1.0;
  delete fast.clarityAudit.integratedLufs;
  const result = validateManifest({
    manifest: {
      schemaVersion: 1,
      contentVersion: "1.0.2",
      audioBaseUrl: "./",
      generator,
      voices: {},
      items: { [fast.id]: fast },
      stages: {},
      stats: { scene: 0, line: 1, option: 0, token: 0, durationSeconds: 1, bytes: 1000 },
    },
    audioRoot,
    stages: [],
    skipProbe: true,
  });
  assert.ok(result.errors.some((error) => error.includes("integratedLufs")));
  assert.ok(result.errors.some((error) => error.includes("7.2 mora/s")));
  assert.ok(result.errors.some((error) => error.includes("speech-rate evidence")));
  assert.ok(result.errors.some((error) => error.includes("rateAdjustment")));
  assert.ok(result.errors.some((error) => error.includes("postProcessing")));
  assert.ok(result.errors.some((error) => error.includes("4.5 dB")));
  assert.ok(result.errors.some((error) => error.includes("true peak")));
});

test("validator accepts a recoverable adjustment triggered by a 7.199 baseline", async () => {
  await mkdir(path.join(audioRoot, "level-1", "L1-001"), { recursive: true });
  await writeFile(path.join(audioRoot, "level-1", "L1-001", "line.mp3"), "mp3");
  const adjusted = item("L1-001-line-001", "line", "level-1/L1-001/line.mp3");
  const configuredSpeedScale = 0.88;
  const observedMoraPerSecond = 7.199;
  const adjustedSpeedScale = Math.floor(
    configuredSpeedScale * 6.5 / observedMoraPerSecond * 1e6,
  ) / 1e6;
  adjusted.clarityAudit.speechRateMoraPerSecond = 7.19;
  adjusted.queryParameters = {
    ...adjusted.queryParameters,
    speedScale: adjustedSpeedScale,
    configuredSpeedScale,
    rateAdjustmentPolicy: "post-synthesis-active-mora-rate-v3",
    maximumMoraPerSecond: 7.2,
    targetMoraPerSecond: 6.5,
  };
  adjusted.rateAdjustment = {
    policy: "post-synthesis-active-mora-rate-v3",
    baseArtifactHash: "4".repeat(64),
    baseQuerySha256: "5".repeat(64),
    configuredSpeedScale,
    calibrationSpeedScale: configuredSpeedScale,
    adjustedSpeedScale,
    observedMoraPerSecond,
    maximumMoraPerSecond: 7.2,
    targetMoraPerSecond: 6.5,
  };

  const result = validateManifest({
    manifest: {
      schemaVersion: 1,
      contentVersion: "1.0.2",
      audioBaseUrl: "./",
      generator,
      voices: {},
      items: { [adjusted.id]: adjusted },
      stages: {},
      stats: { scene: 0, line: 1, option: 0, token: 0, durationSeconds: 1, bytes: 1000 },
    },
    audioRoot,
    stages: [],
    skipProbe: true,
  });

  assert.ok(!result.errors.some((error) => error.includes("rateAdjustment")));
});

test("build check locks the current Aivis v3 release contract", () => {
  const buildCheck = readFileSync(path.resolve(ttsRoot, "../..", "scripts", "build-check.mjs"), "utf8");
  for (const required of [
    "aivisspeech-1.2.0-aivmx-v3",
    "aivisspeech-engine-local-ai",
    "audited-loudness-gain-v3",
    "claritySchemaVersion",
    "integratedLufs",
    "speechRateMaximum",
    "expectedAudioRatePolicy",
    "maximumCalibratedMoraPerSecond",
    "maximumCalibrationAttempts",
    "reviewedReadingByAudioId",
    "sourceBoundaryAudit",
    "kanaSource",
    "reviewed-reading-fallback",
    ".boundary.json",
    "outputSamplingRate",
    "outputStereo",
    "44100",
    'bitrate: "96k"',
  ]) {
    assert.ok(buildCheck.includes(required), `build-check must require ${required}`);
  }
  for (const stale of [
    "kokoro-ja-mp3-v4",
    "kokoro-onnx-offline",
    "CPUExecutionProvider",
    "jf_alpha",
    "jf_gongitsune",
    "jf_nezumi",
    "jf_tebukuro",
    "jm_kumo",
    "audited-loudness-gain-v1",
  ]) {
    assert.ok(!buildCheck.includes(stale), `build-check must not retain current Kokoro contract ${stale}`);
  }
  assert.ok(
    buildCheck.includes(
      "rateAdjustment.observedMoraPerSecond > rateAdjustment.targetMoraPerSecond",
    ),
    "build-check must bind preventive adjustments to the 6.5 mora/s headroom target",
  );
  assert.ok(!buildCheck.includes("rateAdjustment.observedMoraPerSecond > 7.2"));
});

test("formal release check runs the Python TTS regression suite", () => {
  const packageJson = JSON.parse(
    readFileSync(path.resolve(ttsRoot, "../..", "package.json"), "utf8"),
  );
  assert.equal(
    packageJson.scripts["jp-subtext:test:tts-python"],
    "node tools/japanese-subtext/scripts/run-python-tts-tests.mjs",
  );
  assert.match(
    packageJson.scripts["jp-subtext:release-check"],
    /npm run jp-subtext:test:tts-python/,
  );
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
