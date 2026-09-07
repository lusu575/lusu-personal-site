import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { createManagementWorkbench, managementListUrl } from "../admin/management-workbench.mjs";

const deferred = () => { let resolve; let reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
class Node {
  constructor(tag) { this.tag = tag; this.children = []; this.listeners = new Map(); this.attributes = {}; this.value = ""; this.textContent = ""; }
  setAttribute(key, value) { this.attributes[key] = value; }
  append(...nodes) { for (const node of nodes) { if (typeof node === "object") node.parent = this; this.children.push(node); } }
  before(node) { node.parent = this.parent; this.parent.children.splice(this.parent.children.indexOf(this), 0, node); }
  after(node) { node.parent = this.parent; this.parent.children.splice(this.parent.children.indexOf(this) + 1, 0, node); }
  addEventListener(type, listener) { this.listeners.set(type, listener); }
  emit(type) { return this.listeners.get(type)?.({ currentTarget: this }); }
}
function setup(t, config, extras = {}) {
  const list = new Node("list"); const parent = new Node("section"); parent.append(list);
  const oldDocument = globalThis.document;
  globalThis.document = { getElementById: (id) => id === "list" ? list : null, createElement: (tag) => new Node(tag) };
  t.after(() => { globalThis.document = oldDocument; });
  const errors = [];
  const workbench = createManagementWorkbench({ items: { label: "记录", panel: "chat", listId: "list", endpoint: "/api/admin/items", ...config } }, { guard: async () => true, reportError: (error) => errors.push(error), ...extras });
  const controls = parent.children.find((node) => node.className === "management-pagination");
  return { workbench, controls, previous: controls.children[0], info: controls.children[1], next: controls.children[2], errors, parent };
}

test("offset pagination traverses whiteboard pages without inventing a total or disabling page two", async (t) => {
  let fixture;
  fixture = setup(t, { offsetMode: true, load: async () => { const read = fixture.workbench.begin("items"); assert.equal(new URL(read.url, "https://example.test").searchParams.get("offset"), "50"); read.accept({ rooms: [], pagination: { limit: 50, offset: 50, hasMore: false } }); read.finish(); } });
  fixture.workbench.accept("items", { pagination: { limit: 50, offset: 0, hasMore: true } });
  assert.equal(fixture.next.disabled, false);
  assert.equal(await fixture.next.emit("click"), true);
  assert.match(fixture.info.textContent, /^第 2 页/);
  assert.doesNotMatch(fixture.info.textContent, /\/ 1 页|共 0/);
  assert.equal(fixture.previous.disabled, false);
  assert.equal(fixture.next.disabled, true);
});

test("failed page reads restore the accepted page and allow a successful retry", async (t) => {
  let fixture; let failure = true;
  fixture = setup(t, { load: async () => { const read = fixture.workbench.begin("items"); try { if (failure) throw new Error("offline"); read.accept({ pagination: { page: 3, pageSize: 50, total: 150, hasMore: false } }); } catch (error) { read.finish(error); throw error; } finally { read.finish(); } } });
  fixture.workbench.accept("items", { pagination: { page: 2, pageSize: 50, total: 150, hasMore: true } });
  assert.equal(await fixture.next.emit("click"), false);
  assert.equal(new URL(fixture.workbench.query("items"), "https://example.test").searchParams.get("page"), "2");
  assert.equal(fixture.previous.disabled, false);
  assert.equal(fixture.next.disabled, false);
  assert.match(fixture.info.textContent, /第 2.*读取失败.*保留上次结果/);
  assert.equal(fixture.errors.length, 1);
  failure = false;
  assert.equal(await fixture.next.emit("click"), true);
  assert.match(fixture.info.textContent, /^第 3 \/ 3 页/);
});

test("pager locks before the asynchronous unsaved guard to prevent double submission", async (t) => {
  const confirmation = deferred(); let guards = 0; let reads = 0;
  const fixture = setup(t, { load: async () => { reads += 1; } }, { guard: () => { guards += 1; return confirmation.promise; } });
  fixture.workbench.accept("items", { total: 120, pagination: { page: 1, pageSize: 50 } });
  const first = fixture.next.emit("click");
  assert.equal(fixture.next.disabled, true);
  assert.equal(await fixture.next.emit("click"), false);
  assert.equal(guards, 1);
  confirmation.resolve(true);
  await first;
  assert.equal(reads, 1);
});

test("a search typed during an active read runs once afterward using the latest text", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let query = "initial"; let fixture; const loaded = deferred(); const seen = [];
  fixture = setup(t, { query: () => query, load: async () => { const read = fixture.workbench.begin("items"); seen.push(new URL(read.url, "https://example.test").searchParams.get("q")); read.accept({ total: 1, pagination: { page: 1, pageSize: 50 } }); read.finish(); loaded.resolve(); } });
  const active = fixture.workbench.begin("items");
  query = "first draft"; fixture.workbench.schedule("items"); t.mock.timers.tick(350);
  query = "最终搜索"; fixture.workbench.schedule("items"); t.mock.timers.tick(350);
  assert.deepEqual(seen, []);
  active.accept({ total: 100, pagination: { page: 2, pageSize: 50 } }); active.finish();
  await loaded.promise;
  assert.deepEqual(seen, ["最终搜索"]);
});

