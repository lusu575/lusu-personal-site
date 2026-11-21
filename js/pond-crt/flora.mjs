// Procedural botanical & shoreline scene layer for all 4 seasons
// - Removed fake-looking Spring cartoon sprouts (replaced with natural young lotus pads)
// - Redesigned Winter ice/snow banks into soft, layered, frosted crystalline ice shelves
// - Supports optional transparent PNG overrides in assets/pond-flora/<season>-<part>.png

function drawLotusPad(ctx, w, h, pad, colorTheme = 'summer') {
  const cx = pad.x * w;
  const cy = pad.y * h;
  const rx = pad.r * w;
  const ry = rx * (pad.squash ?? 0.58);
  const depth = pad.depth ?? 1.0;
  const notchAngle = pad.notch ?? -0.45;
  const notchWidth = 0.11;

  ctx.save();
  ctx.translate(cx, cy);

  ctx.save();
  ctx.translate(0, ry * 0.14);
  const shGrad = ctx.createRadialGradient(0, 0, rx * 0.2, 0, 0, rx * 1.15);
  shGrad.addColorStop(0, `rgba(1, 10, 10, ${0.50 * depth})`);
  shGrad.addColorStop(1, 'rgba(1, 10, 10, 0)');
  ctx.fillStyle = shGrad;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx * 1.12, ry * 1.12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const steps = 64;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const ang = notchAngle + notchWidth * 0.5 + t * (Math.PI * 2 - notchWidth);
    const wave = 1.0 + 0.030 * Math.sin(ang * 11 + pad.seed * 3.1) + 0.016 * Math.cos(ang * 7 - pad.seed);
    ctx.lineTo(Math.cos(ang) * rx * wave, Math.sin(ang) * ry * wave);
  }
  ctx.closePath();

  const grad = ctx.createRadialGradient(-rx * 0.08, -ry * 0.08, rx * 0.03, 0, 0, rx * 1.02);
  if (colorTheme === 'autumn') {
    grad.addColorStop(0.0, `rgba(${Math.round(115 * depth)}, ${Math.round(112 * depth)}, ${Math.round(52 * depth)}, ${0.76 * depth})`);
    grad.addColorStop(0.6, `rgba(${Math.round(74 * depth)}, ${Math.round(76 * depth)}, ${Math.round(34 * depth)}, ${0.70 * depth})`);
    grad.addColorStop(1.0, `rgba(${Math.round(44 * depth)}, ${Math.round(42 * depth)}, ${Math.round(20 * depth)}, ${0.62 * depth})`);
  } else {
    const r0 = Math.round((colorTheme === 'spring' ? 112 : 128) * depth);
    const g0 = Math.round((colorTheme === 'spring' ? 198 : 218) * depth);
    const b0 = Math.round((colorTheme === 'spring' ? 88 : 82) * depth);
    const r1 = Math.round(62 * depth);
    const g1 = Math.round(172 * depth);
    const b1 = Math.round(64 * depth);
    const r2 = Math.round(24 * depth);
    const g2 = Math.round(108 * depth);
    const b2 = Math.round(56 * depth);
    grad.addColorStop(0.0, `rgba(${r0}, ${g0}, ${b0}, ${0.95 * Math.min(1, depth + 0.15)})`);
    grad.addColorStop(0.55, `rgba(${r1}, ${g1}, ${b1}, ${0.92 * Math.min(1, depth + 0.15)})`);
    grad.addColorStop(1.0, `rgba(${r2}, ${g2}, ${b2}, ${0.86 * Math.min(1, depth + 0.15)})`);
  }
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.save();
  ctx.clip();

  const veinCount = pad.veins ?? 15;
  ctx.lineCap = 'round';
  const veinCol = colorTheme === 'autumn'
    ? [Math.round(150 * depth), Math.round(132 * depth), Math.round(64 * depth)]
    : [Math.round(192 * depth), Math.round(246 * depth), Math.round(126 * depth)];

  for (let v = 0; v < veinCount; v++) {
    const a = notchAngle + notchWidth * 0.65 + (v / (veinCount - 1)) * (Math.PI * 2 - notchWidth * 1.3);
    const vx = Math.cos(a) * rx * 0.96;
    const vy = Math.sin(a) * ry * 0.96;
    const cpx = Math.cos(a + 0.07) * rx * 0.48;
    const cpy = Math.sin(a + 0.07) * ry * 0.48;

    ctx.strokeStyle = `rgba(${veinCol[0]}, ${veinCol[1]}, ${veinCol[2]}, ${0.50 * depth})`;
    ctx.lineWidth = Math.max(1.2, rx * 0.024);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(cpx, cpy, vx, vy);
    ctx.stroke();

    if (colorTheme !== 'autumn') {
      const fx = Math.cos(a + 0.14) * rx * 0.94;
      const fy = Math.sin(a + 0.14) * ry * 0.94;
      ctx.lineWidth = Math.max(0.85, rx * 0.013);
      ctx.strokeStyle = `rgba(${veinCol[0]}, ${veinCol[1]}, ${veinCol[2]}, ${0.28 * depth})`;
      ctx.beginPath();
      ctx.moveTo(vx * 0.64, vy * 0.64);
      ctx.lineTo(fx, fy);
      ctx.stroke();
    }
  }

  if (colorTheme !== 'autumn') {
    const hub = ctx.createRadialGradient(0, 0, 0, 0, 0, rx * 0.13);
    hub.addColorStop(0, `rgba(${Math.round(220 * depth)}, ${Math.round(252 * depth)}, ${Math.round(148 * depth)}, ${0.55 * depth})`);
    hub.addColorStop(1, 'rgba(160, 230, 100, 0)');
    ctx.fillStyle = hub;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx * 0.14, ry * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = `rgba(${veinCol[0]}, ${veinCol[1]}, ${veinCol[2]}, ${0.52 * depth})`;
  ctx.lineWidth = Math.max(1.5, rx * 0.030);
  ctx.stroke();

  ctx.restore();
  ctx.restore();
}

