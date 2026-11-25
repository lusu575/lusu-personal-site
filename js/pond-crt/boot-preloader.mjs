// Critical-Path Asset Preloader for Persepolis-Style Single-Scene Warm-Up (r87)
// Reports real critical progress (manifest + active-season flora); never blocks on non-critical assets.

export const ASSET_CACHE_TAG = '20261125-refresh-warm-r91';

const SEASON_PART_MAP = {
  spring: ['sakuraBranch', 'lotusLeaf1', 'lotusLeaf2', 'lotusLeaf3'],
  summer: ['lotusLeaf1', 'lotusLeaf2', 'lotusLeaf3', 'lotusFlower', 'lotusBud'],
  autumn: ['mapleBranch', 'mapleLeaf1', 'mapleLeaf2', 'mapleLeaf3'],
  winter: ['winterBranch', 'iceOverlay']
};

export const STATIC_PRELOAD_IMAGES = [
  // 5 Game covers (WebP + SVG, ~61 KB total)
  '/assets/pond-windows/covers/cover-cat.webp?v=20261123-pond-polish-r56',
  '/assets/pond-windows/covers/cover-darkroom.webp?v=20261123-pond-polish-r56',
  '/assets/pond-windows/covers/cover-restart.webp?v=20261123-pond-polish-r56',
  '/assets/pond-windows/covers/cover-2048.svg?v=20261123-pond-polish-r56',
  '/assets/pond-windows/covers/cover-hextris.svg?v=20261123-pond-polish-r56',
  // 6 Chatroom dot-matrix avatars (~3.2 KB total)
  '/assets/pond-windows/svg/avatar-lotus.svg?v=20261122-pond-polish-r30',
  '/assets/pond-windows/svg/avatar-koi.svg?v=20261122-pond-polish-r30',
  '/assets/pond-windows/svg/avatar-moon.svg?v=20261122-pond-polish-r30',
  '/assets/pond-windows/svg/avatar-leaf.svg?v=20261122-pond-polish-r30',
  '/assets/pond-windows/svg/avatar-ripple.svg?v=20261122-pond-polish-r30',
  '/assets/pond-windows/svg/avatar-star.svg?v=20261122-pond-polish-r30',
  // 6 Tool & window dot-matrix icons (~2.2 KB total)
  '/assets/pond-windows/svg/icon-palette.svg',
  '/assets/pond-windows/svg/icon-transfer.svg',
  '/assets/pond-windows/svg/icon-torii.svg',
  '/assets/pond-windows/svg/icon-box.svg',
  '/assets/pond-windows/svg/icon-layers.svg',
  '/assets/pond-windows/svg/icon-vr.svg',
  // 1 About page avatar
  '/assets/images/lusu-about-avatar-256.png'
];

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
  let manifest = null;
  const manifestUrl = '/assets/pond-assets-manifest.json?v=20261123-pond-polish-r55';

  // Fetch manifest + warm games catalog in parallel
  const [manifestRes] = await Promise.allSettled([
    fetch(manifestUrl, { cache: 'default' }).then((r) => (r.ok ? r.json() : null)),
    fetch('/games/catalog.json', { cache: 'default' }).then((r) => (r.ok ? r.json() : null)).catch(() => null)
  ]);
  if (manifestRes.status === 'fulfilled' && manifestRes.value) {
    manifest = manifestRes.value;
  }

  const allParts = manifest?.parts ? Object.entries(manifest.parts).filter(([, u]) => Boolean(u)) : [];
  const primaryKeys = new Set(SEASON_PART_MAP[seasonId] || SEASON_PART_MAP.summer);
  const primaryParts = allParts.filter(([k]) => primaryKeys.has(k));
  const secondaryParts = allParts.filter(([k]) => !primaryKeys.has(k));

  // Critical progress ONLY tracks manifest + active-season flora (never waits for non-critical assets!)
  const criticalTotal = primaryParts.length + 1; // +1 for manifest fetch
  let criticalLoaded = 1;
  const report = () => {
    if (onProgress) onProgress(Math.min(1, criticalLoaded / Math.max(1, criticalTotal)), criticalLoaded, criticalTotal);
  };
  report();

  const runCriticalPart = async ([key, url]) => {
    const img = await loadAndDecodeImage(url);
    if (img && onFloraPart) onFloraPart(key, img);
    criticalLoaded++;
    report();
  };

  const runBackgroundPart = async ([key, url]) => {
    const img = await loadAndDecodeImage(url);
    if (img && onFloraPart) onFloraPart(key, img);
  };

  // Phase A (critical): Active-season parts FIRST -> immediate GPU bake & critical progress completion
  await Promise.allSettled(primaryParts.map(runCriticalPart));
  if (onPrimaryFloraDone) onPrimaryFloraDone();
  if (onProgress) onProgress(1, criticalTotal, criticalTotal);
  if (onComplete) onComplete({ total: criticalTotal, completed: criticalTotal });

  // Phase B (non-blocking background): Remaining 3 seasons + static sub-window assets
  Promise.allSettled([
    ...secondaryParts.map(runBackgroundPart),
    ...STATIC_PRELOAD_IMAGES.map((url) => loadAndDecodeImage(url))
  ]).then(() => {
    if (onPrimaryFloraDone) onPrimaryFloraDone();
  });

  return { manifest, total: criticalTotal, completed: criticalTotal };
}
