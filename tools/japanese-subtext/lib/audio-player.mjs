import { CONTENT_VERSION, clampNumber, shortContentHash } from "./constants.mjs?v=20260726-japanese-subtext-network-r1";

const manifestUrl = new URL("../audio/manifest.json?v=20260726-audio-manifest-cache-r1", import.meta.url);
const defaultAudioRoot = new URL("../audio/", import.meta.url);
const defaultManifestTimeoutMs = 7000;

export class AudioPlayer extends EventTarget {
  constructor(AudioClass = globalThis.Audio) {
    super();
    this.audio = AudioClass ? new AudioClass() : null;
    this.manifest = null;
    this.audioRoot = defaultAudioRoot;
    this.stageId = "";
    this.itemId = "";
    this.stopAt = null;
    this.context = { kind: "", lineId: "", tokenId: "", questionId: "", optionId: "" };
    this.userUnlocked = false;
    this.playController = null;
    this.suppressedPauseEvents = 0;
    this.#bind();
  }

  async loadManifest(fetchImpl = globalThis.fetch?.bind(globalThis), { signal: callerSignal, timeoutMs = defaultManifestTimeoutMs } = {}) {
    if (this.manifest) return this.manifest;
    if (!fetchImpl) throw new Error("Fetch unavailable");
    const controller = new AbortController();
    let timedOut = false;
    const abortFromCaller = () => controller.abort(callerSignal?.reason);
    if (callerSignal?.aborted) {
      abortFromCaller();
    } else {
      callerSignal?.addEventListener("abort", abortFromCaller, { once: true });
    }
    const timer = globalThis.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    try {
      const response = await fetchImpl(manifestUrl, {
        cache: "force-cache",
        credentials: "same-origin",
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const manifest = await response.json();
      if (manifest?.schemaVersion !== 1 || manifest.contentVersion !== CONTENT_VERSION || !manifest.items || !manifest.stages) throw new Error("Invalid audio manifest");
      this.audioRoot = resolveAudioRoot(manifest.audioBaseUrl);
      this.manifest = manifest;
      return manifest;
    } catch (error) {
      if (timedOut) {
        const timeoutError = new Error("Audio manifest request timed out");
        timeoutError.name = "TimeoutError";
        timeoutError.code = "AUDIO_MANIFEST_TIMEOUT";
        throw timeoutError;
      }
      throw error;
    } finally {
      globalThis.clearTimeout(timer);
      callerSignal?.removeEventListener("abort", abortFromCaller);
    }
  }

  unlock() {
    this.userUnlocked = true;
    // The caller starts the first real local scene in the same user gesture.
    // Playing an empty media element here would consume activation without
    // proving that a real file can play.
  }

  configure({ playbackRate = 1, muted = false } = {}) {
    if (!this.audio) return;
    this.audio.playbackRate = [0.75, 1, 1.15].includes(Number(playbackRate)) ? Number(playbackRate) : 1;
    this.audio.muted = muted === true;
  }

  setStage(stageId) {
    if (this.stageId !== stageId) this.stop();
    this.stageId = stageId;
  }

  timeline(stageId = this.stageId) {
    return this.manifest?.stages?.[stageId] || null;
  }

  sceneDuration(stageId = this.stageId) {
    const timeline = this.timeline(stageId);
    const item = timeline?.sceneAudioId ? this.manifest?.items?.[timeline.sceneAudioId] : null;
    const duration = Number(timeline?.durationSeconds ?? timeline?.duration ?? item?.durationSeconds);
    return Number.isFinite(duration) && duration > 0 ? duration : 0;
  }

  isSceneLoaded() {
    return Boolean(this.timeline()?.sceneAudioId && this.itemId === this.timeline().sceneAudioId && this.audio?.src);
  }

  async playScene({ start = 0, end = null } = {}) {
    const timeline = this.timeline();
    if (!timeline?.sceneAudioId) throw new Error("Scene audio missing");
    return this.playItem(timeline.sceneAudioId, { start, end, context: { kind: "scene" } });
  }

  async playLine(lineId, fromStart = true) {
    const timeline = this.timeline();
    const cue = timeline?.cues?.find((item) => item.lineId === lineId);
    if (timeline?.sceneAudioId && cue) {
      return this.playItem(timeline.sceneAudioId, {
        start: cue.start,
        end: cue.end,
        context: { kind: "line", lineId }
      });
    }
    if (cue?.audioId) return this.playItem(cue.audioId, { start: fromStart ? 0 : undefined, context: { kind: "line", lineId } });
    throw new Error("Line audio missing");
  }

  async playToken(lineId, tokenId, audioId) {
    if (this.manifest?.items?.[audioId]) {
      return this.playItem(audioId, { context: { kind: "token", lineId, tokenId } });
    }
    const timeline = this.timeline();
    const token = timeline?.cues?.find((item) => item.lineId === lineId)?.tokens?.find((item) => item.id === tokenId);
    if (timeline?.sceneAudioId && token) {
      return this.playItem(timeline.sceneAudioId, { start: token.start, end: token.end, context: { kind: "token", lineId, tokenId } });
    }
    throw new Error("Token audio missing");
  }

  async playOption(questionId, optionId, audioId) {
    return this.playItem(audioId, { context: { kind: "option", questionId, optionId } });
  }

  async playItem(id, { start = 0, end = null, context = {} } = {}) {
    if (!this.audio || !this.manifest) throw new Error("Audio unavailable");
    const item = this.manifest.items[id];
    if (!item || !safeAudioPath(item.path)) {
      this.stop();
      throw new Error("Audio item missing");
    }
    const url = new URL(item.path, this.audioRoot);
    if (url.origin !== this.audioRoot.origin || !url.pathname.startsWith(this.audioRoot.pathname)) {
      this.stop();
      throw new Error("Unsafe audio path");
    }
    const cacheKey = shortContentHash(item.contentHash);
    if (cacheKey) url.searchParams.set("v", cacheKey);
    const signal = this.#beginPlaybackRequest();
    try {
      const sourceChanged = this.itemId !== id || this.audio.src !== url.href;
      if (sourceChanged) {
        this.#pauseAudioSilently();
        this.audio.src = url.href;
        this.audio.load();
      }
      this.itemId = id;
      this.stopAt = end === null || end === undefined
        ? null
        : (Number.isFinite(Number(end)) ? Number(end) : null);
      this.context = { kind: "", lineId: "", tokenId: "", questionId: "", optionId: "", ...context };
      const normalizedStart = Math.max(0, Number(start) || 0);
      let playPromise = null;
      let immediatePlayError = null;
      if (sourceChanged) {
        this.audio.currentTime = 0;
        // Calling play before the metadata round-trip preserves the first-click
        // browser activation granted by the explicit sound gate or seek action.
        const attempt = this.audio.play();
        if (attempt) {
          playPromise = Promise.resolve(attempt).then(
            () => true,
            (error) => { immediatePlayError = error; return false; }
          );
        }
      }
      await waitForMetadata(this.audio, signal);
      throwIfAborted(signal);
      this.audio.currentTime = clampNumber(normalizedStart, 0, Number.isFinite(this.audio.duration) ? this.audio.duration : Number.MAX_SAFE_INTEGER, 0);
      if (playPromise && !await playPromise) {
        throw immediatePlayError || new Error("Audio playback blocked");
      }
      throwIfAborted(signal);
      // Some browsers resolve the activation-time play() while load()/metadata
      // settling leaves a newly assigned source paused. Check the media element,
      // not only the promise, and resume after the final seek when necessary.
      if (this.audio.paused) {
        const attempt = this.audio.play();
        if (attempt) await attempt;
      }
      throwIfAborted(signal);
      if (this.audio.paused) throw new Error("Audio playback did not start");
      this.#emit("state", { state: "playing" });
    } catch (error) {
      if (!signal.aborted && this.playController?.signal === signal) this.stop();
      throw error;
    }
  }

  pause() {
    this.#cancelPlaybackRequest();
    this.#pauseAudioSilently();
    this.#emit("state", { state: "paused" });
  }

  async resume() {
    if (!this.audio?.src) return this.playScene({ start: 0 });
    const signal = this.#beginPlaybackRequest();
    await this.audio.play();
    throwIfAborted(signal);
    this.#emit("state", { state: "playing" });
  }

  seek(seconds) {
    if (!this.audio || !this.isSceneLoaded() || !Number.isFinite(this.audio.duration)) return false;
    this.stopAt = null;
    this.context = { kind: "scene", lineId: "", tokenId: "", questionId: "", optionId: "" };
    this.audio.currentTime = clampNumber(seconds, 0, this.audio.duration, 0);
    return true;
  }

  stop() {
    if (!this.audio) return;
    this.#cancelPlaybackRequest();
    this.#pauseAudioSilently();
    this.audio.removeAttribute("src");
    this.audio.load();
    this.itemId = "";
    this.stopAt = null;
    this.context = { kind: "", lineId: "", tokenId: "", questionId: "", optionId: "" };
    this.#emit("state", { state: "stopped" });
  }

  currentLineId() {
    if (this.context.lineId) return this.context.lineId;
    const time = this.audio?.currentTime || 0;
    return this.timeline()?.cues?.find((cue) => time >= cue.start && time < cue.end)?.lineId || "";
  }

  #bind() {
    if (!this.audio) return;
    this.audio.preload = "metadata";
    this.audio.addEventListener("timeupdate", () => {
      if (this.stopAt !== null && this.audio.currentTime >= this.stopAt) {
        this.#pauseAudioSilently();
        this.audio.currentTime = this.stopAt;
        this.stopAt = null;
        this.#emit("state", { state: "stopped" });
        this.#emit("segmentend", {});
      }
      this.#emit("time", {
        currentTime: this.audio.currentTime || 0,
        duration: Number.isFinite(this.audio.duration) ? this.audio.duration : 0,
        lineId: this.currentLineId()
      });
    });
    this.audio.addEventListener("ended", () => {
      const duration = Number(this.audio.duration);
      const currentTime = Number(this.audio.currentTime);
      // Chromium can surface a stale ended event while a newly assigned
      // source is settling. Only publish completion when playback really
      // reached the end of the current finite item.
      if (!Number.isFinite(duration) || duration <= 0 || currentTime < duration - 0.25) return;
      this.#emit("state", { state: "stopped" });
      this.#emit("ended", {});
    });
    this.audio.addEventListener("play", () => this.#emit("state", { state: "playing" }));
    this.audio.addEventListener("pause", () => {
      if (this.suppressedPauseEvents > 0) {
        this.suppressedPauseEvents -= 1;
        return;
      }
      this.#emit("state", { state: "paused" });
    });
    this.audio.addEventListener("error", () => this.#emit("error", { error: new Error("Audio load failed") }));
  }

  #emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail: { ...detail, context: this.context, itemId: this.itemId } }));
  }

