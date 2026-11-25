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
} from './crt-glass-config.mjs?v=20261125-glass-auto-r88';

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

class CrtGlassButtonController {
  constructor(el, levelName = 'glass-primary') {
    this.el = el;
    this.levelName = levelName;
    this.level = CRT_GLASS_BUTTON_LEVELS[levelName] || CRT_GLASS_BUTTON_LEVELS['glass-primary'];
    this.held = false;
    this.hovered = false;
    this.holdStartMs = 0;
    this.spring = { pos: 0, vel: 0 }; // 0 = rest, 1 = fully pressed
    this.contactX = 0;
    this.contactY = 0;
    this.btnW = 120;
    this.btnH = 36;
    this.reach = 120;
    this.nearestRim = 18;
    this.waveActive = false;
    this.waveStartMs = 0;
    this.rimCatchStartMs = 0;
    this.activePointerId = null;

    el.classList.add('crt-glass-btn', levelName);
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

    this._onPointerEnter = this._handlePointerEnter.bind(this);
    this._onPointerMove = this._handlePointerMove.bind(this);
    this._onPointerLeave = this._handlePointerLeave.bind(this);
    this._onPointerDown = this._handlePointerDown.bind(this);
    this._onPointerUp = this._handlePointerUp.bind(this);
    this._onPointerCancel = this._handlePointerCancel.bind(this);
    this._onKeyDown = this._handleKeyDown.bind(this);
    this._onKeyUp = this._handleKeyUp.bind(this);
    this._onBlur = this._handleCancelVisual.bind(this);

    el.addEventListener('pointerenter', this._onPointerEnter);
    el.addEventListener('pointermove', this._onPointerMove);
    el.addEventListener('pointerleave', this._onPointerLeave);
    el.addEventListener('pointerdown', this._onPointerDown);
    el.addEventListener('pointerup', this._onPointerUp);
    el.addEventListener('pointercancel', this._onPointerCancel);
    el.addEventListener('lostpointercapture', this._onPointerCancel);
    el.addEventListener('keydown', this._onKeyDown);
    el.addEventListener('keyup', this._onKeyUp);
    el.addEventListener('blur', this._onBlur);
  }

  _updateHoverLiquid(clientX, clientY) {
    const rect = this.el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const hx = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const hy = Math.max(0, Math.min(rect.height, clientY - rect.top));
    const normX = (hx / rect.width) * 2 - 1; // -1..1
    const angleDeg = 108 + normX * 36;
    const s = this.el.style;
    s.setProperty('--cg-hx', `${hx.toFixed(1)}px`);
    s.setProperty('--cg-hy', `${hy.toFixed(1)}px`);
    s.setProperty('--cg-sheen-ang', `${angleDeg.toFixed(1)}deg`);
  }

  _handlePointerEnter(e) {
    if (this.el.disabled) return;
    this.hovered = true;
    this.el.classList.add('is-glass-hovered');
    this._updateHoverLiquid(e.clientX, e.clientY);
  }

  _handlePointerMove(e) {
    if (this.el.disabled) return;
    if (!this.hovered) {
      this.hovered = true;
      this.el.classList.add('is-glass-hovered');
    }
    this._updateHoverLiquid(e.clientX, e.clientY);
  }

