# MiniMax H3 local Runner

This is the site owner's local execution plane. It is not Pages production code and it is not a ComfyUI UI proxy.

## Current status

The P2 Runner implementation has passed the repository regression tests and the real local preflight against the pinned controller. The controller doctor and a temporary reference-free T2V plan validation also passed against the local ComfyUI instance. No GPU job was submitted during that verification.

Production execution and transfer remain disabled until the owner completes the Agent device authorization, local service setup, Bridge/Tunnel/Access review, production D1/Pages release, and one explicit GPU canary. The P3 Bridge implementation is loopback-only and is not a public Tunnel by itself.

## Boundaries

The Runner only:

- uses an explicitly authorized `minimax-h3:execute` admin Agent bearer;
- invokes the hash-pinned `h3_local.py` controller with ComfyUI fixed to `127.0.0.1:8188`;
- keeps its loopback Bridge on `127.0.0.1:8791`; an outer Tunnel/Access layer is required before any remote reachability;
- stores only bounded job state and hashes in the local spool, protected by an atomic writer and single-instance lock;
- enters reconciliation/stalled handling when submission is uncertain and never retries a possibly submitted GPU job automatically.
- exchanges a short-lived owner ticket through the site API and streams only the verified result for that job; the Bridge supports `HEAD`, full `GET`, and one byte `Range` without buffering the file in memory.

It does not start, stop, restart, or kill ComfyUI, and it does not accept arbitrary workflows, nodes, paths, commands, environment variables, or URLs. Media bytes are not sent to D1, R2, KV, Durable Objects, Pages assets, or a CDN. The Bridge has no catch-all file route and only reads a verified `result.<ext>` inside the job spool.

## Local configuration

Copy `config.example.json` to an ignored `config.json` and replace only the owner-controlled values. Store the Agent bearer in the ignored token file configured by `tokenFile`. Never commit either file or print its contents.

The example points at the production site over HTTPS but leaves the runner ID, token path, and state path as placeholders. The fixed controller and workflow paths are compiled into the adapter and are not configurable through JSON.

## Checks

From the repository root:

```powershell
node agents/minimax-h3-runner/src/main.mjs --doctor --config agents/minimax-h3-runner/config.json
node agents/minimax-h3-runner/src/main.mjs --preflight --config agents/minimax-h3-runner/config.json
node --test tests/minimax-h3-runner.test.mjs
```

The first two commands require a valid local config and a running ComfyUI instance. They do not start or stop that instance. A real GPU canary is a separate, owner-approved step.
