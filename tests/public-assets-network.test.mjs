import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import { createJsonResourceCache } from "../js/core/content-cache.mjs";
import { buildTransferIconAtlas } from "../scripts/build-transfer-icon-atlas.mjs";
import {
  cacheableJson,
  PUBLIC_API_REPRESENTATION_VERSION,
  publicVideoThumbnail
} from "../functions/api/[[route]].js";

const root = new URL("../", import.meta.url);
const themes = ["morning", "day", "dusk", "night"];
const widths = [960, 1440, 1920];
const wallpaperSwitchAssetVersion = "20260810-wallpaper-time-switch-r6";
const wallpaperSwitchAssets = new Map([
  ["scene-morning.png", [880, 220, "228b4461cabbd28a4d7e552eb01e15020dcda46b02803b5e8423099450f8c6e3"]],
  ["scene-day.png", [880, 220, "21a93bfd59ad13511b7530386c78bc3b70e9a1fee64863aa652c41912ab89e10"]],
  ["scene-dusk.png", [880, 220, "73c76214123272feb242790850933c578350c6b3ab1b384c500d2463be7d6d06"]],
  ["scene-night.png", [880, 220, "21109ba9d458ec0fc97fc00be0b11e5a24eb8a160ef2895ed52ca667bf5f3379"]],
  ["marker-morning.png", [144, 144, "c9dea9d91297a311d90305eacf6557c19a35ae00605e2a56115b6f41ececa443"]],
  ["marker-day.png", [144, 144, "f5d964da42cdfa6a2bd2e2d7a8a98c838014d1fd7f3ba111c928b14aff837868"]],
  ["marker-dusk.png", [144, 144, "24c82c18b55e096238f33a9fe5c3b80bffc38ad9ae89d2bdbb2cebbc2c9a6b9c"]],
  ["marker-night.png", [144, 144, "74710010c0abb39b6381d72aead8ff43fc21b1b4e943a8eebe64561f84fcb397"]],
  ["node-morning.png", [192, 192, "e0e18e9eca155af6fda1eee2e90c2a97c2e7ad1641b03645f0db0dfddb252bee"]],
  ["node-day.png", [192, 192, "c706bd59eb2bf455ba7f13235b733376d221cdb9823843f42ee49f919846e999"]],
  ["node-dusk.png", [192, 192, "358cb2597d53ec594064d2a02bcb9ede7f2089c3dc94d04216b5810eafdbc036"]],
  ["node-night.png", [192, 192, "04d36be5765de703bffd89f8365f599dc6cb24a300750edabdec8c4e9d705562"]],
  ["accent-morning.png", [480, 160, "17a3fa961b27c741e7fc1dafa982a9b3db55c48f86a643e74285c1cc0b327b20"]],
  ["accent-day.png", [480, 160, "b24472486a5341f1339f6d88c678e6197efcd81ac46261653757e4c1907fc86f"]],
  ["accent-dusk.png", [480, 160, "538a753d13cd71fb8114da2a79ca5c4bab02e51a58db812f031705a9007393b5"]],
  ["accent-night.png", [480, 160, "99c2893a9beed43fa0188eaf20f86f6d39459ae4ffd5c27390d0fb5a4ee4a4f3"]],
  ["frame.png", [880, 220, "ce7917df11a97664a0ae6b72ae4e1d3498e1f8ff104017bf9f0e5e855567866a"]],
  ["roller.png", [192, 192, "8f969ddad084c59dd507a81cdf940773fb55ae525e093ff55fd267cc36fb922e"]]
]);
const wallpaperSwitchDeliveryAtlases = new Map([
  ["scene-atlas.png", [880, 880, "008b0739ff5165ab712f9e20bf6f5c94dac2f4b89735944631af31acabe66027", ["scene-morning.png", "scene-day.png", "scene-dusk.png", "scene-night.png"]]],
  ["marker-atlas.png", [144, 576, "97044eedb7c02ad7a4930871955f01be393190339a5174c71d95069560485b29", ["marker-morning.png", "marker-day.png", "marker-dusk.png", "marker-night.png"]]],
  ["node-atlas.png", [192, 960, "93b4964d9df08c9ad975c18854d13eaab5899763e0eea7a5c659cac2eb1ffe2f", ["node-morning.png", "node-day.png", "node-dusk.png", "node-night.png", "roller.png"]]],
  ["accent-atlas.png", [480, 640, "8d416dc6c2780024b60a3028f676284fa712fa4f9b1e0b9bc470dbe0434b9e54", ["accent-morning.png", "accent-day.png", "accent-dusk.png", "accent-night.png"]]]
]);

