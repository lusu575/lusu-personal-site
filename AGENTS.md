# AGENTS.md

This is the handoff guide for any AI agent maintaining LuSu's personal site (`lusu575/lusu-personal-site`). Treat it as the first file to read in future sessions.

## Read First

For all work, read these before editing:

1. `PROJECT_CONTEXT.md`
2. `skills/lusu-personal-site-skill/SKILL.md`
3. `CHANGELOG.md` latest dated section

For `/admin/` work, read these as well:

1. `admin/docs/ADMIN_PROJECT_CONTEXT.md`
2. `admin/docs/ADMIN_SKILL.md`
3. `admin/docs/ADMIN_CHANGELOG.md`

For game work, also inspect:

1. `games/catalog.json`
2. `games/game-shell.js`
3. `games/game-shell.css`

For article / update-log work, also inspect:

1. `js/main.js` `content.updates`
2. `functions/api/[[route]].js` `articleSeedStatements`
3. `cloudflare/schema.sql`

## Project Shape

- Public site: `index.html`, `css/style.css`, `css/motion-system.css`, `css/mobile-ios-shell.css`, `js/main.js`, `js/ui-motion.js`, `js/mobile-shell.js`, `js/telemetry.js`
- Backend: Cloudflare Pages Functions in `functions/api/[[route]].js`
- Database: Cloudflare D1, schema in `cloudflare/schema.sql`
- Admin site: `admin/`
- Games: `games/`
- Deployment: GitHub `main` triggers Cloudflare Pages auto-deploy. Do not treat Wrangler manual deploy as the normal release path.

## Mandatory Change Rules

- Every project change must update `CHANGELOG.md`.
- If project facts, rules, deployment flow, public behavior, or long-term maintenance notes change, update `PROJECT_CONTEXT.md`.
- If a long-term rule or repeated pitfall is discovered, update `skills/lusu-personal-site-skill/SKILL.md` and `skills/lusu-personal-site-skill/README.md`.
- If `AGENTS.md` guidance changes, keep it concise and actionable.
- Public visible changes must update the site update system in all required places:
  - `js/main.js` `content.updates`, so the top-right recent-update date changes.
  - `functions/api/[[route]].js` article seed.
  - `cloudflare/schema.sql` article seed.
  - zh / en / ja `site-updates` title, summary, and body.
- If `js/main.js`, `css/style.css`, visual assets, top bar, taskbar, or public interaction code changes, update the matching query string in `index.html`.
- Do not push a visible change where the top-right recent-update date stays stale.

## Account Popover Rule

The top-right account entry is a top-bar floating layer. When touching it, check both:

- `.xp-topbar` must allow the popover to overflow below the button.
- `.site-shell > header` must sit above `.site-shell > main`.

Fixing only one side can make the home page look unresponsive or make the popover appear behind section windows. Verify Home, Knowledge, Videos, Resources, Games, Chat, About, and narrow mobile layouts.

## Public UI Rules

- Keep the Windows XP + Pixel Art + Y2K desktop style.
- Maintain Chinese / English / Japanese visible copy for public UI.
- Do not make public UI look like a modern landing page.
- Keep the bottom taskbar fixed to the viewport edge.
- For mobile changes, check narrow portrait and short landscape layouts.
- Keep the full mobile Dock on Home only; App routes use one App bar plus the bottom Home indicator, without a duplicate page titlebar.
- Keep mobile account and language controls on Home rather than repeating them inside every App; App routes must retain a visible 44px Home return control.
- Mobile QA must measure readable capacity and child geometry, not only parent overflow: check App height, complete cards, Chat log height, unobscured article body, and text/button/card intersections at 359x500, 375x667, 390x844, and 844x390 in zh / en / ja. Never pass by shrinking touch targets below 44px.
- For floating panels or modals, check z-index, clipping, keyboard focus, Escape behavior, and outside-click behavior.

## Security And Data Rules

- Do not use `innerHTML` for visitor chat content, nicknames, article data, video data, or external/user-controlled strings.
- Chat content must render as plain text.
- Account sessions use HttpOnly cookies; do not expose session tokens or visitor IDs in public UI.
- Account system is only for game cloud saves and should not block normal browsing.
- Admin routes must stay protected by admin role checks.
- Analytics must not capture passwords, draft inputs, unsent chat text, or full personal identifiers.

## Update Log Rules

There are two kinds of records:

- Root project history: `CHANGELOG.md`, always update for any change.
- Public website update log: `site-updates`, required for public visible changes.

When seed-backed `site-updates` are used, update all of these together:

- `js/main.js` fallback `content.updates`
- `functions/api/[[route]].js`
- `cloudflare/schema.sql`

The top-right recent-update date is generated from `content.updates`. If that date does not change after a visible update, the job is incomplete.

## Verification

Before finishing a code change:

1. Run `npm.cmd run build`.
2. Check `git diff --stat`.
3. Check that cache query strings match edited public assets.
4. For visible UI changes, inspect the affected route plus Home.
5. If pushing `main`, confirm `git status -sb` is clean afterward.

After pushing `main`, Cloudflare Pages should deploy from GitHub. If online behavior differs from local, check:

- The latest `origin/main` commit.
- Cloudflare Pages latest production deployment commit.
- Online `index.html` CSS / JS query strings.
- Cloudflare or browser cache.

## Do Not Commit

- `.wrangler/`
- `.wrangler-config/`
- `.codex-remote-attachments/`
- `node_modules/`
- Local preview logs or temporary generated files
