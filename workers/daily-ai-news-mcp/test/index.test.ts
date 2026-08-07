import { beforeEach, describe, expect, it, vi } from "vitest";
import { createExecutionContext, env, SELF } from "cloudflare:test";

import { handleAuthorizedRequest } from "../src/index";

const testEnv = env as unknown as Env & {
  TEAM_DOMAIN: string;
  POLICY_AUD: string;
  OWNER_EMAIL: string;
  MCP_HOSTNAME: string;
};
const identity = { email: "owner@example.com", subject: "owner-subject" };
const MODERN_META = {
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientInfo": {
    name: "daily-ai-news-mcp-tests",
    version: "1.0.0"
  },
  "io.modelcontextprotocol/clientCapabilities": {}
};

function translation(lang: "zh" | "en" | "ja") {
  const values = {
    zh: {
      title: "每日 AI 新闻｜示例头条",
      summary: "这是仅用于验证受限发布边界的完整中文摘要。",
      headings: ["今日要闻", "主要新闻", "传闻"],
      lead: "示例头条",
      body: "经过核验的事实段落。这里提供足够的文字，以便覆盖正式文章的最小长度与结构约束。"
    },
    en: {
      title: "Daily AI News | Example lead",
      summary: "A complete English summary used only to verify the restricted publishing boundary.",
      headings: ["Lead Story", "More News", "Rumors"],
      lead: "Example lead",
      body: "This verified fact paragraph is long enough to exercise the minimum article length and the governed public structure without including any external link."
    },
    ja: {
      title: "毎日AIニュース｜テストのトップ",
      summary: "制限付き公開境界だけを検証するための完全な日本語要約です。",
      headings: ["今日のトップニュース", "主なニュース", "噂"],
      lead: "テストのトップ",
      body: "検証済みの事実を説明する段落です。正式記事の最小文字数と構造的な制約を確認するため、十分な長さの文章を含めています。"
    }
  } as const;
  const value = values[lang];
  return {
    title: value.title,
    summary: value.summary,
    content_markdown: [
      `# ${value.title}`,
      "",
      value.summary,
      "",
      `## ${value.headings[0]}`,
      `### ${value.lead}`,
      value.body,
      "",
      `## ${value.headings[1]}`,
      "本日没有其他达到门槛的事件。 No other event cleared the threshold today.",
      "",
      `## ${value.headings[2]}`,
      "本日无需发布的传闻。 No rumor met the publication standard today."
    ].join("\n")
  };
}

const input = {
  reportDate: "2026-08-08",
  translations: {
    zh: translation("zh"),
    en: translation("en"),
    ja: translation("ja")
  }
};

const publicFetch = vi.fn(async (
  inputUrl: string | URL | Request,
  _init?: RequestInit
) => {
  const url = new URL(inputUrl instanceof Request ? inputUrl.url : String(inputUrl));
  const lang = String(url.searchParams.get("lang")) as "zh" | "en" | "ja";
  const expected = input.translations[lang];
  return Response.json({
    ok: true,
    article: {
      slug: "daily-ai-news-2026-08-08",
      category: "daily-ai-news",
      status: "published",
      lang,
      requested_lang: lang,
      title: expected.title,
      summary: expected.summary,
      content_markdown: expected.content_markdown
    }
  });
});

async function mcpRequest(method: string, params: Record<string, unknown> = {}) {
  const headers = new Headers({
    Accept: "application/json",
    "Content-Type": "application/json",
    Host: "daily-ai-news-mcp.test",
    "Mcp-Method": method
  });
  if (typeof params.name === "string") headers.set("Mcp-Name", params.name);
  const request = new Request("https://daily-ai-news-mcp.test/mcp", {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params: { ...params, _meta: MODERN_META }
    })
  });
  const response = await handleAuthorizedRequest(
    request,
    testEnv,
    identity,
    createExecutionContext(),
    { fetchImpl: publicFetch, sleep: async () => {} }
  );
  return { response, body: await response.json<Record<string, any>>() };
}

