// Reusable CRT Refractive Glass Button Press Layer (Astra Spec V1.0 · Step 3)
// Pure visual/tactile layer preserving 100% native <button> semantics, focus, keyboard & click count.
// Implements MengTo shade-glass-button-press: local contact Gaussian indent, second-order spring hold,
// 320ms non-linear release wave (crest + wake), brief <=0.35px RGB crest split, 70ms rim catch & idle-stop.

import {
  CRT_GLASS,
  CRT_GLASS_BUTTON_LEVELS,
  CRT_GLASS_SPRINGS,
  CRT_GLASS_TIERS,
  syncCrtGlassCssVars
} from './crt-glass-config.mjs?v=20261125-glass-parity-r89';

function getActivePerfTier() {
  const tierName = document.documentElement.dataset.performanceTier || 'high';
  return CRT_GLASS_TIERS[tierName] || CRT_GLASS_TIERS.high;
}

const activeControllers = new Set();
let rafId = 0;
let lastFrameMs = 0;
let perfStats = { frames: 0, totalJsMs: 0, maxJsMs: 0 };

function prefersReducedMotion() {
  return Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

function stepSecondOrderSpring(state, target, spring, dtSec) {
  // Semi-implicit Euler with clamped sub-steps for 60Hz/120Hz identical feel
  const steps = dtSec > 0.012 ? 2 : 1;
  const h = dtSec / steps;
  const w0 = spring.omega0;
  const c = 2 * spring.zeta * w0;
  const k = w0 * w0;
  for (let i = 0; i < steps; i++) {
    const accel = -k * (state.pos - target) - c * state.vel;
    state.vel += accel * h;
    state.pos += state.vel * h;
  }
  const settled = Math.abs(state.pos - target) < 0.002 && Math.abs(state.vel) < 0.01;
  if (settled) {
    state.pos = target;
    state.vel = 0;
  }
  return settled;
}

function tickAll(nowMs) {
  rafId = 0;
  if (activeControllers.size === 0) return;

  const t0 = performance.now();
  const dtSec = lastFrameMs ? Math.min(0.033, Math.max(0.001, (nowMs - lastFrameMs) * 0.001)) : 0.0083;
  lastFrameMs = nowMs;

  for (const ctrl of [...activeControllers]) {
    const keepRunning = ctrl._step(nowMs, dtSec);
    if (!keepRunning) {
      activeControllers.delete(ctrl);
    }
  }

  const jsCost = performance.now() - t0;
  perfStats.frames++;
  perfStats.totalJsMs += jsCost;
  if (jsCost > perfStats.maxJsMs) perfStats.maxJsMs = jsCost;

  if (activeControllers.size > 0) {
    rafId = requestAnimationFrame(tickAll);
  } else {
    lastFrameMs = 0;
  }
}

function scheduleController(ctrl) {
  activeControllers.add(ctrl);
  if (!rafId) {
    lastFrameMs = performance.now();
    rafId = requestAnimationFrame(tickAll);
  }
}

// r93 Structural Unclipped Top-Level Halo Overlay Layer:
// Renders full-strength outer glow (14px hover / 20px hold / 22px rim-catch) on document.body
// outside every card/scroll container overflow:hidden box, aligned pixel-for-pixel to the active
// button's live getBoundingClientRect() & borderRadius. Zero idle DOM nodes, zero idle listeners.
let haloLayerEl = null;
const haloProxyByCtrl = new Map();
let haloScrollBound = false;
let haloScrollRaf = 0;

function ensureHaloLayer() {
  if (haloLayerEl && haloLayerEl.isConnected) return haloLayerEl;
  const existing = document.getElementById('crt-glass-halo-layer');
  if (existing) {
    haloLayerEl = existing;
    return haloLayerEl;
  }
  if (!document.body) return null;
  const layer = document.createElement('div');
  layer.id = 'crt-glass-halo-layer';
  layer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(layer);
  haloLayerEl = layer;
  return haloLayerEl;
}

function scheduleHaloResync() {
  if (haloScrollRaf || haloProxyByCtrl.size === 0) return;
  haloScrollRaf = requestAnimationFrame(() => {
    haloScrollRaf = 0;
    for (const ctrl of [...haloProxyByCtrl.keys()]) {
      syncHaloProxy(ctrl);
    }
  });
}

function updateHaloScrollListeners() {
  if (haloProxyByCtrl.size > 0 && !haloScrollBound) {
    haloScrollBound = true;
    window.addEventListener('scroll', scheduleHaloResync, { capture: true, passive: true });
    window.addEventListener('resize', scheduleHaloResync, { passive: true });
  } else if (haloProxyByCtrl.size === 0 && haloScrollBound) {
    haloScrollBound = false;
    window.removeEventListener('scroll', scheduleHaloResync, { capture: true });
    window.removeEventListener('resize', scheduleHaloResync);
  }
}

function removeHaloProxy(ctrl) {
  const proxy = haloProxyByCtrl.get(ctrl);
  if (proxy) {
    proxy.remove();
    haloProxyByCtrl.delete(ctrl);
    updateHaloScrollListeners();
  }
}

function syncHaloProxy(ctrl) {
  // Low-perf tier disables outer halo; all other tiers get full unclipped outer glow on document.body!
  if (!ctrl) return;
  if (document.documentElement.dataset.performanceTier === 'low') {
    removeHaloProxy(ctrl);
    return;
  }
  const el = ctrl.el;
  const active = ctrl.hovered || ctrl.held || ctrl.waveActive || (ctrl.rimEnv || 0) > 0.002 || ctrl.spring.pos > 0.01;
  if (!active || !el || !el.isConnected) {
    removeHaloProxy(ctrl);
    return;
  }
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    removeHaloProxy(ctrl);
    return;
  }
  // Hide if scrolled completely outside its enclosing window / popover viewport
  const win = el.closest('.xp-window, #account-popover, #welcome-modal, #video-modal');
  if (win) {
    const winR = win.getBoundingClientRect();
    if (rect.bottom <= winR.top + 2 || rect.top >= winR.bottom - 2 || rect.right <= winR.left + 2 || rect.left >= winR.right - 2) {
      removeHaloProxy(ctrl);
      return;
    }
  }
  const layer = ensureHaloLayer();
  if (!layer) return;
  let proxy = haloProxyByCtrl.get(ctrl);
  if (!proxy) {
    proxy = document.createElement('span');
    proxy.className = 'crt-glass-halo-proxy';
    proxy.setAttribute('aria-hidden', 'true');
    layer.appendChild(proxy);
    haloProxyByCtrl.set(ctrl, proxy);
    updateHaloScrollListeners();
  }
  const cs = getComputedStyle(el);
  const ps = proxy.style;
  ps.left = `${rect.left.toFixed(2)}px`;
  ps.top = `${rect.top.toFixed(2)}px`;
  ps.width = `${rect.width.toFixed(2)}px`;
  ps.height = `${rect.height.toFixed(2)}px`;
  ps.borderRadius = cs.borderRadius;

  // r96: 100% continuous halo radius & alpha driven by smooth spring + raised-cosine rim shimmer (ZERO discrete flashes!)
  const holdNorm = Math.max(0, Math.min(1, ctrl.spring ? ctrl.spring.pos : 0));
  const rimNorm = Math.max(0, Math.min(1, ctrl.rimEnv || 0));
  const hoverBase = ctrl.hovered ? 1 : 0;
  const blur = hoverBase * 14 + (1 - hoverBase) * Math.max(holdNorm, rimNorm) * 14 + holdNorm * 6 + rimNorm * 3.5;
  const alpha = Math.min(0.58, hoverBase * 0.32 + (1 - hoverBase) * Math.max(holdNorm, rimNorm) * 0.28 + holdNorm * 0.22 + rimNorm * 0.08);
  proxy.dataset.haloState = ctrl.held ? 'hold' : (rimNorm > 0.01 ? 'rim' : 'hover');
  ps.setProperty('--cg-halo-blur', `${blur.toFixed(1)}px`);
  ps.setProperty('--cg-halo-alpha', alpha.toFixed(3));
}