test("stale refresh responses cannot alter the accepted pagination or release a newer read", (t) => {
  const fixture = setup(t, { load: async () => {} });
  const old = fixture.workbench.begin("items"); const current = fixture.workbench.begin("items");
  assert.equal(old.accept({ total: 900, pagination: { page: 9, pageSize: 50 } }), false);
  old.finish();
  assert.equal(fixture.controls.attributes["aria-busy"], "true");
  current.accept({ total: 12, pagination: { page: 1, pageSize: 50 } }); current.finish();
  old.finish(new Error("late failure"));
  assert.match(fixture.info.textContent, /共 12 条/);
  assert.doesNotMatch(fixture.info.textContent, /失败|900/);
  assert.equal(fixture.controls.attributes["aria-busy"], "false");
});

test("a rejected status filter returns to the last accepted selection and page", async (t) => {
  const fixture = setup(t, { filterKey: "role", options: [["", "全部"], ["admin", "管理员"]], load: async () => assert.fail("cancelled filter cannot read") }, { guard: async () => false });
  fixture.workbench.accept("items", { total: 160, pagination: { page: 2, pageSize: 50 } });
  const filter = fixture.parent.children.find((node) => node.className === "management-filter").children[1];
  filter.value = "admin";
  await filter.emit("change");
  assert.equal(filter.value, "");
  assert.equal(filter.disabled, false);
  assert.equal(fixture.next.disabled, false);
  assert.match(fixture.info.textContent, /第 2.*筛选尚未应用/);
});

