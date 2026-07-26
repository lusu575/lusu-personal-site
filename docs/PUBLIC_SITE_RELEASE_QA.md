# Public Site Release QA

This checklist is the local release barrier for the public site. It validates a candidate but never publishes it.

## Default decision

The default decision is `BLOCKED` until every required local check has recorded evidence and a human explicitly authorizes release.

```text
Authorized release: NO | YES
Decision: BLOCKED | READY
Commit under review: NOT TESTED
Production deployment: NOT TESTED
Real-device mobile pass: NOT TESTED
Screen-reader pass: NOT TESTED
```

If authorization remains `NO`, do not commit, push, merge, deploy, or mutate production data.

## Local gate

Run from the repository root with Node.js 22.13 or newer:

```powershell
npm.cmd run verify:public-site-release
```

`npm.cmd run qa:public-release` is the equivalent user-facing alias. The gate runs:

1. automated tests;
2. the public ESM module-graph check;
3. the static build contract;
4. two reproducible production builds;
5. `git diff --check` and a worktree status report;
6. the isolated Headless Chrome release audit.

For a focused Tools (`resources` route) / Quick Transfer layout review, run:

```powershell
npm.cmd run audit:resources-layout
```

This focused check uses exact CDP viewport metrics and captures Tools, Transfer sign-in, and return-to-Tools states while preserving the internal `resources` route. It does not replace the full local gate.

## Evidence record

Record the following without placing secrets, visitor identifiers, drafts, passwords, or production data in the report:

```text
Tests: NOT TESTED
Module graph: NOT TESTED
Static build: NOT TESTED
Reproducible production build: NOT TESTED
Headless release audit: NOT TESTED
Tools (`resources`) layout audit: NOT TESTED
git diff --check: NOT TESTED
Worktree reviewed: NOT TESTED
```

Headless checks are geometry and interaction evidence, not certification for real iOS or Android devices, browser chrome, safe areas, on-screen keyboards, complete assistive technology, or WCAG conformance.

## Authorized online verification

Only after a separately authorized push to `main`:

1. confirm the latest `origin/main` commit;
2. confirm the latest successful Cloudflare Pages production deployment commit matches it;
3. inspect online `index.html` CSS/JS query strings and verify they match the source release;
4. check both `lusu575.com` and `www.lusu575.com` for Cloudflare or browser cache differences;
5. repeat the affected route flow against production without using or altering private production data.

Wrangler manual deployment is not the normal release path. GitHub `main` remains the source for Cloudflare Pages automatic deployment.
