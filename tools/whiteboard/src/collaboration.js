import * as Y from "yjs";
import {
  reconnectRoom,
  validatedWebSocketConfig,
} from "./api.js";
import { REMOTE_ORIGIN } from "./origins.js";

const WS_YJS_UPDATE = 0;
const WS_YJS_STATE_VECTOR = 1;
const LIVENESS_PING_MS = 60_000;
const BACKGROUND_PARK_MS = 60_000;
const CURSOR_INTERVAL_MS = 100;
const CURSOR_MOVE_THRESHOLD = 2;
const CURSOR_LABEL_FADE_MS = 2_500;
const MAX_TEXT_MESSAGE_CHARACTERS = 16 * 1024;
const MAX_OUTGOING_BINARY_BYTES = 256 * 1024;
const MAX_INCOMING_BINARY_BYTES = 16 * 1024 * 1024;
const MAX_QUEUED_UPDATE_BYTES = 1024 * 1024;
const MAX_QUEUED_UPDATES = 128;
const DEFAULT_UPDATE_INTERVAL_MS = 250;
const MIN_UPDATE_INTERVAL_MS = 200;
const MAX_UPDATE_INTERVAL_MS = 2_000;
const UPDATE_ACK_TIMEOUT_MS = 10_000;
const PRESENCE_ID_PATTERN = /^[A-Za-z0-9_-]{1,160}$/;
const ELEMENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

function encodeBinaryMessage(kind, payload) {
  if (!(payload instanceof Uint8Array)) throw new Error("invalid-yjs-update");
  const message = new Uint8Array(payload.byteLength + 1);
  message[0] = kind;
  message.set(payload, 1);
  return message;
}

async function messageBytes(data) {
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  if (data instanceof Blob) return new Uint8Array(await data.arrayBuffer());
  return null;
}

function safePresenceId(source) {
  const value = String(
    source?.presenceId
    || source?.connectionId
    || source?.socketId
    || source?.id
    || "",
  );
  return PRESENCE_ID_PATTERN.test(value) ? value : "";
}

function safeColor(value) {
  return COLOR_PATTERN.test(String(value || ""))
    ? String(value).toLowerCase()
    : "#64748b";
}

function safeDisplayName(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/\p{Cc}/gu, "")
    .trim()
    .slice(0, 32);
}

