// 120 FPS Damped Spring Window Open / Close Controller
// Pure compositor animation (transform + opacity ONLY) using Astra Spec Section 2 spring tokens:
// - windowOpen:  zeta = 0.78, omega0 = 17 (~450ms, crisp launch, gentle settle, no rubbery bounce)
// - windowClose: zeta = 0.90, omega0 = 20 (~300ms, fast mirror retraction back into icon rect)
// Fully interruptible mid-flight (re-opening or switching icons takes over from live pos/vel).
// Supports both Desktop Pond icons and Mobile Dock icons, plus prefers-reduced-motion opacity fallback.

import { CRT_GLASS_SPRINGS } from './crt-glass-config.mjs?v=20261123-pond-glass-r59';

const DESKTOP_ICON_COORDS = {
  knowledge: { x: 0.395, y: 0.245 },
  article:   { x: 0.395, y: 0.245 },
  videos:    { x: 0.650, y: 0.235 },
  resources: { x: 0.880, y: 0.345 },
  games:     { x: 0.120, y: 0.495 },
  chatroom:  { x: 0.300, y: 0.740 },
  about:     { x: 0.850, y: 0.745 },
  welcome:   { x: 0.500, y: 0.048 }
};

function prefersReducedMotion() {
  return Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

function isMobileViewport() {
  return document.documentElement.dataset.shell === 'mobile'
    || document.documentElement.dataset.uiShell === 'mobile'
    || window.innerWidth <= 768;
}

function resolveWindowElement(mode) {
  if (!mode || mode === 'home') return null;
  if (mode === 'welcome') {
    return document.querySelector('#welcome-modal .xp-window');
  }
  const sectionId = mode === 'article' ? 'knowledge' : mode;
  return document.querySelector(`#${sectionId} .xp-window`);
}

function resolveOriginPoint(mode, explicitOrigin = null) {
  if (explicitOrigin && Number.isFinite(explicitOrigin.x) && Number.isFinite(explicitOrigin.y)) {
    return explicitOrigin;
  }
  const vw = window.innerWidth || 1280;
  const vh = window.innerHeight || 720;

  if (isMobileViewport()) {
    const routeKey = mode === 'article' ? 'knowledge' : mode;
    const dockBtn = document.querySelector(
      `.mobile-dock [data-route="${routeKey}"], #mobile-dock [data-route="${routeKey}"], [data-mobile-dock] [data-route="${routeKey}"]`
    );
    if (dockBtn) {
      const r = dockBtn.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        return { x: r.left + r.width * 0.5, y: r.top + r.height * 0.5 };
      }
    }
    return { x: vw * 0.5, y: vh - 40 };
  }

  const norm = DESKTOP_ICON_COORDS[mode] || { x: 0.5, y: 0.5 };
  return { x: norm.x * vw, y: norm.y * vh };
}

function stepSecondOrderSpring(state, target, spring, dtSec) {
  // Semi-implicit Euler with sub-stepping for identical 60Hz / 120Hz / 240Hz feel
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
  const settled = Math.abs(state.pos - target) < 0.0025 && Math.abs(state.vel) < 0.015;
  if (settled) {
    state.pos = target;
    state.vel = 0;
  }
  return settled;
}

export class CrtWindowSpringController {
  constructor() {
    this.active = null; // { el, mode, target, pos, vel, dx, dy, startScale, startMs, onComplete, reduced }
    this.rafId = 0;
    this.lastFrameMs = 0;
    this.scrimEl = null;
    this.perf = {
      frames: 0,
      totalJsMs: 0,
      maxJsMs: 0,
      lastOpenMs: 0,
      lastCloseMs: 0
    };
    this._tick = this._tick.bind(this);
  }

  _ensureScrim() {
    if (this.scrimEl && this.scrimEl.isConnected) return this.scrimEl;
    let scrim = document.getElementById('pond-window-scrim');
    if (!scrim) {
      scrim = document.createElement('div');
      scrim.id = 'pond-window-scrim';
      scrim.setAttribute('aria-hidden', 'true');
      const backdrop = document.getElementById('pond-visual-backdrop');
      if (backdrop && backdrop.parentNode) {
        backdrop.parentNode.insertBefore(scrim, backdrop.nextSibling);
      } else {
        document.body.prepend(scrim);
      }
    }
    this.scrimEl = scrim;
    return scrim;
  }

