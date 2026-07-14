import { mergeProgress, mergeSettings, sanitizeProgress, sanitizeSettings } from "./storage.mjs?v=20260714-japanese-subtext-v103-retry-r1";

const ENDPOINT = "/api/tools/japanese-subtext/progress";

export class CloudProgress {
  constructor(fetchImpl = globalThis.fetch?.bind(globalThis)) {
    this.fetch = fetchImpl;
    this.signedIn = false;
    this.timer = 0;
    this.inFlight = false;
    this.queuedSave = null;
  }

  async loadAndMerge(localProgress, localSettings) {
    if (!this.fetch) return { signedIn: false, progress: localProgress, settings: localSettings };
    const response = await this.fetch(ENDPOINT, { credentials: "include", headers: { Accept: "application/json" } });
    if (response.status === 401) return { signedIn: false, progress: localProgress, settings: localSettings };
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
    this.signedIn = true;
    const cloudProgress = payload.progress && typeof payload.progress === "object" && !Array.isArray(payload.progress) ? payload.progress : localProgress;
    const cloudSettings = payload.settings && typeof payload.settings === "object" && !Array.isArray(payload.settings) ? payload.settings : localSettings;
    return {
      signedIn: true,
      progress: mergeProgress(localProgress, cloudProgress),
      settings: mergeSettings(localSettings, cloudSettings, localSettings.uiLanguage)
    };
  }

  schedule(progress, settings, callback, delay = 900) {
    if (!this.signedIn) return;
    globalThis.clearTimeout?.(this.timer);
    const snapshot = {
      progress: sanitizeProgress(progress),
      settings: sanitizeSettings(settings, settings?.uiLanguage)
    };
    this.timer = globalThis.setTimeout?.(() => this.save(snapshot.progress, snapshot.settings).then(() => callback?.(null)).catch((error) => callback?.(error)), delay);
  }

  save(progressInput, settingsInput) {
    if (!this.signedIn || !this.fetch) return Promise.resolve(null);
    const progress = sanitizeProgress(progressInput);
    const settings = sanitizeSettings(settingsInput, settingsInput?.uiLanguage);
    return new Promise((resolve, reject) => {
      const waiters = this.queuedSave?.waiters || [];
      this.queuedSave = { progress, settings, waiters: [...waiters, { resolve, reject }] };
      this.#drainSaves();
    });
  }

  async #drainSaves() {
    if (this.inFlight || !this.queuedSave) return;
    const job = this.queuedSave;
    this.queuedSave = null;
    this.inFlight = true;
    try {
      const response = await this.fetch(ENDPOINT, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ progress: job.progress, settings: job.settings })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
      job.waiters.forEach(({ resolve }) => resolve(payload));
    } catch (error) {
      job.waiters.forEach(({ reject }) => reject(error));
    } finally {
      this.inFlight = false;
      if (this.queuedSave) this.#drainSaves();
    }
  }
}
