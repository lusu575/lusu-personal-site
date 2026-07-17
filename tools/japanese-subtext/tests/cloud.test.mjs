import test from "node:test";
import assert from "node:assert/strict";
import { CloudProgress } from "../lib/cloud.mjs";
import { defaultProgress, defaultSettings } from "../lib/storage.mjs";

function okResponse(payload = { ok: true }) {
  return { ok: true, status: 200, json: async () => payload };
}

test("cloud saves serialize and coalesce the newest state while a request is in flight", async () => {
  const requests = [];
  const cloud = new CloudProgress(async (_url, init) => new Promise((resolve) => {
    requests.push({ body: JSON.parse(init.body), resolve });
  }));
  cloud.signedIn = true;

  const first = cloud.save(defaultProgress(), { ...defaultSettings("zh"), playbackRate: 0.75 });
  await Promise.resolve();
  const second = cloud.save(defaultProgress(), { ...defaultSettings("zh"), playbackRate: 1 });
  const newest = cloud.save(defaultProgress(), { ...defaultSettings("zh"), playbackRate: 1.15, muted: true });

  assert.equal(requests.length, 1);
  requests[0].resolve(okResponse());
  await first;
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(requests.length, 2);
  assert.equal(requests[1].body.settings.playbackRate, 1.15);
  assert.equal(requests[1].body.settings.muted, false);
  requests[1].resolve(okResponse());
  await Promise.all([second, newest]);
  assert.equal(cloud.inFlight, false);
});

test("scheduled saves snapshot mutable input before the debounce delay", async () => {
  let body = null;
  const cloud = new CloudProgress(async (_url, init) => {
    body = JSON.parse(init.body);
    return okResponse();
  });
  cloud.signedIn = true;
  const settings = { ...defaultSettings("zh"), muted: false };

  await new Promise((resolve, reject) => {
    cloud.schedule(defaultProgress(), settings, (error) => error ? reject(error) : resolve(), 0);
    settings.muted = true;
  });

  assert.equal(body.settings.muted, false);
});

test("a partial cloud response cannot replace local preferences with defaults", async () => {
  const cloud = new CloudProgress(async () => okResponse({ progress: defaultProgress() }));
  const localSettings = { ...defaultSettings("ja"), displayMode: "listening", playbackRate: 0.75 };
  const merged = await cloud.loadAndMerge(defaultProgress(), localSettings);
  assert.equal(merged.signedIn, true);
  assert.equal(merged.settings.uiLanguage, "ja");
  assert.equal(merged.settings.displayMode, "listening");
  assert.equal(merged.settings.playbackRate, 0.75);
});

test("a newer cloud reset generation replaces stale local progress instead of merging it back", async () => {
  const staleLocal = {
    ...defaultProgress(),
    resetGeneration: 2,
    revision: 9,
    unlockedStageIds: ["L1-001", "L1-002"],
    stageProgress: {
      "L1-001": {
        cleared: true,
        bestScore: 100,
        medal: "gold",
        attempts: 1,
        firstAccuracy: 100,
        firstClearMode: "listening",
        usedTranslation: false,
        usedKana: false,
        usedListeningMode: true,
        replayCount: 0,
        hintCount: 0,
        updatedAt: "2026-07-10T17:00:00.000Z"
      }
    }
  };
  const resetCloud = { ...defaultProgress(), resetGeneration: 3 };
  const cloud = new CloudProgress(async () => okResponse({
    progress: resetCloud,
    settings: defaultSettings("zh")
  }));

  const merged = await cloud.loadAndMerge(staleLocal, defaultSettings("zh"));

  assert.equal(merged.progress.resetGeneration, 3);
  assert.deepEqual(merged.progress.stageProgress, {});
  assert.deepEqual(merged.progress.unlockedStageIds, ["L1-001"]);
});

test("a stale save conflict reloads the new generation before a safe retry", async () => {
  const stale = { ...defaultProgress(), resetGeneration: 4 };
  const reset = { ...defaultProgress(), resetGeneration: 5 };
  const requests = [];
  const cloud = new CloudProgress(async (_url, init = {}) => {
    const method = init.method || "GET";
    requests.push({ method, body: init.body ? JSON.parse(init.body) : null });
    if (method === "PUT" && requests.filter((item) => item.method === "PUT").length === 1) {
      return {
        ok: false,
        status: 409,
        json: async () => ({
          error: "reset conflict",
          code: "JAPANESE_SUBTEXT_RESET_CONFLICT",
          resetGeneration: 5
        })
      };
    }
    if (method === "GET") {
      return okResponse({ progress: reset, settings: defaultSettings("zh") });
    }
    return okResponse();
  });
  cloud.signedIn = true;

  await assert.rejects(
    cloud.save(stale, defaultSettings("zh")),
    (error) => error.code === "JAPANESE_SUBTEXT_RESET_CONFLICT"
  );
  const merged = await cloud.loadAndMerge(stale, defaultSettings("zh"));
  await cloud.save(merged.progress, merged.settings);

  const retried = requests.filter((item) => item.method === "PUT").at(-1).body.progress;
  assert.equal(retried.resetGeneration, 5);
  assert.deepEqual(retried.stageProgress, {});
});

test("cloud reset waits for an active save, drops queued snapshots, then deletes progress", async () => {
  const requests = [];
  const cloud = new CloudProgress(async (_url, init = {}) => new Promise((resolve) => {
    requests.push({ method: init.method || "GET", resolve });
  }));
  cloud.signedIn = true;

  const active = cloud.save(defaultProgress(), defaultSettings("zh"));
  await Promise.resolve();
  const queued = cloud.save(defaultProgress(), { ...defaultSettings("zh"), playbackRate: 1.15 });
  const reset = cloud.reset();

  assert.equal(requests.length, 1);
  assert.equal(requests[0].method, "PUT");
  requests[0].resolve(okResponse());
  await active;
  await queued;
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(requests.length, 2);
  assert.equal(requests[1].method, "DELETE");
  requests[1].resolve(okResponse({ ok: true }));
  assert.equal(await reset, true);
  assert.equal(cloud.inFlight, false);
  assert.equal(cloud.queuedSave, null);
});
