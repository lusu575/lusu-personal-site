// Pure WebGL2 GPU Ambient Particles + Video-Matched Stardust Vortex Renderer (Round 5 Upgrade)
// - Pre-rendered 256x64 4-cell Botanical Sprite Atlas (uploaded ONCE at startup -> 0ms/frame, 120+ FPS!):
//   * Cell 0: Pinpoint twinkling stardust / snow crystal
//   * Cell 1: Realistic curved heart-notched Sakura petal with blush-pink veins & gradient
//   * Cell 2: Realistic 7-lobed serrated Crimson-Gold Japanese Maple leaf with stem & veins
//   * Cell 3: Realistic 7-lobed Amber-Orange Japanese Maple leaf variant
// - Per-particle 2D rotation + 3D breeze tumble foreshortening in GLSL!
// - Falling petals/leaves wait until season transition COMPLETELY finishes (sweepP >= 1.0), then drift down naturally from top!

import { createProgram } from './gl-utils.mjs';

const PARTICLE_VERT = `#version 300 es
precision highp float;

layout(location = 0) in vec2 aPos;    // UV [0..1] (Y-up)
layout(location = 1) in vec4 aColor;  // rgba tint / alpha
layout(location = 2) in float aSize;  // point size in px
layout(location = 3) in float aCell;  // atlas cell: 0=spark/snow, 1=sakura petal, 2=maple red, 3=maple gold
layout(location = 4) in vec2 aMotion; // x = rotation rad, y = 3D tumble squash [0.35..1.0]

out vec4 vColor;
out float vCell;
out vec2 vMotion;

void main() {
  gl_Position = vec4(aPos * 2.0 - 1.0, 0.0, 1.0);
  gl_PointSize = aSize;
  vColor = aColor;
  vCell = aCell;
  vMotion = aMotion;
}
`;

const PARTICLE_FRAG = `#version 300 es
precision highp float;

in vec4 vColor;
in float vCell;
in vec2 vMotion;

uniform sampler2D uAtlasTex;

out vec4 fragColor;

void main() {
  vec2 p = gl_PointCoord - 0.5;
  float c = cos(vMotion.x);
  float s = sin(vMotion.x);
  // Rotate & apply subtle 3D flutter tumble foreshortening
  vec2 rp = vec2(p.x * c - p.y * s, (p.x * s + p.y * c) / max(0.35, vMotion.y));
  vec2 localUv = rp + 0.5;
  if (localUv.x < 0.0 || localUv.x > 1.0 || localUv.y < 0.0 || localUv.y > 1.0) {
    discard;
  }

  float cellIdx = floor(vCell + 0.5);
  vec2 atlasUv = vec2((cellIdx + localUv.x) * 0.25, localUv.y);
  vec4 tex = texture(uAtlasTex, atlasUv);
  if (tex.a <= 0.02) discard;

  // Cell 0 (stardust/snow) uses vColor RGB directly; botanical cells (1-3) preserve rich painted sprite colors
  vec3 rgb = cellIdx < 0.5 ? (tex.rgb * vColor.rgb) : (tex.rgb * mix(vec3(1.0), vColor.rgb, 0.25));
  fragColor = vec4(rgb, tex.a * vColor.a);
}
`;

