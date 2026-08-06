import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  TransferRoomSecret,
  deriveTransferRoomSecret
} from "./transfer-crypto.mjs";

const STATE_VERSION = 1;
const MAX_STATE_BYTES = 256 * 1024;
const MAX_WHITEBOARD_HANDLES = 128;
const LOCAL_STATE_LOCK_VERSION = 1;
const DEFAULT_LOCAL_STATE_LOCK_TIMEOUT_MS = 12_000;
const DEFAULT_LOCAL_STATE_LOCK_STALE_MS = 10_000;
const DEFAULT_LOCAL_STATE_LOCK_RETRY_MS = 15;
const MAX_LOCAL_STATE_LOCK_BYTES = 4 * 1024;
const LOCK_OWNER_TOKEN_PATTERN = /^[a-f0-9]{32}$/;
const LOCAL_STATE_LOCK_PROCESS_KEY = Symbol.for("lusu.local-state-lock-process.v1");
const LOCAL_STATE_LOCK_PROCESS = resolveLocalStateLockProcess();
const PROCESS_INSTANCE_TOKEN = LOCAL_STATE_LOCK_PROCESS.processToken;
const ACTIVE_LOCAL_STATE_LOCK_OWNERS = LOCAL_STATE_LOCK_PROCESS.activeOwners;

export class LocalStateError extends Error {
  constructor(message, code = "LOCAL_STATE_ERROR", options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = "LocalStateError";
    this.code = code;
  }
}

export function resolveConfigDirectory(options = {}) {
  const env = options.env || process.env;
  if (env.LUSU_CONFIG_DIR) return path.resolve(env.LUSU_CONFIG_DIR);
  if (env.APPDATA) return path.join(path.resolve(env.APPDATA), "lusu-cli");
  return path.join(options.homeDir || os.homedir(), ".config", "lusu-cli");
}

export async function readStoredCredential(options = {}) {
  const file = path.join(resolveConfigDirectory(options), "credentials.json");
  const payload = await readPrivateJson(file, { missing: null });
  if (!payload) return null;
  const accessToken = String(payload.accessToken || "").trim();
  if (!accessToken || /\s/.test(accessToken) || accessToken.length > 4096) {
    throw new LocalStateError("Stored credentials are invalid.", "AUTH_CREDENTIAL_INVALID");
  }
  return {
    accessToken,
    tokenType: payload.tokenType === "Bearer" ? "Bearer" : "Bearer",
    expiresAt: String(payload.expiresAt || ""),
    scopes: Array.isArray(payload.scopes) ? payload.scopes.map(String) : [],
    user: payload.user && typeof payload.user === "object" ? payload.user : null,
    baseUrl: String(payload.baseUrl || "")
  };
}

export async function writeStoredCredential(credential, options = {}) {
  const accessToken = String(credential?.accessToken || "").trim();
  if (!accessToken || /\s/.test(accessToken) || accessToken.length > 4096) {
    throw new LocalStateError("Access token is invalid.", "AUTH_TOKEN_INVALID");
  }
  const file = path.join(resolveConfigDirectory(options), "credentials.json");
  await writePrivateJson(file, {
    version: STATE_VERSION,
    accessToken,
    tokenType: "Bearer",
    expiresAt: String(credential.expiresAt || ""),
    scopes: Array.isArray(credential.scopes) ? credential.scopes.map(String) : [],
    user: credential.user && typeof credential.user === "object" ? credential.user : null,
    baseUrl: String(credential.baseUrl || ""),
    savedAt: new Date().toISOString()
  });
  return file;
}

export async function deleteStoredCredential(options = {}) {
  const file = path.join(resolveConfigDirectory(options), "credentials.json");
  try {
    await fs.unlink(file);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw new LocalStateError("Stored credentials could not be removed.", "AUTH_CREDENTIAL_DELETE_FAILED", { cause: error });
  }
}

