# Private MCP Pages adapter — approved rollout

The 51 registered backend operations can run in the existing Pages environment. Existing secrets remain there; no secret values are returned, copied, generated or rotated. Browser snapshots and real Kittens control keep their existing queue path. Article, video and game-relay implementations remain unchanged.

## Approved production differences

- Pages: add service binding PRIVATE_MCP_AUTH targeting existing lusu-site-admin-mcp, named entrypoint PrivateMcpVerifier.
- Pages: pin MCP_OWNER_USER_ID_SHA256 to the SHA-256 of the same user-confirmed stable administrator ID as the MCP Worker.
- MCP Worker: set PRIVATE_ADMIN_BACKEND=pages and deploy the new named verifier export alongside the existing public handler and GAME_RELAY export.
- Enable the fixed POST /api/private-mcp route through the normal Git/Pages release. It accepts only operation/input, not a target URL or caller-supplied identity.
- Previously proposed duplicate R2/whiteboard bindings and the five service secrets in the MCP Worker are unnecessary for this mode. Existing Pages bindings/secrets stay unchanged.

## Trust boundary

Pages receives the caller's existing OAuth Bearer token transiently and sends it over a binding-only RPC to the issuer Worker. This is a new persistent validation capability for Pages and requires explicit production confirmation. The verifier exports no public fetch handler, no secret getter and no token minting function. It reuses exact resource, expiry, token/grant scope consistency and active owner/admin/ledger checks. Pages rechecks the owner and the required operation scope/revocation in D1 immediately before dispatch. An untrusted header claiming an identity is never accepted. Cookies are not forwarded. The Worker calls only the fixed HTTPS endpoint, rejects redirects, and forwards no other headers. Pages limits bodies to 64 KiB and does not log tokens or request bodies.

## Local evidence

39 workerd tests pass, including real isolated OAuth issuance, binding-style loopback RPC, Pages endpoint, D1-backed chat write/read, missing/invalid token, injected principal rejection, missing scope, wrong owner/origin and revoked grant. Existing OAuth/resource/expiry tests remain in that suite. Five companion/MCP/snapshot regression tests pass. TypeScript, JS lint and build-check pass; two production builds matched. No production grant, content write or configuration changes were made for these tests.

## Rollout and rollback

Deploy the verifier export without enabling the backend mode; then configure the approved Pages binding/owner and deploy the endpoint; finally enable pages mode after authenticated isolated/local validation and allowed production health checks. Do not claim production authenticated acceptance without an existing appropriately scoped grant. Disable the new route/mode together on rollback and retain exact owner restriction; never turn a failed validation into a trusted principal. No secret rotation or room/ticket invalidation is necessary.

Approved rollout configuration: Pages pins SHA-256 of the confirmed stable owner ID (MCP_OWNER_USER_ID_SHA256) rather than publishing the raw account identifier in Git. The verifier still checks the exact ID. Preview has no verifier binding. This is an identity pin, not a credential.

## Production receipt (2026-10-29)

Code commit c1c3c10f5f65d6a1d3eb138ac92c96f78c414da3; Pages deployment 17f9ad3a-1ce9-4d83-832e-ee5dafbb5c0a. Verifier stage 81c55b0d-991e-4cb4-a82a-943a3f393dd1; final pages mode Worker 355575bb-0d9c-4bde-9578-1a73ccd09275 at 100% traffic. Production release smoke passed exact commit, home, health, sitemap, article and immutable asset digest. POST /api/private-mcp and /mcp reject anonymous requests (401); invalid bearer is rejected (401), GET private endpoint is 405. OAuth protected resource metadata is 200. No production authenticated grant was created or business data modified. CI: https://github.com/lusu575/lusu-personal-site/actions/runs/40854380112 (consult current result).
