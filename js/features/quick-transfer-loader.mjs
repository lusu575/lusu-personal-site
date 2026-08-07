const TRANSFER_VERSION = "20260807-life-restart-agent-r1";
const FRAGMENT_PATH = "/fragments/quick-transfer.html";
const FRAGMENT_CANONICAL_PATH = "/fragments/quick-transfer";
const ALLOWED_FRAGMENT_PATHS = Object.freeze([FRAGMENT_PATH, FRAGMENT_CANONICAL_PATH]);
const FRAGMENT_URL = `${FRAGMENT_PATH}?v=${TRANSFER_VERSION}`;
const STYLESHEET_URL = `/css/transfer.css?v=${TRANSFER_VERSION}`;
const SCRIPT_URL = `/js/transfer.js?v=${TRANSFER_VERSION}`;

const COPY = Object.freeze({
  zh: Object.freeze({
    loading: "正在启动临时互传……",
    failed: "临时互传暂时无法启动。",
    retry: "重试"
  }),
  en: Object.freeze({
    loading: "Starting Quick Transfer…",
    failed: "Quick Transfer could not start.",
    retry: "Retry"
  }),
  ja: Object.freeze({
    loading: "一時転送を起動しています…",
    failed: "一時転送を起動できませんでした。",
    retry: "再試行"
  })
});

const EXPECTED_IDS = Object.freeze([
  "transfer-app",
  "transfer-app-title",
  "transfer-back-to-resources",
  "transfer-copy-password",
  "transfer-drop-overlay",
  "transfer-feed",
  "transfer-feedback",
  "transfer-file-input",
  "transfer-generate-password",
  "transfer-leave-room",
  "transfer-login-button",
  "transfer-login-gate",
  "transfer-live-summary",
  "transfer-network-status",
  "transfer-pending-attachments",
  "transfer-photo-input",
  "transfer-quota-card",
  "transfer-refresh-button",
  "transfer-room",
  "transfer-room-entry",
  "transfer-room-form",
  "transfer-room-mode",
  "transfer-room-password",
  "transfer-security-note",
  "transfer-send-button",
  "transfer-task-list",
  "transfer-tasks-title",
  "transfer-text-form",
  "transfer-text-input",
  "transfer-upload-help",
  "transfer-upload-zone"
].sort());

function normalizeLanguage(value) {
  const language = String(value || "").toLowerCase().split("-")[0];
  return ["zh", "en", "ja"].includes(language) ? language : "zh";
}

export function isAllowedQuickTransferFragmentUrl(value, pageHref) {
  try {
    const pageUrl = new URL(pageHref);
    const responseUrl = new URL(value, pageUrl);
    return responseUrl.origin === pageUrl.origin
      && ALLOWED_FRAGMENT_PATHS.includes(responseUrl.pathname);
  } catch {
    return false;
  }
}

function validateFragmentResponse(response) {
  if (!response?.ok) throw new Error(`Quick Transfer fragment returned ${response?.status || "an error"}.`);
  if (!isAllowedQuickTransferFragmentUrl(response.url || FRAGMENT_URL, window.location.href)) {
    throw new Error("Quick Transfer fragment resolved outside its fixed local path.");
  }
}

function parseAndValidateFragment(source) {
  if (typeof source !== "string" || source.length < 100 || source.length > 24_000) {
    throw new Error("Quick Transfer fragment size is invalid.");
  }
  const documentNode = new DOMParser().parseFromString(source, "text/html");
  const root = documentNode.body.children.length === 1 ? documentNode.body.firstElementChild : null;
  if (!(root instanceof HTMLElement)
    || root.tagName !== "SECTION"
    || root.id !== "transfer-app"
    || root.getAttribute("aria-labelledby") !== "transfer-app-title"
    || !root.hidden) {
    throw new Error("Quick Transfer fragment root is invalid.");
  }
  if (root.querySelector("script, style, link, meta, base, iframe, object, embed, svg, math")) {
    throw new Error("Quick Transfer fragment contains an executable or embedded element.");
  }
  const elements = [root, ...root.querySelectorAll("*")];
  for (const element of elements) {
    for (const attribute of element.attributes) {
      if (/^on/i.test(attribute.name)
        || /^(?:src|srcdoc|href|action|formaction|xlink:href)$/i.test(attribute.name)) {
        throw new Error("Quick Transfer fragment contains a forbidden attribute.");
      }
    }
  }
  const ids = elements.map((element) => element.id).filter(Boolean);
  if (new Set(ids).size !== ids.length
    || JSON.stringify([...ids].sort()) !== JSON.stringify(EXPECTED_IDS)) {
    throw new Error("Quick Transfer fragment identifiers do not match the local contract.");
  }
  const password = root.querySelector("#transfer-room-password");
  const photo = root.querySelector("#transfer-photo-input");
  const file = root.querySelector("#transfer-file-input");
  if (password?.getAttribute("type") !== "password"
    || password?.getAttribute("autocomplete") !== "off"
    || photo?.getAttribute("type") !== "file"
    || photo?.getAttribute("accept") !== "image/*"
    || !photo?.hasAttribute("multiple")
    || file?.getAttribute("type") !== "file"
    || !file?.hasAttribute("multiple")) {
    throw new Error("Quick Transfer fragment controls do not match the local contract.");
  }
  return root;
}

