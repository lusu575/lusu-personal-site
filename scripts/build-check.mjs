import { readFileSync, existsSync } from "node:fs";
import { relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { runInNewContext } from "node:vm";

const root = resolve(import.meta.dirname, "..");
const analyticsRedactionMarker = "[email]";
const frontendEmailSmokeSample = {
  literal: "user@example.com",
  encoded: "encoded%40example.com",
  doubleEncoded: "double%2540example%252Ecom"
};
const backendEmailSmokeSample = {
  literal: "private-user@example.test"
};
backendEmailSmokeSample.encoded = encodeURIComponent(backendEmailSmokeSample.literal);
backendEmailSmokeSample.doubleEncoded = encodeURIComponent(backendEmailSmokeSample.encoded);
const frontendForbiddenEmailTexts = Object.values(frontendEmailSmokeSample);
const backendForbiddenEmailTexts = Object.values(backendEmailSmokeSample);

const requiredFiles = [
  "admin/index.html",
  "admin/admin.css",
  "admin/admin.js",
  "admin/docs/ADMIN_CHANGELOG.md",
  "admin/docs/ADMIN_PROJECT_CONTEXT.md",
  "admin/docs/ADMIN_SKILL.md",
  "cloudflare/schema.sql",
  "functions/admin/_middleware.js",
  "functions/api/[[route]].js",
  "functions/sitemap.xml.js",
  "css/style.css",
  "games/2048/index.html",
  "games/a-dark-room/index.html",
  "games/hextris/index.html",
  "games/kittens-game/index.html",
  "games/life-restart/index.html",
  "games/game-shell.js",
  "js/main.js",
  "js/telemetry.js",
  "manifest.webmanifest",
  "package.json",
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

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasVersionedAssetReference(html, assetPath) {
  const pattern = new RegExp(`${escapeRegExp(assetPath)}\\?v=[^"']+`);
  return pattern.test(html);
}

function findRequiredHtml(source, pattern, message) {
  const match = source.match(pattern);
  if (!match) {
    fail(message);
    return "";
  }
  return match[0];
}

function tagWithAttributesPattern(tagName, attributes) {
  const tag = escapeRegExp(tagName);
  const lookaheads = attributes.map((attribute) => `(?=[^>]*${escapeRegExp(attribute)})`).join("");
  return new RegExp(`<${tag}\\b${lookaheads}[^>]*>[\\s\\S]*?</${tag}>`);
}

function hasPattern(source, pattern) {
  pattern.lastIndex = 0;
  return pattern.test(source);
}

function requireFunctionPattern(source, marker, pattern, message) {
  const body = objectBlockAfterMarker(source, marker);
  if (!body) {
    fail(`missing ${marker}`);
    return;
  }
  if (!hasPattern(body, pattern)) {
    fail(message);
  }
}

function countLiteral(source, token) {
  return source.split(token).length - 1;
}

function windowAfter(source, marker, length = 1200) {
  const index = source.indexOf(marker);
  return index >= 0 ? source.slice(index, index + length) : "";
}

function markdownSection(source, heading) {
  const start = source.indexOf(heading);
  if (start < 0) {
    return "";
  }
  const rest = source.slice(start + heading.length);
  const next = rest.search(/\n##\s+/);
  return heading + (next >= 0 ? rest.slice(0, next) : rest);
}

function objectBlockFromOpenBrace(source, openIndex) {
  let depth = 0;
  let quote = "";
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = openIndex; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (lineComment) {
      if (char === "\n") {
        lineComment = false;
      }
      continue;
    }

    if (blockComment) {
      if (char === "*" && next === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = "";
      }
      continue;
    }

    if (char === "/" && next === "/") {
      lineComment = true;
      index += 1;
      continue;
    }

    if (char === "/" && next === "*") {
      blockComment = true;
      index += 1;
      continue;
    }

    if (char === "\"" || char === "'" || char === "`") {
      quote = char;
      continue;
    }

    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(openIndex + 1, index);
      }
    }
  }

  return "";
}

function objectBlockAfterMarker(source, marker) {
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) {
    return "";
  }
  let searchFrom = markerIndex + marker.length;
  if (/\bfunction\s+\S+$/.test(marker)) {
    const paramsOpenIndex = source.indexOf("(", markerIndex);
    if (paramsOpenIndex >= 0) {
      let depth = 0;
      let quote = "";
      let escaped = false;
      for (let index = paramsOpenIndex; index < source.length; index += 1) {
        const char = source[index];
        if (quote) {
          if (escaped) {
            escaped = false;
          } else if (char === "\\") {
            escaped = true;
          } else if (char === quote) {
            quote = "";
          }
          continue;
        }
        if (char === "\"" || char === "'" || char === "`") {
          quote = char;
          continue;
        }
        if (char === "(") {
          depth += 1;
        } else if (char === ")") {
          depth -= 1;
          if (depth === 0) {
            searchFrom = index + 1;
            break;
          }
        }
      }
    }
  }
  const openIndex = source.indexOf("{", searchFrom);
  return openIndex >= 0 ? objectBlockFromOpenBrace(source, openIndex) : "";
}

function propertyObjectBlock(source, propertyName) {
  const pattern = new RegExp(`\\b${escapeRegExp(propertyName)}\\s*:\\s*\\{`);
  const match = source.match(pattern);
  if (!match || match.index === undefined) {
    return "";
  }
  const openIndex = source.indexOf("{", match.index);
  return openIndex >= 0 ? objectBlockFromOpenBrace(source, openIndex) : "";
}

function readJsQuotedString(source, quoteIndex) {
  const quote = source[quoteIndex];
  if (!["'", "\"", "`"].includes(quote)) {
    return null;
  }

  let value = "";
  for (let index = quoteIndex + 1; index < source.length; index += 1) {
    const char = source[index];
    if (char === "\\") {
      if (index + 1 < source.length) {
        value += source[index + 1];
        index += 1;
      }
      continue;
    }
    if (char === quote) {
      return value;
    }
    value += char;
  }
  return null;
}

function jsStringPropertyValue(source, propertyName) {
  const pattern = new RegExp("\\b" + escapeRegExp(propertyName) + "\\s*:\\s*([\"'`])");
  const match = pattern.exec(source);
  if (!match || match.index === undefined) {
    return null;
  }
  return readJsQuotedString(source, match.index + match[0].length - 1);
}

function sqlSingleQuotedValues(source) {
  const values = [];
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] !== "'") {
      continue;
    }
    let value = "";
    index += 1;
    for (; index < source.length; index += 1) {
      const char = source[index];
      if (char === "'" && source[index + 1] === "'") {
        value += "'";
        index += 1;
        continue;
      }
      if (char === "'") {
        values.push(value);
        break;
      }
      value += char;
    }
  }
  return values;
}

for (const file of requiredFiles) {
  readRequired(file);
}

const adminHtml = readRequired("admin/index.html");
const adminCss = readRequired("admin/admin.css");
const adminJs = readRequired("admin/admin.js");
const adminMiddlewareJs = readRequired("functions/admin/_middleware.js");
const apiJs = readRequired("functions/api/[[route]].js");
const schemaSql = readRequired("cloudflare/schema.sql");
const indexHtml = readRequired("index.html");
const styleCss = readRequired("css/style.css");
const gameShellJs = readRequired("games/game-shell.js");
const gameIndexFiles = [
  "games/2048/index.html",
  "games/a-dark-room/index.html",
  "games/hextris/index.html",
  "games/kittens-game/index.html",
  "games/life-restart/index.html"
];
const gameIndexHtmls = gameIndexFiles.map((file) => [file, readRequired(file)]);
const mainJs = readRequired("js/main.js");
const telemetryJs = readRequired("js/telemetry.js");
const manifest = readRequired("manifest.webmanifest");
const packageJson = readRequired("package.json");
const robots = readRequired("robots.txt");
const changelog = readRequired("CHANGELOG.md");

