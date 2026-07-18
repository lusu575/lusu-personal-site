import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { supportedLanguages, translations } from "../js/core/i18n.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (file) => readFile(path.join(root, file), "utf8");
const [indexSource, styleSource, mobileSource, motionSource, mobileShellSource, uiMotionSource, mainSource, chatRouteSource] = await Promise.all([
  read("index.html"),
  read("css/style.css"),
  read("css/mobile-ios-shell.css"),
  read("css/motion-system.css"),
  read("js/mobile-shell.js"),
  read("js/ui-motion.js"),
  read("js/main.js"),
  read("css/routes/chatroom.css")
]);

const dockKeys = ["dockHome", "dockKnowledge", "dockVideos", "dockResources", "dockGames", "dockChatroom"];

test("mobile Dock exposes six complete, distinct short labels in zh/en/ja", () => {
  for (const language of supportedLanguages) {
    const values = dockKeys.map((key) => translations[language][key]);
    assert.equal(new Set(values).size, dockKeys.length, `${language} Dock labels must remain distinct`);
    values.forEach((value, index) => {
      assert.equal(typeof value, "string", `${language}.${dockKeys[index]} must exist`);
      assert.ok(value.trim(), `${language}.${dockKeys[index]} must not be empty`);
      assert.ok(value.length <= 7, `${language}.${dockKeys[index]} must fit the 48px Dock item`);
    });
  }
  dockKeys.forEach((key) => assert.match(indexSource, new RegExp(`data-i18n=["']${key}["']`)));
  assert.match(mobileSource, /\.dock-label-short[\s\S]*font-size:\s*max\(10px,/);
  assert.match(mobileSource, /\.dock-label-full\s*\{\s*display:\s*none/);
});

test("mobile and coarse-pointer tablet contracts keep readable type and 44px targets", () => {
  assert.match(mobileSource, /:where\(input, textarea, select\)[\s\S]*font-size:\s*max\(16px, 1rem\)/);
  assert.match(mobileSource, /min-inline-size:\s*44px;[\s\S]*min-block-size:\s*44px/);
  assert.match(mobileSource, /@media \(pointer:\s*coarse\) and \(min-width:\s*761px\) and \(max-width:\s*1024px\)/);
  assert.match(styleSource, /html\[lang="ja"\][\s\S]*"Yu Gothic UI"[\s\S]*line-break:\s*strict/);
});

test("horizontal discovery uses the shared frame pipeline and keyboard-scrollable native owners", () => {
  for (const selector of [
    "#knowledge-categories",
    "#videos .filter-row",
    "#article-detail-toc-list",
    ".game-main .meta-row"
  ]) {
    assert.ok(mobileShellSource.includes(`\"${selector}\"`), `${selector} must be measured`);
  }
  assert.match(mobileShellSource, /framePipeline\.schedule\("mobile-shell:horizontal-discovery"/);
  assert.match(mobileShellSource, /node\.tabIndex\s*=\s*0/);
  assert.match(mobileShellSource, /has-overflow-before/);
  assert.match(mobileShellSource, /has-overflow-after/);
  assert.match(mobileSource, /\.has-horizontal-overflow[\s\S]*mask-image:\s*linear-gradient/);
});

test("forced colors and four effective motion tiers have explicit non-blocking fallbacks", () => {
  assert.match(styleSource, /@media \(forced-colors:\s*active\)/);
  assert.match(styleSource, /outline:\s*3px solid Highlight/);
  assert.match(styleSource, /color:\s*MarkText/);
  for (const tier of ["normal", "reduced", "off", "low-performance"]) {
    assert.ok(uiMotionSource.includes(`\"${tier}\"`), `effective motion tier ${tier} must be represented`);
  }
  assert.match(uiMotionSource, /setData\(root, "motionTier", effectiveTier\)/);
  assert.match(uiMotionSource, /root\.dataset\.performanceTier === "low"/);
  assert.match(motionSource, /html\[data-performance-tier="low"\] \.wallpaper-cloud[\s\S]*animation:\s*none !important/);

  const windowRule = motionSource.match(/\.xp-window\s*\{([\s\S]*?)\n\}/)?.[1] || "";
  assert.match(windowRule, /transform/);
  assert.match(windowRule, /opacity/);
  assert.doesNotMatch(windowRule, /(box-shadow|filter|left|top|width|height)\s+var\(--motion/);
});

test("Chat identity assets belong to the always-loaded shell and remain visible on short screens", () => {
  assert.match(styleSource, /\.chatroom-icon\s*\{[\s\S]*icon-chatroom-clean\.png\?v=20260718-resource-icons-layout-r1/);
  assert.doesNotMatch(chatRouteSource, /\.chatroom-icon\s*\{/);
  assert.match(styleSource, /\.title-icon-chatroom\s*\{[\s\S]*icon-chatroom-clean\.png\?v=20260718-resource-icons-layout-r1/);
  assert.match(mobileSource, /max-height:\s*720px[\s\S]*\.chatroom-avatar\s*\{[\s\S]*display:\s*block[\s\S]*width:\s*32px/);
  assert.match(mobileSource, /orientation:\s*landscape[\s\S]*\.chatroom-avatar\s*\{[\s\S]*display:\s*block[\s\S]*width:\s*34px/);
});

test("page navigation animates only live page content so fixed topbar and Dock never enter snapshots", () => {
  assert.match(mainSource, /useViewTransition:\s*false/);
  assert.match(uiMotionSource, /pageNavigationKeepsChromeLive\s*=\s*kind\s*===\s*"route"[\s\S]*kind\s*===\s*"app-open"[\s\S]*kind\s*===\s*"mobile-tab"/);
  assert.match(uiMotionSource, /context\.useViewTransition[\s\S]*&&\s*!pageNavigationKeepsChromeLive[\s\S]*document\.startViewTransition/);
  assert.match(uiMotionSource, /function\s+mobileTabEnterAnimation[\s\S]*translate3d[\s\S]*DURATIONS\.window/);
  assert.doesNotMatch(motionSource, /view-transition-name:\s*(?:module-page|app-screen|mobile-tab-page)/);
});

test("OPT-085 viewport ownership and OPT-088 state-preserving i18n guards remain intact", () => {
  assert.equal((mobileShellSource.match(/window\.addEventListener\("resize"/g) || []).length, 1);
  assert.equal((mobileShellSource.match(/visualViewport\?\.addEventListener\("resize"/g) || []).length, 1);
  assert.match(mobileShellSource, /requestFocusReveal/);
  assert.match(mobileShellSource, /mobileKeyboard/);
  assert.ok(dockKeys.every((key) => supportedLanguages.every((language) => translations[language][key])));
});
