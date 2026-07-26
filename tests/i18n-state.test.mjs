import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

import {
  isI18nNodeInScope,
  labels,
  normalizeLanguage,
  supportedLanguages,
  translationFor,
  translationKeyDiff,
  translations
} from "../js/core/i18n.mjs";
import { createRouter } from "../js/core/router.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const mainSource = await readFile(path.join(root, "js/main.js"), "utf8");
const accountSource = await readFile(path.join(root, "js/features/account.mjs"), "utf8");
const chatSource = await readFile(path.join(root, "js/routes/chatroom.mjs"), "utf8");
const transferSource = await readFile(path.join(root, "js/transfer.js"), "utf8");
const transferLoaderSource = await readFile(path.join(root, "js/features/quick-transfer-loader.mjs"), "utf8");
const indexSource = await readFile(path.join(root, "index.html"), "utf8");
const transferFragment = await readFile(path.join(root, "fragments/quick-transfer.html"), "utf8");

function extractFunction(source, name) {
  const marker = `function ${name}`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} must exist`);
  const signatureEnd = source.indexOf(") {", start);
  assert.notEqual(signatureEnd, -1, `${name} must have a function body`);
  const bodyStart = signatureEnd + 2;
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Could not extract ${name}`);
}

function extractObjectLiteral(source, marker) {
  const assignment = source.indexOf(marker);
  assert.notEqual(assignment, -1, `${marker} must exist`);
  const start = source.indexOf("{", assignment + marker.length);
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === "\"" || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Could not extract object after ${marker}`);
}

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return filesBelow(fullPath);
    return /\.(?:js|mjs)$/.test(entry.name) ? [fullPath] : [];
  }));
  return nested.flat();
}

function literalMatches(source, pattern) {
  return [...source.matchAll(pattern)].map((match) => match[1]);
}

function assertCatalogParity(catalog, label) {
  const expected = Object.keys(catalog.zh).sort();
  for (const language of supportedLanguages) {
    assert.deepEqual(Object.keys(catalog[language]).sort(), expected, `${label}.${language} keys must match zh`);
    for (const [key, value] of Object.entries(catalog[language])) {
      assert.equal(typeof value, "string", `${label}.${language}.${key} must be a string`);
      assert.ok(value.trim(), `${label}.${language}.${key} must not be empty`);
      assert.notEqual(value, key, `${label}.${language}.${key} must not expose its raw key`);
      const expectedTokens = [...catalog.zh[key].matchAll(/\{([^{}]+)\}/g)].map((match) => match[1]).sort();
      const actualTokens = [...value.matchAll(/\{([^{}]+)\}/g)].map((match) => match[1]).sort();
      assert.deepEqual(actualTokens, expectedTokens, `${label}.${language}.${key} placeholders must match zh`);
    }
  }
}

test("zh/en/ja translation and label catalogs have identical complete key sets", () => {
  assert.deepEqual([...supportedLanguages], ["zh", "en", "ja"]);
  assert.equal(normalizeLanguage("en-US"), "en");
  assert.equal(normalizeLanguage("unknown"), "zh");

  const diff = translationKeyDiff();
  for (const language of supportedLanguages) {
    assert.deepEqual(diff[language], { missing: [], extra: [] });
  }
  assertCatalogParity(translations, "translations");

  const expectedLabels = Object.keys(labels.zh).sort();
  for (const language of supportedLanguages) {
    assert.deepEqual(Object.keys(labels[language]).sort(), expectedLabels, `labels.${language} keys must match zh`);
  }
});

test("translation lookup never returns undefined or an untranslated raw key", () => {
  for (const language of supportedLanguages) {
    for (const key of Object.keys(translations.zh)) {
      assert.equal(translationFor(key, language), translations[language][key]);
    }
  }
  assert.equal(translationFor("missing-translation-key", "en"), "");
  assert.equal(translationFor(undefined, "ja"), "");
});

test("every literal public t() and data-i18n reference exists in all languages", async () => {
  const publicSources = [mainSource];
  for (const directory of ["core", "features", "routes"]) {
    const files = await filesBelow(path.join(root, "js", directory));
    publicSources.push(...await Promise.all(files.map((file) => readFile(file, "utf8"))));
  }
  const keys = new Set(publicSources.flatMap((source) => literalMatches(source, /\bt\s*\(\s*["']([^"']+)["']/g)));
  for (const source of [indexSource, transferFragment]) {
    literalMatches(source, /data-i18n(?:-placeholder|-aria-label|-title|-alt)?=["']([^"']+)["']/g)
      .forEach((key) => keys.add(key));
  }
  literalMatches(chatSource, /dataset\.i18n\s*=\s*["']([^"']+)["']/g).forEach((key) => keys.add(key));

  assert.ok(keys.size > 100, "the test must cover the real public copy surface");
  for (const key of keys) {
    for (const language of supportedLanguages) {
      assert.equal(typeof translations[language][key], "string", `${language}.${key} is referenced but missing`);
      assert.ok(translations[language][key].trim(), `${language}.${key} is referenced but empty`);
    }
  }
});

test("language scope includes shell and the active page but excludes hidden route nodes", () => {
  const activePage = { id: "knowledge" };
  const hiddenPage = { id: "chatroom" };
  const shellNode = { closest: () => null, textContent: "shell-old" };
  const activeNode = { closest: () => activePage, textContent: "active-old" };
  const hiddenNode = { closest: () => hiddenPage, textContent: "hidden-old" };
  const nodes = [shellNode, activeNode, hiddenNode];
  const identities = [...nodes];

  nodes.filter((node) => isI18nNodeInScope(node, activePage)).forEach((node) => {
    node.textContent = "localized";
  });

  assert.equal(shellNode.textContent, "localized");
  assert.equal(activeNode.textContent, "localized");
  assert.equal(hiddenNode.textContent, "hidden-old");
  assert.deepEqual(nodes, identities, "localization must retain every route node identity");
});

test("setLanguage updates only shell and active-route state without lifecycle restart", () => {
  const setLanguageSource = extractFunction(mainSource, "setLanguage");
  const captureSource = extractFunction(mainSource, "captureLanguageSwitchContext");
  const syncSource = extractFunction(mainSource, "syncActiveRouteLanguage");
  const navigateSource = extractFunction(mainSource, "navigate");

  assert.doesNotMatch(setLanguageSource, /renderAll\s*\(/);
  assert.doesNotMatch(setLanguageSource, /restartActiveRouteLifecycle|transitionRouteLifecycle|replaceChildren|innerHTML/);
  assert.equal((setLanguageSource.match(/isI18nNodeInScope/g) || []).length, 5);
  const routeCommitIndex = navigateSource.indexOf("document.body.dataset.route = nextRoute;");
  const routeLocalizationIndex = navigateSource.indexOf("localizeRouteLanguage(nextRoute);");
  assert.ok(routeCommitIndex >= 0 && routeLocalizationIndex > routeCommitIndex,
    "navigation must commit the active route before localizing only that route");

  assert.match(captureSource, /pendingListScrollTop\s*=\s*list\.scrollTop/);
  assert.match(captureSource, /pendingDetailScrollTop\s*=\s*detail\.scrollTop/);
  assert.match(syncSource, /module\.loadArticles/);
  assert.match(syncSource, /module\.loadVideos/);
  assert.match(syncSource, /quickTransfer\.setLanguage\(language\)/);
  assert.match(syncSource, /get\("chatroom"\)\?\.syncLanguage\(\)/);
  assert.doesNotMatch(syncSource, /restartActiveRouteLifecycle|transitionRouteLifecycle|navigate\s*\(/);
});

test("language synchronization preserves form drafts and pending Transfer context", () => {
  const chatLanguageSource = extractFunction(chatSource, "syncLanguage");
  const transferLanguageSource = extractFunction(transferSource, "setLanguage");

  assert.doesNotMatch(accountSource, /replaceChildren\s*\(/);
  assert.doesNotMatch(chatLanguageSource, /chat-message-input|\.value\s*=|replaceChildren|hideChatPrivateRoomForm/);
  assert.doesNotMatch(transferLanguageSource, /clearPendingFiles|pendingFiles\.clear|textInput\.value\s*=|invalidateRoomContext/);
  assert.match(transferLanguageSource, /renderPendingFiles\(\)/);
  assert.match(transferLanguageSource, /renderTasks\(\)/);
});

test("Quick Transfer zh/en/ja copy sets are identical and never fall back to raw keys", () => {
  const transferCopy = vm.runInNewContext(`(${extractObjectLiteral(transferSource, "const COPY =")})`);
  const loaderCopy = vm.runInNewContext(`(${extractObjectLiteral(transferLoaderSource, "const COPY =")})`);
  assertCatalogParity(transferCopy, "transfer COPY");
  assertCatalogParity(loaderCopy, "transfer loader COPY");

  const transferTextSource = extractFunction(transferSource, "text");
  assert.doesNotMatch(transferTextSource, /\|\|\s*key|\?\?\s*key|return\s+key/);
  assert.match(transferTextSource, /typeof localized === "string" \? localized : ""/);

  const referenced = new Set([
    ...literalMatches(transferFragment, /data-transfer-(?:copy|placeholder)=["']([^"']+)["']/g),
    ...literalMatches(transferSource, /\btext\s*\(\s*["']([^"']+)["']/g)
  ]);
  for (const key of referenced) {
    for (const language of supportedLanguages) {
      assert.equal(typeof transferCopy[language][key], "string", `transfer COPY ${language}.${key} is missing`);
    }
  }
});

test("Tools display names are trilingual while the resources route stays backward compatible", () => {
  const expected = {
    zh: { navResources: "工具区", navResourcesBuilding: "工具区", resourcesTitle: "工具区", dockResources: "工具" },
    en: { navResources: "Tools", navResourcesBuilding: "Tools", resourcesTitle: "Tools", dockResources: "Tools" },
    ja: { navResources: "ツール", navResourcesBuilding: "ツール", resourcesTitle: "ツール", dockResources: "ツール" }
  };
  for (const language of supportedLanguages) {
    for (const [key, value] of Object.entries(expected[language])) {
      assert.equal(translations[language][key], value, `${language}.${key} must use the Tools display name`);
    }
  }

  const transferCopy = vm.runInNewContext(`(${extractObjectLiteral(transferSource, "const COPY =")})`);
  assert.deepEqual(
    {
      zh: { back: transferCopy.zh.back, loginBack: transferCopy.zh.loginBack },
      en: { back: transferCopy.en.back, loginBack: transferCopy.en.loginBack },
      ja: { back: transferCopy.ja.back, loginBack: transferCopy.ja.loginBack }
    },
    {
      zh: { back: "返回工具区", loginBack: "返回工具列表" },
      en: { back: "Back to Tools", loginBack: "Back to tool list" },
      ja: { back: "ツールへ戻る", loginBack: "ツール一覧へ戻る" }
    }
  );
  assert.match(transferFragment, /data-transfer-copy="back">返回工具区</);
  assert.match(transferFragment, /data-transfer-copy="loginBack">返回工具列表</);
  assert.doesNotMatch(transferSource, /返回资源区|Back to Resources|リソースへ戻る|返回资源列表|Back to resource list|リソース一覧へ戻る/);

  assert.match(indexSource, /<section class="page" id="resources" aria-labelledby="resources-title">/);
  assert.match(indexSource, /data-route="resources"/);
  assert.match(indexSource, /data-i18n="navResourcesBuilding">工具区</);
  assert.match(indexSource, /data-i18n="resourcesTitle">工具区</);
  assert.match(indexSource, /data-route="resources"[\s\S]*?data-i18n="navResources">工具区<\/span><span class="dock-label-short" data-i18n="dockResources">工具<\/span>/);
  assert.match(mainSource, /const pageIds = \["home", "knowledge", "videos", "resources", "games", "blog", "chatroom", "about"\]/);
  for (const legacyTag of ["资源区", "Resources", "リソース"]) {
    assert.match(
      mainSource,
      new RegExp(`"${legacyTag}": \\{ zh: "工具区", en: "Tools", ja: "ツール" \\}`),
      `${legacyTag} article tags must render with the Tools display name`
    );
  }

  const router = createRouter({
    routes: ["home", "knowledge", "resources"],
    location: { hash: "", pathname: "/", origin: "https://lusu575.com", search: "" }
  });
  assert.deepEqual(router.parseRouteHash("#resources"), { route: "resources", articleSlug: "" });
  assert.equal(router.routeUrl("resources"), "/#resources");
});
