const FEED_COPY = Object.freeze({
  zh: Object.freeze({
    title: "鲁肃的每日 AI 新闻",
    description: "每日整理的重要 AI 新闻，供 RSS 阅读器与只读 Agent 订阅。",
    language: "zh-CN",
    category: "每日 AI 新闻"
  }),
  en: Object.freeze({
    title: "LuSu's Daily AI News",
    description: "A daily digest of important AI news for RSS readers and read-only agents.",
    language: "en",
    category: "Daily AI News"
  }),
  ja: Object.freeze({
    title: "魯粛の毎日AIニュース",
    description: "重要なAIニュースを毎日まとめ、RSSリーダーと読み取り専用Agent向けに配信します。",
    language: "ja-JP",
    category: "毎日AIニュース"
  })
});

export function normalizeDailyAiNewsFeedLanguage(value) {
  return Object.hasOwn(FEED_COPY, value) ? value : "zh";
}

export function escapeRssXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function rssDate(value) {
  const timestamp = Date.parse(String(value || ""));
  return Number.isFinite(timestamp) ? new Date(timestamp).toUTCString() : "";
}

function articleDate(article) {
  return article?.published_at || article?.updated_at || article?.created_at || "";
}

export function buildDailyAiNewsRss({
  articles = [],
  lang = "zh",
  origin = "https://lusu575.com",
  feedUrl = ""
} = {}) {
  const language = normalizeDailyAiNewsFeedLanguage(lang);
  const copy = FEED_COPY[language];
  const siteOrigin = new URL(origin).origin;
  const canonicalFeedUrl = feedUrl || new URL(
    `/api/feeds/daily-ai-news.xml?lang=${encodeURIComponent(language)}`,
    siteOrigin
  ).toString();
  const channelUrl = new URL(`/?lang=${encodeURIComponent(language)}#knowledge`, siteOrigin).toString();
  const publishedArticles = articles.filter((article) => article?.status === "published");
  const lastBuildDate = publishedArticles.map(articleDate).map(rssDate).find(Boolean) || "";
  const items = publishedArticles.map((article) => {
    const articleUrl = new URL(
      `/articles/${encodeURIComponent(article.slug)}?lang=${encodeURIComponent(language)}`,
      siteOrigin
    ).toString();
    const pubDate = rssDate(articleDate(article));
    return [
      "    <item>",
      `      <title>${escapeRssXml(article.title)}</title>`,
      `      <link>${escapeRssXml(articleUrl)}</link>`,
      `      <guid isPermaLink="true">${escapeRssXml(articleUrl)}</guid>`,
      `      <description>${escapeRssXml(article.summary)}</description>`,
      `      <category>${escapeRssXml(copy.category)}</category>`,
      ...(pubDate ? [`      <pubDate>${escapeRssXml(pubDate)}</pubDate>`] : []),
      "    </item>"
    ].join("\n");
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    `    <title>${escapeRssXml(copy.title)}</title>`,
    `    <link>${escapeRssXml(channelUrl)}</link>`,
    `    <description>${escapeRssXml(copy.description)}</description>`,
    `    <language>${escapeRssXml(copy.language)}</language>`,
    `    <atom:link href="${escapeRssXml(canonicalFeedUrl)}" rel="self" type="application/rss+xml"/>`,
    ...(lastBuildDate ? [`    <lastBuildDate>${escapeRssXml(lastBuildDate)}</lastBuildDate>`] : []),
    "    <ttl>15</ttl>",
    ...items,
    "  </channel>",
    "</rss>"
  ].join("\n");
}
