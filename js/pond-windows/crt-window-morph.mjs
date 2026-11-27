// Unified Single-Layer GPU Window Zoom Controller (r70)
// Direction approved by site owner: window frame AND content scale together seamlessly from/to icon origin
// Route: Single promoted GPU compositor layer on .xp-window (translate3d + uniform scale + opacity ONLY)
// - Browser rasterizes .xp-window ONCE into a GPU texture and transforms it at 120 FPS with ZERO text reflow,
//   ZERO per-frame border-radius paint, ZERO separate L2 shell, and ZERO double-border ghosting!
// - Analytic 4ms spring LUTs from CRT_GLASS_SPRINGS:
//   * Open:  zeta = 0.88, omega0 = 10, 480ms
//   * Close: zeta = 0.95, omega0 = 12, 400ms (re-measures live icon origin before close)
// - Fully interruptible from live (tx, ty, sc) visual state; prefers-reduced-motion 100ms opacity fallback.

import { CRT_GLASS_SPRINGS } from './crt-glass-config.mjs?v=20261124-window-morph-r65';

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

const ICON_BOX_PX = 76;
const SAMPLE_STEP_MS = 4;

function prefersReducedMotion() {
  return Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

function isMobileViewport() {
  return document.documentElement.dataset.shell === 'mobile'
    || document.documentElement.dataset.uiShell === 'mobile'
    || window.innerWidth <= 768;
}

function buildSpringLut(zeta, omega0, durationMs) {
  const count = Math.max(2, Math.ceil(durationMs / SAMPLE_STEP_MS) + 1);
  const lut = new Float32Array(count);
  const T = durationMs * 0.001;
  const wd = omega0 * Math.sqrt(Math.max(1e-6, 1 - zeta * zeta));
  const evalRaw = (tSec) => {
    const decay = Math.exp(-zeta * omega0 * tSec);
    return 1 - decay * (Math.cos(wd * tSec) + ((zeta * omega0) / wd) * Math.sin(wd * tSec));
  };
  const endVal = evalRaw(T) || 1;
  for (let i = 0; i < count; i++) {
    const tSec = Math.min(T, (i * SAMPLE_STEP_MS) * 0.001);
    lut[i] = evalRaw(tSec) / endVal;
  }
  lut[0] = 0;
  lut[count - 1] = 1;
  return { lut, durationMs, stepMs: SAMPLE_STEP_MS };
}

function sampleLut(table, elapsedMs) {
  if (elapsedMs <= 0) return 0;
  if (elapsedMs >= table.durationMs) return 1;
  const exactIdx = elapsedMs / table.stepMs;
  const i0 = Math.floor(exactIdx);
  const i1 = Math.min(table.lut.length - 1, i0 + 1);
  const frac = exactIdx - i0;
  return table.lut[i0] + (table.lut[i1] - table.lut[i0]) * frac;
}

const OPEN_LUT = buildSpringLut(
  CRT_GLASS_SPRINGS.windowOpen.zeta,
  CRT_GLASS_SPRINGS.windowOpen.omega0,
  CRT_GLASS_SPRINGS.windowOpen.durationMs
);
const CLOSE_LUT = buildSpringLut(
  CRT_GLASS_SPRINGS.windowClose.zeta,
  CRT_GLASS_SPRINGS.windowClose.omega0,
  CRT_GLASS_SPRINGS.windowClose.durationMs
);

function resolveWindowElement(mode) {
  if (!mode || mode === 'home') return null;
  if (mode === 'welcome') return document.querySelector('#welcome-modal .xp-window');
  const sectionId = mode === 'article' ? 'knowledge' : mode;
  return document.querySelector(`#${sectionId} .xp-window`);
}

function cancelCompetingAnimations(el) {
  if (!el || typeof el.getAnimations !== 'function') return;
  try {
    for (const anim of el.getAnimations()) {
      anim.cancel();
    }
  } catch {
    /* Ignore animation cancellation errors on detached elements */
  }
}

function measureLiveIconCenter(mode) {
  const vw = window.innerWidth || 1280;
  const vh = window.innerHeight || 720;

  if (isMobileViewport()) {
    const routeKey = mode === 'article' ? 'knowledge' : mode;
    const dockBtn = document.querySelector(
      `.mobile-dock [data-route="${routeKey}"], #mobile-dock [data-route="${routeKey}"], [data-mobile-dock] [data-route="${routeKey}"]`
    );
    if (dockBtn) {
      const r = dockBtn.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < vh) {
        return { cx: r.left + r.width * 0.5, cy: r.top + r.height * 0.5 };
      }
    }
    return { cx: vw * 0.5, cy: vh - 40 };
  }

  const norm = DESKTOP_ICON_COORDS[mode];
  const canvas = document.getElementById('pond-desktop-canvas');
  if (norm && canvas) {
    const cr = canvas.getBoundingClientRect();
    if (cr.width > 0 && cr.height > 0) {
      const cx = cr.left + norm.x * cr.width;
      const cy = cr.top + norm.y * cr.height;
      if (cx >= 0 && cx <= vw && cy >= 0 && cy <= vh) {
        return { cx, cy };
      }
    }
  }
  return { cx: vw * 0.5, cy: vh * 0.5 };
}

