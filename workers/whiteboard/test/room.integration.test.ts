import { env } from "cloudflare:workers";
import {
  evictDurableObject,
  reset,
  runDurableObjectAlarm,
  runInDurableObject
} from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import {
  ADMIN_AUTHORIZED_HEADER,
  ANONYMOUS_ID_HEADER,
  ASSET_SWEEP_NEXT_KEY,
  CLIENT_ORIGIN_HEADER,
  DISPLAY_NAME_B64_HEADER,
  DOCUMENT_SNAPSHOT_KEY,
  IDENTITY_COLOR_HEADER,
  IDENTITY_VERSION_HEADER,
  IMAGE_META_PREFIX,
  INTERNAL_SECRET_HEADER,
  IP_HASH_HEADER,
  LARGE_DOCUMENT_UPDATE_THRESHOLD_BYTES,
  MAX_CONNECTIONS_PER_IP,
  MAX_LARGE_DOCUMENT_UPDATES_PER_WINDOW,
  MAX_SYNC_REQUESTS_PER_WINDOW,
  MAX_SYNC_RESPONSE_BYTES_PER_WINDOW,
  MAX_UPLOADS_PER_WINDOW,
  MAX_VERY_LARGE_DOCUMENT_UPDATES_PER_WINDOW,
  PUBLIC_ROOM_ID,
  RATE_STATE_RETENTION_MS,
  RATE_SWEEP_NEXT_KEY,
  ROOM_ID_HEADER,
  ROOM_META_KEY,
  ROOM_RETENTION_MS,
  ROOM_TYPE_HEADER,
  SYNC_RATE_PREFIX,
  TICKET_JTI_HEADER,
  UNREFERENCED_ASSET_GRACE_MS,
  UPLOAD_RATE_PREFIX,
  VERY_LARGE_DOCUMENT_UPDATE_THRESHOLD_BYTES,
  WEBSOCKET_PROTOCOL,
  WS_YJS_UPDATE
} from "../src/constants";
import { YjsDocumentStore } from "../src/document-store";
import type {
  ImageMeta,
  RoomMeta,
  RoomType,
  UploadRateState,
  WhiteboardEnv
} from "../src/types";

const testEnv = env as unknown as WhiteboardEnv;
const secret = "test-only-whiteboard-internal-secret-000000000000";

function base64UrlUtf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function roomHeaders(
  roomId: string,
  roomType: RoomType,
  identityIndex = 1,
  displayName = "像素海豹",
  ticketIndex = identityIndex,
  identityVersion = 1
): Headers {
  return new Headers({
    [INTERNAL_SECRET_HEADER]: secret,
    [ROOM_ID_HEADER]: roomId,
    [ROOM_TYPE_HEADER]: roomType,
    [ANONYMOUS_ID_HEADER]: `anon_${String(identityIndex).padStart(28, "a")}`,
    [DISPLAY_NAME_B64_HEADER]: base64UrlUtf8(displayName),
    [IDENTITY_COLOR_HEADER]: "#3366cc",
    [IDENTITY_VERSION_HEADER]: String(identityVersion),
    [IP_HASH_HEADER]: "f".repeat(64),
    [TICKET_JTI_HEADER]: `ticket_${String(ticketIndex).padStart(24, "b")}`,
    [CLIENT_ORIGIN_HEADER]: "https://lusu575.com",
    upgrade: "websocket",
    "sec-websocket-protocol": WEBSOCKET_PROTOCOL
  });
}

async function connect(
  roomId: string,
  roomType: RoomType,
  identityIndex = 1,
  displayName = "像素海豹",
  ticketIndex = identityIndex,
  identityVersion = 1
): Promise<{
  socket: WebSocket;
  stub: DurableObjectStub;
  messages: Array<Record<string, unknown>>;
}> {
  const stub = testEnv.WHITEBOARD_ROOMS.getByName(roomId);
  const response = await stub.fetch(
    new Request("https://whiteboard.internal/realtime", {
      headers: roomHeaders(
        roomId,
        roomType,
        identityIndex,
        displayName,
        ticketIndex,
        identityVersion
      )
    })
  );
  expect(response.status).toBe(101);
  expect(response.headers.get("sec-websocket-protocol")).toBe(
    WEBSOCKET_PROTOCOL
  );
  expect(response.webSocket).not.toBeNull();
  const socket = response.webSocket!;
  const messages: Array<Record<string, unknown>> = [];
  socket.addEventListener("message", (event) => {
    if (typeof event.data !== "string") return;
    try {
      messages.push(JSON.parse(event.data) as Record<string, unknown>);
    } catch {
      // Binary Yjs frames and malformed test data are ignored here.
    }
  });
  socket.accept();
  return { socket, stub, messages };
}

async function readMeta(stub: DurableObjectStub): Promise<RoomMeta | undefined> {
  return runInDurableObject(stub, async (_instance, state) =>
    state.storage.get<RoomMeta>(ROOM_META_KEY)
  );
}

async function waitFor(
  predicate: () => Promise<boolean>,
  timeoutMs = 2_000
): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("timed out waiting for durable state");
}

