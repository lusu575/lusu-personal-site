import { fallenLeaf, fish, frost, lilyPad, lotusBloom, mixColor, reeds, seasons } from "./point-sets.mjs";

const TAU = Math.PI * 2;
const pads = [[.32,.612,.98], [.778,.373,.85]];

// [environment points, fish, dots/fish, ghosts, dots/reed, dots/flora slot,
//  shared wave slots, dots/wave, DPR ceiling, backing pixel ceiling]
export const quality = [
  [128, 3, 1536, 2, 80, 64, 4, 64, 1.5, 1600000],
  [80, 3, 960, 1, 56, 48, 3, 48, 1.25, 1360000],
  [48, 2, 576, 1, 36, 32, 2, 32, 1, 1200000],
  [24, 2, 288, 0, 24, 20, 1, 24, 0.85, 680000]
];

// Immutable material buckets keep each colour one Canvas state change,
// rather than one state change per mote. Bend terms are local to the spine.
const bendSin = new Float32Array(fish.length / 2), bendCos = bendSin.slice();
for (let i=0; i<bendSin.length; i++) {
  const x=fish[i*2], amp=.34*(.5*(1-x))**2;
  bendSin[i]=amp*Math.sin(x*2.8); bendCos[i]=amp*Math.cos(x*2.8);
}
const koiInk = quality.map(q => Array.from({length:q[1]}, (_,id) => {
  const batches = [[],[],[],[]];
  for (let i=0;i<q[2];i++) {
    const x=fish[i*2], y=fish[i*2+1];
    const red = Math.sin(8*x - 4*y + id) + .67*Math.cos(13*y + x*4);
    batches[x < -.76 || i%11 === 0 ? 0 : red < -.14 ? 1 : red > .66 ? 2 : 3].push(i);
  }
  return batches.map(batch=>Uint16Array.from(batch));
}));
const koiMaterials = [2,5,4,6];

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
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return null;
  let tier = 0;
  let w = 1;
  let h = 1;
  let dpr = 1;
  let unit = 1;
  let clock = 0;
  let nextWake = 1.8;
  let fishTime = 0;
  let season = -1;
  let dots = 0;
  let calm = false;
  let winter = 0;
  let canopy = 0;
  let flora = 1;
  const ink = [];
  const fragment = new Float32Array(8);
  const flotsam = new Float32Array(lilyPad.length);
  const weights = [0.50, 1, 0.32, 0];
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
    canopy = Math.min(1, Math.abs(p - 1));
    flora = weights[a] + (weights[b] - weights[a]) * f;
    for (let i = 0; i < 4; i++) ink[i] = mixColor(seasons[a].colors[i], seasons[b].colors[i], f);
    const leaf = Math.min(1, Math.max(0, p - 1));
    for (let i = 0; i < flotsam.length; i++) {
      const xy = lilyPad[i] + leaf * (fallenLeaf[i] - lilyPad[i]);
      flotsam[i] = xy + winter * (frost[i] - xy);
    }
    ink[4] = mixColor(0xe88e52, 0xa4baca, winter);
    ink[5] = mixColor(0xffedbf, 0xc9d9e0, winter);
    ink[6] = mixColor(0xca6341, 0x7b9aac, winter);
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
    unit = Math.min(65, Math.max(16, Math.min(w, h) * 0.055));
  }

  function dot(x, y, size) {
    // Project every live mote through the same shallow CRT glass.
    const u = x / w - .5, v = y / h - .5;
    ctx.fillRect(x - .04 * w * u * v * v, y - .04 * h * v * u * u, size, size);
    dots++;
  }

  function ripple(x, y, kind = "tap") {
    if (waves.length >= quality[tier][6]) waves.shift();
    const u = x - .5, v = y - .5;
    // Inverse of the shallow projection (sub-pixel residual at the edges).
    waves.push({ x: x + .04 * u * v * v, y: y + .04 * v * u * u, kind, age: 0, radius: 0, alpha: 1 });
  }

  function displacement(x, y) {
    let offset = 0;
    for (const wave of waves) {
      const d = Math.hypot(x - wave.x * w, (y - wave.y * h) / .78);
      if (wave.age < .060 && wave.kind === 'tap') {
        offset += Math.max(0, 1 - d / 30) * 3;
      } else {
        const gap = d - wave.radius;
        if (Math.abs(gap) < 30) offset += 3 * wave.alpha * (1 - Math.abs(gap) / 30) * Math.cos(gap * .35);
      }
    }
    return offset;
  }

  function drawFish(id, t, ghost) {
    const a = 1.05 + id * 2.14 + t * (0.076 + id * 0.009);
    const b = a * 1.7 + id;
    const x = w * (0.51 + 0.18 * Math.cos(a));
    const baseY = h * (0.50 + 0.17 * Math.sin(b));
    const y = baseY + displacement(x, baseY);
    const dx = -w * 0.18 * Math.sin(a);
    const dy = h * 0.289 * Math.cos(b);
    const length = Math.hypot(dx, dy) || 1;
    const scale = unit * (2.34 - 0.40 * id);
    const ux = dx * scale / length;
    const uy = dy * scale / length;
    const phase = t * 3.4 + id;
    ctx.globalAlpha = ghost ? .27 / ghost : id > 1 ? .17 : .96 - winter*.24;
    const sin = Math.sin(phase), cos = Math.cos(phase);
    for (let b=0; b<4; b++) {
      const indices=koiInk[tier][id][b];
      ctx.fillStyle = ink[ghost ? 2 : koiMaterials[b]];
      for (let k=0; k<indices.length; k += ghost ? 4 : 1) {
        const i=indices[k], fx=fish[i*2];
        if (ghost && fx > -.45) continue;
        const fy=fish[i*2+1] + bendSin[i]*cos + bendCos[i]*sin;
        dot(x + (fx - ghost*.12) * ux - fy * uy, y + fx * uy + fy * ux + Math.sin(fx*6+t)*.85, ghost ? 1.45 : 1.95);
      }
    }
  }

  function plant(points, n, x, y, scale) {
    for (let i = 0; i < n; i++) {
      dot(x + points[2 * i] * scale, y + points[2 * i + 1] * scale, 1.55);
    }
  }

  // Two low shoreline boughs: stippled petal clusters in spring, amber
  // leaves in autumn and exposed icy twigs in winter. No sprite textures.
  function drawBank(n) {
    if (canopy === 0) return;
    for (let side = 0; side < 2; side++) {
      const dir = side ? -1 : 1, bx = side ? w * 1.01 : -unit, by = side ? h : 0;
      for (let i = 0; i < n * 3; i++) {
        const s = (i * .618034) % 1;
        const b = Math.floor(s * 7), twig = (i % 4) / 3;
        const x = bx + dir * unit * (s * 7 + twig * .64);
        const y = by + dir * unit * (.3 + 1.2 * Math.sin(s * 2.8) + s * .6 + twig * Math.cos(b * 2) * 1.2);
        ctx.fillStyle = ink[1];
        ctx.globalAlpha = canopy * (.42 + .25 * s);
        dot(x, y, 1.3);
        const j = (i % 64) * 2;
        const reach = unit * (.19 + s * .12);
        ctx.fillStyle = ink[3];
        ctx.globalAlpha = canopy * (.38 + .44 * ((i * .4142) % 1));
        const shape = season < 1 ? lotusBloom : flotsam;
        dot(x + shape[j] * reach, y + shape[j+1] * reach, 1.7);
      }
    }
  }

  function draw(dt, backdrop) {
    clock += dt * (calm ? 0.24 : 1);
    fishTime += dt * (calm ? 0.24 : 1) * (1 - 0.73 * winter);
    if (!calm && clock >= nextWake) {
      const head = 1.05 + fishTime*.076;
      if (!waves.length) ripple(.51 + .18 * Math.cos(head), .5 + .17 * Math.sin(head*1.7), 'wake');
      nextWake = clock + 3.3;
    }
    for (const wave of waves) {
      wave.age += dt;
      const prep = wave.kind === 'tap' ? .06 : 0;
      const sweep = wave.kind === 'sweep';
      const f = Math.max(0, (wave.age - prep) / (sweep ? .72 : 1.25));
      const reach = sweep ? Math.hypot(w, h) * 1.25 : unit * (wave.kind === 'wake' ? 1.4 : 3.3);
      wave.radius = wave.age < prep ? 16 - 10 * wave.age / prep : 7 + reach * Math.min(1, f);
      wave.alpha = Math.max(0, 1 - f) * (wave.kind === 'wake' ? .38 : .92);
    }
    dots = 0;
    const q = quality[tier];
    if (backdrop) backdrop(ctx, w, h);
    else ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = ink[0];
    ctx.globalAlpha = 0.57;
    for (let g = 0; g < q[0] / 4; g++) {
      const j = 3 * g;
      const phase = seeds[j + 2];
      const x = w * seeds[j] + 7 * Math.sin(clock * 0.21 + phase);
      const y = h * seeds[j + 1] + 4 * Math.cos(clock * 0.17 + phase);
      const offset = displacement(x, y);
      const shear = 0.4 * Math.sin(clock * 0.25 + phase);
      for (let k = 0; k < 8; k += 2) {
        dot(x + fragment[k] + shear * fragment[k + 1],
          y + offset + fragment[k + 1] * (g % 2 ? -1 : 1), k === 6 ? 1 : 1.45);
      }
    }

    if (winter < 1) {
      ctx.fillStyle = ink[1];
      ctx.globalAlpha = 0.68 * (1 - winter);
      for (let k = 0; k < 6; k++) {
        const x = w * ((0.06 + k * 0.217) % 1);
        const y = h * (k % 2 ? 0.87 + .09 * Math.cos(k) : 0.22 + .11 * Math.sin(k));
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
      for (let g = ghosts; g >= 0; g--) drawFish(k, fishTime - g * 0.17, g);
    }

    if (flora > 0) {
      const drift = 2.5 * Math.sin(clock * 0.28);
      const x = w * 0.67 + drift;
      const y = h * 0.39 + 1.8 * Math.cos(clock * 0.23);
      ctx.globalAlpha = flora * 0.83;
      ctx.fillStyle = ink[1];
      plant(lilyPad, q[5], w * 0.29 - drift, h * 0.57, unit * 0.64);
      plant(lilyPad, q[5], x, y, unit * 1.15);
      ctx.fillStyle = ink[3];
      plant(lotusBloom, q[5], x - unit * 0.30, y - unit * 0.33, unit * 0.42);
    }

    ctx.fillStyle = ink[1];
    for (const [px, py, size] of pads) {
      const sway = Math.sin(clock * .26 + px * 9);
      const x = w * px + 2 * sway, y = h * py;
      ctx.globalAlpha = .68 + .14 * sway;
      plant(flotsam, q[5] * 9, x, y + displacement(x, y), unit * size);
    }

    drawBank(q[5]);
    ctx.fillStyle = ink[3];
    const circle = circles[tier];
    for (let k = waves.length - 1; k >= 0; k--) {
      const wave = waves[k];
      if (!wave.alpha) {
        waves.splice(k, 1);
        continue;
      }
      const rings = wave.kind === 'sweep' ? 1 : 3;
      for (let ring = 0; ring < rings; ring++) {
        const radius = wave.radius - ring * 8;
        if (radius < 2) continue;
        ctx.globalAlpha = wave.alpha / (1 + ring * .6);
        for (let j = 0; j < circle.length; j += 2) {
          dot(wave.x * w + radius * circle[j], wave.y * h + radius * circle[j + 1] * .78, 1.8);
        }
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
