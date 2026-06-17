const SESSION_COOKIE = "lusu_session";
const SESSION_DAYS = 30;
const MAX_SAVE_BYTES = 1024 * 1024;
const PASSWORD_HASH_ITERATIONS = 25000;
const MAX_CHAT_MESSAGE_CHARS = 300;
const MAX_CHAT_NICKNAME_CHARS = 16;
const CHAT_COOLDOWN_MS = 3000;
const CHAT_IP_WINDOW_MS = 60000;
const CHAT_IP_WINDOW_LIMIT = 20;
const CHAT_NICKNAME_LOOKBACK_LIMIT = 1000;
const VISITOR_COOKIE = "lusu_visitor";
const VISITOR_DAYS = 365;
const OWNER_ADMIN_EMAILS = new Set(["630739094@qq.com"]);
const MAX_VIDEO_THUMBNAIL_TEXT_CHARS = 420000;
const MAX_LOCAL_THUMBNAIL_BYTES = 320 * 1024;
const LOCAL_THUMBNAIL_MIME_TYPES = new Set(["jpeg", "jpg", "png", "webp", "avif"]);
const VIDEO_METADATA_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";
const YOUTUBE_METADATA_HEADERS = {
  "User-Agent": VIDEO_METADATA_USER_AGENT,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8"
};
const BILIBILI_METADATA_HEADERS = {
  "User-Agent": VIDEO_METADATA_USER_AGENT,
  Accept: "application/json,text/plain,*/*",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  Referer: "https://www.bilibili.com/"
};
const BILIBILI_PAGE_HEADERS = {
  ...BILIBILI_METADATA_HEADERS,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
};
const VIDEO_CATEGORY_SEED_FLAG = "video_categories_default_seeded";
const DEFAULT_VIDEO_CATEGORIES = [
  ["video-cat-vrchat", "vrchat", "VRChat作品", "VRChat Works", "VRChat作品", 10],
  ["video-cat-ai", "ai-experiments", "AI实验", "AI Experiments", "AI実験", 20],
  ["video-cat-games", "game-records", "游戏录像", "Game Records", "ゲーム録画", 30],
  ["video-cat-favorites", "favorites", "收藏视频", "Saved Videos", "お気に入り動画", 40]
];
let coreSchemaReady = false;
let chatSchemaReady = false;
let articleSchemaReady = false;
let articleSeedReady = false;
let analyticsSchemaReady = false;
let videoSchemaReady = false;

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/?/, "");
  const parts = path.split("/").filter(Boolean);

  if (!env.DB) {
    return json({ error: "D1 database binding DB is not configured." }, 500);
  }

  try {
    await ensureCoreSchema(env);

    if (request.method === "GET" && parts[0] === "health") {
      return await health(env);
    }
    if (request.method === "POST" && parts[0] === "auth" && parts[1] === "register") {
      return await register(request, env);
    }
    if (request.method === "POST" && parts[0] === "auth" && parts[1] === "login") {
      return await login(request, env);
    }
    if (request.method === "POST" && parts[0] === "auth" && parts[1] === "logout") {
      return await logout(request, env);
    }
    if (request.method === "GET" && parts[0] === "auth" && parts[1] === "me") {
      return await me(request, env);
    }
    if (parts[0] === "chat" && parts[1] === "messages") {
      if (request.method === "GET") {
        return await getChatMessages(request, env);
      }
      if (request.method === "POST") {
        return await postChatMessage(request, env);
      }
    }
    if (request.method === "GET" && parts[0] === "chat" && parts[1] === "nickname") {
      return await getChatNickname(env);
    }
    if (parts[0] === "analytics") {
      await ensureAnalyticsSchema(env);
      if (request.method === "POST" && parts[1] === "identify") {
        return await identifyVisitor(request, env);
      }
      if (request.method === "POST" && parts[1] === "page-view") {
        return await recordPageView(request, env);
      }
      if (request.method === "POST" && parts[1] === "click") {
        return await recordClickEvent(request, env);
      }
    }
    if (parts[0] === "articles") {
      await ensureArticleSchema(env);
      await seedArticleTestData(env);
      if (request.method === "GET" && !parts[1]) {
        return await getArticles(request, env);
      }
      if (request.method === "GET" && parts[1]) {
        return await getArticle(request, env, parts[1]);
      }
    }
    if (parts[0] === "videos") {
      await ensureVideoSchema(env);
      if (request.method === "GET" && !parts[1]) {
        return await getVideos(request, env);
      }
      if (request.method === "GET" && parts[1]) {
        return await getVideo(request, env, parts[1]);
      }
    }
    if (parts[0] === "admin" && request.method === "GET" && parts[1] === "me") {
      return await adminMe(request, env);
    }
    if (parts[0] === "admin" && parts[1] === "accounts") {
      await ensureAnalyticsSchema(env);
      if (request.method === "GET" && !parts[2]) {
        return await getAdminAccounts(request, env);
      }
      if (request.method === "GET" && parts[2]) {
        return await getAdminAccount(request, env, parts[2]);
      }
      if (request.method === "PUT" && parts[2]) {
        return await updateAdminAccount(request, env, parts[2]);
      }
    }
    if (parts[0] === "admin" && parts[1] === "analytics") {
      await ensureAnalyticsSchema(env);
      await ensureChatSchema(env);
      await ensureArticleSchema(env);
      await seedArticleTestData(env);
      if (request.method === "GET" && parts[2] === "overview") {
        return await getAdminAnalyticsOverview(request, env);
      }
    }
    if (parts[0] === "admin" && parts[1] === "chat") {
      await ensureChatSchema(env);
      if (request.method === "GET" && parts[2] === "messages") {
        return await getAdminChatMessages(request, env);
      }
      if (request.method === "PUT" && parts[2] === "messages" && parts[3]) {
        return await updateAdminChatMessage(request, env, parts[3]);
      }
      if (request.method === "DELETE" && parts[2] === "messages" && parts[3]) {
        return await deleteAdminChatMessage(request, env, parts[3]);
      }
      if (request.method === "GET" && parts[2] === "bans") {
        return await getAdminChatBans(request, env);
      }
      if (request.method === "POST" && parts[2] === "bans") {
        return await createAdminChatBan(request, env);
      }
      if (request.method === "DELETE" && parts[2] === "bans" && parts[3]) {
        return await disableAdminChatBan(request, env, parts[3]);
      }
    }
    if (parts[0] === "admin" && parts[1] === "articles") {
      await ensureArticleSchema(env);
      await seedArticleTestData(env);
      if (request.method === "GET" && !parts[2]) {
        return await getAdminArticles(request, env);
      }
      if (request.method === "GET" && parts[2]) {
        return await getAdminArticle(request, env, parts[2]);
      }
      if (request.method === "POST" && !parts[2]) {
        return await createArticle(request, env);
      }
      if (request.method === "PUT" && parts[2]) {
        return await updateArticle(request, env, parts[2]);
      }
      if (request.method === "DELETE" && parts[2]) {
        return await deleteArticle(request, env, parts[2]);
      }
    }
    if (parts[0] === "admin" && parts[1] === "videos") {
      await ensureVideoSchema(env);
      if (request.method === "GET" && !parts[2]) {
        return await getAdminVideos(request, env);
      }
      if (request.method === "POST" && !parts[2]) {
        return await createVideo(request, env);
      }
      if (request.method === "POST" && parts[2] === "preview-url") {
        return await previewVideoUrl(request, env);
      }
      if (request.method === "PUT" && parts[2]) {
        return await updateVideo(request, env, parts[2]);
      }
      if (request.method === "DELETE" && parts[2]) {
        return await deleteVideo(request, env, parts[2]);
      }
      if (request.method === "POST" && parts[2] && parts[3] === "refresh-metadata") {
        return await refreshVideoMetadata(request, env, parts[2]);
      }
    }
    if (parts[0] === "admin" && parts[1] === "video-categories") {
      await ensureVideoSchema(env);
      if (request.method === "GET" && !parts[2]) {
        return await getAdminVideoCategories(request, env);
      }
      if (request.method === "POST" && !parts[2]) {
        return await createVideoCategory(request, env);
      }
      if (request.method === "PUT" && parts[2]) {
        return await updateVideoCategory(request, env, parts[2]);
      }
      if (request.method === "DELETE" && parts[2]) {
        return await deleteVideoCategory(request, env, parts[2]);
      }
    }
    if (parts[0] === "saves" && parts[1]) {
      const saveAccessError = await validateSaveAccess(request, env, parts[1]);
      if (saveAccessError) {
        return saveAccessError;
      }
      if (request.method === "GET") {
        return await getSave(request, env, parts[1]);
      }
      if (request.method === "PUT") {
        return await putSave(request, env, parts[1]);
      }
    }

    return json({ error: "Not found." }, 404);
  } catch (error) {
    console.error("API error", error);
    return json({ error: error.message || "Unexpected server error." }, error.status || 500);
  }
}

async function health(env) {
  const row = await env.DB.prepare("select count(*) as user_count from users").first();
  return json({ ok: true, db: true, userCount: row.user_count });
}

async function register(request, env) {
  const body = await readJson(request);
  const email = normalizeEmail(body.email);
  const password = String(body.password || "");
  validateEmail(email);
  validatePassword(password);

  const existing = await env.DB.prepare("select id from users where email = ?").bind(email).first();
  if (existing) {
    return json({ error: "这个邮箱已经注册。" }, 409);
  }

  const userId = crypto.randomUUID();
  const passwordHash = await hashPassword(password);
  const now = nowIso();
  await env.DB.prepare(
    "insert into users (id, email, password_hash, created_at, updated_at) values (?, ?, ?, ?, ?)"
  ).bind(userId, email, passwordHash, now, now).run();

  await recordUserLoginEvent(env, request, { id: userId, email, role: "user" }, "register");
  return createSessionResponse(env, request, userId, email, 201);
}

async function login(request, env) {
  const body = await readJson(request);
  const email = normalizeEmail(body.email);
  const password = String(body.password || "");
  validateEmail(email);

  const user = await env.DB.prepare("select id, email, password_hash, role from users where email = ?").bind(email).first();
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return json({ error: "邮箱或密码不正确。" }, 401);
  }

  await recordUserLoginEvent(env, request, user, "login");
  return createSessionResponse(env, request, user.id, user.email, 200, user.role || "user");
}

async function logout(request, env) {
  const session = await getSession(request, env);
  if (session) {
    await env.DB.prepare("delete from sessions where token_hash = ?").bind(session.tokenHash).run();
  }
  const response = json({ ok: true });
  response.headers.append("Set-Cookie", cookieValue("", request, 0));
  return response;
}

async function me(request, env) {
  const session = await getSession(request, env);
  if (!session) {
    return json({ user: null });
  }
  return json({ user: { id: session.user.id, email: session.user.email, role: session.user.role } });
}

async function getSave(request, env, gameId) {
  validateGameId(gameId);
  const session = await requireSession(request, env);
  const row = await env.DB.prepare(
    "select save_data, updated_at from game_saves where user_id = ? and game_id = ?"
  ).bind(session.user.id, gameId).first();

  if (!row) {
    return json({ save: null });
  }
  return json({ save: JSON.parse(row.save_data), updatedAt: row.updated_at });
}

async function putSave(request, env, gameId) {
  validateGameId(gameId);
  const session = await requireSession(request, env);
  const body = await readJson(request);
  if (!body || typeof body.saveData !== "object" || Array.isArray(body.saveData)) {
    return json({ error: "存档格式不正确。" }, 400);
  }

  const saveData = JSON.stringify(body.saveData);
  if (new TextEncoder().encode(saveData).length > MAX_SAVE_BYTES) {
    return json({ error: "存档太大，暂时不能同步。" }, 413);
  }

  const now = nowIso();
  await env.DB.prepare(`
    insert into game_saves (user_id, game_id, save_data, updated_at)
    values (?, ?, ?, ?)
    on conflict(user_id, game_id)
    do update set save_data = excluded.save_data, updated_at = excluded.updated_at
  `).bind(session.user.id, gameId, saveData, now).run();

  return json({ ok: true, updatedAt: now });
}

async function validateSaveAccess(request, env, gameId) {
  if (!isValidGameId(gameId)) {
    return json({ error: "游戏编号不正确。" }, 400);
  }
  if (!readCookie(request, SESSION_COOKIE)) {
    return json({ error: "请先登录。" }, 401);
  }
  const session = await getSession(request, env);
  if (!session) {
    return json({ error: "请先登录。" }, 401);
  }
  return null;
}

async function getChatMessages(request, env) {
  await ensureChatSchema(env);
  const url = new URL(request.url);
  const limit = clampLimit(url.searchParams.get("limit"), 100);
  const after = String(url.searchParams.get("after") || "").trim();

  let rows;
  if (after) {
    const cursor = await env.DB.prepare(
      "select created_at from anonymous_chat_messages where message_id = ?"
    ).bind(after).first();

    if (!cursor) {
      rows = [];
    } else {
      rows = (await env.DB.prepare(`
        select message_id, coalesce(nullif(client_id, ''), visitor_id) as visitor_id, nickname, content, created_at
        from anonymous_chat_messages
        where hidden = 0
          and (created_at > ? or (created_at = ? and message_id > ?))
        order by created_at asc, message_id asc
        limit ?
      `).bind(cursor.created_at, cursor.created_at, after, limit).all()).results || [];
    }
  } else {
    rows = (await env.DB.prepare(`
      select message_id, visitor_id, nickname, content, created_at
      from (
        select message_id, coalesce(nullif(client_id, ''), visitor_id) as visitor_id, nickname, content, created_at
        from anonymous_chat_messages
        where hidden = 0
        order by created_at desc, message_id desc
        limit ?
      )
      order by created_at asc, message_id asc
    `).bind(limit).all()).results || [];
  }

  return json({ messages: rows });
}

async function postChatMessage(request, env) {
  await ensureChatSchema(env);
  await ensureAnalyticsSchema(env);
  const body = await readJson(request);
  const clientId = normalizeVisitorId(body.visitorId);
  const identity = getOrCreateVisitorIdentity(request);
  const nickname = normalizeChatNickname(body.nickname);
  const content = normalizeChatContent(body.content);
  const ipInfo = await requestIpInfo(request, env, "chat");
  const ipHash = ipInfo.ipHash;
  const now = new Date();
  const nowText = now.toISOString();
  const visitorSince = new Date(now.getTime() - CHAT_COOLDOWN_MS).toISOString();
  const ipSince = new Date(now.getTime() - CHAT_IP_WINDOW_MS).toISOString();

  await ensureVisitorProfile(env, request, identity.visitorId, {}, false);
  const ban = await activeChatBan(env, identity.visitorId, ipHash);
  if (ban) {
    const expires = ban.expires_at ? `，到 ${ban.expires_at} 结束` : "";
    return withVisitorCookie(json({ error: `当前访客已被禁言${expires}。` }, 403), request, identity);
  }

  const recentVisitor = await env.DB.prepare(`
    select created_at
    from anonymous_chat_messages
    where visitor_id = ? and created_at > ?
    order by created_at desc
    limit 1
  `).bind(identity.visitorId, visitorSince).first();
  if (recentVisitor) {
    return withVisitorCookie(json({ error: "发送太快啦，请等 3 秒。" }, 429), request, identity);
  }

  const ipRow = await env.DB.prepare(`
    select count(*) as count
    from anonymous_chat_messages
    where ip_hash = ? and created_at > ?
  `).bind(ipHash, ipSince).first();
  if (Number(ipRow?.count || 0) >= CHAT_IP_WINDOW_LIMIT) {
    return withVisitorCookie(json({ error: "当前网络发送过于频繁，请稍后再试。" }, 429), request, identity);
  }

  const nicknameOwner = await env.DB.prepare(`
    select visitor_id
    from anonymous_chat_messages
    where hidden = 0 and nickname = ? and visitor_id <> ?
    order by created_at desc
    limit 1
  `).bind(nickname, identity.visitorId).first();
  if (nicknameOwner) {
    return withVisitorCookie(json({ error: "这个随机昵称已经被使用，请刷新聊天室获取新昵称。", code: "nickname_taken" }, 409), request, identity);
  }

  const messageId = chatMessageId(now);
  await env.DB.prepare(`
    insert into anonymous_chat_messages (message_id, visitor_id, client_id, nickname, content, created_at, hidden, ip_hash, ip_prefix)
    values (?, ?, ?, ?, ?, ?, 0, ?, ?)
  `).bind(messageId, identity.visitorId, clientId, nickname, content, nowText, ipHash, ipInfo.ipPrefix).run();

  return withVisitorCookie(json({
    message: {
      message_id: messageId,
      visitor_id: clientId,
      nickname,
      content,
      created_at: nowText
    }
  }, 201), request, identity);
}

async function getChatNickname(env) {
  await ensureChatSchema(env);
  const used = await recentChatNicknames(env);
  return json({ nickname: randomAvailableChatNickname(used) });
}

async function getArticles(request, env) {
  const url = new URL(request.url);
  const lang = normalizeArticleLang(url.searchParams.get("lang"));
  const limit = clampLimit(url.searchParams.get("limit"), 50);
  const category = normalizeOptionalText(url.searchParams.get("category"), 80);
  const where = ["articles.status = 'published'"];
  const binds = [lang, limit];

  if (category) {
    where.push("articles.category = ?");
    binds.splice(1, 0, category);
  }

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
  `).bind(...binds).all()).results || [];

  return json({ articles: rows.map(publicArticleRow), lang });
}

async function getArticle(request, env, slug) {
  const url = new URL(request.url);
  const lang = normalizeArticleLang(url.searchParams.get("lang"));
  const normalizedSlug = normalizeSlug(slug);
  const row = await env.DB.prepare(`
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
  `).bind(lang, normalizedSlug).first();

  if (!row || !row.title) {
    return json({ error: "文章不存在。" }, 404);
  }

  await env.DB.prepare("update articles set view_count = view_count + 1 where article_id = ?")
    .bind(row.article_id).run();
  row.view_count = Number(row.view_count || 0) + 1;

  const identity = await recordArticleView(request, env, row, row.lang || lang);
  return withVisitorCookie(json({ article: publicArticleRow(row, true), lang }), request, identity.cookieIdentity);
}

async function getAdminArticles(request, env) {
  await requireAdmin(request, env);
  await ensureAnalyticsSchema(env);
  const rows = (await env.DB.prepare(`
    select
      articles.*,
      count(article_translations.translation_id) as translation_count,
      (
        select count(*)
        from article_view_events
        where article_view_events.article_id = articles.article_id
      ) as article_pv,
      (
        select count(distinct visitor_id)
        from article_view_events
        where article_view_events.article_id = articles.article_id
      ) as article_uv
    from articles
    left join article_translations on article_translations.article_id = articles.article_id
    group by articles.article_id
    order by articles.updated_at desc, articles.article_id desc
  `).all()).results || [];
  return json({ articles: rows.map((row) => ({ ...row, tags: parseTags(row.tags) })) });
}

async function createArticle(request, env) {
  await requireAdmin(request, env);
  const body = await readJson(request);
  const article = normalizeArticlePayload(body);
  const now = nowIso();
  const articleId = crypto.randomUUID();
  const publishedAt = article.status === "published" ? (article.published_at || now) : article.published_at;

  await env.DB.batch([
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
    `).bind(
      articleId, article.slug, article.category, JSON.stringify(article.tags), article.cover_image,
      article.status, article.is_pinned, now, now, publishedAt
    ),
    ...articleTranslationsStatements(env, articleId, article.translations, now)
  ]);

  return json({ ok: true, articleId, slug: article.slug }, 201);
}

async function updateArticle(request, env, articleId) {
  await requireAdmin(request, env);
  const body = await readJson(request);
  const article = normalizeArticlePayload(body, { partial: true });
  const existing = await env.DB.prepare("select article_id, published_at from articles where article_id = ?")
    .bind(articleId).first();
  if (!existing) {
    return json({ error: "文章不存在。" }, 404);
  }

  const now = nowIso();
  const publishedAt = article.status === "published" && !existing.published_at
    ? (article.published_at || now)
    : (article.published_at === undefined ? existing.published_at : article.published_at);

  await env.DB.batch([
    env.DB.prepare(`
      update articles
      set slug = coalesce(?, slug),
          category = coalesce(?, category),
          tags = coalesce(?, tags),
          cover_image = coalesce(?, cover_image),
          status = coalesce(?, status),
          is_pinned = coalesce(?, is_pinned),
          updated_at = ?,
          published_at = ?
      where article_id = ?
    `).bind(
      article.slug ?? null,
      article.category ?? null,
      article.tags ? JSON.stringify(article.tags) : null,
      article.cover_image ?? null,
      article.status ?? null,
      article.is_pinned ?? null,
      now,
      publishedAt,
      articleId
    ),
    ...(article.translations ? articleTranslationsStatements(env, articleId, article.translations, now) : [])
  ]);

  return json({ ok: true, articleId });
}

async function deleteArticle(request, env, articleId) {
  await requireAdmin(request, env);
  const result = await env.DB.prepare("delete from articles where article_id = ?").bind(articleId).run();
  if (!result.meta?.changes) {
    return json({ error: "文章不存在。" }, 404);
  }
  return json({ ok: true });
}

async function getAdminArticle(request, env, articleId) {
  await requireAdmin(request, env);
  await ensureAnalyticsSchema(env);
  const normalizedId = normalizeRecordId(articleId, "文章编号不正确。");
  const article = await env.DB.prepare("select * from articles where article_id = ?")
    .bind(normalizedId).first();
  if (!article) {
    return json({ error: "文章不存在。" }, 404);
  }
  const translations = (await env.DB.prepare(`
    select lang, title, summary, content_markdown, created_at, updated_at
    from article_translations
    where article_id = ?
    order by case lang when 'zh' then 0 when 'en' then 1 when 'ja' then 2 else 3 end
  `).bind(normalizedId).all()).results || [];
  const translationMap = {};
  translations.forEach((item) => {
    translationMap[item.lang] = {
      title: item.title || "",
      summary: item.summary || "",
      content_markdown: item.content_markdown || "",
      created_at: item.created_at,
      updated_at: item.updated_at
    };
  });
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const todayIso = today.toISOString();
  const metrics = await env.DB.prepare(`
    select
      count(*) as article_pv,
      count(distinct visitor_id) as article_uv,
      sum(case when created_at >= ? then 1 else 0 end) as article_today_pv,
      count(distinct case when created_at >= ? then visitor_id end) as article_today_uv
    from article_view_events
    where article_id = ?
  `).bind(todayIso, todayIso, normalizedId).first();
  return json({
    article: {
      ...article,
      tags: parseTags(article.tags),
      translations: translationMap,
      article_pv: Number(metrics?.article_pv || 0),
      article_uv: Number(metrics?.article_uv || 0),
      article_today_pv: Number(metrics?.article_today_pv || 0),
      article_today_uv: Number(metrics?.article_today_uv || 0)
    }
  });
}

async function getVideos(request, env) {
  const url = new URL(request.url);
  const lang = normalizeArticleLang(url.searchParams.get("lang"));
  const categories = await publicVideoCategories(env, lang);
  const rows = (await env.DB.prepare(`
    select *
    from videos
    where status = 'published'
    order by
      pinned desc,
      case when pinned = 1 then pinned_sort_order else sort_order end desc,
      case when pinned = 1 then sort_order else 0 end desc,
      coalesce(published_at, created_at) desc,
      created_at desc
    limit 80
  `).all()).results || [];
  const videoIds = rows.map((row) => row.video_id);
  const relations = await videoRelations(env, videoIds);
  return json({
    lang,
    categories,
    videos: rows.map((row) => publicVideoRow(row, relations.get(row.video_id) || []))
  });
}

async function getVideo(request, env, videoId) {
  const normalizedId = normalizeRecordId(videoId, "Video id is invalid.");
  const row = await env.DB.prepare("select * from videos where video_id = ? and status = 'published'")
    .bind(normalizedId).first();
  if (!row) {
    return json({ error: "Video not found." }, 404);
  }
  const relations = await videoRelations(env, [row.video_id]);
  return json({ video: publicVideoRow(row, relations.get(row.video_id) || []) });
}

async function getAdminVideos(request, env) {
  await requireAdmin(request, env);
  const rows = (await env.DB.prepare(`
    select *
    from videos
    order by
      pinned desc,
      case when pinned = 1 then pinned_sort_order else sort_order end desc,
      case when pinned = 1 then sort_order else 0 end desc,
      updated_at desc,
      created_at desc
    limit 200
  `).all()).results || [];
  const relations = await videoRelations(env, rows.map((row) => row.video_id));
  return json({ videos: rows.map((row) => adminVideoRow(row, relations.get(row.video_id) || [])) });
}

async function nextVideoSortOrder(env) {
  const row = await env.DB.prepare("select coalesce(max(sort_order), 0) as max_sort from videos").first();
  return Number(row?.max_sort || 0) + 10;
}

async function nextPinnedVideoSortOrder(env) {
  const row = await env.DB.prepare("select coalesce(max(pinned_sort_order), 0) as max_sort from videos where pinned = 1").first();
  return Number(row?.max_sort || 0) + 10;
}

async function assertVideoNotDuplicate(env, video, excludeVideoId = "") {
  const row = await env.DB.prepare(`
    select video_id, title
    from videos
    where platform = ? and external_id = ? and video_id <> ?
    limit 1
  `).bind(video.platform, video.external_id, excludeVideoId || "").first();
  if (row) {
    throw new HttpError(`这个视频已经存在：${row.title || row.video_id}`, 409);
  }
}