async function asset(path) {
  const url = new URL(path, root);
  return { metadata: await sharp(fileURLToPath(url)).metadata(), bytes: (await stat(url)).size };
}

async function rgba(path) {
  const url = new URL(path, root);
  return sharp(fileURLToPath(url)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
}

async function rgbaBuffer(buffer) {
  return sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
}

function rgbaDifference(left, right) {
  assert.deepEqual(
    [left.info.width, left.info.height, left.info.channels],
    [right.info.width, right.info.height, right.info.channels]
  );
  let totalDelta = 0;
  let alphaDelta = 0;
  let largeDeltaChannels = 0;
  for (let offset = 0; offset < left.data.length; offset += 1) {
    const delta = Math.abs(left.data[offset] - right.data[offset]);
    totalDelta += delta;
    if (offset % 4 === 3) alphaDelta += delta;
    if (delta > 12) largeDeltaChannels += 1;
  }
  return {
    meanChannelDelta: totalDelta / left.data.length,
    meanAlphaDelta: alphaDelta / (left.data.length / 4),
    largeDeltaChannelRatio: largeDeltaChannels / left.data.length
  };
}

function opaqueMagentaKeyRatio(image) {
  let opaqueMagentaPixels = 0;
  const pixelCount = image.info.width * image.info.height;
  for (let offset = 0; offset < image.data.length; offset += 4) {
    const red = image.data[offset];
    const green = image.data[offset + 1];
    const blue = image.data[offset + 2];
    const alpha = image.data[offset + 3];
    if (alpha >= 250 && Math.hypot(red - 247, green - 5, blue - 246) < 48) {
      opaqueMagentaPixels += 1;
    }
  }
  return opaqueMagentaPixels / pixelCount;
}

function alphaBounds(image, threshold = 1) {
  let left = image.info.width;
  let top = image.info.height;
  let right = -1;
  let bottom = -1;
  let visiblePixels = 0;
  for (let y = 0; y < image.info.height; y += 1) {
    for (let x = 0; x < image.info.width; x += 1) {
      if (image.data[(y * image.info.width + x) * 4 + 3] < threshold) continue;
      visiblePixels += 1;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  return {
    left,
    top,
    right,
    bottom,
    width: right - left + 1,
    height: bottom - top + 1,
    visibleRatio: visiblePixels / (image.info.width * image.info.height)
  };
}

function greenDominantPixelCount(image, threshold = 8) {
  let count = 0;
  for (let offset = 0; offset < image.data.length; offset += 4) {
    const red = image.data[offset];
    const green = image.data[offset + 1];
    const blue = image.data[offset + 2];
    const alpha = image.data[offset + 3];
    if (alpha >= threshold && green > red + 18 && green > blue + 18) count += 1;
  }
  return count;
}

test("responsive wallpaper and window assets stay below the per-file budget", async () => {
  for (const theme of themes) {
    for (const width of widths) {
      for (const format of ["avif", "webp"]) {
        for (const path of [
          `assets/images/wallpapers/optimized/${theme}-${width}.${format}`,
          `assets/images/wallpaper-dynamic/${theme}/optimized/base-${width}.${format}`,
          `assets/images/window-backdrops/optimized/${theme}-${width}.${format}`
        ]) {
          const result = await asset(path);
          assert.equal(result.metadata.width, width);
          assert.equal(result.metadata.format, format === "avif" ? "heif" : format);
          assert.ok(result.bytes < 200 * 1024, `${path} exceeds 200 KiB`);
        }
      }
    }
  }
});

test("wallpaper switch manifest locks the r6 slim-dawn Image2 contract into five runtime files", async () => {
  const manifest = JSON.parse(await readFile(new URL("assets/images/wallpaper-switch/wallpaper-time-switch.source.json", root), "utf8"));
  assert.equal(manifest.schema_version, 2);
  assert.equal(manifest.asset_version, wallpaperSwitchAssetVersion);
  assert.deepEqual(manifest.public_release, {
    update_id: "seed-update-2026-08-10-wallpaper-switch-slim-dawn",
    slug: "2026-08-10-wallpaper-switch-slim-dawn",
    public_token: "20260810-wallpaper-switch-slim-dawn-r1"
  });

  const visual = manifest.visual_contract;
  assert.deepEqual(visual.control_size_css_px, [176, 44]);
  assert.deepEqual(visual.viewport_clip_css_px, [4, 4, 18]);
  assert.deepEqual(visual.frame_center_opening_alpha_bbox, [18, 20, 861, 201]);
  assert.deepEqual(visual.frame_center_opening_measurement.horizontal_center_run, { start: 18, end_inclusive: 860, length: 843 });
  assert.deepEqual(visual.frame_center_opening_measurement.vertical_center_run, { start: 20, end_inclusive: 200, length: 181 });
  assert.deepEqual(visual.rolling_selector_css_px, [36, 36]);
  assert.equal(visual.rolling_selector_top_css_px, 4);
  assert.deepEqual(visual.rolling_selector_left_by_theme_css_px, { morning: 4, day: 48, dusk: 92, night: 136 });
  assert.equal(visual.roller_degrees_per_stop, 151.072);
  assert.deepEqual(visual.roller_rotation_by_theme_degrees, { morning: 0, day: 151.072, dusk: 302.144, night: 453.216 });
  assert.deepEqual(visual.roller_visible_geometry_css_px, { wrapper: 36, outer_diameter: 33.375, center_opening: 30, wall_per_side_approx: 1.6875 });
  assert.deepEqual(visual.active_node_css_px, [32, 32]);
  assert.deepEqual(visual.active_node_inset_css_px, [2, 2]);
  assert.deepEqual(visual.inactive_marker_css_px, [20, 20]);
  assert.match(visual.inactive_marker_model, /image-rendering:auto/);
  assert.match(visual.motion_model, /interruptible transform\/opacity transitions only/);
  assert.match(visual.motion_model, /var\(--motion-window\)/);
  assert.match(visual.motion_model, /cubic-bezier\(0\.77,0,0\.175,1\)/);
  assert.match(visual.morning_day_distinction, /low one-third amber-orange sun/);

  const expectedRoles = new Set([
    "frame", "roller",
    ...themes.map((theme) => `scene_${theme}`),
    ...themes.map((theme) => `marker_${theme}`),
    ...themes.map((theme) => `node_${theme}`),
    ...themes.map((theme) => `accent_${theme}`)
  ]);
  const selectedSources = manifest.generation_sources.filter(({ disposition }) => disposition === "selected");
  const supersededSources = manifest.generation_sources.filter(({ disposition }) => disposition === "superseded");
  assert.equal(manifest.generation_sources.length, 23);
  assert.equal(selectedSources.length, 18);
  assert.deepEqual(new Set(selectedSources.map(({ role }) => role)), expectedRoles);
  assert.equal(new Set(selectedSources.map(({ call_id }) => call_id)).size, 18);
  for (const source of selectedSources) {
    assert.equal(source.tool, "built-in image_gen.imagegen");
    assert.equal(source.disposition, "selected");
    assert.ok(source.prompt.length > 240, `${source.role} must retain its complete Image2 prompt`);
    assert.match(source.call_id, /^exec-[a-f0-9-]{36}$/);
    assert.match(source.source_sha256, /^[a-f0-9]{64}$/);
    assert.match(source.source_record, /^output\/wallpaper-switch-(?:reference-v2|slim-dawn)\//);
  }
  const expectedR6Sources = new Map([
    ["frame", ["exec-5dd68018-8385-4f07-aa00-8c5ac7909d6e", "1ffc24b752ba0dff492b17326f26661b87c297880fc8303a4f6d64c970787b80"]],
    ["roller", ["exec-ebcffff9-74a4-48e1-bd90-a12a55fe656e", "a12cc784d8f9ff61b788b32ba28e811a771291319567700407f4161809116193"]],
    ["scene_morning", ["exec-fa204e39-620d-4965-9e39-30e40ef4006b", "0622d9f8e8c76543b7816b5c79e4fbe32391c47d3c72ab075d5653a7164c57f3"]],
    ["marker_morning", ["exec-bf5a4dab-d044-4f0e-ab28-30069ca7b6c2", "221ecc752ad577fd16a3075d5ddd5d5749f93bf550556070043350ff43081a73"]],
    ["node_morning", ["exec-28dd3951-8144-4c5c-801a-f7e1d516dfea", "06e94c2b49b882688c0a1ae1400573ba6f405813533b5ec53f0ac85d41f726e3"]]
  ]);
  for (const [role, expected] of expectedR6Sources) {
    const source = selectedSources.find((candidate) => candidate.role === role);
    assert.deepEqual([source.call_id, source.source_sha256], expected);
    assert.equal(source.asset_version, wallpaperSwitchAssetVersion);
    assert.match(source.source_record, /^output\/wallpaper-switch-slim-dawn\//);
    assert.ok(source.mechanical_processing.length > 80);
  }
  const expectedSuperseded = new Map([
    ["frame", ["exec-c5ea0dd6-8b89-4cbf-a9ab-32fdf462a2b3", "bb6a389f2eba25463097cb6916281d0620ecd34aeea6081c0fb7fc55d3c71b79"]],
    ["roller", ["exec-93e7a719-17b9-4404-beef-b11035438f8d", "54b7b2d386788ebec7756cafc887d16962293558994e48fa77087623bbb24038"]],
    ["scene_morning", ["exec-d59c2179-b5a1-4508-bd31-6443a1a6dc8f", "6d251cdef9b3a63c44cb90fad0427cf796d557315d8b6cb7134bc76721ec6bd4"]],
    ["marker_morning", ["exec-c8169f75-2c40-4333-836c-5824d81b786e", "76f633e6c91d0bd91f19910a072edb703d6778495f506dae68c47b0c440731de"]],
    ["node_morning", ["exec-6aa165b2-f113-4151-aefd-34b68d8b0456", "4fb5fba44f888208be8d24a2219e6bc17af7efc025e55978c267e719cccaeccd"]]
  ]);
  assert.equal(supersededSources.length, 5);
  for (const source of supersededSources) {
    assert.deepEqual([source.call_id, source.source_sha256], expectedSuperseded.get(source.role));
    assert.equal(source.asset_version, "20260810-wallpaper-time-switch-r5");
    assert.equal(source.superseded_by_asset_version, wallpaperSwitchAssetVersion);
    assert.ok(source.prompt.length > 240);
    assert.ok(source.supersession_reason.length > 40);
  }
  assert.ok(manifest.rejected_generation_calls.length >= 2);
  for (const rejected of manifest.rejected_generation_calls) {
    assert.ok(rejected.prompt.length > 240, `${rejected.role} must retain its complete rejected prompt`);
    assert.match(rejected.call_id, /^exec-[a-f0-9-]{36}$/);
    assert.match(rejected.source_sha256, /^[a-f0-9]{64}$/);
    assert.ok(rejected.rejection_reason.length > 24);
  }

  assert.equal(manifest.mechanical_pipeline.chroma_helper, "C:/Users/lusu/.codex/skills/.system/imagegen/scripts/remove_chroma_key.py");
  assert.deepEqual(manifest.mechanical_pipeline.command_options, ["--auto-key", "border", "--soft-matte", "--transparent-threshold", "12", "--opaque-threshold", "220", "--despill"]);
  assert.match(manifest.mechanical_pipeline.processing.markers, /premultiplied-alpha Lanczos3/);
  assert.match(manifest.mechanical_pipeline.processing.frame, /Sharp-equivalent chroma removal/);
  assert.match(manifest.mechanical_pipeline.processing.frame, /lacked Pillow/);
  assert.match(manifest.mechanical_pipeline.processing.delivery_atlases, /roller\.png as its fifth native 192x192 cell/);
  assert.match(manifest.mechanical_pipeline.processing.delivery_atlases, /frame\.png is the only standalone runtime file/);
  assert.ok(manifest.mechanical_pipeline.steps.some((step) => step.includes("18 content files were byte-locked")));
  assert.ok(manifest.mechanical_pipeline.steps.some((step) => step.includes("No celestial body") && step.includes("synthesized in code")));

  assert.equal(manifest.qa.overall_pass, true);
  assert.equal(manifest.qa.frame.pass, true);
  assert.deepEqual(manifest.qa.frame.center_opening_alpha_bbox, [18, 20, 861, 201]);
  assert.deepEqual(manifest.qa.frame.center_runs_at_alpha_32, {
    horizontal: { start: 18, end_inclusive: 860, length: 843 },
    vertical: { start: 20, end_inclusive: 200, length: 181 }
  });
  assert.equal(manifest.qa.frame.center_alpha, 0);
  assert.equal(manifest.qa.roller.pass, true);
  assert.equal(manifest.qa.roller.center_alpha, 0);
  assert.deepEqual(manifest.qa.roller.display_in_36px_wrapper, {
    outer_diameter: 33.375,
    center_opening: 30,
    wall_per_side_approx: 1.6875,
    orientation_cue: "two localized 4:30 grooves plus asymmetric 10 o'clock glaze highlight"
  });
  assert.equal(manifest.qa.scenes.pass, true);
  assert.equal(manifest.qa.markers.pass, true);
  assert.match(manifest.qa.markers.version_decision.v1, /Rejected/);
  assert.match(manifest.qa.markers.version_decision.v2, /Adopted/);
  assert.match(manifest.qa.markers.browser_actual_size_preview.path, /image-rendering-auto-actual\.png$/);
  assert.match(manifest.qa.markers.rendering, /image-rendering:auto/);
  assert.equal(manifest.qa.nodes_accents.pass, true);
  assert.deepEqual(manifest.qa.morning_day_distinction, {
    pass: true,
    scene_rmse_at_176x44: 97.136,
    node_rmse_at_32x32: 81.343,
    marker_rmse_at_20x20: 39.576,
    morning_marker_alpha_bbox: [13, 46, 131, 98],
    morning_node_alpha_bbox: [7, 5, 186, 188],
    actual_size_green_fringe_pixels: 0
  });
  assert.deepEqual(manifest.qa.final_composite.angles_degrees_clockwise, { morning: 0, day: 151.072, dusk: 302.144, night: 453.216 });

  assert.equal(manifest.delivery_contract.content_asset_count, 18);
  assert.equal(manifest.delivery_contract.delivery_atlas_count, 4);
  assert.deepEqual(manifest.delivery_contract.standalone_delivery_files, ["frame.png"]);
  assert.equal(manifest.delivery_contract.unique_runtime_request_count, 5);
  assert.deepEqual(manifest.delivery_contract.runtime_files, ["scene-atlas.png", "marker-atlas.png", "node-atlas.png", "accent-atlas.png", "frame.png"]);
  assert.match(manifest.delivery_contract.packaging_rule, /roller\.png is retained as a formal content source/);
  assert.match(manifest.delivery_contract.packaging_rule, /fifth native cell of node-atlas\.png/);
  assert.match(manifest.delivery_contract.packaging_rule, /must never request roller\.png independently/);
  assert.match(manifest.delivery_contract.packaging_rule, /must never duplicate a cell or visual region/);

  assert.equal(manifest.generated_assets.length, 18);
  assert.deepEqual(new Set(manifest.generated_assets.map(({ file }) => file)), new Set(wallpaperSwitchAssets.keys()));
  assert.equal(new Set(manifest.generated_assets.map(({ final_png }) => final_png.sha256)).size, 18);
  for (const generated of manifest.generated_assets) {
    const [width, height, sha256] = wallpaperSwitchAssets.get(generated.file);
    assert.deepEqual(generated.final_png, { width, height, sha256 });
    const file = await readFile(new URL(`assets/images/wallpaper-switch/${generated.file}`, root));
    assert.equal(createHash("sha256").update(file).digest("hex"), sha256, `${generated.file} bytes changed`);
    const decoded = await asset(`assets/images/wallpaper-switch/${generated.file}`);
    assert.deepEqual([decoded.metadata.width, decoded.metadata.height], [width, height]);
    assert.equal(decoded.bytes, generated.bytes, `${generated.file} manifest byte count drifted`);
    if (generated.file.startsWith("scene-")) {
      assert.equal(decoded.metadata.channels, 3, `${generated.file} must remain an opaque RGB field`);
    } else {
      assert.equal(decoded.metadata.hasAlpha, true, `${generated.file} must retain alpha`);
    }
  }

  for (const marker of themes.map((theme) => `marker-${theme}.png`)) {
    const markerPixels = await rgba(`assets/images/wallpaper-switch/${marker}`);
    const bounds = alphaBounds(markerPixels, 4);
    assert.ok(bounds.width >= 70 && bounds.height >= 30, `${marker} subject became too small`);
    assert.ok(greenDominantPixelCount(markerPixels) <= 1, `${marker} retained a visible chroma-key fringe`);
  }

  assert.equal(manifest.delivery_atlases.length, 4);
  for (const atlasRecord of manifest.delivery_atlases) {
    const [width, height, sha256, cells] = wallpaperSwitchDeliveryAtlases.get(atlasRecord.file);
    assert.deepEqual(atlasRecord.final_png, { width, height, sha256 });
    assert.deepEqual(atlasRecord.cells, cells);
    const atlasPath = `assets/images/wallpaper-switch/${atlasRecord.file}`;
    const atlasBytes = await readFile(new URL(atlasPath, root));
    assert.equal(createHash("sha256").update(atlasBytes).digest("hex"), sha256, `${atlasRecord.file} bytes changed`);
    assert.equal(atlasBytes.length, atlasRecord.bytes, `${atlasRecord.file} manifest byte count drifted`);
    const atlas = sharp(atlasBytes).ensureAlpha().raw();
    const { data, info } = await atlas.toBuffer({ resolveWithObject: true });
    assert.deepEqual([info.width, info.height], [width, height]);
    for (const [index, cell] of cells.entries()) {
      const source = await rgbaBuffer(await readFile(new URL(`assets/images/wallpaper-switch/${cell}`, root)));
      const rowBytes = atlasRecord.cell_width * 4;
      for (let row = 0; row < atlasRecord.cell_height; row += 1) {
        const atlasOffset = ((index * atlasRecord.cell_height + row) * info.width) * 4;
        const sourceOffset = row * rowBytes;
        assert.deepEqual(
          data.subarray(atlasOffset, atlasOffset + rowBytes),
          source.data.subarray(sourceOffset, sourceOffset + rowBytes),
          `${atlasRecord.file} cell ${cell} changed at row ${row}`
        );
      }
    }
  }

  assert.equal(manifest.historical_supersession.prior_asset_version, "20260809-wallpaper-time-switch-r4");
  assert.match(manifest.historical_supersession.status, /current long-term production contract is r5/);
  assert.equal(manifest.current_supersession.prior_asset_version, "20260810-wallpaper-time-switch-r5");
  assert.equal(manifest.current_supersession.asset_version, wallpaperSwitchAssetVersion);
  assert.match(manifest.current_supersession.status, /r6 is the current slim-rim dawn production contract/);
});

test("sprite and entry icons use decode-sized production atlases", async () => {
  const transfer = await asset("assets/transfer/quick-transfer-icons.png");
  assert.deepEqual([transfer.metadata.width, transfer.metadata.height], [168, 168]);
  assert.equal(transfer.metadata.hasAlpha, true, "Quick Transfer production atlas must preserve transparency");
  assert.equal(transfer.metadata.channels, 4, "Quick Transfer production atlas must decode as RGBA");
  assert.ok(transfer.bytes < 32 * 1024);

  const transferPixels = await rgba("assets/transfer/quick-transfer-icons.png");
  assert.ok(opaqueMagentaKeyRatio(transferPixels) < 0.01, "Quick Transfer production atlas must not retain an opaque magenta key");
  const cellSize = 42;
  let transparentPixels = 0;
  for (let offset = 3; offset < transferPixels.data.length; offset += 4) {
    if (transferPixels.data[offset] === 0) transparentPixels += 1;
  }
  assert.ok(transparentPixels / (168 * 168) > 0.45, "Quick Transfer atlas must not retain its magenta key as an opaque background");
  for (let row = 0; row < 4; row += 1) {
    for (let column = 0; column < 4; column += 1) {
      const left = column * cellSize;
      const top = row * cellSize;
      const corners = [[left, top], [left + cellSize - 1, top], [left, top + cellSize - 1], [left + cellSize - 1, top + cellSize - 1]];
      assert.ok(corners.every(([x, y]) => transferPixels.data[(y * 168 + x) * 4 + 3] === 0), `Quick Transfer cell ${row},${column} must have transparent corners`);
      let visiblePixels = 0;
      for (let y = top; y < top + cellSize; y += 1) {
        for (let x = left; x < left + cellSize; x += 1) {
          if (transferPixels.data[(y * 168 + x) * 4 + 3] > 0) visiblePixels += 1;
        }
      }
      const visibleRatio = visiblePixels / (cellSize * cellSize);
      assert.ok(visibleRatio > 0.03 && visibleRatio < 0.75, `Quick Transfer cell ${row},${column} visible ratio ${visibleRatio} is invalid`);
    }
  }

  const glyphs = await asset("assets/images/ui/pixel-ui-glyph-atlas.png");
  assert.deepEqual([glyphs.metadata.width, glyphs.metadata.height], [64, 64]);
  assert.equal(glyphs.metadata.hasAlpha, true);
  assert.ok(glyphs.bytes < 4 * 1024);

  for (const name of ["knowledge", "videos", "resources", "games", "blog", "monitor", "chatroom"]) {
    const icon = await asset(`assets/images/icon-${name}.png`);
    assert.deepEqual([icon.metadata.width, icon.metadata.height], [96, 96]);
    assert.equal(icon.metadata.hasAlpha, true, `icon-${name}.png must preserve transparency`);
    const iconPixels = await rgba(`assets/images/icon-${name}.png`);
    assert.ok(opaqueMagentaKeyRatio(iconPixels) < 0.01, `icon-${name}.png must not contain an opaque magenta-key background`);
  }

  const chatroomIcon = await asset("assets/images/icon-chatroom.png");
  const chatroomIconPixels = await rgba("assets/images/icon-chatroom.png");
  const chatroomIconBounds = alphaBounds(chatroomIconPixels);
  assert.ok(chatroomIcon.bytes < 4 * 1024, "canonical chatroom icon exceeds 4 KiB");
  assert.ok(chatroomIconBounds.width >= 68 && chatroomIconBounds.width <= 74);
  assert.ok(chatroomIconBounds.height >= 70 && chatroomIconBounds.height <= 75);
  assert.ok(chatroomIconBounds.left >= 10 && chatroomIconBounds.top >= 10);
  assert.ok(95 - chatroomIconBounds.right >= 10 && 95 - chatroomIconBounds.bottom >= 10);
  assert.ok(chatroomIconBounds.visibleRatio >= 0.45 && chatroomIconBounds.visibleRatio <= 0.60);
  const chatroomCornerAlpha = [0, 95, 95 * 96, 96 * 96 - 1]
    .map((pixel) => chatroomIconPixels.data[pixel * 4 + 3]);
  assert.ok(chatroomCornerAlpha.every((alpha) => alpha === 0), "canonical chatroom icon must have transparent corners");

  for (const name of ["quick-transfer", "whiteboard", "kittens-game", "a-dark-room", "2048", "hextris", "life-restart"]) {
    const path = `assets/images/generated-icons/${name}.png`;
    const icon = await asset(path);
    assert.deepEqual([icon.metadata.width, icon.metadata.height], [192, 192]);
    assert.equal(icon.metadata.hasAlpha, true, `${path} must preserve transparency`);
    assert.ok(icon.bytes < 32 * 1024, `${path} exceeds 32 KiB`);
    const pixels = await rgba(path);
    assert.ok(opaqueMagentaKeyRatio(pixels) < 0.001, `${path} must not retain its generation key color`);
    const cornerAlpha = [0, 191, 191 * 192, 192 * 192 - 1].map((pixel) => pixels.data[pixel * 4 + 3]);
    assert.ok(cornerAlpha.every((alpha) => alpha === 0), `${path} must have transparent corners`);
  }
});

test("Quick Transfer production atlas is deterministic and pixel-equivalent across encoders", async () => {
  const rebuilt = await buildTransferIconAtlas();
  const rebuiltAgain = await buildTransferIconAtlas();
  const committed = await readFile(new URL("assets/transfer/quick-transfer-icons.png", root));
  assert.deepEqual(rebuilt.buffer, rebuiltAgain.buffer, "the atlas encoder must be deterministic within one runtime");
  const rebuiltPixels = await rgbaBuffer(rebuilt.buffer);
  const committedPixels = await rgbaBuffer(committed);
  const difference = rgbaDifference(rebuiltPixels, committedPixels);
  assert.ok(difference.meanChannelDelta <= 2, `cross-platform atlas mean channel delta ${difference.meanChannelDelta} is too high`);
  assert.ok(difference.meanAlphaDelta <= 1.5, `cross-platform atlas mean alpha delta ${difference.meanAlphaDelta} is too high`);
  assert.ok(difference.largeDeltaChannelRatio <= 0.02, `cross-platform atlas large-delta ratio ${difference.largeDeltaChannelRatio} is too high`);
  assert.deepEqual(rebuilt.dimensions, [168, 168]);
  assert.ok(rebuilt.cellCorners.every((corners) => corners.every((alpha) => alpha === 0)));
});

test("JSON resource cache supports memory hits, 304 revalidation and last-known-good", async () => {
  let now = 100;
  let calls = 0;
  const cache = createJsonResourceCache({ retryDelays: [0], now: () => now });
  const fetcher = async ({ headers }) => {
    calls += 1;
    if (headers.get("If-None-Match") === '"v1"') return new Response(null, { status: 304 });
    return new Response(JSON.stringify({ value: 1 }), { headers: { ETag: '"v1"' } });
  };
  const first = await cache.request("articles:zh", fetcher, { maxAgeMs: 50 });
  assert.equal(first.source, "network");
  assert.equal((await cache.request("articles:zh", fetcher, { maxAgeMs: 50 })).source, "memory");
  now = 200;
  const stale = await cache.request("articles:zh", fetcher, { maxAgeMs: 50 });
  assert.equal(stale.source, "stale-while-revalidate");
  assert.equal((await stale.revalidation).source, "not-modified");
  const lkg = await cache.request("articles:zh", async () => { throw new TypeError("offline"); }, { force: true });
  assert.equal(lkg.source, "last-known-good");
  assert.deepEqual(lkg.data, { value: 1 });
  assert.equal(calls, 2);
});

test("JSON resource cache never reuses an aborted pending request across route scopes", async () => {
  const cache = createJsonResourceCache({ retryDelays: [0] });
  const firstScope = new AbortController();
  const secondScope = new AbortController();
  let calls = 0;
  let firstStarted;
  const started = new Promise((resolve) => { firstStarted = resolve; });
  const fetcher = ({ signal }) => {
    calls += 1;
    if (calls === 1) {
      firstStarted();
      return new Promise((resolve, reject) => {
        signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
      });
    }
    return Promise.resolve(new Response(JSON.stringify({ scope: "second" })));
  };

  const first = cache.request("articles:zh", fetcher, { signal: firstScope.signal });
  await started;
  firstScope.abort();
  const second = await cache.request("articles:zh", fetcher, { signal: secondScope.signal });

  await assert.rejects(first, { name: "AbortError" });
  assert.equal(calls, 2, "the new route scope must start a fresh network request");
  assert.deepEqual(second.data, { scope: "second" });
  assert.equal(cache.snapshot().pending, 0);
});

test("JSON resource cache still coalesces callers that share the same scope", async () => {
  const cache = createJsonResourceCache({ retryDelays: [0] });
  let calls = 0;
  let resolveFetch;
  const fetcher = () => {
    calls += 1;
    return new Promise((resolve) => { resolveFetch = resolve; });
  };

  const first = cache.request("videos:zh", fetcher);
  const second = cache.request("videos:zh", fetcher);
  await Promise.resolve();
  assert.equal(calls, 1);
  resolveFetch(new Response(JSON.stringify({ shared: true })));
  assert.deepEqual((await first).data, { shared: true });
  assert.deepEqual((await second).data, { shared: true });
});

test("cacheable API JSON emits a stable ETag and honors If-None-Match", async () => {
  assert.equal(PUBLIC_API_REPRESENTATION_VERSION, "20260820-chat-whiteboard-ui-r1");
  const first = await cacheableJson(new Request("https://example.test/api/articles"), { articles: [] });
  const etag = first.headers.get("ETag");
  assert.match(etag, /^"sha256-[a-f0-9]{64}"$/);
  assert.match(first.headers.get("Cache-Control"), /stale-while-revalidate=120/);
  assert.equal(first.headers.get("X-Content-Type-Options"), "nosniff");
  assert.match(first.headers.get("Content-Security-Policy") || "", /default-src 'none'/);
  const second = await cacheableJson(new Request("https://example.test/api/articles", {
    headers: { "If-None-Match": etag }
  }), { articles: [] });
  assert.equal(second.status, 304);
  const changed = await cacheableJson(new Request("https://example.test/api/articles"), { articles: [{ slug: "changed" }] });
  assert.notEqual(changed.headers.get("ETag"), etag, "ETags must change with the complete public representation");

  const seeded = await cacheableJson(
    new Request("https://example.test/api/articles/demo"),
    { article: { title: "mapped representation" } },
    { etagSeed: "article-1:2026-07-26T00:00:00.000Z:zh" }
  );
  const versionlessDigest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode("article-1:2026-07-26T00:00:00.000Z:zh")
  );
  const versionlessEtag = `"sha256-${Buffer.from(versionlessDigest).toString("hex")}"`;
  assert.notEqual(
    seeded.headers.get("ETag"),
    versionlessEtag,
    "custom ETag seeds must still be namespaced by the public representation version"
  );
});

test("public video thumbnails become bounded URLs with explicit dimensions", () => {
  const youtube = publicVideoThumbnail("https://i.ytimg.com/vi/demo/maxresdefault.jpg", "video-1", "https://lusu.example");
  assert.equal(youtube.url, "https://i.ytimg.com/vi/demo/mqdefault.jpg");
  assert.deepEqual([youtube.width, youtube.height], [320, 180]);

  const local = publicVideoThumbnail("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ", "video-2", "https://lusu.example", "2026-07-19T12:00:00.000Z");
  assert.equal(local.url, "https://lusu.example/api/videos/video-2/thumbnail?v=2026-07-19T12%3A00%3A00.000Z");
  assert.deepEqual([local.width, local.height], [1, 1]);
  assert.doesNotMatch(local.url, /^data:/);

  const uploadedPngHeader = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47]).copy(uploadedPngHeader);
  uploadedPngHeader.writeUInt32BE(960, 16);
  uploadedPngHeader.writeUInt32BE(540, 20);
  const uploaded = publicVideoThumbnail(`data:image/png;base64,${uploadedPngHeader.toString("base64")}`, "video-3", "https://lusu.example", "cover-r2");
  assert.equal(uploaded.url, "https://lusu.example/api/videos/video-3/thumbnail?v=cover-r2");
  assert.deepEqual([uploaded.width, uploaded.height], [960, 540]);

  uploadedPngHeader.writeUInt32BE(961, 16);
  assert.equal(publicVideoThumbnail(`data:image/png;base64,${uploadedPngHeader.toString("base64")}`, "video-4", "https://lusu.example").url, "");

  assert.equal(publicVideoThumbnail("https://evil.example/huge.jpg").url, "");
});
