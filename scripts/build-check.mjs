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
  for (const path of ["/api/articles?lang=zh", "/api/videos?lang=zh"]) {
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
} catch (error) {
  fail(`functions/api/[[route]].js runtime check failed: ${error.message}`);
}

if (!process.exitCode) {
  console.log(`build-check: ok (${relative(root, resolve(root, "admin"))}, api articles/videos)`);
}
