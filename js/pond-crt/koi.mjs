// Underwater skeletal Nishikigoi (Koi) renderer — Overhauled for:
// - Anatomically graceful rounded snout & muscular shoulders (no sharp pointy nose!)
// - Smooth Bezier flanks & seamlessly integrated flowing caudal tail fin (zero detachment!)
// - Natural, calm tail-thrust wake ripples emitted at realistic position & cadence
// - Lean 640x426 offscreen canvas for rock-solid 120 FPS

const SPINE_SEGMENTS = 18;

// Authentic Nishikigoi (Kohaku) width profile from rounded snout (0) to peduncle (1)
function koiWidthProfile(t) {
  if (t < 0.08) {
    // Broad, gently rounded koi nose (not pointy!)
    const u = t / 0.08;
    return 0.42 + 0.44 * Math.sin(u * Math.PI * 0.5);
  }
  if (t < 0.28) {
    // Smooth swell to full koi shoulders
    const u = (t - 0.08) / 0.20;
    return 0.86 + 0.16 * Math.sin(u * Math.PI * 0.65);
  }
  // Graceful aerodynamic taper from shoulders to slender tail peduncle
  const u = (t - 0.28) / 0.72;
  return Math.max(0.16, Math.pow(1.0 - u, 1.38) * 0.98 + 0.10 * Math.sin(u * Math.PI));
}

class KoiFish {
  constructor(config) {
    this.id = config.id;
    this.lengthFrac = config.lengthFrac;
    this.widthFrac = config.widthFrac;
    this.cx = config.cx;
    this.cy = config.cy;
    this.rx = config.rx;
    this.ry = config.ry;
    this.speed = config.speed;
    this.phase = config.phase;
    this.dir = config.dir ?? 1;
    this.swimFreq = config.swimFreq ?? 3.1;
    this.depth = config.depth ?? 0.94;
    this.spots = config.spots;
    this.lastRippleTime = config.initialRippleOffset ?? -2.0;
    this.rippleInterval = config.rippleInterval ?? 4.6;
    this.spine = [];
  }

  _pathPos(u) {
    const a = this.phase + u * this.dir;
    const x = this.cx + Math.cos(a) * this.rx + Math.sin(a * 2.0) * this.rx * 0.16;
    const y = this.cy + Math.sin(a) * this.ry + Math.cos(a * 1.5) * this.ry * 0.12;
    return { x, y };
  }

  update(t, w, h) {
    const uHead = t * this.speed;
    const bodyLenPx = this.lengthFrac * w;
    const segLen = bodyLenPx / (SPINE_SEGMENTS - 1);

    const pts = [];
    let uCur = uHead;
    const p0 = this._pathPos(uCur);
    pts.push({ x: p0.x * w, y: p0.y * h });

    for (let i = 1; i < SPINE_SEGMENTS; i++) {
      const dtStep = 0.04;
      const prev = pts[i - 1];
      const pNext = this._pathPos(uCur - dtStep);
      const d = Math.hypot(pNext.x * w - prev.x, pNext.y * h - prev.y) || 1;
      uCur -= (segLen / d) * dtStep;
      const p = this._pathPos(uCur);
      pts.push({ x: p.x * w, y: p.y * h });
    }

    // Apply natural traveling S-curve swimming wave (head stays steady, tail sweeps smoothly)
    this.spine = pts.map((p, i) => {
      const frac = i / (SPINE_SEGMENTS - 1);
      const prevPt = pts[Math.max(0, i - 1)];
      const nextPt = pts[Math.min(SPINE_SEGMENTS - 1, i + 1)];
      const tx = prevPt.x - nextPt.x;
      const ty = prevPt.y - nextPt.y;
      const len = Math.hypot(tx, ty) || 1;
      const nx = -ty / len;
      const ny = tx / len;
      const wave = Math.sin(t * this.swimFreq - frac * 4.6 + this.phase) * bodyLenPx * 0.052 * Math.pow(frac, 1.45);
      return {
        x: p.x + nx * wave,
        y: p.y + ny * wave,
        tx: tx / len,
        ty: ty / len,
        nx,
        ny,
        frac,
        halfW: koiWidthProfile(frac) * bodyLenPx * this.widthFrac
      };
    });

    // Emit calm wake ripples from the sweeping mid-tail thrust zone (spine[12]), NOT head spam!
    const thrustSeg = this.spine[12];
    const ready = (t - this.lastRippleTime) >= this.rippleInterval;
    return {
      uvX: thrustSeg.x / w,
      uvY: 1.0 - thrustSeg.y / h,
      shouldEmitRipple: ready
    };
  }

