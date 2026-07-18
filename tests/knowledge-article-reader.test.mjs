import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  articleImageDimensions,
  deduplicateArticleHeadingAnchors,
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
  const ordered = sortKnowledgeArticles([
    { slug: "new", published_at: "2026-07-18T00:00:00Z", is_pinned: 0 },
    { slug: "pinned-old", published_at: "2025-01-01T00:00:00Z", is_pinned: 1 },
    { slug: "older", published_at: "2026-07-17T00:00:00Z", is_pinned: 0 }
  ]);
  assert.deepEqual(ordered.map(({ slug }) => slug), ["pinned-old", "new", "older"]);
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
  assert.match(indexSource, /id="article-summary-toggle"/);
  assert.match(indexSource, /aria-controls="article-detail-summary"/);
  assert.match(routeCss, /max-width:\s*82ch/);
  assert.match(routeCss, /user-select:\s*text/);
  assert.match(mobileCss, /#article-detail-meta[\s\S]*?flex-wrap:\s*wrap/);
  assert.match(mobileCss, /#article-summary-toggle\.is-expanded|#article-detail-summary\.is-expanded/);
});
