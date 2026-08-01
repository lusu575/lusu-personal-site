import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
  DOCUMENT_UPDATE_PREFIX,
  ROOM_META_KEY
} from "../src/constants";
import { YjsDocumentStore } from "../src/document-store";
import type { RoomMeta } from "../src/types";

class AtomicMemoryStorage {
  private data = new Map<string, unknown>();
  failNextTransaction = false;

  async get<T>(key: string): Promise<T | undefined> {
    return this.data.get(key) as T | undefined;
  }

  async list<T>(
    options: { prefix?: string } = {}
  ): Promise<Map<string, T>> {
    const prefix = options.prefix || "";
    return new Map(
      [...this.data.entries()]
        .filter(([key]) => key.startsWith(prefix))
        .sort(([left], [right]) => left.localeCompare(right))
    ) as Map<string, T>;
  }

  async put(key: string, value: unknown): Promise<void> {
    this.data.set(key, value);
  }

  async transaction<T>(
    callback: (transaction: DurableObjectTransaction) => Promise<T>
  ): Promise<T> {
    const staged = new Map(this.data);
    const transaction = {
      put: async (key: string, value: unknown) => {
        staged.set(key, value);
      },
      delete: async (keys: string | string[]) => {
        const candidates = Array.isArray(keys) ? keys : [keys];
        let deleted = 0;
        for (const key of candidates) {
          if (staged.delete(key)) deleted += 1;
        }
        return Array.isArray(keys) ? deleted : deleted > 0;
      }
    } as unknown as DurableObjectTransaction;
    const result = await callback(transaction);
    if (this.failNextTransaction) {
      this.failNextTransaction = false;
      throw new Error("simulated atomic commit failure");
    }
    this.data = staged;
    return result;
  }

  keys(prefix: string): string[] {
    return [...this.data.keys()].filter((key) => key.startsWith(prefix));
  }
}

function roomMeta(): RoomMeta {
  return {
    schemaVersion: 1,
    roomId: `wb_${"a".repeat(43)}`,
    roomType: "private",
    createdAt: 1,
    lastActiveAt: 1,
    emptySince: null,
    deleteAt: null,
    onlineCount: 1,
    documentVersion: 0,
    snapshotVersion: 0,
    isLocked: false,
    resourceUsage: { bytes: 0, images: 0 },
    updateCount: 0,
    updateBytes: 0,
    cleanupRetryCount: 0
  };
}

function elementUpdate(id: string): Uint8Array {
  const document = new Y.Doc();
  document.getMap("elements").set(id, {
    id,
    type: "rectangle",
    isDeleted: false
  });
  const update = Y.encodeStateAsUpdate(document);
  document.destroy();
  return update;
}

describe("YjsDocumentStore atomic persistence", () => {
  it("never commits an update without its matching room metadata", async () => {
    const storage = new AtomicMemoryStorage();
    const initialMeta = roomMeta();
    await storage.put(ROOM_META_KEY, initialMeta);
    const store = new YjsDocumentStore(
      storage as unknown as DurableObjectStorage
    );
    await store.load();

    storage.failNextTransaction = true;
    await expect(
      store.applyIncrementalUpdate(elementUpdate("before-crash"), initialMeta)
    ).rejects.toThrow("simulated atomic commit failure");

    expect(await storage.get<RoomMeta>(ROOM_META_KEY)).toEqual(initialMeta);
    expect(storage.keys(DOCUMENT_UPDATE_PREFIX)).toEqual([]);

    const result = await store.applyIncrementalUpdate(
      elementUpdate("after-retry"),
      initialMeta
    );
    expect(result.accepted).toBe(true);
    expect(result.meta.documentVersion).toBe(1);
    expect(
      (await storage.get<RoomMeta>(ROOM_META_KEY))?.documentVersion
    ).toBe(1);
    expect(storage.keys(DOCUMENT_UPDATE_PREFIX)).toHaveLength(1);

    const reloaded = new YjsDocumentStore(
      storage as unknown as DurableObjectStorage
    );
    await reloaded.load();
    const restored = new Y.Doc();
    Y.applyUpdate(restored, reloaded.encodeState());
    expect(restored.getMap("elements").has("before-crash")).toBe(false);
    expect(restored.getMap("elements").has("after-retry")).toBe(true);
    restored.destroy();
  });

  it("caches the encoded document size after load, update, and clear", async () => {
    const storage = new AtomicMemoryStorage();
    const initialMeta = roomMeta();
    await storage.put(ROOM_META_KEY, initialMeta);
    const store = new YjsDocumentStore(
      storage as unknown as DurableObjectStorage
    );
    await store.load();

    const emptyBytes = store.encodedStateByteLength();
    expect(emptyBytes).toBe(store.encodeState().byteLength);

    const applied = await store.applyIncrementalUpdate(
      elementUpdate("sized-element"),
      initialMeta
    );
    expect(applied.accepted).toBe(true);
    const populatedBytes = store.encodedStateByteLength();
    expect(populatedBytes).toBe(store.encodeState().byteLength);
    expect(populatedBytes).toBeGreaterThan(emptyBytes);

    await store.clear(applied.meta);
    expect(store.encodedStateByteLength()).toBe(store.encodeState().byteLength);
    expect(store.encodedStateByteLength()).toBeLessThan(populatedBytes);
  });
});
