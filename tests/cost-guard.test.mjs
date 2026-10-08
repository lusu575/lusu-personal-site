import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { admitCost, CostGuardError, COST_LIMITS, guardDurableStorage } from "../functions/api/cost-guard.mjs";
import { consumeBoundedRateLimits } from "../functions/api/bounded-rate-limit.mjs";
import { onRequest } from "../functions/api/[[route]].js";
import { onRequest as adminRequest } from "../functions/admin/_middleware.js";
import { onRequest as articleRequest } from "../functions/articles/[slug].js";
import cleanupWorker from "../workers/transfer-cleanup/index.mjs";
import { costGuardTestConfig, seedCostGuardTestBudget } from "./helpers/cost-guard-fixture.mjs";

class Database {
  sqlite = new DatabaseSync(":memory:");
  changes = 0;
  calls = [];
  broken = false;
  prepare(sql) {
    const db = this;
    const make = (args = []) => ({
      bind: (...values) => make(values),
      async first() { db.calls.push(sql); if (db.broken) throw new Error("D1 unavailable"); return db.sqlite.prepare(sql).get(...args) || null; },
      async all() { db.calls.push(sql); if (db.broken) throw new Error("D1 unavailable"); return { results: db.sqlite.prepare(sql).all(...args) }; },
      async run() { db.calls.push(sql); if (db.broken) throw new Error("D1 unavailable"); const result = db.sqlite.prepare(sql).run(...args); db.changes += Number(result.changes); return { meta: { changes: Number(result.changes) } }; }
    });
    return make();
  }
  async batch(statements) {
    this.sqlite.exec("begin");
    try { const results = []; for (const statement of statements) results.push(await statement.run()); this.sqlite.exec("commit"); return results; }
    catch (error) { this.sqlite.exec("rollback"); throw error; }
  }
}

async function fixture() {
  const DB = new Database();
  DB.sqlite.exec(readFileSync(new URL("../cloudflare/schema-cost-guard.sql", import.meta.url), "utf8"));
  await seedCostGuardTestBudget(DB);
  const calls = [];
  const bucket = Object.fromEntries(["head", "get", "put", "delete", "list"].map((method) => [method, async (...args) => { calls.push([method, ...args]); return { body: "data", objects: [] }; }]));
  bucket.createMultipartUpload = async () => ({ key: "part", uploadId: "id", async uploadPart(...args) { calls.push(["part", ...args]); }, async complete() { calls.push(["complete"]); }, async abort() { calls.push(["abort"]); } });
  return { ...costGuardTestConfig(), DB, TRANSFER_BUCKET: bucket, WHITEBOARD_BUCKET: bucket, calls };
}
const denied = (promise) => assert.rejects(promise, CostGuardError);

test("paused, unverified, paid or expired configuration touches no binding; admin is not exempt", async () => {
  for (const override of [{ COST_GUARD_MODE: "paused" }, { COST_GUARD_WORKERS_PLAN: "paid" }, { COST_GUARD_WORKERS_PLAN: "unverified" }, { COST_GUARD_UNTIL: "2000-01-01" }, { COST_GUARD_REVIEW: "unknown" }]) {
    const env = { ...costGuardTestConfig(), ...override, DB: { prepare() { assert.fail("must not read D1"); } } };
    await denied(admitCost(env, { feature: "admin" }));
    const response = await adminRequest({ env, request: new Request("https://lusu575.com/admin") });
    assert.equal(response.status, 503);
  }
});

test("exhausted or corrupt budget denies downloads without any new database writes or R2 operations", async () => {
  for (const sql of ["update cost_guard_budgets set day_used=day_limit", "update cost_guard_budgets set enabled=0", "delete from cost_guard_budgets"]) {
    const env = await fixture(); env.DB.sqlite.exec(sql); const changes = env.DB.changes;
    for (let i = 0; i < 10; i++) await denied(admitCost(env, { feature: "transfer" }));
    assert.equal(env.DB.changes, changes); assert.equal(env.calls.length, 0);
  }
});

test("concurrent last global share permits exactly one request across features", async () => {
  const env = await fixture(); env.DB.sqlite.exec("update cost_guard_budgets set day_limit=1 where id = 'dynamic'");
  const results = await Promise.allSettled(Array.from({ length: 30 }, (_, i) => admitCost(env, { feature: i % 2 ? "whiteboard" : "admin" })));
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(env.DB.sqlite.prepare("select month_used from cost_guard_budgets where id = 'dynamic'").get().month_used, 1);
});

