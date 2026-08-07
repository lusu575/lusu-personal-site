const MAX_TITLE_CHARS = 180;
const MAX_SUMMARY_CHARS = 500;
const MAX_CONTENT_CHARS = 200_000;
const MAX_SLUG_CHARS = 120;
const MAX_CATEGORY_CHARS = 80;
const MAX_TAGS = 12;
const MAX_TAG_CHARS = 40;
const MAX_COVER_IMAGE_CHARS = 500;
const MAX_RECEIPT_RESPONSE_BYTES = 16 * 1024;
const ARTICLE_LANGUAGES = Object.freeze(["zh", "en", "ja"]);
const ARTICLE_STATUSES = new Set(["draft", "published", "archived"]);
const PROTECTED_ARTICLE_CATEGORIES = new Set([
  "site-updates",
  "daily-ai-news",
  "tool-radar"
]);
const OPERATION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,79}$/;
const ARTICLE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,179}$/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CATEGORY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PRINCIPAL_REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,255}$/;
const PRINCIPAL_SCOPE_PATTERN = /^[a-z0-9][a-z0-9:._-]{0,127}$/;

export async function assertAgentArticleAccess({ env, principal: principalValue, requiredScope }) {
  const principal = normalizeAgentArticlePrincipal(principalValue);
  if (!principal.effectiveScopes.includes(requiredScope)) {
    throw new AgentArticleServiceError(
      `Agent access is missing required scope: ${requiredScope}.`,
      403,
      "AGENT_SCOPE_REQUIRED"
    );
  }
  const row = await env.DB.prepare(
    "select role from users where id = ? limit 1"
  ).bind(principal.userId).first();
  if (String(row?.role || "").toLowerCase() !== "admin") {
    throw new AgentArticleServiceError(
      "The Agent token is no longer backed by a site administrator account.",
      403,
      "AGENT_ADMIN_REQUIRED"
    );
  }
  return principal;
}

function normalizeAgentArticlePrincipal(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AgentArticleServiceError(
      "Agent article principal is invalid.",
      401,
      "AGENT_PRINCIPAL_INVALID"
    );
  }
  const authType = String(value.authType || "").trim();
  const userId = String(value.userId || "").trim();
  const clientId = String(value.clientId || "").trim();
  const grantRef = String(value.grantRef || "").trim();
  const tokenRef = String(value.tokenRef || "").trim();
  const effectiveScopes = normalizedScopes(value.effectiveScopes);
  const agentTokenPrincipal = authType === "agent-token"
    && PRINCIPAL_REF_PATTERN.test(tokenRef)
    && !grantRef;
  const oauthPrincipal = authType === "oauth"
    && PRINCIPAL_REF_PATTERN.test(grantRef)
    && clientId
    && clientId.length <= 2_048
    && !tokenRef;
  if (!userId || userId.length > 128 || /[\u0000-\u001f\u007f]/.test(userId)
    || (!agentTokenPrincipal && !oauthPrincipal)
    || effectiveScopes.length > 32
    || effectiveScopes.some((scope) => !PRINCIPAL_SCOPE_PATTERN.test(scope))) {
    throw new AgentArticleServiceError(
      "Agent article principal is invalid.",
      401,
      "AGENT_PRINCIPAL_INVALID"
    );
  }
  return {
    authType,
    userId,
    clientId,
    grantRef,
    tokenRef,
    effectiveScopes
  };
}

function principalAuditRef(principal) {
  return principal.authType === "oauth"
    ? `oauth:${principal.grantRef}`
    : principal.tokenRef;
}

async function ensureAgentArticleReceiptSchema(env) {
  await env.DB.prepare(`
    create table if not exists agent_article_receipts (
      receipt_id text primary key,
      user_id text not null,
      operation_id text not null,
      action text not null,
      payload_hash text not null,
      article_id text not null default '',
      response_json text not null,
      created_at text not null,
      unique(user_id, operation_id)
    )
  `).run();
  await env.DB.prepare(`
    create index if not exists agent_article_receipts_created_idx
    on agent_article_receipts(created_at)
  `).run();
}

