import { KOI_SAMPLES, FISH_POINT_BUDGET } from "./sampled-data.mjs";
    
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
    const MAX_POINTS_PER_FISH = Math.min(2500, Number(FISH_POINT_BUDGET) || 2500);
    
    // Routes [1] and [2] are the two central Kohaku protagonists; route [0] is the upper-right dark-water shadow koi ("暗影鱼").
    export const KOI_ROUTES = [
      {
        seed: 932, sampleKey: "shadow", lengthFraction: 0.122, cruiseSpeed: 0.088, direction: 1,
        center: [0.785, 0.835], radius: [0.105, 0.046], routePhase: 4.35, beatPhase: 2.4, lane: [0.760, 0.975],
        shoulderScale: 0.92, patchBias: [0, 0, 0], shadow: true
      },
      {
        seed: 575, sampleKey: "primary", lengthFraction: 0.178, cruiseSpeed: 0.114, direction: 1,
        center: [0.432, 0.635], radius: [0.095, 0.068], routePhase: 5.14, beatPhase: 2.35, lane: [0.540, 0.760],
        shoulderScale: 1.0, patchBias: [0.016, -0.012, 0.008], tailPatch: true
      },
      {
        seed: 768, sampleKey: "secondary", lengthFraction: MAIN_LENGTH_FRACTION, cruiseSpeed: 0.118, direction: -1,
        center: [0.600, 0.525], radius: [0.105, 0.064], routePhase: 4.62, beatPhase: 4.85, lane: [0.395, 0.540],
        shoulderScale: 1.02, patchBias: [0.018, -0.014, 0.006]
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
    
    export function seededRandom(seed) {
      return () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 4294967296;
      };
    }
    
    function resolveFishSample(route, explicitSample) {
      if (explicitSample?.points) return { dataset: explicitSample, dedicatedShadow: Boolean(route.shadow) };
      if (route?.sample?.points) return { dataset: route.sample, dedicatedShadow: Boolean(route.shadow) };
      if (KOI_SAMPLES?.points) return { dataset: KOI_SAMPLES, dedicatedShadow: false };
    
      const key = route?.sampleKey;
      if (key && KOI_SAMPLES?.[key]?.points) {
        return { dataset: KOI_SAMPLES[key], dedicatedShadow: key === "shadow" };
      }
      const fallback = KOI_SAMPLES?.primary ?? Object.values(KOI_SAMPLES ?? {}).find((item) => item?.points);
      if (!fallback) throw new Error("Missing fish point-cloud data in sampled-data.mjs");
      return { dataset: fallback, dedicatedShadow: false };
    }
    
    function buildSampledParticles(route, explicitSample) {
      const { dataset, dedicatedShadow } = resolveFishSample(route, explicitSample);
      const { points, stride = 9 } = dataset;
      const rawCount = Math.floor(points.length / stride);
      const random = seededRandom(route.seed ?? 575);
      const particles = [];
      if (rawCount === 0) return particles;
    
      // Enforce per-fish <= 2,500 point budget deterministically.
      const targetCount = Math.min(rawCount, MAX_POINTS_PER_FISH);
      const stepIndex = rawCount / targetCount;
    
      // Stride 9 layout: [x, y, along, across, r, g, b, alpha, size]
      // Stride 7 layout: [along, across, r, g, b, alpha, size]
      const offset = stride >= 9 ? 2 : 0;
      const attenuateShadow = Boolean(route.shadow && !dedicatedShadow);
      const lateralScale = route.shoulderScale ?? 1;
      const mirror = route.mirror ? -1 : 1;
    
      for (let k = 0; k < targetCount; k += 1) {
        const base = Math.min(rawCount - 1, Math.floor(k * stepIndex)) * stride;
        const along = points[base + offset];
        const across = points[base + offset + 1] * lateralScale * mirror;
        let r = points[base + offset + 2];
        let g = points[base + offset + 3];
        let b = points[base + offset + 4];
        let opacity = points[base + offset + 5];
        const size = points[base + offset + 6];
    
        if (attenuateShadow) {
          const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          r = 0.08 + 0.14 * luma;
          g = 0.16 + 0.24 * luma;
          b = 0.15 + 0.21 * luma;
          opacity *= 0.38;
        }
    
        const clampedAlong = clamp(along, 0, 1);
        const station = clampedAlong * FISH.segments;
        const joint = Math.min(Math.floor(station), FISH.segments - 1);
    
        // Derive secondary fin breathing and tail veil lag directly from sampled (along, across).
        const inTail = clampedAlong > FISH.peduncle
          ? clamp((clampedAlong - FISH.peduncle) / Math.max(0.01, 1 - FISH.peduncle), 0, 1)
          : 0;
        const isFinTip = clampedAlong <= FISH.peduncle && Math.abs(across) > 0.078;
        const drift = inTail > 0 ? 0.009 * inTail : (isFinTip ? 0.004 : 0);
        const floatBack = inTail > 0 ? 0.024 * inTail * inTail : 0;
        const tailLag = inTail > 0 ? 0.40 * inTail : 0;
    
        particles.push({
          joint,
          blend: station - joint,
          across,
          opacity,
          size,
          drift,
          floatBack,
          tailLag,
          phase: TAU * random(),
          color: [r, g, b]
        });
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
      const length = Math.max(1e-6, Math.hypot(dx, dy));
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
    
      constructor(route, sample) {
        this.route = route;
        this.direction = route.direction ?? 1;
        this.particles = buildSampledParticles(route, sample);
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
          const unit = length / Math.max(1e-6, Math.sqrt(dx * dx + dy * dy));
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