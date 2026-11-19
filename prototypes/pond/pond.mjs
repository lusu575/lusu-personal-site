import { KOI_ROUTES, Koi, seededRandom } from "./fish.mjs?v=20261119-gemini-fishlotus1";
import {
  CRT, WATER, fullscreenVertex, pointVertex, pointFragment, bedFragment, waterFragment, desktopFragment, crtFragment
} from "./shaders.mjs?v=20261119-gemini-fishlotus1";

const browser = globalThis;
const canvas = browser.document.querySelector("canvas");
const status = browser.document.querySelector("#status");
const params = new URLSearchParams(browser.location.search);

function createProgram(gl, vertexSource, fragmentSource, uniforms) {
  const program = gl.createProgram();
  for (const [type, source] of [[gl.VERTEX_SHADER, vertexSource], [gl.FRAGMENT_SHADER, fragmentSource]]) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader) || "Shader compilation failed");
    }
    gl.attachShader(program, shader);
    gl.deleteShader(shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) || "Program linking failed");
  }
  return {
    program,
    uniforms: Object.fromEntries(uniforms.map((name) => [name, gl.getUniformLocation(program, name)]))
  };
}

function texture2D(gl) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return texture;
}

function createTarget(gl) {
  const texture = texture2D(gl);
  const framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

  return {
    texture, framebuffer, width: 0, height: 0,
    resize(width, height) {
      if (width === this.width && height === this.height) return;
      this.width = width;
      this.height = height;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
        throw new Error("Incomplete WebGL2 framebuffer");
      }
    }
  };
}

function createClock(gl) {
  // 5×7 monospace glyphs stored as row bitmasks. The atlas lives only in GPU memory.
  const glyphs = {
    0: [14, 17, 19, 21, 25, 17, 14],
    1: [4, 12, 4, 4, 4, 4, 14],
    2: [14, 17, 1, 2, 4, 8, 31],
    5: [31, 16, 30, 1, 1, 17, 14],
    7: [31, 1, 2, 4, 8, 8, 8],
    ":": [0, 0, 4, 0, 4, 0, 0],
    "-": [0, 0, 0, 14, 0, 0, 0]
  };
  const text = "12:00  2025-07-15";
  const width = text.length * 6 - 1;
  const height = 7;
  const data = new Uint8Array(width * height);
  for (let column = 0; column < text.length; column += 1) {
    const rows = glyphs[text[column]];
    if (!rows) continue;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < 5; x += 1) {
        data[y * width + column * 6 + x] = rows[y] & (1 << (4 - x)) ? 255 : 0;
      }
    }
  }
  const texture = texture2D(gl);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, width, height, 0, gl.RED, gl.UNSIGNED_BYTE, data);
  return { texture, width, height };
}

// Top-left scene coordinates. A leaf keeps its own texture seed across layout changes.
const LEAVES = [
  { material: "main", placement: [
    [0.156, 0.526, 0.047, -0.21, 0.65, 0.44, 1207],
    [0.377, 0.636, 0.063, 0.19, 3.27, 0.48, 1901],
    [0.655, 0.338, 0.050, -0.15, 5.88, 0.45, 1217],
    [0.779, 0.492, 0.046, 0.11, 2.89, 0.42, 1831]
  ] },
  { material: "companion", placement: [
    [0.180, 0.560, 0.027, 0.24, 4.26, 0.40, 2081],
    [0.240, 0.642, 0.034, 0.05, 1.61, 0.44, 2083],
    [0.286, 0.338, 0.031, -0.10, 0.38, 0.38, 2087],
    [0.248, 0.336, 0.022, 0.14, 2.97, 0.45, 2089],
    [0.309, 0.565, 0.012, -0.15, 5.01, 0.38, 2099],
    [0.620, 0.303, 0.021, 0.05, 1.04, 0.42, 2111],
    [0.681, 0.290, 0.023, -0.18, 2.46, 0.40, 2113],
    [0.735, 0.355, 0.029, 0.21, 3.99, 0.43, 2129],
    [0.790, 0.438, 0.018, -0.09, 2.19, 0.40, 2131],
    [0.748, 0.467, 0.021, 0.25, 5.73, 0.44, 2137],
    [0.330, 0.272, 0.016, -0.24, 1.68, 0.38, 2141],
    [0.445, 0.695, 0.020, 0.18, 4.09, 0.46, 2143],
    [0.471, 0.665, 0.015, 0.12, 2.84, 0.41, 2153],
    [0.670, 0.806, 0.012, -0.14, 0.12, 0.42, 2161]
  ] },
  { material: "dark", placement: [
    [0.100, 0.070, 0.037, 0.24, 5.17, 0.40, 2203],
    [0.974, 0.195, 0.045, -0.17, 2.70, 0.43, 2207],
    [0.960, 0.240, 0.052, 0.16, 3.83, 0.48, 2213],
    [0.982, 0.597, 0.040, 0.26, 2.13, 0.42, 2221],
    [0.032, 0.783, 0.061, -0.20, 4.58, 0.43, 2237],
    [0.115, 0.908, 0.068, 0.26, 0.12, 0.43, 2239],
    [0.151, 0.929, 0.049, 0.08, 2.16, 0.46, 2243],
    [0.885, 0.918, 0.031, -0.24, 5.76, 0.38, 2251],
    [0.625, 0.914, 0.028, 0.14, 0.89, 0.42, 2267]
  ] }
];

