import { requireOwnerSession } from "./auth-handler";
import {
  GameRelayError,
  parsePairingProtocol,
  relayBrowserUpgrade
} from "./game-relay";
import { WorkerHttpError } from "./security";

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export async function handleBrowserGameRelayRequest(
  request: Request,
  env: Env
): Promise<Response> {
  if (request.method !== "GET") {
    throw new WorkerHttpError("WebSocket upgrade required.", 405, "GAME_RELAY_METHOD_REJECTED");
  }
  const url = new URL(request.url);
  const origin = request.headers.get("Origin");
  if (!origin || !browserOriginAllowed(url, origin)) {
    throw new WorkerHttpError("The browser game Origin is not trusted.", 403, "GAME_RELAY_ORIGIN_REJECTED");
  }
  const fetchSite = String(request.headers.get("Sec-Fetch-Site") || "").trim().toLowerCase();
  if (fetchSite && fetchSite !== "same-origin") {
    throw new WorkerHttpError("The browser game request is not same-origin.", 403, "GAME_RELAY_FETCH_SITE_REJECTED");
  }
  if (request.headers.get("Upgrade")?.trim().toLowerCase() !== "websocket") {
    throw new WorkerHttpError("WebSocket upgrade required.", 426, "GAME_RELAY_UPGRADE_REQUIRED");
  }
  const websocketVersion = String(request.headers.get("Sec-WebSocket-Version") || "").trim();
  if (websocketVersion && websocketVersion !== "13") {
    throw new WorkerHttpError("The WebSocket version is unsupported.", 426, "GAME_RELAY_WEBSOCKET_VERSION_REJECTED");
  }
  let pairingCode: string;
  try {
    pairingCode = parsePairingProtocol(request.headers.get("Sec-WebSocket-Protocol"));
  } catch (error) {
    if (error instanceof GameRelayError) {
      throw new WorkerHttpError(error.message, error.status, error.code);
    }
    throw error;
  }
  const session = await requireOwnerSession(request, env);
  return relayBrowserUpgrade(env, request, session.user.id, pairingCode);
}

function browserOriginAllowed(requestUrl: URL, origin: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }
  if (requestUrl.protocol === "https:"
    && requestUrl.hostname === "lusu575.com"
    && requestUrl.port === "") {
    return parsed.origin === "https://lusu575.com";
  }
  return LOCAL_HOSTNAMES.has(requestUrl.hostname)
    && parsed.origin === requestUrl.origin
    && (parsed.protocol === "http:" || parsed.protocol === "https:");
}