export async function listAgentArticlesService({ env, principal: principalValue, query: queryValue = {} }) {
  await assertAgentArticleAccess({
    env,
    principal: principalValue,
    requiredScope: "content:write"
  });
  const query = normalizeAgentArticleListQuery(queryValue);
  const rows = (await env.DB.prepare(`
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
      coalesce(
        (
          select title
          from article_translations
          where article_id = articles.article_id and lang = 'zh'
          limit 1
        ),
        (
          select title
          from article_translations
          where article_id = articles.article_id
          order by case lang when 'zh' then 0 when 'en' then 1 when 'ja' then 2 else 3 end
          limit 1
        ),
        articles.slug
      ) as title,
      (
        select count(*)
        from article_translations
        where article_id = articles.article_id
      ) as translation_count
    from articles
    where (? = '' or articles.status = ?)
      and (? = '' or articles.category = ?)
    order by articles.updated_at desc, articles.article_id desc
    limit ?
  `).bind(
    query.status,
    query.status,
    query.category,
    query.category,
    query.limit
  ).all()).results || [];

  return agentArticleResult({
    articles: rows.map(toManagedArticleSummary),
    limit: query.limit
  });
}

export async function getAgentArticleService({ env, principal: principalValue, articleId: articleIdValue }) {
  await assertAgentArticleAccess({
    env,
    principal: principalValue,
    requiredScope: "content:write"
  });
  const articleId = normalizeArticleId(articleIdValue);
  const article = await env.DB.prepare(`
    select
      article_id, slug, category, tags, cover_image, status, is_pinned,
      view_count, created_at, updated_at, published_at
    from articles
    where article_id = ?
    limit 1
  `).bind(articleId).first();
  if (!article) {
    throw articleNotFoundError();
  }
  const rows = (await env.DB.prepare(`
    select lang, title, summary, content_markdown, created_at, updated_at
    from article_translations
    where article_id = ? and lang in ('zh', 'en', 'ja')
    order by case lang when 'zh' then 0 when 'en' then 1 when 'ja' then 2 else 3 end
  `).bind(articleId).all()).results || [];
  const byLanguage = new Map(rows.map((row) => [row.lang, row]));
  const translations = Object.fromEntries(ARTICLE_LANGUAGES.map((lang) => {
    const row = byLanguage.get(lang);
    return [lang, row ? {
      title: row.title || "",
      summary: row.summary || "",
      contentMarkdown: row.content_markdown || "",
      createdAt: row.created_at,
      updatedAt: row.updated_at
    } : null];
  }));

  return agentArticleResult({
    article: {
      ...toManagedArticleMetadata(article),
      translations
    }
  });
}

export async function publishAgentArticleService({ env, principal: principalValue, payload: body }) {
  const principal = await assertAgentArticleAccess({
    env,
    principal: principalValue,
    requiredScope: "content:write"
  });
  await ensureAgentArticleReceiptSchema(env);
  const payload = normalizePublishPayload(body);
  assertArticleCategoryMutable("", payload.category);
  const payloadHash = await hashCanonicalPayload({
    action: "publish",
    payload: publishPayloadForHash(payload)
  });
  const existingReceipt = await readAgentArticleReceipt(
    env,
    principal.userId,
    payload.operationId
  );
  if (existingReceipt) {
    return replayAgentArticleReceipt(existingReceipt, "publish", payloadHash);
  }

  const slugConflict = await findArticleBySlug(env, payload.slug);
  if (slugConflict) {
    throw articleSlugConflictError();
  }

  const articleId = crypto.randomUUID();
  const receiptId = crypto.randomUUID();
  const now = new Date().toISOString();
  const publishedAt = payload.publishedAt || now;
  const effectivePinned = payload.category === "site-updates" ? false : payload.isPinned;
  const responsePayload = {
    ok: true,
    duplicate: false,
    articleId,
    slug: payload.slug,
    category: payload.category,
    status: "published",
    updatedAt: now,
    publishedAt
  };

  try {
    await env.DB.batch([
      env.DB.prepare(`
        insert into articles (
          article_id, slug, category, tags, cover_image, status, is_pinned,
          view_count, created_at, updated_at, published_at
        ) values (?, ?, ?, ?, ?, 'published', ?, 0, ?, ?, ?)
      `).bind(
        articleId,
        payload.slug,
        payload.category,
        JSON.stringify(payload.tags),
        payload.coverImage,
        effectivePinned ? 1 : 0,
        now,
        now,
        publishedAt
      ),
      ...articleTranslationInsertStatements(env, articleId, payload.translations, now),
      agentArticleAuditStatement(env, principal, {
        action: "agent-article-published",
        articleId,
        result: "published",
        createdAt: now
      }),
      agentArticleReceiptInsertStatement(env, {
        receiptId,
        userId: principal.userId,
        operationId: payload.operationId,
        action: "publish",
        payloadHash,
        articleId,
        responseJson: JSON.stringify(responsePayload),
        createdAt: now
      })
    ]);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const racedReceipt = await readAgentArticleReceipt(
        env,
        principal.userId,
        payload.operationId
      );
      if (racedReceipt) {
        return replayAgentArticleReceipt(racedReceipt, "publish", payloadHash);
      }
      if (await findArticleBySlug(env, payload.slug)) {
        throw articleSlugConflictError();
      }
    }
    throw error;
  }

  return agentArticleResult(responsePayload, 201);
}

