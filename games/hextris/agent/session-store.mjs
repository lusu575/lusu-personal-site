// SPDX-License-Identifier: GPL-3.0-or-later

import { createHash, randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import {
  applyHextrisAction,
  createHextrisState,
  listHextrisActions,
  normalizeHextrisAction,
  observeHextrisState,
  restoreHextrisState,
  serializeHextrisState
} from "./engine.mjs";

export const HEXTRIS_SESSION_ID_PATTERN = /^hextris_[a-f0-9]{32}$/;
export const HEXTRIS_CLIENT_ACTION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
export const HEXTRIS_AGENT_STATE_VERSION = 1;
export const HEXTRIS_AGENT_MAX_SESSIONS = 32;
export const HEXTRIS_AGENT_IDLE_TTL_MS = 24 * 60 * 60 * 1000;
export const HEXTRIS_AGENT_MAX_STATE_BYTES = 256 * 1024;
export const HEXTRIS_AGENT_MAX_RECEIPTS = 128;

const GAME_ID = "hextris";
const SESSION_FILENAME_PATTERN = /^(hextris_[a-f0-9]{32})\.json$/;
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const OWNER_TOKEN_PATTERN = /^[a-f0-9]{32}$/;
const OWNER_MARKER_PATTERN = /^owner-([a-f0-9]{32})\.json$/;
const RETIRING_MARKER_PATTERN = /^retiring-([a-f0-9]{32})\.json$/;
const PROCESS_INSTANCE_TOKEN = randomBytes(16).toString("hex");
const LOCAL_RETIRING_OWNER_TOKENS = new Set();
const LOCAL_ABANDONED_OWNERS = new Map();
const MAX_LOCAL_ABANDONED_OWNERS = 256;
const MAX_SESSION_FILE_BYTES = 1024 * 1024;
const DEFAULT_LOCK_WAIT_MS = 2_000;
const DEFAULT_LOCK_POLL_MS = 20;
const DEFAULT_LOCK_STALE_MS = 30_000;
const LOCK_MARKER_TRANSITION_WAIT_MS = 500;
const MAX_REVISION = 1_000_000_000;

export class HextrisSessionStoreError extends Error {
  constructor(message, code = "HEXTRIS_SESSION_ERROR", options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = "HextrisSessionStoreError";
    this.code = code;
    if (options.currentRevision !== undefined) this.currentRevision = options.currentRevision;
  }
}

export function createHextrisSessionStore(options = {}) {
  return new HextrisSessionStore(options);
}

export class HextrisSessionStore {
  constructor(options = {}) {
    this.env = options.env || process.env;
    this.rootDir = resolveHextrisAgentDirectory({
      env: this.env,
      rootDir: options.rootDir,
      homeDir: options.homeDir,
      platform: options.platform
    });
    this.now = typeof options.now === "function" ? options.now : Date.now;
    this.randomBytes = typeof options.randomBytes === "function" ? options.randomBytes : randomBytes;
    this.maxSessions = boundedOption(
      options.maxSessions,
      1,
      HEXTRIS_AGENT_MAX_SESSIONS,
      HEXTRIS_AGENT_MAX_SESSIONS,
      "maxSessions"
    );
    this.idleTtlMs = boundedOption(
      options.idleTtlMs,
      1,
      HEXTRIS_AGENT_IDLE_TTL_MS,
      HEXTRIS_AGENT_IDLE_TTL_MS,
      "idleTtlMs"
    );
    this.lockWaitMs = boundedOption(options.lockWaitMs, 1, 60_000, DEFAULT_LOCK_WAIT_MS, "lockWaitMs");
    this.lockPollMs = boundedOption(options.lockPollMs, 1, 1_000, DEFAULT_LOCK_POLL_MS, "lockPollMs");
    this.lockStaleMs = boundedOption(options.lockStaleMs, 4, 10 * 60_000, DEFAULT_LOCK_STALE_MS, "lockStaleMs");
  }

  async createSession(options = {}) {
    const createOptions = normalizeCreateOptions(options);
    await this.ensureRoot();
    return this.withLock(path.join(this.rootDir, ".sessions.lock"), async (lock) => {
      await this.cleanupExpiredSessions();
      const existing = await this.listSessionIds();
      if (existing.length >= this.maxSessions) {
        throw new HextrisSessionStoreError(
          "The local Hextris session limit has been reached.",
          "HEXTRIS_SESSION_LIMIT"
        );
      }

      const sessionId = await this.createUniqueSessionId();
      const state = restoreHextrisState(createHextrisState(createOptions));
      const serializedState = cloneAndBoundState(serializeHextrisState(state));
      const nowMs = this.currentTime();
      const payload = {
        version: HEXTRIS_AGENT_STATE_VERSION,
        sessionId,
        gameId: GAME_ID,
        createdAtMs: nowMs,
        updatedAtMs: nowMs,
        expiresAtMs: nowMs + this.idleTtlMs,
        state: serializedState,
        receipts: []
      };
      await this.writeSession(payload, lock.assertOwned);
      return this.createSnapshot(payload, state, { includeActions: true });
    });
  }

  async observeSession(sessionId) {
    const normalizedId = normalizeSessionId(sessionId);
    const { payload, state } = await this.readSession(normalizedId);
    return this.createObservationEnvelope(payload, state);
  }

  async actionsForSession(sessionId) {
    const normalizedId = normalizeSessionId(sessionId);
    const { payload, state } = await this.readSession(normalizedId);
    return {
      gameId: GAME_ID,
      sessionId: payload.sessionId,
      revision: stateRevision(state),
      actions: cloneJson(listHextrisActions(state), "Hextris action list")
    };
  }

  async actSession(sessionId, request) {
    const normalizedId = normalizeSessionId(sessionId);
    const normalizedRequest = normalizeActionRequest(request);
    await this.ensureRoot();
    return this.withLock(this.lockPath(normalizedId), async (lock) => {
      let record;
      try {
        record = await this.readSession(normalizedId, { allowExpired: true });
      } catch (error) {
        if (error instanceof HextrisSessionStoreError && error.code === "HEXTRIS_SESSION_NOT_FOUND") throw error;
        throw error;
      }
      const { payload, state } = record;
      const nowMs = this.currentTime();
      if (payload.expiresAtMs <= nowMs) {
        await lock.assertOwned();
        await this.removeSessionFile(normalizedId);
        throw new HextrisSessionStoreError(
          "The local Hextris session has expired.",
          "HEXTRIS_SESSION_EXPIRED"
        );
      }

      const payloadHash = actionPayloadHash(normalizedRequest);
      const existingReceipt = payload.receipts.find(
        (receipt) => receipt.clientActionId === normalizedRequest.clientActionId
      );
      if (existingReceipt) {
        if (existingReceipt.payloadHash !== payloadHash) {
          throw new HextrisSessionStoreError(
            "The client action id was already used for a different Hextris request.",
            "HEXTRIS_ACTION_ID_CONFLICT"
          );
        }
        return { ...cloneJson(existingReceipt.result, "Hextris action receipt"), deduplicated: true };
      }

      const beforeRevision = stateRevision(state);
      if (normalizedRequest.expectedRevision !== beforeRevision) {
        throw new HextrisSessionStoreError(
          "The Hextris session revision has changed.",
          "HEXTRIS_REVISION_CONFLICT",
          { currentRevision: beforeRevision }
        );
      }

      const outcome = normalizeEngineOutcome(applyHextrisAction(state, normalizedRequest.action));
      const nextState = restoreHextrisState(outcome.state);
      const revision = stateRevision(nextState);
      assertOutcomeRevision(outcome.status, beforeRevision, revision);
      const updatedAtMs = Math.max(nowMs, payload.updatedAtMs);
      const expiresAtMs = updatedAtMs + this.idleTtlMs;
      const result = {
        gameId: GAME_ID,
        sessionId: normalizedId,
        clientActionId: normalizedRequest.clientActionId,
        status: outcome.status,
        reason: outcome.reason,
        beforeRevision,
        revision,
        deduplicated: false,
        expiresAt: toIso(expiresAtMs),
        events: cloneJson(outcome.events, "Hextris action events"),
        observation: this.createObservationEnvelope(
          { ...payload, updatedAtMs, expiresAtMs },
          nextState
        )
      };
      const nextPayload = {
        ...payload,
        updatedAtMs,
        expiresAtMs,
        state: cloneAndBoundState(serializeHextrisState(nextState)),
        receipts: [
          ...payload.receipts,
          {
            clientActionId: normalizedRequest.clientActionId,
            payloadHash,
            result: cloneJson(result, "Hextris action receipt")
          }
        ].slice(-HEXTRIS_AGENT_MAX_RECEIPTS)
      };
      await this.writeSession(nextPayload, lock.assertOwned);
      return result;
    });
  }

  async resetSession(sessionId, request) {
    if (!isPlainRecord(request)) {
      throw new HextrisSessionStoreError(
        "Hextris reset options must be an object.",
        "HEXTRIS_RESET_OPTIONS_INVALID"
      );
    }
    assertExactKeys(
      request,
      ["expectedRevision", "clientActionId", "confirm"],
      "HEXTRIS_RESET_OPTIONS_INVALID"
    );
    if (request.confirm !== true) {
      throw new HextrisSessionStoreError(
        "Resetting a Hextris session requires explicit confirmation.",
        "HEXTRIS_CONFIRMATION_REQUIRED"
      );
    }
    return this.actSession(sessionId, {
      expectedRevision: request.expectedRevision,
      clientActionId: request.clientActionId,
      action: { type: "reset", confirm: true }
    });
  }

  async closeSession(sessionId, options = {}) {
    const normalizedId = normalizeSessionId(sessionId);
    if (!isPlainRecord(options)) {
      throw new HextrisSessionStoreError(
        "Hextris close options must be an object.",
        "HEXTRIS_CLOSE_OPTIONS_INVALID"
      );
    }
    if (Reflect.ownKeys(options).some((key) => key !== "confirm")) {
      throw new HextrisSessionStoreError(
        "Hextris close options contain unsupported fields.",
        "HEXTRIS_CLOSE_OPTIONS_INVALID"
      );
    }
    if (options.confirm !== true) {
      throw new HextrisSessionStoreError(
        "Closing a Hextris session requires explicit confirmation.",
        "HEXTRIS_CONFIRMATION_REQUIRED"
      );
    }
    await this.ensureRoot();
    return this.withLock(this.lockPath(normalizedId), async (lock) => {
      const exists = await regularFileExists(this.sessionPath(normalizedId));
      if (!exists) return { ok: true, gameId: GAME_ID, sessionId: normalizedId, closed: false };
      await lock.assertOwned();
      await this.removeSessionFile(normalizedId);
      return { ok: true, gameId: GAME_ID, sessionId: normalizedId, closed: true };
    });
  }

  createSnapshot(payload, state, options = {}) {
    return {
      gameId: GAME_ID,
      sessionId: payload.sessionId,
      expiresAt: toIso(payload.expiresAtMs),
      observation: this.createObservationEnvelope(payload, state),
      ...(options.includeActions
        ? { actions: cloneJson(listHextrisActions(state), "Hextris action list") }
        : {})
    };
  }

  createObservationEnvelope(payload, state) {
    const observation = cloneJson(observeHextrisState(state), "Hextris observation");
    return {
      ...observation,
      gameId: GAME_ID,
      sessionId: payload.sessionId,
      revision: stateRevision(state),
      expiresAt: toIso(payload.expiresAtMs)
    };
  }

  async readSession(sessionId, options = {}) {
    const payload = await readSessionFile(this.sessionPath(sessionId), sessionId);
    const state = restoreHextrisState(payload.state);
    cloneAndBoundState(serializeHextrisState(state));
    if (!options.allowExpired && payload.expiresAtMs <= this.currentTime()) {
      throw new HextrisSessionStoreError(
        "The local Hextris session has expired.",
        "HEXTRIS_SESSION_EXPIRED"
      );
    }
    return { payload, state };
  }

  async writeSession(payload, assertOwned) {
    validateSessionPayload(payload, payload.sessionId);
    cloneAndBoundState(payload.state);
    await atomicWriteJson(this.sessionPath(payload.sessionId), payload, assertOwned);
  }

  async cleanupExpiredSessions() {
    const sessionIds = await this.listSessionIds();
    const nowMs = this.currentTime();
    for (const sessionId of sessionIds) {
      await this.withLock(this.lockPath(sessionId), async (lock) => {
        let payload;
        try {
          payload = await readSessionFile(this.sessionPath(sessionId), sessionId);
        } catch (error) {
          if (error instanceof HextrisSessionStoreError && error.code === "HEXTRIS_SESSION_NOT_FOUND") return;
          throw error;
        }
        if (payload.expiresAtMs <= nowMs) {
          await lock.assertOwned();
          await this.removeSessionFile(sessionId);
        }
      });
    }
  }

  async listSessionIds() {
    let entries;
    try {
      entries = await fs.readdir(this.rootDir, { withFileTypes: true });
    } catch (error) {
      throw storageError(error, "Unable to read the local Hextris session directory.");
    }
    return entries
      .filter((entry) => entry.isFile() && SESSION_FILENAME_PATTERN.test(entry.name))
      .map((entry) => SESSION_FILENAME_PATTERN.exec(entry.name)[1]);
  }

  async createUniqueSessionId() {
    for (let attempt = 0; attempt < 32; attempt += 1) {
      const sessionId = `hextris_${this.randomHex(16)}`;
      const stateExists = await pathExists(this.sessionPath(sessionId));
      const lockExists = await pathExists(this.lockPath(sessionId));
      if (!stateExists && !lockExists) return sessionId;
    }
    throw new HextrisSessionStoreError(
      "A secure Hextris session id could not be allocated.",
      "HEXTRIS_SESSION_ID_UNAVAILABLE"
    );
  }

  async ensureRoot() {
    try {
      await fs.mkdir(this.rootDir, { recursive: true, mode: 0o700 });
      await fs.chmod(this.rootDir, 0o700).catch(() => {});
      const stat = await fs.lstat(this.rootDir);
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("invalid directory");
    } catch (error) {
      throw storageError(error, "Unable to prepare the local Hextris session directory.");
    }
  }

  async removeSessionFile(sessionId) {
    try {
      await fs.unlink(this.sessionPath(sessionId));
      await syncDirectory(this.rootDir);
    } catch (error) {
      if (error?.code === "ENOENT") return;
      throw storageError(error, "Unable to remove the local Hextris session.");
    }
  }

  async withLock(lockPath, callback) {
    const lock = await acquireOwnerLock(lockPath, {
      waitMs: this.lockWaitMs,
      pollMs: this.lockPollMs,
      staleMs: this.lockStaleMs,
      randomHex: (bytes) => this.randomHex(bytes)
    });
    let result;
    let callbackError;
    try {
      result = await callback({ assertOwned: lock.assertOwned });
    } catch (error) {
      callbackError = error;
    }
    try {
      await lock.release();
    } catch (releaseError) {
      if (!callbackError) throw releaseError;
    }
    if (callbackError) throw callbackError;
    return result;
  }

  sessionPath(sessionId) {
    return path.join(this.rootDir, `${sessionId}.json`);
  }

  lockPath(sessionId) {
    return path.join(this.rootDir, `${sessionId}.lock`);
  }

  currentTime() {
    const value = this.now();
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
      throw new HextrisSessionStoreError("The session clock is invalid.", "HEXTRIS_CLOCK_INVALID");
    }
    return value;
  }

  randomHex(bytes) {
    const value = this.randomBytes(bytes);
    if (!Buffer.isBuffer(value) && !(value instanceof Uint8Array)) {
      throw new HextrisSessionStoreError(
        "The secure random generator returned invalid bytes.",
        "HEXTRIS_RANDOM_INVALID"
      );
    }
    const buffer = Buffer.from(value);
    if (buffer.byteLength !== bytes) {
      throw new HextrisSessionStoreError(
        "The secure random generator returned the wrong byte count.",
        "HEXTRIS_RANDOM_INVALID"
      );
    }
    return buffer.toString("hex");
  }
}