export async function storeRoomHandle(secret, options = {}) {
  if (!(secret instanceof TransferRoomSecret)) {
    throw new LocalStateError("A derived Quick Transfer room secret is required.", "TRANSFER_ROOM_SECRET_REQUIRED");
  }
  const configDir = resolveConfigDirectory(options);
  const file = path.join(configDir, "rooms.json");
  const state = await readPrivateJson(file, { missing: { version: STATE_VERSION, rooms: {} } });
  if (!state.rooms || typeof state.rooms !== "object" || Array.isArray(state.rooms)) {
    throw new LocalStateError("Stored room handles are invalid.", "TRANSFER_ROOM_STATE_INVALID");
  }
  const roomHandle = options.roomHandle
    ? normalizeRoomHandle(options.roomHandle)
    : `room_${globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
  const secretRef = normalizeOptionalSecretRef(options.secretRef);
  state.version = STATE_VERSION;
  state.rooms[roomHandle] = {
    roomKey: secret.roomKey,
    ...(secretRef ? { secretRef } : {}),
    createdAt: state.rooms[roomHandle]?.createdAt || new Date().toISOString(),
    lastUsedAt: new Date().toISOString()
  };
  await writePrivateJson(file, state);
  return roomHandle;
}

export async function loadRoomRecord(roomHandle, options = {}) {
  const normalizedHandle = normalizeRoomHandle(roomHandle);
  const file = path.join(resolveConfigDirectory(options), "rooms.json");
  const state = await readPrivateJson(file, { missing: null });
  const record = state?.rooms?.[normalizedHandle];
  if (!record) {
    throw new LocalStateError("The Quick Transfer room handle was not found.", "TRANSFER_ROOM_HANDLE_NOT_FOUND");
  }
  const roomKey = String(record.roomKey || "").trim();
  if (!/^transfer_[A-Za-z0-9_-]{32,80}$/.test(roomKey) || record.textKey) {
    throw new LocalStateError(
      record.textKey
        ? "This room handle uses an obsolete key-persistence format; join the room again."
        : "The Quick Transfer room handle is invalid.",
      record.textKey ? "TRANSFER_ROOM_HANDLE_REJOIN_REQUIRED" : "TRANSFER_ROOM_STATE_INVALID"
    );
  }
  return Object.freeze({ roomHandle: normalizedHandle, roomKey, secretRef: normalizeOptionalSecretRef(record.secretRef) });
}

export async function loadRoomKey(roomHandle, options = {}) {
  return (await loadRoomRecord(roomHandle, options)).roomKey;
}

export async function loadRoomSecret(roomHandle, options = {}) {
  const record = await loadRoomRecord(roomHandle, options);
  let passphrase = options.passphrase;
  if (!passphrase && record.secretRef) {
    passphrase = await (options.secretResolver || resolveSecretRef)(record.secretRef, options);
  }
  if (!passphrase) {
    throw new LocalStateError(
      "The room text key is not persisted; provide the passphrase again.",
      "TRANSFER_ROOM_SECRET_REQUIRED"
    );
  }
  const secret = await deriveTransferRoomSecret(passphrase, options);
  if (!constantTimeTextEqual(secret.roomKey, record.roomKey)) {
    throw new LocalStateError("The passphrase does not match this room handle.", "TRANSFER_ROOM_SECRET_MISMATCH");
  }
  return secret;
}

export async function storeWhiteboardHandle(session, options = {}) {
  const accessToken = normalizeWhiteboardAccessToken(session?.accessToken);
  const roomType = session?.room?.type === "private" || session?.roomType === "private"
    ? "private"
    : "public";
  const accessExpiresAt = normalizeOptionalIsoDate(session?.accessExpiresAt);
  const secretRef = roomType === "private" ? normalizeOptionalSecretRef(options.secretRef) : "";
  const file = path.join(resolveConfigDirectory(options), "whiteboards.json");
  const boardHandle = options.boardHandle
    ? normalizeWhiteboardHandle(options.boardHandle)
    : `board_${globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
  return withPrivateFileLock(file, options, async () => {
    const state = await readPrivateJson(file, { missing: { version: STATE_VERSION, boards: {} } });
    if (!state.boards || typeof state.boards !== "object" || Array.isArray(state.boards)) {
      throw new LocalStateError("Stored whiteboard handles are invalid.", "WHITEBOARD_STATE_INVALID");
    }
    const now = new Date().toISOString();
    state.version = STATE_VERSION;
    state.boards[boardHandle] = {
      accessToken,
      roomType,
      accessExpiresAt,
      ...(secretRef ? { secretRef } : {}),
      createdAt: state.boards[boardHandle]?.createdAt || now,
      lastUsedAt: now
    };
    pruneOldWhiteboardHandles(state.boards, boardHandle);
    await writePrivateJson(file, state);
    return boardHandle;
  });
}

export async function loadWhiteboardRecord(boardHandle, options = {}) {
  const normalizedHandle = normalizeWhiteboardHandle(boardHandle);
  const file = path.join(resolveConfigDirectory(options), "whiteboards.json");
  const state = await readPrivateJson(file, { missing: null });
  const record = state?.boards?.[normalizedHandle];
  if (!record) {
    throw new LocalStateError("The whiteboard handle was not found.", "WHITEBOARD_HANDLE_NOT_FOUND");
  }
  const roomType = record.roomType === "private" ? "private" : record.roomType === "public" ? "public" : "";
  if (!roomType) {
    throw new LocalStateError("The stored whiteboard room type is invalid.", "WHITEBOARD_STATE_INVALID");
  }
  return Object.freeze({
    boardHandle: normalizedHandle,
    accessToken: normalizeWhiteboardAccessToken(record.accessToken),
    roomType,
    accessExpiresAt: normalizeOptionalIsoDate(record.accessExpiresAt),
    secretRef: normalizeOptionalSecretRef(record.secretRef)
  });
}

export async function resolveSecretRef(secretRef, options = {}) {
  const reference = String(secretRef || "").trim();
  const match = reference.match(/^env:([A-Z][A-Z0-9_]{2,80})$/);
  if (!match) {
    throw new LocalStateError(
      "secretRef must identify an environment variable, for example env:LUSU_TRANSFER_SECRET.",
      "SECRET_REF_INVALID"
    );
  }
  const env = options.env || process.env;
  const value = env[match[1]];
  if (!value) {
    throw new LocalStateError("The referenced local secret is unavailable.", "SECRET_REF_NOT_FOUND");
  }
  return value;
}

export async function resolveAllowRoots(options = {}) {
  const env = options.env || process.env;
  const configured = options.allowRoots || String(env.LUSU_MCP_ALLOW_ROOT || "")
    .split(path.delimiter).filter(Boolean);
  const requested = configured.length ? configured : [options.defaultRoot || process.cwd()];
  const roots = [];
  for (const root of requested) {
    const real = await fs.realpath(path.resolve(root));
    if (!roots.includes(real)) roots.push(real);
  }
  return roots;
}

export async function resolveReadableFileRef(fileRef, allowRoots) {
  const target = resolveFileRef(fileRef, allowRoots);
  let real;
  try {
    real = await fs.realpath(target);
  } catch (error) {
    throw new LocalStateError("The referenced input file does not exist.", "FILE_REF_NOT_FOUND", { cause: error });
  }
  assertInsideRoots(real, allowRoots);
  const stat = await fs.stat(real);
  if (!stat.isFile()) throw new LocalStateError("The referenced input is not a regular file.", "FILE_REF_NOT_FILE");
  return { path: real, sizeBytes: stat.size };
}

export async function resolveWritableFileRef(fileRef, allowRoots) {
  const target = resolveFileRef(fileRef, allowRoots);
  const parent = await fs.realpath(path.dirname(target)).catch((error) => {
    throw new LocalStateError("The destination directory does not exist.", "FILE_REF_PARENT_NOT_FOUND", { cause: error });
  });
  const resolvedTarget = path.join(parent, path.basename(target));
  assertInsideRoots(resolvedTarget, allowRoots);
  try {
    await fs.lstat(resolvedTarget);
    throw new LocalStateError("The destination already exists; downloads never overwrite files.", "FILE_ALREADY_EXISTS");
  } catch (error) {
    if (error instanceof LocalStateError) throw error;
    if (error?.code !== "ENOENT") {
      throw new LocalStateError("The destination could not be inspected.", "FILE_REF_INSPECTION_FAILED", { cause: error });
    }
  }
  return resolvedTarget;
}

export async function openNoClobberSink(destination) {
  let handle;
  try {
    handle = await fs.open(destination, "wx", 0o600);
  } catch (error) {
    if (error?.code === "EEXIST") {
      throw new LocalStateError("The destination already exists; downloads never overwrite files.", "FILE_ALREADY_EXISTS");
    }
    throw new LocalStateError("The destination could not be opened.", "FILE_OPEN_FAILED", { cause: error });
  }
  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    await handle.close();
  };
  return {
    sink: {
      async write(chunk) {
        const bytes = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
        let offset = 0;
        while (offset < bytes.byteLength) {
          const result = await handle.write(bytes, offset, bytes.byteLength - offset, null);
          if (!result.bytesWritten) {
            throw new LocalStateError("The destination stopped accepting data.", "FILE_WRITE_INCOMPLETE");
          }
          offset += result.bytesWritten;
        }
        return true;
      },
      close,
      async abort() {
        await close();
      }
    },
    close,
    async cleanup() {
      await close().catch(() => {});
      await fs.unlink(destination).catch(() => {});
    }
  };
}

