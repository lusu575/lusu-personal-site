# LuSu site owner remote MCP

This independent Cloudflare Worker exposes the site's public read tools plus owner-only article management over stateless Streamable HTTP at `https://lusu575.com/mcp`.

## Production state

The production Worker `lusu-site-admin-mcp` is deployed. Version `fa295db6-302a-4a20-a2b1-ffe1ddafd75b` completed real owner-browser OAuth acceptance on 2026-08-09, and the canonical resource is live at `https://lusu575.com/mcp`. The production `OAUTH_KV` namespace is bound, and the Production D1 migration is complete. Online smoke checks have passed for protected-resource and authorization-server metadata, Dynamic Client Registration, the unauthenticated `401 WWW-Authenticate` challenge, rejected browser origins, and rejected non-allowlisted paths.

For that exact bundle, the owner reviewed the OAuth page in a normal top-level browser and clicked Allow. Acceptance verified all nine tools, four public capabilities, atomic publish, same-payload replay, management list/get, CAS update, zh/en/ja public readback, confirmed delete, three-language 404 readback, and grant revocation; the temporary article was deleted. This acceptance is bundle-specific: every new production Worker bundle must repeat the real browser OAuth and the same complete lifecycle, never reuse historical acceptance as current evidence. Whole-site remote MCP and browser-game pairing/control remain outside the implemented boundary.

## What another AI connects to

Give a remote-MCP-capable AI client this server URL:

```text
https://lusu575.com/mcp
```

The client should discover OAuth metadata from the same host, identify itself with a Client ID Metadata Document (CIMD) when supported (DCR remains available for compatibility), open the browser authorization page, and send the exact RFC 8707 resource `https://lusu575.com/mcp` during both authorization and token issuance. The browser must already have the site's `lusu_session` owner login cookie. The consent page shows the client, callback, resource, and every requested permission in Chinese, English, and Japanese.

Scopes:

- `content:read`: public capabilities and published article retrieval. This baseline is always included.
- `content:write`: list/get managed articles, atomic trilingual publish, and CAS update.
- `content:delete`: confirmed, idempotent, CAS-protected permanent deletion.

All tools remain visible so a client can perform incremental authorization. Each tool advertises `_meta.securitySchemes`; an insufficient grant returns `_meta["mcp/www_authenticate"]` with the exact required scope. Publishing uses the shared article service and requires an `operationId`; there is no separate MCP-only business implementation.

The production MCP exposes exactly nine tools:

| Tool | Required scope | Boundary |
| --- | --- | --- |
| `site_capabilities` | `content:read` | Bounded read-only remote capability discovery. |
| `content_list` | `content:read` | Bounded published-article summaries; Daily AI News is selected by category. |
| `content_search` | `content:read` | Bounded search over published summaries. |
| `article_get` | `content:read` | One published article by public slug. |
| `article_manage_list` | `content:write` | Read-only operation over private management metadata. |
| `article_manage_get` | `content:write` | Read-only operation over one managed article and its translations. |
| `article_publish` | `content:write` | Atomic trilingual publish with a unique `operationId`. |
| `article_update` | `content:write` | Destructive-annotated CAS update with `expectedUpdatedAt` and `operationId`. |
| `article_delete` | `content:delete` | Permanent deletion with CAS, a unique `operationId`, and literal `confirm: true`. |

Keep client-side tool approval enabled for all mutations. The service-side scopes, active-admin recheck, CAS, idempotency, and delete confirmation are mandatory safeguards, but they do not replace a human review of publish/update/delete arguments.

## Reviewed redeploy and recovery

From this directory, while authenticated to the correct Cloudflare account:

```powershell
npm.cmd install
```

The checked-in `OAUTH_KV` ID is the existing production namespace. Do not create a second namespace during routine deploys. Disaster recovery or a separate environment must use its own namespace and reviewed config change. Do not use `wrangler secret put` as a shortcut around release gates: that command can create and immediately deploy a Worker version before the intended reviewed release.

Validate locally and complete the dry run before any reviewed redeploy. Run the remote migration only when the release actually contains a new approved Production D1 change; the migration used by accepted version `fa295db6-302a-4a20-a2b1-ffe1ddafd75b` has already completed.

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
- RFC 7009 revocation is served by the provider on `/oauth/token`.
- Persistent Worker observability stays disabled so OAuth authorization queries and state are not retained by platform request logs; the query-safe routes are narrowed again by an exact pathname allowlist in code.

## Local verification

Worker tests use Cloudflare's Vitest pool and local D1/KV bindings, including a complete authorization-to-article lifecycle and concurrent registration limiter:

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd audit --audit-level=moderate
```

Do not commit `.wrangler/`, `.wrangler-config/`, local logs, tokens, or consent/session cookies.
