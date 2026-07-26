import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createConnectionStatus } from "../js/features/connection-status.mjs";
import { translations } from "../js/core/i18n.mjs";

class FakeNode extends EventTarget {
  constructor() {
    super();
    this.attributes = new Map();
    this.dataset = {};
    this.textHistory = [];
    this.value = "";
  }

  get textContent() {
    return this.value;
  }

  set textContent(value) {
    this.value = String(value);
    this.textHistory.push(this.value);
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }
}

class FakeDocument extends EventTarget {
  constructor(hidden = false) {
    super();
    this.hidden = hidden;
  }
}

function createFakeTimers() {
  let nextId = 1;
  const tasks = new Map();
  return {
    clearTimeoutFn(id) {
      tasks.delete(id);
    },
    delays() {
      return [...tasks.values()].map((task) => task.delay).sort((left, right) => left - right);
    },
    runDelay(delay) {
      const match = [...tasks.entries()].find(([, task]) => task.delay === delay);
      assert.ok(match, `expected a scheduled ${delay}ms timer; found ${JSON.stringify(this.delays())}`);
      const [id, task] = match;
      tasks.delete(id);
      task.callback();
    },
    setTimeoutFn(callback, delay) {
      const id = nextId;
      nextId += 1;
      tasks.set(id, { callback, delay });
      return id;
    }
  };
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function createHarness(options = {}) {
  const button = new FakeNode();
  const label = new FakeNode();
  const liveRegion = new FakeNode();
  const tray = { dataset: {} };
  const documentRef = options.documentRef || new FakeDocument(false);
  const windowRef = options.windowRef || new EventTarget();
  const navigatorRef = options.navigatorRef || { onLine: true };
  const timers = options.timers || createFakeTimers();
  let language = options.language || "zh";
  const controller = createConnectionStatus({
    button,
    label,
    liveRegion,
    tray,
    documentRef,
    windowRef,
    navigatorRef,
    fetchImpl: options.fetchImpl || (async () => jsonResponse({ ok: true, db: true })),
    setTimeoutFn: timers.setTimeoutFn,
    clearTimeoutFn: timers.clearTimeoutFn,
    translate: (key) => translations[language][key],
    timeoutMs: options.timeoutMs,
    onlineIntervalMs: options.onlineIntervalMs,
    degradedRetryMs: options.degradedRetryMs
  });
  return {
    button,
    controller,
    documentRef,
    label,
    liveRegion,
    navigatorRef,
    setLanguage(value) {
      language = value;
      controller.syncLanguage();
    },
    timers,
    tray,
    windowRef
  };
}

test("startup stays checking until a strict healthy response establishes online", async () => {
  let request = null;
  const harness = createHarness({
    fetchImpl: async (url, options) => {
      request = { url, options };
      return jsonResponse({ ok: true, db: true });
    }
  });

  const pending = harness.controller.start();
  assert.equal(harness.controller.getState(), "checking");
  assert.equal(harness.label.textContent, "检测中");
  assert.equal(harness.button.getAttribute("aria-busy"), "true");

  await pending;
  assert.equal(harness.controller.getState(), "online");
  assert.equal(harness.tray.dataset.connectionState, "online");
  assert.equal(harness.button.dataset.connectionState, "online");
  assert.equal(harness.label.textContent, "在线");
  assert.equal(harness.button.getAttribute("aria-busy"), "false");
  assert.equal(harness.button.getAttribute("aria-label"), translations.zh.connectionStatusOnlineDetail);
  assert.equal(harness.button.getAttribute("title"), translations.zh.connectionStatusOnlineDetail);
  assert.deepEqual(harness.liveRegion.textHistory, [translations.zh.connectionStatusOnlineDetail]);
  assert.equal(request.url, "/api/health");
  assert.equal(request.options.method, "GET");
  assert.equal(request.options.cache, "no-store");
  assert.equal(request.options.credentials, "same-origin");
  assert.deepEqual(harness.timers.delays(), [60000]);
  harness.controller.stop();
});

test("health must be 2xx with ok:true and db:true, then degraded retries back off deterministically", async () => {
  const responses = [
    jsonResponse({ ok: true, db: true }, 503),
    jsonResponse({ ok: true }),
    jsonResponse({ ok: true, db: false }),
    new Response("not-json", { status: 200 }),
    jsonResponse({ ok: false, db: true }),
    jsonResponse({ ok: true, db: true })
  ];
  const harness = createHarness({
    fetchImpl: async () => responses.shift()
  });

  await harness.controller.start();
  assert.equal(harness.controller.getState(), "degraded");
  assert.equal(harness.label.textContent, "服务异常");
  assert.deepEqual(harness.timers.delays(), [10000]);

  for (const [currentDelay, nextDelay] of [
    [10000, 20000],
    [20000, 40000],
    [40000, 60000],
    [60000, 60000]
  ]) {
    harness.timers.runDelay(currentDelay);
    await harness.controller.whenIdle();
    assert.equal(harness.controller.getState(), "degraded");
    assert.deepEqual(harness.timers.delays(), [nextDelay]);
  }

  harness.timers.runDelay(60000);
  await harness.controller.whenIdle();
  assert.equal(harness.controller.getState(), "online");
  assert.deepEqual(harness.timers.delays(), [60000]);
  assert.deepEqual(harness.liveRegion.textHistory, [
    translations.zh.connectionStatusDegradedDetail,
    translations.zh.connectionStatusOnlineDetail
  ]);
  harness.controller.stop();
});

test("a five-second timeout becomes degraded without exposing response details", async () => {
  const harness = createHarness({
    fetchImpl: async (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => {
        reject(new DOMException("private backend detail", "AbortError"));
      }, { once: true });
    })
  });

  const pending = harness.controller.start();
  assert.deepEqual(harness.timers.delays(), [5000]);
  harness.timers.runDelay(5000);
  await pending;

  assert.equal(harness.controller.getState(), "degraded");
  assert.equal(harness.label.textContent, "服务异常");
  assert.doesNotMatch(harness.button.getAttribute("aria-label"), /private backend detail/);
  assert.doesNotMatch(harness.liveRegion.textContent, /private backend detail/);
  assert.deepEqual(harness.timers.delays(), [10000]);
  harness.controller.stop();
});

