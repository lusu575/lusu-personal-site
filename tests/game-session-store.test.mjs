import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { deflateRawSync } from "node:zlib";
import { create2048Adapter } from "../lib/capabilities/games/2048-adapter.mjs";
import {
  GAME_SESSION_DEDUPE_LIMIT,
  GameSessionStoreError,
  createGameSessionStore
} from "../lib/capabilities/game-session-store.mjs";

test("persistent game sessions enforce CAS, deduplicate retries, and confirm reset/close", async (t) => {
  const rootDirectory = await temporaryDirectory(t);
  const store = createGameSessionStore({
    rootDirectory,
    adapters: [create2048Adapter({ seedFactory: () => 12345 })]
  });
  const created = await store.createSession("2048");
  const sessionId = created.observation.sessionId;
  const moveAction = created.actions.actions.find((entry) => entry.action.type === "move").action;

  const first = await store.actSession(sessionId, {
    expectedRevision: 0,
    clientActionId: "action_0001",
    action: moveAction
  });
  assert.equal(first.status, "applied");
  assert.equal(first.revision, 1);
  assert.equal(first.deduplicated, false);

  const retried = await store.actSession(sessionId, {
    expectedRevision: 0,
    clientActionId: "action_0001",
    action: moveAction
  });
  assert.equal(retried.status, "applied");
  assert.equal(retried.revision, 1);
  assert.equal(retried.deduplicated, true);

  await assert.rejects(
    store.actSession(sessionId, {
      expectedRevision: 1,
      clientActionId: "action_0001",
      action: { type: "reset", confirm: true }
    }),
    (error) => error instanceof GameSessionStoreError && error.code === "GAME_CLIENT_ACTION_ID_REUSED"
  );

  const conflict = await store.actSession(sessionId, {
    expectedRevision: 0,
    clientActionId: "action_0002",
    action: moveAction
  });
  assert.equal(conflict.status, "rejected");
  assert.equal(conflict.reason, "revision-conflict");
  assert.equal(conflict.revision, 1);

  const resetRejected = await store.actSession(sessionId, {
    expectedRevision: 1,
    clientActionId: "action_0003",
    action: { type: "reset" }
  });
  assert.equal(resetRejected.status, "rejected");
  assert.equal(resetRejected.reason, "confirmation-required");
  assert.equal(resetRejected.revision, 1);

  const reset = await store.actSession(sessionId, {
    expectedRevision: 1,
    clientActionId: "action_0004",
    action: { type: "reset", confirm: true }
  });
  assert.equal(reset.status, "applied");
  assert.equal(reset.reason, "reset");
  assert.equal(reset.revision, 2);

  await assert.rejects(
    store.closeSession(sessionId),
    (error) => error instanceof GameSessionStoreError && error.code === "GAME_SESSION_CLOSE_CONFIRMATION_REQUIRED"
  );
  const closed = await store.closeSession(sessionId, { confirm: true });
  assert.equal(closed.closed, true);
  await assert.rejects(
    store.observeSession(sessionId),
    (error) => error instanceof GameSessionStoreError && error.code === "GAME_SESSION_NOT_FOUND"
  );
});

test("game observation and action discovery are true read-only operations", async (t) => {
  const rootDirectory = await temporaryDirectory(t);
  let now = Date.parse("2026-08-06T00:00:00.000Z");
  const store = createGameSessionStore({
    rootDirectory,
    adapters: [create2048Adapter({ seedFactory: () => 2468 })],
    ttlMs: 1_000,
    clock: () => now
  });
  const created = await store.createSession("2048");
  const sessionId = created.observation.sessionId;
  const sessionFile = path.join(rootDirectory, `${sessionId}.json`);
  const fixedMtime = new Date("2026-08-05T00:00:00.000Z");
  await fs.utimes(sessionFile, fixedMtime, fixedMtime);
  const beforeText = await fs.readFile(sessionFile, "utf8");
  const beforePayload = JSON.parse(beforeText);
  const beforeStat = await fs.stat(sessionFile);

  now += 400;
  const observation = await store.observeSession(sessionId);
  const actions = await store.actionsForSession(sessionId);
  assert.equal(observation.revision, 0);
  assert.equal(actions.revision, 0);

  const afterText = await fs.readFile(sessionFile, "utf8");
  const afterPayload = JSON.parse(afterText);
  const afterStat = await fs.stat(sessionFile);
  assert.equal(afterText, beforeText);
  assert.equal(afterPayload.updatedAt, beforePayload.updatedAt);
  assert.equal(afterPayload.expiresAt, beforePayload.expiresAt);
  assert.equal(afterStat.mtimeMs, beforeStat.mtimeMs);
  assert.deepEqual(await fs.readdir(rootDirectory), [`${sessionId}.json`]);

  now += 601;
  await assert.rejects(
    store.observeSession(sessionId),
    (error) => error instanceof GameSessionStoreError && error.code === "GAME_SESSION_EXPIRED"
  );
  assert.equal(await fs.readFile(sessionFile, "utf8"), beforeText);
  assert.deepEqual(await fs.readdir(rootDirectory), [`${sessionId}.json`]);
});