export function createQuickTransferLoader() {
  let phase = "idle";
  let routeActive = false;
  let language = normalizeLanguage(document.documentElement.lang);
  let loadPromise = null;
  let stylesheetPromise = null;
  let fragmentPromise = null;
  let scriptPromise = null;
  let fragmentRoot = null;
  let implementation = null;
  let initialized = false;
  let statusNode = null;
  let resourceContentVisibility = null;

  function resourceWindow() {
    return document.querySelector("#resources .xp-window");
  }

  function rememberResourceContentVisibility() {
    if (resourceContentVisibility) return;
    const categories = document.getElementById("resource-categories");
    const list = document.getElementById("resource-list");
    resourceContentVisibility = {
      categoriesHidden: categories?.hidden ?? true,
      listHidden: list?.hidden ?? false
    };
  }

  function setResourceContentHidden(hidden) {
    const categories = document.getElementById("resource-categories");
    const list = document.getElementById("resource-list");
    if (hidden) rememberResourceContentVisibility();
    if (categories) categories.hidden = hidden;
    if (list) list.hidden = hidden;
  }

  function restoreResourceContentVisibility() {
    if (!resourceContentVisibility) return;
    const categories = document.getElementById("resource-categories");
    const list = document.getElementById("resource-list");
    if (categories) categories.hidden = resourceContentVisibility.categoriesHidden;
    if (list) list.hidden = resourceContentVisibility.listHidden;
    resourceContentVisibility = null;
  }

  function clearStatus({ restoreContent = false } = {}) {
    statusNode?.remove();
    statusNode = null;
    if (restoreContent) restoreResourceContentVisibility();
  }

  function renderStatus(kind) {
    clearStatus();
    setResourceContentHidden(true);
    const copy = COPY[language];
    const section = document.createElement("section");
    section.id = "transfer-loader-status";
    section.className = `loading-text route-module-status transfer-loader-status is-${kind}`;
    section.setAttribute("role", kind === "error" ? "alert" : "status");
    section.setAttribute("aria-live", "polite");
    const message = document.createElement("p");
    message.dataset.transferLoaderCopy = kind;
    message.textContent = copy[kind === "error" ? "failed" : "loading"];
    section.appendChild(message);
    if (kind === "error") {
      const retry = document.createElement("button");
      retry.type = "button";
      retry.className = "xp-button";
      retry.dataset.transferLoaderRetry = "true";
      retry.textContent = copy.retry;
      retry.addEventListener("click", () => { void open(); }, { once: true });
      section.appendChild(retry);
    }
    resourceWindow()?.appendChild(section);
    statusNode = section;
  }

  function updateStatusLanguage() {
    if (!statusNode) return;
    const kind = statusNode.classList.contains("is-error") ? "error" : "loading";
    const message = statusNode.querySelector("[data-transfer-loader-copy]");
    const retry = statusNode.querySelector("[data-transfer-loader-retry]");
    if (message) message.textContent = COPY[language][kind === "error" ? "failed" : "loading"];
    if (retry) retry.textContent = COPY[language].retry;
  }

  function ensureStylesheet() {
    if (stylesheetPromise) return stylesheetPromise;
    stylesheetPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector(`link[data-quick-transfer-style="${TRANSFER_VERSION}"]`);
      if (existing?.dataset.loaded === "true") {
        resolve(existing);
        return;
      }
      const link = existing || document.createElement("link");
      link.rel = "stylesheet";
      link.href = STYLESHEET_URL;
      link.dataset.quickTransferStyle = TRANSFER_VERSION;
      link.addEventListener("load", () => {
        link.dataset.loaded = "true";
        resolve(link);
      }, { once: true });
      link.addEventListener("error", () => {
        link.remove();
        stylesheetPromise = null;
        reject(new Error("Quick Transfer stylesheet failed to load."));
      }, { once: true });
      if (!existing) document.head.appendChild(link);
    });
    return stylesheetPromise;
  }

  function ensureFragment() {
    if (fragmentRoot) return Promise.resolve(fragmentRoot);
    if (fragmentPromise) return fragmentPromise;
    fragmentPromise = fetch(FRAGMENT_URL, {
      method: "GET",
      credentials: "same-origin",
      cache: "force-cache",
      headers: { Accept: "text/html" }
    }).then(async (response) => {
      validateFragmentResponse(response);
      const source = await response.text();
      fragmentRoot = parseAndValidateFragment(source);
      return fragmentRoot;
    }).catch((error) => {
      fragmentPromise = null;
      throw error;
    });
    return fragmentPromise;
  }

  function validImplementation(candidate) {
    return candidate
      && candidate !== facade
      && ["init", "open", "close", "setLanguage", "routeEnter", "routeLeave", "lifecycleSnapshot"]
        .every((name) => typeof candidate[name] === "function");
  }

  function ensureScript() {
    if (implementation) return Promise.resolve(implementation);
    if (scriptPromise) return scriptPromise;
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = SCRIPT_URL;
      script.async = true;
      script.dataset.quickTransferScript = TRANSFER_VERSION;
      script.addEventListener("load", () => {
        const candidate = window.QuickTransfer;
        window.QuickTransfer = facade;
        if (!validImplementation(candidate)) {
          script.remove();
          scriptPromise = null;
          reject(new Error("Quick Transfer client contract is invalid."));
          return;
        }
        implementation = candidate;
        resolve(candidate);
      }, { once: true });
      script.addEventListener("error", () => {
        window.QuickTransfer = facade;
        script.remove();
        scriptPromise = null;
        reject(new Error("Quick Transfer client failed to load."));
      }, { once: true });
      document.head.appendChild(script);
    });
    return scriptPromise;
  }

  function ensureLoaded() {
    if (phase === "ready" && implementation && fragmentRoot) return Promise.resolve();
    if (loadPromise) return loadPromise;
    phase = "loading";
    loadPromise = Promise.all([ensureStylesheet(), ensureFragment(), ensureScript()])
      .then(() => { phase = "ready"; })
      .catch((error) => {
        phase = "error";
        throw error;
      })
      .finally(() => { loadPromise = null; });
    return loadPromise;
  }

  function mountFragment() {
    const existing = document.getElementById("transfer-app");
    if (existing) return existing;
    if (!fragmentRoot) throw new Error("Quick Transfer fragment is unavailable.");
    const mounted = document.importNode(fragmentRoot, true);
    resourceWindow()?.appendChild(mounted);
    return mounted;
  }

  async function open() {
    if (!routeActive) return false;
    const alreadyReady = phase === "ready" && implementation && fragmentRoot;
    if (!alreadyReady) renderStatus("loading");
    try {
      await ensureLoaded();
      if (!routeActive) {
        clearStatus({ restoreContent: true });
        return false;
      }
      mountFragment();
      clearStatus({ restoreContent: true });
      if (!initialized) {
        implementation.init(language);
        initialized = true;
      }
      implementation.routeEnter();
      implementation.setLanguage(language);
      await implementation.open();
      return true;
    } catch (error) {
      if (routeActive) renderStatus("error");
      else clearStatus({ restoreContent: true });
      return false;
    }
  }

  function close(options) {
    clearStatus({ restoreContent: true });
    implementation?.close?.(options);
  }

  function setLanguage(value) {
    language = normalizeLanguage(value);
    updateStatusLanguage();
    if (initialized) implementation?.setLanguage?.(language);
  }

  function routeEnter() {
    routeActive = true;
    if (initialized) implementation?.routeEnter?.();
  }

  function routeLeave() {
    routeActive = false;
    clearStatus({ restoreContent: true });
    if (initialized) implementation?.routeLeave?.();
  }

  function lifecycleSnapshot() {
    const inner = initialized ? implementation?.lifecycleSnapshot?.() : null;
    return Object.freeze({
      initialized,
      routeActive,
      open: Boolean(inner?.open),
      listeners: inner?.listeners || 0,
      timers: inner?.timers || 0,
      requests: inner?.requests || 0,
      xhr: inner?.xhr || 0,
      loader: phase
    });
  }

  const facade = Object.freeze({ init() {}, open, close, setLanguage, routeEnter, routeLeave, lifecycleSnapshot });
  return facade;
}
