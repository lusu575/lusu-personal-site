import { DurableObject } from "cloudflare:workers";

import { sha256Hex } from "./security";

export const GAME_RELAY_PROTOCOL_VERSION = 1;
export const GAME_RELAY_WEBSOCKET_PROTOCOL = "lusu-game-v1";
export const GAME_RELAY_PAIR_PROTOCOL_PREFIX = "pair.";

const STATE_KEY = "game-relay:state";
const INTERNAL_HEADER = "x-lusu-game-relay-internal";
const SESSION_HEADER = "x-lusu-game-relay-session";
const OWNER_HEADER = "x-lusu-game-relay-owner";
const CONTROLLER_HEADER = "x-lusu-game-relay-controller";
const PAIRING_CODE_PATTERN = /^[A-Z2-7]{26}$/;
const SESSION_ID_PATTERN = /^[a-f0-9]{64}$/;
const CONTROLLER_ID_PATTERN = /^[a-f0-9]{64}$/;
const GAME_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const BROWSER_SESSION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{15,127}$/;
const CLIENT_ACTION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const SEMANTIC_ACTION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const ACTION_TOKEN_PATTERN = /^act_[A-Za-z0-9_-]{22}$/;
const ERROR_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_]{2,63}$/;
const COMMAND_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{15,127}$/;
const MAX_REVISION = 1_000_000_000;
const MAX_SOCKET_MESSAGE_BYTES = 96 * 1024;
const MAX_OBSERVATION_BYTES = 64 * 1024;
const MAX_ACTIONS_BYTES = 64 * 1024;
const MAX_ACTION_RESULT_BYTES = 32 * 1024;
const MAX_ACTIONS = 256;
const MAX_RECEIPTS = 128;
const MAX_RECEIPT_BYTES = 512 * 1024;
const PAIR_TTL_MS = 5 * 60 * 1_000;
const ACTIVE_IDLE_TTL_MS = 30 * 60 * 1_000;
const HARD_TTL_MS = 2 * 60 * 60 * 1_000;
const DISCONNECT_GRACE_MS = 30 * 1_000;
const COMMAND_TTL_MS = 5 * 1_000;
const COMPLETION_TTL_MS = 20 * 1_000;
const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);

type RelayStatus = "awaiting_pair" | "active" | "paused" | "disconnected";

type RelayAction = Record<string, unknown> & {
  actionId: string;
  id: string;
  requiresConfirmation?: boolean;
};

type RelayOutput = Record<string, unknown>;

type PendingCommand = {
  kind: "observe" | "action";
  commandId: string;
  createdAt: number;
  expiresAt: number;
  clientActionId: string;
  fingerprint: string;
  expectedRevision: number;
  actionId: string;
};

type CommandCompletion = {
  commandId: string;
  kind: "observe" | "action";
  output: RelayOutput;
  expiresAt: number;
};

type ActionReceipt = {
  clientActionId: string;
  fingerprint: string;
  output: RelayOutput;
  createdAt: number;
};

type RelayState = {
  version: 1;
  sessionId: string;
  ownerUserId: string;
  browserSessionId: string;
  browserConnectionId: string;
  gameId: string;
  status: RelayStatus;
  pausedByUser: boolean;
  controllerReady: boolean;
  controllerId: string;
  revision: number;
  observation: Record<string, unknown>;
  actions: RelayAction[];
  pending: PendingCommand | null;
  completion: CommandCompletion | null;
  receipts: ActionReceipt[];
  createdAt: number;
  pairExpiresAt: number;
  hardExpiresAt: number;
  lastControllerAt: number;
  lastBrowserAt: number;
  disconnectedAt: number;
};

type BrowserAttachment = {
  version: 1;
  role: "browser";
  connectionId: string;
  connectedAt: number;
};

export class GameRelayError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Record<string, unknown> | null;

  constructor(
    message: string,
    status: number,
    code: string,
    details: Record<string, unknown> | null = null
  ) {
    super(message);
    this.name = "GameRelayError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function normalizePairingCode(value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text || text.length > 64 || /[^A-Za-z2-7 -]/.test(text)) {
    throw new GameRelayError("The pairing code is invalid.", 422, "GAME_PAIRING_CODE_INVALID");
  }
  const normalized = text.replace(/[ -]/g, "").toUpperCase();
  if (!PAIRING_CODE_PATTERN.test(normalized)) {
    throw new GameRelayError("The pairing code is invalid.", 422, "GAME_PAIRING_CODE_INVALID");
  }
  return normalized;
}

export async function gameRelaySessionId(pairingCode: unknown): Promise<string> {
  return sha256Hex(normalizePairingCode(pairingCode));
}

export async function gameRelayControllerId(grantRef: string, clientId: string): Promise<string> {
  return sha256Hex(`${grantRef}\u0000${clientId}`);
}

