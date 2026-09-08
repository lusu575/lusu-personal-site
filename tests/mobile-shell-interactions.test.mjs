import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const mobileSource = readFileSync(new URL("../js/mobile-shell.js", import.meta.url), "utf8");
const motionSource = readFileSync(new URL("../js/ui-motion.js", import.meta.url), "utf8");

// Exercise the production handlers against their DOM/clock boundaries without
// starting a browser or duplicating the gesture and animation algorithms.
function handler(source, name) {
  const start = source.indexOf(`  function ${name}(`);
  assert.ok(start >= 0, `${name} must exist`);
  const end = source.indexOf("\n  function ", start + 1);
  return source.slice(start, end < 0 ? source.length : end);
}

function mobileHarness() {
  let clock = 100;
  let modal = null;
  let navigations = 0;
  let toggles = 0;
  const viewport = { keyboardOpen: false, viewportMode: "stable" };
  const handle = { hidden: false, closest: () => null, setPointerCapture() {} };
  const document = {
    hidden: false,
    body: { dataset: { route: "resources" } },
    activeElement: { matches: () => false },
    querySelector(selector) {
      return selector.startsWith(".start-button") ? { click: () => { navigations += 1; } } : modal;
    }
  };
  const context = vm.createContext({
    state: { shell: "mobile", gestureStart: null, gestureClickUntil: 0 },
    framePipeline: { snapshot: () => ({ viewport }) },
    document,
    performance: { now: () => clock },
    toggleDock: () => { toggles += 1; }
  });
  vm.runInContext([
    ...mobileSource.matchAll(/^ {2}const HOME_GESTURE_.*$/gm)
  ].map(match => match[0]).join("\n") + "\n" + [
    "homeGestureIsAvailable", "startHomeGesture", "finishHomeGesture", "handleDockToggleClick"
  ].map(name => handler(mobileSource, name)).join("\n"), context);
  const pointer = (overHandle = true) => ({
    pointerId: 4, pointerType: "touch", isPrimary: true, clientX: 180, clientY: 700,
    target: { closest: () => overHandle ? handle : null }
  });
  return {
    context, document, viewport, pointer,
    setModal: value => { modal = value; },
    start: event => context.startHomeGesture(event || pointer()),
    finish: (deltaY = 70, deltaX = 0) => {
      clock += 120;
      context.finishHomeGesture({ ...pointer(), clientX: 180 + deltaX, clientY: 700 - deltaY });
    },
    counts: () => ({ navigations, toggles })
  };
}

test("scrolling or swiping a bottom composer never activates Home", () => {
  const h = mobileHarness();
  h.start(h.pointer(false));
  h.finish();
  assert.deepEqual(h.counts(), { navigations: 0, toggles: 0 });
});

