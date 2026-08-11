import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

import {
  WALLPAPER_AMBIENT_ASSETS,
  WALLPAPER_AMBIENT_THEMES,
  createWallpaperAmbientController,
  wallpaperAmbientAsset,
  wallpaperAmbientResolution
} from "../js/core/wallpaper-ambient.mjs";

const root = new URL("../", import.meta.url);
const [ambientSource, mainSource, indexHtml, styleSource, motionSource, mobileSource] = await Promise.all([
  readFile(new URL("js/core/wallpaper-ambient.mjs", root), "utf8"),
  readFile(new URL("js/main.js", root), "utf8"),
  readFile(new URL("index.html", root), "utf8"),
  readFile(new URL("css/style.css", root), "utf8"),
  readFile(new URL("css/motion-system.css", root), "utf8"),
  readFile(new URL("css/mobile-ios-shell.css", root), "utf8")
]);
const ambientManifest = JSON.parse(
  await readFile(new URL("assets/videos/wallpaper-dynamic/manifest.json", root), "utf8")
);

const flushController = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setImmediate(resolve));
};

function cssRuleContaining(source, marker) {
  const markerIndex = source.indexOf(marker);
  assert.notEqual(markerIndex, -1, `missing CSS marker: ${marker}`);
  const openingBrace = source.indexOf("{", markerIndex);
  const closingBrace = source.indexOf("}", openingBrace);
  assert.ok(openingBrace > markerIndex && closingBrace > openingBrace, `invalid CSS rule around: ${marker}`);
  return source.slice(markerIndex, closingBrace + 1);
}

function createAmbientHarness(initialState, options = {}) {
  const state = { ...initialState };
  const log = [];
  const videos = [];
  const base = { className: "wallpaper-base" };
  const stars = { className: "wallpaper-stars" };
  const stage = {
    children: [base, stars],
    querySelector(selector) {
      if (selector.includes(".wallpaper-cloud") || selector.includes(".wallpaper-stars")) return stars;
      return null;
    },
    insertBefore(node, before) {
      const oldIndex = this.children.indexOf(node);
      if (oldIndex !== -1) this.children.splice(oldIndex, 1);
      const index = before ? this.children.indexOf(before) : -1;
      if (index === -1) this.children.push(node);
      else this.children.splice(index, 0, node);
      node.parentNode = this;
      return node;
    }
  };

  class FakeVideo {
    constructor() {
      this.attributes = new Map();
      this.dataset = {};
      this.style = {};
      this.listeners = new Map();
      this.animations = [];
      this.classNames = new Set();
      this.classList = { add: (...names) => names.forEach((name) => this.classNames.add(name)) };
      this.readyState = 0;
      this.paused = true;
      this.removed = false;
      this.loadCalls = 0;
      this.playCalls = 0;
      this.pauseCalls = 0;
      this.animateCalls = 0;
      this.rejectPlay = Boolean(options.rejectPlay);
      this.computedOpacity = "";
      this._src = "";
    }

    set src(value) {
      this._src = value;
      this.attributes.set("src", value);
    }

    get src() {
      return this._src;
    }

    setAttribute(name, value) {
      this.attributes.set(name, String(value));
    }

    removeAttribute(name) {
      this.attributes.delete(name);
      if (name === "src") this._src = "";
    }

    addEventListener(type, listener, listenerOptions = {}) {
      const listeners = this.listeners.get(type) || [];
      listeners.push({ listener, once: Boolean(listenerOptions?.once) });
      this.listeners.set(type, listeners);
    }

    removeEventListener(type, listener) {
      const listeners = this.listeners.get(type) || [];
      this.listeners.set(type, listeners.filter((entry) => entry.listener !== listener));
    }

    dispatch(type) {
      if (type === "canplay") this.readyState = 3;
      log.push(`event:${type}`);
      const listeners = [...(this.listeners.get(type) || [])];
      for (const entry of listeners) {
        entry.listener.call(this, { type, target: this });
        if (entry.once) this.removeEventListener(type, entry.listener);
      }
    }

    load() {
      this.loadCalls += 1;
      log.push(this.src ? "load:source" : "load:released");
    }

    play() {
      this.playCalls += 1;
      log.push("play");
      if (this.rejectPlay) return Promise.reject(new Error("autoplay rejected"));
      this.paused = false;
      return Promise.resolve();
    }

    pause() {
      this.pauseCalls += 1;
      this.paused = true;
      log.push("pause");
    }

    animate(keyframes, timing) {
      this.animateCalls += 1;
      log.push("animate");
      let resolveFinished;
      let rejectFinished;
      const animation = {
        keyframes,
        timing,
        cancelled: false,
        finished: options.deferAnimation
          ? new Promise((resolve, reject) => {
              resolveFinished = resolve;
              rejectFinished = reject;
            })
          : Promise.resolve(),
        finish() { resolveFinished?.(); },
        cancel() {
          this.cancelled = true;
          rejectFinished?.(new DOMException("Animation cancelled", "AbortError"));
        }
      };
      this.animations.push(animation);
      return animation;
    }

    getAnimations() {
      return this.animations;
    }

    remove() {
      this.removed = true;
      if (this.parentNode) {
        const index = this.parentNode.children.indexOf(this);
        if (index !== -1) this.parentNode.children.splice(index, 1);
      }
      this.parentNode = null;
      log.push("remove");
    }
  }

  const documentRef = {
    defaultView: { getComputedStyle: (node) => ({ opacity: node.computedOpacity || node.style.opacity || "1" }) },
    createElement(tagName) {
      assert.equal(tagName, "video");
      const video = new FakeVideo();
      videos.push(video);
      return video;
    }
  };
  const controller = createWallpaperAmbientController({
    document: documentRef,
    stage,
    getState: () => ({ ...state })
  });

  return {
    base,
    controller,
    log,
    setState(patch) { Object.assign(state, patch); },
    stage,
    stars,
    state,
    videos
  };
}

