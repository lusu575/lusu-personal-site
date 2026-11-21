// Underwater skeletal koi fish renderer (at least 2 koi swimming beneath the water surface)
// Rendered to an offscreen canvas every frame and composited UNDER water surface refraction,
// depth veiling, and concentric wake ripples, then quantized by the unified CRT phosphor-dot shader.

const SPINE_SEGMENTS = 16;

// Organic koi body width profile from snout (0) to peduncle (1)
function bodyWidthAt(t) {
  if (t < 0.18) {
    // Rounded snout to broad shoulders
    const u = t / 0.18;
    return Math.sin(u * Math.PI * 0.5) * 0.96 + 0.06;
  }
  // Smooth aerodynamic taper from shoulders to tail peduncle
  const u = (t - 0.18) / 0.82;
  return Math.max(0.11, Math.pow(1.0 - u, 1.28) * 1.02 + 0.09 * Math.sin(u * Math.PI));
}

class KoiFish {
  constructor(config) {
    this.id = config.id;
    this.lengthFrac = config.lengthFrac; // fraction of canvas width
    this.widthFrac = config.widthFrac;   // max half-width as fraction of length
    this.cx = config.cx;                 // orbit center X (0..1)
    this.cy = config.cy;                 // orbit center Y (0..1)
    this.rx = config.rx;                 // orbit radius X
    this.ry = config.ry;                 // orbit radius Y
    this.speed = config.speed;           // radians/sec
    this.phase = config.phase;           // starting angle
    this.dir = config.dir ?? 1;          // +1 or -1
    this.swimFreq = config.swimFreq ?? 3.6;
    this.depth = config.depth ?? 0.92;   // 1.0 near surface, 0.45 deeper
    this.spots = config.spots;           // Kohaku red-orange saddle spots
    this.lastRippleTime = -10;
    this.rippleInterval = config.rippleInterval ?? 1.65;
    this.spine = [];
  }

  // Smooth figure-8 / meandering pond path
  _pathPos(u) {
    const a = this.phase + u * this.dir;
    const x = this.cx + Math.cos(a) * this.rx + Math.sin(a * 2.0) * this.rx * 0.18;
    const y = this.cy + Math.sin(a) * this.ry + Math.cos(a * 1.5) * this.ry * 0.14;
    return { x, y };
  }

  update(t, w, h) {
    const uHead = t * this.speed;
    const bodyLenPx = this.lengthFrac * w;
    const segLen = bodyLenPx / (SPINE_SEGMENTS - 1);

    // Sample head and slightly behind head along path to establish natural curved spine
    const pts = [];
    let uCur = uHead;
    let prev = this._pathPos(uCur);
    pts.push({ x: prev.x * w, y: prev.y * h });

    // Walk backward along path with gentle sinusoidal swimming undulation
    for (let i = 1; i < SPINE_SEGMENTS; i++) {
      const frac = i / (SPINE_SEGMENTS - 1);
      // Approximate arc-length step backward along the parametric path
      const dtStep = 0.045;
      let targetX = pts[i - 1].x;
      let targetY = pts[i - 1].y;
      let pNext = this._pathPos(uCur - dtStep);
      let dx = pNext.x * w - targetX;
      let dy = pNext.y * h - targetY;
      let d = Math.hypot(dx, dy) || 1;
      const uDelta = (segLen / d) * dtStep;
      uCur -= uDelta;
      const p = this._pathPos(uCur);
      pts.push({ x: p.x * w, y: p.y * h, frac });
    }

    // Apply lateral S-curve swimming wave (increases smoothly from head to tail)
    this.spine = pts.map((p, i) => {
      const frac = i / (SPINE_SEGMENTS - 1);
      const prevPt = pts[Math.max(0, i - 1)];
      const nextPt = pts[Math.min(SPINE_SEGMENTS - 1, i + 1)];
      const tx = prevPt.x - nextPt.x;
      const ty = prevPt.y - nextPt.y;
      const len = Math.hypot(tx, ty) || 1;
      const nx = -ty / len;
      const ny = tx / len;
      const wave = Math.sin(t * this.swimFreq - frac * 5.2 + this.phase) * bodyLenPx * 0.058 * Math.pow(frac, 1.35);
      return {
        x: p.x + nx * wave,
        y: p.y + ny * wave,
        tx: tx / len,
        ty: ty / len,
        nx,
        ny,
        frac,
        halfW: bodyWidthAt(frac) * bodyLenPx * this.widthFrac
      };
    });

    // Head normalized UV (WebGL Y-up) for wake ripple emission
    const head = this.spine[2];
    return {
      uvX: head.x / w,
      uvY: 1.0 - head.y / h,
      shouldEmitRipple: (t - this.lastRippleTime) >= this.rippleInterval
    };
  }