test("only an upward touch on the real Dock handle navigates once", () => {
  const h = mobileHarness();
  h.start();
  h.finish();
  h.finish();
  assert.equal(h.counts().navigations, 1);
  let prevented = false;
  h.context.handleDockToggleClick({ detail: 1, preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(h.counts().toggles, 0, "a swipe must not also collapse the Dock");
  h.context.handleDockToggleClick({ detail: 0 });
  assert.equal(h.counts().toggles, 1, "keyboard Dock activation stays available");
});

test("a handle tap still toggles the Dock and horizontal movement does not go Home", () => {
  for (const [vertical, horizontal] of [[0, 0], [70, 90], [-40, 0]]) {
    const h = mobileHarness();
    h.start();
    h.finish(vertical, horizontal);
    assert.equal(h.counts().navigations, 0);
  }
  const h = mobileHarness();
  h.start();
  h.finish(0);
  h.context.handleDockToggleClick({ detail: 1 });
  assert.equal(h.counts().toggles, 1);
});

test("keyboard, editing, modal, zoom, visibility and route changes cancel Home swipes", () => {
  const blockers = [
    h => { h.viewport.keyboardOpen = true; },
    h => { h.document.activeElement.matches = () => true; },
    h => { h.setModal({}); },
    h => { h.viewport.viewportMode = "zoom"; },
    h => { h.document.hidden = true; },
    h => { h.document.body.dataset.route = "home"; },
    h => { h.context.state.shell = "desktop"; }
  ];
  for (const block of blockers) {
    for (const beforeStart of [true, false]) {
      const h = mobileHarness();
      if (beforeStart) block(h);
      h.start();
      if (!beforeStart) block(h);
      h.finish();
      assert.equal(h.counts().navigations, 0);
    }
  }
  const h = mobileHarness();
  h.start();
  h.document.body.dataset.route = "knowledge";
  h.finish();
  assert.equal(h.counts().navigations, 0, "an old gesture cannot leave a newly selected route");
});

test("mouse, pen and secondary pointers do not acquire the touch-only Home gesture", () => {
  for (const event of [
    { pointerType: "mouse" }, { pointerType: "pen" }, { isPrimary: false }
  ]) {
    const h = mobileHarness();
    h.start({ ...h.pointer(), ...event });
    h.finish();
    assert.equal(h.counts().navigations, 0);
  }
});

test("an earlier theme timer cannot clear the latest transition's class", () => {
  const pending = [];
  const classes = new Set();
  const element = { classList: { add: name => classes.add(name), remove: name => classes.delete(name) } };
  const context = vm.createContext({
    state: { transientClasses: new WeakMap() }, DURATIONS: { standard: 200 },
    isElement: value => Boolean(value), scheduleTimer: callback => pending.push(callback)
  });
  vm.runInContext(handler(motionSource, "transientClass"), context);
  context.transientClass(element, "is-ui-theme-changing", 300);
  context.transientClass(element, "is-ui-theme-changing", 300);
  pending[0]();
  assert.equal(classes.has("is-ui-theme-changing"), true);
  pending[1]();
  assert.equal(classes.size, 0);
});

test("leaving an App cancels its animation while preserving unrelated chrome and surfaces", () => {
  const page = { contains: element => element.inPage === true };
  const child = { inPage: true };
  const dock = { inPage: false };
  let cancelled = 0;
  const record = element => ({ element, animation: { cancel: () => { cancelled += 1; } } });
  const context = vm.createContext({
    state: { animations: [record(page), record(child), record(dock)], activeRoute: "resources" },
    routeName: value => value,
    safeQuery: () => page,
    safeQueryAll: () => [],
    resetParallax() {}
  });
  vm.runInContext(["cancelAnimationsFor", "cancelAnimationsWithin", "leaveRoute"]
    .map(name => handler(motionSource, name)).join("\n"), context);
  context.leaveRoute("resources");
  assert.equal(cancelled, 2);
  assert.equal(context.state.animations.length, 1);
  assert.equal(context.state.animations[0].element, dock);
});

test("a rapidly replaced account state continues from its visible frame", () => {
  const element = { hidden: false };
  let result;
  const context = vm.createContext({
    state: { animations: [{ element }] },
    DURATIONS: { fast: 140, standard: 200 }, EASING: { out: "ease-out" },
    isElement: value => Boolean(value), canUseSemanticMotion: () => true,
    canUseFullMotion: () => true, clamp: (value, min, max) => Math.min(max, Math.max(min, value)),
    readAnimatedFrame: () => ({ opacity: "0.6", transform: "matrix(1,0,0,1,0,2)" }),
    animateElement: (_element, frames, options) => { result = { frames, options }; },
    cancelAnimationsFor() {}
  });
  vm.runInContext(handler(motionSource, "animateStateChange"), context);
  context.animateStateChange(element);
  assert.equal(result.frames[0].opacity, "0.6");
  assert.equal(result.frames[0].transform, "matrix(1,0,0,1,0,2)");
  assert.equal(result.frames[1].opacity, 1);
  assert.equal(result.options.duration, 200);
});
