import assert from "node:assert/strict";
import test from "node:test";
import { createKnowledgeRoute } from "../js/routes/knowledge.mjs";

class NodeStub {
  constructor() {
    this.dataset = {};
    this.children = [];
    this.classList = { add() {}, remove() {}, toggle() {} };
  }
  append(...nodes) { this.children.push(...nodes); }
  appendChild(node) { this.append(node); return node; }
  replaceChildren(...nodes) { this.children = nodes; }
  setAttribute() {}
  removeAttribute() {}
  contains() { return false; }
}

function fixture(t) {
  const oldWindow = globalThis.window;
  const oldDocument = globalThis.document;
  const nodes = new Map();
  globalThis.window = { requestAnimationFrame: () => 0, clearTimeout() {} };
  globalThis.document = {
    body: { dataset: { route: "home" }, classList: { add() {}, remove() {} } },
    activeElement: null,
    getElementById: (id) => {
      if (!nodes.has(id)) nodes.set(id, new NodeStub());
      return nodes.get(id);
    },
    querySelector: () => null,
    createElement: () => new NodeStub()
  };
  t.after(() => { globalThis.window = oldWindow; globalThis.document = oldDocument; });
  const state = { requestId: 0, articles: [], searchTerm: "", searchIndex: new Map(), detailCache: new Map(), visibleCount: 12 };
  const filters = { knowledge: "site-updates" };
  let lang = "zh";
  let respond;
  const requests = [];
  const articles = Array.from({ length: 7 }, (_, index) => ({ slug: `update-${index}`, title: `Update ${index}`, category: "site-updates", lang: "zh", tags: [] }));
  const route = createKnowledgeRoute({
    articleState: state, activeFilters: filters,
    siteUpdateCategory: "site-updates", dailyAiNewsCategory: "daily-ai-news", toolRadarCategory: "tool-radar", siteGuidesCategory: "site-guides",
    getCurrentLang: () => lang, t: (key) => key,
    articleCategoryName: (key) => key, articleTagName: (tag) => tag,
    articleRouteHref: (slug) => `/articles/${slug}`,
    formatArticleDate: (date) => date || "", visiblePublicArticles: (items) => items,
    markStatusMessage() {}, requestMobileFocusReveal() {}, renderUpdates() {}, renderLatestUpdateDate() {},
    isAbortError: (error) => error?.name === "AbortError",
    requestJson: async (_route, url, options) => {
      requests.push({ url, options });
      return respond ? respond(url, options) : { data: { articles, pagination: { total: 7, hasMore: false, nextCursor: "" }, categoryCounts: { "site-updates": 7 } } };
    }
  });
  return { route, state, filters, articles, requests, setLanguage: (value) => { lang = value; }, setResponse: (value) => { respond = value; } };
}

test("only an unfiltered update page refreshes the five-item cache and records its requested language", async (t) => {
  const { route, state, articles, filters, setLanguage } = fixture(t);
  await route.loadArticles();
  assert.deepEqual(state.updateArticles.map((item) => item.slug), articles.slice(0, 5).map((item) => item.slug));
  assert.equal(state.updateArticlesLanguage, "zh");
  const cached = state.updateArticles;
  state.searchTerm = "older update";
  await route.loadArticles();
  assert.equal(state.updateArticles, cached, "search subsets cannot replace the latest five updates");
  filters.knowledge = "all";
  setLanguage("en");
  await route.loadArticles();
  assert.equal(state.updateArticlesLanguage, "zh", "an unrelated English list cannot relabel Chinese update content");
  filters.knowledge = "site-updates";
  state.searchTerm = "";
  await route.loadArticles();
  assert.equal(state.updateArticlesLanguage, "en");
});

test("superseded searches abort their request and cannot overwrite the current result", async (t) => {
  const { route, state, requests, setResponse } = fixture(t);
  const pending = new Map();
  setResponse((url) => new Promise((resolve) => pending.set(new URL(url, "https://example.test").searchParams.get("search"), resolve)));
  state.searchTerm = "old";
  const oldRequest = route.loadArticles();
  state.searchTerm = "new";
  const newRequest = route.loadArticles();
  assert.equal(requests[0].options.signal.aborted, true);
  pending.get("new")({ data: { articles: [{ slug: "new-result", category: "site-updates", tags: [] }], pagination: { total: 1, hasMore: false }, categoryCounts: {} } });
  await newRequest;
  pending.get("old")({ data: { articles: [{ slug: "old-result", category: "site-updates", tags: [] }], pagination: { total: 1, hasMore: false }, categoryCounts: {} } });
  await oldRequest;
  assert.deepEqual(state.articles.map((item) => item.slug), ["new-result"]);
});
