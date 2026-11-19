import { KOI_ROUTES, Koi, seededRandom } from "./fish.mjs?v=20261119-gemini-11align1";
import {
  CRT, WATER, fullscreenVertex, pointVertex, pointFragment, bedFragment, waterFragment, desktopFragment, crtFragment
} from "./shaders.mjs?v=20261119-gemini-11align1";

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
  const glyphs = {
    0: [14, 17, 19, 21, 25, 17, 14],
    1: [4, 12, 4, 4, 4, 4, 14],
    2: [14, 17, 1, 2, 4, 8, 31],
    5: [31, 16, 30, 1, 1, 17, 14],
    6: [6, 8, 16, 30, 17, 17, 14],
    7: [31, 1, 2, 4, 8, 8, 8],
    ":": [0, 0, 4, 0, 4, 0, 0],
    "-": [0, 0, 0, 14, 0, 0, 0]
  };
  const text = "12:00  2025-01-26";
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

// Top-left scene coordinates aligned 1:1 with 15561.png.
const LEAVES = [
  { material: "main", placement: [
    [0.250, 0.521, 0.056, -0.05, -0.58, 0.52, 1207],
    [0.379, 0.634, 0.065, 0.04, -2.56, 0.52, 1901],
    [0.626, 0.358, 0.056, -0.04, -0.45, 0.51, 1217],
    [0.772, 0.486, 0.050, 0.05, 2.75, 0.50, 1831]
  ] },
  { material: "companion", placement: [
    [0.183, 0.564, 0.028, 0.14, 2.85, 0.50, 2081],
    [0.234, 0.643, 0.039, 0.04, 0.52, 0.52, 2083],
    [0.303, 0.376, 0.036, -0.08, 0.42, 0.50, 2087],
    [0.264, 0.344, 0.024, 0.10, 2.95, 0.50, 2089],
    [0.348, 0.565, 0.017, -0.12, 2.60, 0.48, 2099],
    [0.618, 0.303, 0.024, 0.05, 1.04, 0.48, 2111],
    [0.678, 0.300, 0.024, -0.14, 2.46, 0.48, 2113],
    [0.742, 0.356, 0.030, 0.16, 3.85, 0.50, 2129],
    [0.792, 0.438, 0.019, -0.08, 2.19, 0.48, 2131],
    [0.748, 0.455, 0.022, 0.18, 5.73, 0.50, 2137],
    [0.378, 0.249, 0.028, -0.12, 1.68, 0.48, 2141],
    [0.454, 0.242, 0.020, 0.08, -1.20, 0.48, 2145],
    [0.335, 0.275, 0.018, -0.18, 2.10, 0.48, 2147],
    [0.435, 0.703, 0.024, 0.14, 4.09, 0.50, 2143],
    [0.473, 0.666, 0.020, 0.10, 2.84, 0.49, 2153],
    [0.635, 0.828, 0.028, -0.08, 0.35, 0.50, 2159],
    [0.676, 0.802, 0.017, -0.14, 2.70, 0.48, 2161]
  ] },
  { material: "dark", placement: [
    [0.095, 0.072, 0.042, 0.16, 1.25, 0.48, 2203],
    [0.128, 0.106, 0.045, -0.08, 0.95, 0.48, 2205],
    [0.968, 0.195, 0.046, -0.14, 2.70, 0.48, 2207],
    [0.956, 0.242, 0.052, 0.12, 3.83, 0.50, 2213],
    [0.976, 0.596, 0.042, 0.18, 2.65, 0.48, 2221],
    [0.036, 0.782, 0.060, -0.14, 4.58, 0.49, 2237],
    [0.124, 0.904, 0.068, 0.18, 0.22, 0.49, 2239],
    [0.156, 0.930, 0.048, 0.08, 2.16, 0.50, 2243],
    [0.885, 0.918, 0.034, -0.18, 5.76, 0.46, 2251]
  ] }
];

