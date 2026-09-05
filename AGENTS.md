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

For online whiteboard work, read `docs/whiteboard/AGENTS.md` and the files it routes before editing. For Quick Transfer work, read `docs/transfer/AGENTS.md`; if the change touches `/admin/transfer.html`, also read the three admin documents above.

For AI capability, MCP, or CLI work, read `docs/agent-capabilities/README.md` and inspect `lib/capabilities/registry.mjs`; if an adapter touches a governed tool, also follow that tool's subproject guide.

For article / update-log work, also inspect:

1. `js/data/content.mjs` `content.updates`
2. `js/data/home-content.mjs` `homeContent.updates`
3. `functions/api/[[route]].js` `articleSeedStatements`
4. `cloudflare/schema.sql`

For Daily AI News delivery work, first read `自动新闻/integrations/lusu-site/ARTICLE_STYLE.md`, then inspect the `daily-ai-news` category handling, `article_delivery_channels`, `article_delivery_events`, and the admin automation panel. Each public title must be the localized Daily AI News label plus the localized lead-story headline; never use a date-only title. The automatic production schedule is explicitly authorized: start at 07:00 Asia/Shanghai, use the exact preceding 24-hour half-open window, and publish on the same Shanghai report date once the dedicated channel's explicit auto-publish configuration is enabled and every content and delivery gate passes; passing 08:00 is not by itself a publication failure. Formal runs require a schema-v4 editorial record, the candidate index, coverage-manifest v2, required query/entity-group sign-off, and exactly one selected, merged, or specifically rejected disposition for every candidate in the exact-window candidate index. New manifests use `priorityReviewPolicy: all-discovered-candidates` and the `complete-discovery-review` lane; legacy `mustReviewCandidateIds` and `coverageAudit.priorityReview` field names must cover all candidates, while priority only controls review order. New manifests also use `protectedEventReviewPolicy: evidence-backed-protected-events-v1`; regardless of selected count, `coverageAudit.protectedEventReview` must cluster every editorial-signal, RSS, protected-class, selected, and merged candidate by event key plus stage, with direct reliable HTTPS evidence, the first reliable publication time, an evidence summary, and specific four-component score rationale. Never generate classifications, scores, rejection reasons, or evidence records from candidate-ID hashes, array indexes, or rotating templates. Event eligibility uses the first verifiable reliable publication time for the current event stage; aggregator ingestion/refresh time and Reddit or Hacker News post time cannot substitute for it. Google News, Reddit, Hacker News, and Bing pages are discovery aids only, and every resulting lead must be traced back to an official, primary, or otherwise reliable direct source before it supports facts or timing. Dedicated multilingual discovery must cover Thinking Machines, LG AI Research and other open/Korean model labs, split Doubao product and ByteDance Seed/SeedRealtime speech queries, plus Seedance and other video, image, and audio model releases, delays, APIs, weights, and availability changes. Query truncation uses a max-plus-one probe: only more than `maxResults` is truncated; equality is not. Optional supplemental sources may fail individually, but every candidate they return still requires a disposition. The site owner has authorized Tibo `@thsottiaux` X posts as a discovery target: use the required `codex-operations-en` focused query for his name, handle, and Codex/ChatGPT Work changes, review every returned X/media/community lead, and never call public-index discovery a complete authenticated timeline or X API. A `usage-policy-change` must be classified as usage policy or material quota and cannot be rejected as unimportant, routine, or out of scope; generic token, inference-memory, routing, or performance news must not receive this signal. Merge every other source for the same quota event into one representative story. A second review is required when fewer than five stories are initially selected; five is a trigger, not a quota, and reliable sources are not restricted by language. A successful empty query and a fetch/parser failure are different states: retry bounded failures, then fail closed, and hash the exact UTF-8 candidate-index bytes written to disk. Deduplicate by event key plus event stage so a documented material release/open-weight stage is not discarded as an old story. Any automatic failure or missing qualifying story must close the scheduled run without publication, but elapsed time after 08:00 alone is not a failure. Only after the site owner explicitly requests same-day recovery in an interactive task may an agent read `自动新闻/integrations/lusu-site/MANUAL_RECOVERY.md` and use the date-plus-canonical-run-SHA double-confirmation path between 07:00 and midnight. That manual path keeps the exact original window plus all schema, Horizon, coverage, token, channel, auto-publish, rate-limit, idempotency, conflict, and trilingual public-readback safeguards.

