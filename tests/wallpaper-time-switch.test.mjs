import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";

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
const firstPaintMarker = 'const group = document.getElementById("wallpaper-time-switch");';
const firstPaintMarkerIndex = indexHtml.indexOf(firstPaintMarker);
const firstPaintScriptStart = indexHtml.lastIndexOf("<script>", firstPaintMarkerIndex);
const firstPaintScriptEnd = indexHtml.indexOf("</script>", firstPaintMarkerIndex);
assert.ok(firstPaintMarkerIndex >= 0 && firstPaintScriptStart >= 0 && firstPaintScriptEnd > firstPaintMarkerIndex);
const firstPaintSource = indexHtml.slice(firstPaintScriptStart + "<script>".length, firstPaintScriptEnd).trim();

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

function runSwitchFirstPaint({
  saveData = false,
  hardwareConcurrency = 8,
  deviceMemory = 8,
  mobileShell = false,
  pathname = "/",
  hash = "#home"
} = {}) {
  const makeAsset = (name, accent = false) => ({
    dataset: { src: `/${name}.png` },
    src: "",
    closest: (selector) => selector === ".wallpaper-time-accent" && accent ? {} : null,
    setAttribute(attributeName, value) {
      if (attributeName === "src") this.src = value;
    }
  });
  const assets = {
    marker: makeAsset("marker"),
    scene: makeAsset("scene"),
    roller: makeAsset("node"),
    accent: makeAsset("accent", true)
  };
  const buttons = WALLPAPER_TIME_THEMES.map((theme) => ({
    dataset: { wallpaperTime: theme },
    setAttribute() {},
    tabIndex: -1
  }));
  const group = {
    dataset: {},
    querySelectorAll(selector) {
      return selector === "[data-wallpaper-time]" ? buttons : Object.values(assets);
    }
  };
  runInNewContext(firstPaintSource, {
    Number,
    document: {
      documentElement: { dataset: { timeTheme: "night", uiShell: mobileShell ? "mobile" : "desktop" } },
      getElementById: () => group
    },
    navigator: { connection: { saveData }, hardwareConcurrency, deviceMemory },
    window: { location: { pathname, hash } }
  });
  return { assets, group };
}

function createSwitchAccentPolicy({ saveData, hardwareConcurrency, deviceMemory }) {
  const policyStart = mainJs.indexOf("const wallpaperTimeSwitchHardwareLow =");
  const policyEnd = mainJs.indexOf("function tagWallpaperTimeSwitchAssetRoles", policyStart);
  assert.ok(policyStart >= 0 && policyEnd > policyStart, "switch accent policy must remain extractable");
  const connection = { saveData };
  const context = {
    Number,
    document: { documentElement: { dataset: { performanceTier: "low" } } },
    navigator: { connection, hardwareConcurrency, deviceMemory }
  };
  runInNewContext(
    `${mainJs.slice(policyStart, policyEnd)}\n`
      + "globalThis.switchAccentAllowed = wallpaperTimeSwitchAccentAllowed;\n"
      + "globalThis.syncSwitchPerformanceTier = syncWallpaperTimeSwitchPerformanceTier;",
    context
  );
  return {
    connection,
    root: context.document.documentElement,
    allowed: context.switchAccentAllowed,
    syncPerformanceTier: context.syncSwitchPerformanceTier
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
  assert.equal([...groupMarkup.matchAll(/data-src="\/assets\/images\/wallpaper-switch\/scene-atlas\.png\?v=20260810-wallpaper-time-switch-r6"/g)].length, 4);
  assert.equal([...groupMarkup.matchAll(/data-src="\/assets\/images\/wallpaper-switch\/marker-atlas\.png\?v=20260810-wallpaper-time-switch-r6"/g)].length, 4);
  assert.equal([...groupMarkup.matchAll(/data-src="\/assets\/images\/wallpaper-switch\/node-atlas\.png\?v=20260810-wallpaper-time-switch-r6"/g)].length, 5);
  assert.equal([...groupMarkup.matchAll(/data-src="\/assets\/images\/wallpaper-switch\/accent-atlas\.png\?v=20260810-wallpaper-time-switch-r6"/g)].length, 4);
  assert.equal([...groupMarkup.matchAll(/class="wallpaper-time-scene"/g)].length, 4);
  assert.equal([...groupMarkup.matchAll(/class="wallpaper-time-accents"/g)].length, 1);
  assert.equal([...groupMarkup.matchAll(/class="wallpaper-time-accent"/g)].length, 4);
  assert.equal([...groupMarkup.matchAll(/class="wallpaper-time-marker"/g)].length, 4);
  assert.equal([...groupMarkup.matchAll(/class="wallpaper-time-celestial"/g)].length, 4);
  assert.equal([...groupMarkup.matchAll(/class="wallpaper-time-scene-atlas"/g)].length, 4);
  assert.equal([...groupMarkup.matchAll(/class="wallpaper-time-accent-atlas"/g)].length, 4);
  assert.equal([...groupMarkup.matchAll(/class="wallpaper-time-marker-atlas"/g)].length, 4);
  assert.equal([...groupMarkup.matchAll(/class="wallpaper-time-node-atlas"/g)].length, 4);
  assert.equal([...groupMarkup.matchAll(/class="wallpaper-time-roller"/g)].length, 1);
  assert.equal([...groupMarkup.matchAll(/class="wallpaper-time-roller-atlas"/g)].length, 1);
  assert.match(groupMarkup, /frame\.png\?v=20260810-wallpaper-time-switch-r6/);
  assert.match(groupMarkup, /class="wallpaper-time-roller-atlas" data-atlas-cell="roller" data-src="\/assets\/images\/wallpaper-switch\/node-atlas\.png\?v=20260810-wallpaper-time-switch-r6" width="192" height="960"/);
  assert.doesNotMatch(groupMarkup, /\/assets\/images\/wallpaper-switch\/roller\.png\?/);
  const runtimeUrls = new Set(
    [...groupMarkup.matchAll(/(?:src|data-src)="(\/assets\/images\/wallpaper-switch\/[^"?]+\.png\?v=20260810-wallpaper-time-switch-r6)"/g)]
      .map((match) => match[1])
  );
  assert.deepEqual([...runtimeUrls].sort(), [
    "/assets/images/wallpaper-switch/accent-atlas.png?v=20260810-wallpaper-time-switch-r6",
    "/assets/images/wallpaper-switch/frame.png?v=20260810-wallpaper-time-switch-r6",
    "/assets/images/wallpaper-switch/marker-atlas.png?v=20260810-wallpaper-time-switch-r6",
    "/assets/images/wallpaper-switch/node-atlas.png?v=20260810-wallpaper-time-switch-r6",
    "/assets/images/wallpaper-switch/scene-atlas.png?v=20260810-wallpaper-time-switch-r6"
  ]);
  assert.match(groupOpeningTag, /data-visual-theme="morning"/);
  assert.match(groupOpeningTag, /data-visual-assets-ready="false"/);
  assert.doesNotMatch(groupMarkup, /time-track|time-selector|fx-|wallpaper-time-effect|wallpaper-time-atmosphere|data-atmosphere-depth|is-upper|is-middle|is-lower|(?:scene|node|marker|accent)-(?:morning|day|dusk|night)\.png|atmosphere-(?:morning|day|dusk|night)-(?:far|mid|accent)\.png/);
  assert.match(groupMarkup, /id="wallpaper-time-status"[^>]*aria-live="polite"[^>]*aria-atomic="true"/);
});