async function createVideo(request, env) {
  await requireAdmin(request, env);
  const body = await readJson(request);
  const video = await normalizeVideoPayload(body, env, {
    defaultSortOrder: await nextVideoSortOrder(env),
    defaultPinnedSortOrder: await nextPinnedVideoSortOrder(env)
  });
  await assertVideoNotDuplicate(env, video);
  const now = nowIso();
  const videoId = crypto.randomUUID();
  await env.DB.batch([
    env.DB.prepare(`
      insert into videos (
        video_id, platform, original_url, external_id, embed_url, title, description,
        thumbnail_url, author_name, published_at, status, sort_order, pinned, pinned_sort_order,
        metadata_error, created_at, updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      videoId, video.platform, video.original_url, video.external_id, video.embed_url,
      video.title, video.description, video.thumbnail_url, video.author_name,
      video.published_at, video.status, video.sort_order, video.pinned,
      video.pinned_sort_order, video.metadata_error, now, now
    ),
    ...videoCategoryRelationStatements(env, videoId, video.category_ids)
  ]);
  return json({ ok: true, videoId }, 201);
}

async function updateVideo(request, env, videoId) {
  await requireAdmin(request, env);
  const normalizedId = normalizeRecordId(videoId, "Video id is invalid.");
  const existing = await env.DB.prepare("select * from videos where video_id = ?").bind(normalizedId).first();
  if (!existing) {
    return json({ error: "Video not found." }, 404);
  }
  const body = await readJson(request);
  const video = await normalizeVideoPayload(body, env, { existing });
  await assertVideoNotDuplicate(env, video, normalizedId);
  await env.DB.batch([
    env.DB.prepare(`
      update videos
      set platform = ?, original_url = ?, external_id = ?, embed_url = ?,
          title = ?, description = ?, thumbnail_url = ?, author_name = ?,
          published_at = ?, status = ?, sort_order = ?, pinned = ?, pinned_sort_order = ?,
          metadata_error = ?, updated_at = ?
      where video_id = ?
    `).bind(
      video.platform, video.original_url, video.external_id, video.embed_url,
      video.title, video.description, video.thumbnail_url, video.author_name,
      video.published_at, video.status, video.sort_order, video.pinned,
      video.pinned_sort_order, video.metadata_error, nowIso(), normalizedId
    ),
    env.DB.prepare("delete from video_category_relations where video_id = ?").bind(normalizedId),
    ...videoCategoryRelationStatements(env, normalizedId, video.category_ids)
  ]);
  return json({ ok: true, videoId: normalizedId });
}

async function deleteVideo(request, env, videoId) {
  await requireAdmin(request, env);
  const normalizedId = normalizeRecordId(videoId, "Video id is invalid.");
  const result = await env.DB.prepare("delete from videos where video_id = ?").bind(normalizedId).run();
  if (!result.meta?.changes) {
    return json({ error: "Video not found." }, 404);
  }
  return json({ ok: true });
}

async function previewVideoUrl(request, env) {
  await requireAdmin(request, env);
  const body = await readJson(request);
  const parsed = await metadataForVideoUrl(body.url || body.original_url || "");
  return json({ video: parsed });
}

async function refreshVideoMetadata(request, env, videoId) {
  await requireAdmin(request, env);
  const normalizedId = normalizeRecordId(videoId, "Video id is invalid.");
  const existing = await env.DB.prepare("select * from videos where video_id = ?").bind(normalizedId).first();
  if (!existing) {
    return json({ error: "Video not found." }, 404);
  }
  const metadata = await metadataForVideoUrl(existing.original_url);
  const title = metadata.title || existing.title;
  const description = metadata.description || existing.description;
  const thumbnail = metadata.thumbnail_url || existing.thumbnail_url;
  const author = metadata.author_name || existing.author_name;
  await env.DB.prepare(`
    update videos
    set platform = ?, external_id = ?, embed_url = ?, title = ?, description = ?,
        thumbnail_url = ?, author_name = ?, published_at = coalesce(?, published_at),
        metadata_error = ?, updated_at = ?
    where video_id = ?
  `).bind(
    metadata.platform, metadata.external_id, metadata.embed_url, title, description,
    thumbnail, author, metadata.published_at || null, metadata.metadata_error || "",
    nowIso(), normalizedId
  ).run();
  return json({ ok: true, video: { ...metadata, title, description, thumbnail_url: thumbnail, author_name: author } });
}

async function getAdminVideoCategories(request, env) {
  await requireAdmin(request, env);
  const rows = (await env.DB.prepare(`
    select video_categories.*,
      count(video_category_relations.video_id) as video_count
    from video_categories
    left join video_category_relations on video_category_relations.category_id = video_categories.category_id
    group by video_categories.category_id
    order by video_categories.sort_order desc, video_categories.created_at desc
  `).all()).results || [];
  return json({ categories: rows.map((row) => ({ ...row, video_count: Number(row.video_count || 0) })) });
}

async function nextVideoCategorySortOrder(env) {
  const row = await env.DB.prepare("select coalesce(max(sort_order), 0) as max_sort from video_categories").first();
  return Number(row?.max_sort || 0) + 10;
}

async function createVideoCategory(request, env) {
  await requireAdmin(request, env);
  const body = await readJson(request);
  const category = normalizeVideoCategoryPayload(body, { defaultSortOrder: await nextVideoCategorySortOrder(env) });
  const now = nowIso();
  const categoryId = crypto.randomUUID();
  await env.DB.prepare(`
    insert into video_categories (
      category_id, slug, name_zh, name_en, name_ja, sort_order, enabled, created_at, updated_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    categoryId, category.slug, category.name_zh, category.name_en, category.name_ja,
    category.sort_order, category.enabled, now, now
  ).run();
  return json({ ok: true, categoryId }, 201);
}

async function updateVideoCategory(request, env, categoryId) {
  await requireAdmin(request, env);
  const normalizedId = normalizeRecordId(categoryId, "Category id is invalid.");
  const existing = await env.DB.prepare("select category_id, sort_order from video_categories where category_id = ?")
    .bind(normalizedId).first();
  if (!existing) {
    return json({ error: "Category not found." }, 404);
  }
  const category = normalizeVideoCategoryPayload(await readJson(request), { defaultSortOrder: existing.sort_order });
  await env.DB.prepare(`
    update video_categories
    set slug = ?, name_zh = ?, name_en = ?, name_ja = ?, sort_order = ?, enabled = ?, updated_at = ?
    where category_id = ?
  `).bind(
    category.slug, category.name_zh, category.name_en, category.name_ja,
    category.sort_order, category.enabled, nowIso(), normalizedId
  ).run();
  return json({ ok: true, categoryId: normalizedId });
}

async function deleteVideoCategory(request, env, categoryId) {
  await requireAdmin(request, env);
  const normalizedId = normalizeRecordId(categoryId, "Category id is invalid.");
  const usage = await env.DB.prepare("select count(*) as count from video_category_relations where category_id = ?")
    .bind(normalizedId).first();
  if (Number(usage?.count || 0) > 0) {
    return json({ error: "这个分类已有视频使用，请先移动或取消关联后再删除。", videoCount: Number(usage.count) }, 409);
  }
  const result = await env.DB.prepare("delete from video_categories where category_id = ?").bind(normalizedId).run();
  if (!result.meta?.changes) {
    return json({ error: "Category not found." }, 404);
  }
  return json({ ok: true });
}

async function adminMe(request, env) {
  const session = await requireAdmin(request, env);
  return json({ user: session.user });
}

async function getAdminAccounts(request, env) {
  await requireAdmin(request, env);
  const now = nowIso();
  const rows = (await env.DB.prepare(`
    select
      users.id,
      users.email,
      users.password_hash,
      users.role,
      users.created_at,
      users.updated_at,
      (select count(*) from sessions where sessions.user_id = users.id and sessions.expires_at > ?) as active_sessions,
      (select max(created_at) from sessions where sessions.user_id = users.id) as last_session_at,
      (select max(created_at) from user_login_events where user_login_events.user_id = users.id) as last_login_at,
      (select count(*) from user_login_events where user_login_events.user_id = users.id) as login_count,
      (select count(*) from game_saves where game_saves.user_id = users.id) as save_slots
    from users
    order by case when users.role = 'admin' then 0 else 1 end, users.updated_at desc
    limit 500
  `).bind(now).all()).results || [];
  return json({ accounts: rows.map(adminAccountRow) });
}

async function getAdminAccount(request, env, userId) {
  await requireAdmin(request, env);
  const normalizedId = normalizeRecordId(userId, "账号编号不正确。");
  const account = await env.DB.prepare(`
    select id, email, password_hash, role, created_at, updated_at
    from users
    where id = ?
  `).bind(normalizedId).first();
  if (!account) {
    return json({ error: "账号不存在。" }, 404);
  }

  const accountVisitorId = await stableAccountVisitorId(account.id);
  const now = nowIso();
  const [loginHistory, sessions, activity] = await Promise.all([
    env.DB.prepare(`
      select event_type, created_at, ip_prefix, country, region, city, timezone, colo, user_agent, visitor_id
      from user_login_events
      where user_id = ?
      order by created_at desc
      limit 80
    `).bind(account.id).all(),
    env.DB.prepare(`
      select created_at, expires_at,
             case when expires_at > ? then 1 else 0 end as active
      from sessions
      where user_id = ?
      order by created_at desc
      limit 30
    `).bind(now, account.id).all(),
    env.DB.prepare(`
      select * from (
        select 'page_view' as type, created_at, path, route, title as detail,
               country, region, city, ip_prefix
        from analytics_page_views
        where visitor_id = ?
        union all
        select 'click' as type, created_at, path, data_route as route,
               coalesce(nullif(target_text, ''), nullif(target_key, ''), tag_name) as detail,
               country, region, city, '' as ip_prefix
        from analytics_click_events
        where visitor_id = ?
        union all
        select 'article_view' as type, created_at, slug as path, lang as route, slug as detail,
               country, region, city, ip_prefix
        from article_view_events
        where visitor_id = ?
      )
      order by created_at desc
      limit 80
    `).bind(accountVisitorId, accountVisitorId, accountVisitorId).all()
  ]);

  return json({
    account: adminAccountRow(account),
    loginHistory: (loginHistory.results || []).map(adminLoginEventRow),
    sessions: (sessions.results || []).map((row) => ({
      created_at: row.created_at,
      expires_at: row.expires_at,
      active: Boolean(row.active)
    })),
    activity: (activity.results || []).map(adminAccountActivityRow)
  });
}

async function updateAdminAccount(request, env, userId) {
  const adminSession = await requireAdmin(request, env);
  const normalizedId = normalizeRecordId(userId, "账号编号不正确。");
  const body = await readJson(request);
  const existing = await env.DB.prepare("select id, email, role from users where id = ?")
    .bind(normalizedId).first();
  if (!existing) {
    return json({ error: "账号不存在。" }, 404);
  }

  const nextEmail = body.email === undefined ? normalizeEmail(existing.email) : normalizeEmail(body.email);
  validateEmail(nextEmail);
  const nextRole = normalizeAccountRole(body.role === undefined ? existing.role : body.role);
  const password = String(body.password || body.newPassword || "");
  const passwordChanged = password.trim().length > 0;

  if (OWNER_ADMIN_EMAILS.has(nextEmail) && nextRole !== "admin") {
    throw new HttpError("站长账号必须保留管理员权限。", 400);
  }
  if (existing.id === adminSession.user.id && nextRole !== "admin") {
    throw new HttpError("不能把当前登录账号降级，否则会立刻失去后台权限。", 400);
  }
  if (nextEmail !== normalizeEmail(existing.email)) {
    const conflict = await env.DB.prepare("select id from users where email = ? and id <> ?")
      .bind(nextEmail, existing.id).first();
    if (conflict) {
      throw new HttpError("这个邮箱已经被其他账号使用。", 409);
    }
  }
  if (passwordChanged) {
    validatePassword(password);
  }

  const fields = ["email = ?", "role = ?", "updated_at = ?"];
  const binds = [nextEmail, nextRole, nowIso()];
  if (passwordChanged) {
    fields.splice(2, 0, "password_hash = ?");
    binds.splice(2, 0, await hashPassword(password));
  }
  binds.push(existing.id);
  await env.DB.prepare(`update users set ${fields.join(", ")} where id = ?`).bind(...binds).run();

  if (passwordChanged) {
    if (existing.id === adminSession.user.id) {
      await env.DB.prepare("delete from sessions where user_id = ? and token_hash <> ?")
        .bind(existing.id, adminSession.tokenHash).run();
    } else {
      await env.DB.prepare("delete from sessions where user_id = ?").bind(existing.id).run();
    }
  }

  return await getAdminAccount(request, env, existing.id);
}

async function identifyVisitor(request, env) {
  const body = await readOptionalJson(request);
  const identity = await analyticsIdentityForRequest(request, env);
  await ensureVisitorProfile(env, request, identity.visitorId, body || {}, false);
  return withVisitorCookie(json({ ok: true }), request, identity.cookieIdentity);
}

async function recordPageView(request, env) {
  const body = await readOptionalJson(request);
  const identity = await analyticsIdentityForRequest(request, env);
  const now = nowIso();
  const geo = await requestIpInfo(request, env, "analytics");
  await ensureVisitorProfile(env, request, identity.visitorId, body || {}, true);
  await env.DB.prepare(`
    insert into analytics_page_views (
      event_id, visitor_id, path, route, referrer, title, lang,
      screen_width, screen_height, country, region, city, timezone,
      colo, latitude, longitude, ip_hash, ip_prefix, created_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    crypto.randomUUID(),
    identity.visitorId,
    normalizeAnalyticsPath(body?.path),
    normalizeAnalyticsText(body?.route, 80),
    normalizeAnalyticsText(body?.referrer, 500),
    normalizeAnalyticsText(body?.title, 200),
    normalizeArticleLang(body?.lang),
    normalizeInteger(body?.screenWidth, 0, 20000),
    normalizeInteger(body?.screenHeight, 0, 20000),
    geo.country,
    geo.region,
    geo.city,
    geo.timezone,
    geo.colo,
    geo.latitude,
    geo.longitude,
    geo.ipHash,
    geo.ipPrefix,
    now
  ).run();
  return withVisitorCookie(json({ ok: true }), request, identity.cookieIdentity);
}

async function recordClickEvent(request, env) {
  const body = await readOptionalJson(request);
  const identity = await analyticsIdentityForRequest(request, env);
  const now = nowIso();
  const geo = await requestIpInfo(request, env, "analytics");
  await ensureVisitorProfile(env, request, identity.visitorId, body || {}, false);
  await env.DB.prepare(`
    insert into analytics_click_events (
      event_id, visitor_id, path, route, target_key, target_text, tag_name,
      element_id, element_classes, href, data_route, screen_width, screen_height,
      click_x, click_y, country, region, city, timezone, colo, ip_hash, ip_prefix, created_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    crypto.randomUUID(),
    identity.visitorId,
    normalizeAnalyticsPath(body?.path),
    normalizeAnalyticsText(body?.route, 80),
    normalizeAnalyticsText(body?.targetKey, 160),
    normalizeAnalyticsText(body?.targetText, 160),
    normalizeAnalyticsText(body?.tagName, 40).toUpperCase(),
    normalizeAnalyticsText(body?.elementId, 120),
    normalizeAnalyticsText(body?.elementClasses, 240),
    normalizeAnalyticsText(body?.href, 500),
    normalizeAnalyticsText(body?.dataRoute, 80),
    normalizeInteger(body?.screenWidth, 0, 20000),
    normalizeInteger(body?.screenHeight, 0, 20000),
    normalizeInteger(body?.x, -100000, 100000),
    normalizeInteger(body?.y, -100000, 100000),
    geo.country,
    geo.region,
    geo.city,
    geo.timezone,
    geo.colo,
    geo.ipHash,
    geo.ipPrefix,
    now
  ).run();
  return withVisitorCookie(json({ ok: true }), request, identity.cookieIdentity);
}

async function recordArticleView(request, env, article, lang) {
  await ensureAnalyticsSchema(env);
  const identity = await analyticsIdentityForRequest(request, env);
  const now = nowIso();
  const geo = await requestIpInfo(request, env, "analytics");
  await ensureVisitorProfile(env, request, identity.visitorId, {
    language: request.headers.get("Accept-Language") || ""
  }, false);
  await env.DB.prepare(`
    insert into article_view_events (
      event_id, article_id, slug, lang, visitor_id, country, region, city,
      timezone, colo, latitude, longitude, ip_hash, ip_prefix, created_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    crypto.randomUUID(),
    article.article_id,
    article.slug,
    normalizeArticleLang(lang),
    identity.visitorId,
    geo.country,
    geo.region,
    geo.city,
    geo.timezone,
    geo.colo,
    geo.latitude,
    geo.longitude,
    geo.ipHash,
    geo.ipPrefix,
    now
  ).run();
  return identity;
}

async function getAdminAnalyticsOverview(request, env) {
  await requireAdmin(request, env);
  const url = new URL(request.url);
  const days = Math.min(Math.max(Number(url.searchParams.get("days") || 14), 1), 90);
  const now = new Date();
  const since = new Date(now.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
  since.setUTCHours(0, 0, 0, 0);
  const sinceIso = since.toISOString();
  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);
  const todayIso = today.toISOString();
  const onlineSince = new Date(now.getTime() - 5 * 60 * 1000).toISOString();

  const [
    todayPageViews,
    todayVisitors,
    totalPageViews,
    totalVisitors,
    todayClicks,
    onlineVisitors,
    todayMessages,
    dailyRows,
    hourlyRows,
    countryRows,
    regionRows,
    topPages,
    topArticles,
    topClicks,
    recentViews,
    recentClicks
  ] = await Promise.all([
    env.DB.prepare("select count(*) as count from analytics_page_views where created_at >= ?").bind(todayIso).first(),
    env.DB.prepare("select count(distinct visitor_id) as count from analytics_page_views where created_at >= ?").bind(todayIso).first(),
    env.DB.prepare("select count(*) as count from analytics_page_views where created_at >= ?").bind(sinceIso).first(),
    env.DB.prepare("select count(distinct visitor_id) as count from analytics_page_views where created_at >= ?").bind(sinceIso).first(),
    env.DB.prepare("select count(*) as count from analytics_click_events where created_at >= ?").bind(todayIso).first(),
    env.DB.prepare("select count(*) as count from site_visitors where last_seen_at >= ?").bind(onlineSince).first(),
    env.DB.prepare("select count(*) as count from anonymous_chat_messages where created_at >= ?").bind(todayIso).first(),
    env.DB.prepare(`
      select substr(created_at, 1, 10) as day, count(*) as pv, count(distinct visitor_id) as uv
      from analytics_page_views
      where created_at >= ?
      group by day
      order by day asc
    `).bind(sinceIso).all(),
    env.DB.prepare(`
      select substr(created_at, 1, 13) || ':00' as hour, count(*) as pv, count(distinct visitor_id) as uv
      from analytics_page_views
      where created_at >= ?
      group by hour
      order by hour asc
    `).bind(todayIso).all(),
    env.DB.prepare(`
      select country, count(*) as pv, count(distinct visitor_id) as uv,
             max(created_at) as last_seen_at, avg(latitude) as latitude, avg(longitude) as longitude
      from analytics_page_views
      where created_at >= ?
      group by country
      order by pv desc
      limit 80
    `).bind(sinceIso).all(),
    env.DB.prepare(`
      select country, region, city, ip_prefix, count(*) as pv, count(distinct visitor_id) as uv,
             max(created_at) as last_seen_at, avg(latitude) as latitude, avg(longitude) as longitude
      from analytics_page_views
      where created_at >= ?
      group by country, region, city, ip_prefix
      order by pv desc, uv desc
      limit 200
    `).bind(sinceIso).all(),
    env.DB.prepare(`
      select path, route, count(*) as pv, count(distinct visitor_id) as uv, max(created_at) as last_seen_at
      from analytics_page_views
      where created_at >= ?
      group by path, route
      order by pv desc, uv desc
      limit 30
    `).bind(sinceIso).all(),
    env.DB.prepare(`
      select
        article_view_events.article_id,
        article_view_events.slug,
        articles.category,
        coalesce(zh.title, article_view_events.slug) as title,
        count(*) as pv,
        count(distinct article_view_events.visitor_id) as uv,
        max(article_view_events.created_at) as last_seen_at
      from article_view_events
      left join articles on articles.article_id = article_view_events.article_id
      left join article_translations zh
        on zh.article_id = article_view_events.article_id and zh.lang = 'zh'
      where article_view_events.created_at >= ?
      group by article_view_events.article_id, article_view_events.slug, articles.category, zh.title
      order by pv desc, uv desc
      limit 30
    `).bind(sinceIso).all(),
    env.DB.prepare(`
      select target_key, target_text, tag_name, data_route, path, count(*) as clicks, count(distinct visitor_id) as uv,
             max(created_at) as last_seen_at
      from analytics_click_events
      where created_at >= ?
      group by target_key, target_text, tag_name, data_route, path
      order by clicks desc, uv desc
      limit 40
    `).bind(sinceIso).all(),
    env.DB.prepare(`
      select created_at, visitor_id, path, route, country, region, city, ip_prefix
      from analytics_page_views
      order by created_at desc
      limit 30
    `).all(),
    env.DB.prepare(`
      select created_at, visitor_id, path, target_text, target_key, tag_name, data_route, country, region, city
      from analytics_click_events
      order by created_at desc
      limit 30
    `).all()
  ]);

  return json({
    generatedAt: now.toISOString(),
    windowDays: days,
    cards: {
      todayPv: Number(todayPageViews?.count || 0),
      todayUv: Number(todayVisitors?.count || 0),
      totalPv: Number(totalPageViews?.count || 0),
      totalUv: Number(totalVisitors?.count || 0),
      todayClicks: Number(todayClicks?.count || 0),
      onlineVisitors: Number(onlineVisitors?.count || 0),
      todayMessages: Number(todayMessages?.count || 0)
    },
    daily: fillDailySeries((dailyRows.results || []), since, days),
    hourly: hourlyRows.results || [],
    countries: countryRows.results || [],
    regions: regionRows.results || [],
    topPages: topPages.results || [],
    topArticles: topArticles.results || [],
    topClicks: topClicks.results || [],
    recentViews: recentViews.results || [],
    recentClicks: recentClicks.results || []
  });
}

async function getAdminChatMessages(request, env) {
  await requireAdmin(request, env);
  await ensureAnalyticsSchema(env);
  const url = new URL(request.url);
  const limit = clampLimit(url.searchParams.get("limit"), 100);
  const includeHidden = url.searchParams.get("includeHidden") === "1";
  const where = includeHidden ? "" : "where anonymous_chat_messages.hidden = 0";
  const rows = (await env.DB.prepare(`
    select
      anonymous_chat_messages.message_id,
      anonymous_chat_messages.visitor_id,
      anonymous_chat_messages.client_id,
      anonymous_chat_messages.nickname,
      anonymous_chat_messages.content,
      anonymous_chat_messages.created_at,
      anonymous_chat_messages.edited_at,
      anonymous_chat_messages.hidden,
      anonymous_chat_messages.ip_hash,
      anonymous_chat_messages.ip_prefix,
      site_visitors.country,
      site_visitors.region,
      site_visitors.city,
      site_visitors.last_seen_at
    from anonymous_chat_messages
    left join site_visitors on site_visitors.visitor_id = anonymous_chat_messages.visitor_id
    ${where}
    order by anonymous_chat_messages.created_at desc, anonymous_chat_messages.message_id desc
    limit ?
  `).bind(limit).all()).results || [];
  return json({ messages: rows });
}

async function updateAdminChatMessage(request, env, messageId) {
  await requireAdmin(request, env);
  const body = await readJson(request);
  const normalizedId = normalizeRecordId(messageId, "消息编号不正确。");
  const existing = await env.DB.prepare("select message_id from anonymous_chat_messages where message_id = ?")
    .bind(normalizedId).first();
  if (!existing) {
    return json({ error: "消息不存在。" }, 404);
  }
  const nickname = body.nickname === undefined ? undefined : normalizeChatNickname(body.nickname);
  const content = body.content === undefined ? undefined : normalizeChatContent(body.content);
  const hidden = body.hidden === undefined ? undefined : (body.hidden ? 1 : 0);
  await env.DB.prepare(`
    update anonymous_chat_messages
    set nickname = coalesce(?, nickname),
        content = coalesce(?, content),
        hidden = coalesce(?, hidden),
        edited_at = ?
    where message_id = ?
  `).bind(nickname ?? null, content ?? null, hidden ?? null, nowIso(), normalizedId).run();
  return json({ ok: true });
}

async function deleteAdminChatMessage(request, env, messageId) {
  await requireAdmin(request, env);
  const normalizedId = normalizeRecordId(messageId, "消息编号不正确。");
  const result = await env.DB.prepare("delete from anonymous_chat_messages where message_id = ?")
    .bind(normalizedId).run();
  if (!result.meta?.changes) {
    return json({ error: "消息不存在。" }, 404);
  }
  return json({ ok: true });
}

async function getAdminChatBans(request, env) {
  await requireAdmin(request, env);
  const rows = (await env.DB.prepare(`
    select chat_bans.*, users.email as created_by_email
    from chat_bans
    left join users on users.id = chat_bans.created_by
    order by chat_bans.created_at desc
    limit 100
  `).all()).results || [];
  return json({ bans: rows });
}

async function createAdminChatBan(request, env) {
  const session = await requireAdmin(request, env);
  const body = await readJson(request);
  const banType = String(body.type || body.ban_type || "").trim();
  if (!["visitor", "ip_hash"].includes(banType)) {
    return json({ error: "禁言类型只能是 visitor 或 ip_hash。" }, 400);
  }
  const visitorId = banType === "visitor" ? normalizeRecordId(body.visitorId || body.visitor_id, "访客 ID 不正确。") : "";
  const ipHash = banType === "ip_hash" ? normalizeIpHash(body.ipHash || body.ip_hash) : "";
  const ipPrefix = normalizeAnalyticsText(body.ipPrefix || body.ip_prefix, 80);
  const reason = normalizeAnalyticsText(body.reason, 200) || "后台禁言";
  const durationHours = Number(body.durationHours || body.duration_hours || 0);
  const expiresAt = Number.isFinite(durationHours) && durationHours > 0
    ? new Date(Date.now() + Math.min(durationHours, 24 * 365) * 60 * 60 * 1000).toISOString()
    : null;

  const banId = crypto.randomUUID();
  await env.DB.prepare(`
    insert into chat_bans (
      ban_id, ban_type, visitor_id, ip_hash, ip_prefix, reason,
      active, created_by, created_at, expires_at
    ) values (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
  `).bind(banId, banType, visitorId, ipHash, ipPrefix, reason, session.user.id, nowIso(), expiresAt).run();
  return json({ ok: true, banId });
}

async function disableAdminChatBan(request, env, banId) {
  await requireAdmin(request, env);
  const normalizedId = normalizeRecordId(banId, "禁言编号不正确。");
  const result = await env.DB.prepare("update chat_bans set active = 0 where ban_id = ?")
    .bind(normalizedId).run();
  if (!result.meta?.changes) {
    return json({ error: "禁言记录不存在。" }, 404);
  }
  return json({ ok: true });
}

async function activeChatBan(env, visitorId, ipHash) {
  return env.DB.prepare(`
    select ban_id, ban_type, reason, expires_at
    from chat_bans
    where active = 1
      and (expires_at is null or expires_at > ?)
      and (
        (visitor_id <> '' and visitor_id = ?)
        or (ip_hash <> '' and ip_hash = ?)
      )
    order by created_at desc
    limit 1
  `).bind(nowIso(), visitorId, ipHash).first();
}

async function recentChatNicknames(env) {
  const rows = (await env.DB.prepare(`
    select distinct nickname
    from (
      select nickname
      from anonymous_chat_messages
      where hidden = 0
      order by created_at desc, message_id desc
      limit ?
    )
  `).bind(CHAT_NICKNAME_LOOKBACK_LIMIT).all()).results || [];
  return new Set(rows.map((row) => String(row.nickname || "").trim()).filter(Boolean));
}

function randomAvailableChatNickname(used) {
  const names = [
    "蓝屏小企鹅", "像素幽灵", "草地路人A", "CRT访客", "电视小粉", "泡泡旅人",
    "BluePenguin", "PixelGhost", "CRTGuest", "GrassWalker",
    "ピクセル幽霊", "CRT旅人", "草原の人"
  ];
  const suffixes = ["9527", "1024", "2333", "404", "88", "7"];
  const candidates = names.flatMap((name) => suffixes.map((suffix) => `${name}${suffix}`));
  for (let index = candidates.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [candidates[index], candidates[swapIndex]] = [candidates[swapIndex], candidates[index]];
  }
  const available = candidates.find((candidate) => !used.has(candidate) && isValidChatNicknameLength(candidate));
  if (available) {
    return available;
  }
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const fallback = `访客${Math.floor(100000 + Math.random() * 900000)}`;
    if (!used.has(fallback) && isValidChatNicknameLength(fallback)) {
      return fallback;
    }
  }
  return `访客${Date.now().toString(36).slice(-6)}`;
}

async function ensureChatSchema(env) {
  if (chatSchemaReady) {
    return;
  }
  await env.DB.batch([
    env.DB.prepare(`
      create table if not exists anonymous_chat_messages (
        message_id text primary key,
        visitor_id text not null,
        client_id text not null default '',
        nickname text not null,
        content text not null,
        created_at text not null,
        edited_at text,
        hidden integer not null default 0,
        ip_hash text not null,
        ip_prefix text not null default ''
      )
    `),
    env.DB.prepare(`
      create table if not exists chat_bans (
        ban_id text primary key,
        ban_type text not null,
        visitor_id text not null default '',
        ip_hash text not null default '',
        ip_prefix text not null default '',
        reason text not null default '',
        active integer not null default 1,
        created_by text not null,
        created_at text not null,
        expires_at text
      )
    `),
    env.DB.prepare(`
      create index if not exists anonymous_chat_messages_visible_idx
        on anonymous_chat_messages(hidden, created_at, message_id)
    `),
    env.DB.prepare(`
      create index if not exists anonymous_chat_messages_visitor_idx
        on anonymous_chat_messages(visitor_id, created_at)
    `),
    env.DB.prepare(`
      create index if not exists anonymous_chat_messages_ip_idx
        on anonymous_chat_messages(ip_hash, created_at)
    `),
    env.DB.prepare("create index if not exists chat_bans_active_visitor_idx on chat_bans(active, visitor_id, expires_at)"),
    env.DB.prepare("create index if not exists chat_bans_active_ip_idx on chat_bans(active, ip_hash, expires_at)")
  ]);
  await ensureTableColumns(env, "anonymous_chat_messages", [
    ["client_id", "text not null default ''"],
    ["edited_at", "text"],
    ["ip_prefix", "text not null default ''"]
  ]);
  await env.DB.prepare("create index if not exists anonymous_chat_messages_client_idx on anonymous_chat_messages(client_id, created_at)").run();
  chatSchemaReady = true;
}

async function ensureArticleSchema(env) {
  if (articleSchemaReady) {
    return;
  }
  await env.DB.batch([
    env.DB.prepare(`
      create table if not exists articles (
        article_id text primary key,
        slug text not null unique,
        category text not null default 'note',
        tags text not null default '[]',
        cover_image text not null default '',
        status text not null default 'draft',
        is_pinned integer not null default 0,
        view_count integer not null default 0,
        created_at text not null,
        updated_at text not null,
        published_at text
      )
    `),
    env.DB.prepare(`
      create table if not exists article_translations (
        translation_id text primary key,
        article_id text not null references articles(article_id) on delete cascade,
        lang text not null,
        title text not null,
        summary text not null default '',
        content_markdown text not null default '',
        created_at text not null,
        updated_at text not null,
        unique(article_id, lang)
      )
    `),
    env.DB.prepare("create index if not exists articles_status_published_idx on articles(status, published_at, article_id)"),
    env.DB.prepare("create index if not exists articles_category_idx on articles(category)"),
    env.DB.prepare("create index if not exists article_translations_article_lang_idx on article_translations(article_id, lang)"),
    ...articleSeedStatements(env)
  ]);
  articleSchemaReady = true;
}

async function ensureVideoSchema(env) {
  if (videoSchemaReady) {
    return;
  }
  const hadVideoCategoriesTable = await tableExists(env, "video_categories");
  await env.DB.batch([
    env.DB.prepare(`
      create table if not exists site_runtime_state (
        key text primary key,
        value text not null,
        updated_at text not null
      )
    `),
    env.DB.prepare(`
      create table if not exists videos (
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
      )
    `),
    env.DB.prepare(`
      create table if not exists video_categories (
        category_id text primary key,
        slug text not null unique,
        name_zh text not null,
        name_en text not null default '',
        name_ja text not null default '',
        sort_order integer not null default 0,
        enabled integer not null default 1,
        created_at text not null,
        updated_at text not null
      )
    `),
    env.DB.prepare(`
      create table if not exists video_category_relations (
        video_id text not null references videos(video_id) on delete cascade,
        category_id text not null references video_categories(category_id) on delete cascade,
        sort_order integer not null default 0,
        created_at text not null,
        primary key (video_id, category_id)
      )
    `)
  ]);
  const addedVideoColumns = await ensureTableColumns(env, "videos", [
    ["metadata_error", "text not null default ''"],
    ["pinned_sort_order", "integer not null default 0"]
  ]);
  if (addedVideoColumns.has("pinned_sort_order")) {
    await env.DB.prepare("update videos set pinned_sort_order = sort_order where pinned = 1").run();
  }
  await ensureTableColumns(env, "video_categories", [
    ["name_en", "text not null default ''"],
    ["name_ja", "text not null default ''"],
    ["sort_order", "integer not null default 0"],
    ["enabled", "integer not null default 1"],
    ["created_at", "text not null default ''"],
    ["updated_at", "text not null default ''"]
  ]);
  await ensureTableColumns(env, "video_category_relations", [
    ["sort_order", "integer not null default 0"],
    ["created_at", "text not null default ''"]
  ]);
  await env.DB.batch([
    env.DB.prepare("create index if not exists videos_public_idx on videos(status, pinned, sort_order, published_at)"),
    env.DB.prepare("create index if not exists videos_public_queue_idx on videos(status, pinned, pinned_sort_order, sort_order, published_at)"),
    env.DB.prepare("create index if not exists videos_platform_external_idx on videos(platform, external_id)"),
    env.DB.prepare("create index if not exists video_categories_enabled_idx on video_categories(enabled, sort_order)"),
    env.DB.prepare("create index if not exists video_category_relations_category_idx on video_category_relations(category_id, sort_order)")
  ]);
  await seedDefaultVideoCategories(env, { hadVideoCategoriesTable });
  videoSchemaReady = true;
}

async function ensureAnalyticsSchema(env) {
  if (analyticsSchemaReady) {
    return;
  }
  await env.DB.batch([
    env.DB.prepare(`
      create table if not exists site_visitors (
        visitor_id text primary key,
        first_seen_at text not null,
        last_seen_at text not null,
        visit_count integer not null default 0,
        ip_hash text not null default '',
        ip_prefix text not null default '',
        country text not null default '',
        region text not null default '',
        city text not null default '',
        timezone text not null default '',
        colo text not null default '',
        latitude real,
        longitude real,
        user_agent text not null default '',
        language text not null default ''
      )
    `),
    env.DB.prepare(`
      create table if not exists analytics_page_views (
        event_id text primary key,
        visitor_id text not null,
        path text not null,
        route text not null default '',
        referrer text not null default '',
        title text not null default '',
        lang text not null default 'zh',
        screen_width integer not null default 0,
        screen_height integer not null default 0,
        country text not null default '',
        region text not null default '',
        city text not null default '',
        timezone text not null default '',
        colo text not null default '',
        latitude real,
        longitude real,
        ip_hash text not null default '',
        ip_prefix text not null default '',
        created_at text not null
      )
    `),
    env.DB.prepare(`
      create table if not exists analytics_click_events (
        event_id text primary key,
        visitor_id text not null,
        path text not null,
        route text not null default '',
        target_key text not null default '',
        target_text text not null default '',
        tag_name text not null default '',
        element_id text not null default '',
        element_classes text not null default '',
        href text not null default '',
        data_route text not null default '',
        screen_width integer not null default 0,
        screen_height integer not null default 0,
        click_x integer not null default 0,
        click_y integer not null default 0,
        country text not null default '',
        region text not null default '',
        city text not null default '',
        timezone text not null default '',
        colo text not null default '',
        ip_hash text not null default '',
        ip_prefix text not null default '',
        created_at text not null
      )
    `),
    env.DB.prepare(`
      create table if not exists article_view_events (
        event_id text primary key,
        article_id text not null,
        slug text not null,
        lang text not null default 'zh',
        visitor_id text not null,
        country text not null default '',
        region text not null default '',
        city text not null default '',
        timezone text not null default '',
        colo text not null default '',
        latitude real,
        longitude real,
        ip_hash text not null default '',
        ip_prefix text not null default '',
        created_at text not null
      )
    `),
    env.DB.prepare("create index if not exists site_visitors_last_seen_idx on site_visitors(last_seen_at)"),
    env.DB.prepare("create index if not exists analytics_page_views_created_idx on analytics_page_views(created_at)"),
    env.DB.prepare("create index if not exists analytics_page_views_visitor_idx on analytics_page_views(visitor_id, created_at)"),
    env.DB.prepare("create index if not exists analytics_page_views_geo_idx on analytics_page_views(country, region, city, created_at)"),
    env.DB.prepare("create index if not exists analytics_click_events_created_idx on analytics_click_events(created_at)"),
    env.DB.prepare("create index if not exists analytics_click_events_target_idx on analytics_click_events(target_key, created_at)"),
    env.DB.prepare("create index if not exists analytics_click_events_visitor_idx on analytics_click_events(visitor_id, created_at)"),
    env.DB.prepare("create index if not exists article_view_events_article_idx on article_view_events(article_id, created_at)"),
    env.DB.prepare("create index if not exists article_view_events_slug_idx on article_view_events(slug, created_at)"),
    env.DB.prepare("create index if not exists article_view_events_visitor_idx on article_view_events(visitor_id, created_at)")
  ]);
  analyticsSchemaReady = true;
}

async function ensureCoreSchema(env) {
  if (coreSchemaReady) {
    return;
  }
  await env.DB.batch([
    env.DB.prepare(`
      create table if not exists users (
        id text primary key,
        email text not null unique,
        password_hash text not null,
        role text not null default 'user',
        created_at text not null,
        updated_at text not null
      )
    `),
    env.DB.prepare(`
      create table if not exists sessions (
        token_hash text primary key,
        user_id text not null references users(id) on delete cascade,
        created_at text not null,
        expires_at text not null
      )
    `),
    env.DB.prepare(`
      create table if not exists user_login_events (
        event_id text primary key,
        user_id text not null references users(id) on delete cascade,
        email text not null default '',
        event_type text not null default 'login',
        visitor_id text not null default '',
        ip_hash text not null default '',
        ip_prefix text not null default '',
        country text not null default '',
        region text not null default '',
        city text not null default '',
        timezone text not null default '',
        colo text not null default '',
        user_agent text not null default '',
        created_at text not null
      )
    `),
    env.DB.prepare("create index if not exists sessions_user_id_idx on sessions(user_id)"),
    env.DB.prepare("create index if not exists sessions_expires_at_idx on sessions(expires_at)"),
    env.DB.prepare("create index if not exists user_login_events_user_created_idx on user_login_events(user_id, created_at)"),
    env.DB.prepare("create index if not exists user_login_events_created_idx on user_login_events(created_at)"),
    env.DB.prepare("create index if not exists user_login_events_email_created_idx on user_login_events(email, created_at)"),
    env.DB.prepare(`
      create table if not exists game_saves (
        user_id text not null references users(id) on delete cascade,
        game_id text not null,
        save_data text not null,
        updated_at text not null,
        primary key (user_id, game_id)
      )
    `),
    env.DB.prepare("create index if not exists game_saves_updated_at_idx on game_saves(updated_at)")
  ]);
  await ensureUserRoleColumn(env);
  await ensureOwnerAdminRole(env);
  coreSchemaReady = true;
}

async function ensureUserRoleColumn(env) {
  const columns = (await env.DB.prepare("pragma table_info(users)").all()).results || [];
  if (!columns.some((column) => column.name === "role")) {
    await env.DB.prepare("alter table users add column role text not null default 'user'").run();
  }
}

async function ensureOwnerAdminRole(env) {
  for (const email of OWNER_ADMIN_EMAILS) {
    await env.DB.prepare("update users set role = 'admin', updated_at = ? where email = ?")
      .bind(nowIso(), email).run();
  }
}

async function ensureTableColumns(env, tableName, columns) {
  const existing = (await env.DB.prepare(`pragma table_info(${tableName})`).all()).results || [];
  const existingNames = new Set(existing.map((column) => column.name));
  const addedNames = new Set();
  for (const [name, definition] of columns) {
    if (!existingNames.has(name)) {
      await env.DB.prepare(`alter table ${tableName} add column ${name} ${definition}`).run();
      addedNames.add(name);
    }
  }
  return addedNames;
}

async function tableExists(env, tableName) {
  const row = await env.DB.prepare(
    "select name from sqlite_master where type = 'table' and name = ?"
  ).bind(tableName).first();
  return Boolean(row?.name);
}

async function seedDefaultVideoCategories(env, { hadVideoCategoriesTable }) {
  const flag = await env.DB.prepare("select value from site_runtime_state where key = ?")
    .bind(VIDEO_CATEGORY_SEED_FLAG).first();
  if (flag) {
    return;
  }

  const count = await env.DB.prepare("select count(*) as count from video_categories").first();
  if (!hadVideoCategoriesTable && Number(count?.count || 0) === 0) {
    await env.DB.batch(defaultVideoCategorySeedStatements(env));
  }

  await env.DB.prepare(`
    insert into site_runtime_state (key, value, updated_at)
    values (?, '1', ?)
    on conflict(key) do update set
      value = excluded.value,
      updated_at = excluded.updated_at
  `).bind(VIDEO_CATEGORY_SEED_FLAG, nowIso()).run();
}

function defaultVideoCategorySeedStatements(env) {
  const createdAt = "2026-06-15T00:00:00.000Z";
  return DEFAULT_VIDEO_CATEGORIES.map((category) => env.DB.prepare(`
    insert into video_categories (
      category_id, slug, name_zh, name_en, name_ja, sort_order, enabled, created_at, updated_at
    ) values (?, ?, ?, ?, ?, ?, 1, ?, ?)
    on conflict(category_id) do nothing
  `).bind(...category, createdAt, createdAt));
}

async function createSessionResponse(env, request, userId, email, status = 200, role = "user") {
  const token = randomToken();
  const tokenHash = await sha256Hex(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  await env.DB.prepare(
    "insert into sessions (token_hash, user_id, created_at, expires_at) values (?, ?, ?, ?)"
  ).bind(tokenHash, userId, now.toISOString(), expiresAt).run();

  const response = json({ user: { id: userId, email, role } }, status);
  response.headers.append("Set-Cookie", cookieValue(token, request, SESSION_DAYS * 24 * 60 * 60));
  return response;
}

async function requireSession(request, env) {
  const session = await getSession(request, env);
  if (!session) {
    throw new HttpError("请先登录。", 401);
  }
  return session;
}

async function requireAdmin(request, env) {
  const session = await requireSession(request, env);
  if (session.user.role !== "admin") {
    throw new HttpError("只有管理员可以访问后台。", 403);
  }
  return session;
}

async function getSession(request, env) {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) {
    return null;
  }

  const tokenHash = await sha256Hex(token);
  const row = await env.DB.prepare(`
    select sessions.token_hash, users.id, users.email, users.role
    from sessions
    join users on users.id = sessions.user_id
    where sessions.token_hash = ? and sessions.expires_at > ?
  `).bind(tokenHash, nowIso()).first();

  if (!row) {
    return null;
  }

  const email = normalizeEmail(row.email);
  const role = OWNER_ADMIN_EMAILS.has(email) ? "admin" : (row.role || "user");
  return { tokenHash, user: { id: row.id, email: row.email, role } };
}

function publicArticleRow(row, includeContent = false) {
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

function publicVideoRow(row, categories = []) {
  return {
    video_id: row.video_id,
    platform: row.platform,
    original_url: row.original_url || "",
    external_id: row.external_id,
    embed_url: row.embed_url,
    title: row.title || "",
    description: row.description || "",
    thumbnail_url: row.thumbnail_url || "",
    author_name: row.author_name || "",
    published_at: row.published_at || "",
    status: row.status,
    sort_order: Number(row.sort_order || 0),
    pinned: Number(row.pinned || 0),
    pinned_sort_order: Number(row.pinned_sort_order || 0),
    metadata_error: row.metadata_error || "",
    categories
  };
}

function adminVideoRow(row, categories = []) {
  return {
    ...publicVideoRow(row, categories),
    original_url: row.original_url || "",
    created_at: row.created_at,
    updated_at: row.updated_at,
    category_ids: categories.map((category) => category.category_id)
  };
}

async function publicVideoCategories(env, lang) {
  const rows = (await env.DB.prepare(`
    select category_id, slug, name_zh, name_en, name_ja, sort_order
    from video_categories
    where enabled = 1
    order by sort_order desc, created_at desc
  `).all()).results || [];
  return rows.map((row) => ({
    category_id: row.category_id,
    slug: row.slug,
    name: lang === "en" ? (row.name_en || row.name_zh) : (lang === "ja" ? (row.name_ja || row.name_zh) : row.name_zh),
    name_zh: row.name_zh,
    name_en: row.name_en,
    name_ja: row.name_ja,
    sort_order: Number(row.sort_order || 0)
  }));
}

async function videoRelations(env, videoIds) {
  const result = new Map();
  videoIds.forEach((videoId) => result.set(videoId, []));
  if (!videoIds.length) {
    return result;
  }
  const placeholders = videoIds.map(() => "?").join(", ");
  const rows = (await env.DB.prepare(`
    select
      video_category_relations.video_id,
      video_categories.category_id,
      video_categories.slug,
      video_categories.name_zh,
      video_categories.name_en,
      video_categories.name_ja,
      video_categories.sort_order,
      video_categories.enabled
    from video_category_relations
    join video_categories on video_categories.category_id = video_category_relations.category_id
    where video_category_relations.video_id in (${placeholders})
    order by video_category_relations.sort_order asc, video_categories.sort_order desc
  `).bind(...videoIds).all()).results || [];
  rows.forEach((row) => {
    const list = result.get(row.video_id) || [];
    list.push({
      category_id: row.category_id,
      slug: row.slug,
      name_zh: row.name_zh,
      name_en: row.name_en,
      name_ja: row.name_ja,
      sort_order: Number(row.sort_order || 0),
      enabled: Number(row.enabled || 0)
    });
    result.set(row.video_id, list);
  });
  return result;
}

async function normalizeVideoPayload(body, env, options = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError("Video payload is invalid.", 400);
  }
  const sourceUrl = normalizeOptionalText(body.original_url || body.url, 800) || options.existing?.original_url || "";
  const existingUrl = options.existing?.original_url || "";
  const sourceChanged = Boolean(sourceUrl && sourceUrl !== existingUrl);
  const parsed = sourceUrl && (!options.existing || sourceChanged) ? await metadataForVideoUrl(sourceUrl) : {
    platform: options.existing?.platform || "",
    original_url: options.existing?.original_url || "",
    external_id: options.existing?.external_id || "",
    embed_url: options.existing?.embed_url || "",
    title: "",
    description: "",
    thumbnail_url: "",
    author_name: "",
    published_at: "",
    metadata_error: options.existing?.metadata_error || ""
  };
  if (!parsed.platform || !parsed.embed_url) {
    throw new HttpError(parsed.metadata_error || "Please provide a supported YouTube or Bilibili URL.", 400);
  }
  const title = normalizeOptionalText(body.title, 220) || parsed.title || options.existing?.title || "";
  if (!title) {
    throw new HttpError("视频标题不能为空。", 400);
  }
  const pinned = body.pinned ? 1 : 0;
  return {
    platform: parsed.platform,
    original_url: parsed.original_url,
    external_id: parsed.external_id,
    embed_url: parsed.embed_url,
    title,
    description: normalizeOptionalText(body.description, 2000) || parsed.description || "",
    thumbnail_url: normalizeThumbnailUrl(body.thumbnail_url) || parsed.thumbnail_url || "",
    author_name: normalizeOptionalText(body.author_name, 160) || parsed.author_name || "",
    published_at: normalizeOptionalDateTime(body.published_at) || parsed.published_at || null,
    status: normalizeVideoStatus(body.status),
    sort_order: normalizeSortOrder(body.sort_order, options.defaultSortOrder ?? options.existing?.sort_order ?? 0),
    pinned,
    pinned_sort_order: pinned ? normalizeSortOrder(
      body.pinned_sort_order,
      options.defaultPinnedSortOrder ?? options.existing?.pinned_sort_order ?? options.existing?.sort_order ?? 0
    ) : 0,
    metadata_error: normalizeOptionalText(body.metadata_error, 500) || parsed.metadata_error || "",
    category_ids: await normalizeVideoCategoryIds(env, body.category_ids || body.categories || [])
  };
}

function normalizeVideoCategoryPayload(body, options = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError("Category payload is invalid.", 400);
  }
  return {
    slug: normalizeSlug(body.slug),
    name_zh: normalizeRequiredText(body.name_zh || body.name, 80, "中文分类名不能为空。"),
    name_en: normalizeOptionalText(body.name_en, 80),
    name_ja: normalizeOptionalText(body.name_ja, 80),
    sort_order: normalizeSortOrder(body.sort_order, options.defaultSortOrder ?? 0),
    enabled: body.enabled === false || body.enabled === 0 ? 0 : 1
  };
}

async function normalizeVideoCategoryIds(env, value) {
  const raw = Array.isArray(value) ? value : String(value || "").split(",");
  const ids = [...new Set(raw.map((item) => String(item || "").trim()).filter(Boolean))].slice(0, 12);
  if (!ids.length) {
    return [];
  }
  ids.forEach((id) => normalizeRecordId(id, "Category id is invalid."));
  const placeholders = ids.map(() => "?").join(", ");
  const rows = (await env.DB.prepare(`select category_id from video_categories where category_id in (${placeholders})`)
    .bind(...ids).all()).results || [];
  const existing = new Set(rows.map((row) => row.category_id));
  const missing = ids.find((id) => !existing.has(id));
  if (missing) {
    throw new HttpError("选择的视频分类不存在。", 400);
  }
  return ids;
}

function videoCategoryRelationStatements(env, videoId, categoryIds) {
  const now = nowIso();
  return categoryIds.map((categoryId, index) => env.DB.prepare(`
    insert into video_category_relations (video_id, category_id, sort_order, created_at)
    values (?, ?, ?, ?)
    on conflict(video_id, category_id) do update set sort_order = excluded.sort_order
  `).bind(videoId, categoryId, index, now));
}

async function metadataForVideoUrl(input) {
  const parsed = await parseVideoUrl(input);
  if (parsed.platform === "youtube") {
    return await youtubeMetadata(parsed);
  }
  if (parsed.platform === "bilibili") {
    return await bilibiliMetadata(parsed);
  }
  throw new HttpError("Unsupported video platform.", 400);
}

async function parseVideoUrl(input) {
  const raw = normalizeOptionalText(input, 800);
  if (!raw) {
    throw new HttpError("请输入视频链接。", 400);
  }
  if (/^BV[a-zA-Z0-9]+$/.test(raw)) {
    return parseVideoUrl(`https://www.bilibili.com/video/${raw}`);
  }
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new HttpError("视频链接格式不正确。", 400);
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new HttpError("视频链接必须使用 http 或 https。", 400);
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (host === "b23.tv") {
    return parseVideoUrl(await resolveShortVideoUrl(url.toString()));
  }
  if (host === "youtu.be") {
    const videoId = cleanYoutubeId(url.pathname.split("/").filter(Boolean)[0]);
    return youtubeParsed(url, videoId);
  }
  if (host === "youtube.com" || host === "m.youtube.com") {
    if (url.pathname === "/watch") {
      return youtubeParsed(url, cleanYoutubeId(url.searchParams.get("v")));
    }
    const shorts = url.pathname.match(/^\/shorts\/([^/?#]+)/);
    if (shorts) {
      return youtubeParsed(url, cleanYoutubeId(shorts[1]));
    }
  }
  if (host === "bilibili.com" || host.endsWith(".bilibili.com")) {
    const bvid = (url.pathname.match(/\/video\/(BV[a-zA-Z0-9]+)/) || [])[1];
    if (!bvid) {
      throw new HttpError("暂时只支持 bilibili.com/video/BV... 视频链接。", 400);
    }
    const page = Math.max(1, Math.min(Number(url.searchParams.get("p") || url.searchParams.get("page") || 1), 99));
    return {
      platform: "bilibili",
      original_url: url.toString(),
      external_id: bvid,
      page,
      embed_url: `https://player.bilibili.com/player.html?bvid=${encodeURIComponent(bvid)}&page=${page}&high_quality=1&autoplay=0`
    };
  }
  throw new HttpError("只支持 youtube.com、youtu.be、bilibili.com、b23.tv 视频链接。", 400);
}

function youtubeParsed(url, videoId) {
  if (!videoId) {
    throw new HttpError("无法识别 YouTube videoId。", 400);
  }
  return {
    platform: "youtube",
    original_url: url.toString(),
    external_id: videoId,
    embed_url: `https://www.youtube.com/embed/${encodeURIComponent(videoId)}`
  };
}

function cleanYoutubeId(value) {
  const id = String(value || "").trim();
  return /^[a-zA-Z0-9_-]{6,20}$/.test(id) ? id : "";
}

function bilibiliVideoPageUrl(parsed, mobile = false) {
  const host = mobile ? "https://m.bilibili.com" : "https://www.bilibili.com";
  const url = new URL(`/video/${encodeURIComponent(parsed.external_id)}`, host);
  if (parsed.page && Number(parsed.page) > 1) {
    url.searchParams.set("p", String(parsed.page));
  }
  return url.toString();
}

function bilibiliRequestHeaders(parsed, type = "json") {
  const base = type === "html" ? BILIBILI_PAGE_HEADERS : BILIBILI_METADATA_HEADERS;
  const referer = bilibiliVideoPageUrl(parsed);
  return {
    ...base,
    Referer: referer,
    "Sec-Fetch-Dest": type === "html" ? "document" : "empty",
    "Sec-Fetch-Mode": type === "html" ? "navigate" : "cors",
    "Sec-Fetch-Site": type === "html" ? "same-origin" : "same-site",
    ...(type === "html" ? { "Upgrade-Insecure-Requests": "1" } : {}),
    Cookie: `CURRENT_FNVAL=4048; buvid3=${bilibiliSyntheticBuvid(parsed.external_id)}; b_nut=1781540000`
  };
}

function bilibiliSyntheticBuvid(value) {
  const source = String(value || "bilibili");
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
  }
  const hex = hash.toString(16).padStart(8, "0").toUpperCase();
  return `${hex}-${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(0, 4)}-${hex}${hex}`;
}

async function youtubeMetadata(parsed) {
  const fallbackThumb = `https://i.ytimg.com/vi/${parsed.external_id}/hqdefault.jpg`;
  const [pageResult, oembedResult] = await Promise.allSettled([
    youtubePageMetadata(parsed),
    fetchJsonWithTimeout(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(parsed.original_url)}&format=json`,
      4500,
      YOUTUBE_METADATA_HEADERS
    )
  ]);
  const pageMetadata = pageResult.status === "fulfilled" ? pageResult.value : {};
  if (oembedResult.status === "fulfilled") {
    const info = oembedResult.value;
    return {
      ...parsed,
      title: metadataText(info.title || pageMetadata.title, 220),
      description: metadataText(pageMetadata.description, 2000),
      thumbnail_url: metadataThumbnailUrl(info.thumbnail_url || pageMetadata.thumbnail_url || fallbackThumb),
      author_name: metadataText(info.author_name || pageMetadata.author_name, 160),
      published_at: pageMetadata.published_at || null,
      metadata_error: ""
    };
  }
  const hasPageMetadata = pageMetadata.title || pageMetadata.description || pageMetadata.published_at;
  const error = oembedResult.reason || pageResult.reason || {};
  return {
    ...parsed,
    title: metadataText(pageMetadata.title, 220),
    description: metadataText(pageMetadata.description, 2000),
    thumbnail_url: metadataThumbnailUrl(pageMetadata.thumbnail_url || fallbackThumb),
    author_name: metadataText(pageMetadata.author_name, 160),
    published_at: pageMetadata.published_at || null,
    metadata_error: hasPageMetadata ? "" : `YouTube 元数据抓取失败：${error.message || "请手动填写。"}`
  };
}

async function bilibiliMetadata(parsed) {
  try {
    const data = await bilibiliApiMetadata(parsed);
    return bilibiliDataToMetadata(parsed, data);
  } catch (apiError) {
    try {
      const data = await bilibiliPageMetadata(parsed);
      const metadata = bilibiliDataToMetadata(parsed, data);
      return {
        ...metadata,
        metadata_error: metadata.title || metadata.description || metadata.thumbnail_url || metadata.author_name || metadata.published_at
          ? ""
          : `Bilibili 元数据抓取失败：${apiError.message || "请手动填写。"}`
      };
    } catch (pageError) {
      return {
        ...parsed,
        title: "",
        description: "",
        thumbnail_url: "",
        author_name: "",
        published_at: null,
        metadata_error: `Bilibili 元数据抓取失败：${pageError.message || apiError.message || "请手动填写。"}`
      };
    }
  }
}

async function youtubePageMetadata(parsed) {
  const html = await fetchTextWithTimeout(
    `https://www.youtube.com/watch?v=${encodeURIComponent(parsed.external_id)}`,
    5000,
    YOUTUBE_METADATA_HEADERS
  );
  const description = extractJsonString(html, "shortDescription")
    || extractMetaContent(html, "name", "description")
    || extractMetaContent(html, "property", "og:description");
  const title = extractMetaContent(html, "property", "og:title")
    || extractJsonString(html, "title")
    || extractMetaContent(html, "name", "title");
  const published = extractJsonString(html, "publishDate")
    || extractJsonString(html, "uploadDate")
    || extractMetaContent(html, "itemprop", "datePublished")
    || extractMetaContent(html, "itemprop", "uploadDate");
  return {
    title: metadataText(title, 220),
    description: metadataText(description, 2000),
    thumbnail_url: metadataThumbnailUrl(extractMetaContent(html, "property", "og:image")),
    author_name: metadataText(extractJsonString(html, "ownerChannelName") || extractJsonString(html, "author"), 160),
    published_at: metadataDate(published)
  };
}

async function bilibiliApiMetadata(parsed) {
  const endpoints = [
    {
      url: `https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(parsed.external_id)}`,
      pick: (info) => info.data
    },
    {
      url: `https://api.bilibili.com/x/web-interface/view/detail?bvid=${encodeURIComponent(parsed.external_id)}`,
      pick: (info) => info.data?.View || info.data?.view || info.data
    }
  ];
  let lastError = null;
  for (const endpoint of endpoints) {
    try {
      const info = await fetchJsonWithTimeout(endpoint.url, 6000, bilibiliRequestHeaders(parsed, "json"));
      if (Number(info.code || 0) !== 0) {
        throw new Error(info.message || "Bilibili 返回空数据。");
      }
      const data = endpoint.pick(info);
      if (data) {
        return data;
      }
      throw new Error("Bilibili 返回空数据。");
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("Bilibili 返回空数据。");
}

async function bilibiliPageMetadata(parsed) {
  const urls = [
    bilibiliVideoPageUrl(parsed),
    `https://www.bilibili.com/video/${encodeURIComponent(parsed.external_id)}/`,
    bilibiliVideoPageUrl(parsed, true),
    `https://m.bilibili.com/video/${encodeURIComponent(parsed.external_id)}`
  ];
  let lastError = null;
  for (const url of [...new Set(urls)]) {
    try {
      const html = await fetchTextWithTimeout(url, 6000, bilibiliRequestHeaders(parsed, "html"));
      const state = extractBilibiliInitialState(html) || extractBilibiliNextData(html);
      const data = state?.videoData
        || state?.videoInfo
        || state?.View
        || state?.viewInfo
        || state?.video
        || findBilibiliVideoData(state)
        || bilibiliHtmlMetadata(html);
      if (data) {
        return data;
      }
      throw new Error("Bilibili 页面未返回视频信息。");
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("Bilibili 页面未返回视频信息。");
}

function bilibiliDataToMetadata(parsed, data) {
  const description = data.desc || descV2Text(data.desc_v2) || data.description || data.shortDescription;
  const publishedAt = metadataUnixDate(data.pubdate || data.ctime || data.publish_time || data.pub_time)
    || metadataDate(data.published_at || data.uploadDate || data.datePublished || data.createTime);
  return {
    ...parsed,
    title: metadataText(cleanBilibiliTitle(data.title || data.name), 220),
    description: metadataText(description, 2000),
    thumbnail_url: metadataThumbnailUrl(data.pic || data.cover || data.thumbnail_url || data.thumbnailUrl || data.image),
    author_name: metadataText(data.owner?.name || data.author?.name || data.author || data.upData?.name || data.ownerName, 160),
    published_at: publishedAt,
    metadata_error: ""
  };
}

function bilibiliHtmlMetadata(html) {
  const jsonLd = extractJsonLdVideoMetadata(html);
  const title = cleanBilibiliTitle(
    extractMetaContent(html, "property", "og:title")
      || extractMetaContent(html, "name", "title")
      || extractMetaContent(html, "itemprop", "name")
      || extractJsonString(html, "title")
      || jsonLd.title
      || jsonLd.name
      || extractHtmlTitle(html)
  );
  const description = extractMetaContent(html, "name", "description")
    || extractMetaContent(html, "property", "og:description")
    || extractMetaContent(html, "itemprop", "description")
    || extractJsonString(html, "description")
    || extractJsonString(html, "desc")
    || extractJsonString(html, "shortDescription")
    || jsonLd.description;
  const image = extractMetaContent(html, "property", "og:image")
    || extractMetaContent(html, "itemprop", "thumbnailUrl")
    || extractJsonString(html, "thumbnailUrl")
    || extractJsonString(html, "thumbnail_url")
    || jsonLd.thumbnailUrl
    || jsonLd.image;
  const author = extractMetaContent(html, "name", "author")
    || extractNestedJsonString(html, "owner", "name")
    || extractJsonString(html, "ownerName")
    || extractJsonString(html, "author_name")
    || extractJsonString(html, "author")
    || jsonLd.author;
  const published = extractMetaContent(html, "itemprop", "uploadDate")
    || extractJsonString(html, "uploadDate")
    || extractJsonString(html, "datePublished")
    || jsonLd.uploadDate
    || jsonLd.datePublished;
  const unixPublished = extractJsonNumber(html, "pubdate") || extractJsonNumber(html, "ctime");
  if (!title && !description && !image && !author && !published && !unixPublished) {
    return null;
  }
  return {
    title,
    desc: description,
    pic: image,
    author,
    published_at: published || "",
    pubdate: unixPublished
  };
}

function cleanBilibiliTitle(value) {
  return String(value || "")
    .replace(/_哔哩哔哩_bilibili\s*$/i, "")
    .replace(/\s*-\s*哔哩哔哩\s*$/i, "")
    .trim();
}

function findBilibiliVideoData(value, depth = 0) {
  if (!value || typeof value !== "object" || depth > 5) {
    return null;
  }
  if (looksLikeBilibiliVideoData(value)) {
    return value;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findBilibiliVideoData(item, depth + 1);
      if (found) {
        return found;
      }
    }
    return null;
  }
  for (const key of ["videoData", "videoInfo", "View", "viewInfo", "data", "result", "item"]) {
    const found = findBilibiliVideoData(value[key], depth + 1);
    if (found) {
      return found;
    }
  }
  for (const item of Object.values(value)) {
    const found = findBilibiliVideoData(item, depth + 1);
    if (found) {
      return found;
    }
  }
  return null;
}

function looksLikeBilibiliVideoData(value) {
  return Boolean(
    value
      && typeof value === "object"
      && value.title
      && (value.bvid || value.aid || value.pic || value.cover || value.owner || value.pubdate || value.ctime || value.desc || value.desc_v2)
  );
}

function descV2Text(value) {
  if (!Array.isArray(value)) {
    return "";
  }
  return value.map((item) => {
    const raw = String(item?.raw_text || "").trim();
    if (!raw) {
      return "";
    }
    return Number(item?.type) === 2 ? `@${raw}` : raw;
  }).filter(Boolean).join(" ");
}

function extractBilibiliInitialState(html) {
  const source = String(html || "");
  const match = source.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});\s*\(function/);
  if (!match) {
    return extractAssignedObject(source, "window.__INITIAL_STATE__");
  }
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function extractBilibiliNextData(html) {
  const source = String(html || "");
  const match = source.match(/<script\s+[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!match) {
    return null;
  }
  try {
    return JSON.parse(decodeHtmlEntities(match[1].trim()));
  } catch {
    return null;
  }
}

function extractAssignedObject(source, marker) {
  const index = source.indexOf(marker);
  if (index < 0) {
    return null;
  }
  const start = source.indexOf("{", index);
  if (start < 0) {
    return null;
  }
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let i = start; i < source.length; i += 1) {
    const char = source[i];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = "";
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(source.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function extractMetaContent(html, attrName, attrValue) {
  const tagPattern = /<meta\s+[^>]*>/gi;
  const tags = String(html || "").match(tagPattern) || [];
  const target = attrValue.toLowerCase();
  for (const tag of tags) {
    const attr = extractHtmlAttribute(tag, attrName);
    if (attr && attr.toLowerCase() === target) {
      return decodeHtmlEntities(extractHtmlAttribute(tag, "content"));
    }
  }
  return "";
}

function extractHtmlTitle(html) {
  const match = String(html || "").match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decodeHtmlEntities(match[1]).replace(/\s+/g, " ").trim() : "";
}

function extractHtmlAttribute(tag, name) {
  const pattern = new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
  const match = String(tag || "").match(pattern);
  return match ? (match[2] || match[3] || match[4] || "") : "";
}

function extractJsonString(html, key) {
  const pattern = new RegExp(`"${escapeRegExp(key)}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`);
  const match = String(html || "").match(pattern);
  if (!match) {
    return "";
  }
  try {
    return JSON.parse(`"${match[1]}"`);
  } catch {
    return match[1].replace(/\\"/g, '"');
  }
}

function extractJsonNumber(html, key) {
  const pattern = new RegExp(`"${escapeRegExp(key)}"\\s*:\\s*(\\d{6,})`);
  const match = String(html || "").match(pattern);
  return match ? Number(match[1]) : 0;
}

function extractNestedJsonString(html, objectKey, key) {
  const pattern = new RegExp(`"${escapeRegExp(objectKey)}"\\s*:\\s*\\{[^{}]*"${escapeRegExp(key)}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`);
  const match = String(html || "").match(pattern);
  if (!match) {
    return "";
  }
  try {
    return JSON.parse(`"${match[1]}"`);
  } catch {
    return match[1].replace(/\\"/g, '"');
  }
}

function extractJsonLdVideoMetadata(html) {
  const source = String(html || "");
  const scriptPattern = /<script\s+[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptPattern.exec(source))) {
    try {
      const parsed = JSON.parse(decodeHtmlEntities(match[1].trim()));
      const video = findJsonLdVideoObject(parsed);
      if (video) {
        return {
          title: video.title || "",
          name: video.name || "",
          description: video.description || "",
          image: Array.isArray(video.image) ? video.image[0] : video.image,
          thumbnailUrl: Array.isArray(video.thumbnailUrl) ? video.thumbnailUrl[0] : video.thumbnailUrl,
          uploadDate: video.uploadDate || "",
          datePublished: video.datePublished || "",
          author: typeof video.author === "string"
            ? video.author
            : (Array.isArray(video.author) ? video.author[0]?.name : video.author?.name) || ""
        };
      }
    } catch {
      continue;
    }
  }
  return {};
}

function findJsonLdVideoObject(value) {
  if (!value || typeof value !== "object") {
    return null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findJsonLdVideoObject(item);
      if (found) {
        return found;
      }
    }
    return null;
  }
  const type = Array.isArray(value["@type"]) ? value["@type"] : [value["@type"]];
  if (type.some((item) => String(item || "").toLowerCase() === "videoobject")) {
    return value;
  }
  return findJsonLdVideoObject(value["@graph"]);
}

function metadataDate(value) {
  const raw = metadataText(value, 80);
  if (!raw) {
    return null;
  }
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function metadataUnixDate(value) {
  const seconds = Number(value || 0);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }
  const date = new Date(seconds * 1000);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function metadataText(value, maxLength) {
  const text = decodeHtmlEntities(String(value || "")).replace(/\s+\n/g, "\n").replace(/[ \t]{2,}/g, " ").trim();
  return Array.from(text).slice(0, maxLength).join("");
}

function metadataThumbnailUrl(value) {
  try {
    const raw = String(value || "").trim().replace(/^http:\/\//, "https://");
    return normalizeThumbnailUrl(raw.startsWith("//") ? `https:${raw}` : raw);
  } catch {
    return "";
  }
}

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#38;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&#60;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#62;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function resolveShortVideoUrl(shortUrl) {
  const manualResponse = await fetchWithTimeout(shortUrl, {
    method: "GET",
    redirect: "manual",
    headers: BILIBILI_PAGE_HEADERS
  }, 4500);
  const location = manualResponse.headers.get("location");
  if (location) {
    return new URL(location, shortUrl).toString();
  }
  const followedResponse = await fetchWithTimeout(shortUrl, {
    method: "GET",
    redirect: "follow",
    headers: BILIBILI_PAGE_HEADERS
  }, 4500);
  if (followedResponse.url && followedResponse.url !== shortUrl) {
    return followedResponse.url;
  }
  throw new HttpError("b23.tv 短链接解析失败，请使用完整 Bilibili 链接或手动填写。", 400);
}

async function fetchJsonWithTimeout(url, timeoutMs, headers = {}) {
  const response = await fetchWithTimeout(url, { headers }, timeoutMs);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

async function fetchTextWithTimeout(url, timeoutMs, headers = {}) {
  const response = await fetchWithTimeout(url, { headers }, timeoutMs);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.text();
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 5000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("请求超时");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function parseTags(value) {
  try {
    const tags = JSON.parse(value || "[]");
    return Array.isArray(tags) ? tags.map((tag) => String(tag)).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function normalizeArticlePayload(body, options = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError("文章数据格式不正确。", 400);
  }

  const partial = Boolean(options.partial);
  const article = {};
  if (!partial || body.slug !== undefined) {
    article.slug = normalizeSlug(body.slug);
  }
  if (!partial || body.category !== undefined) {
    article.category = normalizeOptionalText(body.category, 80) || "note";
  }
  if (!partial || body.tags !== undefined) {
    article.tags = normalizeTags(body.tags);
  }
  if (!partial || body.cover_image !== undefined) {
    article.cover_image = normalizeOptionalText(body.cover_image, 500);
  }
  if (!partial || body.status !== undefined) {
    article.status = normalizeArticleStatus(body.status);
  }
  if (!partial || body.is_pinned !== undefined) {
    article.is_pinned = body.is_pinned ? 1 : 0;
  }
  if (body.published_at !== undefined) {
    article.published_at = normalizeOptionalDateTime(body.published_at);
  }
  if (!partial || body.translations !== undefined) {
    article.translations = normalizeArticleTranslations(body.translations, partial);
  }
  return article;
}

function normalizeArticleTranslations(value, partial = false) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    if (partial) {
      return undefined;
    }
    throw new HttpError("文章需要 translations。", 400);
  }

  const translations = {};
  ["zh", "en", "ja"].forEach((lang) => {
    if (value[lang] === undefined) {
      return;
    }
    const item = value[lang];
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new HttpError(`${lang} 翻译内容格式不正确。`, 400);
    }
    const title = normalizeRequiredText(item.title, 180, `${lang} 标题不能为空。`);
    translations[lang] = {
      title,
      summary: normalizeOptionalText(item.summary, 500),
      content_markdown: normalizeOptionalText(item.content_markdown, 200000)
    };
  });

  if (!Object.keys(translations).length && !partial) {
    throw new HttpError("文章至少需要一种语言内容。", 400);
  }
  if (!partial && !["zh", "en", "ja"].every((lang) => translations[lang])) {
    throw new HttpError("发布文章时需要同时提供 zh / en / ja 三种语言内容。", 400);
  }
  return translations;
}

function articleTranslationsStatements(env, articleId, translations, now) {
  return Object.entries(translations).map(([lang, item]) => env.DB.prepare(`
    insert into article_translations (
      translation_id, article_id, lang, title, summary, content_markdown, created_at, updated_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?)
    on conflict(article_id, lang)
    do update set
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
    item.content_markdown,
    now,
    now
  ));
}

function articleMarkdownReplaceStatements(env, articleId, lang, replacements, now) {
  return replacements.map(([needle, replacement]) => env.DB.prepare(`
    update article_translations
    set content_markdown = replace(content_markdown, ?, ?),
        updated_at = ?
    where article_id = ?
      and lang = ?
      and instr(content_markdown, ?) > 0
  `).bind(needle, replacement, now, articleId, lang, needle));
}

function aiAgentWorkflowArticleMediaStatements(env, now) {
  const articleId = "seed-ai-agent-workflow-guide-2026-06-14";
  const media = {
    zh: [
      [
        "这不是“一句话让 AI 变出网站”，而是一个更实用的流程：人负责判断，AI 放大执行。\n\n## 1. AI 的基础原理：它本质上是在预测下一个 Token",
        "这不是“一句话让 AI 变出网站”，而是一个更实用的流程：人负责判断，AI 放大执行。\n\n![Codex 把一次网站更新拆成待办、执行和验收记录](assets/images/articles/ai-agent-codex-update-thread.png)\n\n## 1. AI 的基础原理：它本质上是在预测下一个 Token"
      ],
      [
        "换线程不是为了重新开始，而是为了让 AI 的上下文变干净。\n\n## 3. Agent 的工作原理",
        "换线程不是为了重新开始，而是为了让 AI 的上下文变干净。\n\n![给 Codex 的项目背景、目标、范围和验收标准示例](assets/images/articles/ai-agent-codex-project-brief.png)\n\n## 3. Agent 的工作原理"
      ],
      [
        "GitHub：托管代码和协作的平台。仓库是项目文件夹，commit 是一次保存记录，branch 是分支，PR 是把分支合并回主线前的审查申请。\n\n## 5. 最好用的提示词公式",
        "GitHub：托管代码和协作的平台。仓库是项目文件夹，commit 是一次保存记录，branch 是分支，PR 是把分支合并回主线前的审查申请。\n\n![先用对话型 AI 把模糊需求整理成项目上下文](assets/images/articles/ai-agent-gpt-project-context.png)\n\n## 5. 最好用的提示词公式"
      ],
      [
        "AI 不是怕任务难，是怕你让它猜。\n\n## 6. 使用 AI 的实战技巧",
        "AI 不是怕任务难，是怕你让它猜。\n\n![把随口需求压缩成可执行提示词，再交给 Agent](assets/images/articles/ai-agent-gpt-chatroom-prompt.png)\n\n## 6. 使用 AI 的实战技巧"
      ]
    ],
    en: [
      [
        "This is not “one sentence creates a website.” The practical workflow is: humans judge, AI multiplies execution.\n\n## 1. The Basic Principle: AI Predicts the Next Token",
        "This is not “one sentence creates a website.” The practical workflow is: humans judge, AI multiplies execution.\n\n![Codex turns one site update into tasks, execution, and acceptance notes](assets/images/articles/ai-agent-codex-update-thread.png)\n\n## 1. The Basic Principle: AI Predicts the Next Token"
      ],
      [
        "Switching threads is not starting over. It keeps the AI context clean.\n\n## 3. How an Agent Works",
        "Switching threads is not starting over. It keeps the AI context clean.\n\n![A project handoff example for Codex: context, goals, scope, and checks](assets/images/articles/ai-agent-codex-project-brief.png)\n\n## 3. How an Agent Works"
      ],
      [
        "GitHub: a platform for hosting code and collaborating. A repository is the project folder, a commit is a saved change, a branch is a separate work line, and a PR is a review request before merging work back into the main line.\n\n## 5. The Prompt Formula I Use Most",
        "GitHub: a platform for hosting code and collaborating. A repository is the project folder, a commit is a saved change, a branch is a separate work line, and a PR is a review request before merging work back into the main line.\n\n![Use chat AI first to turn vague requirements into project context](assets/images/articles/ai-agent-gpt-project-context.png)\n\n## 5. The Prompt Formula I Use Most"
      ],
      [
        "AI is not afraid of hard work. It is afraid of guessing.\n\n## 6. Practical AI Techniques",
        "AI is not afraid of hard work. It is afraid of guessing.\n\n![Compress a rough request into an executable prompt before handing it to an Agent](assets/images/articles/ai-agent-gpt-chatroom-prompt.png)\n\n## 6. Practical AI Techniques"
      ]
    ],
    ja: [
      [
        "これは「一文で AI がサイトを作る」という話ではありません。実用的な流れは、人が判断し、AI が実行を増幅する、ということです。\n\n## 1. AI の基本原理：次の Token を予測している",
        "これは「一文で AI がサイトを作る」という話ではありません。実用的な流れは、人が判断し、AI が実行を増幅する、ということです。\n\n![Codex が一つのサイト更新をタスク、実行、確認記録に分ける例](assets/images/articles/ai-agent-codex-update-thread.png)\n\n## 1. AI の基本原理：次の Token を予測している"
      ],
      [
        "スレッドを替えるのは、最初からやり直すためではありません。AI の文脈をきれいに保つためです。\n\n## 3. Agent の動き方",
        "スレッドを替えるのは、最初からやり直すためではありません。AI の文脈をきれいに保つためです。\n\n![Codex に渡すプロジェクト背景、目標、範囲、確認基準の例](assets/images/articles/ai-agent-codex-project-brief.png)\n\n## 3. Agent の動き方"
      ],
      [
        "GitHub：コードを置き、共同作業するためのプラットフォームです。repository はプロジェクトフォルダ、commit は保存記録、branch は作業分岐、PR は main に戻す前のレビュー依頼です。\n\n## 5. 一番よく使う Prompt 公式",
        "GitHub：コードを置き、共同作業するためのプラットフォームです。repository はプロジェクトフォルダ、commit は保存記録、branch は作業分岐、PR は main に戻す前のレビュー依頼です。\n\n![まず対話型 AI で曖昧な要望をプロジェクト文脈に整理する例](assets/images/articles/ai-agent-gpt-project-context.png)\n\n## 5. 一番よく使う Prompt 公式"
      ],
      [
        "AI は難しいタスクが苦手なのではありません。推測させられるのが苦手です。\n\n## 6. AI 活用の実践テクニック",
        "AI は難しいタスクが苦手なのではありません。推測させられるのが苦手です。\n\n![ざっくりした依頼を Agent に渡せる実行用プロンプトへ圧縮する例](assets/images/articles/ai-agent-gpt-chatroom-prompt.png)\n\n## 6. AI 活用の実践テクニック"
      ]
    ]
  };

  return Object.entries(media).flatMap(([lang, replacements]) => (
    articleMarkdownReplaceStatements(env, articleId, lang, replacements, now)
  ));
}

function aiAgentWorkflowArticleHeadingMediaStatements(env, now) {
  const articleId = "seed-ai-agent-workflow-guide-2026-06-14";
  const media = {
    zh: [
      ["## 1. AI 的基础原理：它本质上是在预测下一个 Token", "![Codex 把一次网站更新拆成待办、执行和验收记录](assets/images/articles/ai-agent-codex-update-thread.png)", "ai-agent-codex-update-thread.png"],
      ["## 3. Agent 的工作原理", "![给 Codex 的项目背景、目标、范围和验收标准示例](assets/images/articles/ai-agent-codex-project-brief.png)", "ai-agent-codex-project-brief.png"],
      ["## 5. 最好用的提示词公式", "![先用对话型 AI 把模糊需求整理成项目上下文](assets/images/articles/ai-agent-gpt-project-context.png)", "ai-agent-gpt-project-context.png"],
      ["## 6. 使用 AI 的实战技巧", "![把随口需求压缩成可执行提示词，再交给 Agent](assets/images/articles/ai-agent-gpt-chatroom-prompt.png)", "ai-agent-gpt-chatroom-prompt.png"]
    ],
    en: [
      ["## 1. The Basic Principle: AI Predicts the Next Token", "![Codex turns one site update into tasks, execution, and acceptance notes](assets/images/articles/ai-agent-codex-update-thread.png)", "ai-agent-codex-update-thread.png"],
      ["## 3. How an Agent Works", "![A project handoff example for Codex: context, goals, scope, and checks](assets/images/articles/ai-agent-codex-project-brief.png)", "ai-agent-codex-project-brief.png"],
      ["## 5. The Prompt Formula I Use Most", "![Use chat AI first to turn vague requirements into project context](assets/images/articles/ai-agent-gpt-project-context.png)", "ai-agent-gpt-project-context.png"],
      ["## 6. Practical AI Techniques", "![Compress a rough request into an executable prompt before handing it to an Agent](assets/images/articles/ai-agent-gpt-chatroom-prompt.png)", "ai-agent-gpt-chatroom-prompt.png"]
    ],
    ja: [
      ["## 1. AI の基本原理：次の Token を予測している", "![Codex が一つのサイト更新をタスク、実行、確認記録に分ける例](assets/images/articles/ai-agent-codex-update-thread.png)", "ai-agent-codex-update-thread.png"],
      ["## 3. Agent の動き方", "![Codex に渡すプロジェクト背景、目標、範囲、確認基準の例](assets/images/articles/ai-agent-codex-project-brief.png)", "ai-agent-codex-project-brief.png"],
      ["## 5. 一番よく使う Prompt 公式", "![まず対話型 AI で曖昧な要望をプロジェクト文脈に整理する例](assets/images/articles/ai-agent-gpt-project-context.png)", "ai-agent-gpt-project-context.png"],
      ["## 6. AI 活用の実践テクニック", "![ざっくりした依頼を Agent に渡せる実行用プロンプトへ圧縮する例](assets/images/articles/ai-agent-gpt-chatroom-prompt.png)", "ai-agent-gpt-chatroom-prompt.png"]
    ]
  };

  return Object.entries(media).flatMap(([lang, entries]) => entries.map(([heading, image, filename]) => env.DB.prepare(`
    update article_translations
    set content_markdown = replace(content_markdown, ?, ?),
        updated_at = ?
    where article_id = ?
      and lang = ?
      and instr(content_markdown, ?) > 0
      and instr(content_markdown, ?) = 0
  `).bind(heading, `${image}\n\n${heading}`, now, articleId, lang, heading, filename)));
}

function articleSeedStatements(env) {
  // Seed timestamps must be UTC ISO strings; the UI converts them to each visitor's local time.
  return [
    env.DB.prepare(`
      delete from article_translations
      where article_id in ('seed-xp-site-notes', 'seed-local-ai-workflow', 'seed-fallback-check')
    `),
    env.DB.prepare(`
      delete from articles
      where article_id in ('seed-xp-site-notes', 'seed-local-ai-workflow', 'seed-fallback-check')
    `),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (
        'seed-update-2026-06-15-managed-video-system',
        '2026-06-15-managed-video-system',
        'site-updates',
        '["网站更新","视频区","后台"]',
        '',
        'published',
        0,
        0,
        '2026-06-15T08:30:00.000Z',
        '2026-06-15T08:30:00.000Z',
        '2026-06-15T08:30:00.000Z'
      )
      on conflict(article_id) do update set
        slug = excluded.slug,
        category = excluded.category,
        tags = excluded.tags,
        cover_image = excluded.cover_image,
        status = excluded.status,
        is_pinned = excluded.is_pinned,
        updated_at = excluded.updated_at,
        published_at = excluded.published_at
    `),
    env.DB.prepare(`
      insert into article_translations (
        translation_id, article_id, lang, title, summary, content_markdown, created_at, updated_at
      ) values
        (
          'seed-update-2026-06-15-managed-video-system-zh',
          'seed-update-2026-06-15-managed-video-system',
          'zh',
          '视频区改造成可管理系统',
          '视频区现在支持后台管理 YouTube 和 Bilibili 链接，并可在站内播放。',
          '# 视频区改造成可管理系统

这次更新把原来的占位视频卡片改成真实的视频管理系统。

## 更新内容

- 后台新增视频管理，可以输入 YouTube、Bilibili 或 b23.tv 链接并自动识别平台。
- 服务端会规范化播放器地址，抓取标题、作者、简介和封面，并缓存到 D1。
- 主站视频区改为读取 \`/api/videos\`，分类标签由后台视频分类动态生成。
- 视频点击后在 XP 风格窗口内播放，不再跳转外站。
- 后台新增视频分类管理，可以新增、编辑、停用、排序和安全删除分类。',
          '2026-06-15T08:30:00.000Z',
          '2026-06-15T08:30:00.000Z'
        ),
        (
          'seed-update-2026-06-15-managed-video-system-en',
          'seed-update-2026-06-15-managed-video-system',
          'en',
          'Managed Video System',
          'The videos section now supports managed YouTube and Bilibili links with inline playback.',
          '# Managed Video System

This update turns the old placeholder video cards into a real managed video system.

## What changed

- The admin area can now create and edit videos from YouTube, Bilibili, or b23.tv links.
- The server normalizes embed URLs, fetches metadata, and caches title, author, description, and thumbnail data in D1.
- The public videos section now reads from \`/api/videos\`, with category tabs generated from admin-managed video categories.
- Videos open inside the XP-style site window instead of jumping to an external site.
- A new admin category manager supports creating, editing, disabling, sorting, and safely deleting video categories.',
          '2026-06-15T08:30:00.000Z',
          '2026-06-15T08:30:00.000Z'
        ),
        (
          'seed-update-2026-06-15-managed-video-system-ja',
          'seed-update-2026-06-15-managed-video-system',
          'ja',
          '動画欄を管理できる仕組みに変更',
          '動画欄で YouTube と Bilibili のリンクを管理し、サイト内で再生できるようになりました。',
          '# 動画欄を管理できる仕組みに変更

今回の更新で、仮置きだった動画カードを実際に管理できる動画システムに変更しました。

## 変更内容

- 管理画面から YouTube、Bilibili、b23.tv のリンクを登録できるようになりました。
- サーバー側で埋め込み URL を正規化し、タイトル、作者、説明、サムネイルを取得して D1 に保存します。
- 公開側の動画欄は \`/api/videos\` から読み込み、分類タブも管理画面の動画分類から生成します。
- 動画は外部サイトへ移動せず、XP 風のウィンドウ内で再生します。
- 動画分類の追加、編集、停止、並び替え、安全な削除に対応しました。',
          '2026-06-15T08:30:00.000Z',
          '2026-06-15T08:30:00.000Z'
        )
      on conflict(article_id, lang) do update set
        title = excluded.title,
        summary = excluded.summary,
        content_markdown = excluded.content_markdown,
        updated_at = excluded.updated_at
    `),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values
        ('seed-xp-site-notes', 'xp-site-notes', 'site', '["个人站","记录"]', '', 'published', 1, 0, '2026-06-11T00:00:00.000Z', '2026-06-11T00:00:00.000Z', '2026-06-11T00:00:00.000Z'),
        ('seed-local-ai-workflow', 'local-ai-workflow', 'ai', '["AI","工具"]', '', 'published', 0, 0, '2026-06-11T00:01:00.000Z', '2026-06-11T00:01:00.000Z', '2026-06-11T00:01:00.000Z'),
        ('seed-fallback-check', 'fallback-check', 'note', '["fallback","测试"]', '', 'published', 0, 0, '2026-06-11T00:02:00.000Z', '2026-06-11T00:02:00.000Z', '2026-06-11T00:02:00.000Z'),
        ('seed-update-2026-06-11-site-update-articles', '2026-06-11-site-update-articles', 'site-updates', '["网站更新","上线记录"]', '', 'published', 0, 0, '2026-06-11T00:03:00.000Z', '2026-06-11T00:03:00.000Z', '2026-06-11T00:03:00.000Z')
      on conflict(article_id) do update set
        slug = excluded.slug,
        category = excluded.category,
        tags = excluded.tags,
        cover_image = excluded.cover_image,
        status = excluded.status,
        is_pinned = excluded.is_pinned,
        updated_at = excluded.updated_at,
        published_at = excluded.published_at
    `),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (
        'seed-update-2026-06-11-sync-layout-chat',
        '2026-06-11-sync-layout-chat',
        'site-updates',
        '["网站更新","修复记录"]',
        '',
        'published',
        0,
        0,
        '2026-06-11T00:04:00.000Z',
        '2026-06-11T00:04:00.000Z',
        '2026-06-11T00:04:00.000Z'
      )
      on conflict(article_id) do update set
        slug = excluded.slug,
        category = excluded.category,
        tags = excluded.tags,
        cover_image = excluded.cover_image,
        status = excluded.status,
        is_pinned = excluded.is_pinned,
        updated_at = excluded.updated_at,
        published_at = excluded.published_at
    `),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (
        'seed-update-2026-06-11-game-library-time-layout',
        '2026-06-11-game-library-time-layout',
        'site-updates',
        '["网站更新","游戏区","知识库"]',
        '',
        'published',
        0,
        0,
        '2026-06-11T00:05:00.000Z',
        '2026-06-11T00:05:00.000Z',
        '2026-06-11T00:05:00.000Z'
      )
      on conflict(article_id) do update set
        slug = excluded.slug,
        category = excluded.category,
        tags = excluded.tags,
        cover_image = excluded.cover_image,
        status = excluded.status,
        is_pinned = excluded.is_pinned,
        updated_at = excluded.updated_at,
        published_at = excluded.published_at
    `),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (
        'seed-update-2026-06-11-knowledge-video-home-fix',
        '2026-06-11-knowledge-video-home-fix',
        'site-updates',
        '["网站更新","知识库","视频区","首页"]',
        '',
        'published',
        0,
        0,
        '2026-06-11T00:06:00.000Z',
        '2026-06-11T00:06:00.000Z',
        '2026-06-11T00:06:00.000Z'
      )
      on conflict(article_id) do update set
        slug = excluded.slug,
        category = excluded.category,
        tags = excluded.tags,
        cover_image = excluded.cover_image,
        status = excluded.status,
        is_pinned = excluded.is_pinned,
        updated_at = excluded.updated_at,
        published_at = excluded.published_at
    `),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (
        'seed-update-2026-06-11-time-window-library-fix',
        '2026-06-11-time-window-library-fix',
        'site-updates',
        '["网站更新","时间显示","知识库","窗口"]',
        '',
        'published',
        0,
        0,
        '2026-06-11T14:25:00.000Z',
        '2026-06-11T14:25:00.000Z',
        '2026-06-11T14:25:00.000Z'
      )
      on conflict(article_id) do update set
        slug = excluded.slug,
        category = excluded.category,
        tags = excluded.tags,
        cover_image = excluded.cover_image,
        status = excluded.status,
        is_pinned = excluded.is_pinned,
        updated_at = excluded.updated_at,
        published_at = excluded.published_at
    `),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (
        'seed-update-2026-06-12-time-wallpaper-game-fix',
        '2026-06-12-time-wallpaper-game-fix',
        'site-updates',
        '["网站更新","首页","动态壁纸","游戏区","知识库"]',
        '',
        'published',
        0,
        0,
        '2026-06-12T01:00:00.000Z',
        '2026-06-12T01:00:00.000Z',
        '2026-06-12T01:00:00.000Z'
      )
      on conflict(article_id) do update set
        slug = excluded.slug,
        category = excluded.category,
        tags = excluded.tags,
        cover_image = excluded.cover_image,
        status = excluded.status,
        is_pinned = excluded.is_pinned,
        updated_at = excluded.updated_at,
        published_at = excluded.published_at
    `),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (
        'seed-update-2026-06-12-game-overlay-hidden-fix',
        '2026-06-12-game-overlay-hidden-fix',
        'site-updates',
        '["网站更新","游戏区","2048","Hextris"]',
        '',
        'published',
        0,
        0,
        '2026-06-12T08:00:00.000Z',
        '2026-06-12T08:00:00.000Z',
        '2026-06-12T08:00:00.000Z'
      )
      on conflict(article_id) do update set
        slug = excluded.slug,
        category = excluded.category,
        tags = excluded.tags,
        cover_image = excluded.cover_image,
        status = excluded.status,
        is_pinned = excluded.is_pinned,
        updated_at = excluded.updated_at,
        published_at = excluded.published_at
    `),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (
        'seed-update-2026-06-12-hd-home-wallpapers',
        '2026-06-12-hd-home-wallpapers',
        'site-updates',
        '["网站更新","首页","像素壁纸"]',
        '',
        'published',
        0,
        0,
        '2026-06-12T12:00:00.000Z',
        '2026-06-12T12:00:00.000Z',
        '2026-06-12T12:00:00.000Z'
      )
      on conflict(article_id) do update set
        slug = excluded.slug,
        category = excluded.category,
        tags = excluded.tags,
        cover_image = excluded.cover_image,
        status = excluded.status,
        is_pinned = excluded.is_pinned,
        updated_at = excluded.updated_at,
        published_at = excluded.published_at
    `),
    env.DB.prepare(`
      insert into article_translations (
        translation_id, article_id, lang, title, summary, content_markdown, created_at, updated_at
      ) values
        ('seed-xp-site-notes-zh', 'seed-xp-site-notes', 'zh', '数据库化文章系统测试', '这篇文章用于验证中文文章列表和详情展示。', '# 数据库化文章系统测试

这是中文正文，保存在 Cloudflare D1 中。

## 验证点

- 文章列表来自数据库
- 正文使用 Markdown 保存
- 网站切换语言时会重新读取对应语言', '2026-06-11T00:00:00.000Z', '2026-06-11T00:00:00.000Z'),
        ('seed-xp-site-notes-en', 'seed-xp-site-notes', 'en', 'Database-backed Article Test', 'This post verifies the English article list and detail view.', '# Database-backed Article Test

This English body is stored in Cloudflare D1.

## Checks

- The article list comes from the database
- The body is saved as Markdown
- Switching site language reloads the matching language', '2026-06-11T00:00:00.000Z', '2026-06-11T00:00:00.000Z'),
        ('seed-xp-site-notes-ja', 'seed-xp-site-notes', 'ja', 'データベース記事システムのテスト', '日本語の記事一覧と詳細表示を確認するための記事です。', '# データベース記事システムのテスト

この日本語本文は Cloudflare D1 に保存されています。

## 確認点

- 記事一覧はデータベースから読み込みます
- 本文は Markdown で保存します
- サイト言語を切り替えると対応言語を再読み込みします', '2026-06-11T00:00:00.000Z', '2026-06-11T00:00:00.000Z'),
        ('seed-local-ai-workflow-zh', 'seed-local-ai-workflow', 'zh', '本地 AI 工作流记录', '记录本地模型、工具和个人站内容发布流程。', '# 本地 AI 工作流记录

这里可以记录模型下载、提示词、工具配置和发布步骤。

## 后续

以后 Codex 发布文章时，会一次性写入 zh / en / ja 三种版本。', '2026-06-11T00:01:00.000Z', '2026-06-11T00:01:00.000Z'),
        ('seed-local-ai-workflow-en', 'seed-local-ai-workflow', 'en', 'Local AI Workflow Notes', 'Notes about local models, tools, and the site publishing flow.', '# Local AI Workflow Notes

This article can track model downloads, prompts, tool settings, and publishing steps.

## Later

When Codex publishes posts later, it will write zh / en / ja versions together.', '2026-06-11T00:01:00.000Z', '2026-06-11T00:01:00.000Z'),
        ('seed-local-ai-workflow-ja', 'seed-local-ai-workflow', 'ja', 'ローカルAIワークフロー記録', 'ローカルモデル、ツール、サイト投稿フローのメモです。', '# ローカルAIワークフロー記録

モデルのダウンロード、プロンプト、ツール設定、投稿手順を記録できます。

## 今後

あとで Codex が記事を投稿するときは、zh / en / ja を同時に書き込みます。', '2026-06-11T00:01:00.000Z', '2026-06-11T00:01:00.000Z'),
        ('seed-fallback-check-zh', 'seed-fallback-check', 'zh', 'Fallback 逻辑测试', '这篇文章只有中文内容，用于验证英文和日文缺失时回退到中文。', '# Fallback 逻辑测试

这篇文章故意只提供中文版本。

当请求 lang=en 或 lang=ja 时，接口应该回退到中文内容。', '2026-06-11T00:02:00.000Z', '2026-06-11T00:02:00.000Z'),
        ('seed-update-2026-06-11-site-update-articles-zh', 'seed-update-2026-06-11-site-update-articles', 'zh', '网站更新记录接入知识库', '网站更新记录成为知识库文章分类，首页欢迎弹窗会自动读取最近更新文章。', '# 网站更新记录接入知识库

本次更新把网站更新记录接入数据库化三语文章系统。

## 更新内容

- 知识库新增网站更新记录分类，并排在分类列表最后
- 首页欢迎弹窗右侧最近更新自动读取该分类文章
- 查看更多更新会跳转到知识库的网站更新记录分类
- 欢迎弹窗左侧改为站长施工公告
- 视频区和资源区卡片滚动与按钮间距得到整理
- 默认语言会优先跟随浏览器或系统语言，用户手动切换后会记住选择', '2026-06-11T00:03:00.000Z', '2026-06-11T00:03:00.000Z'),
        ('seed-update-2026-06-11-site-update-articles-en', 'seed-update-2026-06-11-site-update-articles', 'en', 'Site Update Log joins the knowledge base', 'Site updates are now real knowledge-base articles, and the welcome popup reads the latest update posts automatically.', '# Site Update Log joins the knowledge base

This update connects the site update log to the database-backed trilingual article system.

## Changes

- Added a Site Update Log category to the knowledge base and placed it last
- The welcome popup now reads recent update articles from that category
- More updates opens the Site Update Log category in the knowledge base
- The left side of the welcome popup now shows an owner status notice
- Video and resource cards now have better scrolling and button spacing
- The default language follows the browser or system language, then remembers manual user choices', '2026-06-11T00:03:00.000Z', '2026-06-11T00:03:00.000Z'),
        ('seed-update-2026-06-11-site-update-articles-ja', 'seed-update-2026-06-11-site-update-articles', 'ja', 'サイト更新記録を知識庫に接続', 'サイト更新記録を知識庫の記事分類にし、歓迎ポップアップが最新更新記事を自動で読み込みます。', '# サイト更新記録を知識庫に接続

今回の更新で、サイト更新記録をデータベース対応の三言語記事システムに接続しました。

## 更新内容

- 知識庫にサイト更新記録カテゴリを追加し、分類一覧の最後に配置
- 歓迎ポップアップ右側の最近の更新が、このカテゴリの記事を自動で読み込みます
- もっと見るから知識庫のサイト更新記録カテゴリへ移動できます
- 歓迎ポップアップ左側を管理人の工事中お知らせに変更
- 動画とリソースのカード表示、スクロール、ボタン余白を整理
- 初期言語はブラウザまたはシステム言語に合わせ、手動変更後はその選択を保存します', '2026-06-11T00:03:00.000Z', '2026-06-11T00:03:00.000Z'),
        ('seed-update-2026-06-12-time-wallpaper-game-fix-zh', 'seed-update-2026-06-12-time-wallpaper-game-fix', 'zh', '四时段静态像素壁纸接口与游戏修复', '首页新增 image2 重绘的四时段静态壁纸，并保留后续动画图层接口和小游戏存档修复。', '# 四时段静态像素壁纸接口与游戏修复

本次更新把首页壁纸升级为更清晰、构图一致的四时段静态像素桌面，同时保留后续动画图层接口和小游戏旧存档修复。

## 更新内容

- 使用 image2 / imagegen 重新绘制统一构图母版，并裁切为 "assets/images/wallpapers/" 下的 morning、day、dusk、night 四张基础壁纸。
- 壁纸和欢迎弹窗问候语按用户本地时间切换：05:00-10:59 早上，11:00-16:59 白天，17:00-19:59 傍晚，20:00-04:59 晚上。
- 首页保留云、树冠、电视雪花屏、小女孩、星星和傍晚水面光效等 layer DOM/class，供后续新线程继续做动画。
- 首页背景改为 "wallpaper-root" / "wallpaper-stage" 舞台坐标结构，底图和动画层共享同一套 cover 裁切尺寸，避免电视雪花等小图层错位。
- 当前所有动画 layer 默认关闭，不显示电视雪花、云、树冠、星星或水面动效；页面只展示四时段静态底图。
- 电视机小女孩预留结构和 CSS class，默认不启用。
- 后续启用动画时，只使用 CSS transform / opacity，并继续支持减少动态、页面隐藏暂停和手机端降级。
- 知识库文章发布日期继续显示本地时间到秒，但不再显示时区名称。
- 2048 和 Hextris 恢复存档时，如果读到已结束或无法继续的局面，会自动开启新局。
- 更新 CSS / JS 资源版本号，减少浏览器继续使用旧资源缓存的可能。', '2026-06-12T01:00:00.000Z', '2026-06-12T01:00:00.000Z'),
        ('seed-update-2026-06-12-time-wallpaper-game-fix-en', 'seed-update-2026-06-12-time-wallpaper-game-fix', 'en', 'Static time-of-day wallpaper interface and game fixes', 'The home screen now uses redrawn static wallpapers across four periods, with animation layer hooks kept for later.', '# Static time-of-day wallpaper interface and game fixes

This update upgrades the home wallpaper into a sharper, consistent, four-period static pixel desktop while keeping animation layer hooks and the ended-save fix for two small games.

## Changes

- Redrew a consistent wallpaper master with image2 / imagegen and split it into morning, day, dusk, and night base wallpapers under "assets/images/wallpapers/".
- Wallpaper and welcome greeting now use visitor local time: 05:00-10:59 morning, 11:00-16:59 day, 17:00-19:59 dusk, and 20:00-04:59 night.
- Kept layer DOM/classes for clouds, tree canopy, CRT snow, the TV girl, stars, and dusk water shimmer so animation can continue in a later thread.
- The home background now uses a "wallpaper-root" / "wallpaper-stage" coordinate stage so the base image and animation layers share the same cover crop, preventing small layers such as TV snow from drifting out of place.
- All animation layers are disabled by default now: no CRT snow, cloud, tree canopy, star, or water animation is shown. The page displays only the four static base wallpapers.
- The TV girl structure and "wallpaper-tv-girl" CSS class are reserved, but not enabled by default.
- Later animation work should use CSS transform / opacity only and keep reduced-motion, hidden-page pause, and mobile downgrade support.
- Knowledge-base publish dates still show local time down to seconds, but no longer append the timezone name.
- 2048 and Hextris now start a fresh run when a restored save is already ended or cannot continue.
- Bumped CSS / JS asset versions to reduce stale browser cache issues.', '2026-06-12T01:00:00.000Z', '2026-06-12T01:00:00.000Z'),
        ('seed-update-2026-06-12-time-wallpaper-game-fix-ja', 'seed-update-2026-06-12-time-wallpaper-game-fix', 'ja', '時間帯別の静的壁紙インターフェースとゲーム修正', 'ホームに再描画した4時間帯の静的壁紙を追加し、今後のアニメーション層の入口も残しました。', '# 時間帯別の静的壁紙インターフェースとゲーム修正

今回の更新では、ホーム壁紙をより鮮明で統一感のある4時間帯の静的ピクセルデスクトップにし、今後のアニメーション層の入口とゲームの終了済みセーブ修正も維持しました。

## 更新内容

- image2 / imagegen で統一構図の壁紙母版を再描画し、"assets/images/wallpapers/" の morning、day、dusk、night に分割しました。
- 壁紙と歓迎ポップアップの挨拶は閲覧者のローカル時刻で切り替わります：05:00-10:59 朝、11:00-16:59 昼、17:00-19:59 夕方、20:00-04:59 夜。
- 雲、樹冠、テレビ砂嵐、テレビの女の子、星、夕方の水面反射用の layer DOM/class を残し、後続スレッドでアニメーションを続けられるようにしました。
- ホーム背景は "wallpaper-root" / "wallpaper-stage" の座標ステージに変更し、底图とアニメーション層が同じ cover 裁切を共有するため、テレビ砂嵐などの小さな層がずれにくくなりました。
- 現在はすべてのアニメーション layer を初期状態で無効にし、テレビ砂嵐、雲、樹冠、星、水面の動きは表示しません。ページは4時間帯の静的底图だけを表示します。
- テレビの女の子用構造と "wallpaper-tv-girl" CSS class は予約済みですが、初期状態では有効化していません。
- 後続でアニメーションを有効にする場合は CSS transform / opacity のみを使い、視差軽減、ページ非表示時の一時停止、スマホ軽量化も維持します。
- 知識庫の記事公開日はローカル時刻を秒まで表示しますが、タイムゾーン名は表示しません。
- 2048 と Hextris は、復元したセーブが終了済みまたは続行不能な場合、自動で新しいゲームを開始します。
- CSS / JS のバージョンを更新し、古いキャッシュが残る可能性を減らしました。', '2026-06-12T01:00:00.000Z', '2026-06-12T01:00:00.000Z'),
        ('seed-update-2026-06-12-game-overlay-hidden-fix-zh', 'seed-update-2026-06-12-game-overlay-hidden-fix', 'zh', '2048 与 Hextris 遮罩显示修复', '修复两个小游戏新局也显示继续玩或游戏结束遮罩的问题，并更新游戏样式缓存版本。', '# 2048 与 Hextris 遮罩显示修复

本次更新修复 2048 和 Hextris 打开后被遮罩挡住、无法正常游玩的问题。

## 更新内容

- 为两个小游戏的遮罩增加 .overlay[hidden] 隐藏规则，避免游戏 CSS 的 display: grid 覆盖浏览器默认 hidden 行为。
- 2048 新局会直接显示可操作棋盘，不再被空白继续玩按钮挡住。
- Hextris 新局会直接显示可旋转的六边形场地，不再误显示游戏结束。
- 为两个游戏的 styles.css 引用增加版本参数，减少线上继续加载旧样式缓存的可能。', '2026-06-12T08:00:00.000Z', '2026-06-12T08:00:00.000Z'),
        ('seed-update-2026-06-12-game-overlay-hidden-fix-en', 'seed-update-2026-06-12-game-overlay-hidden-fix', 'en', '2048 and Hextris overlay display fix', 'Fixed the overlay that made the two small games appear stuck on Keep Playing or Game Over.', '# 2048 and Hextris overlay display fix

This update fixes the overlay issue that blocked 2048 and Hextris immediately after opening a fresh game.

## Changes

- Added a .overlay[hidden] hiding rule to both games so their display: grid overlay style no longer overrides the browser hidden behavior.
- 2048 now opens to a playable board instead of being covered by an empty Keep Playing button.
- Hextris now opens to the rotating hex field instead of incorrectly showing Game Over.
- Added a version query to both games styles.css references to reduce stale style cache issues online.', '2026-06-12T08:00:00.000Z', '2026-06-12T08:00:00.000Z'),
        ('seed-update-2026-06-12-game-overlay-hidden-fix-ja', 'seed-update-2026-06-12-game-overlay-hidden-fix', 'ja', '2048 と Hextris のオーバーレイ表示修正', '2つのミニゲームが開始直後に続行またはゲーム終了の表示で塞がれる問題を修正しました。', '# 2048 と Hextris のオーバーレイ表示修正

今回の更新では、2048 と Hextris を開いた直後にオーバーレイが表示され、正常に遊べない問題を修正しました。

## 更新内容

- 2つのゲームに .overlay[hidden] の非表示ルールを追加し、display: grid がブラウザ標準の hidden 動作を上書きしないようにしました。
- 2048 は空の続行ボタンに覆われず、すぐに操作できる盤面を表示します。
- Hextris はゲーム終了表示ではなく、回転できる六角形ステージを表示します。
- 2つのゲームの styles.css 参照にバージョンパラメータを追加し、オンラインで古いスタイルが残る可能性を減らしました。', '2026-06-12T08:00:00.000Z', '2026-06-12T08:00:00.000Z')
      on conflict(article_id, lang) do update set
        title = excluded.title,
        summary = excluded.summary,
        content_markdown = excluded.content_markdown,
        updated_at = excluded.updated_at
    `),
    env.DB.prepare(`
      insert into article_translations (
        translation_id, article_id, lang, title, summary, content_markdown, created_at, updated_at
      ) values
        (
          'seed-update-2026-06-11-sync-layout-chat-zh',
          'seed-update-2026-06-11-sync-layout-chat',
          'zh',
          '同步部署与页面显示修复',
          '修复线上线下版本核对、视频和资源卡片布局、小黑屋事件翻译、知识库读取与聊天室轮询。',
          '# 同步部署与页面显示修复

本次更新集中处理线上线下显示不一致和几个页面交互问题。

## 更新内容

- 更新 CSS / JS 资源版本号，减少浏览器继续使用旧资源导致的线上线下不同步。
- 视频区和资源区卡片改为固定缩略图比例、固定按钮高度和一致的网格布局。
- 删除知识库三篇测试文章，只保留真实的网站更新记录文章。
- 知识库详情增加请求状态保护，避免频繁切换语言后一直停留在读取中。
- 小黑屋补充 Penrose 事件缺失的中文和日文翻译。
- 首页视频区、资源区、杂谈区桌面图标加上建设中标记。
- 匿名聊天室改为 after/message_id 增量拉取，并根据空闲和后台状态自动降低轮询频率。',
          '2026-06-11T00:04:00.000Z',
          '2026-06-11T00:04:00.000Z'
        ),
        (
          'seed-update-2026-06-11-sync-layout-chat-en',
          'seed-update-2026-06-11-sync-layout-chat',
          'en',
          'Deployment sync and layout fixes',
          'This update fixes deployment verification, video/resource card layout, A Dark Room event localization, article loading, and chat polling.',
          '# Deployment sync and layout fixes

This update focuses on local/production consistency and several visible interaction issues.

## Changes

- Bumped CSS / JS asset versions so browsers do not keep using stale production resources.
- Video and resource cards now use fixed thumbnail ratios, stable button heights, and consistent grid behavior.
- Removed the three test knowledge-base articles and kept real site update posts.
- Added request-state guards to article detail loading so language switching cannot leave the page stuck.
- Added missing Chinese and Japanese translations for the Penrose event in A Dark Room.
- Marked the home desktop icons for Videos, Resources, and Talk as under construction.
- Anonymous chat now keeps after/message_id incremental pulls and slows polling while idle or in the background.',
          '2026-06-11T00:04:00.000Z',
          '2026-06-11T00:04:00.000Z'
        ),
        (
          'seed-update-2026-06-11-sync-layout-chat-ja',
          'seed-update-2026-06-11-sync-layout-chat',
          'ja',
          'デプロイ同期と表示修正',
          '本更新では、本番との同期確認、動画・リソースカード、小黑屋イベント翻訳、記事読み込み、チャット更新頻度を修正しました。',
          '# デプロイ同期と表示修正

今回の更新では、ローカルと本番の表示差分、そしていくつかの画面上の問題をまとめて直しました。

## 更新内容

- CSS / JS のバージョン番号を更新し、古い本番リソースが残り続ける問題を減らしました。
- 動画とリソースのカードに固定サムネイル比率、安定したボタン高さ、統一したグリッドを適用しました。
- 知識庫のテスト記事 3 件を削除し、実際のサイト更新記事だけを残しました。
- 記事詳細にリクエスト状態の保護を追加し、言語切り替え後に読み込み中のまま残る問題を防ぎました。
- 小黑屋の Penrose イベントに不足していた中国語と日本語の翻訳を追加しました。
- ホームの動画、リソース、雑談アイコンに工事中の表示を追加しました。
- 匿名チャットは after/message_id の差分取得を維持し、待機中やバックグラウンドでは更新頻度を下げるようにしました。',
          '2026-06-11T00:04:00.000Z',
          '2026-06-11T00:04:00.000Z'
        ),
        (
          'seed-update-2026-06-11-game-library-time-layout-zh',
          'seed-update-2026-06-11-game-library-time-layout',
          'zh',
          '游戏区扩展与发布时间精确到秒',
          '新增多款开源游戏入口，修复首页最近更新过长、标题排版和知识库发布时间显示。',
          '# 游戏区扩展与发布时间精确到秒

本次更新继续整理首页、知识库和游戏区。

## 更新内容

- 知识库文章列表和详情页的发布时间显示到时分秒。
- 首页欢迎弹窗最近更新限制条数和高度，并优先显示网站更新记录文章标题与简介。
- 游戏区新增人生重启模拟器、多个修仙文字游戏、2048、Hextris、Freeciv-web 和 OpenTTD 等开源项目入口。
- 人生重启模拟器、猫国建设者、小黑屋等多语言支持游戏优先排在顶部。
- 游戏卡片补充中文 / English / 日本語支持状态，并支持跟随站点语言切换展示本站文案。
- 首页主标题、英文标题和桌面图标文案缩短并优化小屏排版。',
          '2026-06-11T00:05:00.000Z',
          '2026-06-11T00:05:00.000Z'
        ),
        (
          'seed-update-2026-06-11-game-library-time-layout-en',
          'seed-update-2026-06-11-game-library-time-layout',
          'en',
          'Game library expansion and second-level article times',
          'Added more open-source game entries and fixed recent updates, home title layout, and precise article publish times.',
          '# Game library expansion and second-level article times

This update continues cleanup across the home screen, knowledge base, and games section.

## Changes

- Knowledge-base article lists and detail pages now show publish time down to seconds.
- The welcome popup recent updates list now limits count and height, while prioritizing Site Update Log article titles and summaries.
- The games section adds Life Restart, several cultivation text games, 2048, Hextris, Freeciv-web, OpenTTD, and other open-source entries.
- Multilingual games such as Life Restart, Kittens Game, and A Dark Room are placed at the top.
- Game cards now show Chinese / English / Japanese support states and switch site-side copy with the current site language.
- The home title, English subtitle, and desktop icon labels were shortened and tuned for small screens.',
          '2026-06-11T00:05:00.000Z',
          '2026-06-11T00:05:00.000Z'
        ),
        (
          'seed-update-2026-06-11-game-library-time-layout-ja',
          'seed-update-2026-06-11-game-library-time-layout',
          'ja',
          'ゲーム欄拡張と秒単位の公開時刻',
          'オープンソースゲーム入口を追加し、最近の更新、ホーム見出し、記事公開時刻表示を修正しました。',
          '# ゲーム欄拡張と秒単位の公開時刻

今回の更新では、ホーム画面、知識庫、ゲーム欄を整理しました。

## 更新内容

- 知識庫の記事一覧と詳細ページで、公開時刻を秒まで表示します。
- 歓迎ポップアップの最近の更新は件数と高さを制限し、サイト更新記録の記事タイトルと概要を優先表示します。
- ゲーム欄に Life Restart、複数の修仙テキストゲーム、2048、Hextris、Freeciv-web、OpenTTD などの入口を追加しました。
- Life Restart、子猫ゲーム、暗い部屋など多言語対応ゲームを上部に配置しました。
- ゲームカードに中国語 / English / 日本語の対応状態を表示し、サイト言語に合わせて本站側の文面を切り替えます。
- ホームの主見出し、英語サブタイトル、デスクトップアイコン文言を短くし、小画面表示を調整しました。',
          '2026-06-11T00:05:00.000Z',
          '2026-06-11T00:05:00.000Z'
        ),
        (
          'seed-update-2026-06-11-knowledge-video-home-fix-zh',
          'seed-update-2026-06-11-knowledge-video-home-fix',
          'zh',
          '首页、知识库与视频区排版修复',
          '修复首页图标、知识库阅读页、视频卡片对齐、最近更新和聊天室时间显示。',
          '# 首页、知识库与视频区排版修复

本次更新集中处理几个直接影响浏览体验的显示问题。

## 更新内容

- 匿名聊天室当天消息只显示时间，非当天消息显示日期和时间。
- 知识库去掉顶部返回桌面工具栏，为内容区域留出更多空间。
- 知识库详情页隐藏左侧分类，只在文章列表页显示分类。
- 文章标题、简介和正文合并在同一个阅读面板里。
- 视频区卡片统一尺寸、标题槽位、简介槽位和按钮位置，避免同排错位或重叠。
- 首页桌面图标去掉蓝色底框并整体下移，避免图标显示不全。
- 首页文案和各板块标题禁止鼠标选中，减少误拖选带来的出戏感。
- 三个建设中板块恢复清晰的“施工中 / Developing / 開発中”文案，并保持单行显示。
- 首页弹窗最近更新固定显示最近 5 篇，自动由新文章顶掉旧文章，不再出现无限拉长或滚动条。',
          '2026-06-11T00:06:00.000Z',
          '2026-06-11T00:06:00.000Z'
        ),
        (
          'seed-update-2026-06-11-knowledge-video-home-fix-en',
          'seed-update-2026-06-11-knowledge-video-home-fix',
          'en',
          'Home, knowledge, and video layout fixes',
          'Fixed home icons, article reading layout, aligned video cards, recent updates, and chat timestamps.',
          '# Home, knowledge, and video layout fixes

This update focuses on visible layout issues that affect everyday browsing.

## Changes

- Anonymous chat now shows time only for today, and date plus time for older messages.
- Removed the knowledge-base top toolbar to give more room to content.
- Article detail pages hide the left category list; categories only appear on the knowledge home view.
- Article title, summary, and body now sit in one reading panel.
- Video cards now use consistent sizes, title slots, summary slots, and button positions to avoid uneven rows or overlap.
- Home desktop icons no longer use the blue background frame and are moved lower so they are fully visible.
- Home copy and section title bars are no longer text-selectable, reducing accidental drag selection.
- The three under-construction sections now use clear Developing copy and keep labels on one line.
- The welcome popup recent updates area shows the latest 5 posts, with new posts automatically pushing older ones out.',
          '2026-06-11T00:06:00.000Z',
          '2026-06-11T00:06:00.000Z'
        ),
        (
          'seed-update-2026-06-11-knowledge-video-home-fix-ja',
          'seed-update-2026-06-11-knowledge-video-home-fix',
          'ja',
          'ホーム、知識庫、動画欄の表示修正',
          'ホームアイコン、記事閲覧、動画カード整列、最近の更新、チャット時刻表示を修正しました。',
          '# ホーム、知識庫、動画欄の表示修正

今回の更新では、普段の閲覧に影響する表示問題をまとめて調整しました。

## 更新内容

- 匿名チャットは当日のメッセージを時刻のみ、前日以前のメッセージを日付と時刻で表示します。
- 知識庫上部のツールバーを削除し、内容領域を広げました。
- 記事詳細では左側カテゴリを隠し、カテゴリは知識庫トップだけに表示します。
- 記事タイトル、概要、本文をひとつの閲覧パネルにまとめました。
- 動画カードのサイズ、タイトル欄、概要欄、ボタン位置を統一し、行のずれや重なりを防ぎました。
- ホームのデスクトップアイコンから青い背景枠を外し、全体を下げて欠けを防ぎました。
- ホーム文言と各セクションのタイトルバーを選択不可にし、誤選択を減らしました。
- 3つの未完成セクションは分かりやすい「開発中」表記に戻し、1行で表示します。
- 歓迎ポップアップの最近の更新は最新5件だけを表示し、新しい記事が古い記事を自動的に押し出します。',
          '2026-06-11T00:06:00.000Z',
          '2026-06-11T00:06:00.000Z'
        ),
        (
          'seed-update-2026-06-11-time-window-library-fix-zh',
          'seed-update-2026-06-11-time-window-library-fix',
          'zh',
          '时间显示、知识库返回与窗口尺寸整理',
          '按用户所在时区显示文章和聊天室时间，关闭知识库后回到首页，并收紧关于我窗口。',
          '# 时间显示、知识库返回与窗口尺寸整理

本次更新继续整理几个日常使用时容易出戏的小问题。

## 更新内容

- 知识库文章发布时间按用户所在时区显示，并显示到秒和时区名。
- 匿名聊天室消息时间也按用户所在时区显示，今天只显示时间，旧消息显示日期、时间和时区。
- 从文章详情关闭知识库后，再打开知识库会回到知识库首页。
- 关于我页面改为更紧凑的窗口，其它普通板块统一为稍大的内容窗口，聊天室保持原本尺寸。
- 首页中文三个待建设入口从“施工中”改为“待定”，并放宽图标文字区域，尽量显示完整。',
          '2026-06-11T14:25:00.000Z',
          '2026-06-11T14:25:00.000Z'
        ),
        (
          'seed-update-2026-06-11-time-window-library-fix-en',
          'seed-update-2026-06-11-time-window-library-fix',
          'en',
          'Time display, knowledge reset, and window sizing',
          'Article and chat times now respect the visitor timezone, knowledge detail closes back to the home view, and About is more compact.',
          '# Time display, knowledge reset, and window sizing

This update polishes a few everyday browsing details.

## Changes

- Knowledge-base publish times now render in the visitor timezone, down to seconds, with the timezone label.
- Anonymous chat message times also use the visitor timezone; today shows time only, older messages show date, time, and timezone.
- Closing the knowledge base from an article detail resets it to the knowledge home view for the next open.
- The About page is now a compact window, while other regular sections share a slightly larger content window; chat keeps its own size.
- The three pending home entries now use TBD wording, with wider desktop icon labels so text can fit more naturally.',
          '2026-06-11T14:25:00.000Z',
          '2026-06-11T14:25:00.000Z'
        ),
        (
          'seed-update-2026-06-11-time-window-library-fix-ja',
          'seed-update-2026-06-11-time-window-library-fix',
          'ja',
          '時刻表示、知識庫の戻り先、ウィンドウサイズ調整',
          '記事とチャットの時刻を閲覧者のタイムゾーンに合わせ、知識庫詳細から閉じた後は一覧に戻るようにしました。',
          '# 時刻表示、知識庫の戻り先、ウィンドウサイズ調整

今回の更新では、普段の閲覧で気になる細かな表示を整えました。

## 更新内容

- 知識庫の記事公開時刻を閲覧者のタイムゾーンで秒まで表示し、タイムゾーン名も表示します。
- 匿名チャットの時刻も閲覧者のタイムゾーンに合わせ、当日は時刻のみ、古いメッセージは日付・時刻・タイムゾーンを表示します。
- 記事詳細から知識庫を閉じた後、次に開くと知識庫トップに戻ります。
- プロフィール画面をコンパクトにし、他の通常セクションは少し広い共通ウィンドウに整理しました。チャットは従来サイズのままです。
- ホームの3つの未完成入口は「未定」表記にし、アイコン文字領域を広げて文言を表示しやすくしました。',
          '2026-06-11T14:25:00.000Z',
          '2026-06-11T14:25:00.000Z'
        )
      on conflict(article_id, lang) do update set
        title = excluded.title,
        summary = excluded.summary,
        content_markdown = excluded.content_markdown,
        updated_at = excluded.updated_at
    `),
    env.DB.prepare(`
      insert into article_translations (
        translation_id, article_id, lang, title, summary, content_markdown, created_at, updated_at
      ) values
        (
          'seed-update-2026-06-12-hd-home-wallpapers-zh',
          'seed-update-2026-06-12-hd-home-wallpapers',
          'zh',
          '首页四时段壁纸高清替换',
          '首页四张时段壁纸改用 1672x941 原图，并更新裁切比例、像素渲染和缓存版本。',
          '# 首页四时段壁纸高清替换

本次更新把首页实际加载的四张时段壁纸换成更高清的原图，减少全屏桌面背景被放大后的发糊。

## 更新内容

- morning、day、dusk、night 四张基础壁纸改用 1672x941 原图。
- 首页壁纸舞台比例同步更新为新图比例，保持 cover 裁切和预留动画层坐标一致。
- 壁纸底图启用像素图渲染，浏览器放大时保留更清楚的像素边缘。
- 更新 CSS / JS 与壁纸 URL 缓存版本，减少线上继续加载旧半尺寸壁纸的可能。',
          '2026-06-12T12:00:00.000Z',
          '2026-06-12T12:00:00.000Z'
        ),
        (
          'seed-update-2026-06-12-hd-home-wallpapers-en',
          'seed-update-2026-06-12-hd-home-wallpapers',
          'en',
          'Sharper time-of-day home wallpapers',
          'The four home wallpapers now use the 1672x941 originals with updated crop ratio, pixel rendering, and cache versions.',
          '# Sharper time-of-day home wallpapers

This update swaps the four home wallpapers used by the live page to higher-resolution originals, reducing blur when the desktop background fills the screen.

## Changes

- The morning, day, dusk, and night base wallpapers now use the 1672x941 originals.
- The home wallpaper stage ratio now matches the new images, keeping cover cropping and reserved animation-layer coordinates aligned.
- Pixel rendering is enabled on the wallpaper base so scaled backgrounds keep crisper pixel edges.
- CSS / JS and wallpaper URL cache versions were bumped to reduce stale half-size wallpaper loads online.',
          '2026-06-12T12:00:00.000Z',
          '2026-06-12T12:00:00.000Z'
        ),
        (
          'seed-update-2026-06-12-hd-home-wallpapers-ja',
          'seed-update-2026-06-12-hd-home-wallpapers',
          'ja',
          'ホーム時間帯壁紙を高解像度化',
          'ホームの4枚の時間帯壁紙を1672x941の原寸画像に替え、裁切比率、ピクセル表示、キャッシュ版を更新しました。',
          '# ホーム時間帯壁紙を高解像度化

今回の更新では、ホームで実際に読み込む4枚の時間帯壁紙を高解像度の原寸画像に差し替え、全画面表示時のぼやけを減らしました。

## 更新内容

- morning、day、dusk、night の基本壁紙を 1672x941 の原寸画像に変更しました。
- ホーム壁紙ステージの比率を新しい画像に合わせ、cover 裁切と予約済みアニメーション層の座標をそろえました。
- 壁紙の下地画像にピクセル向け表示を有効化し、拡大時もエッジがより鮮明に見えるようにしました。
- CSS / JS と壁紙 URL のキャッシュ版を更新し、オンラインで旧い半サイズ壁紙が残る可能性を減らしました。',
          '2026-06-12T12:00:00.000Z',
          '2026-06-12T12:00:00.000Z'
        )
      on conflict(article_id, lang) do update set
        title = excluded.title,
        summary = excluded.summary,
        content_markdown = excluded.content_markdown,
        updated_at = excluded.updated_at
    `),
    env.DB.prepare(`
      delete from article_translations
      where article_id in ('seed-xp-site-notes', 'seed-local-ai-workflow', 'seed-fallback-check')
    `),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values
        ('seed-ai-agent-workflow-guide-2026-06-14', 'ai-agent-workflow-guide', 'ai', '["AI","Agent","Codex","经验"]', '', 'published', 1, 0, '2026-06-14T15:00:00.000Z', '2026-06-14T15:00:00.000Z', '2026-06-14T15:00:00.000Z'),
        ('seed-update-2026-06-14-ai-agent-article', '2026-06-14-ai-agent-article', 'site-updates', '["网站更新","AI","文章"]', '', 'published', 0, 0, '2026-06-14T15:01:00.000Z', '2026-06-14T15:01:00.000Z', '2026-06-14T15:01:00.000Z'),
        ('seed-update-2026-06-14-article-reading-links', '2026-06-14-article-reading-links', 'site-updates', '["网站更新","知识库","文章"]', '', 'published', 0, 0, '2026-06-14T16:20:00.000Z', '2026-06-14T16:20:00.000Z', '2026-06-14T16:20:00.000Z'),
        ('seed-update-2026-06-15-clouds-docs-maintenance', '2026-06-15-clouds-docs-maintenance', 'site-updates', '["网站更新","首页","动态壁纸","维护记录"]', '', 'published', 0, 0, '2026-06-15T05:00:00.000Z', '2026-06-15T05:00:00.000Z', '2026-06-15T05:00:00.000Z')
      on conflict(article_id) do update set
        slug = excluded.slug,
        category = excluded.category,
        tags = excluded.tags,
        cover_image = excluded.cover_image,
        status = excluded.status,
        is_pinned = excluded.is_pinned,
        updated_at = excluded.updated_at,
        published_at = excluded.published_at
    `),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (
        'seed-update-2026-06-15-cloud-speed-smoothness',
        '2026-06-15-cloud-speed-smoothness',
        'site-updates',
        '["网站更新","首页","动态壁纸","性能"]',
        '',
        'published',
        0,
        0,
        '2026-06-15T12:41:45.000Z',
        '2026-06-15T12:41:45.000Z',
        '2026-06-15T12:41:45.000Z'
      )
      on conflict(article_id) do update set
        slug = excluded.slug,
        category = excluded.category,
        tags = excluded.tags,
        cover_image = excluded.cover_image,
        status = excluded.status,
        is_pinned = excluded.is_pinned,
        updated_at = excluded.updated_at,
        published_at = excluded.published_at
    `),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (
        'seed-update-2026-06-15-icons-cloud-fixes',
        '2026-06-15-icons-cloud-fixes',
        'site-updates',
        '["网站更新","图标","首页","动态壁纸"]',
        '',
        'published',
        0,
        0,
        '2026-06-15T13:49:12.000Z',
        '2026-06-15T13:49:12.000Z',
        '2026-06-15T13:49:12.000Z'
      )
      on conflict(article_id) do update set
        slug = excluded.slug,
        category = excluded.category,
        tags = excluded.tags,
        cover_image = excluded.cover_image,
        status = excluded.status,
        is_pinned = excluded.is_pinned,
        updated_at = excluded.updated_at,
        published_at = excluded.published_at
    `),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (
        'seed-update-2026-06-15-home-wallpaper-gap-fix',
        '2026-06-15-home-wallpaper-gap-fix',
        'site-updates',
        '["网站更新","首页","动态壁纸","布局修复"]',
        '',
        'published',
        0,
        0,
        '2026-06-15T15:08:00.000Z',
        '2026-06-15T15:08:00.000Z',
        '2026-06-15T15:08:00.000Z'
      )
      on conflict(article_id) do update set
        slug = excluded.slug,
        category = excluded.category,
        tags = excluded.tags,
        cover_image = excluded.cover_image,
        status = excluded.status,
        is_pinned = excluded.is_pinned,
        updated_at = excluded.updated_at,
        published_at = excluded.published_at
    `),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (
        'seed-update-2026-06-15-video-management-sort-metadata',
        '2026-06-15-video-management-sort-metadata',
        'site-updates',
        '["网站更新","视频区","后台","排序","Bilibili"]',
        '',
        'published',
        0,
        0,
        '2026-06-15T16:20:00.000Z',
        '2026-06-15T16:20:00.000Z',
        '2026-06-15T16:20:00.000Z'
      )
      on conflict(article_id) do update set
        slug = excluded.slug,
        category = excluded.category,
        tags = excluded.tags,
        cover_image = excluded.cover_image,
        status = excluded.status,
        is_pinned = excluded.is_pinned,
        updated_at = excluded.updated_at,
        published_at = excluded.published_at
    `),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (
        'seed-update-2026-06-15-video-player-window-controls',
        '2026-06-15-video-player-window-controls',
        'site-updates',
        '["网站更新","视频区","播放器","交互修复"]',
        '',
        'published',
        0,
        0,
        '2026-06-15T15:30:00.000Z',
        '2026-06-15T15:30:00.000Z',
        '2026-06-15T15:30:00.000Z'
      )
      on conflict(article_id) do update set
        slug = excluded.slug,
        category = excluded.category,
        tags = excluded.tags,
        cover_image = excluded.cover_image,
        status = excluded.status,
        is_pinned = excluded.is_pinned,
        updated_at = excluded.updated_at,
        published_at = excluded.published_at
    `),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (
        'seed-update-2026-06-16-mobile-admin-video-fixes',
        '2026-06-16-mobile-admin-video-fixes',
        'site-updates',
        '["网站更新","移动端","视频区","后台","Bilibili"]',
        '',
        'published',
        0,
        0,
        '2026-06-16T02:20:00.000Z',
        '2026-06-16T02:20:00.000Z',
        '2026-06-16T02:20:00.000Z'
      )
      on conflict(article_id) do update set
        slug = excluded.slug,
        category = excluded.category,
        tags = excluded.tags,
        cover_image = excluded.cover_image,
        status = excluded.status,
        is_pinned = excluded.is_pinned,
        updated_at = excluded.updated_at,
        published_at = excluded.published_at
    `),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (
        'seed-update-2026-06-16-responsive-video-window',
        '2026-06-16-responsive-video-window',
        'site-updates',
        '["网站更新","视频区","响应式布局","桌面端"]',
        '',
        'published',
        0,
        0,
        '2026-06-16T02:40:13.000Z',
        '2026-06-16T02:40:13.000Z',
        '2026-06-16T02:40:13.000Z'
      )
      on conflict(article_id) do update set
        slug = excluded.slug,
        category = excluded.category,
        tags = excluded.tags,
        cover_image = excluded.cover_image,
        status = excluded.status,
        is_pinned = excluded.is_pinned,
        updated_at = excluded.updated_at,
        published_at = excluded.published_at
    `),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (
        'seed-update-2026-06-16-video-card-category-icon-fixes',
        '2026-06-16-video-card-category-icon-fixes',
        'site-updates',
        '["网站更新","视频区","后台","桌面图标"]',
        '',
        'published',
        0,
        0,
        '2026-06-16T08:20:00.000Z',
        '2026-06-16T08:20:00.000Z',
        '2026-06-16T08:20:00.000Z'
      )
      on conflict(article_id) do update set
        slug = excluded.slug,
        category = excluded.category,
        tags = excluded.tags,
        cover_image = excluded.cover_image,
        status = excluded.status,
        is_pinned = excluded.is_pinned,
        updated_at = excluded.updated_at,
        published_at = excluded.published_at
    `),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (
        'seed-update-2026-06-17-knowledge-search',
        '2026-06-17-knowledge-search',
        'site-updates',
        '["网站更新","知识库","搜索","移动端"]',
        '',
        'published',
        0,
        0,
        '2026-06-17T15:25:00.000Z',
        '2026-06-17T15:25:00.000Z',
        '2026-06-17T15:25:00.000Z'
      )
      on conflict(article_id) do update set
        slug = excluded.slug,
        category = excluded.category,
        tags = excluded.tags,
        cover_image = excluded.cover_image,
        status = excluded.status,
        is_pinned = excluded.is_pinned,
        updated_at = excluded.updated_at,
        published_at = excluded.published_at
    `),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (
        'seed-update-2026-06-17-article-share-link',
        '2026-06-17-article-share-link',
        'site-updates',
        '["网站更新","知识库","分享","文章"]',
        '',
        'published',
        0,
        0,
        '2026-06-17T15:40:00.000Z',
        '2026-06-17T15:40:00.000Z',
        '2026-06-17T15:40:00.000Z'
      )
      on conflict(article_id) do update set
        slug = excluded.slug,
        category = excluded.category,
        tags = excluded.tags,
        cover_image = excluded.cover_image,
        status = excluded.status,
        is_pinned = excluded.is_pinned,
        updated_at = excluded.updated_at,
        published_at = excluded.published_at
    `),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (
        'seed-update-2026-06-17-video-empty-state',
        '2026-06-17-video-empty-state',
        'site-updates',
        '["网站更新","视频区","空状态","移动端"]',
        '',
        'published',
        0,
        0,
        '2026-06-17T15:53:00.000Z',
        '2026-06-17T15:53:00.000Z',
        '2026-06-17T15:53:00.000Z'
      )
      on conflict(article_id) do update set
        slug = excluded.slug,
        category = excluded.category,
        tags = excluded.tags,
        cover_image = excluded.cover_image,
        status = excluded.status,
        is_pinned = excluded.is_pinned,
        updated_at = excluded.updated_at,
        published_at = excluded.published_at
    `),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (
        'seed-update-2026-06-17-route-aware-welcome',
        '2026-06-17-route-aware-welcome',
        'site-updates',
        '["网站更新","文章","直链","欢迎窗"]',
        '',
        'published',
        0,
        0,
        '2026-06-17T16:02:00.000Z',
        '2026-06-17T16:02:00.000Z',
        '2026-06-17T16:02:00.000Z'
      )
      on conflict(article_id) do update set
        slug = excluded.slug,
        category = excluded.category,
        tags = excluded.tags,
        cover_image = excluded.cover_image,
        status = excluded.status,
        is_pinned = excluded.is_pinned,
        updated_at = excluded.updated_at,
        published_at = excluded.published_at
    `),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (
        'seed-update-2026-06-18-resource-actions',
        '2026-06-18-resource-actions',
        'site-updates',
        '["网站更新","资源区","占位按钮","安全渲染"]',
        '',
        'published',
        0,
        0,
        '2026-06-17T16:09:00.000Z',
        '2026-06-17T16:09:00.000Z',
        '2026-06-17T16:09:00.000Z'
      )
      on conflict(article_id) do update set
        slug = excluded.slug,
        category = excluded.category,
        tags = excluded.tags,
        cover_image = excluded.cover_image,
        status = excluded.status,
        is_pinned = excluded.is_pinned,
        updated_at = excluded.updated_at,
        published_at = excluded.published_at
    `),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (
        'seed-update-2026-06-18-nav-active-state',
        '2026-06-18-nav-active-state',
        'site-updates',
        '["网站更新","导航","任务栏","可访问性"]',
        '',
        'published',
        0,
        0,
        '2026-06-17T16:18:00.000Z',
        '2026-06-17T16:18:00.000Z',
        '2026-06-17T16:18:00.000Z'
      )
      on conflict(article_id) do update set
        slug = excluded.slug,
        category = excluded.category,
        tags = excluded.tags,
        cover_image = excluded.cover_image,
        status = excluded.status,
        is_pinned = excluded.is_pinned,
        updated_at = excluded.updated_at,
        published_at = excluded.published_at
    `),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (
        'seed-update-2026-06-18-blog-placeholders',
        '2026-06-18-blog-placeholders',
        'site-updates',
        '["网站更新","杂谈区","占位按钮","安全渲染"]',
        '',
        'published',
        0,
        0,
        '2026-06-17T16:23:00.000Z',
        '2026-06-17T16:23:00.000Z',
        '2026-06-17T16:23:00.000Z'
      )
      on conflict(article_id) do update set
        slug = excluded.slug,
        category = excluded.category,
        tags = excluded.tags,
        cover_image = excluded.cover_image,
        status = excluded.status,
        is_pinned = excluded.is_pinned,
        updated_at = excluded.updated_at,
        published_at = excluded.published_at
    `),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (
        'seed-update-2026-06-18-language-url-sync',
        '2026-06-18-language-url-sync',
        'site-updates',
        '["网站更新","多语言","链接分享","路由"]',
        '',
        'published',
        0,
        0,
        '2026-06-17T16:41:00.000Z',
        '2026-06-17T16:41:00.000Z',
        '2026-06-17T16:41:00.000Z'
      )
      on conflict(article_id) do update set
        slug = excluded.slug,
        category = excluded.category,
        tags = excluded.tags,
        cover_image = excluded.cover_image,
        status = excluded.status,
        is_pinned = excluded.is_pinned,
        updated_at = excluded.updated_at,
        published_at = excluded.published_at
    `),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (
        'seed-update-2026-06-18-article-detail-search-hide',
        '2026-06-18-article-detail-search-hide',
        'site-updates',
        '["网站更新","知识库","文章详情","阅读体验"]',
        '',
        'published',
        0,
        0,
        '2026-06-17T16:50:00.000Z',
        '2026-06-17T16:50:00.000Z',
        '2026-06-17T16:50:00.000Z'
      )
      on conflict(article_id) do update set
        slug = excluded.slug,
        category = excluded.category,
        tags = excluded.tags,
        cover_image = excluded.cover_image,
        status = excluded.status,
        is_pinned = excluded.is_pinned,
        updated_at = excluded.updated_at,
        published_at = excluded.published_at
    `),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (
        'seed-update-2026-06-18-trilingual-tags',
        '2026-06-18-trilingual-tags',
        'site-updates',
        '["网站更新","多语言","标签","知识库"]',
        '',
        'published',
        0,
        0,
        '2026-06-17T16:56:00.000Z',
        '2026-06-17T16:56:00.000Z',
        '2026-06-17T16:56:00.000Z'
      )
      on conflict(article_id) do update set
        slug = excluded.slug,
        category = excluded.category,
        tags = excluded.tags,
        cover_image = excluded.cover_image,
        status = excluded.status,
        is_pinned = excluded.is_pinned,
        updated_at = excluded.updated_at,
        published_at = excluded.published_at
    `),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (
        'seed-update-2026-06-18-image-loading-polish',
        '2026-06-18-image-loading-polish',
        'site-updates',
        '["网站更新","性能","阅读体验","移动端"]',
        '',
        'published',
        0,
        0,
        '2026-06-17T17:06:00.000Z',
        '2026-06-17T17:06:00.000Z',
        '2026-06-17T17:06:00.000Z'
      )
      on conflict(article_id) do update set
        slug = excluded.slug,
        category = excluded.category,
        tags = excluded.tags,
        cover_image = excluded.cover_image,
        status = excluded.status,
        is_pinned = excluded.is_pinned,
        updated_at = excluded.updated_at,
        published_at = excluded.published_at
    `),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (
        'seed-update-2026-06-18-chatroom-title-locale',
        '2026-06-18-chatroom-title-locale',
        'site-updates',
        '["网站更新","多语言","修复记录","移动端"]',
        '',
        'published',
        0,
        0,
        '2026-06-17T17:16:00.000Z',
        '2026-06-17T17:16:00.000Z',
        '2026-06-17T17:16:00.000Z'
      )
      on conflict(article_id) do update set
        slug = excluded.slug,
        category = excluded.category,
        tags = excluded.tags,
        cover_image = excluded.cover_image,
        status = excluded.status,
        is_pinned = excluded.is_pinned,
        updated_at = excluded.updated_at,
        published_at = excluded.published_at
    `),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (
        'seed-update-2026-06-18-aria-label-localization',
        '2026-06-18-aria-label-localization',
        'site-updates',
        '["网站更新","多语言","修复记录","移动端"]',
        '',
        'published',
        0,
        0,
        '2026-06-17T17:22:00.000Z',
        '2026-06-17T17:22:00.000Z',
        '2026-06-17T17:22:00.000Z'
      )
      on conflict(article_id) do update set
        slug = excluded.slug,
        category = excluded.category,
        tags = excluded.tags,
        cover_image = excluded.cover_image,
        status = excluded.status,
        is_pinned = excluded.is_pinned,
        updated_at = excluded.updated_at,
        published_at = excluded.published_at
    `),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (
        'seed-update-2026-06-18-account-widget-locale',
        '2026-06-18-account-widget-locale',
        'site-updates',
        '["网站更新","多语言","修复记录","移动端"]',
        '',
        'published',
        0,
        0,
        '2026-06-17T17:28:00.000Z',
        '2026-06-17T17:28:00.000Z',
        '2026-06-17T17:28:00.000Z'
      )
      on conflict(article_id) do update set
        slug = excluded.slug,
        category = excluded.category,
        tags = excluded.tags,
        cover_image = excluded.cover_image,
        status = excluded.status,
        is_pinned = excluded.is_pinned,
        updated_at = excluded.updated_at,
        published_at = excluded.published_at
    `),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (
        'seed-update-2026-06-18-notepad-menu-locale',
        '2026-06-18-notepad-menu-locale',
        'site-updates',
        '["网站更新","多语言","杂谈区","修复记录"]',
        '',
        'published',
        0,
        0,
        '2026-06-17T17:33:00.000Z',
        '2026-06-17T17:33:00.000Z',
        '2026-06-17T17:33:00.000Z'
      )
      on conflict(article_id) do update set
        slug = excluded.slug,
        category = excluded.category,
        tags = excluded.tags,
        cover_image = excluded.cover_image,
        status = excluded.status,
        is_pinned = excluded.is_pinned,
        updated_at = excluded.updated_at,
        published_at = excluded.published_at
    `),
    ...articleTranslationsStatements(env, "seed-ai-agent-workflow-guide-2026-06-14", {
    "zh":  {
               "title":  "从提问到上线：普通人如何用 AI Agent 放大执行力",
               "summary":  "一篇面向普通人的 AI Agent 实战笔记，解释大模型原理、线程拆分、Agent、Skill、MCP、Git、模型选择和使用经验。",
               "content_markdown":  "# 从提问到上线：普通人如何用 AI Agent 放大执行力\n\n\u003e 核心观点：AI 不是替代人，而是放大人的执行力。会用 AI 的关键，不是会写代码，而是会把工作拆清楚、讲清楚、验收清楚。\n\n很多人用 AI，还停留在“问一句，答一句”。这当然有用，但真正能改变工作效率的，是把 AI 当成一个能协助推进任务的 Agent：你给它背景、目标、限制和验收标准，它帮你拆解、执行、检查、记录。\n\n我做个人站的过程就是这个逻辑：先用 GPT 把模糊想法整理成网站定位、页面结构、视觉风格和功能范围，再用 Codex 进入项目现场，读取项目文件，按规则修改、检查、更新记录。最后由人来判断方向、取舍范围、验收结果。\n\n这不是“一句话让 AI 变出网站”，而是一个更实用的流程：人负责判断，AI 放大执行。\n\n## 1. AI 的基础原理：它本质上是在预测下一个 Token\n\n大模型回答问题，可以粗略理解为“根据上下文预测下一个字”。更准确地说，是预测下一个 Token。Token 可以是字、词、数字、符号或代码片段。\n\n这件事很重要，因为它解释了 AI 的几个特点：\n\n1. 它不是全知全能，而是基于当前上下文生成最可能合适的内容。\n2. 你给的信息越清楚，它越容易沿着正确方向预测。\n3. 你给的信息越乱，它越容易抓错重点。\n4. 你没有提供的事实，它可能会猜。\n5. 旧对话太长时，关键内容可能被稀释，甚至被挤出上下文。\n\n所以，使用 AI 的第一原则不是“写神奇咒语”，而是管理上下文。\n\n## 2. 为什么长项目要拆线程\n\n很多人把一个项目从头聊到尾，最后发现 AI 越来越不稳。原因很简单：同一个聊天线程里塞了太多历史，模型每次都要在一堆旧信息里判断什么重要、什么已经过时、什么只是中间方案。\n\n我的经验是：长项目不要一直堆在同一个线程里，要按阶段拆。\n\n可以这样拆：\n\n```text\n需求澄清线程：只聊目标、用户、范围、优先级\n方案设计线程：只聊架构、页面、流程、风险\n执行线程：只让 Agent 按明确任务动手\n修 bug 线程：只放现象、复现步骤、期望结果\n总结线程：只整理变更、经验、文档和下一步\n```\n\n每开一个新线程，都带一份“项目交接包”：\n\n```text\n项目背景：这是一个什么项目\n当前状态：已经完成什么，还缺什么\n本次目标：这次只要做什么\n限制条件：不能做什么，必须遵守什么\n相关文件：需要读哪些资料\n验收标准：做到什么算完成\n输出格式：我要清单、方案、代码、文章还是 PPT\n```\n\n换线程不是为了重新开始，而是为了让 AI 的上下文变干净。\n\n## 3. Agent 的工作原理\n\n模型像大脑，Agent 像一个带工具的工作角色。\n\n普通聊天主要是回答；Agent 可以在授权范围内读文件、调用工具、执行命令、打开浏览器、修改文档、生成图片、导出 PPT、跑检查。它的工作循环通常是：\n\n```text\n理解任务 -\u003e 读取上下文 -\u003e 制定步骤 -\u003e 调用工具 -\u003e 检查结果 -\u003e 汇报或继续修正\n```\n\n这就是 Codex 有价值的地方。它不是只告诉我“你可以这样改”，而是能进入项目目录，读取 README、PROJECT_CONTEXT、CHANGELOG 和项目 Skill，再按已有规则执行。\n\n但 Agent 也不是自动可靠。它需要权限、工具、上下文和验收标准。没有边界的 Agent，容易把简单问题做复杂；没有验收标准的 Agent，做完了也不知道对不对。\n\n## 4. 几个必须知道的概念\n\n大模型：负责理解、推理、生成内容的核心能力。不同模型擅长的任务不一样，一般来说，参数规模、训练质量和推理能力都会影响模型表现，但不是“体积越大就一定更好”。\n\nToken：AI 处理文字的基本单位。输入越长、输出越长，成本和时间通常越高。\n\n上下文窗口：AI 当前能看到的信息范围。窗口外的信息，它就像没看见。\n\nPrompt：你给 AI 的任务说明。好 Prompt 的本质是好交代。\n\nRAG：让 AI 先从指定资料里检索，再基于资料回答。适合公司知识库、文档问答。\n\n微调：用专门数据训练模型，让它更适合某类任务。多数普通团队一开始不需要，先把 Prompt、知识库和流程做好更划算。\n\nTool Calling：让模型调用外部工具，比如搜索、查表、读文件、发请求、操作浏览器。\n\nSkill：给 Agent 的专项工作说明。它把某类任务的流程、规则、参考资料和脚本打包起来，让 Codex 更稳定地执行重复工作。OpenAI 文档里也把 Skill 描述为给 Codex 增加特定能力和工作流的方式。Skill 本质就是文档和提示词工程，是提前把一段规则输入给 AI。\n\nMCP：Model Context Protocol，可以理解成 AI 连接外部工具和上下文的标准接口。通过 MCP，Codex 可以访问第三方文档、浏览器、Figma、GitHub 等工具。\n\nGit：版本管理工具。它记录项目每次改了什么，方便回退、比较、协作。\n\nGitHub：托管代码和协作的平台。仓库是项目文件夹，commit 是一次保存记录，branch 是分支，PR 是把分支合并回主线前的审查申请。\n\n## 5. 最好用的提示词公式\n\n我最常用的是这套：\n\n```text\n背景 + 目标 + 当前状态 + 限制条件 + 验收标准 + 输出格式 + 不要做什么\n```\n\n例子，不要这样问：\n\n```text\n帮我做个匿名聊天室。\n```\n\n更好的问法是：\n\n```text\n我想在个人站加入轻量匿名聊天室。目标是让访客公开留言。\n当前网站部署在 Cloudflare Pages，已有 D1 数据库。\n第一版只做公开房间、纯文本、随机昵称、本地记住昵称、字数限制、发送冷却和轮询刷新。\n不要做私聊、图片上传、多房间和复杂后台。\n验收标准是手机和电脑都能发消息，刷新后消息仍存在，用户输入不会执行脚本，界面符合现有 XP 像素风。\n请先给方案，再执行最小可用版本，并更新项目文档。\n```\n\nAI 不是怕任务难，是怕你让它猜。\n\n## 6. 使用 AI 的实战技巧\n\n第一，先让 AI 反问你。需求不清时，不要急着让它做，先说：“请先指出缺失信息和风险，不要直接执行。”\n\n第二，把大任务拆成小任务。比如“做网站”要拆成结构、视觉、首页、登录、数据库、移动端、部署、文档。每次只让 AI 处理一块。\n\n第三，明确不要做什么。很多跑偏都不是 AI 不会，而是你没说边界。\n\n第四，让 AI 输出验收清单。比如“做完后请列出我应该检查哪些地方”。这会让结果更容易落地。\n\n第五，重要任务先要方案。涉及账号、数据、安全、费用、发布时，不要直接执行，先让 AI 写方案和风险。\n\n第六，反复沉淀项目规则。把长期规则写进 README、PROJECT_CONTEXT、CHANGELOG 或 Skill，不要每次靠口头补充。\n\n第七，经常让 AI 总结交接包。一个线程结束前，让它总结“已完成、未完成、关键决策、下一步、注意事项”，方便开新线程。\n\n## 7. AI 市场现在是什么状态\n\n截至 2026 年 6 月 14 日，AI 模型市场已经非常拥挤，不是一家独大。竞争大概分成几类：\n\n1. 通用闭源旗舰：OpenAI GPT、Anthropic Claude、Google Gemini、xAI Grok。\n2. 国内大模型与平台：Qwen/阿里百炼、DeepSeek、智谱 GLM、豆包/火山方舟、Kimi、MiniMax、腾讯混元等。\n3. 开放权重生态：Meta Llama、Mistral 等，适合本地部署、私有化和二次开发。\n4. 多模态与媒体模型：图像、视频、音频、语音、文档理解正在快速竞争。\n5. Agent 平台：不只是模型强弱，还要看工具调用、上下文管理、权限、安全、可观测性和工作流。\n\n主流模型大致可以这样理解：\n\nOpenAI：综合能力强，适合复杂推理、代码、Agent 和工具调用。官方模型文档建议复杂推理和编码从旗舰模型开始，成本和延迟敏感时选小模型。\n\nClaude：长文档、写作、代码和复杂分析很强，适合需要稳重表达和长上下文理解的任务。\n\nGemini：多模态生态强，文本、图像、语音、视频、实时能力覆盖广，适合 Google 生态和多媒体任务。\n\nDeepSeek：中文和代码场景关注度高，成本、长上下文和工具调用是常见优势点。\n\nQwen/阿里百炼：国内平台化能力强，模型种类多，文本、图像、音频、视频、向量等覆盖广。\n\nLlama：开放生态重要，适合研究、本地化、私有部署和可控环境。\n\nMistral：开源和企业模型并行，代码、Agent、文档和多模态方向都有布局。\n\nGrok：xAI 生态模型，偏通用对话、工具调用和 X 相关生态。\n\nGLM、豆包、Kimi、MiniMax、混元：国内常见选择，具体要看中文能力、上下文、价格、接口、合规和所在平台生态。\n\n## 8. 什么是“好模型”\n\n好模型不是排行榜第一，而是适合你的任务。\n\n判断模型好不好，可以看这几项：\n\n1. 准确性：在你的真实问题上是否少犯错。\n2. 指令遵循：能不能按格式、边界和角色要求输出。\n3. 长上下文：能不能读长文档、长项目、长对话而不乱。\n4. 推理能力：能不能拆复杂问题、发现矛盾、给出取舍。\n5. 工具调用：能不能稳定使用搜索、文件、代码、浏览器、数据库等工具。\n6. 代码能力：能不能读懂项目、少改错、会测试、会解释风险。\n7. 中文能力：是否符合中文表达习惯，是否能处理中文业务语境。\n8. 成本和速度：高频任务不能只看能力，也要看价格和响应时间。\n9. 稳定性：同样任务多试几次，结果是否稳定。\n10. 安全与合规：数据是否能进外部模型，是否需要本地或企业方案。\n\n最实用的方法是用自己的任务做小型盲测。选 3 到 5 个真实问题，让不同模型回答，再按准确、可用、格式、速度、成本打分。别只看网上榜单。\n\n## 9. 该怎么选 AI 和 Agent\n\n普通写作、总结、头脑风暴：选你用得顺、表达稳定的通用模型。\n\n长文档分析：优先看上下文长度、引用能力和长文稳定性。\n\n代码项目：选能读项目、会改文件、能跑检查的 Agent，比如 Codex 这类工作流工具。\n\n做 PPT、图片、视频：选有对应插件或多模态能力的工具，不要指望纯聊天模型包办所有视觉细节。注意不同模型支持多模态能力情况不同，比如 DeepSeek 的主流文本模型暂时不适合直接处理图片任务。\n\n公司知识库：优先考虑 RAG、权限、审计和数据安全，而不是一上来微调。\n\n高频低风险任务：可以用便宜快的小模型。\n\n重要决策材料：用强模型，但必须人工复核。\n\n涉及隐私、合同、客户和内部系统：先看公司规则，必要时用企业版、私有化或本地模型。\n\n## 10. 我的经验总结\n\n第一，AI 最能放大的不是懒，而是清晰。你越会表达目标、边界和验收标准，AI 越好用。可以把模糊的需求先交给对话型 AI，然后让它帮你完善。中间不认识的关键词，及时问 AI。尽量让 AI 给你多个可选的执行选项，从中挑选。\n\n第二，Agent 适合执行明确任务，不适合替你决定方向。方向、取舍、责任还是人的。\n\n第三，长项目一定要文档化。项目背景、规则、变更记录、下一步，比一次漂亮输出更重要。要有项目文档，注意事项和 Skill，更新记录文档。每次开新线程。让 AI 读取这些文档就可以。\n\n第四，别迷信单一插件技能，但是 Skill 也不是越多越好，过多 Skill 会导致上下文过长。写作、代码、图片、PPT、知识库、部署，可能需要不同工具组合。\n\n第五，缺信息就标出来。靠谱的 AI 协作不是把空白编满，而是把不确定性暴露出来。"
           },
    "en":  {
               "title":  "From Prompt to Launch: How Non-Technical People Can Use AI Agents to Amplify Execution",
               "summary":  "A practical AI Agent guide for non-technical readers, covering model basics, thread splitting, Agents, Skills, MCP, Git, model selection, and field experience.",
               "content_markdown":  "# From Prompt to Launch: How Non-Technical People Can Use AI Agents to Amplify Execution\n\n\u003e Core idea: AI does not replace people. It amplifies execution. The key is not knowing how to code, but knowing how to clarify work, describe it well, and check the result.\n\nMany people still use AI as a one-question, one-answer tool. That is useful, but the bigger productivity shift happens when you treat AI as an Agent that can help move work forward. You give it context, goals, constraints, and acceptance criteria. It helps break the task down, execute, check, and record what changed.\n\nThat is how I build my personal site. I first use GPT to turn vague ideas into positioning, page structure, visual direction, and feature scope. Then I use Codex inside the actual project. Codex reads the project files, follows rules, edits, checks, and updates records. The human still decides direction, scope, and whether the final result is acceptable.\n\nThis is not “one sentence creates a website.” The practical workflow is: humans judge, AI multiplies execution.\n\n## 1. The Basic Principle: AI Predicts the Next Token\n\nA large model can be roughly understood as predicting the next word from context. More accurately, it predicts the next token. A token can be a character, word, number, symbol, or piece of code.\n\nThis matters because it explains several AI behaviors:\n\n1. It is not all-knowing. It generates what is most likely to fit the current context.\n2. The clearer your input is, the easier it is for the model to continue in the right direction.\n3. The messier your input is, the easier it is for the model to focus on the wrong thing.\n4. If facts are missing, it may guess.\n5. When a conversation gets too long, key facts can be diluted or pushed out of context.\n\nSo the first rule of using AI is not writing magic prompts. It is managing context.\n\n## 2. Why Long Projects Need Separate Threads\n\nMany people keep one project inside one endless chat. Later, the AI becomes less stable. The reason is simple: the thread contains too much old history. Each response must decide what still matters, what is outdated, and what was only a temporary idea.\n\nMy experience is to split long projects by stage.\n\nA practical split looks like this:\n\n```text\nRequirement thread: goals, users, scope, priorities\nDesign thread: architecture, pages, flows, risks\nExecution thread: clear tasks for the Agent to perform\nBug-fix thread: symptoms, reproduction steps, expected result\nSummary thread: changes, lessons, docs, next steps\n```\n\nEvery new thread should start with a handoff package:\n\n```text\nProject background: what this project is\nCurrent state: what is done and what is missing\nGoal for this thread: what should be done now\nConstraints: what must not be changed, what rules must be followed\nRelated files: what materials the AI should read\nAcceptance criteria: what counts as finished\nOutput format: checklist, plan, code, article, or deck\n```\n\nSwitching threads is not starting over. It keeps the AI context clean.\n\n## 3. How an Agent Works\n\nThe model is like the brain. The Agent is a work role with tools.\n\nA normal chat mainly answers. An Agent can read files, call tools, run commands, open a browser, edit documents, generate images, export slides, and run checks within the permissions you give it. The loop usually looks like this:\n\n```text\nUnderstand the task -\u003e Read context -\u003e Plan steps -\u003e Use tools -\u003e Check results -\u003e Report or keep fixing\n```\n\nThat is why Codex is useful. It does not only say “you can change it this way.” It can enter the project folder, read README, PROJECT_CONTEXT, CHANGELOG, and the project Skill, then work according to existing rules.\n\nBut an Agent is not automatically reliable. It needs permissions, tools, context, and acceptance criteria. An Agent with no boundary can make simple problems complicated. An Agent with no acceptance criteria does not know whether the work is actually done.\n\n## 4. Concepts Worth Knowing\n\nLarge model: the core system that understands, reasons, and generates content. Different models are good at different tasks. Parameters, training quality, data, tools, and reasoning design all affect performance. Bigger is not always better.\n\nToken: the basic unit AI processes. Longer input and output usually mean more time and cost.\n\nContext window: the information range the AI can see right now. Outside the window, it is as if the information does not exist.\n\nPrompt: the instruction you give AI. A good prompt is a clear handoff.\n\nRAG: retrieval-augmented generation. The AI first searches specified materials, then answers from those materials. It fits company knowledge bases and document Q\u0026A.\n\nFine-tuning: training a model on specialized data so it fits a certain task better. Most small teams should first improve prompts, knowledge bases, and workflow before fine-tuning.\n\nTool Calling: letting the model call external tools, such as search, tables, files, HTTP requests, browsers, or databases.\n\nSkill: a specialized work instruction for an Agent. It packages process, rules, references, and scripts for a repeatable task, so Codex can execute more consistently. In practice, a Skill is documentation and prompt engineering: you prepare the rules before the task starts.\n\nMCP: Model Context Protocol. It is a standard way for AI to connect to external tools and context. Through MCP, Codex can reach tools such as docs, browsers, Figma, and GitHub.\n\nGit: a version control tool. It records what changed each time, making rollback, comparison, and collaboration easier.\n\nGitHub: a platform for hosting code and collaborating. A repository is the project folder, a commit is a saved change, a branch is a separate work line, and a PR is a review request before merging work back into the main line.\n\n## 5. The Prompt Formula I Use Most\n\nMy usual formula is:\n\n```text\nBackground + Goal + Current state + Constraints + Acceptance criteria + Output format + What not to do\n```\n\nA weak request looks like this:\n\n```text\nHelp me build an anonymous chat room.\n```\n\nA stronger request looks like this:\n\n```text\nI want to add a lightweight anonymous chat room to my personal site. The goal is public visitor messages.\nThe site is deployed on Cloudflare Pages and already has a D1 database.\nFor version one, only build a public room, plain text, random nickname, local nickname memory, character limit, send cooldown, and polling refresh.\nDo not build private chat, image upload, multiple rooms, or a complex admin panel.\nAcceptance criteria: messages work on mobile and desktop, messages still exist after refresh, user input cannot execute scripts, and the interface matches the current XP pixel style.\nPlease give the plan first, then build the minimum usable version and update the project docs.\n```\n\nAI is not afraid of hard work. It is afraid of guessing.\n\n## 6. Practical AI Techniques\n\nFirst, ask AI to question you before it acts. When requirements are unclear, say: “Please point out missing information and risks first. Do not execute yet.”\n\nSecond, break large work into small tasks. “Build a website” should become structure, visual design, home page, login, database, mobile view, deployment, and documentation. Ask AI to handle one piece at a time.\n\nThird, say what not to do. Many mistakes happen because the boundary was never stated.\n\nFourth, ask for an acceptance checklist. For example: “After finishing, list what I should check.” This makes the result easier to review.\n\nFifth, ask for a plan before important work. For accounts, data, security, cost, or publishing, do not execute immediately. Ask for the plan and risks first.\n\nSixth, turn long-term rules into documents. Put durable rules in README, PROJECT_CONTEXT, CHANGELOG, or Skills instead of repeating them by memory.\n\nSeventh, ask AI to summarize a handoff package often. Before a thread ends, ask for completed work, unfinished work, decisions, next steps, and cautions. The next thread will be much cleaner.\n\n## 7. The AI Market Right Now\n\nAs of June 14, 2026, the AI model market is crowded and highly competitive. It is not controlled by one company. The competition is roughly split into these groups:\n\n1. General closed flagship models: OpenAI GPT, Anthropic Claude, Google Gemini, and xAI Grok.\n2. Chinese model platforms: Qwen / Alibaba Cloud Model Studio, DeepSeek, Zhipu GLM, Doubao / Volcano Engine, Kimi, MiniMax, Tencent Hunyuan, and others.\n3. Open-weight ecosystems: Meta Llama, Mistral, and similar models for local deployment, private use, and customization.\n4. Multimodal and media models: image, video, audio, speech, and document understanding are all moving quickly.\n5. Agent platforms: model quality matters, but so do tool use, context management, permissions, safety, observability, and workflow.\n\nA simple way to read the market:\n\nOpenAI: strong general capability, complex reasoning, coding, Agent workflows, and tool use.\n\nClaude: strong at long documents, writing, code, and careful analysis.\n\nGemini: strong multimodal coverage and a broad Google ecosystem.\n\nDeepSeek: widely discussed in Chinese and coding scenarios, often valued for cost and long-context options.\n\nQwen / Alibaba Cloud Model Studio: strong platform coverage in China, with text, image, audio, video, embedding, and model service options.\n\nLlama: important open ecosystem for research, local deployment, private environments, and controllability.\n\nMistral: combines open and enterprise models, with focus areas such as code, Agents, documents, and multimodal work.\n\nGrok: a general model line from xAI, tied to its own ecosystem and tool use.\n\nGLM, Doubao, Kimi, MiniMax, and Hunyuan: common Chinese choices. Compare them by Chinese ability, context length, pricing, API access, compliance, and platform ecosystem.\n\nModel names change quickly. Do not memorize names only. Learn how to evaluate fit.\n\n## 8. What Makes a Good Model\n\nA good model is not simply the top model on a leaderboard. It is the model that fits your task.\n\nJudge models by these items:\n\n1. Accuracy: does it make fewer mistakes on your real questions?\n2. Instruction following: can it follow format, boundaries, and role requirements?\n3. Long context: can it read long documents, projects, or conversations without losing track?\n4. Reasoning: can it break down complex problems, find contradictions, and explain tradeoffs?\n5. Tool use: can it reliably use search, files, code, browser, database, or other tools?\n6. Coding ability: can it understand a project, edit carefully, test, and explain risks?\n7. Chinese ability: does it understand Chinese expression and Chinese business context?\n8. Cost and speed: frequent tasks need price and latency control.\n9. Stability: if you try the same task several times, is the result consistent?\n10. Safety and compliance: can your data go into this model, or do you need enterprise, private, or local deployment?\n\nThe most useful method is a small blind test with your own tasks. Pick three to five real questions, ask several models, then score accuracy, usability, format, speed, and cost. Do not rely only on public rankings.\n\n## 9. How to Choose AI and Agents\n\nWriting, summarizing, brainstorming: choose a general model that feels stable and easy for you to use.\n\nLong-document analysis: prioritize context length, citation behavior, and long-form stability.\n\nCode projects: choose an Agent that can read the project, edit files, and run checks, such as Codex-style workflows.\n\nSlides, images, and video: use tools with the right plugin or multimodal capability. A pure chat model should not be expected to handle every visual detail. Also check whether the model actually supports images, video, or files for your task.\n\nCompany knowledge bases: prioritize RAG, permissions, audit logs, and data safety before thinking about fine-tuning.\n\nHigh-frequency low-risk work: use smaller, faster, cheaper models.\n\nImportant decision materials: use stronger models, but always review manually.\n\nPrivacy, contracts, customers, and internal systems: follow company rules first. Use enterprise, private, or local options when needed.\n\n## 10. My Takeaways\n\nFirst, AI amplifies clarity more than laziness. The clearer your goal, boundary, and acceptance criteria are, the better AI works. You can give a vague requirement to a chat model first and ask it to help refine it. If you meet a keyword you do not understand, ask immediately. Ask for several execution options, then choose.\n\nSecond, Agents are good at executing clear tasks. They should not decide direction for you. Direction, tradeoffs, and responsibility still belong to the human.\n\nThird, long projects must become documents. Project background, rules, change logs, and next steps matter more than one beautiful answer. Keep project docs, cautions, Skills, and update logs. When a new thread starts, ask AI to read them.\n\nFourth, do not worship one plugin or one Skill. Writing, code, images, slides, knowledge bases, and deployment often need different tool combinations. But too many Skills can also overload context, so keep them focused.\n\nFifth, expose missing information. Reliable AI collaboration does not fill every blank with fiction. It makes uncertainty visible."
           },
    "ja":  {
               "title":  "質問から公開まで：普通の人が AI Agent で実行力を広げる方法",
               "summary":  "普通の読者向けに、大規模モデルの仕組み、スレッド分割、Agent、Skill、MCP、Git、モデル選び、実践経験を整理した AI Agent 活用記事です。",
               "content_markdown":  "# 質問から公開まで：普通の人が AI Agent で実行力を広げる方法\n\n\u003e 核心：AI は人を置き換えるものではなく、人の実行力を広げるものです。大事なのはコードを書けることではなく、仕事を分解し、正しく伝え、結果を確認できることです。\n\n多くの人はまだ、AI を「一問一答」の道具として使っています。それも役に立ちますが、本当に効率を変えるのは、AI を作業を前に進める Agent として使うことです。背景、目標、制約、受け入れ基準を渡すと、AI はタスクを分解し、実行し、確認し、記録する手助けをしてくれます。\n\n私が個人サイトを作る流れも同じです。まず GPT で曖昧なアイデアをサイトの位置づけ、ページ構成、ビジュアル方向、機能範囲に整理します。次に Codex を実際のプロジェクトに入れ、ファイルを読み、ルールに沿って修正、確認、記録更新を行います。最後の方向判断、範囲の取捨選択、受け入れ判断は人間が行います。\n\nこれは「一文で AI がサイトを作る」という話ではありません。実用的な流れは、人が判断し、AI が実行を増幅する、ということです。\n\n## 1. AI の基本原理：次の Token を予測している\n\n大規模モデルの回答は、ざっくり言えば「文脈から次の文字を予測する」ことです。より正確には、次の Token を予測しています。Token は文字、単語、数字、記号、コード片などです。\n\nこの理解は重要です。AI の特徴が見えてくるからです。\n\n1. AI は全知ではなく、現在の文脈に合いそうな内容を生成します。\n2. 入力が明確なほど、正しい方向に続けやすくなります。\n3. 入力が乱れているほど、重要点を取り違えやすくなります。\n4. 与えられていない事実は、推測してしまうことがあります。\n5. 会話が長くなりすぎると、重要な情報が薄まり、文脈の外に出ることがあります。\n\nつまり、AI 活用の第一原則は魔法のプロンプトではなく、文脈管理です。\n\n## 2. 長いプロジェクトをスレッド分割する理由\n\n多くの人は、一つのプロジェクトを最初から最後まで同じチャットで進めます。すると後半で AI が不安定になります。理由は単純で、古い履歴が多すぎるからです。AI は毎回、何が重要で、何が古く、何が途中案だったのかを判断しなければなりません。\n\n私の経験では、長いプロジェクトは段階ごとに分けるべきです。\n\nたとえばこう分けます。\n\n```text\n要件整理スレッド：目標、ユーザー、範囲、優先度\n設計スレッド：構成、ページ、流れ、リスク\n実行スレッド：明確なタスクを Agent に実行させる\nバグ修正スレッド：現象、再現手順、期待結果\nまとめスレッド：変更、経験、文書、次の一手\n```\n\n新しいスレッドを開くたびに、引き継ぎパックを渡します。\n\n```text\nプロジェクト背景：何のプロジェクトか\n現在の状態：完了済みと未完了\n今回の目標：今回だけで何をするか\n制約条件：変えてはいけないこと、守るルール\n関連ファイル：読むべき資料\n受け入れ基準：何ができれば完了か\n出力形式：一覧、案、コード、記事、PPT など\n```\n\nスレッドを替えるのは、最初からやり直すためではありません。AI の文脈をきれいに保つためです。\n\n## 3. Agent の動き方\n\nモデルは脳のようなものです。Agent は道具を持った作業担当者のようなものです。\n\n普通のチャットは主に回答します。Agent は許可された範囲で、ファイルを読み、ツールを呼び、コマンドを実行し、ブラウザを開き、文書を編集し、画像を作り、PPT を出力し、チェックを走らせることができます。基本的な流れはこうです。\n\n```text\nタスク理解 -\u003e 文脈読み込み -\u003e 手順作成 -\u003e ツール使用 -\u003e 結果確認 -\u003e 報告または修正継続\n```\n\nここに Codex の価値があります。Codex は「こう直せます」と言うだけではありません。プロジェクトフォルダに入り、README、PROJECT_CONTEXT、CHANGELOG、プロジェクト Skill を読み、既存ルールに沿って作業できます。\n\nただし、Agent は自動的に信頼できるわけではありません。権限、ツール、文脈、受け入れ基準が必要です。境界のない Agent は単純な問題を複雑にしがちです。受け入れ基準のない Agent は、完了したかどうかを判断できません。\n\n## 4. 知っておきたい基本概念\n\n大規模モデル：理解、推論、生成を担う中心能力です。モデルごとに得意分野は違います。パラメータ規模、学習品質、データ、ツール、推論設計が性能に影響します。大きければ必ず良いわけではありません。\n\nToken：AI が処理する基本単位です。入力や出力が長いほど、時間と費用は増えやすくなります。\n\nコンテキストウィンドウ：AI が今見られる情報範囲です。範囲外の情報は、見えていないのと同じです。\n\nPrompt：AI に渡す作業説明です。良い Prompt とは、良い引き継ぎです。\n\nRAG：検索拡張生成です。AI が指定資料を先に検索し、その資料に基づいて答えます。社内知識庫や文書 Q\u0026A に向いています。\n\n微調整：専用データでモデルを追加学習し、特定タスクに合わせる方法です。多くの小さなチームでは、まず Prompt、知識庫、作業フローを整えるほうが効果的です。\n\nTool Calling：モデルに外部ツールを呼ばせる仕組みです。検索、表、ファイル、HTTP リクエスト、ブラウザ、データベースなどを使えます。\n\nSkill：Agent 向けの専門作業手順です。ある種類のタスクについて、流れ、ルール、参考資料、スクリプトをまとめ、Codex が繰り返し安定して実行しやすくします。実務では、Skill は文書化されたプロンプトエンジニアリングです。\n\nMCP：Model Context Protocol です。AI が外部ツールや文脈につながるための標準インターフェースと考えられます。MCP により、Codex は文書、ブラウザ、Figma、GitHub などに接続できます。\n\nGit：バージョン管理ツールです。何を変更したかを記録し、戻す、比べる、共同作業することを楽にします。\n\nGitHub：コードを置き、共同作業するためのプラットフォームです。repository はプロジェクトフォルダ、commit は保存記録、branch は作業分岐、PR は main に戻す前のレビュー依頼です。\n\n## 5. 一番よく使う Prompt 公式\n\n私がよく使う形はこれです。\n\n```text\n背景 + 目標 + 現在の状態 + 制約条件 + 受け入れ基準 + 出力形式 + やらないこと\n```\n\n弱い依頼はこうです。\n\n```text\n匿名チャットを作って。\n```\n\nより良い依頼はこうです。\n\n```text\n個人サイトに軽量な匿名チャットを追加したいです。目的は訪問者が公開メッセージを残せることです。\n現在のサイトは Cloudflare Pages にデプロイされており、D1 データベースがあります。\n第一版では、公開ルーム、テキストのみ、ランダムニックネーム、ローカルでのニックネーム記憶、文字数制限、送信クールダウン、ポーリング更新だけを作ります。\n個別チャット、画像アップロード、複数ルーム、複雑な管理画面は作りません。\n受け入れ基準は、スマホと PC で送信できること、更新後もメッセージが残ること、入力がスクリプトとして実行されないこと、既存の XP ピクセル風に合うことです。\nまず案を出し、その後で最小利用可能版を実装し、プロジェクト文書も更新してください。\n```\n\nAI は難しいタスクが苦手なのではありません。推測させられるのが苦手です。\n\n## 6. AI 活用の実践テクニック\n\n第一に、先に AI に質問させます。要件が曖昧なときは、「不足情報とリスクを先に指摘し、まだ実行しないでください」と伝えます。\n\n第二に、大きな仕事を小さく分けます。「サイトを作る」は、構成、ビジュアル、ホーム、ログイン、データベース、スマホ表示、デプロイ、文書化に分けられます。一度に一つだけ任せます。\n\n第三に、やらないことを明確にします。多くのズレは、AI ができないからではなく、境界が書かれていないから起きます。\n\n第四に、受け入れチェックリストを出してもらいます。「完了後、私が確認すべき点を列挙してください」と頼むと、結果を確認しやすくなります。\n\n第五に、重要作業は先に案を出してもらいます。アカウント、データ、安全、費用、公開に関わる場合は、すぐ実行せず、案とリスクを先に出してもらいます。\n\n第六に、長期ルールを文書に残します。README、PROJECT_CONTEXT、CHANGELOG、Skill に入れておくと、毎回口頭で説明し直す必要がありません。\n\n第七に、こまめに引き継ぎパックを作らせます。スレッド終了前に、完了、未完了、重要決定、次の手順、注意点をまとめてもらうと、次のスレッドが安定します。\n\n## 7. 現在の AI 市場\n\n2026 年 6 月 14 日時点で、AI モデル市場は非常に混み合っており、一社独占ではありません。競争は大きく分けると次のようになります。\n\n1. 汎用クローズド旗艦モデル：OpenAI GPT、Anthropic Claude、Google Gemini、xAI Grok。\n2. 中国の大規模モデルと平台：Qwen / Alibaba Cloud Model Studio、DeepSeek、智譜 GLM、豆包 / 火山方舟、Kimi、MiniMax、Tencent Hunyuan など。\n3. オープンウェイトの生態系：Meta Llama、Mistral など。ローカル実行、私有化、二次開発に向いています。\n4. マルチモーダルとメディアモデル：画像、動画、音声、音声会話、文書理解が速く競争しています。\n5. Agent 平台：モデルの強さだけでなく、ツール呼び出し、文脈管理、権限、安全、観測性、ワークフローが重要です。\n\nざっくり見るとこうです。\n\nOpenAI：総合力、複雑な推論、コード、Agent、ツール利用に強い。\n\nClaude：長文書、文章作成、コード、慎重な分析に強い。\n\nGemini：マルチモーダル範囲と Google エコシステムが広い。\n\nDeepSeek：中国語とコード場面でよく注目され、コストや長文脈の選択肢として語られます。\n\nQwen / Alibaba Cloud Model Studio：中国での平台能力が強く、テキスト、画像、音声、動画、ベクトル、モデルサービスの範囲が広い。\n\nLlama：研究、ローカル化、私有環境、制御性で重要なオープン生態系。\n\nMistral：オープンモデルと企業向けモデルを併せ持ち、コード、Agent、文書、マルチモーダル領域に展開しています。\n\nGrok：xAI の汎用モデル群で、同社のエコシステムやツール利用と結びついています。\n\nGLM、豆包、Kimi、MiniMax、Hunyuan：中国でよく使われる選択肢です。中国語能力、文脈長、価格、API、コンプライアンス、平台生態系で比較します。\n\nモデル名はすぐ変わります。名前だけを覚えるより、選び方を覚えるほうが大切です。\n\n## 8. 良いモデルとは何か\n\n良いモデルとは、ランキング一位のモデルではありません。自分のタスクに合うモデルです。\n\n見るべき項目は次の通りです。\n\n1. 正確性：実際の質問で間違いが少ないか。\n2. 指示追従：形式、境界、役割を守れるか。\n3. 長文脈：長い文書、プロジェクト、会話を読んでも乱れないか。\n4. 推論能力：複雑な問題を分解し、矛盾を見つけ、取捨選択を説明できるか。\n5. ツール利用：検索、ファイル、コード、ブラウザ、データベースなどを安定して使えるか。\n6. コード能力：プロジェクトを読み、慎重に編集し、テストし、リスクを説明できるか。\n7. 中国語能力：中国語表現や業務文脈を理解できるか。\n8. 費用と速度：高頻度タスクでは能力だけでなく価格と応答速度も重要です。\n9. 安定性：同じタスクを複数回試して、結果が安定するか。\n10. 安全とコンプライアンス：そのデータを外部モデルに渡してよいか。企業版、私有化、ローカルが必要か。\n\n一番実用的なのは、自分の実タスクで小さな盲検比較をすることです。3 から 5 個の実問題を選び、複数モデルに答えさせ、正確性、使いやすさ、形式、速度、費用で採点します。公開ランキングだけに頼らないことです。\n\n## 9. AI と Agent の選び方\n\n文章作成、要約、ブレスト：自分にとって使いやすく、表現が安定した汎用モデルを選びます。\n\n長文書分析：文脈長、引用の扱い、長文での安定性を優先します。\n\nコードプロジェクト：プロジェクトを読み、ファイルを編集し、チェックを走らせられる Agent を選びます。Codex のようなワークフローが向いています。\n\nPPT、画像、動画：対応するプラグインやマルチモーダル能力を持つツールを使います。純粋なチャットモデルだけで視覚作業の細部まで任せるべきではありません。画像、動画、ファイルに対応しているかも確認します。\n\n社内知識庫：微調整より先に、RAG、権限、監査、データ安全を考えます。\n\n高頻度で低リスクの作業：速くて安い小さめのモデルで十分なことがあります。\n\n重要な意思決定資料：強いモデルを使ってよいですが、必ず人間が確認します。\n\nプライバシー、契約、顧客、社内システム：まず会社のルールを確認し、必要なら企業版、私有化、ローカルモデルを使います。\n\n## 10. 私の経験まとめ\n\n第一に、AI が一番広げるのは怠けではなく明確さです。目標、境界、受け入れ基準が明確なほど、AI は使いやすくなります。曖昧な要件はまず対話型 AI に渡し、整理してもらうとよいです。知らないキーワードが出たらすぐ聞きます。複数の実行案を出してもらい、自分で選びます。\n\n第二に、Agent は明確なタスクの実行に向いています。方向を決める役割ではありません。方向、取捨選択、責任は人間に残ります。\n\n第三に、長いプロジェクトは必ず文書化します。背景、ルール、変更記録、次の一手は、一回のきれいな回答より重要です。プロジェクト文書、注意点、Skill、更新記録を用意し、新しいスレッドでは AI にそれらを読ませます。\n\n第四に、一つのプラグインや Skill を過信しません。文章、コード、画像、PPT、知識庫、デプロイは、違う道具の組み合わせが必要なことがあります。ただし Skill が多すぎると文脈が重くなるので、絞って使います。\n\n第五に、足りない情報は明示します。信頼できる AI 協作とは、空白を作り話で埋めることではなく、不確実性を見えるようにすることです。"
           }
}, "2026-06-14T15:00:00.000Z"),
    ...aiAgentWorkflowArticleMediaStatements(env, "2026-06-14T16:20:00.000Z"),
    ...aiAgentWorkflowArticleHeadingMediaStatements(env, "2026-06-14T16:20:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-06-14-ai-agent-article", {
    "zh":  {
               "title":  "新增 AI Agent 工作赋能文章",
               "summary":  "知识库新增一篇三语 AI Agent 实战文章，整理从提问到上线的工作方法。",
               "content_markdown":  "# 新增 AI Agent 工作赋能文章\n\n本次更新在知识库发布了一篇新的 AI Agent 实战文章。\n\n## 更新内容\n\n- 新增《从提问到上线：普通人如何用 AI Agent 放大执行力》文章。\n- 文章提供中文、English、日本語三种版本。\n- 内容整理 AI 基础原理、线程拆分、Agent、Skill、MCP、Git、模型选择和实战经验。\n- 文章放入 AI 分类，方便后续继续沉淀 AI 工作流笔记。"
           },
    "en":  {
               "title":  "New AI Agent enablement article",
               "summary":  "The knowledge base now includes a trilingual AI Agent article about moving from prompt to launch.",
               "content_markdown":  "# New AI Agent Enablement Article\n\nThis update adds a practical AI Agent article to the knowledge base.\n\n## Changes\n\n- Added “From Prompt to Launch: How Non-Technical People Can Use AI Agents to Amplify Execution.”\n- Published Chinese, English, and Japanese versions.\n- Covered AI basics, thread splitting, Agents, Skills, MCP, Git, model selection, and practical experience.\n- Filed the article under the AI category for future AI workflow notes."
           },
    "ja":  {
               "title":  "AI Agent 活用記事を追加",
               "summary":  "知識庫に、質問から公開までの流れを整理した三言語の AI Agent 実践記事を追加しました。",
               "content_markdown":  "# AI Agent 活用記事を追加\n\n今回の更新では、知識庫に AI Agent の実践記事を追加しました。\n\n## 更新内容\n\n- 「質問から公開まで：普通の人が AI Agent で実行力を広げる方法」を追加しました。\n- 中国語、English、日本語の三言語版を公開しました。\n- AI の基本原理、スレッド分割、Agent、Skill、MCP、Git、モデル選び、実践経験を整理しました。\n- 今後の AI ワークフローメモを蓄積しやすいよう、AI カテゴリに配置しました。"
           }
}, "2026-06-14T15:01:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-06-14-article-reading-links", {
    "zh":  {
               "title":  "知识库文章阅读体验优化",
               "summary":  "知识库长文章窗口、正文排版、文章图片和独立文章链接完成优化。",
               "content_markdown":  "# 知识库文章阅读体验优化\n\n本次更新继续整理知识库长文阅读体验，让文章更适合分享和长时间阅读。\n\n## 更新内容\n\n- 知识库文章详情公开地址支持 `/articles/<slug>`，可以通过域名直接分享单篇文章。\n- 内部 `article_id` 只用于数据库和后台管理，不在公开链接或公开 API 中外显。\n- 长文章阅读窗口会随浏览器大小扩展，桌面端可看到更多正文内容。\n- Markdown 渲染补充有序列表、文章图片和 `text` 蓝色说明框，避免编号内容挤成一行。\n- 《从提问到上线：普通人如何用 AI Agent 放大执行力》加入 Codex 与 GPT 聊天截图，减少纯文字阅读疲劳。\n- 更新项目上下文、专用 Skill、Cloudflare Pages 重写规则和缓存版本，方便后续维护。"
           },
    "en":  {
               "title":  "Knowledge Article Reading Polish",
               "summary":  "Improved long article windows, article typography, inline images, and shareable article links.",
               "content_markdown":  "# Knowledge Article Reading Polish\n\nThis update makes long knowledge-base articles easier to read and share.\n\n## Changes\n\n- Public article detail URLs now support `/articles/<slug>` for direct sharing from the domain.\n- Internal `article_id` values stay in the database and admin workflow, not in public links or public API responses.\n- The long article window expands with the browser on desktop, showing more content at once.\n- Markdown rendering now supports ordered lists, article images, and blue `text` callout boxes, so numbered points no longer collapse into one line.\n- The AI Agent article now includes Codex and GPT chat screenshots to break up long text.\n- Project context, the site Skill, Cloudflare Pages rewrite rules, and cache versions were updated for future maintenance."
           },
    "ja":  {
               "title":  "知識庫記事の閲覧体験を改善",
               "summary":  "長文記事ウィンドウ、本文組版、記事画像、記事別共有リンクを改善しました。",
               "content_markdown":  "# 知識庫記事の閲覧体験を改善\n\n今回の更新では、知識庫の長文記事を読みやすく、共有しやすくしました。\n\n## 更新内容\n\n- 公開記事詳細 URL が `/articles/<slug>` に対応し、ドメインから単独記事を直接共有できます。\n- 内部 `article_id` はデータベースと管理作業だけで使い、公開リンクや公開 API には出しません。\n- 長文記事ウィンドウがデスクトップのブラウザサイズに合わせて広がり、一度に読める本文量が増えました。\n- Markdown 表示に番号付きリスト、記事画像、青い `text` 説明枠を追加し、番号付き内容が一行に潰れる問題を防ぎました。\n- AI Agent 記事に Codex と GPT のチャット画面を追加し、長文だけにならないようにしました。\n- 今後の保守のため、プロジェクト文脈、専用 Skill、Cloudflare Pages のリライト規則、キャッシュ版も更新しました。"
           }
}, "2026-06-14T16:20:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-06-15-clouds-docs-maintenance", {
    "zh":  {
               "title":  "四时段动态云层与维护记录补齐",
               "summary":  "首页四时段动态云层上线记录、项目文档和更新时间维护闭环完成补齐。",
               "content_markdown":  "# 四时段动态云层与维护记录补齐\n\n本次更新补齐首页动态云层和项目维护记录，让公开最近更新与实际上线内容保持一致。\n\n## 更新内容\n\n- 首页 morning / day / dusk / night 四个时段都接入无云底图和独立云层。\n- 云层按同一主风向慢速错相漂移，并保留减少动态、页面隐藏暂停和小屏降级。\n- 本地预览仍可用 `?wallpaper=morning`、`?wallpaper=day`、`?wallpaper=dusk`、`?wallpaper=night` 强制查看指定时段。\n- 补齐 README、PROJECT_CONTEXT、CHANGELOG 和项目专用 Skill 的维护说明。\n- 新增本篇 `site-updates` 三语更新文章，并同步本地 fallback 最近更新，确保首页最近更新日期来自真实更新记录。"
           },
    "en":  {
               "title":  "Time-of-day Clouds and Maintenance Log",
               "summary":  "The four home cloud layers, project docs, and site update timestamp flow are now recorded properly.",
               "content_markdown":  "# Time-of-day Clouds and Maintenance Log\n\nThis update closes the public maintenance loop for the home cloud animation and project records, so the visible recent updates match what was actually shipped.\n\n## Changes\n\n- Morning, Day, Dusk, and Night now use cloudless base images with independent cloud layers.\n- Clouds drift slowly in one main wind direction with staggered timing, plus reduced-motion, pause-on-hidden, and small-screen fallbacks.\n- Local previews still support `?wallpaper=morning`, `?wallpaper=day`, `?wallpaper=dusk`, and `?wallpaper=night`.\n- README, PROJECT_CONTEXT, CHANGELOG, and the project Skill were brought back in sync.\n- This trilingual `site-updates` article and the local fallback recent-update list were added so the home update date comes from a real update record."
           },
    "ja":  {
               "title":  "4時間帯の雲レイヤーと保守記録を補完",
               "summary":  "ホームの4時間帯雲レイヤー、プロジェクト文書、更新日時の流れを公開更新記録に反映しました。",
               "content_markdown":  "# 4時間帯の雲レイヤーと保守記録を補完\n\n今回の更新では、ホームの雲アニメーションとプロジェクト保守記録を補い、公開される最近の更新と実際の公開内容をそろえました。\n\n## 更新内容\n\n- morning / day / dusk / night の4時間帯に、無雲ベース画像と独立した雲レイヤーを接続しました。\n- 雲は同じ主風向でゆっくり時間差移動し、低モーション設定、非表示時の一時停止、小画面での降級にも対応します。\n- ローカル確認では `?wallpaper=morning`、`?wallpaper=day`、`?wallpaper=dusk`、`?wallpaper=night` で時間帯を指定できます。\n- README、PROJECT_CONTEXT、CHANGELOG、プロジェクト専用 Skill の保守説明を同期しました。\n- この三言語 `site-updates` 記事とローカル fallback の最近更新を追加し、ホームの更新日が実際の更新記録から出るようにしました。"
           }
}, "2026-06-15T05:00:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-06-15-cloud-speed-smoothness", {
      zh: {
        title: "云层漂移提速与流畅度优化",
        summary: "首页四时段云层移动小幅加快，并优化合成层提示，减少卡顿和首帧跳动。",
        content_markdown: "# 云层漂移提速与流畅度优化\n\n本次更新继续微调首页动态壁纸，让云层移动更容易被看见，同时保持慢速、像素风的桌面氛围。\n\n## 更新内容\n\n- 四个时间段的云层漂移周期小幅缩短，整体速度略微加快。\n- 云层元素增加初始 `translate3d`、`backface-visibility`、`contain` 和动画填充设置，帮助浏览器更稳定地走合成层。\n- 仍然只使用 CSS `transform` 和 `opacity`，保留减少动态、页面隐藏暂停和小屏静态降级。"
      },
      en: {
        title: "Smoother Cloud Drift",
        summary: "The home clouds now drift a little faster with compositor hints tuned for smoother frames.",
        content_markdown: "# Smoother Cloud Drift\n\nThis update keeps tuning the home wallpaper animation so the clouds are easier to notice while preserving the slow XP pixel desktop mood.\n\n## Changes\n\n- Slightly shortened the drift cycle for all four time-of-day cloud sets.\n- Added initial `translate3d`, `backface-visibility`, `contain`, and animation fill settings to help browsers keep the clouds on stable compositor layers.\n- The animation still only uses CSS `transform` and `opacity`, with reduced-motion, pause-on-hidden, and small-screen static fallbacks preserved."
      },
      ja: {
        title: "雲レイヤーの速度と滑らかさを調整",
        summary: "ホームの4時間帯の雲移動を少し速め、合成レイヤー設定で初期フレームのずれを抑えました。",
        content_markdown: "# 雲レイヤーの速度と滑らかさを調整\n\n今回の更新では、ホームの雲アニメーションを少しだけ見えやすくしながら、XP風の静かな雰囲気を保つように調整しました。\n\n## 更新内容\n\n- 4時間帯の雲レイヤーの移動周期を少し短くし、漂う速度をわずかに上げました。\n- 雲要素に初期 `translate3d`、`backface-visibility`、`contain`、アニメーションの fill 設定を追加し、合成レイヤーを安定させました。\n- CSS の `transform` と `opacity` だけで動かし、低モーション設定、ページ非表示時の一時停止、小画面での静的降級は維持しています。"
      }
    }, "2026-06-15T12:41:45.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-06-15-icons-cloud-fixes", {
      zh: {
        title: "窗口图标与云层残影修复",
        summary: "补齐窗口/任务栏图标更新记录，并修复夜晚与黄昏动态壁纸 clean 底图里的云层残影。",
        content_markdown: "# 窗口图标与云层残影修复\n\n本次更新把几项已经完成但还没有合并进公开更新文章的内容补到同一篇记录里，方便之后从知识库追踪。\n\n## 更新内容\n\n- 为知识库、视频区、资源区、游戏区、杂谈区、关于我补齐新的窗口标题栏图标和任务栏图标资源。\n- 微调分区窗口左上角标题图标的显示盒子、缩放和垂直对齐，让图标在标题文字前更清楚。\n- 修复夜晚动态壁纸 `base-clean.png` 里残留的中景云片，避免云层漂移后背景上留下分离的小云盖。\n- 同步检查 morning / day / dusk / night 四个时段：morning 和 day 没有同类残留，dusk 的淡残影也已一并清理。\n- 更新首页 CSS 缓存版本，减少浏览器继续加载旧图标样式或旧 clean 底图的可能。"
      },
      en: {
        title: "Window Icons and Cloud Cleanup",
        summary: "Added the missing icon update record and cleaned residual cloud fragments from the Night and Dusk wallpaper plates.",
        content_markdown: "# Window Icons and Cloud Cleanup\n\nThis update records a few shipped visual fixes that were not yet grouped into a public site update article.\n\n## Changes\n\n- Added new window titlebar and taskbar icon assets for Knowledge, Videos, Resources, Games, Talk, and About.\n- Tuned the section title icon box, scale, and vertical alignment so the icons read more clearly before the title text.\n- Cleaned the Night wallpaper `base-clean.png` plate so the moving mid-distance cloud no longer leaves a separated cap behind.\n- Checked all four time-of-day wallpapers: Morning and Day did not show the same issue, while a faint Dusk remnant was cleaned at the same time.\n- Updated the home CSS cache version to reduce the chance of browsers keeping older icon styles or clean plates."
      },
      ja: {
        title: "ウィンドウアイコンと雲の残影修正",
        summary: "未記録だったアイコン更新を補い、夜と夕方の壁紙ベースに残った雲の跡を修正しました。",
        content_markdown: "# ウィンドウアイコンと雲の残影修正\n\n今回の更新では、すでに反映済みだったいくつかの見た目の調整を、公開用の更新記事としてまとめて記録しました。\n\n## 更新内容\n\n- 知識庫、動画区、リソース区、ゲーム区、雑談区、About 用に、新しいウィンドウタイトルバーとタスクバーのアイコン素材を追加しました。\n- セクションタイトル左側のアイコン表示枠、拡大率、縦位置を調整し、タイトル前のアイコンを見やすくしました。\n- 夜の壁紙 `base-clean.png` に残っていた中景雲の小さな残片を修正し、雲が動いた後に背景へ切れ端が残らないようにしました。\n- morning / day / dusk / night の4時間帯を確認し、morning と day には同種の残りはなく、dusk の薄い残影も同時に消しました。\n- ホーム CSS のキャッシュ版を更新し、古いアイコン表示や古い clean ベース画像が残りにくいようにしました。"
      }
    }, "2026-06-15T13:49:12.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-06-15-home-wallpaper-gap-fix", {
      zh: {
        title: "首页底部长条修复",
        summary: "修复任务栏上方露出的绿色长条，四个时间段壁纸都会填满首页中间区域。",
        content_markdown: "# 首页底部长条修复\n\n本次更新修复首页任务栏上方偶尔露出的绿色长条，让四个时间段的桌面壁纸和任务栏衔接更干净。\n\n## 更新内容\n\n- 确认绿色长条不是 night 壁纸图片里的像素，而是外层页面草地渐变从首页底部缝隙露出。\n- 检查 morning、day、dusk、night 四个时间段，同一布局缝隙都会存在，只是白天和早晨更接近草色所以不明显。\n- 首页中间区域现在直接填满站点网格剩余高度，不再用固定像素估算顶部栏和任务栏高度。\n- 小屏分支也同步改为使用父级高度，避免移动端出现同类露底。"
      },
      en: {
        title: "Home Bottom Strip Fix",
        summary: "Fixed the green strip above the taskbar so every time-of-day wallpaper fills the home area.",
        content_markdown: "# Home Bottom Strip Fix\n\nThis update removes the green strip that could appear above the taskbar on the home screen.\n\n## Changes\n\n- Confirmed the strip was not part of the Night wallpaper image. It came from the outer page grass gradient showing through a small layout gap.\n- Checked Morning, Day, Dusk, and Night. The same gap could exist in all themes, but it was most visible at night.\n- The home page now fills the remaining site grid height instead of relying on a fixed pixel estimate for the top bar and taskbar.\n- The small-screen rule now uses the same parent-height behavior to avoid the same exposed strip on mobile."
      },
      ja: {
        title: "ホーム下部ライン修正",
        summary: "タスクバー上の緑の線を修正し、4時間帯の壁紙がホーム領域を埋めるようにしました。",
        content_markdown: "# ホーム下部ライン修正\n\n今回の更新では、ホーム画面のタスクバー上に出ることがあった緑の線を修正しました。\n\n## 更新内容\n\n- 緑の線は night 壁紙画像の一部ではなく、外側ページの草地グラデーションが小さな隙間から見えていたものだと確認しました。\n- morning、day、dusk、night の4時間帯を確認し、同じ隙間は全テーマで起こり得ますが、夜がもっとも目立っていました。\n- ホーム画面はトップバーとタスクバーの高さを固定値で推定せず、サイトのグリッド残り領域を埋めるようにしました。\n- 小画面用の分岐も同じ高さルールにそろえ、モバイルでも同種の線が出にくいようにしました。"
      }
    }, "2026-06-15T15:08:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-06-15-video-player-window-controls", {
      zh: {
        title: "视频播放器窗口交互修复",
        summary: "站内视频播放器修复了窗口全屏、原地址链接和 iframe 控制区误触问题。",
        content_markdown: "# 视频播放器窗口交互修复\n\n本次更新集中修复视频区 XP 播放器窗口，让站内窗口控制和 YouTube / Bilibili 自带控制不再互相混淆。\n\n## 更新内容\n\n- 站内“全屏”改为标题栏右上角的 XP 风格最大化按钮，可再次点击或按 Escape 还原窗口。\n- 不再优先对 iframe 执行浏览器 Fullscreen API，YouTube / Bilibili 自带全屏仍由播放器自己处理。\n- 公开视频接口继续返回真实 `original_url`，所以“打开原地址”会打开 YouTube / Bilibili 原页面，而不是空链接或 embed 地址。\n- iframe 顶部和底部信息层默认用站内遮罩收起，鼠标进入播放器区域时再露出平台控件。\n- 底部空白区域增加透明点击防护，视频卡片的播放按钮热区也收窄到按钮本身，减少误触“保存到待看”等平台按钮。"
      },
      en: {
        title: "Video Player Window Controls",
        summary: "The embedded video window now separates site window controls from YouTube and Bilibili controls.",
        content_markdown: "# Video Player Window Controls\n\nThis update fixes the XP-style video player window so site-level controls no longer fight with YouTube or Bilibili's own player controls.\n\n## Changes\n\n- The site fullscreen button is now a titlebar maximize/restore icon, and it can be toggled again or restored with Escape.\n- The site no longer fullscreen-requests the iframe first; YouTube and Bilibili native fullscreen remains inside the embedded player.\n- The public videos API keeps returning the real `original_url`, so Open Original goes to the source page instead of an empty or embed-only link.\n- The iframe top and bottom information bars are covered by the site by default and revealed when the user moves over the player area.\n- Transparent click blockers protect bottom blank areas, and video-card play buttons now only use the actual button as their hit target."
      },
      ja: {
        title: "動画プレイヤーのウィンドウ操作修正",
        summary: "サイト側の動画ウィンドウ操作と YouTube / Bilibili 側の操作が混ざらないように調整しました。",
        content_markdown: "# 動画プレイヤーのウィンドウ操作修正\n\n今回の更新では、動画欄の XP 風プレイヤーウィンドウを調整し、サイト側のウィンドウ操作と YouTube / Bilibili のプレイヤー操作が混ざらないようにしました。\n\n## 更新内容\n\n- サイト内の「全画面」は、タイトルバー右上の XP 風の最大化/復元ボタンに変更しました。もう一度クリックするか Escape で元に戻せます。\n- iframe を優先してブラウザ全画面にしないようにし、YouTube / Bilibili の全画面はプレイヤー側に任せます。\n- 公開動画 API は実際の `original_url` を返し続け、「元のページを開く」が YouTube / Bilibili の元ページへ移動するようにしています。\n- iframe 上部と下部の情報バーは通常はサイト側のマスクで隠し、プレイヤー付近にマウスを置いた時だけ見えるようにしました。\n- 下部の空白部分には透明のクリック保護を置き、動画カードの再生ボタンもボタン本体だけが反応するようにして、プラットフォーム側ボタンの誤触を減らしました。"
      }
    }, "2026-06-15T15:30:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-06-15-video-management-sort-metadata", {
      zh: {
        title: "视频管理排序与 B 站信息修复",
        summary: "修复 Bilibili 元数据兜底、视频排序、统一卡片尺寸和首页视频入口文案。",
        content_markdown: "# 视频管理排序与 B 站信息修复\n\n本次更新继续修复视频区和后台视频管理，让新视频更容易排在前面，Bilibili 链接也能尽量补齐公开信息。\n\n## 更新内容\n\n- Bilibili 元数据抓取增加页面 meta、结构化数据和更多页面状态兜底，遇到接口 412 时也会尽量补齐标题、简介、作者、发布时间和封面。\n- 视频列表改为置顶优先，未置顶视频按排序值从大到小显示；后台新建视频默认使用当前最大排序 + 10。\n- 视频分类管理使用同样的排序语义，默认新建分类也会自动追加 +10，并避免默认分类 seed 覆盖后台维护过的排序和启用状态。\n- 主站视频卡片统一高度，封面按钮清除默认内边距并让图片完全铺满，缺少封面时显示同尺寸像素风占位卡。\n- 视频播放器的“打开原地址”保持真实外链，并兼容旧 fallback 数据；首页视频区入口去掉“待定”文案。"
      },
      en: {
        title: "Video Sorting and Bilibili Metadata Fixes",
        summary: "Improved Bilibili metadata fallback, video ordering, card sizing, and the home Videos label.",
        content_markdown: "# Video Sorting and Bilibili Metadata Fixes\n\nThis update tightens the managed video workflow so newer videos can stay at the front and Bilibili links keep more of their public metadata.\n\n## Changes\n\n- Bilibili metadata now falls back to page meta tags, structured data, and broader page-state parsing when the API returns HTTP 412.\n- Video lists keep pinned items first, then sort unpinned videos by higher sort values first; new admin videos default to the current max sort + 10.\n- Video categories use the same sort meaning, new categories also default to +10, and default category seeds no longer overwrite admin-managed sort/enabled values.\n- Public video cards now share one stable height, thumbnails remove button padding and fully cover their frame, and missing thumbnails use a same-size pixel placeholder.\n- Open Original remains a real source link, including old fallback data, and the home Videos icon no longer says TBD."
      },
      ja: {
        title: "動画管理の並び順と Bilibili 情報取得を修正",
        summary: "Bilibili メタ情報の補完、動画の並び順、カードサイズ、ホームの動画ラベルを調整しました。",
        content_markdown: "# 動画管理の並び順と Bilibili 情報取得を修正\n\n今回の更新では、動画欄と管理画面の動画管理を続けて調整し、新しい動画を前に出しやすくし、Bilibili リンクの公開情報もできるだけ補えるようにしました。\n\n## 更新内容\n\n- Bilibili API が HTTP 412 を返した場合も、ページ meta、構造化データ、ページ状態からタイトル、概要、作者、公開時刻、サムネイルをできるだけ補完します。\n- 動画一覧は固定表示を最優先し、その下で並び順の数値が大きいものほど前に表示します。管理画面の新規動画は現在の最大値 +10 を初期値にします。\n- 動画分類も同じ並び順の意味にそろえ、新規分類も +10 で追加します。既定分類の seed は管理画面で変更した並び順と有効状態を上書きしません。\n- 公開側の動画カードは高さを統一し、サムネイル画像は余白なく枠いっぱいに表示します。サムネイルがない場合も同じサイズのピクセル風プレースホルダーを表示します。\n- 「元のページを開く」は実際の外部リンクとして維持し、ホームの動画アイコンから「未定」表記を外しました。"
      }
    }, "2026-06-15T16:20:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-06-16-mobile-admin-video-fixes", {
      zh: {
        title: "移动端与后台视频维护修复",
        summary: "修复视频分类标签回退、B 站元数据抓取提示和主站视频/资源/登录弹窗的手机端适配。",
        content_markdown: "# 移动端与后台视频维护修复\n\n本次更新继续打磨视频区和后台管理，让手机端浏览和后台维护更稳定。\n\n## 更新内容\n\n- 默认视频分类 seed 改为只插入缺失分类，不再覆盖后台已经改过的分类名称。\n- Bilibili 元数据抓取移除不必要的 Origin 请求头，增加详情接口、移动页和新版页面数据兜底；URL 没变时保存视频不再反复抓外部元数据。\n- 后台视频识别失败时会提示“播放器地址已生成，可手动补全标题、作者和封面”，并增加重复视频提示。\n- 视频列表、资源区、登录弹窗、登录成功提示和视频播放窗口补齐手机端换行、单列和防溢出规则。\n- 后台视频分类勾选区会标识停用分类，避免新视频继续误选停用标签。"
      },
      en: {
        title: "Mobile and Admin Video Maintenance Fixes",
        summary: "Fixed video category rollback, Bilibili metadata handling, and mobile layout for videos, resources, and login popovers.",
        content_markdown: "# Mobile and Admin Video Maintenance Fixes\n\nThis update continues polishing the videos area and admin workflow so mobile browsing and video maintenance feel steadier.\n\n## Changes\n\n- Default video category seeds now only insert missing categories, so admin-edited category names are no longer overwritten.\n- Bilibili metadata fetching removes the unnecessary Origin header and adds detail API, mobile-page, and newer page-data fallbacks; unchanged video URLs no longer refetch metadata on every save.\n- Admin video recognition now explains when the player URL was generated but metadata needs manual title, author, or thumbnail entry, and duplicate videos are blocked with a clear message.\n- The videos list, resources area, login popover, signed-in account message, and video player window now have stronger mobile wrapping, single-column, and overflow protection.\n- Disabled video categories are marked in the admin checkbox list so new videos are less likely to reuse disabled tags."
      },
      ja: {
        title: "モバイル表示と動画管理を修正",
        summary: "動画カテゴリ名の戻り、Bilibili メタ情報取得、動画・リソース・ログイン周りのモバイル表示を調整しました。",
        content_markdown: "# モバイル表示と動画管理を修正\n\n今回の更新では、動画欄と管理画面を続けて調整し、スマートフォンでの閲覧と動画メンテナンスを安定させました。\n\n## 更新内容\n\n- 既定の動画カテゴリ seed は不足分だけを追加するようにし、管理画面で変更したカテゴリ名を上書きしないようにしました。\n- Bilibili メタ情報取得では不要な Origin ヘッダーを外し、詳細 API、モバイルページ、新しいページデータの補完を追加しました。URL が変わらない保存では外部メタ情報を毎回取り直しません。\n- 管理画面では、プレイヤー URL は生成できたがタイトル・作者・サムネイルを手入力する必要がある場合を分かりやすく表示し、重複動画も明確に止めます。\n- 動画一覧、リソース欄、ログインポップオーバー、ログイン済み表示、動画再生ウィンドウにモバイル向けの折り返し、単列、防溢出ルールを追加しました。\n- 管理画面の動画カテゴリ選択では停止中カテゴリを表示し、新しい動画で誤って再利用しにくくしました。"
      }
    }, "2026-06-16T02:20:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-06-16-responsive-video-window", {
      zh: {
        title: "视频区窗口自适应放大",
        summary: "视频区列表窗口会跟随屏幕可用高度放大，减少桌面底部空白并显示更多视频卡片。",
        content_markdown: "# 视频区窗口自适应放大\n\n本次更新调整主站视频区列表窗口，让它在桌面端更充分利用屏幕高度。\n\n## 更新内容\n\n- 视频区 XP 窗口不再被固定的 760px 高度上限限制，而是按当前浏览器可用高度计算。\n- 宽屏桌面端窗口宽度略微放大，让三列视频卡片更舒展。\n- 视频列表内部继续滚动，标题栏、分类筛选和卡片安全渲染逻辑保持不变。\n- 手机端仍使用原有小屏断点，保持单列布局和防横向溢出规则。"
      },
      en: {
        title: "Responsive Video Window",
        summary: "The videos window now grows with available screen height, reducing empty desktop space and showing more cards.",
        content_markdown: "# Responsive Video Window\n\nThis update lets the main videos window use more of the available desktop screen.\n\n## Changes\n\n- The videos XP window is no longer capped by the old 760px height limit and now follows the browser's available height.\n- Wide desktop screens get a slightly wider window so the three-column video cards have more room.\n- The video list still scrolls inside the window, with the titlebar, filters, and safe card rendering unchanged.\n- Mobile keeps the existing small-screen breakpoint, single-column layout, and overflow protection."
      },
      ja: {
        title: "動画欄ウィンドウの自動拡大",
        summary: "動画欄のウィンドウが画面の高さに合わせて広がり、下部の空白を減らしてより多くのカードを表示します。",
        content_markdown: "# 動画欄ウィンドウの自動拡大\n\n今回の更新では、メインサイトの動画欄ウィンドウがデスクトップ画面をより広く使えるようにしました。\n\n## 更新内容\n\n- 動画欄の XP ウィンドウは従来の 760px 上限に固定されず、ブラウザの利用可能な高さに合わせて伸びます。\n- ワイドなデスクトップ画面ではウィンドウ幅も少し広げ、3列の動画カードに余裕を持たせました。\n- 動画一覧は引き続きウィンドウ内でスクロールし、タイトルバー、カテゴリ絞り込み、安全なカード描画はそのままです。\n- モバイルでは既存の小画面ブレークポイントを維持し、単列表示と横方向のはみ出し防止を保っています。"
      }
    }, "2026-06-16T02:40:13.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-06-16-video-card-category-icon-fixes", {
      zh: {
        title: "视频卡片与分类持久化修复",
        summary: "视频卡片减少下方空白，视频分类删除和排序会被保留，聊天室桌面图标也稍微缩小。",
        content_markdown: "# 视频卡片与分类持久化修复\n\n本次更新继续修复视频区和首页桌面图标的细节，让显示更紧凑，后台维护结果也更稳定。\n\n## 更新内容\n\n- 主站视频卡片缩短整体高度，并压缩封面、正文和按钮间距，减少卡片下方无用空白。\n- 视频分类默认 seed 改为首次建表初始化，之后不再把后台已经删除的默认标签补回来，也不影响后台排序。\n- 构建检查新增公开视频接口路径，避免视频 schema guard 的运行时问题漏检。\n- 首页匿名聊天室桌面图标略微缩小，并和名称保留更多间距。"
      },
      en: {
        title: "Video Card and Category Persistence Fixes",
        summary: "Video cards are more compact, deleted or reordered video categories stay intact, and the chatroom desktop icon is slightly smaller.",
        content_markdown: "# Video Card and Category Persistence Fixes\n\nThis update continues tightening the videos area and desktop icons so the public page is cleaner and admin-managed data stays stable.\n\n## Changes\n\n- Public video cards now use a shorter fixed height with tighter thumbnail, text, and button spacing to remove unnecessary lower blank space.\n- Default video category seeds now run only during first table creation, so deleted default tags are not restored and admin ordering is preserved.\n- The build check now exercises the public videos API path so video schema guard problems are less likely to slip through.\n- The anonymous chatroom desktop icon is slightly smaller and leaves clearer spacing above its label."
      },
      ja: {
        title: "動画カードとカテゴリ保持の修正",
        summary: "動画カードをコンパクトにし、削除・並べ替えた動画カテゴリを保持し、チャットルームのデスクトップアイコンも少し小さくしました。",
        content_markdown: "# 動画カードとカテゴリ保持の修正\n\n今回の更新では、動画欄とホームのデスクトップアイコンをさらに調整し、表示をコンパクトにしつつ、管理画面の変更が戻らないようにしました。\n\n## 更新内容\n\n- 公開側の動画カードは固定高さを短くし、サムネイル、本文、ボタンの間隔を詰めて下部の不要な余白を減らしました。\n- 既定の動画カテゴリ seed は初回テーブル作成時だけ動くようにし、削除済みの既定タグを戻さず、管理画面の並び順も保持します。\n- ビルドチェックで公開動画 API の経路も確認し、動画 schema guard の実行時問題を見落としにくくしました。\n- 匿名チャットルームのデスクトップアイコンを少し小さくし、ラベルとの間隔を確保しました。"
      }
    }, "2026-06-16T08:20:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-06-17-knowledge-search", {
      zh: {
        title: "知识库本地搜索上线",
        summary: "知识库顶部新增本地搜索，可按标题、简介、分类和标签快速过滤文章。",
        content_markdown: "# 知识库本地搜索上线\n\n本次更新给主站知识库增加了轻量搜索条，方便在文章和网站更新记录越来越多时快速定位内容。\n\n## 更新内容\n\n- 知识库窗口顶部新增搜索框，可按文章标题、简介、分类、slug 和标签即时过滤。\n- 搜索结果会显示当前命中数量，清空按钮可以一键恢复完整列表。\n- 搜索文案同步维护中文、English、日本語，切换语言后会更新标签、占位提示和结果数量。\n- 手机端搜索条会自动换行，继续保持无横向溢出。\n- 文章详情、直链、Markdown 安全渲染和聊天室纯文本规则保持不变。"
      },
      en: {
        title: "Knowledge Search Added",
        summary: "The knowledge base now has local search across titles, summaries, categories, and tags.",
        content_markdown: "# Knowledge Search Added\n\nThis update adds a lightweight search bar to the public knowledge base so articles and site update logs are easier to find as the archive grows.\n\n## Changes\n\n- The knowledge window now has a search field that filters by article title, summary, category, slug, and tags instantly in the browser.\n- Result text shows the current match count, and the clear button restores the full list in one click.\n- Search labels, placeholders, and count text are maintained in Chinese, English, and Japanese.\n- The mobile search bar wraps cleanly and keeps the page free of horizontal overflow.\n- Article detail links, Markdown safe rendering, and chatroom plain-text rules are unchanged."
      },
      ja: {
        title: "知識庫検索を追加",
        summary: "知識庫に、タイトル・概要・分類・タグで絞り込めるローカル検索を追加しました。",
        content_markdown: "# 知識庫検索を追加\n\n今回の更新では、記事とサイト更新記録が増えても探しやすいように、公開側の知識庫へ軽量な検索バーを追加しました。\n\n## 更新内容\n\n- 知識庫ウィンドウ上部に検索欄を追加し、記事タイトル、概要、分類、slug、タグをブラウザ内で即時に絞り込めます。\n- 結果件数を表示し、クリアボタンで一覧全体にすぐ戻せます。\n- 検索ラベル、プレースホルダー、件数表示は中文、English、日本語で同期しています。\n- モバイルでは検索バーが自然に折り返し、横方向にはみ出さないようにしました。\n- 記事詳細リンク、Markdown の安全描画、チャットルームの純テキスト表示ルールはそのままです。"
      }
    }, "2026-06-17T15:25:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-06-17-article-share-link", {
      zh: {
        title: "文章详情复制链接",
        summary: "知识库文章详情新增复制直链按钮，便于分享当前语言的文章页面。",
        content_markdown: "# 文章详情复制链接\n\n本次更新继续打磨知识库阅读体验，让文章详情页更适合分享和回访。\n\n## 更新内容\n\n- 文章详情头部新增“复制文章链接”按钮，会生成当前文章的直链。\n- 复制链接会保留当前语言参数，中文、English、日本語 页面都能分享对应语言视图。\n- 成功和失败提示均使用三语文案，并通过安全 DOM 文本更新。\n- 手机端按钮和提示会自然换行，避免文章页横向溢出。"
      },
      en: {
        title: "Article Link Copy",
        summary: "Knowledge article pages now include a copy-link button for sharing the current language view.",
        content_markdown: "# Article Link Copy\n\nThis update keeps improving the knowledge reading flow so article detail pages are easier to share and revisit.\n\n## Changes\n\n- Article detail headers now include a copy-link button that creates a direct URL for the current article.\n- The copied link keeps the current language parameter, so Chinese, English, and Japanese views can be shared directly.\n- Success and failure messages are maintained in all three languages and update through safe DOM text.\n- On mobile, the button and status text wrap cleanly without horizontal overflow."
      },
      ja: {
        title: "記事リンクコピー",
        summary: "知識庫の記事詳細に、現在の言語表示を共有しやすいリンクコピーボタンを追加しました。",
        content_markdown: "# 記事リンクコピー\n\n今回の更新では、知識庫の記事詳細ページを共有しやすくするため、読み物まわりの操作を少し整えました。\n\n## 更新内容\n\n- 記事詳細のヘッダーに、現在の記事の直リンクをコピーするボタンを追加しました。\n- コピーされるリンクには現在の言語パラメータが含まれ、中文、English、日本語の表示をそのまま共有できます。\n- 成功・失敗メッセージは三言語で用意し、安全な DOM テキストとして更新します。\n- モバイルではボタンと状態表示が自然に折り返し、横方向にはみ出さないようにしました。"
      }
    }, "2026-06-17T15:40:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-06-17-video-empty-state", {
      zh: {
        title: "视频区空状态增强",
        summary: "视频区没有公开视频时，会显示 XP 风格提示并提供网站更新入口。",
        content_markdown: "# 视频区空状态增强\n\n本次更新给主站视频区补上更清晰的空状态，让没有公开视频或筛选无结果时也不显得像页面坏掉了。\n\n## 更新内容\n\n- 视频区无公开视频时显示 XP 风格提示卡片，说明视频内容正在整理中。\n- 筛选到空分类时会提示换分类或查看网站更新记录。\n- 空状态按钮会跳转到知识库的网站更新记录分类，方便继续浏览施工进度。\n- 手机端空状态改为单列布局，保持视频区无横向溢出。\n- 已有视频卡片、播放窗口、公开 API 和后台视频数据不受影响。"
      },
      en: {
        title: "Video Empty State",
        summary: "The videos area now shows an XP-style empty state with a shortcut to site updates when no videos are published.",
        content_markdown: "# Video Empty State\n\nThis update adds a clearer empty state to the public videos area, so the page still feels intentional when no videos are published or a filter has no results.\n\n## Changes\n\n- When no public videos are available, the videos area now shows an XP-style message card explaining that the archive is being organized.\n- Empty filtered categories suggest trying another category or checking site updates.\n- The empty-state button opens the knowledge base site update category so visitors can keep browsing recent build notes.\n- On mobile, the empty state switches to a single-column layout and keeps the videos area free of horizontal overflow.\n- Existing video cards, the playback window, public API behavior, and admin-managed video data are unchanged."
      },
      ja: {
        title: "動画欄の空状態を改善",
        summary: "公開動画がない場合、動画欄に XP 風の空状態とサイト更新記録への入口を表示します。",
        content_markdown: "# 動画欄の空状態を改善\n\n今回の更新では、公開動画がない場合やフィルター結果が空の場合でも、動画欄が壊れて見えないように空状態を整えました。\n\n## 更新内容\n\n- 公開動画がないとき、動画を整理中であることを伝える XP 風の案内カードを表示します。\n- 空のカテゴリを選んだ場合は、別カテゴリまたはサイト更新記録を見る案内を出します。\n- 空状態ボタンから、知識庫のサイト更新記録カテゴリへ移動できます。\n- モバイルでは空状態を一列にし、動画欄が横方向にはみ出さないようにしました。\n- 既存の動画カード、再生ウィンドウ、公開 API、管理画面の動画データには影響しません。"
      }
    }, "2026-06-17T15:53:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-06-17-route-aware-welcome", {
      zh: {
        title: "文章直链不再弹欢迎窗",
        summary: "首次打开文章或其他非首页直链时，不再自动弹出欢迎窗口遮挡内容。",
        content_markdown: "# 文章直链不再弹欢迎窗\n\n本次更新修复文章详情直链的首次访问体验，让链接打开后直接看到目标内容。\n\n## 更新内容\n\n- 首次打开文章详情、知识库、视频区等非首页直链时，不再自动弹出欢迎窗口遮挡内容。\n- 首页首次访问仍保留欢迎窗口，用于展示快捷入口和最近更新。\n- `?welcome=0` 继续禁用欢迎窗，`?welcome=1` 可显式触发欢迎窗，方便人工检查。\n- 文章详情、搜索、视频区、聊天室和游戏区路由逻辑保持不变。"
      },
      en: {
        title: "Cleaner Article Deep Links",
        summary: "Article and non-home deep links no longer auto-open the welcome modal over the content.",
        content_markdown: "# Cleaner Article Deep Links\n\nThis update fixes the first-visit experience for article detail URLs so deep links open directly on the target content.\n\n## Changes\n\n- Article detail, knowledge, videos, and other non-home deep links no longer auto-open the welcome modal over the page content.\n- First visits to the home page still keep the welcome modal for quick links and recent updates.\n- `?welcome=0` still disables the modal, while `?welcome=1` can explicitly open it for manual checks.\n- Article detail, search, videos, chatroom, and games route behavior is otherwise unchanged."
      },
      ja: {
        title: "記事直リンクを読みやすく",
        summary: "記事やホーム以外の直リンクでは、歓迎ウィンドウが内容を隠さないようにしました。",
        content_markdown: "# 記事直リンクを読みやすく\n\n今回の更新では、記事詳細への直リンクを初めて開いたときも、目的の記事をすぐ読めるようにしました。\n\n## 更新内容\n\n- 記事詳細、知識庫、動画欄などホーム以外の直リンクでは、歓迎ウィンドウを自動表示しません。\n- ホームの初回訪問では、快捷入口と最近の更新を案内する歓迎ウィンドウを引き続き表示します。\n- `?welcome=0` は引き続き歓迎ウィンドウを無効化し、`?welcome=1` で明示的に表示できます。\n- 記事詳細、検索、動画欄、チャット、ゲーム区のルート処理はそのままです。"
      }
    }, "2026-06-17T16:02:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-06-18-resource-actions", {
      zh: {
        title: "资源区占位按钮修复",
        summary: "资源区没有真实下载或外链时显示准备中按钮，不再使用无效 # 链接。",
        content_markdown: "# 资源区占位按钮修复\n\n本次更新整理了主站资源区的占位卡片，让还没有真实下载或外链的资源不会表现得像可点击链接。\n\n## 更新内容\n\n- 资源卡片没有真实 URL 时，动作按钮显示“准备中”并进入禁用态。\n- 后续资源配置补上真实 `http(s)`、`assets/` 或 `downloads/` 地址后，仍会显示下载或外链按钮。\n- 资源卡片改为使用 DOM 和 `textContent` 构建，减少未来接入动态资源数据时的 XSS 风险。\n- 右上角最近更新日期改为按用户本地日期计算，避免北京时间 00:00 后发布的更新仍显示前一天。\n- 中文、English、日本語 的按钮文案和移动端布局同步维护。"
      },
      en: {
        title: "Resource Placeholder Buttons",
        summary: "Resource cards without real download or external URLs now show a coming-soon button instead of a dead # link.",
        content_markdown: "# Resource Placeholder Buttons\n\nThis update tidies the public resources area so placeholder cards without real downloads or external URLs no longer behave like clickable dead links.\n\n## Changes\n\n- Resource cards without a real URL now show a disabled coming-soon action.\n- When a future resource gets a real `http(s)`, `assets/`, or `downloads/` URL, the card still renders a download or external-link button.\n- Resource cards now render through DOM nodes and `textContent`, reducing XSS risk if resource data becomes dynamic later.\n- The top-right latest update date now uses the viewer's local date, so updates published after midnight in China no longer show the previous UTC day.\n- Chinese, English, and Japanese button text and mobile layout behavior are maintained together."
      },
      ja: {
        title: "リソース準備中ボタン",
        summary: "実際のダウンロードや外部リンクがないリソースは、無効な # リンクではなく準備中ボタンを表示します。",
        content_markdown: "# リソース準備中ボタン\n\n今回の更新では、公開側のリソース欄を整理し、実際のダウンロードや外部リンクがないカードが無効なリンクのように見えないようにしました。\n\n## 更新内容\n\n- 実際の URL がないリソースカードは、「準備中」の無効ボタンを表示します。\n- 今後 `http(s)`、`assets/`、`downloads/` の実リンクを設定すると、ダウンロードまたは外部リンクボタンとして表示されます。\n- リソースカードは DOM と `textContent` で構築するようにし、将来リソースデータを動的化する場合の XSS リスクを下げました。\n- 右上の最新更新日は閲覧者のローカル日付で計算し、中国時間 00:00 以降の更新が UTC の前日表示にならないようにしました。\n- 中文、English、日本語 のボタン文言とモバイル表示を合わせて維持しています。"
      }
    }, "2026-06-17T16:09:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-06-18-nav-active-state", {
      zh: {
        title: "导航当前态增强",
        summary: "底部任务栏和首页 Start 按钮会标记当前页面，并同步 aria-current。",
        content_markdown: "# 导航当前态增强\n\n本次更新继续打磨 XP 桌面导航反馈，让当前打开的页面更容易识别。\n\n## 更新内容\n\n- 底部任务栏按钮继续跟随当前 route 高亮，并同步 `aria-current=\"page\"`。\n- 首页 Start 按钮在桌面首页时显示更明确的当前态。\n- 首页桌面图标同步 `aria-pressed` 状态，便于键盘和辅助技术识别。\n- 路由、文章直链、聊天室轮询、视频窗口和游戏入口行为保持不变。"
      },
      en: {
        title: "Active Navigation State",
        summary: "The taskbar and Start button now mark the current page and keep aria-current in sync.",
        content_markdown: "# Active Navigation State\n\nThis update refines the XP desktop navigation feedback so the currently open page is easier to identify.\n\n## Changes\n\n- Taskbar buttons continue to highlight the current route and now keep `aria-current=\"page\"` in sync.\n- The Start button now shows a clearer active state when the desktop home page is open.\n- Desktop icons keep `aria-pressed` synchronized for keyboard and assistive technology users.\n- Routing, article deep links, chat polling, video windows, and game entry behavior are unchanged."
      },
      ja: {
        title: "ナビ現在状態を強化",
        summary: "タスクバーと Start ボタンが現在ページを示し、aria-current も同期します。",
        content_markdown: "# ナビ現在状態を強化\n\n今回の更新では、XP デスクトップ風のナビゲーション表示を整え、現在開いているページを分かりやすくしました。\n\n## 更新内容\n\n- タスクバーのボタンは現在 route のハイライトを維持し、`aria-current=\"page\"` も同期します。\n- ホーム画面では Start ボタンに、より分かりやすい現在状態を表示します。\n- デスクトップアイコンは `aria-pressed` を同期し、キーボード操作や支援技術でも状態を把握しやすくしました。\n- ルート処理、記事直リンク、チャットの更新、動画ウィンドウ、ゲーム入口の動作はそのままです。"
      }
    }, "2026-06-17T16:18:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-06-18-blog-placeholders", {
      zh: {
        title: "杂谈区占位按钮修复",
        summary: "杂谈区没有真实文章入口时显示整理中按钮，并改用安全 DOM 渲染。",
        content_markdown: "# 杂谈区占位按钮修复\n\n本次更新整理了主站杂谈区的占位卡片，避免还没有文章详情时出现没有效果的阅读按钮。\n\n## 更新内容\n\n- 杂谈区卡片没有真实文章入口时，动作按钮显示“整理中”并进入禁用态。\n- 杂谈区卡片改为使用 DOM 和 `textContent` 构建，减少未来接入动态杂谈数据时的 XSS 风险。\n- 中文、English、日本語 的按钮文案同步维护。\n- 知识库文章系统、文章直链和现有首页导航行为保持不变。"
      },
      en: {
        title: "Talk Placeholder Buttons",
        summary: "Talk cards without article targets now show a drafting button and render through safe DOM nodes.",
        content_markdown: "# Talk Placeholder Buttons\n\nThis update tidies the public Talk area so placeholder cards without article detail targets no longer show a read button that does nothing.\n\n## Changes\n\n- Talk cards without a real article target now show a disabled drafting action.\n- Talk cards now render through DOM nodes and `textContent`, reducing XSS risk if talk data becomes dynamic later.\n- Chinese, English, and Japanese button text are maintained together.\n- The knowledge article system, article deep links, and existing home navigation behavior are unchanged."
      },
      ja: {
        title: "雑談の準備中ボタン",
        summary: "実際の記事リンクがない雑談カードは準備中ボタンを表示し、安全な DOM 描画にしました。",
        content_markdown: "# 雑談の準備中ボタン\n\n今回の更新では、公開側の雑談欄を整理し、記事詳細がまだないカードに効果のない読むボタンを出さないようにしました。\n\n## 更新内容\n\n- 実際の記事入口がない雑談カードは、「準備中」の無効ボタンを表示します。\n- 雑談カードは DOM と `textContent` で構築するようにし、将来データを動的化する場合の XSS リスクを下げました。\n- 中文、English、日本語 のボタン文言を合わせて維持しています。\n- 知識庫の記事システム、記事直リンク、既存のホームナビゲーション動作はそのままです。"
      }
    }, "2026-06-17T16:23:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-06-18-language-url-sync", {
      zh: {
        title: "语言链接参数同步",
        summary: "切换语言时会同步地址栏 lang 参数，复制当前页面链接不再带旧语言。",
        content_markdown: "# 语言链接参数同步\n\n本次更新修正了主站三语切换后的链接状态，让地址栏和页面语言保持一致。\n\n## 更新内容\n\n- 点击中文 / English / 日本語 语言按钮时，地址栏 `lang=` 参数会同步更新为当前语言。\n- 主站窗口路由跳转会保留当前查询参数并刷新 `lang=`，复制当前页面链接时不再带旧语言。\n- 语言切换只使用 `replaceState` 更新当前地址，不额外制造浏览历史层级。\n- 知识库文章、视频区、聊天室和游戏入口继续使用现有公开渲染逻辑，不影响后台接口。"
      },
      en: {
        title: "Language URL Sync",
        summary: "Language switching now updates the address bar lang parameter so copied page links keep the current language.",
        content_markdown: "# Language URL Sync\n\nThis update keeps the address bar in sync with the current language after switching between the three site languages.\n\n## Changes\n\n- Clicking Chinese / English / Japanese now updates the `lang=` parameter in the address bar.\n- Public route changes preserve the current query parameters and refresh `lang=`, so copied page links no longer carry an old language.\n- Language switching uses `replaceState`, so it updates the current URL without adding extra browser history entries.\n- Knowledge articles, videos, chat room, and game entries continue using the existing public rendering paths, with no admin API changes."
      },
      ja: {
        title: "言語URL同期",
        summary: "言語切り替え時にアドレスバーの lang パラメータを同期し、コピーしたリンクが現在の言語を保ちます。",
        content_markdown: "# 言語URL同期\n\n今回の更新では、三言語を切り替えた後もアドレスバーと表示言語がずれないようにしました。\n\n## 更新内容\n\n- 中文 / English / 日本語 の言語ボタンを押すと、アドレスバーの `lang=` パラメータも現在の言語に更新します。\n- 公開ページのルート移動では現在のクエリパラメータを保ちつつ `lang=` を更新し、コピーしたリンクが古い言語を持たないようにしました。\n- 言語切り替えは `replaceState` で現在の URL だけを更新し、余分な履歴を増やしません。\n- 知識庫の記事、動画欄、チャット、ゲーム入口は既存の公開描画ロジックを使い、管理 API には触れていません。"
      }
    }, "2026-06-17T16:41:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-06-18-article-detail-search-hide", {
      zh: {
        title: "文章详情搜索条隐藏修复",
        summary: "知识库文章详情页会隐藏顶部搜索条，让阅读区更专注。",
        content_markdown: "# 文章详情搜索条隐藏修复\n\n本次更新修正了知识库文章详情页顶部仍显示搜索条的问题，让阅读页更像独立文章窗口。\n\n## 更新内容\n\n- 打开文章详情或文章直链时，知识库搜索条会真正隐藏，不再占用详情顶部空间。\n- 为 `.knowledge-searchbar[hidden]`、`.content-list[hidden]` 和 `.article-detail[hidden]` 补充明确隐藏规则，避免组件 display 样式覆盖 HTML `hidden` 状态。\n- 返回文章列表后，搜索条会按原逻辑恢复，知识库本地搜索功能不受影响。\n- 只调整公开主站 CSS 和更新记录，不触碰后台目录或管理接口。"
      },
      en: {
        title: "Article Detail Search Hide",
        summary: "Knowledge article detail pages now hide the top search bar so the reading area stays focused.",
        content_markdown: "# Article Detail Search Hide\n\nThis update fixes the knowledge article detail view so the search bar no longer stays visible above the article body.\n\n## Changes\n\n- Opening an article detail page or deep link now fully hides the knowledge search bar.\n- Explicit hidden-state rules were added for `.knowledge-searchbar[hidden]`, `.content-list[hidden]`, and `.article-detail[hidden]` so component display styles cannot override HTML `hidden` state.\n- Returning to the article list restores the search bar through the existing logic, so local knowledge search still works.\n- Only the public site CSS and update records changed; admin folders and admin APIs were not touched."
      },
      ja: {
        title: "記事詳細の検索バー非表示",
        summary: "知識庫の記事詳細では上部検索バーを隠し、読みやすい表示にしました。",
        content_markdown: "# 記事詳細の検索バー非表示\n\n今回の更新では、知識庫の記事詳細で検索バーが本文の上に残ってしまう表示を修正しました。\n\n## 更新内容\n\n- 記事詳細または記事直リンクを開いたとき、知識庫検索バーを完全に非表示にします。\n- `.knowledge-searchbar[hidden]`、`.content-list[hidden]`、`.article-detail[hidden]` に明示的な非表示ルールを追加し、コンポーネント側の display 指定が HTML の `hidden` 状態を上書きしないようにしました。\n- 記事一覧へ戻ると既存ロジックで検索バーが復帰し、知識庫のローカル検索はそのまま使えます。\n- 公開側の CSS と更新記録だけを調整し、管理画面ディレクトリや管理 API には触れていません。"
      }
    }, "2026-06-17T16:50:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-06-18-trilingual-tags", {
      zh: {
        title: "标签三语显示",
        summary: "文章列表、文章详情和杂谈卡片的常见标签会跟随三语切换显示。",
        content_markdown: "# 标签三语显示\n\n本次更新继续整理主站公开阅读体验，让文章和杂谈卡片里的常见标签跟随当前语言显示。\n\n## 更新内容\n\n- 文章列表、文章详情和杂谈卡片的常见中文 seed 标签会显示为当前语言标签。\n- 知识库本地搜索会同时匹配原始标签和当前语言标签，方便用 English / 日本語 搜索标签词。\n- 标签仍通过安全 DOM / `textContent` 或已有 HTML escape 渲染，不引入动态脚本执行风险。\n- 只调整公开主站渲染和更新记录，不触碰后台目录或管理接口。"
      },
      en: {
        title: "Trilingual Tag Labels",
        summary: "Common tags on article lists, article details, and talk cards now follow the site language switch.",
        content_markdown: "# Trilingual Tag Labels\n\nThis update keeps common article and talk tags aligned with the active public site language.\n\n## Changes\n\n- Common Chinese seed tags on article cards, article details, and talk cards now render in the current language.\n- Local knowledge search matches both the original tag text and the current-language tag label, so English and Japanese tag terms can still be used.\n- Tags continue to render through safe DOM / `textContent` or existing HTML escaping, without adding script execution risk.\n- Only public site rendering and update records changed; admin folders and admin APIs were not touched."
      },
      ja: {
        title: "タグ三言語表示",
        summary: "記事一覧、記事詳細、雑談カードの主なタグがサイト言語に合わせて表示されます。",
        content_markdown: "# タグ三言語表示\n\n今回の更新では、公開側の記事と雑談カードの主なタグを現在の言語に合わせて表示するようにしました。\n\n## 更新内容\n\n- 記事カード、記事詳細、雑談カードの主な中国語 seed タグを現在の言語ラベルで表示します。\n- 知識庫のローカル検索は元のタグ文字列と現在言語のタグラベルの両方に一致し、English / 日本語 のタグ語でも検索できます。\n- タグは引き続き安全な DOM / `textContent` または既存の HTML escape で描画し、スクリプト実行リスクは増やしません。\n- 公開側の描画と更新記録だけを調整し、管理画面ディレクトリや管理 API には触れていません。"
      }
    }, "2026-06-17T16:56:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-06-18-image-loading-polish", {
      zh: {
        title: "图片加载细节优化",
        summary: "首屏外头像和文章配图补充懒加载与异步解码，阅读体验更平滑。",
        content_markdown: "# 图片加载细节优化\n\n本次更新对公开主站的非关键图片加载做小幅整理，优先减少首屏外图片对加载和解码路径的影响。\n\n## 更新内容\n\n- 聊天室头像和关于页头像补充 `loading=\"lazy\"` 与 `decoding=\"async\"`，只在需要显示对应窗口时再参与加载。\n- 文章 Markdown 配图继续使用 `assets/images/articles/` 白名单和安全 DOM 渲染，同时补充异步解码。\n- 首屏品牌图标和开始按钮图标保持原加载方式，避免影响首页视觉信号。\n- 只调整公开主站图片属性、fallback 更新和公开文章 seed，不触碰后台目录或管理接口。"
      },
      en: {
        title: "Image Loading Polish",
        summary: "Off-screen avatars and article images now use lazy loading and async decoding for smoother reading.",
        content_markdown: "# Image Loading Polish\n\nThis update makes a small pass over non-critical public site images so off-screen assets put less pressure on the initial load and decode path.\n\n## Changes\n\n- The chatroom avatar and about-page avatar now use `loading=\"lazy\"` and `decoding=\"async\"`, so they load closer to when their windows are opened.\n- Markdown article images still use the `assets/images/articles/` whitelist and safe DOM rendering, with async decoding added.\n- First-screen brand and Start button icons keep their current loading behavior so the home screen remains immediate.\n- Only public site image attributes, fallback updates, and public article seeds changed; admin folders and admin APIs were not touched."
      },
      ja: {
        title: "画像読み込みの調整",
        summary: "初期表示外のアバターと記事画像に遅延読み込みと非同期デコードを追加しました。",
        content_markdown: "# 画像読み込みの調整\n\n今回の更新では、公開側の重要度が低い画像読み込みを少し整理し、初期表示外の画像が読み込みとデコードに与える負荷を抑えました。\n\n## 更新内容\n\n- チャットルームのアバターとプロフィール画像に `loading=\"lazy\"` と `decoding=\"async\"` を追加し、対応するウィンドウを開くタイミングに近づけて読み込みます。\n- Markdown 記事画像は引き続き `assets/images/articles/` の許可リストと安全な DOM 描画を使い、非同期デコードも追加しました。\n- ホームのブランドアイコンと Start ボタン画像は現在の読み込み方式を維持し、初期表示の見え方を保ちます。\n- 公開側の画像属性、fallback 更新、公開記事 seed のみを調整し、管理画面ディレクトリや管理 API には触れていません。"
      }
    }, "2026-06-17T17:06:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-06-18-chatroom-title-locale", {
      zh: {
        title: "聊天室标题三语同步",
        summary: "聊天室窗口标题现在会跟随中文、English、日本語 切换。",
        content_markdown: "# 聊天室标题三语同步\n\n本次更新修复公开聊天室窗口标题的多语言细节，让它和页面里的其它聊天室文案保持一致。\n\n## 更新内容\n\n- English 界面下，聊天室窗口标题从中文“匿名聊天室”改为 `Chat Room`。\n- 日本語界面下，聊天室窗口标题从中文“匿名聊天室”改为 `匿名チャット`。\n- 聊天消息列表、昵称、轮询和发送逻辑不变，继续使用安全 DOM / `textContent` 渲染公开文本。\n- 只调整公开主站翻译和更新记录，不触碰后台目录或管理接口。"
      },
      en: {
        title: "Chat Title Localization",
        summary: "The chat room window title now follows the Chinese, English, and Japanese language switch.",
        content_markdown: "# Chat Title Localization\n\nThis update fixes a small localization gap in the public chat room window title so it matches the rest of the chat UI.\n\n## Changes\n\n- In English, the chat room window title now shows `Chat Room` instead of the Chinese title.\n- In Japanese, the chat room window title now shows `匿名チャット` instead of the Chinese title.\n- Chat messages, nicknames, polling, and sending behavior are unchanged and continue to render public text through safe DOM / `textContent` paths.\n- Only public site translations and update records changed; admin folders and admin APIs were not touched."
      },
      ja: {
        title: "チャット題名の多言語同期",
        summary: "チャットルームのウィンドウ題名が中文、English、日本語の切り替えに合わせて表示されます。",
        content_markdown: "# チャット題名の多言語同期\n\n今回の更新では、公開チャットルームのウィンドウ題名に残っていた翻訳漏れを修正し、ほかのチャット文言と揃えました。\n\n## 更新内容\n\n- English 表示では、チャットルームのウィンドウ題名を中国語のままではなく `Chat Room` と表示します。\n- 日本語表示では、チャットルームのウィンドウ題名を中国語のままではなく `匿名チャット` と表示します。\n- チャットメッセージ、ニックネーム、ポーリング、送信処理は変更せず、公開テキストは引き続き安全な DOM / `textContent` 経路で描画します。\n- 公開側の翻訳と更新記録だけを調整し、管理画面ディレクトリや管理 API には触れていません。"
      }
    }, "2026-06-17T17:16:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-06-18-aria-label-localization", {
      zh: {
        title: "无障碍标签三语同步",
        summary: "品牌、语言切换、桌面图标区和关闭按钮的 aria-label 会跟随当前语言更新。",
        content_markdown: "# 无障碍标签三语同步\n\n本次更新把公开主站的无障碍标签也纳入语言切换，让键盘和读屏用户听到的控件名称更一致。\n\n## 更新内容\n\n- 新增 `data-i18n-aria-label` 与 `data-i18n-title` 同步逻辑，复用现有三语翻译表。\n- 品牌返回按钮、语言切换区域、桌面图标区域和各类关闭按钮补充当前语言的 `aria-label`。\n- 视频窗口最大化按钮继续使用已有 `videoFullscreen` / `videoRestore` 文案动态更新。\n- 只调整公开主站 HTML / JS 与更新记录，不触碰后台目录或管理接口。"
      },
      en: {
        title: "Localized ARIA Labels",
        summary: "Brand, language switcher, desktop icon group, and close-button aria labels now follow the active language.",
        content_markdown: "# Localized ARIA Labels\n\nThis update brings public site accessibility labels into the language-switching path, so keyboard and screen-reader users get control names in the active language.\n\n## Changes\n\n- Added `data-i18n-aria-label` and `data-i18n-title` synchronization using the existing trilingual translation table.\n- The brand home button, language switcher, desktop icon group, and close buttons now receive active-language `aria-label` text.\n- The video window maximize button keeps using the existing dynamic `videoFullscreen` / `videoRestore` labels.\n- Only public site HTML / JS and update records changed; admin folders and admin APIs were not touched."
      },
      ja: {
        title: "ARIAラベルの多言語同期",
        summary: "ブランド、言語切り替え、デスクトップアイコン領域、閉じるボタンの aria-label が現在の言語に合わせて変わります。",
        content_markdown: "# ARIAラベルの多言語同期\n\n今回の更新では、公開サイトのアクセシビリティラベルも言語切り替えの対象にし、キーボード操作や読み上げで聞こえる名前を現在の言語に揃えました。\n\n## 更新内容\n\n- 既存の三言語翻訳表を使う `data-i18n-aria-label` と `data-i18n-title` の同期処理を追加しました。\n- ブランドのホームボタン、言語切り替え、デスクトップアイコン領域、各種閉じるボタンに現在言語の `aria-label` を設定します。\n- 動画ウィンドウの最大化ボタンは、既存の `videoFullscreen` / `videoRestore` 文言による動的更新を維持します。\n- 公開側の HTML / JS と更新記録だけを調整し、管理画面ディレクトリや管理 API には触れていません。"
      }
    }, "2026-06-17T17:22:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-06-18-account-widget-locale", {
      zh: {
        title: "账号弹窗三语同步",
        summary: "顶部账号/云存档弹窗的登录、注册、邮箱和云存档说明会跟随当前语言显示。",
        content_markdown: "# 账号弹窗三语同步\n\n本次更新继续整理公开主站的三语体验，把顶部账号/云存档弹窗里的静态文案接入当前语言。\n\n## 更新内容\n\n- 登录、注册、邮箱、密码、云存档说明、退出账号和本地状态提示改为中文 / English / 日本語 文案。\n- 用户切换语言时会重新渲染账号控件，避免弹窗保留上一种语言的静态文字。\n- 邮箱、后端错误信息和动态提示继续通过 `escapeHtml` 输出，避免外部文本被当作 HTML 执行。\n- 只调整公开主站账号弹窗渲染和更新记录，不触碰后台目录或管理接口。"
      },
      en: {
        title: "Account Popover Localization",
        summary: "The account and cloud-save popover now localizes login, register, email, and cloud-save copy.",
        content_markdown: "# Account Popover Localization\n\nThis update continues the public site's trilingual polish by moving static account and cloud-save popover copy into the active language.\n\n## Changes\n\n- Login, register, email, password, cloud-save notes, sign-out, and local status messages now have Chinese, English, and Japanese copy.\n- Switching languages re-renders the account widget so the popover does not keep stale static text.\n- Email addresses, backend error messages, and dynamic notices still pass through `escapeHtml`, so external text is not executed as HTML.\n- Only public site account popover rendering and update records changed; admin folders and admin APIs were not touched."
      },
      ja: {
        title: "アカウント表示の多言語同期",
        summary: "アカウントとクラウドセーブのポップオーバー文言が現在の言語に合わせて表示されます。",
        content_markdown: "# アカウント表示の多言語同期\n\n今回の更新では、公開サイトの三言語体験を整えるため、上部のアカウント / クラウドセーブ表示の固定文言を現在の言語に接続しました。\n\n## 更新内容\n\n- ログイン、登録、メール、パスワード、クラウドセーブ説明、ログアウト、ローカル状態メッセージを中文 / English / 日本語で用意しました。\n- 言語を切り替えたときにアカウントウィジェットを再描画し、ポップオーバーに前の言語の固定文言が残らないようにしました。\n- メールアドレス、バックエンドのエラーメッセージ、動的通知は引き続き `escapeHtml` を通し、外部テキストを HTML として実行しません。\n- 公開側のアカウント表示と更新記録だけを調整し、管理画面ディレクトリや管理 API には触れていません。"
      }
    }, "2026-06-17T17:28:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-06-18-notepad-menu-locale", {
      zh: {
        title: "杂谈菜单三语同步",
        summary: "杂谈区 Notepad 风格菜单现在会跟随当前语言显示。",
        content_markdown: "# 杂谈菜单三语同步\n\n本次更新修正杂谈区顶部 Notepad 风格菜单的静态语言，让它和杂谈区标题、卡片按钮一起跟随站点语言切换。\n\n## 更新内容\n\n- 中文界面显示 `文件  编辑  查看  帮助`。\n- English 界面继续显示 `File  Edit  View  Help`。\n- 日本語界面显示 `ファイル  編集  表示  ヘルプ`。\n- 只调整公开主站静态菜单文案和更新记录，不改杂谈卡片 DOM / `textContent` 安全渲染逻辑。"
      },
      en: {
        title: "Talk Menu Localization",
        summary: "The Talk area Notepad-style menu now follows the active site language.",
        content_markdown: "# Talk Menu Localization\n\nThis update fixes the static language on the Talk area's Notepad-style menu so it follows the site language with the rest of the Talk window.\n\n## Changes\n\n- Chinese shows `文件  编辑  查看  帮助`.\n- English keeps `File  Edit  View  Help`.\n- Japanese shows `ファイル  編集  表示  ヘルプ`.\n- Only public site static menu copy and update records changed; the Talk card DOM / `textContent` safe rendering path was not changed."
      },
      ja: {
        title: "雑談メニューの多言語同期",
        summary: "雑談欄の Notepad 風メニューが現在のサイト言語に合わせて表示されます。",
        content_markdown: "# 雑談メニューの多言語同期\n\n今回の更新では、雑談欄上部の Notepad 風メニューに残っていた固定言語を修正し、雑談ウィンドウのほかの文言と同じようにサイト言語へ合わせました。\n\n## 更新内容\n\n- 中文表示では `文件  编辑  查看  帮助` を表示します。\n- English 表示では `File  Edit  View  Help` を維持します。\n- 日本語表示では `ファイル  編集  表示  ヘルプ` を表示します。\n- 公開側の静的メニュー文言と更新記録だけを調整し、雑談カードの DOM / `textContent` 安全描画経路は変更していません。"
      }
    }, "2026-06-17T17:33:00.000Z"),
    env.DB.prepare(`
      delete from articles
      where article_id in ('seed-xp-site-notes', 'seed-local-ai-workflow', 'seed-fallback-check')
    `)
  ];
}

