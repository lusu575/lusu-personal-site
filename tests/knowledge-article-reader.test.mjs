import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { translations } from "../js/core/i18n.mjs";
import {
  PUBLIC_ARTICLE_ARCHIVE_LIMIT,
  articleDetailShowsSummary,
  articleLanguageTag,
  articleImageDimensions,
  articleReadProgressPercent,
  articleTocHeadingSelector,
  deduplicateArticleHeadingAnchors,
  knowledgeCategoryValues,
  knowledgeArticlesForCategory,
  knowledgeSearchTokens,
  normalizeArticleHeadingAnchor,
  normalizeKnowledgeSearchText,
  safeArticleLinkHref,
  sortKnowledgeArticles
} from "../js/routes/knowledge.mjs";

test("the public knowledge archive keeps older unpinned articles and their categories beyond 50 records", async () => {
  assert.equal(PUBLIC_ARTICLE_ARCHIVE_LIMIT, 500);

  const olderArticle = {
    slug: "ai-agent-workflow-guide",
    category: "ai",
    is_pinned: 0,
    published_at: "2026-06-14T15:00:00.000Z"
  };
  const archive = [
    ...Array.from({ length: 50 }, (_, index) => ({
      slug: `newer-${index + 1}`,
      category: "note",
      is_pinned: 0,
      published_at: `2026-07-${String(28 - Math.floor(index / 2)).padStart(2, "0")}T${String(index % 24).padStart(2, "0")}:00:00.000Z`
    })),
    olderArticle
  ];
  const categories = knowledgeCategoryValues(archive, {
    firstCategory: "daily-ai-news",
    lastCategory: "site-updates"
  });

  assert.ok(categories.includes("ai"));
  assert.deepEqual(
    knowledgeArticlesForCategory(archive, "ai").map(({ slug }) => slug),
    ["ai-agent-workflow-guide"]
  );

  const [routeSource, apiSource] = await Promise.all([
    readFile(new URL("../js/routes/knowledge.mjs", import.meta.url), "utf8"),
    readFile(new URL("../functions/api/[[route]].js", import.meta.url), "utf8")
  ]);
  assert.match(routeSource, /\/api\/articles\?lang=\$\{encodeURIComponent\(requestedLang\)\}&limit=\$\{PUBLIC_ARTICLE_ARCHIVE_LIMIT\}/);
  assert.match(apiSource, /export const PUBLIC_ARTICLE_ARCHIVE_LIMIT = 500/);
  assert.match(apiSource, /clampLimit\(url\.searchParams\.get\("limit"\), PUBLIC_ARTICLE_ARCHIVE_LIMIT\)/);
});

test("Daily AI News reader hides the repeated summary and indexes story headlines", () => {
  assert.equal(articleDetailShowsSummary("daily-ai-news"), false);
  assert.equal(articleDetailShowsSummary("tool-radar"), true);
  assert.equal(articleDetailShowsSummary("note"), true);
  assert.equal(articleTocHeadingSelector("daily-ai-news"), "h4");
  assert.equal(articleTocHeadingSelector("tool-radar"), "h2, h3");
  assert.equal(articleTocHeadingSelector("site-updates"), "h2, h3");
});

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
  assert.deepEqual(
    articleImageDimensions("assets/images/articles/tool-radar/2026-07-28/context7-official-doc-chat.webp"),
    { width: 1020, height: 1554 }
  );
  assert.deepEqual(
    articleImageDimensions("assets/images/articles/tool-radar/2026-07-28/60fps-official-gallery.webp?v=1"),
    { width: 1280, height: 800 }
  );
  assert.deepEqual(
    articleImageDimensions("assets/images/articles/site-guides/password-room-chat-desktop.png?v=1375ed179bd8672af824c272f806f71d350d0485ab57067d9b4baaaca8a57440"),
    { width: 1440, height: 900 }
  );
  assert.deepEqual(
    articleImageDimensions("assets/images/articles/site-guides/password-room-whiteboard-mobile.png?v=44578f131f03ef3044dd87e69a53e2bcb1d9865fb761d9920cdd3bc96293894d"),
    { width: 390, height: 844 }
  );
  assert.equal(
    articleImageDimensions("assets/images/articles/tool-radar/2026-07-28/context7-explainer.png"),
    null
  );
  assert.equal(articleImageDimensions("assets/images/articles/unknown.png"), null);
});