export function resolveHextrisAgentDirectory(options = {}) {
  const env = options.env || process.env;
  const explicit = options.rootDir ?? env.LUSU_HEXTRIS_AGENT_DIR;
  if (typeof explicit === "string" && explicit.trim()) return path.resolve(explicit.trim());
  const platform = options.platform || process.platform;
  const appData = typeof env.APPDATA === "string" ? env.APPDATA.trim() : "";
  if (platform === "win32" && appData) return path.resolve(appData, "lusu-hextris-agent");
  const homeDir = options.homeDir || os.homedir();
  if (typeof homeDir !== "string" || !homeDir.trim()) {
    throw new HextrisSessionStoreError(
      "A local configuration directory is unavailable.",
      "HEXTRIS_STATE_ROOT_UNAVAILABLE"
    );
  }
  return path.resolve(homeDir, ".config", "lusu-hextris-agent");
}

function normalizeCreateOptions(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HextrisSessionStoreError(
      "Hextris create options must be an object.",
      "HEXTRIS_CREATE_OPTIONS_INVALID"
    );
  }
  const keys = Object.keys(value);
  if (keys.some((key) => key !== "seed" && key !== "best")) {
    throw new HextrisSessionStoreError(
      "Hextris create options contain unsupported fields.",
      "HEXTRIS_CREATE_OPTIONS_INVALID"
    );
  }
  return {
    ...(value.seed !== undefined ? { seed: value.seed } : {}),
    ...(value.best !== undefined ? { best: value.best } : {})
  };
}

