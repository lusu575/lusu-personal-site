function abortError() {
  return new DOMException("The operation was aborted.", "AbortError");
}

function waitForRetry(delayMs, signal) {
  if (signal?.aborted) return Promise.reject(abortError());
  if (!delayMs) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, delayMs);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(abortError());
    }, { once: true });
  });
}

function retryable(error) {
  return error instanceof TypeError
    || error?.status === 408
    || error?.status === 425
    || error?.status === 429
    || Number(error?.status) >= 500;
}

function responseError(response, payload) {
  const error = new Error(payload?.error || `HTTP ${response.status}`);
  error.status = response.status;
  return error;
}

export function createJsonResourceCache({
  maxEntries = 32,
  retryDelays = [0, 180, 640],
  now = () => Date.now()
} = {}) {
  const entries = new Map();
  const pending = new Map();

  function touch(key, entry) {
    entries.delete(key);
    entries.set(key, entry);
    while (entries.size > maxEntries) entries.delete(entries.keys().next().value);
    return entry;
  }

  async function revalidate(key, fetcher, options, previous) {
    let lastError = null;
    for (let attempt = 0; attempt < retryDelays.length; attempt += 1) {
      await waitForRetry(retryDelays[attempt], options.signal);
      try {
        const headers = new Headers(options.headers || {});
        headers.set("Accept", "application/json");
        if (previous?.etag) headers.set("If-None-Match", previous.etag);
        const response = await fetcher({
          cache: "no-cache",
          headers,
          signal: options.signal
        });
        if (response.status === 304 && previous) {
          const entry = touch(key, { ...previous, checkedAt: now() });
          return { data: entry.data, source: "not-modified", stale: false, etag: entry.etag };
        }
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw responseError(response, payload);
        const entry = touch(key, {
          data: payload,
          etag: response.headers.get("ETag") || "",
          checkedAt: now()
        });
        return { data: entry.data, source: "network", stale: false, etag: entry.etag };
      } catch (error) {
        if (options.signal?.aborted || error?.name === "AbortError") throw error;
        lastError = error;
        if (!retryable(error) || attempt === retryDelays.length - 1) break;
      }
    }
    if (previous) {
      return { data: previous.data, source: "last-known-good", stale: true, error: lastError, etag: previous.etag };
    }
    throw lastError || new TypeError("Resource request failed");
  }

  function beginRevalidation(key, fetcher, options, previous) {
    const signal = options.signal || null;
    const active = pending.get(key);
    if (active && active.signal === signal && !active.signal?.aborted) {
      return active.promise;
    }
    const record = { promise: null, signal };
    const request = revalidate(key, fetcher, options, previous)
      .finally(() => {
        if (pending.get(key) === record) pending.delete(key);
      });
    record.promise = request;
    pending.set(key, record);
    return request;
  }

  async function request(key, fetcher, options = {}) {
    const normalizedKey = String(key);
    const previous = entries.get(normalizedKey) || null;
    const maxAgeMs = Math.max(0, Number(options.maxAgeMs ?? 30000));
    const fresh = previous && now() - previous.checkedAt <= maxAgeMs;
    if (previous && fresh && !options.force) {
      touch(normalizedKey, previous);
      return { data: previous.data, source: "memory", stale: false, etag: previous.etag };
    }
    if (previous && options.staleWhileRevalidate !== false && !options.force) {
      touch(normalizedKey, previous);
      const revalidation = beginRevalidation(normalizedKey, fetcher, options, previous);
      revalidation.then((result) => options.onRevalidated?.(result)).catch(() => {});
      return {
        data: previous.data,
        source: "stale-while-revalidate",
        stale: true,
        revalidating: true,
        revalidation,
        etag: previous.etag
      };
    }
    return beginRevalidation(normalizedKey, fetcher, options, previous);
  }

  function peek(key) {
    return entries.get(String(key))?.data ?? null;
  }

  function snapshot() {
    return {
      entries: entries.size,
      pending: pending.size,
      keys: [...entries.keys()]
    };
  }

  return Object.freeze({ request, peek, snapshot });
}
