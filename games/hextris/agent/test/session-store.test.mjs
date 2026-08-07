// SPDX-License-Identifier: GPL-3.0-or-later

import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import {
  HEXTRIS_SESSION_ID_PATTERN,
  HextrisSessionStoreError,
  createHextrisSessionStore,
  resolveHextrisAgentDirectory
} from "../session-store.mjs";
import {
  HextrisCliError,
  runHextrisAgentCli,
  safeHextrisCliError
} from "../cli.mjs";

async function testStore(t, options = {}) {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "lusu-hextris-agent-"));
  t.after(async () => fs.rm(rootDir, { recursive: true, force: true }));
  return {
    rootDir,
    store: createHextrisSessionStore({
      rootDir,
      lockWaitMs: 100,
      lockPollMs: 5,
      lockStaleMs: 1_000,
      ...options
    })
  };
}

function sessionFile(rootDir, sessionId) {
  return path.join(rootDir, `${sessionId}.json`);
}

function sessionLock(rootDir, sessionId) {
  return path.join(rootDir, `${sessionId}.lock`);
}

async function lockMarkerPath(lockPath) {
  const entries = await fs.readdir(lockPath);
  assert.equal(entries.length, 1);
  assert.match(entries[0], /^owner-[a-f0-9]{32}\.json$/);
  return path.join(lockPath, entries[0]);
}

async function readDirectoryLockRecord(lockPath) {
  return JSON.parse(await fs.readFile(await lockMarkerPath(lockPath), "utf8"));
}

async function retiringMarkerPath(lockPath) {
  const entries = await fs.readdir(lockPath);
  assert.equal(entries.length, 1);
  assert.match(entries[0], /^retiring-[a-f0-9]{32}\.json$/);
  return path.join(lockPath, entries[0]);
}

