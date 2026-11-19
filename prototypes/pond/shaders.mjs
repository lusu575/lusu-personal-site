import { KOI_ROUTES } from "./fish.mjs?v=20261119-gemini-water1";

export const WATER = Object.freeze({
  scale: 0.80,
  flows: [0.007, 0.013],
  clickCapacity: 16,
  clickSink: 0.060,
  clickLifetime: 1.6,
  clickSpeed: 0.22,
  wakeCapacity: 4,
  wakeLifetime: 1.25,
  wakeSpeed: 0.165,
  bottomRefraction: 6.0,
  fishRefraction: 3.5,
  lotusRefraction: 1.30,
  fishSpread: 0.95,
  caustics: 0.06
});

export const CRT = Object.freeze({
  barrel: 0.055,
  tubeExponent: 8,
  edgeSoftness: 3,
  scanPeriod: 5,
  scanDepth: 0.18,
  separation: 0.8,
  glowRadius: 2.2,
  glowGain: 0.14,
  glowThreshold: 0.58,
  vignette: 0.52
});

const GLSL = '#version 300 es\nprecision highp float;\n';
const TAU = '6.28318530718';

export const fullscreenVertex = GLSL + `
out vec2 vUV;

void main() {
  vec2 position = vec2(gl_VertexID & 1, gl_VertexID >> 1) * 4.0 - 1.0;
  vUV = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

export const pointVertex = GLSL + `
layout(location = 0) in vec3 aPoint;
layout(location = 1) in vec4 aColor;
uniform vec2 uSize;
uniform float uDpr;
out vec4 vColor;

void main() {
  gl_Position = vec4(aPoint.xy / uSize * 2.0 - 1.0, 0.0, 1.0);
  gl_PointSize = max(1.0, aPoint.z * uDpr);
  vColor = aColor;
}`;

export const pointFragment = GLSL + `
in vec4 vColor;
out vec4 outColor;

void main() {
  float radius = length(gl_PointCoord - 0.5);
  float alpha = vColor.a * (1.0 - smoothstep(0.29, 0.50, radius));
  outColor = vec4(vColor.rgb * alpha, alpha);
}`;

const scalarFunctions = `
float square(float value) {
  return value * value;
}

float hash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

vec2 hash22(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  q += dot(q, q.yzx + 33.33);
  return fract((q.xx + q.yz) * q.zy);
}`;

export const bedFragment = GLSL + scalarFunctions + `
in vec2 vUV;
out vec4 outColor;
uniform vec2 uSize;

float noise(vec2 p) {
  vec2 cell = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(cell), hash(cell + vec2(1, 0)), f.x),
    mix(hash(cell + vec2(0, 1)), hash(cell + vec2(1, 1)), f.x),
    f.y
  );
}

float sand(vec2 px, vec2 cellSize, float chance, float salt) {
  vec2 grid = px / cellSize;
  vec2 cell = floor(grid);
  float pick = hash(cell + salt);
  vec2 center = 0.23 + 0.54 * vec2(hash(cell + 17.3 + salt), hash(cell + 42.7 + salt));
  vec2 offset = (fract(grid) - center) * cellSize;
  return step(pick, chance) * (1.0 - smoothstep(0.35, 1.25 + pick * 1.8, length(offset)));
}

