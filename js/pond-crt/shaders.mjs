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
uniform float uWaterPhase;
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
  // Continuous CPU-integrated phase (eliminates uTime * uShimmerSpeed phase-whiplash twitch on season switch)
  float t = uWaterPhase;
  vec2 centered = (uv - 0.5) * vec2(aspect, 1.0);

  float radialDist = length(centered * vec2(0.80, 1.02));
  float basinLight = 1.0 - smoothstep(0.18, 0.94, radialDist);

  float depthNoise = fbm2(uv * vec2(3.1, 2.3) + vec2(t * 0.030, -t * 0.022));
  float depthNoise2 = noise(uv * vec2(5.6, 4.4) - vec2(t * 0.032, t * 0.020));
  float depthMix = clamp(basinLight * 0.80 + (depthNoise - 0.45) * 0.36, 0.0, 1.0);

  vec3 col = mix(uWaterDeep, uWaterMid, smoothstep(0.06, 0.76, depthMix));
  float accentPatch = smoothstep(0.36, 0.84, depthNoise2) * smoothstep(0.88, 0.16, radialDist);
  col = mix(col, uWaterAccent, accentPatch * 0.38);

  float colWarp = (depthNoise - 0.5) * 0.12 + sin(uv.y * 4.2 + t * 0.28) * 0.018;
  float dx = (uv.x - (uGlowColumnX + colWarp)) / max(0.09, uGlowColumnWidth);
  float lightColumn = exp(-dx * dx * 1.30);
  float vertProfile = 0.50 + 0.50 * sin(uv.y * 3.14159);
  float columnMask = lightColumn * vertProfile;

  // Dual-layer low-frequency diagonal cross-caustics (freq 6.5..13.5, zero half-res Nyquist aliasing)
  float winterSoft = mix(1.0, 0.62, uWinterMode);
  vec2 caustUv1 = vec2(uv.x * 6.8 + uv.y * 2.2, uv.y * 10.6 - uv.x * 1.6) * winterSoft + vec2(t * 0.13, -t * 0.08);
  vec2 caustUv2 = vec2(uv.x * 9.8 - uv.y * 2.8, uv.y * 13.2 + uv.x * 2.1) * winterSoft + vec2(-t * 0.10, t * 0.07);
  float c1 = fbm2(caustUv1);
  float c2 = noise(caustUv2 + vec2(c1 * 1.10, -c1 * 0.80));
  float causticNet = smoothstep(0.40, 0.84, c1 * 0.56 + c2 * 0.54);
  float softVeil = smoothstep(0.30, 0.78, c1) * 0.46 + pow(causticNet, 1.85) * 0.54;

  // Restrained deep-pond neon-cyan silk caustics, highlight strictly capped at 0.36..0.40 (zero Bloom blowout)
  col += uCausticTint * columnMask * (0.12 + 0.22 * softVeil) * uCausticStrength;
  float shimmerWeight = (columnMask * 0.74 + basinLight * 0.18) * uCausticStrength;
  float highlight = clamp(pow(softVeil, 1.55) * shimmerWeight, 0.0, 0.38);
  col += mix(uCausticTint, uSpecularTint, smoothstep(0.14, 0.38, highlight)) * highlight * mix(0.40, 0.18, uWinterMode);

  float edgeDark = 1.0 - smoothstep(0.56, 1.08, radialDist);
  col *= mix(0.24, 1.0, edgeDark);

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

  // Invisible 1.0s Wind-Sweep Transition (r75): ZERO glowing light ring/band!
  // Scenery evolves strictly in-place behind an invisible slanted wind front sweeping across the pond.
  if (uWaveParams.w > 0.5) {
    float waveP = clamp(uWaveParams.z, 0.0, 1.0);
    vec2 windDir = normalize(uWaveParams.xy);
    float n = noise(uv * 4.2 + vec2(uTime * 0.15, -uTime * 0.10));

    // Normalized projection [~0..1.3] along the slanted wind axis
    float proj = dot(uv - 0.5, windDir) + 0.65 + (n - 0.5) * 0.08;
    float frontPos = -0.22 + waveP * 1.72;
    float band = 0.22; // ~20% viewport soft invisible blend band
    float localW = 1.0 - smoothstep(frontPos - band, frontPos + band, proj);

    // Winter edge-creep: thin frost still creeps softly inward from pond edges without any glowing line
    if (uToWeights.w > 0.5) {
      float distFromEdge = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
      float edgeWave = 1.0 - smoothstep(waveP * 0.58 - 0.14, waveP * 0.58 + 0.10, distFromEdge + (n - 0.5) * 0.06);
      float frostMask = clamp(max(localW * 0.76, edgeWave), 0.0, 1.0);
      localW = mix(localW, frostMask, 0.45);
    }

    // Autumn in-place lotus yellowing & subtle edge curl as the invisible wind passes
    if (uToWeights.z > 0.5) {
      autumnCurl = sin(clamp(localW, 0.0, 1.0) * 3.14159);
    }

    w = mix(uFromWeights, uToWeights, localW);
    sweepGlow = vec3(0.0); // Strictly ZERO glowing wavefront band
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
uniform float uWarm;

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

  // Edge-only chromatic aberration + Persepolis uWarm RGB convergence (2.5px -> 0, exponential decay, zero lines/bands)
  float warm = clamp(uWarm, 0.0, 1.0);
  float rgbConvPx = warm < 0.999
    ? 2.5 * exp(-4.2 * warm) * (1.0 - smoothstep(0.86, 1.0, warm))
    : 0.0;
  vec2 rgbConvUv = vec2(rgbConvPx / max(1.0, uResolution.x), rgbConvPx * 0.32 / max(1.0, uResolution.y));

  vec2 fromCenter = warpedUv - 0.5;
  float r = length(fromCenter);
  float caWeight = smoothstep(0.28, 0.74, r);
  vec2 caOffset = fromCenter * caWeight * uChromaticEdge + rgbConvUv;

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

  // Composite crisp UI layer (gently shares RGB convergence while warming, razor-sharp at uWarm = 1.0)
  vec2 uiUv = vec2(warpedUv.x, 1.0 - warpedUv.y);
  vec4 ui;
  if (rgbConvPx > 0.02) {
    vec4 uiR = texture(uUiTex, clamp(uiUv + rgbConvUv * 0.85, 0.001, 0.999));
    vec4 uiG = texture(uUiTex, uiUv);
    vec4 uiB = texture(uUiTex, clamp(uiUv - rgbConvUv * 0.85, 0.001, 0.999));
    ui = vec4(uiR.r, uiG.g, uiB.b, max(uiG.a, max(uiR.a, uiB.a) * 0.65));
  } else {
    ui = texture(uUiTex, uiUv);
  }
  col = mix(col, ui.rgb * 1.08, ui.a);

  // Anti-moiré static horizontal CRT scanlines (part of final CRT texture, zero movement)
  float scanPhase = warpedUv.y * uScanlineCount * 3.14159265;
  float scanWave = 0.5 + 0.5 * cos(scanPhase * 2.0);
  float finalLum = dot(col, vec3(0.299, 0.587, 0.114));
  float scanDepth = mix(0.28, 0.09, clamp(finalLum * 1.1 + ui.a * 0.55, 0.0, 1.0));
  col *= 1.0 - scanDepth * (1.0 - scanWave);

  // Subtle CRT tube edge vignette (slightly stronger while cold, settling smoothly to 0.34 at uWarm = 1.0)
  float vigStrength = mix(0.62, 0.34, smoothstep(0.0, 0.85, warm));
  vec2 v2 = warpedUv * 2.0 - 1.0;
  float edgeVignette = 1.0 - vigStrength * pow(clamp(dot(v2 * vec2(0.85, 0.92), v2 * vec2(0.85, 0.92)), 0.0, 1.4), 1.45);
  col *= clamp(edgeVignette, 0.18, 1.0);

  // Filmic highlight roll-off
  col = col / (1.0 + col * 0.18);
  col = pow(max(col, 0.0), vec3(0.96));

  // Persepolis-style single-scene dark-to-bright phosphor warm-up (r87)
  // Driven strictly by global uWarm (0 -> 1); exact identity at uWarm = 1.0 (zero exit animation, zero flash!)
  if (warm < 0.999) {
    // Contrast: 0.20 -> 1.0 (faster than brightness so forms emerge before full luminance)
    float cCurve = (1.0 - exp(-4.2 * warm)) / (1.0 - exp(-4.2));
    float warmContrast = mix(0.20, 1.0, cCurve);
    vec3 pivot = vec3(0.14, 0.20, 0.22);
    col = max(vec3(0.0), pivot + (col - pivot) * warmContrast);

    // Saturation: 0.30 -> 1.05 -> 1.0 (subtle late overshoot settling back to 1.0)
    float satBase = mix(0.30, 1.0, smoothstep(0.0, 0.78, warm));
    float satOvershoot = 0.05 * sin(smoothstep(0.55, 1.0, warm) * 3.14159265);
    float warmSat = satBase + satOvershoot;
    float wLum = dot(col, vec3(0.299, 0.587, 0.114));
    col = max(vec3(0.0), mix(vec3(wLum), col, warmSat));

    // Brightness: dark tube warm floor (0.10) -> 1.0 via exponential approach 1 - exp(-3t)
    float bCurve = (1.0 - exp(-3.0 * warm)) / (1.0 - exp(-3.0));
    float warmBrightness = mix(0.10, 1.0, bCurve);
    col *= warmBrightness;
  }

  col *= glassMask;
  fragColor = vec4(col, 1.0);
}
`;
