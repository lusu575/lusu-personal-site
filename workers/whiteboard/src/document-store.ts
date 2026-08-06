import * as Y from "yjs";
import {
  AGENT_RECEIPT_PREFIX,
  ROOM_META_KEY,
  DOCUMENT_SNAPSHOT_CHUNK_BYTES,
  DOCUMENT_SNAPSHOT_CHUNK_PREFIX,
  DOCUMENT_SNAPSHOT_KEY,
  DOCUMENT_UPDATE_PREFIX,
  MAX_DOCUMENT_BYTES,
  MAX_AGENT_ELEMENTS_PER_UPDATE,
  MAX_OBJECTS,
  MAX_UPDATE_BYTES_BEFORE_COMPACTION,
  MAX_UPDATES_BEFORE_COMPACTION
} from "./constants";
import type { AgentUpdateReceipt, RoomMeta } from "./types";

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

const AGENT_ELEMENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const AGENT_ELEMENT_TYPES = new Set([
  "text",
  "rectangle",
  "ellipse",
  "diamond",
  "line",
  "arrow"
]);
const AGENT_BASE_ELEMENT_KEYS = new Set([
  "type",
  "x",
  "y",
  "width",
  "height",
  "angle",
  "strokeColor",
  "backgroundColor",
  "fillStyle",
  "strokeWidth",
  "strokeStyle",
  "roughness",
  "opacity",
  "groupIds",
  "frameId",
  "index",
  "roundness",
  "seed",
  "version",
  "versionNonce",
  "isDeleted",
  "boundElements",
  "updated",
  "link",
  "locked",
  "__position"
]);
const AGENT_TEXT_ELEMENT_KEYS = new Set([
  "fontSize",
  "fontFamily",
  "text",
  "textAlign",
  "verticalAlign",
  "containerId",
  "originalText",
  "autoResize",
  "lineHeight"
]);
const AGENT_LINEAR_ELEMENT_KEYS = new Set([
  "points",
  "lastCommittedPoint",
  "startBinding",
  "endBinding",
  "startArrowhead",
  "endArrowhead",
  "elbowed"
]);
const AGENT_COLOR_PATTERN = /^(?:transparent|#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?)$/;

interface ChangedYjsTarget {
  _item?: {
    parent?: unknown;
    parentSub?: string | null;
  } | null;
}

export interface AgentAtomicReceiptInput {
  key: string;
  payloadSha256: string;
  createdAt: number;
  expiresAt: number;
  deleteKeys: string[];
}

function boundedFinite(value: unknown, minimum: number, maximum: number): boolean {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= minimum &&
    value <= maximum
  );
}

function boundedInteger(value: unknown, minimum: number, maximum: number): boolean {
  return Number.isSafeInteger(value) && Number(value) >= minimum && Number(value) <= maximum;
}

function safeStringArray(value: unknown, maximumItems: number): boolean {
  return (
    Array.isArray(value) &&
    value.length <= maximumItems &&
    value.every(
      (item) => typeof item === "string" && AGENT_ELEMENT_ID_PATTERN.test(item)
    )
  );
}

function safePoint(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    boundedFinite(value[0], -100_000, 100_000) &&
    boundedFinite(value[1], -100_000, 100_000)
  );
}

function safeRoundness(value: unknown): boolean {
  if (value === null) return true;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => key !== "type" && key !== "value")) {
    return false;
  }
  return (
    boundedInteger(record.type, 1, 3) &&
    (record.value === undefined || boundedFinite(record.value, 0, 100_000))
  );
}

function safeArrowhead(value: unknown): boolean {
  return value === null || [
    "arrow",
    "bar",
    "dot",
    "triangle",
    "circle",
    "circle_outline",
    "diamond",
    "diamond_outline",
    "crowfoot_one",
    "crowfoot_many",
    "crowfoot_one_or_many"
  ].includes(String(value));
}

