const COOKIE_NAME = "lusu_anonymous";
const COOKIE_MAX_AGE_SECONDS = 10 * 365 * 24 * 60 * 60;
const CREDENTIAL_BYTES = 32;
const NAME_COOLDOWN_MS = 30_000;
const NAME_WINDOW_MS = 10 * 60_000;
const NAME_WINDOW_LIMIT = 6;
const IDENTITY_VERSION = 1;

const NAME_PREFIXES = Object.freeze([
  "雾岛", "像素", "月球", "深海", "云端", "电波", "纸箱", "银河", "雨町", "蓝屏",
  "星港", "风铃", "夜航", "晨雾", "极光", "海盐", "雪原", "森林", "灯塔", "珊瑚",
  "流星", "萤火", "薄荷", "柚子", "樱雨", "青空", "白昼", "黄昏", "潮汐", "远山",
  "云海", "星野", "竹影", "松风", "麦田", "雨林", "溪谷", "岛屿", "冰川", "沙丘",
  "琥珀", "水晶", "棉花", "泡泡", "玻璃", "木星", "火星", "土星", "彗星", "天穹",
  "霓虹", "光栅", "量子", "机械", "数据", "芯片", "代码", "终端", "光纤", "无线",
  "掌机", "街机", "存档", "地图", "方块", "迷宫", "蘑菇", "果冻", "汽水", "布丁",
  "橘猫", "白鲸", "海獭", "企鹅", "河马", "熊猫", "浣熊", "松鼠", "刺猬", "海豹",
  "狐狸", "水母", "鲸鱼", "海星", "信鸽", "飞鱼", "云雀", "雪兔", "小鹿", "树蛙",
  "雨巷", "花火", "车站", "书店", "茶屋", "港湾", "庭院", "屋顶", "窗边", "夏夜",
  "秋日", "冬晨", "春风", "晴川", "青岚", "紫藤", "红枫", "苍穹", "银杏", "贝壳"
]);

const NAME_NOUNS = Object.freeze([
  "邮差", "旅人", "信使", "骑士", "店长", "画家", "船长", "向导", "园丁", "木匠",
  "乐手", "诗人", "摄影师", "收藏家", "探险家", "观察员", "记录员", "守夜人", "领航员", "气象员",
  "修理师", "调音师", "设计师", "建筑师", "工程师", "研究员", "翻译官", "图书员", "放映员", "饲养员",
  "狐狸", "海豹", "水母", "企鹅", "白鲸", "海獭", "松鼠", "刺猬", "熊猫", "浣熊",
  "云雀", "雪兔", "小鹿", "树蛙", "飞鱼", "海星", "信鸽", "橘猫", "仓鼠", "羊驼",
  "机器人", "小行星", "探测器", "接收器", "发射器", "计算机", "终端机", "显示器", "游戏机", "留声机",
  "收音机", "打印机", "时光机", "望远镜", "显微镜", "指南针", "万花筒", "播放器", "路由器", "传感器",
  "小火车", "纸飞机", "热气球", "帆船", "潜水艇", "宇宙船", "滑翔翼", "登月车", "观光车", "巡游艇",
  "灯笼", "风车", "雨伞", "背包", "画板", "胶片", "唱片", "磁带", "书签", "明信片",
  "咖啡杯", "玻璃瓶", "工具箱", "音乐盒", "藏宝图", "故事书", "日记本", "铅笔盒", "望远台", "气象站",
  "拾光者", "追风者", "看云人", "听雨人", "寻星人", "观潮人", "守林人", "巡山人", "造梦者", "漫游者"
]);

const COLORS = Object.freeze([
  "#2563eb", "#7c3aed", "#db2777", "#dc2626", "#ea580c", "#ca8a04",
  "#16a34a", "#059669", "#0891b2", "#0284c7", "#4f46e5", "#9333ea"
]);

const FORBIDDEN_NAME_PARTS = Object.freeze([
  "管理员", "官方", "站长", "系统", "客服", "开发者"
]);

const schemaReady = new WeakSet();

export function anonymousNameCombinationCount() {
  return NAME_PREFIXES.length * NAME_NOUNS.length;
}

export async function ensureAnonymousIdentity(request, env) {
  await ensureIdentitySchema(env);
  const credential = readCookie(request, COOKIE_NAME);
  let row = await identityByCredential(env, credential);
  let freshCredential = "";

  if (!row) {
    freshCredential = randomToken(CREDENTIAL_BYTES);
    const credentialHash = await sha256Hex(freshCredential);
    const legacyVisitorId = validLegacyVisitorId(readCookie(request, "lusu_visitor"));
    row = legacyVisitorId
      ? await identityByLegacyVisitor(env, legacyVisitorId)
      : null;

    if (row) {
      await env.DB.prepare(`
        update anonymous_identities
        set credential_hash = ?, updated_at = ?
        where anonymous_id = ?
      `).bind(credentialHash, new Date().toISOString(), row.anonymous_id).run();
      row.credential_hash = credentialHash;
    } else {
      row = await createIdentity(env, credentialHash, legacyVisitorId);
    }
  }

  return {
    anonymousId: row.anonymous_id,
    displayName: safeStoredName(row.display_name),
    color: safeStoredColor(row.color),
    createdAt: row.created_at,
    version: Number(row.identity_version || IDENTITY_VERSION),
    credential: freshCredential || credential,
    shouldSetCookie: Boolean(freshCredential)
  };
}

