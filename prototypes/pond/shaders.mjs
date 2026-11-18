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
  bottomRefraction: 3.5,
  fishRefraction: 2.1,
  fishSpread: 1.3,
  caustics: 0.09
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

export const fishVertex = GLSL + `
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

export const fishFragment = GLSL + `
in vec4 vColor;
out vec4 outColor;

void main() {
  float radius = length(gl_PointCoord - 0.5);
  float alpha = vColor.a * (1.0 - smoothstep(0.29, 0.50, radius));
  outColor = vec4(vColor.rgb * alpha, alpha);
}`;

export const waterFragment = GLSL + `
in vec2 vUV;
out vec4 outColor;
uniform vec2 uSize;
uniform float uTime;
uniform sampler2D uFish;
uniform int uClickCount;
uniform int uWakeCount;
uniform vec4 uClicks[${WATER.clickCapacity}];
uniform vec4 uWakes[${WATER.wakeCapacity}];

const float TAU = ${TAU};
const float PEAK_SLOPE = 0.29;

float square(float value) {
  return value * value;
}

float hash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

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

// Height and its analytic gradient in short-edge units.
vec3 wave(vec2 p, vec2 direction, float wavelength, float amplitude, float phase) {
  vec2 k = direction * (TAU / wavelength);
  float argument = dot(k, p) + phase;
  return amplitude * vec3(sin(argument), cos(argument) * k);
}

vec3 packet(vec2 p, vec4 event, float delay, float lifetime, float speed, float wavelength) {
  vec2 offset = p - event.xy;
  float r = length(offset);
  vec2 radial = offset / max(r, 0.0001);
  float age = uTime - event.z;
  if (age < delay) {
    float sigma = 0.016;
    float height = -event.w * 0.00145 * sin(3.14159265 * age / delay) * exp(-0.5 * r * r / (sigma * sigma));
    return vec3(height, -height * offset / (sigma * sigma));
  }

  float travel = age - delay;
  float front = travel * speed;
  float d = r - front;
  float sigma = 0.018 + 0.024 * travel;
  float waveNumber = TAU / wavelength;
  float fade = smoothstep(0.0, 0.095, travel) * pow(max(0.0, 1.0 - age / lifetime), 1.55);
  float strength = event.w * 0.0021 * fade * exp(-0.5 * d * d / (sigma * sigma));
  float height = strength * cos(d * waveNumber);
  float slope = -strength * waveNumber * sin(d * waveNumber) - height * d / (sigma * sigma);
  return vec3(height, radial * slope);
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
    surface += packet(p, uClicks[i], ${WATER.clickSink}, ${WATER.clickLifetime}, ${WATER.clickSpeed}, 0.020);
  }
  for (int i = 0; i < uWakeCount; i++) {
    surface += packet(p, uWakes[i], 0.0, ${WATER.wakeLifetime}, ${WATER.wakeSpeed}, 0.025);
  }
  return surface;
}

float sand(vec2 px, float cellSize, float chance, float salt) {
  vec2 grid = px / cellSize;
  vec2 cell = floor(grid);
  float pick = hash(cell + salt);
  vec2 center = 0.2 + 0.6 * vec2(hash(cell + 17.3 + salt), hash(cell + 42.7 + salt));
  vec2 offset = (fract(grid) - center) * cellSize;
  return step(pick, chance) * (1.0 - smoothstep(0.38, 1.42 + pick * 2.8, length(offset)));
}

