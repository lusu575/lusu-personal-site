import {
  McpServer,
  ResourceNotFoundError,
  ResourceTemplate
} from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";

import {
  listCapabilities
} from "../../../lib/capabilities/registry.mjs";
import {
  queryPublishedArticle,
  queryPublishedArticles,
  toPublicArticle
} from "../../../functions/api/public-content-service.mjs";

interface Env {
  DB: D1Database;
}

type PublicArticle = {
  slug?: unknown;
  category?: unknown;
  tags?: unknown;
  cover_image?: unknown;
  status?: unknown;
  is_pinned?: unknown;
  view_count?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
  published_at?: unknown;
  lang?: unknown;
  requested_lang?: unknown;
  title?: unknown;
  summary?: unknown;
  content_markdown?: unknown;
};

export type SiteMcpServerOptions = {
  toolMeta?: Readonly<Record<string, unknown>>;
  includeResources?: boolean;
};

type SiteMcpRegistrar = Pick<McpServer, "registerTool" | "registerResource">;

const SERVER_NAME = "lusu-site-mcp";
const SERVER_VERSION = "0.1.0";
const SEARCH_RESULT_LIMIT = 20;
const SEARCH_SUMMARY_LIMIT = 1_200;
const ARTICLE_CONTENT_LIMIT = 48_000;
const ARTICLE_TAG_LIMIT = 32;

const LanguageSchema = z.enum(["zh", "en", "ja"]);
const CapabilitySchema = z.object({
  id: z.string(),
  domain: z.string(),
  scope: z.string(),
  transport: z.array(z.enum([
    "site-api",
    "remote-mcp",
    "local-mcp",
    "cli",
    "browser-adapter"
  ])),
  availableTransports: z.array(z.enum([
    "site-api",
    "remote-mcp",
    "local-mcp",
    "cli",
    "browser-adapter"
  ])),
  readOnly: z.boolean(),
  destructive: z.boolean(),
  idempotent: z.boolean(),
  risk: z.enum(["low", "medium", "high", "critical"]),
  status: z.literal("available")
});

const ArticleSummarySchema = z.object({
  slug: z.string().max(160),
  category: z.string().max(80),
  tags: z.array(z.string().max(120)).max(ARTICLE_TAG_LIMIT),
  cover_image: z.string().max(2_048),
  status: z.literal("published"),
  is_pinned: z.number().int().min(0).max(1),
  view_count: z.number().int().nonnegative(),
  created_at: z.string().max(64),
  updated_at: z.string().max(64),
  published_at: z.string().max(64),
  lang: LanguageSchema,
  requested_lang: z.string().max(8),
  title: z.string().max(300),
  summary: z.string().max(SEARCH_SUMMARY_LIMIT),
  summary_truncated: z.boolean()
});

const ArticleSchema = ArticleSummarySchema.extend({
  content_markdown: z.string().max(ARTICLE_CONTENT_LIMIT),
  content_truncated: z.boolean(),
  source_content_chars: z.number().int().nonnegative()
});

const ReadOnlyAnnotations = Object.freeze({
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false
});

function boundedText(value: unknown, limit: number): string {
  return String(value ?? "").slice(0, limit);
}

function safeInteger(value: unknown): number {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.floor(number);
}

function normalizeLanguage(value: unknown): z.infer<typeof LanguageSchema> {
  return value === "en" || value === "ja" ? value : "zh";
}

function toArticleSummary(article: PublicArticle | null) {
  const rawSummary = String(article?.summary ?? "");
  return {
    slug: boundedText(article?.slug, 160),
    category: boundedText(article?.category, 80),
    tags: (Array.isArray(article?.tags) ? article.tags : [])
      .slice(0, ARTICLE_TAG_LIMIT)
      .map((tag) => boundedText(tag, 120)),
    cover_image: boundedText(article?.cover_image, 2_048),
    status: "published" as const,
    is_pinned: Number(article?.is_pinned) === 1 ? 1 : 0,
    view_count: safeInteger(article?.view_count),
    created_at: boundedText(article?.created_at, 64),
    updated_at: boundedText(article?.updated_at, 64),
    published_at: boundedText(article?.published_at, 64),
    lang: normalizeLanguage(article?.lang),
    requested_lang: boundedText(article?.requested_lang, 8),
    title: boundedText(article?.title, 300),
    summary: boundedText(rawSummary, SEARCH_SUMMARY_LIMIT),
    summary_truncated: rawSummary.length > SEARCH_SUMMARY_LIMIT
  };
}

