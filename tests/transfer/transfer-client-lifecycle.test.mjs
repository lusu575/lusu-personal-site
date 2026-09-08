import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";
import vm from "node:vm";
import test from "node:test";

const source = readFileSync(new URL("../../js/transfer.js", import.meta.url), "utf8");
const event = { preventDefault() {} };
const settle = () => new Promise((resolve) => setImmediate(resolve));
const response = (value, status = 200) => ({ ok: status < 400, status, json: async () => value });

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

// Execute the complete production client. Only DOM and transport edges are faked;
// room transitions, encryption, retrying, queueing and callbacks remain real.
function clientHarness() {
  class Node extends EventTarget {
    constructor(tagName = "div") {
      super();
      Object.assign(this, { tagName: tagName.toUpperCase(), dataset: {}, style: {}, children: [], value: "", textContent: "", hidden: false, className: "", attributes: new Map(), isConnected: true });
      this.classList = { add() {}, remove() {}, toggle() {} };
    }
    append(...nodes) { nodes.forEach((node) => { node.remove?.(); node.parentNode = this; this.children.push(node); }); }
    replaceChildren(...nodes) { this.children.forEach((node) => { node.parentNode = null; }); this.children = []; this.append(...nodes); }
    remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter((node) => node !== this); this.parentNode = null; }
    setAttribute(name, value) { this.attributes.set(name, value); }
    removeAttribute(name) { this.attributes.delete(name); }
    focus() {}
    closest() { return null; }
    querySelectorAll(selector) {
      const matches = (node) => selector === "[data-transfer-task-id]" ? Boolean(node.dataset.transferTaskId)
        : selector.startsWith(".") ? node.className.split(" ").includes(selector.slice(1))
          : node.tagName === selector.toUpperCase();
      return this.children.flatMap((node) => [...(matches(node) ? [node] : []), ...node.querySelectorAll(selector)]);
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  }
  const nodes = new Map();
  const document = Object.assign(new Node("document"), {
    hidden: false,
    documentElement: { dataset: { uiShell: "desktop" }, lang: "zh" },
    getElementById(id) { if (!nodes.has(id)) nodes.set(id, new Node()); return nodes.get(id); },
    createElement: (tag) => new Node(tag),
    createTextNode: (text) => Object.assign(new Node("text"), { textContent: text }),
    body: new Node("body")
  });
  const timers = new Map();
  let timerId = 0;
  const window = Object.assign(new Node("window"), {
    setTimeout(fn, ms) { const id = ++timerId; timers.set(id, { fn, ms }); return id; },
    clearTimeout(id) { timers.delete(id); },
    requestAnimationFrame(fn) { return this.setTimeout(fn, 16); },
    cancelAnimationFrame(id) { this.clearTimeout(id); }
  });
  const storage = new Map();
  const requests = [];
  const xhrs = [];
  const transport = { handler: async (url) => response(url.endsWith("/config") ? config : { items: [], hasMore: false }) };
  const config = { r2Ready: true, user: { isAdmin: false }, normal: { maxFileBytes: 95 * 1024 * 1024, remaining24hBytes: 200000000, poolStatus: "green" } };
  class XHR {
    constructor() { this.upload = {}; this.headers = {}; this.aborted = false; }
    open(method, url) { this.method = method; this.url = url; }
    setRequestHeader(name, value) { this.headers[name] = value; }
    send(file) { this.file = file; xhrs.push(this); }
    abort() { this.aborted = true; this.onabort?.(); }
    complete() { this.status = 200; this.responseText = "{}"; this.onload(); }
  }
  const context = vm.createContext({
    window, document, navigator: { onLine: true }, crypto: webcrypto,
    TextEncoder, TextDecoder, Uint8Array, AbortController, Headers, URL, btoa, atob,
    XMLHttpRequest: XHR,
    sessionStorage: { setItem: (key, value) => storage.set(key, value), getItem: (key) => storage.get(key) },
    fetch: (url, options = {}) => { requests.push({ url, options }); return transport.handler(url, options); }
  });
  // Test-only access is injected in-memory; production exposes no private state.
  vm.runInContext(source.replace("  window.QuickTransfer = Object.freeze({", `
  window.testClient = { state, refs, activateRoomContext, captureRoomContext,
    leaveRoom, sendComposer, queueFiles, runMultipart, pauseTask, resumeTask,
    cancelTask, loadConfig, joinRoom, saveTasks, restoreTasks, delay };
  window.QuickTransfer = Object.freeze({`), context);
  window.QuickTransfer.routeEnter();
  window.QuickTransfer.init("zh");
  const client = window.testClient;
  client.state.config = config;
  function enter(roomKey = "room-a", key = null) {
    client.state.open = true;
    client.refs.app.hidden = false;
    client.refs.room.hidden = false;
    client.refs.roomEntry.hidden = true;
    client.activateRoomContext(roomKey, key);
  }
  function visibility(hidden) { document.hidden = hidden; document.dispatchEvent(new Event("visibilitychange")); }
  function file(name = "example.bin") { return { name, type: "application/octet-stream", size: 3, lastModified: 1, slice: () => new Uint8Array([1, 2, 3]) }; }
  function multipart() {
    const task = { localId: "multipart-task", idempotencyKey: "fixed-retry-key", filename: "large.bin", size: 3, lastModified: 1, file: file("large.bin"), roomKey: client.state.roomKey, roomGeneration: client.state.roomGeneration, status: "uploading", parts: [], uploaded: 0, multipart: true, startedAt: Date.now(), controllers: new Set() };
    client.state.tasks.set(task.localId, task);
    return task;
  }
  return { ...client, window, document, config, storage, requests, xhrs, transport, timers, enter, visibility, file, multipart };
}