export function parsePairingProtocol(header: string | null): string {
  const protocols = String(header || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (protocols.length !== 2 || new Set(protocols).size !== protocols.length
    || !protocols.includes(GAME_RELAY_WEBSOCKET_PROTOCOL)) {
    throw new GameRelayError(
      "The game relay WebSocket protocols are invalid.",
      426,
      "GAME_RELAY_PROTOCOL_REQUIRED"
    );
  }
  const pairProtocol = protocols.find((value) => value.startsWith(GAME_RELAY_PAIR_PROTOCOL_PREFIX));
  if (!pairProtocol) {
    throw new GameRelayError(
      "The game relay pairing protocol is missing.",
      426,
      "GAME_RELAY_PROTOCOL_REQUIRED"
    );
  }
  const rawPairingCode = pairProtocol.slice(GAME_RELAY_PAIR_PROTOCOL_PREFIX.length);
  const normalizedPairingCode = normalizePairingCode(rawPairingCode);
  if (rawPairingCode !== normalizedPairingCode) {
    throw new GameRelayError(
      "The WebSocket pairing code must use normalized uppercase base32.",
      422,
      "GAME_PAIRING_CODE_INVALID"
    );
  }
  return normalizedPairingCode;
}

export async function relayBrowserUpgrade(
  env: Env,
  request: Request,
  ownerUserId: string,
  pairingCode: string
): Promise<Response> {
  const sessionId = await gameRelaySessionId(pairingCode);
  const stub = env.GAME_RELAY.getByName(sessionId);
  return stub.fetch("https://game-relay.internal/browser/connect", {
    method: "GET",
    headers: {
      [INTERNAL_HEADER]: "1",
      [SESSION_HEADER]: sessionId,
      [OWNER_HEADER]: ownerUserId,
      Upgrade: "websocket",
      "Sec-WebSocket-Protocol": GAME_RELAY_WEBSOCKET_PROTOCOL,
      "User-Agent": String(request.headers.get("User-Agent") || "").slice(0, 512)
    }
  });
}

export async function relayControllerRequest(
  env: Env,
  input: {
    sessionId: string;
    ownerUserId: string;
    controllerId: string;
    path: "/controller/pair" | "/controller/observe" | "/controller/act"
      | "/controller/result" | "/controller/pause" | "/controller/close";
    body?: Record<string, unknown>;
  }
): Promise<Record<string, unknown>> {
  if (!SESSION_ID_PATTERN.test(input.sessionId)
    || !CONTROLLER_ID_PATTERN.test(input.controllerId)
    || !input.ownerUserId
    || input.ownerUserId.length > 128) {
    throw new GameRelayError("The relay identity is invalid.", 401, "GAME_RELAY_IDENTITY_INVALID");
  }
  const stub = env.GAME_RELAY.getByName(input.sessionId);
  const response = await stub.fetch(`https://game-relay.internal${input.path}`, {
    method: "POST",
    headers: {
      [INTERNAL_HEADER]: "1",
      [SESSION_HEADER]: input.sessionId,
      [OWNER_HEADER]: input.ownerUserId,
      [CONTROLLER_HEADER]: input.controllerId,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input.body || {})
  });
  const parsedPayload: unknown = await response.json().catch(() => ({}));
  const payload: Record<string, unknown> = isPlainRecord(parsedPayload) ? parsedPayload : {};
  if (!response.ok) {
    throw new GameRelayError(
      typeof payload.error === "string" ? payload.error : "The browser game relay request failed.",
      response.status,
      typeof payload.code === "string" ? payload.code : "GAME_RELAY_REQUEST_FAILED",
      isPlainRecord(payload.details) ? payload.details : null
    );
  }
  return payload;
}

export class GameRelaySession extends DurableObject<Env> {
  private readonly ready: Promise<void>;
  private mutationChain: Promise<unknown> = Promise.resolve();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
    this.ready = ctx.blockConcurrencyWhile(async () => {
      const state = await ctx.storage.get<RelayState>(STATE_KEY);
      if (state && !validStoredState(state)) {
        await ctx.storage.deleteAll();
        await ctx.storage.deleteAlarm();
      }
    });
  }

  async fetch(request: Request): Promise<Response> {
    await this.ready;
    return this.enqueueMutation(async () => {
      if (request.headers.get(INTERNAL_HEADER) !== "1") {
        return relayJson({ error: "Not authorized.", code: "GAME_RELAY_NOT_AUTHORIZED" }, 401);
      }
      const sessionId = request.headers.get(SESSION_HEADER) || "";
      if (!SESSION_ID_PATTERN.test(sessionId)) {
        return relayJson({ error: "The relay session is invalid.", code: "GAME_RELAY_SESSION_INVALID" }, 422);
      }
      const url = new URL(request.url);
      if (request.method === "GET" && url.pathname === "/browser/connect") {
        return this.handleBrowserConnect(request, sessionId);
      }
      if (request.method !== "POST") {
        return relayJson({ error: "Not found.", code: "NOT_FOUND" }, 404);
      }
      const identity = controllerIdentity(request, sessionId);
      if (identity instanceof Response) return identity;
      const body = await readRelayJson(request);
      if (body instanceof Response) return body;
      switch (url.pathname) {
        case "/controller/pair":
          return this.handleControllerPair(identity, body);
        case "/controller/observe":
          return this.handleControllerObserve(identity, body);
        case "/controller/act":
          return this.handleControllerAct(identity, body);
        case "/controller/result":
          return this.handleControllerResult(identity, body);
        case "/controller/pause":
          return this.handleControllerPause(identity, body);
        case "/controller/close":
          return this.handleControllerClose(identity, body);
        default:
          return relayJson({ error: "Not found.", code: "NOT_FOUND" }, 404);
      }
    });
  }

  async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    await this.ready;
    await this.enqueueMutation(() => this.handleBrowserMessage(socket, message));
  }

  async webSocketClose(
    socket: WebSocket,
    _code: number,
    _reason: string,
    _wasClean: boolean
  ): Promise<void> {
    await this.ready;
    await this.enqueueMutation(() => this.handleBrowserDeparture(socket));
  }

  async webSocketError(socket: WebSocket, _error: unknown): Promise<void> {
    try {
      socket.close(1011, "connection_error");
    } catch {
      // The close handler or alarm reconciles the persisted connection.
    }
  }

  async alarm(): Promise<void> {
    await this.ready;
    await this.enqueueMutation(async () => {
      const state = await this.loadState();
      if (!state) {
        await this.ctx.storage.deleteAlarm();
        return;
      }
      const current = await this.applyDeadlines(state, Date.now());
      if (!current) return;
      await this.persistState(current);
    });
  }

  private enqueueMutation<T>(action: () => Promise<T>): Promise<T> {
    const next = this.mutationChain.then(action, action);
    this.mutationChain = next.then(() => undefined, () => undefined);
    return next;
  }

  private async handleBrowserConnect(request: Request, sessionId: string): Promise<Response> {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket"
      || request.headers.get("Sec-WebSocket-Protocol") !== GAME_RELAY_WEBSOCKET_PROTOCOL) {
      return relayJson({ error: "WebSocket upgrade required.", code: "GAME_RELAY_UPGRADE_REQUIRED" }, 426);
    }
    const ownerUserId = request.headers.get(OWNER_HEADER) || "";
    if (!ownerUserId || ownerUserId.length > 128) {
      return relayJson({ error: "The browser owner is invalid.", code: "GAME_RELAY_OWNER_INVALID" }, 401);
    }
    const now = Date.now();
    let state = await this.loadState();
    if (state) state = await this.applyDeadlines(state, now);
    if (state && (state.sessionId !== sessionId || state.ownerUserId !== ownerUserId)) {
      return relayJson({ error: "The pairing code belongs to another owner.", code: "GAME_RELAY_OWNER_MISMATCH" }, 403);
    }
    if (!state) {
      state = {
        version: 1,
        sessionId,
        ownerUserId,
        browserSessionId: "",
        browserConnectionId: "",
        gameId: "",
        status: "awaiting_pair",
        pausedByUser: false,
        controllerReady: false,
        controllerId: "",
        revision: 0,
        observation: {},
        actions: [],
        pending: null,
        completion: null,
        receipts: [],
        createdAt: now,
        pairExpiresAt: now + PAIR_TTL_MS,
        hardExpiresAt: now + HARD_TTL_MS,
        lastControllerAt: 0,
        lastBrowserAt: now,
        disconnectedAt: 0
      };
    }

    for (const existing of this.ctx.getWebSockets("browser")) {
      closeSocket(existing, 4001, "browser_replaced");
    }
    const connectionId = randomToken();
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    const attachment: BrowserAttachment = {
      version: 1,
      role: "browser",
      connectionId,
      connectedAt: now
    };
    server.serializeAttachment(attachment);
    this.ctx.acceptWebSocket(server, ["browser"]);
    state.browserConnectionId = connectionId;
    state.lastBrowserAt = now;
    if (state.gameId && state.browserSessionId) {
      state.status = "disconnected";
      state.disconnectedAt = now;
    } else {
      state.disconnectedAt = 0;
    }
    await this.persistState(state);
    return new Response(null, {
      status: 101,
      headers: { "Sec-WebSocket-Protocol": GAME_RELAY_WEBSOCKET_PROTOCOL },
      webSocket: client
    });
  }

  private async handleBrowserMessage(socket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const attachment = readAttachment(socket);
    const state = await this.loadState();
    if (!attachment || !state || state.browserConnectionId !== attachment.connectionId) {
      closeSocket(socket, 1008, "invalid_session");
      return;
    }
    const byteLength = typeof message === "string" ? utf8Bytes(message) : message.byteLength;
    if (typeof message !== "string" || byteLength > MAX_SOCKET_MESSAGE_BYTES) {
      closeSocket(socket, 1009, "message_too_large");
      return;
    }
    let payload: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(message);
      if (!isPlainRecord(parsed)) throw new Error("message_not_object");
      payload = parsed;
    } catch {
      closeSocket(socket, 1007, "invalid_json");
      return;
    }
    try {
      assertProtocolVersion(payload);
      switch (payload.type) {
        case "hello":
          await this.applyHello(socket, state, payload);
          return;
        case "snapshot":
          await this.applySnapshot(state, payload);
          return;
        case "action_result":
          await this.applyActionResult(state, payload);
          return;
        case "user_pause":
          await this.applyUserPause(state, payload);
          return;
        case "user_resume":
          await this.applyUserResume(state, payload);
          return;
        case "user_close":
          await this.applyUserClose(payload);
          return;
        default:
          throw new GameRelayError("The browser message type is unsupported.", 422, "GAME_RELAY_MESSAGE_UNSUPPORTED");
      }
    } catch (error) {
      const code = error instanceof GameRelayError ? error.code : "GAME_RELAY_MESSAGE_INVALID";
      sendSocketJson(socket, { type: "relay_error", protocolVersion: 1, code });
      closeSocket(socket, 1008, "invalid_message");
    }
  }

  private async applyHello(
    socket: WebSocket,
    state: RelayState,
    payload: Record<string, unknown>
  ): Promise<void> {
    assertExactKeys(payload, [
      "type", "protocolVersion", "gameId", "browserSessionId", "revision", "observation", "actions"
    ]);
    const gameId = requiredPattern(payload.gameId, GAME_ID_PATTERN, 64, "GAME_RELAY_GAME_INVALID");
    const browserSessionId = requiredPattern(
      payload.browserSessionId,
      BROWSER_SESSION_ID_PATTERN,
      128,
      "GAME_RELAY_BROWSER_SESSION_INVALID"
    );
    if ((state.gameId && state.gameId !== gameId)
      || (state.browserSessionId && state.browserSessionId !== browserSessionId)) {
      throw new GameRelayError("The browser session does not match this pairing.", 409, "GAME_RELAY_BROWSER_SESSION_MISMATCH");
    }
    const snapshot = normalizeSnapshot(payload);
    if (state.browserSessionId && snapshot.revision < state.revision) {
      throw new GameRelayError("The browser revision moved backwards.", 409, "GAME_RELAY_REVISION_REGRESSION");
    }
    state.gameId = gameId;
    state.browserSessionId = browserSessionId;
    applySnapshotToState(state, snapshot);
    state.lastBrowserAt = Date.now();
    state.disconnectedAt = 0;
    state.status = state.controllerId
      ? state.pausedByUser ? "paused" : "active"
      : "awaiting_pair";
    if (state.controllerId) {
      state.controllerReady = false;
      state.actions = [];
    }
    await this.persistState(state);
    sendSocketJson(socket, {
      type: "relay_ready",
      protocolVersion: 1,
      sessionId: state.sessionId,
      state: state.status,
      pairExpiresAt: new Date(state.pairExpiresAt).toISOString()
    });
    if (state.controllerId) {
      sendSocketJson(socket, {
        type: "controller_connected",
        protocolVersion: 1,
        sessionId: state.sessionId
      });
    }
  }

  private async applySnapshot(state: RelayState, payload: Record<string, unknown>): Promise<void> {
    assertAllowedKeys(payload, [
      "type", "protocolVersion", "commandId", "revision", "observation", "actions"
    ]);
    const snapshot = normalizeSnapshot(payload);
    if (snapshot.revision < state.revision) {
      throw new GameRelayError("The browser revision moved backwards.", 409, "GAME_RELAY_REVISION_REGRESSION");
    }
    applySnapshotToState(state, snapshot);
    if (state.controllerId && state.status === "active") state.controllerReady = true;
    state.lastBrowserAt = Date.now();
    const commandId = optionalPattern(payload.commandId, COMMAND_ID_PATTERN, 128);
    if (commandId) {
      if (!state.pending || state.pending.kind !== "observe" || state.pending.commandId !== commandId) {
        throw new GameRelayError("The observe command is no longer pending.", 409, "GAME_RELAY_COMMAND_MISMATCH");
      }
      const output = publicSnapshot(state, false);
      state.completion = {
        commandId,
        kind: "observe",
        output,
        expiresAt: Date.now() + COMPLETION_TTL_MS
      };
      state.pending = null;
    }
    await this.persistState(state);
  }

  private async applyActionResult(state: RelayState, payload: Record<string, unknown>): Promise<void> {
    assertAllowedKeys(payload, [
      "type", "protocolVersion", "commandId", "clientActionId", "ok", "revision",
      "observation", "actions", "actionResult", "error"
    ]);
    const commandId = requiredPattern(payload.commandId, COMMAND_ID_PATTERN, 128, "GAME_RELAY_COMMAND_INVALID");
    const clientActionId = requiredPattern(
      payload.clientActionId,
      CLIENT_ACTION_ID_PATTERN,
      128,
      "GAME_RELAY_CLIENT_ACTION_ID_INVALID"
    );
    const pending = state.pending;
    if (!pending || pending.kind !== "action" || pending.commandId !== commandId
      || pending.clientActionId !== clientActionId) {
      throw new GameRelayError("The action command is no longer pending.", 409, "GAME_RELAY_COMMAND_MISMATCH");
    }
    let output: RelayOutput;
    if (payload.ok === true) {
      const snapshot = normalizeSnapshot(payload);
      if (snapshot.revision < state.revision
        || (snapshot.revision !== pending.expectedRevision
          && snapshot.revision !== pending.expectedRevision + 1)) {
        throw new GameRelayError("The browser action revision is invalid.", 409, "GAME_RELAY_ACTION_REVISION_INVALID");
      }
      const actionResult = normalizeActionResult(
        payload.actionResult,
        clientActionId,
        snapshot,
        state.gameId
      );
      applySnapshotToState(state, snapshot);
      state.controllerReady = true;
      output = {
        ok: true,
        replayed: false,
        ...publicSnapshot(state, false),
        clientActionId,
        actionResult
      };
    } else if (payload.ok === false) {
      const error = normalizeBrowserError(payload.error);
      output = {
        ok: false,
        replayed: false,
        sessionId: state.sessionId,
        gameId: state.gameId,
        clientActionId,
        error
      };
    } else {
      throw new GameRelayError("The action result status is invalid.", 422, "GAME_RELAY_ACTION_RESULT_INVALID");
    }
    state.lastBrowserAt = Date.now();
    state.pending = null;
    state.completion = {
      commandId,
      kind: "action",
      output,
      expiresAt: Date.now() + COMPLETION_TTL_MS
    };
    state.receipts.push({
      clientActionId,
      fingerprint: pending.fingerprint,
      output,
      createdAt: Date.now()
    });
    pruneReceipts(state);
    await this.persistState(state);
  }

  private async applyUserPause(state: RelayState, payload: Record<string, unknown>): Promise<void> {
    assertExactKeys(payload, ["type", "protocolVersion"]);
    state.pausedByUser = true;
    state.controllerReady = false;
    state.status = "paused";
    completePendingWithError(state, "GAME_SESSION_PAUSED", "The owner paused AI game control.");
    state.lastBrowserAt = Date.now();
    await this.persistState(state);
  }

  private async applyUserResume(state: RelayState, payload: Record<string, unknown>): Promise<void> {
    assertExactKeys(payload, [
      "type", "protocolVersion", "revision", "observation", "actions"
    ]);
    const snapshot = normalizeSnapshot(payload);
    if (snapshot.revision < state.revision) {
      throw new GameRelayError("The browser revision moved backwards.", 409, "GAME_RELAY_REVISION_REGRESSION");
    }
    applySnapshotToState(state, snapshot);
    state.pausedByUser = false;
    state.controllerReady = Boolean(state.controllerId);
    state.status = state.controllerId ? "active" : "awaiting_pair";
    state.lastBrowserAt = Date.now();
    await this.persistState(state);
  }

  private async applyUserClose(payload: Record<string, unknown>): Promise<void> {
    assertExactKeys(payload, ["type", "protocolVersion"]);
    await this.closeAndDelete(4000, "owner_closed");
  }

  private async handleBrowserDeparture(socket: WebSocket): Promise<void> {
    const attachment = readAttachment(socket);
    const state = await this.loadState();
    if (!attachment || !state || state.browserConnectionId !== attachment.connectionId) return;
    state.browserConnectionId = "";
    state.status = "disconnected";
    state.disconnectedAt = Date.now();
    completePendingWithError(state, "GAME_BROWSER_DISCONNECTED", "The browser game disconnected.");
    await this.persistState(state);
  }

  private async handleControllerPair(
    identity: ControllerIdentity,
    body: Record<string, unknown>
  ): Promise<Response> {
    if (Object.keys(body).length !== 0) return invalidBody();
    let state = await this.activeState(identity.sessionId);
    if (!state) return sessionUnavailable();
    const identityError = ownerIdentityError(state, identity, false);
    if (identityError) return identityError;
    if (!state.gameId || !state.browserSessionId || state.status === "disconnected"
      || !this.browserSocket(state)) {
      return relayJson({ error: "The browser has not completed relay setup.", code: "GAME_BROWSER_NOT_READY" }, 409);
    }
    if (state.controllerId && state.controllerId !== identity.controllerId) {
      return relayJson({ error: "This pairing code was already used by another client.", code: "GAME_PAIRING_CODE_USED" }, 409);
    }
    if (state.controllerId === identity.controllerId) {
      state.lastControllerAt = Date.now();
      await this.persistState(state);
      return relayJson({
        ok: true,
        paired: true,
        replayed: true,
        ...publicSnapshot(state, !state.controllerReady)
      });
    }
    state.controllerId = identity.controllerId;
    state.controllerReady = false;
    state.actions = [];
    state.lastControllerAt = Date.now();
    state.status = state.pausedByUser ? "paused" : "active";
    await this.persistState(state);
    const socket = this.browserSocket(state);
    if (!socket) return sessionDisconnected();
    if (!sendSocketJson(socket, {
      type: "controller_connected",
      protocolVersion: 1,
      sessionId: state.sessionId
    })) {
      state = markDisconnected(state);
      await this.persistState(state);
      return sessionDisconnected();
    }
    return relayJson({
      ok: true,
      paired: true,
      replayed: false,
      ...publicSnapshot(state, true)
    });
  }

  private async handleControllerObserve(
    identity: ControllerIdentity,
    body: Record<string, unknown>
  ): Promise<Response> {
    if (Object.keys(body).length !== 0) return invalidBody();
    const state = await this.activeState(identity.sessionId);
    if (!state) return sessionUnavailable();
    const identityError = ownerIdentityError(state, identity, true);
    if (identityError) return identityError;
    state.lastControllerAt = Date.now();
    if (state.status === "paused") {
      await this.persistState(state);
      return relayJson({ ok: true, status: "completed", commandId: "", output: publicSnapshot(state, true) });
    }
    if (state.status !== "active") return sessionDisconnected();
    if (state.pending?.kind === "observe") {
      await this.persistState(state);
      return relayJson({ ok: true, status: "pending", commandId: state.pending.commandId });
    }
    if (state.pending) {
      return relayJson({
        error: "Another browser command is still pending.",
        code: "GAME_RELAY_BUSY",
        details: { commandId: state.pending.commandId }
      }, 409);
    }
    const socket = this.browserSocket(state);
    if (!socket) {
      await this.persistState(markDisconnected(state));
      return sessionDisconnected();
    }
    const commandId = randomToken();
    state.pending = {
      kind: "observe",
      commandId,
      createdAt: Date.now(),
      expiresAt: Date.now() + COMMAND_TTL_MS,
      clientActionId: "",
      fingerprint: "",
      expectedRevision: state.revision,
      actionId: ""
    };
    state.completion = null;
    await this.persistState(state);
    if (!sendSocketJson(socket, { type: "observe", protocolVersion: 1, commandId })) {
      state.pending = null;
      await this.persistState(markDisconnected(state));
      return sessionDisconnected();
    }
    return relayJson({ ok: true, status: "pending", commandId });
  }

  private async handleControllerAct(
    identity: ControllerIdentity,
    body: Record<string, unknown>
  ): Promise<Response> {
    if (!exactRecordKeys(body, ["expectedRevision", "clientActionId", "actionId", "confirm"], ["confirm"])) {
      return invalidBody();
    }
    const expectedRevision = normalizedRevision(body.expectedRevision);
    const clientActionId = stringMatching(body.clientActionId, CLIENT_ACTION_ID_PATTERN, 128);
    const actionId = stringMatching(body.actionId, ACTION_TOKEN_PATTERN, 26);
    if (expectedRevision === null || !clientActionId || !actionId || (body.confirm !== undefined && typeof body.confirm !== "boolean")) {
      return invalidBody();
    }
    const state = await this.activeState(identity.sessionId);
    if (!state) return sessionUnavailable();
    const identityError = ownerIdentityError(state, identity, true);
    if (identityError) return identityError;
    state.lastControllerAt = Date.now();
    const fingerprint = await sha256Hex(JSON.stringify({
      expectedRevision,
      actionId,
      confirm: body.confirm === true
    }));
    const receipt = state.receipts.find((item) => item.clientActionId === clientActionId);
    if (receipt) {
      if (receipt.fingerprint !== fingerprint) {
        return relayJson({ error: "The clientActionId was reused with another payload.", code: "GAME_CLIENT_ACTION_ID_REUSED" }, 409);
      }
      await this.persistState(state);
      return relayJson({
        ok: true,
        status: "completed",
        commandId: "",
        output: { ...receipt.output, replayed: true }
      });
    }
    if (state.pending) {
      if (state.pending.kind === "action" && state.pending.clientActionId === clientActionId) {
        if (state.pending.fingerprint !== fingerprint) {
          return relayJson({ error: "The clientActionId was reused with another payload.", code: "GAME_CLIENT_ACTION_ID_REUSED" }, 409);
        }
        return relayJson({ ok: true, status: "pending", commandId: state.pending.commandId });
      }
      return relayJson({
        error: "Another browser command is still pending.",
        code: "GAME_RELAY_BUSY",
        details: { commandId: state.pending.commandId }
      }, 409);
    }
    if (state.status === "paused") {
      return relayJson({ error: "The owner paused AI game control.", code: "GAME_SESSION_PAUSED" }, 409);
    }
    if (state.status !== "active") return sessionDisconnected();
    if (!state.controllerReady) {
      return relayJson({
        error: "Observe the browser game before acting on its action catalog.",
        code: "GAME_ACTIONS_STALE"
      }, 409);
    }
    if (expectedRevision !== state.revision) {
      return relayJson({
        error: "The expected game revision is stale.",
        code: "GAME_REVISION_CONFLICT",
        details: { currentRevision: state.revision }
      }, 409);
    }
    const action = state.actions.find((item) => item.actionId === actionId);
    if (!action) {
      return relayJson({ error: "The action is not available at this revision.", code: "GAME_ACTION_UNAVAILABLE" }, 409);
    }
    if (action.requiresConfirmation === true && body.confirm !== true) {
      return relayJson({ error: "This action requires confirm=true.", code: "GAME_ACTION_CONFIRMATION_REQUIRED" }, 409);
    }
    const socket = this.browserSocket(state);
    if (!socket) {
      await this.persistState(markDisconnected(state));
      return sessionDisconnected();
    }
    const commandId = randomToken();
    state.pending = {
      kind: "action",
      commandId,
      createdAt: Date.now(),
      expiresAt: Date.now() + COMMAND_TTL_MS,
      clientActionId,
      fingerprint,
      expectedRevision,
      actionId
    };
    state.completion = null;
    await this.persistState(state);
    if (!sendSocketJson(socket, {
      type: "action",
      protocolVersion: 1,
      commandId,
      expectedRevision,
      clientActionId,
      actionId
    })) {
      state.pending = null;
      await this.persistState(markDisconnected(state));
      return sessionDisconnected();
    }
    return relayJson({ ok: true, status: "pending", commandId });
  }

  private async handleControllerResult(
    identity: ControllerIdentity,
    body: Record<string, unknown>
  ): Promise<Response> {
    if (!exactRecordKeys(body, ["commandId"])) return invalidBody();
    const commandId = stringMatching(body.commandId, COMMAND_ID_PATTERN, 128);
    if (!commandId) return invalidBody();
    const state = await this.activeState(identity.sessionId);
    if (!state) return sessionUnavailable();
    const identityError = ownerIdentityError(state, identity, true);
    if (identityError) return identityError;
    state.lastControllerAt = Date.now();
    if (state.completion?.commandId === commandId) {
      const output = state.completion.output;
      await this.persistState(state);
      return relayJson({ ok: true, status: "completed", commandId, output });
    }
    if (state.pending?.commandId === commandId) {
      await this.persistState(state);
      return relayJson({ ok: true, status: "pending", commandId });
    }
    return relayJson({ error: "The browser command is unavailable.", code: "GAME_RELAY_COMMAND_NOT_FOUND" }, 404);
  }

  private async handleControllerPause(
    identity: ControllerIdentity,
    body: Record<string, unknown>
  ): Promise<Response> {
    if (Object.keys(body).length !== 0) return invalidBody();
    const state = await this.activeState(identity.sessionId);
    if (!state) return sessionUnavailable();
    const identityError = ownerIdentityError(state, identity, true);
    if (identityError) return identityError;
    state.lastControllerAt = Date.now();
    if (state.status === "disconnected") {
      await this.persistState(state);
      return sessionDisconnected();
    }
    if (!this.browserSocket(state)) {
      await this.persistState(markDisconnected(state));
      return sessionDisconnected();
    }
    state.pausedByUser = true;
    state.controllerReady = false;
    state.status = "paused";
    completePendingWithError(state, "GAME_SESSION_PAUSED", "AI game control was paused.");
    const commandId = randomToken();
    await this.persistState(state);
    const socket = this.browserSocket(state);
    if (socket) sendSocketJson(socket, { type: "pause", protocolVersion: 1, commandId });
    return relayJson({ ok: true, sessionId: state.sessionId, state: state.status });
  }

  private async handleControllerClose(
    identity: ControllerIdentity,
    body: Record<string, unknown>
  ): Promise<Response> {
    if (!exactRecordKeys(body, ["confirm"]) || body.confirm !== true) return invalidBody();
    const state = await this.activeState(identity.sessionId);
    if (!state) return sessionUnavailable();
    const identityError = ownerIdentityError(state, identity, true);
    if (identityError) return identityError;
    const commandId = randomToken();
    const socket = this.browserSocket(state);
    if (socket) sendSocketJson(socket, { type: "close", protocolVersion: 1, commandId });
    await this.closeAndDelete(4000, "controller_closed");
    return relayJson({ ok: true, sessionId: state.sessionId, state: "closed" });
  }

  private async activeState(sessionId: string): Promise<RelayState | null> {
    const state = await this.loadState();
    if (!state || state.sessionId !== sessionId) return null;
    return this.applyDeadlines(state, Date.now());
  }

  private async applyDeadlines(state: RelayState, now: number): Promise<RelayState | null> {
    if (state.hardExpiresAt <= now
      || (!state.controllerId && state.pairExpiresAt <= now)
      || (state.controllerId && state.lastControllerAt > 0
        && state.lastControllerAt + ACTIVE_IDLE_TTL_MS <= now)
      || (state.status === "disconnected" && state.disconnectedAt > 0
        && state.disconnectedAt + DISCONNECT_GRACE_MS <= now)) {
      await this.closeAndDelete(4000, "session_expired");
      return null;
    }
    if (state.pending && state.pending.expiresAt <= now) {
      completePendingWithError(state, "GAME_RELAY_COMMAND_TIMEOUT", "The browser command timed out.");
    }
    if (state.completion && state.completion.expiresAt <= now) state.completion = null;
    return state;
  }

  private browserSocket(state: RelayState): WebSocket | null {
    return this.ctx.getWebSockets("browser").find((socket) => {
      const attachment = readAttachment(socket);
      return socket.readyState === 1 && attachment?.connectionId === state.browserConnectionId;
    }) || null;
  }

  private async loadState(): Promise<RelayState | null> {
    const state = await this.ctx.storage.get<RelayState>(STATE_KEY);
    return state && validStoredState(state) ? state : null;
  }

  private async persistState(state: RelayState): Promise<void> {
    pruneReceipts(state);
    await this.ctx.storage.put(STATE_KEY, state);
    await this.scheduleAlarm(state);
  }

  private async scheduleAlarm(state: RelayState): Promise<void> {
    const deadlines = [state.hardExpiresAt];
    if (!state.controllerId) deadlines.push(state.pairExpiresAt);
    if (state.controllerId && state.lastControllerAt > 0) {
      deadlines.push(state.lastControllerAt + ACTIVE_IDLE_TTL_MS);
    }
    if (state.status === "disconnected" && state.disconnectedAt > 0) {
      deadlines.push(state.disconnectedAt + DISCONNECT_GRACE_MS);
    }
    if (state.pending) deadlines.push(state.pending.expiresAt);
    if (state.completion) deadlines.push(state.completion.expiresAt);
    await this.ctx.storage.setAlarm(Math.max(Date.now() + 1_000, Math.min(...deadlines)));
  }

  private async closeAndDelete(code: number, reason: string): Promise<void> {
    for (const socket of this.ctx.getWebSockets()) closeSocket(socket, code, reason);
    await this.ctx.storage.deleteAll();
    await this.ctx.storage.deleteAlarm();
  }
}

