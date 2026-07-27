import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  articleLanguageTag,
  articleImageDimensions,
  articleReadProgressPercent,
  deduplicateArticleHeadingAnchors,
  knowledgeCategoryValues,
  knowledgeSearchTokens,
  normalizeArticleHeadingAnchor,
  normalizeKnowledgeSearchText,
  sortKnowledgeArticles
} from "../js/routes/knowledge.mjs";

test("article heading anchors stay semantic, Unicode-safe, and deterministic", () => {
  assert.equal(normalizeArticleHeadingAnchor("  Getting Started!  "), "article-getting-started");
  assert.equal(normalizeArticleHeadingAnchor("项目背景与目标"), "article-项目背景与目标");
  assert.equal(normalizeArticleHeadingAnchor("What's New"), "article-whats-new");
  assert.deepEqual(
    deduplicateArticleHeadingAnchors(["Overview", "Overview", "概览", "Overview"]),
    ["article-overview", "article-overview-2", "article-概览", "article-overview-3"]
  );
});

test("known article images reserve their intrinsic aspect ratio", () => {
  assert.deepEqual(articleImageDimensions("assets/images/articles/ai-agent-codex-project-brief.png"), {
    width: 1910,
    height: 1226
  });
  assert.deepEqual(articleImageDimensions("assets/images/articles/ai-agent-gpt-chatroom-prompt.png?v=1"), {
    width: 1745,
    height: 1465
  });
  assert.equal(articleImageDimensions("assets/images/articles/unknown.png"), null);
});

test("knowledge search normalization and article ordering are deterministic", () => {
  assert.equal(normalizeKnowledgeSearchText("  ＵＩ   Mobile\n附件  "), "ui mobile 附件");
  assert.deepEqual(knowledgeSearchTokens("  ＵＩ   Mobile\n附件  "), ["ui", "mobile", "附件"]);
  assert.deepEqual(knowledgeSearchTokens(" \n\t "), []);
  const ordered = sortKnowledgeArticles([
    { slug: "new", published_at: "2026-07-18T00:00:00Z", is_pinned: 0 },
    { slug: "pinned-old", published_at: "2025-01-01T00:00:00Z", is_pinned: 1 },
    { slug: "older", published_at: "2026-07-17T00:00:00Z", is_pinned: 0 },
    { slug: "stale-pinned-update", category: "site-updates", published_at: "2024-01-01T00:00:00Z", is_pinned: 1 }
  ]);
  assert.deepEqual(ordered.map(({ slug }) => slug), ["pinned-old", "new", "older", "stale-pinned-update"]);
});

test("Daily AI News remains a stable first category and Site Updates remains last", () => {
  const categories = knowledgeCategoryValues([
    { category: "note" },
    { category: "site-updates" },
    { category: "daily-ai-news" },
    { category: "note" }
  ], {
    fixedCategories: ["daily-ai-news"],
    firstCategory: "daily-ai-news",
    lastCategory: "site-updates",
    labelFor: (value) => ({ note: "Notes" }[value] || value)
  });
  assert.deepEqual(categories, ["daily-ai-news", "note", "site-updates"]);
  assert.deepEqual(knowledgeCategoryValues([], {
    fixedCategories: ["daily-ai-news"],
    firstCategory: "daily-ai-news",
    lastCategory: "site-updates"
  }), ["daily-ai-news"]);
});

test("API article languages map to valid document language tags", () => {
  assert.equal(articleLanguageTag("zh"), "zh-CN");
  assert.equal(articleLanguageTag("zh-CN"), "zh-CN");
  assert.equal(articleLanguageTag("en"), "en");
  assert.equal(articleLanguageTag("ja"), "ja");
  assert.equal(articleLanguageTag("unknown"), "");
});

test("article reading progress reaches completion at the body end without counting trailing safety padding", () => {
  assert.equal(articleReadProgressPercent({ scrollTop: 0, clientHeight: 600, contentEnd: 500 }), 100);
  assert.equal(articleReadProgressPercent({ scrollTop: 0, clientHeight: 400, contentEnd: 1000 }), 0);
  assert.equal(Math.round(articleReadProgressPercent({
    scrollTop: 624,
    clientHeight: 400,
    contentEnd: 1000
  })), 100);
  assert.equal(articleReadProgressPercent({
    scrollTop: 1000,
    clientHeight: 400,
    contentEnd: 1000
  }), 100);
});