function safeCursor(source) {
  const cursor = source?.cursor && typeof source.cursor === "object"
    ? source.cursor
    : null;
  const x = Number(cursor?.x);
  const y = Number(cursor?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return {
    x: Math.max(-100_000_000, Math.min(100_000_000, x)),
    y: Math.max(-100_000_000, Math.min(100_000_000, y)),
    tool: "pointer",
    renderCursor: true,
  };
}

function safeSelection(value) {
  if (!Array.isArray(value)) return {};
  const result = {};
  value.slice(0, 50).forEach((id) => {
    if (ELEMENT_ID_PATTERN.test(String(id || ""))) result[id] = true;
  });
  return result;
}

function selectedIds(value) {
  if (!value || typeof value !== "object") return [];
  return Object.keys(value)
    .filter((id) => ELEMENT_ID_PATTERN.test(id) && value[id])
    .slice(0, 50);
}

function normalizedParticipant(source) {
  const presenceId = safePresenceId(source);
  const displayName = safeDisplayName(source?.displayName || source?.username || source?.name);
  if (!presenceId || !displayName) return null;
  return {
    presenceId,
    displayName,
    color: safeColor(source?.color),
    connectionCount: Math.max(1, Math.trunc(Number(source?.connectionCount) || 1)),
    focused: source?.focused !== false,
    drawing: source?.drawing === true,
  };
}

function normalizedCloseReason(event) {
  return String(event?.reason || "").trim().toLowerCase();
}

function closeErrorKind(event) {
  const reason = normalizedCloseReason(event);
  if (reason.includes("rate") || reason === "sync_budget_exceeded") return "rate-limited";
  if (
    reason.includes("access")
    || reason.includes("banned")
    || reason.includes("ticket")
    || reason === "invalid_session"
    || [4001, 4003, 4004, 4008, 4401, 4403].includes(event.code)
  ) {
    return "access";
  }
  if (event.code === 1008) return "protocol";
  return "";
}

function pageIsFocused() {
  return !document.hidden
    && (typeof document.hasFocus !== "function" || document.hasFocus());
}

export class WhiteboardCollaboration {
  constructor({ roomSession, scene, getApi, callbacks }) {
    this.roomSession = roomSession;
    this.scene = scene;
    this.doc = scene.getDocument();
    this.getApi = getApi;
    this.callbacks = callbacks;
    this.socket = null;
    this.destroyed = false;
    this.manualClose = false;
    this.connectedOnce = false;
    this.ready = false;
    this.synced = false;
    this.reconnectAttempt = 0;
    this.reconnectTimer = 0;
    this.heartbeatTimer = 0;
    this.visibilityParkTimer = 0;
    this.visibilityParked = false;
    this.syncFallbackTimer = 0;
    this.updateFlushTimer = 0;
    this.updateAckTimer = 0;
    this.cursorFadeTimer = 0;
    this.pointerTimer = 0;
    this.pendingPointer = null;
    this.lastPointer = null;
    this.lastPointerType = window.matchMedia("(pointer: coarse)").matches ? "touch" : "mouse";
    this.queue = [];
    this.queuedBytes = 0;
    this.inFlightUpdate = null;
    this.lastUpdateSentAt = 0;
    this.updateIntervalMs = DEFAULT_UPDATE_INTERVAL_MS;
    this.members = new Map();
    this.collaborators = new Map();
    this.ownPresenceId = "";
    this.ownParticipant = null;

    this.handleDocumentUpdate = (update, origin) => {
      if (origin === REMOTE_ORIGIN || this.destroyed) return;
      this.sendOrQueueUpdate(update);
    };
    this.handleOnline = () => {
      if (
        !document.hidden
        && !this.visibilityParked
        && (!this.socket || this.socket.readyState > WebSocket.OPEN)
      ) {
        this.scheduleReconnect(0);
      }
    };
    this.handleOffline = () => this.callbacks.onStatus?.("offline");
    this.sendFocusAwareness = () => {
      const focused = pageIsFocused();
      this.sendJson({
        type: "awareness",
        focused,
        away: !focused,
        drawing: false,
      });
    };
    this.handleVisibility = () => {
      if (document.hidden) {
        this.sendFocusAwareness();
        this.scheduleVisibilityPark();
        return;
      }
      this.cancelVisibilityPark();
      if (this.visibilityParked) {
        this.visibilityParked = false;
        this.reconnectAttempt = 0;
        this.callbacks.onStatus?.("reconnecting");
        this.scheduleReconnect(0);
        return;
      }
      this.sendFocusAwareness();
      if (!this.socket || this.socket.readyState > WebSocket.OPEN) {
        this.scheduleReconnect(0);
      }
    };
    this.handleFocus = () => this.sendFocusAwareness();
    this.handleBlur = () => this.sendFocusAwareness();
    this.doc.on("update", this.handleDocumentUpdate);
    window.addEventListener("online", this.handleOnline);
    window.addEventListener("offline", this.handleOffline);
    window.addEventListener("focus", this.handleFocus);
    window.addEventListener("blur", this.handleBlur);
    document.addEventListener("visibilitychange", this.handleVisibility);
    this.cursorFadeTimer = window.setInterval(() => this.renderCollaborators(), 500);
  }

  start() {
    if (document.hidden) {
      this.visibilityParked = true;
      this.callbacks.onStatus?.("offline");
      return;
    }
    this.openSocket(this.roomSession);
  }

  getAccessToken() {
    return this.roomSession?.accessToken || "";
  }

  notePointerType(pointerType) {
    if (["mouse", "pen", "touch"].includes(pointerType)) {
      this.lastPointerType = pointerType;
    }
  }

  openSocket(session) {
    if (this.destroyed || this.manualClose || this.visibilityParked) return;
    this.clearSocketTimers();
    let config;
    try {
      config = validatedWebSocketConfig(session);
    } catch (error) {
      this.callbacks.onError?.("connection", error);
      this.scheduleReconnect();
      return;
    }

    this.callbacks.onStatus?.(this.connectedOnce ? "reconnecting" : "connecting");
    let socket;
    try {
      socket = new WebSocket(config.url, config.protocols);
      socket.binaryType = "arraybuffer";
    } catch (error) {
      this.callbacks.onError?.("connection", error);
      this.scheduleReconnect();
      return;
    }
    this.socket = socket;
    socket.addEventListener("open", () => this.handleOpen(socket));
    socket.addEventListener("message", (event) => {
      this.handleMessage(socket, event).catch((error) => {
        this.callbacks.onError?.("protocol", error);
      });
    });
    socket.addEventListener("close", (event) => this.handleClose(socket, event));
    socket.addEventListener("error", () => {
      if (socket === this.socket) this.callbacks.onStatus?.("reconnecting");
    });
  }

  handleOpen(socket) {
    if (socket !== this.socket || this.destroyed) return;
    this.connectedOnce = true;
    this.ready = false;
    this.synced = false;
    this.callbacks.onStatus?.("connected");
    this.heartbeatTimer = window.setInterval(() => {
      if (!document.hidden && this.socket?.readyState === WebSocket.OPEN) {
        try {
          this.socket.send("ping");
        } catch {
          // The close/error event owns recovery.
        }
      }
    }, LIVENESS_PING_MS);
    this.syncFallbackTimer = window.setTimeout(() => this.markSynced(), 4_000);
  }

  async handleMessage(socket, event) {
    if (socket !== this.socket || this.destroyed) return;
    if (typeof event.data !== "string") {
      const bytes = await messageBytes(event.data);
      if (!bytes || bytes.byteLength < 1 || bytes.byteLength > MAX_INCOMING_BINARY_BYTES) {
        socket.close(1008, "invalid_binary");
        return;
      }
      const kind = bytes[0];
      const payload = bytes.subarray(1);
      if (kind === WS_YJS_UPDATE) {
        this.scene.applyRemoteUpdate(payload);
        this.markSynced();
      } else if (kind !== WS_YJS_STATE_VECTOR) {
        socket.close(1008, "unsupported_binary");
      }
      return;
    }

    if (event.data.length > MAX_TEXT_MESSAGE_CHARACTERS) {
      socket.close(1008, "message_too_large");
      return;
    }
    if (event.data === "pong") return;
    let message;
    try {
      message = JSON.parse(event.data);
    } catch {
      return;
    }
    if (!message || typeof message.type !== "string") return;

    switch (message.type) {
      case "ready": {
        this.ready = true;
        this.setUpdateInterval(message.updateIntervalMs);
        this.ownPresenceId = safePresenceId(
          message.participant || { presenceId: message.connectionId },
        );
        const ownParticipant = normalizedParticipant(message.participant);
        if (ownParticipant) {
          this.ownParticipant = ownParticipant;
          this.callbacks.onIdentity?.(ownParticipant);
        }
        this.replaceMembers(Array.isArray(message.participants) ? message.participants : []);
        if (typeof message.locked === "boolean") this.callbacks.onLocked?.(message.locked);
        this.sendBinary(
          WS_YJS_STATE_VECTOR,
          Y.encodeStateVector(this.doc),
        );
        break;
      }
      case "update-accepted":
        this.acknowledgeUpdate(message);
        break;
      case "participant-join":
      case "participant-update":
        if (message.type === "participant-update" && message.presenceId) {
          this.removeParticipant(message.presenceId);
        }
        this.upsertParticipant(message.participant);
        if (Number.isFinite(Number(message.onlineCount))) {
          this.callbacks.onOnlineCount?.(Number(message.onlineCount));
        }
        break;
      case "participant-leave":
        this.removeParticipant(message.presenceId);
        if (Number.isFinite(Number(message.onlineCount))) {
          this.callbacks.onOnlineCount?.(Number(message.onlineCount));
        }
        break;
      case "awareness":
        this.updateAwareness(message);
        break;
      case "lock-state":
      case "readonly":
        this.callbacks.onLocked?.(message.locked !== false);
        if (message.type === "readonly") {
          this.resetToAuthoritativeState();
          this.callbacks.onError?.("locked", message);
        }
        break;
      case "document-cleared":
        this.resetToAuthoritativeState();
        this.callbacks.onCleared?.();
        break;
      case "update-rejected":
        this.callbacks.onError?.(String(message.reason || "scene-limit"), message);
        this.resetToAuthoritativeState();
        break;
      case "heartbeat-ack":
        break;
      default:
        break;
    }
  }

  markSynced() {
    if (this.synced || this.destroyed) return;
    this.synced = true;
    this.reconnectAttempt = 0;
    if (this.syncFallbackTimer) window.clearTimeout(this.syncFallbackTimer);
    this.syncFallbackTimer = 0;
    this.scheduleUpdateFlush(0);
    this.callbacks.onSynced?.();
  }

  handleClose(socket, event) {
    if (socket !== this.socket) return;
    this.requeueInFlightUpdate();
    this.clearSocketTimers();
    this.socket = null;
    this.ready = false;
    this.synced = false;
    this.removeAllCollaborators();
    if (this.destroyed || this.manualClose || this.visibilityParked) {
      this.callbacks.onStatus?.("offline");
      return;
    }
    const errorKind = closeErrorKind(event);
    if (errorKind === "access" || errorKind === "protocol") {
      this.callbacks.onStatus?.("error");
      this.callbacks.onError?.(errorKind, {
        code: normalizedCloseReason(event) || event.code,
        reason: normalizedCloseReason(event),
      });
      return;
    }
    if (errorKind === "rate-limited") {
      this.updateIntervalMs = Math.min(
        MAX_UPDATE_INTERVAL_MS,
        Math.max(DEFAULT_UPDATE_INTERVAL_MS, this.updateIntervalMs * 2),
      );
      this.callbacks.onError?.("rate-limited", {
        code: normalizedCloseReason(event) || "rate_limited",
        reason: normalizedCloseReason(event),
        status: 429,
      });
    }
    this.callbacks.onStatus?.(navigator.onLine ? "reconnecting" : "offline");
    this.scheduleReconnect();
  }

  scheduleReconnect(delay) {
    if (
      this.destroyed
      || this.manualClose
      || this.visibilityParked
      || document.hidden
      || this.reconnectTimer
    ) return;
    const attempt = this.reconnectAttempt;
    const baseDelay = delay ?? Math.min(30_000, 1_000 * (2 ** Math.min(attempt, 5)));
    const jitter = delay === 0 ? 0 : Math.round(Math.random() * 400);
    this.reconnectAttempt += 1;
    this.reconnectTimer = window.setTimeout(async () => {
      this.reconnectTimer = 0;
      if (
        this.destroyed
        || this.manualClose
        || this.visibilityParked
        || document.hidden
        || !navigator.onLine
      ) {
        if (!navigator.onLine) this.scheduleReconnect(2_000);
        return;
      }
      try {
        const session = await reconnectRoom(this.roomSession.accessToken);
        this.roomSession = session;
        this.callbacks.onSession?.(session);
        this.openSocket(session);
      } catch (error) {
        this.callbacks.onError?.("reconnect", error);
        this.scheduleReconnect();
      }
    }, baseDelay + jitter);
  }

  forceIdentityReconnect() {
    if (this.destroyed || this.manualClose) return;
    this.reconnectAttempt = 0;
    if (this.socket) {
      const socket = this.socket;
      this.requeueInFlightUpdate();
      this.socket = null;
      this.clearSocketTimers();
      socket.close(1000, "identity-refresh");
    }
    this.removeAllCollaborators();
    this.scheduleReconnect(0);
  }

  sendOrQueueUpdate(update) {
    if (
      !(update instanceof Uint8Array)
      || update.byteLength + 1 > MAX_OUTGOING_BINARY_BYTES
    ) {
      this.callbacks.onError?.("scene-limit", new Error("oversized-local-update"));
      return;
    }
    const bufferedUpdateCount = this.queue.length + (this.inFlightUpdate ? 1 : 0);
    const bufferedUpdateBytes = this.queuedBytes + (this.inFlightUpdate?.byteLength || 0);
    if (
      bufferedUpdateCount >= MAX_QUEUED_UPDATES
      || bufferedUpdateBytes + update.byteLength > MAX_QUEUED_UPDATE_BYTES
    ) {
      this.callbacks.onError?.("scene-limit", new Error("offline-queue-limit"));
      return;
    }
    this.queue.push(update.slice());
    this.queuedBytes += update.byteLength;
    this.scheduleUpdateFlush();
  }

  flushUpdateQueue() {
    if (
      this.destroyed
      || this.inFlightUpdate
      || this.queue.length === 0
      || this.socket?.readyState !== WebSocket.OPEN
      || !this.synced
    ) return;
    const elapsed = Date.now() - this.lastUpdateSentAt;
    if (elapsed < this.updateIntervalMs) {
      this.scheduleUpdateFlush(this.updateIntervalMs - elapsed);
      return;
    }
    const update = this.takeNextUpdateBatch();
    if (!update) return;
    this.inFlightUpdate = update;
    if (!this.sendBinary(WS_YJS_UPDATE, update)) {
      this.requeueInFlightUpdate();
      return;
    }
    this.lastUpdateSentAt = Date.now();
    this.updateAckTimer = window.setTimeout(() => {
      this.updateAckTimer = 0;
      if (this.socket?.readyState === WebSocket.OPEN && this.inFlightUpdate) {
        this.socket.close(1012, "update_ack_timeout");
      }
    }, UPDATE_ACK_TIMEOUT_MS);
  }

  scheduleUpdateFlush(delay) {
    if (this.destroyed || this.updateFlushTimer || this.inFlightUpdate || this.queue.length === 0) {
      return;
    }
    const elapsed = Date.now() - this.lastUpdateSentAt;
    const wait = Math.max(0, delay ?? (this.updateIntervalMs - elapsed));
    this.updateFlushTimer = window.setTimeout(() => {
      this.updateFlushTimer = 0;
      this.flushUpdateQueue();
    }, wait);
  }

  takeNextUpdateBatch() {
    const first = this.queue.shift();
    if (!first) return null;
    this.queuedBytes -= first.byteLength;
    let batch = first;
    while (this.queue.length > 0) {
      let merged;
      try {
        merged = Y.mergeUpdates([batch, this.queue[0]]);
      } catch {
        break;
      }
      if (merged.byteLength + 1 > MAX_OUTGOING_BINARY_BYTES) break;
      const next = this.queue.shift();
      this.queuedBytes -= next.byteLength;
      batch = merged;
    }
    return batch;
  }

  requeueInFlightUpdate() {
    if (!this.inFlightUpdate) return;
    if (this.updateAckTimer) window.clearTimeout(this.updateAckTimer);
    this.updateAckTimer = 0;
    this.queue.unshift(this.inFlightUpdate);
    this.queuedBytes += this.inFlightUpdate.byteLength;
    this.inFlightUpdate = null;
  }

  acknowledgeUpdate(message) {
    if (!this.inFlightUpdate) return;
    if (this.updateAckTimer) window.clearTimeout(this.updateAckTimer);
    this.updateAckTimer = 0;
    this.inFlightUpdate = null;
    this.setUpdateInterval(message?.updateIntervalMs);
    this.scheduleUpdateFlush();
  }

  setUpdateInterval(value) {
    const interval = Math.trunc(Number(value));
    if (!Number.isFinite(interval)) return;
    this.updateIntervalMs = Math.max(
      MIN_UPDATE_INTERVAL_MS,
      Math.min(MAX_UPDATE_INTERVAL_MS, interval),
    );
  }

  waitForPendingUpdates(timeoutMs = 3_000) {
    const deadline = Date.now() + Math.max(0, Number(timeoutMs) || 0);
    return new Promise((resolve) => {
      const check = () => {
        if (!this.inFlightUpdate && this.queue.length === 0) {
          resolve(true);
          return;
        }
        if (this.destroyed || Date.now() >= deadline) {
          resolve(false);
          return;
        }
        this.scheduleUpdateFlush(0);
        window.setTimeout(check, 40);
      };
      check();
    });
  }

  scheduleVisibilityPark() {
    if (
      this.destroyed
      || this.manualClose
      || this.visibilityParked
      || this.visibilityParkTimer
    ) return;
    this.visibilityParkTimer = window.setTimeout(() => {
      this.visibilityParkTimer = 0;
      this.parkForBackground().catch(() => {
        // Visibility recovery will reconnect when the page becomes active.
      });
    }, BACKGROUND_PARK_MS);
  }

  cancelVisibilityPark() {
    if (this.visibilityParkTimer) window.clearTimeout(this.visibilityParkTimer);
    this.visibilityParkTimer = 0;
  }

  async parkForBackground() {
    if (this.destroyed || this.manualClose || !document.hidden) return;
    await this.waitForPendingUpdates(3_000);
    if (this.destroyed || this.manualClose || !document.hidden) return;
    this.visibilityParked = true;
    this.requeueInFlightUpdate();
    if (this.reconnectTimer) window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = 0;
    this.clearSocketTimers();
    const socket = this.socket;
    this.socket = null;
    this.ready = false;
    this.synced = false;
    if (socket && socket.readyState < WebSocket.CLOSING) {
      socket.close(1000, "page-hidden");
    }
    this.removeAllCollaborators();
    this.callbacks.onStatus?.("offline");
  }

  sendBinary(kind, payload) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return false;
    try {
      this.socket.send(encodeBinaryMessage(kind, payload));
      return true;
    } catch {
      return false;
    }
  }

  sendJson(message) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return false;
    const serialized = JSON.stringify(message);
    if (serialized.length > MAX_TEXT_MESSAGE_CHARACTERS) return false;
    try {
      this.socket.send(serialized);
      return true;
    } catch {
      return false;
    }
  }

  sendPointerUpdate(payload) {
    if (!pageIsFocused() || !payload?.pointer) return;
    this.pendingPointer = payload;
    if (this.pointerTimer) return;
    const elapsed = performance.now() - Number(this.lastPointer?.sentAt || 0);
    this.pointerTimer = window.setTimeout(() => {
      this.pointerTimer = 0;
      const next = this.pendingPointer;
      this.pendingPointer = null;
      if (!next?.pointer) return;
      const previous = this.lastPointer;
      const moved = !previous
        || Math.hypot(next.pointer.x - previous.x, next.pointer.y - previous.y)
          >= CURSOR_MOVE_THRESHOLD;
      const buttonChanged = !previous || next.button !== previous.button;
      if (!moved && !buttonChanged) return;
      this.sendJson({
        type: "awareness",
        cursor: {
          x: Math.round(next.pointer.x * 10) / 10,
          y: Math.round(next.pointer.y * 10) / 10,
          pointer: this.lastPointerType,
        },
        selection: selectedIds(this.getApi()?.getAppState()?.selectedElementIds),
        drawing: next.button === "down",
        focused: true,
        away: false,
      });
      this.lastPointer = {
        x: next.pointer.x,
        y: next.pointer.y,
        button: next.button,
        sentAt: performance.now(),
      };
    }, Math.max(0, CURSOR_INTERVAL_MS - elapsed));
  }

  updateAwareness(source) {
    const participant = normalizedParticipant(source);
    if (!participant || this.isOwnParticipant(participant)) return;
    const cursor = safeCursor(source);
    const previous = this.collaborators.get(participant.presenceId);
    this.members.set(participant.presenceId, {
      ...(this.members.get(participant.presenceId) || participant),
      ...participant,
      focused: source.focused !== false,
      drawing: source.drawing === true,
    });
    this.collaborators.set(participant.presenceId, {
      ...previous,
      ...participant,
      pointer: cursor || previous?.pointer || null,
      button: source.drawing === true ? "down" : "up",
      selectedElementIds: safeSelection(source.selection),
      focused: source.focused !== false && source.away !== true,
      drawing: source.drawing === true,
      lastMovedAt: cursor ? Date.now() : Number(previous?.lastMovedAt || 0),
    });
    this.publishMembers();
    this.renderCollaborators();
  }

  upsertParticipant(source) {
    const participant = normalizedParticipant(source);
    if (!participant || this.isOwnParticipant(participant)) return;
    this.members.set(participant.presenceId, participant);
    const previous = this.collaborators.get(participant.presenceId);
    if (previous) {
      this.collaborators.set(participant.presenceId, { ...previous, ...participant });
    }
    this.publishMembers();
    this.renderCollaborators();
  }

  removeParticipant(presenceIdValue) {
    const presenceId = safePresenceId({ presenceId: presenceIdValue });
    if (!presenceId) return;
    this.members.delete(presenceId);
    this.collaborators.delete(presenceId);
    this.publishMembers();
    this.renderCollaborators();
  }

  replaceMembers(rawMembers) {
    const next = new Map();
    rawMembers.slice(0, 128).forEach((source) => {
      const participant = normalizedParticipant(source);
      if (!participant || this.isOwnParticipant(participant)) return;
      next.set(participant.presenceId, participant);
      const previous = this.collaborators.get(participant.presenceId);
      if (previous) this.collaborators.set(participant.presenceId, { ...previous, ...participant });
    });
    this.members = next;
    for (const presenceId of this.collaborators.keys()) {
      if (!next.has(presenceId)) this.collaborators.delete(presenceId);
    }
    this.publishMembers();
    this.renderCollaborators();
  }

  publishMembers() {
    const members = [...this.members.values()]
      .sort((left, right) => left.displayName.localeCompare(right.displayName));
    this.callbacks.onMembers?.(members);
  }

  isOwnParticipant(participant) {
    return participant.presenceId === this.ownPresenceId
      || Boolean(
        this.ownParticipant
        && participant.displayName === this.ownParticipant.displayName
        && participant.color === this.ownParticipant.color,
      );
  }

  resetToAuthoritativeState() {
    this.doc.off("update", this.handleDocumentUpdate);
    this.doc = this.scene.resetFromServer();
    this.doc.on("update", this.handleDocumentUpdate);
    this.queue = [];
    this.queuedBytes = 0;
    this.inFlightUpdate = null;
    if (this.updateFlushTimer) window.clearTimeout(this.updateFlushTimer);
    if (this.updateAckTimer) window.clearTimeout(this.updateAckTimer);
    this.updateFlushTimer = 0;
    this.updateAckTimer = 0;
    this.synced = false;
    this.callbacks.onSyncReset?.();
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.sendBinary(WS_YJS_STATE_VECTOR, Y.encodeStateVector(this.doc));
    }
  }

  renderCollaborators() {
    const api = this.getApi();
    if (!api || this.destroyed) return;
    const now = Date.now();
    const rendered = new Map();
    for (const [presenceId, collaborator] of this.collaborators) {
      if (!collaborator.pointer) continue;
      const showName = collaborator.drawing
        || now - Number(collaborator.lastMovedAt || 0) <= CURSOR_LABEL_FADE_MS;
      rendered.set(presenceId, {
        id: presenceId,
        socketId: presenceId,
        pointer: collaborator.pointer,
        button: collaborator.button || "up",
        selectedElementIds: collaborator.selectedElementIds || {},
        username: showName ? collaborator.displayName : undefined,
        color: {
          background: collaborator.color,
          stroke: collaborator.color,
        },
        userState: collaborator.focused === false ? "idle" : "active",
      });
    }
    api.updateScene({ collaborators: rendered });
  }

  removeAllCollaborators() {
    this.members.clear();
    this.collaborators.clear();
    this.publishMembers();
    this.getApi()?.updateScene({ collaborators: new Map() });
  }

  clearSocketTimers() {
    if (this.heartbeatTimer) window.clearInterval(this.heartbeatTimer);
    if (this.syncFallbackTimer) window.clearTimeout(this.syncFallbackTimer);
    if (this.updateFlushTimer) window.clearTimeout(this.updateFlushTimer);
    if (this.updateAckTimer) window.clearTimeout(this.updateAckTimer);
    this.heartbeatTimer = 0;
    this.syncFallbackTimer = 0;
    this.updateFlushTimer = 0;
    this.updateAckTimer = 0;
  }

  destroy() {
    this.destroyed = true;
    this.manualClose = true;
    this.clearSocketTimers();
    if (this.reconnectTimer) window.clearTimeout(this.reconnectTimer);
    if (this.cursorFadeTimer) window.clearInterval(this.cursorFadeTimer);
    if (this.pointerTimer) window.clearTimeout(this.pointerTimer);
    this.cancelVisibilityPark();
    this.reconnectTimer = 0;
    this.cursorFadeTimer = 0;
    this.pointerTimer = 0;
    this.doc.off("update", this.handleDocumentUpdate);
    window.removeEventListener("online", this.handleOnline);
    window.removeEventListener("offline", this.handleOffline);
    window.removeEventListener("focus", this.handleFocus);
    window.removeEventListener("blur", this.handleBlur);
    document.removeEventListener("visibilitychange", this.handleVisibility);
    const socket = this.socket;
    this.socket = null;
    if (socket && socket.readyState < WebSocket.CLOSING) socket.close(1000, "leave");
    this.removeAllCollaborators();
  }
}
