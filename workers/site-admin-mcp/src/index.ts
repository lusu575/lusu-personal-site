import {
  OAuthProvider,
  type OAuthProviderOptions
} from "@cloudflare/workers-oauth-provider";

import { oauthDefaultHandler } from "./auth-handler";
import { oauthApiHandler } from "./article-tools";
import { handleBrowserGameRelayRequest } from "./browser-game-handler";
import {
  MAX_CLIENT_REGISTRATION_BYTES,
  consumeClientRegistrationAttempt,
  validateClientRegistration
} from "./client-registration";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  AUTHORIZE_PATH,
  CANONICAL_ISSUER,
  CLIENT_REGISTRATION_TTL_SECONDS,
  GAME_RELAY_PATH,
  MCP_PATH,
  MCP_RESOURCE,
  OWNER_SCOPES,
  REFRESH_TOKEN_TTL_SECONDS,
  REGISTER_PATH,
  TOKEN_PATH
} from "./constants";
import { validateExplicitTokenResource } from "./oauth-policy";
import {
  WorkerHttpError,
  assertTrustedRequestBoundary,
  jsonResponse,
  readBoundedText,
  safeErrorCode
} from "./security";

const ROUTED_PATHS = new Set([
  MCP_PATH,
  AUTHORIZE_PATH,
  TOKEN_PATH,
  REGISTER_PATH,
  "/.well-known/oauth-authorization-server",
  "/.well-known/oauth-protected-resource",
  "/.well-known/oauth-protected-resource/mcp"
]);

export const oauthProviderOptions = {
  apiRoute: MCP_PATH,
  apiHandler: oauthApiHandler,
  defaultHandler: oauthDefaultHandler,
  authorizeEndpoint: AUTHORIZE_PATH,
  tokenEndpoint: TOKEN_PATH,
  clientRegistrationEndpoint: REGISTER_PATH,
  accessTokenTTL: ACCESS_TOKEN_TTL_SECONDS,
  refreshTokenTTL: REFRESH_TOKEN_TTL_SECONDS,
  clientRegistrationTTL: CLIENT_REGISTRATION_TTL_SECONDS,
  scopesSupported: [...OWNER_SCOPES],
  resourceMetadata: {
    resource: MCP_RESOURCE,
    authorization_servers: [CANONICAL_ISSUER],
    scopes_supported: [...OWNER_SCOPES],
    bearer_methods_supported: ["header"],
    resource_name: "LuSu site owner MCP"
  },
  clientIdMetadataDocumentEnabled: true,
  disallowPublicClientRegistration: false,
  allowPlainPKCE: false,
  allowImplicitFlow: false,
  allowTokenExchangeGrant: false,
  onError(error) {
    console.warn(JSON.stringify({
      service: "lusu-site-admin-mcp",
      event: "oauth_provider_error",
      code: error.code,
      status: error.status,
      category: error.internal?.category || ""
    }));
  }
} satisfies OAuthProviderOptions<Env>;

export function createOAuthProvider(env: Env): OAuthProvider<Env> {
  return new OAuthProvider<Env>({
    ...oauthProviderOptions,
    clientRegistrationCallback: (options) => validateClientRegistration(options, env)
  });
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      assertTrustedRequestBoundary(request);
      const pathname = new URL(request.url).pathname;
      if (pathname === GAME_RELAY_PATH) {
        return await handleBrowserGameRelayRequest(request, env);
      }
      if (!ROUTED_PATHS.has(pathname)) {
        return jsonResponse({ error: "Not found.", code: "NOT_FOUND" }, 404);
      }
      const providerRequest = pathname === REGISTER_PATH && request.method === "POST"
        ? await prepareClientRegistrationRequest(request, env)
        : request;
      if (providerRequest instanceof Response) return providerRequest;
      const tokenPolicyResponse = await validateExplicitTokenResource(providerRequest);
      if (tokenPolicyResponse) return tokenPolicyResponse;
      return await createOAuthProvider(env).fetch(providerRequest, env, ctx);
    } catch (error) {
      const status = error instanceof WorkerHttpError ? error.status : 500;
      const code = error instanceof WorkerHttpError ? error.code : "INTERNAL_ERROR";
      console.error(JSON.stringify({
        service: "lusu-site-admin-mcp",
        event: "worker_request_rejected",
        code: safeErrorCode(error),
        status
      }));
      return jsonResponse({
        error: status === 500 ? "Internal server error." : error instanceof WorkerHttpError
          ? error.message
          : "Internal server error.",
        code
      }, status);
    }
  }
} satisfies ExportedHandler<Env>;

async function prepareClientRegistrationRequest(
  request: Request,
  env: Env
): Promise<Request | Response> {
  const allowed = await consumeClientRegistrationAttempt(request, env);
  if (!allowed) {
    return jsonResponse({
      error: "slow_down",
      error_description: "Too many client registration attempts. Try again later."
    }, 429);
  }

  // The provider parses the body before its registration callback. Bound and
  // rebuild it here so malformed JSON and chunked bodies cannot bypass either
  // the atomic attempt budget or the memory limit.
  const body = await readBoundedText(request, MAX_CLIENT_REGISTRATION_BYTES);
  const headers = new Headers(request.headers);
  headers.delete("Content-Length");
  return new Request(request.url, {
    method: request.method,
    headers,
    body
  });
}

export default worker;
export { GameRelaySession } from "./game-relay";