vec3 pondBed(vec2 uv, vec2 px, out float centralLight, out float bedGrain) {
  float broad = noise(uv * vec2(9.3, 8.0) + vec2(0.0, 2.7));
  float bands = noise(uv * vec2(15.0, 24.0) + vec2(6.4, 8.7));
  float axis = 0.475 + 0.039 * sin(7.6 * uv.y + 0.4);
  vec2 fromLight = (uv - vec2(axis, 0.51)) / vec2(0.33, 0.56);
  float deep = exp(-1.32 * pow(abs(fromLight.x), 2.65) - 1.10 * pow(abs(fromLight.y), 2.25));
  float leftShelf = exp(-square((uv.x - 0.12) / 0.145) - square((uv.y - 0.48) / 0.34));
  float banks = smoothstep(0.40, 1.05, length((uv - 0.5) * vec2(1.74, 1.56)) + 0.11 * (broad - 0.5));
  centralLight = clamp(deep * (0.86 + 0.25 * broad), 0.0, 1.0);
  bedGrain = bands;
  vec3 distant = vec3(0.051, 0.177, 0.167);
  vec3 shallows = vec3(0.145, 0.615, 0.502);
  vec3 bed = mix(distant, shallows, centralLight) + leftShelf * vec3(0.037, 0.280, 0.184);
  bed *= (0.85 + 0.25 * bands + 0.12 * broad) * (1.0 - banks * 0.32);
  float flecks = sand(px, 13.0, 0.15, 21.0) + 0.48 * sand(px, 7.0, 0.28, 80.0);
  bed += vec3(0.38, 0.49, 0.22) * flecks * (0.19 + 0.53 * centralLight);
  return bed;
}

void main() {
  vec2 p = vUV * uSize / min(uSize.x, uSize.y);
  vec3 surface = heightField(p);
  vec2 slope = surface.yz / max(PEAK_SLOPE, length(surface.yz));
  vec2 px = 1.0 / uSize;

  vec2 bedUV = vUV + slope * px * ${WATER.bottomRefraction};
  float centralLight;
  float bedGrain;
  vec3 bed = pondBed(bedUV, bedUV * uSize, centralLight, bedGrain);

  // Intersections of the two moving wave spectra form and break lit crest fragments.
  float crest = smoothstep(0.00035, 0.0021, surface.x);
  float facing = smoothstep(0.004, 0.093, dot(surface.yz, vec2(-0.19, 0.982)));
  float openings = smoothstep(0.29, 0.73, bedGrain);
  float caustic = crest * facing * (0.24 + 0.76 * openings);
  bed *= 1.0 + ${WATER.caustics} * caustic;
  float sunPath = exp(-square((vUV.x - 0.43 - 0.040 * sin(8.0 * vUV.y)) / 0.131));
  float silver = caustic * (0.16 + 0.84 * sunPath) * (0.37 + 0.63 * centralLight);
  float grain = noise(vUV * vec2(95.0, 210.0) + surface.yz * 2.2);
  float shards = smoothstep(0.18, 0.59, silver) * smoothstep(0.35, 0.78, bedGrain);
  float shimmer = mix(0.57, 1.08, smoothstep(0.27, 0.74, grain));
  vec3 reflection = (vec3(0.39, 0.44, 0.20) * silver + vec3(0.45, 0.34, 0.16) * shards) * shimmer;

  vec2 fishUV = vUV + slope * px * ${WATER.fishRefraction};
  vec2 spread = ${WATER.fishSpread} * px;
  vec4 koi = 0.72 * texture(uFish, fishUV);
  koi += 0.07 * (texture(uFish, fishUV + vec2(spread.x, 0)) + texture(uFish, fishUV - vec2(spread.x, 0))
                + texture(uFish, fishUV + vec2(0, spread.y)) + texture(uFish, fishUV - vec2(0, spread.y)));
  // Light from the grains survives the downsample while the alpha still preserves their gaps.
  koi.rgb *= 2.45 * vec3(0.94, 0.99, 1.0);
  koi.rgb += koi.a * vec3(0.0, 0.012, 0.010);
  vec3 water = bed * (1.0 - koi.a) + koi.rgb + reflection;
  outColor = vec4(water, 1.0);
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
  vec2 powers = pow(axis, vec2(${CRT.tubeExponent}.0));
  float edge = powers.x + powers.y - 1.0;
  vec2 gradient = ${2 * CRT.tubeExponent}.0 * pow(axis, vec2(${CRT.tubeExponent - 1}.0)) / tubeSize;
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
