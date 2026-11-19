export const FISH = Object.freeze({
  segments: 16,
  maxJointAngle: 0.22,
  waveNumber: 6.2,
  beatSpeedRatio: 0.90,
  glideSpeedRatio: 1.12,
  beatFrequency: 0.80,
  glideFrequency: 0.52,
  beatAmplitude: 0.088,
  glideAmplitude: 0.024,
  peduncle: 0.78
});

const MAIN_LENGTH_FRACTION = 0.187;

// Centers and radii use normalized pond coordinates, measured from the lower left.
export const KOI_ROUTES = [
  {
    seed: 932, lengthFraction: 0.134, cruiseSpeed: 0.103,
    center: [0.57, 0.790], radius: [0.182, 0.069], routePhase: 4.10, beatPhase: 2.6, lane: [0.681, 0.986],
    shoulderScale: 0.94, patchBias: [0, 0, 0]
  },
  {
    seed: 575, lengthFraction: MAIN_LENGTH_FRACTION, cruiseSpeed: 0.125,
    center: [0.43, 0.512], radius: [0.204, 0.081], routePhase: 5.42, beatPhase: 0.7, lane: [0.324, 0.681],
    shoulderScale: 1, patchBias: [0, 0, 0], tailPatch: true
  },
  {
    seed: 768, lengthFraction: 0.158, cruiseSpeed: 0.137,
    center: [0.58, 0.226], radius: [0.190, 0.073], routePhase: 1.15, beatPhase: 4.5, lane: [0.014, 0.324],
    shoulderScale: 0.92, patchBias: [0.012, -0.007, 0.009]
  }
];

const TAU = 2 * Math.PI;
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const mix = (from, to, amount) => from + (to - from) * amount;
const smoothstep = (edge0, edge1, x) => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};
const angleDifference = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

function easedInset(distance, edge) {
  const t = clamp((distance + edge) / (2 * edge), 0, 1);
  return t * t * edge + Math.max(0, distance - edge);
}

// True top-down Kohaku koi spindle profile: blunt rounded snout, muscular shoulder, slender caudal peduncle.
const WIDTHS = [
  [0, 0.029, 1.35],
  [0.036, 0.056, 0.58],
  [0.105, 0.075, 0.16],
  [0.215, 0.081, 0.01],
  [0.335, 0.073, -0.12],
  [0.495, 0.050, -0.17],
  [0.645, 0.024, -0.15],
  [FISH.peduncle, 0.011, -0.04]
];

function bodyWidth(along) {
  const index = WIDTHS.findIndex(([station]) => station >= along);
  if (index <= 0) return WIDTHS[Math.max(0, index)][1];
  const [start, startWidth, startSlope] = WIDTHS[index - 1];
  const [end, endWidth, endSlope] = WIDTHS[index];
  const span = end - start;
  const t = (along - start) / span;
  return mix(startWidth, endWidth, t * t * (3 - 2 * t)) +
    span * t * (1 - t) * mix(startSlope, -endSlope, t);
}

