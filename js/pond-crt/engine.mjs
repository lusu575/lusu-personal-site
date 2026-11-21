// PondCRTEngine — High-Performance 120 FPS WebGL2 Multi-Pass CRT Pond Renderer
// Key 120 FPS optimizations:
// 1. Pass 1 (scene) renders at 0.55x resolution (visually identical after 4px phosphor dot quantization -> 3.3x faster)
// 2. Quarter-res Bloom (1/4 W x 1/4 H -> 4x faster, softer authentic CRT halation)
// 3. Lean 640x426 Koi + Ambient Particle canvases uploaded via texSubImage2D (zero texture reallocation!)
// 4. Smart dirty-flag UI Overlay with pre-rendered glow dot sprites (zero ctx.shadowBlur!)

import { AmbientParticleLayer } from './ambient-particles.mjs';
import { FloraLayer } from './flora.mjs';
import { createFBO, createFullscreenVAO, createProgram } from './gl-utils.mjs';
import { KoiLayer } from './koi.mjs';
import { lerpNum, lerpVec3, SEASONS } from './seasons.mjs';
import {
  BLOOM_EXTRACT_FRAG,
  BLUR_FRAG,
  CRT_FINAL_FRAG,
  FULLSCREEN_VERT,
  PHOSPHOR_DOT_FRAG,
  SCENE_FRAG
} from './shaders.mjs';
import { PondUIOverlay } from './ui-overlay.mjs';

const MAX_RIPPLES = 10;