test("offline is immediate, and online events check the service instead of claiming recovery", async () => {
  let requests = 0;
  const navigatorRef = { onLine: false };
  const harness = createHarness({
    navigatorRef,
    fetchImpl: async () => {
      requests += 1;
      return jsonResponse({ ok: true, db: true });
    }
  });

  await harness.controller.start();
  assert.equal(harness.controller.getState(), "offline");
  assert.equal(harness.label.textContent, "离线");
  assert.equal(requests, 0);

  harness.button.dispatchEvent(new Event("click"));
  assert.equal(requests, 0);
  navigatorRef.onLine = true;
  harness.windowRef.dispatchEvent(new Event("online"));
  assert.equal(harness.controller.getState(), "checking");
  assert.equal(harness.button.getAttribute("aria-busy"), "true");
  await harness.controller.whenIdle();
  assert.equal(requests, 1);
  assert.equal(harness.controller.getState(), "online");

  navigatorRef.onLine = false;
  harness.windowRef.dispatchEvent(new Event("offline"));
  assert.equal(harness.controller.getState(), "offline");
  assert.deepEqual(harness.timers.delays(), []);
  harness.controller.stop();
});

test("manual retry and online events share one in-flight health request", async () => {
  let requests = 0;
  let resolveFirst;
  const firstResponse = new Promise((resolve) => {
    resolveFirst = resolve;
  });
  const harness = createHarness({
    fetchImpl: async () => {
      requests += 1;
      return requests === 1 ? firstResponse : jsonResponse({ ok: true, db: true });
    }
  });

  const firstPending = harness.controller.start();
  harness.button.dispatchEvent(new Event("click"));
  harness.windowRef.dispatchEvent(new Event("online"));
  assert.equal(requests, 1);

  resolveFirst(jsonResponse({ ok: true, db: true }));
  await firstPending;
  assert.equal(harness.controller.getState(), "online");

  harness.button.dispatchEvent(new Event("click"));
  assert.equal(harness.controller.getState(), "checking");
  await harness.controller.whenIdle();
  assert.equal(requests, 2);
  assert.equal(harness.controller.getState(), "online");
  harness.controller.stop();
});

