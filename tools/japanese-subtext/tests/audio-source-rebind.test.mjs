import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { computeStageAudioSourceHash } from "../scripts/audio-source-contract.mjs";
import {
  checkAudioSourceBinding,
  prepareAudioSourceBinding,
  rebindAudioContent,
} from "../scripts/rebind-audio-content.mjs";

const OLD_CONTENT_HASH = "a".repeat(64);
const NEW_CONTENT_HASH = "b".repeat(64);
const SCENE_HASH = "c".repeat(64);
const EXPECTED_COUNTS = { scene: 1, line: 1, option: 1, token: 1 };

function stageFixture() {
  return {
    schemaVersion: 1,
    contentVersion: "1.0.2",
    contentHash: OLD_CONTENT_HASH,
    id: "L1-001",
    revision: 1,
    level: 1,
    textLocked: true,
    cast: [{ id: "speaker-a", voiceKey: "female-soft" }],
    lines: [{
      id: "line-001",
      speaker: "speaker-a",
      readingJa: "またあした",
      ttsTextJa: "また明日。",
      audioId: "L1-001-line-001",
      pauseAfterMs: 240,
      tokens: [{
        id: "token-001",
        text: "また",
        reading: "また",
        audioId: "L1-001-line-001-token-001",
      }],
    }],
    questions: [{
      id: "q1",
      answer: "a",
      explanation: { ja: "説明", zh: "解释", en: "Explanation" },
      options: [{
        id: "a",
        readingJa: "はい",
        ttsTextJa: "はい。",
        audioId: "L1-001-q1-a",
      }],
    }],
    audio: {
      sceneAudioId: "L1-001-scene",
      timelineId: "L1-001-timeline",
      optionVoiceKey: "female-soft",
    },
    illustration: {
      model: "legacy-v1",
      assetVersion: "1.0.2",
      path: "assets/stages/l1-001.webp",
    },
  };
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function makeFixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "jp-audio-rebind-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const audioRoot = path.join(root, "audio");
  const contentRoot = path.join(root, "content");
  const manifestPath = path.join(audioRoot, "manifest.json");
  const batchPath = path.join(contentRoot, "level-1", "batch-001-001.json");
  const timelinePath = "level-1/L1-001/timeline.json";
  const stage = stageFixture();
  const cues = [{ lineId: "line-001", audioId: "L1-001-line-001", start: 0, end: 0.2 }];
  const artifacts = {
    "L1-001-scene": ["scene", "level-1/L1-001/scene.mp3", Buffer.from("scene-audio")],
    "L1-001-line-001": ["line", "level-1/L1-001/lines/line-001.mp3", Buffer.from("line-audio")],
    "L1-001-line-001-token-001": [
      "token",
      "level-1/L1-001/tokens/token-001.mp3",
      Buffer.from("token-audio"),
    ],
    "L1-001-q1-a": ["option", "level-1/L1-001/options/q1-a.mp3", Buffer.from("option-audio")],
  };
  const items = {};
  for (const [id, [type, relativePath, bytes]] of Object.entries(artifacts)) {
    const file = path.join(audioRoot, ...relativePath.split("/"));
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, bytes);
    items[id] = {
      id,
      stageId: stage.id,
      type,
      level: stage.level,
      path: relativePath,
      bytes: bytes.length,
      sha256: sha256(bytes),
      contentHash: id === "L1-001-scene" ? SCENE_HASH : sha256(id),
    };
  }
  const stageEntry = {
    stageId: stage.id,
    contentVersion: stage.contentVersion,
    sourceContentHash: stage.contentHash,
    contentHash: SCENE_HASH,
    timelinePath,
    timelineId: stage.audio.timelineId,
    sceneAudioId: stage.audio.sceneAudioId,
    lineAudioIds: [stage.lines[0].audioId],
    tokenAudioIds: [stage.lines[0].tokens[0].audioId],
    optionAudioIds: [stage.questions[0].options[0].audioId],
    sampleRate: 44100,
    duration: 0.2,
    cues,
  };
  await writeJson(batchPath, { schemaVersion: 1, stages: [stage] });
  await writeJson(path.join(audioRoot, ...timelinePath.split("/")), {
    schemaVersion: 1,
    stageId: stage.id,
    timelineId: stage.audio.timelineId,
    sceneAudioId: stage.audio.sceneAudioId,
    contentHash: SCENE_HASH,
    sourceContentHash: stage.contentHash,
    sampleRate: 44100,
    duration: 0.2,
    cues,
  });
  await writeJson(manifestPath, {
    schemaVersion: 1,
    contentVersion: stage.contentVersion,
    items,
    stages: { [stage.id]: stageEntry },
  });
  const manifestText = await readFile(manifestPath, "utf8");
  await writeFile(manifestPath, manifestText.replace('"duration": 0.2', '"duration": 0.20'), "utf8");
  return { audioRoot, contentRoot, manifestPath, batchPath, timelinePath, stage, artifacts };
}

