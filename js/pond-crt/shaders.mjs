// Ultra-Fast 120 FPS Fused WebGL2 Shaders (ZERO Canvas2D per-frame stalls!)
// Pass 1a: WATER_BG_FRAG -> Pond water light field + caustics
// Pass 1b: KoiGLRenderer -> Pure GPU underwater Nishikigoi mesh
// Pass 1c: SURFACE_OVERLAY_FRAG -> Ripples + Floating Flora / Thin Winter Ice + Pond-Center Season Sweep (alpha-blended OVER koi!)
// Pass 1d: ParticlesGLRenderer -> Pure GPU falling petals, maple leaves, snow, and stardust vortex
// Pass 2:  BLOOM_EXTRACT + BLUR at 0.25x res
// Pass 3:  CRT_PHOSPHOR_FINAL_FRAG -> Fused Phosphor-Dot Quantization + Bloom + UI + CRT Barrel/Scanlines/CA (ONE full-res pass!)

export const FULLSCREEN_VERT = `#version 300 es
precision highp float;
out vec2 vUv;
void main() {
  vec2 pos = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vUv = pos;
  gl_Position = vec4(pos * 2.0 - 1.0, 0.0, 1.0);
}
`;

// Pass 1a: Pond Water Light Field (runs at 0.5x res -> 4x faster, visually identical after CRT dot quantization!)
export const WATER_BG_FRAG = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

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
uniform float uWinterMode;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm2(vec2 p) {
  float v = 0.55 * noise(p);
  mat2 rot = mat2(0.80, -0.60, 0.60, 0.80);
  v += 0.30 * noise(rot * p * 2.05 + vec2(17.1, 31.7));
  v += 0.15 * noise(rot * p * 4.10 + vec2(39.4, 11.2));
  return v;
}