Daily AI News review must preserve recall as well as formal completeness. Protected signals cover model/product releases, capability/availability, developer tools, price/quota and usage policy, plus strategic chips/storage/robotics/devices/autonomous-driving/data-center infrastructure, major tech finance, and AI policy/safety changes. A signal requires matching protected-class review before scoring but never forces publication; signals cannot be bulk-labeled `other`. For a new all-candidate run, fail closed when at least 50 candidates are all labeled `other` or when at least 90% of rejected candidates share one identical editorial class plus four-component score template. `below-importance-threshold` requires a real substantive change, while `no-material-change` requires the opposite. A sub-five second pass must finish after the first review and include every signaled candidate, every RSS candidate, and every rejected protected-class candidate scored 5 or 6 in `reconsideredCandidateIds`; additional indexed candidates are allowed. Effective with report date 2026-08-10, five is both the second-review trigger and the minimum publication count, while each selected story must still independently clear every normal gate.

Effective with report date 2026-08-10, the site owner's newer rule supersedes the earlier “five is only a trigger” wording above: every published Daily AI News issue must contain at least five independent, in-window, threshold-clearing, reliably verified stories. A sub-five first pass still requires the complete second review; if the run remains below five, it must fail closed with no publication. Never satisfy the minimum with duplicates, outside-window items, unverified claims presented as fact, or below-threshold filler.

Effective with report date 2026-08-13, confirmed lead/main stories and rumors use score 6; confirmed stories still require reliable direct evidence. The rumor section independently requires at least five useful items, but five is a floor rather than a target or cap: retain every independent item that clears its applicable gate. Rumors may be supported by one attributable first-party public teaser or two independent reliable direct reports and still require conditional language, a specific `whyUnverified`, and `rumorEvidenceBasis`; discovery-only aggregators, anonymous screenshots, duplicates, and pure speculation remain ineligible. Selected and merged priority dispositions must carry their own `eventKey + eventStage`, and a merge must match the representative exactly—secondary competitor mentions in a multi-event headline never establish merge identity. Required discovery must separately cover Tibo/Codex teasers, xAI Grok products, Qwen open weights, LTX video models, and English DeepSeek releases.

Effective with report date 2026-08-17, the site owner's newer rule supersedes the rumor-count floor above: the rumor section has no minimum item count. Publish every independent rumor that clears the score and evidence gates, but never add filler merely to populate the section. The issue-wide minimum of five independent qualifying stories remains unchanged, and the lead must still be confirmed.

Effective with report date 2026-08-24, confirmed lead/main stories remain at score 6, while rumors use score 5. A rumor may be supported by one attributable first-party public teaser, one attributable reliable direct report, or two independent reliable direct reports; it still requires conditional language, a specific `whyUnverified`, and `rumorEvidenceBasis`. Discovery-only aggregators, anonymous screenshots, duplicates, and pure speculation remain ineligible. The issue-wide minimum of five and confirmed lead requirement remain unchanged.

Effective after the completed 2026-08-29 production run, Daily AI News editorial judgment is owned by the current scheduled Codex task. `ai-news:semantic-review` first creates an objective pre-screen and Codex queue, then requires a Codex-authored structured response and a `--finalize` validation pass. Programmatic pre-screening may only reject exact-window/content/source low-signal candidates with no editorial signal and no RSS source; it must never classify, score, or suppress protected candidates. Do not start Gemma, llama.cpp, or another local semantic scoring model. The pre-screen plus Codex response must still dispose every indexed candidate exactly once and complete direct-evidence protected-event review.

Effective 2026-09-01, Daily AI News scope expands additively and never replaces its existing model, developer-tool, open-model, multimodal, semiconductor, robotics, autonomous-driving, infrastructure, finance, policy, or safety coverage. Required multilingual discovery must also cover GPU/graphics and generative rendering, consumer/on-device AI devices, and applied-AI products and industries. Named examples such as DLSS or Doubao phones are discovery aliases, not a closed list. A material candidate cannot be rejected as outside scope merely because it is not a model or agent; all existing evidence, timing, scoring, deduplication, and publication gates remain unchanged.

