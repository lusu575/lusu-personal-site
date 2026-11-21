// High-DPI CRT UI Overlay & True Particle Layer (Gate 4)
// - Top minimal clock & date (no signal/battery chrome)
// - 6 dotted desktop icons strictly matching icons-v7-dotted-glyphs.png + final2-*.png
// - Top-right 4-stop season slider with 140-particle morphing emblem (Sakura / Lotus / Maple / Snowflake)
// - Anime-style anticipation -> overshoot -> settle motion with subtle particle afterimage
// - Discreet bottom-left CRT terminal corner for Account & Language (zh / en / ja)

import { SEASON_ORDER, SEASONS } from './seasons.mjs';

// --- Geometry helpers for uniform arc-length dot sampling ---

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

// --- Exact 6 Desktop Icon Dot Maps (normalized [-1, 1] box, matching icons-v7-dotted-glyphs.png) ---

function buildIconDots(id) {
  const sp = 0.105;
  const dots = [];

  if (id === 'knowledge') {
    // Open book with curved top/bottom pages and center spine
    dots.push(...sampleQuad([-0.82, -0.52], [-0.42, -0.72], [0.0, -0.42], sp));
    dots.push(...sampleQuad([0.0, -0.42], [0.42, -0.72], [0.82, -0.52], sp));
    dots.push(...samplePolyline([[0.82, -0.52], [0.82, 0.56]], sp));
    dots.push(...sampleQuad([0.82, 0.56], [0.42, 0.36], [0.0, 0.64], sp));
    dots.push(...sampleQuad([0.0, 0.64], [-0.42, 0.36], [-0.82, 0.56], sp));
    dots.push(...samplePolyline([[-0.82, 0.56], [-0.82, -0.52]], sp));
    dots.push(...samplePolyline([[0.0, -0.42], [0.0, 0.64]], sp));
  } else if (id === 'videos') {
    // Rounded rectangle screen + centered play triangle
    dots.push(...sampleRoundedRect(-0.84, -0.58, 1.68, 1.16, 0.28, sp));
    dots.push(...samplePolyline([[-0.18, -0.26], [0.28, 0.0], [-0.18, 0.26], [-0.18, -0.26]], sp));
  } else if (id === 'resources') {
    // Single diagonal wrench (clean open C-jaw at top-right, rounded handle + eyelet at bottom-left)
    const raw = [];
    // Open C-jaw outer arc centered at (0.34, -0.34)
    raw.push(...sampleArc(0.34, -0.34, 0.42, -0.15, Math.PI * 1.18, sp));
    // Clean square U-notch opening facing top-right
    raw.push(...samplePolyline([[0.74, -0.40], [0.48, -0.14], [0.22, -0.40], [0.48, -0.66]], sp));
    // Shaft edges down to handle
    raw.push(...samplePolyline([[0.04, -0.06], [-0.54, 0.52]], sp));
    raw.push(...samplePolyline([[0.24, 0.14], [-0.34, 0.72]], sp));
    // Rounded handle end
    raw.push(...sampleArc(-0.44, 0.62, 0.14, Math.PI * 0.25, Math.PI * 1.25, sp));
    // Small eyelet dot in handle
    raw.push([-0.44, 0.62]);
    dots.push(...raw);
  } else if (id === 'games') {
    // Gamepad silhouette + left D-pad + right 4 face buttons
    dots.push(...sampleQuad([-0.45, -0.52], [0.0, -0.44], [0.45, -0.52], sp));
    dots.push(...sampleQuad([0.45, -0.52], [0.82, -0.48], [0.84, 0.16], sp));
    dots.push(...sampleQuad([0.84, 0.16], [0.84, 0.66], [0.54, 0.58], sp));
    dots.push(...sampleQuad([0.54, 0.58], [0.34, 0.44], [0.24, 0.24], sp));
    dots.push(...samplePolyline([[0.24, 0.24], [-0.24, 0.24]], sp));
    dots.push(...sampleQuad([-0.24, 0.24], [-0.34, 0.44], [-0.54, 0.58], sp));
    dots.push(...sampleQuad([-0.54, 0.58], [-0.84, 0.66], [-0.84, 0.16], sp));
    dots.push(...sampleQuad([-0.84, 0.16], [-0.82, -0.48], [-0.45, -0.52], sp));
    // Left D-pad cross
    dots.push(...samplePolyline([[-0.56, -0.06], [-0.26, -0.06]], sp * 0.85));
    dots.push(...samplePolyline([[-0.41, -0.21], [-0.41, 0.09]], sp * 0.85));
    // Right 4 face buttons
    dots.push([0.41, -0.22], [0.55, -0.06], [0.41, 0.10], [0.27, -0.06]);
  } else if (id === 'chatroom') {
    // Overlapping double speech bubbles + 3 ellipsis dots in front bubble
    // Front larger bubble (left-upper)
    dots.push(...sampleArc(-0.18, -0.10, 0.62, -Math.PI * 0.72, Math.PI * 0.66, sp, 0.80));
    dots.push(...samplePolyline([[-0.46, 0.34], [-0.66, 0.58], [-0.62, 0.22]], sp));
    dots.push(...sampleArc(-0.18, -0.10, 0.62, Math.PI * 0.86, Math.PI * 1.28, sp, 0.80));
    // Back smaller bubble (right-lower)
    dots.push(...sampleArc(0.36, 0.18, 0.46, -Math.PI * 0.32, Math.PI * 0.36, sp, 0.80));
    dots.push(...samplePolyline([[0.64, 0.44], [0.76, 0.66], [0.46, 0.53]], sp));
    dots.push(...sampleArc(0.36, 0.18, 0.46, Math.PI * 0.56, Math.PI * 0.96, sp, 0.80));
    // 3 chat dots inside front bubble
    dots.push([-0.38, -0.10], [-0.18, -0.10], [0.02, -0.10]);
  } else if (id === 'about') {
    // Outer circle + inner head circle + shoulder arc
    dots.push(...sampleArc(0, 0, 0.78, 0, Math.PI * 2, sp));
    dots.push(...sampleArc(0, -0.20, 0.24, 0, Math.PI * 2, sp * 0.92));
    dots.push(...sampleArc(0, 0.62, 0.52, -Math.PI * 0.86, -Math.PI * 0.14, sp * 0.95));
  }

  return dots;
}