async function seedArticleTestData(env) {
  if (articleSeedReady) {
    return;
  }
  await env.DB.batch(articleSeedStatements(env));
  articleSeedReady = true;
}

async function ensureVisitorProfile(env, request, visitorId, body = {}, incrementVisit = false) {
  const now = nowIso();
  const geo = await requestIpInfo(request, env, "analytics");
  const userAgent = normalizeAnalyticsText(request.headers.get("User-Agent"), 500);
  const language = normalizeAnalyticsText(body.language || request.headers.get("Accept-Language"), 160);
  await env.DB.prepare(`
    insert into site_visitors (
      visitor_id, first_seen_at, last_seen_at, visit_count, ip_hash, ip_prefix,
      country, region, city, timezone, colo, latitude, longitude, user_agent, language
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    on conflict(visitor_id)
    do update set
      last_seen_at = excluded.last_seen_at,
      visit_count = site_visitors.visit_count + excluded.visit_count,
      ip_hash = excluded.ip_hash,
      ip_prefix = excluded.ip_prefix,
      country = excluded.country,
      region = excluded.region,
      city = excluded.city,
      timezone = excluded.timezone,
      colo = excluded.colo,
      latitude = excluded.latitude,
      longitude = excluded.longitude,
      user_agent = excluded.user_agent,
      language = excluded.language
  `).bind(
    visitorId,
    now,
    now,
    incrementVisit ? 1 : 0,
    geo.ipHash,
    geo.ipPrefix,
    geo.country,
    geo.region,
    geo.city,
    geo.timezone,
    geo.colo,
    geo.latitude,
    geo.longitude,
    userAgent,
    language
  ).run();
}