export function normalizeRoomHandle(value) {
  const handle = String(value || "").trim();
  if (!/^room_[a-zA-Z0-9_-]{12,80}$/.test(handle)) {
    throw new LocalStateError("The Quick Transfer room handle is invalid.", "TRANSFER_ROOM_HANDLE_INVALID");
  }
  return handle;
}

export function normalizeWhiteboardHandle(value) {
  const handle = String(value || "").trim();
  if (!/^board_[a-zA-Z0-9_-]{12,80}$/.test(handle)) {
    throw new LocalStateError("The whiteboard handle is invalid.", "WHITEBOARD_HANDLE_INVALID");
  }
  return handle;
}

async function readPrivateJson(file, options = {}) {
  let stat;
  try {
    stat = await fs.stat(file);
  } catch (error) {
    if (error?.code === "ENOENT") return options.missing;
    throw new LocalStateError("Local state could not be read.", "LOCAL_STATE_READ_FAILED", { cause: error });
  }
  if (!stat.isFile() || stat.size > MAX_STATE_BYTES) {
    throw new LocalStateError("Local state is invalid or too large.", "LOCAL_STATE_INVALID");
  }
  try {
    const payload = JSON.parse(await fs.readFile(file, "utf8"));
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("invalid object");
    return payload;
  } catch (error) {
    throw new LocalStateError("Local state contains invalid JSON.", "LOCAL_STATE_INVALID", { cause: error });
  }
}

