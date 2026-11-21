// Pure WebGL2 GPU Nishikigoi (Koi) Renderer — Upgraded to match close-up reference (media_1795239717837_9185467e.jpg)
// - Body-conforming luminous pearl/scale-dot lattice in GLSL (dots curve along the 3D spine & rounded flanks!)
// - Transparent dotted fan-ray pectoral, pelvic, dorsal & forked caudal tail fins (pond water shows right through!)
// - Volumetric 3/4 top-side shading (sunlit dorsal ridge, shaded lower flank, deep floating cast shadow)
// - Plump domed koi head, gleaming white snout tip, tiny mouth barbels (鱼须), and glossy cheek-side eyes
// - Strict per-segment spine bend clamping + 100% pure GPU (ZERO Canvas2D stalls -> locked 120+ FPS!)

import { createProgram } from './gl-utils.mjs';

const SPINE_SEGMENTS = 18;
const MAX_SEG_BEND = 0.080;

export const KOI_VERT = `#version 300 es
precision highp float;

layout(location = 0) in vec2 aPos;   // normalized screen UV [0, 1] (Y-up)
layout(location = 1) in vec2 aLocal; // x = along body/fin [0..1], y = across [-1..1]
layout(location = 2) in float aPart; // 0 = body, 1 = fin, 2 = shadow, 3 = dorsal fin, 4 = barbels
layout(location = 3) in float aFish; // 0 = main koi, 1 = companion koi

uniform float uTime;

out vec2 vLocal;
out float vPart;
out float vFish;

void main() {
  vec2 refractOff = vec2(
    sin(aPos.y * 24.0 + uTime * 1.2) * 0.0016,
    cos(aPos.x * 20.0 - uTime * 1.0) * 0.0014
  );
  vec2 p = aPos + refractOff;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
  vLocal = aLocal;
  vPart = aPart;
  vFish = aFish;
}
`;

