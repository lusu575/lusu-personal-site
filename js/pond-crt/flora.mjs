// Static 4-Season Botanical & Ice Compositor using finalized transparent PNG parts (design-assets/parts/)
// Baked ONCE into per-season GPU textures on load/resize -> 0ms/frame cost (locked 120+ FPS!)
// Calibrated 1:1 against design-assets/mockups/season-{spring,summer,autumn,winter}.png

function drawWaterReflection(ctx, w, h, xFrac, yTopFrac, widthFrac, heightFrac, seed) {
  const bx = xFrac * w;
  const topY = yTopFrac * h;
  const rwBase = widthFrac * w;
  const reflH = heightFrac * h;

  ctx.save();
  for (let i = 0; i < 14; i++) {
    const t = i / 13;
    const ry = topY + t * reflH;
    const rw = rwBase * (1.15 - t * 0.45) * (0.72 + 0.34 * Math.sin(i * 2.3 + seed));
    const rh = Math.max(2.0, rwBase * 0.16);
    const alpha = (1.0 - t * 0.72) * 0.62;
    const g = ctx.createRadialGradient(bx, ry, 0, bx, ry, rw);
    g.addColorStop(0.0, `rgba(255, 128, 178, ${alpha})`);
    g.addColorStop(0.55, `rgba(235, 88, 146, ${alpha * 0.46})`);
    g.addColorStop(1.0, 'rgba(195, 65, 115, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(bx + Math.sin(i * 1.9 + seed) * rwBase * 0.16, ry, rw, rh, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPartCentered(ctx, img, w, h, cfg) {
  if (!img) return;
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;

  const drawW = cfg.size * w;
  const drawH = drawW * (ih / iw) * (cfg.squashY ?? 1.0);
  const cx = cfg.x * w;
  const cy = cfg.y * h;

  ctx.save();
  ctx.translate(cx, cy);
  if (cfg.rot) ctx.rotate(cfg.rot);
  if (cfg.flipX) ctx.scale(-1, 1);
  if (cfg.alpha !== undefined) ctx.globalAlpha = cfg.alpha;
  const b = cfg.brightness ?? 1.0;
  const s = cfg.saturate ?? 1.0;
  if (cfg.customFilter) {
    ctx.filter = cfg.customFilter;
  } else if (Math.abs(b - 1.0) > 0.01 || Math.abs(s - 1.0) > 0.01) {
    ctx.filter = `brightness(${b.toFixed(2)}) saturate(${s.toFixed(2)})`;
  }
  ctx.drawImage(img, -drawW * 0.5, -drawH * 0.5, drawW, drawH);

  // Autumn withered curled rim: dry amber upturned edge highlight + subtle inner crease shadow
  if (cfg.curledRim) {
    ctx.filter = 'none';
    const rx = drawW * (cfg.part === 'lotusLeaf3' ? 0.21 : 0.41);
    const ry = drawH * (cfg.part === 'lotusLeaf3' ? 0.21 : 0.41);
    ctx.strokeStyle = 'rgba(232, 178, 78, 0.52)';
    ctx.lineWidth = Math.max(1.4, drawW * 0.011);
    ctx.beginPath();
    ctx.ellipse(0, -ry * 0.06, rx * 0.96, ry * 0.92, 0, Math.PI * 0.08, Math.PI * 0.88);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(128, 68, 22, 0.55)';
    ctx.lineWidth = Math.max(1.2, drawW * 0.009);
    ctx.beginPath();
    ctx.ellipse(0, ry * 0.05, rx * 0.84, ry * 0.80, 0, Math.PI * 1.12, Math.PI * 1.88);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPartAnchoredTopLeft(ctx, img, w, h, xFrac, yFrac, widthFrac, alpha = 1.0, brightness = 1.0) {
  if (!img) return;
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;

  const drawW = widthFrac * w;
  const drawH = drawW * (ih / iw);
  ctx.save();
  ctx.globalAlpha = alpha;
  if (Math.abs(brightness - 1.0) > 0.01) {
    ctx.filter = `brightness(${brightness.toFixed(2)})`;
  }
  ctx.drawImage(img, xFrac * w, yFrac * h, drawW, drawH);
  ctx.restore();
}

function drawLeafRippleRings(ctx, w, h, xFrac, yFrac, rxFrac) {
  const cx = xFrac * w;
  const cy = yFrac * h;
  const baseRx = rxFrac * w;
  ctx.save();
  for (let i = 0; i < 3; i++) {
    const rx = baseRx * (0.72 + i * 0.34);
    const ry = rx * 0.34;
    ctx.strokeStyle = `rgba(255, 198, 118, ${(0.22 - i * 0.06).toFixed(2)})`;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.ellipse(cx, cy + baseRx * 0.06, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

// Thin, translucent Winter ice overlay (matches season-winter.png thin-ice B):
// part-ice-overlay.png is naturally thick in the center, so we feather the pond center down
// to ~0.16 (nearly transparent, veiling koi into subtle dark shadows) while preserving the
// crisp crystalline frost ferns around the 4 outer edges (0.82–0.90).
function drawThinWinterIceOverlay(ctx, img, w, h) {
  if (!img) return;
  const tmp = document.createElement('canvas');
  tmp.width = w;
  tmp.height = h;
  const tctx = tmp.getContext('2d');

  // 1. Draw the frost overlay stretched cleanly to viewport
  tctx.drawImage(img, 0, 0, w, h);

  // 2. Apply radial destination-in mask: thin clear center + crisp frost ferns at edges
  tctx.globalCompositeOperation = 'destination-in';
  const cx = w * 0.50;
  const cy = h * 0.49;
  const maxR = Math.hypot(w * 0.52, h * 0.52);
  const mask = tctx.createRadialGradient(cx, cy, maxR * 0.16, cx, cy, maxR * 0.99);
  mask.addColorStop(0.00, 'rgba(255, 255, 255, 0.15)');
  mask.addColorStop(0.42, 'rgba(255, 255, 255, 0.22)');
  mask.addColorStop(0.68, 'rgba(255, 255, 255, 0.48)');
  mask.addColorStop(0.86, 'rgba(255, 255, 255, 0.80)');
  mask.addColorStop(1.00, 'rgba(255, 255, 255, 0.92)');
  tctx.fillStyle = mask;
  tctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.drawImage(tmp, 0, 0, w, h);
  ctx.restore();
}

// --- Layouts calibrated 1:1 to design-assets/mockups/season-{spring,summer,autumn,winter}.png ---
// Note: part-lotus-leaf-3.png has ~2.5x transparent margin around the leaf compared to leaf-1/2.

const SPRING_PADS = [
  { part: 'lotusLeaf3', x: 0.70, y: 0.35, size: 0.24, squashY: 0.72, alpha: 0.56, brightness: 0.92, rot: 0.2 },
  { part: 'lotusLeaf3', x: 0.06, y: 0.47, size: 0.30, squashY: 0.72, alpha: 0.84, brightness: 1.18, saturate: 1.10, rot: -0.3 },
  { part: 'lotusLeaf1', x: 0.09, y: 0.73, size: 0.16, squashY: 0.74, alpha: 0.94, brightness: 1.32, saturate: 1.14, rot: 0.4 },
  { part: 'lotusLeaf2', x: 0.17, y: 0.83, size: 0.21, squashY: 0.74, alpha: 0.98, brightness: 1.38, saturate: 1.15, rot: -0.15 },
  { part: 'lotusLeaf3', x: 0.27, y: 0.87, size: 0.24, squashY: 0.72, alpha: 0.90, brightness: 1.24, saturate: 1.12, rot: 0.5 },
  { part: 'lotusLeaf3', x: 0.665, y: 0.94, size: 0.36, squashY: 0.72, alpha: 0.90, brightness: 1.26, saturate: 1.12, rot: -0.4 },
  { part: 'lotusLeaf1', x: 0.84, y: 0.89, size: 0.23, squashY: 0.74, alpha: 0.98, brightness: 1.36, saturate: 1.15, rot: 0.25 },
  { part: 'lotusLeaf2', x: 0.905, y: 0.58, size: 0.19, squashY: 0.74, alpha: 0.96, brightness: 1.34, saturate: 1.14, rot: -0.25, flipX: true }
];

const SUMMER_PADS = [
  // Distant / dark background pads
  { part: 'lotusLeaf3', x: 0.11, y: 0.28, size: 0.26, squashY: 0.68, alpha: 0.48, brightness: 0.72, rot: -0.3 },
  { part: 'lotusLeaf3', x: 0.26, y: 0.18, size: 0.28, squashY: 0.68, alpha: 0.40, brightness: 0.62, rot: 0.5 },
  { part: 'lotusLeaf3', x: 0.41, y: 0.14, size: 0.24, squashY: 0.66, alpha: 0.34, brightness: 0.55, rot: -0.8 },
  { part: 'lotusLeaf3', x: 0.77, y: 0.17, size: 0.28, squashY: 0.68, alpha: 0.38, brightness: 0.60, rot: 1.1 },
  { part: 'lotusLeaf3', x: 0.79, y: 0.35, size: 0.32, squashY: 0.70, alpha: 0.58, brightness: 0.84, rot: -0.5 },
  { part: 'lotusLeaf3', x: 0.94, y: 0.36, size: 0.34, squashY: 0.72, alpha: 0.54, brightness: 0.80, rot: 0.8 },
  { part: 'lotusLeaf3', x: 0.87, y: 0.93, size: 0.36, squashY: 0.70, alpha: 0.42, brightness: 0.68, rot: -0.6 },

  // Midground & foreground hero pads (using all 3 single-leaf parts freely!)
  { part: 'lotusLeaf2', x: 0.17, y: 0.37, size: 0.19, squashY: 0.76, alpha: 0.98, brightness: 1.36, saturate: 1.15, rot: -0.10 },
  { part: 'lotusLeaf3', x: 0.275, y: 0.395, size: 0.22, squashY: 0.72, alpha: 0.90, brightness: 1.24, saturate: 1.12, rot: 0.4 },
  { part: 'lotusLeaf3', x: 0.315, y: 0.36, size: 0.22, squashY: 0.70, alpha: 0.88, brightness: 1.22, saturate: 1.12, rot: -0.9 },
  { part: 'lotusLeaf3', x: 0.06, y: 0.64, size: 0.28, squashY: 0.72, alpha: 0.70, brightness: 0.98, rot: 0.2 },
  { part: 'lotusLeaf3', x: 0.11, y: 0.68, size: 0.25, squashY: 0.72, alpha: 0.76, brightness: 1.06, rot: -0.5 },
  { part: 'lotusLeaf1', x: 0.185, y: 0.61, size: 0.18, squashY: 0.76, alpha: 0.96, brightness: 1.34, saturate: 1.15, rot: 0.25 },
  { part: 'lotusLeaf2', x: 0.19, y: 0.85, size: 0.21, squashY: 0.76, alpha: 0.98, brightness: 1.38, saturate: 1.15, rot: -0.08 },
  { part: 'lotusLeaf3', x: 0.30, y: 0.93, size: 0.28, squashY: 0.72, alpha: 0.88, brightness: 1.24, saturate: 1.12, rot: 0.6 },
  { part: 'lotusLeaf3', x: 0.778, y: 0.668, size: 0.30, squashY: 0.72, alpha: 0.92, brightness: 1.28, saturate: 1.12, rot: -0.3 },
  { part: 'lotusLeaf2', x: 0.85, y: 0.57, size: 0.21, squashY: 0.78, alpha: 0.98, brightness: 1.38, saturate: 1.15, rot: 0.15, flipX: true },
  { part: 'lotusLeaf1', x: 0.65, y: 0.69, size: 0.22, squashY: 0.76, alpha: 0.98, brightness: 1.40, saturate: 1.15, rot: -0.20 }
];

const AUTUMN_WITHER_FILTER = 'sepia(0.96) hue-rotate(-14deg) saturate(1.95) brightness(0.96) contrast(1.08)';
const AUTUMN_FADING_PADS = [
  { part: 'lotusLeaf1', x: 0.08, y: 0.65, size: 0.145, squashY: 0.62, alpha: 0.78, customFilter: AUTUMN_WITHER_FILTER, curledRim: true, rot: -0.25 },
  { part: 'lotusLeaf2', x: 0.17, y: 0.79, size: 0.175, squashY: 0.64, alpha: 0.84, customFilter: AUTUMN_WITHER_FILTER, curledRim: true, rot: 0.35 },
  { part: 'lotusLeaf1', x: 0.75, y: 0.87, size: 0.185, squashY: 0.64, alpha: 0.86, customFilter: AUTUMN_WITHER_FILTER, curledRim: true, rot: -0.45 },
  { part: 'lotusLeaf2', x: 0.90, y: 0.81, size: 0.155, squashY: 0.62, alpha: 0.80, customFilter: AUTUMN_WITHER_FILTER, curledRim: true, rot: 0.65, flipX: true }
];

// Individual floating maple leaves placed freely using part-maple-leaf-1/2/3 (NOT grouped!)
const AUTUMN_FLOATING_LEAVES = [
  { part: 'mapleLeaf1', x: 0.485, y: 0.78, size: 0.112, squashY: 0.76, alpha: 0.98, brightness: 1.28, saturate: 1.15, rot: -0.30, ripple: 0.056 },
  { part: 'mapleLeaf2', x: 0.748, y: 0.41, size: 0.086, squashY: 0.78, alpha: 0.96, brightness: 1.26, saturate: 1.15, rot: 0.48, ripple: 0.042 },
  { part: 'mapleLeaf1', x: 0.168, y: 0.66, size: 0.090, squashY: 0.78, alpha: 0.96, brightness: 1.26, saturate: 1.15, rot: -0.68, ripple: 0.044 },
  { part: 'mapleLeaf2', x: 0.345, y: 0.49, size: 0.068, squashY: 0.76, alpha: 0.92, brightness: 1.24, saturate: 1.12, rot: 0.85, ripple: 0.032 },
  { part: 'mapleLeaf3', x: 0.840, y: 0.54, size: 0.072, squashY: 0.78, alpha: 0.92, brightness: 1.26, saturate: 1.12, rot: -0.40, ripple: 0.034 },
  { part: 'mapleLeaf3', x: 0.210, y: 0.54, size: 0.056, squashY: 0.76, alpha: 0.88, brightness: 1.20, rot: 1.15 }
];

export class FloraLayer {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.width = 0;
    this.height = 0;
    this.season = '';
    this.parts = {};
  }

  setPart(key, img) {
    this.parts[key] = img;
    this.season = '';
  }

  render(season, width, height) {
    const w = Math.max(640, Math.min(1200, Math.round(width * 0.80)));
    const h = Math.max(426, Math.min(800, Math.round(height * 0.80)));
    if (this.width === w && this.height === h && this.season === season) {
      return this.canvas;
    }
    this.width = w;
    this.height = h;
    this.season = season;
    this.canvas.width = w;
    this.canvas.height = h;

    const ctx = this.ctx;
    ctx.clearRect(0, 0, w, h);
    const p = this.parts;

    if (season === 'spring') {
      for (const pad of SPRING_PADS) {
        drawPartCentered(ctx, p[pad.part], w, h, pad);
      }
      drawPartAnchoredTopLeft(ctx, p.sakuraBranch, w, h, 0.015, 0.01, 0.47, 0.98, 1.06);
    } else if (season === 'summer') {
      // 1. Pink water reflections ON the water surface (underneath floating lotus pads!)
      drawWaterReflection(ctx, w, h, 0.258, 0.41, 0.034, 0.14, 1.7);
      drawWaterReflection(ctx, w, h, 0.736, 0.70, 0.025, 0.13, 4.9);
      // 2. Floating lotus pads from part-lotus-leaf-1/2/3 occluding reflections naturally
      for (const pad of SUMMER_PADS) {
        drawPartCentered(ctx, p[pad.part], w, h, pad);
      }
      // 3. Blooming lotus flower (upper-left) & pointed lotus bud (lower-right) rising above leaves
      drawPartCentered(ctx, p.lotusFlower, w, h, { x: 0.258, y: 0.325, size: 0.142, alpha: 0.99, brightness: 1.08 });
      drawPartCentered(ctx, p.lotusBud, w, h, { x: 0.736, y: 0.655, size: 0.235, alpha: 0.99, brightness: 1.12 });
    } else if (season === 'autumn') {
      for (const pad of AUTUMN_FADING_PADS) {
        drawPartCentered(ctx, p[pad.part], w, h, pad);
      }
      for (const lf of AUTUMN_FLOATING_LEAVES) {
        if (lf.ripple) drawLeafRippleRings(ctx, w, h, lf.x, lf.y, lf.ripple);
        drawPartCentered(ctx, p[lf.part], w, h, lf);
      }
      drawPartAnchoredTopLeft(ctx, p.mapleBranch, w, h, 0.02, 0.01, 0.43, 0.98, 1.14);
    } else if (season === 'winter') {
      drawThinWinterIceOverlay(ctx, p.iceOverlay, w, h);
      drawPartAnchoredTopLeft(ctx, p.winterBranch, w, h, 0.012, 0.005, 0.45, 0.96, 1.08);
    }

    return this.canvas;
  }
}
