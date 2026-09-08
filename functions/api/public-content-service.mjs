import { normalizeArticleTags } from "./article-tags.mjs";
import { articleCategoryLabels, tagLabels } from "../../js/data/article-labels.mjs";
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

export const PUBLIC_ARTICLE_PAGE_SIZE = 12;
export const PUBLIC_ARTICLE_PAGE_MAX = 48;
const SEARCH_SCAN_BATCH_SIZE = 100;
const ARTICLE_PAGE_ORDER = `case when articles.category = 'site-updates' then 0 else articles.is_pinned end`;
const ARTICLE_PAGE_DATE = "coalesce(articles.published_at, articles.created_at)";
const ARTICLE_PUBLIC_JOINS = `
  from articles
  left join article_translations requested
    on requested.article_id = articles.article_id and requested.lang = ?
  left join article_translations zh
    on zh.article_id = articles.article_id and zh.lang = 'zh'
  left join article_translations fallback
    on fallback.translation_id = (
      select translation_id from article_translations
      where article_id = articles.article_id
      order by case lang when 'zh' then 0 when 'en' then 1 when 'ja' then 2 else 3 end
      limit 1
    )`;
const ARTICLE_PUBLIC_WHERE = `articles.status = 'published' and ${PUBLIC_LOOP_NIGHTLY_UPDATE_FILTER}
  and coalesce(requested.title, zh.title, fallback.title) is not null`;
const ARTICLE_SUMMARY_COLUMNS = `articles.article_id, articles.slug, articles.category, articles.tags,
  articles.cover_image, articles.status, articles.is_pinned, articles.view_count,
  articles.created_at, articles.updated_at, articles.published_at,
  requested.lang as requested_lang, coalesce(requested.lang, zh.lang, fallback.lang) as lang,
  coalesce(requested.title, zh.title, fallback.title) as title,
  coalesce(requested.summary, zh.summary, fallback.summary) as summary`;

export class PublicArticleQueryError extends Error {
  constructor(message = "Invalid article pagination query.") {
    super(message);
    this.name = "PublicArticleQueryError";
    this.status = 400;
    this.code = "INVALID_ARTICLE_QUERY";
  }
}

function normalizeSearchText(value) {
  return String(value || "").normalize("NFKC").toLocaleLowerCase().replace(/\s+/gu, " ").trim();
}

function articleCursorKey(row) {
  return {
    pin: row.category === "site-updates" ? 0 : Number(row.is_pinned || 0),
    date: row.published_at || row.created_at,
    slug: row.slug
  };
}