test("large dedupe receipts are compressed, replay exactly, and reject tampering or expansion", async (t) => {
  const rootDirectory = await temporaryDirectory(t);
  const store = createGameSessionStore({
    rootDirectory,
    adapters: [largeReceiptAdapter()]
  });
  const created = await store.createSession("large-receipt");
  const sessionId = created.observation.sessionId;
  const actionRequest = {
    expectedRevision: 0,
    clientActionId: "large_receipt_0001",
    action: { type: "advance" }
  };
  const applied = await store.actSession(sessionId, actionRequest);
  const sessionFile = path.join(rootDirectory, `${sessionId}.json`);
  const payload = JSON.parse(await fs.readFile(sessionFile, "utf8"));

  assert.equal(payload.dedupe[0].result.encoding, "deflate-raw-base64-v1");
  assert.ok(payload.dedupe[0].result.rawBytes > 4 * 1024);
  assert.ok(payload.dedupe[0].result.data.length < payload.dedupe[0].result.rawBytes);

  const retried = await store.actSession(sessionId, actionRequest);
  assert.deepEqual(retried, { ...applied, deduplicated: true });

  payload.dedupe[0].result.sha256 = "0".repeat(64);
  await fs.writeFile(sessionFile, `${JSON.stringify(payload)}\n`, "utf8");
  await assert.rejects(
    store.observeSession(sessionId),
    (error) => error instanceof GameSessionStoreError && error.code === "GAME_SESSION_INVALID"
  );

  const expansionRoot = await temporaryDirectory(t);
  const expansionStore = createGameSessionStore({
    rootDirectory: expansionRoot,
    adapters: [largeReceiptAdapter()]
  });
  const expansionSession = await expansionStore.createSession("large-receipt");
  const expansionId = expansionSession.observation.sessionId;
  await expansionStore.actSession(expansionId, actionRequest);
  const expansionFile = path.join(expansionRoot, `${expansionId}.json`);
  const expansionPayload = JSON.parse(await fs.readFile(expansionFile, "utf8"));
  expansionPayload.dedupe[0].result = {
    encoding: "deflate-raw-base64-v1",
    rawBytes: 2,
    sha256: "0".repeat(64),
    data: deflateRawSync(Buffer.alloc(128 * 1024, 120)).toString("base64")
  };
  await fs.writeFile(expansionFile, `${JSON.stringify(expansionPayload)}\n`, "utf8");
  await assert.rejects(
    expansionStore.observeSession(expansionId),
    (error) => error instanceof GameSessionStoreError && error.code === "GAME_SESSION_INVALID"
  );
});

