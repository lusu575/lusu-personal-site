import { KOI_ROUTES, Koi, seededRandom } from "./fish.mjs?v=20261119-gemini-sample1";
import {
  CRT, WATER, fullscreenVertex, pointVertex, pointFragment, bedFragment, waterFragment, desktopFragment, crtFragment
} from "./shaders.mjs?v=20261119-gemini-sample1";
import { LEAF_SAMPLES, FLOWER_SAMPLES, BUD_SAMPLES, PLANT_POINT_BUDGET } from "./sampled-data.mjs";

const browser = globalThis;
const canvas = browser.document.querySelector("canvas");
const status = browser.document.querySelector("#status");
const params = new URLSearchParams(browser.location.search);

const MAX_PLANT_POINTS = Math.min(12000, Number(PLANT_POINT_BUDGET) || 12000);

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

// Scene placement tables (top-left normalized coordinates): [x, y, radius, roll, notch, flatten, seed].
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

// Material tint fallback when companion / dark reuse the same sampled leaf sprite.
const LEAF_FALLBACK_TINT = {
  main: [1.0, 1.0, 1.0, 1.0],
  companion: [0.88, 0.94, 0.92, 0.92],
  dark: [0.30, 0.44, 0.38, 0.62]
};

const FLOWERS = [
  { x: 0.285, y: 0.578, width: 0.055, lean: -0.04, petals: 13, seed: 2273 },
  { x: 0.708, y: 0.336, width: 0.047, lean: 0.04, petals: 13, seed: 2281 },
  { x: 0.253, y: 0.390, width: 0.017, lean: 0.06, petals: 0, seed: 2287 }
];

const AMBIENT_RIPPLE_SITES = [
  [0.092, 0.735],
  [0.925, 0.942],
  [0.052, 0.425],
  [0.558, 0.098],
  [0.925, 0.215]
];

function pickTemplate(group, preferredKey, seed) {
  if (!group) return null;
  if (group.points) return { template: group, exactKey: true };
  if (Array.isArray(group)) {
    return group.length ? { template: group[seed % group.length], exactKey: true } : null;
  }
  const direct = preferredKey ? group[preferredKey] : null;
  if (direct) {
    if (Array.isArray(direct)) {
      return direct.length ? { template: direct[seed % direct.length], exactKey: true } : null;
    }
    if (direct.points) return { template: direct, exactKey: true };
  }
  const values = Object.values(group).flatMap((v) => (Array.isArray(v) ? v : [v])).filter((v) => v?.points);
  if (!values.length) return null;
  return { template: values[seed % values.length], exactKey: false };
}

function thinPointStream(flatArray, maxPoints) {
  const count = Math.floor(flatArray.length / 7);
  if (count <= maxPoints) return new Float32Array(flatArray);
  const out = new Float32Array(maxPoints * 7);
  const step = count / maxPoints;
  for (let i = 0; i < maxPoints; i += 1) {
    const src = Math.min(count - 1, Math.floor(i * step)) * 7;
    const dst = i * 7;
    for (let k = 0; k < 7; k += 1) out[dst + k] = flatArray[src + k];
  }
  return out;
}

