import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
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

export const GAME_SESSION_STORE_VERSION = 1;
export const GAME_SESSION_DEDUPE_LIMIT = 128;
export const DEFAULT_GAME_SESSION_TTL_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_GAME_SESSION_LIMIT = 32;
export const DEFAULT_GAME_STATE_MAX_BYTES = 64 * 1024;
export const DEFAULT_GAME_SESSION_MAX_BYTES = 512 * 1024;

const MAX_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_LOCK_TIMEOUT_MS = 2_000;
const DEFAULT_STALE_LOCK_MS = 30_000;
const GAME_SESSION_LOCK_VERSION = 1;
const MAX_LOCK_FILE_BYTES = 4 * 1024;
const PROCESS_LOCK_TOKEN = randomUUID();

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
    if (typeof this.clock !== "function" || typeof this.randomUUID !== "function") {
      throw new GameSessionStoreError("The game session store dependencies are invalid.", "GAME_SESSION_OPTIONS_INVALID");
    }

    const suppliedAdapters = options.adapters || [game2048Adapter];
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
    return this.withLock(this.globalLockPath(), async () => {
      await this.cleanupExpiredUnlocked();
      const sessionFiles = await this.listSessionFiles();
      if (sessionFiles.length >= this.maxSessions) {
        throw new GameSessionStoreError("The local game session limit was reached.", "GAME_SESSION_LIMIT_REACHED");
      }

      let sessionId;
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const candidate = createGameSessionId(adapter.gameId, { randomUUID: this.randomUUID });
        if (!(await exists(this.sessionFilePath(candidate)))) {
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
      await this.writeSession(payload);
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
    return this.withSession(normalizedSessionId, async (payload, adapter) => {
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
        return deepFreezeJson({ ...cloneBoundedJson(prior.result), deduplicated: true });
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
        result
      });
      if (payload.dedupe.length > GAME_SESSION_DEDUPE_LIMIT) {
        payload.dedupe.splice(0, payload.dedupe.length - GAME_SESSION_DEDUPE_LIMIT);
      }
      this.touch(payload);
      await this.writeSession(payload);
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
    return this.withLock(this.sessionLockPath(normalizedSessionId), async () => {
      const payload = await this.readSession(normalizedSessionId, { removeExpired: true });
      await fs.unlink(this.sessionFilePath(normalizedSessionId)).catch((error) => {
        if (error?.code !== "ENOENT") throw error;
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
    return this.withLock(this.sessionLockPath(normalizedSessionId), async () => {
      const payload = await this.readSession(normalizedSessionId, { removeExpired: true });
      const adapter = this.getAdapter(payload.gameId);
      return callback(payload, adapter);
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
        await this.withLock(this.sessionLockPath(sessionId), async () => {
          let payload;
          try {
            payload = await this.readSession(sessionId, { allowExpired: true });
          } catch (error) {
            if (error?.code === "GAME_SESSION_NOT_FOUND") return;
            throw error;
          }
          if (this.isExpired(payload)) {
            await fs.unlink(this.sessionFilePath(sessionId)).catch((error) => {
              if (error?.code !== "ENOENT") throw error;
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
      stat = await fs.stat(file);
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
      payload = JSON.parse(await fs.readFile(file, "utf8"));
    } catch (error) {
      throw new GameSessionStoreError("The game session file contains invalid JSON.", "GAME_SESSION_INVALID", { cause: error });
    }
    this.validatePayload(payload, normalizedSessionId);
    if (this.isExpired(payload) && !options.allowExpired) {
      if (options.removeExpired) {
        await fs.unlink(file).catch((error) => {
          if (error?.code !== "ENOENT") throw error;
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
      const result = cloneBoundedJson(entry.result, {
        label: "deduplicated game result",
        maxBytes: 96 * 1024
      });
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

  async writeSession(payload) {
    this.validatePayloadForWrite(payload);
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
      handle = await fs.open(temporary, "wx", 0o600);
      await handle.writeFile(text, "utf8");
      await handle.sync();
      await handle.close();
      handle = null;
      await fs.rename(temporary, destination);
      await fs.chmod(destination, 0o600).catch(() => {});
    } catch (error) {
      await handle?.close().catch(() => {});
      await fs.unlink(temporary).catch(() => {});
      if (error instanceof GameSessionStoreError || error instanceof GameProtocolError) throw error;
      throw new GameSessionStoreError("The game session could not be written.", "GAME_SESSION_WRITE_FAILED", { cause: error });
    }
  }

  validatePayloadForWrite(payload) {
    const sessionId = normalizeGameSessionId(payload?.sessionId);
    this.validatePayload(payload, sessionId);
  }

  async listSessionFiles() {
    const entries = await fs.readdir(this.rootDirectory, { withFileTypes: true }).catch((error) => {
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
    await fs.mkdir(this.rootDirectory, { recursive: true, mode: 0o700 });
    await fs.chmod(this.rootDirectory, 0o700).catch(() => {});
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
    const ownerToken = randomUUID();
    let handle;
    while (!handle) {
      try {
        const candidate = await fs.open(lockFile, "wx", 0o600);
        try {
          const record = {
            version: GAME_SESSION_LOCK_VERSION,
            ownerToken,
            processToken: PROCESS_LOCK_TOKEN,
            pid: process.pid,
            acquiredAt: new Date().toISOString()
          };
          await candidate.writeFile(`${JSON.stringify(record)}\n`, "utf8");
          await candidate.sync();
          handle = candidate;
        } catch (error) {
          await candidate.close().catch(() => {});
          await this.releaseOwnedLock(lockFile, ownerToken);
          throw error;
        }
      } catch (error) {
        if (error?.code !== "EEXIST") {
          throw new GameSessionStoreError("The game session lock could not be created.", "GAME_SESSION_LOCK_FAILED", { cause: error });
        }
        const snapshot = await inspectLockFile(lockFile);
        if (snapshot && this.canTakeOverLock(snapshot)) {
          await removeStaleLock(lockFile, snapshot, this.staleLockMs);
          continue;
        }
        if (Date.now() - startedAt >= timeoutMs) {
          throw new GameSessionStoreError("The game session is busy.", "GAME_SESSION_LOCK_TIMEOUT");
        }
        await delay(20);
      }
    }
    const stopHeartbeat = startLockHeartbeat(handle, this.staleLockMs);
    try {
      return await callback();
    } finally {
      await stopHeartbeat();
      await handle.close().catch(() => {});
      await this.releaseOwnedLock(lockFile, ownerToken);
    }
  }

  canTakeOverLock(snapshot) {
    if (Date.now() - snapshot.mtimeMs <= this.staleLockMs) return false;
    if (!snapshot.record) return true;
    return !isLockOwnerAlive(snapshot.record);
  }

  async releaseOwnedLock(lockFile, ownerToken) {
    const snapshot = await inspectLockFile(lockFile);
    if (!snapshot || snapshot.record?.ownerToken !== ownerToken) return false;
    try {
      await fs.unlink(lockFile);
      return true;
    } catch (error) {
      if (error?.code === "ENOENT") return false;
      throw new GameSessionStoreError("The game session lock could not be released.", "GAME_SESSION_LOCK_FAILED", {
        cause: error
      });
    }
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

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function inspectLockFile(lockFile) {
  let stat;
  try {
    stat = await fs.stat(lockFile);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw new GameSessionStoreError("The game session lock could not be inspected.", "GAME_SESSION_LOCK_FAILED", {
      cause: error
    });
  }
  if (!stat.isFile() || stat.size < 2 || stat.size > MAX_LOCK_FILE_BYTES) {
    return {
      mtimeMs: stat.mtimeMs,
      signature: `invalid:${stat.size}`,
      record: null
    };
  }
  let text;
  try {
    text = await fs.readFile(lockFile, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw new GameSessionStoreError("The game session lock could not be read.", "GAME_SESSION_LOCK_FAILED", {
      cause: error
    });
  }
  return {
    mtimeMs: stat.mtimeMs,
    signature: createHash("sha256").update(text, "utf8").digest("hex"),
    record: parseLockRecord(text)
  };
}

function parseLockRecord(text) {
  let record;
  try {
    record = JSON.parse(text);
  } catch {
    return null;
  }
  if (
    !record
    || typeof record !== "object"
    || Array.isArray(record)
    || record.version !== GAME_SESSION_LOCK_VERSION
    || !isUuid(record.ownerToken)
    || !isUuid(record.processToken)
    || !Number.isSafeInteger(record.pid)
    || record.pid <= 0
    || typeof record.acquiredAt !== "string"
    || !Number.isFinite(Date.parse(record.acquiredAt))
  ) {
    return null;
  }
  return record;
}

function isUuid(value) {
  return /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(String(value || ""));
}

function isLockOwnerAlive(record) {
  if (record.pid === process.pid) {
    return record.processToken === PROCESS_LOCK_TOKEN;
  }
  try {
    process.kill(record.pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

async function removeStaleLock(lockFile, expected, staleLockMs) {
  const current = await inspectLockFile(lockFile);
  if (
    !current
    || current.signature !== expected.signature
    || current.record?.ownerToken !== expected.record?.ownerToken
    || Date.now() - current.mtimeMs <= staleLockMs
    || (current.record && isLockOwnerAlive(current.record))
  ) {
    return false;
  }
  try {
    await fs.unlink(lockFile);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw new GameSessionStoreError("The stale game session lock could not be removed.", "GAME_SESSION_LOCK_FAILED", {
      cause: error
    });
  }
}

function startLockHeartbeat(handle, staleLockMs) {
  const intervalMs = Math.max(100, Math.floor(staleLockMs / 3));
  let pending = Promise.resolve();
  const timer = setInterval(() => {
    pending = pending.then(async () => {
      const now = new Date();
      await handle.utimes(now, now);
    }).catch(() => {});
  }, intervalMs);
  timer.unref?.();
  return async () => {
    clearInterval(timer);
    await pending;
  };
}