test("game session locks preserve a replacement owner and reject takeover while it is active", async (t) => {
  const rootDirectory = await temporaryDirectory(t);
  const store = createGameSessionStore({
    rootDirectory,
    adapters: [create2048Adapter({ seedFactory: () => 1357 })],
    lockTimeoutMs: 250,
    staleLockMs: 1_000
  });
  const lockFile = path.join(rootDirectory, "ownership-race.lock");
  const firstEntered = deferred();
  const releaseFirst = deferred();
  const secondEntered = deferred();
  const releaseSecond = deferred();
  let secondPromise;
  let firstRecord;
  let firstOwner;
  const displacedLock = `${lockFile}.displaced`;

  const firstPromise = store.withLock(lockFile, async (owner) => {
    firstOwner = owner;
    firstEntered.resolve();
    await releaseFirst.promise;
  });

  try {
    await firstEntered.promise;
    firstRecord = await readLockRecord(lockFile);
    const firstEntries = await fs.readdir(lockFile);
    assert.equal((await fs.stat(lockFile)).isDirectory(), true);
    assert.deepEqual(firstEntries.sort(), [
      `heartbeat-${firstRecord.ownerToken}.json`,
      `owner-${firstRecord.ownerToken}.json`
    ]);

    // Simulate a stale-owner takeover while the former holder is still unwinding.
    await firstOwner.heartbeatHandle.close();
    firstOwner.heartbeatHandle = null;
    await fs.rename(lockFile, displacedLock);
    secondPromise = store.withLock(lockFile, async () => {
      secondEntered.resolve();
      await releaseSecond.promise;
    });
    await secondEntered.promise;
    const secondRecord = await readLockRecord(lockFile);
    assert.notEqual(secondRecord.ownerToken, firstRecord.ownerToken);

    releaseFirst.resolve();
    await firstPromise;
    assert.equal((await readLockRecord(lockFile)).ownerToken, secondRecord.ownerToken);

    const staleTime = new Date(Date.now() - 5_000);
    await fs.utimes(lockHeartbeatPath(lockFile, secondRecord.ownerToken), staleTime, staleTime);
    let thirdEntered = false;
    await assert.rejects(
      store.withLock(lockFile, async () => {
        thirdEntered = true;
      }, 80),
      (error) => error instanceof GameSessionStoreError && error.code === "GAME_SESSION_LOCK_TIMEOUT"
    );
    assert.equal(thirdEntered, false);
  } finally {
    releaseFirst.resolve();
    releaseSecond.resolve();
    await Promise.allSettled([firstPromise, secondPromise].filter(Boolean));
  }

  await assertPathMissing(lockFile);
  assert.equal((await readLockRecord(displacedLock)).ownerToken, firstRecord.ownerToken);
});

test("stale locks are recovered only when the exact prior process instance is known dead", async (t) => {
  const rootDirectory = await temporaryDirectory(t);
  const lockFile = path.join(rootDirectory, "pid-reuse.lock");
  const currentInstance = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const oldInstance = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const staleOwner = "11111111-1111-4111-8111-111111111111";
  await writeLockDirectory(lockFile, {
    ownerToken: staleOwner,
    processInstanceToken: oldInstance,
    pid: process.pid,
    heartbeatAgeMs: 5_000
  });
  let processProbeCalled = false;
  const store = createGameSessionStore({
    rootDirectory,
    adapters: [create2048Adapter({ seedFactory: () => 17 })],
    processId: process.pid,
    processInstanceToken: currentInstance,
    processProbe: () => {
      processProbeCalled = true;
      return "unknown";
    },
    staleLockMs: 1_000,
    lockTimeoutMs: 200
  });

  let entered = false;
  await store.withLock(lockFile, async () => {
    entered = true;
  });
  assert.equal(entered, true);
  assert.equal(processProbeCalled, false);
  await assertPathMissing(lockFile);
});

