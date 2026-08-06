import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
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

  now += 601;
  await assert.rejects(
    store.observeSession(sessionId),
    (error) => error instanceof GameSessionStoreError && error.code === "GAME_SESSION_EXPIRED"
  );
  assert.equal(await fs.readFile(sessionFile, "utf8"), beforeText);
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

  const firstPromise = store.withLock(lockFile, async () => {
    firstEntered.resolve();
    await releaseFirst.promise;
  });

  try {
    await firstEntered.promise;
    const firstRecord = JSON.parse(await fs.readFile(lockFile, "utf8"));

    // Simulate a stale-owner takeover while the former holder is still unwinding.
    await fs.unlink(lockFile);
    secondPromise = store.withLock(lockFile, async () => {
      secondEntered.resolve();
      await releaseSecond.promise;
    });
    await secondEntered.promise;
    const secondRecord = JSON.parse(await fs.readFile(lockFile, "utf8"));
    assert.notEqual(secondRecord.ownerToken, firstRecord.ownerToken);

    releaseFirst.resolve();
    await firstPromise;
    assert.equal(JSON.parse(await fs.readFile(lockFile, "utf8")).ownerToken, secondRecord.ownerToken);

    const staleTime = new Date(Date.now() - 5_000);
    await fs.utimes(lockFile, staleTime, staleTime);
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

  await assert.rejects(fs.access(lockFile), (error) => error?.code === "ENOENT");
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