// MengTo shade-glass-button-press + refract-liquid-glass (r92 rework)
// Zero SVG filter box-clipping! Pure smooth Gaussian face indent + exact MengTo 750ms crest/wake
// release wave (pow(1-t, 1.7), crest = exp(-d^2), wake = exp(-((d+1.1)/1.6)^2)) + edge-gated rim catch.

class CrtGlassButtonController {
  constructor(el, levelName = 'glass-primary') {
    this.el = el;
    this.levelName = levelName;
    // r95 Full Rollout: ALL non-close glass buttons use the approved Welcome MengTo liquid-glass spec!
    this.isLiquidPilot = levelName !== 'glass-close';
    this.level = CRT_GLASS_BUTTON_LEVELS[levelName] || CRT_GLASS_BUTTON_LEVELS['glass-primary'];
    this.held = false;
    this.hovered = false;
    this.holdStartMs = 0;
    this.spring = { pos: 0, vel: 0 }; // 0 = rest, 1 = fully pressed
    this.contactX = 0;
    this.contactY = 0;
    this.normContactX = 0;
    this.normContactY = 0;
    this.btnW = 120;
    this.btnH = 36;
    this.reach = 120;
    this.nearestRim = 18;
    this.waveActive = false;
    this.waveStartMs = 0;
    this.rimCatchStartMs = 0;
    this.rimCatchFired = false;
    this.rimEnv = 0;
    this.activePointerId = null;

    el.classList.add('crt-glass-btn', levelName);
    if (this.isLiquidPilot) {
      el.classList.add('crt-glass-liquid-pilot');
    }
    el.dataset.crtGlassBound = levelName;

    // Ensure dedicated optical layers exist inside button without disturbing text/icons
    if (!el.querySelector('.crt-glass-wave-layer')) {
      const waveLayer = document.createElement('span');
      waveLayer.className = 'crt-glass-wave-layer';
      waveLayer.setAttribute('aria-hidden', 'true');
      el.prepend(waveLayer);
    }
    if (!el.querySelector('.crt-glass-sheen-layer')) {
      const sheenLayer = document.createElement('span');
      sheenLayer.className = 'crt-glass-sheen-layer';
      sheenLayer.setAttribute('aria-hidden', 'true');
      el.prepend(sheenLayer);
    }
    // Event handling is delegated at document level (O(1) listeners total instead of 10*N per button).
  }