test("live or unverifiable owners remain authoritative even with an old heartbeat", async (t) => {
  const rootDirectory = await temporaryDirectory(t);
  const currentInstance = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const liveLock = path.join(rootDirectory, "live-owner.lock");
  await writeLockDirectory(liveLock, {
    ownerToken: "22222222-2222-4222-8222-222222222222",
    processInstanceToken: currentInstance,
    pid: process.pid,
    heartbeatAgeMs: 10_000
  });
  const liveStore = createGameSessionStore({
    rootDirectory,
    adapters: [create2048Adapter({ seedFactory: () => 18 })],
    processId: process.pid,
    processInstanceToken: currentInstance,
    staleLockMs: 1_000,
    lockTimeoutMs: 60
  });
  await assert.rejects(
    liveStore.withLock(liveLock, async () => {}),
    (error) => error instanceof GameSessionStoreError && error.code === "GAME_SESSION_LOCK_TIMEOUT"
  );
  assert.equal((await readLockRecord(liveLock)).ownerToken, "22222222-2222-4222-8222-222222222222");

  const unknownLock = path.join(rootDirectory, "unknown-owner.lock");
  await writeLockDirectory(unknownLock, {
    ownerToken: "33333333-3333-4333-8333-333333333333",
    processInstanceToken: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    pid: 424_242,
    heartbeatAgeMs: 10_000
  });
  const unknownStore = createGameSessionStore({
    rootDirectory,
    adapters: [create2048Adapter({ seedFactory: () => 19 })],
    processId: process.pid,
    processInstanceToken: currentInstance,
    processProbe: () => "unknown",
    staleLockMs: 1_000,
    lockTimeoutMs: 60
  });
  await assert.rejects(
    unknownStore.withLock(unknownLock, async () => {}),
    (error) => error instanceof GameSessionStoreError && error.code === "GAME_SESSION_LOCK_TIMEOUT"
  );
  assert.equal((await readLockRecord(unknownLock)).ownerToken, "33333333-3333-4333-8333-333333333333");
});

test("malformed lock markers fail closed and are never removed as merely stale", async (t) => {
  const rootDirectory = await temporaryDirectory(t);
  const lockFile = path.join(rootDirectory, "malformed.lock");
  const token = "44444444-4444-4444-8444-444444444444";
  await fs.mkdir(lockFile);
  await fs.writeFile(path.join(lockFile, `owner-${token}.json`), "{not-json}\n", "utf8");
  await fs.writeFile(path.join(lockFile, `heartbeat-${token}.json`), "{}\n", "utf8");
  const stale = new Date(Date.now() - 10_000);
  await fs.utimes(path.join(lockFile, `heartbeat-${token}.json`), stale, stale);
  const before = await directoryTree(lockFile);
  const store = createGameSessionStore({
    rootDirectory,
    adapters: [create2048Adapter({ seedFactory: () => 20 })],
    staleLockMs: 1_000,
    lockTimeoutMs: 60
  });

  await assert.rejects(
    store.withLock(lockFile, async () => {}),
    (error) => error instanceof GameSessionStoreError && error.code === "GAME_SESSION_LOCK_TIMEOUT"
  );
  assert.deepEqual(await directoryTree(lockFile), before);
});

test("a stale retiring marker keeps the owner token and can be recovered exactly", async (t) => {
  const rootDirectory = await temporaryDirectory(t);
  const lockFile = path.join(rootDirectory, "retiring.lock");
  const staleOwner = "55555555-5555-4555-8555-555555555555";
  await writeLockDirectory(lockFile, {
    ownerToken: staleOwner,
    processInstanceToken: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    pid: process.pid,
    heartbeatAgeMs: 5_000,
    retiring: true
  });
  const entries = await fs.readdir(lockFile);
  assert.ok(entries.includes(`retiring-${staleOwner}.json`));
  const store = createGameSessionStore({
    rootDirectory,
    adapters: [create2048Adapter({ seedFactory: () => 21 })],
    processId: process.pid,
    processInstanceToken: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    staleLockMs: 1_000,
    lockTimeoutMs: 200
  });

  await store.withLock(lockFile, async () => {});
  await assertPathMissing(lockFile);
});

