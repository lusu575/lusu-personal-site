# Design QA: Knowledge Article Reference Layout

Date: 2026-06-18

Source reference:
- `C:\Users\lusu\AppData\Local\Temp\codex-clipboard-276d2c5c-d8eb-4aad-a55d-d5c2fa1c295c.png`

Prototype captures:
- `F:\lusu575个人站-public-loop\output\public-loop-qa\20260618-article-10loop\final-desktop-top.png`
- `F:\lusu575个人站-public-loop\output\public-loop-qa\20260618-article-10loop\final-desktop-scrolled-68.png`
- `F:\lusu575个人站-public-loop\output\public-loop-qa\20260618-article-10loop\final-mobile.png`

## Checks

- Desktop window now fills the viewport like the reference, with a 48px XP titlebar and three titlebar controls.
- Back button, left contents sidebar, right article card, bottom dashed divider, reading progress, and back-to-top button are aligned to the reference layout.
- Reading progress uses a single-row bottom bar with a blue segmented fill and a separate right-side percentage.
- Back-to-top no longer collides with the progress bar on desktop or mobile.
- Article contents and body continue using DOM/textContent-safe rendering paths.
- Mobile layout remains single-column with no horizontal overflow.
- Three-language article switching was verified through restored window controls and direct article links.

## Remaining Notes

- P3: Font rasterization and small icon glyphs are not pixel-identical to the reference image because the live site uses the existing XP/pixel asset set and browser text rendering.
- P3: The progress value is live, so the top-of-article state correctly reads 0%; the scrolled capture verifies the 66%-68% state.

final result: passed
