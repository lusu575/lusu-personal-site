import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { deflateRawSync, inflateRawSync } from "node:zlib";
import { resolveConfigDirectory } from "./local-state.mjs";
import {
  GAME_AGENT_PROTOCOL_VERSION,
  GameProtocolError,
  assertExactKeys,
  cloneBoundedJson,
  createGameActionResult,
  createGameActionsEnvelope,
  createGameObservationEnvelope,
  createGameSessionId,
  deepFreezeJson,
  normalizeClientActionId,
  normalizeGameActionRequest,
  normalizeGameId,
  normalizeGameRevision,
  normalizeGameSessionId
} from "./game-protocol.mjs";
import { game2048Adapter } from "./games/2048-adapter.mjs";
import { lifeRestartAdapter } from "./games/life-restart-adapter.mjs";

export const GAME_SESSION_STORE_VERSION = 1;
export const GAME_SESSION_DEDUPE_LIMIT = 128;
export const DEFAULT_GAME_SESSION_TTL_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_GAME_SESSION_LIMIT = 32;
export const DEFAULT_GAME_STATE_MAX_BYTES = 64 * 1024;
export const DEFAULT_GAME_SESSION_MAX_BYTES = 512 * 1024;

const MAX_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_LOCK_TIMEOUT_MS = 2_000;
const DEFAULT_STALE_LOCK_MS = 30_000;
const GAME_SESSION_LOCK_VERSION = 2;
const MAX_LOCK_FILE_BYTES = 4 * 1024;
const PROCESS_INSTANCE_TOKEN = randomUUID();
const LOCK_RETRY_DELAYS_MS = Object.freeze([0, 8, 16, 32, 64]);
const TRANSIENT_WINDOWS_FS_CODES = new Set(["EACCES", "EBUSY", "ENOTEMPTY", "EPERM"]);
const LOCK_OWNER_PREFIX = "owner-";
const LOCK_HEARTBEAT_PREFIX = "heartbeat-";
const LOCK_RETIRING_PREFIX = "retiring-";
const DEDUPE_RESULT_COMPRESSION_THRESHOLD = 4 * 1024;
const DEDUPE_RESULT_MAX_BYTES = 96 * 1024;
const DEDUPE_RESULT_ENCODING = "deflate-raw-base64-v1";

export class GameSessionStoreError extends Error {
  constructor(message, code = "GAME_SESSION_STORE_ERROR", options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = "GameSessionStoreError";
    this.code = code;
  }
}

export class GameSessionStore {
  constructor(options = {}) {
    this.rootDirectory = resolveSafeSessionDirectory(
      options.rootDirectory || path.join(resolveConfigDirectory(options), "game-sessions")
    );
    this.maxSessions = boundedInteger(options.maxSessions, DEFAULT_GAME_SESSION_LIMIT, 1, 128, "maxSessions");
    this.maxStateBytes = boundedInteger(options.maxStateBytes, DEFAULT_GAME_STATE_MAX_BYTES, 256, 256 * 1024, "maxStateBytes");
    this.maxSessionBytes = boundedInteger(
      options.maxSessionBytes,
      DEFAULT_GAME_SESSION_MAX_BYTES,
      4 * 1024,
      2 * 1024 * 1024,
      "maxSessionBytes"
    );
    this.ttlMs = boundedInteger(options.ttlMs, DEFAULT_GAME_SESSION_TTL_MS, 1, MAX_TTL_MS, "ttlMs");
    this.lockTimeoutMs = boundedInteger(options.lockTimeoutMs, DEFAULT_LOCK_TIMEOUT_MS, 50, 10_000, "lockTimeoutMs");
    this.staleLockMs = boundedInteger(options.staleLockMs, DEFAULT_STALE_LOCK_MS, 1_000, 120_000, "staleLockMs");
    this.clock = options.clock || (() => Date.now());
    this.randomUUID = options.randomUUID || randomUUID;
    this.fileSystem = options.fileSystem || fs;
    this.processId = boundedInteger(options.processId, process.pid, 1, 0x7fffffff, "processId");
    this.processInstanceToken = options.processInstanceToken || PROCESS_INSTANCE_TOKEN;
    this.processProbe = options.processProbe || probeProcess;
    this.lockTokenFactory = options.lockTokenFactory || randomUUID;
    if (
      typeof this.clock !== "function"
      || typeof this.randomUUID !== "function"
      || !this.fileSystem
      || typeof this.fileSystem !== "object"
      || !isUuid(this.processInstanceToken)
      || typeof this.processProbe !== "function"
      || typeof this.lockTokenFactory !== "function"
    ) {
      throw new GameSessionStoreError("The game session store dependencies are invalid.", "GAME_SESSION_OPTIONS_INVALID");
    }

    const suppliedAdapters = options.adapters || [game2048Adapter, lifeRestartAdapter];
    if (!Array.isArray(suppliedAdapters) || !suppliedAdapters.length) {
      throw new GameSessionStoreError("At least one game adapter is required.", "GAME_ADAPTER_REQUIRED");
    }
    this.adapters = new Map();
    for (const adapter of suppliedAdapters) {
      validateAdapter(adapter);
      const gameId = normalizeGameId(adapter.gameId);
      if (this.adapters.has(gameId)) {
        throw new GameSessionStoreError("Duplicate game adapter id.", "GAME_ADAPTER_DUPLICATE");
      }
      this.adapters.set(gameId, adapter);
    }
  }