test("audio projection ignores delivery metadata and changes for synthesized speech inputs", () => {
  const stage = stageFixture();
  const original = computeStageAudioSourceHash(stage);
  const deliveryOnly = structuredClone(stage);
  deliveryOnly.contentVersion = "1.0.3";
  deliveryOnly.contentHash = NEW_CONTENT_HASH;
  deliveryOnly.revision += 1;
  deliveryOnly.illustration = {
    model: "gpt-image-2",
    assetVersion: "1.0.3",
    path: "new.webp",
  };
  deliveryOnly.questions[0].answer = "b";
  deliveryOnly.questions[0].explanation.ja = "別の説明";
  assert.equal(computeStageAudioSourceHash(deliveryOnly), original);

  for (const mutate of [
    (value) => { value.lines[0].ttsTextJa = "また来週。"; },
    (value) => { value.lines[0].readingJa = "またらいしゅう"; },
    (value) => { value.lines[0].pauseAfterMs = 241; },
    (value) => { value.cast[0].voiceKey = "female-bright"; },
    (value) => { value.questions[0].options[0].ttsTextJa = "いいえ。"; },
  ]) {
    const changed = structuredClone(stage);
    mutate(changed);
    assert.notEqual(computeStageAudioSourceHash(changed), original);
  }
  for (const invalid of ["240", -0.5, null, true]) {
    const changed = structuredClone(stage);
    changed.lines[0].pauseAfterMs = invalid;
    assert.throws(() => computeStageAudioSourceHash(changed), /non-negative integer/);
  }
  const implicitPause = structuredClone(stage);
  delete implicitPause.lines[0].pauseAfterMs;
  const explicitDefault = structuredClone(implicitPause);
  explicitDefault.lines[0].pauseAfterMs = 180;
  assert.notEqual(
    computeStageAudioSourceHash(implicitPause),
    computeStageAudioSourceHash(explicitDefault),
  );
});