function encodeArticleCursor(row, query) {
  const json = JSON.stringify({ v: 1, ...articleCursorKey(row), query });
  return btoa(String.fromCharCode(...new TextEncoder().encode(json)))
    .replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function decodeArticleCursor(value, query) {
  if (!value) return null;
  if (typeof value !== "string" || value.length > 4096 || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new PublicArticleQueryError();
  }
  try {
    const bytes = Uint8Array.from(atob(value.replaceAll("-", "+").replaceAll("_", "/")), (c) => c.charCodeAt(0));
    const cursor = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (cursor.v !== 1 || cursor.query !== query || ![0, 1].includes(cursor.pin)
      || typeof cursor.date !== "string" || cursor.date.length > 64 || !cursor.date
      || typeof cursor.slug !== "string" || cursor.slug.length > 256 || !cursor.slug
      || Object.keys(cursor).some((key) => !["v", "pin", "date", "slug", "query"].includes(key))) {
      throw new PublicArticleQueryError();
    }
    return cursor;
  } catch {
    throw new PublicArticleQueryError();
  }
}

function articleCursorPredicate(cursor, binds) {
  if (!cursor) return "";
  binds.push(cursor.pin, cursor.pin, cursor.date, cursor.pin, cursor.date, cursor.slug);
  return ` and (${ARTICLE_PAGE_ORDER} < ?
    or (${ARTICLE_PAGE_ORDER} = ? and ${ARTICLE_PAGE_DATE} < ?)
    or (${ARTICLE_PAGE_ORDER} = ? and ${ARTICLE_PAGE_DATE} = ? and articles.slug < ?))`;
}

async function articleSummaryBatch(database, { lang, category, excludeCategory, cursor, limit }) {
  const binds = [lang];
  let where = ARTICLE_PUBLIC_WHERE;
  if (category) { where += " and articles.category = ?"; binds.push(category); }
  if (excludeCategory) { where += " and articles.category <> ?"; binds.push(excludeCategory); }
  where += articleCursorPredicate(cursor, binds);
  binds.push(limit);
  const result = await database.prepare(`select ${ARTICLE_SUMMARY_COLUMNS}
    ${ARTICLE_PUBLIC_JOINS} where ${where}
    order by ${ARTICLE_PAGE_ORDER} desc, ${ARTICLE_PAGE_DATE} desc, articles.slug desc limit ?`)
    .bind(...binds).all();
  return result?.results || [];
}

const normalizedTagLabels = new Map(Object.entries(tagLabels).map(([key, labels]) => [normalizeSearchText(key), labels]));
function articleSearchHaystack(row, lang) {
  const tags = parseTags(row.tags);
  return normalizeSearchText([
    row.title, row.summary, row.slug, row.category,
    articleCategoryLabels[row.category]?.[lang],
    ...tags, ...tags.map((tag) => normalizedTagLabels.get(normalizeSearchText(tag))?.[lang] || tag)
  ].join(" "));
}

function followsCursor(row, cursor) {
  if (!cursor) return true;
  const key = articleCursorKey(row);
  return key.pin < cursor.pin || (key.pin === cursor.pin && (
    key.date < cursor.date || (key.date === cursor.date && key.slug < cursor.slug)
  ));
}

// Normal browsing is a keyset query. Search normalizes bounded summary batches on
// the server because SQLite/D1 has no Unicode NFKC function. Only the requested
// page is returned; the scan also supplies an exact search total without a cutoff.
export async function queryPublishedArticlePage({ DB } = {}, options = {}) {
  const database = requireDatabase({ DB });
  const lang = normalizeLanguage(options.lang);
  const category = normalizeText(options.category);
  const excludeCategory = normalizeText(options.excludeCategory);
  const search = normalizeSearchText(options.search);
  const rawLimit = options.limit == null ? PUBLIC_ARTICLE_PAGE_SIZE : Number(options.limit);
  if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > PUBLIC_ARTICLE_PAGE_MAX
    || category.length > 120 || excludeCategory.length > 120 || search.length > 256) {
    throw new PublicArticleQueryError();
  }
  const tokens = [...new Set(search.split(" ").filter(Boolean))];
  if (tokens.length > 24) throw new PublicArticleQueryError();
  const query = JSON.stringify([lang, category, excludeCategory, search]);
  const cursor = decodeArticleCursor(options.cursor, query);
  const countResult = await database.prepare(`select articles.category, count(*) as count
    ${ARTICLE_PUBLIC_JOINS} where ${ARTICLE_PUBLIC_WHERE} group by articles.category`).bind(lang).all();
  const categoryCounts = Object.fromEntries((countResult?.results || []).map((row) => [row.category, Number(row.count)]));
  let total = Object.entries(categoryCounts).reduce((sum, [key, count]) =>
    sum + ((!category || key === category) && key !== excludeCategory ? count : 0), 0);
  let rows;
  if (!tokens.length) {
    rows = await articleSummaryBatch(database, { lang, category, excludeCategory, cursor, limit: rawLimit + 1 });
  } else {
    total = 0;
    rows = [];
    let scanCursor = null;
    let batch;
    do {
      batch = await articleSummaryBatch(database, { lang, category, excludeCategory, cursor: scanCursor, limit: SEARCH_SCAN_BATCH_SIZE });
      for (const row of batch) {
        const haystack = articleSearchHaystack(row, lang);
        if (!tokens.every((token) => haystack.includes(token))) continue;
        total += 1;
        if (rows.length <= rawLimit && followsCursor(row, cursor)) rows.push(row);
      }
      if (batch.length) scanCursor = articleCursorKey(batch.at(-1));
    } while (batch.length === SEARCH_SCAN_BATCH_SIZE);
  }
  const hasMore = rows.length > rawLimit;
  rows = rows.slice(0, rawLimit);
  return { rows, total, categoryCounts, hasMore,
    nextCursor: hasMore ? encodeArticleCursor(rows.at(-1), query) : "" };
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
    return normalizeArticleTags(tags, { maxItems: Infinity, maxLength: Infinity });
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
