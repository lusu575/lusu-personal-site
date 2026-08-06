import { promises as fs } from "node:fs";
import path from "node:path";
import { SiteClientError } from "./site-client.mjs";
import {
  LocalStateError,
  loadWhiteboardRecord,
  resolveSecretRef,
  storeWhiteboardHandle
} from "./local-state.mjs";
import {
  createWhiteboardIncrementalUpdate,
  decodeWhiteboardScene,
  parseWhiteboardRasterAsset,
  renderWhiteboardExport,
  summarizeWhiteboardScene,
  WhiteboardSceneError
} from "./whiteboard-scene.mjs";

const MAX_WHITEBOARD_ASSET_BYTES = 5 * 1024 * 1024;
const MAX_WHITEBOARD_ELEMENTS_PER_OPERATION = 50;
const WHITEBOARD_ASSET_ID_PATTERN = /^[a-f0-9]{32}$/;

export async function joinWhiteboardHandle(client, options = {}, stateOptions = {}) {
  const type = options.type === "private" ? "private" : "public";
  const session = await client.joinWhiteboardRoom({
    type,
    ...(type === "private" ? { password: options.password } : {}),
    signal: options.signal
  });
  const boardHandle = await storeWhiteboardHandle(session, {
    ...stateOptions,
    secretRef: options.secretRef
  });
  return {
    boardHandle,
    room: { type },
    accessExpiresAt: String(session.accessExpiresAt || "")
  };
}

export async function readWhiteboardHandle(client, boardHandle, stateOptions = {}, options = {}) {
  const loaded = await fetchWhiteboardScene(client, boardHandle, stateOptions, options);
  const scene = decodeWhiteboardScene(loaded.remote.updateBytes);
  return {
    boardHandle: loaded.record.boardHandle,
    room: { type: loaded.record.roomType },
    documentVersion: loaded.remote.documentVersion,
    locked: loaded.remote.locked,
    ...summarizeWhiteboardScene(scene)
  };
}

export async function drawWhiteboardHandle(client, boardHandle, request, stateOptions = {}, options = {}) {
  const loaded = await fetchWhiteboardScene(client, boardHandle, stateOptions, options);
  if (loaded.remote.locked) {
    throw new SiteClientError("The whiteboard is locked.", {
      code: "WHITEBOARD_LOCKED",
      status: 423,
      method: "POST",
      path: "/api/whiteboard/agent/scene"
    });
  }
  const assetMetadata = await verifyRequestedImageAssets(client, loaded.record, request?.elements, options);
  const prepared = createWhiteboardIncrementalUpdate(loaded.remote.updateBytes, request, {
    operationNamespace: loaded.record.boardHandle,
    assetMetadata
  });
  let applied = {
    ok: true,
    replayed: true,
    documentVersion: loaded.remote.documentVersion
  };
  if (prepared.updateBytes) {
    applied = await client.applyWhiteboardUpdate(loaded.record.accessToken, prepared.updateBytes, {
      operationId: prepared.operationId,
      signal: options.signal
    });
  }
  return {
    boardHandle: loaded.record.boardHandle,
    operationId: prepared.operationId,
    replayed: Boolean(prepared.replayed || applied.replayed),
    documentVersion: Number(applied.documentVersion || loaded.remote.documentVersion || 0),
    addedElements: prepared.addedElements,
    scene: summarizeWhiteboardScene(prepared.scene)
  };
}

export async function inspectWhiteboardAssetPath(filePath) {
  let realPath;
  try {
    realPath = await fs.realpath(path.resolve(String(filePath || "")));
  } catch (error) {
      throw new LocalStateError("The whiteboard image file does not exist.", "WHITEBOARD_ASSET_FILE_NOT_FOUND", { cause: error });
  }
  let handle;
  try {
    handle = await fs.open(realPath, "r");
    const confirmedRealPath = await fs.realpath(realPath);
    if (!sameLocalPath(realPath, confirmedRealPath)) {
      throw new LocalStateError("The whiteboard image changed while it was being opened.", "WHITEBOARD_ASSET_FILE_CHANGED");
    }
    const stat = await handle.stat();
    if (!stat.isFile()) {
      throw new LocalStateError("The whiteboard image input is not a regular file.", "WHITEBOARD_ASSET_FILE_NOT_REGULAR");
    }
    if (stat.size < 1 || stat.size > MAX_WHITEBOARD_ASSET_BYTES) {
      throw new LocalStateError("The whiteboard image must contain 1-5242880 bytes.", "WHITEBOARD_ASSET_FILE_SIZE_INVALID");
    }
    const bytes = new Uint8Array(await handle.readFile());
    if (bytes.byteLength !== stat.size) {
      throw new LocalStateError("The whiteboard image changed while it was being read.", "WHITEBOARD_ASSET_FILE_CHANGED");
    }
    const metadata = parseWhiteboardRasterAsset(bytes);
    return { path: realPath, sizeBytes: stat.size, bytes, ...metadata };
  } finally {
    await handle?.close();
  }
}