async function writePrivateJson(file, payload) {
  const text = `${JSON.stringify(payload, null, 2)}\n`;
  if (Buffer.byteLength(text, "utf8") > MAX_STATE_BYTES) {
    throw new LocalStateError("Local state is too large.", "LOCAL_STATE_TOO_LARGE");
  }
  const directory = path.dirname(file);
  const temporary = path.join(
    directory,
    `.${path.basename(file)}.${process.pid}.${randomUUID().replace(/-/g, "")}.tmp`
  );
  let handle;
  try {
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    handle = await fs.open(temporary, "wx", 0o600);
    await handle.writeFile(text, "utf8");
    await handle.sync();
    await handle.close();
    handle = null;
    await fs.chmod(temporary, 0o600).catch(() => {});
    await fs.rename(temporary, file);
    await fs.chmod(file, 0o600).catch(() => {});
  } catch (error) {
    await handle?.close().catch(() => {});
    await fs.unlink(temporary).catch(() => {});
    if (error instanceof LocalStateError) throw error;
    throw new LocalStateError("Local state could not be written.", "LOCAL_STATE_WRITE_FAILED", { cause: error });
  }
}

async function withPrivateFileLock(file, options, callback) {
  const directory = path.dirname(file);
  const lockFile = `${file}.lock`;
  const timeoutMs = boundedLockOption(
    options.localStateLockTimeoutMs,
    DEFAULT_LOCAL_STATE_LOCK_TIMEOUT_MS,
    100,
    120_000,
    "localStateLockTimeoutMs"
  );
  const staleMs = boundedLockOption(
    options.localStateLockStaleMs,
    DEFAULT_LOCAL_STATE_LOCK_STALE_MS,
    25,
    120_000,
    "localStateLockStaleMs"
  );
  const retryMs = boundedLockOption(
    options.localStateLockRetryMs,
    DEFAULT_LOCAL_STATE_LOCK_RETRY_MS,
    1,
    1_000,
    "localStateLockRetryMs"
  );
  const owner = {
    version: LOCAL_STATE_LOCK_VERSION,
    ownerToken: randomUUID().replace(/-/g, ""),
    processToken: PROCESS_INSTANCE_TOKEN,
    pid: process.pid,
    createdAt: Date.now()
  };
  const startedAt = Date.now();
  let handle;

  try {
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  } catch (error) {
    throw new LocalStateError("The local state directory could not be created.", "LOCAL_STATE_LOCK_FAILED", { cause: error });
  }

  while (!handle) {
    try {
      const candidate = await fs.open(lockFile, "wx", 0o600);
      try {
        await candidate.writeFile(`${JSON.stringify(owner)}\n`, "utf8");
        await candidate.sync();
        const verifiedOwner = await readLockOwner(lockFile);
        if (verifiedOwner?.ownerToken !== owner.ownerToken) {
          throw new LocalStateError(
            "The local state lock changed while it was being initialized.",
            "LOCAL_STATE_LOCK_FAILED"
          );
        }
        ACTIVE_LOCAL_STATE_LOCK_OWNERS.add(owner.ownerToken);
        handle = candidate;
      } catch (error) {
        await candidate.close().catch(() => {});
        await releaseOwnedLock(lockFile, owner.ownerToken);
        if (error instanceof LocalStateError) throw error;
        throw new LocalStateError("The local state lock could not be initialized.", "LOCAL_STATE_LOCK_FAILED", { cause: error });
      }
    } catch (error) {
      if (error instanceof LocalStateError) throw error;
      if (error?.code !== "EEXIST") {
        throw new LocalStateError("The local state lock could not be created.", "LOCAL_STATE_LOCK_FAILED", { cause: error });
      }
      if (await removeStaleLock(lockFile, staleMs)) continue;
      const elapsed = Date.now() - startedAt;
      if (elapsed >= timeoutMs) {
        throw new LocalStateError("The local state is busy.", "LOCAL_STATE_LOCK_TIMEOUT");
      }
      await delay(Math.min(retryMs, Math.max(1, timeoutMs - elapsed)));
    }
  }

  try {
    return await callback();
  } finally {
    await handle.close().catch(() => {});
    await releaseOwnedLock(lockFile, owner.ownerToken);
    ACTIVE_LOCAL_STATE_LOCK_OWNERS.delete(owner.ownerToken);
  }
}

