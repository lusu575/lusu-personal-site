import type { OAuthHelpers } from "@cloudflare/workers-oauth-provider";

declare global {
  interface Env {
    MCP_OWNER_USER_ID?: string;
    PRIVATE_ADMIN_BACKEND?: "pages";
    /** Injected by OAuthProvider before it invokes protected/default handlers. */
    OAUTH_PROVIDER: OAuthHelpers;
  }
}

export {};