  draw(ctx, t, depthScale = 1.0) {
    const sp = this.spine;
    if (!sp.length) return;
    const alpha = Math.max(0.22, Math.min(1.0, this.depth * depthScale));
    const bodyLen = Math.hypot(sp[0].x - sp[sp.length - 1].x, sp[0].y - sp[sp.length - 1].y) * 1.15;

    ctx.save();
    ctx.globalAlpha = alpha;

    // 1. Soft dark underwater shadow beneath the koi
    ctx.save();
    ctx.translate(0, bodyLen * 0.07);
    ctx.beginPath();
    ctx.moveTo(sp[0].x, sp[0].y);
    for (let i = 1; i < sp.length; i++) {
      ctx.lineTo(sp[i].x + sp[i].nx * sp[i].halfW * 1.15, sp[i].y + sp[i].ny * sp[i].halfW * 1.15);
    }
    for (let i = sp.length - 1; i >= 1; i--) {
      ctx.lineTo(sp[i].x - sp[i].nx * sp[i].halfW * 1.15, sp[i].y - sp[i].ny * sp[i].halfW * 1.15);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(1, 10, 12, 0.42)';
    ctx.fill();
    ctx.restore();

    // 2. Flowing translucent pectoral fins (at shoulder segment 4) & pelvic fins (segment 9)
    const drawSideFin = (segIdx, side, finLen, finSpread, swingAmp) => {
      const s = sp[segIdx];
      const baseAngle = Math.atan2(s.ty, s.tx);
      const swing = Math.sin(t * this.swimFreq * 0.85 + side * 0.4 + this.phase) * swingAmp;
      const finAngle = baseAngle + side * (Math.PI * 0.62 + swing);
      const bx = s.x + s.nx * side * s.halfW * 0.72;
      const by = s.y + s.ny * side * s.halfW * 0.72;

      const tipX = bx + Math.cos(finAngle) * finLen;
      const tipY = by + Math.sin(finAngle) * finLen;
      const backX = bx + Math.cos(finAngle + side * finSpread) * finLen * 0.78;
      const backY = by + Math.sin(finAngle + side * finSpread) * finLen * 0.78;

      const fg = ctx.createLinearGradient(bx, by, tipX, tipY);
      fg.addColorStop(0, 'rgba(255, 245, 232, 0.72)');
      fg.addColorStop(0.55, 'rgba(240, 248, 244, 0.34)');
      fg.addColorStop(1, 'rgba(215, 242, 238, 0.06)');

      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(
        bx + Math.cos(finAngle - side * 0.22) * finLen * 0.68,
        by + Math.sin(finAngle - side * 0.22) * finLen * 0.68,
        tipX, tipY
      );
      ctx.quadraticCurveTo(
        (tipX + backX) * 0.5 + Math.cos(finAngle + side * 0.2) * finLen * 0.16,
        (tipY + backY) * 0.5 + Math.sin(finAngle + side * 0.2) * finLen * 0.16,
        backX, backY
      );
      ctx.quadraticCurveTo(
        s.x - s.tx * finLen * 0.35 + s.nx * side * s.halfW * 0.5,
        s.y - s.ty * finLen * 0.35 + s.ny * side * s.halfW * 0.5,
        bx, by
      );
      ctx.closePath();
      ctx.fillStyle = fg;
      ctx.fill();
    };

    const shoulderW = sp[4].halfW;
    drawSideFin(4, 1, shoulderW * 2.55, 0.58, 0.14);
    drawSideFin(4, -1, shoulderW * 2.55, 0.58, 0.14);
    drawSideFin(9, 1, shoulderW * 1.25, 0.48, 0.10);
    drawSideFin(9, -1, shoulderW * 1.25, 0.48, 0.10);

    // 3. Flowing forked translucent caudal tail fin
    const tail = sp[sp.length - 1];
    const tailPrev = sp[sp.length - 2];
    const tailAngle = Math.atan2(tail.y - tailPrev.y, tail.x - tailPrev.x);
    const tailLen = bodyLen * 0.30;
    const tailFlick = Math.sin(t * this.swimFreq - 5.4 + this.phase) * 0.24;

    const lobe1X = tail.x + Math.cos(tailAngle + 0.42 + tailFlick) * tailLen;
    const lobe1Y = tail.y + Math.sin(tailAngle + 0.42 + tailFlick) * tailLen;
    const lobe2X = tail.x + Math.cos(tailAngle - 0.42 + tailFlick) * tailLen;
    const lobe2Y = tail.y + Math.sin(tailAngle - 0.42 + tailFlick) * tailLen;
    const forkX = tail.x + Math.cos(tailAngle + tailFlick * 0.7) * tailLen * 0.48;
    const forkY = tail.y + Math.sin(tailAngle + tailFlick * 0.7) * tailLen * 0.48;

    const tg = ctx.createLinearGradient(tail.x, tail.y, forkX + Math.cos(tailAngle) * tailLen * 0.4, forkY + Math.sin(tailAngle) * tailLen * 0.4);
    tg.addColorStop(0, 'rgba(255, 240, 224, 0.85)');
    tg.addColorStop(0.55, 'rgba(245, 242, 236, 0.45)');
    tg.addColorStop(1, 'rgba(220, 242, 240, 0.08)');

    ctx.beginPath();
    ctx.moveTo(tail.x + tail.nx * tail.halfW, tail.y + tail.ny * tail.halfW);
    ctx.quadraticCurveTo(
      (tail.x + lobe1X) * 0.5 + tail.nx * tailLen * 0.14,
      (tail.y + lobe1Y) * 0.5 + tail.ny * tailLen * 0.14,
      lobe1X, lobe1Y
    );
    ctx.quadraticCurveTo(forkX, forkY, lobe2X, lobe2Y);
    ctx.quadraticCurveTo(
      (tail.x + lobe2X) * 0.5 - tail.nx * tailLen * 0.14,
      (tail.y + lobe2Y) * 0.5 - tail.ny * tailLen * 0.14,
      tail.x - tail.nx * tail.halfW, tail.y - tail.ny * tail.halfW
    );
    ctx.closePath();
    ctx.fillStyle = tg;
    ctx.fill();

    // 4. Main Koi Body Silhouette Path
    ctx.beginPath();
    const snoutX = sp[0].x + sp[0].tx * sp[1].halfW * 0.55;
    const snoutY = sp[0].y + sp[0].ty * sp[1].halfW * 0.55;
    ctx.moveTo(snoutX, snoutY);
    for (let i = 1; i < sp.length; i++) {
      ctx.lineTo(sp[i].x + sp[i].nx * sp[i].halfW, sp[i].y + sp[i].ny * sp[i].halfW);
    }
    for (let i = sp.length - 1; i >= 1; i--) {
      ctx.lineTo(sp[i].x - sp[i].nx * sp[i].halfW, sp[i].y - sp[i].ny * sp[i].halfW);
    }
    ctx.closePath();

    // Luminous pearl-ivory base body
    const bg = ctx.createLinearGradient(sp[0].x, sp[0].y, tail.x, tail.y);
    bg.addColorStop(0.0, '#fff7ea');
    bg.addColorStop(0.45, '#f6efe4');
    bg.addColorStop(1.0, '#dfd9ce');
    ctx.fillStyle = bg;
    ctx.fill();

    // Clip inside body to paint vivid Kohaku vermilion-orange saddle markings + dorsal sheen
    ctx.save();
    ctx.clip();

    for (const spot of this.spots) {
      const idx = Math.max(0, Math.min(sp.length - 1, Math.round(spot.t * (sp.length - 1))));
      const s = sp[idx];
      const sx = s.x + s.nx * s.halfW * (spot.offset ?? 0);
      const sy = s.y + s.ny * s.halfW * (spot.offset ?? 0);
      const sr = s.halfW * spot.r;
      const sg = ctx.createRadialGradient(sx, sy, sr * 0.15, sx, sy, sr);
      sg.addColorStop(0, '#ff561a');
      sg.addColorStop(0.68, '#ea3c10');
      sg.addColorStop(1, 'rgba(220, 48, 12, 0)');
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.ellipse(sx, sy, sr * 1.15, sr * 0.85, Math.atan2(s.ty, s.tx), 0, Math.PI * 2);
      ctx.fill();
    }

    // Bright dorsal highlight ridge along spine for 3D underwater volume
    ctx.strokeStyle = 'rgba(255, 252, 240, 0.42)';
    ctx.lineWidth = Math.max(2, sp[3].halfW * 0.42);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(sp[1].x, sp[1].y);
    for (let i = 2; i < sp.length - 2; i++) {
      ctx.lineTo(sp[i].x, sp[i].y);
    }
    ctx.stroke();

    // Tiny subtle dark eyes near head
    const headSeg = sp[1];
    const eyeR = Math.max(1.2, headSeg.halfW * 0.16);
    ctx.fillStyle = 'rgba(18, 22, 24, 0.72)';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(
        headSeg.x + headSeg.nx * side * headSeg.halfW * 0.72,
        headSeg.y + headSeg.ny * side * headSeg.halfW * 0.72,
        eyeR, 0, Math.PI * 2
      );
      ctx.fill();
    }

    ctx.restore();
    ctx.restore();
  }
}