void main() {
  vec2 uv = vUV;
  vec2 px = uv * uSize;
  float broad = noise(uv * vec2(8.5, 7.2) + vec2(0.4, 2.7));
  float patches = noise(uv * vec2(14.5, 13.0) + vec2(3.1, 5.4));
  float bands = noise(uv * vec2(19.0, 36.0) + vec2(6.4, 8.7));

  // Spatially restricted central pool with broken mid-scale illumination.
  float axis = 0.480 + 0.036 * sin(7.4 * uv.y + 0.35);
  vec2 fromLight = (uv - vec2(axis, 0.505)) / vec2(0.265, 0.425);
  float pool = exp(-1.38 * pow(abs(fromLight.x), 2.15) - 1.18 * pow(abs(fromLight.y), 1.95));
  float midBreak = 0.78 + 0.22 * broad + 0.16 * (patches - 0.5);
  float light = clamp(pool * midBreak, 0.0, 1.0);
  light = smoothstep(0.05, 0.96, light);

  // Localized left shallow shelf (restricted to the left band so outer dark water stays deep teal).
  float shelf = exp(-square((uv.x - 0.105) / 0.105) - square((uv.y - 0.50) / 0.235));
  float banks = smoothstep(0.38, 1.02, length((uv - 0.5) * vec2(1.78, 1.60)) + 0.12 * (broad - 0.5));

  // Deep abyssal teal base preserves darkness and keeps green excess low outside the central pool.
  vec3 deepTeal = vec3(0.022, 0.106, 0.110);
  vec3 litEmerald = vec3(0.155, 0.555, 0.455);
  vec3 bed = mix(deepTeal, litEmerald, light);
  bed += shelf * vec3(0.048, 0.215, 0.172) * (0.86 + 0.24 * patches);
  bed *= (0.86 + 0.18 * bands + 0.09 * broad) * (1.0 - banks * 0.36);

  float grit = noise(px / vec2(7.5, 3.4) + vec2(19.1, 0.0));
  bed *= 0.90 + 0.20 * grit;
  float flecks = sand(px, vec2(7.4, 5.0), 0.24, 21.0) +
                 0.28 * sand(px, vec2(4.8, 4.0), 0.16, 80.0);
  vec3 fleckColor = mix(vec3(0.09, 0.18, 0.17), vec3(0.21, 0.27, 0.16), light);
  bed += fleckColor * flecks * (0.18 + 0.42 * light + 0.18 * shelf);
  outColor = vec4(bed, light);
}`;

export const waterFragment = GLSL + scalarFunctions + `
in vec2 vUV;
out vec4 outColor;
uniform vec2 uSize;
uniform float uTime;
uniform sampler2D uFish;
uniform vec4 uFishBounds[${KOI_ROUTES.length}];
uniform sampler2D uLotus;
uniform sampler2D uBed;
uniform int uClickCount;
uniform int uWakeCount;
uniform vec4 uClicks[${WATER.clickCapacity}];
uniform vec4 uWakes[${WATER.wakeCapacity * KOI_ROUTES.length}];
uniform vec4 uClickShape[${WATER.clickCapacity}];
uniform vec4 uWakeShape[${WATER.wakeCapacity * KOI_ROUTES.length}];

const float TAU = ${TAU};
const float PEAK_SLOPE = 0.29;

// Discrete microfacet lattice constants (pond-space pixels at 1024px reference height).
const float CELL_PITCH = 6.2;
const float MAX_KERNEL_DIST2 = 10.5;
const vec2 TARGET_SLOPE = vec2(-0.038, 0.145);
const vec2 MICRO_SLOPE_SPREAD = vec2(0.23, 0.25);
const mat2 LATTICE_ROT = mat2(0.848048, -0.529919, 0.529919, 0.848048);
const mat2 LATTICE_INV = mat2(0.848048, 0.529919, -0.529919, 0.848048);

// Height and its analytic gradient in short-edge units.
vec3 wave(vec2 p, vec2 direction, float wavelength, float amplitude, float phase) {
  vec2 k = direction * (TAU / wavelength);
  float argument = dot(k, p) + phase;
  return amplitude * vec3(sin(argument), cos(argument) * k);
}

vec3 packet(vec2 p, vec4 event, vec4 shape, float waveNumber) {
  vec2 offset = p - event.xy;
  float r2 = dot(offset, offset);
  // The CPU provides the Gaussian envelope and its conservative radial bounds.
  if (r2 < shape.z || r2 > shape.w) return vec3(0.0);

  float invSigma2 = shape.x;
  if (shape.y > 0.0) {
    float height = event.w * exp(-0.5 * r2 * invSigma2);
    return vec3(height, -height * offset * invSigma2);
  }

  float r = sqrt(r2);
  float d = r - event.z;
  float strength = event.w * exp(-0.5 * d * d * invSigma2);
  float height = strength * cos(d * waveNumber);
  float slope = -strength * waveNumber * sin(d * waveNumber) - height * d * invSigma2;
  return vec3(height, offset * (slope / max(r, 0.0001)));
}