export const KOI_FRAG = `#version 300 es
precision highp float;

in vec2 vLocal;
in float vPart;
in float vFish;

uniform vec3 uWaterMid;
uniform vec3 uCausticTint;
uniform float uKoiDepthFog;
uniform float uWinterMode;
uniform float uTime;

out vec4 fragColor;

float spotField(vec2 p, vec2 center, vec2 radius) {
  vec2 d = (p - center) / radius;
  return 1.0 - smoothstep(0.52, 1.05, length(d));
}

void main() {
  float depthFog = clamp(uKoiDepthFog + (uWinterMode > 0.5 && vFish > 0.5 ? 0.18 : 0.0), 0.0, 0.85);
  float baseAlpha = 1.0 - depthFog * 0.42;

  // Part 2: Deep floating cast shadow on pond floor beneath the koi
  if (vPart > 1.5 && vPart < 2.5) {
    float edge = (1.0 - smoothstep(0.20, 1.0, abs(vLocal.y))) * (1.0 - smoothstep(0.85, 1.0, vLocal.x));
    fragColor = vec4(0.005, 0.025, 0.035, edge * 0.46 * baseAlpha);
    return;
  }

  // Part 4: Tiny delicate glowing pearl barbels (鱼须) at mouth corners
  if (vPart > 3.5) {
    float along = vLocal.x;
    float dotPattern = 1.0 - smoothstep(0.25, 0.48, length(vec2(fract(along * 3.0) - 0.5, vLocal.y * 0.6)));
    float fade = 1.0 - smoothstep(0.4, 1.0, along);
    vec3 col = mix(vec3(0.95, 0.98, 1.0), uWaterMid * 1.4, depthFog * 0.7);
    fragColor = vec4(col, dotPattern * fade * 0.85 * baseAlpha);
    return;
  }

  // Part 1 & 3: Translucent Dotted Fan-Ray Fins (pectoral, pelvic, forked tail & dorsal crest)
  // Pond water shows clearly RIGHT THROUGH the gaps between glowing fin dots!
  if (vPart > 0.5) {
    float u = vLocal.x; // 0 = root, 1 = fin tip
    float v = vLocal.y; // -1..+1 across fin fan
    float isDorsal = vPart > 2.5 ? 1.0 : 0.0;

    float rayCols = isDorsal > 0.5 ? 10.0 : 7.0;
    float rayRows = isDorsal > 0.5 ? 3.0 : 6.0;
    vec2 grid = vec2(u * rayRows, (v * 0.5 + 0.5) * rayCols);
    float rowOff = mod(floor(grid.y), 2.0) * 0.45;
    vec2 cellUv = fract(vec2(grid.x + rowOff, grid.y)) - 0.5;
    float dotR = mix(0.36, 0.24, u);
    float dotGlow = 1.0 - smoothstep(dotR * 0.35, dotR, length(cellUv));

    float shapeMask = (1.0 - smoothstep(0.12, 1.0, u)) * (1.0 - smoothstep(0.68, 1.0, abs(v)));
    // Subtle warm golden-orange hint near pectoral fin roots, glistening pearl-white toward tips
    vec3 finCol = mix(vec3(1.0, 0.92, 0.82), vec3(0.92, 0.98, 1.0), u);
    finCol = mix(finCol, uWaterMid * 1.4, depthFog * 0.78);

    float alpha = (dotGlow * 0.92 + 0.10) * shapeMask * baseAlpha;
    if (alpha < 0.02) discard;
    fragColor = vec4(finCol * (0.95 + dotGlow * 0.35), alpha);
    return;
  }

  // Part 0: Main Koi Body — Body-Conforming Luminous Pearl/Scale-Dot Lattice!
  float t = vLocal.x; // 0 = snout, 1 = tail peduncle
  float y = vLocal.y; // -1..+1 across width

  float edgeAA = 1.0 - smoothstep(0.80 - depthFog * 0.10, 1.0, abs(y));
  if (edgeAA <= 0.01) discard;

  // 3D Volumetric Top-Side Lighting (bright sunlit upper dorsal curve, shaded lower belly!)
  float lightSide = clamp(0.68 + 0.38 * (1.0 - y * y) + 0.18 * y, 0.38, 1.15);
  vec3 pearlWhite = mix(vec3(1.0, 0.98, 0.94), vec3(0.84, 0.90, 0.92), t * 0.65);

  // Vivid Kohaku orange-vermilion markings (matching reference rich fiery-orange dorsal + gleaming white nose & cheeks!)
  float redMask = 0.0;
  if (vFish < 0.5) {
    redMask = max(redMask, spotField(vec2(t, y), vec2(0.18, 0.08), vec2(0.14, 0.78)));
    redMask = max(redMask, spotField(vec2(t, y), vec2(0.42, -0.05), vec2(0.17, 0.88)));
    redMask = max(redMask, spotField(vec2(t, y), vec2(0.68, 0.10), vec2(0.14, 0.82)));
    redMask = max(redMask, spotField(vec2(t, y), vec2(0.88, -0.02), vec2(0.10, 0.72)));
  } else {
    redMask = max(redMask, spotField(vec2(t, y), vec2(0.16, 0.04), vec2(0.13, 0.82)));
    redMask = max(redMask, spotField(vec2(t, y), vec2(0.44, -0.08), vec2(0.16, 0.86)));
    redMask = max(redMask, spotField(vec2(t, y), vec2(0.74, 0.06), vec2(0.13, 0.76)));
  }
  // Keep gleaming pearl-white snout tip (t < 0.065) just like the reference image!
  redMask *= smoothstep(0.045, 0.10, t);

  vec3 kohakuOrange = mix(vec3(0.90, 0.24, 0.06), vec3(1.0, 0.48, 0.12), clamp(0.45 + 0.55 * (1.0 - y * y), 0.0, 1.0));
  vec3 baseCol = mix(pearlWhite, kohakuOrange, clamp(redMask, 0.0, 1.0)) * lightSide;

  // Glossy dark cheek-side eyes tucked naturally along head margin (t ~ 0.095, |y| ~ 0.74)
  float eyeDistL = length(vec2((t - 0.095) * 1.15, (y - 0.74) * 0.22));
  float eyeDistR = length(vec2((t - 0.095) * 1.15, (y + 0.74) * 0.22));
  float eyeMin = min(eyeDistL, eyeDistR);
  float eyePupil = 1.0 - smoothstep(0.015, 0.028, eyeMin);

  // Body-Conforming Staggered Pearl/Scale-Dot Matrix!
  // Dots curve organically with the spine (t) and across the rounded body cylinder (asin(y))!
  float curvedY = asin(clamp(y * 0.96, -0.98, 0.98)) * 0.6366; // cylindrical wrap [-1..1]
  vec2 scaleGrid = vec2(t * 24.0, (curvedY * 0.5 + 0.5) * 6.5);
  float rowStagger = mod(floor(scaleGrid.y), 2.0) * 0.5;
  vec2 cellUv = fract(vec2(scaleGrid.x + rowStagger, scaleGrid.y)) - 0.5;
  float distToDot = length(cellUv);

  float lum = dot(baseCol, vec3(0.299, 0.587, 0.114));
  float dotR = mix(0.36, 0.50, clamp(lum * 0.95, 0.0, 1.0));
  float dotCore = 1.0 - smoothstep(dotR * 0.30, dotR, distToDot);
  float dotSpec = exp(-distToDot * distToDot * 12.0) * 0.42 * smoothstep(0.45, 1.1, lightSide);

  // Rich luminous underwater koi volume + subtle body-conforming pearl scale shimmer (zero double-quantization dimness!)
  vec3 dotBody = baseCol * (0.74 + dotCore * 0.58) + vec3(1.0, 0.96, 0.88) * dotSpec;
  dotBody = mix(dotBody, vec3(0.03, 0.05, 0.06), eyePupil * 0.94);

  // Underwater absorption / depth veiling
  vec3 waterVeil = mix(uWaterMid * 1.50, uCausticTint * 0.70, 0.28);
  dotBody = mix(dotBody, waterVeil, depthFog * 0.85);

  float outAlpha = edgeAA * (0.88 + dotCore * 0.12) * baseAlpha;
  fragColor = vec4(dotBody, outAlpha);
}
`;

