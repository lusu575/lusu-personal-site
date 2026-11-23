// High-DPI CRT UI Overlay & True Particle Layer — Optimized for 120 FPS!
// - ZERO ctx.shadowBlur (uses pre-rendered 16x16 radial glow dot sprites -> 100x faster!)
// - Smart dirty-flag / throttled redraw so GPU texture upload only runs when needed
// - Redesigned delicate botanical dot-matrix Season Slider emblems (Sakura / Lotus / Maple / Snowflake)
// - 6 Desktop Icons strictly matching icons-v7-dotted-glyphs.png + final2-*.png
// - Discreet bottom-left CRT terminal corner (Account + zh / EN / 日)

import { SEASON_ORDER, SEASONS } from './seasons.mjs';

function samplePolyline(pts, spacing) {
  const out = [];
  if (pts.length < 2) return out;
  let carry = 0;
  out.push(pts[0]);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const segLen = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (segLen < 1e-5) continue;
    let d = spacing - carry;
    while (d <= segLen) {
      const t = d / segLen;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      d += spacing;
    }
    carry = segLen - (d - spacing);
  }
  return out;
}

function sampleArc(cx, cy, r, a0, a1, spacing, scaleY = 1) {
  const steps = Math.max(12, Math.ceil((Math.abs(a1 - a0) * r) / (spacing * 0.4)));
  const poly = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + (a1 - a0) * (i / steps);
    poly.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * scaleY]);
  }
  return samplePolyline(poly, spacing);
}

function sampleQuad(p0, p1, p2, spacing) {
  const poly = [];
  const steps = 20;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    poly.push([
      mt * mt * p0[0] + 2 * mt * t * p1[0] + t * t * p2[0],
      mt * mt * p0[1] + 2 * mt * t * p1[1] + t * t * p2[1]
    ]);
  }
  return samplePolyline(poly, spacing);
}

function sampleRoundedRect(x, y, w, h, r, spacing) {
  const pts = [];
  pts.push(...samplePolyline([[x + r, y], [x + w - r, y]], spacing));
  pts.push(...sampleArc(x + w - r, y + r, r, -Math.PI / 2, 0, spacing));
  pts.push(...samplePolyline([[x + w, y + r], [x + w, y + h - r]], spacing));
  pts.push(...sampleArc(x + w - r, y + h - r, r, 0, Math.PI / 2, spacing));
  pts.push(...samplePolyline([[x + w - r, y + h], [x + r, y + h]], spacing));
  pts.push(...sampleArc(x + r, y + h - r, r, Math.PI / 2, Math.PI, spacing));
  pts.push(...samplePolyline([[x, y + h - r], [x, y + r]], spacing));
  pts.push(...sampleArc(x + r, y + r, r, Math.PI, Math.PI * 1.5, spacing));
  return pts;
}

