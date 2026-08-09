import { McpServer, type AuthInfo, type McpRequestContext } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";

import {
  AgentArticleServiceError,
  deleteAgentArticleService,
  getAgentArticleService,
  listAgentArticlesService,
  publishAgentArticleService,
  updateAgentArticleService
} from "../../../functions/api/agent-article-service.mjs";
import {
  McpOAuthLedgerError,
  assertActiveMcpOAuthGrant,
  mcpOAuthAuditIpHash,
  recordMcpOAuthAudit,
  revokeMcpOAuthGrant
} from "../../../functions/api/mcp-oauth-ledger.mjs";
import { registerSiteMcpSurface } from "../../site-mcp/src/index";
import {
  CANONICAL_ISSUER,
  MCP_PATH,
  MCP_RESOURCE,
  SERVER_NAME,
  SERVER_VERSION,
  type OwnerScope
} from "./constants";
import { safeErrorCode } from "./security";

type OAuthArticlePrincipal = {
  authType: "oauth";
  userId: string;
  clientId: string;
  grantRef: string;
  resource: string;
  effectiveScopes: string[];
};

type ArticleServiceResult = {
  status: number;
  payload: Record<string, unknown>;
};

type ArticleToolExecution = {
  requiredScope: OwnerScope;
  capabilityId: string;
  toolName: string;
  action: string;
  operationId?: string;
  targetType?: string;
  targetId?: string;
  invoke: () => Promise<unknown>;
};

const ArticleIdSchema = z.string().trim().min(1).max(180)
  .regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,179}$/);
const OperationIdSchema = z.string().min(8).max(80)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,79}$/);
const SlugSchema = z.string().trim().min(1).max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const CategorySchema = z.string().trim().min(1).max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const TimestampSchema = z.string().trim().min(1).max(64);
const TranslationSchema = z.object({
  title: z.string().trim().min(1).max(180),
  summary: z.string().trim().max(500).optional(),
  contentMarkdown: z.string().trim().min(1).max(200_000)
}).strict();
const CompleteTranslationsSchema = z.object({
  zh: TranslationSchema,
  en: TranslationSchema,
  ja: TranslationSchema
}).strict();
const PartialTranslationsSchema = z.object({
  zh: TranslationSchema.optional(),
  en: TranslationSchema.optional(),
  ja: TranslationSchema.optional()
}).strict().refine((value) => Object.values(value).some(Boolean), {
  message: "At least one translation is required."
});

const PublishInputSchema = z.object({
  operationId: OperationIdSchema,
  slug: SlugSchema,
  category: CategorySchema.optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
  coverImage: z.string().trim().max(500).optional(),
  isPinned: z.boolean().optional(),
  publishedAt: TimestampSchema.optional(),
  translations: CompleteTranslationsSchema
}).strict();

const UpdateInputSchema = z.object({
  articleId: ArticleIdSchema,
  operationId: OperationIdSchema,
  expectedUpdatedAt: TimestampSchema,
  slug: SlugSchema.optional(),
  category: CategorySchema.optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
  coverImage: z.string().trim().max(500).optional(),
  isPinned: z.boolean().optional(),
  publishedAt: TimestampSchema.nullable().optional(),
  translations: PartialTranslationsSchema.optional()
}).strict().refine((value) => [
  "slug",
  "category",
  "tags",
  "coverImage",
  "isPinned",
  "publishedAt",
  "translations"
].some((field) => Object.prototype.hasOwnProperty.call(value, field)), {
  message: "At least one article field must change."
});

