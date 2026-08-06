import { env } from "cloudflare:workers";
import { reset, runInDurableObject } from "cloudflare:test";
import { afterEach, describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
  ADMIN_AUTHORIZED_HEADER,
  AGENT_AUTHORIZED_HEADER,
  AGENT_OPERATION_ID_HEADER,
  AGENT_RECEIPT_PREFIX,
  AGENT_SUBJECT_HEADER,
  INTERNAL_SECRET_HEADER,
  MAX_AGENT_RECEIPTS,
  PUBLIC_ROOM_ID,
  ROOM_ID_HEADER,
  ROOM_META_KEY,
  ROOM_RETENTION_MS,
  ROOM_TYPE_HEADER,
  WS_YJS_UPDATE
} from "../src/constants";
import type { AgentUpdateReceipt, RoomMeta, RoomType, WhiteboardEnv } from "../src/types";

const testEnv = env as unknown as WhiteboardEnv;
const secret = "test-only-whiteboard-internal-secret-000000000000";
const subject = "a".repeat(64);

function agentHeaders(
  roomId: string,
  roomType: RoomType,
  operationId = "operation-agent-whiteboard-0001"
): Headers {
  return new Headers({
    [INTERNAL_SECRET_HEADER]: secret,
    [ROOM_ID_HEADER]: roomId,
    [ROOM_TYPE_HEADER]: roomType,
    [AGENT_AUTHORIZED_HEADER]: "1",
    [AGENT_SUBJECT_HEADER]: subject,
    [AGENT_OPERATION_ID_HEADER]: operationId,
    "content-type": "application/vnd.yjs-update"
  });
}

function safeElementMap(type: string = "rectangle"): Y.Map<unknown> {
  const element = new Y.Map<unknown>();
  element.set("type", type);
  element.set("x", 10);
  element.set("y", 20);
  element.set("width", 120);
  element.set("height", 80);
  element.set("isDeleted", false);
  if (type === "text") {
    element.set("text", "Agent text");
    element.set("originalText", "Agent text");
  }
  if (type === "line" || type === "arrow") {
    element.set("points", [[0, 0], [120, 80]]);
  }
  return element;
}

function newElementsUpdate(
  entries: Array<{ id: string; type?: string; mutate?: (map: Y.Map<unknown>) => void }>
): Uint8Array {
  const document = new Y.Doc();
  const elements = document.getMap<unknown>("elements");
  for (const entry of entries) {
    const element = safeElementMap(entry.type);
    entry.mutate?.(element);
    elements.set(entry.id, element);
  }
  const update = Y.encodeStateAsUpdate(document);
  document.destroy();
  return update;
}

function updateFromScene(
  scene: Uint8Array,
  mutate: (document: Y.Doc) => void
): Uint8Array {
  const document = new Y.Doc();
  Y.applyUpdate(document, scene);
  const stateVector = Y.encodeStateVector(document);
  mutate(document);
  const update = Y.encodeStateAsUpdate(document, stateVector);
  document.destroy();
  return update;
}

async function readAgentScene(
  stub: DurableObjectStub,
  roomId: string,
  roomType: RoomType
): Promise<Response> {
  const headers = agentHeaders(roomId, roomType);
  headers.delete(AGENT_OPERATION_ID_HEADER);
  headers.delete("content-type");
  return stub.fetch(new Request("https://whiteboard.internal/agent-scene", {
    headers
  }));
}

async function postAgentScene(
  stub: DurableObjectStub,
  roomId: string,
  roomType: RoomType,
  update: Uint8Array,
  operationId = "operation-agent-whiteboard-0001"
): Promise<Response> {
  return stub.fetch(new Request("https://whiteboard.internal/agent-scene", {
    method: "POST",
    headers: agentHeaders(roomId, roomType, operationId),
    body: update
  }));
}

async function readMeta(stub: DurableObjectStub): Promise<RoomMeta | undefined> {
  return runInDurableObject(stub, async (_instance, state) =>
    state.storage.get<RoomMeta>(ROOM_META_KEY)
  );
}