test("stale recovery detects ABA replacement and preserves the successor", async (t) => {
  const rootDirectory = await temporaryDirectory(t);
  const lockFile = path.join(rootDirectory, "aba.lock");
  const displaced = `${lockFile}.old`;
  const currentInstance = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const firstOwner = "66666666-6666-4666-8666-666666666666";
  const successorOwner = "77777777-7777-4777-8777-777777777777";
  await writeLockDirectory(lockFile, {
    ownerToken: firstOwner,
    processInstanceToken: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    pid: process.pid,
    heartbeatAgeMs: 5_000
  });
  const fileSystem = Object.create(fs);
  let replaced = false;
  fileSystem.rename = async (source, destination) => {
    if (!replaced && source === lockFile && destination.includes(".recovering-")) {
      replaced = true;
      // Replace the source after the store's pre-rename fence, then let rename move
      // the successor. The post-rename identity check must restore, never delete it.
      await fs.rename(source, displaced);
      await writeLockDirectory(source, {
        ownerToken: successorOwner,
        processInstanceToken: currentInstance,
        pid: process.pid,
        heartbeatAgeMs: 5_000
      });
    }
    return fs.rename(source, destination);
  };
  const store = createGameSessionStore({
    rootDirectory,
    fileSystem,
    adapters: [create2048Adapter({ seedFactory: () => 22 })],
    processId: process.pid,
    processInstanceToken: currentInstance,
    staleLockMs: 1_000,
    lockTimeoutMs: 80
  });

  await assert.rejects(
    store.withLock(lockFile, async () => {}),
    (error) => error instanceof GameSessionStoreError && error.code === "GAME_SESSION_LOCK_TIMEOUT"
  );
  assert.equal(replaced, true);
  assert.equal((await readLockRecord(lockFile)).ownerToken, successorOwner);
  assert.equal((await readLockRecord(displaced)).ownerToken, firstOwner);
});

test("session commit is fenced when lock ownership is lost", async (t) => {
  const rootDirectory = await temporaryDirectory(t);
  const store = createGameSessionStore({
    rootDirectory,
    adapters: [create2048Adapter({ seedFactory: () => 23 })]
  });
  const created = await store.createSession("2048");
  const sessionId = created.observation.sessionId;
  const sessionFile = path.join(rootDirectory, `${sessionId}.json`);
  const before = await fs.readFile(sessionFile, "utf8");
  const moveAction = created.actions.actions.find((entry) => entry.action.type === "move").action;
  const writeSession = store.writeSession.bind(store);
  let replaced = false;
  let successorToken;
  store.writeSession = async (payload, options) => {
    if (!replaced) {
      replaced = true;
      const displaced = `${options.lockOwner.lockFile}.lost`;
      await options.lockOwner.heartbeatHandle.close();
      options.lockOwner.heartbeatHandle = null;
      await fs.rename(options.lockOwner.lockFile, displaced);
      successorToken = "88888888-8888-4888-8888-888888888888";
      await writeLockDirectory(options.lockOwner.lockFile, {
        ownerToken: successorToken,
        processInstanceToken: store.processInstanceToken,
        pid: store.processId
      });
    }
    return writeSession(payload, options);
  };

  await assert.rejects(
    store.actSession(sessionId, {
      expectedRevision: 0,
      clientActionId: "commit_fence_0001",
      action: moveAction
    }),
    (error) => error instanceof GameSessionStoreError && error.code === "GAME_SESSION_LOCK_LOST"
  );
  assert.equal(await fs.readFile(sessionFile, "utf8"), before);
  assert.equal((await readLockRecord(store.sessionLockPath(sessionId))).ownerToken, successorToken);
});

test("close is fenced when lock ownership is lost", async (t) => {
  const rootDirectory = await temporaryDirectory(t);
  const store = createGameSessionStore({
    rootDirectory,
    adapters: [create2048Adapter({ seedFactory: () => 24 })]
  });
  const created = await store.createSession("2048");
  const sessionId = created.observation.sessionId;
  const sessionFile = path.join(rootDirectory, `${sessionId}.json`);
  const readSession = store.readSession.bind(store);
  let replaced = false;
  const successorToken = "99999999-9999-4999-8999-999999999999";
  store.readSession = async (id, options = {}) => {
    const payload = await readSession(id, options);
    if (options.removeExpired === true && !replaced) {
      replaced = true;
      const lockFile = store.sessionLockPath(sessionId);
      await options.lockOwner.heartbeatHandle.close();
      options.lockOwner.heartbeatHandle = null;
      await fs.rename(lockFile, `${lockFile}.lost`);
      await writeLockDirectory(lockFile, {
        ownerToken: successorToken,
        processInstanceToken: store.processInstanceToken,
        pid: store.processId
      });
    }
    return payload;
  };

  await assert.rejects(
    store.closeSession(sessionId, { confirm: true }),
    (error) => error instanceof GameSessionStoreError && error.code === "GAME_SESSION_LOCK_LOST"
  );
  assert.equal((await fs.stat(sessionFile)).isFile(), true);
  assert.equal((await readLockRecord(store.sessionLockPath(sessionId))).ownerToken, successorToken);
});

