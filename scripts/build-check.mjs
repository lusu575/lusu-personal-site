import { readFileSync, existsSync } from "node:fs";
import { relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");

const requiredFiles = [
  "admin/index.html",
  "admin/admin.css",
  "admin/admin.js",
  "admin/docs/ADMIN_CHANGELOG.md",
  "admin/docs/ADMIN_PROJECT_CONTEXT.md",
  "admin/docs/ADMIN_SKILL.md",
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
const adminMiddlewareJs = readRequired("functions/admin/_middleware.js");
const apiJs = readRequired("functions/api/[[route]].js");
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
  "visits-panel",
  "clicks-panel",
  "articles-panel",
  "videos-panel",
  "videoCategories-panel",
  "chat-panel",
  "accounts-panel",
  "updates-panel",
  "docs-panel",
  "admin-updates"
]) {
  if (!adminHtml.includes(`id="${id}"`)) {
    fail(`admin/index.html missing #${id}`);
  }
}

for (const panel of [
  "dashboard",
  "visits",
  "clicks",
  "articles",
  "videos",
  "videoCategories",
  "chat",
  "accounts",
  "updates",
  "docs"
]) {
  if (!adminHtml.includes(`data-panel="${panel}"`)) {
    fail(`admin/index.html missing nav button for ${panel}`);
  }
  if (!adminHtml.includes(`aria-controls="${panel}-panel"`)) {
    fail(`admin/index.html nav button for ${panel} is missing aria-controls`);
  }
}

if (!adminHtml.includes('class="nav-list" aria-label="后台功能导航"')) {
  fail("admin/index.html sidebar navigation must expose an aria-label");
}

if (!adminHtml.includes("账号管理和后台私有更新记录")) {
  fail("admin/index.html backend docs summary must mention account management");
}

if (!adminHtml.includes('id="dashboard-panel" aria-hidden="false"')) {
  fail("admin/index.html dashboard panel must expose its initial aria-hidden=false state");
}

for (const panel of [
  "visits",
  "clicks",
  "articles",
  "videos",
  "videoCategories",
  "chat",
  "accounts",
  "updates",
  "docs"
]) {
  if (!adminHtml.includes(`id="${panel}-panel" hidden aria-hidden="true"`)) {
    fail(`admin/index.html ${panel} panel must start hidden with aria-hidden=true`);
  }
}

for (const asset of ["admin.css", "admin.js"]) {
  const pattern = new RegExp(`/admin/${asset}\\?v=[^"']+`);
  if (!pattern.test(adminHtml)) {
    fail(`admin/index.html ${asset} reference is missing a cache-busting query`);
  }
}

if (!adminMiddlewareJs.includes("users.role")) {
  fail("functions/admin/_middleware.js must keep users.role admin checks");
}

if (/OWNER_ADMIN_EMAILS|630739094@qq\.com/.test(adminMiddlewareJs)) {
  fail("functions/admin/_middleware.js must not restore owner-email admin bypasses");
}

if (!apiJs.includes("async function requireAdmin")) {
  fail("functions/api/[[route]].js missing requireAdmin helper");
}

for (const sensitiveText of ["password_hash", "token_hash"]) {
  if (adminHtml.includes(sensitiveText) || adminJs.includes(sensitiveText)) {
    fail(`admin UI must not expose ${sensitiveText}`);
  }
}

for (const unsafeDomApi of ["innerHTML", "outerHTML", "insertAdjacentHTML"]) {
  if (adminJs.includes(unsafeDomApi)) {
    fail(`admin/admin.js must not render backend data with ${unsafeDomApi}`);
  }
}

