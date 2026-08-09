import { beforeEach, describe, expect, it } from "vitest";
import { env, SELF } from "cloudflare:test";

const testEnv = env as unknown as { DB: D1Database };

const MODERN_META = {
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientInfo": {
    name: "site-mcp-worker-tests",
    version: "1.0.0"
  },
  "io.modelcontextprotocol/clientCapabilities": {}
};

async function mcpRequest(method: string, params: Record<string, unknown> = {}) {
  const headers = new Headers({
    Accept: "application/json",
    "Content-Type": "application/json",
    "Mcp-Method": method
  });
  if (typeof params.name === "string") {
    headers.set("Mcp-Name", params.name);
  }
  if (typeof params.uri === "string") {
    headers.set("Mcp-Name", params.uri);
  }
  const response = await SELF.fetch("https://site-mcp.test/mcp", {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params: {
        ...params,
        _meta: MODERN_META
      }
    })
  });
  const body = await response.json<Record<string, any>>();
  return { response, body };
}

beforeEach(async () => {
  await testEnv.DB.batch([
    testEnv.DB.prepare("drop table if exists video_category_relations"),
    testEnv.DB.prepare("drop table if exists video_categories"),
    testEnv.DB.prepare("drop table if exists videos"),
    testEnv.DB.prepare("drop table if exists article_translations"),
    testEnv.DB.prepare("drop table if exists articles"),
    testEnv.DB.prepare(`create table articles (
      article_id text primary key,
      slug text not null unique,
      category text not null,
      tags text not null,
      cover_image text,
      status text not null,
      is_pinned integer not null default 0,
      view_count integer not null default 0,
      created_at text not null,
      updated_at text not null,
      published_at text
    )`),
    testEnv.DB.prepare(`create table article_translations (
      translation_id text primary key,
      article_id text not null,
      lang text not null,
      title text not null,
      summary text not null,
      content_markdown text not null,
      created_at text not null,
      updated_at text not null,
      unique(article_id, lang)
    )`),
    testEnv.DB.prepare(`create table videos (
      video_id text primary key,
      platform text not null,
      original_url text not null,
      external_id text not null,
      embed_url text not null,
      title text not null,
      description text not null default '',
      thumbnail_url text not null default '',
      author_name text not null default '',
      published_at text,
      status text not null default 'draft',
      sort_order integer not null default 0,
      pinned integer not null default 0,
      pinned_sort_order integer not null default 0,
      metadata_error text not null default '',
      created_at text not null,
      updated_at text not null
    )`),
    testEnv.DB.prepare(`create table video_categories (
      category_id text primary key,
      slug text not null unique,
      name_zh text not null,
      name_en text not null default '',
      name_ja text not null default '',
      sort_order integer not null default 0,
      enabled integer not null default 1,
      created_at text not null,
      updated_at text not null
    )`),
    testEnv.DB.prepare(`create table video_category_relations (
      video_id text not null references videos(video_id) on delete cascade,
      category_id text not null references video_categories(category_id) on delete cascade,
      sort_order integer not null default 0,
      created_at text not null,
      primary key (video_id, category_id)
    )`)
  ]);

  const now = "2026-08-06T00:00:00.000Z";
  await testEnv.DB.batch([
    testEnv.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (?, ?, ?, ?, ?, 'published', 0, 7, ?, ?, ?)
    `).bind(
      "article-1",
      "hello-mcp",
      "site-guides",
      JSON.stringify(["mcp", "guide"]),
      "",
      now,
      now,
      now
    ),
    testEnv.DB.prepare(`
      insert into article_translations (
        translation_id, article_id, lang, title, summary, content_markdown,
        created_at, updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      "translation-zh",
      "article-1",
      "zh",
      "MCP 入门",
      "用于搜索的公开文章摘要。",
      "# MCP 入门\n\n这是已发布的正文。",
      now,
      now
    ),
    testEnv.DB.prepare(`
      insert into article_translations (
        translation_id, article_id, lang, title, summary, content_markdown,
        created_at, updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      "translation-en",
      "article-1",
      "en",
      "Getting started with MCP",
      "A published article summary for search.",
      "# Getting started with MCP\n\nPublished body.",
      now,
      now
    ),
    testEnv.DB.prepare(`
      insert into videos (
        video_id, platform, original_url, external_id, embed_url, title,
        description, thumbnail_url, author_name, published_at, status,
        sort_order, pinned, pinned_sort_order, metadata_error, created_at, updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      "video-public-mcp",
      "youtube",
      "https://www.youtube.com/watch?v=publicMcp01",
      "publicMcp01",
      "https://www.youtube.com/embed/publicMcp01",
      "Public MCP video",
      "A bounded public video description.",
      "https://i.ytimg.com/vi/publicMcp01/hqdefault.jpg",
      "LuSu",
      now,
      "published",
      20,
      0,
      0,
      "PRIVATE-MANAGEMENT-ERROR",
      now,
      now
    ),
    testEnv.DB.prepare(`
      insert into videos (
        video_id, platform, original_url, external_id, embed_url, title,
        description, thumbnail_url, author_name, published_at, status,
        sort_order, pinned, pinned_sort_order, metadata_error, created_at, updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      "video-public-local-cover",
      "bilibili",
      "https://www.bilibili.com/video/BV1publicCover/",
      "BV1publicCover",
      "https://player.bilibili.com/player.html?bvid=BV1publicCover",
      "Public local-cover video",
      "The cover is served only through the public thumbnail proxy.",
      "data:image/png;base64,TE9DQUwtQ09WRVItQllURVMtTVVTVC1OT1QtTEVBSw==",
      "LuSu",
      now,
      "published",
      10,
      0,
      0,
      "",
      now,
      now
    ),
    testEnv.DB.prepare(`
      insert into videos (
        video_id, platform, original_url, external_id, embed_url, title,
        description, thumbnail_url, author_name, published_at, status,
        sort_order, pinned, pinned_sort_order, metadata_error, created_at, updated_at
      ) values (?, 'youtube', ?, ?, ?, ?, '', '', '', ?, ?, 0, 0, 0, ?, ?, ?)
    `).bind(
      "video-not-public-draft",
      "https://www.youtube.com/watch?v=draftSecret",
      "draftSecret",
      "https://www.youtube.com/embed/draftSecret",
      "DRAFT-SECRET-TITLE",
      now,
      "draft",
      "DRAFT-PRIVATE-METADATA",
      now,
      now
    ),
    testEnv.DB.prepare(`
      insert into videos (
        video_id, platform, original_url, external_id, embed_url, title,
        description, thumbnail_url, author_name, published_at, status,
        sort_order, pinned, pinned_sort_order, metadata_error, created_at, updated_at
      ) values (?, 'bilibili', ?, ?, ?, ?, '', '', '', ?, 'hidden', 0, 0, 0, ?, ?, ?)
    `).bind(
      "video-not-public-hidden",
      "https://www.bilibili.com/video/BV1hidden/",
      "BV1hidden",
      "https://player.bilibili.com/player.html?bvid=BV1hidden",
      "HIDDEN-SECRET-TITLE",
      now,
      "HIDDEN-PRIVATE-METADATA",
      now,
      now
    ),
    testEnv.DB.prepare(`
      insert into video_categories (
        category_id, slug, name_zh, name_en, name_ja, sort_order,
        enabled, created_at, updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      "category-ai",
      "ai-experiments",
      "AI 实验",
      "AI Experiments",
      "AI 実験",
      20,
      1,
      now,
      now
    ),
    testEnv.DB.prepare(`
      insert into video_categories (
        category_id, slug, name_zh, name_en, name_ja, sort_order,
        enabled, created_at, updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      "category-games",
      "game-records",
      "游戏录像",
      "Game Records",
      "ゲーム録画",
      10,
      1,
      now,
      now
    ),
    testEnv.DB.prepare(`
      insert into video_categories (
        category_id, slug, name_zh, name_en, name_ja, sort_order,
        enabled, created_at, updated_at
      ) values (?, ?, ?, ?, ?, 0, 0, ?, ?)
    `).bind(
      "category-private",
      "private-review",
      "内部审核",
      "Private Review",
      "非公開レビュー",
      now,
      now
    ),
    testEnv.DB.prepare(`
      insert into video_category_relations (video_id, category_id, sort_order, created_at)
      values (?, ?, 0, ?)
    `).bind("video-public-mcp", "category-ai", now),
    testEnv.DB.prepare(`
      insert into video_category_relations (video_id, category_id, sort_order, created_at)
      values (?, ?, 0, ?)
    `).bind("video-public-mcp", "category-private", now),
    testEnv.DB.prepare(`
      insert into video_category_relations (video_id, category_id, sort_order, created_at)
      values (?, ?, 0, ?)
    `).bind("video-public-local-cover", "category-games", now)
  ]);
});

describe("site MCP Worker HTTP surface", () => {
  it("serves health JSON and rejects unknown routes", async () => {
    const health = await SELF.fetch("https://site-mcp.test/health");
    expect(health.status).toBe(200);
    expect(health.headers.get("content-type")).toContain("application/json");
    await expect(health.json()).resolves.toMatchObject({
      ok: true,
      service: "lusu-site-mcp",
      mode: "public-read-only",
      db_bound: true
    });

    const missing = await SELF.fetch("https://site-mcp.test/not-mcp");
    expect(missing.status).toBe(404);
    await expect(missing.json()).resolves.toEqual({
      ok: false,
      error: "Not found."
    });
  });

  it("advertises exactly the bounded read-only tool surface", async () => {
    const { response, body } = await mcpRequest("tools/list");
    expect(response.status, JSON.stringify(body)).toBe(200);
    expect(body.error).toBeUndefined();

    const tools = body.result.tools as Array<Record<string, any>>;
    expect(tools.map((tool) => tool.name)).toEqual([
      "site_capabilities",
      "content_list",
      "content_search",
      "article_get",
      "videos_list",
      "video_get"
    ]);
    for (const tool of tools) {
      expect(tool.annotations).toMatchObject({
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      });
      expect(tool.inputSchema).toMatchObject({ type: "object" });
      expect(tool.outputSchema).toMatchObject({ type: "object" });
    }

    const capabilitiesCall = await mcpRequest("tools/call", {
      name: "site_capabilities",
      arguments: {}
    });
    expect(
      capabilitiesCall.response.status,
      JSON.stringify(capabilitiesCall.body)
    ).toBe(200);
    const capabilities = capabilitiesCall.body.result.structuredContent.result
      ?? capabilitiesCall.body.result.structuredContent;
    expect(capabilities).toMatchObject({
      mode: "public-read-only",
      count: 4
    });
    expect(capabilities.capabilities.map((item: { id: string }) => item.id)).toEqual([
      "content.articles.list",
      "content.articles.search",
      "content.articles.get",
      "content.daily-ai-news.get"
    ]);
    expect(capabilities.capabilities).toEqual(expect.arrayContaining([
      expect.objectContaining({
        domain: "public-content",
        scope: "content:read",
        readOnly: true,
        status: "available"
      })
    ]));
    expect(capabilities.capabilities.every((item: {
      domain: string;
      scope: string;
    }) => (
      item.domain === "public-content" && item.scope === "content:read"
    ))).toBe(true);

    const privateDomainCall = await mcpRequest("tools/call", {
      name: "site_capabilities",
      arguments: { domain: "knowledge-management" }
    });
    expect(
      privateDomainCall.response.status,
      JSON.stringify(privateDomainCall.body)
    ).toBe(200);
    const privateDomain = privateDomainCall.body.result.structuredContent.result
      ?? privateDomainCall.body.result.structuredContent;
    expect(privateDomain).toMatchObject({
      mode: "public-read-only",
      count: 0,
      capabilities: []
    });
  });

  it("searches published summaries without exposing internal article ids", async () => {
    const list = await mcpRequest("tools/call", {
      name: "content_list",
      arguments: {
        lang: "zh",
        category: "site-guides",
        limit: 5
      }
    });
    expect(list.response.status, JSON.stringify(list.body)).toBe(200);
    const listed = list.body.result.structuredContent.result
      ?? list.body.result.structuredContent;
    expect(listed).toMatchObject({
      lang: "zh",
      category: "site-guides",
      count: 1,
      articles: [{ slug: "hello-mcp", title: "MCP 入门" }]
    });

    const { response, body } = await mcpRequest("tools/call", {
      name: "content_search",
      arguments: {
        query: "MCP",
        lang: "en",
        limit: 5
      }
    });
    expect(response.status, JSON.stringify(body)).toBe(200);
    expect(body.error).toBeUndefined();

    const result = body.result;
    expect(result.isError).not.toBe(true);
    const structured = result.structuredContent.result ?? result.structuredContent;
    expect(structured).toMatchObject({
      query: "MCP",
      lang: "en",
      count: 1,
      articles: [
        {
          slug: "hello-mcp",
          title: "Getting started with MCP",
          status: "published"
        }
      ]
    });
    expect(JSON.stringify(structured)).not.toContain("article-1");
    expect(JSON.stringify(structured)).not.toContain("content_markdown");
  });

  it("reads one article and advertises the article resource template", async () => {
    const articleCall = await mcpRequest("tools/call", {
      name: "article_get",
      arguments: {
        slug: "hello-mcp",
        lang: "zh"
      }
    });
    expect(articleCall.response.status, JSON.stringify(articleCall.body)).toBe(200);
    expect(articleCall.body.error).toBeUndefined();
    const articleResult = articleCall.body.result.structuredContent.result
      ?? articleCall.body.result.structuredContent;
    expect(articleResult).toMatchObject({
      found: true,
      article: {
        slug: "hello-mcp",
        title: "MCP 入门",
        content_markdown: "# MCP 入门\n\n这是已发布的正文。",
        content_truncated: false
      }
    });

    const templates = await mcpRequest("resources/templates/list");
    expect(templates.response.status).toBe(200);
    expect(templates.body.result.resourceTemplates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "published-article",
          uriTemplate: "lusu://articles/{slug}{?lang}"
        })
      ])
    );

    const resource = await mcpRequest("resources/read", {
      uri: "lusu://articles/hello-mcp?lang=en"
    });
    expect(resource.response.status, JSON.stringify(resource.body)).toBe(200);
    expect(resource.body.error).toBeUndefined();
    const payload = JSON.parse(resource.body.result.contents[0].text);
    expect(payload.article).toMatchObject({
      slug: "hello-mcp",
      title: "Getting started with MCP"
    });
  });

  it("lists only published video projections with bounded public filters", async () => {
    const filtered = await mcpRequest("tools/call", {
      name: "videos_list",
      arguments: {
        lang: "en",
        query: "MCP",
        categories: ["ai-experiments"],
        limit: 1
      }
    });
    expect(filtered.response.status, JSON.stringify(filtered.body)).toBe(200);
    expect(filtered.body.error).toBeUndefined();
    const result = filtered.body.result.structuredContent.result
      ?? filtered.body.result.structuredContent;
    expect(result).toEqual({
      lang: "en",
      count: 1,
      videos: [
        {
          video_id: "video-public-mcp",
          platform: "youtube",
          original_url: "https://www.youtube.com/watch?v=publicMcp01",
          external_id: "publicMcp01",
          embed_url: "https://www.youtube.com/embed/publicMcp01",
          title: "Public MCP video",
          description: "A bounded public video description.",
          thumbnail_url: "https://i.ytimg.com/vi/publicMcp01/hqdefault.jpg",
          author_name: "LuSu",
          published_at: "2026-08-06T00:00:00.000Z",
          status: "published",
          categories: [{ slug: "ai-experiments", name: "AI Experiments" }]
        }
      ]
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("PRIVATE-MANAGEMENT-ERROR");
    expect(serialized).not.toContain("metadata_error");
    expect(serialized).not.toContain("sort_order");
    expect(serialized).not.toContain("pinned");
    expect(serialized).not.toContain("category_id");
    expect(serialized).not.toContain("private-review");

    const localCover = await mcpRequest("tools/call", {
      name: "videos_list",
      arguments: {
        categories: ["game-records"],
        limit: 5
      }
    });
    const localCoverResult = localCover.body.result.structuredContent.result
      ?? localCover.body.result.structuredContent;
    expect(localCoverResult).toMatchObject({
      count: 1,
      videos: [{
        video_id: "video-public-local-cover",
        thumbnail_url: expect.stringMatching(
          /^https:\/\/lusu575\.com\/api\/videos\/video-public-local-cover\/thumbnail$/
        )
      }]
    });
    expect(JSON.stringify(localCoverResult)).not.toContain("data:image");
    expect(JSON.stringify(localCoverResult)).not.toContain("TE9DQUwtQ09WRVIt");

    const privateSearch = await mcpRequest("tools/call", {
      name: "videos_list",
      arguments: { query: "SECRET", limit: 80 }
    });
    const privateSearchResult = privateSearch.body.result.structuredContent.result
      ?? privateSearch.body.result.structuredContent;
    expect(privateSearchResult).toMatchObject({ count: 0, videos: [] });
    expect(JSON.stringify(privateSearchResult)).not.toContain("DRAFT-SECRET-TITLE");
    expect(JSON.stringify(privateSearchResult)).not.toContain("HIDDEN-SECRET-TITLE");
  });

  it("reads videos by bounded id and fails closed for hidden records and unsafe URLs", async () => {
    const published = await mcpRequest("tools/call", {
      name: "video_get",
      arguments: { videoId: "video-public-local-cover" }
    });
    expect(published.response.status, JSON.stringify(published.body)).toBe(200);
    const publishedResult = published.body.result.structuredContent.result
      ?? published.body.result.structuredContent;
    expect(publishedResult).toMatchObject({
      found: true,
      video: {
        video_id: "video-public-local-cover",
        status: "published",
        categories: [{ slug: "game-records" }]
      }
    });
    expect(JSON.stringify(publishedResult)).not.toContain("data:image");

    for (const videoId of ["video-not-public-draft", "video-not-public-hidden", "missing-video"]) {
      const unavailable = await mcpRequest("tools/call", {
        name: "video_get",
        arguments: { videoId }
      });
      const unavailableResult = unavailable.body.result.structuredContent.result
        ?? unavailable.body.result.structuredContent;
      expect(unavailableResult).toEqual({ found: false, video: null });
      expect(JSON.stringify(unavailableResult)).not.toContain("SECRET");
    }

    const now = "2026-08-06T00:00:00.000Z";
    await testEnv.DB.prepare(`
      insert into videos (
        video_id, platform, original_url, external_id, embed_url, title,
        description, thumbnail_url, author_name, published_at, status,
        sort_order, pinned, pinned_sort_order, metadata_error, created_at, updated_at
      ) values (?, 'youtube', ?, ?, ?, ?, '', ?, '', ?, 'published', 0, 0, 0, '', ?, ?)
    `).bind(
      "video-unsafe-urls",
      "https://evil.example/watch?v=unsafe",
      "unsafe",
      "https://evil.example/embed/unsafe",
      "Unsafe URL fixture",
      "https://evil.example/tracker.png",
      now,
      now,
      now
    ).run();
    const unsafe = await mcpRequest("tools/call", {
      name: "video_get",
      arguments: { videoId: "video-unsafe-urls" }
    });
    const unsafeResult = unsafe.body.result.structuredContent.result
      ?? unsafe.body.result.structuredContent;
    expect(unsafeResult).toMatchObject({
      found: true,
      video: {
        original_url: "",
        embed_url: "",
        thumbnail_url: ""
      }
    });
    expect(JSON.stringify(unsafeResult)).not.toContain("evil.example");
  });
});
