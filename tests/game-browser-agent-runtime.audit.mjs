import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { extname, resolve, sep } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const knownGames = ["2048", "hextris", "a-dark-room", "life-restart"];
const timeoutMs = 45_000;
const requested = process.argv.slice(2);
const games = requested.length ? requested : knownGames;
games.forEach((gameId) => assert.ok(knownGames.includes(gameId), `unknown game: ${gameId}`));
const missingPaths = [];

const chrome = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
].filter(Boolean).find(existsSync);
assert.ok(chrome, "Chrome or Edge is required for the browser game runtime audit");

const mime = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".ttf", "font/ttf"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"]
]);

const server = createServer((request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url || "/", "http://127.0.0.1").pathname);
    let target = resolve(root, `.${pathname}`);
    if (target !== root && !target.startsWith(`${root}${sep}`)) throw new Error("path escape");
    if (statSync(target).isDirectory()) target = resolve(target, "index.html");
    const body = readFileSync(target);
    response.writeHead(200, {
      "cache-control": "no-store",
      "content-length": body.byteLength,
      "content-type": mime.get(extname(target).toLowerCase()) || "application/octet-stream"
    });
    response.end(body);
  } catch {
    missingPaths.push(request?.url || "(unknown)");
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
});

class CDP {
  constructor(url) {
    this.url = url;
    this.nextId = 1;
    this.pending = new Map();
  }