  _updateHoverLiquid(clientX, clientY) {
    const rect = this.el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const hx = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const hy = Math.max(0, Math.min(rect.height, clientY - rect.top));
    const normX = (hx / rect.width) * 2 - 1; // -1..1
    const normY = (hy / rect.height) * 2 - 1;
    // Pointer angle around perimeter for rim specular reflection (refract-liquid-glass § Render the lens #4)
    const rimAngleDeg = (Math.atan2(normY, normX) * 180) / Math.PI + 90;
    const s = this.el.style;
    s.setProperty('--cg-hx', `${hx.toFixed(1)}px`);
    s.setProperty('--cg-hy', `${hy.toFixed(1)}px`);
    s.setProperty('--cg-hx-inv', `${(rect.width - hx).toFixed(1)}px`);
    s.setProperty('--cg-hy-inv', `${(rect.height - hy).toFixed(1)}px`);
    s.setProperty('--cg-sheen-ang', `${rimAngleDeg.toFixed(1)}deg`);
  }

  _handlePointerEnter(e) {
    if (this.el.disabled) return;
    this.hovered = true;
    this.el.classList.add('is-glass-hovered');
    this._updateHoverLiquid(e.clientX, e.clientY);
    syncHaloProxy(this);
  }

  _handlePointerMove(e) {
    if (this.el.disabled) return;
    if (!this.hovered) {
      this.hovered = true;
      this.el.classList.add('is-glass-hovered');
      syncHaloProxy(this);
    }
    this._updateHoverLiquid(e.clientX, e.clientY);
  }

  _handlePointerLeave() {
    this.hovered = false;
    this.el.classList.remove('is-glass-hovered');
    if (this.isLiquidPilot && !this.held && !this.waveActive) {
      this.el.style.removeProperty('--cg-tilt-x');
      this.el.style.removeProperty('--cg-tilt-y');
    }
    syncHaloProxy(this);
  }

  _measureContact(clientX, clientY, useCenter = false) {
    // Measure once relative to undeformed button rect
    const rect = this.el.getBoundingClientRect();
    this.btnW = Math.max(1, rect.width);
    this.btnH = Math.max(1, rect.height);
    if (useCenter || !Number.isFinite(clientX) || !Number.isFinite(clientY)) {
      this.contactX = this.btnW * 0.5;
      this.contactY = this.btnH * 0.5;
    } else {
      this.contactX = Math.max(0, Math.min(this.btnW, clientX - rect.left));
      this.contactY = Math.max(0, Math.min(this.btnH, clientY - rect.top));
    }
    this.normContactX = (this.contactX / this.btnW) * 2 - 1;
    this.normContactY = (this.contactY / this.btnH) * 2 - 1;
    const maxDx = Math.max(this.contactX, this.btnW - this.contactX);
    const maxDy = Math.max(this.contactY, this.btnH - this.contactY);
    this.reach = Math.hypot(maxDx, maxDy);
    this.nearestRim = Math.min(this.contactX, this.btnW - this.contactX, this.contactY, this.btnH - this.contactY);

    const sigma = Math.max(8, Math.min(this.btnW, this.btnH) * CRT_GLASS.indentSigmaRatio);
    const s = this.el.style;
    s.setProperty('--cg-cx', `${this.contactX.toFixed(1)}px`);
    s.setProperty('--cg-cy', `${this.contactY.toFixed(1)}px`);
    s.setProperty('--cg-sigma', `${sigma.toFixed(1)}px`);
  }

