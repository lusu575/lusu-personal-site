(function bootstrapLusuUiMotion(global) {
  "use strict";

  if (!global || !global.document) {
    return;
  }

  var document = global.document;
  var root = document.documentElement;
  var VERSION = "1.3.0";
  var MAX_PARALLAX_PX = 0;
  var ROUTE_ORDER = ["home", "knowledge", "videos", "resources", "games", "blog", "chatroom", "about"];
  var TRIGGER_SELECTOR = [
    ".desktop-icon",
    ".start-button",
    ".taskbar-tabs button",
    ".brand-button",
    ".account-button",
    ".lang-button",
    ".titlebar-button",
    ".close-button",
    ".xp-button",
    ".card-action",
    ".quick-link",
    "[data-route]",
    "[data-article-slug]",
    "[data-article-category]",
    "[data-video-id]",
    "[data-video-index]",
    "[data-close-modal]",
    "[data-close-welcome]"
  ].join(",");

  var DURATIONS = {
    instant: 80,
    fast: 140,
    standard: 200,
    window: 220,
    scene: 300
  };

  var EASING = {
    out: "cubic-bezier(.22,1,.36,1)",
    spring: "cubic-bezier(.22,1,.36,1)",
    in: "cubic-bezier(.4,0,1,1)"
  };

  var state = {
    initialized: false,
    destroyed: false,
    mode: "full",
    forcedMode: "",
    reducedMedia: null,
    finePointerMedia: null,
    listeners: [],
    mediaListeners: [],
    observer: null,
    rafId: 0,
    targetX: 0,
    targetY: 0,
    currentX: 0,
    currentY: 0,
    parallaxLimit: MAX_PARALLAX_PX,
    animations: [],
    timers: [],
    lastTrigger: null,
    triggerTimer: 0,
    pressedTarget: null,
    lastRoute: "",
    lastTheme: "",
    runId: 0,
    activeRunId: 0,
    activeViewTransition: null,
    suppressRouteUntil: 0,
    suppressThemeUntil: 0
  };

  var requestFrame = typeof global.requestAnimationFrame === "function"
    ? function requestNativeFrame(callback) { return global.requestAnimationFrame(callback); }
    : function requestFallbackFrame(callback) { return global.setTimeout(callback, 16); };

  var cancelFrame = typeof global.cancelAnimationFrame === "function"
    ? function cancelNativeFrame(id) { global.cancelAnimationFrame(id); }
    : function cancelFallbackFrame(id) { global.clearTimeout(id); };

  function now() {
    return typeof Date.now === "function" ? Date.now() : new Date().getTime();
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function isElement(value) {
    return Boolean(value && value.nodeType === 1 && typeof value.getBoundingClientRect === "function");
  }

  function elementMatches(element, selector) {
    if (!isElement(element)) {
      return false;
    }
    var matcher = element.matches
      || element.msMatchesSelector
      || element.webkitMatchesSelector;
    if (typeof matcher !== "function") {
      return false;
    }
    try {
      return matcher.call(element, selector);
    } catch (error) {
      return false;
    }
  }

  function closestElement(start, selector) {
    var node = isElement(start) ? start : start && start.parentElement;
    while (isElement(node)) {
      if (elementMatches(node, selector)) {
        return node;
      }
      node = node.parentElement;
    }
    return null;
  }

  function safeQuery(selector, scope) {
    if (typeof selector !== "string" || !selector || !document.querySelector) {
      return null;
    }
    try {
      return (scope || document).querySelector(selector);
    } catch (error) {
      return null;
    }
  }

  function safeQueryAll(selector, scope) {
    if (typeof selector !== "string" || !selector || !document.querySelectorAll) {
      return [];
    }
    try {
      return Array.prototype.slice.call((scope || document).querySelectorAll(selector));
    } catch (error) {
      return [];
    }
  }

  function isConnected(element) {
    if (!isElement(element)) {
      return false;
    }
    if (typeof element.isConnected === "boolean") {
      return element.isConnected;
    }
    return Boolean(document.documentElement && document.documentElement.contains(element));
  }

  function setData(element, key, value) {
    if (!isElement(element)) {
      return;
    }
    element.setAttribute("data-" + key.replace(/[A-Z]/g, function toKebab(match) {
      return "-" + match.toLowerCase();
    }), String(value));
  }

  function removeData(element, key) {
    if (!isElement(element)) {
      return;
    }
    element.removeAttribute("data-" + key.replace(/[A-Z]/g, function toKebab(match) {
      return "-" + match.toLowerCase();
    }));
  }

  function readData(element, key) {
    if (!isElement(element)) {
      return "";
    }
    return element.getAttribute("data-" + key.replace(/[A-Z]/g, function toKebab(match) {
      return "-" + match.toLowerCase();
    })) || "";
  }

  function safeRect(element) {
    if (!isElement(element)) {
      return null;
    }
    try {
      var rect = element.getBoundingClientRect();
      if (!rect || !isFinite(rect.left) || !isFinite(rect.top)) {
        return null;
      }
      return {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: Math.max(0, rect.width || rect.right - rect.left),
        height: Math.max(0, rect.height || rect.bottom - rect.top)
      };
    } catch (error) {
      return null;
    }
  }

  function sanitizeRect(value) {
    if (!value || typeof value !== "object") {
      return null;
    }
    var left = Number(value.left);
    var top = Number(value.top);
    var width = Number(value.width);
    var height = Number(value.height);
    if (![left, top, width, height].every(function isFiniteNumber(item) {
      return isFinite(item);
    })) {
      return null;
    }
    width = clamp(Math.max(0, width), 0, global.innerWidth * 2 || 4096);
    height = clamp(Math.max(0, height), 0, global.innerHeight * 2 || 4096);
    return {
      left: left,
      top: top,
      right: left + width,
      bottom: top + height,
      width: width,
      height: height
    };
  }

  function routeName(value) {
    var route = String(value || "").trim();
    return /^[a-z][a-z0-9-]{0,31}$/.test(route) ? route : "";
  }

  function currentRoute() {
    var body = document.body;
    return routeName(body && readData(body, "route")) || "home";
  }

  function routeDirection(fromRoute, toRoute) {
    var fromIndex = ROUTE_ORDER.indexOf(routeName(fromRoute) || "home");
    var toIndex = ROUTE_ORDER.indexOf(routeName(toRoute) || "home");
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
      return "forward";
    }
    return toIndex > fromIndex ? "forward" : "backward";
  }

  function currentTheme() {
    var body = document.body;
    return body ? readData(body, "timeTheme") : "";
  }

  function shellMode() {
    var body = document.body;
    return readData(root, "uiShell") || (body ? readData(body, "uiShell") : "");
  }

  function addListener(target, type, handler, options) {
    if (!target || typeof target.addEventListener !== "function") {
      return;
    }
    try {
      target.addEventListener(type, handler, options || false);
      state.listeners.push({ target: target, type: type, handler: handler, options: options || false });
    } catch (error) {
      target.addEventListener(type, handler, false);
      state.listeners.push({ target: target, type: type, handler: handler, options: false });
    }
  }

  function removeListeners() {
    state.listeners.forEach(function removeListener(record) {
      try {
        record.target.removeEventListener(record.type, record.handler, record.options);
      } catch (error) {
        record.target.removeEventListener(record.type, record.handler, false);
      }
    });
    state.listeners.length = 0;
  }

  function createMediaQuery(query) {
    if (typeof global.matchMedia !== "function") {
      return null;
    }
    try {
      return global.matchMedia(query);
    } catch (error) {
      return null;
    }
  }

  function addMediaListener(media, handler) {
    if (!media) {
      return;
    }
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", handler);
      state.mediaListeners.push({ media: media, handler: handler, modern: true });
    } else if (typeof media.addListener === "function") {
      media.addListener(handler);
      state.mediaListeners.push({ media: media, handler: handler, modern: false });
    }
  }

  function removeMediaListeners() {
    state.mediaListeners.forEach(function removeMedia(record) {
      if (record.modern && typeof record.media.removeEventListener === "function") {
        record.media.removeEventListener("change", record.handler);
      } else if (typeof record.media.removeListener === "function") {
        record.media.removeListener(record.handler);
      }
    });
    state.mediaListeners.length = 0;
  }

  function scheduleTimer(callback, delay) {
    var timer = global.setTimeout(function runScheduledCallback() {
      state.timers = state.timers.filter(function keepOtherTimer(item) {
        return item !== timer;
      });
      callback();
    }, delay);
    state.timers.push(timer);
    return timer;
  }

  function clearTimers() {
    state.timers.forEach(function clearTimer(timer) {
      global.clearTimeout(timer);
    });
    state.timers.length = 0;
  }

  function dispatchHook(name, detail) {
    if (!document.dispatchEvent) {
      return;
    }
    var event;
    var safeDetail = detail || {};
    try {
      if (typeof global.CustomEvent === "function") {
        event = new global.CustomEvent(name, { detail: safeDetail });
      } else if (typeof document.createEvent === "function") {
        event = document.createEvent("CustomEvent");
        event.initCustomEvent(name, false, false, safeDetail);
      }
      if (event) {
        document.dispatchEvent(event);
      }
    } catch (error) {
      // Hooks are optional; presentation failures never block business state.
    }
  }

  function preferredMotionMode() {
    if (document.hidden || state.forcedMode === "off") {
      return "off";
    }
    if (state.forcedMode === "reduced" || (state.reducedMedia && state.reducedMedia.matches)) {
      return "reduced";
    }
    return "full";
  }

  function writeMotionMode(mode) {
    var normalized = mode === "off" || mode === "reduced" ? mode : "full";
    state.mode = normalized;
    setData(root, "motion", normalized);
    if (document.body) {
      setData(document.body, "motion", normalized);
    }
    var wallpaper = safeQuery("#wallpaper-root");
    if (wallpaper) {
      setData(wallpaper, "motion", normalized);
      setData(wallpaper, "paused", document.hidden ? "true" : "false");
    }
  }

  function syncMotionMode() {
    var previous = state.mode;
    writeMotionMode(preferredMotionMode());
    if (state.mode !== "full") {
      resetParallax(true);
      stopAnimations();
    }
    if (previous !== state.mode) {
      dispatchHook("lusu:ui-motion-mode", { mode: state.mode });
    }
    return state.mode;
  }

  function setMode(mode) {
    state.forcedMode = mode === "off" || mode === "reduced" ? mode : "";
    return syncMotionMode();
  }

  function canUseFullMotion() {
    return state.initialized && !state.destroyed && state.mode === "full" && !document.hidden;
  }

  function canUseParallax() {
    return false;
  }

  function writeParallax() {
    root.style.setProperty("--ui-parallax-x", state.currentX.toFixed(3) + "px");
    root.style.setProperty("--ui-parallax-y", state.currentY.toFixed(3) + "px");
  }

  function parallaxFrame() {
    state.rafId = 0;
    if (!canUseParallax()) {
      resetParallax(true);
      return;
    }

    state.currentX += (state.targetX - state.currentX) * 0.16;
    state.currentY += (state.targetY - state.currentY) * 0.16;

    if (Math.abs(state.targetX - state.currentX) < 0.01) {
      state.currentX = state.targetX;
    }
    if (Math.abs(state.targetY - state.currentY) < 0.01) {
      state.currentY = state.targetY;
    }

    writeParallax();
    if (state.currentX !== state.targetX || state.currentY !== state.targetY) {
      state.rafId = requestFrame(parallaxFrame);
    }
  }

  function scheduleParallaxFrame() {
    if (!state.rafId) {
      state.rafId = requestFrame(parallaxFrame);
    }
  }

  function resetParallax(immediate) {
    state.targetX = 0;
    state.targetY = 0;
    if (immediate) {
      if (state.rafId) {
        cancelFrame(state.rafId);
        state.rafId = 0;
      }
      state.currentX = 0;
      state.currentY = 0;
      writeParallax();
      return;
    }
    scheduleParallaxFrame();
  }

  function handlePointerMove(event) {
    if (!canUseParallax() || (event.pointerType && event.pointerType !== "mouse" && event.pointerType !== "pen")) {
      return;
    }
    var width = Math.max(global.innerWidth || 0, 1);
    var height = Math.max(global.innerHeight || 0, 1);
    var normalizedX = clamp((Number(event.clientX) / width - 0.5) * 2, -1, 1);
    var normalizedY = clamp((Number(event.clientY) / height - 0.5) * 2, -1, 1);
    state.targetX = normalizedX * state.parallaxLimit;
    state.targetY = normalizedY * state.parallaxLimit * 0.72;
    scheduleParallaxFrame();
  }

  function handlePointerLeave(event) {
    if (!event || event.relatedTarget == null) {
      resetParallax(false);
    }
  }

  function transientClass(element, className, duration) {
    if (!isElement(element) || !element.classList) {
      return;
    }
    element.classList.add(className);
    scheduleTimer(function removeTransientClass() {
      if (element.classList) {
        element.classList.remove(className);
      }
    }, Math.max(1, duration || DURATIONS.standard));
  }

  function triggerSnapshot() {
    var snapshot = state.lastTrigger;
    if (!snapshot || now() - snapshot.at > 2400) {
      return null;
    }
    return snapshot;
  }

  function noteTrigger(element, metadata) {
    var target = isElement(element) ? element : closestElement(element, TRIGGER_SELECTOR);
    if (!target || target === document.body || target === root) {
      return null;
    }
    if (elementMatches(target, "input, textarea, select, [contenteditable='true']")) {
      return null;
    }

    var meta = metadata && typeof metadata === "object" ? metadata : {};
    var snapshot = {
      element: target,
      rect: safeRect(target),
      route: routeName(readData(target, "route") || meta.route),
      kind: typeof meta.kind === "string" ? meta.kind.slice(0, 40) : "",
      at: now()
    };
    state.lastTrigger = snapshot;
    if (state.triggerTimer) {
      global.clearTimeout(state.triggerTimer);
    }
    state.triggerTimer = global.setTimeout(function clearTrigger() {
      if (state.lastTrigger === snapshot) {
        state.lastTrigger = null;
      }
      state.triggerTimer = 0;
    }, 2500);
    return snapshot;
  }

  function handlePointerDown(event) {
    setData(root, "inputMethod", "pointer");
    releasePressedTarget();
    var target = closestElement(event.target, TRIGGER_SELECTOR);
    if (!target) {
      return;
    }
    var snapshot = noteTrigger(target, { kind: "press" });
    if (!snapshot) {
      return;
    }
    state.pressedTarget = snapshot.element;
    if (snapshot.element.classList) {
      snapshot.element.classList.add("is-ui-pressed");
    }
  }

  function releasePressedTarget() {
    var target = state.pressedTarget;
    state.pressedTarget = null;
    if (target && target.classList) {
      target.classList.remove("is-ui-pressed");
    }
  }

  function handleClick(event) {
    var target = closestElement(event.target, TRIGGER_SELECTOR);
    if (!target) {
      return;
    }
    noteTrigger(target, { kind: "activate" });
  }

  function handleKeyDown(event) {
    if (event && event.key === "Tab") {
      setData(root, "inputMethod", "keyboard");
    }
  }

  function cancelAnimationsFor(element) {
    state.animations = state.animations.filter(function cancelMatching(record) {
      if (record.element !== element) {
        return true;
      }
      try {
        record.animation.cancel();
      } catch (error) {
        // Animation cancellation is best-effort.
      }
      return false;
    });
  }

  function stopAnimations() {
    state.animations.forEach(function cancelAnimation(record) {
      try {
        record.animation.cancel();
      } catch (error) {
        // Animation cancellation is best-effort.
      }
    });
    state.animations.length = 0;
  }

  function animationPromise(animation, duration) {
    if (!global.Promise) {
      return null;
    }
    if (animation && animation.finished && typeof animation.finished.then === "function") {
      return animation.finished.then(function animationDone() {
        return undefined;
      }, function animationCancelled() {
        return undefined;
      });
    }
    return new global.Promise(function finishLegacyAnimation(resolve) {
      var settled = false;
      var finish = function finish() {
        if (settled) {
          return;
        }
        settled = true;
        resolve();
      };
      animation.onfinish = finish;
      animation.oncancel = finish;
      global.setTimeout(finish, duration + 80);
    });
  }

  function animateElement(element, keyframes, options) {
    if (!canUseFullMotion() || !isElement(element) || typeof element.animate !== "function") {
      return null;
    }
    var duration = Math.max(1, Number(options && options.duration) || DURATIONS.standard);
    cancelAnimationsFor(element);
    try {
      var animation = element.animate(keyframes, {
        duration: duration,
        easing: options && options.easing ? options.easing : EASING.out,
        fill: options && options.fill ? options.fill : "both"
      });
      var record = { animation: animation, element: element };
      state.animations.push(record);
      var finished = animationPromise(animation, duration);
      if (finished && typeof finished.then === "function") {
        finished.then(function removeAnimationRecord() {
          try {
            animation.cancel();
          } catch (error) {
            // Clearing a finished effect is best-effort.
          }
          state.animations = state.animations.filter(function keepOtherAnimation(item) {
            return item !== record;
          });
        });
      } else {
        scheduleTimer(function removeLegacyAnimationRecord() {
          try {
            animation.cancel();
          } catch (error) {
            // Clearing a finished effect is best-effort.
          }
          state.animations = state.animations.filter(function keepOtherAnimation(item) {
            return item !== record;
          });
        }, duration + 100);
      }
      return finished;
    } catch (error) {
      return null;
    }
  }

  function originTransform(origin, target) {
    if (!origin || !target) {
      return { x: 0, y: 10, scale: 0.97 };
    }
    var originCenterX = origin.left + origin.width / 2;
    var originCenterY = origin.top + origin.height / 2;
    var targetCenterX = target.left + target.width / 2;
    var targetCenterY = target.top + target.height / 2;
    var ratioX = target.width > 0 ? origin.width / target.width : 1;
    var ratioY = target.height > 0 ? origin.height / target.height : 1;
    return {
      x: clamp(originCenterX - targetCenterX, -180, 180),
      y: clamp(originCenterY - targetCenterY, -130, 130),
      scale: clamp(Math.min(ratioX || 1, ratioY || 1), 0.84, 0.97)
    };
  }

  function resolveContextElement(value) {
    if (isElement(value)) {
      return value;
    }
    if (typeof value === "string") {
      return safeQuery(value);
    }
    return null;
  }

  function resolveMotionTarget(kind, context, phase) {
    var direct = resolveContextElement(context && (context.target || context.element || context.window));
    if (direct) {
      return direct;
    }

    if (kind.indexOf("modal") === 0) {
      var modal = resolveContextElement(context && context.modal)
        || safeQuery(".modal:not([hidden])");
      return modal ? safeQuery(".xp-window", modal) || modal : safeQuery(".account-popover:not([hidden])");
    }

    if (kind === "theme") {
      return safeQuery("#wallpaper-root .wallpaper-base") || safeQuery("#wallpaper-root");
    }

    if ((kind === "route" || kind === "app-open") && shellMode() === "desktop") {
      if (currentRoute() === "home") {
        return safeQuery(".desktop-icons") || safeQuery(".page.active");
      }
      return safeQuery(".page.active > .xp-window") || safeQuery(".page.active");
    }

    if (kind === "route" || kind === "app-open" || kind === "mobile-tab") {
      return safeQuery(".page.active") || safeQuery(".site-shell");
    }

    if (phase === "before") {
      return safeQuery(".page.active .xp-window") || safeQuery(".page.active");
    }
    return safeQuery(".page.active .xp-window") || safeQuery(".page.active");
  }

  function enterAnimation(kind, target, origin) {
    if (!isElement(target)) {
      return null;
    }
    if (kind.indexOf("modal") === 0) {
      return animateElement(target, [
        { opacity: 0, transformOrigin: "center center", transform: "translate3d(0,6px,0) scale(.995)" },
        { opacity: 1, transformOrigin: "center center", transform: "translate3d(0,0,0) scale(1)" }
      ], { duration: DURATIONS.standard, easing: EASING.out });
    }

    return animateElement(target, [
      { opacity: 0.72, transformOrigin: "center center", transform: "translate3d(0,6px,0) scale(.995)" },
      { opacity: 1, transformOrigin: "center center", transform: "translate3d(0,0,0) scale(1)" }
    ], { duration: DURATIONS.standard, easing: EASING.out });
  }

  function exitAnimation(kind, target, origin) {
    if (!isElement(target)) {
      return null;
    }
    var targetRect = safeRect(target);
    var delta = originTransform(origin, targetRect);
    var maxShift = kind === "window-minimize" || kind === "minimize" ? 12 : 8;
    var exitX = origin ? clamp(delta.x, -maxShift, maxShift) : 0;
    var exitY = origin ? clamp(delta.y, -maxShift, maxShift) : 4;
    return animateElement(target, [
      { opacity: 1, transformOrigin: "center center", transform: "translate3d(0,0,0) scale(1)" },
      {
        opacity: 0,
        transformOrigin: "center center",
        transform: "translate3d(" + exitX.toFixed(2) + "px," + exitY.toFixed(2) + "px,0) scale(.995)"
      }
    ], { duration: DURATIONS.fast, easing: EASING.in });
  }

  function flipAnimation(target, beforeRect) {
    if (!isElement(target)) {
      return null;
    }
    return animateElement(target, [
      { opacity: 0.92, transformOrigin: "center center", transform: "scale(.997)" },
      { opacity: 1, transformOrigin: "center center", transform: "scale(1)" }
    ], { duration: DURATIONS.standard, easing: EASING.out });
  }

  function routeEnterAnimation(target, direction) {
    if (!isElement(target)) {
      return null;
    }
    var backward = direction === "backward";
    var distance = backward ? -6 : 6;
    return animateElement(target, [
      { opacity: 0.68, transform: "translate3d(" + distance + "px,0,0)" },
      { opacity: 1, transform: "translate3d(0,0,0)" }
    ], { duration: DURATIONS.standard, easing: EASING.out });
  }

  function appOpenEnterAnimation(target) {
    if (!isElement(target)) {
      return null;
    }
    return animateElement(target, [
      { opacity: 0.84, transform: "translate3d(0,3px,0)" },
      { opacity: 1, transform: "translate3d(0,0,0)" }
    ], { duration: DURATIONS.standard, easing: EASING.out });
  }

  function mobileTabEnterAnimation(target, direction) {
    if (!isElement(target)) {
      return null;
    }
    var distance = direction === "backward" ? -12 : 12;
    return animateElement(target, [
      { opacity: 0.68, transform: "translate3d(" + distance + "px,0,0)" },
      { opacity: 1, transform: "translate3d(0,0,0)" }
    ], { duration: DURATIONS.window, easing: EASING.out });
  }

  function isExitKind(kind) {
    return kind === "window-close"
      || kind === "window-minimize"
      || kind === "modal-close"
      || kind === "close"
      || kind === "minimize";
  }

  function isLayoutKind(kind) {
    return kind === "window-maximize"
      || kind === "window-restore"
      || kind === "layout";
  }

  function normalizedKind(value) {
    var kind = String(value || "route").toLowerCase().replace(/[^a-z0-9-]/g, "");
    var aliases = {
      navigate: "route",
      open: "window-open",
      close: "window-close",
      maximize: "window-maximize",
      restore: "window-restore",
      modal: "modal-open"
    };
    return aliases[kind] || kind || "route";
  }

  function promiseAfter(value, animation, cleanup) {
    if (!global.Promise) {
      cleanup();
      return value;
    }
    var valuePromise = global.Promise.resolve(value);
    var animationResult = animation && typeof animation.then === "function"
      ? animation
      : global.Promise.resolve();
    return valuePromise.then(function waitForAnimation(result) {
      return animationResult.then(function animationComplete() {
        cleanup();
        return result;
      }, function animationFailed() {
        cleanup();
        return result;
      });
    }, function commitRejected(error) {
      cleanup();
      throw error;
    });
  }

  function run(kindValue, contextValue, commitValue) {
    var kind = normalizedKind(kindValue);
    var context = contextValue && typeof contextValue === "object" ? contextValue : {};
    var commit = typeof commitValue === "function" ? commitValue : function emptyCommit() {};
    var committed = false;
    var committedResult;
    var runId = ++state.runId;
    var beforeRoute = currentRoute();
    var beforeTheme = currentTheme();
    var trigger = resolveContextElement(context.trigger);
    var snapshot = trigger ? noteTrigger(trigger, { kind: kind, route: context.route }) : triggerSnapshot();
    var origin = sanitizeRect(context.originRect) || (snapshot && snapshot.rect) || null;
    var beforeTarget = resolveMotionTarget(kind, context, "before");
    var beforeRect = safeRect(beforeTarget);
    var transition = null;
    var deferCommit = Boolean(context.deferCommit && isExitKind(kind));
    var useViewTransition = Boolean(
      context.useViewTransition
      && canUseFullMotion()
      && typeof document.startViewTransition === "function"
    );
    var direction = kind === "route" || kind === "app-open" || kind === "mobile-tab"
      ? routeDirection(beforeRoute, context.route || "home")
      : "";

    if (!state.initialized && document.body) {
      init();
    }

    if (state.activeViewTransition && typeof state.activeViewTransition.skipTransition === "function") {
      try {
        state.activeViewTransition.skipTransition();
      } catch (error) {
        // A transition that already finished does not need further cleanup.
      }
      state.activeViewTransition = null;
    }
    state.activeRunId = runId;
    setData(root, "uiTransition", kind);
    if (direction) {
      setData(root, "uiDirection", direction);
    }
    state.suppressRouteUntil = now() + (deferCommit ? DURATIONS.window + 220 : 180);
    if (kind === "theme") {
      state.suppressThemeUntil = now() + (useViewTransition ? DURATIONS.scene + 180 : 180);
    }
    dispatchHook("lusu:ui-motion-before", { kind: kind, mode: state.mode });

    function commitOnce() {
      if (committed) {
        return committedResult;
      }
      committed = true;
      committedResult = commit();
      return committedResult;
    }

    function cleanup() {
      if (state.activeRunId === runId) {
        removeData(root, "uiTransition");
        removeData(root, "uiDirection");
        state.activeRunId = 0;
      }
      if (state.activeViewTransition === transition) {
        state.activeViewTransition = null;
      }
      dispatchHook("lusu:ui-motion-after", {
        kind: kind,
        mode: state.mode,
        route: currentRoute(),
        theme: currentTheme()
      });
    }

    function animateAfterCommit(result, options) {
      var afterRoute = currentRoute();
      var afterTheme = currentTheme();
      var target = resolveMotionTarget(kind, context, "after");
      var animation = null;

      if (!canUseFullMotion()) {
        cleanup();
        return global.Promise ? global.Promise.resolve(result) : result;
      }

      if (kind === "theme") {
        handleThemeProjection(beforeTheme, afterTheme, true);
      } else if (isLayoutKind(kind)) {
        animation = flipAnimation(target || beforeTarget, beforeRect);
      } else if (kind === "route" && options && options.routeFallback) {
        animation = routeEnterAnimation(target, direction);
      } else if (kind === "app-open" && options && options.appOpenFallback) {
        animation = appOpenEnterAnimation(target);
      } else if (kind === "mobile-tab" && options && options.mobileTabFallback) {
        animation = mobileTabEnterAnimation(target, direction);
      } else if (!isExitKind(kind) && !(kind === "route" && options && options.skipEnter)) {
        animation = enterAnimation(kind, target, origin);
      }

      decorateRouteTransition(beforeRoute, afterRoute, snapshot, true);
      return promiseAfter(result, animation, options && options.deferCleanup ? function keepTransitionState() {} : cleanup);
    }

    if (!canUseFullMotion()) {
      try {
        var immediateResult = commitOnce();
        cleanup();
        return global.Promise ? global.Promise.resolve(immediateResult) : immediateResult;
      } catch (error) {
        cleanup();
        if (global.Promise) {
          return global.Promise.reject(error);
        }
        throw error;
      }
    }

    if (deferCommit) {
      var exit = exitAnimation(kind, beforeTarget, origin);
      if (global.Promise && exit && typeof exit.then === "function") {
        var commitAfterExit = function commitAfterExit() {
          try {
            return animateAfterCommit(commitOnce());
          } catch (error) {
            cleanup();
            throw error;
          }
        };
        return exit.then(commitAfterExit, commitAfterExit);
      }
    }

    if (kind === "route" && !useViewTransition) {
      try {
        return animateAfterCommit(commitOnce(), { routeFallback: true });
      } catch (error) {
        cleanup();
        if (global.Promise) {
          return global.Promise.reject(error);
        }
        throw error;
      }
    }

    if (kind === "app-open" && !useViewTransition) {
      try {
        return animateAfterCommit(commitOnce(), { appOpenFallback: true });
      } catch (error) {
        cleanup();
        if (global.Promise) {
          return global.Promise.reject(error);
        }
        throw error;
      }
    }

    if (kind === "mobile-tab" && !useViewTransition) {
      try {
        return animateAfterCommit(commitOnce(), { mobileTabFallback: true });
      } catch (error) {
        cleanup();
        if (global.Promise) {
          return global.Promise.reject(error);
        }
        throw error;
      }
    }

    if (useViewTransition) {
      try {
        transition = document.startViewTransition(function transitionCommit() {
          return commitOnce();
        });
        state.activeViewTransition = transition;
        if (global.Promise && transition && transition.ready && typeof transition.ready.then === "function") {
          transition.ready.then(function viewTransitionReady() {}, function viewTransitionReadySkipped() {});
        }
        if (global.Promise && transition && transition.updateCallbackDone) {
          return transition.updateCallbackDone.then(function viewCommitDone() {
            var afterResult = animateAfterCommit(committedResult, {
              deferCleanup: true,
              skipEnter: kind === "route" || kind === "app-open" || kind === "mobile-tab"
            });
            return global.Promise.resolve(afterResult).then(function waitForViewTransition(result) {
              if (transition.finished && typeof transition.finished.then === "function") {
                return transition.finished.then(function viewTransitionDone() {
                  cleanup();
                  return result;
                }, function viewTransitionSkipped() {
                  cleanup();
                  return result;
                });
              }
              cleanup();
              return result;
            });
          }, function viewCommitFailed(error) {
            if (!committed) {
              try {
                commitOnce();
              } catch (commitError) {
                cleanup();
                throw commitError;
              }
            }
            cleanup();
            throw error;
          });
        }
        if (transition && transition.finished && typeof transition.finished.then === "function") {
          return transition.finished.then(function viewTransitionDoneWithoutUpdatePromise() {
            cleanup();
            return committedResult;
          }, function viewTransitionSkippedWithoutUpdatePromise() {
            cleanup();
            return committedResult;
          });
        }
        cleanup();
        return committedResult;
      } catch (error) {
        if (!committed) {
          try {
            return animateAfterCommit(commitOnce());
          } catch (commitError) {
            cleanup();
            if (global.Promise) {
              return global.Promise.reject(commitError);
            }
            throw commitError;
          }
        }
      }
    }

    try {
      return animateAfterCommit(commitOnce());
    } catch (error) {
      cleanup();
      if (global.Promise) {
        return global.Promise.reject(error);
      }
      throw error;
    }
  }

  function decorateRouteTransition(fromRoute, toRoute, snapshot, fromRun) {
    if (fromRoute === toRoute) {
      return;
    }
    dispatchHook("lusu:ui-motion-route", {
      from: fromRoute,
      to: toRoute,
      mode: state.mode
    });
  }

  function handleRouteProjection(fromRoute, toRoute) {
    var next = routeName(toRoute) || "home";
    var previous = routeName(fromRoute) || "home";
    state.lastRoute = next;
    if (now() < state.suppressRouteUntil) {
      return;
    }
    decorateRouteTransition(previous, next, triggerSnapshot(), false);
  }

  function handleThemeProjection(fromTheme, toTheme, fromRun) {
    var next = String(toTheme || "");
    var previous = String(fromTheme || "");
    state.lastTheme = next;
    if (!next || previous === next || (!fromRun && now() < state.suppressThemeUntil)) {
      return;
    }
    if (canUseFullMotion()) {
      transientClass(root, "is-ui-theme-changing", DURATIONS.scene);
      if (document.body) {
        transientClass(document.body, "is-ui-theme-changing", DURATIONS.scene);
      }
    }
    dispatchHook("lusu:ui-motion-theme", {
      from: previous,
      to: next,
      mode: state.mode
    });
  }

  function syncModalLayer() {
    var openModal = safeQuery(".modal:not([hidden])");
    if (openModal) {
      setData(root, "uiModal", "open");
    } else {
      removeData(root, "uiModal");
    }
  }

  function handleModalProjection(element) {
    if (!isElement(element)) {
      return;
    }
    var hidden = element.hasAttribute("hidden");
    syncModalLayer();
    if (hidden || !canUseFullMotion()) {
      return;
    }
    transientClass(element, "is-ui-entering", DURATIONS.window);
    dispatchHook("lusu:ui-motion-modal", {
      open: true,
      mode: state.mode
    });
  }

  function setupObserver() {
    if (typeof global.MutationObserver !== "function" || !document.body) {
      return;
    }
    state.observer = new global.MutationObserver(function observePresentation(mutations) {
      mutations.forEach(function handleMutation(mutation) {
        var target = mutation.target;
        if (target === document.body && mutation.attributeName === "data-route") {
          var nextRoute = currentRoute();
          var previousRoute = state.lastRoute || "home";
          if (nextRoute !== previousRoute) {
            handleRouteProjection(previousRoute, nextRoute);
          }
          return;
        }
        if (target === document.body && mutation.attributeName === "data-time-theme") {
          var nextTheme = currentTheme();
          var previousTheme = state.lastTheme;
          if (nextTheme !== previousTheme) {
            handleThemeProjection(previousTheme, nextTheme, false);
          }
          return;
        }
        if (mutation.attributeName === "hidden" && elementMatches(target, ".modal, .account-popover")) {
          handleModalProjection(target);
        }
      });
    });
    state.observer.observe(document.body, {
      attributes: true,
      subtree: true,
      attributeFilter: ["data-route", "data-time-theme", "hidden"]
    });
  }

  function handleVisibilityChange() {
    syncMotionMode();
    if (document.hidden) {
      resetParallax(true);
      return;
    }
    resetParallax(false);
  }

  function handleCapabilityChange() {
    syncMotionMode();
    if (!canUseParallax()) {
      resetParallax(true);
    }
  }

  function handleResize() {
    if (!canUseParallax()) {
      resetParallax(true);
    } else {
      state.targetX = clamp(state.targetX, -state.parallaxLimit, state.parallaxLimit);
      state.targetY = clamp(state.targetY, -state.parallaxLimit, state.parallaxLimit);
    }
  }

  function init(options) {
    if (state.initialized && !state.destroyed) {
      return api;
    }
    state.destroyed = false;
    state.initialized = true;
    var config = options && typeof options === "object" ? options : {};
    var requestedLimit = Number(config.parallaxMax);
    state.parallaxLimit = isFinite(requestedLimit)
      ? clamp(requestedLimit, 0, MAX_PARALLAX_PX)
      : MAX_PARALLAX_PX;
    state.forcedMode = config.motion === "off" || config.motion === "reduced"
      ? config.motion
      : "";

    state.reducedMedia = createMediaQuery("(prefers-reduced-motion: reduce)");
    state.finePointerMedia = createMediaQuery("(hover: hover) and (pointer: fine)");
    state.lastRoute = currentRoute();
    state.lastTheme = currentTheme();
    syncMotionMode();
    writeParallax();

    addListener(document, "pointerdown", handlePointerDown, { passive: true, capture: true });
    addListener(global, "pointerup", releasePressedTarget, { passive: true });
    addListener(global, "pointercancel", releasePressedTarget, { passive: true });
    addListener(document, "click", handleClick, true);
    addListener(document, "keydown", handleKeyDown, true);
    addListener(global, "blur", function resetOnBlur() {
      releasePressedTarget();
      resetParallax(false);
    });
    addListener(global, "resize", handleResize, { passive: true });
    addListener(document, "visibilitychange", handleVisibilityChange);
    addMediaListener(state.reducedMedia, handleCapabilityChange);
    addMediaListener(state.finePointerMedia, handleCapabilityChange);
    setupObserver();
    syncModalLayer();
    dispatchHook("lusu:ui-motion-ready", { mode: state.mode, version: VERSION });
    return api;
  }

  function destroy() {
    if (!state.initialized) {
      return;
    }
    state.destroyed = true;
    state.initialized = false;
    if (state.rafId) {
      cancelFrame(state.rafId);
      state.rafId = 0;
    }
    if (state.triggerTimer) {
      global.clearTimeout(state.triggerTimer);
      state.triggerTimer = 0;
    }
    if (state.observer) {
      state.observer.disconnect();
      state.observer = null;
    }
    releasePressedTarget();
    removeListeners();
    removeMediaListeners();
    stopAnimations();
    if (state.activeViewTransition && typeof state.activeViewTransition.skipTransition === "function") {
      try {
        state.activeViewTransition.skipTransition();
      } catch (error) {
        // Teardown is best-effort.
      }
    }
    state.activeViewTransition = null;
    clearTimers();
    state.lastTrigger = null;
    state.targetX = 0;
    state.targetY = 0;
    state.currentX = 0;
    state.currentY = 0;
    root.style.removeProperty("--ui-parallax-x");
    root.style.removeProperty("--ui-parallax-y");
    removeData(root, "uiTransition");
    removeData(root, "uiDirection");
    removeData(root, "uiModal");
    removeData(root, "inputMethod");
    removeData(root, "motion");
    if (document.body) {
      removeData(document.body, "motion");
    }
    safeQueryAll(".is-ui-entering, .is-ui-leaving, .is-ui-pressed").forEach(function clearStateClass(element) {
      ["is-ui-entering", "is-ui-leaving", "is-ui-pressed"].forEach(function removeStateClass(className) {
        element.classList.remove(className);
      });
    });
  }

  function getMode() {
    return state.mode;
  }

  function refresh() {
    if (!state.initialized) {
      return init();
    }
    state.lastRoute = currentRoute();
    state.lastTheme = currentTheme();
    syncMotionMode();
    syncModalLayer();
    handleResize();
    return api;
  }

  var api = {
    version: VERSION,
    init: init,
    destroy: destroy,
    refresh: refresh,
    run: run,
    noteTrigger: noteTrigger,
    getMode: getMode,
    setMode: setMode,
    maxParallax: MAX_PARALLAX_PX,
    durations: {
      instant: DURATIONS.instant,
      fast: DURATIONS.fast,
      standard: DURATIONS.standard,
      window: DURATIONS.window,
      scene: DURATIONS.scene
    }
  };

  global.LusuUiMotion = api;

  if (document.readyState === "loading") {
    addListener(document, "DOMContentLoaded", function initializeOnReady() {
      init();
    }, { once: true });
  } else {
    init();
  }
})(typeof window !== "undefined" ? window : null);