const ReadOnlyAnnotations = Object.freeze({
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false
});
const CreateAnnotations = Object.freeze({
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

export const oauthApiHandler = {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const handler = createMcpHandler(
      async (requestContext) => createOwnerMcpServer(env, requestContext),
      {
        route: MCP_PATH,
        corsOptions: false,
        allowedHostnames: ["lusu575.com", "localhost", "127.0.0.1", "::1", "[::1]"],
        allowedOriginHostnames: ["lusu575.com", "localhost", "127.0.0.1", "::1", "[::1]"],
        onerror(error) {
          console.error(JSON.stringify({
            service: "lusu-site-admin-mcp",
            event: "mcp_handler_error",
            code: safeErrorCode(error)
          }));
        }
      }
    );
    try {
      const authInfo = await explicitOAuthAuthInfo(request, env);
      const principal = verifiedPrincipal(authInfo);
      await assertActiveMcpOAuthGrant({
        env,
        principal,
        requiredScopes: principal.effectiveScopes,
        requireAdmin: false,
        touch: false
      });
      return handler.fetch(request, { authInfo });
    } catch (error) {
      if (error instanceof McpOAuthLedgerError
        && (error.status === 401 || error.code === "MCP_OAUTH_SCOPE_REQUIRED")) {
        return invalidOAuthTokenResponse();
      }
      throw error;
    }
  }
} satisfies ExportedHandler<Env>;

async function explicitOAuthAuthInfo(request: Request, env: Env): Promise<AuthInfo> {
  const authorization = String(request.headers.get("Authorization") || "");
  if (!authorization.startsWith("Bearer ")) {
    throw new McpOAuthLedgerError(
      "A verified OAuth access token is required.",
      401,
      "MCP_OAUTH_TOKEN_REQUIRED"
    );
  }
  const accessToken = authorization.slice("Bearer ".length);
  if (!accessToken || accessToken.length > 4_096 || /\s/.test(accessToken)) {
    throw new McpOAuthLedgerError(
      "The OAuth access token is invalid.",
      401,
      "MCP_OAUTH_TOKEN_INVALID"
    );
  }

  const summary = await env.OAUTH_PROVIDER.unwrapToken(accessToken);
  const props = summary?.grant?.props;
  const audience = summary?.audience;
  const exactAudience = audience === MCP_RESOURCE
    || (Array.isArray(audience) && audience.length === 1 && audience[0] === MCP_RESOURCE);
  const scopes = summary?.scope;
  const grantScopes = summary?.grant?.scope;
  if (!summary
    || !exactAudience
    || !Number.isFinite(summary.expiresAt)
    || summary.expiresAt <= Math.floor(Date.now() / 1_000)
    || typeof summary.userId !== "string"
    || !summary.userId
    || typeof summary.grant.clientId !== "string"
    || !summary.grant.clientId
    || summary.grant.clientId.length > 2_048
    || !Array.isArray(scopes)
    || scopes.length < 1
    || scopes.length > 32
    || !scopes.every((scope) => typeof scope === "string")
    || !Array.isArray(grantScopes)
    || !grantScopes.every((scope) => typeof scope === "string")
    || !scopes.every((scope) => grantScopes.includes(scope))
    || !isPlainRecord(props)
    || props.version !== 1
    || props.userId !== summary.userId
    || typeof props.grantRef !== "string"
    || props.resource !== MCP_RESOURCE) {
    throw new McpOAuthLedgerError(
      "The OAuth access token is invalid or not bound to this MCP resource.",
      401,
      "MCP_OAUTH_TOKEN_INVALID"
    );
  }

  return {
    token: accessToken,
    clientId: summary.grant.clientId,
    scopes: [...new Set(scopes)].sort(),
    expiresAt: summary.expiresAt,
    resource: new URL(MCP_RESOURCE),
    extra: { props }
  };
}

function invalidOAuthTokenResponse(): Response {
  const resourceMetadata = `${CANONICAL_ISSUER}/.well-known/oauth-protected-resource/mcp`;
  return new Response(null, {
    status: 401,
    headers: {
      "Cache-Control": "no-store",
      "WWW-Authenticate": `Bearer realm="OAuth", resource_metadata="${resourceMetadata}", error="invalid_token", scope="content:read"`,
      "X-Content-Type-Options": "nosniff"
    }
  });
}

export async function createOwnerMcpServer(
  env: Env,
  requestContext: McpRequestContext
): Promise<McpServer> {
  const principal = verifiedPrincipal(requestContext.authInfo);

  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION
  });
  registerSiteMcpSurface(server, env, {
    toolMeta: oauthToolMeta(["content:read"]),
    includeResources: false
  });
  registerArticleOwnerTools(
    server,
    env,
    principal,
    requestContext.requestInfo || new Request(MCP_RESOURCE)
  );
  return server;
}

