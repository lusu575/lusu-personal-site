import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { VIDEO_IFRAME_LOAD_TIMEOUT_MS } from "../js/routes/videos.mjs";

test("video iframe timeout is explicit and short enough to expose recovery", () => {
  assert.equal(VIDEO_IFRAME_LOAD_TIMEOUT_MS, 8000);
  assert.ok(VIDEO_IFRAME_LOAD_TIMEOUT_MS >= 5000);
  assert.ok(VIDEO_IFRAME_LOAD_TIMEOUT_MS <= 10000);
});

test("video cards expose one play focus while thumbnails keep the same click action", async () => {
  const source = await readFile(new URL("../js/routes/videos.mjs", import.meta.url), "utf8");
  assert.match(source, /const thumb = document\.createElement\("div"\)/);
  assert.match(source, /thumb\.dataset\.videoId = item\.video_id/);
  assert.match(source, /button\.dataset\.videoId = item\.video_id/);
  assert.match(source, /thumb\.setAttribute\("aria-hidden", "true"\)/);
  assert.doesNotMatch(source, /const thumb = document\.createElement\("button"\)/);
});

test("video player keeps thumbnails and native iframe controls unobstructed and supplies retry plus original fallback", async () => {
  const [source, css, motionCss, main] = await Promise.all([
    readFile(new URL("../js/routes/videos.mjs", import.meta.url), "utf8"),
    readFile(new URL("../css/routes/videos.css", import.meta.url), "utf8"),
    readFile(new URL("../css/motion-system.css", import.meta.url), "utf8"),
    readFile(new URL("../js/main.js", import.meta.url), "utf8")
  ]);
  assert.doesNotMatch(source, /videoClickShield|video-click-shield|video-click-blocker/);
  assert.doesNotMatch(css, /video-click-shield|video-click-blocker/);
  assert.match(css, /\.video-thumb::after\s*\{\s*content:\s*none/);
  assert.match(motionCss, /\.video-thumb::after\s*\{\s*content:\s*none/);
  assert.doesNotMatch(css, /\.video-thumb::after\s*\{[\s\S]{0,320}border-radius:\s*50%/);
  assert.match(source, /iframe\.allowFullscreen = true/);
  assert.match(source, /iframe\.addEventListener\("load", settleLoaded/);
  assert.match(source, /iframe\.addEventListener\("error", settleFailed/);
  assert.match(source, /window\.setTimeout\(settleFailed, VIDEO_IFRAME_LOAD_TIMEOUT_MS\)/);
  assert.match(source, /retry\.dataset\.videoPlayerRetry/);
  assert.match(source, /frame\.replaceChildren\(fallback\)/);
  assert.match(main, /retryVideoPlayer\(videoPlayerRetry\.dataset\.videoPlayerRetry\)/);
  assert.match(css, /\.video-player-fallback \.xp-button\s*\{[\s\S]*?min-height:\s*44px/);
});

test("video loading, failure, true empty, and normal data keep distinct filter states", async () => {
  const source = await readFile(new URL("../js/routes/videos.mjs", import.meta.url), "utf8");
  assert.match(source, /if \(videoState\.loading && !videoState\.videos\.length\)[\s\S]*?renderVideoStatusState\("loading"\)/);
  assert.match(source, /if \(videoState\.error && !videoState\.videos\.length\)[\s\S]*?renderVideoStatusState\("failed"\)/);
  assert.match(source, /renderVideoEmptyState\(videoState\.videos\.length > 0\)/);
  assert.match(source, /target\.hidden = videoState\.videos\.length === 0/);
  assert.match(source, /if \(videoState\.loading\) list\.prepend\(renderVideoRecoveryNotice\("loading"\)\)/);
  assert.match(source, /else if \(videoState\.error\) list\.prepend\(renderVideoRecoveryNotice\("failed"\)\)/);
  assert.match(source, /activeFilters\.videos = "all"/);
});

test("video list uses cached request JSON and bounded thumbnail metadata", async () => {
  const source = await readFile(new URL("../js/routes/videos.mjs", import.meta.url), "utf8");
  assert.match(source, /requestJson\("videos", `\/api\/videos\?lang=/);
  assert.match(source, /staleWhileRevalidate: options\.force !== true/);
  assert.match(source, /item\.thumbnail_width/);
  assert.match(source, /item\.thumbnail_height/);
  assert.match(source, /image\.fetchPriority = "low"/);
  assert.match(source, /const controlledLocalThumbnail = url\.origin === window\.location\.origin/);
});
