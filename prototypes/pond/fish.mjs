export const FISH = Object.freeze({
  segments: 16,
  maxJointAngle: 0.16,
  waveNumber: 5.4,
  beatSpeedRatio: 0.90,
  glideSpeedRatio: 1.12,
  beatFrequency: 0.78,
  glideFrequency: 0.52,
  beatAmplitude: 0.075,
  glideAmplitude: 0.01875,
  peduncle: 0.80
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
const angleDifference = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

function easedInset(distance, edge) {
  const t = clamp((distance + edge) / (2 * edge), 0, 1);
  return t * t * edge + Math.max(0, distance - edge);
}

const WIDTHS = [
  [0, 0.022, 1.55], [0.032, 0.052, 0.60], [0.110, 0.071, 0.15], [0.232, 0.076, 0],
  [0.340, 0.070, -0.11], [0.510, 0.050, -0.17], [0.660, 0.025, -0.15], [FISH.peduncle, 0.012, -0.04]
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
  const pearl = [1.0, 0.97, 0.79];
  const orange = [1.0, 0.34, 0.13];
  const patchShapes = [
    [0.14, 0.016, 0.085, 0.050 * shoulderScale],
    [0.37, -0.019, 0.100, 0.057],
    [0.59, 0.019, 0.072, 0.036]
  ];
  if (tailPatch) patchShapes.push([0.70, -0.004, 0.030, 0.020]);
  const patches = patchShapes.map(([center, side, length, width], index) => [
    center + (random() - 0.5) * 0.032,
    side + (patchBias[index] ?? 0) + (random() - 0.5) * 0.020,
    length,
    width,
    (random() - 0.5) * 0.44
  ]);

  function add(along, across, color, opacity, size, drift = 0, floatBack = 0) {
    const light = 0.87 + 0.13 * random();
    const station = along * FISH.segments;
    const joint = Math.min(Math.floor(station), FISH.segments - 1);
    particles.push({
      joint, blend: station - joint, across, opacity, size, drift, floatBack, phase: TAU * random(),
      color: color.map((channel) => channel * light)
    });
  }

  for (const side of [-1, 1]) {
    // Draw each fan below the body so its root can disappear into the shoulder.
    for (let ray = 0; ray < 9; ray += 1) {
      for (let grain = 0; grain < 17; grain += 1) {
        const fan = (ray + (random() - 0.5) * 0.46) / 8;
        const t = (grain + random()) / 17;
        const reach = Math.sin(Math.PI * t * 0.63);
        const across = side * (0.063 + reach * (0.112 - 0.078 * fan * fan));
        const along = 0.205 + 0.086 * t + reach * (0.114 * fan - 0.010);
        const vein = ray % 3 === 0 ? 1 : 0.86;
        const opacity = mix(0.65, 0.28, t) + 0.17 * random();
        add(along, across, [vein, 0.91 * vein, 0.68 * vein], opacity,
          1.85 + random() * 1.45, t * 0.008);
      }
    }

    // The shorter pelvic fan tilts back from the pale edge of the belly.
    for (let ray = 0; ray < 4; ray += 1) {
      const fan = ray / 3;
      for (let grain = 0; grain < 8; grain += 1) {
        const t = (grain + random()) / 8;
        const across = side * (0.045 + 0.030 * t * (1 - 0.36 * fan));
        const along = 0.53 + (0.085 + 0.025 * fan) * t;
        add(along, across, [0.89, 0.77, 0.54], 0.28 + 0.20 * random(), 1.4 + 0.8 * random());
      }
    }

    // The two tapering lobes diverge away from the peduncle and leave the middle open.
    for (let i = 0; i < 185; i += 1) {
      const t = random() ** 1.33;
      const width = 0.010 + 0.042 * Math.sin(Math.PI * t) ** 1.10;
      const along = FISH.peduncle - 0.010 + 0.210 * t;
      const across = side * (0.007 + 0.098 * t ** 1.22 + (random() - 0.5) * width);
      const warm = t < 0.42 && random() > t;
      add(along, across, warm ? [0.99, 0.67, 0.35] : [0.98, 0.94, 0.70],
        (0.3 + random() * 0.63) * (1 - 0.69 * t), 1.4 + random() * 1.55, 0.013 * t);
    }
  }

  for (let i = 0; i < 90; i += 1) {
    const t = random();
    const drift = 0.009 + 0.034 * t;
    const halfSpan = 0.034 + 0.086 * t;
    const across = (2 * random() - 1) * (halfSpan - drift);
    add(FISH.peduncle + 0.17 * t, across, i % 3 ? [0.99, 0.69, 0.38] : pearl,
      (0.41 + random() * 0.23) * (1 - 0.67 * t), 1.1 + random() * 1.45,
      drift, 0.13 * t * random());
  }
  // Jittered stations keep gaps between grains. The orange patches stay in bone coordinates.
  const spacing = 0.0125;
  const rows = Math.ceil(FISH.peduncle / spacing) + 1;
  const maxHalfWidth = Math.max(...WIDTHS.map(([, width]) => width));
  const halfColumns = Math.ceil(1.18 * maxHalfWidth / spacing) + 1;
  for (let row = 0; row < rows; row += 1) {
    for (let column = -halfColumns; column <= halfColumns; column += 1) {
      const along = (row + random() * 0.8) * spacing;
      const across = (column + (random() - 0.5) * 0.9) * spacing;
      if (along > FISH.peduncle) continue;
      const edge = Math.abs(across) / bodyWidth(along);
      if (edge > 1.09 || (edge > 0.96 && random() > (1.09 - edge) * 7.0)) continue;

      const patch = Math.min(...patches.map(([center, side, length, width, skew]) => {
        const local = (along - center) / length;
        return local ** 2 + ((across - side) / width + skew * local) ** 2;
      }));
      const ink = along < 0.04 ? 0 : clamp((1.17 - patch) / 0.50, 0, 1);
      const paint = ink * ink * (3 - 2 * ink);
      const color = pearl.map((channel, i) => mix(channel, orange[i], paint));
      const opacity = (0.76 + random() * 0.19) * (1 - 0.42 * edge ** 3);
      add(along, across, color, opacity, 2.0 + random() * 1.2, edge > 0.97 ? 0.0045 : 0);
    }
  }

  for (const side of [-1, 1]) {
    add(0.074, side * 0.049, [0.20, 0.24, 0.19], 0.94, 2.8);
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
      outline.across = Math.max(outline.across, Math.abs(part.across) + part.drift);
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

  tailOffset(along) {
    return this.amplitude * this.length * along ** 2.35 * Math.sin(this.phase - FISH.waveNumber * along);
  }

  pose() {
    this.posedX[0] = this.guideX[0] = this.headX;
    this.posedY[0] = this.guideY[0] = this.headY;
    let guideAngle = this.heading + this.yaw + Math.PI;
    let jointAngle = guideAngle;
    let previousOffset = 0;
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
    const { posedX, posedY, tangentX, tangentY, length, vertices, renderOffsetY } = this;
    const driftTime = time * 1.42;
    const tailTime = time * 0.82;
    const brightnessTime = time * 2.1;
    let index = 0;
    for (const part of this.particles) {
      const { joint, blend, phase } = part;
      const dx = mix(tangentX[joint], tangentX[joint + 1], blend);
      const dy = mix(tangentY[joint], tangentY[joint + 1], blend);
      const unit = length / Math.sqrt(dx * dx + dy * dy);
      const drift = part.drift ? part.drift * Math.sin(driftTime + phase) : 0;
      const back = part.floatBack ? unit * part.floatBack * (0.77 + 0.23 * Math.sin(tailTime + phase)) : 0;
      const across = unit * (part.across + drift);
      vertices[index] = mix(posedX[joint], posedX[joint + 1], blend) - dy * across + dx * back;
      vertices[index + 1] = mix(posedY[joint], posedY[joint + 1], blend) + dx * across + dy * back + renderOffsetY;
      vertices[index + 6] = part.opacity * (0.91 + 0.09 * Math.sin(brightnessTime + phase));
      index += 7;
    }
    return this.vertices;
  }
}