  _setScrimProgress(p) {
    if (isMobileViewport()) return;
    const scrim = this._ensureScrim();
    const clamped = Math.max(0, Math.min(1, p));
    scrim.style.opacity = (clamped * 0.34).toFixed(3);
  }

  _clearElementStyles(el) {
    if (!el) return;
    el.classList.remove('is-pond-window-animating');
    el.style.transform = '';
    el.style.opacity = '';
    el.style.willChange = '';
    el.style.transformOrigin = '';
  }

  _measureDelta(el, mode, explicitOrigin) {
    // Temporarily clear transform ONCE before animation starts to read exact resting rect
    const prevTransform = el.style.transform;
    el.style.transform = 'none';
    const rect = el.getBoundingClientRect();
    el.style.transform = prevTransform;

    const winW = Math.max(120, rect.width || window.innerWidth * 0.65);
    const winH = Math.max(120, rect.height || window.innerHeight * 0.65);
    const winCx = rect.left + winW * 0.5;
    const winCy = rect.top + winH * 0.5;
    const origin = resolveOriginPoint(mode, explicitOrigin);

    const dx = origin.x - winCx;
    const dy = origin.y - winCy;
    const startScale = Math.max(0.14, Math.min(0.28, 76 / Math.max(winW, winH)));
    return { dx, dy, startScale };
  }

