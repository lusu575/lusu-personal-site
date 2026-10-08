// One shared admission ledger for every deployed entry point. No new service,
// unbounded admission cache, automatic account inference, or administrator bypass.
export const COST_GUARD_VERSION = "20261008-v1";
export const COST_LIMITS = Object.freeze({
  dynamic: Object.freeze({ daily: 500, monthly: 5000, r2a: 16 }),
  realtime: Object.freeze({ daily: 2880, monthly: 10000, r2a: 16 }),
  cleanup: Object.freeze({ daily: 24, monthly: 744, r2a: 16 }),
  // Cleanup needs list/delete, not a full upload envelope. Separate R2 caps
  // bound bursts even when UTC calendar months straddle an account bill cycle.
  "whiteboard-cleanup": Object.freeze({ daily: 2880, monthly: 30000, r2a: 4 }),
  "relay-cleanup": Object.freeze({ daily: 240, monthly: 5000, r2a: 0 }),
  envelope: Object.freeze({ d1: 256, r2a: 16, r2b: 32, deletes: 64, durable: 8, storage: 256, kv: 32 }),
  storageBytes: 8 * 1024 ** 3,
  maxUploadBytes: 95 * 1024 ** 2,
  leaseMs: 30 * 24 * 60 * 60 * 1000,
  operationMs: 60000
});

const scopes = new WeakMap();
const denied = new WeakMap();
const cleanupLanes = new Set(["cleanup", "whiteboard-cleanup", "relay-cleanup"]);

export class CostGuardError extends Error {
  constructor(code = "COST_GUARD_UNAVAILABLE") {
    super("动态功能暂时暂停，静态内容仍可浏览。 Dynamic features are paused. 動的機能は一時停止中です。");
    this.name = "CostGuardError";
    this.code = code;
    this.status = 503;
  }
}

export function costGuardResponse(error = new CostGuardError()) {
  return Response.json({ error: error.message, code: error.code, staticAvailable: true }, {
    status: 503,
    headers: { "Cache-Control": "no-store", "Retry-After": "3600", "X-Content-Type-Options": "nosniff" }
  });
}

export function costGuardStatus(env) {
  return {
    version: COST_GUARD_VERSION,
    mode: env?.COST_GUARD_MODE === "strict" ? "strict" : "paused",
    // This is configuration/liveness, deliberately not a database health claim.
    dynamicConfigured: configurationAllows(env, "dynamic"),
    cleanupConfigured: configurationAllows(env, "cleanup"),
    reviewExpiresAt: env?.COST_GUARD_UNTIL || null,
    staticAvailable: true
  };
}

function configurationAllows(env, lane, now = Date.now()) {
  const until = Date.parse(env?.COST_GUARD_UNTIL || "");
  if (!Number.isFinite(until) || until <= now || until - now > COST_LIMITS.leaseMs) return false;
  if (env?.COST_GUARD_REVIEW !== COST_GUARD_VERSION) return false;
  // Domain Free is NOT Workers Free. Paid/unknown accounts stay paused. R2 is
  // still pay-as-you-go: require the separately reviewed shared storage ledger.
  if (env?.COST_GUARD_WORKERS_PLAN !== "free") return false;
  if (cleanupLanes.has(lane)) return env?.COST_GUARD_CLEANUP === "enabled";
  return env?.COST_GUARD_MODE === "strict";
}

export function assertCostConfiguration(env, lane = "dynamic", feature = "api") {
  if (env?.COST_GUARD_UNTIL && Date.parse(env.COST_GUARD_UNTIL) <= Date.now()) {
    throw new CostGuardError("COST_GUARD_REVIEW_EXPIRED");
  }
  if (!configurationAllows(env, lane)) throw new CostGuardError("COST_GUARD_PAUSED");
  if (!cleanupLanes.has(lane)) {
    const features = String(env.COST_GUARD_FEATURES || "").split(",").map((value) => value.trim());
    if (!features.includes(feature)) throw new CostGuardError("COST_GUARD_FEATURE_PAUSED");
  }
}

export function hasCostScope(env) { return scopes.has(env); }

// A room prepays one finite operation envelope, reused for at most 1,024
// messages and 60 seconds. No per-frame D1 accounting or global API credits.
export async function admitRealtimeEvent(env, previous, feature) {
  assertCostConfiguration(env, "realtime", feature);
  const scope = previous && scopes.get(previous);
  if (scope?.lane === "realtime" && !scope.blocked && scope.expires > Date.now()
    && scope.eventsLeft > 0 && scope.remaining.storage >= 32 && scope.remaining.d1 >= 16) {
    scope.eventsLeft -= 1;
    return previous;
  }
  const guarded = await admitCost(env, { lane: "realtime", feature });
  scopes.get(guarded).eventsLeft = 1023;
  return guarded;
}