export async function updateAgentArticleService({
  env,
  principal: principalValue,
  articleId: articleIdValue,
  payload: body
}) {
  const principal = await assertAgentArticleAccess({
    env,
    principal: principalValue,
    requiredScope: "content:write"
  });
  await ensureAgentArticleReceiptSchema(env);
  const articleId = normalizeArticleId(articleIdValue);
  const payload = normalizeUpdatePayload(body);
  const payloadHash = await hashCanonicalPayload({
    action: "update",
    articleId,
    payload: updatePayloadForHash(payload)
  });
  const existingReceipt = await readAgentArticleReceipt(
    env,
    principal.userId,
    payload.operationId
  );
  if (existingReceipt) {
    return replayAgentArticleReceipt(existingReceipt, "update", payloadHash);
  }

  const existing = await readArticleMutationState(env, articleId);
  if (!existing) {
    throw articleNotFoundError();
  }
  assertArticleCategoryMutable(existing.category, payload.category);
  if (existing.updated_at !== payload.expectedUpdatedAt) {
    throw articleContentConflictError(existing.updated_at);
  }
  if (payload.slug !== undefined && payload.slug !== existing.slug) {
    const slugConflict = await findArticleBySlug(env, payload.slug);
    if (slugConflict && slugConflict.article_id !== articleId) {
      throw articleSlugConflictError();
    }
  }

  const receiptId = crypto.randomUUID();
  const updatedAt = nextMutationTimestamp(existing.updated_at);
  const responsePayload = {
    ok: true,
    duplicate: false,
    articleId,
    updatedAt
  };
  const statements = [
    conditionalAgentArticleReceiptStatement(env, {
      receiptId,
      userId: principal.userId,
      operationId: payload.operationId,
      action: "update",
      payloadHash,
      articleId,
      responseJson: JSON.stringify(responsePayload),
      createdAt: updatedAt,
      expectedUpdatedAt: payload.expectedUpdatedAt
    }),
    agentArticleUpdateStatement(env, articleId, payload, updatedAt, receiptId),
    ...conditionalArticleTranslationStatements(
      env,
      articleId,
      payload.translations || {},
      updatedAt,
      receiptId
    ),
    conditionalAgentArticleAuditStatement(env, principal, {
      receiptId,
      action: "agent-article-updated",
      articleId,
      result: "updated",
      createdAt: updatedAt
    })
  ];

  let batchResults;
  try {
    batchResults = await env.DB.batch(statements);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const racedReceipt = await readAgentArticleReceipt(
        env,
        principal.userId,
        payload.operationId
      );
      if (racedReceipt) {
        return replayAgentArticleReceipt(racedReceipt, "update", payloadHash);
      }
      if (payload.slug !== undefined) {
        const slugConflict = await findArticleBySlug(env, payload.slug);
        if (slugConflict && slugConflict.article_id !== articleId) {
          throw articleSlugConflictError();
        }
      }
    }
    throw error;
  }

  if (Number(batchResults?.[0]?.meta?.changes || 0) !== 1
    || Number(batchResults?.[1]?.meta?.changes || 0) !== 1) {
    const racedReceipt = await readAgentArticleReceipt(
      env,
      principal.userId,
      payload.operationId
    );
    if (racedReceipt) {
      return replayAgentArticleReceipt(racedReceipt, "update", payloadHash);
    }
    const current = await readArticleMutationState(env, articleId);
    if (!current) {
      throw articleNotFoundError();
    }
    throw articleContentConflictError(current.updated_at);
  }

  return agentArticleResult(responsePayload);
}

