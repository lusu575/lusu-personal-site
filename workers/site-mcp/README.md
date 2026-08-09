# LuSu Site MCP Worker

Stateless, public, read-only MCP access to LuSu's published site content. The
Worker shares the production D1 database and the repository's capability and
public-content services; it does not call the public website over HTTP.

This standalone unauthenticated target is not the canonical production endpoint
and does not implement OAuth. Its public tool registrar is reused by the
production owner-only `workers/site-admin-mcp/` server, which supplies its own
MCP SDK instance and OAuth boundary at `https://lusu575.com/mcp`. Deployed owner
Worker version `377d494b-8f90-40ad-998f-863d209e1978` exposes all six public read
tools behind `content:read`, alongside article, external-video, and browser-game
owner tools. Only
already-public, read-only operations belong in this project. Transfer room
passwords, local files, account saves, chat writes, whiteboard writes,
publishing, and administrator operations must not be added to this unauthenticated
Worker.

## HTTP surface

- `GET /health` returns a small service health document.
- `/mcp` serves stateless Streamable HTTP MCP using a fresh `McpServer` for
  every request.
- Every other path returns JSON `404`.

The MCP surface currently contains:

- `site_capabilities`: lists available read-only remote capabilities.
- `content_list`: lists bounded published article summaries by language and
  optional category.
- `content_search`: searches bounded published article summaries.
- `article_get`: reads one bounded published article by public slug.
- `videos_list`: lists bounded published YouTube/Bilibili external-video summaries.
- `video_get`: reads one bounded published external-video record.
- `lusu://articles/{slug}{?lang}`: resource template for one published article.

The current owner Worker deploys both video reads, and the `OpwviOTPYTU`
publish/replay/readback/refresh/hide/delete lifecycle passed for that exact
bundle. Registry `content.videos.list/get.availableTransports` still omits
`remote-mcp`, so `site_capabilities` continues to discover only the four promoted
article capabilities. The reusable registrar contributes all six tools to the
owner server; the standalone resource template is not included there. Five
article-management tools, six video-management tools, and six browser-game tools
remain implemented only in `workers/site-admin-mcp/` and must never be moved into
this unauthenticated target.

The registry capability `content.daily-ai-news.get` is implemented as a
composition: call `content_list` with `category: "daily-ai-news"` (or search a
known date/slug), then call `article_get` for the selected public slug. There is
no separate publishing or automation tool on this public Worker.

All tools return both text content and validated `structuredContent`. Tool
annotations identify the operations as read-only, non-destructive, idempotent,
and closed-world. The MCP handler keeps its built-in Host and browser Origin
validation defaults; do not replace those defaults with wildcard acceptance.
The capability response distinguishes target `transport` values from
`availableTransports`; only the latter proves that a concrete adapter is
implemented in this release.

## Local checks

Use Node.js 22.13 or newer:

```powershell
npm.cmd install
npm.cmd run typecheck
npm.cmd test
```

For a local Worker process:

```powershell
npm.cmd run dev
```

Wrangler uses a local D1 database unless explicitly instructed otherwise. Do
not add `--remote`, publish this standalone target onto the canonical route, or
connect tests to production while developing this slice.

The committed Worker target is `2026-08-06`. The repository-pinned Wrangler
currently bundles a local workerd that supports dates only through
`2026-07-29`, so `npm run dev` and Vitest use that date only as a local-runtime
override. Remove the overrides after the pinned Wrangler/workerd is upgraded;
do not treat the older local date as the deployment target.

## Authentication boundary

The reusable public read-only surface only exposes already-published records.
The production owner server implements OAuth 2.1 with
PKCE/resource indicators and narrowly issued scopes, maps grants to site users
on the server, and never reuses, returns, or logs the existing `lusu_session`
cookie or raw bearer tokens. High-risk and publishing capabilities remain in
that separate owner-only server.

Production D1 migration and OAuth metadata/DCR/401/origin/path smoke checks are
complete. Current owner Worker `377d...` exposes 23 tools while public capability
discovery remains four promoted article reads. External-video production
acceptance is complete for that exact bundle, including owner/public MCP and
public HTTP agreement, metadata refresh, CAS hide, confirmed delete, final
absence, and RFC 7009 revocation. Browser-game control remains a production
candidate: this Pages release adds an eight-second heartbeat while the current
Worker already provides edge `ping`/`pong` auto-response; all four real game pages
must still pass pair/action/pause/player-resume/close acceptance. This
unauthenticated target must never bypass owner consent, and no historical result
may promote a new Worker bundle.
