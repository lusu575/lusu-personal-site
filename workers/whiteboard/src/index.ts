import { DurableObject } from "cloudflare:workers";
import {
  ADMIN_AUTHORIZED_HEADER,
  AGENT_ASSETS_AUTHORIZED_HEADER,
  AGENT_ASSET_RECEIPT_PREFIX,
  AGENT_AUTHORIZED_HEADER,
  AGENT_OPERATION_ID_HEADER,
  AGENT_RECEIPT_PREFIX,
  AGENT_RECEIPT_TTL_MS,
  AGENT_SUBJECT_HEADER,
  ANONYMOUS_ID_HEADER,
  ASSET_REFERENCE_RECHECK_MS,
  ASSET_SWEEP_NEXT_KEY,
  CONSUMED_TICKET_TTL_MS,
  D1_METADATA_SYNC_INTERVAL_MS,
  DEFAULT_CLIENT_UPDATE_INTERVAL_MS,
  DISPLAY_NAME_B64_HEADER,
  IDENTITY_COLOR_HEADER,
  IDENTITY_VERSION_HEADER,
  IMAGE_META_PREFIX,
  IP_HASH_HEADER,
  MAX_AWARENESS_BYTES,
  MAX_AGENT_ASSET_RECEIPTS,
  MAX_AGENT_RECEIPTS,
  MAX_BYTES_PER_WINDOW,
  MAX_CONNECTIONS_PER_IDENTITY,
  MAX_CONNECTIONS_PER_IP,
  MAX_CONNECTIONS_PER_ROOM,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_BYTES_PER_ROOM,
  MAX_IMAGE_DIMENSION,
  MAX_IMAGE_PIXELS,
  MAX_IMAGES_PER_ROOM,
  MAX_LARGE_DOCUMENT_UPDATES_PER_WINDOW,
  MAX_MESSAGES_PER_WINDOW,
  MAX_MESSAGE_BYTES,
  MAX_SYNC_REQUESTS_PER_WINDOW,
  MAX_SYNC_RESPONSE_BYTES_PER_WINDOW,
  MAX_UPLOADS_PER_IP_WINDOW,
  MAX_UPLOADS_PER_WINDOW,
  MAX_UPDATES_PER_WINDOW,
  MAX_VERY_LARGE_DOCUMENT_UPDATES_PER_WINDOW,
  MAX_AWARENESS_PER_WINDOW,
  LARGE_DOCUMENT_UPDATE_THRESHOLD_BYTES,
  LARGE_DOCUMENT_CLIENT_UPDATE_INTERVAL_MS,
  MESSAGE_RATE_WINDOW_MS,
  PUBLIC_ROOM_ID,
  RATE_STATE_RETENTION_MS,
  RATE_SWEEP_NEXT_KEY,
  ROOM_BANS_KEY,
  ROOM_ID_HEADER,
  ROOM_META_KEY,
  ROOM_TYPE_HEADER,
  TICKET_JTI_HEADER,
  TICKET_JTI_PREFIX,
  SYNC_RATE_PREFIX,
  SYNC_RATE_WINDOW_MS,
  UNREFERENCED_ASSET_GRACE_MS,
  UPLOAD_RATE_PREFIX,
  UPLOAD_RATE_WINDOW_MS,
  VERY_LARGE_DOCUMENT_UPDATE_THRESHOLD_BYTES,
  VERY_LARGE_DOCUMENT_CLIENT_UPDATE_INTERVAL_MS,
  WEBSOCKET_PROTOCOL,
  WS_YJS_STATE_VECTOR,
  WS_YJS_UPDATE
} from "./constants";
import { YjsDocumentStore } from "./document-store";
import { parseSafeRasterImage } from "./image";
import {
  isConnectionStale,
  markRoomEmpty,
  markRoomJoined,
  nextAlarmAt,
  nextCleanupRetryAt,
  shouldDeleteRoom
} from "./lifecycle";
import {
  compactNameSuffix,
  decodeDisplayNameHeader,
  isTrustedInternalRequest,
  isValidAnonymousId,
  isValidRoomId,
  normalizeColor,
  normalizeDisplayName,
  normalizeIpHash,
  originIsAllowed,
  parseBoundedJson,
  randomId,
  safeJsonResponse,
  utf8ByteLength
} from "./security";
import type {
  AdminAction,
  AgentAssetReceipt,
  AgentUpdateReceipt,
  BanEntry,
  ConnectionAttachment,
  ImageMeta,
  Participant,
  RoomMeta,
  RoomType,
  UploadRateState,
  WhiteboardEnv
} from "./types";

interface AwarenessMessage {
  type: "awareness";
  cursor?: { x: number; y: number; pointer: "mouse" | "pen" | "touch" };
  selection?: string[];
  drawing?: boolean;
  focused?: boolean;
  away?: boolean;
}

interface HeartbeatMessage {
  type: "heartbeat";
  focused?: boolean;
}

interface FocusMessage {
  type: "focus";
  focused: boolean;
}

const IDENTITY_VERSION_PATTERN = /^[1-9][0-9]{0,8}$/;
const TICKET_JTI_PATTERN = /^[A-Za-z0-9_-]{16,160}$/;
const ASSET_ID_PATTERN = /^[a-f0-9]{32}$/;
const AGENT_SUBJECT_PATTERN = /^[a-f0-9]{64}$/;
const AGENT_OPERATION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,79}$/;
const CLOSE_POLICY_VIOLATION = 1008;
const CLOSE_TRY_AGAIN = 1013;

function asArrayBuffer(value: Uint8Array): ArrayBuffer {
  return value.buffer.slice(
    value.byteOffset,
    value.byteOffset + value.byteLength
  ) as ArrayBuffer;
}

function encodeBinaryMessage(kind: number, payload: Uint8Array): ArrayBuffer {
  const message = new Uint8Array(payload.byteLength + 1);
  message[0] = kind;
  message.set(payload, 1);
  return asArrayBuffer(message);
}

