# Hextris Agent

Hextris Agent is a standalone, deterministic local simulation for CLI and MCP clients. It creates isolated sessions for AI play; it does not attach to, inspect, drive, or replace a Hextris game already open in a browser.

## Process and license boundary

This directory is a self-contained GPL-3.0-or-later program. Its engine, session store, CLI, stdio MCP server, and tests stay in this directory and do not import LuSu Personal Site's common `lib/capabilities/`, `cli/`, or `mcp/local/` modules. The repository may invoke the program as a separate process, but the standalone process owns its own sessions and protocol validation.

`private: true` in `package.json` only prevents accidental publication to the npm registry. It does not make the source proprietary or change the GPL rights described in `COPYING`.

The implementation is locally authored for compatible Hextris-style play. It is not an official Hextris fork and is not described as the product of a strict clean-room process. See [NOTICE.md](./NOTICE.md) for provenance and change information.

## Requirements

- Node.js 22.13 or newer.
- Repository-root dependencies installed, including `@modelcontextprotocol/server` and `zod`.

## Local state

Sessions stay on the local machine. By default they are stored in
`%APPDATA%\lusu-hextris-agent` on Windows and
`~/.config/lusu-hextris-agent` on other platforms. Set
`LUSU_HEXTRIS_AGENT_DIR` to an absolute, private writable directory to use a
different location, including for isolated automation and tests. Session files
expire within 24 hours; the program does not upload them or synchronize them
with browser or cloud saves.

## CLI

Run commands from the repository root:

```powershell
node games/hextris/agent/cli.mjs help
node games/hextris/agent/cli.mjs create --seed 123
node games/hextris/agent/cli.mjs observe SESSION_ID
node games/hextris/agent/cli.mjs actions SESSION_ID
node games/hextris/agent/cli.mjs act SESSION_ID --expected-revision 0 --client-action-id cli_place_0001 --lane 2
node games/hextris/agent/cli.mjs reset SESSION_ID --expected-revision 1 --client-action-id cli_reset_0001 --yes
node games/hextris/agent/cli.mjs close SESSION_ID --yes
```

The package script also forwards arguments to the CLI:

```powershell
npm.cmd --prefix games/hextris/agent run start:cli -- help
```

Placements accept lanes `0` through `5`. Mutations use an expected revision for compare-and-swap protection. Reusing the same `clientActionId` is only valid for an exact retry. Reset and close are destructive and require explicit confirmation.

## MCP

Start the dedicated stdio server directly:

```powershell
node games/hextris/agent/mcp-server.mjs
```

Example MCP client configuration:

```json
{
  "mcpServers": {
    "lusu-hextris-agent": {
      "command": "node",
      "args": [
        "<absolute-repository-path>/games/hextris/agent/mcp-server.mjs"
      ]
    }
  }
}
```

The server exposes only these bounded tools:

| Tool | Purpose | Safety |
| --- | --- | --- |
| `hextris_session_create` | Create an optional-seed isolated session | Local write; not idempotent |
| `hextris_session_observe` | Read a structured observation | Read-only |
| `hextris_session_actions` | List legal semantic actions | Read-only |
| `hextris_session_act` | Place one block in lane 0–5 | CAS-guarded; exact retries are idempotent |
| `hextris_session_reset` | Reset one run | Destructive; confirmation, CAS, and dedupe ID required |
| `hextris_session_close` | Remove one session | Destructive; confirmation required |

Selectors, scripts, URLs, arbitrary key events, arbitrary engine objects, and browser-control requests are not accepted.

## Verification

```powershell
npm.cmd --prefix games/hextris/agent run test
npm.cmd --prefix games/hextris/agent run check
```

The complete preferred-form source is published with the site repository. Use the exact repository commit associated with a release when matching source to deployed bytes.
