import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = new URL("../games/a-dark-room/source/", import.meta.url);
const read = (path) => readFile(new URL(path, source), "utf8");

test("A Dark Room keeps local dependencies and loads its narrow-screen override last", async () => {
  const html = await read("index.html");
  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/);
  assert.match(html, /<script src="lib\/jquery\.min\.js"><\/script>/);
  assert.doesNotMatch(html, /(?:https?:)?\/\/[^"']*jquery/i);

  const fabricatorPosition = html.indexOf('href="css/fabricator.css"');
  const mobilePosition = html.indexOf('href="css/lusu-mobile.css?v=20260726-a-dark-room-mobile-r2"');
  assert.ok(fabricatorPosition >= 0 && mobilePosition > fabricatorPosition);

  for (const asset of [
    "script/lusu-localization-overrides.js",
    "script/engine.js",
    "script/path.js",
    "css/lusu-mobile.css"
  ]) {
    const reference = `${asset}?v=20260726-a-dark-room-mobile-r2`;
    assert.equal(
      html.split(reference).length - 1,
      1,
      `${asset} must use the current A Dark Room cache version exactly once`
    );
  }
});

test("A Dark Room compact layout contains the document and preserves 44px primary controls", async () => {
  const css = await read("css/lusu-mobile.css");
  assert.match(css, /@media \(max-width: 600px\)/);
  assert.match(css, /html,\s*body\s*\{[^}]*max-width:\s*100%;[^}]*overflow-x:\s*hidden;/s);
  assert.match(css, /div#wrapper\s*\{[^}]*width:\s*100%;[^}]*max-width:\s*100%;/s);
  assert.match(css, /div\.button\s*\{[^}]*min-width:\s*44px;[^}]*min-height:\s*44px;/s);
  assert.match(css, /div\.headerButton\s*\{[^}]*min-height:\s*44px;/s);
  assert.match(css, /\.menu span\.menuBtn\s*\{[^}]*min-height:\s*44px;/s);
});

test("A Dark Room sound choice is viewport-contained and localized in all supported site languages", async () => {
  const css = await read("css/lusu-mobile.css");
  const overrides = await read("script/lusu-localization-overrides.js");
  assert.match(css, /\.eventPanel\s*\{[^}]*position:\s*fixed;[^}]*left:\s*max\(10px,[^}]*width:\s*auto !important;[^}]*max-height:\s*calc\(100dvh/s);
  assert.match(css, /\.eventPanel \.button,[^{]*\{[^}]*width:\s*100% !important;/s);

  for (const text of [
    '"Sound Available!": "可以使用声音了！"',
    '"enable audio": "开启声音"',
    '"disable audio": "关闭声音"',
    '"Sound Available!": "サウンドを利用できます！"',
    '"enable audio": "サウンドを有効にする"',
    '"disable audio": "サウンドを無効にする"'
  ]) {
    assert.ok(overrides.includes(text), `missing localization override: ${text}`);
  }
});

test("A Dark Room slider navigation uses the measured panel width instead of a mobile-breaking constant", async () => {
  const engine = await read("script/engine.js");
  const path = await read("script/path.js");
  assert.match(engine, /getPanelWidth:\s*function\(\)/);
  assert.match(engine, /panelIndex \* panelWidth/);
  assert.match(engine, /slider\.children\(\)\.css\('width', panelWidth \+ 'px'\)/);
  assert.doesNotMatch(engine, /panelIndex \* 700/);
  assert.match(path, /-Engine\.getPanelWidth\(\) \+ 'px'/);
  assert.doesNotMatch(path, /left:\s*'-700px'/);
});

test("A Dark Room throttles same-document rotation and restores compact/desktop store ownership", async () => {
  const engine = await read("script/engine.js");
  assert.match(engine, /\.on\('resize\.adrResponsive orientationchange\.adrResponsive', Engine\.scheduleResponsiveLayout\)/);
  assert.match(engine, /if\(Engine\._responsiveLayoutFrame !== null\)\s*\{\s*return;/);
  assert.match(engine, /Engine\.syncResponsiveLayout\(\)/);
  assert.match(engine, /stores\.appendTo\(panel\)\.css\(\{right: '', top: ''\}\)/);
  assert.match(engine, /stores\.appendTo\(Room\.panel\)/);
  assert.match(engine, /right: -\(panelIndex \* panelWidth\) \+ 'px'/);
  assert.match(engine, /locationSlider\.css\('left', -\(panelIndex \* panelWidth\) \+ 'px'\)/);
  assert.match(engine, /outerSlider\.css\('left', -\(outerIndex \* panelWidth\) \+ 'px'\)/);
});