function drawLotusBud(ctx, w, h, bud) {
  const bx = bud.x * w;
  const by = bud.y * h;
  const size = bud.size * w;
  const stemBaseY = (bud.y + bud.stemLen) * h;

  ctx.save();

  const reflTop = stemBaseY + size * 0.15;
  const reflH = size * 3.6;
  for (let i = 0; i < 14; i++) {
    const t = i / 13;
    const ry = reflTop + t * reflH;
    const rw = size * (1.15 - t * 0.42) * (0.72 + 0.36 * Math.sin(i * 2.3 + bud.seed));
    const rh = Math.max(2.2, size * 0.15);
    const alpha = (1.0 - t * 0.72) * 0.62;
    const rGrad = ctx.createRadialGradient(bx, ry, 0, bx, ry, rw);
    rGrad.addColorStop(0, `rgba(255, 118, 168, ${alpha})`);
    rGrad.addColorStop(0.6, `rgba(230, 82, 138, ${alpha * 0.48})`);
    rGrad.addColorStop(1, 'rgba(195, 65, 115, 0)');
    ctx.fillStyle = rGrad;
    ctx.beginPath();
    ctx.ellipse(bx + Math.sin(i * 1.9 + bud.seed) * size * 0.16, ry, rw, rh, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = 'rgba(72, 162, 78, 0.85)';
  ctx.lineWidth = Math.max(2.0, size * 0.11);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(bx + size * 0.06, stemBaseY);
  ctx.quadraticCurveTo(bx - size * 0.08, (by + stemBaseY) * 0.52, bx, by + size * 0.55);
  ctx.stroke();

  const aura = ctx.createRadialGradient(bx, by, size * 0.1, bx, by, size * 1.55);
  aura.addColorStop(0, 'rgba(255, 128, 178, 0.32)');
  aura.addColorStop(1, 'rgba(255, 100, 155, 0)');
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(bx, by, size * 1.55, 0, Math.PI * 2);
  ctx.fill();

  const drawPetal = (offsetX, scaleX, scaleY, rot, topCol, midCol, botCol) => {
    ctx.save();
    ctx.translate(bx + offsetX, by + size * 0.15);
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.moveTo(0, -size * 1.05 * scaleY);
    ctx.bezierCurveTo(
      size * 0.72 * scaleX, -size * 0.25 * scaleY,
      size * 0.62 * scaleX, size * 0.52 * scaleY,
      0, size * 0.62 * scaleY
    );
    ctx.bezierCurveTo(
      -size * 0.62 * scaleX, size * 0.52 * scaleY,
      -size * 0.72 * scaleX, -size * 0.25 * scaleY,
      0, -size * 1.05 * scaleY
    );
    ctx.closePath();
    const pg = ctx.createLinearGradient(0, -size * 1.05 * scaleY, 0, size * 0.62 * scaleY);
    pg.addColorStop(0, topCol);
    pg.addColorStop(0.58, midCol);
    pg.addColorStop(1, botCol);
    ctx.fillStyle = pg;
    ctx.fill();
    ctx.restore();
  };

  drawPetal(-size * 0.14, 0.76, 0.90, -0.18, '#dc4888', '#f298be', '#6ea85a');
  drawPetal(size * 0.14, 0.76, 0.90, 0.18, '#dc4888', '#f298be', '#6ea85a');
  drawPetal(0, 0.88, 1.0, 0.0, '#f55c9c', '#ffb6d2', '#8ec272');

  const tip = ctx.createRadialGradient(bx, by - size * 0.48, 0, bx, by - size * 0.4, size * 0.42);
  tip.addColorStop(0, 'rgba(255, 200, 224, 0.55)');
  tip.addColorStop(1, 'rgba(255, 130, 180, 0)');
  ctx.fillStyle = tip;
  ctx.beginPath();
  ctx.arc(bx, by - size * 0.4, size * 0.42, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawSakuraFlower(ctx, x, y, r, rot, alpha = 1.0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.globalAlpha = alpha;
  for (let p = 0; p < 5; p++) {
    ctx.save();
    ctx.rotate((p * Math.PI * 2) / 5);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-r * 0.42, -r * 0.35, -r * 0.45, -r * 0.95, -r * 0.10, -r * 1.0);
    ctx.lineTo(0, -r * 0.84);
    ctx.lineTo(r * 0.10, -r * 1.0);
    ctx.bezierCurveTo(r * 0.45, -r * 0.95, r * 0.42, -r * 0.35, 0, 0);
    ctx.closePath();
    const pg = ctx.createRadialGradient(0, -r * 0.25, 0, 0, -r * 0.55, r);
    pg.addColorStop(0, '#ff78ab');
    pg.addColorStop(0.55, '#ffb4d2');
    pg.addColorStop(1, '#ffe4ef');
    ctx.fillStyle = pg;
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = '#ff6298';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBranchTree(ctx, w, h, branches, strokeStyle, widthScale = 1.0) {
  ctx.save();
  ctx.strokeStyle = strokeStyle;
  ctx.lineCap = 'round';
  for (const b of branches) {
    ctx.lineWidth = Math.max(1.4, b.w * w * widthScale);
    ctx.beginPath();
    ctx.moveTo(b.p0[0] * w, b.p0[1] * h);
    ctx.quadraticCurveTo(b.cp[0] * w, b.cp[1] * h, b.p1[0] * w, b.p1[1] * h);
    ctx.stroke();
  }
  ctx.restore();
}

function drawMapleLeaf(ctx, x, y, r, rot, colorA = '#e84814', colorB = '#ff9828', alpha = 0.94) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.globalAlpha = alpha;

  ctx.strokeStyle = colorA;
  ctx.lineWidth = Math.max(1.2, r * 0.08);
  ctx.beginPath();
  ctx.moveTo(0, r * 0.15);
  ctx.lineTo(0, r * 0.95);
  ctx.stroke();

  const lobes = [
    { a: -Math.PI / 2, len: 1.05, w: 0.28 },
    { a: -Math.PI / 2 - 0.64, len: 0.92, w: 0.26 },
    { a: -Math.PI / 2 + 0.64, len: 0.92, w: 0.26 },
    { a: -Math.PI / 2 - 1.32, len: 0.72, w: 0.22 },
    { a: -Math.PI / 2 + 1.32, len: 0.72, w: 0.22 },
    { a: -Math.PI / 2 - 1.92, len: 0.44, w: 0.17 },
    { a: -Math.PI / 2 + 1.92, len: 0.44, w: 0.17 }
  ];

  const lg = ctx.createRadialGradient(0, 0, r * 0.08, 0, 0, r * 1.05);
  lg.addColorStop(0, colorB);
  lg.addColorStop(0.55, colorA);
  lg.addColorStop(1, '#982208');
  ctx.fillStyle = lg;

  for (const lb of lobes) {
    ctx.save();
    ctx.rotate(lb.a + Math.PI / 2);
    const L = r * lb.len;
    const W = r * lb.w;
    ctx.beginPath();
    ctx.moveTo(0, r * 0.12);
    ctx.lineTo(-W, -L * 0.42);
    ctx.lineTo(-W * 0.58, -L * 0.56);
    ctx.lineTo(-W * 0.78, -L * 0.72);
    ctx.lineTo(0, -L);
    ctx.lineTo(W * 0.78, -L * 0.72);
    ctx.lineTo(W * 0.58, -L * 0.56);
    ctx.lineTo(W, -L * 0.42);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  ctx.strokeStyle = 'rgba(255, 224, 130, 0.42)';
  ctx.lineWidth = Math.max(0.9, r * 0.045);
  for (let i = 0; i < 5; i++) {
    const lb = lobes[i];
    ctx.beginPath();
    ctx.moveTo(0, r * 0.05);
    ctx.lineTo(Math.cos(lb.a) * r * lb.len * 0.76, Math.sin(lb.a) * r * lb.len * 0.76);
    ctx.stroke();
  }
  ctx.restore();
}

// --- Completely New Winter Pond Approach: Soft Atmospheric Edge-Frost Mist (NO hard polygon outlines, NO crack lines, NO straight-line grass!) ---
// Leaves a wide, serene, translucent frozen pond with soft feathered frost mist hugging only the outer banks,
// plus delicate frost-dusted winter twigs top-left (matching the praised Spring branch quality).

function drawWinterIceShelves(ctx, w, h) {
  ctx.save();

  // Soft, atmospheric, borderless edge-frost mist banks (layered low-alpha gradients, zero hard strokes, zero cracks!)
  const drawFrostMist = (cx, cy, rx, ry, rot, peakAlpha) => {
    ctx.save();
    ctx.translate(cx * w, cy * h);
    ctx.rotate(rot);
    const g = ctx.createRadialGradient(0, 0, rx * w * 0.05, 0, 0, rx * w);
    g.addColorStop(0.0, `rgba(148, 174, 202, ${peakAlpha})`);
    g.addColorStop(0.45, `rgba(98, 124, 152, ${peakAlpha * 0.52})`);
    g.addColorStop(0.80, `rgba(54, 78, 104, ${peakAlpha * 0.16})`);
    g.addColorStop(1.0, 'rgba(24, 42, 64, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx * w, ry * h, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  // Gentle frosted corner & bottom-edge mist (compact, thin, translucent -> water & koi shadow stay visible!)
  drawFrostMist(0.03, 0.42, 0.15, 0.06, 0.06, 0.28);
  drawFrostMist(0.97, 0.33, 0.13, 0.05, -0.05, 0.24);
  drawFrostMist(0.96, 0.67, 0.14, 0.06, 0.06, 0.28);
  drawFrostMist(0.08, 0.93, 0.22, 0.11, 0.10, 0.38);
  drawFrostMist(0.88, 0.94, 0.24, 0.11, -0.10, 0.40);
  drawFrostMist(0.50, 1.00, 0.34, 0.07, 0.0, 0.22);

  // Subtle fine crystalline frost-dust speckles along the outer icy corners (replaces ugly straight reeds & crack lines!)
  for (let i = 0; i < 110; i++) {
    const corner = i % 4;
    const r1 = ((i * 197.3 + 19.1) % 1000) / 1000;
    const r2 = ((i * 313.7 + 47.3) % 1000) / 1000;
    let gx, gy;
    if (corner === 0) { gx = r1 * 0.18; gy = 0.80 + r2 * 0.20; }
    else if (corner === 1) { gx = 0.76 + r1 * 0.24; gy = 0.80 + r2 * 0.20; }
    else if (corner === 2) { gx = r1 * 0.12; gy = 0.36 + r2 * 0.14; }
    else { gx = 0.88 + r1 * 0.12; gy = 0.60 + r2 * 0.14; }
    const rad = 0.7 + ((i * 13) % 5) * 0.32;
    ctx.fillStyle = `rgba(210, 232, 250, ${0.14 + ((i * 29) % 10) * 0.028})`;
    ctx.beginPath();
    ctx.arc(gx * w, gy * h, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawWinterTwigs(ctx, w, h) {
  ctx.save();
  ctx.strokeStyle = 'rgba(188, 214, 238, 0.56)';
  ctx.lineCap = 'round';
  const drawBranch = (x, y, len, angle, depth, lw) => {
    if (depth <= 0 || len < 7) return;
    const ex = x + Math.cos(angle) * len;
    const ey = y + Math.sin(angle) * len;
    const mx = (x + ex) * 0.5 + Math.sin(angle * 3.1 + depth) * len * 0.09;
    const my = (y + ey) * 0.5 - Math.cos(angle * 2.7 + depth) * len * 0.08;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(mx, my, ex, ey);
    ctx.stroke();
    if (depth <= 2) {
      ctx.fillStyle = 'rgba(225, 242, 255, 0.58)';
      ctx.beginPath();
      ctx.arc(ex, ey, Math.max(1.0, lw * 0.85), 0, Math.PI * 2);
      ctx.fill();
    }
    drawBranch(ex, ey, len * 0.67, angle - 0.34, depth - 1, lw * 0.72);
    drawBranch(ex, ey, len * 0.62, angle + 0.42, depth - 1, lw * 0.68);
  };
  drawBranch(0, h * 0.06, w * 0.13, 0.25, 4, Math.max(2.0, w * 0.0024));
  drawBranch(w * 0.05, 0, w * 0.10, 0.50, 3, Math.max(1.8, w * 0.0020));
  drawBranch(0, h * 0.14, w * 0.08, 0.76, 3, Math.max(1.5, w * 0.0018));
  ctx.restore();
}

// --- Layouts per season ---

const SUMMER_PADS = [
  { x: 0.10, y: 0.28, r: 0.044, squash: 0.50, depth: 0.38, notch: -0.5, seed: 1.1, veins: 11 },
  { x: 0.16, y: 0.19, r: 0.036, squash: 0.48, depth: 0.34, notch: 0.8, seed: 2.3, veins: 10 },
  { x: 0.26, y: 0.18, r: 0.040, squash: 0.48, depth: 0.36, notch: -1.1, seed: 3.4, veins: 10 },
  { x: 0.41, y: 0.14, r: 0.032, squash: 0.46, depth: 0.30, notch: 0.3, seed: 4.5, veins: 9 },
  { x: 0.77, y: 0.17, r: 0.042, squash: 0.48, depth: 0.34, notch: 2.1, seed: 5.6, veins: 10 },
  { x: 0.78, y: 0.36, r: 0.046, squash: 0.52, depth: 0.48, notch: -2.2, seed: 6.7, veins: 12 },
  { x: 0.94, y: 0.36, r: 0.056, squash: 0.54, depth: 0.42, notch: 2.8, seed: 7.8, veins: 12 },
  { x: 0.06, y: 0.65, r: 0.048, squash: 0.54, depth: 0.55, notch: -0.2, seed: 8.9, veins: 12 },
  { x: 0.11, y: 0.68, r: 0.038, squash: 0.54, depth: 0.62, notch: 1.2, seed: 9.1, veins: 11 },
  { x: 0.88, y: 0.95, r: 0.055, squash: 0.56, depth: 0.44, notch: -1.5, seed: 10.2, veins: 12 },
  { x: 0.17, y: 0.38, r: 0.074, squash: 0.56, depth: 0.86, notch: -0.35, seed: 11.4, veins: 15 },
  { x: 0.27, y: 0.41, r: 0.036, squash: 0.52, depth: 0.78, notch: 0.55, seed: 12.5, veins: 11 },
  { x: 0.32, y: 0.37, r: 0.034, squash: 0.50, depth: 0.74, notch: -1.6, seed: 13.6, veins: 11 },
  { x: 0.19, y: 0.61, r: 0.068, squash: 0.58, depth: 0.86, notch: -0.75, seed: 14.7, veins: 15 },
  { x: 0.77, y: 0.66, r: 0.042, squash: 0.54, depth: 0.80, notch: 1.1, seed: 15.8, veins: 12 },
  { x: 0.84, y: 0.58, r: 0.080, squash: 0.62, depth: 0.94, notch: 2.35, seed: 16.9, veins: 17 },
  { x: 0.65, y: 0.69, r: 0.084, squash: 0.60, depth: 1.00, notch: -0.55, seed: 17.2, veins: 18 },
  { x: 0.19, y: 0.86, r: 0.088, squash: 0.60, depth: 0.92, notch: -0.40, seed: 18.4, veins: 17 },
  { x: 0.30, y: 0.94, r: 0.038, squash: 0.56, depth: 0.78, notch: 0.85, seed: 19.6, veins: 12 }
];

const SUMMER_BUDS = [
  { x: 0.26, y: 0.325, size: 0.022, stemLen: 0.085, seed: 2.1 },
  { x: 0.728, y: 0.60, size: 0.023, stemLen: 0.088, seed: 5.4 }
];

// Clean young spring lily pads (removed fake cartoon sprouts!)
const SPRING_PADS = [
  { x: 0.06, y: 0.47, r: 0.052, squash: 0.50, depth: 0.62, notch: -0.4, seed: 1.4, veins: 12 },
  { x: 0.08, y: 0.74, r: 0.064, squash: 0.54, depth: 0.76, notch: 0.5, seed: 2.8, veins: 14 },
  { x: 0.17, y: 0.83, r: 0.082, squash: 0.52, depth: 0.82, notch: -0.6, seed: 3.9, veins: 15 },
  { x: 0.27, y: 0.88, r: 0.034, squash: 0.50, depth: 0.68, notch: 1.4, seed: 9.2, veins: 10 },
  { x: 0.67, y: 0.95, r: 0.058, squash: 0.50, depth: 0.72, notch: 1.2, seed: 4.2, veins: 12 },
  { x: 0.85, y: 0.91, r: 0.090, squash: 0.52, depth: 0.76, notch: -1.1, seed: 5.5, veins: 15 },
  { x: 0.90, y: 0.58, r: 0.068, squash: 0.52, depth: 0.76, notch: 2.2, seed: 6.1, veins: 14 },
  { x: 0.69, y: 0.36, r: 0.040, squash: 0.48, depth: 0.48, notch: -2.0, seed: 7.3, veins: 10 },
  { x: 0.87, y: 0.27, r: 0.044, squash: 0.46, depth: 0.40, notch: 0.9, seed: 8.4, veins: 10 }
];

const OVERHANG_BRANCHES = [
  { p0: [0.0, 0.06], cp: [0.16, 0.10], p1: [0.46, 0.24], w: 0.0042 },
  { p0: [0.08, 0.0], cp: [0.20, 0.08], p1: [0.38, 0.17], w: 0.0032 },
  { p0: [0.04, 0.08], cp: [0.10, 0.18], p1: [0.11, 0.29], w: 0.0026 },
  { p0: [0.18, 0.12], cp: [0.24, 0.19], p1: [0.33, 0.27], w: 0.0022 },
  { p0: [0.16, 0.04], cp: [0.28, 0.04], p1: [0.41, 0.09], w: 0.0020 }
];

const SAKURA_CLUSTERS = [
  [0.06, 0.08, 0.018], [0.10, 0.05, 0.020], [0.14, 0.09, 0.022], [0.18, 0.06, 0.019],
  [0.21, 0.12, 0.021], [0.25, 0.09, 0.020], [0.29, 0.14, 0.022], [0.33, 0.12, 0.018],
  [0.36, 0.17, 0.020], [0.40, 0.16, 0.016], [0.44, 0.21, 0.017], [0.47, 0.24, 0.015],
  [0.08, 0.15, 0.017], [0.13, 0.17, 0.018], [0.09, 0.24, 0.015], [0.11, 0.28, 0.014],
  [0.24, 0.19, 0.018], [0.29, 0.22, 0.017], [0.33, 0.25, 0.015], [0.31, 0.07, 0.016],
  [0.37, 0.09, 0.014], [0.16, 0.13, 0.019], [0.27, 0.16, 0.018]
];

const AUTUMN_PADS = [
  { x: 0.06, y: 0.63, r: 0.048, squash: 0.50, depth: 0.55, notch: -0.4, seed: 1.2, veins: 10 },
  { x: 0.15, y: 0.76, r: 0.056, squash: 0.52, depth: 0.64, notch: 0.7, seed: 2.4, veins: 11 },
  { x: 0.76, y: 0.87, r: 0.064, squash: 0.54, depth: 0.68, notch: -1.2, seed: 3.6, veins: 12 },
  { x: 0.91, y: 0.81, r: 0.062, squash: 0.52, depth: 0.66, notch: 2.1, seed: 4.8, veins: 12 },
  { x: 0.75, y: 0.27, r: 0.044, squash: 0.48, depth: 0.45, notch: -2.0, seed: 5.1, veins: 9 }
];

const AUTUMN_CANOPY_LEAVES = [
  [0.05, 0.07, 0.036, 0.5], [0.11, 0.04, 0.038, -0.3], [0.17, 0.09, 0.040, 0.8],
  [0.22, 0.05, 0.035, -0.6], [0.28, 0.11, 0.038, 0.4], [0.34, 0.08, 0.034, -0.8],
  [0.37, 0.17, 0.032, 0.9], [0.06, 0.17, 0.036, 1.1], [0.12, 0.19, 0.038, -0.5],
  [0.08, 0.26, 0.032, 0.3], [0.19, 0.16, 0.034, 0.6], [0.29, 0.18, 0.034, -0.4],
  [0.33, 0.22, 0.028, 0.7]
];

const AUTUMN_HERO_LEAVES = [
  [0.49, 0.79, 0.042, -0.35, '#e84412', '#ffa62e'],
  [0.73, 0.43, 0.034, 0.45, '#df3f10', '#ff9224'],
  [0.18, 0.67, 0.030, -0.75, '#d43a12', '#f28220']
];

export class FloraLayer {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.width = 0;
    this.height = 0;
    this.season = '';
    this.customAssets = {}; // Optional transparent PNG images keyed by season
  }

  setCustomAsset(season, img) {
    this.customAssets[season] = img;
    this.season = '';
  }

  render(season, width, height) {
    const w = Math.max(480, Math.min(1024, Math.round(width * 0.75)));
    const h = Math.max(320, Math.min(684, Math.round(height * 0.75)));
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

    // Optional transparent PNG overlay hook if user provides custom GPT-generated transparent PNGs
    if (this.customAssets[season]) {
      ctx.drawImage(this.customAssets[season], 0, 0, w, h);
      return this.canvas;
    }

    if (season === 'summer') {
      for (const pad of SUMMER_PADS) drawLotusPad(ctx, w, h, pad, 'summer');
      for (const bud of SUMMER_BUDS) drawLotusBud(ctx, w, h, bud);
    } else if (season === 'spring') {
      for (const pad of SPRING_PADS) drawLotusPad(ctx, w, h, pad, 'spring');
      drawBranchTree(ctx, w, h, OVERHANG_BRANCHES, 'rgba(130, 82, 88, 0.72)');
      for (let i = 0; i < SAKURA_CLUSTERS.length; i++) {
        const [fx, fy, fr] = SAKURA_CLUSTERS[i];
        drawSakuraFlower(ctx, fx * w, fy * h, fr * w, i * 0.9, 0.94);
      }
    } else if (season === 'autumn') {
      for (const pad of AUTUMN_PADS) drawLotusPad(ctx, w, h, pad, 'autumn');
      for (const lf of AUTUMN_HERO_LEAVES) {
        drawMapleLeaf(ctx, lf[0] * w, lf[1] * h, lf[2] * w, lf[3], lf[4], lf[5], 0.92);
      }
      drawBranchTree(ctx, w, h, OVERHANG_BRANCHES, 'rgba(105, 56, 28, 0.75)');
      for (const lf of AUTUMN_CANOPY_LEAVES) {
        drawMapleLeaf(ctx, lf[0] * w, lf[1] * h, lf[2] * w, lf[3], '#d84214', '#ff9428', 0.92);
      }
    } else if (season === 'winter') {
      drawWinterIceShelves(ctx, w, h);
      drawWinterTwigs(ctx, w, h);
    }

    return this.canvas;
  }
}