function normalizeActionRequest(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HextrisSessionStoreError(
      "The Hextris action request must be an object.",
      "HEXTRIS_ACTION_REQUEST_INVALID"
    );
  }
  assertExactKeys(value, ["expectedRevision", "clientActionId", "action"], "HEXTRIS_ACTION_REQUEST_INVALID");
  const expectedRevision = value.expectedRevision;
  if (
    typeof expectedRevision !== "number"
    || !Number.isSafeInteger(expectedRevision)
    || expectedRevision < 0
    || expectedRevision > MAX_REVISION
  ) {
    throw new HextrisSessionStoreError(
      "The expected Hextris revision is invalid.",
      "HEXTRIS_REVISION_INVALID"
    );
  }
  const clientActionId = value.clientActionId;
  if (typeof clientActionId !== "string" || !HEXTRIS_CLIENT_ACTION_ID_PATTERN.test(clientActionId)) {
    throw new HextrisSessionStoreError(
      "The Hextris client action id is invalid.",
      "HEXTRIS_CLIENT_ACTION_ID_INVALID"
    );
  }
  let action;
  try {
    action = normalizeHextrisAction(cloneJson(value.action, "Hextris action"));
  } catch (error) {
    throw engineError(error, "The Hextris action is invalid.", "HEXTRIS_ACTION_INVALID");
  }
  return { expectedRevision, clientActionId, action };
}

function normalizeEngineOutcome(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HextrisSessionStoreError(
      "The Hextris engine returned an invalid outcome.",
      "HEXTRIS_ENGINE_OUTCOME_INVALID"
    );
  }
  const status = value.status;
  if (typeof status !== "string" || !new Set(["applied", "noop", "rejected"]).has(status)) {
    throw new HextrisSessionStoreError(
      "The Hextris engine returned an invalid status.",
      "HEXTRIS_ENGINE_OUTCOME_INVALID"
    );
  }
  const reason = value.reason;
  if (typeof reason !== "string" || !/^[a-z][a-z0-9-]{0,63}$/.test(reason)) {
    throw new HextrisSessionStoreError(
      "The Hextris engine returned an invalid reason.",
      "HEXTRIS_ENGINE_OUTCOME_INVALID"
    );
  }
  if (!Array.isArray(value.events)) {
    throw new HextrisSessionStoreError(
      "The Hextris engine returned invalid events.",
      "HEXTRIS_ENGINE_OUTCOME_INVALID"
    );
  }
  return { status, reason, state: value.state, events: value.events };
}

function assertOutcomeRevision(status, beforeRevision, revision) {
  const expected = status === "applied" ? beforeRevision + 1 : beforeRevision;
  if (revision !== expected || revision > MAX_REVISION) {
    throw new HextrisSessionStoreError(
      "The Hextris engine returned an invalid revision.",
      "HEXTRIS_ENGINE_REVISION_INVALID"
    );
  }
}

function stateRevision(state) {
  const revision = state?.revision;
  if (
    typeof revision !== "number"
    || !Number.isSafeInteger(revision)
    || revision < 0
    || revision > MAX_REVISION
  ) {
    throw new HextrisSessionStoreError(
      "The Hextris state revision is invalid.",
      "HEXTRIS_STATE_REVISION_INVALID"
    );
  }
  return revision;
}

function cloneAndBoundState(value) {
  const cloned = cloneJson(value, "Hextris state");
  const size = Buffer.byteLength(JSON.stringify(cloned));
  if (size > HEXTRIS_AGENT_MAX_STATE_BYTES) {
    throw new HextrisSessionStoreError(
      "The Hextris state exceeds the local size limit.",
      "HEXTRIS_STATE_TOO_LARGE"
    );
  }
  return cloned;
}

function actionPayloadHash(request) {
  return createHash("sha256")
    .update(stableJson({ expectedRevision: request.expectedRevision, action: request.action }))
    .digest("hex");
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function cloneJson(value, label) {
  let text;
  try {
    text = JSON.stringify(value);
  } catch (error) {
    throw new HextrisSessionStoreError(`${label} is not JSON serializable.`, "HEXTRIS_JSON_INVALID", { cause: error });
  }
  if (text === undefined || Buffer.byteLength(text) > MAX_SESSION_FILE_BYTES) {
    throw new HextrisSessionStoreError(`${label} is invalid or too large.`, "HEXTRIS_JSON_INVALID");
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new HextrisSessionStoreError(`${label} is invalid JSON.`, "HEXTRIS_JSON_INVALID", { cause: error });
  }
}

function validateSessionPayload(payload, expectedSessionId) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw invalidSessionFile();
  assertExactKeys(
    payload,
    ["version", "sessionId", "gameId", "createdAtMs", "updatedAtMs", "expiresAtMs", "state", "receipts"],
    "HEXTRIS_SESSION_FILE_INVALID"
  );
  if (
    payload.version !== HEXTRIS_AGENT_STATE_VERSION
    || payload.sessionId !== expectedSessionId
    || payload.gameId !== GAME_ID
    || !HEXTRIS_SESSION_ID_PATTERN.test(payload.sessionId)
  ) throw invalidSessionFile();
  for (const key of ["createdAtMs", "updatedAtMs", "expiresAtMs"]) {
    if (!Number.isSafeInteger(payload[key]) || payload[key] < 0) throw invalidSessionFile();
  }
  if (payload.updatedAtMs < payload.createdAtMs || payload.expiresAtMs <= payload.updatedAtMs) {
    throw invalidSessionFile();
  }
  if (!Array.isArray(payload.receipts) || payload.receipts.length > HEXTRIS_AGENT_MAX_RECEIPTS) {
    throw invalidSessionFile();
  }
  if (
    !isPlainRecord(payload.state)
    || typeof payload.state.revision !== "number"
    || !Number.isSafeInteger(payload.state.revision)
    || payload.state.revision < 0
    || payload.state.revision > MAX_REVISION
  ) throw invalidSessionFile();
  const seen = new Set();
  for (const receipt of payload.receipts) {
    if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) throw invalidSessionFile();
    assertExactKeys(receipt, ["clientActionId", "payloadHash", "result"], "HEXTRIS_SESSION_FILE_INVALID");
    if (
      typeof receipt.clientActionId !== "string"
      || !HEXTRIS_CLIENT_ACTION_ID_PATTERN.test(receipt.clientActionId)
      || typeof receipt.payloadHash !== "string"
      || !HASH_PATTERN.test(receipt.payloadHash)
      || seen.has(receipt.clientActionId)
    ) throw invalidSessionFile();
    seen.add(receipt.clientActionId);
    validateReceiptResult(receipt.result, payload.sessionId, receipt.clientActionId);
  }
  try {
    cloneAndBoundState(serializeHextrisState(restoreHextrisState(payload.state)));
  } catch (error) {
    if (error instanceof HextrisSessionStoreError) throw error;
    throw invalidSessionFile();
  }
}

