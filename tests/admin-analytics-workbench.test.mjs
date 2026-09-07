import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const helperSource = readFileSync(new URL("../admin/analytics-workbench.js", import.meta.url), "utf8");
const adminSource = readFileSync(new URL("../admin/admin.js", import.meta.url), "utf8");
const functionSource = (name) => {
  const match = adminSource.match(new RegExp(`function ${name}\\([^]*?\\n\\}`));
  assert.ok(match, `missing production function ${name}`);
  return match[0];
};
const load = (extra = {}) => {
  const sandbox = vm.createContext({ Intl, Date, ...extra });
  sandbox.window = sandbox;
  vm.runInContext(helperSource, sandbox);
  return sandbox;
};
const plain = (value) => JSON.parse(JSON.stringify(value));

test("KPI models preserve chronology and use each metric's actual observations", () => {
  const { AdminAnalyticsWorkbench: helper } = load();
  const overview = {
    windowDays: 7,
    cards: { totalUv: 3, todayClicks: 12 },
    daily: [{ day: "2026-09-08", pv: 8, uv: 2 }, { day: "2026-09-07", pv: 20, uv: 3 }],
    hourly: [{ hour: "2026-09-08T01", pv: 10, uv: 2, clicks: 7, messages: 1 }, { hour: "2026-09-08T00", pv: 30, uv: 3, clicks: 5, messages: 9 }]
  };
  const models = helper.metricModels(overview);
  assert.deepEqual(plain(models.find((row) => row.key === "todayUv").rows), [{ at: "2026-09-08T00", value: 3 }, { at: "2026-09-08T01", value: 2 }]);
  assert.deepEqual(plain(models.find((row) => row.key === "todayClicks").rows.map((row) => row.value)), [5, 7]);
  assert.deepEqual(plain(models.find((row) => row.key === "todayMessages").rows.map((row) => row.value)), [9, 1]);
  assert.equal(models.find((row) => row.key === "totalUv").value, 3, "period UV is not the sum of daily UV");
  assert.equal(models.find((row) => row.key === "onlineVisitors").rows.length, 0, "online snapshot has no fabricated history");
  assert.equal(overview.daily[0].day, "2026-09-08", "rendering never mutates the API row order");
});

test("missing metric series stays unknown while recorded zeros remain zero", () => {
  const { AdminAnalyticsWorkbench: helper } = load();
  assert.equal(helper.metricRows([{ hour: "2026-09-08T00", pv: 50 }], "clicks").length, 0);
  assert.equal(helper.metricRows([{ hour: "2026-09-08T00", clicks: null }], "clicks").length, 0);
  assert.deepEqual(plain(helper.metricRows([{ hour: "2026-09-08T00", clicks: 0 }], "clicks")), [{ at: "2026-09-08T00", value: 0 }]);
});

