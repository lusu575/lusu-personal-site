import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  WALLPAPER_TIME_THEMES,
  createWallpaperTimeOverride,
  nextWallpaperTimeBoundary,
  parseWallpaperTimeOverride,
  wallpaperTimeThemeAt
} from "../js/core/wallpaper-time.mjs";

const root = new URL("../", import.meta.url);
const [indexHtml, styleCss, motionCss, mainJs, sourceMetadata] = await Promise.all([
  readFile(new URL("index.html", root), "utf8"),
  readFile(new URL("css/style.css", root), "utf8"),
  readFile(new URL("css/motion-system.css", root), "utf8"),
  readFile(new URL("js/main.js", root), "utf8"),
  readFile(new URL("assets/images/wallpaper-switch/wallpaper-time-switch.source.json", root), "utf8")
]);
const sourceRecord = JSON.parse(sourceMetadata);

function localDate(day, hour, minute = 0, second = 0, millisecond = 0) {
  return new Date(2026, 7, day, hour, minute, second, millisecond);
}

function localParts(value) {
  return [
    value.getFullYear(),
    value.getMonth() + 1,
    value.getDate(),
    value.getHours(),
    value.getMinutes(),
    value.getSeconds(),
    value.getMilliseconds()
  ];
}

function attribute(markup, name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return markup.match(new RegExp(`\\b${escapedName}="([^"]*)"`))?.[1] ?? null;
}

function ruleBody(source, selector) {
  const marker = `${selector} {`;
  const ruleStart = source.indexOf(marker);
  assert.notEqual(ruleStart, -1, `missing CSS rule: ${selector}`);
  const bodyStart = source.indexOf("{", ruleStart) + 1;
  const bodyEnd = source.indexOf("}", bodyStart);
  assert.notEqual(bodyEnd, -1, `unterminated CSS rule: ${selector}`);
  return source.slice(bodyStart, bodyEnd);
}

