import type { OAuthHelpers } from "@cloudflare/workers-oauth-provider";

declare global {
  interface Env {
    /** Injected by OAuthProvider before it invokes protected/default handlers. */
    OAUTH_PROVIDER: OAuthHelpers;
  }
}

export {};