test("session replacement and close retry bounded transient Windows filesystem errors", async (t) => {
  const rootDirectory = await temporaryDirectory(t);
  const fileSystem = Object.create(fs);
  let sessionRenameAttempts = 0;
  let sessionUnlinkAttempts = 0;
  fileSystem.rename = async (source, destination) => {
    const sessionCommit = source.endsWith(".tmp")
      && path.dirname(destination) === rootDirectory
      && path.basename(destination).startsWith("game_")
      && destination.endsWith(".json");
    if (sessionCommit && sessionRenameAttempts++ < 2) {
      throw filesystemError("EPERM");
    }
    return fs.rename(source, destination);
  };
  fileSystem.unlink = async (file) => {
    const sessionDelete = path.dirname(file) === rootDirectory
      && path.basename(file).startsWith("game_")
      && file.endsWith(".json");
    if (sessionDelete && sessionUnlinkAttempts++ < 2) {
      throw filesystemError("EBUSY");
    }
    return fs.unlink(file);
  };
  const store = createGameSessionStore({
    rootDirectory,
    fileSystem,
    adapters: [create2048Adapter({ seedFactory: () => 25 })]
  });

  const created = await store.createSession("2048");
  assert.equal(sessionRenameAttempts, 3);
  const closed = await store.closeSession(created.observation.sessionId, { confirm: true });
  assert.equal(closed.closed, true);
  assert.equal(sessionUnlinkAttempts, 3);
});

test("read-only session methods do not create a missing storage directory", async (t) => {
  const parent = await temporaryDirectory(t);
  const rootDirectory = path.join(parent, "missing-game-sessions");
  const store = createGameSessionStore({
    rootDirectory,
    adapters: [create2048Adapter({ seedFactory: () => 26 })]
  });
  const sessionId = "game_2048_aaaaaaaaaaaaaaaaaaaaaaaa";

  await assert.rejects(
    store.observeSession(sessionId),
    (error) => error instanceof GameSessionStoreError && error.code === "GAME_SESSION_NOT_FOUND"
  );
  await assertPathMissing(rootDirectory);
  await assert.rejects(
    store.actionsForSession(sessionId),
    (error) => error instanceof GameSessionStoreError && error.code === "GAME_SESSION_NOT_FOUND"
  );
  await assertPathMissing(rootDirectory);
});

test("game session history retains only the most recent 128 client action ids", async (t) => {
  const rootDirectory = await temporaryDirectory(t);
  const store = createGameSessionStore({
    rootDirectory,
    adapters: [create2048Adapter({ seedFactory: () => 444 })]
  });
  const created = await store.createSession("2048");
  const sessionId = created.observation.sessionId;
  const moveAction = created.actions.actions.find((entry) => entry.action.type === "move").action;

  for (let index = 0; index < 130; index += 1) {
    const result = await store.actSession(sessionId, {
      expectedRevision: 1,
      clientActionId: `action_${String(index).padStart(4, "0")}`,
      action: moveAction
    });
    assert.equal(result.reason, "revision-conflict");
  }

  const payload = JSON.parse(await fs.readFile(path.join(rootDirectory, `${sessionId}.json`), "utf8"));
  assert.equal(payload.dedupe.length, GAME_SESSION_DEDUPE_LIMIT);
  assert.equal(payload.dedupe[0].clientActionId, "action_0002");
  assert.equal(payload.dedupe.at(-1).clientActionId, "action_0129");
});

