import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import {
  existsSync,
  readFileSync,
  realpathSync,
  readdirSync,
  statSync,
} from "node:fs";
import {
  open,
  rename,
  unlink,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import {
  AUDIO_SOURCE_HASH_SCHEMA_VERSION,
  computeStageAudioSourceHash,
  computeStageSceneSourceHash,
  expectedStageAudioIds,
  SCENE_SOURCE_HASH_SCHEMA_VERSION,
  stableAudioBindingHash,
} from "./audio-source-contract.mjs";

const scriptFile = fileURLToPath(import.meta.url);
const scriptRoot = path.dirname(scriptFile);
const toolRoot = path.resolve(scriptRoot, "..");
const EXPECTED_COUNTS = Object.freeze({ scene: 250, line: 2400, option: 2445, token: 4993 });
const EXPECTED_ITEMS = Object.values(EXPECTED_COUNTS).reduce((sum, count) => sum + count, 0);

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

function isSha256(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function isSemver(value) {
  return typeof value === "string" && /^\d+\.\d+\.\d+$/.test(value);
}

function compareSemver(left, right) {
  const a = left.split(".").map(Number);
  const b = right.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] < b[index] ? -1 : 1;
  }
  return 0;
}

function isSafeRelativePath(value) {
  if (
    typeof value !== "string"
    || value.length === 0
    || value.includes("\\")
    || path.posix.isAbsolute(value)
    || /^[A-Za-z]:/.test(value)
  ) return false;
  return value.split("/").every((segment) => (
    segment
    && segment !== "."
    && segment !== ".."
    && !segment.includes(":")
    && !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(segment)
  ));
}

function resolveInside(root, relativePath, label) {
  if (!isSafeRelativePath(relativePath)) throw new Error(`${label} has an unsafe path`);
  const resolvedRoot = path.resolve(root);
  const candidate = path.resolve(resolvedRoot, ...relativePath.split("/"));
  const lexicalRelative = path.relative(resolvedRoot, candidate);
  if (lexicalRelative.startsWith("..") || path.isAbsolute(lexicalRelative)) {
    throw new Error(`${label} escapes its root`);
  }
  const realRoot = realpathSync(resolvedRoot);
  const realCandidate = realpathSync(existsSync(candidate) ? candidate : path.dirname(candidate));
  const realRelative = path.relative(realRoot, realCandidate);
  if (realRelative.startsWith("..") || path.isAbsolute(realRelative)) {
    throw new Error(`${label} resolves outside its root`);
  }
  return candidate;
}

function assertCanonicalManifestPath(manifestPath, audioRoot) {
  const expected = path.resolve(audioRoot, "manifest.json");
  const actual = path.resolve(manifestPath);
  if (actual !== expected) throw new Error("audio manifest path must be exactly audio-root/manifest.json");
  if (realpathSync(actual) !== realpathSync(expected)) {
    throw new Error("audio manifest resolves outside the canonical publication path");
  }
}