export async function rotateAnonymousIdentityName(request, env) {
  const identity = await ensureAnonymousIdentity(request, env);
  const now = Date.now();
  const row = await env.DB.prepare(`
    select display_name, identity_version, name_changed_at, name_window_start, name_change_count
    from anonymous_identities
    where anonymous_id = ? and revoked_at is null
  `).bind(identity.anonymousId).first();
  if (!row) {
    throw new AnonymousIdentityError("匿名身份不可用。", 401, "IDENTITY_UNAVAILABLE");
  }

  const lastChangedAt = Date.parse(String(row.name_changed_at || ""));
  if (Number.isFinite(lastChangedAt) && now - lastChangedAt < NAME_COOLDOWN_MS) {
    const retryAfter = Math.ceil((NAME_COOLDOWN_MS - (now - lastChangedAt)) / 1000);
    throw new AnonymousIdentityError("名字更换得太快，请稍后再试。", 429, "NAME_COOLDOWN", retryAfter);
  }

  const previousWindow = Date.parse(String(row.name_window_start || ""));
  const activeWindow = Number.isFinite(previousWindow) && now - previousWindow < NAME_WINDOW_MS;
  const count = activeWindow ? Number(row.name_change_count || 0) : 0;
  if (count >= NAME_WINDOW_LIMIT) {
    const retryAfter = Math.max(1, Math.ceil((NAME_WINDOW_MS - (now - previousWindow)) / 1000));
    throw new AnonymousIdentityError("短时间内更换次数过多，请稍后再试。", 429, "NAME_RATE_LIMIT", retryAfter);
  }

  const nextName = randomSafeName(row.display_name);
  const nowText = new Date(now).toISOString();
  const nextVersion = Number(row.identity_version || IDENTITY_VERSION) + 1;
  const result = await env.DB.prepare(`
    update anonymous_identities
    set display_name = ?, identity_version = ?, name_changed_at = ?,
      name_window_start = ?, name_change_count = ?, updated_at = ?
    where anonymous_id = ? and identity_version = ? and revoked_at is null
  `).bind(
    nextName,
    nextVersion,
    nowText,
    activeWindow ? row.name_window_start : nowText,
    count + 1,
    nowText,
    identity.anonymousId,
    Number(row.identity_version || IDENTITY_VERSION)
  ).run();
  if (Number(result.meta?.changes || 0) !== 1) {
    throw new AnonymousIdentityError("身份刚刚发生变化，请重试。", 409, "IDENTITY_CHANGED");
  }

  return {
    ...identity,
    displayName: nextName,
    version: nextVersion
  };
}

export function publicAnonymousIdentity(identity) {
  return Object.freeze({
    displayName: identity.displayName,
    color: identity.color,
    createdAt: identity.createdAt,
    version: identity.version
  });
}

export function withAnonymousIdentityCookie(response, request, identity) {
  if (!identity?.credential || !identity.shouldSetCookie) return response;
  response.headers.append("Set-Cookie", anonymousCookieValue(identity.credential, request));
  return response;
}

export async function handleAnonymousIdentityApi(context, parts) {
  if (parts[0] !== "anonymous-identity") return null;
  const { request, env } = context;
  if (request.method === "GET" && parts.length === 1) {
    const identity = await ensureAnonymousIdentity(request, env);
    return withAnonymousIdentityCookie(identityJson({
      identity: publicAnonymousIdentity(identity),
      nameCombinationCount: anonymousNameCombinationCount(),
      renameCooldownSeconds: NAME_COOLDOWN_MS / 1000
    }), request, identity);
  }
  if (request.method === "POST" && parts[1] === "name" && parts[2] === "rotate" && parts.length === 3) {
    const identity = await rotateAnonymousIdentityName(request, env);
    return withAnonymousIdentityCookie(identityJson({
      identity: publicAnonymousIdentity(identity),
      renameCooldownSeconds: NAME_COOLDOWN_MS / 1000
    }), request, identity);
  }
  return identityJson({ error: "Not found." }, 404);
}

