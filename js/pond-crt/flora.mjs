// Procedural botanical scene layer for all 4 seasons:
// - Spring (final2-spring.png): overhanging sakura branches, drifting pink petals, young sprouts & small pads
// - Summer (final2-summer.png): lush radial-veined lotus pads, 2 rose-pink lotus buds with shimmering water reflections
// - Autumn (final2-autumn.png): overhanging red/amber maple branches, floating palmate maple leaves, fading olive pads
// - Winter (final2-winter.png): bare frosty twigs, icy snowbanks along edges, frosted reeds, soft snowfield

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

  // Subtle dark shadow beneath pad on water
  ctx.save();
  ctx.translate(0, ry * 0.14);
  const shGrad = ctx.createRadialGradient(0, 0, rx * 0.2, 0, 0, rx * 1.15);
  shGrad.addColorStop(0, `rgba(1, 10, 10, ${0.52 * depth})`);
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
    // Muted dark olive-bronze fading lily pads for Autumn
    grad.addColorStop(0.0, `rgba(${Math.round(115 * depth)}, ${Math.round(112 * depth)}, ${Math.round(52 * depth)}, ${0.78 * depth})`);
    grad.addColorStop(0.6, `rgba(${Math.round(74 * depth)}, ${Math.round(76 * depth)}, ${Math.round(34 * depth)}, ${0.72 * depth})`);
    grad.addColorStop(1.0, `rgba(${Math.round(44 * depth)}, ${Math.round(42 * depth)}, ${Math.round(20 * depth)}, ${0.65 * depth})`);
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

  // Radial lotus leaf veins
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

  // 1. Shimmering pink reflection in the water beneath the bud
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

  // 2. Slender curved stem
  ctx.strokeStyle = 'rgba(72, 162, 78, 0.85)';
  ctx.lineWidth = Math.max(2.0, size * 0.11);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(bx + size * 0.06, stemBaseY);
  ctx.quadraticCurveTo(bx - size * 0.08, (by + stemBaseY) * 0.52, bx, by + size * 0.55);
  ctx.stroke();

  // 3. Soft aura
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

// --- Spring Helpers: Overhanging Sakura Branches, Blossoms, Sprouts & Floating Petals ---

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
    ctx.lineTo(0, -r * 0.84); // classic sakura petal notch
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

function drawSprout(ctx, w, h, sp) {
  const x = sp.x * w;
  const y = sp.y * h;
  const s = sp.s * w;
  ctx.save();
  ctx.strokeStyle = 'rgba(135, 224, 96, 0.88)';
  ctx.lineWidth = Math.max(1.8, s * 0.08);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y + s * 1.25);
  ctx.quadraticCurveTo(x - s * 0.08, y + s * 0.6, x, y);
  ctx.stroke();

  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(x, y + s * 0.12);
    ctx.rotate(side * 0.68);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(side * s * 0.25, -s * 0.55, side * s * 0.52, -s * 0.88, side * s * 0.10, -s * 1.02);
    ctx.bezierCurveTo(-side * s * 0.22, -s * 0.68, -side * s * 0.12, -s * 0.28, 0, 0);
    ctx.closePath();
    const lg = ctx.createLinearGradient(0, 0, 0, -s);
    lg.addColorStop(0, '#72c858');
    lg.addColorStop(1, '#daf89c');
    ctx.fillStyle = lg;
    ctx.fill();
    ctx.restore();
  }
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

// --- Autumn Helpers: Palmate 5-7 Lobed Maple Leaf ---

function drawMapleLeaf(ctx, x, y, r, rot, colorA = '#e84814', colorB = '#ff9828', alpha = 0.94) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.globalAlpha = alpha;

  // Stem
  ctx.strokeStyle = colorA;
  ctx.lineWidth = Math.max(1.2, r * 0.08);
  ctx.beginPath();
  ctx.moveTo(0, r * 0.15);
  ctx.lineTo(0, r * 0.95);
  ctx.stroke();

  // 7 palmate pointed maple lobes
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

  // Luminous golden vein highlight
  ctx.strokeStyle = 'rgba(255, 224, 130, 0.45)';
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

// --- Winter Helpers: Snowbanks, Frost Edges, Reeds & Falling Snow ---

