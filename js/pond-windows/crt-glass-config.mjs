// Authoritative Single Source of Truth for CRT Refractive Glass (Astra Spec V1.0 · Step 2)
// Shared by CSS custom properties, button interaction layer, window spring physics & future WebGL rim pass.

export const CRT_GLASS = Object.freeze({
  // Optical & Rim Geometry (CSS px)
  ior: 1.46,
  faceThicknessPx: 1.0,
  rimThicknessPx: 5.0,
  shoulderPx: 8.0,
  maxRefractionPx: 2.5,

  rimHighlightPx: 1.25,
  rimOpacity: 0.16,
  hoverRimBoost: 0.08,

  faceTransmission: 0.08,
  rimTransmission: 0.22,

  dotPitchPx: 3.0,
  dotContrast: 0.025,

  // Button Press & Release Wave (MengTo shade-glass-button-press transmuted for CRT)
  pressDurationMs: 120,
  pressScale: 0.985,
  pressOffsetPx: 1.5,
  indentPx: 1.0,
  indentSigmaRatio: 0.28,

  releaseDurationMs: 320,
  releaseWavePower: 1.7,
  waveBandPx: 6.0,
  waveBandWidePx: 8.0,
  waveWideThresholdPx: 200,
  waveCrestPx: 1.2,
  waveWakePx: 0.45,

  dispersionPx: 0.35,
  dispersionMaxPx: 0.6,
  dispersionDurationMs: 60,
  rimCatchDurationMs: 70,

  // Drag Shear Constraints
  maxDragShearDeg: 0.8,
  maxDragLagPx: 4.0
});

// Unified Second-Order Damped Spring Language: x'' + 2*zeta*omega0*x' + omega0^2*(x - target) = 0
export const CRT_GLASS_SPRINGS = Object.freeze({
  // Aligned with 《窗口打开动画技术调研报告》 §4.3 & §4.5 (execution order precedence)
  windowOpen: Object.freeze({ zeta: 0.88, omega0: 10, targetMs: 480, durationMs: 480 }),
  windowClose: Object.freeze({ zeta: 0.95, omega0: 12, targetMs: 400, durationMs: 400 }),
  buttonPress: Object.freeze({ zeta: 1.00, omega0: 50, targetMs: 120, durationMs: 120 }),
  buttonRelease: Object.freeze({ zeta: 0.82, omega0: 32, targetMs: 180, durationMs: 180 }),
  dragLag: Object.freeze({ zeta: 0.86, omega0: 25, targetMs: 200, durationMs: 200 })
});

// Glass-Specific Phosphor Palette (does not replace global site palette)
export const CRT_GLASS_COLORS = Object.freeze({
  base: '#101A20',
  baseRgba: 'rgba(16, 26, 32, 0.94)',
  rimBase: '#72C9C3',
  coldWhite: '#D2E5E7',
  focusIridescentA: '#B08AD8',
  focusIridescentB: '#69C6D4',
  mutedText: '#91A3AE'
});

// Three-Tier Button Interaction Levels (Section 3.3 & Step 6)
export const CRT_GLASS_BUTTON_LEVELS = Object.freeze({
  'glass-primary': Object.freeze({
    pressOffsetPx: CRT_GLASS.pressOffsetPx,
    pressScale: CRT_GLASS.pressScale,
    releaseDurationMs: CRT_GLASS.releaseDurationMs,
    enableWave: true,
    enableDispersion: true,
    enableRimCatch: true
  }),
  'glass-icon': Object.freeze({
    pressOffsetPx: 1.0,
    pressScale: 0.985,
    releaseDurationMs: 220,
    enableWave: true,
    enableDispersion: false,
    enableRimCatch: true
  }),
  'glass-close': Object.freeze({
    pressOffsetPx: 0.0,
    pressScale: 1.0,
    releaseDurationMs: 100,
    enableWave: false,
    enableDispersion: false,
    enableRimCatch: true
  })
});

// Three Performance Tiers (Step 7)
export const CRT_GLASS_TIERS = Object.freeze({
  high: Object.freeze({ rimRefraction: true, buttonWave: 'full', dispersion: true, dragElastic: 'full' }),
  medium: Object.freeze({ rimRefraction: true, buttonWave: 'simple', dispersion: false, dragElastic: 'simple' }),
  low: Object.freeze({ rimRefraction: false, buttonWave: 'css', dispersion: false, dragElastic: 'off' })
});

export function syncCrtGlassCssVars(root = document.documentElement) {
  if (!root || !root.style) return;
  const s = root.style;
  s.setProperty('--crt-glass-base', CRT_GLASS_COLORS.base);
  s.setProperty('--crt-glass-base-rgba', CRT_GLASS_COLORS.baseRgba);
  s.setProperty('--crt-glass-rim', CRT_GLASS_COLORS.rimBase);
  s.setProperty('--crt-glass-cold-white', CRT_GLASS_COLORS.coldWhite);
  s.setProperty('--crt-glass-irid-a', CRT_GLASS_COLORS.focusIridescentA);
  s.setProperty('--crt-glass-irid-b', CRT_GLASS_COLORS.focusIridescentB);
  s.setProperty('--crt-glass-rim-opacity', String(CRT_GLASS.rimOpacity));
  s.setProperty('--crt-glass-rim-hover-boost', String(CRT_GLASS.hoverRimBoost));
  s.setProperty('--crt-glass-shoulder', `${CRT_GLASS.shoulderPx}px`);
  s.setProperty('--crt-glass-rim-width', `${CRT_GLASS.rimHighlightPx}px`);
  s.setProperty('--crt-glass-dispersion-px', `${CRT_GLASS.dispersionPx}px`);
}
