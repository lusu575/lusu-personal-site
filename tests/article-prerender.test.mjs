import assert from "node:assert/strict";
import test from "node:test";
import {
  articleNoScriptShowsSummary,
  buildArticleMetadata,
  escapeHtml,
  normalizeArticleRoute,
  safeArticleImageUrl
} from "../functions/articles/[slug].js";

test("Daily AI News keeps metadata summary but omits the visible noscript repeat", () => {
  assert.equal(articleNoScriptShowsSummary("daily-ai-news"), false);
  assert.equal(articleNoScriptShowsSummary("note"), true);
});

test("article prerender accepts one safe slug and a supported language", () => {
  assert.deepEqual(
    normalizeArticleRoute(
      "https://lusu575.com/articles/example-entry?lang=en&audit=ignored",
      "example-entry"
    ),
    { ok: true, slug: "example-entry", lang: "en" }
  );
  assert.equal(
    normalizeArticleRoute("https://lusu575.com/articles/bad?lang=xx", ["bad", "extra"]).ok,
    false
  );
  assert.equal(
    normalizeArticleRoute("https://lusu575.com/articles/%3Cscript%3E", "<script>").ok,
    false
  );
});

test("article metadata uses the actual translation and canonical article URL", () => {
  const metadata = buildArticleMetadata({
    lang: "ja",
    title: "安全な記事",
    summary: "記事の概要",
    cover_image: "/assets/images/cover.png",
    created_at: "2026-07-26T00:00:00.000Z",
    updated_at: "2026-07-26T01:00:00.000Z"
  }, "safe-article");
  assert.equal(metadata.htmlLang, "ja");
  assert.equal(metadata.locale, "ja_JP");
  assert.equal(metadata.documentTitle, "安全な記事 | LuSu Site");
  assert.equal(metadata.canonical, "https://lusu575.com/articles/safe-article?lang=ja");
  assert.equal(metadata.image, "https://lusu575.com/assets/images/cover.png");
  assert.equal(metadata.publishedAt, "2026-07-26T00:00:00.000Z");
});

test("article prerender rejects unsafe image schemes and escapes noscript text", () => {
  assert.match(safeArticleImageUrl("javascript:alert(1)"), /homepage-pixel-coast/);
  assert.match(safeArticleImageUrl("http://example.com/cover.png"), /homepage-pixel-coast/);
  assert.equal(
    escapeHtml(`<img src=x onerror="alert(1)">`),
    "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"
  );
});
