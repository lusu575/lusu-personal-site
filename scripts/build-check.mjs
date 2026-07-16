import { createHash, createHmac } from "node:crypto";
import { readFileSync, existsSync, statSync } from "node:fs";
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
const API_RUNTIME_SECRETS = Object.freeze({
  CHAT_IP_HASH_SALT: "build-check-chat-ip-hash-secret-000000001",
  ANALYTICS_IP_HASH_SALT: "build-check-analytics-ip-hash-secret-00001"
});

function apiEnv(DB) {
  return { DB, ...API_RUNTIME_SECRETS };
}

const requiredFiles = [
  ".env.example",
  ".github/workflows/verify.yml",
  ".gitignore",
  ".nvmrc",
  "AGENTS.md",
  "README.md",
  "admin/index.html",
  "admin/admin.css",
  "admin/admin.js",
  "assets/images/admin-world-map.svg",
  "admin/transfer.html",
  "admin/transfer.css",
  "admin/transfer.js",
  "admin/docs/ADMIN_CHANGELOG.md",
  "admin/docs/ADMIN_PROJECT_CONTEXT.md",
  "admin/docs/ADMIN_SKILL.md",
  "cloudflare/schema.sql",
  "cloudflare/schema-indexes.sql",
  "functions/admin/_middleware.js",
  "functions/api/[[route]].js",
  "functions/api/transfer-service.mjs",
  "functions/sitemap.xml.js",
  "assets/images/ui/pixel-ui-glyph-atlas.png",
  "assets/images/mobile-wallpapers/morning.webp",
  "assets/images/mobile-wallpapers/day.webp",
  "assets/images/mobile-wallpapers/dusk.webp",
  "assets/images/mobile-wallpapers/night.webp",
  "css/mobile-ios-shell.css",
  "css/motion-system.css",
  "css/style.css",
  "css/transfer.css",
  "design-system/MASTER.md",
  "design-system/pages/desktop-shell.md",
  "design-system/pages/mobile-shell.md",
  "games/2048/index.html",
  "games/a-dark-room/index.html",
  "games/hextris/index.html",
  "games/kittens-game/index.html",
  "games/life-restart/index.html",
  "games/game-shell.js",
  "js/mobile-shell.js",
  "js/main.js",
  "js/transfer.js",
  "js/telemetry.js",
  "js/ui-motion.js",
  "manifest.webmanifest",
  "assets/transfer/quick-transfer-icons.png",
  "assets/transfer/quick-transfer-icons-source.png",
  "docs/transfer/README.md",
  "docs/transfer/ASSET_MANIFEST.md",
  "docs/transfer/dev-vars.example",
  "workers/transfer-cleanup/index.mjs",
  "workers/transfer-cleanup/wrangler.jsonc",
  "package-lock.json",
  "package.json",
  "scripts/d1-migrate-local.mjs",
  "scripts/run-tests.mjs",
  "robots.txt",
  "CHANGELOG.md",
  "wrangler.jsonc"
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

function parseJsonSource(path, source) {
  try {
    return JSON.parse(source);
  } catch (error) {
    fail(`${path} must contain valid JSON: ${error.message}`);
    return {};
  }
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function readRequiredJson(path) {
  return parseJsonSource(path, readRequired(path));
}

function referencedFilePath(basePath, referencedPath, boundaryPath, label, { allowParentSegments = false } = {}) {
  const value = String(referencedPath || "").trim().replace(/\\/g, "/");
  if (
    !value
    || value.startsWith("/")
    || /^[a-z]:/i.test(value)
    || /[?#]/.test(value)
    || (!allowParentSegments && value.split("/").includes(".."))
  ) {
    fail(`${label} must use a plain relative published path`);
    return "";
  }

  const base = resolve(root, basePath);
  const boundary = resolve(root, boundaryPath);
  const fullPath = resolve(base, value);
  const fromBoundary = relative(boundary, fullPath);
  if (
    !fromBoundary
    || fromBoundary === ".."
    || fromBoundary.startsWith(`..\\`)
    || fromBoundary.startsWith("../")
    || /^[a-z]:/i.test(fromBoundary)
  ) {
    fail(`${label} escapes ${boundaryPath}`);
    return "";
  }
  return fullPath;
}

function requireReferencedNonEmptyFile(basePath, referencedPath, boundaryPath, label, options) {
  const fullPath = referencedFilePath(basePath, referencedPath, boundaryPath, label, options);
  if (!fullPath) return "";
  if (!existsSync(fullPath)) {
    fail(`${label} missing ${relative(root, fullPath)}`);
    return "";
  }
  const fileStat = statSync(fullPath);
  if (!fileStat.isFile() || fileStat.size <= 0) {
    fail(`${label} must reference a non-empty file`);
    return "";
  }
  return fullPath;
}

function requireNonEmptyFile(path) {
  const fullPath = resolve(root, path);
  if (!existsSync(fullPath)) {
    fail(`missing ${path}`);
    return;
  }
  if (statSync(fullPath).size <= 0) {
    fail(`${path} must not be empty`);
  }
}

function requireBalancedCss(path, source) {
  const openBraces = (source.match(/\{/g) || []).length;
  const closeBraces = (source.match(/\}/g) || []).length;
  if (openBraces !== closeBraces) {
    fail(`${path} brace mismatch (${openBraces} open, ${closeBraces} close)`);
  }
}

function visibleHtmlText(source) {
  return source
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasVersionedAssetReference(html, assetPath) {
  const pattern = new RegExp(`${escapeRegExp(assetPath)}\\?v=[^"']+`);
  return pattern.test(html);
}

function assetQueryVersions(source, assetPath) {
  const pattern = new RegExp(`${escapeRegExp(assetPath)}\\?v=([^"')\\s;]+)`, "g");
  return [...source.matchAll(pattern)].map((match) => match[1]);
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
        const escaped = source[index + 1];
        value += escaped === "n" ? "\n"
          : escaped === "r" ? "\r"
            : escaped === "t" ? "\t"
              : escaped;
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

for (const file of [
  "assets/images/ui/pixel-ui-glyph-atlas.png",
  "assets/images/mobile-wallpapers/morning.webp",
  "assets/images/mobile-wallpapers/day.webp",
  "assets/images/mobile-wallpapers/dusk.webp",
  "assets/images/mobile-wallpapers/night.webp",
  "css/mobile-ios-shell.css",
  "css/motion-system.css",
  "design-system/MASTER.md",
  "design-system/pages/desktop-shell.md",
  "design-system/pages/mobile-shell.md",
  "js/mobile-shell.js",
  "js/ui-motion.js"
]) {
  requireNonEmptyFile(file);
}

const adminHtml = readRequired("admin/index.html");
const adminCss = readRequired("admin/admin.css");
const adminJs = readRequired("admin/admin.js");
const adminWorldMapSvg = readRequired("assets/images/admin-world-map.svg");
const adminMiddlewareJs = readRequired("functions/admin/_middleware.js");
const apiJs = readRequired("functions/api/[[route]].js");
const transferApiJs = readRequired("functions/api/transfer-service.mjs");
const schemaSql = readRequired("cloudflare/schema.sql");
const schemaIndexesSql = readRequired("cloudflare/schema-indexes.sql");
const d1MigrateLocalJs = readRequired("scripts/d1-migrate-local.mjs");
const testRunnerJs = readRequired("scripts/run-tests.mjs");
const indexHtml = readRequired("index.html");
const mobileIosShellCss = readRequired("css/mobile-ios-shell.css");
const motionSystemCss = readRequired("css/motion-system.css");
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
const mobileShellJs = readRequired("js/mobile-shell.js");
const mainJs = readRequired("js/main.js");
const transferCss = readRequired("css/transfer.css");
const transferJs = readRequired("js/transfer.js");
const telemetryJs = readRequired("js/telemetry.js");
const uiMotionJs = readRequired("js/ui-motion.js");
const manifest = readRequired("manifest.webmanifest");
const envExample = readRequired(".env.example");
const gitignore = readRequired(".gitignore");
const nodeVersion = readRequired(".nvmrc");
const rootReadme = readRequired("README.md");
const verifyWorkflow = readRequired(".github/workflows/verify.yml");
const wranglerConfig = readRequired("wrangler.jsonc");
const packageJson = readRequired("package.json");
const robots = readRequired("robots.txt");
const changelog = readRequired("CHANGELOG.md");
const headersConfig = readRequired("_headers");
const redirectsConfig = readRequired("_redirects");

for (const [label, source, markers] of [
  ["index.html transfer UI", indexHtml, ["id=\"transfer-app\"", "/css/transfer.css", "/js/transfer.js"]],
  ["js/main.js transfer resource", mainJs, ["seed-update-2026-07-16-quick-transfer", "quick-transfer", "quickTransferOpen"]],
  ["transfer API", transferApiJs, ["handleTransferApi", "ensureTransferSchema", "runTransferCleanup"]],
  ["transfer client", transferJs, ["QuickTransfer", "deriveRoom", "runMultipart"]],
  ["transfer schema", schemaSql, ["transfer_rooms", "transfer_upload_sessions", "transfer_alerts"]]
]) {
  for (const marker of markers) {
    if (!source.includes(marker)) fail(`${label} missing ${marker}`);
  }
}

if (!hasPattern(transferCss, /#resource-list\s*>\s*\.resource-card\s*\{[\s\S]*?width:\s*100%[\s\S]*?height:\s*210px[\s\S]*?max-height:\s*210px/)
  || !hasPattern(transferCss, /#resource-list\s+\.meta-row\s*\{[\s\S]*?flex-wrap:\s*wrap[\s\S]*?overflow:\s*visible/)
  || !hasPattern(transferCss, /html\[data-ui-shell="mobile"\]\s+#resource-list\s+\.meta-row\s*\{[\s\S]*?flex-wrap:\s*wrap[\s\S]*?overflow:\s*visible/)) {
  fail("css/transfer.css should keep Resource cards equal-width/equal-height while exposing wrapped mobile metadata");
}

if (!hasPattern(transferCss, /body\[data-route="resources"\]\s+\.topbar-actions\s*\{\s*display:\s*contents/)
  || !hasPattern(transferCss, /body\[data-route="resources"\]\s+\.account-widget\s*\{\s*display:\s*contents/)
  || !hasPattern(transferJs, /function\s+openAccountFromTransfer[\s\S]*openAccountPopover\(\{\s*returnFocus:\s*trigger\s*\}\)/)
  || !hasPattern(transferJs, /addEventListener\(["']lusu:accountchange["'],\s*syncAccountState\)/)
  || !hasPattern(mainJs, /function\s+openAccountPopover\(options\s*=\s*\{\}\)[\s\S]*accountPopoverReturnFocus/)) {
  fail("Quick Transfer sign-in should open the mobile account popover and restore authentication/focus state");
}

if (!hasPattern(transferJs, /catch\s*\(error\)\s*\{\s*if\s*\(error\.status\s*===\s*401\)\s*\{\s*stopPoll\(\)/)) {
  fail("Quick Transfer should stop room polling as soon as the account session becomes unauthorized");
}

if (!indexHtml.includes('id="transfer-drop-overlay"')
  || !hasPattern(transferJs, /refs\.dropSurface\?\.addEventListener\(["']dragenter["'],\s*handleWindowDragEnter\)/)
  || !hasPattern(transferJs, /refs\.dropSurface\?\.addEventListener\(["']drop["'],\s*handleWindowDrop\)/)
  || !hasPattern(transferJs, /function\s+isFileDrag[\s\S]*dataTransfer\?\.types[\s\S]*includes\(["']Files["']\)/)
  || !hasPattern(transferJs, /function\s+queueFiles\([\s\S]*!state\.config\?\.r2Ready[\s\S]*setFeedback\(text\(["']r2Missing["']\),\s*true\)[\s\S]*return/)
  || !hasPattern(transferJs, /function\s+pumpTaskQueue\(\)\s*\{\s*if\s*\(!state\.config\?\.r2Ready\)\s*\{\s*failPendingTasksForUnavailableStorage\(\)/)
  || !hasPattern(transferJs, /payload\.code\s*\|\|\s*["']["'][\s\S]*error\.code\s*===\s*["']TRANSFER_R2_NOT_BOUND["']/)
  || !hasPattern(transferCss, /\.transfer-drop-overlay\s*\{[\s\S]*position:\s*absolute[\s\S]*pointer-events:\s*none/)) {
  fail("Quick Transfer should accept file-only drops across the full window and block unavailable uploads before creating tasks");
}

if (!hasPattern(transferCss, /html\[data-ui-shell="desktop"\]\s+#resources\s+\.xp-window\.is-transfer-open\s*\{[\s\S]*height:\s*calc\(100dvh\s*-\s*var\(--chrome-window-compact-reserve\)\)/)
  || !hasPattern(transferCss, /html\[data-ui-shell="desktop"\]\s+#resources\s+\.xp-window\.is-transfer-open\s+\.transfer-feed\s*\{\s*max-height:\s*none/)
  || !hasPattern(transferJs, /refs\.windowFrame\?\.classList\.add\(["']is-transfer-open["']\)/)
  || !hasPattern(transferJs, /refs\.windowFrame\?\.classList\.remove\(["']is-transfer-open["']\)/)) {
  fail("Quick Transfer desktop window and feed should expand with the available browser viewport");
}

if (!hasPattern(transferCss, /html\[data-ui-shell="mobile"\]\s+\.transfer-feed\s*\{[\s\S]*?overflow:\s*visible[\s\S]*?overscroll-behavior:\s*auto/)
  || !hasPattern(transferCss, /html\[data-ui-shell="mobile"\]\s+\.transfer-compose\s*\{[\s\S]*?position:\s*sticky[\s\S]*?bottom:\s*0/)
  || !hasPattern(transferCss, /html\[data-ui-shell="mobile"\]\s+\.transfer-delete-button\s*\{[\s\S]*?width:\s*44px[\s\S]*?min-height:\s*44px/)
  || !hasPattern(transferJs, /function\s+keepFocusedControlVisible[\s\S]*scrollIntoView/)
  || !hasPattern(transferJs, /visualViewport\?\.addEventListener\(["']resize["'],\s*keepFocusedControlVisible/)) {
  fail("Quick Transfer mobile room should use one reachable scroll path, a sticky composer, keyboard compensation, and 44px delete controls");
}
const japaneseSubtextHtml = readRequired("tools/japanese-subtext/index.html");
const japaneseSubtextCss = readRequired("tools/japanese-subtext/style.css");
const japaneseSubtextApp = readRequired("tools/japanese-subtext/app.mjs");
const japaneseSubtextLibrarySources = Object.fromEntries([
  "audio-player.mjs",
  "cloud.mjs",
  "constants.mjs",
  "content-loader.mjs",
  "i18n.mjs",
  "question-flow.mjs",
  "storage.mjs"
].map((file) => [file, readRequired(`tools/japanese-subtext/lib/${file}`)]));
const japaneseSubtextManifest = readRequiredJson("tools/japanese-subtext/manifest.json");
const japaneseSubtextCatalog = readRequiredJson("tools/japanese-subtext/content/catalog.json");
const japaneseSubtextGenerationState = readRequiredJson("tools/japanese-subtext/content/generation-state.json");
const japaneseSubtextIllustrationManifest = readRequiredJson("tools/japanese-subtext/assets/stages/manifest.json");
const japaneseSubtextAudioManifest = readRequiredJson("tools/japanese-subtext/audio/manifest.json");
const japaneseSubtextFinalStats = readRequiredJson("tools/japanese-subtext/reports/final-stats.json");
const japaneseSubtextReleaseReport = readRequired("tools/japanese-subtext/reports/release-report.md");

function validateJapaneseSubtextReleaseContract() {
  const toolRoot = "tools/japanese-subtext";
  const contentRoot = `${toolRoot}/content`;
  const audioRoot = `${toolRoot}/audio`;
  const appVersion = "1.0.3";
  const contentVersion = "1.0.2";
  const publicTitles = {
    zh: "日语的言外之意",
    en: "Behind the Japanese",
    ja: "日本語の裏側"
  };
  const publicTitle = publicTitles.ja;
  const assetVersion = "20260714-japanese-subtext-v103-retry-r1";
  const expectedAudioCounts = Object.freeze({
    scene: 250,
    line: 2400,
    option: 2445,
    token: 4993
  });
  const expectedAudioItems = Object.values(expectedAudioCounts).reduce((sum, count) => sum + count, 0);
  const statsExpectedAudio = japaneseSubtextFinalStats.expectedAudio || {};
  const statsGeneratedAudio = japaneseSubtextFinalStats.generatedAudio || {};
  if (
    japaneseSubtextFinalStats.totalStages !== 250
    || japaneseSubtextFinalStats.totalLines !== 2400
    || japaneseSubtextFinalStats.totalQuestions !== 610
    || japaneseSubtextFinalStats.singleChoice !== 497
    || japaneseSubtextFinalStats.multipleChoice !== 113
    || japaneseSubtextFinalStats.multiQuestionStages !== 180
    || japaneseSubtextFinalStats.illustratedStages !== 250
    || japaneseSubtextFinalStats.illustrationStyles?.["monochrome-four-panel"] !== 250
    || Object.keys(japaneseSubtextFinalStats.illustrationStyles || {}).length !== 1
    || statsExpectedAudio.scenes !== expectedAudioCounts.scene
    || statsExpectedAudio.lines !== expectedAudioCounts.line
    || statsExpectedAudio.options !== expectedAudioCounts.option
    || statsExpectedAudio.tokens !== expectedAudioCounts.token
    || statsExpectedAudio.total !== expectedAudioItems
    || statsGeneratedAudio.scene !== expectedAudioCounts.scene
    || statsGeneratedAudio.line !== expectedAudioCounts.line
    || statsGeneratedAudio.option !== expectedAudioCounts.option
    || statsGeneratedAudio.token !== expectedAudioCounts.token
    || !(statsGeneratedAudio.durationSeconds > 0)
    || !(statsGeneratedAudio.bytes > 0)
  ) {
    fail(`${toolRoot}/reports/final-stats.json must contain the final verified content and audio totals`);
  }
  const expectedStageIds = new Set();
  for (let level = 1; level <= 5; level += 1) {
    for (let stage = 1; stage <= 50; stage += 1) {
      expectedStageIds.add(`L${level}-${String(stage).padStart(3, "0")}`);
    }
  }

  requireBalancedCss(`${toolRoot}/style.css`, japaneseSubtextCss);
  if (!japaneseSubtextHtml.includes(`<title>${publicTitles.zh}</title>`)) {
    fail(`${toolRoot}/index.html must use the localized default document title ${publicTitles.zh}`);
  }
  const toolHeading = japaneseSubtextHtml.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, "").trim();
  if (toolHeading !== publicTitles.zh) {
    fail(`${toolRoot}/index.html h1 must use the localized default title ${publicTitles.zh}`);
  }
  for (const asset of ["./style.css", "./app.mjs"]) {
    const versions = assetQueryVersions(japaneseSubtextHtml, asset);
    if (versions.length !== 1 || versions[0] !== assetVersion) {
      fail(`${toolRoot}/index.html ${asset} query should appear once as ${assetVersion}`);
    }
  }
  const publicModuleSources = [
    ["app.mjs", japaneseSubtextApp],
    ...Object.entries(japaneseSubtextLibrarySources).map(([file, source]) => [`lib/${file}`, source])
  ];
  for (const [file, source] of publicModuleSources) {
    const imports = [...source.matchAll(/\bfrom\s+["'](\.[^"'?]+\.mjs)(?:\?v=([^"']+))?["']/g)];
    for (const [, specifier, version] of imports) {
      if (version !== assetVersion) {
        fail(`${toolRoot}/${file} import ${specifier} must use query ${assetVersion}`);
      }
    }
    if (/\b(?:innerHTML|outerHTML|insertAdjacentHTML)\b/.test(source)) {
      fail(`${toolRoot}/${file} must not use HTML string insertion for trainer data`);
    }
  }
  if (!japaneseSubtextApp.includes("textContent")) {
    fail(`${toolRoot}/app.mjs should render trainer strings with safe text APIs`);
  }
  if (!japaneseSubtextLibrarySources["constants.mjs"].includes(`export const APP_VERSION = "${appVersion}"`)) {
    fail(`${toolRoot}/lib/constants.mjs APP_VERSION must be ${appVersion}`);
  }
  for (const token of [
    "toolVersion: `版本 ${APP_VERSION}`",
    "toolVersion: `Version ${APP_VERSION}`",
    "toolVersion: `バージョン ${APP_VERSION}`"
  ]) {
    if (!japaneseSubtextLibrarySources["i18n.mjs"].includes(token)) {
      fail(`${toolRoot}/lib/i18n.mjs must derive visible version copy from APP_VERSION`);
    }
  }
  if (!japaneseSubtextHtml.includes(`data-i18n="toolVersion">版本 ${appVersion}<`)) {
    fail(`${toolRoot}/index.html must expose the ${appVersion} default version before scripts load`);
  }

  const packageData = parseJsonSource("package.json", packageJson);
  const requiredPackageScripts = {
    "jp-subtext:build": "tools/japanese-subtext/scripts/build-content.mjs",
    "jp-subtext:validate": "tools/japanese-subtext/scripts/validate-content.mjs",
    "jp-subtext:validate:content": "tools/japanese-subtext/scripts/validate-content.mjs --skip-audio",
    "jp-subtext:validate:draft": "tools/japanese-subtext/scripts/validate-content.mjs --skip-audio --allow-partial --allow-unlocked",
    "jp-subtext:stats": "tools/japanese-subtext/scripts/content-stats.mjs",
    "jp-subtext:test": "tools/japanese-subtext/tests/*.test.mjs",
    "jp-subtext:audio:validate": "tools/japanese-subtext/scripts/validate-audio.mjs",
    "jp-subtext:audio:validate:quick": "tools/japanese-subtext/scripts/validate-audio.mjs --skip-probe",
    "jp-subtext:audio:estimate": "tools/japanese-subtext/scripts/estimate-audio-size.mjs",
    "jp-subtext:audio:merge": "tools/japanese-subtext/scripts/merge-audio-manifests.mjs"
  };
  for (const [name, token] of Object.entries(requiredPackageScripts)) {
    if (!String(packageData.scripts?.[name] || "").includes(token)) {
      fail(`package.json ${name} must run ${token}`);
    }
  }
  const releaseSteps = String(packageData.scripts?.["jp-subtext:release-check"] || "")
    .split("&&")
    .map((step) => step.trim());
  const expectedReleaseSteps = [
    "npm run jp-subtext:validate",
    "npm run jp-subtext:audio:validate -- --check-silence",
    "npm run jp-subtext:test",
    "npm run build"
  ];
  if (JSON.stringify(releaseSteps) !== JSON.stringify(expectedReleaseSteps)) {
    fail(`package.json jp-subtext:release-check must run ${expectedReleaseSteps.join(" -> ")}`);
  }

  for (const [field, expected] of Object.entries({
    id: "japanese-subtext",
    schemaVersion: 1,
    appVersion,
    contentVersion,
    title: publicTitle,
    entry: "./index.html",
    catalog: "./content/catalog.json",
    audioManifest: "./audio/manifest.json",
    audioBaseUrl: "./audio/",
    stageCount: 250,
    levels: 5
  })) {
    if (japaneseSubtextManifest[field] !== expected) {
      fail(`${toolRoot}/manifest.json ${field} must be ${JSON.stringify(expected)}`);
    }
  }
  if (JSON.stringify(japaneseSubtextManifest.supportedUiLanguages) !== JSON.stringify(["zh", "en", "ja"])) {
    fail(`${toolRoot}/manifest.json must advertise zh/en/ja UI languages`);
  }

  if (
    japaneseSubtextCatalog.schemaVersion !== 1
    || japaneseSubtextCatalog.contentVersion !== contentVersion
    || japaneseSubtextCatalog.stageCount !== 250
    || !Array.isArray(japaneseSubtextCatalog.levels)
    || japaneseSubtextCatalog.levels.length !== 5
  ) {
    fail(`${contentRoot}/catalog.json must describe content ${contentVersion} with 5 levels and 250 stages`);
  }
  for (const lang of ["zh", "en", "ja"]) {
    if (japaneseSubtextCatalog.title?.[lang] !== publicTitles[lang]) {
      fail(`${contentRoot}/catalog.json title.${lang} must be ${publicTitles[lang]}`);
    }
  }

  const indexedStages = new Map();
  const indexedBatches = new Map();
  const lockedContentStages = new Map();
  const publishedStageIllustrations = new Set();
  const illustrationByStage = new Map((japaneseSubtextIllustrationManifest.entries || []).map((entry) => [entry.stageId, entry]));
  if (
    japaneseSubtextIllustrationManifest.schemaVersion !== 1
    || japaneseSubtextIllustrationManifest.contentVersion !== contentVersion
    || japaneseSubtextIllustrationManifest.generatorVersion !== "local-four-panel-v2"
  ) {
    fail(`${toolRoot}/assets/stages/manifest.json has stale generator metadata`);
  }
  if (illustrationByStage.size !== 250) {
    fail(`${toolRoot}/assets/stages/manifest.json must contain exactly 250 stage entries`);
  }
  const expectedJlptTargets = ["N3", "N2", "N1", "N1-advanced", "N1-pragmatics"];
  for (let index = 0; index < 5; index += 1) {
    const level = index + 1;
    const catalogLevel = japaneseSubtextCatalog.levels?.[index] || {};
    if (catalogLevel.level !== level || catalogLevel.jlptTarget !== expectedJlptTargets[index]) {
      fail(`${contentRoot}/catalog.json level ${level} must target ${expectedJlptTargets[index]}`);
    }
    if (level >= 3 && !String(catalogLevel.jlptTarget || "").startsWith("N1")) {
      fail(`${contentRoot}/catalog.json levels 3-5 must remain N1 difficulty`);
    }
    requireReferencedNonEmptyFile(toolRoot, catalogLevel.cover, toolRoot, `catalog level ${level} cover`);
    const indexFile = requireReferencedNonEmptyFile(contentRoot, catalogLevel.index, contentRoot, `catalog level ${level} index`);
    if (!indexFile) {
      continue;
    }
    const levelIndex = parseJsonSource(relative(root, indexFile), readFileSync(indexFile, "utf8"));
    if (
      levelIndex.schemaVersion !== 1
      || levelIndex.contentVersion !== contentVersion
      || levelIndex.level !== level
      || levelIndex.jlptTarget !== expectedJlptTargets[index]
      || !Array.isArray(levelIndex.stages)
      || levelIndex.stages.length !== 50
    ) {
      fail(`${relative(root, indexFile)} must contain the locked 50-stage level ${level} index`);
      continue;
    }
    for (let stageIndex = 0; stageIndex < levelIndex.stages.length; stageIndex += 1) {
      const stage = levelIndex.stages[stageIndex] || {};
      const expectedId = `L${level}-${String(stageIndex + 1).padStart(3, "0")}`;
      if (stage.id !== expectedId || stage.stage !== stageIndex + 1 || !/^[a-f0-9]{64}$/.test(stage.contentHash || "")) {
        fail(`${relative(root, indexFile)} stage ${stageIndex + 1} must keep stable id ${expectedId} and a locked content hash`);
      }
      if (indexedStages.has(stage.id)) {
        fail(`${contentRoot} contains duplicate stage id ${stage.id}`);
      }
      indexedStages.set(stage.id, stage);
      if (!/^batch-\d{3}-\d{3}\.json$/.test(stage.batch || "")) {
        fail(`${relative(root, indexFile)} ${expectedId} has an unsafe batch path`);
        continue;
      }
      const batchPath = `level-${level}/${stage.batch}`;
      if (!indexedBatches.has(batchPath)) {
        indexedBatches.set(batchPath, []);
      }
      indexedBatches.get(batchPath).push(stage);
    }
  }
  if (indexedStages.size !== 250 || [...expectedStageIds].some((id) => !indexedStages.has(id))) {
    fail(`${contentRoot} level indexes must expose every stable stage id from L1-001 through L5-050`);
  }
  if (indexedBatches.size !== 25) {
    fail(`${contentRoot} indexes must reference exactly 25 ten-stage batches`);
  }
  for (const [batchPath, indexEntries] of indexedBatches) {
    const fullPath = requireReferencedNonEmptyFile(contentRoot, batchPath, contentRoot, `content batch ${batchPath}`);
    if (!fullPath) {
      continue;
    }
    const batch = parseJsonSource(relative(root, fullPath), readFileSync(fullPath, "utf8"));
    if (
      batch.schemaVersion !== 1
      || batch.contentVersion !== contentVersion
      || !Array.isArray(batch.stages)
      || batch.stages.length !== indexEntries.length
    ) {
      fail(`${relative(root, fullPath)} must match its level index and content version`);
      continue;
    }
    const expectedById = new Map(indexEntries.map((stage) => [stage.id, stage]));
    const seenBatchStageIds = new Set();
    for (const stage of batch.stages) {
      const indexed = expectedById.get(stage?.id);
      if (
        !indexed
        || seenBatchStageIds.has(stage?.id)
        || stage.textLocked !== true
        || stage.contentHash !== indexed.contentHash
      ) {
        fail(`${relative(root, fullPath)} ${stage?.id || "unknown stage"} must be text-locked with the indexed hash`);
      }
      seenBatchStageIds.add(stage?.id);
      lockedContentStages.set(stage?.id, stage);
      const illustration = stage?.illustration || {};
      if (illustration.enabled === true) {
        if (illustration.style !== "monochrome-four-panel") {
          fail(`${relative(root, fullPath)} ${stage?.id} must use the approved monochrome four-panel manga style`);
        }
        const illustrationFile = requireReferencedNonEmptyFile(toolRoot, illustration.src, toolRoot, `illustration ${stage?.id}`);
        if (!illustrationFile || !String(illustration.src || "").endsWith(".webp")) {
          fail(`${relative(root, fullPath)} ${stage?.id} must reference a published WebP illustration`);
        }
        const illustrationEntry = illustrationByStage.get(stage?.id);
        if (
          illustrationEntry?.path !== illustration.src
          || illustrationEntry?.style !== "monochrome-four-panel"
          || illustrationEntry?.width !== 960
          || illustrationEntry?.height !== 720
          || illustrationEntry?.reviewStatus !== "automated-scene-mapped"
          || illustrationEntry?.sha256 !== illustration.sha256
        ) {
          fail(`${relative(root, fullPath)} ${stage?.id} illustration metadata must match the asset manifest`);
        }
        if (illustrationFile && createHash("sha256").update(readFileSync(illustrationFile)).digest("hex") !== illustration.sha256) {
          fail(`${relative(root, fullPath)} ${stage?.id} illustration SHA-256 is stale`);
        }
        publishedStageIllustrations.add(illustration.src);
      } else {
        fail(`${relative(root, fullPath)} ${stage?.id} must publish a stage-specific illustration`);
      }
    }
    if ([...expectedById.keys()].some((id) => !seenBatchStageIds.has(id))) {
      fail(`${relative(root, fullPath)} must contain every stage referenced by its level index exactly once`);
    }
  }
  if (publishedStageIllustrations.size !== 250) {
    fail(`${contentRoot} must reference exactly 250 unique monochrome four-panel manga illustrations`);
  }

  const generationState = japaneseSubtextGenerationState;
  if (
    generationState.schemaVersion !== 1
    || generationState.contentVersion !== contentVersion
    || generationState.blueprint?.status !== "complete"
    || generationState.blueprint?.stageCount !== 250
    || generationState.formalContent?.status !== "reviewed-and-locked"
  ) {
    fail(`${contentRoot}/generation-state.json must record the complete, reviewed, locked 250-stage bank`);
  }
  for (let level = 1; level <= 5; level += 1) {
    if (generationState.blueprint?.levelCounts?.[String(level)] !== 50) {
      fail(`${contentRoot}/generation-state.json blueprint level ${level} count must be 50`);
    }
  }
  for (const key of ["authoredBatches", "reviewedBatches", "lockedBatches"]) {
    const batches = generationState.formalContent?.[key];
    if (!Array.isArray(batches) || batches.length !== 25 || new Set(batches).size !== 25) {
      fail(`${contentRoot}/generation-state.json formalContent.${key} must list 25 unique batches`);
      continue;
    }
    for (const batch of batches) {
      requireReferencedNonEmptyFile(contentRoot, batch, contentRoot, `generation-state ${key}`);
      if (!indexedBatches.has(batch)) {
        fail(`${contentRoot}/generation-state.json formalContent.${key} contains unindexed batch ${batch}`);
      }
    }
  }
  if (!Array.isArray(generationState.needsReworkStageIds) || generationState.needsReworkStageIds.length) {
    fail(`${contentRoot}/generation-state.json must not contain release-time rework stages`);
  }
  if (
    generationState.illustrations?.status !== "complete"
    || generationState.illustrations?.stageAssetCount !== 250
    || generationState.illustrations?.styleCounts?.["monochrome-four-panel"] !== 250
    || generationState.illustrations?.manifest !== "assets/stages/manifest.json"
    || generationState.illustrations?.generatorVersion !== "local-four-panel-v2"
    || generationState.illustrations?.reviewStatus !== "automated-scene-mapped"
    || generationState.illustrations?.imagegenStatus !== "network-unavailable-local-fallback"
  ) {
    fail(`${contentRoot}/generation-state.json must record 250 monochrome four-panel manga illustrations`);
  }
  if (
    generationState.audio?.status !== "complete"
    || generationState.audio?.expectedArtifacts !== expectedAudioItems
    || generationState.audio?.generatedArtifacts !== expectedAudioItems
    || generationState.audio?.generatedStages !== 250
    || generationState.audio?.validation?.contentLinks !== "pass"
    || generationState.audio?.validation?.quick !== "pass"
    || generationState.audio?.validation?.ffprobeAndSilence !== "pass"
    || generationState.audio?.validation?.phonemeAudit !== "pass"
    || generationState.audio?.validation?.validatedArtifacts !== expectedAudioItems
    || generationState.audio?.validation?.phonemeAuditedTasks !== expectedAudioItems - 250
  ) {
    fail(`${contentRoot}/generation-state.json audio must record complete content, phoneme, ffprobe, and silence validation for 250 stages and ${expectedAudioItems} artifacts`);
  }

  const audioManifest = japaneseSubtextAudioManifest;
  const expectedAudioOutput = {
    format: "mp3",
    sampleRate: 24000,
    channels: 1,
    bitrate: "64k",
    targetLufs: -18,
    leadingSilenceMs: 60,
    trailingSilenceMs: 100,
    sceneGapMs: 180
  };
  const pronunciationsSource = readRequired("tools/japanese-subtext/config/pronunciations.json");
  const pronunciationsData = parseJsonSource("tools/japanese-subtext/config/pronunciations.json", pronunciationsSource);
  const pronunciationsSha256 = createHash("sha256").update(canonicalJson(pronunciationsData), "utf8").digest("hex");
  if (
    audioManifest.schemaVersion !== 1
    || audioManifest.contentVersion !== contentVersion
    || audioManifest.audioBaseUrl !== "./"
    || audioManifest.generator?.name !== "kokoro-onnx-offline"
    || audioManifest.generator?.pipelineVersion !== "kokoro-ja-mp3-v4"
    || audioManifest.generator?.executionProvider !== "CPUExecutionProvider"
    || audioManifest.generator?.pronunciationsSha256 !== pronunciationsSha256
    || Object.entries(expectedAudioOutput).some(([key, value]) => audioManifest.generator?.output?.[key] !== value)
  ) {
    fail(`${audioRoot}/manifest.json must keep the locked Kokoro pipeline, output, and pronunciation metadata for ${contentVersion}`);
  }
  const requiredModelVoices = ["jf_alpha", "jf_gongitsune", "jf_nezumi", "jf_tebukuro", "jm_kumo"];
  const modelVoices = new Set(Object.values(audioManifest.voices || {}).map((voice) => voice?.modelVoice).filter(Boolean));
  for (const voice of requiredModelVoices) {
    if (!modelVoices.has(voice)) {
      fail(`${audioRoot}/manifest.json missing licensed Japanese model voice ${voice}`);
    }
  }
  const licensePaths = audioManifest.generator?.licenses;
  if (!Array.isArray(licensePaths) || licensePaths.length !== 3) {
    fail(`${audioRoot}/manifest.json must expose the model, runtime, and Japanese voice notices`);
  } else {
    for (const licensePath of licensePaths) {
      requireReferencedNonEmptyFile(audioRoot, licensePath, toolRoot, "audio generator license", { allowParentSegments: true });
    }
  }

  const items = audioManifest.items && typeof audioManifest.items === "object" ? audioManifest.items : {};
  const stages = audioManifest.stages && typeof audioManifest.stages === "object" ? audioManifest.stages : {};
  const itemEntries = Object.entries(items);
  const stageEntries = Object.entries(stages);
  if (itemEntries.length !== expectedAudioItems || stageEntries.length !== 250) {
    fail(`${audioRoot}/manifest.json must contain 250 stage records and exactly ${expectedAudioItems} audio items`);
  }
  if (stageEntries.length !== 250 || [...expectedStageIds].some((id) => !Object.hasOwn(stages, id))) {
    fail(`${audioRoot}/manifest.json must cover every stage id from L1-001 through L5-050`);
  }
  const actualAudioCounts = { scene: 0, line: 0, option: 0, token: 0 };
  const publishedAudioPaths = new Set();
  let audioBytes = 0;
  let audioDuration = 0;
  for (const [id, item] of itemEntries) {
    if (item?.id !== id || !Object.hasOwn(actualAudioCounts, item?.type)) {
      fail(`${audioRoot}/manifest.json audio item ${id} has an invalid id or type`);
      continue;
    }
    actualAudioCounts[item.type] += 1;
    if (!expectedStageIds.has(item.stageId) || item.level !== Number(String(item.stageId || "")[1])) {
      fail(`${audioRoot}/manifest.json audio item ${id} has an unknown stage or mismatched level (${item.stageId})`);
    }
    if (
      item.codec !== "mp3"
      || item.sampleRate !== 24000
      || item.channels !== 1
      || item.bitrate !== 64000
      || !(item.durationSeconds > 0)
      || !(item.bytes > 0)
      || !/^[a-f0-9]{64}$/.test(item.contentHash || "")
      || !/^[a-f0-9]{64}$/.test(item.sha256 || "")
      || !String(item.path || "").endsWith(".mp3")
    ) {
      fail(`${audioRoot}/manifest.json audio item ${id} must be a hashed 24 kHz mono 64 kbps MP3`);
    }
    const audioFile = requireReferencedNonEmptyFile(audioRoot, item.path, audioRoot, `audio item ${id}`);
    if (audioFile && statSync(audioFile).size !== item.bytes) {
      fail(`${audioRoot}/manifest.json audio item ${id} byte count does not match its file`);
    }
    if (publishedAudioPaths.has(item.path)) {
      fail(`${audioRoot}/manifest.json reuses audio path ${item.path}`);
    }
    publishedAudioPaths.add(item.path);
    audioBytes += Number(item.bytes) || 0;
    audioDuration += Number(item.durationSeconds) || 0;
  }
  for (const [type, expected] of Object.entries(expectedAudioCounts)) {
    if (actualAudioCounts[type] !== expected || audioManifest.stats?.[type] !== expected) {
      fail(`${audioRoot}/manifest.json ${type} count must be ${expected}`);
    }
  }
  if (
    audioManifest.stats?.bytes !== audioBytes
    || Math.abs(Number(audioManifest.stats?.durationSeconds) - audioDuration) > 0.01
  ) {
    fail(`${audioRoot}/manifest.json aggregate byte/duration stats must match all audio items`);
  }

  for (const expectedId of expectedStageIds) {
    const stage = stages[expectedId];
    const contentStage = lockedContentStages.get(expectedId);
    if (!stage) {
      continue;
    }
    if (
      stage.stageId !== expectedId
      || stage.contentVersion !== contentVersion
      || stage.level !== Number(expectedId[1])
      || stage.sampleRate !== 24000
      || !(stage.duration > 0)
      || !/^[a-f0-9]{64}$/.test(stage.contentHash || "")
      || stage.sourceContentHash !== contentStage?.contentHash
    ) {
      fail(`${audioRoot}/manifest.json missing valid stage audio record ${expectedId}`);
      continue;
    }
    const expectedLinks = {
      line: (contentStage?.lines || []).map((line) => line.audioId),
      option: (contentStage?.questions || []).flatMap((question) => (question.options || []).map((option) => option.audioId)),
      token: (contentStage?.lines || []).flatMap((line) => (line.tokens || []).map((token) => token.audioId))
    };
    const audioGroups = [
      ["scene", [stage.sceneAudioId]],
      ["line", stage.lineAudioIds],
      ["option", stage.optionAudioIds],
      ["token", stage.tokenAudioIds]
    ];
    for (const [type, ids] of audioGroups) {
      if (!Array.isArray(ids) || ids.length === 0) {
        fail(`${audioRoot}/manifest.json ${expectedId} must link at least one ${type} audio id`);
        continue;
      }
      if (new Set(ids).size !== ids.length) {
        fail(`${audioRoot}/manifest.json ${expectedId} repeats a ${type} audio id`);
      }
      for (const audioId of ids) {
        if (items[audioId]?.type !== type || items[audioId]?.stageId !== expectedId) {
          fail(`${audioRoot}/manifest.json ${expectedId} has invalid ${type} audio link ${audioId}`);
        }
      }
      if (type !== "scene" && JSON.stringify(ids) !== JSON.stringify(expectedLinks[type])) {
        fail(`${audioRoot}/manifest.json ${expectedId} ${type} links must exactly match locked content order`);
      }
    }
    const expectedCueLinks = (contentStage?.lines || []).map((line) => [line.id, line.audioId]);
    const embeddedCueLinks = (stage.cues || []).map((cue) => [cue.lineId, cue.audioId]);
    if (JSON.stringify(embeddedCueLinks) !== JSON.stringify(expectedCueLinks)) {
      fail(`${audioRoot}/manifest.json ${expectedId} cues must exactly match locked line order`);
    }
    const timelineFile = requireReferencedNonEmptyFile(audioRoot, stage.timelinePath, audioRoot, `timeline ${expectedId}`);
    if (!timelineFile) {
      continue;
    }
    const timeline = parseJsonSource(relative(root, timelineFile), readFileSync(timelineFile, "utf8"));
    if (
      timeline.schemaVersion !== 1
      || timeline.stageId !== expectedId
      || timeline.timelineId !== stage.timelineId
      || timeline.sceneAudioId !== stage.sceneAudioId
      || timeline.contentHash !== stage.contentHash
      || timeline.sourceContentHash !== stage.sourceContentHash
      || timeline.sampleRate !== 24000
      || !Array.isArray(timeline.cues)
      || timeline.cues.length !== stage.lineAudioIds.length
      || JSON.stringify((timeline.cues || []).map((cue) => [cue.lineId, cue.audioId])) !== JSON.stringify(expectedCueLinks)
      || Math.abs(Number(timeline.duration) - Number(stage.duration)) > 0.01
    ) {
      fail(`${relative(root, timelineFile)} must match the ${expectedId} stage audio record`);
    }
  }

  const resourceEntry = windowAfter(mainJs, 'iconSrc: "tools/japanese-subtext/assets/icons/tool-icon-64.webp"', 2200);
  for (const token of [
    'version: "v1.0.3"',
    'updated: "2026.07.14"',
    'external: false',
    'showReadyStatus: false',
    'url: "/tools/japanese-subtext/"',
    `title: { zh: "${publicTitles.zh}", en: "${publicTitles.en}", ja: "${publicTitles.ja}" }`,
    'actionLabel: { zh: "开始", en: "Start", ja: "開始" }',
    '{ zh: "听力训练", en: "Listening", ja: "聴解" }',
    '{ zh: "潜台词", en: "Subtext", ja: "含意" }',
    '{ zh: "支持（云存档）", en: "Cloud Save Supported", ja: "クラウドセーブ対応" }'
  ]) {
    if (!resourceEntry.includes(token)) {
      fail(`js/main.js Japanese subtext Resources entry missing ${token}`);
    }
  }
  for (const forbiddenToken of [
    'size: "250 STAGES"',
    '开始训练',
    '男声 / 女声',
    '本地 + 云端进度',
    'N3 → N1',
    '250 关',
    '可获取'
  ]) {
    if (resourceEntry.includes(forbiddenToken)) {
      fail(`js/main.js Japanese subtext Resources entry must not restore removed tag ${forbiddenToken}`);
    }
  }
  for (const lang of ["zh", "en", "ja"]) {
    if (!new RegExp(`${lang}:\\s*"[^"]{12,}"`).test(windowAfter(resourceEntry, "desc:", 650))) {
      fail(`js/main.js Japanese subtext Resources entry needs a meaningful ${lang} description`);
    }
  }
  if (
    !windowAfter(mainJs, "function safeResourceIconSrc", 700).includes('path === "tools/japanese-subtext/assets/icons/tool-icon-64.webp"')
    || !windowAfter(mainJs, "function safeResourceUrl", 1300).includes('/^tools\\/japanese-subtext\\/?$/i.test(localPath)')
  ) {
    fail("js/main.js must keep explicit safe allowlists for the Japanese subtext resource URL and icon");
  }

  const progressRoute = windowAfter(apiJs, 'parts[0] === "tools"', 900);
  if (
    !progressRoute.includes('parts[1] === "japanese-subtext"')
    || !progressRoute.includes('parts[2] === "progress"')
    || !progressRoute.includes('request.method === "GET"')
    || !progressRoute.includes('request.method === "PUT"')
  ) {
    fail("functions/api/[[route]].js must expose exact GET/PUT /api/tools/japanese-subtext/progress routing");
  }
  const getProgressBody = objectBlockAfterMarker(apiJs, "async function getJapaneseSubtextProgress");
  const putProgressBody = objectBlockAfterMarker(apiJs, "async function putJapaneseSubtextProgress");
  for (const [name, body] of [["GET", getProgressBody], ["PUT", putProgressBody]]) {
    if (!body.includes("requireSession(request, env)") || !body.includes("ensureJapaneseSubtextSchema(env)")) {
      fail(`functions/api/[[route]].js Japanese subtext ${name} progress must require an HttpOnly-backed session and dedicated schema`);
    }
    if (body.includes("game_saves")) {
      fail(`functions/api/[[route]].js Japanese subtext ${name} progress must not reuse game_saves`);
    }
  }
  for (const token of [
    "const MAX_JAPANESE_SUBTEXT_PROGRESS_BYTES = 1024 * 1024",
    'const JAPANESE_SUBTEXT_CONTENT_VERSION = "1.0.2"',
    "const JAPANESE_SUBTEXT_STAGE_LIMIT = 250",
    "create table if not exists japanese_subtext_profiles",
    "create table if not exists japanese_subtext_stage_progress",
    "primary key (user_id, stage_id)",
    "create table if not exists japanese_subtext_daily_activity",
    "primary key (user_id, local_date, stage_id)"
  ]) {
    if (!apiJs.includes(token)) {
      fail(`functions/api/[[route]].js Japanese subtext contract missing ${token}`);
    }
  }
  for (const token of [
    "create table if not exists japanese_subtext_profiles",
    "create table if not exists japanese_subtext_stage_progress",
    "primary key (user_id, stage_id)",
    "create table if not exists japanese_subtext_daily_activity",
    "primary key (user_id, local_date, stage_id)",
    "japanese_subtext_stage_progress_user_level_idx"
  ]) {
    if (!schemaSql.includes(token)) {
      fail(`cloudflare/schema.sql Japanese subtext contract missing ${token}`);
    }
  }

  const requiredHeaderRules = [
    ["/tools/japanese-subtext/manifest.json", "public, max-age=0, must-revalidate"],
    ["/tools/japanese-subtext/content/*", "public, max-age=300, must-revalidate"],
    ["/tools/japanese-subtext/audio/manifest.json", "public, max-age=0, must-revalidate"],
    ["/tools/japanese-subtext/audio/*", "public, max-age=86400, must-revalidate"],
    ["/tools/japanese-subtext/assets/*", "public, max-age=86400, must-revalidate"]
  ];
  for (const [path, cacheControl] of requiredHeaderRules) {
    const pattern = new RegExp(`(?:^|\\r?\\n)${escapeRegExp(path)}\\r?\\n[ \\t]+Cache-Control:\\s*${escapeRegExp(cacheControl)}(?:\\r?\\n|$)`);
    if (!pattern.test(headersConfig)) {
      fail(`_headers missing ${path} Cache-Control: ${cacheControl}`);
    }
  }
  if (!/(?:^|\r?\n)\/tools\/japanese-subtext \/tools\/japanese-subtext\/ 301(?:\r?\n|$)/.test(redirectsConfig)) {
    fail("_redirects must canonicalize /tools/japanese-subtext to its trailing-slash URL");
  }
  if (
    !apiJs.includes("const japaneseSubtextEntries = langs.map")
    || !apiJs.includes("/tools/japanese-subtext/?lang=${encodeURIComponent(lang)}")
    || !apiJs.includes("...japaneseSubtextEntries")
  ) {
    fail("functions/api/[[route]].js sitemap must publish the Japanese subtext URL for zh/en/ja");
  }

  for (const markerName of [
    "AUDIO_ITEM_COUNT",
    "AUDIO_STAGE_COUNT",
    "AUDIO_DURATION",
    "AUDIO_BYTES",
    "AUDIO_VALIDATION",
    "BROWSER_QA"
  ]) {
    for (const edge of ["START", "END"]) {
      const marker = `<!-- AUTO:${markerName}:${edge} -->`;
      if (!japaneseSubtextReleaseReport.includes(marker)) {
        fail(`${toolRoot}/reports/release-report.md missing replaceable marker ${marker}`);
      }
    }
  }
  for (const releaseGate of ["AUDIO_VALIDATION", "BROWSER_QA"]) {
    if (!japaneseSubtextReleaseReport.includes(`<!-- RELEASE:${releaseGate}:PASS -->`)) {
      fail(`${toolRoot}/reports/release-report.md must record RELEASE:${releaseGate}:PASS before publishing`);
    }
  }
}

validateJapaneseSubtextReleaseContract();

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

const adminSafetyCacheVersion = "20260716-admin-svg-vector-map-r1";
if (countLiteral(adminHtml, adminSafetyCacheVersion) !== 2) {
  fail("admin CSS and JS must share the current interaction-safety cache version");
}

for (const id of [
  "mobile-nav-toggle",
  "admin-sidebar",
  "mobile-nav-backdrop",
  "visitor-map-svg",
  "visitor-map-world",
  "visitor-map-points",
  "visitor-map-zoom-out",
  "visitor-map-zoom-in",
  "visitor-map-reset",
  "visitor-map-zoom-status",
  "visitor-map-tooltip",
  "visitor-map-announcement",
  "visitor-map-list",
  "article-error-summary",
  "account-password-form",
  "admin-confirm-dialog",
  "admin-unsaved-dialog"
]) {
  if (!adminHtml.includes(`id="${id}"`)) {
    fail(`admin/index.html missing safety workflow #${id}`);
  }
}

if (!hasPattern(adminHtml, /<svg[\s\S]*?id="visitor-map-svg"[\s\S]*?viewBox="0 0 1000 500"[\s\S]*?>/)) {
  fail("admin map must use a real 1000x500 SVG viewport");
}

if (!hasPattern(adminHtml, /<use[\s\S]*?id="visitor-map-world"[\s\S]*?href="\/assets\/images\/admin-world-map\.svg\?v=20260716-admin-world-map-svg-r1#admin-world-map-scene"[\s\S]*?>/)) {
  fail("admin map must render the versioned Natural Earth SVG scene through a real SVG use node");
}

if (!hasPattern(adminHtml, /<g\s+id="visitor-map-points"\s+role="group"/)) {
  fail("admin map point container must remain a real SVG group");
}

for (const requiredWorldMapToken of [
  'viewBox="0 0 1000 500"',
  'id="admin-world-map-scene"',
  "<path ",
  'vector-effect="non-scaling-stroke"'
]) {
  if (!adminWorldMapSvg.includes(requiredWorldMapToken)) {
    fail(`admin world map SVG missing ${requiredWorldMapToken}`);
  }
}

if (/<image\b|data:image\//i.test(adminWorldMapSvg)) {
  fail("admin world map SVG must not embed raster image content");
}

if (countLiteral(adminHtml, "data-master-detail=") !== 4) {
  fail("admin mobile master/detail must cover articles, videos, chat, and accounts");
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

if (!hasPattern(apiJs, /if\s*\(!cursor\)\s*\{[\s\S]*const\s+recoveredCreatedAt\s*=\s*createdAtFromChatMessageId\(after\)[\s\S]*await\s+getChatMessagesAfter\(env,\s*recoveredCreatedAt,\s*after,\s*limit,\s*roomKey\)[\s\S]*await\s+getRecentChatMessages\(env,\s*limit,\s*roomKey\)/)) {
  fail("functions/api/[[route]].js should recover deleted chat cursors instead of returning an empty incremental result forever");
}

for (const requiredChatApiText of [
  "normalizeChatRoomKey",
  "normalizeChatEncryptedContent",
  "cleanupExpiredPrivateChatRooms",
  "room_key",
  "encrypted"
]) {
  if (!apiJs.includes(requiredChatApiText)) {
    fail(`functions/api/[[route]].js missing private chat room support: ${requiredChatApiText}`);
  }
}

for (const requiredChatUiText of [
  "chat-private-room-form",
  "chat-room-toggle",
  'type="password"'
]) {
  if (!indexHtml.includes(requiredChatUiText)) {
    fail(`index.html missing private chat room UI: ${requiredChatUiText}`);
  }
}

for (const requiredChatCryptoText of [
  "crypto.subtle",
  "PBKDF2",
  "AES-GCM",
  "encryptChatContent",
  "decryptChatContent"
]) {
  if (!mainJs.includes(requiredChatCryptoText)) {
    fail(`js/main.js missing private chat crypto support: ${requiredChatCryptoText}`);
  }
}

if (!adminJs.includes("密码房加密消息")) {
  fail("admin/admin.js should show a placeholder for encrypted password-room messages");
}

const ensureChatSchemaBlock = objectBlockAfterMarker(apiJs, "async function ensureChatSchema");
if (!ensureChatSchemaBlock) {
  fail("functions/api/[[route]].js missing ensureChatSchema body");
} else {
  const addRoomKeyColumnAt = ensureChatSchemaBlock.indexOf('["room_key", "text not null default');
  const createRoomVisibleIndexAt = ensureChatSchemaBlock.indexOf("anonymous_chat_messages_room_visible_idx");
  if (addRoomKeyColumnAt < 0 || createRoomVisibleIndexAt < 0 || createRoomVisibleIndexAt < addRoomKeyColumnAt) {
    fail("functions/api/[[route]].js must add chat room_key/encrypted columns before creating room_key indexes");
  }
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

if (adminJs.includes("window.confirm")) {
  fail("admin destructive actions must use the contextual confirmation dialog");
}

for (const requiredAdminSafetyToken of [
  'window.matchMedia("(max-width: 920px)")',
  'window.addEventListener("beforeunload"',
  "openConfirmDialog",
  "openUnsavedDialog",
  "setMasterDetailView",
  "renderMapDataList",
  "handleMapWheel",
  "handleMapPointerDown",
  "handleMapPointerMove",
  "handleMapPointerEnd",
  "setMapZoom",
  "focusMapLocation",
  "resetAccountPassword"
]) {
  if (!adminJs.includes(requiredAdminSafetyToken)) {
    fail(`admin/admin.js missing safety workflow ${requiredAdminSafetyToken}`);
  }
}

for (const requiredMapEvent of [
  'addEventListener("wheel", handleMapWheel, { passive: false })',
  'addEventListener("pointerdown", handleMapPointerDown)',
  'addEventListener("pointermove", handleMapPointerMove)',
  'addEventListener("pointerup", handleMapPointerEnd)',
  'addEventListener("pointercancel", handleMapPointerEnd)',
  'addEventListener("lostpointercapture", handleMapLostPointerCapture)',
  'window.addEventListener("pointerup", handleMapPointerEnd)',
  'window.addEventListener("pointercancel", handleMapPointerEnd)',
  "setPointerCapture"
]) {
  if (!adminJs.includes(requiredMapEvent)) {
    fail(`admin interactive map missing ${requiredMapEvent}`);
  }
}

for (const requiredVectorMapToken of [
  'const SVG_NAMESPACE = "http://www.w3.org/2000/svg"',
  "document.createElementNS(SVG_NAMESPACE, tagName)",
  'createMapMarkerCircle("map-marker-hit"',
  'createMapMarkerCircle("map-marker-core"',
  'svg.setAttribute(\n    "viewBox"',
  "syncMapMarkerGeometry(viewWidth, viewHeight, map)"
]) {
  if (!adminJs.includes(requiredVectorMapToken)) {
    fail(`admin vector map missing ${requiredVectorMapToken}`);
  }
}

for (const obsoleteMapPattern of [
  /background[^;{}]*admin-world-map\.svg/i,
  /\.map-point::(?:before|after)/,
  /--map-(?:scale|inverse-scale|x|y)/,
  /translate3d\([^)]*--map-/,
  /\.map-world\s*\{/
]) {
  if (obsoleteMapPattern.test(adminCss)) {
    fail(`admin map must not retain rasterizing CSS map geometry: ${obsoleteMapPattern}`);
  }
}

if (/\.map-city-marker::(?:before|after)/.test(adminCss)) {
  fail("admin SVG city markers must use real circle nodes instead of CSS pseudo geometry");
}

const cityQueryMarker = "select country, region, city, count(*) as pv, count(distinct visitor_id) as uv";
const cityQueryAt = apiJs.indexOf(cityQueryMarker);
const cityQueryEnd = cityQueryAt < 0 ? -1 : apiJs.indexOf("limit 200", cityQueryAt);
const cityQueryBlock = cityQueryAt < 0 || cityQueryEnd < 0 ? "" : apiJs.slice(cityQueryAt, cityQueryEnd);
if (!cityQueryBlock
  || !cityQueryBlock.includes("group by country, region, city")
  || cityQueryBlock.includes("ip_prefix")
  || !cityQueryBlock.includes("count(distinct visitor_id) as uv")) {
  fail("admin map cities must aggregate exact PV/UV by country, region, and city without network identifiers");
}

for (const requiredCityContract of [
  "cities: (cityRows.results || []).map(adminAnalyticsCityRow)",
  "function adminAnalyticsCityRow"
]) {
  if (!apiJs.includes(requiredCityContract)) {
    fail(`admin analytics city response missing ${requiredCityContract}`);
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

for (const [path, source] of [
  ["js/mobile-shell.js", mobileShellJs],
  ["js/ui-motion.js", uiMotionJs]
]) {
  try {
    new Function(source);
  } catch (error) {
    fail(`${path} syntax error: ${error.message}`);
  }

  for (const pattern of [
    /\binnerHTML\b/,
    /\bouterHTML\b/,
    /\binsertAdjacentHTML\b/,
    /\bdocument\.write\s*\(/,
    /\beval\s*\(/,
    /\bnew\s+Function\s*\(/,
    /\bfetch\s*\(/,
    /\bXMLHttpRequest\b/,
    /\blocalStorage\b/,
    /\bsessionStorage\b/,
    /\bdocument\.cookie\b/
  ]) {
    if (pattern.test(source)) {
      fail(`${path} presentation adapter must not use ${pattern}`);
    }
  }
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

requireBalancedCss("css/mobile-ios-shell.css", mobileIosShellCss);
requireBalancedCss("css/motion-system.css", motionSystemCss);

for (const selector of [
  ".admin-shell",
  ".sidebar",
  ".topbar",
  ".xp-panel",
  ".table-wrap",
  ".file-picker:has(input:disabled)",
  "@media (max-width: 760px)",
  "--admin-touch-target: 44px",
  "@media (max-width: 920px)",
  ".map-vector",
  ".map-city-marker",
  ".map-marker-hit",
  "touch-action: none",
  "overscroll-behavior: contain",
  "pointer-events: all !important"
]) {
  if (!adminCss.includes(selector)) {
    fail(`admin/admin.css missing ${selector}`);
  }
}

if (/\.map-city-marker\s*\{[^}]*pointer-events:\s*none/s.test(adminCss)) {
  fail("admin SVG map markers must remain pointer-interactive");
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

if (!hasPattern(mainJs, /function\s+recentUpdateIconClass[\s\S]*item\?\.category\s*===\s*siteUpdateCategory\s*\|\|\s*item\?\.icon\s*===\s*["']system["'][\s\S]*update-icon-system/)) {
  fail("js/main.js should preserve the system bitmap for the consolidated update when the articles API falls back to local content");
}

if (!hasPattern(motionSystemCss, /\.welcome-title-icon\s*\{[\s\S]*width:\s*24px[\s\S]*height:\s*24px/)) {
  fail("css/motion-system.css should give the desktop welcome bitmap a visible intrinsic box");
}

if (!hasPattern(uiMotionJs, /function\s+animateAfterCommit\(result,\s*options\)[\s\S]*options\s*&&\s*options\.deferCleanup[\s\S]*animateAfterCommit\(committedResult,\s*\{\s*deferCleanup:\s*true[\s\S]*?\}\)[\s\S]*transition\.finished\.then[\s\S]*cleanup\(\)/)) {
  fail("js/ui-motion.js should retain View Transition state until the browser transition actually finishes");
}

if (!hasPattern(uiMotionJs, /transition\.ready\s*&&\s*typeof\s+transition\.ready\.then\s*===\s*["']function["'][\s\S]*transition\.ready\.then\(\s*function\s+viewTransitionReady\(\)\s*\{\s*\}\s*,\s*function\s+viewTransitionReadySkipped\(\)\s*\{\s*\}\s*\)/)) {
  fail("js/ui-motion.js should consume skipped View Transition ready rejections without leaking page errors");
}

if (!hasPattern(uiMotionJs, /function\s+enterAnimation[\s\S]*transformOrigin:\s*["']center center["'][\s\S]*function\s+exitAnimation[\s\S]*transformOrigin:\s*["']center center["']/)) {
  fail("js/ui-motion.js center-based window deltas should use an explicit center transform origin");
}

if (!hasPattern(uiMotionJs, /function\s+handlePointerDown[\s\S]*setData\(root,\s*["']inputMethod["'],\s*["']pointer["']\)[\s\S]*releasePressedTarget\(\)[\s\S]*function\s+handleKeyDown/)
  || !hasPattern(uiMotionJs, /addListener\(global,\s*["']blur["'][\s\S]*releasePressedTarget\(\)/)) {
  fail("js/ui-motion.js should release stale pressed state before a new press and whenever the window loses focus");
}

if (!hasPattern(motionSystemCss, /\.resource-empty-icon\.blog-empty-icon\s*\{[\s\S]*icon-window-blog-64\.png/)) {
  fail("css/motion-system.css should preserve the blog bitmap when the empty-state node also carries the shared resource class");
}

if (!indexHtml.includes('content="width=device-width, initial-scale=1.0, viewport-fit=cover"')) {
  fail("index.html viewport should opt into iOS safe-area coverage");
}

const welcomeQuickLinksHtml = findRequiredHtml(
  indexHtml,
  /<div class="quick-links">[\s\S]*?<\/div>/,
  "index.html missing welcome quick links block"
);

for (const token of [
  '<span class="title-icon welcome-title-icon" aria-hidden="true"></span><span id="welcome-title"',
  '<span class="pixel-icon monitor-icon" aria-hidden="true"></span>',
  '<span class="video-placeholder-asset" aria-hidden="true"></span>',
  '<span class="article-toc-icon asset-icon asset-icon-knowledge" aria-hidden="true"></span>',
  '<span class="article-copy-icon asset-icon asset-icon-link" aria-hidden="true"></span>'
]) {
  if (!indexHtml.includes(token)) {
    fail(`index.html missing bitmap-backed decorative asset token ${token}`);
  }
}
if (indexHtml.includes("<b>›</b>")) {
  fail("index.html decorative arrow markers must be aria-hidden");
}

const visibleEmojiPattern = /[\u2600-\u27bf]|\p{Extended_Pictographic}/u;
if (visibleEmojiPattern.test(visibleHtmlText(indexHtml))) {
  fail("index.html visible text must not use emoji or symbol artwork; use bitmap-backed asset classes");
}

const runtimeVisibleEmojiLines = mainJs.split(/\r?\n/).filter((line) => (
  /\b(?:textContent|innerText)\s*=|createTextNode\s*\(/.test(line)
  && visibleEmojiPattern.test(line)
));
if (runtimeVisibleEmojiLines.length) {
  fail("js/main.js runtime renderers must not write visible emoji or symbol artwork");
}
const mainWithoutLegacyIconMetadata = mainJs.replace(/^\s*icon\s*:\s*(["'`]).*?\1\s*,?\s*$/gmu, "");
if (visibleEmojiPattern.test(mainWithoutLegacyIconMetadata)) {
  fail("js/main.js must keep emoji out of runtime-visible copy; legacy non-rendered icon metadata is the only tolerated source");
}
if (/\b(?:textContent|innerText)\s*=\s*(?:item|update)\??\.icon\b/.test(mainJs)) {
  fail("js/main.js runtime renderers must map update types to bitmap-backed classes instead of rendering raw icon values");
}

for (const [marker, pattern, message] of [
  [
    "function recentUpdateElement",
    /icon\.className\s*=\s*`update-icon\s+\$\{recentUpdateIconClass\(item\)\}`[\s\S]*icon\.setAttribute\(\s*["']aria-hidden["']\s*,\s*["']true["']\s*\)/,
    "js/main.js recent updates should render a hidden bitmap-backed class instead of raw emoji"
  ],
  [
    "function closeVideo",
    /icon\.className\s*=\s*["']video-placeholder-asset["'][\s\S]*icon\.setAttribute\(\s*["']aria-hidden["']\s*,\s*["']true["']\s*\)/,
    "js/main.js closeVideo should restore the bitmap-backed video placeholder asset"
  ]
]) {
  requireFunctionPattern(mainJs, marker, pattern, message);
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
  if (!/<span\b[^>]*class="[^"]*\bquick-link-asset\b[^"]*"[^>]*aria-hidden="true"[^>]*><\/span>/.test(buttonHtml)) {
    fail("index.html welcome quick-link should use an aria-hidden bitmap-backed asset span");
  }
  if (/<b\b/.test(buttonHtml) && !/<b\b[^>]*aria-hidden="true"[^>]*>/.test(buttonHtml)) {
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

for (const [label, pattern] of [
  ["chat quick link", /\.quick-link-chat\s+\.quick-link-asset\s*\{[\s\S]*?background-image:\s*url\(["']\.\.\/assets\/images\/icon-chatroom-clean\.png["']\)/],
  ["games quick link", /\.quick-link-games\s+\.quick-link-asset[\s\S]*?\{[\s\S]*?background-image:\s*url\(["']\.\.\/assets\/images\/icon-games\.png["']\)/],
  ["knowledge quick link", /\.quick-link-knowledge\s+\.quick-link-asset\s*\{[\s\S]*?background-image:\s*url\(["']\.\.\/assets\/images\/icon-knowledge\.png["']\)/],
  ["video placeholder", /\.video-placeholder-asset\s*,\s*\.video-empty-icon\s*\{[\s\S]*?background-image:\s*url\(["']\.\.\/assets\/images\/icon-videos\.png["']\)/]
]) {
  if (!hasPattern(motionSystemCss, pattern)) {
    fail(`css/motion-system.css missing bitmap-backed ${label} asset mapping`);
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
  "/css/mobile-ios-shell.css",
  "/css/motion-system.css",
  "/css/transfer.css",
  "/js/mobile-shell.js",
  "/js/ui-motion.js",
  "/js/main.js",
  "/js/transfer.js",
  "/js/telemetry.js"
]) {
  if (!hasVersionedAssetReference(indexHtml, asset)) {
    fail(`index.html ${asset} reference is missing a cache-busting query`);
  }
}

const premiumUiVersion = "20260711-calm-motion-r13";
const mobileTransferUiVersion = "20260716-transfer-upload-window-r2";
const currentPreFinalMainVersion = "20260711-japanese-subtext-v102-r2";
const currentMainVersion = mobileTransferUiVersion;
const currentPreFinalCssVersion = "20260711-calm-motion-r13";
const currentPreFinalTelemetryVersion = "20260623-analytics-privacy-r1";
const currentGameShellVersion = "20260623-game-shell-storage-safe-r1";

for (const asset of [
  "/css/motion-system.css",
  "/js/mobile-shell.js",
  "/js/ui-motion.js"
]) {
  const versions = assetQueryVersions(indexHtml, asset);
  if (versions.length !== 1 || versions[0] !== premiumUiVersion) {
    fail(`index.html ${asset} query should appear once as ${premiumUiVersion}`);
  }
}

for (const asset of [
  "/css/mobile-ios-shell.css",
  "/css/transfer.css",
  "/js/transfer.js"
]) {
  const versions = assetQueryVersions(indexHtml, asset);
  if (versions.length !== 1 || versions[0] !== mobileTransferUiVersion) {
    fail(`index.html ${asset} query should appear once as ${mobileTransferUiVersion}`);
  }
}

const telemetryVersions = assetQueryVersions(indexHtml, "/js/telemetry.js");
if (telemetryVersions.length !== 1 || telemetryVersions[0] !== currentPreFinalTelemetryVersion) {
  fail(`index.html pre-final telemetry.js query should be ${currentPreFinalTelemetryVersion}`);
}

if (indexHtml.includes("mobile-status-glyphs") || mobileIosShellCss.includes("mobile-status-glyphs")) {
  fail("mobile UI should not show decorative battery, Wi-Fi, or signal glyphs that could be mistaken for real device status");
}

for (const theme of ["morning", "day", "dusk", "night"]) {
  const wallpaperPath = `../assets/images/mobile-wallpapers/${theme}.webp`;
  const versions = assetQueryVersions(mobileIosShellCss, wallpaperPath);
  if (!versions.length || versions.some((version) => version !== premiumUiVersion)) {
    fail(`css/mobile-ios-shell.css ${theme} wallpaper query should be ${premiumUiVersion}`);
  }
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
  'html[data-ui-shell="mobile"]',
  "env(safe-area-inset-top, 0px)",
  "env(safe-area-inset-bottom, 0px)",
  "--mobile-viewport-height",
  ".mobile-statusbar",
  ".mobile-appbar",
  ".mobile-home-indicator",
  ".account-popover",
  ".xp-taskbar",
  "@media (orientation: landscape) and (max-height: 520px)",
  "@media (prefers-reduced-motion: reduce)"
]) {
  if (!mobileIosShellCss.includes(token)) {
    fail(`css/mobile-ios-shell.css missing ${token}`);
  }
}

for (const token of [
  "--motion-standard",
  ".asset-icon",
  ".quick-link-asset",
  ".video-placeholder-asset",
  "background-image: url(\"../assets/images/icon-videos.png\")",
  "background-image: url(\"../assets/images/icon-knowledge.png\")",
  "background-image: url(\"../assets/images/icon-games.png\")",
  ".online-dot",
  "animation: none !important",
  "@media (prefers-reduced-motion: reduce)"
]) {
  if (!motionSystemCss.includes(token)) {
    fail(`css/motion-system.css missing ${token}`);
  }
}

for (const token of [
  'const MOBILE_QUERY = "(max-width: 760px), (max-height: 520px) and (pointer: coarse)"',
  "root.dataset.uiShell = nextShell",
  "window.visualViewport",
  'new CustomEvent("lusu:shellchange"',
  "window.requestAnimationFrame",
  "MutationObserver",
  "startHomeGesture",
  "finishHomeGesture",
  "window.LusuMobileShell = Object.freeze"
]) {
  if (!mobileShellJs.includes(token)) {
    fail(`js/mobile-shell.js missing ${token}`);
  }
}

for (const token of [
  "MAX_PARALLAX_PX = 0",
  "function run(kindValue, contextValue, commitValue)",
  "function commitOnce()",
  'createMediaQuery("(prefers-reduced-motion: reduce)")',
  'addListener(document, "visibilitychange", handleVisibilityChange)',
  'dispatchHook("lusu:ui-motion-before"',
  'dispatchHook("lusu:ui-motion-after"',
  "global.LusuUiMotion = api"
]) {
  if (!uiMotionJs.includes(token)) {
    fail(`js/ui-motion.js missing ${token}`);
  }
}

const onlineDotBlocks = [styleCss, mobileIosShellCss, motionSystemCss]
  .flatMap((source) => [...source.matchAll(/\.online-dot\s*\{([\s\S]*?)\}/g)].map((match) => match[1]));
if (!onlineDotBlocks.length) {
  fail("public CSS missing .online-dot styling");
}
if (onlineDotBlocks.some((block) => /animation\s*:[^;}]*(?:blink|infinite)/i.test(block))) {
  fail(".online-dot must remain steady and must not restore an infinite blink animation");
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
    /const\s+internalAction\s*=\s*item\.action\s*===\s*["']quick-transfer["'][\s\S]*status\.className\s*=\s*["']card-action resource-pending-action["'][\s\S]*status\.setAttribute\(\s*["']role["']\s*,\s*["']status["']\s*\)[\s\S]*button\.dataset\.quickTransferOpen\s*=\s*["']true["'][\s\S]*link\.setAttribute\(\s*["']aria-label["']\s*,\s*`\$\{text\}:\s*\$\{resourceTitle\}`\s*\)/,
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
    /tag\.title\s*=\s*title[\s\S]*tag\.setAttribute\(\s*["']aria-label["']\s*,\s*title\s*\)[\s\S]*tag\.textContent\s*=\s*title/,
    "js/main.js language support tags should expose unsupported status visibly and through an aria-label"
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
    /heading\.scrollIntoView\(\s*\{\s*block:\s*["']start["']\s*,\s*behavior:\s*motionScrollBehavior\(\)\s*\}\s*\)[\s\S]*heading\.focus\(\s*\{\s*preventScroll:\s*true\s*\}\s*\)/,
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
    /closeWelcome\(\s*\{\s*restoreFocus:\s*false\s*,\s*motion:\s*false\s*\}\s*\)/,
    "js/main.js showArticle should close the welcome dialog without restoring stale modal focus"
  ],
  [
    "function showArticleCategory",
    /closeWelcome\(\s*\{\s*restoreFocus:\s*false\s*,\s*motion:\s*false\s*\}\s*\)/,
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

if (!hasPattern(mainJs, /const\s+routeButton[\s\S]*if\s*\(routeButton\)\s*\{[\s\S]*const\s+motionKind\s*=\s*routeButton\.matches\(\s*["']\.minimize-button["']\s*\)[\s\S]*["']window-minimize["'][\s\S]*routeButton\.matches\(\s*["']\.close-button["']\s*\)[\s\S]*["']window-close["'][\s\S]*navigate\(\s*routeButton\.dataset\.route\s*,\s*\{\s*trigger:\s*routeButton\s*,\s*motionKind\s*\}\s*\)\s*;\s*closeWelcome\(\s*\{\s*restoreFocus:\s*false\s*,\s*motion:\s*false\s*\}\s*\)/)) {
  fail("js/main.js route click branch should classify minimize/close motion, pass its trigger, and close welcome without restoring stale modal focus");
}

if (!hasPattern(mainJs, /const\s+routeIconRectCache\s*=\s*new\s+Map[\s\S]*function\s+captureRouteIconRects[\s\S]*document\.body\.dataset\.route\s*!==\s*["']home["'][\s\S]*routeIconRectCache\.set/)
  || !hasPattern(mainJs, /function\s+cachedRouteIconRect[\s\S]*cached\.shell[\s\S]*cached\.viewportWidth\s*!==\s*window\.innerWidth[\s\S]*cached\.viewportHeight\s*!==\s*window\.innerHeight/)
  || !hasPattern(mainJs, /function\s+routeExitOriginRect[\s\S]*motionKind\s*===\s*["']window-minimize["'][\s\S]*cachedRouteIconRect\(route\)[\s\S]*taskbar-tabs button\[data-route\][\s\S]*\.start-button/)
  || !hasPattern(mainJs, /function\s+navigate[\s\S]*const\s+exitOriginRect\s*=\s*isExitMotion[\s\S]*focusReturnTarget\.focus\(\s*\{\s*preventScroll:\s*true\s*\}\s*\)[\s\S]*originRect:\s*exitOriginRect[\s\S]*deferCommit:\s*isExitMotion/)) {
  fail("js/main.js navigate should reverse close/minimize toward the route icon or task button and restore focus after committing");
}

if (!hasPattern(mainJs, /function\s+routeWindowFocusTarget[\s\S]*\.find\(\(element\)\s*=>\s*focusTargetIsVisible\(element\)\)[\s\S]*windowSurface\.tabIndex\s*=\s*-1[\s\S]*const\s+shouldFocusWindow[\s\S]*document\.documentElement\.dataset\.inputMethod\s*===\s*["']keyboard["'][\s\S]*!focusTargetIsVisible\(options\.trigger\)[\s\S]*routeWindowFocusTarget\(nextRoute\)[\s\S]*focusTarget\.focus\(\s*\{\s*preventScroll:\s*true\s*\}\s*\)/)) {
  fail("js/main.js route navigation should move focus into a window when its launch trigger becomes hidden or keyboard navigation requests it");
}

if (!hasPattern(mainJs, /const\s+mobileHomeReturnTarget[\s\S]*\.mobile-home-button[\s\S]*routeReturnTarget\(previousRoute,\s*["']window-close["']\)[\s\S]*const\s+focusReturnTarget\s*=\s*returnTarget\s*\|\|\s*mobileHomeReturnTarget[\s\S]*focusReturnTarget\.focus/)) {
  fail("js/main.js mobile App home navigation should restore focus to a visible Home-screen App icon");
}

if (!hasPattern(mainJs, /function\s+focusTargetIsVisible[\s\S]*element\.closest\(\s*["']\[hidden\]["']\s*\)[\s\S]*page\.classList\.contains\(\s*["']active["']\s*\)[\s\S]*const\s+hadInteractiveFocus[\s\S]*!hadInteractiveFocus\s*\|\|\s*focusTargetIsVisible\(activeElement\)[\s\S]*fallbackTarget\?\.focus/)) {
  fail("js/main.js navigation should recover focus from controls hidden by browser history or route projection");
}

if (!hasPattern(mainJs, /function\s+showArticle\(slug,\s*options\s*=\s*\{\}\)[\s\S]*trigger:\s*options\.trigger[\s\S]*focusWindow:\s*true[\s\S]*function\s+showArticleList\(options\s*=\s*\{\}\)[\s\S]*trigger:\s*options\.trigger[\s\S]*focusWindow:\s*true/)
  || !hasPattern(mainJs, /showArticle\(articleButton\.dataset\.articleSlug,\s*\{\s*trigger:\s*articleButton\s*\}\)[\s\S]*showArticleList\(\{\s*trigger:\s*articleBackButton\s*\}\)/)) {
  fail("js/main.js article detail and back controls should carry focus into the newly revealed surface");
}

if (!hasPattern(mainJs, /function\s+motionScrollBehavior[\s\S]*managedMode\s*===\s*["']reduced["']\s*\|\|\s*managedMode\s*===\s*["']off["'][\s\S]*return\s+["']auto["'][\s\S]*prefers-reduced-motion:\s*reduce/)
  || !hasPattern(mainJs, /scrollIntoView\(\s*\{\s*block:\s*["']start["']\s*,\s*behavior:\s*motionScrollBehavior\(\)\s*\}\s*\)/)
  || !hasPattern(mainJs, /detail\.scrollTo\(\s*\{\s*top:\s*0\s*,\s*behavior:\s*motionScrollBehavior\(\)\s*\}\s*\)/)) {
  fail("js/main.js article scrolling should honor reduced and off motion modes");
}

if (!hasPattern(motionSystemCss, /html\[data-ui-shell="desktop"\]\s+\.desktop-icon\.is-active[\s\S]*\.desktop-icon\[aria-pressed="true"\][\s\S]*border-color:[\s\S]*box-shadow:/)) {
  fail("css/motion-system.css should provide a visible non-color-only desktop icon selected state");
}

if (!hasPattern(mainJs, /const\s+keepsDesktopChromeLive\s*=\s*isDesktopShell[\s\S]*motionKind\s*===\s*["']app-open["'][\s\S]*motionKind\s*===\s*["']route["']\s*&&\s*nextRoute\s*===\s*["']home["']/)
  || !hasPattern(mainJs, /useViewTransition:\s*\[["']route["'],\s*["']app-open["'],\s*["']mobile-tab["']\]\.includes\(motionKind\)[\s\S]*&&\s*!keepsDesktopChromeLive/)
  || !hasPattern(uiMotionJs, /function\s+resolveMotionTarget[\s\S]*kind\s*===\s*["']route["'][\s\S]*kind\s*===\s*["']app-open["'][\s\S]*shellMode\(\)\s*===\s*["']desktop["'][\s\S]*currentRoute\(\)\s*===\s*["']home["'][\s\S]*\.desktop-icons[\s\S]*\.page\.active\s*>\s*\.xp-window/)
  || !hasPattern(uiMotionJs, /function\s+appOpenEnterAnimation[\s\S]*opacity:\s*0\.84[\s\S]*translate3d\(0,3px,0\)[\s\S]*duration:\s*DURATIONS\.standard/)) {
  fail("desktop App launch and Home return must animate live window/icon surfaces without a full-page snapshot covering fixed chrome");
}

for (const [asset, expectedVersion] of [
  ["/css/style.css", currentPreFinalCssVersion],
  ["/js/main.js", currentMainVersion]
]) {
  const versions = assetQueryVersions(indexHtml, asset);
  if (versions.length !== 1 || versions[0] !== expectedVersion) {
    fail(`index.html ${asset} query should appear once as ${expectedVersion}`);
  }
}

if (/\brotateY\s*\(|\bperspective\s*:|@keyframes\s+[\w-]*page-turn|data-ui-page-turn|--ui-app-open-(?:x|y|scale)|app-open-origin/i.test(motionSystemCss)
  || /PAGE_TURN_ROUTES|pageTurnDirection|uiPageTurn|writeAppOpenOrigin|clearAppOpenOrigin|--ui-app-open-(?:x|y|scale)/.test(uiMotionJs)) {
  fail("the calm motion system must not restore 3D page turns, icon-origin scaling, or their legacy state and keyframes");
}

if (!hasPattern(uiMotionJs, /ROUTE_ORDER[\s\S]*function\s+routeDirection/)
  || !hasPattern(uiMotionJs, /setData\(root,\s*["']uiDirection["']/)
  || !hasPattern(uiMotionJs, /removeData\(root,\s*["']uiDirection["']\)/)
  || !hasPattern(motionSystemCss, /html\[data-ui-transition="route"\]\s+\.page\.active\s*\{[\s\S]*view-transition-name:\s*module-page/)
  || !hasPattern(motionSystemCss, /::view-transition-old\(root\),\s*::view-transition-new\(root\)\s*\{[\s\S]*animation:\s*none/)
  || !hasPattern(motionSystemCss, /data-ui-transition="route"[\s\S]*::view-transition-old\(module-page\)\s*\{[\s\S]*opacity:\s*0[\s\S]*animation:\s*none/)
  || !hasPattern(motionSystemCss, /data-ui-transition="route"[\s\S]*::view-transition-new\(module-page\)[\s\S]*neo-xp-route-in/)) {
  fail("desktop taskbar route changes should reveal one calm active page without a second border snapshot while unchanged chrome remains stable");
}

if (!hasPattern(mainJs, /routeButton\.matches\(\s*["']\.desktop-icon["']\s*\)[\s\S]*["']app-open["']/)
  || !hasPattern(mainJs, /dataset\.uiShell\s*===\s*["']mobile["'][\s\S]*\.taskbar-tabs button, \.start-button, \.mobile-home-button[\s\S]*["']mobile-tab["']/)
  || !hasPattern(motionSystemCss, /data-ui-transition="app-open"[\s\S]*view-transition-name:\s*app-screen/)
  || !hasPattern(motionSystemCss, /data-ui-transition="app-open"[\s\S]*::view-transition-new\(app-screen\)[\s\S]*neo-xp-app-open-calm/)
  || !hasPattern(motionSystemCss, /data-ui-transition="mobile-tab"[\s\S]*view-transition-name:\s*mobile-tab-page/)
  || !hasPattern(motionSystemCss, /data-ui-transition="mobile-tab"[\s\S]*::view-transition-old\(mobile-tab-page\)[\s\S]*neo-xp-mobile-slide-out/)
  || !hasPattern(motionSystemCss, /data-ui-transition="mobile-tab"[\s\S]*::view-transition-new\(mobile-tab-page\)[\s\S]*neo-xp-mobile-slide-in/)
  || !hasPattern(motionSystemCss, /data-ui-transition="mobile-tab"\]\[data-ui-direction="backward"\]/)
  || /\.desktop-icon\.is-opening/.test(motionSystemCss)) {
  fail("Home Apps should open calmly while mobile Dock routes use a directional, lightweight slide without page turns");
}

if (/<div\b[^>]*class="desktop-intro"/.test(indexHtml)
  || /data-i18n=["']homeLead["']/.test(indexHtml)
  || /homeLead\s*:/.test(mainJs)) {
  fail("Home should not render the removed three-language headline, construction note, or divider block");
}

if (!hasPattern(mobileIosShellCss, /html\[data-ui-shell="mobile"\]\s+\.desktop-icons\s*\{[\s\S]*grid-auto-rows:\s*90px[\s\S]*justify-items:\s*center/)
  || !hasPattern(mobileIosShellCss, /html\[data-ui-shell="mobile"\]\s+\.desktop-icon\s*\{[\s\S]*width:\s*min\(78px,\s*100%\)[\s\S]*height:\s*90px/)
  || !hasPattern(mobileIosShellCss, /\.page:not\(\.page-home\)\s*>\s*\.xp-window\s*\{[\s\S]*--mobile-frame-edge|\.page:not\(\.page-home\)\s*>\s*\.xp-window\s*\{[\s\S]*border:\s*2px\s+solid\s+var\(--mobile-frame-edge\)/)
  || !hasPattern(mobileIosShellCss, /#videos\s+\.card-grid,[\s\S]*#about\s+\.profile-card\s*\{[\s\S]*border:\s*1px\s+solid\s+var\(--mobile-frame-edge\)/)) {
  fail("mobile Home hit areas and all App surfaces should keep the compact grid and layered frame system");
}

if (!hasPattern(mainJs, /function\s+updateWallpaperMotionState[\s\S]*document\.documentElement\.dataset\.motion[\s\S]*\[\s*["']full["']\s*,\s*["']reduced["']\s*,\s*["']off["']\s*\]\.includes\(managedMode\)/)
  || !hasPattern(mainJs, /LusuUiMotion\.run\(\s*["']theme["']\s*,\s*\{\s*theme\s*,\s*useViewTransition:\s*true\s*\}/)) {
  fail("js/main.js wallpaper should share the canonical motion mode and use progressive theme crossfades");
}

if (!hasPattern(mobileShellJs, /function\s+cycleLanguage[\s\S]*CustomEvent\(\s*["']lusu:language-request["'][\s\S]*detail:\s*\{\s*lang:\s*nextLang\s*\}[\s\S]*\}\s*\)/)
  || hasPattern(mobileShellJs, /function\s+cycleLanguage[\s\S]{0,500}\.click\(\)/)
  || !hasPattern(mainJs, /addEventListener\(\s*["']lusu:language-request["'][\s\S]*\[\s*["']zh["']\s*,\s*["']en["']\s*,\s*["']ja["']\s*\]\.includes\(lang\)[\s\S]*setLanguage\(lang,\s*\{\s*persist:\s*true,\s*syncUrl:\s*true\s*\}\)/)) {
  fail("mobile language cycle should request one shared language change without synthesizing a second tracked click");
}

if (!hasPattern(motionSystemCss, /html\[data-motion="reduced"\]\s+\.page[\s\S]*html\[data-motion="off"\]\s+\.desktop-icon[\s\S]*animation:\s*none\s*!important/)) {
  fail("css/motion-system.css should disable legacy page/icon animations in reduced and off modes");
}

if (!hasPattern(motionSystemCss, /html\[data-ui-shell="mobile"\]\[data-motion="reduced"\]\s+\.wallpaper-stage[\s\S]*html\[data-ui-shell="mobile"\]\[data-motion="off"\]\s+\.wallpaper-stage[\s\S]*transform:\s*none\s*!important/)) {
  fail("css/motion-system.css should keep the mobile wallpaper stage in its mobile coordinate system when motion is reduced or off");
}

if (hasPattern(mobileIosShellCss, /@media\s*\(orientation:\s*landscape\)\s*and\s*\(max-height:\s*520px\)[\s\S]*?\.chatroom-header\s*\{\s*display:\s*none/)
  || hasPattern(mobileIosShellCss, /@media\s*\(orientation:\s*landscape\)\s*and\s*\(max-height:\s*520px\)[\s\S]*?\.chatroom-footer\s*\{\s*display:\s*none/)
  || !hasPattern(mobileIosShellCss, /html\[data-ui-shell="mobile"\]\s+\.chatroom-window\.is-private-room\s+\.send-bubble-icon[\s\S]*pixel-ui-glyph-atlas\.png\?v=20260711-calm-motion-r13/)) {
  fail("css/mobile-ios-shell.css should preserve landscape chat room controls, feedback, and the private-room send bitmap");
}

if (!hasPattern(styleCss, /\.minimize-button::before,\s*\.maximize-button::before\s*\{[\s\S]*pixel-ui-glyph-atlas\.png\?v=20260711-calm-motion-r13[\s\S]*background-size:\s*200%\s+200%/)
  || !hasPattern(styleCss, /\.minimize-button::before\s*\{\s*background-position:\s*0\s+0[\s\S]*\.maximize-button::before\s*\{\s*background-position:\s*100%\s+0[\s\S]*\.maximize-button\[aria-pressed="true"\]::before\s*\{\s*background-position:\s*0\s+100%/)
  || !hasPattern(styleCss, /\.send-bubble-icon\s*\{[\s\S]*pixel-ui-glyph-atlas\.png\?v=20260711-calm-motion-r13[\s\S]*background-position:\s*100%\s+100%/)
  || hasPattern(styleCss, /\.send-bubble-icon::(?:before|after)\s*\{[\s\S]{0,320}(?:clip-path|border|box-shadow|background\s*:)/)) {
  fail("public window and chat glyphs should use the image2 bitmap atlas instead of CSS-drawn geometry");
}

if (!hasPattern(mobileIosShellCss, /@media\s*\(orientation:\s*landscape\)\s*and\s*\(max-height:\s*520px\)[\s\S]*\.chatroom-window\s*\{[\s\S]*grid-template-columns:\s*minmax\(220px,\s*0\.56fr\)\s+minmax\(0,\s*1\.44fr\)[\s\S]*grid-template-rows:\s*auto\s+minmax\(0,\s*1fr\)\s+52px[\s\S]*\.chatroom-header\s*\{[\s\S]*grid-row:\s*1\s*\/\s*3[\s\S]*\.chat-private-room-panel\s*\{[\s\S]*grid-row:\s*1[\s\S]*grid-column:\s*2[\s\S]*\.chatroom-log\s*\{[\s\S]*grid-row:\s*2[\s\S]*grid-column:\s*2[\s\S]*\.chatroom-compose\s*\{[\s\S]*grid-row:\s*3[\s\S]*grid-column:\s*2[\s\S]*\.chatroom-footer\s*\{[\s\S]*grid-row:\s*3[\s\S]*grid-column:\s*1/)) {
  fail("css/mobile-ios-shell.css should use the available landscape width so chat and private-room controls remain simultaneously reachable");
}

if (!hasPattern(mobileIosShellCss, /@media\s*\(max-width:\s*380px\)[\s\S]*\.chat-private-room-panel[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto\s+auto[\s\S]*\.chat-private-room-panel small\s*\{\s*display:\s*none/)
  || !hasPattern(mobileIosShellCss, /@media\s*\(max-width:\s*760px\)\s*and\s*\(max-height:\s*720px\)\s*and\s*\(orientation:\s*portrait\)[\s\S]*\.chatroom-compose textarea[\s\S]*height:\s*44px[\s\S]*\.chatroom-footer[\s\S]*min-height:\s*44px/)
  || !hasPattern(mobileIosShellCss, /html\[data-ui-shell="mobile"\]\s+\.chatroom-window\s*\{\s*display:\s*grid;\s*grid-template-rows:\s*auto\s+auto\s+minmax\(0,\s*1fr\)\s+auto\s+auto/)
  || !hasPattern(mobileIosShellCss, /html\[data-ui-shell="mobile"\]\s+\.chatroom-compose\s*\{[\s\S]*grid-row:\s*4[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto\s+auto/)
  || !hasPattern(mobileIosShellCss, /html\[data-ui-shell="mobile"\]\s+\.chatroom-counter\s*\{[\s\S]*position:\s*static[\s\S]*grid-column:\s*2[\s\S]*min-width:\s*44px/)
  || !hasPattern(mobileIosShellCss, /html\[data-ui-shell="mobile"\]\s+\.chat-send-button\s*\{[\s\S]*grid-column:\s*3[\s\S]*min-height:\s*44px/)
  || !hasPattern(mobileIosShellCss, /html\[data-ui-shell="mobile"\]\s+\.chatroom-autoscroll\s*\{[\s\S]*min-height:\s*44px/)) {
  fail("css/mobile-ios-shell.css should keep password and chat controls reachable on narrow and soft-keyboard portrait viewports");
}

const dockIndicatorReferences = mobileShellJs.match(/\bsyncDockIndicator\s*\(/g) || [];

if (!hasPattern(mobileIosShellCss, /html\[data-ui-shell="mobile"\]\s+\.mobile-dock-scroll\s*\{[\s\S]*overflow-x:\s*auto[\s\S]*touch-action:\s*pan-x/)
  || !hasPattern(mobileIosShellCss, /body\[data-mobile-dock="collapsed"\]\s+\.xp-taskbar\s*\{[\s\S]*transform:\s*translate3d/)
  || !hasPattern(mobileShellJs, /function\s+toggleDock[\s\S]*dockCollapsed[\s\S]*syncDockState/)
  || !hasPattern(mobileShellJs, /function\s+revealActiveDockItem[\s\S]*isClipped[\s\S]*scrollIntoView[\s\S]*behavior:/)
  || !hasPattern(indexHtml, /class=["'][^"']*\bmobile-dock-selection\b[^"']*["'][^>]*aria-hidden=["']true["']/)
  || !hasPattern(mobileIosShellCss, /\.mobile-dock-selection\s*\{[\s\S]*width:\s*var\(--mobile-dock-selection-width/)
  || !hasPattern(mobileIosShellCss, /\.mobile-dock-selection\s*\{[\s\S]*transform:\s*translate3d\(var\(--mobile-dock-selection-x/)
  || !hasPattern(mobileShellJs, /function\s+syncDockIndicator[\s\S]*setProperty\(\s*["']--mobile-dock-selection-x["']/)
  || !hasPattern(mobileShellJs, /function\s+syncDockIndicator[\s\S]*setProperty\(\s*["']--mobile-dock-selection-width["']/)
  || !hasPattern(indexHtml, /data-route="blog"\s+data-mobile-dock-excluded/)
  || !hasPattern(indexHtml, /data-route="about"\s+data-mobile-dock-excluded/)
  || !hasPattern(mobileIosShellCss, /taskbar-tabs\s+button\[data-mobile-dock-excluded\]\s*\{\s*display:\s*none/)
  || !hasPattern(mobileIosShellCss, /@media\s*\(min-width:\s*375px\)[\s\S]*mobile-dock-scroll\s*\{\s*justify-content:\s*center/)
  || !hasPattern(mobileShellJs, /dockRouteElements[\s\S]*:not\(\[data-mobile-dock-excluded\]\)[\s\S]*has-no-dock-route/)
  || dockIndicatorReferences.length < 2
  || !hasPattern(indexHtml, /data-mobile-dock-toggle[\s\S]*aria-expanded="true"/)
  || !hasPattern(mobileIosShellCss, /body:not\(\[data-route="home"\]\)\s+\.page\.active\s*>\s*\.xp-window\s*>\s*\.window-titlebar\s*\{\s*display:\s*none/)) {
  fail("mobile Apps should retain one App bar and a six-item, balanced, collapsible frosted Dock with a truthful sliding indicator");
}

if (!hasPattern(mobileIosShellCss, /body:not\(\[data-route="home"\]\)\s+\.mobile-route-copy strong\s*\{\s*max-width:\s*min\(58vw,\s*520px\)/)
  || !hasPattern(mobileIosShellCss, /\.mobile-route-copy\s*\{[\s\S]*margin-left:\s*auto[\s\S]*text-align:\s*right/)
  || !hasPattern(mobileIosShellCss, /body:not\(\[data-route="home"\]\)\s+\.topbar-actions\s*\{\s*display:\s*none/)) {
  fail("css/mobile-ios-shell.css should leave enough App-bar width for readable translated route titles");
}

if (!hasPattern(mobileIosShellCss, /\.knowledge-searchbar\s+label\s*\{[\s\S]*position:\s*absolute[\s\S]*clip:\s*rect\(0\s+0\s+0\s+0\)/)
  || !hasPattern(mobileIosShellCss, /#knowledge-search-status:empty\s*\{\s*display:\s*none/)
  || !hasPattern(mobileIosShellCss, /\.knowledge-searchbar\.has-search-status\s*\{[\s\S]*grid-template-rows:\s*44px\s+14px[\s\S]*height:\s*70px/)
  || !hasPattern(mainJs, /function\s+renderKnowledgeSearchControls[\s\S]*classList\.toggle\(\s*["']has-search-status["'][\s\S]*if\s*\(!articleState\.searchTerm\.trim\(\)\)[\s\S]*setSearchStatus\(\s*["']["']\s*\)/)
  || !hasPattern(mobileIosShellCss, /\.notepad-menu\s*\{\s*display:\s*none/)
  || !hasPattern(mobileIosShellCss, /html\[data-ui-shell="mobile"\]\s+\.game-list\s*\{\s*max-height:\s*none/)) {
  fail("css/mobile-ios-shell.css should remove decorative mobile rows that reduce readable App content");
}

if (!hasPattern(mobileIosShellCss, /html\[data-ui-shell="mobile"\]\s+\.game-card\s*\{[\s\S]*grid-template-columns:\s*52px\s+minmax\(0,\s*1fr\)\s+minmax\(70px,\s*82px\)/)
  || !hasPattern(mobileIosShellCss, /html\[data-ui-shell="mobile"\]\s+\.game-card\s+\.card-action\s*\{[\s\S]*grid-column:\s*3[\s\S]*grid-row:\s*1[\s\S]*min-height:\s*44px/)
  || !hasPattern(mobileIosShellCss, /#blog\s+\.blog-empty-state,[\s\S]*#blog\s+\.list-message[\s\S]*grid-column:\s*1\s*\/\s*-1/)) {
  fail("css/mobile-ios-shell.css should keep mobile card actions inside their cards and span landscape empty states");
}

if (!hasPattern(mobileIosShellCss, /@media\s*\(orientation:\s*landscape\)\s*and\s*\(max-height:\s*520px\)[\s\S]*\.chat-private-room-panel\s*\{[\s\S]*grid-template-columns:\s*minmax\(120px,\s*1fr\)\s+auto\s+auto[\s\S]*gap:\s*8px/)) {
  fail("css/mobile-ios-shell.css should keep the visually hidden private-room label out of the landscape control columns");
}

if (!hasPattern(mobileIosShellCss, /html\[data-ui-shell="mobile"\]\s+#about\s+\.profile-card\s*\{\s*overflow:\s*auto/)
  || !hasPattern(mobileIosShellCss, /html\[data-ui-shell="mobile"\]\s+\.profile-avatar\s*\{[\s\S]*height:\s*clamp\(160px,\s*26dvh,\s*180px\)[\s\S]*min-height:\s*0/)
  || !hasPattern(mobileIosShellCss, /#about\s+\.profile-card\s*\{[\s\S]*align-content:\s*safe\s+center[\s\S]*height:\s*100%/)
  || !hasPattern(mobileIosShellCss, /#about\s+\.profile-avatar\s*\{\s*height:\s*172px[\s\S]*min-height:\s*0/)
  || !hasPattern(mobileIosShellCss, /@media\s*\(orientation:\s*landscape\)\s*and\s*\(max-height:\s*520px\)[\s\S]*\.folder-layout\.is-reading\s+\.article-detail\s*\{[\s\S]*padding:\s*8px\s+8px\s+calc\(var\(--mobile-dock-space\)\s*\+\s*44px\)/)) {
  fail("css/mobile-ios-shell.css should keep translated About content scrollable and reserve landscape article space above fixed reading controls");
}

if (!hasPattern(mobileIosShellCss, /html\[data-ui-shell="mobile"\]\s+#article-detail-meta\s*\{[\s\S]*flex-wrap:\s*nowrap[\s\S]*min-height:\s*36px[\s\S]*overflow-x:\s*auto/)
  || !hasPattern(mobileIosShellCss, /html\[data-ui-shell="mobile"\]\s+\.article-detail-head\s*>\s*p\s*\{[\s\S]*-webkit-line-clamp:\s*2/)
  || !hasPattern(mobileIosShellCss, /@media\s*\(max-width:\s*760px\)\s*and\s*\(max-height:\s*720px\)\s*and\s*\(orientation:\s*portrait\)[\s\S]*\.folder-layout\.is-reading\s+#article-detail-meta\s*\{[\s\S]*min-height:\s*32px[\s\S]*\.folder-layout\.is-reading\s+\.article-detail-head\s*>\s*p\s*\{[\s\S]*-webkit-line-clamp:\s*1/)
  || !hasPattern(mobileIosShellCss, /@media\s*\(orientation:\s*landscape\)\s*and\s*\(max-height:\s*520px\)[\s\S]*\.folder-layout\.is-reading\s+\.article-detail-head\s*>\s*p\s*\{\s*-webkit-line-clamp:\s*1/)) {
  fail("css/mobile-ios-shell.css should compact mobile article metadata and summaries so the first body paragraph remains readable");
}

if (!hasPattern(mobileIosShellCss, /html\[data-ui-shell="mobile"\]\s+#knowledge\.page\s*>\s*\.xp-window[\s\S]*html\[data-ui-shell="mobile"\]\s+#about\.page\s*>\s*\.xp-window[\s\S]*height:\s*100%[\s\S]*max-height:\s*none/)) {
  fail("css/mobile-ios-shell.css should override legacy ID sizing so every mobile App is a full-screen surface");
}

if (!hasPattern(mobileIosShellCss, /body\.is-article-reading\s+#knowledge\.page\s*>\s*\.xp-window[\s\S]*border-radius:\s*22px\s+22px\s+0\s+0[\s\S]*body\.is-article-reading\s+#knowledge\.page\s+\.close-button[\s\S]*min-width:\s*44px[\s\S]*min-height:\s*44px/)) {
  fail("css/mobile-ios-shell.css should preserve full-App article chrome and 44px window controls");
}

if (!hasPattern(mobileIosShellCss, /html\[data-ui-shell="mobile"\]\s+\[data-article-window-toggle\]\s*\{\s*display:\s*none/)) {
  fail("css/mobile-ios-shell.css should hide the no-op article maximize control inside always-full-screen mobile Apps");
}

if (!hasPattern(mobileIosShellCss, /body\.is-article-reading\s+\.article-read-progress\s*\{[\s\S]*top:\s*calc\(var\(--mobile-safe-top\)\s*\+\s*var\(--mobile-status-height\)\s*\+\s*8px\)[\s\S]*bottom:\s*auto[\s\S]*z-index:\s*95[\s\S]*height:\s*32px/)
  || !hasPattern(mobileIosShellCss, /body\.is-article-reading\s+\.article-top-link\s*\{[\s\S]*top:\s*calc\(var\(--mobile-safe-top\)\s*\+\s*var\(--mobile-status-height\)\s*\+\s*2px\)[\s\S]*bottom:\s*auto[\s\S]*width:\s*44px/)
  || !hasPattern(mobileIosShellCss, /body\.is-article-reading\s+\.xp-topbar\s*\{\s*pointer-events:\s*none[\s\S]*body\.is-article-reading\s+\.xp-topbar\s+:is\(button,\s*a,\s*input,\s*select,\s*textarea,\s*\.account-popover\)\s*\{\s*pointer-events:\s*auto/)
  || !hasPattern(mobileIosShellCss, /@media\s*\(orientation:\s*landscape\)\s*and\s*\(max-height:\s*520px\)[\s\S]*body\.is-article-reading\s+\.article-top-link\s*\{[\s\S]*right:\s*104px[\s\S]*bottom:\s*auto/)) {
  fail("css/mobile-ios-shell.css should place tappable mobile article controls in the App bar without covering copy controls or body text");
}

if (!hasPattern(mobileIosShellCss, /html\[data-ui-shell="mobile"\]\s+#video-window-maximize\s*\{\s*display:\s*none/)) {
  fail("css/mobile-ios-shell.css should hide the no-op video maximize control inside always-full-screen mobile modals");
}

if (!hasPattern(mainJs, /let\s+navigationRequestId\s*=\s*0[\s\S]*function\s+navigate[\s\S]*const\s+requestId\s*=\s*\+\+navigationRequestId[\s\S]*navigationCommitted\s*\|\|\s*requestId\s*!==\s*navigationRequestId/)) {
  fail("js/main.js navigate should reject stale deferred commits so rapid route changes remain last-action-wins");
}

if (!hasPattern(mainJs, /function\s+toggleArticleWindowSize[\s\S]*runWindowLayoutTransition\(\s*nextRestored\s*\?\s*["']window-restore["']\s*:\s*["']window-maximize["'][\s\S]*function\s+fullscreenVideo[\s\S]*runWindowLayoutTransition\(\s*nextMaximized\s*\?\s*["']window-maximize["']\s*:\s*["']window-restore["']/)) {
  fail("js/main.js article and video window controls should use coherent maximize/restore layout transitions");
}

if (!hasPattern(mainJs, /windowRestoreAria:\s*["']还原窗口["'][\s\S]*windowRestoreAria:\s*["']Restore window["'][\s\S]*windowRestoreAria:\s*["']ウィンドウを元に戻す["']/)
  || !hasPattern(mainJs, /function\s+renderKnowledge[\s\S]*classList\.add\(\s*["']is-article-reading["']\s*\)[\s\S]*updateArticleWindowButton\(\)[\s\S]*classList\.remove\(\s*["']is-article-window-restored["']\s*\)[\s\S]*updateArticleWindowButton\(\)/)
  || !hasPattern(mainJs, /function\s+updateArticleWindowButton[\s\S]*const\s+reading[\s\S]*restored\s*\?\s*["']windowMaximizeAria["']\s*:\s*["']windowRestoreAria["'][\s\S]*button\.hidden\s*=\s*!reading[\s\S]*aria-pressed[\s\S]*aria-label[\s\S]*title[\s\S]*function\s+toggleArticleWindowSize[\s\S]*updateArticleWindowButton\(\)/)) {
  fail("js/main.js article maximize/restore control should expose its current action in all three languages");
}

if (!hasPattern(motionSystemCss, /\.page\s*\{\s*animation:\s*none/)) {
  fail("css/motion-system.css should disable the legacy page popIn so routes have one authoritative transition system");
}

if (!hasPattern(mainJs, /function\s+runSurfaceClose[\s\S]*LusuUiMotion\.run\(\s*["']modal-close["'][\s\S]*deferCommit:\s*true[\s\S]*function\s+closeVideo[\s\S]*runSurfaceClose\(modal[\s\S]*function\s+closeWelcome[\s\S]*runSurfaceClose\(modal/)) {
  fail("js/main.js video and welcome dialogs should use a deferred reverse close animation with an immediate reduced-motion fallback");
}

if (!hasPattern(mainJs, /function\s+closeAccountPopover\(options\s*=\s*\{\}\)[\s\S]*runSurfaceClose\(popover[\s\S]*toggle\.focus\(\s*\{\s*preventScroll:\s*true\s*\}\s*\)/)
  || !hasPattern(mainJs, /function\s+hideChatPrivateRoomForm\(options\s*=\s*\{\}\)[\s\S]*chat-room-toggle["']\)\?\.focus\(\s*\{\s*preventScroll:\s*true\s*\}\s*\)/)) {
  fail("js/main.js account and private-room surfaces should restore focus when they close");
}

if (!hasPattern(mainJs, /if\s*\(\s*!target\.closest\(\s*["']#account-widget["']\s*\)\s*\)[\s\S]*closeAccountPopover\(\s*\{\s*restoreFocus:\s*Boolean\(popover\?\.contains\(document\.activeElement\)\)/)) {
  fail("js/main.js outside-click account closure should only restore focus when focus would otherwise remain inside the hidden popover");
}

if (!hasPattern(mainJs, /if\s*\(videoModal\s*&&\s*!videoModal\.hidden\)\s*\{[\s\S]*closeVideo\(\)[\s\S]*return;[\s\S]*if\s*\(welcomeModal\s*&&\s*!welcomeModal\.hidden\)\s*\{[\s\S]*closeWelcome\(\)[\s\S]*return;/)) {
  fail("js/main.js Escape handling should only close open dialogs before falling back to the account popover");
}

if (!hasPattern(mainJs, /window\.addEventListener\(\s*["']keydown["']\s*,\s*\(event\)\s*=>\s*\{[\s\S]*if\s*\(\s*trapDialogFocus\(event\)\s*\)\s*\{[\s\S]*return;[\s\S]*if\s*\(\s*event\.key\s*===\s*["']Escape["']\s*\)/)) {
  fail("js/main.js keydown handler should trap dialog focus before Escape fallback handling");
}

const resourceActionBody = objectBlockAfterMarker(mainJs, "function resourceActionElement");
if (/aria-disabled|button\.disabled\s*=/.test(resourceActionBody)) {
  fail("js/main.js resource pending action should be non-interactive status text, not a disabled button");
}

if (!hasPattern(
  objectBlockAfterMarker(mainJs, "function resourceCardElement"),
  /const\s+metaItems\s*=\s*\[[\s\S]*label\("type"\)[\s\S]*if\s*\(\s*resourceAvailable\s*\)\s*\{[\s\S]*metaItems\.push\([\s\S]*label\("version"\)[\s\S]*label\("size"\)[\s\S]*label\("updated"\)[\s\S]*metaItems\.forEach/
)) {
  fail("js/main.js resource cards should hide version/size/updated metadata until a real resource URL exists");
}

if (!hasPattern(mainJs, /function\s+readyResourceItems\(\)\s*\{[\s\S]*content\.resources\.filter\(\(item\)\s*=>\s*safeResourceUrl\(item\)\s*\|\|\s*item\.action\s*===\s*["']quick-transfer["']\)/)) {
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

for (const functionName of ["openAccountPopover", "closeAccountPopover"]) {
  const functionBody = objectBlockAfterMarker(mainJs, `function ${functionName}`);
  if (!functionBody.includes("syncAccountPopoverState(popover)")) {
    fail(`js/main.js ${functionName} should sync account aria-expanded state`);
  }
}

const toggleAccountPopoverBody = objectBlockAfterMarker(mainJs, "function toggleAccountPopover");
if (!hasPattern(toggleAccountPopoverBody, /if\s*\(popover\.hidden\)[\s\S]*openAccountPopover\(\)[\s\S]*else[\s\S]*closeAccountPopover\(\)/)) {
  fail("js/main.js toggleAccountPopover should delegate to the shared accessible open/close paths");
}

for (const [label, pattern] of [
  ["resource empty asset", /icon\.className\s*=\s*["']resource-empty-icon["'][\s\S]{0,120}icon\.setAttribute\(\s*["']aria-hidden["']\s*,\s*["']true["']\s*\)/],
  ["recent updates empty asset", /icon\.className\s*=\s*["']update-icon update-icon-knowledge["'][\s\S]{0,120}icon\.setAttribute\(\s*["']aria-hidden["']\s*,\s*["']true["']\s*\)/],
  ["video status asset", /icon\.className\s*=\s*`video-empty-icon\$\{kind\s*===\s*["']failed["']\s*\?\s*["'] is-error["']\s*:\s*["']["']\}`[\s\S]{0,160}icon\.setAttribute\(\s*["']aria-hidden["']\s*,\s*["']true["']\s*\)/],
  ["video empty asset", /icon\.className\s*=\s*["']video-empty-icon["'][\s\S]{0,120}icon\.setAttribute\(\s*["']aria-hidden["']\s*,\s*["']true["']\s*\)/],
  ["game empty asset", /icon\.className\s*=\s*["']game-empty-icon["'][\s\S]{0,120}icon\.setAttribute\(\s*["']aria-hidden["']\s*,\s*["']true["']\s*\)/]
]) {
  if (!hasPattern(mainJs, pattern)) {
    fail(`js/main.js missing bitmap-backed dynamic asset accessibility guard for ${label}`);
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

const finalUpdateId = "seed-update-2026-07-16-mobile-transfer-ui-polish";
const finalUpdateSlug = "2026-07-16-mobile-transfer-ui-polish";
const finalMainVersion = mobileTransferUiVersion;
const supersededAccountA11yMainVersion = "20260623-account-expanded-a11y-r1";
const finalTitleEn = "Mobile Reading and Transfer UI Fixes";
const finalPublishedAt = "2026-07-16T13:30:00.000Z";
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
const changelog20260630Section = markdownSection(changelog, "## 2026-06-30");
const changelog20260706Section = markdownSection(changelog, "## 2026-07-06");
const changelog20260710Section = markdownSection(changelog, "## 2026-07-10");
const changelog20260711Section = markdownSection(changelog, "## 2026-07-11");
const changelog20260714Section = markdownSection(changelog, "## 2026-07-14");
const changelog20260716Section = markdownSection(changelog, "## 2026-07-16");

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
    'date: "2026.07.06"',
    'date: "2026.07.11"',
    'date: "2026.07.14"',
    'date: "2026.07.16"',
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
  const apiFinalTranslationValues = {};
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
        apiFinalTranslationValues[lang] ||= {};
        apiFinalTranslationValues[lang][field] = value;
      }
    }
  }

  const mainFinalFallback = windowAfter(mainJs, `article_id: "${finalUpdateId}"`, 12000);
  for (const token of [
    `article_id: "${finalUpdateId}"`,
    `slug: "${finalUpdateSlug}"`,
    'category: "site-updates"',
    `published_at: "${finalPublishedAt}"`,
    "fallbackOnly: true"
  ]) {
    if (!mainFinalFallback.includes(token)) {
      fail(`js/main.js final public update fallback metadata missing ${token}`);
    }
  }
  const mainFallbackFieldBlocks = Object.fromEntries(
    Object.keys(finalTranslationMinimums).map((field) => [field, propertyObjectBlock(mainFinalFallback, field)])
  );
  for (const lang of ["zh", "en", "ja"]) {
    for (const [field, minimumLength] of Object.entries(finalTranslationMinimums)) {
      const fallbackValue = jsStringPropertyValue(mainFallbackFieldBlocks[field], lang);
      const apiValue = apiFinalTranslationValues[lang]?.[field];
      if (!fallbackValue || fallbackValue.trim().length < minimumLength) {
        fail(`js/main.js final public update fallback ${lang}.${field} should be populated`);
      } else if (fallbackValue !== apiValue) {
        fail(`js/main.js and Functions final public update ${lang}.${field} should match exactly`);
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
    const schemaLangSeed = windowAfter(schemaSql, `'${finalUpdateId}-${lang}'`, 8000);
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
      } else if (value.replace(/\r\n/g, "\n") !== apiFinalTranslationValues[lang]?.[field]?.replace(/\r\n/g, "\n")) {
        fail(`Functions and schema final public update ${lang}.${field} should match exactly`);
      }
    }
  }

  for (const token of [
    'id="top-updated">2026.07.16',
    `/js/main.js?v=${finalMainVersion}`
  ]) {
    if (!indexHtml.includes(token)) {
      fail(`index.html final public update sync missing ${token}`);
    }
  }

  for (const token of [
    finalMainVersion,
    finalUpdateId,
    "site-updates",
    "fallback",
    "Functions seed",
    "schema seed"
  ]) {
    if (!changelog20260716Section.includes(token)) {
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

const migrationPackageData = parseJsonSource("package.json", packageJson);
const migrationWranglerData = parseJsonSource("wrangler.jsonc", wranglerConfig);
if (nodeVersion.trim() !== "22" || migrationPackageData.engines?.node !== ">=22.13.0") {
  fail("Node.js runtime must stay documented as version 22.13+ in .nvmrc and package.json");
}
if (migrationPackageData.devDependencies?.wrangler !== "4.111.0") {
  fail("package.json must pin Wrangler 4.111.0 for reproducible GPTWork setup");
}
if (migrationPackageData.scripts?.dev !== "wrangler pages dev") {
  fail("package.json dev must use wrangler pages dev and wrangler.jsonc");
}
if (migrationPackageData.scripts?.["d1:migrate:local"] !== "node scripts/d1-migrate-local.mjs") {
  fail("package.json local D1 migration must use the compatibility-aware migration script");
}
for (const token of ["pragma table_info", "alter table", "schema-indexes.sql", "local-d1-migrate: ok"]) {
  if (!d1MigrateLocalJs.includes(token)) {
    fail(`scripts/d1-migrate-local.mjs missing old-database compatibility guard ${token}`);
  }
}
for (const token of ["tests/*.test.mjs", "tools/japanese-subtext/tests/*.test.mjs", "tools/japanese-subtext/scripts/tts/tests/*.mjs"]) {
  if (!String(migrationPackageData.scripts?.test || "").includes(token)) {
    fail(`package.json test must cover ${token}`);
  }
}
for (const scriptName of ["test", "jp-subtext:test"]) {
  if (!String(migrationPackageData.scripts?.[scriptName] || "").startsWith("node scripts/run-tests.mjs ")) {
    fail(`package.json ${scriptName} must use the Node 22-compatible in-process test runner`);
  }
}
for (const token of ["pathToFileURL", "await import", "projectRelative.startsWith(\"..\")"]) {
  if (!testRunnerJs.includes(token)) {
    fail(`scripts/run-tests.mjs missing compatibility or path guard ${token}`);
  }
}
if (migrationWranglerData.d1_databases?.[0]?.binding !== "DB" || migrationWranglerData.d1_databases?.[0]?.preview_database_id !== "DB") {
  fail("wrangler.jsonc must bind local preview D1 as DB");
}
const transferBucketBinding = migrationWranglerData.r2_buckets?.find((binding) => binding.binding === "TRANSFER_BUCKET");
if (transferBucketBinding?.bucket_name !== "lusu-temp-transfer" || transferBucketBinding?.preview_bucket_name) {
  fail("wrangler.jsonc must bind the production TRANSFER_BUCKET without a local-only preview_bucket_name override");
}
const previewWranglerData = migrationWranglerData.env?.preview;
const previewDatabaseBinding = previewWranglerData?.d1_databases?.find((binding) => binding.binding === "DB");
if (previewDatabaseBinding?.database_id !== migrationWranglerData.d1_databases?.[0]?.database_id) {
  fail("wrangler.jsonc env.preview must preserve the DB binding when overriding non-inheritable bindings");
}
if (!Array.isArray(previewWranglerData?.r2_buckets) || previewWranglerData.r2_buckets.length !== 0) {
  fail("wrangler.jsonc env.preview must explicitly disable Quick Transfer R2 until a separate preview bucket is provisioned");
}
const declaredSecrets = new Set(migrationWranglerData.secrets?.required || []);
const previewDeclaredSecrets = new Set(previewWranglerData?.secrets?.required || []);
for (const secretName of ["CHAT_IP_HASH_SALT", "ANALYTICS_IP_HASH_SALT"]) {
  if (!declaredSecrets.has(secretName)) {
    fail(`wrangler.jsonc secrets.required missing ${secretName}`);
  }
  if (!previewDeclaredSecrets.has(secretName)) {
    fail(`wrangler.jsonc env.preview secrets.required missing ${secretName}`);
  }
  if (!new RegExp(`^${secretName}=\\s*$`, "m").test(envExample)) {
    fail(`.env.example must list ${secretName} without a value`);
  }
}
for (const token of [".dev.vars", ".dev.vars.*", ".env", ".env.*", "!.env.example", "output/", "*.pem", "*.key"]) {
  if (!gitignore.split(/\r?\n/).includes(token)) {
    fail(`.gitignore missing ${token}`);
  }
}
for (const token of ["actions/checkout@v6", "actions/setup-node@v6", "npm ci", "npm run d1:migrate:local", "npm test", "npm run build"]) {
  if (!verifyWorkflow.includes(token)) {
    fail(`.github/workflows/verify.yml missing ${token}`);
  }
}
for (const token of ["npm ci", ".env.example", "npm run d1:migrate:local", "npm test", "npm run build", "npm run dev"]) {
  if (!rootReadme.includes(token)) {
    fail(`README.md GPTWork setup missing ${token}`);
  }
}

if (/wrangler\s+(?:pages\s+)?deploy/i.test(packageJson) || !packageJson.includes("Merge to GitHub main")) {
  fail("package.json deploy script should point to merge-to-main Cloudflare Pages deployment, not Wrangler manual deploy");
}

for (const secretName of ["CHAT_IP_HASH_SALT", "ANALYTICS_IP_HASH_SALT"]) {
  if (!apiJs.includes(secretName)) {
    fail(`functions/api/[[route]].js missing required runtime secret ${secretName}`);
  }
}
if (/lusu-chat|lusu-analytics|ANALYTICS_IP_HASH_SALT\s*\|\|\s*env\.CHAT_IP_HASH_SALT/.test(apiJs)) {
  fail("functions/api/[[route]].js must not keep fixed or cross-purpose IP hash secret fallbacks");
}
if (
  !hasPattern(apiJs, /crypto\.subtle\.importKey\([\s\S]*name:\s*"HMAC"[\s\S]*crypto\.subtle\.sign\("HMAC"/)
  || !apiJs.includes('hmacSha256Hex(secret, `${purpose}:${ip}`)')
) {
  fail("functions/api/[[route]].js must use purpose-separated HMAC-SHA256 for IP hashes");
}
for (const token of [
  "ip_hash_key_id",
  "chatIpHashKeyId",
  "target.ip_hash_key_id !== currentIpHashKeyId",
  "chat_bans_active_ip_generation_idx"
]) {
  if (!apiJs.includes(token)) {
    fail(`functions/api/[[route]].js missing chat IP hash generation guard ${token}`);
  }
}
for (const token of ["ip_hash_key_id"]) {
  if (!schemaSql.includes(token)) {
    fail(`cloudflare/schema.sql missing chat IP hash generation field ${token}`);
  }
}
for (const token of ["anonymous_chat_messages_room_ip_generation_idx", "chat_bans_active_ip_generation_idx"]) {
  if (!schemaIndexesSql.includes(token)) {
    fail(`cloudflare/schema-indexes.sql missing chat IP hash generation index ${token}`);
  }
}
for (const token of ["end as expired", "end as effective", "expires_at > ?"]) {
  if (!apiJs.includes(token)) {
    fail(`functions/api/[[route]].js missing authoritative chat-ban expiry state ${token}`);
  }
}
for (const token of ["Number(ban?.effective) === 1", 'return "已过期"']) {
  if (!adminJs.includes(token)) {
    fail(`admin/admin.js must render server-authoritative chat-ban state ${token}`);
  }
}
if (!hasPattern(apiJs, /invalidRuntimeSecretNames\(env\)[\s\S]{0,500}status[^\n]*503|invalidRuntimeSecretNames\(env\)[\s\S]{0,500}503/)) {
  fail("functions/api/[[route]].js must fail before schema work when required runtime secrets are invalid");
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
        if (/select\s+created_at\s+from\s+anonymous_chat_messages\s+where\s+message_id\s*=\s*\?\s+and\s+room_key\s*=\s*\?/i.test(sql)) {
          return null;
        }
        return null;
      },
      async all() {
        if (/from\s+anonymous_chat_messages/i.test(sql) && /created_at\s*>\s*\?/i.test(sql)) {
          if (
            this.params[0] !== "public"
            || this.params[1] !== cursorCreatedAt
            || this.params[2] !== cursorCreatedAt
            || this.params[3] !== cursorId
          ) {
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
      env: apiEnv(createMockD1()),
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
    env: apiEnv(chatRecoveryDb),
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
    env: apiEnv(analyticsDb),
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
    env: apiEnv(analyticsDb),
    waitUntil() {}
  });
  if (!clickResponse?.ok) {
    const body = clickResponse ? await clickResponse.text() : "";
    fail(`functions/api/[[route]].js analytics click email-redaction smoke returned ${clickResponse?.status || "no response"}: ${body}`);
  }
  assertAnalyticsParamsRedacted(analyticsParamCalls(analyticsDb, "analytics_page_views"), "page-view", backendForbiddenEmailTexts);
  assertAnalyticsParamsRedacted(analyticsParamCalls(analyticsDb, "analytics_click_events"), "click", backendForbiddenEmailTexts);
  const analyticsVisitorCalls = analyticsParamCalls(analyticsDb, "site_visitors");
  assertAnalyticsCallSetRedacted(analyticsVisitorCalls, "visitor-profile", backendForbiddenEmailTexts);
  const expectedAnalyticsIpHash = createHmac("sha256", API_RUNTIME_SECRETS.ANALYTICS_IP_HASH_SALT)
    .update("analytics:unknown", "utf8")
    .digest("hex");
  if (
    !analyticsVisitorCalls.length
    || analyticsVisitorCalls.some((call) => call.params[4] !== expectedAnalyticsIpHash)
  ) {
    fail("functions/api/[[route]].js analytics IP hash must use the analytics HMAC secret and purpose context");
  }

  const originalConsoleError = console.error;
  let adminResponse;
  try {
    console.error = () => {};
    adminResponse = await onRequest({
      request: new Request("https://example.test/api/admin/me"),
      env: apiEnv(createMockD1()),
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
    env: apiEnv(createMockD1()),
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
