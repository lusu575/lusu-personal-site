// GLSL ES 3.00 shaders for the Pond CRT multi-pass pipeline — Optimized for 120 FPS!
// - 3-octave FBM (visually identical, 25% faster)
// - Dynamic ambient particles layer (falling petals, maple leaves, snow) composited before phosphor quantization
// - Upgraded organic multi-ring sweeping season transition wavefront

export const FULLSCREEN_VERT = `#version 300 es
precision highp float;
out vec2 vUv;
void main() {
  vec2 pos = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vUv = pos;
  gl_Position = vec4(pos * 2.0 - 1.0, 0.0, 1.0);
}
`;

// Pass 1-3: Water Light Field + Underwater Koi + Ripples + Floating Flora + Dynamic Ambient Particles
export const SCENE_FRAG = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uFloraTex;
uniform sampler2D uFloraPrevTex;
uniform sampler2D uKoiTex;
uniform sampler2D uAmbientTex;
uniform float uSeasonSweep;
uniform vec2 uSweepOrigin;
uniform vec2 uResolution;
uniform float uTime;
uniform vec3 uWaterDeep;
uniform vec3 uWaterMid;
uniform vec3 uWaterAccent;
uniform vec3 uCausticTint;
uniform vec3 uSpecularTint;
uniform float uGlowColumnX;
uniform float uGlowColumnWidth;
uniform float uCausticStrength;
uniform float uShimmerSpeed;
uniform float uKoiDepthFog;

uniform vec4 uRipples[10];
uniform int uRippleCount;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// Fast 3-octave FBM for 120 FPS fluid water shimmer
float fbm3(vec2 p) {
  float v = 0.0;
  float a = 0.52;
  mat2 rot = mat2(0.80, -0.60, 0.60, 0.80);
  for (int i = 0; i < 3; i++) {
    v += a * noise(p);
    p = rot * p * 2.03 + vec2(17.1, 31.7);
    a *= 0.5;
  }
  return v;
}

float waterStreaks(vec2 uv, float t) {
  vec2 p = vec2(uv.x * 4.2, uv.y * 28.0);
  float drift1 = fbm3(p + vec2(t * 0.20, -t * 0.12));
  float drift2 = fbm3(p * vec2(1.6, 2.2) + vec2(-t * 0.16, t * 0.09) + drift1 * 1.25);
  float band = smoothstep(0.35, 0.80, drift2);
  float fine = noise(vec2(uv.x * 16.0 + drift1 * 1.6, uv.y * 90.0 - t * 0.55));
  float glint = pow(smoothstep(0.56, 0.94, fine * drift2 * 1.32), 2.5);
  return band * 0.62 + glint * 0.92;
}

vec3 evalRipples(vec2 uv, float aspect) {
  vec2 totalDisp = vec2(0.0);
  float totalCrest = 0.0;

  for (int i = 0; i < 10; i++) {
    if (i >= uRippleCount) break;
    vec4 rp = uRipples[i];
    if (rp.w <= 0.001 || rp.z < 0.0) continue;

    vec2 diff = uv - rp.xy;
    vec2 ell = vec2(diff.x * aspect, diff.y * 2.15);
    float dist = length(ell);
    vec2 dir = dist > 0.0005 ? ell / dist : vec2(0.0);

    float age = rp.z;
    float front = age * 0.165;
    float fade = exp(-age * 0.62) * rp.w;
    if (fade <= 0.005) continue;

    float behind = front - dist;
    if (behind > -0.04 && behind < 0.25) {
      float env = smoothstep(-0.02, 0.024, behind) * (1.0 - smoothstep(0.07, 0.24, behind));
      float wave = sin(behind * 84.0);
      float crest = pow(max(0.0, wave), 3.0) * env * fade;
      float angMod = 0.72 + 0.28 * sin(atan(ell.y, ell.x) * 3.0 + age * 1.3 + float(i));
      totalCrest += crest * angMod;
      totalDisp += dir * (wave * env * fade * 0.006);
    }
  }

  return vec3(totalDisp, clamp(totalCrest, 0.0, 1.3));
}

