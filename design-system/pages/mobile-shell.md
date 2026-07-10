# Mobile Shell Overrides

- Treat the browser viewport as the phone screen; never add a thick physical-device frame.
- Respect `env(safe-area-inset-*)`, with a compact status region, original island-inspired capsule, and generated bitmap network/Wi-Fi/battery artwork.
- Home Screen uses the existing four-time pixel world, profile/status widget, app grid, and the five-item full Dock.
- Home omits the large site headline, construction note, and divider. Its App grid fills left-to-right and top-to-bottom with fixed row heights; each tappable button hugs the visible icon/label box while remaining at least 44px.
- Existing route pages become full-height app surfaces with one 44px App bar, 8–16px edge margins, 44px touch targets, and only a slim bottom Home indicator. The repeated XP page titlebar, full Dock, account widget, and language control are hidden inside Apps; account and language remain available on Home.
- Every App uses a layered pixel frame: outer edge, toolbar/filter frame, tabs or category frame, and inset content scrollport. Frame colors follow the existing four-time Neo-XP tokens rather than a copied reference palette.
- The XP top bar and desktop taskbar do not appear as compressed desktop chrome. On Home, the existing account widget stays in place and is restyled; a 44px mobile language-cycle control delegates to the original three language buttons without owning language state.
- A visible Home control and bottom-edge swipe both return to Home; the gesture is never the only exit.
- Mobile cards are lists or adaptive grids, not nested desktop windows. Game actions use an in-card trailing column; chat input, count and send controls use separate grid cells. Text, metadata, controls and neighboring cards may not overlap in either orientation.
- Portrait and short landscape layouts must not scroll horizontally or hide the chat input, article progress, modal actions, or Home control.
- Treat content capacity as a release requirement: measure complete cards and structural child rectangles at 359×500, 375×667, 390×844 and 844×390; keep the Chat log at least 260px at 375×667 and 150px at 844×390; expose at least 44px of unobscured short-screen article body. Mobile article progress and the compact top control live in unused App-bar space rather than covering article text.