test("D1 unavailable before or during work fails closed, including later R2 and error writes", async () => {
  const env = await fixture(); env.DB.broken = true; await denied(admitCost(env)); assert.equal(env.calls.length, 0);
  const another = await fixture(); const guarded = await admitCost(another); another.DB.broken = true;
  await denied(guarded.DB.prepare("select 1").first());
  await denied(Promise.resolve().then(() => guarded.TRANSFER_BUCKET.get("file")));
  await denied(guarded.DB.prepare("update cost_guard_budgets set enabled=0").run());
  assert.equal(another.calls.length, 0);
});

test("whiteboard and admin multipart share physical headroom, with no refunds for expiry, abort or failed deletion", async () => {
  const env = await fixture(); env.DB.sqlite.exec("update cost_guard_storage set limit_bytes=10");
  const board = await admitCost(env, { feature: "whiteboard" });
  await board.WHITEBOARD_BUCKET.put("board", new Uint8Array(6));
  const admin = await admitCost(env, { feature: "admin" });
  const multipart = await admin.TRANSFER_BUCKET.createMultipartUpload("part");
  await multipart.uploadPart(1, new Uint8Array(4)); await multipart.abort();
  await board.WHITEBOARD_BUCKET.delete("board");
  const next = await admitCost(env, { feature: "admin" });
  await denied(next.TRANSFER_BUCKET.put("admin", new Uint8Array(1)));
  assert.equal(env.DB.sqlite.prepare("select reserved_bytes from cost_guard_storage").get().reserved_bytes, 10);
  assert.equal(env.calls.filter(([method]) => method === "put").length, 1);
});

test("concurrent storage last bytes are atomic and unknown sizes cannot upload", async () => {
  const env = await fixture(); env.DB.sqlite.exec("update cost_guard_storage set limit_bytes=4");
  const [one, two] = await Promise.all([admitCost(env), admitCost(env)]);
  const results = await Promise.allSettled([one.TRANSFER_BUCKET.put("one", new Uint8Array(4)), two.WHITEBOARD_BUCKET.put("two", new Uint8Array(4))]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  const unknown = await admitCost(await fixture());
  await denied(unknown.TRANSFER_BUCKET.put("unknown", new ReadableStream()));
});

test("downloads and durable storage exhaust a finite operation envelope and then perform no error writes", async () => {
  const env = await fixture(); const scoped = await admitCost(env, { feature: "whiteboard" });
  for (let i = 0; i < COST_LIMITS.envelope.r2b; i++) await scoped.WHITEBOARD_BUCKET.get("image");
  await denied(Promise.resolve().then(() => scoped.WHITEBOARD_BUCKET.head("image")));
  const changes = env.DB.changes;
  await denied(scoped.DB.prepare("update cost_guard_budgets set enabled=0").run()); assert.equal(env.DB.changes, changes);
  let nativeCalls = 0;
  const storage = guardDurableStorage({ async get() { nativeCalls++; } }, () => env);
  await denied(Promise.resolve().then(() => storage.get("meta"))); assert.equal(nativeCalls, 0);
});

test("UTC daily reset retains monthly usage; missing policies never auto-grant; cleanup is independent", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-06-15T12:00:00Z") });
  const env = await fixture(); env.DB.sqlite.exec("update cost_guard_budgets set day='2026-06-14',day_used=10,month_used=12");
  await admitCost(env);
  assert.deepEqual({ ...env.DB.sqlite.prepare("select day_used,month_used from cost_guard_budgets where id = 'dynamic'").get() }, { day_used: 1, month_used: 13 });
  env.DB.sqlite.exec("delete from cost_guard_budgets where id = 'dynamic'"); await denied(admitCost(env));
  await admitCost({ ...env, COST_GUARD_MODE: "paused" }, { lane: "cleanup" });
});

