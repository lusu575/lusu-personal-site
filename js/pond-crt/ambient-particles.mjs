// Dynamic seasonal ambient particles (Spring falling sakura petals, Autumn falling maple leaves,
// Summer firefly/pollen glints, Winter drifting snowfall) rendered at lean resolution for 120 FPS
// and composited BEFORE CRT phosphor-dot quantization so they share 100% the same dot-matrix look.

function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export class AmbientParticleLayer {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.width = 0;
    this.height = 0;
    this.seasonId = '';
    this.particles = [];
    this.gustBoost = 0;
  }

  _initSeason(seasonId) {
    this.seasonId = seasonId;
    const rand = makeRng(
      seasonId === 'spring' ? 101 : seasonId === 'autumn' ? 202 : seasonId === 'winter' ? 303 : 404
    );
    this.particles = [];

    if (seasonId === 'spring') {
      // 26 falling & floating sakura petals
      for (let i = 0; i < 26; i++) {
        const floating = i < 8;
        this.particles.push({
          kind: 'petal',
          x: rand(),
          y: rand(),
          vx: 0.014 + rand() * 0.018,
          vy: floating ? (0.002 + rand() * 0.004) : (0.026 + rand() * 0.028),
          size: 0.0075 + rand() * 0.0065,
          rot: rand() * Math.PI * 2,
          vRot: (rand() - 0.5) * 1.8,
          phase: rand() * Math.PI * 2,
          state: floating ? 'float' : 'fall',
          landY: 0.36 + rand() * 0.54,
          life: floating ? rand() * 8 : 0,
          maxFloat: 7 + rand() * 6,
          tint: rand()
        });
      }
    } else if (seasonId === 'autumn') {
      // 16 falling & drifting autumn maple leaves
      for (let i = 0; i < 16; i++) {
        const floating = i < 5;
        this.particles.push({
          kind: 'maple',
          x: rand(),
          y: rand(),
          vx: 0.012 + rand() * 0.016,
          vy: floating ? (0.0018 + rand() * 0.003) : (0.020 + rand() * 0.024),
          size: 0.015 + rand() * 0.013,
          rot: rand() * Math.PI * 2,
          vRot: (rand() - 0.5) * 1.2,
          phase: rand() * Math.PI * 2,
          state: floating ? 'float' : 'fall',
          landY: 0.34 + rand() * 0.56,
          life: floating ? rand() * 9 : 0,
          maxFloat: 9 + rand() * 7,
          tint: rand()
        });
      }
    } else if (seasonId === 'winter') {
      // 64 serene drifting snowflakes
      for (let i = 0; i < 64; i++) {
        this.particles.push({
          kind: 'snow',
          x: rand(),
          y: rand(),
          vx: -0.005 + rand() * 0.014,
          vy: 0.016 + rand() * 0.026,
          size: 0.0020 + rand() * 0.0034,
          phase: rand() * Math.PI * 2,
          alpha: 0.32 + rand() * 0.58
        });
      }
    } else {
      // Summer: 14 subtle warm golden-mint firefly / water-pollen glints
      for (let i = 0; i < 14; i++) {
        this.particles.push({
          kind: 'glint',
          x: 0.1 + rand() * 0.8,
          y: 0.12 + rand() * 0.76,
          vx: (rand() - 0.5) * 0.008,
          vy: (rand() - 0.5) * 0.006,
          size: 0.0028 + rand() * 0.0032,
          phase: rand() * Math.PI * 2
        });
      }
    }
  }

  triggerSeasonGust(seasonId) {
    this._initSeason(seasonId);
    this.gustBoost = 1.0;
  }

  _drawPetal(ctx, x, y, r, rot, tumble, alpha, tint) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(1.0, 0.45 + 0.55 * Math.abs(Math.cos(tumble)));
    ctx.globalAlpha = alpha;

    ctx.beginPath();
    ctx.moveTo(-r, 0);
    ctx.bezierCurveTo(-r * 0.5, -r * 0.72, r * 0.45, -r * 0.78, r, -r * 0.12);
    ctx.lineTo(r * 0.78, 0);
    ctx.lineTo(r, r * 0.12);
    ctx.bezierCurveTo(r * 0.45, r * 0.78, -r * 0.5, r * 0.72, -r, 0);
    ctx.closePath();

    ctx.fillStyle = tint > 0.5 ? '#ffb4d4' : '#ff94c0';
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 240, 248, 0.55)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.18, 0, r * 0.42, r * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  _drawFallingMaple(ctx, x, y, r, rot, tumble, alpha, tint) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(1.0, 0.55 + 0.45 * Math.abs(Math.cos(tumble)));
    ctx.globalAlpha = alpha;

    const col = tint > 0.65 ? '#ff9428' : tint > 0.3 ? '#e85216' : '#c83412';
    ctx.fillStyle = col;
    const lobes = [
      [-Math.PI / 2, 1.0],
      [-Math.PI / 2 - 0.68, 0.85],
      [-Math.PI / 2 + 0.68, 0.85],
      [-Math.PI / 2 - 1.38, 0.62],
      [-Math.PI / 2 + 1.38, 0.62]
    ];
    for (const [a, len] of lobes) {
      ctx.save();
      ctx.rotate(a + Math.PI / 2);
      const L = r * len;
      const W = r * 0.24 * len;
      ctx.beginPath();
      ctx.moveTo(0, r * 0.1);
      ctx.lineTo(-W, -L * 0.5);
      ctx.lineTo(0, -L);
      ctx.lineTo(W, -L * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  render(t, dt, width, height, seasonId, onTouchdownRipple) {
    if (this.seasonId !== seasonId) {
      this._initSeason(seasonId);
    }
    // Lean resolution for 120 FPS (gets quantized by Pass 4 CRT phosphor dots)
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

    if (this.gustBoost > 0) {
      this.gustBoost = Math.max(0, this.gustBoost - dt * 0.85);
    }
    const windMult = 1.0 + this.gustBoost * 2.2;

    for (const p of this.particles) {
      if (p.kind === 'petal' || p.kind === 'maple') {
        if (p.state === 'fall') {
          const flutter = Math.sin(t * 2.1 + p.phase) * 0.018;
          p.x += (p.vx * windMult + flutter) * dt;
          p.y += p.vy * dt;
          p.rot += p.vRot * dt;

          // Touch down on the pond surface!
          if (p.y >= p.landY) {
            p.state = 'float';
            p.life = 0;
            if (onTouchdownRipple && p.x > 0.08 && p.x < 0.92 && p.y > 0.15 && p.y < 0.88) {
              onTouchdownRipple(p.x, 1.0 - p.y, p.kind === 'maple' ? 0.34 : 0.24);
            }
          }
        } else {
          // Gently drifting on the water surface
          p.life += dt;
          p.x += (p.vx * 0.24 + Math.sin(t * 0.7 + p.phase) * 0.003) * dt;
          p.y += Math.cos(t * 0.5 + p.phase) * 0.002 * dt;
          p.rot += p.vRot * 0.15 * dt;

          if (p.life >= p.maxFloat || p.x > 1.06) {
            // Respawn near top-left overhanging canopy
            p.state = 'fall';
            p.x = -0.04 + ((p.phase * 0.37) % 0.65);
            p.y = -0.04;
            p.life = 0;
          }
        }

        if (p.x > 1.08) p.x = -0.05;
        if (p.y > 1.08) p.y = -0.04;

        const fadeIn = p.state === 'fall' ? Math.min(1, (p.y + 0.05) * 6.0) : 1.0;
        const fadeOut = p.state === 'float' ? Math.max(0, 1.0 - Math.max(0, p.life - (p.maxFloat - 1.5)) / 1.5) : 1.0;
        const alpha = (p.state === 'float' ? 0.82 : 0.92) * fadeIn * fadeOut;

        if (p.kind === 'petal') {
          this._drawPetal(ctx, p.x * w, p.y * h, p.size * w, p.rot, t * 2.2 + p.phase, alpha, p.tint);
        } else {
          this._drawFallingMaple(ctx, p.x * w, p.y * h, p.size * w, p.rot, t * 1.6 + p.phase, alpha, p.tint);
        }
      } else if (p.kind === 'snow') {
        const sway = Math.sin(t * 1.15 + p.phase) * 0.012;
        p.x += (p.vx * windMult + sway) * dt;
        p.y += p.vy * dt;
        if (p.y > 1.04) {
          p.y = -0.03;
          p.x = (p.x + 0.37) % 1.0;
        }
        if (p.x < -0.02) p.x += 1.04;
        if (p.x > 1.02) p.x -= 1.04;

        const px = p.x * w;
        const py = p.y * h;
        const sr = Math.max(1.0, p.size * w);
        ctx.fillStyle = `rgba(226, 242, 255, ${p.alpha})`;
        ctx.beginPath();
        ctx.arc(px, py, sr, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'glint') {
        p.x += (p.vx + Math.sin(t * 0.8 + p.phase) * 0.005) * dt;
        p.y += (p.vy + Math.cos(t * 0.7 + p.phase) * 0.004) * dt;
        if (p.x < 0.05) p.x = 0.95;
        if (p.x > 0.95) p.x = 0.05;
        if (p.y < 0.08) p.y = 0.92;
        if (p.y > 0.92) p.y = 0.08;

        const pulse = 0.25 + 0.75 * Math.pow(0.5 + 0.5 * Math.sin(t * 1.7 + p.phase), 2.0);
        const sr = Math.max(1.2, p.size * w);
        ctx.fillStyle = `rgba(232, 255, 196, ${0.55 * pulse})`;
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, sr, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    return this.canvas;
  }
}
