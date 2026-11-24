// Pure WebGL2 GPU In-Place Wavefront & Seasonal Ambient Particles (r67)
// Approved "In-Place Evolution" Redesign:
// - Deleted 320-spark center-gather Bezier ribbon & 3-arm additive vortex completely
// - Wavefront breeze micro-particles: 42 sparse low-saturation dot-matrix motes (1.5-3.2px),
//   spawning strictly IN-PLACE as the 1.0s wavefront passes each anchor, drifting 0.04-0.12 screen width,
//   and dissipating smoothly via exp(-3.2 * age) with normal alpha blending (zero blinding additive glare)
// - Ambient seasonal particles tuned to restrained sizes & counts:
//   * Spring: 16 soft sakura petals (10-16px)
//   * Summer: 8 slow-breathing warm-cyan fireflies (2.0-3.5px)
//   * Autumn: 11 muted dark-pond maple leaves (16-24px)
//   * Winter: 38 fine dot-matrix micro-snowflakes (1.5-3.0px)
// - Outgoing ambient particles decelerate & fade out in-place (~0.35s) as the wavefront crosses each particle's (x, y)

import { createProgram } from './gl-utils.mjs';

const PARTICLE_VERT = `#version 300 es
precision highp float;

layout(location = 0) in vec2 aPos;    // UV [0..1] (Y-up)
layout(location = 1) in vec4 aColor;  // rgba tint / alpha
layout(location = 2) in float aSize;  // point size in px
layout(location = 3) in float aCell;  // atlas cell: 0=dot/mote/snow, 1=sakura petal, 2=maple red, 3=maple gold
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
  vec2 rp = vec2(p.x * c - p.y * s, (p.x * s + p.y * c) / max(0.35, vMotion.y));
  vec2 localUv = rp + 0.5;
  if (localUv.x < 0.0 || localUv.x > 1.0 || localUv.y < 0.0 || localUv.y > 1.0) {
    discard;
  }

  float cellIdx = floor(vCell + 0.5);
  vec2 atlasUv = vec2((cellIdx + localUv.x) * 0.25, localUv.y);
  vec4 tex = texture(uAtlasTex, atlasUv);
  if (tex.a <= 0.02) discard;

  vec3 rgb = cellIdx < 0.5 ? (tex.rgb * vColor.rgb) : (tex.rgb * mix(vec3(0.86), vColor.rgb, 0.35));
  fragColor = vec4(rgb, tex.a * vColor.a);
}
`;

function buildBotanicalAtlas() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext('2d');

  // Cell 0 (0..64): Crisp restrained dot-matrix pixel mote / snow crystal (NOT huge glowing orb)
  {
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 24);
    g.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
    g.addColorStop(0.45, 'rgba(255, 255, 255, 0.85)');
    g.addColorStop(0.75, 'rgba(255, 255, 255, 0.22)');
    g.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  }

  // Cell 1 (64..128): Restrained soft-blush heart-notched Sakura Petal
  {
    ctx.save();
    ctx.translate(96, 32);
    ctx.beginPath();
    ctx.moveTo(-22, 4);
    ctx.bezierCurveTo(-14, -18, 6, -24, 22, -8);
    ctx.lineTo(15, 0);
    ctx.lineTo(22, 8);
    ctx.bezierCurveTo(6, 22, -14, 16, -22, 4);
    ctx.closePath();

    const pg = ctx.createLinearGradient(-22, 0, 22, 0);
    pg.addColorStop(0.0, '#d988a8');
    pg.addColorStop(0.45, '#e8b3c9');
    pg.addColorStop(0.85, '#f2d6e3');
    pg.addColorStop(1.0, '#f7e9f0');
    ctx.fillStyle = pg;
    ctx.fill();

    ctx.strokeStyle = 'rgba(218, 130, 168, 0.34)';
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(-18, 3);
    ctx.quadraticCurveTo(0, -4, 15, -6);
    ctx.moveTo(-18, 3);
    ctx.quadraticCurveTo(0, 5, 15, 6);
    ctx.stroke();
    ctx.restore();
  }

  // Helper for muted dark-pond 7-Lobed Japanese Maple Leaf
  const drawMapleCell = (cx, cy, colInner, colMid, colTip) => {
    ctx.save();
    ctx.translate(cx, cy + 3);
    ctx.strokeStyle = colTip;
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 4);
    ctx.quadraticCurveTo(2, 16, -1, 24);
    ctx.stroke();

    const lobes = [
      { a: -Math.PI / 2, len: 25, w: 6.2 },
      { a: -Math.PI / 2 - 0.62, len: 22, w: 5.6 },
      { a: -Math.PI / 2 + 0.62, len: 22, w: 5.6 },
      { a: -Math.PI / 2 - 1.28, len: 17, w: 4.6 },
      { a: -Math.PI / 2 + 1.28, len: 17, w: 4.6 },
      { a: -Math.PI / 2 - 1.90, len: 10, w: 3.3 },
      { a: -Math.PI / 2 + 1.90, len: 10, w: 3.3 }
    ];

    const lg = ctx.createRadialGradient(0, 0, 2, 0, -4, 25);
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
    ctx.restore();
  };

  // Muted dark-pond crimson & amber maple leaves
  drawMapleCell(160, 32, '#d48238', '#b8421c', '#731a0a');
  drawMapleCell(224, 32, '#dbaf56', '#c46f24', '#853110');

  return c;
}

