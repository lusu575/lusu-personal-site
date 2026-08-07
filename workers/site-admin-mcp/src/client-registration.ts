import type {
  ClientRegistrationCallbackOptions,
  ClientRegistrationCallbackResult
} from "@cloudflare/workers-oauth-provider";

import { consumeMcpOAuthRegistrationLimit } from "../../../functions/api/mcp-oauth-ledger.mjs";
import {
  CLIENT_REGISTRATION_RATE_LIMIT,
  CLIENT_REGISTRATION_RATE_WINDOW_SECONDS
} from "./constants";
import { hmacSha256Hex } from "./security";

const RATE_PREFIX = "mcp-dcr-rate:";
export const MAX_CLIENT_REGISTRATION_BYTES = 12 * 1024;
const MAX_METADATA_FIELDS = 16;
const MAX_REDIRECT_URIS = 4;
const MAX_REDIRECT_URI_CHARS = 2_048;
const ALLOWED_METADATA_FIELDS = new Set([
  "application_type",
  "client_name",
  "client_uri",
  "contacts",
  "grant_types",
  "logo_uri",
  "policy_uri",
  "redirect_uris",
  "response_types",
  "scope",
  "software_id",
  "software_version",
  "token_endpoint_auth_method",
  "tos_uri"
]);
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export async function validateClientRegistration(
  options: ClientRegistrationCallbackOptions,
  _env: Env
): Promise<ClientRegistrationCallbackResult | void> {
  const metadata = options.clientMetadata;
  const keys = Object.keys(metadata);
  if (Object.prototype.hasOwnProperty.call(metadata, "software_statement")) {
    return {
      code: "invalid_software_statement",
      description: "Unverified software statements are not accepted.",
      status: 400
    };
  }
  if (keys.length > MAX_METADATA_FIELDS
    || keys.some((key) => !ALLOWED_METADATA_FIELDS.has(key))) {
    return reject("Client metadata contains unsupported fields.");
  }
  if (new TextEncoder().encode(JSON.stringify(metadata)).byteLength
    > MAX_CLIENT_REGISTRATION_BYTES) {
    return reject("Client metadata is too large.");
  }

  const clientName = metadata.client_name;
  if (clientName !== undefined
    && (typeof clientName !== "string"
      || !clientName.trim()
      || clientName.length > 120
      || /[\u0000-\u001f\u007f]/.test(clientName))) {
    return reject("client_name must contain 1 to 120 characters.");
  }
  if (metadata.token_endpoint_auth_method !== "none") {
    return reject("Only public PKCE clients using token_endpoint_auth_method=none may register.");
  }
  const grantTypes = metadata.grant_types === undefined
    ? ["authorization_code"]
    : metadata.grant_types;
  if (!isExactStringSet(grantTypes, ["authorization_code", "refresh_token"])
    && !isExactStringSet(grantTypes, ["authorization_code"])) {
    return reject("Only the authorization_code grant, with optional refresh_token, is supported.");
  }
  const responseTypes = metadata.response_types === undefined ? ["code"] : metadata.response_types;
  if (!isExactStringSet(responseTypes, ["code"])) {
    return reject("response_types must be exactly [\"code\"].");
  }
  if (metadata.application_type !== undefined
    && metadata.application_type !== "native"
    && metadata.application_type !== "web") {
    return reject("application_type must be native or web.");
  }
  if (metadata.scope !== undefined
    && (typeof metadata.scope !== "string" || metadata.scope.length > 256)) {
    return reject("scope metadata is invalid.");
  }
  if (!boundedOptionalString(metadata.software_id, 128)
    || !boundedOptionalString(metadata.software_version, 64)) {
    return reject("Software metadata is invalid.");
  }
  if (!boundedContacts(metadata.contacts)) {
    return reject("contacts metadata is invalid.");
  }
  for (const field of ["client_uri", "logo_uri", "policy_uri", "tos_uri"] as const) {
    if (!boundedOptionalHttpsUri(metadata[field])) {
      return reject(`${field} must be an HTTPS URL no longer than ${MAX_REDIRECT_URI_CHARS} characters.`);
    }
  }

  if (!Array.isArray(metadata.redirect_uris)
    || metadata.redirect_uris.length < 1
    || metadata.redirect_uris.length > MAX_REDIRECT_URIS) {
    return reject(`redirect_uris must contain between 1 and ${MAX_REDIRECT_URIS} entries.`);
  }
  for (const value of metadata.redirect_uris) {
    if (typeof value !== "string" || !validRedirectUri(value)) {
      return reject("Each redirect URI must use HTTPS, except HTTP loopback callbacks.");
    }
  }
}

export async function consumeClientRegistrationAttempt(
  request: Request,
  env: Env
): Promise<boolean> {
  const rawIp = String(request.headers.get("CF-Connecting-IP") || "unavailable").slice(0, 128);
  const ipHash = await hmacSha256Hex(env.ANALYTICS_IP_HASH_SALT, rawIp);
  const nowMs = Date.now();
  const windowMs = CLIENT_REGISTRATION_RATE_WINDOW_SECONDS * 1_000;
  const windowNumber = Math.floor(nowMs / windowMs);
  const { allowed } = await consumeMcpOAuthRegistrationLimit({
    env,
    bucketKey: `${RATE_PREFIX}${windowNumber}:${ipHash}`,
    limit: CLIENT_REGISTRATION_RATE_LIMIT,
    now: new Date(nowMs).toISOString(),
    expiresAt: new Date((windowNumber + 1) * windowMs + 120_000).toISOString()
  });
  return allowed;
}

function validRedirectUri(value: string): boolean {
  if (value.length > MAX_REDIRECT_URI_CHARS) return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.username || url.password || url.hash || !url.hostname) return false;
  if (url.protocol === "https:") return true;
  return url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname);
}

function boundedOptionalHttpsUri(value: unknown): boolean {
  if (value === undefined) return true;
  if (typeof value !== "string" || value.length > MAX_REDIRECT_URI_CHARS) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.hash && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function boundedOptionalString(value: unknown, limit: number): boolean {
  return value === undefined || (typeof value === "string" && value.length <= limit);
}

function boundedContacts(value: unknown): boolean {
  return value === undefined || (Array.isArray(value)
    && value.length <= 3
    && value.every((item) => typeof item === "string" && item.length <= 320));
}

function isExactStringSet(value: unknown, expected: string[]): boolean {
  return Array.isArray(value)
    && value.length === expected.length
    && value.every((item) => typeof item === "string" && expected.includes(item))
    && new Set(value).size === value.length;
}

function reject(description: string): ClientRegistrationCallbackResult {
  return { code: "invalid_client_metadata", description, status: 400 };
}
