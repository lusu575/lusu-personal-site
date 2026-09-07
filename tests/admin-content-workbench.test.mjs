import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { createDraftStore, articleVersionDiff, articleSnapshot, applyArticleSnapshot, contentListQuery, renderArticleMarkdown } from "../admin/content-workbench.mjs";

function memoryStorage() {
  const values = new Map();
  return { values, getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
}

test("incomplete local drafts are isolated by account, never accept arbitrary fields, and keep bounded history", async () => {
  const storage = memoryStorage();
  const first = await createDraftStore(storage, "account-one");
  const second = await createDraftStore(storage, "account-two");
  first.save("article-one", { title_zh: "尚未翻译", content_zh: "私有内容", access_token: "must-not-persist" }, { revision: "r1" });
  assert.equal(second.get("article-one"), null);
  assert.equal(first.get("article-one").draft.snapshot.title_zh, "尚未翻译");
  assert.equal(first.get("article-one").draft.snapshot.title_en, "");
  assert.equal([...storage.values.values()].join("").includes("must-not-persist"), false);
  for (let index = 0; index < 8; index += 1) first.save("article-one", { title_zh: `版本 ${index}` }, { history: true, now: new Date(2026, 8, 8, 0, index).toISOString() });
  assert.equal(first.get("article-one").history.length, 5);
  assert.equal(first.get("article-one").history[0].snapshot.title_zh, "版本 7");
  first.clearDraft("article-one");
  assert.equal(first.get("article-one").draft, undefined);
  assert.equal(first.get("article-one").history.length, 5);
  second.save("article-one", { title_zh: "其他账号" });
  first.clearAll();
  assert.equal(first.get("article-one"), null);
  assert.equal(second.get("article-one").draft.snapshot.title_zh, "其他账号");
});

test("local storage evicts oldest documents within budget and reports quota or corrupt data instead of false success", async () => {
  const storage = memoryStorage();
  const store = await createDraftStore(storage, "account", { limitBytes: 1900 });
  for (let index = 0; index < 5; index += 1) store.save(`article-${index}`, { title_zh: `版本${index}`, content_zh: "x".repeat(400) }, { now: new Date(2026, 8, 8, 0, index).toISOString() });
  assert.equal(store.get("article-4").draft.snapshot.title_zh, "版本4");
  assert.equal(store.get("article-0"), null);
  assert.ok(new TextEncoder().encode([...storage.values.values()][0]).length <= 1900);
  assert.throws(() => store.save("oversized", { content_zh: "x".repeat(330 * 1024) }), /320 KiB/);
  storage.setItem = () => { throw new Error("QuotaExceededError"); };
  assert.throws(() => store.save("failed", { title_zh: "未写入" }), /未能保存/);
  const [key] = storage.values.keys(); storage.values.set(key, "not-json");
  assert.throws(() => store.get("article-4"), /损坏/);
});

test("snapshot restore preserves the current server CAS revision and diffs only changed ranges", () => {
  const form = { elements: { title_zh: { value: "原文" }, is_pinned: { checked: true }, expectedUpdatedAt: { value: "current-server-revision" } } };
  const snapshot = articleSnapshot(form);
  assert.equal(snapshot.title_zh, "原文");
  applyArticleSnapshot(form, { title_zh: "本机稿", is_pinned: false, expectedUpdatedAt: "old-revision" });
  assert.equal(form.elements.title_zh.value, "本机稿");
  assert.equal(form.elements.is_pinned.checked, false);
  assert.equal(form.elements.expectedUpdatedAt.value, "current-server-revision");
  const diff = articleVersionDiff({ content_zh: "same\nold\nend" }, { content_zh: "same\nnew\nend" });
  assert.match(diff, /− old\n\+ new/);
  assert.doesNotMatch(diff, /same|end/);
});

test("server list query encodes combined filters and page offsets without losing non-ASCII input", () => {
  const query = new URLSearchParams(contentListQuery({ q: "AI & 日本語", category: "note", status: "draft", updatedAfter: "2026-09-01T00:00:00.000Z", metadata: "missing", offset: 100 }));
  assert.equal(query.get("q"), "AI & 日本語");
  assert.equal(query.get("category"), "note");
  assert.equal(query.get("status"), "draft");
  assert.equal(query.get("metadata"), "missing");
  assert.equal(query.get("limit"), "50");
  assert.equal(query.get("offset"), "100");
});

class FakeNode {
  constructor(tag, ownerDocument) { this.tag = tag; this.ownerDocument = ownerDocument; this.children = []; this.textContent = ""; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
}
const fakeDocument = { createElement: (tag) => new FakeNode(tag, fakeDocument), createTextNode: (text) => Object.assign(new FakeNode("#text", fakeDocument), { textContent: text }) };
function allNodes(node) { return [node, ...node.children.flatMap(allNodes)]; }

test("article preview renders safe DOM, blocks script links and unreviewed image sources", () => {
  const target = new FakeNode("article", fakeDocument);
  renderArticleMarkdown(target, "# 标题\n\n<img src=x onerror=alert(1)>\n\n[恶意](javascript:alert) [官网](https://example.com/docs)\n\n![bad](https://tracker.example/x.png)\n\n![ok](assets/images/articles/test.png)\n\n```js\n<script>alert(1)</script>\n```");
  const nodes = allNodes(target);
  assert.equal(nodes.filter((node) => node.tag === "script").length, 0);
  assert.equal(nodes.filter((node) => node.tag === "a").length, 1);
  assert.equal(nodes.find((node) => node.tag === "a").href, "https://example.com/docs");
  assert.equal(nodes.filter((node) => node.tag === "img").length, 1);
  assert.equal(nodes.find((node) => node.tag === "img").src, "/assets/images/articles/test.png");
  assert.ok(nodes.some((node) => node.textContent.includes("<script>")));
  assert.ok(nodes.some((node) => node.textContent.includes("onerror")));
});

const adminSource = readFileSync(new URL("../admin/admin.js", import.meta.url), "utf8");
function adminFunction(name) {
  const match = new RegExp(`(?:async )?function ${name}\\(`).exec(adminSource);
  assert.ok(match, `missing ${name}`);
  const start = match.index;
  const next = /\n(?:async )?function \w+\(/.exec(adminSource.slice(start + match[0].length));
  return adminSource.slice(start, next ? start + match[0].length + next.index : undefined);
}

test("article commit followed by failed GETs preserves content, records success and never posts again", async () => {
  const status = { textContent: "" }; const form = { elements: { status: { value: "draft" }, title_zh: { value: "保留的内容" } } };
  const requests = []; const baselines = [];
  const context = vm.createContext({
    state: { selectedArticleId: "a1", articleUpdatedAt: "old", articleDetailReady: true, articleSaving: false },
    $: (selector) => selector === "#article-form" ? form : status,
    articleLocalTimer: null, articleSavedRecord: null, contentLocalStore: null,
    syncArticleSaveButtons() {}, syncArticleWorkbench() {}, clearTimeout,
    articlePayload: () => ({ slug: "saved", status: "published", translations: {} }),
    api: async (path, options = {}) => { requests.push({ path, method: options.method || "GET" }); if (options.method === "PUT") return { articleId: "a1", updatedAt: "new" }; throw new Error("readback-offline"); },
    loadArticles: async () => { throw new Error("list-offline"); },
    captureEditorBaseline: (...args) => baselines.push(args),
    fillArticleForm: () => assert.fail("failed GET must not fill or reset the form"),
    contentWriteErrorMessage: (error) => error.message,
    refreshEditorDirtyState: () => assert.fail("committed write must not be marked failed")
  });
  vm.runInContext(`${adminFunction("saveArticle")}\nthis.save = saveArticle;`, context);
  assert.equal(await context.save("published"), true);
  assert.equal(form.elements.title_zh.value, "保留的内容");
  assert.equal(form.elements.status.value, "published");
  assert.equal(context.state.articleUpdatedAt, "new");
  assert.equal(context.state.articleDetailReady, true);
  assert.equal(requests.filter((item) => item.method === "PUT").length, 1);
  assert.match(status.textContent, /已保存并公开.*详情刷新失败.*编辑内容已保留.*列表刷新失败/);
  assert.equal(baselines.length, 1);
});

test("failed article commit keeps original revision and dirty content", async () => {
  const status = { textContent: "" }; let dirtyRefreshes = 0;
  const context = vm.createContext({ state: { selectedArticleId: "a1", articleUpdatedAt: "old", articleDetailReady: true }, $: () => status, syncArticleSaveButtons() {}, syncArticleWorkbench() {}, articlePayload: () => ({ status: "draft" }), api: async () => { throw new Error("CONTENT_CONFLICT"); }, contentWriteErrorMessage: (error) => error.message, refreshEditorDirtyState: () => { dirtyRefreshes += 1; } });
  vm.runInContext(`${adminFunction("saveArticle")}\nthis.save = saveArticle;`, context);
  assert.equal(await context.save(), false);
  assert.equal(context.state.articleUpdatedAt, "old");
  assert.equal(dirtyRefreshes, 1);
  assert.equal(status.textContent, "CONTENT_CONFLICT");
});

test("video metadata preview fills missing fields without replacing manually authored values", () => {
  const elements = Object.fromEntries(["platform", "external_id", "embed_url", "title", "description", "thumbnail_url", "author_name", "published_at"].map((name) => [name, { value: "" }]));
  elements.title.value = "人工标题"; elements.thumbnail_url.value = "/private-cover.webp";
  const status = {};
  const context = vm.createContext({ $: (selector) => selector === "#video-form" ? { elements } : status, toLocalDateTimeInputValue: (value) => value || "", renderAdminVideoPreview() {}, renderVideoThumbnailPreview() {}, refreshEditorDirtyState() {} });
  vm.runInContext(`${adminFunction("applyPreviewToVideoForm")}\nthis.apply = applyPreviewToVideoForm;`, context);
  context.apply({ platform: "youtube", embed_url: "https://www.youtube.com/embed/example", title: "平台标题", thumbnail_url: "https://platform.example/image.webp", author_name: "平台作者" });
  assert.equal(elements.title.value, "人工标题");
  assert.equal(elements.thumbnail_url.value, "/private-cover.webp");
  assert.equal(elements.author_name.value, "平台作者");
  assert.match(status.textContent, /保留已有内容/);
});

function metadataRecoveryHarness() {
  const calls = []; const status = { textContent: "" }; const dirtySnapshots = [];
  const elements = Object.fromEntries(["original_url", "platform", "external_id", "embed_url", "title", "description", "thumbnail_url", "author_name", "published_at", "status", "sort_order", "pinned_sort_order", "metadata_recovered"].map((name) => [name, { value: "" }]));
  elements.original_url.value = "https://www.youtube.com/watch?v=example1234";
  elements.title.value = "人工标题"; elements.status.value = "draft"; elements.pinned = { checked: false };
  const context = vm.createContext({ state: { selectedVideoId: "v1", videoUpdatedAt: "loaded-revision" }, videoMetadataRecovery: null, videoMetadataRecoveryGeneration: 0,
    isVideoEditBusy: () => false,
    $: (selector) => selector === "#video-form" ? { elements } : selector === "#video-category-checks" ? { querySelectorAll: () => [] } : status,
    syncVideoSaveButtons() {}, syncVideoMetadataButtons() {},
    api: async (path, options) => { calls.push({ path, body: JSON.parse(options.body) }); return { video: { title: "平台建议", metadata_error: "" }, updatedAt: "untrusted-response-version" }; },
    toLocalDateTimeInputValue: (value) => value || "", normalizePublishedAtForApi: (value) => value || null,
    renderAdminVideoPreview() {}, renderVideoThumbnailPreview() {},
    refreshEditorDirtyState: () => dirtySnapshots.push(elements.metadata_recovered.value),
    contentWriteErrorMessage: (error) => error.message
  });
  vm.runInContext(["invalidateVideoMetadataRecovery", "acknowledgeVideoMetadataRecovery", "applyPreviewToVideoForm", "previewVideoUrl", "refreshVideoMetadata", "videoPayload"].map(adminFunction).join("\n") + "\nthis.refresh = refreshVideoMetadata; this.preview = previewVideoUrl; this.payload = videoPayload; this.invalidate = invalidateVideoMetadataRecovery;", context);
  return { context, elements, calls, status, dirtySnapshots };
}

test("successful metadata preview marks a pending same-URL recovery but never writes or advances CAS", async () => {
  const { context, elements, calls, status, dirtySnapshots } = metadataRecoveryHarness();
  await context.refresh();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, "/api/admin/videos/preview-url");
  assert.equal(Object.keys(calls[0].body).join(","), "url");
  assert.equal(context.state.videoUpdatedAt, "loaded-revision");
  assert.equal(elements.title.value, "人工标题");
  assert.equal(context.payload().metadata_error, "");
  assert.equal(context.payload().expectedUpdatedAt, "loaded-revision");
  assert.equal(elements.metadata_recovered.value, "true");
  assert.equal(dirtySnapshots.at(-1), "true");
  assert.match(status.textContent, /保存后会清除旧.*尚未保存到服务器/);
});

test("failed metadata previews invalidate previous success and cannot clear stored errors", async () => {
  const { context, elements } = metadataRecoveryHarness();
  await context.preview(); assert.equal(context.payload().metadata_error, "");
  context.api = async () => { throw new Error("HTTP 412"); };
  await context.refresh();
  assert.equal(Object.hasOwn(context.payload(), "metadata_error"), false);
  assert.equal(elements.metadata_recovered.value, "");
  assert.equal(context.videoMetadataRecovery, null);
  context.api = async () => ({ video: { metadata_error: "HTTP 412" } });
  await context.preview();
  assert.equal(Object.hasOwn(context.payload(), "metadata_error"), false);
});

test("metadata recovery expires on URL edits, stale responses and changed revision", async () => {
  const { context, elements } = metadataRecoveryHarness();
  const originalUrl = elements.original_url.value;
  await context.refresh();
  elements.original_url.value = "https://www.youtube.com/watch?v=different12";
  assert.equal(Object.hasOwn(context.payload(), "metadata_error"), false);
  context.invalidate(); elements.original_url.value = originalUrl;
  assert.equal(Object.hasOwn(context.payload(), "metadata_error"), false);
  let resolvePreview;
  context.api = () => new Promise((resolve) => { resolvePreview = resolve; });
  const pending = context.refresh();
  elements.original_url.value = "https://www.youtube.com/watch?v=different12";
  context.invalidate();
  elements.original_url.value = originalUrl;
  resolvePreview({ video: { metadata_error: "" } }); await pending;
  assert.equal(Object.hasOwn(context.payload(), "metadata_error"), false);
  context.api = async () => ({ video: { metadata_error: "" } });
  await context.refresh(); context.state.videoUpdatedAt = "new-revision";
  assert.equal(Object.hasOwn(context.payload(), "metadata_error"), false);
});

test("article pagination discards an older response and never resets the selected editor", async () => {
  let resolveOld; let request = 0; let renders = 0;
  const context = vm.createContext({ contentLists: { articles: { generation: 0 } }, state: { selectedArticleId: "editing", articles: [] }, api: async () => ++request === 1 ? new Promise((resolve) => { resolveOld = resolve; }) : { articles: [{ article_id: "new-match" }], total: 1, pagination: { page: 1 } }, contentListQuery, contentListFilters: () => ({}), $: () => null, renderArticleList: () => { renders += 1; }, syncContentPagination() {} });
  vm.runInContext(`${adminFunction("loadArticles")}\nthis.load = loadArticles;`, context);
  const first = context.load(); await context.load();
  resolveOld({ articles: [{ article_id: "stale-match" }], total: 1 }); await first;
  assert.equal(context.state.articles[0].article_id, "new-match");
  assert.equal(context.state.selectedArticleId, "editing");
  assert.equal(renders, 1);
});

test("a superseded failed list request cannot replace a newer successful list with an error", async () => {
  let rejectOld; let request = 0;
  const context = vm.createContext({ contentLists: { articles: { generation: 0 } }, state: { articles: [] }, api: async () => ++request === 1 ? new Promise((_, reject) => { rejectOld = reject; }) : { articles: [{ article_id: "current" }], total: 1 }, contentListQuery, contentListFilters: () => ({}), $: () => null, renderArticleList() {}, syncContentPagination() {} });
  vm.runInContext(`${adminFunction("loadArticles")}\nthis.load = loadArticles;`, context);
  const first = context.load(); await context.load(); rejectOld(new Error("stale request failed"));
  await assert.doesNotReject(first);
  assert.equal(context.state.articles[0].article_id, "current");
});

test("video list refresh preserves dirty categories, ordering and selected editor outside current page", async () => {
  const context = vm.createContext({ contentLists: { videos: { generation: 0 } }, state: { videos: [], selectedVideoId: "outside-page" }, api: async () => ({ videos: [{ video_id: "current-page" }], total: 51, sortDefaults: { sortOrder: 510, pinnedSortOrder: 60 } }), contentListQuery, contentListFilters: () => ({}), isEditorDirty: () => true, renderVideoList() {}, syncContentPagination() {}, syncVideoOrderPreview() {}, captureEditorBaselineIfClean() {}, renderVideoCategoryChecks: () => assert.fail("must not replace dirty category checks"), applyNewVideoSortDefault: () => assert.fail("must not replace dirty sort values") });
  vm.runInContext(`${adminFunction("loadVideos")}\nthis.load = loadVideos;`, context);
  await context.load();
  assert.equal(context.state.selectedVideoId, "outside-page");
  assert.equal(context.contentLists.videos.sortDefaults.sortOrder, 510);
});

test("video commit followed by list failure reports committed state and retains form and revision", async () => {
  const form = { elements: { status: { value: "draft" }, title: { value: "人工视频标题" }, metadata_recovered: { value: "true" } } }; const status = { textContent: "" };
  let writes = 0; let baselines = 0;
  const context = vm.createContext({ state: { selectedVideoId: "v1", videoUpdatedAt: "old", videoSaving: false }, videoMetadataRecovery: { url: "original", videoId: "v1", revision: "old" }, videoSavedRecord: { video_id: "v1", metadata_error: "old 412" }, $: (selector) => selector === "#video-form" ? form : status, syncVideoSaveButtons() {}, ensureVideoThumbnailBeforeSave: async () => {}, videoPayload: () => ({ title: "人工视频标题", status: "published", metadata_error: "" }), api: async () => { writes += 1; return { videoId: "v1", updatedAt: "new" }; }, captureEditorBaseline: () => { baselines += 1; }, loadVideos: async () => { throw new Error("offline"); }, contentWriteErrorMessage: (error) => error.message, refreshEditorDirtyState: () => assert.fail("commit must remain successful") });
  vm.runInContext(`${adminFunction("saveVideo")}\nthis.save = saveVideo;`, context);
  assert.equal(await context.save("published"), true);
  assert.equal(writes, 1); assert.equal(baselines, 1);
  assert.equal(form.elements.title.value, "人工视频标题");
  assert.equal(form.elements.status.value, "published");
  assert.equal(context.state.videoUpdatedAt, "new");
  assert.equal(context.videoMetadataRecovery, null);
  assert.equal(form.elements.metadata_recovered.value, "");
  assert.equal(context.videoSavedRecord.metadata_error, "");
  assert.match(status.textContent, /已保存并公开.*列表刷新失败.*编辑内容已保留/);
});