vec3 heightField(vec2 p) {
  vec2 first = p - uTime * ${WATER.flows[0]} * vec2(0.8, -0.6);
  vec2 second = p - uTime * ${WATER.flows[1]} * vec2(-0.96, 0.28);
  vec3 surface = wave(first, vec2(0.16, 0.9871), 0.055, 0.00086, 0.7);
  surface += wave(first, vec2(-0.46, 0.8879), 0.099, 0.00102, 2.6);
  surface += wave(second, vec2(-0.20, 0.9798), 0.033, 0.00054, 1.3);
  surface += wave(second, vec2(0.62, 0.7846), 0.076, 0.00081, 4.1);
  surface += wave(p, vec2(-0.91, 0.4146), 0.23, 0.00090, -0.46 * uTime);
  surface += wave(p, vec2(0.36, 0.9330), 0.127, 0.00057, 0.67 * uTime);
  for (int i = 0; i < uClickCount; i++) {
    surface += packet(p, uClicks[i], uClickShape[i], TAU / 0.020);
  }
  for (int i = 0; i < uWakeCount; i++) {
    surface += packet(p, uWakes[i], uWakeShape[i], TAU / 0.025);
  }
  return surface;
}

void main() {
  vec2 p = vUV * uSize / min(uSize.x, uSize.y);
  vec3 surface = heightField(p);
  float slopeMag = length(surface.yz);
  vec2 slope = surface.yz / max(PEAK_SLOPE, slopeMag);
  vec2 px = 1.0 / uSize;

  vec4 ground = texture(uBed, vUV + slope * px * ${WATER.bottomRefraction.toFixed(2)});
  vec3 bed = ground.rgb;

  // Subtle zero-mean wave shading keeps ambient flow and ripples legible without painting bright bands.
  float waveFacing = dot(surface.yz, vec2(-0.19, 0.982));
  float waveCrest = smoothstep(-0.0003, 0.0016, surface.x) * smoothstep(-0.015, 0.115, waveFacing);
  float relief = clamp(waveFacing * 2.2, -1.0, 1.0);
  bed *= 1.0 + ${WATER.caustics.toFixed(3)} * relief * (0.35 + 0.65 * ground.a);

  // Scene-space light paths (top-left coordinates): dense upper beam U, sparser lower-right beam D, weak bridge.
  vec2 q = vec2(vUV.x, 1.0 - vUV.y);
  float axis = mix(0.412, 0.640, smoothstep(0.30, 0.66, q.y));
  vec2 upper = (q - vec2(0.412, 0.302)) / vec2(0.064, 0.135);
  vec2 lower = (q - vec2(0.640, 0.655)) / vec2(0.105, 0.125);
  vec2 bridge = (q - vec2(axis, 0.485)) / vec2(0.100, 0.210);
  float upperBeam = exp(-dot(upper, upper));
  float lowerBeam = exp(-dot(lower, lower));
  float bridgeBeam = exp(-dot(bridge, bridge));
  float beamPath = max(upperBeam, max(0.72 * lowerBeam, 0.38 * bridgeBeam));
  float rippleBoost = smoothstep(0.14, 0.34, slopeMag);

  // Compute screen-space derivative outside conditional branch for spec-compliant GLSL ES 3.00.
  vec2 pondPx = p * 1024.0 + slope * 1.1;
  float aa = max(0.50, 0.55 * max(fwidth(pondPx.x), fwidth(pondPx.y)));

  vec3 reflection = vec3(0.0);
  float glintPotential = max(beamPath, max(0.28 * ground.a, 0.72 * rippleBoost));
  if (glintPotential > 0.015) {
    // Stable rotated pond-space lattice breaks horizontal row alignment and CRT scanline locking.
    vec2 rotPos = (LATTICE_ROT * pondPx) / CELL_PITCH;
    vec2 baseCell = floor(rotPos);

    // Area-light angular acceptance cone: wider in upper beam U, tighter in lower beam D.
    float cone = mix(0.056, 0.106, upperBeam) + 0.022 * rippleBoost;
    float cone2 = cone * cone;
    float heightBias = 0.62 + 0.38 * smoothstep(-0.0014, 0.0014, surface.x);
    float warmGate = smoothstep(0.16, 0.88, beamPath) + 0.45 * rippleBoost * smoothstep(0.18, 0.78, ground.a);

    vec3 warmAccum = vec3(0.0);
    vec3 coolAccum = vec3(0.0);

    for (int dy = -1; dy <= 1; dy++) {
      for (int dx = -1; dx <= 1; dx++) {
        vec2 cell = baseCell + vec2(float(dx), float(dy));
        vec2 jitter = hash22(cell);
        vec2 center = 0.16 + 0.68 * jitter;
        vec2 diffRot = (cell + center - rotPos) * CELL_PITCH;
        float dist2 = dot(diffRot, diffRot);
        if (dist2 > MAX_KERNEL_DIST2) continue;

        // Independent per-microfacet random micro-slope in the local tangent plane.
        vec2 r1 = hash22(cell + vec2(19.37, 7.13));
        vec2 r2 = hash22(cell + vec2(73.19, 41.57));
        vec2 microSlope = (r1 + r2 - 1.0) * MICRO_SLOPE_SPREAD;

        // Combine macro wave slope with micro-slope and test angular hit against area light half-vector.
        vec2 slopeErr = (surface.yz + microSlope - TARGET_SLOPE) * vec2(1.0, 1.12);
        float err2 = dot(slopeErr, slopeErr);
        if (err2 >= cone2) continue;

        float hit = (1.0 - smoothstep(cone2 * 0.08, cone2, err2)) * heightBias;

        // Transform offset back to pond space for mild natural foreshortening without bar-stretching.
        vec2 diffPond = LATTICE_INV * diffRot;
        float dist = length(diffPond * vec2(0.92, 1.12));
        float grain = fract(jitter.x * 17.3 + jitter.y * 11.7);
        float coreRadius = mix(1.05, 1.56, grain) * (0.90 + 0.18 * hit);
        float core = 1.0 - smoothstep(coreRadius - aa, coreRadius + aa, dist);
        float halo = (1.0 - smoothstep(coreRadius * 0.35, coreRadius * 1.85, dist)) * 0.18;
        float kernel = core + halo;

        float tint = hash(cell + vec2(91.1, 29.4));
        float warmChance = mix(0.24, 0.78, upperBeam);
        float isWarm = step(tint, warmChance) * warmGate;
        float hotCore = smoothstep(0.62, 0.96, hit) * core * (0.45 + 0.55 * upperBeam);

        // Pale yellow-green / champagne warm glints (target HSV ~73 deg, S ~0.26) + rare near-white cores.
        vec3 warmTone = mix(vec3(0.74, 0.62, 0.32), vec3(0.94, 0.88, 0.64), hotCore);
        warmAccum += warmTone * (hit * isWarm * kernel * (0.78 + 0.52 * upperBeam));

        // Cooler dim water-grain sparkles for non-warm hits inside the lit pool or ripples.
        float coolWeight = hit * (1.0 - 0.65 * isWarm) * max(0.32 * ground.a, max(0.55 * beamPath, 0.60 * rippleBoost));
        coolAccum += vec3(0.22, 0.44, 0.35) * (coolWeight * (core * 0.70 + halo * 0.30));
      }
    }

    reflection = warmAccum + coolAccum;
  }

  vec2 fishUV = vUV + slope * px * ${WATER.fishRefraction.toFixed(2)};
  vec2 spread = ${WATER.fishSpread.toFixed(2)} * vec2(0.80, 0.60) * px;
  vec4 koi = vec4(0.0);
  vec2 fishPx = fishUV * uSize;
  bool inFish = false;
  for (int i = 0; i < ${KOI_ROUTES.length}; i++) {
    vec4 box = uFishBounds[i];
    inFish = inFish || (all(greaterThanEqual(fishPx, box.xy)) && all(lessThanEqual(fishPx, box.zw)));
  }
  if (inFish) {
    koi = 0.84 * textureLod(uFish, fishUV, 0.0);
    koi += 0.08 * (textureLod(uFish, fishUV + spread, 0.0) + textureLod(uFish, fishUV - spread, 0.0));
  }
  koi.rgb *= (1.97 + 0.20 * waveCrest) * vec3(0.93, 0.93, 0.88);
  koi.rgb += koi.a * vec3(0.0, 0.016, 0.013);
  vec3 water = bed * (1.0 - koi.a) + koi.rgb + reflection;

  // Floating particles follow the same surface through a shallower displacement and wave lighting.
  vec2 lotusOffset = slope * ${WATER.lotusRefraction.toFixed(2)} + vec2(0.0, -clamp(480.0 * surface.x, -1.5, 1.5));
  vec4 lotus = texture(uLotus, vUV + lotusOffset * px);
  float lotusLight = 1.35 + 0.22 * waveCrest + 0.14 * clamp(surface.x * 410.0, -1.0, 1.0);
  outColor = vec4(water * (1.0 - lotus.a) + lotus.rgb * lotusLight, 1.0);
}`;

export const desktopFragment = GLSL + `
in vec2 vUV;
out vec4 outColor;
uniform sampler2D uWater;
uniform sampler2D uClock;
uniform vec2 uSize;
uniform vec2 uClockSize;
uniform bool uGrid;