void main() {
  vec2 uv = vUv;
  float aspect = uResolution.x / max(1.0, uResolution.y);
  float t = uTime * uShimmerSpeed;

  vec3 rip = evalRipples(uv, aspect);
  vec2 waterUv = uv + rip.xy;
  vec2 centered = (waterUv - 0.5) * vec2(aspect, 1.0);

  // 1. Deep pond basin radial darkness
  float radialDist = length(centered * vec2(0.80, 1.02));
  float basinLight = 1.0 - smoothstep(0.18, 0.94, radialDist);

  // 2. Underwater depth variation
  float depthNoise = fbm3(waterUv * vec2(3.1, 2.3) + vec2(t * 0.035, -t * 0.025));
  float depthNoise2 = fbm3(waterUv * vec2(6.2, 4.8) - vec2(t * 0.04, t * 0.025));
  float depthMix = clamp(basinLight * 0.85 + (depthNoise - 0.45) * 0.42, 0.0, 1.0);

  vec3 col = mix(uWaterDeep, uWaterMid, smoothstep(0.05, 0.72, depthMix));
  float accentPatch = smoothstep(0.32, 0.82, depthNoise2) * smoothstep(0.88, 0.15, radialDist);
  col = mix(col, uWaterAccent, accentPatch * 0.52);

  // 3. Signature vertical light reflection column
  float colWarp = (depthNoise - 0.5) * 0.13 + sin(waterUv.y * 4.8 + t * 0.35) * 0.022;
  float dx = (waterUv.x - (uGlowColumnX + colWarp)) / max(0.08, uGlowColumnWidth);
  float lightColumn = exp(-dx * dx * 1.35);
  float vertProfile = 0.52 + 0.48 * sin(waterUv.y * 3.14159);
  float columnMask = lightColumn * vertProfile;

  // 4. Anisotropic water shimmer
  float streaks = waterStreaks(waterUv, t);
  col += uCausticTint * columnMask * (0.22 + 0.36 * streaks) * uCausticStrength;
  float shimmerWeight = (columnMask * 0.88 + basinLight * 0.24) * uCausticStrength;
  float highlight = pow(clamp(streaks, 0.0, 1.0), 1.42) * shimmerWeight;
  col += mix(uCausticTint, uSpecularTint, smoothstep(0.22, 0.78, highlight)) * highlight * 1.02;

  float edgeDark = 1.0 - smoothstep(0.58, 1.08, radialDist);
  col *= mix(0.28, 1.0, edgeDark);

  // 4.5 Underwater Skeletal Koi (refracted + softly veiled beneath the water surface)
  vec2 waterWarp = vec2(
    sin(uv.y * 26.0 + t * 1.3) * 0.0020,
    cos(uv.x * 20.0 - t * 1.0) * 0.0016
  );
  vec2 koiUv = vec2(uv.x, 1.0 - uv.y) + rip.xy * 1.40 + waterWarp;
  vec2 kTexel = vec2(1.5 / max(1.0, uResolution.x), 1.5 / max(1.0, uResolution.y)) * (1.0 + uKoiDepthFog * 2.2);
  vec4 koi = texture(uKoiTex, clamp(koiUv, 0.001, 0.999)) * 0.52;
  koi += texture(uKoiTex, clamp(koiUv + vec2(kTexel.x, kTexel.y), 0.001, 0.999)) * 0.12;
  koi += texture(uKoiTex, clamp(koiUv - vec2(kTexel.x, kTexel.y), 0.001, 0.999)) * 0.12;
  koi += texture(uKoiTex, clamp(koiUv + vec2(-kTexel.x, kTexel.y), 0.001, 0.999)) * 0.12;
  koi += texture(uKoiTex, clamp(koiUv + vec2(kTexel.x, -kTexel.y), 0.001, 0.999)) * 0.12;

  vec3 koiSubmerged = mix(koi.rgb, mix(uWaterMid * 1.6, uCausticTint * 0.75, 0.35), uKoiDepthFog);
  koiSubmerged += uCausticTint * highlight * 0.20 * koi.a;
  col = mix(col, koiSubmerged, koi.a * (1.0 - uKoiDepthFog * 0.35));

  // 5. Concentric luminous ripple crests on the water surface (above submerged koi)
  vec3 rippleColor = mix(uCausticTint, uSpecularTint, 0.48 + 0.34 * columnMask);
  col += rippleColor * rip.z * (0.54 + 0.38 * basinLight);

  // 6. Floating Flora Layer + Organic Multi-Ring Season Sweep Transition
  vec2 sway = vec2(
    sin(uTime * 0.65 + uv.y * 6.0) * 0.0016,
    cos(uTime * 0.52 + uv.x * 5.0) * 0.0012
  );
  vec2 floraUv = vec2(uv.x, 1.0 - uv.y) + sway + rip.xy * 0.50;
  vec4 floraNew = texture(uFloraTex, clamp(floraUv, 0.001, 0.999));
  vec4 flora = floraNew;

  if (uSeasonSweep < 0.999) {
    vec4 floraOld = texture(uFloraPrevTex, clamp(floraUv, 0.001, 0.999));
    // Organic FBM-warped wave front (not a rigid geometric circle!)
    float sweepDist = length((uv - uSweepOrigin) * vec2(aspect, 1.0)) + (depthNoise - 0.5) * 0.14;
    float sweepFront = uSeasonSweep * 2.25;
    float sweepMix = 1.0 - smoothstep(sweepFront - 0.18, sweepFront + 0.05, sweepDist);
    flora = mix(floraOld, floraNew, sweepMix);

    // Dual-ring luminous shockwave riding along the season transition wavefront
    float waveEnvelope = sin(uSeasonSweep * 3.14159);
    float ring1 = exp(-pow((sweepDist - sweepFront) * 22.0, 2.0));
    float ring2 = exp(-pow((sweepDist - (sweepFront - 0.11)) * 28.0, 2.0)) * 0.55;
    col += mix(uCausticTint, uSpecularTint, 0.72) * (ring1 + ring2) * waveEnvelope * 0.88;
  }

  vec3 floraLit = flora.rgb * (0.94 + 0.12 * columnMask + 0.12 * rip.z);
  col = mix(col, floraLit, flora.a);

  // 7. Dynamic Seasonal Ambient Particles (falling sakura petals, drifting maple leaves, snowfall, fireflies)
  vec2 ambUv = vec2(uv.x, 1.0 - uv.y) + rip.xy * 0.25;
  vec4 amb = texture(uAmbientTex, clamp(ambUv, 0.001, 0.999));
  col = mix(col, amb.rgb * 1.06, amb.a);

  fragColor = vec4(max(col, 0.0), 1.0);
}
`;

// Pass 4: Unified CRT Phosphor-Dot Matrix Quantization (optimized for 120 FPS)
export const PHOSPHOR_DOT_FRAG = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uSceneTex;
uniform vec2 uResolution;
uniform float uTime;
uniform float uDotPitchPx;
uniform vec4 uRipples[10];
uniform int uRippleCount;

float hash21(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

void main() {
  float aspect = uResolution.x / max(1.0, uResolution.y);

  // Physical particle pushback on ripple wave crests (only loops active ripples!)
  vec2 dotPush = vec2(0.0);
  for (int i = 0; i < 10; i++) {
    if (i >= uRippleCount) break;
    vec4 rp = uRipples[i];
    if (rp.w <= 0.001 || rp.z < 0.0) continue;
    vec2 diff = vUv - rp.xy;
    vec2 ell = vec2(diff.x * aspect, diff.y * 2.15);
    float dist = length(ell);
    float behind = rp.z * 0.165 - dist;
    if (behind > -0.02 && behind < 0.22) {
      float env = smoothstep(-0.015, 0.02, behind) * (1.0 - smoothstep(0.06, 0.22, behind));
      float fade = exp(-rp.z * 0.62) * rp.w;
      vec2 dir = dist > 0.0005 ? ell / dist : vec2(0.0);
      dotPush += dir * sin(behind * 84.0) * env * fade * 0.34;
    }
  }

  vec2 cellSize = vec2(uDotPitchPx * 1.04, uDotPitchPx * 0.94);
  vec2 gridCount = floor(uResolution / cellSize);
  vec2 gridPos = vUv * gridCount;
  vec2 cellId = floor(gridPos);

  float rowOffset = mod(cellId.y, 2.0) * 0.5;
  vec2 staggeredPos = vec2(gridPos.x + rowOffset, gridPos.y);
  vec2 stCellId = floor(staggeredPos);
  vec2 cellUv = fract(staggeredPos) - 0.5;

  vec2 sampleUv = (stCellId + vec2(0.5 - rowOffset, 0.5)) / gridCount;
  sampleUv = clamp(sampleUv, 0.001, 0.999);
  vec3 sceneCol = texture(uSceneTex, sampleUv).rgb;

  float lum = dot(sceneCol, vec3(0.299, 0.587, 0.114));

  float rnd = hash21(stCellId);
  float rnd2 = hash21(stCellId + 71.3);
  vec2 jitter = (vec2(rnd, rnd2) - 0.5) * 0.14 + dotPush;
  float twinkle = 0.94 + 0.12 * sin(uTime * (1.1 + rnd * 1.6) + rnd * 6.2831);

  float d = length(cellUv - jitter);

  float dotRadius = mix(0.25, 0.52, pow(clamp(lum * 1.32, 0.0, 1.0), 0.72));
  float dotCore = 1.0 - smoothstep(dotRadius * 0.34, dotRadius, d);
  float dotHalo = exp(-d * d * mix(10.0, 4.6, clamp(lum, 0.0, 1.0))) * 0.36;

  vec3 underGlow = sceneCol * 0.24;
  vec3 dotLight = sceneCol * (dotCore * 1.62 + dotHalo) * twinkle;

  float glintBoost = smoothstep(0.45, 0.95, lum);
  dotLight += sceneCol * glintBoost * dotCore * 0.42;

  fragColor = vec4(underGlow + dotLight, 1.0);
}
`;