async function analyticsIdentityForRequest(request, env) {
  const cookieIdentity = getOrCreateVisitorIdentity(request);
  const session = await getSession(request, env);
  if (!session?.user?.id) {
    return { visitorId: cookieIdentity.visitorId, cookieIdentity, user: null };
  }
  return {
    visitorId: await stableAccountVisitorId(session.user.id),
    cookieIdentity,
    user: session.user
  };
}

async function stableAccountVisitorId(userId) {
  const hash = await sha256Hex(`analytics-account:${userId}`);
  return `acct_${hash.slice(0, 32)}`;
}

async function recordUserLoginEvent(env, request, user, eventType = "login") {
  await ensureCoreSchema(env);
  const now = nowIso();
  const geo = await requestIpInfo(request, env, "analytics");
  const cookieIdentity = getOrCreateVisitorIdentity(request);
  await env.DB.prepare(`
    insert into user_login_events (
      event_id, user_id, email, event_type, visitor_id, ip_hash, ip_prefix,
      country, region, city, timezone, colo, user_agent, created_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    crypto.randomUUID(),
    user.id,
    normalizeEmail(user.email),
    normalizeAnalyticsText(eventType, 40) || "login",
    cookieIdentity.visitorId,
    geo.ipHash,
    geo.ipPrefix,
    geo.country,
    geo.region,
    geo.city,
    geo.timezone,
    geo.colo,
    normalizeAnalyticsText(request.headers.get("User-Agent"), 500),
    now
  ).run();
}

function adminAccountRow(row) {
  return {
    id: row.id,
    email: row.email,
    role: row.role || "user",
    created_at: row.created_at,
    updated_at: row.updated_at,
    last_login_at: row.last_login_at || row.last_session_at || "",
    active_sessions: Number(row.active_sessions || 0),
    login_count: Number(row.login_count || 0),
    save_slots: Number(row.save_slots || 0),
    password_status: passwordStatusLabel(row.password_hash),
    password_visible: false,
    password_note: "密码只保存加密结果，后台不能查看原文；需要时可直接设置新密码。"
  };
}

function adminLoginEventRow(row) {
  return {
    event_type: row.event_type || "login",
    created_at: row.created_at,
    ip_prefix: row.ip_prefix || "",
    country: row.country || "",
    region: row.region || "",
    city: row.city || "",
    timezone: row.timezone || "",
    colo: row.colo || "",
    user_agent: row.user_agent || "",
    visitor_id: row.visitor_id || ""
  };
}

function adminAccountActivityRow(row) {
  return {
    type: row.type || "",
    created_at: row.created_at,
    path: row.path || "",
    route: row.route || "",
    detail: row.detail || "",
    country: row.country || "",
    region: row.region || "",
    city: row.city || "",
    ip_prefix: row.ip_prefix || ""
  };
}

function passwordStatusLabel(value) {
  return String(value || "").startsWith("pbkdf2_sha256$")
    ? "已加密保存"
    : "旧格式或未知";
}

function getOrCreateVisitorIdentity(request) {
  const existing = readCookie(request, VISITOR_COOKIE);
  if (isValidHiddenVisitorId(existing)) {
    return { visitorId: existing, isNew: false };
  }
  return { visitorId: `vis_${randomToken(18)}`, isNew: true };
}

function withVisitorCookie(response, request, identity) {
  if (identity?.visitorId) {
    response.headers.append("Set-Cookie", visitorCookieValue(identity.visitorId, request));
  }
  return response;
}

function visitorCookieValue(value, request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${VISITOR_COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${VISITOR_DAYS * 24 * 60 * 60}${secure}`;
}

function isValidHiddenVisitorId(value) {
  return /^vis_[a-zA-Z0-9_-]{16,80}$/.test(String(value || ""));
}

async function readOptionalJson(request) {
  if (!request.headers.get("Content-Type")?.includes("application/json")) {
    return {};
  }
  try {
    return await request.json();
  } catch {
    return {};
  }
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    throw new HttpError("请求内容不是有效 JSON。", 400);
  }
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function validateEmail(email) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new HttpError("请输入有效邮箱。", 400);
  }
}

