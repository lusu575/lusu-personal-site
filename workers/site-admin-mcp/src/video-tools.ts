import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import {
  AgentVideoServiceError,
  createAgentVideoService,
  deleteAgentVideoService,
  getAgentVideoService,
  listAgentVideosService,
  refreshAgentVideoService,
  updateAgentVideoService
} from "../../../functions/api/agent-video-service.mjs";
import {
  McpOAuthLedgerError,
  assertActiveMcpOAuthGrant,
  mcpOAuthAuditIpHash,
  recordMcpOAuthAudit,
  revokeMcpOAuthGrant
} from "../../../functions/api/mcp-oauth-ledger.mjs";
import { CANONICAL_ISSUER, type OwnerScope } from "./constants";
import { safeErrorCode } from "./security";

export type OAuthVideoPrincipal = {
  authType: "oauth";
  userId: string;
  clientId: string;
  grantRef: string;
  resource: string;
  effectiveScopes: string[];
};

type VideoServiceResult = {
  status: number;
  payload: Record<string, unknown>;
};

type VideoToolExecution = {
  requiredScope: OwnerScope;
  capabilityId: string;
  toolName: string;
  action: string;
  operationId?: string;
  targetType?: string;
  targetId?: string;
  invoke: () => Promise<unknown>;
};

const VideoIdSchema = z.string().trim().min(1).max(180)
  .regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,179}$/);
const OperationIdSchema = z.string().min(8).max(80)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,79}$/);
const TimestampSchema = z.string().trim().max(64).refine(isIsoTimestampWithTimezone, {
  message: "Expected an ISO date-time with a timezone."
});
const OriginalUrlSchema = z.string().trim().min(1).max(800)
  .refine(isSupportedVideoReference, {
    message: "Only HTTPS YouTube, Bilibili, or b23.tv video references are accepted."
  });
const ThumbnailUrlSchema = z.string().trim().max(800)
  .refine(isApprovedThumbnailReference, {
    message: "Only approved HTTPS YouTube or Bilibili image hosts are accepted."
  });
const CategoryIdsSchema = z.array(VideoIdSchema).max(12)
  .refine((values) => new Set(values).size === values.length, {
    message: "Video category IDs must not contain duplicates."
  });
const SortOrderSchema = z.number().int().min(-1_000_000_000).max(1_000_000_000);
const StatusSchema = z.enum(["draft", "published", "hidden"]);

const PublishInputSchema = z.object({
  operationId: OperationIdSchema,
  originalUrl: OriginalUrlSchema,
  title: z.string().trim().min(1).max(220).optional(),
  description: z.string().trim().max(2_000).optional(),
  thumbnailUrl: ThumbnailUrlSchema.optional(),
  authorName: z.string().trim().max(160).optional(),
  publishedAt: TimestampSchema.nullable().optional(),
  sortOrder: SortOrderSchema.optional(),
  pinned: z.boolean().optional(),
  pinnedSortOrder: SortOrderSchema.optional(),
  categoryIds: CategoryIdsSchema.optional()
}).strict().superRefine((value, context) => {
  if (value.pinnedSortOrder !== undefined && value.pinned !== true) {
    context.addIssue({
      code: "custom",
      path: ["pinnedSortOrder"],
      message: "pinnedSortOrder requires pinned=true."
    });
  }
});

const UpdateInputSchema = z.object({
  videoId: VideoIdSchema,
  operationId: OperationIdSchema,
  expectedUpdatedAt: TimestampSchema,
  originalUrl: OriginalUrlSchema.optional(),
  title: z.string().trim().min(1).max(220).optional(),
  description: z.string().trim().max(2_000).optional(),
  thumbnailUrl: ThumbnailUrlSchema.optional(),
  authorName: z.string().trim().max(160).optional(),
  publishedAt: TimestampSchema.nullable().optional(),
  status: StatusSchema.optional(),
  sortOrder: SortOrderSchema.optional(),
  pinned: z.boolean().optional(),
  pinnedSortOrder: SortOrderSchema.optional(),
  categoryIds: CategoryIdsSchema.optional()
}).strict().refine((value) => [
  "originalUrl",
  "title",
  "description",
  "thumbnailUrl",
  "authorName",
  "publishedAt",
  "status",
  "sortOrder",
  "pinned",
  "pinnedSortOrder",
  "categoryIds"
].some((field) => Object.prototype.hasOwnProperty.call(value, field)), {
  message: "At least one video field must change."
});