function measureWindowRectSafe(el, mode = '') {
  const vw = window.innerWidth || 1280;
  const vh = window.innerHeight || 720;
  if (el) {
    const prevTransform = el.style.transform;
    el.style.transform = 'none';
    const r = el.getBoundingClientRect();
    el.style.transform = prevTransform;
    if (r.width >= 120 && r.height >= 120) {
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    }
  }
  if (mode === 'about') {
    const w = Math.min(720, Math.round(vw * 0.88));
    const h = Math.min(469, Math.round(vh * 0.72));
    return { x: Math.round((vw - w) * 0.5), y: Math.round((vh - h) * 0.5), w, h };
  }
  if (mode === 'welcome') {
    const w = Math.min(700, Math.round(vw * 0.88));
    const h = Math.min(720, Math.round(vh * 0.82));
    return { x: Math.round((vw - w) * 0.5), y: Math.round((vh - h) * 0.5), w, h };
  }
  const w = Math.min(1040, Math.round(vw * 0.76));
  const h = Math.min(702, Math.round(vh * 0.76));
  return { x: Math.round((vw - w) * 0.5), y: Math.round((vh - h) * 0.5), w, h };
}

export class PondWindowMorphController {
  constructor() {
    this.scrimEl = null;
    this.rafId = 0;
    this.active = null;
    this.perf = {
      openFrames: 0,
      closeFrames: 0,
      frameDeltasMs: [],
      totalJsMs: 0,
      maxJsMs: 0,
      lastOpenMs: 0,
      lastCloseMs: 0
    };
    this._tick = this._tick.bind(this);
  }

  _ensureScrim() {
    if (this.scrimEl && this.scrimEl.isConnected) return;
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
  }

  _setScrim(p) {
    if (isMobileViewport() || !this.scrimEl) return;
    const clamped = Math.max(0, Math.min(1, p));
    this.scrimEl.style.opacity = (clamped * 0.34).toFixed(3);
  }

  _clearWindowVisuals(winEl) {
    if (!winEl) return;
    winEl.classList.remove('is-morph-measuring', 'is-morph-flying');
    winEl.style.visibility = '';
    winEl.style.opacity = '';
    winEl.style.transform = '';
    winEl.style.transformOrigin = '';
    winEl.style.willChange = '';
    winEl.style.pointerEvents = '';
  }