  _handlePointerDown(e) {
    if (this.el.disabled || e.button === 2) return;
    // Prevent double-fire when pressing an inner glass control (e.g. .article-card-cta inside .article-card)
    if (this.levelName === 'glass-card' && e.target instanceof Element) {
      const inner = e.target.closest('[data-crt-glass-bound]');
      if (inner && inner !== this.el && this.el.contains(inner)) return;
    }
    this._measureContact(e.clientX, e.clientY, false);
    this.activePointerId = e.pointerId;
    try {
      this.el.setPointerCapture(e.pointerId);
    } catch {
      // Synthetic events or detached elements may not support capture
    }
    this._beginHold();
  }

  _handlePointerUp(e) {
    if (this.activePointerId !== null && e.pointerId !== this.activePointerId) return;
    this._releaseCapture();
    if (!this.held) return;
    this._beginRelease(true);
  }

  _handlePointerCancel() {
    this._releaseCapture();
    this._handleCancelVisual();
  }

  _handleKeyDown(e) {
    if (this.el.disabled || e.repeat) return;
    if (e.key !== ' ' && e.key !== 'Enter') return;
    this._measureContact(NaN, NaN, true);
    this._beginHold();
  }

  _handleKeyUp(e) {
    if (e.key !== ' ' && e.key !== 'Enter') return;
    if (!this.held) return;
    this._beginRelease(true);
  }

  _handleCancelVisual() {
    if (!this.held && !this.waveActive) return;
    this.held = false;
    this.el.classList.remove('is-glass-held');
    if (prefersReducedMotion()) {
      this._resetVisual();
      return;
    }
    // Release spring back to rest WITHOUT firing wave or business click
    scheduleController(this);
  }

  _releaseCapture() {
    if (this.activePointerId !== null) {
      try {
        if (this.el.hasPointerCapture?.(this.activePointerId)) {
          this.el.releasePointerCapture(this.activePointerId);
        }
      } catch {
        /* Pointer capture may already be released by the browser */
      }
      this.activePointerId = null;
    }
  }

  _beginHold() {
    this.held = true;
    this.holdStartMs = performance.now();
    // Double-tap replaces any running release wave cleanly (no wave accumulation)
    this.waveActive = false;
    this.rimCatchStartMs = 0;
    this.rimCatchFired = false;
    this.rimEnv = 0;
    this.el.classList.remove('is-glass-waving', 'is-glass-rim-catch');
    this.el.classList.add('is-glass-held');

    if (prefersReducedMotion()) {
      this.el.style.setProperty('--cg-hold', '1');
      return;
    }
    // Smooth continuous spring onset from current pos (zero harsh brightness jump on Frame 0)
    this.spring.pos = Math.max(this.spring.pos, 0.22);
    const s = this.el.style;
    const pressOffset = this.isLiquidPilot ? 1.6 : this.level.pressOffsetPx;
    const pressTargetScale = this.isLiquidPilot ? 0.972 : this.level.pressScale;
    const initY = this.spring.pos * pressOffset;
    const initScale = 1 - this.spring.pos * (1 - pressTargetScale);
    s.setProperty('--cg-hold', this.spring.pos.toFixed(4));
    s.setProperty('--cg-press-y', `${initY.toFixed(2)}px`);
    s.setProperty('--cg-press-scale', initScale.toFixed(4));
    const minDim = Math.min(this.btnW, this.btnH);
    const initHoldR = Math.max(10, Math.min(18, minDim * 0.36));
    s.setProperty('--cg-hold-r', `${initHoldR.toFixed(1)}px`);
    syncHaloProxy(this);
    scheduleController(this);
  }

  _beginRelease(triggerWave) {
    this.held = false;
    this.el.classList.remove('is-glass-held');

    if (prefersReducedMotion()) {
      this._resetVisual();
      return;
    }

    if (triggerWave && this.level.enableWave) {
      this.waveActive = true;
      this.waveStartMs = performance.now();
      this.rimCatchStartMs = 0;
      this.rimCatchFired = false;
      this.rimEnv = 0;
      this.el.classList.add('is-glass-waving');
      // r96: Start wave alpha smoothly at 0 so the concave dimple unfurls continuously without a 1-frame flash
      const bandWidth = this.btnW >= CRT_GLASS.waveWideThresholdPx ? CRT_GLASS.waveBandWidePx : CRT_GLASS.waveBandPx;
      const s = this.el.style;
      s.setProperty('--cg-wave-r', '6.0px');
      s.setProperty('--cg-wave-band', `${bandWidth.toFixed(1)}px`);
      s.setProperty('--cg-wave-alpha', '0');
      s.setProperty('--cg-disp', '0px');
    } else if (triggerWave && this.level.enableRimCatch) {
      // glass-close: single smooth rim shimmer, no release wave
      this.rimCatchStartMs = performance.now();
      this.rimCatchFired = true;
      this.el.classList.add('is-glass-rim-catch');
      this.el.style.setProperty('--cg-rim-catch', '0');
    }
    syncHaloProxy(this);
    scheduleController(this);
  }

