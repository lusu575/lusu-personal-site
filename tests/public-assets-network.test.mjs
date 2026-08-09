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
const wallpaperSwitchAssetVersion = "20260809-wallpaper-time-switch-r3";
const wallpaperSwitchAssets = new Map([
  ["scene-morning.png", [880, 220, "ed0f0b42223e1b9347739f59bae3b00518b251207f62c5c6c37a9dc2fc979393"]],
  ["scene-day.png", [880, 220, "00bb13527a6d3fdb15a779dc9579bcd5175904b373c696b05c4167c3745d537a"]],
  ["scene-dusk.png", [880, 220, "f72219f3b62351a9bfe9b1afb116249b78a8987e2f1e9eac79b6750d238b6ba5"]],
  ["scene-night.png", [880, 220, "d020eec6d9253cbf8588a681abd71bd20d6bfa58d9e079df898cb94f091e6758"]],
  ["frame.png", [880, 220, "34d03206c9277953ae2710695c57e8bfd059f185db5c9d861fe6ecdb8cbe5c46"]],
  ["node-morning.png", [192, 192, "dfade5d678756845c855182f4249feff0bfd42e0b2cdfdac84dbb2c84c9e6c73"]],
  ["node-day.png", [192, 192, "0003d44d137a2f03c10a90b8034ce3b00679805df2d549561ae81812ce2b2fa0"]],
  ["node-dusk.png", [192, 192, "bb90046a011d1091d081c02048cf8a159bc29adc36702c979a1c74df75da4f9f"]],
  ["node-night.png", [192, 192, "175b6f108f711aa7f0c2095c0e528bb002158fa4ef88238aa66fcb8a3349e295"]],
  ["marker-morning.png", [144, 96, "c0af964bd10b9e30871aef87a46319e3f9642ca84564caae3bbf04a0d9310937"]],
  ["marker-day.png", [144, 96, "9a183cbaee3270b04b22aa0ab2b9ed183c8ead354624ec4d45ffae1e0c469767"]],
  ["marker-dusk.png", [144, 96, "be4ee00780f9ae289f470fd34ded431f634a8c75c351224d0e9a4cc63c0af4b4"]],
  ["marker-night.png", [144, 96, "b1047f56ab1e8e8a5835b1718b8265d2ac02984d4a548b4cf56a0d1b2f9b289e"]],
  ["atmosphere-morning-far.png", [480, 160, "8974fff8f730abf1712e580058951e4aca524e4cbe0f7a4df66beb50e1dfb597"]],
  ["atmosphere-morning-mid.png", [480, 160, "fe06df84c2cc35c1776c37673f70c231d35e54962f50bb99c4ffbe37d8ea2e57"]],
  ["atmosphere-morning-accent.png", [480, 160, "8bc6674767df6e7d08aac573f181cfd8d3356d77a385a29667f10b9155c8f790"]],
  ["atmosphere-day-far.png", [480, 160, "37aff340e4ca71ec14515b6c4f88fc30c858858da807ba0a9bbe339c0e621db5"]],
  ["atmosphere-day-mid.png", [480, 160, "f0e1c700f25a34882300204587440bfc3f794f98411d1ab0371ecf0091ed4540"]],
  ["atmosphere-day-accent.png", [480, 160, "00d58ec520258b586f2ba9d5d9bda811f0371a4a398ffefa2c3af703c9752e1d"]],
  ["atmosphere-dusk-far.png", [480, 160, "0c6a8c6c73bef4920ea6e26092331a06ba2b01750bef5f53c5bf76c2f86b4f23"]],
  ["atmosphere-dusk-mid.png", [480, 160, "041d8f11bf2e135f1993c92208cf0ada19c4d2e2b566b3bcc11a052e09385385"]],
  ["atmosphere-dusk-accent.png", [480, 160, "95aa78d8a0d8ef328f27f9dce70d734cc77319f403256290a17c46a33a5ef930"]],
  ["atmosphere-night-far.png", [480, 160, "26cc237f451ff60ede8cacf9ba6db763b3655e214e21f239f64e5cb1ee68f603"]],
  ["atmosphere-night-mid.png", [480, 160, "a8c8ba878eafad8376dfd8f1484119b5e200a5182a76ce1c9f474dc8e07681ba"]],
  ["atmosphere-night-accent.png", [480, 160, "12c4b24711673952298d7e5d38da9ce43b814969e65c312a5da05a571f0b6df4"]]
]);
const wallpaperSwitchDeliveryAtlases = new Map([
  ["scene-atlas.png", [880, 880, "e6ac37ea24ea01dfe963b9c7fa924eab724e6a2d08ee92b788488acb1937527c", ["scene-morning.png", "scene-day.png", "scene-dusk.png", "scene-night.png"]]],
  ["marker-atlas.png", [144, 384, "7607e9ae777f4fdfa359e28e85bc567a56f797a9fb6488c6e1ae52aaaa4b279b", ["marker-morning.png", "marker-day.png", "marker-dusk.png", "marker-night.png"]]],
  ["node-atlas.png", [192, 768, "a16d8d5264f5c69be8e5bc5aae40309294dc5f450e2ef7a14da4e776890f4262", ["node-morning.png", "node-day.png", "node-dusk.png", "node-night.png"]]],
  ["atmosphere-morning-atlas.png", [480, 480, "8164b84c4193f15bd5a00861c9b3591dbc43406f19d49f014ee463adc7ba6150", ["atmosphere-morning-far.png", "atmosphere-morning-mid.png", "atmosphere-morning-accent.png"]]],
  ["atmosphere-day-atlas.png", [480, 480, "e443b5cb2bcfc20279994ced87529a3640269e6b9c5bef00dbc163301f884839", ["atmosphere-day-far.png", "atmosphere-day-mid.png", "atmosphere-day-accent.png"]]],
  ["atmosphere-dusk-atlas.png", [480, 480, "06d1f2e2b9bbdd0094cc1a3d1f0aa7905bf274d06751d78786920870421059b1", ["atmosphere-dusk-far.png", "atmosphere-dusk-mid.png", "atmosphere-dusk-accent.png"]]],
  ["atmosphere-night-atlas.png", [480, 480, "33677b5f579c2f4a99caf11279d8053926d3a9341e586d98dc6385ddcd2a1583", ["atmosphere-night-far.png", "atmosphere-night-mid.png", "atmosphere-night-accent.png"]]]
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

function alphaBounds(image) {
  let left = image.info.width;
  let top = image.info.height;
  let right = -1;
  let bottom = -1;
  let visiblePixels = 0;
  for (let y = 0; y < image.info.height; y += 1) {
    for (let x = 0; x < image.info.width; x += 1) {
      if (image.data[(y * image.info.width + x) * 4 + 3] === 0) continue;
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

test("wallpaper switch manifest locks the 25 generated scene assets", async () => {
  const manifestUrl = new URL("assets/images/wallpaper-switch/wallpaper-time-switch.source.json", root);
  const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));
  assert.equal(manifest.schema_version, 2);
  assert.equal(manifest.generator, "imagegen");
  assert.equal(manifest.asset_version, wallpaperSwitchAssetVersion);
  assert.deepEqual(manifest.visual_contract.control_size_css_px, [176, 44]);
  assert.deepEqual(manifest.visual_contract.active_node_css_px, [32, 32]);
  assert.deepEqual(manifest.visual_contract.inactive_marker_css_px, [18, 12]);
  assert.deepEqual(manifest.visual_contract.atmosphere_roles, ["far", "mid", "accent"]);
  assert.ok(
    manifest.generation_sources.every((source) => /^exec-[a-f0-9-]+\.png$/.test(source.imagegen_output)),
    "every current visual group must retain its original Image2/imagegen output"
  );
  assert.match(
    manifest.mechanical_pipeline.steps.join(" "),
    /No celestial body, cloud, star, planet, frame, marker, ray, or scene artwork was drawn or synthesized in code/
  );

  const manifestNames = manifest.generated_assets.map(({ file }) => file);
  assert.deepEqual([...manifestNames].sort(), [...wallpaperSwitchAssets.keys()].sort());
  assert.equal(new Set(manifestNames).size, 25);
  assert.equal(
    new Set(manifest.generated_assets.map(({ final_png: { sha256 } }) => sha256)).size,
    25,
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
  assert.ok(duskNodeBounds.width >= 174 && duskNodeBounds.width <= 182, "dusk node must nearly fill the 32px active thumb");
  assert.ok(duskNodeBounds.height >= 174 && duskNodeBounds.height <= 182, "dusk node must match the other active nodes' visual weight");
  assert.ok(
    duskNodeBounds.left >= 5
      && duskNodeBounds.top >= 5
      && duskNodeBounds.right <= 186
      && duskNodeBounds.bottom <= 186,
    "dusk node must retain a transparent safety inset on every edge"
  );

  assert.equal(manifest.delivery_contract.content_asset_count, 25);
  assert.equal(manifest.delivery_contract.delivery_atlas_count, 7);
  assert.equal(manifest.delivery_contract.unique_runtime_request_count, 8);
  assert.deepEqual(manifest.delivery_contract.standalone_delivery_files, ["frame.png"]);
  assert.deepEqual(
    [...manifest.delivery_contract.runtime_files].sort(),
    [...wallpaperSwitchDeliveryAtlases.keys(), "frame.png"].sort()
  );
  assert.match(manifest.delivery_contract.packaging_rule, /Every atlas cell is a different byte-locked Image2-generated content asset/);
  assert.match(manifest.delivery_contract.packaging_rule, /must never duplicate one cell or visual region/);
  const packedCells = manifest.delivery_atlases.flatMap(({ cells }) => cells);
  assert.equal(new Set(packedCells).size, 24);
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
    ...themes.map((theme) => `atmosphere-${theme}-ambient.png`)
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
  assert.equal(PUBLIC_API_REPRESENTATION_VERSION, "20260809-wallpaper-switch-scene-r1");
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