type ControllerIdentity = {
  sessionId: string;
  ownerUserId: string;
  controllerId: string;
};

function controllerIdentity(request: Request, sessionId: string): ControllerIdentity | Response {
  const ownerUserId = request.headers.get(OWNER_HEADER) || "";
  const controllerId = request.headers.get(CONTROLLER_HEADER) || "";
  if (!ownerUserId || ownerUserId.length > 128 || !CONTROLLER_ID_PATTERN.test(controllerId)) {
    return relayJson({ error: "The controller identity is invalid.", code: "GAME_RELAY_IDENTITY_INVALID" }, 401);
  }
  return { sessionId, ownerUserId, controllerId };
}

function ownerIdentityError(
  state: RelayState,
  identity: ControllerIdentity,
  requireController: boolean
): Response | null {
  if (state.ownerUserId !== identity.ownerUserId) {
    return relayJson({ error: "The relay belongs to another owner.", code: "GAME_RELAY_OWNER_MISMATCH" }, 403);
  }
  if (requireController && (!state.controllerId || state.controllerId !== identity.controllerId)) {
    return relayJson({ error: "The OAuth client does not control this relay.", code: "GAME_RELAY_CONTROLLER_MISMATCH" }, 403);
  }
  return null;
}

function publicSnapshot(state: RelayState, stale: boolean): RelayOutput {
  const isStale = stale || !state.controllerReady;
  return {
    protocolVersion: 1,
    sessionId: state.sessionId,
    gameId: state.gameId,
    state: state.status,
    revision: state.revision,
    observation: state.observation,
    actions: isStale ? [] : state.actions,
    stale: isStale
  };
}

