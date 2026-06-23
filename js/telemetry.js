(function () {
  const endpoint = "/api/analytics";
  const maxTextLength = 120;
  const emailLikePattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
  const knownRoutes = new Set(["home", "knowledge", "videos", "resources", "games", "blog", "chatroom", "about"]);
  const allowedLangs = new Set(["zh", "en", "ja"]);

  if (window.location.pathname.startsWith("/admin")) {
    return;
  }

  function currentRoute() {
    if (window.location.pathname.startsWith("/articles/")) {
      return "knowledge";
    }
    return safeRouteName(window.location.hash || "home");
  }

  function currentLang() {
    const lang = document.documentElement.lang || "zh-CN";
    if (lang.toLowerCase().startsWith("en")) {
      return "en";
    }
    if (lang.toLowerCase().startsWith("ja")) {
      return "ja";
    }
    return "zh";
  }

  function pagePayload() {
    return {
      path: currentPath(),
      route: cleanText(currentRoute(), 80),
      referrer: safeReferrer(document.referrer || ""),
      title: cleanText(document.title || "", 160),
      lang: currentLang(),
      language: cleanText(navigator.language || "", 160),
      screenWidth: window.innerWidth || 0,
      screenHeight: window.innerHeight || 0
    };
  }

  function send(path, payload) {
    return fetch(`${endpoint}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      keepalive: true,
      body: JSON.stringify(payload)
    }).catch(() => {});
  }

  window.lusuTrackClick = function (targetKey, targetText, extra = {}) {
    const route = cleanText(extra.route || currentRoute(), 80);
    return send("/click", {
      targetKey: cleanText(targetKey, 160),
      targetText: cleanTargetText(targetText, 160),
      tagName: "CUSTOM",
      elementId: "",
      elementClasses: "",
      href: "",
      dataRoute: route,
      path: currentPath(),
      route,
      screenWidth: window.innerWidth || 0,
      screenHeight: window.innerHeight || 0,
      x: 0,
      y: 0
    });
  };

  function redactEmailLikeText(value) {
    const text = String(value || "");
    return text
      .replace(emailLikePattern, "[email]")
      .replace(/[A-Z0-9._%+-]+(?:%40|%2540)[A-Z0-9.-]+(?:\.|%2E|%252E)[A-Z]{2,}/gi, "[email]");
  }

  function cleanText(value, max = maxTextLength) {
    return redactEmailLikeText(value).replace(/\s+/g, " ").trim().slice(0, max);
  }

  function cleanTargetText(value, max = maxTextLength) {
    return cleanText(value, max);
  }

  function cleanToken(value, max = 80) {
    const token = cleanText(value, max);
    if (!token || token.includes("[email]") || /[%?=&/@]/.test(token)) {
      return "";
    }
    return token.replace(/[^a-z0-9:_-]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, max);
  }

  function safeRouteName(value) {
    const raw = decodeHashText(String(value || "")).replace(/^#\/?/, "").replace(/^\/+/, "");
    const firstSegment = raw.split(/[/?#]/)[0] || "home";
    if (firstSegment === "knowledge") {
      return "knowledge";
    }
    return knownRoutes.has(firstSegment) ? firstSegment : "home";
  }

  function safeLang(value) {
    const normalized = String(value || "").toLowerCase().slice(0, 2);
    return allowedLangs.has(normalized) ? normalized : "";
  }

  function decodeHashText(value) {
    try {
      return decodeURIComponent(String(value || ""));
    } catch {
      return String(value || "");
    }
  }

  function safePathname(pathname) {
    const path = String(pathname || "/");
    if (/^\/articles\/[a-z0-9][a-z0-9-]{0,119}\/?$/i.test(path)) {
      return "/articles/:slug";
    }
    return path === "/" || path === "/index.html" ? "/" : "/other";
  }

  function safeSearch(search) {
    const params = new URLSearchParams(String(search || ""));
    const lang = safeLang(params.get("lang"));
    return lang ? `?lang=${lang}` : "";
  }

  function safeHash(hash) {
    const route = safeRouteName(hash);
    if (route === "home") {
      return "";
    }
    const raw = decodeHashText(String(hash || "")).replace(/^#\/?/, "").replace(/^\/+/, "");
    return raw.startsWith("knowledge/article/") ? "#knowledge/article" : `#${route}`;
  }

  function currentPath() {
    return cleanText(`${safePathname(window.location.pathname)}${safeSearch(window.location.search)}${safeHash(window.location.hash)}`, 240);
  }

  function safeReferrer(value) {
    try {
      const url = new URL(String(value || ""));
      const currentOrigin = window.location.origin || `${window.location.protocol}//${window.location.host}`;
      if (url.origin === currentOrigin) {
        return cleanText(`${safePathname(url.pathname)}${safeSearch(url.search)}${safeHash(url.hash)}`, 240);
      }
      return cleanText(url.origin, 160);
    } catch {
      return "";
    }
  }

  function safeHref(value) {
    try {
      const href = String(value || "").trim();
      if (!href || href.startsWith("#")) {
        return "";
      }
      const url = new URL(href, window.location.origin);
      if (url.origin === window.location.origin) {
        return cleanText(`${safePathname(url.pathname)}${safeSearch(url.search)}${safeHash(url.hash)}`, 240);
      }
      return cleanText(url.origin, 160);
    } catch {
      return "";
    }
  }

  function stableTelemetryLabel(element) {
    return element.getAttribute("data-analytics-label")
      || element.getAttribute("data-telemetry-label")
      || "";
  }

  function targetDescriptor(target) {
    const element = target.closest("button, a, input, select, textarea, [data-analytics-label], [data-telemetry-label], [data-route], [data-filter-type], [data-article-slug], [data-article-category], [data-video-index], [data-video-id]");
    if (!element) {
      return null;
    }
    const tagName = element.tagName.toLowerCase();
    const stableLabel = cleanToken(stableTelemetryLabel(element), 120);
    const text = stableLabel;
    const elementId = cleanToken(element.id || "", 80);
    const classes = cleanText(Array.from(element.classList || []).map((name) => cleanToken(name, 40)).filter(Boolean).slice(0, 6).join("."), 160);
    const dataRoute = cleanText(element.dataset.route ? safeRouteName(element.dataset.route) : "", 80);
    const targetKey = [
      tagName,
      elementId ? `#${elementId}` : "",
      classes ? `.${classes}` : "",
      dataRoute ? `[route=${dataRoute}]` : "",
      element.dataset.articleSlug ? "[article]" : "",
      element.dataset.videoIndex || element.dataset.videoId ? "[video]" : ""
    ].filter(Boolean).join("");
    return {
      targetKey,
      targetText: text,
      tagName,
      elementId,
      elementClasses: classes,
      href: safeHref(element.getAttribute("href") || ""),
      dataRoute,
      path: currentPath(),
      route: cleanText(currentRoute(), 80),
      screenWidth: window.innerWidth || 0,
      screenHeight: window.innerHeight || 0
    };
  }

  let lastPath = "";
  function recordPageView() {
    const payload = pagePayload();
    if (payload.path === lastPath) {
      return;
    }
    lastPath = payload.path;
    send("/page-view", payload);
  }

  function wrapHistoryMethod(name) {
    const original = window.history[name];
    if (typeof original !== "function") {
      return;
    }
    window.history[name] = function (...args) {
      const result = original.apply(this, args);
      window.setTimeout(recordPageView, 0);
      return result;
    };
  }

  wrapHistoryMethod("pushState");
  wrapHistoryMethod("replaceState");

  document.addEventListener("click", (event) => {
    const descriptor = targetDescriptor(event.target);
    if (!descriptor) {
      return;
    }
    descriptor.x = Math.round(event.clientX || 0);
    descriptor.y = Math.round(event.clientY || 0);
    send("/click", descriptor);
  }, { capture: true });

  window.addEventListener("hashchange", () => window.setTimeout(recordPageView, 0));
  window.addEventListener("popstate", () => window.setTimeout(recordPageView, 0));
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      recordPageView();
    }
  });

  send("/identify", { language: navigator.language || "" }).then(recordPageView);
})();
