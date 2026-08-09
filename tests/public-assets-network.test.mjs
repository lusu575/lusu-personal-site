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
const wallpaperSwitchAssetVersion = "20260809-wallpaper-time-switch-r4";
const wallpaperSwitchAssets = new Map([
  ["scene-morning.png", [880, 220, "f65a6382325b591613aab257cab1591f1dd492c2cf936aa22d0c76835142261a"]],
  ["scene-day.png", [880, 220, "4f863bf841682eb14aeb72a63d74e18f5db7ef62a4508968937850576e9fc4d5"]],
  ["scene-dusk.png", [880, 220, "cfa774d59070edd42960c62d866b93d4b03accc91d00826a0a2cb252831d105a"]],
  ["scene-night.png", [880, 220, "24954dfba76914225f2feb702fd9f1a50a3cb036a3da6177eed26b728f85fb2b"]],
  ["marker-morning.png", [144, 144, "1187f1dcd42d48c0544a7443cda053002161b4c8639a217ca6190a551ceadbb3"]],
  ["marker-day.png", [144, 144, "fe4f496fd1a0acc7e1e275efc1f721c528c90e12c926f971fed5f8b81e3b6dd6"]],
  ["marker-dusk.png", [144, 144, "35ec71df2e7dea2c81574135b48c9acbffbdb6f95375a2b46e9994c15400fad8"]],
  ["marker-night.png", [144, 144, "84e30849783f970b4fe8c96803bdf2f6f93accd60bfe715b4aaf7949d6704882"]],
  ["node-morning.png", [192, 192, "5257c540b8ff174bdf3e0bf09faaf0891e365a732350942ebde8a24bf98e05f1"]],
  ["node-day.png", [192, 192, "7d4509b71dcfe0c13276405a186af3e12ef6a546107252163ea9f5d094f6e21a"]],
  ["node-dusk.png", [192, 192, "db837f373de95d06ba83ecbba010acfdda691ea89f0a5060fbd0ad268a991e46"]],
  ["node-night.png", [192, 192, "380dc95628a4b1acbde73dfe929e130d24d762be625522fe8246c69445437045"]],
  ["accent-morning.png", [480, 160, "aa93ce40aca8267a60ea2d369acd88c7a8ab07217dbd3910abb14c5c9dbbc14d"]],
  ["accent-day.png", [480, 160, "f975882040b482fa0be47ef1f5659b75f13ecf44118b6ef814038a155b654363"]],
  ["accent-dusk.png", [480, 160, "5b42caea5cdb299a782d76d611f114ac9938fcae5ab5433c11597844e4eb4bbc"]],
  ["accent-night.png", [480, 160, "88ce460cfb915d0b0c4567ddbc51b750a64959efa849eeea0eb8de5e3e4a3d05"]],
  ["frame.png", [880, 220, "87df31d6535b46b2f32774f8a1d7d97f36c84f9a4a33706e672b9685b1e07147"]]
]);
const wallpaperSwitchDeliveryAtlases = new Map([
  ["scene-atlas.png", [880, 880, "4b0215a84bfc498fbde7494b8ab10ff9e0822956edd01f938fb75afe11f8bd2e", ["scene-morning.png", "scene-day.png", "scene-dusk.png", "scene-night.png"]]],
  ["marker-atlas.png", [144, 576, "aabf4cf0c48685812729242cd8af320180aeff2bdf9a90c46ca7cd3cec925975", ["marker-morning.png", "marker-day.png", "marker-dusk.png", "marker-night.png"]]],
  ["node-atlas.png", [192, 768, "9e5f1cc5f3e70812ff128404d7a85a6fcd202084a6805adcfefa17919e01e8de", ["node-morning.png", "node-day.png", "node-dusk.png", "node-night.png"]]],
  ["accent-atlas.png", [480, 640, "a1af92a465eeeeb6e7a47ac61bb62dc27cbca115e90b54fa0be325b98968169c", ["accent-morning.png", "accent-day.png", "accent-dusk.png", "accent-night.png"]]]
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

test("wallpaper switch manifest locks the 17 calm Image2 content assets and five runtime files", async () => {
  const manifestUrl = new URL("assets/images/wallpaper-switch/wallpaper-time-switch.source.json", root);
  const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));
  assert.equal(manifest.schema_version, 2);
  assert.equal(manifest.generator, "imagegen");
  assert.equal(manifest.asset_version, wallpaperSwitchAssetVersion);
  assert.deepEqual(manifest.visual_contract.control_size_css_px, [176, 44]);
  assert.deepEqual(manifest.visual_contract.active_node_css_px, [32, 32]);
  assert.deepEqual(manifest.visual_contract.inactive_marker_css_px, [20, 20]);
  assert.match(manifest.visual_contract.accent_model, /^Exactly one sparse Image2-generated accent layer per theme:/);
  assert.equal(manifest.generation_sources.length, 17);
  assert.ok(
    manifest.generation_sources.every((source) => /^exec-[a-f0-9-]+\.png$/.test(source.imagegen_output)),
    "every current visual group must retain its original Image2/imagegen output"
  );
  assert.match(
    manifest.mechanical_pipeline.steps.join(" "),
    /No celestial body, cloud, star, frame, marker, ray, horizon, glow band, or scene artwork was drawn or synthesized in code/
  );
  const finalSourceRoles = new Map(manifest.generation_sources.map((source) => [source.role, source]));
  assert.equal(finalSourceRoles.size, 17);
  assert.equal(finalSourceRoles.get("scene_day")?.imagegen_output, "exec-89b74651-1def-4494-a72a-100e48bfbe72.png");
  assert.equal(finalSourceRoles.get("scene_night")?.imagegen_output, "exec-15b635b1-348a-4de1-abc5-9353ff6ea2ad.png");
  assert.match(finalSourceRoles.get("scene_day")?.prompt_summary || "", /all clouds and semantic weather removed/);
  assert.match(finalSourceRoles.get("scene_night")?.prompt_summary || "", /every star and celestial subject removed/);
  assert.equal(manifest.refinement_provenance.image2_source_call_count_before_refinement, 14);
  assert.equal(manifest.refinement_provenance.image2_source_call_count_this_refinement, 6);
  assert.equal(manifest.refinement_provenance.image2_source_call_count_total, 20);
  assert.equal(manifest.refinement_provenance.generation_calls.length, 6);
  assert.deepEqual(
    manifest.refinement_provenance.generation_calls.map(({ imagegen_output }) => imagegen_output),
    [
      "exec-e384a283-df12-4e1a-9cad-57a42dee21c3.png",
      "exec-1ee61603-b412-43f0-aded-524745dae773.png",
      "exec-a55d99c1-b462-491f-b145-744c9ebb0c6f.png",
      "exec-cdce41cb-28ca-4113-8955-db7b79fdaa1c.png",
      "exec-947e4489-95ed-4758-8466-31f8a36190ae.png",
      "exec-dc111d55-c3f3-4340-ac30-c6181ccc9195.png"
    ]
  );
  assert.deepEqual(
    manifest.refinement_provenance.generation_calls.map(({ prompt_sha256 }) => prompt_sha256),
    [
      "b0ef86f842e96e8f8f711681d130377f57199d3a508ecff0edc436d1b084b350",
      "ee80c707e5556cf926bfaf72c7d2e5baf7d0744756d3934613c219c7ef283edd",
      "0b81b87cf04c25a1a1f6e072d1a640ac39923b88bb206ea4034d395a6933204d",
      "54b9568f30f212206252642947971a5a60287dc6dab6bd31867e153c72741ef8",
      "2ed9e5c0260099d93f57152630bf28b4798afcad6fb372e3a6072e5a8c19bdf1",
      "9bc7468395ba49f886d255ea7090102bb522f4ec625d2c9b6f368eeb313c4a5c"
    ]
  );
  const discardedDusk = manifest.refinement_provenance.generation_calls.find(({ role }) => role === "accent_dusk_green_key_draft");
  assert.equal(discardedDusk.adopted, false);
  assert.match(discardedDusk.rejection_reason, /yellow-green outer halo/);
  assert.equal(finalSourceRoles.get("accent_dusk")?.imagegen_output, "exec-dc111d55-c3f3-4340-ac30-c6181ccc9195.png");
  assert.match(finalSourceRoles.get("accent_dusk")?.prompt_summary || "", /magenta key/);

  const placementCorrection = manifest.placement_correction;
  assert.equal(placementCorrection.source_record, "output/wallpaper-switch-calm-refine/result.json#placementCorrection");
  assert.equal(placementCorrection.new_image2_calls, 0);
  assert.equal(placementCorrection.cumulative_image2_source_calls, 20);
  assert.equal(placementCorrection.resampled, false);
  assert.equal(placementCorrection.recolored, false);
  assert.match(placementCorrection.operation, /Integer-pixel translation/);
  assert.match(placementCorrection.content_invariant, /only transparent-canvas position changed/);
  const placementExpectations = new Map([
    ["accent-morning", {
      translation: [-15, -32],
      beforeHash: "4fba52840157517f282c7b5ede7b597d872a4aed02393987efc8d0acc8345eec",
      afterHash: "aa93ce40aca8267a60ea2d369acd88c7a8ab07217dbd3910abb14c5c9dbbc14d",
      beforeBbox: [45, 50, 95, 66],
      afterBbox: [30, 18, 80, 34],
      cropHash: "cd8a11f62b4e01d2924136412b4a6fb7dd63fd42eab68615772b8cbb0ffd1057",
      alphaPixels: [169, 169]
    }],
    ["accent-day", {
      translation: [35, -12],
      beforeHash: "24711954701c788d869bcb51f445d11d219d7d0cec414f6f1d8e994973b2ae35",
      afterHash: "f975882040b482fa0be47ef1f5659b75f13ecf44118b6ef814038a155b654363",
      beforeBbox: [165, 60, 229, 80],
      afterBbox: [200, 48, 264, 68],
      cropHash: "580669e2e4ca31a7df18d28cfba9fd8bbf6c98fdb9cfeb34ba82f2017fa4c8f3",
      alphaPixels: [909, 909]
    }],
    ["accent-dusk", {
      translation: [34, -13],
      beforeHash: "4b0c0266e313cac84fbba66818cdcf96acb58cae291c990cfda6ef21ded25524",
      afterHash: "5b42caea5cdb299a782d76d611f114ac9938fcae5ab5433c11597844e4eb4bbc",
      beforeBbox: [274, 87, 348, 91],
      afterBbox: [308, 74, 382, 78],
      cropHash: "da248bf95646cc9d4a07311fdcc83282943769a31505d175b7278199826c5299",
      alphaPixels: [264, 264]
    }]
  ]);
  for (const [role, expectation] of placementExpectations) {
    const correction = placementCorrection.assets[role];
    assert.deepEqual(correction.translation_xy, expectation.translation);
    assert.equal(correction.before_sha256, expectation.beforeHash);
    assert.equal(correction.after_sha256, expectation.afterHash);
    assert.deepEqual(correction.before_bbox_alpha_8, expectation.beforeBbox);
    assert.deepEqual(correction.after_bbox_alpha_8, expectation.afterBbox);
    assert.equal(correction.rgba_crop_sha256_before, expectation.cropHash);
    assert.equal(correction.rgba_crop_sha256_after, expectation.cropHash);
    assert.deepEqual(correction.alpha_ge_8_pixels_before_after, expectation.alphaPixels);
    assert.equal(correction.green_dominant_pixels_alpha_8, 0);
  }
  assert.deepEqual(placementCorrection.assets["accent-dusk"].before_bbox_alpha_1, [271, 87, 349, 91]);
  assert.deepEqual(placementCorrection.assets["accent-dusk"].after_bbox_alpha_1, [305, 74, 383, 78]);
  assert.equal(placementCorrection.validation_previews.after.sha256, "d66b8b8b3fc38290d620c02fbd5fda52bf77716fd14bd11e58338c55250c1ca3");
  assert.equal(placementCorrection.validation_previews.before_after.sha256, "9e57ec9175da1d651aa25733c9fccbe11f85e3bea464ba5997504aab7b37dfc2");

  const manifestNames = manifest.generated_assets.map(({ file }) => file);
  assert.deepEqual([...manifestNames].sort(), [...wallpaperSwitchAssets.keys()].sort());
  assert.equal(new Set(manifestNames).size, 17);
  assert.equal(
    new Set(manifest.generated_assets.map(({ final_png: { sha256 } }) => sha256)).size,
    17,
    "every Image2 content source must remain byte-distinct"
  );

  for (const entry of manifest.generated_assets) {
    const [expectedWidth, expectedHeight, expectedHash] = wallpaperSwitchAssets.get(entry.file);
    assert.deepEqual(
      [entry.final_png.width, entry.final_png.height, entry.final_png.sha256],
      [expectedWidth, expectedHeight, expectedHash],
      `${entry.file} manifest metadata drifted`
    );
    const url = new URL(`assets/images/wallpaper-switch/${entry.file}`, root);
    const bytes = await readFile(url);
    const metadata = await sharp(bytes).metadata();
    assert.deepEqual([metadata.width, metadata.height], [expectedWidth, expectedHeight], `${entry.file} dimensions drifted`);
    assert.equal(metadata.format, "png");
    if (entry.file.startsWith("scene-")) {
      assert.equal(metadata.hasAlpha, false, `${entry.file} is the intentionally opaque complete sky scene`);
      assert.equal(metadata.channels, 3, `${entry.file} must decode as RGB`);
    } else {
      assert.equal(metadata.hasAlpha, true, `${entry.file} must preserve its generated alpha channel`);
      assert.equal(metadata.channels, 4, `${entry.file} must decode as RGBA`);
    }
    assert.equal(createHash("sha256").update(bytes).digest("hex"), expectedHash, `${entry.file} bytes drifted`);
  }

  const duskNodeBounds = alphaBounds(await rgba("assets/images/wallpaper-switch/node-dusk.png"));
  assert.ok(duskNodeBounds.width >= 160 && duskNodeBounds.width <= 172, "dusk node must fill the active thumb with a restrained safety inset");
  assert.ok(duskNodeBounds.height >= 164 && duskNodeBounds.height <= 174, "dusk node must match the other active nodes' visual weight");
  assert.ok(
    duskNodeBounds.left >= 10
      && duskNodeBounds.top >= 10
      && duskNodeBounds.right <= 181
      && duskNodeBounds.bottom <= 181,
    "dusk node must retain a transparent safety inset on every edge"
  );

  const refinedAlphaExpectations = new Map([
    ["marker-day.png", { bbox: [26, 26, 118, 117], size: [92, 91], minCoverage: 0.04, maxCoverage: 0.065 }],
    ["marker-night.png", { bbox: [36, 26, 108, 118], size: [72, 92], minCoverage: 0.04, maxCoverage: 0.065 }],
    ["accent-morning.png", { bbox: [30, 18, 80, 34], size: [50, 16], minCoverage: 0.001, maxCoverage: 0.004 }],
    ["accent-day.png", { bbox: [200, 48, 264, 68], size: [64, 20], minCoverage: 0.009, maxCoverage: 0.014 }],
    ["accent-dusk.png", { bbox: [308, 74, 382, 78], size: [74, 4], minCoverage: 0.002, maxCoverage: 0.005 }]
  ]);
  for (const [file, expectation] of refinedAlphaExpectations) {
    const image = await rgba(`assets/images/wallpaper-switch/${file}`);
    const bounds = alphaBounds(image, 8);
    const manifestEntry = manifest.generated_assets.find((entry) => entry.file === file);
    assert.deepEqual(
      [bounds.left, bounds.top, bounds.right + 1, bounds.bottom + 1],
      expectation.bbox,
      `${file} alpha>=8 bounds drifted`
    );
    assert.deepEqual([bounds.width, bounds.height], expectation.size, `${file} sparse content size drifted`);
    assert.ok(
      bounds.visibleRatio >= expectation.minCoverage && bounds.visibleRatio <= expectation.maxCoverage,
      `${file} should remain visually sparse`
    );
    assert.deepEqual(manifestEntry.alpha_report.bbox, expectation.bbox, `${file} manifest alpha bounds drifted`);
    assert.deepEqual(manifestEntry.alpha_report.bbox_size, expectation.size, `${file} manifest alpha size drifted`);
    assert.equal(manifestEntry.alpha_report.threshold, 8);
    assert.ok(Math.abs(manifestEntry.alpha_report.coverage - bounds.visibleRatio) < 1e-12);
    assert.equal(greenDominantPixelCount(image, 8), 0, `${file} must not retain a green-key fringe`);
    assert.equal(manifestEntry.alpha_report.green_dominant_pixels, 0);
  }

  assert.equal(manifest.delivery_contract.content_asset_count, 17);
  assert.equal(manifest.delivery_contract.delivery_atlas_count, 4);
  assert.equal(manifest.delivery_contract.unique_runtime_request_count, 5);
  assert.deepEqual(manifest.delivery_contract.standalone_delivery_files, ["frame.png"]);
  assert.deepEqual(
    [...manifest.delivery_contract.runtime_files].sort(),
    [...wallpaperSwitchDeliveryAtlases.keys(), "frame.png"].sort()
  );
  assert.match(manifest.delivery_contract.packaging_rule, /Every atlas cell is a different byte-locked Image2-generated content asset/);
  assert.match(manifest.delivery_contract.packaging_rule, /must never duplicate (?:one|a) cell or visual region/);
  const packedCells = manifest.delivery_atlases.flatMap(({ cells }) => cells);
  assert.equal(new Set(packedCells).size, 16);
  assert.deepEqual(
    [...packedCells].sort(),
    [...wallpaperSwitchAssets.keys()].filter((file) => file !== "frame.png").sort()
  );

  for (const entry of manifest.delivery_atlases) {
    const [expectedWidth, expectedHeight, expectedHash, expectedCells] = wallpaperSwitchDeliveryAtlases.get(entry.file);
    assert.equal(entry.layout, "vertical");
    assert.deepEqual(entry.cells, expectedCells);
    assert.deepEqual([entry.cell_width, entry.cell_height], [expectedWidth, expectedHeight / expectedCells.length]);
    assert.deepEqual(
      [entry.final_png.width, entry.final_png.height, entry.final_png.sha256],
      [expectedWidth, expectedHeight, expectedHash],
      `${entry.file} delivery metadata drifted`
    );
    const atlasUrl = new URL(`assets/images/wallpaper-switch/${entry.file}`, root);
    const atlasBytes = await readFile(atlasUrl);
    const atlasMetadata = await sharp(atlasBytes).metadata();
    assert.deepEqual([atlasMetadata.width, atlasMetadata.height], [expectedWidth, expectedHeight]);
    assert.equal(createHash("sha256").update(atlasBytes).digest("hex"), expectedHash, `${entry.file} bytes drifted`);
    for (const [cellIndex, sourceFile] of expectedCells.entries()) {
      const [, cellHeight] = wallpaperSwitchAssets.get(sourceFile);
      const packedCell = await sharp(atlasBytes)
        .extract({ left: 0, top: cellIndex * cellHeight, width: expectedWidth, height: cellHeight })
        .ensureAlpha()
        .raw()
        .toBuffer();
      const sourceCell = await sharp(fileURLToPath(new URL(`assets/images/wallpaper-switch/${sourceFile}`, root)))
        .ensureAlpha()
        .raw()
        .toBuffer();
      assert.deepEqual(packedCell, sourceCell, `${entry.file} cell ${cellIndex} must exactly preserve ${sourceFile}`);
    }
  }

  const superseded = [
    "time-track.png",
    "time-selector.png",
    "node-inactive.png",
    ...themes.map((theme) => `fx-${theme}.png`),
    ...themes.map((theme) => `atmosphere-${theme}-ambient.png`),
    ...themes.flatMap((theme) => [
      `atmosphere-${theme}-far.png`,
      `atmosphere-${theme}-mid.png`,
      `atmosphere-${theme}-accent.png`,
      `atmosphere-${theme}-atlas.png`
    ])
  ];
  for (const file of superseded) {
    assert.ok(!manifestNames.includes(file), `${file} must not remain in the current manifest`);
    await assert.rejects(
      stat(new URL(`assets/images/wallpaper-switch/${file}`, root)),
      { code: "ENOENT" },
      `${file} must not remain as a production asset`
    );
  }
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
  assert.equal(PUBLIC_API_REPRESENTATION_VERSION, "20260810-wallpaper-switch-calm-r1");
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