function normalizeSnapshot(payload: Record<string, unknown>): {
  revision: number;
  observation: Record<string, unknown>;
  actions: RelayAction[];
} {
  const revision = normalizedRevision(payload.revision);
  if (revision === null || !isPlainRecord(payload.observation) || !Array.isArray(payload.actions)) {
    throw new GameRelayError("The browser snapshot is invalid.", 422, "GAME_RELAY_SNAPSHOT_INVALID");
  }
  const observation = cloneBoundedJson(
    payload.observation,
    MAX_OBSERVATION_BYTES,
    16,
    10_000
  );
  if (!isPlainRecord(observation)) {
    throw new GameRelayError("The browser observation is invalid.", 422, "GAME_RELAY_OBSERVATION_INVALID");
  }
  if (payload.actions.length > MAX_ACTIONS) {
    throw new GameRelayError("The browser action list is too large.", 422, "GAME_RELAY_ACTIONS_INVALID");
  }
  const actions = cloneBoundedJson(
    payload.actions,
    MAX_ACTIONS_BYTES,
    12,
    4_000
  );
  if (!Array.isArray(actions)) {
    throw new GameRelayError("The browser action list is invalid.", 422, "GAME_RELAY_ACTIONS_INVALID");
  }
  const seenTokens = new Set<string>();
  const normalizedActions = actions.map((item) => {
    if (!isPlainRecord(item)) {
      throw new GameRelayError("A browser action is invalid.", 422, "GAME_RELAY_ACTIONS_INVALID");
    }
    if (Object.keys(item).some((key) => ![
      "actionId", "id", "label", "group", "description", "risk", "requiresConfirmation"
    ].includes(key))) {
      throw new GameRelayError("A browser action is invalid.", 422, "GAME_RELAY_ACTIONS_INVALID");
    }
    const actionId = stringMatching(item.actionId, ACTION_TOKEN_PATTERN, 26);
    const id = stringMatching(item.id, SEMANTIC_ACTION_ID_PATTERN, 128);
    const label = optionalBoundedString(item.label, 160);
    const group = optionalBoundedString(item.group, 80);
    const description = optionalBoundedString(item.description, 500);
    const risk = item.risk === undefined ? undefined : String(item.risk);
    if (!actionId || !id || seenTokens.has(actionId)
      || label === null || group === null || description === null
      || (risk !== undefined && !["low", "medium", "high", "critical"].includes(risk))
      || (item.requiresConfirmation !== undefined && typeof item.requiresConfirmation !== "boolean")) {
      throw new GameRelayError("A browser action is invalid.", 422, "GAME_RELAY_ACTIONS_INVALID");
    }
    seenTokens.add(actionId);
    return {
      actionId,
      id,
      ...(label === undefined ? {} : { label }),
      ...(group === undefined ? {} : { group }),
      ...(description === undefined ? {} : { description }),
      ...(risk === undefined ? {} : { risk }),
      ...(item.requiresConfirmation === undefined
        ? {}
        : { requiresConfirmation: item.requiresConfirmation })
    } as RelayAction;
  });
  return { revision, observation, actions: normalizedActions };
}