function toBoundedArticle(article: PublicArticle | null) {
  const rawContent = String(article?.content_markdown ?? "");
  return {
    ...toArticleSummary(article),
    content_markdown: boundedText(rawContent, ARTICLE_CONTENT_LIMIT),
    content_truncated: rawContent.length > ARTICLE_CONTENT_LIMIT,
    source_content_chars: rawContent.length
  };
}

function successfulToolResult(output: Record<string, unknown>) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(output)
      }
    ],
    structuredContent: output
  };
}

function failedToolResult(message: string) {
  return {
    isError: true,
    content: [
      {
        type: "text" as const,
        text: message
      }
    ]
  };
}

function logFailure(operation: string, error: unknown): void {
  console.error(JSON.stringify({
    service: SERVER_NAME,
    operation,
    error: error instanceof Error ? error.message : "Unknown error"
  }));
}

async function readArticle(env: Env, slug: string, lang: z.infer<typeof LanguageSchema>) {
  const row = await queryPublishedArticle(
    { DB: env.DB },
    { slug, lang }
  );
  if (!row) return null;
  return toBoundedArticle(toPublicArticle(row, { includeContent: true }));
}

export function createSiteMcpServer(
  env: Env,
  options: SiteMcpServerOptions = {}
): McpServer {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION
  });
  registerSiteMcpSurface(server, env, options);
  return server;
}