async function ensureIdentitySchema(env) {
  if (!env?.DB) throw new AnonymousIdentityError("匿名身份存储未配置。", 503, "IDENTITY_STORAGE_UNAVAILABLE");
  if (schemaReady.has(env.DB)) return;
  await env.DB.batch([
    env.DB.prepare(`
      create table if not exists anonymous_identities (
        anonymous_id text primary key,
        credential_hash text not null unique,
        legacy_visitor_id text unique,
        display_name text not null,
        color text not null,
        identity_version integer not null default 1,
        created_at text not null,
        updated_at text not null,
        name_changed_at text,
        name_window_start text,
        name_change_count integer not null default 0,
        revoked_at text
      )
    `),
    env.DB.prepare("create index if not exists anonymous_identities_updated_idx on anonymous_identities(updated_at)"),
    env.DB.prepare("create index if not exists anonymous_identities_name_idx on anonymous_identities(display_name)")
  ]);
  schemaReady.add(env.DB);
}

async function identityByCredential(env, credential) {
  if (!/^[A-Za-z0-9_-]{40,80}$/.test(String(credential || ""))) return null;
  const credentialHash = await sha256Hex(credential);
  return env.DB.prepare(`
    select *
    from anonymous_identities
    where credential_hash = ? and revoked_at is null
  `).bind(credentialHash).first();
}

async function identityByLegacyVisitor(env, legacyVisitorId) {
  if (!legacyVisitorId) return null;
  return env.DB.prepare(`
    select *
    from anonymous_identities
    where legacy_visitor_id = ? and revoked_at is null
  `).bind(legacyVisitorId).first();
}

async function createIdentity(env, credentialHash, legacyVisitorId) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const anonymousId = `anon_${randomToken(18)}`;
    const displayName = randomSafeName();
    const color = await stableColor(anonymousId);
    const now = new Date().toISOString();
    try {
      await env.DB.prepare(`
        insert into anonymous_identities (
          anonymous_id, credential_hash, legacy_visitor_id, display_name, color,
          identity_version, created_at, updated_at, name_change_count
        ) values (?, ?, ?, ?, ?, ?, ?, ?, 0)
      `).bind(
        anonymousId,
        credentialHash,
        legacyVisitorId || null,
        displayName,
        color,
        IDENTITY_VERSION,
        now,
        now
      ).run();
      return {
        anonymous_id: anonymousId,
        credential_hash: credentialHash,
        legacy_visitor_id: legacyVisitorId || null,
        display_name: displayName,
        color,
        identity_version: IDENTITY_VERSION,
        created_at: now,
        updated_at: now
      };
    } catch (error) {
      if (!String(error?.message || error).toLowerCase().includes("unique")) throw error;
      const legacyRow = await identityByLegacyVisitor(env, legacyVisitorId);
      if (legacyRow) return legacyRow;
    }
  }
  throw new AnonymousIdentityError("暂时无法建立匿名身份。", 503, "IDENTITY_CREATE_FAILED");
}

function randomSafeName(previous = "") {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const prefix = NAME_PREFIXES[randomIndex(NAME_PREFIXES.length)];
    const noun = NAME_NOUNS[randomIndex(NAME_NOUNS.length)];
    const value = `${prefix}${noun}`;
    const length = Array.from(value).length;
    if (
      value !== previous
      && length >= 2
      && length <= 8
      && !FORBIDDEN_NAME_PARTS.some((part) => value.includes(part))
    ) {
      return value;
    }
  }
  return `星野旅人${randomIndex(90) + 10}`;
}

function safeStoredName(value) {
  const text = String(value || "").trim();
  const length = Array.from(text).length;
  if (
    length < 2
    || length > 12
    || FORBIDDEN_NAME_PARTS.some((part) => text.includes(part))
  ) {
    return randomSafeName();
  }
  return text;
}

function safeStoredColor(value) {
  return COLORS.includes(value) ? value : COLORS[0];
}

async function stableColor(anonymousId) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(anonymousId));
  return COLORS[new Uint8Array(digest)[0] % COLORS.length];
}

function randomIndex(length) {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return bytes[0] % length;
}

function randomToken(byteLength) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(value || "")));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function readCookie(request, name) {
  const cookie = request.headers.get("Cookie") || "";
  for (const item of cookie.split(";")) {
    const [key, ...rest] = item.trim().split("=");
    if (key === name) {
      try {
        return decodeURIComponent(rest.join("="));
      } catch {
        return "";
      }
    }
  }
  return "";
}

function validLegacyVisitorId(value) {
  const text = String(value || "");
  return /^vis_[A-Za-z0-9_-]{16,80}$/.test(text) ? text : "";
}

function anonymousCookieValue(value, request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE_SECONDS}${secure}`;
}

function identityJson(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'; base-uri 'none'; frame-ancestors 'none'",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY"
    }
  });
}

export class AnonymousIdentityError extends Error {
  constructor(message, status = 400, code = "IDENTITY_ERROR", retryAfter = 0) {
    super(message);
    this.name = "AnonymousIdentityError";
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}
