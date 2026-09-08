import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("welcome is opt-in and keeps deep links uninterrupted while preserving focus isolation", async () => {
  const source = await read("js/main.js");
  const functionSource = source.match(/function maybeShowWelcome\([\s\S]*?\n}/)?.[0];
  assert.ok(functionSource);
  for (const search of ["", "?lang=en", "?welcome=0", "?welcome=1"]) {
    for (const manual of [false, true]) {
      const calls = [];
      const modal = { hidden: true, querySelector: () => ({ focus: () => calls.push("focus") }) };
      const context = {
        pageParams: new URLSearchParams(search),
        localWelcomeDayStamp: () => "2026-09-08",
        updateWelcomeGreeting: () => calls.push("greeting"),
        document: { activeElement: {}, getElementById: () => modal },
        modalFocusState: {},
        modalTriggerCandidate: (element) => element,
        cancelSurfaceClose: () => calls.push("cancel-close"),
        markWelcomeSeen: () => calls.push("seen"),
        syncModalIsolation: () => calls.push("isolate")
      };
      const open = runInNewContext(`${functionSource}; maybeShowWelcome`, context);
      open({ manual });
      const shouldOpen = manual || search === "?welcome=1";
      assert.equal(modal.hidden, !shouldOpen, `${search} manual=${manual}`);
      assert.deepEqual(calls, shouldOpen ? ["greeting", "cancel-close", "seen", "isolate", "focus"] : []);
    }
  }
  assert.match(source, /data-open-welcome/);
  assert.match(await read("index.html"), /data-open-welcome[^>]*aria-label=/);
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
