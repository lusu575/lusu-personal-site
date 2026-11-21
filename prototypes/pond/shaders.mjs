import { KOI_ROUTES } from "./fish.mjs?v=20261119-gemini-11align1";

export const WATER = Object.freeze({
  scale: 1.0,
  flows: [0.007, 0.013],
  clickCapacity: 16,
  clickSink: 0.060,
  clickLifetime: 2.0,
  clickSpeed: 0.185,
  wakeCapacity: 6,
  wakeLifetime: 2.2,
  wakeSpeed: 0.115,
  bottomRefraction: 5.5,
  fishRefraction: 1.75,
  lotusRefraction: 1.00,
  fishSpread: 0.50,
  caustics: 0.068
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
  float alpha = vColor.a * (1.0 - smoothstep(0.28, 0.50, radius));
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

float fbm(vec2 p) {
  float v = 0.54 * noise(p);
  v += 0.30 * noise(p * 2.05 + vec2(5.2, 1.3));
  v += 0.16 * noise(p * 4.11 + vec2(1.7, 9.2));
  return v;
}

void main() {
  vec2 uv = vUV;
  vec2 q = vec2(uv.x, 1.0 - uv.y);
  vec2 px = uv * uSize;

  float clouds = fbm(q * vec2(7.4, 6.6) + vec2(0.8, 2.1));
  float detail = fbm(q * vec2(16.0, 14.0) + vec2(4.3, 7.6));
  float streaks = noise(q * vec2(11.0, 32.0) + vec2(3.1, 6.2));

  vec2 cMain = (q - vec2(0.495, 0.515)) / vec2(0.258, 0.250);
  float mainPool = exp(-1.28 * pow(length(cMain), 2.18));

  vec2 cUpper = (q - vec2(0.418, 0.325)) / vec2(0.125, 0.128);
  float upperPool = exp(-dot(cUpper, cUpper));

  vec2 cLower = (q - vec2(0.610, 0.665)) / vec2(0.145, 0.125);
  float lowerPool = exp(-dot(cLower, cLower));

  float rawLight = max(mainPool * 0.98, max(upperPool * 0.94, lowerPool * 0.88));
  float dapple = smoothstep(0.22, 0.78, 0.58 * clouds + 0.42 * detail);
  float light = clamp(rawLight * (0.54 + 0.68 * dapple), 0.0, 1.0);

  float shelf = exp(-square((q.x - 0.108) / 0.098) - square((q.y - 0.50) / 0.21));
  float banks = smoothstep(0.45, 1.04, length((q - 0.5) * vec2(1.66, 1.60)) + 0.10 * (clouds - 0.5));

  vec3 deepTeal = vec3(0.048, 0.172, 0.158);
  vec3 midTeal = vec3(0.162, 0.520, 0.405);
  vec3 brightEmerald = vec3(0.290, 0.675, 0.505);

  vec3 bed = mix(deepTeal, midTeal, smoothstep(0.03, 0.50, light));
  bed = mix(bed, brightEmerald, smoothstep(0.44, 0.97, light));
  bed += shelf * vec3(0.036, 0.158, 0.122) * (0.78 + 0.30 * clouds);
  bed *= (0.91 + 0.14 * streaks) * (1.0 - banks * 0.24);

  vec2 beadCell = vec2(5.0, 5.0);
  vec2 grid = px / beadCell;
  grid.x += 0.5 * mod(floor(grid.y), 2.0);
  vec2 gc = floor(grid);
  vec2 gf = (fract(grid) - (0.36 + 0.28 * hash22(gc))) * beadCell;
  float bead = 1.0 - smoothstep(1.10, 2.05, length(gf));
  float pick = hash(gc + 17.3);
  bed *= 0.90 + 0.18 * bead * (0.65 + 0.35 * pick);
  bed += vec3(0.14, 0.21, 0.14) * bead * step(0.74, pick) * light * 0.40;

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

const float CELL_PITCH = 5.1;
const vec2 TARGET_SLOPE = vec2(-0.025, 0.100);
const vec2 MICRO_SLOPE_SPREAD = vec2(0.148, 0.165);
const mat2 LATTICE_ROT = mat2(0.939693, -0.342020, 0.342020, 0.939693);
const mat2 LATTICE_INV = mat2(0.939693, 0.342020, -0.342020, 0.939693);

vec3 wave(vec2 p, vec2 direction, float wavelength, float amplitude, float phase) {
  vec2 k = direction * (TAU / wavelength);
  float argument = dot(k, p) + phase;
  return amplitude * vec3(sin(argument), cos(argument) * k);
}

vec4 packet(vec2 p, vec4 event, vec4 shape, float waveNumber) {
  vec2 offset = p - event.xy;
  vec2 ellip = vec2(offset.x * 0.76, offset.y * 1.36);
  float r2 = dot(ellip, ellip);
  if (r2 < shape.z || r2 > shape.w) return vec4(0.0);

  float invSigma2 = shape.x;
  if (shape.y > 0.0) {
    float height = event.w * exp(-0.5 * r2 * invSigma2);
    vec2 grad = -height * vec2(ellip.x * 0.76, ellip.y * 1.36) * invSigma2;
    return vec4(height, grad, 0.0);
  }

  float r = sqrt(r2);
  float d = r - event.z;
  float env = exp(-0.5 * d * d * invSigma2);
  float strength = event.w * env;
  float ph = d * waveNumber;
  float c = cos(ph);
  float height = strength * c;
  float dHdr = -strength * waveNumber * sin(ph) - height * d * invSigma2;
  vec2 grad = vec2(ellip.x * 0.76, ellip.y * 1.36) * (dHdr / max(r, 0.0001));

  float ang = atan(ellip.y, ellip.x);
  float seedPhase = fract(event.x * 13.7 + event.y * 29.3) * TAU;
  float arcMod = 0.66 + 0.34 * sin(2.0 * ang + seedPhase) + 0.18 * cos(ang - seedPhase);
  float arcMask = smoothstep(0.18, 0.72, arcMod);
  float innerFade = smoothstep(0.016, 0.044, r);
  float crestLine = smoothstep(0.72, 0.986, c) * env * innerFade * arcMask * clamp(abs(event.w) * 540.0, 0.0, 1.30);
  return vec4(height, grad, crestLine);
}

vec4 heightField(vec2 p) {
  vec2 first = p - uTime * ${WATER.flows[0]} * vec2(0.8, -0.6);
  vec2 second = p - uTime * ${WATER.flows[1]} * vec2(-0.96, 0.28);
  vec3 surface = wave(first, vec2(0.12, 0.993), 0.046, 0.00098, 0.7);
  surface += wave(first, vec2(-0.38, 0.925), 0.088, 0.00106, 2.6);
  surface += wave(second, vec2(-0.16, 0.987), 0.030, 0.00064, 1.3);
  surface += wave(second, vec2(0.55, 0.835), 0.072, 0.00082, 4.1);
  surface += wave(p, vec2(-0.91, 0.415), 0.220, 0.00086, -0.46 * uTime);
  surface += wave(p, vec2(0.30, 0.954), 0.115, 0.00062, 0.67 * uTime);

  float ringCrest = 0.0;
  for (int i = 0; i < uClickCount; i++) {
    vec4 pk = packet(p, uClicks[i], uClickShape[i], TAU / 0.046);
    surface += pk.xyz;
    ringCrest = max(ringCrest, pk.w * 1.25);
  }
  for (int i = 0; i < uWakeCount; i++) {
    vec4 pk = packet(p, uWakes[i], uWakeShape[i], TAU / 0.050);
    surface += pk.xyz;
    ringCrest = max(ringCrest, pk.w);
  }
  return vec4(surface, ringCrest);
}

void main() {
  vec2 p = vUV * uSize / min(uSize.x, uSize.y);
  vec4 field = heightField(p);
  vec3 surface = field.xyz;
  float ringCrest = field.w;

  float slopeMag = length(surface.yz);
  vec2 slope = surface.yz / max(PEAK_SLOPE, slopeMag);
  vec2 px = 1.0 / uSize;

  vec4 ground = texture(uBed, vUV + slope * px * ${WATER.bottomRefraction.toFixed(2)});
  vec3 bed = ground.rgb;

  float waveFacing = dot(surface.yz, vec2(-0.14, 0.990));
  float waveCrest = smoothstep(-0.0002, 0.0015, surface.x) * smoothstep(-0.010, 0.110, waveFacing);
  float relief = clamp(waveFacing * 2.1, -1.0, 1.0);
  bed *= 1.0 + ${WATER.caustics.toFixed(3)} * relief * (0.30 + 0.70 * ground.a);

  vec2 q = vec2(vUV.x, 1.0 - vUV.y);
  float axis = mix(0.415, 0.635, smoothstep(0.28, 0.68, q.y));
  vec2 upperCore = (q - vec2(0.415, 0.298)) / vec2(0.052, 0.092);
  vec2 upperHalo = (q - vec2(0.418, 0.312)) / vec2(0.102, 0.155);
  vec2 lowerCore = (q - vec2(0.648, 0.668)) / vec2(0.080, 0.075);
  vec2 bridge = (q - vec2(axis, 0.495)) / vec2(0.140, 0.210);

  float uCore = exp(-dot(upperCore, upperCore));
  float uHalo = exp(-dot(upperHalo, upperHalo));
  float upperBeam = max(uCore, 0.56 * uHalo);
  float lowerBeam = 0.78 * exp(-dot(lowerCore, lowerCore));
  float bridgeBeam = exp(-dot(bridge, bridge));
  float beamPath = max(upperBeam, max(0.68 * lowerBeam, 0.28 * bridgeBeam));

  float waveletBand = smoothstep(-0.0003, 0.0010, surface.x) * (0.45 + 0.55 * smoothstep(-0.02, 0.08, waveFacing));
  bed += uCore * waveletBand * vec3(0.32, 0.22, 0.06);
  bed += lowerBeam * waveletBand * vec3(0.10, 0.08, 0.02) * ground.a;

  vec2 pondPx = p * 1024.0 + slope * 0.85;
  float aa = max(0.45, 0.55 * max(fwidth(pondPx.x), fwidth(pondPx.y)));

  // 1. Discrete Microfacet Sunbeam & Caustic Sparkles (fast 2x2 nearest-cell lookup).
  vec3 reflection = vec3(0.0);
  float glintPotential = max(beamPath, ground.a * 0.55);
  if (glintPotential > 0.02) {
    vec2 rotPos = (LATTICE_ROT * pondPx) / CELL_PITCH;
    vec2 nearest = floor(rotPos + 0.5);

    float cone = mix(0.066, 0.225, upperBeam) + 0.044 * lowerBeam;
    float cone2 = cone * cone;
    float heightBias = 0.60 + 0.40 * smoothstep(-0.0011, 0.0012, surface.x);

    vec3 warmAccum = vec3(0.0);
    vec3 coolAccum = vec3(0.0);

    for (int dy = -1; dy <= 0; dy++) {
      for (int dx = -1; dx <= 0; dx++) {
        vec2 cell = nearest + vec2(float(dx), float(dy));
        vec2 jitter = hash22(cell);
        vec2 center = 0.22 + 0.56 * jitter;
        vec2 diffRot = (cell + center - rotPos) * CELL_PITCH;
        if (dot(diffRot, diffRot) > 9.2) continue;

        vec2 r1 = hash22(cell + vec2(19.37, 7.13));
        vec2 r2 = hash22(cell + vec2(73.19, 41.57));
        vec2 microSlope = (r1 + r2 - 1.0) * MICRO_SLOPE_SPREAD;

        vec2 macroSlope = vec2(surface.y * 0.58, surface.z * 1.12);
        vec2 slopeErr = (macroSlope + microSlope - TARGET_SLOPE) * vec2(0.92, 1.05);
        float err2 = dot(slopeErr, slopeErr);
        if (err2 >= cone2) continue;

        float hit = (1.0 - smoothstep(cone2 * 0.12, cone2, err2)) * heightBias;
        vec2 diffPond = LATTICE_INV * diffRot;
        float dist = length(diffPond * vec2(0.88, 1.06));
        float grain = fract(jitter.x * 17.3 + jitter.y * 11.7);
        float coreRadius = mix(1.46, 1.98, grain) * (0.92 + 0.16 * hit);
        float core = 1.0 - smoothstep(coreRadius - aa, coreRadius + aa, dist);
        float halo = (1.0 - smoothstep(coreRadius * 0.45, coreRadius * 2.05, dist)) * 0.23;
        float kernel = core + halo;

        float tint = hash(cell + vec2(91.1, 29.4));
        float warmChance = clamp(0.10 + 0.86 * upperBeam + 0.52 * lowerBeam, 0.0, 0.98);
        float isWarm = step(tint, warmChance) * smoothstep(0.06, 0.42, beamPath);
        float hotCore = smoothstep(0.46, 0.88, hit) * core * max(uCore, 0.62 * lowerBeam);

        vec3 warmTone = mix(vec3(1.16, 0.85, 0.30), vec3(1.30, 1.12, 0.70), hotCore);
        float warmGain = 0.84 + 0.66 * upperBeam + 0.40 * lowerBeam;
        warmAccum += warmTone * (hit * isWarm * kernel * warmGain);

        float coolWeight = hit * (1.0 - 0.74 * isWarm) * (0.20 + 0.62 * ground.a);
        coolAccum += vec3(0.26, 0.48, 0.35) * (coolWeight * (core * 0.78 + halo * 0.22));
      }
    }
    reflection += warmAccum + coolAccum;
  }

  // 2. Crisp Beaded Elliptical Ripple Rings around swimming koi & outer pads.
  if (ringCrest > 0.012) {
    vec2 rGrid = pondPx / 4.7;
    rGrid.x += 0.5 * mod(floor(rGrid.y), 2.0);
    vec2 rCell = floor(rGrid);
    vec2 rJit = 0.30 + 0.40 * hash22(rCell + 11.7);
    float rDist = length((fract(rGrid) - rJit) * 4.7);
    float rDot = 1.0 - smoothstep(1.18, 2.00, rDist);
    float rKeep = step(0.14, hash(rCell + 53.9));
    vec3 darkRingTone = vec3(0.24, 0.46, 0.40);
    vec3 litRingTone = mix(vec3(0.92, 0.90, 0.56), vec3(1.12, 1.06, 0.80), clamp(beamPath + 0.35 * ground.a, 0.0, 1.0));
    vec3 ringColor = mix(darkRingTone, litRingTone, smoothstep(0.06, 0.42, ground.a + 0.5 * beamPath));
    reflection += ringColor * (ringCrest * rDot * rKeep * mix(0.68, 1.05, smoothstep(0.05, 0.42, ground.a)));
  }

  // 3. Sparse Starlight Pinpricks across the dark pond ("暗处稀疏暗光点").
  {
    vec2 sGrid = (vUV * uSize) / 78.0;
    vec2 sCell = floor(sGrid);
    float sPick = hash(sCell + 307.1);
    if (sPick > 0.46) {
      vec2 sCenter = 0.14 + 0.72 * hash22(sCell + 91.3);
      float sDist = length((fract(sGrid) - sCenter) * 78.0);
      float twinkle = 0.78 + 0.22 * sin(uTime * (1.0 + 1.3 * sPick) + sPick * 41.0);
      float sCore = 1.0 - smoothstep(0.95, 2.25, sDist);
      vec3 sColor = sPick > 0.72 ? vec3(1.08, 0.88, 0.52) : vec3(0.76, 0.96, 0.88);
      float darkFade = 1.0 - 0.62 * ground.a;
      reflection += sColor * (sCore * twinkle * darkFade * 0.88);
    }
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
    koi = 0.88 * textureLod(uFish, fishUV, 0.0);
    koi += 0.06 * (textureLod(uFish, fishUV + spread, 0.0) + textureLod(uFish, fishUV - spread, 0.0));
  }
  koi.rgb *= (1.52 + 0.15 * waveCrest) * vec3(1.00, 0.98, 0.93);
  vec3 water = bed * (1.0 - koi.a) + koi.rgb + reflection * (1.0 - 0.65 * koi.a);

  vec2 lotusOffset = slope * ${WATER.lotusRefraction.toFixed(2)} + vec2(0.0, -clamp(420.0 * surface.x, -1.2, 1.2));
  vec4 lotus = texture(uLotus, vUV + lotusOffset * px);
  float lotusLight = 1.20 + 0.14 * waveCrest + 0.08 * clamp(surface.x * 380.0, -1.0, 1.0);
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
    color = mix(color, vec3(0.72, 0.88, 0.86), 0.60 * (1.0 - smoothstep(0.35, 1.10, min(distance.x, distance.y))));
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