async function writeDirectoryLock(lockPath, record) {
  await fs.mkdir(lockPath);
  await fs.writeFile(
    path.join(lockPath, `owner-${record.ownerToken}.json`),
    `${JSON.stringify(record)}\n`,
    { mode: 0o600, flag: "wx" }
  );
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function placeRequest(revision, clientActionId, lane = 0) {
  return {
    expectedRevision: revision,
    clientActionId,
    action: { type: "place", lane }
  };
}

test("creates secure opaque sessions and returns no local state path", async (t) => {
  const { rootDir, store } = await testStore(t);
  const created = await store.createSession({ seed: 7 });

  assert.match(created.sessionId, HEXTRIS_SESSION_ID_PATTERN);
  assert.equal(created.gameId, "hextris");
  assert.equal(created.observation.revision, 0);
  assert.ok(Array.isArray(created.actions));
  assert.doesNotMatch(JSON.stringify(created), new RegExp(escapeRegex(rootDir), "i"));

  const stat = await fs.stat(sessionFile(rootDir, created.sessionId));
  if (process.platform !== "win32") assert.equal(stat.mode & 0o777, 0o600);
});

test("enforces revision CAS, exact retry deduplication, and action-id collision rejection", async (t) => {
  const { store } = await testStore(t);
  const created = await store.createSession({ seed: 11 });
  const request = placeRequest(created.observation.revision, "place_action_0001", 2);

  const applied = await store.actSession(created.sessionId, request);
  assert.equal(applied.status, "applied");
  assert.equal(applied.beforeRevision, 0);
  assert.equal(applied.revision, 1);
  assert.equal(applied.deduplicated, false);

  const replay = await store.actSession(created.sessionId, request);
  assert.equal(replay.revision, applied.revision);
  assert.equal(replay.status, applied.status);
  assert.equal(replay.deduplicated, true);
  assert.deepEqual(replay.observation, applied.observation);

  await assert.rejects(
    store.actSession(created.sessionId, placeRequest(0, "place_action_0001", 3)),
    (error) => error instanceof HextrisSessionStoreError && error.code === "HEXTRIS_ACTION_ID_CONFLICT"
  );
  await assert.rejects(
    store.actSession(created.sessionId, placeRequest(0, "place_action_0002", 3)),
    (error) => error instanceof HextrisSessionStoreError
      && error.code === "HEXTRIS_REVISION_CONFLICT"
      && error.currentRevision === 1
  );
});

test("observe and actions are byte-for-byte read-only and do not leave locks", async (t) => {
  const { rootDir, store } = await testStore(t);
  const created = await store.createSession({ seed: 13 });
  const filePath = sessionFile(rootDir, created.sessionId);
  const beforeBytes = await fs.readFile(filePath);
  const beforeStat = await fs.stat(filePath);

  await new Promise((resolve) => setTimeout(resolve, 30));
  const observed = await store.observeSession(created.sessionId);
  const actions = await store.actionsForSession(created.sessionId);
  const afterBytes = await fs.readFile(filePath);
  const afterStat = await fs.stat(filePath);

  assert.equal(observed.revision, 0);
  assert.equal(actions.revision, 0);
  assert.deepEqual(afterBytes, beforeBytes);
  assert.equal(afterStat.mtimeMs, beforeStat.mtimeMs);
  assert.equal(await exists(sessionLock(rootDir, created.sessionId)), false);
  assert.equal(await exists(path.join(rootDir, ".sessions.lock")), false);
});

test("mutations refresh the idle TTL while expired reads do not clean or touch state", async (t) => {
  let now = 1_000_000;
  const { rootDir, store } = await testStore(t, { now: () => now, idleTtlMs: 1_000 });
  const created = await store.createSession({ seed: 17 });
  const filePath = sessionFile(rootDir, created.sessionId);

  now += 500;
  const applied = await store.actSession(
    created.sessionId,
    placeRequest(created.observation.revision, "ttl_action_0001", 1)
  );
  assert.equal(applied.expiresAt, new Date(now + 1_000).toISOString());

  now += 700;
  assert.equal((await store.observeSession(created.sessionId)).revision, 1);
  now += 400;
  const bytesBeforeExpiredRead = await fs.readFile(filePath);
  await assert.rejects(
    store.observeSession(created.sessionId),
    (error) => error instanceof HextrisSessionStoreError && error.code === "HEXTRIS_SESSION_EXPIRED"
  );
  assert.deepEqual(await fs.readFile(filePath), bytesBeforeExpiredRead);

  const replacement = await store.createSession({ seed: 19 });
  assert.notEqual(replacement.sessionId, created.sessionId);
  assert.equal(await exists(filePath), false, "a create mutation may clean an expired session");
});

test("close and reset require confirmation, and close is safely idempotent", async (t) => {
  const { rootDir, store } = await testStore(t);
  const created = await store.createSession({ seed: 23 });

  await assert.rejects(
    store.resetSession(created.sessionId, {
      expectedRevision: 0,
      clientActionId: "reset_action_0001",
      confirm: false
    }),
    (error) => error instanceof HextrisSessionStoreError && error.code === "HEXTRIS_CONFIRMATION_REQUIRED"
  );
  await assert.rejects(
    store.closeSession(created.sessionId, { confirm: false }),
    (error) => error instanceof HextrisSessionStoreError && error.code === "HEXTRIS_CONFIRMATION_REQUIRED"
  );
  await assert.rejects(
    store.resetSession(created.sessionId, {
      expectedRevision: 0,
      clientActionId: "reset_action_extra",
      confirm: true,
      extra: true
    }),
    (error) => error instanceof HextrisSessionStoreError && error.code === "HEXTRIS_RESET_OPTIONS_INVALID"
  );
  await assert.rejects(
    store.closeSession(created.sessionId, { confirm: true, extra: true }),
    (error) => error instanceof HextrisSessionStoreError && error.code === "HEXTRIS_CLOSE_OPTIONS_INVALID"
  );
  assert.equal(await exists(sessionFile(rootDir, created.sessionId)), true);

  const reset = await store.resetSession(created.sessionId, {
    expectedRevision: 0,
    clientActionId: "reset_action_0001",
    confirm: true
  });
  assert.equal(reset.status, "applied");
  assert.equal(reset.revision, 1);

  assert.equal((await store.closeSession(created.sessionId, { confirm: true })).closed, true);
  assert.equal(await exists(sessionFile(rootDir, created.sessionId)), false);
  assert.equal((await store.closeSession(created.sessionId, { confirm: true })).closed, false);
});

test("enforces the session limit without deleting live sessions", async (t) => {
  const { store } = await testStore(t, { maxSessions: 2 });
  const first = await store.createSession({ seed: 29 });
  await store.createSession({ seed: 31 });

  await assert.rejects(
    store.createSession({ seed: 37 }),
    (error) => error instanceof HextrisSessionStoreError && error.code === "HEXTRIS_SESSION_LIMIT"
  );
  assert.equal((await store.observeSession(first.sessionId)).revision, 0);
});

test("a live owner lock times out and a stale owner lock is recovered", async (t) => {
  const { rootDir, store } = await testStore(t, {
    lockWaitMs: 30,
    lockPollMs: 5,
    lockStaleMs: 10_000
  });
  const created = await store.createSession({ seed: 41 });
  const lockPath = sessionLock(rootDir, created.sessionId);
  const liveRecord = { ownerToken: "a".repeat(32), pid: 999_999, createdAtMs: Date.now() };
  await fs.writeFile(lockPath, `${JSON.stringify(liveRecord)}\n`, { mode: 0o600, flag: "wx" });

  await assert.rejects(
    store.actSession(created.sessionId, placeRequest(0, "locked_action_0001", 0)),
    (error) => error instanceof HextrisSessionStoreError && error.code === "HEXTRIS_LOCK_TIMEOUT"
  );
  assert.equal(JSON.parse(await fs.readFile(lockPath, "utf8")).ownerToken, liveRecord.ownerToken);
  await fs.unlink(lockPath);

  const staleStore = createHextrisSessionStore({
    rootDir,
    lockWaitMs: 100,
    lockPollMs: 5,
    lockStaleMs: 10
  });
  const staleRecord = { ownerToken: "b".repeat(32), pid: 999_998, createdAtMs: Date.now() - 60_000 };
  await fs.writeFile(lockPath, `${JSON.stringify(staleRecord)}\n`, { mode: 0o600, flag: "wx" });
  const old = new Date(Date.now() - 60_000);
  await fs.utimes(lockPath, old, old);

  const applied = await staleStore.actSession(
    created.sessionId,
    placeRequest(0, "stale_action_0001", 4)
  );
  assert.equal(applied.revision, 1);
  assert.equal(await exists(lockPath), false);
});

test("heartbeats keep an active global lock from being taken after the stale threshold", async (t) => {
  const { rootDir, store: owner } = await testStore(t, {
    lockWaitMs: 500,
    lockPollMs: 5,
    lockStaleMs: 80
  });
  await owner.createSession({ seed: 47 });
  const contender = createHextrisSessionStore({
    rootDir,
    lockWaitMs: 160,
    lockPollMs: 5,
    lockStaleMs: 80
  });
  const lockPath = path.join(rootDir, ".sessions.lock");
  const entered = deferred();
  const allowOwnerRelease = deferred();
  const holding = owner.withLock(lockPath, async () => {
    entered.resolve();
    await allowOwnerRelease.promise;
    return "owner-finished";
  });
  await entered.promise;
  await delay(100);

  try {
    await assert.rejects(
      contender.withLock(lockPath, async () => "must-not-run"),
      (error) => error instanceof HextrisSessionStoreError && error.code === "HEXTRIS_LOCK_TIMEOUT"
    );
  } finally {
    allowOwnerRelease.resolve();
  }
  assert.equal(await holding, "owner-finished");
  assert.equal(await exists(lockPath), false);
});

test("release refuses to remove a lock whose owner token was replaced", async (t) => {
  const { rootDir, store } = await testStore(t, {
    lockWaitMs: 100,
    lockPollMs: 5,
    lockStaleMs: 2_000
  });
  await store.createSession({ seed: 53 });
  const lockPath = path.join(rootDir, ".owner-check.lock");
  const replacement = {
    ownerToken: "c".repeat(32),
    pid: 123_456,
    processInstanceToken: "d".repeat(32),
    createdAtMs: Date.now()
  };

  await assert.rejects(
    store.withLock(lockPath, async () => {
      await fs.writeFile(await lockMarkerPath(lockPath), `${JSON.stringify(replacement)}\n`, { flag: "w" });
    }),
    (error) => error instanceof HextrisSessionStoreError && error.code === "HEXTRIS_LOCK_OWNERSHIP_LOST"
  );
  assert.equal(
    JSON.parse(await fs.readFile(await lockMarkerPath(lockPath), "utf8")).ownerToken,
    replacement.ownerToken
  );
});

test("direct store calls reject revision, action-id, session-id, clock, and option coercion", async (t) => {
  const { rootDir, store } = await testStore(t);
  const created = await store.createSession({ seed: 59 });
  const filePath = sessionFile(rootDir, created.sessionId);
  const before = await fs.readFile(filePath);

  await assert.rejects(
    store.actSession(created.sessionId, {
      expectedRevision: "0",
      clientActionId: "strict_action_0001",
      action: { type: "place", lane: 1 }
    }),
    (error) => error instanceof HextrisSessionStoreError && error.code === "HEXTRIS_REVISION_INVALID"
  );
  await assert.rejects(
    store.actSession(created.sessionId, {
      expectedRevision: 0,
      clientActionId: 12345678,
      action: { type: "place", lane: 1 }
    }),
    (error) => error instanceof HextrisSessionStoreError && error.code === "HEXTRIS_CLIENT_ACTION_ID_INVALID"
  );
  await assert.rejects(
    store.observeSession(new String(created.sessionId)),
    (error) => error instanceof HextrisSessionStoreError && error.code === "HEXTRIS_SESSION_ID_INVALID"
  );
  assert.deepEqual(await fs.readFile(filePath), before);

  assert.throws(
    () => createHextrisSessionStore({ rootDir, lockWaitMs: "100" }),
    (error) => error instanceof HextrisSessionStoreError && error.code === "HEXTRIS_STORE_OPTIONS_INVALID"
  );
  const stringClock = createHextrisSessionStore({ rootDir: path.join(rootDir, "clock"), now: () => "1000" });
  await assert.rejects(
    stringClock.createSession({ seed: 61 }),
    (error) => error instanceof HextrisSessionStoreError && error.code === "HEXTRIS_CLOCK_INVALID"
  );
});

test("persisted state and receipt fields reject values that only pass after string coercion", async (t) => {
  const { rootDir, store } = await testStore(t);
  const created = await store.createSession({ seed: 63 });
  await store.actSession(created.sessionId, placeRequest(0, "typed_receipt_0001", 1));
  const filePath = sessionFile(rootDir, created.sessionId);
  const original = JSON.parse(await fs.readFile(filePath, "utf8"));

  const stringRevision = structuredClone(original);
  stringRevision.state.revision = String(stringRevision.state.revision);
  await fs.writeFile(filePath, `${JSON.stringify(stringRevision)}\n`);
  await assert.rejects(
    store.observeSession(created.sessionId),
    (error) => error instanceof HextrisSessionStoreError && error.code === "HEXTRIS_SESSION_FILE_INVALID"
  );

  const numericId = structuredClone(original);
  numericId.receipts[0].clientActionId = 12345678;
  numericId.receipts[0].result.clientActionId = 12345678;
  await fs.writeFile(filePath, `${JSON.stringify(numericId)}\n`);
  await assert.rejects(
    store.observeSession(created.sessionId),
    (error) => error instanceof HextrisSessionStoreError && error.code === "HEXTRIS_SESSION_FILE_INVALID"
  );

  const arrayHash = structuredClone(original);
  arrayHash.receipts[0].payloadHash = [arrayHash.receipts[0].payloadHash];
  await fs.writeFile(filePath, `${JSON.stringify(arrayHash)}\n`);
  await assert.rejects(
    store.observeSession(created.sessionId),
    (error) => error instanceof HextrisSessionStoreError && error.code === "HEXTRIS_SESSION_FILE_INVALID"
  );

  const numericExpiry = structuredClone(original);
  numericExpiry.receipts[0].result.expiresAt = 0;
  numericExpiry.receipts[0].result.observation.expiresAt = 0;
  await fs.writeFile(filePath, `${JSON.stringify(numericExpiry)}\n`);
  await assert.rejects(
    store.observeSession(created.sessionId),
    (error) => error instanceof HextrisSessionStoreError && error.code === "HEXTRIS_SESSION_FILE_INVALID"
  );
});

test("a post-publish open failure retires only its exact marker", async (t) => {
  const { rootDir } = await testStore(t);
  const store = createHextrisSessionStore({ rootDir, lockWaitMs: 200, lockPollMs: 5, lockStaleMs: 1_000 });
  const lockPath = path.join(rootDir, ".publish-open-failure.lock");
  const originalOpen = fs.open;
  let injected = false;
  fs.open = async (target, flags, ...args) => {
    if (
      !injected
      && flags === "r+"
      && path.dirname(String(target)) === lockPath
      && /^owner-[a-f0-9]{32}\.json$/.test(path.basename(String(target)))
    ) {
      injected = true;
      const error = new Error("injected published-marker open failure");
      error.code = "EACCES";
      throw error;
    }
    return originalOpen(target, flags, ...args);
  };
  try {
    await assert.rejects(
      store.withLock(lockPath, async () => "must-not-run"),
      (error) => error instanceof HextrisSessionStoreError && error.code === "HEXTRIS_STORAGE_ERROR"
    );
    assert.equal(injected, true);
    assert.equal(await exists(lockPath), false);
  } finally {
    fs.open = originalOpen;
  }
});

test("recovers stale empty and partial legacy files plus a stale directory marker", async (t) => {
  const { rootDir } = await testStore(t);
  const store = createHextrisSessionStore({
    rootDir,
    lockWaitMs: 500,
    lockPollMs: 2,
    lockStaleMs: 10
  });
  const lockPath = path.join(rootDir, ".legacy-recovery.lock");
  const old = new Date(Date.now() - 60_000);

  for (const [index, contents] of ["", "{\"ownerToken\":\""] .entries()) {
    await fs.writeFile(lockPath, contents, { mode: 0o600, flag: "wx" });
    await fs.utimes(lockPath, old, old);
    assert.equal(
      await store.withLock(lockPath, async () => `legacy-${index}`),
      `legacy-${index}`
    );
    assert.equal(await exists(lockPath), false);
  }

  const staleRecord = {
    ownerToken: "e".repeat(32),
    pid: process.pid,
    processInstanceToken: "0".repeat(32),
    createdAtMs: Date.now() - 60_000
  };
  await writeDirectoryLock(lockPath, staleRecord);
  await fs.utimes(await lockMarkerPath(lockPath), old, old);
  assert.equal(await store.withLock(lockPath, async () => "directory-recovered"), "directory-recovered");
  assert.equal(await exists(lockPath), false);
});

test("a backdated lock with a live process instance remains owned", { timeout: 5_000 }, async (t) => {
  const { rootDir } = await testStore(t);
  const owner = createHextrisSessionStore({
    rootDir,
    lockWaitMs: 1_000,
    lockPollMs: 5,
    lockStaleMs: 4_000
  });
  const contender = createHextrisSessionStore({
    rootDir,
    lockWaitMs: 120,
    lockPollMs: 5,
    lockStaleMs: 4_000
  });
  const lockPath = path.join(rootDir, ".live-pid.lock");
  const entered = deferred();
  const finish = deferred();
  let active = 0;
  let maxActive = 0;
  const holding = owner.withLock(lockPath, async () => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    entered.resolve();
    await finish.promise;
    active -= 1;
    return "owner-finished";
  });
  await entered.promise;
  const old = new Date(Date.now() - 60_000);
  await fs.utimes(await lockMarkerPath(lockPath), old, old);

  await assert.rejects(
    contender.withLock(lockPath, async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      active -= 1;
    }),
    (error) => error instanceof HextrisSessionStoreError && error.code === "HEXTRIS_LOCK_TIMEOUT"
  );
  finish.resolve();
  assert.equal(await holding, "owner-finished");
  assert.equal(maxActive, 1);
});

