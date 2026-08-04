import assert from "node:assert/strict";
import test from "node:test";
import {
  extractArticleSlugFromSitemap,
  extractHashedAssetPath,
  normalizeSiteOrigin,
  validateArticleHtml,
  validateHealth,
  validateHomeHtml,
  validateSitemap
} from "../scripts/production-smoke.mjs";

const origin = "https://lusu575.com";
const alternates = ["zh", "en", "ja", "x-default"]
  .map((lang) => `<xhtml:link rel="alternate" hreflang="${lang}" href="${origin}/?lang=zh"/>`)
  .join("");
const sitemap = `<?xml version="1.0"?><urlset xmlns:xhtml="http://www.w3.org/1999/xhtml"><url><loc>${origin}/?lang=zh</loc><lastmod>2026-08-02</lastmod>${alternates}</url><url><loc>${origin}/articles/monitoring-update?lang=zh</loc><lastmod>2026-08-02</lastmod>${alternates}</url></urlset>`;

test("production smoke validators lock the canonical SEO and health contract", () => {
  assert.equal(normalizeSiteOrigin(`${origin}/nested`), origin);
  assert.throws(() => normalizeSiteOrigin("http://lusu575.com"), /HTTPS/);
  validateHealth({ ok: true, db: true });
  assert.throws(() => validateHealth({ ok: true, db: false }), /D1/);
  validateSitemap(sitemap, origin);
  assert.equal(extractArticleSlugFromSitemap(sitemap), "monitoring-update");
  assert.throws(() => validateSitemap(sitemap.replaceAll(origin, "https://www.lusu575.com"), origin), /canonical origin/);
});

test("production smoke validators cover home, article metadata, and immutable asset discovery", () => {
  const home = `<link rel="canonical" href="${origin}/?lang=zh"><link rel="stylesheet" href="/_assets/site.abc123.css"><script type="module" src="/_assets/main.def456.js"></script>`;
  validateHomeHtml(home, origin);
  assert.equal(extractHashedAssetPath(home), "/_assets/site.abc123.css");

  const article = [
    `<link rel="canonical" href="${origin}/articles/monitoring-update?lang=zh">`,
    ...["zh", "en", "ja", "x-default"].map((lang) => `<link rel="alternate" hreflang="${lang}" href="${origin}/articles/monitoring-update?lang=zh">`),
    '<script type="application/ld+json">{"@type":"Article","author":{"@type":"Person"},"publisher":{"@type":"Organization"}}</script>'
  ].join("");
  validateArticleHtml(article, "monitoring-update", origin);
});