function normalizeActionResult(
  value: unknown,
  clientActionId: string,
  snapshot: { revision: number; observation: Record<string, unknown>; actions: RelayAction[] },
  gameId: string
): Record<string, unknown> {
  if (!isPlainRecord(value) || Object.keys(value).some((key) => ![
    "protocolVersion", "gameId", "sessionId", "clientActionId", "status", "reason",
    "beforeRevision", "revision", "deduplicated", "events", "observation"
  ].includes(key))) {
    throw new GameRelayError("The browser action result is invalid.", 422, "GAME_RELAY_ACTION_RESULT_INVALID");
  }
  const result = cloneBoundedJson(value, MAX_ACTION_RESULT_BYTES, 12, 4_000);
  if (!isPlainRecord(result)
    || result.protocolVersion !== GAME_RELAY_PROTOCOL_VERSION
    || result.gameId !== gameId
    || result.clientActionId !== clientActionId
    || result.revision !== snapshot.revision
    || !isPlainRecord(result.observation)
    || canonicalJson(result.observation) !== canonicalJson(snapshot.observation)
    || (result.sessionId !== undefined
      && (typeof result.sessionId !== "string" || result.sessionId.length > 128))
    || (result.status !== undefined
      && (typeof result.status !== "string" || result.status.length > 32))
    || (result.reason !== undefined
      && (typeof result.reason !== "string" || result.reason.length > 160))
    || (result.beforeRevision !== undefined && normalizedRevision(result.beforeRevision) === null)
    || (result.deduplicated !== undefined && typeof result.deduplicated !== "boolean")
    || (result.events !== undefined && !Array.isArray(result.events))) {
    throw new GameRelayError("The browser action result is invalid.", 422, "GAME_RELAY_ACTION_RESULT_INVALID");
  }
  return result;
}