const source = readFileSync(new URL("../admin/admin.js", import.meta.url), "utf8");
function functionSource(name) {
  const match = new RegExp(`(?:async )?function ${name}\\(`).exec(source);
  assert.ok(match, name);
  const rest = source.slice(match.index + match[0].length);
  const next = /\n(?:async )?function \w+\(/.exec(rest);
  return source.slice(match.index, next ? match.index + match[0].length + next.index : undefined);
}

test("late account list results cannot replace newer pages or clear an independently edited account", async () => {
  const old = deferred(); let count = 0; let renders = 0;
  const detail = { account: { id: "editing", updated_at: "original-revision" } };
  const context = vm.createContext({ state: { selectedAccountId: "editing", accountDetail: detail, accounts: [] }, managementWorkbench: null, api: () => ++count === 1 ? old.promise : Promise.resolve({ accounts: [{ id: "new-page" }] }), renderAccountSummary() {}, renderAccountList() { renders += 1; } });
  vm.runInContext(`${functionSource("loadAccounts")}\nthis.load = loadAccounts;`, context);
  const first = context.load(); await context.load(); old.resolve({ accounts: [{ id: "old-page" }] }); await first;
  assert.equal(context.state.accounts[0].id, "new-page");
  assert.equal(context.state.accountDetail, detail);
  assert.equal(context.state.selectedAccountId, "editing");
  assert.equal(renders, 1);
});

test("chat pagination retains the selected snapshot and its CAS revision outside the visible page", async () => {
  const old = deferred(); let count = 0; let renders = 0;
  const editing = { message_id: "editing", updated_at: "original-revision", content: "saved text" };
  const context = vm.createContext({ state: { selectedMessageId: "editing", chatEditingMessage: editing, chatUpdatedAt: "original-revision", chatMessages: [editing] }, managementWorkbench: null, $: () => ({ checked: true }), api: () => ++count === 1 ? old.promise : Promise.resolve({ messages: [{ message_id: "new-page" }] }), syncChatActionState() {}, renderChatMessages() { renders += 1; } });
  vm.runInContext(`${functionSource("selectedChatMessage")}\n${functionSource("loadChatMessages")}\nthis.load = loadChatMessages; this.selected = selectedChatMessage;`, context);
  const first = context.load(); await context.load(); old.resolve({ messages: [{ message_id: "editing", updated_at: "newer-server-revision" }] }); await first;
  assert.equal(context.state.chatMessages[0].message_id, "new-page");
  assert.equal(context.selected(), editing);
  assert.equal(context.state.chatUpdatedAt, "original-revision");
  assert.equal(context.state.chatMessagesLoading, false);
  assert.equal(renders, 1);
});

test("invalid page input remains a finite bounded request", () => {
  const url = new URL(managementListUrl("/items", { page: NaN, pageSize: -3, query: "日本語 & filters" }), "https://example.test");
  assert.equal(url.searchParams.get("page"), "1");
  assert.equal(url.searchParams.get("pageSize"), "1");
  assert.equal(url.searchParams.get("q"), "日本語 & filters");
});

test("an obsolete failed read cannot turn a newer successful account page into an error", async () => {
  const old = deferred(); let count = 0;
  const context = vm.createContext({ state: { accounts: [] }, managementWorkbench: null, api: () => ++count === 1 ? old.promise : Promise.resolve({ accounts: [{ id: "current-page" }] }), renderAccountSummary() {}, renderAccountList() {} });
  vm.runInContext(`${functionSource("loadAccounts")}\nthis.load = loadAccounts;`, context);
  const first = context.load(); await context.load(); old.reject(new Error("late network failure"));
  assert.equal(await first, false);
  assert.equal(context.state.accounts[0].id, "current-page");
});

function chatMutationContext({ includeHidden = false } = {}) {
  const snapshot = { message_id: "m1", nickname: "旧昵称", content: "旧正文", hidden: 0, updated_at: "r1" };
  const row = { ...snapshot };
  const checkbox = { checked: includeHidden };
  const form = { elements: { nickname: { value: "新昵称" }, content: { value: "新正文" } } };
  const requests = []; const status = {}; let revision = 1;
  const context = vm.createContext({
    state: { selectedMessageId: "m1", chatEditingMessage: snapshot, chatMessages: [row], chatUpdatedAt: "r1", chatListGeneration: 3 },
    $: (selector) => selector === "#include-hidden-chat" ? checkbox : selector === "#chat-form-admin" ? form : status,
    setChatActionBusy(mode) { context.state.chatActionBusy = Boolean(mode); },
    isEncryptedChatMessage: () => false,
    api: async (path, options) => { requests.push({ path, ...options, body: JSON.parse(options.body) }); assert.equal(options.method, "PUT"); return { updatedAt: `r${++revision}` }; },
    captureEditorBaseline() {}, renderChatMessages() {}, syncChatActionState() {}, refreshEditorDirtyState() {},
    setElementText: (node, text) => { node.textContent = text; },
    confirmEditorCanLeave: async () => true,
    showChatActionError: (error) => assert.fail(error.message)
  });
  vm.runInContext(`${functionSource("selectedChatMessage")}\n${functionSource("syncSavedChatMessage")}\n${functionSource("saveChatMessage")}\n${functionSource("toggleChatHidden")}\nthis.save = saveChatMessage; this.toggle = toggleChatHidden;`, context);
  return { context, row, snapshot, requests, checkbox };
}

test("successful chat edits update both the editing snapshot and the selectable row revision", async () => {
  const fixture = chatMutationContext();
  assert.equal(await fixture.context.save(), true);
  assert.equal(fixture.row.nickname, "新昵称");
  assert.equal(fixture.row.content, "新正文");
  assert.equal(fixture.row.hidden, 0);
  assert.equal(fixture.row.updated_at, "r2");
  assert.deepEqual(fixture.row, fixture.snapshot);
  assert.equal(fixture.context.state.chatUpdatedAt, fixture.row.updated_at);
  assert.equal(fixture.requests.length, 1);
  assert.equal(fixture.requests[0].body.expectedUpdatedAt, "r1");
});

test("hiding a message removes it from a visible-only page but keeps the revision for restore", async () => {
  const fixture = chatMutationContext();
  await fixture.context.toggle();
  assert.equal(fixture.context.state.chatMessages.length, 0);
  assert.equal(fixture.row.hidden, 1);
  assert.equal(fixture.row.updated_at, "r2");
  assert.equal(fixture.context.state.chatEditingMessage, fixture.snapshot);
  assert.equal(fixture.snapshot.hidden, 1);
  assert.equal(fixture.context.state.chatUpdatedAt, "r2");
  await fixture.context.toggle();
  assert.equal(fixture.requests[1].body.expectedUpdatedAt, "r2");
  assert.equal(fixture.context.state.chatMessages[0].updated_at, "r3");
  assert.equal(fixture.context.state.chatMessages[0].hidden, 0);
  assert.equal(fixture.context.state.chatMessages[0].message_id, "m1");
});

test("hiding while hidden records are included keeps the row and snapshot in sync", async () => {
  const fixture = chatMutationContext({ includeHidden: true });
  await fixture.context.toggle();
  assert.equal(fixture.context.state.chatMessages.length, 1);
  assert.equal(fixture.row.hidden, 1);
  assert.equal(fixture.row.updated_at, "r2");
  assert.deepEqual(fixture.row, fixture.snapshot);
});

test("a failed include-hidden read restores the checkbox without replacing saved list or detail", async () => {
  const checkbox = { checked: true, disabled: false }; const rows = [{ message_id: "m1" }]; const detail = { message_id: "m1", updated_at: "r1" }; const errors = [];
  const context = vm.createContext({
    state: { chatAcceptedIncludeHidden: false, chatMessages: rows, chatEditingMessage: detail },
    isChatFilterBusy: () => false,
    confirmEditorCanLeave: async () => true,
    managementWorkbench: { reset: () => {} },
    loadChatMessages: async () => { throw new Error("offline"); },
    showChatActionError: (error) => errors.push(error.message)
  });
  vm.runInContext(`${functionSource("changeChatIncludeHidden")}\nthis.change = changeChatIncludeHidden;`, context);
  assert.equal(await context.change({ currentTarget: checkbox }), false);
  assert.equal(checkbox.checked, false);
  assert.equal(checkbox.disabled, false);
  assert.equal(context.state.chatMessages, rows);
  assert.equal(context.state.chatEditingMessage, detail);
  assert.match(errors[0], /已保留原筛选和列表/);
});
