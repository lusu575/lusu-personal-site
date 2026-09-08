import assert from "node:assert/strict";
import test from "node:test";
import { createResourcesRoute } from "../../js/routes/resources.mjs";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

function harness(t, loadModule, open = async () => true) {
  const originalDocument = globalThis.document;
  t.after(() => { globalThis.document = originalDocument; });
  const element = (tagName = "div") => ({
    tagName, dataset: {}, disabled: false, attributes: {}, children: [], hidden: false, className: "",
    setAttribute(name, value) { this.attributes[name] = value; },
    append(...nodes) { nodes.forEach((node) => { node.parentNode = this; this.children.push(node); }); },
    appendChild(node) { this.append(node); },
    replaceChildren(...nodes) { this.children = []; this.append(...nodes); },
    classList: { add() {}, toggle() {} }
  });
  const button = Object.assign(element("button"), { dataset: { readyLabel: "Open", quickTransferOpen: "true" } });
  const status = Object.assign(element("p"), { hidden: true, textContent: "", dataset: { quickTransferStartStatus: "true" } });
  const list = element();
  const categories = element();
  list.append(button, status);
  const descendants = (node) => node.children.flatMap((child) => [child, ...descendants(child)]);
  const find = (key) => descendants(list).filter((node) => node.dataset[key]);
  globalThis.document = {
    documentElement: { lang: "zh" },
    querySelectorAll: (selector) => selector === "[data-quick-transfer-open]" ? find("quickTransferOpen") : find("quickTransferStartStatus"),
    getElementById: (id) => id === "resource-list" ? list : categories,
    createElement: element,
    createTextNode: (text) => Object.assign(element("text"), { textContent: text })
  };
  const calls = { imports: 0, creates: 0, opens: 0, enters: 0, leaves: 0, languages: [] };
  const loader = {
    setLanguage(value) { calls.languages.push(value); },
    routeEnter() { calls.enters += 1; },
    routeLeave() { calls.leaves += 1; },
    open() { calls.opens += 1; return open(); },
    close() {},
    lifecycleSnapshot: () => ({ initialized: true })
  };
  const module = { createQuickTransferLoader() { calls.creates += 1; return loader; } };
  const route = createResourcesRoute({
    content: { resources: [{ action: "quick-transfer", title: "Transfer", desc: "Share with another signed-in device.", details: "Technical security details", actionLabel: "Open", category: 0, version: "1.0.13" }] },
    activeFilters: { resources: "all" },
    safeResourceIconSrc: () => "",
    localText: (value) => String(value || ""),
    label: (key) => key === "resourceCategories" ? ["Tools"] : key,
    t: (key) => key,
    loadQuickTransferModule: () => { calls.imports += 1; return loadModule(module, calls.imports); }
  });
  return { transfer: route.quickTransfer, route, list, get button() { return find("quickTransferOpen")[0]; }, get status() { return find("quickTransferStartStatus")[0]; }, calls, module };
}

test("outer module import failure shows an actionable retry and a second attempt recovers", async (t) => {
  const firstImport = deferred();
  const h = harness(t, (module, count) => count === 1 ? firstImport.promise : Promise.resolve(module));
  h.transfer.routeEnter();
  const failed = h.transfer.open();
  assert.equal(h.button.disabled, true);
  assert.equal(h.button.attributes["aria-busy"], "true");
  assert.equal(h.status.textContent, "resourceStarting");
  firstImport.reject(new Error("module network failure"));
  assert.equal(await failed, false);
  assert.equal(h.button.disabled, false);
  assert.equal(h.button.textContent, "resourceRetry");
  assert.equal(h.status.textContent, "resourceStartFailed");
  assert.equal(h.status.hidden, false);
  assert.equal(await h.transfer.open(), true);
  assert.equal(h.calls.imports, 2);
  assert.equal(h.calls.creates, 1);
  assert.equal(h.calls.opens, 1);
  assert.equal(h.button.textContent, "Open");
  assert.equal(h.status.hidden, true);
});