  _applyWindowPose(winEl, tx, ty, sc, op) {
    const s = winEl.style;
    s.transform = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0) scale(${sc.toFixed(5)})`;
    s.opacity = op.toFixed(3);
  }

  isOpeningMode(mode) {
    return Boolean(this.active && this.active.kind === 'open' && this.active.mode === mode);
  }

  isClosingMode(mode) {
    return Boolean(this.active && this.active.kind === 'close' && (!mode || this.active.mode === mode));
  }

  cancelCompetingOn(mode) {
    const winEl = resolveWindowElement(mode);
    if (winEl) {
      cancelCompetingAnimations(winEl);
      if (winEl.parentElement) cancelCompetingAnimations(winEl.parentElement);
    }
    if (mode === 'welcome') {
      const modal = document.getElementById('welcome-modal');
      if (modal) {
        cancelCompetingAnimations(modal);
        const bd = modal.querySelector('.modal-backdrop');
        if (bd) cancelCompetingAnimations(bd);
      }
    }
  }

  // Synchronously hide target window before layout paint so Frame 0 NEVER flashes at full 1.0 scale
  prepareOpenMount(mode) {
    const winEl = resolveWindowElement(mode);
    if (!winEl) return;
    cancelCompetingAnimations(winEl);
    winEl.classList.add('is-morph-measuring');
    winEl.style.visibility = 'hidden';
    winEl.style.opacity = '0';
    winEl.style.pointerEvents = 'none';
  }

  startOpen(mode) {
    if (this.isOpeningMode(mode)) return false;
    this._ensureScrim();

    const winEl = resolveWindowElement(mode);
    if (!winEl) return false;
    this.cancelCompetingOn(mode);

    // Force deterministic layout settle before measuring so cold open matches warm open on Frame 0
    void winEl.offsetHeight;
    const icon = measureLiveIconCenter(mode);
    const winRect = measureWindowRectSafe(winEl, mode);
    const winCx = winRect.x + winRect.w * 0.5;
    const winCy = winRect.y + winRect.h * 0.5;
    const iconScale = Math.max(0.10, Math.min(0.18, ICON_BOX_PX / Math.max(winRect.w, winRect.h)));

    let startTx = icon.cx - winCx;
    let startTy = icon.cy - winCy;
    let startSc = iconScale;
    let startOp = 0.22;

    // Seamless interruption handoff from live pose if re-opening mid-close
    if (this.active) {
      const prev = this.active;
      if (this.rafId) {
        cancelAnimationFrame(this.rafId);
        this.rafId = 0;
      }
      if (prev.mode === mode && prev.pose) {
        startTx = prev.pose.tx;
        startTy = prev.pose.ty;
        startSc = prev.pose.sc;
        startOp = prev.pose.op;
      } else if (prev.winEl && prev.winEl !== winEl) {
        this._clearWindowVisuals(prev.winEl);
      }
      this.active = null;
    }

    const reduced = prefersReducedMotion();
    winEl.classList.remove('is-morph-measuring');
    winEl.classList.add('is-morph-flying');
    winEl.style.visibility = 'visible';
    winEl.style.pointerEvents = 'none';
    winEl.style.transformOrigin = '50% 50%';
    // IMPORTANT (r71): Do NOT set will-change: transform at scale(0.10), which locks Chromium's
    // cc::PictureLayerImpl raster scale to 0.10x (blurry text/icons even after settling to 1.0!).
    winEl.style.willChange = reduced ? 'opacity' : 'auto';

    this.active = {
      kind: 'open',
      mode,
      winEl,
      reduced,
      durationMs: reduced ? 100 : OPEN_LUT.durationMs,
      startMs: performance.now(),
      lastRafMs: 0,
      progress: 0,
      winRect,
      startPose: { tx: startTx, ty: startTy, sc: startSc, op: startOp },
      endPose: { tx: 0, ty: 0, sc: 1, op: 1 },
      pose: { tx: startTx, ty: startTy, sc: startSc, op: reduced ? 0 : startOp },
      onComplete: null
    };

    if (reduced) {
      winEl.style.transform = '';
      winEl.style.opacity = '0';
    } else {
      this._applyWindowPose(winEl, startTx, startTy, startSc, startOp);
    }
    this._setScrim(0);
    this.perf.frameDeltasMs = [];
    this._schedule();
    return true;
  }

  startClose(mode, onComplete) {
    if (this.isClosingMode(mode)) return false;
    this._ensureScrim();

    const winEl = resolveWindowElement(mode);
    if (!winEl) {
      this._setScrim(0);
      if (typeof onComplete === 'function') onComplete();
      return false;
    }
    cancelCompetingAnimations(winEl);

    // Re-measure live target icon center right before close starts (NEVER stale open coords)
    const icon = measureLiveIconCenter(mode);
    const winRect = measureWindowRectSafe(winEl, mode);
    const winCx = winRect.x + winRect.w * 0.5;
    const winCy = winRect.y + winRect.h * 0.5;
    const endTx = icon.cx - winCx;
    const endTy = icon.cy - winCy;
    const endSc = Math.max(0.10, Math.min(0.18, ICON_BOX_PX / Math.max(winRect.w, winRect.h)));

    let startTx = 0;
    let startTy = 0;
    let startSc = 1;
    let startOp = 1;

    if (this.active) {
      const prev = this.active;
      if (this.rafId) {
        cancelAnimationFrame(this.rafId);
        this.rafId = 0;
      }
      if (prev.mode === mode && prev.pose) {
        startTx = prev.pose.tx;
        startTy = prev.pose.ty;
        startSc = prev.pose.sc;
        startOp = prev.pose.op;
      }
      this.active = null;
    }

    const reduced = prefersReducedMotion();
    winEl.classList.remove('is-morph-measuring');
    winEl.classList.add('is-morph-flying');
    winEl.style.visibility = 'visible';
    winEl.style.pointerEvents = 'none';
    winEl.style.transformOrigin = '50% 50%';
    // IMPORTANT (r71): Do NOT set will-change: transform at scale(0.10), which locks Chromium's
    // cc::PictureLayerImpl raster scale to 0.10x (blurry text/icons even after settling to 1.0!).
    winEl.style.willChange = reduced ? 'opacity' : 'auto';

    this.active = {
      kind: 'close',
      mode,
      winEl,
      reduced,
      durationMs: reduced ? 100 : CLOSE_LUT.durationMs,
      startMs: performance.now(),
      lastRafMs: 0,
      progress: 0,
      winRect,
      startPose: { tx: startTx, ty: startTy, sc: startSc, op: startOp },
      endPose: { tx: endTx, ty: endTy, sc: endSc, op: 0 },
      pose: { tx: startTx, ty: startTy, sc: startSc, op: startOp },
      onComplete: typeof onComplete === 'function' ? onComplete : null
    };

    if (!reduced) {
      this._applyWindowPose(winEl, startTx, startTy, startSc, startOp);
    }
    this.perf.frameDeltasMs = [];
    this._schedule();
    return true;
  }

  cancel() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
    if (this.active) {
      this._clearWindowVisuals(this.active.winEl);
      this.active = null;
    }
  }

  syncScrimImmediate(isOpen) {
    if (this.active) return;
    this._ensureScrim();
    this._setScrim(isOpen ? 1 : 0);
  }

  _schedule() {
    if (!this.rafId) {
      this.rafId = requestAnimationFrame(this._tick);
    }
  }

  _tick(nowMs) {
    this.rafId = 0;
    const anim = this.active;
    if (!anim) return;

    const t0 = performance.now();
    if (anim.lastRafMs > 0) {
      const delta = nowMs - anim.lastRafMs;
      if (delta > 0 && delta < 120) this.perf.frameDeltasMs.push(delta);
    }
    anim.lastRafMs = nowMs;

    const elapsed = Math.max(0, nowMs - anim.startMs);
    const done = elapsed >= anim.durationMs;
    // Guard against legacy ui-motion.js WAAPI animations attached synchronously or asynchronously after startOpen()
    if (elapsed < 120) {
      cancelCompetingAnimations(anim.winEl);
    }

    if (anim.reduced) {
      const t = Math.min(1, elapsed / anim.durationMs);
      const op = anim.kind === 'open' ? t : (1 - t);
      anim.winEl.style.opacity = op.toFixed(3);
      this._setScrim(op);
      anim.progress = t;
      anim.pose.op = op;
    } else if (anim.kind === 'open') {
      const s = sampleLut(OPEN_LUT, elapsed);
      const tx = anim.startPose.tx + (anim.endPose.tx - anim.startPose.tx) * s;
      const ty = anim.startPose.ty + (anim.endPose.ty - anim.startPose.ty) * s;
      const sc = anim.startPose.sc + (anim.endPose.sc - anim.startPose.sc) * s;
      // Fast, smooth opacity ramp (0->120ms) so content is clearly visible growing out of the icon from Frame 0
      const opT = Math.min(1, elapsed / 120);
      const op = anim.startPose.op + (1 - anim.startPose.op) * (1 - Math.pow(1 - opT, 2));

      anim.progress = s;
      anim.pose = { tx, ty, sc, op };
      this._applyWindowPose(anim.winEl, tx, ty, sc, op);
      this._setScrim(Math.min(1, s));
      this.perf.openFrames += 1;
    } else {
      const s = sampleLut(CLOSE_LUT, elapsed);
      const tx = anim.startPose.tx + (anim.endPose.tx - anim.startPose.tx) * s;
      const ty = anim.startPose.ty + (anim.endPose.ty - anim.startPose.ty) * s;
      const sc = anim.startPose.sc + (anim.endPose.sc - anim.startPose.sc) * s;
      // Keep window + content clearly visible while shrinking, fading cleanly in the final 130ms into the icon
      const fadeStart = anim.durationMs - 130;
      const op = elapsed <= fadeStart
        ? anim.startPose.op
        : anim.startPose.op * Math.max(0, 1 - (elapsed - fadeStart) / 130);

      anim.progress = s;
      anim.pose = { tx, ty, sc, op };
      this._applyWindowPose(anim.winEl, tx, ty, sc, op);
      this._setScrim(1 - Math.min(1, s));
      this.perf.closeFrames += 1;
    }

    const jsCost = performance.now() - t0;
    this.perf.totalJsMs += jsCost;
    if (jsCost > this.perf.maxJsMs) this.perf.maxJsMs = jsCost;

    if (!done) {
      this.rafId = requestAnimationFrame(this._tick);
    } else {
      const totalElapsed = Math.round(nowMs - anim.startMs);
      if (anim.kind === 'open') this.perf.lastOpenMs = totalElapsed;
      else this.perf.lastCloseMs = totalElapsed;

      const cb = anim.onComplete;
      const winEl = anim.winEl;
      const kind = anim.kind;
      this.active = null;

      if (kind === 'open') {
        // Clear transform/opacity cleanly so settled window sits at exact 1:1 native DPR with ZERO frame snap
        this._clearWindowVisuals(winEl);
        this._setScrim(1);
      } else {
        this._setScrim(0);
        if (cb) cb();
        requestAnimationFrame(() => this._clearWindowVisuals(winEl));
      }
    }
  }

  getState() {
    if (!this.active) return { active: false };
    return {
      active: true,
      kind: this.active.kind,
      mode: this.active.mode,
      progress: +this.active.progress.toFixed(4),
      pose: {
        tx: +this.active.pose.tx.toFixed(1),
        ty: +this.active.pose.ty.toFixed(1),
        sc: +this.active.pose.sc.toFixed(4),
        op: +this.active.pose.op.toFixed(3)
      },
      winRect: this.active.winRect
    };
  }

  getPerfStats() {
    const deltas = [...this.perf.frameDeltasMs].sort((a, b) => a - b);
    const totalFrames = this.perf.openFrames + this.perf.closeFrames;
    const p95 = deltas.length ? deltas[Math.min(deltas.length - 1, Math.floor(deltas.length * 0.95))] : 0;
    const avgFrameMs = deltas.length ? deltas.reduce((s, v) => s + v, 0) / deltas.length : 0;
    return {
      active: Boolean(this.active),
      openFrames: this.perf.openFrames,
      closeFrames: this.perf.closeFrames,
      avgJsMs: totalFrames ? +(this.perf.totalJsMs / totalFrames).toFixed(4) : 0,
      maxJsMs: +this.perf.maxJsMs.toFixed(4),
      avgFrameMs: +avgFrameMs.toFixed(2),
      p95FrameMs: +p95.toFixed(2),
      lastOpenMs: this.perf.lastOpenMs,
      lastCloseMs: this.perf.lastCloseMs
    };
  }
}
