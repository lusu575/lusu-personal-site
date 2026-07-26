import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

const resourcesRoute = read("js/routes/resources.mjs");
const resourcesContentSource = read("js/data/resources-content.mjs");
const gamesRoute = read("js/routes/games.mjs");
const gamesCss = read("css/routes/games.css");
const mobileCss = read("css/mobile-ios-shell.css");
const main = read("js/main.js");
const index = read("index.html");

test("Lazy route CSS stays before the mobile responsive authority", () => {
  assert.match(index, /<link\b(?=[^>]*\bdata-mobile-shell-style\b)[^>]*href="\/css\/mobile-ios-shell\.css\?v=[^"]+"/);
  assert.match(main, /querySelector\("link\[data-mobile-shell-style\]"\)/);
  assert.match(main, /document\.head\.insertBefore\(link,\s*mobileShellStyle\)/);
  assert.match(main, /else\s*\{\s*document\.head\.appendChild\(link\)/);
});

test("Resources hides a redundant single-category filter and restores it for multiple categories", () => {
  assert.match(resourcesRoute, /availableCategoryValues\.length <= 1[\s\S]*activeFilters\.resources = "all"[\s\S]*target\.hidden = true[\s\S]*target\.replaceChildren\(\)/);
  assert.match(resourcesRoute, /target\.hidden = false[\s\S]*const entries = \[[\s\S]*value: "all"/);
  assert.match(read("css/style.css"), /#resource-categories\[hidden\]\s*\{\s*display:\s*none/);
});

test("Resources models temporary availability as retention instead of file size", async () => {
  const { resourcesContent } = await import(new URL("js/data/resources-content.mjs", root));
  const transfer = resourcesContent.resources.find((item) => item.action === "quick-transfer");
  assert.deepEqual(transfer.retention, { zh: "24 小时", en: "24 hours", ja: "24時間" });
  assert.equal("size" in transfer, false);
  assert.doesNotMatch(resourcesContentSource, /24 HOURS/);
  assert.match(resourcesRoute, /label\("retention"\):?[^\n]*localText\(item\.retention\)/);
});

test("Resource cards use content-sized rows and a bottom action row on mobile", () => {
  const desktopCss = read("css/style.css");
  assert.match(desktopCss, /#resource-list\s*>\s*\.resource-card\s*\{[\s\S]*height:\s*auto[\s\S]*min-height:\s*150px[\s\S]*max-height:\s*none/);
  assert.match(mobileCss, /#resource-list\s*>\s*\.resource-card\s*\{[\s\S]*grid-template-rows:\s*auto\s+44px[\s\S]*min-height:\s*0[\s\S]*align-self:\s*stretch/);
});

test("Games exposes all supported languages and cloud-save capability before secondary provenance", () => {
  const primaryIndex = gamesRoute.indexOf('className = "meta-row game-primary-meta"');
  const actionIndex = gamesRoute.indexOf('action.className = "card-action"');
  const secondaryIndex = gamesRoute.indexOf('className = "game-secondary-details"');
  assert.ok(primaryIndex > 0 && primaryIndex < actionIndex);
  assert.ok(secondaryIndex > primaryIndex);
  assert.match(gamesRoute, /meta\.append\(languageLabel,\s*\.\.\.languageSupportTagElements\(item\)\)/);
  assert.doesNotMatch(gamesRoute, /onlyCurrent:\s*true/);
  assert.match(gamesRoute, /gameCloudSaveReady[\s\S]*details\.className = "game-secondary-details"/);
  assert.match(gamesRoute, /gameLicenseLabel[\s\S]*safeGithubUrl\(item\.repo\)/);
  assert.match(gamesCss, /\.game-secondary-details\s*>\s*summary\s*\{[\s\S]*min-height:\s*44px/);
  assert.match(gamesCss, /\.game-main p\s*\{[\s\S]*-webkit-line-clamp:\s*3/);
  assert.match(gamesRoute, /onRevalidated\(result\)[\s\S]*gameConfigStale[\s\S]*renderGames\(\{\s*load:\s*false\s*\}\)/);
  assert.match(mobileCss, /@media\s*\(orientation:\s*landscape\)\s*and\s*\(max-height:\s*520px\)[\s\S]*#games\s+\.game-card\s*\{[\s\S]*min-height:\s*228px/);
});

test("every public game has its own generated cover icon", () => {
  const catalog = JSON.parse(read("games/catalog.json"));
  const covers = catalog.games.map((game) => game.cover);
  assert.equal(covers.length, 5);
  assert.equal(new Set(covers).size, covers.length);
  for (const cover of covers) {
    assert.match(cover, /^\.\.\/assets\/images\/generated-icons\/[a-z0-9-]+\.png\?v=20260719-content-experience-fixes-r1$/);
  }
});

test("Games consumes the full desktop height with one list scroll owner", () => {
  assert.match(gamesCss, /#games\s+\.xp-window\s*\{[\s\S]*height:\s*calc\(100dvh\s*-\s*var\(--chrome-window-compact-reserve\)\)[\s\S]*max-height:\s*calc\(100dvh\s*-\s*var\(--chrome-window-compact-reserve\)\)/);
  assert.match(gamesCss, /\.game-list\s*\{[\s\S]*flex:\s*1\s+1\s+auto[\s\S]*min-height:\s*0[\s\S]*overflow-y:\s*auto/);
  assert.doesNotMatch(gamesCss, /\.game-list\s*\{[^}]*max-height:/);
});

test("Unpublished Blog has no top-level dead end and legacy hashes merge into Knowledge", async () => {
  const { blogManifest } = await import(new URL("js/data/blog-manifest.mjs", root));
  const { blogContent } = await import(new URL("js/data/blog-content.mjs", root));
  const publishedCount = blogContent.filter((item) => item.published === true && (item.url || item.content)).length;
  assert.equal(blogManifest.publishedCount, publishedCount, "Blog availability projection must match published fallback content");
  assert.equal(publishedCount, 0);
  assert.equal((index.match(/data-blog-entry[^>]*hidden/g) || []).length, 2);
  assert.doesNotMatch(index, /class="notepad-menu"/);
  assert.match(main, /requestedRoute === "blog" && !blogRouteAvailable \? "knowledge" : requestedRoute/);
  assert.match(main, /parsed\.route === "blog" && !blogRouteAvailable[\s\S]*syncBrowserUrl\("knowledge", "", \{ replaceEntry: true \}\)/);
});

test("Published Blog cards never render a pretend disabled menu action", () => {
  const start = main.indexOf("function blogCardElement");
  const end = main.indexOf("function blogEmptyStateElement", start);
  const body = main.slice(start, end);
  assert.match(body, /\^\\\/articles\\\//);
  assert.match(body, /document\.createElement\("a"\)/);
  assert.doesNotMatch(body, /aria-disabled|blogPending|createElement\("button"\)/);
});