  async connect() {
    this.socket = new WebSocket(this.url);
    await new Promise((resolveOpen, reject) => {
      this.socket.addEventListener("open", resolveOpen, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      clearTimeout(pending.timer);
      if (message.error) pending.reject(new Error(`${pending.method}: ${message.error.message}`));
      else pending.resolve(message.result || {});
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolveSend, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method} timed out`));
      }, timeoutMs);
      this.pending.set(id, { method, reject, resolve: resolveSend, timer });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.socket?.close();
  }
}

await new Promise((resolveListen, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolveListen);
});

const address = server.address();
assert.ok(address && typeof address === "object");

try {
  for (const gameId of games) {
    const profile = mkdtempSync(resolve(tmpdir(), `lusu-game-audit-${gameId}-`));
    const debuggingPort = await freePort();
    let browser;
    let client;
    try {
      const url = `http://127.0.0.1:${address.port}/tests/fixtures/game-browser-agent-runtime.html?game=${encodeURIComponent(gameId)}`;
      browser = spawn(chrome, [
        "--headless=new",
        `--remote-debugging-port=${debuggingPort}`,
        "--remote-debugging-address=127.0.0.1",
        "--disable-background-networking",
        "--disable-default-apps",
        "--disable-extensions",
        "--disable-sync",
        "--mute-audio",
        "--no-default-browser-check",
        "--no-first-run",
        `--user-data-dir=${profile}`,
        "about:blank"
      ], { stdio: ["ignore", "ignore", "pipe"], windowsHide: true });
      await getJson(`http://127.0.0.1:${debuggingPort}/json/version`);
      const targets = await getJson(`http://127.0.0.1:${debuggingPort}/json/list`);
      const page = targets.find((target) => target.type === "page");
      assert.ok(page?.webSocketDebuggerUrl, `${gameId} browser page target is unavailable`);
      client = new CDP(page.webSocketDebuggerUrl);
      await client.connect();
      await client.send("Page.enable");
      await client.send("Runtime.enable");
      await client.send("Page.navigate", { url });
      const result = await waitForResult(client, gameId);
      assert.equal(result.ok, true, `${gameId} runtime failed: ${result.code || "RUNTIME_ERROR"} ${result.error || ""}; missing=${missingPaths.slice(-20).join(",")}`);
      assert.equal(result.gameId, gameId);
      assert.equal(result.providerFrozen, true);
      assert.equal(result.actionIdOpaque, true);
      assert.equal(result.resultStatus, "applied");
      console.log(`${gameId}: ${result.semanticId} applied (revision ${result.controlledRevision} -> ${result.afterRevision})`);
    } finally {
      client?.close();
      if (browser?.exitCode === null) {
        const exited = new Promise((resolveExit) => browser.once("exit", resolveExit));
        browser.kill();
        await Promise.race([exited, new Promise((resolveWait) => setTimeout(resolveWait, 5000))]);
      }
      rmSync(profile, { force: true, recursive: true });
    }
  }
  await auditShellRelayLifecycle(address.port);
} finally {
  await new Promise((resolveClose) => server.close(resolveClose));
}

async function freePort() {
  const reservation = createServer();
  await new Promise((resolveListen, reject) => {
    reservation.once("error", reject);
    reservation.listen(0, "127.0.0.1", resolveListen);
  });
  const reservationAddress = reservation.address();
  assert.ok(reservationAddress && typeof reservationAddress === "object");
  await new Promise((resolveClose) => reservation.close(resolveClose));
  return reservationAddress.port;
}

async function auditShellRelayLifecycle(serverPort) {
  const profile = mkdtempSync(resolve(tmpdir(), "lusu-game-shell-audit-"));
  const debuggingPort = await freePort();
  let browser;
  let client;
  try {
    browser = spawn(chrome, [
      "--headless=new",
      `--remote-debugging-port=${debuggingPort}`,
      "--remote-debugging-address=127.0.0.1",
      "--disable-background-networking",
      "--disable-default-apps",
      "--disable-extensions",
      "--disable-sync",
      "--mute-audio",
      "--no-default-browser-check",
      "--no-first-run",
      `--user-data-dir=${profile}`,
      "about:blank"
    ], { stdio: ["ignore", "ignore", "pipe"], windowsHide: true });
    await getJson(`http://127.0.0.1:${debuggingPort}/json/version`);
    const targets = await getJson(`http://127.0.0.1:${debuggingPort}/json/list`);
    const page = targets.find((target) => target.type === "page");
    assert.ok(page?.webSocketDebuggerUrl, "game shell browser page target is unavailable");
    client = new CDP(page.webSocketDebuggerUrl);
    await client.connect();
    await client.send("Page.enable");
    await client.send("Runtime.enable");
    await client.send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true,
      screenWidth: 390,
      screenHeight: 844
    });
    await client.send("Page.addScriptToEvaluateOnNewDocument", { source: `(() => {
      class FakeWebSocket extends EventTarget {
        static CONNECTING = 0;
        static OPEN = 1;
        static CLOSING = 2;
        static CLOSED = 3;
        constructor(url, protocols) {
          super();
          this.url = String(url);
          this.protocols = Array.from(protocols || []);
          this.readyState = FakeWebSocket.CONNECTING;
          this.messages = [];
          window.__lusuFakeGameSocket = this;
          queueMicrotask(() => {
            this.readyState = FakeWebSocket.OPEN;
            this.dispatchEvent(new Event('open'));
          });
        }
        send(value) { this.messages.push(JSON.parse(String(value))); }
        close() {
          if (this.readyState === FakeWebSocket.CLOSED) return;
          this.readyState = FakeWebSocket.CLOSED;
          this.dispatchEvent(new Event('close'));
        }
        server(message) {
          this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(message) }));
        }
        serverClose() {
          this.readyState = FakeWebSocket.CLOSED;
          this.dispatchEvent(new Event('close'));
        }
      }
      Object.defineProperty(window, 'WebSocket', { configurable: false, value: FakeWebSocket });
    })();` });
    await client.send("Page.navigate", {
      url: `http://127.0.0.1:${serverPort}/games/2048/index.html?lang=en`
    });
    const result = await evaluate(client, `(async () => {
      const wait = async (predicate, label) => {
        const deadline = Date.now() + 30000;
        while (Date.now() < deadline) {
          if (predicate()) return;
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        throw new Error('timeout:' + label);
      };
      await wait(() => document.querySelector('.game-agent-allow')?.disabled === false, 'agent-ready');
      const frame = document.querySelector('#game-frame');
      const panel = document.querySelector('.game-agent-panel');
      const code = document.querySelector('.game-agent-code-box code');
      document.querySelector('.game-agent-allow').click();
      await wait(() => window.__lusuFakeGameSocket?.messages.some((item) => item.type === 'hello'), 'hello');
      const socket = window.__lusuFakeGameSocket;
      const codeBeforeAck = code.textContent;
      const hello = socket.messages.find((item) => item.type === 'hello');
      socket.server({
        type: 'relay_ready',
        protocolVersion: 1,
        sessionId: 'relay_session_0001',
        state: 'awaiting_pair',
        pairExpiresAt: new Date(Date.now() + 300000).toISOString()
      });
      await wait(() => code.textContent.length > 0, 'pair-code');
      const codeAfterAck = code.textContent;
      socket.server({ type: 'controller_connected', protocolVersion: 1, sessionId: 'relay_session_0001' });
      await wait(() => frame.inert === true && panel.dataset.state === 'active', 'active');
      const snapshot = [...socket.messages].reverse().find((item) => item.type === 'snapshot');
      const action = snapshot.actions.find((item) => item.requiresConfirmation !== true);
      socket.server({
        type: 'action',
        protocolVersion: 1,
        commandId: 'cmd_action_000001',
        expectedRevision: snapshot.revision,
        clientActionId: 'client.action:1',
        actionId: action.actionId
      });
      await wait(() => socket.messages.some((item) => item.type === 'action_result' && item.commandId === 'cmd_action_000001'), 'action-result');
      const actionResult = socket.messages.find((item) => item.type === 'action_result' && item.commandId === 'cmd_action_000001');
      const beforePauseCount = socket.messages.length;
      socket.server({ type: 'pause', protocolVersion: 1, commandId: 'cmd_pause_0000001' });
      await wait(() => panel.dataset.state === 'paused' && frame.inert === false, 'remote-pause');
      const pauseOutbound = socket.messages.slice(beforePauseCount);
      document.querySelector('.game-agent-resume').click();
      await wait(() => panel.dataset.state === 'active' && frame.inert === true && socket.messages.some((item) => item.type === 'user_resume'), 'user-resume');
      const resume = [...socket.messages].reverse().find((item) => item.type === 'user_resume');
      socket.serverClose();
      await wait(() => panel.dataset.state === 'ready' && frame.inert === false, 'disconnect-unlock');
      const panelRect = panel.getBoundingClientRect();
      const controls = [...panel.querySelectorAll('.game-agent-controls .tool-button')];
      return {
        socketUrl: socket.url,
        protocols: socket.protocols,
        pairCodeBeforeAck: codeBeforeAck,
        pairCodeAfterAck: codeAfterAck,
        hello,
        actionResult,
        pauseOutbound,
        resume,
        disconnectedUnlocked: !frame.inert && !frame.hasAttribute('aria-disabled'),
        panelState: panel.dataset.state,
        layout: {
          viewportWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
          panelLeft: panelRect.left,
          panelRight: panelRect.right,
          minControlHeight: Math.min(...controls.map((item) => item.getBoundingClientRect().height))
        }
      };
    })()`);
    const socketUrl = new URL(result.socketUrl);
    assert.equal(socketUrl.pathname, "/mcp/browser-games/connect");
    assert.equal(socketUrl.search, "");
    assert.deepEqual(result.protocols.slice(0, 1), ["lusu-game-v1"]);
    assert.match(result.protocols[1], /^pair\.[A-Z2-7]{26}$/);
    assert.equal(result.pairCodeBeforeAck, "");
    assert.match(result.pairCodeAfterAck, /^[A-Z2-7]{5}(?:-[A-Z2-7]{5}){3}-[A-Z2-7]{6}$/);
    assert.equal(result.hello.gameId, "2048");
    assert.equal(result.actionResult.ok, true);
    assert.equal(result.actionResult.actionResult.status, "applied");
    assert.ok(result.actionResult.observation && Array.isArray(result.actionResult.actions));
    assert.deepEqual(result.pauseOutbound, [], "remote pause must not send an untracked commandId snapshot");
    assert.ok(result.resume && Array.isArray(result.resume.actions));
    assert.equal(result.disconnectedUnlocked, true);
    assert.equal(result.panelState, "ready");
    assert.ok(result.layout.scrollWidth <= result.layout.viewportWidth + 1);
    assert.ok(result.layout.panelLeft >= -1 && result.layout.panelRight <= result.layout.viewportWidth + 1);
    assert.ok(result.layout.minControlHeight >= 44);
    console.log("game-shell: action, pause/resume, disconnect unlock, pair privacy, and 390px layout passed");
  } finally {
    client?.close();
    if (browser?.exitCode === null) {
      const exited = new Promise((resolveExit) => browser.once("exit", resolveExit));
      browser.kill();
      await Promise.race([exited, new Promise((resolveWait) => setTimeout(resolveWait, 5000))]);
    }
    rmSync(profile, { force: true, recursive: true });
  }
}

async function getJson(url) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (response.ok) return response.json();
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError?.message || "unknown error"}`);
}

async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  }
  return result.result?.value;
}

async function waitForResult(client, gameId) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const text = await evaluate(client, "document.querySelector('#result')?.textContent || ''").catch(() => "");
    if (text && text !== "pending") return JSON.parse(text);
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error(`${gameId} runtime result timed out`);
}