async function activatePendingVideo(harness, index = harness.videos.length - 1) {
  const video = harness.videos[index];
  assert.ok(video, "a pending ambient video must exist");
  video.dispatch("canplay");
  await flushController();
  return video;
}

test("ambient assets map exactly four themes to current-theme 1080p and 2160p MP4 files", async () => {
  assert.deepEqual(WALLPAPER_AMBIENT_THEMES, ["morning", "day", "dusk", "night"]);
  assert.deepEqual(Object.keys(WALLPAPER_AMBIENT_ASSETS), WALLPAPER_AMBIENT_THEMES);

  const urls = new Set();
  for (const theme of WALLPAPER_AMBIENT_THEMES) {
    assert.deepEqual(Object.keys(WALLPAPER_AMBIENT_ASSETS[theme]), ["1080", "2160"]);
    for (const resolution of ["1080", "2160"]) {
      const url = wallpaperAmbientAsset(theme, resolution);
      assert.equal(url, WALLPAPER_AMBIENT_ASSETS[theme][resolution]);
      assert.match(
        url,
        new RegExp(`^/assets/videos/wallpaper-dynamic/${theme}/motion-${resolution}\\.mp4\\?v=[a-z0-9-]+$`)
      );
      assert.ok(!urls.has(url), `${theme}:${resolution} must not reuse another theme's video URL`);
      urls.add(url);

      const diskUrl = new URL(url.split("?")[0].slice(1), root);
      const metadata = await stat(diskUrl);
      assert.ok(metadata.size > 1024, `${theme}:${resolution} video must be a non-empty production asset`);
      const header = await readFile(diskUrl);
      assert.equal(header.subarray(4, 8).toString("ascii"), "ftyp", `${theme}:${resolution} must be an MP4 file`);
      const manifestAsset = ambientManifest.themes[theme].assets.find(({ height }) => height === Number(resolution));
      assert.ok(manifestAsset, `${theme}:${resolution} must be recorded in the production manifest`);
      assert.equal(manifestAsset.url, url);
      assert.equal(manifestAsset.bytes, metadata.size);
      assert.equal(manifestAsset.cache_key, manifestAsset.sha256.slice(0, 12));
      assert.equal(createHash("sha256").update(header).digest("hex"), manifestAsset.sha256);
      assert.ok(header.indexOf(Buffer.from("moov")) < header.indexOf(Buffer.from("mdat")), `${theme}:${resolution} must keep moov before mdat`);
      assert.ok(
        metadata.size <= (resolution === "2160" ? 3 * 1024 * 1024 : 1.2 * 1024 * 1024),
        `${theme}:${resolution} must stay within the current-theme delivery budget`
      );
    }
  }
  assert.equal(urls.size, 8);
  assert.equal(wallpaperAmbientAsset("unknown", "2160"), "");
  assert.equal(wallpaperAmbientAsset("day", "unexpected"), WALLPAPER_AMBIENT_ASSETS.day[1080]);
  assert.equal(ambientManifest.release_id, "20260810-h3-ambient-wallpapers-4k-r1");
  assert.equal(ambientManifest.generation.super_resolution.weights_sha256, "f872d837d3c90ed2e05227bed711af5671a6fd1c9f7d7e91c911a61f155e99da");
  assert.equal(ambientManifest.quality_assurance.decoded_loop_wrap_mean_difference, 0);
  assert.equal(ambientManifest.quality_assurance.turn_step_at_or_below_adjacent_p90, true);
  assert.doesNotMatch(JSON.stringify(ambientManifest), /[A-Z]:\\/i, "production provenance must not expose local absolute paths");
});