test("reviewed monthly rollover admits one final share without renewing the lease or resetting storage", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-06-30T12:00:00Z") });
  const env = await fixture();
  env.DB.sqlite.exec("update cost_guard_budgets set day_used=1,month_used=1,day_limit=1,month_limit=1 where id='dynamic'; update cost_guard_storage set reserved_bytes=123");
  const deadline = env.DB.sqlite.prepare("select valid_until from cost_guard_budgets where id='dynamic'").get().valid_until;
  t.mock.timers.tick(86400000);
  const results = await Promise.allSettled(Array.from({ length: 30 }, () => admitCost(env)));
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  const row = env.DB.sqlite.prepare("select * from cost_guard_budgets where id='dynamic'").get();
  assert.equal(row.day, "2026-07-01"); assert.equal(row.day_used, 1); assert.equal(row.month_used, 1);
  assert.equal(row.valid_until, deadline);
  assert.equal(env.DB.sqlite.prepare("select reserved_bytes from cost_guard_storage").get().reserved_bytes, 123);
  env.DB.sqlite.exec("delete from cost_guard_budgets where id='dynamic'");
  t.mock.timers.tick(61000);
  await denied(admitCost(env));
  assert.equal(env.DB.sqlite.prepare("select count(*) as n from cost_guard_budgets where id='dynamic'").get().n, 0);
});

test("longer reviewed operation remains usable across days, but expiry and anomalous dates never self-renew", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-06-15T12:00:00Z") });
  const env = await fixture(); await admitCost(env);
  t.mock.timers.tick(2 * 86400000); await admitCost(env);
  const changes = env.DB.changes;
  t.mock.timers.tick(28 * 86400000); await denied(admitCost(env));
  assert.equal(env.DB.changes, changes);
  const fresh = await fixture();
  fresh.DB.sqlite.exec("update cost_guard_budgets set day='2026-02-30'");
  const before = fresh.DB.changes; await denied(admitCost(fresh)); assert.equal(fresh.DB.changes, before);
  const invalidLease = { ...fresh, COST_GUARD_UNTIL: new Date(Date.now() + 31 * 86400000).toISOString() };
  await denied(admitCost(invalidLease));
});

test("hourly transfer cron admissions cannot consume multi-room whiteboard or game cleanup budgets", async () => {
  const env = await fixture();
  for (let hour = 0; hour < 24; hour++) {
    await admitCost(env, { lane: "cleanup" });
    for (let room = 0; room < 4; room++) {
      for (let alarm = 0; alarm < 12; alarm++) await admitCost(env, { lane: "whiteboard-cleanup" });
    }
  }
  await denied(admitCost(env, { lane: "cleanup" }));
  await admitCost(env, { lane: "whiteboard-cleanup" });
  await admitCost(env, { lane: "relay-cleanup" });
  await admitCost(env);
  const rows = env.DB.sqlite.prepare("select id,day_used from cost_guard_budgets").all();
  assert.equal(rows.find((row) => row.id === "cleanup").day_used, 24);
  assert.equal(rows.find((row) => row.id === "whiteboard-cleanup").day_used, 1153);
  assert.equal(rows.find((row) => row.id === "dynamic").day_used, 1);
});

test("cleanup R2 allowances fail closed before excess list or unexpected relay operations", async () => {
  const env = await fixture();
  const board = await admitCost(env, { lane: "whiteboard-cleanup" });
  for (let index = 0; index < 4; index++) await board.WHITEBOARD_BUCKET.list();
  const changes = env.DB.changes;
  await denied(Promise.resolve().then(() => board.WHITEBOARD_BUCKET.list()));
  await denied(board.DB.prepare("update cost_guard_budgets set enabled=0").run());
  assert.equal(env.DB.changes, changes);
  assert.equal(env.calls.length, 4);
  const relay = await admitCost(env, { lane: "relay-cleanup" });
  await denied(Promise.resolve().then(() => relay.TRANSFER_BUCKET.createMultipartUpload("unexpected")));
  assert.equal(env.calls.length, 4);
});

