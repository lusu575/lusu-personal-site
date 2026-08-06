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
    )
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
      "article_get"
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
    expect(capabilities.capabilities.map((item: { id: string }) => item.id)).toEqual([
      "content.articles.list",
      "content.articles.search",
      "content.articles.get",
      "content.daily-ai-news.get"
    ]);
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
});
