import { createHash } from "node:crypto";

export const AUDIO_SOURCE_HASH_SCHEMA_VERSION = "japanese-subtext-audio-source-v1";
export const SCENE_SOURCE_HASH_SCHEMA_VERSION = "japanese-subtext-scene-source-v1";

function requiredString(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function projectPauseAfterMs(line, label) {
  if (!Object.hasOwn(line, "pauseAfterMs")) return { mode: "default" };
  const value = line.pauseAfterMs;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error(`${label}.pauseAfterMs must be a non-negative integer when present`);
  }
  return { mode: "explicit", value };
}

/**
 * Project only the fields that can change a published audio task, scene, or
 * timeline. Delivery-only state such as contentVersion, revision, artwork,
 * translations, answers, and explanations is deliberately excluded.
 */
export function projectStageAudioSource(stage) {
  if (!stage || typeof stage !== "object") throw new Error("stage must be an object");
  const stageId = requiredString(stage.id, "stage.id");
  const level = Number(stage.level);
  if (!Number.isInteger(level) || level < 1 || level > 5) {
    throw new Error(`${stageId}: level must be an integer from 1 to 5`);
  }
  const sceneAudioId = requiredString(stage.audio?.sceneAudioId, `${stageId}.audio.sceneAudioId`);
  const timelineId = requiredString(stage.audio?.timelineId, `${stageId}.audio.timelineId`);
  const optionVoiceKey = requiredString(stage.audio?.optionVoiceKey, `${stageId}.audio.optionVoiceKey`);
  const castVoices = new Map();
  for (const member of stage.cast || []) {
    const castId = requiredString(member?.id, `${stageId}.cast.id`);
    if (castVoices.has(castId)) throw new Error(`${stageId}: duplicate cast id ${castId}`);
    castVoices.set(castId, requiredString(member?.voiceKey, `${stageId}/${castId}.voiceKey`));
  }

  const audioIds = new Set([sceneAudioId]);
  const claimAudioId = (value, label) => {
    const audioId = requiredString(value, label);
    if (audioIds.has(audioId)) throw new Error(`${stageId}: duplicate audio id ${audioId}`);
    audioIds.add(audioId);
    return audioId;
  };

  const lines = (stage.lines || []).map((line, lineIndex) => {
    const lineId = requiredString(line?.id, `${stageId}.lines[${lineIndex}].id`);
    const speaker = requiredString(line?.speaker, `${stageId}/${lineId}.speaker`);
    const voiceKey = castVoices.get(speaker);
    if (!voiceKey) throw new Error(`${stageId}/${lineId}: speaker ${speaker} has no voiceKey`);
    const tokens = (line.tokens || []).map((token, tokenIndex) => ({
      id: requiredString(token?.id, `${stageId}/${lineId}.tokens[${tokenIndex}].id`),
      audioId: claimAudioId(token?.audioId, `${stageId}/${lineId}.tokens[${tokenIndex}].audioId`),
      surface: requiredString(token?.text, `${stageId}/${lineId}.tokens[${tokenIndex}].text`),
      reading: requiredString(token?.reading, `${stageId}/${lineId}.tokens[${tokenIndex}].reading`),
      voiceKey,
    }));
    const pauseAfterMs = projectPauseAfterMs(line, `${stageId}/${lineId}`);
    return {
      id: lineId,
      audioId: claimAudioId(line?.audioId, `${stageId}/${lineId}.audioId`),
      speaker,
      voiceKey,
      surface: requiredString(line?.ttsTextJa, `${stageId}/${lineId}.ttsTextJa`),
      reading: requiredString(line?.readingJa, `${stageId}/${lineId}.readingJa`),
      pauseAfterMs,
      tokens,
    };
  });

  const questions = (stage.questions || []).map((question, questionIndex) => ({
    id: requiredString(question?.id, `${stageId}.questions[${questionIndex}].id`),
    options: (question.options || []).map((option, optionIndex) => ({
      id: requiredString(option?.id, `${stageId}.questions[${questionIndex}].options[${optionIndex}].id`),
      audioId: claimAudioId(
        option?.audioId,
        `${stageId}.questions[${questionIndex}].options[${optionIndex}].audioId`,
      ),
      surface: requiredString(
        option?.ttsTextJa,
        `${stageId}.questions[${questionIndex}].options[${optionIndex}].ttsTextJa`,
      ),
      reading: requiredString(
        option?.readingJa,
        `${stageId}.questions[${questionIndex}].options[${optionIndex}].readingJa`,
      ),
      voiceKey: optionVoiceKey,
    })),
  }));

  return {
    schemaVersion: AUDIO_SOURCE_HASH_SCHEMA_VERSION,
    stageId,
    level,
    sceneAudioId,
    timelineId,
    optionVoiceKey,
    lines,
    questions,
  };
}

export function computeStageAudioSourceHash(stage) {
  return createHash("sha256")
    .update(serializeStageAudioSource(stage), "utf8")
    .digest("hex");
}

export function serializeStageAudioSource(stage) {
  return canonicalJson(projectStageAudioSource(stage));
}

export function projectStageSceneSource(stage) {
  if (!stage || typeof stage !== "object") throw new Error("stage must be an object");
  const stageId = requiredString(stage.id, "stage.id");
  return {
    schemaVersion: SCENE_SOURCE_HASH_SCHEMA_VERSION,
    stageId,
    sceneAudioId: requiredString(stage.audio?.sceneAudioId, `${stageId}.audio.sceneAudioId`),
    timelineId: requiredString(stage.audio?.timelineId, `${stageId}.audio.timelineId`),
    lines: (stage.lines || []).map((line, index) => ({
      id: requiredString(line?.id, `${stageId}.lines[${index}].id`),
      audioId: requiredString(line?.audioId, `${stageId}.lines[${index}].audioId`),
      pauseAfterMs: projectPauseAfterMs(line, `${stageId}/${line?.id || index}`),
    })),
  };
}

export function serializeStageSceneSource(stage) {
  return canonicalJson(projectStageSceneSource(stage));
}

export function computeStageSceneSourceHash(stage) {
  return createHash("sha256").update(serializeStageSceneSource(stage), "utf8").digest("hex");
}

export function expectedStageAudioIds(stage) {
  const projection = projectStageAudioSource(stage);
  return {
    scene: [projection.sceneAudioId],
    line: projection.lines.map((line) => line.audioId),
    token: projection.lines.flatMap((line) => line.tokens.map((token) => token.audioId)),
    option: projection.questions.flatMap((question) => question.options.map((option) => option.audioId)),
  };
}

export function stableAudioBindingHash(value) {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}