function koiWidthProfile(t) {
  if (t < 0.15) {
    // Plump, rounded koi head swelling smoothly into full cheeks
    const u = t / 0.15;
    return 0.46 + 0.44 * Math.sin(u * Math.PI * 0.5);
  }
  if (t < 0.32) {
    // Muscular Nishikigoi shoulders
    const u = (t - 0.15) / 0.17;
    return 0.90 + 0.12 * Math.sin(u * Math.PI * 0.65);
  }
  const u = (t - 0.32) / 0.68;
  return Math.max(0.15, Math.pow(1.0 - u, 1.38) * 0.98 + 0.09 * Math.sin(u * Math.PI));
}

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

class KoiAgent {
  constructor(cfg, fishIndex) {
    Object.assign(this, cfg);
    this.fishIndex = fishIndex;
    this.lastRippleTime = cfg.initialRippleOffset ?? -2.0;
    this.spine = [];
  }

  _pathPos(u) {
    const a = this.phase + u * this.dir;
    return {
      x: this.cx + Math.cos(a) * this.rx + Math.sin(a * 2.0) * this.rx * 0.05,
      y: this.cy + Math.sin(a) * this.ry + Math.cos(a * 1.5) * this.ry * 0.04
    };
  }

  update(t, aspect) {
    const uHead = t * this.speed;
    const bodyLen = this.lengthFrac;
    const segLen = bodyLen / (SPINE_SEGMENTS - 1);

    const pHead = this._pathPos(uHead);
    const pAhead = this._pathPos(uHead + 0.025);
    const hx = pHead.x * aspect;
    const hy = pHead.y;
    const heading = Math.atan2(pAhead.y - hy, pAhead.x * aspect - hx);

    const spinePts = [{ x: hx, y: hy, heading }];
    let uCur = uHead;

    for (let i = 1; i < SPINE_SEGMENTS; i++) {
      const frac = i / (SPINE_SEGMENTS - 1);
      const prev = spinePts[i - 1];

      const pBack = this._pathPos(uCur - 0.04);
      const dPath = Math.hypot(pBack.x * aspect - prev.x, pBack.y - prev.y) || 1e-4;
      uCur -= (segLen / dPath) * 0.04;
      const target = this._pathPos(uCur);

      const desiredBack = Math.atan2(target.y - prev.y, target.x * aspect - prev.x);
      const prevBack = prev.heading + Math.PI;
      const swimSway = Math.sin(t * this.swimFreq - frac * 4.2 + this.phase) * 0.050 * Math.pow(frac, 1.35);

      const rawDelta = wrapAngle(desiredBack - prevBack);
      const clampedDelta = Math.max(-MAX_SEG_BEND, Math.min(MAX_SEG_BEND, rawDelta)) + swimSway;
      const actualBack = prevBack + clampedDelta;

      spinePts.push({
        x: prev.x + Math.cos(actualBack) * segLen,
        y: prev.y + Math.sin(actualBack) * segLen,
        heading: actualBack - Math.PI
      });
    }

    this.spine = spinePts.map((p, i) => {
      const frac = i / (SPINE_SEGMENTS - 1);
      const tx = Math.cos(p.heading);
      const ty = Math.sin(p.heading);
      return {
        x: p.x,
        y: p.y,
        tx,
        ty,
        nx: -ty,
        ny: tx,
        frac,
        halfW: koiWidthProfile(frac) * bodyLen * this.widthFrac
      };
    });

    const thrust = this.spine[12];
    return {
      uvX: thrust.x / aspect,
      uvY: thrust.y,
      shouldEmitRipple: (t - this.lastRippleTime) >= this.rippleInterval
    };
  }
}