test("a crashed retiring marker is recoverable while a live retiring owner stays busy", async (t) => {
  const { rootDir } = await testStore(t);
  const store = createHextrisSessionStore({ rootDir, lockWaitMs: 120, lockPollMs: 5, lockStaleMs: 10 });
  const probePath = path.join(rootDir, ".retiring-instance-probe.lock");
  const liveRecord = await store.withLock(probePath, async () => readDirectoryLockRecord(probePath));
  const lockPath = path.join(rootDir, ".retiring-crash.lock");
  const old = new Date(Date.now() - 60_000);

  await writeDirectoryLock(lockPath, liveRecord);
  const liveOwnerMarker = await lockMarkerPath(lockPath);
  await fs.rename(liveOwnerMarker, path.join(lockPath, `retiring-${liveRecord.ownerToken}.json`));
  await fs.utimes(lockPath, old, old);
  await assert.rejects(
    store.withLock(lockPath, async () => "must-not-run"),
    (error) => error instanceof HextrisSessionStoreError && error.code === "HEXTRIS_LOCK_TIMEOUT"
  );
  await fs.unlink(await retiringMarkerPath(lockPath));
  await fs.rmdir(lockPath);

  const deadRecord = {
    ownerToken: "b".repeat(32),
    pid: process.pid,
    processInstanceToken: "3".repeat(32),
    createdAtMs: Date.now() - 60_000
  };
  await writeDirectoryLock(lockPath, deadRecord);
  const deadOwnerMarker = await lockMarkerPath(lockPath);
  await fs.rename(deadOwnerMarker, path.join(lockPath, `retiring-${deadRecord.ownerToken}.json`));
  await fs.utimes(lockPath, old, old);
  assert.equal(await store.withLock(lockPath, async () => "retiring-recovered"), "retiring-recovered");
  assert.equal(await exists(lockPath), false);
});