function safeAgentElement(
  id: string,
  value: unknown
): { valid: boolean; textLength: number } {
  if (!AGENT_ELEMENT_ID_PATTERN.test(id) || !(value instanceof Y.Map)) {
    return { valid: false, textLength: 0 };
  }
  const fields = new Map<string, unknown>();
  value.forEach((fieldValue, key) => fields.set(String(key), fieldValue));
  const type = fields.get("type");
  if (typeof type !== "string" || !AGENT_ELEMENT_TYPES.has(type)) {
    return { valid: false, textLength: 0 };
  }
  const allowedKeys = new Set(AGENT_BASE_ELEMENT_KEYS);
  if (type === "text") {
    for (const key of AGENT_TEXT_ELEMENT_KEYS) allowedKeys.add(key);
  }
  if (type === "line" || type === "arrow") {
    for (const key of AGENT_LINEAR_ELEMENT_KEYS) allowedKeys.add(key);
  }
  if ([...fields.keys()].some((key) => !allowedKeys.has(key))) {
    return { valid: false, textLength: 0 };
  }
  for (const required of ["x", "y", "width", "height"]) {
    if (!fields.has(required)) return { valid: false, textLength: 0 };
  }
  if (
    !boundedFinite(fields.get("x"), -100_000, 100_000) ||
    !boundedFinite(fields.get("y"), -100_000, 100_000) ||
    !boundedFinite(fields.get("width"), 0, 100_000) ||
    !boundedFinite(fields.get("height"), 0, 100_000)
  ) {
    return { valid: false, textLength: 0 };
  }

  const validators: Record<string, (candidate: unknown) => boolean> = {
    angle: (candidate) => boundedFinite(candidate, -Math.PI * 2, Math.PI * 2),
    strokeColor: (candidate) => typeof candidate === "string" && AGENT_COLOR_PATTERN.test(candidate),
    backgroundColor: (candidate) => typeof candidate === "string" && AGENT_COLOR_PATTERN.test(candidate),
    fillStyle: (candidate) => ["solid", "hachure", "cross-hatch", "zigzag"].includes(String(candidate)),
    strokeWidth: (candidate) => boundedFinite(candidate, 0.5, 20),
    strokeStyle: (candidate) => ["solid", "dashed", "dotted"].includes(String(candidate)),
    roughness: (candidate) => boundedInteger(candidate, 0, 2),
    opacity: (candidate) => boundedInteger(candidate, 0, 100),
    groupIds: (candidate) => safeStringArray(candidate, 20),
    frameId: (candidate) => candidate === null,
    index: (candidate) => typeof candidate === "string" && candidate.length <= 64 && /^[A-Za-z0-9_-]+$/.test(candidate),
    roundness: safeRoundness,
    seed: (candidate) => boundedInteger(candidate, -2_147_483_648, 2_147_483_647),
    version: (candidate) => boundedInteger(candidate, 1, 2_147_483_647),
    versionNonce: (candidate) => boundedInteger(candidate, -2_147_483_648, 2_147_483_647),
    isDeleted: (candidate) => candidate === false,
    boundElements: (candidate) => candidate === null || (Array.isArray(candidate) && candidate.length === 0),
    updated: (candidate) => boundedInteger(candidate, 0, Number.MAX_SAFE_INTEGER),
    link: (candidate) => candidate === null,
    locked: (candidate) => typeof candidate === "boolean",
    __position: (candidate) => boundedInteger(candidate, 0, 5_000),
    fontSize: (candidate) => boundedFinite(candidate, 1, 256),
    fontFamily: (candidate) => boundedInteger(candidate, 1, 5),
    textAlign: (candidate) => ["left", "center", "right"].includes(String(candidate)),
    verticalAlign: (candidate) => ["top", "middle", "bottom"].includes(String(candidate)),
    containerId: (candidate) => candidate === null,
    autoResize: (candidate) => typeof candidate === "boolean",
    lineHeight: (candidate) => boundedFinite(candidate, 0.5, 3),
    lastCommittedPoint: (candidate) => candidate === null || safePoint(candidate),
    startBinding: (candidate) => candidate === null,
    endBinding: (candidate) => candidate === null,
    startArrowhead: safeArrowhead,
    endArrowhead: safeArrowhead,
    elbowed: (candidate) => typeof candidate === "boolean"
  };
  for (const [key, fieldValue] of fields) {
    if (["type", "x", "y", "width", "height", "text", "originalText", "points"].includes(key)) {
      continue;
    }
    const validate = validators[key];
    if (!validate || !validate(fieldValue)) {
      return { valid: false, textLength: 0 };
    }
  }

  if (type === "text") {
    const text = fields.get("text");
    const originalText = fields.get("originalText");
    if (
      typeof text !== "string" ||
      Array.from(text).length > 4_000 ||
      (originalText !== undefined &&
        (typeof originalText !== "string" || Array.from(originalText).length > 4_000))
    ) {
      return { valid: false, textLength: 0 };
    }
    return { valid: true, textLength: Array.from(text).length };
  }
  if (type === "line" || type === "arrow") {
    const points = fields.get("points");
    if (
      !Array.isArray(points) ||
      points.length < 2 ||
      points.length > 256 ||
      !points.every(safePoint)
    ) {
      return { valid: false, textLength: 0 };
    }
  }
  return { valid: true, textLength: 0 };
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
  reason?: "object-limit" | "document-limit" | "invalid-update" | "agent-policy";
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
    return this.applyUpdate(update, meta, null);
  }

  async applyAgentIncrementalUpdate(
    update: Uint8Array,
    meta: RoomMeta,
    receipt: AgentAtomicReceiptInput
  ): Promise<ApplyUpdateResult> {
    return this.applyUpdate(update, meta, receipt);
  }

  private async applyUpdate(
    update: Uint8Array,
    meta: RoomMeta,
    receipt: AgentAtomicReceiptInput | null
  ): Promise<ApplyUpdateResult> {
    const candidate = new Y.Doc();
    try {
      Y.applyUpdate(candidate, Y.encodeStateAsUpdate(this.document));
      if (receipt) {
        if (!this.applySafeAgentUpdate(candidate, update)) {
          candidate.destroy();
          return { accepted: false, reason: "agent-policy", meta };
        }
      } else {
        Y.applyUpdate(candidate, update);
      }
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
          await this.writeAgentReceipt(transaction, receipt, committedMeta);
        });
      } else {
        await this.storage.transaction(async (transaction) => {
          await transaction.put(
            updateKey(committedMeta.documentVersion),
            toArrayBuffer(update)
          );
          await transaction.put(ROOM_META_KEY, committedMeta);
          await this.writeAgentReceipt(transaction, receipt, committedMeta);
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

  private applySafeAgentUpdate(candidate: Y.Doc, update: Uint8Array): boolean {
    const elements = candidate.getMap<unknown>("elements");
    const beforeIds = new Set(elements.keys());
    const changes: Array<{ target: unknown; keys: Set<string | null> }> = [];
    const observer = (transaction: Y.Transaction): void => {
      transaction.changed.forEach((keys, target) => {
        changes.push({
          target,
          keys: new Set(keys)
        });
      });
    };
    candidate.on("afterTransaction", observer);
    try {
      Y.applyUpdate(candidate, update);
    } finally {
      candidate.off("afterTransaction", observer);
    }

    const afterIds = new Set(elements.keys());
    if ([...beforeIds].some((id) => !afterIds.has(id))) return false;
    const newIds = [...afterIds].filter((id) => !beforeIds.has(id));
    if (
      newIds.length < 1 ||
      newIds.length > MAX_AGENT_ELEMENTS_PER_UPDATE ||
      afterIds.size !== beforeIds.size + newIds.length
    ) {
      return false;
    }
    const newIdSet = new Set(newIds);
    const elementsRoot = candidate.share.get("elements");
    for (const change of changes) {
      if (change.target === elementsRoot) {
        if (
          [...change.keys].some(
            (key) => typeof key !== "string" || !newIdSet.has(key)
          )
        ) {
          return false;
        }
        continue;
      }
      const item = (change.target as ChangedYjsTarget)?._item;
      if (
        !item ||
        item.parent !== elementsRoot ||
        typeof item.parentSub !== "string" ||
        !newIdSet.has(item.parentSub)
      ) {
        return false;
      }
    }

    let totalTextLength = 0;
    for (const id of newIds) {
      const validated = safeAgentElement(id, elements.get(id));
      if (!validated.valid) return false;
      totalTextLength += validated.textLength;
      if (totalTextLength > 20_000) return false;
    }
    return true;
  }

  private async writeAgentReceipt(
    transaction: DurableObjectTransaction,
    receipt: AgentAtomicReceiptInput | null,
    meta: RoomMeta
  ): Promise<void> {
    if (!receipt) return;
    if (
      !new RegExp(`^${AGENT_RECEIPT_PREFIX}[a-f0-9]{64}$`).test(receipt.key) ||
      !/^[a-f0-9]{64}$/.test(receipt.payloadSha256) ||
      !Number.isSafeInteger(receipt.createdAt) ||
      !Number.isSafeInteger(receipt.expiresAt) ||
      receipt.expiresAt <= receipt.createdAt
    ) {
      throw new Error("agent_receipt_invalid");
    }
    const deleteKeys = [...new Set(receipt.deleteKeys)].filter(
      (key) => key !== receipt.key && key.startsWith(AGENT_RECEIPT_PREFIX)
    );
    if (deleteKeys.length > 0) {
      await transaction.delete(deleteKeys);
    }
    const value: AgentUpdateReceipt = {
      version: 1,
      payloadSha256: receipt.payloadSha256,
      documentVersion: meta.documentVersion,
      createdAt: receipt.createdAt,
      expiresAt: receipt.expiresAt
    };
    await transaction.put(receipt.key, value);
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
    const agentReceipts = await this.storage.list({
      prefix: AGENT_RECEIPT_PREFIX
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
        if (agentReceipts.size > 0) {
          await transaction.delete([...agentReceipts.keys()]);
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