Effective 2026-09-04, this rule supersedes the earlier exact-preceding-24-hour and exact-original-window wording in this document. The fixed 07:00-to-07:00 window is replaced by `[previous report date's saved collection start, current execution's actual collection start)`. The scheduler still triggers at 07:00 Asia/Shanghai, but every new same-date execution replaces the current report date's saved anchor and right edge; the previous-date start remains fixed, so recovery runs include news discovered between the earlier failed attempt and the new attempt. Formal runs must carry the `previous-collection-start-to-current-execution-start-v2` policy, matching timestamps, and the current Horizon run id through the candidate index, coverage manifest, assembled run, validator, and manual-recovery confirmation. The fetcher may migrate a missing legacy previous-date anchor only from the earliest Horizon run started on that Shanghai date; a missing previous-date anchor fails closed. Public X profile candidates must always enter the Codex queue even when they carry no keyword-derived editorial signal, and their must-review query/source provenance must survive queue generation.

Effective 2026-09-05, a required Google News query must contain at most one `site:` publisher restriction and must never combine publishers with `OR site:`. Give every official or reliable publisher its own required, must-review source shard; keep multi-publisher parent queries supplemental. Probe each changed shard with max-plus-one against the target collection window before release.

Production automation Node requests must use the shared proxy-aware client so local Fake-IP/TUN DNS does not bypass `HTTP_PROXY`/`HTTPS_PROXY`/`NO_PROXY`; never log proxy values or credentials. A production POST is sent at most once per execution. After `published`, public zh/en/ja verification may retry only idempotent GETs for network errors or explicitly transient HTTP statuses, at most three attempts per language and only before the same-report-date midnight cutoff; payload mismatch, non-transient status, or exhaustion remains fail closed and must never trigger another POST.

For Tool Radar delivery work, first read `自动新闻/integrations/lusu-site/tool-radar/ARTICLE_STYLE.md` and `VISUAL_METHOD.md`. Images must be discovered online and verified back to the tool's official product page, feature page, documentation, repository, or official media; only real product interfaces, official case studies, or real outputs are allowed. Reject site-drawn diagrams, AI-generated visuals, uniform template cards, simulated interfaces, search thumbnails, and third-party reposts. If no official visual passes meaning, rights, privacy, stability, and narrow-width checks, use `image: null` rather than generating a substitute. Store adopted images locally, preserve source-page/direct-asset or capture-target evidence plus rights notes and trilingual alt/captions, deploy exact bytes through GitHub `main`, and reference each image as `<assetPath>?v=<first 12 SHA-256 characters>`. Verify HTTP 200, matching MIME, and the full production SHA-256 through that exact cache key before delivery.

For Tool Radar work, first read `自动新闻/integrations/lusu-site/tool-radar/ARTICLE_STYLE.md`, then inspect the fixed `tool-radar` category, `tool_radar_catalog`, the dedicated delivery channel, and the admin automation selector. The production task is authorized for every Tuesday at 22:00 Asia/Shanghai. Each issue targets 6–10 verified tools and must not deliver fewer than three. Exact tool keys and canonical URLs are server-deduplicated; suspected renames, domain moves, or acquisitions require a manual historical-name and alias review before treating the product as new. Different tools with similar capabilities remain eligible. Verify practical claims against official sources, keep internal source evidence, and cover price/free tier, login, Chinese support, local or AI-assisted deployment, usage, examples, and suitable scenarios. Public article images must be semantically complete approved project-local assets under `assets/images/articles/`, never arbitrary external hotlinks; production delivery must confirm each referenced asset is live and its remote SHA-256 matches the reviewed file. Delivery and auto-publish remain independent explicit dedicated-channel gates. Release site assets through GitHub `main` to Cloudflare Pages before delivery, and fail closed on any research, structure, image, deduplication, delivery, or public-readback error.

## Project Shape