if (/category\s*[:=]\s*["']site-updates["']/.test(adminJs)) {
  fail("admin private updates must not write public site-updates entries");
}

for (const requiredAdminGuard of [
  "renderArticleListNotice",
  "renderVideoListNotice",
  "renderVideoCategoryChecksNotice",
  "renderVideoCategoryListNotice",
  "renderBanListNotice",
  "renderAccountListNotice"
]) {
  if (!adminJs.includes(`function ${requiredAdminGuard}`)) {
    fail(`admin/admin.js missing ${requiredAdminGuard} local failure state`);
  }
}

if (!adminJs.includes('setElementText($("#ban-list-count"), label)')) {
  fail("admin/admin.js must sync ban list failure labels into the count badge");
}

if (!adminJs.includes("后台更新记录：") || !adminJs.includes("syncBoxLabel(box, adminUpdates.length")) {
  fail("admin/admin.js must sync the admin updates list aria label");
}

if (!adminJs.includes("暂无后台更新记录。")) {
  fail("admin/admin.js must keep an empty state for admin updates");
}

for (const contextualErrorPrefix of [
  "文章列表：",
  "分类列表：",
  "账号列表：",
  "partialError",
  "读取账号详情失败："
]) {
  if (!adminJs.includes(contextualErrorPrefix)) {
    fail(`admin/admin.js must keep contextual topbar errors for ${contextualErrorPrefix}`);
  }
}

if (!adminJs.includes("Promise.allSettled([loadVideoCategories(), loadVideos()])")) {
  fail("admin/admin.js must keep video category/list partial failure handling");
}

if (!adminJs.includes("Promise.allSettled([loadChatMessages(), loadBans()])")) {
  fail("admin/admin.js must keep chat messages/bans partial failure handling");
}

if (!adminJs.includes('const staticPanels = new Set(["updates", "docs"])')) {
  fail("admin/admin.js must keep updates/docs as static panels");
}

if (!adminJs.includes("视频分类选项：共") || !adminJs.includes("syncBoxLabel(box, checkLabel)")) {
  fail("admin/admin.js must reset video category check labels after recovery");
}

if (!adminJs.includes("item.hidden = !active") || !adminJs.includes('item.setAttribute("aria-hidden", active ? "false" : "true")')) {
  fail("admin/admin.js must keep panel hidden and aria-hidden states in sync");
}

if (!adminJs.includes("panel.hidden = !active") || !adminJs.includes('panel.setAttribute("aria-hidden", active ? "false" : "true")')) {
  fail("admin/admin.js must keep article language panel hidden and aria-hidden states in sync");
}

if (!adminJs.includes("function handleNavKeydown") || !adminJs.includes("button.addEventListener(\"keydown\"")) {
  fail("admin/admin.js sidebar navigation must keep keyboard arrow support");
}

for (const requiredNavKey of ["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft", "Home", "End"]) {
  if (!adminJs.includes(requiredNavKey)) {
    fail(`admin/admin.js sidebar navigation must handle ${requiredNavKey}`);
  }
}

for (const requiredTabKey of ["ArrowRight", "ArrowLeft", "Home", "End"]) {
  if (!adminJs.includes(requiredTabKey)) {
    fail(`admin/admin.js article language tabs must handle ${requiredTabKey}`);
  }
}

if (
  !adminHtml.includes('id="article-lang-panel-zh" aria-labelledby="article-lang-tab-zh" aria-hidden="false"') ||
  !adminHtml.includes('id="article-lang-panel-en" aria-labelledby="article-lang-tab-en" hidden aria-hidden="true"') ||
  !adminHtml.includes('id="article-lang-panel-ja" aria-labelledby="article-lang-tab-ja" hidden aria-hidden="true"')
) {
  fail("admin/index.html article language panels must expose initial aria-hidden state");
}

for (const requiredVideoBusyGuard of [
  "videoCoverProcessing",
  "videoCoverProcessingMode",
  "videoCoverProcessingTitle"
]) {
  if (!adminJs.includes(requiredVideoBusyGuard)) {
    fail(`admin/admin.js must keep local video cover processing guard ${requiredVideoBusyGuard}`);
  }
}

if (!adminHtml.includes('id="video-thumbnail-preview" role="status" aria-live="polite" aria-atomic="true"')) {
  fail("admin/index.html video thumbnail preview must remain a polite status region");
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
  ".file-picker:has(input:disabled)",
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

function createMockAdminD1(role = "admin") {
  return {
    prepare() {
      return {
        bind() {
          return this;
        },
        async first() {
          return {
            token_hash: "mock-token-hash",
            id: "mock-user",
            email: "admin@example.test",
            role
          };
        }
      };
    }
  };
}

function createThrowingAdminD1() {
  return {
    prepare() {
      throw new Error("mock D1 failure");
    }
  };
}

function assertAdminSecurityHeaders(response, label) {
  const expected = {
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex, nofollow",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "same-origin"
  };
  for (const [header, value] of Object.entries(expected)) {
    if (response.headers.get(header) !== value) {
      fail(`${label} missing ${header}: ${value}`);
    }
  }
}

try {
  const adminMiddlewarePath = resolve(root, "functions/admin/_middleware.js");
  const { onRequest: onAdminRequest } = await import(pathToFileURL(adminMiddlewarePath).href);
  const adminMissingDbResponse = await onAdminRequest({
    request: new Request("https://example.test/admin/index.html", {
      headers: { Accept: "text/html,application/xhtml+xml" }
    }),
    env: {},
    async next() {
      return new Response("unexpected admin pass-through");
    }
  });
  if (
    adminMissingDbResponse.status !== 500 ||
    adminMissingDbResponse.headers.get("Cache-Control") !== "no-store" ||
    !adminMissingDbResponse.headers.get("Content-Type")?.includes("text/plain")
  ) {
    fail(`functions/admin/_middleware.js should return a no-store text 500 when DB is missing, got ${adminMissingDbResponse.status}`);
  }
  assertAdminSecurityHeaders(adminMissingDbResponse, "functions/admin/_middleware.js missing DB response");

  const adminSessionFailureResponse = await onAdminRequest({
    request: new Request("https://example.test/admin/index.html", {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        Cookie: "lusu_session=mock-session"
      }
    }),
    env: { DB: createThrowingAdminD1() },
    async next() {
      return new Response("unexpected admin pass-through");
    }
  });
  if (
    adminSessionFailureResponse.status !== 500 ||
    adminSessionFailureResponse.headers.get("Cache-Control") !== "no-store" ||
    !adminSessionFailureResponse.headers.get("Content-Type")?.includes("text/plain")
  ) {
    fail(`functions/admin/_middleware.js should return a no-store text 500 when session lookup fails, got ${adminSessionFailureResponse.status}`);
  }
  assertAdminSecurityHeaders(adminSessionFailureResponse, "functions/admin/_middleware.js session failure response");

  const adminLoginResponse = await onAdminRequest({
    request: new Request("https://example.test/admin/index.html", {
      headers: { Accept: "text/html,application/xhtml+xml" }
    }),
    env: { DB: createMockD1() },
    async next() {
      return new Response("unexpected admin pass-through");
    }
  });
  const adminLoginHtml = await adminLoginResponse.text();
  if (
    adminLoginResponse.status !== 401 ||
    adminLoginResponse.headers.get("Cache-Control") !== "no-store" ||
    !adminLoginResponse.headers.get("Content-Type")?.includes("text/html") ||
    !adminLoginHtml.includes('id="login-form"')
  ) {
    fail(`functions/admin/_middleware.js should return the admin login page for anonymous HTML requests, got ${adminLoginResponse.status}`);
  }
  assertAdminSecurityHeaders(adminLoginResponse, "functions/admin/_middleware.js login response");
  for (const requiredLoginSnippet of [
    'inputmode="email"',
    'autocapitalize="none"',
    'spellcheck="false"',
    'maxlength="254"',
    'maxlength="128"',
    'className = tone ? "status " + tone : "status"'
  ]) {
    if (!adminLoginHtml.includes(requiredLoginSnippet)) {
      fail(`functions/admin/_middleware.js login page missing ${requiredLoginSnippet}`);
    }
  }

  const malformedCookieResponse = await onAdminRequest({
    request: new Request("https://example.test/admin/index.html", {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        Cookie: "lusu_session=%E0%A4%A"
      }
    }),
    env: { DB: createMockD1() },
    async next() {
      return new Response("unexpected admin pass-through");
    }
  });
  if (malformedCookieResponse.status !== 401) {
    fail(`functions/admin/_middleware.js should treat malformed session cookies as anonymous, got ${malformedCookieResponse.status}`);
  }
  assertAdminSecurityHeaders(malformedCookieResponse, "functions/admin/_middleware.js malformed cookie response");

  const adminAssetResponse = await onAdminRequest({
    request: new Request("https://example.test/admin/admin.js", {
      headers: { Accept: "*/*" }
    }),
    env: { DB: createMockD1() },
    async next() {
      return new Response("unexpected admin asset pass-through");
    }
  });
  if (
    adminAssetResponse.status !== 403 ||
    adminAssetResponse.headers.get("Cache-Control") !== "no-store" ||
    !adminAssetResponse.headers.get("Content-Type")?.includes("text/plain")
  ) {
    fail(`functions/admin/_middleware.js should reject anonymous non-HTML admin assets, got ${adminAssetResponse.status}`);
  }
  assertAdminSecurityHeaders(adminAssetResponse, "functions/admin/_middleware.js anonymous asset response");

  const adminPassResponse = await onAdminRequest({
    request: new Request("https://example.test/admin/admin.js", {
      headers: {
        Accept: "*/*",
        Cookie: "lusu_session=mock-session"
      }
    }),
    env: { DB: createMockAdminD1("admin") },
    async next() {
      return new Response("admin pass-through");
    }
  });
  const adminPassBody = await adminPassResponse.text();
  if (
    adminPassResponse.status !== 200 ||
    adminPassResponse.headers.get("Cache-Control") !== "no-store" ||
    adminPassBody !== "admin pass-through"
  ) {
    fail(`functions/admin/_middleware.js should allow users.role=admin, got ${adminPassResponse.status}`);
  }
  assertAdminSecurityHeaders(adminPassResponse, "functions/admin/_middleware.js admin pass-through response");

  const nonAdminHtmlResponse = await onAdminRequest({
    request: new Request("https://example.test/admin/index.html", {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        Cookie: "lusu_session=mock-session"
      }
    }),
    env: { DB: createMockAdminD1("user") },
    async next() {
      return new Response("unexpected non-admin pass-through");
    }
  });
  const nonAdminHtml = await nonAdminHtmlResponse.text();
  if (
    nonAdminHtmlResponse.status !== 403 ||
    nonAdminHtmlResponse.headers.get("Cache-Control") !== "no-store" ||
    !nonAdminHtmlResponse.headers.get("Content-Type")?.includes("text/html") ||
    !nonAdminHtml.includes("没有后台权限")
  ) {
    fail(`functions/admin/_middleware.js should show a denied login page for non-admin HTML requests, got ${nonAdminHtmlResponse.status}`);
  }
  assertAdminSecurityHeaders(nonAdminHtmlResponse, "functions/admin/_middleware.js non-admin HTML response");

  const nonAdminAssetResponse = await onAdminRequest({
    request: new Request("https://example.test/admin/admin.js", {
      headers: {
        Accept: "*/*",
        Cookie: "lusu_session=mock-session"
      }
    }),
    env: { DB: createMockAdminD1("user") },
    async next() {
      return new Response("unexpected non-admin asset pass-through");
    }
  });
  if (
    nonAdminAssetResponse.status !== 403 ||
    nonAdminAssetResponse.headers.get("Cache-Control") !== "no-store" ||
    !nonAdminAssetResponse.headers.get("Content-Type")?.includes("text/plain")
  ) {
    fail(`functions/admin/_middleware.js should reject non-admin assets, got ${nonAdminAssetResponse.status}`);
  }
  assertAdminSecurityHeaders(nonAdminAssetResponse, "functions/admin/_middleware.js non-admin asset response");

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

  const originalConsoleError = console.error;
  let adminResponse;
  try {
    console.error = () => {};
    adminResponse = await onRequest({
      request: new Request("https://example.test/api/admin/me"),
      env: { DB: createMockD1() },
      waitUntil() {}
    });
  } finally {
    console.error = originalConsoleError;
  }
  if (![401, 403].includes(adminResponse.status)) {
    const body = await adminResponse.text();
    fail(`functions/api/[[route]].js /api/admin/me should reject anonymous requests, got ${adminResponse.status}: ${body}`);
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
  fail(`runtime check failed: ${error.message}`);
}

if (!process.exitCode) {
  console.log(`build-check: ok (${relative(root, resolve(root, "admin"))}, api articles/videos/sitemap, admin auth)`);
}