  _resetVisual() {
    this.held = false;
    this.waveActive = false;
    this.rimCatchStartMs = 0;
    this.rimCatchFired = false;
    this.rimEnv = 0;
    this.spring.pos = 0;
    this.spring.vel = 0;
    this.el.classList.remove('is-glass-held', 'is-glass-waving', 'is-glass-rim-catch');
    const s = this.el.style;
    s.removeProperty('--cg-hold');
    s.removeProperty('--cg-press-y');
    s.removeProperty('--cg-press-scale');
    s.removeProperty('--cg-wave-r');
    s.removeProperty('--cg-wave-band');
    s.removeProperty('--cg-wave-alpha');
    s.removeProperty('--cg-disp');
    s.removeProperty('--cg-rim-catch');
    syncHaloProxy(this);
  }

  _step(nowMs, dtSec) {
    const s = this.el.style;

    // 1. Step unified second-order damped spring (MengTo smooth critically-damped press & clean elastic release)
    const target = this.held ? 1 : 0;
    const springCfg = this.held ? CRT_GLASS_SPRINGS.buttonPress : CRT_GLASS_SPRINGS.buttonRelease;
    const springSettled = stepSecondOrderSpring(this.spring, target, springCfg, dtSec);
    const holdAmt = Math.max(-0.08, Math.min(1.06, this.spring.pos));

    const pressOffset = this.isLiquidPilot ? 1.6 : this.level.pressOffsetPx;
    const pressTargetScale = this.isLiquidPilot ? 0.972 : this.level.pressScale;
    const pressY = Math.max(0, holdAmt * pressOffset);
    const pressScale = 1 - holdAmt * (1 - pressTargetScale);
    s.setProperty('--cg-hold', Math.max(0, holdAmt).toFixed(4));
    s.setProperty('--cg-press-y', `${pressY.toFixed(2)}px`);
    s.setProperty('--cg-press-scale', pressScale.toFixed(4));

    // Dynamic living refraction pulse while held (scales cleanly for both 56px quick-links and 36px CTA pills
    // so the glowing cyan-violet refraction ring stays vividly alive inside every button!)
    if (this.held) {
      const holdSec = Math.max(0, (nowMs - this.holdStartMs) * 0.001);
      const minDim = Math.min(this.btnW, this.btnH);
      const scaleFactor = Math.max(0.58, Math.min(1.0, minDim / 52));
      const pulseR = (20 + 26 * (1 - Math.exp(-holdSec * 4.2)) + Math.sin(holdSec * 6.2) * 5.5) * scaleFactor;
      s.setProperty('--cg-hold-r', `${pulseR.toFixed(1)}px`);
    }

    // 2. Step exact MengTo release wave:
    //    travel = (1 - pow(1 - t, 1.7)) * (reach + bandWidth) over 750ms (pilot) / 440ms (standard)
    const tier = getActivePerfTier();
    let waveRunning = false;
    if (this.waveActive && this.level.enableWave && tier.buttonWave !== 'css') {
      const elapsed = nowMs - this.waveStartMs;
      const dur = this.isLiquidPilot ? 750 : this.level.releaseDurationMs;
      const power = this.isLiquidPilot ? 1.7 : CRT_GLASS.releaseWavePower;
      const t = Math.min(1, Math.max(0, elapsed / dur));
      const bandWidth = this.btnW >= CRT_GLASS.waveWideThresholdPx ? CRT_GLASS.waveBandWidePx : CRT_GLASS.waveBandPx;
      const travel = (1 - Math.pow(1 - t, power)) * (this.reach + bandWidth);
      // r96: Smoothstep onset (0 -> 1 over first 9% of wave) so brightness rises & decays continuously with ZERO 1-frame snap!
      const onset = Math.min(1, t / 0.09);
      const smoothOnset = onset * onset * (3 - 2 * onset);
      const fade = Math.pow(1 - t, 1.25) * smoothOnset;

      s.setProperty('--cg-wave-r', `${travel.toFixed(1)}px`);
      s.setProperty('--cg-wave-band', `${bandWidth.toFixed(1)}px`);
      s.setProperty('--cg-wave-alpha', Math.min(1, fade).toFixed(3));

      // Delicate 0.35px (pilot) / 0.6px spectral split confined to passing crest
      const maxDisp = this.isLiquidPilot ? 0.35 : CRT_GLASS.dispersionPx;
      if (this.level.enableDispersion && tier.dispersion && elapsed <= 180) {
        const dispEnv = Math.sin((elapsed / 180) * Math.PI);
        s.setProperty('--cg-disp', `${(maxDisp * dispEnv).toFixed(3)}px`);
      } else {
        s.setProperty('--cg-disp', '0px');
      }

      // r96: One-shot rim shimmer (rimCatchFired guards against re-triggering 3-4x during the 750ms wave!)
      if (this.level.enableRimCatch && !this.rimCatchFired && travel >= Math.max(6, this.nearestRim)) {
        this.rimCatchFired = true;
        this.rimCatchStartMs = nowMs;
        this.el.classList.add('is-glass-rim-catch');
      }

      if (t >= 1) {
        this.waveActive = false;
        this.el.classList.remove('is-glass-waving');
        s.setProperty('--cg-wave-alpha', '0');
        s.setProperty('--cg-disp', '0px');
      } else {
        waveRunning = true;
      }
    }

    // 3. Step single smooth raised-cosine rim shimmer (320ms, zero sharp flash!)
    let rimRunning = false;
    if (this.rimCatchStartMs > 0) {
      const rimDur = 320;
      const rimElapsed = nowMs - this.rimCatchStartMs;
      if (rimElapsed < rimDur) {
        const u = Math.min(1, Math.max(0, rimElapsed / rimDur));
        const rimEnv = 0.5 - 0.5 * Math.cos(u * Math.PI * 2);
        this.rimEnv = rimEnv;
        s.setProperty('--cg-rim-catch', rimEnv.toFixed(3));
        rimRunning = true;
      } else {
        this.rimCatchStartMs = 0;
        this.rimEnv = 0;
        this.el.classList.remove('is-glass-rim-catch');
        s.setProperty('--cg-rim-catch', '0');
      }
    }

    const stillActive = this.held || !springSettled || waveRunning || rimRunning;
    if (!stillActive) {
      this._resetVisual();
    } else {
      syncHaloProxy(this);
    }
    return stillActive;
  }
}

