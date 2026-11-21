import { fallenLeaf, fish, frost, lilyPad, mixColor, petal, reeds, seasons, summerPads } from "./point-sets.mjs";

import { createFrameRaster, packedColour } from './frame-raster.mjs';

const TAU = Math.PI * 2;
const koiScale = [2.14, 2.04, 1.73];
// Surface waves have their own phases and never take an input-wave slot.
const pools = [
  [.452, .565, .37, .44], [.665, .393, .72, .37], [.27, .782, .12, .33]
];

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
  const batches = [[],[],[],[],[],[]];
  for (let i=0;i<q[2];i++) {
    const x=fish[i*2], y=fish[i*2+1];
    const saddle = Math.sin(9.2*x + 5*y + id*.95) + .49*Math.cos(12*y - 2*x);
    const spot = ((x + .11 - id*.17)/.17)**2 + ((y - .11)/.095)**2;
    const tail = i % 5 === 0;
    const material = tail && x < -1.06 ? 0 : tail || i % 11 === 1 ? 1
      : spot < .93 ? 2 : saddle > .47 ? 3 : saddle > .18 ? 4 : 5;
    batches[material].push(i);
  }
  return batches.map(batch=>Uint16Array.from(batch));
}));
const koiMaterials = [2, 5, 6, 4, 7, 5];
const koiOpacity = [.40, .73, .61, 1, .96, 1];

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
const surfaceCircles = quality.map((_, tier) => {
  const n = [224, 152, 104, 64][tier];
  return Array.from({length:n}, (_,i) => {
    const a = TAU * (i + .21 * Math.sin(i * 9.15)) / n;
    const light = Math.round(2 + 1.9 * Math.sin(3*a + .55));
    const shape = 1 + .028*Math.sin(5*a + .6);
    return [Math.cos(a)*shape, Math.sin(a)*shape, light];
  });
});

const leafGroups = [
  [.21,.29,.028,-.84], [.14,.62,.035,.38], [.34,.75,.029,-1.37],
  [.70,.57,.028,.68], [.83,.42,.024,-.62], [.58,.81,.040,-.38],
  [.91,.65,.019,1.13], [.77,.90,.026,.56], [.051,.81,.025,1.22],
  [.37,.29,.018,-.45], [.48,.93,.021,.48], [.935,.29,.016,-1.25]
];
const surfacePlants = [
  Array.from({length:38}, (_,i) => [
    .04 + .92*((.19+i*.618034)%1), .20+.77*((.23+i*.414214)%1),
    .006+.012*((.31+i*.7777)%1)**2, i*2.4, .60+.39*((i*.127)%1)
  ]),
  summerPads,
  [...leafGroups.map(([x,y,r,a],i) => [x,y,r*1.16,a,.87+.12*Math.cos(i)]),
    ...Array.from({length:30}, (_,i) => {
      const [x,y,r,a]=leafGroups[i%leafGroups.length];
      const phase=i*2.39996;
      return [x+.04*Math.cos(phase),y+.08*Math.sin(phase),r*(.20+.22*((i*.618)%1)),a-phase,.41+.39*((i*.29)%1)];
    })],
  Array.from({length:28}, (_,i) => [
    .03+.94*((.31+i*.618034)%1), .14+.82*((.49+i*.414214)%1),
    .002+.005*((i*.727)%1)**2, i*.42, .38+.38*((i*.313)%1)
  ])
];
const plantShapes = [petal,lilyPad,fallenLeaf,frost];
const plantColors = [
  [0xe6a2b2,0xffcfc9],[0x65994d,0xc6d887],[0xb55924,0xf39945],[0x89aec8,0xd9eaf3]
];
function brightPlantPoint(season, i) {
  return (season===1 && i%13<3) || (season===2 && i%9===0);
}
const plantShades = plantShapes.map((points,s) => Uint8Array.from({length:points.length/2}, (_,i) => {
  const light = (Math.sin(points[2*i]*7-points[2*i+1]*8)+1)*.5;
  return brightPlantPoint(s,i) ? 2 : light>(i*.618034)%1 ? 1 : 0;
}));