test("leaving or closing a room clears private drafts before another room can submit", async () => {
  const h = clientHarness();
  h.enter();
  h.refs.textInput.value = "private draft from room A";
  h.state.composerRetry = { draft: h.refs.textInput.value, generation: h.state.roomGeneration, key: "retry-a" };
  h.refs.roomPassword.value = "private passphrase";
  h.leaveRoom();
  assert.equal(h.refs.textInput.value, "");
  assert.equal(h.refs.roomPassword.value, "");
  assert.equal(h.state.composerRetry, null);
  h.enter("room-b");
  await h.sendComposer(event);
  assert.equal(h.requests.length, 0, "empty room B composer must not post room A's draft");
  h.refs.textInput.value = "second private draft";
  h.window.QuickTransfer.close();
  assert.equal(h.refs.textInput.value, "");
  assert.ok(!JSON.stringify([...h.storage]).includes("private"));
});

test("an old encrypted send response cannot clear the new room's draft or post it", async () => {
  const h = clientHarness();
  const key = await webcrypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  h.enter("room-a", key);
  h.refs.textInput.value = "private A";
  const posted = deferred();
  const released = deferred();
  h.transport.handler = async (url, options) => {
    if (url.endsWith("/text")) { posted.resolve(JSON.parse(options.body)); return released.promise; }
    return response({ items: [] });
  };
  const sending = h.sendComposer(event);
  const payload = await posted.promise;
  assert.equal(payload.roomKey, "room-a");
  assert.ok(!payload.encryptedContent.includes("private A"));
  h.leaveRoom();
  h.enter("room-b", key);
  h.refs.textInput.value = "private B";
  released.resolve(response({}));
  await sending;
  assert.equal(h.refs.textInput.value, "private B");
  assert.equal(h.state.roomKey, "room-b");
  assert.equal(h.requests.length, 1);
});

