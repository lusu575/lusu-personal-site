// Matched Geometry Shell Transition — Steps 3–8 Production Implementation
// Spec: 《窗口打开动画技术调研报告》 §4.1–§4.6
// - L1: Live Desktop Icon / Mobile Dock origin (measured live on open AND re-measured live on close)
// - L2: Independent fixed morph shell (#pond-window-morph-layer .pond-morph-shell), visible from Frame 0
//       using analytic second-order spring lookup tables (4ms interval, normalized to exact endpoints):
//       * Open:  zeta = 0.88, omega0 = 10, 480ms (< 0.5% overshoot, zero second bounce)
//       * Close: zeta = 0.95, omega0 = 12, 400ms (zero terminal oscillation)
// - L3: Real target .xp-window laid out at 1:1 final size (measured via visibility:hidden, NEVER display:none,
//       NEVER scaled down to icon size): fades in 200ms->400ms on open; fades out 0->160ms on close.
// - Continuous corner radius interpolation with non-uniform scale compensation; zero second CRT scanlines;
//   fully interruptible from live visual rect; reduced-motion 100ms opacity fallback; zero DOM reads in rAF.

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
const ICON_RADIUS_PX = 14;
const WINDOW_RADIUS_PX = 18;
const SAMPLE_STEP_MS = 4;

function prefersReducedMotion() {
  return Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

function isMobileViewport() {
  return document.documentElement.dataset.shell === 'mobile'
    || document.documentElement.dataset.uiShell === 'mobile'
    || window.innerWidth <= 768;
}

// Analytic normalized second-order underdamped spring (§4.3):
// s(t) = 1 - e^(-zeta*w0*t) * (cos(wd*t) + (zeta*w0/wd)*sin(wd*t)), wd = w0*sqrt(1 - zeta^2)
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
  } catch {}
}

function measureLiveIconRect(mode) {
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
        return { x: r.left, y: r.top, w: r.width, h: r.height, radius: 14 };
      }
    }
    // Visible fallback on mobile: bottom-center dock anchor
    return { x: vw * 0.5 - 28, y: vh - 68, w: 56, h: 56, radius: 14 };
  }

  const norm = DESKTOP_ICON_COORDS[mode];
  const canvas = document.getElementById('pond-desktop-canvas');
  if (norm && canvas) {
    const cr = canvas.getBoundingClientRect();
    if (cr.width > 0 && cr.height > 0) {
      const cx = cr.left + norm.x * cr.width;
      const cy = cr.top + norm.y * cr.height;
      const half = ICON_BOX_PX * 0.5;
      if (cx >= 0 && cx <= vw && cy >= 0 && cy <= vh) {
        return { x: cx - half, y: cy - half, w: ICON_BOX_PX, h: ICON_BOX_PX, radius: ICON_RADIUS_PX };
      }
    }
  }

  // Visible fallback if source icon is offscreen/hidden (§4.5): compact centered anchor
  const fw = 120;
  const fh = 84;
  return { x: (vw - fw) * 0.5, y: (vh - fh) * 0.5, w: fw, h: fh, radius: ICON_RADIUS_PX };
}

function measureWindowRectSafe(el) {
  const vw = window.innerWidth || 1280;
  const vh = window.innerHeight || 720;
  if (el) {
    const prevTransform = el.style.transform;
    el.style.transform = 'none';
    const r = el.getBoundingClientRect();
    el.style.transform = prevTransform;
    if (r.width >= 120 && r.height >= 120) {
      return { x: r.left, y: r.top, w: r.width, h: r.height, radius: WINDOW_RADIUS_PX };
    }
  }
  const w = Math.min(1040, Math.round(vw * 0.76));
  const h = Math.min(720, Math.round(vh * 0.74));
  return { x: Math.round((vw - w) * 0.5), y: Math.round((vh - h) * 0.5), w, h, radius: WINDOW_RADIUS_PX };
}

