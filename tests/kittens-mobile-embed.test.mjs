import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Kittens embedded page disables third-party analytics and KGNet", async () => {
  const [index, game, toolbar, buildVersionText] = await Promise.all([
    read("games/kittens-game/source/index.html"),
    read("games/kittens-game/source/game.js"),
    read("games/kittens-game/source/js/jsx/toolbar.jsx.js"),
    read("games/kittens-game/source/build.version.json")
  ]);
  const buildVersion = JSON.parse(buildVersionText);

  assert.equal(buildVersion.buildRevision, 4);
  assert.match(index, /res\/lusu-embedded\.css\?v=20260726-mobile-r3/);
  assert.match(index, /disableExternalAnalytics:\s*true/);
  assert.match(index, /disableKgnet:\s*true/);
  assert.doesNotMatch(index, /googletagmanager|google-analytics|gtag\s*\(/i);
  assert.doesNotMatch(game, /localhost:7780/);
  assert.match(game, /isRemoteDisabled:\s*function/);
  assert.match(game, /if\s*\(this\.isRemoteDisabled\(\)\)\s*\{\s*return \$\.Deferred\(\)\.resolve\(null\)\.promise\(\)/);
  assert.match(toolbar, /LusuKittensEmbed\s*&&\s*window\.LusuKittensEmbed\.disableKgnet/);
  const happinessWidget = toolbar.slice(
    toolbar.indexOf("WToolbarHappiness"),
    toolbar.indexOf("WToolbarEnergy")
  );
  assert.doesNotMatch(happinessWidget, /LusuKittensEmbed|disableKgnet/);
});

test("Kittens sets the shell language before libraries and loads only the active theme", async () => {
  const [index, game] = await Promise.all([
    read("games/kittens-game/source/index.html"),
    read("games/kittens-game/source/game.js")
  ]);

  const earlyLanguageAt = index.indexOf("syncEarlyDocumentLanguage");
  const firstLibraryAt = index.indexOf('src="lib/react.min.js"');
  assert.ok(earlyLanguageAt >= 0 && earlyLanguageAt < firstLibraryAt);
  assert.match(index, /zh:\s*"zh-CN"[\s\S]*?en:\s*"en"[\s\S]*?ja:\s*"ja"/);
  assert.match(index, /localStorage\.getItem\("com\.nuclearunicorn\.kittengame\.language"\)/);
  assert.match(index, /document\.documentElement\.lang\s*=\s*languageMap\[storedLanguage\]\s*\|\|\s*"en"/);

  assert.match(index, /var loadedThemes\s*=\s*Object\.create\(null\)/);
  assert.match(index, /function loadActiveTheme\(\)/);
  assert.match(index, /new MutationObserver\(loadActiveTheme\)/);
  assert.match(index, /def\.then\(watchThemeSelection\)/);
  assert.doesNotMatch(index, /for\s*\([^)]*schemes\.length[\s\S]*?loadTheme\(schemes\[i\]/);
  assert.match(game, /toggleScheme:\s*function\(themeId\)\s*\{[\s\S]*?window\.loadTheme\(themeId,\s*window\.buildRevision\s*\|\|\s*Date\.now\(\)\)/);

  const themeDirectory = new URL("../games/kittens-game/source/res/", import.meta.url);
  const themeFiles = (await readdir(themeDirectory)).filter((name) => /^theme_.*\.css$/.test(name));
  assert.equal(themeFiles.length, 27);
  for (const themeFile of themeFiles) {
    const themeCss = await readFile(new URL(themeFile, themeDirectory), "utf8");
    assert.doesNotMatch(themeCss, /^\s*@import\s+url\(["']?https?:\/\//im, `${themeFile} must not import an external stylesheet`);
  }
});

test("Kittens mobile override removes fixed canvas widths and preserves usable touch targets", async () => {
  const css = await read("games/kittens-game/source/res/lusu-embedded.css");

  assert.match(css, /@media\s*\(max-width:\s*900px\)/);
  assert.match(css, /body #gamePageContainer\s*\{[\s\S]*?width:\s*100%\s*!important[\s\S]*?min-width:\s*0\s*!important/);
  assert.match(css, /body #game\.lusu-embedded-game\s*\{[\s\S]*?display:\s*flex\s*!important[\s\S]*?flex-direction:\s*column/);
  for (const selector of ["#leftColumn", "#midColumn", "#rightColumn"]) {
    assert.match(css, new RegExp(selector.replace("#", "\\#")));
  }
  assert.match(css, /body \.btn,\s*body \.btn\.modern\s*\{[\s\S]*?min-height:\s*44px/);
  assert.match(css, /body \.res-toolbar \.link,[\s\S]*?min-width:\s*44px[\s\S]*?min-height:\s*44px/);
  assert.match(css, /body #topBar \.links-block a\s*\{[\s\S]*?min-width:\s*44px[\s\S]*?min-height:\s*44px[\s\S]*?height:\s*44px/);
  assert.match(css, /body #topBar \.links-block a\s*\{[\s\S]*?flex:\s*0 0 auto[\s\S]*?width:\s*max-content[\s\S]*?white-space:\s*nowrap/);
  assert.match(css, /body #topBar \.links-block\s*\{[\s\S]*?flex-wrap:\s*wrap[\s\S]*?width:\s*100%[\s\S]*?overflow:\s*visible[\s\S]*?white-space:\s*normal/);
  assert.match(css, /body \.tabsContainer a\.tab,[\s\S]*?body \.right-tab-header a\s*\{[\s\S]*?min-width:\s*44px[\s\S]*?min-height:\s*44px[\s\S]*?height:\s*44px/);
  assert.match(css, /body \.bldTopContainer > a,[\s\S]*?body #undoBtn\s*\{[\s\S]*?min-width:\s*44px[\s\S]*?min-height:\s*44px[\s\S]*?height:\s*44px/);
  assert.match(css, /body #gameLog\s*\{[\s\S]*?overflow-y:\s*auto\s*!important/);
});