test("Windows transient marker rename errors are retried without losing ownership", async (t) => {
  if (process.platform !== "win32") {
    t.skip("Windows-specific rename sharing behavior");
    return;
  }
  const { rootDir } = await testStore(t);
  const store = createHextrisSessionStore({ rootDir, lockWaitMs: 1_000, lockPollMs: 5, lockStaleMs: 4_000 });
  const lockPath = path.join(rootDir, ".rename-retry.lock");
  const originalRename = fs.rename;
  let injected = 0;
  fs.rename = async (source, destination, ...args) => {
    if (
      injected < 3
      && path.dirname(String(source)) === lockPath
      && /^owner-[a-f0-9]{32}\.json$/.test(path.basename(String(source)))
      && /^retiring-[a-f0-9]{32}\.json$/.test(path.basename(String(destination)))
    ) {
      injected += 1;
      const error = new Error("injected Windows marker sharing violation");
      error.code = "EPERM";
      throw error;
    }
    return originalRename(source, destination, ...args);
  };
  try {
    assert.equal(await store.withLock(lockPath, async () => "released"), "released");
    assert.equal(injected, 3);
    assert.equal(await exists(lockPath), false);
  } finally {
    fs.rename = originalRename;
  }
});

test("a locally abandoned owner marker is recovered after persistent Windows rename failures", { timeout: 10_000 }, async (t) => {
  if (process.platform !== "win32") {
    t.skip("Windows-specific rename sharing behavior");
    return;
  }
  const { rootDir } = await testStore(t);
  const lockStaleMs = 1_000;
  const store = createHextrisSessionStore({
    rootDir,
    lockWaitMs: 2_000,
    lockPollMs: 2,
    lockStaleMs
  });
  const lockPath = path.join(rootDir, ".abandoned-rename.lock");
  const originalRename = fs.rename;
  let injectPersistentFailure = true;
  let injected = 0;
  let active = 0;
  let maxActive = 0;

  fs.rename = async (source, destination, ...args) => {
    if (
      injectPersistentFailure
      && path.dirname(String(source)) === lockPath
      && /^owner-[a-f0-9]{32}\.json$/.test(path.basename(String(source)))
      && /^retiring-[a-f0-9]{32}\.json$/.test(path.basename(String(destination)))
    ) {
      injected += 1;
      const error = new Error("injected persistent Windows marker sharing violation");
      error.code = "EPERM";
      throw error;
    }
    return originalRename(source, destination, ...args);
  };

  try {
    await assert.rejects(
      store.withLock(lockPath, async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        active -= 1;
        return "committed-before-release";
      }),
      (error) => error instanceof HextrisSessionStoreError
        && error.code === "HEXTRIS_LOCK_MARKER_TRANSITION_FAILED"
    );
    assert.ok(injected > 1);
    assert.equal(active, 0);
    const abandonedMarker = await lockMarkerPath(lockPath);
    const markerStat = await fs.stat(abandonedMarker);

    injectPersistentFailure = false;
    const remainingStaleMs = Math.max(0, markerStat.mtimeMs + lockStaleMs - Date.now() + 25);
    if (remainingStaleMs > 0) await delay(remainingStaleMs);

    assert.equal(await store.withLock(lockPath, async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      try {
        return "recovered-after-stale";
      } finally {
        active -= 1;
      }
    }), "recovered-after-stale");
    assert.equal(maxActive, 1);
    assert.equal(await exists(lockPath), false);
  } finally {
    injectPersistentFailure = false;
    fs.rename = originalRename;
  }
});