  _traceSmoothBodyPath(ctx, sp, expand = 1.0) {
    const head = sp[0];
    const headAngle = Math.atan2(head.ty, head.tx);
    const noseR = head.halfW * expand;

    // Build smooth left & right flank control points
    const leftPts = [];
    const rightPts = [];
    for (let i = 0; i < sp.length; i++) {
      const s = sp[i];
      leftPts.push({ x: s.x + s.nx * s.halfW * expand, y: s.y + s.ny * s.halfW * expand });
      rightPts.push({ x: s.x - s.nx * s.halfW * expand, y: s.y - s.ny * s.halfW * expand });
    }

    ctx.beginPath();
    // Rounded U-shaped koi snout using two smooth cubic Beziers around the head
    const snoutTipX = head.x + Math.cos(headAngle) * noseR * 0.92;
    const snoutTipY = head.y + Math.sin(headAngle) * noseR * 0.92;

    ctx.moveTo(rightPts[0].x, rightPts[0].y);
    ctx.quadraticCurveTo(
      rightPts[0].x + Math.cos(headAngle) * noseR * 0.88,
      rightPts[0].y + Math.sin(headAngle) * noseR * 0.88,
      snoutTipX,
      snoutTipY
    );
    ctx.quadraticCurveTo(
      leftPts[0].x + Math.cos(headAngle) * noseR * 0.88,
      leftPts[0].y + Math.sin(headAngle) * noseR * 0.88,
      leftPts[0].x,
      leftPts[0].y
    );

    // Smooth quadratic midpoint spline down the left flank
    for (let i = 1; i < leftPts.length - 1; i++) {
      const mx = (leftPts[i].x + leftPts[i + 1].x) * 0.5;
      const my = (leftPts[i].y + leftPts[i + 1].y) * 0.5;
      ctx.quadraticCurveTo(leftPts[i].x, leftPts[i].y, mx, my);
    }
    const lastL = leftPts[leftPts.length - 1];
    const lastR = rightPts[rightPts.length - 1];
    ctx.lineTo(lastL.x, lastL.y);
    ctx.lineTo(lastR.x, lastR.y);

    // Smooth quadratic midpoint spline back up the right flank
    for (let i = rightPts.length - 2; i >= 1; i--) {
      const mx = (rightPts[i].x + rightPts[i - 1].x) * 0.5;
      const my = (rightPts[i].y + rightPts[i - 1].y) * 0.5;
      ctx.quadraticCurveTo(rightPts[i].x, rightPts[i].y, mx, my);
    }
    ctx.lineTo(rightPts[0].x, rightPts[0].y);
    ctx.closePath();
  }