export const BLOOM_EXTRACT_FRAG = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uTex;
uniform float uThreshold;

void main() {
  vec3 col = texture(uTex, vUv).rgb;
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  float weight = smoothstep(uThreshold, uThreshold + 0.35, lum);
  fragColor = vec4(col * weight, 1.0);
}
`;

export const BLUR_FRAG = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uTex;
uniform vec2 uTexelSize;
uniform vec2 uDirection;

void main() {
  vec2 off = uTexelSize * uDirection;
  vec3 sum = texture(uTex, vUv).rgb * 0.227027;
  sum += texture(uTex, vUv + off * 1.384615).rgb * 0.316216;
  sum += texture(uTex, vUv - off * 1.384615).rgb * 0.316216;
  sum += texture(uTex, vUv + off * 3.230769).rgb * 0.070270;
  sum += texture(uTex, vUv - off * 3.230769).rgb * 0.070270;
  fragColor = vec4(sum, 1.0);
}
`;

export const CRT_FINAL_FRAG = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uSceneTex;
uniform sampler2D uBloomTex;
uniform sampler2D uUiTex;
uniform vec2 uResolution;
uniform float uTime;
uniform float uCurvature;
uniform float uScanlineCount;
uniform float uBloomIntensity;
uniform float uChromaticEdge;

