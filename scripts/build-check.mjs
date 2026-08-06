import { createHash, createHmac } from "node:crypto";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { runInNewContext } from "node:vm";
import { validatePublicModuleGraph } from "./check-public-module-graph.mjs";

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
  ".github/workflows/production-smoke.yml",
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
  "functions/api/anonymous-identity.mjs",
  "functions/api/transfer-service.mjs",
  "functions/api/whiteboard-service.mjs",
  "functions/articles/[slug].js",
  "functions/sitemap.xml.js",
  "assets/images/ui/pixel-ui-glyph-atlas.png",
  "assets/images/mobile-wallpapers/morning.webp",
  "assets/images/mobile-wallpapers/day.webp",
  "assets/images/mobile-wallpapers/dusk.webp",
  "assets/images/mobile-wallpapers/night.webp",
  "assets/images/generated-icons/whiteboard.png",
  "assets/images/generated-icons/whiteboard.source.json",
  "css/mobile-ios-shell.css",
  "css/motion-system.css",
  "css/routes/chatroom.css",
  "css/routes/games.css",
  "css/routes/knowledge.css",
  "css/routes/videos.css",
  "css/style.css",
  "css/transfer.css",
  "fragments/quick-transfer.html",
  "design-system/MASTER.md",
  "design-system/pages/desktop-shell.md",
  "design-system/pages/mobile-shell.md",
  "games/2048/index.html",
  "games/a-dark-room/index.html",
  "games/a-dark-room/source/css/lusu-mobile.css",
  "tests/a-dark-room-responsive-browser.audit.mjs",
  "games/hextris/index.html",
  "games/kittens-game/index.html",
  "games/kittens-game/source/build.version.json",
  "games/kittens-game/source/game.js",
  "games/kittens-game/source/index.html",
  "games/kittens-game/source/js/jsx/toolbar.jsx.js",
  "games/kittens-game/source/res/lusu-embedded.css",
  "games/life-restart/index.html",
  "games/life-restart/source/index.html",
  "games/life-restart/source/lusu-mobile-touch.js",
  "games/game-shell.js",
  "js/mobile-shell.js",
  "js/main.js",
  "js/core/i18n.mjs",
  "js/core/route-lifecycle.mjs",
  "js/core/route-modules.mjs",
  "js/data/content.mjs",
  "js/data/home-content.mjs",
  "js/data/videos-content.mjs",
  "js/data/resources-content.mjs",
  "js/data/blog-content.mjs",
  "js/features/anonymous-identity.mjs",
  "js/features/connection-status.mjs",
  "js/features/quick-transfer-loader.mjs",
  "js/transfer.js",
  "js/telemetry.js",
  "js/ui-motion.js",
  "manifest.webmanifest",
  "assets/transfer/quick-transfer-icons.png",
  "assets/transfer/quick-transfer-icons-source.png",
  "docs/transfer/README.md",
  "docs/transfer/ASSET_MANIFEST.md",
  "docs/transfer/dev-vars.example",
  "docs/whiteboard/README.md",
  "docs/PUBLIC_SITE_RELEASE_QA.md",
  "workers/transfer-cleanup/index.mjs",
  "workers/transfer-cleanup/wrangler.jsonc",
  "package-lock.json",
  "package.json",
  "scripts/d1-migrate-local.mjs",
  "scripts/build-transfer-icon-atlas.mjs",
  "scripts/check-public-module-graph.mjs",
  "scripts/public-ui-audit.mjs",
  "scripts/production-smoke.mjs",
  "scripts/run-tests.mjs",
  "tests/api-failure-recovery-gate.test.mjs",
  "tests/anonymous-identity-api.test.mjs",
  "tests/article-prerender.test.mjs",
  "tests/qa-release-contract.test.mjs",
  "tests/public-security-boundaries.test.mjs",
  "tests/production-smoke.test.mjs",
  "tests/whiteboard-integration-contract.test.mjs",
  "tests/whiteboard-service-api.test.mjs",
  "tools/whiteboard/index.html",
  "tools/whiteboard/whiteboard.css",
  "tools/whiteboard/src/main.jsx",
  "tools/whiteboard/THIRD_PARTY_NOTICES.md",
  "workers/whiteboard/wrangler.jsonc",
  "workers/whiteboard/src/index.ts",
  "workers/whiteboard/THIRD_PARTY_LICENSES.md",
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
  return readFileSync(fullPath, "utf8").replace(/\r\n?/g, "\n");
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

