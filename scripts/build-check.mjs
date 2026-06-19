import { readFileSync, existsSync } from "node:fs";
import { relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");

const requiredFiles = [
  "admin/index.html",
  "admin/admin.css",
  "admin/admin.js",
  "functions/admin/_middleware.js",
  "functions/api/[[route]].js",
  "functions/sitemap.xml.js",
  "js/main.js",
  "js/telemetry.js",
  "manifest.webmanifest",
  "robots.txt",
  "CHANGELOG.md"
];

function fail(message) {
  console.error(`build-check: ${message}`);
  process.exitCode = 1;
}

function readRequired(path) {
  const fullPath = resolve(root, path);
  if (!existsSync(fullPath)) {
    fail(`missing ${path}`);
    return "";
  }
  return readFileSync(fullPath, "utf8");
}

for (const file of requiredFiles) {
  readRequired(file);
}

const adminHtml = readRequired("admin/index.html");
const adminCss = readRequired("admin/admin.css");
const adminJs = readRequired("admin/admin.js");
const indexHtml = readRequired("index.html");
const mainJs = readRequired("js/main.js");
const telemetryJs = readRequired("js/telemetry.js");
const manifest = readRequired("manifest.webmanifest");
const robots = readRequired("robots.txt");

for (const asset of ["/admin/admin.css", "/admin/admin.js"]) {
  if (!adminHtml.includes(asset)) {
    fail(`admin/index.html does not reference ${asset}`);
  }
}

for (const id of [
  "dashboard-panel",
  "articles-panel",
  "visits-panel",
  "clicks-panel",
  "chat-panel",
  "docs-panel",
  "admin-updates"
]) {
  if (!adminHtml.includes(`id="${id}"`)) {
    fail(`admin/index.html missing #${id}`);
  }
}

try {
  new Function(adminJs);
} catch (error) {
  fail(`admin/admin.js syntax error: ${error.message}`);
}

try {
  new Function(mainJs);
} catch (error) {
  fail(`js/main.js syntax error: ${error.message}`);
}

try {
  new Function(telemetryJs);
} catch (error) {
  fail(`js/telemetry.js syntax error: ${error.message}`);
}

const openBraces = (adminCss.match(/\{/g) || []).length;
const closeBraces = (adminCss.match(/\}/g) || []).length;
if (openBraces !== closeBraces) {
  fail(`admin/admin.css brace mismatch (${openBraces} open, ${closeBraces} close)`);
}

for (const selector of [
  ".admin-shell",
  ".sidebar",
  ".topbar",
  ".xp-panel",
  ".table-wrap",
  "@media (max-width: 760px)"
]) {
  if (!adminCss.includes(selector)) {
    fail(`admin/admin.css missing ${selector}`);
  }
}

for (const token of [
  'rel="canonical"',
  'property="og:title"',
  'name="twitter:card"',
  'rel="manifest"',
  'data-rss-alternate'
]) {
  if (!indexHtml.includes(token)) {
    fail(`index.html missing ${token}`);
  }
}

for (const token of ['"display": "standalone"', '"theme_color"', '"icons"']) {
  if (!manifest.includes(token)) {
    fail(`manifest.webmanifest missing ${token}`);
  }
}

if (!robots.includes("Disallow: /admin/") || !robots.includes("Sitemap: https://lusu575.com/sitemap.xml")) {
  fail("robots.txt missing admin disallow or sitemap pointer");
}

function createMockD1() {
  function createStatement(sql) {
    return {
      sql,
      params: [],
      bind(...params) {
        this.params = params;
        return this;
      },
      async run() {
        return { success: true };
      },
      async first() {
        return null;
      },
      async all() {
        return { results: [] };
      }
    };
  }

  return {
    prepare(sql) {
      if (typeof sql !== "string") {
        throw new TypeError("D1 prepare expected SQL string");
      }
      return createStatement(sql);
    },
    async batch(statements) {
      for (const statement of statements) {
        if (statement && typeof statement.run === "function") {
          await statement.run();
        }
      }
      return [];
    }
  };
}

try {
  const apiPath = resolve(root, "functions/api/[[route]].js");
  const { onRequest } = await import(pathToFileURL(apiPath).href);
  for (const path of ["/api/articles?lang=zh", "/api/videos?lang=zh", "/api/sitemap.xml"]) {
    const response = await onRequest({
      request: new Request(`https://example.test${path}`),
      env: { DB: createMockD1() },
      waitUntil() {}
    });

    if (!response || typeof response.status !== "number") {
      fail(`functions/api/[[route]].js did not return a Response for ${path}`);
    } else if (response.status >= 500) {
      const body = await response.text();
      fail(`functions/api/[[route]].js ${path} returned ${response.status}: ${body}`);
    }
  }

  const sitemapPath = resolve(root, "functions/sitemap.xml.js");
  const { onRequest: onSitemapRequest } = await import(pathToFileURL(sitemapPath).href);
  const sitemapResponse = await onSitemapRequest({
    request: new Request("https://example.test/sitemap.xml"),
    env: { DB: createMockD1() },
    waitUntil() {}
  });
  if (!sitemapResponse || sitemapResponse.status >= 500) {
    const body = sitemapResponse ? await sitemapResponse.text() : "";
    fail(`functions/sitemap.xml.js returned ${sitemapResponse?.status || "no response"}: ${body}`);
  } else if (!String(sitemapResponse.headers.get("Content-Type") || "").includes("application/xml")) {
    fail("functions/sitemap.xml.js did not return XML content type");
  }
} catch (error) {
  fail(`functions/api/[[route]].js runtime check failed: ${error.message}`);
}

if (!process.exitCode) {
  console.log(`build-check: ok (${relative(root, resolve(root, "admin"))}, api articles/videos/sitemap)`);
}
