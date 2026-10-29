import { WorkerEntrypoint } from "cloudflare:workers";
import { getOAuthApi } from "@cloudflare/workers-oauth-provider";
import { oauthProviderOptions } from "./index";
import { explicitOAuthAuthInfo, verifiedPrincipal } from "./article-tools";
import { assertPrivateOwner } from "./owner-identity";
import { assertActiveMcpOAuthGrant } from "../../../functions/api/mcp-oauth-ledger.mjs";

/** Binding-only RPC; no public fetch handler and no signing secrets exported. */
export class PrivateMcpVerifier extends WorkerEntrypoint<Env> {
 async verify(authorization: string) {
  try {
   if(typeof authorization !== "string" || authorization.length>4103) return {ok:false};
   const env={...this.env,OAUTH_PROVIDER:getOAuthApi(oauthProviderOptions,this.env)};
   const auth=await explicitOAuthAuthInfo(new Request("https://lusu575.com/mcp",{headers:{Authorization:authorization}}),env);
   const principal=verifiedPrincipal(auth);
   assertPrivateOwner(env,principal.userId);
   await assertActiveMcpOAuthGrant({env,principal,requiredScopes:[],requireAdmin:true});
   return {ok:true,principal};
  } catch { return {ok:false}; }
 }
}