test("CSV protects formula cells, preserves valid values and includes source boundaries", () => {
  const { AdminAnalyticsWorkbench: helper } = load();
  for (const value of ["=1+1", "+SUM(A1)", "-1+2", "@sum(A1)", " \t=SUM(A1)", "\r=1", "\tplain"]) assert.ok(helper.csvCell(value).startsWith('"\''));
  assert.equal(helper.csvCell(-3), '"-3"');
  assert.equal(helper.csvCell('a,"b"\nc'), '"a,""b""\nc"');
  const csv = helper.overviewCsv({
    windowDays: 1, timeZone: "Asia/Shanghai", generatedAt: "2026-09-07T23:20:00Z",
    range: { start: "2026-09-07T16:00:00Z", end: "2026-09-07T23:20:00Z" },
    cards: { todayPv: 2 }, daily: [{ day: "2026-09-08", pv: 2, uv: 1, clicks: 0, messages: 0 }],
    topPages: [{ path: "=HYPERLINK(\"https://example.com\")", pv: 2, uv: 1 }],
    recentClicks: [{ visitor_id: "private-identity", ip_prefix: "private-network" }]
  });
  assert.ok(csv.startsWith("\uFEFF"));
  assert.match(csv, /Asia\/Shanghai/);
  assert.match(csv, /2026-09-07T16:00:00Z/);
  assert.match(csv, /不可累加/);
  assert.match(csv, /"'=HYPERLINK/);
  assert.doesNotMatch(csv, /private-identity|private-network/);
});

test("next planned times use Shanghai's day and week boundaries without claiming execution", () => {
  const { AdminAnalyticsWorkbench: helper } = load();
  assert.equal(helper.nextPlannedAt("daily-ai-news", "2026-09-07T22:59:59Z"), "2026-09-07T23:00:00.000Z");
  assert.equal(helper.nextPlannedAt("daily-ai-news", "2026-09-07T23:00:00Z"), "2026-09-08T23:00:00.000Z");
  assert.equal(helper.nextPlannedAt("tool-radar", "2026-09-08T13:59:59Z"), "2026-09-08T14:00:00.000Z");
  assert.equal(helper.nextPlannedAt("tool-radar", "2026-09-08T14:00:00Z"), "2026-09-15T14:00:00.000Z");
  assert.equal(helper.nextPlannedAt("tool-radar", "invalid"), null);
});

test("task counts distinguish unqueried, unavailable and real zero", () => {
  const { AdminAnalyticsWorkbench: helper } = load();
  const empty = helper.workItems({});
  assert.equal(empty.find((row) => row.key === "articles").count, null);
  const loaded = { loadedPanels: { articles: 1, videos: 1, whiteboards: 1 }, articles: [{ status: "draft" }], videos: [{ title: "Video", thumbnail_url: "cover", metadata_error: "Upstream unavailable" }], whiteboardRooms: [{ status: "deleting" }] };
  assert.equal(helper.workItems(loaded).find((row) => row.key === "articles").count, 1);
  assert.equal(helper.workItems(loaded).find((row) => row.key === "videos").count, 1);
  assert.equal(helper.workItems(loaded, { draftArticleCount: null }).find((row) => row.key === "articles").count, null, "unavailable latest summary must not become a stale success");
  assert.equal(helper.workItems(loaded, { draftArticleCount: 0 }).find((row) => row.key === "articles").count, 0);
});

class Node {
  constructor(tagName) { this.tagName = tagName; this.children = []; this.style = {}; this.dataset = {}; this.attributes = {}; this.classList = { add() {} }; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = [...nodes]; }
  setAttribute(name, value) { this.attributes[name] = value; }
  focus(options) { this.focusOptions = options; }
}

test("production KPI renderer omits copied rankings, fake online trends and nonzero zero bars", () => {
  const grid = new Node("div");
  const sandbox = load({ document: { createElement: (tag) => new Node(tag) }, state: { overview: {
    windowDays: 7, daily: [{ day: "2026-09-08", pv: 0, uv: 0 }], hourly: [{ hour: "2026-09-08T00", pv: 0, uv: 0, clicks: 0, messages: 0 }]
  } }, $: () => grid, setElementText: (node, text) => { node.textContent = text; }, formatNumber: String });
  vm.runInContext(`${functionSource("createSparkBars")}\n${functionSource("renderKpis")}\nrenderKpis({ todayPv: 0, onlineVisitors: 0 });`, sandbox);
  assert.equal(grid.children.length, 7);
  assert.equal(grid.children[0].children.find((node) => node.className === "property-sparkline").children[0].style.height, "0%");
  const online = grid.children.find((node) => node.dataset.analyticsKey === "kpi:onlineVisitors");
  assert.equal(online.children.some((node) => node.className === "property-sparkline"), false);
  assert.equal(grid.children.some((node) => node.children.some((child) => child.className === "property-card-lists")), false);
});

test("production daily chart renders PV and UV separately in date order with stable focus keys", () => {
  const container = new Node("div");
  const sandbox = load({ document: { createElement: (tag) => new Node(tag) }, formatNumber: String, createEmptyStateElement: () => new Node("p"), container });
  vm.runInContext(`${functionSource("renderBars")}\nrenderBars(container, [{ day: '2026-09-08', pv: 0, uv: 0 }, { day: '2026-09-07', pv: 20, uv: 5 }], 'day');`, sandbox);
  assert.equal(container.children[0].dataset.analyticsKey, "day:2026-09-07");
  assert.deepEqual(container.children[0].children[0].children.map((node) => node.style.height), ["100%", "25%"]);
  assert.deepEqual(container.children[1].children[0].children.map((node) => node.style.height), ["0%", "0%"]);
});

test("refresh restores the same metric date focus without scrolling", () => {
  const oldNode = new Node("div");
  oldNode.dataset.analyticsKey = "day:2026-09-08";
  oldNode.closest = () => ({});
  const replacement = new Node("div");
  replacement.dataset.analyticsKey = oldNode.dataset.analyticsKey;
  const document = { activeElement: oldNode, body: new Node("body"), getElementById: () => null, querySelectorAll: () => [replacement] };
  const { AdminAnalyticsWorkbench: helper } = load({ document });
  helper.beforeOverview();
  document.activeElement = document.body;
  helper.afterOverview({ windowDays: 14, cards: {} });
  assert.deepEqual(plain(replacement.focusOptions), { preventScroll: true });
});
