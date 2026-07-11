# Design QA: Calm Motion Reset, Persistent Mobile Dock, and Layered App Frames

Date: 2026-07-11

Source reference:

- `C:\Users\lusu\AppData\Local\Temp\codex-clipboard-bf1f039a-3d9e-42c1-8c88-6d2e2755e04f.png`

Earlier R8 implementation captures retained as comparison evidence:

- `F:\lusu575个人站\output\playwright\page-turn-frame-qa\home-390x844.png`
- `F:\lusu575个人站\output\playwright\page-turn-frame-qa\knowledge-390x844.png`
- `F:\lusu575个人站\output\playwright\page-turn-frame-qa\knowledge-ja-359x500.png`
- `F:\lusu575个人站\output\playwright\page-turn-frame-qa\knowledge-en-844x390-mobile.png`
- `F:\lusu575个人站\output\playwright\page-turn-frame-qa\games-zh-390x844.png`
- `F:\lusu575个人站\output\playwright\page-turn-frame-qa\chatroom-zh-390x844.png`
- `F:\lusu575个人站\output\playwright\page-turn-frame-qa\page-turn-mid-390x844.png`
- `F:\lusu575个人站\output\playwright\page-turn-frame-qa\page-turn-mid-desktop-1440x900.png`

Final calm-motion evidence:

- `F:\lusu575个人站\output\playwright\six-item-dock-home-390x844.png`
- `F:\lusu575个人站\output\playwright\six-item-dock-about-390x844.png`
- `F:\lusu575个人站\output\playwright\desktop-icon-open-mid-after-fix.png`
- `F:\lusu575个人站\output\playwright\desktop-taskbar-home-mid-after-fix.png`
- `F:\lusu575个人站\output\playwright\calm-motion-desktop-route-mid.png`
- `F:\lusu575个人站\output\playwright\calm-motion-desktop.png`
- `F:\lusu575个人站\output\playwright\calm-motion-mobile-route-mid.png`
- `F:\lusu575个人站\output\playwright\calm-motion-mobile-390x844.png`

The reference and the 390x844 Knowledge capture were inspected together in one comparison input. The requested reference scope was the frame hierarchy only; its colors and icons were deliberately excluded.

## Comparison and Iterations

1. Desktop Home App launch no longer creates a Home-screen View Transition snapshot or transforms the whole active page. Only the destination window uses a 200ms fade and at most 3px of upward settle; the live wallpaper and fixed chrome remain stable.
2. Desktop taskbar module routes reveal only the new active page with a slight fade-slide while the old window snapshot stays hidden. Returning Home bypasses the page snapshot and animates only `.desktop-icons`, so the taskbar never disappears behind the transition top layer. Mobile Dock routes keep their short directional content slide.
3. The mobile Home grid was moved into the reclaimed first-screen space and changed from elastic rows to fixed rows. Narrow portrait icons use 74x84px buttons, regular portrait uses 78x90px, and short landscape uses 70x70px; visible icon/label to hit-area ratios stay between 1.092 and 1.157.
4. Knowledge, Videos, Resources, Games, Notes, Chat, and About received a shared outer frame plus framed toolbar/filter, tabs/categories, content scrollport, and bordered list items. The palette continues to follow morning/day/dusk/night Neo-XP tokens.
5. The mobile Dock exposes six high-frequency routes in one frosted rail: Home, Knowledge, Videos, Resources, Games, and Chat. The six items center cleanly at 375px and wider; 359px keeps a short horizontal scroll. Blog and About remain available from Home, and their App views hide the Dock selection surface instead of showing a false active item.

## Visual and Functional Checks

- Fonts and typography: zh/en/ja headings, summaries, metadata, tags, and controls remain readable in portrait and short landscape; no visible text escapes its card.
- Spacing and layout: outer frames remain inside the viewport with 8px side margins; toolbars, category rows, content regions, cards, and buttons do not overlap.
- Colors and surfaces: layered edges are present in all Apps and vary with the existing four time themes; reference colors and icons were not copied.
- Icons and assets: all existing bitmap assets remain in use; no emoji, placeholder drawing, custom SVG, or CSS-drawn icon was introduced.
- States and interactions: calm Home App launch, desktop single-page fade-slide, mobile directional route slide, Dock selection/scroll/collapse, Home return, search controls, category controls, game actions, chat compose, and article card actions remain reachable.
- Accessibility: all visible primary controls in the measured App states are at least 44px; reduced/off motion still commits navigation without spatial movement.

## Automated Geometry Matrix

- Home/Dock interaction: 359x500, 375x667, 390x844, and 844x390 in zh/en/ja = 12 states; six visible Dock routes, two Home-only modules, and 0 failures.
- Apps: 7 routes x 4 viewports x 3 languages = 84 states.
- Password-panel and article-detail deep states: 3 critical viewports x 3 languages x 2 states = 18 states, 81 assertions, 0 failures.
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

- Desktop Home icon launch: the mid-frame contains zero View Transition image animations; only the destination `.xp-window` is animated, its scale remains exactly 1, and its travel stays within 3px. Header and taskbar rectangles are unchanged.
- Desktop 1440x900 taskbar switch: module-to-module navigation keeps the content-only transition, while taskbar Home return contains zero View Transition image animations and moves only the icon group within the 6px route budget. The taskbar remains visible at opacity 1 throughout.
- Mobile Dock switch: outgoing/incoming content moves in the selected route direction, while the shared selection surface moves continuously to the destination item; neither surface uses a 3D turn or hard-cut substitute.
- Large-surface animations use transform/opacity only; computed animation does not interpolate filter, box-shadow, border-radius, left/top, width, or height.
- Reduced and off motion commit the route immediately with no spatial transition. After full-motion transitions, direction/transition attributes and inline transforms are cleaned.

## Remaining Notes

- P3: The frame is not a pixel-identical clone. Its denser header, existing icons, four-time palette, and compact actions are intentional because the user requested only the reference border layout and asked to preserve more readable content.
- P3: Browser antialiasing and local dynamic article/chat data can make individual lines differ between captures without changing the verified geometry.

final result: passed — desktop live-surface motion, six-item mobile Dock layout, Home-only Blog/About selection handling, 96-state zh/en/ja geometry, Dock collapse, and reduced/off cleanup were rechecked on query `20260711-calm-motion-r12` with zero UI failures or console errors
