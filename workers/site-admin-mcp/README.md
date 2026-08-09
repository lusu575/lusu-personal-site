# LuSu site owner remote MCP

This independent Cloudflare Worker exposes public reads plus owner-only article, external-video, and browser-game tools over stateless Streamable HTTP at `https://lusu575.com/mcp`.

## Production state

The production Worker `lusu-site-admin-mcp` is deployed. The exact current version is `377d494b-8f90-40ad-998f-863d209e1978`, and the canonical resource is live at `https://lusu575.com/mcp`. The production `OAUTH_KV` namespace is bound, and the Production D1 migration is complete. Online smoke checks have passed for protected-resource and authorization-server metadata, Dynamic Client Registration, the unauthenticated `401 WWW-Authenticate` challenge, rejected browser origins, and rejected non-allowlisted paths.

Historical version `fa295db6-302a-4a20-a2b1-ffe1ddafd75b` retains the accepted nine-tool article lifecycle. Current version `377d...` completed external-video production acceptance with `OpwviOTPYTU`: publish, same-`operationId` replay, owner/public MCP and public HTTP readback, metadata refresh, CAS hide, confirmed delete, final absence, and RFC 7009 revocation passed, and the temporary record was removed. Every acceptance result is exact-bundle evidence; every new production Worker must repeat the applicable real-browser OAuth and lifecycle.

## Current game and external-video surface

The canonical endpoint's `tools/list` exposes exactly 23 tools: nine article tools, eight external-video tools, and six browser-game tools. `site_capabilities` still returns only the four promoted article-read capabilities. Video `availableTransports` does not yet include `remote-mcp`, and game `availableTransports` remains empty; tool presence must not be misrepresented as final availability promotion.

Browser-game tools are `game_browser_pair`, `game_browser_observe`, `game_browser_actions`, `game_browser_act`, `game_browser_pause`, and `game_browser_close`. They require the non-default `games:play` scope, an active grant, a current administrator recheck, an explicit one-time owner/client-bound pairing code, and revision CAS. The relay accepts only opaque `actionId` values offered by the current semantic snapshot; selectors, scripts, raw keys, coordinates, URLs, screenshots, and DOM access are outside the protocol. Only one command may be pending, and the browser player retains visible lock, pause, take-back, close, and disconnect-unlock controls. Production 2048 smoke exposed an idle disconnect after pause. The exact eight-second Pages `ping`/`pong` heartbeat is live and its bytes are verified, but a real Chrome tab still disconnected after roughly five minutes of background timer throttling. Current production Worker `377d...` does not contain the next paused-observe fix, so four-game acceptance remains pending.

The undeployed Worker candidate changes only authenticated, owner/grant-bound `game_browser_observe` while the relay is `paused`: it requires an existing browser socket, sends exact raw text `pong` to that socket, marks the relay disconnected on absence/send failure, then only touches `lastControllerAt`, persists relay state, and returns the cached paused snapshot. It does not update `lastBrowserAt`, read the provider, create an observation, execute an action, change revision, add a protocol message type, or resume the AI. Keepalive exists only while the controller continues paused observe calls: the production acceptance helper uses a 1.5–10 second interval and the client contract must not exceed 20 seconds. There is no server timer or promise of permanent keepalive after polling stops; only browser `user_resume` can resume control. This candidate is neither deployed nor accepted and must receive a new exact Worker version before any production claim.

The corresponding semantic browser bridges currently cover 2048, Hextris, A Dark Room, and Life Restart. Kittens Game remains `NO_AGENT` because the WET PAWS LICENSE requires explicit permission or legal confirmation before any control bridge is added. Registry entries for remote pairing/control intentionally keep empty `availableTransports` until production acceptance.

Public `videos_list` and `video_get` reads plus owner-only `video_manage_list`, `video_manage_get`, `video_publish`, `video_update`, `video_refresh_metadata`, and `video_delete` are deployed in the current Worker and passed the exact-bundle lifecycle above. Phase one handles only YouTube, Bilibili, and b23.tv external-link records. Publish/update/delete use active-admin rechecks, audit records, durable `operationId` receipts, and canonical payload hashes; update/delete require `expectedUpdatedAt`, while delete also requires literal `confirm: true`. The remote MCP never reads local paths, Base64, raw video bytes, or files from the AI client's machine. True hosted upload is not configured; a future upload phase requires a separate private R2 binary data plane with bounded multipart, quotas, scanning, commit, abort, expiry, and orphan cleanup.