function pngDimensions(buffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(buffer.subarray(0, 8).equals(signature), true, "asset must be a PNG");
  assert.equal(buffer.toString("ascii", 12, 16), "IHDR", "PNG must start with IHDR");
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

test("wallpaper periods change at the four exact local-time boundaries", () => {
  assert.deepEqual(WALLPAPER_TIME_THEMES, ["morning", "day", "dusk", "night"]);
  const transitions = [
    { hour: 5, before: "night", at: "morning" },
    { hour: 11, before: "morning", at: "day" },
    { hour: 17, before: "day", at: "dusk" },
    { hour: 20, before: "dusk", at: "night" }
  ];

  for (const transition of transitions) {
    const boundary = localDate(9, transition.hour);
    assert.equal(wallpaperTimeThemeAt(new Date(boundary.getTime() - 1)), transition.before);
    assert.equal(wallpaperTimeThemeAt(boundary), transition.at);
  }
});

test("next wallpaper boundary is strictly after now, including exact boundaries", () => {
  const cases = [
    { from: localDate(9, 4, 59, 59, 999), expected: [2026, 8, 9, 5, 0, 0, 0] },
    { from: localDate(9, 5), expected: [2026, 8, 9, 11, 0, 0, 0] },
    { from: localDate(9, 11), expected: [2026, 8, 9, 17, 0, 0, 0] },
    { from: localDate(9, 17), expected: [2026, 8, 9, 20, 0, 0, 0] },
    { from: localDate(9, 20), expected: [2026, 8, 10, 5, 0, 0, 0] }
  ];

  for (const entry of cases) {
    const boundary = nextWallpaperTimeBoundary(entry.from);
    assert.ok(boundary instanceof Date);
    assert.ok(boundary.getTime() > entry.from.getTime());
    assert.deepEqual(localParts(boundary), entry.expected);
  }
  assert.equal(nextWallpaperTimeBoundary("not-a-date"), null);
});

test("manual override is canonical, boundary-bound, tamper-resistant, and expires exactly", () => {
  const now = localDate(9, 12, 34, 56, 789);
  const record = createWallpaperTimeOverride("dusk", now);
  assert.deepEqual(record, {
    v: 1,
    theme: "dusk",
    selectedAt: now.getTime(),
    expiresAt: localDate(9, 17).getTime()
  });
  assert.equal(Object.isFrozen(record), true);

  const parsed = parseWallpaperTimeOverride(JSON.stringify({ ...record, injected: "ignored" }), now);
  assert.deepEqual(parsed, record);
  assert.equal(Object.hasOwn(parsed, "injected"), false);
  assert.equal(Object.isFrozen(parsed), true);

  const tampered = [
    { ...record, v: 2 },
    { ...record, theme: "sunrise" },
    { ...record, expiresAt: record.expiresAt + 1 },
    createWallpaperTimeOverride("night", new Date(now.getTime() + 5001)),
    { ...record, selectedAt: Number.NaN }
  ];
  for (const value of tampered) {
    assert.equal(parseWallpaperTimeOverride(value, now), null);
  }
  assert.equal(parseWallpaperTimeOverride("{broken", now), null);
  assert.equal(parseWallpaperTimeOverride(record, new Date(record.expiresAt)), null);
  assert.equal(createWallpaperTimeOverride("sunrise", now), null);
});

test("top-bar switch exposes four localized radios with one roving tab stop", () => {
  const groupStart = indexHtml.indexOf('<div class="wallpaper-time-switch"');
  const accountStart = indexHtml.indexOf('<div class="account-widget"', groupStart);
  assert.ok(groupStart >= 0 && accountStart > groupStart, "switch must be a sibling before the account widget");
  const groupMarkup = indexHtml.slice(groupStart, accountStart);
  const groupOpeningTag = groupMarkup.slice(0, groupMarkup.indexOf(">") + 1);
  assert.equal(attribute(groupOpeningTag, "role"), "radiogroup");
  assert.equal(attribute(groupOpeningTag, "data-i18n-aria-label"), "wallpaperTimeSwitchAria");

  const options = [...groupMarkup.matchAll(/<button\b[^>]*\bclass="wallpaper-time-option"[^>]*>/g)].map((match) => match[0]);
  assert.equal(options.length, 4);
  assert.deepEqual(options.map((option) => attribute(option, "data-wallpaper-time")), WALLPAPER_TIME_THEMES);
  assert.ok(options.every((option) => attribute(option, "role") === "radio"));
  assert.deepEqual(
    options.map((option) => attribute(option, "data-i18n-aria-label")),
    ["wallpaperTimeMorning", "wallpaperTimeDay", "wallpaperTimeDusk", "wallpaperTimeNight"]
  );
  assert.equal(options.filter((option) => attribute(option, "aria-checked") === "true").length, 1);
  assert.equal(options.filter((option) => attribute(option, "tabindex") === "0").length, 1);
  assert.deepEqual(
    [...groupMarkup.matchAll(/data-wallpaper-effect="(morning|day|dusk|night)"/g)].map((match) => match[1]),
    WALLPAPER_TIME_THEMES
  );
  for (const theme of WALLPAPER_TIME_THEMES) {
    assert.equal(
      [...groupMarkup.matchAll(new RegExp(`fx-${theme}\\.png\\?v=20260809-wallpaper-time-switch-r2`, "g"))].length,
      3
    );
    assert.equal(
      [...groupMarkup.matchAll(new RegExp(`data-src="/assets/images/wallpaper-switch/fx-${theme}\\.png\\?v=20260809-wallpaper-time-switch-r2"`, "g"))].length,
      3
    );
  }
  assert.match(groupMarkup, /id="wallpaper-time-status"[^>]*aria-live="polite"[^>]*aria-atomic="true"/);
});

test("switch geometry preserves four 44px hit targets and generated PNG dimensions", async () => {
  const switchRule = ruleBody(styleCss, ".wallpaper-time-switch");
  const optionRule = ruleBody(styleCss, ".wallpaper-time-option");
  const selectorRule = ruleBody(styleCss, ".wallpaper-time-selector");
  assert.match(switchRule, /grid-template-columns:\s*repeat\(4,\s*44px\)/);
  assert.match(switchRule, /width:\s*176px/);
  assert.match(switchRule, /height:\s*44px/);
  for (const property of ["width", "min-width", "height", "min-height"]) {
    assert.match(optionRule, new RegExp(`${property}:\\s*44px`));
  }
  assert.match(selectorRule, /top:\s*8px/);
  assert.match(selectorRule, /width:\s*28px/);
  assert.match(selectorRule, /height:\s*28px/);
  assert.match(selectorRule, /transform:\s*translate3d\(8px,\s*0,\s*0\)/);
  assert.match(motionCss, /\.wallpaper-time-selector img\s*\{[\s\S]*transition:\s*transform var\(--motion-release\)/);
  assert.match(motionCss, /\.wallpaper-time-option:active ~ \.wallpaper-time-selector img\s*\{[\s\S]*transition-duration:\s*var\(--motion-press\)/);

  const expectedAssets = [
    {
      file: "time-track.png",
      width: 880,
      height: 192,
      sha256: "e25e91b011196f27f6ad09e9f5a60d5a2b0fb51a4544e5d5153edcf604a32b2b"
    },
    {
      file: "time-selector.png",
      width: 200,
      height: 200,
      sha256: "5a123ab809e32bc4763832fcd8396c22622b87e6019351aad4caa59f71b6a6b5"
    },
    {
      file: "fx-morning.png",
      width: 256,
      height: 256,
      sha256: "4b1da1f99f741eae40a0133d88f496c02d9d6ff742719061dd8b36728abaa7a9"
    },
    {
      file: "fx-day.png",
      width: 256,
      height: 256,
      sha256: "d260d315128b474929034ae6367e9d5e989122bcca2bded807909a640f2e3d27"
    },
    {
      file: "fx-dusk.png",
      width: 256,
      height: 256,
      sha256: "a0cf8dc3e4e9f45f78ee8295b965572ceade1db07faa9d4d87869e42aaad2df8"
    },
    {
      file: "fx-night.png",
      width: 256,
      height: 256,
      sha256: "4e4cc53066ece45c25ca9624429c82c6ba584f4101dff40aa5af632d7acc37ae"
    }
  ];
  const metadataByFile = new Map(sourceRecord.generated_assets.map((asset) => [asset.file, asset]));
  for (const expected of expectedAssets) {
    const buffer = await readFile(new URL(`assets/images/wallpaper-switch/${expected.file}`, root));
    assert.deepEqual(pngDimensions(buffer), { width: expected.width, height: expected.height });
    assert.equal(createHash("sha256").update(buffer).digest("hex"), expected.sha256);
    assert.deepEqual(metadataByFile.get(expected.file)?.final_png, {
      width: expected.width,
      height: expected.height,
      sha256: expected.sha256
    });
  }
  assert.equal(sourceRecord.date, "2026-08-09");
  assert.equal(sourceRecord.generator, "imagegen");
  assert.equal(sourceRecord.generated_assets.length, 6);
  assert.ok(sourceRecord.generated_assets.every((asset) => asset.prompt_summary && asset.mechanical_processing.length));
  assert.doesNotMatch(JSON.stringify(sourceRecord), /\bimage2\b/i);
});

test("selector motion is transform-only with strong easing and immediate accessibility modes", () => {
  const selectorMotionRule = ruleBody(motionCss, ".wallpaper-time-selector");
  assert.match(motionCss, /--motion-window:\s*220ms/);
  assert.match(motionCss, /--motion-ease-in-out:\s*cubic-bezier\(0\.77,\s*0,\s*0\.175,\s*1\)/);
  assert.match(selectorMotionRule, /transition:\s*transform\s+var\(--motion-window\)\s+var\(--motion-ease-in-out\)/);
  assert.match(selectorMotionRule, /will-change:\s*transform/);
  assert.doesNotMatch(selectorMotionRule, /\banimation\s*:/);
  assert.match(
    motionCss,
    /html\[data-input-method="keyboard"\]\s+\.wallpaper-time-selector,[\s\S]*?html\[data-motion="reduced"\]\s+\.wallpaper-time-selector,[\s\S]*?transition:\s*none\s*!important/
  );
  assert.match(
    mainJs,
    /document\.documentElement\.dataset\.motion\s*!==\s*"full"[\s\S]*?document\.documentElement\.dataset\.inputMethod\s*===\s*"keyboard"/
  );
  assert.match(mainJs, /moveWallpaperTimeSelector\(selector,\s*8 \+ selectedIndex \* 44,\s*immediate\)/);
  assert.match(mainJs, /const overshootX = targetX \+ Math\.sign\(delta\) \* 2/);
  assert.match(mainJs, /selector\.animate\([\s\S]*?offset:\s*0\.78[\s\S]*?duration:\s*220/);
  assert.match(mainJs, /activeAnimation\.cancel\(\)/);
  assert.match(mainJs, /function playWallpaperTimeEffect\(group, theme\)[\s\S]*?stopWallpaperTimeEffect\(group\)[\s\S]*?group\.dataset\.effectTheme = theme[\s\S]*?380/);
  assert.match(mainJs, /effectAssetsReady !== "true"[\s\S]*?void ensureWallpaperTimeEffectAssets\(group\);[\s\S]*?return;[\s\S]*?dataset\.motion !== "full"[\s\S]*?document\.hidden[\s\S]*?dataset\.route !== "home"/);
  assert.doesNotMatch(mainJs, /ensureWallpaperTimeEffectAssets\(group\)\.then/);
  assert.match(mainJs, /function ensureWallpaperTimeEffectAssets[\s\S]*?\.wallpaper-time-effect-layer\[data-src\][\s\S]*?layer\.decode\(\)[\s\S]*?effectAssetsReady = "true"/);
  assert.match(mainJs, /if \(nextRoute === "home"\) void ensureWallpaperTimeEffectAssets\(\)/);
  assert.match(mainJs, /if \(immediate\)[\s\S]*?group\.dataset\.immediate = "true";[\s\S]*?else \{[\s\S]*?delete group\.dataset\.immediate/);
  assert.match(mainJs, /previousTheme && previousTheme !== state\.theme[\s\S]*?playWallpaperTimeEffect\(group, state\.theme\)/);
  for (const theme of WALLPAPER_TIME_THEMES) {
    assert.match(motionCss, new RegExp(`@keyframes wallpaper-effect-${theme}`));
    assert.match(motionCss, new RegExp(`data-effect-theme="${theme}"[\\s\\S]*?data-wallpaper-effect="${theme}"[\\s\\S]*?280ms`));
  }
  assert.match(motionCss, /is-upper[\s\S]*--wallpaper-effect-delay:\s*0ms[\s\S]*is-middle[\s\S]*28ms[\s\S]*is-lower[\s\S]*56ms/);
  assert.match(motionCss, /data-performance-tier="low"[\s\S]*\.wallpaper-time-effect-layer[\s\S]*animation:\s*none !important/);
});

test("main schedules the exact boundary, decodes on demand, and reconciles cross-tab state", () => {
  assert.match(mainJs, /from "\.\/core\/wallpaper-time\.mjs\?v=20260809-motion-polish-r2"/);
  assert.match(
    mainJs,
    /const boundary = state\.mode === "manual" && state\.override\s*\? new Date\(state\.override\.expiresAt\)\s*:\s*nextWallpaperTimeBoundary\(now\)/
  );
  assert.match(
    mainJs,
    /wallpaperTimeBoundaryTimer = window\.setTimeout\(\(\) => \{[\s\S]*?reconcileWallpaperTimeTheme\(\{ source: "schedule", announce: true \}\);[\s\S]*?Math\.max\(16, Math\.min\(2147483647, target - now\.getTime\(\) \+ 24\)\)/
  );
  assert.match(
    mainJs,
    /function decodeWallpaperAsset\(url\) \{[\s\S]*?const image = new Image\(\);[\s\S]*?image\.decoding = "async";[\s\S]*?image\.onload[\s\S]*?image\.onerror[\s\S]*?image\.src = url;[\s\S]*?image\.decode\(\)\.then/
  );
  assert.match(
    mainJs,
    /const selectedAt = new Date\(\);[\s\S]*?createWallpaperTimeOverride\(theme, selectedAt\);[\s\S]*?const previousOverride = wallpaperTimeOverride;[\s\S]*?const requestId = \+\+wallpaperTimeSelectionRequest;[\s\S]*?wallpaperTimeOverride = record;[\s\S]*?const selection = \(async \(\) => \{[\s\S]*?await warmWallpaperTheme\(theme, \{ intent: true \}\);[\s\S]*?if \(requestId !== wallpaperTimeSelectionRequest\) return false;[\s\S]*?if \(!loaded\) \{[\s\S]*?wallpaperTimeOverride = previousOverride;[\s\S]*?Date\.now\(\) >= record\.expiresAt[\s\S]*?writeWallpaperTimeOverride\(record\)/
  );
  assert.match(
    mainJs,
    /window\.addEventListener\("storage", \(event\) => \{[\s\S]*?event\.key !== wallpaperTimeOverrideStorageKey[\s\S]*?readWallpaperTimeOverride\(\)[\s\S]*?reconcileWallpaperTimeTheme\(\{ source: "storage", invalidatePendingSelection: true \}\)/
  );
  assert.match(mainJs, /if \(options\.invalidatePendingSelection\)\s*\{\s*wallpaperTimeSelectionRequest \+= 1;\s*wallpaperTimePendingManualTheme = "";\s*wallpaperTimePendingManualPromise = null;\s*wallpaperTimePreparingTheme = "";\s*wallpaperTimePreparingPromise = null;/);
  assert.match(mainJs, /wallpaperTimePendingManualTheme === state\.theme && wallpaperTimePendingManualPromise[\s\S]*?return wallpaperTimePendingManualPromise/);
  assert.match(mainJs, /wallpaperTimePendingManualTheme = theme;[\s\S]*?wallpaperTimePendingManualPromise = selection;[\s\S]*?return await selection;[\s\S]*?wallpaperTimePendingManualPromise === selection/);
  assert.match(mainJs, /window\.addEventListener\("pageshow",[\s\S]*?source: "pageshow"/);
  assert.match(mainJs, /window\.addEventListener\("focus",[\s\S]*?source: "focus"/);
  assert.match(mainJs, /document\.addEventListener\("visibilitychange",[\s\S]*?source: "visibility"/);
  assert.match(mainJs, /initWallpaperTimeSwitch\(\);/);
  assert.match(mainJs, /wallpaperCloudAssetCandidates\(theme\)[\s\S]*?cloud-\$\{name\}\.png/);
  assert.match(mainJs, /wallpaper-theme-scene-overlay[\s\S]*?:scope > \[data-wallpaper-dynamic-layer\][\s\S]*?frozenTransform = cloudStyle\.transform[\s\S]*?cloud\.style\.animation = "none"/);
  assert.match(mainJs, /const reduced = document\.documentElement\.dataset\.motion === "reduced";[\s\S]*?\? 140/);
  assert.match(mainJs, /root\.dataset\.motion === "off" \|\| document\.hidden/);
  assert.match(indexHtml, /data-immediate="true"[\s\S]*?document\.documentElement\.dataset\.timeTheme[\s\S]*?aria-checked/);
});
