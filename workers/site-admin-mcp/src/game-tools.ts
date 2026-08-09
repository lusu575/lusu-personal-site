import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import {
  McpOAuthLedgerError,
  assertActiveMcpOAuthGrant,
  mcpOAuthAuditIpHash,
  recordMcpOAuthAudit,
  revokeMcpOAuthGrant
} from "../../../functions/api/mcp-oauth-ledger.mjs";
import {
  CANONICAL_ISSUER,
  type OwnerScope
} from "./constants";
import {
  GameRelayError,
  gameRelayControllerId,
  gameRelaySessionId,
  relayControllerRequest
} from "./game-relay";
import { safeErrorCode } from "./security";

export type OAuthGamePrincipal = {
  authType: "oauth";
  userId: string;
  clientId: string;
  grantRef: string;
  resource: string;
  effectiveScopes: string[];
};

type GameToolExecution = {
  capabilityId: string;
  toolName: string;
  action: string;
  operationId?: string;
  targetType?: string;
  targetId?: string;
  invoke: () => Promise<Record<string, unknown>>;
};

const SessionIdSchema = z.string().regex(/^[a-f0-9]{64}$/);
const PairingCodeSchema = z.string().trim().min(26).max(64)
  .regex(/^[A-Za-z2-7 -]+$/);
const ClientActionIdSchema = z.string().min(8).max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/);
const ActionIdSchema = z.string().length(26)
  .regex(/^act_[A-Za-z0-9_-]{22}$/);

const ReadOnlyAnnotations = Object.freeze({
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false
});
const ControlAnnotations = Object.freeze({
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false
});
const DestructiveAnnotations = Object.freeze({
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: false
});

export function registerGameOwnerTools(
  server: McpServer,
  env: Env,
  principal: OAuthGamePrincipal,
  request: Request
): void {
  server.registerTool(
    "game_browser_pair",
    {
      title: "Pair an open browser game",
      description: "Pairs this OAuth client with an owner-approved browser game code. The code is one-time, owner-bound, and expires after five minutes. Always call game_browser_observe or game_browser_actions after pairing before acting.",
      inputSchema: z.object({ pairingCode: PairingCodeSchema }).strict(),
      annotations: ControlAnnotations,
      _meta: oauthToolMeta(["games:play"])
    },
    async ({ pairingCode }) => executeGameTool(env, principal, request, {
      capabilityId: "games.browser.pair",
      toolName: "game_browser_pair",
      action: "mcp-game-browser-pair",
      targetType: "browser-game-pair",
      invoke: async () => {
        const sessionId = await gameRelaySessionId(pairingCode);
        return relayControllerRequest(env, {
          sessionId,
          ownerUserId: principal.userId,
          controllerId: await controllerId(principal),
          path: "/controller/pair"
        });
      }
    })
  );

  server.registerTool(
    "game_browser_observe",
    {
      title: "Observe the paired browser game",
      description: "Requests a fresh bounded semantic snapshot while active. While paused, it returns the cached semantic snapshot and sends a transport-only pong to the browser; clients waiting for the owner to resume must call this tool at least once every 20 seconds. It never reads the DOM or captures the screen.",
      inputSchema: z.object({ sessionId: SessionIdSchema }).strict(),
      annotations: ReadOnlyAnnotations,
      _meta: oauthToolMeta(["games:play"])
    },
    async ({ sessionId }) => executeGameTool(env, principal, request, {
      capabilityId: "games.browser.observe",
      toolName: "game_browser_observe",
      action: "mcp-game-browser-observe",
      targetType: "browser-game-session",
      targetId: sessionId,
      invoke: async () => freshSnapshot(env, principal, sessionId)
    })
  );

  server.registerTool(
    "game_browser_actions",
    {
      title: "List actions for the paired browser game",
      description: "Returns the opaque action IDs currently offered by the browser game at its latest revision.",
      inputSchema: z.object({ sessionId: SessionIdSchema }).strict(),
      annotations: ReadOnlyAnnotations,
      _meta: oauthToolMeta(["games:play"])
    },
    async ({ sessionId }) => executeGameTool(env, principal, request, {
      capabilityId: "games.browser.actions",
      toolName: "game_browser_actions",
      action: "mcp-game-browser-actions",
      targetType: "browser-game-session",
      targetId: sessionId,
      invoke: async () => {
        const snapshot = await freshSnapshot(env, principal, sessionId);
        if (snapshot.status === "pending") return snapshot;
        return {
          protocolVersion: snapshot.protocolVersion,
          sessionId: snapshot.sessionId,
          gameId: snapshot.gameId,
          state: snapshot.state,
          revision: snapshot.revision,
          actions: snapshot.actions,
          stale: snapshot.stale === true
        };
      }
    })
  );

  server.registerTool(
    "game_browser_act",
    {
      title: "Perform one browser game action",
      description: "Performs exactly one currently advertised opaque action ID with revision CAS and clientActionId replay protection. Raw scripts, selectors, keys, coordinates, and action objects are not accepted.",
      inputSchema: z.object({
        sessionId: SessionIdSchema,
        expectedRevision: z.number().int().min(0).max(1_000_000_000),
        clientActionId: ClientActionIdSchema,
        actionId: ActionIdSchema,
        confirm: z.boolean().optional()
      }).strict(),
      annotations: ControlAnnotations,
      _meta: oauthToolMeta(["games:play"])
    },
    async ({ sessionId, expectedRevision, clientActionId, actionId, confirm }) => (
      executeGameTool(env, principal, request, {
        capabilityId: "games.browser.act",
        toolName: "game_browser_act",
        action: "mcp-game-browser-act",
        operationId: clientActionId,
        targetType: "browser-game-session",
        targetId: sessionId,
        invoke: async () => {
          const start = await relayControllerRequest(env, {
            sessionId,
            ownerUserId: principal.userId,
            controllerId: await controllerId(principal),
            path: "/controller/act",
            body: {
              expectedRevision,
              clientActionId,
              actionId,
              ...(confirm === undefined ? {} : { confirm })
            }
          });
          return waitForCommand(env, principal, sessionId, start);
        }
      })
    )
  );

  server.registerTool(
    "game_browser_pause",
    {
      title: "Pause AI control of a browser game",
      description: "Immediately pauses AI control. Only the owner in the browser can resume the session. While waiting, call game_browser_observe at least once every 20 seconds to keep the paired browser transport live.",
      inputSchema: z.object({ sessionId: SessionIdSchema }).strict(),
      annotations: ControlAnnotations,
      _meta: oauthToolMeta(["games:play"])
    },
    async ({ sessionId }) => executeGameTool(env, principal, request, {
      capabilityId: "games.browser.pause",
      toolName: "game_browser_pause",
      action: "mcp-game-browser-pause",
      targetType: "browser-game-session",
      targetId: sessionId,
      invoke: async () => relayControllerRequest(env, {
        sessionId,
        ownerUserId: principal.userId,
        controllerId: await controllerId(principal),
        path: "/controller/pause"
      })
    })
  );

  server.registerTool(
    "game_browser_close",
    {
      title: "Close a browser game control session",
      description: "Permanently closes this pairing and releases browser control. A new pairing code is required afterward.",
      inputSchema: z.object({
        sessionId: SessionIdSchema,
        confirm: z.literal(true)
      }).strict(),
      annotations: DestructiveAnnotations,
      _meta: oauthToolMeta(["games:play"])
    },
    async ({ sessionId }) => executeGameTool(env, principal, request, {
      capabilityId: "games.browser.close",
      toolName: "game_browser_close",
      action: "mcp-game-browser-close",
      targetType: "browser-game-session",
      targetId: sessionId,
      invoke: async () => relayControllerRequest(env, {
        sessionId,
        ownerUserId: principal.userId,
        controllerId: await controllerId(principal),
        path: "/controller/close",
        body: { confirm: true }
      })
    })
  );
}

