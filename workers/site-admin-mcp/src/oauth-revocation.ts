import type { OAuthHelpers } from "@cloudflare/workers-oauth-provider";

import {
  completeMcpOAuthRevocationIntent,
  createMcpOAuthRevocationIntent,
  findMcpOAuthRevocationIntent
} from "../../../functions/api/mcp-oauth-ledger.mjs";
import { MCP_RESOURCE, TOKEN_PATH } from "./constants";
import { jsonResponse, readBoundedForm, sha256Hex } from "./security";

const MAX_TOKEN_FORM_BYTES = 16 * 1024;
const TOKEN_PART_PATTERN = /^[A-Za-z0-9_-]{1,256}$/;
const GRANT_REF_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

type ProviderGrantRecord = {
  id: string;
  userId: string;
  clientId: string;
  metadata: {
    grantRef: string;
    resource: string;
  };
  refreshTokenId?: string;
  previousRefreshTokenId?: string;
};

type RevocationIntent = {
  eventId: string;
  grantRef: string;
  result: string;
  alreadyRevoked?: boolean;
};

export async function handleOAuthRevocationWithLedgerSync({
  request,
  env,
  oauthApi,
  providerFetch
}: {
  request: Request;
  env: Env;
  oauthApi: OAuthHelpers;
  providerFetch: () => Promise<Response>;
}): Promise<Response | null> {
  const url = new URL(request.url);
  if (request.method !== "POST" || url.pathname !== TOKEN_PATH) return null;

  const form = await readBoundedForm(request.clone(), MAX_TOKEN_FORM_BYTES);
  if (String(form.get("grant_type") || "")) return null;
  const token = String(form.get("token") || "");
  if (!token) return null;
  const clientId = String(form.get("client_id") || "");
  const tokenParts = parseProviderToken(token);
  if (!tokenParts || !clientId || clientId.length > 2048) {
    return providerFetch();
  }

  const tokenHash = await sha256Hex(token);
  let intent: RevocationIntent | null;
  try {
    intent = await findMcpOAuthRevocationIntent({
      env,
      userId: tokenParts.userId,
      clientId,
      providerGrantId: tokenParts.providerGrantId,
      tokenRefHash: tokenHash
    }) as RevocationIntent | null;
  } catch {
    return revocationSyncError(request);
  }

  if (!intent) {
    // The public provider API positively identifies access tokens. Even with a
    // missing or misleading token_type_hint, revoking one access token must not
    // create a whole-grant D1 revocation intent.
    try {
      if (await oauthApi.unwrapToken(token)) {
        return providerFetch();
      }
      const providerGrant = await readProviderGrant(env, tokenParts);
      if (!providerGrant
        || providerGrant.clientId !== clientId
        || providerGrant.userId !== tokenParts.userId
        || providerGrant.id !== tokenParts.providerGrantId
        || providerGrant.metadata.resource !== MCP_RESOURCE
        || !GRANT_REF_PATTERN.test(providerGrant.metadata.grantRef)
        || (providerGrant.refreshTokenId !== tokenHash
          && providerGrant.previousRefreshTokenId !== tokenHash)) {
        return providerFetch();
      }
      intent = await createMcpOAuthRevocationIntent({
        env,
        grantRef: providerGrant.metadata.grantRef,
        userId: tokenParts.userId,
        clientId,
        providerGrantId: tokenParts.providerGrantId,
        tokenRefHash: tokenHash
      }) as RevocationIntent;
    } catch {
      return revocationSyncError(request);
    }
  }

  const response = await providerFetch();
  if (!response.ok) return response;
  try {
    // RFC 7009 intentionally returns 200 for an invalid token. A concurrent
    // refresh rotation can therefore make providerFetch() a successful no-op
    // after the exact refresh-token hash was verified above. The verified D1
    // intent is the linearization point; explicitly deleting the whole grant
    // confirms the provider side before D1 is allowed to report revocation.
    await oauthApi.revokeGrant(tokenParts.providerGrantId, tokenParts.userId);
    if (!intent.alreadyRevoked && intent.result !== "success") {
      await completeMcpOAuthRevocationIntent({
        env,
        grantRef: intent.grantRef,
        eventId: intent.eventId,
        reason: "rfc7009-refresh-token"
      });
    }
    return response;
  } catch {
    return revocationSyncError(request, response.headers);
  }
}

function parseProviderToken(token: string): { userId: string; providerGrantId: string } | null {
  const parts = token.split(":");
  if (parts.length !== 3
    || !TOKEN_PART_PATTERN.test(parts[0])
    || !TOKEN_PART_PATTERN.test(parts[1])) {
    return null;
  }
  return { userId: parts[0], providerGrantId: parts[1] };
}

async function readProviderGrant(
  env: Env,
  tokenParts: { userId: string; providerGrantId: string }
): Promise<ProviderGrantRecord | null> {
  const value = await env.OAUTH_KV.get<unknown>(
    `grant:${tokenParts.userId}:${tokenParts.providerGrantId}`,
    "json"
  );
  if (!value || typeof value !== "object") return null;
  const grant = value as Partial<ProviderGrantRecord>;
  if (typeof grant.id !== "string"
    || typeof grant.userId !== "string"
    || typeof grant.clientId !== "string"
    || !grant.metadata
    || typeof grant.metadata.grantRef !== "string"
    || typeof grant.metadata.resource !== "string"
    || (grant.refreshTokenId !== undefined && typeof grant.refreshTokenId !== "string")
    || (grant.previousRefreshTokenId !== undefined
      && typeof grant.previousRefreshTokenId !== "string")) {
    return null;
  }
  return grant as ProviderGrantRecord;
}

function revocationSyncError(request: Request, providerHeaders?: Headers): Response {
  const response = jsonResponse({
    error: "server_error",
    error_description: "The authorization ledger could not be synchronized.",
    code: "OAUTH_REVOCATION_LEDGER_SYNC_FAILED"
  }, 503);
  response.headers.set("Retry-After", "1");
  for (const name of [
    "Access-Control-Allow-Credentials",
    "Access-Control-Allow-Origin",
    "Access-Control-Expose-Headers",
    "Vary"
  ]) {
    const value = providerHeaders?.get(name);
    if (value) response.headers.set(name, value);
  }
  const origin = request.headers.get("Origin");
  if (origin && !response.headers.has("Access-Control-Allow-Origin")) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Methods", "*");
    response.headers.set("Access-Control-Allow-Headers", "Authorization, *");
    response.headers.set("Access-Control-Max-Age", "86400");
  }
  const exposed = new Set(
    String(response.headers.get("Access-Control-Expose-Headers") || "")
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean)
  );
  exposed.add("WWW-Authenticate");
  exposed.add("Retry-After");
  response.headers.set("Access-Control-Expose-Headers", [...exposed].join(", "));
  return response;
}