void main() {
  vec3 color = texture(uWater, vUV).rgb;
  vec2 px = vUV * uSize;
  if (uGrid) {
    vec2 stepSize = uSize / vec2(16.0, 10.0);
    vec2 distance = abs(fract(px / stepSize + 0.5) - 0.5) * stepSize;
    float grid = 1.0 - smoothstep(0.35, 1.10, min(distance.x, distance.y));
    color = mix(color, vec3(0.72, 0.88, 0.86), 0.60 * grid);
  }

  float cell = min(2.0, uSize.x / (uClockSize.x + 22.0));
  vec2 clockPx = vec2(px.x - 0.5 * uSize.x, uSize.y - px.y - min(22.0, uSize.y * 0.045)) / cell;
  vec2 clockUV = (clockPx + vec2(0.5 * uClockSize.x, 0.0)) / uClockSize;
  if (all(greaterThanEqual(clockUV, vec2(0.0))) && all(lessThan(clockUV, vec2(1.0)))) {
    float text = texture(uClock, clockUV).r;
    color = mix(color, vec3(0.95, 1.0, 0.94), text);
  }
  outColor = vec4(color, 1.0);
}`;

export const crtFragment = GLSL + `
in vec2 vUV;
out vec4 outColor;
uniform sampler2D uDesktop;
uniform vec2 uSize;
uniform bool uCRT;