function drawWinterBanks(ctx, w, h) {
  ctx.save();

  // Organic jittered snow/ice shoreline drift painter (no flat geometric polygons!)
  const drawOrganicDrift = (pts, seed, baseAlpha = 0.72) => {
    // Subdivide & add organic coastal crinkles along the water-facing edge
    const detailed = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const isEdgeBorder = (a[0] <= 0.001 && b[0] <= 0.001) || (a[0] >= 0.999 && b[0] >= 0.999) || (a[1] >= 0.999 && b[1] >= 0.999);
      const steps = isEdgeBorder ? 1 : 6;
      for (let s = 0; s < steps; s++) {
        const u = s / steps;
        let px = a[0] + (b[0] - a[0]) * u;
        let py = a[1] + (b[1] - a[1]) * u;
        if (!isEdgeBorder && s > 0) {
          const jitter = Math.sin((i * 7 + s) * 2.1 + seed) * 0.011 + Math.cos((i * 11 - s) * 1.7 + seed) * 0.007;
          py += jitter;
          px += jitter * 0.6;
        }
        detailed.push([px * w, py * h]);
      }
    }

    ctx.beginPath();
    ctx.moveTo(detailed[0][0], detailed[0][1]);
    for (let i = 1; i < detailed.length; i++) {
      ctx.lineTo(detailed[i][0], detailed[i][1]);
    }
    ctx.closePath();

    // Soft dark-slate to pale-frost interior gradient (matches final2-winter.png muted snowy drifts)
    const grad = ctx.createLinearGradient(0, h * 0.35, 0, h);
    grad.addColorStop(0.0, `rgba(68, 86, 108, ${baseAlpha * 0.52})`);
    grad.addColorStop(0.55, `rgba(98, 120, 144, ${baseAlpha * 0.68})`);
    grad.addColorStop(1.0, `rgba(136, 158, 182, ${baseAlpha * 0.80})`);
    ctx.fillStyle = grad;
    ctx.fill();

    // Delicate frosty crystalline rim (stroke shoreline BEFORE clipping resets path!)
    ctx.strokeStyle = 'rgba(210, 232, 250, 0.56)';
    ctx.lineWidth = Math.max(1.4, w * 0.0018);
    ctx.stroke();

    // Clip inside drift to add soft mottled snow texture so it never looks like a flat fill
    ctx.save();
    ctx.clip();
    for (let k = 0; k < 28; k++) {
      const mx = (((k * 173 + seed * 41) % 1000) / 1000) * w;
      const my = (((k * 291 + seed * 67) % 1000) / 1000) * h;
      const mr = (0.04 + ((k * 19) % 10) * 0.008) * w;
      const mg = ctx.createRadialGradient(mx, my, 0, mx, my, mr);
      const bright = k % 2 === 0;
      mg.addColorStop(0, bright ? 'rgba(206, 224, 242, 0.24)' : 'rgba(24, 38, 56, 0.32)');
      mg.addColorStop(1, 'rgba(60, 80, 100, 0)');
      ctx.fillStyle = mg;
      ctx.beginPath();
      ctx.ellipse(mx, my, mr * 1.4, mr * 0.65, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  // Left-upper organic snow shelf
  drawOrganicDrift([
    [0.0, 0.36], [0.09, 0.38], [0.18, 0.40], [0.24, 0.41],
    [0.16, 0.43], [0.08, 0.45], [0.0, 0.47]
  ], 1.7, 0.62);

  // Left-lower bank shelf
  drawOrganicDrift([
    [0.0, 0.60], [0.07, 0.63], [0.05, 0.69], [0.0, 0.72]
  ], 3.1, 0.68);

  // Right icy bank shelves (tucked gracefully behind 工具 & 关于)
  drawOrganicDrift([
    [1.0, 0.27], [0.92, 0.30], [0.87, 0.34], [0.94, 0.38], [1.0, 0.41]
  ], 5.3, 0.60);
  drawOrganicDrift([
    [1.0, 0.58], [0.91, 0.62], [0.85, 0.67], [0.92, 0.71], [1.0, 0.74]
  ], 7.4, 0.72);

  // Bottom foreground snowdrifts & ice floes
  drawOrganicDrift([
    [0.0, 0.78], [0.13, 0.80], [0.26, 0.84], [0.33, 0.91],
    [0.24, 0.97], [0.0, 1.0]
  ], 9.2, 0.78);
  drawOrganicDrift([
    [0.28, 0.93], [0.46, 0.90], [0.64, 0.85], [0.78, 0.81],
    [0.91, 0.85], [1.0, 0.89], [1.0, 1.0], [0.24, 1.0]
  ], 11.8, 0.76);

  // Frosted arching winter reeds along left & bottom-right banks
  const reedClusters = [
    { x: 0.04, y: 0.42, count: 5, h: 0.10, dir: 1 },
    { x: 0.07, y: 0.87, count: 6, h: 0.13, dir: 1 },
    { x: 0.85, y: 0.91, count: 5, h: 0.11, dir: -1 },
    { x: 0.93, y: 0.88, count: 6, h: 0.14, dir: -1 }
  ];
  ctx.lineCap = 'round';
  for (const cl of reedClusters) {
    for (let i = 0; i < cl.count; i++) {
      const bx = (cl.x + (i - cl.count * 0.5) * 0.012) * w;
      const by = cl.y * h;
      const rh = cl.h * h * (0.75 + 0.35 * ((i * 37) % 10) / 10);
      const bend = (0.35 + i * 0.12) * cl.dir * w * 0.04;
      ctx.strokeStyle = 'rgba(205, 226, 245, 0.70)';
      ctx.lineWidth = Math.max(1.2, w * 0.0015);
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(bx + bend * 0.45, by - rh * 0.65, bx + bend, by - rh);
      ctx.stroke();
    }
  }

  // Scattered falling snow specks across the winter pond
  for (let i = 0; i < 72; i++) {
    const sx = ((i * 197.3 + 41.7) % 1000) / 1000 * w;
    const sy = ((i * 313.9 + 83.1) % 1000) / 1000 * h;
    const sr = 1.1 + ((i * 29) % 10) * 0.22;
    ctx.fillStyle = `rgba(225, 240, 255, ${0.32 + ((i * 17) % 10) * 0.055})`;
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawWinterTwigs(ctx, w, h) {
  ctx.save();
  ctx.strokeStyle = 'rgba(198, 222, 244, 0.68)';
  ctx.lineCap = 'round';
  const drawBranch = (x, y, len, angle, depth, lw) => {
    if (depth <= 0 || len < 6) return;
    const ex = x + Math.cos(angle) * len;
    const ey = y + Math.sin(angle) * len;
    const mx = (x + ex) * 0.5 + Math.sin(angle * 3.1 + depth) * len * 0.09;
    const my = (y + ey) * 0.5 - Math.cos(angle * 2.7 + depth) * len * 0.08;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(mx, my, ex, ey);
    ctx.stroke();
    // Frost bead highlight near twig tips
    if (depth <= 2) {
      ctx.fillStyle = 'rgba(235, 248, 255, 0.72)';
      ctx.beginPath();
      ctx.arc(ex, ey, Math.max(1.2, lw * 0.9), 0, Math.PI * 2);
      ctx.fill();
    }
    drawBranch(ex, ey, len * 0.68, angle - 0.34, depth - 1, lw * 0.72);
    drawBranch(ex, ey, len * 0.62, angle + 0.42, depth - 1, lw * 0.68);
  };
  drawBranch(0, h * 0.07, w * 0.14, 0.26, 4, Math.max(2.4, w * 0.0028));
  drawBranch(w * 0.06, 0, w * 0.11, 0.52, 3, Math.max(2.0, w * 0.0022));
  drawBranch(0, h * 0.15, w * 0.09, 0.78, 3, Math.max(1.8, w * 0.0020));
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

const SPRING_PADS = [
  { x: 0.06, y: 0.47, r: 0.056, squash: 0.50, depth: 0.66, notch: -0.4, seed: 1.4, veins: 12 },
  { x: 0.07, y: 0.74, r: 0.066, squash: 0.54, depth: 0.78, notch: 0.5, seed: 2.8, veins: 14 },
  { x: 0.16, y: 0.82, r: 0.086, squash: 0.52, depth: 0.84, notch: -0.6, seed: 3.9, veins: 15 },
  { x: 0.67, y: 0.96, r: 0.060, squash: 0.50, depth: 0.74, notch: 1.2, seed: 4.2, veins: 12 },
  { x: 0.85, y: 0.92, r: 0.095, squash: 0.50, depth: 0.76, notch: -1.1, seed: 5.5, veins: 15 },
  { x: 0.90, y: 0.58, r: 0.072, squash: 0.52, depth: 0.78, notch: 2.2, seed: 6.1, veins: 14 },
  { x: 0.68, y: 0.35, r: 0.044, squash: 0.46, depth: 0.52, notch: -2.0, seed: 7.3, veins: 10 },
  { x: 0.87, y: 0.27, r: 0.048, squash: 0.46, depth: 0.42, notch: 0.9, seed: 8.4, veins: 10 }
];

const SPRING_SPROUTS = [
  { x: 0.22, y: 0.43, s: 0.020 },
  { x: 0.08, y: 0.68, s: 0.026 },
  { x: 0.28, y: 0.76, s: 0.030 },
  { x: 0.72, y: 0.88, s: 0.028 },
  { x: 0.90, y: 0.52, s: 0.026 },
  { x: 0.68, y: 0.32, s: 0.018 }
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

const FLOATING_PETALS = [
  [0.14, 0.40], [0.39, 0.37], [0.46, 0.54], [0.60, 0.44], [0.67, 0.46],
  [0.31, 0.62], [0.57, 0.66], [0.62, 0.78], [0.34, 0.91], [0.22, 0.81],
  [0.77, 0.60], [0.85, 0.85], [0.86, 0.92], [0.71, 0.42], [0.11, 0.72]
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

const AUTUMN_FLOATING_LEAVES = [
  [0.49, 0.78, 0.044, -0.35, '#e84412', '#ffa62e'],
  [0.73, 0.43, 0.036, 0.45, '#df3f10', '#ff9224'],
  [0.18, 0.67, 0.032, -0.75, '#d43a12', '#f28220'],
  [0.25, 0.53, 0.024, 0.85, '#c83a14', '#e87822'],
  [0.67, 0.31, 0.025, -0.4, '#c43812', '#e47420'],
  [0.06, 0.78, 0.026, 0.5, '#b83210', '#dc6a1c'],
  [0.19, 0.92, 0.024, -0.6, '#b43010', '#d8661c'],
  [0.93, 0.72, 0.022, 0.9, '#b83412', '#d86a1e'],
  [0.40, 0.88, 0.018, 0.2, '#b03010', '#d06018']
];

export class FloraLayer {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.width = 0;
    this.height = 0;
    this.season = '';
  }

  render(season, width, height) {
    const w = Math.max(512, Math.min(1600, Math.round(width)));
    const h = Math.max(340, Math.min(1200, Math.round(height)));
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

    if (season === 'summer') {
      for (const pad of SUMMER_PADS) drawLotusPad(ctx, w, h, pad, 'summer');
      for (const bud of SUMMER_BUDS) drawLotusBud(ctx, w, h, bud);
    } else if (season === 'spring') {
      for (const pad of SPRING_PADS) drawLotusPad(ctx, w, h, pad, 'spring');
      for (const sp of SPRING_SPROUTS) drawSprout(ctx, w, h, sp);
      // Floating pink sakura petals on water
      for (let i = 0; i < FLOATING_PETALS.length; i++) {
        const [px, py] = FLOATING_PETALS[i];
        ctx.save();
        ctx.translate(px * w, py * h);
        ctx.rotate((i * 1.37) % (Math.PI * 2));
        const pr = w * 0.010;
        const pg = ctx.createRadialGradient(0, 0, 0, 0, 0, pr * 1.2);
        pg.addColorStop(0, '#ffe2ee');
        pg.addColorStop(0.55, '#ff98c2');
        pg.addColorStop(1, 'rgba(255, 130, 180, 0)');
        ctx.fillStyle = pg;
        ctx.beginPath();
        ctx.ellipse(0, 0, pr * 1.25, pr * 0.65, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      // Overhanging sakura branches & blossoms top-left
      drawBranchTree(ctx, w, h, OVERHANG_BRANCHES, 'rgba(130, 82, 88, 0.72)');
      for (let i = 0; i < SAKURA_CLUSTERS.length; i++) {
        const [fx, fy, fr] = SAKURA_CLUSTERS[i];
        drawSakuraFlower(ctx, fx * w, fy * h, fr * w, i * 0.9, 0.94);
      }
    } else if (season === 'autumn') {
      for (const pad of AUTUMN_PADS) drawLotusPad(ctx, w, h, pad, 'autumn');
      for (const lf of AUTUMN_FLOATING_LEAVES) {
        drawMapleLeaf(ctx, lf[0] * w, lf[1] * h, lf[2] * w, lf[3], lf[4], lf[5], 0.94);
      }
      // Overhanging autumn maple branches & canopy leaves top-left
      drawBranchTree(ctx, w, h, OVERHANG_BRANCHES, 'rgba(105, 56, 28, 0.75)');
      for (const lf of AUTUMN_CANOPY_LEAVES) {
        drawMapleLeaf(ctx, lf[0] * w, lf[1] * h, lf[2] * w, lf[3], '#d84214', '#ff9428', 0.92);
      }
    } else if (season === 'winter') {
      drawWinterBanks(ctx, w, h);
      drawWinterTwigs(ctx, w, h);
    }

    return this.canvas;
  }
}