// --- 4 Season Slider Emblems: Equal Particle Count (N = 140) for True Particle Morphing ---

const EMBLEM_PARTICLE_COUNT = 140;

function resampleToCount(pts, count) {
  if (!pts.length) return Array.from({ length: count }, () => [0, 0]);
  // Sort by angle around center so morphing flows gracefully like a swirling bloom
  const sorted = pts.slice().sort((a, b) => Math.atan2(a[1], a[0]) - Math.atan2(b[1], b[0]));
  const out = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.min(sorted.length - 1, Math.floor((i / count) * sorted.length));
    out.push(sorted[idx]);
  }
  return out;
}

function buildSeasonEmblem(seasonId) {
  const pts = [];
  if (seasonId === 'spring') {
    // 5-petal notched Sakura blossom
    for (let p = 0; p < 5; p++) {
      const baseA = -Math.PI / 2 + (p * Math.PI * 2) / 5;
      for (let i = 0; i < 24; i++) {
        const u = i / 23;
        const localA = (u - 0.5) * 1.05;
        const notch = 1.0 - 0.18 * Math.exp(-Math.pow(localA * 6.5, 2));
        const r = Math.sin(u * Math.PI) * 0.95 * notch;
        const a = baseA + localA * 0.58;
        pts.push([Math.cos(a) * r, Math.sin(a) * r]);
      }
      // Inner stamen dots
      pts.push([Math.cos(baseA) * 0.26, Math.sin(baseA) * 0.26]);
    }
    pts.push([0, 0]);
  } else if (seasonId === 'summer') {
    // Radiant multi-petal Lotus flower (matching final2-summer.png top-right icon)
    const petals = [
      { ang: -Math.PI / 2, len: 1.0, wid: 0.34 },
      { ang: -Math.PI / 2 - 0.44, len: 0.92, wid: 0.30 },
      { ang: -Math.PI / 2 + 0.44, len: 0.92, wid: 0.30 },
      { ang: -Math.PI / 2 - 0.92, len: 0.82, wid: 0.28 },
      { ang: -Math.PI / 2 + 0.92, len: 0.82, wid: 0.28 }
    ];
    for (const pt of petals) {
      for (let i = 0; i < 24; i++) {
        const u = i / 23;
        const side = i % 2 === 0 ? 1 : -1;
        const t = Math.floor(i / 2) / 11;
        const along = t * pt.len;
        const across = Math.sin(t * Math.PI) * pt.wid * side;
        const ca = Math.cos(pt.ang);
        const sa = Math.sin(pt.ang);
        const x = ca * along - sa * across;
        const y = sa * along + ca * across + 0.42;
        pts.push([x, y]);
      }
    }
    // Luminous base arc
    pts.push(...sampleArc(0, 0.48, 0.52, -Math.PI * 0.85, -Math.PI * 0.15, 0.12));
  } else if (seasonId === 'autumn') {
    // 5-pointed palmate Maple leaf
    const lobes = [
      { ang: -Math.PI / 2, len: 1.00 },
      { ang: -Math.PI / 2 - 0.72, len: 0.84 },
      { ang: -Math.PI / 2 + 0.72, len: 0.84 },
      { ang: -Math.PI / 2 - 1.48, len: 0.58 },
      { ang: -Math.PI / 2 + 1.48, len: 0.58 }
    ];
    for (const lb of lobes) {
      for (let i = 0; i < 22; i++) {
        const t = i / 21;
        const r = t * lb.len;
        const spread = Math.sin(t * Math.PI) * 0.22 * (i % 2 === 0 ? 1 : -1);
        const a = lb.ang + spread;
        pts.push([Math.cos(a) * r, Math.sin(a) * r + 0.12]);
      }
    }
    // Stem
    for (let i = 0; i < 12; i++) {
      pts.push([0, 0.18 + (i / 11) * 0.72]);
    }
  } else {
    // 6-branch crystalline Snowflake
    for (let b = 0; b < 6; b++) {
      const a = (b * Math.PI) / 3;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      for (let i = 0; i < 11; i++) {
        const r = (i / 10) * 0.96;
        pts.push([ca * r, sa * r]);
      }
      // Two chevron barbs per branch
      for (const rBar of [0.46, 0.72]) {
        for (const side of [-1, 1]) {
          const ba = a + side * 0.65;
          for (let j = 1; j <= 3; j++) {
            const bl = (j / 3) * 0.28;
            pts.push([ca * rBar + Math.cos(ba) * bl, sa * rBar + Math.sin(ba) * bl]);
          }
        }
      }
    }
  }
  return resampleToCount(pts, EMBLEM_PARTICLE_COUNT);
}

