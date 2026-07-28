# Horizon upstream

This directory vendors the open-source Horizon project for the personal site's
Daily AI News workflow.

- Upstream repository: `https://github.com/Thysrael/Horizon.git`
- Vendored upstream commit: `1e2fdc7ccb17`
- License: MIT (`LICENSE`)

Site-specific workflow files live in `integrations/lusu-site/`. The local
`.horizon-git/`, `.venv/`, generated `data/mcp-runs/`, caches, logs, and secrets
are intentionally excluded from the parent repository.

The vendored source also carries two small site-required reliability patches:
cross-source URL merging preserves every contributing RSS feed and subreddit
identity, and HTTP 200 responses that are not recognizable RSS/Atom feeds are
reported as parser failures instead of silent empty feeds.