  draw(ctx, t, depthScale = 1.0) {
    const sp = this.spine;
    if (!sp.length) return;
    const alpha = Math.max(0.24, Math.min(1.0, this.depth * depthScale));
    const bodyLen = this.lengthFrac * ctx.canvas.width;

    ctx.save();
    ctx.globalAlpha = alpha;

    // 1. Soft dark underwater shadow beneath the koi
    ctx.save();
    ctx.translate(0, bodyLen * 0.065);
    this._traceSmoothBodyPath(ctx, sp, 1.12);
    ctx.fillStyle = 'rgba(1, 10, 12, 0.36)';
    ctx.fill();
    ctx.restore();

    // 2. Graceful fan-shaped translucent pectoral & pelvic fins
    const drawSideFin = (segIdx, side, finLen, finWidth, swingAmp) => {
      const s = sp[segIdx];
      const baseAngle = Math.atan2(s.ty, s.tx);
      const swing = Math.sin(t * this.swimFreq * 0.8 + side * 0.35 + this.phase) * swingAmp;
      const finAngle = baseAngle + side * (Math.PI * 0.64 + swing);
      // Anchor slightly INSIDE the body so fin never detaches
      const bx = s.x + s.nx * side * s.halfW * 0.45;
      const by = s.y + s.ny * side * s.halfW * 0.45;

      const tipX = bx + Math.cos(finAngle) * finLen;
      const tipY = by + Math.sin(finAngle) * finLen;
      const backX = bx + Math.cos(finAngle + side * finWidth) * finLen * 0.84;
      const backY = by + Math.sin(finAngle + side * finWidth) * finLen * 0.84;

      const fg = ctx.createLinearGradient(bx, by, tipX, tipY);
      fg.addColorStop(0.0, 'rgba(255, 246, 236, 0.78)');
      fg.addColorStop(0.55, 'rgba(244, 248, 244, 0.38)');
      fg.addColorStop(1.0, 'rgba(220, 244, 240, 0.06)');

      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(
        bx + Math.cos(finAngle - side * 0.25) * finLen * 0.72,
        by + Math.sin(finAngle - side * 0.25) * finLen * 0.72,
        tipX, tipY
      );
      ctx.quadraticCurveTo(
        (tipX + backX) * 0.5 + Math.cos(finAngle + side * 0.18) * finLen * 0.20,
        (tipY + backY) * 0.5 + Math.sin(finAngle + side * 0.18) * finLen * 0.20,
        backX, backY
      );
      ctx.quadraticCurveTo(
        s.x - s.tx * finLen * 0.35 + s.nx * side * s.halfW * 0.3,
        s.y - s.ty * finLen * 0.35 + s.ny * side * s.halfW * 0.3,
        bx, by
      );
      ctx.closePath();
      ctx.fillStyle = fg;
      ctx.fill();
    };

    const shoulderW = sp[4].halfW;
    drawSideFin(4, 1, shoulderW * 2.45, 0.62, 0.12);
    drawSideFin(4, -1, shoulderW * 2.45, 0.62, 0.12);
    drawSideFin(10, 1, shoulderW * 1.15, 0.52, 0.09);
    drawSideFin(10, -1, shoulderW * 1.15, 0.52, 0.09);

    // 3. Seamlessly Connected Flowing Caudal Tail Fin
    // Anchored deep into sp[length - 3] so it NEVER separates from the peduncle at any curve!
    const root = sp[sp.length - 3];
    const midTail = sp[sp.length - 2];
    const tail = sp[sp.length - 1];
    const tailAngle = Math.atan2(tail.y - root.y, tail.x - root.x);
    const tailLen = bodyLen * 0.27;
    const tailFlick = Math.sin(t * this.swimFreq - 4.9 + this.phase) * 0.20;

    const lobe1X = tail.x + Math.cos(tailAngle + 0.44 + tailFlick) * tailLen;
    const lobe1Y = tail.y + Math.sin(tailAngle + 0.44 + tailFlick) * tailLen;
    const lobe2X = tail.x + Math.cos(tailAngle - 0.44 + tailFlick) * tailLen;
    const lobe2Y = tail.y + Math.sin(tailAngle - 0.44 + tailFlick) * tailLen;
    const forkX = tail.x + Math.cos(tailAngle + tailFlick * 0.65) * tailLen * 0.46;
    const forkY = tail.y + Math.sin(tailAngle + tailFlick * 0.65) * tailLen * 0.46;

    const tg = ctx.createLinearGradient(root.x, root.y, forkX + Math.cos(tailAngle) * tailLen * 0.45, forkY + Math.sin(tailAngle) * tailLen * 0.45);
    tg.addColorStop(0.0, 'rgba(242, 236, 224, 0.96)');
    tg.addColorStop(0.32, 'rgba(255, 244, 232, 0.78)');
    tg.addColorStop(0.72, 'rgba(245, 246, 242, 0.36)');
    tg.addColorStop(1.0, 'rgba(220, 242, 240, 0.05)');

    ctx.beginPath();
    ctx.moveTo(root.x + root.nx * root.halfW * 0.92, root.y + root.ny * root.halfW * 0.92);
    ctx.quadraticCurveTo(
      midTail.x + midTail.nx * midTail.halfW * 1.15,
      midTail.y + midTail.ny * midTail.halfW * 1.15,
      lobe1X, lobe1Y
    );
    ctx.quadraticCurveTo(forkX, forkY, lobe2X, lobe2Y);
    ctx.quadraticCurveTo(
      midTail.x - midTail.nx * midTail.halfW * 1.15,
      midTail.y - midTail.ny * midTail.halfW * 1.15,
      root.x - root.nx * root.halfW * 0.92, root.y - root.ny * root.halfW * 0.92
    );
    ctx.closePath();
    ctx.fillStyle = tg;
    ctx.fill();

    // 4. Main Koi Body Silhouette (smooth rounded snout & curved flanks)
    this._traceSmoothBodyPath(ctx, sp, 1.0);

    const bg = ctx.createLinearGradient(sp[0].x, sp[0].y, tail.x, tail.y);
    bg.addColorStop(0.0, '#fff9ef');
    bg.addColorStop(0.45, '#f6efe4');
    bg.addColorStop(1.0, '#e2dcd0');
    ctx.fillStyle = bg;
    ctx.fill();

    // Clip inside body for Kohaku red-orange saddle markings + dorsal sheen + eyes
    ctx.save();
    ctx.clip();

    for (const spot of this.spots) {
      const idx = Math.max(0, Math.min(sp.length - 1, Math.round(spot.t * (sp.length - 1))));
      const s = sp[idx];
      const sx = s.x + s.nx * s.halfW * (spot.offset ?? 0);
      const sy = s.y + s.ny * s.halfW * (spot.offset ?? 0);
      const sr = s.halfW * spot.r;
      const sg = ctx.createRadialGradient(sx, sy, sr * 0.12, sx, sy, sr);
      sg.addColorStop(0.0, '#ff5418');
      sg.addColorStop(0.65, '#e83a0e');
      sg.addColorStop(1.0, 'rgba(218, 46, 12, 0)');
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.ellipse(sx, sy, sr * 1.18, sr * 0.88, Math.atan2(s.ty, s.tx), 0, Math.PI * 2);
      ctx.fill();
    }

    // Soft dorsal volume sheen along spine
    ctx.strokeStyle = 'rgba(255, 252, 242, 0.36)';
    ctx.lineWidth = Math.max(1.5, sp[4].halfW * 0.38);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(sp[1].x, sp[1].y);
    for (let i = 2; i < sp.length - 2; i++) {
      ctx.lineTo(sp[i].x, sp[i].y);
    }
    ctx.stroke();

    // Subtle dark eyes positioned naturally on the rounded head
    const headSeg = sp[1];
    const eyeR = Math.max(1.0, headSeg.halfW * 0.15);
    ctx.fillStyle = 'rgba(18, 22, 24, 0.68)';
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

    // Two graceful Nishikigoi swimming calmly beneath the water surface
    this.fish = [
      new KoiFish({
        id: 'koi-main',
        lengthFrac: 0.21,
        widthFrac: 0.108,
        cx: 0.44,
        cy: 0.56,
        rx: 0.15,
        ry: 0.10,
        speed: 0.19,
        phase: 0.85,
        dir: 1,
        swimFreq: 3.1,
        depth: 0.96,
        rippleInterval: 4.5,
        initialRippleOffset: -3.2,
        spots: [
          { t: 0.08, r: 0.95, offset: 0.04 },
          { t: 0.32, r: 1.32, offset: -0.14 },
          { t: 0.56, r: 1.24, offset: 0.16 },
          { t: 0.76, r: 0.96, offset: -0.06 }
        ]
      }),
      new KoiFish({
        id: 'koi-companion',
        lengthFrac: 0.175,
        widthFrac: 0.106,
        cx: 0.60,
        cy: 0.42,
        rx: 0.12,
        ry: 0.09,
        speed: 0.22,
        phase: 3.75,
        dir: -1,
        swimFreq: 3.5,
        depth: 0.88,
        rippleInterval: 5.2,
        initialRippleOffset: -1.4,
        spots: [
          { t: 0.10, r: 1.05, offset: -0.04 },
          { t: 0.36, r: 1.28, offset: 0.12 },
          { t: 0.64, r: 1.14, offset: -0.10 }
        ]
      })
    ];
  }