function validatePassword(password) {
  if (password.length < 8 || password.length > 128) {
    throw new HttpError("密码至少 8 位，最多 128 位。", 400);
  }
}

function normalizeAccountRole(value) {
  const role = String(value || "user").trim().toLowerCase();
  if (!["user", "admin"].includes(role)) {
    throw new HttpError("账号角色只能是 user 或 admin。", 400);
  }
  return role;
}

function validateGameId(gameId) {
  if (!isValidGameId(gameId)) {
    throw new HttpError("游戏编号不正确。", 400);
  }
}

function isValidGameId(gameId) {
  return /^[a-z0-9-]{1,80}$/.test(gameId);
}

function normalizeArticleLang(value) {
  return ["zh", "en", "ja"].includes(value) ? value : "zh";
}

function normalizeSlug(value) {
  const slug = String(value || "").trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{0,119}$/.test(slug)) {
    throw new HttpError("文章 slug 只能包含小写字母、数字和连字符，最多 120 个字符。", 400);
  }
  return slug;
}

function normalizeArticleStatus(value) {
  const status = String(value || "draft").trim();
  if (!["draft", "published", "archived"].includes(status)) {
    throw new HttpError("文章状态只能是 draft / published / archived。", 400);
  }
  return status;
}

function normalizeVideoStatus(value) {
  const status = String(value || "draft").trim();
  if (!["draft", "published", "hidden"].includes(status)) {
    throw new HttpError("视频状态只能是 draft / published / hidden。", 400);
  }
  return status;
}