export async function deleteAgentArticleService({
  env,
  principal: principalValue,
  articleId: articleIdValue,
  payload: body
}) {
  const principal = await assertAgentArticleAccess({
    env,
    principal: principalValue,
    requiredScope: "content:delete"
  });
  await ensureAgentArticleReceiptSchema(env);
  const articleId = normalizeArticleId(articleIdValue);
  const payload = normalizeDeletePayload(body);
  const payloadHash = await hashCanonicalPayload({
    action: "delete",
    articleId,
    payload: deletePayloadForHash(payload)
  });
  const existingReceipt = await readAgentArticleReceipt(
    env,
    principal.userId,
    payload.operationId
  );
  if (existingReceipt) {
    return replayAgentArticleReceipt(existingReceipt, "delete", payloadHash);
  }

  const existing = await readArticleMutationState(env, articleId);
  if (!existing) {
    throw articleNotFoundError();
  }
  assertArticleCategoryMutable(existing.category);
  if (existing.updated_at !== payload.expectedUpdatedAt) {
    throw articleContentConflictError(existing.updated_at);
  }

  const receiptId = crypto.randomUUID();
  const deletedAt = new Date().toISOString();
  const responsePayload = {
    ok: true,
    duplicate: false,
    articleId,
    deleted: true
  };
  const statements = [
    conditionalAgentArticleReceiptStatement(env, {
      receiptId,
      userId: principal.userId,
      operationId: payload.operationId,
      action: "delete",
      payloadHash,
      articleId,
      responseJson: JSON.stringify(responsePayload),
      createdAt: deletedAt,
      expectedUpdatedAt: payload.expectedUpdatedAt
    }),
    conditionalAgentArticleAuditStatement(env, principal, {
      receiptId,
      action: "agent-article-deleted",
      articleId,
      result: "deleted",
      createdAt: deletedAt
    }),
    env.DB.prepare(`
      delete from articles
      where article_id = ?
        and updated_at = ?
        and exists (
          select 1 from agent_article_receipts where receipt_id = ?
        )
    `).bind(articleId, payload.expectedUpdatedAt, receiptId)
  ];

  let batchResults;
  try {
    batchResults = await env.DB.batch(statements);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const racedReceipt = await readAgentArticleReceipt(
        env,
        principal.userId,
        payload.operationId
      );
      if (racedReceipt) {
        return replayAgentArticleReceipt(racedReceipt, "delete", payloadHash);
      }
    }
    throw error;
  }

  // Production D1 may include foreign-key-cascaded translation rows here.
  const deletedChanges = Number(batchResults?.[2]?.meta?.changes || 0);
  if (Number(batchResults?.[0]?.meta?.changes || 0) !== 1
    || deletedChanges < 1) {
    const racedReceipt = await readAgentArticleReceipt(
      env,
      principal.userId,
      payload.operationId
    );
    if (racedReceipt) {
      return replayAgentArticleReceipt(racedReceipt, "delete", payloadHash);
    }
    const current = await readArticleMutationState(env, articleId);
    if (!current) {
      throw articleNotFoundError();
    }
    throw articleContentConflictError(current.updated_at);
  }

  return agentArticleResult(responsePayload);
}

function normalizeAgentArticleListQuery(value) {
  assertStrictObject(value, ["status", "category", "limit"], "ARTICLE_QUERY_INVALID");
  const status = String(value.status || "").trim();
  if (status && !ARTICLE_STATUSES.has(status)) {
    throw new AgentArticleServiceError(
      "Article status filter is invalid.",
      400,
      "ARTICLE_QUERY_INVALID"
    );
  }
  const rawCategory = value.category;
  const category = rawCategory === undefined ? "" : normalizeCategory(rawCategory);
  const rawLimit = value.limit;
  const limit = rawLimit === undefined || rawLimit === "" ? 50 : Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
    throw new AgentArticleServiceError(
      "Article list limit must be an integer from 1 to 200.",
      400,
      "ARTICLE_QUERY_INVALID"
    );
  }
  return { status, category, limit };
}

function normalizePublishPayload(body) {
  assertStrictObject(body, [
    "operationId",
    "slug",
    "category",
    "tags",
    "coverImage",
    "isPinned",
    "publishedAt",
    "translations"
  ]);
  const requestedPinned = body.isPinned === undefined ? false : normalizeBoolean(
    body.isPinned,
    "Article pin setting is invalid.",
    "ARTICLE_PIN_INVALID"
  );
  return {
    operationId: normalizeOperationId(body.operationId),
    slug: normalizeSlug(body.slug),
    category: body.category === undefined ? "note" : normalizeCategory(body.category),
    tags: body.tags === undefined ? [] : normalizeTags(body.tags),
    coverImage: body.coverImage === undefined
      ? ""
      : normalizeBoundedString(body.coverImage, MAX_COVER_IMAGE_CHARS, {
        allowEmpty: true,
        code: "ARTICLE_COVER_IMAGE_INVALID",
        message: "Article cover image is invalid."
      }),
    isPinned: requestedPinned,
    publishedAt: body.publishedAt === undefined
      ? null
      : normalizeTimestamp(body.publishedAt, false),
    translations: normalizeTranslations(body.translations, true)
  };
}