vec3 bright(vec2 uv) {
  return max(vec3(0.0), texture(uDesktop, uv).rgb - ${CRT.glowThreshold}) / (1.0 - ${CRT.glowThreshold});
}

void main() {
  if (!uCRT) {
    outColor = texture(uDesktop, vUV);
    return;
  }
  vec2 p = 2.0 * vUV - 1.0;
  vec2 tubeSize = max(uSize - 3.0, vec2(1.0));
  vec2 axis = abs(p) * uSize / tubeSize;
  vec2 axis2 = axis * axis;
  vec2 axis4 = axis2 * axis2;
  vec2 axis7 = axis4 * axis2 * axis;
  vec2 powers = axis7 * axis;
  float edge = powers.x + powers.y - 1.0;
  vec2 gradient = ${2 * CRT.tubeExponent}.0 * axis7 / tubeSize;
  float distance = edge / max(length(gradient), 0.0001);
  float tube = 1.0 - smoothstep(-${CRT.edgeSoftness}.0, 0.0, distance);
  if (tube <= 0.0) {
    outColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  vec2 src = 0.5 + 0.5 * p * (1.0 + ${CRT.barrel} * dot(p, p)) / (1.0 + ${CRT.barrel});
  vec2 radial = p * uSize / max(length(p * uSize), 0.0001);
  vec2 split = radial * min(length(p), 1.0) * ${CRT.separation} / uSize;
  vec3 color = vec3(texture(uDesktop, src + split).r, texture(uDesktop, src).g, texture(uDesktop, src - split).b);

  vec2 halo = ${CRT.glowRadius} / uSize;
  vec3 glow = 0.25 * (bright(src + vec2(halo.x, 0)) + bright(src - vec2(halo.x, 0))
                    + bright(src + vec2(0, halo.y)) + bright(src - vec2(0, halo.y)));
  float scan = 1.0 - ${CRT.scanDepth} * (0.5 + 0.5 * cos(${TAU} * src.y * uSize.y / ${CRT.scanPeriod}.0));
  float side = max(axis.x, 0.90 * axis.y);
  float falloff = 1.0 - ${CRT.vignette} * smoothstep(0.43, 1.0, side);
  outColor = vec4((color + ${CRT.glowGain} * glow) * scan * tube * falloff, 1.0);
}`;