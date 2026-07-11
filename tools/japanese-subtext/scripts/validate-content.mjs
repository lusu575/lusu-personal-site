import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { contentHash, contentRoot, expectedShape, loadAllStages, readJson, toolRoot } from "./content-utils.mjs";

const skipAudio = process.argv.includes("--skip-audio");
const allowPartial = process.argv.includes("--allow-partial");
const allowUnlocked = process.argv.includes("--allow-unlocked");
const errors = [];
const warnings = [];
const stages = await loadAllStages();
const voicesPayload = await readJson(path.join(contentRoot, "voices.json"));
const voices = new Set(Object.keys(voicesPayload.voices || {}));
const blueprintPayload = await readJson(path.join(contentRoot, "blueprint.json"));
const blueprintEntries = Array.isArray(blueprintPayload.entries) ? blueprintPayload.entries : [];
const blueprintById = new Map(blueprintEntries.map((entry) => [entry.id, entry]));
const audioManifest = await readJson(path.join(toolRoot, "audio", "manifest.json"));
const ids = new Set();
const fingerprints = new Map();
const answerPositions = new Map();
const genreByLevel = new Map();
const singleChoiceLengthBias = { eligible: 0, uniqueLongestCorrect: 0 };

validateBlueprint();

if (!allowPartial) check(stages.length === 250, `Expected 250 stages; found ${stages.length}.`);
for (let level = 1; level <= 5; level += 1) {
  const selected = stages.filter((stage) => stage.level === level).sort((a, b) => a.stage - b.stage);
  if (!allowPartial) {
    check(selected.length === 50, `Level ${level}: expected 50 stages; found ${selected.length}.`);
    check(selected.every((stage, index) => stage.stage === index + 1), `Level ${level}: stage numbers are not continuous 1–50.`);
  }
  genreByLevel.set(level, new Set(selected.flatMap((stage) => stage.genres || [])));
}

for (const stage of stages) validateStage(stage);
if (!allowPartial) {
  for (const [level, genres] of genreByLevel) check(genres.size >= 8, `Level ${level}: only ${genres.size} genres; expected at least 8.`);
}

const answerCounts = [...answerPositions.values()];
if (answerCounts.length > 1) {
  const max = Math.max(...answerCounts);
  const min = Math.min(...answerCounts);
  if (max > Math.max(12, min * 2.2)) warnings.push(`Correct-option distribution may be skewed: ${JSON.stringify(Object.fromEntries(answerPositions))}`);
}

if (singleChoiceLengthBias.eligible >= 10) {
  const ratio = singleChoiceLengthBias.uniqueLongestCorrect / singleChoiceLengthBias.eligible;
  check(ratio <= 0.6, `Correct answers are uniquely the longest Japanese option too often: ${singleChoiceLengthBias.uniqueLongestCorrect}/${singleChoiceLengthBias.eligible}.`);
}

if (errors.length) {
  console.error(`Japanese subtext content validation failed with ${errors.length} error(s):`);
  errors.slice(0, 200).forEach((error) => console.error(`- ${error}`));
  if (errors.length > 200) console.error(`- … ${errors.length - 200} more`);
  process.exitCode = 1;
} else {
  const shapeLabel = allowPartial ? "partial draft" : "5 levels × 50";
  const lockLabel = allowUnlocked ? "unlocked text allowed" : "content hashes valid";
  console.log(`PASS: ${stages.length} stages (${shapeLabel}), blueprint/IDs/links/localization/${lockLabel}${skipAudio ? " (audio checks skipped)" : ", audio links present"}.`);
}
warnings.forEach((warning) => console.warn(`WARN: ${warning}`));