test("4K and high-DPR viewports select 2160p while ordinary desktop stays on 1080p", () => {
  assert.equal(wallpaperAmbientResolution({ width: 1920, height: 1080, dpr: 1 }), "1080");
  assert.equal(wallpaperAmbientResolution({ width: 3840, height: 2160, dpr: 1 }), "2160");
  assert.equal(wallpaperAmbientResolution({ width: 2560, height: 1080, dpr: 1 }), "2160");
  assert.equal(wallpaperAmbientResolution({ width: 1280, height: 720, dpr: 2 }), "2160");
  assert.equal(wallpaperAmbientResolution({ width: 1920, height: 1080, dpr: 1.25 }), "1080");
  assert.equal(wallpaperAmbientResolution({ width: 0, height: 0, dpr: 0 }), "1080");
});

test("controller creates only the current theme, never preloads it, and fades only after canplay and play", async () => {
  const harness = createAmbientHarness({
    allowed: true,
    hidden: false,
    theme: "day",
    width: 1920,
    height: 1080,
    dpr: 1
  });

  harness.controller.sync();
  harness.controller.sync();
  assert.equal(harness.videos.length, 1, "repeat sync must reuse the pending current-theme request");
  const video = harness.videos[0];
  assert.equal(video.dataset.wallpaperAmbientTheme, "day");
  assert.equal(video.dataset.wallpaperAmbientResolution, "1080");
  assert.equal(video.preload, "none");
  assert.equal(video.autoplay, true);
  assert.equal(video.muted, true);
  assert.equal(video.loop, true);
  assert.equal(video.playsInline, true);
  assert.equal(video.playCalls, 0);
  assert.equal(video.animateCalls, 0);
  assert.equal(video.style.opacity, "0");

  await activatePendingVideo(harness, 0);
  assert.equal(video.playCalls, 1);
  assert.equal(video.animateCalls, 1);
  assert.equal(video.style.opacity, "1");
  assert.deepEqual(harness.controller.inspect(), {
    activeTheme: "day",
    activeResolution: "1080",
    pending: false
  });
  assert.ok(harness.log.indexOf("event:canplay") < harness.log.indexOf("play"));
  assert.ok(harness.log.indexOf("play") < harness.log.indexOf("animate"));
  assert.deepEqual(
    video.animations[0].keyframes,
    [{ opacity: 0 }, { opacity: 1 }],
    "the full-frame video may enter only through opacity"
  );
  assert.deepEqual(video.animations[0].timing, {
    duration: 240,
    easing: "cubic-bezier(0.23, 1, 0.32, 1)",
    fill: "forwards"
  });
});

test("load and autoplay failures remove the video source and leave the static wallpaper intact", async (t) => {
  for (const failure of ["network", "autoplay"]) {
    await t.test(failure, async () => {
      const harness = createAmbientHarness({
        allowed: true,
        hidden: false,
        theme: "morning",
        width: 1920,
        height: 1080,
        dpr: 1
      }, { rejectPlay: failure === "autoplay" });
      harness.controller.sync();
      const video = harness.videos[0];
      if (failure === "network") video.dispatch("error");
      else video.dispatch("canplay");
      await flushController();

      assert.equal(video.src, "", "failed media must release its decoder source");
      assert.equal(video.removed, true);
      assert.equal(harness.stage.children.includes(harness.base), true, "static wallpaper base must remain mounted");
      assert.deepEqual(harness.controller.inspect(), {
        activeTheme: "",
        activeResolution: "",
        pending: false
      });
    });
  }
});