  _applyFrame(anim) {
    const p = anim.pos;
    if (anim.reduced) {
      const op = Math.max(0, Math.min(1, p));
      anim.el.style.opacity = op.toFixed(3);
      anim.el.style.transform = '';
      this._setScrimProgress(op);
      return;
    }

    const inv = 1 - p;
    const tx = anim.dx * inv;
    const ty = anim.dy * inv;
    // Allow subtle ~2% overshoot from zeta=0.78 while clamping negative values safely
    const sc = Math.max(0.08, anim.startScale + (1 - anim.startScale) * p);
    const op = anim.target === 1
      ? Math.max(0, Math.min(1, p * 1.65))
      : Math.max(0, Math.min(1, p * 1.35));

    anim.el.style.transform = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0) scale(${sc.toFixed(4)})`;
    anim.el.style.opacity = op.toFixed(3);
    this._setScrimProgress(p);
  }

  cancel() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
    if (this.active) {
      this._clearElementStyles(this.active.el);
      this.active = null;
    }
    this.lastFrameMs = 0;
  }

  isClosingMode(mode) {
    return Boolean(this.active && this.active.target === 0 && (!mode || this.active.mode === mode));
  }

  animateOpen(mode, explicitOrigin = null) {
    const el = resolveWindowElement(mode);
    if (!el) return false;

    const reduced = prefersReducedMotion();
    const isSameEl = this.active && this.active.el === el;

    // Interruptible handoff: if this exact window was mid-close, reverse cleanly from current pos/vel!
    let startPos = 0;
    let startVel = 0;
    if (isSameEl) {
      startPos = this.active.pos;
      startVel = this.active.vel;
    } else if (this.active) {
      this._clearElementStyles(this.active.el);
    }

    const { dx, dy, startScale } = this._measureDelta(el, mode, explicitOrigin);
    el.classList.add('is-pond-window-animating');
    el.style.willChange = 'transform, opacity';
    el.style.transformOrigin = '50% 50%';

    this.active = {
      el,
      mode,
      target: 1,
      pos: startPos,
      vel: startVel,
      dx,
      dy,
      startScale,
      startMs: performance.now(),
      onComplete: null,
      reduced
    };

    // Paint initial frame synchronously to prevent 1-frame flash at full scale!
    this._applyFrame(this.active);
    this._schedule();
    return true;
  }

  animateClose(mode, onComplete, explicitOrigin = null) {
    const el = resolveWindowElement(mode);
    if (!el) {
      this._setScrimProgress(0);
      if (typeof onComplete === 'function') onComplete();
      return false;
    }

    const reduced = prefersReducedMotion();
    const isSameEl = this.active && this.active.el === el;

    // Interruptible handoff: if closing mid-open, retract smoothly from current pos/vel!
    let startPos = 1;
    let startVel = 0;
    let dx;
    let dy;
    let startScale;

    if (isSameEl) {
      startPos = this.active.pos;
      startVel = this.active.vel;
      dx = this.active.dx;
      dy = this.active.dy;
      startScale = this.active.startScale;
    } else {
      if (this.active) this._clearElementStyles(this.active.el);
      ({ dx, dy, startScale } = this._measureDelta(el, mode, explicitOrigin));
    }

    el.classList.add('is-pond-window-animating');
    el.style.willChange = 'transform, opacity';
    el.style.transformOrigin = '50% 50%';

    this.active = {
      el,
      mode,
      target: 0,
      pos: startPos,
      vel: startVel,
      dx,
      dy,
      startScale,
      startMs: performance.now(),
      onComplete: typeof onComplete === 'function' ? onComplete : null,
      reduced
    };

    this._applyFrame(this.active);
    this._schedule();
    return true;
  }

  syncScrimImmediate(isOpen) {
    if (this.active) return;
    this._setScrimProgress(isOpen ? 1 : 0);
  }

  _schedule() {
    if (!this.rafId) {
      this.lastFrameMs = performance.now();
      this.rafId = requestAnimationFrame(this._tick);
    }
  }

  _tick(nowMs) {
    this.rafId = 0;
    const anim = this.active;
    if (!anim) {
      this.lastFrameMs = 0;
      return;
    }

    const t0 = performance.now();
    const dtSec = this.lastFrameMs
      ? Math.min(0.033, Math.max(0.001, (nowMs - this.lastFrameMs) * 0.001))
      : 0.0083;
    this.lastFrameMs = nowMs;

    let settled = false;
    if (anim.reduced) {
      const dur = 120;
      const t = Math.min(1, (nowMs - anim.startMs) / dur);
      anim.pos = anim.target === 1 ? t : (1 - t);
      settled = t >= 1;
    } else {
      const springCfg = anim.target === 1 ? CRT_GLASS_SPRINGS.windowOpen : CRT_GLASS_SPRINGS.windowClose;
      settled = stepSecondOrderSpring(anim, anim.target, springCfg, dtSec);
      // Fast finish threshold on close so window doesn't linger at 2% opacity
      if (anim.target === 0 && anim.pos <= 0.02) {
        anim.pos = 0;
        anim.vel = 0;
        settled = true;
      }
    }

    this._applyFrame(anim);

    const jsCost = performance.now() - t0;
    this.perf.frames += 1;
    this.perf.totalJsMs += jsCost;
    if (jsCost > this.perf.maxJsMs) this.perf.maxJsMs = jsCost;

    if (!settled) {
      this.rafId = requestAnimationFrame(this._tick);
    } else {
      const elapsed = Math.round(nowMs - anim.startMs);
      if (anim.target === 1) this.perf.lastOpenMs = elapsed;
      else this.perf.lastCloseMs = elapsed;

      const cb = anim.onComplete;
      const el = anim.el;
      const target = anim.target;
      this.active = null;
      this.lastFrameMs = 0;

      if (target === 1) {
        this._clearElementStyles(el);
        this._setScrimProgress(1);
      } else {
        this._setScrimProgress(0);
        if (cb) cb();
        // Clear inline styles after DOM hides so next open measures cleanly
        requestAnimationFrame(() => this._clearElementStyles(el));
      }
    }
  }

  getPerfStats() {
    return {
      active: Boolean(this.active),
      frames: this.perf.frames,
      avgJsMs: this.perf.frames ? +(this.perf.totalJsMs / this.perf.frames).toFixed(4) : 0,
      maxJsMs: +this.perf.maxJsMs.toFixed(4),
      lastOpenMs: this.perf.lastOpenMs,
      lastCloseMs: this.perf.lastCloseMs
    };
  }
}
