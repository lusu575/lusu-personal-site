# Design QA: Page Turn, Mobile Home Grid, and Layered App Frames

Date: 2026-07-11

Source reference:

- `C:\Users\lusu\AppData\Local\Temp\codex-clipboard-bf1f039a-3d9e-42c1-8c88-6d2e2755e04f.png`

Implementation captures:

- `F:\lusu575个人站\output\playwright\page-turn-frame-qa\home-390x844.png`
- `F:\lusu575个人站\output\playwright\page-turn-frame-qa\knowledge-390x844.png`
- `F:\lusu575个人站\output\playwright\page-turn-frame-qa\knowledge-ja-359x500.png`
- `F:\lusu575个人站\output\playwright\page-turn-frame-qa\knowledge-en-844x390-mobile.png`
- `F:\lusu575个人站\output\playwright\page-turn-frame-qa\games-zh-390x844.png`
- `F:\lusu575个人站\output\playwright\page-turn-frame-qa\chatroom-zh-390x844.png`
- `F:\lusu575个人站\output\playwright\page-turn-frame-qa\page-turn-mid-390x844.png`
- `F:\lusu575个人站\output\playwright\page-turn-frame-qa\page-turn-mid-desktop-1440x900.png`

The reference and the 390x844 Knowledge capture were inspected together in one comparison input. The requested reference scope was the frame hierarchy only; its colors and icons were deliberately excluded.

## Comparison and Iterations

1. The first implementation named only the active `.page` for View Transitions. Mid-transition review showed that the old sheet omitted the top and bottom system chrome, so the transition target was expanded to `.site-shell`; top bar, active content, and bottom bar now turn as one page.
2. The old root crossfade and the second window scale-in were removed. Mid-transition computed styles confirm `rootAnimation: none`; only `neo-xp-page-turn-forward` or `neo-xp-page-turn-backward` runs for route changes.
3. The mobile Home grid was moved into the reclaimed first-screen space and changed from elastic rows to fixed rows. Narrow portrait icons use 74x84px buttons, regular portrait uses 78x90px, and short landscape uses 70x70px; visible icon/label to hit-area ratios stay between 1.092 and 1.157.
4. Knowledge, Videos, Resources, Games, Notes, Chat, and About received a shared outer frame plus framed toolbar/filter, tabs/categories, content scrollport, and bordered list items. The palette continues to follow morning/day/dusk/night Neo-XP tokens.
5. Source/implementation comparison found the intended outer/tool/tab/content hierarchy present. The implementation remains intentionally denser, keeps the existing site icons, uses the existing full-width mobile actions, and recovers more vertical content than the reference.

## Visual and Functional Checks

- Fonts and typography: zh/en/ja headings, summaries, metadata, tags, and controls remain readable in portrait and short landscape; no visible text escapes its card.
- Spacing and layout: outer frames remain inside the viewport with 8px side margins; toolbars, category rows, content regions, cards, and buttons do not overlap.
- Colors and surfaces: layered edges are present in all Apps and vary with the existing four time themes; reference colors and icons were not copied.
- Icons and assets: all existing bitmap assets remain in use; no emoji, placeholder drawing, custom SVG, or CSS-drawn icon was introduced.
- States and interactions: route navigation, forward and backward page turns, Home return, search controls, category controls, game actions, chat compose, and article card actions remain reachable.
- Accessibility: all visible primary controls in the measured App states are at least 44px; reduced/off motion still commits navigation without spatial movement.

## Automated Geometry Matrix

- Home: 359x500, 375x667, 390x844, and 844x390 in zh/en/ja = 12 states.
- Apps: 7 routes x 4 viewports x 3 languages = 84 states.
- Wrong active route: 0.
- Horizontal overflow: 0.
- Desktop icon intersections: 0.
- Card intersections: 0.
- Card child escapes: 0.
- Undersized primary controls: 0.
- Missing layered App frames: 0.
- Console/page errors: 0.
- Chat log threshold failures: 0; 375x667 remains at least 260px and 844x390 remains at least 150px.

## Motion Checks

- Mobile forward: route `knowledge`, direction `forward`, animation `neo-xp-page-turn-forward`, root animation `none`.
- Mobile reverse: route `home`, direction `backward`, animation `neo-xp-page-turn-backward`, root animation `none`.
- Desktop 1440x900 forward/reverse checks report the same animation families, zero horizontal overflow, one settled active page, and no console errors.
- After each transition, `data-ui-transition` and `data-ui-page-turn` are removed.

## Remaining Notes

- P3: The frame is not a pixel-identical clone. Its denser header, existing icons, four-time palette, and compact actions are intentional because the user requested only the reference border layout and asked to preserve more readable content.
- P3: Browser antialiasing and local dynamic article/chat data can make individual lines differ between captures without changing the verified geometry.

final result: passed