  async createSession(gameId, createOptions = {}) {
    const adapter = this.getAdapter(gameId);
    await this.ensureDirectory();
    return this.withLock(this.globalLockPath(), async (lockOwner) => {
      await this.cleanupExpiredUnlocked();
      const sessionFiles = await this.listSessionFiles();
      if (sessionFiles.length >= this.maxSessions) {
        throw new GameSessionStoreError("The local game session limit was reached.", "GAME_SESSION_LIMIT_REACHED");
      }

      let sessionId;
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const candidate = createGameSessionId(adapter.gameId, { randomUUID: this.randomUUID });
        if (!(await exists(this.fileSystem, this.sessionFilePath(candidate)))) {
          sessionId = candidate;
          break;
        }
      }
      if (!sessionId) {
        throw new GameSessionStoreError("A unique game session id could not be created.", "GAME_SESSION_ID_COLLISION");
      }

      const state = adapter.restore(adapter.create(createOptions));
      const revision = normalizeGameRevision(adapter.revision(state));
      this.assertStateSize(state);
      const now = this.now();
      const payload = {
        version: GAME_SESSION_STORE_VERSION,
        protocolVersion: GAME_AGENT_PROTOCOL_VERSION,
        sessionId,
        gameId: adapter.gameId,
        revision,
        createdAt: new Date(now).toISOString(),
        updatedAt: new Date(now).toISOString(),
        expiresAt: new Date(now + this.ttlMs).toISOString(),
        state: adapter.serialize(state),
        dedupe: []
      };
      await this.writeSession(payload, { lockOwner });
      return deepFreezeJson({
        created: true,
        createdAt: payload.createdAt,
        expiresAt: payload.expiresAt,
        observation: this.observationFor(payload, adapter),
        actions: this.actionsFor(payload, adapter)
      });
    });
  }

  async observeSession(sessionId) {
    const { payload, adapter } = await this.readOnlySession(sessionId);
    return this.observationFor(payload, adapter);
  }

  async actionsForSession(sessionId) {
    const { payload, adapter } = await this.readOnlySession(sessionId);
    return this.actionsFor(payload, adapter);
  }

  async actSession(sessionId, request) {
    const normalizedSessionId = normalizeGameSessionId(sessionId);
    const normalizedRequest = normalizeGameActionRequest(request);
    return this.withSession(normalizedSessionId, async (payload, adapter, lockOwner) => {
      const normalizedAction = adapter.normalizeAction(normalizedRequest.action);
      const fingerprint = actionFingerprint({
        expectedRevision: normalizedRequest.expectedRevision,
        action: normalizedAction
      });
      const prior = payload.dedupe.find((entry) => entry.clientActionId === normalizedRequest.clientActionId);
      if (prior) {
        if (prior.fingerprint !== fingerprint) {
          throw new GameSessionStoreError(
            "The client action id was already used for a different request.",
            "GAME_CLIENT_ACTION_ID_REUSED"
          );
        }
        return deepFreezeJson({ ...decodeDedupeResult(prior.result), deduplicated: true });
      }

      const beforeRevision = payload.revision;
      let result;
      if (normalizedRequest.expectedRevision !== beforeRevision) {
        result = createGameActionResult({
          gameId: payload.gameId,
          sessionId: payload.sessionId,
          clientActionId: normalizedRequest.clientActionId,
          status: "rejected",
          reason: "revision-conflict",
          beforeRevision,
          revision: beforeRevision,
          deduplicated: false,
          events: [],
          observation: adapter.observe(payload.state)
        });
      } else {
        const outcome = adapter.act(payload.state, normalizedAction);
        const nextState = adapter.restore(outcome.state);
        const nextRevision = normalizeGameRevision(adapter.revision(nextState));
        if (outcome.status === "applied" ? nextRevision !== beforeRevision + 1 : nextRevision !== beforeRevision) {
          throw new GameSessionStoreError("The game adapter returned an invalid revision.", "GAME_ADAPTER_REVISION_INVALID");
        }
        this.assertStateSize(nextState);
        payload.state = adapter.serialize(nextState);
        payload.revision = nextRevision;
        result = createGameActionResult({
          gameId: payload.gameId,
          sessionId: payload.sessionId,
          clientActionId: normalizedRequest.clientActionId,
          status: outcome.status,
          reason: outcome.reason,
          beforeRevision,
          revision: nextRevision,
          deduplicated: false,
          events: outcome.events,
          observation: adapter.observe(nextState)
        });
      }

      payload.dedupe.push({
        clientActionId: normalizedRequest.clientActionId,
        fingerprint,
        result: encodeDedupeResult(result)
      });
      if (payload.dedupe.length > GAME_SESSION_DEDUPE_LIMIT) {
        payload.dedupe.splice(0, payload.dedupe.length - GAME_SESSION_DEDUPE_LIMIT);
      }
      this.touch(payload);
      await this.writeSession(payload, { lockOwner });
      return result;
    });
  }

  async closeSession(sessionId, options = {}) {
    const normalizedSessionId = normalizeGameSessionId(sessionId);
    if (options.confirm !== true) {
      throw new GameSessionStoreError(
        "Closing a game session requires explicit confirmation.",
        "GAME_SESSION_CLOSE_CONFIRMATION_REQUIRED"
      );
    }
    return this.withLock(this.sessionLockPath(normalizedSessionId), async (lockOwner) => {
      const payload = await this.readSession(normalizedSessionId, { removeExpired: true, lockOwner });
      await this.unlinkWithRetry(this.sessionFilePath(normalizedSessionId), {
        ignoreMissing: true,
        beforeAttempt: () => this.assertOwnedLock(lockOwner)
      });
      return deepFreezeJson({
        protocolVersion: GAME_AGENT_PROTOCOL_VERSION,
        gameId: payload.gameId,
        sessionId: normalizedSessionId,
        closed: true
      });
    });
  }

  async cleanupExpiredSessions() {
    await this.ensureDirectory();
    return this.withLock(this.globalLockPath(), () => this.cleanupExpiredUnlocked());
  }

  getAdapter(gameId) {
    const normalizedGameId = normalizeGameId(gameId);
    const adapter = this.adapters.get(normalizedGameId);
    if (!adapter) {
      throw new GameSessionStoreError("The game does not have a local adapter.", "GAME_ADAPTER_NOT_FOUND");
    }
    return adapter;
  }

  async withSession(sessionId, callback) {
    const normalizedSessionId = normalizeGameSessionId(sessionId);
    await this.ensureDirectory();
    return this.withLock(this.sessionLockPath(normalizedSessionId), async (lockOwner) => {
      const payload = await this.readSession(normalizedSessionId, { removeExpired: true, lockOwner });
      const adapter = this.getAdapter(payload.gameId);
      return callback(payload, adapter, lockOwner);
    });
  }

  async readOnlySession(sessionId) {
    const normalizedSessionId = normalizeGameSessionId(sessionId);
    const payload = await this.readSession(normalizedSessionId);
    return {
      payload,
      adapter: this.getAdapter(payload.gameId)
    };
  }

  observationFor(payload, adapter) {
    return createGameObservationEnvelope({
      gameId: payload.gameId,
      sessionId: payload.sessionId,
      revision: payload.revision,
      observation: adapter.observe(payload.state)
    });
  }

  actionsFor(payload, adapter) {
    return createGameActionsEnvelope({
      gameId: payload.gameId,
      sessionId: payload.sessionId,
      revision: payload.revision,
      actions: adapter.actions(payload.state)
    });
  }

  touch(payload) {
    const now = this.now();
    payload.updatedAt = new Date(now).toISOString();
    payload.expiresAt = new Date(now + this.ttlMs).toISOString();
  }

  async cleanupExpiredUnlocked() {
    let removed = 0;
    for (const file of await this.listSessionFiles()) {
      const sessionId = file.slice(0, -5);
      try {
        await this.withLock(this.sessionLockPath(sessionId), async (lockOwner) => {
          let payload;
          try {
            payload = await this.readSession(sessionId, { allowExpired: true });
          } catch (error) {
            if (error?.code === "GAME_SESSION_NOT_FOUND") return;
            throw error;
          }
          if (this.isExpired(payload)) {
            await this.unlinkWithRetry(this.sessionFilePath(sessionId), {
              ignoreMissing: true,
              beforeAttempt: () => this.assertOwnedLock(lockOwner)
            });
            removed += 1;
          }
        }, 50);
      } catch (error) {
        if (error?.code !== "GAME_SESSION_LOCK_TIMEOUT") throw error;
      }
    }
    return removed;
  }

  async readSession(sessionId, options = {}) {
    const normalizedSessionId = normalizeGameSessionId(sessionId);
    const file = this.sessionFilePath(normalizedSessionId);
    let stat;
    try {
      stat = await this.fileSystem.stat(file);
    } catch (error) {
      if (error?.code === "ENOENT") {
        throw new GameSessionStoreError("The game session was not found.", "GAME_SESSION_NOT_FOUND");
      }
      throw new GameSessionStoreError("The game session could not be inspected.", "GAME_SESSION_READ_FAILED", { cause: error });
    }
    if (!stat.isFile() || stat.size < 2 || stat.size > this.maxSessionBytes) {
      throw new GameSessionStoreError("The game session file is invalid or too large.", "GAME_SESSION_INVALID");
    }
    let payload;
    try {
      payload = JSON.parse(await this.fileSystem.readFile(file, "utf8"));
    } catch (error) {
      throw new GameSessionStoreError("The game session file contains invalid JSON.", "GAME_SESSION_INVALID", { cause: error });
    }
    this.validatePayload(payload, normalizedSessionId);
    if (this.isExpired(payload) && !options.allowExpired) {
      if (options.removeExpired) {
        await this.unlinkWithRetry(file, {
          ignoreMissing: true,
          beforeAttempt: () => this.assertOwnedLock(options.lockOwner)
        });
      }
      throw new GameSessionStoreError("The game session expired.", "GAME_SESSION_EXPIRED");
    }
    return payload;
  }

  validatePayload(payload, expectedSessionId) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new GameSessionStoreError("The game session payload is invalid.", "GAME_SESSION_INVALID");
    }
    if (
      payload.version !== GAME_SESSION_STORE_VERSION
      || payload.protocolVersion !== GAME_AGENT_PROTOCOL_VERSION
      || normalizeGameSessionId(payload.sessionId) !== expectedSessionId
    ) {
      throw new GameSessionStoreError("The game session version or identity is invalid.", "GAME_SESSION_INVALID");
    }
    const gameId = normalizeGameId(payload.gameId);
    const sessionPrefix = `game_${gameId}_`;
    const randomSessionPart = expectedSessionId.startsWith(sessionPrefix)
      ? expectedSessionId.slice(sessionPrefix.length)
      : "";
    if (payload.gameId !== gameId || !/^[a-f0-9]{24,64}$/.test(randomSessionPart)) {
      throw new GameSessionStoreError("The game session game identity is invalid.", "GAME_SESSION_INVALID");
    }
    const adapter = this.getAdapter(gameId);
    const state = adapter.restore(payload.state);
    const revision = normalizeGameRevision(payload.revision);
    if (adapter.revision(state) !== revision) {
      throw new GameSessionStoreError("The game session revision is inconsistent.", "GAME_SESSION_INVALID");
    }
    this.assertStateSize(state);
    const timestamps = {};
    for (const field of ["createdAt", "updatedAt", "expiresAt"]) {
      const timestamp = Date.parse(payload[field]);
      if (
        typeof payload[field] !== "string"
        || !Number.isFinite(timestamp)
        || new Date(timestamp).toISOString() !== payload[field]
      ) {
        throw new GameSessionStoreError("The game session timestamp is invalid.", "GAME_SESSION_INVALID");
      }
      timestamps[field] = timestamp;
    }
    if (
      timestamps.expiresAt <= timestamps.updatedAt
      || timestamps.expiresAt - timestamps.updatedAt > this.ttlMs
    ) {
      throw new GameSessionStoreError("The game session TTL is invalid.", "GAME_SESSION_INVALID");
    }
    if (!Array.isArray(payload.dedupe) || payload.dedupe.length > GAME_SESSION_DEDUPE_LIMIT) {
      throw new GameSessionStoreError("The game session dedupe history is invalid.", "GAME_SESSION_INVALID");
    }
    const ids = new Set();
    for (const entry of payload.dedupe) {
      let clientActionId;
      try {
        clientActionId = normalizeClientActionId(entry?.clientActionId);
      } catch (error) {
        throw new GameSessionStoreError("The game session dedupe entry is invalid.", "GAME_SESSION_INVALID", { cause: error });
      }
      if (
        !entry
        || typeof entry !== "object"
        || clientActionId !== entry.clientActionId
        || !/^[a-f0-9]{64}$/.test(String(entry.fingerprint || ""))
        || ids.has(clientActionId)
      ) {
        throw new GameSessionStoreError("The game session dedupe entry is invalid.", "GAME_SESSION_INVALID");
      }
      ids.add(clientActionId);
      const result = decodeDedupeResult(entry.result);
      try {
        assertExactKeys(result, [
          "protocolVersion",
          "gameId",
          "sessionId",
          "clientActionId",
          "status",
          "reason",
          "beforeRevision",
          "revision",
          "deduplicated",
          "events",
          "observation"
        ], "GAME_ACTION_RESULT_INVALID");
        const {
          protocolVersion: observationProtocolVersion,
          gameId: observationGameId,
          sessionId: observationSessionId,
          revision: observationRevision,
          ...observation
        } = result.observation || {};
        if (
          result.protocolVersion !== GAME_AGENT_PROTOCOL_VERSION
          || result.gameId !== payload.gameId
          || result.sessionId !== payload.sessionId
          || result.clientActionId !== clientActionId
          || result.deduplicated !== false
          || observationProtocolVersion !== GAME_AGENT_PROTOCOL_VERSION
          || observationGameId !== payload.gameId
          || observationSessionId !== payload.sessionId
          || observationRevision !== result.revision
        ) {
          throw new GameProtocolError("The stored game action result identity is invalid.", "GAME_ACTION_RESULT_INVALID");
        }
        createGameActionResult({
          gameId: result.gameId,
          sessionId: result.sessionId,
          clientActionId: result.clientActionId,
          status: result.status,
          reason: result.reason,
          beforeRevision: result.beforeRevision,
          revision: result.revision,
          deduplicated: result.deduplicated,
          events: result.events,
          observation
        });
      } catch (error) {
        throw new GameSessionStoreError("The game session dedupe result is invalid.", "GAME_SESSION_INVALID", { cause: error });
      }
    }
    payload.gameId = adapter.gameId;
    payload.revision = revision;
    payload.state = adapter.serialize(state);
  }

  assertStateSize(state) {
    cloneBoundedJson(state, {
      label: "game session state",
      maxBytes: this.maxStateBytes,
      maxDepth: 16,
      maxNodes: 10_000
    });
  }

  async writeSession(payload, options = {}) {
    this.validatePayloadForWrite(payload);
    if (!options.lockOwner) {
      throw new GameSessionStoreError("Writing a game session requires its active lock owner.", "GAME_SESSION_LOCK_REQUIRED");
    }
    const text = `${JSON.stringify(payload, null, 2)}\n`;
    if (Buffer.byteLength(text, "utf8") > this.maxSessionBytes) {
      throw new GameSessionStoreError("The game session exceeded its storage bound.", "GAME_SESSION_TOO_LARGE");
    }
    await this.ensureDirectory();
    const destination = this.sessionFilePath(payload.sessionId);
    const temporary = path.join(
      this.rootDirectory,
      `${payload.sessionId}.${String(this.randomUUID()).replace(/[^a-zA-Z0-9-]/g, "")}.tmp`
    );
    let handle;
    try {
      handle = await this.fileSystem.open(temporary, "wx", 0o600);
      await handle.writeFile(text, "utf8");
      await handle.sync();
      await handle.close();
      handle = null;
      await this.renameWithRetry(temporary, destination, {
        beforeAttempt: () => this.assertOwnedLock(options.lockOwner)
      });
      await this.fileSystem.chmod(destination, 0o600).catch(() => {});
      await syncDirectoryBestEffort(this.fileSystem, this.rootDirectory);
    } catch (error) {
      await handle?.close().catch(() => {});
      await this.unlinkWithRetry(temporary, { ignoreMissing: true }).catch(() => {});
      if (error instanceof GameSessionStoreError || error instanceof GameProtocolError) throw error;
      throw new GameSessionStoreError("The game session could not be written.", "GAME_SESSION_WRITE_FAILED", { cause: error });
    }
  }

  validatePayloadForWrite(payload) {
    const sessionId = normalizeGameSessionId(payload?.sessionId);
    this.validatePayload(payload, sessionId);
  }

  async listSessionFiles() {
    const entries = await this.fileSystem.readdir(this.rootDirectory, { withFileTypes: true }).catch((error) => {
      if (error?.code === "ENOENT") return [];
      throw error;
    });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => entry.name)
      .filter((name) => {
        try {
          normalizeGameSessionId(name.slice(0, -5));
          return true;
        } catch {
          return false;
        }
      });
  }

  isExpired(payload) {
    return Date.parse(payload.expiresAt) <= this.now();
  }

  now() {
    const value = Number(this.clock());
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new GameSessionStoreError("The game session clock returned an invalid value.", "GAME_SESSION_CLOCK_INVALID");
    }
    return value;
  }

  async ensureDirectory() {
    await this.fileSystem.mkdir(this.rootDirectory, { recursive: true, mode: 0o700 });
    await this.fileSystem.chmod(this.rootDirectory, 0o700).catch(() => {});
  }

  sessionFilePath(sessionId) {
    return path.join(this.rootDirectory, `${normalizeGameSessionId(sessionId)}.json`);
  }

  sessionLockPath(sessionId) {
    return path.join(this.rootDirectory, `${normalizeGameSessionId(sessionId)}.lock`);
  }

  globalLockPath() {
    return path.join(this.rootDirectory, ".create.lock");
  }

  async withLock(lockFile, callback, timeoutMs = this.lockTimeoutMs) {
    await this.ensureDirectory();
    const startedAt = Date.now();
    let owner = null;
    while (!owner) {
      owner = await this.tryAcquireLock(lockFile);
      if (owner) break;
      const snapshot = await inspectLockDirectory(this.fileSystem, lockFile);
      if (snapshot && await this.canTakeOverLock(snapshot)) {
        if (await this.recoverStaleLock(lockFile, snapshot)) continue;
      }
      if (Date.now() - startedAt >= timeoutMs) {
        throw new GameSessionStoreError("The game session is busy.", "GAME_SESSION_LOCK_TIMEOUT");
      }
      await delay(20);
    }

    const stopHeartbeat = startLockHeartbeat(owner, this.staleLockMs);
    try {
      return await callback(owner);
    } finally {
      await stopHeartbeat();
      await this.releaseOwnedLock(owner);
    }
  }

  async tryAcquireLock(lockFile) {
    const ownerToken = String(this.lockTokenFactory());
    if (!isUuid(ownerToken)) {
      throw new GameSessionStoreError("The lock token factory returned an invalid token.", "GAME_SESSION_LOCK_FAILED");
    }

    let directoryIdentity = null;
    let ownerHandle = null;
    let heartbeatHandle = null;
    const ownerName = `${LOCK_OWNER_PREFIX}${ownerToken}.json`;
    const heartbeatName = `${LOCK_HEARTBEAT_PREFIX}${ownerToken}.json`;
    try {
      await this.fileSystem.mkdir(lockFile, { mode: 0o700 });
    } catch (error) {
      if (error?.code === "EEXIST") return null;
      throw new GameSessionStoreError("The game session lock could not be created.", "GAME_SESSION_LOCK_FAILED", {
        cause: error
      });
    }

    try {
      const directoryStat = await this.fileSystem.lstat(lockFile, { bigint: true });
      directoryIdentity = statIdentity(directoryStat);
      if (!directoryStat.isDirectory() || !directoryIdentity) {
        throw new Error("The lock directory identity is unavailable.");
      }
      const acquiredAt = new Date().toISOString();
      const ownerRecord = {
        version: GAME_SESSION_LOCK_VERSION,
        ownerToken,
        processInstanceToken: this.processInstanceToken,
        pid: this.processId,
        acquiredAt,
        heartbeatFile: heartbeatName
      };
      const heartbeatRecord = {
        version: GAME_SESSION_LOCK_VERSION,
        ownerToken,
        processInstanceToken: this.processInstanceToken,
        pid: this.processId
      };
      ownerHandle = await this.fileSystem.open(path.join(lockFile, ownerName), "wx", 0o600);
      await ownerHandle.writeFile(`${JSON.stringify(ownerRecord)}\n`, "utf8");
      await ownerHandle.sync();
      await ownerHandle.close();
      ownerHandle = null;

      heartbeatHandle = await this.fileSystem.open(path.join(lockFile, heartbeatName), "wx", 0o600);
      await heartbeatHandle.writeFile(`${JSON.stringify(heartbeatRecord)}\n`, "utf8");
      await heartbeatHandle.sync();
      await this.fileSystem.chmod(lockFile, 0o700).catch(() => {});
      await syncDirectoryBestEffort(this.fileSystem, lockFile);

      const snapshot = await inspectLockDirectory(this.fileSystem, lockFile);
      if (
        !snapshot?.valid
        || snapshot.state !== "owned"
        || snapshot.record.ownerToken !== ownerToken
        || snapshot.record.processInstanceToken !== this.processInstanceToken
        || snapshot.record.pid !== this.processId
        || !sameIdentity(snapshot.directoryIdentity, directoryIdentity)
      ) {
        throw new Error("The completed lock marker could not be verified.");
      }
      const heartbeatStat = await heartbeatHandle.stat({ bigint: true });
      if (!sameIdentity(statIdentity(heartbeatStat), snapshot.heartbeat.identity)) {
        throw new Error("The heartbeat handle does not match the lock marker.");
      }
      return {
        lockFile,
        ownerToken,
        processInstanceToken: this.processInstanceToken,
        pid: this.processId,
        snapshot,
        heartbeatHandle
      };
    } catch (error) {
      await ownerHandle?.close().catch(() => {});
      await heartbeatHandle?.close().catch(() => {});
      await this.abandonIncompleteLock(lockFile, directoryIdentity, ownerToken);
      throw new GameSessionStoreError("The game session lock marker could not be initialized.", "GAME_SESSION_LOCK_FAILED", {
        cause: error
      });
    }
  }

  async canTakeOverLock(snapshot) {
    if (!snapshot?.valid || Date.now() - snapshot.heartbeat.mtimeMs <= this.staleLockMs) return false;
    return await this.lockOwnerStatus(snapshot.record) === "dead";
  }

  async lockOwnerStatus(record) {
    if (record.pid === this.processId) {
      return record.processInstanceToken === this.processInstanceToken ? "alive" : "dead";
    }
    try {
      const result = await this.processProbe(record.pid);
      if (result === true || result === "alive") return "alive";
      if (result === false || result === "dead") return "dead";
      return "unknown";
    } catch {
      return "unknown";
    }
  }

  async assertOwnedLock(owner, options = {}) {
    if (!owner || typeof owner !== "object" || !isUuid(owner.ownerToken)) {
      throw new GameSessionStoreError("The game session lock owner is missing.", "GAME_SESSION_LOCK_LOST");
    }
    const snapshot = await inspectLockDirectory(this.fileSystem, owner.lockFile);
    const allowedState = snapshot?.state === "owned" || (options.allowRetiring === true && snapshot?.state === "retiring");
    if (
      !snapshot?.valid
      || !allowedState
      || !sameLockOwnership(owner.snapshot, snapshot)
      || snapshot.record.ownerToken !== owner.ownerToken
      || snapshot.record.processInstanceToken !== owner.processInstanceToken
      || snapshot.record.pid !== owner.pid
    ) {
      throw new GameSessionStoreError("The game session lock ownership was lost.", "GAME_SESSION_LOCK_LOST");
    }
    if (owner.heartbeatHandle) {
      try {
        const heartbeatStat = await owner.heartbeatHandle.stat({ bigint: true });
        if (!sameIdentity(statIdentity(heartbeatStat), snapshot.heartbeat.identity)) {
          throw new Error("heartbeat identity changed");
        }
      } catch (error) {
        throw new GameSessionStoreError("The game session lock heartbeat was lost.", "GAME_SESSION_LOCK_LOST", {
          cause: error
        });
      }
    }
    return snapshot;
  }

  async recoverStaleLock(lockFile, expected) {
    const current = await inspectLockDirectory(this.fileSystem, lockFile);
    if (
      !current?.valid
      || !sameLockSnapshot(expected, current, { compareHeartbeatTime: true })
      || !await this.canTakeOverLock(current)
    ) {
      return false;
    }
    const privatePath = this.privateLockPath(lockFile, "recovering", current.record.ownerToken);
    const moved = await this.moveExactLockDirectory(lockFile, privatePath, current);
    if (!moved) return false;
    try {
      const retiring = await this.ensureRetiringMarker(privatePath, moved);
      await this.removePrivateLockDirectory(privatePath, retiring);
      return true;
    } catch (error) {
      throw new GameSessionStoreError("The stale game session lock could not be retired.", "GAME_SESSION_LOCK_FAILED", {
        cause: error
      });
    }
  }

  async releaseOwnedLock(owner) {
    let expected;
    try {
      expected = await this.assertOwnedLock(owner);
    } catch (error) {
      await owner?.heartbeatHandle?.close().catch(() => {});
      if (owner) owner.heartbeatHandle = null;
      if (error?.code === "GAME_SESSION_LOCK_LOST") return false;
      throw error;
    }
    await owner.heartbeatHandle?.close().catch(() => {});
    owner.heartbeatHandle = null;

    const privatePath = this.privateLockPath(owner.lockFile, "retiring", owner.ownerToken);
    const moved = await this.moveExactLockDirectory(owner.lockFile, privatePath, expected);
    if (!moved) return false;
    try {
      const retiring = await this.ensureRetiringMarker(privatePath, moved);
      await this.removePrivateLockDirectory(privatePath, retiring);
      return true;
    } catch (error) {
      throw new GameSessionStoreError("The game session lock could not be released.", "GAME_SESSION_LOCK_FAILED", {
        cause: error
      });
    }
  }

  privateLockPath(lockFile, phase, ownerToken) {
    const nonce = String(this.lockTokenFactory());
    if (!isUuid(nonce)) {
      throw new GameSessionStoreError("The lock token factory returned an invalid token.", "GAME_SESSION_LOCK_FAILED");
    }
    return `${lockFile}.${phase}-${ownerToken}-${nonce}`;
  }

  async moveExactLockDirectory(source, destination, expected) {
    try {
      await this.renameWithRetry(source, destination, {
        beforeAttempt: async () => {
          const current = await inspectLockDirectory(this.fileSystem, source);
          if (!current?.valid || !sameLockSnapshot(expected, current, { compareHeartbeatTime: true })) {
            throw new GameSessionStoreError("The game session lock changed before retirement.", "GAME_SESSION_LOCK_LOST");
          }
        }
      });
    } catch (error) {
      if (error?.code === "ENOENT" || error?.code === "GAME_SESSION_LOCK_LOST") return null;
      throw error;
    }

    const moved = await inspectLockDirectory(this.fileSystem, destination);
    if (moved?.valid && sameLockSnapshot(expected, moved, { compareHeartbeatTime: true })) return moved;
    await this.restoreMovedLockDirectory(destination, source);
    return null;
  }

  async restoreMovedLockDirectory(privatePath, publicPath) {
    try {
      await this.fileSystem.access(publicPath);
      return false;
    } catch (error) {
      if (error?.code !== "ENOENT") return false;
    }
    try {
      await this.renameWithRetry(privatePath, publicPath);
      return true;
    } catch {
      return false;
    }
  }

  async ensureRetiringMarker(lockDirectory, snapshot) {
    if (snapshot.state === "retiring") return snapshot;
    const name = `${LOCK_RETIRING_PREFIX}${snapshot.record.ownerToken}.json`;
    const record = {
      version: GAME_SESSION_LOCK_VERSION,
      ownerToken: snapshot.record.ownerToken,
      processInstanceToken: snapshot.record.processInstanceToken,
      pid: snapshot.record.pid,
      retiringAt: new Date().toISOString()
    };
    let handle;
    try {
      handle = await this.fileSystem.open(path.join(lockDirectory, name), "wx", 0o600);
      await handle.writeFile(`${JSON.stringify(record)}\n`, "utf8");
      await handle.sync();
      await handle.close();
      handle = null;
      await syncDirectoryBestEffort(this.fileSystem, lockDirectory);
    } finally {
      await handle?.close().catch(() => {});
    }
    const retiring = await inspectLockDirectory(this.fileSystem, lockDirectory);
    if (
      !retiring?.valid
      || retiring.state !== "retiring"
      || !sameLockOwnership(snapshot, retiring)
      || retiring.retiring.record.ownerToken !== snapshot.record.ownerToken
    ) {
      throw new GameSessionStoreError("The retiring lock marker could not be verified.", "GAME_SESSION_LOCK_LOST");
    }
    return retiring;
  }

  async removePrivateLockDirectory(lockDirectory, snapshot) {
    if (!snapshot?.valid || snapshot.state !== "retiring") {
      throw new GameSessionStoreError("The private lock is not in a retiring state.", "GAME_SESSION_LOCK_LOST");
    }
    for (const entry of [snapshot.retiring, snapshot.heartbeat, snapshot.owner]) {
      await this.unlinkExactLockEntry(lockDirectory, entry);
    }
    await this.retryFsOperation("rmdir", () => this.fileSystem.rmdir(lockDirectory));
  }

  async unlinkExactLockEntry(lockDirectory, expected) {
    const file = path.join(lockDirectory, expected.name);
    const current = await readStableFileSnapshot(this.fileSystem, file);
    if (!current || !sameFileSnapshot(expected, current)) {
      throw new GameSessionStoreError("A private lock marker changed before removal.", "GAME_SESSION_LOCK_LOST");
    }
    await this.unlinkWithRetry(file);
  }

  async abandonIncompleteLock(lockFile, directoryIdentity, ownerToken) {
    if (!directoryIdentity || !isUuid(ownerToken)) return false;
    let privatePath;
    try {
      privatePath = this.privateLockPath(lockFile, "abandoned", ownerToken);
      await this.renameWithRetry(lockFile, privatePath, {
        beforeAttempt: async () => {
          const stat = await this.fileSystem.lstat(lockFile, { bigint: true });
          if (!stat.isDirectory() || !sameIdentity(statIdentity(stat), directoryIdentity)) {
            throw new GameSessionStoreError("The incomplete lock directory was replaced.", "GAME_SESSION_LOCK_LOST");
          }
        }
      });
      const stat = await this.fileSystem.lstat(privatePath, { bigint: true });
      if (!stat.isDirectory() || !sameIdentity(statIdentity(stat), directoryIdentity)) {
        await this.restoreMovedLockDirectory(privatePath, lockFile);
        return false;
      }
      const allowedNames = new Set([
        `${LOCK_OWNER_PREFIX}${ownerToken}.json`,
        `${LOCK_HEARTBEAT_PREFIX}${ownerToken}.json`
      ]);
      const names = await this.fileSystem.readdir(privatePath);
      if (names.some((name) => !allowedNames.has(name))) return false;
      for (const name of names) {
        const entry = await readStableFileSnapshot(this.fileSystem, path.join(privatePath, name));
        if (!entry) return false;
        await this.unlinkExactLockEntry(privatePath, { ...entry, name });
      }
      await this.retryFsOperation("rmdir", () => this.fileSystem.rmdir(privatePath));
      return true;
    } catch {
      return false;
    }
  }

  async renameWithRetry(source, destination, options = {}) {
    return this.retryFsOperation("rename", () => this.fileSystem.rename(source, destination), options);
  }

  async unlinkWithRetry(file, options = {}) {
    try {
      return await this.retryFsOperation("unlink", () => this.fileSystem.unlink(file), options);
    } catch (error) {
      if (options.ignoreMissing === true && error?.code === "ENOENT") return false;
      throw error;
    }
  }

  async retryFsOperation(label, operation, options = {}) {
    let lastError;
    for (let attempt = 0; attempt < LOCK_RETRY_DELAYS_MS.length; attempt += 1) {
      if (attempt > 0) await delay(LOCK_RETRY_DELAYS_MS[attempt]);
      await options.beforeAttempt?.(attempt);
      try {
        return await operation(attempt);
      } catch (error) {
        lastError = error;
        if (!TRANSIENT_WINDOWS_FS_CODES.has(error?.code) || attempt === LOCK_RETRY_DELAYS_MS.length - 1) {
          throw error;
        }
      }
    }
    throw new GameSessionStoreError(`The ${label} filesystem operation did not complete.`, "GAME_SESSION_LOCK_FAILED", {
      cause: lastError
    });
  }
}