export class PondCRTEngine {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: Boolean(options.preserveDrawingBuffer)
    });

    if (!this.gl) {
      throw new Error('WebGL2 is required for PondCRTEngine');
    }

    this.seasonId = options.season && SEASONS[options.season] ? options.season : 'summer';
    this.fromSeasonId = this.seasonId;
    this.seasonTransitionStart = -10;
    this.seasonTransitionDuration = 1.90;
    this._draggingSlider = false;
    this.onNavigate = options.onNavigate || null;
    this.onAccountClick = options.onAccountClick || null;
    this.onLanguageChange = options.onLanguageChange || null;
    this.onFpsUpdate = options.onFpsUpdate || null;
    this.startTime = performance.now();
    this.lastFrameTime = 0;
    this.elapsed = 0;
    this.rafId = 0;
    this.running = false;
    this.width = 0;
    this.height = 0;
    this.dpr = 1;

    // FPS telemetry
    this._fpsFrames = 0;
    this._fpsLastTs = performance.now();
    this.currentFps = 0;

    this.crtConfig = {
      curvature: 0.068,
      dotPitchCssPx: 4.1,
      scanlinePitchCssPx: 3.6,
      bloomThreshold: 0.30,
      bloomIntensity: 0.62,
      chromaticEdge: 0.0115
    };

    this.ripples = [];
    this.rippleUniformData = new Float32Array(MAX_RIPPLES * 4);
    this._seedAmbientRipples();

    this.floraLayer = new FloraLayer();
    this.floraPrevLayer = new FloraLayer();
    this.floraTex = this._createDynamicTexture();
    this.floraPrevTex = this._createDynamicTexture();
    this.sweepOrigin = [0.86, 0.93];

    this.koiLayer = new KoiLayer();
    this.koiTex = this._createDynamicTexture();
    this._koiTexSize = [0, 0];

    this.ambientLayer = new AmbientParticleLayer();
    this.ambientTex = this._createDynamicTexture();
    this._ambientTexSize = [0, 0];

    this.uiOverlay = new PondUIOverlay({
      season: this.seasonId,
      lang: options.lang || 'zh',
      demoClock: options.demoClock ?? false,
      accountLabel: options.accountLabel || 'ID'
    });
    this.uiTex = this._createDynamicTexture();
    this._uiTexSize = [0, 0];

    this._initPrograms();
    this.vao = createFullscreenVAO(this.gl);
    this.fbos = {};
    this.resize();
    this._bindInteractions();
  }

  _seedAmbientRipples() {
    // Calm, restrained initial wake (one gentle ripple per koi zone — never noisy!)
    const mult = this.seasonId === 'winter' ? 0.38 : 0.62;
    this.ripples.push(
      { x: 0.45, y: 0.46, born: -1.1, strength: mult },
      { x: 0.62, y: 0.56, born: -1.8, strength: mult * 0.85 }
    );
  }

  _createDynamicTexture() {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return tex;
  }

  // Fast GPU texture upload: allocates once with texImage2D, then uses zero-alloc texSubImage2D!
  _uploadCanvasFast(tex, canvas, sizeTracker) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    if (sizeTracker[0] !== canvas.width || sizeTracker[1] !== canvas.height) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
      sizeTracker[0] = canvas.width;
      sizeTracker[1] = canvas.height;
    } else {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    }
  }

  _uploadFlora() {
    const gl = this.gl;
    const floraCanvas = this.floraLayer.render(this.seasonId, this.cssWidth, this.cssHeight);
    gl.bindTexture(gl.TEXTURE_2D, this.floraTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, floraCanvas);

    const prevCanvas = this.floraPrevLayer.render(this.fromSeasonId, this.cssWidth, this.cssHeight);
    gl.bindTexture(gl.TEXTURE_2D, this.floraPrevTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, prevCanvas);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  // Optional hook to plug in transparent PNG botanical assets per season
  loadFloraAsset(seasonId, url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.floraLayer.setCustomAsset(seasonId, img);
        this.floraPrevLayer.setCustomAsset(seasonId, img);
        if (this.seasonId === seasonId || this.fromSeasonId === seasonId) {
          this._uploadFlora();
        }
        resolve(img);
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  _initPrograms() {
    const gl = this.gl;
    this.programs = {
      scene: createProgram(gl, FULLSCREEN_VERT, SCENE_FRAG),
      phosphor: createProgram(gl, FULLSCREEN_VERT, PHOSPHOR_DOT_FRAG),
      bloomExtract: createProgram(gl, FULLSCREEN_VERT, BLOOM_EXTRACT_FRAG),
      blur: createProgram(gl, FULLSCREEN_VERT, BLUR_FRAG),
      crtFinal: createProgram(gl, FULLSCREEN_VERT, CRT_FINAL_FRAG)
    };
  }

  _screenToWarpedUv(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = (clientX - rect.left) / Math.max(1, rect.width);
    const sy = (clientY - rect.top) / Math.max(1, rect.height);
    const px = sx * 2.0 - 1.0;
    const py = sy * 2.0 - 1.0;
    const r2 = px * px + py * py;
    const k = this.crtConfig.curvature;
    const norm = 1.0 / (1.0 + k * 0.92);
    const factor = (1.0 + k * r2 + (k * 0.28) * r2 * r2) * norm;
    return {
      nx: (px * factor) * 0.5 + 0.5,
      ny: (py * factor) * 0.5 + 0.5
    };
  }

  _bindInteractions() {
    this._onPointerMove = (e) => {
      const { nx, ny } = this._screenToWarpedUv(e.clientX, e.clientY);
      const hit = this.uiOverlay.hitTest(nx, ny);

      // Support smooth dragging across the top-right season slider (matching Video 1!)
      if (this._draggingSlider && hit && hit.type === 'season') {
        if (hit.seasonId !== this.seasonId) {
          this.setSeason(hit.seasonId, nx, ny);
        }
        return;
      }

      const prevCorner = this.uiOverlay.cornerHover;
      if (hit && hit.type === 'icon') {
        this.uiOverlay.setIconHover(hit.icon.id, true);
        this.uiOverlay.cornerHover = null;
        this.canvas.style.cursor = 'pointer';
      } else if (hit && hit.type === 'season') {
        this.uiOverlay.setIconHover(null, false);
        this.uiOverlay.cornerHover = null;
        this.canvas.style.cursor = 'pointer';
      } else if (hit && (hit.type === 'account' || hit.type === 'lang')) {
        this.uiOverlay.setIconHover(null, false);
        this.uiOverlay.cornerHover = hit.type === 'account' ? 'account' : hit.lang;
        this.canvas.style.cursor = 'pointer';
      } else {
        this.uiOverlay.setIconHover(null, false);
        this.uiOverlay.cornerHover = null;
        this.canvas.style.cursor = 'default';
      }
      if (prevCorner !== this.uiOverlay.cornerHover) {
        this.uiOverlay.markDirty();
      }
    };

    this._onPointerUp = () => {
      this._draggingSlider = false;
    };

    this._onPointerDown = (e) => {
      const { nx, ny } = this._screenToWarpedUv(e.clientX, e.clientY);
      const hit = this.uiOverlay.hitTest(nx, ny);
      if (hit && hit.type === 'season') {
        this._draggingSlider = true;
        this.setSeason(hit.seasonId, nx, ny);
        return;
      }
      if (hit && hit.type === 'icon') {
        this.uiOverlay.triggerIconClick(hit.icon.id);
        this.spawnRipple(hit.icon.x, 1.0 - hit.icon.y, 1.05);
        if (this.onNavigate) this.onNavigate(hit.icon.route, hit.icon.id);
        return;
      }
      if (hit && hit.type === 'account') {
        if (this.onAccountClick) this.onAccountClick();
        return;
      }
      if (hit && hit.type === 'lang') {
        this.uiOverlay.setLanguage(hit.lang);
        if (this.onLanguageChange) this.onLanguageChange(hit.lang);
        return;
      }
      this.spawnRipple(nx, 1.0 - ny, 1.25);
    };

    this.canvas.addEventListener('pointermove', this._onPointerMove);
    this.canvas.addEventListener('pointerdown', this._onPointerDown);
    window.addEventListener('pointerup', this._onPointerUp);
  }

  spawnRipple(uvX, uvY, strength = 1.0) {
    this.ripples.push({
      x: Math.max(0.02, Math.min(0.98, uvX)),
      y: Math.max(0.02, Math.min(0.98, uvY)),
      born: this.elapsed,
      strength
    });
    if (this.ripples.length > MAX_RIPPLES) {
      this.ripples.shift();
    }
  }

  _updateRipples(t) {
    this.ripples = this.ripples.filter((r) => (t - r.born) < 4.8);

    const data = this.rippleUniformData;
    data.fill(0);
    const count = Math.min(MAX_RIPPLES, this.ripples.length);
    for (let i = 0; i < count; i++) {
      const r = this.ripples[i];
      data[i * 4 + 0] = r.x;
      data[i * 4 + 1] = r.y;
      data[i * 4 + 2] = t - r.born;
      data[i * 4 + 3] = r.strength;
    }
    return count;
  }

  _destroyFBOs() {
    for (const key of Object.keys(this.fbos)) {
      this.fbos[key]?.destroy();
    }
    this.fbos = {};
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const cssW = Math.max(320, Math.round(rect.width || window.innerWidth));
    const cssH = Math.max(240, Math.round(rect.height || window.innerHeight));
    // Cap DPR at 1.5 for rock-solid 120 FPS on 4K/Retina screens while keeping crisp CRT scanlines
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.round(cssW * dpr);
    const h = Math.round(cssH * dpr);

    if (w === this.width && h === this.height && dpr === this.dpr) return;

    this.cssWidth = cssW;
    this.cssHeight = cssH;
    this.dpr = dpr;
    this.width = w;
    this.height = h;
    this.canvas.width = w;
    this.canvas.height = h;

    const gl = this.gl;
    this._destroyFBOs();

    // 120 FPS Resolution Scaling:
    // - Pass 1 (scene): 0.55x resolution (quantized into ~4px dots in Pass 4 anyway -> 3.3x faster, identical visuals!)
    // - Pass 4 (phosphor): full output resolution for razor-sharp phosphor dots
    // - Bloom: 1/4 resolution for silky wide CRT halation at 4x speed!
    const sceneW = Math.max(360, Math.round(w * 0.55));
    const sceneH = Math.max(240, Math.round(h * 0.55));
    const bloomW = Math.max(120, w >> 2);
    const bloomH = Math.max(80, h >> 2);

    this.fbos = {
      scene: createFBO(gl, sceneW, sceneH),
      phosphor: createFBO(gl, w, h),
      bloomA: createFBO(gl, bloomW, bloomH),
      bloomB: createFBO(gl, bloomW, bloomH)
    };

    this._uploadFlora();
    this.uiOverlay.markDirty();
  }

  setSeason(seasonId, originNx = 0.86, originNy = 0.072) {
    if (SEASONS[seasonId] && seasonId !== this.seasonId) {
      const prev = this.seasonId;
      this.fromSeasonId = prev;
      this.seasonId = seasonId;
      this.seasonTransitionStart = this.elapsed;
      this.sweepOrigin = [0.50, 0.48];
      this.uiOverlay.setSeason(seasonId, this.elapsed);
      this.ambientLayer.triggerSeasonGust(seasonId);
      // Launch Video 1 Stardust Ribbon -> Pond-Center Spiral Vortex FX (zero cheap corner white flash!)
      this.ambientLayer.triggerSeasonTransitionFX(prev, seasonId, originNx, originNy, this.elapsed);
      // Gentle expanding water ripple from pond center synced with stardust ribbon landing
      setTimeout(() => {
        if (this.running) this.spawnRipple(0.50, 0.48, 1.15);
      }, 420);
      this._uploadFlora();
    }
  }

  _getInterpolatedSeason(t) {
    const a = SEASONS[this.fromSeasonId] || SEASONS.summer;
    const b = SEASONS[this.seasonId] || SEASONS.summer;
    const rawP = Math.max(0, Math.min(1, (t - this.seasonTransitionStart) / this.seasonTransitionDuration));
    if (rawP >= 1 || a === b) return b;
    // Palette blooms smoothly as the stardust ribbon hits pond center (0.24..0.92)
    const p = Math.max(0, Math.min(1, (rawP - 0.24) / 0.68));
    const s = p * p * (3 - 2 * p);
    return {
      waterDeep: lerpVec3(a.waterDeep, b.waterDeep, s),
      waterMid: lerpVec3(a.waterMid, b.waterMid, s),
      waterAccent: lerpVec3(a.waterAccent, b.waterAccent, s),
      causticTint: lerpVec3(a.causticTint, b.causticTint, s),
      specularTint: lerpVec3(a.specularTint, b.specularTint, s),
      glowColumnX: lerpNum(a.glowColumnX, b.glowColumnX, s),
      glowColumnWidth: lerpNum(a.glowColumnWidth, b.glowColumnWidth, s),
      causticStrength: lerpNum(a.causticStrength, b.causticStrength, s),
      shimmerSpeed: lerpNum(a.shimmerSpeed, b.shimmerSpeed, s),
      koiDepthFog: lerpNum(a.koiDepthFog, b.koiDepthFog, s)
    };
  }

  render(timeSec) {
    const gl = this.gl;
    const nowMs = performance.now();
    const t = Number.isFinite(timeSec) ? timeSec : (nowMs - this.startTime) * 0.001;
    const dt = Math.min(0.05, Math.max(0.001, t - this.lastFrameTime));
    this.lastFrameTime = t;
    this.elapsed = t;

    // FPS tracking
    this._fpsFrames++;
    if (nowMs - this._fpsLastTs >= 500) {
      this.currentFps = Math.round((this._fpsFrames * 1000) / (nowMs - this._fpsLastTs));
      this._fpsFrames = 0;
      this._fpsLastTs = nowMs;
      if (this.onFpsUpdate) this.onFpsUpdate(this.currentFps);
    }

    const season = this._getInterpolatedSeason(t);
    const rippleCount = this._updateRipples(t);

    // Update lean underwater koi canvas & fast-upload via texSubImage2D
    const koiCanvas = this.koiLayer.render(t, this.cssWidth, this.cssHeight, this.seasonId, (rx, ry, str) => {
      this.spawnRipple(rx, ry, str);
    });
    this._uploadCanvasFast(this.koiTex, koiCanvas, this._koiTexSize);

    // Update lean dynamic seasonal ambient particles (falling petals, autumn leaves, snow)
    const ambCanvas = this.ambientLayer.render(t, dt, this.cssWidth, this.cssHeight, this.seasonId, (rx, ry, str) => {
      this.spawnRipple(rx, ry, str);
    });
    this._uploadCanvasFast(this.ambientTex, ambCanvas, this._ambientTexSize);

    gl.bindVertexArray(this.vao);

    // --- Pass 1-3: Water + Koi + Ripples + Flora + Ambient Particles (0.55x res for 120 FPS!) ---
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbos.scene.fbo);
    gl.viewport(0, 0, this.fbos.scene.width, this.fbos.scene.height);
    gl.useProgram(this.programs.scene.program);
    const su = this.programs.scene.uniforms;
    const sweepP = Math.max(0, Math.min(1, (t - this.seasonTransitionStart) / this.seasonTransitionDuration));
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.floraTex);
    gl.uniform1i(su.uFloraTex, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.koiTex);
    gl.uniform1i(su.uKoiTex, 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.floraPrevTex);
    gl.uniform1i(su.uFloraPrevTex, 2);
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, this.ambientTex);
    gl.uniform1i(su.uAmbientTex, 3);
    gl.uniform1f(su.uSeasonSweep, sweepP);
    gl.uniform2f(su.uSweepOrigin, this.sweepOrigin[0], this.sweepOrigin[1]);
    gl.uniform2f(su.uResolution, this.fbos.scene.width, this.fbos.scene.height);
    gl.uniform1f(su.uTime, t);
    gl.uniform3fv(su.uWaterDeep, season.waterDeep);
    gl.uniform3fv(su.uWaterMid, season.waterMid);
    gl.uniform3fv(su.uWaterAccent, season.waterAccent);
    gl.uniform3fv(su.uCausticTint, season.causticTint);
    gl.uniform3fv(su.uSpecularTint, season.specularTint);
    gl.uniform1f(su.uGlowColumnX, season.glowColumnX);
    gl.uniform1f(su.uGlowColumnWidth, season.glowColumnWidth);
    gl.uniform1f(su.uCausticStrength, season.causticStrength);
    gl.uniform1f(su.uShimmerSpeed, season.shimmerSpeed);
    gl.uniform1f(su.uKoiDepthFog, season.koiDepthFog);
    gl.uniform4fv(su.uRipples, this.rippleUniformData);
    gl.uniform1i(su.uRippleCount, rippleCount);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // --- Pass 4: Unified Phosphor-Dot Quantization ---
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbos.phosphor.fbo);
    gl.viewport(0, 0, this.width, this.height);
    gl.useProgram(this.programs.phosphor.program);
    const pu = this.programs.phosphor.uniforms;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.fbos.scene.texture);
    gl.uniform1i(pu.uSceneTex, 0);
    gl.uniform2f(pu.uResolution, this.width, this.height);
    gl.uniform1f(pu.uTime, t);
    gl.uniform1f(pu.uDotPitchPx, this.crtConfig.dotPitchCssPx * this.dpr);
    gl.uniform4fv(pu.uRipples, this.rippleUniformData);
    gl.uniform1i(pu.uRippleCount, rippleCount);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // --- Pass 6a: Quarter-Res Bloom Extract + Single-Stage Wide Separable Blur (4x faster!) ---
    const bw = this.fbos.bloomA.width;
    const bh = this.fbos.bloomA.height;

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbos.bloomA.fbo);
    gl.viewport(0, 0, bw, bh);
    gl.useProgram(this.programs.bloomExtract.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.fbos.phosphor.texture);
    gl.uniform1i(this.programs.bloomExtract.uniforms.uTex, 0);
    gl.uniform1f(this.programs.bloomExtract.uniforms.uThreshold, this.crtConfig.bloomThreshold);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbos.bloomB.fbo);
    gl.useProgram(this.programs.blur.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.fbos.bloomA.texture);
    gl.uniform1i(this.programs.blur.uniforms.uTex, 0);
    gl.uniform2f(this.programs.blur.uniforms.uTexelSize, 1.8 / bw, 1.8 / bh);
    gl.uniform2f(this.programs.blur.uniforms.uDirection, 1.0, 0.0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbos.bloomA.fbo);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.fbos.bloomB.texture);
    gl.uniform2f(this.programs.blur.uniforms.uDirection, 0.0, 1.0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // Smart dirty-flag UI overlay update (only uploads when updated!)
    const uiRes = this.uiOverlay.render(t, dt, this.cssWidth, this.cssHeight);
    if (uiRes.updated) {
      this._uploadCanvasFast(this.uiTex, uiRes.canvas, this._uiTexSize);
    }

    // --- Pass 6b: Final CRT Optical Post-Process ---
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.width, this.height);
    gl.useProgram(this.programs.crtFinal.program);
    const cu = this.programs.crtFinal.uniforms;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.fbos.phosphor.texture);
    gl.uniform1i(cu.uSceneTex, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.fbos.bloomA.texture);
    gl.uniform1i(cu.uBloomTex, 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.uiTex);
    gl.uniform1i(cu.uUiTex, 2);
    gl.uniform2f(cu.uResolution, this.width, this.height);
    gl.uniform1f(cu.uTime, t);
    gl.uniform1f(cu.uCurvature, this.crtConfig.curvature);
    gl.uniform1f(cu.uScanlineCount, Math.max(160, this.cssHeight / this.crtConfig.scanlinePitchCssPx));
    gl.uniform1f(cu.uBloomIntensity, this.crtConfig.bloomIntensity);
    gl.uniform1f(cu.uChromaticEdge, this.crtConfig.chromaticEdge);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.bindVertexArray(null);
  }

  start() {
    if (this.running) return;
    this.running = true;
    const tick = () => {
      if (!this.running) return;
      this.render();
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  stop() {
    this.running = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  destroy() {
    this.stop();
    if (this._onPointerMove) this.canvas.removeEventListener('pointermove', this._onPointerMove);
    if (this._onPointerDown) this.canvas.removeEventListener('pointerdown', this._onPointerDown);
    if (this._onPointerUp) window.removeEventListener('pointerup', this._onPointerUp);
    this._destroyFBOs();
    const gl = this.gl;
    gl.deleteTexture(this.floraTex);
    gl.deleteTexture(this.floraPrevTex);
    gl.deleteTexture(this.koiTex);
    gl.deleteTexture(this.ambientTex);
    gl.deleteTexture(this.uiTex);
    for (const p of Object.values(this.programs)) {
      gl.deleteProgram(p.program);
    }
    gl.deleteVertexArray(this.vao);
  }
}
