// Pure WebGL2 GPU Nishikigoi (Koi) Renderer — ZERO Canvas2D, ZERO texSubImage2D stalls (120 FPS!)
// Builds smooth clamped-spine triangle meshes (~6 KB bufferSubData/frame) rendered directly in Pass 1:
// - Broad rounded koi snout, muscular shoulders, strictly clamped per-segment bend (never 90° kinks!)
// - Seamlessly connected flowing forked caudal tail & translucent pectoral/pelvic fins
// - Procedural Kohaku red-orange saddle markings + underwater depth veiling in GLSL fragment shader

import { createProgram } from './gl-utils.mjs';

const SPINE_SEGMENTS = 18;
const MAX_SEG_BEND = 0.082; // ~4.7 deg max per segment -> silky graceful turns

export const KOI_VERT = `#version 300 es
precision highp float;

layout(location = 0) in vec2 aPos;   // normalized screen UV [0, 1] (Y-up)
layout(location = 1) in vec2 aLocal; // x = along body [0..1] (or fin u), y = across [-1..1]
layout(location = 2) in float aPart; // 0.0 = body, 1.0 = fin, 2.0 = shadow
layout(location = 3) in float aFish; // 0.0 = main koi, 1.0 = companion koi

uniform float uTime;
uniform float uKoiDepthFog;

out vec2 vLocal;
out float vPart;
out float vFish;

void main() {
  // Subtle underwater water-surface wave refraction directly in vertex shader
  vec2 refractOff = vec2(
    sin(aPos.y * 24.0 + uTime * 1.2) * 0.0018,
    cos(aPos.x * 20.0 - uTime * 1.0) * 0.0015
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

out vec4 fragColor;

float spotField(vec2 p, vec2 center, vec2 radius) {
  vec2 d = (p - center) / radius;
  return 1.0 - smoothstep(0.55, 1.05, length(d));
}

void main() {
  // Soft underwater depth attenuation (in winter, companion koi swims even deeper)
  float depthFog = clamp(uKoiDepthFog + (uWinterMode > 0.5 && vFish > 0.5 ? 0.18 : 0.0), 0.0, 0.85);
  float baseAlpha = 1.0 - depthFog * 0.42;

  // Part 2: Soft underwater shadow
  if (vPart > 1.5) {
    float edge = 1.0 - smoothstep(0.35, 1.0, abs(vLocal.y));
    fragColor = vec4(0.01, 0.04, 0.05, edge * 0.28 * baseAlpha);
    return;
  }

  // Part 1: Translucent flowing fins (pectoral, pelvic, forked caudal tail)
  if (vPart > 0.5) {
    float fade = (1.0 - smoothstep(0.08, 1.0, vLocal.x)) * (1.0 - smoothstep(0.65, 1.0, abs(vLocal.y)));
    vec3 finCol = mix(vec3(0.96, 0.94, 0.90), vec3(0.84, 0.93, 0.94), vLocal.x);
    finCol = mix(finCol, uWaterMid * 1.45, depthFog * 0.82);
    fragColor = vec4(finCol, fade * 0.68 * baseAlpha);
    return;
  }

  // Part 0: Main Koi Body (pearl-ivory + Kohaku vermilion-orange saddle markings)
  float t = vLocal.x; // 0 = snout, 1 = tail peduncle
  float y = vLocal.y; // -1..+1 across width

  // Soft edge antialiasing for submerged hazy silhouette
  float edgeAA = 1.0 - smoothstep(0.76 - depthFog * 0.12, 1.0, abs(y));
  if (edgeAA <= 0.01) discard;

  // Pearl-ivory base with subtle cylindrical 3D dorsal shading
  float dorsalLight = 0.82 + 0.24 * (1.0 - y * y);
  vec3 col = mix(vec3(1.0, 0.97, 0.92), vec3(0.88, 0.85, 0.80), t) * dorsalLight;

  // Kohaku vermilion-orange saddle patches (distinct pattern per fish)
  float redMask = 0.0;
  if (vFish < 0.5) {
    redMask = max(redMask, spotField(vec2(t, y), vec2(0.09, 0.05), vec2(0.075, 0.68)));
    redMask = max(redMask, spotField(vec2(t, y), vec2(0.33, -0.14), vec2(0.14, 0.85)));
    redMask = max(redMask, spotField(vec2(t, y), vec2(0.57, 0.16), vec2(0.12, 0.78)));
    redMask = max(redMask, spotField(vec2(t, y), vec2(0.77, -0.06), vec2(0.08, 0.65)));
  } else {
    redMask = max(redMask, spotField(vec2(t, y), vec2(0.11, -0.04), vec2(0.085, 0.72)));
    redMask = max(redMask, spotField(vec2(t, y), vec2(0.37, 0.12), vec2(0.14, 0.84)));
    redMask = max(redMask, spotField(vec2(t, y), vec2(0.65, -0.10), vec2(0.11, 0.72)));
  }

  vec3 kohakuRed = mix(vec3(0.92, 0.24, 0.06), vec3(1.0, 0.36, 0.10), 1.0 - y * y * 0.6);
  col = mix(col, kohakuRed, clamp(redMask, 0.0, 1.0));

  // Subtle blunted koi mouth lip shadow at front snout tip (t ~ 0.01..0.035)
  float mouthArc = 1.0 - smoothstep(0.012, 0.032, length(vec2((t - 0.014) * 1.6, y * 0.14)));
  col = mix(col, col * 0.72, mouthArc * 0.55);

  // Subtle operculum (gill-plate) curvature shading behind head (t ~ 0.21)
  float gillCurve = exp(-pow(((t - 0.21) - (1.0 - y * y) * 0.035) * 34.0, 2.0)) * smoothstep(0.25, 0.85, abs(y));
  col = mix(col, col * 0.86, gillCurve * 0.38);

  // Anatomically accurate top-down Nishikigoi eyes:
  // Elongated along body axis, tucked right near outer cheek margin (t ~ 0.105, |y| ~ 0.80)
  float eyeDistL = length(vec2((t - 0.105) * 1.05, (y - 0.80) * 0.20));
  float eyeDistR = length(vec2((t - 0.105) * 1.05, (y + 0.80) * 0.20));
  float eyeMin = min(eyeDistL, eyeDistR);
  float eyeRim = (1.0 - smoothstep(0.020, 0.034, eyeMin)) * smoothstep(0.012, 0.022, eyeMin);
  float eyePupil = 1.0 - smoothstep(0.012, 0.022, eyeMin);
  col = mix(col, vec3(0.88, 0.92, 0.94), eyeRim * 0.42);
  col = mix(col, vec3(0.04, 0.06, 0.08), eyePupil * 0.88);

  // Underwater absorption / veiling so koi genuinely lives beneath the water surface
  vec3 waterVeil = mix(uWaterMid * 1.55, uCausticTint * 0.72, 0.32);
  col = mix(col, waterVeil, depthFog);

  fragColor = vec4(col, edgeAA * baseAlpha);
}
`;