const SEASON_EMBLEMS = {
  spring: { pts: buildSeasonEmblem('spring'), color: [255, 168, 204] },
  summer: { pts: buildSeasonEmblem('summer'), color: [255, 140, 188] },
  autumn: { pts: buildSeasonEmblem('autumn'), color: [255, 148, 62] },
  winter: { pts: buildSeasonEmblem('winter'), color: [192, 232, 255] }
};

// Desktop icon layout calibrated to final2-*.png
export const DESKTOP_ICONS = [
  { id: 'knowledge', route: '#knowledge', x: 0.21, y: 0.225, label: { zh: '知识库', en: 'Knowledge', ja: '知識庫' } },
  { id: 'videos',    route: '#videos',    x: 0.65, y: 0.235, label: { zh: '视频',   en: 'Videos',    ja: '動画' } },
  { id: 'resources', route: '#resources', x: 0.88, y: 0.345, label: { zh: '工具',   en: 'Tools',     ja: 'ツール' } },
  { id: 'games',     route: '#games',     x: 0.12, y: 0.495, label: { zh: '游戏',   en: 'Games',     ja: 'ゲーム' } },
  { id: 'chatroom',  route: '#chatroom',  x: 0.30, y: 0.740, label: { zh: '聊天室', en: 'Chat',      ja: 'チャット' } },
  { id: 'about',     route: '#about',     x: 0.85, y: 0.745, label: { zh: '关于',   en: 'About',     ja: '概要' } }
];