afterEach(reset);

describe("WhiteboardRoom agent scene boundary", () => {
  it("reads an uncreated room without metadata or TTL side effects", async () => {
    const roomId = `wb_${"1".repeat(43)}`;
    const stub = testEnv.WHITEBOARD_ROOMS.getByName(roomId);
    const response = await readAgentScene(stub, roomId, "private");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/vnd.yjs");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-whiteboard-document-version")).toBe("0");
    expect(response.headers.get("x-whiteboard-locked")).toBe("0");
    expect(new Uint8Array(await response.arrayBuffer()).byteLength).toBeGreaterThan(0);
    expect(await readMeta(stub)).toBeUndefined();
    expect(
      await runInDurableObject(stub, async (_instance, state) => state.storage.getAlarm())
    ).toBeNull();
  });

  it("persists a safe append and its receipt before replying, then replays idempotently", async () => {
    const roomId = `wb_${"2".repeat(43)}`;
    const stub = testEnv.WHITEBOARD_ROOMS.getByName(roomId);
    const update = newElementsUpdate([{ id: "agent-rectangle-1" }]);
    const startedAt = Date.now();

    const applied = await postAgentScene(stub, roomId, "private", update);
    expect(applied.status).toBe(200);
    expect(await applied.json()).toEqual({
      ok: true,
      replayed: false,
      documentVersion: 1
    });
    const meta = await readMeta(stub);
    expect(meta?.documentVersion).toBe(1);
    expect(meta?.onlineCount).toBe(0);
    expect(meta?.emptySince).toBeGreaterThanOrEqual(startedAt);
    expect(meta?.deleteAt).toBe(meta!.emptySince! + ROOM_RETENTION_MS);
    const receipts = await runInDurableObject(stub, async (_instance, state) =>
      state.storage.list<AgentUpdateReceipt>({ prefix: AGENT_RECEIPT_PREFIX })
    );
    expect(receipts.size).toBe(1);
    expect([...receipts.values()][0]).toMatchObject({
      version: 1,
      documentVersion: 1
    });

    const replayed = await postAgentScene(stub, roomId, "private", update);
    expect(replayed.status).toBe(200);
    expect(await replayed.json()).toEqual({
      ok: true,
      replayed: true,
      documentVersion: 1
    });
    expect(await readMeta(stub)).toEqual(meta);

    const conflict = await postAgentScene(
      stub,
      roomId,
      "private",
      newElementsUpdate([{ id: "agent-rectangle-conflict" }])
    );
    expect(conflict.status).toBe(409);
    expect((await conflict.json()) as Record<string, unknown>).toMatchObject({
      code: "WHITEBOARD_OPERATION_CONFLICT"
    });
    expect((await readMeta(stub))?.documentVersion).toBe(1);
  });

  it("rejects changes outside the append-only safe shape schema", async () => {
    const roomId = `wb_${"3".repeat(43)}`;
    const stub = testEnv.WHITEBOARD_ROOMS.getByName(roomId);
    const first = newElementsUpdate([{ id: "existing-rectangle" }]);
    expect((await postAgentScene(stub, roomId, "private", first)).status).toBe(200);
    const sceneResponse = await readAgentScene(stub, roomId, "private");
    const scene = new Uint8Array(await sceneResponse.arrayBuffer());

    const rejectedUpdates = [
      updateFromScene(scene, (document) => {
        (document.getMap<unknown>("elements").get("existing-rectangle") as Y.Map<unknown>)
          .set("x", 999);
      }),
      updateFromScene(scene, (document) => {
        document.getMap<unknown>("elements").delete("existing-rectangle");
      }),
      updateFromScene(scene, (document) => {
        document.getMap("assets").set("asset-file", { assetId: "unsafe" });
      }),
      updateFromScene(scene, (document) => {
        document.getMap("other-root").set("payload", "unsafe");
      }),
      updateFromScene(scene, (document) => {
        document.getMap<unknown>("elements").set(
          "image-element",
          safeElementMap("image")
        );
      }),
      updateFromScene(scene, (document) => {
        const linked = safeElementMap();
        linked.set("link", "https://example.test/");
        document.getMap<unknown>("elements").set("linked-element", linked);
      }),
      newElementsUpdate(
        Array.from({ length: 51 }, (_, index) => ({ id: `too-many-${index}` }))
      )
    ];

    for (const [index, update] of rejectedUpdates.entries()) {
      const response = await postAgentScene(
        stub,
        roomId,
        "private",
        update,
        `operation-agent-rejected-${String(index).padStart(4, "0")}`
      );
      expect(response.status).toBe(422);
      expect((await response.json()) as Record<string, unknown>).toMatchObject({
        code: "WHITEBOARD_AGENT_UPDATE_REJECTED"
      });
    }
    expect((await readMeta(stub))?.documentVersion).toBe(1);
  });

  it("rejects every write while locked without refreshing the private-room TTL", async () => {
    const roomId = `wb_${"4".repeat(43)}`;
    const stub = testEnv.WHITEBOARD_ROOMS.getByName(roomId);
    const first = newElementsUpdate([{ id: "before-lock" }]);
    expect((await postAgentScene(stub, roomId, "private", first)).status).toBe(200);

    const adminHeaders = agentHeaders(roomId, "private");
    adminHeaders.delete(AGENT_AUTHORIZED_HEADER);
    adminHeaders.delete(AGENT_SUBJECT_HEADER);
    adminHeaders.delete(AGENT_OPERATION_ID_HEADER);
    adminHeaders.set(ADMIN_AUTHORIZED_HEADER, "1");
    adminHeaders.set("content-type", "application/json");
    const locked = await stub.fetch(new Request("https://whiteboard.internal/admin", {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({ action: "set-lock", locked: true })
    }));
    expect(locked.status).toBe(200);
    const lockedMeta = await readMeta(stub);

    const rejected = await postAgentScene(
      stub,
      roomId,
      "private",
      newElementsUpdate([{ id: "after-lock" }]),
      "operation-agent-after-lock-0001"
    );
    expect(rejected.status).toBe(423);
    expect((await rejected.json()) as Record<string, unknown>).toMatchObject({
      code: "WHITEBOARD_ROOM_LOCKED"
    });
    expect(await readMeta(stub)).toEqual(lockedMeta);
  });

  it("invalidates old operation receipts atomically when an admin clears the document", async () => {
    await testEnv.DB?.prepare(
      "CREATE TABLE IF NOT EXISTS whiteboard_assets (room_id TEXT NOT NULL)"
    ).run();
    const stub = testEnv.WHITEBOARD_ROOMS.getByName(PUBLIC_ROOM_ID);
    const update = newElementsUpdate([{ id: "reapply-after-admin-clear" }]);
    const operationId = "operation-agent-clear-reapply-0001";

    const first = await postAgentScene(
      stub,
      PUBLIC_ROOM_ID,
      "public",
      update,
      operationId
    );
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({
      ok: true,
      replayed: false,
      documentVersion: 1
    });

    const adminHeaders = new Headers({
      [INTERNAL_SECRET_HEADER]: secret,
      [ROOM_ID_HEADER]: PUBLIC_ROOM_ID,
      [ROOM_TYPE_HEADER]: "public",
      [ADMIN_AUTHORIZED_HEADER]: "1",
      "content-type": "application/json"
    });
    const cleared = await stub.fetch(new Request("https://whiteboard.internal/admin", {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({ action: "clear" })
    }));
    expect(cleared.status).toBe(200);
    expect((await readMeta(stub))?.documentVersion).toBe(2);
    expect(
      await runInDurableObject(stub, async (_instance, state) =>
        (await state.storage.list({ prefix: AGENT_RECEIPT_PREFIX })).size
      )
    ).toBe(0);

    const reapplied = await postAgentScene(
      stub,
      PUBLIC_ROOM_ID,
      "public",
      update,
      operationId
    );
    expect(reapplied.status).toBe(200);
    expect(await reapplied.json()).toEqual({
      ok: true,
      replayed: false,
      documentVersion: 3
    });
    const sceneResponse = await readAgentScene(stub, PUBLIC_ROOM_ID, "public");
    const scene = new Y.Doc();
    Y.applyUpdate(scene, new Uint8Array(await sceneResponse.arrayBuffer()));
    expect(scene.getMap("elements").has("reapply-after-admin-clear")).toBe(true);
    scene.destroy();
  });

  it("retains only the newest 128 operation receipts", async () => {
    const roomId = `wb_${"5".repeat(43)}`;
    const stub = testEnv.WHITEBOARD_ROOMS.getByName(roomId);
    const now = Date.now();
    await runInDurableObject(stub, async (_instance, state) => {
      const seeded: Record<string, AgentUpdateReceipt> = {};
      for (let index = 0; index < MAX_AGENT_RECEIPTS + 2; index += 1) {
        seeded[`${AGENT_RECEIPT_PREFIX}${index.toString(16).padStart(64, "0")}`] = {
          version: 1,
          payloadSha256: "b".repeat(64),
          documentVersion: 1,
          createdAt: now - index,
          expiresAt: now + ROOM_RETENTION_MS
        };
      }
      await state.storage.put(seeded);
    });

    const response = await postAgentScene(
      stub,
      roomId,
      "private",
      newElementsUpdate([{ id: "receipt-cap-element" }]),
      "operation-agent-receipt-cap-0001"
    );
    expect(response.status).toBe(200);
    const receipts = await runInDurableObject(stub, async (_instance, state) =>
      state.storage.list<AgentUpdateReceipt>({ prefix: AGENT_RECEIPT_PREFIX })
    );
    expect(receipts.size).toBe(MAX_AGENT_RECEIPTS);
  });

  it("broadcasts an accepted persisted update to connected browsers", async () => {
    const roomId = `wb_${"6".repeat(43)}`;
    const stub = testEnv.WHITEBOARD_ROOMS.getByName(roomId);
    const headers = new Headers({
      [INTERNAL_SECRET_HEADER]: secret,
      [ROOM_ID_HEADER]: roomId,
      [ROOM_TYPE_HEADER]: "private",
      "x-whiteboard-anonymous-id": `anon_${"c".repeat(28)}`,
      "x-whiteboard-display-name-b64": "QWdlbnQgVmlld2Vy",
      "x-whiteboard-identity-color": "#3366cc",
      "x-whiteboard-identity-version": "1",
      "x-whiteboard-ip-hash": "d".repeat(64),
      "x-whiteboard-ticket-jti": `ticket_${"e".repeat(24)}`,
      "x-whiteboard-client-origin": "https://lusu575.com",
      upgrade: "websocket",
      "sec-websocket-protocol": "whiteboard.v1"
    });
    const upgraded = await stub.fetch(new Request("https://whiteboard.internal/realtime", {
      headers
    }));
    expect(upgraded.status).toBe(101);
    const socket = upgraded.webSocket!;
    socket.binaryType = "arraybuffer";
    socket.accept();
    const binaryMessages: ArrayBuffer[] = [];
    socket.addEventListener("message", (event) => {
      if (typeof event.data !== "string") binaryMessages.push(event.data);
    });

    const update = newElementsUpdate([{ id: "broadcast-element" }]);
    const applied = await postAgentScene(
      stub,
      roomId,
      "private",
      update,
      "operation-agent-broadcast-0001"
    );
    expect(applied.status).toBe(200);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect((await readMeta(stub))?.documentVersion).toBe(1);
    expect(binaryMessages.some((message) => {
      const bytes = new Uint8Array(message);
      return bytes[0] === WS_YJS_UPDATE && bytes.byteLength === update.byteLength + 1;
    })).toBe(true);
    socket.close(1000, "done");
  });
});
