import { env } from "cloudflare:workers";
import {
  evictDurableObject,
  reset,
  runDurableObjectAlarm,
  runInDurableObject
} from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import {
  AGENT_ASSETS_AUTHORIZED_HEADER,
  AGENT_ASSET_RECEIPT_PREFIX,
  AGENT_AUTHORIZED_HEADER,
  AGENT_OPERATION_ID_HEADER,
  AGENT_SUBJECT_HEADER,
  ASSET_SWEEP_NEXT_KEY,
  IMAGE_META_PREFIX,
  INTERNAL_SECRET_HEADER,
  IP_HASH_HEADER,
  MAX_IMAGE_DIMENSION,
  MAX_AGENT_ASSET_RECEIPTS,
  PUBLIC_ROOM_ID,
  ROOM_BANS_KEY,
  ROOM_ID_HEADER,
  ROOM_META_KEY,
  ROOM_RETENTION_MS,
  ROOM_TYPE_HEADER,
  UNREFERENCED_ASSET_GRACE_MS
} from "../src/constants";
import type {
  AgentAssetReceipt,
  ImageMeta,
  RoomMeta,
  RoomType,
  WhiteboardEnv
} from "../src/types";
import { validPng } from "./image-fixtures";

const testEnv = env as unknown as WhiteboardEnv;
const secret = "test-only-whiteboard-internal-secret-000000000000";
const subject = "a".repeat(64);

function agentHeaders(
  roomId: string,
  roomType: RoomType,
  operationId = "operation-agent-asset-0001",
  assetsAuthorized = true
): Headers {
  const headers = new Headers({
    [INTERNAL_SECRET_HEADER]: secret,
    [ROOM_ID_HEADER]: roomId,
    [ROOM_TYPE_HEADER]: roomType,
    [AGENT_AUTHORIZED_HEADER]: "1",
    [AGENT_SUBJECT_HEADER]: subject,
    [AGENT_OPERATION_ID_HEADER]: operationId,
    [IP_HASH_HEADER]: "f".repeat(64),
    "content-type": "image/png"
  });
  if (assetsAuthorized) headers.set(AGENT_ASSETS_AUTHORIZED_HEADER, "1");
  return headers;
}

async function postAsset(
  stub: DurableObjectStub,
  roomId: string,
  roomType: RoomType,
  bytes: Uint8Array,
  operationId = "operation-agent-asset-0001",
  assetsAuthorized = true,
  contentType = "image/png"
): Promise<Response> {
  return stub.fetch(agentAssetRequest(
    roomId,
    roomType,
    bytes,
    operationId,
    assetsAuthorized,
    contentType
  ));
}

function agentAssetRequest(
  roomId: string,
  roomType: RoomType,
  bytes: Uint8Array,
  operationId = "operation-agent-asset-0001",
  assetsAuthorized = true,
  contentType = "image/png"
): Request {
  const headers = agentHeaders(
    roomId,
    roomType,
    operationId,
    assetsAuthorized
  );
  headers.set("content-type", contentType);
  return new Request("https://whiteboard.internal/agent-assets", {
    method: "POST",
    headers,
    body: bytes
  });
}

async function getAsset(
  stub: DurableObjectStub,
  roomId: string,
  roomType: RoomType,
  assetId: string,
  assetsAuthorized = true
): Promise<Response> {
  const headers = agentHeaders(roomId, roomType, "operation-unused-0001", assetsAuthorized);
  headers.delete(AGENT_OPERATION_ID_HEADER);
  headers.delete("content-type");
  return stub.fetch(new Request(
    `https://whiteboard.internal/agent-assets/${assetId}`,
    { headers }
  ));
}

async function readScene(
  stub: DurableObjectStub,
  roomId: string,
  roomType: RoomType
): Promise<Uint8Array> {
  const headers = agentHeaders(roomId, roomType);
  headers.delete(AGENT_OPERATION_ID_HEADER);
  headers.delete("content-type");
  const response = await stub.fetch(new Request(
    "https://whiteboard.internal/agent-scene",
    { headers }
  ));
  expect(response.status).toBe(200);
  return new Uint8Array(await response.arrayBuffer());
}