const controllerByElement = new WeakMap();
let delegatedListenersInstalled = false;
let currentHoveredCtrl = null;
const activePointerCtrlById = new Map();
let activeKeyCtrl = null;

function resolveBoundController(target, autoAttach = false) {
  if (!(target instanceof Element)) return null;
  const boundEl = target.closest('[data-crt-glass-bound]');
  if (boundEl) {
    const existing = controllerByElement.get(boundEl);
    if (existing) return existing;
  }
  if (!autoAttach) return null;
  const found = findNearestGlassCandidate(target);
  if (!found) return null;
  return attachCrtGlassButton(found.el, found.level);
}

function installDelegatedGlassListeners() {
  if (delegatedListenersInstalled || typeof document === 'undefined') return;
  delegatedListenersInstalled = true;

  document.addEventListener('pointerover', (e) => {
    const ctrl = resolveBoundController(e.target, true);
    if (ctrl === currentHoveredCtrl) return;
    if (currentHoveredCtrl) {
      currentHoveredCtrl._handlePointerLeave();
    }
    currentHoveredCtrl = ctrl;
    if (ctrl) {
      ctrl._handlePointerEnter(e);
    }
  }, true);

  document.addEventListener('pointerout', (e) => {
    if (!currentHoveredCtrl) return;
    const nextTarget = e.relatedTarget;
    if (nextTarget instanceof Node && currentHoveredCtrl.el.contains(nextTarget)) return;
    const leavingCtrl = resolveBoundController(e.target, false);
    if (leavingCtrl === currentHoveredCtrl || !currentHoveredCtrl.el.isConnected) {
      currentHoveredCtrl._handlePointerLeave();
      currentHoveredCtrl = null;
    }
  }, true);

  document.addEventListener('pointermove', (e) => {
    const activeCtrl = activePointerCtrlById.get(e.pointerId) || currentHoveredCtrl;
    if (activeCtrl && activeCtrl.el.isConnected) {
      activeCtrl._handlePointerMove(e);
    }
  }, { passive: true });

  document.addEventListener('pointerdown', (e) => {
    const ctrl = resolveBoundController(e.target, true);
    if (!ctrl) return;
    activePointerCtrlById.set(e.pointerId, ctrl);
    ctrl._handlePointerDown(e);
  }, true);

  document.addEventListener('pointerup', (e) => {
    const ctrl = activePointerCtrlById.get(e.pointerId) || resolveBoundController(e.target, false);
    activePointerCtrlById.delete(e.pointerId);
    if (ctrl) ctrl._handlePointerUp(e);
  }, true);

  const handlePointerAbort = (e) => {
    const ctrl = activePointerCtrlById.get(e.pointerId) || resolveBoundController(e.target, false);
    activePointerCtrlById.delete(e.pointerId);
    if (ctrl) ctrl._handlePointerCancel();
  };
  document.addEventListener('pointercancel', handlePointerAbort, true);
  document.addEventListener('lostpointercapture', handlePointerAbort, true);

  document.addEventListener('keydown', (e) => {
    if (e.key !== ' ' && e.key !== 'Enter') return;
    const ctrl = resolveBoundController(e.target, true);
    if (!ctrl) return;
    activeKeyCtrl = ctrl;
    ctrl._handleKeyDown(e);
  }, true);

  document.addEventListener('keyup', (e) => {
    if (e.key !== ' ' && e.key !== 'Enter') return;
    const ctrl = activeKeyCtrl || resolveBoundController(e.target, false);
    activeKeyCtrl = null;
    if (ctrl) ctrl._handleKeyUp(e);
  }, true);

  document.addEventListener('blur', (e) => {
    const ctrl = resolveBoundController(e.target, false);
    if (ctrl) {
      if (activeKeyCtrl === ctrl) activeKeyCtrl = null;
      ctrl._handleCancelVisual();
    }
  }, true);
}

