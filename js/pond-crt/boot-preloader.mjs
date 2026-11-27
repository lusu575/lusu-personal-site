// Critical-Path Asset Preloader for Persepolis-Style Single-Scene Warm-Up (r87)
// Reports real critical progress (manifest + active-season flora); never blocks on non-critical assets.

export const ASSET_CACHE_TAG = '20261127-opt093-perf-r100';

const DEFAULT_POND_PARTS = Object.freeze({
  sakuraBranch: '/assets/pond-parts/part-sakura-branch.webp',
  mapleBranch: '/assets/pond-parts/part-maple-branch.webp',
  winterBranch: '/assets/pond-parts/part-winter-branch.webp',
  lotusLeaf1: '/assets/pond-parts/part-lotus-leaf-1.webp',
  lotusLeaf2: '/assets/pond-parts/part-lotus-leaf-2.webp',
  lotusLeaf3: '/assets/pond-parts/part-lotus-leaf-3.webp',
  lotusFlower: '/assets/pond-parts/part-lotus-flower.webp',
  lotusBud: '/assets/pond-parts/part-lotus-bud.webp',
  mapleLeaf1: '/assets/pond-parts/part-maple-leaf-1.webp',
  mapleLeaf2: '/assets/pond-parts/part-maple-leaf-2.webp',
  mapleLeaf3: '/assets/pond-parts/part-maple-leaf-3.webp',
  iceOverlay: '/assets/pond-parts/part-ice-overlay.webp'
});

const SEASON_PART_MAP = {
  spring: ['sakuraBranch', 'lotusLeaf1', 'lotusLeaf2', 'lotusLeaf3'],
  summer: ['lotusLeaf1', 'lotusLeaf2', 'lotusLeaf3', 'lotusFlower', 'lotusBud'],
  autumn: ['mapleBranch', 'mapleLeaf1', 'mapleLeaf2', 'mapleLeaf3'],
  winter: ['winterBranch', 'iceOverlay']
};

export const STATIC_PRELOAD_IMAGES = [];

const loadedPartPromises = new Map();

function ensureFloraPartLoaded(key, url, onFloraPart) {
  if (!url) return Promise.resolve(null);
  let pending = loadedPartPromises.get(key);
  if (!pending) {
    pending = loadAndDecodeImage(url).then((img) => {
      if (!img) loadedPartPromises.delete(key);
      return img;
    });
    loadedPartPromises.set(key, pending);
  }
  return pending.then((img) => {
    if (img && onFloraPart) onFloraPart(key, img);
    return img;
  });
}

export async function loadSeasonFloraParts(seasonId, onFloraPart = null) {
  const keys = SEASON_PART_MAP[seasonId] || SEASON_PART_MAP.summer;
  await Promise.allSettled(
    keys.map((key) => ensureFloraPartLoaded(key, DEFAULT_POND_PARTS[key], onFloraPart))
  );
}

export function detectBootMode() {
  try {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return 'instant';
    }
    const navEntry = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
    if (navEntry && navEntry.type === 'back_forward') {
      return 'instant';
    }
  } catch {
    // Fallback to warm boot
  }
  return 'warm';
}

export function markBootCompleted() {
  // r91: Every full page load (initial visit, F5 refresh, hard refresh) plays the warm-up;
  // do not suppress subsequent reloads via sessionStorage.
}

function loadAndDecodeImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    const done = (ok) => resolve(ok ? img : null);
    img.onload = () => {
      if (typeof img.decode === 'function') {
        img.decode().then(() => done(true), () => done(true));
      } else {
        done(true);
      }
    };
    img.onerror = () => done(false);
    img.src = url;
  });
}

export async function runPondBootPreload({
  seasonId = 'summer',
  onFloraPart = null,
  onPrimaryFloraDone = null,
  onProgress = null,
  onComplete = null
} = {}) {
  const manifest = { version: '2026-11-23-v3-webp', parts: DEFAULT_POND_PARTS, icons: {} };
  const primaryKeys = SEASON_PART_MAP[seasonId] || SEASON_PART_MAP.summer;
  const primaryParts = primaryKeys
    .map((key) => [key, DEFAULT_POND_PARTS[key]])
    .filter(([, url]) => Boolean(url));

  // Critical progress tracks ONLY active-season flora parts; inactive seasons and sub-window
  // assets load on demand so first-screen request budgets stay lean across all routes.
  const criticalTotal = Math.max(1, primaryParts.length);
  let criticalLoaded = 0;
  const report = () => {
    if (onProgress) onProgress(Math.min(1, criticalLoaded / criticalTotal), criticalLoaded, criticalTotal);
  };
  report();

  const runCriticalPart = async ([key, url]) => {
    await ensureFloraPartLoaded(key, url, onFloraPart);
    criticalLoaded++;
    report();
  };

  await Promise.allSettled(primaryParts.map(runCriticalPart));
  if (onPrimaryFloraDone) onPrimaryFloraDone();
  if (onProgress) onProgress(1, criticalTotal, criticalTotal);
  if (onComplete) onComplete({ total: criticalTotal, completed: criticalTotal });

  return { manifest, total: criticalTotal, completed: criticalTotal };
}
