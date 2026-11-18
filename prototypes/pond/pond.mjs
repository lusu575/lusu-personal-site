import { Koi } from "./fish.mjs";
import {
  CRT, WATER, fullscreenVertex, fishVertex, fishFragment, waterFragment, desktopFragment, crtFragment
} from "./shaders.mjs";

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

function createRenderer(gl) {
  const fish = createProgram(gl, fishVertex, fishFragment, ["uSize", "uDpr"]);
  const water = createProgram(gl, fullscreenVertex, waterFragment, [
    "uSize", "uFish", "uTime", "uClickCount", "uWakeCount", "uClicks[0]", "uWakes[0]"
  ]);
  const desktop = createProgram(gl, fullscreenVertex, desktopFragment, ["uSize", "uWater", "uClock", "uClockSize", "uGrid"]);
  const crt = createProgram(gl, fullscreenVertex, crtFragment, ["uSize", "uDesktop", "uCRT"]);
  const fishTarget = createTarget(gl);
  const waterTarget = createTarget(gl);
  const sceneTarget = createTarget(gl);
  const clock = createClock(gl);

  const points = gl.createBuffer();
  const fishVAO = gl.createVertexArray();
  gl.bindVertexArray(fishVAO);
  gl.bindBuffer(gl.ARRAY_BUFFER, points);
  gl.bufferData(gl.ARRAY_BUFFER, koi.vertices.byteLength, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 7 * 4, 0);
  gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 7 * 4, 3 * 4);
  gl.bindVertexArray(null);

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

  function fit() {
    const nextWidth = Math.max(1, canvas.clientWidth);
    const nextHeight = Math.max(1, canvas.clientHeight);
    const nextDensity = Math.min(browser.devicePixelRatio || 1, 2, limit / Math.max(nextWidth, nextHeight));
    if (nextWidth === width && nextHeight === height && nextDensity === density) return;
    if (nextWidth !== koi.width || nextHeight !== koi.height) koi.resize(nextWidth, nextHeight);
    width = nextWidth;
    height = nextHeight;
    density = nextDensity;
    canvas.width = Math.max(1, Math.round(width * density));
    canvas.height = Math.max(1, Math.round(height * density));
    fishTarget.resize(canvas.width, canvas.height);
    waterTarget.resize(
      Math.max(1, Math.round(canvas.width * WATER.scale)),
      Math.max(1, Math.round(canvas.height * WATER.scale))
    );
    sceneTarget.resize(canvas.width, canvas.height);
  }

  function draw() {
    const fishUniforms = begin(fish, fishTarget);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindVertexArray(fishVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, points);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, koi.drawData(time));
    gl.uniform1f(fishUniforms.uDpr, density);
    gl.drawArrays(gl.POINTS, 0, koi.particles.length);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);

    const waterUniforms = begin(water, waterTarget);
    sample(0, waterUniforms.uFish, fishTarget.texture);
    gl.uniform1f(waterUniforms.uTime, time);
    for (const [packets, count, data] of [
      [clicks, waterUniforms.uClickCount, waterUniforms["uClicks[0]"]],
      [wakes, waterUniforms.uWakeCount, waterUniforms["uWakes[0]"]]
    ]) {
      gl.uniform1i(count, packets.events.length);
      if (packets.events.length) gl.uniform4fv(data, packets.pack(width, height), 0, packets.events.length * 4);
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

  constructor(capacity, lifetime) {
    this.capacity = capacity;
    this.lifetime = lifetime;
    this.packed = new Float32Array(capacity * 4);
  }

  add(x, y, start, strength) {
    if (this.events.length === this.capacity) this.events.shift();
    this.events.push({ x, y, start, strength });
  }

  expire(time) {
    while (this.events.length && time - this.events[0].start >= this.lifetime) this.events.shift();
  }

  pack(width, height) {
    const short = Math.min(width, height);
    let index = 0;
    for (const event of this.events) {
      this.packed[index++] = event.x * width / short;
      this.packed[index++] = event.y * height / short;
      this.packed[index++] = event.start;
      this.packed[index++] = event.strength;
    }
    return this.packed;
  }
}

const koi = new Koi();
const clicks = new WavePackets(WATER.clickCapacity, WATER.clickLifetime);
const wakes = new WavePackets(WATER.wakeCapacity, WATER.wakeLifetime);
let frozen = params.get("freeze") === "1";
let crtEnabled = params.get("crt") !== "0";
let gridEnabled = params.get("grid") === "1";
let time = 0;
let previousFrame;
let requested = 0;
let renderer;
let gl;

function incomingYaw() {
  const short = Math.min(koi.width, koi.height);
  let yaw = 0;
  for (const click of clicks.events) {
    const age = time - click.start;
    if (age <= WATER.clickSink) continue;
    const x = koi.headX - click.x * koi.width;
    const y = koi.headY - click.y * koi.height;
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
  wakes.expire(time);
  if (koi.advance(dt, incomingYaw())) {
    const [x, y] = koi.peduncle;
    wakes.add(x / koi.width, y / koi.height, time, koi.beating ? 0.36 : 0.14);
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