test("normal release stays available while many contenders inspect the owner", { timeout: 10_000 }, async (t) => {
  const { rootDir } = await testStore(t);
  const owner = createHextrisSessionStore({ rootDir, lockWaitMs: 5_000, lockPollMs: 1, lockStaleMs: 4_000 });
  const contenders = Array.from({ length: 24 }, () => createHextrisSessionStore({
    rootDir,
    lockWaitMs: 5_000,
    lockPollMs: 1,
    lockStaleMs: 4_000
  }));
  const lockPath = path.join(rootDir, ".release-pressure.lock");
  const ownerEntered = deferred();
  const allowOwnerRelease = deferred();
  let active = 0;
  let maxActive = 0;
  const ownerRun = owner.withLock(lockPath, async () => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    ownerEntered.resolve();
    await allowOwnerRelease.promise;
    active -= 1;
    return "owner";
  });
  await ownerEntered.promise;
  const contenderRuns = contenders.map((contender, index) => contender.withLock(lockPath, async () => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    try {
      await delay(2);
      return index;
    } finally {
      active -= 1;
    }
  }));
  await delay(25);
  allowOwnerRelease.resolve();
  assert.equal(await ownerRun, "owner");
  const results = await Promise.all(contenderRuns);
  assert.equal(new Set(results).size, contenders.length);
  assert.equal(maxActive, 1);
  assert.equal(await exists(lockPath), false);
});