function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// Low-saturation CRT dark-pond seasonal breeze dust tints
const SEASON_MOTE_RGB = {
  spring: [0.84, 0.72, 0.80],
  summer: [0.58, 0.86, 0.78],
  autumn: [0.86, 0.64, 0.42],
  winter: [0.74, 0.86, 0.94]
};

export class ParticlesGLRenderer {
  constructor(gl) {
    this.gl = gl;
    this.prog = createProgram(gl, PARTICLE_VERT, PARTICLE_FRAG);
    this.seasonId = '';
    this.ambient = [];
    this.outgoingAmbient = [];
    this.waveMotes = [];
    this.waveInfo = null;

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
    this.maxPoints = 256;
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

  _buildSeasonAmbient(seasonId, fromWave = false) {
    const rand = makeRng(
      seasonId === 'spring' ? 101 : seasonId === 'autumn' ? 202 : seasonId === 'winter' ? 303 : 404
    );
    const out = [];

    if (seasonId === 'spring') {
      // Approved: 16 small soft-blush sakura petals (10-16px), loosening in-place from branches
      for (let i = 0; i < 16; i++) {
        const floating = !fromWave && i < 4;
        out.push({
          season: 'spring',
          cell: 1,
          x: fromWave ? (0.04 + rand() * 0.62) : rand(),
          y: fromWave ? (0.58 + rand() * 0.40) : rand(),
          vx: 0.012 + rand() * 0.014,
          vy: floating ? -(0.0018 + rand() * 0.0025) : -(0.020 + rand() * 0.020),
          size: 10.0 + rand() * 6.0,
          rot: rand() * Math.PI * 2,
          vRot: (rand() - 0.5) * 1.6,
          phase: rand() * Math.PI * 2,
          state: floating ? 'float' : 'fall',
          landY: 0.14 + rand() * 0.52,
          life: floating ? rand() * 7 : 0,
          maxFloat: 7 + rand() * 5,
          alpha: 0.82,
          col: [0.96, 0.90, 0.93],
          born: !fromWave,
          birthFade: fromWave ? 0.0 : 1.0
        });
      }
    } else if (seasonId === 'autumn') {
      // Approved: 11 muted dark-pond maple leaves (16-24px)
      for (let i = 0; i < 11; i++) {
        const floating = !fromWave && i < 3;
        out.push({
          season: 'autumn',
          cell: rand() > 0.45 ? 2 : 3,
          x: fromWave ? (0.04 + rand() * 0.68) : rand(),
          y: fromWave ? (0.56 + rand() * 0.42) : rand(),
          vx: 0.010 + rand() * 0.013,
          vy: floating ? -(0.0015 + rand() * 0.0024) : -(0.017 + rand() * 0.018),
          size: 16.0 + rand() * 8.0,
          rot: rand() * Math.PI * 2,
          vRot: (rand() - 0.5) * 1.1,
          phase: rand() * Math.PI * 2,
          state: floating ? 'float' : 'fall',
          landY: 0.14 + rand() * 0.54,
          life: floating ? rand() * 8 : 0,
          maxFloat: 8 + rand() * 6,
          alpha: 0.84,
          col: [0.94, 0.88, 0.82],
          born: !fromWave,
          birthFade: fromWave ? 0.0 : 1.0
        });
      }
    } else if (seasonId === 'winter') {
      // Approved: 38 fine dot-matrix micro-snowflakes (1.5-3.0px)
      for (let i = 0; i < 38; i++) {
        out.push({
          season: 'winter',
          cell: 0,
          x: rand(),
          y: rand(),
          vx: -0.004 + rand() * 0.010,
          vy: -(0.013 + rand() * 0.020),
          size: 1.5 + rand() * 1.5,
          rot: 0,
          vRot: 0,
          phase: rand() * Math.PI * 2,
          alpha: 0.28 + rand() * 0.42,
          col: [0.84, 0.92, 0.98],
          born: !fromWave,
          birthFade: fromWave ? 0.0 : 1.0
        });
      }
    } else {
      // Summer: 8 restrained slow-breathing warm-cyan fireflies (2.0-3.5px)
      for (let i = 0; i < 8; i++) {
        out.push({
          season: 'summer',
          cell: 0,
          x: 0.10 + rand() * 0.80,
          y: 0.14 + rand() * 0.72,
          vx: (rand() - 0.5) * 0.006,
          vy: (rand() - 0.5) * 0.005,
          size: 2.0 + rand() * 1.5,
          rot: 0,
          vRot: 0,
          phase: rand() * Math.PI * 2,
          alpha: 0.48,
          col: [0.76, 0.96, 0.86],
          born: !fromWave,
          birthFade: fromWave ? 0.0 : 1.0
        });
      }
    }
    return out;
  }

  // Triggered on 1.0s In-Place Wavefront Season Switch (interruptible, zero center gather!)
  triggerWavefrontTransition(fromSeason, toSeason, originX, originYUp, nowSec, durationSec = 1.0) {
    // Move currently active ambient particles into outgoingAmbient so each fades IN-PLACE when wavefront passes!
    for (const p of this.ambient) {
      if (p.born && p.birthFade > 0.05) {
        this.outgoingAmbient.push({
          ...p,
          fading: false,
          fadeOutAge: 0
        });
      }
    }
    if (this.outgoingAmbient.length > 64) {
      this.outgoingAmbient.splice(0, this.outgoingAmbient.length - 64);
    }

    // Prepare new season's ambient particles to emerge IN-PLACE behind the advancing wavefront
    this.seasonId = toSeason;
    this.ambient = this._buildSeasonAmbient(toSeason, true);

    // Approved: 42 sparse wavefront micro-particles (36-48 range), 1.5-3.2px, spawned in-place along the sweep
    const rand = makeRng(Math.floor(nowSec * 1000) + 31);
    const toRgb = SEASON_MOTE_RGB[toSeason] || SEASON_MOTE_RGB.autumn;
    const newMotes = [];
    const moteCount = 42;
    for (let i = 0; i < moteCount; i++) {
      const ax = 0.06 + rand() * 0.88;
      const ay = 0.08 + rand() * 0.84;
      const dx = ax - originX;
      const dy = ay - originYUp;
      const dist = Math.hypot(dx, dy);
      const nx = dist > 0.001 ? dx / dist : (rand() - 0.5);
      const ny = dist > 0.001 ? dy / dist : (rand() - 0.5);
      const driftDist = 0.04 + rand() * 0.08; // Approved: 0.04-0.12 screen width gentle breeze drift
      newMotes.push({
        ax,
        ay,
        x: ax,
        y: ay,
        dirX: nx + (rand() - 0.5) * 0.35,
        dirY: ny + (rand() - 0.5) * 0.35,
        driftDist,
        size: 1.5 + rand() * 1.7, // Approved: 1.5-3.2px
        rgb: toRgb,
        baseAlpha: 0.36 + rand() * 0.30,
        activated: false,
        age: 0,
        phase: rand() * Math.PI * 2
      });
    }

    // If interrupting an active wave, existing activated motes decay in-place naturally (zero stack/pop)
    this.waveMotes = this.waveMotes.filter((m) => m.activated && m.age < 0.75);
    this.waveMotes.push(...newMotes);
    if (this.waveMotes.length > 72) {
      this.waveMotes.splice(0, this.waveMotes.length - 72);
    }

    this.waveInfo = {
      ox: originX,
      oy: originYUp,
      start: nowSec,
      duration: durationSec
    };
  }

  _push(x, y, r, g, b, a, size, cell, rot = 0, tumble = 1.0) {
    if (this.count >= this.maxPoints || a <= 0.008) return;
    let o = this.count * 10;
    const d = this.data;
    d[o++] = x; d[o++] = y;
    d[o++] = r; d[o++] = g; d[o++] = b; d[o++] = a;
    d[o++] = size; d[o++] = cell;
    d[o++] = rot; d[o++] = tumble;
    this.count++;
  }

  _stepAmbientParticle(p, t, dt, speedMul, alphaMul, sizeScale, onTouchdownRipple) {
    if (p.cell === 1 || p.cell === 2 || p.cell === 3) {
      if (p.state === 'fall') {
        p.x += (p.vx + Math.sin(t * 2.0 + p.phase) * 0.012) * dt * speedMul;
        p.y += p.vy * dt * speedMul;
        p.rot += p.vRot * dt * speedMul;
        if (p.y <= p.landY) {
          p.state = 'float';
          p.life = 0;
          if (onTouchdownRipple && speedMul > 0.5 && p.x > 0.08 && p.x < 0.92 && p.y > 0.12 && p.y < 0.85) {
            onTouchdownRipple(p.x, p.y, p.cell === 1 ? 0.16 : 0.22);
          }
        }
      } else {
        p.life += dt;
        p.x += (p.vx * 0.18 + Math.sin(t * 0.7 + p.phase) * 0.0025) * dt * speedMul;
        p.y += Math.cos(t * 0.5 + p.phase) * 0.0018 * dt * speedMul;
        p.rot += p.vRot * 0.12 * dt * speedMul;
        if (speedMul > 0.5 && (p.life >= p.maxFloat || p.x > 1.06)) {
          p.state = 'fall';
          p.x = -0.02 + ((p.phase * 0.37) % 0.65);
          p.y = 1.03;
          p.life = 0;
        }
      }
      if (p.x > 1.06) p.x = -0.03;
      if (p.y < -0.05) p.y = 1.03;

      if (p.y <= 1.05) {
        const floatFade = p.state === 'float' ? Math.max(0, 1.0 - Math.max(0, p.life - (p.maxFloat - 1.5)) / 1.5) : 1.0;
        const tumble = p.state === 'float' ? 0.85 : (0.50 + 0.50 * Math.abs(Math.cos(t * 1.8 + p.phase)));
        this._push(p.x, p.y, p.col[0], p.col[1], p.col[2], p.alpha * floatFade * alphaMul, p.size * sizeScale, p.cell, p.rot, tumble);
      }
    } else if (p.season === 'winter') {
      p.x += (p.vx + Math.sin(t * 1.1 + p.phase) * 0.009) * dt * speedMul;
      p.y += p.vy * dt * speedMul;
      if (speedMul > 0.5 && p.y < -0.03) {
        p.y = 1.03;
        p.x = (p.x + 0.37) % 1.0;
      }
      if (p.x < -0.02) p.x += 1.04;
      if (p.x > 1.02) p.x -= 1.04;
      if (p.y <= 1.04) {
        this._push(p.x, p.y, p.col[0], p.col[1], p.col[2], p.alpha * alphaMul, p.size * sizeScale, 0, 0, 1.0);
      }
    } else {
      // Summer firefly: gentle slow breath, no harsh blink
      p.x += (p.vx + Math.sin(t * 0.7 + p.phase) * 0.004) * dt * speedMul;
      p.y += (p.vy + Math.cos(t * 0.6 + p.phase) * 0.003) * dt * speedMul;
      if (p.x < 0.06) p.x = 0.94;
      if (p.x > 0.94) p.x = 0.06;
      if (p.y < 0.08) p.y = 0.92;
      if (p.y > 0.92) p.y = 0.08;
      const breath = 0.30 + 0.70 * Math.pow(0.5 + 0.5 * Math.sin(t * 1.2 + p.phase), 2.0);
      this._push(p.x, p.y, p.col[0], p.col[1], p.col[2], p.alpha * breath * alphaMul, p.size * sizeScale, 0, 0, 1.0);
    }
  }

  render(t, dt, sceneW, activeSeasonId, waveState, onTouchdownRipple) {
    if (!this.seasonId && activeSeasonId) {
      this.seasonId = activeSeasonId;
      this.ambient = this._buildSeasonAmbient(activeSeasonId, false);
    }

    const aspect = waveState?.aspect || 1.77;
    const waveActive = Boolean(waveState && waveState.active);
    const waveOx = waveActive ? waveState.ox : 0.86;
    const waveOy = waveActive ? waveState.oy : 0.92;
    const frontDist = waveActive ? waveState.frontDist : 99.0;

    // Restrained 0.85x scale factor so motes & botanicals never overpower desktop icons or koi
    const sizeScale = (sceneW / 640) * 0.85;
    this.count = 0;

    // 1. Outgoing season particles: decelerate & fade out IN-PLACE over ~0.35s when wavefront passes
    if (this.outgoingAmbient.length > 0) {
      const nextOut = [];
      for (const p of this.outgoingAmbient) {
        if (!p.fading) {
          const d = Math.hypot((p.x - waveOx) * aspect, p.y - waveOy);
          if (!waveActive || d <= frontDist) {
            p.fading = true;
          }
        }
        if (p.fading) {
          p.fadeOutAge += dt;
        }
        const fadeMul = p.fading ? Math.max(0, 1.0 - p.fadeOutAge / 0.35) : 1.0;
        if (fadeMul > 0.015) {
          const speedMul = p.fading ? (0.35 + 0.65 * fadeMul) : 1.0;
          this._stepAmbientParticle(p, t, dt, speedMul, fadeMul, sizeScale, null);
          nextOut.push(p);
        }
      }
      this.outgoingAmbient = nextOut;
    }

    // 2. Current season ambient particles: emerge IN-PLACE behind the advancing wavefront
    for (const p of this.ambient) {
      if (!p.born) {
        const d = Math.hypot((p.x - waveOx) * aspect, p.y - waveOy);
        if (!waveActive || d <= frontDist) {
          p.born = true;
        }
      }
      if (p.born) {
        if (p.birthFade < 1.0) {
          p.birthFade = Math.min(1.0, p.birthFade + dt * 2.6);
        }
        this._stepAmbientParticle(p, t, dt, 1.0, p.birthFade, sizeScale, onTouchdownRipple);
      }
    }

    // 3. Wavefront breeze micro-particles (42 sparse 1.5-3.2px motes, exp(-3.2*age) dissipation)
    if (this.waveMotes.length > 0) {
      const nextMotes = [];
      for (const m of this.waveMotes) {
        if (!m.activated && waveActive) {
          const d = Math.hypot((m.ax - waveOx) * aspect, m.ay - waveOy);
          if (d <= frontDist) {
            m.activated = true;
            m.age = 0;
          }
        }
        if (m.activated) {
          m.age += dt;
          const decay = Math.exp(-3.2 * m.age); // Approved exp(-3.2 * age) smooth dissipation
          if (decay > 0.02) {
            const travel = (1.0 - Math.exp(-3.8 * m.age)) * m.driftDist;
            const px = m.ax + m.dirX * travel;
            const py = m.ay + m.dirY * travel + Math.sin(m.age * 5.0 + m.phase) * 0.008;
            const rise = Math.min(1.0, m.age * 14.0);
            const alpha = m.baseAlpha * rise * decay;
            this._push(px, py, m.rgb[0], m.rgb[1], m.rgb[2], alpha, m.size * sizeScale, 0, 0, 1.0);
            nextMotes.push(m);
          }
        } else if (waveActive) {
          nextMotes.push(m);
        }
      }
      this.waveMotes = nextMotes;
    }

    if (this.count === 0) return;

    const gl = this.gl;
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data.subarray(0, this.count * 10));

    // Normal restrained alpha blending ONLY (eliminates garish GL_ONE bloom blast!)
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(this.prog.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.atlasTex);
    gl.uniform1i(this.prog.uniforms.uAtlasTex, 0);
    gl.drawArrays(gl.POINTS, 0, this.count);

    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
  }

  getDebugStats() {
    return {
      seasonId: this.seasonId,
      ambientCount: this.ambient.length,
      outgoingCount: this.outgoingAmbient.length,
      waveMoteCount: this.waveMotes.length,
      renderedPoints: this.count
    };
  }

  destroy() {
    const gl = this.gl;
    gl.deleteProgram(this.prog.program);
    gl.deleteTexture(this.atlasTex);
    gl.deleteBuffer(this.vbo);
    gl.deleteVertexArray(this.vao);
  }
}
