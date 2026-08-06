# LuSu Site MCP Worker

Stateless, public, read-only MCP access to LuSu's published site content. The
Worker shares the production D1 database and the repository's capability and
public-content services; it does not call the public website over HTTP.

This first slice is intentionally not deployed and does not implement OAuth.
Only already-public, read-only operations belong here until the site has a
first-party OAuth 2.1 authorization bridge with per-user scopes. Transfer room
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
- `lusu://articles/{slug}{?lang}`: resource template for one published article.

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
not add `--remote`, deploy the Worker, or connect tests to production while
developing this slice.

The committed Worker target is `2026-08-06`. The repository-pinned Wrangler
currently bundles a local workerd that supports dates only through
`2026-07-29`, so `npm run dev` and Vitest use that date only as a local-runtime
override. Remove the overrides after the pinned Wrangler/workerd is upgraded;
do not treat the older local date as the deployment target.

## Authentication boundary

The public read-only surface is useful without login because it only exposes
already-published records. A future authenticated surface must live behind
OAuth 2.1 with PKCE/resource indicators and narrowly issued scopes. It must map
tokens to site users on the server and must never reuse, return, or log the
existing `lusu_session` cookie or raw bearer tokens. High-risk and publishing
capabilities should remain in a separate owner-only server even after OAuth is
available.