const ReadOnlyAnnotations = Object.freeze({
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false
});
const PublishAnnotations = Object.freeze({
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true
});
const MutationAnnotations = Object.freeze({
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: false
});
const RefreshAnnotations = Object.freeze({
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true
});

export function registerVideoOwnerTools(
  server: McpServer,
  env: Env,
  principal: OAuthVideoPrincipal,
  request: Request
): void {
  server.registerTool(
    "video_manage_list",
    {
      title: "List managed external videos",
      description: "Lists bounded site-owner YouTube and Bilibili video records, including drafts and hidden records. This does not read or upload local files.",
      inputSchema: z.object({
        status: StatusSchema.optional(),
        platform: z.enum(["youtube", "bilibili"]).optional(),
        limit: z.number().int().min(1).max(200).default(50)
      }).strict(),
      annotations: ReadOnlyAnnotations,
      _meta: oauthToolMeta(["content:write"])
    },
    async (query) => executeVideoTool(env, principal, request, {
      requiredScope: "content:write",
      capabilityId: "content.videos.manage-list",
      toolName: "video_manage_list",
      action: "mcp-video-manage-list",
      targetType: "video-list",
      invoke: () => listAgentVideosService({ env, principal, query })
    })
  );

  server.registerTool(
    "video_manage_get",
    {
      title: "Get a managed external video",
      description: "Gets one full site-owner YouTube or Bilibili video record. This does not read or upload local files.",
      inputSchema: z.object({ videoId: VideoIdSchema }).strict(),
      annotations: ReadOnlyAnnotations,
      _meta: oauthToolMeta(["content:write"])
    },
    async ({ videoId }) => executeVideoTool(env, principal, request, {
      requiredScope: "content:write",
      capabilityId: "content.videos.manage-get",
      toolName: "video_manage_get",
      action: "mcp-video-manage-get",
      targetType: "video",
      targetId: videoId,
      invoke: () => getAgentVideoService({ env, principal, videoId })
    })
  );

  server.registerTool(
    "video_publish",
    {
      title: "Atomically publish an external video record",
      description: "Atomically publishes a YouTube or Bilibili external-link record, including b23.tv short links, with status=published. Only operationId and originalUrl are required; title and all other metadata fields are optional overrides. Omitted metadata is resolved from the bounded platform provider before publication. operationId makes retries safe. It never accepts local paths, base64, or video file bytes.",
      inputSchema: PublishInputSchema,
      annotations: PublishAnnotations,
      _meta: oauthToolMeta(["content:write"])
    },
    async (payload) => executeVideoTool(env, principal, request, {
      requiredScope: "content:write",
      capabilityId: "content.videos.publish",
      toolName: "video_publish",
      action: "mcp-video-publish",
      operationId: payload.operationId,
      targetType: "external-video-reference",
      targetId: payload.originalUrl,
      invoke: () => createAgentVideoService({
        env,
        principal,
        payload: { ...payload, status: "published" }
      })
    })
  );

  server.registerTool(
    "video_update",
    {
      title: "Update an external video record with CAS",
      description: "Updates a YouTube or Bilibili record only when expectedUpdatedAt still matches. operationId makes retries idempotent. It does not upload video bytes.",
      inputSchema: UpdateInputSchema,
      annotations: MutationAnnotations,
      _meta: oauthToolMeta(["content:write"])
    },
    async ({ videoId, ...payload }) => executeVideoTool(env, principal, request, {
      requiredScope: "content:write",
      capabilityId: "content.videos.update",
      toolName: "video_update",
      action: "mcp-video-update",
      operationId: payload.operationId,
      targetType: "video",
      targetId: videoId,
      invoke: () => updateAgentVideoService({ env, principal, videoId, payload })
    })
  );

  server.registerTool(
    "video_refresh_metadata",
    {
      title: "Refresh external video metadata with CAS",
      description: "Refreshes bounded metadata from the fixed YouTube or Bilibili provider endpoint only when expectedUpdatedAt matches. It does not fetch or upload video bytes.",
      inputSchema: z.object({
        videoId: VideoIdSchema,
        operationId: OperationIdSchema,
        expectedUpdatedAt: TimestampSchema
      }).strict(),
      annotations: RefreshAnnotations,
      _meta: oauthToolMeta(["content:write"])
    },
    async ({ videoId, ...payload }) => executeVideoTool(env, principal, request, {
      requiredScope: "content:write",
      capabilityId: "content.videos.refresh",
      toolName: "video_refresh_metadata",
      action: "mcp-video-refresh-metadata",
      operationId: payload.operationId,
      targetType: "video",
      targetId: videoId,
      invoke: () => refreshAgentVideoService({ env, principal, videoId, payload })
    })
  );

  server.registerTool(
    "video_delete",
    {
      title: "Permanently delete an external video record",
      description: "Permanently deletes a video record only with confirm=true, a matching expectedUpdatedAt, and a unique operationId.",
      inputSchema: z.object({
        videoId: VideoIdSchema,
        operationId: OperationIdSchema,
        expectedUpdatedAt: TimestampSchema,
        confirm: z.literal(true)
      }).strict(),
      annotations: MutationAnnotations,
      _meta: oauthToolMeta(["content:delete"])
    },
    async ({ videoId, ...payload }) => executeVideoTool(env, principal, request, {
      requiredScope: "content:delete",
      capabilityId: "content.videos.delete",
      toolName: "video_delete",
      action: "mcp-video-delete",
      operationId: payload.operationId,
      targetType: "video",
      targetId: videoId,
      invoke: () => deleteAgentVideoService({ env, principal, videoId, payload })
    })
  );
}