test("game sessions reject tampered dedupe identities and TTL extension", async (t) => {
  const rootDirectory = await temporaryDirectory(t);
  const store = createGameSessionStore({
    rootDirectory,
    adapters: [create2048Adapter({ seedFactory: () => 555 })],
    ttlMs: 1_000
  });
  const created = await store.createSession("2048");
  const sessionId = created.observation.sessionId;
  const sessionFile = path.join(rootDirectory, `${sessionId}.json`);
  const moveAction = created.actions.actions.find((entry) => entry.action.type === "move").action;

  await store.actSession(sessionId, {
    expectedRevision: 0,
    clientActionId: "action_0001",
    action: moveAction
  });
  const tamperedResult = JSON.parse(await fs.readFile(sessionFile, "utf8"));
  tamperedResult.dedupe[0].result.sessionId = "game_2048_aaaaaaaaaaaaaaaaaaaaaaaa";
  await fs.writeFile(sessionFile, `${JSON.stringify(tamperedResult)}\n`, "utf8");
  await assert.rejects(
    store.observeSession(sessionId),
    (error) => error instanceof GameSessionStoreError && error.code === "GAME_SESSION_INVALID"
  );

  const replacementRoot = await temporaryDirectory(t);
  const replacementStore = createGameSessionStore({
    rootDirectory: replacementRoot,
    adapters: [create2048Adapter({ seedFactory: () => 556 })],
    ttlMs: 1_000
  });
  const replacement = await replacementStore.createSession("2048");
  const replacementFile = path.join(replacementRoot, `${replacement.observation.sessionId}.json`);
  const tamperedTtl = JSON.parse(await fs.readFile(replacementFile, "utf8"));
  tamperedTtl.expiresAt = new Date(Date.parse(tamperedTtl.updatedAt) + 1_001).toISOString();
  await fs.writeFile(replacementFile, `${JSON.stringify(tamperedTtl)}\n`, "utf8");
  await assert.rejects(
    replacementStore.observeSession(replacement.observation.sessionId),
    (error) => error instanceof GameSessionStoreError && error.code === "GAME_SESSION_INVALID"
  );

  const identityRoot = await temporaryDirectory(t);
  const identityStore = createGameSessionStore({
    rootDirectory: identityRoot,
    adapters: [identityAdapter("a"), identityAdapter("a_b")]
  });
  const identitySession = await identityStore.createSession("a_b");
  const identityFile = path.join(identityRoot, `${identitySession.observation.sessionId}.json`);
  const tamperedIdentity = JSON.parse(await fs.readFile(identityFile, "utf8"));
  tamperedIdentity.gameId = "a";
  await fs.writeFile(identityFile, `${JSON.stringify(tamperedIdentity)}\n`, "utf8");
  await assert.rejects(
    identityStore.observeSession(identitySession.observation.sessionId),
    (error) => error instanceof GameSessionStoreError && error.code === "GAME_SESSION_INVALID"
  );
});

test("game session count, state size, and idle TTL are bounded", async (t) => {
  const rootDirectory = await temporaryDirectory(t);
  let now = Date.parse("2026-08-06T00:00:00.000Z");
  const store = createGameSessionStore({
    rootDirectory,
    adapters: [create2048Adapter({ seedFactory: () => 987 })],
    maxSessions: 1,
    ttlMs: 100,
    clock: () => now
  });
  const created = await store.createSession("2048");
  await assert.rejects(
    store.createSession("2048"),
    (error) => error instanceof GameSessionStoreError && error.code === "GAME_SESSION_LIMIT_REACHED"
  );

  now += 101;
  assert.equal(await store.cleanupExpiredSessions(), 1);
  await assert.rejects(
    store.observeSession(created.observation.sessionId),
    (error) => error instanceof GameSessionStoreError && error.code === "GAME_SESSION_NOT_FOUND"
  );
  const replacement = await store.createSession("2048");
  assert.notEqual(replacement.observation.sessionId, created.observation.sessionId);

  const oversizedRoot = await temporaryDirectory(t);
  const oversizedStore = createGameSessionStore({
    rootDirectory: oversizedRoot,
    adapters: [oversizedAdapter()],
    maxStateBytes: 256
  });
  await assert.rejects(
    oversizedStore.createSession("oversized"),
    (error) => error?.code === "GAME_JSON_TOO_LARGE"
  );
});

async function readLockRecord(lockDirectory) {
  const names = await fs.readdir(lockDirectory);
  const ownerName = names.find((name) => name.startsWith("owner-") && name.endsWith(".json"));
  assert.ok(ownerName, `owner marker missing in ${lockDirectory}`);
  return JSON.parse(await fs.readFile(path.join(lockDirectory, ownerName), "utf8"));
}

function lockHeartbeatPath(lockDirectory, ownerToken) {
  return path.join(lockDirectory, `heartbeat-${ownerToken}.json`);
}