test("background and foreground transitions keep simple uploads and their queue running", async () => {
  const h = clientHarness();
  h.enter();
  h.queueFiles([h.file("first.bin"), h.file("second.bin")]);
  assert.equal(h.xhrs.length, 1);
  const firstTask = [...h.state.tasks.values()][0];
  h.visibility(true);
  assert.equal(h.xhrs[0].aborted, false);
  assert.equal(firstTask.status, "uploading");
  h.xhrs[0].complete();
  await settle();
  assert.equal(firstTask.status, "complete");
  assert.equal(h.xhrs.length, 2, "a user-submitted queued file starts while hidden");
  assert.ok(h.requests.some(({ url }) => url.endsWith("/config")), "completion refresh uses the task's generation");
  h.visibility(false);
  assert.equal(h.xhrs[1].aborted, false);
  h.xhrs[1].complete();
  await settle();
  assert.ok([...h.state.tasks.values()].every((task) => task.status === "complete"));
});

test("manual pause remains paused across visibility and immediate resume waits for transport teardown", async () => {
  const h = clientHarness();
  h.enter();
  h.queueFiles([h.file()]);
  const task = [...h.state.tasks.values()][0];
  h.pauseTask(task);
  h.visibility(true);
  h.visibility(false);
  await settle();
  assert.equal(task.status, "paused");
  assert.equal(h.xhrs.length, 1);
  h.resumeTask(task);
  assert.equal(h.xhrs.length, 2);
  h.pauseTask(task);
  h.resumeTask(task);
  await settle();
  assert.equal(h.xhrs.length, 3, "a same-turn resume is not lost during abort settlement");
  assert.equal(task.status, "uploading");
  assert.equal(h.xhrs[0].headers["Idempotency-Key"], h.xhrs[2].headers["Idempotency-Key"]);
  await h.cancelTask(task);
  await settle();
  assert.equal(task.status, "cancelled");
  assert.equal(h.xhrs[2].aborted, true);
});

test("multipart init, part, completion and retry delay survive background transitions", async () => {
  const h = clientHarness();
  h.enter();
  const init = deferred();
  const partStarted = deferred();
  const part = deferred();
  const retriedPartStarted = deferred();
  const retriedPart = deferred();
  const completionStarted = deferred();
  const completion = deferred();
  let partAttempts = 0;
  h.transport.handler = (url, options) => {
    if (url.endsWith("/init")) return init.promise;
    if (url.includes("/part?")) {
      partAttempts += 1;
      if (partAttempts === 1) { partStarted.resolve(options.signal); return part.promise; }
      retriedPartStarted.resolve(options.signal);
      return retriedPart.promise;
    }
    if (url.endsWith("/complete")) { completionStarted.resolve(options.signal); return completion.promise; }
    return Promise.resolve(response({ items: [] }));
  };
  const task = h.multipart();
  const uploading = h.runMultipart(task);
  h.visibility(true);
  assert.equal(h.requests[0].options.signal.aborted, false);
  init.resolve(response({ sessionId: "session-a", partSizeBytes: 3, expectedParts: 1, expiresAt: new Date(Date.now() + 60000).toISOString() }));
  const partSignal = await partStarted.promise;
  h.visibility(false);
  h.visibility(true);
  assert.equal(partSignal.aborted, false);
  part.resolve(response({ error: "temporary network failure" }, 503));
  await settle();
  assert.equal(task.status, "retrying");
  const timer = [...h.timers.entries()].find(([, job]) => job.ms === 800);
  assert.ok(timer, "a transient part failure schedules bounded retry backoff");
  h.visibility(true);
  assert.ok(h.timers.has(timer[0]), "backgrounding does not discard retry backoff");
  h.timers.delete(timer[0]);
  timer[1].fn();
  const retriedSignal = await retriedPartStarted.promise;
  h.visibility(false);
  h.visibility(true);
  assert.equal(retriedSignal.aborted, false);
  retriedPart.resolve(response({ partNumber: 1, sizeBytes: 3, etag: "part-etag" }));
  const completionSignal = await completionStarted.promise;
  h.visibility(false);
  h.visibility(true);
  assert.equal(completionSignal.aborted, false);
  completion.resolve(response({}));
  await uploading;
  assert.equal(task.status, "complete");
  assert.equal(task.uploaded, 3);
  assert.equal(partAttempts, 2);
  assert.equal(h.requests.filter(({ url }) => url.endsWith("/complete")).length, 1);
});