## What another AI connects to

Give a remote-MCP-capable AI client this server URL:

```text
https://lusu575.com/mcp
```

The client should discover OAuth metadata from the same host, identify itself with a Client ID Metadata Document (CIMD) when supported (DCR remains available for compatibility), open the browser authorization page, and send the exact RFC 8707 resource `https://lusu575.com/mcp` during both authorization and token issuance. The browser must already have the site's `lusu_session` owner login cookie. The consent page shows the client, callback, resource, and every requested permission in Chinese, English, and Japanese.

Scopes:

- `content:read`: public capabilities plus published article and external-video retrieval. This baseline is always included.
- `content:write`: list/get managed articles or video records, atomic publish, CAS update, and bounded video metadata refresh.
- `content:delete`: confirmed, idempotent, CAS-protected permanent article or video-record deletion.
- `games:play`: one-time browser pairing and bounded semantic observe/action/pause/close operations. It is non-default and remains production-candidate until four-game acceptance passes.

All tools remain visible so a client can perform incremental authorization. Each tool advertises `_meta.securitySchemes`; an insufficient grant returns `_meta["mcp/www_authenticate"]` with the exact required scope. Publishing uses the shared article service and requires an `operationId`; there is no separate MCP-only business implementation.

The production MCP exposes exactly 23 tools:

| Tool | Required scope | Boundary |
| --- | --- | --- |
| `site_capabilities` | `content:read` | Bounded read-only remote capability discovery. |
| `content_list` | `content:read` | Bounded published-article summaries; Daily AI News is selected by category. |
| `content_search` | `content:read` | Bounded search over published summaries. |
| `article_get` | `content:read` | One published article by public slug. |
| `videos_list` | `content:read` | Bounded published external-video summaries. |
| `video_get` | `content:read` | One published external-video record. |
| `article_manage_list` | `content:write` | Read-only operation over private management metadata. |
| `article_manage_get` | `content:write` | Read-only operation over one managed article and its translations. |
| `article_publish` | `content:write` | Atomic trilingual publish with a unique `operationId`. |
| `article_update` | `content:write` | Destructive-annotated CAS update with `expectedUpdatedAt` and `operationId`. |
| `article_delete` | `content:delete` | Permanent deletion with CAS, a unique `operationId`, and literal `confirm: true`. |
| `video_manage_list` | `content:write` | Bounded private video-management summaries. |
| `video_manage_get` | `content:write` | One managed external-video record. |
| `video_publish` | `content:write` | Atomic external-video publish with a unique `operationId`. |
| `video_update` | `content:write` | CAS update with `expectedUpdatedAt` and `operationId`. |
| `video_refresh_metadata` | `content:write` | Bounded provider metadata refresh with persisted error state. |
| `video_delete` | `content:delete` | Confirmed CAS deletion with a unique `operationId`. |
| `game_browser_pair` | `games:play` | Redeem one owner/client-bound browser pairing code. |
| `game_browser_observe` | `games:play` | Read a bounded semantic snapshot and current revision. |
| `game_browser_actions` | `games:play` | Read current opaque semantic action tokens. |
| `game_browser_act` | `games:play` | Execute one revision-bound opaque action with receipt replay. |
| `game_browser_pause` | `games:play` | Pause AI control; only the owner browser may resume. |
| `game_browser_close` | `games:play` | Confirmed close and browser unlock. |

Keep client-side tool approval enabled for all mutations. The service-side scopes, active-admin recheck, CAS, idempotency, and delete confirmation are mandatory safeguards, but they do not replace a human review of publish/update/delete arguments.

## Reviewed redeploy and recovery

From this directory, while authenticated to the correct Cloudflare account:

```powershell
npm.cmd install
```

The checked-in `OAUTH_KV` ID is the existing production namespace. Do not create a second namespace during routine deploys. Disaster recovery or a separate environment must use its own namespace and reviewed config change. Do not use `wrangler secret put` as a shortcut around release gates: that command can create and immediately deploy a Worker version before the intended reviewed release.

Validate locally and complete the dry run before any reviewed redeploy. Run the remote migration only when the release actually contains a new approved Production D1 change; migrations required by current version `377d494b-8f90-40ad-998f-863d209e1978` have already completed. The Pages heartbeat is already live; the paused-observe downlink described above is a separate, undeployed Worker candidate and must not be attributed to `377d...`.

