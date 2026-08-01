import assert from "node:assert/strict";
import test from "node:test";
import * as Y from "yjs";
import { REMOTE_ORIGIN } from "../src/origins.js";

const sent = [];
const listeners = new Map();

globalThis.window = {
  addEventListener(type, listener) {
    listeners.set(type, listener);
  },
  clearInterval() {},
  clearTimeout() {},
  matchMedia: () => ({ matches: false }),
  removeEventListener(type) {
    listeners.delete(type);
  },
  setInterval: () => 1,
  setTimeout: () => 1,
};
globalThis.document = {
  addEventListener(type, listener) {
    listeners.set(type, listener);
  },
  hidden: false,
  removeEventListener(type) {
    listeners.delete(type);
  },
};
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: { onLine: true },
});
globalThis.WebSocket = class WebSocketMock {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
};

const { WhiteboardCollaboration } = await import("../src/collaboration.js");

function createSocket() {
  return {
    readyState: WebSocket.OPEN,
    close() {
      this.readyState = WebSocket.CLOSED;
    },
    send(message) {
      sent.push(message);
    },
  };
}

test("rejected and readonly updates replace the local Y.Doc before authoritative sync", async () => {
  sent.length = 0;
  const original = new Y.Doc();
  original.getMap("elements").set("accepted", { id: "accepted" });
  let current = original;
  let resets = 0;
  const scene = {
    applyRemoteUpdate(update) {
      Y.applyUpdate(current, update, REMOTE_ORIGIN);
    },
    getDocument: () => current,
    resetFromServer() {
      resets += 1;
      current = new Y.Doc();
      return current;
    },
  };
  const callbackState = {
    locked: [],
    errors: [],
    syncResets: 0,
  };
  const collaboration = new WhiteboardCollaboration({
    roomSession: { accessToken: "access" },
    scene,
    getApi: () => null,
    callbacks: {
      onError: (kind) => callbackState.errors.push(kind),
      onLocked: (locked) => callbackState.locked.push(locked),
      onSyncReset: () => {
        callbackState.syncResets += 1;
      },
    },
  });
  const socket = createSocket();
  collaboration.socket = socket;
  collaboration.synced = true;

  original.getMap("elements").set("rejected-client-only", {
    id: "rejected-client-only",
  });
  collaboration.synced = false;
  collaboration.sendOrQueueUpdate(new Uint8Array([7, 8, 9]));
  assert.equal(collaboration.queue.length, 2);

  await collaboration.handleMessage(socket, {
    data: JSON.stringify({
      type: "update-rejected",
      reason: "document-too-large",
    }),
  });

  assert.equal(resets, 1);
  assert.notEqual(collaboration.doc, original);
  assert.equal(collaboration.doc.getMap("elements").size, 0);
  assert.equal(collaboration.queue.length, 0);
  assert.equal(collaboration.queuedBytes, 0);
  assert.equal(collaboration.synced, false);
  assert.equal(callbackState.syncResets, 1);
  assert.deepEqual(callbackState.errors, ["document-too-large"]);
  const rejectionSync = sent.at(-1);
  assert.ok(rejectionSync instanceof Uint8Array);
  assert.equal(rejectionSync[0], 1);
  assert.equal(
    sent.some((message) => (
      typeof message === "string"
      && message.includes('"type":"sync-request"')
    )),
    false,
  );

  const authoritative = new Y.Doc();
  authoritative.getMap("elements").set("server-accepted", {
    id: "server-accepted",
  });
  const authoritativeUpdate = Y.encodeStateAsUpdate(authoritative);
  const authoritativeFrame = new Uint8Array(authoritativeUpdate.byteLength + 1);
  authoritativeFrame[0] = 0;
  authoritativeFrame.set(authoritativeUpdate, 1);
  await collaboration.handleMessage(socket, {
    data: authoritativeFrame.buffer,
  });
  assert.equal(collaboration.synced, true);
  assert.deepEqual(
    [...collaboration.doc.getMap("elements").keys()],
    ["server-accepted"],
  );

  const queueAfterReset = collaboration.queue.length;
  original.getMap("elements").set("stale-old-doc-change", {
    id: "stale-old-doc-change",
  });
  assert.equal(collaboration.queue.length, queueAfterReset);

  collaboration.synced = false;
  collaboration.doc.getMap("elements").set("locked-client-only", {
    id: "locked-client-only",
  });
  assert.equal(collaboration.queue.length, 1);
  await collaboration.handleMessage(socket, {
    data: JSON.stringify({ type: "readonly", locked: true }),
  });

  assert.equal(resets, 2);
  assert.equal(collaboration.doc.getMap("elements").size, 0);
  assert.equal(collaboration.queue.length, 0);
  assert.equal(callbackState.syncResets, 2);
  assert.deepEqual(callbackState.locked, [true]);
  assert.deepEqual(callbackState.errors, ["document-too-large", "locked"]);
  const readonlySync = sent.at(-1);
  assert.ok(readonlySync instanceof Uint8Array);
  assert.equal(readonlySync[0], 1);

  collaboration.destroy();
  authoritative.destroy();
  original.destroy();
  current.destroy();
});

