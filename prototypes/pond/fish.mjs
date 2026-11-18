export const FISH = Object.freeze({
  segments: 16,
  lengthFraction: 0.177,
  maxJointAngle: 0.16,
  waveNumber: 5.4,
  cruiseSpeed: 0.12,
  beatSpeedRatio: 0.90,
  glideSpeedRatio: 1.12,
  beatFrequency: 0.78,
  glideFrequency: 0.52,
  beatAmplitude: 0.075,
  glideAmplitude: 0.01875,
  peduncle: 0.80
});

const TAU = 2 * Math.PI;
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const mix = (from, to, amount) => from + (to - from) * amount;
const angleDifference = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

const WIDTHS = [
  [0, 0.043], [0.035, 0.072], [0.105, 0.090], [0.23, 0.108],
  [0.34, 0.101], [0.47, 0.080], [0.59, 0.056], [0.70, 0.031], [FISH.peduncle, 0.015]
];

function bodyWidth(along) {
  const index = WIDTHS.findIndex(([station]) => station >= along);
  if (index <= 0) return WIDTHS[Math.max(0, index)][1];
  const [start, narrow] = WIDTHS[index - 1];
  const [end, wide] = WIDTHS[index];
  return mix(narrow, wide, (along - start) / (end - start));
}

function fishParticles() {
  let seed = 575;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const particles = [];
  const pearl = [1.0, 0.98, 0.74];
  const orange = [1.0, 0.48, 0.21];
  const patches = [
    [0.142, 0.012, 0.100, 0.085],
    [0.365, -0.025, 0.112, 0.074],
    [0.534, 0.020, 0.076, 0.054],
    [0.677, -0.003, 0.053, 0.038]
  ];

  function add(along, across, color, opacity, size, drift = 0, floatBack = 0) {
    const light = 0.76 + 0.24 * random() ** 0.44;
    particles.push({
      along, across, opacity, size, drift, floatBack, phase: TAU * random(),
      color: color.map((channel) => channel * light)
    });
  }

  // Jittered stations keep gaps between grains. The orange patches stay in bone coordinates.
  const spacing = 0.0096;
  for (let row = 0; row < 84; row += 1) {
    for (let column = -13; column <= 13; column += 1) {
      const along = (row + random() * 0.8) * spacing;
      const across = (column + (random() - 0.5) * 0.9) * spacing;
      if (along > FISH.peduncle) continue;
      const edge = Math.abs(across) / bodyWidth(along);
      if (edge > 1.25 || random() > clamp(1.53 - edge * 0.70, 0, 1) * (edge > 1 ? 0.42 : 1)) continue;

      const patch = Math.min(...patches.map(([center, side, length, width]) =>
        ((along - center) / length) ** 2 + ((across - side) / width) ** 2
      ));
      const ink = clamp((1.15 - patch) * 3.5 + (random() - 0.5) * 0.65, 0, 1);
      const eye = along > 0.051 && along < 0.089 && Math.abs(Math.abs(across) - 0.053) < 0.011;
      const color = eye ? [0.23, 0.27, 0.19] : pearl.map((channel, i) => mix(channel, orange[i], ink));
      const opacity = (0.62 + random() * 0.37) * (1 - 0.49 * edge ** 3);
      add(along, across, color, opacity, 1.55 + random() * 1.7, edge > 0.94 ? 0.005 : 0);
    }
  }

  for (const side of [-1, 1]) {
    // Thin, swept pectoral fins, brighter near the shoulder and open towards the tips.
    for (let i = 0; i < 132; i += 1) {
      const t = random();
      const width = 0.070 * Math.sin(Math.PI * t) ** 0.82;
      const across = side * (0.072 + 0.107 * t + (random() - 0.5) * width);
      add(0.245 + 0.21 * t + (random() - 0.5) * width, across,
        [0.92, 0.91, 0.69], (0.28 + random() * 0.46) * (1 - 0.60 * t), 1.45 + random() * 1.3, t * 0.012);
    }

    // The two tapering lobes diverge away from the peduncle and leave the middle open.
    for (let i = 0; i < 185; i += 1) {
      const t = random() ** 1.33;
      const width = 0.010 + 0.042 * Math.sin(Math.PI * t) ** 1.10;
      const along = FISH.peduncle - 0.011 + 0.208 * t;
      const across = side * (0.007 + 0.098 * t ** 1.22 + (random() - 0.5) * width);
      const warm = t < 0.42 && random() > t;
      add(along, across, warm ? [0.99, 0.67, 0.35] : [0.98, 0.94, 0.70],
        (0.3 + random() * 0.63) * (1 - 0.69 * t), 1.4 + random() * 1.55, 0.013 * t);
    }
  }

  for (let i = 0; i < 185; i += 1) {
    const t = random();
    const across = (random() - 0.5) * (0.068 + t * 0.35);
    add(FISH.peduncle + 0.17 * t, across, i % 3 ? [0.99, 0.69, 0.38] : pearl,
      (0.41 + random() * 0.23) * (1 - 0.67 * t), 1.1 + random() * 1.45,
      0.009 + 0.034 * t, 0.13 * t * random());
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
  particles = fishParticles();
  vertices = new Float32Array(this.particles.length * 7);
  guideX = new Float64Array(FISH.segments + 1);
  guideY = new Float64Array(FISH.segments + 1);
  posedX = new Float64Array(FISH.segments + 1);
  posedY = new Float64Array(FISH.segments + 1);
  routeAngle = 5.35;
  speed = FISH.cruiseSpeed * FISH.beatSpeedRatio;
  amplitude = FISH.beatAmplitude;
  phase = 0.7;
  beating = true;
  yaw = 0;

  resize(width, height) {
    const first = this.width === undefined;
    if (!first) {
      this.headX *= width / this.width;
      this.headY *= height / this.height;
    }
    this.width = width;
    this.height = height;
    this.length = Math.min(FISH.lengthFraction * width, 0.36 * height);
    this.segmentLength = this.length / FISH.segments;
    if (first) {
      this.headX = (0.43 + 0.24 * Math.cos(this.routeAngle)) * width;
      this.headY = (0.68 + 0.25 * Math.sin(this.routeAngle)) * height;
      this.heading = Math.atan2(0.25 * height * Math.cos(this.routeAngle), -0.24 * width * Math.sin(this.routeAngle));
    }
    for (let i = 0; i <= FISH.segments; i += 1) {
      this.guideX[i] = this.headX - i * this.segmentLength * Math.cos(this.heading);
      this.guideY[i] = this.headY - i * this.segmentLength * Math.sin(this.heading);
    }
    this.pose();
  }

  advance(dt, currentYaw) {
    if (this.speed <= FISH.cruiseSpeed * FISH.beatSpeedRatio) this.beating = true;
    if (this.speed >= FISH.cruiseSpeed * FISH.glideSpeedRatio) this.beating = false;
    this.speed += dt * (this.beating ? 0.055 : -0.026);
    this.amplitude = mix(this.amplitude, this.beating ? FISH.beatAmplitude : FISH.glideAmplitude, 1 - Math.exp(-dt / 0.13));
    const previousPhase = this.phase;
    this.phase += TAU * dt * (this.beating ? FISH.beatFrequency : FISH.glideFrequency);

    // A look-ahead target travels around the pond at the same arc speed as the fish.
    const rx = 0.24 * this.width;
    const ry = 0.25 * this.height;
    const distance = this.speed * this.length * dt;
    this.routeAngle += distance / Math.hypot(rx * Math.sin(this.routeAngle), ry * Math.cos(this.routeAngle));
    const targetAngle = this.routeAngle + 0.25;
    const targetX = 0.43 * this.width + rx * Math.cos(targetAngle);
    const targetY = 0.68 * this.height + ry * Math.sin(targetAngle);
    const desired = Math.atan2(targetY - this.headY, targetX - this.headX);
    this.heading += clamp(angleDifference(desired, this.heading), -0.65 * dt, 0.65 * dt);
    this.yaw = mix(this.yaw, currentYaw, 1 - Math.exp(-9 * dt));
    this.headX += distance * Math.cos(this.heading + this.yaw);
    this.headY += distance * Math.sin(this.heading + this.yaw);
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
  }

  get peduncle() {
    return axisAt(this.posedX, this.posedY, FISH.peduncle);
  }

  drawData(time) {
    const pointScale = Math.sqrt(this.length / 272);
    let index = 0;
    for (const part of this.particles) {
      const [x, y, dx, dy] = axisAt(this.posedX, this.posedY, part.along);
      const drift = part.drift * Math.sin(time * 1.42 + part.phase);
      const across = this.length * (part.across + drift);
      const back = this.length * part.floatBack * (0.77 + 0.23 * Math.sin(time * 0.82 + part.phase));
      this.vertices[index++] = x - dy * across + dx * back;
      this.vertices[index++] = y + dx * across + dy * back;
      this.vertices[index++] = part.size * pointScale;
      this.vertices[index++] = part.color[0];
      this.vertices[index++] = part.color[1];
      this.vertices[index++] = part.color[2];
      this.vertices[index++] = part.opacity * (0.91 + 0.09 * Math.sin(time * 2.1 + part.phase));
    }
    return this.vertices;
  }
}