async function closeAndWait(
  socket: WebSocket,
  stub: DurableObjectStub
): Promise<void> {
  socket.close(1000, "done");
  await waitFor(async () => (await readMeta(stub))?.onlineCount === 0);
}

async function waitForMessage(
  connection: { messages: Array<Record<string, unknown>> },
  type: string
): Promise<Record<string, unknown>> {
  await waitFor(async () =>
    connection.messages.some((message) => message.type === type)
  );
  return connection.messages.find((message) => message.type === type)!;
}

function nextSocketClose(
  socket: WebSocket,
  timeoutMs = 5_000
): Promise<{ code: number; reason: string }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("timed out waiting for WebSocket close")),
      timeoutMs
    );
    socket.addEventListener(
      "close",
      (event) => {
        clearTimeout(timer);
        const closeEvent = event as CloseEvent;
        resolve({ code: closeEvent.code, reason: closeEvent.reason });
      },
      { once: true }
    );
  });
}

function minimalPng(width = 2, height = 2): Uint8Array {
  const bytes = new Uint8Array(45);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  bytes.set([0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52], 8);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  bytes[24] = 8;
  bytes[25] = 6;
  bytes.set([0, 0, 0, 0, 0], 28);
  bytes.set([0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0, 0, 0, 0], 33);
  return bytes;
}

function internalHeaders(roomId: string, roomType: RoomType): Headers {
  return new Headers({
    [INTERNAL_SECRET_HEADER]: secret,
    [ROOM_ID_HEADER]: roomId,
    [ROOM_TYPE_HEADER]: roomType
  });
}

function assetReadHeaders(
  roomId: string,
  roomType: RoomType,
  identityIndex = 1
): Headers {
  const headers = roomHeaders(
    roomId,
    roomType,
    identityIndex,
    "像素海豹",
    998
  );
  headers.delete("upgrade");
  headers.delete("sec-websocket-protocol");
  return headers;
}

async function uploadPng(
  stub: DurableObjectStub,
  roomId: string,
  roomType: RoomType
): Promise<string> {
  const headers = roomHeaders(roomId, roomType, 1, "像素海豹", 999);
  headers.delete("upgrade");
  headers.delete("sec-websocket-protocol");
  headers.set("content-type", "image/png");
  const response = await stub.fetch(
    new Request("https://whiteboard.internal/assets", {
      method: "POST",
      headers,
      body: minimalPng()
    })
  );
  expect(response.status).toBe(201);
  const payload = (await response.json()) as {
    asset: { assetId: string };
  };
  return payload.asset.assetId;
}

function yjsElementUpdate(id: string): ArrayBuffer {
  const document = new Y.Doc();
  document.getMap("elements").set(id, {
    id,
    type: "rectangle",
    x: 10,
    y: 20,
    isDeleted: false
  });
  const update = Y.encodeStateAsUpdate(document);
  const message = new Uint8Array(update.byteLength + 1);
  message[0] = WS_YJS_UPDATE;
  message.set(update, 1);
  return message.buffer;
}

function yjsAssetReferenceUpdate(assetId: string): ArrayBuffer {
  const document = new Y.Doc();
  document.getMap("assets").set("excalidraw-file-1", {
    assetId,
    contentType: "image/png",
    width: 2,
    height: 2
  });
  const update = Y.encodeStateAsUpdate(document);
  const message = new Uint8Array(update.byteLength + 1);
  message[0] = WS_YJS_UPDATE;
  message.set(update, 1);
  return message.buffer;
}

async function seedLargeDocument(
  stub: DurableObjectStub,
  roomId: string,
  byteLength: number
): Promise<number> {
  const document = new Y.Doc();
  document.getMap("load-test").set("bytes", new Uint8Array(byteLength));
  const snapshot = Y.encodeStateAsUpdate(document);
  document.destroy();
  const now = Date.now();
  const meta: RoomMeta = {
    schemaVersion: 1,
    roomId,
    roomType: "private",
    createdAt: now,
    lastActiveAt: now,
    emptySince: now,
    deleteAt: now + ROOM_RETENTION_MS,
    onlineCount: 0,
    documentVersion: 0,
    snapshotVersion: 0,
    isLocked: false,
    resourceUsage: { bytes: 0, images: 0 },
    updateCount: 0,
    updateBytes: 0,
    cleanupRetryCount: 0
  };
  await runInDurableObject(stub, async (_instance, state) => {
    await state.storage.put(ROOM_META_KEY, meta);
    const store = new YjsDocumentStore(state.storage);
    await store.load();
    const applied = await store.applyIncrementalUpdate(snapshot, meta);
    expect(applied.accepted).toBe(true);
    expect(applied.meta.documentVersion).toBe(1);
  });
  await evictDurableObject(stub);
  return snapshot.byteLength;
}

