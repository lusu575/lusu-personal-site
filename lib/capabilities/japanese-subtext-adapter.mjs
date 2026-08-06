import { createHash } from "node:crypto";
import {
  CONTENT_VERSION,
  localized,
  parseStageId
} from "../../tools/japanese-subtext/lib/constants.mjs";

const SCHEMA_VERSION = 1;
const LEVEL_COUNT = 5;
const STAGES_PER_LEVEL = 50;
const STAGES_PER_BATCH = 10;
const TOTAL_STAGE_COUNT = LEVEL_COUNT * STAGES_PER_LEVEL;
const CATALOG_PATH = "/tools/japanese-subtext/content/catalog.json";
const CATALOG_MAX_BYTES = 16 * 1024;
const INDEX_MAX_BYTES = 64 * 1024;
const BATCH_MAX_BYTES = 640 * 1024;
const LANGUAGES = new Set(["zh", "en", "ja"]);
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const SAFE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const EXPLANATION_KEYS = ["literal", "intent", "evidence", "nuance", "alternative"];

export class JapaneseSubtextCapabilityError extends Error {
  constructor(message, options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = "JapaneseSubtextCapabilityError";
    this.code = String(options.code || "JAPANESE_SUBTEXT_CONTENT_INVALID");
    this.status = Number(options.status || (this.code === "JAPANESE_SUBTEXT_NOT_FOUND" ? 404 : this.code === "JAPANESE_SUBTEXT_INPUT_INVALID" ? 400 : 500));
  }
}

export async function listJapaneseSubtextLevels(client, { lang = "zh" } = {}) {
  const normalizedLang = normalizeLanguage(lang);
  const catalog = await loadCatalog(client);
  return {
    schemaVersion: SCHEMA_VERSION,
    contentVersion: CONTENT_VERSION,
    lang: normalizedLang,
    title: localizedValue(catalog.title, normalizedLang, ""),
    stageCount: TOTAL_STAGE_COUNT,
    levels: catalog.levels.map((level) => ({
      level: level.level,
      jlptTarget: level.jlptTarget,
      description: localizedValue(level.description, normalizedLang, ""),
      stageCount: STAGES_PER_LEVEL,
      coverUrl: `/tools/japanese-subtext/${level.cover}`
    }))
  };
}

