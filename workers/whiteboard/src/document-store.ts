import * as Y from "yjs";
import {
  ROOM_META_KEY,
  DOCUMENT_SNAPSHOT_CHUNK_BYTES,
  DOCUMENT_SNAPSHOT_CHUNK_PREFIX,
  DOCUMENT_SNAPSHOT_KEY,
  DOCUMENT_UPDATE_PREFIX,
  MAX_DOCUMENT_BYTES,
  MAX_OBJECTS,
  MAX_UPDATE_BYTES_BEFORE_COMPACTION,
  MAX_UPDATES_BEFORE_COMPACTION
} from "./constants";
import type { RoomMeta } from "./types";

interface ChunkedSnapshotManifest {
  format: "chunked-v1";
  byteLength: number;
  chunkCount: number;
}

function toArrayBuffer(value: Uint8Array): ArrayBuffer {
  return value.buffer.slice(
    value.byteOffset,
    value.byteOffset + value.byteLength
  ) as ArrayBuffer;
}

function countActiveElements(document: Y.Doc): number {
  const elements = document.getMap<unknown>("elements");
  let activeCount = 0;
  elements.forEach((value) => {
    if (value instanceof Y.Map) {
      if (value.get("isDeleted") !== true) activeCount += 1;
      return;
    }
    if (
      typeof value !== "object" ||
      value === null ||
      !("isDeleted" in value) ||
      (value as { isDeleted?: boolean }).isDeleted !== true
    ) {
      activeCount += 1;
    }
  });
  return activeCount;
}

function updateKey(version: number): string {
  return `${DOCUMENT_UPDATE_PREFIX}${version.toString().padStart(12, "0")}`;
}

function snapshotChunkKey(index: number): string {
  return `${DOCUMENT_SNAPSHOT_CHUNK_PREFIX}${index
    .toString()
    .padStart(4, "0")}`;
}

function isChunkedSnapshotManifest(
  value: unknown
): value is ChunkedSnapshotManifest {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ChunkedSnapshotManifest>;
  const maxChunks = Math.ceil(
    MAX_DOCUMENT_BYTES / DOCUMENT_SNAPSHOT_CHUNK_BYTES
  );
  return (
    candidate.format === "chunked-v1" &&
    Number.isSafeInteger(candidate.byteLength) &&
    Number(candidate.byteLength) > 0 &&
    Number(candidate.byteLength) <= MAX_DOCUMENT_BYTES &&
    Number.isSafeInteger(candidate.chunkCount) &&
    Number(candidate.chunkCount) > 0 &&
    Number(candidate.chunkCount) <= maxChunks &&
    Number(candidate.chunkCount) ===
      Math.ceil(
        Number(candidate.byteLength) / DOCUMENT_SNAPSHOT_CHUNK_BYTES
      )
  );
}

export interface ApplyUpdateResult {
  accepted: boolean;
  reason?: "object-limit" | "document-limit" | "invalid-update";
  meta: RoomMeta;
}

export class YjsDocumentStore {
  private document = new Y.Doc();
  private encodedStateBytes = 0;

  constructor(private readonly storage: DurableObjectStorage) {}

  async load(): Promise<void> {
    const snapshot = await this.readSnapshot();
    if (snapshot) {
      Y.applyUpdate(this.document, snapshot);
    }
    const updates = await this.storage.list<ArrayBuffer>({
      prefix: DOCUMENT_UPDATE_PREFIX
    });
    for (const update of updates.values()) {
      Y.applyUpdate(this.document, new Uint8Array(update));
    }
    this.encodedStateBytes = Y.encodeStateAsUpdate(this.document).byteLength;
  }

  encodeState(): Uint8Array {
    const state = Y.encodeStateAsUpdate(this.document);
    this.encodedStateBytes = state.byteLength;
    return state;
  }

  encodeDifference(stateVector: Uint8Array): Uint8Array {
    return Y.encodeStateAsUpdate(this.document, stateVector);
  }

  encodedStateByteLength(): number {
    return this.encodedStateBytes;
  }

