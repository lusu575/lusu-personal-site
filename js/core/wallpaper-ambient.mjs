export const WALLPAPER_AMBIENT_THEMES = Object.freeze(["morning", "day", "dusk", "night"]);

export const WALLPAPER_AMBIENT_ASSETS = Object.freeze({
  morning: Object.freeze({
    1080: "/assets/videos/wallpaper-dynamic/morning/motion-1080.mp4?v=5c27f252794a",
    2160: "/assets/videos/wallpaper-dynamic/morning/motion-2160.mp4?v=2a60f60122d1"
  }),
  day: Object.freeze({
    1080: "/assets/videos/wallpaper-dynamic/day/motion-1080.mp4?v=82c14e4178c4",
    2160: "/assets/videos/wallpaper-dynamic/day/motion-2160.mp4?v=272efb3341fb"
  }),
  dusk: Object.freeze({
    1080: "/assets/videos/wallpaper-dynamic/dusk/motion-1080.mp4?v=1d4a2dc8641d",
    2160: "/assets/videos/wallpaper-dynamic/dusk/motion-2160.mp4?v=33670f9614e2"
  }),
  night: Object.freeze({
    1080: "/assets/videos/wallpaper-dynamic/night/motion-1080.mp4?v=f03977297b96",
    2160: "/assets/videos/wallpaper-dynamic/night/motion-2160.mp4?v=e34357c9d394"
  })
});

const AMBIENT_VIDEO_TIMEOUT_MS = 15000;
const AMBIENT_VIDEO_FADE_MS = 240;
const AMBIENT_VIDEO_FADE_EASING = "cubic-bezier(0.23, 1, 0.32, 1)";

export function wallpaperAmbientResolution(metrics = {}) {
  const width = Math.max(0, Number(metrics.width) || 0);
  const height = Math.max(0, Number(metrics.height) || 0);
  const dpr = Math.max(1, Number(metrics.dpr) || 1);
  return width * dpr >= 2560 || height * dpr >= 1440 ? "2160" : "1080";
}

export function wallpaperAmbientAsset(theme, resolution) {
  const assets = WALLPAPER_AMBIENT_ASSETS[theme];
  if (!assets) return "";
  return assets[resolution === "2160" ? 2160 : 1080] || "";
}

export function releaseWallpaperAmbientVideo(video) {
  if (!video) return;
  video.getAnimations?.().forEach((animation) => animation.cancel());
  try {
    video.pause?.();
  } catch {
    // A detached or partially initialized video can already be inert.
  }
  video.removeAttribute?.("src");
  try {
    video.load?.();
  } catch {
    // Loading an empty source is only a decoder-release hint.
  }
  video.remove?.();
}

function waitForVideoReady(video, timeoutMs = AMBIENT_VIDEO_TIMEOUT_MS, signal = null) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timeoutId = 0;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      video.removeEventListener("canplay", ready);
      video.removeEventListener("error", failed);
      signal?.removeEventListener?.("abort", aborted);
      callback(value);
    };
    const ready = () => finish(resolve, true);
    const failed = () => finish(reject, new TypeError("Ambient wallpaper video failed to load"));
    const aborted = () => finish(reject, new DOMException("Ambient wallpaper video load was superseded", "AbortError"));
    video.addEventListener("canplay", ready, { once: true });
    video.addEventListener("error", failed, { once: true });
    signal?.addEventListener?.("abort", aborted, { once: true });
    timeoutId = setTimeout(() => failed(), timeoutMs);
    if (signal?.aborted) aborted();
    else if (video.readyState >= 3) ready();
  });
}

function createVideoElement(documentRef, theme, resolution, url) {
  const video = documentRef.createElement("video");
  video.className = "wallpaper-ambient-video";
  video.dataset.wallpaperAmbientTheme = theme;
  video.dataset.wallpaperAmbientResolution = resolution;
  video.setAttribute("aria-hidden", "true");
  video.setAttribute("muted", "");
  video.setAttribute("playsinline", "");
  video.setAttribute("loop", "");
  video.muted = true;
  video.defaultMuted = true;
  video.autoplay = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = "none";
  video.controls = false;
  video.disablePictureInPicture = true;
  video.style.opacity = "0";
  video.src = url;
  return video;
}

