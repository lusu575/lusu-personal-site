import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { translations } from "../js/core/i18n.mjs";
import { createChatroomRoute } from "../js/routes/chatroom.mjs";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

class FakeElement {
  constructor(documentNode, tagName, id = "") {
    this.ownerDocument = documentNode;
    this.tagName = tagName.toUpperCase();
    this.id = id;
    this.className = "";
    this.dataset = {};
    this.attributes = new Map();
    this.children = [];
    this.parentElement = null;
    this.hidden = false;
    this.disabled = false;
    this.checked = false;
    this.value = "";
    this.textContent = "";
    this.scrollTop = 0;
    this.scrollHeight = 0;
    this.classList = {
      add: (...names) => this.#setClasses([...this.#classes(), ...names]),
      contains: (name) => this.#classes().includes(name),
      toggle: (name, force) => {
        const names = new Set(this.#classes());
        const next = force === undefined ? !names.has(name) : Boolean(force);
        if (next) names.add(name);
        else names.delete(name);
        this.#setClasses([...names]);
        return next;
      }
    };
  }

  #classes() { return this.className.split(/\s+/).filter(Boolean); }
  #setClasses(names) { this.className = [...new Set(names)].join(" "); }

  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  removeAttribute(name) { this.attributes.delete(name); }

  append(...nodes) {
    for (const node of nodes) {
      if (node.parentElement) {
        node.parentElement.children = node.parentElement.children.filter((child) => child !== node);
      }
      node.parentElement = this;
      this.children.push(node);
    }
  }

  appendChild(node) { this.append(node); return node; }

  replaceChildren(...nodes) {
    for (const child of this.children) child.parentElement = null;
    this.children = [];
    this.append(...nodes);
  }

  focus() { this.ownerDocument.activeElement = this; }

  querySelector(selector) {
    return this.#descendants().find((node) => matches(node, selector)) || null;
  }

  #descendants() {
    return this.children.flatMap((child) => [child, ...child.#descendants()]);
  }
}

function matches(node, selector) {
  if (selector.startsWith(".")) return node.classList.contains(selector.slice(1));
  if (selector === "summary") return node.tagName === "SUMMARY";
  const dataI18n = selector.match(/^\[data-i18n="([^"]+)"\]$/);
  return dataI18n ? node.dataset.i18n === dataI18n[1] : false;
}

class FakeDocument {
  constructor() {
    this.elements = new Map();
    this.activeElement = null;
    this.hidden = false;
  }

  add(tag, id, className = "") {
    const element = new FakeElement(this, tag, id);
    element.className = className;
    if (id) this.elements.set(id, element);
    return element;
  }

  getElementById(id) { return this.elements.get(id) || null; }
  createElement(tag) { return new FakeElement(this, tag); }

  querySelector(selector) {
    if (selector === ".chatroom-window") return this.getElementById("chatroom-window");
    if (selector === ".chat-send-button") return this.getElementById("chat-send-button");
    return [...this.elements.values()].find((node) => matches(node, selector)) || null;
  }
}

function response(payload) {
  return { ok: true, status: 200, json: async () => payload };
}

function failedResponse(status = 500, payload = { error: "fixture failure" }) {
  return { ok: false, status, json: async () => payload };
}

function makeHarness(options = {}) {
  const documentNode = new FakeDocument();
  const windowElement = documentNode.add("div", "chatroom-window", "chatroom-window");
  const nickname = documentNode.add("strong", "chat-nickname-display");
  const roomLabel = documentNode.add("span", "chat-room-label");
  const roomToggle = documentNode.add("button", "chat-room-toggle");
  const syncStatus = documentNode.add("span", "chat-sync-status");
  const editNickname = documentNode.add("button", "chat-edit-nickname");
  const nicknameForm = documentNode.add("form", "chat-nickname-form", "chat-nickname-form");
  nicknameForm.hidden = true;
  const nicknameInput = documentNode.add("input", "chat-nickname-input");
  const nicknameCancel = documentNode.add("button", "chat-nickname-cancel");
  const nicknameError = documentNode.add("small", "chat-nickname-error");
  nicknameForm.append(nicknameInput, nicknameCancel, nicknameError);
  const privateForm = documentNode.add("form", "chat-private-room-form", "chat-private-room-panel");
  privateForm.hidden = true;
  const privateInput = documentNode.add("input", "chat-private-password");
  const privateSubmit = documentNode.add("button", "chat-private-room-submit");
  const privateCancel = documentNode.add("button", "chat-private-room-cancel");
  const privateError = documentNode.add("small", "chat-private-password-error");
  privateError.hidden = true;
  const privateHint = documentNode.add("small", "chat-private-room-hint");
  privateHint.dataset.i18n = "chatPrivateRoomHint";
  privateForm.append(privateInput, privateSubmit, privateCancel, privateError, privateHint);
  const log = documentNode.add("div", "chat-message-list", "chatroom-log");
  log.clientHeight = 100;
  const unreadButton = documentNode.add("button", "chat-unread-button", "chat-unread-button");
  unreadButton.hidden = true;
  const retryButton = documentNode.add("button", "chat-retry-button", "chat-retry-button");
  retryButton.hidden = true;
  const liveSummary = documentNode.add("p", "chat-live-summary");
  const form = documentNode.add("form", "chat-form", "chatroom-compose");
  const input = documentNode.add("textarea", "chat-message-input");
  const counter = documentNode.add("span", "chat-char-count");
  const sendButton = documentNode.add("button", "chat-send-button", "chat-send-button");
  form.append(input, counter, sendButton);
  const feedback = documentNode.add("span", "chat-feedback");
  const autoscroll = documentNode.add("input", "chat-autoscroll");
  autoscroll.checked = true;
  windowElement.append(nickname, editNickname, roomLabel, roomToggle, syncStatus, nicknameForm, privateForm, log, unreadButton, retryButton, liveSummary, form, feedback, autoscroll);

  const listeners = new Map();
  const abortController = new AbortController();
  const scope = {
    signal: abortController.signal,
    isActive: () => true,
    listen(element, type, handler) { listeners.set(`${element?.id || "document"}:${type}`, handler); },
    setTimeout() { return Symbol("timer"); },
    clearTimeout() {}
  };
  const post = deferred();
  const postBodies = [];
  let postCount = 0;
  let getCount = 0;
  let currentLang = "zh";
  const storage = new Map([
    ["lusu-chat-visitor-id", "visitor-audit"],
    ["lusu-chat-nickname", "AuditGuest"],
    ["lusu-chat-last-sent-at", "0"]
  ]);
  const routeFetch = async (_route, path, requestOptions = {}) => {
    if (path === "/api/chat/messages" && requestOptions.method === "POST") {
      postCount += 1;
      postBodies.push(JSON.parse(requestOptions.body));
      if (options.postMessage) return options.postMessage(postCount, path, requestOptions);
      return post.promise;
    }
    if (path.startsWith("/api/chat/messages")) {
      getCount += 1;
      if (options.getMessages) return options.getMessages(getCount, path, requestOptions);
      return response({ messages: [] });
    }
    throw new Error(`Unexpected Chat request: ${path}`);
  };
  const route = createChatroomRoute({
    t: (key) => translations[currentLang][key],
    getCurrentLang: () => currentLang,
    safeStorageGet: (key, fallback = "") => storage.get(key) ?? fallback,
    safeStorageSet: (key, value) => { storage.set(key, value); return true; },
    requestMobileFocusReveal() {},
    normalizeDateInput: (value) => value,
    formatZonedDateTime: () => "12:00",
    routeFetch,
    activeRouteScope: () => scope,
    isAbortError: (error) => error?.name === "AbortError"
  });
  return {
    documentNode,
    route,
    scope,
    listeners,
    post,
    postBodies,
    get postCount() { return postCount; },
    get getCount() { return getCount; },
    storage,
    setLang(lang) { currentLang = lang; },
    elements: {
      input, sendButton, form, counter, feedback, privateForm, privateInput, privateSubmit, privateCancel, privateError, privateHint,
      nickname, editNickname, nicknameForm, nicknameInput, nicknameCancel, nicknameError,
      log, unreadButton, retryButton, liveSummary, roomToggle, syncStatus, autoscroll
    }
  };
}

async function waitFor(check, label) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

test("Chat locks only the submit action and preserves focus plus a newer draft", async () => {
  const harness = makeHarness();
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  globalThis.document = harness.documentNode;
  globalThis.window = { crypto: globalThis.crypto, TextEncoder, TextDecoder };
  try {
    await harness.route.enter(harness.scope);
    const submit = harness.listeners.get("chat-form:submit");
    const inputHandler = harness.listeners.get("chat-message-input:input");
    harness.elements.input.value = "first message";
    harness.documentNode.activeElement = harness.elements.sendButton;
    const firstSend = submit({ preventDefault() {} });
    await waitFor(() => harness.postCount === 1, "first POST");

    assert.equal(harness.elements.sendButton.disabled, true);
    assert.equal(harness.elements.input.disabled, false);
    assert.equal(harness.elements.form.getAttribute("aria-busy"), "true");
    assert.equal(harness.documentNode.activeElement, harness.elements.input);

    harness.elements.input.value = "new unsent draft";
    inputHandler();
    await submit({ preventDefault() {} });
    assert.equal(harness.postCount, 1, "a second submit must not start another POST");
    assert.equal(harness.elements.input.value, "new unsent draft");

    harness.post.resolve(response({ message: null }));
    await firstSend;
    assert.equal(harness.elements.input.value, "new unsent draft");
    assert.equal(harness.elements.counter.textContent, String(Array.from("new unsent draft").length));
    assert.equal(harness.elements.sendButton.disabled, false);
    assert.equal(harness.elements.input.disabled, false);
    assert.equal(harness.elements.form.getAttribute("aria-busy"), "false");
    assert.equal(harness.documentNode.activeElement, harness.elements.input);
  } finally {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
  }
});

test("Chat clears only an unchanged submitted draft", async () => {
  const harness = makeHarness();
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  globalThis.document = harness.documentNode;
  globalThis.window = { crypto: globalThis.crypto, TextEncoder, TextDecoder };
  try {
    await harness.route.enter(harness.scope);
    harness.elements.input.value = "sent as-is";
    const sending = harness.listeners.get("chat-form:submit")({ preventDefault() {} });
    await waitFor(() => harness.postCount === 1, "unchanged-draft POST");
    harness.post.resolve(response({ message: null }));
    await sending;
    assert.equal(harness.elements.input.value, "");
    assert.equal(harness.elements.counter.textContent, "0");
  } finally {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
  }
});

test("Chat never clears a user-edited draft even when its final text matches the submitted text", async () => {
  const harness = makeHarness();
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  globalThis.document = harness.documentNode;
  globalThis.window = { crypto: globalThis.crypto, TextEncoder, TextDecoder };
  try {
    await harness.route.enter(harness.scope);
    const submit = harness.listeners.get("chat-form:submit");
    const inputHandler = harness.listeners.get("chat-message-input:input");
    harness.elements.input.value = "same visible text";
    const sending = submit({ preventDefault() {} });
    await waitFor(() => harness.postCount === 1, "same-text POST");
    harness.elements.input.value = "temporary edit";
    inputHandler();
    harness.elements.input.value = "same visible text";
    inputHandler();
    harness.post.resolve(response({ message: null }));
    await sending;
    assert.equal(harness.elements.input.value, "same visible text");
  } finally {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
  }
});

test("private-room safety disclosure remains reachable in zh, en, and ja", async () => {
  const harness = makeHarness();
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  globalThis.document = harness.documentNode;
  globalThis.window = { crypto: globalThis.crypto, TextEncoder, TextDecoder };
  try {
    await harness.route.enter(harness.scope);
    for (const lang of ["zh", "en", "ja"]) {
      harness.setLang(lang);
      harness.route.syncLanguage();
      const disclosure = harness.elements.privateForm.querySelector(".chat-private-safety");
      const summary = disclosure?.querySelector("summary");
      const hint = disclosure?.querySelector('[data-i18n="chatPrivateRoomHint"]');
      assert.ok(disclosure, `${lang} disclosure must exist`);
      const summaryLabel = `${translations[lang].chatPrivatePasswordLabel} · ${translations[lang].chatPrivatePasswordPlaceholder}`;
      assert.equal(summary?.textContent, "ⓘ");
      assert.equal(summary?.getAttribute("aria-label"), summaryLabel);
      assert.equal(summary?.getAttribute("title"), summaryLabel);
      assert.equal(hint?.textContent, translations[lang].chatPrivateRoomHint);
      assert.match(summaryLabel, /6|6文字/);
      assert.ok((hint?.textContent || "").length > 10);
    }
  } finally {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
  }
});

test("nickname editing uses a cancellable in-site form with trilingual validation and focus return", async () => {
  const harness = makeHarness();
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  globalThis.document = harness.documentNode;
  globalThis.window = { crypto: globalThis.crypto, TextEncoder, TextDecoder };
  try {
    await harness.route.enter(harness.scope);
    await harness.listeners.get("chat-edit-nickname:click")();
    assert.equal(harness.elements.nicknameForm.hidden, false);
    assert.equal(harness.elements.nicknameInput.value, "AuditGuest");
    assert.equal(harness.documentNode.activeElement, harness.elements.nicknameInput);

    harness.elements.nicknameInput.value = " ";
    harness.listeners.get("chat-nickname-form:submit")({ preventDefault() {} });
    assert.equal(harness.elements.nicknameError.textContent, translations.zh.chatNicknameInvalid);
    assert.equal(harness.elements.nicknameInput.getAttribute("aria-invalid"), "true");

    harness.setLang("ja");
    harness.route.syncLanguage();
    assert.equal(harness.elements.nicknameError.textContent, translations.ja.chatNicknameInvalid);

    harness.elements.nicknameInput.value = "新しい旅人";
    harness.listeners.get("chat-nickname-form:submit")({ preventDefault() {} });
    assert.equal(harness.elements.nicknameForm.hidden, true);
    assert.equal(harness.elements.nickname.textContent, "新しい旅人");
    assert.equal(harness.storage.get("lusu-chat-nickname"), "新しい旅人");
    assert.equal(harness.documentNode.activeElement, harness.elements.editNickname);

    await harness.listeners.get("chat-edit-nickname:click")();
    harness.listeners.get("chat-nickname-cancel:click")();
    assert.equal(harness.elements.nicknameForm.hidden, true);
    assert.equal(harness.documentNode.activeElement, harness.elements.editNickname);
  } finally {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
  }
});

test("history and new message batches announce once while distant readers get an unread return control", async () => {
  const messages = [
    { message_id: "m1", visitor_id: "other", nickname: "One", content: "hello", created_at: "2026-07-18T00:00:00Z" },
    { message_id: "m2", visitor_id: "other", nickname: "Two", content: "again", created_at: "2026-07-18T00:00:01Z" }
  ];
  const harness = makeHarness({
    getMessages(attempt) {
      if (attempt === 1) return response({ messages: [] });
      return response({ messages: [messages[attempt - 2]] });
    }
  });
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  globalThis.document = harness.documentNode;
  globalThis.window = { crypto: globalThis.crypto, TextEncoder, TextDecoder };
  try {
    harness.elements.log.scrollHeight = 500;
    await harness.route.enter(harness.scope);
    assert.equal(harness.elements.liveSummary.textContent, translations.zh.chatHistoryLoaded.replace("{count}", "0"));

    harness.elements.log.scrollTop = 100;
    harness.listeners.get("chat-message-list:scroll")();
    harness.listeners.get("document:visibilitychange")();
    await waitFor(() => harness.getCount === 2 && !harness.elements.unreadButton.hidden, "unread message");
    assert.equal(harness.elements.log.scrollTop, 100, "a reader more than 48px away must not be moved");
    assert.equal(harness.elements.unreadButton.textContent, translations.zh.chatUnreadMessages.replace("{count}", "1"));
    assert.equal(harness.elements.liveSummary.textContent, translations.zh.chatNewMessages.replace("{count}", "1"));

    harness.listeners.get("chat-unread-button:click")();
    assert.equal(harness.elements.log.scrollTop, 500);
    assert.equal(harness.elements.unreadButton.hidden, true);

    harness.elements.log.scrollTop = 360;
    harness.listeners.get("chat-message-list:scroll")();
    harness.listeners.get("document:visibilitychange")();
    await waitFor(() => harness.getCount === 3 && harness.elements.log.scrollTop === 500, "near-bottom message");
    assert.equal(harness.elements.log.scrollTop, 500, "a reader within 48px keeps following");
    assert.equal(harness.elements.unreadButton.hidden, true);
  } finally {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
  }
});

test("successful refresh clears stale sync errors without overwriting send results", async () => {
  const recoveryHarness = makeHarness({
    getMessages(attempt) {
      if (attempt === 1) throw new Error("offline fixture");
      return response({ messages: [] });
    }
  });
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  globalThis.document = recoveryHarness.documentNode;
  globalThis.window = { crypto: globalThis.crypto, TextEncoder, TextDecoder };
  try {
    await recoveryHarness.route.enter(recoveryHarness.scope);
    assert.equal(recoveryHarness.elements.feedback.textContent, translations.zh.chatLoadFailed);
    assert.equal(recoveryHarness.elements.feedback.classList.contains("is-error"), true);
    recoveryHarness.listeners.get("document:visibilitychange")();
    await waitFor(() => recoveryHarness.getCount === 2 && !recoveryHarness.elements.feedback.classList.contains("is-error"), "recovered refresh");
    assert.equal(recoveryHarness.elements.feedback.textContent, translations.zh.chatCooldownHint);
  } finally {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
  }

  const sendHarness = makeHarness({
    getMessages(attempt) {
      if (attempt > 1) throw new Error("poll failed after accepted send");
      return response({ messages: [] });
    },
    postMessage() { return response({ message: null }); }
  });
  globalThis.document = sendHarness.documentNode;
  globalThis.window = { crypto: globalThis.crypto, TextEncoder, TextDecoder };
  try {
    await sendHarness.route.enter(sendHarness.scope);
    sendHarness.elements.input.value = "accepted";
    await sendHarness.listeners.get("chat-form:submit")({ preventDefault() {} });
    assert.equal(sendHarness.elements.feedback.textContent, translations.zh.chatSent);
    assert.equal(sendHarness.elements.feedback.classList.contains("is-error"), false);
  } finally {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
  }
});

test("public and password rooms restore separate in-memory drafts and scroll positions", async () => {
  const harness = makeHarness();
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  globalThis.document = harness.documentNode;
  globalThis.window = { crypto: globalThis.crypto, TextEncoder, TextDecoder };
  try {
    harness.elements.log.scrollHeight = 500;
    await harness.route.enter(harness.scope);
    harness.elements.input.value = "public draft";
    harness.listeners.get("chat-message-input:input")();
    harness.elements.log.scrollTop = 123;
    harness.listeners.get("chat-message-list:scroll")();

    harness.elements.privateInput.value = "secret-room";
    await harness.listeners.get("chat-private-room-form:submit")({ preventDefault() {} });
    assert.equal(harness.elements.input.value, "");
    harness.elements.input.value = "private draft";
    harness.listeners.get("chat-message-input:input")();
    harness.elements.log.scrollTop = 333;
    harness.listeners.get("chat-message-list:scroll")();

    harness.listeners.get("chat-room-toggle:click")();
    await waitFor(() => harness.elements.input.value === "public draft" && harness.elements.log.scrollTop === 123, "public draft restoration");
    assert.equal(harness.elements.log.scrollTop, 123);

    harness.elements.privateInput.value = "secret-room";
    await harness.listeners.get("chat-private-room-form:submit")({ preventDefault() {} });
    assert.equal(harness.elements.input.value, "private draft");
    assert.equal(harness.elements.log.scrollTop, 333);
    assert.equal([...harness.storage.keys()].some((key) => /draft|password|room/i.test(key)), false);
  } finally {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
  }
});

test("a failed send keeps the exact draft and an explicit retry starts only one new request", async () => {
  const harness = makeHarness({
    postMessage(attempt) {
      if (attempt === 1) throw new Error("temporary send failure");
      return response({ message: null });
    }
  });
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  globalThis.document = harness.documentNode;
  globalThis.window = { crypto: globalThis.crypto, TextEncoder, TextDecoder };
  try {
    await harness.route.enter(harness.scope);
    harness.elements.input.value = "retry this exact draft";
    await harness.listeners.get("chat-form:submit")({ preventDefault() {} });
    assert.equal(harness.elements.input.value, "retry this exact draft");
    assert.equal(harness.elements.sendButton.disabled, false);
    assert.equal(harness.postCount, 1);

    await harness.listeners.get("chat-form:submit")({ preventDefault() {} });
    assert.equal(harness.postCount, 2, "one explicit retry creates one request, with no background replay");
    assert.equal(harness.postBodies[0].clientRequestId, harness.postBodies[1].clientRequestId);
    assert.equal(harness.elements.input.value, "");
  } finally {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
  }
});

test("private-room retry reuses the attempt id even though AES-GCM creates a new ciphertext", async () => {
  const harness = makeHarness({
    postMessage(attempt) {
      if (attempt === 1) throw new Error("response lost after commit");
      return response({ message: null, idempotentReplay: true });
    }
  });
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  globalThis.document = harness.documentNode;
  globalThis.window = { crypto: globalThis.crypto, TextEncoder, TextDecoder };
  try {
    await harness.route.enter(harness.scope);
    harness.elements.privateInput.value = "secret-room";
    await harness.listeners.get("chat-private-room-form:submit")({ preventDefault() {} });
    harness.elements.input.value = "same private draft";

    await harness.listeners.get("chat-form:submit")({ preventDefault() {} });
    await harness.listeners.get("chat-form:submit")({ preventDefault() {} });

    assert.equal(harness.postBodies.length, 2);
    assert.equal(harness.postBodies[0].clientRequestId, harness.postBodies[1].clientRequestId);
    assert.notEqual(harness.postBodies[0].encryptedContent, harness.postBodies[1].encryptedContent);
    assert.equal(harness.elements.input.value, "");
  } finally {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
  }
});

test("offline recovery refreshes but never replays a failed or pending POST", async () => {
  const harness = makeHarness();
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  globalThis.document = harness.documentNode;
  globalThis.window = { crypto: globalThis.crypto, TextEncoder, TextDecoder };
  try {
    await harness.route.enter(harness.scope);
    harness.elements.input.value = "pending";
    const sending = harness.listeners.get("chat-form:submit")({ preventDefault() {} });
    await waitFor(() => harness.postCount === 1, "pending POST");
    harness.listeners.get("document:offline")();
    assert.equal(harness.elements.syncStatus.textContent, translations.zh.chatSyncOffline);
    await harness.listeners.get("document:online")();
    assert.equal(harness.postCount, 1, "reconnect must only refresh and never replay the POST");
    harness.post.resolve(response({ message: null }));
    await sending;
  } finally {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
  }
});

test("online plus a failed refresh stays reconnecting until manual retry succeeds", async () => {
  const harness = makeHarness({
    getMessages(attempt) {
      if (attempt === 2) return failedResponse(500);
      return response({ messages: [] });
    }
  });
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  globalThis.document = harness.documentNode;
  globalThis.window = { crypto: globalThis.crypto, TextEncoder, TextDecoder };
  try {
    await harness.route.enter(harness.scope);
    await harness.listeners.get("document:online")();
    assert.equal(harness.elements.syncStatus.dataset.connectionState, "reconnecting");
    assert.equal(harness.elements.syncStatus.textContent, translations.zh.chatSyncReconnecting);
    assert.equal(harness.elements.retryButton.hidden, false);
    assert.equal(harness.elements.feedback.textContent, translations.zh.chatLoadFailed);

    await harness.listeners.get("chat-retry-button:click")();
    assert.equal(harness.getCount, 3);
    assert.equal(harness.elements.syncStatus.dataset.connectionState, "online");
    assert.equal(harness.elements.retryButton.hidden, true);
    assert.equal(harness.documentNode.activeElement, harness.elements.input);
  } finally {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
  }
});

test("private-room switching is single-flight and exposes a real busy state", async () => {
  const privateHistory = deferred();
  const harness = makeHarness({
    getMessages(attempt) {
      if (attempt === 2) return privateHistory.promise;
      return response({ messages: [] });
    }
  });
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  globalThis.document = harness.documentNode;
  globalThis.window = { crypto: globalThis.crypto, TextEncoder, TextDecoder };
  try {
    await harness.route.enter(harness.scope);
    harness.elements.privateInput.value = "secret-room";
    const submit = harness.listeners.get("chat-private-room-form:submit");
    const firstSwitch = submit({ preventDefault() {} });
    await waitFor(() => harness.getCount === 2, "private history request");
    const duplicateSwitch = submit({ preventDefault() {} });
    await duplicateSwitch;

    assert.equal(harness.getCount, 2, "duplicate submit must not start a second history request");
    assert.equal(harness.elements.privateForm.getAttribute("aria-busy"), "true");
    assert.equal(harness.elements.privateInput.disabled, true);
    assert.equal(harness.elements.privateSubmit.disabled, true);
    assert.equal(harness.elements.privateCancel.disabled, true);
    assert.equal(harness.elements.roomToggle.disabled, true);
    assert.equal(harness.elements.feedback.textContent, translations.zh.chatPrivateRoomBusy);

    privateHistory.resolve(response({ messages: [] }));
    await firstSwitch;
    assert.equal(harness.elements.privateForm.getAttribute("aria-busy"), "false");
    assert.equal(harness.elements.roomToggle.disabled, false);
    assert.equal(harness.elements.feedback.textContent, translations.zh.chatPrivateRoomReady);
  } finally {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
  }
});

test("private-room validation is field-linked and history failure is never announced as ready", async () => {
  const harness = makeHarness({
    getMessages(attempt) {
      if (attempt === 2) return failedResponse(500);
      return response({ messages: [] });
    }
  });
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  globalThis.document = harness.documentNode;
  globalThis.window = { crypto: globalThis.crypto, TextEncoder, TextDecoder };
  try {
    await harness.route.enter(harness.scope);
    const submit = harness.listeners.get("chat-private-room-form:submit");
    harness.elements.privateInput.value = "short";
    await submit({ preventDefault() {} });
    assert.equal(harness.elements.privateInput.getAttribute("aria-invalid"), "true");
    assert.equal(harness.elements.privateInput.getAttribute("aria-errormessage"), "chat-private-password-error");
    assert.equal(harness.elements.privateError.hidden, false);
    assert.equal(harness.elements.privateError.textContent, translations.zh.chatPrivatePasswordError);

    harness.elements.privateInput.value = "secret-room";
    harness.listeners.get("chat-private-password:input")();
    assert.equal(harness.elements.privateInput.getAttribute("aria-invalid"), null);
    await submit({ preventDefault() {} });
    assert.equal(harness.elements.feedback.textContent, translations.zh.chatPrivateRoomLoadFailed);
    assert.notEqual(harness.elements.feedback.textContent, translations.zh.chatPrivateRoomReady);
    assert.equal(harness.elements.retryButton.hidden, false);
  } finally {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
  }
});

test("Chat route CSS keeps the disclosure touch target and does not hide its mobile safety copy", async () => {
  const css = await readFile(new URL("../css/routes/chatroom.css", import.meta.url), "utf8");
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const source = await readFile(new URL("../js/routes/chatroom.mjs", import.meta.url), "utf8");
  assert.match(css, /\.chat-private-actions\s*\{[\s\S]*?display:\s*inline-flex;/);
  assert.match(css, /\.chat-private-safety summary\s*\{[\s\S]*?min-height:\s*44px;/);
  assert.match(css, /\.chat-private-room-panel:has\(\.chat-private-safety\[open\]\)\s*\{[\s\S]*?padding-bottom:/);
  assert.match(css, /html\[data-ui-shell="mobile"\] \.chat-private-room-panel \.chat-private-safety\[open\] > small\s*\{[\s\S]*?display:\s*block;/);
  assert.match(css, /\.chat-send-button:disabled\s*\{/);
  assert.match(css, /\.chat-send-button\s*\{[\s\S]*?min-width:\s*96px;[\s\S]*?font-size:\s*14px;/);
  assert.match(css, /\.chat-unread-button\s*\{[\s\S]*?min-height:\s*44px;/);
  assert.match(css, /html\[data-ui-shell="mobile"\] #chat-feedback\s*\{[\s\S]*?text-overflow:\s*clip;[\s\S]*?white-space:\s*normal;/);
  assert.match(html, /id="chat-message-list"[^>]*role="log"[^>]*aria-live="off"/);
  assert.match(html, /id="chat-live-summary"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.doesNotMatch(source, /window\.prompt\s*\(/);
  assert.match(source, /const chatRoomSessions = new Map\(\);/);
});