async function freshSnapshot(
  env: Env,
  principal: OAuthGamePrincipal,
  sessionId: string
): Promise<Record<string, unknown>> {
  const start = await relayControllerRequest(env, {
    sessionId,
    ownerUserId: principal.userId,
    controllerId: await controllerId(principal),
    path: "/controller/observe"
  });
  return waitForCommand(env, principal, sessionId, start);
}

async function waitForCommand(
  env: Env,
  principal: OAuthGamePrincipal,
  sessionId: string,
  start: Record<string, unknown>
): Promise<Record<string, unknown>> {
  if (start.status === "completed" && isPlainRecord(start.output)) return start.output;
  const commandId = typeof start.commandId === "string" ? start.commandId : "";
  if (start.status !== "pending" || !commandId) {
    throw new GameRelayError("The relay returned an invalid command status.", 502, "GAME_RELAY_RESPONSE_INVALID");
  }
  const controller = await controllerId(principal);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await delay(60);
    const result = await relayControllerRequest(env, {
      sessionId,
      ownerUserId: principal.userId,
      controllerId: controller,
      path: "/controller/result",
      body: { commandId }
    });
    if (result.status === "completed" && isPlainRecord(result.output)) return result.output;
    if (result.status !== "pending") {
      throw new GameRelayError("The relay returned an invalid command status.", 502, "GAME_RELAY_RESPONSE_INVALID");
    }
  }
  return {
    ok: true,
    status: "pending",
    sessionId,
    commandId,
    retryable: true
  };
}

