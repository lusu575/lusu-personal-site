import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("welcome is version-triggered and records completion only when closed", async () => {
  const source = await read("js/main.js");
  assert.match(source, /const welcomeStorageKey = "lusu-welcome-version"/);
  assert.match(source, /safeSessionGet\(welcomeStorageKey\) === welcomeContentVersion/);
  assert.match(source, /if \(wasOpen\) \{\s*markWelcomeSeen\(\)/);
  assert.doesNotMatch(source, /lusu-welcome-seen-\$\{today\}/);
  assert.match(source, /const forceWelcome = welcomeMode === "1"/);
});

test("welcome updates remain compact and preserve complete titles", async () => {
  const [source, css] = await Promise.all([
    read("js/main.js"),
    read("css/style.css")
  ]);
  assert.match(source, /siteUpdateArticles\(\)\.slice\(0, 3\)/);
  assert.match(source, /title\.textContent = fullTitle/);
  assert.match(source, /detail\.textContent = publishedDate/);
  assert.doesNotMatch(source, /truncateText\(fullTitle, 28\)/);
  assert.match(css, /\.welcome-main h2 \.welcome-glad-line[\s\S]*?white-space: nowrap/);
});

test("desktop icons expose one roving tab stop and two-dimensional keys", async () => {
  const source = await read("js/main.js");
  assert.match(source, /function syncDesktopIconRovingTabindex/);
  assert.match(source, /button\.tabIndex = button === current \? 0 : -1/);
  for (const key of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"]) {
    assert.ok(source.includes(key), `missing desktop icon key: ${key}`);
  }
  assert.match(source, /desktopIconGrid\?\.addEventListener\("keydown", handleDesktopIconKeydown\)/);
});

test("social icon names retain the platform and announce an external link", async () => {
  const source = await read("js/main.js");
  assert.match(source, /const accessibleLabel = `\$\{platform\.label\} · \$\{t\("externalButton"\)\}`/);
  assert.match(source, /anchor\.setAttribute\("aria-label", accessibleLabel\)/);
});
