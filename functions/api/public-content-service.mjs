export const PUBLIC_CONTENT_MAX_ARTICLES = 500;

export const PUBLIC_LOOP_NIGHTLY_UPDATE_SLUG = "2026-06-18-main-visual-polish-cycle";
export const PUBLIC_LOOP_NIGHTLY_UPDATE_FILTER = `not (
  articles.category = 'site-updates'
  and (
    articles.slug like '2026-06-18-%'
    or articles.slug in (
      '2026-06-17-knowledge-search',
      '2026-06-17-article-share-link',
      '2026-06-17-video-empty-state',
      '2026-06-17-route-aware-welcome'
    )
  )
  and articles.slug <> '${PUBLIC_LOOP_NIGHTLY_UPDATE_SLUG}'
)`;

function requireDatabase(env) {
  const DB = env?.DB;
  if (!DB || typeof DB.prepare !== "function") {
    throw new TypeError("A D1 DB binding is required.");
  }
  return DB;
}

function normalizeLanguage(value) {
  return ["zh", "en", "ja"].includes(value) ? value : "zh";
}

function normalizeLimit(value) {
  const limit = Number(value ?? PUBLIC_CONTENT_MAX_ARTICLES);
  if (!Number.isFinite(limit) || limit < 1) {
    return PUBLIC_CONTENT_MAX_ARTICLES;
  }
  return Math.min(Math.floor(limit), PUBLIC_CONTENT_MAX_ARTICLES);
}

function normalizeText(value) {
  return String(value || "").trim();
}

export async function queryPublishedArticles({ DB } = {}, {
  lang = "zh",
  category = "",
  limit = PUBLIC_CONTENT_MAX_ARTICLES,
  search = ""
} = {}) {
  const database = requireDatabase({ DB });
  const normalizedLang = normalizeLanguage(lang);
  const normalizedCategory = normalizeText(category);
  const normalizedSearch = normalizeText(search);
  const normalizedLimit = normalizeLimit(limit);
  const where = ["articles.status = 'published'", PUBLIC_LOOP_NIGHTLY_UPDATE_FILTER];
  const binds = [normalizedLang];

  if (normalizedCategory) {
    where.push("articles.category = ?");
    binds.push(normalizedCategory);
  }

  if (normalizedSearch) {
    where.push(`instr(lower(
      coalesce(requested.title, zh.title, fallback.title, '') || char(10) ||
      coalesce(requested.summary, zh.summary, fallback.summary, '') || char(10) ||
      coalesce(articles.slug, '') || char(10) ||
      coalesce(articles.category, '') || char(10) ||
      coalesce(articles.tags, '')
    ), lower(?)) > 0`);
    binds.push(normalizedSearch);
  }

  binds.push(normalizedLimit);
  const result = await database.prepare(`
    select
      articles.article_id,
      articles.slug,
      articles.category,
      articles.tags,
      articles.cover_image,
      articles.status,
      articles.is_pinned,
      articles.view_count,
      articles.created_at,
      articles.updated_at,
      articles.published_at,
      requested.lang as requested_lang,
      coalesce(requested.lang, zh.lang, fallback.lang) as lang,
      coalesce(requested.title, zh.title, fallback.title) as title,
      coalesce(requested.summary, zh.summary, fallback.summary) as summary
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
    where ${where.join(" and ")}
      and coalesce(requested.title, zh.title, fallback.title) is not null
    order by articles.is_pinned desc, coalesce(articles.published_at, articles.created_at) desc, articles.article_id desc
    limit ?
  `).bind(...binds).all();

  return result?.results || [];
}

export async function queryPublishedArticle({ DB } = {}, { lang = "zh", slug = "" } = {}) {
  const database = requireDatabase({ DB });
  const normalizedLang = normalizeLanguage(lang);
  const normalizedSlug = normalizeText(slug).toLowerCase();
  if (!normalizedSlug) {
    return null;
  }

  return database.prepare(`
    select
      articles.article_id,
      articles.slug,
      articles.category,
      articles.tags,
      articles.cover_image,
      articles.status,
      articles.is_pinned,
      articles.view_count,
      articles.created_at,
      articles.updated_at,
      articles.published_at,
      requested.lang as requested_lang,
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
  `).bind(normalizedLang, normalizedSlug).first();
}

function parseTags(value) {
  try {
    const tags = JSON.parse(value || "[]");
    return Array.isArray(tags) ? tags.map((tag) => String(tag)).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function toPublicArticle(row, { includeContent = false } = {}) {
  if (!row) {
    return null;
  }
  const article = {
    slug: row.slug,
    category: row.category,
    tags: parseTags(row.tags),
    cover_image: row.cover_image || "",
    status: row.status,
    is_pinned: Number(row.is_pinned || 0),
    view_count: Number(row.view_count || 0),
    created_at: row.created_at,
    updated_at: row.updated_at,
    published_at: row.published_at,
    lang: row.lang || "zh",
    requested_lang: row.requested_lang || "",
    title: row.title || "",
    summary: row.summary || ""
  };
  if (includeContent) {
    article.content_markdown = row.content_markdown || "";
  }
  return article;
}