function registerArticleOwnerTools(
  server: McpServer,
  env: Env,
  principal: OAuthArticlePrincipal,
  request: Request
): void {
  server.registerTool(
      "article_manage_list",
      {
        title: "List managed knowledge articles",
        description: "Lists bounded draft, published, or archived knowledge articles for the site owner.",
        inputSchema: z.object({
          status: z.enum(["draft", "published", "archived"]).optional(),
          category: CategorySchema.optional(),
          limit: z.number().int().min(1).max(200).default(50)
        }).strict(),
        annotations: ReadOnlyAnnotations,
        _meta: oauthToolMeta(["content:write"])
      },
      async (query) => executeArticleTool(env, principal, request, {
        requiredScope: "content:write",
        capabilityId: "content.articles.manage-list",
        toolName: "article_manage_list",
        action: "mcp-article-manage-list",
        targetType: "article-list",
        invoke: () => listAgentArticlesService({ env, principal, query })
      })
    );

  server.registerTool(
      "article_manage_get",
      {
        title: "Get a managed knowledge article",
        description: "Gets one full managed article, including drafts and all available translations.",
        inputSchema: z.object({ articleId: ArticleIdSchema }).strict(),
        annotations: ReadOnlyAnnotations,
        _meta: oauthToolMeta(["content:write"])
      },
      async ({ articleId }) => executeArticleTool(env, principal, request, {
        requiredScope: "content:write",
        capabilityId: "content.articles.manage-get",
        toolName: "article_manage_get",
        action: "mcp-article-manage-get",
        targetType: "article",
        targetId: articleId,
        invoke: () => getAgentArticleService({ env, principal, articleId })
      })
    );

  server.registerTool(
      "article_publish",
      {
        title: "Atomically publish a trilingual knowledge article",
        description: "Atomically publishes one complete zh/en/ja article. operationId makes safe retries replay the same receipt. Governed categories are rejected.",
        inputSchema: PublishInputSchema,
        annotations: CreateAnnotations,
        _meta: oauthToolMeta(["content:write"])
      },
      async (payload) => executeArticleTool(env, principal, request, {
        requiredScope: "content:write",
        capabilityId: "content.articles.publish",
        toolName: "article_publish",
        action: "mcp-article-publish",
        operationId: payload.operationId,
        targetType: "article-slug",
        targetId: payload.slug,
        invoke: () => publishAgentArticleService({ env, principal, payload })
      })
    );

  server.registerTool(
      "article_update",
      {
        title: "Update a knowledge article with CAS",
        description: "Updates an ordinary article only when expectedUpdatedAt still matches. operationId makes retries idempotent.",
        inputSchema: UpdateInputSchema,
        annotations: DestructiveAnnotations,
        _meta: oauthToolMeta(["content:write"])
      },
      async ({ articleId, ...payload }) => executeArticleTool(env, principal, request, {
        requiredScope: "content:write",
        capabilityId: "content.articles.update",
        toolName: "article_update",
        action: "mcp-article-update",
        operationId: payload.operationId,
        targetType: "article",
        targetId: articleId,
        invoke: () => updateAgentArticleService({ env, principal, articleId, payload })
      })
    );

  server.registerTool(
      "article_delete",
      {
        title: "Permanently delete a knowledge article",
        description: "Permanently deletes an ordinary article only with confirm=true, a matching expectedUpdatedAt, and a unique operationId.",
        inputSchema: z.object({
          articleId: ArticleIdSchema,
          operationId: OperationIdSchema,
          expectedUpdatedAt: TimestampSchema,
          confirm: z.literal(true)
        }).strict(),
        annotations: DestructiveAnnotations,
        _meta: oauthToolMeta(["content:delete"])
      },
      async ({ articleId, ...payload }) => executeArticleTool(env, principal, request, {
        requiredScope: "content:delete",
        capabilityId: "content.articles.delete",
        toolName: "article_delete",
        action: "mcp-article-delete",
        operationId: payload.operationId,
        targetType: "article",
        targetId: articleId,
        invoke: () => deleteAgentArticleService({ env, principal, articleId, payload })
      })
    );
}

async function executeArticleTool(
  env: Env,
  principal: OAuthArticlePrincipal,
  request: Request,
  execution: ArticleToolExecution
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
    return toolErrorResult(error, execution.requiredScope);
  }

  try {
    await recordToolAudit(env, principal, request, execution, "attempt", "");
  } catch (auditError) {
    logToolAuditFailure(execution.toolName, auditError);
    return failedToolResult("MCP tool audit failed.", "MCP_OAUTH_AUDIT_FAILED");
  }

  try {
    const rawResult: unknown = await execution.invoke();
    const result = normalizeServiceResult(rawResult);
    await recordToolAuditSafely(env, principal, request, execution, "success", "");
    return successfulToolResult(result.payload);
  } catch (error) {
    const errorCode = safeErrorCode(error);
    if (isAdminRevocationError(error)) {
      await revokeGrantSafely(env, principal, execution.toolName);
    }
    await recordToolAuditSafely(env, principal, request, execution, "error", errorCode);
    if (error instanceof AgentArticleServiceError || error instanceof McpOAuthLedgerError) {
      return toolErrorResult(error, execution.requiredScope);
    }
    console.error(JSON.stringify({
      service: "lusu-site-admin-mcp",
      event: "mcp_tool_failed",
      tool: execution.toolName,
      code: errorCode
    }));
    return failedToolResult("The article operation failed.", "ARTICLE_OPERATION_FAILED");
  }
}