function sha256File(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

function loadStages(contentRoot) {
  const stages = [];
  for (let level = 1; level <= 5; level += 1) {
    const directory = path.join(contentRoot, `level-${level}`);
    if (!existsSync(directory)) continue;
    const names = readdirSync(directory)
      .filter((name) => /^batch-\d{3}-\d{3}\.json$/.test(name))
      .sort();
    for (const name of names) {
      const payload = readJson(path.join(directory, name));
      if (!Array.isArray(payload.stages)) throw new Error(`${name} has no stages array`);
      stages.push(...payload.stages);
    }
  }
  return stages;
}

function assertExactArray(actual, expected, label) {
  const left = [...(actual || [])].sort();
  const right = [...expected].sort();
  if (JSON.stringify(left) !== JSON.stringify(right)) throw new Error(`${label} does not exactly match content`);
}

function compareAscii(left, right) {
  const a = String(left);
  const b = String(right);
  return a === b ? 0 : a < b ? -1 : 1;
}

function stableStageEntryProjection(entry) {
  const {
    contentVersion: _contentVersion,
    sourceContentHash: _sourceContentHash,
    audioSourceHash: _audioSourceHash,
    sceneSourceHash: _sceneSourceHash,
    ...stable
  } = entry || {};
  return stable;
}

function stableTimelineProjection(timeline) {
  const { sourceContentHash: _sourceContentHash, ...stable } = timeline || {};
  return stable;
}

function auditBundle({
  manifest,
  audioRoot,
  stages,
  requireCurrentSource,
  requirePreparedBinding,
  allowTargetTimelineSource = false,
  expectedCounts = EXPECTED_COUNTS,
  expectedStageCount = 250,
}) {
  if (!manifest || typeof manifest !== "object") throw new Error("audio manifest must be an object");
  if (!isSemver(manifest.contentVersion)) throw new Error("audio manifest contentVersion must be semantic x.y.z");
  const items = manifest.items || {};
  const stageEntries = manifest.stages || {};
  const expectedItems = Object.values(expectedCounts).reduce((sum, count) => sum + count, 0);
  if (stages.length !== expectedStageCount) {
    throw new Error(`content must contain exactly ${expectedStageCount} stages; found ${stages.length}`);
  }
  if (new Set(stages.map((stage) => stage.id)).size !== expectedStageCount) {
    throw new Error("content stage ids must be unique");
  }
  if (Object.keys(items).length !== expectedItems) {
    throw new Error(`audio manifest must contain ${expectedItems} items; found ${Object.keys(items).length}`);
  }
  if (Object.keys(stageEntries).length !== expectedStageCount) {
    throw new Error(
      `audio manifest must contain ${expectedStageCount} stage entries; found ${Object.keys(stageEntries).length}`,
    );
  }
  if (requirePreparedBinding) {
    if (
      manifest.audioSourceBinding?.schemaVersion !== AUDIO_SOURCE_HASH_SCHEMA_VERSION
      || !["generated", "prepared", "rebound"].includes(manifest.audioSourceBinding?.status)
    ) {
      throw new Error("audio manifest has no prepared audio-source binding evidence");
    }
  }

  const stageById = new Map(stages.map((stage) => [stage.id, stage]));
  const orderedStages = [...stages].sort((left, right) => compareAscii(left.id, right.id));
  const expectedIds = new Set();
  const actualCounts = { scene: 0, line: 0, option: 0, token: 0 };
  const artifactRows = [];
  const immutableMediaRows = [];
  const timelineRows = [];
  const timelineStableRows = [];
  const timelineProofs = {};
  const stageEntryRows = [];
  const stageSourceRows = [];
  const audioSourceRows = [];
  const sceneSourceRows = [];
  const itemPaths = new Set();
  const timelinePaths = new Set();

  for (const [id, item] of Object.entries(items).sort(([a], [b]) => compareAscii(a, b))) {
    if (!Object.hasOwn(actualCounts, item?.type)) throw new Error(`audio item ${id} has an invalid type`);
    actualCounts[item.type] += 1;
    if (item.id !== id || !stageById.has(item.stageId)) throw new Error(`audio item ${id} has invalid identity`);
    if (!isSha256(item.sha256) || !Number.isInteger(item.bytes) || item.bytes <= 0) {
      throw new Error(`audio item ${id} has invalid SHA-256 or byte count`);
    }
    const file = resolveInside(audioRoot, item.path, `audio item ${id}`);
    const normalizedPath = item.path.toLowerCase();
    if (normalizedPath === "manifest.json" || normalizedPath.startsWith(".work/")) {
      throw new Error(`audio item ${id} collides with publication control files`);
    }
    if (itemPaths.has(normalizedPath)) throw new Error(`audio item ${id} reuses another item path`);
    itemPaths.add(normalizedPath);
    if (!existsSync(file) || !statSync(file).isFile() || statSync(file).size !== item.bytes) {
      throw new Error(`audio item ${id} file is missing or has a byte mismatch`);
    }
    const actualSha256 = sha256File(file);
    if (actualSha256 !== item.sha256) throw new Error(`audio item ${id} file SHA-256 differs from manifest`);
    artifactRows.push({
      id,
      stageId: item.stageId,
      type: item.type,
      level: item.level,
      path: item.path,
      sha256: item.sha256,
      bytes: item.bytes,
      contentHash: item.contentHash,
    });
    immutableMediaRows.push({ id, path: item.path, sha256: item.sha256, bytes: item.bytes });
  }
  for (const [type, count] of Object.entries(expectedCounts)) {
    if (actualCounts[type] !== count) throw new Error(`audio item count ${type} must be ${count}; found ${actualCounts[type]}`);
  }

  for (const stage of orderedStages) {
    const entry = stageEntries[stage.id];
    if (!entry || entry.stageId !== stage.id) throw new Error(`${stage.id}: missing manifest stage entry`);
    if (!isSemver(stage.contentVersion) || !isSha256(stage.contentHash)) {
      throw new Error(`${stage.id}: contentVersion or contentHash is invalid`);
    }
    if (!isSemver(entry.contentVersion) || !isSha256(entry.sourceContentHash)) {
      throw new Error(`${stage.id}: manifest stage contentVersion or sourceContentHash is invalid`);
    }
    const ids = expectedStageAudioIds(stage);
    for (const [type, values] of Object.entries(ids)) {
      for (const id of values) {
        const item = items[id];
        if (item?.stageId !== stage.id || item?.type !== type || item?.level !== stage.level) {
          throw new Error(`${stage.id}: audio item ${id} has the wrong stage, type, or level identity`);
        }
      }
    }
    for (const values of Object.values(ids)) for (const id of values) expectedIds.add(id);
    assertExactArray([entry.sceneAudioId], ids.scene, `${stage.id}.sceneAudioId`);
    assertExactArray(entry.lineAudioIds, ids.line, `${stage.id}.lineAudioIds`);
    assertExactArray(entry.optionAudioIds, ids.option, `${stage.id}.optionAudioIds`);
    assertExactArray(entry.tokenAudioIds, ids.token, `${stage.id}.tokenAudioIds`);
    const cueLinks = (entry.cues || []).map((cue) => [cue.lineId, cue.audioId]);
    const wantedCueLinks = (stage.lines || []).map((line) => [line.id, line.audioId]);
    if (JSON.stringify(cueLinks) !== JSON.stringify(wantedCueLinks)) {
      throw new Error(`${stage.id}: cue order does not match content lines`);
    }
    if (!isSha256(entry.contentHash) || manifest.items?.[entry.sceneAudioId]?.contentHash !== entry.contentHash) {
      throw new Error(`${stage.id}: scene content hash binding is invalid`);
    }
    if (requireCurrentSource && entry.sourceContentHash !== stage.contentHash) {
      throw new Error(`${stage.id}: sourceContentHash does not match current locked content`);
    }
    const audioSourceHash = computeStageAudioSourceHash(stage);
    const sceneSourceHash = computeStageSceneSourceHash(stage);
    if (requirePreparedBinding && entry.audioSourceHash !== audioSourceHash) {
      throw new Error(`${stage.id}: audio source projection changed; offline rebinding is forbidden`);
    }
    if (requirePreparedBinding && entry.sceneSourceHash !== sceneSourceHash) {
      throw new Error(`${stage.id}: scene source projection changed; offline rebinding is forbidden`);
    }
    audioSourceRows.push({ stageId: stage.id, audioSourceHash });
    sceneSourceRows.push({ stageId: stage.id, sceneSourceHash });
    stageSourceRows.push({ stageId: stage.id, sourceContentHash: stage.contentHash });
    stageEntryRows.push({
      stageId: stage.id,
      stableSha256: stableAudioBindingHash(stableStageEntryProjection(entry)),
    });

    const timelineFile = resolveInside(audioRoot, entry.timelinePath, `${stage.id} timeline`);
    const expectedTimelinePath = `level-${stage.level}/${stage.id}/timeline.json`;
    if (entry.timelinePath !== expectedTimelinePath) {
      throw new Error(`${stage.id}: timelinePath must be ${expectedTimelinePath}`);
    }
    const normalizedTimelinePath = entry.timelinePath.toLowerCase();
    if (timelinePaths.has(normalizedTimelinePath) || itemPaths.has(normalizedTimelinePath)) {
      throw new Error(`${stage.id}: timelinePath collides with another published artifact`);
    }
    timelinePaths.add(normalizedTimelinePath);
    if (!existsSync(timelineFile) || !statSync(timelineFile).isFile()) throw new Error(`${stage.id}: timeline is missing`);
    const timeline = readJson(timelineFile);
    if (!isSha256(timeline.sourceContentHash)) {
      throw new Error(`${stage.id}: timeline sourceContentHash is invalid`);
    }
    const timelineSourceMatches = timeline.sourceContentHash === entry.sourceContentHash
      || (allowTargetTimelineSource && timeline.sourceContentHash === stage.contentHash);
    if (
      timeline.schemaVersion !== 1
      || timeline.stageId !== stage.id
      || timeline.timelineId !== entry.timelineId
      || timeline.sceneAudioId !== entry.sceneAudioId
      || timeline.contentHash !== entry.contentHash
      || !timelineSourceMatches
      || !Number.isInteger(timeline.sampleRate)
      || timeline.sampleRate <= 0
      || timeline.sampleRate !== entry.sampleRate
      || typeof timeline.duration !== "number"
      || !Number.isFinite(timeline.duration)
      || timeline.duration <= 0
      || timeline.duration !== entry.duration
      || JSON.stringify(timeline.cues) !== JSON.stringify(entry.cues)
    ) {
      throw new Error(`${stage.id}: timeline does not match its manifest stage entry`);
    }
    const timelineSha256 = sha256File(timelineFile);
    const stableSha256 = stableAudioBindingHash(stableTimelineProjection(timeline));
    timelineRows.push({ stageId: stage.id, path: entry.timelinePath, sha256: timelineSha256 });
    timelineStableRows.push({ stageId: stage.id, path: entry.timelinePath, stableSha256 });
    timelineProofs[stage.id] = {
      path: entry.timelinePath,
      sha256: timelineSha256,
      stableSha256,
      sourceContentHash: timeline.sourceContentHash,
    };
  }
  if (expectedIds.size !== expectedItems || [...expectedIds].some((id) => !items[id])) {
    throw new Error("content audio ids do not exactly cover the manifest item set");
  }
  if (Object.keys(items).some((id) => !expectedIds.has(id))) throw new Error("audio manifest contains orphan items");

  return {
    artifactSetSha256: stableAudioBindingHash(artifactRows),
    immutableMediaSetSha256: stableAudioBindingHash(immutableMediaRows),
    timelineSetSha256: stableAudioBindingHash(timelineRows),
    timelineStableSetSha256: stableAudioBindingHash(timelineStableRows),
    timelineProofs,
    stageEntrySetSha256: stableAudioBindingHash(stageEntryRows),
    stageSourceSetSha256: stableAudioBindingHash(stageSourceRows),
    audioSourceSetSha256: stableAudioBindingHash(audioSourceRows),
    sceneSourceSetSha256: stableAudioBindingHash(sceneSourceRows),
    audioSourceByStage: new Map(audioSourceRows.map((row) => [row.stageId, row.audioSourceHash])),
    sceneSourceByStage: new Map(sceneSourceRows.map((row) => [row.stageId, row.sceneSourceHash])),
    counts: {
      ...actualCounts,
      items: expectedItems,
      stages: expectedStageCount,
      timelines: expectedStageCount,
    },
  };
}

function numberTokens(json) {
  const tokens = [];
  let inString = false;
  let escaped = false;
  for (let index = 0; index < json.length; index += 1) {
    const character = json[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') {
      inString = true;
      continue;
    }
    if (character !== "-" && (character < "0" || character > "9")) continue;
    const match = json.slice(index).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);
    if (!match) continue;
    tokens.push({ start: index, end: index + match[0].length, raw: match[0], value: Number(match[0]) });
    index += match[0].length - 1;
  }
  return tokens;
}