export function createWallpaperAmbientController(options) {
  const documentRef = options.document;
  const stage = options.stage;
  const getState = options.getState;
  let generation = 0;
  let activeVideo = null;
  let activeKey = "";
  let pendingVideo = null;
  let pendingKey = "";
  let pendingAbortController = null;

  const releasePending = () => {
    if (!pendingVideo) return;
    pendingAbortController?.abort();
    releaseWallpaperAmbientVideo(pendingVideo);
    pendingVideo = null;
    pendingKey = "";
    pendingAbortController = null;
  };

  const releaseActive = () => {
    if (!activeVideo) return;
    releaseWallpaperAmbientVideo(activeVideo);
    activeVideo = null;
    activeKey = "";
  };

  const destroy = () => {
    generation += 1;
    releasePending();
    releaseActive();
  };

  const insertAfterBase = (video) => {
    const firstOverlay = stage.querySelector(":scope > .wallpaper-cloud, :scope > .wallpaper-stars");
    stage.insertBefore(video, firstOverlay);
  };

  const fadeIn = async (video) => {
    if (typeof video.animate !== "function") {
      if (activeVideo === video) video.style.opacity = "1";
      return activeVideo === video;
    }
    const animation = video.animate(
      [{ opacity: 0 }, { opacity: 1 }],
      { duration: AMBIENT_VIDEO_FADE_MS, easing: AMBIENT_VIDEO_FADE_EASING, fill: "forwards" }
    );
    let completed = false;
    try {
      await animation.finished;
      completed = true;
    } catch {
      // Cancellation is expected when a theme snapshot interrupts the fade.
    }
    if (completed && activeVideo === video) video.style.opacity = "1";
    animation.cancel();
    return completed && activeVideo === video;
  };

  const load = async (state) => {
    const resolution = wallpaperAmbientResolution({
      width: state.width,
      height: state.height,
      dpr: state.dpr
    });
    const url = wallpaperAmbientAsset(state.theme, resolution);
    if (!url) {
      destroy();
      return;
    }
    const key = `${state.theme}:${resolution}`;
    if (activeVideo?.dataset.wallpaperAmbientTheme !== state.theme) {
      releaseActive();
    }
    if (activeVideo && activeKey === key) {
      const video = activeVideo;
      if (video.paused) {
        try {
          await video.play();
        } catch {
          if (activeVideo === video) releaseActive();
          return;
        }
        if (activeVideo !== video) return;
        const latest = getState();
        const latestResolution = wallpaperAmbientResolution(latest);
        if (!latest.allowed || latest.hidden || latest.theme !== state.theme || latestResolution !== resolution) {
          releaseActive();
        }
      }
      return;
    }
    if (pendingVideo && pendingKey === key) return;

    const requestGeneration = ++generation;
    releasePending();
    const video = createVideoElement(documentRef, state.theme, resolution, url);
    const abortController = new AbortController();
    pendingVideo = video;
    pendingKey = key;
    pendingAbortController = abortController;
    insertAfterBase(video);
    video.load();
    try {
      await waitForVideoReady(video, AMBIENT_VIDEO_TIMEOUT_MS, abortController.signal);
      await video.play();
      if (requestGeneration !== generation || pendingVideo !== video) {
        if (pendingVideo === video) {
          pendingVideo = null;
          pendingKey = "";
          pendingAbortController = null;
        }
        releaseWallpaperAmbientVideo(video);
        return;
      }
      const latest = getState();
      const latestResolution = wallpaperAmbientResolution(latest);
      if (!latest.allowed || latest.hidden || latest.theme !== state.theme || latestResolution !== resolution) {
        releaseWallpaperAmbientVideo(video);
        pendingVideo = null;
        pendingKey = "";
        pendingAbortController = null;
        return;
      }
      const previous = activeVideo;
      activeVideo = video;
      activeKey = key;
      pendingVideo = null;
      pendingKey = "";
      pendingAbortController = null;
      video.dataset.wallpaperAmbientActive = "true";
      await fadeIn(video);
      if (previous && previous !== video) releaseWallpaperAmbientVideo(previous);
      if (requestGeneration !== generation || activeVideo !== video) return;
    } catch {
      if (pendingVideo === video) {
        releasePending();
      } else if (video.hasAttribute?.("src") || video.src) {
        releaseWallpaperAmbientVideo(video);
      }
    }
  };

  const sync = () => {
    const state = getState();
    if (!state.allowed) {
      destroy();
      return;
    }
    if (state.hidden) {
      generation += 1;
      releasePending();
      activeVideo?.pause?.();
      return;
    }
    void load(state);
  };

  const takeForSceneSnapshot = () => {
    generation += 1;
    releasePending();
    const video = activeVideo;
    activeVideo = null;
    activeKey = "";
    if (!video) return null;
    video.pause();
    const currentOpacity = documentRef.defaultView?.getComputedStyle?.(video)?.opacity || video.style.opacity || "1";
    video.getAnimations?.().forEach((animation) => animation.cancel());
    video.style.opacity = currentOpacity;
    video.classList.add("wallpaper-theme-scene-video");
    delete video.dataset.wallpaperAmbientActive;
    return video;
  };

  const inspect = () => Object.freeze({
    activeTheme: activeVideo?.dataset.wallpaperAmbientTheme || "",
    activeResolution: activeVideo?.dataset.wallpaperAmbientResolution || "",
    pending: Boolean(pendingVideo)
  });

  return Object.freeze({ destroy, inspect, sync, takeForSceneSnapshot });
}