  _handlePointerLeave() {
    this.hovered = false;
    this.el.classList.remove('is-glass-hovered');
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
      } catch {}
      this.activePointerId = null;
    }
  }

  _beginHold() {
    this.held = true;
    this.holdStartMs = performance.now();
    // Double-tap replaces any running release wave cleanly (no wave accumulation)
    this.waveActive = false;
    this.el.classList.remove('is-glass-waving', 'is-glass-rim-catch');
    this.el.classList.add('is-glass-held');

    if (prefersReducedMotion()) {
      this.el.style.setProperty('--cg-hold', '1');
      return;
    }
    // Synchronous Frame-0 tactile onset so even fast clicks visibly depress & refract immediately
    this.spring.pos = Math.max(this.spring.pos, 0.52);
    const s = this.el.style;
    const initY = this.spring.pos * this.level.pressOffsetPx;
    const initScale = 1 - this.spring.pos * (1 - this.level.pressScale);
    s.setProperty('--cg-hold', this.spring.pos.toFixed(4));
    s.setProperty('--cg-press-y', `${initY.toFixed(2)}px`);
    s.setProperty('--cg-press-scale', initScale.toFixed(4));
    s.setProperty('--cg-hold-r', '18px');
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
      this.el.classList.add('is-glass-waving');
      // Synchronous Frame-0 wave onset so release ring is visibly expanding from the very first frame
      const bandWidth = this.btnW >= CRT_GLASS.waveWideThresholdPx ? CRT_GLASS.waveBandWidePx : CRT_GLASS.waveBandPx;
      const s = this.el.style;
      s.setProperty('--cg-wave-r', '10.0px');
      s.setProperty('--cg-wave-band', `${bandWidth.toFixed(1)}px`);
      s.setProperty('--cg-wave-alpha', '0.96');
      s.setProperty('--cg-disp', `${CRT_GLASS.dispersionPx.toFixed(3)}px`);
    } else if (triggerWave && this.level.enableRimCatch) {
      // glass-close: brief rim flash, no release wave
      this.rimCatchStartMs = performance.now();
      this.el.classList.add('is-glass-rim-catch');
      this.el.style.setProperty('--cg-rim-catch', '1');
    }
    scheduleController(this);
  }

  _resetVisual() {
    this.held = false;
    this.waveActive = false;
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
  }

  _step(nowMs, dtSec) {
    const s = this.el.style;

    // 1. Step unified second-order damped spring (press vs release)
    const target = this.held ? 1 : 0;
    const springCfg = this.held ? CRT_GLASS_SPRINGS.buttonPress : CRT_GLASS_SPRINGS.buttonRelease;
    const springSettled = stepSecondOrderSpring(this.spring, target, springCfg, dtSec);
    const holdAmt = Math.max(0, Math.min(1.15, this.spring.pos));

    const pressY = holdAmt * this.level.pressOffsetPx;
    const pressScale = 1 - holdAmt * (1 - this.level.pressScale);
    s.setProperty('--cg-hold', holdAmt.toFixed(4));
    s.setProperty('--cg-press-y', `${pressY.toFixed(2)}px`);
    s.setProperty('--cg-press-scale', pressScale.toFixed(4));

    // Dynamic living refraction pulse while held (so hold is visibly alive, never a frozen static circle)
    if (this.held) {
      const holdSec = Math.max(0, (nowMs - this.holdStartMs) * 0.001);
      const pulseR = 20 + 26 * (1 - Math.exp(-holdSec * 4.2)) + Math.sin(holdSec * 6.2) * 5.5;
      s.setProperty('--cg-hold-r', `${pulseR.toFixed(1)}px`);
    }

    // 2. Step MengTo non-linear release wave (travel = (1 - (1 - t)^1.55) * (reach + bandWidth))
    const tier = getActivePerfTier();
    let waveRunning = false;
    if (this.waveActive && this.level.enableWave && tier.buttonWave !== 'css') {
      const elapsed = nowMs - this.waveStartMs;
      const dur = this.level.releaseDurationMs;
      const t = Math.min(1, Math.max(0, elapsed / dur));
      const bandWidth = this.btnW >= CRT_GLASS.waveWideThresholdPx ? CRT_GLASS.waveBandWidePx : CRT_GLASS.waveBandPx;
      const travel = 8 + (1 - Math.pow(1 - t, CRT_GLASS.releaseWavePower)) * (this.reach + bandWidth * 1.2);
      const fade = Math.pow(1 - t, 0.85) * Math.min(1, t * 14 + 0.35);

      s.setProperty('--cg-wave-r', `${travel.toFixed(1)}px`);
      s.setProperty('--cg-wave-band', `${bandWidth.toFixed(1)}px`);
      s.setProperty('--cg-wave-alpha', Math.min(1, fade).toFixed(3));

      // Brief RGB spectral split at wave crest (gated by Step 7 performance tier)
      if (this.level.enableDispersion && tier.dispersion && elapsed <= CRT_GLASS.dispersionDurationMs) {
        const dispEnv = Math.sin((elapsed / CRT_GLASS.dispersionDurationMs) * Math.PI);
        s.setProperty('--cg-disp', `${(CRT_GLASS.dispersionPx * dispEnv).toFixed(3)}px`);
      } else {
        s.setProperty('--cg-disp', '0px');
      }

      // Rim catch glow when wave arrives at nearest button edge (70ms duration)
      if (this.level.enableRimCatch && !this.rimCatchStartMs && travel >= Math.max(6, this.nearestRim)) {
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

    // 3. Step 70ms rim catch glow
    let rimRunning = false;
    if (this.rimCatchStartMs > 0) {
      const rimElapsed = nowMs - this.rimCatchStartMs;
      if (rimElapsed < CRT_GLASS.rimCatchDurationMs) {
        const rimEnv = Math.sin((rimElapsed / CRT_GLASS.rimCatchDurationMs) * Math.PI);
        s.setProperty('--cg-rim-catch', rimEnv.toFixed(3));
        rimRunning = true;
      } else {
        this.rimCatchStartMs = 0;
        this.el.classList.remove('is-glass-rim-catch');
        s.setProperty('--cg-rim-catch', '0');
      }
    }

    const stillActive = this.held || !springSettled || waveRunning || rimRunning;
    if (!stillActive) {
      this._resetVisual();
    }
    return stillActive;
  }
}

const controllerByElement = new WeakMap();

export function attachCrtGlassButton(el, levelName = 'glass-primary') {
  if (!el || !(el instanceof Element)) return null;
  if (el.dataset.crtGlassBound) return controllerByElement.get(el) || null;
  syncCrtGlassCssVars();
  const ctrl = new CrtGlassButtonController(el, levelName);
  controllerByElement.set(el, ctrl);
  return ctrl;
}

// r88 Unified Semantic Glass Binding Rules (covers ALL static & dynamically rendered controls
// across every window while strictly excluding prose links, inputs, textareas, selects & iframes)
const GLASS_SCOPE_SELECTOR = '.xp-window, #account-popover, #welcome-modal, #video-modal, #transfer-app, .game-shell';
const GLASS_EXCLUDE_ANCESTOR = '#article-detail-body, iframe, .excalidraw, [data-no-glass]';
const GLASS_CLOSE_MATCH = '.close-button, .account-close-button';
const GLASS_ICON_MATCH = '#video-window-maximize, [data-article-scroll-top], .chat-tool-button, .chat-room-help-trigger, .about-social-link, .account-password-toggle, .transfer-pending-remove';
const GLASS_CARD_MATCH = '.article-card:not(.article-card-skeleton)';
const GLASS_PRIMARY_MATCH = [
  'button',
  '.xp-button',
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

function flushAutoBindQueue() {
  autoBindRaf = 0;
  const roots = [...pendingRoots];
  pendingRoots.clear();
  for (const root of roots) {
    if (root && root.isConnected) {
      attachSiteGlassButtons(root);
    }
  }
}

function queueAutoBind(node) {
  if (!(node instanceof Element)) return;
  if (node.classList.contains('crt-glass-sheen-layer') || node.classList.contains('crt-glass-wave-layer')) return;
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
  syncCrtGlassCssVars();

  // 1. Document-level capturing lazy delegation: even an element inserted 0.1ms ago gets
  // immediate live glass hover/press on its very first interaction!
  document.addEventListener('pointerover', (e) => {
    const found = findNearestGlassCandidate(e.target);
    if (!found || found.el.dataset.crtGlassBound) return;
    const ctrl = attachCrtGlassButton(found.el, found.level);
    if (ctrl) ctrl._handlePointerEnter(e);
  }, true);

  document.addEventListener('pointerdown', (e) => {
    const found = findNearestGlassCandidate(e.target);
    if (!found || found.el.dataset.crtGlassBound) return;
    const ctrl = attachCrtGlassButton(found.el, found.level);
    if (ctrl) ctrl._handlePointerDown(e);
  }, true);

  document.addEventListener('keydown', (e) => {
    if (e.key !== ' ' && e.key !== 'Enter') return;
    const found = findNearestGlassCandidate(e.target);
    if (!found || found.el.dataset.crtGlassBound) return;
    const ctrl = attachCrtGlassButton(found.el, found.level);
    if (ctrl) ctrl._handleKeyDown(e);
  }, true);

  // 2. Single lightweight body MutationObserver (rAF-debounced, ignores own optical layers)
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

  attachSiteGlassButtons(document);
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
