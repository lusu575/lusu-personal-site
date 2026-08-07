import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";

import {
  DailyAiNewsPublishError,
  publishDailyAiNews
} from "../../../lib/capabilities/daily-ai-news-publish-adapter.mjs";
import {
  AccessAuthError,
  type AccessIdentity,
  verifyAccessRequest
} from "./access-auth";

type RuntimeEnv = Env & {
  TEAM_DOMAIN?: string;
  POLICY_AUD?: string;
  OWNER_EMAIL?: string;
  MCP_HOSTNAME?: string;
};

type RuntimeDependencies = {
  fetchImpl?: typeof fetch;
  sleep?: (delayMs: number) => Promise<void>;
};

const SERVER_NAME = "lusu-daily-ai-news-mcp";
const SERVER_VERSION = "0.1.0";
const LANGUAGES = ["zh", "en", "ja"] as const;

const TranslationSchema = z.object({
  title: z.string().trim().min(1).max(180),
  summary: z.string().trim().min(1).max(500),
  content_markdown: z.string().trim().min(120).max(60_000)
}).strict();

const PublishInputSchema = z.object({
  reportDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  translations: z.object({
    zh: TranslationSchema,
    en: TranslationSchema,
    ja: TranslationSchema
  }).strict()
}).strict();

const PublishOutputSchema = z.object({
  ok: z.literal(true),
  duplicate: z.boolean(),
  slug: z.string(),
  category: z.literal("daily-ai-news"),
  status: z.literal("published"),
  publishedAt: z.string(),
  readbackVerified: z.literal(true),
  titles: z.object({
    zh: z.string(),
    en: z.string(),
    ja: z.string()
  })
});

const PublishAnnotations = Object.freeze({
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true
});

function jsonResponse(body: Record<string, unknown>, status = 200, extraHeaders?: HeadersInit) {
  const headers = new Headers(extraHeaders);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "no-referrer");
  return new Response(JSON.stringify(body), { status, headers });
}

function successResult(output: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(output) }],
    structuredContent: output
  };
}

function failureResult(code: string, message: string) {
  return {
    isError: true,
    content: [{ type: "text" as const, text: JSON.stringify({ ok: false, code, message }) }]
  };
}

function logFailure(operation: string, error: unknown): void {
  console.error(JSON.stringify({
    service: SERVER_NAME,
    operation,
    code: error instanceof DailyAiNewsPublishError || error instanceof AccessAuthError
      ? error.code
      : "UNEXPECTED_FAILURE"
  }));
}

export function createDailyAiNewsMcpServer(
  env: RuntimeEnv,
  _identity: AccessIdentity,
  dependencies: RuntimeDependencies = {}
): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

  server.registerTool(
    "publish_daily_ai_news",
    {
      title: "Publish an owner-confirmed Daily AI News article",
      description: "Publishes one owner-confirmed zh/en/ja Daily AI News article for the current Asia/Shanghai report date. The current server validates article shape but does not independently prove that the complete editorial run passed; scheduled callers must not use this tool until that proof is implemented and verified. The slug, category, status, tags, cover, pin state, timestamps, and database target are server-controlled. Identical retries are safe; different content for an existing date is rejected. This tool writes only the final article and its three translations.",
      inputSchema: PublishInputSchema,
      outputSchema: PublishOutputSchema,
      annotations: PublishAnnotations
    },
    async (input) => {
      try {
        const readbackOrigin = `https://${String(env.MCP_HOSTNAME || "").trim().toLowerCase()}`;
        const output = await publishDailyAiNews(env.DB, input, {
          ...dependencies,
          readbackOrigin
        });
        return successResult(output);
      } catch (error) {
        logFailure("publish_daily_ai_news", error);
        if (error instanceof DailyAiNewsPublishError) {
          return failureResult(error.code, error.message);
        }
        return failureResult("PUBLISH_FAILED", "The final article could not be published.");
      }
    }
  );

  return server;
}

export async function handleAuthorizedRequest(
  request: Request,
  env: RuntimeEnv,
  identity: AccessIdentity,
  ctx: ExecutionContext,
  dependencies: RuntimeDependencies = {}
): Promise<Response> {
  const url = new URL(request.url);
  const expectedHostname = String(env.MCP_HOSTNAME || "").trim().toLowerCase();
  if (!expectedHostname
      || !/^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?$/.test(expectedHostname)
      || expectedHostname.includes("..")) {
    return jsonResponse({ ok: false, code: "HOST_CONFIG_INVALID", error: "Service configuration is invalid." }, 503);
  }
  if (url.hostname.toLowerCase() !== expectedHostname) {
    return jsonResponse({ ok: false, code: "HOST_REJECTED", error: "Host not allowed." }, 421);
  }
  if (request.headers.has("Origin")) {
    return jsonResponse({ ok: false, code: "ORIGIN_REJECTED", error: "Browser-origin requests are not allowed." }, 403);
  }
  if (url.pathname === "/health") {
    if (request.method !== "GET") {
      return jsonResponse({ ok: false, error: "Method not allowed." }, 405, { Allow: "GET" });
    }
    return jsonResponse({
      ok: true,
      service: SERVER_NAME,
      version: SERVER_VERSION,
      mode: "owner-only-final-article-publish",
      protocol: "streamable-http",
      owner_verified: Boolean(identity.email),
      db_bound: Boolean(env?.DB)
    });
  }
  if (url.pathname !== "/mcp") {
    return jsonResponse({ ok: false, error: "Not found." }, 404);
  }
  if (!env?.DB || typeof env.DB.prepare !== "function") {
    return jsonResponse({ ok: false, error: "Service binding unavailable." }, 503);
  }

  try {
    const handler = createMcpHandler(
      () => createDailyAiNewsMcpServer(env, identity, dependencies),
      { route: "/mcp", allowedHostnames: [expectedHostname] }
    );
    return await handler(request, env, ctx);
  } catch (error) {
    logFailure("mcp-request", error);
    return jsonResponse({ ok: false, error: "MCP request failed." }, 500);
  }
}

const worker = {
  async fetch(request: Request, env: RuntimeEnv, ctx: ExecutionContext): Promise<Response> {
    let identity: AccessIdentity;
    try {
      identity = await verifyAccessRequest(request, env);
    } catch (error) {
      logFailure("access-auth", error);
      if (error instanceof AccessAuthError) {
        return jsonResponse({ ok: false, code: error.code, error: error.message }, error.status);
      }
      return jsonResponse({ ok: false, code: "ACCESS_DENIED", error: "Access denied." }, 403);
    }
    return handleAuthorizedRequest(request, env, identity, ctx);
  }
} satisfies ExportedHandler<RuntimeEnv>;

export default worker;
