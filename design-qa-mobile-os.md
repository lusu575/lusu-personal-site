# Design QA: Premium Interaction & Mobile Virtual OS

Date: 2026-07-10
Status: verified local feature branch, not published

## Scope

- Desktop: Neo-XP / Pixel Glass OS, preserving the Windows XP + Pixel Art + Y2K identity.
- Mobile: an original iOS-inspired virtual phone OS with a Home App grid and full Dock; App routes use one App bar, full-height content and a slim Home indicator, with safe-area handling and a persistent return path.
- State: one existing business-state graph owned by `js/main.js`; the presentation shells may observe and delegate, but never copy route, account, article, video, game or chat state.

## Baseline defects

The production baseline was captured before implementation and showed these mobile-specific problems:

- The phone layout was a compressed XP desktop rather than a purpose-built mobile shell.
- The two-row top bar and roughly 104-118px taskbar consumed a large part of short screens.
- Desktop icons became a long single-column list instead of a usable App home screen.
- The welcome window nearly filled 390x844 and competed with persistent chrome.
- Chat and other window pages had to reserve space for desktop chrome instead of treating the current section as a full-screen App.
- A no-overflow result still left too little readable content: duplicate App/title bars and the full Dock removed about 100-128px, Games inherited a 180px landscape cap, and short-screen articles could show no unobscured body text before the fixed progress control.
- Desktop motion was not governed by one explicit displacement budget, and the online indicator used continuous flashing.

Baseline and implementation screenshots live under the local Playwright QA output directories. They are evidence artifacts only and must not be committed.

## Fix evidence already passed

| Viewport / mode | Evidence |
| --- | --- |
| 375x667 portrait | App window is 565px high; Chat public/private logs are about 404px/350px; Games shows two complete cards. |
| 390x844 portrait | App window is 740px high; Knowledge exposes 634px of list viewport and Chat exposes about 486px. |
| 844x390 coarse pointer landscape | App window is 328px high; Games uses 327px instead of the legacy 180px cap and shows four complete cards; Chat public/private logs are about 267px/213px. |
| Mobile article, 359x500 / 375x667 / 844x390 | About 88px / 263px / 131px of real body text is visible; progress and the compact top control live in the App bar, and the final body node remains fully visible at the end. |
| 1440x900 desktop, full motion | Pointer parallax stayed below the 6px displacement budget. |
| Browser console | 0 errors and 0 warnings in both the readability and full regression runs. |

Additional final evidence:

- 430x932 and 375x667 keep all seven Apps above the Dock with no horizontal overflow.
- The full Dock, account widget and language cycle are visible only on Home. Every App route hides the repeated global actions, page titlebar and full Dock, keeps a 44px Home button, and exposes only the bottom Home indicator.
- Every visible interactive target in the 375x667 and coarse-pointer 844x390 runs measured at least 44x44 CSS pixels.
- Knowledge search is 52px high by default and expands to a contained 70px two-row layout only while a real query status is present. Mobile article metadata uses a discoverable thin horizontal scrollbar, and short portrait/landscape summaries are clamped so the real article body remains visible.
- All zh / en / ja App-bar titles fit at 375x667 without truncation; entering an App moves focus to a visible control inside the active page.
- The About surface computes to `overflow-y: auto`; private-room controls remain left-to-right with at least 8px between the action buttons.
- The compact 44px mobile language control delegates to the existing language buttons and verified zh -> en -> ja URL, metadata and copy changes without creating language state.
- The 760px boundary activates only the mobile shell; 761px activates only the desktop shell.
- All eight public routes passed at 390x844 and 1440x900 with exactly one active page and no console errors or warnings.
- The account sheet fills the safe mobile width, desktop account content remains above section windows, and Escape restores the hidden/expanded state.
- The consolidated public-update article passed direct-link rendering in zh, en and ja with three localized sections per language.
- Browser Back and Forward preserve the single route authority; the DOM audit found no duplicate IDs and exactly one account widget, article detail, video modal and chat form.
- Finished Web Animations are cancelled after completion, so no invisible transform/filter remains to capture viewport-fixed article controls.
- Reduced motion and motion-off both measured 0px parallax; the online indicator reports `animation-name: none`.
- The complete browser regression reports 21/21 checks passed. The local API regression also reports 21/21, including HttpOnly account sessions, cloud-save round trips, public chat, PBKDF2/AES-GCM private-room ciphertext/decryption and all five game wrappers/sources.

The implementation also provides explicit stop conditions for `document.hidden`, `prefers-reduced-motion` and the user motion-off setting, and removes continuous online-status blinking.

## Regression matrix before local commit

- Mobile: 359x500, 375x667, 390x844, 430x932 and 844x390 coarse pointer.
- Boundary: 760px and 761px to confirm that exactly one presentation shell is active.
- Desktop: 1440x900 across morning, day, dusk and night.
- Routes: Home, Knowledge, direct `/articles/<slug>`, Videos/player, Resources, Games, Chat public room, Chat password room and About.
- Interactions: language switching, account popover, back/forward, Escape, focus containment, outside click, Dock/Home return, soft-keyboard/`visualViewport`, reduced motion and user motion-off.
- Invariants: no cloned high-coupling DOM, no duplicate business state, no horizontal overflow, touch targets at least 44px, App windows at least 80% of the mobile viewport, measurable card/log/body capacity, structural card children fully contained, text/metadata/buttons pairwise non-overlapping in zh / en / ja, and no regression to APIs, D1, cloud saves, chat encryption or telemetry privacy.

The final overlap gate covered 84 App samples plus 12 private-room and 12 article samples. All 15,486 geometric assertions passed with zero console or page errors.

## Verification and release boundary

- `npm.cmd run build` passes after the final code, seed and documentation edits.
- Public CSS/JS and strong mobile visual references use `20260710-premium-mobile-os-r6`; telemetry keeps its existing privacy release query.
- The full desktop/mobile route, language, modal, account, article, chat, game, motion and boundary matrix is complete.
- Local Playwright evidence is ignored through `output/playwright/` and is not part of the commit.
- This task intentionally does not push or merge `main`. The unchanged production path remains GitHub `main` to Cloudflare Pages automatic deployment.

final result: passed