function validateReceiptResult(result, sessionId, clientActionId) {
  if (!result || typeof result !== "object" || Array.isArray(result)) throw invalidSessionFile();
  assertExactKeys(
    result,
    [
      "gameId",
      "sessionId",
      "clientActionId",
      "status",
      "reason",
      "beforeRevision",
      "revision",
      "deduplicated",
      "expiresAt",
      "events",
      "observation"
    ],
    "HEXTRIS_SESSION_FILE_INVALID"
  );
  if (
    result.gameId !== GAME_ID
    || result.sessionId !== sessionId
    || result.clientActionId !== clientActionId
    || result.deduplicated !== false
    || typeof result.status !== "string"
    || !new Set(["applied", "noop", "rejected"]).has(result.status)
    || typeof result.reason !== "string"
    || !/^[a-z][a-z0-9-]{0,63}$/.test(result.reason)
    || !Number.isSafeInteger(result.beforeRevision)
    || result.beforeRevision < 0
    || result.beforeRevision > MAX_REVISION
    || !Number.isSafeInteger(result.revision)
    || result.revision < 0
    || result.revision > MAX_REVISION
    || !Array.isArray(result.events)
    || !result.observation
    || typeof result.observation !== "object"
    || typeof result.expiresAt !== "string"
    || Number.isNaN(Date.parse(result.expiresAt))
  ) throw invalidSessionFile();
  const expectedRevision = result.status === "applied"
    ? result.beforeRevision + 1
    : result.beforeRevision;
  if (
    result.revision !== expectedRevision
    || result.observation.gameId !== GAME_ID
    || result.observation.sessionId !== sessionId
    || result.observation.revision !== result.revision
    || result.observation.expiresAt !== result.expiresAt
  ) throw invalidSessionFile();
}

async function readSessionFile(filePath, expectedSessionId) {
  let stat;
  try {
    stat = await fs.lstat(filePath);
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new HextrisSessionStoreError("The local Hextris session was not found.", "HEXTRIS_SESSION_NOT_FOUND");
    }
    throw storageError(error, "Unable to read the local Hextris session.");
  }
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size <= 0 || stat.size > MAX_SESSION_FILE_BYTES) {
    throw invalidSessionFile();
  }
  let text;
  try {
    text = await fs.readFile(filePath, "utf8");
  } catch (error) {
    throw storageError(error, "Unable to read the local Hextris session.");
  }
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw invalidSessionFile();
  }
  validateSessionPayload(payload, expectedSessionId);
  return payload;
}

async function atomicWriteJson(filePath, value, assertOwned) {
  const text = `${JSON.stringify(value)}\n`;
  if (Buffer.byteLength(text) > MAX_SESSION_FILE_BYTES) {
    throw new HextrisSessionStoreError(
      "The local Hextris session file is too large.",
      "HEXTRIS_SESSION_FILE_TOO_LARGE"
    );
  }
  const directory = path.dirname(filePath);
  const tempPath = path.join(
    directory,
    `.${path.basename(filePath)}.${process.pid}.${randomBytes(12).toString("hex")}.tmp`
  );
  let handle;
  try {
    handle = await fs.open(tempPath, "wx", 0o600);
    await handle.writeFile(text, "utf8");
    await handle.sync();
    await handle.close();
    handle = null;
    if (typeof assertOwned === "function") await assertOwned();
    await fs.rename(tempPath, filePath);
    await fs.chmod(filePath, 0o600).catch(() => {});
    await syncDirectory(directory);
  } catch (error) {
    await handle?.close().catch(() => {});
    await fs.unlink(tempPath).catch(() => {});
    throw storageError(error, "Unable to persist the local Hextris session.");
  }
}

async function acquireOwnerLock(lockPath, options) {
  const ownerToken = options.randomHex(16);
  const deadline = Date.now() + options.waitMs;
  const candidate = await createLockCandidate(lockPath, ownerToken, options.randomHex);
  let published = false;
  try {
    while (true) {
      const beforePublish = await inspectPublishedLock(lockPath);
      if (beforePublish.status === "missing" || beforePublish.status === "empty") {
        if (beforePublish.status === "missing") clearLocalAbandonedOwnersForPath(lockPath);
        let renamed = false;
        try {
          await fs.rename(candidate.path, lockPath);
          renamed = true;
        } catch (error) {
          if (!isLockContentionError(error)) {
            throw storageError(error, "Unable to acquire the local Hextris session lock.");
          }
        }
        if (renamed) {
          published = true;
          try {
            await syncDirectory(path.dirname(lockPath));
            return await openPublishedOwnerLock(lockPath, ownerToken, options.staleMs);
          } catch (error) {
            await discardJustPublishedOwnerLock(lockPath, ownerToken).catch(() => {});
            throw storageError(error, "Unable to open the published local Hextris session lock.");
          }
        }
      }

      const recovered = await recoverStaleDirectoryOrLegacyLock(lockPath, options.staleMs);
      if (!recovered) {
        if (Date.now() >= deadline) {
          throw new HextrisSessionStoreError(
            "The local Hextris session is busy.",
            "HEXTRIS_LOCK_TIMEOUT"
          );
        }
        await delay(Math.min(options.pollMs, Math.max(1, deadline - Date.now())));
      }
    }
  } finally {
    if (!published) await removeLockCandidate(candidate).catch(() => {});
  }
}

async function createLockCandidate(lockPath, ownerToken, randomHex) {
  const candidatePath = path.join(
    path.dirname(lockPath),
    `.${path.basename(lockPath)}.candidate-${process.pid}-${randomHex(12)}`
  );
  const markerPath = path.join(candidatePath, ownerMarkerName(ownerToken));
  let handle;
  let directoryCreated = false;
  try {
    await fs.mkdir(candidatePath, { mode: 0o700 });
    directoryCreated = true;
    handle = await fs.open(markerPath, "wx", 0o600);
    const record = JSON.stringify({
      ownerToken,
      pid: process.pid,
      processInstanceToken: PROCESS_INSTANCE_TOKEN,
      createdAtMs: Date.now()
    });
    await handle.writeFile(`${record}\n`, "utf8");
    await handle.sync();
    await handle.close();
    handle = null;
    await syncDirectory(candidatePath);
    return { path: candidatePath, markerPath };
  } catch (error) {
    await handle?.close().catch(() => {});
    if (directoryCreated) {
      await fs.unlink(markerPath).catch(() => {});
      await fs.rmdir(candidatePath).catch(() => {});
    }
    throw storageError(error, "Unable to prepare the local Hextris session lock candidate.");
  }
}

