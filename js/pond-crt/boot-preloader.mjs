// Full-Site Asset Preloader for Midnight Pond CRT Boot Sequence (r57)
// Preloads & decodes all 32 site visual assets (seasonal WebPs, game covers, chat avatars,
// tool SVGs, about avatar, and JSON catalogs) with real per-asset progress reporting.

export const ASSET_CACHE_TAG = '20261123-pond-boot-r57';

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
    if (sessionStorage.getItem('lusu-pond-booted-v1') === '1') {
      return 'quick';
    }
    if (localStorage.getItem('lusu-pond-cache-v1') === ASSET_CACHE_TAG) {
      return 'quick';
    }
  } catch {
    // Storage unavailable
  }
  return 'full';
}

export function markBootCompleted() {
  try {
    sessionStorage.setItem('lusu-pond-booted-v1', '1');
    localStorage.setItem('lusu-pond-cache-v1', ASSET_CACHE_TAG);
  } catch {
    // Ignore storage errors
  }
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

  const totalTasks = allParts.length + STATIC_PRELOAD_IMAGES.length + 2; // +2 for manifests already done
  let completed = 2;
  const report = () => {
    if (onProgress) onProgress(Math.min(1, completed / Math.max(1, totalTasks)), completed, totalTasks);
  };
  report();

  const runPart = async ([key, url]) => {
    const img = await loadAndDecodeImage(url);
    if (img && onFloraPart) onFloraPart(key, img);
    completed++;
    report();
  };

  const runStatic = async (url) => {
    await loadAndDecodeImage(url);
    completed++;
    report();
  };

  // Phase A: Active season parts FIRST (immediate GPU bake) + static site assets in parallel
  const primaryPromise = Promise.allSettled(primaryParts.map(runPart)).then(() => {
    if (onPrimaryFloraDone) onPrimaryFloraDone();
  });
  const staticPromise = Promise.allSettled(STATIC_PRELOAD_IMAGES.map(runStatic));
  // Phase B: Remaining 3 seasons' WebP parts in parallel so season switching is 0ms stutter
  const secondaryPromise = Promise.allSettled(secondaryParts.map(runPart));

  await Promise.all([primaryPromise, staticPromise, secondaryPromise]);
  markBootCompleted();
  if (onComplete) onComplete({ total: totalTasks, completed });
  return { manifest, total: totalTasks, completed };
}