async function sha256Hex(value: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", value));
  return Array.from(digest, (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

function isAgentAssetReceipt(value: unknown): value is AgentAssetReceipt {
  if (!value || typeof value !== "object") return false;
  const receipt = value as Partial<AgentAssetReceipt>;
  const asset = receipt.asset;
  return (
    receipt.version === 2
    && receipt.kind === "asset"
    && (receipt.status === "pending" || receipt.status === "committed")
    && isValidRoomId(String(receipt.roomId || ""))
    && /^[a-f0-9]{64}$/.test(String(receipt.payloadSha256 || ""))
    && Boolean(asset)
    && ASSET_ID_PATTERN.test(String(asset?.assetId || ""))
    && ["image/png", "image/jpeg", "image/webp"].includes(String(asset?.contentType || ""))
    && Number.isSafeInteger(asset?.byteLength)
    && Number(asset?.byteLength) > 0
    && Number(asset?.byteLength) <= MAX_IMAGE_BYTES
    && Number.isSafeInteger(asset?.width)
    && Number(asset?.width) > 0
    && Number(asset?.width) <= MAX_IMAGE_DIMENSION
    && Number.isSafeInteger(asset?.height)
    && Number(asset?.height) > 0
    && Number(asset?.height) <= MAX_IMAGE_DIMENSION
    && Number(asset?.width) * Number(asset?.height) <= MAX_IMAGE_PIXELS
    && asset?.version === 1
    && Number.isSafeInteger(receipt.createdAt)
    && Number.isSafeInteger(receipt.expiresAt)
    && Number(receipt.expiresAt) > Number(receipt.createdAt)
  );
}

function isCanonicalImageMeta(value: unknown, roomId: string): value is ImageMeta {
  if (!value || typeof value !== "object") return false;
  const image = value as Partial<ImageMeta>;
  return (
    image.roomId === roomId
    && ASSET_ID_PATTERN.test(String(image.assetId || ""))
    && image.key === `whiteboard/v1/${roomId}/${image.assetId}`
    && ["image/png", "image/jpeg", "image/webp"].includes(String(image.contentType || ""))
    && Number.isSafeInteger(image.byteLength)
    && Number(image.byteLength) > 0
    && Number(image.byteLength) <= MAX_IMAGE_BYTES
    && Number.isSafeInteger(image.width)
    && Number(image.width) > 0
    && Number(image.width) <= MAX_IMAGE_DIMENSION
    && Number.isSafeInteger(image.height)
    && Number(image.height) > 0
    && Number(image.height) <= MAX_IMAGE_DIMENSION
    && Number(image.width) * Number(image.height) <= MAX_IMAGE_PIXELS
    && Number.isSafeInteger(image.createdAt)
    && Number(image.createdAt) > 0
    && typeof image.createdBy === "string"
    && image.createdBy.length > 0
  );
}

function assetReceiptMatchesImage(
  receipt: AgentAssetReceipt,
  image: ImageMeta
): boolean {
  return (
    receipt.asset.assetId === image.assetId
    && receipt.asset.contentType === image.contentType
    && receipt.asset.byteLength === image.byteLength
    && receipt.asset.width === image.width
    && receipt.asset.height === image.height
  );
}

function socketIsOpen(socket: WebSocket): boolean {
  return socket.readyState === WebSocket.OPEN;
}

function parseRoomType(value: string | null): RoomType | null {
  return value === "public" || value === "private" ? value : null;
}

function createRoomMeta(roomId: string, roomType: RoomType, now: number): RoomMeta {
  return {
    schemaVersion: 1,
    roomId,
    roomType,
    createdAt: now,
    lastActiveAt: now,
    emptySince: null,
    deleteAt: null,
    onlineCount: 0,
    documentVersion: 0,
    snapshotVersion: 0,
    isLocked: false,
    resourceUsage: { bytes: 0, images: 0 },
    updateCount: 0,
    updateBytes: 0,
    cleanupRetryCount: 0,
    lastError: "",
    lastErrorAt: 0
  };
}

function isValidCoordinate(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Math.abs(value) <= 100_000_000
  );
}

function normalizeAwareness(value: unknown): AwarenessMessage | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  if (source.type !== "awareness") return null;
  const message: AwarenessMessage = { type: "awareness" };
  if (source.cursor !== undefined) {
    if (!source.cursor || typeof source.cursor !== "object") return null;
    const cursor = source.cursor as Record<string, unknown>;
    if (
      !isValidCoordinate(cursor.x) ||
      !isValidCoordinate(cursor.y) ||
      !["mouse", "pen", "touch"].includes(String(cursor.pointer))
    ) {
      return null;
    }
    message.cursor = {
      x: cursor.x,
      y: cursor.y,
      pointer: cursor.pointer as "mouse" | "pen" | "touch"
    };
  }
  if (source.selection !== undefined) {
    if (
      !Array.isArray(source.selection) ||
      source.selection.length > 50 ||
      source.selection.some(
        (id) => typeof id !== "string" || id.length < 1 || id.length > 128
      )
    ) {
      return null;
    }
    message.selection = source.selection;
  }
  if (typeof source.drawing === "boolean") message.drawing = source.drawing;
  if (typeof source.focused === "boolean") message.focused = source.focused;
  if (typeof source.away === "boolean") message.away = source.away;
  return message;
}

async function readBodyWithLimit(
  request: Request,
  maximumBytes: number
): Promise<Uint8Array | null> {
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (
    !Number.isFinite(contentLength) ||
    contentLength < 0 ||
    contentLength > maximumBytes
  ) {
    return null;
  }
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maximumBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

function uniqueParticipants(
  sockets: WebSocket[],
  exclude?: WebSocket
): Participant[] {
  const participants = new Map<string, Participant>();
  for (const socket of sockets) {
    if (socket === exclude || !socketIsOpen(socket)) continue;
    const attachment = readAttachment(socket);
    if (!attachment) continue;
    const current = participants.get(attachment.anonymousId);
    if (current) {
      current.connectionCount += 1;
      current.focused ||= attachment.focused;
      current.drawing ||= attachment.drawing;
      continue;
    }
    participants.set(attachment.anonymousId, {
      presenceId: attachment.presenceId,
      displayName: attachment.displayName,
      color: attachment.color,
      connectionCount: 1,
      focused: attachment.focused,
      drawing: attachment.drawing
    });
  }
  return [...participants.values()];
}

function readAttachment(socket: WebSocket): ConnectionAttachment | null {
  try {
    const value = socket.deserializeAttachment() as Partial<ConnectionAttachment> | null;
    if (
      !value ||
      value.version !== 1 ||
      typeof value.connectionId !== "string" ||
      typeof value.presenceId !== "string" ||
      typeof value.anonymousId !== "string"
    ) {
      return null;
    }
    return value as ConnectionAttachment;
  } catch {
    return null;
  }
}

export class WhiteboardRoom extends DurableObject<WhiteboardEnv> {
  private readonly documentStore: YjsDocumentStore;
  private readonly ready: Promise<void>;
  private meta: RoomMeta | null = null;
  private mutationChain: Promise<unknown> = Promise.resolve();
  private lastD1MetadataSyncAt = 0;

  constructor(ctx: DurableObjectState, env: WhiteboardEnv) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair("ping", "pong")
    );
    this.documentStore = new YjsDocumentStore(ctx.storage);
    this.ready = ctx.blockConcurrencyWhile(async () => {
      this.meta = (await ctx.storage.get<RoomMeta>(ROOM_META_KEY)) || null;
      await this.documentStore.load();
      if (this.meta) {
        const now = Date.now();
        const count = uniqueParticipants(ctx.getWebSockets()).length;
        let metadataChanged = false;
        if (
          count > 0 &&
          (this.meta.onlineCount !== count ||
            this.meta.emptySince !== null ||
            this.meta.deleteAt !== null)
        ) {
          this.meta = markRoomJoined(this.meta, now, count);
          await this.persistMeta();
          metadataChanged = true;
        } else if (
          this.meta.onlineCount > 0 ||
          (this.meta.roomType === "private" &&
            (this.meta.emptySince === null || this.meta.deleteAt === null))
        ) {
          this.meta = markRoomEmpty(this.meta, now);
          await this.persistMeta();
          metadataChanged = true;
        }
        if (metadataChanged || (await ctx.storage.getAlarm()) === null) {
          await this.scheduleAlarm();
        }
      }
    });
  }

  async fetch(request: Request): Promise<Response> {
    await this.ready;
    if (!(await isTrustedInternalRequest(request, this.env))) {
      return safeJsonResponse({ ok: false, error: "not_authorized" }, 401);
    }

    const roomId = request.headers.get(ROOM_ID_HEADER);
    const roomType = parseRoomType(request.headers.get(ROOM_TYPE_HEADER));
    if (
      !isValidRoomId(roomId) ||
      !roomType ||
      (roomType === "public") !== (roomId === PUBLIC_ROOM_ID)
    ) {
      return safeJsonResponse({ ok: false, error: "room_unavailable" }, 404);
    }
    if (
      this.meta &&
      (this.meta.roomId !== roomId || this.meta.roomType !== roomType)
    ) {
      return safeJsonResponse({ ok: false, error: "room_unavailable" }, 404);
    }

    const url = new URL(request.url);
    const isTrustedAdminRequest =
      request.headers.get(ADMIN_AUTHORIZED_HEADER) === "1" &&
      ((request.method === "GET" && url.pathname === "/status") ||
        (request.method === "POST" && url.pathname === "/admin"));
    if (
      !this.meta &&
      isTrustedAdminRequest &&
      roomId === PUBLIC_ROOM_ID &&
      roomType === "public"
    ) {
      await this.ensureMeta(roomId, roomType);
    }
    if (
      (request.method === "GET" || request.method === "POST") &&
      url.pathname === "/agent-scene"
    ) {
      if (request.headers.get(AGENT_AUTHORIZED_HEADER) !== "1") {
        return safeJsonResponse(
          { ok: false, error: "not_authorized", code: "WHITEBOARD_AGENT_NOT_AUTHORIZED" },
          403
        );
      }
      return this.enqueueMutation(() =>
        request.method === "GET"
          ? this.handleAgentSceneRead(request)
          : this.handleAgentSceneWrite(request, roomId, roomType)
      );
    }
    if (
      (request.method === "POST" && url.pathname === "/agent-assets")
      || (request.method === "GET" && url.pathname.startsWith("/agent-assets/"))
    ) {
      if (request.headers.get(AGENT_AUTHORIZED_HEADER) !== "1") {
        return safeJsonResponse(
          { ok: false, error: "not_authorized", code: "WHITEBOARD_AGENT_NOT_AUTHORIZED" },
          403
        );
      }
      return this.enqueueMutation(() =>
        request.method === "POST"
          ? this.handleAgentImageUpload(request, roomId, roomType)
          : this.handleAgentImageGet(
              request,
              url.pathname.slice("/agent-assets/".length)
            )
      );
    }
    if (request.method === "GET" && url.pathname === "/realtime") {
      return this.enqueueMutation(() =>
        this.handleWebSocketUpgrade(request, roomId, roomType)
      );
    }
    if (request.method === "POST" && url.pathname === "/assets") {
      return this.enqueueMutation(() => this.handleImageUpload(request));
    }
    if (
      request.method === "GET" &&
      url.pathname.startsWith("/assets/")
    ) {
      return this.enqueueMutation(() =>
        this.handleImageGet(request, url.pathname.slice("/assets/".length))
      );
    }
    if (request.method === "POST" && url.pathname === "/identity") {
      return this.enqueueMutation(() => this.handleIdentityRefresh(request));
    }
    if (request.method === "GET" && url.pathname === "/status") {
      return this.handleStatus(request);
    }
    if (request.method === "POST" && url.pathname === "/admin") {
      return this.enqueueMutation(() => this.handleAdmin(request));
    }
    return safeJsonResponse({ ok: false, error: "not_found" }, 404);
  }

  async webSocketMessage(
    socket: WebSocket,
    message: string | ArrayBuffer
  ): Promise<void> {
    await this.ready;
    await this.enqueueMutation(() => this.handleSocketMessage(socket, message));
  }

  async webSocketClose(
    socket: WebSocket,
    _code: number,
    _reason: string,
    _wasClean: boolean
  ): Promise<void> {
    await this.ready;
    await this.enqueueMutation(() => this.handleSocketDeparture(socket));
  }

  async webSocketError(socket: WebSocket, _error: unknown): Promise<void> {
    try {
      socket.close(1011, "connection_error");
    } catch {
      // The close event or stale sweep will reconcile membership.
    }
  }

  async alarm(): Promise<void> {
    await this.ready;
    await this.enqueueMutation(async () => {
      if (!this.meta) {
        await this.pruneAgentAssetReceipts(Date.now());
        await this.scheduleAlarm();
        return;
      }
      const now = Date.now();
      await this.pruneAgentReceipts(now);
      await this.pruneAgentAssetReceipts(now);
      await this.pruneRateStates(now);
      await this.maybeSweepUnreferencedAssets(now);
      const stale = new Set<WebSocket>();
      for (const socket of this.ctx.getWebSockets()) {
        const attachment = readAttachment(socket);
        const autoResponseAt =
          this.ctx.getWebSocketAutoResponseTimestamp(socket)?.getTime() || 0;
        const lastSeenAt = Math.max(
          Number(attachment?.lastSeenAt || 0),
          autoResponseAt
        );
        if (!attachment || isConnectionStale(lastSeenAt, now)) {
          stale.add(socket);
          try {
            socket.close(CLOSE_POLICY_VIOLATION, "heartbeat_timeout");
          } catch {
            // Membership is reconciled below even if the peer already vanished.
          }
        }
      }
      const remaining = this.ctx
        .getWebSockets()
        .filter((socket) => socketIsOpen(socket) && !stale.has(socket));
      const onlineCount = uniqueParticipants(remaining).length;

      if (onlineCount > 0) {
        if (
          this.meta.onlineCount !== onlineCount ||
          this.meta.emptySince !== null ||
          this.meta.deleteAt !== null
        ) {
          this.meta = markRoomJoined(this.meta, now, onlineCount);
          await this.persistMeta();
        }
        await this.scheduleAlarm();
        return;
      }
      if (this.meta.onlineCount > 0 || this.meta.emptySince === null) {
        this.meta = markRoomEmpty(this.meta, now);
        await this.persistMeta();
      }
      if (shouldDeleteRoom(this.meta, 0, now)) {
        await this.cleanupPrivateRoom(now);
        return;
      }
      await this.scheduleAlarm();
    });
  }

  private enqueueMutation<T>(action: () => Promise<T>): Promise<T> {
    const next = this.mutationChain.then(action, action);
    this.mutationChain = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  }

  private async ensureMeta(roomId: string, roomType: RoomType): Promise<RoomMeta> {
    if (!this.meta) {
      const now = Date.now();
      this.meta = createRoomMeta(roomId, roomType, now);
      if (roomType === "private") {
        this.meta = markRoomEmpty(this.meta, now);
      }
      await this.persistMeta();
      await this.scheduleAlarm();
    }
    return this.meta;
  }

  private async handleAgentSceneRead(request: Request): Promise<Response> {
    const subject = request.headers.get(AGENT_SUBJECT_HEADER) || "";
    if (!AGENT_SUBJECT_PATTERN.test(subject)) {
      return safeJsonResponse(
        { ok: false, error: "agent_identity_invalid", code: "WHITEBOARD_AGENT_IDENTITY_INVALID" },
        401
      );
    }
    const state = this.documentStore.encodeState();
    return new Response(asArrayBuffer(state), {
      status: 200,
      headers: {
        "cache-control": "no-store",
        "content-length": String(state.byteLength),
        "content-type": "application/vnd.yjs",
        "x-whiteboard-document-version": String(this.meta?.documentVersion || 0),
        "x-whiteboard-locked": this.meta?.isLocked ? "1" : "0",
        "x-content-type-options": "nosniff"
      }
    });
  }

  private async handleAgentSceneWrite(
    request: Request,
    roomId: string,
    roomType: RoomType
  ): Promise<Response> {
    const subject = request.headers.get(AGENT_SUBJECT_HEADER) || "";
    const operationId = request.headers.get(AGENT_OPERATION_ID_HEADER) || "";
    const contentType = String(request.headers.get("content-type") || "")
      .split(";", 1)[0]
      .trim()
      .toLowerCase();
    if (!AGENT_SUBJECT_PATTERN.test(subject)) {
      return safeJsonResponse(
        { ok: false, error: "agent_identity_invalid", code: "WHITEBOARD_AGENT_IDENTITY_INVALID" },
        401
      );
    }
    if (!AGENT_OPERATION_ID_PATTERN.test(operationId)) {
      return safeJsonResponse(
        { ok: false, error: "operation_id_invalid", code: "WHITEBOARD_AGENT_OPERATION_ID_INVALID" },
        422
      );
    }
    if (contentType !== "application/vnd.yjs-update") {
      return safeJsonResponse(
        { ok: false, error: "content_type_invalid", code: "WHITEBOARD_AGENT_CONTENT_TYPE_INVALID" },
        415
      );
    }
    if (this.meta?.isLocked) {
      return safeJsonResponse(
        { ok: false, error: "room_locked", code: "WHITEBOARD_ROOM_LOCKED" },
        423
      );
    }
    const update = await readBodyWithLimit(request, MAX_MESSAGE_BYTES);
    if (!update || update.byteLength === 0) {
      return safeJsonResponse(
        { ok: false, error: "update_invalid", code: "WHITEBOARD_AGENT_UPDATE_INVALID" },
        422
      );
    }

    const now = Date.now();
    const payloadSha256 = await sha256Hex(update);
    const receiptKey = `${AGENT_RECEIPT_PREFIX}${await sha256Hex(
      new TextEncoder().encode(`${subject}\u0000${operationId}`)
    )}`;
    const receipts = await this.ctx.storage.list<AgentUpdateReceipt>({
      prefix: AGENT_RECEIPT_PREFIX
    });
    const existing = receipts.get(receiptKey);
    if (existing && existing.expiresAt > now) {
      if (existing.payloadSha256 !== payloadSha256) {
        return safeJsonResponse(
          { ok: false, error: "operation_conflict", code: "WHITEBOARD_OPERATION_CONFLICT" },
          409
        );
      }
      return safeJsonResponse({
        ok: true,
        replayed: true,
        documentVersion: existing.documentVersion
      });
    }

    const activeReceipts = [...receipts.entries()]
      .filter(([key, value]) =>
        key !== receiptKey &&
        value?.version === 1 &&
        value.expiresAt > now
      )
      .sort((left, right) =>
        left[1].createdAt - right[1].createdAt || left[0].localeCompare(right[0])
      );
    const deleteKeys = [...receipts.entries()]
      .filter(([, value]) =>
        value?.version !== 1 ||
        !Number.isSafeInteger(value.expiresAt) ||
        value.expiresAt <= now
      )
      .map(([key]) => key);
    const excess = Math.max(0, activeReceipts.length - (MAX_AGENT_RECEIPTS - 1));
    deleteKeys.push(...activeReceipts.slice(0, excess).map(([key]) => key));

    const currentSockets = this.ctx.getWebSockets().filter(socketIsOpen);
    const onlineCount = uniqueParticipants(currentSockets).length;
    const baseMeta = this.meta || createRoomMeta(roomId, roomType, now);
    const activeMeta = onlineCount > 0
      ? markRoomJoined(baseMeta, now, onlineCount)
      : markRoomEmpty(baseMeta, now);
    const allowedAssets = request.headers.get(AGENT_ASSETS_AUTHORIZED_HEADER) === "1"
      ? await this.agentAllowedAssets(roomId)
      : new Map<string, ImageMeta>();
    const result = await this.documentStore.applyAgentIncrementalUpdate(
      update,
      activeMeta,
      {
        key: receiptKey,
        payloadSha256,
        createdAt: now,
        expiresAt: now + AGENT_RECEIPT_TTL_MS,
        deleteKeys
      },
      allowedAssets
    );
    if (!result.accepted) {
      return safeJsonResponse(
        {
          ok: false,
          error: "update_rejected",
          code: "WHITEBOARD_AGENT_UPDATE_REJECTED"
        },
        422
      );
    }

    this.meta = result.meta;
    this.broadcastBinary(WS_YJS_UPDATE, update);
    await this.scheduleAlarm();
    await this.persistD1MetadataIfDue(this.meta, now);
    return safeJsonResponse({
      ok: true,
      replayed: false,
      documentVersion: this.meta.documentVersion
    });
  }

  private async handleWebSocketUpgrade(
    request: Request,
    roomId: string,
    roomType: RoomType
  ): Promise<Response> {
    if (
      request.headers.get("upgrade")?.toLowerCase() !== "websocket" ||
      !request.headers
        .get("sec-websocket-protocol")
        ?.split(",")
        .map((value) => value.trim())
        .includes(WEBSOCKET_PROTOCOL)
    ) {
      return safeJsonResponse({ ok: false, error: "upgrade_required" }, 426);
    }
    if (!originIsAllowed(request, this.env)) {
      return safeJsonResponse({ ok: false, error: "origin_not_allowed" }, 403);
    }
    const anonymousId = request.headers.get(ANONYMOUS_ID_HEADER);
    const ticketJti = request.headers.get(TICKET_JTI_HEADER) || "";
    const identityVersionValue = request.headers.get(IDENTITY_VERSION_HEADER) || "";
    if (
      !isValidAnonymousId(anonymousId) ||
      !TICKET_JTI_PATTERN.test(ticketJti) ||
      !IDENTITY_VERSION_PATTERN.test(identityVersionValue)
    ) {
      return safeJsonResponse({ ok: false, error: "identity_invalid" }, 401);
    }
    const identityVersion = Number(identityVersionValue);
    const decodedDisplayName = decodeDisplayNameHeader(
      request.headers.get(DISPLAY_NAME_B64_HEADER)
    );
    if (decodedDisplayName === null) {
      return safeJsonResponse({ ok: false, error: "identity_invalid" }, 401);
    }
    const ipHash = normalizeIpHash(request.headers.get(IP_HASH_HEADER));
    if (!ipHash) {
      return safeJsonResponse({ ok: false, error: "identity_invalid" }, 401);
    }
    const meta = await this.ensureMeta(roomId, roomType);
    const sockets = this.ctx.getWebSockets().filter(socketIsOpen);
    if (sockets.length >= MAX_CONNECTIONS_PER_ROOM) {
      return safeJsonResponse({ ok: false, error: "room_full" }, 429);
    }
    const sameIdentity = sockets.filter(
      (socket) => readAttachment(socket)?.anonymousId === anonymousId
    );
    if (sameIdentity.length >= MAX_CONNECTIONS_PER_IDENTITY) {
      return safeJsonResponse({ ok: false, error: "connection_limit" }, 429);
    }
    const sameIp = sockets.filter(
      (socket) => readAttachment(socket)?.ipHash === ipHash
    );
    if (sameIp.length >= MAX_CONNECTIONS_PER_IP) {
      return safeJsonResponse({ ok: false, error: "connection_limit" }, 429);
    }
    if (!(await this.consumeTicketJti(ticketJti, Date.now()))) {
      return safeJsonResponse({ ok: false, error: "ticket_reused" }, 409);
    }
    if (await this.isBanned(anonymousId, ipHash)) {
      return safeJsonResponse({ ok: false, error: "access_denied" }, 403);
    }

    const existing = sameIdentity
      .map(readAttachment)
      .find((attachment): attachment is ConnectionAttachment => Boolean(attachment));
    const requestedColor = normalizeColor(
      request.headers.get(IDENTITY_COLOR_HEADER)
    );
    const highestExistingIdentityVersion =
      sameIdentity.length > 0
        ? Math.max(
            ...sameIdentity
              .map(readAttachment)
              .filter(
                (attachment): attachment is ConnectionAttachment =>
                  Boolean(attachment)
              )
              .map((attachment) => attachment.identityVersion)
          )
        : 0;
    const identityWasRotated =
      Boolean(existing) && identityVersion > highestExistingIdentityVersion;
    const displayName = identityWasRotated
      ? this.assignUniqueNameExcludingIdentity(
          anonymousId,
          normalizeDisplayName(decodedDisplayName)
        )
      : existing?.displayName ||
        this.assignUniqueName(
          anonymousId,
          normalizeDisplayName(decodedDisplayName)
        );
    const color = identityWasRotated
      ? requestedColor
      : existing?.color || requestedColor;
    if (identityWasRotated) {
      for (const existingSocket of sameIdentity) {
        const existingAttachment = readAttachment(existingSocket);
        if (!existingAttachment) continue;
        existingAttachment.displayName = displayName;
        existingAttachment.color = color;
        existingAttachment.identityVersion = identityVersion;
        existingSocket.serializeAttachment(existingAttachment);
      }
    }
    const presenceId = existing?.presenceId || randomId(12);
    const now = Date.now();
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    const attachment: ConnectionAttachment = {
      version: 1,
      connectionId: randomId(12),
      presenceId,
      anonymousId,
      displayName,
      color,
      identityVersion,
      ticketJti,
      ipHash,
      connectedAt: now,
      lastSeenAt: now,
      rateWindowStartedAt: now,
      messagesInWindow: 0,
      updatesInWindow: 0,
      awarenessInWindow: 0,
      bytesInWindow: 0,
      focused: true,
      drawing: false
    };
    server.serializeAttachment(attachment);
    this.ctx.acceptWebSocket(server, ["whiteboard"]);

    const participants = uniqueParticipants(this.ctx.getWebSockets());
    this.meta = markRoomJoined(meta, now, participants.length);
    await this.persistMeta();
    await this.scheduleAlarm();

    this.sendText(server, {
      type: "ready",
      connectionId: attachment.connectionId,
      participant: this.publicParticipant(attachment, sameIdentity.length + 1),
      participants,
      locked: this.meta.isLocked,
      documentVersion: this.meta.documentVersion,
      updateIntervalMs: this.recommendedClientUpdateIntervalMs()
    });
    this.broadcastText(
      {
        type: existing ? "participant-update" : "participant-join",
        participant: this.publicParticipant(
          attachment,
          sameIdentity.length + 1
        ),
        onlineCount: participants.length
      },
      server
    );
    return new Response(null, {
      status: 101,
      headers: { "sec-websocket-protocol": WEBSOCKET_PROTOCOL },
      webSocket: client
    });
  }

  private async handleSocketMessage(
    socket: WebSocket,
    message: string | ArrayBuffer
  ): Promise<void> {
    const attachment = readAttachment(socket);
    if (!attachment || !this.meta || !socketIsOpen(socket)) {
      this.closeSocket(socket, CLOSE_POLICY_VIOLATION, "invalid_session");
      return;
    }
    const byteLength =
      typeof message === "string" ? utf8ByteLength(message) : message.byteLength;
    if (byteLength > MAX_MESSAGE_BYTES) {
      this.closeSocket(socket, 1009, "message_too_large");
      return;
    }
    const category =
      typeof message !== "string" &&
      new Uint8Array(message, 0, Math.min(1, message.byteLength))[0] ===
        WS_YJS_UPDATE
        ? "update"
        : typeof message === "string"
          ? "text"
          : "binary";
    if (!this.consumeMessageRate(attachment, byteLength, category)) {
      socket.serializeAttachment(attachment);
      this.closeSocket(socket, CLOSE_POLICY_VIOLATION, "rate_limited");
      return;
    }
    attachment.lastSeenAt = Date.now();
    socket.serializeAttachment(attachment);

    if (typeof message === "string") {
      await this.handleTextMessage(socket, attachment, message);
      return;
    }
    await this.handleBinaryMessage(socket, attachment, new Uint8Array(message));
  }

  private async handleTextMessage(
    socket: WebSocket,
    attachment: ConnectionAttachment,
    value: string
  ): Promise<void> {
    const message = parseBoundedJson<Record<string, unknown>>(
      value,
      MAX_AWARENESS_BYTES
    );
    if (!message || typeof message.type !== "string") {
      this.closeSocket(socket, CLOSE_POLICY_VIOLATION, "invalid_message");
      return;
    }
    if (message.type === "heartbeat") {
      const heartbeat = message as unknown as HeartbeatMessage;
      if (typeof heartbeat.focused === "boolean") {
        attachment.focused = heartbeat.focused;
        socket.serializeAttachment(attachment);
      }
      this.sendText(socket, { type: "heartbeat-ack", now: Date.now() });
      return;
    }
    if (message.type === "focus") {
      const focus = message as unknown as FocusMessage;
      if (typeof focus.focused !== "boolean") {
        this.closeSocket(socket, CLOSE_POLICY_VIOLATION, "invalid_message");
        return;
      }
      attachment.focused = focus.focused;
      socket.serializeAttachment(attachment);
      this.broadcastPresenceSummary(attachment.anonymousId);
      return;
    }
    if (message.type === "awareness") {
      if (!this.consumeAwarenessRate(attachment)) {
        socket.serializeAttachment(attachment);
        this.closeSocket(socket, CLOSE_POLICY_VIOLATION, "rate_limited");
        return;
      }
      const awareness = normalizeAwareness(message);
      if (!awareness) {
        this.closeSocket(socket, CLOSE_POLICY_VIOLATION, "invalid_awareness");
        return;
      }
      if (typeof awareness.focused === "boolean") {
        attachment.focused = awareness.focused;
      }
      if (typeof awareness.drawing === "boolean") {
        attachment.drawing = awareness.drawing;
      }
      socket.serializeAttachment(attachment);
      this.broadcastText(
        {
          ...awareness,
          presenceId: attachment.presenceId,
          displayName: attachment.displayName,
          color: attachment.color
        },
        socket
      );
      return;
    }
    if (message.type === "sync-request") {
      await this.sendRateLimitedSync(socket, attachment);
      return;
    }
    this.closeSocket(socket, CLOSE_POLICY_VIOLATION, "unsupported_message");
  }

  private async handleBinaryMessage(
    socket: WebSocket,
    attachment: ConnectionAttachment,
    message: Uint8Array
  ): Promise<void> {
    if (message.byteLength < 1) {
      this.closeSocket(socket, CLOSE_POLICY_VIOLATION, "invalid_message");
      return;
    }
    const kind = message[0];
    const payload = message.slice(1);
    if (kind === WS_YJS_STATE_VECTOR) {
      await this.sendRateLimitedSync(socket, attachment, payload);
      return;
    }
    if (kind !== WS_YJS_UPDATE) {
      this.closeSocket(socket, CLOSE_POLICY_VIOLATION, "unsupported_message");
      return;
    }
    if (this.meta?.isLocked) {
      this.sendText(socket, { type: "readonly", locked: true });
      return;
    }
    if (!this.meta) return;
    const now = Date.now();
    const result = await this.documentStore.applyIncrementalUpdate(
      payload,
      {
        ...this.meta,
        lastActiveAt: now
      }
    );
    if (!result.accepted) {
      this.sendText(socket, {
        type: "update-rejected",
        reason: result.reason
      });
      return;
    }
    this.meta = result.meta;
    this.sendText(socket, {
      type: "update-accepted",
      documentVersion: this.meta.documentVersion,
      updateIntervalMs: this.recommendedClientUpdateIntervalMs()
    });
    this.broadcastBinary(WS_YJS_UPDATE, payload, socket);
    await this.scheduleAssetReferenceRecheck(now);
    await this.persistD1MetadataIfDue(this.meta, now);
  }

  private recommendedClientUpdateIntervalMs(): number {
    const documentBytes = this.documentStore.encodedStateByteLength();
    if (documentBytes > VERY_LARGE_DOCUMENT_UPDATE_THRESHOLD_BYTES) {
      return VERY_LARGE_DOCUMENT_CLIENT_UPDATE_INTERVAL_MS;
    }
    if (documentBytes > LARGE_DOCUMENT_UPDATE_THRESHOLD_BYTES) {
      return LARGE_DOCUMENT_CLIENT_UPDATE_INTERVAL_MS;
    }
    return DEFAULT_CLIENT_UPDATE_INTERVAL_MS;
  }

  private async sendRateLimitedSync(
    socket: WebSocket,
    attachment: ConnectionAttachment,
    stateVector?: Uint8Array
  ): Promise<void> {
    if (
      !attachment.ipHash ||
      !(await this.consumeSyncRequestRate(attachment.ipHash))
    ) {
      this.closeSocket(socket, CLOSE_POLICY_VIOLATION, "sync_rate_limited");
      return;
    }
    let response: Uint8Array;
    try {
      response = stateVector
        ? this.documentStore.encodeDifference(stateVector)
        : this.documentStore.encodeState();
    } catch {
      this.closeSocket(socket, CLOSE_POLICY_VIOLATION, "invalid_state_vector");
      return;
    }
    if (
      !(await this.consumeSyncResponseBudget(
        attachment.ipHash,
        response.byteLength
      ))
    ) {
      this.closeSocket(socket, CLOSE_POLICY_VIOLATION, "sync_budget_exceeded");
      return;
    }
    this.sendBinary(socket, WS_YJS_UPDATE, response);
  }

  private async handleSocketDeparture(socket: WebSocket): Promise<void> {
    const departed = readAttachment(socket);
    if (!departed || !this.meta) return;
    const remaining = this.ctx
      .getWebSockets()
      .filter((candidate) => candidate !== socket && socketIsOpen(candidate));
    const participants = uniqueParticipants(remaining);
    const sameIdentity = remaining
      .map(readAttachment)
      .filter(
        (attachment): attachment is ConnectionAttachment =>
          Boolean(attachment && attachment.anonymousId === departed.anonymousId)
      );
    if (participants.length === 0) {
      this.meta = markRoomEmpty(this.meta, Date.now());
    } else {
      this.meta = markRoomJoined(this.meta, Date.now(), participants.length);
    }
    await this.persistMeta();
    await this.scheduleAlarm();
    this.broadcastText({
      type: sameIdentity.length > 0 ? "participant-update" : "participant-leave",
      presenceId: departed.presenceId,
      participant:
        sameIdentity.length > 0
          ? this.publicParticipant(sameIdentity[0], sameIdentity.length)
          : undefined,
      onlineCount: participants.length
    });
  }

  private consumeMessageRate(
    attachment: ConnectionAttachment,
    byteLength: number,
    category: "update" | "text" | "binary"
  ): boolean {
    const now = Date.now();
    if (now - attachment.rateWindowStartedAt >= MESSAGE_RATE_WINDOW_MS) {
      attachment.rateWindowStartedAt = now;
      attachment.messagesInWindow = 0;
      attachment.updatesInWindow = 0;
      attachment.awarenessInWindow = 0;
      attachment.bytesInWindow = 0;
    }
    attachment.messagesInWindow += 1;
    attachment.bytesInWindow += byteLength;
    if (category === "update") attachment.updatesInWindow += 1;
    const documentBytes = this.documentStore.encodedStateByteLength();
    const updateLimit =
      documentBytes > VERY_LARGE_DOCUMENT_UPDATE_THRESHOLD_BYTES
        ? MAX_VERY_LARGE_DOCUMENT_UPDATES_PER_WINDOW
        : documentBytes > LARGE_DOCUMENT_UPDATE_THRESHOLD_BYTES
          ? MAX_LARGE_DOCUMENT_UPDATES_PER_WINDOW
          : MAX_UPDATES_PER_WINDOW;
    return (
      attachment.messagesInWindow <= MAX_MESSAGES_PER_WINDOW &&
      attachment.updatesInWindow <= updateLimit &&
      attachment.bytesInWindow <= MAX_BYTES_PER_WINDOW
    );
  }

  private consumeAwarenessRate(attachment: ConnectionAttachment): boolean {
    attachment.awarenessInWindow += 1;
    return attachment.awarenessInWindow <= MAX_AWARENESS_PER_WINDOW;
  }

  private assignUniqueName(anonymousId: string, requested: string): string {
    const sockets = this.ctx.getWebSockets();
    const existing = sockets
      .map(readAttachment)
      .find((attachment) => attachment?.anonymousId === anonymousId);
    if (existing) return existing.displayName;
    const used = new Set(
      sockets
        .map(readAttachment)
        .filter(
          (attachment): attachment is ConnectionAttachment => Boolean(attachment)
        )
        .map((attachment) => attachment.displayName.toLocaleLowerCase())
    );
    if (!used.has(requested.toLocaleLowerCase())) return requested;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const candidate = `${requested}·${compactNameSuffix()}`;
      if (!used.has(candidate.toLocaleLowerCase())) return candidate;
    }
    return `${requested}·${randomId(2).toUpperCase()}`;
  }

  private publicParticipant(
    attachment: ConnectionAttachment,
    connectionCount: number
  ): Participant {
    return {
      presenceId: attachment.presenceId,
      displayName: attachment.displayName,
      color: attachment.color,
      connectionCount,
      focused: attachment.focused,
      drawing: attachment.drawing
    };
  }

  private broadcastPresenceSummary(anonymousId: string): void {
    const matches = this.ctx
      .getWebSockets()
      .map(readAttachment)
      .filter(
        (attachment): attachment is ConnectionAttachment =>
          Boolean(attachment && attachment.anonymousId === anonymousId)
      );
    if (matches.length === 0) return;
    this.broadcastText({
      type: "participant-update",
      participant: this.publicParticipant(matches[0], matches.length),
      onlineCount: uniqueParticipants(this.ctx.getWebSockets()).length
    });
  }

  private sendText(socket: WebSocket, message: Record<string, unknown>): void {
    if (!socketIsOpen(socket)) return;
    try {
      socket.send(JSON.stringify(message));
    } catch {
      this.closeSocket(socket, CLOSE_TRY_AGAIN, "send_failed");
    }
  }

  private sendBinary(socket: WebSocket, kind: number, payload: Uint8Array): void {
    if (!socketIsOpen(socket)) return;
    try {
      socket.send(encodeBinaryMessage(kind, payload));
    } catch {
      this.closeSocket(socket, CLOSE_TRY_AGAIN, "send_failed");
    }
  }

  private broadcastText(
    message: Record<string, unknown>,
    exclude?: WebSocket
  ): void {
    const encoded = JSON.stringify(message);
    for (const socket of this.ctx.getWebSockets()) {
      if (socket === exclude || !socketIsOpen(socket)) continue;
      try {
        socket.send(encoded);
      } catch {
        this.closeSocket(socket, CLOSE_TRY_AGAIN, "send_failed");
      }
    }
  }

  private broadcastBinary(
    kind: number,
    payload: Uint8Array,
    exclude?: WebSocket
  ): void {
    const encoded = encodeBinaryMessage(kind, payload);
    for (const socket of this.ctx.getWebSockets()) {
      if (socket === exclude || !socketIsOpen(socket)) continue;
      try {
        socket.send(encoded.slice(0));
      } catch {
        this.closeSocket(socket, CLOSE_TRY_AGAIN, "send_failed");
      }
    }
  }

  private closeSocket(socket: WebSocket, code: number, reason: string): void {
    try {
      socket.close(code, reason);
    } catch {
      // The stale sweep still reconciles any runtime-side residue.
    }
  }

  private async handleIdentityRefresh(request: Request): Promise<Response> {
    if (!this.meta) {
      return safeJsonResponse({ ok: false, error: "room_unavailable" }, 404);
    }
    const anonymousId = request.headers.get(ANONYMOUS_ID_HEADER);
    const identityVersionValue = request.headers.get(IDENTITY_VERSION_HEADER) || "";
    if (
      !isValidAnonymousId(anonymousId) ||
      !IDENTITY_VERSION_PATTERN.test(identityVersionValue)
    ) {
      return safeJsonResponse({ ok: false, error: "identity_invalid" }, 400);
    }
    const identityVersion = Number(identityVersionValue);
    const decodedDisplayName = decodeDisplayNameHeader(
      request.headers.get(DISPLAY_NAME_B64_HEADER)
    );
    if (decodedDisplayName === null) {
      return safeJsonResponse({ ok: false, error: "identity_invalid" }, 400);
    }
    const requested = normalizeDisplayName(decodedDisplayName);
    const color = normalizeColor(request.headers.get(IDENTITY_COLOR_HEADER));
    const current = this.ctx
      .getWebSockets()
      .map(readAttachment)
      .filter(
        (attachment): attachment is ConnectionAttachment =>
          Boolean(attachment && attachment.anonymousId === anonymousId)
      );
    if (current.length === 0) {
      return safeJsonResponse({ ok: true, updated: 0 });
    }
    if (identityVersion <= Math.max(...current.map((item) => item.identityVersion))) {
      return safeJsonResponse({ ok: true, updated: 0 });
    }
    const name = this.assignUniqueNameExcludingIdentity(anonymousId, requested);
    let updated = 0;
    for (const socket of this.ctx.getWebSockets()) {
      const attachment = readAttachment(socket);
      if (!attachment || attachment.anonymousId !== anonymousId) continue;
      attachment.displayName = name;
      attachment.color = color;
      attachment.identityVersion = identityVersion;
      socket.serializeAttachment(attachment);
      updated += 1;
    }
    this.broadcastPresenceSummary(anonymousId);
    return safeJsonResponse({ ok: true, updated, displayName: name });
  }

  private assignUniqueNameExcludingIdentity(
    anonymousId: string,
    requested: string
  ): string {
    const used = new Set(
      this.ctx
        .getWebSockets()
        .map(readAttachment)
        .filter(
          (attachment): attachment is ConnectionAttachment =>
            Boolean(attachment && attachment.anonymousId !== anonymousId)
        )
        .map((attachment) => attachment.displayName.toLocaleLowerCase())
    );
    if (!used.has(requested.toLocaleLowerCase())) return requested;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const candidate = `${requested}·${compactNameSuffix()}`;
      if (!used.has(candidate.toLocaleLowerCase())) return candidate;
    }
    return `${requested}·${randomId(2).toUpperCase()}`;
  }

  private async agentAllowedAssets(roomId: string): Promise<Map<string, ImageMeta>> {
    const entries = await this.ctx.storage.list<ImageMeta>({
      prefix: IMAGE_META_PREFIX
    });
    const allowed = new Map<string, ImageMeta>();
    for (const image of entries.values()) {
      if (!isCanonicalImageMeta(image, roomId)) continue;
      allowed.set(image.assetId, image);
    }
    return allowed;
  }

  private async agentPendingAssetUsage(
    roomId: string,
    excludeReceiptKey = ""
  ): Promise<{ bytes: number; images: number }> {
    const receipts = await this.ctx.storage.list<AgentAssetReceipt>({
      prefix: AGENT_ASSET_RECEIPT_PREFIX
    });
    const now = Date.now();
    let bytes = 0;
    let images = 0;
    for (const [key, receipt] of receipts) {
      if (
        key === excludeReceiptKey
        || !isAgentAssetReceipt(receipt)
        || receipt.status !== "pending"
        || receipt.roomId !== roomId
        || receipt.expiresAt <= now
      ) {
        continue;
      }
      bytes += receipt.asset.byteLength;
      images += 1;
    }
    return { bytes, images };
  }

  private async handleAgentImageUpload(
    request: Request,
    roomId: string,
    roomType: RoomType
  ): Promise<Response> {
    if (request.headers.get(AGENT_ASSETS_AUTHORIZED_HEADER) !== "1") {
      return safeJsonResponse(
        { ok: false, error: "not_authorized", code: "WHITEBOARD_AGENT_ASSETS_NOT_AUTHORIZED" },
        403
      );
    }
    if (!this.env.WHITEBOARD_BUCKET) {
      return safeJsonResponse({ ok: false, error: "storage_unavailable" }, 503);
    }
    const subject = request.headers.get(AGENT_SUBJECT_HEADER) || "";
    const operationId = request.headers.get(AGENT_OPERATION_ID_HEADER) || "";
    const ipHash = normalizeIpHash(request.headers.get(IP_HASH_HEADER));
    const declaredContentType = String(request.headers.get("content-type") || "")
      .split(";", 1)[0]
      .trim()
      .toLowerCase();
    if (!AGENT_SUBJECT_PATTERN.test(subject) || !ipHash) {
      return safeJsonResponse(
        { ok: false, error: "agent_identity_invalid", code: "WHITEBOARD_AGENT_IDENTITY_INVALID" },
        401
      );
    }
    if (!AGENT_OPERATION_ID_PATTERN.test(operationId)) {
      return safeJsonResponse(
        { ok: false, error: "operation_id_invalid", code: "WHITEBOARD_AGENT_OPERATION_ID_INVALID" },
        422
      );
    }
    if (!["image/png", "image/jpeg", "image/webp"].includes(declaredContentType)) {
      return safeJsonResponse(
        { ok: false, error: "content_type_invalid", code: "WHITEBOARD_AGENT_CONTENT_TYPE_INVALID" },
        415
      );
    }
    if (await this.isBanned("", ipHash)) {
      return safeJsonResponse({ ok: false, error: "access_denied" }, 403);
    }

    const bytes = await readBodyWithLimit(request, MAX_IMAGE_BYTES);
    if (!bytes || bytes.byteLength === 0) {
      return safeJsonResponse({ ok: false, error: "invalid_image" }, 415);
    }
    const image = parseSafeRasterImage(bytes);
    if (!image || image.contentType !== declaredContentType) {
      return safeJsonResponse({ ok: false, error: "invalid_image" }, 415);
    }
    const now = Date.now();
    const payloadSha256 = await sha256Hex(bytes);
    const receiptKey = `${AGENT_ASSET_RECEIPT_PREFIX}${await sha256Hex(
      new TextEncoder().encode(
        `lusu:whiteboard:agent-asset-receipt:v1\u0000${subject}\u0000${operationId}`
      )
    )}`;
    const exactReceipt = await this.ctx.storage.get<unknown>(receiptKey);
    if (exactReceipt !== undefined && !isAgentAssetReceipt(exactReceipt)) {
      return safeJsonResponse(
        { ok: false, error: "operation_conflict", code: "WHITEBOARD_OPERATION_CONFLICT" },
        409
      );
    }
    const existing = exactReceipt as AgentAssetReceipt | undefined;
    if (existing && existing.expiresAt > now) {
      if (
        !isAgentAssetReceipt(existing)
        || existing.roomId !== roomId
        || existing.payloadSha256 !== payloadSha256
      ) {
        return safeJsonResponse(
          { ok: false, error: "operation_conflict", code: "WHITEBOARD_OPERATION_CONFLICT" },
          409
        );
      }
      if (existing.status === "committed") {
        const storedImage = await this.ctx.storage.get<ImageMeta>(
          `${IMAGE_META_PREFIX}${existing.asset.assetId}`
        );
        if (
          !isCanonicalImageMeta(storedImage, roomId)
          || storedImage.createdBy !== subject
          || !assetReceiptMatchesImage(existing, storedImage)
        ) {
          return safeJsonResponse(
            { ok: false, error: "operation_conflict", code: "WHITEBOARD_OPERATION_CONFLICT" },
            409
          );
        }
        return safeJsonResponse({
          ok: true,
          replayed: true,
          asset: existing.asset
        });
      }
      if (!(await this.consumeUploadRate(`agent:${subject}`, ipHash))) {
        return safeJsonResponse({ ok: false, error: "rate_limited" }, 429);
      }
      return this.completeAgentImageUpload(
        existing,
        receiptKey,
        bytes,
        subject,
        ipHash,
        roomId,
        roomType,
        now
      );
    }
    await this.pruneAgentAssetReceipts(now, MAX_AGENT_ASSET_RECEIPTS - 1);
    if (await this.ctx.storage.get(receiptKey) !== undefined) {
      await this.scheduleAlarm();
      return safeJsonResponse(
        {
          ok: false,
          error: "asset_cleanup_pending",
          code: "WHITEBOARD_ASSET_CLEANUP_PENDING"
        },
        503
      );
    }

    if (this.meta?.isLocked) {
      return safeJsonResponse(
        { ok: false, error: "room_locked", code: "WHITEBOARD_ROOM_LOCKED" },
        423
      );
    }
    if (!(await this.consumeUploadRate(`agent:${subject}`, ipHash))) {
      return safeJsonResponse({ ok: false, error: "rate_limited" }, 429);
    }

    const currentSockets = this.ctx.getWebSockets().filter(socketIsOpen);
    const onlineCount = uniqueParticipants(currentSockets).length;
    const baseMeta = this.meta || createRoomMeta(roomId, roomType, now);
    const activeMeta = onlineCount > 0
      ? markRoomJoined(baseMeta, now, onlineCount)
      : markRoomEmpty(baseMeta, now);
    const pendingUsage = await this.agentPendingAssetUsage(roomId);
    if (
      activeMeta.resourceUsage.images + pendingUsage.images >= MAX_IMAGES_PER_ROOM
      || activeMeta.resourceUsage.bytes + pendingUsage.bytes + bytes.byteLength
        > MAX_IMAGE_BYTES_PER_ROOM
    ) {
      return safeJsonResponse({ ok: false, error: "room_asset_limit" }, 413);
    }

    const assetId = randomId(16);
    const publicAsset = {
      assetId,
      contentType: image.contentType,
      byteLength: bytes.byteLength,
      width: image.width,
      height: image.height,
      version: 1 as const
    };
    const pendingReceipt: AgentAssetReceipt = {
      version: 2,
      kind: "asset",
      status: "pending",
      roomId,
      payloadSha256,
      asset: publicAsset,
      createdAt: now,
      expiresAt: now + UNREFERENCED_ASSET_GRACE_MS
    };
    await this.ctx.storage.put(receiptKey, pendingReceipt);
    await this.scheduleAlarm();
    return this.completeAgentImageUpload(
      pendingReceipt,
      receiptKey,
      bytes,
      subject,
      ipHash,
      roomId,
      roomType,
      now
    );
  }

  private async completeAgentImageUpload(
    pendingReceipt: AgentAssetReceipt,
    receiptKey: string,
    bytes: Uint8Array,
    subject: string,
    ipHash: string,
    roomId: string,
    roomType: RoomType,
    now: number
  ): Promise<Response> {
    if (this.meta?.isLocked) {
      return safeJsonResponse(
        { ok: false, error: "room_locked", code: "WHITEBOARD_ROOM_LOCKED" },
        423
      );
    }
    const currentSockets = this.ctx.getWebSockets().filter(socketIsOpen);
    const onlineCount = uniqueParticipants(currentSockets).length;
    const baseMeta = this.meta || createRoomMeta(roomId, roomType, now);
    const activeMeta = onlineCount > 0
      ? markRoomJoined(baseMeta, now, onlineCount)
      : markRoomEmpty(baseMeta, now);
    const pendingUsage = await this.agentPendingAssetUsage(roomId, receiptKey);
    if (
      activeMeta.resourceUsage.images + pendingUsage.images >= MAX_IMAGES_PER_ROOM
      || activeMeta.resourceUsage.bytes + pendingUsage.bytes + bytes.byteLength
        > MAX_IMAGE_BYTES_PER_ROOM
    ) {
      return safeJsonResponse({ ok: false, error: "room_asset_limit" }, 413);
    }
    const imageKey = `whiteboard/v1/${roomId}/${pendingReceipt.asset.assetId}`;
    try {
      await this.env.WHITEBOARD_BUCKET!.put(imageKey, bytes, {
        httpMetadata: { contentType: pendingReceipt.asset.contentType },
        customMetadata: {
          room: roomId,
          width: String(pendingReceipt.asset.width),
          height: String(pendingReceipt.asset.height)
        }
      });
    } catch (error) {
      await this.recordOperationalError("asset_upload_failed");
      throw error;
    }

    const commitNow = Date.now();
    if (await this.isBanned("", ipHash)) {
      return safeJsonResponse({ ok: false, error: "access_denied" }, 403);
    }
    const commitSockets = this.ctx.getWebSockets().filter(socketIsOpen);
    const commitOnlineCount = uniqueParticipants(commitSockets).length;
    const commitBaseMeta = this.meta || createRoomMeta(roomId, roomType, commitNow);
    const commitActiveMeta = commitOnlineCount > 0
      ? markRoomJoined(commitBaseMeta, commitNow, commitOnlineCount)
      : markRoomEmpty(commitBaseMeta, commitNow);
    const commitPendingUsage = await this.agentPendingAssetUsage(roomId, receiptKey);
    if (
      commitActiveMeta.isLocked
      || commitActiveMeta.resourceUsage.images + commitPendingUsage.images
        >= MAX_IMAGES_PER_ROOM
      || commitActiveMeta.resourceUsage.bytes + commitPendingUsage.bytes + bytes.byteLength
        > MAX_IMAGE_BYTES_PER_ROOM
    ) {
      return safeJsonResponse(
        commitActiveMeta.isLocked
          ? { ok: false, error: "room_locked", code: "WHITEBOARD_ROOM_LOCKED" }
          : { ok: false, error: "room_asset_limit" },
        commitActiveMeta.isLocked ? 423 : 413
      );
    }
    const imageMeta: ImageMeta = {
      assetId: pendingReceipt.asset.assetId,
      roomId,
      key: imageKey,
      contentType: pendingReceipt.asset.contentType,
      byteLength: pendingReceipt.asset.byteLength,
      width: pendingReceipt.asset.width,
      height: pendingReceipt.asset.height,
      createdAt: commitNow,
      createdBy: subject
    };
    const nextMeta: RoomMeta = {
      ...commitActiveMeta,
      lastActiveAt: commitNow,
      resourceUsage: {
        bytes: commitActiveMeta.resourceUsage.bytes + bytes.byteLength,
        images: commitActiveMeta.resourceUsage.images + 1
      }
    };
    const committedReceipt: AgentAssetReceipt = {
      ...pendingReceipt,
      status: "committed",
      expiresAt: commitNow + AGENT_RECEIPT_TTL_MS
    };
    const currentSweep = await this.ctx.storage.get<number>(ASSET_SWEEP_NEXT_KEY);
    const nextSweep = commitNow + UNREFERENCED_ASSET_GRACE_MS;
    await this.ctx.storage.transaction(async (transaction) => {
      await transaction.put(ROOM_META_KEY, nextMeta);
      await transaction.put(
        `${IMAGE_META_PREFIX}${imageMeta.assetId}`,
        imageMeta
      );
      await transaction.put(receiptKey, committedReceipt);
      if (typeof currentSweep !== "number" || nextSweep < currentSweep) {
        await transaction.put(ASSET_SWEEP_NEXT_KEY, nextSweep);
      }
    });
    this.meta = nextMeta;
    await this.persistD1Asset(imageMeta, pendingReceipt.payloadSha256);
    await this.persistD1MetadataIfDue(nextMeta, commitNow, true);
    await this.scheduleAlarm();
    return safeJsonResponse({
      ok: true,
      replayed: false,
      asset: pendingReceipt.asset
    }, 201);
  }

  private async handleAgentImageGet(
    request: Request,
    assetId: string
  ): Promise<Response> {
    if (request.headers.get(AGENT_ASSETS_AUTHORIZED_HEADER) !== "1") {
      return safeJsonResponse(
        { ok: false, error: "not_authorized", code: "WHITEBOARD_AGENT_ASSETS_NOT_AUTHORIZED" },
        403
      );
    }
    const subject = request.headers.get(AGENT_SUBJECT_HEADER) || "";
    const ipHash = normalizeIpHash(request.headers.get(IP_HASH_HEADER));
    if (!AGENT_SUBJECT_PATTERN.test(subject) || !ipHash) {
      return safeJsonResponse(
        { ok: false, error: "agent_identity_invalid", code: "WHITEBOARD_AGENT_IDENTITY_INVALID" },
        401
      );
    }
    if (await this.isBanned("", ipHash)) {
      return safeJsonResponse({ ok: false, error: "access_denied" }, 403);
    }
    if (!this.meta || !ASSET_ID_PATTERN.test(assetId)) {
      return safeJsonResponse({ ok: false, error: "asset_not_found" }, 404);
    }
    const allowed = await this.agentAllowedAssets(this.meta.roomId);
    const imageMeta = allowed.get(assetId);
    if (!imageMeta) {
      return safeJsonResponse({ ok: false, error: "asset_not_found" }, 404);
    }
    return this.imageResponse(assetId, imageMeta);
  }

  private async handleImageUpload(request: Request): Promise<Response> {
    if (!this.meta) {
      return safeJsonResponse({ ok: false, error: "room_unavailable" }, 404);
    }
    if (this.meta.isLocked) {
      return safeJsonResponse({ ok: false, error: "readonly" }, 423);
    }
    if (!this.env.WHITEBOARD_BUCKET) {
      return safeJsonResponse({ ok: false, error: "storage_unavailable" }, 503);
    }
    const anonymousId = request.headers.get(ANONYMOUS_ID_HEADER);
    const ipHash = normalizeIpHash(request.headers.get(IP_HASH_HEADER));
    if (!isValidAnonymousId(anonymousId) || !ipHash) {
      return safeJsonResponse({ ok: false, error: "identity_invalid" }, 401);
    }
    if (
      await this.isBanned(
        anonymousId,
        ipHash
      )
    ) {
      return safeJsonResponse({ ok: false, error: "access_denied" }, 403);
    }
    if (!(await this.consumeUploadRate(anonymousId, ipHash))) {
      return safeJsonResponse({ ok: false, error: "rate_limited" }, 429);
    }
    if (
      this.meta.resourceUsage.images >= MAX_IMAGES_PER_ROOM ||
      this.meta.resourceUsage.bytes >= MAX_IMAGE_BYTES_PER_ROOM
    ) {
      return safeJsonResponse({ ok: false, error: "room_asset_limit" }, 413);
    }
    const bytes = await readBodyWithLimit(request, MAX_IMAGE_BYTES);
    if (!bytes || bytes.byteLength === 0) {
      return safeJsonResponse({ ok: false, error: "invalid_image" }, 415);
    }
    const image = parseSafeRasterImage(bytes);
    if (!image) {
      return safeJsonResponse({ ok: false, error: "invalid_image" }, 415);
    }
    if (
      this.meta.resourceUsage.bytes + bytes.byteLength >
      MAX_IMAGE_BYTES_PER_ROOM
    ) {
      return safeJsonResponse({ ok: false, error: "room_asset_limit" }, 413);
    }
    const assetId = randomId(16);
    const key = `whiteboard/v1/${this.meta.roomId}/${assetId}`;
    const checksum = await sha256Hex(bytes);
    const imageMeta: ImageMeta = {
      assetId,
      roomId: this.meta.roomId,
      key,
      contentType: image.contentType,
      byteLength: bytes.byteLength,
      width: image.width,
      height: image.height,
      createdAt: Date.now(),
      createdBy: anonymousId
    };
    await this.ctx.storage.put(`${IMAGE_META_PREFIX}${assetId}`, imageMeta);
    await this.scheduleInitialAssetSweep(imageMeta.createdAt);
    try {
      await this.env.WHITEBOARD_BUCKET.put(key, bytes, {
        httpMetadata: { contentType: image.contentType },
        customMetadata: {
          room: this.meta.roomId,
          width: String(image.width),
          height: String(image.height)
        }
      });
    } catch (error) {
      await this.ctx.storage.delete(`${IMAGE_META_PREFIX}${assetId}`);
      await this.recordOperationalError("asset_upload_failed");
      throw error;
    }
    await this.persistD1Asset(imageMeta, checksum);
    this.meta = {
      ...this.meta,
      lastActiveAt: Date.now(),
      resourceUsage: {
        bytes: this.meta.resourceUsage.bytes + bytes.byteLength,
        images: this.meta.resourceUsage.images + 1
      }
    };
    await this.persistMeta();
    await this.scheduleAlarm();
    return safeJsonResponse(
      {
        ok: true,
        asset: {
          assetId,
          contentType: image.contentType,
          byteLength: bytes.byteLength,
          width: image.width,
          height: image.height
        }
      },
      201
    );
  }

  private async handleImageGet(
    request: Request,
    assetId: string
  ): Promise<Response> {
    if (!this.meta || !ASSET_ID_PATTERN.test(assetId) || !this.env.WHITEBOARD_BUCKET) {
      return safeJsonResponse({ ok: false, error: "asset_not_found" }, 404);
    }
    const anonymousId = request.headers.get(ANONYMOUS_ID_HEADER);
    if (!isValidAnonymousId(anonymousId)) {
      return safeJsonResponse({ ok: false, error: "identity_invalid" }, 401);
    }
    if (
      await this.isBanned(
        anonymousId,
        normalizeIpHash(request.headers.get(IP_HASH_HEADER))
      )
    ) {
      return safeJsonResponse({ ok: false, error: "access_denied" }, 403);
    }
    const imageMeta = await this.ctx.storage.get<ImageMeta>(
      `${IMAGE_META_PREFIX}${assetId}`
    );
    if (!imageMeta || imageMeta.roomId !== this.meta.roomId) {
      return safeJsonResponse({ ok: false, error: "asset_not_found" }, 404);
    }
    return this.imageResponse(assetId, imageMeta);
  }

  private async imageResponse(
    assetId: string,
    imageMeta: ImageMeta
  ): Promise<Response> {
    if (
      !this.meta
      || !this.env.WHITEBOARD_BUCKET
      || !ASSET_ID_PATTERN.test(assetId)
      || !isCanonicalImageMeta(imageMeta, this.meta.roomId)
      || imageMeta.assetId !== assetId
    ) {
      return safeJsonResponse({ ok: false, error: "asset_not_found" }, 404);
    }
    const object = await this.env.WHITEBOARD_BUCKET.get(imageMeta.key);
    if (!object) {
      return safeJsonResponse({ ok: false, error: "asset_not_found" }, 404);
    }
    const storedContentType = String(object.httpMetadata?.contentType || "")
      .split(";", 1)[0]
      .trim()
      .toLowerCase();
    if (
      object.size !== imageMeta.byteLength
      || (storedContentType && storedContentType !== imageMeta.contentType)
    ) {
      return safeJsonResponse({ ok: false, error: "asset_not_found" }, 404);
    }
    return new Response(object.body, {
      headers: {
        "cache-control": "private, no-store",
        "content-disposition": "inline",
        "content-length": String(imageMeta.byteLength),
        "content-type": imageMeta.contentType,
        etag: object.httpEtag,
        "x-content-type-options": "nosniff"
      }
    });
  }

  private async consumeUploadRate(
    anonymousId: string,
    ipHash: string
  ): Promise<boolean> {
    const identityAllowed = await this.consumeCountRate(
      `${UPLOAD_RATE_PREFIX}identity:${anonymousId}`,
      UPLOAD_RATE_WINDOW_MS,
      MAX_UPLOADS_PER_WINDOW
    );
    const ipAllowed = await this.consumeCountRate(
      `${UPLOAD_RATE_PREFIX}ip:${ipHash}`,
      UPLOAD_RATE_WINDOW_MS,
      MAX_UPLOADS_PER_IP_WINDOW
    );
    return identityAllowed && ipAllowed;
  }

  private async consumeCountRate(
    key: string,
    windowMs: number,
    limit: number
  ): Promise<boolean> {
    const now = Date.now();
    const current = await this.ctx.storage.get<UploadRateState>(key);
    const next =
      !current || now - current.windowStartedAt >= windowMs
        ? {
            windowStartedAt: now,
            count: 1,
            bytes: 0,
            expiresAt: now + RATE_STATE_RETENTION_MS
          }
        : {
            ...current,
            count: current.count + 1,
            expiresAt: now + RATE_STATE_RETENTION_MS
          };
    await this.ctx.storage.put(key, next);
    await this.scheduleRateSweep(next.expiresAt);
    return next.count <= limit;
  }

  private async consumeSyncRequestRate(ipHash: string): Promise<boolean> {
    return this.consumeCountRate(
      `${SYNC_RATE_PREFIX}${ipHash}`,
      SYNC_RATE_WINDOW_MS,
      MAX_SYNC_REQUESTS_PER_WINDOW
    );
  }

  private async consumeSyncResponseBudget(
    ipHash: string,
    responseBytes: number
  ): Promise<boolean> {
    const key = `${SYNC_RATE_PREFIX}${ipHash}`;
    const now = Date.now();
    const current = await this.ctx.storage.get<UploadRateState>(key);
    if (!current || now - current.windowStartedAt >= SYNC_RATE_WINDOW_MS) {
      return false;
    }
    const next = {
      ...current,
      bytes: Math.max(0, Number(current.bytes || 0)) + responseBytes,
      expiresAt: now + RATE_STATE_RETENTION_MS
    };
    await this.ctx.storage.put(key, next);
    await this.scheduleRateSweep(next.expiresAt);
    return next.bytes <= MAX_SYNC_RESPONSE_BYTES_PER_WINDOW;
  }

  private async scheduleRateSweep(candidate: number): Promise<void> {
    const current = await this.ctx.storage.get<number>(RATE_SWEEP_NEXT_KEY);
    if (typeof current !== "number" || candidate < current) {
      await this.ctx.storage.put(RATE_SWEEP_NEXT_KEY, candidate);
    }
    await this.scheduleAlarm();
  }

  private async pruneRateStates(now: number): Promise<void> {
    const scheduledAt = await this.ctx.storage.get<number>(RATE_SWEEP_NEXT_KEY);
    if (typeof scheduledAt !== "number" || scheduledAt > now) return;
    const entries = [
      ...(await this.ctx.storage.list<UploadRateState>({
        prefix: UPLOAD_RATE_PREFIX
      })).entries(),
      ...(await this.ctx.storage.list<UploadRateState>({
        prefix: SYNC_RATE_PREFIX
      })).entries()
    ];
    const expired: string[] = [];
    let nextSweep: number | null = null;
    for (const [key, state] of entries) {
      const expiresAt = Number(
        state?.expiresAt ||
          (state?.windowStartedAt || 0) + RATE_STATE_RETENTION_MS
      );
      if (!Number.isFinite(expiresAt) || expiresAt <= now) {
        expired.push(key);
      } else {
        nextSweep = nextSweep === null
          ? expiresAt
          : Math.min(nextSweep, expiresAt);
      }
    }
    if (expired.length > 0) {
      await this.ctx.storage.delete(expired);
    }
    if (nextSweep === null) {
      await this.ctx.storage.delete(RATE_SWEEP_NEXT_KEY);
    } else {
      await this.ctx.storage.put(RATE_SWEEP_NEXT_KEY, nextSweep);
    }
  }

  private async scheduleInitialAssetSweep(createdAt: number): Promise<void> {
    const candidate = createdAt + UNREFERENCED_ASSET_GRACE_MS;
    const current = await this.ctx.storage.get<number>(ASSET_SWEEP_NEXT_KEY);
    if (typeof current !== "number" || candidate < current) {
      await this.ctx.storage.put(ASSET_SWEEP_NEXT_KEY, candidate);
    }
  }

  private async scheduleAssetReferenceRecheck(now: number): Promise<void> {
    if (!this.meta || this.meta.resourceUsage.images === 0) return;
    const candidate = now + ASSET_REFERENCE_RECHECK_MS;
    const current = await this.ctx.storage.get<number>(ASSET_SWEEP_NEXT_KEY);
    if (typeof current !== "number" || candidate < current) {
      await this.ctx.storage.put(ASSET_SWEEP_NEXT_KEY, candidate);
    }
  }

  private async maybeSweepUnreferencedAssets(now: number): Promise<void> {
    if (!this.meta || this.meta.resourceUsage.images === 0) {
      await this.ctx.storage.delete(ASSET_SWEEP_NEXT_KEY);
      return;
    }
    const scheduledAt = await this.ctx.storage.get<number>(ASSET_SWEEP_NEXT_KEY);
    if (typeof scheduledAt === "number" && scheduledAt > now) return;

    const references = this.documentStore.referencedAssetIds();
    const entries = await this.ctx.storage.list<ImageMeta>({
      prefix: IMAGE_META_PREFIX
    });
    let nextSweepAt: number | null = null;
    let removedBytes = 0;
    let removedImages = 0;
    let sweepFailed = false;
    for (const [storageKey, asset] of entries) {
      if (
        !asset ||
        asset.roomId !== this.meta.roomId ||
        !ASSET_ID_PATTERN.test(asset.assetId)
      ) {
        await this.ctx.storage.delete(storageKey);
        continue;
      }
      if (references.has(asset.assetId)) continue;
      const eligibleAt = asset.createdAt + UNREFERENCED_ASSET_GRACE_MS;
      if (eligibleAt > now) {
        nextSweepAt =
          nextSweepAt === null ? eligibleAt : Math.min(nextSweepAt, eligibleAt);
        continue;
      }
      if (!this.env.WHITEBOARD_BUCKET) {
        nextSweepAt = now + ASSET_REFERENCE_RECHECK_MS;
        continue;
      }
      try {
        await this.env.WHITEBOARD_BUCKET.delete(asset.key);
        await this.deleteD1Asset(asset.assetId);
        await this.ctx.storage.delete(storageKey);
        removedBytes += asset.byteLength;
        removedImages += 1;
      } catch {
        sweepFailed = true;
        nextSweepAt = now + ASSET_REFERENCE_RECHECK_MS;
      }
    }
    if (removedImages > 0) {
      this.meta = {
        ...this.meta,
        resourceUsage: {
          bytes: Math.max(0, this.meta.resourceUsage.bytes - removedBytes),
          images: Math.max(0, this.meta.resourceUsage.images - removedImages)
        }
      };
      await this.persistMeta();
    }
    if (nextSweepAt === null) {
      await this.ctx.storage.delete(ASSET_SWEEP_NEXT_KEY);
    } else {
      await this.ctx.storage.put(ASSET_SWEEP_NEXT_KEY, nextSweepAt);
    }
    if (sweepFailed) {
      await this.recordOperationalError("asset_cleanup_failed");
    }
  }

  private async consumeTicketJti(
    ticketJti: string,
    now: number
  ): Promise<boolean> {
    const key = `${TICKET_JTI_PREFIX}${ticketJti}`;
    const existing = await this.ctx.storage.get<number>(key);
    if (typeof existing === "number" && existing > now) {
      return false;
    }
    await this.ctx.storage.put(key, now + CONSUMED_TICKET_TTL_MS);
    await this.pruneConsumedTicketJtis(now);
    return true;
  }

  private async pruneConsumedTicketJtis(now: number): Promise<number | null> {
    const entries = await this.ctx.storage.list<number>({
      prefix: TICKET_JTI_PREFIX
    });
    const expired: string[] = [];
    let earliestExpiry: number | null = null;
    for (const [key, expiresAt] of entries) {
      if (typeof expiresAt !== "number" || expiresAt <= now) {
        expired.push(key);
      } else if (earliestExpiry === null || expiresAt < earliestExpiry) {
        earliestExpiry = expiresAt;
      }
    }
    if (expired.length > 0) {
      await this.ctx.storage.delete(expired);
    }
    return earliestExpiry;
  }

  private async pruneAgentReceipts(now: number): Promise<number | null> {
    const receipts = await this.ctx.storage.list<AgentUpdateReceipt>({
      prefix: AGENT_RECEIPT_PREFIX
    });
    const retained = [...receipts.entries()]
      .filter(([, value]) =>
        value?.version === 1 &&
        /^[a-f0-9]{64}$/.test(String(value.payloadSha256 || "")) &&
        Number.isSafeInteger(value.documentVersion) &&
        value.documentVersion >= 1 &&
        Number.isSafeInteger(value.createdAt) &&
        Number.isSafeInteger(value.expiresAt) &&
        value.expiresAt > now
      )
      .sort((left, right) =>
        right[1].createdAt - left[1].createdAt || left[0].localeCompare(right[0])
      );
    const retainedKeys = new Set(
      retained.slice(0, MAX_AGENT_RECEIPTS).map(([key]) => key)
    );
    const deleteKeys = [...receipts.keys()].filter((key) => !retainedKeys.has(key));
    if (deleteKeys.length > 0) {
      await this.ctx.storage.delete(deleteKeys);
    }
    const expiries = retained
      .slice(0, MAX_AGENT_RECEIPTS)
      .map(([, value]) => value.expiresAt);
    return expiries.length > 0 ? Math.min(...expiries) : null;
  }

  private async pruneAgentAssetReceipts(
    now: number,
    maximum = MAX_AGENT_ASSET_RECEIPTS
  ): Promise<number | null> {
    const receipts = await this.ctx.storage.list<AgentAssetReceipt>({
      prefix: AGENT_ASSET_RECEIPT_PREFIX
    });
    const valid = [...receipts.entries()]
      .filter(([, value]) => isAgentAssetReceipt(value))
      .sort((left, right) =>
        right[1].createdAt - left[1].createdAt || left[0].localeCompare(right[0])
      );
    const retainedKeys = new Set(
      valid
        .filter(([, value]) => value.expiresAt > now)
        .slice(0, Math.max(0, maximum))
        .map(([key]) => key)
    );
    const deleteKeys: string[] = [];
    const retryExpiries: number[] = [];
    for (const [key, value] of receipts) {
      if (retainedKeys.has(key)) continue;
      if (isAgentAssetReceipt(value) && value.status === "pending") {
        try {
          if (!this.env.WHITEBOARD_BUCKET) {
            throw new Error("asset_storage_unavailable");
          }
          await this.env.WHITEBOARD_BUCKET.delete(
            `whiteboard/v1/${value.roomId}/${value.asset.assetId}`
          );
        } catch {
          const retryAt = now + ASSET_REFERENCE_RECHECK_MS;
          await this.ctx.storage.put(key, {
            ...value,
            expiresAt: retryAt
          } satisfies AgentAssetReceipt);
          retainedKeys.add(key);
          retryExpiries.push(retryAt);
          continue;
        }
        try {
          await this.deleteD1Asset(value.asset.assetId);
        } catch {
          // D1 is only a best-effort fleet index; R2 cleanup remains authoritative.
        }
      }
      deleteKeys.push(key);
    }
    if (deleteKeys.length > 0) {
      await this.ctx.storage.delete(deleteKeys);
    }
    const retainedExpiries = valid
      .filter(([key, value]) => retainedKeys.has(key) && value.expiresAt > now)
      .map(([, value]) => value.expiresAt);
    const expiries = [...retainedExpiries, ...retryExpiries];
    return expiries.length > 0 ? Math.min(...expiries) : null;
  }

  private async handleStatus(request: Request): Promise<Response> {
    if (request.headers.get(ADMIN_AUTHORIZED_HEADER) !== "1") {
      return safeJsonResponse({ ok: false, error: "not_authorized" }, 403);
    }
    if (!this.meta) {
      return safeJsonResponse({ ok: false, error: "room_unavailable" }, 404);
    }
    const bans = await this.getActiveBans();
    return safeJsonResponse({
      ok: true,
      room: this.adminStatus(bans.length)
    });
  }

  private async handleAdmin(request: Request): Promise<Response> {
    if (request.headers.get(ADMIN_AUTHORIZED_HEADER) !== "1") {
      return safeJsonResponse({ ok: false, error: "not_authorized" }, 403);
    }
    if (!this.meta) {
      return safeJsonResponse({ ok: false, error: "room_unavailable" }, 404);
    }
    const rawBody = await request.text();
    const action = parseBoundedJson<AdminAction>(rawBody, 8 * 1_024);
    if (!action || typeof action.action !== "string") {
      return safeJsonResponse({ ok: false, error: "invalid_action" }, 400);
    }
    if (action.action === "status") {
      const bans = await this.getActiveBans();
      return safeJsonResponse({ ok: true, room: this.adminStatus(bans.length) });
    }
    if (action.action === "clear") {
      try {
        await this.deleteRoomAssets(this.meta.roomId);
        await this.deleteD1Assets(this.meta.roomId);
      } catch {
        await this.recordOperationalError("asset_cleanup_failed");
        return safeJsonResponse(
          { ok: false, error: "asset_cleanup_failed" },
          503
        );
      }
      const assetMetadata = await this.ctx.storage.list({
        prefix: IMAGE_META_PREFIX
      });
      if (assetMetadata.size > 0) {
        await this.ctx.storage.delete([...assetMetadata.keys()]);
      }
      const agentAssetReceipts = await this.ctx.storage.list({
        prefix: AGENT_ASSET_RECEIPT_PREFIX
      });
      if (agentAssetReceipts.size > 0) {
        await this.ctx.storage.delete([...agentAssetReceipts.keys()]);
      }
      await this.ctx.storage.delete(ASSET_SWEEP_NEXT_KEY);
      this.meta = await this.documentStore.clear(this.meta);
      this.meta = {
        ...this.meta,
        lastActiveAt: Date.now(),
        resourceUsage: { bytes: 0, images: 0 }
      };
      await this.persistMeta();
      this.broadcastText({
        type: "document-cleared",
        documentVersion: this.meta.documentVersion
      });
      this.broadcastBinary(WS_YJS_UPDATE, this.documentStore.encodeState());
      return safeJsonResponse({ ok: true });
    }
    if (action.action === "set-lock" && typeof action.locked === "boolean") {
      this.meta = {
        ...this.meta,
        isLocked: action.locked,
        lastActiveAt: Date.now()
      };
      await this.persistMeta();
      this.broadcastText({ type: "lock-state", locked: action.locked });
      return safeJsonResponse({ ok: true, locked: action.locked });
    }
    if (action.action === "kick") {
      const connectionId =
        typeof action.connectionId === "string" ? action.connectionId : "";
      const anonymousId =
        typeof action.anonymousId === "string" ? action.anonymousId : "";
      if (!connectionId && !anonymousId) {
        return safeJsonResponse({ ok: false, error: "invalid_action" }, 400);
      }
      let kicked = 0;
      for (const socket of this.ctx.getWebSockets()) {
        const attachment = readAttachment(socket);
        if (
          attachment &&
          ((connectionId && attachment.connectionId === connectionId) ||
            (anonymousId && attachment.anonymousId === anonymousId))
        ) {
          kicked += 1;
          this.closeSocket(socket, CLOSE_POLICY_VIOLATION, "removed");
        }
      }
      return safeJsonResponse({ ok: true, kicked });
    }
    if (action.action === "ban") {
      if (
        !["anonymousId", "ipHash"].includes(action.kind) ||
        typeof action.key !== "string" ||
        typeof action.durationSeconds !== "number" ||
        !Number.isFinite(action.durationSeconds) ||
        action.durationSeconds < 60 ||
        action.durationSeconds > 7 * 24 * 60 * 60
      ) {
        return safeJsonResponse({ ok: false, error: "invalid_action" }, 400);
      }
      const normalizedKey =
        action.kind === "ipHash"
          ? normalizeIpHash(action.key)
          : isValidAnonymousId(action.key)
            ? action.key
            : null;
      if (!normalizedKey) {
        return safeJsonResponse({ ok: false, error: "invalid_action" }, 400);
      }
      const bans = await this.getActiveBans();
      bans.push({
        key: normalizedKey,
        kind: action.kind,
        createdAt: Date.now(),
        expiresAt: Date.now() + action.durationSeconds * 1_000
      });
      await this.ctx.storage.put(ROOM_BANS_KEY, bans);
      let kicked = 0;
      for (const socket of this.ctx.getWebSockets()) {
        const attachment = readAttachment(socket);
        if (
          attachment &&
          ((action.kind === "anonymousId" &&
            attachment.anonymousId === normalizedKey) ||
            (action.kind === "ipHash" && attachment.ipHash === normalizedKey))
        ) {
          kicked += 1;
          this.closeSocket(socket, CLOSE_POLICY_VIOLATION, "access_denied");
        }
      }
      return safeJsonResponse({ ok: true, kicked });
    }
    if (action.action === "unban") {
      if (
        !["anonymousId", "ipHash"].includes(action.kind) ||
        typeof action.key !== "string"
      ) {
        return safeJsonResponse({ ok: false, error: "invalid_action" }, 400);
      }
      const bans = (await this.getActiveBans()).filter(
        (entry) => !(entry.kind === action.kind && entry.key === action.key)
      );
      await this.ctx.storage.put(ROOM_BANS_KEY, bans);
      return safeJsonResponse({ ok: true });
    }
    if (action.action === "delete-room") {
      if (this.meta.roomType === "public") {
        return safeJsonResponse(
          { ok: false, error: "public_room_cannot_be_deleted" },
          409
        );
      }
      if (this.ctx.getWebSockets().some(socketIsOpen)) {
        return safeJsonResponse({ ok: false, error: "room_not_empty" }, 409);
      }
      const deleted = await this.cleanupPrivateRoom(Date.now(), true);
      return safeJsonResponse({ ok: deleted, deleted }, deleted ? 200 : 503);
    }
    return safeJsonResponse({ ok: false, error: "invalid_action" }, 400);
  }

  private adminStatus(activeBanCount: number): Record<string, unknown> {
    if (!this.meta) return {};
    return {
      roomId: this.meta.roomId,
      roomType: this.meta.roomType,
      createdAt: this.meta.createdAt,
      lastActiveAt: this.meta.lastActiveAt,
      emptySince: this.meta.emptySince,
      deleteAt: this.meta.deleteAt,
      onlineCount: uniqueParticipants(this.ctx.getWebSockets()).length,
      connectionCount: this.ctx.getWebSockets().filter(socketIsOpen).length,
      documentVersion: this.meta.documentVersion,
      snapshotVersion: this.meta.snapshotVersion,
      isLocked: this.meta.isLocked,
      resourceUsage: this.meta.resourceUsage,
      activeBanCount,
      hasError: Boolean(this.meta.lastError),
      lastError: String(this.meta.lastError || "").slice(0, 80),
      connections: this.adminConnectionDetails()
    };
  }

  private adminConnectionDetails(): Record<string, unknown>[] {
    const connections: Record<string, unknown>[] = [];
    for (const socket of this.ctx.getWebSockets()) {
      if (!socketIsOpen(socket)) continue;
      const attachment = readAttachment(socket);
      if (!attachment) continue;
      connections.push({
        connectionId: attachment.connectionId,
        anonymousId: attachment.anonymousId,
        ipHash: attachment.ipHash,
        displayName: attachment.displayName,
        color: attachment.color,
        connectedAt: attachment.connectedAt,
        lastSeenAt: attachment.lastSeenAt,
        focused: attachment.focused,
        drawing: attachment.drawing
      });
    }
    return connections;
  }

  private async getActiveBans(): Promise<BanEntry[]> {
    const now = Date.now();
    const existing = (await this.ctx.storage.get<BanEntry[]>(ROOM_BANS_KEY)) || [];
    const active = existing.filter(
      (entry) =>
        entry &&
        (entry.kind === "anonymousId" || entry.kind === "ipHash") &&
        typeof entry.key === "string" &&
        typeof entry.expiresAt === "number" &&
        entry.expiresAt > now
    );
    if (active.length !== existing.length) {
      await this.ctx.storage.put(ROOM_BANS_KEY, active);
    }
    return active;
  }

  private async isBanned(
    anonymousId: string,
    ipHash: string | null
  ): Promise<boolean> {
    const bans = await this.getActiveBans();
    return bans.some(
      (entry) =>
        (entry.kind === "anonymousId" && entry.key === anonymousId) ||
        (entry.kind === "ipHash" && ipHash && entry.key === ipHash)
    );
  }

  private async persistMeta(): Promise<void> {
    if (!this.meta) return;
    await this.ctx.storage.put(ROOM_META_KEY, this.meta);
    await this.persistD1MetadataIfDue(this.meta, Date.now(), true);
  }

  private async persistD1MetadataIfDue(
    meta: RoomMeta,
    now: number,
    force = false
  ): Promise<void> {
    if (
      !force &&
      now - this.lastD1MetadataSyncAt < D1_METADATA_SYNC_INTERVAL_MS
    ) {
      return;
    }
    this.lastD1MetadataSyncAt = now;
    await this.persistD1Metadata(meta);
  }

  private async persistD1Metadata(meta: RoomMeta): Promise<void> {
    if (!this.env.DB) return;
    const status =
      meta.roomType === "private" &&
      meta.onlineCount === 0 &&
      meta.deleteAt !== null
        ? "empty"
        : "active";
    const lastError = String(meta.lastError || "").slice(0, 80);
    try {
      await this.env.DB.prepare(
        `INSERT INTO whiteboard_rooms (
          room_id, room_type, created_at, last_active_at, empty_since, delete_at,
          online_count, document_version, snapshot_version, is_locked,
          resource_usage, resource_bytes, resource_count, object_count, status,
          epoch, last_error, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
        ON CONFLICT(room_id) DO UPDATE SET
          room_type = excluded.room_type,
          last_active_at = excluded.last_active_at,
          empty_since = excluded.empty_since,
          delete_at = excluded.delete_at,
          online_count = excluded.online_count,
          document_version = excluded.document_version,
          snapshot_version = excluded.snapshot_version,
          is_locked = excluded.is_locked,
          resource_usage = excluded.resource_usage,
          resource_bytes = excluded.resource_bytes,
          resource_count = excluded.resource_count,
          object_count = excluded.object_count,
          status = excluded.status,
          last_error = excluded.last_error,
          updated_at = excluded.updated_at`
      )
        .bind(
          meta.roomId,
          meta.roomType,
          new Date(meta.createdAt).toISOString(),
          new Date(meta.lastActiveAt).toISOString(),
          meta.emptySince === null
            ? null
            : new Date(meta.emptySince).toISOString(),
          meta.deleteAt === null ? null : new Date(meta.deleteAt).toISOString(),
          meta.onlineCount,
          meta.documentVersion,
          meta.snapshotVersion,
          meta.isLocked ? 1 : 0,
          JSON.stringify(meta.resourceUsage),
          meta.resourceUsage.bytes,
          meta.resourceUsage.images,
          this.documentStore.activeObjectCount(),
          status,
          lastError,
          new Date().toISOString()
        )
        .run();
    } catch {
      // D1 is a best-effort cross-room index; the DO remains authoritative.
    }
  }

  private async recordOperationalError(code: string): Promise<void> {
    if (!this.meta) return;
    const safeCode = /^[a-z0-9_]{1,80}$/.test(code)
      ? code
      : "whiteboard_operation_failed";
    const now = Date.now();
    const shouldIncrement =
      this.meta.lastError !== safeCode ||
      now - Number(this.meta.lastErrorAt || 0) >= 5 * 60_000;
    this.meta = {
      ...this.meta,
      lastError: safeCode,
      lastErrorAt: now
    };
    await this.persistMeta();
    if (shouldIncrement) {
      await this.incrementMetric("error_count");
    }
  }

  private async incrementMetric(
    key: "error_count" | "cleaned_room_count"
  ): Promise<void> {
    if (!this.env.DB) return;
    const now = new Date().toISOString();
    try {
      await this.env.DB.prepare(
        `INSERT INTO whiteboard_metrics (metric_key, metric_value, updated_at)
         VALUES (?, 1, ?)
         ON CONFLICT(metric_key) DO UPDATE SET
           metric_value = whiteboard_metrics.metric_value + 1,
           updated_at = excluded.updated_at`
      )
        .bind(key, now)
        .run();
    } catch {
      // Metrics are bounded, best-effort counters and never block room state.
    }
  }

  private async deleteD1Metadata(roomId: string): Promise<void> {
    if (!this.env.DB) return;
    await this.env.DB.prepare(
      "DELETE FROM whiteboard_rooms WHERE room_id = ?"
    )
      .bind(roomId)
      .run();
  }

  private async persistD1Asset(
    asset: ImageMeta,
    checksum: string
  ): Promise<void> {
    if (!this.env.DB) return;
    try {
      const createdAt = new Date(asset.createdAt).toISOString();
      await this.env.DB.prepare(
        `INSERT INTO whiteboard_assets (
          asset_id, room_id, object_key, content_type, byte_size, width, height,
          sha256, ref_count, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'active', ?, ?)
        ON CONFLICT(asset_id) DO UPDATE SET
          room_id = excluded.room_id,
          object_key = excluded.object_key,
          content_type = excluded.content_type,
          byte_size = excluded.byte_size,
          width = excluded.width,
          height = excluded.height,
          sha256 = excluded.sha256,
          status = 'active',
          updated_at = excluded.updated_at,
          last_error = ''`
      )
        .bind(
          asset.assetId,
          asset.roomId,
          asset.key,
          asset.contentType,
          asset.byteLength,
          asset.width,
          asset.height,
          checksum,
          createdAt,
          createdAt
        )
        .run();
    } catch {
      // The DO metadata is authoritative; fleet reconciliation repairs the index.
    }
  }

  private async deleteD1Assets(roomId: string): Promise<void> {
    if (!this.env.DB) return;
    await this.env.DB.prepare(
      "DELETE FROM whiteboard_assets WHERE room_id = ?"
    )
      .bind(roomId)
      .run();
  }

  private async deleteD1Bans(roomId: string): Promise<void> {
    if (!this.env.DB) return;
    await this.env.DB.prepare(
      "DELETE FROM whiteboard_bans WHERE room_id = ?"
    )
      .bind(roomId)
      .run();
  }

  private async deleteD1Asset(assetId: string): Promise<void> {
    if (!this.env.DB) return;
    await this.env.DB.prepare(
      "DELETE FROM whiteboard_assets WHERE asset_id = ?"
    )
      .bind(assetId)
      .run();
  }

  private async scheduleAlarm(): Promise<void> {
    const now = Date.now();
    const lifecycleAlarm = this.meta
      ? nextAlarmAt(
          this.meta,
          this.ctx.getWebSockets().filter(socketIsOpen).length,
          now
        )
      : null;
    const ticketCleanupAlarm = await this.pruneConsumedTicketJtis(now);
    const agentReceiptCleanupAlarm = await this.pruneAgentReceipts(now);
    const agentAssetReceiptCleanupAlarm = await this.pruneAgentAssetReceipts(now);
    const storedAssetSweepAlarm =
      await this.ctx.storage.get<number>(ASSET_SWEEP_NEXT_KEY);
    const assetSweepAlarm =
      typeof storedAssetSweepAlarm === "number"
        ? Math.max(now + 1_000, storedAssetSweepAlarm)
        : null;
    const storedRateSweepAlarm =
      await this.ctx.storage.get<number>(RATE_SWEEP_NEXT_KEY);
    const rateSweepAlarm =
      typeof storedRateSweepAlarm === "number"
        ? Math.max(now + 1_000, storedRateSweepAlarm)
        : null;
    const candidates = [
      lifecycleAlarm,
      ticketCleanupAlarm,
      agentReceiptCleanupAlarm,
      agentAssetReceiptCleanupAlarm,
      assetSweepAlarm,
      rateSweepAlarm
    ].filter((value): value is number => value !== null);
    const next = candidates.length > 0 ? Math.min(...candidates) : null;
    const existing = await this.ctx.storage.getAlarm();
    if (next === null) {
      if (existing !== null) await this.ctx.storage.deleteAlarm();
    } else if (
      existing === null ||
      existing <= now ||
      next < existing - 1_000
    ) {
      await this.ctx.storage.setAlarm(next);
    }
  }

  private async cleanupPrivateRoom(
    now: number,
    force = false
  ): Promise<boolean> {
    if (
      !this.meta ||
      this.meta.roomType !== "private" ||
      this.ctx.getWebSockets().some(socketIsOpen) ||
      (!force && !shouldDeleteRoom(this.meta, 0, now))
    ) {
      await this.scheduleAlarm();
      return false;
    }
    const roomId = this.meta.roomId;
    try {
      await this.deleteRoomAssets(roomId);
      await this.deleteD1Assets(roomId);
      await this.deleteD1Bans(roomId);
      await this.deleteD1Metadata(roomId);
    } catch {
      this.meta = {
        ...this.meta,
        cleanupRetryCount: this.meta.cleanupRetryCount + 1
      };
      await this.recordOperationalError("room_cleanup_failed");
      await this.ctx.storage.setAlarm(nextCleanupRetryAt(this.meta, now));
      return false;
    }
    await this.incrementMetric("cleaned_room_count");
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
    this.meta = null;
    return true;
  }

  private async deleteRoomAssets(roomId: string): Promise<void> {
    if (!this.env.WHITEBOARD_BUCKET) {
      if ((this.meta?.resourceUsage.images || 0) > 0) {
        throw new Error("asset_storage_unavailable");
      }
      return;
    }
    let cursor: string | undefined;
    do {
      const listed = await this.env.WHITEBOARD_BUCKET.list({
        prefix: `whiteboard/v1/${roomId}/`,
        cursor,
        limit: 1_000
      });
      if (listed.objects.length > 0) {
        await this.env.WHITEBOARD_BUCKET.delete(
          listed.objects.map((object) => object.key)
        );
      }
      cursor = listed.truncated ? listed.cursor : undefined;
    } while (cursor);
  }
}

export default {
  async fetch(request: Request, env: WhiteboardEnv): Promise<Response> {
    if (!(await isTrustedInternalRequest(request, env))) {
      return safeJsonResponse({ ok: false, error: "not_authorized" }, 401);
    }
    const roomId = request.headers.get(ROOM_ID_HEADER);
    if (!isValidRoomId(roomId)) {
      return safeJsonResponse({ ok: false, error: "room_unavailable" }, 404);
    }
    return env.WHITEBOARD_ROOMS.getByName(roomId).fetch(request);
  }
};
