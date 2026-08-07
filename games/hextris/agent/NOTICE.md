# Hextris Agent notices

## Upstream reference

Hextris Agent implements locally authored, compatible Hextris-style gameplay. The upstream Hextris project is available at:

<https://github.com/Hextris/hextris>

The upstream project identifies Logan Engstrom, Garrett Finucane, Noah Moroze, and Michael Yang as its creators and carries this copyright notice:

> Copyright (C) 2018 Logan Engstrom

The upstream repository states that Hextris is available under GNU GPL version 3 or, at the recipient's option, any later version. This notice preserves attribution; it does not claim that Hextris Agent is an official fork, an upstream-endorsed product, or the result of a strict clean-room process.

## Local history and changes

LuSu Personal Site added a compact, compatible local Hextris implementation in 2026. The deterministic Agent subsystem in this directory was newly added and changed on 2026-08-07 to provide:

- a seeded, deterministic state engine;
- isolated local session persistence and bounded state observations;
- compare-and-swap and idempotency controls for semantic lane placements;
- an explicit-confirmation reset and close flow;
- a standalone CLI; and
- a dedicated stdio MCP server with strict schemas.

Copyright (C) 2026 LuSu for the locally authored additions.

The Agent subsystem is distributed under GNU GPL version 3 or, at your option, any later version. The complete license text is in `COPYING` beside this notice. No warranty is provided.

## Corresponding source

The exact preferred-form source is published in the public LuSu Personal Site repository at:

<https://github.com/lusu575/lusu-personal-site/tree/main/games/hextris/agent>

For an immutable match, use the repository commit identified by the corresponding release and the `games/hextris/agent/` path at that commit. The source in this directory includes the engine, session store, CLI, MCP server, tests, build/run metadata, notices, and the scripts needed to run the subsystem.
