# Owner-only Daily AI News MCP Worker

This Worker is the narrow publication bridge for the GPTWork Daily AI News
task. It is separate from the public read-only `workers/site-mcp/` service and
must be protected by a Cloudflare Access application using Managed OAuth and
an owner-only policy before it is deployed or connected to GPTWork.

The current implementation is an owner-confirmed interactive bridge, not an
unattended scheduled publisher. It validates the final article shape but cannot
yet prove that the complete Horizon/editorial run passed the repository
validator. Keep it disconnected from scheduled writes until the server can
validate the transient run package itself or verify a short-lived signed
attestation bound to the report date and exact trilingual content hashes.

The Worker exposes exactly one MCP tool:

- `publish_daily_ai_news`: publishes the final validated Chinese, English, and
  Japanese article for the current `Asia/Shanghai` report date.

The server controls the slug, category, publication status, tags, cover, pin
state, timestamps, and D1 binding. It also reads the existing dedicated channel
and requires both `enabled` and `auto_publish`. Identical retries return the
stored result; different content for the same report date fails with
`ARTICLE_CONFLICT`. A successful result requires exact zh/en/ja public API
readback of slug, category, status, language, title, summary, and body.

## Storage boundary

This service does not bind KV, R2, Durable Objects, Queues, or a new D1
database. It writes only one row to the existing `articles` table and three
rows to `article_translations`. It does not write delivery events, channel
usage, candidate packages, drafts, checkpoints, or deduplication caches.
Transient GPTWork research files are discarded at the end of each run.
The three public verification GETs identify their real cross-site Worker origin,
so the site's existing read-source gate does not create article-view events,
visitor profiles, or view-count increments for publication readback.

Failure logging contains only fixed service, operation, and error-code fields.
It does not persist application logs in D1, R2, or KV; Cloudflare Access and
platform-level security/request metadata remain governed by the platform's own
retention settings and must not be described as absolute zero storage.

Cloudflare Access configuration and platform request metadata are security
controls, not a news cache. Do not add application-level persistence without a
new owner decision.

## Authentication boundary

Direct Worker access fails closed. Every request must contain a valid
`Cf-Access-Jwt-Assertion` issued by the configured Cloudflare Access team. The
Worker verifies the signature, issuer, audience, and exact normalized owner
email before exposing `/health` or `/mcp`.

Configure these values outside source control:

- `TEAM_DOMAIN`: exact `https://<team>.cloudflareaccess.com` origin.
- `POLICY_AUD`: Access application audience tag.
- `OWNER_EMAIL`: the single account allowed to publish.
- `MCP_HOSTNAME`: the exact dedicated lowercase hostname accepted by the
  Worker. Requests with any browser `Origin` or a different Host are rejected.

Do not store values in this repository, task prompts, logs, or GPTWork files.
The Production D1 binding is the existing `lusu_personal_site` database.

## Local verification

Use Node.js 22.13 or newer:

```powershell
npm.cmd install
npm.cmd run check
npx.cmd wrangler deploy --dry-run
```

Vitest uses a local D1 database. Tests verify Access rejection, the one-tool
surface, strict input, the 07:00–08:00 window, atomic final-article writes,
identical replay, content conflict, and the absence of delivery-event or
channel-state writes. Do not use `--remote` for development tests.

The committed deployment target is `2026-08-07`. The currently pinned local
Vitest/workerd runtime supports dates only through `2026-07-29`, so
`vitest.config.mts` uses that date as a local test override. It does not change
the deployment target; remove the override once the pinned local runtime
supports the committed date.

## Production preparation

This order is required:

1. Create a dedicated hostname and a Cloudflare Access self-hosted application.
2. Enable Access Managed OAuth for the MCP application and restrict its policy
   to the owner account.
3. Configure `TEAM_DOMAIN`, `POLICY_AUD`, and `OWNER_EMAIL` outside Git.
   Configure the exact dedicated `MCP_HOSTNAME` at the same time.
4. Run the local checks and dependency audit.
5. Deploy the Worker, then verify unauthenticated rejection and authenticated
   owner access before connecting it to GPTWork.
6. Connect the MCP application for an owner-confirmed interactive test and
   verify tool discovery. Do not allow the scheduled task to call it yet.
7. Add and production-verify either server-side validation of the complete
   transient editorial run or a short-lived trusted attestation bound to the
   report date and exact zh/en/ja content hashes. Client assertions are not
   accepted.
8. Run an identical-replay test, verify the three public article languages, and
   complete one fail-closed timed rehearsal from a fresh GPTWork task.
9. Only after every preceding step succeeds, mark `remote-mcp` as available in
   the capability registry and allow the scheduled task to call the tool.

Do not disable the existing local schedule or claim unattended publication
until server-side validator proof, the owner-only connection, and scheduled
write behavior have all been verified. There is no automatic/manual-recovery
endpoint in this Worker; it only accepts the normal same-date 07:00–08:00
schedule window with at least 45 seconds left for public readback.

During migration the existing local compatibility task still uses the legacy
site API, which writes its established delivery event and channel usage fields.
The "final article only" storage boundary applies to this new Worker after the
cutover, not to that temporary compatibility path.