function stringifyPreservingNumberLexemes(value, originalJson = null) {
  const serialized = `${JSON.stringify(value, null, 2)}\n`;
  if (typeof originalJson !== "string") return serialized;
  const original = numberTokens(originalJson);
  const current = numberTokens(serialized);
  if (current.length < original.length) {
    throw new Error("JSON rewrite unexpectedly removed numeric fields");
  }
  const replacements = [];
  for (let index = 0; index < original.length; index += 1) {
    if (original[index].value !== current[index].value) {
      throw new Error(`JSON rewrite unexpectedly changed numeric field ${index + 1}`);
    }
    replacements.push({ ...current[index], raw: original[index].raw });
  }
  let cursor = 0;
  let result = "";
  for (const replacement of replacements) {
    result += serialized.slice(cursor, replacement.start);
    result += replacement.raw;
    cursor = replacement.end;
  }
  return result + serialized.slice(cursor);
}

async function renameWithRetries(source, destination) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      await rename(source, destination);
      return;
    } catch (error) {
      if (!['EPERM', 'EACCES', 'EBUSY', 'EEXIST'].includes(error?.code) || attempt === 7) throw error;
      await delay(Math.min(25 * (2 ** attempt), 500));
    }
  }
}

async function writeBufferAtomic(file, value) {
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
  let handle;
  let published = false;
  try {
    handle = await open(temporary, "wx");
    await handle.writeFile(value);
    await handle.sync();
    await handle.close();
    handle = null;
    await renameWithRetries(temporary, file);
    published = true;
  } finally {
    if (handle) await handle.close().catch(() => {});
    if (!published) await unlink(temporary).catch(() => {});
  }
}