function validateBlueprint() {
  check(blueprintPayload.schemaVersion === 1, "Blueprint schemaVersion must be 1.");
  check(blueprintPayload.contentVersion === "1.0.0", "Blueprint contentVersion must be 1.0.0.");
  check(blueprintPayload.blueprintStatus === "complete", "Blueprint must be marked complete.");
  check(blueprintEntries.length === 250, `Blueprint must contain exactly 250 entries; found ${blueprintEntries.length}.`);
  check(blueprintById.size === blueprintEntries.length, "Blueprint contains duplicate stage IDs.");
  const premiseFingerprints = new Map();
  const subtextFingerprints = new Map();
  for (const entry of blueprintEntries) {
    const prefix = entry?.id || "<missing-blueprint-id>";
    check(/^L[1-5]-[0-9]{3}$/.test(prefix), `${prefix}: invalid blueprint ID.`);
    check(prefix === `L${entry.level}-${String(entry.stage).padStart(3, "0")}`, `${prefix}: blueprint ID does not match level/stage.`);
    checkLocalized(entry.premise, `${prefix}.blueprint.premise`);
    checkLocalized(entry.coreSubtext, `${prefix}.blueprint.coreSubtext`);
    check(Array.isArray(entry.answerPositions) && entry.answerPositions.length === entry.questionCount, `${prefix}: blueprint answer-position count mismatch.`);
    check(["none", "crayon", "chibi-four-panel"].includes(entry.illustration?.style), `${prefix}: blueprint illustration style is not allowed.`);
    check(!/(?:monochrome|black.?and.?white|line.?art|black-white|黑白|线稿|線画|モノクロ)/iu.test(JSON.stringify(entry)), `${prefix}: blueprint still references a prohibited black-and-white line-art style.`);
    uniqueFingerprint(premiseFingerprints, normalize(entry.premise?.ja), prefix, "premise");
    uniqueFingerprint(subtextFingerprints, normalize(entry.coreSubtext?.ja), prefix, "core subtext");
  }
  for (let level = 1; level <= 5; level += 1) {
    const selected = blueprintEntries.filter((entry) => entry.level === level).sort((a, b) => a.stage - b.stage);
    check(selected.length === 50, `Blueprint level ${level}: expected 50 entries; found ${selected.length}.`);
    check(selected.every((entry, index) => entry.stage === index + 1), `Blueprint level ${level}: stage numbers are not continuous 1–50.`);
    check(new Set(selected.flatMap((entry) => entry.genres || [])).size >= 8, `Blueprint level ${level}: fewer than 8 genres.`);
    let repeatedTwists = 1;
    for (let index = 1; index < selected.length; index += 1) {
      repeatedTwists = selected[index].twistType === selected[index - 1].twistType ? repeatedTwists + 1 : 1;
      check(repeatedTwists <= 2, `Blueprint level ${level}: twist ${selected[index].twistType} repeats more than twice consecutively near stage ${selected[index].stage}.`);
    }
  }
}