function normalizeUpdatePayload(body) {
  assertStrictObject(body, [
    "operationId",
    "expectedUpdatedAt",
    "slug",
    "category",
    "tags",
    "coverImage",
    "isPinned",
    "publishedAt",
    "translations"
  ]);
  const payload = {
    operationId: normalizeOperationId(body.operationId),
    expectedUpdatedAt: normalizeTimestamp(body.expectedUpdatedAt, false)
  };
  if (body.slug !== undefined) payload.slug = normalizeSlug(body.slug);
  if (body.category !== undefined) payload.category = normalizeCategory(body.category);
  if (body.tags !== undefined) payload.tags = normalizeTags(body.tags);
  if (body.coverImage !== undefined) {
    payload.coverImage = normalizeBoundedString(body.coverImage, MAX_COVER_IMAGE_CHARS, {
      allowEmpty: true,
      code: "ARTICLE_COVER_IMAGE_INVALID",
      message: "Article cover image is invalid."
    });
  }
  if (body.isPinned !== undefined) {
    payload.isPinned = normalizeBoolean(
      body.isPinned,
      "Article pin setting is invalid.",
      "ARTICLE_PIN_INVALID"
    );
  }
  if (body.publishedAt !== undefined) {
    payload.publishedAt = normalizeTimestamp(body.publishedAt, true);
  }
  if (body.translations !== undefined) {
    payload.translations = normalizeTranslations(body.translations, false);
  }
  if (!Object.keys(payload).some((key) => !["operationId", "expectedUpdatedAt"].includes(key))) {
    throw new AgentArticleServiceError(
      "Article update must include at least one metadata or translation change.",
      400,
      "ARTICLE_UPDATE_EMPTY"
    );
  }
  return payload;
}

function normalizeDeletePayload(body) {
  assertStrictObject(body, ["operationId", "expectedUpdatedAt", "confirm"]);
  if (body.confirm !== true) {
    throw new AgentArticleServiceError(
      "Permanent article deletion requires confirm=true.",
      400,
      "ARTICLE_DELETE_CONFIRMATION_REQUIRED"
    );
  }
  return {
    operationId: normalizeOperationId(body.operationId),
    expectedUpdatedAt: normalizeTimestamp(body.expectedUpdatedAt, false),
    confirm: true
  };
}

function normalizeTranslations(value, requireAll) {
  assertStrictObject(value, ARTICLE_LANGUAGES, "ARTICLE_TRANSLATIONS_INVALID");
  const keys = Object.keys(value);
  if (!keys.length || (requireAll && !ARTICLE_LANGUAGES.every((lang) => keys.includes(lang)))) {
    throw new AgentArticleServiceError(
      requireAll
        ? "Article publishing requires complete zh, en, and ja translations."
        : "Article update translations cannot be empty.",
      400,
      "ARTICLE_TRANSLATIONS_INVALID"
    );
  }
  return Object.fromEntries(ARTICLE_LANGUAGES.filter((lang) => value[lang] !== undefined).map((lang) => {
    const item = value[lang];
    assertStrictObject(
      item,
      ["title", "summary", "contentMarkdown"],
      "ARTICLE_TRANSLATIONS_INVALID"
    );
    return [lang, {
      title: normalizeBoundedString(item.title, MAX_TITLE_CHARS, {
        code: "ARTICLE_TRANSLATIONS_INVALID",
        message: `${lang} article title is invalid.`
      }),
      summary: item.summary === undefined
        ? ""
        : normalizeBoundedString(item.summary, MAX_SUMMARY_CHARS, {
          allowEmpty: true,
          code: "ARTICLE_TRANSLATIONS_INVALID",
          message: `${lang} article summary is invalid.`
        }),
      contentMarkdown: normalizeBoundedString(item.contentMarkdown, MAX_CONTENT_CHARS, {
        code: "ARTICLE_TRANSLATIONS_INVALID",
        message: `${lang} article Markdown is invalid.`
      })
    }];
  }));
}

function normalizeOperationId(value) {
  if (typeof value !== "string" || !OPERATION_ID_PATTERN.test(value)) {
    throw new AgentArticleServiceError(
      "operationId must contain 8 to 80 safe characters.",
      400,
      "ARTICLE_OPERATION_ID_INVALID"
    );
  }
  return value;
}

function normalizeArticleId(value) {
  const articleId = String(value || "").trim();
  if (!ARTICLE_ID_PATTERN.test(articleId)) {
    throw new AgentArticleServiceError(
      "Article id is invalid.",
      400,
      "ARTICLE_ID_INVALID"
    );
  }
  return articleId;
}

