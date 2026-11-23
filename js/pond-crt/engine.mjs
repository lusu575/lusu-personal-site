// PondCRTEngine — Ultra-Fast 120+ FPS Zero-Stall WebGL2 Renderer
// Architecture:
// - ZERO per-frame texSubImage2D(HTMLCanvasElement) stalls!
//   * Koi rendered 100% on GPU (KoiGLRenderer triangle mesh, ~6KB bufferSubData)
//   * Ambient petals/maple/snow + Video-1 stardust vortex rendered 100% on GPU (ParticlesGLRenderer gl.POINTS)
//   * Flora static texture uploaded ONCE on season change
//   * UI Overlay dirty-flag uploaded ONLY when hovering/clicking/morphing (0 uploads/sec at idle!)
// - Fused 3-Pass Pipeline:
//   * Pass 1: 0.50x sceneFBO (Water -> GPU Koi -> Surface Ripples & Flora -> GPU Particles)
//   * Pass 2: 0.25x Bloom Extract + H/V Blur
//   * Pass 3: 1.0x FUSED CRT + Phosphor-Dot + UI + Scanlines (ONE fullscreen pass!)
// - preserveDrawingBuffer: false by default (zero backbuffer copy!)

import { FloraLayer } from './flora.mjs';
import { createFBO, createFullscreenVAO, createProgram } from './gl-utils.mjs';
import { KoiGLRenderer } from './koi-gl.mjs';
import { ParticlesGLRenderer } from './particles-gl.mjs?v=20261122-pond-polish-r1';
import { lerpNum, lerpVec3, SEASON_ORDER, SEASONS } from './seasons.mjs';
import {
  BLOOM_EXTRACT_FRAG,
  BLUR_FRAG,
  CRT_PHOSPHOR_FINAL_FRAG,
  FULLSCREEN_VERT,
  SURFACE_OVERLAY_FRAG,
  WATER_BG_FRAG
} from './shaders.mjs';
import { PondUIOverlay } from './ui-overlay.mjs?v=20261123-pond-polish-r51';

const MAX_RIPPLES = 8;

