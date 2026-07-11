import {
  CONTENT_VERSION, DISPLAY_MODES, MEDAL_RANK, OPTION_LANGUAGES, PLAYBACK_RATES,
  PROGRESS_KEY, SETTINGS_KEY, UI_LANGUAGES, clampNumber, isoNow, parseStageId, stageId
} from "./constants.mjs?v=20260711-japanese-subtext-r11";

export function defaultSettings(uiLanguage = "zh") {
  return {
    schemaVersion: 1,
    contentVersion: CONTENT_VERSION,
    uiLanguage: UI_LANGUAGES.includes(uiLanguage) ? uiLanguage : "zh",
    displayMode: "japanese",
    optionLanguage: "ja",
    kana: false,
    optionText: true,
    optionAudio: true,
    autoReadOptions: false,
    autoplay: true,
    playbackRate: 1,
    muted: false,
    updatedAt: isoNow()
  };
}

export function defaultProgress() {
  return {
    schemaVersion: 1,
    contentVersion: CONTENT_VERSION,
    revision: 1,
    currentLevel: 1,
    currentStage: 1,
    unlockedStageIds: ["L1-001"],
    stageProgress: {},
    updatedAt: isoNow()
  };
}

export function loadLocalState(storage = localStorageOrNull(), languageHint = "zh") {
  const settingsResult = readStored(storage, SETTINGS_KEY);
  const progressResult = readStored(storage, PROGRESS_KEY);
  return {
    settings: sanitizeSettings(settingsResult.value, languageHint),
    progress: sanitizeProgress(progressResult.value),
    damaged: settingsResult.damaged || progressResult.damaged
  };
}

function readStored(storage, key) {
  try {
    const raw = storage?.getItem?.(key);
    if (!raw) return { value: null, damaged: false };
    return { value: JSON.parse(raw), damaged: false };
  } catch {
    return { value: null, damaged: true };
  }
}

export function saveSettings(settings, storage = localStorageOrNull()) {
  const clean = sanitizeSettings({ ...settings, updatedAt: isoNow() }, settings?.uiLanguage);
  try {
    storage?.setItem?.(SETTINGS_KEY, JSON.stringify(clean));
  } catch {
    // Storage can be unavailable in private/embedded contexts. Keep the
    // in-memory session usable instead of turning a preference change into a
    // blocking error.
  }
  return clean;
}

export function saveProgress(progress, storage = localStorageOrNull()) {
  const clean = sanitizeProgress({ ...progress, updatedAt: isoNow() });
  try {
    storage?.setItem?.(PROGRESS_KEY, JSON.stringify(clean));
  } catch {
    // See saveSettings: local persistence is best-effort and must not block a
    // training session.
  }
  return clean;
}

export function resetLocalState(storage = localStorageOrNull(), languageHint = "zh") {
  try {
    storage?.removeItem?.(PROGRESS_KEY);
    storage?.removeItem?.(SETTINGS_KEY);
  } catch {
    // The reset still returns a clean in-memory state when storage is denied.
  }
  return { settings: defaultSettings(languageHint), progress: defaultProgress() };
}

export function sanitizeSettings(input, languageHint = "zh") {
  const base = defaultSettings(languageHint);
  if (!input || typeof input !== "object" || Array.isArray(input)) return base;
  const rate = PLAYBACK_RATES.includes(Number(input.playbackRate)) ? Number(input.playbackRate) : 1;
  return {
    ...base,
    uiLanguage: UI_LANGUAGES.includes(input.uiLanguage) ? input.uiLanguage : base.uiLanguage,
    displayMode: DISPLAY_MODES.includes(input.displayMode) ? input.displayMode : base.displayMode,
    optionLanguage: OPTION_LANGUAGES.includes(input.optionLanguage) ? input.optionLanguage : "ja",
    kana: input.kana === true,
    optionText: input.optionText !== false,
    optionAudio: input.optionAudio !== false,
    autoReadOptions: input.autoReadOptions === true,
    autoplay: input.autoplay !== false,
    playbackRate: rate,
    muted: input.muted === true,
    updatedAt: validIso(input.updatedAt) || base.updatedAt
  };
}