export function seededRandom(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function fishParticles({ seed, shoulderScale, patchBias, tailPatch }) {
  const random = seededRandom(seed);
  const particles = [];
  const pearl = [1.0, 0.97, 0.83];
  const vermilion = [0.99, 0.30, 0.11];

  // Classic Kohaku (红白锦鲤) dorsal Hi markings: bold irregular crown, shoulder saddle, and rump patches.
  const patchShapes = [
    [0.125, 0.008, 0.078, 0.054 * shoulderScale],
    [0.345, -0.014, 0.115, 0.068 * shoulderScale],
    [0.575, 0.012, 0.080, 0.044]
  ];
  if (tailPatch) patchShapes.push([0.695, -0.005, 0.036, 0.022]);

  const patches = patchShapes.map(([center, side, length, width], index) => [
    center + (random() - 0.5) * 0.028,
    side + (patchBias[index] ?? 0) + (random() - 0.5) * 0.018,
    length * (0.94 + 0.14 * random()),
    width * (0.94 + 0.14 * random()),
    (random() - 0.5) * 0.48,
    TAU * random(),
    TAU * random()
  ]);

  // Deterministic organic boundary warp for realistic non-elliptical Kohaku Hi edges.
  const warpP1 = TAU * random();
  const warpP2 = TAU * random();
  const warpP3 = TAU * random();
  function patchField(along, across) {
    const wx = 0.018 * Math.sin(along * 26.0 + across * 32.0 + warpP1) +
               0.010 * Math.cos(along * 52.0 - across * 44.0 + warpP2);
    const wy = 0.011 * Math.cos(along * 31.0 - across * 28.0 + warpP3) +
               0.006 * Math.sin(along * 58.0 + across * 41.0 + warpP1);
    const ax = along + wx;
    const ay = across + wy;
    let best = Infinity;
    for (const [center, side, length, width, skew, ph1, ph2] of patches) {
      const lx = (ax - center) / length;
      const ly = (ay - side) / width + skew * lx;
      const angle = Math.atan2(ly, lx);
      const lobe = 1.0 + 0.18 * Math.sin(2.0 * angle + ph1) + 0.11 * Math.cos(3.0 * angle + ph2);
      const d = (lx * lx + ly * ly) / (lobe * lobe);
      if (d < best) best = d;
    }
    return best;
  }

  function add(along, across, color, opacity, size, drift = 0, floatBack = 0, tailLag = 0) {
    const micro = 0.90 + 0.10 * random();
    const station = clamp(along, 0, 1) * FISH.segments;
    const joint = Math.min(Math.floor(station), FISH.segments - 1);
    particles.push({
      joint, blend: station - joint, across, opacity, size, drift, floatBack, tailLag,
      phase: TAU * random(),
      color: color.map((channel) => channel * micro)
    });
  }

  // 1. Pectoral, pelvic, and forked caudal fins drawn beneath the body layer.
  for (const side of [-1, 1]) {
    // Pectoral fans: rooted right behind the operculum, sweeping outward and smoothly back.
    for (let ray = 0; ray < 9; ray += 1) {
      const fan = ray / 8;
      for (let grain = 0; grain < 16; grain += 1) {
        const t = (grain + random()) / 16;
        const reach = Math.sin(Math.PI * (0.08 + 0.62 * t));
        const sweep = 0.058 + reach * (0.115 - 0.068 * fan * fan);
        const along = 0.195 + 0.095 * t + reach * (0.110 * fan - 0.012);
        const across = side * (sweep + (random() - 0.5) * 0.008);
        const isRib = ray % 2 === 0;
        const lum = (isRib ? 0.98 : 0.85) * (1.0 - 0.14 * t);
        const opacity = mix(0.64, 0.22, t) + (isRib ? 0.10 : 0.04) * random();
        add(along, across, [lum, 0.93 * lum, 0.74 * lum], opacity,
          1.75 + (1.0 - 0.35 * t) * 1.25 * random(), t * 0.009, 0.008 * t);
      }
    }

    // Pelvic fans: tucked naturally at mid-belly.
    for (let ray = 0; ray < 4; ray += 1) {
      const fan = ray / 3;
      for (let grain = 0; grain < 7; grain += 1) {
        const t = (grain + random()) / 7;
        const across = side * (0.042 + 0.032 * Math.sin(Math.PI * t * 0.7) * (1 - 0.30 * fan));
        const along = 0.475 + (0.082 + 0.026 * fan) * t;
        add(along, across, [0.90, 0.82, 0.62], 0.26 + 0.22 * random(), 1.35 + 0.75 * random(), t * 0.005);
      }
    }

    // Forked caudal fin: two distinct tapering lobes fanning from the peduncle with a crisp V-notch.
    const lobeRays = 7;
    for (let ray = 0; ray < lobeRays; ray += 1) {
      const fan = ray / (lobeRays - 1); // 0 = inner fork edge, 1 = outer lobe edge
      const rayLen = mix(0.115, 0.235, Math.sin(Math.PI * (0.15 + 0.62 * fan)));
      const grains = 20;
      for (let g = 0; g < grains; g += 1) {
        const t = ((g + random()) / grains) ** 1.08;
        const along = FISH.peduncle - 0.012 + rayLen * t;
        const splay = mix(0.018, 0.118, fan ** 0.85) * (t ** 1.15);
        const curl = -0.010 * Math.sin(Math.PI * t) * (1.0 - fan);
        const across = side * (0.006 + splay + curl + (random() - 0.5) * 0.009 * (0.3 + t));
        const warmRoot = t < 0.34 && random() > t * 1.8;
        const color = warmRoot ? [0.99, 0.68, 0.38] : [0.98, 0.95, 0.76];
        const opacity = (0.34 + 0.48 * (ray % 2 === 0 ? 1 : 0.75) * random()) * (1.0 - 0.68 * t);
        add(along, across, color, opacity, 1.30 + (1.0 - 0.3 * t) * 1.45 * random(),
          0.016 * t, 0.075 * t * t, 0.45 * t);
      }
    }
  }

  // Delicate trailing veil particles along the fork tips (kept sparse in the central V-notch).
  for (let i = 0; i < 48; i += 1) {
    const side = i % 2 === 0 ? 1 : -1;
    const t = 0.28 + 0.72 * random();
    const along = FISH.peduncle + 0.05 + 0.19 * t;
    const across = side * (0.022 + 0.088 * t + (random() - 0.5) * 0.028);
    add(along, across, i % 3 === 0 ? [0.99, 0.74, 0.46] : pearl,
      (0.32 + 0.24 * random()) * (1.0 - 0.68 * t), 1.05 + 1.25 * random(),
      0.018 * t, 0.12 * t * random(), 0.55 * t);
  }

  // 2. Curved spindle body: denser along the 3D dorsal crown, naturally sparser toward the flanks.
  const alongStep = 0.0112;
  const acrossStep = 0.0115;
  const rows = Math.ceil(FISH.peduncle / alongStep) + 1;
  const maxHalfWidth = Math.max(...WIDTHS.map(([, width]) => width));
  const halfColumns = Math.ceil(1.12 * maxHalfWidth / acrossStep) + 1;

  for (let row = 0; row < rows; row += 1) {
    for (let column = -halfColumns; column <= halfColumns; column += 1) {
      const along = (row + random() * 0.85) * alongStep;
      if (along > FISH.peduncle) continue;
      const halfW = bodyWidth(along);
      const across = (column + (random() - 0.5) * 0.90) * acrossStep;
      const edge = Math.abs(across) / halfW;
      if (edge > 1.05) continue;

      // Curvature-driven density falloff: dense dorsal ridge, progressively sparser flanks.
      const densityKeep = edge < 0.45 ? 0.98 : mix(0.95, 0.28, smoothstep(0.45, 1.05, edge));
      if (random() > densityKeep) continue;

      // 3D ellipsoidal back curvature shading (dorsal ridge brightest, flanks curve into shadow).
      const z = Math.sqrt(Math.max(0.0, 1.0 - Math.min(1.0, edge * edge)));
      const shade = 0.72 + 0.28 * z + 0.05 * Math.cos(Math.PI * along);

      // Bold, crisp-edged Kohaku red patches (keep snout tip white).
      const snoutClear = smoothstep(0.024, 0.062, along);
      const dPatch = patchField(along, across);
      const paint = snoutClear * (1.0 - smoothstep(0.84, 1.06, dPatch));
      const baseColor = pearl.map((channel, i) => mix(channel, vermilion[i], paint) * shade);

      const opacity = (0.74 + 0.22 * random()) * (0.48 + 0.52 * z) * (1.0 - 0.35 * smoothstep(0.82, 1.05, edge));
      const ptSize = (1.75 + 1.15 * random()) * (0.86 + 0.24 * z);
      add(along, across, baseColor, opacity, ptSize, edge > 0.86 ? 0.005 : 0);
    }
  }

  // 3. Subtle dorsal fin ridge along the center spine (adds top-down 3D silhouette).
  for (let i = 0; i < 26; i += 1) {
    const t = (i + random()) / 26;
    const along = 0.34 + 0.25 * t;
    const across = (random() - 0.5) * 0.008;
    const paint = 1.0 - smoothstep(0.84, 1.06, patchField(along, 0));
    const color = pearl.map((ch, k) => mix(ch, vermilion[k], paint * 0.55) * 1.04);
    add(along, across, color, 0.46 + 0.26 * Math.sin(Math.PI * t), 1.55 + 0.85 * random(), 0.006 * Math.sin(Math.PI * t));
  }

  // 4. Eyes positioned on the blunt rounded head sides.
  for (const side of [-1, 1]) {
    add(0.068, side * 0.050, [0.16, 0.20, 0.17], 0.96, 2.75);
  }
  return particles;
}

function axisAt(x, y, along) {
  const station = clamp(along, 0, 1) * FISH.segments;
  const start = Math.min(Math.floor(station), FISH.segments - 1);
  const amount = station - start;
  // Blend tangents through each joint so fin roots and spots stay continuous at the seams.
  const before = Math.max(0, start - 1);
  const after = Math.min(FISH.segments, start + 2);
  const dx = mix(x[start + 1] - x[before], x[after] - x[start], amount);
  const dy = mix(y[start + 1] - y[before], y[after] - y[start], amount);
  const length = Math.hypot(dx, dy);
  return [mix(x[start], x[start + 1], amount), mix(y[start], y[start + 1], amount), dx / length, dy / length];
}

export class Koi {
  guideX = new Float64Array(FISH.segments + 1);
  guideY = new Float64Array(FISH.segments + 1);
  posedX = new Float64Array(FISH.segments + 1);
  posedY = new Float64Array(FISH.segments + 1);
  tangentX = new Float64Array(FISH.segments + 1);
  tangentY = new Float64Array(FISH.segments + 1);
  amplitude = FISH.beatAmplitude;
  beating = true;
  yaw = 0;

  constructor(route) {
    this.route = route;
    this.particles = fishParticles(route);
    this.vertices = new Float32Array(this.particles.length * 7);
    this.routeAngle = route.routePhase;
    this.speed = route.cruiseSpeed * FISH.beatSpeedRatio;
    this.phase = route.beatPhase;
    this.outline = Array.from({ length: FISH.segments }, () => ({ across: 0, back: 0 }));
    for (const part of this.particles) {
      const outline = this.outline[part.joint];
      outline.across = Math.max(outline.across, Math.abs(part.across) + part.drift + 0.015 * part.tailLag);
      outline.back = Math.max(outline.back, part.floatBack);
    }
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    const { lengthFraction, center, radius } = this.route;
    const baseLength = Math.min(MAIN_LENGTH_FRACTION * width, 0.2825 * height, 0.46 * height * height / width);
    this.length = baseLength * lengthFraction / MAIN_LENGTH_FRACTION;
    this.segmentLength = this.length / FISH.segments;
    this.centerX = center[0] * width;
    this.centerY = center[1] * height;
    this.radiusX = radius[0] * width;
    this.radiusY = radius[1] * height;
    this.followRoute();
    for (let i = 0; i <= FISH.segments; i += 1) {
      this.guideX[i] = this.headX - i * this.segmentLength * Math.cos(this.heading);
      this.guideY[i] = this.headY - i * this.segmentLength * Math.sin(this.heading);
    }
    const pointScale = Math.sqrt(this.length / 272);
    for (let i = 0; i < this.particles.length; i += 1) {
      const part = this.particles[i];
      const start = i * 7;
      this.vertices[start + 2] = part.size * pointScale;
      this.vertices.set(part.color, start + 3);
    }
    this.pose();
  }

  followRoute() {
    const cos = Math.cos(this.routeAngle);
    const sin = Math.sin(this.routeAngle);
    this.heading = Math.atan2(this.radiusY * cos, -this.radiusX * sin);
    const recoil = 0.25 * this.length * this.yaw;
    this.headX = this.centerX + this.radiusX * cos - recoil * Math.sin(this.heading);
    this.headY = this.centerY + this.radiusY * sin + recoil * Math.cos(this.heading);
  }

  advance(dt, currentYaw) {
    if (this.speed <= this.route.cruiseSpeed * FISH.beatSpeedRatio) this.beating = true;
    if (this.speed >= this.route.cruiseSpeed * FISH.glideSpeedRatio) this.beating = false;
    this.speed += dt * (this.beating ? 0.055 : -0.026);
    this.amplitude = mix(this.amplitude, this.beating ? FISH.beatAmplitude : FISH.glideAmplitude, 1 - Math.exp(-dt / 0.13));
    const previousPhase = this.phase;
    this.phase += TAU * dt * (this.beating ? FISH.beatFrequency : FISH.glideFrequency);

    // Each fish travels its own lane at the requested arc speed.
    const rx = this.radiusX;
    const ry = this.radiusY;
    const distance = this.speed * this.length * dt;
    this.routeAngle += distance / Math.hypot(rx * Math.sin(this.routeAngle), ry * Math.cos(this.routeAngle));
    this.yaw = mix(this.yaw, currentYaw, 1 - Math.exp(-9 * dt));
    this.followRoute();
    this.pose();

    return Math.floor(this.phase / Math.PI) !== Math.floor(previousPhase / Math.PI);
  }

  // Full-body subcarangiform traveling wave: subtle head recoil, growing smoothly from shoulder to tail.
  tailOffset(along) {
    const envelope = 0.08 + 0.24 * along + 0.68 * (along ** 1.75);
    return this.amplitude * this.length * envelope * Math.sin(this.phase - FISH.waveNumber * along);
  }

  pose() {
    this.posedX[0] = this.guideX[0] = this.headX;
    this.posedY[0] = this.guideY[0] = this.headY;
    // Slight natural head counter-yaw coupled to the swimming wave.
    const headSway = 0.72 * this.amplitude * Math.cos(this.phase);
    let guideAngle = this.heading + this.yaw + Math.PI;
    let jointAngle = guideAngle + headSway;
    let previousOffset = this.tailOffset(0);
    for (let i = 1; i <= FISH.segments; i += 1) {
      const follow = Math.atan2(this.guideY[i] - this.guideY[i - 1], this.guideX[i] - this.guideX[i - 1]);
      guideAngle += clamp(angleDifference(follow, guideAngle), -FISH.maxJointAngle, FISH.maxJointAngle);
      this.guideX[i] = this.guideX[i - 1] + this.segmentLength * Math.cos(guideAngle);
      this.guideY[i] = this.guideY[i - 1] + this.segmentLength * Math.sin(guideAngle);

      const offset = this.tailOffset(i / FISH.segments);
      const waveAngle = Math.atan2(offset - previousOffset, this.segmentLength);
      jointAngle += clamp(angleDifference(guideAngle + waveAngle, jointAngle), -FISH.maxJointAngle, FISH.maxJointAngle);
      this.posedX[i] = this.posedX[i - 1] + this.segmentLength * Math.cos(jointAngle);
      this.posedY[i] = this.posedY[i - 1] + this.segmentLength * Math.sin(jointAngle);
      previousOffset = offset;
    }
    this.fitLane();
  }

  fitLane() {
    const { posedX, posedY, tangentX, tangentY, length } = this;
    for (let i = 0; i <= FISH.segments; i += 1) {
      const before = Math.max(0, i - 1);
      const after = Math.min(FISH.segments, i + 1);
      tangentX[i] = posedX[after] - posedX[before];
      tangentY[i] = posedY[after] - posedY[before];
    }
    // Account for the fin and tail envelope. Translate the full pose through a
    // soft boundary so even turning fish and their wakes remain in separate lanes.
    let bottom = Infinity;
    let top = -Infinity;
    for (let i = 0; i < FISH.segments; i += 1) {
      const x = tangentX[i];
      const y = tangentY[i];
      const nextX = tangentX[i + 1];
      const nextY = tangentY[i + 1];
      const axis = Math.sqrt(x * x + y * y);
      const nextAxis = Math.sqrt(nextX * nextX + nextY * nextY);
      const across = y * nextY <= 0 ? 1 : Math.max(Math.abs(x) / axis, Math.abs(nextX) / nextAxis);
      const back = x * nextX <= 0 ? 1 : Math.max(Math.abs(y) / axis, Math.abs(nextY) / nextAxis);
      const padding = this.outline[i].across * across * length;
      const tail = this.outline[i].back * back * length;
      bottom = Math.min(bottom, Math.min(posedY[i], posedY[i + 1]) - padding - (Math.min(y, nextY) < 0 ? tail : 0));
      top = Math.max(top, Math.max(posedY[i], posedY[i + 1]) + padding + (Math.max(y, nextY) > 0 ? tail : 0));
    }
    const [low, high] = this.route.lane;
    const pad = Math.min(8, this.height * 0.012);
    this.renderOffsetY = easedInset(low * this.height + pad - bottom, pad) -
      easedInset(top - high * this.height + pad, pad);
  }

  get peduncle() {
    const [x, y] = axisAt(this.posedX, this.posedY, FISH.peduncle);
    return [x, y + this.renderOffsetY];
  }

  drawData(time) {
    const { posedX, posedY, tangentX, tangentY, length, vertices, renderOffsetY, phase: swimPhase, amplitude } = this;
    const driftTime = time * 1.42;
    const tailTime = time * 0.82;
    const brightnessTime = time * 2.1;
    let index = 0;
    for (const part of this.particles) {
      const { joint, blend, phase, tailLag } = part;
      const dx = mix(tangentX[joint], tangentX[joint + 1], blend);
      const dy = mix(tangentY[joint], tangentY[joint + 1], blend);
      const unit = length / Math.sqrt(dx * dx + dy * dy);
      const drift = part.drift ? part.drift * Math.sin(driftTime + phase) : 0;
      const tailFlutter = tailLag ? tailLag * amplitude * 0.65 * Math.sin(swimPhase - FISH.waveNumber * (1.0 + tailLag * 0.4)) : 0;
      const back = part.floatBack ? unit * part.floatBack * (0.77 + 0.23 * Math.sin(tailTime + phase)) : 0;
      const across = unit * (part.across + drift + tailFlutter);
      vertices[index] = mix(posedX[joint], posedX[joint + 1], blend) - dy * across + dx * back;
      vertices[index + 1] = mix(posedY[joint], posedY[joint + 1], blend) + dx * across + dy * back + renderOffsetY;
      vertices[index + 6] = part.opacity * (0.91 + 0.09 * Math.sin(brightnessTime + phase));
      index += 7;
    }
    return this.vertices;
  }
}