test("closing while room derivation is in progress prevents a late join request", async () => {
  const h = clientHarness();
  h.enter();
  h.leaveRoom();
  h.refs.roomPassword.value = "test-only-passphrase";
  const joining = h.joinRoom(event);
  h.window.QuickTransfer.close();
  await joining;
  assert.equal(h.requests.length, 0);
  assert.equal(h.state.roomKey, "");
  assert.equal(h.refs.roomPassword.value, "");
});

test("a joined room's late list response cannot announce success or populate its successor", async () => {
  const h = clientHarness();
  h.enter();
  h.leaveRoom();
  h.refs.roomPassword.value = "test-only-passphrase";
  const listStarted = deferred();
  const list = deferred();
  h.transport.handler = (url) => {
    if (url.includes("/room/items")) { listStarted.resolve(); return list.promise; }
    return Promise.resolve(response({}));
  };
  const joining = h.joinRoom(event);
  await listStarted.promise;
  h.leaveRoom();
  h.enter("room-b");
  h.refs.feedback.textContent = "room B feedback";
  list.resolve(response({ items: [{ id: "old-room-item", createdAt: "2026-09-08T00:00:00Z" }] }));
  await joining;
  assert.equal(h.refs.feedback.textContent, "room B feedback");
  assert.equal(h.state.items.length, 0);
  assert.equal(h.state.roomKey, "room-b");
});

test("an old multipart initialization cleans up its own room without writing into a new room", async () => {
  const h = clientHarness();
  h.enter();
  const initialized = deferred();
  h.transport.handler = (url) => url.endsWith("/init") ? initialized.promise : Promise.resolve(response({}));
  const task = h.multipart();
  const uploading = h.runMultipart(task);
  h.leaveRoom();
  h.enter("room-b");
  h.refs.textInput.value = "room B remains private";
  initialized.resolve(response({ sessionId: "old-session", partSizeBytes: 3, expectedParts: 1 }));
  await uploading;
  await settle();
  assert.equal(h.state.tasks.size, 0);
  assert.equal(h.refs.textInput.value, "room B remains private");
  const abort = h.requests.find(({ url }) => url.endsWith("/abort"));
  assert.deepEqual(JSON.parse(abort.options.body), { roomKey: "room-a", sessionId: "old-session" });
  assert.ok(!h.requests.some(({ url }) => url.includes("/part?")));
});

test("stale account config cannot replace current room state and multipart metadata can be resumed", async () => {
  const h = clientHarness();
  h.enter();
  const configResult = deferred();
  h.transport.handler = () => configResult.promise;
  const loading = h.loadConfig();
  const task = h.multipart();
  Object.assign(task, { sessionId: "saved-session", expiresAt: new Date(Date.now() + 60000).toISOString(), partSizeBytes: 3, expectedParts: 1 });
  h.refs.textInput.value = "private draft";
  h.leaveRoom();
  h.enter("room-b");
  configResult.resolve(response({ error: "Signed out" }, 401));
  await loading;
  assert.equal(h.state.roomKey, "room-b");
  assert.equal(h.state.config, h.config);
  h.leaveRoom();
  h.enter("room-a");
  h.restoreTasks();
  const restored = h.state.tasks.get(task.localId);
  assert.ok(restored, "leaving another room must not erase saved resumable metadata");
  assert.equal(restored.status, "paused");
  assert.equal(restored.file, null);
  assert.equal(restored.roomGeneration, h.state.roomGeneration);
  assert.ok(!JSON.stringify([...h.storage]).includes("private draft"));
});