test("release empty-directory window cannot remove a successor marker", { timeout: 10_000 }, async (t) => {
  const { rootDir } = await testStore(t);
  const owner = createHextrisSessionStore({ rootDir, lockWaitMs: 2_000, lockPollMs: 2, lockStaleMs: 4_000 });
  const contender = createHextrisSessionStore({ rootDir, lockWaitMs: 2_000, lockPollMs: 2, lockStaleMs: 4_000 });
  const lockPath = path.join(rootDir, ".release-window.lock");
  const markerRemoved = deferred();
  const allowOldRelease = deferred();
  const contenderEntered = deferred();
  const allowContenderRelease = deferred();
  const originalUnlink = fs.unlink;
  let intercepted = false;
  let ownerRun;
  let contenderRun;

  fs.unlink = async (target, ...args) => {
    const targetPath = String(target);
    if (
      !intercepted
      && path.dirname(targetPath) === lockPath
      && /^retiring-[a-f0-9]{32}\.json$/.test(path.basename(targetPath))
    ) {
      intercepted = true;
      const result = await originalUnlink(target, ...args);
      markerRemoved.resolve();
      await allowOldRelease.promise;
      return result;
    }
    return originalUnlink(target, ...args);
  };

  try {
    ownerRun = owner.withLock(lockPath, async () => "old-owner-finished");
    await markerRemoved.promise;
    contenderRun = contender.withLock(lockPath, async () => {
      const record = await readDirectoryLockRecord(lockPath);
      contenderEntered.resolve(record);
      await allowContenderRelease.promise;
      return "new-owner-finished";
    });
    const successor = await contenderEntered.promise;
    assert.match(successor.ownerToken, /^[a-f0-9]{32}$/);

    allowOldRelease.resolve();
    assert.equal(await ownerRun, "old-owner-finished");
    assert.equal((await readDirectoryLockRecord(lockPath)).ownerToken, successor.ownerToken);
    allowContenderRelease.resolve();
    assert.equal(await contenderRun, "new-owner-finished");
    assert.equal(await exists(lockPath), false);
  } finally {
    allowOldRelease.resolve();
    allowContenderRelease.resolve();
    fs.unlink = originalUnlink;
    await Promise.allSettled([ownerRun, contenderRun].filter(Boolean));
  }
});

