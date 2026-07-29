#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, resolve, sep } from "node:path";

const TIMEOUT_MS = 30_000;

function parseArgs(argv) {
  const options = {
    width: 1440,
    height: 900,
    waitMs: 3_000,
    targetText: "",
    selector: "",
    offsetY: 72,
    removeSelectors: []
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1];
    if (argument === "--url") options.url = value;
    else if (argument === "--output") options.output = value;
    else if (argument === "--width") options.width = Number(value);
    else if (argument === "--height") options.height = Number(value);
    else if (argument === "--wait-ms") options.waitMs = Number(value);
    else if (argument === "--target-text") options.targetText = value;
    else if (argument === "--selector") options.selector = value;
    else if (argument === "--offset-y") options.offsetY = Number(value);
    else if (argument === "--remove-selector") options.removeSelectors.push(value);
    else throw new Error(`Unknown argument: ${argument}`);
    index += 1;
  }

  if (!options.url || !options.output) {
    throw new Error("Usage: capture-official-web.mjs --url <public URL> --output <png> [--target-text <text> | --selector <selector>]");
  }
  const parsedUrl = new URL(options.url);
  if (parsedUrl.protocol !== "https:") {
    throw new Error("Only public HTTPS pages can be captured.");
  }
  if (!Number.isInteger(options.width) || options.width < 800 || options.width > 2560) {
    throw new Error("--width must be an integer between 800 and 2560.");
  }
  if (!Number.isInteger(options.height) || options.height < 600 || options.height > 1800) {
    throw new Error("--height must be an integer between 600 and 1800.");
  }
  if (!Number.isInteger(options.waitMs) || options.waitMs < 0 || options.waitMs > 15_000) {
    throw new Error("--wait-ms must be an integer between 0 and 15000.");
  }
  if (!Number.isFinite(options.offsetY) || options.offsetY < 0 || options.offsetY > options.height / 2) {
    throw new Error("--offset-y must be between 0 and half the viewport height.");
  }

  options.output = resolve(options.output);
  return options;
}

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    process.env.PROGRAMFILES && `${process.env.PROGRAMFILES}\\Google\\Chrome\\Application\\chrome.exe`,
    process.env["PROGRAMFILES(X86)"] && `${process.env["PROGRAMFILES(X86)"]}\\Google\\Chrome\\Application\\chrome.exe`,
    process.env.LOCALAPPDATA && `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
    process.env.PROGRAMFILES && `${process.env.PROGRAMFILES}\\Microsoft\\Edge\\Application\\msedge.exe`,
    process.env["PROGRAMFILES(X86)"] && `${process.env["PROGRAMFILES(X86)"]}\\Microsoft\\Edge\\Application\\msedge.exe`
  ].filter(Boolean);
  const executable = candidates.find((candidate) => existsSync(candidate));
  if (!executable) throw new Error("Chrome or Edge was not found.");
  return executable;
}

async function freePort() {
  const server = createServer();
  await new Promise((resolvePromise, rejectPromise) => {
    server.once("error", rejectPromise);
    server.listen(0, "127.0.0.1", resolvePromise);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not reserve a CDP port.");
  await new Promise((resolvePromise) => server.close(resolvePromise));
  return address.port;
}

async function fetchJsonWithRetry(url) {
  const startedAt = Date.now();
  let lastError;
  while (Date.now() - startedAt < TIMEOUT_MS) {
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

class CdpClient {
  constructor(url) {
    this.url = url;
    this.id = 1;
    this.pending = new Map();
    this.listeners = new Map();
  }

  async connect() {
    this.socket = new WebSocket(this.url);
    await new Promise((resolvePromise, rejectPromise) => {
      this.socket.addEventListener("open", resolvePromise, { once: true });
      this.socket.addEventListener("error", () => rejectPromise(new Error("CDP connection failed.")), { once: true });
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (!message.id) {
        for (const listener of this.listeners.get(message.method) || []) listener(message.params || {});
        return;
      }
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      clearTimeout(pending.timer);
      if (message.error) pending.reject(new Error(`${pending.method}: ${message.error.message}`));
      else pending.resolve(message.result || {});
    });
  }

  send(method, params = {}) {
    const id = this.id++;
    return new Promise((resolvePromise, rejectPromise) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        rejectPromise(new Error(`${method} timed out.`));
      }, TIMEOUT_MS);
      this.pending.set(id, { method, resolve: resolvePromise, reject: rejectPromise, timer });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  on(method, listener) {
    const listeners = this.listeners.get(method) || new Set();
    listeners.add(listener);
    this.listeners.set(method, listeners);
    return () => listeners.delete(listener);
  }

  close() {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error("CDP connection closed."));
    }
    this.pending.clear();
    this.socket?.close();
  }
}

async function launchChrome(executable) {
  const port = await freePort();
  const profile = await mkdtemp(resolve(tmpdir(), "tool-radar-official-capture-"));
  const child = spawn(executable, [
    "--headless=new",
    `--remote-debugging-port=${port}`,
    "--remote-debugging-address=127.0.0.1",
    `--user-data-dir=${profile}`,
    "--disable-background-networking",
    "--disable-default-apps",
    "--disable-extensions",
    "--disable-sync",
    "--metrics-recording-only",
    "--mute-audio",
    "--no-default-browser-check",
    "--no-first-run",
    "--force-device-scale-factor=1",
    "about:blank"
  ], {
    stdio: ["ignore", "ignore", "pipe"],
    windowsHide: true
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr = `${stderr}${chunk}`.slice(-8_000);
  });
  try {
    await fetchJsonWithRetry(`http://127.0.0.1:${port}/json/version`);
    const targets = await fetchJsonWithRetry(`http://127.0.0.1:${port}/json/list`);
    const page = targets.find((target) => target.type === "page");
    if (!page?.webSocketDebuggerUrl) throw new Error("Chrome did not expose a page target.");
    return { child, profile, socketUrl: page.webSocketDebuggerUrl };
  } catch (error) {
    child.kill();
    await rm(profile, { recursive: true, force: true });
    throw new Error(`${error.message}\n${stderr}`);
  }
}