function normalizeSlug(value) {
  if (typeof value !== "string") {
    throw new AgentArticleServiceError("Article slug is invalid.", 400, "ARTICLE_SLUG_INVALID");
  }
  const slug = value.trim();
  if (slug.length > MAX_SLUG_CHARS || !SLUG_PATTERN.test(slug)) {
    throw new AgentArticleServiceError("Article slug is invalid.", 400, "ARTICLE_SLUG_INVALID");
  }
  return slug;
}

function normalizeCategory(value) {
  if (typeof value !== "string") {
    throw new AgentArticleServiceError(
      "Article category is invalid.",
      400,
      "ARTICLE_CATEGORY_INVALID"
    );
  }
  const category = value.trim();
  if (category.length > MAX_CATEGORY_CHARS || !CATEGORY_PATTERN.test(category)) {
    throw new AgentArticleServiceError(
      "Article category is invalid.",
      400,
      "ARTICLE_CATEGORY_INVALID"
    );
  }
  return category;
}

function normalizeTags(value) {
  if (!Array.isArray(value) || value.length > MAX_TAGS) {
    throw new AgentArticleServiceError("Article tags are invalid.", 400, "ARTICLE_TAGS_INVALID");
  }
  return value.map((tag) => normalizeBoundedString(tag, MAX_TAG_CHARS, {
    code: "ARTICLE_TAGS_INVALID",
    message: "Article tags are invalid."
  }));
}

function normalizeBoolean(value, message, code) {
  if (typeof value !== "boolean") {
    throw new AgentArticleServiceError(message, 400, code);
  }
  return value;
}

function normalizeBoundedString(value, maxChars, options = {}) {
  if (typeof value !== "string") {
    throw new AgentArticleServiceError(options.message, 400, options.code);
  }
  const text = value.trim();
  if ((!options.allowEmpty && !text) || Array.from(text).length > maxChars) {
    throw new AgentArticleServiceError(options.message, 400, options.code);
  }
  return text;
}

function normalizeTimestamp(value, allowNull) {
  if (allowNull && value === null) return null;
  if (typeof value !== "string") {
    throw new AgentArticleServiceError(
      "Article timestamp must be an ISO date-time with a timezone.",
      400,
      "ARTICLE_TIMESTAMP_INVALID"
    );
  }
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|([+-])(\d{2}):(\d{2}))$/
  );
  if (!match || !validDateTimeParts(match)) {
    throw new AgentArticleServiceError(
      "Article timestamp must be an ISO date-time with a timezone.",
      400,
      "ARTICLE_TIMESTAMP_INVALID"
    );
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new AgentArticleServiceError(
      "Article timestamp must be an ISO date-time with a timezone.",
      400,
      "ARTICLE_TIMESTAMP_INVALID"
    );
  }
  return new Date(timestamp).toISOString();
}

function validDateTimeParts(match) {
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6] || 0);
  const offsetHour = Number(match[10] || 0);
  const offsetMinute = Number(match[11] || 0);
  if (year < 1 || month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) {
    return false;
  }
  if (offsetHour > 23 || offsetMinute > 59) {
    return false;
  }
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day >= 1 && day <= daysInMonth;
}

function assertStrictObject(value, allowedFields, code = "ARTICLE_PAYLOAD_INVALID") {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AgentArticleServiceError("Article payload is invalid.", 400, code);
  }
  const allowed = new Set(allowedFields);
  if (Object.keys(value).some((key) => !allowed.has(key))) {
    throw new AgentArticleServiceError("Article payload contains unknown fields.", 400, code);
  }
}

