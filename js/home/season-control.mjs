import { seasons } from "./point-sets.mjs";

const KEY = "v3:pond:season";
const PAD = 16; // CSS px; matches the track inset
const names = ["Spring", "Summer", "Autumn", "Winter"];
const clamp = x => Math.max(0, Math.min(3, x));
let memory = 1;
let storageOK = true;

function read() {
  if (storageOK) {
    try {
      const s = localStorage.getItem(KEY);
      memory = /^[0-3]$/.test(s ?? "") ? Number(s) : 1;
    } catch {
      storageOK = false;
    }
  }
  return memory;
}

function write(n) {
  memory = n;
  if (storageOK) {
    try {
      localStorage.setItem(KEY, String(n));
    } catch {
      storageOK = false;
    }
  }
}

export function createSeasonControl(home, onCommit) {
  const el = home.querySelector("#pond-season-slider");
  const canvas = el.querySelector("canvas");
  const ctx = canvas.getContext("2d");
  const labels = home.querySelector("#pond-season-value");
  const events = new AbortController();
  const opts = { signal: events.signal };
  const trail = new Float32Array(4);
  let value = read();
  let x = value;
  let pointer = null;
  let box;
  let direction = 0;
  let destination = value;
  let held = 0;
  let spring = null;
  let dust = 0;
  let time = 0;
  let quiet = false;
  let width = el.clientWidth;
  let height = el.clientHeight;
  let scale = 0;
  let resize = true;

  function aria() {
    const n = pointer === null ? value : Math.round(destination);
    const label = labels.querySelector(`[data-i18n="pondSeason${names[n]}"]`);
    el.setAttribute("aria-valuenow", String(n));
    el.setAttribute("aria-valuetext", label.textContent.trim());
  }

  function land(n, commit) {
    const old = value;
    const origin = x;
    if (commit) value = n;
    spring = quiet ? null : {
      t: 0, dx: origin - n,
      kick: 0.13 * (direction || Math.sign(n - old))
    };
    if (quiet) {
      x = n;
      dust = 0;
      trail.fill(0);
    }
    aria();
    if (commit && n !== old) {
      write(n);
      onCommit(n);
    }
  }

  function preview(event) {
    const next = clamp(3 * (event.clientX - box.left - PAD) /
      Math.max(1, box.width - 2 * PAD));
    const delta = next - destination;
    if (delta) {
      direction = Math.sign(delta);
      // Include crossed stops even if pointermove skipped an entire stop.
      for (let i = 0; i < 4; i++) {
        if ((i - next) * (i - destination) <= 0) trail[i] = 1;
      }
    }
    destination = next;
    if (quiet) x = next;
    aria();
  }

  function end(commit) {
    if (pointer === null) return;
    const id = pointer;
    pointer = null;
    if (el.hasPointerCapture(id)) el.releasePointerCapture(id);
    land(commit ? Math.round(destination) : value, commit);
  }

  el.addEventListener("pointerdown", e => {
    if (e.button !== 0 || !e.isPrimary || pointer !== null) return;
    e.preventDefault();
    el.focus({ preventScroll: true });
    box = el.getBoundingClientRect();
    el.setPointerCapture(e.pointerId);
    pointer = e.pointerId;
    direction = 0;
    destination = clamp(x);
    held = 0;
    spring = null;
    preview(e);
  }, opts);
  el.addEventListener("pointermove", e => {
    if (e.pointerId === pointer) preview(e);
  }, opts);
  el.addEventListener("pointerup", e => {
    if (e.pointerId !== pointer) return;
    preview(e);
    end(true);
  }, opts);
  for (const type of ["pointercancel", "lostpointercapture"]) {
    el.addEventListener(type, e => {
      if (e.pointerId === pointer) end(false);
    }, opts);
  }
  el.addEventListener("keydown", e => {
    if (pointer !== null || e.altKey || e.metaKey || e.ctrlKey) return;
    let n;
    switch (e.key) {
      case "Home": n = 0; break;
      case "End": n = 3; break;
      case "ArrowUp":
      case "ArrowRight": n = clamp(value + 1); break;
      case "ArrowDown":
      case "ArrowLeft": n = clamp(value - 1); break;
      default: return;
    }
    e.preventDefault();
    e.stopPropagation();
    if (n === value) return;
    direction = Math.sign(n - value);
    land(n, true);
  }, opts);
  el.addEventListener("pond:localize", aria, opts);
  const language = new MutationObserver(aria);
  language.observe(labels, { subtree: true, childList: true, characterData: true });

  const ro = new ResizeObserver(([e]) => {
    width = e.contentRect.width;
    height = e.contentRect.height;
    resize = true;
  });
  ro.observe(el);
  aria();

  function draw(dt, n, dpr, reduced) {
    quiet = reduced;
    if (!ctx || width < 1 || height < 1) return 0;
    if (resize || scale !== dpr) {
      scale = dpr;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
      resize = false;
    }
    if (pointer !== null) {
      held = Math.min(1, held + dt / .08);
      dust = quiet ? 0 : Math.min(1, dust + dt * 8);
      x += (destination - x) * (1 - Math.exp(-25 * dt));
    } else {
      held = Math.max(0, held - dt * 8);
      dust = quiet ? 0 : Math.max(0, dust - dt * 4);
      if (spring) {
        spring.t += dt;
        const { t, dx, kick } = spring;
        if (!quiet && t < .18 && Math.abs(dx) > .15) dust = Math.min(1, dust + dt * 12);
        x = value + Math.exp(-9 * t) *
          (dx * Math.cos(15 * t) + kick * Math.sin(15 * t));
        if (quiet || t >= 0.65) {
          x = value;
          spring = null;
        }
      }
    }
    time += dt;
    ctx.clearRect(0, 0, width, height);
    const step = (width - 2 * PAD) / 3;
    const cy = height / 2;
    let count = 0;
    ctx.fillStyle = "#c8e0e7";
    for (let i = 0; i < 4; i++) {
      trail[i] = quiet ? 0 : Math.max(0, trail[i] - 2.4 * dt);
      if (Math.abs(i - x) < 0.15) continue;
      ctx.globalAlpha = 0.32 + 0.54 * trail[i];
      ctx.fillRect(PAD + step * i - 1.5, cy - 1.5, 3, 3);
      count++;
    }
    const p = clamp(x);
    const a = seasons[Math.floor(p)].mark;
    const b = seasons[Math.ceil(p)].mark;
    const f = p % 1;
    const cx = PAD + step * x;
    ctx.fillStyle = ['#ebc8d5', '#ead4d9', '#e4b47e', '#cfdeeb'][Math.round(p)];
    ctx.globalAlpha = 0.94;
    const size = quiet ? 11 : 11 * (1 + held * .1) * (1 - dust * .72);
    for (let i = 0; i < n; i++) {
      const j = i * 2;
      const z = i * 2.39996;
      const r = quiet ? 0 : dust * (2 + i % 6);
      const mx = a[j] + f * (b[j] - a[j]);
      const my = a[j + 1] + f * (b[j + 1] - a[j + 1]);
      ctx.fillRect(cx + size * mx - direction * dust * (i % 8) + r * Math.cos(z + time * 2) - 0.7,
        cy + size * my + r * Math.sin(z + time * 2) - 0.7, 1.45, 1.45);
    }
    ctx.globalAlpha = 1;
    return count + n;
  }

  return {
    get value() { return value; },
    draw,
    cancel() { end(false); },
    destroy() {
      end(false);
      events.abort();
      ro.disconnect();
      language.disconnect();
      canvas.width = canvas.height = 1;
    }
  };
}