  private async readSnapshot(): Promise<Uint8Array | null> {
    const stored = await this.storage.get<
      ArrayBuffer | ChunkedSnapshotManifest
    >(DOCUMENT_SNAPSHOT_KEY);
    if (!stored) return null;
    if (stored instanceof ArrayBuffer) {
      return new Uint8Array(stored);
    }
    if (!isChunkedSnapshotManifest(stored)) {
      throw new Error("document_snapshot_invalid");
    }
    const chunks = await this.storage.list<ArrayBuffer>({
      prefix: DOCUMENT_SNAPSHOT_CHUNK_PREFIX
    });
    const snapshot = new Uint8Array(stored.byteLength);
    let offset = 0;
    for (let index = 0; index < stored.chunkCount; index += 1) {
      const chunk = chunks.get(snapshotChunkKey(index));
      if (!(chunk instanceof ArrayBuffer)) {
        throw new Error("document_snapshot_incomplete");
      }
      if (offset + chunk.byteLength > snapshot.byteLength) {
        throw new Error("document_snapshot_invalid");
      }
      snapshot.set(new Uint8Array(chunk), offset);
      offset += chunk.byteLength;
    }
    if (offset !== snapshot.byteLength) {
      throw new Error("document_snapshot_incomplete");
    }
    return snapshot;
  }

  private async writeSnapshot(
    transaction: DurableObjectTransaction,
    snapshot: Uint8Array,
    previousChunkKeys: string[]
  ): Promise<void> {
    if (previousChunkKeys.length > 0) {
      await transaction.delete(previousChunkKeys);
    }
    if (snapshot.byteLength <= DOCUMENT_SNAPSHOT_CHUNK_BYTES) {
      await transaction.put(
        DOCUMENT_SNAPSHOT_KEY,
        toArrayBuffer(snapshot)
      );
      return;
    }
    const chunkCount = Math.ceil(
      snapshot.byteLength / DOCUMENT_SNAPSHOT_CHUNK_BYTES
    );
    const manifest: ChunkedSnapshotManifest = {
      format: "chunked-v1",
      byteLength: snapshot.byteLength,
      chunkCount
    };
    await transaction.put(DOCUMENT_SNAPSHOT_KEY, manifest);
    for (let index = 0; index < chunkCount; index += 1) {
      const start = index * DOCUMENT_SNAPSHOT_CHUNK_BYTES;
      const end = Math.min(
        snapshot.byteLength,
        start + DOCUMENT_SNAPSHOT_CHUNK_BYTES
      );
      await transaction.put(
        snapshotChunkKey(index),
        toArrayBuffer(snapshot.subarray(start, end))
      );
    }
  }

  activeObjectCount(): number {
    return countActiveElements(this.document);
  }

  referencedAssetIds(): Set<string> {
    const referenced = new Set<string>();
    this.document.getMap<unknown>("assets").forEach((value) => {
      if (value instanceof Y.Map) {
        const assetId = value.get("assetId");
        if (typeof assetId === "string") referenced.add(assetId);
        return;
      }
      if (
        value &&
        typeof value === "object" &&
        "assetId" in value &&
        typeof (value as { assetId?: unknown }).assetId === "string"
      ) {
        referenced.add((value as { assetId: string }).assetId);
      }
    });
    return referenced;
  }

