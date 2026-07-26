import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { VIDEO_IFRAME_LOAD_TIMEOUT_MS } from "../js/routes/videos.mjs";

test("video iframe timeout is explicit and short enough to expose recovery", () => {
  assert.equal(VIDEO_IFRAME_LOAD_TIMEOUT_MS, 8000);
  assert.ok(VIDEO_IFRAME_LOAD_TIMEOUT_MS >= 5000);
  assert.ok(VIDEO_IFRAME_LOAD_TIMEOUT_MS <= 10000);
});

test("video cards expose a native titled thumbnail button and a titled card action", async () => {
  const source = await readFile(new URL("../js/routes/videos.mjs", import.meta.url), "utf8");
  assert.match(source, /const thumb = document\.createElement\("button"\)/);
  assert.match(source, /thumb\.type = "button"/);
  assert.match(source, /thumb\.dataset\.videoId = item\.video_id/);
  assert.match(source, /button\.dataset\.videoId = item\.video_id/);
  assert.match(source, /thumb\.setAttribute\("aria-label", videoPlayLabel\)/);
  assert.match(source, /button\.setAttribute\("aria-label", videoPlayLabel\)/);
  assert.doesNotMatch(source, /thumb\.setAttribute\("aria-hidden", "true"\)/);
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
  assert.match(source, /let settled = false/);
  assert.match(source, /settled \|\| requestId !== videoState\.playerRequestId/);
  assert.match(source, /retry\.dataset\.videoPlayerRetry/);
  assert.match(source, /actions\.className = "video-player-fallback-actions"/);
  assert.match(source, /original\.href = originalUrl/);
  assert.match(source, /original\.target = "_blank"/);
  assert.match(source, /original\.rel = "noreferrer noopener"/);
  assert.match(source, /frame\.replaceChildren\(fallback\)/);
  assert.match(main, /retryVideoPlayer\(videoPlayerRetry\.dataset\.videoPlayerRetry\)/);
  assert.match(css, /\.video-player-fallback \.xp-button\s*\{[\s\S]*?min-height:\s*44px/);
  assert.match(css, /\.video-modal-actions #video-link\[hidden\]\s*\{\s*display:\s*none/);
});

test("video loading, failure, true empty, and normal data keep distinct filter states", async () => {
  const [source, main] = await Promise.all([
    readFile(new URL("../js/routes/videos.mjs", import.meta.url), "utf8"),
    readFile(new URL("../js/main.js", import.meta.url), "utf8")
  ]);
  assert.match(source, /if \(videoState\.loading && !videoState\.videos\.length\)[\s\S]*?renderVideoStatusState\("loading"\)/);
  assert.match(source, /if \(videoState\.error && !videoState\.videos\.length\)[\s\S]*?renderVideoStatusState\("failed"\)/);
  assert.match(source, /renderVideoEmptyState\(videoState\.videos\.length > 0\)/);
  assert.match(source, /target\.hidden = videoState\.videos\.length === 0/);
  assert.match(source, /if \(videoState\.loading\) list\.prepend\(renderVideoRecoveryNotice\("loading"\)\)/);
  assert.match(source, /else if \(videoState\.error\) list\.prepend\(renderVideoRecoveryNotice\("failed"\)\)/);
  assert.match(source, /activeFilters\.videos = "all"/);
  assert.match(source, /showAll\.dataset\.videoShowAll = ""/);
  assert.match(source, /showAll\.textContent = videoUiText\("showAll"\)/);
  assert.match(source, /updates\.dataset\.articleCategory = siteUpdateCategory/);
  assert.match(source, /updates\.className = `xp-button\$\{isFiltered \? " is-secondary" : ""\}`/);
  assert.match(main, /data-video-show-all[\s\S]*?showAllVideos\(\)/);
});

test("video category DOM replacement preserves the focused category", async () => {
  const [source, main] = await Promise.all([
    readFile(new URL("../js/routes/videos.mjs", import.meta.url), "utf8"),
    readFile(new URL("../js/main.js", import.meta.url), "utf8")
  ]);

  assert.match(source, /const focusedCategory = focusedButton\?\.dataset\.filter \|\| ""/);
  assert.match(source, /target\.replaceChildren\(\)/);
  assert.match(source, /if \(focusedCategory\) \{\s*focusVideoCategory\(focusedCategory\)/);
  assert.match(source, /function focusVideoCategory\(categoryId = activeFilters\.videos\)/);
  assert.match(source, /button\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(source, /function showAllVideos\(\) \{[\s\S]*?activeFilters\.videos = "all"[\s\S]*?focusVideoCategory\("all"\)/);
  assert.match(main, /filterType === "videos"[\s\S]*?renderVideos\(\)[\s\S]*?focusVideoCategory\(filterValue\)/);
});

test("video list uses cached request JSON and bounded thumbnail metadata", async () => {
  const [source, api] = await Promise.all([
    readFile(new URL("../js/routes/videos.mjs", import.meta.url), "utf8"),
    readFile(new URL("../functions/api/[[route]].js", import.meta.url), "utf8")
  ]);
  assert.match(source, /requestJson\("videos", `\/api\/videos\?lang=/);
  assert.match(source, /staleWhileRevalidate: options\.force !== true/);
  assert.match(source, /item\.thumbnail_width/);
  assert.match(source, /item\.thumbnail_height/);
  assert.match(source, /image\.fetchPriority = "low"/);
  assert.match(source, /thumbnailWidth <= 960 && thumbnailHeight > 0 && thumbnailHeight <= 540/);
  assert.match(source, /const controlledLocalThumbnail = url\.origin === window\.location\.origin/);
  assert.match(api, /publicVideoThumbnail\(row\.thumbnail_url, row\.video_id, options\.origin, row\.updated_at \|\| row\.created_at\)/);
  assert.doesNotMatch(api, /etagSeed: `\$\{lang\}:\$\{rows\.map/);
});
