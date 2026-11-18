const VISIT = "v3:pond:boot-seen";
let startedHere = false;

export function beginBoot(home, reduced, ripple) {
  // Caller only enters here on a visible home route.
  if (document.body.dataset.route !== "home" || document.hidden || startedHere) return null;
  startedHere = true;
  const copy = home.querySelector("#pond-post-copy");
  let quick = false;
  try {
    quick = localStorage.getItem(VISIT) === "1";
  } catch { /* session-only */ }

  function remember() {
    try {
      localStorage.setItem(VISIT, "1");
    } catch { /* startedHere still prevents same-document replay */ }
  }
  if (reduced || document.querySelector('.modal:not([hidden])')) {
    copy?.remove();
    remember();
    return null;
  }

  const previous = document.activeElement;
  const layer = document.createElement("div");
  layer.className = "pond-boot-layer";
  layer.dataset.phase = "line";
  const skip = document.createElement("button");
  skip.type = "button";
  skip.className = "pond-skip";
  skip.textContent = "»";
  skip.setAttribute("aria-label", ({zh: "跳过开机", ja: "起動演出をスキップ"})[document.documentElement.lang.slice(0, 2)] || "Skip startup");
  layer.append(skip);
  const line = document.createElement("i");
  line.className = "pond-boot-line";
  layer.append(line);
  if (copy && !quick) {
    layer.append(copy);
    copy.hidden = false;
  } else {
    copy?.remove();
  }
  home.dataset.pondBoot = "hold";
  home.toggleAttribute("data-pond-quick", quick);
  document.body.append(layer);

  const events = new AbortController();
  const capture = { capture: true, passive: false, signal: events.signal };
  const pointers = new Set();
  const keys = new Set();
  let age = 0;
  let opened = false;
  let playing = true;
  let closed = false;
  let timer = 0;

  function close() {
    if (closed) return;
    closed = true;
    clearTimeout(timer);
    events.abort();
    layer.remove();
    delete home.dataset.pondBoot;
    home.style.removeProperty("--pond-warm");
    home.removeAttribute("data-pond-quick");
    // Do not move focus on route exit or steal a new focus target.
    if (document.activeElement === document.body && previous?.isConnected &&
        document.body.dataset.route === "home" && previous !== document.body) {
      previous.focus?.({ preventScroll: true });
    }
  }

  function ready() {
    if (!playing) return;
    playing = false;
    remember();
    delete home.dataset.pondBoot;
    layer.dataset.phase = "shield";
  }

  function finish() {
    ready();
    if (!pointers.size && !keys.size) close();
  }

  function input(e) {
    if (document.body.dataset.route !== "home") {
      close();
      return;
    }
    if (e.cancelable) e.preventDefault();
    e.stopImmediatePropagation();
    // Hide the artwork now, but keep the event target through release/click.
    ready();
    clearTimeout(timer);
    const code = e.code || e.key;
    if (e.type === "pointerdown") pointers.add(e.pointerId);
    if (e.type === "pointerup" || e.type === "pointercancel") pointers.delete(e.pointerId);
    if (e.type === "keydown") keys.add(code);
    if (e.type === "keyup") keys.delete(code);
    if (pointers.size || keys.size) return;
    if (e.type === "click") {
      close();
    } else {
      // Handles a cancelled touch, a key with no click, or a release off-target.
      timer = setTimeout(close, 80);
    }
  }

  for (const type of [
    "pointerdown", "pointerup", "pointercancel", "touchstart", "touchend",
    "touchcancel", "mousedown", "mouseup", "click", "auxclick", "contextmenu",
    "keydown", "keypress", "keyup"
  ]) window.addEventListener(type, input, capture);

  function releaseShield() {
    if (!playing) close();
  }
  window.addEventListener("blur", releaseShield, { signal: events.signal });

  function tick(ms) {
    if (!playing) return;
    age += Math.max(0, ms);
    const reveal = quick ? 90 : 1550;
    const end = quick ? 400 : 2900;
    if (age >= reveal && !opened) {
      opened = true;
      home.dataset.pondBoot = "reveal";
      layer.dataset.phase = "reveal";
      ripple();
    }
    if (age >= end) {
      finish();
    } else if (!opened) {
      if (!quick && age >= 850) {
        layer.dataset.phase = "post";
        const rows = copy?.children;
        if (rows) {
          for (let i = 0; i < rows.length; i++) {
            rows[i].classList.toggle("is-on", age >= 850 + i * 200);
          }
        }
      } else if (!quick && age >= 350) {
        layer.dataset.phase = "warm";
        home.style.setProperty("--pond-warm", String(1 - (age - 350) / 500));
      }
    }
    if (opened || age >= 850) home.style.removeProperty("--pond-warm");
  }

  return {
    get playing() { return playing; },
    tick,
    finish() {
      home.style.removeProperty("--pond-warm");
      finish();
    },
    releaseShield,
    destroy() {
      // Route exit/unmount is not a completed or skipped boot.
      playing = false;
      home.style.removeProperty("--pond-warm");
      close();
    }
  };
}
