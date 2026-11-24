// Matched Geometry Shell Transition — Step 2 Hard Gate (Minimal Pure-Color Rectangle Verification)
// Spec: 窗口打开动画技术调研报告 §4.2 & §4.6 Step 2
// - Independent fixed overlay layer (#pond-window-morph-layer), zero window content, zero business trigger
// - Pure dark CRT rounded rectangle expanding linearly over 1000ms from actual icon rect A to target window rect B
// - Uses strictly compositor transform (translate3d + scale with transform-origin: 0 0), zero CSS transition/WAAPI
// - Pond WebGL2 canvas continues running uninterrupted underneath

const DESKTOP_ICON_COORDS = {
  knowledge: { x: 0.395, y: 0.245 },
  videos:    { x: 0.650, y: 0.235 },
  resources: { x: 0.880, y: 0.345 },
  games:     { x: 0.120, y: 0.495 },
  chatroom:  { x: 0.300, y: 0.740 },
  about:     { x: 0.850, y: 0.745 }
};

const STEP2_DURATION_MS = 1000;
const ICON_BOX_PX = 76;

function getIconRect(iconId) {
  const vw = window.innerWidth || 1280;
  const vh = window.innerHeight || 720;
  const norm = DESKTOP_ICON_COORDS[iconId] || { x: 0.5, y: 0.5 };
  const cx = norm.x * vw;
  const cy = norm.y * vh;
  return {
    x: cx - ICON_BOX_PX * 0.5,
    y: cy - ICON_BOX_PX * 0.5,
    w: ICON_BOX_PX,
    h: ICON_BOX_PX
  };
}

function getTargetWindowRect() {
  const vw = window.innerWidth || 1280;
  const vh = window.innerHeight || 720;
  const w = Math.min(1040, Math.round(vw * 0.76));
  const h = Math.min(720, Math.round(vh * 0.74));
  return {
    x: Math.round((vw - w) * 0.5),
    y: Math.round((vh - h) * 0.5),
    w,
    h
  };
}

export class PondWindowMorphStep2 {
  constructor() {
    this.layerEl = null;
    this.shellEl = null;
    this.rafId = 0;
    this.active = null;
    this._tick = this._tick.bind(this);
  }

  _ensureDom() {
    if (this.layerEl && this.layerEl.isConnected && this.shellEl && this.shellEl.isConnected) {
      return;
    }
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

  _applyLinearProgress(p) {
    if (!this.active || !this.shellEl) return;
    const { from, to } = this.active;
    const clamped = Math.max(0, Math.min(1, p));
    const x = from.x + (to.x - from.x) * clamped;
    const y = from.y + (to.y - from.y) * clamped;
    const w = from.w + (to.w - from.w) * clamped;
    const h = from.h + (to.h - from.h) * clamped;
    const sx = w / to.w;
    const sy = h / to.h;

    this.shellEl.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) scale(${sx.toFixed(5)}, ${sy.toFixed(5)})`;
    this.active.progress = clamped;
    this.active.currentRect = {
      x: Math.round(x),
      y: Math.round(y),
      w: Math.round(w),
      h: Math.round(h)
    };
  }

  playFromIcon(iconId) {
    this._ensureDom();
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }

    const from = getIconRect(iconId);
    const to = getTargetWindowRect();

    this.layerEl.classList.add('is-active');
    const s = this.shellEl.style;
    s.width = `${to.w}px`;
    s.height = `${to.h}px`;
    s.opacity = '1';
    s.willChange = 'transform';

    this.active = {
      iconId,
      from,
      to,
      startMs: performance.now(),
      durationMs: STEP2_DURATION_MS,
      progress: 0,
      done: false,
      currentRect: { ...from }
    };

    // Frame 0 synchronously at exact icon rect A
    this._applyLinearProgress(0);
    this.rafId = requestAnimationFrame(this._tick);
    return this.getState();
  }

  _tick(nowMs) {
    this.rafId = 0;
    if (!this.active) return;
    const elapsed = Math.max(0, nowMs - this.active.startMs);
    const p = Math.min(1, elapsed / this.active.durationMs);
    this._applyLinearProgress(p);

    if (p < 1) {
      this.rafId = requestAnimationFrame(this._tick);
    } else {
      this.active.done = true;
      if (this.shellEl) this.shellEl.style.willChange = '';
    }
  }

  dismiss() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
    this.active = null;
    if (this.layerEl) {
      this.layerEl.classList.remove('is-active');
    }
    if (this.shellEl) {
      this.shellEl.style.opacity = '0';
      this.shellEl.style.willChange = '';
    }
  }

  isActive() {
    return Boolean(this.active);
  }

  getState() {
    if (!this.active) return { active: false };
    return {
      active: true,
      iconId: this.active.iconId,
      progress: +this.active.progress.toFixed(4),
      done: this.active.done,
      from: this.active.from,
      to: this.active.to,
      currentRect: this.active.currentRect,
      transform: this.shellEl?.style.transform || ''
    };
  }
}