function buildBotanicalAtlas() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext('2d');

  // --- Cell 0 (0..64): Crisp pinpoint stardust / snow glow ---
  {
    const g = ctx.createRadialGradient(32, 32, 1, 32, 32, 28);
    g.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
    g.addColorStop(0.24, 'rgba(255, 255, 255, 0.92)');
    g.addColorStop(0.55, 'rgba(255, 255, 255, 0.30)');
    g.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  }

  // --- Cell 1 (64..128): Realistic curved heart-notched Sakura Petal ---
  {
    ctx.save();
    ctx.translate(96, 32);
    ctx.beginPath();
    // Pointed petal base at bottom-left, swelling gracefully to a notched heart-tip at top-right
    ctx.moveTo(-22, 4);
    ctx.bezierCurveTo(-14, -18, 6, -24, 22, -8);
    ctx.lineTo(15, 0); // classic sakura petal cleft notch!
    ctx.lineTo(22, 8);
    ctx.bezierCurveTo(6, 22, -14, 16, -22, 4);
    ctx.closePath();

    const pg = ctx.createLinearGradient(-22, 0, 22, 0);
    pg.addColorStop(0.0, '#ff6ea6');
    pg.addColorStop(0.38, '#ffaad0');
    pg.addColorStop(0.78, '#ffd9eb');
    pg.addColorStop(1.0, '#fff5fa');
    ctx.fillStyle = pg;
    ctx.fill();

    // Delicate translucent petal veins
    ctx.strokeStyle = 'rgba(255, 120, 172, 0.42)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(-18, 3);
    ctx.quadraticCurveTo(0, -4, 15, -6);
    ctx.moveTo(-18, 3);
    ctx.quadraticCurveTo(0, 5, 15, 6);
    ctx.stroke();

    // Soft bright rim highlight
    ctx.strokeStyle = 'rgba(255, 245, 250, 0.55)';
    ctx.lineWidth = 0.9;
    ctx.stroke();
    ctx.restore();
  }

  // --- Helper for Realistic 7-Lobed Serrated Japanese Maple Leaf ---
  const drawMapleCell = (cx, cy, colInner, colMid, colTip) => {
    ctx.save();
    ctx.translate(cx, cy + 3);

    // Slender stem
    ctx.strokeStyle = colTip;
    ctx.lineWidth = 2.0;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 4);
    ctx.quadraticCurveTo(2, 16, -1, 24);
    ctx.stroke();

    const lobes = [
      { a: -Math.PI / 2, len: 26, w: 6.4 },
      { a: -Math.PI / 2 - 0.62, len: 23, w: 5.8 },
      { a: -Math.PI / 2 + 0.62, len: 23, w: 5.8 },
      { a: -Math.PI / 2 - 1.28, len: 17.5, w: 4.8 },
      { a: -Math.PI / 2 + 1.28, len: 17.5, w: 4.8 },
      { a: -Math.PI / 2 - 1.90, len: 10.5, w: 3.4 },
      { a: -Math.PI / 2 + 1.90, len: 10.5, w: 3.4 }
    ];

    const lg = ctx.createRadialGradient(0, 0, 2, 0, -4, 26);
    lg.addColorStop(0.0, colInner);
    lg.addColorStop(0.55, colMid);
    lg.addColorStop(1.0, colTip);
    ctx.fillStyle = lg;

    for (const lb of lobes) {
      ctx.save();
      ctx.rotate(lb.a + Math.PI / 2);
      const L = lb.len;
      const W = lb.w;
      ctx.beginPath();
      ctx.moveTo(0, 3);
      ctx.lineTo(-W * 0.95, -L * 0.36);
      ctx.lineTo(-W * 0.55, -L * 0.48);
      ctx.lineTo(-W * 0.85, -L * 0.66);
      ctx.lineTo(-W * 0.40, -L * 0.76);
      ctx.lineTo(0, -L);
      ctx.lineTo(W * 0.40, -L * 0.76);
      ctx.lineTo(W * 0.85, -L * 0.66);
      ctx.lineTo(W * 0.55, -L * 0.48);
      ctx.lineTo(W * 0.95, -L * 0.36);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Fine golden palmate leaf veins
    ctx.strokeStyle = 'rgba(255, 230, 140, 0.52)';
    ctx.lineWidth = 1.0;
    for (let i = 0; i < 5; i++) {
      const lb = lobes[i];
      ctx.beginPath();
      ctx.moveTo(0, 1);
      ctx.lineTo(Math.cos(lb.a) * lb.len * 0.78, Math.sin(lb.a) * lb.len * 0.78);
      ctx.stroke();
    }

    ctx.restore();
  };

  // Cell 2 (128..192): Crimson-Orange Maple Leaf
  drawMapleCell(160, 32, '#ffae34', '#e84814', '#9c1e08');
  // Cell 3 (192..256): Golden-Amber Maple Leaf
  drawMapleCell(224, 32, '#ffe066', '#f2821c', '#b83c0c');

  return c;
}

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
    this.ambientFade = 1.0;
    this.transitionFX = null;

    // Upload 256x64 botanical sprite atlas ONCE at startup (0ms/frame!)
    const atlasCanvas = buildBotanicalAtlas();
    this.atlasTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.atlasTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlasCanvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);

    // 10 floats per point: x, y, r, g, b, a, size, cell, rot, tumble
    this.maxPoints = 440;
    this.data = new Float32Array(this.maxPoints * 10);
    this.count = 0;

    this.vao = gl.createVertexArray();
    this.vbo = gl.createBuffer();
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);

    const stride = 10 * 4;
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, stride, 8);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, stride, 24);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 1, gl.FLOAT, false, stride, 28);
    gl.enableVertexAttribArray(4);
    gl.vertexAttribPointer(4, 2, gl.FLOAT, false, stride, 32);
    gl.bindVertexArray(null);
  }

  // spawnFromTop = true when starting after a season transition completes (so petals/leaves fall naturally AFTER transition!)
  _initSeason(seasonId, spawnFromTop = false) {
    this.seasonId = seasonId;
    const rand = makeRng(
      seasonId === 'spring' ? 101 : seasonId === 'autumn' ? 202 : seasonId === 'winter' ? 303 : 404
    );
    this.ambient = [];

    if (seasonId === 'spring') {
      for (let i = 0; i < 24; i++) {
        const floating = !spawnFromTop && i < 6;
        this.ambient.push({
          cell: 1,
          x: spawnFromTop ? (-0.05 + rand() * 0.85) : rand(),
          y: spawnFromTop ? (1.03 + rand() * 0.45) : rand(),
          vx: 0.015 + rand() * 0.018,
          vy: floating ? -(0.002 + rand() * 0.003) : -(0.024 + rand() * 0.024),
          size: 18.0 + rand() * 10.0,
          rot: rand() * Math.PI * 2,
          vRot: (rand() - 0.5) * 1.9,
          phase: rand() * Math.PI * 2,
          state: floating ? 'float' : 'fall',
          landY: 0.14 + rand() * 0.54,
          life: floating ? rand() * 7 : 0,
          maxFloat: 7 + rand() * 6,
          col: [1.0, 0.96, 0.98]
        });
      }
    } else if (seasonId === 'autumn') {
      for (let i = 0; i < 15; i++) {
        const floating = !spawnFromTop && i < 4;
        this.ambient.push({
          cell: rand() > 0.45 ? 2 : 3,
          x: spawnFromTop ? (-0.05 + rand() * 0.85) : rand(),
          y: spawnFromTop ? (1.04 + rand() * 0.50) : rand(),
          vx: 0.012 + rand() * 0.015,
          vy: floating ? -(0.0018 + rand() * 0.0028) : -(0.019 + rand() * 0.022),
          size: 28.0 + rand() * 14.0,
          rot: rand() * Math.PI * 2,
          vRot: (rand() - 0.5) * 1.25,
          phase: rand() * Math.PI * 2,
          state: floating ? 'float' : 'fall',
          landY: 0.14 + rand() * 0.56,
          life: floating ? rand() * 8 : 0,
          maxFloat: 9 + rand() * 7,
          col: [1.0, 0.95, 0.90]
        });
      }
    } else if (seasonId === 'winter') {
      for (let i = 0; i < 58; i++) {
        this.ambient.push({
          cell: 0,
          x: rand(),
          y: spawnFromTop ? (1.02 + rand() * 0.65) : rand(),
          vx: -0.005 + rand() * 0.013,
          vy: -(0.015 + rand() * 0.024),
          size: 2.6 + rand() * 3.2,
          rot: 0,
          vRot: 0,
          phase: rand() * Math.PI * 2,
          alpha: 0.30 + rand() * 0.52,
          col: [0.88, 0.95, 1.0]
        });
      }
    } else {
      for (let i = 0; i < 12; i++) {
        this.ambient.push({
          cell: 0,
          x: 0.1 + rand() * 0.8,
          y: 0.12 + rand() * 0.76,
          vx: (rand() - 0.5) * 0.008,
          vy: (rand() - 0.5) * 0.006,
          size: 3.8 + rand() * 3.2,
          rot: 0,
          vRot: 0,
          phase: rand() * Math.PI * 2,
          col: [0.90, 1.0, 0.76]
        });
      }
    }
  }

  startNewSeasonAmbient(seasonId) {
    this._initSeason(seasonId, true);
  }

  triggerSeasonTransitionFX(fromSeason, toSeason, originX, originYUp, nowSec) {
    const rand = makeRng(Math.floor(nowSec * 1000) + 77);
    const sparks = [];
    for (let i = 0; i < 260; i++) {
      const arm = i % 3;
      const armBase = (arm * Math.PI * 2) / 3;
      sparks.push({
        delay: rand() * 0.28,
        ribbonSpread: (rand() - 0.5) * 0.032,
        vortexAngle: armBase + (rand() - 0.5) * 0.95,
        vortexSpeed: 2.6 + rand() * 3.2,
        vortexRadius: 0.05 + Math.pow(rand(), 0.78) * 0.42,
        size: 1.5 + Math.pow(rand(), 1.8) * 2.4,
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

  _push(x, y, r, g, b, a, size, cell, rot = 0, tumble = 1.0) {
    if (this.count >= this.maxPoints) return;
    let o = this.count * 10;
    const d = this.data;
    d[o++] = x; d[o++] = y;
    d[o++] = r; d[o++] = g; d[o++] = b; d[o++] = a;
    d[o++] = size; d[o++] = cell;
    d[o++] = rot; d[o++] = tumble;
    this.count++;
  }

  render(t, dt, sceneW, activeSeasonId, sweepP, onTouchdownRipple) {
    if (!this.seasonId) {
      this._initSeason(activeSeasonId, false);
    }

    // Smoothly fade OUT old ambient particles during season transition;
    // new season petals/leaves ONLY begin falling AFTER sweepP >= 1.0!
    const inTransition = sweepP < 0.999;
    const fadeMult = inTransition ? Math.max(0, 1.0 - sweepP * 2.4) : 1.0;

    const sizeScale = sceneW / 640;
    this.count = 0;

    // 1. Dynamic seasonal ambient particles
    if (fadeMult > 0.01) {
      for (const p of this.ambient) {
        if (p.cell === 1 || p.cell === 2 || p.cell === 3) {
          if (p.state === 'fall') {
            p.x += (p.vx + Math.sin(t * 2.1 + p.phase) * 0.015) * dt;
            p.y += p.vy * dt;
            p.rot += p.vRot * dt;
            if (p.y <= p.landY) {
              p.state = 'float';
              p.life = 0;
              if (onTouchdownRipple && p.x > 0.08 && p.x < 0.92 && p.y > 0.12 && p.y < 0.85) {
                onTouchdownRipple(p.x, p.y, p.cell === 1 ? 0.20 : 0.28);
              }
            }
          } else {
            p.life += dt;
            p.x += (p.vx * 0.20 + Math.sin(t * 0.7 + p.phase) * 0.003) * dt;
            p.y += Math.cos(t * 0.5 + p.phase) * 0.002 * dt;
            p.rot += p.vRot * 0.14 * dt;
            if (p.life >= p.maxFloat || p.x > 1.06) {
              p.state = 'fall';
              p.x = -0.04 + ((p.phase * 0.37) % 0.65);
              p.y = 1.04;
              p.life = 0;
            }
          }
          if (p.x > 1.08) p.x = -0.04;
          if (p.y < -0.06) p.y = 1.04;

          if (p.y <= 1.06) {
            const fadeOut = p.state === 'float' ? Math.max(0, 1.0 - Math.max(0, p.life - (p.maxFloat - 1.5)) / 1.5) : 1.0;
            const tumble = p.state === 'float' ? 0.85 : (0.50 + 0.50 * Math.abs(Math.cos(t * 1.9 + p.phase)));
            this._push(p.x, p.y, p.col[0], p.col[1], p.col[2], 0.92 * fadeOut * fadeMult, p.size * sizeScale, p.cell, p.rot, tumble);
          }
        } else if (this.seasonId === 'winter') {
          p.x += (p.vx + Math.sin(t * 1.15 + p.phase) * 0.011) * dt;
          p.y += p.vy * dt;
          if (p.y < -0.04) {
            p.y = 1.04;
            p.x = (p.x + 0.37) % 1.0;
          }
          if (p.x < -0.02) p.x += 1.04;
          if (p.x > 1.02) p.x -= 1.04;
          if (p.y <= 1.04) {
            this._push(p.x, p.y, p.col[0], p.col[1], p.col[2], p.alpha * fadeMult, p.size * sizeScale, 0, 0, 1.0);
          }
        } else {
          p.x += (p.vx + Math.sin(t * 0.8 + p.phase) * 0.005) * dt;
          p.y += (p.vy + Math.cos(t * 0.7 + p.phase) * 0.004) * dt;
          if (p.x < 0.05) p.x = 0.95;
          if (p.x > 0.95) p.x = 0.05;
          if (p.y < 0.08) p.y = 0.92;
          if (p.y > 0.92) p.y = 0.08;
          const pulse = 0.25 + 0.75 * Math.pow(0.5 + 0.5 * Math.sin(t * 1.7 + p.phase), 2.0);
          this._push(p.x, p.y, p.col[0], p.col[1], p.col[2], 0.55 * pulse * fadeMult, p.size * sizeScale, 0, 0, 1.0);
        }
      }
    }

    // 2. Video-1 Fine Stardust Ribbon -> Pond-Center Spiral Vortex Transition FX
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
          this._push(px, py, rgb[0], rgb[1], rgb[2], alpha * twinkle, sz * sizeScale, 0, 0, 1.0);
        }
      }
    }

    if (this.count === 0) return;

    const gl = this.gl;
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data.subarray(0, this.count * 10));

    gl.enable(gl.BLEND);
    gl.useProgram(this.prog.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.atlasTex);
    gl.uniform1i(this.prog.uniforms.uAtlasTex, 0);

    if (ambientCount > 0) {
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawArrays(gl.POINTS, 0, ambientCount);
    }
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
    gl.deleteTexture(this.atlasTex);
    gl.deleteBuffer(this.vbo);
    gl.deleteVertexArray(this.vao);
  }
}
