const SITE_ORIGIN = "https://lusu575.com";
const DEFAULT_SHARE_IMAGE = `${SITE_ORIGIN}/assets/images/homepage-pixel-coast.png?v=20260612-hd-wallpapers`;
const ARTICLE_LANGUAGES = new Set(["zh", "en", "ja"]);
const LANGUAGE_TAGS = Object.freeze({ zh: "zh-CN", en: "en", ja: "ja" });
const OPEN_GRAPH_LOCALES = Object.freeze({ zh: "zh_CN", en: "en_US", ja: "ja_JP" });

export async function onRequest(context) {
  const method = context.request.method.toUpperCase();
  if (!["GET", "HEAD"].includes(method)) {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { Allow: "GET, HEAD", "Cache-Control": "no-store" }
    });
  }

  const route = normalizeArticleRoute(context.request.url, context.params?.slug);
  const shell = await loadIndexShell(context);
  if (!route.ok) {
    return responseWithStatus(shell, method === "HEAD" ? null : shell.body, 404);
  }

  let article = null;
  let queryFailed = false;
  try {
    article = await findPublishedArticle(context.env?.DB, route.slug, route.lang);
  } catch (error) {
    queryFailed = true;
    console.error(JSON.stringify({
      message: "article prerender query failed",
      path: new URL(context.request.url).pathname,
      error: error instanceof Error ? error.message : String(error)
    }));
  }

  if (queryFailed) {
    const headers = new Headers(shell.headers);
    headers.set("Cache-Control", "no-cache, max-age=0, must-revalidate");
    return new Response(method === "HEAD" ? null : shell.body, {
      status: shell.ok ? 200 : shell.status,
      headers
    });
  }

  if (!article?.title) {
    const headers = new Headers(shell.headers);
    headers.set("Cache-Control", "public, max-age=15, stale-while-revalidate=60");
    headers.set("X-Robots-Tag", "noindex");
    const notFound = new Response(shell.body, { status: 404, headers });
    return method === "HEAD"
      ? new Response(null, { status: notFound.status, headers: notFound.headers })
      : notFound;
  }

  const metadata = buildArticleMetadata(article, route.slug);
  const transformed = transformArticleShell(shell, metadata, article);
  const headers = new Headers(transformed.headers);
  headers.set("Cache-Control", "public, max-age=30, stale-while-revalidate=120");
  headers.set("Vary", "Accept-Encoding");
  const response = new Response(method === "HEAD" ? null : transformed.body, {
    status: 200,
    headers
  });
  return response;
}

export function normalizeArticleRoute(requestUrl, routeParam) {
  if (Array.isArray(routeParam)) {
    return { ok: false, slug: "", lang: "zh" };
  }
  const slug = String(routeParam || "").trim().toLowerCase();
  const url = new URL(requestUrl);
  const requestedLang = String(url.searchParams.get("lang") || "zh").trim().toLowerCase();
  return {
    ok: /^[a-z0-9][a-z0-9-]{0,119}$/.test(slug),
    slug,
    lang: ARTICLE_LANGUAGES.has(requestedLang) ? requestedLang : "zh"
  };
}

export function buildArticleMetadata(article, slug) {
  const lang = ARTICLE_LANGUAGES.has(article.lang) ? article.lang : "zh";
  const title = normalizeMetaText(article.title, 180) || slug;
  const summary = normalizeMetaText(article.summary, 320) || title;
  const canonical = `${SITE_ORIGIN}/articles/${encodeURIComponent(slug)}?lang=${lang}`;
  return {
    lang,
    htmlLang: LANGUAGE_TAGS[lang],
    locale: OPEN_GRAPH_LOCALES[lang],
    title,
    documentTitle: `${title} | LuSu Site`,
    summary,
    canonical,
    image: safeArticleImageUrl(article.cover_image),
    publishedAt: normalizeIsoDate(article.published_at || article.created_at),
    modifiedAt: normalizeIsoDate(article.updated_at || article.published_at || article.created_at)
  };
}

export function safeArticleImageUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return DEFAULT_SHARE_IMAGE;
  }
  try {
    const url = new URL(raw, `${SITE_ORIGIN}/`);
    if (url.protocol !== "https:") {
      return DEFAULT_SHARE_IMAGE;
    }
    return url.href;
  } catch {
    return DEFAULT_SHARE_IMAGE;
  }
}

async function loadIndexShell(context) {
  const assetUrl = new URL(context.request.url);
  assetUrl.pathname = "/index.html";
  assetUrl.search = "";
  assetUrl.hash = "";
  const headers = new Headers(context.request.headers);
  for (const name of ["if-match", "if-none-match", "if-modified-since", "if-unmodified-since", "range"]) {
    headers.delete(name);
  }
  return context.next(new Request(assetUrl, { method: "GET", headers }));
}

