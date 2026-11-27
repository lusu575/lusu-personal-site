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

import { FloraLayer } from './flora.mjs?v=20261124-autumn-lotus-r69';
import { createFBO, createFullscreenVAO, createProgram } from './gl-utils.mjs';
import { KoiGLRenderer } from './koi-gl.mjs?v=20261125-persepolis-warm-r87';
import { ParticlesGLRenderer } from './particles-gl.mjs?v=20261124-wind-water-r75';
import { lerpNum, lerpVec3, SEASON_ORDER, SEASONS } from './seasons.mjs';
import {
  BLOOM_EXTRACT_FRAG,
  BLUR_FRAG,
  CRT_PHOSPHOR_FINAL_FRAG,
  FULLSCREEN_VERT,
  SURFACE_OVERLAY_FRAG,
  WATER_BG_FRAG
} from './shaders.mjs?v=20261125-persepolis-warm-r87';
import { PondUIOverlay } from './ui-overlay.mjs?v=20261125-persepolis-warm-r87';
import { detectBootMode, loadSeasonFloraParts, markBootCompleted, runPondBootPreload } from './boot-preloader.mjs?v=20261127-opt093-perf-r100';

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
    this.seasonWaveDuration = 1.0; // Approved 1.0s Wind-Sweep Season Transition
    this.transitionPhase = 'idle'; // 'idle' | 'wave'
    this.windDirX = 0.951; // ~18 deg top-left -> bottom-right diagonal gust
    this.windDirY = -0.309;
    this.waterPhase = 0; // Monotonically integrated water shimmer phase (ZERO season-switch twitch!)
    this._waveToggleCorner = false;
    this._koiWaveStartled = [false, false];
    // Continuous interruptible live state:
    // Mid-wave interruption freezes current live weights/palette and sweeps a fresh wavefront
    // from the opposite/click origin with zero snap, zero flash, and zero queue!
    this.livePalette = this._cloneSeasonPalette(this.seasonId);
    this.revealStartPalette = this._cloneSeasonPalette(this.seasonId);
    this.liveWeights = this._seasonToWeights(this.seasonId);
    this.revealStartWeights = this._seasonToWeights(this.seasonId);
    this.targetWeights = this._seasonToWeights(this.seasonId);
    this._draggingSlider = false;
    this.onNavigate = options.onNavigate || null;
    this.onAccountClick = options.onAccountClick || null;
    this.onWelcomeClick = options.onWelcomeClick || null;
    this.onLanguageChange = options.onLanguageChange || null;
    this.onSeasonChange = options.onSeasonChange || null;
    this.onFpsUpdate = options.onFpsUpdate || null;
    this.onBootFirstFrame = options.onBootFirstFrame || null;
    this.onBootComplete = options.onBootComplete || null;
    this.bootMode = options.skipBoot ? 'instant' : detectBootMode();
    this.bootActive = this.bootMode !== 'instant';
    // Single global Persepolis warm-up uniform uWarm (0 -> 1)
    this.uWarm = this.bootActive ? 0.0 : 1.0;
    this.realLoadProgress = this.bootActive ? 0.0 : 1.0;
    this._shaderReady = false;
    this._pendingFloraQueue = [];
    this._floraBakeScheduled = false;
    this.bootStartMs = performance.now();
    this.bootMinDurationMs = 1280; // Perceived warm-up duration inside [0.9s, 1.6s] envelope
    this.bootMaxDurationMs = 1600;
    this.bootHardTimeoutMs = 2500; // Absolute wall-clock failsafe (never stuck on intermediate frame!)
    this._bootFailsafeTimer = 0;
    this._bootFirstFrameFired = false;
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

    // Weak-GPU / mobile detection: keep the EXACT same uWarm ramp, only dial down bloom intensity
    const lowGpu = (Number(navigator.hardwareConcurrency) > 0 && Number(navigator.hardwareConcurrency) <= 2)
      || (Number(navigator.deviceMemory) > 0 && Number(navigator.deviceMemory) <= 2)
      || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

    this.crtConfig = {
      curvature: 0.068,
      dotPitchCssPx: 4.1,
      scanlinePitchCssPx: 3.6,
      bloomThreshold: 0.30,
      bloomIntensity: lowGpu ? 0.28 : 0.62,
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
    this._shaderReady = true;
    this.primaryFloraReady = !this.bootActive;
    this.warmRampStartMs = 0;
    if (this.bootActive) {
      // r95: Hold uWarm at 0.0 until active-season desktop flora textures are 100% decoded & GPU-baked
      // so zero branches/leaves/icons can ever pop in mid-warm-up!
      this.realLoadProgress = 0.0;
      // Independent wall-clock failsafe outside RAF loop: guaranteed uWarm = 1.0 by 2.5s
      this._bootFailsafeTimer = window.setTimeout(() => {
        if (this.bootActive) this._finishBootImmediate();
      }, this.bootHardTimeoutMs);
    }
    this.vao = createFullscreenVAO(this.gl);
    this.fbos = {};
    this.resize();
    this._loadAssetManifest();
    this._bindInteractions();
  }

  _finishBootImmediate() {
    if (this._bootFailsafeTimer) {
      window.clearTimeout(this._bootFailsafeTimer);
      this._bootFailsafeTimer = 0;
    }
    this.uWarm = 1.0;
    this.realLoadProgress = 1.0;
    const wasActive = this.bootActive;
    this.bootActive = false;
    markBootCompleted();
    if (wasActive && this.onBootComplete) {
      this.onBootComplete();
    }
    // Render one synchronous frame immediately so even a paused/stalled RAF snaps to live pond!
    if (this.gl && this.fbos && this.fbos.scene) {
      try {
        this.render();
      } catch {
        /* Ignore synchronous frame error if WebGL context is unavailable */
      }
    }
  }

  skipBoot() {
    if (!this.bootActive && this.uWarm >= 0.999) return;
    this._finishBootImmediate();
  }

  async _loadAssetManifest() {
    try {
      const res = await runPondBootPreload({
        seasonId: this.seasonId,
        onFloraPart: (key, img) => {
          this.floraLayer.setPart(key, img);
        },
        onPrimaryFloraDone: () => {
          if (this.gl) this._prebakeAllFlora();
          this.primaryFloraReady = true;
        },
        onProgress: (realProg) => {
          if (this.bootActive) {
            this.realLoadProgress = Math.max(this.realLoadProgress, Math.min(1.0, realProg));
          }
        },
        onComplete: () => {
          if (this.gl) this._prebakeAllFlora();
          this.primaryFloraReady = true;
          this.realLoadProgress = 1.0;
        }
      });

      // Optional desktop icon overrides if present in manifest
      if (res?.manifest?.icons) {
        for (const [iconId, url] of Object.entries(res.manifest.icons)) {
          if (url) this.loadIconAsset(iconId, url).catch(() => {});
        }
      }
    } catch {
      this.primaryFloraReady = true;
      this.realLoadProgress = 1.0;
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

  _bakeSeasonFlora(sId) {
    const gl = this.gl;
    if (!gl || !this.floraTextures[sId]) return;
    const floraCanvas = this.floraLayer.render(sId, this.cssWidth, this.cssHeight);
    gl.bindTexture(gl.TEXTURE_2D, this.floraTextures[sId]);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, floraCanvas);
    gl.bindTexture(gl.TEXTURE_2D, null);
    const idx = this._pendingFloraQueue.indexOf(sId);
    if (idx !== -1) this._pendingFloraQueue.splice(idx, 1);
  }

  _drainFloraBakeQueue() {
    this._floraBakeScheduled = false;
    if (!this.gl || this._pendingFloraQueue.length === 0) return;
    const nextSeason = this._pendingFloraQueue.shift();
    if (nextSeason) this._bakeSeasonFlora(nextSeason);
    if (this._pendingFloraQueue.length > 0) {
      this._scheduleFloraDrain();
    }
  }

  _scheduleFloraDrain() {
    if (this._floraBakeScheduled || this._pendingFloraQueue.length === 0) return;
    this._floraBakeScheduled = true;
    const schedule = typeof window.requestIdleCallback === 'function'
      ? (fn) => window.requestIdleCallback(fn, { timeout: 180 })
      : (fn) => window.setTimeout(fn, 32);
    schedule(() => this._drainFloraBakeQueue());
  }

  _prebakeAllFlora() {
    if (!this.gl) return;
    // Bake active season immediately for crisp first paint; defer other 3 seasons 1-per-idle-slice
    // to eliminate the 500ms+ cold-load main-thread freeze.
    const active = SEASONS[this.seasonId] ? this.seasonId : SEASON_ORDER[0];
    this._bakeSeasonFlora(active);
    for (const sId of SEASON_ORDER) {
      if (sId !== active && !this._pendingFloraQueue.includes(sId)) {
        this._pendingFloraQueue.push(sId);
      }
    }
    this._scheduleFloraDrain();
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
        // r98: Quiet desktop icon launch — no click flash halo; hover static highlight stays intact
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

  setSeason(seasonId, _originNx = 0.86, _originNy = 0.072, { manual = true } = {}) {
    if (SEASONS[seasonId] && seasonId !== this.seasonId) {
      if (this._pendingFloraQueue.includes(seasonId)) {
        this._bakeSeasonFlora(seasonId);
      }
      loadSeasonFloraParts(seasonId, (key, img) => {
        this.floraLayer.setPart(key, img);
      }).then(() => {
        if (this.gl) this._bakeSeasonFlora(seasonId);
      }).catch(() => {});
      const prev = this.seasonId;
      const wasInTransition = this.transitionPhase !== 'idle';
      this.fromSeasonId = prev;
      this.seasonId = seasonId;

      // Snapshot EXACT current live visual state so interruption NEVER snaps, blinks, or rewinds!
      this.revealStartPalette = this._copyPalette(this.livePalette);
      this.revealStartWeights = [...this.liveWeights];
      this.targetWeights = this._seasonToWeights(seasonId);

      // Gentle slanted gust (~18 deg top-left -> bottom-right); alternates slight angle when interrupted mid-gust
      if (wasInTransition) {
        this._waveToggleCorner = !this._waveToggleCorner;
        const ang = this._waveToggleCorner ? -0.44 : -0.22; // -25deg / -12.5deg subtle gust shift
        this.windDirX = Math.cos(ang);
        this.windDirY = Math.sin(ang);
      } else {
        this.windDirX = 0.951; // ~18 deg
        this.windDirY = -0.309;
      }

      this.seasonWaveDuration = 1.0;
      this.seasonTransitionStart = this.elapsed;
      this.transitionPhase = 'wave';
      this._koiWaveStartled = [false, false];

      this.uiOverlay.setSeason(seasonId, this.elapsed);
      this.particlesGL.triggerWavefrontTransition(
        prev,
        seasonId,
        this.windDirX,
        this.windDirY,
        this.elapsed,
        this.seasonWaveDuration
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

  _stepContinuousSeason(t, aspect) {
    if (this.transitionPhase === 'idle') {
      return {
        palette: this.livePalette,
        waveState: { active: false, progress: 1.0, wdx: this.windDirX, wdy: this.windDirY, frontPos: 99.0, aspect }
      };
    }

    const elapsed = Math.max(0, t - this.seasonTransitionStart);
    const u = Math.min(1.0, elapsed / Math.max(0.01, this.seasonWaveDuration));
    const e = u * u * (3.0 - 2.0 * u); // C1 smoothstep gust curve
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

    // Invisible slanted wind front position matching SURFACE_OVERLAY_FRAG & ParticlesGLRenderer
    const wdx = this.windDirX;
    const wdy = this.windDirY;
    const frontPos = -0.22 + e * 1.72;

    // Trigger natural startled dart on each koi right when the invisible gust sweeps across its coordinates!
    const fishPositions = this.koiGL.getFishUvPositions();
    for (let i = 0; i < fishPositions.length; i++) {
      if (!this._koiWaveStartled[i]) {
        const fp = fishPositions[i];
        const fishProj = (fp.uvX - 0.5) * wdx + (fp.uvY - 0.5) * wdy + 0.65;
        if (frontPos >= fishProj) {
          this._koiWaveStartled[i] = true;
          const pos = this.koiGL.triggerWaveStartle(i);
          if (pos) this.spawnRipple(pos.uvX, pos.uvY, 0.45);
        }
      }
    }

    if (u >= 0.45) {
      this.visualSeasonId = this.seasonId;
    }

    if (u >= 1.0) {
      this.transitionPhase = 'idle';
      this.visualSeasonId = this.seasonId;
      return {
        palette: p,
        waveState: { active: false, progress: 1.0, wdx, wdy, frontPos: 99.0, aspect }
      };
    }

    return {
      palette: p,
      waveState: { active: true, progress: e, wdx, wdy, frontPos, aspect }
    };
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

    // Persepolis-style single-scene dark-to-bright phosphor warm-up (r87):
    // uWarm (0 -> 1) is gated by real critical preload progress (floor) and smooth time envelope (0.9s - 1.6s),
    // with an absolute 2.5s wall-clock hard failsafe so it can NEVER stall on any intermediate frame.
    if (this.bootActive) {
      const elapsedBootMs = nowMs - this.bootStartMs;
      if (elapsedBootMs >= this.bootHardTimeoutMs) {
        if (this._bootFailsafeTimer) {
          window.clearTimeout(this._bootFailsafeTimer);
          this._bootFailsafeTimer = 0;
        }
        this.uWarm = 1.0;
        this.bootActive = false;
        markBootCompleted();
        if (this.onBootComplete) this.onBootComplete();
      } else {
        // r95: Wait in dark (uWarm = 0) until active-season desktop flora textures are 100% GPU-baked
        // (max 950ms slow-network gate so total boot still finishes smoothly inside 2.5s wall-clock ceiling)
        if (!this.primaryFloraReady && elapsedBootMs < 950) {
          this.uWarm = 0.0;
        } else {
          if (!this.warmRampStartMs) this.warmRampStartMs = nowMs;
          const rampElapsed = nowMs - this.warmRampStartMs;
          const rampDur = Math.min(1150, Math.max(700, this.bootHardTimeoutMs - (this.warmRampStartMs - this.bootStartMs) - 120));
          const timeCap = Math.min(1.0, rampElapsed / rampDur);
          const releaseFloor = elapsedBootMs > this.bootMaxDurationMs
            ? Math.min(1.0, (elapsedBootMs - this.bootMaxDurationMs) / (this.bootHardTimeoutMs - this.bootMaxDurationMs))
            : 0.0;
          const effectiveReal = Math.max(this.primaryFloraReady ? 1.0 : this.realLoadProgress, releaseFloor);
          const targetWarm = Math.min(timeCap, effectiveReal);
          this.uWarm = Math.max(this.uWarm, targetWarm);
          if (this.uWarm >= 0.998 && effectiveReal >= 0.998) {
            if (this._bootFailsafeTimer) {
              window.clearTimeout(this._bootFailsafeTimer);
              this._bootFailsafeTimer = 0;
            }
            this.uWarm = 1.0;
            this.bootActive = false;
            markBootCompleted();
            if (this.onBootComplete) this.onBootComplete();
          }
        }
      }
    }

    const sw = this.fbos.scene.width;
    const sh = this.fbos.scene.height;
    const aspect = sw / Math.max(1, sh);
    const { palette: season, waveState } = this._stepContinuousSeason(t, aspect);
    const rippleCount = this._updateRipples(t);

    // --- PASS 1: Scene FBO (0.50x res) ---
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbos.scene.fbo);
    gl.viewport(0, 0, sw, sh);

    // 1a. Pond Water Light Field (CPU-integrated waterPhase guarantees zero twitch on season switch)
    this.waterPhase += dt * Math.max(0.15, season.shimmerSpeed || 0.7);
    gl.bindVertexArray(this.vao);
    gl.useProgram(this.programs.waterBg.program);
    const wu = this.programs.waterBg.uniforms;
    gl.uniform2f(wu.uResolution, sw, sh);
    gl.uniform1f(wu.uTime, t);
    if (wu.uWaterPhase) gl.uniform1f(wu.uWaterPhase, this.waterPhase);
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

    // 1b. Pure GPU Underwater Nishikigoi (always live in scene; warmed naturally by uWarm!)
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
    if (su.uFromWeights) gl.uniform4fv(su.uFromWeights, this.revealStartWeights);
    if (su.uToWeights) gl.uniform4fv(su.uToWeights, this.targetWeights);
    if (su.uWaveParams) {
      gl.uniform4f(su.uWaveParams, waveState.wdx, waveState.wdy, waveState.progress, waveState.active ? 1.0 : 0.0);
    }
    gl.uniform2f(su.uResolution, sw, sh);
    gl.uniform1f(su.uTime, t);
    if (su.uSeasonSweep) gl.uniform1f(su.uSeasonSweep, waveState.progress);
    gl.uniform3fv(su.uCausticTint, season.causticTint);
    gl.uniform3fv(su.uSpecularTint, season.specularTint);
    gl.uniform4fv(su.uRipples, this.rippleUniformData);
    gl.uniform1i(su.uRippleCount, rippleCount);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disable(gl.BLEND);

    // 1d. Pure GPU In-Place Wavefront Breeze Motes & Restrained Seasonal Ambient Particles
    this.particlesGL.render(t, dt, sw, this.seasonId, waveState, (rx, ry, str) => {
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
    // Bloom threshold starts high (0.66) so brightest water specular highlights & koi scales emerge first,
    // settling smoothly to normal (0.30) as uWarm reaches 1.0.
    const warmBloomThreshold = this.uWarm < 0.999
      ? 0.66 + (this.crtConfig.bloomThreshold - 0.66) * Math.pow(Math.max(0, this.uWarm), 0.72)
      : this.crtConfig.bloomThreshold;
    gl.uniform1f(this.programs.bloomExtract.uniforms.uThreshold, warmBloomThreshold);
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
    if (cu.uWarm) gl.uniform1f(cu.uWarm, this.uWarm);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.bindVertexArray(null);

    if (!this._bootFirstFrameFired) {
      this._bootFirstFrameFired = true;
      if (this.onBootFirstFrame) this.onBootFirstFrame();
    }
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
    if (this._bootFailsafeTimer) {
      window.clearTimeout(this._bootFailsafeTimer);
      this._bootFailsafeTimer = 0;
    }
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