test("calendar resets cannot multiply R2 allowances across a billing window, including February", () => {
  const lanes = ["dynamic", "realtime", "cleanup", "whiteboard-cleanup", "relay-cleanup"];
  let largestWindow = 0;
  let largestReadWindow = 0;
  // Include 33 UTC dates: a 31-day billing interval plus a prepaid envelope
  // admitted up to 60 seconds before its start. Leap and ordinary February can
  // also make this interval touch three different calendar months.
  for (let start = Date.UTC(2023, 0, 1); start < Date.UTC(2027, 0, 1); start += 86400000) {
    const months = new Map();
    for (let day = 0; day < 33; day++) {
      const month = new Date(start + day * 86400000).toISOString().slice(0, 7);
      months.set(month, (months.get(month) || 0) + 1);
    }
    const upperBound = lanes.reduce((sum, lane) => {
      const { daily, monthly, r2a } = COST_LIMITS[lane];
      return sum + [...months.values()].reduce((used, days) => used + Math.min(monthly, days * daily) * r2a, 0);
    }, 0);
    largestWindow = Math.max(largestWindow, upperBound);
    const readUpperBound = lanes.reduce((sum, lane) => {
      const { daily, monthly } = COST_LIMITS[lane];
      return sum + [...months.values()].reduce((used, days) => used + Math.min(monthly, days * daily) * COST_LIMITS.envelope.r2b, 0);
    }, 0);
    largestReadWindow = Math.max(largestReadWindow, readUpperBound);
  }
  // Reserve at least 200k A operations for non-app use and accounting margin.
  // Live account headroom still requires review before enabling any policy.
  assert.ok(largestWindow <= 800000, `cross-calendar-month allowance grew to ${largestWindow}`);
  assert.ok(largestReadWindow <= 8000000, `cross-calendar-month read allowance grew to ${largestReadWindow}`);
});

test("rate limit denial does not write any bucket and concurrent final slot is atomic", async () => {
  const DB = new Database(); DB.sqlite.exec("create table api_rate_limits (bucket_key text primary key,window_started_at integer,request_count integer,blocked_until integer,updated_at text)");
  const entries = [["ip", { limit: 1, windowMs: 60000 }], ["account", { limit: 2, windowMs: 60000 }]];
  const result = await Promise.all(Array.from({ length: 20 }, () => consumeBoundedRateLimits({ DB }, entries)));
  assert.equal(result.filter((entry) => entry.allowed).length, 1);
  const changes = DB.changes;
  for (let i = 0; i < 20; i++) assert.equal((await consumeBoundedRateLimits({ DB }, entries)).allowed, false);
  assert.equal(DB.changes, changes);
  assert.equal(DB.sqlite.prepare("select request_count from api_rate_limits where bucket_key='account'").get().request_count, 1);
});

test("paused front doors retain static health and the article shell without authentication, save or binding changes", async () => {
  const env = { DB: { prepare() { assert.fail("paused route accessed database"); } } };
  for (const path of ["/api/anonymous/identity", "/api/saves/game", "/api/transfer/file/id", "/api/admin/transfer", "/api/whiteboard/rooms/public/assets/image"]) {
    const response = await onRequest({ env, request: new Request(`https://lusu575.com${path}`) });
    assert.equal(response.status, 503); assert.match((await response.json()).code, /^COST_GUARD_/);
  }
  for (const endpoint of ["identify", "page-view", "click"]) {
    const response = await onRequest({ env, request: new Request(`https://lusu575.com/api/analytics/${endpoint}`, { method: "POST" }) });
    assert.deepEqual(await response.json(), { ok: true, recorded: false });
  }
  const health = await onRequest({ env, request: new Request("https://lusu575.com/api/health") });
  assert.equal(health.status, 200); assert.equal((await health.json()).db, null);
  const article = await articleRequest({ env, params: { slug: "example" }, request: new Request("https://lusu575.com/articles/example"), next: () => new Response("static shell") });
  assert.equal(article.status, 503); assert.equal(await article.text(), "static shell");
});

test("strict production API preserves authentication and admits against a migrated database", async () => {
  const env = await fixture();
  env.DB.sqlite.exec(readFileSync(new URL("../cloudflare/schema.sql", import.meta.url), "utf8"));
  env.CHAT_IP_HASH_SALT = "test-chat-ip-hash-secret-0000000000000001";
  env.ANALYTICS_IP_HASH_SALT = "test-analytics-ip-hash-secret-00000001";
  const response = await onRequest({ env, request: new Request("https://lusu575.com/api/auth/me") });
  assert.equal(response.status, 200, await response.clone().text());
  const admin = await onRequest({ env, request: new Request("https://lusu575.com/api/admin/me") });
  assert.equal(admin.status, 401, await admin.clone().text());
  assert.equal(env.DB.sqlite.prepare("select month_used from cost_guard_budgets where id = 'dynamic'").get().month_used, 2);
});

test("paused cron does not open bindings or write a failed-run record", async () => {
  const env = { DB: { prepare() { assert.fail("cron accessed D1"); } } };
  const pending = [];
  await cleanupWorker.scheduled({}, env, { waitUntil(promise) { pending.push(promise); } });
  await Promise.all(pending);
});