const translationsBlock = objectBlockAfterMarker(mainJs, "const translations =");
if (!translationsBlock) {
  fail("js/main.js missing translations object");
}
const htmlI18nKeys = [...indexHtml.matchAll(/\bdata-i18n(?:-[a-z-]+)?=(["'])([^"']+)\1/g)].map((match) => match[2]);
const directTranslationKeys = [...mainJs.matchAll(/\bt\(\s*["']([^"']+)["']\s*\)/g)].map((match) => match[1]);
const requiredTranslationKeys = [...new Set([...htmlI18nKeys, ...directTranslationKeys])].sort();
for (const lang of ["zh", "en", "ja"]) {
  const langBlock = propertyObjectBlock(translationsBlock, lang);
  if (!langBlock) {
    fail(`js/main.js missing ${lang} translations`);
    continue;
  }
  for (const key of requiredTranslationKeys) {
    const keyPattern = new RegExp(`(^|[,{\\n\\r])\\s*(?:${escapeRegExp(key)}|["']${escapeRegExp(key)}["'])\\s*:`);
    if (!keyPattern.test(langBlock)) {
      fail(`js/main.js missing ${lang} translation for ${key}`);
    }
  }
}

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
  "socialLinks-panel",
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
  "socialLinks",
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

if (!adminHtml.includes("账号管理、社交链接管理和后台私有更新记录")) {
  fail("admin/index.html backend docs summary must mention account and social link management");
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
  "socialLinks",
  "updates",
  "docs"
]) {
  if (!adminHtml.includes(`id="${panel}-panel" hidden aria-hidden="true"`)) {
    fail(`admin/index.html ${panel} panel must start hidden with aria-hidden=true`);
  }
}

for (const asset of ["admin.css", "admin.js"]) {
  if (!hasVersionedAssetReference(adminHtml, `/admin/${asset}`)) {
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

if (!apiJs.includes("async function getChatMessagesAfter") || !apiJs.includes("async function getRecentChatMessages")) {
  fail("functions/api/[[route]].js should share chat message query helpers for incremental and recovery reads");
}

if (!hasPattern(apiJs, /function\s+createdAtFromChatMessageId[\s\S]*Number\.parseInt\(match\[1\],\s*36\)[\s\S]*date\.toISOString\(\)/)) {
  fail("functions/api/[[route]].js should recover chat cursor timestamps from generated message ids");
}

if (!hasPattern(apiJs, /if\s*\(!cursor\)\s*\{[\s\S]*const\s+recoveredCreatedAt\s*=\s*createdAtFromChatMessageId\(after\)[\s\S]*await\s+getChatMessagesAfter\(env,\s*recoveredCreatedAt,\s*after,\s*limit\)[\s\S]*await\s+getRecentChatMessages\(env,\s*limit\)/)) {
  fail("functions/api/[[route]].js should recover deleted chat cursors instead of returning an empty incremental result forever");
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
  "renderAccountListNotice",
  "renderSocialLinkPreviewNotice"
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
  "社交链接：",
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
  'rel="manifest"'
]) {
  if (!indexHtml.includes(token)) {
    fail(`index.html missing ${token}`);
  }
}

const welcomeQuickLinksHtml = findRequiredHtml(
  indexHtml,
  /<div class="quick-links">[\s\S]*?<\/div>/,
  "index.html missing welcome quick links block"
);

for (const token of [
  '<span class="title-icon" aria-hidden="true">★</span><span id="welcome-title"',
  '<span class="pixel-icon monitor-icon" aria-hidden="true"></span>',
  '<span aria-hidden="true">▶</span>'
]) {
  if (!indexHtml.includes(token)) {
    fail(`index.html missing decorative welcome icon accessibility token ${token}`);
  }
}
if (indexHtml.includes("<b>›</b>")) {
  fail("index.html decorative arrow markers must be aria-hidden");
}

if (!indexHtml.includes('<nav class="desktop-icons" aria-label="主要栏目" data-i18n-aria-label="desktopIconsAria">')) {
  fail("index.html desktop icon navigation should use the Chinese default aria-label before JS i18n runs");
}

const desktopIconsNavHtml = findRequiredHtml(
  indexHtml,
  /<nav\b(?=[^>]*class="desktop-icons")(?=[^>]*data-i18n-aria-label="desktopIconsAria")[^>]*>[\s\S]*?<\/nav>/,
  "index.html missing bounded desktop icon navigation"
);
const desktopIconButtons = [...desktopIconsNavHtml.matchAll(/<button\b[^>]*class="desktop-icon"[^>]*data-route=/g)];
if (desktopIconButtons.length !== 7 || /desktop-intro|<section\b|<footer\b/.test(desktopIconsNavHtml)) {
  fail("index.html desktop icon navigation should wrap only the seven desktop icon buttons");
}

const taskbarNavHtml = findRequiredHtml(
  indexHtml,
  /<nav\b(?=[^>]*class="taskbar-tabs")(?=[^>]*data-i18n-aria-label="taskbarNavAria")[^>]*>[\s\S]*?<\/nav>/,
  "index.html taskbar tabs should be exposed as a labelled navigation"
);
if (!taskbarNavHtml.includes('aria-label="底部主导航"') || countLiteral(taskbarNavHtml, 'data-route="') !== 7) {
  fail("index.html taskbar navigation should use the Chinese default label and contain seven route buttons");
}

for (const token of [
  'id="knowledge-search-status" role="status" aria-live="polite" aria-atomic="true"',
  'id="chat-feedback" data-i18n="chatCooldownHint" role="status" aria-live="polite" aria-atomic="true"'
]) {
  if (!indexHtml.includes(token)) {
    fail(`index.html missing status announcement token ${token}`);
  }
}

const welcomeQuickLinkButtons = [...welcomeQuickLinksHtml.matchAll(/<button\b[^>]*class="[^"]*\bquick-link\b[^"]*"[^>]*>[\s\S]*?<\/button>/g)].map((match) => match[0]);
if (welcomeQuickLinkButtons.length < 4) {
  fail("index.html expected at least four welcome quick-link buttons");
}
for (const buttonHtml of welcomeQuickLinkButtons) {
  if (!/<span\b[^>]*aria-hidden="true"[^>]*>/.test(buttonHtml)) {
    fail("index.html welcome quick-link decorative icon should be aria-hidden");
  }
  if (!/<b\b[^>]*aria-hidden="true"[^>]*>/.test(buttonHtml)) {
    fail("index.html welcome quick-link arrow should be aria-hidden");
  }
}

const welcomeChatQuickLink = findRequiredHtml(
  welcomeQuickLinksHtml,
  tagWithAttributesPattern("button", ['class="quick-link', 'data-route="chatroom"']),
  "index.html missing chatroom welcome quick link"
);

if (!welcomeChatQuickLink.includes('data-analytics-label="welcome:quick-link:chatroom"')) {
  fail("index.html missing chatroom welcome quick link analytics label");
}

for (const token of [
  'data-route="chatroom"',
  'data-i18n="navChatroom"'
]) {
  if (!welcomeChatQuickLink.includes(token)) {
    fail(`index.html missing chatroom welcome quick-link token ${token}`);
  }
}

for (const token of [
  'data-analytics-label="welcome:quick-link:games"',
  'data-analytics-label="welcome:quick-link:knowledge"',
  'data-article-category="site-updates"',
  'data-analytics-label="welcome:quick-link:updates"'
]) {
  if (!welcomeQuickLinksHtml.includes(token)) {
    fail(`index.html missing welcome quick-link token ${token}`);
  }
}

if (welcomeQuickLinksHtml.includes('data-route="videos"')) {
  fail("index.html welcome quick links should not prioritize videos while the public video list is empty");
}

const welcomeQuickLinkOrder = [
  'data-route="chatroom"',
  'data-route="games"',
  'data-route="knowledge"',
  'data-article-category="site-updates"'
].map((token) => welcomeQuickLinksHtml.indexOf(token));
if (welcomeQuickLinkOrder.some((index) => index < 0) || !welcomeQuickLinkOrder.every((index, i, list) => i === 0 || list[i - 1] < index)) {
  fail("index.html welcome quick links should follow chatroom, games, knowledge, updates order");
}

for (const token of [
  'data-social-link="bilibili"',
  'data-social-link="discord"'
]) {
  const socialLink = findRequiredHtml(indexHtml, new RegExp(`<a\\b(?=[^>]*${escapeRegExp(token)})[^>]*>`), `index.html missing ${token} link`);
  if (!socialLink.includes("hidden") || /\shref=/.test(socialLink)) {
    fail(`index.html ${token} fallback should be hidden until a real URL is configured`);
  }
}

if (!hasPattern(mainJs, /capVideos:\s*["']Works · Translation · Favorites["']/)) {
  fail("js/main.js English video caption should use Favorites instead of Saves");
}

if (!hasPattern(mainJs, /function\s+normalizeSocialLinksPayload[\s\S]*\.trim\(\)\.toLowerCase\(\)[\s\S]*socialLinkPlatformMap\.has\(platform\)[\s\S]*result\[platform\]\s*=\s*url/)) {
  fail("js/main.js should normalize public social-link platforms case-insensitively and ignore unknown platforms");
}

if (!hasPattern(apiJs, /\["bilibili",\s*"Bilibili",\s*""\][\s\S]*\["discord",\s*"Discord",\s*""\]/)) {
  fail("functions/api/[[route]].js should not expose placeholder Bilibili/Discord default URLs");
}

if (!hasPattern(apiJs, /String\(entry\?\.platform\s*\|\|\s*entry\?\.id\s*\|\|\s*""\)\.trim\(\)\.toLowerCase\(\)\s*===\s*platform/)) {
  fail("functions/api/[[route]].js social-link array input should match platform ids case-insensitively");
}

const welcomeRecentActionsHtml = findRequiredHtml(
  indexHtml,
  /<div class="recent-actions">[\s\S]*?<\/div>/,
  "index.html missing welcome recent actions block"
);

if (!welcomeRecentActionsHtml.includes('data-article-category="site-updates"') || /data-rss|rss-button|application\/rss\+xml/i.test(welcomeRecentActionsHtml)) {
  fail("index.html welcome recent actions should keep only the site-updates action and no RSS subscription entry");
}

const profileAvatarHtml = findRequiredHtml(
  indexHtml,
  /<img\b(?=[^>]*class="profile-avatar-image")(?=[^>]*data-i18n-alt="profileAvatarAlt")[^>]*>/,
  "index.html profile avatar should expose translated alt text"
);

if (!profileAvatarHtml.includes('alt="鲁肃头像"')) {
  fail("index.html profile avatar alt should keep the Chinese default before scripts load");
}

if (countLiteral(mainJs, "localStorage.getItem") !== 1 || countLiteral(mainJs, "localStorage.setItem") !== 1) {
  fail("js/main.js should access localStorage only through safeStorageGet/safeStorageSet");
}

const chatSyncStatusHtml = findRequiredHtml(
  indexHtml,
  tagWithAttributesPattern("span", ['id="chat-sync-status"', 'data-i18n="chatSyncStatus"']),
  "index.html chat sync status should have a stable id and i18n fallback"
);

if (/aria-live|role=["']status["']/.test(chatSyncStatusHtml)) {
  fail("index.html chat sync polling text should not be a live status region");
}

for (const asset of [
  "/css/style.css",
  "/js/main.js",
  "/js/telemetry.js"
]) {
  if (!hasVersionedAssetReference(indexHtml, asset)) {
    fail(`index.html ${asset} reference is missing a cache-busting query`);
  }
}

const currentPreFinalMainVersion = "20260623-click-delegation-r1";
const currentPreFinalCssVersion = "20260630-account-popover-clip-r1";
const currentPreFinalTelemetryVersion = "20260623-analytics-privacy-r1";
const currentGameShellVersion = "20260623-game-shell-storage-safe-r1";

if (!indexHtml.includes(`/css/style.css?v=${currentPreFinalCssVersion}`)) {
  fail(`index.html pre-final style.css query should be ${currentPreFinalCssVersion}`);
}

if (!indexHtml.includes(`/js/telemetry.js?v=${currentPreFinalTelemetryVersion}`)) {
  fail(`index.html pre-final telemetry.js query should be ${currentPreFinalTelemetryVersion}`);
}

for (const [file, html] of gameIndexHtmls) {
  if (!html.includes(`../game-shell.js?v=${currentGameShellVersion}`)) {
    fail(`${file} game-shell.js query should be ${currentGameShellVersion}`);
  }
}

if (/[^.\w]localStorage\.(?:getItem|setItem)\(/.test(gameShellJs)) {
  fail("games/game-shell.js should access localStorage only through safe game-shell helpers");
}

for (const [marker, pattern, message] of [
  [
    "function safeGetStorageItem",
    /if\s*\(\s*localStorageReadBlocked\s*\)[\s\S]*sessionStorageFallback\.get\(key\)[\s\S]*window\.localStorage\.getItem\(key\)\s*\?\?[\s\S]*sessionStorageFallback\.get\(key\)[\s\S]*catch\s*\(error\)[\s\S]*localStorageReadBlocked\s*=\s*true[\s\S]*sessionStorageFallback\.get\(key\)/,
    "games/game-shell.js safeGetStorageItem should prefer real localStorage before session fallback"
  ],
  [
    "function safeSetStorageItem",
    /window\.localStorage\.setItem\(key,\s*textValue\)[\s\S]*sessionStorageFallback\.delete\(key\)[\s\S]*catch\s*\(error\)[\s\S]*sessionStorageFallback\.set\(key,\s*textValue\)/,
    "games/game-shell.js safeSetStorageItem should keep a session fallback when localStorage writes fail"
  ]
]) {
  requireFunctionPattern(gameShellJs, marker, pattern, message);
}

for (const token of [
  "--chrome-focus-ring",
  ".desktop-icon:focus-visible",
  ".close-button:focus-visible",
  ".taskbar-tabs button:focus-visible",
  "repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.24) 0 2px",
  "inset -18px 0 16px rgba(30, 91, 197, 0.18)",
  ".category-button .filter-count",
  ".knowledge-searchbar input",
  "caret-color: auto",
  ".game-empty-state",
  ".resource-pending-action",
  ".about-social-link[hidden]",
  "transition-delay: 0s !important",
  "transition-duration: 1ms !important",
  "@media (max-width: 460px)"
]) {
  if (!styleCss.includes(token)) {
    fail(`css/style.css missing ${token}`);
  }
}

for (const token of [
  "redactEmailLikeText",
  "safeReferrer",
  "safeHref",
  "safeRouteName",
  "%40",
  "%2540"
]) {
  if (!telemetryJs.includes(token)) {
    fail(`js/telemetry.js missing analytics email redaction token ${token}`);
  }
}

for (const token of [
  'action.dataset.videoRetry = ""',
  'target.closest("[data-video-retry]")',
  "retryAction",
  'dataset: { articleRetry: "" }',
  'target.closest("[data-article-retry]")',
  "articleSearchReset",
  'dataset: { articleSearchReset: "" }',
  'target.closest("[data-article-search-reset]")',
  'action.dataset.gameRetry = ""',
  'target.closest("[data-game-retry]")',
  "articleRetryAction",
  "gameRetryAction",
  'accountEmailLabel: "邮箱"',
  'accountEmailLabel: "Email address"',
  'accountEmailLabel: "メールアドレス"',
  'accountPasswordLabel: "密码"',
  'accountPasswordLabel: "Password"',
  'accountPasswordLabel: "パスワード"',
  'emailInput.setAttribute("aria-label", t("accountEmailLabel"))',
  'passwordInput.setAttribute("aria-label", t("accountPasswordLabel"))',
  'form.dataset.accountMode = "login"',
  'button.dataset.accountMode || "login"',
  "function setAccountSubmitting",
  'toggle.setAttribute("aria-controls", "account-popover")',
  'toggle.setAttribute("aria-expanded", "false")',
  "function syncAccountPopoverState",
  'toggle.setAttribute("aria-expanded", String(!popover.hidden))',
  "modalFocusState",
  "restoreModalFocus",
  'profileAvatarAlt: "鲁肃头像"',
  'profileAvatarAlt: "LuSu avatar"',
  'profileAvatarAlt: "魯粛のアバター"'
]) {
  if (!mainJs.includes(token)) {
    fail(`js/main.js missing public recovery/accessibility token ${token}`);
  }
}

for (const [marker, pattern, message] of [
  [
    "function articleCardElement",
    /const\s+titleText\s*=\s*item\.title\s*\|\|\s*["'][\s\S]*const\s+actionLabel\s*=\s*`\$\{t\(["']readButton["']\)\}:\s*\$\{titleText\}`[\s\S]*action\.setAttribute\(\s*["']aria-label["']\s*,\s*actionLabel\s*\)[\s\S]*action\.setAttribute\(\s*["']title["']\s*,\s*actionLabel\s*\)/,
    "js/main.js articleCardElement should include the article title in read link labels"
  ],
  [
    "function videoCardElement",
    /const\s+videoTitleText\s*=\s*item\.title\s*\|\|\s*videoUiText\(["']untitled["']\)[\s\S]*const\s+videoPlayLabel\s*=\s*`\$\{videoUiText\(["']playAria["']\)\}:\s*\$\{videoTitleText\}`[\s\S]*thumb\.setAttribute\(\s*["']aria-label["']\s*,\s*videoPlayLabel\s*\)[\s\S]*button\.setAttribute\(\s*["']aria-label["']\s*,\s*videoPlayLabel\s*\)/,
    "js/main.js videoCardElement should use the video title in thumbnail and action aria-labels"
  ],
  [
    "function renderKnowledgeCategoryButtons",
    /const\s+countValue\s*=\s*value\s*===\s*["']all["'][\s\S]*button\.setAttribute\(\s*["']aria-label["']\s*,\s*`\$\{labelText\}\s+\$\{countValue\}`\s*\)[\s\S]*button\.setAttribute\(\s*["']aria-pressed["']\s*,\s*String\(active\)\s*\)[\s\S]*countNode\.className\s*=\s*["']filter-count["']/,
    "js/main.js knowledge filter buttons should expose selected state and item counts"
  ],
  [
    "function renderVideoCategoryButtons",
    /const\s+countValue\s*=\s*category\.category_id\s*===\s*["']all["'][\s\S]*button\.setAttribute\(\s*["']aria-label["']\s*,\s*`\$\{name\}\s+\$\{countValue\}`\s*\)[\s\S]*button\.setAttribute\(\s*["']aria-pressed["']\s*,\s*String\(active\)\s*\)[\s\S]*countNode\.className\s*=\s*["']filter-count["']/,
    "js/main.js video filter buttons should expose selected state and item counts"
  ],
  [
    "function resourceActionElement",
    /const\s+resourceTitle\s*=\s*contentTitle\(item\.title\)[\s\S]*status\.className\s*=\s*["']card-action resource-pending-action["'][\s\S]*status\.setAttribute\(\s*["']role["']\s*,\s*["']status["']\s*\)[\s\S]*status\.setAttribute\(\s*["']aria-label["']\s*,\s*`\$\{t\(["']resourcePendingTitle["']\)\}:\s*\$\{resourceTitle\}`\s*\)[\s\S]*link\.setAttribute\(\s*["']aria-label["']\s*,\s*`\$\{text\}:\s*\$\{resourceTitle\}`\s*\)/,
    "js/main.js resourceActionElement should expose pending resources as non-interactive titled status text"
  ],
  [
    "function resourceStatusElement",
    /status\.setAttribute\(\s*["']aria-label["']\s*,\s*`\$\{text\}:\s*\$\{title\}`\s*\)[\s\S]*status\.setAttribute\(\s*["']title["']\s*,\s*`\$\{text\}:\s*\$\{title\}`\s*\)/,
    "js/main.js resourceStatusElement should expose titled ready/pending status text"
  ],
  [
    "function renderResourceCategoryButtons",
    /button\.setAttribute\(\s*["']aria-pressed["']\s*,\s*String\(activeFilters\.resources\s*===\s*entry\.value\)\s*\)/,
    "js/main.js resource filter buttons should sync aria-pressed state"
  ],
  [
    "function languageSupportTagElements",
    /tag\.title\s*=\s*title[\s\S]*tag\.setAttribute\(\s*["']aria-label["']\s*,\s*title\s*\)/,
    "js/main.js language support tags should expose their computed title as an aria-label"
  ],
  [
    "function gameCardElement",
    /save\.setAttribute\(\s*["']aria-label["']\s*,\s*`\$\{titleText\}:\s*\$\{t\(["']gameCloudSaveReady["']\)\}`\s*\)[\s\S]*save\.setAttribute\(\s*["']title["']\s*,\s*`\$\{titleText\}:\s*\$\{t\(["']gameCloudSaveReady["']\)\}`\s*\)[\s\S]*source\.setAttribute\(\s*["']aria-label["']\s*,\s*`\$\{t\(["']gameSourceLabel["']\)\}:\s*\$\{titleText\}`\s*\)[\s\S]*action\.setAttribute\(\s*["']aria-label["']\s*,\s*`\$\{action\.textContent\}:\s*\$\{titleText\}`\s*\)/,
    "js/main.js gameCardElement should include game titles in save, source, and action labels"
  ],
  [
    "function markStatusMessage",
    /node\.setAttribute\(\s*["']role["']\s*,\s*["']status["']\s*\)[\s\S]*node\.setAttribute\(\s*["']aria-live["']\s*,\s*["']polite["']\s*\)[\s\S]*node\.setAttribute\(\s*["']aria-atomic["']\s*,\s*["']true["']\s*\)/,
    "js/main.js markStatusMessage should create polite atomic status messages"
  ],
  [
    "function renderListMessage",
    /markStatusMessage\(note\)/,
    "js/main.js renderListMessage should mark article loading/failure copy as a status message"
  ],
  [
    "function renderVideoStatusState",
    /markStatusMessage\(copy\)/,
    "js/main.js renderVideoStatusState should mark only the video status copy as a live status"
  ],
  [
    "async function renderGames",
    /markStatusMessage\(loading\)[\s\S]*renderGameCatalog\(list,\s*catalog\)[\s\S]*markStatusMessage\(failed\)/,
    "js/main.js renderGames should handle loading and failure states"
  ],
  [
    "function renderGameCatalog",
    /Array\.isArray\(catalog\.games\)[\s\S]*renderGameEmptyState\(\)[\s\S]*catalog\.games\.forEach/,
    "js/main.js renderGameCatalog should validate and render empty/catalog states"
  ],
  [
    "function renderGameEmptyState",
    /state\.className\s*=\s*["']game-empty-state["'][\s\S]*markStatusMessage\(copy\)[\s\S]*title\.textContent\s*=\s*t\(["']gameEmptyTitle["']\)[\s\S]*body\.textContent\s*=\s*t\(["']gameEmptyBody["']\)[\s\S]*action\.dataset\.gameRetry\s*=\s*["']["']/,
    "js/main.js renderGameEmptyState should expose a retryable game catalog empty state"
  ],
  [
    "async function loadGameCatalog",
    /gameState\.catalog\s*&&\s*!forceRefresh[\s\S]*gameState\.pending\s*&&\s*!forceRefresh[\s\S]*Array\.isArray\(catalog\.games\)[\s\S]*gameState\.catalog\s*=\s*catalog/,
    "js/main.js loadGameCatalog should cache a validated game catalog and reuse pending reads"
  ],
  [
    "async function renderGames",
    /gameState\.catalog\s*&&\s*!forceRefresh[\s\S]*renderGameCatalog\(list,\s*gameState\.catalog\)[\s\S]*loadGameCatalog\(\s*\{\s*forceRefresh\s*\}\s*\)[\s\S]*renderGameCatalog\(list,\s*catalog\)/,
    "js/main.js renderGames should reuse cached games unless a retry forces refresh"
  ],
  [
    "function renderArticleDetailFailure",
    /syncDocumentMeta\(\)[\s\S]*title\.textContent\s*=\s*t\(["']articleLoadFailed["']\)[\s\S]*markStatusMessage\(note\)[\s\S]*action\.dataset\.articleDetailRetry\s*=\s*slug[\s\S]*action\.textContent\s*=\s*t\(["']articleRetryAction["']\)/,
    "js/main.js article detail failures should expose a retry action"
  ],
  [
    "function setLanguage",
    /document\.querySelectorAll\(\s*["']\[data-i18n-alt\]["']\s*\)[\s\S]*node\.setAttribute\(\s*["']alt["']\s*,\s*t\(node\.dataset\.i18nAlt\)\s*\)/,
    "js/main.js setLanguage should sync translated image alt text"
  ],
  [
    "function safeStorageGet",
    /try\s*\{[\s\S]*localStorage\.getItem\(key\)\s*\?\?\s*fallback[\s\S]*catch\s*\{[\s\S]*return\s+fallback/,
    "js/main.js safeStorageGet should tolerate blocked storage"
  ],
  [
    "function safeStorageSet",
    /try\s*\{[\s\S]*localStorage\.setItem\(key,\s*value\)[\s\S]*return\s+true[\s\S]*catch\s*\{[\s\S]*return\s+false/,
    "js/main.js safeStorageSet should tolerate blocked storage"
  ],
  [
    "function sanitizeChatLastSentAt",
    /Number\(value\)[\s\S]*!Number\.isFinite\(timestamp\)[\s\S]*timestamp\s*<\s*0[\s\S]*timestamp\s*>\s*now[\s\S]*return\s+0/,
    "js/main.js sanitizeChatLastSentAt should ignore corrupted or future chat cooldown timestamps"
  ],
  [
    "async function articleApi",
    /fetch\(path,\s*\{\s*cache:\s*["']no-store["'][\s\S]*["']Accept["']:\s*["']application\/json["']/,
    "js/main.js articleApi should bypass browser cache for fresh public articles"
  ],
  [
    "async function loadArticles",
    /articleState\.detailCache\.clear\(\)[\s\S]*articleState\.articles\s*=\s*visiblePublicArticles\(payload\.articles\s*\|\|\s*\[\]\)/,
    "js/main.js loadArticles should clear cached article details after a fresh list read"
  ],
  [
    "function syncDocumentMeta",
    /setMetaContent\(\s*["']meta\[property="og:type"\]["']\s*,\s*["']website["']\s*\)[\s\S]*setMetaContent\(\s*["']meta\[property="og:image"\]["']\s*,\s*defaultShareImageUrl\s*\)[\s\S]*setMetaContent\(\s*["']meta\[name="twitter:image"\]["']\s*,\s*defaultShareImageUrl\s*\)/,
    "js/main.js syncDocumentMeta should restore default website share metadata"
  ],
  [
    "function articleShareImageUrl",
    /safeArticleImageSrc\(article\?\.cover_image\s*\|\|\s*["']["']\)[\s\S]*https:\/\/lusu575\.com\/\$\{safeCover\}[\s\S]*defaultShareImageUrl/,
    "js/main.js articleShareImageUrl should only use safe article cover paths"
  ],
  [
    "function syncArticleDocumentMeta",
    /articleRouteHref\(article\?\.slug\s*\|\|\s*articleState\.currentSlug,\s*currentLang\)[\s\S]*document\.title\s*=\s*articleTitle\s*===\s*siteTitle[\s\S]*setMetaContent\(\s*["']meta\[property="og:type"\]["']\s*,\s*["']article["']\s*\)[\s\S]*setMetaContent\(\s*["']meta\[property="og:image"\]["']\s*,\s*imageUrl\s*\)[\s\S]*setMetaContent\(\s*["']meta\[name="twitter:image"\]["']\s*,\s*imageUrl\s*\)/,
    "js/main.js syncArticleDocumentMeta should write article title, canonical, and share metadata"
  ],
  [
    "async function loadArticleDetail",
    /clearArticleCopyStatus\(\)[\s\S]*syncDocumentMeta\(\)[\s\S]*title\.textContent\s*=\s*t\(["']articleLoading["']\)/,
    "js/main.js loadArticleDetail should clear stale article metadata before loading a new detail"
  ],
  [
    "function renderArticleToc",
    /heading\.tabIndex\s*=\s*-1[\s\S]*button\.setAttribute\(\s*["']aria-current["']\s*,\s*["']location["']\s*\)[\s\S]*button\.setAttribute\(\s*["']aria-controls["']\s*,\s*id\s*\)/,
    "js/main.js article TOC buttons should control focusable headings and mark the initial current location"
  ],
  [
    "function updateArticleTocActive",
    /button\.setAttribute\(\s*["']aria-current["']\s*,\s*["']location["']\s*\)[\s\S]*button\.removeAttribute\(\s*["']aria-current["']\s*\)/,
    "js/main.js article TOC active state should sync aria-current"
  ],
  [
    "function scrollToArticleHeading",
    /heading\.scrollIntoView\(\s*\{\s*block:\s*["']start["']\s*,\s*behavior:\s*["']smooth["']\s*\}\s*\)[\s\S]*heading\.focus\(\s*\{\s*preventScroll:\s*true\s*\}\s*\)/,
    "js/main.js article TOC jumps should move programmatic focus to the target heading without extra scroll"
  ],
  [
    "function focusableDialogElements",
    /button:not\(\[disabled\]\)[\s\S]*iframe[\s\S]*\[tabindex\]:not\(\[tabindex='-1'\]\)[\s\S]*element\.getClientRects\(\)/,
    "js/main.js focusableDialogElements should collect visible focus targets inside dialogs"
  ],
  [
    "function activeModalDialog",
    /videoModal\s*&&\s*!videoModal\.hidden[\s\S]*videoModal\.querySelector\(\s*["']\[role='dialog'\]["']\s*\)[\s\S]*welcomeModal\s*&&\s*!welcomeModal\.hidden[\s\S]*welcomeModal\.querySelector\(\s*["']\[role='dialog'\]["']\s*\)/,
    "js/main.js activeModalDialog should prefer the open video dialog, then welcome dialog"
  ],
  [
    "function trapDialogFocus",
    /event\.key\s*!==\s*["']Tab["'][\s\S]*focusableDialogElements\(dialog\)[\s\S]*!dialog\.contains\(active\)[\s\S]*event\.shiftKey\s*&&\s*active\s*===\s*first[\s\S]*!event\.shiftKey\s*&&\s*active\s*===\s*last/,
    "js/main.js trapDialogFocus should loop Tab and Shift+Tab inside the active dialog"
  ],
  [
    "async function ensureChatIdentity",
    /safeStorageGet\(chatStorageKeys\.visitorId\)[\s\S]*safeStorageSet\(chatStorageKeys\.visitorId,\s*visitorId\)[\s\S]*safeStorageGet\(chatStorageKeys\.nickname\)[\s\S]*safeStorageSet\(chatStorageKeys\.nickname,\s*nickname\)/,
    "js/main.js chat identity should use safe storage access"
  ],
  [
    "function initialLanguage",
    /safeStorageGet\(languageStorageKey\)/,
    "js/main.js initialLanguage should read stored language through safe storage"
  ],
  [
    "const chatState",
    /lastSentAt:\s*sanitizeChatLastSentAt\(safeStorageGet\(chatStorageKeys\.lastSentAt,\s*["']0["']\)\)/,
    "js/main.js chat state should initialize cooldown timestamps through the sanitizer"
  ],
  [
    "function navigate",
    /!\(\s*nextRoute\s*===\s*["']knowledge["']\s*&&\s*options\.articleSlug\s*\)\s*&&\s*articleState\.currentSlug[\s\S]*articleState\.currentSlug\s*=\s*["'][\s\S]*articleState\.currentArticle\s*=\s*null[\s\S]*articleState\.detailLoadingKey\s*=\s*["']/,
    "js/main.js navigate should clear stale article detail state when leaving article routes"
  ],
  [
    "function navigate",
    /if\s*\(\s*!\(\s*nextRoute\s*===\s*["']knowledge["']\s*&&\s*options\.articleSlug\s*\)\s*\)\s*\{[\s\S]*syncDocumentMeta\(\)[\s\S]*\}/,
    "js/main.js navigate should restore site metadata outside article detail routes"
  ],
  [
    "function renderArticleDetail(article)",
    /renderArticleToc\(\)[\s\S]*scheduleArticleReadProgressUpdate\(\)[\s\S]*syncArticleDocumentMeta\(article\)/,
    "js/main.js renderArticleDetail should sync article document metadata after rendering"
  ],
  [
    "function setChatSendingState",
    /chatState\.sending\s*=\s*sending[\s\S]*form\?\.setAttribute\(\s*["']aria-busy["']\s*,\s*String\(sending\)\s*\)[\s\S]*input\.disabled\s*=\s*sending[\s\S]*button\.disabled\s*=\s*sending/,
    "js/main.js setChatSendingState should lock the chat form while sending"
  ],
  [
    "function updateChatSyncStatus",
    /document\.getElementById\(\s*["']chat-sync-status["']\s*\)[\s\S]*status\.textContent\s*=\s*chatSyncStatusText\(delay\)/,
    "js/main.js updateChatSyncStatus should write the visible chat polling status by id"
  ],
  [
    "async function submitChatMessage",
    /if\s*\(\s*chatState\.sending\s*\)[\s\S]*setChatFeedback\(t\(["']chatSending["']\)\)[\s\S]*Date\.now\(\)\s*-\s*chatState\.lastSentAt\s*<\s*chatCooldownMs[\s\S]*setChatSendingState\(true\)[\s\S]*setChatFeedback\(t\(["']chatSending["']\)\)[\s\S]*await\s+ensureChatIdentity\(\)[\s\S]*finally\s*\{[\s\S]*setChatSendingState\(false\)/,
    "js/main.js submitChatMessage should prevent duplicate submissions and restore the form"
  ],
  [
    "function openVideo",
    /const\s+sourceLabel\s*=\s*`\$\{t\(["']openOriginal["']\)\}:\s*\$\{videoTitle\}`[\s\S]*sourceLink\.setAttribute\(\s*["']aria-label["']\s*,\s*sourceLabel\s*\)[\s\S]*sourceLink\.setAttribute\(\s*["']title["']\s*,\s*sourceLabel\s*\)[\s\S]*sourceLink\.removeAttribute\(\s*["']aria-label["']\s*\)[\s\S]*sourceLink\.removeAttribute\(\s*["']title["']\s*\)/,
    "js/main.js openVideo should title the original source link with the current video title and clear stale labels"
  ],
  [
    "function openVideo",
    /modalFocusState\.videoTrigger[\s\S]*modal\.querySelector\(\s*["']button\[data-close-modal\]["']\s*\)\?\.focus\(\s*\{\s*preventScroll:\s*true\s*\}\s*\)/,
    "js/main.js openVideo should remember the trigger and focus the video dialog close button"
  ],
  [
    "function closeVideo",
    /sourceLink\.removeAttribute\(\s*["']aria-label["']\s*\)[\s\S]*sourceLink\.removeAttribute\(\s*["']title["']\s*\)/,
    "js/main.js closeVideo should clear the original source link labels"
  ],
  [
    "function closeVideo",
    /const\s+wasOpen[\s\S]*restoreModalFocus\(\s*["']videoTrigger["']\s*\)/,
    "js/main.js closeVideo should restore focus to the video trigger when it closes an open dialog"
  ],
  [
    "function blogCardElement",
    /const\s+titleText\s*=\s*contentTitle\(item\.title\)[\s\S]*action\.setAttribute\(\s*["']aria-disabled["']\s*,\s*["']true["']\s*\)[\s\S]*action\.setAttribute\(\s*["']aria-label["']\s*,\s*`\$\{t\(["']blogPending["']\)\}:\s*\$\{titleText\}`\s*\)[\s\S]*action\.setAttribute\(\s*["']title["']\s*,\s*`\$\{t\(["']blogPending["']\)\}:\s*\$\{titleText\}`\s*\)/,
    "js/main.js blogCardElement should keep pending actions focusable and titled"
  ],
  [
    "function closeWelcome",
    /const\s+wasOpen[\s\S]*restoreModalFocus\(\s*["']welcomeTrigger["']\s*\)/,
    "js/main.js closeWelcome should restore focus when it closes an open welcome dialog"
  ],
  [
    "function showArticle",
    /closeWelcome\(\s*\{\s*restoreFocus:\s*false\s*\}\s*\)/,
    "js/main.js showArticle should close the welcome dialog without restoring stale modal focus"
  ],
  [
    "function showArticleCategory",
    /closeWelcome\(\s*\{\s*restoreFocus:\s*false\s*\}\s*\)/,
    "js/main.js showArticleCategory should close the welcome dialog without restoring stale modal focus"
  ],
  [
    "function parseRouteHash",
    /knowledge\\\/\(\?:article\\\/\)\?\(\[a-z0-9\]\[a-z0-9-\]\{0,119\}\)/,
    "js/main.js parseRouteHash should support both #knowledge/article/slug and #knowledge/slug"
  ],
  [
    "function syncRouteFromLocation",
    /closeWelcome\(\s*\{\s*restoreFocus:\s*false\s*\}\s*\)/,
    "js/main.js route syncing should close the welcome dialog without restoring stale modal focus"
  ],
  [
    "function syncRouteFromLocation",
    /navigate\(\s*parsed\.route\s*,\s*\{\s*updateUrl:\s*false,\s*articleSlug:\s*parsed\.articleSlug\s*\|\|\s*["']["']\s*\}\s*\)/,
    "js/main.js route syncing should preserve parsed article slugs before navigate clears stale detail state"
  ],
  [
    "function maybeShowWelcome",
    /modalFocusState\.welcomeTrigger[\s\S]*modal\.querySelector\(\s*["']button\[data-close-welcome\]["']\s*\)\?\.focus\(\s*\{\s*preventScroll:\s*true\s*\}\s*\)/,
    "js/main.js maybeShowWelcome should remember prior focus and focus the welcome close button"
  ]
]) {
  requireFunctionPattern(mainJs, marker, pattern, message);
}

if (!hasPattern(mainJs, /const\s+routeButton[\s\S]*if\s*\(routeButton\)\s*\{[\s\S]*navigate\(routeButton\.dataset\.route\)[\s\S]*closeWelcome\(\s*\{\s*restoreFocus:\s*false\s*\}\s*\)/)) {
  fail("js/main.js route click branch should close the welcome dialog without restoring stale modal focus");
}

if (!hasPattern(mainJs, /if\s*\(videoModal\s*&&\s*!videoModal\.hidden\)\s*\{[\s\S]*closeVideo\(\)[\s\S]*return;[\s\S]*if\s*\(welcomeModal\s*&&\s*!welcomeModal\.hidden\)\s*\{[\s\S]*closeWelcome\(\)[\s\S]*return;/)) {
  fail("js/main.js Escape handling should only close open dialogs before falling back to the account popover");
}

if (!hasPattern(mainJs, /window\.addEventListener\(\s*["']keydown["']\s*,\s*\(event\)\s*=>\s*\{[\s\S]*if\s*\(\s*trapDialogFocus\(event\)\s*\)\s*\{[\s\S]*return;[\s\S]*if\s*\(\s*event\.key\s*===\s*["']Escape["']\s*\)/)) {
  fail("js/main.js keydown handler should trap dialog focus before Escape fallback handling");
}

const resourceActionBody = objectBlockAfterMarker(mainJs, "function resourceActionElement");
if (/aria-disabled|button\.disabled\s*=|document\.createElement\(\s*["']button["']\s*\)/.test(resourceActionBody)) {
  fail("js/main.js resource pending action should be non-interactive status text, not a disabled button");
}

if (!hasPattern(
  objectBlockAfterMarker(mainJs, "function resourceCardElement"),
  /const\s+metaItems\s*=\s*\[[\s\S]*label\("type"\)[\s\S]*if\s*\(\s*resourceUrl\s*\)\s*\{[\s\S]*metaItems\.push\([\s\S]*label\("version"\)[\s\S]*label\("size"\)[\s\S]*label\("updated"\)[\s\S]*metaItems\.forEach/
)) {
  fail("js/main.js resource cards should hide version/size/updated metadata until a real resource URL exists");
}

if (!hasPattern(mainJs, /function\s+readyResourceItems\(\)\s*\{[\s\S]*content\.resources\.filter\(\(item\)\s*=>\s*safeResourceUrl\(item\)\)/)) {
  fail("js/main.js should separate ready resources from placeholder resource drafts");
}

if (!hasPattern(
  objectBlockAfterMarker(mainJs, "function renderResources"),
  /const\s+readyItems\s*=\s*readyResourceItems\(\)[\s\S]*renderResourceCategoryButtons\(readyItems\)[\s\S]*const\s+items\s*=\s*readyItems\.filter[\s\S]*resourceEmptyStateElement\(\{\s*hasAnyReady:\s*readyItems\.length\s*>\s*0\s*\}\)/
)) {
  fail("js/main.js renderResources should show an honest empty state instead of placeholder resource cards");
}

const blogCardBody = objectBlockAfterMarker(mainJs, "function blogCardElement");
if (/action\.disabled\s*=/.test(blogCardBody)) {
  fail("js/main.js blog pending action should remain focusable via aria-disabled instead of native disabled");
}

if (!hasPattern(mainJs, /function\s+publishedBlogItems\(\)\s*\{[\s\S]*content\.blog\.filter\(\(item\)\s*=>\s*item\.published\s*===\s*true\s*\|\|\s*item\.url\s*\|\|\s*item\.content\)/)) {
  fail("js/main.js should separate published blog items from placeholder drafts");
}

if (!hasPattern(
  objectBlockAfterMarker(mainJs, "function renderBlog"),
  /const\s+items\s*=\s*publishedBlogItems\(\)[\s\S]*if\s*\(\s*!items\.length\s*\)\s*\{[\s\S]*blogEmptyStateElement\(\)[\s\S]*items\.forEach\(\(item\)\s*=>\s*list\.appendChild\(blogCardElement\(item\)\)\)/
)) {
  fail("js/main.js renderBlog should show an honest empty state until real posts are published");
}

for (const functionName of ["openAccountPopover", "closeAccountPopover", "toggleAccountPopover"]) {
  const functionBody = objectBlockAfterMarker(mainJs, `function ${functionName}`);
  if (!functionBody.includes("syncAccountPopoverState(popover)")) {
    fail(`js/main.js ${functionName} should sync account aria-expanded state`);
  }
}

for (const [label, pattern] of [
  ["resource empty icon", /icon\.className\s*=\s*["']resource-empty-icon["'][\s\S]{0,120}icon\.setAttribute\(\s*["']aria-hidden["']\s*,\s*["']true["']\s*\)/],
  ["recent updates empty icon", /icon\.className\s*=\s*["']update-icon["'][\s\S]{0,120}icon\.setAttribute\(\s*["']aria-hidden["']\s*,\s*["']true["']\s*\)/],
  ["video unsupported icon", /icon\.textContent\s*=\s*["']!["'][\s\S]{0,120}icon\.setAttribute\(\s*["']aria-hidden["']\s*,\s*["']true["']\s*\)/],
  ["video placeholder icon", /icon\.textContent\s*=\s*["']▶["'][\s\S]{0,120}icon\.setAttribute\(\s*["']aria-hidden["']\s*,\s*["']true["']\s*\)/]
]) {
  if (!hasPattern(mainJs, pattern)) {
    fail(`js/main.js missing decorative dynamic icon accessibility guard for ${label}`);
  }
}

const scopedRouteBranchPattern = /\.closest\(\s*["']\[data-route\]:not\(body\)["']\s*\)/;
const routeClickBranchMatch = scopedRouteBranchPattern.exec(mainJs);
const routeClickBranchIndex = routeClickBranchMatch?.index ?? -1;
if (routeClickBranchIndex < 0) {
  fail("js/main.js route click branch must ignore body[data-route]");
}
if (/\.closest\(\s*["']\[data-route\]["']\s*\)/.test(mainJs)) {
  fail("js/main.js must not use a bare [data-route] click matcher; body[data-route] shadows controls");
}
for (const priorityBranch of [
  'target.closest("[data-account-toggle]")',
  'target.closest("[data-account-logout]")',
  'target.closest("[data-video-retry]")',
  'target.closest("[data-article-retry]")',
  'target.closest("[data-article-detail-retry]")',
  'target.closest("[data-game-retry]")',
  'target.closest("[data-lang]")',
  'target.closest("[data-resource-show-all]")',
  'target.closest("[data-filter-type]")',
  'target.closest("[data-article-heading-target]")',
  'target.closest("[data-article-scroll-top]")',
  'target.closest("[data-article-window-toggle]")',
  'target.closest("[data-article-slug]")',
  'target.closest("[data-article-category]")',
  'target.closest("[data-article-back]")',
  'target.closest("[data-article-copy-link]")',
  'target.closest("[data-article-search-clear]")',
  'target.closest("[data-article-search-reset]")',
  'target.closest("[data-video-index]")',
  'target.closest("[data-video-id]")',
  'target.closest("[data-video-window-toggle], [data-video-fullscreen]")',
  'target.closest("[data-close-modal]")',
  'target.closest("[data-close-welcome]")'
]) {
  const priorityBranchIndex = mainJs.indexOf(priorityBranch);
  if (priorityBranchIndex < 0 || routeClickBranchIndex < 0 || priorityBranchIndex > routeClickBranchIndex) {
    fail(`js/main.js ${priorityBranch} must be handled before the data-route click branch`);
  }
}

if (!hasPattern(mainJs, /document\.addEventListener\(\s*["']click["'][\s\S]*const\s+target\s*=\s*event\.target\s+instanceof\s+Element[\s\S]*if\s*\(\s*!target\s*\)\s*\{[\s\S]*return;[\s\S]*target\.closest\(\s*["']\[data-route\]:not\(body\)["']\s*\)/)) {
  fail("js/main.js click delegation should normalize the event target before matching controls");
}

if (!hasPattern(mainJs, /target\.closest\(\s*["']\[data-game-retry\]["']\s*\)[\s\S]*renderGames\(\s*\{\s*forceRefresh:\s*true\s*\}\s*\)/)) {
  fail("js/main.js game retry should force-refresh the cached catalog");
}

if (!hasPattern(mainJs, /const\s+hoverRoute\s*=\s*pageParams\.get\(\s*["']hover["']\s*\)[\s\S]*if\s*\(\s*pageIds\.includes\(hoverRoute\)\s*\)\s*\{[\s\S]*\.desktop-icon\[data-route="\$\{hoverRoute\}"\]/)) {
  fail("js/main.js hover query param should be validated before building a selector");
}

if (!hasPattern(mainJs, /function\s+safeTrustedExternalUrl[\s\S]*url\.protocol\s*===\s*["']https:["'][\s\S]*hostMatches\(url\.hostname,\s*allowedHosts\)/)) {
  fail("js/main.js safeTrustedExternalUrl should require HTTPS and an allowed hostname");
}

if (!hasPattern(mainJs, /function\s+safeGithubUrl[\s\S]*url\.protocol\s*!==\s*["']https:["'][\s\S]*github\.com[\s\S]*\/\^\\\/\[a-z0-9_\.-\]\+\\\/\[a-z0-9_\.-\]\+\\\/\?\$\//)) {
  fail("js/main.js should define a GitHub-only URL guard for game repositories");
}

if (!hasPattern(mainJs, /function\s+buildGameUrl[\s\S]*safeTrustedExternalUrl\(value,\s*trustedGameExternalHosts\)[\s\S]*return\s+["']["'][\s\S]*safeTrustedExternalUrl\(item\.externalUrl,\s*trustedGameExternalHosts\)[\s\S]*safeGithubUrl\(item\.repo\)/)) {
  fail("js/main.js buildGameUrl should reject untrusted game play/external/repo URLs");
}

if (!hasPattern(mainJs, /const\s+repoUrl\s*=\s*safeGithubUrl\(item\.repo\)[\s\S]*className\s*=\s*["']tag game-source-link["']/)) {
  fail("js/main.js game source link should reuse the GitHub-only repository guard");
}

if (!hasPattern(gameShellJs, /function\s+safeGithubHref[\s\S]*url\.protocol\s*!==\s*["']https:["'][\s\S]*github\.com[\s\S]*\/\^\\\/\[a-z0-9_\.-\]\+\\\/\[a-z0-9_\.-\]\+\\\/\?\$\//)) {
  fail("games/game-shell.js should define a GitHub-only repository link guard");
}

if (!hasPattern(gameShellJs, /const\s+repoHref\s*=\s*safeGithubHref\(game\.repo\)[\s\S]*repoLink\.href\s*=\s*repoHref/)) {
  fail("games/game-shell.js upstream repository link should use the GitHub-only guard");
}

if (!hasPattern(mainJs, /function\s+safeResourceUrl[\s\S]*if\s*\(\s*httpUrl\s*\)\s*\{[\s\S]*item\.external\s*===\s*true\s*\?\s*safeTrustedExternalUrl\(value,\s*trustedResourceExternalHosts\)\s*:\s*["']["']/)) {
  fail("js/main.js safeResourceUrl should require explicit external status and a trusted host for resource external links");
}

for (const obsoleteText of [
  "资源区（待定）",
  "杂谈区（待定）",
  "Resources TBD",
  "Talk TBD",
  "リソース（未定）",
  "雑談（未定）"
]) {
  if (mainJs.includes(obsoleteText)) {
    fail(`js/main.js should not show desktop section title as ${obsoleteText}`);
  }
}

const finalUpdateId = "seed-update-2026-06-24-account-cleanup-merge-launch";
const finalUpdateSlug = "2026-06-24-account-cleanup-merge-launch";
const finalMainVersion = "20260624-account-cleanup-merge-r1";
const supersededAccountA11yMainVersion = "20260623-account-expanded-a11y-r1";
const finalTitleEn = "Account Flow and Merge Launch";
const finalPublishedAt = "2026-06-24T08:00:00.000Z";
const finalTranslationMinimums = {
  title: 8,
  summary: 24,
  content_markdown: 160
};
const finalUpdateTokens = [finalUpdateId, finalUpdateSlug, finalMainVersion, finalTitleEn];
const finalUpdateStarted = [mainJs, apiJs, schemaSql, indexHtml, changelog].some((source) =>
  finalUpdateTokens.some((token) => source.includes(token))
);
const changelog20260623Section = markdownSection(changelog, "## 2026-06-23");
const changelog20260624Section = markdownSection(changelog, "## 2026-06-24");

if (!finalUpdateStarted) {
  if (!indexHtml.includes(`/js/main.js?v=${currentPreFinalMainVersion}`)) {
    fail(`index.html pre-final main.js query should be ${currentPreFinalMainVersion}`);
  }

  if (!changelog20260623Section.includes(`主站 main.js cache query 更新为 \`${currentPreFinalMainVersion}\``)) {
    fail(`CHANGELOG.md should name the current pre-final main.js query ${currentPreFinalMainVersion}`);
  }

  for (const supersededMainVersion of [supersededAccountA11yMainVersion, "20260623-hidden-dialog-focus-r1", "20260623-honest-empty-states-r1", "20260623-resource-social-source-r1", "20260623-url-social-quicklinks-r1", "20260623-article-short-hash-r1", "20260623-chat-cooldown-clamp-r1", "20260623-route-article-deeplink-r1", "20260623-article-detail-meta-r1", "20260623-hover-cache-guard-r1", "20260623-storage-safe-r1", "20260623-article-cache-avatar-alt-r1", "20260623-dialog-toc-a11y-r1", "20260623-article-toc-focus-a11y-r1", "20260623-game-cache-detail-retry-r1", "20260623-chat-sync-status-r1", "20260623-chat-sending-state-r2"]) {
    if (!changelog20260623Section.includes(supersededMainVersion)) {
      fail(`CHANGELOG.md should mention superseded main.js query ${supersededMainVersion} before final wrap-up`);
    }
  }
}

if (finalUpdateStarted) {
  for (const token of [
    'date: "2026.06.23"',
    'date: "2026.06.24"',
    finalTitleEn
  ]) {
    if (!mainJs.includes(token)) {
      fail(`js/main.js final public update fallback missing ${token}`);
    }
  }

  const apiFinalSeed = windowAfter(apiJs, `'${finalUpdateId}'`, 1200);
  for (const token of [
    `'${finalUpdateId}'`,
    `'${finalUpdateSlug}'`,
    "'site-updates'",
    finalPublishedAt
  ]) {
    if (!apiFinalSeed.includes(token)) {
      fail(`functions/api/[[route]].js final public update seed missing ${token}`);
    }
  }

  const apiTranslationMarker = apiJs.includes(`articleTranslationsStatements(env, "${finalUpdateId}"`)
    ? `articleTranslationsStatements(env, "${finalUpdateId}"`
    : `articleTranslationsStatements(env, '${finalUpdateId}'`;
  const apiFinalTranslations = objectBlockAfterMarker(apiJs, apiTranslationMarker);
  if (!apiFinalTranslations) {
    fail("functions/api/[[route]].js final public update translations missing");
  } else {
    for (const lang of ["zh", "en", "ja"]) {
      const langBlock = propertyObjectBlock(apiFinalTranslations, lang);
      if (!langBlock) {
        fail(`functions/api/[[route]].js final public update missing ${lang} translation`);
        continue;
      }
      for (const [field, minimumLength] of Object.entries(finalTranslationMinimums)) {
        const value = jsStringPropertyValue(langBlock, field);
        if (!value || value.trim().length < minimumLength) {
          fail(`functions/api/[[route]].js final public update ${lang}.${field} should be populated`);
        }
      }
    }
  }

  const schemaFinalSeed = windowAfter(schemaSql, `'${finalUpdateId}'`, 1200);
  for (const token of [
    `'${finalUpdateId}'`,
    `'${finalUpdateSlug}'`,
    "'site-updates'",
    finalPublishedAt
  ]) {
    if (!schemaFinalSeed.includes(token)) {
      fail(`cloudflare/schema.sql final public update seed missing ${token}`);
    }
  }

  for (const lang of ["zh", "en", "ja"]) {
    if (countLiteral(schemaSql, `'${finalUpdateId}-${lang}'`) !== 1) {
      fail(`cloudflare/schema.sql final public update should have one ${lang} translation id`);
    }
    const languageTuplePattern = new RegExp(`${escapeRegExp(`'${finalUpdateId}'`)}\\s*,\\s*${escapeRegExp(`'${lang}'`)}`);
    if (!hasPattern(schemaSql, languageTuplePattern)) {
      fail(`cloudflare/schema.sql final public update missing ${lang} language tuple`);
    }
    const schemaLangSeed = windowAfter(schemaSql, `'${finalUpdateId}-${lang}'`, 2400);
    const schemaValues = sqlSingleQuotedValues(schemaLangSeed);
    const [translationId, articleId, rowLang, title, summary, contentMarkdown] = schemaValues;
    if (translationId !== `${finalUpdateId}-${lang}` || articleId !== finalUpdateId || rowLang !== lang) {
      fail(`cloudflare/schema.sql final public update ${lang} translation tuple should start with the expected ids`);
      continue;
    }
    for (const [field, value] of [
      ["title", title],
      ["summary", summary],
      ["content_markdown", contentMarkdown]
    ]) {
      if (!value || value.trim().length < finalTranslationMinimums[field]) {
        fail(`cloudflare/schema.sql final public update ${lang}.${field} should be populated`);
      }
    }
  }

  for (const token of [
    'id="top-updated">2026.06.24',
    `/js/main.js?v=${finalMainVersion}`
  ]) {
    if (!indexHtml.includes(token)) {
      fail(`index.html final public update sync missing ${token}`);
    }
  }

  for (const token of [
    finalMainVersion,
    "site-updates",
    "fallback",
    "Functions seed",
    "schema seed"
  ]) {
    if (!changelog20260624Section.includes(token)) {
      fail(`CHANGELOG.md final public update sync missing ${token}`);
    }
  }
}

for (const [name, source] of [
  ["index.html", indexHtml],
  ["css/style.css", styleCss],
  ["js/main.js", mainJs],
  ["functions/api/[[route]].js", apiJs]
]) {
  if (/data-rss|rssFeed|syncRssLinks|rss\.xml|feed\.xml|application\/rss\+xml|rss-button|rss-icon/i.test(source)) {
    fail(`${name} should not keep RSS subscription entry points or feed code`);
  }
}

if (/wrangler\s+(?:pages\s+)?deploy/i.test(packageJson) || !packageJson.includes("Merge to GitHub main")) {
  fail("package.json deploy script should point to merge-to-main Cloudflare Pages deployment, not Wrangler manual deploy");
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

function createRecordingD1() {
  const calls = [];
  function createStatement(sql) {
    return {
      sql,
      params: [],
      bind(...params) {
        this.params = params;
        calls.push({ sql, params });
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
    calls,
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

function createChatCursorRecoveryD1({ cursorId, cursorCreatedAt, rows }) {
  const calls = [];
  function createStatement(sql) {
    return {
      sql,
      params: [],
      bind(...params) {
        this.params = params;
        calls.push({ sql, params });
        return this;
      },
      async run() {
        return { success: true };
      },
      async first() {
        if (/select\s+created_at\s+from\s+anonymous_chat_messages\s+where\s+message_id\s*=\s*\?/i.test(sql)) {
          return null;
        }
        return null;
      },
      async all() {
        if (/from\s+anonymous_chat_messages/i.test(sql) && /created_at\s*>\s*\?/i.test(sql)) {
          if (this.params[0] !== cursorCreatedAt || this.params[1] !== cursorCreatedAt || this.params[2] !== cursorId) {
            fail("functions/api/[[route]].js chat cursor recovery should query from the recovered message timestamp");
          }
          return { results: rows };
        }
        return { results: [] };
      }
    };
  }

  return {
    calls,
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

function analyticsParamCalls(db, tableName) {
  const pattern = new RegExp(`insert\\s+into\\s+${tableName}\\b`, "i");
  return db.calls.filter((call) => pattern.test(call.sql));
}

function assertAnalyticsParamsRedacted(calls, label, forbiddenValues) {
  if (calls.length !== 1) {
    fail(`functions/api/[[route]].js analytics ${label} smoke expected 1 insert, got ${calls.length}`);
    return;
  }
  const serialized = JSON.stringify(calls[0].params);
  for (const forbiddenValue of forbiddenValues) {
    if (serialized.includes(forbiddenValue)) {
      fail(`functions/api/[[route]].js analytics ${label} must redact literal and URL-encoded email-like text before DB writes`);
    }
  }
  if (!serialized.includes(analyticsRedactionMarker)) {
    fail(`functions/api/[[route]].js analytics ${label} did not record a redacted marker`);
  }
}

function assertAnalyticsCallSetRedacted(calls, label, forbiddenValues) {
  if (calls.length < 1) {
    fail(`functions/api/[[route]].js analytics ${label} smoke expected at least 1 insert, got ${calls.length}`);
    return;
  }
  const serialized = JSON.stringify(calls.flatMap((call) => call.params));
  for (const forbiddenValue of forbiddenValues) {
    if (serialized.includes(forbiddenValue)) {
      fail(`functions/api/[[route]].js analytics ${label} must redact literal and URL-encoded email-like text before DB writes`);
    }
  }
  if (!serialized.includes(analyticsRedactionMarker)) {
    fail(`functions/api/[[route]].js analytics ${label} did not record a redacted marker`);
  }
}

async function runTelemetryFrontendRedactionSmoke() {
  const requests = [];
  const listeners = {
    document: new Map(),
    window: new Map()
  };
  const { literal: literalEmail, encoded: encodedEmail, doubleEncoded: doubleEncodedEmail } = frontendEmailSmokeSample;

  function recordListener(target, eventName, handler) {
    listeners[target].set(eventName, handler);
  }

  function fakeFetch(url, options = {}) {
    const body = options.body ? JSON.parse(options.body) : null;
    requests.push({ url: String(url), body });
    return Promise.resolve({ ok: true });
  }

  const fakeTarget = {
    tagName: "A",
    id: `profile-${literalEmail}`,
    classList: ["account-link", encodedEmail, doubleEncodedEmail],
    dataset: {
      route: `/account/${encodedEmail}`
    },
    innerText: `Open ${literalEmail}`,
    title: `Open ${encodedEmail}`,
    closest() {
      return this;
    },
    getAttribute(name) {
      const attributes = {
        href: `/account?encoded=${encodedEmail}&double=${doubleEncodedEmail}`,
        "data-analytics-label": "",
        "data-telemetry-label": "",
        "aria-label": `Account ${literalEmail}`
      };
      return attributes[name] || "";
    }
  };

  const context = {
    console,
    navigator: { language: `en-US-${literalEmail}` },
    fetch: fakeFetch,
    URL,
    URLSearchParams,
    window: {
      innerWidth: 1280,
      innerHeight: 720,
      location: {
        origin: "https://example.test",
        protocol: "https:",
        host: "example.test",
        pathname: "/account",
        search: `?literal=${literalEmail}&encoded=${encodedEmail}`,
        hash: `#/profile/${doubleEncodedEmail}`
      },
      history: {
        pushState() {},
        replaceState() {}
      },
      setTimeout(callback) {
        callback();
      },
      addEventListener(eventName, handler) {
        recordListener("window", eventName, handler);
      }
    },
    document: {
      documentElement: { lang: "en-US" },
      referrer: `https://referrer.example.test/?from=${doubleEncodedEmail}`,
      title: `Profile ${literalEmail}`,
      hidden: false,
      addEventListener(eventName, handler) {
        recordListener("document", eventName, handler);
      }
    }
  };
  context.window.window = context.window;
  context.window.document = context.document;
  context.window.navigator = context.navigator;

  runInNewContext(telemetryJs, context, { filename: "js/telemetry.js" });
  await Promise.resolve();
  await Promise.resolve();

  const clickHandler = listeners.document.get("click");
  if (typeof clickHandler !== "function") {
    fail("js/telemetry.js frontend email-redaction smoke could not attach click handler");
    return;
  }
  clickHandler({ target: fakeTarget, clientX: 12, clientY: 34 });
  await Promise.resolve();

  const analyticsPayloads = requests
    .filter((request) => /\/(?:page-view|click)$/.test(request.url))
    .map((request) => request.body);

  if (analyticsPayloads.length < 2) {
    fail(`js/telemetry.js frontend email-redaction smoke expected page-view and click payloads, got ${analyticsPayloads.length}`);
    return;
  }

  for (const [index, payload] of analyticsPayloads.entries()) {
    const serialized = JSON.stringify(payload);
    for (const forbiddenValue of frontendForbiddenEmailTexts) {
      if (serialized.includes(forbiddenValue)) {
        fail(`js/telemetry.js frontend email-redaction smoke leaked ${forbiddenValue} in payload ${index + 1}`);
      }
    }
  }

  const pageViewPayload = analyticsPayloads.find((payload) => Object.hasOwn(payload, "referrer"));
  const clickPayload = analyticsPayloads.find((payload) => Object.hasOwn(payload, "targetKey"));
  if (!pageViewPayload || !clickPayload) {
    fail("js/telemetry.js frontend privacy smoke expected both page-view and click payload shapes");
    return;
  }

  if (/[?=&]|%40|%2540/i.test(pageViewPayload.path) || pageViewPayload.path !== "/other") {
    fail(`js/telemetry.js frontend privacy smoke should strip non-whitelisted path details, got ${pageViewPayload.path}`);
  }
  if (pageViewPayload.referrer !== "https://referrer.example.test") {
    fail(`js/telemetry.js frontend privacy smoke should reduce external referrers to origin, got ${pageViewPayload.referrer}`);
  }
  if (clickPayload.targetText !== "") {
    fail("js/telemetry.js frontend privacy smoke should not collect visible click text without a stable analytics label");
  }
  if (clickPayload.href !== "/other") {
    fail(`js/telemetry.js frontend privacy smoke should strip href query/hash details, got ${clickPayload.href}`);
  }
  if (clickPayload.dataRoute !== "home" || clickPayload.route !== "home") {
    fail("js/telemetry.js frontend privacy smoke should normalize unknown route-like values to home");
  }
}

await runTelemetryFrontendRedactionSmoke();

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
  for (const path of ["/api/articles?lang=zh", "/api/videos?lang=zh", "/api/social-links", "/api/sitemap.xml"]) {
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

    if (path === "/api/social-links" && response.status < 500) {
      const payload = await response.json();
      const links = Object.fromEntries((payload.links || []).map((item) => [item.platform, item.url]));
      if (links.bilibili || links.discord) {
        fail("functions/api/[[route]].js /api/social-links should keep Bilibili/Discord empty until configured");
      }
    }
  }

  const deletedChatCursorDate = new Date("2026-06-23T01:02:03.456Z");
  const deletedChatCursorId = `${deletedChatCursorDate.getTime().toString(36)}-aaaaaaaaa`;
  const recoveredChatRows = [
    {
      message_id: `${deletedChatCursorDate.getTime().toString(36)}-zzzzzzzzz`,
      visitor_id: "visitor-next",
      nickname: "路过的像素",
      content: "same millisecond follow-up",
      created_at: deletedChatCursorDate.toISOString()
    },
    {
      message_id: `${(deletedChatCursorDate.getTime() + 1000).toString(36)}-bbbbbbbbb`,
      visitor_id: "visitor-later",
      nickname: "蓝屏小纸条",
      content: "later follow-up",
      created_at: new Date(deletedChatCursorDate.getTime() + 1000).toISOString()
    }
  ];
  const chatRecoveryDb = createChatCursorRecoveryD1({
    cursorId: deletedChatCursorId,
    cursorCreatedAt: deletedChatCursorDate.toISOString(),
    rows: recoveredChatRows
  });
  const chatRecoveryResponse = await onRequest({
    request: new Request(`https://example.test/api/chat/messages?after=${deletedChatCursorId}&limit=10`),
    env: { DB: chatRecoveryDb },
    waitUntil() {}
  });
  if (!chatRecoveryResponse?.ok) {
    const body = chatRecoveryResponse ? await chatRecoveryResponse.text() : "";
    fail(`functions/api/[[route]].js chat deleted-cursor recovery smoke returned ${chatRecoveryResponse?.status || "no response"}: ${body}`);
  } else {
    const payload = await chatRecoveryResponse.json();
    if (
      !Array.isArray(payload.messages)
      || payload.messages.length !== recoveredChatRows.length
      || payload.messages[0]?.message_id !== recoveredChatRows[0].message_id
    ) {
      fail("functions/api/[[route]].js chat deleted-cursor recovery smoke should return recovered follow-up messages");
    }
  }

  const analyticsDb = createRecordingD1();
  const {
    literal: sampleEmail,
    encoded: encodedSampleEmail,
    doubleEncoded: doubleEncodedSampleEmail
  } = backendEmailSmokeSample;
  const pageViewResponse = await onRequest({
    request: new Request("https://example.test/api/analytics/page-view", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": `build-check ${sampleEmail}`,
        "Accept-Language": `zh-CN-${doubleEncodedSampleEmail}`
      },
      body: JSON.stringify({
        path: `/knowledge?email=${encodedSampleEmail}`,
        route: `knowledge:${sampleEmail}`,
        referrer: `https://referrer.example.test/?from=${doubleEncodedSampleEmail}`,
        title: `Knowledge ${sampleEmail}`,
        lang: "zh",
        language: `zh-CN-${doubleEncodedSampleEmail}`,
        screenWidth: 1280,
        screenHeight: 720
      })
    }),
    env: { DB: analyticsDb },
    waitUntil() {}
  });
  if (!pageViewResponse?.ok) {
    const body = pageViewResponse ? await pageViewResponse.text() : "";
    fail(`functions/api/[[route]].js analytics page-view email-redaction smoke returned ${pageViewResponse?.status || "no response"}: ${body}`);
  }

  const clickResponse = await onRequest({
    request: new Request("https://example.test/api/analytics/click", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": `build-check ${sampleEmail}`,
        "Accept-Language": `zh-CN-${doubleEncodedSampleEmail}`
      },
      body: JSON.stringify({
        path: `/account?email=${encodedSampleEmail}&double=${doubleEncodedSampleEmail}`,
        route: `account:${sampleEmail}`,
        targetKey: `button#account-${encodedSampleEmail}[route=/account?email=${encodedSampleEmail}&double=${doubleEncodedSampleEmail}]`,
        targetText: `Account ${sampleEmail} ${doubleEncodedSampleEmail}`,
        tagName: "button",
        elementId: `account-${encodedSampleEmail}`,
        elementClasses: `logged-in ${sampleEmail} ${doubleEncodedSampleEmail}`,
        href: `https://example.test/account?email=${encodedSampleEmail}&double=${doubleEncodedSampleEmail}`,
        dataRoute: `/account?email=${encodedSampleEmail}&double=${doubleEncodedSampleEmail}`,
        language: `zh-CN-${doubleEncodedSampleEmail}`,
        screenWidth: 1280,
        screenHeight: 720,
        x: 12,
        y: 34
      })
    }),
    env: { DB: analyticsDb },
    waitUntil() {}
  });
  if (!clickResponse?.ok) {
    const body = clickResponse ? await clickResponse.text() : "";
    fail(`functions/api/[[route]].js analytics click email-redaction smoke returned ${clickResponse?.status || "no response"}: ${body}`);
  }
  assertAnalyticsParamsRedacted(analyticsParamCalls(analyticsDb, "analytics_page_views"), "page-view", backendForbiddenEmailTexts);
  assertAnalyticsParamsRedacted(analyticsParamCalls(analyticsDb, "analytics_click_events"), "click", backendForbiddenEmailTexts);
  assertAnalyticsCallSetRedacted(analyticsParamCalls(analyticsDb, "site_visitors"), "visitor-profile", backendForbiddenEmailTexts);

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