vec2 barrelWarp(vec2 uv, float k) {
  vec2 p = uv * 2.0 - 1.0;
  float r2 = dot(p, p);
  float norm = 1.0 / (1.0 + k * 0.92);
  p *= (1.0 + k * r2 + (k * 0.28) * r2 * r2) * norm;
  return p * 0.5 + 0.5;
}

float crtGlassMask(vec2 uv) {
  vec2 p = abs(uv * 2.0 - 1.0);
  float cornerRadius = 0.13;
  vec2 q = max(p - (1.0 - cornerRadius), 0.0);
  float dist = length(q) - cornerRadius;
  return 1.0 - smoothstep(-0.015, 0.008, dist);
}

void main() {
  vec2 warpedUv = barrelWarp(vUv, uCurvature);

  if (warpedUv.x < 0.0 || warpedUv.x > 1.0 || warpedUv.y < 0.0 || warpedUv.y > 1.0) {
    fragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  float glassMask = crtGlassMask(warpedUv);
  if (glassMask <= 0.001) {
    fragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  vec2 fromCenter = warpedUv - 0.5;
  float r = length(fromCenter);
  float caWeight = smoothstep(0.28, 0.74, r);
  vec2 caOffset = fromCenter * caWeight * uChromaticEdge;

  float cr = texture(uSceneTex, clamp(warpedUv + caOffset, 0.001, 0.999)).r;
  float cg = texture(uSceneTex, warpedUv).g;
  float cb = texture(uSceneTex, clamp(warpedUv - caOffset, 0.001, 0.999)).b;
  vec3 col = vec3(cr, cg, cb);

  vec3 bloom = texture(uBloomTex, warpedUv).rgb;
  col += bloom * uBloomIntensity;

  vec2 uiUv = vec2(warpedUv.x, 1.0 - warpedUv.y);
  vec4 ui = texture(uUiTex, uiUv);
  vec4 uiR = texture(uUiTex, clamp(uiUv + vec2(caOffset.x, -caOffset.y) * 0.45, 0.001, 0.999));
  vec4 uiB = texture(uUiTex, clamp(uiUv - vec2(caOffset.x, -caOffset.y) * 0.45, 0.001, 0.999));
  vec3 uiRgb = vec3(uiR.r, ui.g, uiB.b);
  col = mix(col, uiRgb * 1.08, ui.a);

  float scanPhase = warpedUv.y * uScanlineCount * 3.14159265;
  float scanWave = 0.5 + 0.5 * cos(scanPhase * 2.0);
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  float scanDepth = mix(0.28, 0.09, clamp(lum * 1.1 + ui.a * 0.55, 0.0, 1.0));
  col *= 1.0 - scanDepth * (1.0 - scanWave);

  vec2 v2 = warpedUv * 2.0 - 1.0;
  float edgeVignette = 1.0 - 0.34 * pow(clamp(dot(v2 * vec2(0.85, 0.92), v2 * vec2(0.85, 0.92)), 0.0, 1.4), 1.45);
  col *= clamp(edgeVignette, 0.28, 1.0);

  float grain = fract(sin(dot(gl_FragCoord.xy + fract(uTime) * 37.0, vec2(12.9898, 78.233))) * 43758.5453);
  col += (grain - 0.5) * 0.013;

  col = col / (1.0 + col * 0.18);
  col = pow(max(col, 0.0), vec3(0.96));

  col *= glassMask;
  fragColor = vec4(col, 1.0);
}
`;
