import { KOI_ROUTES } from "./fish.mjs?v=20261118-pond-r2-perf";

export const WATER = Object.freeze({
  scale: 0.65,
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
  caustics: 0.13
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
  float broad = noise(uv * vec2(9.3, 8.0) + vec2(0.0, 2.7));
  float bands = noise(uv * vec2(19.0, 38.0) + vec2(6.4, 8.7));
  float axis = 0.475 + 0.037 * sin(7.6 * uv.y + 0.4);
  vec2 fromLight = (uv - vec2(axis, 0.51)) / vec2(0.33, 0.56);
  float light = exp(-1.32 * pow(abs(fromLight.x), 2.65) - 1.10 * pow(abs(fromLight.y), 2.25));
  light = clamp(light * (0.91 + 0.17 * broad), 0.0, 1.0);
  float shelf = exp(-square((uv.x - 0.12) / 0.148) - square((uv.y - 0.48) / 0.34));
  float banks = smoothstep(0.43, 1.07, length((uv - 0.5) * vec2(1.74, 1.56)) + 0.11 * (broad - 0.5));
  vec3 bed = mix(vec3(0.052, 0.180, 0.157), vec3(0.14, 0.607, 0.458), light);
  bed += shelf * vec3(0.037, 0.225, 0.158);
  bed *= (0.875 + 0.20 * bands + 0.08 * broad) * (1.0 - banks * 0.24);

  float grit = noise(px / vec2(7.5, 3.4) + vec2(19.1, 0.0));
  bed *= 0.89 + 0.22 * grit;
  float flecks = sand(px, vec2(7.2, 4.8), 0.27, 21.0) +
                 0.30 * sand(px, vec2(4.6, 3.8), 0.18, 80.0);
  bed += vec3(0.20, 0.25, 0.13) * flecks * (0.28 + 0.39 * light);
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
const float GOLD_THRESHOLD = 0.13;

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
  vec2 slope = surface.yz / max(PEAK_SLOPE, length(surface.yz));
  vec2 px = 1.0 / uSize;

  vec4 ground = texture(uBed, vUV + slope * px * ${WATER.bottomRefraction.toFixed(2)});
  float crest = smoothstep(-0.00016, 0.00163, surface.x);
  float facing = smoothstep(0.009, 0.100, dot(surface.yz, vec2(-0.19, 0.982)));
  float litCrest = crest * facing;

  vec3 reflection = vec3(0.0);
  vec3 bed = ground.rgb;
  vec2 screenPx = vUV * uSize;
  float aa = 0.5 * max(fwidth(screenPx.x), fwidth(screenPx.y));
  if (litCrest > 0.0) {
    // Top-left coordinates keep the two highlights and the weaker bridge in scene space.
    vec2 q = vec2(vUV.x, 1.0 - vUV.y);
    float axis = mix(0.408, 0.610, smoothstep(0.30, 0.68, q.y));
    vec2 upper = (q - vec2(0.408, 0.305)) / vec2(0.068, 0.145);
    vec2 lower = (q - vec2(0.610, 0.650)) / vec2(0.115, 0.145);
    vec2 bridge = (q - vec2(axis, 0.495)) / vec2(0.115, 0.225);
    vec2 shelf = (q - vec2(0.124, 0.47)) / vec2(0.104, 0.44);
    float upperBeam = exp(-dot(upper, upper));
    float path = max(upperBeam,
      max(0.78 * exp(-dot(lower, lower)), 0.48 * exp(-dot(bridge, bridge))));
    float leftPath = exp(-dot(shelf, shelf));
    float light = (0.22 + 1.20 * path + 0.61 * leftPath) * (0.60 + 0.40 * ground.a);
    float facetLight = litCrest * light;

    // Fixed cells select the warm cores. The slope bends the pattern by less than a cell.
    vec2 cellSize = vec2(5.8, 4.7);
    vec2 facetGrid = (screenPx + slope * 1.8) / cellSize;
    facetGrid.x += 0.48 * mod(floor(facetGrid.y), 2.0);
    vec2 cell = floor(facetGrid);
    float grain = hash(cell + 31.7);
    vec2 center = 0.36 + 0.28 * vec2(grain, hash(cell + 49.3));
    vec2 facet = (fract(facetGrid) - center) * cellSize;
    float radius = length(facet * vec2(0.86, 1.10));
    float chip = 1.0 - smoothstep(1.98 - aa, 1.98 + aa, radius);
    float shard = smoothstep(0.038, mix(0.43, 0.30, path), facetLight) * (0.05 + 0.95 * chip) * (0.64 + 0.36 * grain);
    float gold = 0.0;
    if (facetLight > GOLD_THRESHOLD) {
      float coreRadius = mix(1.23, 1.53, grain);
      float core = 1.0 - smoothstep(coreRadius - aa, coreRadius + aa, radius);
      gold = smoothstep(GOLD_THRESHOLD, 0.58, facetLight) * core *
        step(hash(cell + 73.4), mix(0.04, 0.78, path)) * (0.80 + 0.55 * upperBeam);
    }
    reflection = facetLight * (0.11 + (0.49 + 0.15 * path) * chip) * vec3(0.37, 0.50, 0.25) +
      shard * vec3(0.49, 0.53, 0.23) + gold * vec3(0.76, 0.64, 0.31);
    bed *= (1.0 + ${WATER.caustics} * litCrest * (0.35 + 0.65 * chip));
    bed += vec3(0.020, 0.005, -0.015) * path * litCrest;
  }

  vec2 fishUV = vUV + slope * px * ${WATER.fishRefraction};
  vec2 spread = ${WATER.fishSpread} * vec2(0.80, 0.60) * px;
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
  koi.rgb *= (1.97 + 0.24 * litCrest) * vec3(0.93, 0.93, 0.88);
  koi.rgb += koi.a * vec3(0.0, 0.016, 0.013);
  vec3 water = bed * (1.0 - koi.a) + koi.rgb + reflection;

  // Floating particles follow the same surface through a shallower displacement and wave lighting.
  vec2 lotusOffset = slope * ${WATER.lotusRefraction} + vec2(0.0, -clamp(480.0 * surface.x, -1.5, 1.5));
  vec4 lotus = texture(uLotus, vUV + lotusOffset * px);
  float lotusLight = 1.35 + 0.28 * litCrest + 0.14 * clamp(surface.x * 410.0, -1.0, 1.0);
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