const LEAF_MATERIALS = {
  main: {
    step: 4.15, size: [1.85, 3.05], alpha: [0.50, 0.82], veins: 11,
    deep: [0.22, 0.44, 0.16], surface: [0.44, 0.78, 0.24],
    rib: [0.68, 0.88, 0.32], sheen: [0.88, 0.96, 0.42]
  },
  companion: {
    step: 4.65, size: [1.55, 2.55], alpha: [0.36, 0.68], veins: 7,
    deep: [0.16, 0.36, 0.15], surface: [0.32, 0.67, 0.23],
    rib: [0.50, 0.75, 0.28], sheen: [0.68, 0.84, 0.34]
  },
  dark: {
    step: 6.00, size: [1.50, 2.50], alpha: [0.22, 0.44], veins: 5,
    deep: [0.04, 0.10, 0.08], surface: [0.07, 0.17, 0.12],
    rib: [0.12, 0.23, 0.14], sheen: [0.16, 0.27, 0.17]
  }
};

const FLOWERS = [
  { x: 0.285, y: 0.580, width: 0.056, lean: -0.12, opening: 1.0, petals: 18, seed: 2273 },
  { x: 0.712, y: 0.335, width: 0.048, lean: 0.15, opening: 0.92, petals: 16, seed: 2281 },
  { x: 0.251, y: 0.393, width: 0.017, lean: 0.17, opening: 0, petals: 0, seed: 2287 },
  { x: 0.742, y: 0.528, width: 0.016, lean: -0.11, opening: 0, petals: 0, seed: 2293 }
];