function normalizeRequiredText(value, maxLength, message) {
  const text = String(value || "").trim();
  if (!text) {
    throw new HttpError(message, 400);
  }
  if (Array.from(text).length > maxLength) {
    throw new HttpError(`文本最多 ${maxLength} 个字符。`, 400);
  }
  return text;
}

function normalizeOptionalText(value, maxLength) {
  const text = String(value || "").trim();
  if (Array.from(text).length > maxLength) {
    throw new HttpError(`文本最多 ${maxLength} 个字符。`, 400);
  }
  return text;
}

function normalizeOptionalDateTime(value) {
  const raw = normalizeOptionalText(value, 80);
  if (!raw) {
    return null;
  }
  let normalized = raw;
  if (/^\d{4}\.\d{2}\.\d{2}$/.test(normalized)) {
    normalized = normalized.replace(/^(\d{4})\.(\d{2})\.(\d{2})$/, "$1-$2-$3T00:00:00Z");
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    normalized = `${normalized}T00:00:00Z`;
  } else {
    normalized = normalized.replace(" ", "T");
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?$/.test(normalized)) {
      normalized = `${normalized}Z`;
    }
  }
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    throw new HttpError("发布时间格式不正确，请使用 ISO 时间。", 400);
  }
  return date.toISOString();
}

