// Pure WebGL2 GPU Ambient Particles + Video-Matched Stardust Ribbon/Vortex Renderer
// ZERO Canvas2D, ZERO texSubImage2D stalls -> guaranteed 120+ FPS!

import { createProgram } from './gl-utils.mjs';

const PARTICLE_VERT = `#version 300 es
precision highp float;

layout(location = 0) in vec2 aPos;   // UV [0..1] (Y-up)
layout(location = 1) in vec4 aColor; // rgba
layout(location = 2) in float aSize; // point size in px
layout(location = 3) in float aKind; // 0 = soft glow/snow, 1 = petal, 2 = maple leaf

out vec4 vColor;
out float vKind;

void main() {
  gl_Position = vec4(aPos * 2.0 - 1.0, 0.0, 1.0);
  gl_PointSize = aSize;
  vColor = aColor;
  vKind = aKind;
}
`;

const PARTICLE_FRAG = `#version 300 es
precision highp float;

in vec4 vColor;
in float vKind;

out vec4 fragColor;

void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float r = length(p);

  if (vKind < 0.5) {
    // Soft glowing stardust / snow / firefly spark
    if (r > 1.0) discard;
    float core = exp(-r * r * 5.2);
    float halo = exp(-r * r * 1.8) * 0.45;
    fragColor = vec4(vColor.rgb, vColor.a * clamp(core + halo, 0.0, 1.0));
    return;
  }

  if (vKind < 1.5) {
    // Sakura petal teardrop shape
    vec2 q = vec2(p.x * 1.1, p.y * 1.65);
    float d = length(q);
    if (d > 1.0) discard;
    float a = (1.0 - smoothstep(0.65, 1.0, d)) * vColor.a;
    vec3 col = mix(vColor.rgb, vec3(1.0, 0.94, 0.97), (1.0 - d) * 0.45);
    fragColor = vec4(col, a);
    return;
  }

  // Palmate 5-lobed autumn maple leaf SDF in point sprite
  float ang = atan(p.y, p.x);
  float lobe = 0.55 + 0.38 * pow(max(0.0, cos((ang + 1.5708) * 2.5)), 1.6);
  if (r > lobe) discard;
  float a = (1.0 - smoothstep(lobe * 0.72, lobe, r)) * vColor.a;
  vec3 col = mix(vec3(1.0, 0.78, 0.28), vColor.rgb, smoothstep(0.0, lobe, r));
  fragColor = vec4(col, a);
}
`;

function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const SEASON_DUST_RGB = {
  spring: [1.0, 0.66, 0.84],
  summer: [0.56, 1.0, 0.80],
  autumn: [1.0, 0.64, 0.24],
  winter: [0.76, 0.92, 1.0]
};

export class ParticlesGLRenderer {
  constructor(gl) {
    this.gl = gl;
    this.prog = createProgram(gl, PARTICLE_VERT, PARTICLE_FRAG);
    this.seasonId = '';
    this.ambient = [];
    this.gustBoost = 0;
    this.transitionFX = null;

    this.maxPoints = 420;
    this.data = new Float32Array(this.maxPoints * 8); // x, y, r, g, b, a, size, kind
    this.count = 0;

    this.vao = gl.createVertexArray();
    this.vbo = gl.createBuffer();
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);