function lotusPoints(width, height) {
  const afloat = [];
  const submerged = [];
  const scale = Math.min(width, 1.65 * height);
  const size = Math.sqrt(scale / 1536);
  const turn = 2 * Math.PI;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const mix = (a, b, t) => a + (b - a) * t;

  // 1. Curved umbrella-shaped lotus leaves with organic notch, undulating rim, carved veins, and waxy sheen.
  for (const { material, placement } of LEAVES) {
    const { step: spacing, size: [small, large], alpha: [faint, solid], veins, deep, surface, rib, sheen } =
      LEAF_MATERIALS[material];
    const dark = material === "dark";
    const reliefGain = material === "main" ? 1.0 : material === "companion" ? 0.75 : 0.45;

    for (const [x, y, radius, roll, notch, flatten, seed] of placement) {
      const random = seededRandom(seed);
      const span = radius * scale;
      const cos = Math.cos(roll);
      const sin = Math.sin(roll);
      const step = spacing / (radius * 1536);
      const baseX = x * width;
      const baseY = (1 - y) * height;

      // Scene light direction in leaf-local coordinates (upper/lower pond beams).
      const lightX = y < 0.5 ? 0.412 : 0.640;
      const lightY = y < 0.5 ? 0.302 : 0.655;
      const lightAngle = Math.atan2((y - lightY) * height, (lightX - x) * width) - roll;
      const lx = Math.cos(lightAngle) * 0.64;
      const ly = Math.sin(lightAngle) * 0.64;
      const lz = 0.768;
      // Half-vector with top-down view (0, 0, 1) for waxy leaf sheen.
      const hLen = Math.hypot(lx, ly, lz + 1.0);
      const hx = lx / hLen;
      const hy = ly / hLen;
      const hz = (lz + 1.0) / hLen;

      // Per-leaf organic variation so no two leaves look copy-pasted.
      const notchDepth = 0.42 + 0.24 * random();
      const notchWidth = 22 + 18 * random();
      const waveFreqA = 4 + Math.floor(random() * 3);
      const waveFreqB = 7 + Math.floor(random() * 4);
      const phaseA = turn * random();
      const phaseB = turn * random();
      const veinTwist = (random() - 0.5) * 0.24;
      const veinCount = veins + Math.floor(random() * 3) - 1;
      const veinOffset = turn * random();
      const hubU = (random() - 0.5) * 0.08;
      const hubV = (random() - 0.5) * 0.08;

      const rimAt = (angle) => {
        const dNotch = Math.cos(angle - notch);
        const cut = Math.max(0, dNotch) ** notchWidth;
        const undulate = 0.024 * Math.cos(waveFreqA * angle + phaseA) +
                         0.018 * Math.sin(waveFreqB * angle + phaseB) +
                         0.012 * Math.cos(3 * angle - notch);
        return 0.96 + undulate - notchDepth * cut;
      };

      // 3D leaf surface height z(u, v): sunken central petiole dimple, gentle umbrella dome, ruffled curled rim, and puffed mesophyll between radial veins.
      const heightAt = (u, v) => {
        const du = u - hubU;
        const dv = v - hubV;
        const r = Math.hypot(du, dv);
        const ang = Math.atan2(dv, du);
        const dome = 0.16 * Math.sin(Math.min(1.0, r) * Math.PI * 0.82);
        const dimple = -0.14 * Math.exp(-r * r * 26.0);
        const curl = 0.055 * (r ** 3.2) * (0.55 + 0.45 * Math.cos(waveFreqA * ang + phaseA));
        const vPhase = veinCount * (ang + veinTwist * r) + veinOffset;
        const pillow = 0.022 * Math.sin(Math.min(1.0, r) * Math.PI) * (0.5 - 0.5 * Math.cos(vPhase));
        return (dome + dimple + curl + pillow) * reliefGain;
      };

      const leafPoint = (u, v, z, diameter, color, opacity) => {
        // Project 3D leaf height slightly upward in screen Y so the umbrella dome and curled rim read with real depth.
        const sx = baseX + span * (u * cos - v * flatten * sin);
        const sy = baseY + span * (u * sin + v * flatten * cos + z * 0.28);
        afloat.push(sx, sy, diameter * size, color[0], color[1], color[2], opacity);
      };

      const eps = 0.032;
      for (let row = -1; row <= 1; row += step / flatten) {
        for (let column = -1; column <= 1; column += step) {
          const u = column + (random() - 0.5) * step * 0.92;
          const v = row + (random() - 0.5) * step / flatten;
          const angle = Math.atan2(v, u);
          const radial = Math.hypot(u, v);
          const rim = rimAt(angle);
          if (radial > rim + 0.025 || (radial > rim - 0.035 && random() > 0.58)) continue;

          // Surface normal from finite differences of z(u, v).
          const z0 = heightAt(u, v);
          const dzdu = (heightAt(u + eps, v) - z0) / eps;
          const dzdv = (heightAt(u, v + eps) - z0) / eps;
          const nLen = Math.hypot(-dzdu, -dzdv, 1.0);
          const nx = -dzdu / nLen;
          const ny = -dzdv / nLen;
          const nz = 1.0 / nLen;

          // Directional illumination across the curved umbrella + waxy specular sheen.
          const ndotl = clamp(nx * lx + ny * ly + nz * lz, 0.0, 1.0);
          const ndoth = clamp(nx * hx + ny * hy + nz * hz, 0.0, 1.0);
          const spec = (ndoth ** 12.0) * (dark ? 0.14 : 0.42);
          const dimpleOcc = 1.0 - 0.34 * Math.exp(-radial * radial * 24.0);
          const sectorSlope = 0.5 + 0.5 * Math.cos(angle - lightAngle);
          const tone = clamp((0.28 + 0.72 * ndotl) * (0.76 + 0.36 * sectorSlope) * dimpleOcc, 0.0, 1.15);

          // Vein ridge accent where the radial vein meets the curved surface.
          const du = u - hubU;
          const dv = v - hubV;
          const rHub = Math.hypot(du, dv);
          const aHub = Math.atan2(dv, du);
          const vCos = Math.cos(veinCount * (aHub + veinTwist * rHub) + veinOffset);
          const veinMask = radial > 0.08 && radial < rim - 0.05 ? Math.max(0, vCos) ** 14.0 : 0.0;

          const micro = 0.91 + 0.16 * random();
          const baseR = mix(deep[0], surface[0], clamp(tone, 0, 1));
          const baseG = mix(deep[1], surface[1], clamp(tone, 0, 1));
          const baseB = mix(deep[2], surface[2], clamp(tone, 0, 1));
          const rCol = mix(baseR, rib[0], veinMask * 0.62) * micro + sheen[0] * spec;
          const gCol = mix(baseG, rib[1], veinMask * 0.62) * micro + sheen[1] * spec;
          const bCol = mix(baseB, rib[2], veinMask * 0.62) * micro + sheen[2] * spec;

          const opacity = clamp(mix(faint, solid, 0.35 + 0.65 * tone) + 0.12 * veinMask - 0.08 * random(), 0.14, 0.92);
          leafPoint(u, v, z0, small + (large - small) * Math.sqrt(random()), [rCol, gCol, bCol], opacity);
        }
      }

      // Curled wavy rim lip highlights + submerged leaf shadow underneath.
      for (let angle = 0; angle < turn; angle += step * (dark ? 2.4 : 1.15)) {
        const radial = rimAt(angle) + (random() - 0.5) * 0.04;
        const u = radial * Math.cos(angle);
        const v = radial * Math.sin(angle);
        const z0 = heightAt(u, v);
        const lit = Math.cos(angle - lightAngle);
        const bright = lit > 0.28;
        if (bright || random() < (dark ? 0.18 : 0.42)) {
          const lipGain = bright ? 0.85 + 0.32 * lit : 0.62 + 0.18 * random();
          const col = bright ? sheen : deep;
          const index = afloat.length;
          leafPoint(u, v, z0, small + (large - small) * (0.4 + 0.6 * random()),
            [col[0] * lipGain, col[1] * lipGain, col[2] * lipGain],
            bright ? (dark ? 0.36 : 0.72) + 0.16 * random() : faint + 0.12 * random());
          submerged.push(afloat[index] + 3.5, afloat[index + 1] - 5.5, (2.7 + 1.4 * random()) * size,
            0.020, 0.052, 0.044, 0.11 + 0.08 * random());
        }
      }
    }
  }

  // 2. Layered 3D lotus flowers (with depth-occluded petals, central seedpod & stamens) and spindle buds.
  for (const { x, y, width: fraction, lean, opening, petals, seed } of FLOWERS) {
    const random = seededRandom(seed);
    const span = fraction * scale;
    const originX = x * width;
    const originY = (1 - y) * height;
    const baseY = originY - span * (petals ? 0.14 : 0.34);
    const stemX = (t) => originX + span * (-lean * t - 0.10 * Math.sin(2.8 * t));

    // Aerial stem / calyx rising cleanly above water; submerged stem fragments below.
    const stemCount = petals ? 18 : 22;
    for (let i = 0; i < stemCount; i += 1) {
      const t = (i + random()) / stemCount;
      const offset = (random() - 0.5) * span * (petals ? 0.16 : 0.22) * (1 - 0.65 * t);
      afloat.push(stemX(t) + offset, baseY - span * (petals ? 0.17 : 0.34) * t, (1.35 + 0.9 * random()) * size,
        0.34, 0.56, 0.24, 0.64 - 0.22 * t);
    }
    for (let segment = 0; segment < 3; segment += 1) {
      for (let i = 0; i < 7; i += 1) {
        const t = (segment + 0.64 * (i + random()) / 7) / 3;
        submerged.push(stemX(t) + 3 + (random() - 0.5) * 2, baseY - 5 - span * 0.88 * t,
          (1.5 + 1.0 * random()) * size, 0.26, 0.40, 0.20, 0.34 - 0.24 * t);
      }
    }

    if (petals) {
      // Build 3 concentric staggered tiers of curved 3D spoon petals, plus central seedpod & stamens.
      // Camera projection: oblique top-down matching leaf foreshortening; front petals occlude back roots via a local z-buffer.
      const candidates = [];
      const lightDir = [-0.34, -0.42, 0.84];
      const tiers = [
        { count: Math.max(6, Math.round(petals * 0.40)), tilt: 1.18 * opening, len: 0.56, wid: 0.19, cup: 0.08, az0: 0.15, lift: 0.00 },
        { count: Math.max(5, Math.round(petals * 0.34)), tilt: 0.82 * opening, len: 0.52, wid: 0.17, cup: 0.10, az0: 0.62, lift: 0.04 },
        { count: Math.max(5, petals - Math.round(petals * 0.74)), tilt: 0.46 * opening, len: 0.44, wid: 0.135, cup: 0.11, az0: 1.08, lift: 0.08 }
      ];

      const pushCandidate = (lx, ly, lz, diam, r, g, b, alpha) => {
        const px = lx + lean * lz * 0.55;
        const sx = originX + span * px;
        const sy = baseY + span * (ly * 0.46 + lz * 0.88 + 0.10);
        const depth = -ly * 0.88 + lz * 0.46;
        candidates.push({ sx, sy, depth, diam: diam * size, r, g, b, alpha });
      };

      for (let tierIdx = 0; tierIdx < tiers.length; tierIdx += 1) {
        const tier = tiers[tierIdx];
        for (let p = 0; p < tier.count; p += 1) {
          const az = tier.az0 + (p + (random() - 0.5) * 0.18) * turn / tier.count;
          const ca = Math.cos(az);
          const sa = Math.sin(az);
          const tilt = tier.tilt + (random() - 0.5) * 0.10;
          const sinT = Math.sin(tilt);
          const cosT = Math.cos(tilt);
          const pLen = tier.len * (0.93 + 0.14 * random());
          const pWid = tier.wid * (0.92 + 0.16 * random());

          const uSteps = 9;
          const vSteps = 6;
          for (let ui = 0; ui < uSteps; ui += 1) {
            for (let vi = 0; vi < vSteps; vi += 1) {
              const t = (ui + 0.15 + 0.75 * random()) / uSteps;
              const s = ((vi + 0.15 + 0.70 * random()) / vSteps) * 2 - 1;
              const halfW = pWid * (Math.sin(Math.PI * (t ** 0.76)) ** 0.72);
              const lateral = s * halfW;

              // Curved longitudinal spine + transverse spoon cupping.
              const along = pLen * t;
              const bow = -0.10 * pLen * (t ** 2.1); // petals curve gently inward toward the flower heart
              const cup = tier.cup * (1.0 - s * s) * Math.sin(Math.PI * t);

              const rOut = 0.06 + along * sinT + (bow + cup) * cosT;
              const zUp = tier.lift + along * cosT - (bow + cup) * sinT;
              const lx = rOut * ca - lateral * sa;
              const ly = rOut * sa + lateral * ca;

              // Approximate outward/upward petal normal for soft sunlit volume.
              const nx = ca * cosT * 0.75 - sa * s * 0.35;
              const ny = sa * cosT * 0.75 + ca * s * 0.35;
              const nz = Math.max(0.25, sinT * 0.72 + 0.35 * t);
              const nLen = Math.hypot(nx, ny, nz);
              const ndotl = clamp((nx * lightDir[0] + ny * lightDir[1] + nz * lightDir[2]) / nLen, 0.0, 1.0);

              // Root shadow in lower/inner cup -> rich lotus pink belly -> glowing pale-pink/white tips.
              const rootOcc = mix(0.54 + 0.12 * tierIdx, 1.0, Math.min(1.0, t * 1.45));
              const light = (0.64 + 0.44 * ndotl) * rootOcc;
              const tipGlow = t ** 1.35;
              const rCol = clamp(mix(0.88, 1.00, tipGlow) * light, 0, 1.05);
              const gCol = clamp(mix(0.36, 0.84, tipGlow) * light, 0, 1.02);
              const bCol = clamp(mix(0.46, 0.86, tipGlow) * light, 0, 1.02);
              const alpha = clamp(0.68 + 0.24 * random() - 0.10 * Math.abs(s), 0.45, 0.92);

              pushCandidate(lx, ly, zUp, 1.85 + 1.05 * random(), rCol, gCol, bCol, alpha);
            }
          }
        }
      }

      // Central lotus seedpod (莲蓬) nestled inside the inner petals.
      for (let i = 0; i < 20; i += 1) {
        const ang = turn * random();
        const rad = Math.sqrt(random()) * 0.095;
        const seedPit = i < 6;
        pushCandidate(
          rad * Math.cos(ang), rad * Math.sin(ang), 0.16 + 0.03 * (1 - rad / 0.095),
          seedPit ? 1.55 : 1.75 + 0.65 * random(),
          seedPit ? 0.36 : 0.74, seedPit ? 0.42 : 0.80, seedPit ? 0.18 : 0.26,
          0.78 + 0.18 * random()
        );
      }
      // Golden stamen ring (雄蕊点) encircling the seedpod.
      for (let i = 0; i < 34; i += 1) {
        const ang = (i + random() * 0.7) * turn / 34;
        const rad = 0.095 + 0.065 * random();
        const zUp = 0.15 + 0.09 * random();
        pushCandidate(
          rad * Math.cos(ang), rad * Math.sin(ang), zUp,
          1.40 + 0.85 * random(),
          0.98, 0.79, 0.26, 0.76 + 0.20 * random()
        );
      }

      // Local 2px z-buffer occlusion so front petals cleanly hide back petal roots and frame the receptacle.
      const cellPx = Math.max(1.8, 2.1 * size);
      const zMap = new Map();
      const keyOf = (sx, sy) => `${Math.round(sx / cellPx)},${Math.round(sy / cellPx)}`;
      for (const pt of candidates) {
        const key = keyOf(pt.sx, pt.sy);
        const prev = zMap.get(key);
        if (prev === undefined || pt.depth > prev) zMap.set(key, pt.depth);
      }
      candidates.sort((a, b) => a.depth - b.depth);
      for (const pt of candidates) {
        const front = zMap.get(keyOf(pt.sx, pt.sy));
        if (pt.depth < front - 0.14) continue;
        afloat.push(pt.sx, pt.sy, pt.diam, pt.r, pt.g, pt.b, pt.alpha);
      }
    } else {
      // Unopened lotus bud: spindle silhouette, jade-green calyx base, blush belly, vivid pink tip.
      const rows = 18;
      for (let row = 0; row < rows; row += 1) {
        for (let col = -7; col <= 7; col += 1) {
          const t = (row + random()) / rows;
          const across = (col + random() - 0.5) / 7;
          const breadth = (Math.sin(Math.PI * (t ** 0.82)) ** 0.78) * (1.16 - 0.44 * t);
          if (Math.abs(across) > breadth) continue;
          const normX = across / Math.max(breadth, 0.01);
          const z = Math.sqrt(Math.max(0.0, 1.0 - normX * normX));
          const seam = Math.cos((normX + 0.35 * t) * 11.0);
          const light = (0.64 + 0.34 * z - 0.16 * normX) * (0.92 + 0.12 * Math.max(0, seam));
          const pink = clamp((t - 0.18) / 0.62, 0.0, 1.0);
          const tip = clamp((t - 0.58) / 0.42, 0.0, 1.0);
          const rCol = mix(0.42, mix(0.95, 1.00, tip), pink) * light;
          const gCol = mix(0.64, mix(0.68, 0.46, tip), pink) * light;
          const bCol = mix(0.24, mix(0.72, 0.60, tip), pink) * light;
          afloat.push(
            originX + span * (across * 0.54 + lean * t * 0.48),
            originY + span * (1.16 * t - 0.48),
            (1.45 + 1.15 * random()) * size,
            rCol, gCol, bCol,
            clamp((0.58 + 0.34 * random()) * (0.62 + 0.38 * z), 0.35, 0.94)
          );
        }
      }
    }
  }
  return { afloat: new Float32Array(afloat), submerged: new Float32Array(submerged) };
}

