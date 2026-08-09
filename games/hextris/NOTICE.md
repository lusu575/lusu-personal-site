# Hextris compatibility implementation notice

The browser game in `source/` is a compact Hextris-compatible implementation
maintained for LuSu's Personal Site. It is not a snapshot of, and is not
represented as an official fork of, the upstream Hextris repository.

For conservative license compliance, this implementation is distributed under
GNU GPL version 3 or, at your option, any later version. The complete license is
in `source/COPYING`.

Upstream reference and attribution:

- Project: Hextris
- Repository: https://github.com/Hextris/hextris
- Reference branch: `gh-pages`
- Reference commit reviewed on 2026-08-07:
  `3f4847dc8fd7dab3d1c87e6324b9159d92fbd396`
- Upstream notice: Copyright (C) 2018 Logan Engstrom
- Upstream license: GPL-3.0-or-later

Local implementation and changes:

- Copyright (C) 2026 LuSu
- Initial site-compatible implementation added 2026-06-11.
- Site changes include a simplified six-lane model, trilingual interface text,
  responsive presentation, and local save integration.
- License notices were completed on 2026-08-07.
- A separate deterministic Agent engine, dedicated CLI, and dedicated stdio MCP
  server were added on 2026-08-07 under `agent/`. They run as a standalone GPL
  process and do not import the site's general CLI or MCP implementation.
- The browser source gained an audited semantic-control bridge on 2026-08-09.
  While AI control is active it freezes real-time falling and accepts only
  revision-bound lane placement or confirmed reset actions.

The preferred source for modification is the unminified source in this public
repository: https://github.com/lusu575/lusu-personal-site/tree/main/games/hextris
The browser-delivered JavaScript is also served in source form. The software is
provided without warranty, as described by the GPL.
