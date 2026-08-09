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

type PublicVideoRow = {
  video_id?: unknown;
  platform?: unknown;
  original_url?: unknown;
  external_id?: unknown;
  embed_url?: unknown;
  title?: unknown;
  description?: unknown;
  thumbnail_url?: unknown;
  author_name?: unknown;
  published_at?: unknown;
  status?: unknown;
};

type PublicVideoCategoryRow = {
  video_id?: unknown;
  slug?: unknown;
  name_zh?: unknown;
  name_en?: unknown;
  name_ja?: unknown;
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
const VIDEO_RESULT_LIMIT = 80;
const VIDEO_CATEGORY_FILTER_LIMIT = 20;
const VIDEO_CATEGORY_RESULT_LIMIT = 20;
const VIDEO_DESCRIPTION_LIMIT = 4_000;
const PUBLIC_SITE_ORIGIN = "https://lusu575.com";

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

const VideoIdSchema = z.string().trim()
  .regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,179}$/);
const VideoCategoryFilterSchema = z.string().trim()
  .regex(/^[a-z0-9][a-z0-9-]{0,79}$/);
const VideoPlatformSchema = z.enum(["youtube", "bilibili"]);
const PublicVideoCategorySchema = z.object({
  slug: VideoCategoryFilterSchema,
  name: z.string().max(160)
});
const PublicVideoSchema = z.object({
  video_id: VideoIdSchema,
  platform: VideoPlatformSchema,
  original_url: z.string().max(2_048),
  external_id: z.string().max(200),
  embed_url: z.string().max(2_048),
  title: z.string().max(300),
  description: z.string().max(VIDEO_DESCRIPTION_LIMIT),
  thumbnail_url: z.string().max(2_048),
  author_name: z.string().max(300),
  published_at: z.string().max(64),
  status: z.literal("published"),
  categories: z.array(PublicVideoCategorySchema).max(VIDEO_CATEGORY_RESULT_LIMIT)
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

function normalizedHost(url: URL): string {
  return url.hostname.toLowerCase().replace(/^www\./, "");
}

function safePublicUrl(
  value: unknown,
  allowed: (url: URL, host: string) => boolean
): string {
  const raw = String(value ?? "").trim();
  if (!raw || raw.length > 2_048) return "";
  try {
    const url = new URL(raw);
    if (
      url.protocol !== "https:"
      || url.username
      || url.password
      || (url.port && url.port !== "443")
      || !allowed(url, normalizedHost(url))
    ) {
      return "";
    }
    url.hash = "";
    const normalized = url.toString();
    return normalized.length <= 2_048 ? normalized : "";
  } catch {
    return "";
  }
}

function safeOriginalVideoUrl(
  value: unknown,
  platform: z.infer<typeof VideoPlatformSchema>
): string {
  return safePublicUrl(value, (_url, host) => platform === "youtube"
    ? host === "youtube.com" || host === "youtu.be"
    : host === "bilibili.com" || host.endsWith(".bilibili.com") || host === "b23.tv");
}

function safeEmbedVideoUrl(
  value: unknown,
  platform: z.infer<typeof VideoPlatformSchema>
): string {
  return safePublicUrl(value, (url, host) => platform === "youtube"
    ? host === "youtube.com" && url.pathname.startsWith("/embed/")
    : host === "player.bilibili.com" && url.pathname === "/player.html");
}

function safeThumbnailUrl(
  row: PublicVideoRow,
  platform: z.infer<typeof VideoPlatformSchema>
): string {
  const raw = String(row.thumbnail_url ?? "").trim();
  if (/^data:image\/(?:avif|jpe?g|png|webp);base64,/i.test(raw)) {
    const videoId = boundedText(row.video_id, 180);
    if (!VideoIdSchema.safeParse(videoId).success) return "";
    return new URL(
      `/api/videos/${encodeURIComponent(videoId)}/thumbnail`,
      PUBLIC_SITE_ORIGIN
    ).toString();
  }
  return safePublicUrl(raw, (_url, host) => platform === "youtube"
    ? host === "i.ytimg.com" || host === "img.youtube.com"
    : new Set([
      "i0.hdslb.com",
      "i1.hdslb.com",
      "i2.hdslb.com",
      "archive.biliimg.com"
    ]).has(host));
}

function localizedCategoryName(
  row: PublicVideoCategoryRow,
  lang: z.infer<typeof LanguageSchema>
): string {
  if (lang === "en") {
    return boundedText(row.name_en || row.name_zh, 160);
  }
  if (lang === "ja") {
    return boundedText(row.name_ja || row.name_zh, 160);
  }
  return boundedText(row.name_zh, 160);
}

function toPublicVideo(
  row: PublicVideoRow,
  categories: PublicVideoCategoryRow[],
  lang: z.infer<typeof LanguageSchema>
): z.infer<typeof PublicVideoSchema> {
  const platform = row.platform === "bilibili" ? "bilibili" : "youtube";
  return {
    video_id: boundedText(row.video_id, 180),
    platform,
    original_url: safeOriginalVideoUrl(row.original_url, platform),
    external_id: boundedText(row.external_id, 200),
    embed_url: safeEmbedVideoUrl(row.embed_url, platform),
    title: boundedText(row.title, 300),
    description: boundedText(row.description, VIDEO_DESCRIPTION_LIMIT),
    thumbnail_url: safeThumbnailUrl(row, platform),
    author_name: boundedText(row.author_name, 300),
    published_at: boundedText(row.published_at, 64),
    status: "published",
    categories: categories
      .slice(0, VIDEO_CATEGORY_RESULT_LIMIT)
      .map((category) => ({
        slug: boundedText(category.slug, 80),
        name: localizedCategoryName(category, lang)
      }))
  };
}

function normalizedVideoQuery(value: unknown): string {
  return String(value ?? "").normalize("NFKC").trim().toLocaleLowerCase();
}

async function queryPublishedVideoRows(env: Env): Promise<PublicVideoRow[]> {
  const result = await env.DB.prepare(`
    select
      video_id, platform, original_url, external_id, embed_url, title,
      description, thumbnail_url, author_name, published_at, status
    from videos
    where status = 'published'
      and platform in ('youtube', 'bilibili')
    order by
      pinned desc,
      case when pinned = 1 then pinned_sort_order else sort_order end desc,
      case when pinned = 1 then sort_order else 0 end desc,
      coalesce(published_at, created_at) desc,
      created_at desc
    limit ?
  `).bind(VIDEO_RESULT_LIMIT).all<PublicVideoRow>();
  return result.results || [];
}

async function queryPublishedVideoRow(
  env: Env,
  videoId: string
): Promise<PublicVideoRow | null> {
  return env.DB.prepare(`
    select
      video_id, platform, original_url, external_id, embed_url, title,
      description, thumbnail_url, author_name, published_at, status
    from videos
    where video_id = ?
      and status = 'published'
      and platform in ('youtube', 'bilibili')
    limit 1
  `).bind(videoId).first<PublicVideoRow>();
}

async function queryPublicVideoCategories(
  env: Env,
  videoIds: string[]
): Promise<Map<string, PublicVideoCategoryRow[]>> {
  const categoriesByVideo = new Map<string, PublicVideoCategoryRow[]>();
  for (const videoId of videoIds) categoriesByVideo.set(videoId, []);
  if (videoIds.length === 0) return categoriesByVideo;

  const placeholders = videoIds.map(() => "?").join(", ");
  const result = await env.DB.prepare(`
    select
      video_category_relations.video_id,
      video_categories.slug,
      video_categories.name_zh,
      video_categories.name_en,
      video_categories.name_ja
    from video_category_relations
    join video_categories
      on video_categories.category_id = video_category_relations.category_id
    where video_category_relations.video_id in (${placeholders})
      and video_categories.enabled = 1
    order by
      video_category_relations.sort_order asc,
      video_categories.sort_order desc,
      video_categories.slug asc
  `).bind(...videoIds).all<PublicVideoCategoryRow>();

  for (const category of result.results || []) {
    const videoId = boundedText(category.video_id, 180);
    const list = categoriesByVideo.get(videoId);
    if (list && list.length < VIDEO_CATEGORY_RESULT_LIMIT) list.push(category);
  }
  return categoriesByVideo;
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
          domain: "public-content",
          scope: "content:read",
          availableTransports: "remote-mcp",
          readOnly: true,
          status: "available"
        }).filter((capability) => !domain || capability.domain === domain);
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

  server.registerTool(
    "videos_list",
    {
      title: "List public videos",
      description: "Lists a bounded, optionally filtered projection of published LuSu video records. Local cover bytes and management fields are never returned.",
      inputSchema: z.object({
        lang: LanguageSchema.default("zh"),
        query: z.string().trim().max(300).optional(),
        categories: z.array(VideoCategoryFilterSchema)
          .max(VIDEO_CATEGORY_FILTER_LIMIT)
          .default([]),
        limit: z.number().int().min(1).max(VIDEO_RESULT_LIMIT).default(VIDEO_RESULT_LIMIT)
      }).strict(),
      outputSchema: z.object({
        lang: LanguageSchema,
        count: z.number().int().min(0).max(VIDEO_RESULT_LIMIT),
        videos: z.array(PublicVideoSchema).max(VIDEO_RESULT_LIMIT)
      }),
      annotations: ReadOnlyAnnotations,
      ...(options.toolMeta ? { _meta: { ...options.toolMeta } } : {})
    },
    async ({ lang, query, categories, limit }) => {
      try {
        const rows = await queryPublishedVideoRows(env);
        const videoIds = rows.map((row) => boundedText(row.video_id, 180));
        const categoriesByVideo = await queryPublicVideoCategories(env, videoIds);
        const normalizedQuery = normalizedVideoQuery(query);
        const categoryFilters = new Set(categories);
        const videos = rows
          .map((row) => {
            const videoId = boundedText(row.video_id, 180);
            return toPublicVideo(row, categoriesByVideo.get(videoId) || [], lang);
          })
          .filter((video) => {
            if (normalizedQuery) {
              const haystack = [
                video.title,
                video.description,
                video.author_name,
                video.platform
              ].join("\n").normalize("NFKC").toLocaleLowerCase();
              if (!haystack.includes(normalizedQuery)) return false;
            }
            if (
              categoryFilters.size > 0
              && !video.categories.some((category) => categoryFilters.has(category.slug))
            ) {
              return false;
            }
            return true;
          })
          .slice(0, limit);
        return successfulToolResult({
          lang,
          count: videos.length,
          videos
        });
      } catch (error) {
        logFailure("videos_list", error);
        return failedToolResult("Published video listing is temporarily unavailable.");
      }
    }
  );

  server.registerTool(
    "video_get",
    {
      title: "Read one public video",
      description: "Reads one published video by stable site id. Draft, hidden, management, and local cover-byte fields are never returned.",
      inputSchema: z.object({
        videoId: VideoIdSchema
      }).strict(),
      outputSchema: z.object({
        found: z.boolean(),
        video: PublicVideoSchema.nullable()
      }),
      annotations: ReadOnlyAnnotations,
      ...(options.toolMeta ? { _meta: { ...options.toolMeta } } : {})
    },
    async ({ videoId }) => {
      try {
        const row = await queryPublishedVideoRow(env, videoId);
        if (!row) {
          return successfulToolResult({ found: false, video: null });
        }
        const categoriesByVideo = await queryPublicVideoCategories(env, [videoId]);
        return successfulToolResult({
          found: true,
          video: toPublicVideo(row, categoriesByVideo.get(videoId) || [], "zh")
        });
      } catch (error) {
        logFailure("video_get", error);
        return failedToolResult("Published video lookup is temporarily unavailable.");
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
