const LANGUAGES = Object.freeze(["zh", "en", "ja"]);
const ARTICLE_TAGS = Object.freeze(["每日AI新闻", "AI"]);
const SHANGHAI_TIMEZONE = "Asia/Shanghai";
const PUBLIC_SITE_ORIGIN = "https://lusu575.com";
const MINIMUM_REMAINING_WINDOW_MS = 45_000;
const PUBLIC_READBACK_RETRY_DELAYS_MS = Object.freeze([250, 750]);
const PUBLIC_READBACK_ATTEMPT_TIMEOUT_MS = 10_000;
const MAX_PUBLIC_RESPONSE_BYTES = 256 * 1024;
const TRANSIENT_READBACK_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const URL_PATTERN = /https?:\/\/|www\.|\]\s*\(/i;

const ARTICLE_STRUCTURE = Object.freeze({
  zh: Object.freeze({
    titlePrefix: "每日 AI 新闻｜",
    headings: Object.freeze(["今日要闻", "主要新闻", "传闻"])
  }),
  en: Object.freeze({
    titlePrefix: "Daily AI News | ",
    headings: Object.freeze(["Lead Story", "More News", "Rumors"])
  }),
  ja: Object.freeze({
    titlePrefix: "毎日AIニュース｜",
    headings: Object.freeze(["今日のトップニュース", "主なニュース", "噂"])
  })
});

export class DailyAiNewsPublishError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = "DailyAiNewsPublishError";
    this.code = code;
    this.status = status;
  }
}

function fail(code, message, status = 400) {
  throw new DailyAiNewsPublishError(code, message, status);
}

function normalizeText(value, { field, min = 1, max }) {
  if (typeof value !== "string") {
    fail("INVALID_ARTICLE", `${field} must be a string.`);
  }
  const normalized = value.replace(/\r\n/g, "\n").trim();
  if (normalized.length < min || normalized.length > max) {
    fail("INVALID_ARTICLE", `${field} length is outside the allowed range.`);
  }
  return normalized;
}