beforeEach(async () => {
  publicFetch.mockClear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-07T23:30:00.000Z"));
  await testEnv.DB.batch([
    testEnv.DB.prepare("drop table if exists article_translations"),
    testEnv.DB.prepare("drop table if exists articles"),
    testEnv.DB.prepare("drop table if exists article_delivery_events"),
    testEnv.DB.prepare("drop table if exists article_delivery_channels"),
    testEnv.DB.prepare(`create table articles (
      article_id text primary key, slug text not null unique, category text not null,
      tags text not null, cover_image text, status text not null,
      is_pinned integer not null default 0, view_count integer not null default 0,
      created_at text not null, updated_at text not null, published_at text
    )`),
    testEnv.DB.prepare(`create table article_translations (
      translation_id text primary key, article_id text not null, lang text not null,
      title text not null, summary text not null, content_markdown text not null,
      created_at text not null, updated_at text not null, unique(article_id, lang)
    )`),
    testEnv.DB.prepare("create table article_delivery_events (event_id text primary key)"),
    testEnv.DB.prepare(`create table article_delivery_channels (
      channel_key text primary key, enabled integer not null, auto_publish integer not null,
      last_used_at text
    )`),
    testEnv.DB.prepare(`insert into article_delivery_channels (
      channel_key, enabled, auto_publish, last_used_at
    ) values ('daily-ai-news', 1, 1, null)`)
  ]);
});