// Anime-style spring overshoot curve: slight anticipation dip -> crisp overshoot -> settle
function animeEaseOutBack(t) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  if (t < 0.14) {
    // Brief anticipation pull-back
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
    this.dpr = 1;

    this.lang = options.lang || 'zh';
    this.seasonId = options.season || 'summer';
    this.demoClock = options.demoClock ?? false;

    this.iconDotMaps = {};
    this.iconStates = {};
    for (const ic of DESKTOP_ICONS) {
      this.iconDotMaps[ic.id] = buildIconDots(ic.id);
      this.iconStates[ic.id] = {
        hover: false,
        hoverAnim: 0,
        clickPulse: 0,
        scale: 1,
        trails: []
      };
    }

    // Season slider particle morph state
    this.sliderRect = { x0: 0.77, x1: 0.945, y: 0.072 };
    this.currentSeasonIdx = Math.max(0, SEASON_ORDER.indexOf(this.seasonId));
    this.fromSeasonId = this.seasonId;
    this.toSeasonId = this.seasonId;
    this.fromStopIdx = this.currentSeasonIdx;
    this.toStopIdx = this.currentSeasonIdx;
    this.morphStartTime = -10;
    this.morphDuration = 0.85;

    // Pre-seeded deterministic scatter offsets per particle for organic burst during season morph
    this.particleSeeds = Array.from({ length: EMBLEM_PARTICLE_COUNT }, (_, i) => {
      const a = (i * 2.399963) % (Math.PI * 2);
      const r = 0.45 + ((i * 17) % 100) / 100;
      return {
        vx: Math.cos(a) * r,
        vy: Math.sin(a) * r,
        delay: ((i * 31) % 100) / 500 // slight stagger (0..0.2)
      };
    });

    // Discreet bottom-left terminal corner state (Account + Language)
    this.cornerHover = null; // 'account' | 'zh' | 'en' | 'ja' | null
    this.accountLabel = options.accountLabel || 'ID';
  }

  setLanguage(lang) {
    if (lang === 'zh' || lang === 'en' || lang === 'ja') {
      this.lang = lang;
    }
  }

  setSeason(newSeasonId, nowSec) {
    if (!SEASONS[newSeasonId] || newSeasonId === this.toSeasonId) return;
    this.fromSeasonId = this.toSeasonId;
    this.toSeasonId = newSeasonId;
    this.fromStopIdx = this.toStopIdx;
    this.toStopIdx = SEASON_ORDER.indexOf(newSeasonId);
    this.seasonId = newSeasonId;
    this.morphStartTime = nowSec;
  }

  setIconHover(id, isHover) {
    for (const ic of DESKTOP_ICONS) {
      this.iconStates[ic.id].hover = (ic.id === id && isHover);
    }
  }

  triggerIconClick(id) {
    if (this.iconStates[id]) {
      this.iconStates[id].clickPulse = 1.0;
    }
  }

  // Hit-testing in normalized CRT UV space (0..1, top-down Y)
  hitTest(nx, ny) {
    // 1. Season slider stops
    const sy = this.sliderRect.y;
    if (Math.abs(ny - sy) < 0.045 && nx >= this.sliderRect.x0 - 0.03 && nx <= this.sliderRect.x1 + 0.03) {
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

    // 2. 6 Desktop Icons
    for (const ic of DESKTOP_ICONS) {
      const dx = nx - ic.x;
      const dy = ny - (ic.y + 0.015);
      if (Math.abs(dx) < 0.055 && Math.abs(dy) < 0.075) {
        return { type: 'icon', icon: ic };
      }
    }

    // 3. Discreet bottom-left Account & Language corner
    if (ny > 0.90 && ny < 0.975 && nx > 0.055 && nx < 0.26) {
      if (nx < 0.125) return { type: 'account' };
      if (nx < 0.165) return { type: 'lang', lang: 'zh' };
      if (nx < 0.205) return { type: 'lang', lang: 'en' };
      return { type: 'lang', lang: 'ja' };
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

  render(t, dt, width, height, dpr) {
    const w = Math.max(320, Math.round(width));
    const h = Math.max(240, Math.round(height));
    if (this.width !== w || this.height !== h || this.dpr !== dpr) {
      this.width = w;
      this.height = h;
      this.dpr = dpr;
      this.canvas.width = w;
      this.canvas.height = h;
    }

    const ctx = this.ctx;
    ctx.clearRect(0, 0, w, h);

    // 1. Top minimal clock & date (crisp monospace, no system status icons)
    this._drawClock(ctx, w, h);

    // 2. Top-right 4-stop Season Slider with true particle-morphing emblem
    this._drawSeasonSlider(ctx, w, h, t);

    // 3. 6 Dotted Desktop Icons (icons-v7-dotted-glyphs.png)
    this._drawDesktopIcons(ctx, w, h, t, dt);

    // 4. Discreet bottom-left CRT terminal corner (Account + zh / EN / 日)
    this._drawDiscreetCorner(ctx, w, h, t);

    return this.canvas;
  }

  _drawClock(ctx, w, h) {
    const fontSize = Math.max(15, Math.round(Math.min(w, h * 1.4) * 0.022));
    ctx.save();
    ctx.font = `500 ${fontSize}px "JetBrains Mono", "Cascadia Mono", Consolas, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.shadowColor = 'rgba(210, 245, 255, 0.72)';
    ctx.shadowBlur = fontSize * 0.45;
    ctx.fillStyle = 'rgba(236, 246, 250, 0.94)';
    ctx.fillText(this._formatClock(), w * 0.5, h * 0.024);
    ctx.restore();
  }

  _drawSeasonSlider(ctx, w, h, t) {
    const x0 = this.sliderRect.x0 * w;
    const x1 = this.sliderRect.x1 * w;
    const y = this.sliderRect.y * h;
    const stopX = (idx) => x0 + (x1 - x0) * (idx / 3);
    const scale = Math.max(14, Math.min(w, h * 1.45) * 0.021);

    ctx.save();

    // Dotted horizontal rail between stops
    const dotStep = Math.max(5, (x1 - x0) / 34);
    ctx.fillStyle = 'rgba(215, 238, 244, 0.34)';
    for (let x = x0; x <= x1; x += dotStep) {
      ctx.beginPath();
      ctx.arc(x, y, Math.max(1.0, scale * 0.055), 0, Math.PI * 2);
      ctx.fill();
    }

    // 4 stop dots (inactive stops are quiet crisp dots; active stop glows softly)
    for (let i = 0; i < 4; i++) {
      const sx = stopX(i);
      const isActive = i === this.toStopIdx;
      ctx.save();
      ctx.shadowColor = isActive ? 'rgba(255, 225, 240, 0.9)' : 'rgba(210, 240, 255, 0.45)';
      ctx.shadowBlur = isActive ? scale * 0.5 : scale * 0.2;
      ctx.fillStyle = isActive ? 'rgba(255, 248, 252, 0.96)' : 'rgba(220, 240, 248, 0.72)';
      ctx.beginPath();
      ctx.arc(sx, y, isActive ? Math.max(2.6, scale * 0.14) : Math.max(1.8, scale * 0.095), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Particle-morphing active season emblem
    const rawP = Math.max(0, Math.min(1, (t - this.morphStartTime) / this.morphDuration));
    const fromEmblem = SEASON_EMBLEMS[this.fromSeasonId] || SEASON_EMBLEMS.summer;
    const toEmblem = SEASON_EMBLEMS[this.toSeasonId] || SEASON_EMBLEMS.summer;
    const fromX = stopX(this.fromStopIdx);
    const toX = stopX(this.toStopIdx);

    const colR = Math.round(fromEmblem.color[0] + (toEmblem.color[0] - fromEmblem.color[0]) * rawP);
    const colG = Math.round(fromEmblem.color[1] + (toEmblem.color[1] - fromEmblem.color[1]) * rawP);
    const colB = Math.round(fromEmblem.color[2] + (toEmblem.color[2] - fromEmblem.color[2]) * rawP);

    // Subtle soft glow behind the active emblem
    const centerX = fromX + (toX - fromX) * animeEaseOutBack(rawP);
    const emblemCenterY = y - scale * 0.16;
    const aura = ctx.createRadialGradient(centerX, emblemCenterY, 0, centerX, emblemCenterY, scale * 1.45);
    aura.addColorStop(0, `rgba(${colR}, ${colG}, ${colB}, 0.32)`);
    aura.addColorStop(1, `rgba(${colR}, ${colG}, ${colB}, 0)`);
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(centerX, emblemCenterY, scale * 1.45, 0, Math.PI * 2);
    ctx.fill();

    // Draw all 140 morphing particles (with anime scatter burst & afterimage trail during transition)
    const dotR = Math.max(1.15, scale * 0.064);
    for (let i = 0; i < EMBLEM_PARTICLE_COUNT; i++) {
      const seed = this.particleSeeds[i];
      const localP = rawP >= 1 ? 1 : Math.max(0, Math.min(1, (rawP - seed.delay * 0.55) / (1 - seed.delay * 0.55)));
      const eased = animeEaseOutBack(localP);

      const p0 = fromEmblem.pts[i];
      const p1 = toEmblem.pts[i];

      // Mid-flight organic scatter arc (particles disperse then re-coalesce!)
      const scatter = Math.sin(localP * Math.PI);
      const scatterRadius = scale * 1.35 * scatter;

      const xStart = fromX + p0[0] * scale;
      const yStart = emblemCenterY + p0[1] * scale;
      const xEnd = toX + p1[0] * scale;
      const yEnd = emblemCenterY + p1[1] * scale;

      const breathe = rawP >= 1 ? (1.0 + 0.03 * Math.sin(t * 2.0 + i * 0.25)) : 1.0;
      const px = xStart + (xEnd - xStart) * eased + seed.vx * scatterRadius;
      const py = yStart + (yEnd - yStart) * eased + seed.vy * scatterRadius;
      const fx = rawP >= 1 ? toX + p1[0] * scale * breathe : px;
      const fy = rawP >= 1 ? emblemCenterY + p1[1] * scale * breathe : py;

      // Subtle anime afterimage trail during transition
      if (rawP < 1 && scatter > 0.08) {
        ctx.fillStyle = `rgba(${colR}, ${colG}, ${colB}, ${0.28 * scatter})`;
        ctx.beginPath();
        ctx.arc(fx - (xEnd - xStart) * 0.06, fy - seed.vy * scatterRadius * 0.25, dotR * 0.85, 0, Math.PI * 2);
        ctx.fill();
      }

      const bright = 0.78 + 0.22 * Math.sin(t * 2.8 + i * 0.7);
      ctx.fillStyle = `rgba(${Math.min(255, colR + 28)}, ${Math.min(255, colG + 28)}, ${Math.min(255, colB + 28)}, ${bright})`;
      ctx.beginPath();
      ctx.arc(fx, fy, dotR, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  _drawDesktopIcons(ctx, w, h, t, dt) {
    const baseRadius = Math.max(26, Math.min(w, h * 1.45) * 0.040);
    const dotSize = Math.max(1.55, baseRadius * 0.044);
    const labelSize = Math.max(13, Math.round(baseRadius * 0.37));

    for (const ic of DESKTOP_ICONS) {
      const st = this.iconStates[ic.id];
      const targetHover = st.hover ? 1 : 0;
      st.hoverAnim += (targetHover - st.hoverAnim) * Math.min(1, dt * 11);
      if (st.clickPulse > 0) {
        st.clickPulse = Math.max(0, st.clickPulse - dt * 3.2);
      }

      // Anime anticipation/overshoot scale on hover + click pop
      const hoverScale = 1.0 + 0.085 * animeEaseOutBack(st.hoverAnim);
      const clickBounce = st.clickPulse > 0 ? Math.sin(st.clickPulse * Math.PI * 2.0) * 0.10 * st.clickPulse : 0;
      const scale = hoverScale + clickBounce;
      const floatY = Math.sin(t * 1.15 + ic.x * 7.0) * 1.4 - st.hoverAnim * 3.0;

      const cx = ic.x * w;
      const cy = ic.y * h + floatY;
      const dots = this.iconDotMaps[ic.id];

      ctx.save();

      // Subtle afterimage ghost ring during hover/click anime motion
      if (st.hoverAnim > 0.04 || st.clickPulse > 0.02) {
        const ghostAlpha = Math.max(st.hoverAnim * 0.22, st.clickPulse * 0.35);
        ctx.fillStyle = `rgba(185, 232, 255, ${ghostAlpha})`;
        for (let i = 0; i < dots.length; i += 2) {
          const d = dots[i];
          ctx.beginPath();
          ctx.arc(cx + d[0] * baseRadius * (scale * 1.05), cy + d[1] * baseRadius * (scale * 1.05) + 2.5, dotSize * 0.85, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Cold-white glowing phosphor dots (icons-v7-dotted-glyphs.png: pure monochrome cold white, no border, no fill)
      ctx.shadowColor = st.hover ? 'rgba(210, 245, 255, 0.95)' : 'rgba(190, 228, 255, 0.72)';
      ctx.shadowBlur = st.hover ? dotSize * 5.0 : dotSize * 3.2;

      for (let i = 0; i < dots.length; i++) {
        const d = dots[i];
        const px = cx + d[0] * baseRadius * scale;
        const py = cy + d[1] * baseRadius * scale;
        const shimmer = 0.86 + 0.14 * Math.sin(t * 2.4 + i * 0.55 + ic.x * 11.0);
        ctx.fillStyle = `rgba(238, 247, 255, ${Math.min(1, shimmer + st.hoverAnim * 0.14)})`;
        ctx.beginPath();
        ctx.arc(px, py, dotSize * (1.0 + st.hoverAnim * 0.12), 0, Math.PI * 2);
        ctx.fill();
      }

      // Clean sans-serif label underneath (crisp, legible, zero box)
      ctx.shadowColor = 'rgba(0, 12, 16, 0.85)';
      ctx.shadowBlur = 6;
      ctx.font = `400 ${labelSize}px "PingFang SC", "Microsoft YaHei", "Hiragino Sans", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = st.hover ? 'rgba(255, 255, 255, 0.98)' : 'rgba(232, 244, 248, 0.88)';
      ctx.fillText(ic.label[this.lang] || ic.label.zh, cx, cy + baseRadius * 0.92);

      ctx.restore();
    }
  }

  _drawDiscreetCorner(ctx, w, h, t) {
    // Low-key CRT terminal micro-strip in bottom-left corner: Account + zh / EN / 日
    // Blends naturally into the CRT dot-matrix aesthetic without competing with the pond or looking like OS chrome
    const x0 = w * 0.068;
    const y0 = h * 0.935;
    const fontSize = Math.max(11, Math.round(Math.min(w, h * 1.4) * 0.0145));
    const isAnyHover = Boolean(this.cornerHover);

    ctx.save();
    ctx.font = `400 ${fontSize}px "JetBrains Mono", "Cascadia Mono", Consolas, monospace`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    // Tiny dotted phosphor status indicator for Account
    const pulse = 0.55 + 0.25 * Math.sin(t * 1.8);
    const accHover = this.cornerHover === 'account';
    ctx.shadowColor = 'rgba(190, 236, 255, 0.65)';
    ctx.shadowBlur = accHover ? 8 : 3;
    ctx.fillStyle = accHover
      ? 'rgba(240, 250, 255, 0.95)'
      : `rgba(195, 224, 232, ${0.42 * pulse + 0.16})`;
    ctx.beginPath();
    ctx.arc(x0, y0, Math.max(1.8, fontSize * 0.16), 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = accHover
      ? 'rgba(244, 252, 255, 0.96)'
      : `rgba(204, 228, 236, ${isAnyHover ? 0.68 : 0.44})`;
    const accText = this.accountLabel || 'ID';
    ctx.fillText(accText, x0 + fontSize * 0.72, y0);

    // Subtle separator dot
    const sepX = x0 + fontSize * (1.2 + accText.length * 0.68);
    ctx.fillStyle = 'rgba(190, 220, 230, 0.28)';
    ctx.beginPath();
    ctx.arc(sepX, y0, 1.2, 0, Math.PI * 2);
    ctx.fill();

    // Discreet inline language switcher: 中  EN  日
    const langs = [
      { id: 'zh', text: '中' },
      { id: 'en', text: 'EN' },
      { id: 'ja', text: '日' }
    ];
    let curX = sepX + fontSize * 0.75;
    for (const item of langs) {
      const active = this.lang === item.id;
      const hov = this.cornerHover === item.id;
      ctx.fillStyle = hov
        ? 'rgba(255, 255, 255, 0.98)'
        : active
          ? 'rgba(232, 248, 252, 0.78)'
          : `rgba(195, 220, 228, ${isAnyHover ? 0.50 : 0.30})`;
      ctx.fillText(item.text, curX, y0);
      // Tiny phosphor dot underneath active language
      if (active) {
        const tw = ctx.measureText(item.text).width;
        ctx.fillStyle = 'rgba(220, 248, 255, 0.65)';
        ctx.beginPath();
        ctx.arc(curX + tw * 0.5, y0 + fontSize * 0.62, 1.3, 0, Math.PI * 2);
        ctx.fill();
      }
      curX += ctx.measureText(item.text).width + fontSize * 0.72;
    }

    ctx.restore();
  }
}