async function writeJsonAtomic(file, value) {
  const originalJson = existsSync(file) ? readFileSync(file, "utf8") : null;
  const serialized = stringifyPreservingNumberLexemes(value, originalJson);
  await writeBufferAtomic(file, Buffer.from(serialized, "utf8"));
}

function assertBindingCounts(binding, audit) {
  for (const [key, value] of Object.entries(audit.counts)) {
    if (binding?.[key] !== value) throw new Error(`audio-source binding count ${key} is stale`);
  }
}

function assertBindingProofs(
  binding,
  audit,
  { allowPartialTimelines = false, includeStageSource = true } = {},
) {
  const proofs = [
    ["artifactSetSha256", audit.artifactSetSha256],
    ["immutableMediaSetSha256", audit.immutableMediaSetSha256],
    ["timelineStableSetSha256", audit.timelineStableSetSha256],
    ["stageEntrySetSha256", audit.stageEntrySetSha256],
    ["audioSourceSetSha256", audit.audioSourceSetSha256],
    ["sceneSourceSetSha256", audit.sceneSourceSetSha256],
  ];
  if (includeStageSource) proofs.push(["stageSourceSetSha256", audit.stageSourceSetSha256]);
  if (!allowPartialTimelines) proofs.push(["timelineSetSha256", audit.timelineSetSha256]);
  for (const [name, actual] of proofs) {
    if (binding?.[name] !== actual) throw new Error(`${name} changed after prepare`);
  }
  assertBindingCounts(binding, audit);
}

function assertReboundHistory(binding, stages) {
  const prepared = binding?.preparedTimelineProofs;
  if (!prepared || typeof prepared !== "object" || Object.keys(prepared).length !== stages.length) {
    throw new Error("rebound audio-source binding is missing its prepared timeline journal");
  }
  const timelineRows = [];
  const timelineStableRows = [];
  const stageSourceRows = [];
  for (const stage of [...stages].sort((left, right) => compareAscii(left.id, right.id))) {
    const proof = prepared[stage.id];
    if (
      !proof
      || !isSafeRelativePath(proof.path)
      || !isSha256(proof.sha256)
      || !isSha256(proof.stableSha256)
      || !isSha256(proof.sourceContentHash)
    ) {
      throw new Error(`${stage.id}: prepared timeline history is invalid`);
    }
    timelineRows.push({ stageId: stage.id, path: proof.path, sha256: proof.sha256 });
    timelineStableRows.push({ stageId: stage.id, path: proof.path, stableSha256: proof.stableSha256 });
    stageSourceRows.push({ stageId: stage.id, sourceContentHash: proof.sourceContentHash });
  }
  if (stableAudioBindingHash(timelineRows) !== binding.timelineSetSha256BeforeRebind) {
    throw new Error("prepared timeline journal does not match timelineSetSha256BeforeRebind");
  }
  if (stableAudioBindingHash(timelineStableRows) !== binding.timelineStableSetSha256) {
    throw new Error("prepared timeline journal does not match timelineStableSetSha256");
  }
  if (stableAudioBindingHash(stageSourceRows) !== binding.previousStageSourceSetSha256) {
    throw new Error("prepared timeline journal does not match previousStageSourceSetSha256");
  }
}

