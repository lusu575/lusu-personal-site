// Connects the 4-season Pond CRT engine to the live site's exact time-based wallpaper schedule
// (mirrors js/core/wallpaper-time.mjs inline so production dist/ never depends on an unbundled /js/core/ file):
//   morning (05:00-11:00) -> spring
//   day     (11:00-17:00) -> summer
//   dusk    (17:00-20:00) -> autumn
//   night   (20:00-05:00) -> winter
// Manual selection via the top-right season slider persists as an override until the next boundary.

const WALLPAPER_TIME_THEMES = Object.freeze(['morning', 'day', 'dusk', 'night']);
const WALLPAPER_TIME_OVERRIDE_VERSION = 1;
const WALLPAPER_TIME_OVERRIDE_MAX_MS = 12 * 60 * 60 * 1000;
const OVERRIDE_STORAGE_KEY = 'lusu-wallpaper-time-override';

function wallpaperTimeThemeAt(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const minutes = date.getHours() * 60 + date.getMinutes();
  if (minutes >= 5 * 60 && minutes < 11 * 60) return 'morning';
  if (minutes >= 11 * 60 && minutes < 17 * 60) return 'day';
  if (minutes >= 17 * 60 && minutes < 20 * 60) return 'dusk';
  return 'night';
}

function nextWallpaperTimeBoundary(value = new Date()) {
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

function parseWallpaperTimeOverride(value, nowValue = new Date()) {
  const now = nowValue instanceof Date ? nowValue : new Date(nowValue);
  if (!Number.isFinite(now.getTime())) return null;
  let record = value;
  if (typeof value === 'string') {
    if (!value) return null;
    try {
      record = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!record || typeof record !== 'object') return null;
  const selectedAt = Number(record.selectedAt);
  const expiresAt = Number(record.expiresAt);
  const selectedDate = new Date(selectedAt);
  const expectedBoundary = nextWallpaperTimeBoundary(selectedDate);
  if (
    record.v !== WALLPAPER_TIME_OVERRIDE_VERSION ||
    !WALLPAPER_TIME_THEMES.includes(record.theme) ||
    !Number.isFinite(selectedAt) ||
    selectedAt > now.getTime() + 5000 ||
    !Number.isFinite(expiresAt) ||
    !expectedBoundary ||
    expiresAt !== expectedBoundary.getTime() ||
    expiresAt <= now.getTime() ||
    expiresAt - selectedAt > WALLPAPER_TIME_OVERRIDE_MAX_MS
  ) {
    return null;
  }
  return Object.freeze({
    v: WALLPAPER_TIME_OVERRIDE_VERSION,
    theme: record.theme,
    selectedAt,
    expiresAt
  });
}

function createWallpaperTimeOverride(theme, nowValue = new Date()) {
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

export const THEME_TO_SEASON = Object.freeze({
  morning: 'spring',
  day: 'summer',
  dusk: 'autumn',
  night: 'winter'
});

export const SEASON_TO_THEME = Object.freeze({
  spring: 'morning',
  summer: 'day',
  autumn: 'dusk',
  winter: 'night'
});

export function seasonForDate(date = new Date()) {
  const theme = wallpaperTimeThemeAt(date);
  return THEME_TO_SEASON[theme] || 'summer';
}

export function resolveInitialPondSeason(search = window.location.search, now = new Date()) {
  const params = new URLSearchParams(search);
  const explicitSeason = params.get('season');
  if (explicitSeason && SEASON_TO_THEME[explicitSeason]) {
    return { season: explicitSeason, isPreview: true };
  }
  const explicitWallpaper = params.get('wallpaper');
  if (explicitWallpaper && WALLPAPER_TIME_THEMES.includes(explicitWallpaper)) {
    return { season: THEME_TO_SEASON[explicitWallpaper], isPreview: true };
  }
  try {
    const raw = window.localStorage.getItem(OVERRIDE_STORAGE_KEY);
    const parsed = parseWallpaperTimeOverride(raw, now);
    if (parsed && THEME_TO_SEASON[parsed.theme]) {
      return { season: THEME_TO_SEASON[parsed.theme], isPreview: false };
    }
  } catch {
    // Ignore storage errors
  }
  return { season: seasonForDate(now), isPreview: false };
}

export function saveManualSeasonOverride(season, now = new Date()) {
  const theme = SEASON_TO_THEME[season];
  if (!theme) return;
  const record = createWallpaperTimeOverride(theme, now);
  if (!record) return;
  try {
    window.localStorage.setItem(OVERRIDE_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Ignore storage errors
  }
}

export function startSeasonTimeSchedule({ isPreview = false, onAutoSeasonChange }) {
  if (isPreview || typeof onAutoSeasonChange !== 'function') {
    return () => {};
  }
  let timer = null;
  let stopped = false;

  const scheduleNext = () => {
    if (stopped) return;
    const now = new Date();
    const boundary = nextWallpaperTimeBoundary(now);
    if (!boundary) return;
    const delay = Math.max(1000, Math.min(boundary.getTime() - now.getTime() + 250, 6 * 60 * 60 * 1000));
    timer = window.setTimeout(() => {
      if (stopped) return;
      const resolved = resolveInitialPondSeason('', new Date());
      onAutoSeasonChange(resolved.season);
      scheduleNext();
    }, delay);
  };

  scheduleNext();
  return () => {
    stopped = true;
    if (timer !== null) {
      window.clearTimeout(timer);
      timer = null;
    }
  };
}
