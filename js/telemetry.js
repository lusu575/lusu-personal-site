(function () {
  const endpoint = "/api/analytics";
  const maxTextLength = 120;

  if (window.location.pathname.startsWith("/admin")) {
    return;
  }

  function currentRoute() {
    if (window.location.pathname.startsWith("/articles/")) {
      return "knowledge";
    }
    return String(window.location.hash || "#home").replace(/^#\/?/, "") || "home";
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
      path: `${window.location.pathname}${window.location.search}${window.location.hash}`,
      route: currentRoute(),
      referrer: document.referrer || "",
      title: document.title || "",
      lang: currentLang(),
      language: navigator.language || "",
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
    return send("/click", {
      targetKey: cleanText(targetKey, 160),
      targetText: cleanText(targetText, 160),
      tagName: "CUSTOM",
      elementId: "",
      elementClasses: "",
      href: "",
      dataRoute: extra.route || currentRoute(),
      path: `${window.location.pathname}${window.location.search}${window.location.hash}`,
      route: extra.route || currentRoute(),
      screenWidth: window.innerWidth || 0,
      screenHeight: window.innerHeight || 0,
      x: 0,
      y: 0
    });
  };

  function cleanText(value, max = maxTextLength) {
    return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
  }

  function targetDescriptor(target) {
    const element = target.closest("button, a, input, select, textarea, [data-route], [data-filter-type], [data-article-slug], [data-article-category], [data-video-index], [data-video-id]");
    if (!element) {
      return null;
    }
    const tagName = element.tagName.toLowerCase();
    const text = ["input", "textarea", "select"].includes(tagName)
      ? cleanText(element.getAttribute("aria-label") || element.name || element.id || tagName)
      : cleanText(element.innerText || element.getAttribute("aria-label") || element.title || tagName);
    const classes = Array.from(element.classList || []).slice(0, 6).join(".");
    const targetKey = [
      tagName,
      element.id ? `#${element.id}` : "",
      classes ? `.${classes}` : "",
      element.dataset.route ? `[route=${element.dataset.route}]` : "",
      element.dataset.articleSlug ? "[article]" : "",
      element.dataset.videoIndex || element.dataset.videoId ? "[video]" : ""
    ].filter(Boolean).join("");
    return {
      targetKey,
      targetText: text,
      tagName,
      elementId: element.id || "",
      elementClasses: classes,
      href: element.getAttribute("href") || "",
      dataRoute: element.dataset.route || "",
      path: `${window.location.pathname}${window.location.search}${window.location.hash}`,
      route: currentRoute(),
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