// One control-plane alarm write after a denied alarm, never a D1 error write.
// Only an unexpired, reviewed Free configuration may schedule this recovery.
// A DO has one pending alarm: daily retry on exhausted credit, hourly otherwise.
export async function rearmCleanupAlarm(env, storage, lane, error) {
  try { assertCostConfiguration(env, lane); } catch { return false; }
  const now = Date.now();
  const next = error?.code === "COST_GUARD_BUDGET_EXHAUSTED"
    ? Math.floor(now / 86400000) * 86400000 + 86400000 + 60000
    : now + 3600000;
  try { await storage.setAlarm(next); return true; } catch { return false; }
}

export async function admitCost(env, { lane = "dynamic", feature = "api", uploadBytes = 0 } = {}) {
  assertCostConfiguration(env, lane, feature);
  if (scopes.has(env)) {
    if (scopes.get(env).lane !== lane) throw new CostGuardError();
    consume(scopes.get(env), "d1", 0);
    return env;
  }
  const db = env?.DB;
  if (!db?.prepare) throw new CostGuardError();
  const now = Date.now();
  const month = new Date(now).toISOString().slice(0, 7);
  const day = new Date(now).toISOString().slice(0, 10);
  const key = `${lane}:${month}`;
  const cached = denied.get(db)?.get(key);
  if (cached && cached > now) throw new CostGuardError("COST_GUARD_BUDGET_EXHAUSTED");
  if (cached) denied.get(db).delete(key);
  try {
    // One persistent policy row per lane. Missing rows never grant access;
    // calendar rollover changes counters only under the same verified lease.
    const row = await db.prepare("select * from cost_guard_budgets where id = ?").bind(lane).first();
    const caps = COST_LIMITS[lane];
    if (!validBudget(row, now, caps)) throw new CostGuardError();
    const dailyUsed = row.day === day ? row.day_used : 0;
    const monthlyUsed = row.day.slice(0, 7) === month ? row.month_used : 0;
    if (dailyUsed >= row.day_limit || monthlyUsed >= row.month_limit) {
      throw new CostGuardError("COST_GUARD_BUDGET_EXHAUSTED");
    }
    // SELECT avoids writes for known denials. This conditional update arbitrates
    // the last credit across Pages, every Worker, and every isolate; no retry.
    const result = await db.prepare(`
      update cost_guard_budgets set
        day_used = case when day = ? then day_used + 1 else 1 end,
        month_used = case when substr(day, 1, 7) = ? then month_used + 1 else 1 end,
        day = ?
      where id = ? and revision = ? and enabled = 1 and valid_until > ?
        and (substr(day, 1, 7) < ? or month_used < month_limit)
        and (day <> ? or day_used < day_limit)
        and day_limit = ? and month_limit = ?
        and day <= ? and day_used >= 0 and day_used <= day_limit
        and month_used >= day_used and month_used <= month_limit
    `).bind(day, month, day, lane, row.revision, now, month, day, row.day_limit, row.month_limit, day).run();
    if (result?.meta?.changes !== 1) throw new CostGuardError("COST_GUARD_BUDGET_EXHAUSTED");
    const scope = {
      raw: env, db, lane, uploadBytes,
      expires: Math.min(now + COST_LIMITS.operationMs, row.valid_until, Date.parse(env.COST_GUARD_UNTIL)),
      remaining: { ...COST_LIMITS.envelope, r2a: caps.r2a }
    };
    return guardedEnv(env, scope);
  } catch (error) {
    let cache = denied.get(db);
    if (!cache) { cache = new Map(); denied.set(db, cache); }
    // Bounded negative cache only. A cold isolate can still read one row; it
    // cannot perform a business operation or write a refusal to the database.
    if (cache.size >= 4) cache.clear();
    cache.set(key, now + 60000);
    throw error instanceof CostGuardError ? error : new CostGuardError();
  }
}

