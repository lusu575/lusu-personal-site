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
let articleSeedReady = false;

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
      delete from article_translations
      where article_id in ('seed-xp-site-notes', 'seed-local-ai-workflow', 'seed-fallback-check')
    `),
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