test("prepare and rebind preserve every audio byte and recover from a partial timeline update", async (t) => {
  const fixture = await makeFixture(t);
  const options = {
    manifestPath: fixture.manifestPath,
    audioRoot: fixture.audioRoot,
    contentRoot: fixture.contentRoot,
    expectedCounts: EXPECTED_COUNTS,
    expectedStageCount: 1,
  };
  const originalAudio = new Map();
  for (const [id, [, relativePath]] of Object.entries(fixture.artifacts)) {
    const file = path.join(fixture.audioRoot, ...relativePath.split("/"));
    originalAudio.set(id, await readFile(file));
  }

  await prepareAudioSourceBinding({
    ...options,
    now: new Date("2026-07-14T00:00:00.000Z"),
  });
  const prepared = JSON.parse(await readFile(fixture.manifestPath, "utf8"));
  assert.equal(prepared.audioSourceBinding.status, "prepared");
  assert.match(prepared.stages[fixture.stage.id].audioSourceHash, /^[a-f0-9]{64}$/);
  assert.match(prepared.stages[fixture.stage.id].sceneSourceHash, /^[a-f0-9]{64}$/);
  assert.ok((await readFile(fixture.manifestPath, "utf8")).includes('"duration": 0.20'));
  const preparedAgain = await prepareAudioSourceBinding(options);
  assert.equal(preparedAgain.noop, true);
  await assert.rejects(
    rebindAudioContent({ ...options, contentVersion: "1.0.2" }),
    /target contentVersion must differ/,
  );

  const linePath = path.join(
    fixture.audioRoot,
    ...fixture.artifacts["L1-001-line-001"][1].split("/"),
  );
  const lineBytes = originalAudio.get("L1-001-line-001");
  await writeFile(linePath, Buffer.alloc(lineBytes.length, 0x78));
  await assert.rejects(
    prepareAudioSourceBinding(options),
    /SHA-256 differs from manifest/,
  );
  await writeFile(linePath, lineBytes);

  fixture.stage.contentVersion = "1.0.3";
  fixture.stage.contentHash = NEW_CONTENT_HASH;
  fixture.stage.revision += 1;
  await writeJson(fixture.batchPath, { schemaVersion: 1, stages: [fixture.stage] });

  await writeFile(linePath, Buffer.alloc(lineBytes.length, 0x78));
  await assert.rejects(
    rebindAudioContent({ ...options, contentVersion: "1.0.3" }),
    /SHA-256 differs from manifest/,
  );
  await writeFile(linePath, lineBytes);

  fixture.stage.lines[0].ttsTextJa = "音声が変わる。";
  await writeJson(fixture.batchPath, { schemaVersion: 1, stages: [fixture.stage] });
  await assert.rejects(
    rebindAudioContent({ ...options, contentVersion: "1.0.3" }),
    /audio source projection changed/,
  );
  fixture.stage.lines[0].ttsTextJa = "また明日。";
  await writeJson(fixture.batchPath, { schemaVersion: 1, stages: [fixture.stage] });

  const proofTamperedManifest = JSON.parse(await readFile(fixture.manifestPath, "utf8"));
  const validStageSourceSet = proofTamperedManifest.audioSourceBinding.stageSourceSetSha256;
  proofTamperedManifest.audioSourceBinding.stageSourceSetSha256 = "0".repeat(64);
  await writeJson(fixture.manifestPath, proofTamperedManifest);
  const timelineBeforeRejectedRebind = await readFile(
    path.join(fixture.audioRoot, ...fixture.timelinePath.split("/")),
  );
  await assert.rejects(
    rebindAudioContent({ ...options, contentVersion: "1.0.3" }),
    /journal does not match stageSourceSetSha256/,
  );
  assert.deepEqual(
    await readFile(path.join(fixture.audioRoot, ...fixture.timelinePath.split("/"))),
    timelineBeforeRejectedRebind,
  );
  proofTamperedManifest.audioSourceBinding.stageSourceSetSha256 = validStageSourceSet;
  await writeJson(fixture.manifestPath, proofTamperedManifest);

  const tamperedManifest = JSON.parse(await readFile(fixture.manifestPath, "utf8"));
  const originalCue = structuredClone(tamperedManifest.stages[fixture.stage.id].cues);
  tamperedManifest.stages[fixture.stage.id].cues[0].end = 0.19;
  await writeJson(fixture.manifestPath, tamperedManifest);
  const tamperedTimeline = JSON.parse(await readFile(
    path.join(fixture.audioRoot, ...fixture.timelinePath.split("/")),
    "utf8",
  ));
  tamperedTimeline.cues[0].end = 0.19;
  await writeJson(path.join(fixture.audioRoot, ...fixture.timelinePath.split("/")), tamperedTimeline);
  await assert.rejects(
    rebindAudioContent({ ...options, contentVersion: "1.0.3" }),
    /(?:stageEntry|timelineStable)SetSha256 changed after prepare/,
  );
  tamperedManifest.stages[fixture.stage.id].cues = originalCue;
  await writeJson(fixture.manifestPath, tamperedManifest);
  tamperedTimeline.cues = structuredClone(originalCue);
  await writeJson(path.join(fixture.audioRoot, ...fixture.timelinePath.split("/")), tamperedTimeline);

  const timelineFile = path.join(fixture.audioRoot, ...fixture.timelinePath.split("/"));
  const partialTimeline = JSON.parse(await readFile(timelineFile, "utf8"));
  partialTimeline.sourceContentHash = NEW_CONTENT_HASH;
  await writeJson(timelineFile, partialTimeline);

  await rebindAudioContent({
    ...options,
    contentVersion: "1.0.3",
    now: new Date("2026-07-14T01:00:00.000Z"),
  });
  const checked = checkAudioSourceBinding(options);
  assert.equal(checked.manifest.contentVersion, "1.0.3");
  assert.equal(checked.manifest.audioSourceBinding.status, "rebound");
  assert.equal(checked.manifest.audioSourceBinding.toContentVersion, "1.0.3");
  assert.equal(checked.manifest.stages[fixture.stage.id].sourceContentHash, NEW_CONTENT_HASH);
  assert.equal(checked.audit.timelineSetSha256, checked.manifest.audioSourceBinding.timelineSetSha256);

  for (const [id, [, relativePath]] of Object.entries(fixture.artifacts)) {
    const actual = await readFile(path.join(fixture.audioRoot, ...relativePath.split("/")));
    assert.deepEqual(actual, originalAudio.get(id), `${id} bytes must not change during rebind`);
  }
  await assert.rejects(prepareAudioSourceBinding(options), /refuses to overwrite.*rebound/);
});