export function sanitizeProgress(input) {
  const base = defaultProgress();
  if (!input || typeof input !== "object" || Array.isArray(input)) return base;
  const stageProgress = {};
  if (input.stageProgress && typeof input.stageProgress === "object" && !Array.isArray(input.stageProgress)) {
    Object.entries(input.stageProgress).slice(0, 250).forEach(([id, value]) => {
      if (parseStageId(id) && value && typeof value === "object") stageProgress[id] = sanitizeStageProgress(value);
    });
  }
  const unlocked = new Set(["L1-001"]);
  if (Array.isArray(input.unlockedStageIds)) {
    input.unlockedStageIds.forEach((id) => { if (parseStageId(id)) unlocked.add(id); });
  }
  Object.entries(stageProgress).forEach(([id, value]) => {
    if (value.cleared) {
      unlocked.add(id);
      const next = nextStageId(id);
      if (next) unlocked.add(next);
    }
  });
  const currentLevel = clampNumber(input.currentLevel, 1, 5, 1);
  const currentStage = clampNumber(input.currentStage, 1, 50, 1);
  const currentId = stageId(currentLevel, currentStage);
  if (!unlocked.has(currentId)) {
    const furthest = [...unlocked].sort(stageSort).at(-1) || "L1-001";
    const parsed = parseStageId(furthest);
    return { ...base, revision: clampNumber(input.revision, 1, 1000000, 1), currentLevel: parsed.level, currentStage: parsed.stage, unlockedStageIds: [...unlocked].sort(stageSort), stageProgress, updatedAt: validIso(input.updatedAt) || base.updatedAt };
  }
  return {
    ...base,
    revision: clampNumber(input.revision, 1, 1000000, 1),
    currentLevel,
    currentStage,
    unlockedStageIds: [...unlocked].sort(stageSort),
    stageProgress,
    updatedAt: validIso(input.updatedAt) || base.updatedAt
  };
}

function sanitizeStageProgress(value) {
  const cleared = value.cleared === true;
  const requestedMedal = MEDAL_RANK[value.medal] !== undefined ? value.medal : "none";
  const medal = cleared ? (requestedMedal === "none" ? "bronze" : requestedMedal) : "none";
  const requestedFirstClearMode = DISPLAY_MODES.includes(value.firstClearMode) ? value.firstClearMode : "";
  const inferredFirstClearMode = medal === "gold" ? "listening" : medal === "silver" ? "japanese" : "bilingual";
  return {
    cleared,
    bestScore: clampNumber(value.bestScore, 0, 100, 0),
    medal,
    attempts: cleared ? Math.max(1, clampNumber(value.attempts, 0, 1000000, 0)) : clampNumber(value.attempts, 0, 1000000, 0),
    firstAccuracy: clampNumber(value.firstAccuracy, 0, 100, 0),
    firstClearMode: cleared ? (requestedFirstClearMode || inferredFirstClearMode) : "",
    usedTranslation: value.usedTranslation === true,
    usedKana: value.usedKana === true,
    usedListeningMode: value.usedListeningMode === true,
    replayCount: clampNumber(value.replayCount, 0, 1000000, 0),
    hintCount: clampNumber(value.hintCount, 0, 1000000, 0),
    updatedAt: validIso(value.updatedAt) || isoNow()
  };
}

export function recordAttempt(progressInput, id, result) {
  const progress = sanitizeProgress(progressInput);
  const parsed = parseStageId(id);
  if (!parsed) return progress;
  const before = progress.stageProgress[id] || sanitizeStageProgress({});
  const attempts = before.attempts + 1;
  const score = clampNumber(result.score, 0, 100, 0);
  const cleared = result.cleared === true;
  let earned = "none";
  if (cleared) earned = "bronze";
  if (cleared && result.displayMode !== "bilingual") earned = "silver";
  if (cleared && result.displayMode === "listening" && attempts === 1 && score === 100) earned = "gold";
  const medal = MEDAL_RANK[earned] > MEDAL_RANK[before.medal] ? earned : before.medal;
  progress.stageProgress[id] = {
    ...before,
    cleared: before.cleared || cleared,
    bestScore: Math.max(before.bestScore, score),
    medal,
    attempts,
    firstAccuracy: before.attempts === 0 ? score : before.firstAccuracy,
    firstClearMode: before.firstClearMode || (cleared ? result.displayMode : ""),
    usedTranslation: before.usedTranslation || result.displayMode === "bilingual",
    usedKana: before.usedKana || result.kana === true,
    usedListeningMode: before.usedListeningMode || result.displayMode === "listening",
    replayCount: Math.max(before.replayCount, clampNumber(result.replayCount, 0, 1000000, 0)),
    hintCount: Math.max(before.hintCount, clampNumber(result.hintCount, 0, 1000000, 0)),
    updatedAt: isoNow()
  };
  progress.unlockedStageIds = [...new Set([...progress.unlockedStageIds, id, ...(cleared && nextStageId(id) ? [nextStageId(id)] : [])])].sort(stageSort);
  progress.currentLevel = parsed.level;
  progress.currentStage = parsed.stage;
  progress.revision += 1;
  progress.updatedAt = isoNow();
  return sanitizeProgress(progress);
}