export function createGameSessionStore(options = {}) {
  return new GameSessionStore(options);
}

function validateAdapter(adapter) {
  const methods = ["create", "restore", "serialize", "revision", "observe", "actions", "normalizeAction", "act"];
  if (!adapter || typeof adapter !== "object" || methods.some((method) => typeof adapter[method] !== "function")) {
    throw new GameSessionStoreError("The game adapter contract is invalid.", "GAME_ADAPTER_INVALID");
  }
  normalizeGameId(adapter.gameId);
}

function resolveSafeSessionDirectory(value) {
  const directory = path.resolve(String(value || ""));
  if (!directory || directory === path.parse(directory).root) {
    throw new GameSessionStoreError("The game session directory is unsafe.", "GAME_SESSION_DIRECTORY_INVALID");
  }
  return directory;
}

function boundedInteger(value, fallback, minimum, maximum, label) {
  const numeric = value === undefined ? fallback : Number(value);
  if (!Number.isSafeInteger(numeric) || numeric < minimum || numeric > maximum) {
    throw new GameSessionStoreError(`${label} is outside its supported bound.`, "GAME_SESSION_OPTIONS_INVALID");
  }
  return numeric;
}

function actionFingerprint(value) {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

function encodeDedupeResult(value) {
  const result = cloneBoundedJson(value, {
    label: "deduplicated game result",
    maxBytes: DEDUPE_RESULT_MAX_BYTES
  });
  const raw = Buffer.from(JSON.stringify(result), "utf8");
  if (raw.byteLength < DEDUPE_RESULT_COMPRESSION_THRESHOLD) return result;
  const compressed = deflateRawSync(raw, { level: 9 });
  if (compressed.byteLength >= raw.byteLength) return result;
  return {
    encoding: DEDUPE_RESULT_ENCODING,
    rawBytes: raw.byteLength,
    sha256: createHash("sha256").update(raw).digest("hex"),
    data: compressed.toString("base64")
  };
}

function decodeDedupeResult(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) || value.encoding !== DEDUPE_RESULT_ENCODING) {
    return cloneBoundedJson(value, {
      label: "deduplicated game result",
      maxBytes: DEDUPE_RESULT_MAX_BYTES
    });
  }
  try {
    assertExactKeys(
      value,
      ["encoding", "rawBytes", "sha256", "data"],
      "GAME_ACTION_RESULT_INVALID"
    );
    if (
      !Number.isSafeInteger(value.rawBytes)
      || value.rawBytes < 2
      || value.rawBytes > DEDUPE_RESULT_MAX_BYTES
      || !/^[a-f0-9]{64}$/.test(value.sha256)
      || typeof value.data !== "string"
      || value.data.length < 4
      || value.data.length > Math.ceil(DEDUPE_RESULT_MAX_BYTES * 4 / 3) + 4
    ) {
      throw new Error("compressed receipt metadata is invalid");
    }
    const compressed = Buffer.from(value.data, "base64");
    if (!compressed.byteLength || compressed.toString("base64") !== value.data) {
      throw new Error("compressed receipt encoding is invalid");
    }
    const raw = inflateRawSync(compressed, { maxOutputLength: value.rawBytes });
    if (
      raw.byteLength !== value.rawBytes
      || createHash("sha256").update(raw).digest("hex") !== value.sha256
    ) {
      throw new Error("compressed receipt integrity is invalid");
    }
    return cloneBoundedJson(JSON.parse(raw.toString("utf8")), {
      label: "deduplicated game result",
      maxBytes: DEDUPE_RESULT_MAX_BYTES
    });
  } catch (error) {
    throw new GameSessionStoreError(
      "The game session dedupe result is invalid.",
      "GAME_SESSION_INVALID",
      { cause: error }
    );
  }
}