async function ensureWhiteboardIndexSchema(): Promise<void> {
  if (!testEnv.DB) return;
  await testEnv.DB.prepare(`
    CREATE TABLE IF NOT EXISTS whiteboard_rooms (
      room_id TEXT PRIMARY KEY,
      room_type TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_active_at TEXT NOT NULL,
      empty_since TEXT,
      delete_at TEXT,
      online_count INTEGER NOT NULL DEFAULT 0,
      document_version INTEGER NOT NULL DEFAULT 0,
      snapshot_version INTEGER NOT NULL DEFAULT 0,
      is_locked INTEGER NOT NULL DEFAULT 0,
      resource_usage TEXT NOT NULL DEFAULT '{"bytes":0,"images":0}',
      resource_bytes INTEGER NOT NULL DEFAULT 0,
      resource_count INTEGER NOT NULL DEFAULT 0,
      object_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      epoch INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL,
      last_error TEXT NOT NULL DEFAULT ''
    )
  `).run();
  await testEnv.DB.prepare(`
    CREATE TABLE IF NOT EXISTS whiteboard_assets (
      asset_id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      object_key TEXT NOT NULL UNIQUE,
      content_type TEXT NOT NULL,
      byte_size INTEGER NOT NULL,
      width INTEGER NOT NULL,
      height INTEGER NOT NULL,
      sha256 TEXT NOT NULL,
      ref_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      unreferenced_at TEXT,
      delete_attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT NOT NULL DEFAULT ''
    )
  `).run();
  await testEnv.DB.prepare(`
    CREATE TABLE IF NOT EXISTS whiteboard_bans (
      ban_id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      subject_type TEXT NOT NULL,
      subject_value TEXT NOT NULL,
      ip_hash_key_id TEXT NOT NULL DEFAULT '',
      reason TEXT NOT NULL DEFAULT '',
      expires_at TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `).run();
  await testEnv.DB.prepare(`
    CREATE TABLE IF NOT EXISTS whiteboard_metrics (
      metric_key TEXT PRIMARY KEY,
      metric_value INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    )
  `).run();
}

beforeEach(ensureWhiteboardIndexSchema);

afterEach(async () => {
  vi.useRealTimers();
  await reset();
});