test("legacy unlink ABA cannot delete a newly published directory lock", { timeout: 5_000 }, async (t) => {
  const { rootDir } = await testStore(t);
  const store = createHextrisSessionStore({ rootDir, lockWaitMs: 150, lockPollMs: 5, lockStaleMs: 10 });
  const probePath = path.join(rootDir, ".instance-probe.lock");
  const liveRecord = await store.withLock(probePath, async () => readDirectoryLockRecord(probePath));
  const lockPath = path.join(rootDir, ".legacy-aba.lock");
  await fs.writeFile(lockPath, "{", { mode: 0o600, flag: "wx" });
  const old = new Date(Date.now() - 60_000);
  await fs.utimes(lockPath, old, old);

  const beforeLegacyUnlink = deferred();
  const allowLegacyUnlink = deferred();
  const originalUnlink = fs.unlink;
  let intercepted = false;
  let callbackEntered = false;
  let attempt;
  fs.unlink = async (target, ...args) => {
    if (!intercepted && String(target) === lockPath) {
      intercepted = true;
      beforeLegacyUnlink.resolve();
      await allowLegacyUnlink.promise;
    }
    return originalUnlink(target, ...args);
  };

  try {
    attempt = store.withLock(lockPath, async () => {
      callbackEntered = true;
    });
    await beforeLegacyUnlink.promise;
    await originalUnlink(lockPath);
    await writeDirectoryLock(lockPath, liveRecord);
    allowLegacyUnlink.resolve();
    await assert.rejects(
      attempt,
      (error) => error instanceof HextrisSessionStoreError && error.code === "HEXTRIS_LOCK_TIMEOUT"
    );
    assert.equal(callbackEntered, false);
    assert.equal((await readDirectoryLockRecord(lockPath)).ownerToken, liveRecord.ownerToken);
  } finally {
    allowLegacyUnlink.resolve();
    fs.unlink = originalUnlink;
    await attempt?.catch(() => {});
  }
});

test("multi-contender stale recovery preserves callback exclusion", { timeout: 120_000 }, async (t) => {
  const { rootDir } = await testStore(t);
  const lockPath = path.join(rootDir, ".pressure.lock");
  const rounds = process.env.HEXTRIS_PRESSURE_ROUNDS === "30" ? 30 : 12;
  const contenderCount = process.env.HEXTRIS_PRESSURE_CONTENDERS === "30" ? 30 : 24;
  let criticalOverlaps = 0;
  let maxObservedActive = 0;
  let successes = 0;
  let rejections = 0;
  let ownershipLosses = 0;
  let leftovers = 0;
  let firstRejection = null;

  for (let round = 0; round < rounds; round += 1) {
    const staleRecord = {
      ownerToken: round.toString(16).padStart(32, "0"),
      pid: process.pid,
      processInstanceToken: "0".repeat(32),
      createdAtMs: Date.now() - 60_000
    };
    const old = new Date(Date.now() - 60_000);
    if (round % 3 === 0) {
      await fs.writeFile(lockPath, `${JSON.stringify(staleRecord)}\n`, { mode: 0o600, flag: "wx" });
      await fs.utimes(lockPath, old, old);
    } else if (round % 3 === 1) {
      await writeDirectoryLock(lockPath, staleRecord);
      await fs.utimes(await lockMarkerPath(lockPath), old, old);
    }
    let active = 0;
    let maxActive = 0;
    const stores = Array.from({ length: contenderCount }, () => createHextrisSessionStore({
      rootDir,
      lockWaitMs: 5_000,
      lockPollMs: 1,
      lockStaleMs: 80
    }));
    const results = await Promise.allSettled(stores.map((roundStore, index) => (
      roundStore.withLock(lockPath, async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        try {
          await delay(3);
          return index;
        } finally {
          active -= 1;
        }
      })
    )));
    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");
    successes += fulfilled.length;
    rejections += rejected.length;
    ownershipLosses += rejected.filter(
      (result) => result.reason instanceof HextrisSessionStoreError
        && result.reason.code === "HEXTRIS_LOCK_OWNERSHIP_LOST"
    ).length;
    if (!firstRejection && rejected.length > 0) firstRejection = rejected[0].reason;
    assert.equal(new Set(fulfilled.map((result) => result.value)).size, fulfilled.length);
    if (maxActive > 1) criticalOverlaps += 1;
    maxObservedActive = Math.max(maxObservedActive, maxActive);
    if (await exists(lockPath)) leftovers += 1;
    if (rejected.length > 0) break;
  }
  if (process.env.HEXTRIS_PRESSURE_ROUNDS === "30") {
    t.diagnostic(JSON.stringify({
      rounds,
      contenderCount,
      successes,
      rejections,
      criticalOverlaps,
      maxObservedActive,
      ownershipLosses,
      leftovers
    }));
  }
  assert.equal(rejections, 0, firstRejection?.stack || firstRejection?.message);
  assert.equal(criticalOverlaps, 0);
  assert.equal(maxObservedActive, 1);
  assert.equal(leftovers, 0);
});