export function createPond(canvas, bed = null) {
  const native = canvas.getContext("2d", { alpha: false });
  if (!native) return null;
  // The same dot geometry also supports drawing ink alone on a Canvas2D.
  const raster = bed ? createFrameRaster(native, bed) : null;
  const ctx = raster || native;
  const colour = raster ? packedColour : mixColor;
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

  const ink = [];
  const plantInk = plantColors.map(([shade,light]) =>
    [.05,.42,.78].map(f => colour(shade,light,f)));
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

    const aInk=seasons[a].colors, bInk=seasons[b].colors;
    for (let i = 1; i < 4; i++) ink[i] = colour(aInk[i], bInk[i], f);
    ink[4] = colour(0xff8d3c, 0xc4a285, winter);
    ink[5] = colour(0xfff3d4, 0xb8cfda, winter);
    ink[6] = colour(0x4b3a30, 0x556d80, winter);
    ink[7] = colour(0xffbb65, 0x92a8b9, winter);
    ink[8] = colour(0xe0fdd2, 0xd2e4f2, winter);
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
    if (raster) raster.resize(bw,bh,w,h);
    else native.setTransform(bw / w, 0, 0, bh / h, 0, 0);
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
    const scale = unit * koiScale[id];
    const ux = dx * scale / length;
    const uy = dy * scale / length;
    const phase = t * 3.4 + id;
    const alpha = ghost ? .22 / ghost : id > 1 ? .19 : .82 - winter*.19;
    const sin = Math.sin(phase), cos = Math.cos(phase);
    if (!ghost) {
      ctx.fillStyle = ink[2];
      ctx.globalAlpha = alpha * .25;
      for (let i=0; i<quality[tier][2]; i+=5) {
        const fx=fish[i*2], fy=fish[i*2+1]+bendSin[i]*cos+bendCos[i]*sin;
        dot(x+fx*ux-fy*uy-1.4, y+fx*uy+fy*ux-1.4, 4.3);
      }
    }
    for (let b=0; b<koiMaterials.length; b++) {
      const indices=koiInk[tier][id][b];
      ctx.globalAlpha = alpha * koiOpacity[b];
      ctx.fillStyle = ink[ghost ? 2 : koiMaterials[b]];
      for (let k=0; k<indices.length; k += ghost ? 4 : 1) {
        const i=indices[k], fx=fish[i*2];
        if (ghost && fx > -.45) continue;
        const fy=fish[i*2+1] + bendSin[i]*cos + bendCos[i]*sin;
        const drift = b === 0 ? Math.sin(i + t*.8)*2.2 : 0;
        dot(x + (fx - ghost*.12) * ux - fy * uy + drift,
          y + fx * uy + fy * ux + Math.sin(fx*6+t)*.85 - drift*.5, ghost || b === 0 ? 1.4 : b === 1 ? 2 : 2.55);
      }
    }
  }

  function drawSurface(n) {
    const circle = surfaceCircles[tier];
    const activity = waves.some(wave => wave.kind !== 'wake' && wave.alpha > .1) ? .62 : 1;
    const depth = 1 - .42 * winter;
    ctx.fillStyle = ink[8];
    for (const [px, py, phase, tilt] of pools) {
      const reach = Math.min(w*.19, h*.32);
      for (let ring = 0; ring < 3; ring++) {
        const age = (phase + (calm ? 0 : clock/6.7) + ring*.135) % 1;
        const radius = 30 + reach*age;
        const fade = Math.min(1, age*9) * (1-age)**.69 * depth * activity;
        for (const [dx, dy, light] of circle) {
          ctx.globalAlpha = fade*(.29+light*.16);
          dot(px*w + dx*radius, py*h + dy*radius*tilt, light >= 3 ? 2.4 : 1.4);
        }
      }
    }
    for (let g = 0; g < n; g++) {
      const j = 3*g, phase = seeds[j+2];
      const shaft = g%4===0;
      const x = w*(shaft ? .35+.29*seeds[j] : seeds[j]), y = h*seeds[j+1];
      const pulse = .5 + .5*Math.sin(phase + (calm ? 0 : clock*(.5+(g%5)*.15)));
      ctx.globalAlpha = .22 + pulse*.50;
      dot(x, y + displacement(x,y), pulse > .83 ? 2.25 : 1.35);
      if (g % 8 === 0) {
        ctx.globalAlpha *= .44;
        dot(x - 3, y + .5, 1.2);
        dot(x + 3, y + .5, 1.2);
      }
    }
  }

  function floaters(s, opacity, q) {
    const points = plantShapes[s], inks = plantInk[s], shades = plantShades[s];
    const short = Math.min(w,h);
    for (const [px,py,r,rotation,lamp] of surfacePlants[s]) {
      const phase = px*45+py*28;
      const sway = Math.sin(clock*.27+phase);
      const x = px*w+2.8*sway, y = py*h+1.9*Math.cos(clock*.31+phase);
      const offset = displacement(x,y);
      const angle = rotation+.055*sway;
      const cos = Math.cos(angle), sin = Math.sin(angle);
      const scale = r*short;
      const n = s === 1 ? Math.min(points.length/2, Math.round(q[2]*r*14))
        : Math.min(q[5]*(r>.017?5:1),Math.max(6,Math.round(scale*scale*.53)));
      const size = s === 1 ? 2.25 + tier*.26 : Math.min(2.4,1 + scale*.06);
      ctx.globalAlpha = opacity*lamp;
      for (let k=0; k<n; k++) {
        const dx = points[2*k], dy = points[2*k+1]*(s===1 ? 1/.61 : 1);
        const light = shades[k];
        ctx.fillStyle = inks[light];
        dot(x + scale*(dx*cos-dy*sin),y + offset + scale*(dx*sin+dy*cos)*(s===1 ? .61 : 1),
          light===2 ? size*.85 : size);
      }
    }
  }

  function draw(dt, target=1, progress=1) {
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
    if (raster) raster.begin(target, progress);
    else native.clearRect(0, 0, w, h);
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
    if (count > 2) drawFish(2, fishTime, 0);
    for (let k = 0; k < Math.min(2, count); k++) {
      for (let g = ghosts; g >= 0; g--) drawFish(k, fishTime - g * 0.17, g);
    }

    drawSurface(q[0]);
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

    const a = Math.floor(season), f = season-a;
    floaters(a, 1-f, q);
    if (f > 0) floaters(a+1, f, q);
    if (!calm && tier < 2) {
      ctx.fillStyle = raster ? 0xffebe3c3 : "#c3e3eb";
      ctx.globalAlpha = 0.035;
      ctx.fillRect(0, (clock * 26) % (h + 4) - 4, w, 3);
    }
    ctx.globalAlpha = 1;
    raster?.end();
    return dots;
  }

  setSeason(1);
  return { resize, draw, ripple, setSeason, get dpr() { return dpr; } };
}