export async function uploadWhiteboardAssetHandle(
  client,
  boardHandle,
  fileInput,
  operationId,
  stateOptions = {},
  options = {}
) {
  const inspected = typeof fileInput === "string"
    ? await inspectWhiteboardAssetPath(fileInput)
    : normalizeInspectedAsset(fileInput);
  const loaded = await withWhiteboardAccess(client, boardHandle, stateOptions, options, (record) => (
    client.uploadWhiteboardAsset(record.accessToken, {
      contentType: inspected.contentType,
      sizeBytes: inspected.sizeBytes,
      body: inspected.bytes
    }, { operationId, signal: options.signal })
  ));
  const asset = normalizeUploadedAsset(loaded.value, inspected);
  return {
    replayed: Boolean(loaded.value?.replayed),
    asset
  };
}

export async function downloadWhiteboardAssetHandle(
  client,
  boardHandle,
  assetId,
  writable,
  stateOptions = {},
  options = {}
) {
  const loaded = await withWhiteboardAccess(client, boardHandle, stateOptions, options, (record) => (
    client.getWhiteboardAsset(record.accessToken, assetId, { signal: options.signal })
  ));
  const parsed = parseWhiteboardRasterAsset(loaded.value.bytes, loaded.value.contentType);
  await writeAssetBytes(writable, loaded.value.bytes);
  if (options.close !== false) await closeAssetWritable(writable);
  return {
    assetId: loaded.value.assetId,
    contentType: parsed.contentType,
    byteLength: parsed.byteLength,
    width: parsed.width,
    height: parsed.height,
    bytesWritten: loaded.value.bytes.byteLength
  };
}

export async function exportWhiteboardHandle(client, boardHandle, format, stateOptions = {}, options = {}) {
  const loaded = await fetchWhiteboardScene(client, boardHandle, stateOptions, options);
  const scene = decodeWhiteboardScene(loaded.remote.updateBytes);
  const exported = await renderWhiteboardExport(scene, format);
  return {
    boardHandle: loaded.record.boardHandle,
    room: { type: loaded.record.roomType },
    documentVersion: loaded.remote.documentVersion,
    locked: loaded.remote.locked,
    elementCount: summarizeWhiteboardScene(scene).elementCount,
    ...exported
  };
}

async function fetchWhiteboardScene(client, boardHandle, stateOptions, options) {
  const loaded = await withWhiteboardAccess(client, boardHandle, stateOptions, options, (record) => (
    client.getWhiteboardScene(record.accessToken, { signal: options.signal })
  ));
  return { record: loaded.record, remote: loaded.value };
}

async function withWhiteboardAccess(client, boardHandle, stateOptions, options, action) {
  let record = await loadWhiteboardRecord(boardHandle, stateOptions);
  try {
    return { record, value: await action(record) };
  } catch (error) {
    if (!(error instanceof SiteClientError) || error.status !== 401) throw error;
  }

  const secretResolver = stateOptions.secretResolver || resolveSecretRef;
  let password;
  if (record.roomType === "private") {
    if (!record.secretRef) {
      throw new LocalStateError(
        "The private whiteboard credential expired; join the room again with its password.",
        "WHITEBOARD_REJOIN_REQUIRED"
      );
    }
    password = await secretResolver(record.secretRef, stateOptions);
  }
  const session = await client.joinWhiteboardRoom({
    type: record.roomType,
    ...(record.roomType === "private" ? { password } : {}),
    signal: options.signal
  });
  await storeWhiteboardHandle(session, {
    ...stateOptions,
    boardHandle: record.boardHandle,
    secretRef: record.secretRef
  });
  record = await loadWhiteboardRecord(boardHandle, stateOptions);
  return { record, value: await action(record) };
}

