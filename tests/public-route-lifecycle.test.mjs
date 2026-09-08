import assert from "node:assert/strict";
import test from "node:test";
import { createRouteLifecycle } from "../js/core/route-lifecycle.mjs";

function abortableFetch(t) {
  const signals = [];
  t.mock.method(globalThis, "fetch", (_input, { signal }) => new Promise((_resolve, reject) => {
    signals.push(signal);
    const rejectAborted = () => reject(new DOMException("Aborted", "AbortError"));
    if (signal.aborted) rejectAborted();
    else signal.addEventListener("abort", rejectAborted, { once: true });
  }));
  return signals;
}

for (const fallback of [false, true]) {
  test(`route fetch honors both query cancellation and route teardown${fallback ? " without AbortSignal.any" : ""}`, async (t) => {
    if (fallback) {
      const descriptor = Object.getOwnPropertyDescriptor(AbortSignal, "any");
      Object.defineProperty(AbortSignal, "any", { configurable: true, value: undefined });
      t.after(() => Object.defineProperty(AbortSignal, "any", descriptor));
    }
    const signals = abortableFetch(t);
    const lifecycle = createRouteLifecycle({ routes: ["knowledge", "home"] });
    const scope = lifecycle.enter("knowledge");
    const query = new AbortController();
    const first = lifecycle.routeFetch("knowledge", "/api/articles?search=old", { signal: query.signal });
    const firstRejected = assert.rejects(first, { name: "AbortError" });
    await Promise.resolve();
    query.abort();
    await firstRejected;
    assert.equal(signals[0].aborted, true);
    assert.equal(scope.signal.aborted, false, "canceling one search must not cancel the entire route");
    assert.equal(lifecycle.snapshot().routes.knowledge.requests, 0);

    const nextQuery = new AbortController();
    const second = lifecycle.routeFetch("knowledge", "/api/articles?search=new", { signal: nextQuery.signal });
    const secondRejected = assert.rejects(second, { name: "AbortError" });
    await Promise.resolve();
    lifecycle.transition("home");
    await secondRejected;
    assert.equal(signals[1].aborted, true);
    assert.equal(nextQuery.signal.aborted, false);
    assert.equal(lifecycle.snapshot().routes.knowledge.requests, 0);
  });
}

test("an already-cancelled caller does not start a live route request", async (t) => {
  const signals = abortableFetch(t);
  const lifecycle = createRouteLifecycle({ routes: ["knowledge"] });
  lifecycle.enter("knowledge");
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(lifecycle.routeFetch("knowledge", "/api/articles", { signal: controller.signal }), { name: "AbortError" });
  assert.equal(signals[0].aborted, true);
});