async function executeGameTool(
  env: Env,
  principal: OAuthGamePrincipal,
  request: Request,
  execution: GameToolExecution
) {
  try {
    await assertActiveMcpOAuthGrant({
      env,
      principal,
      requiredScopes: ["games:play"],
      requireAdmin: true,
      touch: true
    });
  } catch (error) {
    if (isAdminRevocationError(error)) await revokeGrantSafely(env, principal, execution.toolName);
    await recordToolAuditSafely(env, principal, request, execution, "error", safeErrorCode(error));
    return gameToolError(error);
  }

  try {
    await recordToolAudit(env, principal, request, execution, "attempt", "");
  } catch (error) {
    logAuditFailure(execution.toolName, error);
    return auditFailedToolResult();
  }

  let output: Record<string, unknown>;
  try {
    output = await execution.invoke();
  } catch (error) {
    if (isAdminRevocationError(error)) await revokeGrantSafely(env, principal, execution.toolName);
    try {
      await recordToolAudit(env, principal, request, execution, "error", safeErrorCode(error));
    } catch (auditError) {
      logAuditFailure(execution.toolName, auditError);
      return auditFailedToolResult();
    }
    return gameToolError(error);
  }

  const outcome = output.status === "pending"
    ? "pending"
    : output.ok === false
      ? "error"
      : "success";
  const outcomeErrorCode = outcome === "error" ? safeErrorCode(output.error) : "";
  try {
    await recordToolAudit(env, principal, request, execution, outcome, outcomeErrorCode);
  } catch (error) {
    logAuditFailure(execution.toolName, error);
    return auditFailedToolResult();
  }
  return successfulToolResult(output);
}

async function recordToolAudit(
  env: Env,
  principal: OAuthGamePrincipal,
  request: Request,
  execution: GameToolExecution,
  result: "attempt" | "pending" | "success" | "error",
  errorCode: string
): Promise<void> {
  await recordMcpOAuthAudit({
    env,
    principal,
    capabilityId: execution.capabilityId,
    toolName: execution.toolName,
    operationId: execution.operationId || "",
    targetType: execution.targetType || "",
    targetId: execution.targetId || "",
    requestedScopes: ["games:play"],
    action: execution.action,
    result,
    errorCode,
    ipHash: await mcpOAuthAuditIpHash(request, env)
  });
}

async function recordToolAuditSafely(
  env: Env,
  principal: OAuthGamePrincipal,
  request: Request,
  execution: GameToolExecution,
  result: "success" | "error",
  errorCode: string
): Promise<void> {
  try {
    await recordToolAudit(env, principal, request, execution, result, errorCode);
  } catch (error) {
    logAuditFailure(execution.toolName, error);
  }
}

function isAdminRevocationError(error: unknown): boolean {
  return error instanceof McpOAuthLedgerError && error.code === "MCP_OAUTH_ADMIN_REQUIRED";
}

function auditFailedToolResult() {
  return failedToolResult("MCP tool audit failed.", "MCP_OAUTH_AUDIT_FAILED");
}

async function revokeGrantSafely(
  env: Env,
  principal: OAuthGamePrincipal,
  toolName: string
): Promise<void> {
  try {
    await revokeMcpOAuthGrant({ env, grantRef: principal.grantRef, reason: "admin-role-lost" });
  } catch (error) {
    console.error(JSON.stringify({
      service: "lusu-site-admin-mcp",
      event: "mcp_grant_revocation_failed",
      tool: toolName,
      code: safeErrorCode(error)
    }));
  }
}

function logAuditFailure(toolName: string, error: unknown): void {
  console.error(JSON.stringify({
    service: "lusu-site-admin-mcp",
    event: "mcp_tool_audit_failed",
    tool: toolName,
    code: safeErrorCode(error)
  }));
}

function gameToolError(error: unknown) {
  if (error instanceof McpOAuthLedgerError) {
    const meta = error.status === 401 || error.code === "MCP_OAUTH_ADMIN_REQUIRED"
      ? oauthChallengeMeta([], "invalid_token")
      : error.code === "MCP_OAUTH_SCOPE_REQUIRED"
        ? oauthChallengeMeta(["games:play"], "insufficient_scope")
        : undefined;
    return failedToolResult(error.message, safeErrorCode(error), error.details, meta);
  }
  if (error instanceof GameRelayError) {
    return failedToolResult(error.message, error.code, error.details);
  }
  console.error(JSON.stringify({
    service: "lusu-site-admin-mcp",
    event: "mcp_game_tool_failed",
    code: safeErrorCode(error)
  }));
  return failedToolResult("The browser game operation failed.", "GAME_BROWSER_OPERATION_FAILED");
}

function successfulToolResult(output: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(output) }],
    structuredContent: output
  };
}

function failedToolResult(
  message: string,
  code: string,
  details: unknown = null,
  meta?: Record<string, unknown>
) {
  const output = { error: message, code, details };
  return {
    isError: true,
    content: [{ type: "text" as const, text: JSON.stringify(output) }],
    structuredContent: output,
    ...(meta ? { _meta: meta } : {})
  };
}

function oauthToolMeta(scopes: OwnerScope[]): Record<string, unknown> {
  return { securitySchemes: [{ type: "oauth2", scopes: [...scopes] }] };
}

function oauthChallengeMeta(
  scopes: OwnerScope[],
  error: "invalid_token" | "insufficient_scope"
): Record<string, unknown> {
  const scopeParameter = scopes.length ? `, scope="${scopes.join(" ")}"` : "";
  const challenge = `Bearer realm="OAuth", resource_metadata="${CANONICAL_ISSUER}/.well-known/oauth-protected-resource/mcp", error="${error}"${scopeParameter}`;
  return { "mcp/www_authenticate": [challenge] };
}

function controllerId(principal: OAuthGamePrincipal): Promise<string> {
  return gameRelayControllerId(principal.grantRef, principal.clientId);
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
