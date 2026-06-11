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
let coreSchemaReady = false;
let chatSchemaReady = false;
let articleSchemaReady = false;

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
      return health(env);
    }
    if (request.method === "POST" && parts[0] === "auth" && parts[1] === "register") {
      return register(request, env);
    }
    if (request.method === "POST" && parts[0] === "auth" && parts[1] === "login") {
      return login(request, env);
    }
    if (request.method === "POST" && parts[0] === "auth" && parts[1] === "logout") {
      return logout(request, env);
    }
    if (request.method === "GET" && parts[0] === "auth" && parts[1] === "me") {
      return me(request, env);
    }
    if (parts[0] === "chat" && parts[1] === "messages") {
      if (request.method === "GET") {
        return getChatMessages(request, env);
      }
      if (request.method === "POST") {
        return postChatMessage(request, env);
      }
    }
    if (request.method === "GET" && parts[0] === "chat" && parts[1] === "nickname") {
      return getChatNickname(env);
    }
    if (parts[0] === "articles") {
      await ensureArticleSchema(env);
      await seedArticleTestData(env);
      if (request.method === "GET" && !parts[1]) {
        return getArticles(request, env);
      }
      if (request.method === "GET" && parts[1]) {
        return getArticle(request, env, parts[1]);
      }
    }
    if (parts[0] === "admin" && parts[1] === "articles") {
      await ensureArticleSchema(env);
      await seedArticleTestData(env);
      if (request.method === "GET" && !parts[2]) {
        return getAdminArticles(request, env);
      }
      if (request.method === "POST" && !parts[2]) {
        return createArticle(request, env);
      }
      if (request.method === "PUT" && parts[2]) {
        return updateArticle(request, env, parts[2]);
      }
      if (request.method === "DELETE" && parts[2]) {
        return deleteArticle(request, env, parts[2]);
      }
    }
    if (parts[0] === "saves" && parts[1]) {
      const saveAccessError = await validateSaveAccess(request, env, parts[1]);
      if (saveAccessError) {
        return saveAccessError;
      }
      if (request.method === "GET") {
        return getSave(request, env, parts[1]);
      }
      if (request.method === "PUT") {
        return putSave(request, env, parts[1]);
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
        select message_id, visitor_id, nickname, content, created_at
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
        select message_id, visitor_id, nickname, content, created_at
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
  const body = await readJson(request);
  const visitorId = normalizeVisitorId(body.visitorId);
  const nickname = normalizeChatNickname(body.nickname);
  const content = normalizeChatContent(body.content);
  const ipHash = await requestIpHash(request, env);
  const now = new Date();
  const nowText = now.toISOString();
  const visitorSince = new Date(now.getTime() - CHAT_COOLDOWN_MS).toISOString();
  const ipSince = new Date(now.getTime() - CHAT_IP_WINDOW_MS).toISOString();

  const recentVisitor = await env.DB.prepare(`
    select created_at
    from anonymous_chat_messages
    where visitor_id = ? and created_at > ?
    order by created_at desc
    limit 1
  `).bind(visitorId, visitorSince).first();
  if (recentVisitor) {
    return json({ error: "发送太快啦，请等 3 秒。" }, 429);
  }

  const ipRow = await env.DB.prepare(`
    select count(*) as count
    from anonymous_chat_messages
    where ip_hash = ? and created_at > ?
  `).bind(ipHash, ipSince).first();
  if (Number(ipRow?.count || 0) >= CHAT_IP_WINDOW_LIMIT) {
    return json({ error: "当前网络发送过于频繁，请稍后再试。" }, 429);
  }

  const nicknameOwner = await env.DB.prepare(`
    select visitor_id
    from anonymous_chat_messages
    where hidden = 0 and nickname = ? and visitor_id <> ?
    order by created_at desc
    limit 1
  `).bind(nickname, visitorId).first();
  if (nicknameOwner) {
    return json({ error: "这个随机昵称已经被使用，请刷新聊天室获取新昵称。", code: "nickname_taken" }, 409);
  }

  const messageId = chatMessageId(now);
  await env.DB.prepare(`
    insert into anonymous_chat_messages (message_id, visitor_id, nickname, content, created_at, hidden, ip_hash)
    values (?, ?, ?, ?, ?, 0, ?)
  `).bind(messageId, visitorId, nickname, content, nowText, ipHash).run();

  return json({
    message: {
      message_id: messageId,
      visitor_id: visitorId,
      nickname,
      content,
      created_at: nowText
    }
  }, 201);
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

  return json({ article: publicArticleRow(row, true), lang });
}

async function getAdminArticles(request, env) {
  await requireAdmin(request, env);
  const rows = (await env.DB.prepare(`
    select articles.*, count(article_translations.translation_id) as translation_count
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
        nickname text not null,
        content text not null,
        created_at text not null,
        hidden integer not null default 0,
        ip_hash text not null
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
    `)
  ]);
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
    env.DB.prepare("create index if not exists sessions_user_id_idx on sessions(user_id)"),
    env.DB.prepare("create index if not exists sessions_expires_at_idx on sessions(expires_at)"),
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
  coreSchemaReady = true;
}

async function ensureUserRoleColumn(env) {
  const columns = (await env.DB.prepare("pragma table_info(users)").all()).results || [];
  if (!columns.some((column) => column.name === "role")) {
    await env.DB.prepare("alter table users add column role text not null default 'user'").run();
  }
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
    throw new HttpError("只有管理员可以管理文章。", 403);
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

  return { tokenHash, user: { id: row.id, email: row.email, role: row.role || "user" } };
}

function publicArticleRow(row, includeContent = false) {
  const article = {
    article_id: row.article_id,
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
    article.published_at = normalizeOptionalText(body.published_at, 40) || null;
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

function articleSeedStatements(env) {
  return [
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
- 初期言語はブラウザまたはシステム言語に合わせ、手動変更後はその選択を保存します', '2026-06-11T00:03:00.000Z', '2026-06-11T00:03:00.000Z')
      on conflict(article_id, lang) do update set
        title = excluded.title,
        summary = excluded.summary,
        content_markdown = excluded.content_markdown,
        updated_at = excluded.updated_at
    `)
  ];
}

async function seedArticleTestData(env) {
  await env.DB.batch(articleSeedStatements(env));
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
  const ip = request.headers.get("CF-Connecting-IP")
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "unknown";
  const salt = env.CHAT_IP_HASH_SALT || "lusu-chat";
  return sha256Hex(`${salt}:${ip}`);
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