export function attachCrtGlassButton(el, levelName = 'glass-primary') {
  if (!el || !(el instanceof Element)) return null;
  if (el.dataset.crtGlassBound) return controllerByElement.get(el) || null;
  syncCrtGlassCssVars();
  installDelegatedGlassListeners();
  const ctrl = new CrtGlassButtonController(el, levelName);
  controllerByElement.set(el, ctrl);
  return ctrl;
}

// r88 + r95 Unified Semantic Glass Binding Rules (covers ALL static & dynamically rendered controls
// across every SPA window AND standalone subpages: Whiteboard, Japanese Subtext, all 5 Game Shells)
const GLASS_SCOPE_SELECTOR = '.xp-window, #account-popover, #welcome-modal, #video-modal, #transfer-app, .game-shell, .trainer-shell, #whiteboard-root, .whiteboard-page';
const GLASS_EXCLUDE_ANCESTOR = '#article-detail-body, iframe, .excalidraw, [data-no-glass]';
const GLASS_CLOSE_MATCH = '.close-button, .account-close-button';
const GLASS_ICON_MATCH = '#video-window-maximize, [data-article-scroll-top], .chat-tool-button, .chat-room-help-trigger, .room-help-toggle, .about-social-link, .account-password-toggle, .transfer-pending-remove';
const GLASS_CARD_MATCH = '.article-card:not(.article-card-skeleton)';
const GLASS_PRIMARY_MATCH = [
  'button',
  '.xp-button',
  '.xp-control',
  '.quick-link',
  '.card-action',
  '.article-card-cta',
  '.category-button',
  '.filter-button',
  '[data-filter-type]',
  '.recent-update-link',
  '.article-toc-link',
  '.transfer-file-picker',
  '.game-source-link',
  '.back-link',
  '.trainer-back-link',
  '.whiteboard-button',
  '.header-link',
  '.game-tools-toggle',
  '.tool-button',
  '.file-button',
  'summary'
].join(', ');
const GLASS_CANDIDATE_SELECTOR = `${GLASS_CLOSE_MATCH}, ${GLASS_ICON_MATCH}, ${GLASS_PRIMARY_MATCH}, ${GLASS_CARD_MATCH}`;

export function resolveGlassLevel(el) {
  if (!(el instanceof Element)) return null;
  if (!el.closest(GLASS_SCOPE_SELECTOR)) return null;
  if (el.closest(GLASS_EXCLUDE_ANCESTOR)) return null;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'OPTION') return null;
  if (el.matches(GLASS_CLOSE_MATCH)) return 'glass-close';
  if (el.matches(GLASS_ICON_MATCH)) return 'glass-icon';
  if (el.matches(GLASS_CARD_MATCH)) return 'glass-card';
  if (el.matches(GLASS_PRIMARY_MATCH)) return 'glass-primary';
  return null;
}

let autoGlassInstalled = false;
let pendingRoots = new Set();
let autoBindRaf = 0;
let pendingBindElements = [];
let bindChunkTimer = 0;

function drainBindChunk() {
  bindChunkTimer = 0;
  if (!pendingBindElements.length) return;
  syncCrtGlassCssVars();
  const startMs = performance.now();
  let count = 0;
  while (pendingBindElements.length > 0 && count < 12 && (performance.now() - startMs) < 6) {
    const el = pendingBindElements.shift();
    if (!el || !el.isConnected || el.dataset.crtGlassBound) continue;
    const level = resolveGlassLevel(el);
    if (level) {
      attachCrtGlassButton(el, level);
      count++;
    }
  }
  if (pendingBindElements.length > 0) {
    bindChunkTimer = window.setTimeout(drainBindChunk, 0);
  }
}

function enqueueGlassCandidatesFromRoot(root) {
  if (!root) return;
  if (root instanceof Element) {
    if (!root.dataset.crtGlassBound && resolveGlassLevel(root)) {
      pendingBindElements.push(root);
    }
  }
  if (typeof root.querySelectorAll === 'function') {
    root.querySelectorAll(GLASS_CANDIDATE_SELECTOR).forEach((el) => {
      if (!el.dataset.crtGlassBound) {
        pendingBindElements.push(el);
      }
    });
  }
  if (pendingBindElements.length > 0 && !bindChunkTimer) {
    bindChunkTimer = window.setTimeout(drainBindChunk, 0);
  }
}

