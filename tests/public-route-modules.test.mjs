import assert from "node:assert/strict";
import test from "node:test";

import { createRouteModuleRegistry } from "../js/core/route-modules.mjs";

function deferred() {
  let resolve;
  const promise = new Promise((onResolve) => {
    resolve = onResolve;
  });
  return { promise, resolve };
}

test("route module registry single-flights concurrent ensure calls and returns one instance", async () => {
  const moduleRequest = deferred();
  const instance = Object.freeze({ render() {} });
  let loadCount = 0;
  const statuses = [];
  const registry = createRouteModuleRegistry({
    loaders: {
      knowledge: () => {
        loadCount += 1;
        return moduleRequest.promise;
      }
    },
    onStatus: (event) => statuses.push(event)
  });

  const first = registry.ensure("knowledge");
  const second = registry.ensure("knowledge");

  assert.equal(registry.status("knowledge"), "loading");
  assert.equal(registry.get("knowledge"), null);
  assert.deepEqual(registry.snapshot(), { knowledge: "loading" });

  await Promise.resolve();
  assert.equal(loadCount, 1);
  moduleRequest.resolve(instance);

  const [firstResult, secondResult] = await Promise.all([first, second]);
  assert.equal(firstResult, instance);
  assert.equal(secondResult, instance);
  assert.equal(registry.get("knowledge"), instance);
  assert.equal(registry.status("knowledge"), "ready");
  assert.deepEqual(statuses.map(({ route, status }) => ({ route, status })), [
    { route: "knowledge", status: "loading" },
    { route: "knowledge", status: "ready" }
  ]);
});

test("route module registry permanently reuses a successful instance", async () => {
  const instance = { value: "videos" };
  let loadCount = 0;
  const registry = createRouteModuleRegistry({
    loaders: {
      videos: async () => {
        loadCount += 1;
        return instance;
      }
    }
  });

  assert.equal(await registry.ensure("videos"), instance);
  assert.equal(await registry.ensure("videos"), instance);
  assert.equal(await registry.ensure("videos"), instance);
  assert.equal(loadCount, 1);
  assert.deepEqual(registry.snapshot(), { videos: "ready" });
});

test("route module registry clears a failed pending request and permits a clean retry", async () => {
  const firstError = new Error("temporary route chunk failure");
  const instance = { value: "games" };
  const statuses = [];
  let loadCount = 0;
  const registry = createRouteModuleRegistry({
    loaders: {
      games: async () => {
        loadCount += 1;
        if (loadCount === 1) throw firstError;
        return instance;
      }
    },
    onStatus: (event) => statuses.push(event)
  });

  await assert.rejects(registry.ensure("games"), (error) => error === firstError);
  assert.equal(registry.status("games"), "idle");
  assert.equal(registry.get("games"), null);
  assert.deepEqual(registry.snapshot(), { games: "idle" });

  assert.equal(await registry.ensure("games"), instance);
  assert.equal(loadCount, 2);
  assert.deepEqual(statuses.map(({ route, status, error }) => ({ route, status, error })), [
    { route: "games", status: "loading", error: undefined },
    { route: "games", status: "failed", error: firstError },
    { route: "games", status: "loading", error: undefined },
    { route: "games", status: "ready", error: undefined }
  ]);
});

test("route module registry reports missing routes without invoking status callbacks", async () => {
  const statuses = [];
  const registry = createRouteModuleRegistry({
    loaders: { chatroom: async () => ({}) },
    onStatus: (event) => statuses.push(event)
  });

  assert.equal(registry.status("unknown"), "missing");
  assert.equal(registry.get("unknown"), null);
  await assert.rejects(registry.ensure("unknown"), /No public route module loader for unknown/);
  assert.deepEqual(statuses, []);
  assert.deepEqual(registry.snapshot(), { chatroom: "idle" });
});
