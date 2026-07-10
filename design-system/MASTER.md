# LuSu Personal Site — Neo-XP / Pocket Pixel OS

Last updated: 2026-07-11

## Product Direction

The public site is one personal operating system with one shared route, content, account, video, game, and chat state.

- Desktop shell: **Neo-XP / Pixel Glass OS** — recognizable Windows XP structure, pixel art, Y2K warmth, crisp window depth, restrained glass, and spatial motion.
- Mobile shell: **Pocket Pixel OS** — an original iOS-inspired full-viewport phone interface with safe areas, status bar, compact island, Home Screen, app grid, a Home-only Dock, single-bar App navigation, and a Home gesture/control.
- The memorable idea is the same personal world changing presentation shell without duplicating business state.

Avoid modern landing-page composition, generic white-card dashboards, excessive blur, constant bouncing, autoplay sound, particle trails, copied Apple artwork, emoji icons, and CSS-drawn substitute artwork.

## Shared Tokens

```css
:root {
  --ui-instant: 90ms;
  --ui-fast: 160ms;
  --ui-normal: 260ms;
  --ui-window: 380ms;
  --ui-scene: 680ms;
  --ui-ease-standard: cubic-bezier(.2, .8, .2, 1);
  --ui-ease-emphasized: cubic-bezier(.16, 1, .3, 1);

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-7: 48px;

  --radius-pixel: 6px;
  --radius-window: 12px;
  --radius-card: 14px;
  --radius-mobile: 22px;
  --radius-pill: 999px;

  --z-wallpaper: 0;
  --z-content: 10;
  --z-chrome: 80;
  --z-popover: 120;
  --z-modal: 180;
  --z-system: 220;
}
```

## Color and Material

- Keep the four shared themes: morning is cream/cyan, day is sky blue, dusk is peach/violet, night is indigo/navy.
- Text contrast must reach WCAG 2.2 AA: 4.5:1 for normal text and 3:1 for large text or UI boundaries.
- Glass is limited to compact chrome: top HUD, taskbar/Dock, status bar, popovers, and modal navigation. Content surfaces remain readable and mostly opaque.
- Borders combine one bright inner highlight, one pixel-dark outer edge, and one soft depth shadow. Do not stack multiple diffuse glows.
- Error, success, loading, and disabled states use both color and text/state treatment.

## Typography

- Desktop: Tahoma, Verdana, Microsoft YaHei, Yu Gothic, MS PGothic, sans-serif.
- Mobile: -apple-system, BlinkMacSystemFont, Segoe UI, Microsoft YaHei, Yu Gothic, sans-serif.
- Mobile body text is at least 16px with 1.45–1.65 line height. Compact metadata may use 12–14px.
- Preserve the dense, friendly XP voice; avoid oversized marketing headlines.

## Interaction States

Every interactive control supports default, hover where available, pressed, focus-visible, disabled, loading, success, and error.

- Touch targets: minimum 44×44 CSS px, with at least 8px separation.
- Pressed: 1–2px displacement, compressed shadow, and highlight change.
- Hover: only inside `@media (hover: hover) and (pointer: fine)`.
- Focus: yellow pixel/glass ring with a dark separation edge.
- Primary actions remain single tap; no double-click requirement.
- Gesture actions always have a visible button alternative.

## Motion

- Route/module navigation uses a directional physical-page turn on `.site-shell`, so the top chrome, active content, and bottom chrome move as one sheet; the root snapshot does not crossfade, and the arriving window does not run a second scale-in. Window minimize/close, modal, and theme transitions remain separate motion families.
- Browsers without View Transitions fold the outgoing page before revealing the incoming page without cloning business DOM.
- Route/app closing returns toward its source and restores focus.
- Use transform and opacity for animation. Avoid frame-by-frame left/top, width, or height changes.
- Use View Transitions progressively; CSS/Web Animations fallback must preserve the same state semantics.
- Wallpaper parallax is one requestAnimationFrame loop, desktop/fine-pointer only, capped at 6px, paused while hidden, and disabled for reduced motion.
- `data-motion="reduced"` removes spatial travel while keeping short opacity feedback; `off` removes nonessential animation.

## Shell Contract

- `data-ui-shell="desktop|mobile"` and `data-motion="full|reduced|off"` live on the root and body.
- The shell breakpoint centers on 760px and also considers coarse pointers and short landscape viewports; user agent detection is not used.
- Desktop and mobile reuse the existing `.page`, route IDs, article/video/game/chat DOM, API calls, and state objects.
- High-coupling controls are never cloned or reparented; duplicate IDs, duplicate account widgets, duplicate API requests, and parallel route state are forbidden. Presentation adapters observe and delegate to the existing DOM in place.

## Accessibility and Safety

- Logical DOM reading order, visible keyboard focus, modal focus trap, Escape close, and trigger-focus restoration are required.
- Decorative generated assets use empty alt text; meaningful content images keep localized alt text.
- Chat, account, article, video, and external data remain DOM/textContent rendered.
- Password-room password/key/draft data never enters URL, storage, analytics, logs, or visible debugging UI.

## Verification Viewports

- Desktop: 1440×900 and 1280×720.
- Mobile portrait: 390×844, 375×667, and 430×932.
- Mobile landscape: 844×390.
- Shell boundary: 760px mobile and 761px desktop.
- Check Home plus Knowledge, Videos, Resources, Games, Chat, About, account popover, welcome modal, video modal, and an `/articles/<slug>?lang=` direct link.
- Capacity checks accompany overflow checks: App surfaces use at least 80% of viewport height, Games fills its scrollport, Chat retains a meaningful log, and the article body exposes at least 44px before fixed reading controls.
