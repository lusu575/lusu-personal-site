(function initMobileShellAdapter() {
  "use strict";

  const MOBILE_QUERY = "(max-width: 760px), (max-height: 520px) and (pointer: coarse)";
  const mobileMedia = typeof window.matchMedia === "function"
    ? window.matchMedia(MOBILE_QUERY)
    : null;
  const root = document.documentElement;
  const FRAME_PIPELINE_VERSION = 2;
  const FOCUS_REVEAL_KEY = "mobile-shell:focus-reveal";
  const FOCUS_RECHECK_KEY = "mobile-shell:focusout-recheck";
  const FOCUS_RECHECK_DELAY_MS = 400;
  const VIEWPORT_RESTORE_TOLERANCE = 8;
  const HORIZONTAL_DISCOVERY_SELECTOR = [
    "#knowledge-categories",
    "#videos .filter-row",
    "#article-detail-toc-list",
    ".game-main .meta-row"
  ].join(",");

  function isTextEntryElement(element) {
    if (!(element instanceof HTMLElement)) {
      return false;
    }
    if (element instanceof HTMLTextAreaElement || element.isContentEditable) {
      return true;
    }
    return element instanceof HTMLInputElement
      && ["text", "search", "email", "password", "url", "tel"].includes(
        String(element.type || "text").toLowerCase()
      );
  }

  function createFramePipeline() {
    let queuedJobs = new Map();
    let frameId = 0;
    let phase = "idle";
    const keyVersions = new Map();
    const viewportSubscribers = new Map();
    const viewportReasons = new Set();
    const stableExpandedHeights = new Map();
    let keyboardBlurDeadline = 0;
    const runsByKey = Object.create(null);
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const saveData = connection?.saveData === true;
    const hardwareConcurrencyValue = Number(navigator.hardwareConcurrency);
    const hardwareConcurrency = Number.isFinite(hardwareConcurrencyValue) && hardwareConcurrencyValue > 0
      ? Math.round(hardwareConcurrencyValue)
      : 0;
    const deviceMemory = Number(navigator.deviceMemory) || 0;
    const tier = saveData || (hardwareConcurrency > 0 && hardwareConcurrency <= 2) || (deviceMemory > 0 && deviceMemory <= 2)
      ? "low"
      : "normal";
    const counters = {
      frames: 0,
      readPasses: 0,
      writePasses: 0,
      coalescedRequests: 0
    };
    let latestViewport = null;

    function normalizedJob(contract = {}) {
      return {
        measure: typeof contract.measure === "function"
          ? contract.measure
          : typeof contract.read === "function"
            ? contract.read
            : null,
        mutate: typeof contract.mutate === "function"
          ? contract.mutate
          : typeof contract.write === "function"
            ? contract.write
            : null
      };
    }

    function ensureFrame() {
      if (!frameId && queuedJobs.size) {
        frameId = window.requestAnimationFrame(flushFrame);
      }
    }

    function schedule(key, contract, reason = "manual") {
      const normalizedKey = String(key || "anonymous");
      const job = normalizedJob(contract);
      if (!job.measure && !job.mutate) {
        return () => dispose(normalizedKey);
      }
      if (queuedJobs.has(normalizedKey)) {
        counters.coalescedRequests += 1;
      }
      queuedJobs.set(normalizedKey, {
        ...job,
        key: normalizedKey,
        reason,
        version: keyVersions.get(normalizedKey) || 0
      });
      ensureFrame();
      return () => dispose(normalizedKey);
    }

    function request(key, contract, reason) {
      return schedule(key, contract, reason);
    }

    function flushFrame() {
      frameId = 0;
      if (!queuedJobs.size) {
        return;
      }
      const jobs = [...queuedJobs.values()];
      queuedJobs = new Map();
      const measured = new Map();
      counters.frames += 1;
      counters.readPasses += 1;
      phase = "measure";
      jobs.forEach((job) => {
        if (job.version !== (keyVersions.get(job.key) || 0)) {
          return;
        }
        measured.set(job.key, job.measure?.(job.reason));
      });
      counters.writePasses += 1;
      phase = "mutate";
      jobs.forEach((job) => {
        if (job.version !== (keyVersions.get(job.key) || 0)) {
          return;
        }
        job.mutate?.(measured.get(job.key), job.reason);
        runsByKey[job.key] = (runsByKey[job.key] || 0) + 1;
      });
      phase = "idle";
      ensureFrame();
    }

    function positiveRounded(value, fallback = 0) {
      const number = Number(value);
      if (Number.isFinite(number) && number > 0) {
        return Math.round(number);
      }
      return Math.max(0, Math.round(Number(fallback) || 0));
    }

    function readViewportOrientation(layoutWidth, layoutHeight) {
      const screenOrientation = String(window.screen?.orientation?.type || "").toLowerCase();
      if (screenOrientation.startsWith("portrait")) {
        return "portrait";
      }
      if (screenOrientation.startsWith("landscape")) {
        return "landscape";
      }
      const screenWidth = positiveRounded(window.screen?.width);
      const screenHeight = positiveRounded(window.screen?.height);
      if (screenWidth && screenHeight) {
        return screenHeight >= screenWidth ? "portrait" : "landscape";
      }
      return layoutHeight >= layoutWidth ? "portrait" : "landscape";
    }

    function textEntryHasFocus() {
      return isTextEntryElement(document.activeElement);
    }

    function readViewportSnapshot() {
      const viewport = window.visualViewport;
      const hasVisualViewport = Boolean(viewport);
      const layoutWidth = positiveRounded(
        document.documentElement?.clientWidth,
        window.innerWidth
      );
      const layoutHeight = positiveRounded(
        document.documentElement?.clientHeight,
        window.innerHeight
      );
      const visualWidth = positiveRounded(viewport?.width, layoutWidth);
      const visualHeight = positiveRounded(viewport?.height, layoutHeight);
      const offsetTop = hasVisualViewport ? Math.max(0, Math.round(Number(viewport.offsetTop) || 0)) : 0;
      const offsetLeft = hasVisualViewport ? Math.max(0, Math.round(Number(viewport.offsetLeft) || 0)) : 0;
      const pageScale = Number(viewport?.scale) || 1;
      const isPinchZoomed = Math.abs(pageScale - 1) > 0.02;
      const orientation = readViewportOrientation(layoutWidth, layoutHeight);
      const orientationChanged = Boolean(latestViewport && latestViewport.orientation !== orientation);
      const keyboardWasOpen = latestViewport?.keyboardOpen === true;
      const editingHasFocus = textEntryHasFocus();
      let stableExpandedHeight = Number(stableExpandedHeights.get(orientation)) || 0;

      if (!hasVisualViewport) {
        stableExpandedHeight = layoutHeight;
        stableExpandedHeights.set(orientation, stableExpandedHeight);
      } else if (!stableExpandedHeight && !isPinchZoomed && !keyboardWasOpen && !editingHasFocus) {
        stableExpandedHeight = visualHeight;
        stableExpandedHeights.set(orientation, stableExpandedHeight);
      }

      const keyboardThreshold = Math.max(96, Math.round(stableExpandedHeight * 0.18));
      const shortenedBy = Math.max(0, stableExpandedHeight - visualHeight);
      const heightRestored = !stableExpandedHeight
        ? !keyboardWasOpen
        : visualHeight >= stableExpandedHeight - VIEWPORT_RESTORE_TOLERANCE;
      const blurGraceActive = keyboardWasOpen
        && !editingHasFocus
        && performance.now() < keyboardBlurDeadline;
      const keyboardOpen = hasVisualViewport
        && !isPinchZoomed
        && ((keyboardWasOpen
          && (editingHasFocus || blurGraceActive)
          && (orientationChanged || !heightRestored))
          || (editingHasFocus && shortenedBy >= keyboardThreshold));

      let viewportMode = "stable";
      if (isPinchZoomed) {
        viewportMode = "zoom";
      } else if (keyboardOpen) {
        viewportMode = "keyboard";
      } else if (hasVisualViewport && (
        shortenedBy > VIEWPORT_RESTORE_TOLERANCE
        || Math.abs(offsetTop) > 1
        || Math.abs(offsetLeft) > 1
      )) {
        viewportMode = "browser-ui";
      }

      if (viewportMode === "stable" && hasVisualViewport) {
        stableExpandedHeight = Math.max(stableExpandedHeight, visualHeight);
        stableExpandedHeights.set(orientation, stableExpandedHeight);
      }

      const keyboardOffset = isPinchZoomed
        ? 0
        : keyboardOpen
          ? Math.max(0, stableExpandedHeight - visualHeight)
          : 0;
      return {
        width: isPinchZoomed ? layoutWidth : visualWidth,
        height: isPinchZoomed ? layoutHeight : visualHeight,
        visualWidth,
        visualHeight,
        layoutWidth,
        layoutHeight,
        offsetTop,
        offsetLeft,
        orientation,
        keyboardOpen,
        viewportMode,
        keyboardOffset,
        pageScale
      };
    }

    latestViewport = readViewportSnapshot();

    function requestViewport(reason = "manual") {
      viewportReasons.add(String(reason || "manual"));
      schedule("viewport:dispatch", {
        measure() {
          const viewport = readViewportSnapshot();
          const reasons = [...viewportReasons];
          viewportReasons.clear();
          const reasonLabel = reasons.join(",");
          const subscribers = [...viewportSubscribers.entries()];
          return {
            viewport,
            reason: reasonLabel,
            subscribers: subscribers.map(([key, subscription]) => ({
              key,
              subscription,
              result: subscription.measure
                ? subscription.measure(viewport, reasonLabel)
                : viewport
            }))
          };
        },
        mutate(result) {
          if (!result) {
            return;
          }
          latestViewport = result.viewport;
          result.subscribers.forEach(({ key, subscription, result: measuredResult }) => {
            if (viewportSubscribers.get(key) === subscription) {
              subscription.mutate?.(measuredResult, result.viewport, result.reason);
            }
          });
        }
      }, reason);
    }

    function subscribeViewport(key, contract = {}) {
      const normalizedKey = String(key || "anonymous-viewport-subscriber");
      const subscription = normalizedJob(contract);
      viewportSubscribers.set(normalizedKey, subscription);
      requestViewport(`subscribe:${normalizedKey}`);
      return () => {
        if (viewportSubscribers.get(normalizedKey) === subscription) {
          viewportSubscribers.delete(normalizedKey);
        }
      };
    }

    function noteEditingFocus(active = textEntryHasFocus(), allowBlurGrace = false) {
      keyboardBlurDeadline = active
        ? 0
        : allowBlurGrace
          ? performance.now() + FOCUS_RECHECK_DELAY_MS
          : 0;
      requestViewport(active ? "editing-focus" : allowBlurGrace ? "editing-blur-grace" : "editing-blur-settled");
    }

    function dispose(key) {
      const normalizedKey = String(key || "");
      keyVersions.set(normalizedKey, (keyVersions.get(normalizedKey) || 0) + 1);
      queuedJobs.delete(normalizedKey);
      viewportSubscribers.delete(normalizedKey);
    }

    function snapshot() {
      return {
        version: FRAME_PIPELINE_VERSION,
        tier,
        saveData,
        hardwareConcurrency,
        frames: counters.frames,
        readPasses: counters.readPasses,
        writePasses: counters.writePasses,
        coalescedRequests: counters.coalescedRequests,
        runsByKey: { ...runsByKey },
        pendingKeys: [...queuedJobs.keys()],
        phase,
        viewport: { ...latestViewport }
      };
    }

    function debugBurst(count = 40) {
      const total = Math.max(1, Math.min(200, Math.round(Number(count) || 40)));
      for (let index = 0; index < total; index += 1) {
        request("debug:keyed-burst", {
          read: () => index,
          write: () => undefined
        }, "debug-burst");
        requestViewport("debug-burst");
      }
      return snapshot();
    }

    const onWindowResize = () => requestViewport("window-resize");
    const onViewportResize = () => requestViewport("visual-viewport-resize");
    const onViewportScroll = () => requestViewport("visual-viewport-scroll");
    window.addEventListener("resize", onWindowResize, { passive: true });
    window.visualViewport?.addEventListener("resize", onViewportResize, { passive: true });
    window.visualViewport?.addEventListener("scroll", onViewportScroll, { passive: true });

    return Object.freeze({
      version: FRAME_PIPELINE_VERSION,
      request,
      schedule,
      subscribeViewport,
      requestViewport,
      noteEditingFocus,
      dispose,
      snapshot,
      debugSnapshot: snapshot,
      debugBurst
    });
  }

  const framePipeline = window.LusuFramePipeline || createFramePipeline();
  if (!window.LusuFramePipeline) {
    Object.defineProperty(window, "LusuFramePipeline", {
      value: framePipeline,
      configurable: false,
      enumerable: true,
      writable: false
    });
  }
  root.dataset.performanceTier = framePipeline.snapshot().tier;
  const state = {
    shell: "desktop",
    activeRoute: "",
    gestureStart: null,
    dockCollapsed: false,
    dockIndicatorReady: false,
    focusRevealTarget: null,
    focusRecheckTimer: 0,
    routeObserver: null,
    languageObserver: null,
    affordanceObserver: null
  };

  function currentShell() {
    return mobileMedia?.matches ? "mobile" : "desktop";
  }

  function applyShell() {
    const nextShell = currentShell();
    if (state.shell === nextShell && root.dataset.uiShell === nextShell) {
      return;
    }
    state.shell = nextShell;
    root.dataset.uiShell = nextShell;
    if (document.body) {
      if (nextShell === "mobile") {
        document.body.dataset.mobileDock = state.dockCollapsed ? "collapsed" : "expanded";
      } else {
        delete document.body.dataset.mobileDock;
        document.querySelector(".mobile-dock-scroll")?.classList.remove("is-dock-indicator-ready");
        state.dockIndicatorReady = false;
        clearFocusReveal();
        cancelFocusoutRecheck();
      }
    }
    syncDockAccessibility();
    if (nextShell === "mobile") {
      syncDockLayout(document.body?.dataset.route || "home", { immediate: true });
    }
    window.dispatchEvent(new CustomEvent("lusu:shellchange", {
      detail: { shell: nextShell }
    }));
  }

  function syncViewportMetrics() {
    framePipeline.requestViewport("mobile-shell-sync");
  }

  function translatedRouteTitle(route) {
    if (route === "home") {
      return document.querySelector(".brand-button [data-i18n='siteName']")?.textContent?.trim() || "LuSu OS";
    }
    return document.querySelector(`.desktop-icon[data-route="${route}"] .icon-title`)?.textContent?.trim()
      || document.querySelector(`.taskbar-tabs [data-route="${route}"] span:last-child`)?.textContent?.trim()
      || "LuSu OS";
  }

  function syncRoutePresentation() {
    const route = document.body?.dataset.route || "home";
    const title = translatedRouteTitle(route);
    const routeTitle = document.getElementById("mobile-route-title");
    if (routeTitle) {
      routeTitle.textContent = title;
    }
    document.querySelectorAll("[data-mobile-route-active]").forEach((node) => {
      node.toggleAttribute("data-mobile-route-active", node.dataset.route === route);
    });
    root.dataset.mobileRoute = route;
    syncDockLayout(route);
    syncHorizontalDiscovery("route");
  }

  function measureHorizontalDiscovery() {
    if (state.shell !== "mobile") {
      return [];
    }
    return [...document.querySelectorAll(HORIZONTAL_DISCOVERY_SELECTOR)].map((node) => {
      const maximum = Math.max(0, node.scrollWidth - node.clientWidth);
      return {
        node,
        overflow: maximum > 2,
        before: maximum > 2 && node.scrollLeft > 2,
        after: maximum > 2 && node.scrollLeft < maximum - 2
      };
    });
  }

  function mutateHorizontalDiscovery(measurements) {
    (measurements || []).forEach(({ node, overflow, before, after }) => {
      if (!node.isConnected) return;
      const ownsInteractiveChildren = Boolean(node.querySelector(
        "button, a[href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
      ));
      node.classList.toggle("has-horizontal-overflow", overflow);
      node.classList.toggle("has-overflow-before", before);
      node.classList.toggle("has-overflow-after", after);
      if (overflow && !ownsInteractiveChildren && !node.hasAttribute("tabindex")) {
        node.tabIndex = 0;
        node.dataset.mobileScrollTabstop = "true";
      } else if ((!overflow || ownsInteractiveChildren) && node.dataset.mobileScrollTabstop === "true") {
        node.removeAttribute("tabindex");
        delete node.dataset.mobileScrollTabstop;
      }
    });
  }

  function syncHorizontalDiscovery(reason = "content") {
    framePipeline.schedule("mobile-shell:horizontal-discovery", {
      measure: measureHorizontalDiscovery,
      mutate: mutateHorizontalDiscovery
    }, reason);
  }

  function handleHorizontalDiscoveryScroll(event) {
    if (event.target instanceof Element && event.target.matches(HORIZONTAL_DISCOVERY_SELECTOR)) {
      syncHorizontalDiscovery("scroll");
    }
  }

  function motionIsReduced() {
    return root.dataset.motion === "reduced"
      || root.dataset.motion === "off"
      || window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  }

  function dockRouteElements(route) {
    const scroller = document.querySelector(".mobile-dock-scroll");
    return {
      scroller,
      active: scroller?.querySelector(`[data-route="${route}"]:not([data-mobile-dock-excluded])`) || null,
      indicator: scroller?.querySelector(".mobile-dock-selection") || null
    };
  }

  function measureDockLayout(route, immediate = false) {
    if (state.shell !== "mobile") {
      return { route, shell: state.shell };
    }
    const { scroller, active, indicator } = dockRouteElements(route);
    if (!scroller || !indicator) {
      return { route, shell: state.shell };
    }
    let reveal = false;
    if (active && !state.dockCollapsed) {
      const scrollerRect = scroller.getBoundingClientRect();
      const activeRect = active.getBoundingClientRect();
      const edgeInset = 8;
      reveal = activeRect.left < scrollerRect.left + edgeInset
        || activeRect.right > scrollerRect.right - edgeInset;
    }
    return {
      route,
      shell: state.shell,
      scroller,
      active,
      indicator,
      immediate,
      reveal,
      selectionX: active?.offsetLeft || 0,
      selectionWidth: active?.offsetWidth || 0,
      reducedMotion: motionIsReduced()
    };
  }

  function mutateDockLayout(measurement) {
    if (!measurement?.scroller || !measurement.indicator || state.shell !== "mobile") {
      return;
    }
    const { scroller, active } = measurement;
    if (!scroller.isConnected || (active && !active.isConnected)) {
      return;
    }
    scroller.classList.toggle("has-no-dock-route", !active);
    if (!active) {
      return;
    }
    if (measurement.immediate || !state.dockIndicatorReady) {
      scroller.classList.remove("is-dock-indicator-ready");
    }
    scroller.style.setProperty("--mobile-dock-selection-x", `${measurement.selectionX}px`);
    scroller.style.setProperty("--mobile-dock-selection-width", `${measurement.selectionWidth}px`);
    if (!state.dockIndicatorReady || measurement.immediate) {
      state.dockIndicatorReady = true;
      scroller.classList.add("is-dock-indicator-ready");
    }
    if (measurement.reveal) {
      active.scrollIntoView({
        block: "nearest",
        inline: "nearest",
        behavior: measurement.reducedMotion ? "auto" : "smooth"
      });
    }
  }

  function syncDockLayout(route, options = {}) {
    framePipeline.schedule("mobile-shell:dock-layout", {
      measure: () => measureDockLayout(route, options.immediate === true),
      mutate: mutateDockLayout
    }, options.immediate === true ? "immediate" : "route");
  }

  function focusRevealBoundary(target) {
    if (!(target instanceof Element) || state.shell !== "mobile") {
      return null;
    }
    const accountPopover = target.closest("#account-popover");
    if (accountPopover && !accountPopover.hidden && !accountPopover.closest("[hidden]")) {
      return accountPopover;
    }
    const route = document.body?.dataset.route || state.activeRoute || "home";
    if (route === "home") {
      return null;
    }
    const page = document.getElementById(route);
    if (!page?.classList.contains("active") || !page.contains(target)) {
      return null;
    }
    const appWindow = target.closest(".xp-window");
    return appWindow && page.contains(appWindow) ? appWindow : null;
  }

  function nearestVerticalScrollOwner(target, boundary) {
    let node = target.parentElement;
    while (node && boundary.contains(node)) {
      const overflowY = window.getComputedStyle(node).overflowY;
      const allowsVerticalScroll = overflowY === "auto"
        || overflowY === "scroll"
        || overflowY === "overlay";
      if (allowsVerticalScroll && node.clientHeight > 0 && node.scrollHeight > node.clientHeight + 1) {
        return node;
      }
      if (node === boundary) {
        break;
      }
      node = node.parentElement;
    }
    return null;
  }

  function contextElementsForFocus(target, boundary) {
    const elements = [target];
    let selectors = [];
    if (target.closest("#chat-form")) {
      selectors = [
        "#chat-message-input",
        "#chat-form .chat-send-button",
        "#chat-feedback"
      ];
    } else if (target.closest("#chat-private-room-form")) {
      selectors = [
        "#chat-private-password",
        "#chat-private-room-form button[type='submit']",
        "#chat-private-room-form small",
        "#chat-feedback"
      ];
    } else if (target.closest("#knowledge-searchbar")) {
      selectors = [
        "#knowledge-search-input",
        "#knowledge-searchbar [data-article-search-clear]",
        "#knowledge-search-status"
      ];
    } else if (target.closest("#account-popover")) {
      if (target.matches("input, textarea, [contenteditable]:not([contenteditable='false'])")) {
        elements.push(target);
      }
      selectors = [".account-actions", ".account-note"];
    } else if (target.closest("#transfer-room-form")) {
      selectors = ["#transfer-room-password", ".transfer-enter-button"];
    } else if (target.closest("#transfer-text-form")) {
      selectors = ["#transfer-text-input", "#transfer-send-button"];
    }
    selectors.forEach((selector) => {
      boundary.querySelectorAll(selector).forEach((element) => elements.push(element));
    });
    return [...new Set(elements)].filter((element) => boundary.contains(element));
  }

  function mergedFocusContextRect(target, owner, boundary) {
    let top = Number.POSITIVE_INFINITY;
    let bottom = Number.NEGATIVE_INFINITY;
    let left = Number.POSITIVE_INFINITY;
    let right = Number.NEGATIVE_INFINITY;
    let count = 0;
    contextElementsForFocus(target, boundary).forEach((element) => {
      if (!element.isConnected || element.closest("[hidden]")) {
        return;
      }
      const style = window.getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden") {
        return;
      }
      if (nearestVerticalScrollOwner(element, boundary) !== owner) {
        return;
      }
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        return;
      }
      top = Math.min(top, rect.top);
      bottom = Math.max(bottom, rect.bottom);
      left = Math.min(left, rect.left);
      right = Math.max(right, rect.right);
      count += 1;
    });
    return count ? { top, bottom, left, right, width: right - left, height: bottom - top } : null;
  }

  function measureFocusReveal() {
    const target = state.focusRevealTarget;
    if (!(target instanceof Element) || !target.isConnected || document.activeElement !== target) {
      return null;
    }
    const boundary = focusRevealBoundary(target);
    if (!boundary) {
      return null;
    }
    const owner = nearestVerticalScrollOwner(target, boundary);
    if (!owner) {
      return null;
    }
    const targetRect = target.getBoundingClientRect();
    const contextRect = mergedFocusContextRect(target, owner, boundary) || targetRect;
    const ownerRect = owner.getBoundingClientRect();
    const viewport = framePipeline.snapshot().viewport;
    const visualTop = Number(viewport.offsetTop) || 0;
    const visualHeight = Number(viewport.visualHeight) || Number(viewport.height) || window.innerHeight;
    const visualBottom = visualTop + visualHeight;
    const visibleTop = Math.max(visualTop, ownerRect.top);
    const visibleBottom = Math.min(visualBottom, ownerRect.bottom);
    const inset = 8;
    const contentTop = visibleTop + inset;
    const contentBottom = visibleBottom - inset;
    const availableHeight = Math.max(0, contentBottom - contentTop);
    const scrollTop = owner.scrollTop;
    const maxScrollTop = Math.max(0, owner.scrollHeight - owner.clientHeight);
    let delta = 0;
    if (contextRect.height <= availableHeight) {
      if (contextRect.top < contentTop) {
        delta = contextRect.top - contentTop;
      } else if (contextRect.bottom > contentBottom) {
        delta = contextRect.bottom - contentBottom;
      }
    } else if (targetRect.top < contentTop) {
      delta = targetRect.top - contentTop;
    } else if (targetRect.bottom > contentBottom) {
      delta = targetRect.bottom - contentBottom;
    } else if (contextRect.bottom > contentBottom) {
      delta = contextRect.bottom - contentBottom;
    } else if (contextRect.top < contentTop) {
      delta = contextRect.top - contentTop;
    }
    if (targetRect.height <= availableHeight) {
      const minimumTargetDelta = targetRect.bottom - contentBottom;
      const maximumTargetDelta = targetRect.top - contentTop;
      delta = Math.max(minimumTargetDelta, Math.min(maximumTargetDelta, delta));
    }
    return {
      target,
      owner,
      scrollTop,
      nextScrollTop: Math.max(0, Math.min(maxScrollTop, scrollTop + delta))
    };
  }

  function mutateFocusReveal(measurement) {
    if (!measurement?.owner?.isConnected
      || measurement.target !== state.focusRevealTarget
      || document.activeElement !== measurement.target) {
      return;
    }
    if (Math.abs(measurement.scrollTop - measurement.nextScrollTop) > 0.5) {
      measurement.owner.scrollTop = measurement.nextScrollTop;
    }
  }

  function scheduleFocusReveal(reason = "focus") {
    if (!state.focusRevealTarget) {
      return;
    }
    framePipeline.schedule(FOCUS_REVEAL_KEY, {
      measure: measureFocusReveal,
      mutate: mutateFocusReveal
    }, reason);
  }

  function normalizedFocusReason(reason) {
    const normalized = String(reason || "manual")
      .replace(/[^a-z0-9:_-]/gi, "-")
      .slice(0, 64);
    return normalized || "manual";
  }

  function setFocusRevealTarget(target, reason) {
    if (!focusRevealBoundary(target)) {
      clearFocusReveal();
      return false;
    }
    state.focusRevealTarget = target;
    scheduleFocusReveal(reason);
    return true;
  }

  function requestFocusReveal(reason = "manual") {
    if (state.shell !== "mobile") {
      return false;
    }
    const reasonLabel = normalizedFocusReason(reason);
    framePipeline.requestViewport(`focus-reveal:${reasonLabel}`);
    return setFocusRevealTarget(document.activeElement, reasonLabel);
  }

  function clearFocusReveal(target = null) {
    if (target && state.focusRevealTarget !== target) {
      return;
    }
    state.focusRevealTarget = null;
    framePipeline.dispose(FOCUS_REVEAL_KEY);
  }

  function cancelFocusoutRecheck() {
    if (state.focusRecheckTimer) {
      window.clearTimeout(state.focusRecheckTimer);
      state.focusRecheckTimer = 0;
    }
    framePipeline.dispose(FOCUS_RECHECK_KEY);
  }

  function scheduleFocusoutRecheck() {
    cancelFocusoutRecheck();
    state.focusRecheckTimer = window.setTimeout(() => {
      state.focusRecheckTimer = 0;
      framePipeline.schedule(FOCUS_RECHECK_KEY, {
        measure() {
          return { target: document.activeElement };
        },
        mutate(result) {
          framePipeline.noteEditingFocus(undefined, false);
          if (result?.target instanceof Element) {
            setFocusRevealTarget(result.target, "focusout-recheck");
          }
        }
      }, "focusout-recheck");
    }, FOCUS_RECHECK_DELAY_MS);
  }

  function handleFocusIn(event) {
    if (state.shell !== "mobile") {
      return;
    }
    const target = event.target;
    cancelFocusoutRecheck();
    if (isTextEntryElement(target)) {
      framePipeline.noteEditingFocus(true);
    } else {
      framePipeline.requestViewport("focusin");
    }
    setFocusRevealTarget(target, "focusin");
  }

  function handleFocusOut(event) {
    if (state.shell !== "mobile") {
      return;
    }
    clearFocusReveal(event.target);
    if (isTextEntryElement(event.target)) {
      framePipeline.noteEditingFocus(false, true);
    } else {
      framePipeline.requestViewport("focusout");
    }
    scheduleFocusoutRecheck();
  }

  framePipeline.subscribeViewport("mobile-shell:viewport-metrics", {
    measure(viewport) {
      return {
        viewport,
        dock: measureDockLayout(document.body?.dataset.route || "home", true)
      };
    },
    mutate(result) {
      if (!result?.viewport) {
        return;
      }
      const keyboardState = result.viewport.keyboardOpen ? "open" : "closed";
      const viewportStateChanged = root.dataset.mobileKeyboard !== keyboardState
        || root.dataset.mobileOrientation !== result.viewport.orientation
        || root.dataset.mobileViewportMode !== result.viewport.viewportMode;
      root.style.setProperty("--mobile-viewport-height", `${result.viewport.height}px`);
      root.style.setProperty("--mobile-viewport-width", `${result.viewport.width}px`);
      root.style.setProperty("--mobile-viewport-offset-top", `${result.viewport.offsetTop}px`);
      root.style.setProperty("--mobile-viewport-offset-left", `${result.viewport.offsetLeft}px`);
      root.style.setProperty("--mobile-keyboard-offset", `${result.viewport.keyboardOffset}px`);
      root.style.setProperty("--mobile-viewport-keyboard-offset", `${result.viewport.keyboardOffset}px`);
      root.dataset.mobileKeyboard = keyboardState;
      root.dataset.mobileOrientation = result.viewport.orientation;
      root.dataset.mobileViewportMode = result.viewport.viewportMode;
      mutateDockLayout(result.dock);
      if (viewportStateChanged) {
        syncDockLayout(document.body?.dataset.route || "home", { immediate: true });
      }
      scheduleFocusReveal("viewport");
    }
  });

  function syncDockState() {
    if (!document.body) {
      return;
    }
    document.body.dataset.mobileDock = state.dockCollapsed ? "collapsed" : "expanded";
    const toggle = document.querySelector("[data-mobile-dock-toggle]");
    toggle?.setAttribute("aria-expanded", String(!state.dockCollapsed));
    syncDockAccessibility();
    if (!state.dockCollapsed) {
      syncDockLayout(document.body.dataset.route || "home", { immediate: true });
    }
  }

  function syncDockAccessibility() {
    const scroller = document.querySelector(".mobile-dock-scroll");
    if (!scroller) {
      return;
    }
    const collapsed = state.shell === "mobile" && state.dockCollapsed;
    const toggle = document.querySelector("[data-mobile-dock-toggle]");
    if (collapsed && scroller.contains(document.activeElement)) {
      toggle?.focus({ preventScroll: true });
    }
    scroller.inert = collapsed;
    scroller.setAttribute("aria-hidden", String(collapsed));
  }

  function leaveRoute(route) {
    if (state.activeRoute && route && state.activeRoute !== route) return;
    clearFocusReveal();
    cancelFocusoutRecheck();
    state.activeRoute = "";
    state.gestureStart = null;
    framePipeline.dispose("mobile-shell:dock-layout");
  }

  function enterRoute(route) {
    const nextRoute = String(route || document.body?.dataset.route || "home");
    if (state.activeRoute === nextRoute) return;
    clearFocusReveal();
    cancelFocusoutRecheck();
    state.activeRoute = nextRoute;
    syncRoutePresentation();
  }

  function lifecycleSnapshot() {
    const pipelineSnapshot = framePipeline.snapshot();
    return {
      shell: state.shell,
      activeRoute: state.activeRoute,
      focusRevealActive: Boolean(state.focusRevealTarget),
      keyboardOpen: pipelineSnapshot.viewport.keyboardOpen === true,
      orientation: pipelineSnapshot.viewport.orientation,
      viewportMode: pipelineSnapshot.viewport.viewportMode,
      routeObservers: state.routeObserver ? 1 : 0,
      languageObservers: state.languageObserver ? 1 : 0,
      frames: pipelineSnapshot.pendingKeys.filter((key) => key.startsWith("mobile-shell:")).length
    };
  }

  function toggleDock() {
    if (state.shell !== "mobile") {
      return;
    }
    state.dockCollapsed = !state.dockCollapsed;
    syncDockState();
  }

  function syncLanguageCycle() {
    const active = document.querySelector(".lang-button[aria-pressed='true']");
    const detectedLanguage = active?.dataset.lang || document.documentElement.lang?.slice(0, 2) || "zh";
    const lang = ["zh", "en", "ja"].includes(detectedLanguage) ? detectedLanguage : "zh";
    const copy = {
      zh: {
        visible: "中文",
        accessible: "当前语言：中文。切换到 English。"
      },
      en: {
        visible: "English",
        accessible: "Current language: English. Switch to 日本語."
      },
      ja: {
        visible: "日本語",
        accessible: "現在の言語：日本語。中文に切り替えます。"
      }
    }[lang];
    const button = document.querySelector(".mobile-language-cycle");
    const label = document.querySelector("[data-mobile-language-label]");
    if (label) {
      label.textContent = copy.visible;
    }
    if (button) {
      button.dataset.currentLanguage = lang;
      button.setAttribute("aria-label", copy.accessible);
      button.setAttribute("title", copy.accessible);
    }
  }

  function cycleLanguage() {
    const buttons = [...document.querySelectorAll(".lang-button[data-lang]")];
    if (!buttons.length) {
      return;
    }
    const currentIndex = buttons.findIndex((button) => button.getAttribute("aria-pressed") === "true");
    const nextLang = buttons[(currentIndex + 1 + buttons.length) % buttons.length]?.dataset.lang;
    if (nextLang) {
      window.dispatchEvent(new CustomEvent("lusu:language-request", { detail: { lang: nextLang } }));
    }
  }

  function noteLaunchTrigger(target, event) {
    const routeButton = target?.closest?.("[data-route]:not(body)");
    if (!routeButton || state.shell !== "mobile") {
      return;
    }
    window.LusuUiMotion?.noteTrigger?.(routeButton, {
      kind: routeButton.matches(".desktop-icon") ? "app-open" : "mobile-tab",
      route: routeButton.dataset.route || "home",
      clientX: Number.isFinite(event.clientX) ? event.clientX : undefined,
      clientY: Number.isFinite(event.clientY) ? event.clientY : undefined
    });
  }

  function startHomeGesture(event) {
    if (state.shell !== "mobile" || event.pointerType === "mouse" || !event.isPrimary) {
      return;
    }
    const viewport = framePipeline.snapshot().viewport;
    const visibleBottom = (Number(viewport.offsetTop) || 0)
      + (Number(viewport.visualHeight) || Number(viewport.height) || window.innerHeight);
    if (event.clientY < visibleBottom - 44) {
      return;
    }
    state.gestureStart = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      time: performance.now()
    };
  }

  function finishHomeGesture(event) {
    const start = state.gestureStart;
    state.gestureStart = null;
    if (!start || start.id !== event.pointerId || state.shell !== "mobile") {
      return;
    }
    const deltaY = start.y - event.clientY;
    const deltaX = Math.abs(start.x - event.clientX);
    const elapsed = performance.now() - start.time;
    if (deltaY < 54 || deltaX > 72 || elapsed > 700 || document.body?.dataset.route === "home") {
      return;
    }
    document.querySelector(".start-button[data-route='home']")?.click();
  }

  function bindDom() {
    syncRoutePresentation();
    syncLanguageCycle();
    state.routeObserver = new MutationObserver(syncRoutePresentation);
    state.routeObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-route"]
    });

    const languageRoot = document.querySelector(".language-switcher");
    if (languageRoot) {
      state.languageObserver = new MutationObserver(() => {
        syncRoutePresentation();
        syncLanguageCycle();
      });
      state.languageObserver.observe(languageRoot, {
        attributes: true,
        subtree: true,
        attributeFilter: ["class", "aria-pressed"]
      });
    }

    const main = document.getElementById("main-content");
    if (main) {
      state.affordanceObserver = new MutationObserver(() => syncHorizontalDiscovery("content"));
      state.affordanceObserver.observe(main, {
        childList: true,
        subtree: true,
        characterData: true
      });
    }

    document.addEventListener("pointerdown", (event) => {
      noteLaunchTrigger(event.target, event);
      startHomeGesture(event);
    }, { capture: true, passive: true });
    document.addEventListener("pointerup", finishHomeGesture, { passive: true });
    document.addEventListener("pointercancel", () => {
      state.gestureStart = null;
    }, { passive: true });
    document.addEventListener("focusin", handleFocusIn, { capture: true });
    document.addEventListener("focusout", handleFocusOut, { capture: true });
    document.addEventListener("scroll", handleHorizontalDiscoveryScroll, { capture: true, passive: true });
    document.querySelector(".mobile-language-cycle")?.addEventListener("click", cycleLanguage);
    document.querySelector("[data-mobile-dock-toggle]")?.addEventListener("click", toggleDock);
    syncDockState();
    syncHorizontalDiscovery("init");
  }

  applyShell();
  syncViewportMetrics();

  if (typeof mobileMedia?.addEventListener === "function") {
    mobileMedia.addEventListener("change", applyShell);
  } else if (typeof mobileMedia?.addListener === "function") {
    mobileMedia.addListener(applyShell);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindDom, { once: true });
  } else {
    bindDom();
  }

  window.LusuMobileShell = Object.freeze({
    get shell() {
      return state.shell;
    },
    sync: () => {
      applyShell();
      syncViewportMetrics();
      syncRoutePresentation();
      syncLanguageCycle();
      syncHorizontalDiscovery("manual");
    },
    enterRoute,
    leaveRoute,
    lifecycleSnapshot,
    requestFocusReveal
  });
})();