test("cold first paint skips the accent atlas in Save-Data or hardware-low modes", () => {
  const normal = runSwitchFirstPaint();
  assert.equal(normal.assets.marker.src, "/marker.png");
  assert.equal(normal.assets.scene.src, "/scene.png");
  assert.equal(normal.assets.roller.src, "/node.png");
  assert.equal(normal.assets.accent.src, "/accent.png");
  assert.equal(normal.group.dataset.visualTheme, "night");

  for (const constrained of [
    runSwitchFirstPaint({ saveData: true }),
    runSwitchFirstPaint({ hardwareConcurrency: 2 }),
    runSwitchFirstPaint({ deviceMemory: 2 })
  ]) {
    assert.equal(constrained.assets.marker.src, "/marker.png");
    assert.equal(constrained.assets.scene.src, "/scene.png");
    assert.equal(constrained.assets.roller.src, "/node.png");
    assert.equal(constrained.assets.accent.src, "");
  }
  assert.equal(runSwitchFirstPaint({ hash: "#knowledge" }).assets.accent.src, "/accent.png");
  assert.equal(runSwitchFirstPaint({ mobileShell: true, hash: "#knowledge" }).assets.accent.src, "");
  assert.doesNotMatch(firstPaintSource, /dataset\.performanceTier/);
});

