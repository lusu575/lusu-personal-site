import { createPond, quality } from "./pond.mjs";
import { mixColor } from "./point-sets.mjs";
import { createSeasonControl } from "./season-control.mjs";
import { beginBoot } from "./boot.mjs";

const WINDOW = 60;
const tones = [0xe4bbc7, 0xb0ddcb, 0xe4bb91, 0xb5d2ee];

export function startDesktop(canvas) {
  const home = canvas.closest("#home");
  if (!home) return () => {};
  const pond = createPond(canvas);
  if (!pond) return () => {};

  const root = document.documentElement;
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const times = new Float64Array(WINDOW);
  const costs = new Float64Array(WINDOW);
  const sorted = new Float64Array(WINDOW);
  const debug = {
    targetMs: 0, tier: 0, particles: 0, pondParticles: 0, controlParticles: 0,
    dpr: 1, frameMs: 0, meanMs: 0, p90Ms: 0, drawMs: 0, samples: 0,
    heavy: 0, stalls: 0, drops: 0
  };
  window.__pondDebug = debug;

  let frame = 0;
  let last = null;
  let count = 0;
  let adaptive = 0;
  let reduced = false;
  let dirty = true;
  let active = false;
  let disposed = false;
  let width = canvas.clientWidth;
  let height = canvas.clientHeight;
  let boot = null;
  let from;
  let target;
  let season;
  let blend = 1;

  function paintSeason(p) {
    season = p;
    pond.setSeason(p);
    home.style.setProperty("--pond-tone",
      mixColor(tones[Math.floor(p)], tones[Math.ceil(p)], p % 1));
  }

  const control = createSeasonControl(home, n => {
    from = season;
    target = n;
    blend = reduced ? 1 : 0;
    if (reduced) paintSeason(n);
    else pond.ripple(0.5, 0.5, "sweep");
  });
  from = target = control.value;
  paintSeason(target);

  function policy() {
    const quiet = motion.matches || ["off", "reduced"].includes(root.dataset.motion);
    const low = connection?.saveData || root.dataset.performanceTier === "low";
    const tier = Math.max(adaptive, quiet ? 3 : low ? 2 : 0);
    if (quiet !== reduced || tier !== debug.tier) {
      dirty = true;
      count = 0;
    }
    reduced = quiet;
    debug.tier = tier;
    if (quiet && blend < 1) {
      blend = 1;
      paintSeason(target);
    }
    if (quiet) boot?.finish();
  }

  function sample(elapsed, cost) {
    debug.samples++;
    debug.frameMs = elapsed;
    times[count] = elapsed;
    costs[count++] = cost;
    if (count < WINDOW) return;
    sorted.set(times);
    sorted.sort();
    const period = (sorted[29] + sorted[30]) / 2;
    let heavy = 0;
    let stalls = 0;
    let total = 0;
    let work = 0;
    for (let i = 0; i < WINDOW; i++) {
      total += times[i];
      work += costs[i];
      if (costs[i] > period * 0.5) heavy++;
      if (times[i] > period * 2) stalls++;
    }
    debug.targetMs = period;
    debug.meanMs = total / WINDOW;
    debug.p90Ms = sorted[53];
    debug.drawMs = work / WINDOW;
    debug.heavy = heavy;
    debug.stalls = stalls;
    count = 0;
    if ((heavy >= 36 || stalls >= 3) && debug.tier < 3) {
      adaptive = debug.tier + 1;
      debug.drops++;
      policy();
    }
  }

  function tick(now) {
    frame = 0;
    if (disposed || !active || document.hidden || document.body.dataset.route !== "home") return;
    const elapsed = last === null ? 0 : now - last;
    last = now;
    const dt = Math.min(32, Math.max(0, elapsed)) / 1000;
    const reset = dirty;
    if (dirty) {
      pond.resize(width, height, debug.tier, reduced);
      debug.dpr = pond.dpr;
      dirty = false;
    }
    const start = performance.now();
    const booting = boot?.playing;
    boot?.tick(elapsed);
    if (blend < 1) {
      blend = Math.min(1, blend + dt / 0.55);
      const f = blend * blend * (3 - 2 * blend);
      paintSeason(blend === 1 ? target : from + (target - from) * f);
    }
    debug.pondParticles = pond.draw(dt);
    debug.controlParticles = control.draw(dt, quality[debug.tier][5],
      Math.min(2, window.devicePixelRatio || 1, quality[debug.tier][8]), reduced);
    debug.particles = debug.pondParticles + debug.controlParticles;
    if (!reset && !booting && elapsed > 0) sample(elapsed, performance.now() - start);
    frame = requestAnimationFrame(tick);
  }

  function sync() {
    cancelAnimationFrame(frame);
    frame = 0;
    count = 0;
    last = null;
    const onHome = document.body.dataset.route === "home";
    if (!onHome) {
      boot?.destroy();
      boot = null;
      active = false;
      control.cancel();
      return;
    }
    if (document.hidden) {
      control.cancel();
      boot?.releaseShield();
      return;
    }
    if (!active) {
      active = true;
      dirty = true;
      boot = beginBoot(home, reduced, () => pond.ripple(0.5, 0.5, "open"));
    }
    frame = requestAnimationFrame(tick);
  }

  function click(event) {
    if (!active || !event.detail || event.defaultPrevented || event.button !== 0) return;
    if (event.target.closest("a,button,input,select,textarea,label,[role=button],.desktop-icon,.pond-season,.pond-status")) return;
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
  const routeObserver = new MutationObserver(sync);
  function viewport() { dirty = true; }
  sizeObserver.observe(canvas);
  policyObserver.observe(root, { attributes: true, attributeFilter: ["data-performance-tier", "data-motion"] });
  routeObserver.observe(document.body, { attributes: true, attributeFilter: ["data-route"] });
  motion.addEventListener("change", policy);
  connection?.addEventListener("change", policy);
  window.addEventListener("resize", viewport);
  document.addEventListener("visibilitychange", sync);
  home.addEventListener("click", click);
  policy();
  sync();

  return () => {
    disposed = true;
    cancelAnimationFrame(frame);
    boot?.destroy();
    control.destroy();
    sizeObserver.disconnect();
    policyObserver.disconnect();
    routeObserver.disconnect();
    motion.removeEventListener("change", policy);
    connection?.removeEventListener("change", policy);
    window.removeEventListener("resize", viewport);
    document.removeEventListener("visibilitychange", sync);
    home.removeEventListener("click", click);
    home.style.removeProperty("--pond-tone");
    canvas.width = canvas.height = 1;
    if (window.__pondDebug === debug) delete window.__pondDebug;
  };
}