export class KoiGLRenderer {
  constructor(gl) {
    this.gl = gl;
    this.prog = createProgram(gl, KOI_VERT, KOI_FRAG);

    this.fish = [
      new KoiAgent({
        lengthFrac: 0.285,
        widthFrac: 0.112,
        cx: 0.47,
        cy: 0.44,
        rx: 0.24,
        ry: 0.16,
        speed: 0.142,
        phase: 0.85,
        dir: 1,
        swimFreq: 2.8,
        rippleInterval: 4.8,
        initialRippleOffset: -3.2
      }, 0),
      new KoiAgent({
        lengthFrac: 0.242,
        widthFrac: 0.110,
        cx: 0.55,
        cy: 0.56,
        rx: 0.21,
        ry: 0.14,
        speed: 0.160,
        phase: 3.95,
        dir: -1,
        swimFreq: 3.1,
        rippleInterval: 5.5,
        initialRippleOffset: -1.4
      }, 1)
    ];

    this.maxVerts = 1600;
    this.data = new Float32Array(this.maxVerts * 6);
    this.vertCount = 0;

    this.vao = gl.createVertexArray();
    this.vbo = gl.createBuffer();
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);

    const stride = 6 * 4;
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, stride, 8);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, stride, 16);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 1, gl.FLOAT, false, stride, 20);

    gl.bindVertexArray(null);
  }

  _pushTri(x1, y1, u1, v1, x2, y2, u2, v2, x3, y3, u3, v3, part, fishIdx) {
    if (this.vertCount + 3 > this.maxVerts) return;
    let o = this.vertCount * 6;
    const d = this.data;
    d[o++] = x1; d[o++] = y1; d[o++] = u1; d[o++] = v1; d[o++] = part; d[o++] = fishIdx;
    d[o++] = x2; d[o++] = y2; d[o++] = u2; d[o++] = v2; d[o++] = part; d[o++] = fishIdx;
    d[o++] = x3; d[o++] = y3; d[o++] = u3; d[o++] = v3; d[o++] = part; d[o++] = fishIdx;
    this.vertCount += 3;
  }

  _buildFishMesh(f, t, aspect) {
    const sp = f.spine;
    const fi = f.fishIndex;
    const invA = 1.0 / aspect;

    const addBodyStrip = (part, offsetX, offsetY, expand) => {
      const h = sp[0];
      const snoutR = h.halfW * expand;
      const headAng = Math.atan2(h.ty, h.tx);
      const fanSteps = 6;
      for (let k = 0; k < fanSteps; k++) {
        const a0 = headAng - Math.PI * 0.5 + (k / fanSteps) * Math.PI;
        const a1 = headAng - Math.PI * 0.5 + ((k + 1) / fanSteps) * Math.PI;
        const c0 = Math.cos(a0 - headAng);
        const s0 = Math.sin(a0 - headAng);
        const c1 = Math.cos(a1 - headAng);
        const s1 = Math.sin(a1 - headAng);
        const lx0 = Math.cos(headAng) * (c0 * snoutR * 0.65) - Math.sin(headAng) * (s0 * snoutR);
        const ly0 = Math.sin(headAng) * (c0 * snoutR * 0.65) + Math.cos(headAng) * (s0 * snoutR);
        const lx1 = Math.cos(headAng) * (c1 * snoutR * 0.65) - Math.sin(headAng) * (s1 * snoutR);
        const ly1 = Math.sin(headAng) * (c1 * snoutR * 0.65) + Math.cos(headAng) * (s1 * snoutR);
        this._pushTri(
          (h.x + offsetX) * invA, h.y + offsetY, 0.03, 0.0,
          (h.x + lx0 + offsetX) * invA, h.y + ly0 + offsetY, 0.005, s0,
          (h.x + lx1 + offsetX) * invA, h.y + ly1 + offsetY, 0.005, s1,
          part, fi
        );
      }

      for (let i = 0; i < sp.length - 1; i++) {
        const a = sp[i];
        const b = sp[i + 1];
        const alx = (a.x + a.nx * a.halfW * expand + offsetX) * invA;
        const aly = a.y + a.ny * a.halfW * expand + offsetY;
        const arx = (a.x - a.nx * a.halfW * expand + offsetX) * invA;
        const ary = a.y - a.ny * a.halfW * expand + offsetY;
        const blx = (b.x + b.nx * b.halfW * expand + offsetX) * invA;
        const bly = b.y + b.ny * b.halfW * expand + offsetY;
        const brx = (b.x - b.nx * b.halfW * expand + offsetX) * invA;
        const bry = b.y - b.ny * b.halfW * expand + offsetY;
        this._pushTri(alx, aly, a.frac, 1.0, arx, ary, a.frac, -1.0, blx, bly, b.frac, 1.0, part, fi);
        this._pushTri(arx, ary, a.frac, -1.0, brx, bry, b.frac, -1.0, blx, bly, b.frac, 1.0, part, fi);
      }
    };

    // 1. Deep offset cast shadow on pond floor -> gives real 3D floating depth!
    addBodyStrip(2.0, 0.006, -0.026, 1.14);

    // 2. Tiny delicate glowing barbels (鱼须) curving from mouth corners
    const head = sp[0];
    const headAng = Math.atan2(head.ty, head.tx);
    for (const side of [-1, 1]) {
      const bx = head.x + head.tx * head.halfW * 0.42 + head.nx * side * head.halfW * 0.62;
      const by = head.y + head.ty * head.halfW * 0.42 + head.ny * side * head.halfW * 0.62;
      const barbAng = headAng + side * 0.92;
      const barbLen = head.halfW * 0.72;
      const barbW = head.halfW * 0.14;
      const ex = bx + Math.cos(barbAng) * barbLen;
      const ey = by + Math.sin(barbAng) * barbLen;
      const bnx = -Math.sin(barbAng) * barbW;
      const bny = Math.cos(barbAng) * barbW;
      this._pushTri(
        (bx + bnx) * invA, by + bny, 0.0, 1.0,
        (bx - bnx) * invA, by - bny, 0.0, -1.0,
        ex * invA, ey, 1.0, 0.0,
        4.0, fi
      );
    }

    // 3. Translucent dotted fan-ray pectoral & pelvic fins
    const addSideFin = (segIdx, side, finLen, finSpread, swingAmp) => {
      const s = sp[segIdx];
      const baseAng = Math.atan2(s.ty, s.tx);
      const swing = Math.sin(t * f.swimFreq * 0.8 + side * 0.35 + f.phase) * swingAmp;
      const finAng = baseAng + side * (Math.PI * 0.64 + swing);
      const bx = s.x + s.nx * side * s.halfW * 0.40;
      const by = s.y + s.ny * side * s.halfW * 0.40;
      const tipX = bx + Math.cos(finAng) * finLen;
      const tipY = by + Math.sin(finAng) * finLen;
      const midX = bx + Math.cos(finAng + side * finSpread * 0.55) * finLen * 0.94;
      const midY = by + Math.sin(finAng + side * finSpread * 0.55) * finLen * 0.94;
      const backX = s.x - s.tx * finLen * 0.55 + s.nx * side * s.halfW * 0.35;
      const backY = s.y - s.ty * finLen * 0.55 + s.ny * side * s.halfW * 0.35;

      this._pushTri(bx * invA, by, 0.0, 0.0, tipX * invA, tipY, 0.95, 0.90, midX * invA, midY, 0.92, 0.0, 1.0, fi);
      this._pushTri(bx * invA, by, 0.0, 0.0, midX * invA, midY, 0.92, 0.0, backX * invA, backY, 0.55, -0.90, 1.0, fi);
    };

    const sw = sp[4].halfW;
    addSideFin(4, 1, sw * 2.65, 0.64, 0.11);
    addSideFin(4, -1, sw * 2.65, 0.64, 0.11);
    addSideFin(10, 1, sw * 1.25, 0.54, 0.08);
    addSideFin(10, -1, sw * 1.25, 0.54, 0.08);

    // 4. Seamlessly connected flowing dotted forked caudal tail fin
    const root = sp[sp.length - 3];
    const tail = sp[sp.length - 1];
    const tailAng = Math.atan2(tail.y - root.y, tail.x - root.x);
    const tailLen = f.lengthFrac * 0.30;
    const flick = Math.sin(t * f.swimFreq - 4.6 + f.phase) * 0.15;

    const rL = { x: (root.x + root.nx * root.halfW * 0.95) * invA, y: root.y + root.ny * root.halfW * 0.95 };
    const rR = { x: (root.x - root.nx * root.halfW * 0.95) * invA, y: root.y - root.ny * root.halfW * 0.95 };
    const l1 = { x: (tail.x + Math.cos(tailAng + 0.44 + flick) * tailLen) * invA, y: tail.y + Math.sin(tailAng + 0.44 + flick) * tailLen };
    const l2 = { x: (tail.x + Math.cos(tailAng - 0.44 + flick) * tailLen) * invA, y: tail.y + Math.sin(tailAng - 0.44 + flick) * tailLen };
    const fk = { x: (tail.x + Math.cos(tailAng + flick * 0.65) * tailLen * 0.46) * invA, y: tail.y + Math.sin(tailAng + flick * 0.65) * tailLen * 0.46 };

    this._pushTri(rL.x, rL.y, 0.0, 0.75, l1.x, l1.y, 1.0, 0.95, fk.x, fk.y, 0.55, 0.0, 1.0, fi);
    this._pushTri(rL.x, rL.y, 0.0, 0.75, fk.x, fk.y, 0.55, 0.0, rR.x, rR.y, 0.0, -0.75, 1.0, fi);
    this._pushTri(rR.x, rR.y, 0.0, -0.75, fk.x, fk.y, 0.55, 0.0, l2.x, l2.y, 1.0, -0.95, 1.0, fi);

    // 5. Main Koi Body (luminous pearl/scale-dot lattice!)
    addBodyStrip(0.0, 0.0, 0.0, 1.0);

    // 6. Subtle translucent dotted Dorsal Fin crest along mid-back (segments 5..12)
    for (let i = 5; i < 12; i++) {
      const a = sp[i];
      const b = sp[i + 1];
      const dWave = Math.sin(t * f.swimFreq - a.frac * 4.2 + f.phase) * sw * 0.42;
      const dWaveB = Math.sin(t * f.swimFreq - b.frac * 4.2 + f.phase) * sw * 0.42;
      const hA = sw * 0.68 * Math.sin(((i - 5) / 7) * Math.PI);
      const hB = sw * 0.68 * Math.sin(((i - 4) / 7) * Math.PI);
      this._pushTri(
        a.x * invA, a.y, 0.0, (i - 5) / 7 * 2 - 1,
        b.x * invA, b.y, 0.0, (i - 4) / 7 * 2 - 1,
        (a.x + a.nx * (hA + dWave)) * invA, a.y + a.ny * (hA + dWave), 0.95, (i - 5) / 7 * 2 - 1,
        3.0, fi
      );
      this._pushTri(
        b.x * invA, b.y, 0.0, (i - 4) / 7 * 2 - 1,
        (b.x + b.nx * (hB + dWaveB)) * invA, b.y + b.ny * (hB + dWaveB), 0.95, (i - 4) / 7 * 2 - 1,
        (a.x + a.nx * (hA + dWave)) * invA, a.y + a.ny * (hA + dWave), 0.95, (i - 5) / 7 * 2 - 1,
        3.0, fi
      );
    }
  }

  render(t, aspect, season, seasonId, onWakeRipple) {
    const gl = this.gl;
    const speedMult = seasonId === 'winter' ? 0.50 : 1.0;
    this.vertCount = 0;

    for (const f of this.fish) {
      const info = f.update(t * speedMult, aspect);
      this._buildFishMesh(f, t * speedMult, aspect);
      if (info.shouldEmitRipple && onWakeRipple) {
        f.lastRippleTime = t * speedMult;
        onWakeRipple(info.uvX, info.uvY, seasonId === 'winter' ? 0.28 : 0.48);
      }
    }

    if (this.vertCount === 0) return;

    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data.subarray(0, this.vertCount * 6));

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    gl.useProgram(this.prog.program);
    const u = this.prog.uniforms;
    gl.uniform1f(u.uTime, t);
    gl.uniform3fv(u.uWaterMid, season.waterMid);
    gl.uniform3fv(u.uCausticTint, season.causticTint);
    gl.uniform1f(u.uKoiDepthFog, season.koiDepthFog);
    gl.uniform1f(u.uWinterMode, seasonId === 'winter' ? 1.0 : 0.0);

    gl.drawArrays(gl.TRIANGLES, 0, this.vertCount);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
  }

  destroy() {
    const gl = this.gl;
    gl.deleteProgram(this.prog.program);
    gl.deleteBuffer(this.vbo);
    gl.deleteVertexArray(this.vao);
  }
}