export function mergeProgress(localInput, cloudInput) {
  const local = sanitizeProgress(localInput);
  const cloud = sanitizeProgress(cloudInput);
  const stageProgress = {};
  const ids = new Set([...Object.keys(local.stageProgress), ...Object.keys(cloud.stageProgress)]);
  ids.forEach((id) => {
    const a = local.stageProgress[id] || sanitizeStageProgress({});
    const b = cloud.stageProgress[id] || sanitizeStageProgress({});
    const newer = Date.parse(a.updatedAt) >= Date.parse(b.updatedAt) ? a : b;
    const older = newer === a ? b : a;
    const cleared = a.cleared || b.cleared;
    const firstClearSource = a.cleared && b.cleared ? older : a.cleared ? a : b;
    stageProgress[id] = {
      ...newer,
      cleared,
      bestScore: Math.max(a.bestScore, b.bestScore),
      medal: MEDAL_RANK[a.medal] >= MEDAL_RANK[b.medal] ? a.medal : b.medal,
      attempts: Math.max(a.attempts, b.attempts),
      firstAccuracy: Math.max(a.firstAccuracy, b.firstAccuracy),
      firstClearMode: cleared ? (firstClearSource.firstClearMode || newer.firstClearMode || "bilingual") : "",
      usedTranslation: a.usedTranslation || b.usedTranslation,
      usedKana: a.usedKana || b.usedKana,
      usedListeningMode: a.usedListeningMode || b.usedListeningMode,
      replayCount: Math.max(a.replayCount, b.replayCount),
      hintCount: Math.max(a.hintCount, b.hintCount)
    };
  });
  const unlockedStageIds = [...new Set([...local.unlockedStageIds, ...cloud.unlockedStageIds])].sort(stageSort);
  const localCurrent = stageId(local.currentLevel, local.currentStage);
  const cloudCurrent = stageId(cloud.currentLevel, cloud.currentStage);
  const current = stageSort(localCurrent, cloudCurrent) >= 0 ? localCurrent : cloudCurrent;
  const parsed = parseStageId(current);
  return sanitizeProgress({
    ...local,
    revision: Math.max(local.revision, cloud.revision) + 1,
    currentLevel: parsed.level,
    currentStage: parsed.stage,
    unlockedStageIds,
    stageProgress,
    updatedAt: isoNow()
  });
}

export function mergeSettings(localInput, cloudInput, languageHint = "zh") {
  const local = sanitizeSettings(localInput, languageHint);
  const cloud = sanitizeSettings(cloudInput, languageHint);
  return Date.parse(cloud.updatedAt) > Date.parse(local.updatedAt) ? cloud : local;
}

export function nextStageId(id) {
  const parsed = parseStageId(id);
  if (!parsed) return "";
  if (parsed.stage < 50) return stageId(parsed.level, parsed.stage + 1);
  return parsed.level < 5 ? stageId(parsed.level + 1, 1) : "";
}

export function progressStats(progressInput) {
  const progress = sanitizeProgress(progressInput);
  const values = Object.values(progress.stageProgress);
  return {
    cleared: values.filter((item) => item.cleared).length,
    bronze: values.filter((item) => item.medal === "bronze").length,
    silver: values.filter((item) => item.medal === "silver").length,
    gold: values.filter((item) => item.medal === "gold").length,
    attempts: values.reduce((sum, item) => sum + item.attempts, 0)
  };
}

function validIso(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : "";
}

function localStorageOrNull() {
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}

function stageSort(a, b) {
  const left = parseStageId(a) || { level: 0, stage: 0 };
  const right = parseStageId(b) || { level: 0, stage: 0 };
  return (left.level - right.level) || (left.stage - right.stage);
}
