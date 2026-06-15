import { readFileSync, existsSync } from "node:fs";
import { relative, resolve } from "node:path";

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

if (!process.exitCode) {
  console.log(`build-check: ok (${relative(root, resolve(root, "admin"))})`);
}