async function removeStaleLock(lockFile, staleMs) {
  const stat = await fs.stat(lockFile).catch((error) => {
    if (error?.code === "ENOENT") return null;
    throw new LocalStateError("The local state lock could not be inspected.", "LOCAL_STATE_LOCK_FAILED", { cause: error });
  });
  if (!stat || Date.now() - stat.mtimeMs < staleMs) return !stat;

  const owner = await readLockOwner(lockFile);
  if (owner && lockOwnerAppearsAlive(owner)) return false;

  const confirmedOwner = await readLockOwner(lockFile);
  if (
    owner?.ownerToken &&
    confirmedOwner?.ownerToken !== owner.ownerToken
  ) {
    return false;
  }
  if (confirmedOwner && lockOwnerAppearsAlive(confirmedOwner)) return false;

  try {
    await fs.unlink(lockFile);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return true;
    if (error?.code === "EACCES" || error?.code === "EPERM" || error?.code === "EBUSY") return false;
    throw new LocalStateError("The stale local state lock could not be removed.", "LOCAL_STATE_LOCK_FAILED", { cause: error });
  }
}

async function releaseOwnedLock(lockFile, ownerToken) {
  try {
    const owner = await readLockOwner(lockFile);
    if (owner?.ownerToken !== ownerToken) return false;
    await fs.unlink(lockFile);
    return true;
  } catch {
    return false;
  }
}

async function readLockOwner(lockFile) {
  let stat;
  try {
    stat = await fs.stat(lockFile);
    if (!stat.isFile() || stat.size < 2 || stat.size > MAX_LOCAL_STATE_LOCK_BYTES) return null;
    const parsed = JSON.parse(await fs.readFile(lockFile, "utf8"));
    if (
      parsed?.version !== LOCAL_STATE_LOCK_VERSION ||
      !LOCK_OWNER_TOKEN_PATTERN.test(String(parsed.ownerToken || "")) ||
      !LOCK_OWNER_TOKEN_PATTERN.test(String(parsed.processToken || "")) ||
      !Number.isSafeInteger(parsed.pid) ||
      parsed.pid <= 0 ||
      !Number.isSafeInteger(parsed.createdAt) ||
      parsed.createdAt <= 0
    ) {
      return null;
    }
    return {
      ownerToken: parsed.ownerToken,
      processToken: parsed.processToken,
      pid: parsed.pid,
      createdAt: parsed.createdAt
    };
  } catch (error) {
    if (error?.code === "ENOENT" || error instanceof SyntaxError) return null;
    return null;
  }
}