function assertPreparedBaselineHistory(binding, stages) {
  const prepared = binding?.timelineProofs;
  if (!prepared || typeof prepared !== "object" || Object.keys(prepared).length !== stages.length) {
    throw new Error("prepared audio-source binding has no complete timeline journal");
  }
  const timelineRows = [];
  const timelineStableRows = [];
  const stageSourceRows = [];
  for (const stage of [...stages].sort((left, right) => compareAscii(left.id, right.id))) {
    const proof = prepared[stage.id];
    if (
      !proof
      || !isSafeRelativePath(proof.path)
      || !isSha256(proof.sha256)
      || !isSha256(proof.stableSha256)
      || !isSha256(proof.sourceContentHash)
    ) {
      throw new Error(`${stage.id}: prepared baseline timeline proof is invalid`);
    }
    timelineRows.push({ stageId: stage.id, path: proof.path, sha256: proof.sha256 });
    timelineStableRows.push({ stageId: stage.id, path: proof.path, stableSha256: proof.stableSha256 });
    stageSourceRows.push({ stageId: stage.id, sourceContentHash: proof.sourceContentHash });
  }
  if (stableAudioBindingHash(timelineRows) !== binding.timelineSetSha256) {
    throw new Error("prepared timeline journal does not match timelineSetSha256");
  }
  if (stableAudioBindingHash(timelineStableRows) !== binding.timelineStableSetSha256) {
    throw new Error("prepared timeline journal does not match timelineStableSetSha256");
  }
  if (stableAudioBindingHash(stageSourceRows) !== binding.stageSourceSetSha256) {
    throw new Error("prepared timeline journal does not match stageSourceSetSha256");
  }
}

function assertPreparedTimelineProofs(
  binding,
  audit,
  stages,
  { allowTargetSource = false, audioRoot = null } = {},
) {
  const prepared = binding?.timelineProofs;
  if (!prepared || typeof prepared !== "object" || Object.keys(prepared).length !== stages.length) {
    throw new Error("prepared timeline proof journal is missing or incomplete");
  }
  for (const stage of stages) {
    const before = prepared[stage.id];
    const current = audit.timelineProofs[stage.id];
    if (
      !before
      || before.path !== current.path
      || before.stableSha256 !== current.stableSha256
      || !isSha256(before.sha256)
      || !isSha256(before.sourceContentHash)
    ) {
      throw new Error(`${stage.id}: timeline changed outside the allowed source binding`);
    }
    if (current.sourceContentHash === before.sourceContentHash) {
      if (current.sha256 !== before.sha256) {
        throw new Error(`${stage.id}: prepared timeline bytes changed before rebinding`);
      }
    } else {
      if (!allowTargetSource || current.sourceContentHash !== stage.contentHash || !audioRoot) {
        throw new Error(`${stage.id}: timeline sourceContentHash is neither prepared nor target content`);
      }
      const timelineFile = resolveInside(audioRoot, current.path, `${stage.id} partial timeline`);
      const raw = readFileSync(timelineFile, "utf8");
      const matches = [...raw.matchAll(/"sourceContentHash"\s*:\s*"([a-f0-9]{64})"/g)];
      if (matches.length !== 1 || matches[0][1] !== current.sourceContentHash) {
        throw new Error(`${stage.id}: partial timeline has an ambiguous sourceContentHash field`);
      }
      const valueOffset = matches[0][0].lastIndexOf(matches[0][1]);
      const start = matches[0].index + valueOffset;
      const restored = raw.slice(0, start) + before.sourceContentHash + raw.slice(start + 64);
      const restoredSha256 = createHash("sha256").update(restored, "utf8").digest("hex");
      if (restoredSha256 !== before.sha256) {
        throw new Error(`${stage.id}: partial timeline changed beyond sourceContentHash`);
      }
    }
  }
}