function validateStage(stage) {
  const prefix = stage?.id || "<missing-id>";
  const blueprint = blueprintById.get(prefix);
  check(stage?.schemaVersion === 1, `${prefix}: schemaVersion must be 1.`);
  check(stage?.contentVersion === "1.0.0", `${prefix}: contentVersion must be 1.0.0.`);
  check(/^L[1-5]-[0-9]{3}$/.test(prefix), `${prefix}: invalid ID.`);
  check(!ids.has(prefix), `${prefix}: duplicate stage ID.`);
  ids.add(prefix);
  check(prefix === `L${stage.level}-${String(stage.stage).padStart(3, "0")}`, `${prefix}: ID does not match level/stage.`);
  check(Boolean(blueprint), `${prefix}: no matching blueprint entry.`);
  check(stage.jlptTarget === ["N3", "N2", "N1", "N1-advanced", "N1-pragmatics"][stage.level - 1], `${prefix}: incorrect JLPT target.`);
  checkLocalized(stage.title, `${prefix}.title`);
  checkLocalized(stage.setting, `${prefix}.setting`);
  check(Array.isArray(stage.genres) && stage.genres.length > 0, `${prefix}: genres missing.`);
  check(Array.isArray(stage.skills) && stage.skills.length > 0, `${prefix}: skills missing.`);
  if (blueprint) {
    check(sameArray(stage.genres, blueprint.genres), `${prefix}: genres diverge from the locked blueprint.`);
    check(sameArray(stage.skills, blueprint.skills), `${prefix}: skills diverge from the locked blueprint.`);
    check(stage.layout === blueprint.layout, `${prefix}: layout diverges from the locked blueprint.`);
    check(stage.questions?.length === blueprint.questionCount, `${prefix}: question count diverges from the locked blueprint.`);
    check(stage.lines?.length === blueprint.estimatedLineCount, `${prefix}: line count diverges from the locked blueprint.`);
    check(stage.cast?.length === blueprint.characterCount, `${prefix}: cast count diverges from the locked blueprint.`);
    check(stage.illustration?.enabled === blueprint.illustration?.enabled, `${prefix}: illustration enablement diverges from the locked blueprint.`);
    check(stage.illustration?.style === blueprint.illustration?.style, `${prefix}: illustration style diverges from the locked blueprint.`);
  }
  check(Array.isArray(stage.cast) && stage.cast.length >= 1 && stage.cast.length <= 5, `${prefix}: cast count invalid.`);
  const castIds = new Set();
  for (const person of stage.cast || []) {
    check(!castIds.has(person.id), `${prefix}: duplicate cast ID ${person.id}.`);
    castIds.add(person.id);
    checkLocalized(person.name, `${prefix}.cast.${person.id}.name`);
    check(voices.has(person.voiceKey), `${prefix}: undefined voiceKey ${person.voiceKey}.`);
  }
  const shape = expectedShape(stage.level, stage.stage);
  check(Array.isArray(stage.lines) && inRange(stage.lines.length, shape.lines), `${prefix}: expected ${shape.lines[0]}–${shape.lines[1]} lines; found ${stage.lines?.length ?? 0}.`);
  check(Array.isArray(stage.questions) && inRange(stage.questions.length, shape.questions), `${prefix}: expected ${shape.questions[0]}–${shape.questions[1]} questions; found ${stage.questions?.length ?? 0}.`);
  const lineIds = new Set();
  for (const [index, line] of (stage.lines || []).entries()) {
    const expected = `line-${String(index + 1).padStart(3, "0")}`;
    check(line.id === expected, `${prefix}: line ${index + 1} should be ${expected}.`);
    lineIds.add(line.id);
    check(castIds.has(line.speaker), `${prefix}.${line.id}: unknown speaker ${line.speaker}.`);
    checkLocalized(line.text, `${prefix}.${line.id}.text`);
    check(nonEmpty(line.readingJa) && nonEmpty(line.ttsTextJa), `${prefix}.${line.id}: reading/tts text missing.`);
    check(!/\p{Script=Han}/u.test(line.readingJa || ""), `${prefix}.${line.id}: readingJa still contains kanji.`);
    check(line.audioId === `${prefix}-${line.id}`, `${prefix}.${line.id}: unstable audio ID.`);
    check(Array.isArray(line.tokens) && line.tokens.length > 0, `${prefix}.${line.id}: tokens missing.`);
    for (const [tokenIndex, token] of (line.tokens || []).entries()) {
      const tokenId = `token-${String(tokenIndex + 1).padStart(3, "0")}`;
      check(token.id === tokenId, `${prefix}.${line.id}: token IDs must be continuous.`);
      check(nonEmpty(token.text) && nonEmpty(token.reading), `${prefix}.${line.id}.${token.id}: token text/reading missing.`);
      check(!/\p{Script=Han}/u.test(token.reading || ""), `${prefix}.${line.id}.${token.id}: token reading still contains kanji.`);
      check(token.audioId === `${prefix}-${line.id}-${token.id}`, `${prefix}.${line.id}.${token.id}: invalid audio ID.`);
      if (!skipAudio) check(audioManifest.items?.[token.audioId], `${prefix}.${line.id}.${token.id}: missing audio manifest item.`);
    }
    if (!skipAudio) check(audioManifest.items?.[line.audioId], `${prefix}.${line.id}: missing line audio manifest item.`);
  }
  for (const [questionIndex, question] of (stage.questions || []).entries()) {
    check(question.id === `q${questionIndex + 1}`, `${prefix}: question IDs must be continuous.`);
    check(["single", "multiple"].includes(question.type), `${prefix}.${question.id}: invalid question type.`);
    checkLocalized(question.prompt, `${prefix}.${question.id}.prompt`);
    check(Array.isArray(question.options) && inRange(question.options.length, [3, 6]), `${prefix}.${question.id}: expected 3–6 options.`);
    const optionIds = new Set((question.options || []).map((option) => option.id));
    const correct = question.correctOptionIds || [];
    check(question.type !== "single" || correct.length === 1, `${prefix}.${question.id}: single choice needs exactly one answer.`);
    check(question.type !== "multiple" || correct.length >= 2, `${prefix}.${question.id}: multiple choice needs at least two answers.`);
    correct.forEach((id) => {
      check(optionIds.has(id), `${prefix}.${question.id}: correct option ${id} does not exist.`);
      answerPositions.set(id, (answerPositions.get(id) || 0) + 1);
    });
    for (const option of question.options || []) {
      checkLocalized(option.text, `${prefix}.${question.id}.${option.id}.text`);
      check(nonEmpty(option.ttsTextJa), `${prefix}.${question.id}.${option.id}: tts text missing.`);
      check(option.audioId === `${prefix}-${question.id}-${option.id}`, `${prefix}.${question.id}.${option.id}: invalid audio ID.`);
      if (!skipAudio) check(audioManifest.items?.[option.audioId], `${prefix}.${question.id}.${option.id}: missing option audio manifest item.`);
    }
    const blueprintAnswer = blueprint?.answerPositions?.[questionIndex];
    if (blueprintAnswer) {
      const positions = correct.map((id) => (question.options || []).findIndex((option) => option.id === id) + 1).sort((a, b) => a - b);
      const expectedPositions = [...(blueprintAnswer.correctOptionPositions || [])].sort((a, b) => a - b);
      check(question.type === blueprintAnswer.type, `${prefix}.${question.id}: question type diverges from the locked blueprint.`);
      check(sameArray(positions, expectedPositions), `${prefix}.${question.id}: correct answer position diverges from the locked blueprint.`);
    }
    if (question.type === "single" && correct.length === 1) {
      const lengths = (question.options || []).map((option) => Array.from(option.text?.ja || "").length);
      const correctIndex = (question.options || []).findIndex((option) => option.id === correct[0]);
      if (correctIndex >= 0 && lengths.length) {
        singleChoiceLengthBias.eligible += 1;
        const max = Math.max(...lengths);
        if (lengths[correctIndex] === max && lengths.filter((length) => length === max).length === 1) singleChoiceLengthBias.uniqueLongestCorrect += 1;
      }
    }
    (question.evidenceLineIds || []).forEach((id) => check(lineIds.has(id), `${prefix}.${question.id}: evidence line ${id} does not exist.`));
    for (const key of ["literal", "intent", "evidence", "nuance", "alternative"]) checkLocalized(question.explanation?.[key], `${prefix}.${question.id}.explanation.${key}`);
  }
  check(stage.audio?.sceneAudioId === `${prefix}-scene`, `${prefix}: invalid sceneAudioId.`);
  check(stage.audio?.timelineId === `${prefix}-timeline`, `${prefix}: invalid timelineId.`);
  check(voices.has(stage.audio?.optionVoiceKey), `${prefix}: undefined option voice ${stage.audio?.optionVoiceKey}.`);
  check(stage.passRule?.type === "all_questions_correct", `${prefix}: invalid pass rule.`);
  check(stage.contentRating === "general", `${prefix}: content rating must be general.`);
  if (!allowUnlocked) {
    check(stage.textLocked === true, `${prefix}: text is not locked.`);
    check(stage.contentHash === contentHash(stage), `${prefix}: content hash mismatch.`);
  }
  if (stage.illustration?.enabled) {
    check(/^assets\/[a-z0-9._/-]+\.(webp|png)$/i.test(stage.illustration.src) && !stage.illustration.src.includes(".."), `${prefix}: unsafe illustration path.`);
    checkLocalized(stage.illustration.alt, `${prefix}.illustration.alt`);
    const illustrationFile = path.resolve(toolRoot, stage.illustration.src || "");
    check(illustrationFile.startsWith(`${path.resolve(toolRoot, "assets")}${path.sep}`), `${prefix}: illustration resolves outside the tool asset directory.`);
    check(existsSync(illustrationFile) && statSync(illustrationFile).size > 0, `${prefix}: illustration file is missing or empty.`);
  }
  if (!skipAudio) {
    check(audioManifest.items?.[stage.audio?.sceneAudioId], `${prefix}: missing scene audio manifest item.`);
    check(audioManifest.stages?.[prefix], `${prefix}: missing audio timeline.`);
  }
  const serialized = JSON.stringify(stage);
  check(!/(?:[A-Za-z]:\\|file:\/\/|\\\\[^\\])/i.test(serialized), `${prefix}: local absolute path leaked.`);
  check(!/<\/?[a-z][^>]*>/i.test(serialized), `${prefix}: untreated HTML found.`);
  const fingerprint = normalize((stage.lines || []).map((line) => line.text?.ja).join(""));
  if (fingerprint) {
    const previous = fingerprints.get(fingerprint);
    check(!previous, `${prefix}: dialogue is an exact duplicate of ${previous}.`);
    fingerprints.set(fingerprint, prefix);
  }
}

function uniqueFingerprint(map, fingerprint, id, label) {
  if (!fingerprint) return;
  const previous = map.get(fingerprint);
  check(!previous, `${id}: blueprint ${label} exactly duplicates ${previous}.`);
  map.set(fingerprint, id);
}

function checkLocalized(value, label) {
  check(value && typeof value === "object" && ["ja", "zh", "en"].every((key) => nonEmpty(value[key])), `${label}: ja/zh/en must all be non-empty.`);
}

function check(condition, message) {
  if (!condition) errors.push(message);
}

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function inRange(value, [min, max]) {
  return Number.isInteger(value) && value >= min && value <= max;
}

function sameArray(left, right) {
  return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((value, index) => value === right[index]);
}

function normalize(value) {
  return String(value || "").normalize("NFKC").replace(/[\s\p{P}\p{S}]/gu, "").toLowerCase();
}