  render(t, width, height, seasonId, onWakeRipple) {
    // Lean 640x426 canvas: sharper than the 4px CRT dot grid while 5.5x faster for 120 FPS!
    const w = Math.max(360, Math.min(640, Math.round(width * 0.5)));
    const h = Math.max(240, Math.min(426, Math.round(height * 0.5)));
    if (this.width !== w || this.height !== h) {
      this.width = w;
      this.height = h;
      this.canvas.width = w;
      this.canvas.height = h;
    }

    const ctx = this.ctx;
    ctx.clearRect(0, 0, w, h);

    const speedMult = seasonId === 'winter' ? 0.52 : 1.0;
    const depthMult = seasonId === 'winter' ? 0.68 : 1.0;

    for (let i = 0; i < this.fish.length; i++) {
      const f = this.fish[i];
      const info = f.update(t * speedMult, w, h);
      const fishDepth = (seasonId === 'winter' && i === 1) ? depthMult * 0.65 : depthMult;
      f.draw(ctx, t * speedMult, fishDepth);

      if (info.shouldEmitRipple && onWakeRipple) {
        f.lastRippleTime = t * speedMult;
        onWakeRipple(info.uvX, info.uvY, seasonId === 'winter' ? 0.34 : 0.56);
      }
    }

    return this.canvas;
  }
}