async function exists(fileSystem, file) {
  try {
    await fileSystem.access(file);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function inspectLockDirectory(fileSystem, lockDirectory) {
  let beforeStat;
  try {
    beforeStat = await fileSystem.lstat(lockDirectory, { bigint: true });
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw new GameSessionStoreError("The game session lock could not be inspected.", "GAME_SESSION_LOCK_FAILED", {
      cause: error
    });
  }
  const directoryIdentity = statIdentity(beforeStat);
  if (!beforeStat.isDirectory() || !directoryIdentity) {
    return { valid: false, reason: "not-a-directory", directoryIdentity };
  }

  let names;
  try {
    names = (await fileSystem.readdir(lockDirectory)).sort();
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw new GameSessionStoreError("The game session lock directory could not be read.", "GAME_SESSION_LOCK_FAILED", {
      cause: error
    });
  }
  const ownerNames = names.filter((name) => lockEntryToken(name, LOCK_OWNER_PREFIX));
  const heartbeatNames = names.filter((name) => lockEntryToken(name, LOCK_HEARTBEAT_PREFIX));
  const retiringNames = names.filter((name) => lockEntryToken(name, LOCK_RETIRING_PREFIX));
  if (
    ownerNames.length !== 1
    || heartbeatNames.length !== 1
    || retiringNames.length > 1
    || names.length !== 2 + retiringNames.length
  ) {
    return { valid: false, reason: "marker-set-invalid", directoryIdentity };
  }

  const ownerName = ownerNames[0];
  const heartbeatName = heartbeatNames[0];
  const retiringName = retiringNames[0] || null;
  const owner = await readStableFileSnapshot(fileSystem, path.join(lockDirectory, ownerName));
  const heartbeat = await readStableFileSnapshot(fileSystem, path.join(lockDirectory, heartbeatName), {
    allowMtimeChange: true
  });
  const retiring = retiringName
    ? await readStableFileSnapshot(fileSystem, path.join(lockDirectory, retiringName))
    : null;
  if (!owner || !heartbeat || (retiringName && !retiring)) {
    return { valid: false, reason: "marker-unstable", directoryIdentity };
  }
  owner.name = ownerName;
  heartbeat.name = heartbeatName;
  if (retiring) retiring.name = retiringName;

  const record = parseOwnerRecord(owner.text);
  const heartbeatRecord = parseHeartbeatRecord(heartbeat.text);
  const retiringRecord = retiring ? parseRetiringRecord(retiring.text) : null;
  const token = record?.ownerToken;
  if (
    !record
    || !heartbeatRecord
    || lockEntryToken(ownerName, LOCK_OWNER_PREFIX) !== token
    || lockEntryToken(heartbeatName, LOCK_HEARTBEAT_PREFIX) !== token
    || record.heartbeatFile !== heartbeatName
    || heartbeatRecord.ownerToken !== token
    || heartbeatRecord.processInstanceToken !== record.processInstanceToken
    || heartbeatRecord.pid !== record.pid
    || (retiringName && lockEntryToken(retiringName, LOCK_RETIRING_PREFIX) !== token)
    || (retiringName && (
      !retiringRecord
      || retiringRecord.ownerToken !== token
      || retiringRecord.processInstanceToken !== record.processInstanceToken
      || retiringRecord.pid !== record.pid
    ))
  ) {
    return { valid: false, reason: "marker-record-invalid", directoryIdentity };
  }

  let afterStat;
  try {
    afterStat = await fileSystem.lstat(lockDirectory, { bigint: true });
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
  if (!afterStat.isDirectory() || !sameIdentity(directoryIdentity, statIdentity(afterStat))) {
    return { valid: false, reason: "directory-replaced", directoryIdentity };
  }

  owner.record = record;
  heartbeat.record = heartbeatRecord;
  if (retiring) retiring.record = retiringRecord;
  return {
    valid: true,
    state: retiring ? "retiring" : "owned",
    directoryIdentity,
    record,
    owner,
    heartbeat,
    retiring
  };
}

async function readStableFileSnapshot(fileSystem, file, options = {}) {
  let handle;
  try {
    handle = await fileSystem.open(file, "r");
    const before = await handle.stat({ bigint: true });
    if (!before.isFile() || before.size < 2n || before.size > BigInt(MAX_LOCK_FILE_BYTES)) return null;
    const identity = statIdentity(before);
    if (!identity) return null;
    const text = await handle.readFile("utf8");
    const after = await handle.stat({ bigint: true });
    const pathStat = await fileSystem.lstat(file, { bigint: true });
    if (
      !after.isFile()
      || !pathStat.isFile()
      || !sameIdentity(identity, statIdentity(after))
      || !sameIdentity(identity, statIdentity(pathStat))
      || before.size !== after.size
      || (options.allowMtimeChange !== true && (
        before.mtimeNs !== after.mtimeNs
        || after.mtimeNs !== pathStat.mtimeNs
      ))
    ) {
      return null;
    }
    return {
      identity,
      text,
      hash: createHash("sha256").update(text, "utf8").digest("hex"),
      mtimeNs: String(pathStat.mtimeNs),
      mtimeMs: Number(pathStat.mtimeMs)
    };
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw new GameSessionStoreError("A game session lock marker could not be inspected.", "GAME_SESSION_LOCK_FAILED", {
      cause: error
    });
  } finally {
    await handle?.close().catch(() => {});
  }
}

function parseOwnerRecord(text) {
  const record = parseJsonObject(text);
  if (
    !hasExactKeys(record, [
      "version",
      "ownerToken",
      "processInstanceToken",
      "pid",
      "acquiredAt",
      "heartbeatFile"
    ])
    || record.version !== GAME_SESSION_LOCK_VERSION
    || !isUuid(record.ownerToken)
    || !isUuid(record.processInstanceToken)
    || !isPid(record.pid)
    || !isCanonicalIso(record.acquiredAt)
    || record.heartbeatFile !== `${LOCK_HEARTBEAT_PREFIX}${record.ownerToken}.json`
  ) {
    return null;
  }
  return record;
}

function parseHeartbeatRecord(text) {
  const record = parseJsonObject(text);
  if (
    !hasExactKeys(record, ["version", "ownerToken", "processInstanceToken", "pid"])
    || record.version !== GAME_SESSION_LOCK_VERSION
    || !isUuid(record.ownerToken)
    || !isUuid(record.processInstanceToken)
    || !isPid(record.pid)
  ) {
    return null;
  }
  return record;
}

function parseRetiringRecord(text) {
  const record = parseJsonObject(text);
  if (
    !hasExactKeys(record, ["version", "ownerToken", "processInstanceToken", "pid", "retiringAt"])
    || record.version !== GAME_SESSION_LOCK_VERSION
    || !isUuid(record.ownerToken)
    || !isUuid(record.processInstanceToken)
    || !isPid(record.pid)
    || !isCanonicalIso(record.retiringAt)
  ) {
    return null;
  }
  return record;
}

function parseJsonObject(text) {
  try {
    const value = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

function hasExactKeys(value, keys) {
  if (!value) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function isCanonicalIso(value) {
  const timestamp = Date.parse(value);
  return typeof value === "string" && Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function isPid(value) {
  return Number.isSafeInteger(value) && value > 0 && value <= 0x7fffffff;
}

function lockEntryToken(name, prefix) {
  if (typeof name !== "string" || !name.startsWith(prefix) || !name.endsWith(".json")) return null;
  const token = name.slice(prefix.length, -5);
  return isUuid(token) ? token : null;
}

function statIdentity(stat) {
  if (!stat || typeof stat.dev !== "bigint" || typeof stat.ino !== "bigint" || stat.ino === 0n) return null;
  return Object.freeze({
    dev: String(stat.dev),
    ino: String(stat.ino),
    birthtimeNs: typeof stat.birthtimeNs === "bigint" ? String(stat.birthtimeNs) : ""
  });
}

function sameIdentity(left, right) {
  return Boolean(
    left
    && right
    && left.dev === right.dev
    && left.ino === right.ino
    && left.birthtimeNs === right.birthtimeNs
  );
}

function sameFileSnapshot(left, right) {
  return Boolean(
    left
    && right
    && sameIdentity(left.identity, right.identity)
    && left.hash === right.hash
  );
}

function sameLockOwnership(left, right) {
  return Boolean(
    left?.valid
    && right?.valid
    && left.record.ownerToken === right.record.ownerToken
    && left.record.processInstanceToken === right.record.processInstanceToken
    && left.record.pid === right.record.pid
    && sameIdentity(left.directoryIdentity, right.directoryIdentity)
    && sameFileSnapshot(left.owner, right.owner)
    && sameFileSnapshot(left.heartbeat, right.heartbeat)
  );
}

function sameLockSnapshot(left, right, options = {}) {
  if (!sameLockOwnership(left, right) || left.state !== right.state) return false;
  if (Boolean(left.retiring) !== Boolean(right.retiring)) return false;
  if (left.retiring && !sameFileSnapshot(left.retiring, right.retiring)) return false;
  return options.compareHeartbeatTime !== true || left.heartbeat.mtimeNs === right.heartbeat.mtimeNs;
}

function isUuid(value) {
  return /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(String(value || ""));
}

function probeProcess(pid) {
  try {
    process.kill(pid, 0);
    return "alive";
  } catch (error) {
    return error?.code === "ESRCH" ? "dead" : "unknown";
  }
}

async function syncDirectoryBestEffort(fileSystem, directory) {
  let handle;
  try {
    handle = await fileSystem.open(directory, "r");
    await handle.sync();
  } catch {
    // Directory fsync is not supported by every Windows filesystem/runtime.
  } finally {
    await handle?.close().catch(() => {});
  }
}

function startLockHeartbeat(owner, staleLockMs) {
  const intervalMs = Math.max(100, Math.floor(staleLockMs / 3));
  let pending = Promise.resolve();
  const timer = setInterval(() => {
    pending = pending.then(async () => {
      const now = new Date();
      await owner.heartbeatHandle?.utimes(now, now);
    }).catch(() => {});
  }, intervalMs);
  timer.unref?.();
  return async () => {
    clearInterval(timer);
    await pending;
  };
}