void main() {
  vec2 uv = vUv;
  float aspect = uResolution.x / max(1.0, uResolution.y);
  float t = uTime * uShimmerSpeed;
  vec2 centered = (uv - 0.5) * vec2(aspect, 1.0);

  float radialDist = length(centered * vec2(0.80, 1.02));
  float basinLight = 1.0 - smoothstep(0.18, 0.94, radialDist);

  float depthNoise = fbm2(uv * vec2(3.1, 2.3) + vec2(t * 0.035, -t * 0.025));
  float depthNoise2 = noise(uv * vec2(6.2, 4.8) - vec2(t * 0.04, t * 0.025));
  float depthMix = clamp(basinLight * 0.85 + (depthNoise - 0.45) * 0.40, 0.0, 1.0);

  vec3 col = mix(uWaterDeep, uWaterMid, smoothstep(0.05, 0.72, depthMix));
  float accentPatch = smoothstep(0.32, 0.82, depthNoise2) * smoothstep(0.88, 0.15, radialDist);
  col = mix(col, uWaterAccent, accentPatch * 0.50);

  float colWarp = (depthNoise - 0.5) * 0.13 + sin(uv.y * 4.8 + t * 0.35) * 0.020;
  float dx = (uv.x - (uGlowColumnX + colWarp)) / max(0.08, uGlowColumnWidth);
  float lightColumn = exp(-dx * dx * 1.35);
  float vertProfile = 0.52 + 0.48 * sin(uv.y * 3.14159);
  float columnMask = lightColumn * vertProfile;

  // In Winter, reflections are softer vertical moonlight columns (matching final2-winter.png)
  vec2 streakScale = mix(vec2(4.2, 26.0), vec2(7.5, 11.0), uWinterMode);
  float drift1 = fbm2(uv * streakScale + vec2(t * 0.18, -t * 0.11));
  float band = smoothstep(0.35, 0.82, drift1);
  float fine = noise(vec2(uv.x * 16.0 + drift1 * 1.4, uv.y * mix(82.0, 32.0, uWinterMode) - t * 0.48));
  float streaks = band * 0.60 + pow(smoothstep(0.56, 0.94, fine * drift1 * 1.30), 2.4) * 0.88;

  col += uCausticTint * columnMask * (0.20 + 0.34 * streaks) * uCausticStrength;
  float shimmerWeight = (columnMask * 0.86 + basinLight * 0.22) * uCausticStrength;
  float highlight = pow(clamp(streaks, 0.0, 1.0), 1.45) * shimmerWeight;
  col += mix(uCausticTint, uSpecularTint, smoothstep(0.22, 0.78, highlight)) * highlight * mix(0.98, 0.22, uWinterMode);

  float edgeDark = 1.0 - smoothstep(0.58, 1.08, radialDist);
  col *= mix(0.28, 1.0, edgeDark);

  fragColor = vec4(max(col, 0.0), 1.0);
}
`;

// Pass 1c: Surface Ripples + Floating Flora / Thin Translucent Winter Ice + Pond-Center Season Sweep
// Alpha-blended OVER the submerged GPU Koi so ripples, lotus pads & thin ice sit naturally above the fish!
export const SURFACE_OVERLAY_FRAG = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uFloraSpring;
uniform sampler2D uFloraSummer;
uniform sampler2D uFloraAutumn;
uniform sampler2D uFloraWinter;
uniform vec4 uSeasonWeights;
uniform vec4 uFromWeights;
uniform vec4 uToWeights;
uniform vec4 uWaveParams; // xy = origin UV, z = progress [0..1], w = active (0 or 1)
uniform vec2 uResolution;
uniform float uTime;
uniform float uSeasonSweep;
uniform vec3 uCausticTint;
uniform vec3 uSpecularTint;
uniform vec4 uRipples[8];
uniform int uRippleCount;
uniform float uBootFloraAlpha;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

vec3 evalRipples(vec2 uv, float aspect) {
  vec2 totalDisp = vec2(0.0);
  float totalCrest = 0.0;

  for (int i = 0; i < 8; i++) {
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
      totalDisp += dir * (wave * env * fade * 0.0055);
    }
  }
  return vec3(totalDisp, clamp(totalCrest, 0.0, 1.25));
}

void main() {
  vec2 uv = vUv;
  float aspect = uResolution.x / max(1.0, uResolution.y);
  vec3 rip = evalRipples(uv, aspect);

  vec2 sway = vec2(
    sin(uTime * 0.65 + uv.y * 6.0) * 0.0015,
    cos(uTime * 0.52 + uv.x * 5.0) * 0.0011
  );
  vec2 floraUv = clamp(vec2(uv.x, 1.0 - uv.y) + sway + rip.xy * 0.50, 0.001, 0.999);
  vec4 w = uSeasonWeights;
  vec3 sweepGlow = vec3(0.0);
  float autumnCurl = 0.0;
  float winterFrostCreep = 0.0;

  // In-place 1.0s Wavefront Evolution: each pixel evolves in-place as the breeze front sweeps past!
  if (uWaveParams.w > 0.5) {
    float waveP = clamp(uWaveParams.z, 0.0, 1.0);
    vec2 origin = uWaveParams.xy;
    float n = noise(uv * 4.6 + vec2(uTime * 0.18, -uTime * 0.14));

    // Max aspect-corrected reach from origin to farthest pond corner
    float d00 = length((vec2(0.0, 0.0) - origin) * vec2(aspect, 1.0));
    float d10 = length((vec2(1.0, 0.0) - origin) * vec2(aspect, 1.0));
    float d01 = length((vec2(0.0, 1.0) - origin) * vec2(aspect, 1.0));
    float d11 = length((vec2(1.0, 1.0) - origin) * vec2(aspect, 1.0));
    float maxReach = max(max(d00, d10), max(d01, d11)) + 0.18;

    float pxDist = length((uv - origin) * vec2(aspect, 1.0)) + (n - 0.5) * 0.11;
    float frontDist = waveP * maxReach;
    float band = 0.16 * aspect;
    float localW = 1.0 - smoothstep(frontDist - band, frontDist + band, pxDist);

    // Winter edge-creep: ice/frost creeps inward from pond edges as the wavefront arrives
    if (uToWeights.w > 0.5) {
      float distFromEdge = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
      float edgeWave = 1.0 - smoothstep(waveP * 0.58 - 0.14, waveP * 0.58 + 0.10, distFromEdge + (n - 0.5) * 0.06);
      float frostMask = clamp(max(localW * 0.72, edgeWave), 0.0, 1.0);
      localW = mix(localW, frostMask, 0.55);
      winterFrostCreep = edgeWave * (1.0 - smoothstep(0.0, 0.28, distFromEdge)) * sin(waveP * 3.14159);
    }

    // Autumn in-place lotus yellowing & subtle edge curl right as the wavefront passes
    if (uToWeights.z > 0.5) {
      autumnCurl = sin(clamp(localW, 0.0, 1.0) * 3.14159);
    }

    w = mix(uFromWeights, uToWeights, localW);

    // Subtle restrained breeze shimmer line along the advancing wavefront (never garish)
    float env = sin(waveP * 3.14159);
    float crest = exp(-pow((pxDist - frontDist) / max(0.035, band * 0.32), 2.0));
    sweepGlow = uCausticTint * (crest * 0.16 * env + winterFrostCreep * 0.18);
  }

  // True premultiplied-alpha accumulation (paired with gl.blendFunc(ONE, ONE_MINUS_SRC_ALPHA))
  // Guarantees ZERO dark ghosting or double-alpha darkening at ANY blend weight!
  vec3 floraPremul = vec3(0.0);
  float floraAlpha = 0.0;
  if (w.x > 0.002) {
    vec4 tS = texture(uFloraSpring, floraUv);
    floraPremul += tS.rgb * (tS.a * w.x);
    floraAlpha += tS.a * w.x;
  }
  if (w.y > 0.002) {
    vec2 padUv = autumnCurl > 0.01
      ? clamp(floraUv + (floraUv - 0.5) * (autumnCurl * 0.0055), 0.001, 0.999)
      : floraUv;
    vec4 tU = texture(uFloraSummer, padUv);
    vec3 summerRgb = autumnCurl > 0.01
      ? mix(tU.rgb, tU.rgb * vec3(1.18, 0.92, 0.48), autumnCurl * 0.72)
      : tU.rgb;
    floraPremul += summerRgb * (tU.a * w.y);
    floraAlpha += tU.a * w.y;
  }
  if (w.z > 0.002) {
    vec4 tA = texture(uFloraAutumn, floraUv);
    floraPremul += tA.rgb * (tA.a * w.z);
    floraAlpha += tA.a * w.z;
  }
  if (w.w > 0.002) {
    vec4 tW = texture(uFloraWinter, floraUv);
    floraPremul += tW.rgb * (tW.a * w.w);
    floraAlpha += tW.a * w.w;
  }
  floraAlpha = clamp(floraAlpha * uBootFloraAlpha, 0.0, 1.0);
  floraPremul *= uBootFloraAlpha;

  // Ripples & seasonal shimmer glow are purely additive light (alpha = 0 contribution to darkening!)
  vec3 additiveLight = mix(uCausticTint, uSpecularTint, 0.52) * rip.z * 0.65 + sweepGlow;
  vec3 outPremul = floraPremul * (0.96 + 0.10 * rip.z) + additiveLight * (1.0 - floraAlpha * 0.65);
  fragColor = vec4(outPremul, floraAlpha);
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

// Pass 3: FUSED Phosphor-Dot Quantization + Bloom + Crisp UI + CRT Barrel/Scanlines/CA
// Runs in ONE single fullscreen pass at 1x CSS res -> rock-solid 120+ FPS!
export const CRT_PHOSPHOR_FINAL_FRAG = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uSceneTex;
uniform sampler2D uBloomTex;
uniform sampler2D uUiTex;
uniform vec2 uResolution;
uniform float uTime;
uniform float uCurvature;
uniform float uDotPitchPx;
uniform float uScanlineCount;
uniform float uBloomIntensity;
uniform float uChromaticEdge;
uniform float uBootReveal;
uniform vec3 uBootBeamTint;

float hash21(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

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

  // Edge-only chromatic aberration (0 in center for razor-sharp text & icons)
  vec2 fromCenter = warpedUv - 0.5;
  float r = length(fromCenter);
  float caWeight = smoothstep(0.28, 0.74, r);
  vec2 caOffset = fromCenter * caWeight * uChromaticEdge;

  // --- Fused CRT Phosphor-Dot Matrix Quantization ---
  vec2 cellSize = vec2(uDotPitchPx * 1.04, uDotPitchPx * 0.94);
  vec2 gridCount = floor(uResolution / cellSize);
  vec2 gridPos = warpedUv * gridCount;
  float rowOffset = mod(floor(gridPos.y), 2.0) * 0.5;
  vec2 staggeredPos = vec2(gridPos.x + rowOffset, gridPos.y);
  vec2 stCellId = floor(staggeredPos);
  vec2 cellUv = fract(staggeredPos) - 0.5;

  vec2 sampleUv = clamp((stCellId + vec2(0.5 - rowOffset, 0.5)) / gridCount, 0.001, 0.999);
  float sr = texture(uSceneTex, clamp(sampleUv + caOffset, 0.001, 0.999)).r;
  float sg = texture(uSceneTex, sampleUv).g;
  float sb = texture(uSceneTex, clamp(sampleUv - caOffset, 0.001, 0.999)).b;
  vec3 sceneCol = vec3(sr, sg, sb);

  float lum = dot(sceneCol, vec3(0.299, 0.587, 0.114));
  float rnd = hash21(stCellId);
  vec2 jitter = (vec2(rnd, fract(rnd * 31.7)) - 0.5) * 0.12;
  float d = length(cellUv - jitter);

  float dotRadius = mix(0.26, 0.52, pow(clamp(lum * 1.32, 0.0, 1.0), 0.72));
  float dotCore = 1.0 - smoothstep(dotRadius * 0.34, dotRadius, d);
  float dotHalo = exp(-d * d * mix(9.5, 4.6, clamp(lum, 0.0, 1.0))) * 0.35;
  float twinkle = 0.95 + 0.10 * sin(uTime * (1.1 + rnd * 1.5) + rnd * 6.2831);

  vec3 col = sceneCol * 0.25 + sceneCol * (dotCore * 1.60 + dotHalo) * twinkle;
  col += sceneCol * smoothstep(0.45, 0.95, lum) * dotCore * 0.38;

  // Add soft quarter-res phosphor bloom
  vec3 bloom = texture(uBloomTex, warpedUv).rgb;
  col += bloom * uBloomIntensity;

  // Composite crisp UI layer
  vec2 uiUv = vec2(warpedUv.x, 1.0 - warpedUv.y);
  vec4 ui = texture(uUiTex, uiUv);
  col = mix(col, ui.rgb * 1.08, ui.a);

  // Anti-moiré horizontal CRT scanlines
  float scanPhase = warpedUv.y * uScanlineCount * 3.14159265;
  float scanWave = 0.5 + 0.5 * cos(scanPhase * 2.0);
  float finalLum = dot(col, vec3(0.299, 0.587, 0.114));
  float scanDepth = mix(0.28, 0.09, clamp(finalLum * 1.1 + ui.a * 0.55, 0.0, 1.0));
  col *= 1.0 - scanDepth * (1.0 - scanWave);

  // Subtle CRT tube edge vignette
  vec2 v2 = warpedUv * 2.0 - 1.0;
  float edgeVignette = 1.0 - 0.34 * pow(clamp(dot(v2 * vec2(0.85, 0.92), v2 * vec2(0.85, 0.92)), 0.0, 1.4), 1.45);
  col *= clamp(edgeVignette, 0.28, 1.0);

  // Filmic highlight roll-off
  col = col / (1.0 + col * 0.18);
  col = pow(max(col, 0.0), vec3(0.96));

  // Pure-code CRT Power-On Beam & Full-Screen Tube Unfold (no TV bezel, deep teal phosphor)
  if (uBootReveal < 0.999) {
    float p = clamp(uBootReveal, 0.0, 1.0);
    float beamSweep = smoothstep(0.0, 0.20, p);
    float tubeUnfold = smoothstep(0.14, 0.52, p);
    float waterGlow = smoothstep(0.18, 0.64, p);

    float halfW = mix(0.02, 0.56, beamSweep);
    float halfH = mix(0.0038, 0.56, pow(tubeUnfold, 1.35));

    float dx = abs(warpedUv.x - 0.5);
    float dy = abs(warpedUv.y - 0.5);
    float insideX = 1.0 - smoothstep(halfW - 0.025, halfW + 0.025, dx);
    float insideY = 1.0 - smoothstep(halfH - 0.018, halfH + 0.018, dy);
    float tubeMask = insideX * insideY;

    // Crisp horizontal phosphor beam line that fades cleanly as tube opens
    float beamFade = (1.0 - smoothstep(0.18, 0.58, p)) * smoothstep(0.0, 0.04, p);
    float centerBeam = exp(-pow(dy / 0.0065, 2.0)) * insideX * beamFade;
    float edgeGlow = exp(-pow((dy - halfH) / 0.014, 2.0)) * insideX * (1.0 - smoothstep(0.45, 0.72, p)) * smoothstep(0.14, 0.26, p);

    // Pond water & dot-matrix materialize first, then full scene & UI seamlessly take over
    vec3 bootScene = col * mix(0.0, 1.0, waterGlow) * tubeMask;
    vec3 phosphor = uBootBeamTint * (centerBeam * 1.45 + edgeGlow * 0.55);
    col = mix(bootScene + phosphor, col, smoothstep(0.84, 1.0, p));
  }

  col *= glassMask;
  fragColor = vec4(col, 1.0);
}
`;
