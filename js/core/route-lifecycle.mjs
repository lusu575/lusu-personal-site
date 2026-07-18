export function isAbortError(error) {
  return error?.name === "AbortError" || error?.code === 20;
}

export function createRouteLifecycle({ routes, onEnter, onLeave, onError } = {}) {
  const routeIds = Object.freeze([...(routes || [])]);
  const routeHooks = new Map();
  const records = new Map(routeIds.map((route) => [route, {
    route,
    active: false,
    generation: 0,
    enterCount: 0,
    leaveCount: 0,
    listenerCount: 0,
    observerCount: 0,
    requestCount: 0,
    timers: new Set(),
    frames: new Set(),
    scope: null
  }]));
  let activeRoute = "";

  function register(route, hooks = {}) {
    if (!routeIds.includes(route)) throw new Error(`Unknown public route lifecycle: ${route}`);
    routeHooks.set(route, hooks);
  }

  function recordFor(route) {
    return records.get(route) || null;
  }

  function activeScope(route = activeRoute) {
    const record = recordFor(route);
    return record?.active ? record.scope : null;
  }

  function createScope(record) {
    const controller = new AbortController();
    const cleanups = [];
    const observers = new Set();
    const generation = record.generation;
    const scope = {
      route: record.route,
      generation,
      signal: controller.signal,
      isActive() {
        return record.active && record.generation === generation && !controller.signal.aborted;
      },
      listen(target, type, handler, options = false) {
        if (!target?.addEventListener || !scope.isActive()) return () => {};
        target.addEventListener(type, handler, options);
        record.listenerCount += 1;
        let listening = true;
        const remove = () => {
          if (!listening) return;
          listening = false;
          target.removeEventListener(type, handler, options);
          record.listenerCount = Math.max(0, record.listenerCount - 1);
        };
        cleanups.push(remove);
        return remove;
      },
      observe(observer, target, options) {
        if (!observer?.observe || !target || !scope.isActive()) return observer;
        observer.observe(target, options);
        observers.add(observer);
        record.observerCount = observers.size;
        return observer;
      },
      setTimeout(callback, delay = 0) {
        if (!scope.isActive()) return 0;
        const timer = window.setTimeout(() => {
          record.timers.delete(timer);
          if (scope.isActive()) callback();
        }, delay);
        record.timers.add(timer);
        return timer;
      },
      clearTimeout(timer) {
        if (!timer) return;
        window.clearTimeout(timer);
        record.timers.delete(timer);
      },
      requestFrame(callback) {
        if (!scope.isActive()) return 0;
        const frame = window.requestAnimationFrame((time) => {
          record.frames.delete(frame);
          if (scope.isActive()) callback(time);
        });
        record.frames.add(frame);
        return frame;
      },
      cancelFrame(frame) {
        if (!frame) return;
        window.cancelAnimationFrame(frame);
        record.frames.delete(frame);
      },
      addCleanup(cleanup) {
        if (typeof cleanup === "function") cleanups.push(cleanup);
        return cleanup;
      },
      trackRequest(promise) {
        if (!scope.isActive()) return promise;
        record.requestCount += 1;
        return Promise.resolve(promise).finally(() => {
          record.requestCount = Math.max(0, record.requestCount - 1);
        });
      },
      teardown() {
        if (!controller.signal.aborted) controller.abort();
        record.timers.forEach((timer) => window.clearTimeout(timer));
        record.timers.clear();
        record.frames.forEach((frame) => window.cancelAnimationFrame(frame));
        record.frames.clear();
        observers.forEach((observer) => observer.disconnect());
        observers.clear();
        record.observerCount = 0;
        cleanups.splice(0).reverse().forEach((cleanup) => {
          try {
            cleanup();
          } catch {
            // Teardown is best-effort; the tracked resources are still cleared.
          }
        });
        record.listenerCount = 0;
      }
    };
    return scope;
  }

  function leave(route, reason = "navigation") {
    const record = recordFor(route);
    if (!record?.active || !record.scope) return;
    const scope = record.scope;
    record.active = false;
    record.leaveCount += 1;
    scope.teardown();
    record.scope = null;
    routeHooks.get(route)?.leave?.({ route, reason, generation: record.generation });
    onLeave?.({ route, reason, generation: record.generation });
    if (activeRoute === route) activeRoute = "";
  }

  function enter(route, reason = "navigation") {
    const record = recordFor(route);
    if (!record || record.active) return record?.scope || null;
    record.generation += 1;
    record.active = true;
    record.enterCount += 1;
    record.scope = createScope(record);
    activeRoute = route;
    onEnter?.({ route, reason, generation: record.generation });
    try {
      const pending = routeHooks.get(route)?.enter?.(record.scope, { route, reason });
      if (pending?.catch) {
        pending.catch((error) => {
          if (!isAbortError(error) && record.scope?.isActive()) onError?.({ route, reason, error });
        });
      }
    } catch (error) {
      if (!isAbortError(error)) onError?.({ route, reason, error });
    }
    return record.scope;
  }

  function transition(nextRoute, reason = "navigation", options = {}) {
    const route = routeIds.includes(nextRoute) ? nextRoute : routeIds[0];
    if (activeRoute === route && !options.restart) return activeScope(route);
    if (activeRoute) leave(activeRoute, reason);
    return enter(route, reason);
  }

  function restart(reason = "refresh") {
    const route = activeRoute;
    if (!route) return null;
    return transition(route, reason, { restart: true });
  }

  function routeFetch(route, input, init = {}) {
    const scope = activeScope(route);
    const request = fetch(input, { ...init, signal: scope?.signal || init.signal });
    return scope ? scope.trackRequest(request) : request;
  }

  function snapshot() {
    return {
      activeRoute,
      routes: Object.fromEntries([...records].map(([route, record]) => [route, {
        active: record.active,
        generation: record.generation,
        enterCount: record.enterCount,
        leaveCount: record.leaveCount,
        listeners: record.listenerCount,
        observers: record.observerCount,
        timers: record.timers.size,
        frames: record.frames.size,
        requests: record.requestCount,
        abortControllers: record.active && record.scope && !record.scope.signal.aborted ? 1 : 0
      }]))
    };
  }

  return Object.freeze({
    register,
    activeScope,
    leave,
    enter,
    transition,
    restart,
    routeFetch,
    snapshot
  });
}