async function verifyRequestedImageAssets(client, record, elements, options) {
  if (!Array.isArray(elements) || elements.length < 1 || elements.length > MAX_WHITEBOARD_ELEMENTS_PER_OPERATION) {
    throw new WhiteboardSceneError(
      `A draw operation requires 1-${MAX_WHITEBOARD_ELEMENTS_PER_OPERATION} elements.`,
      "WHITEBOARD_ELEMENTS_INVALID"
    );
  }
  const assetIds = [];
  const seenAssetIds = new Set();
  for (const element of elements) {
    if (String(element?.type || "").trim().toLowerCase() !== "image") continue;
    const assetId = String(element?.assetId || "").trim();
    if (!WHITEBOARD_ASSET_ID_PATTERN.test(assetId)) {
      throw new WhiteboardSceneError(
        "A valid whiteboard asset id is required.",
        "WHITEBOARD_ASSET_ID_INVALID"
      );
    }
    if (!seenAssetIds.has(assetId)) {
      seenAssetIds.add(assetId);
      assetIds.push(assetId);
    }
  }
  const verified = new Map();
  for (const assetId of assetIds) {
    const fetched = await client.getWhiteboardAsset(record.accessToken, assetId, { signal: options.signal });
    const parsed = parseWhiteboardRasterAsset(fetched.bytes, fetched.contentType);
    verified.set(assetId, {
      assetId,
      contentType: parsed.contentType,
      byteLength: parsed.byteLength,
      width: parsed.width,
      height: parsed.height,
      version: 1
    });
  }
  return verified;
}

function normalizeUploadedAsset(payload, inspected) {
  const source = payload?.asset;
  const assetId = String(source?.assetId || "");
  const metadata = {
    assetId,
    contentType: String(source?.contentType || "").toLowerCase(),
    byteLength: Number(source?.byteLength),
    width: Number(source?.width),
    height: Number(source?.height),
    version: 1
  };
  if (!/^[a-f0-9]{32}$/.test(assetId)
    || metadata.contentType !== inspected.contentType
    || metadata.byteLength !== inspected.byteLength
    || metadata.width !== inspected.width
    || metadata.height !== inspected.height) {
    throw new SiteClientError("The whiteboard image upload response is invalid.", {
      code: "WHITEBOARD_ASSET_RESPONSE_INVALID",
      method: "POST",
      path: "/api/whiteboard/agent/assets"
    });
  }
  return metadata;
}

function normalizeInspectedAsset(value) {
  const bytes = value?.bytes instanceof Uint8Array
    ? value.bytes
    : value?.bytes instanceof ArrayBuffer
      ? new Uint8Array(value.bytes)
      : null;
  if (!bytes || !bytes.byteLength || bytes.byteLength > MAX_WHITEBOARD_ASSET_BYTES
    || Number(value?.sizeBytes) !== bytes.byteLength) {
    throw new LocalStateError("The inspected whiteboard image is invalid.", "WHITEBOARD_ASSET_FILE_CHANGED");
  }
  const metadata = parseWhiteboardRasterAsset(bytes);
  return { bytes, sizeBytes: bytes.byteLength, ...metadata };
}

async function writeAssetBytes(writable, bytes) {
  if (!writable) throw new TypeError("A writable destination is required.");
  if (typeof writable.getWriter === "function") {
    const writer = writable.getWriter();
    try { await writer.write(bytes); } finally { writer.releaseLock?.(); }
    return;
  }
  const result = writable.write(bytes);
  if (result && typeof result.then === "function") await result;
  else if (result === false) await new Promise((resolve, reject) => {
    writable.once("drain", resolve);
    writable.once("error", reject);
  });
}

async function closeAssetWritable(writable) {
  if (typeof writable.getWriter === "function") {
    const writer = writable.getWriter();
    try { await writer.close(); } finally { writer.releaseLock?.(); }
  } else if (typeof writable.close === "function") {
    await writable.close();
  } else if (typeof writable.end === "function") {
    await new Promise((resolve, reject) => writable.end((error) => error ? reject(error) : resolve()));
  }
}

function sameLocalPath(left, right) {
  const normalize = (value) => process.platform === "win32"
    ? path.normalize(value).toLowerCase()
    : path.normalize(value);
  return normalize(left) === normalize(right);
}
