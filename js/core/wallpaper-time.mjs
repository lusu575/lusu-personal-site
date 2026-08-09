export const WALLPAPER_TIME_THEMES = Object.freeze(["morning", "day", "dusk", "night"]);
export const WALLPAPER_TIME_OVERRIDE_VERSION = 1;
export const WALLPAPER_TIME_OVERRIDE_MAX_MS = 12 * 60 * 60 * 1000;

export function wallpaperTimeThemeAt(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const minutes = date.getHours() * 60 + date.getMinutes();
  if (minutes >= 5 * 60 && minutes < 11 * 60) return "morning";
  if (minutes >= 11 * 60 && minutes < 17 * 60) return "day";
  if (minutes >= 17 * 60 && minutes < 20 * 60) return "dusk";
  return "night";
}

export function nextWallpaperTimeBoundary(value = new Date()) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const boundaryHours = [5, 11, 17, 20];
  const nextHour = boundaryHours.find((hour) => {
    const candidate = new Date(date);
    candidate.setHours(hour, 0, 0, 0);
    return candidate.getTime() > date.getTime();
  });
  if (nextHour === undefined) {
    date.setDate(date.getDate() + 1);
    date.setHours(5, 0, 0, 0);
    return date;
  }
  date.setHours(nextHour, 0, 0, 0);
  return date;
}

export function parseWallpaperTimeOverride(value, nowValue = new Date()) {
  const now = nowValue instanceof Date ? nowValue : new Date(nowValue);
  if (!Number.isFinite(now.getTime())) return null;
  let record = value;
  if (typeof value === "string") {
    if (!value) return null;
    try {
      record = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!record || typeof record !== "object") return null;
  const selectedAt = Number(record.selectedAt);
  const expiresAt = Number(record.expiresAt);
  const selectedDate = new Date(selectedAt);
  const expectedBoundary = nextWallpaperTimeBoundary(selectedDate);
  if (record.v !== WALLPAPER_TIME_OVERRIDE_VERSION
    || !WALLPAPER_TIME_THEMES.includes(record.theme)
    || !Number.isFinite(selectedAt)
    || selectedAt > now.getTime() + 5000
    || !Number.isFinite(expiresAt)
    || !expectedBoundary
    || expiresAt !== expectedBoundary.getTime()
    || expiresAt <= now.getTime()
    || expiresAt - selectedAt > WALLPAPER_TIME_OVERRIDE_MAX_MS) {
    return null;
  }
  return Object.freeze({
    v: WALLPAPER_TIME_OVERRIDE_VERSION,
    theme: record.theme,
    selectedAt,
    expiresAt
  });
}

export function createWallpaperTimeOverride(theme, nowValue = new Date()) {
  if (!WALLPAPER_TIME_THEMES.includes(theme)) return null;
  const now = nowValue instanceof Date ? new Date(nowValue.getTime()) : new Date(nowValue);
  const boundary = nextWallpaperTimeBoundary(now);
  if (!boundary) return null;
  return Object.freeze({
    v: WALLPAPER_TIME_OVERRIDE_VERSION,
    theme,
    selectedAt: now.getTime(),
    expiresAt: boundary.getTime()
  });
}