async function postScene(
  stub: DurableObjectStub,
  roomId: string,
  roomType: RoomType,
  update: Uint8Array,
  operationId: string,
  assetsAuthorized = true
): Promise<Response> {
  const headers = agentHeaders(roomId, roomType, operationId, assetsAuthorized);
  headers.set("content-type", "application/vnd.yjs-update");
  return stub.fetch(new Request("https://whiteboard.internal/agent-scene", {
    method: "POST",
    headers,
    body: update
  }));
}

interface PublicAsset {
  assetId: string;
  contentType: "image/png" | "image/jpeg" | "image/webp";
  byteLength: number;
  width: number;
  height: number;
  version: 1;
}

function imageElement(fileId: string, x: number): Y.Map<unknown> {
  const element = new Y.Map<unknown>();
  element.set("type", "image");
  element.set("x", x);
  element.set("y", 20);
  element.set("width", 120);
  element.set("height", 80);
  element.set("angle", 0);
  element.set("strokeColor", "transparent");
  element.set("backgroundColor", "transparent");
  element.set("fillStyle", "solid");
  element.set("strokeWidth", 1);
  element.set("strokeStyle", "solid");
  element.set("roundness", null);
  element.set("roughness", 0);
  element.set("opacity", 100);
  element.set("seed", 1);
  element.set("version", 1);
  element.set("versionNonce", 2);
  element.set("index", "a0");
  element.set("isDeleted", false);
  element.set("groupIds", []);
  element.set("frameId", null);
  element.set("link", null);
  element.set("boundElements", null);
  element.set("updated", 1);
  element.set("locked", false);
  element.set("__position", Math.max(0, Math.trunc(x)));
  element.set("fileId", fileId);
  element.set("status", "saved");
  element.set("scale", [1, 1]);
  element.set("crop", null);
  return element;
}

function newImageUpdate(
  asset: PublicAsset,
  fileId = "agent_file_asset_0001",
  elementIds = ["agent-image-1"],
  mutate?: (document: Y.Doc) => void
): Uint8Array {
  const document = new Y.Doc();
  document.getMap("assets").set(fileId, { ...asset });
  elementIds.forEach((id, index) => {
    document.getMap<unknown>("elements").set(id, imageElement(fileId, 10 + index * 140));
  });
  mutate?.(document);
  const update = Y.encodeStateAsUpdate(document);
  document.destroy();
  return update;
}

