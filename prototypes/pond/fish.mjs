export const FISH = Object.freeze({
  segments: 16,
  maxJointAngle: 0.22,
  waveNumber: 5.0,
  beatSpeedRatio: 0.90,
  glideSpeedRatio: 1.12,
  beatFrequency: 0.78,
  glideFrequency: 0.52,
  beatAmplitude: 0.095,
  glideAmplitude: 0.028,
  peduncle: 0.74
});

const MAIN_LENGTH_FRACTION = 0.184;

// Routes [1] and [2] match the two luminous central Kohaku protagonists in 15561.png;
// route [0] is the subtle upper-right dark-water shadow koi ("暗影鱼").
export const KOI_ROUTES = [
  {
    seed: 932, lengthFraction: 0.122, cruiseSpeed: 0.088, direction: 1,
    center: [0.785, 0.835], radius: [0.105, 0.046], routePhase: 4.35, beatPhase: 2.4, lane: [0.760, 0.975],
    shoulderScale: 0.92, patchBias: [0, 0, 0], shadow: true
  },
  {
    seed: 575, lengthFraction: 0.178, cruiseSpeed: 0.114, direction: 1,
    center: [0.432, 0.635], radius: [0.095, 0.068], routePhase: 5.14, beatPhase: 2.35, lane: [0.540, 0.760],
    shoulderScale: 1.0, patchBias: [0.016, -0.012, 0.008], tailPatch: true
  },
  {
    seed: 768, lengthFraction: MAIN_LENGTH_FRACTION, cruiseSpeed: 0.118, direction: -1,
    center: [0.600, 0.525], radius: [0.105, 0.064], routePhase: 4.62, beatPhase: 4.85, lane: [0.395, 0.540],
    shoulderScale: 1.02, patchBias: [0.018, -0.014, 0.006]
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

const WIDTHS = [
  [0, 0.018, 1.48],
  [0.036, 0.048, 0.62],
  [0.105, 0.072, 0.18],
  [0.215, 0.081, 0.0],
  [0.345, 0.072, -0.13],
  [0.495, 0.050, -0.17],
  [0.630, 0.027, -0.14],
  [FISH.peduncle, 0.016, -0.04]
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

function fishParticles({ seed, shoulderScale, patchBias, tailPatch, shadow }) {
  const random = seededRandom(seed);
  const particles = [];

  const pearl = shadow ? [0.18, 0.34, 0.30] : [1.03, 1.00, 0.87];
  const vermilion = shadow ? [0.14, 0.28, 0.25] : [1.06, 0.41, 0.14];
  const pearlUnder = shadow ? [0.05, 0.12, 0.11] : [0.58, 0.58, 0.46];
  const redUnder = shadow ? [0.05, 0.12, 0.11] : [0.68, 0.25, 0.09];
  const alphaGain = shadow ? 0.38 : 1.0;

  const patchShapes = [
    [0.158, 0.016, 0.108, 0.080 * shoulderScale],
    [0.472, -0.016, 0.106, 0.068 * shoulderScale]
  ];
  if (tailPatch) patchShapes.push([0.650, 0.008, 0.048, 0.032]);

  const patches = patchShapes.map(([center, side, length, width], index) => [
    center + (random() - 0.5) * 0.016,
    side + (patchBias[index] ?? 0),
    length,
    width,
    (random() - 0.5) * 0.30,
    TAU * random()
  ]);

  const warpP1 = TAU * random();
  const warpP2 = TAU * random();
  function patchField(along, across) {
    const wx = 0.014 * Math.sin(along * 24.0 + across * 30.0 + warpP1);
    const wy = 0.009 * Math.cos(along * 28.0 - across * 26.0 + warpP2);
    let best = Infinity;
    for (const [center, side, length, width, skew, ph] of patches) {
      const lx = (along + wx - center) / length;
      const ly = (across + wy - side) / width + skew * lx;
      const lobe = 1.0 + 0.15 * Math.sin(2.0 * Math.atan2(ly, lx) + ph);
      const d = (lx * lx + ly * ly) / (lobe * lobe);
      if (d < best) best = d;
    }
    return best;
  }

  function add(along, across, color, opacity, size, drift = 0, floatBack = 0, tailLag = 0) {
    const station = clamp(along, 0, 1) * FISH.segments;
    const joint = Math.min(Math.floor(station), FISH.segments - 1);
    particles.push({
      joint, blend: station - joint, across,
      opacity: opacity * alphaGain,
      size, drift, floatBack, tailLag,
      phase: TAU * random(),
      color
    });
  }

  // 1. Closed swept-back teardrop pectoral & pelvic fans + full beaded butterfly veil caudal fin.
  for (const side of [-1, 1]) {
    const pecSteps = 8;
    for (let s = 1; s <= pecSteps; s += 1) {
      const u = s / pecSteps;
      const leadAlong = 0.175 + 0.185 * (u ** 0.92);
      const trailAlong = 0.255 + 0.115 * u;
      const rootW = bodyWidth(0.20 + 0.08 * u) * 0.82;
      const maxOut = rootW + 0.098 * Math.sin(Math.PI * (u ** 0.72));
      const rows = Math.max(1, Math.round((maxOut - rootW) / 0.019));
      for (let r = 0; r <= rows; r += 1) {
        const v = rows === 0 ? 1 : r / rows;
        const along = mix(trailAlong, leadAlong, v);
        const out = mix(rootW, maxOut, v);
        const isRim = r === rows || s === pecSteps;
        const lum = isRim ? 1.05 : 0.90;
        const op = (isRim ? 0.92 : 0.58) * (1.0 - 0.22 * u);
        add(along, side * out, pearl.map((c) => c * lum), op, isRim ? 4.15 : 3.50, 0.004 * u);
      }
    }

    for (let s = 1; s <= 5; s += 1) {
      const u = s / 5;
      const rootW = bodyWidth(0.48) * 0.82;
      const maxOut = rootW + 0.052 * Math.sin(Math.PI * (u ** 0.75));
      for (const v of [0.45, 1.0]) {
        const along = mix(0.51 + 0.07 * u, 0.46 + 0.11 * u, v);
        const out = mix(rootW, maxOut, v);
        const isRim = v > 0.8;
        add(along, side * out, pearl.map((c) => c * (isRim ? 1.00 : 0.86)),
          (isRim ? 0.82 : 0.52) * (1.0 - 0.22 * u), isRim ? 3.75 : 3.20, 0.003 * u);
      }
    }

    const tailRows = 11;
    for (let r = 1; r <= tailRows; r += 1) {
      const t = r / tailRows;
      const along = FISH.peduncle - 0.005 + 0.275 * t;
      const innerEdge = t < 0.26 ? 0.004 : 0.004 + 0.058 * ((t - 0.26) / 0.74) ** 1.15;
      const outerEdge = 0.014 + 0.136 * Math.sin(Math.PI * (t ** 0.68) * 0.86);
      if (outerEdge <= innerEdge + 0.004) continue;
      const cols = Math.max(1, Math.round((outerEdge - innerEdge) / 0.020));
      for (let c = 0; c <= cols; c += 1) {
        const fan = cols === 0 ? 0.5 : c / cols;
        const across = side * mix(innerEdge, outerEdge, fan);
        const isRim = c === cols || (t > 0.28 && c === 0) || r === tailRows;
        const warmBase = !shadow && t < 0.22 && fan < 0.65;
        const col = warmBase ? [1.02, 0.64, 0.32] : pearl.map((ch) => ch * (isRim ? 1.05 : 0.96));
        const op = (isRim ? 0.90 : 0.60) * (1.0 - 0.30 * (t ** 1.4));
        add(along, across, col, op, isRim ? 4.25 : 3.65, 0.009 * t, 0.024 * t * t, 0.40 * t);
      }
    }
  }

  // 2. Color-matched soft body base so koi stay luminous ivory-pearl & vivid vermilion over dark water.
  const underStep = 0.024;
  for (let along = 0.026; along <= FISH.peduncle; along += underStep) {
    const hw = bodyWidth(along) * 0.90;
    const cols = Math.max(1, Math.round(hw / 0.024));
    for (let c = -cols; c <= cols; c += 1) {
      const across = (c / Math.max(1, cols)) * hw;
      const isRed = along > 0.050 && patchField(along, across) < 0.98;
      add(along, across, isRed ? redUnder : pearlUnder, 0.72, 5.6);
    }
  }

  // 3. Regular ~5.2px staggered jewel beads along the 3D spindle body.
  const alongStep = 0.0215;
  const rows = Math.floor(FISH.peduncle / alongStep);
  for (let row = 0; row <= rows; row += 1) {
    const baseAlong = row * alongStep;
    const hw = bodyWidth(baseAlong);
    const halfCols = Math.max(0, Math.round(hw / 0.0215));
    for (let col = -halfCols; col <= halfCols; col += 1) {
      const stagger = (col & 1) ? 0.45 * alongStep : 0;
      const along = baseAlong + stagger + (random() - 0.5) * 0.0020;
      if (along < 0.004 || along > FISH.peduncle) continue;
      const curHw = bodyWidth(along);
      const across = halfCols === 0 ? 0 : (col / halfCols) * curHw * 0.95 + (random() - 0.5) * 0.0018;
      const edge = Math.abs(across) / Math.max(curHw, 0.001);
      if (edge > 1.02) continue;

      const z = Math.sqrt(Math.max(0.0, 1.0 - Math.min(1.0, edge * edge)));
      const shade = 0.84 + 0.24 * z;

      const snoutWhite = smoothstep(0.044, 0.064, along);
      const dPatch = patchField(along, across);
      const paint = snoutWhite * (1.0 - smoothstep(0.88, 1.03, dPatch));
      const color = pearl.map((ch, i) => mix(ch, vermilion[i], paint) * shade);

      const opacity = mix(0.82, 0.98, z);
      const ptSize = mix(3.90, 4.90, z);
      add(along, across, color, opacity, ptSize);
    }
  }

  // 4. Crisp dark eyes tucked inside the rounded head sides.
  if (!shadow) {
    for (const side of [-1, 1]) {
      add(0.072, side * 0.038, [0.05, 0.08, 0.07], 0.98, 4.3);
    }
  }
  return particles;
}

function axisAt(x, y, along) {
  const station = clamp(along, 0, 1) * FISH.segments;
  const start = Math.min(Math.floor(station), FISH.segments - 1);
  const amount = station - start;
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
    this.direction = route.direction ?? 1;
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
    const baseLength = Math.min(MAIN_LENGTH_FRACTION * width, 0.28 * height, 0.46 * height * height / width);
    this.length = baseLength * lengthFraction / MAIN_LENGTH_FRACTION;
    this.segmentLength = this.length / FISH.segments;
    this.centerX = center[0] * width;
    this.centerY = center[1] * height;
    this.radiusX = radius[0] * width;
    this.radiusY = radius[1] * height;

    this.followRoute();
    for (let i = 0; i <= FISH.segments; i += 1) {
      const arcStep = this.segmentLength / Math.max(40, Math.hypot(this.radiusX * Math.sin(this.routeAngle), this.radiusY * Math.cos(this.routeAngle)));
      const backAngle = this.routeAngle - this.direction * i * arcStep;
      this.guideX[i] = this.centerX + this.radiusX * Math.cos(backAngle);
      this.guideY[i] = this.centerY + this.radiusY * Math.sin(backAngle);
    }

    const pointScale = Math.sqrt(this.length / 270);
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
    this.heading = Math.atan2(this.direction * this.radiusY * cos, -this.direction * this.radiusX * sin);
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

    const rx = this.radiusX;
    const ry = this.radiusY;
    const distance = this.speed * this.length * dt;
    this.routeAngle += this.direction * distance / Math.hypot(rx * Math.sin(this.routeAngle), ry * Math.cos(this.routeAngle));
    this.yaw = mix(this.yaw, currentYaw, 1 - Math.exp(-9 * dt));
    this.followRoute();
    this.pose();

    return Math.floor(this.phase / Math.PI) !== Math.floor(previousPhase / Math.PI);
  }

  tailOffset(along) {
    const envelope = 0.06 + 0.22 * along + 0.72 * (along ** 1.70);
    return this.amplitude * this.length * envelope * Math.sin(this.phase - FISH.waveNumber * along);
  }

  pose() {
    this.posedX[0] = this.guideX[0] = this.headX;
    this.posedY[0] = this.guideY[0] = this.headY;
    const headSway = 0.65 * this.amplitude * Math.cos(this.phase);
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
      const tailFlutter = tailLag ? tailLag * amplitude * 0.52 * Math.sin(swimPhase - FISH.waveNumber * (1.0 + tailLag * 0.35)) : 0;
      const back = part.floatBack ? unit * part.floatBack * (0.77 + 0.23 * Math.sin(tailTime + phase)) : 0;
      const across = unit * (part.across + drift + tailFlutter);
      vertices[index] = mix(posedX[joint], posedX[joint + 1], blend) - dy * across + dx * back;
      vertices[index + 1] = mix(posedY[joint], posedY[joint + 1], blend) + dx * across + dy * back + renderOffsetY;
      vertices[index + 6] = part.opacity * (0.94 + 0.06 * Math.sin(brightnessTime + phase));
      index += 7;
    }
    return this.vertices;
  }
}
