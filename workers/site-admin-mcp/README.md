# LuSu site owner remote MCP

This independent Cloudflare Worker exposes the site's public read tools plus owner-only article management over stateless Streamable HTTP at `https://lusu575.com/mcp`.

It is intentionally not deployable from the checked-in configuration yet: `wrangler.jsonc` contains a fail-closed placeholder for `OAUTH_KV`. Create the production namespace and secret first. Never replace the placeholder with a secret; a KV namespace ID is public configuration.

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

## Production provisioning

From this directory, while authenticated to the correct Cloudflare account:

```powershell
npm.cmd install
npx.cmd wrangler kv namespace create OAUTH_KV
```

Replace only the all-zero `OAUTH_KV` ID in `wrangler.jsonc` with the returned production namespace ID. Do not run `wrangler secret put` during first activation: that command can create and immediately deploy a Worker version before the release gates and valid KV binding are in place.

Then validate locally and complete the dry run before running the production D1 migration from the repository root:

```powershell
npm.cmd run check
npm.cmd run deploy:preflight
npm.cmd run deploy:dry-run

Set-Location ..\..
npm.cmd run d1:migrate:remote
Set-Location .\workers\site-admin-mcp
```

For the first activation, generate a new high-entropy secret into a uniquely named file outside the repository and supply it only to the final deployment. The `finally` block removes that exact temporary file even if deployment fails:

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

Use a purpose-specific value for `ANALYTICS_IP_HASH_SALT`; do not reuse an application password, print it, or commit it. Later reviewed deployments may use `npm.cmd run deploy` and retain the existing secret; rotate it only as a deliberate security operation. `deploy` and the first-activation flow are blocked until the KV placeholder is replaced. The Worker uses query-safe same-host routes plus an exact internal pathname allowlist, so the public Pages deployment continues serving every other path.

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
