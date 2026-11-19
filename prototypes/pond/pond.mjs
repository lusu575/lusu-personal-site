import { KOI_ROUTES, Koi, seededRandom } from "./fish.mjs?v=20261119-gemini-water1";
import {
  CRT, WATER, fullscreenVertex, pointVertex, pointFragment, bedFragment, waterFragment, desktopFragment, crtFragment
} from "./shaders.mjs?v=20261119-gemini-water1";

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
  main: { step: 4.2, size: [1.8, 3.1], alpha: [0.46, 0.72], veins: 10,
    surface: [0.48, 0.81, 0.25], rib: [0.69, 0.89, 0.31], lip: [0.82, 0.94, 0.32] },
  companion: { step: 4.7, size: [1.5, 2.6], alpha: [0.32, 0.58], veins: 5,
    surface: [0.34, 0.70, 0.24], rib: [0.52, 0.76, 0.27], lip: [0.62, 0.79, 0.29] },
  dark: { step: 6.1, size: [1.5, 2.6], alpha: [0.22, 0.42], veins: 4,
    surface: [0.07, 0.17, 0.12], rib: [0.12, 0.23, 0.14], lip: [0.14, 0.24, 0.15] }
};

const FLOWERS = [
  { x: 0.285, y: 0.580, width: 0.056, lean: -0.12, opening: 1, petals: 8, seed: 2273 },
  { x: 0.712, y: 0.335, width: 0.048, lean: 0.15, opening: 0.91, petals: 7, seed: 2281 },
  { x: 0.251, y: 0.393, width: 0.015, lean: 0.17, petals: 0, seed: 2287 }
];