function incrementalSceneUpdate(
  scene: Uint8Array,
  mutate: (document: Y.Doc) => void
): Uint8Array {
  const document = new Y.Doc();
  Y.applyUpdate(document, scene);
  const vector = Y.encodeStateVector(document);
  mutate(document);
  const update = Y.encodeStateAsUpdate(document, vector);
  document.destroy();
  return update;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function receiptKey(operationId: string): Promise<string> {
  const digest = await sha256Hex(new TextEncoder().encode(
    `lusu:whiteboard:agent-asset-receipt:v1\u0000${subject}\u0000${operationId}`
  ));
  return `${AGENT_ASSET_RECEIPT_PREFIX}${digest}`;
}

function lockedMeta(roomId: string, now: number): RoomMeta {
  return {
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
    isLocked: true,
    resourceUsage: { bytes: 0, images: 0 },
    updateCount: 0,
    updateBytes: 0,
    cleanupRetryCount: 0,
    lastError: "",
    lastErrorAt: 0
  };
}

afterEach(reset);

describe("WhiteboardRoom agent asset boundary", () => {
  it("uploads, reads, replays, conflicts, and isolates room assets", async () => {
    const roomId = `wb_${"1".repeat(43)}`;
    const stub = testEnv.WHITEBOARD_ROOMS.getByName(roomId);
    const bytes = validPng();
    const first = await postAsset(stub, roomId, "private", bytes);
    expect(first.status).toBe(201);
    const payload = await first.json() as {
      ok: boolean;
      replayed: boolean;
      asset: PublicAsset;
    };
    expect(payload).toMatchObject({ ok: true, replayed: false });
    expect(payload.asset).toMatchObject({
      contentType: "image/png",
      byteLength: bytes.byteLength,
      width: 2,
      height: 2,
      version: 1
    });
    expect(payload.asset.assetId).toMatch(/^[a-f0-9]{32}$/);
    expect(JSON.stringify(payload)).not.toContain(roomId);
    expect(JSON.stringify(payload)).not.toContain(subject);

    const meta = await runInDurableObject(stub, async (_instance, state) =>
      state.storage.get<RoomMeta>(ROOM_META_KEY)
    );
    expect(meta?.resourceUsage).toEqual({ bytes: bytes.byteLength, images: 1 });
    const receipts = await runInDurableObject(stub, async (_instance, state) =>
      state.storage.list<AgentAssetReceipt>({ prefix: AGENT_ASSET_RECEIPT_PREFIX })
    );
    expect(receipts.size).toBe(1);
    expect([...receipts.values()][0]).toMatchObject({ status: "committed" });

    const replay = await postAsset(stub, roomId, "private", bytes);
    expect(replay.status).toBe(200);
    expect(await replay.json()).toEqual({
      ok: true,
      replayed: true,
      asset: payload.asset
    });
    const conflict = await postAsset(stub, roomId, "private", validPng(3, 2));
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toMatchObject({ code: "WHITEBOARD_OPERATION_CONFLICT" });

    const downloaded = await getAsset(
      stub,
      roomId,
      "private",
      payload.asset.assetId
    );
    expect(downloaded.status).toBe(200);
    expect(downloaded.headers.get("content-type")).toBe("image/png");
    expect(downloaded.headers.get("content-length")).toBe(String(bytes.byteLength));
    expect(new Uint8Array(await downloaded.arrayBuffer())).toEqual(bytes);

    const otherRoomId = `wb_${"2".repeat(43)}`;
    const otherStub = testEnv.WHITEBOARD_ROOMS.getByName(otherRoomId);
    expect((await getAsset(
      otherStub,
      otherRoomId,
      "private",
      payload.asset.assetId
    )).status).toBe(404);
    expect((await getAsset(
      stub,
      roomId,
      "private",
      payload.asset.assetId,
      false
    )).status).toBe(403);
    await runInDurableObject(stub, async (_instance, state) => {
      await state.storage.put(ROOM_BANS_KEY, [{
        kind: "ipHash",
        key: "f".repeat(64),
        expiresAt: Date.now() + 60_000
      }]);
    });
    expect((await postAsset(stub, roomId, "private", bytes)).status).toBe(403);
  });

  it("accepts only real matching PNG/JPEG/WebP bytes and an authorized asset header", async () => {
    const roomId = `wb_${"3".repeat(43)}`;
    const stub = testEnv.WHITEBOARD_ROOMS.getByName(roomId);
    expect((await postAsset(
      stub,
      roomId,
      "private",
      validPng(),
      "operation-agent-no-assets-0001",
      false
    )).status).toBe(403);
    expect((await postAsset(
      stub,
      roomId,
      "private",
      new TextEncoder().encode("https://example.test/image.png"),
      "operation-agent-url-bytes-0001"
    )).status).toBe(415);
    expect((await postAsset(
      stub,
      roomId,
      "private",
      new TextEncoder().encode("data:image/png;base64,AAAA"),
      "operation-agent-base64-bytes-0001"
    )).status).toBe(415);
    expect((await postAsset(
      stub,
      roomId,
      "private",
      new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>") ,
      "operation-agent-svg-bytes-0001",
      true,
      "image/png"
    )).status).toBe(415);
    expect((await postAsset(
      stub,
      roomId,
      "private",
      validPng(),
      "operation-agent-mime-mismatch-0001",
      true,
      "image/jpeg"
    )).status).toBe(415);
  });

  it("adds only canonical current-room image records and supports repeated placement", async () => {
    const roomId = `wb_${"4".repeat(43)}`;
    const stub = testEnv.WHITEBOARD_ROOMS.getByName(roomId);
    const uploaded = await postAsset(stub, roomId, "private", validPng());
    const asset = (await uploaded.json() as { asset: PublicAsset }).asset;
    const firstUpdate = newImageUpdate(
      asset,
      "agent_file_asset_0001",
      ["agent-image-1", "agent-image-2"]
    );
    const applied = await postScene(
      stub,
      roomId,
      "private",
      firstUpdate,
      "operation-agent-image-scene-0001"
    );
    expect(applied.status).toBe(200);

    const scene = await readScene(stub, roomId, "private");
    const repeated = incrementalSceneUpdate(scene, (document) => {
      document.getMap<unknown>("elements").set(
        "agent-image-3",
        imageElement("agent_file_asset_0001", 300)
      );
    });
    expect((await postScene(
      stub,
      roomId,
      "private",
      repeated,
      "operation-agent-image-scene-0002",
      false
    )).status).toBe(422);
    expect((await postScene(
      stub,
      roomId,
      "private",
      repeated,
      "operation-agent-image-scene-0003"
    )).status).toBe(200);

    const current = new Y.Doc();
    Y.applyUpdate(current, await readScene(stub, roomId, "private"));
    expect(current.getMap("elements").has("agent-image-3")).toBe(true);
    expect(current.getMap("assets").get("agent_file_asset_0001")).toEqual(asset);
    current.destroy();
  });

  it("rejects missing, cross-room, forged, orphaned, and modified asset records", async () => {
    const roomId = `wb_${"5".repeat(43)}`;
    const otherRoomId = `wb_${"6".repeat(43)}`;
    const stub = testEnv.WHITEBOARD_ROOMS.getByName(roomId);
    const otherStub = testEnv.WHITEBOARD_ROOMS.getByName(otherRoomId);
    const uploaded = await postAsset(stub, roomId, "private", validPng());
    const asset = (await uploaded.json() as { asset: PublicAsset }).asset;

    const forged = { ...asset, byteLength: asset.byteLength + 1 };
    expect((await postScene(
      stub,
      roomId,
      "private",
      newImageUpdate(forged),
      "operation-agent-forged-meta-0001"
    )).status).toBe(422);
    expect((await postScene(
      otherStub,
      otherRoomId,
      "private",
      newImageUpdate(asset),
      "operation-agent-cross-room-0001"
    )).status).toBe(422);

    const orphan = new Y.Doc();
    orphan.getMap("assets").set("agent_file_orphan_0001", { ...asset });
    const shape = new Y.Map<unknown>();
    shape.set("type", "rectangle");
    shape.set("x", 1);
    shape.set("y", 1);
    shape.set("width", 10);
    shape.set("height", 10);
    shape.set("isDeleted", false);
    orphan.getMap<unknown>("elements").set("agent-shape-with-orphan", shape);
    const orphanUpdate = Y.encodeStateAsUpdate(orphan);
    orphan.destroy();
    expect((await postScene(
      stub,
      roomId,
      "private",
      orphanUpdate,
      "operation-agent-orphan-asset-0001"
    )).status).toBe(422);

    expect((await postScene(
      stub,
      roomId,
      "private",
      newImageUpdate(asset),
      "operation-agent-valid-before-modify-0001"
    )).status).toBe(200);
    const scene = await readScene(stub, roomId, "private");
    const modified = incrementalSceneUpdate(scene, (document) => {
      document.getMap("assets").set("agent_file_asset_0001", {
        ...asset,
        width: asset.width + 1
      });
      document.getMap<unknown>("elements").set(
        "agent-image-modifies-existing",
        imageElement("agent_file_asset_0001", 400)
      );
    });
    expect((await postScene(
      stub,
      roomId,
      "private",
      modified,
      "operation-agent-modify-existing-0001"
    )).status).toBe(422);

    const linked = newImageUpdate(
      asset,
      "agent_file_linked_0001",
      ["agent-image-linked"],
      (document) => {
        const element = document.getMap<unknown>("elements").get("agent-image-linked") as Y.Map<unknown>;
        element.set("link", "https://attacker.example/");
        element.set("customData", { dataURL: "data:image/png;base64,AAAA" });
      }
    );
    expect((await postScene(
      stub,
      roomId,
      "private",
      linked,
      "operation-agent-linked-image-0001"
    )).status).toBe(422);

    const zeroSized = newImageUpdate(
      asset,
      "agent_file_zero_0001",
      ["agent-image-zero"],
      (document) => {
        const element = document.getMap<unknown>("elements").get("agent-image-zero") as Y.Map<unknown>;
        element.set("width", 0);
      }
    );
    expect((await postScene(
      stub,
      roomId,
      "private",
      zeroSized,
      "operation-agent-zero-image-0001"
    )).status).toBe(422);

    const missingBase = newImageUpdate(
      asset,
      "agent_file_missing_base_0001",
      ["agent-image-missing-base"],
      (document) => {
        const element = document.getMap<unknown>("elements").get("agent-image-missing-base") as Y.Map<unknown>;
        element.delete("strokeColor");
      }
    );
    expect((await postScene(
      stub,
      roomId,
      "private",
      missingBase,
      "operation-agent-missing-base-0001"
    )).status).toBe(422);
  });

  it("keeps pending assets invisible, respects locks, cleans orphan R2, and reserves quota", async () => {
    const roomId = `wb_${"7".repeat(43)}`;
    const stub = testEnv.WHITEBOARD_ROOMS.getByName(roomId);
    const bytes = validPng();
    const operationId = "operation-agent-pending-lock-0001";
    const key = await receiptKey(operationId);
    const assetId = "1".repeat(32);
    const now = Date.now();
    const pending: AgentAssetReceipt = {
      version: 2,
      kind: "asset",
      status: "pending",
      roomId,
      payloadSha256: await sha256Hex(bytes),
      asset: {
        assetId,
        contentType: "image/png",
        byteLength: bytes.byteLength,
        width: 2,
        height: 2,
        version: 1
      },
      createdAt: now,
      expiresAt: now + 60 * 60_000
    };

    const malformedRoomId = `wb_${"6".repeat(43)}`;
    const malformedStub = testEnv.WHITEBOARD_ROOMS.getByName(malformedRoomId);
    const malformedOperationId = "operation-agent-malformed-receipt-0001";
    const malformedKey = await receiptKey(malformedOperationId);
    const malformedReceipt: AgentAssetReceipt = {
      ...pending,
      roomId: malformedRoomId,
      asset: {
        ...pending.asset,
        width: MAX_IMAGE_DIMENSION + 1
      }
    };
    await runInDurableObject(malformedStub, async (_instance, state) => {
      await state.storage.put(malformedKey, malformedReceipt);
    });
    expect((await postAsset(
      malformedStub,
      malformedRoomId,
      "private",
      bytes,
      malformedOperationId
    )).status).toBe(409);
    expect(await runInDurableObject(malformedStub, async (_instance, state) =>
      state.storage.get(`${IMAGE_META_PREFIX}${malformedReceipt.asset.assetId}`)
    )).toBeUndefined();

    await runInDurableObject(stub, async (_instance, state) => {
      await state.storage.put(key, pending);
      await state.storage.put(ROOM_META_KEY, lockedMeta(roomId, now));
    });
    await evictDurableObject(stub);
    expect((await getAsset(stub, roomId, "private", assetId)).status).toBe(404);
    expect((await postScene(
      stub,
      roomId,
      "private",
      newImageUpdate(pending.asset),
      "operation-agent-pending-scene-0001"
    )).status).toBe(423);
    expect((await postAsset(
      stub,
      roomId,
      "private",
      bytes,
      operationId
    )).status).toBe(423);
    expect(await testEnv.WHITEBOARD_BUCKET?.get(
      `whiteboard/v1/${roomId}/${assetId}`
    )).toBeNull();

    const orphanRoomId = `wb_${"8".repeat(43)}`;
    const orphanStub = testEnv.WHITEBOARD_ROOMS.getByName(orphanRoomId);
    const orphanAssetId = "2".repeat(32);
    const orphanReceiptKey = `${AGENT_ASSET_RECEIPT_PREFIX}${"2".repeat(64)}`;
    const orphanReceipt: AgentAssetReceipt = {
      ...pending,
      roomId: orphanRoomId,
      status: "pending",
      asset: { ...pending.asset, assetId: orphanAssetId },
      createdAt: now - 2,
      expiresAt: now - 1
    };
    await testEnv.WHITEBOARD_BUCKET?.put(
      `whiteboard/v1/${orphanRoomId}/${orphanAssetId}`,
      bytes
    );
    await runInDurableObject(orphanStub, async (_instance, state) => {
      await state.storage.put(orphanReceiptKey, orphanReceipt);
      await state.storage.setAlarm(now + 1_000);
    });
    expect(await runDurableObjectAlarm(orphanStub)).toBe(true);
    expect(await testEnv.WHITEBOARD_BUCKET?.get(
      `whiteboard/v1/${orphanRoomId}/${orphanAssetId}`
    )).toBeNull();
    expect(await runInDurableObject(orphanStub, async (_instance, state) =>
      state.storage.get(orphanReceiptKey)
    )).toBeUndefined();

    const cleanupRoomId = `wb_${"1".repeat(43)}`;
    const cleanupStub = testEnv.WHITEBOARD_ROOMS.getByName(cleanupRoomId);
    const cleanupOperationId = "operation-agent-expired-cleanup-0001";
    const cleanupReceiptKey = await receiptKey(cleanupOperationId);
    const cleanupAssetId = "1".repeat(32);
    const cleanupReceipt: AgentAssetReceipt = {
      ...pending,
      roomId: cleanupRoomId,
      status: "pending",
      asset: { ...pending.asset, assetId: cleanupAssetId },
      createdAt: now - 2,
      expiresAt: now - 1
    };
    await testEnv.WHITEBOARD_BUCKET?.put(
      `whiteboard/v1/${cleanupRoomId}/${cleanupAssetId}`,
      bytes
    );
    await runInDurableObject(cleanupStub, async (_instance, state) => {
      await state.storage.put(cleanupReceiptKey, cleanupReceipt);
    });
    const deleteSpy = vi.spyOn(testEnv.WHITEBOARD_BUCKET!, "delete")
      .mockRejectedValueOnce(new Error("simulated cleanup failure"));
    try {
      const cleanupBlocked = await postAsset(
        cleanupStub,
        cleanupRoomId,
        "private",
        bytes,
        cleanupOperationId
      );
      expect(cleanupBlocked.status).toBe(503);
      expect((await cleanupBlocked.json() as { code: string }).code)
        .toBe("WHITEBOARD_ASSET_CLEANUP_PENDING");
    } finally {
      deleteSpy.mockRestore();
    }
    const cleanupState = await runInDurableObject(cleanupStub, async (_instance, state) => ({
      receipt: await state.storage.get<AgentAssetReceipt>(cleanupReceiptKey),
      image: await state.storage.get(`${IMAGE_META_PREFIX}${cleanupAssetId}`),
      meta: await state.storage.get(ROOM_META_KEY),
      receiptCount: (await state.storage.list({
        prefix: AGENT_ASSET_RECEIPT_PREFIX
      })).size
    }));
    expect(cleanupState.receipt?.asset.assetId).toBe(cleanupAssetId);
    expect(cleanupState.receipt?.status).toBe("pending");
    expect(cleanupState.receipt?.expiresAt).toBeGreaterThan(Date.now());
    expect(cleanupState.image).toBeUndefined();
    expect(cleanupState.meta).toBeUndefined();
    expect(cleanupState.receiptCount).toBe(1);

    const quotaRoomId = `wb_${"9".repeat(43)}`;
    const quotaStub = testEnv.WHITEBOARD_ROOMS.getByName(quotaRoomId);
    await runInDurableObject(quotaStub, async (_instance, state) => {
      const reservations: Record<string, AgentAssetReceipt> = {};
      for (let index = 0; index < 100; index += 1) {
        const hex = index.toString(16).padStart(64, "0");
        reservations[`${AGENT_ASSET_RECEIPT_PREFIX}${hex}`] = {
          ...pending,
          roomId: quotaRoomId,
          asset: {
            ...pending.asset,
            assetId: index.toString(16).padStart(32, "0"),
            byteLength: 1 * 1024 * 1024
          },
          createdAt: now + index,
          expiresAt: now + 60 * 60_000
        };
      }
      await state.storage.put(reservations);
    });
    expect((await postAsset(
      quotaStub,
      quotaRoomId,
      "private",
      bytes,
      "operation-agent-quota-reserved-0001"
    )).status).toBe(413);
  });

  it("protects an exact replay when the receipt store is at capacity", async () => {
    const roomId = `wb_${"5".repeat(43)}`;
    const stub = testEnv.WHITEBOARD_ROOMS.getByName(roomId);
    const bytes = validPng();
    const operationId = "operation-agent-capacity-replay-0001";
    const uploaded = await postAsset(stub, roomId, "private", bytes, operationId);
    expect(uploaded.status).toBe(201);
    const originalAsset = (await uploaded.json() as { asset: PublicAsset }).asset;
    const exactKey = await receiptKey(operationId);
    const now = Date.now();
    await runInDurableObject(stub, async (_instance, state) => {
      const exact = await state.storage.get<AgentAssetReceipt>(exactKey);
      expect(exact).toBeDefined();
      await state.storage.put(exactKey, {
        ...exact!,
        createdAt: now - 10_000,
        expiresAt: now + 60 * 60_000
      });
      const fillers: Record<string, AgentAssetReceipt> = {};
      for (let index = 0; index < MAX_AGENT_ASSET_RECEIPTS - 1; index += 1) {
        const hex = (index + 1).toString(16).padStart(64, "0");
        fillers[`${AGENT_ASSET_RECEIPT_PREFIX}${hex}`] = {
          version: 2,
          kind: "asset",
          status: "pending",
          roomId,
          payloadSha256: hex,
          asset: {
            assetId: (index + 1).toString(16).padStart(32, "0"),
            contentType: "image/png",
            byteLength: 1,
            width: 1,
            height: 1,
            version: 1
          },
          createdAt: now + index,
          expiresAt: now + 60 * 60_000
        };
      }
      await state.storage.put(fillers);
    });

    const replay = await postAsset(stub, roomId, "private", bytes, operationId);
    expect(replay.status).toBe(200);
    expect(await replay.json()).toEqual({
      ok: true,
      replayed: true,
      asset: originalAsset
    });
    const meta = await runInDurableObject(stub, async (_instance, state) =>
      state.storage.get<RoomMeta>(ROOM_META_KEY)
    );
    expect(meta?.resourceUsage.images).toBe(1);
  });

  it("starts image retention at commit and rechecks an IP ban after R2 upload", async () => {
    const bytes = validPng();
    const now = Date.now();
    const delayedRoomId = `wb_${"4".repeat(43)}`;
    const delayedStub = testEnv.WHITEBOARD_ROOMS.getByName(delayedRoomId);
    const delayedOperationId = "operation-agent-delayed-commit-0001";
    const delayedKey = await receiptKey(delayedOperationId);
    const delayedAssetId = "4".repeat(32);
    const delayedReceipt: AgentAssetReceipt = {
      version: 2,
      kind: "asset",
      status: "pending",
      roomId: delayedRoomId,
      payloadSha256: await sha256Hex(bytes),
      asset: {
        assetId: delayedAssetId,
        contentType: "image/png",
        byteLength: bytes.byteLength,
        width: 2,
        height: 2,
        version: 1
      },
      createdAt: now - UNREFERENCED_ASSET_GRACE_MS + 10_000,
      expiresAt: now + 10_000
    };
    await runInDurableObject(delayedStub, async (_instance, state) => {
      await state.storage.put(delayedKey, delayedReceipt);
    });
    const beforeCommit = Date.now();
    expect((await postAsset(
      delayedStub,
      delayedRoomId,
      "private",
      bytes,
      delayedOperationId
    )).status).toBe(201);
    const committed = await runInDurableObject(delayedStub, async (_instance, state) => ({
      image: await state.storage.get<ImageMeta>(`${IMAGE_META_PREFIX}${delayedAssetId}`),
      sweepAt: await state.storage.get<number>(ASSET_SWEEP_NEXT_KEY)
    }));
    expect(committed.image?.createdAt).toBeGreaterThanOrEqual(beforeCommit);
    expect(committed.sweepAt).toBe(
      committed.image!.createdAt + UNREFERENCED_ASSET_GRACE_MS
    );

    const bannedRoomId = `wb_${"3".repeat(43)}`;
    const bannedStub = testEnv.WHITEBOARD_ROOMS.getByName(bannedRoomId);
    const bannedOperationId = "operation-agent-mid-upload-ban-0001";
    const result = await runInDurableObject(bannedStub, async (instance, state) => {
      const room = instance as unknown as {
        fetch(request: Request): Promise<Response>;
        isBanned(anonymousId: string, ipHash: string | null): Promise<boolean>;
      };
      let checks = 0;
      room.isBanned = async () => {
        checks += 1;
        return checks >= 2;
      };
      const response = await room.fetch(agentAssetRequest(
        bannedRoomId,
        "private",
        bytes,
        bannedOperationId
      ));
      const receipts = await state.storage.list<AgentAssetReceipt>({
        prefix: AGENT_ASSET_RECEIPT_PREFIX
      });
      const pending = [...receipts.values()][0];
      return {
        status: response.status,
        checks,
        pending,
        image: pending
          ? await state.storage.get(`${IMAGE_META_PREFIX}${pending.asset.assetId}`)
          : undefined,
        meta: await state.storage.get<RoomMeta>(ROOM_META_KEY)
      };
    });
    expect(result.status).toBe(403);
    expect(result.checks).toBe(2);
    expect(result.pending?.status).toBe("pending");
    expect(result.image).toBeUndefined();
    expect(result.meta).toBeUndefined();
  });

  it("retains a referenced committed image after its 24-hour receipt expires", async () => {
    const roomId = PUBLIC_ROOM_ID;
    const stub = testEnv.WHITEBOARD_ROOMS.getByName(roomId);
    const uploaded = await postAsset(stub, roomId, "public", validPng());
    const asset = (await uploaded.json() as { asset: PublicAsset }).asset;
    expect((await postScene(
      stub,
      roomId,
      "public",
      newImageUpdate(asset),
      "operation-agent-retained-image-0001"
    )).status).toBe(200);
    const imageMeta = await runInDurableObject(stub, async (_instance, state) =>
      state.storage.get<ImageMeta>(`${IMAGE_META_PREFIX}${asset.assetId}`)
    );
    expect(imageMeta).toBeDefined();
    const receiptEntry = await runInDurableObject(stub, async (_instance, state) => {
      const receipts = await state.storage.list<AgentAssetReceipt>({
        prefix: AGENT_ASSET_RECEIPT_PREFIX
      });
      return [...receipts.entries()][0];
    });
    expect(receiptEntry).toBeDefined();
    const [committedReceiptKey, committedReceipt] = receiptEntry!;
    await runInDurableObject(stub, async (_instance, state) => {
      await state.storage.put(committedReceiptKey, {
        ...committedReceipt,
        expiresAt: Date.now() - 1
      });
      await state.storage.setAlarm(Date.now() + 1_000);
    });
    expect(await runDurableObjectAlarm(stub)).toBe(true);
    expect(await runInDurableObject(stub, async (_instance, state) =>
      state.storage.get(committedReceiptKey)
    )).toBeUndefined();
    expect((await getAsset(stub, roomId, "public", asset.assetId)).status).toBe(200);

    const scene = await readScene(stub, roomId, "public");
    const reuse = incrementalSceneUpdate(scene, (document) => {
      document.getMap<unknown>("elements").set(
        "agent-image-after-receipt-expiry",
        imageElement("agent_file_asset_0001", 500)
      );
    });
    expect((await postScene(
      stub,
      roomId,
      "public",
      reuse,
      "operation-agent-after-receipt-expiry-0001"
    )).status).toBe(200);
  });
});