test("hidden pages pause in place and disallowed state releases src, decoder, and node", async () => {
  const harness = createAmbientHarness({
    allowed: true,
    hidden: false,
    theme: "dusk",
    width: 1920,
    height: 1080,
    dpr: 1
  });
  harness.controller.sync();
  const video = await activatePendingVideo(harness);
  const originalSrc = video.src;

  harness.setState({ hidden: true });
  harness.controller.sync();
  assert.equal(video.paused, true);
  assert.equal(video.src, originalSrc, "visibility pause must not churn the decoded current-theme asset");
  assert.equal(video.removed, false);

  harness.setState({ hidden: false });
  harness.controller.sync();
  await flushController();
  assert.equal(harness.videos.length, 1);
  assert.equal(video.playCalls, 2, "returning visible resumes the existing video");

  harness.setState({ allowed: false });
  harness.controller.sync();
  assert.equal(video.src, "");
  assert.equal(video.loadCalls, 2, "release must call load after clearing src to free the decoder");
  assert.equal(video.removed, true);
  assert.deepEqual(harness.controller.inspect(), {
    activeTheme: "",
    activeResolution: "",
    pending: false
  });
});

test("a rejected visibility resume releases the active decoder and restores the static fallback", async () => {
  const harness = createAmbientHarness({
    allowed: true,
    hidden: false,
    theme: "morning",
    width: 1920,
    height: 1080,
    dpr: 1
  });
  harness.controller.sync();
  const video = await activatePendingVideo(harness);

  harness.setState({ hidden: true });
  harness.controller.sync();
  video.rejectPlay = true;
  harness.setState({ hidden: false });
  harness.controller.sync();
  await flushController();

  assert.equal(video.playCalls, 2);
  assert.equal(video.src, "");
  assert.equal(video.removed, true);
  assert.equal(harness.stage.children.includes(harness.base), true);
  assert.deepEqual(harness.controller.inspect(), {
    activeTheme: "",
    activeResolution: "",
    pending: false
  });
});

test("an interrupted fade preserves the sampled opacity in the outgoing scene snapshot", async () => {
  const harness = createAmbientHarness({
    allowed: true,
    hidden: false,
    theme: "dusk",
    width: 1920,
    height: 1080,
    dpr: 1
  }, { deferAnimation: true });
  harness.controller.sync();
  const video = harness.videos[0];
  video.dispatch("canplay");
  await flushController();
  assert.equal(video.animateCalls, 1);
  video.computedOpacity = "0.42";

  const snapshotVideo = harness.controller.takeForSceneSnapshot();
  await flushController();

  assert.equal(snapshotVideo, video);
  assert.equal(video.style.opacity, "0.42");
  assert.equal(video.classNames.has("wallpaper-theme-scene-video"), true);
  assert.equal(video.removed, false);
  assert.equal(video.animations[0].cancelled, true);
  assert.deepEqual(harness.controller.inspect(), {
    activeTheme: "",
    activeResolution: "",
    pending: false
  });
});

test("superseding a pending load removes its media listeners immediately", async () => {
  const harness = createAmbientHarness({
    allowed: true,
    hidden: false,
    theme: "night",
    width: 1920,
    height: 1080,
    dpr: 1
  });
  harness.controller.sync();
  const video = harness.videos[0];
  assert.equal(video.listeners.get("canplay")?.length, 1);
  assert.equal(video.listeners.get("error")?.length, 1);

  harness.setState({ allowed: false });
  harness.controller.sync();
  await flushController();

  assert.equal(video.listeners.get("canplay")?.length, 0);
  assert.equal(video.listeners.get("error")?.length, 0);
  assert.equal(video.src, "");
  assert.equal(video.loadCalls, 2, "a superseded pending video must release its decoder only once");
  assert.equal(video.removed, true);
});

