// Season palettes and visual parameters calibrated against final2-spring/summer/autumn/winter.png

export const SEASON_ORDER = ['spring', 'summer', 'autumn', 'winter'];

export const SEASONS = {
  spring: {
    id: 'spring',
    label: { zh: '春', en: 'Spring', ja: '春' },
    demoDate: '2025-04-20',
    waterDeep: [0.018, 0.055, 0.045],
    waterMid: [0.065, 0.195, 0.135],
    waterAccent: [0.11, 0.29, 0.19],
    causticTint: [0.74, 0.94, 0.68],
    specularTint: [0.95, 0.99, 0.86],
    glowColumnX: 0.48,
    glowColumnWidth: 0.24,
    causticStrength: 0.82,
    shimmerSpeed: 0.42,
    koiDepthFog: 0.25,
    ambientTint: [1.0, 0.72, 0.80]
  },
  summer: {
    id: 'summer',
    label: { zh: '夏', en: 'Summer', ja: '夏' },
    demoDate: '2025-07-15',
    waterDeep: [0.008, 0.055, 0.058],
    waterMid: [0.032, 0.255, 0.205],
    waterAccent: [0.045, 0.325, 0.355],
    causticTint: [0.56, 0.96, 0.66],
    specularTint: [1.00, 0.99, 0.72],
    glowColumnX: 0.41,
    glowColumnWidth: 0.20,
    causticStrength: 1.15,
    shimmerSpeed: 0.46,
    koiDepthFog: 0.18,
    ambientTint: [0.78, 0.98, 0.82]
  },
  autumn: {
    id: 'autumn',
    label: { zh: '秋', en: 'Autumn', ja: '秋' },
    demoDate: '2025-10-18',
    waterDeep: [0.032, 0.020, 0.008],
    waterMid: [0.165, 0.092, 0.028],
    waterAccent: [0.275, 0.145, 0.040],
    causticTint: [0.92, 0.56, 0.20],
    specularTint: [1.00, 0.82, 0.48],
    glowColumnX: 0.50,
    glowColumnWidth: 0.20,
    causticStrength: 0.78,
    shimmerSpeed: 0.36,
    koiDepthFog: 0.24,
    ambientTint: [0.96, 0.46, 0.16]
  },
  winter: {
    id: 'winter',
    label: { zh: '冬', en: 'Winter', ja: '冬' },
    demoDate: '2025-01-15',
    waterDeep: [0.022, 0.042, 0.068],
    waterMid: [0.095, 0.155, 0.225],
    waterAccent: [0.155, 0.230, 0.310],
    causticTint: [0.62, 0.76, 0.90],
    specularTint: [0.88, 0.94, 1.00],
    glowColumnX: 0.42,
    glowColumnWidth: 0.28,
    causticStrength: 0.58,
    shimmerSpeed: 0.24,
    koiDepthFog: 0.62,
    ambientTint: [0.82, 0.90, 1.00]
  }
};

export function lerpVec3(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t
  ];
}

export function lerpNum(a, b, t) {
  return a + (b - a) * t;
}
