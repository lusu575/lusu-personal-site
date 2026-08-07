# Life Restart semantic adapter notice

The Life Restart browser source and the isolated semantic adapter are based on
the MIT-licensed upstream project identified below. This repository does not
represent the adapter as an official upstream release or endorsement.

Upstream reference and attribution:

- Project: 人生重开模拟器 / Life Restart
- Repository: https://github.com/VickScarlet/remake
- Legacy repository URL: https://github.com/VickScarlet/lifeRestart
- Pinned upstream commit: `a10861eed93296c96d0e0fca98c82e86f4dfda4b`
- Upstream copyright: Copyright (c) 2021 神戸小鳥
- Upstream license: MIT

Local implementation and changes:

- The site capability layer adds an isolated deterministic state machine,
  bounded persistent state, semantic actions, and current-life replay checks.
- The adapter loads only the pinned Chinese Custom-mode data bytes whose
  SHA-256 values are declared in the adapter source.
- The full upstream MIT license is preserved in `source/LICENSE.txt`.

The preferred source for modification is available in this public repository:
https://github.com/lusu575/lusu-personal-site/tree/main/games/life-restart
