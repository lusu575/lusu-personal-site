import { bend, fish, lilyPad, lotusBloom, mixColor, reeds, seasons } from "./point-sets.mjs";

const TAU = Math.PI * 2;

// [environment points, fish, dots/fish, ghosts, dots/reed, dots/flora slot,
//  shared wave slots, dots/wave, DPR ceiling, backing pixel ceiling]
export const quality = [
  [128, 5, 96, 3, 80, 64, 4, 64, 2, 3200000],
  [80, 4, 72, 2, 56, 48, 3, 48, 1.5, 2000000],
  [48, 3, 48, 1, 36, 32, 2, 32, 1, 1200000],
  [24, 2, 32, 0, 24, 20, 1, 24, 0.85, 680000]
];

const seeds = new Float32Array(128 * 3);
for (let i = 0; i < 128; i++) {
  seeds[3 * i] = (0.37 + i * 0.754877666) % 1;
  seeds[3 * i + 1] = (0.59 + i * 0.569840296) % 1;
  seeds[3 * i + 2] = i * 2.39996;
}

const circles = quality.map(q => {
  const xy = new Float32Array(q[7] * 2);
  for (let i = 0; i < q[7]; i++) {
    xy[i * 2] = Math.cos(TAU * i / q[7]);
    xy[i * 2 + 1] = Math.sin(TAU * i / q[7]);
  }
  return xy;
});

// Four micro-points per environmental fragment. Summer scatters them as
// glints; the other seasons cluster them into petals, leaf flecks or sleet.
const flecks = [
  [-2, 1, -0.5, 0, 1, -1, 1.8, 0.2],
  [-8, 2, 1, -5, 9, 0, 3, 6],
  [-2.6, 1, -0.8, -0.8, 0, 0.9, 2, -1.5],
  [-4, 0, -1.8, 0.6, 0.4, 1.3, 4, -3]
];