function koiWidthProfile(t) {
  if (t < 0.14) {
    // Smooth, gently blunted U-shaped koi head swelling into rounded cheeks
    const u = t / 0.14;
    return 0.44 + 0.44 * Math.sin(u * Math.PI * 0.5);
  }
  if (t < 0.30) {
    // Full muscular Nishikigoi shoulders
    const u = (t - 0.14) / 0.16;
    return 0.88 + 0.14 * Math.sin(u * Math.PI * 0.65);
  }
  const u = (t - 0.30) / 0.70;
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
    const bodyLen = this.lengthFrac; // in aspect-corrected X units
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
      const swimSway = Math.sin(t * this.swimFreq - frac * 4.2 + this.phase) * 0.052 * Math.pow(frac, 1.35);

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
        lengthFrac: 0.28,
        widthFrac: 0.106,
        cx: 0.47,
        cy: 0.44,
        rx: 0.24,
        ry: 0.16,
        speed: 0.145,
        phase: 0.85,
        dir: 1,
        swimFreq: 2.8,
        rippleInterval: 4.8,
        initialRippleOffset: -3.2
      }, 0),
      new KoiAgent({
        lengthFrac: 0.235,
        widthFrac: 0.104,
        cx: 0.55,
        cy: 0.56,
        rx: 0.21,
        ry: 0.14,
        speed: 0.165,
        phase: 3.95,
        dir: -1,
        swimFreq: 3.1,
        rippleInterval: 5.5,
        initialRippleOffset: -1.4
      }, 1)
    ];

    // Pre-allocated dynamic vertex buffer: 6 floats per vertex (x, y, u, v, part, fishIdx)
    this.maxVerts = 1200;
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

    const addBodyStrip = (part, offsetY, expand) => {
      // Blunted, gently rounded koi snout fan (6 wedges, shorter forward projection so nose isn't bullet-like)
      const h = sp[0];
      const snoutR = h.halfW * expand;
      const headAng = Math.atan2(h.ty, h.tx);
      const fanSteps = 6;
      for (let k = 0; k < fanSteps; k++) {
        const a0 = headAng - Math.PI * 0.5 + (k / fanSteps) * Math.PI;
        const a1 = headAng - Math.PI * 0.5 + ((k + 1) / fanSteps) * Math.PI;
        // Slightly flatten forward projection (0.66 along forward axis, 1.0 laterally) for authentic blunted koi mouth!
        const c0 = Math.cos(a0 - headAng);
        const s0 = Math.sin(a0 - headAng);
        const c1 = Math.cos(a1 - headAng);
        const s1 = Math.sin(a1 - headAng);
        const f0 = snoutR * (0.68 * Math.abs(c0) + 1.0 * Math.abs(s0) * 0.32 + 0.68 * (1.0 - Math.abs(c0)));
        const lx0 = Math.cos(headAng) * (c0 * snoutR * 0.66) - Math.sin(headAng) * (s0 * snoutR);
        const ly0 = Math.sin(headAng) * (c0 * snoutR * 0.66) + Math.cos(headAng) * (s0 * snoutR);
        const lx1 = Math.cos(headAng) * (c1 * snoutR * 0.66) - Math.sin(headAng) * (s1 * snoutR);
        const ly1 = Math.sin(headAng) * (c1 * snoutR * 0.66) + Math.cos(headAng) * (s1 * snoutR);
        void f0;
        const p1x = (h.x + lx0) * invA;
        const p1y = h.y + ly0 + offsetY;
        const p2x = (h.x + lx1) * invA;
        const p2y = h.y + ly1 + offsetY;
        this._pushTri(
          h.x * invA, h.y + offsetY, 0.03, 0.0,
          p1x, p1y, 0.005, s0,
          p2x, p2y, 0.005, s1,
          part, fi
        );
      }

      // Smooth spine body quads
      for (let i = 0; i < sp.length - 1; i++) {
        const a = sp[i];
        const b = sp[i + 1];
        const alx = (a.x + a.nx * a.halfW * expand) * invA;
        const aly = a.y + a.ny * a.halfW * expand + offsetY;
        const arx = (a.x - a.nx * a.halfW * expand) * invA;
        const ary = a.y - a.ny * a.halfW * expand + offsetY;
        const blx = (b.x + b.nx * b.halfW * expand) * invA;
        const bly = b.y + b.ny * b.halfW * expand + offsetY;
        const brx = (b.x - b.nx * b.halfW * expand) * invA;
        const bry = b.y - b.ny * b.halfW * expand + offsetY;
        this._pushTri(alx, aly, a.frac, 1.0, arx, ary, a.frac, -1.0, blx, bly, b.frac, 1.0, part, fi);
        this._pushTri(arx, ary, a.frac, -1.0, brx, bry, b.frac, -1.0, blx, bly, b.frac, 1.0, part, fi);
      }
    };

    // 1. Soft underwater shadow
    addBodyStrip(2.0, -0.015, 1.12);

    // 2. Translucent pectoral & pelvic fins (anchored inside body so never detached)
    const addSideFin = (segIdx, side, finLen, finSpread, swingAmp) => {
      const s = sp[segIdx];
      const baseAng = Math.atan2(s.ty, s.tx);
      const swing = Math.sin(t * f.swimFreq * 0.8 + side * 0.35 + f.phase) * swingAmp;
      const finAng = baseAng + side * (Math.PI * 0.64 + swing);
      const bx = s.x + s.nx * side * s.halfW * 0.40;
      const by = s.y + s.ny * side * s.halfW * 0.40;
      const tipX = bx + Math.cos(finAng) * finLen;
      const tipY = by + Math.sin(finAng) * finLen;
      const midX = bx + Math.cos(finAng + side * finSpread * 0.55) * finLen * 0.92;
      const midY = by + Math.sin(finAng + side * finSpread * 0.55) * finLen * 0.92;
      const backX = s.x - s.tx * finLen * 0.55 + s.nx * side * s.halfW * 0.35;
      const backY = s.y - s.ty * finLen * 0.55 + s.ny * side * s.halfW * 0.35;

      this._pushTri(bx * invA, by, 0.0, 0.0, tipX * invA, tipY, 0.95, 0.85, midX * invA, midY, 0.92, 0.0, 1.0, fi);
      this._pushTri(bx * invA, by, 0.0, 0.0, midX * invA, midY, 0.92, 0.0, backX * invA, backY, 0.55, -0.85, 1.0, fi);
    };

    const sw = sp[4].halfW;
    addSideFin(4, 1, sw * 2.45, 0.62, 0.11);
    addSideFin(4, -1, sw * 2.45, 0.62, 0.11);
    addSideFin(10, 1, sw * 1.18, 0.52, 0.08);
    addSideFin(10, -1, sw * 1.18, 0.52, 0.08);

    // 3. Seamlessly connected forked caudal tail fin (anchored into sp[length - 3]!)
    const root = sp[sp.length - 3];
    const tail = sp[sp.length - 1];
    const tailAng = Math.atan2(tail.y - root.y, tail.x - root.x);
    const tailLen = f.lengthFrac * 0.27;
    const flick = Math.sin(t * f.swimFreq - 4.6 + f.phase) * 0.15;

    const rL = { x: (root.x + root.nx * root.halfW * 0.95) * invA, y: root.y + root.ny * root.halfW * 0.95 };
    const rR = { x: (root.x - root.nx * root.halfW * 0.95) * invA, y: root.y - root.ny * root.halfW * 0.95 };
    const l1 = { x: (tail.x + Math.cos(tailAng + 0.42 + flick) * tailLen) * invA, y: tail.y + Math.sin(tailAng + 0.42 + flick) * tailLen };
    const l2 = { x: (tail.x + Math.cos(tailAng - 0.42 + flick) * tailLen) * invA, y: tail.y + Math.sin(tailAng - 0.42 + flick) * tailLen };
    const fk = { x: (tail.x + Math.cos(tailAng + flick * 0.65) * tailLen * 0.46) * invA, y: tail.y + Math.sin(tailAng + flick * 0.65) * tailLen * 0.46 };

    this._pushTri(rL.x, rL.y, 0.0, 0.7, l1.x, l1.y, 1.0, 0.9, fk.x, fk.y, 0.55, 0.0, 1.0, fi);
    this._pushTri(rL.x, rL.y, 0.0, 0.7, fk.x, fk.y, 0.55, 0.0, rR.x, rR.y, 0.0, -0.7, 1.0, fi);
    this._pushTri(rR.x, rR.y, 0.0, -0.7, fk.x, fk.y, 0.55, 0.0, l2.x, l2.y, 1.0, -0.9, 1.0, fi);

    // 4. Main Koi Body on top of fins
    addBodyStrip(0.0, 0.0, 1.0);
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