  #beginPlaybackRequest() {
    this.#cancelPlaybackRequest();
    this.playController = new AbortController();
    return this.playController.signal;
  }

  #cancelPlaybackRequest() {
    this.playController?.abort();
    this.playController = null;
  }

  #pauseAudioSilently() {
    if (!this.audio || this.audio.paused) return;
    this.suppressedPauseEvents += 1;
    this.audio.pause();
  }
}

function resolveAudioRoot(value) {
  const root = new URL(typeof value === "string" && value.trim() ? value : "./", manifestUrl);
  if (!["https:", "http:", "file:"].includes(root.protocol) || root.username || root.password) throw new Error("Unsafe audio base URL");
  root.pathname = root.pathname.endsWith("/") ? root.pathname : `${root.pathname}/`;
  root.search = "";
  root.hash = "";
  return root;
}

function safeAudioPath(value) {
  const path = String(value || "");
  return /^[a-z0-9][a-z0-9._/-]*\.(mp3|ogg|wav)$/i.test(path) && !/(^|\/)\.\.(\/|$)/.test(path) && !path.includes("\\");
}

function waitForMetadata(audio, signal) {
  throwIfAborted(signal);
  if (audio.readyState >= 1) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const done = () => { cleanup(); resolve(); };
    const failed = () => { cleanup(); reject(new Error("Audio metadata failed")); };
    const aborted = () => { cleanup(); reject(abortError()); };
    const cleanup = () => {
      audio.removeEventListener("loadedmetadata", done);
      audio.removeEventListener("error", failed);
      signal?.removeEventListener("abort", aborted);
    };
    audio.addEventListener("loadedmetadata", done, { once: true });
    audio.addEventListener("error", failed, { once: true });
    signal?.addEventListener("abort", aborted, { once: true });
  });
}

function throwIfAborted(signal) {
  if (signal?.aborted) throw abortError();
}

function abortError() {
  if (typeof DOMException === "function") return new DOMException("Audio playback superseded", "AbortError");
  const error = new Error("Audio playback superseded");
  error.name = "AbortError";
  return error;
}
