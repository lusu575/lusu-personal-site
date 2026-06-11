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
    if (parts[0] === "saves" && parts[1]) {
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

  const user = await env.DB.prepare("select id, email, password_hash from users where email = ?").bind(email).first();
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return json({ error: "邮箱或密码不正确。" }, 401);
  }

  return createSessionResponse(env, request, user.id, user.email);
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
  return json({ user: { id: session.user.id, email: session.user.email } });
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
  coreSchemaReady = true;
}

async function createSessionResponse(env, request, userId, email, status = 200) {
  const token = randomToken();
  const tokenHash = await sha256Hex(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  await env.DB.prepare(
    "insert into sessions (token_hash, user_id, created_at, expires_at) values (?, ?, ?, ?)"
  ).bind(tokenHash, userId, now.toISOString(), expiresAt).run();

  const response = json({ user: { id: userId, email } }, status);
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

async function getSession(request, env) {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) {
    return null;
  }

  const tokenHash = await sha256Hex(token);
  const row = await env.DB.prepare(`
    select sessions.token_hash, users.id, users.email
    from sessions
    join users on users.id = sessions.user_id
    where sessions.token_hash = ? and sessions.expires_at > ?
  `).bind(tokenHash, nowIso()).first();

  if (!row) {
    return null;
  }

  return { tokenHash, user: { id: row.id, email: row.email } };
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
  if (!/^[a-z0-9-]{1,80}$/.test(gameId)) {
    throw new HttpError("游戏编号不正确。", 400);
  }
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
