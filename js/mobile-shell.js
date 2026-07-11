(function initMobileShellAdapter() {
  "use strict";

  const MOBILE_QUERY = "(max-width: 760px), (max-height: 520px) and (pointer: coarse)";
  const mobileMedia = typeof window.matchMedia === "function"
    ? window.matchMedia(MOBILE_QUERY)
    : null;
  const root = document.documentElement;
  const state = {
    shell: "desktop",
    gestureStart: null,
    dockCollapsed: false,
    dockIndicatorReady: false,
    dockLayoutFrame: 0,
    viewportFrame: 0,
    routeObserver: null,
    languageObserver: null
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
      }
    }
    if (nextShell === "mobile") {
      syncDockLayout(document.body?.dataset.route || "home", { immediate: true });
    }
    window.dispatchEvent(new CustomEvent("lusu:shellchange", {
      detail: { shell: nextShell }
    }));
  }

  function syncViewportMetrics() {
    if (state.viewportFrame) {
      return;
    }
    state.viewportFrame = window.requestAnimationFrame(() => {
      state.viewportFrame = 0;
      const viewport = window.visualViewport;
      const height = viewport?.height || window.innerHeight;
      const width = viewport?.width || window.innerWidth;
      root.style.setProperty("--mobile-viewport-height", `${Math.round(height)}px`);
      root.style.setProperty("--mobile-viewport-width", `${Math.round(width)}px`);
      root.style.setProperty("--mobile-keyboard-offset", `${Math.max(0, Math.round(window.innerHeight - height - (viewport?.offsetTop || 0)))}px`);
      syncDockLayout(document.body?.dataset.route || "home", { immediate: true });
    });
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

  function syncDockIndicator(route, immediate = false) {
    if (state.shell !== "mobile") {
      return;
    }
    const { scroller, active, indicator } = dockRouteElements(route);
    if (!scroller || !indicator) {
      return;
    }
    scroller.classList.toggle("has-no-dock-route", !active);
    if (!active) {
      return;
    }
    if (immediate || !state.dockIndicatorReady) {
      scroller.classList.remove("is-dock-indicator-ready");
    }
    scroller.style.setProperty("--mobile-dock-selection-x", `${active.offsetLeft}px`);
    scroller.style.setProperty("--mobile-dock-selection-width", `${active.offsetWidth}px`);
    if (!state.dockIndicatorReady || immediate) {
      state.dockIndicatorReady = true;
      window.requestAnimationFrame(() => {
        if (state.shell === "mobile" && scroller.isConnected) {
          scroller.classList.add("is-dock-indicator-ready");
        }
      });
    }
  }

  function revealActiveDockItem(route) {
    if (state.shell !== "mobile" || state.dockCollapsed) {
      return;
    }
    const { scroller, active } = dockRouteElements(route);
    if (!scroller || !active) {
      return;
    }
    const scrollerRect = scroller.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    const edgeInset = 8;
    const isClipped = activeRect.left < scrollerRect.left + edgeInset
      || activeRect.right > scrollerRect.right - edgeInset;
    if (!isClipped) {
      return;
    }
    active.scrollIntoView({
      block: "nearest",
      inline: "nearest",
      behavior: motionIsReduced() ? "auto" : "smooth"
    });
  }

  function syncDockLayout(route, options = {}) {
    if (state.dockLayoutFrame) {
      window.cancelAnimationFrame(state.dockLayoutFrame);
    }
    state.dockLayoutFrame = window.requestAnimationFrame(() => {
      state.dockLayoutFrame = 0;
      syncDockIndicator(route, options.immediate === true);
      revealActiveDockItem(route);
    });
  }

  function syncDockState() {
    if (!document.body) {
      return;
    }
    document.body.dataset.mobileDock = state.dockCollapsed ? "collapsed" : "expanded";
    const toggle = document.querySelector("[data-mobile-dock-toggle]");
    toggle?.setAttribute("aria-expanded", String(!state.dockCollapsed));
    if (!state.dockCollapsed) {
      syncDockLayout(document.body.dataset.route || "home", { immediate: true });
    }
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
    const lang = active?.dataset.lang || document.documentElement.lang?.slice(0, 2) || "zh";
    const label = document.querySelector("[data-mobile-language-label]");
    if (label) {
      label.textContent = lang === "ja" ? "日" : lang === "en" ? "EN" : "中";
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
    const viewportHeight = window.visualViewport?.height || window.innerHeight;
    if (event.clientY < viewportHeight - 44) {
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

    document.addEventListener("pointerdown", (event) => {
      noteLaunchTrigger(event.target, event);
      startHomeGesture(event);
    }, { capture: true, passive: true });
    document.addEventListener("pointerup", finishHomeGesture, { passive: true });
    document.addEventListener("pointercancel", () => {
      state.gestureStart = null;
    }, { passive: true });
    document.querySelector(".mobile-language-cycle")?.addEventListener("click", cycleLanguage);
    document.querySelector("[data-mobile-dock-toggle]")?.addEventListener("click", toggleDock);
    syncDockState();
  }

  applyShell();
  syncViewportMetrics();

  if (typeof mobileMedia?.addEventListener === "function") {
    mobileMedia.addEventListener("change", applyShell);
  } else if (typeof mobileMedia?.addListener === "function") {
    mobileMedia.addListener(applyShell);
  }

  window.addEventListener("resize", syncViewportMetrics, { passive: true });
  window.visualViewport?.addEventListener("resize", syncViewportMetrics, { passive: true });
  window.visualViewport?.addEventListener("scroll", syncViewportMetrics, { passive: true });

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
    }
  });
})();