function createPointBuffer(gl) {
  const buffer = gl.createBuffer();
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.enableVertexAttribArray(0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 7 * 4, 0);
  gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 7 * 4, 3 * 4);
  gl.bindVertexArray(null);
  return { buffer, vao };
}

function createRenderer(gl) {
  const points = createProgram(gl, pointVertex, pointFragment, ["uSize", "uDpr"]);
  const bed = createProgram(gl, fullscreenVertex, bedFragment, ["uSize"]);
  const water = createProgram(gl, fullscreenVertex, waterFragment, [
    "uSize", "uFish", "uFishBounds[0]", "uLotus", "uBed", "uTime", "uClickCount", "uWakeCount", "uClicks[0]", "uWakes[0]", "uClickShape[0]", "uWakeShape[0]"
  ]);
  const desktop = createProgram(gl, fullscreenVertex, desktopFragment, ["uSize", "uWater", "uClock", "uClockSize", "uGrid"]);
  const crt = createProgram(gl, fullscreenVertex, crtFragment, ["uSize", "uDesktop", "uCRT"]);
  const fishTarget = createTarget(gl);
  const lotusTarget = createTarget(gl);
  const bedTarget = createTarget(gl);
  const waterTarget = createTarget(gl);
  const sceneTarget = createTarget(gl);
  const clock = createClock(gl);

  const fishPoints = createPointBuffer(gl);
  const lotusBuffer = createPointBuffer(gl);
  const fishVertices = new Float32Array(fish.reduce((total, koi) => total + koi.vertices.length, 0));
  gl.bindBuffer(gl.ARRAY_BUFFER, fishPoints.buffer);
  gl.bufferData(gl.ARRAY_BUFFER, fishVertices.byteLength, gl.DYNAMIC_DRAW);
  const clickData = new Float32Array(WATER.clickCapacity * 4);
  const clickShape = new Float32Array(clickData.length);
  const wakeData = new Float32Array(fish.length * WATER.wakeCapacity * 4);
  const wakeShape = new Float32Array(wakeData.length);
  const fishBounds = new Float32Array(fish.length * 4);

  const maxTexture = gl.getParameter(gl.MAX_TEXTURE_SIZE);
  const [maxWidth, maxHeight] = gl.getParameter(gl.MAX_VIEWPORT_DIMS);
  const limit = Math.min(maxTexture, maxWidth, maxHeight);
  let width;
  let height;
  let density;

  function begin(pass, target) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, target?.framebuffer ?? null);
    gl.viewport(0, 0, target?.width ?? canvas.width, target?.height ?? canvas.height);
    gl.useProgram(pass.program);
    gl.uniform2f(pass.uniforms.uSize, width, height);
    return pass.uniforms;
  }

  function sample(unit, location, texture) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(location, unit);
  }

  function drawPoints(target, vao, count, clear = true) {
    const uniforms = begin(points, target);
    if (clear) {
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindVertexArray(vao);
    gl.uniform1f(uniforms.uDpr, density);
    gl.drawArrays(gl.POINTS, 0, count);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
  }

  function fit() {
    const nextWidth = Math.max(1, canvas.clientWidth);
    const nextHeight = Math.max(1, canvas.clientHeight);
    const nextDensity = Math.min(browser.devicePixelRatio || 1, 2, limit / Math.max(nextWidth, nextHeight));
    if (nextWidth === width && nextHeight === height && nextDensity === density) return;
    if (nextWidth !== width || nextHeight !== height) {
      for (const koi of fish) koi.resize(nextWidth, nextHeight);
    }
    width = nextWidth;
    height = nextHeight;
    density = nextDensity;
    canvas.width = Math.max(1, Math.round(width * density));
    canvas.height = Math.max(1, Math.round(height * density));
    fishTarget.resize(canvas.width, canvas.height);
    lotusTarget.resize(canvas.width, canvas.height);
    bedTarget.resize(canvas.width, canvas.height);
    waterTarget.resize(
      Math.max(1, Math.round(canvas.width * WATER.scale)),
      Math.max(1, Math.round(canvas.height * WATER.scale))
    );
    sceneTarget.resize(canvas.width, canvas.height);

    begin(bed, bedTarget);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    const { afloat, submerged } = lotusPoints(width, height);
    gl.bindBuffer(gl.ARRAY_BUFFER, lotusBuffer.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, submerged, gl.STATIC_DRAW);
    // The bed alpha channel carries the broad light sampled by the water pass.
    gl.colorMask(true, true, true, false);
    drawPoints(bedTarget, lotusBuffer.vao, submerged.length / 7, false);
    gl.colorMask(true, true, true, true);
    gl.bufferData(gl.ARRAY_BUFFER, afloat, gl.STATIC_DRAW);
    drawPoints(lotusTarget, lotusBuffer.vao, afloat.length / 7);
  }

  function draw() {
    let offset = 0;
    const cssPerTexel = Math.max(width / fishTarget.width, height / fishTarget.height);
    for (let i = 0; i < fish.length; i += 1) {
      const vertices = fish[i].drawData(time);
      fishVertices.set(vertices, offset);
      offset += vertices.length;
      // Include the point sprite, all spread taps, and their bilinear footprints.
      let x0 = width;
      let y0 = height;
      let x1 = 0;
      let y1 = 0;
      const margin = WATER.fishSpread + 1.5 * cssPerTexel;
      for (let j = 0; j < vertices.length; j += 7) {
        const x = vertices[j];
        const y = vertices[j + 1];
        const radius = 0.5 * Math.max(1, vertices[j + 2] * density) * cssPerTexel + margin;
        x0 = Math.min(x0, x - radius);
        y0 = Math.min(y0, y - radius);
        x1 = Math.max(x1, x + radius);
        y1 = Math.max(y1, y + radius);
      }
      // Texture clamp-to-edge extends an occupied outermost texel.
      const edge = WATER.fishRefraction + cssPerTexel;
      const bound = i * 4;
      fishBounds[bound] = x0 <= 0 ? -edge : x0;
      fishBounds[bound + 1] = y0 <= 0 ? -edge : y0;
      fishBounds[bound + 2] = x1 >= width ? width + edge : x1;
      fishBounds[bound + 3] = y1 >= height ? height + edge : y1;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, fishPoints.buffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, fishVertices);
    drawPoints(fishTarget, fishPoints.vao, fishVertices.length / 7);

    const waterUniforms = begin(water, waterTarget);
    sample(0, waterUniforms.uFish, fishTarget.texture);
    gl.uniform4fv(waterUniforms["uFishBounds[0]"], fishBounds, 0, fishBounds.length);
    sample(1, waterUniforms.uLotus, lotusTarget.texture);
    sample(2, waterUniforms.uBed, bedTarget.texture);
    gl.uniform1f(waterUniforms.uTime, time);
    const waveTime = Math.fround(time);
    const clickCount = clicks.events.length;
    gl.uniform1i(waterUniforms.uClickCount, clickCount);
    if (clickCount) {
      clicks.pack(width, height, waveTime, clickData, clickShape, 0);
      gl.uniform4fv(waterUniforms["uClicks[0]"], clickData, 0, clickCount * 4);
      gl.uniform4fv(waterUniforms["uClickShape[0]"], clickShape, 0, clickCount * 4);
    }
    let wakeCount = 0;
    for (const wake of wakes) {
      wake.pack(width, height, waveTime, wakeData, wakeShape, wakeCount);
      wakeCount += wake.events.length;
    }
    gl.uniform1i(waterUniforms.uWakeCount, wakeCount);
    if (wakeCount) {
      gl.uniform4fv(waterUniforms["uWakes[0]"], wakeData, 0, wakeCount * 4);
      gl.uniform4fv(waterUniforms["uWakeShape[0]"], wakeShape, 0, wakeCount * 4);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    const desktopUniforms = begin(desktop, sceneTarget);
    sample(0, desktopUniforms.uWater, waterTarget.texture);
    sample(1, desktopUniforms.uClock, clock.texture);
    gl.uniform2f(desktopUniforms.uClockSize, clock.width, clock.height);
    gl.uniform1i(desktopUniforms.uGrid, Number(gridEnabled));
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    const crtUniforms = begin(crt, null);
    sample(0, crtUniforms.uDesktop, sceneTarget.texture);
    gl.uniform1i(crtUniforms.uCRT, Number(crtEnabled));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  return { fit, draw };
}

class WavePackets {
  events = [];

  constructor(capacity, lifetime, speed, delay = 0) {
    this.capacity = capacity;
    this.lifetime = lifetime;
    this.speed = speed;
    this.delay = delay;
  }

  add(x, y, start, strength) {
    if (this.events.length === this.capacity) this.events.shift();
    this.events.push({ x, y, start, strength });
  }

  expire(time) {
    while (this.events.length && time - this.events[0].start >= this.lifetime) this.events.shift();
  }

  pack(width, height, time, data, shape, offset) {
    const short = Math.min(width, height);
    const { delay, speed, lifetime } = this;
    let index = offset * 4;
    for (const event of this.events) {
      // Use the same float32 clock and event start that the shader used.
      const age = Math.fround(time - Math.fround(event.start));
      const sinking = age < delay;
      const travel = Math.max(0, age - delay);
      const front = travel * speed;
      const sigma = sinking ? 0.016 : 0.018 + 0.024 * travel;
      const t = Math.min(1, travel / 0.095);
      const fade = t * t * (3 - 2 * t) * Math.max(0, 1 - age / lifetime) ** 1.55;
      const strength = event.strength * (sinking ? -0.00145 * Math.sin(Math.PI * age / delay) : 0.0021 * fade);
      // Outside seven standard deviations the Gaussian contributes less than 3e-11 of its peak.
      const reach = 7 * sigma;
      data[index] = event.x * width / short;
      data[index + 1] = event.y * height / short;
      data[index + 2] = front;
      data[index + 3] = strength;
      shape[index] = 1 / (sigma * sigma);
      shape[index + 1] = Number(sinking);
      shape[index + 2] = Math.max(0, front - reach) ** 2;
      shape[index + 3] = (front + reach) ** 2;
      index += 4;
    }
  }
}

const fish = KOI_ROUTES.map((route) => new Koi(route));
const clicks = new WavePackets(WATER.clickCapacity, WATER.clickLifetime, WATER.clickSpeed, WATER.clickSink);
const wakes = fish.map(() => new WavePackets(WATER.wakeCapacity, WATER.wakeLifetime, WATER.wakeSpeed));
let frozen = params.get("freeze") === "1";
let crtEnabled = params.get("crt") !== "0";
let gridEnabled = params.get("grid") === "1";
let time = 0;
let previousFrame;
let requested = 0;
let renderer;
let gl;

function incomingYaw(koi) {
  const short = Math.min(koi.width, koi.height);
  let yaw = 0;
  for (const click of clicks.events) {
    const age = time - click.start;
    if (age <= WATER.clickSink) continue;
    const x = koi.headX - click.x * koi.width;
    const y = koi.headY + koi.renderOffsetY - click.y * koi.height;
    const distance = Math.hypot(x, y);
    const front = (age - WATER.clickSink) * WATER.clickSpeed;
    const frontDistance = distance / short - front;
    const crossing = Math.exp(-0.5 * (frontDistance / 0.027) ** 2);
    const side = (y * Math.cos(koi.heading) - x * Math.sin(koi.heading)) / Math.max(distance, 1);
    yaw += 0.051 * crossing * (1 - age / WATER.clickLifetime) * side;
  }
  return Math.max(-0.055, Math.min(0.055, yaw));
}

function advance(dt) {
  time += dt;
  clicks.expire(time);
  for (const [index, koi] of fish.entries()) {
    const wake = wakes[index];
    wake.expire(time);
    if (koi.advance(dt, incomingYaw(koi))) {
      const [x, y] = koi.peduncle;
      wake.add(x / koi.width, y / koi.height, time, koi.beating ? 0.36 : 0.14);
    }
  }
}

function schedule() {
  if (!requested && renderer) requested = browser.requestAnimationFrame(frame);
}

function showFailure(message, error) {
  renderer = null;
  previousFrame = undefined;
  status.textContent = message;
  status.hidden = false;
  if (error) console.error(error);
}

function frame(now) {
  requested = 0;
  if (!renderer) return;
  try {
    renderer.fit();
    let delta = frozen || previousFrame === undefined ? 0 : Math.min(0.10, (now - previousFrame) / 1000);
    previousFrame = frozen ? undefined : now;
    while (delta > 0) {
      const step = Math.min(delta, 1 / 60);
      advance(step);
      delta -= step;
    }
    renderer.draw();
    if (!frozen) schedule();
  } catch (error) {
    showFailure("WebGL2 渲染失败。此设备无法显示池塘样机。", error);
  }
}

function initialize() {
  try {
    gl = canvas.getContext("webgl2", { alpha: false, antialias: false, depth: false, stencil: false });
    if (!gl) {
      showFailure("当前浏览器或设备无法创建 WebGL2 上下文。请检查图形加速设置。");
      return;
    }
    renderer = createRenderer(gl);
    status.hidden = true;
    schedule();
  } catch (error) {
    showFailure("WebGL2 初始化失败。此设备无法显示池塘样机。", error);
  }
}

canvas.addEventListener("webglcontextlost", (event) => {
  event.preventDefault();
  if (requested) browser.cancelAnimationFrame(requested);
  requested = 0;
  showFailure("WebGL2 上下文已丢失，正在等待恢复。");
});
canvas.addEventListener("webglcontextrestored", initialize);
canvas.addEventListener("pointerdown", (event) => {
  if (!renderer || frozen || event.button !== 0) return;
  const bounds = canvas.getBoundingClientRect();
  let x = (event.clientX - bounds.left) / bounds.width;
  let y = 1 - (event.clientY - bounds.top) / bounds.height;
  if (crtEnabled) {
    const px = 2 * x - 1;
    const py = 2 * y - 1;
    if (Math.abs(px) ** CRT.tubeExponent + Math.abs(py) ** CRT.tubeExponent > 1) return;
    const scale = (1 + CRT.barrel * (px * px + py * py)) / (1 + CRT.barrel);
    x = 0.5 + 0.5 * px * scale;
    y = 0.5 + 0.5 * py * scale;
  }
  clicks.add(x, y, time, 1);
});
browser.addEventListener("resize", schedule);
browser.addEventListener("keydown", (event) => {
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.code === "KeyC") crtEnabled = !crtEnabled;
  else if (event.code === "KeyG") gridEnabled = !gridEnabled;
  else if (event.code === "Space") {
    event.preventDefault();
    frozen = !frozen;
    previousFrame = undefined;
  } else return;
  schedule();
});

initialize();
