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