export function registerSiteMcpSurface<T extends SiteMcpRegistrar>(
  server: T,
  env: Env,
  options: SiteMcpServerOptions = {}
): T {
  server.registerTool(
    "site_capabilities",
    {
      title: "List LuSu site capabilities",
      description: "Lists available public read-only capabilities exposed through the remote MCP transport. Daily AI News retrieval maps to content_list with category daily-ai-news followed by article_get.",
      inputSchema: z.object({
        domain: z.string().trim().min(1).max(80).optional()
      }),
      outputSchema: z.object({
        mode: z.literal("public-read-only"),
        count: z.number().int().nonnegative(),
        capabilities: z.array(CapabilitySchema)
      }),
      annotations: ReadOnlyAnnotations,
      ...(options.toolMeta ? { _meta: { ...options.toolMeta } } : {})
    },
    async ({ domain }) => {
      try {
        const capabilities = listCapabilities({
          availableTransports: "remote-mcp",
          readOnly: true,
          status: "available",
          ...(domain ? { domain } : {})
        });
        return successfulToolResult({
          mode: "public-read-only",
          count: capabilities.length,
          capabilities
        });
      } catch (error) {
        logFailure("site_capabilities", error);
        return failedToolResult("Unable to list site capabilities.");
      }
    }
  );

  server.registerTool(
    "content_list",
    {
      title: "List published site articles",
      description: "Lists bounded published article summaries. To retrieve Daily AI News, set category to daily-ai-news and then call article_get with the selected slug.",
      inputSchema: z.object({
        lang: LanguageSchema.default("zh"),
        category: z.string().trim().max(80).optional(),
        limit: z.number().int().min(1).max(SEARCH_RESULT_LIMIT).default(10)
      }),
      outputSchema: z.object({
        lang: LanguageSchema,
        category: z.string().max(80),
        count: z.number().int().min(0).max(SEARCH_RESULT_LIMIT),
        articles: z.array(ArticleSummarySchema).max(SEARCH_RESULT_LIMIT)
      }),
      annotations: ReadOnlyAnnotations,
      ...(options.toolMeta ? { _meta: { ...options.toolMeta } } : {})
    },
    async ({ lang, category, limit }) => {
      try {
        const normalizedCategory = category ?? "";
        const rows = await queryPublishedArticles(
          { DB: env.DB },
          {
            lang,
            category: normalizedCategory,
            limit
          }
        );
        const articles = rows
          .slice(0, SEARCH_RESULT_LIMIT)
          .map((row: unknown) => toArticleSummary(toPublicArticle(row)));
        return successfulToolResult({
          lang,
          category: normalizedCategory,
          count: articles.length,
          articles
        });
      } catch (error) {
        logFailure("content_list", error);
        return failedToolResult("Published article listing is temporarily unavailable.");
      }
    }
  );

  server.registerTool(
    "content_search",
    {
      title: "Search published site articles",
      description: "Searches bounded summaries of published LuSu site articles in one requested language.",
      inputSchema: z.object({
        query: z.string().trim().min(1).max(200),
        lang: LanguageSchema.default("zh"),
        category: z.string().trim().max(80).optional(),
        limit: z.number().int().min(1).max(SEARCH_RESULT_LIMIT).default(10)
      }),
      outputSchema: z.object({
        query: z.string().max(200),
        lang: LanguageSchema,
        category: z.string().max(80),
        count: z.number().int().min(0).max(SEARCH_RESULT_LIMIT),
        articles: z.array(ArticleSummarySchema).max(SEARCH_RESULT_LIMIT)
      }),
      annotations: ReadOnlyAnnotations,
      ...(options.toolMeta ? { _meta: { ...options.toolMeta } } : {})
    },
    async ({ query, lang, category, limit }) => {
      try {
        const normalizedCategory = category ?? "";
        const rows = await queryPublishedArticles(
          { DB: env.DB },
          {
            search: query,
            lang,
            category: normalizedCategory,
            limit
          }
        );
        const articles = rows
          .slice(0, SEARCH_RESULT_LIMIT)
          .map((row: unknown) => toArticleSummary(toPublicArticle(row)));
        return successfulToolResult({
          query,
          lang,
          category: normalizedCategory,
          count: articles.length,
          articles
        });
      } catch (error) {
        logFailure("content_search", error);
        return failedToolResult("Published article search is temporarily unavailable.");
      }
    }
  );

  server.registerTool(
    "article_get",
    {
      title: "Get a published site article",
      description: "Reads one published article by public slug, with a bounded Markdown body and language fallback.",
      inputSchema: z.object({
        slug: z.string().trim().toLowerCase().min(1).max(160)
          .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
        lang: LanguageSchema.default("zh")
      }),
      outputSchema: z.object({
        found: z.boolean(),
        article: ArticleSchema.nullable()
      }),
      annotations: ReadOnlyAnnotations,
      ...(options.toolMeta ? { _meta: { ...options.toolMeta } } : {})
    },
    async ({ slug, lang }) => {
      try {
        const article = await readArticle(env, slug, lang);
        return successfulToolResult({
          found: article !== null,
          article
        });
      } catch (error) {
        logFailure("article_get", error);
        return failedToolResult("Published article lookup is temporarily unavailable.");
      }
    }
  );

  if (options.includeResources !== false) {
    server.registerResource(
      "published-article",
      new ResourceTemplate("lusu://articles/{slug}{?lang}", { list: undefined }),
      {
        title: "LuSu published article",
        description: "A published LuSu site article selected by public slug and optional zh, en, or ja language.",
        mimeType: "application/json"
      },
      async (uri, variables) => {
        const variableSlug = variables.slug;
        const slug = Array.isArray(variableSlug) ? variableSlug[0] : variableSlug;
        const lang = normalizeLanguage(uri.searchParams.get("lang"));
        if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
          throw new ResourceNotFoundError(uri.href, "Published article not found.");
        }
        try {
          const article = await readArticle(env, slug, lang);
          if (!article) {
            throw new ResourceNotFoundError(uri.href, "Published article not found.");
          }
          return {
            contents: [
              {
                uri: uri.href,
                mimeType: "application/json",
                text: JSON.stringify({ article })
              }
            ]
          };
        } catch (error) {
          if (error instanceof ResourceNotFoundError) throw error;
          logFailure("published-article-resource", error);
          throw new Error("Published article lookup is temporarily unavailable.");
        }
      }
    );
  }

  return server;
}

function jsonResponse(body: Record<string, unknown>, status = 200, extraHeaders?: HeadersInit) {
  const headers = new Headers(extraHeaders);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "no-referrer");
  return new Response(JSON.stringify(body), { status, headers });
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      if (request.method !== "GET") {
        return jsonResponse(
          { ok: false, error: "Method not allowed." },
          405,
          { Allow: "GET" }
        );
      }
      return jsonResponse({
        ok: true,
        service: SERVER_NAME,
        version: SERVER_VERSION,
        mode: "public-read-only",
        protocol: "streamable-http",
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
        () => createSiteMcpServer(env),
        { route: "/mcp" }
      );
      return await handler(request, env, ctx);
    } catch (error) {
      logFailure("mcp-request", error);
      return jsonResponse({ ok: false, error: "MCP request failed." }, 500);
    }
  }
} satisfies ExportedHandler<Env>;

export default worker;