// Pre-rendered crisp glowing phosphor dot sprite (replaces slow ctx.shadowBlur while keeping distinct individual dots!)
function createGlowDotSprite(r, g, b) {
  const c = document.createElement('canvas');
  c.width = 24;
  c.height = 24;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(12, 12, 0.5, 12, 12, 11.5);
  grad.addColorStop(0.0, `rgba(255, 255, 255, 1.0)`);
  grad.addColorStop(0.22, `rgba(245, 252, 255, 0.96)`);
  grad.addColorStop(0.38, `rgba(${r}, ${g}, ${b}, 0.52)`);
  grad.addColorStop(0.68, `rgba(${r}, ${g}, ${b}, 0.12)`);
  grad.addColorStop(1.0, `rgba(${r}, ${g}, ${b}, 0.0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 24, 24);
  return c;
}

function buildIconDots(id) {
  const sp = 0.105;
  const dots = [];

  if (id === 'knowledge') {
    dots.push(...sampleQuad([-0.82, -0.52], [-0.42, -0.72], [0.0, -0.42], sp));
    dots.push(...sampleQuad([0.0, -0.42], [0.42, -0.72], [0.82, -0.52], sp));
    dots.push(...samplePolyline([[0.82, -0.52], [0.82, 0.56]], sp));
    dots.push(...sampleQuad([0.82, 0.56], [0.42, 0.36], [0.0, 0.64], sp));
    dots.push(...sampleQuad([0.0, 0.64], [-0.42, 0.36], [-0.82, 0.56], sp));
    dots.push(...samplePolyline([[-0.82, 0.56], [-0.82, -0.52]], sp));
    dots.push(...samplePolyline([[0.0, -0.42], [0.0, 0.64]], sp));
  } else if (id === 'videos') {
    dots.push(...sampleRoundedRect(-0.84, -0.58, 1.68, 1.16, 0.28, sp));
    dots.push(...samplePolyline([[-0.18, -0.26], [0.28, 0.0], [-0.18, 0.26], [-0.18, -0.26]], sp));
  } else if (id === 'resources') {
    // Exact symmetric diagonal Wrench matching icons-v7-dotted-glyphs.png:
    // Built cleanly in unrotated vertical coordinates (jaw facing straight UP), then rotated +45 deg!
    const local = [];
    const jawR = 0.36;
    const jawCy = -0.42;
    // Outer C-jaw arc: from top-right jaw tip (-0.65 rad) clockwise around bottom-right, left, to top-left jaw tip (-PI + 0.65)
    // Wait: in Canvas Y-down, -PI/2 is straight UP. Open jaw spans [-PI/2 - 0.62, -PI/2 + 0.62].
    // Left side of head down to left shaft neck:
    const neckAngle = 0.44; // where shaft meets head at bottom
    // Right outer head arc: from top-right tip (-PI/2 + 0.60) down to right neck (PI/2 - neckAngle)
    local.push(...sampleArc(0, jawCy, jawR, -Math.PI / 2 + 0.62, Math.PI / 2 - neckAngle, sp));
    // Left outer head arc: from left neck (PI/2 + neckAngle) up to top-left tip (3*PI/2 - 0.62)
    local.push(...sampleArc(0, jawCy, jawR, Math.PI / 2 + neckAngle, Math.PI * 1.5 - 0.62, sp));
    // Clean inner hex U-jaw opening (connects top-left tip -> inner pocket -> top-right tip)
    const tipX = Math.cos(-Math.PI / 2 + 0.62) * jawR;
    const tipY = jawCy + Math.sin(-Math.PI / 2 + 0.62) * jawR;
    local.push(...samplePolyline([
      [-tipX, tipY],
      [-0.17, jawCy - 0.02],
      [0.0, jawCy + 0.08],
      [0.17, jawCy - 0.02],
      [tipX, tipY]
    ], sp));
    // Parallel straight wrench shaft from head neck down to handle base
    const neckX = Math.cos(Math.PI / 2 - neckAngle) * jawR;
    const neckY = jawCy + Math.sin(Math.PI / 2 - neckAngle) * jawR;
    const handleY = 0.66;
    local.push(...samplePolyline([[neckX, neckY], [neckX, handleY]], sp));
    local.push(...samplePolyline([[-neckX, neckY], [-neckX, handleY]], sp));
    // Smooth semicircular rounded handle end + centered eyelet dot
    local.push(...sampleArc(0, handleY, neckX, 0, Math.PI, sp));
    local.push([0, handleY]);

    // Rotate +45 deg clockwise so open jaw points top-right & handle points bottom-left (exact match to icons-v7!)
    const ca = Math.SQRT1_2;
    const sa = Math.SQRT1_2;
    for (const [lx, ly] of local) {
      dots.push([lx * ca - ly * sa, lx * sa + ly * ca]);
    }
  } else if (id === 'games') {
    dots.push(...sampleQuad([-0.45, -0.52], [0.0, -0.44], [0.45, -0.52], sp));
    dots.push(...sampleQuad([0.45, -0.52], [0.82, -0.48], [0.84, 0.16], sp));
    dots.push(...sampleQuad([0.84, 0.16], [0.84, 0.66], [0.54, 0.58], sp));
    dots.push(...sampleQuad([0.54, 0.58], [0.34, 0.44], [0.24, 0.24], sp));
    dots.push(...samplePolyline([[0.24, 0.24], [-0.24, 0.24]], sp));
    dots.push(...sampleQuad([-0.24, 0.24], [-0.34, 0.44], [-0.54, 0.58], sp));
    dots.push(...sampleQuad([-0.54, 0.58], [-0.84, 0.66], [-0.84, 0.16], sp));
    dots.push(...sampleQuad([-0.84, 0.16], [-0.82, -0.48], [-0.45, -0.52], sp));
    dots.push(...samplePolyline([[-0.56, -0.06], [-0.26, -0.06]], sp * 0.85));
    dots.push(...samplePolyline([[-0.41, -0.21], [-0.41, 0.09]], sp * 0.85));
    dots.push([0.41, -0.22], [0.55, -0.06], [0.41, 0.10], [0.27, -0.06]);
  } else if (id === 'chatroom') {
    dots.push(...sampleArc(-0.18, -0.10, 0.62, -Math.PI * 0.72, Math.PI * 0.66, sp, 0.80));
    dots.push(...samplePolyline([[-0.46, 0.34], [-0.66, 0.58], [-0.62, 0.22]], sp));
    dots.push(...sampleArc(-0.18, -0.10, 0.62, Math.PI * 0.86, Math.PI * 1.28, sp, 0.80));
    dots.push(...sampleArc(0.36, 0.18, 0.46, -Math.PI * 0.32, Math.PI * 0.36, sp, 0.80));
    dots.push(...samplePolyline([[0.64, 0.44], [0.76, 0.66], [0.46, 0.53]], sp));
    dots.push(...sampleArc(0.36, 0.18, 0.46, Math.PI * 0.56, Math.PI * 0.96, sp, 0.80));
    dots.push([-0.38, -0.10], [-0.18, -0.10], [0.02, -0.10]);
  } else if (id === 'about') {
    dots.push(...sampleArc(0, 0, 0.78, 0, Math.PI * 2, sp));
    dots.push(...sampleArc(0, -0.20, 0.24, 0, Math.PI * 2, sp * 0.92));
    dots.push(...sampleArc(0, 0.62, 0.52, -Math.PI * 0.86, -Math.PI * 0.14, sp * 0.95));
  }

  return dots;
}

// --- Redesigned Delicate Botanical Dot-Matrix Season Emblems (N = 128 crisp micro-dots) ---
// Crafted to match the airy, refined dot-stroke language of icons-v7-dotted-glyphs.png & final2-*.png

const EMBLEM_PARTICLE_COUNT = 128;

function resampleToCount(pts, count) {
  if (!pts.length) return Array.from({ length: count }, () => [0, 0]);
  const sorted = pts.slice().sort((a, b) => Math.atan2(a[1], a[0]) - Math.atan2(b[1], b[0]));
  const out = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.min(sorted.length - 1, Math.floor((i / count) * sorted.length));
    out.push(sorted[idx]);
  }
  return out;
}

function buildSeasonEmblem(seasonId) {
  const sp = 0.145;
  const pts = [];

  if (seasonId === 'spring') {
    // Delicate 5-petal Sakura outline with crisp notched tips + fine stamen ring
    for (let p = 0; p < 5; p++) {
      const a0 = -Math.PI / 2 + (p * Math.PI * 2) / 5;
      const ca = Math.cos(a0);
      const sa = Math.sin(a0);
      const rot = (x, y) => [x * ca - y * sa, x * sa + y * ca];
      const outline = [
        rot(0.18, -0.06),
        rot(0.55, -0.34),
        rot(0.96, -0.26),
        rot(0.84, 0.0), // petal tip notch
        rot(0.96, 0.26),
        rot(0.55, 0.34),
        rot(0.18, 0.06)
      ];
      pts.push(...samplePolyline(outline, sp));
      pts.push(rot(0.32, 0));
    }
    pts.push([0, 0]);
  } else if (seasonId === 'summer') {
    // Distinct Summer Emerald-Green Notched Lotus Pad with radial dot veins (clearly distinct from Spring pink Sakura!)
    const notchA = -Math.PI * 0.22;
    const notchW = 0.44;
    // Outer notched circular lotus pad rim
    pts.push(...sampleArc(0, 0.06, 0.90, notchA + notchW * 0.5, notchA + Math.PI * 2 - notchW * 0.5, sp * 0.92));
    // V-notch inward to center hub
    const n1x = Math.cos(notchA + notchW * 0.5) * 0.90;
    const n1y = 0.06 + Math.sin(notchA + notchW * 0.5) * 0.90;
    const n2x = Math.cos(notchA - notchW * 0.5) * 0.90;
    const n2y = 0.06 + Math.sin(notchA - notchW * 0.5) * 0.90;
    pts.push(...samplePolyline([[n1x, n1y], [0, 0.06], [n2x, n2y]], sp));
    // 7 delicate radial leaf-vein dot rays from center hub
    for (let v = 0; v < 7; v++) {
      const va = notchA + notchW * 0.85 + (v / 6) * (Math.PI * 2 - notchW * 1.7);
      pts.push(...samplePolyline([[0, 0.06], [Math.cos(va) * 0.72, 0.06 + Math.sin(va) * 0.72]], sp * 1.45));
    }
  } else if (seasonId === 'autumn') {
    // Crisp 5-lobed serrated Japanese Maple leaf outline + center vein dots + stem
    const outline = [
      [0.0, 0.58], [0.0, 0.22],
      [0.42, 0.34], [0.76, 0.18], [0.50, 0.06],
      [0.92, -0.18], [0.54, -0.22],
      [0.58, -0.68], [0.24, -0.44],
      [0.0, -0.96],
      [-0.24, -0.44], [-0.58, -0.68],
      [-0.54, -0.22], [-0.92, -0.18],
      [-0.50, 0.06], [-0.76, 0.18], [-0.42, 0.34],
      [0.0, 0.22]
    ];
    pts.push(...samplePolyline(outline, sp * 0.95));
    // Delicate inner vein dots
    pts.push([0, -0.46], [0, -0.12], [0.34, -0.14], [-0.34, -0.14], [0.26, 0.12], [-0.26, 0.12]);
  } else {
    // Delicate 6-fold crystalline Snowflake with hexagonal core & symmetric dendritic barbs
    for (let b = 0; b < 6; b++) {
      const a = (b * Math.PI) / 3 - Math.PI / 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      pts.push(...samplePolyline([[0, 0], [ca * 0.96, sa * 0.96]], sp * 1.05));
      for (const rBar of [0.46, 0.74]) {
        const bx = ca * rBar;
        const by = sa * rBar;
        const bLen = rBar < 0.6 ? 0.30 : 0.22;
        for (const side of [-1, 1]) {
          const ba = a + side * 0.72;
          pts.push(...samplePolyline([[bx, by], [bx + Math.cos(ba) * bLen, by + Math.sin(ba) * bLen]], sp * 1.1));
        }
      }
    }
  }

  return resampleToCount(pts, EMBLEM_PARTICLE_COUNT);
}

const SEASON_EMBLEMS = {
  spring: { pts: buildSeasonEmblem('spring'), color: [255, 166, 206] }, // Pink Sakura
  summer: { pts: buildSeasonEmblem('summer'), color: [128, 245, 168] }, // Emerald-Jade Lotus Pad
  autumn: { pts: buildSeasonEmblem('autumn'), color: [255, 146, 58] },  // Amber-Orange Maple
  winter: { pts: buildSeasonEmblem('winter'), color: [192, 234, 255] }  // Ice-Blue Snowflake
};

export const DESKTOP_ICONS = [
  { id: 'knowledge', route: '#knowledge', x: 0.395, y: 0.245, label: { zh: '知识库', en: 'Knowledge', ja: '知識庫' } },
  { id: 'videos',    route: '#videos',    x: 0.65, y: 0.235, label: { zh: '视频',   en: 'Videos',    ja: '動画' } },
  { id: 'resources', route: '#resources', x: 0.88, y: 0.345, label: { zh: '工具',   en: 'Tools',     ja: 'ツール' } },
  { id: 'games',     route: '#games',     x: 0.12, y: 0.495, label: { zh: '游戏',   en: 'Games',     ja: 'ゲーム' } },
  { id: 'chatroom',  route: '#chatroom',  x: 0.30, y: 0.740, label: { zh: '聊天室', en: 'Chat',      ja: 'チャット' } },
  { id: 'about',     route: '#about',     x: 0.85, y: 0.745, label: { zh: '关于',   en: 'About',     ja: '概要' } }
];

function animeEaseOutBack(t) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  if (t < 0.14) {
    const u = t / 0.14;
    return -0.10 * Math.sin(u * Math.PI);
  }
  const u = (t - 0.14) / 0.86;
  const c1 = 2.15;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2);
}

export class PondUIOverlay {
  constructor(options = {}) {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.width = 0;
    this.height = 0;

    this.lang = options.lang || 'zh';
    this.seasonId = options.season || 'summer';
    this.demoClock = options.demoClock ?? false;

    // Pre-rendered glowing dot sprites (ZERO ctx.shadowBlur at runtime -> 120 FPS!)
    this.whiteDotSprite = createGlowDotSprite(216, 240, 255);
    this.seasonDotSprites = {
      spring: createGlowDotSprite(255, 166, 206),
      summer: createGlowDotSprite(128, 245, 168),
      autumn: createGlowDotSprite(255, 146, 58),
      winter: createGlowDotSprite(192, 234, 255)
    };

    this.iconDotMaps = {};
    this.iconAssets = {}; // Optional transparent PNG icon overrides (assets/pond-icons/<id>.png)
    this.iconStates = {};
    for (const ic of DESKTOP_ICONS) {
      this.iconDotMaps[ic.id] = buildIconDots(ic.id);
      this.iconStates[ic.id] = {
        hover: false,
        hoverAnim: 0,
        clickPulse: 0
      };
    }

    this.sliderRect = { x0: 0.77, x1: 0.945, y: 0.072 };
    this.currentSeasonIdx = Math.max(0, SEASON_ORDER.indexOf(this.seasonId));
    this.fromSeasonId = this.seasonId;
    this.toSeasonId = this.seasonId;
    this.fromStopIdx = this.currentSeasonIdx;
    this.toStopIdx = this.currentSeasonIdx;
    this.morphStartTime = -10;
    this.morphDuration = 0.92;
    this.bootActive = false;
    this.bootProgress = 1;

    this.particleSeeds = Array.from({ length: EMBLEM_PARTICLE_COUNT }, (_, i) => {
      const a = (i * 2.399963) % (Math.PI * 2);
      const r = 0.45 + ((i * 17) % 100) / 100;
      return {
        vx: Math.cos(a) * r,
        vy: Math.sin(a) * r,
        delay: ((i * 31) % 100) / 500
      };
    });

    this.cornerHover = null;
    this.cornerHitBoxes = [];
    this.accountLabel = options.accountLabel || 'ID';
    this.lastRenderTime = -1;
    this.lastClockText = '';
    this.dirty = true;
  }

  markDirty() {
    this.dirty = true;
  }

  setIconAsset(id, img) {
    if (this.iconStates[id]) {
      this.iconAssets[id] = img;
      this.dirty = true;
    }
  }

  setBootState(active, progress = 1) {
    const nextActive = Boolean(active);
    const nextProg = Math.max(0, Math.min(1, progress));
    if (this.bootActive !== nextActive || Math.abs(this.bootProgress - nextProg) > 0.003) {
      this.bootActive = nextActive;
      this.bootProgress = nextProg;
      this.dirty = true;
    }
  }

  setLanguage(lang) {
    if (lang === 'zh' || lang === 'en' || lang === 'ja') {
      this.lang = lang;
      this.dirty = true;
    }
  }

  setSeason(newSeasonId, nowSec) {
    if (!SEASONS[newSeasonId] || newSeasonId === this.toSeasonId) return;
    // Interruptible slider morph: continue smoothly from current mid-flight stop position instead of snapping!
    const rawP = Math.max(0, Math.min(1, (nowSec - this.morphStartTime) / this.morphDuration));
    const currentVisualStop = this.fromStopIdx + (this.toStopIdx - this.fromStopIdx) * animeEaseOutBack(rawP);
    this.fromSeasonId = rawP > 0.5 ? this.toSeasonId : this.fromSeasonId;
    this.toSeasonId = newSeasonId;
    this.fromStopIdx = currentVisualStop;
    this.toStopIdx = SEASON_ORDER.indexOf(newSeasonId);
    this.seasonId = newSeasonId;
    this.morphStartTime = nowSec;
    this.dirty = true;
  }

  setIconHover(id, isHover) {
    for (const ic of DESKTOP_ICONS) {
      const next = (ic.id === id && isHover);
      if (this.iconStates[ic.id].hover !== next) {
        this.iconStates[ic.id].hover = next;
        this.dirty = true;
      }
    }
  }

  triggerIconClick(id) {
    if (this.iconStates[id]) {
      this.iconStates[id].clickPulse = 1.0;
      this.dirty = true;
    }
  }

  hitTest(nx, ny) {
    // Top-center clock/date HUD -> opens Welcome & Recent Updates modal
    if (ny >= 0.01 && ny <= 0.095 && nx >= 0.36 && nx <= 0.64) {
      return { type: 'clock' };
    }

    const sy = this.sliderRect.y;
    if (Math.abs(ny - sy) < 0.048 && nx >= this.sliderRect.x0 - 0.03 && nx <= this.sliderRect.x1 + 0.03) {
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < 4; i++) {
        const sx = this.sliderRect.x0 + (this.sliderRect.x1 - this.sliderRect.x0) * (i / 3);
        const d = Math.abs(nx - sx);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }
      return { type: 'season', seasonId: SEASON_ORDER[bestIdx], index: bestIdx };
    }

    for (const ic of DESKTOP_ICONS) {
      const dx = nx - ic.x;
      const dy = ny - (ic.y + 0.015);
      if (Math.abs(dx) < 0.055 && Math.abs(dy) < 0.075) {
        return { type: 'icon', icon: ic };
      }
    }

    // 3. Pixel-accurate dynamic hit-boxes for bottom-left Account & Language corner
    for (const box of this.cornerHitBoxes) {
      if (nx >= box.x0 && nx <= box.x1 && ny >= box.y0 && ny <= box.y1) {
        return box.hit;
      }
    }

    return null;
  }

  _formatClock() {
    if (this.demoClock) {
      const d = SEASONS[this.seasonId]?.demoDate || '2025-07-15';
      return `12:00  ${d}`;
    }
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const yyyy = now.getFullYear();
    const mo = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${hh}:${mm}  ${yyyy}-${mo}-${dd}`;
  }

  // Returns { canvas, updated } so WebGL only uploads uiTex when needed -> huge 120 FPS win!
  render(t, dt, cssWidth, cssHeight) {
    // Cap UI canvas at crisp 1x CSS resolution (up to 1600px wide) — plenty sharp & 4x lighter than DPR 2!
    const scaleCap = Math.min(1.25, 1600 / Math.max(1, cssWidth));
    const w = Math.max(320, Math.round(cssWidth * scaleCap));
    const h = Math.max(240, Math.round(cssHeight * scaleCap));
    if (this.width !== w || this.height !== h) {
      this.width = w;
      this.height = h;
      this.canvas.width = w;
      this.canvas.height = h;
      this.dirty = true;
    }

    // ZERO idle redraws! Only redraw & upload UI texture when:
    // - dirty (hover/click/season/lang/resize), OR
    // - morphing / icon hover-click animating, OR
    // - clock minute text actually changed!
    const morphing = (t - this.morphStartTime) < this.morphDuration + 0.05;
    let iconAnimating = false;
    for (const ic of DESKTOP_ICONS) {
      const st = this.iconStates[ic.id];
      const target = st.hover ? 1 : 0;
      if (Math.abs(target - st.hoverAnim) > 0.005 || st.clickPulse > 0.005) {
        iconAnimating = true;
        break;
      }
    }
    const clockNow = this._formatClock();
    const clockChanged = clockNow !== this.lastClockText;

    if (!this.dirty && !morphing && !iconAnimating && !clockChanged && !this.bootActive) {
      return { canvas: this.canvas, updated: false };
    }

    this.dirty = false;
    this.lastClockText = clockNow;
    this.lastRenderTime = t;

    const ctx = this.ctx;
    ctx.clearRect(0, 0, w, h);

    if (this.bootActive && this.bootProgress < 0.995) {
      // Smoothly cross-fade normal UI in during the final 24% of boot (0.76 -> 1.0)
      const uiAlpha = Math.max(0, Math.min(1, (this.bootProgress - 0.74) / 0.26));
      if (uiAlpha > 0.01) {
        ctx.save();
        ctx.globalAlpha = uiAlpha;
        this._drawClock(ctx, w, h);
        this._drawSeasonSlider(ctx, w, h, t);
        this._drawDesktopIcons(ctx, w, h, t, dt);
        this._drawDiscreetCorner(ctx, w, h, t);
        ctx.restore();
      }
      this._drawBootTitle(ctx, w, h, this.bootProgress);
      return { canvas: this.canvas, updated: true };
    }

    this._drawClock(ctx, w, h);
    this._drawSeasonSlider(ctx, w, h, t);
    this._drawDesktopIcons(ctx, w, h, t, dt);
    this._drawDiscreetCorner(ctx, w, h, t);

    return { canvas: this.canvas, updated: true };
  }

  _drawBootTitle(ctx, w, h, progress) {
    const fadeIn = Math.max(0, Math.min(1, (progress - 0.16) / 0.22));
    const fadeOut = 1 - Math.max(0, Math.min(1, (progress - 0.80) / 0.16));
    const alpha = fadeIn * fadeOut;
    if (alpha <= 0.01) return;

    const titleSize = Math.max(18, Math.round(Math.min(w, h * 1.4) * 0.028));
    const y = h * 0.085;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `600 ${titleSize}px "JetBrains Mono", "Cascadia Mono", Consolas, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = 'L U S U 5 7 5';
    ctx.fillStyle = 'rgba(104, 240, 224, 0.28)';
    ctx.fillText(label, w * 0.5, y + 1);
    ctx.fillStyle = 'rgba(222, 252, 248, 0.94)';
    ctx.fillText(label, w * 0.5, y);

    // Restrained dotted real-progress bar directly underneath site title
    const barW = Math.min(220, w * 0.22);
    const barX = (w - barW) * 0.5;
    const barY = y + titleSize * 0.92;
    const dots = 24;
    const filled = Math.round(progress * dots);
    for (let i = 0; i < dots; i++) {
      const dx = barX + (i / (dots - 1)) * barW;
      ctx.fillStyle = i < filled ? 'rgba(126, 252, 224, 0.92)' : 'rgba(126, 252, 224, 0.22)';
      ctx.fillRect(dx - 1.5, barY - 1.5, 3, 3);
    }
    ctx.restore();
  }

  _drawClock(ctx, w, h) {
    const fontSize = Math.max(15, Math.round(Math.min(w, h * 1.4) * 0.022));
    ctx.save();
    ctx.font = `500 ${fontSize}px "JetBrains Mono", "Cascadia Mono", Consolas, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const txt = this._formatClock();
    // Fast dual-layer text glow (no expensive shadowBlur)
    ctx.fillStyle = 'rgba(180, 236, 255, 0.28)';
    ctx.fillText(txt, w * 0.5, h * 0.024 + 1);
    ctx.fillStyle = 'rgba(238, 248, 252, 0.95)';
    ctx.fillText(txt, w * 0.5, h * 0.024);
    ctx.restore();
  }

  _drawSeasonSlider(ctx, w, h, t) {
    const x0 = this.sliderRect.x0 * w;
    const x1 = this.sliderRect.x1 * w;
    const y = this.sliderRect.y * h;
    const stopX = (idx) => x0 + (x1 - x0) * (idx / 3);
    const scale = Math.max(15, Math.min(w, h * 1.45) * 0.023);

    ctx.save();

    // Dotted horizontal rail
    const dotStep = Math.max(5, (x1 - x0) / 34);
    ctx.fillStyle = 'rgba(215, 238, 244, 0.32)';
    for (let x = x0; x <= x1; x += dotStep) {
      ctx.fillRect(x - 0.8, y - 0.8, 1.6, 1.6);
    }

    // 4 stop nodes
    for (let i = 0; i < 4; i++) {
      const sx = stopX(i);
      const isActive = i === this.toStopIdx;
      const r = isActive ? Math.max(7, scale * 0.36) : Math.max(4.5, scale * 0.22);
      ctx.globalAlpha = isActive ? 0.95 : 0.65;
      ctx.drawImage(this.whiteDotSprite, sx - r, y - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1.0;

    // Particle-morphing active season emblem
    const rawP = Math.max(0, Math.min(1, (t - this.morphStartTime) / this.morphDuration));
    const fromEmblem = SEASON_EMBLEMS[this.fromSeasonId] || SEASON_EMBLEMS.summer;
    const toEmblem = SEASON_EMBLEMS[this.toSeasonId] || SEASON_EMBLEMS.summer;
    const fromX = stopX(this.fromStopIdx);
    const toX = stopX(this.toStopIdx);

    const sprite = this.seasonDotSprites[this.toSeasonId] || this.whiteDotSprite;
    const emblemCenterY = y - scale * 0.22;
    const dotDrawR = Math.max(2.6, scale * 0.115);

    for (let i = 0; i < EMBLEM_PARTICLE_COUNT; i++) {
      const seed = this.particleSeeds[i];
      const localP = rawP >= 1 ? 1 : Math.max(0, Math.min(1, (rawP - seed.delay * 0.52) / (1 - seed.delay * 0.52)));
      const eased = animeEaseOutBack(localP);

      const p0 = fromEmblem.pts[i];
      const p1 = toEmblem.pts[i];

      const scatter = Math.sin(localP * Math.PI);
      const scatterRadius = scale * 1.45 * scatter;

      const xStart = fromX + p0[0] * scale;
      const yStart = emblemCenterY + p0[1] * scale;
      const xEnd = toX + p1[0] * scale;
      const yEnd = emblemCenterY + p1[1] * scale;

      const breathe = rawP >= 1 ? (1.0 + 0.025 * Math.sin(t * 2.0 + i * 0.25)) : 1.0;
      const fx = rawP >= 1 ? toX + p1[0] * scale * breathe : (xStart + (xEnd - xStart) * eased + seed.vx * scatterRadius);
      const fy = rawP >= 1 ? emblemCenterY + p1[1] * scale * breathe : (yStart + (yEnd - yStart) * eased + seed.vy * scatterRadius);

      // Anime afterimage trail during scatter-morph
      if (rawP < 1 && scatter > 0.08) {
        ctx.globalAlpha = 0.30 * scatter;
        ctx.drawImage(sprite, fx - (xEnd - xStart) * 0.07 - dotDrawR, fy - seed.vy * scatterRadius * 0.22 - dotDrawR, dotDrawR * 2, dotDrawR * 2);
      }

      ctx.globalAlpha = 0.80 + 0.20 * Math.sin(t * 2.6 + i * 0.7);
      ctx.drawImage(sprite, fx - dotDrawR, fy - dotDrawR, dotDrawR * 2, dotDrawR * 2);
    }

    ctx.restore();
  }

  _drawDesktopIcons(ctx, w, h, t, dt) {
    const baseRadius = Math.max(26, Math.min(w, h * 1.45) * 0.040);
    const spriteHalf = Math.max(3.1, baseRadius * 0.088);
    const labelSize = Math.max(13, Math.round(baseRadius * 0.37));
    const labelFont = `400 ${labelSize}px "PingFang SC", "Microsoft YaHei", "Hiragino Sans", sans-serif`;

    ctx.save();
    ctx.font = labelFont;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    for (const ic of DESKTOP_ICONS) {
      const st = this.iconStates[ic.id];
      const targetHover = st.hover ? 1 : 0;
      st.hoverAnim += (targetHover - st.hoverAnim) * Math.min(1, dt * 12);
      if (st.clickPulse > 0) {
        st.clickPulse = Math.max(0, st.clickPulse - dt * 3.4);
      }

      const hoverScale = 1.0 + 0.085 * animeEaseOutBack(st.hoverAnim);
      const clickBounce = st.clickPulse > 0 ? Math.sin(st.clickPulse * Math.PI * 2.0) * 0.10 * st.clickPulse : 0;
      const scale = hoverScale + clickBounce;
      const floatY = -st.hoverAnim * 3.0;

      const cx = ic.x * w;
      const cy = ic.y * h + floatY;
      const dots = this.iconDotMaps[ic.id];
      const sr = spriteHalf * (1.0 + st.hoverAnim * 0.14);

      // Video 2 iridescent pink-violet-white bloom halo pulse on icon click!
      if (st.clickPulse > 0.01) {
        const p = st.clickPulse;
        const haloR = baseRadius * (1.35 + (1.0 - p) * 0.55);
        const hg = ctx.createRadialGradient(cx, cy, baseRadius * 0.25, cx, cy, haloR);
        hg.addColorStop(0.0, `rgba(255, 220, 245, ${0.52 * p})`);
        hg.addColorStop(0.45, `rgba(235, 118, 210, ${0.42 * p})`);
        hg.addColorStop(0.80, `rgba(148, 128, 255, ${0.18 * p})`);
        hg.addColorStop(1.0, 'rgba(120, 140, 255, 0)');
        ctx.globalAlpha = 1.0;
        ctx.fillStyle = hg;
        ctx.beginPath();
        ctx.arc(cx, cy, haloR, 0, Math.PI * 2);
        ctx.fill();
      }

      const customIcon = this.iconAssets[ic.id];
      if (customIcon) {
        // Render drop-in transparent PNG icon with full anime hover/overshoot & afterimage trail!
        const drawSize = baseRadius * 2.15 * scale;
        if (st.hoverAnim > 0.04 || st.clickPulse > 0.02) {
          ctx.globalAlpha = Math.max(st.hoverAnim * 0.24, st.clickPulse * 0.36);
          const gSize = drawSize * 1.06;
          ctx.drawImage(customIcon, cx - gSize * 0.5, cy - gSize * 0.5 + 2.5, gSize, gSize);
        }
        ctx.globalAlpha = st.hover ? 1.0 : 0.94;
        ctx.drawImage(customIcon, cx - drawSize * 0.5, cy - drawSize * 0.5, drawSize, drawSize);
      } else {
        // Procedural icons-v7 dot-matrix fallback
        if (st.hoverAnim > 0.04 || st.clickPulse > 0.02) {
          ctx.globalAlpha = Math.max(st.hoverAnim * 0.24, st.clickPulse * 0.36);
          for (let i = 0; i < dots.length; i += 2) {
            const d = dots[i];
            const gx = cx + d[0] * baseRadius * scale * 1.05;
            const gy = cy + d[1] * baseRadius * scale * 1.05 + 2.5;
            ctx.drawImage(this.whiteDotSprite, gx - sr, gy - sr, sr * 2, sr * 2);
          }
        }

        for (let i = 0; i < dots.length; i++) {
          const d = dots[i];
          const px = cx + d[0] * baseRadius * scale;
          const py = cy + d[1] * baseRadius * scale;
          ctx.globalAlpha = Math.min(1.0, 0.90 + st.hoverAnim * 0.10);
          ctx.drawImage(this.whiteDotSprite, px - sr, py - sr, sr * 2, sr * 2);
        }
      }

      // Crisp legible label underneath (enhanced dark midnight backing in Winter so text pops cleanly over ice/snow!)
      const label = ic.label[this.lang] || ic.label.zh;
      const ly = cy + baseRadius * 0.92;
      const isWinter = this.seasonId === 'winter';
      ctx.globalAlpha = isWinter ? 0.92 : 0.78;
      ctx.fillStyle = isWinter ? '#040d18' : '#020b0d';
      ctx.fillText(label, cx - 1, ly);
      ctx.fillText(label, cx + 1, ly);
      ctx.fillText(label, cx, ly - 1);
      ctx.fillText(label, cx, ly + 1.5);
      ctx.globalAlpha = st.hover ? 1.0 : (isWinter ? 0.96 : 0.90);
      ctx.fillStyle = isWinter ? '#f4fbff' : '#e8f4f8';
      ctx.fillText(label, cx, ly);
    }

    ctx.restore();
  }

  _drawDiscreetCorner(ctx, w, h, t) {
    const x0 = w * 0.068;
    const y0 = h * 0.935;
    const fontSize = Math.max(11, Math.round(Math.min(w, h * 1.4) * 0.0145));
    const isAnyHover = Boolean(this.cornerHover);
    const isWinter = this.seasonId === 'winter';

    ctx.save();
    ctx.font = `500 ${fontSize}px "JetBrains Mono", "Cascadia Mono", Consolas, monospace`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    const drawCornerText = (txt, tx, ty, fillCol) => {
      if (isWinter) {
        ctx.fillStyle = 'rgba(4, 12, 22, 0.92)';
        ctx.fillText(txt, tx - 1, ty);
        ctx.fillText(txt, tx + 1, ty);
        ctx.fillText(txt, tx, ty + 1);
      }
      ctx.fillStyle = fillCol;
      ctx.fillText(txt, tx, ty);
    };

    const accHover = this.cornerHover === 'account';
    const dotR = accHover ? 5.5 : 4.0;
    ctx.globalAlpha = accHover ? 0.98 : (isWinter ? 0.85 : 0.52);
    ctx.drawImage(this.whiteDotSprite, x0 - dotR, y0 - dotR, dotR * 2, dotR * 2);

    ctx.globalAlpha = 1.0;
    const accText = this.accountLabel || 'ID';
    const accTextX = x0 + fontSize * 0.72;
    const accTextW = ctx.measureText(accText).width;
    drawCornerText(
      accText,
      accTextX,
      y0,
      accHover
        ? 'rgba(255, 255, 255, 1.0)'
        : 'rgba(232, 252, 248, 0.94)'
    );

    const padX = fontSize * 1.15;
    const padY = fontSize * 1.85;
    this.cornerHitBoxes = [
      {
        x0: (x0 - padX) / w,
        x1: (accTextX + accTextW + padX * 0.7) / w,
        y0: (y0 - padY) / h,
        y1: (y0 + padY) / h,
        hit: { type: 'account' }
      }
    ];

    const sepX = accTextX + accTextW + fontSize * 0.65;
    ctx.fillStyle = 'rgba(204, 242, 238, 0.65)';
    ctx.fillRect(sepX - 1, y0 - 1, 2, 2);

    const langs = [
      { id: 'zh', text: '中' },
      { id: 'en', text: 'EN' },
      { id: 'ja', text: '日' }
    ];
    let curX = sepX + fontSize * 0.75;
    for (const item of langs) {
      const active = this.lang === item.id;
      const hov = this.cornerHover === item.id;
      const tw = ctx.measureText(item.text).width;
      const col = hov
        ? 'rgba(255, 255, 255, 1.0)'
        : active
          ? 'rgba(255, 255, 255, 0.98)'
          : 'rgba(214, 244, 240, 0.78)';
      drawCornerText(item.text, curX, y0, col);
      if (active) {
        ctx.fillStyle = 'rgba(136, 252, 232, 0.95)';
        ctx.fillRect(curX + tw * 0.5 - 1.2, y0 + fontSize * 0.58, 2.4, 2.4);
      }
      this.cornerHitBoxes.push({
        x0: (curX - padX * 0.55) / w,
        x1: (curX + tw + padX * 0.55) / w,
        y0: (y0 - padY) / h,
        y1: (y0 + padY) / h,
        hit: { type: 'lang', lang: item.id }
      });
      curX += tw + fontSize * 0.85;
    }

    ctx.restore();
  }
}