export class PondCRTEngine {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'high-performance',
      desynchronized: true,
      preserveDrawingBuffer: Boolean(options.preserveDrawingBuffer)
    });

    if (!this.gl) {
      throw new Error('WebGL2 is required for PondCRTEngine');
    }

    this.seasonId = options.season && SEASONS[options.season] ? options.season : 'summer';
    this.fromSeasonId = this.seasonId;
    this.visualSeasonId = this.seasonId;
    this.seasonTransitionStart = -10;
    this.seasonGatherDuration = 0.55;
    this.seasonRevealDuration = 1.35;
    this.seasonTransitionDuration = 1.90;
    this.transitionPhase = 'idle'; // 'idle' | 'gather' | 'reveal'
    this._revealRippleFired = false;
    // Two-stage interruptible live state:
    // Stage 1 (gather): particles stream & converge first while current scene holds steady.
    // Stage 2 (reveal): vortex blooms outward and scene smoothly eases from exact live snapshot to target.
    // Interrupting mid-transition snapshots current live frame -> ZERO snap, ZERO flash, ZERO queue!
    this.livePalette = this._cloneSeasonPalette(this.seasonId);
    this.revealStartPalette = this._cloneSeasonPalette(this.seasonId);
    this.liveWeights = this._seasonToWeights(this.seasonId);
    this.revealStartWeights = this._seasonToWeights(this.seasonId);
    this.targetWeights = this._seasonToWeights(this.seasonId);
    this._pendingAmbientSeason = null;
    this._draggingSlider = false;
    this.onNavigate = options.onNavigate || null;
    this.onAccountClick = options.onAccountClick || null;
    this.onWelcomeClick = options.onWelcomeClick || null;
    this.onLanguageChange = options.onLanguageChange || null;
    this.onSeasonChange = options.onSeasonChange || null;
    this.onFpsUpdate = options.onFpsUpdate || null;
    this.startTime = performance.now();
    this.lastFrameTime = 0;
    this.elapsed = 0;
    this.rafId = 0;
    this.running = false;
    this.width = 0;
    this.height = 0;
    this.dpr = 1;

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
    // Pre-baked GPU textures for ALL 4 seasons -> ZERO stutter / ZERO texImage2D upload on season switch!
    this.floraTextures = {};
    for (const sId of SEASON_ORDER) {
      this.floraTextures[sId] = this._createDynamicTexture();
    }

    // Pure GPU Koi & Ambient/Stardust Particles (ZERO Canvas2D per-frame upload stalls!)
    this.koiGL = new KoiGLRenderer(this.gl);
    this.particlesGL = new ParticlesGLRenderer(this.gl);

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
    this._loadAssetManifest();
    this._bindInteractions();
  }

  async _loadAssetManifest() {
    try {
      const res = await fetch('/assets/pond-assets-manifest.json', { cache: 'no-store' });
      if (!res.ok) return;
      const manifest = await res.json();

      // 1. Load all finalized transparent PNG parts (design-assets/parts/*) in parallel,
      // then re-bake all 4 resident GPU flora textures cleanly once loaded!
      if (manifest.parts) {
        const entries = Object.entries(manifest.parts).filter(([, url]) => Boolean(url));
        const loaded = await Promise.allSettled(
          entries.map(([key, url]) => new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
              this.floraLayer.setPart(key, img);
              resolve(key);
            };
            img.onerror = reject;
            img.src = url;
          }))
        );
        if (this.gl && loaded.some((r) => r.status === 'fulfilled')) {
          this._prebakeAllFlora();
        }
      }

      // 2. Desktop icon transparent PNG slots (knowledge, videos, resources, games, chatroom, about)
      if (manifest.icons) {
        for (const [iconId, url] of Object.entries(manifest.icons)) {
          if (url) {
            this.loadIconAsset(iconId, url).catch(() => {});
          }
        }
      }
    } catch {
      // Manifest optional
    }
  }

  loadIconAsset(iconId, url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.uiOverlay.setIconAsset(iconId, img);
        resolve(img);
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  _seedAmbientRipples() {
    const mult = this.seasonId === 'winter' ? 0.32 : 0.56;
    this.ripples.push(
      { x: 0.45, y: 0.46, born: -1.1, strength: mult },
      { x: 0.62, y: 0.56, born: -1.8, strength: mult * 0.82 }
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

  _prebakeAllFlora() {
    const gl = this.gl;
    for (const sId of SEASON_ORDER) {
      const floraCanvas = this.floraLayer.render(sId, this.cssWidth, this.cssHeight);
      gl.bindTexture(gl.TEXTURE_2D, this.floraTextures[sId]);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, floraCanvas);
    }
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  loadFloraAsset(seasonId, url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.floraLayer.setCustomAsset(seasonId, img);
        const floraCanvas = this.floraLayer.render(seasonId, this.cssWidth, this.cssHeight);
        const gl = this.gl;
        gl.bindTexture(gl.TEXTURE_2D, this.floraTextures[seasonId]);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, floraCanvas);
        gl.bindTexture(gl.TEXTURE_2D, null);
        resolve(img);
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  _initPrograms() {
    const gl = this.gl;
    this.programs = {
      waterBg: createProgram(gl, FULLSCREEN_VERT, WATER_BG_FRAG),
      surfaceOverlay: createProgram(gl, FULLSCREEN_VERT, SURFACE_OVERLAY_FRAG),
      bloomExtract: createProgram(gl, FULLSCREEN_VERT, BLOOM_EXTRACT_FRAG),
      blur: createProgram(gl, FULLSCREEN_VERT, BLUR_FRAG),
      crtFinal: createProgram(gl, FULLSCREEN_VERT, CRT_PHOSPHOR_FINAL_FRAG)
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
      } else if (hit && (hit.type === 'season' || hit.type === 'clock')) {
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
      if (hit && hit.type === 'clock') {
        if (this.onWelcomeClick) this.onWelcomeClick();
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
    this.ripples = this.ripples.filter((r) => (t - r.born) < 4.6);
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
    // 1.0x CSS resolution -> razor-sharp 4px CRT phosphor dots & 2.25x fewer pixels for locked 120 FPS!
    const dpr = 1.0;
    const w = cssW;
    const h = cssH;

    if (w === this.width && h === this.height) return;

    this.cssWidth = cssW;
    this.cssHeight = cssH;
    this.dpr = dpr;
    this.width = w;
    this.height = h;
    this.canvas.width = w;
    this.canvas.height = h;

    const gl = this.gl;
    this._destroyFBOs();

    const sceneW = Math.max(360, Math.round(w * 0.50));
    const sceneH = Math.max(240, Math.round(h * 0.50));
    const bloomW = Math.max(120, w >> 2);
    const bloomH = Math.max(80, h >> 2);

    this.fbos = {
      scene: createFBO(gl, sceneW, sceneH),
      bloomA: createFBO(gl, bloomW, bloomH),
      bloomB: createFBO(gl, bloomW, bloomH)
    };

    this._prebakeAllFlora();
    this.uiOverlay.markDirty();
  }

  _cloneSeasonPalette(seasonId) {
    const s = SEASONS[seasonId] || SEASONS.summer;
    return {
      waterDeep: [...s.waterDeep],
      waterMid: [...s.waterMid],
      waterAccent: [...s.waterAccent],
      causticTint: [...s.causticTint],
      specularTint: [...s.specularTint],
      glowColumnX: s.glowColumnX,
      glowColumnWidth: s.glowColumnWidth,
      causticStrength: s.causticStrength,
      shimmerSpeed: s.shimmerSpeed,
      koiDepthFog: s.koiDepthFog,
      winterMode: seasonId === 'winter' ? 1.0 : 0.0
    };
  }

  _copyPalette(p) {
    return {
      waterDeep: [...p.waterDeep],
      waterMid: [...p.waterMid],
      waterAccent: [...p.waterAccent],
      causticTint: [...p.causticTint],
      specularTint: [...p.specularTint],
      glowColumnX: p.glowColumnX,
      glowColumnWidth: p.glowColumnWidth,
      causticStrength: p.causticStrength,
      shimmerSpeed: p.shimmerSpeed,
      koiDepthFog: p.koiDepthFog,
      winterMode: p.winterMode
    };
  }

  _seasonToWeights(seasonId) {
    return [
      seasonId === 'spring' ? 1 : 0,
      seasonId === 'summer' ? 1 : 0,
      seasonId === 'autumn' ? 1 : 0,
      seasonId === 'winter' ? 1 : 0
    ];
  }

  setSeason(seasonId, originNx = 0.86, originNy = 0.072, { manual = true } = {}) {
    if (SEASONS[seasonId] && seasonId !== this.seasonId) {
      const prev = this.seasonId;
      const wasInTransition = this.transitionPhase !== 'idle';
      this.fromSeasonId = prev;
      this.seasonId = seasonId;

      // Snapshot the EXACT current live visual state so interruption NEVER snaps, blinks, or rewinds!
      this.revealStartPalette = this._copyPalette(this.livePalette);
      this.revealStartWeights = [...this.liveWeights];
      this.targetWeights = this._seasonToWeights(seasonId);

      // Stage 1 (gather): particles converge first while scene holds steady; shorter when interrupting for snappy feel
      this.seasonGatherDuration = wasInTransition ? 0.36 : 0.55;
      this.seasonRevealDuration = 1.35;
      this.seasonTransitionDuration = this.seasonGatherDuration + this.seasonRevealDuration;
      this.seasonTransitionStart = this.elapsed;
      this.transitionPhase = 'gather';
      this._revealRippleFired = false;

      // Smoothly fade old ambient particles (zero pop!) & launch luminous interruptible stardust ribbon
      this.particlesGL.fadeOutAmbient();
      this._pendingAmbientSeason = seasonId;
      this.uiOverlay.setSeason(seasonId, this.elapsed);
      this.particlesGL.triggerSeasonTransitionFX(
        prev,
        seasonId,
        originNx,
        1.0 - originNy,
        this.elapsed,
        this.seasonGatherDuration,
        this.seasonRevealDuration
      );
      if (typeof this.onSeasonChange === 'function') {
        this.onSeasonChange(seasonId, { manual });
      }
    }
  }

  setLanguage(lang) {
    if (this.uiOverlay && typeof this.uiOverlay.setLanguage === 'function') {
      this.uiOverlay.setLanguage(lang);
    }
  }

  _stepContinuousSeason(t) {
    if (this.transitionPhase === 'idle') {
      return { palette: this.livePalette, revealSweepP: 1.0, inTransition: false };
    }

    const elapsed = Math.max(0, t - this.seasonTransitionStart);
    const gatherDur = this.seasonGatherDuration;
    const revealDur = this.seasonRevealDuration;

    // Stage 1: Particle ribbon streams & converges to pond center — hold current scene steady (NO early jump!)
    if (elapsed < gatherDur) {
      this.transitionPhase = 'gather';
      return { palette: this.livePalette, revealSweepP: 0.0, inTransition: true };
    }

    // Stage 2: Particles arrived -> fire pond-center ripple & smoothly reveal target season from exact snapshot!
    this.transitionPhase = 'reveal';
    if (!this._revealRippleFired) {
      this._revealRippleFired = true;
      this.spawnRipple(0.50, 0.48, 1.25);
    }

    const u = Math.min(1.0, (elapsed - gatherDur) / Math.max(0.01, revealDur));
    const e = u * u * (3.0 - 2.0 * u); // C1 smoothstep easing
    const startP = this.revealStartPalette;
    const targetP = this._cloneSeasonPalette(this.seasonId);
    const p = this.livePalette;

    p.waterDeep = lerpVec3(startP.waterDeep, targetP.waterDeep, e);
    p.waterMid = lerpVec3(startP.waterMid, targetP.waterMid, e);
    p.waterAccent = lerpVec3(startP.waterAccent, targetP.waterAccent, e);
    p.causticTint = lerpVec3(startP.causticTint, targetP.causticTint, e);
    p.specularTint = lerpVec3(startP.specularTint, targetP.specularTint, e);
    p.glowColumnX = lerpNum(startP.glowColumnX, targetP.glowColumnX, e);
    p.glowColumnWidth = lerpNum(startP.glowColumnWidth, targetP.glowColumnWidth, e);
    p.causticStrength = lerpNum(startP.causticStrength, targetP.causticStrength, e);
    p.shimmerSpeed = lerpNum(startP.shimmerSpeed, targetP.shimmerSpeed, e);
    p.koiDepthFog = lerpNum(startP.koiDepthFog, targetP.koiDepthFog, e);
    p.winterMode = lerpNum(startP.winterMode, targetP.winterMode, e);

    for (let i = 0; i < 4; i++) {
      this.liveWeights[i] = this.revealStartWeights[i] + (this.targetWeights[i] - this.revealStartWeights[i]) * e;
    }

    if (u >= 0.45) {
      this.visualSeasonId = this.seasonId;
    }

    if (u >= 1.0) {
      this.transitionPhase = 'idle';
      this.visualSeasonId = this.seasonId;
      if (this._pendingAmbientSeason) {
        this.particlesGL.startNewSeasonAmbient(this._pendingAmbientSeason);
        this._pendingAmbientSeason = null;
      }
      return { palette: p, revealSweepP: 1.0, inTransition: false };
    }

    return { palette: p, revealSweepP: u, inTransition: true };
  }

  render(timeSec) {
    const gl = this.gl;
    const nowMs = performance.now();
    const t = Number.isFinite(timeSec) ? timeSec : (nowMs - this.startTime) * 0.001;
    const dt = Math.min(0.05, Math.max(0.001, t - this.lastFrameTime));
    this.lastFrameTime = t;
    this.elapsed = t;

    this._fpsFrames++;
    if (nowMs - this._fpsLastTs >= 500) {
      this.currentFps = Math.round((this._fpsFrames * 1000) / (nowMs - this._fpsLastTs));
      this._fpsFrames = 0;
      this._fpsLastTs = nowMs;
      if (this.onFpsUpdate) this.onFpsUpdate(this.currentFps);
    }

    const { palette: season, revealSweepP, inTransition } = this._stepContinuousSeason(t);
    const rippleCount = this._updateRipples(t);
    const sw = this.fbos.scene.width;
    const sh = this.fbos.scene.height;
    const aspect = sw / Math.max(1, sh);

    // --- PASS 1: Scene FBO (0.50x res) ---
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbos.scene.fbo);
    gl.viewport(0, 0, sw, sh);

    // 1a. Pond Water Light Field
    gl.bindVertexArray(this.vao);
    gl.useProgram(this.programs.waterBg.program);
    const wu = this.programs.waterBg.uniforms;
    gl.uniform2f(wu.uResolution, sw, sh);
    gl.uniform1f(wu.uTime, t);
    gl.uniform3fv(wu.uWaterDeep, season.waterDeep);
    gl.uniform3fv(wu.uWaterMid, season.waterMid);
    gl.uniform3fv(wu.uWaterAccent, season.waterAccent);
    gl.uniform3fv(wu.uCausticTint, season.causticTint);
    gl.uniform3fv(wu.uSpecularTint, season.specularTint);
    gl.uniform1f(wu.uGlowColumnX, season.glowColumnX);
    gl.uniform1f(wu.uGlowColumnWidth, season.glowColumnWidth);
    gl.uniform1f(wu.uCausticStrength, season.causticStrength);
    gl.uniform1f(wu.uShimmerSpeed, season.shimmerSpeed);
    gl.uniform1f(wu.uWinterMode, season.winterMode);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // 1b. Pure GPU Underwater Nishikigoi (continuous integrated swimTime -> ZERO jump on Winter switch!)
    this.koiGL.render(t, dt, aspect, season, this.visualSeasonId, (rx, ry, str) => {
      this.spawnRipple(rx, ry, str);
    });

    // 1c. Surface Ripples + C1-Continuous Premultiplied 4-Season Flora Blend
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindVertexArray(this.vao);
    gl.useProgram(this.programs.surfaceOverlay.program);
    const su = this.programs.surfaceOverlay.uniforms;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.floraTextures.spring);
    gl.uniform1i(su.uFloraSpring, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.floraTextures.summer);
    gl.uniform1i(su.uFloraSummer, 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.floraTextures.autumn);
    gl.uniform1i(su.uFloraAutumn, 2);
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, this.floraTextures.winter);
    gl.uniform1i(su.uFloraWinter, 3);
    gl.uniform4fv(su.uSeasonWeights, this.liveWeights);
    gl.uniform2f(su.uResolution, sw, sh);
    gl.uniform1f(su.uTime, t);
    gl.uniform1f(su.uSeasonSweep, revealSweepP);
    gl.uniform3fv(su.uCausticTint, season.causticTint);
    gl.uniform3fv(su.uSpecularTint, season.specularTint);
    gl.uniform4fv(su.uRipples, this.rippleUniformData);
    gl.uniform1i(su.uRippleCount, rippleCount);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disable(gl.BLEND);

    // 1d. Pure GPU Botanical Falling Petals / Maple Leaves / Snow + Interruptible Stardust Vortex
    this.particlesGL.render(t, dt, sw, this.seasonId, inTransition, (rx, ry, str) => {
      this.spawnRipple(rx, ry, str);
    });

    // --- PASS 2: Quarter-Res Bloom Extract + H/V Blur (directly from sceneFBO!) ---
    gl.bindVertexArray(this.vao);
    const bw = this.fbos.bloomA.width;
    const bh = this.fbos.bloomA.height;

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbos.bloomA.fbo);
    gl.viewport(0, 0, bw, bh);
    gl.useProgram(this.programs.bloomExtract.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.fbos.scene.texture);
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

    // Dirty-flag UI overlay (0 GPU uploads/sec while idle!)
    const uiRes = this.uiOverlay.render(t, dt, this.cssWidth, this.cssHeight);
    if (uiRes.updated) {
      this._uploadCanvasFast(this.uiTex, uiRes.canvas, this._uiTexSize);
    }

    // --- PASS 3: FUSED Phosphor-Dot + Bloom + UI + CRT Barrel/Scanlines/CA (ONE full-res pass!) ---
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.width, this.height);
    gl.useProgram(this.programs.crtFinal.program);
    const cu = this.programs.crtFinal.uniforms;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.fbos.scene.texture);
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
    gl.uniform1f(cu.uDotPitchPx, this.crtConfig.dotPitchCssPx);
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
    this.koiGL.destroy();
    this.particlesGL.destroy();
    const gl = this.gl;
    for (const sId of SEASON_ORDER) {
      gl.deleteTexture(this.floraTextures[sId]);
    }
    gl.deleteTexture(this.uiTex);
    for (const p of Object.values(this.programs)) {
      gl.deleteProgram(p.program);
    }
    gl.deleteVertexArray(this.vao);
  }
}