function normalizeBrowserError(value: unknown): { code: string; message: string } {
  if (!isPlainRecord(value) || !exactRecordKeys(value, ["code", "message"])) {
    throw new GameRelayError("The browser action error is invalid.", 422, "GAME_RELAY_ACTION_ERROR_INVALID");
  }
  const code = stringMatching(value.code, ERROR_CODE_PATTERN, 64);
  const message = typeof value.message === "string" ? value.message.trim() : "";
  if (!code || !message || message.length > 240 || utf8Bytes(message) > 512) {
    throw new GameRelayError("The browser action error is invalid.", 422, "GAME_RELAY_ACTION_ERROR_INVALID");
  }
  return { code, message };
}

function applySnapshotToState(
  state: RelayState,
  snapshot: { revision: number; observation: Record<string, unknown>; actions: RelayAction[] }
): void {
  state.revision = snapshot.revision;
  state.observation = snapshot.observation;
  state.actions = snapshot.actions;
}

function completePendingWithError(state: RelayState, code: string, message: string): void {
  const pending = state.pending;
  if (!pending) return;
  const output: RelayOutput = {
    ok: false,
    sessionId: state.sessionId,
    gameId: state.gameId,
    ...(pending.clientActionId ? { clientActionId: pending.clientActionId } : {}),
    error: { code, message }
  };
  state.completion = {
    commandId: pending.commandId,
    kind: pending.kind,
    output,
    expiresAt: Date.now() + COMPLETION_TTL_MS
  };
  if (pending.kind === "action") {
    state.receipts.push({
      clientActionId: pending.clientActionId,
      fingerprint: pending.fingerprint,
      output,
      createdAt: Date.now()
    });
  }
  state.pending = null;
  pruneReceipts(state);
}

