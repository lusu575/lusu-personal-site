// Connects the 4-season Pond CRT engine to the live site's time-based wallpaper schedule
// (js/core/wallpaper-time.mjs):
//   morning (05:00-11:00) -> spring
//   day     (11:00-17:00) -> summer
//   dusk    (17:00-20:00) -> autumn
//   night   (20:00-05:00) -> winter
// Manual selection via the top-right season slider persists as an override until the next boundary.

import {
  WALLPAPER_TIME_THEMES,
  wallpaperTimeThemeAt,
  nextWallpaperTimeBoundary,
  parseWallpaperTimeOverride,
  createWallpaperTimeOverride
} from '../core/wallpaper-time.mjs';

const OVERRIDE_STORAGE_KEY = 'lusu-wallpaper-time-override';

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