function validBudget(row, now, caps) {
  return row && caps && row.enabled === 1 && row.revision === COST_GUARD_VERSION
    && Number.isSafeInteger(row.valid_until) && row.valid_until > now
    && row.valid_until - now <= COST_LIMITS.leaseMs
    && Number.isSafeInteger(row.day_limit) && row.day_limit > 0 && row.day_limit <= caps.daily
    && Number.isSafeInteger(row.month_limit) && row.month_limit > 0 && row.month_limit <= caps.monthly
    && Number.isSafeInteger(row.day_used) && row.day_used >= 0 && row.day_used <= row.day_limit
    && Number.isSafeInteger(row.month_used) && row.month_used >= 0 && row.month_used <= row.month_limit
    && row.month_used >= row.day_used
    && /^\d{4}-\d{2}-\d{2}$/.test(row.day)
    && Number.isFinite(Date.parse(`${row.day}T00:00:00Z`))
    && new Date(`${row.day}T00:00:00Z`).toISOString().slice(0, 10) === row.day
    && row.day <= new Date(now).toISOString().slice(0, 10);
}

function consume(scope, kind, count = 1) {
  if (scope.blocked || Date.now() >= scope.expires || !Number.isSafeInteger(count) || count < 0
      || scope.remaining[kind] < count) {
    scope.blocked = true;
    throw new CostGuardError("COST_GUARD_ENVELOPE_EXHAUSTED");
  }
  scope.remaining[kind] -= count;
}

function guardedEnv(env, scope) {
  const guarded = { ...env, DB: guardD1(scope) };
  for (const name of ["TRANSFER_BUCKET", "WHITEBOARD_BUCKET"]) {
    if (env[name]) guarded[name] = guardR2(env[name], scope);
  }
  for (const name of ["WHITEBOARD_ROOMS", "GAME_RELAY"]) {
    if (env[name]) guarded[name] = guardNamespace(env[name], scope);
  }
  if (env.OAUTH_KV) guarded.OAUTH_KV = guardKv(env.OAUTH_KV, scope);
  scopes.set(guarded, scope);
  return guarded;
}

function guardD1(scope) {
  const rawStatements = new WeakMap();
  const execute = async (action, count = 1) => {
    consume(scope, "d1", count);
    try { return await action(); } catch (error) {
      // Uniqueness conflicts are expected idempotency/CAS business outcomes.
      if (/unique constraint|constraint failed.*unique/i.test(String(error?.message))) throw error;
      scope.blocked = true;
      throw new CostGuardError("COST_GUARD_DATABASE_UNAVAILABLE");
    }
  };
  const statement = (raw) => {
    const wrapped = {
      bind: (...args) => statement(raw.bind(...args)),
      first: (...args) => execute(() => raw.first(...args)),
      all: (...args) => execute(() => raw.all(...args)),
      run: (...args) => execute(() => raw.run(...args)),
      raw: (...args) => execute(() => raw.raw(...args))
    };
    rawStatements.set(wrapped, raw);
    return wrapped;
  };
  return {
    prepare: (sql) => statement(scope.db.prepare(sql)),
    batch: (statements) => {
      const raw = statements.map((item) => rawStatements.get(item));
      if (raw.some((item) => !item)) throw new CostGuardError();
      return execute(() => scope.db.batch(raw), statements.length);
    },
    // Runtime exec/dump and new binding APIs must be reviewed before enabling.
    exec: () => { throw new CostGuardError("COST_GUARD_UNBOUNDED_QUERY"); }
  };
}

async function reserveBytes(scope, bytes) {
  try {
    consume(scope, "d1", 2);
    if (!Number.isSafeInteger(bytes) || bytes <= 0 || bytes > COST_LIMITS.maxUploadBytes) {
      throw new CostGuardError("COST_GUARD_UPLOAD_SIZE_UNKNOWN");
    }
    const row = await scope.db.prepare("select * from cost_guard_storage where id = 1").first();
    if (!row || row.revision !== COST_GUARD_VERSION || row.verified !== 1
      || !Number.isSafeInteger(row.reserved_bytes) || row.reserved_bytes < 0
      || !Number.isSafeInteger(row.limit_bytes) || row.limit_bytes <= 0
      || row.limit_bytes > COST_LIMITS.storageBytes || row.reserved_bytes + bytes > row.limit_bytes) {
      throw new CostGuardError("COST_GUARD_STORAGE_UNAVAILABLE");
    }
    const result = await scope.db.prepare(`
      update cost_guard_storage set reserved_bytes = reserved_bytes + ?
      where id = 1 and verified = 1 and revision = ? and limit_bytes = ?
        and reserved_bytes >= 0 and reserved_bytes + ? <= limit_bytes
    `).bind(bytes, row.revision, row.limit_bytes, bytes).run();
    if (result?.meta?.changes !== 1) throw new CostGuardError("COST_GUARD_STORAGE_EXHAUSTED");
    consume(scope, "d1", 0);
    // NEVER refund on logical expiry, abort, failed upload, or delete. A paused,
    // operator-reviewed physical inventory is needed to reclaim headroom. This
    // overcounts retries but includes orphans, incomplete parts and delete errors.
  } catch (error) {
    scope.blocked = true;
    throw error instanceof CostGuardError ? error : new CostGuardError("COST_GUARD_STORAGE_UNAVAILABLE");
  }
}