function normalizeTranslation(lang, value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail("INVALID_ARTICLE", `Missing ${lang} translation.`);
  }
  const allowedKeys = new Set(["title", "summary", "content_markdown"]);
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      fail("INVALID_ARTICLE", `Unexpected ${lang} translation field.`);
    }
  }

  const title = normalizeText(value.title, { field: `${lang}.title`, max: 180 });
  const summary = normalizeText(value.summary, { field: `${lang}.summary`, max: 500 });
  const content_markdown = normalizeText(value.content_markdown, {
    field: `${lang}.content_markdown`,
    min: 120,
    max: 60_000
  });

  for (const text of [title, summary, content_markdown]) {
    if (URL_PATTERN.test(text)) {
      fail("INVALID_ARTICLE", `${lang} public copy must not contain external links.`);
    }
  }

  if (!content_markdown.startsWith(`# ${title}\n`)) {
    fail("INVALID_ARTICLE", `${lang} body must start with its exact title.`);
  }

  const structure = ARTICLE_STRUCTURE[lang];
  const h2Headings = content_markdown
    .split("\n")
    .map((line) => line.match(/^##\s+(.+?)\s*$/)?.[1] ?? null)
    .filter(Boolean);
  if (JSON.stringify(h2Headings) !== JSON.stringify(structure.headings)) {
    fail("INVALID_ARTICLE", `${lang} body must contain the three governed sections in order.`);
  }

  const lines = content_markdown.split("\n");
  const leadIndex = lines.findIndex((line) => line.trim() === `## ${structure.headings[0]}`);
  const nextH2Index = lines.findIndex((line, index) => index > leadIndex && line.startsWith("## "));
  const leadHeading = lines
    .slice(leadIndex + 1, nextH2Index < 0 ? lines.length : nextH2Index)
    .map((line) => line.match(/^###\s+(.+?)\s*$/)?.[1]?.trim() ?? "")
    .find(Boolean);
  if (!leadHeading || title !== `${structure.titlePrefix}${leadHeading}`) {
    fail("INVALID_ARTICLE", `${lang} title must use the governed prefix and first lead heading.`);
  }

  return Object.freeze({ title, summary, content_markdown });
}

export function normalizeDailyAiNewsDraft(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    fail("INVALID_ARTICLE", "Daily AI News input must be an object.");
  }
  const allowedKeys = new Set(["reportDate", "translations"]);
  for (const key of Object.keys(input)) {
    if (!allowedKeys.has(key)) {
      fail("INVALID_ARTICLE", "Unexpected Daily AI News input field.");
    }
  }

  const reportDate = String(input.reportDate || "");
  const parsedReportDate = new Date(`${reportDate}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)
      || Number.isNaN(parsedReportDate.getTime())
      || parsedReportDate.toISOString().slice(0, 10) !== reportDate) {
    fail("INVALID_REPORT_DATE", "reportDate must be a real YYYY-MM-DD date.");
  }
  if (!input.translations || typeof input.translations !== "object"
      || Array.isArray(input.translations)) {
    fail("INVALID_ARTICLE", "translations must contain zh, en, and ja.");
  }
  if (Object.keys(input.translations).sort().join(",") !== "en,ja,zh") {
    fail("INVALID_ARTICLE", "translations must contain exactly zh, en, and ja.");
  }

  return Object.freeze({
    reportDate,
    slug: `daily-ai-news-${reportDate}`,
    category: "daily-ai-news",
    tags: ARTICLE_TAGS,
    translations: Object.freeze(Object.fromEntries(
      LANGUAGES.map((lang) => [lang, normalizeTranslation(lang, input.translations[lang])])
    ))
  });
}

function shanghaiParts(now) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SHANGHAI_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    hour: Number(values.hour),
    minute: Number(values.minute)
  };
}

export function enforceScheduledPublishWindow(reportDate, now = new Date()) {
  const local = shanghaiParts(now);
  if (local.date !== reportDate) {
    fail("REPORT_DATE_MISMATCH", "Only the current Asia/Shanghai report date can be published.", 409);
  }
  const nowMs = now.getTime();
  const startAt = Date.parse(`${reportDate}T07:00:00+08:00`);
  const deadlineAt = Date.parse(`${reportDate}T08:00:00+08:00`);
  if (!Number.isFinite(nowMs) || nowMs < startAt || nowMs >= deadlineAt) {
    fail("PUBLISH_WINDOW_CLOSED", "Scheduled publication is only allowed from 07:00 to 08:00 Asia/Shanghai.", 409);
  }
  if (deadlineAt - nowMs < MINIMUM_REMAINING_WINDOW_MS) {
    fail("PUBLISH_WINDOW_CLOSED", "Too little time remains for a verified public readback before 08:00 Asia/Shanghai.", 409);
  }
  return Object.freeze({ deadlineAt, remainingMs: deadlineAt - nowMs });
}

async function assertAutomaticPublishingEnabled(db) {
  const channel = await db.prepare(`
    select enabled, auto_publish
    from article_delivery_channels
    where channel_key = 'daily-ai-news'
    limit 1
  `).first();
  if (Number(channel?.enabled) !== 1 || Number(channel?.auto_publish) !== 1) {
    fail(
      "AUTO_PUBLISH_DISABLED",
      "The dedicated Daily AI News channel and auto-publish gate must both be enabled.",
      409
    );
  }
}

async function readArticleBySlug(db, slug) {
  const article = await db.prepare(`
    select article_id, slug, category, tags, cover_image, status, is_pinned,
           view_count, created_at, updated_at, published_at
    from articles
    where slug = ?
    limit 1
  `).bind(slug).first();
  if (!article) return null;

  const rows = await db.prepare(`
    select lang, title, summary, content_markdown
    from article_translations
    where article_id = ?
    order by lang asc
  `).bind(article.article_id).all();
  return {
    ...article,
    translations: Object.fromEntries(
      (rows.results || []).map((row) => [String(row.lang), {
        title: String(row.title ?? ""),
        summary: String(row.summary ?? ""),
        content_markdown: String(row.content_markdown ?? "")
      }])
    )
  };
}

function sameFinalArticle(existing, draft) {
  if (!existing
      || existing.slug !== draft.slug
      || existing.category !== draft.category
      || existing.status !== "published"
      || typeof existing.published_at !== "string"
      || !existing.published_at
      || Number(existing.is_pinned) !== 0
      || String(existing.cover_image ?? "") !== "") {
    return false;
  }
  if (Object.keys(existing.translations || {}).sort().join(",") !== "en,ja,zh") {
    return false;
  }
  let tags;
  try {
    tags = JSON.parse(String(existing.tags || "[]"));
  } catch {
    return false;
  }
  if (JSON.stringify(tags) !== JSON.stringify(draft.tags)) return false;
  return LANGUAGES.every((lang) => (
    existing.translations?.[lang]?.title === draft.translations[lang].title
    && existing.translations?.[lang]?.summary === draft.translations[lang].summary
    && existing.translations?.[lang]?.content_markdown === draft.translations[lang].content_markdown
  ));
}

function successfulResult(existing, draft, duplicate) {
  if (!sameFinalArticle(existing, draft)) {
    fail("READBACK_MISMATCH", "The stored article did not match the submitted final copy.", 500);
  }
  return {
    ok: true,
    duplicate,
    slug: draft.slug,
    category: draft.category,
    status: "published",
    publishedAt: String(existing.published_at || ""),
    readbackVerified: true,
    titles: Object.fromEntries(LANGUAGES.map((lang) => [lang, existing.translations[lang].title]))
  };
}

function publicArticleUrl(slug, lang) {
  return `${PUBLIC_SITE_ORIGIN}/api/articles/${encodeURIComponent(slug)}?lang=${lang}`;
}

function normalizePublicReadbackOrigin(value) {
  let url;
  try {
    url = new URL(String(value || ""));
  } catch {
    fail("PUBLIC_READBACK_FAILED", "The public readback origin is invalid.", 503);
  }
  if (url.protocol !== "https:"
      || url.origin === PUBLIC_SITE_ORIGIN
      || (url.pathname !== "/" && url.pathname !== "")
      || url.search
      || url.hash) {
    fail("PUBLIC_READBACK_FAILED", "The public readback origin is invalid.", 503);
  }
  return url.origin;
}

function validatePublicArticlePayload(payload, draft, lang) {
  const article = payload?.article;
  const expected = draft.translations[lang];
  if (!article
      || article.slug !== draft.slug
      || article.category !== draft.category
      || article.status !== "published"
      || article.lang !== lang
      || article.requested_lang !== lang
      || article.title !== expected.title
      || article.summary !== expected.summary
      || String(article.content_markdown || "").trim() !== expected.content_markdown) {
    fail(
      "PUBLIC_READBACK_MISMATCH",
      `The ${lang} public article did not match the frozen final copy.`,
      502
    );
  }
}

async function readBoundedJson(response) {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_PUBLIC_RESPONSE_BYTES) {
    fail("PUBLIC_READBACK_FAILED", "The public article response was too large.", 502);
  }
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > MAX_PUBLIC_RESPONSE_BYTES) {
    fail("PUBLIC_READBACK_FAILED", "The public article response was too large.", 502);
  }
  try {
    return JSON.parse(text);
  } catch {
    fail("PUBLIC_READBACK_FAILED", "The public article response was not valid JSON.", 502);
  }
}

async function fetchPublicArticleWithRetry({
  draft,
  lang,
  fetchImpl,
  readbackOrigin,
  retryDelaysMs,
  perAttemptTimeoutMs,
  sleep
}) {
  const url = publicArticleUrl(draft.slug, lang);
  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Origin: readbackOrigin,
          "Sec-Fetch-Site": "cross-site"
        },
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(perAttemptTimeoutMs)
      });
      if (!response.ok) {
        if (TRANSIENT_READBACK_STATUSES.has(response.status)) {
          throw new Error("transient-public-readback");
        }
        fail(
          "PUBLIC_READBACK_FAILED",
          `The ${lang} public article returned an unexpected status.`,
          502
        );
      }
      validatePublicArticlePayload(await readBoundedJson(response), draft, lang);
      return;
    } catch (error) {
      if (error instanceof DailyAiNewsPublishError) throw error;
      if (attempt >= retryDelaysMs.length) {
        fail("PUBLIC_READBACK_FAILED", `The ${lang} public article could not be verified.`, 502);
      }
      await sleep(retryDelaysMs[attempt]);
    }
  }
}

async function verifyPublicArticleTranslations(draft, options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  if (typeof fetchImpl !== "function") {
    fail("PUBLIC_READBACK_FAILED", "The public readback transport is unavailable.", 503);
  }
  const readbackOrigin = normalizePublicReadbackOrigin(options.readbackOrigin);
  await Promise.all(LANGUAGES.map((lang) => fetchPublicArticleWithRetry({
    draft,
    lang,
    fetchImpl,
    readbackOrigin,
    retryDelaysMs: options.retryDelaysMs ?? PUBLIC_READBACK_RETRY_DELAYS_MS,
    perAttemptTimeoutMs: options.perAttemptTimeoutMs ?? PUBLIC_READBACK_ATTEMPT_TIMEOUT_MS,
    sleep: options.sleep ?? ((delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)))
  })));
}

async function verifiedSuccessfulResult(existing, draft, duplicate, options) {
  const result = successfulResult(existing, draft, duplicate);
  await verifyPublicArticleTranslations(draft, options);
  return result;
}

export async function publishDailyAiNews(db, input, options = {}) {
  if (!db || typeof db.prepare !== "function" || typeof db.batch !== "function") {
    fail("DB_UNAVAILABLE", "The Production D1 binding is unavailable.", 503);
  }
  const draft = normalizeDailyAiNewsDraft(input);
  if (options.enforceWindow !== false) {
    enforceScheduledPublishWindow(draft.reportDate, options.now ?? new Date());
  }
  await assertAutomaticPublishingEnabled(db);

  const existing = await readArticleBySlug(db, draft.slug);
  if (existing) {
    if (sameFinalArticle(existing, draft)) {
      return verifiedSuccessfulResult(existing, draft, true, options);
    }
    fail("ARTICLE_CONFLICT", "The report date already has different published content.", 409);
  }

  const nowIso = (options.now ?? new Date()).toISOString();
  const articleId = crypto.randomUUID();
  const statements = [
    db.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (?, ?, 'daily-ai-news', ?, '', 'published', 0, 0, ?, ?, ?)
    `).bind(articleId, draft.slug, JSON.stringify(draft.tags), nowIso, nowIso, nowIso),
    ...LANGUAGES.map((lang) => {
      const item = draft.translations[lang];
      return db.prepare(`
        insert into article_translations (
          translation_id, article_id, lang, title, summary, content_markdown,
          created_at, updated_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        `${articleId}-${lang}`,
        articleId,
        lang,
        item.title,
        item.summary,
        item.content_markdown,
        nowIso,
        nowIso
      );
    })
  ];

  try {
    await db.batch(statements);
  } catch (error) {
    const raced = await readArticleBySlug(db, draft.slug);
    if (raced && sameFinalArticle(raced, draft)) {
      return verifiedSuccessfulResult(raced, draft, true, options);
    }
    if (raced) {
      fail("ARTICLE_CONFLICT", "The report date was published concurrently with different content.", 409);
    }
    fail("PUBLISH_FAILED", "The final article could not be stored atomically.", 500);
  }

  const stored = await readArticleBySlug(db, draft.slug);
  return verifiedSuccessfulResult(stored, draft, false, options);
}