function isAdminRevocationError(error: unknown): boolean {
  return (error instanceof McpOAuthLedgerError && error.code === "MCP_OAUTH_ADMIN_REQUIRED")
    || (error instanceof AgentArticleServiceError && error.code === "AGENT_ADMIN_REQUIRED");
}

async function revokeGrantSafely(
  env: Env,
  principal: OAuthArticlePrincipal,
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

async function recordToolAudit(
  env: Env,
  principal: OAuthArticlePrincipal,
  request: Request,
  execution: ArticleToolExecution,
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
  principal: OAuthArticlePrincipal,
  request: Request,
  execution: ArticleToolExecution,
  result: "success" | "error",
  errorCode: string
): Promise<void> {
  try {
    await recordToolAudit(env, principal, request, execution, result, errorCode);
  } catch (auditError) {
    logToolAuditFailure(execution.toolName, auditError);
  }
}

function logToolAuditFailure(toolName: string, error: unknown): void {
  console.error(JSON.stringify({
    service: "lusu-site-admin-mcp",
    event: "mcp_tool_audit_failed",
    tool: toolName,
    code: safeErrorCode(error)
  }));
}

function verifiedPrincipal(authInfo: AuthInfo | undefined): OAuthArticlePrincipal {
  const extraProps = isPlainRecord(authInfo?.extra?.props) ? authInfo.extra.props : null;
  const props = extraProps;
  if (!authInfo || !props
    || props.version !== 1
    || typeof props.userId !== "string"
    || typeof props.grantRef !== "string"
    || props.resource !== MCP_RESOURCE
    || authInfo.resource?.toString() !== MCP_RESOURCE) {
    throw new McpOAuthLedgerError(
      "A verified OAuth principal is required.",
      401,
      "MCP_OAUTH_PRINCIPAL_REQUIRED"
    );
  }
  return {
    authType: "oauth",
    userId: props.userId,
    clientId: authInfo.clientId,
    grantRef: props.grantRef,
    resource: MCP_RESOURCE,
    effectiveScopes: [...new Set(authInfo.scopes)].sort()
  };
}

function normalizeServiceResult(value: unknown): ArticleServiceResult {
  if (!isPlainRecord(value)
    || typeof value.status !== "number"
    || !Number.isInteger(value.status)
    || !isPlainRecord(value.payload)) {
    throw new Error("Article service returned an invalid result.");
  }
  return { status: value.status, payload: value.payload };
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

function toolErrorResult(error: unknown, requiredScope: OwnerScope) {
  if (error instanceof McpOAuthLedgerError) {
    const challengeMeta = error.status === 401 || error.code === "MCP_OAUTH_ADMIN_REQUIRED"
      ? oauthChallengeMeta([], "invalid_token")
      : error.code === "MCP_OAUTH_SCOPE_REQUIRED"
        ? oauthChallengeMeta([requiredScope], "insufficient_scope")
        : undefined;
    return failedToolResult(
      error.message,
      safeErrorCode(error),
      error.details,
      challengeMeta
    );
  }
  if (error instanceof AgentArticleServiceError) {
    return failedToolResult(
      error.message,
      safeErrorCode(error),
      error.details,
      error.code === "AGENT_ADMIN_REQUIRED"
        ? oauthChallengeMeta([], "invalid_token")
        : undefined
    );
  }
  console.error(JSON.stringify({
    service: "lusu-site-admin-mcp",
    event: "mcp_tool_failed",
    code: safeErrorCode(error)
  }));
  return failedToolResult("The article operation failed.", "ARTICLE_OPERATION_FAILED");
}

function oauthToolMeta(scopes: OwnerScope[]): Record<string, unknown> {
  return {
    securitySchemes: [{ type: "oauth2", scopes: [...scopes] }]
  };
}

function oauthChallengeMeta(
  scopes: OwnerScope[],
  error: "invalid_token" | "insufficient_scope"
): Record<string, unknown> {
  const scopeParameter = scopes.length ? `, scope="${scopes.join(" ")}"` : "";
  const challenge = `Bearer realm="OAuth", resource_metadata="${CANONICAL_ISSUER}/.well-known/oauth-protected-resource/mcp", error="${error}"${scopeParameter}`;
  return { "mcp/www_authenticate": [challenge] };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
