import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createReadStream, existsSync } from "node:fs";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const timeoutMs = 20_000;
const mime = {
  ".css": "text/css; charset=utf-8",
  ".flac": "audio/flac",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

function browserPath() {
  const candidates = [
    process.env.PUBLIC_UI_CHROME,
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser"
  ].filter(Boolean);
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error("Chrome or Edge is required for the A Dark Room rotation audit");
  return found;
}

async function freePort() {
  const server = createServer();
  await new Promise((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolvePromise);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not reserve an audit port");
  await new Promise((resolvePromise) => server.close(resolvePromise));
  return address.port;
}

async function staticServer() {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url || "/", "http://127.0.0.1");
      const decoded = decodeURIComponent(url.pathname).replaceAll("\\", "/");
      const requested = decoded.endsWith("/") ? `${decoded}index.html` : decoded;
      const file = resolve(root, `.${requested}`);
      const rel = relative(root, file);
      if (!rel || rel.startsWith("..") || isAbsolute(rel)) {
        response.writeHead(404).end("Not found");
        return;
      }
      const info = await stat(file).catch(() => null);
      if (!info?.isFile()) {
        response.writeHead(404).end("Not found");
        return;
      }
      response.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Length": info.size,
        "Content-Type": mime[extname(file).toLowerCase()] || "application/octet-stream"
      });
      createReadStream(file).pipe(response);
    } catch (error) {
      response.writeHead(500).end(error.message);
    }
  });
  await new Promise((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolvePromise);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Audit server has no port");
  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolvePromise) => server.close(resolvePromise))
  };
}

async function getJson(url) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (response.ok) return response.json();
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError?.message || "unknown error"}`);
}

class CDP {
  constructor(url) {
    this.url = url;
    this.id = 1;
    this.pending = new Map();
  }

  async connect() {
    this.socket = new WebSocket(this.url);
    await new Promise((resolvePromise, reject) => {
      this.socket.addEventListener("open", resolvePromise, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      const job = this.pending.get(message.id);
      if (!job) return;
      this.pending.delete(message.id);
      clearTimeout(job.timer);
      if (message.error) job.reject(new Error(`${job.method}: ${message.error.message}`));
      else job.resolve(message.result || {});
    });
  }

  send(method, params = {}) {
    const id = this.id++;
    return new Promise((resolvePromise, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method} timed out`));
      }, timeoutMs);
      this.pending.set(id, { method, resolve: resolvePromise, reject, timer });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.socket?.close();
  }
}

async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  }
  return result.result?.value;
}

async function waitFor(client, expression, label) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await evaluate(client, `Boolean(${expression})`).catch(() => false)) return;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function setViewport(client, width, height) {
  await client.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: true,
    screenWidth: width,
    screenHeight: height,
    screenOrientation: {
      angle: width > height ? 90 : 0,
      type: width > height ? "landscapePrimary" : "portraitPrimary"
    }
  });
  await client.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
}

const snapshotExpression = `(() => {
  const number = (value) => Math.round((Number.parseFloat(value) || 0) * 100) / 100;
  const locationSlider = document.querySelector('#locationSlider');
  const outerSlider = document.querySelector('#outerSlider');
  const locations = [...locationSlider.children];
  const outerPanels = [...outerSlider.children];
  const stores = document.querySelector('#storesContainer');
  return {
    token: window.__adrRotationToken,
    href: location.href,
    compact: Engine.useCompactLayout(),
    panelWidth: Engine.getPanelWidth(),
    responsivePanelWidth: Engine._responsivePanelWidth,
    documentClientWidth: document.documentElement.clientWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
    locationWidths: locations.map((item) => number(item.getBoundingClientRect().width)),
    locationSliderWidth: number(locationSlider.getBoundingClientRect().width),
    locationLeft: number(getComputedStyle(locationSlider).left),
    outerWidths: outerPanels.map((item) => number(item.getBoundingClientRect().width)),
    outerSliderWidth: number(outerSlider.getBoundingClientRect().width),
    outerLeft: number(getComputedStyle(outerSlider).left),
    storesParent: stores.parentElement && stores.parentElement.id,
    storesInlineRight: stores.style.right,
    storesInlineTop: stores.style.top,
    pendingFrame: Engine._responsiveLayoutFrame
  };
})()`;