const LEAF_MATERIALS = {
  main: {
    pitch: 5.20, beadSize: [4.10, 4.95], veins: 8,
    under: [0.08, 0.25, 0.12, 0.64],
    shade: [0.18, 0.45, 0.20], mid: [0.43, 0.70, 0.26],
    sun: [0.80, 0.85, 0.36], rim: [0.92, 0.93, 0.44]
  },
  companion: {
    pitch: 5.25, beadSize: [3.80, 4.55], veins: 6,
    under: [0.06, 0.20, 0.11, 0.56],
    shade: [0.16, 0.41, 0.19], mid: [0.35, 0.63, 0.24],
    sun: [0.68, 0.79, 0.32], rim: [0.82, 0.87, 0.40]
  },
  dark: {
    pitch: 5.55, beadSize: [3.40, 4.10], veins: 5,
    under: [0.02, 0.07, 0.05, 0.38],
    shade: [0.08, 0.20, 0.12], mid: [0.15, 0.30, 0.16],
    sun: [0.22, 0.38, 0.19], rim: [0.27, 0.43, 0.21]
  }
};

const FLOWERS = [
  { x: 0.285, y: 0.578, width: 0.055, lean: -0.04, opening: 1.0, petals: 13, seed: 2273 },
  { x: 0.708, y: 0.336, width: 0.047, lean: 0.04, opening: 0.95, petals: 13, seed: 2281 },
  { x: 0.253, y: 0.390, width: 0.017, lean: 0.06, opening: 0, petals: 0, seed: 2287 }
];

const AMBIENT_RIPPLE_SITES = [
  [0.092, 0.735],
  [0.925, 0.942],
  [0.052, 0.425],
  [0.558, 0.098],
  [0.925, 0.215]
];