test("session commit rechecks the owner fence after temp-file preparation begins", { timeout: 5_000 }, async (t) => {
  const { rootDir } = await testStore(t);
  const store = createHextrisSessionStore({ rootDir, lockWaitMs: 500, lockPollMs: 5, lockStaleMs: 4_000 });
  const created = await store.createSession({ seed: 67 });
  const filePath = sessionFile(rootDir, created.sessionId);
  const before = await fs.readFile(filePath);
  const tempOpenReached = deferred();
  const allowTempOpen = deferred();
  const originalOpen = fs.open;
  let intercepted = false;
  let attempt;

  fs.open = async (target, flags, ...args) => {
    const basename = path.basename(String(target));
    if (
      !intercepted
      && flags === "wx"
      && basename.startsWith(`.${created.sessionId}.json.`)
      && basename.endsWith(".tmp")
    ) {
      intercepted = true;
      tempOpenReached.resolve();
      await allowTempOpen.promise;
    }
    return originalOpen(target, flags, ...args);
  };

  try {
    attempt = store.actSession(created.sessionId, placeRequest(0, "fence_action_0001", 2));
    await tempOpenReached.promise;
    const markerPath = await lockMarkerPath(sessionLock(rootDir, created.sessionId));
    const replacement = {
      ownerToken: "f".repeat(32),
      pid: process.pid,
      processInstanceToken: "1".repeat(32),
      createdAtMs: Date.now()
    };
    await fs.writeFile(markerPath, `${JSON.stringify(replacement)}\n`, { flag: "w" });
    allowTempOpen.resolve();
    await assert.rejects(
      attempt,
      (error) => error instanceof HextrisSessionStoreError && error.code === "HEXTRIS_LOCK_OWNERSHIP_LOST"
    );
    assert.deepEqual(await fs.readFile(filePath), before);
  } finally {
    allowTempOpen.resolve();
    fs.open = originalOpen;
    await attempt?.catch(() => {});
  }
});

test("close rechecks the owner fence before removing a session file", { timeout: 5_000 }, async (t) => {
  const { rootDir } = await testStore(t);
  const store = createHextrisSessionStore({ rootDir, lockWaitMs: 500, lockPollMs: 5, lockStaleMs: 4_000 });
  const created = await store.createSession({ seed: 71 });
  const filePath = sessionFile(rootDir, created.sessionId);
  const stateCheckReached = deferred();
  const allowStateCheck = deferred();
  const originalLstat = fs.lstat;
  let intercepted = false;
  let attempt;

  fs.lstat = async (target, ...args) => {
    if (!intercepted && String(target) === filePath) {
      intercepted = true;
      stateCheckReached.resolve();
      await allowStateCheck.promise;
    }
    return originalLstat(target, ...args);
  };
  try {
    attempt = store.closeSession(created.sessionId, { confirm: true });
    await stateCheckReached.promise;
    const markerPath = await lockMarkerPath(sessionLock(rootDir, created.sessionId));
    const replacement = {
      ownerToken: "a".repeat(32),
      pid: process.pid,
      processInstanceToken: "2".repeat(32),
      createdAtMs: Date.now()
    };
    await fs.writeFile(markerPath, `${JSON.stringify(replacement)}\n`, { flag: "w" });
    allowStateCheck.resolve();
    await assert.rejects(
      attempt,
      (error) => error instanceof HextrisSessionStoreError && error.code === "HEXTRIS_LOCK_OWNERSHIP_LOST"
    );
    assert.equal(await exists(filePath), true);
  } finally {
    allowStateCheck.resolve();
    fs.lstat = originalLstat;
    await attempt?.catch(() => {});
  }
});

test("CLI exposes strict JSON-friendly commands and refuses unsafe option forms", async (t) => {
  const { rootDir, store } = await testStore(t);
  const help = await runHextrisAgentCli(["help"], { store });
  assert.equal(help.name, "LuSu Hextris Agent CLI");

  const created = await runHextrisAgentCli(["create", "--seed", "43"], { store });
  const acted = await runHextrisAgentCli([
    "act",
    created.sessionId,
    "--expected-revision",
    "0",
    "--client-action-id",
    "cli_action_0001",
    "--lane",
    "5"
  ], { store });
  assert.equal(acted.revision, 1);
  assert.doesNotMatch(JSON.stringify(acted), new RegExp(escapeRegex(rootDir), "i"));

  await assert.rejects(
    runHextrisAgentCli(["create", "--seed=1"], { store }),
    (error) => error instanceof HextrisCliError && error.code === "HEXTRIS_OPTION_INVALID"
  );
  await assert.rejects(
    runHextrisAgentCli(["reset", created.sessionId, "--expected-revision", "1", "--client-action-id", "cli_reset_0001"], { store }),
    (error) => error instanceof HextrisCliError && error.code === "HEXTRIS_OPTION_REQUIRED"
  );
  assert.deepEqual(safeHextrisCliError(new Error(`secret: ${rootDir}`)), {
    error: "The Hextris agent command failed.",
    code: "HEXTRIS_COMMAND_FAILED"
  });
});

test("default state root follows the documented environment precedence", () => {
  assert.equal(
    resolveHextrisAgentDirectory({
      env: { LUSU_HEXTRIS_AGENT_DIR: "./custom-agent" },
      homeDir: "/home/ignored",
      platform: "linux"
    }),
    path.resolve("./custom-agent")
  );
  assert.equal(
    resolveHextrisAgentDirectory({ env: { APPDATA: "C:\\AgentData" }, platform: "win32", homeDir: "C:\\Users\\ignored" }),
    path.resolve("C:\\AgentData", "lusu-hextris-agent")
  );
  assert.equal(
    resolveHextrisAgentDirectory({ env: {}, platform: "linux", homeDir: "/home/example" }),
    path.resolve("/home/example", ".config", "lusu-hextris-agent")
  );
});

async function exists(filePath) {
  try {
    await fs.lstat(filePath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
