export const CONTENT_VERSION = "1.0.1";
export const PROGRESS_KEY = "lusu.japaneseSubtext.progress.v1";
export const SETTINGS_KEY = "lusu.japaneseSubtext.settings.v1";
export const MODE_ONBOARDING_KEY = "lusu.japaneseSubtext.modeOnboarding.v1";
export const UI_LANGUAGES = ["zh", "en", "ja"];
export const OPTION_LANGUAGES = ["ja", "zh", "en"];
export const DISPLAY_MODES = ["listening", "japanese", "bilingual"];
export const PLAYBACK_RATES = [0.75, 1, 1.15];
export const MEDAL_RANK = { none: 0, bronze: 1, silver: 2, gold: 3 };

export function parseStageId(value) {
  const match = String(value || "").match(/^L([1-5])-([0-9]{3})$/);
  if (!match) return null;
  const level = Number(match[1]);
  const stage = Number(match[2]);
  return stage >= 1 && stage <= 50 ? { level, stage } : null;
}

export function stageId(level, stage) {
  return `L${Number(level)}-${String(Number(stage)).padStart(3, "0")}`;
}

export function localized(value, lang, fallback = "") {
  if (typeof value === "string") return value;
  return value?.[lang] || value?.ja || value?.zh || value?.en || fallback;
}

export function clampNumber(value, min, max, fallback = min) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

export function isoNow() {
  return new Date().toISOString();
}

export function safeToolAssetPath(value, allowedFolder = "assets") {
  const raw = String(value || "").trim().replace(/\\/g, "/").replace(/^\.\//, "");
  if (!raw || /(^|\/)\.\.(\/|$)/.test(raw) || /^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith("//")) {
    return "";
  }
  return raw.startsWith(`${allowedFolder}/`) && /^[a-z0-9._/-]+$/i.test(raw) ? `./${raw}` : "";
}

export function shortContentHash(value, length = 12) {
  const hash = String(value || "").trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(hash)) return "";
  return hash.slice(0, clampNumber(length, 8, 32, 12));
}

export function formatTime(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(safe / 60);
  return `${minutes}:${String(Math.floor(safe % 60)).padStart(2, "0")}`;
}
