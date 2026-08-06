import assert from "node:assert/strict";
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
  assert.equal(PUBLIC_API_REPRESENTATION_VERSION, "20260806-whiteboard-agent-images-r2");
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