  async applyIncrementalUpdate(
    update: Uint8Array,
    meta: RoomMeta
  ): Promise<ApplyUpdateResult> {
    const candidate = new Y.Doc();
    try {
      Y.applyUpdate(candidate, Y.encodeStateAsUpdate(this.document));
      Y.applyUpdate(candidate, update);
    } catch {
      candidate.destroy();
      return { accepted: false, reason: "invalid-update", meta };
    }
    if (countActiveElements(candidate) > MAX_OBJECTS) {
      candidate.destroy();
      return { accepted: false, reason: "object-limit", meta };
    }
    const encodedCandidate = Y.encodeStateAsUpdate(candidate);
    if (encodedCandidate.byteLength > MAX_DOCUMENT_BYTES) {
      candidate.destroy();
      return { accepted: false, reason: "document-limit", meta };
    }

    const nextMeta: RoomMeta = {
      ...meta,
      documentVersion: meta.documentVersion + 1,
      updateCount: meta.updateCount + 1,
      updateBytes: meta.updateBytes + update.byteLength
    };
    const shouldCompact =
      nextMeta.updateCount >= MAX_UPDATES_BEFORE_COMPACTION ||
      nextMeta.updateBytes >= MAX_UPDATE_BYTES_BEFORE_COMPACTION;
    const committedMeta = shouldCompact
      ? {
          ...nextMeta,
          snapshotVersion: nextMeta.documentVersion,
          updateCount: 0,
          updateBytes: 0
        }
      : nextMeta;

    try {
      if (shouldCompact) {
        const updateEntries = await this.storage.list({
          prefix: DOCUMENT_UPDATE_PREFIX
        });
        const snapshotChunkEntries = await this.storage.list({
          prefix: DOCUMENT_SNAPSHOT_CHUNK_PREFIX
        });
        await this.storage.transaction(async (transaction) => {
          await this.writeSnapshot(
            transaction,
            encodedCandidate,
            [...snapshotChunkEntries.keys()]
          );
          if (updateEntries.size > 0) {
            await transaction.delete([...updateEntries.keys()]);
          }
          await transaction.put(ROOM_META_KEY, committedMeta);
        });
      } else {
        await this.storage.transaction(async (transaction) => {
          await transaction.put(
            updateKey(committedMeta.documentVersion),
            toArrayBuffer(update)
          );
          await transaction.put(ROOM_META_KEY, committedMeta);
        });
      }
    } catch (error) {
      candidate.destroy();
      throw error;
    }

    this.document.destroy();
    this.document = candidate;
    this.encodedStateBytes = encodedCandidate.byteLength;
    return { accepted: true, meta: committedMeta };
  }

  async compact(meta: RoomMeta): Promise<RoomMeta> {
    const snapshot = this.encodeState();
    const updateEntries = await this.storage.list({
      prefix: DOCUMENT_UPDATE_PREFIX
    });
    const snapshotChunkEntries = await this.storage.list({
      prefix: DOCUMENT_SNAPSHOT_CHUNK_PREFIX
    });
    const compactedMeta = {
      ...meta,
      snapshotVersion: meta.documentVersion,
      updateCount: 0,
      updateBytes: 0
    };
    await this.storage.transaction(async (transaction) => {
      await this.writeSnapshot(
        transaction,
        snapshot,
        [...snapshotChunkEntries.keys()]
      );
      if (updateEntries.size > 0) {
        await transaction.delete([...updateEntries.keys()]);
      }
      await transaction.put(ROOM_META_KEY, compactedMeta);
    });
    this.encodedStateBytes = snapshot.byteLength;
    return compactedMeta;
  }

  async clear(meta: RoomMeta): Promise<RoomMeta> {
    const emptyDocument = new Y.Doc();
    const emptySnapshot = Y.encodeStateAsUpdate(emptyDocument);
    const updates = await this.storage.list({
      prefix: DOCUMENT_UPDATE_PREFIX
    });
    const snapshotChunkEntries = await this.storage.list({
      prefix: DOCUMENT_SNAPSHOT_CHUNK_PREFIX
    });
    const version = meta.documentVersion + 1;
    const clearedMeta = {
      ...meta,
      documentVersion: version,
      snapshotVersion: version,
      updateCount: 0,
      updateBytes: 0
    };
    try {
      await this.storage.transaction(async (transaction) => {
        await this.writeSnapshot(
          transaction,
          emptySnapshot,
          [...snapshotChunkEntries.keys()]
        );
        if (updates.size > 0) {
          await transaction.delete([...updates.keys()]);
        }
        await transaction.put(ROOM_META_KEY, clearedMeta);
      });
    } catch (error) {
      emptyDocument.destroy();
      throw error;
    }
    this.document.destroy();
    this.document = emptyDocument;
    this.encodedStateBytes = emptySnapshot.byteLength;
    return clearedMeta;
  }
}
