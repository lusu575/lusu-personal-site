import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, join, sep, extname } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
const timeoutMs = 15000;
class CDP {
  constructor(url) { this.url = url; this.id = 1; this.pending = new Map(); this.listeners = new Map(); }
  async connect() {
    this.socket = new WebSocket(this.url);
    await new Promise((ok, fail) => { this.socket.addEventListener("open", ok, { once: true }); this.socket.addEventListener("error", () => fail(new Error("CDP connection failed")), { once: true }); });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (!message.id) {
        for (const listener of this.listeners.get(message.method) || []) listener(message.params || {});
        return;
      }
      const job = this.pending.get(message.id);
      if (!job) return; this.pending.delete(message.id); clearTimeout(job.timer);
      if (message.error) job.fail(new Error(`${job.method}: ${message.error.message}`)); else job.ok(message.result || {});
    });
  }
  send(method, params = {}) {
    const id = this.id++;
    return new Promise((ok, fail) => {
      const timer = setTimeout(() => { this.pending.delete(id); fail(new Error(`${method} timed out`)); }, timeoutMs);
      this.pending.set(id, { method, ok, fail, timer }); this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  on(method, listener) {
    const listeners = this.listeners.get(method) || new Set();
    listeners.add(listener); this.listeners.set(method, listeners);
    return () => { listeners.delete(listener); if (!listeners.size) this.listeners.delete(method); };
  }
  close() { for (const job of this.pending.values()) { clearTimeout(job.timer); job.fail(new Error("CDP closed")); } this.pending.clear(); this.socket?.close(); }
}


export async function openIsolatedKittens(t, options = {}) {
  const chrome = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(existsSync);
  assert.ok(chrome, "A real Chrome/Edge executable is required");
  const root = resolve(options.root || "games/kittens-game/source");
  const server = createServer(async (req, res) => {
    try {
      const name = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
      const path = resolve(root, "." + (name === "/" ? "/index.html" : name));
      if (!path.startsWith(root + sep)) { res.writeHead(403).end(); return; }
      const bytes = await readFile(path);
      const type = { ".js": "text/javascript", ".mjs": "text/javascript", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".json": "application/json", ".html": "text/html", ".css": "text/css" }[extname(path)] || "application/octet-stream";
      res.writeHead(200, { "Content-Type": type }); res.end(bytes);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  t.after(() => new Promise(r => server.close(r)));
  const profile = await mkdtemp(join(tmpdir(), "lusu-kittens-test-"));
  const process = spawn(chrome, ["--headless=new", "--remote-debugging-port=0", "--remote-debugging-address=127.0.0.1", `--user-data-dir=${profile}`, "--no-first-run", "--disable-background-networking", "about:blank"], { windowsHide: true, stdio: "ignore" });
  let cdp;
  t.after(async () => {
    cdp?.close(); process.kill();
    await new Promise(r => setTimeout(r, 500));
    if (!resolve(profile).startsWith(resolve(tmpdir()) + sep)) throw new Error("Unsafe test profile path");
    await rm(profile, { recursive: true, force: true, maxRetries: 2 });
  });
  let port;
  for (let i=0;i<80;i++) {
    try { port = Number((await readFile(join(profile, "DevToolsActivePort"), "utf8")).split("\n")[0]); break; } catch { await new Promise(r => setTimeout(r,100)); }
  }
  assert.ok(port, "Browser debugging endpoint did not start");
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  cdp = new CDP(targets.find(x => x.type === "page").webSocketDebuggerUrl); await cdp.connect();
  await cdp.send("Page.navigate", { url: `http://127.0.0.1:${server.address().port}/${options.path || ""}` });
  const evaluate = async expression => {
    const r = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  for(let i=0;i<150;i++) { if(await evaluate(options.ready || "!!globalThis.gamePage?.bld?.buildingsData")) break; await new Promise(r=>setTimeout(r,100)); }
  return { evaluate, send: (method, params) => cdp.send(method, params) };
}