function cssBlockEnd(source, openIndex) {
  let depth = 1;
  let quote = "";
  for (let index = openIndex + 1; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (char === "\\") index += 1;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function cssDeclarations(source) {
  const declarations = [];
  let start = 0;
  let quote = "";
  let parentheses = 0;
  const pushDeclaration = (end) => {
    const raw = source.slice(start, end).trim();
    start = end + 1;
    const colon = raw.indexOf(":");
    if (colon <= 0) return;
    const property = raw.slice(0, colon).trim().toLowerCase();
    if (/^(?:--|-[a-z]+-)?[a-z][a-z0-9-]*$/.test(property)) {
      declarations.push(property);
    }
  };
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (char === "\\") index += 1;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'") quote = char;
    else if (char === "(") parentheses += 1;
    else if (char === ")") parentheses = Math.max(0, parentheses - 1);
    else if (char === ";" && parentheses === 0) pushDeclaration(index);
  }
  pushDeclaration(source.length);
  return declarations;
}

function collectCssRules(source, atRules = []) {
  const css = source.replace(/\/\*[\s\S]*?\*\//g, " ");
  const rules = [];
  let cursor = 0;
  while (cursor < css.length) {
    const openIndex = css.indexOf("{", cursor);
    if (openIndex < 0) break;
    const semicolonIndex = css.indexOf(";", cursor);
    if (semicolonIndex >= 0 && semicolonIndex < openIndex) {
      cursor = semicolonIndex + 1;
      continue;
    }
    const header = css.slice(cursor, openIndex).trim();
    const closeIndex = cssBlockEnd(css, openIndex);
    if (!header || closeIndex < 0) break;
    const body = css.slice(openIndex + 1, closeIndex);
    if (header.startsWith("@")) {
      rules.push(...collectCssRules(body, [...atRules, header]));
    } else {
      rules.push({ selector: header, atRules, declarations: cssDeclarations(body) });
    }
    cursor = closeIndex + 1;
  }
  return rules;
}

const MOBILE_LAYOUT_COMPONENTS = Object.freeze([
  "account-button", "account-popover", "account-widget", "article-detail", "article-detail-card",
  "article-read-progress", "article-reader-sidebar", "article-top-link", "brand-button", "brand-orb",
  "card-grid", "category-button", "category-panel", "chat-message", "chat-message-avatar",
  "chat-private-room-panel", "chat-send-button", "chatroom-avatar", "chatroom-compose", "chatroom-counter",
  "chatroom-footer", "chatroom-header", "chatroom-log", "chatroom-status", "chatroom-window",
  "desktop-icon", "desktop-icons", "desktop-intro", "filter-row", "folder-layout", "game-card",
  "game-cover", "game-list", "icon-title", "knowledge-searchbar", "modal", "modal-window", "page",
  "page-home", "pixel-icon", "profile-avatar", "profile-avatar-image", "profile-card", "recent-panel",
  "start-button", "status-tray", "taskbar-tabs", "topbar-actions", "video-body", "video-card", "video-grid",
  "video-thumb", "welcome-content", "welcome-note", "welcome-window", "window-controls", "window-titlebar",
  "xp-taskbar", "xp-topbar", "xp-window"
]);

const MOBILE_LAYOUT_PROPERTIES = new Set([
  "align-content", "align-items", "align-self", "aspect-ratio", "bottom", "box-sizing", "clear", "contain",
  "display", "flex", "flex-basis", "flex-direction", "flex-flow", "flex-grow", "flex-shrink", "flex-wrap", "float",
  "gap", "grid", "grid-area", "grid-auto-columns", "grid-auto-flow", "grid-auto-rows", "grid-column", "grid-row",
  "grid-template", "grid-template-areas", "grid-template-columns", "grid-template-rows", "height", "inset", "left",
  "margin", "margin-block", "margin-block-end", "margin-block-start", "margin-bottom", "margin-inline",
  "margin-inline-end", "margin-inline-start", "margin-left", "margin-right", "margin-top", "max-height", "max-width",
  "min-height", "min-width", "order", "overflow", "overflow-block", "overflow-inline", "overflow-x", "overflow-y",
  "overscroll-behavior", "overscroll-behavior-block", "overscroll-behavior-inline", "overscroll-behavior-x",
  "overscroll-behavior-y", "padding", "padding-block", "padding-block-end", "padding-block-start", "padding-bottom",
  "padding-inline", "padding-inline-end", "padding-inline-start", "padding-left", "padding-right", "padding-top",
  "place-content", "place-items", "place-self", "position", "resize", "right", "scroll-padding", "scroll-padding-block",
  "scroll-padding-inline", "scroll-snap-align", "scroll-snap-type", "top", "touch-action", "visibility", "width", "z-index"
]);
// Transform/animation/transition are intentionally absent: motion-system.css
// owns those stateful effects while mobile-ios-shell.css owns box geometry.

function mobileLayoutComponent(selector) {
  const matches = [...selector.matchAll(/\.([a-z][a-z0-9-]*)/gi)];
  for (let index = matches.length - 1; index >= 0; index -= 1) {
    if (MOBILE_LAYOUT_COMPONENTS.includes(matches[index][1])) return matches[index][1];
  }
  return "";
}

function ruleCanTargetMobile(file, rule) {
  if (file === "css/mobile-ios-shell.css") {
    return rule.selector.includes('html[data-ui-shell="mobile"]');
  }
  if (file === "css/motion-system.css") {
    return !rule.selector.includes('html[data-ui-shell="desktop"]');
  }
  return rule.atRules.some((atRule) => /@media\b[^\{]*(?:max-width:\s*(?:980|900|760|620|460|380|360)px|max-height:\s*(?:720|540|520|460)px)/i.test(atRule));
}

function findMobileLayoutOwnershipConflicts(sources) {
  const ownerDeclarations = new Set();
  const sourceRules = sources.map(({ file, source }) => ({ file, rules: collectCssRules(source) }));
  for (const { file, rules } of sourceRules) {
    if (file !== "css/mobile-ios-shell.css") continue;
    for (const rule of rules) {
      if (!ruleCanTargetMobile(file, rule)) continue;
      for (const selector of rule.selector.split(",")) {
        const component = mobileLayoutComponent(selector);
        if (!component) continue;
        for (const property of rule.declarations) {
          if (MOBILE_LAYOUT_PROPERTIES.has(property)) ownerDeclarations.add(`${component}:${property}`);
        }
      }
    }
  }
  const conflicts = [];
  for (const { file, rules } of sourceRules) {
    if (file === "css/mobile-ios-shell.css") continue;
    for (const rule of rules) {
      if (!ruleCanTargetMobile(file, rule)) continue;
      for (const selector of rule.selector.split(",")) {
        const component = mobileLayoutComponent(selector);
        if (!component) continue;
        for (const property of rule.declarations) {
          const key = `${component}:${property}`;
          if (MOBILE_LAYOUT_PROPERTIES.has(property)) {
            const reason = ownerDeclarations.has(key) ? "duplicates mobile owner" : "outside mobile owner";
            conflicts.push(`${file} ${selector.trim()} -> ${property} (${reason})`);
          }
        }
      }
    }
  }
  return [...new Set(conflicts)].sort();
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

const repositoryRuntimeSourceExtensions = /\.(?:css|html?|[cm]?js|mjs)$/i;
const repositoryScanIgnoredDirectories = new Set([
  ".git",
  ".wrangler",
  ".wrangler-config",
  ".codex-remote-attachments",
  ".codex-worktrees",
  "dist",
  "node_modules",
  "output"
]);

function repositoryRuntimeSources(directory = root) {
  const sources = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (repositoryScanIgnoredDirectories.has(entry.name) || entry.name.startsWith(".production-build-")) continue;
      sources.push(...repositoryRuntimeSources(resolve(directory, entry.name)));
      continue;
    }
    if (!entry.isFile() || !repositoryRuntimeSourceExtensions.test(entry.name)) continue;
    const fullPath = resolve(directory, entry.name);
    sources.push({
      path: relative(root, fullPath).replaceAll("\\", "/"),
      source: readFileSync(fullPath, "utf8").replace(/\r\n?/g, "\n")
    });
  }
  return sources;
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
  const bodies = objectBlocksAfterMarker(source, marker);
  if (!bodies.length) {
    fail(`missing ${marker}`);
    return;
  }
  if (!bodies.some((body) => hasPattern(body, pattern))) {
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
  const pattern = new RegExp(`(?:^|[^\\w$])["']?${escapeRegExp(propertyName)}["']?\\s*:\\s*\\{`, "m");
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
  const pattern = new RegExp("(?:^|[^\\w$])[\"']?" + escapeRegExp(propertyName) + "[\"']?\\s*:\\s*([\"'`])", "m");
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

function objectBlocksAfterMarker(source, marker) {
  const bodies = [];
  let searchFrom = 0;
  while (searchFrom < source.length) {
    const markerIndex = source.indexOf(marker, searchFrom);
    if (markerIndex < 0) break;
    const tail = source.slice(markerIndex);
    const body = objectBlockAfterMarker(tail, marker);
    if (body) bodies.push(body);
    searchFrom = markerIndex + marker.length;
  }
  return bodies;
}

const publicModuleGraph = validatePublicModuleGraph({ root });
for (const failure of publicModuleGraph.failures) {
  fail(`public module graph: ${failure}`);
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
  "js/core/i18n.mjs",
  "js/core/route-modules.mjs",
  "js/data/content.mjs",
  "js/ui-motion.js"
]) {
  requireNonEmptyFile(file);
}

const adminHtml = readRequired("admin/index.html");
const adminCss = readRequired("admin/admin.css");
const adminJs = readRequired("admin/admin.js");
const adminTransferHtml = readRequired("admin/transfer.html");
const adminTransferCss = readRequired("admin/transfer.css");
const adminWorldMapSvg = readRequired("assets/images/admin-world-map.svg");
const adminMiddlewareJs = readRequired("functions/admin/_middleware.js");
const apiJs = readRequired("functions/api/[[route]].js");
const transferApiJs = readRequired("functions/api/transfer-service.mjs");
const articlePrerenderJs = readRequired("functions/articles/[slug].js");
const schemaSql = readRequired("cloudflare/schema.sql");
const schemaIndexesSql = readRequired("cloudflare/schema-indexes.sql");
const d1MigrateLocalJs = readRequired("scripts/d1-migrate-local.mjs");
const testRunnerJs = readRequired("scripts/run-tests.mjs");
const indexHtml = readRequired("index.html");
const mobileIosShellCss = readRequired("css/mobile-ios-shell.css");
const motionSystemCss = readRequired("css/motion-system.css");
const styleCss = readRequired("css/style.css");
const gameShellJs = readRequired("games/game-shell.js");
const kittensBuildVersion = readRequiredJson("games/kittens-game/source/build.version.json");
const kittensSourceGameJs = readRequired("games/kittens-game/source/game.js");
const kittensSourceIndexHtml = readRequired("games/kittens-game/source/index.html");
const kittensSourceToolbarJs = readRequired("games/kittens-game/source/js/jsx/toolbar.jsx.js");
readRequired("games/kittens-game/source/res/lusu-embedded.css");
const kittensThemeFiles = readdirSync(resolve(root, "games/kittens-game/source/res"))
  .filter((file) => /^theme_.*\.css$/.test(file))
  .sort();
const gameIndexFiles = [
  "games/2048/index.html",
  "games/a-dark-room/index.html",
  "games/hextris/index.html",
  "games/kittens-game/index.html",
  "games/life-restart/index.html"
];
const gameIndexHtmls = gameIndexFiles.map((file) => [file, readRequired(file)]);
const aDarkRoomSourceHtml = readRequired("games/a-dark-room/source/index.html");
const lifeRestartSourceHtml = readRequired("games/life-restart/source/index.html");
const lifeRestartMobileTouchJs = readRequired("games/life-restart/source/lusu-mobile-touch.js");
const mobileShellJs = readRequired("js/mobile-shell.js");
const publicModuleSources = Object.fromEntries(publicModuleGraph.files.map((file) => [file, readRequired(file)]));
const mainEntryJs = publicModuleSources["js/main.js"];
const i18nModuleJs = publicModuleSources["js/core/i18n.mjs"];
const contentModuleJs = publicModuleSources["js/data/content.mjs"];
const homeContentModuleJs = publicModuleSources["js/data/home-content.mjs"];
const mainJs = publicModuleGraph.files.map((file) => publicModuleSources[file]).join("\n");
const runtimePublicJs = publicModuleGraph.files
  .filter((file) => !file.startsWith("js/data/"))
  .map((file) => publicModuleSources[file])
  .join("\n");
const lazyPublicRoutes = ["knowledge", "videos", "resources", "games", "chatroom"];
const lazyStyledRoutes = ["knowledge", "videos", "games", "chatroom"];
const lazyRouteCssSources = Object.fromEntries(lazyStyledRoutes.map((route) => {
  const path = `css/routes/${route}.css`;
  return [route, readRequired(path)];
}));
const transferCss = readRequired("css/transfer.css");
const transferJs = readRequired("js/transfer.js");
const transferFragmentHtml = readRequired("fragments/quick-transfer.html");
const quickTransferLoaderJs = readRequired("js/features/quick-transfer-loader.mjs");
const telemetryJs = readRequired("js/telemetry.js");
const uiMotionJs = readRequired("js/ui-motion.js");
const manifest = readRequired("manifest.webmanifest");
const envExample = readRequired(".env.example");
const gitignore = readRequired(".gitignore");
const nodeVersion = readRequired(".nvmrc");
const rootReadme = readRequired("README.md");
const verifyWorkflow = readRequired(".github/workflows/verify.yml");
const productionSmokeWorkflow = readRequired(".github/workflows/production-smoke.yml");
const productionSmokeJs = readRequired("scripts/production-smoke.mjs");
const wranglerConfig = readRequired("wrangler.jsonc");
const whiteboardWorkerWranglerConfig = readRequired("workers/whiteboard/wrangler.jsonc");
const whiteboardIconSource = readRequired("assets/images/generated-icons/whiteboard.source.json");
const packageJson = readRequired("package.json");
const publicUiAuditJs = readRequired("scripts/public-ui-audit.mjs");
const robots = readRequired("robots.txt");
const changelog = readRequired("CHANGELOG.md");
const headersConfig = readRequired("_headers");
const redirectsConfig = readRequired("_redirects");

const routeLazyVersion = "20260726-security-reliability-r1";
const trustSafetyStatusVersion = "20260726-security-reliability-r1";
const knowledgeReaderVersion = "20260728-knowledge-archive-r1";
const whiteboardReleaseVersion = "20260806-site-guides-password-rooms-r2";
const transferReleaseVersion = "20260801-whiteboard-reliable-sketch-r1";
const routeStyleVersion = knowledgeReaderVersion;
const publicRouteVersion = (route) => route === "knowledge"
  ? whiteboardReleaseVersion
  : (route === "resources" ? trustSafetyStatusVersion : routeLazyVersion);
const transferAtlasVersion = "20260718-resource-icons-layout-r1";
const chatroomIconVersion = "20260726-chatroom-icon-redraw-r2";
const transferAtlasReferences = [];
for (const { path, source } of repositoryRuntimeSources()) {
  if (path === "scripts/build-check.mjs") continue;
  for (const version of assetQueryVersions(source, "quick-transfer-icons.png")) {
    transferAtlasReferences.push({ path, version });
    if (version !== transferAtlasVersion) {
      fail(`${path} Quick Transfer atlas query should be ${transferAtlasVersion}, found ${version}`);
    }
  }
}
for (const expectedPath of ["admin/transfer.css", "css/style.css", "css/transfer.css"]) {
  const matching = transferAtlasReferences.filter((reference) => reference.path === expectedPath);
  if (matching.length !== 1 || matching[0].version !== transferAtlasVersion) {
    fail(`${expectedPath} should reference quick-transfer-icons.png once at ${transferAtlasVersion}`);
  }
}
const adminTransferStyleVersions = assetQueryVersions(adminTransferHtml, "/admin/transfer.css");
if (adminTransferStyleVersions.length !== 1 || adminTransferStyleVersions[0] !== transferAtlasVersion) {
  fail(`admin/transfer.html stylesheet query should appear once as ${transferAtlasVersion}`);
}
if (!adminTransferCss.includes(`quick-transfer-icons.png?v=${transferAtlasVersion}`)) {
  fail(`admin/transfer.css should use the shared Quick Transfer atlas query ${transferAtlasVersion}`);
}
const staticPublicImports = [...mainEntryJs.matchAll(/\bimport\s+(?:[^"']+?\s+from\s+)?["']([^"']+)["']/g)]
  .map((match) => match[1]);
if (staticPublicImports.some((specifier) => specifier.startsWith("./routes/"))) {
  fail("js/main.js must not statically import public route modules");
}

for (const route of lazyPublicRoutes) {
  const modulePath = `./routes/${route}.mjs`;
  const routeVersion = publicRouteVersion(route);
  const versions = assetQueryVersions(mainEntryJs, modulePath);
  if (versions.length !== 1 || versions[0] !== routeVersion) {
    fail(`js/main.js ${route} route must use one literal dynamic import at ${modulePath}?v=${routeVersion}`);
  }
  const loaderPattern = new RegExp(
    `\\b${escapeRegExp(route)}\\s*:\\s*\\(\\)\\s*=>[\\s\\S]{0,360}?import\\(\\s*["']${escapeRegExp(modulePath)}\\?v=${routeVersion}["']\\s*\\)`
  );
  if (!hasPattern(mainEntryJs, loaderPattern)) {
    fail(`js/main.js ${route} registry loader must own its literal dynamic import`);
  }
}

for (const [modulePath, expectedVersion] of [
  ["./core/i18n.mjs", whiteboardReleaseVersion],
  ["./data/home-content.mjs", whiteboardReleaseVersion],
  ["./features/connection-status.mjs", trustSafetyStatusVersion],
  ["./data/resources-content.mjs", whiteboardReleaseVersion]
]) {
  const versions = assetQueryVersions(mainEntryJs, modulePath);
  if (versions.length !== 1 || versions[0] !== expectedVersion) {
    fail(`js/main.js ${modulePath} query should appear once as ${expectedVersion}`);
  }
}

if (!mainEntryJs.includes(`const routeStyleVersion = "${routeStyleVersion}";`)
  || !hasPattern(indexHtml, /<link\b(?=[^>]*\brel=["']stylesheet["'])(?=[^>]*\bdata-mobile-shell-style\b)[^>]*\bhref=["']\/css\/mobile-ios-shell\.css\?v=[^"']+["']/i)
  || !hasPattern(mainEntryJs, /function\s+ensureRouteStylesheet\(route\)[\s\S]*?document\.createElement\(["']link["']\)[\s\S]*?link\.rel\s*=\s*["']stylesheet["'][\s\S]*?querySelector\(["']link\[data-mobile-shell-style\]["']\)[\s\S]*?document\.head\.insertBefore\(link,\s*mobileShellStyle\)[\s\S]*?document\.head\.appendChild\(link\)/)
  || !hasPattern(mainEntryJs, /function\s+loadStyledRoute\(route,\s*moduleLoader,\s*instantiate\)[\s\S]*?Promise\.all\(\[ensureRouteStylesheet\(route\),\s*moduleLoader\(\)\]\)/)) {
  fail("route CSS loader must await one versioned stylesheet, insert it before the responsive authority, and load the route module before instantiation");
}

for (const route of lazyStyledRoutes) {
  const cssPath = `css/routes/${route}.css`;
  const publicCssPath = `/css/routes/${route}.css`;
  const cssSource = lazyRouteCssSources[route];
  if (!cssSource.trim()) fail(`${cssPath} must not be empty`);
  requireBalancedCss(cssPath, cssSource);
  if (/@media\b/i.test(cssSource)) {
    fail(`${cssPath} must not define @media rules; responsive geometry belongs to css/mobile-ios-shell.css`);
  }
  const hrefPattern = new RegExp(
    `\\b${escapeRegExp(route)}\\s*:\\s*` + "`" + `${escapeRegExp(publicCssPath)}\\?v=\\$\\{routeStyleVersion\\}` + "`"
  );
  if (!hasPattern(mainEntryJs, hrefPattern)) {
    fail(`js/main.js routeStyleHrefs must map ${route} to ${publicCssPath}?v=\${routeStyleVersion}`);
  }
  const routeVersion = publicRouteVersion(route);
  const styledLoaderPattern = new RegExp(
    `\\b${escapeRegExp(route)}\\s*:\\s*\\(\\)\\s*=>\\s*loadStyledRoute\\(\\s*["']${escapeRegExp(route)}["'][\\s\\S]{0,240}?import\\(\\s*["']\\.\\/routes\\/${escapeRegExp(route)}\\.mjs\\?v=${routeVersion}["']\\s*\\)`
  );
  if (!hasPattern(mainEntryJs, styledLoaderPattern)) {
    fail(`js/main.js ${route} loader must await its route stylesheet through loadStyledRoute()`);
  }
}

if (indexHtml.includes("/css/routes/")
  || hasPattern(indexHtml, /<link\b(?=[^>]*\brel=["']modulepreload["'])(?=[^>]*\bhref=["'][^"']*(?:\/js\/routes\/|\.\/js\/routes\/))/i)) {
  fail("index.html must not eagerly link route CSS or modulepreload public route modules");
}

const publicUiAuditPackageData = parseJsonSource("package.json", packageJson);
if (publicUiAuditPackageData.scripts?.["audit:public-ui"] !== "node scripts/public-ui-audit.mjs"
  || publicUiAuditPackageData.scripts?.["audit:resources-layout"] !== "node scripts/public-ui-audit.mjs --resources-only"
  || publicUiAuditPackageData.scripts?.["build:transfer-icons"] !== "node scripts/build-transfer-icon-atlas.mjs") {
  fail("package.json audit:public-ui must run scripts/public-ui-audit.mjs directly");
}
if (publicUiAuditPackageData.scripts?.["audit:public-ui:release"] !== "node scripts/public-ui-audit.mjs --release-only"
  || publicUiAuditPackageData.scripts?.["qa:local"] !== "npm run verify:public-site-release"
  || publicUiAuditPackageData.scripts?.["verify:public-site-release"] !== "npm run test && npm run check:public-modules && npm run build && npm run build:production:verify && npm run audit:public-ui:release && npm run audit:a-dark-room && git diff --check && git status --short") {
  fail("package.json must expose the non-publishing public release audit and unified local QA command");
}
for (const token of [
  "359x500",
  "375x667",
  "390x844",
  "430x932",
  "760x900",
  "844x390",
  "1280x720",
  "1440x900",
  "Emulation.setDeviceMetricsOverride",
  "prefers-reduced-motion",
  "Page.captureScreenshot",
  "document scrollWidth",
  "windowDockOverlapArea",
  "theme-bootstrap",
  "Accessibility.getFullAXTree",
  "skip-route-stability",
  "activeH1Count",
  "wrong-theme requests",
  "route-exit",
  "article-history",
  "article-lifecycle",
  "twitter:image:alt",
  "backgroundsInert",
  "programmatic focus escaped",
  "mobile close target is invalid",
  "quick-transfer-editing",
  "account popover Escape close",
  "chat-growth-359x500",
  "chat-height-proxy-390x844-to-390x500",
  "article-scroll-owner-390x500",
  "about-scroll-owner-390x500",
  "native-pagescale-internal-focus",
  "realSoftKeyboardTested:false",
  "keyboard-chat-compose-390x844-to-390x500",
  "keyboard-chat-private-390x844-to-390x500",
  "keyboard-home-account-390x844-to-390x500",
  "keyboard-resources-transfer-account-390x844-to-390x500",
  "keyboard-knowledge-search-390x844-to-390x500",
  "keyboard-transfer-room-entry-390x844-to-390x500",
  "keyboard-transfer-composer-390x844-to-390x500",
  "browser-ui-height-proxy-390x844-to-390x760",
  "orientation-round-trip-390x844-to-844x390",
  "native-pagescale-layout-stability",
  "dock-state-keyboard-round-trip-expanded",
  "dock-state-keyboard-round-trip-collapsed",
  "safe-area-insets-proxy",
  "realSafeAreaTested: false",
  "realBrowserChromeTested: false",
  "viewportProxyTested: true",
  "Page.bringToFront"
  ,"--resources-only"
  ,"checkResourceReturnState"
  ,"resources-returned-${lang}-"
  ,"resourceVisualLanguages"
  ,"resourceVisualExpectedResultCount"
  ,"responsive-release-matrix"
  ,"performance-traces.json"
  ,"Memory.getDOMCounters"
  ,"release-summary.json"
  ,"realDeviceCertified: false"
  ,"wcagCertified: false"
]) {
  if (!publicUiAuditJs.includes(token)) {
    fail(`scripts/public-ui-audit.mjs missing baseline contract token ${token}`);
  }
}
const publicReleaseQa = readRequired("docs/PUBLIC_SITE_RELEASE_QA.md");
for (const token of [
  "npm.cmd run verify:public-site-release",
  "npm.cmd run qa:public-release",
  "Authorized release: NO | YES",
  "NOT TESTED",
  "do not commit, push, merge",
  "origin/main",
  "Cloudflare Pages production deployment commit",
  "online `index.html` CSS/JS query strings"
]) {
  if (!publicReleaseQa.includes(token)) fail(`docs/PUBLIC_SITE_RELEASE_QA.md missing release barrier/evidence token ${token}`);
}
if (!hasPattern(publicUiAuditJs, /viewport\.mobile\s*&&\s*viewport\.height\s*>\s*viewport\.width\s*&&\s*viewport\.width\s*>=\s*500/)
  || !hasPattern(publicUiAuditJs, /wallpaper=\$\{fixedTheme\}&welcome=0/)
  || !hasPattern(publicUiAuditJs, /data\.document\.scrollWidth\s*===\s*viewport\.width/)
  || !hasPattern(publicUiAuditJs, /data\.windowDockOverlapArea\s*<=\s*1/)
  || !hasPattern(publicUiAuditJs, /function\s+scrollOwnerFailures[\s\S]*ownerInternal[\s\S]*targetFullyVisible[\s\S]*recentRealOwner/)
  || !hasPattern(publicUiAuditJs, /document:\s*documentPosition\(\)[\s\S]*pipelineViewport:/)) {
  fail("public UI audit must reject pseudo-phone widths and guard exact width plus Dock geometry");
}

const themeBootstrapIndex = indexHtml.indexOf("document.documentElement.dataset.timeTheme");
const firstBlockingStyleIndex = indexHtml.indexOf('/css/style.css?v=');
if (themeBootstrapIndex < 0 || firstBlockingStyleIndex < 0 || themeBootstrapIndex > firstBlockingStyleIndex) {
  fail("index.html must establish html[data-time-theme] before the first blocking stylesheet");
}
if (indexHtml.includes('id="wallpaper-root" data-time="day"')
  || !hasPattern(styleCss, /html\[data-time-theme="morning"\][\s\S]*html\[data-time-theme="day"\][\s\S]*html\[data-time-theme="dusk"\][\s\S]*html\[data-time-theme="night"\]/)
  || !hasPattern(mobileIosShellCss, /html\[data-ui-shell="mobile"\]\[data-time-theme="morning"\][\s\S]*html\[data-ui-shell="mobile"\]\[data-time-theme="night"\]/)
  || !hasPattern(mainJs, /document\.documentElement\.dataset\.timeTheme\s*=\s*theme/)) {
  fail("four-period wallpaper bootstrap must avoid a hard-coded day theme and synchronize html, desktop, and mobile selectors");
}

if (indexHtml.indexOf('class="skip-link"') < 0
  || indexHtml.indexOf('class="skip-link"') > indexHtml.indexOf('class="site-shell"')
  || !indexHtml.includes('<main id="main-content" tabindex="-1">')
  || countLiteral(indexHtml, "<h1") !== 8) {
  fail("index.html must expose a first-focus skip link, a focusable main landmark, and exactly one H1 per route");
}
for (const route of ["home", "knowledge", "videos", "resources", "games", "blog", "chatroom", "about"]) {
  if (!indexHtml.includes(`id="${route}-title"`) || !hasPattern(indexHtml, new RegExp(`<section[^>]+id="${route}"[^>]+aria-labelledby="${route}-title"`))) {
    fail(`index.html ${route} route must be labelled by its stable H1`);
  }
}
if (!hasPattern(mainJs, /document\.querySelector\("\.skip-link"\)\?\.addEventListener\("click",[\s\S]*event\.preventDefault\(\)[\s\S]*main\.focus\(\{\s*preventScroll:\s*true\s*\}\)/)
  || !mainJs.includes('document.createElement(`h${heading[1].length + 1}`)')
  || mainJs.includes('const title = document.createElement("h3")')) {
  fail("skip navigation must preserve the current route and public card/Markdown headings must start at H2");
}

for (const [label, source, markers] of [
  ["Quick Transfer fragment", transferFragmentHtml, ["id=\"transfer-app\"", "id=\"transfer-drop-overlay\"", "id=\"transfer-text-form\""]],
  ["Quick Transfer lazy loader", quickTransferLoaderJs, ["/fragments/quick-transfer.html", "/css/transfer.css", "/js/transfer.js", "DOMParser", "EXPECTED_IDS"]],
  ["js/main.js transfer resource", mainJs, ["seed-update-2026-07-16-quick-transfer", "quick-transfer", "quickTransferOpen"]],
  ["transfer API", transferApiJs, ["handleTransferApi", "ensureTransferSchema", "runTransferCleanup"]],
  ["transfer client", transferJs, ["QuickTransfer", "deriveRoom", "runMultipart"]],
  ["transfer schema", schemaSql, ["transfer_rooms", "transfer_upload_sessions", "transfer_alerts"]]
]) {
  for (const marker of markers) {
    if (!source.includes(marker)) fail(`${label} missing ${marker}`);
  }
}

if (indexHtml.includes('id="transfer-app"')
  || indexHtml.includes('/css/transfer.css')
  || indexHtml.includes('/js/transfer.js')) {
  fail("index.html must not preload Quick Transfer DOM, CSS, or JavaScript before its resource action is clicked");
}

if (!hasPattern(quickTransferLoaderJs, new RegExp(`const\\s+TRANSFER_VERSION\\s*=\\s*["']${transferReleaseVersion}["']`))
  || !hasPattern(quickTransferLoaderJs, /Promise\.all\(\[ensureStylesheet\(\),\s*ensureFragment\(\),\s*ensureScript\(\)\]\)/)
  || !hasPattern(quickTransferLoaderJs, /root\.querySelector\(["']script, style, link, meta, base, iframe, object, embed, svg, math["']\)/)
  || !hasPattern(quickTransferLoaderJs, /routeActive[\s\S]*await\s+ensureLoaded\(\)[\s\S]*if\s*\(!routeActive\)/)
  || !hasPattern(quickTransferLoaderJs, /if\s*\(!initialized\)\s*\{[\s\S]*implementation\.init\(language\)[\s\S]*initialized\s*=\s*true/)) {
  fail("Quick Transfer loader must keep its three local assets single-flight, validate inert markup, and initialize only after an active click route");
}

if (!hasPattern(styleCss, /#resource-list\s*>\s*\.resource-card\s*\{[\s\S]*?width:\s*100%[\s\S]*?height:\s*auto[\s\S]*?min-height:\s*150px[\s\S]*?max-height:\s*none/)
  || !hasPattern(styleCss, /#resource-list\s+\.resource-facts\s*\{[\s\S]*?display:\s*grid[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/)
  || !hasPattern(styleCss, /#resource-list\s+\.resource-tags\s*\{[\s\S]*?display:\s*flex[\s\S]*?flex-wrap:\s*wrap[\s\S]*?overflow:\s*visible/)
  || !hasPattern(mobileIosShellCss, /html\[data-ui-shell="mobile"\]\s+#resource-list\s*>\s*\.resource-card\s*\{[\s\S]*?height:\s*auto[\s\S]*?min-height:\s*0[\s\S]*?max-height:\s*none/)
  || !hasPattern(mobileIosShellCss, /html\[data-ui-shell="mobile"\]\s+#resource-list\s+\.resource-tags\s*\{[\s\S]*?display:\s*flex[\s\S]*?flex-wrap:\s*wrap/)) {
  fail("eager base CSS should keep Resource cards stable before Quick Transfer CSS is requested");
}

if (!hasPattern(transferCss, /body\[data-route="resources"\]\s+\.topbar-actions\s*\{\s*display:\s*contents/)
  || !hasPattern(transferCss, /body\[data-route="resources"\]\s+\.account-widget\s*\{\s*display:\s*contents/)
  || !hasPattern(transferJs, /function\s+openAccountFromTransfer[\s\S]*openAccountPopover\(\{\s*returnFocus:\s*trigger,\s*mode:\s*["']login["'],\s*context:\s*["']transfer["']\s*\}\)/)
  || !hasPattern(transferJs, /listen\(window,\s*["']lusu:accountchange["'],\s*syncAccountState\)/)
  || !hasPattern(mainJs, /function\s+openAccountPopover\(options\s*=\s*\{\}\)[\s\S]*accountPopoverReturnFocus/)) {
  fail("Quick Transfer sign-in should open the mobile account popover and restore authentication/focus state");
}

if (!hasPattern(transferJs, /catch\s*\(error\)\s*\{[\s\S]{0,240}?if\s*\(error\.status\s*===\s*401\)\s*\{\s*stopPoll\(\)/)) {
  fail("Quick Transfer should stop room polling as soon as the account session becomes unauthorized");
}

if (!transferFragmentHtml.includes('id="transfer-drop-overlay"')
  || !hasPattern(transferJs, /listen\(refs\.dropSurface,\s*["']dragenter["'],\s*handleWindowDragEnter\)/)
  || !hasPattern(transferJs, /listen\(refs\.dropSurface,\s*["']drop["'],\s*handleWindowDrop\)/)
  || !hasPattern(transferJs, /function\s+isFileDrag[\s\S]*dataTransfer\?\.types[\s\S]*includes\(["']Files["']\)/)
  || !hasPattern(transferJs, /function\s+queueFiles\([\s\S]*!state\.config\?\.r2Ready[\s\S]*setFeedback\(text\(["']r2Missing["']\),\s*true\)[\s\S]*return/)
  || !hasPattern(transferJs, /function\s+pumpTaskQueue\(\)\s*\{\s*if\s*\(!state\.config\?\.r2Ready\)\s*\{\s*failPendingTasksForUnavailableStorage\(\)/)
  || !hasPattern(transferJs, /payload\.code\s*\|\|\s*["']["'][\s\S]*error\.code\s*===\s*["']TRANSFER_R2_NOT_BOUND["']/)
  || !hasPattern(transferCss, /\.transfer-drop-overlay\s*\{[\s\S]*position:\s*absolute[\s\S]*pointer-events:\s*none/)) {
  fail("Quick Transfer should accept file-only drops across the full window and block unavailable uploads before creating tasks");
}

if (!hasPattern(transferCss, /html\[data-ui-shell="desktop"\]\s+#resources\s+\.xp-window\.is-transfer-room-mode\s*\{[\s\S]*height:\s*calc\(100dvh\s*-\s*var\(--chrome-window-compact-reserve\)\)/)
  || !hasPattern(transferCss, /html\[data-ui-shell="desktop"\]\s+#resources\s+\.xp-window\.is-transfer-room-mode\s+\.transfer-feed\s*\{\s*max-height:\s*none/)
  || !hasPattern(transferJs, /frame\.classList\.toggle\(["']is-transfer-open["'],\s*open\)/)
  || !hasPattern(transferJs, /frame\.classList\.toggle\(["']is-transfer-room-mode["'],\s*mode\s*===\s*["']room["']\)/)) {
  fail("Quick Transfer desktop window and feed should expand with the available browser viewport");
}

const mobileTransferLandscapeStart = transferCss.indexOf("@media (min-width: 700px) and (max-height: 560px) and (orientation: landscape)");
const mobileTransferLandscapeEnd = transferCss.indexOf("@media (prefers-reduced-motion: reduce)", mobileTransferLandscapeStart);
const mobileTransferLandscapeCss = mobileTransferLandscapeStart >= 0 && mobileTransferLandscapeEnd > mobileTransferLandscapeStart
  ? transferCss.slice(mobileTransferLandscapeStart, mobileTransferLandscapeEnd)
  : "";

if (!hasPattern(transferCss, /html\[data-ui-shell="mobile"\]\s+\.transfer-room\s*\{[^}]*display:\s*flex[^}]*flex-direction:\s*column[^}]*align-items:\s*stretch[^}]*overflow-y:\s*auto/)
  || !hasPattern(transferCss, /html\[data-ui-shell="mobile"\]\s+\.transfer-room\s*>\s*\.transfer-room-toolbar,\s*html\[data-ui-shell="mobile"\]\s+\.transfer-room\s*>\s*\.transfer-feed,\s*html\[data-ui-shell="mobile"\]\s+\.transfer-room\s*>\s*\.transfer-compose,\s*html\[data-ui-shell="mobile"\]\s+\.transfer-room\s*>\s*\.transfer-tasks\s*\{[^{}]*flex:\s*0\s+0\s+auto/)
  || !hasPattern(mobileTransferLandscapeCss, /html\[data-ui-shell="mobile"\]\s+\.transfer-room\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*minmax\(0,\s*1\.35fr\)\s+minmax\(270px,\s*\.9fr\)[^}]*grid-template-rows:\s*auto\s+auto\s+auto/)
  || !hasPattern(transferCss, /html\[data-ui-shell="mobile"\]\s+\.transfer-feed\s*\{[^}]*overflow:\s*visible[^}]*overscroll-behavior:\s*auto/)
  || !hasPattern(transferCss, /html\[data-ui-shell="mobile"\]\s+\.transfer-compose\s*\{[\s\S]*?position:\s*static[\s\S]*?z-index:\s*auto[\s\S]*?bottom:\s*auto/)
  || !hasPattern(transferCss, /html\[data-ui-shell="mobile"\]\s+\.transfer-media-preview\s*\{[\s\S]*?width:\s*100%[\s\S]*?height:\s*clamp\(190px,\s*58vw,\s*240px\)[\s\S]*?box-sizing:\s*border-box[\s\S]*?justify-self:\s*stretch/)
  || !hasPattern(transferCss, /html\[data-ui-shell="mobile"\]\s+\.transfer-file-card\s*\{[\s\S]*?width:\s*100%[\s\S]*?max-width:\s*none/)
  || !hasPattern(transferCss, /html\[data-ui-shell="mobile"\]\s+\.transfer-delete-button\s*\{[\s\S]*?width:\s*44px[\s\S]*?min-height:\s*44px/)
  || !hasPattern(transferJs, /function\s+requestFocusReveal\(reason\)[\s\S]*window\.LusuMobileShell\?\.requestFocusReveal\?\.\(reason\)/)
  || hasPattern(transferJs, /subscribeViewport|quick-transfer:viewport-focus|viewportUnsubscribe|focusedTransferControl|revealFocusedTransferControl|scrollIntoView/)) {
  fail("Quick Transfer mobile room should keep one reachable owner, stable full-width media, 44px delete controls, and delegate focus recovery to the shared mobile shell");
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
  const assetVersion = "20260726-japanese-subtext-network-r1";
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
    ["/", "no-cache, max-age=0, must-revalidate"],
    ["/index.html", "no-cache, max-age=0, must-revalidate"],
    ["/_assets/*", "public, max-age=31536000, immutable"],
    ["/*.json", "public, max-age=300, must-revalidate"],
    ["/css/*", "public, max-age=300, must-revalidate"],
    ["/js/*", "public, max-age=300, must-revalidate"],
    ["/admin/*", "no-store"]
  ];
  for (const [path, cacheControl] of requiredHeaderRules) {
    const pattern = new RegExp(`(?:^|\\r?\\n)${escapeRegExp(path)}\\r?\\n[ \\t]+Cache-Control:\\s*${escapeRegExp(cacheControl)}(?:\\r?\\n|$)`);
    if (!pattern.test(headersConfig)) {
      fail(`_headers missing ${path} Cache-Control: ${cacheControl}`);
    }
  }
  for (const [header, requiredValue] of [
    ["Content-Security-Policy", "frame-ancestors 'self'; base-uri 'self'; object-src 'none'"],
    ["Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()"],
    ["Referrer-Policy", "strict-origin-when-cross-origin"],
    ["Strict-Transport-Security", "max-age=31536000; includeSubDomains"],
    ["X-Content-Type-Options", "nosniff"],
    ["X-Frame-Options", "SAMEORIGIN"]
  ]) {
    if (!headersConfig.includes(`  ${header}: ${requiredValue}`)) {
      fail(`_headers missing global ${header}: ${requiredValue}`);
    }
  }
  if (!/(?:^|\r?\n)\/tools\/japanese-subtext \/tools\/japanese-subtext\/ 301(?:\r?\n|$)/.test(redirectsConfig)) {
    fail("_redirects must canonicalize /tools/japanese-subtext to its trailing-slash URL");
  }
  if (/^\/articles\/\*/m.test(redirectsConfig)) {
    fail("_redirects must leave article URLs to functions/articles/[slug].js");
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
  "traffic-panel",
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
  "traffic",
  "articles",
  "automation",
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

if (!adminHtml.includes('data-admin-href="/admin/transfer.html"')) {
  fail("admin/index.html must expose the protected transfer file manager from the main navigation");
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
  "traffic",
  "articles",
  "automation",
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

const adminSafetyCacheVersion = "20260801-service-reliability-r1";
const adminPublicContentVersion = "20260802-traffic-budget-r1";
if (!adminHtml.includes(`/admin/admin.css?v=${adminSafetyCacheVersion}`)
  || !adminHtml.includes(`/admin/admin.js?v=${adminPublicContentVersion}`)) {
  fail("admin CSS and JS must use their current cache versions");
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
  "traffic-control-form",
  "traffic-breakdown-body",
  "traffic-official-status",
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

if (/OWNER_ADMIN_EMAILS/.test(adminMiddlewareJs)) {
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
  "captureEditorBaselineIfClean",
  "navigateToAdminPage",
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

for (const path of publicModuleGraph.files) {
  const source = publicModuleSources[path]
    .replace(/^import\s+[^;]+;\s*$/gm, "")
    .replace(/^export\s+(?=(?:async\s+)?(?:function|class|const|let|var)\b)/gm, "");
  try {
    new Function(source);
  } catch (error) {
    fail(`${path} syntax error: ${error.message}`);
  }
  if (/(?:^|\r?\n)\/\*\r?\n[ \t]+Cache-Control:/i.test(headersConfig)) {
    fail("_headers must not restore a global Cache-Control rule that overlaps every cache class");
  }
  const immutableRules = [...headersConfig.matchAll(/(?:^|\r?\n)(\/[^\r\n]*)\r?\n[ \t]+Cache-Control:[^\r\n]*\bimmutable\b/gi)]
    .map((match) => match[1]);
  if (immutableRules.some((path) => path !== "/_assets/*")) {
    fail("_headers may only assign immutable caching to content-hashed /_assets files");
  }
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

const mobileLayoutOwnershipConflicts = findMobileLayoutOwnershipConflicts([
  { file: "css/style.css", source: styleCss },
  { file: "css/mobile-ios-shell.css", source: mobileIosShellCss },
  { file: "css/motion-system.css", source: motionSystemCss }
]);
if (mobileLayoutOwnershipConflicts.length > 0) {
  fail([
    "mobile critical layout must have one authority in css/mobile-ios-shell.css; remove these cross-file duplicates:",
    ...mobileLayoutOwnershipConflicts.map((conflict) => `  - ${conflict}`)
  ].join("\n"));
}

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
  'name="description"',
  'property="og:type"',
  'property="og:site_name"',
  'property="og:title"',
  'property="og:description"',
  'property="og:url"',
  'property="og:image"',
  'property="og:image:width"',
  'property="og:image:height"',
  'property="og:image:alt"',
  'property="og:locale"',
  'name="twitter:card"',
  'name="twitter:title"',
  'name="twitter:description"',
  'name="twitter:image"',
  'name="twitter:image:alt"',
  'rel="manifest"'
]) {
  if (countLiteral(indexHtml, token) !== 1) {
    fail(`index.html should contain exactly one ${token}`);
  }
}

for (const token of [
  '["GET", "HEAD"]',
  "articles.status = 'published'",
  "new HTMLRewriter()",
  'meta[property="og:type"]',
  'new AttributeHandler("content", "article")',
  'meta property="article:published_time"',
  'type="application/ld+json"',
  "new NoScriptArticleHandler",
  "articles.category",
  "articleNoScriptShowsSummary",
  "escapeHtml(content)",
  'headers.set("X-Robots-Tag", "noindex")',
  '"no-cache, max-age=0, must-revalidate"'
]) {
  if (!articlePrerenderJs.includes(token)) {
    fail(`functions/articles/[slug].js missing article prerender contract: ${token}`);
  }
}

for (const key of [
  "metaKnowledgeDescription",
  "metaVideosDescription",
  "metaResourcesDescription",
  "metaGamesDescription",
  "metaBlogDescription",
  "metaChatDescription",
  "metaAboutDescription",
  "metaShareImageAlt"
]) {
  const definitions = mainJs.match(new RegExp(`^\\s+${key}:\\s*"[^"\\r\\n]+"`, "gm")) || [];
  if (definitions.length !== 3) {
    fail(`js/main.js should define non-empty zh/en/ja ${key} values`);
  }
}

if (countLiteral(indexHtml, "data-modal-background") !== 2) {
  fail("index.html should mark exactly the skip link and site shell as modal backgrounds");
}
for (const dialogPattern of [
  /class="xp-window welcome-window"\s+role="dialog"\s+aria-modal="true"\s+aria-labelledby="welcome-title"\s+tabindex="-1"/,
  /class="xp-window modal-window"\s+role="dialog"\s+aria-modal="true"\s+aria-labelledby="modal-title"\s+tabindex="-1"/
]) {
  if (!hasPattern(indexHtml, dialogPattern)) {
    fail("index.html modal dialogs should be labelled, modal, and programmatically focusable");
  }
}
if (!hasPattern(mainJs, /openVideo\(Number\(videoButton\.dataset\.videoIndex\),\s*\{\s*trigger:\s*videoButton\s*\}\)/)
  || !hasPattern(mainJs, /const\s+managedVideoButton\s*=\s*target\.closest\(\s*["']\[data-video-id\]["']\s*\)[\s\S]*openVideo\(managedVideoButton\.dataset\.videoId,\s*\{\s*trigger:\s*managedVideoButton\s*\}\)/)
  || hasPattern(mainJs, /dataset\.videoSource\s*===\s*["']thumbnail["'][\s\S]{0,300}querySelector\(\s*["']\.card-action\[data-video-id\]["']/)) {
  fail("js/main.js video click branches should preserve the exact semantic thumbnail or card-action trigger");
}

for (const marker of ["function applyDocumentMeta", "function syncDocumentMeta", "function syncArticleDocumentMeta"]) {
  const block = objectBlockAfterMarker(mainJs, marker);
  if (!block || /history\.(?:pushState|replaceState)/.test(block)) {
    fail(`${marker} must not mutate browser history`);
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

if (!hasPattern(uiMotionJs, /if\s*\(\s*!canUseFullMotion\(\)\s*\)\s*\{\s*try\s*\{\s*var\s+immediateResult\s*=\s*commitOnce\(\)[\s\S]*cleanup\(\)[\s\S]*Promise\.resolve\(immediateResult\)/)) {
  fail("js/ui-motion.js reduced/off mode should commit modal closes immediately");
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

if (!indexHtml.includes('content="width=device-width, initial-scale=1.0, viewport-fit=cover, interactive-widget=resizes-content"')) {
  fail("index.html viewport should opt into safe-area coverage and content-resizing keyboard geometry");
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

const runtimeVisibleEmojiLines = runtimePublicJs.split(/\r?\n/).filter((line) => (
  /\b(?:textContent|innerText)\s*=|createTextNode\s*\(/.test(line)
  && visibleEmojiPattern.test(line)
));
if (runtimeVisibleEmojiLines.length) {
  fail("js/main.js runtime renderers must not write visible emoji or symbol artwork");
}
const mainWithoutLegacyIconMetadata = runtimePublicJs.replace(/^\s*icon\s*:\s*(["'`]).*?\1\s*,?\s*$/gmu, "");
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
  ["chat quick link", new RegExp(`\\.quick-link-chat\\s+\\.quick-link-asset\\s*\\{[\\s\\S]*?background-image:\\s*url\\(["']\\.\\.\\/assets\\/images\\/icon-chatroom\\.png\\?v=${escapeRegExp(chatroomIconVersion)}["']\\)`)],
  ["games quick link", /\.quick-link-games\s+\.quick-link-asset[\s\S]*?\{[\s\S]*?background-image:\s*url\(["']\.\.\/assets\/images\/icon-games\.png\?v=20260718-resource-icons-layout-r1["']\)/],
  ["knowledge quick link", /\.quick-link-knowledge\s+\.quick-link-asset\s*\{[\s\S]*?background-image:\s*url\(["']\.\.\/assets\/images\/icon-knowledge\.png\?v=20260718-resource-icons-layout-r1["']\)/],
  ["video placeholder", /\.video-placeholder-asset\s*,\s*\.video-empty-icon\s*\{[\s\S]*?background-image:\s*url\(["']\.\.\/assets\/images\/icon-videos\.png\?v=20260718-resource-icons-layout-r1["']\)/]
]) {
  if (!hasPattern(motionSystemCss, pattern)) {
    fail(`css/motion-system.css missing bitmap-backed ${label} asset mapping`);
  }
}

if (!hasPattern(styleCss, new RegExp(`\\.chatroom-icon\\s*\\{[^}]*icon-chatroom\\.png\\?v=${escapeRegExp(chatroomIconVersion)}`))
  || hasPattern(lazyRouteCssSources.chatroom, /\.chatroom-icon\s*\{/)
  || !hasPattern(styleCss, new RegExp(`\\.title-icon-chatroom\\s*\\{[^}]*icon-chatroom\\.png\\?v=${escapeRegExp(chatroomIconVersion)}`))
  || hasPattern(mobileIosShellCss, /\.chatroom-avatar\s*\{[^}]*display:\s*none/)
  || (mobileIosShellCss.match(/\.chatroom-avatar\s*\{[^}]*display:\s*block[^}]*width:\s*(?:32|34)px[^}]*height:\s*(?:32|34)px/g) || []).length < 2) {
  fail("the canonical Chat icon must load before route CSS, the titlebar must use it, and short mobile layouts must retain a decoded avatar");
}
if (existsSync(resolve(root, "assets/images/icon-chatroom-clean.png"))
  || existsSync(resolve(root, "assets/images/icon-chatroom-desktop.png"))) {
  fail("legacy Chat icon assets must be removed after canonical icon replacement");
}

const viewportRuntimeSources = [mobileShellJs, mainJs, uiMotionJs, transferJs];
const nativeWindowResizeBindings = viewportRuntimeSources
  .reduce((count, source) => count + (source.match(/\bwindow\.addEventListener\(\s*["']resize["']/g) || []).length, 0);
const nativeVisualResizeBindings = viewportRuntimeSources
  .reduce((count, source) => count + (source.match(/\bwindow\.visualViewport\?*\.addEventListener\(\s*["']resize["']/g) || []).length, 0);
const nativeVisualScrollBindings = viewportRuntimeSources
  .reduce((count, source) => count + (source.match(/\bwindow\.visualViewport\?*\.addEventListener\(\s*["']scroll["']/g) || []).length, 0);

if (nativeWindowResizeBindings !== 1 || nativeVisualResizeBindings !== 1 || nativeVisualScrollBindings !== 1
  || !hasPattern(mobileShellJs, /function\s+createFramePipeline[\s\S]*function\s+schedule[\s\S]*function\s+flushFrame[\s\S]*phase\s*=\s*["']measure["'][\s\S]*phase\s*=\s*["']mutate["']/)
  || !hasPattern(mobileShellJs, /function\s+request\(/)
  || !hasPattern(mobileShellJs, /function\s+requestViewport\(/)
  || !hasPattern(mobileShellJs, /function\s+subscribeViewport\(/)
  || !hasPattern(mobileShellJs, /function\s+snapshot\(/)
  || !hasPattern(mobileShellJs, /const\s+tier\s*=[\s\S]*["']low["'][\s\S]*["']normal["'][\s\S]*root\.dataset\.performanceTier\s*=\s*framePipeline\.snapshot\(\)\.tier/)
  || !hasPattern(mobileShellJs, /isPinchZoomed[\s\S]*keyboardOffset\s*=\s*isPinchZoomed\s*\?\s*0/)
  || !hasPattern(mainJs, /pipeline\.schedule\(\s*["']main:article-read["'][\s\S]*measure:\s*measureArticleReadState[\s\S]*mutate:\s*applyArticleReadState/)
  || !hasPattern(mainJs, /subscribeViewport\(\s*["']main:home-layout["'][\s\S]*measure:\s*measureHomeViewportLayout[\s\S]*mutate:\s*applyHomeViewportLayout/)
  || !hasPattern(uiMotionJs, /subscribeViewport\(\s*["']ui-motion["'][\s\S]*mutate:\s*handleResize/)
  || !hasPattern(transferJs, /window\.LusuMobileShell\?\.requestFocusReveal\?\.\(reason\)/)
  || hasPattern(transferJs, /subscribeViewport|quick-transfer:viewport-focus|viewportUnsubscribe/)
  || !styleCss.includes('html[data-performance-tier="low"]')
  || !mobileIosShellCss.includes('html[data-ui-shell="mobile"][data-performance-tier="low"]')
  || !motionSystemCss.includes('html[data-performance-tier="low"]')) {
  fail("public viewport work must use one keyed read/write frame pipeline and expose a normal/low paint tier");
}

if (!hasPattern(mobileShellJs, /const\s+stableExpandedHeights\s*=\s*new\s+Map\(\)/)
  || !hasPattern(mobileShellJs, /const\s+keyboardThreshold\s*=\s*Math\.max\(96,\s*Math\.round\(stableExpandedHeight\s*\*\s*0\.18\)\)/)
  || !hasPattern(mobileShellJs, /const\s+keyboardOpen\s*=\s*hasVisualViewport[\s\S]*!isPinchZoomed[\s\S]*editingHasFocus[\s\S]*shortenedBy\s*>=\s*keyboardThreshold/)
  || !hasPattern(mobileShellJs, /orientationChanged[\s\S]*!stableExpandedHeight[\s\S]*!keyboardWasOpen\s*&&\s*!editingHasFocus/)
  || !hasPattern(mobileShellJs, /keyboardBlurDeadline[\s\S]*blurGraceActive[\s\S]*function\s+noteEditingFocus[\s\S]*allowBlurGrace/)
  || !hasPattern(mobileShellJs, /viewportMode\s*=\s*["']zoom["'][\s\S]*viewportMode\s*=\s*["']keyboard["'][\s\S]*viewportMode\s*=\s*["']browser-ui["']/)
  || !hasPattern(mobileShellJs, /width:\s*isPinchZoomed\s*\?\s*layoutWidth\s*:\s*visualWidth[\s\S]*height:\s*isPinchZoomed\s*\?\s*layoutHeight\s*:\s*visualHeight/)
  || !hasPattern(mobileShellJs, /--mobile-viewport-height[\s\S]*--mobile-viewport-width[\s\S]*--mobile-viewport-offset-top[\s\S]*--mobile-viewport-offset-left[\s\S]*--mobile-keyboard-offset/)
  || !hasPattern(mobileShellJs, /root\.dataset\.mobileKeyboard\s*=\s*keyboardState[\s\S]*root\.dataset\.mobileOrientation\s*=[\s\S]*root\.dataset\.mobileViewportMode\s*=/)
  || !hasPattern(mobileShellJs, /const\s+FOCUS_RECHECK_DELAY_MS\s*=\s*400[\s\S]*function\s+scheduleFocusoutRecheck[\s\S]*window\.setTimeout/)
  || !hasPattern(mobileShellJs, /minimumTargetDelta\s*=\s*targetRect\.bottom\s*-\s*contentBottom[\s\S]*maximumTargetDelta\s*=\s*targetRect\.top\s*-\s*contentTop[\s\S]*Math\.max\(minimumTargetDelta/)
  || !indexHtml.includes("interactive-widget=resizes-content")) {
  fail("mobile viewport state must distinguish browser UI, keyboard, rotation, and pinch zoom through the shared frame pipeline");
}

if (!hasPattern(mobileIosShellCss, /html\[data-ui-shell="mobile"\]\[data-mobile-keyboard="open"\]\s+body\s*\{[^}]*--mobile-dock-space:/)
  || !hasPattern(mobileIosShellCss, /html\[data-ui-shell="mobile"\]\[data-mobile-keyboard="open"\]\s+body\s+\.xp-taskbar\s*\{[^}]*visibility:\s*hidden[^}]*opacity:\s*0[^}]*pointer-events:\s*none/)
  || !hasPattern(mobileIosShellCss, /\.account-popover\s*\{[\s\S]*--mobile-viewport-offset-top[\s\S]*--mobile-safe-right[\s\S]*--mobile-safe-left/)
  || !hasPattern(transferCss, /var\(--mobile-safe-bottom,\s*env\(safe-area-inset-bottom\)\)/)
  || hasPattern(transferJs, /visualViewport|scrollIntoView|subscribeViewport/)) {
  fail("mobile keyboard avoidance must temporarily release Dock space, respect shared safe-area variables, and keep Transfer free of private viewport geometry");
}

if (!hasPattern(mainJs, /function\s+setAccountStatus[\s\S]*function\s+syncAccountStatus[\s\S]*refs\.status\.textContent\s*=\s*message[\s\S]*requestMobileFocusReveal/)
  || !hasPattern(mainJs, /catch\s*\(error\)\s*\{[\s\S]*setFieldError\(failure\.field,\s*failure\.key\)[\s\S]*setAccountStatus\(failure\.key,\s*\{\s*error:\s*true\s*\}\)[\s\S]*requestMobileFocusReveal\(["']account-form-error-focus["']\)[\s\S]*finally\s*\{[\s\S]*setAccountSubmitting\(["']["']\)/)
  || !hasPattern(mainJs, /function\s+setChatFeedback[\s\S]*requestMobileFocusReveal\(["']chat-feedback["']\)/)
  || !hasPattern(mainJs, /const\s+setSearchStatus[\s\S]*requestMobileFocusReveal\(["']knowledge-search-status["']\)/)) {
  fail("account, Chat, and Knowledge feedback must preserve editing state and request shared mobile focus recovery");
}

for (const route of ["knowledge", "videos", "resources", "games", "blog", "chatroom", "about"]) {
  const routeEscapeHatch = new RegExp(`html\\[data-ui-shell="mobile"\\]\\s+body:not\\(\\[data-route="home"\\]\\)\\s+#${route}\\.page\\.active\\s*>\\s*\\.xp-window`);
  if (!hasPattern(mobileIosShellCss, routeEscapeHatch)) {
    fail(`css/mobile-ios-shell.css missing the specific mobile overflow escape hatch for ${route}`);
  }
}

if (!hasPattern(mobileIosShellCss, /#about\.page\.active\s*>\s*\.xp-window\s*\{[^}]*overflow-x:\s*hidden[^}]*overflow-y:\s*auto[^}]*overscroll-behavior-y:\s*contain[^}]*scroll-padding-block:\s*12px/)
  || !hasPattern(mobileIosShellCss, /html\[data-ui-shell="mobile"\]\s+body\.is-article-reading\s+#knowledge\.page\.active\s*>\s*\.xp-window[\s\S]*?\{[^}]*overflow-y:\s*hidden[^}]*overscroll-behavior-y:\s*none/)
  || !hasPattern(mobileIosShellCss, /html\[data-ui-shell="mobile"\]\s+#knowledge\s+\.content-list,\s*html\[data-ui-shell="mobile"\]\s+#videos\s+\.card-grid,\s*html\[data-ui-shell="mobile"\]\s+#resources\s+\.download-list,\s*html\[data-ui-shell="mobile"\]\s+#games\s+\.game-list,\s*html\[data-ui-shell="mobile"\]\s+#blog\s+\.notepad-paper,\s*html\[data-ui-shell="mobile"\]\s+#about\s+\.profile-card,\s*html\[data-ui-shell="mobile"\]\s+\.chatroom-log\s*\{[^}]*overscroll-behavior-y:\s*auto/)
  || !hasPattern(transferCss, /html\[data-ui-shell="mobile"\]\s+\.transfer-room-entry\s*\{[^}]*overflow-y:\s*auto[^}]*overscroll-behavior-y:\s*auto[^}]*scroll-padding-block:/)
  || !hasPattern(transferCss, /html\[data-ui-shell="mobile"\]\s+\.transfer-room\s*\{[^}]*overflow-y:\s*auto[^}]*overscroll-behavior-y:\s*auto[^}]*scroll-padding-block:/)
  || !hasPattern(transferCss, /html\[data-ui-shell="mobile"\]\s+\.transfer-login-gate\s*\{[^}]*overflow-y:\s*auto[^}]*overscroll-behavior-y:\s*auto[^}]*scroll-padding-block:/)
  || hasPattern(mobileIosShellCss, /body\[data-route="home"\][^,{]*\.xp-window\s*\{[^}]*overflow-y:\s*auto/)) {
  fail("mobile App windows must provide a dormant vertical overflow escape hatch while Home and article detail retain their established scroll ownership");
}

const mobileFocusRevealContract = windowAfter(mobileShellJs, "function focusRevealBoundary", 18000);
if (!mobileFocusRevealContract
  || !mobileShellJs.includes('const FOCUS_REVEAL_KEY = "mobile-shell:focus-reveal"')
  || !hasPattern(mobileFocusRevealContract, /const\s+accountPopover\s*=\s*target\.closest\(\s*["']#account-popover["']\s*\)[\s\S]*!accountPopover\.hidden[\s\S]*return\s+accountPopover[\s\S]*route\s*===\s*["']home["'][\s\S]*return\s+null/)
  || !hasPattern(mobileFocusRevealContract, /function\s+nearestVerticalScrollOwner[\s\S]*getComputedStyle\(node\)\.overflowY[\s\S]*scrollHeight\s*>\s*node\.clientHeight/)
  || !hasPattern(mobileFocusRevealContract, /function\s+contextElementsForFocus[\s\S]*#chat-message-input[\s\S]*#chat-private-password[\s\S]*#knowledge-search-input[\s\S]*\.account-actions[\s\S]*#transfer-room-password[\s\S]*#transfer-text-input/)
  || !hasPattern(mobileFocusRevealContract, /function\s+measureFocusReveal[\s\S]*target\.getBoundingClientRect\(\)[\s\S]*owner\.getBoundingClientRect\(\)[\s\S]*framePipeline\.snapshot\(\)\.viewport[\s\S]*viewport\.visualHeight/)
  || !hasPattern(mobileFocusRevealContract, /const\s+visualTop\s*=[\s\S]*viewport\.offsetTop[\s\S]*const\s+visualBottom\s*=\s*visualTop\s*\+\s*visualHeight/)
  || !hasPattern(mobileFocusRevealContract, /function\s+mutateFocusReveal[\s\S]*measurement\.owner\.scrollTop\s*=\s*measurement\.nextScrollTop/)
  || !hasPattern(mobileFocusRevealContract, /framePipeline\.schedule\(FOCUS_REVEAL_KEY,\s*\{[\s\S]*measure:\s*measureFocusReveal[\s\S]*mutate:\s*mutateFocusReveal/)
  || !hasPattern(mobileFocusRevealContract, /function\s+requestFocusReveal\(reason\s*=\s*["']manual["']\)[\s\S]*framePipeline\.requestViewport[\s\S]*setFocusRevealTarget\(document\.activeElement/)
  || !hasPattern(mobileFocusRevealContract, /scheduleFocusReveal\(\s*["']viewport["']\s*\)/)
  || !hasPattern(mobileShellJs, /document\.addEventListener\(\s*["']focusin["']\s*,\s*handleFocusIn\s*,\s*\{\s*capture:\s*true\s*\}\s*\)[\s\S]*document\.addEventListener\(\s*["']focusout["']\s*,\s*handleFocusOut\s*,\s*\{\s*capture:\s*true\s*\}\s*\)/)
  || mobileFocusRevealContract.includes("scrollIntoView(")) {
  fail("mobile focus recovery must use the keyed frame pipeline and mutate only the nearest real vertical scroll owner's scrollTop");
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
  "/js/mobile-shell.js",
  "/js/ui-motion.js",
  "/js/main.js",
  "/js/telemetry.js"
]) {
  if (!hasVersionedAssetReference(indexHtml, asset)) {
    fail(`index.html ${asset} reference is missing a cache-busting query`);
  }
}

const premiumUiVersion = "20260711-calm-motion-r13";
const mobileTransferUiVersion = "20260717-mobile-transfer-send-r3";
const themeA11yFoundationVersion = "20260718-theme-a11y-foundation-r1";
const focusPopoverCaretVersion = "20260718-focus-popover-caret-r1";
const knowledgeHistoryVersion = "20260718-knowledge-history-r1";
const routeMetaModalVersion = "20260718-route-meta-modal-r1";
const routeLifecycleVersion = "20260718-route-lifecycle-r1";
const routeLifecycleCssVersion = "20260718-route-lifecycle-css-r1";
const framePipelineVersion = "20260718-frame-pipeline-low-r1";
const framePipelineCssVersion = "20260718-frame-pipeline-low-css-r1";
const mobileScrollRecoveryVersion = "20260718-mobile-scroll-recovery-r1";
const mobileScrollRecoveryCssVersion = "20260718-mobile-scroll-recovery-css-r1";
const mobileViewportKeyboardVersion = "20260718-mobile-viewport-keyboard-r1";
const mobileViewportKeyboardCssVersion = routeLazyVersion;
const publicModulesVersion = "20260726-security-reliability-r1";
const transferLazyVersion = transferReleaseVersion;
const currentPreFinalMainVersion = "20260711-japanese-subtext-v102-r2";
const currentMainVersion = whiteboardReleaseVersion;
const currentCssVersion = trustSafetyStatusVersion;
const currentPreFinalTelemetryVersion = "20260802-traffic-budget-r1";
const currentGameShellVersion = "20260726-game-network-resilience-r1";
const currentADarkRoomMobileVersion = "20260726-a-dark-room-mobile-r2";
const currentLifeRestartMobileTouchVersion = "20260726-life-mobile-touch-r1";

for (const asset of [
  "/js/mobile-shell.js",
  "/js/ui-motion.js"
]) {
  const versions = assetQueryVersions(indexHtml, asset);
  if (versions.length !== 1 || versions[0] !== publicModulesVersion) {
    fail(`index.html ${asset} query should appear once as ${publicModulesVersion}`);
  }
}

const mainVersions = assetQueryVersions(indexHtml, "/js/main.js");
if (mainVersions.length !== 1 || mainVersions[0] !== currentMainVersion) {
  fail(`index.html /js/main.js query should appear once as ${currentMainVersion}`);
}

const styleVersions = assetQueryVersions(indexHtml, "/css/style.css");
if (styleVersions.length !== 1 || styleVersions[0] !== currentCssVersion) {
  fail(`index.html /css/style.css query should appear once as ${currentCssVersion}`);
}

const mobileShellStyleVersions = assetQueryVersions(indexHtml, "/css/mobile-ios-shell.css");
if (mobileShellStyleVersions.length !== 1 || mobileShellStyleVersions[0] !== knowledgeReaderVersion) {
  fail(`index.html /css/mobile-ios-shell.css query should appear once as ${knowledgeReaderVersion}`);
}

const motionCssVersions = assetQueryVersions(indexHtml, "/css/motion-system.css");
if (motionCssVersions.length !== 1 || motionCssVersions[0] !== mobileViewportKeyboardCssVersion) {
  fail(`index.html /css/motion-system.css query should appear once as ${mobileViewportKeyboardCssVersion}`);
}

if (countLiteral(quickTransferLoaderJs, transferLazyVersion) !== 1) {
  fail(`Quick Transfer lazy assets should consistently use ${transferLazyVersion}`);
}

for (const theme of ["morning", "day", "dusk", "night"]) {
  const reducedFallback = styleCss.lastIndexOf(`wallpapers/${theme}.png?v=20260612-hd-wallpapers`);
  const optimized960 = styleCss.lastIndexOf(`wallpapers/optimized/${theme}-960.webp`);
  const optimized1440 = styleCss.lastIndexOf(`wallpapers/optimized/${theme}-1440.webp`);
  const optimized1920 = styleCss.lastIndexOf(`wallpapers/optimized/${theme}-1920.webp`);
  if (reducedFallback < 0 || optimized960 <= reducedFallback || optimized1440 <= optimized960 || optimized1920 <= optimized1440
    || !styleCss.includes(`wallpapers/optimized/${theme}-960.avif`)
    || !styleCss.includes(`wallpapers/optimized/${theme}-1440.avif`)
    || !styleCss.includes(`wallpapers/optimized/${theme}-1920.avif`)) {
    fail(`prefers-reduced-motion ${theme} wallpaper must keep PNG only as fallback and override it with ordered 960/1440/1920 AVIF/WebP image-set sources`);
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
  if (!html.includes(`../game-shell.css?v=${currentGameShellVersion}`)) {
    fail(`${file} game-shell.css query should be ${currentGameShellVersion}`);
  }
}

for (const asset of [
  "script/lusu-localization-overrides.js",
  "script/engine.js",
  "script/path.js",
  "css/lusu-mobile.css"
]) {
  const versions = assetQueryVersions(aDarkRoomSourceHtml, asset);
  if (versions.length !== 1 || versions[0] !== currentADarkRoomMobileVersion) {
    fail(`games/a-dark-room/source/index.html ${asset} query should appear once as ${currentADarkRoomMobileVersion}`);
  }
}

for (const asset of [
  "./assets/index-ZpiTsTqN.js",
  "./lusu-mobile-touch.js"
]) {
  const versions = assetQueryVersions(lifeRestartSourceHtml, asset);
  if (versions.length !== 1 || versions[0] !== currentLifeRestartMobileTouchVersion) {
    fail(`games/life-restart/source/index.html ${asset} query should appear once as ${currentLifeRestartMobileTouchVersion}`);
  }
}
if (
  !hasPattern(lifeRestartMobileTouchJs, /const\s+MIN_TOUCH_TARGET_PX\s*=\s*44/)
  || !hasPattern(lifeRestartMobileTouchJs, /matchMedia\("\(pointer:\s*coarse\)"\)/)
  || !hasPattern(lifeRestartMobileTouchJs, /new\s+Laya\.Rectangle/)
  || !hasPattern(lifeRestartMobileTouchJs, /node\.name\s*===\s*"btnRemake"\s*\|\|\s*node\.name\s*===\s*"btnAgain"/)
  || !hasPattern(lifeRestartMobileTouchJs, /MAIN_BUTTON_MIN_WIDTH_PX\s*\/\s*scaleX/)
  || !hasPattern(lifeRestartMobileTouchJs, /MIN_TOUCH_TARGET_PX\s*\/\s*scaleY/)
  || !hasPattern(lifeRestartMobileTouchJs, /saveButton[\s\S]*themeButton[\s\S]*centerNodeAt/)
  || !lifeRestartMobileTouchJs.includes(currentLifeRestartMobileTouchVersion)
) {
  fail("Life Restart mobile canvas controls should keep the coarse-pointer 44px touch-target contract");
}
if (/stage\.scaleMode\s*=/.test(lifeRestartMobileTouchJs)) {
  fail("Life Restart mobile touch patch should not change the desktop canvas scale mode");
}

if (kittensBuildVersion.buildRevision !== 4) {
  fail("games/kittens-game/source/build.version.json buildRevision should be 4 for the embedded mobile/privacy release");
}
if (!kittensSourceIndexHtml.includes("res/lusu-embedded.css?v=20260726-mobile-r3")) {
  fail("Kittens embedded mobile CSS query should be 20260726-mobile-r3");
}
if (
  kittensSourceIndexHtml.indexOf("syncEarlyDocumentLanguage")
    >= kittensSourceIndexHtml.indexOf('src="lib/react.min.js"')
  || !hasPattern(kittensSourceIndexHtml, /zh:\s*"zh-CN"[\s\S]*en:\s*"en"[\s\S]*ja:\s*"ja"[\s\S]*document\.documentElement\.lang\s*=\s*languageMap\[storedLanguage\]\s*\|\|\s*"en"/)
) {
  fail("Kittens embedded page should set zh-CN/en/ja document lang from shell storage before loading libraries");
}
if (/googletagmanager|google-analytics|localhost:7780/i.test(kittensSourceIndexHtml)) {
  fail("Kittens embedded page should omit analytics and localhost bridge references");
}
if (
  !hasPattern(kittensSourceIndexHtml, /var\s+loadedThemes\s*=\s*Object\.create\(null\)[\s\S]*function\s+loadActiveTheme[\s\S]*new\s+MutationObserver\(loadActiveTheme\)[\s\S]*def\.then\(watchThemeSelection\)/)
  || /for\s*\([^)]*schemes\.length[\s\S]*loadTheme\(schemes\[i\]/.test(kittensSourceIndexHtml)
  || !hasPattern(kittensSourceGameJs, /toggleScheme:\s*function\(themeId\)[\s\S]*window\.loadTheme\(themeId,\s*window\.buildRevision\s*\|\|\s*Date\.now\(\)\)/)
) {
  fail("Kittens themes should load only the active selection and lazy-load later switches");
}
if (kittensThemeFiles.length !== 27) {
  fail(`Kittens embedded source should keep all 27 selectable themes, found ${kittensThemeFiles.length}`);
}
for (const themeFile of kittensThemeFiles) {
  const themeCss = readRequired(`games/kittens-game/source/res/${themeFile}`);
  if (/^\s*@import\s+url\(["']?https?:\/\//im.test(themeCss)) {
    fail(`games/kittens-game/source/res/${themeFile} should not import an external stylesheet`);
  }
}
if (
  /localhost:7780/.test(kittensSourceGameJs)
  || !hasPattern(kittensSourceGameJs, /isRemoteDisabled:\s*function[\s\S]*disableKgnet[\s\S]*_xhr:\s*function[\s\S]*this\.isRemoteDisabled\(\)[\s\S]*\$\.Deferred\(\)\.resolve\(null\)/)
  || !hasPattern(kittensSourceToolbarJs, /WLogin\s*=\s*React\.createClass[\s\S]*disableKgnet[\s\S]*return\s+null/)
) {
  fail("Kittens embedded KGNet bridge should remain disabled without touching local saves");
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
  ".category-button .filter-count",
  ".game-empty-state",
  ".resource-pending-action",
  ".about-social-link[hidden]"
]) {
  if (!styleCss.includes(token)) {
    fail(`css/style.css missing ${token}`);
  }
}
if (!lazyRouteCssSources.knowledge.includes(".knowledge-searchbar input")) {
  fail("css/routes/knowledge.css missing .knowledge-searchbar input");
}
if (!hasPattern(lazyRouteCssSources.knowledge, /\.knowledge-searchbar\s+input\s*\{[^}]*font-size:\s*16px/)
  || !hasPattern(lazyRouteCssSources.knowledge, /\.article-card-cta\s*\{[^}]*justify-self:\s*start[^}]*min-width:\s*88px/)
  || !hasPattern(lazyRouteCssSources.knowledge, /\.article-card-skeleton\s*\{[^}]*min-height:\s*154px/)) {
  fail("css/routes/knowledge.css should keep search zoom-safe, article CTAs compact, and loading skeleton geometry stable");
}

if (!styleCss.includes(':where(input, textarea, [contenteditable]:not([contenteditable="false"]))')
  || !hasPattern(windowAfter(styleCss, ':where(input, textarea, [contenteditable]:not([contenteditable="false"]))', 140), /caret-color:\s*auto/)) {
  fail("css/style.css should restore the browser caret for every editable main-site control with a zero-specificity rule");
}

if (hasPattern(styleCss, /(?:^|\})\s*(?:html|body|\*)\b[^\{]*\{[^\}]*caret-color:\s*transparent/im)) {
  fail("css/style.css must not hide the caret through html, body, or universal-selector inheritance");
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
  "repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.24) 0 2px",
  "inset -18px 0 16px rgba(30, 91, 197, 0.18)",
  "transition-delay: 0s !important",
  "transition-duration: 1ms !important",
  "@media (max-width: 460px)",
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
  "background-image: url(\"../assets/images/icon-videos.png?v=20260718-resource-icons-layout-r1\")",
  "background-image: url(\"../assets/images/icon-knowledge.png?v=20260718-resource-icons-layout-r1\")",
  "background-image: url(\"../assets/images/icon-games.png?v=20260718-resource-icons-layout-r1\")",
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

// OPT-097: keep the public security/privacy boundary independent from visual QA.
// Content/data modules intentionally contain prose that names unsafe APIs, so only
// executable public runtime modules participate in the DOM-sink scan.
const publicSecurityRuntimeSources = [
  ...publicModuleGraph.files
    .filter((file) => !file.startsWith("js/data/"))
    .map((file) => [file, publicModuleSources[file]]),
  ["js/mobile-shell.js", mobileShellJs],
  ["js/ui-motion.js", uiMotionJs],
  ["js/transfer.js", transferJs],
  ["js/telemetry.js", telemetryJs],
  ["games/game-shell.js", gameShellJs]
];
const unsafePublicDomSink = /\b(?:innerHTML|outerHTML|insertAdjacentHTML|setHTMLUnsafe|createContextualFragment)\b|document\.write\s*\(|\beval\s*\(|\bnew\s+Function\s*\(/;
for (const [file, source] of publicSecurityRuntimeSources) {
  if (unsafePublicDomSink.test(source)) {
    fail(`${file} must keep user/external content on safe DOM APIs`);
  }
}

const chatroomModuleJs = publicModuleSources["js/routes/chatroom.mjs"];
const accountModuleJs = publicModuleSources["js/features/account.mjs"];
const knowledgeModuleJs = publicModuleSources["js/routes/knowledge.mjs"];
const videosModuleJs = publicModuleSources["js/routes/videos.mjs"];
const resourcesModuleJs = publicModuleSources["js/routes/resources.mjs"];
const quickTransferModuleVersions = assetQueryVersions(resourcesModuleJs, "../features/quick-transfer-loader.mjs");
if (quickTransferModuleVersions.length !== 1 || quickTransferModuleVersions[0] !== transferLazyVersion) {
  fail(`js/routes/resources.mjs Quick Transfer loader query should appear once as ${transferLazyVersion}`);
}
for (const [file, source, token] of [
  ["js/routes/chatroom.mjs", chatroomModuleJs, 'name.textContent = String(message.nickname || "")'],
  ["js/routes/chatroom.mjs", chatroomModuleJs, 'bubble.textContent = String(message.content || "")'],
  ["js/features/account.mjs", accountModuleJs, 'refs.signedEmail.textContent = t("accountLoggedIn")'],
  ["js/routes/knowledge.mjs", knowledgeModuleJs, "parent.appendChild(document.createTextNode(part))"]
]) {
  if (!source.includes(token)) {
    fail(`${file} missing safe text rendering contract ${token}`);
  }
}
if (!hasPattern(knowledgeModuleJs, /function\s+rebuildArticleSearchIndex[\s\S]*articleState\.searchIndex\s*=\s*new Map[\s\S]*function\s+handleKnowledgeSearchInput[\s\S]*setTimeout\([\s\S]*},\s*120\)/)
  || !hasPattern(knowledgeModuleJs, /function\s+renderArticleCollection[\s\S]*items\.slice\(0,\s*visibleCount\)[\s\S]*dataset\.articleLoadMore[\s\S]*function\s+showMoreArticles[\s\S]*articleState\.visibleCount\s*=\s*previousCount\s*\+\s*12[\s\S]*\.focus\(\{\s*preventScroll:\s*true\s*\}\)/)
  || !hasPattern(knowledgeModuleJs, /articleState\.loading\s*&&\s*!articleState\.articles\.length[\s\S]*renderArticleSkeletons[\s\S]*articleState\.error\s*&&\s*!articleState\.articles\.length[\s\S]*articleRefreshFailed/)
  || hasPattern(knowledgeModuleJs, /catch\s*\(error\)[\s\S]{0,500}articleState\.articles\s*=\s*\[\]/)
  || !hasPattern(knowledgeModuleJs, /while\s*\(articleState\.detailCache\.size\s*>\s*12\)/)) {
  fail("js/routes/knowledge.mjs should debounce indexed search, segment the list, retain last-known-good results, and cap detail cache growth");
}

const hiddenVisitorFallbackPattern = /coalesce\(nullif\(client_id,\s*['"]{2}\),\s*visitor_id\)\s+as\s+visitor_id/gi;
const safePublicVisitorAliasPattern = /coalesce\(nullif\(client_id,\s*['"]{2}\),\s*['"]{2}\)\s+as\s+visitor_id/gi;
if (hiddenVisitorFallbackPattern.test(apiJs)
  || [...apiJs.matchAll(safePublicVisitorAliasPattern)].length < 2) {
  fail("public Chat queries must expose only the frontend client_id and use an empty legacy fallback, never the hidden server visitor_id");
}
const postChatMessageBlock = objectBlockAfterMarker(apiJs, "function postChatMessage");
if (!postChatMessageBlock.includes("visitor_id: clientId")) {
  fail("public Chat send responses must expose only the submitted frontend client id");
}
const encryptedChatNormalizerBlock = objectBlockAfterMarker(apiJs, "function normalizeChatEncryptedContent");
if (!hasPattern(encryptedChatNormalizerBlock, /String\(plainContent \|\| ["']{2}\)\.trim\(\)[\s\S]*throw new HttpError\(["']\u5bc6\u7801\u623f\u53ea\u63a5\u6536\u52a0\u5bc6\u6d88\u606f\u3002["']/)) {
  fail("private Chat API must keep rejecting plaintext content");
}

const sensitiveSideChannelPattern = /\b(?:pushState|replaceState|lusuTrackClick)\b|console\.(?:log|info|warn|error|debug)\s*\(/;
for (const [file, source] of [
  ["js/features/account.mjs", accountModuleJs],
  ["js/routes/chatroom.mjs", chatroomModuleJs]
]) {
  if (sensitiveSideChannelPattern.test(source) || /\b(?:localStorage|sessionStorage)\b/.test(source)) {
    fail(`${file} must not persist, history-store, log, or telemetry-track account/Chat sensitive values`);
  }
}
const telemetryTargetDescriptorBlock = objectBlockAfterMarker(telemetryJs, "function targetDescriptor");
if (!telemetryTargetDescriptorBlock
  || /element\.(?:value|innerText|textContent|title)\b|getAttribute\(["']aria-label["']\)/.test(telemetryTargetDescriptorBlock)) {
  fail("automatic telemetry must not read input values, visible drafts, titles, or aria-label text");
}
if (chatroomModuleJs.includes("lusuTrackClick")
  || accountModuleJs.includes("lusuTrackClick")
  || transferJs.includes("lusuTrackClick")) {
  fail("account, Chat, and Quick Transfer must not send password, private-room, or draft material to telemetry");
}
const transferTaskPersistenceBlock = objectBlockAfterMarker(transferJs, "function saveTasks");
if (!transferTaskPersistenceBlock
  || /\b(?:password|passphrase|cryptoKey|encryptedContent|draft|textInput|roomPassword)\b/i.test(transferTaskPersistenceBlock)) {
  fail("Quick Transfer resumability storage must not contain passphrases, crypto keys, encrypted text, or composer drafts");
}
for (const [label, block] of [
  ["private Chat entry", objectBlockAfterMarker(chatroomModuleJs, "function enterChatPrivateRoom")],
  ["private/public Chat submit", objectBlockAfterMarker(chatroomModuleJs, "function submitChatMessage")],
  ["account submit", objectBlockAfterMarker(accountModuleJs, "function submitAccountForm")],
  ["Quick Transfer room entry", objectBlockAfterMarker(transferJs, "function joinRoom")],
  ["Quick Transfer composer", objectBlockAfterMarker(transferJs, "function sendComposer")]
]) {
  if (!block || sensitiveSideChannelPattern.test(block)) {
    fail(`${label} must not copy sensitive material into history, logs, or telemetry`);
  }
}
if (!hasPattern(chatroomModuleJs, /function hideChatPrivateRoomForm[\s\S]{0,700}?input\.value = ["']{2}/)
  || !hasPattern(transferJs, /function joinRoom[\s\S]{0,900}?deriveRoom\(password\)[\s\S]{0,500}?refs\.roomPassword\.value = ["']{2}/)) {
  fail("Chat and Quick Transfer passphrase fields must be cleared after use/close");
}

for (const token of [
  'const trustedResourceExternalHosts = new Set(["github.com", "www.github.com", "raw.githubusercontent.com", "gist.github.com"])',
  'const trustedGameExternalHosts = new Set(["github.com", "www.github.com", "github.io"])',
  'return url.protocol === "https:" && hostMatches(url.hostname, allowedHosts) ? url.href : ""'
]) {
  if (!mainEntryJs.includes(token)) {
    fail(`js/main.js missing external allowlist boundary ${token}`);
  }
}
for (const token of [
  'const isYoutube = host === "youtube.com" && parsed.pathname.startsWith("/embed/")',
  'const isBilibili = host === "player.bilibili.com" && parsed.pathname === "/player.html"',
  'iframe.referrerPolicy = "strict-origin-when-cross-origin"',
  'sourceLink.rel = "noreferrer noopener"'
]) {
  if (!videosModuleJs.includes(token)) {
    fail(`js/routes/videos.mjs missing iframe/external-link allowlist boundary ${token}`);
  }
}
for (const host of [
  "i.ytimg.com",
  "img.youtube.com",
  "i0.hdslb.com",
  "i1.hdslb.com",
  "i2.hdslb.com",
  "archive.biliimg.com"
]) {
  if (!videosModuleJs.includes(`"${host}"`)) {
    fail(`js/routes/videos.mjs thumbnail allowlist missing ${host}`);
  }
}
if (!resourcesModuleJs.includes("safeTrustedExternalUrl(value, trustedResourceExternalHosts)")) {
  fail("Resources external links must continue through the trusted-host allowlist");
}
for (const token of [
  'url.protocol !== "https:" || !["github.com", "www.github.com"].includes(url.hostname.toLowerCase())',
  '!/^source\\/[a-z0-9][a-z0-9._/-]*\\.html$/i.test(entry)'
]) {
  if (!gameShellJs.includes(token)) {
    fail(`games/game-shell.js missing local-frame/repository allowlist boundary ${token}`);
  }
}
for (const token of [
  'const FRAGMENT_CANONICAL_PATH = "/fragments/quick-transfer"',
  "responseUrl.origin === pageUrl.origin",
  "ALLOWED_FRAGMENT_PATHS.includes(responseUrl.pathname)",
  'root.querySelector("script, style, link, meta, base, iframe, object, embed, svg, math")',
  '/^(?:src|srcdoc|href|action|formaction|xlink:href)$/i.test(attribute.name)'
]) {
  if (!quickTransferLoaderJs.includes(token)) {
    fail(`Quick Transfer fragment loader missing local/executable-content guard ${token}`);
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
  "function createField",
  'label.htmlFor = `account-${name}`',
  'refs.form.dataset.accountMode = accountMode',
  'dataset: { accountMode: "login" }',
  'dataset: { accountMode: "register" }',
  'dataset: { accountSubmit: "" }',
  "function normalizeAccountMode",
  "accountConfirmPasswordLabel",
  "accountPasswordToggle",
  "function setAccountSubmitting",
  'toggle.setAttribute("aria-controls", "account-popover")',
  'toggle.setAttribute("aria-expanded", "false")',
  'popover.setAttribute("role", "group")',
  'popover.setAttribute("aria-labelledby", "account-popover-title")',
  'title.id = "account-popover-title"',
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
    /document\.createElement\(["']a["']\)[\s\S]*card\.dataset\.articleSlug\s*=\s*item\.slug[\s\S]*title\.id\s*=\s*`knowledge-article-title-\$\{itemIndex\}`[\s\S]*card\.setAttribute\(\s*["']aria-labelledby["']\s*,\s*title\.id\s*\)[\s\S]*article-card-cta[\s\S]*aria-hidden/,
    "js/routes/knowledge.mjs articleCardElement should expose one whole-card article link named by its article-language title and keep the current-language compact CTA decorative"
  ],
  [
    "function videoCardElement",
    /const\s+videoTitleText\s*=\s*item\.title\s*\|\|\s*videoUiText\(["']untitled["']\)[\s\S]*const\s+videoPlayLabel\s*=\s*`\$\{videoUiText\(["']playAria["']\)\}:\s*\$\{videoTitleText\}`[\s\S]*thumb\s*=\s*document\.createElement\(["']button["']\)[\s\S]*thumb\.type\s*=\s*["']button["'][\s\S]*thumb\.dataset\.videoId\s*=\s*item\.video_id[\s\S]*thumb\.setAttribute\(\s*["']aria-label["']\s*,\s*videoPlayLabel\s*\)[\s\S]*button\.setAttribute\(\s*["']aria-label["']\s*,\s*videoPlayLabel\s*\)/,
    "js/routes/videos.mjs videoCardElement should expose a titled native thumbnail button and a titled card action"
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
    /const\s+isError\s*=\s*kind\s*===\s*["']error["'][\s\S]*node\.setAttribute\(\s*["']role["']\s*,\s*isError\s*\?\s*["']alert["']\s*:\s*["']status["']\s*\)[\s\S]*node\.setAttribute\(\s*["']aria-live["']\s*,\s*isError\s*\?\s*["']assertive["']\s*:\s*["']polite["']\s*\)[\s\S]*node\.setAttribute\(\s*["']aria-atomic["']\s*,\s*["']true["']\s*\)/,
    "js/main.js markStatusMessage should distinguish atomic errors from polite status messages"
  ],
  [
    "function renderListMessage",
    /stateKind\s*=\s*action\?\.state\s*===\s*["']error["'][\s\S]*state\.className\s*=\s*`content-state\s+is-\$\{stateKind\}`[\s\S]*markStatusMessage\(state,\s*stateKind\s*===\s*["']error["']\s*\?\s*["']error["']\s*:\s*["']status["']\)[\s\S]*state\.appendChild\(button\)[\s\S]*list\.replaceChildren\(state\)/,
    "js/routes/knowledge.mjs renderListMessage should distinguish error and empty live semantics"
  ],
  [
    "function renderVideoStatusState",
    /markStatusMessage\(copy,\s*kind\s*===\s*["']failed["']\s*\?\s*["']error["']\s*:\s*["']status["']\)/,
    "js/routes/videos.mjs renderVideoStatusState should expose failures as alerts and loading as status"
  ],
  [
    "async function renderGames",
    /markStatusMessage\(loading\)[\s\S]*renderGameCatalog\(list,\s*catalog\)[\s\S]*markStatusMessage\(failed,\s*["']error["']\)/,
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
    /gameState\.catalog\s*&&\s*!forceRefresh[\s\S]*renderGameCatalog\(list,\s*gameState\.catalog\)[\s\S]*loadGameCatalog\(\s*\{\s*forceRefresh,\s*signal\s*\}\s*\)[\s\S]*renderGameCatalog\(list,\s*catalog\)/,
    "js/main.js renderGames should reuse cached games unless a retry forces refresh"
  ],
  [
    "function renderArticleDetailFailure",
    /syncDocumentMeta\(\)[\s\S]*title\.textContent\s*=\s*t\(["']articleLoadFailed["']\)[\s\S]*state\.className\s*=\s*["']content-state is-error["'][\s\S]*markStatusMessage\(state,\s*["']error["']\)[\s\S]*action\.dataset\.articleDetailRetry\s*=\s*slug[\s\S]*state\.append\(note,\s*action\)[\s\S]*body\.replaceChildren\(state\)/,
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
    /return\s+requestJson\(\s*["']knowledge["'],\s*path,\s*\{[\s\S]*force:\s*options\.force\s*===\s*true[\s\S]*maxAgeMs:[\s\S]*staleWhileRevalidate:\s*options\.force\s*!==\s*true[\s\S]*onRevalidated:\s*options\.onRevalidated/,
    "js/routes/knowledge.mjs articleApi should use the shared ETag/SWR cache with explicit force and revalidation controls"
  ],
  [
    "async function loadArticles",
    /articleState\.detailCache\.clear\(\)[\s\S]*articleState\.articles\s*=\s*sortKnowledgeArticles\(visiblePublicArticles\(result\.data\?\.articles\s*\|\|\s*\[\]\)\)[\s\S]*rebuildArticleSearchIndex\(\)/,
    "js/routes/knowledge.mjs loadArticles should clear stale details, enforce pinned/date order, and rebuild the normalized search index"
  ],
  [
    "const routeMetaConfig",
    /home:[\s\S]*knowledge:[\s\S]*videos:[\s\S]*resources:[\s\S]*games:[\s\S]*blog:[\s\S]*chatroom:[\s\S]*about:/,
    "js/main.js routeMetaConfig should cover all eight public routes"
  ],
  [
    "function canonicalSiteUrl",
    /routeMetaConfig\[route\][\s\S]*\["zh",\s*"en",\s*"ja"\]\.includes\(lang\)[\s\S]*#\$\{normalizedRoute\}[\s\S]*https:\/\/lusu575\.com\/\?lang=\$\{normalizedLang\}/,
    "js/main.js canonicalSiteUrl should whitelist routes and languages while projecting route hashes"
  ],
  [
    "function applyDocumentMeta",
    /document\.title[\s\S]*link\[rel="canonical"\][\s\S]*meta\[name="description"\][\s\S]*og:type[\s\S]*og:site_name[\s\S]*og:title[\s\S]*og:description[\s\S]*og:url[\s\S]*og:image[\s\S]*og:image:width[\s\S]*og:image:height[\s\S]*og:image:alt[\s\S]*og:locale[\s\S]*twitter:card[\s\S]*twitter:title[\s\S]*twitter:description[\s\S]*twitter:image[\s\S]*twitter:image:alt/,
    "js/main.js applyDocumentMeta should atomically write canonical, Open Graph, and Twitter fields"
  ],
  [
    "function syncDocumentMeta",
    /routeMetaConfig\[normalizedRoute\][\s\S]*translatedText\(normalizedLang,\s*config\.titleKey\)[\s\S]*translatedText\(normalizedLang,\s*config\.descriptionKey\)[\s\S]*applyDocumentMeta\(\{[\s\S]*canonicalSiteUrl\(normalizedRoute,\s*normalizedLang\)[\s\S]*type:\s*["']website["']/,
    "js/main.js syncDocumentMeta should derive complete route-specific website metadata"
  ],
  [
    "function articleShareImageDescriptor",
    /safeArticleImageSrc\(article\?\.cover_image\s*\|\|\s*["']["']\)[\s\S]*https:\/\/lusu575\.com\/\$\{safeCover\}[\s\S]*width:\s*["']["'][\s\S]*defaultShareImageSize\.width[\s\S]*metaShareImageAlt/,
    "js/main.js articleShareImageDescriptor should only use safe covers and clear unknown cover dimensions"
  ],
  [
    "function syncArticleDocumentMeta",
    /articleRouteHref\(article\?\.slug\s*\|\|\s*articleState\.currentSlug,\s*currentLang\)[\s\S]*articleShareImageDescriptor\(article,\s*articleTitle\)[\s\S]*applyDocumentMeta\(\{[\s\S]*type:\s*["']article["'][\s\S]*imageUrl:\s*image\.url[\s\S]*localeByLanguage/,
    "js/main.js syncArticleDocumentMeta should write article title, canonical, and share metadata"
  ],
  [
    "async function loadArticleDetail",
    /clearArticleCopyStatus\(\)[\s\S]*syncDocumentMeta\(\)[\s\S]*title\.textContent\s*=\s*t\(["']articleLoading["']\)/,
    "js/main.js loadArticleDetail should clear stale article metadata before loading a new detail"
  ],
  [
    "function renderArticleToc",
    /articleTocHeadingSelector\(articleCategory\)[\s\S]*querySelectorAll\(selector\)[\s\S]*deduplicateArticleHeadingAnchors\([\s\S]*heading\.id\s*=\s*headingIds\[index\][\s\S]*heading\.dataset\.articleTocHeading[\s\S]*button\.setAttribute\(\s*["']aria-controls["']\s*,\s*id\s*\)[\s\S]*setActiveArticleTocHeading\(headings\[0\]\.heading\.id/,
    "js/routes/knowledge.mjs article TOC should create stable anchors and select Daily AI News story headlines"
  ],
  [
    "function setActiveArticleTocHeading",
    /button\.setAttribute\(\s*["']aria-current["']\s*,\s*["']location["']\s*\)[\s\S]*button\.removeAttribute\(\s*["']aria-current["']\s*\)/,
    "js/routes/knowledge.mjs article TOC active state should sync aria-current"
  ],
  [
    "function scrollToArticleHeading",
    /targetTop\s*=\s*Math\.max\([\s\S]*detail\.scrollTo\(\s*\{\s*top:\s*targetTop\s*,\s*behavior\s*\}\s*\)[\s\S]*heading\.focus\(\s*\{\s*preventScroll:\s*true\s*\}\s*\)[\s\S]*window\.history\.replaceState/,
    "js/routes/knowledge.mjs article TOC jumps should scroll only the article owner, focus the target, and project a shareable hash"
  ],
  [
    "function focusableDialogElements",
    /button:not\(\[disabled\]\)[\s\S]*iframe[\s\S]*\[tabindex\]:not\(\[tabindex='-1'\]\)[\s\S]*element\.getClientRects\(\)/,
    "js/main.js focusableDialogElements should collect visible focus targets inside dialogs"
  ],
  [
    "function activeModalDialog",
    /activeModalSurface\(\)\?\.querySelector\(\s*["']\[role='dialog'\]["']\s*\)\s*\|\|\s*null/,
    "js/main.js activeModalDialog should prefer the open video dialog, then welcome dialog"
  ],
  [
    "function activeModalSurface",
    /videoModal\s*&&\s*!videoModal\.hidden[\s\S]*welcomeModal\s*&&\s*!welcomeModal\.hidden/,
    "js/main.js activeModalSurface should deterministically prioritize video over welcome"
  ],
  [
    "function syncModalIsolation",
    /activeModalSurface\(\)[\s\S]*\[data-modal-background\][\s\S]*modalBackgroundOriginalInert\.has\(background\)[\s\S]*background\.inert\s*=\s*true[\s\S]*background\.inert\s*=\s*modalBackgroundOriginalInert\.get\(background\)[\s\S]*surface\.inert\s*=\s*Boolean\(activeSurface/,
    "js/main.js syncModalIsolation should own background inert and isolate any secondary modal"
  ],
  [
    "function restoreModalFocus",
    /usableModalFocusTarget\(target\)[\s\S]*activeModalSurface\(\)\?\.querySelector\([\s\S]*routeWindowFocusTarget\(document\.body\.dataset\.route[\s\S]*fallback\.focus/,
    "js/main.js restoreModalFocus should use the exact trigger, active dialog, then stable route heading"
  ],
  [
    "function trapDialogFocus",
    /event\.key\s*!==\s*["']Tab["'][\s\S]*focusableDialogElements\(dialog\)[\s\S]*!dialog\.contains\(active\)[\s\S]*event\.shiftKey\s*&&\s*active\s*===\s*first[\s\S]*!event\.shiftKey\s*&&\s*active\s*===\s*last/,
    "js/main.js trapDialogFocus should loop Tab and Shift+Tab inside the active dialog"
  ],
  [
    "async function ensureChatIdentity",
    /getAnonymousIdentity\(\{[\s\S]*fetcher:\s*identityFetch[\s\S]*chatState\.visitorId\s*=\s*anonymousClientPresenceId\(\)[\s\S]*chatState\.nickname\s*=\s*identity\.displayName[\s\S]*chatState\.identityColor\s*=\s*identity\.color/,
    "js/routes/chatroom.mjs should use the shared server-verified anonymous identity"
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
    /isSameRouteNoop[\s\S]*syncDocumentMeta\(currentLang,\s*nextRoute\)[\s\S]*commitNavigation[\s\S]*!\(nextRoute\s*===\s*["']knowledge["']\s*&&\s*options\.articleSlug\)[\s\S]*syncDocumentMeta\(currentLang,\s*nextRoute\)/,
    "js/main.js navigate should restore site metadata outside article detail routes"
  ],
  [
    "function renderArticleDetail(article)",
    /articleDetailShowsSummary\(article\.category\)[\s\S]*summary\.hidden\s*=\s*!showSummary[\s\S]*renderArticleToc\(article\.lang,\s*article\.category\)[\s\S]*scheduleArticleReadProgressUpdate\(\)[\s\S]*syncArticleDocumentMeta\(article\)/,
    "js/main.js renderArticleDetail should sync article document metadata after rendering"
  ],
  [
    "function setChatSendingState",
    /chatState\.sending\s*=\s*sending[\s\S]*form\?\.setAttribute\(\s*["']aria-busy["']\s*,\s*String\(sending\)\s*\)[\s\S]*button\.disabled\s*=\s*sending[\s\S]*options\.keepInputFocus\s*!==\s*false[\s\S]*input\.focus\(\{\s*preventScroll:\s*true\s*\}\)/,
    "js/main.js setChatSendingState should lock only duplicate submission while preserving the editable focused draft"
  ],
  [
    "function updateChatSyncStatus",
    /document\.getElementById\(\s*["']chat-sync-status["']\s*\)[\s\S]*status\.textContent\s*=\s*chatSyncStatusText\(delay\)/,
    "js/main.js updateChatSyncStatus should write the visible chat polling status by id"
  ],
  [
    "async function submitChatMessage",
    /if\s*\(\s*chatState\.sending\s*\)[\s\S]*setChatFeedbackKey\(["']chatSending["'][\s\S]*source:\s*["']send["'][\s\S]*submittedDraftRevision\s*=\s*chatState\.draftRevision[\s\S]*Date\.now\(\)\s*-\s*chatState\.lastSentAt\s*<\s*chatCooldownMs[\s\S]*setChatSendingState\(true,\s*\{\s*keepInputFocus:\s*true\s*\}\)[\s\S]*await\s+ensureChatIdentity\(\{\s*signal:[\s\S]*chatState\.draftRevision\s*===\s*submittedDraftRevision\s*&&\s*input\.value\s*===\s*submittedDraft[\s\S]*finally\s*\{[\s\S]*setChatSendingState\(false\)/,
    "js/main.js submitChatMessage should single-flight sends and clear only the untouched submitted draft"
  ],
  [
    "function openVideo",
    /const\s+sourceLabel\s*=\s*`\$\{t\(["']openOriginal["']\)\}:\s*\$\{videoTitle\}`[\s\S]*sourceLink\.setAttribute\(\s*["']aria-label["']\s*,\s*sourceLabel\s*\)[\s\S]*sourceLink\.setAttribute\(\s*["']title["']\s*,\s*sourceLabel\s*\)[\s\S]*sourceLink\.removeAttribute\(\s*["']aria-label["']\s*\)[\s\S]*sourceLink\.removeAttribute\(\s*["']title["']\s*\)/,
    "js/main.js openVideo should title the original source link with the current video title and clear stale labels"
  ],
  [
    "function openVideo",
    /modalOptions\s*=\s*options\s*&&\s*typeof\s+options\s*===\s*["']object["'][\s\S]*modalTriggerCandidate\(modalOptions\.trigger,\s*modal\)[\s\S]*modal\.hidden\s*=\s*false[\s\S]*syncModalIsolation\(\)[\s\S]*modal\.querySelector\(\s*["']button\[data-close-modal\]["']\s*\)\?\.focus\(\s*\{\s*preventScroll:\s*true\s*\}\s*\)/,
    "js/main.js openVideo should remember the explicit trigger, isolate the background, then focus Close"
  ],
  [
    "function closeVideo",
    /sourceLink\.removeAttribute\(\s*["']aria-label["']\s*\)[\s\S]*sourceLink\.removeAttribute\(\s*["']title["']\s*\)/,
    "js/main.js closeVideo should clear the original source link labels"
  ],
  [
    "function closeVideo",
    /const\s+wasOpen[\s\S]*modal\.hidden\s*=\s*true[\s\S]*syncModalIsolation\(\)[\s\S]*restoreModalFocus\(\s*["']videoTrigger["']\s*\)/,
    "js/main.js closeVideo should hide, release isolation, then restore the explicit trigger"
  ],
  [
    "function closeWelcome",
    /const\s+wasOpen[\s\S]*modal\.hidden\s*=\s*true[\s\S]*syncModalIsolation\(\)[\s\S]*restoreModalFocus\(\s*["']welcomeTrigger["']\s*\)/,
    "js/main.js closeWelcome should hide, release isolation, then restore focus"
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
    /navigate\(\s*parsed\.route\s*,\s*\{\s*updateUrl:\s*false,\s*articleSlug:\s*parsed\.articleSlug\s*\|\|\s*["']["']\s*,\s*focusWindow:\s*shouldFocusRoute\s*&&\s*!parsed\.articleSlug\s*\}\s*\)/,
    "js/main.js route syncing should preserve parsed article slugs before navigate clears stale detail state"
  ],
  [
    "function maybeShowWelcome",
    /modalTriggerCandidate\(document\.activeElement,\s*modal\)[\s\S]*modal\.hidden\s*=\s*false[\s\S]*syncModalIsolation\(\)[\s\S]*modal\.querySelector\(\s*["']button\[data-close-welcome\]["']\s*\)\?\.focus\(\s*\{\s*preventScroll:\s*true\s*\}\s*\)/,
    "js/main.js maybeShowWelcome should remember prior focus, isolate the background, then focus Close"
  ]
]) {
  requireFunctionPattern(mainJs, marker, pattern, message);
}

if (!hasPattern(mainJs, /requestJson:\s*cachedRouteJson/)
  || !hasPattern(mainJs, /requestJson\(\s*["']videos["'][\s\S]*staleWhileRevalidate:\s*options\.force\s*!==\s*true/)
  || !hasPattern(mainJs, /videoState\.loading\s*&&\s*!videoState\.videos\.length[\s\S]*renderVideoStatusState\(["']loading["']\)/)
  || !hasPattern(mainJs, /videoState\.error[\s\S]*renderVideoRecoveryNotice\(["']failed["']\)/)) {
  fail("Knowledge and Videos must consume the shared ETag/SWR route cache while preserving cold-load and stale-data recovery states");
}

const chatSendingStateContract = windowAfter(mainJs, "function setChatSendingState", 1400);
if (/input\.disabled\s*=\s*sending/.test(chatSendingStateContract)) {
  fail("js/routes/chatroom.mjs must not disable the composer or dismiss the soft keyboard while a send is in flight");
}

if (!hasPattern(mainJs, /const\s+routeButton[\s\S]*if\s*\(routeButton\)\s*\{[\s\S]*const\s+motionKind\s*=\s*routeButton\.matches\(\s*["']\.minimize-button["']\s*\)[\s\S]*["']window-minimize["'][\s\S]*routeButton\.matches\(\s*["']\.close-button["']\s*\)[\s\S]*["']window-close["'][\s\S]*navigate\(\s*routeButton\.dataset\.route\s*,\s*\{\s*trigger:\s*routeButton\s*,\s*motionKind\s*\}\s*\)\s*;\s*closeWelcome\(\s*\{\s*restoreFocus:\s*false\s*,\s*motion:\s*false\s*\}\s*\)/)) {
  fail("js/main.js route click branch should classify minimize/close motion, pass its trigger, and close welcome without restoring stale modal focus");
}

if (!hasPattern(mainJs, /const\s+routeIconRectCache\s*=\s*new\s+Map[\s\S]*function\s+measureRouteIconRects[\s\S]*document\.body\.dataset\.route\s*!==\s*["']home["'][\s\S]*function\s+storeRouteIconRects[\s\S]*routeIconRectCache\.set/)
  || !hasPattern(mainJs, /function\s+cachedRouteIconRect[\s\S]*cached\.shell[\s\S]*cached\.viewportWidth\s*!==\s*window\.innerWidth[\s\S]*cached\.viewportHeight\s*!==\s*window\.innerHeight/)
  || !hasPattern(mainJs, /function\s+routeExitOriginRect[\s\S]*motionKind\s*===\s*["']window-minimize["'][\s\S]*cachedRouteIconRect\(route\)[\s\S]*taskbar-tabs button\[data-route\][\s\S]*\.start-button/)
  || !hasPattern(mainJs, /function\s+navigate[\s\S]*const\s+exitOriginRect\s*=\s*isExitMotion[\s\S]*originRect:\s*exitOriginRect[\s\S]*deferCommit:\s*isExitMotion/)) {
  fail("js/main.js navigate should retain the route-icon/task-button geometry used to reverse close and minimize motion");
}

const routeWindowFocusBlock = windowAfter(mainJs, "function routeWindowFocusTarget", 900);
if (!hasPattern(routeWindowFocusBlock, /:scope\s*>\s*h1[\s\S]*heading\.tabIndex\s*=\s*-1[\s\S]*return\s+heading[\s\S]*:scope\s*>\s*\.xp-window[\s\S]*windowSurface\.tabIndex\s*=\s*-1[\s\S]*return\s+windowSurface/)
  || /querySelectorAll\([^\)]*(?:button|input|textarea|select|contenteditable)/i.test(routeWindowFocusBlock)) {
  fail("js/main.js automatic route focus should target the stable H1, with only the route window as fallback");
}

if (!hasPattern(mainJs, /const\s+shouldFocusWindow\s*=\s*\[[^\]]*["']route["'][^\]]*["']app-open["'][^\]]*["']mobile-tab["'][^\]]*["']window-close["'][^\]]*["']window-minimize["'][^\]]*\]\.includes\(motionKind\)[\s\S]*options\.focusWindow\s*!==\s*false[\s\S]*requestId\s*!==\s*navigationRequestId[\s\S]*document\.body\.dataset\.route\s*!==\s*nextRoute[\s\S]*routeWindowFocusTarget\(nextRoute\)[\s\S]*focusTarget\.focus/)) {
  fail("js/main.js committed route navigation should focus the stable route title and reject stale animation-frame focus");
}

if (!hasPattern(mainJs, /if\s*\(isSameRouteNoop\)[\s\S]*syncBrowserUrl\(\s*nextRoute,\s*nextRoute\s*===\s*["']knowledge["']\s*\?\s*options\.articleSlug\s*\|\|\s*["']["']\s*:\s*["']["']\s*,\s*options\.historyState\s*\)[\s\S]*options\.focusWindow\s*===\s*true[\s\S]*requestId\s*!==\s*navigationRequestId[\s\S]*routeWindowFocusTarget\(nextRoute\)/)
  || !hasPattern(mainJs, /function\s+syncRouteFromLocation\(options\s*=\s*\{\}\)[\s\S]*const\s+shouldFocusRoute\s*=\s*options\.focusWindow\s*===\s*true[\s\S]*focusWindow:\s*shouldFocusRoute\s*&&\s*!parsed\.articleSlug/)
  || !hasPattern(mainJs, /hashchange[\s\S]*syncRouteFromLocation\(\{\s*focusWindow:\s*true\s*\}\)[\s\S]*popstate[\s\S]*syncRouteFromLocation\(\{\s*focusWindow:\s*true\s*\}\)[\s\S]*syncRouteFromLocation\(\{\s*focusWindow:\s*false\s*\}\)/)) {
  fail("js/main.js history projection should focus route titles once while initial load preserves the skip-link-first tab order");
}

if (!hasPattern(mainJs, /const\s+publicHistoryStateKey\s*=\s*["']lusuPublicState["'][\s\S]*const\s+publicHistoryStateVersion\s*=\s*1/)
  || !hasPattern(mainJs, /function\s+normalizeKnowledgeHistorySnapshot[\s\S]*slice\(0,\s*200\)[\s\S]*boundedHistoryScrollTop/)
  || !hasPattern(mainJs, /function\s+publicHistoryStateFor[\s\S]*\.\.\.existingRoot[\s\S]*entryId:[\s\S]*knowledge:[\s\S]*articleScrollTop:[\s\S]*articleReturnMode:/)
  || !hasPattern(mainJs, /function\s+syncBrowserUrl[\s\S]*replaceEntry[\s\S]*history\.pushState\(nextState[\s\S]*history\.replaceState\(nextState/)
  || /history\.(?:pushState|replaceState)\(\s*null\b/.test(mainJs)) {
  fail("js/main.js public navigation history should use a bounded versioned state while preserving non-project state fields");
}

if (!hasPattern(mainJs, /function\s+showArticle\(slug[\s\S]*const\s+knowledgeSnapshot[\s\S]*replaceCurrentPublicHistoryState[\s\S]*articleState\.currentSlug\s*=\s*slug[\s\S]*articleReturnMode:\s*sourceIsKnowledgeList\s*\?\s*["']history["']\s*:\s*["']default["']/)
  || !hasPattern(mainJs, /function\s+showArticleList[\s\S]*articleReturnMode\s*===\s*["']history["'][\s\S]*window\.history\.back\(\)[\s\S]*defaultKnowledgeHistorySnapshot[\s\S]*replaceEntry:\s*true/)
  || !hasPattern(mainJs, /function\s+syncLanguageUrl[\s\S]*history\.replaceState\(window\.history\.state/)
  || !hasPattern(mainJs, /scrollRestoration\s*=\s*["']manual["']/)) {
  fail("js/main.js article list/history flow should capture its source, use Back only for source entries, and replace direct-link fallback entries");
}

if (!hasPattern(mainJs, /function\s+syncRouteFromLocation[\s\S]*historyMatchesLocation[\s\S]*activeFilters\.knowledge\s*=\s*knowledgeSnapshot\.category[\s\S]*articleState\.searchTerm\s*=\s*knowledgeSnapshot\.searchTerm[\s\S]*pendingListScrollTop[\s\S]*pendingDetailScrollTop[\s\S]*lastLocationProjectionKey\s*=\s*locationProjectionKey\(\)/)
  || !hasPattern(mainJs, /function\s+restorePendingKnowledgeScroll[\s\S]*knowledge-list[\s\S]*scrollTop\s*=\s*target/)
  || !hasPattern(mainJs, /scope\.listen\(list,\s*["']scroll["'],\s*schedulePublicHistoryStateSync,\s*\{\s*passive:\s*true\s*\}/)
  || !hasPattern(mainJs, /scope\.listen\(detail,\s*["']scroll["'],\s*handleArticleDetailScroll,\s*\{\s*passive:\s*true\s*\}/)
  || !hasPattern(mainJs, /function\s+handleArticleDetailScroll[\s\S]*scheduleArticleReadProgressUpdate\(\)[\s\S]*schedulePublicHistoryStateSync\(\)/)) {
  fail("js/main.js Knowledge history restoration should apply state before render and persist both list and article scroll positions");
}

if (!hasPattern(mainJs, /function\s+focusTargetIsVisible[\s\S]*element\.closest\(\s*["']\[hidden\]["']\s*\)[\s\S]*page\.classList\.contains\(\s*["']active["']\s*\)[\s\S]*const\s+hadInteractiveFocus[\s\S]*!hadInteractiveFocus\s*\|\|\s*focusTargetIsVisible\(activeElement\)[\s\S]*fallbackTarget\?\.focus/)) {
  fail("js/main.js navigation should recover focus from controls hidden by browser history or route projection");
}

if (!hasPattern(mainJs, /function\s+showArticle\(slug,\s*options\s*=\s*\{\}\)[\s\S]*focusDetailOnRender\s*=\s*true[\s\S]*trigger:\s*options\.trigger[\s\S]*focusWindow:\s*false[\s\S]*function\s+showArticleList\(options\s*=\s*\{\}\)[\s\S]*focusDetailOnRender\s*=\s*false[\s\S]*trigger:\s*options\.trigger[\s\S]*focusWindow:\s*true/)
  || !hasPattern(mainJs, /function\s+focusArticleDetailTitle[\s\S]*focusDetailOnRender[\s\S]*detailFocusReady[\s\S]*article-detail-title[\s\S]*articleState\.currentSlug\s*===\s*pendingSlug[\s\S]*title\.focus/)
  || !hasPattern(mainJs, /showArticle\(articleButton\.dataset\.articleSlug,\s*\{\s*trigger:\s*articleButton\s*\}\)[\s\S]*showArticleList\(\{\s*trigger:\s*articleBackButton\s*\}\)/)) {
  fail("js/main.js article detail and list projections should focus their newly revealed title exactly after it is ready");
}

if (!hasPattern(mainJs, /function\s+openAccountPopover[\s\S]*popover\.hidden\s*=\s*false[\s\S]*syncAccountPopoverState\(popover\)/)
  || !hasPattern(mainJs, /function\s+closeAccountPopover[\s\S]*popover\.hidden\s*=\s*true[\s\S]*syncAccountPopoverState\(popover\)[\s\S]*returnFocus\.focus/)
  || !hasPattern(mainJs, /if\s*\(!target\.closest\(\s*["']#account-widget["']\s*\)\)[\s\S]*closeAccountPopover\(\{\s*restoreFocus:\s*Boolean\(popover\?\.contains\(document\.activeElement\)\)\s*\}\)/)
  || !hasPattern(mainJs, /event\.key\s*===\s*["']Escape["'][\s\S]*closeAccountPopover\(\)/)) {
  fail("js/main.js account disclosure should synchronize semantics, close on outside click or Escape, and restore its trigger");
}

if (!hasPattern(mainJs, /function\s+motionScrollBehavior[\s\S]*managedMode\s*===\s*["']reduced["']\s*\|\|\s*managedMode\s*===\s*["']off["'][\s\S]*return\s+["']auto["'][\s\S]*prefers-reduced-motion:\s*reduce/)
  || !hasPattern(mainJs, /function\s+scrollToArticleHeading\([^)]*\{\s*behavior\s*=\s*motionScrollBehavior\(\)[\s\S]*detail\.scrollTo\(\s*\{\s*top:\s*targetTop\s*,\s*behavior\s*\}\s*\)/)
  || !hasPattern(mainJs, /detail\.scrollTo\(\s*\{\s*top:\s*0\s*,\s*behavior:\s*motionScrollBehavior\(\)\s*\}\s*\)/)) {
  fail("js/main.js article scrolling should honor reduced and off motion modes");
}

if (!hasPattern(motionSystemCss, /html\[data-ui-shell="desktop"\]\s+\.desktop-icon\.is-active[\s\S]*\.desktop-icon\[aria-pressed="true"\][\s\S]*border-color:[\s\S]*box-shadow:/)) {
  fail("css/motion-system.css should provide a visible non-color-only desktop icon selected state");
}

if (!hasPattern(mainJs, /LusuUiMotion\.run\(motionKind,[\s\S]*useViewTransition:\s*false/)
  || !hasPattern(uiMotionJs, /pageNavigationKeepsChromeLive\s*=\s*kind\s*===\s*["']route["'][\s\S]*kind\s*===\s*["']app-open["'][\s\S]*kind\s*===\s*["']mobile-tab["'][\s\S]*context\.useViewTransition[\s\S]*&&\s*kind\s*!==\s*["']theme["'][\s\S]*&&\s*!pageNavigationKeepsChromeLive/)
  || !hasPattern(uiMotionJs, /function\s+resolveMotionTarget[\s\S]*kind\s*===\s*["']route["'][\s\S]*kind\s*===\s*["']app-open["'][\s\S]*shellMode\(\)\s*===\s*["']desktop["'][\s\S]*currentRoute\(\)\s*===\s*["']home["'][\s\S]*\.desktop-icons[\s\S]*\.page\.active\s*>\s*\.xp-window/)
  || !hasPattern(uiMotionJs, /function\s+appOpenEnterAnimation[\s\S]*opacity:\s*0\.84[\s\S]*translate3d\(0,3px,0\)[\s\S]*duration:\s*DURATIONS\.standard/)) {
  fail("page navigation must animate live page/window surfaces without a snapshot covering fixed topbar, taskbar, or mobile Dock");
}

for (const [asset, expectedVersion] of [
  ["/css/style.css", currentCssVersion],
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
  || !hasPattern(uiMotionJs, /function\s+routeEnterAnimation[\s\S]*translate3d[\s\S]*duration:\s*DURATIONS\.standard/)
  || /::view-transition-(?:old|new)\(root\)/.test(motionSystemCss)
  || /view-transition-name:\s*(?:module-page|app-screen|mobile-tab-page)/.test(motionSystemCss)) {
  fail("route direction should use a local transform/opacity fallback with no root snapshot while fixed chrome remains live");
}

if (!hasPattern(mainJs, /routeButton\.matches\(\s*["']\.desktop-icon["']\s*\)[\s\S]*["']app-open["']/)
  || !hasPattern(mainJs, /dataset\.uiShell\s*===\s*["']mobile["'][\s\S]*\.taskbar-tabs button, \.start-button, \.mobile-home-button[\s\S]*["']mobile-tab["']/)
  || !hasPattern(uiMotionJs, /function\s+mobileTabEnterAnimation[\s\S]*direction\s*===\s*["']backward["'][\s\S]*translate3d[\s\S]*duration:\s*DURATIONS\.window/)
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
  || !hasPattern(mobileIosShellCss, /html\[data-ui-shell="mobile"\]\s+\.page:not\(\.page-home\)\s*>\s*\.xp-window\s*\{[\s\S]*border-width:\s*1px/)
  || !hasPattern(mobileIosShellCss, /:is\([\s\S]*#videos\s+\.card-grid,[\s\S]*#about\s+\.profile-card[\s\S]*\)\s*\{[\s\S]*border-color:\s*transparent;[\s\S]*box-shadow:\s*none/)
  || !hasPattern(mobileIosShellCss, /:is\([\s\S]*\.video-card,[\s\S]*\.resource-card,[\s\S]*\.game-card,[\s\S]*\.article-card,[\s\S]*\.blog-card[\s\S]*\)\s*\{[\s\S]*border-color:\s*rgba\(49,\s*85,\s*142,\s*0\.58\)/)) {
  fail("mobile Home hit areas should stay compact while App surfaces use one outer frame and one card edge");
}

if (!hasPattern(mainJs, /function\s+updateWallpaperMotionState[\s\S]*document\.documentElement\.dataset\.motion[\s\S]*\[\s*["']full["']\s*,\s*["']reduced["']\s*,\s*["']off["']\s*\]\.includes\(managedMode\)/)
  || !hasPattern(mainJs, /LusuUiMotion\.run\(\s*["']theme["']\s*,\s*\{\s*theme\s*\}\s*,\s*applyTheme\s*\)/)
  || !hasPattern(uiMotionJs, /context\.useViewTransition\s*&&\s*kind\s*!==\s*["']theme["']/)
  || hasPattern(mainJs, /function\s+updateHomeTimeTheme[\s\S]*useViewTransition/)) {
  fail("js/main.js wallpaper should share the canonical motion mode and settle without a root View Transition snapshot");
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
  || !hasPattern(lazyRouteCssSources.chatroom, /\.send-bubble-icon[\s\S]*pixel-ui-glyph-atlas\.png\?v=20260718-resource-icons-layout-r1/)) {
  fail("css/mobile-ios-shell.css should preserve landscape chat room controls, feedback, and the private-room send bitmap");
}

if (!hasPattern(styleCss, /\.minimize-button::before,\s*\.maximize-button::before\s*\{[\s\S]*pixel-ui-glyph-atlas\.png\?v=20260718-resource-icons-layout-r1[\s\S]*background-size:\s*200%\s+200%/)
  || !hasPattern(styleCss, /\.minimize-button::before\s*\{\s*background-position:\s*0\s+0[\s\S]*\.maximize-button::before\s*\{\s*background-position:\s*100%\s+0[\s\S]*\.maximize-button\[aria-pressed="true"\]::before\s*\{\s*background-position:\s*0\s+100%/)
  || !hasPattern(lazyRouteCssSources.chatroom, /\.send-bubble-icon\s*\{[\s\S]*\.\.\/\.\.\/assets\/images\/ui\/pixel-ui-glyph-atlas\.png\?v=20260718-resource-icons-layout-r1[\s\S]*background-position:\s*100%\s+100%/)
  || hasPattern(lazyRouteCssSources.chatroom, /\.send-bubble-icon::(?:before|after)\s*\{[\s\S]{0,320}(?:clip-path|border|box-shadow|background\s*:)/)) {
  fail("public window and chat glyphs should use the image2 bitmap atlas instead of CSS-drawn geometry");
}

if (!hasPattern(mobileIosShellCss, /@media\s*\(orientation:\s*landscape\)\s*and\s*\(max-height:\s*520px\)[\s\S]*\.chatroom-window\s*\{[\s\S]*grid-template-columns:\s*minmax\(204px,\s*29vw\)\s+minmax\(0,\s*1fr\)[\s\S]*grid-template-rows:\s*auto\s+minmax\(0,\s*1fr\)\s+64px[\s\S]*\.chatroom-header\s*\{[\s\S]*grid-row:\s*1\s*\/\s*3[\s\S]*\.chat-private-room-panel\s*\{[\s\S]*grid-column:\s*2[\s\S]*grid-row:\s*1[\s\S]*\.chatroom-log\s*\{[\s\S]*grid-column:\s*2[\s\S]*grid-row:\s*2[\s\S]*\.chatroom-compose\s*\{[\s\S]*grid-column:\s*2[\s\S]*grid-row:\s*3[\s\S]*\.chatroom-footer\s*\{[\s\S]*grid-column:\s*1[\s\S]*grid-row:\s*3/)) {
  fail("css/mobile-ios-shell.css should use the available landscape width so chat and private-room controls remain simultaneously reachable");
}

if (!hasPattern(mobileIosShellCss, /@media\s*\(max-width:\s*380px\)[\s\S]*\.chat-private-room-panel[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto\s+auto[\s\S]*\.chat-private-room-panel small\s*\{\s*display:\s*none/)
  || !hasPattern(mobileIosShellCss, /@media\s*\(max-width:\s*760px\)\s*and\s*\(max-height:\s*720px\)\s*and\s*\(orientation:\s*portrait\)[\s\S]*\.chatroom-header\s*\{[\s\S]*height:\s*90px[\s\S]*\.chat-private-room-panel\s*\{[\s\S]*height:\s*46px[\s\S]*\.chatroom-log\s*\{[\s\S]*margin:\s*2px\s+5px[\s\S]*\.chatroom-compose\s*\{[\s\S]*grid-template-rows:\s*44px[\s\S]*\.chatroom-counter\s*\{[\s\S]*position:\s*absolute[\s\S]*\.chatroom-footer\s*\{[\s\S]*height:\s*45px/)
  || !hasPattern(mobileIosShellCss, /html\[data-ui-shell="mobile"\]\s+\.chatroom-window\s*\{\s*display:\s*grid;\s*grid-template-rows:\s*auto\s+auto\s+minmax\(0,\s*1fr\)\s+auto\s+auto/)
  || !hasPattern(mobileIosShellCss, /html\[data-ui-shell="mobile"\]\s+\.chatroom-compose\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto;[\s\S]*grid-template-rows:\s*minmax\(44px,\s*auto\)\s+17px/)
  || !hasPattern(mobileIosShellCss, /html\[data-ui-shell="mobile"\]\s+\.chatroom-counter\s*\{[\s\S]*position:\s*static;[\s\S]*grid-column:\s*1;[\s\S]*grid-row:\s*2/)
  || !hasPattern(mobileIosShellCss, /html\[data-ui-shell="mobile"\]\s+\.chat-send-button\s*\{[\s\S]*grid-column:\s*2;[\s\S]*grid-row:\s*1\s*\/\s*3[\s\S]*min-height:\s*44px/)
  || !hasPattern(mobileIosShellCss, /html\[data-ui-shell="mobile"\]\s+\.chatroom-autoscroll\s*\{[\s\S]*min-height:\s*44px/)) {
  fail("css/mobile-ios-shell.css should keep password and chat controls reachable on narrow and soft-keyboard portrait viewports");
}

if (!hasPattern(lazyRouteCssSources.chatroom, /\.chatroom-window\s*>\s*\.chatroom-log\s*\{\s*grid-row:\s*4[\s\S]*\.chatroom-window\s*>\s*\.chatroom-compose\s*\{\s*grid-row:\s*5[\s\S]*\.chatroom-window\s*>\s*\.chatroom-footer\s*\{\s*grid-row:\s*6/)) {
  fail("css/routes/chatroom.css should keep the flexible desktop grid row assigned to the message log");
}

if (!hasPattern(mobileIosShellCss, /#transfer-app\s+\.transfer-network-status\s*\{\s*font-size:\s*var\(--mobile-readable-caption\)/)) {
  fail("css/mobile-ios-shell.css should keep the lazy Quick Transfer network status at the readable mobile caption size");
}

if (!hasPattern(mobileIosShellCss, /html\[data-ui-shell="mobile"\]\s+\.mobile-dock-scroll\s*\{[\s\S]*overflow-x:\s*auto[\s\S]*touch-action:\s*pan-x/)
  || !hasPattern(mobileIosShellCss, /body\[data-mobile-dock="collapsed"\]\s+\.xp-taskbar\s*\{[\s\S]*transform:\s*translate3d/)
  || !hasPattern(mobileIosShellCss, /body\[data-mobile-dock="collapsed"\]\s+\.mobile-dock-scroll\s*\{[^}]*visibility:\s*hidden/)
  || !hasPattern(mobileShellJs, /function\s+toggleDock[\s\S]*dockCollapsed[\s\S]*syncDockState/)
  || !hasPattern(mobileShellJs, /function\s+syncDockAccessibility\(\)[\s\S]*scroller\.inert\s*=\s*collapsed[\s\S]*scroller\.setAttribute\(\s*["']aria-hidden["']\s*,\s*String\(\s*collapsed\s*\)\s*\)/)
  || !hasPattern(mobileShellJs, /function\s+measureDockLayout[\s\S]*getBoundingClientRect[\s\S]*reveal\s*=/)
  || !hasPattern(mobileShellJs, /function\s+mutateDockLayout[\s\S]*measurement\.reveal[\s\S]*scrollIntoView[\s\S]*behavior:/)
  || !hasPattern(indexHtml, /class=["'][^"']*\bmobile-dock-selection\b[^"']*["'][^>]*aria-hidden=["']true["']/)
  || !hasPattern(mobileIosShellCss, /\.mobile-dock-selection\s*\{[\s\S]*width:\s*var\(--mobile-dock-selection-width/)
  || !hasPattern(mobileIosShellCss, /\.mobile-dock-selection\s*\{[\s\S]*transform:\s*translate3d\(var\(--mobile-dock-selection-x/)
  || !hasPattern(mobileShellJs, /function\s+mutateDockLayout[\s\S]*setProperty\(\s*["']--mobile-dock-selection-x["']/)
  || !hasPattern(mobileShellJs, /function\s+mutateDockLayout[\s\S]*setProperty\(\s*["']--mobile-dock-selection-width["']/)
  || !hasPattern(indexHtml, /data-route="blog"\s+data-mobile-dock-excluded/)
  || !hasPattern(indexHtml, /data-route="about"\s+data-mobile-dock-excluded/)
  || !hasPattern(mobileIosShellCss, /taskbar-tabs\s+button\[data-mobile-dock-excluded\]\s*\{\s*display:\s*none/)
  || !hasPattern(mobileIosShellCss, /@media\s*\(min-width:\s*375px\)[\s\S]*mobile-dock-scroll\s*\{\s*justify-content:\s*center/)
  || !hasPattern(mobileShellJs, /dockRouteElements[\s\S]*:not\(\[data-mobile-dock-excluded\]\)[\s\S]*has-no-dock-route/)
  || !hasPattern(mobileShellJs, /function\s+syncDockLayout[\s\S]*framePipeline\.schedule\(\s*["']mobile-shell:dock-layout["']/)
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

if (!hasPattern(mobileIosShellCss, /html\[data-ui-shell="mobile"\]\s+#games\s+\.game-card\s*\{[\s\S]*grid-template-columns:\s*52px\s+minmax\(0,\s*1fr\)\s*;[\s\S]*grid-template-rows:\s*auto\s+44px/)
  || !hasPattern(mobileIosShellCss, /html\[data-ui-shell="mobile"\]\s+#games\s+\.game-card\s+\.card-action\s*\{[\s\S]*grid-column:\s*1\s*\/\s*-1[\s\S]*grid-row:\s*2/)
  || !hasPattern(mobileIosShellCss, /@media\s*\(orientation:\s*landscape\)\s*and\s*\(max-height:\s*520px\)[\s\S]*#games\s+\.game-card\s*\{[\s\S]*grid-template-columns:\s*52px\s+minmax\(0,\s*1fr\)\s+96px[\s\S]*min-height:\s*228px[\s\S]*#games\s+\.game-card\s+\.card-action\s*\{[\s\S]*grid-column:\s*3[\s\S]*grid-row:\s*1/)
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
  || !hasPattern(mobileIosShellCss, /@media\s*\(orientation:\s*landscape\)\s*and\s*\(max-height:\s*520px\)[\s\S]*\.folder-layout\.is-reading\s+\.article-detail\s*\{[\s\S]*padding:\s*8px\s+8px\s+28px/)) {
  fail("css/mobile-ios-shell.css should keep translated About content scrollable and avoid double-counting Dock space inside the landscape article scroll owner");
}

if (!hasPattern(mobileIosShellCss, /html\[data-ui-shell="mobile"\]\s+#article-detail-meta\s*\{[\s\S]*flex-wrap:\s*wrap[\s\S]*overflow:\s*visible/)
  || !hasPattern(mobileIosShellCss, /html\[data-ui-shell="mobile"\]\s+\.article-detail-head\s*>\s*p\s*\{[\s\S]*-webkit-line-clamp:\s*2/)
  || !hasPattern(mobileIosShellCss, /html\[data-ui-shell="mobile"\]\s+\.article-summary-toggle:not\(\[hidden\]\)\s*\{[\s\S]*min-height:\s*44px[\s\S]*#article-detail-summary\.is-expanded\s*\{[\s\S]*-webkit-line-clamp:\s*unset/)
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

const knowledgeControlsMarkup = windowAfter(indexHtml, '<div class="knowledge-window-controls"', 500);
if (!knowledgeControlsMarkup.includes('class="close-button"')
  || /minimize-button|data-article-window-toggle/.test(knowledgeControlsMarkup)) {
  fail("index.html Knowledge titlebar should keep only the working close control");
}

const knowledgeRouteCss = lazyRouteCssSources.knowledge;
const progressMarkupStart = indexHtml.indexOf('<div class="article-read-progress"');
const knowledgeTitlebarEnd = indexHtml.indexOf('</div>', indexHtml.indexOf('<div class="window-titlebar">'));
const knowledgeSearchbarStart = indexHtml.indexOf('<div class="knowledge-searchbar"');
const articleDetailStart = indexHtml.indexOf('<article class="article-detail"');
if (progressMarkupStart < knowledgeTitlebarEnd || progressMarkupStart > knowledgeSearchbarStart
  || indexHtml.slice(articleDetailStart, indexHtml.indexOf('</article>', articleDetailStart)).includes('class="article-read-progress"')
  || !hasPattern(knowledgeRouteCss, /html:not\(\[data-ui-shell="mobile"\]\)\s+body\.is-article-reading\s*\{[^}]*height:\s*100dvh[^}]*overflow:\s*hidden/)
  || !hasPattern(knowledgeRouteCss, /html:not\(\[data-ui-shell="mobile"\]\)\s+body\.is-article-reading\s+#knowledge\s*\{[^}]*height:\s*calc\(100dvh\s*-\s*var\(--chrome-topbar-height\)\)[^}]*overflow:\s*hidden/)
  || !hasPattern(knowledgeRouteCss, /html:not\(\[data-ui-shell="mobile"\]\)\s+body\.is-article-reading\s+#knowledge\s+\.xp-window\s*\{[^}]*margin:\s*0\s+auto/)
  || !hasPattern(knowledgeRouteCss, /#knowledge\s+\.article-detail\s*\{[^}]*overflow:\s*auto/)
  || !hasPattern(knowledgeRouteCss, /\.article-read-progress\s*\{[^}]*display:\s*none/)
  || hasPattern(knowledgeRouteCss, /\.article-read-progress\s*\{[^}]*position:\s*fixed/)
  || !hasPattern(knowledgeRouteCss, /body\.is-article-reading\s+#knowledge\s+\.article-read-progress\s*\{[^}]*display:\s*grid/)
  || !hasPattern(knowledgeRouteCss, /\.article-read-progress-track\s*\{[^}]*height:\s*4px/)) {
  fail("desktop articles must keep document scrolling locked, use article-detail as the sole scroll owner, and render progress as a 4px in-flow window status");
}

if (!hasPattern(mobileIosShellCss, /body\.is-article-reading\s+\.article-read-progress\s*\{[^}]*position:\s*relative[^}]*grid-template-columns:\s*auto\s+minmax\(64px,\s*1fr\)\s+auto[^}]*width:\s*100%[^}]*min-height:\s*26px/)
  || !hasPattern(knowledgeRouteCss, /body\.is-article-reading\s+\.article-top-link\s*\{[^}]*min-height:\s*44px/)
  || !hasPattern(knowledgeRouteCss, /\.article-top-link\s*\{[^}]*right:\s*var\(--article-top-control-right[^}]*bottom:\s*var\(--article-top-control-bottom/)
  || !hasPattern(mobileIosShellCss, /body\.is-article-reading\s+\.article-top-link\s*\{[^}]*top:\s*auto[^}]*right:\s*var\(--article-top-control-right[^}]*bottom:\s*var\([^}]*--article-top-control-bottom[\s\S]*?width:\s*44px/)
  || !hasPattern(indexHtml, /<aside class=["']article-reader-sidebar["']>[\s\S]*?data-article-back[\s\S]*?id=["']article-detail-toc["']/)
  || !hasPattern(knowledgeRouteCss, /\.article-back-button\s*\{[^}]*width:\s*100%[^}]*position:\s*static/)
  || !hasPattern(knowledgeRouteCss, /\.article-reader-sidebar\s*\{[^}]*grid-template-rows:\s*auto\s+minmax\(0,\s*1fr\)\s+auto[^}]*position:\s*sticky[^}]*top:\s*18px/)
  || !hasPattern(knowledgeRouteCss, /#article-detail-toc-list\s*\{[^}]*grid-auto-rows:\s*max-content[^}]*padding:\s*10px\s+20px\s+34px\s+10px[^}]*overflow:\s*auto/)
  || !hasPattern(knowledgeRouteCss, /\.article-toc-link\s*\{[^}]*height:\s*auto[^}]*min-height:\s*0[^}]*line-height:\s*1\.45/)
  || !hasPattern(mainJs, /scrollToArticleHeading\(articleHeadingButton\.dataset\.articleHeadingTarget,\s*\{\s*behavior:\s*["']auto["']\s*\}\)/)
  || !hasPattern(knowledgeModuleJs, /const\s+cardRect\s*=\s*document\.querySelector\(\s*["']\.article-detail-card["']\s*\)\?\.getBoundingClientRect\(\)/)
  || !hasPattern(knowledgeModuleJs, /--article-top-control-right[\s\S]*--article-top-control-bottom/)
  || !hasPattern(mobileIosShellCss, /body\.is-article-reading\s+\.article-read-progress-label span\s*\{[^}]*position:\s*static[^}]*font-size:\s*11px/)
  || !hasPattern(mobileIosShellCss, /body\.is-article-reading\s+\.article-read-progress-label strong\s*\{[^}]*display:\s*block[^}]*grid-column:\s*3/)
  || !hasPattern(mobileIosShellCss, /body\.is-article-reading\s+\.article-read-progress-track\s*\{[^}]*grid-column:\s*2[^}]*height:\s*4px/)
  || !hasPattern(mobileIosShellCss, /body\.is-article-reading\s+\.mobile-route-copy\s*\{\s*display:\s*none/)
  || !hasPattern(indexHtml, /data-article-scroll-top[^>]*hidden/)
  || !hasPattern(indexHtml, /id=["']article-detail-title["'][^>]*tabindex=["']-1["']/)
  || !hasPattern(knowledgeModuleJs, /const\s+atArticleTop\s*=\s*!detail\s*\|\|\s*detail\.scrollTop\s*<=\s*2/)
  || !hasPattern(knowledgeModuleJs, /topButton\?\.toggleAttribute\(\s*["']hidden["']\s*,\s*atArticleTop\s*\)/)
  || !hasPattern(knowledgeModuleJs, /document\.getElementById\(\s*["']article-detail-title["']\s*\)\?\.focus\(\s*\{\s*preventScroll:\s*true\s*\}\s*\)/)
  || !hasPattern(mobileIosShellCss, /body\.is-article-reading\s+\.xp-topbar\s*\{\s*pointer-events:\s*none[\s\S]*body\.is-article-reading\s+\.xp-topbar\s+:is\(button,\s*a,\s*input,\s*select,\s*textarea,\s*\.account-popover\)\s*\{\s*pointer-events:\s*auto/)
  || !hasPattern(mobileIosShellCss, /body\.is-article-reading\s+\.mobile-appbar\s*\{[^}]*padding-right:\s*0/)
  || !hasPattern(mobileIosShellCss, /@media\s*\(orientation:\s*landscape\)\s*and\s*\(max-height:\s*520px\)[\s\S]*body\.is-article-reading\s+\.article-read-progress\s*\{[^}]*grid-template-columns:\s*auto\s+minmax\(52px,\s*1fr\)\s+auto[^}]*width:\s*100%[\s\S]*body\.is-article-reading\s+\.article-top-link\s*\{[^}]*right:\s*var\(--article-top-control-right[^}]*bottom:\s*var\([^}]*--article-top-control-bottom/)) {
  fail("article readers should keep multiline TOC rows complete, pin Back inside the reader, and place the 44px top control at the measured reading-area corner");
}

if (!hasPattern(mobileIosShellCss, /html\[data-ui-shell="mobile"\]\s*\{[\s\S]*--mobile-status-height:\s*0px/)
  || !hasPattern(mobileIosShellCss, /html\[data-ui-shell="mobile"\]\s+\.mobile-statusbar\s*\{\s*display:\s*none/)) {
  fail("css/mobile-ios-shell.css should remove the mobile time and LuSu OS status row without affecting the App bar");
}

if (!hasPattern(mobileIosShellCss, /html\[data-ui-shell="mobile"\]\s+#video-window-maximize\s*\{\s*display:\s*none/)) {
  fail("css/mobile-ios-shell.css should hide the no-op video maximize control inside always-full-screen mobile modals");
}

if (!hasPattern(mainJs, /let\s+navigationRequestId\s*=\s*0[\s\S]*function\s+navigate[\s\S]*const\s+requestId\s*=\s*\+\+navigationRequestId[\s\S]*navigationCommitted\s*\|\|\s*requestId\s*!==\s*navigationRequestId/)) {
  fail("js/main.js navigate should reject stale deferred commits so rapid route changes remain last-action-wins");
}

if (!hasPattern(mainJs, /function\s+fullscreenVideo[\s\S]*runWindowLayoutTransition\(\s*nextMaximized\s*\?\s*["']window-maximize["']\s*:\s*["']window-restore["']/)) {
  fail("js/main.js video window control should use the coherent maximize/restore layout transition");
}

if (/data-article-window-toggle|toggleArticleWindowSize|updateArticleWindowButton|is-article-window-restored/.test([
  indexHtml,
  mainEntryJs,
  knowledgeModuleJs,
  knowledgeRouteCss,
  mobileIosShellCss
].join("\n"))) {
  fail("Knowledge should not retain dormant minimize/maximize/restore controls or layout state");
}

if (!hasPattern(motionSystemCss, /\.page\s*\{\s*animation:\s*none/)) {
  fail("css/motion-system.css should disable the legacy page popIn so routes have one authoritative transition system");
}

if (!hasPattern(mainJs, /function\s+runSurfaceClose[\s\S]*LusuUiMotion\.run\(\s*["']modal-close["'][\s\S]*deferCommit:\s*true/)
  || !hasPattern(mainJs, /function\s+closeVideo[\s\S]*runSurfaceClose\(modal/)
  || !hasPattern(mainJs, /function\s+closeWelcome[\s\S]*runSurfaceClose\(modal/)) {
  fail("js/main.js video and welcome dialogs should use a deferred reverse close animation with an immediate reduced-motion fallback");
}

if (!hasPattern(mainJs, /function\s+closeAccountPopover\(options\s*=\s*\{\}\)[\s\S]*runSurfaceClose\(popover[\s\S]*returnFocus\.focus\(\s*\{\s*preventScroll:\s*true\s*\}\s*\)/)
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
  objectBlocksAfterMarker(mainJs, "function renderResources").find((body) => body.includes("readyResourceItems")) || "",
  /const\s+readyItems\s*=\s*readyResourceItems\(\)[\s\S]*renderResourceCategoryButtons\(readyItems\)[\s\S]*const\s+items\s*=\s*readyItems\.filter[\s\S]*resourceEmptyStateElement\(\{\s*hasAnyReady:\s*readyItems\.length\s*>\s*0\s*\}\)/
)) {
  fail("js/main.js renderResources should show an honest empty state instead of placeholder resource cards");
}

const blogCardBody = objectBlockAfterMarker(mainJs, "function blogCardElement");
if (/aria-disabled|action\.disabled\s*=|blogPending/.test(blogCardBody)
  || !/const\s+blogUrl\s*=\s*String\(item\.url\s*\|\|\s*["']["']\)\.trim\(\)/.test(blogCardBody)
  || !blogCardBody.includes('/^\\/articles\\/[a-z0-9]')
  || !/document\.createElement\(["']a["']\)/.test(blogCardBody)) {
  fail("js/main.js blog cards must expose a real article link only for a safe published article URL, never a fake pending action");
}

if (!hasPattern(mainJs, /function\s+publishedBlogItems\(\)\s*\{[\s\S]*blogState\.items\.filter\(\(item\)\s*=>\s*item\.published\s*===\s*true\s*&&\s*\(item\.url\s*\|\|\s*item\.content\)\)/)) {
  fail("js/main.js should separate published blog items from placeholder drafts");
}

if (!hasPattern(
  objectBlockAfterMarker(mainJs, "function renderBlog"),
  /content-state-copy loading-text[\s\S]*const\s+items\s*=\s*publishedBlogItems\(\)[\s\S]*if\s*\(\s*!items\.length\s*\)\s*\{[\s\S]*blogEmptyStateElement\(\)[\s\S]*items\.forEach\(\(item\)\s*=>\s*list\.appendChild\(blogCardElement\(item\)\)\)/
)) {
  fail("js/main.js renderBlog should wrap its loading copy and show an honest empty state until real posts are published");
}

if (!hasPattern(mainJs, /function\s+waitForRouteModuleRetryResult[\s\S]*MutationObserver[\s\S]*route-module-status[\s\S]*function\s+restoreRetryFocus/)
  || !hasPattern(mainJs, /data-route-module-retry[\s\S]*restartActiveRouteLifecycle\(\s*["']module-retry["']\s*\)[\s\S]*restoreRetryFocus\([\s\S]*waitForRouteModuleRetryResult/)) {
  fail("generic route-module retries should wait for a settled result and restore focus inside the route status target");
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

if (!hasPattern(mainJs, /function\s+safeResourceUrl[\s\S]*if\s*\(\s*httpUrl\s*\)[\s\S]*item\.external\s*===\s*true\s*\?\s*safeTrustedExternalUrl\(value,\s*trustedResourceExternalHosts\)\s*:\s*["']["']/)) {
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

const desktopTaskbarActiveBlock = objectBlockAfterMarker(styleCss, ".taskbar-tabs button.active");
if (!desktopTaskbarActiveBlock.includes("var(--chrome-task-button-active-bg)")
  || /#ffd84c|#ffe990|255\s*,\s*238\s*,\s*142|var\(--chrome-glow\)/i.test(desktopTaskbarActiveBlock)) {
  fail("desktop active taskbar buttons should keep a blue pressed state without a persistent yellow edge or glow");
}

const finalUpdateId = "seed-update-2026-08-06-site-guides-password-rooms";
const finalUpdateSlug = "2026-08-06-site-guides-password-rooms";
const finalMainVersion = currentMainVersion;
const finalCssVersion = currentCssVersion;
const supersededAccountA11yMainVersion = "20260623-account-expanded-a11y-r1";
const finalTitleEn = "Website Guides and Password Room Guide";
const finalPublishedAt = "2026-08-06T00:55:00.000Z";
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
const changelog20260717Section = markdownSection(changelog, "## 2026-07-17");
const changelog20260718Section = markdownSection(changelog, "## 2026-07-18");
const changelog20260719Section = markdownSection(changelog, "## 2026-07-19");
const changelog20260720Section = markdownSection(changelog, "## 2026-07-20");
const changelog20260726Section = markdownSection(changelog, "## 2026-07-26");
const changelog20260727Section = markdownSection(changelog, "## 2026-07-27");
const changelog20260728Section = markdownSection(changelog, "## 2026-07-28");
const changelog20260729Section = markdownSection(changelog, "## 2026-07-29");
const changelog20260801Section = markdownSection(changelog, "## 2026-08-01");
const changelog20260806Section = markdownSection(changelog, "## 2026-08-06");

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
    'date: "2026.07.17"',
    'date: "2026.07.18"',
    finalTitleEn
  ]) {
    if (!contentModuleJs.includes(token)) {
      fail(`js/data/content.mjs final public update fallback missing ${token}`);
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

  const mainFinalFallback = windowAfter(contentModuleJs, `"article_id": "${finalUpdateId}"`, 12000);
  for (const token of [
    `"article_id": "${finalUpdateId}"`,
    `"slug": "${finalUpdateSlug}"`,
    '"category": "site-updates"',
    `"published_at": "${finalPublishedAt}"`,
    '"fallbackOnly": true'
  ]) {
    if (!mainFinalFallback.includes(token)) {
      fail(`js/data/content.mjs final public update fallback metadata missing ${token}`);
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
        fail(`js/data/content.mjs final public update fallback ${lang}.${field} should be populated`);
      } else if (fallbackValue !== apiValue) {
        fail(`js/data/content.mjs and Functions final public update ${lang}.${field} should match exactly`);
      }
    }
  }

  const homeFinalProjection = windowAfter(homeContentModuleJs, `"article_id": "${finalUpdateId}"`, 8000);
  for (const token of [
    `"article_id": "${finalUpdateId}"`,
    `"slug": "${finalUpdateSlug}"`,
    '"category": "site-updates"',
    `"published_at": "${finalPublishedAt}"`,
    '"fallbackOnly": true'
  ]) {
    if (!homeFinalProjection.includes(token)) {
      fail(`js/data/home-content.mjs final public update projection missing ${token}`);
    }
  }
  for (const lang of ["zh", "en", "ja"]) {
    for (const field of ["title", "summary"]) {
      const homeFieldBlock = objectBlockAfterMarker(homeFinalProjection, `"${field}":`);
      const homeValue = jsStringPropertyValue(homeFieldBlock, lang);
      const apiValue = apiFinalTranslationValues[lang]?.[field];
      if (!homeValue) {
        fail(`js/data/home-content.mjs final public update ${lang}.${field} should be populated`);
      } else if (homeValue !== apiValue) {
        fail(`js/data/home-content.mjs and Functions final public update ${lang}.${field} should match exactly`);
      }
    }
  }
  if (/content_markdown/.test(homeContentModuleJs)) {
    fail("js/data/home-content.mjs should not include article bodies");
  }
  if ((homeContentModuleJs.match(/"article_id"\s*:/g) || []).length !== 5) {
    fail("js/data/home-content.mjs should project exactly the newest five updates");
  }
  if (Buffer.byteLength(homeContentModuleJs, "utf8") > 12 * 1024) {
    fail("js/data/home-content.mjs should remain a slim Home projection under 12 KB");
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
    '<time id="top-updated" datetime="2026-08-06">2026.08.06</time>',
    `/css/style.css?v=${finalCssVersion}`,
    `/css/mobile-ios-shell.css?v=${knowledgeReaderVersion}`,
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
    if (!changelog20260806Section.includes(token)) {
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
const whiteboardWorkerWranglerData = parseJsonSource("workers/whiteboard/wrangler.jsonc", whiteboardWorkerWranglerConfig);
const whiteboardIconSourceData = parseJsonSource("assets/images/generated-icons/whiteboard.source.json", whiteboardIconSource);
if (nodeVersion.trim() !== "22" || migrationPackageData.engines?.node !== ">=22.13.0") {
  fail("Node.js runtime must stay documented as version 22.13+ in .nvmrc and package.json");
}
if (migrationPackageData.devDependencies?.wrangler !== "4.118.0") {
  fail("package.json must pin Wrangler 4.118.0 for reproducible GPTWork setup");
}
if (migrationPackageData.devDependencies?.sharp !== "0.35.3") {
  fail("package.json must pin sharp 0.35.3 for the audited image-processing baseline");
}
if (migrationWranglerData.compatibility_date !== "2026-07-17") {
  fail("wrangler.jsonc compatibility_date must stay within Wrangler 4.118.0 workerd support (2026-07-17)");
}
if (migrationPackageData.scripts?.build !== "node scripts/build-check.mjs && node scripts/build-production.mjs") {
  fail("package.json build must run the repository guard before generating the production dist artifact");
}
if (migrationWranglerData.pages_build_output_dir !== "dist") {
  fail("wrangler.jsonc pages_build_output_dir must match the generated production dist artifact");
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
if (!schemaIndexesSql.includes("transfer_items_idempotency_idx")
  || !hasPattern(schemaIndexesSql, /create\s+unique\s+index\s+if\s+not\s+exists\s+transfer_items_idempotency_idx[\s\S]*transfer_items\(uploader_user_id,\s*idempotency_key\)[\s\S]*where\s+idempotency_key\s*<>\s*''/i)
  || !d1MigrateLocalJs.includes('column: "sync_generation"')
  || !d1MigrateLocalJs.includes('column: "idempotency_key"')) {
  fail("local D1 migration must add Transfer compatibility columns before creating transfer_items_idempotency_idx from schema-indexes.sql");
}
for (const token of ["tests/*.test.mjs", "tests/transfer/*.test.mjs", "tools/japanese-subtext/tests/*.test.mjs", "tools/japanese-subtext/scripts/tts/tests/*.mjs"]) {
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
if (!Array.isArray(previewWranglerData?.d1_databases) || previewWranglerData.d1_databases.length !== 0) {
  fail("wrangler.jsonc env.preview must not bind Production D1; provision an independent Preview D1 before enabling Preview API");
}
if (!Array.isArray(previewWranglerData?.r2_buckets) || previewWranglerData.r2_buckets.length !== 0) {
  fail("wrangler.jsonc env.preview must explicitly disable Quick Transfer R2 until a separate preview bucket is provisioned");
}
if (previewWranglerData?.vars?.PREVIEW_API_DISABLED !== "true") {
  fail("wrangler.jsonc env.preview must fail closed with PREVIEW_API_DISABLED=true while Preview D1/R2 bindings are absent");
}
if (!Array.isArray(previewWranglerData?.durable_objects?.bindings)
  || previewWranglerData.durable_objects.bindings.length !== 0) {
  fail("wrangler.jsonc env.preview must not bind a whiteboard Worker until the isolated Preview Worker and data resources are provisioned");
}
const productionWhiteboardOrigins = String(whiteboardWorkerWranglerData.vars?.ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
if (canonicalJson(productionWhiteboardOrigins) !== canonicalJson(["https://lusu575.com", "https://www.lusu575.com"])) {
  fail("workers/whiteboard/wrangler.jsonc Production ALLOWED_ORIGINS must contain only the two production HTTPS origins");
}
const whiteboardIconBytes = readFileSync(resolve(root, "assets/images/generated-icons/whiteboard.png"));
const whiteboardIconHash = createHash("sha256").update(whiteboardIconBytes).digest("hex");
if (whiteboardIconSourceData.generator !== "image2"
  || whiteboardIconSourceData.publishedOutput?.width !== 192
  || whiteboardIconSourceData.publishedOutput?.height !== 192
  || whiteboardIconSourceData.publishedOutput?.sha256 !== whiteboardIconHash
  || whiteboardIconSourceData.postProcessing?.mechanicalResizeOnly !== true
  || whiteboardIconSourceData.postProcessing?.codeDrawnOrComposited !== false
  || whiteboardIconSourceData.postProcessing?.operations?.length !== 1
  || whiteboardIconSourceData.postProcessing?.operations?.[0]?.operation !== "resize") {
  fail("whiteboard icon source manifest must prove image2 generation, published dimensions/hash, and resize-only post-processing");
}
for (const unsupportedPagesField of ["observability", "secrets"]) {
  if (Object.hasOwn(migrationWranglerData, unsupportedPagesField)) {
    fail(`wrangler.jsonc must not declare unsupported Cloudflare Pages field ${unsupportedPagesField}`);
  }
}
for (const secretName of ["CHAT_IP_HASH_SALT", "ANALYTICS_IP_HASH_SALT", "OWNER_ADMIN_EMAILS"]) {
  if (!new RegExp(`^${secretName}=\\s*$`, "m").test(envExample)) {
    fail(`.env.example must list ${secretName} without a value`);
  }
}
for (const token of [".dev.vars", ".dev.vars.*", ".env", ".env.*", "!.env.example", "output/", "*.pem", "*.key"]) {
  if (!gitignore.split(/\r?\n/).includes(token)) {
    fail(`.gitignore missing ${token}`);
  }
}
for (const token of [
  "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1",
  "actions/setup-node@820762786026740c76f36085b0efc47a31fe5020",
  "npm ci",
  "npm run d1:migrate:local",
  "npm run verify:public-site-release",
  "git diff --exit-code"
]) {
  if (!verifyWorkflow.includes(token)) {
    fail(`.github/workflows/verify.yml missing ${token}`);
  }
}
if (/uses:\s+actions\/(?:checkout|setup-node)@v\d+/i.test(verifyWorkflow)) {
  fail(".github/workflows/verify.yml must pin third-party actions to immutable commit SHAs");
}
for (const token of [
  'cron: "37 */12 * * *"',
  "workflow_run:",
  "node scripts/production-smoke.mjs",
  "REQUIRE_WWW_REDIRECT: \"0\"",
  "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1",
  "actions/setup-node@820762786026740c76f36085b0efc47a31fe5020"
]) {
  if (!productionSmokeWorkflow.includes(token)) {
    fail(`.github/workflows/production-smoke.yml missing ${token}`);
  }
}
if (/uses:\s+actions\/(?:checkout|setup-node)@v\d+/i.test(productionSmokeWorkflow)) {
  fail(".github/workflows/production-smoke.yml must pin third-party actions to immutable commit SHAs");
}
for (const token of [
  "/api/health",
  "/sitemap.xml",
  "extractArticleSlugFromSitemap",
  "validateArticleHtml",
  "max-age=31536000",
  "SMOKE_ATTEMPTS"
]) {
  if (!productionSmokeJs.includes(token)) {
    fail(`scripts/production-smoke.mjs missing ${token}`);
  }
}
for (const token of ["npm ci", ".env.example", "npm run d1:migrate:local", "npm test", "npm run build", "npm run dev"]) {
  if (!rootReadme.includes(token)) {
    fail(`README.md GPTWork setup missing ${token}`);
  }
}

const rootDeployScript = String(parseJsonSource("package.json", packageJson).scripts?.deploy || "");
if (/wrangler\s+(?:pages\s+)?deploy/i.test(rootDeployScript) || !rootDeployScript.includes("Merge to GitHub main")) {
  fail("package.json deploy script should point to merge-to-main Cloudflare Pages deployment, not Wrangler manual deploy");
}

for (const secretName of ["CHAT_IP_HASH_SALT", "ANALYTICS_IP_HASH_SALT"]) {
  if (!apiJs.includes(secretName)) {
    fail(`functions/api/[[route]].js missing required runtime secret ${secretName}`);
  }
}
for (const token of ["ownerAdminEmails(env)", "env?.OWNER_ADMIN_EMAILS", ".split(/[\\s,;]+/u)"]) {
  if (!apiJs.includes(token)) {
    fail(`functions/api/[[route]].js missing environment-backed owner admin parsing: ${token}`);
  }
}
if (/const\s+OWNER_ADMIN_EMAILS\s*=\s*new\s+Set\s*\(/.test(apiJs)) {
  fail("functions/api/[[route]].js must not hardcode owner admin email addresses");
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