    const stride = 8 * 4;
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, stride, 8);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, stride, 24);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 1, gl.FLOAT, false, stride, 28);
    gl.bindVertexArray(null);
  }

  _initSeason(seasonId) {
    this.seasonId = seasonId;
    const rand = makeRng(
      seasonId === 'spring' ? 101 : seasonId === 'autumn' ? 202 : seasonId === 'winter' ? 303 : 404
    );
    this.ambient = [];

    if (seasonId === 'spring') {
      for (let i = 0; i < 26; i++) {
        const floating = i < 8;
        this.ambient.push({
          kind: 1,
          x: rand(),
          y: rand(),
          vx: 0.014 + rand() * 0.018,
          vy: floating ? -(0.002 + rand() * 0.003) : -(0.024 + rand() * 0.026),
          size: 7.5 + rand() * 5.5,
          phase: rand() * Math.PI * 2,
          state: floating ? 'float' : 'fall',
          landY: 0.12 + rand() * 0.54,
          life: floating ? rand() * 8 : 0,
          maxFloat: 7 + rand() * 6,
          col: rand() > 0.5 ? [1.0, 0.72, 0.85] : [1.0, 0.60, 0.78]
        });
      }
    } else if (seasonId === 'autumn') {
      for (let i = 0; i < 16; i++) {
        const floating = i < 5;
        this.ambient.push({
          kind: 2,
          x: rand(),
          y: rand(),
          vx: 0.012 + rand() * 0.016,
          vy: floating ? -(0.0018 + rand() * 0.003) : -(0.020 + rand() * 0.024),
          size: 13.0 + rand() * 9.0,
          phase: rand() * Math.PI * 2,
          state: floating ? 'float' : 'fall',
          landY: 0.12 + rand() * 0.56,
          life: floating ? rand() * 9 : 0,
          maxFloat: 9 + rand() * 7,
          col: rand() > 0.6 ? [1.0, 0.56, 0.16] : [0.88, 0.30, 0.09]
        });
      }
    } else if (seasonId === 'winter') {
      for (let i = 0; i < 64; i++) {
        this.ambient.push({
          kind: 0,
          x: rand(),
          y: rand(),
          vx: -0.005 + rand() * 0.014,
          vy: -(0.016 + rand() * 0.026),
          size: 2.6 + rand() * 3.4,
          phase: rand() * Math.PI * 2,
          alpha: 0.32 + rand() * 0.55,
          col: [0.88, 0.95, 1.0]
        });
      }
    } else {
      for (let i = 0; i < 14; i++) {
        this.ambient.push({
          kind: 0,
          x: 0.1 + rand() * 0.8,
          y: 0.12 + rand() * 0.76,
          vx: (rand() - 0.5) * 0.008,
          vy: (rand() - 0.5) * 0.006,
          size: 4.0 + rand() * 3.5,
          phase: rand() * Math.PI * 2,
          col: [0.90, 1.0, 0.76]
        });
      }
    }
  }

  triggerSeasonGust(seasonId) {
    this._initSeason(seasonId);
    this.gustBoost = 1.0;
  }

  triggerSeasonTransitionFX(fromSeason, toSeason, originX, originYUp, nowSec) {
    const rand = makeRng(Math.floor(nowSec * 1000) + 77);
    const sparks = [];
    // 260 ultra-fine, jewel-like stardust micro-sparkles (matching Video 1 delicate fairy-dust ribbon & spiral vortex!)
    for (let i = 0; i < 260; i++) {
      const arm = i % 3;
      const armBase = (arm * Math.PI * 2) / 3;
      sparks.push({
        delay: rand() * 0.28,
        ribbonSpread: (rand() - 0.5) * 0.032,
        vortexAngle: armBase + (rand() - 0.5) * 0.95,
        vortexSpeed: 2.6 + rand() * 3.2,
        vortexRadius: 0.05 + Math.pow(rand(), 0.78) * 0.42,
        size: 1.5 + Math.pow(rand(), 1.8) * 2.4, // fine pinpoint sparkles, NEVER chunky blobs!
        twinklePhase: rand() * Math.PI * 2,
        useNewColorAt: 0.20 + rand() * 0.30
      });
    }
    this.transitionFX = {
      fromRgb: SEASON_DUST_RGB[fromSeason] || SEASON_DUST_RGB.summer,
      toRgb: SEASON_DUST_RGB[toSeason] || SEASON_DUST_RGB.autumn,
      ox: originX,
      oy: originYUp,
      start: nowSec,
      duration: 2.10,
      sparks
    };
  }

  _push(x, y, r, g, b, a, size, kind) {
    if (this.count >= this.maxPoints) return;
    let o = this.count * 8;
    const d = this.data;
    d[o++] = x; d[o++] = y;
    d[o++] = r; d[o++] = g; d[o++] = b; d[o++] = a;
    d[o++] = size; d[o++] = kind;
    this.count++;
  }

  render(t, dt, sceneW, seasonId, onTouchdownRipple) {
    if (this.seasonId !== seasonId) {
      this._initSeason(seasonId);
    }
    if (this.gustBoost > 0) {
      this.gustBoost = Math.max(0, this.gustBoost - dt * 0.85);
    }
    const windMult = 1.0 + this.gustBoost * 2.2;
    const sizeScale = sceneW / 640;
    this.count = 0;

    // 1. Dynamic seasonal ambient particles
    for (const p of this.ambient) {
      if (p.kind === 1 || p.kind === 2) {
        if (p.state === 'fall') {
          p.x += (p.vx * windMult + Math.sin(t * 2.1 + p.phase) * 0.016) * dt;
          p.y += p.vy * dt;
          if (p.y <= p.landY) {
            p.state = 'float';
            p.life = 0;
            if (onTouchdownRipple && p.x > 0.08 && p.x < 0.92 && p.y > 0.12 && p.y < 0.85) {
              onTouchdownRipple(p.x, p.y, p.kind === 2 ? 0.30 : 0.22);
            }
          }
        } else {
          p.life += dt;
          p.x += (p.vx * 0.22 + Math.sin(t * 0.7 + p.phase) * 0.003) * dt;
          p.y += Math.cos(t * 0.5 + p.phase) * 0.002 * dt;
          if (p.life >= p.maxFloat || p.x > 1.06) {
            p.state = 'fall';
            p.x = -0.04 + ((p.phase * 0.37) % 0.65);
            p.y = 1.04;
            p.life = 0;
          }
        }
        if (p.x > 1.08) p.x = -0.04;
        if (p.y < -0.06) p.y = 1.04;

        const fadeOut = p.state === 'float' ? Math.max(0, 1.0 - Math.max(0, p.life - (p.maxFloat - 1.5)) / 1.5) : 1.0;
        this._push(p.x, p.y, p.col[0], p.col[1], p.col[2], 0.88 * fadeOut, p.size * sizeScale, p.kind);
      } else if (seasonId === 'winter') {
        p.x += (p.vx * windMult + Math.sin(t * 1.15 + p.phase) * 0.011) * dt;
        p.y += p.vy * dt;
        if (p.y < -0.04) {
          p.y = 1.04;
          p.x = (p.x + 0.37) % 1.0;
        }
        if (p.x < -0.02) p.x += 1.04;
        if (p.x > 1.02) p.x -= 1.04;
        this._push(p.x, p.y, p.col[0], p.col[1], p.col[2], p.alpha, p.size * sizeScale, 0);
      } else {
        p.x += (p.vx + Math.sin(t * 0.8 + p.phase) * 0.005) * dt;
        p.y += (p.vy + Math.cos(t * 0.7 + p.phase) * 0.004) * dt;
        if (p.x < 0.05) p.x = 0.95;
        if (p.x > 0.95) p.x = 0.05;
        if (p.y < 0.08) p.y = 0.92;
        if (p.y > 0.92) p.y = 0.08;
        const pulse = 0.25 + 0.75 * Math.pow(0.5 + 0.5 * Math.sin(t * 1.7 + p.phase), 2.0);
        this._push(p.x, p.y, p.col[0], p.col[1], p.col[2], 0.55 * pulse, p.size * sizeScale, 0);
      }
    }

    // 2. Video-1 Stardust Ribbon -> Pond-Center Spiral Vortex Transition FX (pure GPU!)
    const ambientCount = this.count;
    if (this.transitionFX) {
      const fx = this.transitionFX;
      const pGlobal = (t - fx.start) / fx.duration;
      if (pGlobal >= 1.0) {
        this.transitionFX = null;
      } else {
        const p0x = fx.ox, p0y = fx.oy;
        const c1x = fx.ox - 0.24, c1y = fx.oy - 0.14;
        const c2x = 0.64, c2y = 0.66;
        const cx = 0.50, cy = 0.48;

        for (let i = 0; i < fx.sparks.length; i++) {
          const sp = fx.sparks[i];
          const lp = (pGlobal - sp.delay) / (1.0 - sp.delay);
          if (lp <= 0 || lp >= 1) continue;

          let px, py, alpha, sz;
          if (lp < 0.38) {
            const u = lp / 0.38;
            const e = u * u * (3 - 2 * u);
            const mt = 1 - e;
            const bx = mt * mt * mt * p0x + 3 * mt * mt * e * c1x + 3 * mt * e * e * c2x + e * e * e * cx;
            const by = mt * mt * mt * p0y + 3 * mt * mt * e * c1y + 3 * mt * e * e * c2y + e * e * e * cy;
            px = bx + Math.sin(u * Math.PI * 3.0 + sp.vortexAngle) * sp.ribbonSpread * Math.sin(u * Math.PI);
            py = by + Math.cos(u * Math.PI * 2.5 + sp.vortexAngle) * sp.ribbonSpread * 0.6;
            alpha = Math.min(1.0, u * 3.2) * 0.92;
            sz = sp.size * (0.75 + 0.45 * u);
          } else {
            const u = (lp - 0.38) / 0.62;
            const easeOut = 1.0 - Math.pow(1.0 - u, 2.2);
            const ang = sp.vortexAngle + u * sp.vortexSpeed;
            const rad = sp.vortexRadius * (0.14 + 0.98 * easeOut);
            px = cx + Math.cos(ang) * rad * 1.15;
            py = cy + Math.sin(ang) * rad * 0.58;
            alpha = Math.sin(u * Math.PI) * (1.0 - u * 0.35) * 0.95;
            sz = sp.size * (1.15 - u * 0.52);
          }

          const rgb = lp < sp.useNewColorAt ? fx.fromRgb : fx.toRgb;
          const twinkle = 0.62 + 0.38 * Math.sin(t * 14.0 + sp.twinklePhase);
          this._push(px, py, rgb[0], rgb[1], rgb[2], alpha * twinkle, sz * sizeScale, 0);
        }
      }
    }

    if (this.count === 0) return;

    const gl = this.gl;
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data.subarray(0, this.count * 8));

    gl.enable(gl.BLEND);
    gl.useProgram(this.prog.program);

    // Draw ambient particles with standard alpha blend
    if (ambientCount > 0) {
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawArrays(gl.POINTS, 0, ambientCount);
    }
    // Draw stardust vortex with additive glow blend
    if (this.count > ambientCount) {
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      gl.drawArrays(gl.POINTS, ambientCount, this.count - ambientCount);
    }

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