function byteLength(body, scope) {
  if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) return body.byteLength;
  if (typeof body === "string") return new TextEncoder().encode(body).byteLength;
  if (body instanceof Blob) return body.size;
  return scope.uploadBytes;
}

async function boundedBody(body, size) {
  if (!(body instanceof ReadableStream)) return body;
  // R2 requires a known stream length. The fixed-length transform prevents a
  // forged length from persisting more bytes than the reservation covers.
  if (typeof globalThis.FixedLengthStream === "undefined") throw new CostGuardError("COST_GUARD_UPLOAD_SIZE_UNKNOWN");
  const fixed = new globalThis.FixedLengthStream(size);
  body.pipeTo(fixed.writable).catch(() => {});
  return fixed.readable;
}

function guardR2(bucket, scope) {
  const multipart = (raw) => ({
    key: raw.key, uploadId: raw.uploadId,
    uploadPart: async (part, body, ...args) => {
      consume(scope, "r2a");
      const size = byteLength(body, scope);
      await reserveBytes(scope, size);
      return raw.uploadPart(part, await boundedBody(body, size), ...args);
    },
    complete: (...args) => { consume(scope, "r2a"); return raw.complete(...args); },
    abort: (...args) => { consume(scope, "deletes"); return raw.abort(...args); }
  });
  return {
    head: (...args) => { consume(scope, "r2b"); return bucket.head(...args); },
    get: (...args) => { consume(scope, "r2b"); return bucket.get(...args); },
    list: (options = {}) => {
      consume(scope, "r2a");
      return bucket.list({ ...options, limit: Math.min(100, Number(options.limit) || 100) });
    },
    delete: (keys) => {
      consume(scope, "deletes", Array.isArray(keys) ? keys.length : 1);
      return bucket.delete(keys);
    },
    put: async (key, body, ...args) => {
      consume(scope, "r2a");
      const size = byteLength(body, scope);
      await reserveBytes(scope, size);
      return bucket.put(key, await boundedBody(body, size), ...args);
    },
    createMultipartUpload: async (...args) => {
      consume(scope, "r2a");
      return multipart(await bucket.createMultipartUpload(...args));
    },
    resumeMultipartUpload: (...args) => multipart(bucket.resumeMultipartUpload(...args))
  };
}

function guardNamespace(namespace, scope) {
  const stub = (raw) => ({ fetch: (...args) => { consume(scope, "durable"); return raw.fetch(...args); } });
  return {
    idFromName: (...args) => namespace.idFromName(...args),
    idFromString: (...args) => namespace.idFromString(...args),
    get: (...args) => stub(namespace.get(...args)),
    getByName: (...args) => stub(namespace.getByName(...args))
  };
}

function guardKv(kv, scope) {
  return Object.fromEntries(["get", "getWithMetadata", "put", "delete", "list"].map((name) => [name, (...args) => {
    consume(scope, "kv");
    return kv[name](...args);
  }]));
}

// Constructing the adapter is inert. A DO must admit each serialized event
// before even loading persisted state. Transaction callbacks retain the native
// transaction/rollback semantics; no partial list truncation is allowed.
export function guardDurableStorage(storage, currentEnv) {
  const charge = () => {
    const scope = scopes.get(currentEnv());
    if (!scope) throw new CostGuardError();
    consume(scope, "storage");
  };
  return new Proxy(storage, {
    get(target, name) {
      if (name === "transaction") return (action) => {
        charge();
        return target.transaction((transaction) => action(guardDurableStorage(transaction, currentEnv)));
      };
      if (["get", "list", "put", "delete", "deleteAll", "getAlarm", "setAlarm", "deleteAlarm", "rollback"].includes(name)) {
        return (...args) => { charge(); return target[name](...args); };
      }
      // New APIs (including raw SQL) require an explicit budget review.
      throw new CostGuardError("COST_GUARD_UNREVIEWED_STORAGE_API");
    }
  });
}