export class KoiLayer {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.width = 0;
    this.height = 0;

    // Two hero Kohaku koi swimming gracefully in the central pond (matches final2-* composition)
    this.fish = [
      new KoiFish({
        id: 'koi-main',
        lengthFrac: 0.205,
        widthFrac: 0.106,
        cx: 0.45,
        cy: 0.56,
        rx: 0.15,
        ry: 0.10,
        speed: 0.20,
        phase: 0.85,
        dir: 1,
        swimFreq: 3.4,
        depth: 0.96,
        rippleInterval: 1.55,
        spots: [
          { t: 0.10, r: 1.05, offset: 0.05 },
          { t: 0.34, r: 1.35, offset: -0.15 },
          { t: 0.58, r: 1.25, offset: 0.18 },
          { t: 0.78, r: 1.00, offset: -0.08 }
        ]
      }),
      new KoiFish({
        id: 'koi-companion',
        lengthFrac: 0.170,
        widthFrac: 0.104,
        cx: 0.60,
        cy: 0.42,
        rx: 0.12,
        ry: 0.09,
        speed: 0.23,
        phase: 3.75,
        dir: -1,
        swimFreq: 3.8,
        depth: 0.88,
        rippleInterval: 1.85,
        spots: [
          { t: 0.12, r: 1.15, offset: -0.05 },
          { t: 0.38, r: 1.30, offset: 0.12 },
          { t: 0.66, r: 1.18, offset: -0.12 }
        ]
      })
    ];
  }

  render(t, width, height, seasonId, onWakeRipple) {
    const w = Math.max(512, Math.min(1440, Math.round(width)));
    const h = Math.max(340, Math.min(1080, Math.round(height)));
    if (this.width !== w || this.height !== h) {
      this.width = w;
      this.height = h;
      this.canvas.width = w;
      this.canvas.height = h;
    }

    const ctx = this.ctx;
    ctx.clearRect(0, 0, w, h);

    // In winter, both koi swim deeper and slower under the cold surface
    const speedMult = seasonId === 'winter' ? 0.58 : 1.0;
    const depthMult = seasonId === 'winter' ? 0.68 : 1.0;

    for (let i = 0; i < this.fish.length; i++) {
      const f = this.fish[i];
      const info = f.update(t * speedMult, w, h);
      const fishDepth = (seasonId === 'winter' && i === 1) ? depthMult * 0.65 : depthMult;
      f.draw(ctx, t * speedMult, fishDepth);

      if (info.shouldEmitRipple && onWakeRipple) {
        f.lastRippleTime = t * speedMult;
        onWakeRipple(info.uvX, info.uvY, seasonId === 'winter' ? 0.45 : 0.78);
      }
    }

    return this.canvas;
  }
}