async function executeVideoTool(
  env: Env,
  principal: OAuthVideoPrincipal,
  request: Request,
  execution: VideoToolExecution
) {
  try {
    await assertActiveMcpOAuthGrant({
      env,
      principal,
      requiredScopes: [execution.requiredScope],
      requireAdmin: true,
      touch: true
    });
  } catch (error) {
    if (isAdminRevocationError(error)) {
      await revokeGrantSafely(env, principal, execution.toolName);
    }
    await recordToolAuditSafely(env, principal, request, execution, "error", safeErrorCode(error));
    return videoToolError(error, execution.requiredScope);
  }

  try {
    await recordToolAudit(env, principal, request, execution, "attempt", "");
  } catch (error) {
    logAuditFailure(execution.toolName, error);
    return failedToolResult("MCP tool audit failed.", "MCP_OAUTH_AUDIT_FAILED");
  }

  try {
    const result = normalizeServiceResult(await execution.invoke());
    await recordToolAuditSafely(env, principal, request, execution, "success", "");
    return successfulToolResult(result.payload);
  } catch (error) {
    if (isAdminRevocationError(error)) {
      await revokeGrantSafely(env, principal, execution.toolName);
    }
    await recordToolAuditSafely(
      env,
      principal,
      request,
      execution,
      "error",
      safeErrorCode(error)
    );
    return videoToolError(error, execution.requiredScope);
  }
}

async function recordToolAudit(
  env: Env,
  principal: OAuthVideoPrincipal,
  request: Request,
  execution: VideoToolExecution,
  result: "attempt" | "success" | "error",
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
    requestedScopes: [execution.requiredScope],
    action: execution.action,
    result,
    errorCode,
    ipHash: await mcpOAuthAuditIpHash(request, env)
  });
}

async function recordToolAuditSafely(
  env: Env,
  principal: OAuthVideoPrincipal,
  request: Request,
  execution: VideoToolExecution,
  result: "success" | "error",
  errorCode: string
): Promise<void> {
  try {
    await recordToolAudit(env, principal, request, execution, result, errorCode);
  } catch (error) {
    logAuditFailure(execution.toolName, error);
  }
}

