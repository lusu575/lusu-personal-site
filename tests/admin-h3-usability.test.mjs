import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { H3_STATES } from "../lib/minimax-h3/protocol.mjs";

const source = readFileSync(new URL("../admin/minimax-h3.js", import.meta.url), "utf8");

class Element {
  constructor() { this.children = []; this.dataset = {}; this.listeners = new Map(); this.textContent = ""; this.disabled = false; this.hidden = false; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  removeChild(child) { this.children = this.children.filter((item) => item !== child); }
  get firstChild() { return this.children[0]; }
  get childElementCount() { return this.children.length; }
  addEventListener(name, callback) { this.listeners.set(name, callback); }
  setAttribute(name, value) { this[name] = value; }
  removeAttribute(name) { delete this[name]; }
  querySelector(selector) { return this.children.find((item) => selector === `.${item.className}`) || null; }
  querySelectorAll() { return []; }
}

function createConsole(search = "?from=admin") {
  const nodes = new Map();
  for (const name of ["back", "live-summary", "job-form", "job-fieldset", "form-note", "form-message", "job-list", "project-title", "aspect", "preset", "prompt", "refresh", "checked-at", "next-steps", "guidance"]) nodes.set(`[data-h3-${name}]`, new Element());
  const cards = new Map(["runner", "controller", "comfy", "bridge", "disk", "jobs"].map((key) => {
    const card = new Element();
    card.dataset.h3Status = key;
    const state = new Element(); state.className = "h3-state";
    const detail = new Element();
    card.append(state, detail);
    card.querySelector = (selector) => selector === ".h3-state" ? state : detail;
    return [key, card];
  }));
  const root = new Element();
  root.querySelector = (selector) => nodes.get(selector);
  root.querySelectorAll = () => [...cards.values()];
  const responses = {
    runners: { runners: [], controlEnabled: false, transferEnabled: false },
    jobs: { jobs: [], controlEnabled: false }
  };
  let failure = 0;
  const requests = [];
  const context = vm.createContext({
    document: { querySelector: () => root, createElement: () => new Element(), referrer: "" },
    window: { location: { search, origin: "https://example.test" }, setTimeout, clearTimeout },
    URLSearchParams, URL, AbortController,
    fetch: async (url, options) => {
      requests.push({ url, method: options.method || "GET" });
      return { ok: !failure, status: failure || 200, json: async () => responses[url.includes("/runners") ? "runners" : "jobs"] };
    }
  });
  const instrumented = source.replace(/ {2}setFormEnabled\(false\);\s+void loadLiveStatus\(\);/, "globalThis.consoleTest = { loadLiveStatus, jobStateLabels }; setFormEnabled(false);");
  vm.runInContext(instrumented, context);
  return {
    ...context.consoleTest, nodes, cards, requests,
    setResponse(value) {
      responses.runners = { runners: value.runners || [], controlEnabled: value.controlEnabled === true, transferEnabled: value.transferEnabled === true };
      responses.jobs = { jobs: value.jobs || [], controlEnabled: value.controlEnabled === true };
    },
    setEndpointResponse(endpoint, value) { responses[endpoint] = value; },
    fail(status) { failure = status; }
  };
}

test("H3 offline refresh shows actionable dependency checks and never opens execution or sends POST", async () => {
  const ui = createConsole();
  await ui.loadLiveStatus();
  assert.equal(ui.nodes.get("[data-h3-job-fieldset]").disabled, true);
  assert.equal(ui.nodes.get("[data-h3-back]").href, "/admin/");
  assert.match(ui.nodes.get("[data-h3-guidance]").children.map((node) => node.textContent).join(" "), /家庭电脑.*GPU/);
  assert.ok(ui.requests.every((request) => request.method === "GET"));
});

test("H3 busy Runner is shown as busy instead of falsely offline, while new tasks remain disabled", async () => {
  const ui = createConsole("?from=tools");
  ui.setResponse({ runners: [{ readyState: "busy", runnerId: "fixture-runner", capabilities: { controllerDoctorOk: true, comfyReachable: true, diskState: "ok" } }], jobs: [], controlEnabled: true });
  await ui.loadLiveStatus();
  assert.equal(ui.cards.get("runner").dataset.state, "busy");
  assert.equal(ui.cards.get("comfy").dataset.state, "ready");
  assert.equal(ui.nodes.get("[data-h3-job-fieldset]").disabled, true);
  assert.equal(ui.nodes.get("[data-h3-back]").href, "/#resources");
});

test("H3 failed refresh revokes stale ready indicators and preserves form inputs", async () => {
  const ui = createConsole();
  ui.setResponse({ runners: [{ readyState: "ready", runnerId: "fixture-runner", capabilities: { controllerDoctorOk: true, comfyReachable: true } }], jobs: [], controlEnabled: true });
  await ui.loadLiveStatus();
  assert.equal(ui.nodes.get("[data-h3-job-fieldset]").disabled, false);
  ui.nodes.get("[data-h3-prompt]").value = "本地未提交输入";
  ui.fail(503);
  await ui.loadLiveStatus();
  assert.equal(ui.cards.get("runner").dataset.state, "unknown");
  assert.equal(ui.nodes.get("[data-h3-job-fieldset]").disabled, true);
  assert.equal(ui.nodes.get("[data-h3-prompt]").value, "本地未提交输入");
  assert.match(ui.nodes.get("[data-h3-live-summary]").textContent, /HTTP 503/);
  assert.equal(ui.nodes.get("[data-h3-refresh]").disabled, false);
});

test("H3 result downloads use only the transfer gate from the real runners response", async () => {
  const ui = createConsole();
  const jobs = [{ jobId: "fixture-job", state: "ready", result: { name: "fixture-result.mp4", bytes: 1024 } }];
  const downloadCount = () => ui.nodes.get("[data-h3-job-list]").children[0].children.filter((node) => node.className === "h3-secondary-button").length;
  ui.setEndpointResponse("runners", { runners: [], controlEnabled: false, transferEnabled: false });
  ui.setEndpointResponse("jobs", { jobs, controlEnabled: false, transferEnabled: true });
  await ui.loadLiveStatus();
  assert.equal(downloadCount(), 0);
  ui.setEndpointResponse("runners", { runners: [], controlEnabled: false, transferEnabled: true });
  ui.setEndpointResponse("jobs", { jobs, controlEnabled: false });
  await ui.loadLiveStatus();
  assert.equal(downloadCount(), 1);
  assert.equal(ui.nodes.get("[data-h3-job-fieldset]").disabled, true);
  assert.ok(ui.requests.every((request) => request.method === "GET"));
});

test("H3 translates every protocol job state and preserves unknown state codes as plain text", async () => {
  const ui = createConsole();
  assert.deepEqual(Object.keys(ui.jobStateLabels).sort(), [...H3_STATES].sort());
  const unknownState = "future-state<svg>";
  ui.setResponse({ jobs: [...H3_STATES, unknownState].map((state) => ({ jobId: `fixture-${state}`, state })) });
  await ui.loadLiveStatus();
  const jobs = ui.nodes.get("[data-h3-job-list]").children;
  H3_STATES.forEach((state, index) => {
    assert.equal(jobs[index].children[1].textContent, ui.jobStateLabels[state]);
  });
  const last = jobs.at(-1);
  assert.equal(last.children[1].textContent, "状态待确认");
  assert.ok(last.children[2].textContent.includes(`未识别状态代码：${unknownState}`));
});