function flushAutoBindQueue() {
  autoBindRaf = 0;
  const roots = [...pendingRoots];
  pendingRoots.clear();
  for (const root of roots) {
    if (root && root.isConnected) {
      enqueueGlassCandidatesFromRoot(root);
    }
  }
}

function queueAutoBind(node) {
  if (!(node instanceof Element)) return;
  if (node.id === 'crt-glass-halo-layer' || node.classList.contains('crt-glass-halo-proxy') || node.classList.contains('crt-glass-sheen-layer') || node.classList.contains('crt-glass-wave-layer')) return;
  pendingRoots.add(node);
  if (!autoBindRaf) {
    autoBindRaf = requestAnimationFrame(flushAutoBindQueue);
  }
}

function findNearestGlassCandidate(target) {
  if (!(target instanceof Element)) return null;
  const match = target.closest(GLASS_CANDIDATE_SELECTOR);
  if (!match) return null;
  const level = resolveGlassLevel(match);
  return level ? { el: match, level } : null;
}

export function installAutoGlassBinding() {
  if (autoGlassInstalled) return;
  autoGlassInstalled = true;
  document.documentElement.dataset.crtGlassReady = '1';
  syncCrtGlassCssVars();
  installDelegatedGlassListeners();

  // Single lightweight body MutationObserver (rAF-debounced, ignores own optical layers)
  // so every dynamically rendered button/card receives .crt-glass-btn immediately upon mount.
  if (document.body && typeof MutationObserver === 'function') {
    const obs = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type !== 'childList' || !m.addedNodes.length) continue;
        for (const node of m.addedNodes) {
          if (node instanceof Element) queueAutoBind(node);
        }
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  enqueueGlassCandidatesFromRoot(document);
}

export function getCrtGlassAudit() {
  const all = [...document.querySelectorAll('[data-crt-glass-bound]')];
  const counts = { 'glass-primary': 0, 'glass-icon': 0, 'glass-close': 0, 'glass-card': 0 };
  for (const el of all) {
    const k = el.dataset.crtGlassBound;
    counts[k] = (counts[k] || 0) + 1;
  }
  const unbound = [];
  document.querySelectorAll(GLASS_CANDIDATE_SELECTOR).forEach((el) => {
    if (!el.dataset.crtGlassBound && resolveGlassLevel(el)) {
      unbound.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')}`);
    }
  });
  const excludedLeaks = document.querySelectorAll(
    'input[data-crt-glass-bound], textarea[data-crt-glass-bound], select[data-crt-glass-bound], #article-detail-body a[data-crt-glass-bound]'
  ).length;
  return {
    totalBound: all.length,
    counts,
    unboundCount: unbound.length,
    unboundSamples: unbound.slice(0, 10),
    excludedLeaks,
    autoDelegationActive: autoGlassInstalled,
    tier: document.documentElement.dataset.performanceTier || 'high',
    reducedMotion: prefersReducedMotion()
  };
}

export function attachWelcomePilotButtons() {
  syncCrtGlassCssVars();
  const buttons = document.querySelectorAll('#welcome-modal .quick-link');
  const bound = [];
  buttons.forEach((btn) => {
    const ctrl = attachCrtGlassButton(btn, 'glass-primary');
    if (ctrl) bound.push(ctrl);
  });
  return bound;
}

export function attachSiteGlassButtons(root = document) {
  syncCrtGlassCssVars();
  const bound = [];
  if (root instanceof Element) {
    const selfLevel = resolveGlassLevel(root);
    if (selfLevel && !root.dataset.crtGlassBound) {
      const ctrl = attachCrtGlassButton(root, selfLevel);
      if (ctrl) bound.push(ctrl);
    }
  }
  if (!root || !root.querySelectorAll) return bound;
  root.querySelectorAll(GLASS_CANDIDATE_SELECTOR).forEach((el) => {
    if (el.dataset.crtGlassBound) return;
    const level = resolveGlassLevel(el);
    if (!level) return;
    const ctrl = attachCrtGlassButton(el, level);
    if (ctrl) bound.push(ctrl);
  });
  return bound;
}

export function getCrtGlassButtonPerfStats() {
  return {
    activeCount: activeControllers.size,
    frames: perfStats.frames,
    avgJsMs: perfStats.frames ? +(perfStats.totalJsMs / perfStats.frames).toFixed(4) : 0,
    maxJsMs: +perfStats.maxJsMs.toFixed(4)
  };
}