export async function prepareAudioSourceBinding({
  manifestPath,
  audioRoot,
  contentRoot,
  now = new Date(),
  expectedCounts = EXPECTED_COUNTS,
  expectedStageCount = 250,
}) {
  assertCanonicalManifestPath(manifestPath, audioRoot);
  const manifest = readJson(manifestPath);
  const stages = loadStages(contentRoot);
  const contentVersions = new Set(stages.map((stage) => stage.contentVersion));
  if (contentVersions.size !== 1 || !contentVersions.has(manifest.contentVersion)) {
    throw new Error("prepare requires manifest and all content stages to share the current contentVersion");
  }
  for (const stage of stages) {
    const entry = manifest.stages?.[stage.id];
    if (entry?.contentVersion !== manifest.contentVersion) {
      throw new Error(`${stage.id}: stage manifest contentVersion is stale`);
    }
  }
  const existingBinding = manifest.audioSourceBinding;
  if (existingBinding?.status === "rebound") {
    throw new Error("prepare refuses to overwrite an existing rebound evidence baseline");
  }
  if (existingBinding && !["generated", "prepared"].includes(existingBinding.status)) {
    throw new Error(`prepare does not accept audioSourceBinding status ${existingBinding.status}`);
  }
  const audit = auditBundle({
    manifest,
    audioRoot,
    stages,
    requireCurrentSource: true,
    requirePreparedBinding: existingBinding?.status === "prepared",
    expectedCounts,
    expectedStageCount,
  });
  if (existingBinding?.status === "prepared") {
    assertBindingProofs(existingBinding, audit);
    assertPreparedTimelineProofs(existingBinding, audit, stages, { audioRoot });
    assertPreparedBaselineHistory(existingBinding, stages);
    return { manifest, audit, noop: true };
  }
  for (const stage of stages) {
    manifest.stages[stage.id].audioSourceHash = audit.audioSourceByStage.get(stage.id);
    manifest.stages[stage.id].sceneSourceHash = audit.sceneSourceByStage.get(stage.id);
  }
  manifest.audioSourceHashSchemaVersion = AUDIO_SOURCE_HASH_SCHEMA_VERSION;
  manifest.sceneSourceHashSchemaVersion = SCENE_SOURCE_HASH_SCHEMA_VERSION;
  delete manifest.audioSourceBinding;
  manifest.audioSourceBinding = {
    schemaVersion: AUDIO_SOURCE_HASH_SCHEMA_VERSION,
    status: "prepared",
    preparedAt: now.toISOString(),
    preparedContentVersion: manifest.contentVersion,
    ...audit.counts,
    artifactSetSha256: audit.artifactSetSha256,
    immutableMediaSetSha256: audit.immutableMediaSetSha256,
    timelineSetSha256: audit.timelineSetSha256,
    timelineStableSetSha256: audit.timelineStableSetSha256,
    timelineProofs: audit.timelineProofs,
    stageEntrySetSha256: audit.stageEntrySetSha256,
    stageSourceSetSha256: audit.stageSourceSetSha256,
    audioSourceSetSha256: audit.audioSourceSetSha256,
    sceneSourceSetSha256: audit.sceneSourceSetSha256,
  };
  await writeJsonAtomic(manifestPath, manifest);
  return { manifest, audit };
}