test("switch geometry preserves four 44px targets, a contained 36px roller with a 32px inner node, and generated PNG dimensions", async () => {
  const switchRule = ruleBody(styleCss, ".wallpaper-time-switch");
  const optionRule = ruleBody(styleCss, ".wallpaper-time-option");
  const viewportRule = ruleBody(styleCss, ".wallpaper-time-viewport");
  const thumbRule = ruleBody(styleCss, ".wallpaper-time-thumb");
  const celestialRule = styleCss.match(/(?:^|\n)\.wallpaper-time-celestial\s*\{\s*position:\s*absolute;[\s\S]*?\}/)?.[0] || "";
  assert.ok(celestialRule, "missing exact positioned .wallpaper-time-celestial declaration");
  const rollerRule = ruleBody(styleCss, ".wallpaper-time-roller");
  const rollerAtlasRule = styleCss.match(/(?:^|\n)\.wallpaper-time-roller-atlas\s*\{\s*width:\s*36px;[\s\S]*?\}/)?.[0] || "";
  assert.ok(rollerAtlasRule, "missing exact .wallpaper-time-roller-atlas declaration");
  const markerRule = ruleBody(styleCss, ".wallpaper-time-marker");
  assert.match(switchRule, /grid-template-columns:\s*repeat\(4,\s*44px\)/);
  assert.match(switchRule, /width:\s*176px/);
  assert.match(switchRule, /height:\s*44px/);
  for (const property of ["width", "min-width", "height", "min-height"]) {
    assert.match(optionRule, new RegExp(`${property}:\\s*44px`));
  }
  assert.match(viewportRule, /clip-path:\s*inset\(4px 4px round 18px\)/);
  assert.match(thumbRule, /top:\s*4px/);
  assert.match(thumbRule, /width:\s*36px/);
  assert.match(thumbRule, /height:\s*36px/);
  assert.match(thumbRule, /transform:\s*translate3d\(4px,\s*0,\s*0\)/);
  assert.match(celestialRule, /top:\s*2px/);
  assert.match(celestialRule, /left:\s*2px/);
  assert.match(celestialRule, /width:\s*32px/);
  assert.match(celestialRule, /height:\s*32px/);
  assert.match(rollerRule, /width:\s*36px/);
  assert.match(rollerRule, /height:\s*36px/);
  assert.match(styleCss, /\.wallpaper-time-node-atlas,\s*\.wallpaper-time-roller-atlas\s*\{[\s\S]*?image-rendering:\s*auto/);
  assert.match(rollerAtlasRule, /width:\s*36px/);
  assert.match(rollerAtlasRule, /height:\s*180px/);
  assert.match(rollerAtlasRule, /transform:\s*translate3d\(0,\s*-144px,\s*0\)/);
  assert.match(markerRule, /width:\s*20px/);
  assert.match(markerRule, /height:\s*20px/);
  assert.match(markerRule, /overflow:\s*hidden/);
  assert.match(styleCss, /\.wallpaper-time-scene,\s*\.wallpaper-time-accent,\s*\.wallpaper-time-celestial\s*\{[\s\S]*?overflow:\s*hidden/);
  for (const x of [4, 48, 92, 136]) {
    assert.match(styleCss, new RegExp(`wallpaper-time-thumb \\{ transform: translate3d\\(${x}px, 0, 0\\)`));
  }
  for (const degrees of [0, 151.072, 302.144, 453.216]) {
    assert.match(styleCss, new RegExp(`wallpaper-time-roller \\{ transform: rotate\\(${String(degrees).replace(".", "\\.")}deg\\)`));
  }
  assert.match(styleCss, /wallpaper-time-scene-atlas\[data-atlas-cell="night"\][^\n]*translate3d\(0, -132px, 0\)/);
  assert.match(styleCss, /wallpaper-time-marker-atlas\[data-atlas-cell="night"\][^\n]*translate3d\(0, -60px, 0\)/);
  assert.match(styleCss, /wallpaper-time-node-atlas\[data-atlas-cell="night"\][^\n]*translate3d\(0, -96px, 0\)/);
  assert.match(styleCss, /wallpaper-time-accent-atlas\[data-atlas-cell="night"\][^\n]*translate3d\(0, -176px, 0\)/);
  assert.doesNotMatch(motionCss, /wallpaper-time-(?:scene|accent|marker|node)-atlas/);

  const expectedRuntimeAssets = [
    { file: "scene-atlas.png", width: 880, height: 880 },
    { file: "marker-atlas.png", width: 144, height: 576 },
    { file: "node-atlas.png", width: 192, height: 960 },
    { file: "accent-atlas.png", width: 480, height: 640 },
    { file: "frame.png", width: 880, height: 220 },
  ];
  const runtimeMetadata = new Map(sourceRecord.delivery_atlases.map((asset) => [asset.file, asset]));
  runtimeMetadata.set("frame.png", sourceRecord.generated_assets.find((asset) => asset.file === "frame.png"));
  for (const expected of expectedRuntimeAssets) {
    const buffer = await readFile(new URL(`assets/images/wallpaper-switch/${expected.file}`, root));
    assert.deepEqual(pngDimensions(buffer), { width: expected.width, height: expected.height });
    const sha256 = createHash("sha256").update(buffer).digest("hex");
    assert.deepEqual(runtimeMetadata.get(expected.file)?.final_png, {
      width: expected.width,
      height: expected.height,
      sha256
    });
  }
  assert.equal(sourceRecord.date, "2026-08-10");
  assert.equal(sourceRecord.generator, "imagegen");
  assert.equal(sourceRecord.schema_version, 2);
  assert.equal(sourceRecord.asset_version, "20260810-wallpaper-time-switch-r6");
  assert.equal(sourceRecord.generated_assets.length, 18);
  assert.equal(sourceRecord.generation_sources.length, 23);
  assert.equal(sourceRecord.generation_sources.filter((source) => source.disposition === "selected").length, 18);
  assert.equal(sourceRecord.generation_sources.filter((source) => source.disposition === "superseded").length, 5);
  assert.equal(sourceRecord.delivery_atlases.length, 4);
  assert.equal(sourceRecord.delivery_contract.content_asset_count, 18);
  assert.equal(sourceRecord.delivery_contract.delivery_atlas_count, 4);
  assert.equal(sourceRecord.delivery_contract.unique_runtime_request_count, 5);
  assert.deepEqual(sourceRecord.delivery_contract.standalone_delivery_files, ["frame.png"]);
  assert.deepEqual(sourceRecord.delivery_contract.runtime_files, expectedRuntimeAssets.map((asset) => asset.file));
  const nodeAtlasRecord = sourceRecord.delivery_atlases.find((asset) => asset.file === "node-atlas.png");
  assert.deepEqual(nodeAtlasRecord.cells, ["node-morning.png", "node-day.png", "node-dusk.png", "node-night.png", "roller.png"]);
  const rollerContentRecord = sourceRecord.generated_assets.find((asset) => asset.file === "roller.png");
  const rollerContentBuffer = await readFile(new URL("assets/images/wallpaper-switch/roller.png", root));
  assert.deepEqual(pngDimensions(rollerContentBuffer), { width: 192, height: 192 });
  assert.deepEqual(rollerContentRecord.final_png, {
    width: 192,
    height: 192,
    sha256: createHash("sha256").update(rollerContentBuffer).digest("hex")
  });
  assert.deepEqual(sourceRecord.visual_contract.viewport_clip_css_px, [4, 4, 18]);
  assert.deepEqual(sourceRecord.visual_contract.frame_center_opening_alpha_bbox, [18, 20, 861, 201]);
  assert.equal(sourceRecord.visual_contract.roller_degrees_per_stop, 151.072);
  assert.deepEqual(sourceRecord.visual_contract.roller_rotation_by_theme_degrees, { morning: 0, day: 151.072, dusk: 302.144, night: 453.216 });
  assert.deepEqual(sourceRecord.visual_contract.roller_visible_geometry_css_px, { wrapper: 36, outer_diameter: 33.375, center_opening: 30, wall_per_side_approx: 1.6875 });
  assert.equal(sourceRecord.qa.morning_day_distinction.pass, true);
  assert.deepEqual(
    [sourceRecord.qa.morning_day_distinction.scene_rmse_at_176x44, sourceRecord.qa.morning_day_distinction.node_rmse_at_32x32, sourceRecord.qa.morning_day_distinction.marker_rmse_at_20x20],
    [97.136, 81.343, 39.576]
  );
  const sourceRoles = new Map(sourceRecord.generation_sources.map((source) => [source.role, source]));
  assert.ok(sourceRoles.size > 0);
  assert.ok([...sourceRoles.values()].every((source) => source.prompt_summary));
  assert.ok(sourceRecord.generated_assets.every((asset) => sourceRoles.has(asset.source_role)));
  assert.ok(Array.isArray(sourceRecord.mechanical_pipeline?.steps));
  assert.ok(sourceRecord.mechanical_pipeline.steps.length > 0);
  assert.match(sourceRecord.visual_contract.accent_model, /^Exactly one Image2-generated accent layer per theme:/);
  assert.deepEqual(sourceRecord.visual_contract.inactive_marker_css_px, [20, 20]);
  assert.doesNotMatch(
    JSON.stringify(sourceRecord),
    /"file":"(?:time-track|time-selector|node-inactive|fx-[^"]+|atmosphere-[^"]+)\.png"/
  );
});

test("switch motion is retargetable, theme-specific, and quiet in accessibility modes", () => {
  const thumbMotionRule = ruleBody(motionCss, ".wallpaper-time-thumb");
  const rollerMotionRule = ruleBody(motionCss, ".wallpaper-time-roller");
  assert.match(motionCss, /--motion-ease-in-out:\s*cubic-bezier\(0\.77,\s*0,\s*0\.175,\s*1\)/);
  assert.match(thumbMotionRule, /transition:\s*transform var\(--motion-window\) var\(--motion-ease-in-out\)/);
  assert.match(thumbMotionRule, /will-change:\s*transform/);
  assert.match(rollerMotionRule, /transition:\s*transform var\(--motion-window\) var\(--motion-ease-in-out\)/);
  assert.match(rollerMotionRule, /will-change:\s*transform/);
  assert.match(motionCss, /\.wallpaper-time-scene\s*\{\s*transition:\s*opacity var\(--motion-standard\)/);
  assert.match(motionCss, /wallpaper-time-scene\[data-switch-theme="night"\][\s\S]*?transition-duration:\s*var\(--motion-standard\)/);
  assert.match(motionCss, /\.wallpaper-time-celestial\s*\{[\s\S]*?opacity var\(--motion-standard\)[\s\S]*?transform var\(--motion-standard\)/);
  assert.match(motionCss, /wallpaper-time-celestial\[data-switch-theme="night"\][\s\S]*?transition-duration:\s*var\(--motion-standard\)/);
  assert.match(motionCss, /wallpaper-time-accent\[data-switch-theme="morning"\][^\n]*translate3d\(0, 7px, 0\) scale\(\.88\)/);
  assert.match(motionCss, /wallpaper-time-accent\[data-switch-theme="day"\][^\n]*translate3d\(-8px, 1px, 0\) scale\(\.96\)/);
  assert.match(motionCss, /wallpaper-time-accent\[data-switch-theme="dusk"\][^\n]*translate3d\(9px, 1px, 0\) scaleX\(\.76\)/);
  assert.match(motionCss, /wallpaper-time-accent\[data-switch-theme="night"\][^\n]*translate3d\(0, 9px, 0\) scale\(\.9\)/);
  assert.match(motionCss, /data-visual-theme="morning"[\s\S]*?wallpaper-time-accent\[data-switch-theme="morning"\][\s\S]*?transition-duration:\s*var\(--motion-window\)/);
  assert.match(motionCss, /data-visual-theme="day"[\s\S]*?wallpaper-time-accent\[data-switch-theme="day"\][\s\S]*?transition-duration:\s*var\(--motion-standard\)/);
  assert.match(motionCss, /data-visual-theme="dusk"[\s\S]*?wallpaper-time-accent\[data-switch-theme="dusk"\][\s\S]*?transition-duration:\s*var\(--motion-window\)/);
  assert.match(motionCss, /data-visual-theme="night"[\s\S]*?wallpaper-time-accent\[data-switch-theme="night"\][\s\S]*?transition-duration:\s*var\(--motion-window\)/);
  assert.match(motionCss, /\.wallpaper-time-accent\s*\{[\s\S]*?transition-delay:\s*0ms/);
  assert.doesNotMatch(motionCss, /data-atmosphere-depth|wallpaper-time-atmosphere|transition-delay:\s*(?:35|70)ms/);
  assert.match(motionCss, /data-motion="reduced"[\s\S]*?wallpaper-time-thumb,[\s\S]*?wallpaper-time-roller[\s\S]*?transition:\s*none !important/);
  assert.match(motionCss, /data-motion="reduced"[\s\S]*?wallpaper-time-accent[\s\S]*?transition:\s*opacity 140ms/);
  assert.match(motionCss, /data-performance-tier="low"[\s\S]*?wallpaper-time-accent[\s\S]*?opacity:\s*0 !important/);
  assert.match(mainJs, /async function loadWallpaperTimeSwitchAssets\(assets\)[\s\S]*?const assetsByUrl = new Map\(\)[\s\S]*?Promise\.allSettled\([\s\S]*?\.\.\.assetsByUrl\.keys\(\)[\s\S]*?decodeWallpaperTimeSwitchUrl/);
  assert.match(mainJs, /results\.every\(\(result\) => result\.status === "fulfilled"[\s\S]*?image\.complete[\s\S]*?image\.naturalWidth > 0/);
  assert.match(mainJs, /function ensureWallpaperTimeSwitchAssets[\s\S]*?querySelectorAll\("\[data-src\]"\)[\s\S]*?loadWallpaperTimeSwitchAssets[\s\S]*?if \(!ready\)[\s\S]*?visualAssetsReady = "error"[\s\S]*?visualAssetsError = "true"[\s\S]*?visualCoreAssetsReady = "true"[\s\S]*?visualAssetsReady = "true"[\s\S]*?\.finally[\s\S]*?delete group\.dataset\.atlasBusy[\s\S]*?syncWallpaperTimeSwitchBusy\(group\)[\s\S]*?wallpaperTimeSwitchAssetsPromise = null/);
  assert.match(mainJs, /document\.body\.dataset\.route = nextRoute;\s*void ensureWallpaperTimeSwitchAssets\(\)/);
  assert.match(mainJs, /function wallpaperTimeSwitchIsVisible\(group[\s\S]*?getClientRects\(\)\.length/);
  assert.match(mainJs, /function ensureWallpaperTimeSwitchAssets[\s\S]*?if \(coreReady && \(!includeAccent \|\| accentReady\)\)[\s\S]*?if \(wallpaperTimeSwitchAssetsPromise\)[\s\S]*?if \(!wallpaperTimeSwitchIsVisible\(group\)\) return Promise\.resolve\(false\)/);
  assert.match(mainJs, /function initWallpaperTimeSwitch\(\)[\s\S]*?const initialRoute = parseRouteLocation\(\)\.route;[\s\S]*?initialMobileAppRoute[\s\S]*?if \(!initialMobileAppRoute && wallpaperTimeSwitchIsVisible\(group\)\)[\s\S]*?ensureWallpaperTimeSwitchAssets\(group\)/);
  assert.match(mainJs, /window\.addEventListener\("online"[\s\S]*?coreMissing \|\| accentMissing[\s\S]*?ensureWallpaperTimeSwitchAssets\(group\)/);
  assert.match(mainJs, /window\.addEventListener\("lusu:shellchange", \(\) => \{\s*updateWallpaperMotionState\(\);\s*\}\)/);
  assert.match(mainJs, /let wallpaperTimeSwitchRouteReady = false;/);
  assert.match(mainJs, /function updateWallpaperMotionState[\s\S]*?const coreMissing = switchControl\.dataset\.visualCoreAssetsReady !== "true";[\s\S]*?const accentMissing =[\s\S]*?wallpaperTimeSwitchRouteReady[\s\S]*?wallpaperTimeSwitchIsVisible\(switchControl\)[\s\S]*?coreMissing \|\| accentMissing[\s\S]*?ensureWallpaperTimeSwitchAssets\(switchControl\)/);
  assert.match(mainJs, /syncRouteFromLocation\(\{ focusWindow: false \}\);\s*wallpaperTimeSwitchRouteReady = true;\s*updateClock\(\);\s*setInterval\(updateClock, 1000\);/);
  assert.doesNotMatch(mainJs, /const initialRouteIsHome|dataset\.route !== "home"\);\s*const syncGeneration/);
  assert.match(mainJs, /const immediate = Boolean\(options\.immediate[\s\S]*?dataset\.performanceTier === "low"[\s\S]*?document\.hidden\);/);
  assert.match(mainJs, /group\.dataset\.static = String\(document\.hidden\)/);
  assert.match(mainJs, /const assetsPreparing = group\.dataset\.visualAssetsReady !== "true"/);
  assert.match(indexHtml, /initialMobileShell[\s\S]*?initialLow \|\| \(initialMobileShell && !initialRouteIsHome\)/);
  assert.match(mainJs, /if \(immediate\)[\s\S]*?group\.dataset\.immediate = "true";[\s\S]*?else \{[\s\S]*?delete group\.dataset\.immediate/);
  assert.match(mainJs, /group\.dataset\.visualTheme = state\.theme/);
  assert.doesNotMatch(mainJs, /wallpaperTimeSelectorAnimation|wallpaperTimeEffectGeneration|wallpaperTimeEffectTimer|playWallpaperTimeEffect|stopWallpaperTimeEffect|moveWallpaperTimeSelector/);
  const switchMotion = motionCss.slice(motionCss.indexOf("/* The switch is a rapidly-triggered"), motionCss.indexOf("[data-ui-closing=\"true\"]"));
  assert.doesNotMatch(switchMotion, /@keyframes|\banimation\s*:|is-upper|is-middle|is-lower|wallpaper-time-effect/);
  const switchRuntime = mainJs.slice(mainJs.indexOf("function decodeWallpaperTimeSwitchUrl"), mainJs.indexOf("function scheduleWallpaperTimeBoundary"));
  assert.doesNotMatch(switchRuntime, /\.animate\(|getAnimations\(/);
  assert.equal([...switchRuntime.matchAll(/window\.setTimeout\(/g)].length, 1);
});

test("atlas readiness fails closed and remains retryable after a decode race", () => {
  const loaderRuntime = mainJs.slice(
    mainJs.indexOf("function decodeWallpaperTimeSwitchUrl"),
    mainJs.indexOf("function syncWallpaperTimeSwitch(state")
  );
  assert.match(loaderRuntime, /const assetsByUrl = new Map\(\)/);
  assert.match(loaderRuntime, /Promise\.allSettled\([\s\S]*?\.\.\.assetsByUrl\.keys\(\)/);
  assert.match(loaderRuntime, /result\.status === "fulfilled"[\s\S]*?image\.complete[\s\S]*?image\.naturalWidth > 0/);
  assert.match(loaderRuntime, /if \(ready\) \{[\s\S]*?asset\.setAttribute\("src", url\)/);
  assert.match(loaderRuntime, /if \(!ready\) \{[\s\S]*?visualAssetsReady = "error"[\s\S]*?visualAssetsError = "true"[\s\S]*?\.finally[\s\S]*?delete group\.dataset\.atlasBusy[\s\S]*?syncWallpaperTimeSwitchBusy\(group\)[\s\S]*?wallpaperTimeSwitchAssetsPromise = null/);
  assert.match(mainJs, /window\.addEventListener\("online"[\s\S]*?const coreMissing = group\.dataset\.visualCoreAssetsReady !== "true"[\s\S]*?const accentMissing = wallpaperTimeSwitchAccentAllowed\(\)[\s\S]*?group\.dataset\.visualAccentAssetsReady !== "true"[\s\S]*?coreMissing \|\| accentMissing[\s\S]*?ensureWallpaperTimeSwitchAssets\(group\)/);
});

test("switch atlas decode has a ten-second deadline and clears it on every settle path", () => {
  const decodeRuntime = mainJs.slice(
    mainJs.indexOf("function decodeWallpaperTimeSwitchUrl"),
    mainJs.indexOf("async function loadWallpaperTimeSwitchAssets")
  );
  assert.match(decodeRuntime, /let timeoutId = 0/);
  assert.match(decodeRuntime, /const finish = \(callback, value\) => \{[\s\S]*?if \(settled\) return;[\s\S]*?clearTimeout\(timeoutId\)[\s\S]*?callback\(value\)/);
  assert.match(decodeRuntime, /image\.onload = verify/);
  assert.match(decodeRuntime, /image\.onerror = \(\) => finish\(reject/);
  assert.match(decodeRuntime, /timeoutId = window\.setTimeout\(\(\) => \{[\s\S]*?Wallpaper switch asset timed out:[\s\S]*?\}, 10000\)/);
  assert.match(decodeRuntime, /image\.decode\(\)\.then\(verify\)/);
});

test("atlas loading and manual selection share composite aria-busy ownership", () => {
  const busyRuntime = mainJs.slice(
    mainJs.indexOf("function syncWallpaperTimeSwitchBusy"),
    mainJs.indexOf("function syncWallpaperTimeSwitch(")
  );
  assert.match(busyRuntime, /const busy = group\.dataset\.atlasBusy === "true" \|\| group\.dataset\.manualBusy === "true"/);
  assert.match(busyRuntime, /if \(busy\) \{[\s\S]*?setAttribute\("aria-busy", "true"\)[\s\S]*?else \{[\s\S]*?removeAttribute\("aria-busy"\)/);
  assert.match(busyRuntime, /group\.dataset\.atlasBusy = "true";[\s\S]*?syncWallpaperTimeSwitchBusy\(group\)[\s\S]*?\.finally[\s\S]*?delete group\.dataset\.atlasBusy;[\s\S]*?syncWallpaperTimeSwitchBusy\(group\)/);

  const reconcileRuntime = mainJs.slice(
    mainJs.indexOf("async function reconcileWallpaperTimeTheme"),
    mainJs.indexOf("function wallpaperThemeCrossfadeAllowed")
  );
  assert.match(reconcileRuntime, /if \(group\) delete group\.dataset\.manualBusy;[\s\S]*?syncWallpaperTimeSwitchBusy\(group\)/);
  assert.doesNotMatch(reconcileRuntime, /removeAttribute\("aria-busy"\)/);

  const selectionRuntime = mainJs.slice(
    mainJs.indexOf("async function selectWallpaperTimeTheme"),
    mainJs.indexOf("function initWallpaperTimeSwitch")
  );
  assert.match(selectionRuntime, /group\.dataset\.manualBusy = "true";[\s\S]*?syncWallpaperTimeSwitchBusy\(group\)/);
  assert.match(selectionRuntime, /wallpaperTimePendingManualPromise === selection[\s\S]*?delete group\.dataset\.manualBusy;[\s\S]*?syncWallpaperTimeSwitchBusy\(group\)/);
});

test("low-tier and Save-Data readiness skips the accent atlas and upgrades on demand", () => {
  const loaderRuntime = mainJs.slice(
    mainJs.indexOf("const wallpaperTimeSwitchHardwareLow ="),
    mainJs.indexOf("function syncWallpaperTimeSwitch(")
  );
  assert.match(loaderRuntime, /const wallpaperTimeSwitchHardwareLow = \(\(\) => \{[\s\S]*?hardwareConcurrency > 0 && hardwareConcurrency <= 2[\s\S]*?deviceMemory > 0 && deviceMemory <= 2/);
  assert.match(loaderRuntime, /return wallpaperTimeSwitchHardwareLow \|\| connection\?\.saveData === true \? "low" : "normal"/);
  assert.match(loaderRuntime, /function wallpaperTimeSwitchAccentAllowed\(\) \{\s*return wallpaperTimeSwitchPerformanceTier\(\) === "normal"/);
  assert.match(loaderRuntime, /asset\.dataset\.role = asset\.closest\("\.wallpaper-time-accent"\) \? "accent" : "core"/);
  assert.match(loaderRuntime, /if \(!includeAccent\)\s*\{?\s*return asset\.dataset\.role !== "accent"/);
  assert.match(loaderRuntime, /if \(coreReady\) return asset\.dataset\.role === "accent"/);
  assert.match(loaderRuntime, /visualCoreAssetsReady = "true";[\s\S]*?if \(includeAccent\)\s*\{[\s\S]*?visualAccentAssetsReady = "true"/);
  assert.match(loaderRuntime, /const blocksControl = !coreReady;[\s\S]*?if \(blocksControl\) \{[\s\S]*?visualAssetsReady = "loading"[\s\S]*?atlasBusy = "true"[\s\S]*?button\.disabled = true/);
  assert.match(loaderRuntime, /if \(!blocksControl\) \{[\s\S]*?visualAccentAssetsReady = "error"[\s\S]*?visualAccentAssetsError = "true"[\s\S]*?return false/);
  assert.match(loaderRuntime, /\.finally\(\(\) => \{[\s\S]*?if \(blocksControl\) \{[\s\S]*?delete group\.dataset\.atlasBusy/);

  const initRuntime = mainJs.slice(
    mainJs.indexOf("function initWallpaperTimeSwitch"),
    mainJs.indexOf("function measureHomeViewportLayout")
  );
  assert.match(initRuntime, /if \(!wallpaperTimeSwitchAccentAllowed\(\)\) \{[\s\S]*?querySelectorAll\('\[data-role="accent"\]'\)[\s\S]*?removeAttribute\("src"\)/);
  assert.match(initRuntime, /connection\?\.addEventListener\?\.\("change", \(\) => \{[\s\S]*?ownedPerformanceTierMutation = syncWallpaperTimeSwitchPerformanceTier\(\);[\s\S]*?updateWallpaperMotionState\(\)/);
  assert.match(initRuntime, /new MutationObserver\(\(\) => \{[\s\S]*?dataset\.performanceTier === ownedPerformanceTierMutation[\s\S]*?return;[\s\S]*?updateWallpaperMotionState\(\)[\s\S]*?attributeFilter: \["data-performance-tier"\]/);
  assert.match(mainJs, /wallpaperTimeSwitchAccentAllowed\(\)[\s\S]*?visualAccentAssetsReady !== "true"[\s\S]*?ensureWallpaperTimeSwitchAssets\(switchControl\)/);
});

test("turning Save-Data off enables accent loading without overriding genuine hardware-low", () => {
  const staleSaveDataTier = createSwitchAccentPolicy({
    saveData: true,
    hardwareConcurrency: 8,
    deviceMemory: 8
  });
  assert.equal(staleSaveDataTier.allowed(), false);
  staleSaveDataTier.connection.saveData = false;
  assert.equal(staleSaveDataTier.syncPerformanceTier(), "normal");
  assert.equal(staleSaveDataTier.root.dataset.performanceTier, "normal");
  assert.equal(staleSaveDataTier.allowed(), true);

  const lowCpu = createSwitchAccentPolicy({
    saveData: true,
    hardwareConcurrency: 2,
    deviceMemory: 8
  });
  lowCpu.connection.saveData = false;
  assert.equal(lowCpu.syncPerformanceTier(), "");
  assert.equal(lowCpu.root.dataset.performanceTier, "low");
  assert.equal(lowCpu.allowed(), false);

  const lowMemory = createSwitchAccentPolicy({
    saveData: true,
    hardwareConcurrency: 8,
    deviceMemory: 2
  });
  lowMemory.connection.saveData = false;
  assert.equal(lowMemory.syncPerformanceTier(), "");
  assert.equal(lowMemory.root.dataset.performanceTier, "low");
  assert.equal(lowMemory.allowed(), false);
});

test("rapid manual selection failure rolls back to the committed override", () => {
  const selectionRuntime = mainJs.slice(
    mainJs.indexOf("async function selectWallpaperTimeTheme"),
    mainJs.indexOf("function initWallpaperTimeSwitch")
  );
  assert.match(selectionRuntime, /const committedOverride = readWallpaperTimeOverride\(selectedAt\)/);
  assert.match(selectionRuntime, /const requestId = \+\+wallpaperTimeSelectionRequest;[\s\S]*?wallpaperTimeOverride = record/);
  assert.match(selectionRuntime, /if \(requestId !== wallpaperTimeSelectionRequest\) return false/);
  assert.match(selectionRuntime, /if \(!loaded\) \{[\s\S]*?wallpaperTimeOverride = committedOverride/);
  assert.doesNotMatch(selectionRuntime, /const previousOverride = wallpaperTimeOverride/);
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
    /const selectedAt = new Date\(\);[\s\S]*?createWallpaperTimeOverride\(theme, selectedAt\);[\s\S]*?const committedOverride = readWallpaperTimeOverride\(selectedAt\);[\s\S]*?const requestId = \+\+wallpaperTimeSelectionRequest;[\s\S]*?wallpaperTimeOverride = record;[\s\S]*?const selection = \(async \(\) => \{[\s\S]*?await warmWallpaperTheme\(theme, \{ intent: true \}\);[\s\S]*?if \(requestId !== wallpaperTimeSelectionRequest\) return false;[\s\S]*?if \(!loaded\) \{[\s\S]*?wallpaperTimeOverride = committedOverride;[\s\S]*?Date\.now\(\) >= record\.expiresAt[\s\S]*?writeWallpaperTimeOverride\(record\)/
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
  assert.match(mainJs, /function wallpaperCloudAssetCandidates[\s\S]*?wallpaperAmbientPlaybackEligible\(\)[\s\S]*?return \[\]/);
  assert.match(mainJs, /function dynamicWallpaperIsActive[\s\S]*?!wallpaperAmbientPlaybackEligible\(\)/);
  assert.match(mainJs, /wallpaper-theme-scene-overlay[\s\S]*?:scope > \[data-wallpaper-dynamic-layer\][\s\S]*?frozenTransform = cloudStyle\.transform[\s\S]*?cloud\.style\.animation = "none"/);
  assert.match(mainJs, /const reduced = document\.documentElement\.dataset\.motion === "reduced";[\s\S]*?\? 140/);
  assert.match(mainJs, /root\.dataset\.motion === "off" \|\| document\.hidden/);
  assert.match(indexHtml, /data-immediate="true"[\s\S]*?document\.documentElement\.dataset\.timeTheme[\s\S]*?aria-checked/);
  assert.doesNotMatch(indexHtml, /selector\.style\.transform|\.style\.transform\s*=\s*`translate3d/);
});