function normalizeThumbnailUrl(value) {
  const raw = normalizeOptionalText(value, MAX_VIDEO_THUMBNAIL_TEXT_CHARS);
  if (!raw) {
    return "";
  }
  if (/^data:/i.test(raw)) {
    return normalizeThumbnailDataUrl(raw);
  }
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new HttpError("封面地址格式不正确。", 400);
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const allowed = new Set([
    "i.ytimg.com",
    "img.youtube.com",
    "i0.hdslb.com",
    "i1.hdslb.com",
    "i2.hdslb.com",
    "archive.biliimg.com"
  ]);
  if (url.protocol !== "https:" || !allowed.has(host)) {
    throw new HttpError("封面地址只允许 YouTube / Bilibili 图片域名，或后台上传的本地封面。", 400);
  }
  return url.toString();
}

function normalizeThumbnailDataUrl(raw) {
  const match = String(raw || "").match(/^data:image\/([a-z0-9.+-]+);base64,([A-Za-z0-9+/]+={0,2})$/i);
  if (!match) {
    throw new HttpError("本地封面数据格式不正确。", 400);
  }
  const mime = match[1].toLowerCase() === "jpg" ? "jpeg" : match[1].toLowerCase();
  if (!LOCAL_THUMBNAIL_MIME_TYPES.has(mime)) {
    throw new HttpError("本地封面只支持 JPG、PNG、WEBP 或 AVIF。", 400);
  }
  const base64 = match[2];
  if (base64.length % 4 === 1) {
    throw new HttpError("本地封面数据格式不正确。", 400);
  }
  const padding = base64.endsWith("==") ? 2 : (base64.endsWith("=") ? 1 : 0);
  const byteLength = Math.floor((base64.length * 3) / 4) - padding;
  if (byteLength > MAX_LOCAL_THUMBNAIL_BYTES) {
    throw new HttpError("本地封面过大，请重新上传更小的图片。", 400);
  }
  return `data:image/${mime};base64,${base64}`;
}