export async function listJapaneseSubtextStages(client, options = {}) {
  const level = normalizeLevel(options.level);
  const lang = normalizeLanguage(options.lang);
  const query = normalizeQuery(options.query);
  const limit = normalizeLimit(options.limit);
  const catalog = await loadCatalog(client);
  const levelEntry = catalog.levels[level - 1];
  const index = await loadIndex(client, levelEntry);
  const terms = query ? query.split(/\s+/u).filter(Boolean) : [];
  const matches = index.stages.filter((stage) => {
    if (!terms.length) return true;
    const haystack = [
      ...localizedSearchValues(stage.title),
      ...localizedSearchValues(stage.shortLabel),
      ...stage.genres,
      ...stage.skills
    ].join("\n").normalize("NFKC").toLocaleLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
  const stages = matches.slice(0, limit).map((stage) => projectStageSummary(stage, lang));

  return {
    schemaVersion: SCHEMA_VERSION,
    contentVersion: CONTENT_VERSION,
    lang,
    level,
    jlptTarget: levelEntry.jlptTarget,
    query,
    limit,
    total: matches.length,
    stages
  };
}

export async function getJapaneseSubtextStage(client, stageId, { lang = "zh" } = {}) {
  const parsed = parseStageId(stageId);
  if (!parsed) throw inputError("Stage id must use L1-001 through L5-050.");
  const normalizedId = `L${parsed.level}-${String(parsed.stage).padStart(3, "0")}`;
  if (String(stageId || "").trim() !== normalizedId) {
    throw inputError("Stage id must use the canonical L1-001 format.");
  }
  const normalizedLang = normalizeLanguage(lang);
  const catalog = await loadCatalog(client);
  const levelEntry = catalog.levels[parsed.level - 1];
  const index = await loadIndex(client, levelEntry);
  const summary = index.stages[parsed.stage - 1];
  if (!summary || summary.id !== normalizedId) {
    throw new JapaneseSubtextCapabilityError(`Japanese subtext stage not found: ${normalizedId}`, {
      code: "JAPANESE_SUBTEXT_NOT_FOUND",
      status: 404
    });
  }
  const batchFilename = expectedBatchFilename(parsed.stage);
  if (summary.batch !== batchFilename) throw contentError("The stage index contains an invalid batch reference.");
  const batch = await requestJson(client, `/tools/japanese-subtext/content/level-${parsed.level}/${batchFilename}`, BATCH_MAX_BYTES);
  const stages = validateBatch(batch, parsed.level, batchFilename, index.stages);
  const stage = stages.find((entry) => entry.id === normalizedId);
  if (!stage) {
    throw new JapaneseSubtextCapabilityError(`Japanese subtext stage not found: ${normalizedId}`, {
      code: "JAPANESE_SUBTEXT_NOT_FOUND",
      status: 404
    });
  }
  return projectStage(stage, normalizedLang);
}

async function loadCatalog(client) {
  const catalog = await requestJson(client, CATALOG_PATH, CATALOG_MAX_BYTES);
  if (!isRecord(catalog)
    || catalog.schemaVersion !== SCHEMA_VERSION
    || catalog.contentVersion !== CONTENT_VERSION
    || catalog.stageCount !== TOTAL_STAGE_COUNT
    || !Array.isArray(catalog.levels)
    || catalog.levels.length !== LEVEL_COUNT) {
    throw contentError("The Japanese subtext catalog metadata is invalid.");
  }
  validateLocalized(catalog.title, "catalog title");
  const seen = new Set();
  catalog.levels.forEach((entry, index) => {
    const level = index + 1;
    if (!isRecord(entry) || entry.level !== level || seen.has(entry.level)) {
      throw contentError("The Japanese subtext catalog level sequence is invalid.");
    }
    seen.add(entry.level);
    if (entry.index !== `level-${level}/index.json`
      || entry.cover !== `assets/covers/level-${level}.webp`) {
      throw contentError("The Japanese subtext catalog contains an unsafe level path.");
    }
    requiredText(entry.jlptTarget, "JLPT target", 64);
    validateLocalized(entry.description, "level description");
  });
  return catalog;
}

async function loadIndex(client, levelEntry) {
  const level = levelEntry.level;
  const index = await requestJson(client, `/tools/japanese-subtext/content/level-${level}/index.json`, INDEX_MAX_BYTES);
  if (!isRecord(index)
    || index.schemaVersion !== SCHEMA_VERSION
    || index.contentVersion !== CONTENT_VERSION
    || index.level !== level
    || index.jlptTarget !== levelEntry.jlptTarget
    || !Array.isArray(index.stages)
    || index.stages.length !== STAGES_PER_LEVEL) {
    throw contentError("The Japanese subtext stage index metadata is invalid.");
  }
  const seen = new Set();
  index.stages.forEach((stage, indexPosition) => {
    const stageNumber = indexPosition + 1;
    const expectedId = `L${level}-${String(stageNumber).padStart(3, "0")}`;
    if (!isRecord(stage) || stage.id !== expectedId || stage.stage !== stageNumber || seen.has(stage.id)) {
      throw contentError("The Japanese subtext stage index sequence is invalid.");
    }
    seen.add(stage.id);
    if (stage.batch !== expectedBatchFilename(stageNumber) || !HASH_PATTERN.test(String(stage.contentHash || ""))) {
      throw contentError("The Japanese subtext stage index integrity metadata is invalid.");
    }
    validateLocalized(stage.title, "stage title");
    validateLocalized(stage.shortLabel, "stage short label");
    validateStringArray(stage.genres, "stage genres", 20);
    validateStringArray(stage.skills, "stage skills", 20);
  });
  return index;
}

function validateBatch(batch, level, filename, indexStages) {
  const { start, end, label } = batchRange(filename);
  if (!isRecord(batch)
    || batch.schemaVersion !== SCHEMA_VERSION
    || batch.contentVersion !== CONTENT_VERSION
    || batch.level !== level
    || batch.batch !== label
    || !Array.isArray(batch.stages)
    || batch.stages.length !== STAGES_PER_BATCH) {
    throw contentError("The Japanese subtext stage batch metadata is invalid.");
  }

  const seen = new Set();
  batch.stages.forEach((stage, position) => {
    const stageNumber = start + position;
    const expectedId = `L${level}-${String(stageNumber).padStart(3, "0")}`;
    const indexEntry = indexStages[stageNumber - 1];
    const canonicalHash = isRecord(stage) ? canonicalStageHash(stage) : "";
    if (!isRecord(stage)
      || stage.schemaVersion !== SCHEMA_VERSION
      || stage.contentVersion !== CONTENT_VERSION
      || stage.level !== level
      || stage.stage !== stageNumber
      || stage.id !== expectedId
      || stage.textLocked !== true
      || seen.has(stage.id)
      || !HASH_PATTERN.test(String(stage.contentHash || ""))
      || stage.contentHash !== canonicalHash
      || stage.contentHash !== indexEntry?.contentHash) {
      throw contentError("The Japanese subtext stage batch failed its integrity check.");
    }
    seen.add(stage.id);
    validateStageShape(stage);
  });
  if (end - start + 1 !== STAGES_PER_BATCH) throw contentError("The Japanese subtext batch range is invalid.");
  return batch.stages;
}

function validateStageShape(stage) {
  if (!Number.isSafeInteger(stage.revision) || stage.revision < 1) throw contentError("A stage revision is invalid.");
  requiredText(stage.jlptTarget, "JLPT target", 64);
  validateStringArray(stage.genres, "stage genres", 20);
  validateStringArray(stage.skills, "stage skills", 20);
  requiredText(stage.layout, "stage layout", 64);
  validateLocalized(stage.title, "stage title");
  validateLocalized(stage.setting, "stage setting");
  validateIllustration(stage.illustration, stage.level, stage.stage);
  validateCast(stage.cast);
  validateLines(stage.lines, stage.cast);
  validateQuestions(stage.questions, stage.lines);
  requiredText(stage.contentRating, "content rating", 64);
}

function validateIllustration(illustration, level, stage) {
  if (!isRecord(illustration) || typeof illustration.enabled !== "boolean") {
    throw contentError("A stage illustration record is invalid.");
  }
  validateLocalized(illustration.alt, "illustration alt text");
  requiredText(illustration.style, "illustration style", 128);
  if (illustration.enabled) {
    const expected = `assets/stages/l${level}-${String(stage).padStart(3, "0")}.webp`;
    if (illustration.src !== expected || !HASH_PATTERN.test(String(illustration.sha256 || ""))) {
      throw contentError("A stage illustration integrity record is invalid.");
    }
  }
}

function validateCast(cast) {
  if (!Array.isArray(cast) || !cast.length || cast.length > 20) throw contentError("A stage cast is invalid.");
  const ids = new Set();
  cast.forEach((member) => {
    if (!isRecord(member) || !SAFE_ID_PATTERN.test(String(member.id || "")) || ids.has(member.id)) {
      throw contentError("A stage cast member id is invalid.");
    }
    ids.add(member.id);
    validateLocalized(member.name, "cast name");
    requiredText(member.voiceKey, "voice key", 128);
  });
}

function validateLines(lines, cast) {
  if (!Array.isArray(lines) || !lines.length || lines.length > 50) throw contentError("A stage dialogue is invalid.");
  const castIds = new Set(cast.map((member) => member.id));
  const ids = new Set();
  lines.forEach((line) => {
    if (!isRecord(line)
      || !SAFE_ID_PATTERN.test(String(line.id || ""))
      || ids.has(line.id)
      || !castIds.has(line.speaker)) {
      throw contentError("A stage dialogue line is invalid.");
    }
    ids.add(line.id);
    validateLocalized(line.text, "dialogue text");
    requiredText(line.readingJa, "Japanese reading", 10000);
    optionalSafeId(line.audioId, "dialogue audio id");
  });
}

function validateQuestions(questions, lines) {
  if (!Array.isArray(questions) || !questions.length || questions.length > 20) {
    throw contentError("A stage question set is invalid.");
  }
  const lineIds = new Set(lines.map((line) => line.id));
  const questionIds = new Set();
  questions.forEach((question) => {
    if (!isRecord(question)
      || !SAFE_ID_PATTERN.test(String(question.id || ""))
      || questionIds.has(question.id)
      || !["single", "multiple"].includes(question.type)) {
      throw contentError("A stage question is invalid.");
    }
    questionIds.add(question.id);
    validateLocalized(question.prompt, "question prompt");
    if (!Array.isArray(question.options) || question.options.length < 2 || question.options.length > 10) {
      throw contentError("A stage question option set is invalid.");
    }
    const optionIds = new Set();
    question.options.forEach((option) => {
      if (!isRecord(option) || !SAFE_ID_PATTERN.test(String(option.id || "")) || optionIds.has(option.id)) {
        throw contentError("A stage question option is invalid.");
      }
      optionIds.add(option.id);
      validateLocalized(option.text, "option text");
      requiredText(option.readingJa, "option Japanese reading", 10000);
      optionalSafeId(option.audioId, "option audio id");
    });
    if (!Array.isArray(question.correctOptionIds)
      || !question.correctOptionIds.length
      || question.correctOptionIds.some((id) => !optionIds.has(id))
      || (question.type === "single" && question.correctOptionIds.length !== 1)) {
      throw contentError("A stage answer key is invalid.");
    }
    if (!Array.isArray(question.evidenceLineIds)
      || question.evidenceLineIds.some((id) => !lineIds.has(id))) {
      throw contentError("A stage evidence list is invalid.");
    }
    if (!isRecord(question.explanation)) throw contentError("A stage explanation is invalid.");
    EXPLANATION_KEYS.forEach((key) => validateLocalized(question.explanation[key], `explanation ${key}`));
  });
}

function projectStageSummary(stage, lang) {
  return {
    id: stage.id,
    stage: stage.stage,
    title: localizedValue(stage.title, lang, stage.id),
    shortLabel: localizedValue(stage.shortLabel, lang, stage.id),
    genres: [...stage.genres],
    skills: [...stage.skills],
    contentHash: stage.contentHash
  };
}

function projectStage(stage, lang) {
  const illustration = stage.illustration.enabled
    ? {
        enabled: true,
        url: `/tools/japanese-subtext/${stage.illustration.src}`,
        alt: localizedValue(stage.illustration.alt, lang, ""),
        style: stage.illustration.style,
        sha256: stage.illustration.sha256
      }
    : {
        enabled: false,
        url: null,
        alt: localizedValue(stage.illustration.alt, lang, ""),
        style: stage.illustration.style,
        sha256: null
      };

  return {
    schemaVersion: SCHEMA_VERSION,
    contentVersion: CONTENT_VERSION,
    lang,
    id: stage.id,
    revision: stage.revision,
    level: stage.level,
    stage: stage.stage,
    jlptTarget: stage.jlptTarget,
    genres: [...stage.genres],
    skills: [...stage.skills],
    layout: stage.layout,
    title: localizedValue(stage.title, lang, stage.id),
    titleJa: localizedValue(stage.title, "ja", stage.id),
    setting: localizedValue(stage.setting, lang, ""),
    settingJa: localizedValue(stage.setting, "ja", ""),
    illustration,
    cast: stage.cast.map((member) => ({
      id: member.id,
      name: localizedValue(member.name, lang, member.id),
      nameJa: localizedValue(member.name, "ja", member.id),
      voiceKey: member.voiceKey
    })),
    lines: stage.lines.map((line) => ({
      id: line.id,
      speaker: line.speaker,
      text: localizedValue(line.text, lang, ""),
      textJa: localizedValue(line.text, "ja", ""),
      readingJa: line.readingJa,
      audioId: optionalOutput(line.audioId)
    })),
    questions: stage.questions.map((question) => ({
      id: question.id,
      type: question.type,
      prompt: localizedValue(question.prompt, lang, ""),
      promptJa: localizedValue(question.prompt, "ja", ""),
      options: question.options.map((option) => ({
        id: option.id,
        text: localizedValue(option.text, lang, ""),
        textJa: localizedValue(option.text, "ja", ""),
        readingJa: option.readingJa,
        audioId: optionalOutput(option.audioId)
      })),
      correctOptionIds: [...question.correctOptionIds],
      evidenceLineIds: [...question.evidenceLineIds],
      explanation: Object.fromEntries(EXPLANATION_KEYS.map((key) => [
        key,
        localizedValue(question.explanation[key], lang, "")
      ]))
    })),
    contentRating: stage.contentRating,
    textLocked: true,
    contentHash: stage.contentHash
  };
}

async function requestJson(client, path, maxResponseBytes) {
  if (!client || typeof client.requestJson !== "function") {
    throw new TypeError("A SiteClient-compatible requester is required.");
  }
  return client.requestJson(path, { maxResponseBytes });
}

function expectedBatchFilename(stage) {
  const start = Math.floor((stage - 1) / STAGES_PER_BATCH) * STAGES_PER_BATCH + 1;
  const end = start + STAGES_PER_BATCH - 1;
  return `batch-${String(start).padStart(3, "0")}-${String(end).padStart(3, "0")}.json`;
}

function batchRange(filename) {
  const match = /^batch-([0-9]{3})-([0-9]{3})\.json$/.exec(filename);
  if (!match) throw contentError("The Japanese subtext batch name is invalid.");
  const start = Number(match[1]);
  const end = Number(match[2]);
  return { start, end, label: `${match[1]}-${match[2]}` };
}

function normalizeLevel(value) {
  const level = Number(value);
  if (!Number.isSafeInteger(level) || level < 1 || level > LEVEL_COUNT) {
    throw inputError("Level must be an integer from 1 through 5.");
  }
  return level;
}

function normalizeLanguage(value) {
  const lang = String(value || "").trim().toLowerCase();
  if (!LANGUAGES.has(lang)) throw inputError("Language must be zh, en, or ja.");
  return lang;
}

function normalizeQuery(value) {
  const query = String(value || "").normalize("NFKC").trim().toLocaleLowerCase();
  if (query.length > 200 || /[\u0000-\u001F\u007F]/u.test(query)) {
    throw inputError("The Japanese subtext query is invalid.");
  }
  return query;
}

function normalizeLimit(value) {
  if (value === undefined || value === null || value === "") return 50;
  const limit = Number(value);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50) {
    throw inputError("Limit must be an integer from 1 through 50.");
  }
  return limit;
}

function localizedSearchValues(value) {
  if (typeof value === "string") return [value];
  if (!isRecord(value)) return [];
  return [value.zh, value.en, value.ja].filter((entry) => typeof entry === "string");
}

function localizedValue(value, lang, fallback) {
  return requiredText(localized(value, lang, fallback), "localized content", 10000);
}

function validateLocalized(value, label) {
  if (typeof value === "string") {
    requiredText(value, label, 10000);
    return;
  }
  if (!isRecord(value) || !["zh", "en", "ja"].some((lang) => typeof value[lang] === "string" && value[lang].trim())) {
    throw contentError(`The ${label} is invalid.`);
  }
  for (const lang of ["zh", "en", "ja"]) {
    if (value[lang] !== undefined) requiredText(value[lang], label, 10000);
  }
}

function validateStringArray(value, label, maxItems) {
  if (!Array.isArray(value) || value.length > maxItems) throw contentError(`The ${label} is invalid.`);
  value.forEach((entry) => requiredText(entry, label, 128));
}

function requiredText(value, label, maxLength) {
  const text = String(value || "").trim();
  if (!text || text.length > maxLength || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(text)) {
    throw contentError(`The ${label} is invalid.`);
  }
  return text;
}

function optionalSafeId(value, label) {
  if (value === undefined || value === null || value === "") return;
  if (!SAFE_ID_PATTERN.test(String(value))) throw contentError(`The ${label} is invalid.`);
}

function optionalOutput(value) {
  return value === undefined || value === null || value === "" ? null : String(value);
}

function canonicalStageHash(stage) {
  const clean = structuredClone(stage);
  delete clean.contentHash;
  return createHash("sha256").update(stableStringify(clean)).digest("hex");
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function inputError(message) {
  return new JapaneseSubtextCapabilityError(message, {
    code: "JAPANESE_SUBTEXT_INPUT_INVALID",
    status: 400
  });
}

function contentError(message, cause) {
  return new JapaneseSubtextCapabilityError(message, {
    code: "JAPANESE_SUBTEXT_CONTENT_INVALID",
    status: 500,
    cause
  });
}