export function createPond(canvas) {
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return null;
  let tier = 0;
  let w = 1;
  let h = 1;
  let dpr = 1;
  let unit = 1;
  let clock = 0;
  let fishTime = 0;
  let season = -1;
  let dots = 0;
  let calm = false;
  let winter = 0;
  let flora = 1;
  const ink = [];
  const fragment = new Float32Array(8);
  const weights = [0.50, 1, 0.43, 0];
  const waves = [];

  function setSeason(value) {
    if (!Number.isFinite(value)) return;
    const p = Math.max(0, Math.min(3, value));
    if (p === season) return;
    season = p;
    const a = Math.floor(p);
    const b = Math.ceil(p);
    const f = p % 1;
    winter = Math.max(0, p - 2);
    flora = weights[a] + (weights[b] - weights[a]) * f;
    for (let i = 0; i < 4; i++) ink[i] = mixColor(seasons[a].colors[i], seasons[b].colors[i], f);
    for (let i = 0; i < 8; i++) fragment[i] = flecks[a][i] + (flecks[b][i] - flecks[a][i]) * f;
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

  function ripple(x, y, kind = "tap") {
    if (waves.length >= quality[tier][6]) waves.shift();
    waves.push({ x, y, kind, age: 0 });
  }

  function drawFish(id, t, ghost, n) {
    const a = id * 2.4 + t * (0.085 + id * 0.009);
    const b = a * 1.7 + id;
    const x = w * (0.51 + 0.35 * Math.cos(a));
    const y = h * (0.50 + 0.26 * Math.sin(b));
    const dx = -w * 0.35 * Math.sin(a);
    const dy = h * 0.442 * Math.cos(b);
    const length = Math.hypot(dx, dy) || 1;
    const scale = unit * (0.66 + 0.08 * id);
    const ux = dx * scale / length;
    const uy = dy * scale / length;
    const phase = t * 3.4 + id;
    ctx.globalAlpha = ghost ? 0.2 / ghost : 0.85;
    for (let i = 0; i < n; i += ghost ? 4 : 1) {
      const fx = fish[i * 2];
      const fy = fish[i * 2 + 1] + bend(fx, phase);
      dot(x + fx * ux - fy * uy, y + fx * uy + fy * ux, ghost ? 1.25 : 1.65);
    }
  }

  function plant(points, n, x, y, scale) {
    for (let i = 0; i < n; i++) {
      dot(x + points[2 * i] * scale, y + points[2 * i + 1] * scale, 1.55);
    }
  }

  function draw(dt) {
    clock += dt * (calm ? 0.24 : 1);
    fishTime += dt * (calm ? 0.24 : 1) * (1 - 0.73 * winter);
    dots = 0;
    const q = quality[tier];
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = ink[0];
    ctx.globalAlpha = 0.57;
    for (let g = 0; g < q[0] / 4; g++) {
      const j = 3 * g;
      const phase = seeds[j + 2];
      const x = w * seeds[j] + 7 * Math.sin(clock * 0.21 + phase);
      const y = h * seeds[j + 1] + 4 * Math.cos(clock * 0.17 + phase);
      const shear = 0.4 * Math.sin(clock * 0.25 + phase);
      for (let k = 0; k < 8; k += 2) {
        dot(x + fragment[k] + shear * fragment[k + 1],
          y + fragment[k + 1] * (g % 2 ? -1 : 1), k === 6 ? 1 : 1.45);
      }
    }

    if (winter < 1) {
      ctx.fillStyle = ink[1];
      ctx.globalAlpha = 0.68 * (1 - winter);
      for (let k = 0; k < 6; k++) {
        const x = w * ((0.08 + k * 0.387) % 1);
        const y = h * (k % 2 ? 0.93 : 0.27);
        const sway = Math.sin(clock * 0.52 + k) * 0.15;
        for (let i = 0; i < q[4]; i++) {
          const ry = reeds[i * 2 + 1];
          dot(x + unit * (reeds[i * 2] + ry * ry * sway), y + unit * ry, 1.55);
        }
      }
    }

    ctx.fillStyle = ink[2];
    const count = 1 + Math.round((q[1] - 1) * (1 - winter) ** 2);
    const ghosts = Math.round(q[3] * (1 - winter));
    for (let k = 0; k < count; k++) {
      for (let g = ghosts; g >= 0; g--) drawFish(k, fishTime - g * 0.17, g, q[2]);
    }

    if (flora > 0) {
      const drift = 2.5 * Math.sin(clock * 0.28);
      const x = w * 0.67 + drift;
      const y = h * 0.39 + 1.8 * Math.cos(clock * 0.23);
      ctx.globalAlpha = flora * 0.83;
      ctx.fillStyle = ink[1];
      plant(lilyPad, q[5], w * 0.29 - drift, h * 0.57, unit * 0.64);
      plant(lilyPad, q[5], x, y, unit * 0.87);
      ctx.fillStyle = ink[3];
      plant(lotusBloom, q[5], x - unit * 0.30, y - unit * 0.33, unit * 0.42);
    }

    ctx.fillStyle = ink[3];
    const circle = circles[tier];
    for (let k = waves.length - 1; k >= 0; k--) {
      const wave = waves[k];
      const tap = wave.kind === "tap";
      const prep = tap ? 0.060 : 0;
      const age = wave.age;
      wave.age += dt;
      if (age >= prep + 1.25) {
        waves.splice(k, 1);
        continue;
      }
      const f = Math.max(0, (age - prep) / 1.25);
      const reach = tap ? unit * (calm ? 1 : 2.5) : Math.hypot(w, h) * 0.63;
      const radius = age < prep ? 6 + 10 * (1 - age / prep)
        : 6 + reach * f * (2 - f);
      ctx.globalAlpha = age < prep ? 0.38 + 0.47 * age / prep : 0.85 * (1 - f);
      for (let j = 0; j < circle.length; j += 2) {
        dot(wave.x * w + radius * circle[j], wave.y * h + radius * circle[j + 1] * (tap ? 0.78 : 1), 2);
      }
    }
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