describe("owner-only Daily AI News MCP", () => {
  it("rejects unauthenticated direct Worker requests", async () => {
    const response = await SELF.fetch("https://daily-ai-news-mcp.test/health");
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: "ACCESS_JWT_MISSING" });
  });

  it("advertises exactly one governed, idempotent write tool", async () => {
    const { response, body } = await mcpRequest("tools/list");
    expect(response.status, JSON.stringify(body)).toBe(200);
    const tools = body.result.tools as Array<Record<string, any>>;
    expect(tools.map((tool) => tool.name)).toEqual(["publish_daily_ai_news"]);
    expect(tools[0].annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    });
    expect(tools[0].inputSchema.additionalProperties).toBe(false);
    expect(tools[0].description).toContain("scheduled callers must not use this tool");
  });

  it("rejects an unexpected Host and every browser Origin", async () => {
    const wrongHost = new Request("https://unexpected.example/mcp", {
      method: "POST",
      headers: { Host: "unexpected.example" }
    });
    const wrongHostResponse = await handleAuthorizedRequest(
      wrongHost,
      testEnv,
      identity,
      createExecutionContext()
    );
    expect(wrongHostResponse.status).toBe(421);
    await expect(wrongHostResponse.json()).resolves.toMatchObject({ code: "HOST_REJECTED" });

    const browserOrigin = new Request("https://daily-ai-news-mcp.test/mcp", {
      method: "POST",
      headers: {
        Host: "daily-ai-news-mcp.test",
        Origin: "https://lusu575.com"
      }
    });
    const browserOriginResponse = await handleAuthorizedRequest(
      browserOrigin,
      testEnv,
      identity,
      createExecutionContext()
    );
    expect(browserOriginResponse.status).toBe(403);
    await expect(browserOriginResponse.json()).resolves.toMatchObject({ code: "ORIGIN_REJECTED" });
  });

  it("writes only one final article and three translations, then replays identically", async () => {
    const first = await mcpRequest("tools/call", {
      name: "publish_daily_ai_news",
      arguments: input
    });
    expect(first.response.status, JSON.stringify(first.body)).toBe(200);
    const created = first.body.result.structuredContent.result
      ?? first.body.result.structuredContent;
    expect(created).toMatchObject({
      ok: true,
      duplicate: false,
      slug: "daily-ai-news-2026-08-08",
      status: "published",
      readbackVerified: true
    });

    const replay = await mcpRequest("tools/call", {
      name: "publish_daily_ai_news",
      arguments: input
    });
    const replayed = replay.body.result.structuredContent.result
      ?? replay.body.result.structuredContent;
    expect(replayed).toMatchObject({ ok: true, duplicate: true });

    await expect(testEnv.DB.prepare("select count(*) as count from articles").first())
      .resolves.toMatchObject({ count: 1 });
    await expect(testEnv.DB.prepare("select count(*) as count from article_translations").first())
      .resolves.toMatchObject({ count: 3 });
    await expect(testEnv.DB.prepare("select count(*) as count from article_delivery_events").first())
      .resolves.toMatchObject({ count: 0 });
    await expect(testEnv.DB.prepare(`select enabled, auto_publish, last_used_at
      from article_delivery_channels where channel_key = 'daily-ai-news'`).first())
      .resolves.toMatchObject({ enabled: 1, auto_publish: 1, last_used_at: null });
    expect(publicFetch).toHaveBeenCalledTimes(6);
    for (const [, init] of publicFetch.mock.calls) {
      const headers = new Headers(init?.headers);
      expect(headers.get("Origin")).toBe("https://daily-ai-news-mcp.test");
      expect(headers.get("Sec-Fetch-Site")).toBe("cross-site");
    }
  });

  it("rejects different content for an already published report date", async () => {
    await mcpRequest("tools/call", {
      name: "publish_daily_ai_news",
      arguments: input
    });
    const changed = structuredClone(input);
    changed.translations.en.summary += " Changed.";
    const conflict = await mcpRequest("tools/call", {
      name: "publish_daily_ai_news",
      arguments: changed
    });
    expect(conflict.body.result.isError).toBe(true);
    expect(conflict.body.result.content[0].text).toContain("ARTICLE_CONFLICT");
  });

  it("rejects out-of-window publication and client-controlled extra fields", async () => {
    vi.setSystemTime(new Date("2026-08-08T00:30:00.000Z"));
    const closed = await mcpRequest("tools/call", {
      name: "publish_daily_ai_news",
      arguments: input
    });
    expect(closed.body.result.content[0].text).toContain("PUBLISH_WINDOW_CLOSED");

    const extra = await mcpRequest("tools/call", {
      name: "publish_daily_ai_news",
      arguments: { ...input, slug: "attacker-controlled" }
    });
    expect(extra.body.result?.isError, JSON.stringify(extra.body)).toBe(true);
  });

  it("rejects impossible calendar dates", async () => {
    const impossible = await mcpRequest("tools/call", {
      name: "publish_daily_ai_news",
      arguments: { ...input, reportDate: "2026-02-31" }
    });
    expect(impossible.body.result?.isError, JSON.stringify(impossible.body)).toBe(true);
  });

  it("fails closed when the dedicated auto-publish gate is disabled", async () => {
    await testEnv.DB.prepare(`update article_delivery_channels
      set auto_publish = 0 where channel_key = 'daily-ai-news'`).run();
    const blocked = await mcpRequest("tools/call", {
      name: "publish_daily_ai_news",
      arguments: input
    });
    expect(blocked.body.result.content[0].text).toContain("AUTO_PUBLISH_DISABLED");
    await expect(testEnv.DB.prepare("select count(*) as count from articles").first())
      .resolves.toMatchObject({ count: 0 });
  });

  it("requires real trilingual public readback and safely recovers on identical replay", async () => {
    publicFetch.mockImplementationOnce(async () => Response.json({
      article: { slug: "wrong-public-article" }
    }));
    const failedReadback = await mcpRequest("tools/call", {
      name: "publish_daily_ai_news",
      arguments: input
    });
    expect(failedReadback.body.result.content[0].text).toContain("PUBLIC_READBACK_MISMATCH");
    await expect(testEnv.DB.prepare("select count(*) as count from articles").first())
      .resolves.toMatchObject({ count: 1 });

    publicFetch.mockReset();
    publicFetch.mockImplementation(async (
      inputUrl: string | URL | Request,
      _init?: RequestInit
    ) => {
      const url = new URL(inputUrl instanceof Request ? inputUrl.url : String(inputUrl));
      const lang = String(url.searchParams.get("lang")) as "zh" | "en" | "ja";
      const expected = input.translations[lang];
      return Response.json({ article: {
        slug: "daily-ai-news-2026-08-08",
        category: "daily-ai-news",
        status: "published",
        lang,
        requested_lang: lang,
        ...expected
      } });
    });
    const replay = await mcpRequest("tools/call", {
      name: "publish_daily_ai_news",
      arguments: input
    });
    const replayed = replay.body.result.structuredContent.result
      ?? replay.body.result.structuredContent;
    expect(replayed).toMatchObject({ ok: true, duplicate: true, readbackVerified: true });
    await expect(testEnv.DB.prepare("select count(*) as count from articles").first())
      .resolves.toMatchObject({ count: 1 });
  });
});
