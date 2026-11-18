import { createPond } from "./pond.mjs";

const FRAME = 1000 / 120;
const WINDOW = 60;

export function startDesktop(canvas) {
  const home = canvas.closest("#home");
  const pond = createPond(canvas);
  if (!home || !pond) return () => {};

  const root = document.documentElement;
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const times = new Float32Array(WINDOW);
  const sorted = new Float32Array(WINDOW);
  const debug = {
    targetMs: FRAME, tier: 0, particles: 0, dpr: 1, frameMs: 0,
    meanMs: 0, p90Ms: 0, drawMs: 0, samples: 0, drops: 0
  };
  window.__pondDebug = debug;

  let frame = 0;
  let last = null;
  let count = 0;
  let total = 0;
  let drawTotal = 0;
  let late = 0;
  let adaptive = 0;
  let applied = -1;
  let reduced = false;
  let dirty = true;
  let width = canvas.clientWidth;
  let height = canvas.clientHeight;

  function resetStats() {
    count = total = drawTotal = late = 0;
  }

  function policy() {
    reduced = motion.matches || ["off", "reduced"].includes(root.dataset.motion);
    const constrained = connection?.saveData || root.dataset.performanceTier === "low"
      || (navigator.hardwareConcurrency > 0 && navigator.hardwareConcurrency <= 4)
      || (navigator.deviceMemory > 0 && navigator.deviceMemory <= 4);
    debug.tier = Math.max(adaptive, reduced ? 3 : constrained ? 2 : 0);
    dirty = true;
  }

  function tick(now) {
    frame = 0;
    if (document.hidden || document.body.dataset.route !== "home") return;
    if (dirty || applied !== debug.tier) {
      applied = debug.tier;
      pond.resize(width, height, applied, reduced);
      debug.dpr = pond.dpr;
      dirty = false;
    }
    const elapsed = last === null ? 0 : now - last;
    last = now;
    const start = performance.now();
    // Bound motion after a main-thread stall; never run catch-up steps.
    debug.particles = pond.draw(Math.min(32, elapsed) / 1000);
    const cost = performance.now() - start;
    if (elapsed > 0) {
      debug.frameMs = elapsed;
      debug.samples++;
      times[count++] = elapsed;
      total += elapsed;
      drawTotal += cost;
      if (elapsed > FRAME * 1.4 || cost > FRAME * 0.72) late++;
      if (count === WINDOW) {
        sorted.set(times);
        sorted.sort();
        debug.meanMs = total / count;
        debug.p90Ms = sorted[Math.ceil(count * 0.9) - 1];
        debug.drawMs = drawTotal / count;
        if (late >= 5 && applied < 3) {
          adaptive = applied + 1;
          debug.drops++;
          policy();
        }
        resetStats();
      }
    }
    frame = requestAnimationFrame(tick);
  }

  function visibility() {
    cancelAnimationFrame(frame);
    frame = 0;
    last = null;
    resetStats();
    if (!document.hidden) frame = requestAnimationFrame(tick);
  }

  function click(event) {
    if (!event.detail || event.defaultPrevented || event.button !== 0) return;
    if (event.target.closest("a,button,input,select,textarea,label,[role=button],.desktop-icon,.pond-season,.pond-status")) return;
    // One read per accepted click, never a layout read in the frame loop.
    const box = canvas.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width;
    const y = (event.clientY - box.top) / box.height;
    if (x >= 0 && x <= 1 && y >= 0 && y <= 1) pond.ripple(x, y);
  }

  const sizeObserver = new ResizeObserver(([entry]) => {
    width = entry.contentRect.width;
    height = entry.contentRect.height;
    dirty = true;
  });
  const policyObserver = new MutationObserver(policy);
  sizeObserver.observe(canvas);
  policyObserver.observe(root, { attributes: true, attributeFilter: ["data-performance-tier", "data-motion"] });
  motion.addEventListener("change", policy);
  connection?.addEventListener("change", policy);
  window.addEventListener("resize", policy);
  document.addEventListener("visibilitychange", visibility);
  home.addEventListener("click", click);
  policy();
  visibility();

  return () => {
    cancelAnimationFrame(frame);
    sizeObserver.disconnect();
    policyObserver.disconnect();
    motion.removeEventListener("change", policy);
    connection?.removeEventListener("change", policy);
    window.removeEventListener("resize", policy);
    document.removeEventListener("visibilitychange", visibility);
    home.removeEventListener("click", click);
    // CSS owns the display size; release the large backing store on exit.
    canvas.width = canvas.height = 1;
    if (window.__pondDebug === debug) delete window.__pondDebug;
  };
}
