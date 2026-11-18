import { bend, fish, mixColor, reeds, seasons } from "./point-sets.mjs";

const TAU = Math.PI * 2;

// [dust, fish count, dots/fish, ghosts/fish, dots/reed, dots/mark,
//  simultaneous waves, dots/wave, DPR ceiling, backing-pixel ceiling]
export const quality = [
  [128, 5, 96, 3, 80, 64, 4, 64, 2, 3200000],
  [80, 4, 72, 2, 56, 48, 3, 48, 1.5, 2000000],
  [48, 3, 48, 1, 36, 32, 2, 32, 1, 1200000],
  [24, 2, 32, 0, 24, 20, 1, 24, 0.85, 680000]
];

const dust = new Float32Array(128 * 3);
for (let i = 0; i < 128; i++) {
  dust[i * 3] = (0.37 + i * 0.754877666) % 1;
  dust[i * 3 + 1] = (0.59 + i * 0.569840296) % 1;
  dust[i * 3 + 2] = i * 2.39996;
}

// Precompute unit circles so click bursts don't add per-dot trig.
const circles = quality.map(q => {
  const xy = new Float32Array(q[7] * 2);
  for (let i = 0; i < q[7]; i++) {
    xy[i * 2] = Math.cos(i * TAU / q[7]);
    xy[i * 2 + 1] = Math.sin(i * TAU / q[7]);
  }
  return xy;
});

export function createPond(canvas) {
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return null;

  let tier = 0;
  let w = 1;
  let h = 1;
  let dpr = 1;
  let unit = 1;
  let clock = 0;
  let season = -1;
  let dots = 0;
  let calm = false;
  const ink = [];
  const mark = new Float32Array(128);
  const waves = [];

  function setSeason(value) {
    if (!Number.isFinite(value)) return;
    const p = Math.min(3, Math.max(0, value));
    if (p === season) return;
    season = p;
    const a = seasons[Math.floor(p)];
    const b = seasons[Math.ceil(p)];
    const f = p % 1;
    for (let i = 0; i < mark.length; i++) mark[i] = a.mark[i] + (b.mark[i] - a.mark[i]) * f;
    for (let i = 0; i < 4; i++) ink[i] = mixColor(a.colors[i], b.colors[i], f);
  }

  function resize(width, height, level, reduced) {
    tier = level;
    calm = reduced;
    const q = quality[tier];
    if (waves.length > q[6]) waves.splice(0, waves.length - q[6]);
    w = Math.max(1, width);
    h = Math.max(1, height);
    dpr = Math.min(window.devicePixelRatio || 1, q[8], Math.sqrt(q[9] / (w * h)));
    const bw = Math.max(1, Math.floor(w * dpr));
    const bh = Math.max(1, Math.floor(h * dpr));
    if (canvas.width !== bw) canvas.width = bw;
    if (canvas.height !== bh) canvas.height = bh;
    ctx.setTransform(bw / w, 0, 0, bh / h, 0, 0);
    unit = Math.min(50, Math.max(16, Math.min(w, h) * 0.05));
  }

  function dot(x, y, size) {
    ctx.fillRect(x, y, size, size);
    dots++;
  }

  function ripple(x, y) {
    if (waves.length === quality[tier][6]) waves.shift();
    waves.push({ x, y, age: 0 });
  }

  function drawFish(id, time, ghost, n) {
    const a = id * 2.4 + time * (0.085 + id * 0.009);
    const b = a * 1.7 + id;
    const x = w * (0.51 + 0.35 * Math.cos(a));
    const y = h * (0.5 + 0.26 * Math.sin(b));
    const dx = -w * 0.35 * Math.sin(a);
    const dy = h * 0.442 * Math.cos(b);
    const length = Math.hypot(dx, dy) || 1;
    const scale = unit * (0.66 + 0.08 * id);
    const ux = dx * scale / length;
    const uy = dy * scale / length;
    const phase = time * 3.4 + id;
    ctx.globalAlpha = ghost ? 0.2 / ghost : 0.85;
    // Each ghost is a sparse sample at an earlier point on the same orbit.
    for (let i = 0; i < n; i += ghost ? 4 : 1) {
      const fx = fish[i * 2];
      const fy = fish[i * 2 + 1] + bend(fx, phase);
      dot(x + fx * ux - fy * uy, y + fx * uy + fy * ux, ghost ? 1.25 : 1.65);
    }
  }

  function draw(dt) {
    clock += dt * (calm ? 0.24 : 1);
    dots = 0;
    const q = quality[tier];
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = ink[0];
    ctx.globalAlpha = 0.48;
    for (let i = 0; i < q[0]; i++) {
      const j = 3 * i;
      dot(w * dust[j] + 5 * Math.sin(clock * 0.32 + dust[j + 2]),
        h * dust[j + 1] + 3 * Math.cos(clock * 0.25 + dust[j + 2]), 1.2);
    }

    ctx.fillStyle = ink[1];
    ctx.globalAlpha = 0.68;
    for (let k = 0; k < 6; k++) {
      const x = w * ((0.08 + k * 0.387) % 1);
      const y = h * (k % 2 ? 0.93 : 0.27);
      const sway = Math.sin(clock * 0.52 + k) * 0.15;
      for (let i = 0; i < q[4]; i++) {
        const ry = reeds[i * 2 + 1];
        dot(x + unit * (reeds[i * 2] + ry * ry * sway), y + unit * ry, 1.55);
      }
    }

    ctx.fillStyle = ink[2];
    for (let k = 0; k < q[1]; k++) {
      for (let g = q[3]; g >= 0; g--) drawFish(k, clock - g * 0.17, g, q[2]);
    }

    ctx.fillStyle = ink[3];
    ctx.globalAlpha = 0.65;
    for (let k = 0; k < 3; k++) {
      const x = w * (0.22 + k * 0.28);
      const y = h * (0.32 + 0.15 * (k % 2)) + 2 * Math.sin(clock + k);
      for (let i = 0; i < q[5]; i++) {
        dot(x + unit * 0.42 * mark[2 * i], y + unit * 0.42 * mark[2 * i + 1], 1.6);
      }
    }

    const circle = circles[tier];
    for (let k = waves.length - 1; k >= 0; k--) {
      const wave = waves[k];
      wave.age += dt;
      if (wave.age >= 1.25) {
        waves.splice(k, 1);
        continue;
      }
      const f = wave.age / 1.25;
      const radius = 6 + unit * (calm ? 1 : 2.5) * f * (2 - f);
      ctx.globalAlpha = 0.85 * (1 - f);
      for (let j = 0; j < circle.length; j += 2) {
        dot(wave.x * w + radius * circle[j], wave.y * h + radius * circle[j + 1] * 0.78, 2);
      }
    }

    // Faint CRT return sweep; static scanlines/vignette stay in CSS.
    if (!calm && tier < 2) {
      ctx.fillStyle = "#c3e3eb";
      ctx.globalAlpha = 0.035;
      ctx.fillRect(0, (clock * 26) % (h + 4) - 4, w, 3);
    }
    ctx.globalAlpha = 1;
    return dots;
  }

  setSeason(1);
  return { resize, draw, ripple, setSeason, get dpr() { return dpr; } };
}