export class PondWindowMorphController {
  constructor() {
    this.layerEl = null;
    this.shellEl = null;
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

  _ensureDom() {
    if (!this.layerEl || !this.layerEl.isConnected) {
      let layer = document.getElementById('pond-window-morph-layer');
      if (!layer) {
        layer = document.createElement('div');
        layer.id = 'pond-window-morph-layer';
        layer.setAttribute('aria-hidden', 'true');
        document.body.appendChild(layer);
      }
      let shell = layer.querySelector('.pond-morph-shell');
      if (!shell) {
        shell = document.createElement('div');
        shell.className = 'pond-morph-shell';
        layer.appendChild(shell);
      }
      this.layerEl = layer;
      this.shellEl = shell;
    }
    if (!this.scrimEl || !this.scrimEl.isConnected) {
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
  }

  _setScrim(p) {
    if (isMobileViewport() || !this.scrimEl) return;
    const clamped = Math.max(0, Math.min(1, p));
    this.scrimEl.style.opacity = (clamped * 0.34).toFixed(3);
  }

  _clearWindowVisuals(winEl) {
    if (!winEl) return;
    winEl.classList.remove('is-morph-measuring', 'is-morph-content-entering', 'is-morph-content-leaving');
    winEl.style.visibility = '';
    winEl.style.opacity = '';
    winEl.style.transform = '';
    winEl.style.willChange = '';
    winEl.style.pointerEvents = '';
  }

  _hideShell() {
    if (this.layerEl) this.layerEl.classList.remove('is-active');
    if (this.shellEl) {
      this.shellEl.style.opacity = '0';
      this.shellEl.style.willChange = '';
      this.shellEl.style.transform = '';
      this.shellEl.style.borderRadius = '';
    }
  }

  _applyShellRect(rect, baseW, baseH, visualRadius, opacity = 1) {
    const sx = Math.max(0.03, rect.w / baseW);
    const sy = Math.max(0.03, rect.h / baseH);
    const rx = Math.min(baseW * 0.5, visualRadius / sx);
    const ry = Math.min(baseH * 0.5, visualRadius / sy);
    const s = this.shellEl.style;
    s.transform = `translate3d(${rect.x.toFixed(2)}px, ${rect.y.toFixed(2)}px, 0) scale(${sx.toFixed(5)}, ${sy.toFixed(5)})`;
    s.borderRadius = `${rx.toFixed(1)}px / ${ry.toFixed(1)}px`;
    s.opacity = opacity.toFixed(3);
  }

  isOpeningMode(mode) {
    return Boolean(this.active && this.active.kind === 'open' && this.active.mode === mode);
  }

  isClosingMode(mode) {
    return Boolean(this.active && this.active.kind === 'close' && (!mode || this.active.mode === mode));
  }

  // Synchronously hide target window before layout paint so Frame 0 NEVER flashes full content
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
    if (this.isOpeningMode(mode)) return false; // Prevent duplicate launch on repeated click
    this._ensureDom();

    const winEl = resolveWindowElement(mode);
    if (!winEl) return false;
    cancelCompetingAnimations(winEl);

    // Interruptibility: if another animation is in-flight, capture its live visual rect if same mode
    let fromRect = measureLiveIconRect(mode);
    if (this.active) {
      const prev = this.active;
      if (this.rafId) {
        cancelAnimationFrame(this.rafId);
        this.rafId = 0;
      }
      if (prev.mode === mode && prev.currentRect) {
        fromRect = { ...prev.currentRect, radius: prev.currentRadius || ICON_RADIUS_PX };
      } else if (prev.winEl && prev.winEl !== winEl) {
        this._clearWindowVisuals(prev.winEl);
      }
      this.active = null;
    }

    // Step 3: Window is mounted with visibility:hidden (participating in layout, NOT display:none)
    winEl.classList.add('is-morph-measuring');
    winEl.style.visibility = 'hidden';
    winEl.style.opacity = '0';
    winEl.style.pointerEvents = 'none';
    const toRect = measureWindowRectSafe(winEl);

    const reduced = prefersReducedMotion();
    if (reduced) {
      this._hideShell();
      winEl.classList.remove('is-morph-measuring');
      winEl.style.visibility = 'visible';
      winEl.style.opacity = '0';
      winEl.style.willChange = 'opacity';
      this.active = {
        kind: 'open',
        mode,
        winEl,
        reduced: true,
        durationMs: 100,
        startMs: performance.now(),
        lastRafMs: 0,
        progress: 0,
        from: fromRect,
        to: toRect,
        currentRect: { ...toRect },
        currentRadius: WINDOW_RADIUS_PX,
        onComplete: null
      };
      this._schedule();
      return true;
    }

    // Configure L2 shell at fixed target dimensions (baseW x baseH)
    this.layerEl.classList.add('is-active');
    const ss = this.shellEl.style;
    ss.width = `${toRect.w.toFixed(1)}px`;
    ss.height = `${toRect.h.toFixed(1)}px`;
    ss.willChange = 'transform, opacity';

    winEl.style.willChange = 'opacity, transform';

    this.active = {
      kind: 'open',
      mode,
      winEl,
      reduced: false,
      durationMs: OPEN_LUT.durationMs,
      startMs: performance.now(),
      lastRafMs: 0,
      progress: 0,
      from: fromRect,
      to: toRect,
      baseW: toRect.w,
      baseH: toRect.h,
      currentRect: { ...fromRect },
      currentRadius: fromRect.radius || ICON_RADIUS_PX,
      onComplete: null
    };

    // Frame 0 synchronously at exact icon rect A (opacity 1.0, zero content yet)
    this._applyShellRect(fromRect, toRect.w, toRect.h, fromRect.radius || ICON_RADIUS_PX, 1);
    this._setScrim(0);
    this.perf.frameDeltasMs = [];
    this._schedule();
    return true;
  }

  startClose(mode, onComplete) {
    if (this.isClosingMode(mode)) return false;
    this._ensureDom();

    const winEl = resolveWindowElement(mode);
    // Step 7: Re-measure live target icon rect right before close starts (NEVER stale open coords)
    const toIconRect = measureLiveIconRect(mode);

    let fromRect = null;
    let startRadius = WINDOW_RADIUS_PX;
    if (this.active) {
      const prev = this.active;
      if (this.rafId) {
        cancelAnimationFrame(this.rafId);
        this.rafId = 0;
      }
      if (prev.mode === mode && prev.currentRect) {
        fromRect = { ...prev.currentRect, radius: prev.currentRadius || WINDOW_RADIUS_PX };
        startRadius = prev.currentRadius || WINDOW_RADIUS_PX;
      }
      this.active = null;
    }
    if (!fromRect) {
      fromRect = measureWindowRectSafe(winEl);
    }

    if (winEl) cancelCompetingAnimations(winEl);

    const reduced = prefersReducedMotion();
    if (reduced) {
      this._hideShell();
      if (winEl) {
        winEl.style.willChange = 'opacity';
        winEl.style.pointerEvents = 'none';
      }
      this.active = {
        kind: 'close',
        mode,
        winEl,
        reduced: true,
        durationMs: 100,
        startMs: performance.now(),
        lastRafMs: 0,
        progress: 0,
        from: fromRect,
        to: toIconRect,
        currentRect: { ...fromRect },
        currentRadius: startRadius,
        onComplete: typeof onComplete === 'function' ? onComplete : null
      };
      this._schedule();
      return true;
    }

    // L2 shell inherits real-time window rect seamlessly at opacity 1
    this.layerEl.classList.add('is-active');
    const ss = this.shellEl.style;
    ss.width = `${fromRect.w.toFixed(1)}px`;
    ss.height = `${fromRect.h.toFixed(1)}px`;
    ss.willChange = 'transform, opacity';

    if (winEl) {
      winEl.classList.add('is-morph-content-leaving');
      winEl.style.willChange = 'opacity';
      winEl.style.pointerEvents = 'none';
    }

    this.active = {
      kind: 'close',
      mode,
      winEl,
      reduced: false,
      durationMs: CLOSE_LUT.durationMs,
      startMs: performance.now(),
      lastRafMs: 0,
      progress: 0,
      from: fromRect,
      to: toIconRect,
      baseW: fromRect.w,
      baseH: fromRect.h,
      currentRect: { ...fromRect },
      currentRadius: startRadius,
      onComplete: typeof onComplete === 'function' ? onComplete : null
    };

    this._applyShellRect(fromRect, fromRect.w, fromRect.h, startRadius, 1);
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
    this._hideShell();
  }

  syncScrimImmediate(isOpen) {
    if (this.active) return;
    this._ensureDom();
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

    if (anim.reduced) {
      const t = Math.min(1, elapsed / anim.durationMs);
      const op = anim.kind === 'open' ? t : (1 - t);
      if (anim.winEl) anim.winEl.style.opacity = op.toFixed(3);
      this._setScrim(op);
      anim.progress = t;
    } else if (anim.kind === 'open') {
      const s = sampleLut(OPEN_LUT, elapsed);
      const rect = {
        x: anim.from.x + (anim.to.x - anim.from.x) * s,
        y: anim.from.y + (anim.to.y - anim.from.y) * s,
        w: anim.from.w + (anim.to.w - anim.from.w) * s,
        h: anim.from.h + (anim.to.h - anim.from.h) * s
      };
      const rad = (anim.from.radius || ICON_RADIUS_PX) + (WINDOW_RADIUS_PX - (anim.from.radius || ICON_RADIUS_PX)) * Math.min(1, Math.max(0, s));
      anim.currentRect = rect;
      anim.currentRadius = rad;
      anim.progress = s;

      // L2 shell always visible (opacity 1.0) during growth; hands off cleanly at 430->480ms when L2 == B
      const shellFadeOut = elapsed > 430 ? Math.max(0, 1 - (elapsed - 430) / 50) : 1;
      this._applyShellRect(rect, anim.baseW, anim.baseH, rad, shellFadeOut);
      this._setScrim(Math.min(1, s));

      // Step 5: L3 real content laid out at 1:1 final size; fades in 220ms -> 420ms with subtle 5px lift.
      // Keep .is-morph-content-entering (transparent outer frame) until 420ms so ZERO double-border ever appears!
      if (anim.winEl) {
        if (elapsed >= 220) {
          const ct = Math.min(1, (elapsed - 220) / 200);
          const easeOut = 1 - Math.pow(1 - ct, 2.2);
          const liftPx = (1 - easeOut) * 5;
          anim.winEl.classList.remove('is-morph-measuring');
          if (elapsed < 420) {
            anim.winEl.classList.add('is-morph-content-entering');
          } else {
            anim.winEl.classList.remove('is-morph-content-entering');
          }
          anim.winEl.style.visibility = 'visible';
          anim.winEl.style.opacity = easeOut.toFixed(3);
          anim.winEl.style.transform = liftPx > 0.05 ? `translate3d(0, ${liftPx.toFixed(2)}px, 0)` : '';
        }
      }
      this.perf.openFrames += 1;
    } else {
      // Close: content fades out first (0 -> 160ms), shell contracts along 400ms spring to re-measured icon
      const s = sampleLut(CLOSE_LUT, elapsed);
      const rect = {
        x: anim.from.x + (anim.to.x - anim.from.x) * s,
        y: anim.from.y + (anim.to.y - anim.from.y) * s,
        w: anim.from.w + (anim.to.w - anim.from.w) * s,
        h: anim.from.h + (anim.to.h - anim.from.h) * s
      };
      const rad = anim.from.radius + ((anim.to.radius || ICON_RADIUS_PX) - anim.from.radius) * Math.min(1, Math.max(0, s));
      anim.currentRect = rect;
      anim.currentRadius = rad;
      anim.progress = s;

      if (anim.winEl) {
        const contentOp = Math.max(0, 1 - elapsed / 160);
        anim.winEl.style.opacity = contentOp.toFixed(3);
        if (contentOp <= 0.01) anim.winEl.style.visibility = 'hidden';
      }

      const shellOp = elapsed > 330 ? Math.max(0, 1 - (elapsed - 330) / 70) : 1;
      this._applyShellRect(rect, anim.baseW, anim.baseH, rad, shellOp);
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

      this._hideShell();
      if (kind === 'open') {
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
      from: this.active.from,
      to: this.active.to,
      currentRect: {
        x: Math.round(this.active.currentRect.x),
        y: Math.round(this.active.currentRect.y),
        w: Math.round(this.active.currentRect.w),
        h: Math.round(this.active.currentRect.h)
      },
      shellTransform: this.shellEl?.style.transform || '',
      shellRadius: this.shellEl?.style.borderRadius || '',
      contentOpacity: this.active.winEl?.style.opacity || ''
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