```powershell
npm.cmd run check
npm.cmd run deploy:preflight
npm.cmd run deploy:dry-run

# Only when this reviewed release contains an approved new Production D1 change:
Set-Location ..\..
npm.cmd run d1:migrate:remote
Set-Location .\workers\site-admin-mcp
```

For a separately provisioned environment or deliberate secret rotation, generate a new high-entropy secret into a uniquely named file outside the repository and supply it only to the final deployment. The `finally` block removes that exact temporary file even if deployment fails:

```powershell
$mcpSecretBytes = New-Object byte[] 32
$mcpRng = [Security.Cryptography.RandomNumberGenerator]::Create()
try {
  $mcpRng.GetBytes($mcpSecretBytes)
} finally {
  $mcpRng.Dispose()
}
$mcpSecretFile = Join-Path ([IO.Path]::GetTempPath()) ("lusu-owner-mcp-" + [guid]::NewGuid() + ".json")
$mcpSecretJson = @{ ANALYTICS_IP_HASH_SALT = [Convert]::ToBase64String($mcpSecretBytes) } | ConvertTo-Json -Compress
[IO.File]::WriteAllText($mcpSecretFile, $mcpSecretJson, [Text.UTF8Encoding]::new($false))
try {
  npx.cmd wrangler deploy --secrets-file $mcpSecretFile
  if ($LASTEXITCODE -ne 0) { throw "Owner MCP deployment failed." }
} finally {
  Remove-Item -LiteralPath $mcpSecretFile -Force -ErrorAction SilentlyContinue
}
```

Use a purpose-specific value for `ANALYTICS_IP_HASH_SALT`; do not reuse an application password, print it, or commit it. Routine reviewed deployments may use `npm.cmd run deploy` and retain the existing secret; rotate it only as a deliberate security operation. The Worker uses query-safe same-host routes plus an exact internal pathname allowlist, so the public Pages deployment continues serving every other path.

## OAuth policy

- OAuth 2.1 authorization code flow with mandatory PKCE S256.
- One exact resource on authorization and token issuance; wrong, missing, or multiple resources fail closed.
- One-hour access tokens, rotating refresh tokens with a 30-day TTL, and 90-day DCR records.
- Dynamic registrations are HMAC-IP rate limited with an atomic D1 UPSERT, accept at most four callbacks, require HTTPS except HTTP loopback callbacks, and reject unverified `software_statement` values. KV is reserved for short-lived OAuth state, consent flows, PKCE records, and provider storage.
- HTTP loopback callbacks (`localhost`, `127.0.0.1`, or `[::1]`) receive an extra warning on the consent page.
- Provider grants are backed by the D1 authorization ledger. Write/delete calls re-check the current admin role and active grant on every operation.
- The provider token is unwrapped through the provider's public API, then the Worker independently verifies expiry, the exact audience, client, granted scopes, and active D1 grant before creating MCP `authInfo`.
- Provider errors log only stable code/status/category fields. Tokens, cookies, raw IP addresses, callbacks, article bodies, and provider free-text reasons are not logged.
- RFC 7009 revocation is served on `/oauth/token`. Access-token-only revocation leaves the D1 grant active. For refresh tokens, the pinned provider grant record is read once by exact key to verify the current/previous token hash, then a grant-scoped deterministic `pending` intent is persisted in D1 before the provider deletes anything. After the RFC 7009 response succeeds, the Worker explicitly confirms an idempotent whole-grant deletion so a concurrent refresh rotation cannot turn the standard success into a no-op; only then does one D1 batch mark the grant revoked and complete the same audit event. Retries recover from the strong D1 intent rather than an eventually-consistent post-delete KV read. Raw tokens are never persisted.
- Persistent Worker observability stays disabled so OAuth authorization queries and state are not retained by platform request logs; the query-safe routes are narrowed again by an exact pathname allowlist in code.

## Local verification

Worker tests use Cloudflare's Vitest pool and local D1/KV bindings, including a complete authorization-to-article lifecycle and concurrent registration limiter:

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd audit --audit-level=moderate
```

Do not commit `.wrangler/`, `.wrangler-config/`, local logs, tokens, or consent/session cookies.