function lotusPoints(width, height) {
  const afloat = [];
  const submerged = [];
  const scale = Math.min(width, 1.65 * height);
  const size = Math.sqrt(scale / 1536);
  const turn = 2 * Math.PI;

  for (const { material, placement } of LEAVES) {
    const { step: spacing, size: [small, large], alpha: [faint, solid], veins, surface, rib, lip } =
      LEAF_MATERIALS[material];
    const dark = material === "dark";
    const directionalShade = material === "main" ? 0.22 : 0.13;
    const [rimAlpha, rimVariation] = dark ? [0.36, 0.06] : [0.68, 0.20];
    for (const [x, y, radius, roll, notch, flatten, seed] of placement) {
      const random = seededRandom(seed);
      const span = radius * scale;
      const cos = Math.cos(roll);
      const sin = Math.sin(roll);
      const step = spacing / (radius * 1536);
      const baseX = x * width;
      const baseY = (1 - y) * height;
      const lightX = y < 0.5 ? 0.408 : 0.610;
      const lightY = y < 0.5 ? 0.305 : 0.650;
      const lightAngle = Math.atan2((y - lightY) * height, (lightX - x) * width) - roll;
      const notchDepth = 0.55 + 0.17 * random();
      const towardLight = (angle) => Math.cos(angle - lightAngle);
      const rimAt = (angle) => {
        const cut = Math.max(0, Math.cos(angle - notch)) ** 34;
        return 0.97 + 0.018 * Math.cos(5 * angle + notch) + 0.023 * Math.sin(9 * angle) - notchDepth * cut;
      };
      const leafPoint = (angle, radial, diameter, color, opacity, shade = 1) => {
        const u = radial * Math.cos(angle);
        const v = radial * Math.sin(angle) * flatten;
        afloat.push(baseX + span * (u * cos - v * sin), baseY + span * (u * sin + v * cos),
          diameter * size, color[0] * shade, color[1] * shade, color[2] * shade, opacity);
      };
      for (let row = -1; row <= 1; row += step / flatten) {
        for (let column = -1; column <= 1; column += step) {
          const u = column + (random() - 0.5) * step * 0.94;
          const v = row + (random() - 0.5) * step / flatten;
          const angle = Math.atan2(v, u);
          const radial = Math.hypot(u, v);
          const rim = rimAt(angle);
          if (radial > rim + 0.035 || (radial > rim - 0.035 && random() > 0.60)) continue;
          const shade = 0.76 + 0.22 * random() + directionalShade * radial * towardLight(angle);
          leafPoint(angle, radial, small + (large - small) * Math.sqrt(random()), surface,
            faint + (solid - faint) * random(), shade);
        }
      }
      for (let angle = 0; angle < turn; angle += step * (dark ? 2.6 : 1.0)) {
        const radial = rimAt(angle) + (random() - 0.5) * 0.055;
        const bright = towardLight(angle) > 0.50;
        const index = afloat.length;
        if (bright || random() < (dark ? 0.17 : 0.45)) {
          leafPoint(angle, radial, small + (large - small) * random(), bright ? lip : surface,
            bright ? rimAlpha + rimVariation * random() : faint + 0.11 * random());
          submerged.push(afloat[index] + 3, afloat[index + 1] - 5, (2.8 + 1.4 * random()) * size,
            0.024, 0.060, 0.046, 0.10 + 0.08 * random());
        }
      }
      for (let ray = 0; ray < veins; ray += 1) {
        const heading = (ray + 0.25 * random()) * turn / veins;
        const limit = rimAt(heading) - step;
        for (let radial = step * 1.25; radial < limit; radial += step * 1.21) {
          if (random() < 0.20) continue;
          const angle = heading - 0.12 * radial + (random() - 0.5) * 0.12;
          leafPoint(angle, radial, small + (large - small) * 0.72 * random(), rib,
            faint + (solid - faint) * random(), 1 - 0.20 * radial);
        }
      }
    }
  }

  for (const { x, y, width: fraction, lean, opening, petals, seed } of FLOWERS) {
    const random = seededRandom(seed);
    const span = fraction * scale;
    const originX = x * width;
    const originY = (1 - y) * height;
    const baseY = originY - span * (petals ? 0.13 : 0.38);
    const stemX = (t) => originX + span * (-lean * t - 0.11 * Math.sin(3.0 * t));
    // A calyx rises with the flower. Separate, fading stem fragments sit below the water.
    for (let i = 0; i < 22; i += 1) {
      const t = (i + random()) / 22;
      const offset = (random() - 0.5) * span * 0.18 * (1 - 0.72 * t);
      afloat.push(stemX(t) + offset, baseY - span * 0.18 * t, (1.4 + random()) * size,
        0.40, 0.63, 0.26, 0.62 - 0.22 * t);
    }
    for (let segment = 0; segment < 3; segment += 1) {
      for (let i = 0; i < 8; i += 1) {
        const t = (segment + 0.64 * (i + random()) / 8) / 3;
        submerged.push(stemX(t) + 3 + (random() - 0.5) * 2, baseY - 5 - span * 0.89 * t,
          (1.55 + 1.05 * random()) * size, 0.32, 0.45, 0.19, 0.37 - 0.26 * t);
      }
    }
    if (petals) {
      // Back petals fan upward. The lower row overlaps their roots around the stamens.
      const petalTips = [
        [-0.49, 0.24], [-0.31, 0.39], [-0.15, 0.54], [0.02, 0.60], [0.23, 0.52],
        [0.49, 0.30], [-0.25, 0.19], [0.24, 0.20]
      ];
      for (let petal = 0; petal < petals; petal += 1) {
        const [tipX, tipY] = petalTips[petal];
        const dx = tipX * opening + lean * tipY;
        const dy = tipY * opening;
        const length = Math.hypot(dx, dy);
        const lengthSteps = Math.ceil(length * fraction * 1536 / 1.75);
        const halfWidth = 0.034 + 0.014 * random();
        for (let row = 0; row < lengthSteps; row += 1) {
          for (let column = -2; column <= 2; column += 1) {
            const t = (row + random()) / lengthSteps;
            const spread = (column + (random() - 0.5) * 0.67) * 0.5 * halfWidth *
              Math.sin(Math.PI * t) ** 0.72;
            const bend = 0.045 * Math.sin(Math.PI * t) * Math.sign(tipX);
            afloat.push(originX + span * (dx * t + bend - dy * spread / length),
              baseY + span * (dy * t + dx * spread / length), (1.8 + 1.10 * random()) * size,
              0.93 + 0.07 * t, 0.48 + 0.38 * t, 0.56 + 0.26 * t, 0.60 + 0.25 * random());
          }
        }
      }
      for (let i = 0; i < 22; i += 1) {
        const angle = turn * random();
        const radial = Math.sqrt(random());
        afloat.push(originX + span * 0.105 * radial * Math.cos(angle),
          baseY + span * (0.14 + 0.065 * radial * Math.sin(angle)), (1.5 + random()) * size,
          0.95, 0.75, 0.32, 0.70 + 0.23 * random());
      }
    } else {
      for (let row = 0; row < 20; row += 1) {
        for (let column = -8; column <= 8; column += 1) {
          const t = (row + random()) / 20;
          const across = (column + random() - 0.5) / 8;
          const breadth = Math.sin(Math.PI * t) ** 0.83 * (1.20 - 0.53 * t);
          if (Math.abs(across) > breadth) continue;
          const seam = Math.cos((across / Math.max(breadth, 0.01) + t * 0.49) * 13);
          const light = 0.75 + 0.16 * random() + 0.16 * Math.max(0, seam);
          const petal = Math.min(1, t * 5);
          afloat.push(originX + span * (across + lean * t) * 0.5,
            originY + span * (1.125 * t - 0.515), (1.55 + 1.35 * random()) * size,
            (0.52 + 0.42 * petal) * light, (0.68 - 0.08 * petal) * light,
            (0.23 + 0.45 * petal) * light, 0.62 + 0.33 * random());
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