async function removeLockCandidate(candidate) {
  try {
    await fs.unlink(candidate.markerPath);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  try {
    await fs.rmdir(candidate.path);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

async function discardJustPublishedOwnerLock(lockPath, ownerToken) {
  const current = await inspectPublishedLock(lockPath);
  if (
    current.status !== "directory"
    || current.ownerToken !== ownerToken
    || current.record.pid !== process.pid
    || current.record.processInstanceToken !== PROCESS_INSTANCE_TOKEN
  ) return false;
  let retiring;
  try {
    retiring = await transitionOwnerMarker(lockPath, current, (candidate) => (
      directorySnapshotMatches(candidate, current)
    ));
  } catch (error) {
    if (isLockMarkerTransitionFailure(error)) markLocalAbandonedOwner(lockPath, current);
    throw error;
  }
  if (!retiring) return false;
  const removed = await unlinkExactRetiringMarker(lockPath, retiring);
  if (!removed) return false;
  await removeEmptyLockDirectory(lockPath, retiring.directoryIdentity);
  return true;
}

async function openPublishedOwnerLock(lockPath, ownerToken, staleMs) {
  const inspected = await inspectPublishedLock(lockPath);
  if (
    inspected.status !== "directory"
    || inspected.ownerToken !== ownerToken
    || inspected.record.pid !== process.pid
    || inspected.record.processInstanceToken !== PROCESS_INSTANCE_TOKEN
  ) throw lockOwnershipLost();

  let handle;
  try {
    handle = await fs.open(inspected.markerPath, "r+");
    const handleStat = await handle.stat();
    if (!sameLockIdentity(handleStat, inspected.markerIdentity)) throw lockOwnershipLost();
    const ownership = {
      ownerToken,
      directoryIdentity: inspected.directoryIdentity,
      markerIdentity: inspected.markerIdentity,
      markerPath: inspected.markerPath
    };
    await verifyDirectoryLockOwned(lockPath, handle, ownership);
    const heartbeat = startDirectoryLockHeartbeat(lockPath, handle, ownership, staleMs);
    return {
      assertOwned: () => verifyDirectoryLockOwned(lockPath, handle, ownership),
      release: createDirectoryLockRelease(lockPath, handle, ownership, heartbeat)
    };
  } catch (error) {
    await handle?.close().catch(() => {});
    throw error;
  }
}

async function readLockSnapshot(lockPath) {
  let handle;
  try {
    handle = await fs.open(lockPath, "r");
  } catch (error) {
    if (error?.code === "ENOENT") return { status: "missing" };
    if (isTransientLockRaceError(error)) return { status: "changed" };
    throw storageError(error, "Unable to inspect the local Hextris session lock.");
  }

  try {
    const openedStat = await handle.stat();
    let pathStat;
    try {
      pathStat = await fs.lstat(lockPath);
    } catch (error) {
      if (error?.code === "ENOENT") return { status: "changed" };
      if (isTransientLockRaceError(error)) return { status: "changed" };
      throw error;
    }
    if (!openedStat.isFile() || !pathStat.isFile() || pathStat.isSymbolicLink()) {
      return { status: "invalid" };
    }
    if (!sameLockIdentity(openedStat, pathStat)) return { status: "changed" };
    if (openedStat.size > 1024) return { status: "invalid" };

    const bytes = await handle.readFile();
    const finalHandleStat = await handle.stat();
    let finalPathStat;
    try {
      finalPathStat = await fs.lstat(lockPath);
    } catch (error) {
      if (error?.code === "ENOENT") return { status: "changed" };
      if (isTransientLockRaceError(error)) return { status: "changed" };
      throw error;
    }
    if (
      !finalHandleStat.isFile()
      || !finalPathStat.isFile()
      || finalPathStat.isSymbolicLink()
      || !sameLockIdentity(openedStat, finalHandleStat)
      || !sameLockIdentity(finalHandleStat, finalPathStat)
      || openedStat.size !== finalHandleStat.size
      || openedStat.mtimeMs !== finalHandleStat.mtimeMs
      || bytes.byteLength !== finalHandleStat.size
    ) return { status: "changed" };

    let record = null;
    try {
      const parsed = JSON.parse(bytes.toString("utf8"));
      if (
        isPlainRecord(parsed)
        && hasExactLockRecordKeys(parsed)
        && typeof parsed.ownerToken === "string"
        && OWNER_TOKEN_PATTERN.test(parsed.ownerToken)
        && Number.isSafeInteger(parsed.pid)
        && parsed.pid > 0
        && typeof parsed.processInstanceToken === "string"
        && OWNER_TOKEN_PATTERN.test(parsed.processInstanceToken)
        && Number.isSafeInteger(parsed.createdAtMs)
        && parsed.createdAtMs >= 0
      ) record = parsed;
    } catch {
      // Empty and partial stale files are recoverable using identity and bytes.
    }
    return {
      status: "snapshot",
      identity: lockIdentity(finalHandleStat),
      mtimeMs: finalHandleStat.mtimeMs,
      size: finalHandleStat.size,
      contentHash: createHash("sha256").update(bytes).digest("hex"),
      ownerToken: record?.ownerToken ?? null,
      record
    };
  } catch (error) {
    if (error instanceof HextrisSessionStoreError) throw error;
    throw storageError(error, "Unable to inspect the local Hextris session lock.");
  } finally {
    await handle.close().catch(() => {});
  }
}

function hasExactLockRecordKeys(record) {
  const keys = Reflect.ownKeys(record);
  const expected = ["createdAtMs", "ownerToken", "pid", "processInstanceToken"];
  return keys.length === expected.length
    && keys.every((key) => typeof key === "string")
    && keys.sort().every((key, index) => key === expected[index]);
}

function lockIdentity(stat) {
  return { dev: stat.dev, ino: stat.ino };
}

function sameLockIdentity(left, right) {
  return Boolean(left && right && left.dev === right.dev && left.ino === right.ino);
}

function isProcessAlive(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error?.code === "ESRCH") return false;
    return true;
  }
}

function isLockOwnerAlive(record) {
  if (record.pid === process.pid) {
    return record.processInstanceToken === PROCESS_INSTANCE_TOKEN;
  }
  return isProcessAlive(record.pid);
}

function startDirectoryLockHeartbeat(lockPath, handle, ownership, staleMs) {
  const controller = new AbortController();
  const intervalMs = Math.max(1, Math.floor(staleMs / 4));
  let heartbeatError = null;
  const finished = (async () => {
    while (!controller.signal.aborted) {
      try {
        await delay(intervalMs, undefined, { signal: controller.signal });
      } catch (error) {
        if (error?.name === "AbortError") break;
        heartbeatError = storageError(error, "The local Hextris session lock heartbeat failed.");
        break;
      }
      if (controller.signal.aborted) break;
      try {
        await heartbeatDirectoryLock(lockPath, handle, ownership);
      } catch (error) {
        heartbeatError = error instanceof HextrisSessionStoreError
          ? error
          : storageError(error, "The local Hextris session lock heartbeat failed.");
        break;
      }
    }
  })();
  return {
    async stop() {
      controller.abort();
      await finished;
      if (heartbeatError) throw heartbeatError;
    }
  };
}

function createDirectoryLockRelease(lockPath, handle, ownership, heartbeat) {
  let released = false;
  return async () => {
    if (released) return;
    released = true;
    let heartbeatError = null;
    let closeError = null;
    let releaseError = null;
    try {
      await heartbeat.stop();
    } catch (error) {
      heartbeatError = error;
    }
    try {
      await handle.close();
    } catch (error) {
      closeError = storageError(error, "Unable to close the local Hextris session lock.");
    }
    try {
      await releaseDirectoryLock(lockPath, ownership);
    } catch (error) {
      if (!closeError && isLockMarkerTransitionFailure(error)) {
        markLocalAbandonedOwner(lockPath, ownership);
      }
      releaseError = error;
    }
    if (heartbeatError) throw heartbeatError;
    if (closeError) throw closeError;
    if (releaseError) throw releaseError;
  };
}

async function heartbeatDirectoryLock(lockPath, handle, ownership) {
  await verifyDirectoryLockOwned(lockPath, handle, ownership);
  const now = new Date();
  try {
    await handle.utimes(now, now);
  } catch (error) {
    throw storageError(error, "The local Hextris session lock heartbeat failed.");
  }
  await verifyDirectoryLockOwned(lockPath, handle, ownership);
}

async function verifyDirectoryLockOwned(lockPath, handle, ownership) {
  const inspected = await inspectPublishedLock(lockPath);
  let handleStat;
  try {
    handleStat = await handle.stat();
  } catch (error) {
    if (error?.code === "ENOENT") throw lockOwnershipLost();
    throw storageError(error, "Unable to verify the local Hextris session lock.");
  }
  if (
    inspected.status !== "directory"
    || inspected.ownerToken !== ownership.ownerToken
    || !sameLockIdentity(inspected.directoryIdentity, ownership.directoryIdentity)
    || !sameLockIdentity(inspected.markerIdentity, ownership.markerIdentity)
    || !sameLockIdentity(handleStat, ownership.markerIdentity)
    || inspected.record.pid !== process.pid
    || inspected.record.processInstanceToken !== PROCESS_INSTANCE_TOKEN
  ) throw lockOwnershipLost();
}

async function recoverStaleDirectoryOrLegacyLock(lockPath, staleMs) {
  const observed = await inspectPublishedLock(lockPath);
  if (observed.status === "missing") {
    clearLocalAbandonedOwnersForPath(lockPath);
    return true;
  }
  if (observed.status === "empty") return removeObservedEmptyLockDirectory(lockPath, observed);
  if (observed.status === "changed") return false;
  if (observed.status === "legacy") return recoverLegacyLock(lockPath, observed, staleMs);
  if (observed.status === "retiring") return recoverRetiringLock(lockPath, observed, staleMs);
  if (observed.status !== "directory") throw invalidLockFile();
  pruneLocalAbandonedOwners(lockPath, observed);
  if (Date.now() - observed.mtimeMs <= staleMs) return false;
  if (isLockOwnerAlive(observed.record) && !isExactLocalAbandonedOwner(lockPath, observed)) return false;
  return retireStaleDirectoryLock(lockPath, observed, staleMs);
}

async function removeObservedEmptyLockDirectory(lockPath, observed) {
  let currentStat;
  let entries;
  try {
    currentStat = await fs.lstat(lockPath);
    if (
      !currentStat.isDirectory()
      || currentStat.isSymbolicLink()
      || !sameLockIdentity(currentStat, observed.directoryIdentity)
    ) return false;
    entries = await fs.readdir(lockPath);
  } catch (error) {
    if (error?.code === "ENOENT") return true;
    if (isTransientLockRaceError(error)) return false;
    throw storageError(error, "Unable to inspect the empty Hextris session lock directory.");
  }
  if (entries.length !== 0) return false;
  try {
    await fs.rmdir(lockPath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return true;
    if (new Set(["EACCES", "EEXIST", "ENOTEMPTY", "EPERM"]).has(error?.code)) return false;
    throw storageError(error, "Unable to remove the empty Hextris session lock directory.");
  }
}

async function recoverLegacyLock(lockPath, observed, staleMs) {
  if (Date.now() - observed.mtimeMs <= staleMs) return false;
  if (observed.record && isLockOwnerAlive(observed.record)) return false;
  const current = await readLockSnapshot(lockPath);
  if (current.status === "missing") return true;
  if (current.status !== "snapshot") return false;
  if (
    !regularSnapshotMatches(current, observed)
    || Date.now() - current.mtimeMs <= staleMs
    || (current.record && isLockOwnerAlive(current.record))
  ) return false;
  try {
    await fs.unlink(lockPath);
    await syncDirectory(path.dirname(lockPath));
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return true;
    if (new Set(["EACCES", "EISDIR", "EPERM"]).has(error?.code)) {
      const replacement = await inspectPublishedLock(lockPath);
      if (
        replacement.status === "directory"
        || replacement.status === "retiring"
        || replacement.status === "missing"
      ) return true;
      if (replacement.status === "changed") return false;
      if (replacement.status === "invalid") throw invalidLockFile();
    }
    throw storageError(error, "Unable to retire the legacy Hextris session lock.");
  }
}

async function retireStaleDirectoryLock(lockPath, observed, staleMs) {
  const current = await inspectPublishedLock(lockPath);
  if (current.status === "missing") return true;
  if (
    current.status !== "directory"
    || !directorySnapshotMatches(current, observed, true)
    || Date.now() - current.mtimeMs <= staleMs
    || (
      isLockOwnerAlive(current.record)
      && !isExactLocalAbandonedOwner(lockPath, current)
    )
  ) return false;
  const retiring = await transitionOwnerMarker(lockPath, current, (candidate) => (
    directorySnapshotMatches(candidate, observed, true)
    && Date.now() - candidate.mtimeMs > staleMs
    && (
      !isLockOwnerAlive(candidate.record)
      || isExactLocalAbandonedOwner(lockPath, candidate)
    )
  ));
  if (!retiring) {
    const replacement = await inspectPublishedLock(lockPath);
    return replacement.status === "missing";
  }
  const removed = await unlinkExactRetiringMarker(lockPath, retiring);
  if (!removed) return true;
  await removeEmptyLockDirectory(lockPath, retiring.directoryIdentity);
  return true;
}

async function releaseDirectoryLock(lockPath, ownership) {
  const current = await inspectPublishedLock(lockPath);
  if (
    current.status !== "directory"
    || current.ownerToken !== ownership.ownerToken
    || !sameLockIdentity(current.directoryIdentity, ownership.directoryIdentity)
    || !sameLockIdentity(current.markerIdentity, ownership.markerIdentity)
  ) throw lockOwnershipLost();
  const retiring = await transitionOwnerMarker(lockPath, current, (candidate) => (
    candidate.ownerToken === ownership.ownerToken
    && sameLockIdentity(candidate.directoryIdentity, ownership.directoryIdentity)
    && sameLockIdentity(candidate.markerIdentity, ownership.markerIdentity)
  ));
  if (!retiring) throw lockOwnershipLost();
  const removed = await unlinkExactRetiringMarker(lockPath, retiring);
  if (!removed) throw lockOwnershipLost();
  await removeEmptyLockDirectory(lockPath, retiring.directoryIdentity);
}

async function recoverRetiringLock(lockPath, observed, staleMs) {
  if (Date.now() - observed.mtimeMs <= staleMs) return false;
  const marker = await readLockSnapshot(observed.markerPath);
  if (
    marker.status !== "snapshot"
    || !marker.record
    || marker.record.ownerToken !== observed.ownerToken
    || !sameLockIdentity(marker.identity, observed.markerIdentity)
  ) {
    if (marker.status === "missing" || marker.status === "changed") return false;
    throw invalidLockFile();
  }
  const current = await inspectPublishedLock(lockPath);
  if (
    current.status !== "retiring"
    || !retiringSnapshotMatches(current, observed)
    || Date.now() - current.mtimeMs <= staleMs
  ) return false;
  if (
    isLockOwnerAlive(marker.record)
    && !LOCAL_RETIRING_OWNER_TOKENS.has(current.ownerToken)
  ) return false;
  const removed = await unlinkExactRetiringMarker(lockPath, current);
  if (!removed) return true;
  await removeEmptyLockDirectory(lockPath, current.directoryIdentity);
  return true;
}

async function transitionOwnerMarker(lockPath, expected, validateCurrent) {
  const retiringPath = path.join(lockPath, `retiring-${expected.ownerToken}.json`);
  const deadline = Date.now() + LOCK_MARKER_TRANSITION_WAIT_MS;
  while (true) {
    const current = await inspectPublishedLock(lockPath);
    if (current.status === "retiring" && retiringSnapshotMatches(current, expected)) {
      LOCAL_RETIRING_OWNER_TOKENS.add(expected.ownerToken);
      return current;
    }
    if (
      current.status === "changed"
      && process.platform === "win32"
      && Date.now() < deadline
    ) {
      await delay(2);
      continue;
    }
    if (
      current.status !== "directory"
      || !directorySnapshotMatches(current, expected)
      || !validateCurrent(current)
    ) return null;
    try {
      await fs.rename(current.markerPath, retiringPath);
      LOCAL_RETIRING_OWNER_TOKENS.add(expected.ownerToken);
    } catch (error) {
      if (new Set(["EEXIST", "ENOENT"]).has(error?.code) && Date.now() < deadline) {
        await delay(1);
        continue;
      }
      if (
        process.platform === "win32"
        && isWindowsTransientMarkerError(error)
        && Date.now() < deadline
      ) {
        await delay(2);
        continue;
      }
      throw lockMarkerTransitionFailure(error);
    }
    const retiring = await inspectPublishedLock(lockPath);
    if (retiring.status === "retiring" && retiringSnapshotMatches(retiring, expected)) {
      return retiring;
    }
    if (retiring.status === "changed" && Date.now() < deadline) {
      await delay(1);
      continue;
    }
    return null;
  }
}

async function unlinkExactRetiringMarker(lockPath, expected) {
  const deadline = Date.now() + LOCK_MARKER_TRANSITION_WAIT_MS;
  while (true) {
    const current = await inspectPublishedLock(lockPath);
    if (current.status === "missing") {
      LOCAL_RETIRING_OWNER_TOKENS.delete(expected.ownerToken);
      clearLocalAbandonedOwner(expected.ownerToken);
      return false;
    }
    if (current.status !== "retiring" || !retiringSnapshotMatches(current, expected)) return false;
    let markerStat;
    try {
      markerStat = await fs.lstat(current.markerPath);
    } catch (error) {
      if (error?.code === "ENOENT") {
        LOCAL_RETIRING_OWNER_TOKENS.delete(expected.ownerToken);
        clearLocalAbandonedOwner(expected.ownerToken);
        return false;
      }
      if (
        process.platform === "win32"
        && isWindowsTransientMarkerError(error)
        && Date.now() < deadline
      ) {
        await delay(2);
        continue;
      }
      throw storageError(error, "Unable to verify the retiring Hextris session lock marker.");
    }
    if (
      !markerStat.isFile()
      || markerStat.isSymbolicLink()
      || !sameLockIdentity(markerStat, expected.markerIdentity)
    ) return false;
    try {
      await fs.unlink(current.markerPath);
      LOCAL_RETIRING_OWNER_TOKENS.delete(expected.ownerToken);
      clearLocalAbandonedOwner(expected.ownerToken);
      return true;
    } catch (error) {
      if (error?.code === "ENOENT") {
        LOCAL_RETIRING_OWNER_TOKENS.delete(expected.ownerToken);
        clearLocalAbandonedOwner(expected.ownerToken);
        return false;
      }
      if (
        process.platform === "win32"
        && isWindowsTransientMarkerError(error)
        && Date.now() < deadline
      ) {
        await delay(2);
        continue;
      }
      throw storageError(error, "Unable to release the retiring Hextris session lock marker.");
    }
  }
}

async function removeEmptyLockDirectory(lockPath, expectedIdentity) {
  try {
    await fs.rmdir(lockPath);
    await syncDirectory(path.dirname(lockPath));
    return;
  } catch (error) {
    if (error?.code === "ENOENT") return;
    if (new Set(["EACCES", "EEXIST", "ENOTEMPTY", "EPERM"]).has(error?.code)) {
      const replacement = await inspectPublishedLock(lockPath);
      if (replacement.status === "missing") return;
      if (
        new Set(["directory", "retiring"]).has(replacement.status)
        && !sameLockIdentity(replacement.directoryIdentity, expectedIdentity)
      ) return;
    }
    throw storageError(error, "Unable to remove the local Hextris session lock directory.");
  }
}

async function inspectPublishedLock(lockPath) {
  let initialStat;
  try {
    initialStat = await fs.lstat(lockPath);
  } catch (error) {
    if (error?.code === "ENOENT") return { status: "missing" };
    if (isTransientLockRaceError(error)) return { status: "changed" };
    throw storageError(error, "Unable to inspect the local Hextris session lock.");
  }
  if (initialStat.isSymbolicLink()) return { status: "invalid" };
  if (initialStat.isFile()) {
    const legacy = await readLockSnapshot(lockPath);
    if (legacy.status === "snapshot") return { ...legacy, status: "legacy" };
    if (legacy.status === "invalid") {
      try {
        const replacement = await fs.lstat(lockPath);
        if (!replacement.isFile() || replacement.isSymbolicLink()) return { status: "changed" };
      } catch (error) {
        if (error?.code === "ENOENT" || isTransientLockRaceError(error)) return { status: "changed" };
        throw storageError(error, "Unable to confirm the legacy Hextris session lock.");
      }
    }
    return legacy;
  }
  if (!initialStat.isDirectory()) return { status: "invalid" };

  let entries;
  try {
    entries = await fs.readdir(lockPath, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return { status: "changed" };
    if (isTransientLockRaceError(error)) return { status: "changed" };
    throw storageError(error, "Unable to read the local Hextris session lock directory.");
  }
  let finalStat;
  try {
    finalStat = await fs.lstat(lockPath);
  } catch (error) {
    if (error?.code === "ENOENT") return { status: "changed" };
    if (isTransientLockRaceError(error)) return { status: "changed" };
    throw storageError(error, "Unable to inspect the local Hextris session lock directory.");
  }
  if (!finalStat.isDirectory() || finalStat.isSymbolicLink()) return { status: "invalid" };
  if (!sameLockIdentity(initialStat, finalStat)) return { status: "changed" };
  if (entries.length === 0) {
    return { status: "empty", directoryIdentity: lockIdentity(finalStat) };
  }
  if (entries.length !== 1) return { status: "invalid" };
  const entry = entries[0];
  const ownerMatch = OWNER_MARKER_PATTERN.exec(entry.name);
  const retiringMatch = RETIRING_MARKER_PATTERN.exec(entry.name);
  if (!entry.isFile() || entry.isSymbolicLink() || (!ownerMatch && !retiringMatch)) {
    return { status: "invalid" };
  }

  if (retiringMatch) {
    const markerPath = path.join(lockPath, entry.name);
    let markerStat;
    let confirmedDirectoryStat;
    try {
      [markerStat, confirmedDirectoryStat] = await Promise.all([
        fs.lstat(markerPath),
        fs.lstat(lockPath)
      ]);
    } catch (error) {
      if (error?.code === "ENOENT" || isTransientLockRaceError(error)) return { status: "changed" };
      throw storageError(error, "Unable to inspect the retiring Hextris session lock marker.");
    }
    if (
      !markerStat.isFile()
      || markerStat.isSymbolicLink()
      || !confirmedDirectoryStat.isDirectory()
      || confirmedDirectoryStat.isSymbolicLink()
    ) return { status: "invalid" };
    if (!sameLockIdentity(finalStat, confirmedDirectoryStat)) return { status: "changed" };
    return {
      status: "retiring",
      directoryIdentity: lockIdentity(confirmedDirectoryStat),
      markerIdentity: lockIdentity(markerStat),
      markerPath,
      ownerToken: retiringMatch[1],
      mtimeMs: confirmedDirectoryStat.mtimeMs
    };
  }

  const ownerToken = ownerMatch[1];
  const markerPath = path.join(lockPath, entry.name);
  const marker = await readLockSnapshot(markerPath);
  if (marker.status === "missing" || marker.status === "changed") return { status: "changed" };
  if (
    marker.status !== "snapshot"
    || !marker.record
    || marker.record.ownerToken !== ownerToken
  ) return { status: "invalid" };
  let confirmedDirectoryStat;
  try {
    confirmedDirectoryStat = await fs.lstat(lockPath);
  } catch (error) {
    if (error?.code === "ENOENT") return { status: "changed" };
    if (isTransientLockRaceError(error)) return { status: "changed" };
    throw storageError(error, "Unable to confirm the local Hextris session lock directory.");
  }
  if (
    !confirmedDirectoryStat.isDirectory()
    || confirmedDirectoryStat.isSymbolicLink()
    || !sameLockIdentity(finalStat, confirmedDirectoryStat)
  ) return { status: "changed" };
  return {
    status: "directory",
    directoryIdentity: lockIdentity(confirmedDirectoryStat),
    markerIdentity: marker.identity,
    markerPath,
    ownerToken,
    record: marker.record,
    mtimeMs: marker.mtimeMs,
    size: marker.size,
    contentHash: marker.contentHash
  };
}

function regularSnapshotMatches(left, right) {
  return sameLockIdentity(left.identity, right.identity)
    && left.mtimeMs === right.mtimeMs
    && left.size === right.size
    && left.contentHash === right.contentHash
    && left.ownerToken === right.ownerToken;
}

function directorySnapshotMatches(left, right, includeMutableFields = false) {
  if (
    left.ownerToken !== right.ownerToken
    || !sameLockIdentity(left.directoryIdentity, right.directoryIdentity)
    || !sameLockIdentity(left.markerIdentity, right.markerIdentity)
  ) return false;
  return !includeMutableFields || (
    left.mtimeMs === right.mtimeMs
    && left.size === right.size
    && left.contentHash === right.contentHash
  );
}

function retiringSnapshotMatches(left, right) {
  return left.ownerToken === right.ownerToken
    && sameLockIdentity(left.directoryIdentity, right.directoryIdentity)
    && sameLockIdentity(left.markerIdentity, right.markerIdentity);
}

function ownerMarkerName(ownerToken) {
  return `owner-${ownerToken}.json`;
}

function isLockContentionError(error) {
  return new Set(["EACCES", "EEXIST", "EISDIR", "ENOTDIR", "ENOTEMPTY", "EPERM"]).has(error?.code);
}

function isTransientLockRaceError(error) {
  return new Set(["EACCES", "EBUSY", "EISDIR", "ENOTDIR", "EPERM"]).has(error?.code);
}

function isWindowsTransientMarkerError(error) {
  return new Set(["EACCES", "EBUSY", "EPERM"]).has(error?.code);
}

function lockMarkerTransitionFailure(error) {
  return new HextrisSessionStoreError(
    "Unable to transition the local Hextris session lock marker.",
    "HEXTRIS_LOCK_MARKER_TRANSITION_FAILED",
    { cause: error }
  );
}

function isLockMarkerTransitionFailure(error) {
  return error instanceof HextrisSessionStoreError
    && error.code === "HEXTRIS_LOCK_MARKER_TRANSITION_FAILED";
}

function markLocalAbandonedOwner(lockPath, lock) {
  if (
    typeof lockPath !== "string"
    || !OWNER_TOKEN_PATTERN.test(lock?.ownerToken)
    || !lock?.directoryIdentity
    || !lock?.markerIdentity
  ) return;
  clearLocalAbandonedOwnersForPath(lockPath);
  LOCAL_ABANDONED_OWNERS.delete(lock.ownerToken);
  LOCAL_ABANDONED_OWNERS.set(lock.ownerToken, {
    lockPath,
    directoryIdentity: { ...lock.directoryIdentity },
    markerIdentity: { ...lock.markerIdentity }
  });
  while (LOCAL_ABANDONED_OWNERS.size > MAX_LOCAL_ABANDONED_OWNERS) {
    LOCAL_ABANDONED_OWNERS.delete(LOCAL_ABANDONED_OWNERS.keys().next().value);
  }
}

function isExactLocalAbandonedOwner(lockPath, lock) {
  const abandoned = LOCAL_ABANDONED_OWNERS.get(lock?.ownerToken);
  return Boolean(
    abandoned
    && abandoned.lockPath === lockPath
    && sameLockIdentity(abandoned.directoryIdentity, lock.directoryIdentity)
    && sameLockIdentity(abandoned.markerIdentity, lock.markerIdentity)
    && lock.record?.pid === process.pid
    && lock.record?.processInstanceToken === PROCESS_INSTANCE_TOKEN
  );
}

function clearLocalAbandonedOwner(ownerToken) {
  LOCAL_ABANDONED_OWNERS.delete(ownerToken);
}

function clearLocalAbandonedOwnersForPath(lockPath) {
  for (const [ownerToken, abandoned] of LOCAL_ABANDONED_OWNERS) {
    if (abandoned.lockPath === lockPath) LOCAL_ABANDONED_OWNERS.delete(ownerToken);
  }
}

function pruneLocalAbandonedOwners(lockPath, observed) {
  for (const [ownerToken, abandoned] of LOCAL_ABANDONED_OWNERS) {
    if (abandoned.lockPath !== lockPath) continue;
    if (
      ownerToken !== observed.ownerToken
      || !sameLockIdentity(abandoned.directoryIdentity, observed.directoryIdentity)
      || !sameLockIdentity(abandoned.markerIdentity, observed.markerIdentity)
    ) LOCAL_ABANDONED_OWNERS.delete(ownerToken);
  }
}

async function regularFileExists(filePath) {
  try {
    const stat = await fs.lstat(filePath);
    if (!stat.isFile() || stat.isSymbolicLink()) throw invalidSessionFile();
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function pathExists(filePath) {
  try {
    await fs.lstat(filePath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw storageError(error, "Unable to inspect the local Hextris session directory.");
  }
}

async function syncDirectory(directory) {
  let handle;
  try {
    handle = await fs.open(directory, "r");
    await handle.sync();
  } catch (error) {
    if (process.platform !== "win32" && !new Set(["EINVAL", "ENOTSUP", "EISDIR", "EPERM"]).has(error?.code)) {
      throw error;
    }
  } finally {
    await handle?.close().catch(() => {});
  }
}

function normalizeSessionId(value) {
  if (typeof value !== "string" || !HEXTRIS_SESSION_ID_PATTERN.test(value)) {
    throw new HextrisSessionStoreError("The Hextris session id is invalid.", "HEXTRIS_SESSION_ID_INVALID");
  }
  return value;
}

function assertExactKeys(value, expectedKeys, code) {
  const actual = Reflect.ownKeys(value);
  if (actual.some((key) => typeof key !== "string")) {
    throw new HextrisSessionStoreError("An object contains unsupported fields.", code);
  }
  actual.sort();
  const expected = [...expectedKeys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new HextrisSessionStoreError("An object contains unsupported fields.", code);
  }
}

function isPlainRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function boundedOption(value, minimum, maximum, fallback, name) {
  if (value === undefined) return fallback;
  if (
    typeof value !== "number"
    || !Number.isSafeInteger(value)
    || value < minimum
    || value > maximum
  ) {
    throw new HextrisSessionStoreError(`${name} is outside its supported range.`, "HEXTRIS_STORE_OPTIONS_INVALID");
  }
  return value;
}

function toIso(value) {
  return new Date(value).toISOString();
}

function invalidSessionFile() {
  return new HextrisSessionStoreError(
    "The local Hextris session file is invalid.",
    "HEXTRIS_SESSION_FILE_INVALID"
  );
}

function lockOwnershipLost() {
  return new HextrisSessionStoreError(
    "The local Hextris session lock ownership changed unexpectedly.",
    "HEXTRIS_LOCK_OWNERSHIP_LOST"
  );
}

function invalidLockFile() {
  return new HextrisSessionStoreError(
    "The local Hextris session lock is invalid.",
    "HEXTRIS_LOCK_INVALID"
  );
}

function engineError(error, message, fallbackCode) {
  if (error instanceof HextrisSessionStoreError) return error;
  return new HextrisSessionStoreError(message, String(error?.code || fallbackCode), { cause: error });
}

function storageError(error, message) {
  if (error instanceof HextrisSessionStoreError) return error;
  return new HextrisSessionStoreError(message, "HEXTRIS_STORAGE_ERROR", { cause: error });
}