async function findPublishedArticle(db, slug, lang) {
  if (!db) {
    throw new Error("D1 binding DB is unavailable");
  }
  return db.prepare(`
    select
      articles.slug,
      articles.cover_image,
      articles.created_at,
      articles.updated_at,
      articles.published_at,
      coalesce(requested.lang, zh.lang, fallback.lang) as lang,
      coalesce(requested.title, zh.title, fallback.title) as title,
      coalesce(requested.summary, zh.summary, fallback.summary) as summary,
      coalesce(requested.content_markdown, zh.content_markdown, fallback.content_markdown) as content_markdown
    from articles
    left join article_translations requested
      on requested.article_id = articles.article_id and requested.lang = ?
    left join article_translations zh
      on zh.article_id = articles.article_id and zh.lang = 'zh'
    left join article_translations fallback
      on fallback.translation_id = (
        select inner_translations.translation_id
        from article_translations inner_translations
        where inner_translations.article_id = articles.article_id
        order by case inner_translations.lang when 'zh' then 0 when 'en' then 1 when 'ja' then 2 else 3 end
        limit 1
      )
    where articles.slug = ? and articles.status = 'published'
    limit 1
  `).bind(lang, slug).first();
}

function transformArticleShell(shell, metadata, article) {
  const rewriter = new HTMLRewriter()
    .on("html", new AttributeHandler("lang", metadata.htmlLang))
    .on("title", new TextHandler(metadata.documentTitle))
    .on('meta[name="description"]', new AttributeHandler("content", metadata.summary))
    .on('meta[property="og:type"]', new AttributeHandler("content", "article"))
    .on('meta[property="og:title"]', new AttributeHandler("content", metadata.title))
    .on('meta[property="og:description"]', new AttributeHandler("content", metadata.summary))
    .on('meta[property="og:url"]', new AttributeHandler("content", metadata.canonical))
    .on('meta[property="og:image"]', new AttributeHandler("content", metadata.image))
    .on('meta[property="og:image:alt"]', new AttributeHandler("content", metadata.title))
    .on('meta[property="og:locale"]', new AttributeHandler("content", metadata.locale))
    .on('meta[property="og:image:width"]', new RemoveElementHandler())
    .on('meta[property="og:image:height"]', new RemoveElementHandler())
    .on('meta[name="twitter:title"]', new AttributeHandler("content", metadata.title))
    .on('meta[name="twitter:description"]', new AttributeHandler("content", metadata.summary))
    .on('meta[name="twitter:image"]', new AttributeHandler("content", metadata.image))
    .on('meta[name="twitter:image:alt"]', new AttributeHandler("content", metadata.title))
    .on('link[rel="canonical"]', new AttributeHandler("href", metadata.canonical))
    .on("head", new ArticleHeadHandler(metadata))
    .on("body", new NoScriptArticleHandler(metadata, article));
  return rewriter.transform(shell);
}

class AttributeHandler {
  constructor(name, value) {
    this.name = name;
    this.value = value;
  }

  element(element) {
    element.setAttribute(this.name, this.value);
  }
}

class TextHandler {
  constructor(value) {
    this.value = value;
  }

  element(element) {
    element.setInnerContent(this.value);
  }
}

class RemoveElementHandler {
  element(element) {
    element.remove();
  }
}

class ArticleHeadHandler {
  constructor(metadata) {
    this.metadata = metadata;
  }

  element(element) {
    const meta = this.metadata;
    const fields = [
      meta.publishedAt ? `<meta property="article:published_time" content="${escapeHtml(meta.publishedAt)}">` : "",
      meta.modifiedAt ? `<meta property="article:modified_time" content="${escapeHtml(meta.modifiedAt)}">` : "",
      `<script type="application/ld+json">${jsonForHtml({
        "@context": "https://schema.org",
        "@type": "Article",
        headline: meta.title,
        description: meta.summary,
        inLanguage: meta.htmlLang,
        mainEntityOfPage: meta.canonical,
        image: meta.image,
        datePublished: meta.publishedAt || undefined,
        dateModified: meta.modifiedAt || undefined
      })}</script>`
    ].filter(Boolean).join("");
    element.append(fields, { html: true });
  }
}

class NoScriptArticleHandler {
  constructor(metadata, article) {
    this.metadata = metadata;
    this.article = article;
  }

  element(element) {
    const content = String(this.article.content_markdown || "").trim();
    const html = [
      "<noscript>",
      "<style>.crawler-article{max-width:72ch;margin:2rem auto;padding:1rem;font:16px/1.65 system-ui,sans-serif;white-space:normal}.crawler-article pre{white-space:pre-wrap;font:inherit}</style>",
      `<main class="crawler-article" lang="${escapeHtml(this.metadata.htmlLang)}">`,
      `<article><h1>${escapeHtml(this.metadata.title)}</h1>`,
      `<p>${escapeHtml(this.metadata.summary)}</p>`,
      content ? `<pre>${escapeHtml(content)}</pre>` : "",
      "</article></main></noscript>"
    ].join("");
    element.prepend(html, { html: true });
  }
}

function normalizeMetaText(value, maxLength) {
  return Array.from(String(value || "").replace(/\s+/g, " ").trim()).slice(0, maxLength).join("");
}

function normalizeIsoDate(value) {
  const date = new Date(value || "");
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

export function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function jsonForHtml(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function responseWithStatus(response, body, status) {
  const headers = new Headers(response.headers);
  if (status === 404) {
    headers.set("X-Robots-Tag", "noindex");
  }
  return new Response(body, { status, headers });
}