test("A Dark Room keeps slider geometry and stores ownership across 390→844→390 in one document", async () => {
  const server = await staticServer();
  const profile = await mkdtemp(join(tmpdir(), "adr-responsive-audit-"));
  const port = await freePort();
  let chrome;
  let client;
  try {
    chrome = spawn(browserPath(), [
      "--headless=new",
      `--remote-debugging-port=${port}`,
      "--remote-debugging-address=127.0.0.1",
      `--user-data-dir=${profile}`,
      "--disable-background-networking",
      "--disable-default-apps",
      "--disable-extensions",
      "--disable-sync",
      "--mute-audio",
      "--no-default-browser-check",
      "--no-first-run",
      "--force-device-scale-factor=1",
      "about:blank"
    ], { stdio: ["ignore", "ignore", "pipe"], windowsHide: true });
    await getJson(`http://127.0.0.1:${port}/json/version`);
    const targets = await getJson(`http://127.0.0.1:${port}/json/list`);
    const page = targets.find((target) => target.type === "page");
    if (!page?.webSocketDebuggerUrl) throw new Error("Browser did not expose a page target");
    client = new CDP(page.webSocketDebuggerUrl);
    await client.connect();
    await client.send("Page.enable");
    await client.send("Runtime.enable");
    await setViewport(client, 390, 700);
    const targetUrl = `${server.origin}/games/a-dark-room/source/?ignorebrowser=true&lang=zh_cn`;
    const navigation = await client.send("Page.navigate", { url: targetUrl });
    assert.ok(navigation.loaderId, "initial navigation must create one document");
    await waitFor(client, "window.Engine && window.Room && document.querySelector('#storesContainer')", "game initialization");

    const token = await evaluate(client, `(() => {
      window.__adrRotationToken = 'same-document-' + Math.random().toString(16).slice(2);
      $('#header .headerButton').removeClass('selected');
      var tab = $('<div>').attr('id', 'location_outside').addClass('headerButton selected').text('outside').appendTo('#header');
      var panel = $('<div>').attr('id', 'outsidePanel').addClass('location').appendTo('#locationSlider');
      $('<div>').attr('id', 'village').css('height', '80px').appendTo(panel);
      var worldPanel = $('<div>').attr('id', 'worldPanel').addClass('location').appendTo('#outerSlider');
      Outside.tab = tab;
      Outside.panel = panel;
      World.panel = worldPanel;
      Engine.activeModule = World;
      Engine.syncResponsiveLayout();
      return window.__adrRotationToken;
    })()`);

    const portrait = await evaluate(client, snapshotExpression);
    assert.equal(portrait.compact, true);
    assert.equal(portrait.panelWidth, 374);
    assert.deepEqual(portrait.locationWidths, [374, 374]);
    assert.equal(portrait.locationSliderWidth, 748);
    assert.equal(portrait.locationLeft, -374);
    assert.deepEqual(portrait.outerWidths, [374, 374]);
    assert.equal(portrait.outerSliderWidth, 748);
    assert.equal(portrait.outerLeft, -374);
    assert.equal(portrait.storesParent, "outsidePanel");
    assert.equal(portrait.storesInlineRight, "");
    assert.equal(portrait.storesInlineTop, "");
    assert.equal(portrait.documentClientWidth, portrait.documentScrollWidth);

    await setViewport(client, 844, 390);
    await waitFor(
      client,
      "Engine._responsiveLayoutFrame === null && Engine._responsivePanelWidth === 700 && !Engine.useCompactLayout()",
      "desktop reflow"
    );
    const landscape = await evaluate(client, snapshotExpression);
    assert.equal(landscape.token, token);
    assert.equal(landscape.href, portrait.href);
    assert.equal(landscape.compact, false);
    assert.equal(landscape.panelWidth, 700);
    assert.deepEqual(landscape.locationWidths, [700, 700]);
    assert.equal(landscape.locationSliderWidth, 1400);
    assert.equal(landscape.locationLeft, -700);
    assert.deepEqual(landscape.outerWidths, [700, 700]);
    assert.equal(landscape.outerSliderWidth, 1400);
    assert.equal(landscape.outerLeft, -700);
    assert.equal(landscape.storesParent, "roomPanel");
    assert.equal(landscape.storesInlineRight, "-700px");
    assert.equal(landscape.storesInlineTop, "106px");

    await setViewport(client, 390, 700);
    await waitFor(
      client,
      "Engine._responsiveLayoutFrame === null && Engine._responsivePanelWidth === 374 && Engine.useCompactLayout()",
      "portrait reflow"
    );
    const portraitAgain = await evaluate(client, snapshotExpression);
    assert.equal(portraitAgain.token, token);
    assert.equal(portraitAgain.href, portrait.href);
    assert.equal(portraitAgain.compact, true);
    assert.equal(portraitAgain.panelWidth, 374);
    assert.deepEqual(portraitAgain.locationWidths, [374, 374]);
    assert.equal(portraitAgain.locationSliderWidth, 748);
    assert.equal(portraitAgain.locationLeft, -374);
    assert.deepEqual(portraitAgain.outerWidths, [374, 374]);
    assert.equal(portraitAgain.outerSliderWidth, 748);
    assert.equal(portraitAgain.outerLeft, -374);
    assert.equal(portraitAgain.storesParent, "outsidePanel");
    assert.equal(portraitAgain.storesInlineRight, "");
    assert.equal(portraitAgain.storesInlineTop, "");
    assert.equal(portraitAgain.documentClientWidth, portraitAgain.documentScrollWidth);
  } finally {
    client?.close();
    if (chrome?.exitCode === null) {
      const exited = new Promise((resolvePromise) => chrome.once("exit", resolvePromise));
      chrome.kill();
      await Promise.race([
        exited,
        new Promise((resolvePromise) => setTimeout(resolvePromise, 5000))
      ]);
    }
    await server.close();
    const tempPrefix = `${resolve(tmpdir())}${sep}`.toLowerCase();
    if (resolve(profile).toLowerCase().startsWith(tempPrefix)) {
      await rm(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    }
  }
});