test("theme changes release the old video immediately and activate only the playable replacement", async () => {
  const harness = createAmbientHarness({
    allowed: true,
    hidden: false,
    theme: "day",
    width: 1920,
    height: 1080,
    dpr: 1
  });
  harness.controller.sync();
  const oldVideo = await activatePendingVideo(harness);

  harness.setState({ theme: "night", width: 3840, height: 2160 });
  harness.controller.sync();
  assert.equal(harness.videos.length, 2);
  const newVideo = harness.videos[1];
  assert.equal(newVideo.dataset.wallpaperAmbientTheme, "night");
  assert.equal(newVideo.dataset.wallpaperAmbientResolution, "2160");
  assert.equal(oldVideo.src, "", "the superseded theme must release its decoder source immediately");
  assert.equal(oldVideo.removed, true);
  assert.equal(harness.stage.children.includes(harness.base), true, "static base covers the replacement wait");
  assert.deepEqual(harness.controller.inspect(), {
    activeTheme: "",
    activeResolution: "",
    pending: true
  });

  await activatePendingVideo(harness, 1);
  assert.equal(newVideo.removed, false);
  assert.deepEqual(harness.controller.inspect(), {
    activeTheme: "night",
    activeResolution: "2160",
    pending: false
  });
});

test("entry policy guarantees zero video requests on mobile, low, Save-Data, reduced, off, and non-Home routes", () => {
  const policyStart = mainSource.indexOf("function wallpaperAmbientState()");
  const policyEnd = mainSource.indexOf("function ensureWallpaperAmbientController", policyStart);
  assert.ok(policyStart >= 0 && policyEnd > policyStart, "wallpaper ambient policy must remain explicit");
  const policy = mainSource.slice(policyStart, policyEnd);
  assert.match(policy, /root\.dataset\.motion === "full"/);
  assert.match(policy, /document\.body\.dataset\.route === "home"/);
  assert.match(policy, /document\.documentElement\.dataset\.uiShell !== "mobile"/);
  assert.match(policy, /document\.documentElement\.dataset\.performanceTier !== "low"/);
  assert.match(policy, /connection\?\.saveData !== true/);
  assert.match(policy, /hidden:\s*document\.hidden/);

  assert.match(ambientSource, /video\.preload = "none"/);
  assert.match(ambientSource, /if \(!state\.allowed\) \{\s*destroy\(\)/);
  assert.match(ambientSource, /if \(state\.hidden\) \{[\s\S]*?releasePending\(\);[\s\S]*?activeVideo\?\.pause\?\.\(\)/);
  assert.doesNotMatch(indexHtml, /\.mp4(?:\?|["'])/i, "the HTML bootstrap must not request any MP4");
  assert.doesNotMatch(indexHtml, /<link\b[^>]*\bas=["']video["']/i);
  assert.doesNotMatch(indexHtml, /<video\b/i);

  assert.match(mainSource, /wallpaperAmbientController\?\.takeForSceneSnapshot\?\.\(\)/);
  assert.match(mainSource, /querySelectorAll\?\.\("video\.wallpaper-ambient-video"\)\.forEach\(releaseWallpaperAmbientVideo\)/);
  assert.match(mainSource, /querySelectorAll\("video\.wallpaper-ambient-video"\)\.forEach\(releaseWallpaperAmbientVideo\)/);
});

test("mobile, low-performance, and reduced/off CSS all hard-hide ambient video and stars", () => {
  const reducedOffRule = cssRuleContaining(
    styleSource,
    '.wallpaper-root[data-motion="reduced"] .wallpaper-ambient-video'
  );
  assert.match(reducedOffRule, /data-motion="off"/);
  assert.match(reducedOffRule, /display:\s*none\s*!important/);
  assert.match(
    styleSource,
    /\.wallpaper-root\[data-time="night"\]\[data-motion="full"\]\[data-paused="false"\] \.wallpaper-stars/
  );

  for (const [source, marker] of [
    [motionSource, 'html[data-performance-tier="low"] .wallpaper-ambient-video'],
    [mobileSource, 'html[data-ui-shell="mobile"] .wallpaper-ambient-video']
  ]) {
    const rule = cssRuleContaining(source, marker);
    assert.match(rule, /\.wallpaper-stars/);
    assert.match(rule, /display:\s*none\s*!important/);
  }

  const reducedRule = cssRuleContaining(
    styleSource.slice(styleSource.indexOf("@media (prefers-reduced-motion: reduce)")),
    ".wallpaper-ambient-video"
  );
  assert.match(reducedRule, /\.wallpaper-stars/);
  assert.match(reducedRule, /display:\s*none\s*!important/);
  assert.match(reducedRule, /animation:\s*none\s*!important/);
});