- Public site: `index.html`, `css/style.css`, `css/motion-system.css`, `css/mobile-ios-shell.css`, `js/main.js`, `js/core/`, `js/data/`, `js/features/`, `js/routes/`, `js/ui-motion.js`, `js/mobile-shell.js`, `js/telemetry.js`
- Backend: Cloudflare Pages Functions in `functions/api/[[route]].js`
- Database: Cloudflare D1, schema in `cloudflare/schema.sql`
- Admin site: `admin/`
- Games: `games/`
- Governed tool subprojects: online whiteboard in `docs/whiteboard/`; Quick Transfer in `docs/transfer/`
- AI capability layer: registry/client modules in `lib/capabilities/`, local CLI/stdio MCP in `cli/` and `mcp/local/`, the reusable public registrar in `workers/site-mcp/`, and the production OAuth remote MCP in `workers/site-admin-mcp/`
- Deployment: GitHub `main` triggers Cloudflare Pages auto-deploy. Do not treat Wrangler manual deploy as the normal release path.

## Local Runtime And Secrets

- Use Node.js 22.13 or newer when possible.
- Local API variables belong in the Git-ignored repository-root `.dev.vars`, using deployment variable names but independently generated local values.
- Never commit `.dev.vars`, `.env`, `.env.*`, real email destinations, webhook URLs, access keys, or secrets.

## Mandatory Change Rules

- Every project change must update `CHANGELOG.md`.
- Whiteboard or Quick Transfer changes must also increase that subproject's independent version by exactly `0.0.1` and synchronize its `VERSION`, `project.json`, `CHANGELOG.md`, `README.md`, visible version, and affected maintenance documents. `npm run check:subprojects` enforces the contract.
- If project facts, rules, deployment flow, public behavior, or long-term maintenance notes change, update `PROJECT_CONTEXT.md`.
- If a long-term rule or repeated pitfall is discovered, update `skills/lusu-personal-site-skill/SKILL.md` and `skills/lusu-personal-site-skill/README.md`.
- If `AGENTS.md` guidance changes, keep it concise and actionable.
- Public visible changes must update the site update system in all required places:
  - `js/data/content.mjs` `content.updates`, so the top-right recent-update date changes.
  - `js/data/home-content.mjs` slim five-item projection, without article bodies.
  - `functions/api/[[route]].js` article seed.
  - `cloudflare/schema.sql` article seed.
  - zh / en / ja `site-updates` title, summary, and body.
- If `js/main.js`, its imported public modules, `css/style.css`, visual assets, top bar, taskbar, or public interaction code changes, update the matching query string in `index.html`.
- Do not push a visible change where the top-right recent-update date stays stale.

## Account Popover Rule

The top-right account entry is a top-bar floating layer. When touching it, check both:

- `.xp-topbar` must allow the popover to overflow below the button.
- `.site-shell > header` must sit above `.site-shell > main`.

Fixing only one side can make the home page look unresponsive or make the popover appear behind section windows. Verify Home, Knowledge, Videos, Tools (the internal `resources` route), Games, Chat, About, and narrow mobile layouts.

## Public UI Rules

- Keep the Windows XP + Pixel Art + Y2K desktop style.
- Maintain Chinese / English / Japanese visible copy for public UI.
- Do not make public UI look like a modern landing page.
- Keep the bottom taskbar fixed to the viewport edge.
- For mobile changes, check narrow portrait and short landscape layouts.
- Keep one real frosted mobile Dock across Home and App routes. It exposes six high-frequency routes; About remains available from Home without a Dock shortcut, while Blog is retired from the mobile shell and mobile `#blog` requests fall back to Knowledge. It must stay horizontally scrollable when needed, hide the selection surface for excluded routes, support the 44px collapse/expand handle, and avoid duplicating the page titlebar.
- Keep mobile account and language controls on Home rather than repeating them inside every App; App routes must retain a visible labeled 44px Home return control and a right-aligned route title.
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

- `js/data/content.mjs` fallback `content.updates`
- `js/data/home-content.mjs` Home summary projection
- `functions/api/[[route]].js`
- `cloudflare/schema.sql`

The top-right recent-update date is generated from `homeContent.updates`. Keep it projected from the newest five `content.updates` records without `content_markdown`; if that date does not change after a visible update, the job is incomplete.

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