test("rapid local edits are merged, acknowledged, and retained across a rate-limit reconnect", async () => {
  sent.length = 0;
  const document = new Y.Doc();
  const callbackState = { errors: [], statuses: [] };
  const scene = {
    applyRemoteUpdate(update) {
      Y.applyUpdate(document, update, "remote");
    },
    getDocument: () => document,
    resetFromServer: () => document,
  };
  const collaboration = new WhiteboardCollaboration({
    roomSession: { accessToken: "access" },
    scene,
    getApi: () => null,
    callbacks: {
      onError: (kind) => callbackState.errors.push(kind),
      onStatus: (status) => callbackState.statuses.push(status),
    },
  });
  const socket = createSocket();
  collaboration.socket = socket;
  collaboration.synced = true;

  for (let index = 0; index < 30; index += 1) {
    document.getMap("elements").set(`rapid-${index}`, {
      id: `rapid-${index}`,
      version: 1,
    });
  }
  assert.equal(collaboration.queue.length, 30);
  collaboration.flushUpdateQueue();
  assert.equal(collaboration.queue.length, 0);
  assert.ok(collaboration.inFlightUpdate instanceof Uint8Array);
  assert.equal(sent.length, 1);

  const mergedFrame = sent[0];
  assert.ok(mergedFrame instanceof Uint8Array);
  assert.equal(mergedFrame[0], 0);
  const mergedDocument = new Y.Doc();
  Y.applyUpdate(mergedDocument, mergedFrame.subarray(1));
  assert.equal(mergedDocument.getMap("elements").size, 30);

  collaboration.handleClose(socket, { code: 1008, reason: "rate_limited" });
  assert.equal(collaboration.inFlightUpdate, null);
  assert.equal(collaboration.queue.length, 1);
  assert.deepEqual(callbackState.errors, ["rate-limited"]);
  assert.equal(callbackState.statuses.at(-1), "reconnecting");
  assert.ok(collaboration.reconnectTimer);

  const recoveredSocket = createSocket();
  collaboration.socket = recoveredSocket;
  collaboration.synced = true;
  collaboration.lastUpdateSentAt = 0;
  collaboration.flushUpdateQueue();
  assert.ok(collaboration.inFlightUpdate instanceof Uint8Array);
  await collaboration.handleMessage(recoveredSocket, {
    data: JSON.stringify({
      type: "update-accepted",
      documentVersion: 1,
      updateIntervalMs: 60,
    }),
  });
  assert.equal(collaboration.inFlightUpdate, null);
  assert.equal(collaboration.queue.length, 0);
  assert.equal(await collaboration.waitForPendingUpdates(10), true);

  collaboration.destroy();
  mergedDocument.destroy();
  document.destroy();
});