test("article Markdown links accept only credential-free absolute HTTPS URLs", () => {
  assert.equal(safeArticleLinkHref("https://example.com/docs?q=1#start"), "https://example.com/docs?q=1#start");
  assert.equal(safeArticleLinkHref(" HTTPS://例子.测试/文档 "), "https://xn--fsqu00a.xn--0zwm56d/%E6%96%87%E6%A1%A3");
  for (const value of [
    "http://example.com",
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "blob:https://example.com/id",
    "file:///tmp/a",
    "mailto:test@example.com",
    "tel:+123",
    "//example.com/path",
    "/relative/path",
    "#section",
    "https://user@example.com/private",
    "https://user:password@example.com/private",
    "not a url"
  ]) {
    assert.equal(safeArticleLinkHref(value), "", value);
  }
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

test("Site Updates stay out of All and remain available in their dedicated category", () => {
  const articles = [
    { slug: "note", category: "note" },
    { slug: "update-one", category: "site-updates" },
    { slug: "news", category: "daily-ai-news" },
    { slug: "update-two", category: "site-updates" }
  ];
  assert.deepEqual(
    knowledgeArticlesForCategory(articles, "all").map(({ slug }) => slug),
    ["note", "news"]
  );
  assert.deepEqual(
    knowledgeArticlesForCategory(articles, "site-updates").map(({ slug }) => slug),
    ["update-one", "update-two"]
  );
});

test("Daily AI News, Tool Radar, and Website Guides remain stable leading categories while Site Updates remains last", async () => {
  const categories = knowledgeCategoryValues([
    { category: "note" },
    { category: "site-updates" },
    { category: "daily-ai-news" },
    { category: "tool-radar" },
    { category: "site-guides" },
    { category: "note" }
  ], {
    fixedCategories: ["daily-ai-news", "tool-radar", "site-guides"],
    firstCategory: "daily-ai-news",
    lastCategory: "site-updates",
    labelFor: (value) => ({ note: "Notes" }[value] || value)
  });
  assert.deepEqual(categories, ["daily-ai-news", "tool-radar", "site-guides", "note", "site-updates"]);
  assert.deepEqual(knowledgeCategoryValues([], {
    fixedCategories: ["daily-ai-news", "tool-radar", "site-guides"],
    firstCategory: "daily-ai-news",
    lastCategory: "site-updates"
  }), ["daily-ai-news", "tool-radar", "site-guides"]);

  for (const language of ["zh", "en", "ja"]) {
    assert.ok(translations[language].toolRadarEmpty.trim());
    assert.ok(translations[language].siteGuidesEmpty.trim());
  }

  const [mainSource, routeSource] = await Promise.all([
    readFile(new URL("../js/main.js", import.meta.url), "utf8"),
    readFile(new URL("../js/routes/knowledge.mjs", import.meta.url), "utf8")
  ]);
  assert.match(mainSource, /const toolRadarCategory = "tool-radar"/);
  assert.match(mainSource, /const siteGuidesCategory = "site-guides"/);
  assert.match(mainSource, /"tool-radar":\s*\{[\s\S]*?zh:\s*"工具雷达"[\s\S]*?en:\s*"Tool Radar"[\s\S]*?ja:\s*"ツールレーダー"/);
  assert.match(mainSource, /"site-guides":\s*\{[\s\S]*?zh:\s*"网站使用指南"[\s\S]*?en:\s*"Website Guides"[\s\S]*?ja:\s*"サイト利用ガイド"/);
  assert.match(routeSource, /fixedCategories:\s*\[dailyAiNewsCategory,\s*toolRadarCategory,\s*siteGuidesCategory\]/);
  assert.match(routeSource, /activeFilters\.knowledge === toolRadarCategory[\s\S]*?t\("toolRadarEmpty"\)/);
  assert.match(routeSource, /activeFilters\.knowledge === siteGuidesCategory[\s\S]*?t\("siteGuidesEmpty"\)/);
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
  assert.match(source, /renderArticleToc\(article\.lang,\s*article\.category\)/);
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

test("article navigation and multiline TOC geometry stay scroll-safe across desktop and mobile", async () => {
  const [indexSource, routeCss, mobileCss, mainSource, auditSource] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../css/routes/knowledge.css", import.meta.url), "utf8"),
    readFile(new URL("../css/mobile-ios-shell.css", import.meta.url), "utf8"),
    readFile(new URL("../js/main.js", import.meta.url), "utf8"),
    readFile(new URL("../scripts/public-ui-audit.mjs", import.meta.url), "utf8")
  ]);

  const sidebarMarkup = indexSource.slice(
    indexSource.indexOf('<aside class="article-reader-sidebar">'),
    indexSource.indexOf('<div class="article-detail-card">')
  );
  assert.match(sidebarMarkup, /data-article-back[\s\S]*?id="article-detail-toc"/);
  assert.match(routeCss, /\.article-back-button\s*\{[^}]*width:\s*100%[^}]*position:\s*static/);
  assert.match(routeCss, /\.article-reader-sidebar\s*\{[^}]*grid-template-rows:\s*auto\s+minmax\(0,\s*1fr\)\s+auto[^}]*height:\s*clamp\(320px,\s*calc\(100dvh - 246px\),\s*700px\)[^}]*position:\s*sticky[^}]*top:\s*18px/);
  assert.match(routeCss, /\.article-toc\s*\{[^}]*grid-template-rows:\s*auto\s+minmax\(0,\s*1fr\)[^}]*min-height:\s*0/);
  assert.match(routeCss, /#article-detail-toc-list\s*\{[^}]*grid-auto-rows:\s*max-content[^}]*max-height:\s*none[^}]*padding:\s*10px\s+20px\s+34px\s+10px[^}]*overflow:\s*auto/);
  assert.match(routeCss, /\.article-toc-link\s*\{[^}]*height:\s*auto[^}]*min-height:\s*0[^}]*padding:\s*8px\s+10px[^}]*line-height:\s*1\.45/);
  assert.match(routeCss, /\.article-top-link\s*\{[^}]*right:\s*var\(--article-top-control-right[^}]*bottom:\s*var\(--article-top-control-bottom/);
  assert.match(mobileCss, /html\[data-ui-shell="mobile"\]\s+body\.is-article-reading\s+\.folder-layout\.is-reading\s+\.article-reader-sidebar\s*\{[^}]*min-height:\s*0/);
  assert.match(mobileCss, /html\[data-ui-shell="mobile"\]\s+\.article-reader-sidebar\s*\{[^}]*min-height:\s*0[^}]*height:\s*auto/);
  assert.match(mobileCss, /@media \(orientation:\s*portrait\) and \(max-height:\s*560px\)[\s\S]*?\.article-toc\s*\{[^}]*height:\s*auto[^}]*max-height:\s*86px/);
  assert.match(mobileCss, /@media \(orientation:\s*portrait\) and \(max-height:\s*560px\)[\s\S]*?\.article-toc-link\s*\{[^}]*height:\s*auto[^}]*white-space:\s*normal/);
  assert.match(mainSource, /scrollToArticleHeading\(articleHeadingButton\.dataset\.articleHeadingTarget,\s*\{\s*behavior:\s*"auto"\s*\}\)/);
  assert.match(auditSource, /article-first-screen-\$\{viewport\.width\}x\$\{viewport\.height\}\.png/);
  assert.match(auditSource, /mobile article sidebar reserves/);
  assert.match(auditSource, /firstBodyVisibleHeight\s*<\s*Math\.min\(firstScreen\.firstBody\.height,\s*20\)/);
  assert.match(auditSource, /bodyVisibleHeight\s*<\s*minimumBodyVisible/);
  assert.match(auditSource, /shortPortrait\s*\?\s*90\s*:\s*shortLandscape\s*\?\s*24\s*:\s*portraitReference\s*\?\s*180/);
  assert.match(auditSource, /const minimumBodyVisible = portraitReference \? 200 : 44/);
  for (const viewport of [
    "359 && item.height === 500",
    "375 && item.height === 667",
    "390 && item.height === 844",
    "844 && item.height === 390",
    "1280 && item.height === 720"
  ]) {
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
  assert.match(routeSource, /querySelectorAll\("\[data-article-toc-heading\]\[id\]"\)/);
  assert.match(routeSource, /articleTocHeadingSelector\(articleCategory\)/);
  assert.match(routeSource, /querySelectorAll\(selector\)/);
  assert.match(routeSource, /article\.category \|\| "note"/);
  assert.match(routeSource, /article\.updated_at \|\| ""/);
  assert.match(routeSource, /heading\.dataset\.articleTocHeading = ""/);
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
  assert.match(routeSource, /const explicitCaption = lines\[captionIndex\]\?\.trim\(\)/);
  assert.match(routeSource, /index = explicitCaption \? captionIndex \+ 1 : index \+ 1/);
  assert.match(routeSource, /image\.alt = explicitCaption \? String\(alt \|\| ""\) : ""/);
  assert.match(routeSource, /const visibleCaption = explicitCaption \|\| alt/);
  assert.match(routeSource, /if \(explicitCaption\) \{\s*appendInlineMarkdown\(caption, explicitCaption\)/);
  assert.match(routeSource, /caption\.textContent = alt/);
  assert.match(routeSource, /const href = safeArticleLinkHref\(link\[2\]\)/);
  assert.match(routeSource, /const anchor = document\.createElement\("a"\)/);
  assert.match(routeSource, /anchor\.textContent = link\[1\]/);
  assert.match(routeSource, /anchor\.target = "_blank"/);
  assert.match(routeSource, /anchor\.rel = "noreferrer noopener"/);
  assert.doesNotMatch(routeSource, /caption\.innerHTML|parent\.innerHTML/);

  const controls = indexSource.slice(indexSource.indexOf('<div class="knowledge-window-controls"'), indexSource.indexOf('<div class="window-toolbar">'));
  assert.match(controls, /class="close-button"/);
  assert.doesNotMatch(controls, /minimize-button|data-article-window-toggle/);
  assert.doesNotMatch(routeSource, /toggleArticleWindowSize|updateArticleWindowButton|is-article-window-restored/);
  assert.doesNotMatch(routeCss, /is-article-window-restored/);
  assert.doesNotMatch(mobileCss, /data-article-window-toggle|is-article-window-restored/);
});