function normalizeAnalyticsText(value, maxLength) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return Array.from(text).slice(0, maxLength).join("");
}

function normalizeAnalyticsPath(value) {
  const text = normalizeAnalyticsText(value, 500) || "/";
  if (/^(https?:|data:|javascript:)/i.test(text)) {
    return "/";
  }
  return text.startsWith("/") ? text : `/${text}`;
}

function normalizeInteger(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return 0;
  }
  return Math.min(Math.max(Math.round(number), min), max);
}

function normalizeSortOrder(value, fallback = 0) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return normalizeInteger(fallback, -100000, 100000);
  }
  return normalizeInteger(value, -100000, 100000);
}

function normalizeRecordId(value, message) {
  const text = String(value || "").trim();
  if (!/^[a-zA-Z0-9_.:-]{1,180}$/.test(text)) {
    throw new HttpError(message, 400);
  }
  return text;
}

function normalizeIpHash(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(text)) {
    throw new HttpError("IP hash 不正确。", 400);
  }
  return text;
}

function normalizeTags(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((tag) => String(tag || "").trim())
    .filter(Boolean)
    .slice(0, 12)
    .map((tag) => Array.from(tag).slice(0, 40).join(""));
}

function clampLimit(value, max) {
  const limit = Number(value || max);
  if (!Number.isFinite(limit) || limit < 1) {
    return max;
  }
  return Math.min(Math.floor(limit), max);
}

function normalizeVisitorId(value) {
  const visitorId = String(value || "").trim();
  if (!/^[a-zA-Z0-9_.:-]{8,96}$/.test(visitorId)) {
    throw new HttpError("访客编号不正确。", 400);
  }
  return visitorId;
}

function normalizeChatNickname(value) {
  const nickname = String(value || "").trim();
  if (!isValidChatNicknameLength(nickname)) {
    throw new HttpError("昵称需要 2-16 个字符，不能是空白。", 400);
  }
  return nickname;
}

function isValidChatNicknameLength(value) {
  const length = Array.from(String(value || "").trim()).length;
  return length >= 2 && length <= MAX_CHAT_NICKNAME_CHARS;
}

function normalizeChatContent(value) {
  const content = String(value || "").trim();
  const length = Array.from(content).length;
  if (!content) {
    throw new HttpError("空消息不可发送。", 400);
  }
  if (length > MAX_CHAT_MESSAGE_CHARS) {
    throw new HttpError("单条消息最多 300 字。", 400);
  }
  return content;
}

function chatMessageId(date) {
  return `${date.getTime().toString(36)}-${randomToken(9)}`;
}

async function requestIpHash(request, env) {
  return (await requestIpInfo(request, env, "chat")).ipHash;
}

async function requestIpInfo(request, env, purpose = "analytics") {
  const ip = requestIp(request);
  const salt = purpose === "chat"
    ? (env.CHAT_IP_HASH_SALT || "lusu-chat")
    : (env.ANALYTICS_IP_HASH_SALT || env.CHAT_IP_HASH_SALT || "lusu-analytics");
  const cf = request.cf || {};
  const latitude = Number(cf.latitude);
  const longitude = Number(cf.longitude);
  return {
    ipHash: await sha256Hex(`${salt}:${ip}`),
    ipPrefix: maskIp(ip),
    country: normalizeAnalyticsText(cf.country || request.headers.get("CF-IPCountry"), 80),
    region: normalizeAnalyticsText(cf.region || cf.regionCode, 120),
    city: normalizeAnalyticsText(cf.city, 120),
    timezone: normalizeAnalyticsText(cf.timezone, 120),
    colo: normalizeAnalyticsText(cf.colo, 20),
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null
  };
}

function requestIp(request) {
  return request.headers.get("CF-Connecting-IP")
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "unknown";
}

function maskIp(ip) {
  const value = String(ip || "");
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(value)) {
    const parts = value.split(".");
    return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
  }
  if (value.includes(":")) {
    return `${value.split(":").slice(0, 4).join(":")}::/64`;
  }
  return "";
}

function fillDailySeries(rows, since, days) {
  const map = new Map(rows.map((row) => [row.day, row]));
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(since.getTime() + index * 24 * 60 * 60 * 1000);
    const day = date.toISOString().slice(0, 10);
    const row = map.get(day);
    return {
      day,
      pv: Number(row?.pv || 0),
      uv: Number(row?.uv || 0)
    };
  });
}

async function hashPassword(password) {
  const salt = randomToken(16);
  const iterations = PASSWORD_HASH_ITERATIONS;
  const key = await crypto.subtle.importKey("raw", textBytes(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: base64urlToBytes(salt), iterations, hash: "SHA-256" },
    key,
    256
  );
  return `pbkdf2_sha256$${iterations}$${salt}$${bytesToBase64url(new Uint8Array(bits))}`;
}

async function verifyPassword(password, stored) {
  const [scheme, iterationText, salt, expected] = String(stored || "").split("$");
  if (scheme !== "pbkdf2_sha256") {
    return false;
  }
  const iterations = Number(iterationText);
  if (!Number.isFinite(iterations) || iterations < 10000) {
    return false;
  }
  const key = await crypto.subtle.importKey("raw", textBytes(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: base64urlToBytes(salt), iterations, hash: "SHA-256" },
    key,
    256
  );
  return timingSafeEqual(bytesToBase64url(new Uint8Array(bits)), expected);
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", textBytes(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function randomToken(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToBase64url(bytes);
}

function bytesToBase64url(bytes) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64urlToBytes(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

function textBytes(value) {
  return new TextEncoder().encode(value);
}

function readCookie(request, name) {
  const cookie = request.headers.get("Cookie") || "";
  return cookie.split(";").map((item) => item.trim()).reduce((found, item) => {
    if (found) {
      return found;
    }
    const [key, ...rest] = item.split("=");
    return key === name ? decodeURIComponent(rest.join("=")) : "";
  }, "");
}

function cookieValue(value, request, maxAge) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

function nowIso() {
  return new Date().toISOString();
}

class HttpError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}