function lotusPoints(width, height) {
  const afloat = [];
  const submerged = [];
  const scale = Math.min(width, 1.65 * height);
  const size = Math.sqrt(scale / 1536);
  const turn = 2 * Math.PI;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const mix = (a, b, t) => a + (b - a) * t;
  const smoothstep = (e0, e1, x) => {
    const t = clamp((x - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  };
  const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

  // 1. Natural feathered-edge 5.2px beaded lotus leaves.
  for (const { material, placement } of LEAVES) {
    const { pitch, beadSize: [bMin, bMax], veins, under, shade, mid, sun, rim } = LEAF_MATERIALS[material];
    const dark = material === "dark";

    for (const [x, y, radius, roll, notch, flatten, seed] of placement) {
      const random = seededRandom(seed);
      const span = radius * scale;
      const cos = Math.cos(roll);
      const sin = Math.sin(roll);
      const baseX = x * width;
      const baseY = (1 - y) * height;

      const lightX = y < 0.48 ? 0.415 : 0.540;
      const lightY = y < 0.48 ? 0.298 : 0.520;
      const worldLightAngle = Math.atan2((y - lightY) * height, (lightX - x) * width);
      const lightAngle = worldLightAngle - roll;

      const waveA = 4 + Math.floor(random() * 3);
      const waveB = 7 + Math.floor(random() * 3);
      const phA = turn * random();
      const phB = turn * random();
      const wedgeHalf = 0.29 + 0.04 * random();

      const outerAt = (ang) => 0.99 + 0.020 * Math.cos(waveA * ang + phA) + 0.014 * Math.sin(waveB * ang + phB);
      const insideLeaf = (u, v) => {
        const r = Math.hypot(u, v);
        const ang = Math.atan2(v, u);
        const outer = outerAt(ang);
        if (r > outer) return -1;
        const dAng = Math.abs(angleDiff(ang, notch));
        if (dAng < wedgeHalf) {
          const wedgeRadius = 0.09 + 0.91 * (dAng / wedgeHalf) ** 1.12;
          if (r > wedgeRadius) return -1;
          return (wedgeRadius - r) * 0.85;
        }
        return outer - r;
      };

      const underStep = (pitch * 1.38) * size;
      const maxX = span * 1.05;
      const maxY = span * flatten * 1.05;
      for (let dy = -maxY; dy <= maxY; dy += underStep) {
        for (let dx = -maxX; dx <= maxX; dx += underStep) {
          const rx = dx * cos + dy * sin;
          const ry = (-dx * sin + dy * cos) / flatten;
          const margin = insideLeaf(rx / span, ry / span);
          if (margin < 0.04) continue;
          if (!dark && random() < 0.45) {
            submerged.push(baseX + dx + 4.5 * size, baseY + dy - 6.0 * size, 5.5 * size,
              0.014, 0.046, 0.036, 0.15);
          }
          afloat.push(baseX + dx, baseY + dy, (pitch * 1.36) * size,
            under[0], under[1], under[2], under[3] * smoothstep(0.03, 0.18, margin));
        }
      }

      const dxStep = pitch * size;
      const dyStep = (pitch * 0.94) * size;
      const rowStart = Math.floor(-maxY / dyStep) - 1;
      const rowEnd = Math.ceil(maxY / dyStep) + 1;
      const colStart = Math.floor(-maxX / dxStep) - 1;
      const colEnd = Math.ceil(maxX / dxStep) + 1;

      for (let rIdx = rowStart; rIdx <= rowEnd; rIdx += 1) {
        const py = rIdx * dyStep;
        const stagger = (rIdx & 1) ? 0.5 * dxStep : 0;
        for (let cIdx = colStart; cIdx <= colEnd; cIdx += 1) {
          const px = cIdx * dxStep + stagger + (random() - 0.5) * 0.95 * size;
          const jy = py + (random() - 0.5) * 0.85 * size;

          const lx = (px * cos + jy * sin) / span;
          const ly = (-px * sin + jy * cos) / (span * flatten);
          const margin = insideLeaf(lx, ly);
          if (margin < 0) continue;

          const rad = Math.hypot(lx, ly);
          const ang = Math.atan2(ly, lx);
          const dNotch = Math.abs(angleDiff(ang, notch));
          const towardSun = Math.cos(ang - lightAngle);

          const umbrellaSlope = 0.50 + 0.50 * towardSun * Math.min(1.0, 0.25 + rad * 1.15);
          const domeLift = Math.sin(Math.min(1.0, rad) * Math.PI * 0.82);
          const hubCup = 1.0 - 0.20 * Math.exp(-rad * rad * 26.0);
          const tone = clamp((0.15 + 0.78 * umbrellaSlope + 0.13 * domeLift) * hubCup + (random() - 0.5) * 0.08, 0.0, 1.0);

          const vCos = dNotch > wedgeHalf * 1.12 ? Math.cos(veins * (ang - notch)) : -1;
          const vein = rad > 0.11 && margin > 0.06 ? Math.max(0, vCos) ** 20.0 : 0.0;
          const sunLip = margin < 0.095 && !dark ? smoothstep(-0.15, 0.85, towardSun) * 0.65 : 0.0;

          let colR, colG, colB;
          if (tone < 0.5) {
            const t2 = tone * 2.0;
            colR = mix(shade[0], mid[0], t2);
            colG = mix(shade[1], mid[1], t2);
            colB = mix(shade[2], mid[2], t2);
          } else {
            const t2 = (tone - 0.5) * 2.0;
            colR = mix(mid[0], sun[0], t2);
            colG = mix(mid[1], sun[1], t2);
            colB = mix(mid[2], sun[2], t2);
          }

          const highlight = Math.max(vein * 0.50, sunLip);
          colR = mix(colR, rim[0], highlight);
          colG = mix(colG, rim[1], highlight);
          colB = mix(colB, rim[2], highlight);

          const isNavel = !dark && rad < 0.090;
          const edgeSoft = smoothstep(0.0, 0.075, margin);
          const diam = isNavel ? bMax * 1.12 : mix(bMin, bMax, 0.35 + 0.45 * tone + 0.20 * random()) * (0.80 + 0.20 * edgeSoft);
          const alpha = (dark ? 0.58 + 0.22 * tone : clamp(0.84 + 0.14 * tone, 0.78, 0.98)) * (0.55 + 0.45 * edgeSoft);
          afloat.push(
            baseX + px,
            baseY + jy + domeLift * span * 0.03,
            diam * size,
            isNavel ? rim[0] * 1.08 : colR,
            isNavel ? rim[1] * 1.04 : colG,
            isNavel ? rim[2] * 1.25 : colB,
            alpha
          );
        }
      }

      if (dark || radius > 0.045) {
        const stemLen = span * (dark ? 1.45 : 0.85);
        const steps = Math.max(5, Math.round(stemLen / (6.5 * size)));
        for (let s = 1; s <= steps; s += 1) {
          const t = s / steps;
          const curveX = Math.sin(t * 2.4 + seed) * span * 0.14;
          submerged.push(
            baseX + curveX, baseY - t * stemLen, 3.4 * size,
            dark ? 0.10 : 0.18, dark ? 0.24 : 0.36, dark ? 0.15 : 0.20,
            (dark ? 0.36 : 0.38) * (1.0 - 0.62 * t)
          );
        }
      }
    }
  }

  // 2. Unified Staggered-Bead-Grid Lotus Crown Flowers & Plump Pink Bud.
  for (const { x, y, width: fraction, lean, opening, petals, seed } of FLOWERS) {
    const random = seededRandom(seed);
    const span = fraction * scale;
    const originX = x * width;
    const originY = (1 - y) * height;
    const baseY = originY - span * (petals ? 0.22 : 0.30);
    const stemX = (t) => originX + span * (-lean * 0.40 * t - 0.05 * Math.sin(2.8 * t));

    for (let i = 0; i < 9; i += 1) {
      const t = i / 9;
      afloat.push(stemX(t), baseY - span * 0.26 * t, 3.2 * size, 0.36, 0.60, 0.26, 0.80 - 0.25 * t);
    }
    for (let i = 1; i <= 11; i += 1) {
      const t = i / 11;
      submerged.push(stemX(t) + 2, baseY - span * (0.22 + 0.90 * t), 3.3 * size,
        0.26, 0.46, 0.22, 0.44 * (1.0 - 0.65 * t));
      if (petals && i <= 8) {
        const rx = (random() - 0.5) * span * 0.52 * (1.0 - 0.45 * t);
        submerged.push(originX + rx, baseY - span * (0.10 + 0.52 * t), 3.6 * size,
          0.62, 0.32, 0.36, 0.24 * (1.0 - t / 9));
      }
    }

    if (petals) {
      const petalDefs = [
        // Back 3 tall pointed lotus crown peaks (z = 1)
        { bx: -0.09, by: 0.08, tx: -0.27 * opening, ty: 0.70, wid: 0.135, whiteAt: 0.42, z: 1 },
        { bx:  0.00, by: 0.10, tx:  0.01 * opening, ty: 0.78, wid: 0.145, whiteAt: 0.40, z: 1 },
        { bx:  0.09, by: 0.08, tx:  0.28 * opening, ty: 0.69, wid: 0.135, whiteAt: 0.42, z: 1 },
        // Middle 4 fanning pointed lateral lotus petals (z = 2)
        { bx: -0.14, by: 0.05, tx: -0.52 * opening, ty: 0.54, wid: 0.135, whiteAt: 0.46, z: 2 },
        { bx:  0.14, by: 0.05, tx:  0.52 * opening, ty: 0.53, wid: 0.135, whiteAt: 0.46, z: 2 },
        { bx: -0.16, by: 0.02, tx: -0.72 * opening, ty: 0.34, wid: 0.130, whiteAt: 0.50, z: 2 },
        { bx:  0.16, by: 0.02, tx:  0.72 * opening, ty: 0.33, wid: 0.130, whiteAt: 0.50, z: 2 },
        // Front 5 shorter cupped rose-pink foreground petals cradling the golden stamen heart (z = 4)
        { bx: -0.15, by: -0.02, tx: -0.56 * opening, ty: 0.14, wid: 0.125, whiteAt: 0.68, z: 4 },
        { bx: -0.08, by: -0.03, tx: -0.30 * opening, ty: 0.20, wid: 0.130, whiteAt: 0.72, z: 4 },
        { bx:  0.00, by: -0.04, tx:  0.00,           ty: 0.19, wid: 0.140, whiteAt: 0.75, z: 4 },
        { bx:  0.08, by: -0.03, tx:  0.30 * opening, ty: 0.20, wid: 0.130, whiteAt: 0.72, z: 4 },
        { bx:  0.15, by: -0.02, tx:  0.56 * opening, ty: 0.14, wid: 0.125, whiteAt: 0.68, z: 4 }
      ];

      const evalPetal = (u, v, p) => {
        const dx = p.tx - p.bx;
        const dy = p.ty - p.by;
        const len2 = dx * dx + dy * dy;
        const t = ((u - p.bx) * dx + (v - p.by) * dy) / len2;
        if (t < -0.04 || t > 1.0) return null;
        const tc = clamp(t, 0, 1);
        const len = Math.sqrt(len2);
        const perp = Math.abs((u - p.bx) * dy - (v - p.by) * dx) / len;
        const halfW = p.wid * (1.0 - Math.pow(tc, 1.08)) * (0.52 + 0.48 * smoothstep(0.0, 0.28, tc));
        if (perp > halfW) return null;
        return { t: tc, edge: perp / Math.max(halfW, 0.001) };
      };

      afloat.push(originX, baseY + 0.13 * span, span * 0.46, 0.30, 0.14, 0.18, 0.52);

      const gStepX = 4.45 * size;
      const gStepY = 4.25 * size;
      const maxU = Math.ceil((0.78 * span) / gStepX);
      const minV = Math.floor((-0.08 * span) / gStepY);
      const maxV = Math.ceil((0.82 * span) / gStepY);

      for (let rIdx = minV; rIdx <= maxV; rIdx += 1) {
        const py = rIdx * gStepY;
        const stagger = (rIdx & 1) ? 0.5 * gStepX : 0;
        for (let cIdx = -maxU; cIdx <= maxU; cIdx += 1) {
          const px = cIdx * gStepX + stagger + (random() - 0.5) * 0.35 * size;
          const jy = py + (random() - 0.5) * 0.30 * size;
          const u = (px - lean * jy * 0.15) / span;
          const v = jy / span;

          const stDist = Math.hypot(u / 0.19, (v - 0.25) / 0.105);
          let bestZ = -1;
          let bestCol = null;

          if (stDist <= 1.0) {
            bestZ = 3;
            const goldBright = 0.94 + 0.14 * (1.0 - stDist);
            bestCol = [1.05 * goldBright, 0.84 * goldBright, 0.24 * goldBright];
          }

          for (const p of petalDefs) {
            if (p.z < bestZ) continue;
            const hit = evalPetal(u, v, p);
            if (!hit) continue;
            const whiteMix = smoothstep(p.whiteAt - 0.18, p.whiteAt + 0.24, hit.t);
            const seamShade = 1.0 - 0.22 * (hit.edge ** 2.0) * (1.0 - 0.45 * whiteMix);
            const rCol = mix(0.88, 1.05, whiteMix) * seamShade;
            const gCol = mix(0.52, 1.02, whiteMix) * (seamShade - 0.04 * hit.edge);
            const bCol = mix(0.56, 0.97, whiteMix) * (seamShade - 0.03 * hit.edge);
            bestZ = p.z;
            bestCol = [rCol, gCol, bCol];
          }

          if (bestCol) {
            afloat.push(originX + px, baseY + jy, 4.35 * size, bestCol[0], bestCol[1], bestCol[2], 0.96);
          }
        }
      }
    } else {
      afloat.push(originX, baseY + 0.38 * span, span * 0.85, 0.36, 0.18, 0.22, 0.48);
      const bStep = 4.35 * size;
      for (let rIdx = 0; rIdx <= 5; rIdx += 1) {
        const t = rIdx / 5;
        const stagger = (rIdx & 1) ? 0.5 : 0;
        const halfW = 0.48 * span * Math.sin(Math.PI * (0.14 + 0.82 * t)) ** 0.72;
        const cols = Math.floor(halfW / bStep);
        for (let cIdx = -cols; cIdx <= cols; cIdx += 1) {
          const px = (cIdx + stagger * 0.4) * bStep;
          if (Math.abs(px) > halfW + 0.8 * size) continue;
          const calyx = 1.0 - smoothstep(0.0, 0.28, t);
          const whiteMix = smoothstep(0.32, 0.85, t);
          const rCol = mix(mix(0.88, 1.05, whiteMix), 0.44, calyx);
          const gCol = mix(mix(0.54, 1.01, whiteMix), 0.68, calyx);
          const bCol = mix(mix(0.60, 0.96, whiteMix), 0.32, calyx);
          afloat.push(originX + px, baseY + rIdx * bStep * 0.92, 4.45 * size, rCol, gCol, bCol, 0.96);
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
  let seededInitialRipples = false;

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
    gl.colorMask(true, true, true, false);
    drawPoints(bedTarget, lotusBuffer.vao, submerged.length / 7, false);
    gl.colorMask(true, true, true, true);
    gl.bufferData(gl.ARRAY_BUFFER, afloat, gl.STATIC_DRAW);
    drawPoints(lotusTarget, lotusBuffer.vao, afloat.length / 7);

    if (!seededInitialRipples) {
      seededInitialRipples = true;
      for (let i = 1; i < fish.length; i += 1) {
        const koi = fish[i];
        const [px, py] = koi.peduncle;
        const mx = (px + koi.headX) * 0.5 / width;
        const my = (py + koi.headY + koi.renderOffsetY) * 0.5 / height + (i === 2 ? 0.035 : 0);
        wakes[i].add(mx, my, time - 1.15, 0.76);
        wakes[i].add(px / width, py / height, time - 0.48, 0.60);
      }
      for (let s = 0; s < AMBIENT_RIPPLE_SITES.length; s += 1) {
        const [rx, ry] = AMBIENT_RIPPLE_SITES[s];
        wakes[0].add(rx, ry, time - 0.70, 0.50);
      }
    }
  }

  function draw() {
    let offset = 0;
    const cssPerTexel = Math.max(width / fishTarget.width, height / fishTarget.height);
    for (let i = 0; i < fish.length; i += 1) {
      const vertices = fish[i].drawData(time);
      fishVertices.set(vertices, offset);
      offset += vertices.length;
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
      const age = Math.fround(time - Math.fround(event.start));
      const sinking = age < delay;
      const travel = Math.max(0, age - delay);
      const front = travel * speed;
      const sigma = sinking ? 0.018 : 0.028 + 0.016 * travel;
      const t = Math.min(1, travel / 0.095);
      const fade = t * t * (3 - 2 * t) * Math.max(0, 1 - age / lifetime) ** 1.25;
      const strength = event.strength * (sinking ? -0.0016 * Math.sin(Math.PI * age / delay) : 0.0028 * fade);
      const reach = 4.2 * sigma;
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
let ambientIndex = 0;
let nextAmbientTime = 0.70;
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
      const strength = koi.route.shadow ? 0.22 : (koi.beating ? 0.74 : 0.42);
      wake.add(x / koi.width, y / koi.height, time, strength);
    }
  }
  if (time >= nextAmbientTime) {
    const [rx, ry] = AMBIENT_RIPPLE_SITES[ambientIndex % AMBIENT_RIPPLE_SITES.length];
    ambientIndex += 1;
    wakes[0].add(rx, ry, time, 0.48);
    nextAmbientTime = time + 0.52;
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