test("repeated activation single-flights both module import and the in-progress opening", async (t) => {
  const imported = deferred();
  const opened = deferred();
  const openStarted = deferred();
  const h = harness(t, () => imported.promise, () => { openStarted.resolve(); return opened.promise; });
  h.transfer.routeEnter();
  const first = h.transfer.open();
  const second = h.transfer.open();
  assert.equal(first, second);
  imported.resolve(h.module);
  await openStarted.promise;
  assert.equal(h.transfer.open(), first);
  assert.equal(h.calls.imports, 1);
  assert.equal(h.calls.creates, 1);
  assert.equal(h.calls.opens, 1);
  h.transfer.setLanguage("ja");
  assert.equal(h.calls.languages.at(-1), "ja");
  opened.resolve(true);
  assert.equal(await first, true);
  assert.equal(h.button.disabled, false);
});

test("leaving during a failed import clears entry feedback and permits a clean return", async (t) => {
  const firstImport = deferred();
  const h = harness(t, (module, count) => count === 1 ? firstImport.promise : module);
  h.transfer.routeEnter();
  const loading = h.transfer.open();
  h.transfer.routeLeave();
  assert.equal(h.status.hidden, true);
  firstImport.reject(new Error("late module failure"));
  assert.equal(await loading, false);
  assert.equal(h.status.hidden, true);
  assert.equal(h.calls.opens, 0);
  h.transfer.routeEnter();
  assert.equal(await h.transfer.open(), true);
  assert.equal(h.calls.imports, 2);
});

test("an import finishing after leave and re-entry cannot open for the old activation", async (t) => {
  const imported = deferred();
  const h = harness(t, () => imported.promise);
  h.transfer.routeEnter();
  const oldActivation = h.transfer.open();
  h.transfer.routeLeave();
  h.transfer.routeEnter();
  h.transfer.setLanguage("en");
  const currentActivation = h.transfer.open();
  imported.resolve(h.module);
  assert.equal(await oldActivation, false);
  assert.equal(await currentActivation, true);
  assert.equal(h.calls.imports, 1);
  assert.equal(h.calls.opens, 1);
  assert.equal(h.calls.languages.at(-1), "en");
  assert.equal(h.status.hidden, true);
});

test("resource rerenders preserve pending launch controls and keep technical facts inside details", async (t) => {
  const imported = deferred();
  const h = harness(t, () => imported.promise);
  h.route.renderResources();
  h.transfer.routeEnter();
  const opening = h.transfer.open();
  const previousButton = h.button;
  h.transfer.setLanguage("ja");
  h.route.renderResources();
  assert.notEqual(h.button, previousButton);
  assert.equal(h.button.disabled, true);
  assert.equal(h.button.attributes["aria-busy"], "true");
  assert.equal(h.status.hidden, false);
  assert.equal(h.status.textContent, "resourceStarting");
  const card = h.list.children[0];
  const main = card.children[0];
  const details = main.children.find((node) => node.tagName === "details");
  assert.ok(details);
  assert.equal(details.children[0].tagName, "summary");
  assert.ok(details.children.some((node) => node.className === "resource-facts"));
  assert.ok(details.children.some((node) => node.className === "resource-details-copy"));
  imported.resolve(h.module);
  assert.equal(await opening, true);
  assert.equal(h.button.disabled, false);
});

test("inner asset failure returns control to the inner loader's retry without reimporting the facade", async (t) => {
  let canOpen = false;
  const h = harness(t, (module) => module, async () => canOpen);
  h.transfer.routeEnter();
  assert.equal(await h.transfer.open(), false);
  assert.equal(h.button.disabled, false);
  assert.equal(h.status.hidden, true, "the outer status must not cover the inner loader's error UI");
  canOpen = true;
  assert.equal(await h.transfer.open(), true);
  assert.equal(h.calls.imports, 1);
  assert.equal(h.calls.creates, 1);
  assert.equal(h.calls.opens, 2);
});
