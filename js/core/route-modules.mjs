export function createRouteModuleRegistry({ loaders, onStatus = () => {} } = {}) {
  const moduleLoaders = Object.freeze({ ...(loaders || {}) });
  const instances = new Map();
  const pending = new Map();

  function status(route) {
    if (instances.has(route)) return "ready";
    if (pending.has(route)) return "loading";
    return Object.hasOwn(moduleLoaders, route) ? "idle" : "missing";
  }

  function get(route) {
    return instances.get(route) || null;
  }

  async function ensure(route) {
    if (instances.has(route)) return instances.get(route);
    if (pending.has(route)) return pending.get(route);
    const loader = moduleLoaders[route];
    if (typeof loader !== "function") throw new Error(`No public route module loader for ${route}`);
    onStatus({ route, status: "loading" });
    const request = Promise.resolve()
      .then(loader)
      .then((instance) => {
        if (!instance || typeof instance !== "object") throw new Error(`Public route module ${route} did not return an instance`);
        instances.set(route, instance);
        pending.delete(route);
        onStatus({ route, status: "ready" });
        return instance;
      })
      .catch((error) => {
        pending.delete(route);
        onStatus({ route, status: "failed", error });
        throw error;
      });
    pending.set(route, request);
    return request;
  }

  function snapshot() {
    return Object.fromEntries(Object.keys(moduleLoaders).map((route) => [route, status(route)]));
  }

  return Object.freeze({ ensure, get, status, snapshot });
}