describe("WhiteboardRoom Durable Object", () => {
  it("keeps private-room Yjs updates isolated by room id", async () => {
    const roomA = `wb_${"a".repeat(43)}`;
    const roomB = `wb_${"b".repeat(43)}`;
    const first = await connect(roomA, "private", 1, "月球旅人", 1);
    const second = await connect(roomB, "private", 2, "云端信使", 2);

    first.socket.send(yjsElementUpdate("element-a"));
    await waitFor(async () => (await readMeta(first.stub))?.documentVersion === 1);

    expect((await readMeta(first.stub))?.documentVersion).toBe(1);
    expect((await readMeta(second.stub))?.documentVersion).toBe(0);
    await closeAndWait(first.socket, first.stub);
    await closeAndWait(second.socket, second.stub);
  });

  it("cancels a pending deletion when a user rejoins", async () => {
    const roomId = `wb_${"c".repeat(43)}`;
    const first = await connect(roomId, "private", 1, "深海水母", 1);
    first.socket.close(1000, "offline");
    await waitFor(async () => (await readMeta(first.stub))?.deleteAt != null);

    const second = await connect(roomId, "private", 1, "深海水母", 2);
    const rejoined = await readMeta(second.stub);
    expect(rejoined?.emptySince).toBeNull();
    expect(rejoined?.deleteAt).toBeNull();

    expect(await runDurableObjectAlarm(second.stub)).toBe(true);
    expect((await readMeta(second.stub))?.roomId).toBe(roomId);
    await closeAndWait(second.socket, second.stub);
  });

  it("deletes a due private room once and makes repeated alarms harmless", async () => {
    const roomId = `wb_${"d".repeat(43)}`;
    const connection = await connect(roomId, "private", 1, "雨町画家", 1);
    connection.socket.close(1000, "offline");
    await waitFor(async () => (await readMeta(connection.stub))?.deleteAt != null);
    const createdAt = new Date().toISOString();
    await testEnv.DB!.prepare(`
      INSERT INTO whiteboard_bans (
        ban_id, room_id, subject_type, subject_value, ip_hash_key_id, reason,
        expires_at, active, created_by, created_at, updated_at
      ) VALUES (?, ?, 'anonymous_id', ?, '', 'cleanup-test', ?, 1, ?, ?, ?)
    `)
      .bind(
        "wban_cleanup_test",
        roomId,
        `anon_${"1".padStart(28, "a")}`,
        new Date(Date.now() + 60_000).toISOString(),
        "test-admin",
        createdAt,
        createdAt
      )
      .run();
    expect(
      Number(
        (
          await testEnv.DB!.prepare(
            "SELECT COUNT(*) AS count FROM whiteboard_bans WHERE room_id = ?"
          )
            .bind(roomId)
            .first<{ count: number }>()
        )?.count || 0
      )
    ).toBe(1);

    await runInDurableObject(connection.stub, async (_instance, state) => {
      const meta = await state.storage.get<RoomMeta>(ROOM_META_KEY);
      expect(meta).toBeDefined();
      const now = Date.now();
      await state.storage.put(ROOM_META_KEY, {
        ...meta!,
        emptySince: now - ROOM_RETENTION_MS - 1,
        deleteAt: now - 1,
        onlineCount: 0
      });
      await state.storage.setAlarm(now + 1_000);
    });
    await evictDurableObject(connection.stub);

    expect(await runDurableObjectAlarm(connection.stub)).toBe(true);
    expect(await readMeta(connection.stub)).toBeUndefined();
    expect(
      Number(
        (
          await testEnv.DB!.prepare(
            "SELECT COUNT(*) AS count FROM whiteboard_bans WHERE room_id = ?"
          )
            .bind(roomId)
            .first<{ count: number }>()
        )?.count || 0
      )
    ).toBe(0);
    expect(
      Number(
        (
          await testEnv.DB!.prepare(
            "SELECT metric_value FROM whiteboard_metrics WHERE metric_key = 'cleaned_room_count'"
          ).first<{ metric_value: number }>()
        )?.metric_value || 0
      )
    ).toBe(1);
    expect(await runDurableObjectAlarm(connection.stub)).toBe(false);
  });

  it("keeps due room state and retries when D1 cleanup temporarily fails", async () => {
    const roomId = `wb_${"6".repeat(43)}`;
    const connection = await connect(roomId, "private", 1, "重试信使", 61);
    await closeAndWait(connection.socket, connection.stub);

    await runInDurableObject(connection.stub, async (_instance, state) => {
      const meta = await state.storage.get<RoomMeta>(ROOM_META_KEY);
      expect(meta).toBeDefined();
      const now = Date.now();
      await state.storage.put(ROOM_META_KEY, {
        ...meta!,
        emptySince: now - ROOM_RETENTION_MS - 1,
        deleteAt: now - 1,
        onlineCount: 0
      });
      await state.storage.setAlarm(now + 1_000);
    });
    await testEnv.DB?.prepare("DROP TABLE whiteboard_assets").run();
    await testEnv.DB?.prepare("DROP TABLE whiteboard_rooms").run();
    await evictDurableObject(connection.stub);

    expect(await runDurableObjectAlarm(connection.stub)).toBe(true);
    const retained = await readMeta(connection.stub);
    expect(retained?.cleanupRetryCount).toBe(1);
    expect(retained?.roomId).toBe(roomId);
    expect(retained?.lastError).toBe("room_cleanup_failed");
    expect(
      Number(
        (
          await testEnv.DB!.prepare(
            "SELECT metric_value FROM whiteboard_metrics WHERE metric_key = 'error_count'"
          ).first<{ metric_value: number }>()
        )?.metric_value || 0
      )
    ).toBe(1);

    await ensureWhiteboardIndexSchema();
    expect(await runDurableObjectAlarm(connection.stub)).toBe(true);
    expect(await readMeta(connection.stub)).toBeUndefined();
  });

  it("recovers a private room with a stale persisted online count after DO restart", async () => {
    const roomId = `wb_${"7".repeat(43)}`;
    const stub = testEnv.WHITEBOARD_ROOMS.getByName(roomId);
    const seededAt = Date.now() - 60_000;
    await runInDurableObject(stub, async (_instance, state) => {
      const staleMeta: RoomMeta = {
        schemaVersion: 1,
        roomId,
        roomType: "private",
        createdAt: seededAt,
        lastActiveAt: seededAt,
        emptySince: null,
        deleteAt: null,
        onlineCount: 3,
        documentVersion: 0,
        snapshotVersion: 0,
        isLocked: false,
        resourceUsage: { bytes: 0, images: 0 },
        updateCount: 0,
        updateBytes: 0,
        cleanupRetryCount: 0
      };
      await state.storage.put(ROOM_META_KEY, staleMeta);
    });
    await evictDurableObject(stub);

    const adminHeaders = internalHeaders(roomId, "private");
    adminHeaders.set(ADMIN_AUTHORIZED_HEADER, "1");
    const recoveredStatus = await stub.fetch(
      new Request("https://whiteboard.internal/status", {
        headers: adminHeaders
      })
    );
    expect(recoveredStatus.status).toBe(200);
    const recovered = await readMeta(stub);
    expect(recovered?.onlineCount).toBe(0);
    expect(recovered?.emptySince).not.toBeNull();
    expect(recovered?.deleteAt).toBe(
      recovered!.emptySince! + ROOM_RETENTION_MS
    );
    const recoveredAlarm = await runInDurableObject(
      stub,
      async (_instance, state) => state.storage.getAlarm()
    );
    expect(recoveredAlarm).toBe(recovered?.deleteAt);

    const rejoined = await connect(
      roomId,
      "private",
      1,
      "重连旅人",
      131
    );
    expect((await readMeta(stub))?.emptySince).toBeNull();
    expect((await readMeta(stub))?.deleteAt).toBeNull();
    await closeAndWait(rejoined.socket, rejoined.stub);
    const emptyAgain = await readMeta(stub);
    expect(emptyAgain?.emptySince).not.toBeNull();
    expect(emptyAgain?.deleteAt).toBe(
      emptyAgain!.emptySince! + ROOM_RETENTION_MS
    );
  });

  it("never gives the public room a 24-hour deletion timestamp", async () => {
    const connection = await connect(
      PUBLIC_ROOM_ID,
      "public",
      1,
      "银河店长",
      1
    );
    connection.socket.send(yjsElementUpdate("public-retained-stroke"));
    const accepted = await waitForMessage(connection, "update-accepted");
    expect(accepted.documentVersion).toBe(1);
    expect(Number(accepted.updateIntervalMs)).toBeGreaterThanOrEqual(50);
    connection.socket.close(1000, "offline");
    await waitFor(async () => (await readMeta(connection.stub))?.onlineCount === 0);
    await evictDurableObject(connection.stub);
    const retainedElements = await runInDurableObject(
      connection.stub,
      async (_instance, state) => {
        const store = new YjsDocumentStore(state.storage);
        await store.load();
        const document = new Y.Doc();
        Y.applyUpdate(document, store.encodeState());
        const ids = [...document.getMap("elements").keys()];
        document.destroy();
        return ids;
      }
    );
    expect(retainedElements).toContain("public-retained-stroke");
    const publicMeta = await readMeta(connection.stub);
    expect(publicMeta?.emptySince).toBeNull();
    expect(publicMeta?.deleteAt).toBeNull();
    expect(await runDurableObjectAlarm(connection.stub)).toBe(true);
    expect((await readMeta(connection.stub))?.roomId).toBe(PUBLIC_ROOM_ID);
  });

  it("lets admins inspect, lock, and clear the fresh public room before its first visitor", async () => {
    const stub = testEnv.WHITEBOARD_ROOMS.getByName(PUBLIC_ROOM_ID);
    const adminHeaders = internalHeaders(PUBLIC_ROOM_ID, "public");
    adminHeaders.set(ADMIN_AUTHORIZED_HEADER, "1");

    const initialStatus = await stub.fetch(
      new Request("https://whiteboard.internal/status", {
        headers: adminHeaders
      })
    );
    expect(initialStatus.status).toBe(200);
    expect(
      ((await initialStatus.json()) as {
        room: { isLocked: boolean; onlineCount: number };
      }).room
    ).toMatchObject({ isLocked: false, onlineCount: 0 });

    const actionHeaders = new Headers(adminHeaders);
    actionHeaders.set("content-type", "application/json");
    const locked = await stub.fetch(
      new Request("https://whiteboard.internal/admin", {
        method: "POST",
        headers: actionHeaders,
        body: JSON.stringify({ action: "set-lock", locked: true })
      })
    );
    expect(locked.status).toBe(200);

    const cleared = await stub.fetch(
      new Request("https://whiteboard.internal/admin", {
        method: "POST",
        headers: actionHeaders,
        body: JSON.stringify({ action: "clear" })
      })
    );
    expect(cleared.status).toBe(200);
    const versionAfterClear = (await readMeta(stub))?.documentVersion;
    expect(versionAfterClear).toBe(1);
    expect((await readMeta(stub))?.isLocked).toBe(true);

    const storedSnapshot = await runInDurableObject(
      stub,
      async (_instance, state) =>
        state.storage.get<ArrayBuffer>(DOCUMENT_SNAPSHOT_KEY)
    );
    expect(storedSnapshot).toBeDefined();
    const document = new Y.Doc();
    Y.applyUpdate(document, new Uint8Array(storedSnapshot!));
    expect(document.getMap("elements").size).toBe(0);
    expect(document.getMap("assets").size).toBe(0);

    const firstVisitor = await connect(
      PUBLIC_ROOM_ID,
      "public",
      1,
      "首位旅人",
      121
    );
    const ready = await waitForMessage(firstVisitor, "ready");
    expect(ready.locked).toBe(true);
    expect(ready.documentVersion).toBe(versionAfterClear);
    firstVisitor.socket.send(yjsElementUpdate("blocked-element"));
    await waitForMessage(firstVisitor, "readonly");
    expect((await readMeta(stub))?.documentVersion).toBe(versionAfterClear);
    await closeAndWait(firstVisitor.socket, firstVisitor.stub);
  });

  it("does not create a missing private room from an admin status request", async () => {
    const roomId = `wb_${"9".repeat(43)}`;
    const stub = testEnv.WHITEBOARD_ROOMS.getByName(roomId);
    const headers = internalHeaders(roomId, "private");
    headers.set(ADMIN_AUTHORIZED_HEADER, "1");
    const response = await stub.fetch(
      new Request("https://whiteboard.internal/status", { headers })
    );
    expect(response.status).toBe(404);
    expect(await readMeta(stub)).toBeUndefined();
  });

  it("requires the internal secret for room status", async () => {
    const roomId = `wb_${"e".repeat(43)}`;
    const connection = await connect(roomId, "private");
    const response = await connection.stub.fetch(
      new Request("https://whiteboard.internal/status", {
        headers: {
          [ROOM_ID_HEADER]: roomId,
          [ROOM_TYPE_HEADER]: "private",
          [ADMIN_AUTHORIZED_HEADER]: "1"
        }
      })
    );
    expect(response.status).toBe(401);
    await closeAndWait(connection.socket, connection.stub);
  });

  it("persists consumed ticket JTIs across disconnect and eviction", async () => {
    const roomId = `wb_${"f".repeat(43)}`;
    const connection = await connect(
      roomId,
      "private",
      1,
      "纸箱骑士",
      71
    );
    await closeAndWait(connection.socket, connection.stub);
    await evictDurableObject(connection.stub);

    const replay = await connection.stub.fetch(
      new Request("https://whiteboard.internal/realtime", {
        headers: roomHeaders(roomId, "private", 1, "纸箱骑士", 71)
      })
    );
    expect(replay.status).toBe(409);
    expect((await replay.json() as { error: string }).error).toBe("ticket_reused");
  });

  it("enforces the per-IP WebSocket connection cap independently of identity", async () => {
    const roomId = `wb_${"8".repeat(43)}`;
    const connections: Array<Awaited<ReturnType<typeof connect>>> = [];
    for (let index = 1; index <= MAX_CONNECTIONS_PER_IP; index += 1) {
      connections.push(
        await connect(
          roomId,
          "private",
          index,
          `测试旅人${index}`,
          200 + index
        )
      );
    }

    const rejected = await connections[0].stub.fetch(
      new Request("https://whiteboard.internal/realtime", {
        headers: roomHeaders(
          roomId,
          "private",
          MAX_CONNECTIONS_PER_IP + 1,
          "额外旅人",
          299
        )
      })
    );
    expect(rejected.status).toBe(429);
    expect(
      (await rejected.json() as { error: string }).error
    ).toBe("connection_limit");

    for (const connection of connections) {
      connection.socket.close(1000, "done");
    }
    await waitFor(
      async () => (await readMeta(connections[0].stub))?.onlineCount === 0
    );
  });

  it("closes a client that exceeds the persistent sync request limit", async () => {
    const roomId = `wb_${"2".repeat(43)}`;
    const connection = await connect(
      roomId,
      "private",
      1,
      "同步旅人",
      301
    );
    const closed = nextSocketClose(connection.socket);
    for (let index = 0; index <= MAX_SYNC_REQUESTS_PER_WINDOW; index += 1) {
      connection.socket.send(JSON.stringify({ type: "sync-request" }));
    }
    await expect(closed).resolves.toMatchObject({
      code: 1008,
      reason: "sync_rate_limited"
    });
    await waitFor(async () => (await readMeta(connection.stub))?.onlineCount === 0);
  });

  it("closes a client before sending beyond the sync response byte budget", async () => {
    const roomId = `wb_${"3".repeat(43)}`;
    const connection = await connect(
      roomId,
      "private",
      1,
      "预算旅人",
      302
    );
    const ipHash = "f".repeat(64);
    const now = Date.now();
    await runInDurableObject(connection.stub, async (_instance, state) => {
      await state.storage.put<UploadRateState>(
        `${SYNC_RATE_PREFIX}${ipHash}`,
        {
          windowStartedAt: now,
          count: 0,
          bytes: MAX_SYNC_RESPONSE_BYTES_PER_WINDOW,
          expiresAt: now + RATE_STATE_RETENTION_MS
        }
      );
    });

    const closed = nextSocketClose(connection.socket);
    connection.socket.send(JSON.stringify({ type: "sync-request" }));
    await expect(closed).resolves.toMatchObject({
      code: 1008,
      reason: "sync_budget_exceeded"
    });
    await waitFor(async () => (await readMeta(connection.stub))?.onlineCount === 0);
  });

  it.each([
    {
      label: "large",
      marker: "4",
      documentBytes: LARGE_DOCUMENT_UPDATE_THRESHOLD_BYTES + 1,
      allowedUpdates: MAX_LARGE_DOCUMENT_UPDATES_PER_WINDOW
    },
    {
      label: "very large",
      marker: "5",
      documentBytes: VERY_LARGE_DOCUMENT_UPDATE_THRESHOLD_BYTES + 1,
      allowedUpdates: MAX_VERY_LARGE_DOCUMENT_UPDATES_PER_WINDOW
    }
  ])(
    "adapts Yjs update frequency for a $label cached document",
    async ({ marker, documentBytes, allowedUpdates }) => {
      const roomId = `wb_${marker.repeat(43)}`;
      const stub = testEnv.WHITEBOARD_ROOMS.getByName(roomId);
      expect(await seedLargeDocument(stub, roomId, documentBytes)).toBeGreaterThan(
        documentBytes
      );
      const connection = await connect(
        roomId,
        "private",
        1,
        "大型文档旅人",
        400 + allowedUpdates
      );
      const update = yjsElementUpdate(`adaptive-${marker}`);
      const closed = nextSocketClose(connection.socket, 10_000);
      for (let index = 0; index <= allowedUpdates; index += 1) {
        connection.socket.send(update);
      }
      await expect(closed).resolves.toMatchObject({
        code: 1008,
        reason: "rate_limited"
      });
      await waitFor(
        async () => (await readMeta(connection.stub))?.onlineCount === 0,
        10_000
      );
      expect((await readMeta(connection.stub))?.documentVersion).toBe(
        1 + allowedUpdates
      );
    },
    20_000
  );

  it("schedules and prunes rate state after failed and limited public uploads without sockets", async () => {
    const stub = testEnv.WHITEBOARD_ROOMS.getByName(PUBLIC_ROOM_ID);
    const adminHeaders = internalHeaders(PUBLIC_ROOM_ID, "public");
    adminHeaders.set(ADMIN_AUTHORIZED_HEADER, "1");
    const status = await stub.fetch(
      new Request("https://whiteboard.internal/status", {
        headers: adminHeaders
      })
    );
    expect(status.status).toBe(200);

    const uploadHeaders = roomHeaders(
      PUBLIC_ROOM_ID,
      "public",
      1,
      "限频旅人",
      500
    );
    uploadHeaders.delete("upgrade");
    uploadHeaders.delete("sec-websocket-protocol");
    uploadHeaders.set("content-type", "image/png");
    for (let index = 0; index < MAX_UPLOADS_PER_WINDOW; index += 1) {
      const invalid = await stub.fetch(
        new Request("https://whiteboard.internal/assets", {
          method: "POST",
          headers: uploadHeaders,
          body: new Uint8Array([1, 2, 3])
        })
      );
      expect(invalid.status).toBe(415);
    }
    const limited = await stub.fetch(
      new Request("https://whiteboard.internal/assets", {
        method: "POST",
        headers: uploadHeaders,
        body: new Uint8Array([1, 2, 3])
      })
    );
    expect(limited.status).toBe(429);

    await runInDurableObject(stub, async (_instance, state) => {
      expect(state.getWebSockets()).toHaveLength(0);
      const scheduledAt = await state.storage.get<number>(RATE_SWEEP_NEXT_KEY);
      const actualAlarm = await state.storage.getAlarm();
      expect(scheduledAt).toBeTypeOf("number");
      expect(actualAlarm).toBe(scheduledAt);

      const now = Date.now();
      const rateEntries = [
        ...(await state.storage.list<UploadRateState>({
          prefix: UPLOAD_RATE_PREFIX
        })).entries()
      ];
      expect(rateEntries).toHaveLength(2);
      for (const [key, rate] of rateEntries) {
        await state.storage.put(key, { ...rate, expiresAt: now - 1 });
      }
      await state.storage.put(RATE_SWEEP_NEXT_KEY, now - 1);
      await state.storage.setAlarm(now + 1_000);
    });

    expect(await runDurableObjectAlarm(stub)).toBe(true);
    await runInDurableObject(stub, async (_instance, state) => {
      expect(
        (await state.storage.list({ prefix: UPLOAD_RATE_PREFIX })).size
      ).toBe(0);
      expect(await state.storage.get(RATE_SWEEP_NEXT_KEY)).toBeUndefined();
      expect(await state.storage.getAlarm()).toBeNull();
    });
  });

  it("keeps one name across tabs, atomically deduplicates peers, and applies a newer identity version", async () => {
    const roomId = `wb_${"1".repeat(43)}`;
    const first = await connect(roomId, "private", 1, "雾岛邮差", 81, 1);
    const peer = await connect(roomId, "private", 2, "雾岛邮差", 82, 1);
    const secondTab = await connect(
      roomId,
      "private",
      1,
      "蓝屏旅人",
      83,
      1
    );
    const rotated = await connect(
      roomId,
      "private",
      1,
      "月球旅人",
      84,
      2
    );

    const firstReady = await waitForMessage(first, "ready");
    const peerReady = await waitForMessage(peer, "ready");
    const tabReady = await waitForMessage(secondTab, "ready");
    const rotatedReady = await waitForMessage(rotated, "ready");
    const name = (message: Record<string, unknown>) =>
      (message.participant as { displayName: string }).displayName;

    expect(name(firstReady)).toBe("雾岛邮差");
    expect(name(peerReady)).not.toBe("雾岛邮差");
    expect(name(tabReady)).toBe("雾岛邮差");
    expect(name(rotatedReady)).toBe("月球旅人");

    first.socket.close(1000, "done");
    peer.socket.close(1000, "done");
    secondTab.socket.close(1000, "done");
    rotated.socket.close(1000, "done");
    await waitFor(async () => (await readMeta(first.stub))?.onlineCount === 0);
  });

  it("exposes admin-only connection targets and blocks a banned identity from room assets", async () => {
    const connection = await connect(
      PUBLIC_ROOM_ID,
      "public",
      1,
      "像素海豹",
      88
    );
    const assetId = await uploadPng(
      connection.stub,
      PUBLIC_ROOM_ID,
      "public"
    );
    const adminHeaders = internalHeaders(PUBLIC_ROOM_ID, "public");
    adminHeaders.set(ADMIN_AUTHORIZED_HEADER, "1");
    const statusResponse = await connection.stub.fetch(
      new Request("https://whiteboard.internal/status", {
        headers: adminHeaders
      })
    );
    expect(statusResponse.status).toBe(200);
    const statusPayload = await statusResponse.json() as {
      room: {
        connections: Array<{
          connectionId: string;
          anonymousId: string;
          ipHash: string | null;
        }>;
      };
    };
    expect(statusPayload.room.connections).toHaveLength(1);
    expect(statusPayload.room.connections[0]).toMatchObject({
      anonymousId: `anon_${"1".padStart(28, "a")}`,
      ipHash: "f".repeat(64)
    });
    expect(statusPayload.room.connections[0].connectionId.length).toBeGreaterThan(8);

    const actionHeaders = new Headers(adminHeaders);
    actionHeaders.set("content-type", "application/json");
    const banned = await connection.stub.fetch(
      new Request("https://whiteboard.internal/admin", {
        method: "POST",
        headers: actionHeaders,
        body: JSON.stringify({
          action: "ban",
          kind: "anonymousId",
          key: `anon_${"1".padStart(28, "a")}`,
          durationSeconds: 3_600
        })
      })
    );
    expect(banned.status).toBe(200);

    const assetResponse = await connection.stub.fetch(
      new Request(`https://whiteboard.internal/assets/${assetId}`, {
        headers: assetReadHeaders(PUBLIC_ROOM_ID, "public", 1)
      })
    );
    expect(assetResponse.status).toBe(403);
  });

  it("clears public-room R2 assets and resets resource usage", async () => {
    const connection = await connect(
      PUBLIC_ROOM_ID,
      "public",
      1,
      "电波狐狸",
      91
    );
    const assetId = await uploadPng(
      connection.stub,
      PUBLIC_ROOM_ID,
      "public"
    );
    expect((await readMeta(connection.stub))?.resourceUsage.images).toBe(1);

    const headers = internalHeaders(PUBLIC_ROOM_ID, "public");
    headers.set(ADMIN_AUTHORIZED_HEADER, "1");
    headers.set("content-type", "application/json");
    const cleared = await connection.stub.fetch(
      new Request("https://whiteboard.internal/admin", {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "clear" })
      })
    );
    expect(cleared.status).toBe(200);
    expect((await readMeta(connection.stub))?.resourceUsage).toEqual({
      bytes: 0,
      images: 0
    });

    const getResponse = await connection.stub.fetch(
      new Request(`https://whiteboard.internal/assets/${assetId}`, {
        headers: assetReadHeaders(PUBLIC_ROOM_ID, "public")
      })
    );
    expect(getResponse.status).toBe(404);
    await closeAndWait(connection.socket, connection.stub);
  });

  it("sweeps an unreferenced upload after the one-hour safety window", async () => {
    const connection = await connect(
      PUBLIC_ROOM_ID,
      "public",
      1,
      "云端信使",
      101
    );
    const assetId = await uploadPng(
      connection.stub,
      PUBLIC_ROOM_ID,
      "public"
    );
    await runInDurableObject(connection.stub, async (_instance, state) => {
      const key = `${IMAGE_META_PREFIX}${assetId}`;
      const image = await state.storage.get<ImageMeta>(key);
      expect(image).toBeDefined();
      const now = Date.now();
      await state.storage.put(key, {
        ...image!,
        createdAt: now - UNREFERENCED_ASSET_GRACE_MS - 1
      });
      await state.storage.put(ASSET_SWEEP_NEXT_KEY, now - 1);
      await state.storage.setAlarm(now + 1_000);
    });

    expect(await runDurableObjectAlarm(connection.stub)).toBe(true);
    expect((await readMeta(connection.stub))?.resourceUsage).toEqual({
      bytes: 0,
      images: 0
    });
    const getResponse = await connection.stub.fetch(
      new Request(`https://whiteboard.internal/assets/${assetId}`, {
        headers: assetReadHeaders(PUBLIC_ROOM_ID, "public")
      })
    );
    expect(getResponse.status).toBe(404);
    await closeAndWait(connection.socket, connection.stub);
  });

  it("retains an old upload that is referenced by the Yjs assets map", async () => {
    const connection = await connect(
      PUBLIC_ROOM_ID,
      "public",
      1,
      "星河画家",
      111
    );
    const assetId = await uploadPng(
      connection.stub,
      PUBLIC_ROOM_ID,
      "public"
    );
    connection.socket.send(yjsAssetReferenceUpdate(assetId));
    await waitFor(
      async () => (await readMeta(connection.stub))?.documentVersion === 1
    );
    await runInDurableObject(connection.stub, async (_instance, state) => {
      const key = `${IMAGE_META_PREFIX}${assetId}`;
      const image = await state.storage.get<ImageMeta>(key);
      expect(image).toBeDefined();
      const now = Date.now();
      await state.storage.put(key, {
        ...image!,
        createdAt: now - UNREFERENCED_ASSET_GRACE_MS - 1
      });
      await state.storage.put(ASSET_SWEEP_NEXT_KEY, now - 1);
      await state.storage.setAlarm(now + 1_000);
    });

    expect(await runDurableObjectAlarm(connection.stub)).toBe(true);
    expect((await readMeta(connection.stub))?.resourceUsage.images).toBe(1);
    const getResponse = await connection.stub.fetch(
      new Request(`https://whiteboard.internal/assets/${assetId}`, {
        headers: assetReadHeaders(PUBLIC_ROOM_ID, "public")
      })
    );
    expect(getResponse.status).toBe(200);
    await closeAndWait(connection.socket, connection.stub);
  });
});