test("hidden documents cancel in-flight work without a false degraded transition and resume when visible", async () => {
  let requests = 0;
  const documentRef = new FakeDocument(false);
  const harness = createHarness({
    documentRef,
    fetchImpl: async (_url, options) => {
      requests += 1;
      if (requests > 1) return jsonResponse({ ok: true, db: true });
      return new Promise((_resolve, reject) => {
        options.signal.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        }, { once: true });
      });
    }
  });

  const firstPending = harness.controller.start();
  documentRef.hidden = true;
  documentRef.dispatchEvent(new Event("visibilitychange"));
  await firstPending;
  assert.equal(harness.controller.getState(), "checking");
  assert.deepEqual(harness.timers.delays(), []);
  assert.equal(harness.liveRegion.textHistory.includes(translations.zh.connectionStatusDegradedDetail), false);

  documentRef.hidden = false;
  documentRef.dispatchEvent(new Event("visibilitychange"));
  assert.equal(harness.controller.getState(), "checking");
  await harness.controller.whenIdle();
  assert.equal(requests, 2);
  assert.equal(harness.controller.getState(), "online");
  assert.deepEqual(harness.timers.delays(), [60000]);

  documentRef.hidden = true;
  documentRef.dispatchEvent(new Event("visibilitychange"));
  assert.deepEqual(harness.timers.delays(), []);
  harness.controller.stop();
});

test("language sync preserves state and never re-announces an unchanged status", async () => {
  const navigatorRef = { onLine: false };
  const harness = createHarness({ navigatorRef });
  await harness.controller.start();
  const announcementCount = harness.liveRegion.textHistory.length;

  harness.setLanguage("en");
  assert.equal(harness.controller.getState(), "offline");
  assert.equal(harness.label.textContent, "OFFLINE");
  assert.equal(harness.button.getAttribute("aria-label"), translations.en.connectionStatusOfflineDetail);
  assert.equal(harness.liveRegion.textHistory.length, announcementCount);

  harness.setLanguage("ja");
  assert.equal(harness.label.textContent, "オフライン");
  assert.equal(harness.button.getAttribute("title"), translations.ja.connectionStatusOfflineDetail);
  assert.equal(harness.liveRegion.textHistory.length, announcementCount);
  harness.controller.stop();
});

test("the public shell uses a dedicated steady connection lamp and localized accessible controls", async () => {
  const [index, css, main, audit] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../css/style.css", import.meta.url), "utf8"),
    readFile(new URL("../js/main.js", import.meta.url), "utf8"),
    readFile(new URL("../scripts/public-ui-audit.mjs", import.meta.url), "utf8")
  ]);
  const tray = index.match(/<div class="status-tray"[\s\S]*?<\/div>/)?.[0] || "";

  assert.match(tray, /id="site-connection-status"/);
  assert.match(tray, /data-connection-state="checking"/);
  assert.match(tray, /id="site-connection-live"[\s\S]*role="status"[\s\S]*aria-live="polite"/);
  assert.match(tray, /class="site-connection-lamp"/);
  assert.doesNotMatch(tray, /class="online-dot"/);
  assert.doesNotMatch(tray, />ONLINE</);
  assert.match(css, /\.site-connection-lamp[\s\S]*animation:\s*none/);
  for (const state of ["online", "degraded", "offline"]) {
    assert.match(css, new RegExp(`site-connection-status\\[data-connection-state="${state}"\\]`));
  }
  assert.match(main, /createConnectionStatus/);
  assert.match(main, /siteConnectionStatus\.syncLanguage\(\)/);
  assert.match(main, /siteConnectionStatus\.start\(\)/);
  assert.match(audit, /pathname === "\/api\/health"[\s\S]*\{ ok: true, db: true, audit: true \}/);
  assert.doesNotMatch(audit, /trim\(\)\s*===\s*"ONLINE"/);

  for (const language of ["zh", "en", "ja"]) {
    for (const key of [
      "connectionStatusChecking",
      "connectionStatusOnline",
      "connectionStatusDegraded",
      "connectionStatusOffline",
      "connectionStatusCheckingDetail",
      "connectionStatusOnlineDetail",
      "connectionStatusDegradedDetail",
      "connectionStatusOfflineDetail"
    ]) {
      assert.equal(typeof translations[language][key], "string", `${language}.${key} must exist`);
      assert.ok(translations[language][key].trim(), `${language}.${key} must not be empty`);
    }
  }
});
