export const CONNECTION_STATUS_STATES = Object.freeze([
  "checking",
  "online",
  "degraded",
  "offline"
]);

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_ONLINE_INTERVAL_MS = 60000;
const DEFAULT_DEGRADED_RETRY_MS = Object.freeze([10000, 20000, 40000, 60000]);

const stateCopy = Object.freeze({
  checking: Object.freeze({
    labelKey: "connectionStatusChecking",
    detailKey: "connectionStatusCheckingDetail"
  }),
  online: Object.freeze({
    labelKey: "connectionStatusOnline",
    detailKey: "connectionStatusOnlineDetail"
  }),
  degraded: Object.freeze({
    labelKey: "connectionStatusDegraded",
    detailKey: "connectionStatusDegradedDetail"
  }),
  offline: Object.freeze({
    labelKey: "connectionStatusOffline",
    detailKey: "connectionStatusOfflineDetail"
  })
});

function positiveDelay(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function retryDelays(value) {
  if (!Array.isArray(value) || !value.length) return [...DEFAULT_DEGRADED_RETRY_MS];
  const delays = value
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item) && item >= 0);
  return delays.length ? delays : [...DEFAULT_DEGRADED_RETRY_MS];
}

export function createConnectionStatus(options = {}) {
  const documentRef = options.documentRef || (typeof document !== "undefined" ? document : null);
  const windowRef = options.windowRef || (typeof window !== "undefined" ? window : null);
  const navigatorRef = options.navigatorRef || (typeof navigator !== "undefined" ? navigator : null);
  const tray = options.tray || documentRef?.querySelector?.(".status-tray") || null;
  const button = options.button || documentRef?.getElementById?.("site-connection-status") || null;
  const label = options.label || documentRef?.getElementById?.("site-connection-label") || null;
  const liveRegion = options.liveRegion || documentRef?.getElementById?.("site-connection-live") || null;
  const translate = typeof options.translate === "function" ? options.translate : (key) => key;
  const fetchImpl = options.fetchImpl
    || (typeof globalThis.fetch === "function" ? globalThis.fetch.bind(globalThis) : null);
  const setTimeoutFn = options.setTimeoutFn || globalThis.setTimeout?.bind(globalThis);
  const clearTimeoutFn = options.clearTimeoutFn || globalThis.clearTimeout?.bind(globalThis);
  const abortControllerFactory = options.abortControllerFactory || (() => new AbortController());
  const timeoutMs = positiveDelay(options.timeoutMs, DEFAULT_TIMEOUT_MS);
  const onlineIntervalMs = positiveDelay(options.onlineIntervalMs, DEFAULT_ONLINE_INTERVAL_MS);
  const degradedRetryMs = retryDelays(options.degradedRetryMs);
  const endpoint = String(options.endpoint || "/api/health");

  if (!button || !label || !liveRegion) {
    throw new TypeError("Connection status requires its button, label, and live region.");
  }
  if (typeof fetchImpl !== "function" || typeof setTimeoutFn !== "function" || typeof clearTimeoutFn !== "function") {
    throw new TypeError("Connection status requires fetch and timer functions.");
  }

  let state = "checking";
  let started = false;
  let stopped = false;
  let scheduledTimer = null;
  let activeProbe = null;
  let degradedAttempt = 0;

  function localized(key) {
    const value = String(translate(key) || "").trim();
    return value || key;
  }

  function render(nextState, { announce = false, force = false } = {}) {
    const next = CONNECTION_STATUS_STATES.includes(nextState) ? nextState : "checking";
    const changed = state !== next;
    if (!changed && !force) return false;

    state = next;
    const copy = stateCopy[state];
    const visibleText = localized(copy.labelKey);
    const detailText = localized(copy.detailKey);

    if (tray?.dataset) tray.dataset.connectionState = state;
    button.dataset.connectionState = state;
    button.dataset.i18nAriaLabel = copy.detailKey;
    button.dataset.i18nTitle = copy.detailKey;
    button.setAttribute("aria-label", detailText);
    button.setAttribute("title", detailText);
    button.setAttribute("aria-busy", String(state === "checking"));
    label.dataset.i18n = copy.labelKey;
    label.textContent = visibleText;

    if (changed && announce) {
      liveRegion.textContent = detailText;
    }
    return changed;
  }

  function syncLanguage() {
    render(state, { force: true });
  }

  function clearScheduledCheck() {
    if (scheduledTimer === null) return;
    clearTimeoutFn(scheduledTimer);
    scheduledTimer = null;
  }

  function scheduleCheck(delay) {
    clearScheduledCheck();
    if (stopped || documentRef?.hidden === true || navigatorRef?.onLine === false) return;
    scheduledTimer = setTimeoutFn(() => {
      scheduledTimer = null;
      void check({ showChecking: false });
    }, delay);
  }

  function cancelActiveProbe(reason) {
    if (!activeProbe) return;
    const probe = activeProbe;
    probe.cancelReason = reason;
    if (probe.timeoutTimer !== null) {
      clearTimeoutFn(probe.timeoutTimer);
      probe.timeoutTimer = null;
    }
    probe.controller.abort();
    if (activeProbe === probe) activeProbe = null;
  }

  function setOffline() {
    clearScheduledCheck();
    cancelActiveProbe("offline");
    degradedAttempt = 0;
    render("offline", { announce: true });
  }

  function handleProbeFailure() {
    if (stopped || documentRef?.hidden === true) return;
    if (navigatorRef?.onLine === false) {
      setOffline();
      return;
    }
    render("degraded", { announce: true });
    const retryIndex = Math.min(degradedAttempt, degradedRetryMs.length - 1);
    const delay = degradedRetryMs[retryIndex];
    degradedAttempt = Math.min(degradedAttempt + 1, degradedRetryMs.length - 1);
    scheduleCheck(delay);
  }

  function check({ showChecking = true } = {}) {
    if (stopped || documentRef?.hidden === true) return Promise.resolve(state);
    if (navigatorRef?.onLine === false) {
      setOffline();
      return Promise.resolve(state);
    }

    if (showChecking) render("checking", { announce: true });
    if (activeProbe) return activeProbe.promise;

    clearScheduledCheck();
    const probe = {
      cancelReason: "",
      controller: abortControllerFactory(),
      promise: null,
      timeoutTimer: null
    };
    activeProbe = probe;
    probe.timeoutTimer = setTimeoutFn(() => {
      probe.cancelReason = "timeout";
      probe.controller.abort();
    }, timeoutMs);

    probe.promise = (async () => {
      try {
        const response = await fetchImpl(endpoint, {
          method: "GET",
          headers: { Accept: "application/json" },
          cache: "no-store",
          credentials: "same-origin",
          signal: probe.controller.signal
        });
        if (probe.cancelReason || stopped || documentRef?.hidden === true) return state;

        let payload = null;
        if (response?.ok === true) {
          try {
            payload = await response.json();
          } catch {
            payload = null;
          }
        }
        if (probe.cancelReason || stopped || documentRef?.hidden === true) return state;
        if (response?.ok !== true || payload?.ok !== true || payload?.db !== true) {
          handleProbeFailure();
          return state;
        }

        degradedAttempt = 0;
        render("online", { announce: true });
        scheduleCheck(onlineIntervalMs);
        return state;
      } catch {
        if (!probe.cancelReason || probe.cancelReason === "timeout") {
          handleProbeFailure();
        }
        return state;
      } finally {
        if (probe.timeoutTimer !== null) {
          clearTimeoutFn(probe.timeoutTimer);
          probe.timeoutTimer = null;
        }
        if (activeProbe === probe) activeProbe = null;
      }
    })();

    return probe.promise;
  }

  function handleOffline() {
    setOffline();
  }

  function handleOnline() {
    if (documentRef?.hidden === true) return;
    void check({ showChecking: true });
  }

  function handleVisibilityChange() {
    if (documentRef?.hidden === true) {
      clearScheduledCheck();
      cancelActiveProbe("hidden");
      return;
    }
    if (navigatorRef?.onLine === false) {
      setOffline();
      return;
    }
    void check({ showChecking: true });
  }

  function handleRetryClick() {
    void check({ showChecking: true });
  }

  function start() {
    if (started) return activeProbe?.promise || Promise.resolve(state);
    started = true;
    stopped = false;
    render("checking", { force: true });
    button.addEventListener("click", handleRetryClick);
    windowRef?.addEventListener?.("online", handleOnline);
    windowRef?.addEventListener?.("offline", handleOffline);
    documentRef?.addEventListener?.("visibilitychange", handleVisibilityChange);

    if (documentRef?.hidden === true) return Promise.resolve(state);
    if (navigatorRef?.onLine === false) {
      setOffline();
      return Promise.resolve(state);
    }
    return check({ showChecking: false });
  }

  function stop() {
    if (!started) return;
    stopped = true;
    started = false;
    clearScheduledCheck();
    cancelActiveProbe("stopped");
    button.removeEventListener("click", handleRetryClick);
    windowRef?.removeEventListener?.("online", handleOnline);
    windowRef?.removeEventListener?.("offline", handleOffline);
    documentRef?.removeEventListener?.("visibilitychange", handleVisibilityChange);
  }

  return Object.freeze({
    check,
    getState: () => state,
    start,
    stop,
    syncLanguage,
    whenIdle: () => activeProbe?.promise || Promise.resolve(state)
  });
}