function normalizeServiceResult(value: unknown): VideoServiceResult {
  if (!isPlainRecord(value)
    || typeof value.status !== "number"
    || !Number.isInteger(value.status)
    || !isPlainRecord(value.payload)) {
    throw new Error("Video service returned an invalid result.");
  }
  return { status: value.status, payload: value.payload };
}

function isAdminRevocationError(error: unknown): boolean {
  return (error instanceof McpOAuthLedgerError && error.code === "MCP_OAUTH_ADMIN_REQUIRED")
    || (error instanceof AgentVideoServiceError && error.code === "AGENT_ADMIN_REQUIRED");
}

async function revokeGrantSafely(
  env: Env,
  principal: OAuthVideoPrincipal,
  toolName: string
): Promise<void> {
  try {
    await revokeMcpOAuthGrant({
      env,
      grantRef: principal.grantRef,
      reason: "admin-role-lost"
    });
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

function videoToolError(error: unknown, requiredScope: OwnerScope) {
  if (error instanceof McpOAuthLedgerError) {
    const meta = error.status === 401 || error.code === "MCP_OAUTH_ADMIN_REQUIRED"
      ? oauthChallengeMeta([], "invalid_token")
      : error.code === "MCP_OAUTH_SCOPE_REQUIRED"
        ? oauthChallengeMeta([requiredScope], "insufficient_scope")
        : undefined;
    return failedToolResult(error.message, safeErrorCode(error), error.details, meta);
  }
  if (error instanceof AgentVideoServiceError) {
    const meta = error.code === "AGENT_ADMIN_REQUIRED"
      ? oauthChallengeMeta([], "invalid_token")
      : error.code === "AGENT_SCOPE_REQUIRED"
        ? oauthChallengeMeta([requiredScope], "insufficient_scope")
        : undefined;
    return failedToolResult(error.message, safeErrorCode(error), error.details, meta);
  }
  console.error(JSON.stringify({
    service: "lusu-site-admin-mcp",
    event: "mcp_video_tool_failed",
    code: safeErrorCode(error)
  }));
  return failedToolResult("The external video operation failed.", "VIDEO_OPERATION_FAILED");
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

function isSupportedVideoReference(value: string): boolean {
  if (/^BV[A-Za-z0-9]{10}$/.test(value)) return true;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return false;
    const host = normalizedHost(url.hostname);
    if (host === "b23.tv") return Boolean(url.pathname && url.pathname !== "/");
    if (host === "youtu.be") {
      return /^[A-Za-z0-9_-]{11}$/.test(url.pathname.split("/").filter(Boolean)[0] || "");
    }
    if (host === "youtube.com" || host === "m.youtube.com") {
      if (url.pathname === "/watch") {
        return /^[A-Za-z0-9_-]{11}$/.test(url.searchParams.get("v") || "");
      }
      return /^\/shorts\/[A-Za-z0-9_-]{11}(?:\/|$)/.test(url.pathname);
    }
    if (host === "bilibili.com" || host.endsWith(".bilibili.com")) {
      return /\/video\/BV[A-Za-z0-9]{10}(?:\/|$)/.test(url.pathname);
    }
    return false;
  } catch {
    return false;
  }
}

function isApprovedThumbnailReference(value: string): boolean {
  if (!value) return true;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return false;
    return new Set([
      "i.ytimg.com",
      "img.youtube.com",
      "i0.hdslb.com",
      "i1.hdslb.com",
      "i2.hdslb.com",
      "archive.biliimg.com"
    ]).has(normalizedHost(url.hostname));
  } catch {
    return false;
  }
}

function isIsoTimestampWithTimezone(value: string): boolean {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|([+-])(\d{2}):(\d{2}))$/
  );
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6] || 0);
  const offsetHour = Number(match[10] || 0);
  const offsetMinute = Number(match[11] || 0);
  if (year < 1 || month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) {
    return false;
  }
  if (offsetHour > 23 || offsetMinute > 59) return false;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day >= 1 && day <= daysInMonth && Number.isFinite(Date.parse(value));
}

function normalizedHost(value: string): string {
  return value.toLowerCase().replace(/^www\./, "");
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