function articleTranslationInsertStatements(env, articleId, translations, createdAt) {
  return ARTICLE_LANGUAGES.map((lang) => {
    const item = translations[lang];
    return env.DB.prepare(`
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
      item.contentMarkdown,
      createdAt,
      createdAt
    );
  });
}

function conditionalArticleTranslationStatements(env, articleId, translations, updatedAt, receiptId) {
  return ARTICLE_LANGUAGES.filter((lang) => translations[lang]).map((lang) => {
    const item = translations[lang];
    return env.DB.prepare(`
      insert into article_translations (
        translation_id, article_id, lang, title, summary, content_markdown,
        created_at, updated_at
      )
      select ?, ?, ?, ?, ?, ?, ?, ?
      where exists (
        select 1 from agent_article_receipts where receipt_id = ?
      )
      on conflict(article_id, lang) do update set
        title = excluded.title,
        summary = excluded.summary,
        content_markdown = excluded.content_markdown,
        updated_at = excluded.updated_at
    `).bind(
      `${articleId}-${lang}`,
      articleId,
      lang,
      item.title,
      item.summary,
      item.contentMarkdown,
      updatedAt,
      updatedAt,
      receiptId
    );
  });
}

function agentArticleUpdateStatement(env, articleId, payload, updatedAt, receiptId) {
  return env.DB.prepare(`
    update articles
    set slug = case when ? = 1 then ? else slug end,
        category = case when ? = 1 then ? else category end,
        tags = case when ? = 1 then ? else tags end,
        cover_image = case when ? = 1 then ? else cover_image end,
        is_pinned = case when ? = 1 then ? else is_pinned end,
        published_at = case when ? = 1 then ? else published_at end,
        updated_at = ?
    where article_id = ?
      and updated_at = ?
      and exists (
        select 1 from agent_article_receipts where receipt_id = ?
      )
  `).bind(
    hasOwn(payload, "slug") ? 1 : 0,
    payload.slug ?? null,
    hasOwn(payload, "category") ? 1 : 0,
    payload.category ?? null,
    hasOwn(payload, "tags") ? 1 : 0,
    payload.tags ? JSON.stringify(payload.tags) : null,
    hasOwn(payload, "coverImage") ? 1 : 0,
    payload.coverImage ?? null,
    hasOwn(payload, "isPinned") ? 1 : 0,
    payload.isPinned === undefined ? null : (payload.isPinned ? 1 : 0),
    hasOwn(payload, "publishedAt") ? 1 : 0,
    payload.publishedAt ?? null,
    updatedAt,
    articleId,
    payload.expectedUpdatedAt,
    receiptId
  );
}

function agentArticleAuditStatement(env, principal, event) {
  return env.DB.prepare(`
    insert into agent_audit_log (
      event_id, actor_user_id, token_id, action, target_type, target_id,
      scopes, result, created_at
    ) values (?, ?, ?, ?, 'article', ?, ?, ?, ?)
  `).bind(
    crypto.randomUUID(),
    principal.userId,
    principalAuditRef(principal),
    event.action,
    event.articleId,
    JSON.stringify(principal.effectiveScopes),
    event.result,
    event.createdAt
  );
}

function conditionalAgentArticleAuditStatement(env, principal, event) {
  return env.DB.prepare(`
    insert into agent_audit_log (
      event_id, actor_user_id, token_id, action, target_type, target_id,
      scopes, result, created_at
    )
    select ?, ?, ?, ?, 'article', ?, ?, ?, ?
    where exists (
      select 1 from agent_article_receipts where receipt_id = ?
    )
  `).bind(
    crypto.randomUUID(),
    principal.userId,
    principalAuditRef(principal),
    event.action,
    event.articleId,
    JSON.stringify(principal.effectiveScopes),
    event.result,
    event.createdAt,
    event.receiptId
  );
}

function agentArticleReceiptInsertStatement(env, receipt) {
  return env.DB.prepare(`
    insert into agent_article_receipts (
      receipt_id, user_id, operation_id, action, payload_hash,
      article_id, response_json, created_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    receipt.receiptId,
    receipt.userId,
    receipt.operationId,
    receipt.action,
    receipt.payloadHash,
    receipt.articleId,
    receipt.responseJson,
    receipt.createdAt
  );
}

function conditionalAgentArticleReceiptStatement(env, receipt) {
  return env.DB.prepare(`
    insert into agent_article_receipts (
      receipt_id, user_id, operation_id, action, payload_hash,
      article_id, response_json, created_at
    )
    select ?, ?, ?, ?, ?, ?, ?, ?
    where exists (
      select 1
      from articles
      where article_id = ?
        and updated_at = ?
        and category not in ('site-updates', 'daily-ai-news', 'tool-radar')
    )
  `).bind(
    receipt.receiptId,
    receipt.userId,
    receipt.operationId,
    receipt.action,
    receipt.payloadHash,
    receipt.articleId,
    receipt.responseJson,
    receipt.createdAt,
    receipt.articleId,
    receipt.expectedUpdatedAt
  );
}

async function readAgentArticleReceipt(env, userId, operationId) {
  return env.DB.prepare(`
    select action, payload_hash, article_id, response_json
    from agent_article_receipts
    where user_id = ? and operation_id = ?
    limit 1
  `).bind(userId, operationId).first();
}

function replayAgentArticleReceipt(receipt, action, payloadHash) {
  if (receipt.action !== action || receipt.payload_hash !== payloadHash) {
    throw new AgentArticleServiceError(
      "operationId was already used for a different article action or payload.",
      409,
      "ARTICLE_OPERATION_CONFLICT"
    );
  }
  const responseText = String(receipt.response_json || "");
  if (new TextEncoder().encode(responseText).byteLength > MAX_RECEIPT_RESPONSE_BYTES) {
    throw invalidReceiptError();
  }
  let payload;
  try {
    payload = JSON.parse(responseText);
  } catch {
    throw invalidReceiptError();
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)
    || payload.articleId !== receipt.article_id) {
    throw invalidReceiptError();
  }
  return agentArticleResult({ ...payload, duplicate: true });
}

function invalidReceiptError() {
  return new AgentArticleServiceError(
    "Stored Agent article receipt is invalid.",
    500,
    "AGENT_ARTICLE_RECEIPT_INVALID"
  );
}

async function readArticleMutationState(env, articleId) {
  return env.DB.prepare(`
    select article_id, slug, category, updated_at
    from articles
    where article_id = ?
    limit 1
  `).bind(articleId).first();
}

async function findArticleBySlug(env, slug) {
  return env.DB.prepare(`
    select article_id, slug
    from articles
    where slug = ?
    limit 1
  `).bind(slug).first();
}

function assertArticleCategoryMutable(existingCategory, requestedCategory) {
  if (PROTECTED_ARTICLE_CATEGORIES.has(existingCategory)
    || (requestedCategory !== undefined && PROTECTED_ARTICLE_CATEGORIES.has(requestedCategory))) {
    throw new AgentArticleServiceError(
      "This governed article category cannot be updated or deleted through the general Agent API.",
      409,
      "ARTICLE_CATEGORY_PROTECTED"
    );
  }
}

function articleNotFoundError() {
  return new AgentArticleServiceError("Article was not found.", 404, "ARTICLE_NOT_FOUND");
}

function articleSlugConflictError() {
  return new AgentArticleServiceError(
    "Article slug is already in use.",
    409,
    "ARTICLE_SLUG_CONFLICT"
  );
}

function articleContentConflictError(updatedAt) {
  return new AgentArticleServiceError(
    "Article changed after it was read.",
    409,
    "CONTENT_CONFLICT",
    { updatedAt: updatedAt || null }
  );
}

function nextMutationTimestamp(previousTimestamp) {
  const previous = Date.parse(previousTimestamp);
  const timestamp = Math.max(Date.now(), Number.isFinite(previous) ? previous + 1 : 0);
  return new Date(timestamp).toISOString();
}

function toManagedArticleSummary(row) {
  return {
    ...toManagedArticleMetadata(row),
    title: row.title || row.slug,
    translationCount: Number(row.translation_count || 0)
  };
}

function toManagedArticleMetadata(row) {
  return {
    articleId: row.article_id,
    slug: row.slug,
    category: row.category,
    tags: parseStoredTags(row.tags),
    coverImage: row.cover_image || "",
    status: row.status,
    isPinned: Number(row.is_pinned || 0) === 1,
    viewCount: Number(row.view_count || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at || null
  };
}

function parseStoredTags(value) {
  try {
    const tags = JSON.parse(value || "[]");
    return Array.isArray(tags) ? tags.map((tag) => String(tag)) : [];
  } catch {
    return [];
  }
}

function publishPayloadForHash(payload) {
  return {
    slug: payload.slug,
    category: payload.category,
    tags: payload.tags,
    coverImage: payload.coverImage,
    isPinned: payload.isPinned,
    publishedAt: payload.publishedAt,
    translations: payload.translations
  };
}

function updatePayloadForHash(payload) {
  return Object.fromEntries(
    Object.entries(payload).filter(([key]) => key !== "operationId")
  );
}

function deletePayloadForHash(payload) {
  return {
    expectedUpdatedAt: payload.expectedUpdatedAt,
    confirm: payload.confirm
  };
}

async function hashCanonicalPayload(value) {
  const bytes = new TextEncoder().encode(canonicalJson(value));
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${canonicalJson(value[key])}`
    )).join(",")}}`;
  }
  return JSON.stringify(value);
}

function normalizedScopes(scopes) {
  return [...new Set((scopes || []).map((scope) => String(scope)))].sort();
}

function isUniqueConstraintError(error) {
  return /(?:unique|constraint failed)/i.test(
    error instanceof Error ? error.message : String(error || "")
  );
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function agentArticleResult(payload, status = 200) {
  return { status, payload };
}

export class AgentArticleServiceError extends Error {
  constructor(message, status, code, details = null) {
    super(message);
    this.name = "AgentArticleServiceError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