function markDisconnected(state: RelayState): RelayState {
  state.browserConnectionId = "";
  state.status = "disconnected";
  state.controllerReady = false;
  state.disconnectedAt = Date.now();
  completePendingWithError(state, "GAME_BROWSER_DISCONNECTED", "The browser game disconnected.");
  return state;
}

function pruneReceipts(state: RelayState): void {
  state.receipts.sort((left, right) => left.createdAt - right.createdAt);
  while (state.receipts.length > MAX_RECEIPTS) state.receipts.shift();
  while (state.receipts.length > 1 && utf8Bytes(JSON.stringify(state.receipts)) > MAX_RECEIPT_BYTES) {
    state.receipts.shift();
  }
}

function validStoredState(value: unknown): value is RelayState {
  if (!isPlainRecord(value)) return false;
  return value.version === 1
    && typeof value.sessionId === "string"
    && SESSION_ID_PATTERN.test(value.sessionId)
    && typeof value.ownerUserId === "string"
    && typeof value.status === "string"
    && ["awaiting_pair", "active", "paused", "disconnected"].includes(value.status)
    && Number.isSafeInteger(value.createdAt)
    && Number.isSafeInteger(value.hardExpiresAt)
    && typeof value.controllerReady === "boolean"
    && Array.isArray(value.receipts);
}