async function stopChrome(chrome) {
  if (!chrome) return;
  if (chrome.child.exitCode === null) {
    chrome.child.kill();
    await Promise.race([
      new Promise((resolvePromise) => chrome.child.once("exit", resolvePromise)),
      new Promise((resolvePromise) => setTimeout(resolvePromise, 5_000))
    ]);
  }
  const resolvedProfile = resolve(chrome.profile);
  const tempPrefix = `${resolve(tmpdir())}${sep}`.toLowerCase();
  if (!resolvedProfile.toLowerCase().startsWith(tempPrefix)) {
    throw new Error(`Refusing to remove non-temporary Chrome profile: ${resolvedProfile}`);
  }
  await rm(resolvedProfile, { recursive: true, force: true, maxRetries: 3, retryDelay: 150 });
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

async function waitForLoad(client) {
  let loaded = false;
  const stopListening = client.on("Page.loadEventFired", () => {
    loaded = true;
  });
  const startedAt = Date.now();
  while (!loaded && Date.now() - startedAt < TIMEOUT_MS) {
    const readyState = await evaluate(client, "document.readyState").catch(() => "");
    if (readyState === "complete") break;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
  stopListening();
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const executable = findChrome();
  let chrome;
  let client;
  try {
    chrome = await launchChrome(executable);
    client = new CdpClient(chrome.socketUrl);
    await client.connect();
    await Promise.all([
      client.send("Page.enable"),
      client.send("Runtime.enable"),
      client.send("Network.enable")
    ]);
    await client.send("Emulation.setDeviceMetricsOverride", {
      width: options.width,
      height: options.height,
      deviceScaleFactor: 1,
      mobile: false
    });
    await client.send("Page.navigate", { url: options.url });
    await waitForLoad(client);
    if (options.waitMs) {
      await new Promise((resolvePromise) => setTimeout(resolvePromise, options.waitMs));
    }

    const target = await evaluate(client, `(() => {
      const selector = ${JSON.stringify(options.selector)};
      const targetText = ${JSON.stringify(options.targetText)};
      const visible = (node) => {
        if (!(node instanceof Element)) return false;
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0 && rect.width > 1 && rect.height > 1;
      };
      let node = selector ? document.querySelector(selector) : null;
      if (!node && targetText) {
        const candidates = [...document.querySelectorAll("h1,h2,h3,h4,p,a,button,div,span")]
          .filter((candidate) => visible(candidate) && (candidate.textContent || "").trim().includes(targetText))
          .sort((left, right) => (left.textContent || "").trim().length - (right.textContent || "").trim().length);
        node = candidates[0] || null;
      }
      if ((selector || targetText) && !node) {
        return { ok:false, title:document.title, finalUrl:location.href, reason:"target-not-found" };
      }
      if (node) {
        node.scrollIntoView({ block:"start", inline:"nearest" });
        scrollBy(0, -${JSON.stringify(options.offsetY)});
      } else {
        scrollTo(0, 0);
      }
      for (const removeSelector of ${JSON.stringify(options.removeSelectors)}) {
        for (const removable of document.querySelectorAll(removeSelector)) removable.remove();
      }
      const style = document.createElement("style");
      style.dataset.toolRadarCapture = "true";
      style.textContent = [
        "html{scroll-behavior:auto!important}",
        "*,*::before,*::after{animation-play-state:paused!important;caret-color:transparent!important}",
        "[data-tool-radar-capture-hide]{display:none!important}"
      ].join("");
      document.head.append(style);
      return {
        ok:true,
        title:document.title,
        finalUrl:location.href,
        targetTag:node?.tagName || null,
        targetText:(node?.textContent || "").trim().slice(0, 300),
        scrollX,
        scrollY
      };
    })()`);
    if (!target.ok) {
      throw new Error(`Capture target was not found: ${options.selector || options.targetText}`);
    }

    await evaluate(client, `new Promise((resolvePromise) => requestAnimationFrame(() => requestAnimationFrame(resolvePromise)))`);
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
    const screenshot = await client.send("Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
      captureBeyondViewport: false
    });
    const bytes = Buffer.from(screenshot.data, "base64");
    await mkdir(dirname(options.output), { recursive: true });
    await writeFile(options.output, bytes);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const metadataPath = `${options.output}.source.json`;
    await writeFile(metadataPath, `${JSON.stringify({
      schemaVersion: 1,
      sourceType: "official-public-editorial-capture",
      sourceUrl: options.url,
      finalUrl: target.finalUrl,
      pageTitle: target.title,
      capturedAt: new Date().toISOString(),
      anonymousFreshProfile: true,
      viewport: { width: options.width, height: options.height, deviceScaleFactor: 1 },
      target: {
        selector: options.selector || null,
        text: options.targetText || null,
        matchedTag: target.targetTag,
        matchedText: target.targetText || null,
        offsetY: options.offsetY
      },
      removedSelectors: options.removeSelectors,
      file: options.output,
      bytes: (await readFile(options.output)).byteLength,
      sha256
    }, null, 2)}\n`, "utf8");
    console.log(JSON.stringify({
      output: options.output,
      metadata: metadataPath,
      pageTitle: target.title,
      finalUrl: target.finalUrl,
      sha256
    }, null, 2));
  } finally {
    if (client) {
      await Promise.race([
        client.send("Browser.close").catch(() => {}),
        new Promise((resolvePromise) => setTimeout(resolvePromise, 2_000))
      ]);
      client.close();
    }
    await stopChrome(chrome);
  }
}

main().catch((error) => {
  console.error(`capture-official-web: ${error.message}`);
  process.exitCode = 1;
});