// Assembles static afloat & submerged plant point clouds solely by instancing sampled sprite datasets.
function lotusPoints(width, height) {
  const afloat = [];
  const submerged = [];
  const scale = Math.min(width, 1.65 * height);
  const size = Math.sqrt(scale / 1536);

  // 1. Assemble lotus leaves from LEAF_SAMPLES.
  for (const { material, placement } of LEAVES) {
    const dark = material === "dark";
    for (const [x, y, radius, roll, notch, flatten, seed] of placement) {
      const picked = pickTemplate(LEAF_SAMPLES, material, seed);
      if (!picked) continue;
      const { template, exactKey } = picked;
      const { points, stride = 7, aspect = 1.85, projected = true } = template;
      const count = Math.floor(points.length / stride);
      if (!count) continue;

      const [tr, tg, tb, ta] = exactKey ? [1, 1, 1, 1] : LEAF_FALLBACK_TINT[material];
      const random = seededRandom(seed);
      const span = radius * scale;
      const baseX = x * width;
      const baseY = (1 - y) * height;
      const cosR = Math.cos(roll);
      const sinR = Math.sin(roll);
      const cosN = Math.cos(notch);
      const sinN = Math.sin(notch);
      const flipX = Math.cos(notch) >= 0 ? -1 : 1;
      const radiusPointScale = Math.max(0.70, Math.min(1.12, Math.sqrt(radius / 0.052)));
      const shadowStride = Math.max(2, Math.round(count / 24));

      for (let i = 0; i < count; i += 1) {
        const idx = i * stride;
        const nx = points[idx] - 0.5;
        const ny = 0.5 - points[idx + 1];
        const r = points[idx + 2] * tr;
        const g = points[idx + 3] * tg;
        const b = points[idx + 4] * tb;
        const a = points[idx + 5] * ta;
        const ptSize = points[idx + 6] * radiusPointScale * size;

        let dx;
        let dy;
        if (projected) {
          // Sprite already carries oblique pond perspective; preserve its aspect ratio and apply gentle roll/flip.
          const lx = nx * 2 * span * flipX;
          const ly = ny * 2 * (span / Math.max(0.25, aspect));
          dx = lx * cosR - ly * sinR;
          dy = lx * sinR + ly * cosR;
        } else {
          // Top-down disc sprite: rotate in leaf plane by notch, foreshorten by flatten, then roll.
          const ux = nx * 2 * span;
          const uy = ny * 2 * (span / Math.max(0.25, aspect));
          const rx = ux * cosN - uy * sinN;
          const ry = (ux * sinN + uy * cosN) * flatten;
          dx = rx * cosR - ry * sinR;
          dy = rx * sinR + ry * cosR;
        }

        const sx = baseX + dx;
        const sy = baseY + dy;
        afloat.push(sx, sy, ptSize, r, g, b, a);

        if (!dark && i % shadowStride === 0) {
          submerged.push(
            sx + 4.5 * size,
            sy - 6.0 * size,
            5.2 * size,
            0.015, 0.048, 0.038,
            0.14 + 0.04 * random()
          );
        }
      }
    }
  }

  // 2. Assemble lotus blooms & buds from FLOWER_SAMPLES and BUD_SAMPLES.
  for (const { x, y, width: fraction, lean, petals, seed } of FLOWERS) {
    const isBloom = petals > 0;
    const picked = isBloom
      ? pickTemplate(FLOWER_SAMPLES, "bloom", seed)
      : pickTemplate(BUD_SAMPLES, "closed", seed);
    if (!picked) continue;

    const { template } = picked;
    const { points, stride = 7, aspect = 1.4 } = template;
    const count = Math.floor(points.length / stride);
    if (!count) continue;

    const span = fraction * scale;
    const halfW = span * (isBloom ? 0.86 : 0.72);
    const halfH = halfW / Math.max(0.25, aspect);
    const originX = x * width;
    const originY = (1 - y) * height;
    const cosL = Math.cos(-lean * 0.35);
    const sinL = Math.sin(-lean * 0.35);

    for (let i = 0; i < count; i += 1) {
      const idx = i * stride;
      const lx = (points[idx] - 0.5) * 2 * halfW;
      const ly = (0.5 - points[idx + 1]) * 2 * halfH;
      const sx = originX + lx * cosL - ly * sinL;
      const sy = originY + lx * sinL + ly * cosL;
      afloat.push(
        sx,
        sy,
        points[idx + 6] * size,
        points[idx + 2],
        points[idx + 3],
        points[idx + 4],
        points[idx + 5]
      );
    }

    // Subtle underwater stem & soft reflection below each flower/bud.
    const stemBaseY = originY - halfH * 0.78;
    for (let s = 0; s < 8; s += 1) {
      const t = (s + 0.5) / 8;
      const stemX = originX - lean * span * 0.35 * t;
      submerged.push(
        stemX + 2.0 * size,
        stemBaseY - span * 0.85 * t,
        3.2 * size,
        0.24, 0.44, 0.21,
        0.40 * (1 - 0.65 * t)
      );
    }
  }

  // Enforce total plant budget <= 12,000 points across afloat + submerged.
  const afloatCount = afloat.length / 7;
  const submergedCount = submerged.length / 7;
  const totalCount = afloatCount + submergedCount;
  if (totalCount <= MAX_PLANT_POINTS) {
    return { afloat: new Float32Array(afloat), submerged: new Float32Array(submerged) };
  }

  const submergedBudget = Math.min(submergedCount, Math.max(120, Math.round(MAX_PLANT_POINTS * (submergedCount / totalCount))));
  const afloatBudget = Math.max(1, MAX_PLANT_POINTS - submergedBudget);
  return {
    afloat: thinPointStream(afloat, afloatBudget),
    submerged: thinPointStream(submerged, submergedBudget)
  };
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
    if (count > 0) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.bindVertexArray(vao);
      gl.uniform1f(uniforms.uDpr, density);
      gl.drawArrays(gl.POINTS, 0, count);
      gl.disable(gl.BLEND);
      gl.bindVertexArray(null);
    }
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
      if (vertices.length === 0) {
        fishBounds[bound] = -10;
        fishBounds[bound + 1] = -10;
        fishBounds[bound + 2] = -5;
        fishBounds[bound + 3] = -5;
      } else {
        fishBounds[bound] = x0 <= 0 ? -edge : x0;
        fishBounds[bound + 1] = y0 <= 0 ? -edge : y0;
        fishBounds[bound + 2] = x1 >= width ? width + edge : x1;
        fishBounds[bound + 3] = y1 >= height ? height + edge : y1;
      }
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