function readAttachment(socket: WebSocket): BrowserAttachment | null {
  try {
    const value = socket.deserializeAttachment() as Partial<BrowserAttachment> | null;
    if (!value || value.version !== 1 || value.role !== "browser"
      || typeof value.connectionId !== "string" || !COMMAND_ID_PATTERN.test(value.connectionId)) {
      return null;
    }
    return value as BrowserAttachment;
  } catch {
    return null;
  }
}

function sendSocketJson(socket: WebSocket, payload: Record<string, unknown>): boolean {
  try {
    if (socket.readyState !== 1) return false;
    socket.send(JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

function closeSocket(socket: WebSocket, code: number, reason: string): void {
  try {
    socket.close(code, reason.slice(0, 123));
  } catch {
    // The socket may already be gone.
  }
}

async function readRelayJson(request: Request): Promise<Record<string, unknown> | Response> {
  const contentType = String(request.headers.get("Content-Type") || "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (contentType !== "application/json") return invalidBody();
  const declared = Number(request.headers.get("Content-Length") || 0);
  if (Number.isFinite(declared) && declared > 16 * 1024) return invalidBody();
  try {
    const text = await request.text();
    if (utf8Bytes(text) > 16 * 1024) return invalidBody();
    const parsed: unknown = JSON.parse(text || "{}");
    return isPlainRecord(parsed) ? parsed : invalidBody();
  } catch {
    return invalidBody();
  }
}

function cloneBoundedJson<T>(value: T, maxBytes: number, maxDepth: number, maxNodes: number): T {
  inspectJson(value, maxDepth, maxNodes);
  const text = JSON.stringify(value);
  if (utf8Bytes(text) > maxBytes) {
    throw new GameRelayError("The browser JSON payload is too large.", 413, "GAME_RELAY_PAYLOAD_TOO_LARGE");
  }
  return JSON.parse(text) as T;
}

function inspectJson(value: unknown, maxDepth: number, maxNodes: number): void {
  let nodes = 0;
  const ancestors = new Set<object>();
  const visit = (current: unknown, depth: number): void => {
    nodes += 1;
    if (nodes > maxNodes || depth > maxDepth) {
      throw new GameRelayError("The browser JSON payload is too complex.", 422, "GAME_RELAY_PAYLOAD_TOO_COMPLEX");
    }
    if (current === null || typeof current === "string" || typeof current === "boolean") return;
    if (typeof current === "number") {
      if (!Number.isFinite(current)) throw new GameRelayError("The browser JSON payload is invalid.", 422, "GAME_RELAY_PAYLOAD_INVALID");
      return;
    }
    if (typeof current !== "object" || ancestors.has(current)) {
      throw new GameRelayError("The browser JSON payload is invalid.", 422, "GAME_RELAY_PAYLOAD_INVALID");
    }
    ancestors.add(current);
    for (const [key, child] of Object.entries(current)) {
      if (FORBIDDEN_KEYS.has(key)) {
        throw new GameRelayError("The browser JSON payload is invalid.", 422, "GAME_RELAY_PAYLOAD_INVALID");
      }
      visit(child, depth + 1);
    }
    ancestors.delete(current);
  };
  visit(value, 0);
}

function assertProtocolVersion(payload: Record<string, unknown>): void {
  if (payload.protocolVersion !== GAME_RELAY_PROTOCOL_VERSION) {
    throw new GameRelayError("The browser relay protocol version is unsupported.", 422, "GAME_RELAY_PROTOCOL_UNSUPPORTED");
  }
}

function assertExactKeys(value: Record<string, unknown>, keys: string[]): void {
  if (!exactRecordKeys(value, keys)) {
    throw new GameRelayError("The browser message shape is invalid.", 422, "GAME_RELAY_MESSAGE_INVALID");
  }
}

function assertAllowedKeys(value: Record<string, unknown>, keys: string[]): void {
  if (Object.keys(value).some((key) => !keys.includes(key))) {
    throw new GameRelayError("The browser message shape is invalid.", 422, "GAME_RELAY_MESSAGE_INVALID");
  }
}

function exactRecordKeys(value: Record<string, unknown>, keys: string[], optional: string[] = []): boolean {
  const actual = Object.keys(value);
  return actual.every((key) => keys.includes(key))
    && keys.every((key) => optional.includes(key) || actual.includes(key));
}

function requiredPattern(
  value: unknown,
  pattern: RegExp,
  maxLength: number,
  code: string
): string {
  const normalized = stringMatching(value, pattern, maxLength);
  if (!normalized) throw new GameRelayError("A browser message field is invalid.", 422, code);
  return normalized;
}

function optionalPattern(value: unknown, pattern: RegExp, maxLength: number): string {
  return value === undefined ? "" : requiredPattern(value, pattern, maxLength, "GAME_RELAY_MESSAGE_INVALID");
}

function stringMatching(value: unknown, pattern: RegExp, maxLength: number): string {
  if (typeof value !== "string" || !value || value.length > maxLength || !pattern.test(value)) return "";
  return value;
}

function normalizedRevision(value: unknown): number | null {
  return Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= MAX_REVISION
    ? Number(value)
    : null;
}

function optionalBoundedString(value: unknown, maxLength: number): string | undefined | null {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length > maxLength || utf8Bytes(value) > maxLength * 4) {
    return null;
  }
  return value;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (isPlainRecord(value)) {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${canonicalJson(value[key])}`
    )).join(",")}}`;
  }
  return JSON.stringify(value);
}

function randomToken(): string {
  return crypto.randomUUID().replaceAll("-", "");
}

function utf8Bytes(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function relayJson(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

function invalidBody(): Response {
  return relayJson({ error: "The relay request body is invalid.", code: "GAME_RELAY_BODY_INVALID" }, 422);
}

function sessionUnavailable(): Response {
  return relayJson({ error: "The browser game relay is unavailable or expired.", code: "GAME_RELAY_SESSION_NOT_FOUND" }, 404);
}

function sessionDisconnected(): Response {
  return relayJson({ error: "The browser game is disconnected.", code: "GAME_BROWSER_DISCONNECTED" }, 409);
}