async function writeLockDirectory(lockDirectory, options) {
  await fs.mkdir(lockDirectory);
  const heartbeatName = `heartbeat-${options.ownerToken}.json`;
  const ownerRecord = {
    version: 2,
    ownerToken: options.ownerToken,
    processInstanceToken: options.processInstanceToken,
    pid: options.pid,
    acquiredAt: new Date(Date.now() - (options.heartbeatAgeMs || 0)).toISOString(),
    heartbeatFile: heartbeatName
  };
  const heartbeatRecord = {
    version: 2,
    ownerToken: options.ownerToken,
    processInstanceToken: options.processInstanceToken,
    pid: options.pid
  };
  await fs.writeFile(
    path.join(lockDirectory, `owner-${options.ownerToken}.json`),
    `${JSON.stringify(ownerRecord)}\n`,
    "utf8"
  );
  await fs.writeFile(
    path.join(lockDirectory, heartbeatName),
    `${JSON.stringify(heartbeatRecord)}\n`,
    "utf8"
  );
  if (options.retiring === true) {
    const retiringRecord = {
      version: 2,
      ownerToken: options.ownerToken,
      processInstanceToken: options.processInstanceToken,
      pid: options.pid,
      retiringAt: new Date().toISOString()
    };
    await fs.writeFile(
      path.join(lockDirectory, `retiring-${options.ownerToken}.json`),
      `${JSON.stringify(retiringRecord)}\n`,
      "utf8"
    );
  }
  if (options.heartbeatAgeMs) {
    const heartbeatTime = new Date(Date.now() - options.heartbeatAgeMs);
    await fs.utimes(path.join(lockDirectory, heartbeatName), heartbeatTime, heartbeatTime);
  }
}

async function directoryTree(directory) {
  const names = (await fs.readdir(directory)).sort();
  return Promise.all(names.map(async (name) => ({
    name,
    text: await fs.readFile(path.join(directory, name), "utf8")
  })));
}

async function assertPathMissing(target) {
  await assert.rejects(fs.access(target), (error) => error?.code === "ENOENT");
}

function filesystemError(code) {
  const error = new Error(`simulated ${code}`);
  error.code = code;
  return error;
}

async function temporaryDirectory(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "lusu-game-session-test-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return directory;
}

function oversizedAdapter() {
  const state = () => ({ revision: 0, padding: "x".repeat(400) });
  return Object.freeze({
    gameId: "oversized",
    create: state,
    restore: (value) => ({ ...value }),
    serialize: (value) => ({ ...value }),
    revision: (value) => value.revision,
    observe: () => ({ phase: "active", terminal: false, score: { current: 0 }, state: {} }),
    actions: () => [],
    normalizeAction: (action) => action,
    act: (value) => ({ status: "noop", reason: "no-change", state: value, events: [] })
  });
}

function largeReceiptAdapter() {
  const padding = "agent-receipt-integrity-".repeat(300);
  return Object.freeze({
    gameId: "large-receipt",
    create: () => ({ revision: 0 }),
    restore: (value) => ({ ...value }),
    serialize: (value) => ({ ...value }),
    revision: (value) => value.revision,
    observe: (value) => ({
      phase: "active",
      terminal: false,
      score: { current: value.revision },
      state: { padding }
    }),
    actions: () => [{ action: { type: "advance" }, label: "Advance" }],
    normalizeAction: (action) => action,
    act: (value) => ({
      status: "applied",
      reason: "advanced",
      state: { revision: value.revision + 1 },
      events: [{ type: "advanced", padding }]
    })
  });
}

function identityAdapter(gameId) {
  const state = () => ({ revision: 0 });
  return Object.freeze({
    gameId,
    create: state,
    restore: (value) => ({ ...value }),
    serialize: (value) => ({ ...value }),
    revision: (value) => value.revision,
    observe: () => ({ phase: "active", terminal: false, score: { current: 0 }, state: {} }),
    actions: () => [],
    normalizeAction: (action) => action,
    act: (value) => ({ status: "noop", reason: "no-change", state: value, events: [] })
  });
}

function deferred() {
  let resolve;
  const promise = new Promise((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}
