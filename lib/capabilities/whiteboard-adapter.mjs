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
  renderWhiteboardExport,
  summarizeWhiteboardScene
} from "./whiteboard-scene.mjs";

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
  const prepared = createWhiteboardIncrementalUpdate(loaded.remote.updateBytes, request, {
    operationNamespace: loaded.record.boardHandle
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
  let record = await loadWhiteboardRecord(boardHandle, stateOptions);
  try {
    return {
      record,
      remote: await client.getWhiteboardScene(record.accessToken, { signal: options.signal })
    };
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
  return {
    record,
    remote: await client.getWhiteboardScene(record.accessToken, { signal: options.signal })
  };
}