function lockOwnerAppearsAlive(owner) {
  if (owner.pid === process.pid) {
    return owner.processToken === PROCESS_INSTANCE_TOKEN &&
      ACTIVE_LOCAL_STATE_LOCK_OWNERS.has(owner.ownerToken);
  }
  return processAppearsAlive(owner.pid);
}

function processAppearsAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code !== "ESRCH";
  }
}

function resolveLocalStateLockProcess() {
  const existing = globalThis[LOCAL_STATE_LOCK_PROCESS_KEY];
  if (
    existing &&
    LOCK_OWNER_TOKEN_PATTERN.test(String(existing.processToken || "")) &&
    existing.activeOwners instanceof Set
  ) {
    return existing;
  }
  const created = Object.freeze({
    processToken: randomUUID().replace(/-/g, ""),
    activeOwners: new Set()
  });
  Object.defineProperty(globalThis, LOCAL_STATE_LOCK_PROCESS_KEY, {
    value: created,
    configurable: false,
    enumerable: false,
    writable: false
  });
  return created;
}

function boundedLockOption(value, fallback, minimum, maximum, label) {
  const numeric = value === undefined ? fallback : Number(value);
  if (!Number.isSafeInteger(numeric) || numeric < minimum || numeric > maximum) {
    throw new LocalStateError(`${label} is outside its supported bound.`, "LOCAL_STATE_LOCK_OPTIONS_INVALID");
  }
  return numeric;
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function resolveFileRef(fileRef, allowRoots) {
  if (!Array.isArray(allowRoots) || !allowRoots.length) {
    throw new LocalStateError("At least one allowed file root is required.", "FILE_ALLOW_ROOT_REQUIRED");
  }
  const reference = String(fileRef || "").trim().replace(/^file:/, "");
  if (!reference || reference.includes("\0")) {
    throw new LocalStateError("fileRef is invalid.", "FILE_REF_INVALID");
  }
  const target = path.isAbsolute(reference)
    ? path.resolve(reference)
    : path.resolve(allowRoots[0], reference);
  assertInsideRoots(target, allowRoots);
  return target;
}

function assertInsideRoots(target, roots) {
  const inside = roots.some((root) => {
    const relative = path.relative(root, target);
    return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
  });
  if (!inside) {
    throw new LocalStateError("The file reference is outside the configured allow-root.", "FILE_REF_OUTSIDE_ALLOW_ROOT");
  }
}

function normalizeOptionalSecretRef(value) {
  const reference = String(value || "").trim();
  if (!reference) return "";
  if (!/^env:[A-Z][A-Z0-9_]{2,80}$/.test(reference)) {
    throw new LocalStateError("The stored secretRef is invalid.", "SECRET_REF_INVALID");
  }
  return reference;
}

function normalizeWhiteboardAccessToken(value) {
  const token = String(value || "").trim();
  if (!/^wbt1\.[!#$%&'*+\-.^_`|~0-9A-Za-z]{20,4090}$/.test(token)) {
    throw new LocalStateError("The whiteboard access token is invalid.", "WHITEBOARD_ACCESS_TOKEN_INVALID");
  }
  return token;
}

function normalizeOptionalIsoDate(value) {
  const date = String(value || "").trim();
  if (!date) return "";
  const timestamp = Date.parse(date);
  if (!Number.isFinite(timestamp)) {
    throw new LocalStateError("The stored whiteboard expiry is invalid.", "WHITEBOARD_STATE_INVALID");
  }
  return new Date(timestamp).toISOString();
}

function pruneOldWhiteboardHandles(boards, preserveHandle) {
  const entries = Object.entries(boards);
  if (entries.length <= MAX_WHITEBOARD_HANDLES) return;
  entries
    .filter(([handle]) => handle !== preserveHandle)
    .sort((left, right) => String(left[1]?.lastUsedAt || "").localeCompare(String(right[1]?.lastUsedAt || "")))
    .slice(0, entries.length - MAX_WHITEBOARD_HANDLES)
    .forEach(([handle]) => { delete boards[handle]; });
}

function constantTimeTextEqual(left, right) {
  const leftBytes = Buffer.from(String(left));
  const rightBytes = Buffer.from(String(right));
  const length = Math.max(leftBytes.length, rightBytes.length);
  let mismatch = leftBytes.length ^ rightBytes.length;
  for (let index = 0; index < length; index += 1) {
    mismatch |= (leftBytes[index % leftBytes.length] || 0) ^ (rightBytes[index % rightBytes.length] || 0);
  }
  return mismatch === 0;
}