test("knowledge filtering uses AND tokens and resets real plus history scroll state", async () => {
  const [routeSource, mainSource] = await Promise.all([
    readFile(new URL("../js/routes/knowledge.mjs", import.meta.url), "utf8"),
    readFile(new URL("../js/main.js", import.meta.url), "utf8")
  ]);

  assert.match(routeSource, /const tokens = knowledgeSearchTokens\(articleState\.searchTerm\)/);
  assert.match(routeSource, /tokens\.every\(\(token\) => haystack\.includes\(token\)\)/);
  assert.match(routeSource, /function resetKnowledgeListScroll\([\s\S]*?list\.scrollTop = 0/);
  assert.match(routeSource, /replaceCurrentPublicHistoryState\([\s\S]*?scrollTop:\s*0/);
  assert.match(routeSource, /handleKnowledgeSearchInput[\s\S]*?resetKnowledgeListScroll\(\{ syncHistory: true \}\)/);
  assert.match(mainSource, /filterType === "knowledge"[\s\S]*?resetKnowledgeListScroll\(\{ syncHistory: true \}\)/);
  assert.match(mainSource, /data-article-search-clear[\s\S]*?resetKnowledgeListScroll\(\{ syncHistory: true \}\)/);
  assert.match(mainSource, /data-article-search-reset[\s\S]*?resetKnowledgeListScroll\(\{ syncHistory: true \}\)/);
});

test("article list and reader content inherit the API response language, including fallbacks", async () => {
  const source = await readFile(new URL("../js/routes/knowledge.mjs", import.meta.url), "utf8");
  assert.match(source, /applyArticleLanguage\(card, item\.lang\)/);
  assert.match(source, /applyArticleLanguage\(title, item\.lang\)/);
  assert.match(source, /applyArticleLanguage\(summary, item\.lang\)/);
  assert.match(source, /\[title, summary, body\]\.forEach\(\(node\) => applyArticleLanguage\(node, article\.lang\)\)/);
  assert.match(source, /applyArticleLanguage\(meta, getCurrentLang\(\)\)/);
  assert.match(source, /renderArticleToc\(article\.lang\)/);
  assert.match(source, /applyArticleLanguage\(list, articleLang\)/);
  assert.match(source, /applyArticleLanguage\(button, articleLang\)/);
});

test("latest update time text keeps its machine-readable date in sync", async () => {
  const source = await readFile(new URL("../js/main.js", import.meta.url), "utf8");
  assert.match(source, /function renderLatestUpdateDate/);
  assert.match(source, /node\.localName === "time"/);
  assert.match(source, /node\.setAttribute\("datetime", value\.replace\(\/\\\.\/g, "-"\)\)/);
  assert.match(source, /renderLatestUpdateDate\(\)/);
});

test("mobile article first screen overrides the late-loaded reader minimum height and keeps a geometry gate", async () => {
  const [routeCss, mobileCss, auditSource] = await Promise.all([
    readFile(new URL("../css/routes/knowledge.css", import.meta.url), "utf8"),
    readFile(new URL("../css/mobile-ios-shell.css", import.meta.url), "utf8"),
    readFile(new URL("../scripts/public-ui-audit.mjs", import.meta.url), "utf8")
  ]);

  assert.match(routeCss, /body\.is-article-reading\s+\.article-reader-sidebar\s*\{[^}]*min-height:\s*min\(640px,\s*calc\(100dvh - 280px\)\)/);
  assert.match(mobileCss, /html\[data-ui-shell="mobile"\]\s+body\.is-article-reading\s+\.folder-layout\.is-reading\s+\.article-reader-sidebar\s*\{[^}]*min-height:\s*0/);
  assert.match(auditSource, /article-first-screen-\$\{viewport\.width\}x\$\{viewport\.height\}\.png/);
  assert.match(auditSource, /mobile article sidebar reserves/);
  assert.match(auditSource, /firstBodyVisibleHeight\s*<\s*Math\.min\(firstScreen\.firstBody\.height,\s*20\)/);
  assert.match(auditSource, /bodyVisibleHeight\s*<\s*minimumBodyVisible/);
  assert.match(auditSource, /shortPortrait\s*\?\s*90\s*:\s*shortLandscape\s*\?\s*24\s*:\s*portraitReference\s*\?\s*180/);
  assert.match(auditSource, /const minimumBodyVisible = portraitReference \? 200 : 44/);
  for (const viewport of ["359 && item.height === 500", "390 && item.height === 844", "844 && item.height === 390"]) {
    assert.ok(auditSource.includes(viewport), `article-only audit should cover ${viewport}`);
  }
});

test("article reader uses an observer, in-window scrolling, shareable hashes, and an explicit summary control", async () => {
  const [routeSource, indexSource, routeCss, mobileCss] = await Promise.all([
    readFile(new URL("../js/routes/knowledge.mjs", import.meta.url), "utf8"),
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../css/routes/knowledge.css", import.meta.url), "utf8"),
    readFile(new URL("../css/mobile-ios-shell.css", import.meta.url), "utf8")
  ]);

  assert.match(routeSource, /new window\.IntersectionObserver/);
  assert.match(routeSource, /root:\s*detail/);
  assert.match(routeSource, /window\.history\.replaceState/);
  assert.match(routeSource, /detail\.scrollTo\(\{ top: targetTop/);
  assert.doesNotMatch(routeSource, /heading\.scrollIntoView/);
  assert.match(routeSource, /image\.width = dimensions\.width/);
  assert.match(routeSource, /setTimeout\(\(\) =>[\s\S]*?120\)/);
  assert.match(routeSource, /articleState\.searchIndex = new Map/);
  assert.match(routeSource, /data-article-load-more|dataset\.articleLoadMore/);
  assert.match(routeSource, /article-pinned-badge/);
  assert.match(routeSource, /item\.category !== siteUpdateCategory && item\.is_pinned/);
  assert.match(indexSource, /id="article-summary-toggle"/);
  assert.match(indexSource, /aria-controls="article-detail-summary"/);
  assert.match(indexSource, /id="article-detail" aria-labelledby="article-detail-title"/);
  assert.match(indexSource, /id="article-detail-title" tabindex="-1"/);
  assert.match(indexSource, /data-article-scroll-top hidden/);
  assert.match(routeCss, /max-width:\s*82ch/);
  assert.match(routeCss, /user-select:\s*text/);
  assert.match(mobileCss, /#article-detail-meta[\s\S]*?flex-wrap:\s*wrap/);
  assert.match(mobileCss, /#article-summary-toggle\.is-expanded|#article-detail-summary\.is-expanded/);
  assert.match(mobileCss, /article-detail-head > p\.is-collapsible:not\(\.is-expanded\)[\s\S]*display:\s*none/);
  assert.match(routeSource, /const atArticleTop = !detail \|\| detail\.scrollTop <= 2/);
  assert.match(routeSource, /topButton\?\.toggleAttribute\("hidden", atArticleTop\)/);
  assert.match(routeSource, /document\.getElementById\("article-detail-title"\)\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(routeSource, /card\.setAttribute\("aria-labelledby", title\.id\)/);
  assert.doesNotMatch(routeSource, /card\.setAttribute\("aria-label", `\$\{t\("readButton"\)\}/);
  assert.match(routeSource, /image\.alt = ""/);
  assert.match(routeSource, /caption\.textContent = alt/);

  const controls = indexSource.slice(indexSource.indexOf('<div class="knowledge-window-controls"'), indexSource.indexOf('<div class="window-toolbar">'));
  assert.match(controls, /class="close-button"/);
  assert.doesNotMatch(controls, /minimize-button|data-article-window-toggle/);
  assert.doesNotMatch(routeSource, /toggleArticleWindowSize|updateArticleWindowButton|is-article-window-restored/);
  assert.doesNotMatch(routeCss, /is-article-window-restored/);
  assert.doesNotMatch(mobileCss, /data-article-window-toggle|is-article-window-restored/);
});