export async function rebindAudioContent({
  manifestPath,
  audioRoot,
  contentRoot,
  contentVersion,
  now = new Date(),
  expectedCounts = EXPECTED_COUNTS,
  expectedStageCount = 250,
}) {
  assertCanonicalManifestPath(manifestPath, audioRoot);
  const manifest = readJson(manifestPath);
  const stages = loadStages(contentRoot);
  const contentVersions = new Set(stages.map((stage) => stage.contentVersion));
  if (contentVersions.size !== 1 || !contentVersions.has(contentVersion)) {
    throw new Error(`rebind requires all content stages to use ${contentVersion}`);
  }
  const priorVersion = manifest.contentVersion;
  const priorBinding = manifest.audioSourceBinding;
  if (priorBinding?.status !== "prepared") {
    throw new Error("rebind requires exactly one prepared evidence baseline");
  }
  if (priorBinding.preparedContentVersion !== priorVersion) {
    throw new Error("prepared evidence does not match the current manifest contentVersion");
  }
  if (priorVersion === contentVersion) {
    throw new Error("rebind target contentVersion must differ from the prepared contentVersion");
  }
  if (compareSemver(contentVersion, priorVersion) <= 0) {
    throw new Error("rebind target contentVersion must be newer than the prepared contentVersion");
  }
  assertPreparedBaselineHistory(priorBinding, stages);
  for (const stage of stages) {
    const entry = manifest.stages?.[stage.id];
    const preparedTimeline = priorBinding.timelineProofs?.[stage.id];
    if (
      entry?.contentVersion !== priorVersion
      || entry?.sourceContentHash !== preparedTimeline?.sourceContentHash
    ) {
      throw new Error(`${stage.id}: prepared manifest stage identity was modified`);
    }
  }
  const audit = auditBundle({
    manifest,
    audioRoot,
    stages,
    requireCurrentSource: false,
    requirePreparedBinding: true,
    allowTargetTimelineSource: true,
    expectedCounts,
    expectedStageCount,
  });
  assertBindingProofs(priorBinding, audit, {
    allowPartialTimelines: true,
    includeStageSource: false,
  });
  assertPreparedTimelineProofs(priorBinding, audit, stages, {
    allowTargetSource: true,
    audioRoot,
  });

  const timelineWrites = [];
  for (const stage of stages) {
    const entry = manifest.stages[stage.id];
    const timelineFile = resolveInside(audioRoot, entry.timelinePath, `${stage.id} timeline`);
    const timeline = readJson(timelineFile);
    entry.contentVersion = contentVersion;
    entry.sourceContentHash = stage.contentHash;
    if (timeline.sourceContentHash !== stage.contentHash) {
      timeline.sourceContentHash = stage.contentHash;
      timelineWrites.push({
        file: timelineFile,
        value: timeline,
        original: readFileSync(timelineFile),
      });
    }
  }
  manifest.contentVersion = contentVersion;
  manifest.audioSourceHashSchemaVersion = AUDIO_SOURCE_HASH_SCHEMA_VERSION;
  manifest.sceneSourceHashSchemaVersion = SCENE_SOURCE_HASH_SCHEMA_VERSION;

  // Publish all timelines first and the manifest last. A rerun is idempotent if
  // the process stops between those steps, while readers never see a new
  // manifest that points at old source bindings. Ordinary failures restore every
  // timeline written by this process before returning an error.
  const publishedTimelineWrites = [];
  try {
    for (const write of timelineWrites) {
      await writeJsonAtomic(write.file, write.value);
      publishedTimelineWrites.push(write);
    }
    const postAudit = auditBundle({
      manifest,
      audioRoot,
      stages,
      requireCurrentSource: true,
      requirePreparedBinding: true,
      expectedCounts,
      expectedStageCount,
    });
    for (const name of [
      "artifactSetSha256",
      "immutableMediaSetSha256",
      "audioSourceSetSha256",
      "sceneSourceSetSha256",
      "timelineStableSetSha256",
      "stageEntrySetSha256",
    ]) {
      if (postAudit[name] !== audit[name]) throw new Error(`${name} changed during rebinding`);
    }
    manifest.audioSourceBinding = {
      ...priorBinding,
      status: "rebound",
      reboundAt: now.toISOString(),
      fromContentVersion: priorVersion,
      toContentVersion: contentVersion,
      previousStageSourceSetSha256: priorBinding.stageSourceSetSha256,
      stageSourceSetSha256: postAudit.stageSourceSetSha256,
      timelineSetSha256BeforeRebind: priorBinding.timelineSetSha256,
      preparedTimelineProofs: priorBinding.timelineProofs,
      timelineSetSha256: postAudit.timelineSetSha256,
      timelineStableSetSha256: postAudit.timelineStableSetSha256,
      timelineProofs: postAudit.timelineProofs,
    };
    await writeJsonAtomic(manifestPath, manifest);
    return { manifest, audit: postAudit };
  } catch (error) {
    const rollbackErrors = [];
    for (const write of publishedTimelineWrites.reverse()) {
      try {
        await writeBufferAtomic(write.file, write.original);
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    if (rollbackErrors.length) {
      throw new AggregateError([error, ...rollbackErrors], "audio rebind failed and timeline rollback was incomplete");
    }
    throw error;
  }
}

export function checkAudioSourceBinding({
  manifestPath,
  audioRoot,
  contentRoot,
  expectedCounts = EXPECTED_COUNTS,
  expectedStageCount = 250,
}) {
  assertCanonicalManifestPath(manifestPath, audioRoot);
  const manifest = readJson(manifestPath);
  const stages = loadStages(contentRoot);
  if (!["generated", "rebound"].includes(manifest.audioSourceBinding?.status)) {
    throw new Error("audio-source binding check requires a generated or completed rebound state");
  }
  for (const stage of stages) {
    if (
      stage.contentVersion !== manifest.contentVersion
      || manifest.stages?.[stage.id]?.contentVersion !== manifest.contentVersion
    ) {
      throw new Error(`${stage.id}: contentVersion does not match the rebound manifest`);
    }
  }
  const audit = auditBundle({
    manifest,
    audioRoot,
    stages,
    requireCurrentSource: true,
    requirePreparedBinding: true,
    expectedCounts,
    expectedStageCount,
  });
  if (manifest.audioSourceHashSchemaVersion !== AUDIO_SOURCE_HASH_SCHEMA_VERSION) {
    throw new Error("manifest audioSourceHashSchemaVersion is stale");
  }
  if (manifest.sceneSourceHashSchemaVersion !== SCENE_SOURCE_HASH_SCHEMA_VERSION) {
    throw new Error("manifest sceneSourceHashSchemaVersion is stale");
  }
  if (manifest.audioSourceBinding.status === "generated") {
    if (manifest.audioSourceBinding.toContentVersion !== manifest.contentVersion) {
      throw new Error("generated audio-source binding targets a different contentVersion");
    }
    return { manifest, audit };
  }
  assertBindingProofs(manifest.audioSourceBinding, audit);
  assertPreparedTimelineProofs(manifest.audioSourceBinding, audit, stages, { audioRoot });
  if (manifest.audioSourceBinding?.toContentVersion !== manifest.contentVersion) {
    throw new Error("rebound audio-source binding targets a different contentVersion");
  }
  if (
    manifest.audioSourceBinding?.fromContentVersion !== manifest.audioSourceBinding?.preparedContentVersion
    || manifest.audioSourceBinding?.fromContentVersion === manifest.contentVersion
  ) {
    throw new Error("rebound audio-source binding has an invalid source version transition");
  }
  assertReboundHistory(manifest.audioSourceBinding, stages);
  return { manifest, audit };
}

function parseArgs(argv) {
  const options = {
    mode: null,
    manifestPath: path.join(toolRoot, "audio", "manifest.json"),
    audioRoot: path.join(toolRoot, "audio"),
    contentRoot: path.join(toolRoot, "content"),
    contentVersion: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (["--prepare", "--rebind", "--check"].includes(arg)) {
      if (options.mode) throw new Error("choose exactly one of --prepare, --rebind, or --check");
      options.mode = arg.slice(2);
    } else if (arg === "--manifest") options.manifestPath = path.resolve(argv[++index]);
    else if (arg === "--audio-root") options.audioRoot = path.resolve(argv[++index]);
    else if (arg === "--content-root") options.contentRoot = path.resolve(argv[++index]);
    else if (arg === "--content-version") options.contentVersion = argv[++index];
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!options.mode) throw new Error("choose exactly one of --prepare, --rebind, or --check");
  if (options.mode === "rebind" && !/^\d+\.\d+\.\d+$/.test(options.contentVersion || "")) {
    throw new Error("--rebind requires --content-version x.y.z");
  }
  const resolvedAudioRoot = path.resolve(options.audioRoot);
  const resolvedManifest = path.resolve(options.manifestPath);
  const relativeManifest = path.relative(resolvedAudioRoot, resolvedManifest);
  if (relativeManifest.startsWith("..") || path.isAbsolute(relativeManifest)) {
    throw new Error("manifest must stay inside audio-root");
  }
  const realAudioRoot = realpathSync(resolvedAudioRoot);
  const realManifestParent = realpathSync(path.dirname(resolvedManifest));
  const realRelativeManifest = path.relative(realAudioRoot, realManifestParent);
  if (realRelativeManifest.startsWith("..") || path.isAbsolute(realRelativeManifest)) {
    throw new Error("manifest parent resolves outside audio-root");
  }
  return options;
}

function resolvePythonRuntime() {
  const configured = String(process.env.JP_SUBTEXT_TTS_PYTHON || "").trim();
  const candidates = configured
    ? [{ command: configured, prefix: [] }]
    : process.platform === "win32"
      ? [{ command: "py", prefix: ["-3"] }, { command: "python", prefix: [] }]
      : [{ command: "python3", prefix: [] }, { command: "python", prefix: [] }];
  for (const candidate of candidates) {
    const probe = spawnSync(candidate.command, [...candidate.prefix, "--version"], {
      encoding: "utf8",
      windowsHide: true,
    });
    if (!probe.error && probe.status === 0) return candidate;
  }
  throw new Error("no Python runtime is available to acquire the shared audio publication lock");
}

async function withAudioPublicationLock(audioRoot, action) {
  const runtime = resolvePythonRuntime();
  const helper = path.join(scriptRoot, "tts", "hold_audio_publication_lock.py");
  const child = spawn(runtime.command, [...runtime.prefix, helper, audioRoot], {
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });
  let stdout = "";
  let stderr = "";
  let spawnError = null;
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  child.on("error", (error) => { spawnError = error; });
  let acquired;
  try {
    acquired = await Promise.race([
      new Promise((resolve, reject) => {
        const inspect = () => {
          if (stdout.includes("LOCKED\n")) resolve(true);
          else if (spawnError) reject(spawnError);
          else if (child.exitCode != null) reject(new Error(stderr.trim() || "audio publication lock helper exited"));
          else setTimeout(inspect, 10);
        };
        inspect();
      }),
      delay(10_000).then(() => { throw new Error("timed out acquiring the shared audio publication lock"); }),
    ]);
  } catch (error) {
    child.stdin.end();
    if (child.exitCode == null) child.kill();
    throw error;
  }
  if (!acquired) throw new Error("unable to acquire the shared audio publication lock");
  let releasing = false;
  try {
    const unexpectedExit = once(child, "exit").then(([code]) => {
      if (!releasing) {
        console.error(stderr.trim() || `audio publication lock helper exited early (${code})`);
        // Losing the OS lock is fail-stop: continuing or rolling back could race
        // a new generator owner. The manifest-last journal handles crash recovery.
        process.exit(1);
      }
      return new Promise(() => {});
    });
    return await Promise.race([action(), unexpectedExit]);
  } finally {
    releasing = true;
    child.stdin.end("\n");
    if (child.exitCode == null) {
      await Promise.race([
        once(child, "exit"),
        delay(5_000).then(() => {
          child.kill();
          throw new Error("audio publication lock helper did not exit cleanly");
        }),
      ]);
    }
  }
}

async function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    const result = await withAudioPublicationLock(options.audioRoot, async () => {
      if (options.mode === "prepare") return prepareAudioSourceBinding(options);
      if (options.mode === "rebind") return rebindAudioContent(options);
      return checkAudioSourceBinding(options);
    });
    console.log(
      `PASS: audio source binding ${options.mode}; ${result.audit.counts.items} items, `
      + `${result.audit.counts.stages} stages, ${result.audit.counts.timelines} timelines.`,
    );
  } catch (error) {
    console.error(`FAIL: ${error.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(scriptFile)) await main();
