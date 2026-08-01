const TRAFFIC_CONTROL_STATE_KEY = "traffic_control_settings_v1";
const TRAFFIC_CONTROL_SCHEMA_VERSION = 1;
const TRAFFIC_CONTROL_CACHE_MS = 30 * 1000;
const OFFICIAL_ANALYTICS_TIMEOUT_MS = 4000;
const CLOUDFLARE_GRAPHQL_URL = "https://api.cloudflare.com/client/v4/graphql";

export const DEFAULT_TRAFFIC_CONTROL_SETTINGS = Object.freeze({
  schemaVersion: TRAFFIC_CONTROL_SCHEMA_VERSION,
  analyticsEnabled: true,
  identifyEnabled: true,
  pageViewsEnabled: true,
  clicksEnabled: true,
  articleViewsEnabled: true,
  adaptiveProtectionEnabled: true,
  warningRows: 60000,
  hardRows: 80000,
  sampling: Object.freeze({
    normal: Object.freeze({ pageViews: 100, clicks: 100, articleViews: 100 }),
    warning: Object.freeze({ pageViews: 50, clicks: 25, articleViews: 75 }),
    hard: Object.freeze({ pageViews: 10, clicks: 0, articleViews: 25 })
  })
});

const settingsCache = new WeakMap();
const usageCache = new WeakMap();

export class TrafficControlError extends Error {
  constructor(message, status, code, details = null) {
    super(message);
    this.name = "TrafficControlError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function trafficControlDefaultJson() {
  return JSON.stringify(cloneDefaults());
}

export async function ensureTrafficControlSettings(env) {
  const cacheKey = trafficCacheKey(env);
  const cached = cacheKey ? settingsCache.get(cacheKey) : null;
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  let row = await env.DB.prepare(
    "select value, updated_at from site_runtime_state where key = ?"
  ).bind(TRAFFIC_CONTROL_STATE_KEY).first();
  if (!row) {
    const now = new Date().toISOString();
    await env.DB.prepare(`
      insert or ignore into site_runtime_state (key, value, updated_at)
      values (?, ?, ?)
    `).bind(TRAFFIC_CONTROL_STATE_KEY, trafficControlDefaultJson(), now).run();
    row = await env.DB.prepare(
      "select value, updated_at from site_runtime_state where key = ?"
    ).bind(TRAFFIC_CONTROL_STATE_KEY).first();
  }

  const value = Object.freeze({
    settings: normalizeStoredSettings(row?.value),
    updatedAt: String(row?.updated_at || "")
  });
  if (cacheKey) {
    settingsCache.set(cacheKey, { value, expiresAt: Date.now() + TRAFFIC_CONTROL_CACHE_MS });
  }
  return value;
}

export async function getTrafficControlAdminSnapshot(env) {
  const [{ settings, updatedAt }, usage, official] = await Promise.all([
    ensureTrafficControlSettings(env),
    getTrafficUsageSnapshot(env, { useCache: false }),
    fetchOfficialD1Analytics(env)
  ]);
  return {
    settings,
    updatedAt,
    usage,
    official,
    defaults: cloneDefaults()
  };
}

export async function updateTrafficControlSettings(env, body, actorId = "") {
  const expectedUpdatedAt = String(body?.expectedUpdatedAt || "").trim();
  if (!expectedUpdatedAt) {
    throw new TrafficControlError(
      "缺少流量策略版本，请重新载入后再保存。",
      428,
      "TRAFFIC_CONTROL_VERSION_REQUIRED"
    );
  }

  const current = await ensureTrafficControlSettings(env);
  const nextSettings = normalizeEditableSettings(body?.settings, current.settings);
  const now = nextTrafficControlRevision(current.updatedAt);
  const result = await env.DB.prepare(`
    update site_runtime_state
    set value = ?, updated_at = ?
    where key = ? and updated_at = ?
  `).bind(
    JSON.stringify(nextSettings),
    now,
    TRAFFIC_CONTROL_STATE_KEY,
    expectedUpdatedAt
  ).run();
  if (Number(result?.meta?.changes || 0) !== 1) {
    const cacheKey = trafficCacheKey(env);
    if (cacheKey) {
      settingsCache.delete(cacheKey);
    }
    const latest = await ensureTrafficControlSettings(env);
    throw new TrafficControlError(
      "流量策略已被其他后台页面更新，当前输入已保留，请重新载入后合并。",
      409,
      "TRAFFIC_CONTROL_CONFLICT",
      { updatedAt: latest.updatedAt }
    );
  }

  const value = Object.freeze({ settings: nextSettings, updatedAt: now });
  const cacheKey = trafficCacheKey(env);
  if (cacheKey) {
    settingsCache.set(cacheKey, { value, expiresAt: Date.now() + TRAFFIC_CONTROL_CACHE_MS });
    usageCache.delete(cacheKey);
  }
  return {
    settings: nextSettings,
    updatedAt: now,
    updatedBy: String(actorId || "")
  };
}

export async function telemetryWriteDecision(env, {
  kind,
  identity = "",
  fingerprint = ""
} = {}) {
  const { settings } = await ensureTrafficControlSettings(env);
  const enabledKey = {
    identify: "identifyEnabled",
    pageViews: "pageViewsEnabled",
    clicks: "clicksEnabled",
    articleViews: "articleViewsEnabled"
  }[kind];
  if (!settings.analyticsEnabled || !enabledKey || !settings[enabledKey]) {
    return { record: false, mode: "disabled", samplePercent: 0 };
  }

  const usage = settings.adaptiveProtectionEnabled
    ? await getTrafficUsageSnapshot(env)
    : null;
  const mode = usage?.protectionMode || "normal";
  const sampleKey = kind === "identify" ? "pageViews" : kind;
  const samplePercent = settings.sampling[mode]?.[sampleKey]
    ?? settings.sampling.normal[sampleKey]
    ?? 100;
  if (samplePercent >= 100) {
    return { record: true, mode, samplePercent };
  }
  if (samplePercent <= 0) {
    return { record: false, mode, samplePercent };
  }

  const day = new Date().toISOString().slice(0, 10);
  const bucket = await stableSampleBucket(`${day}:${kind}:${identity}:${fingerprint}`);
  return { record: bucket < samplePercent, mode, samplePercent };
}

export async function getTrafficUsageSnapshot(env, { useCache = true } = {}) {
  const cacheKey = trafficCacheKey(env);
  const cached = cacheKey ? usageCache.get(cacheKey) : null;
  if (useCache && cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const now = new Date();
  const periodStart = new Date(now);
  periodStart.setUTCHours(0, 0, 0, 0);
  const periodStartIso = periodStart.toISOString();
  const row = await env.DB.prepare(`
    select
      (select count(*) from analytics_page_views where created_at >= ?) as page_views,
      (select count(*) from analytics_click_events where created_at >= ?) as clicks,
      (select count(*) from article_view_events where created_at >= ?) as article_views,
      (select count(*) from user_login_events where created_at >= ?) as login_events
  `).bind(periodStartIso, periodStartIso, periodStartIso, periodStartIso).first();
  const { settings } = await ensureTrafficControlSettings(env);
  const counts = {
    pageViews: Number(row?.page_views || 0),
    clicks: Number(row?.clicks || 0),
    articleViews: Number(row?.article_views || 0),
    loginEvents: Number(row?.login_events || 0)
  };

  // One recorded page view normally follows one identify call. The coefficients
  // include the existing D1-backed rate-limit buckets, visitor-profile upserts,
  // raw events, and the article aggregate update. They are intentionally a
  // conservative site-level estimate, not a Cloudflare billing statement.
  const breakdown = [
    { key: "pageViews", label: "页面浏览与访客识别", events: counts.pageViews, rowsPerEvent: 8 },
    { key: "clicks", label: "点击埋点", events: counts.clicks, rowsPerEvent: 5 },
    { key: "articleViews", label: "文章阅读", events: counts.articleViews, rowsPerEvent: 5 },
    { key: "loginEvents", label: "登录与注册成功事件", events: counts.loginEvents, rowsPerEvent: 6 }
  ].map((item) => ({ ...item, estimatedRows: item.events * item.rowsPerEvent }));
  const estimatedRows = breakdown.reduce((total, item) => total + item.estimatedRows, 0);
  const protectionMode = !settings.adaptiveProtectionEnabled
    ? "normal"
    : estimatedRows >= settings.hardRows
      ? "hard"
      : estimatedRows >= settings.warningRows
        ? "warning"
        : "normal";
  const quotaResetAt = new Date(periodStart.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const value = Object.freeze({
    generatedAt: now.toISOString(),
    periodStart: periodStartIso,
    quotaResetAt,
    timezone: "UTC",
    estimatedRows,
    warningRows: settings.warningRows,
    hardRows: settings.hardRows,
    utilizationPercent: Math.min(999, Math.round((estimatedRows / settings.hardRows) * 1000) / 10),
    protectionMode,
    counts,
    breakdown,
    scope: "site-telemetry-estimate",
    note: "估算只覆盖站内可识别的遥测与账号成功事件；Cloudflare 官方 rowsWritten 以官方指标区为准。"
  });
  if (cacheKey) {
    usageCache.set(cacheKey, { value, expiresAt: Date.now() + TRAFFIC_CONTROL_CACHE_MS });
  }
  return value;
}

export async function fetchOfficialD1Analytics(env, fetchImpl = fetch) {
  const token = String(env?.CLOUDFLARE_ANALYTICS_API_TOKEN || "").trim();
  const accountTag = String(env?.CLOUDFLARE_ANALYTICS_ACCOUNT_ID || "").trim();
  const databaseId = String(env?.CLOUDFLARE_ANALYTICS_D1_DATABASE_ID || "").trim();
  const missing = [
    ["CLOUDFLARE_ANALYTICS_API_TOKEN", token],
    ["CLOUDFLARE_ANALYTICS_ACCOUNT_ID", accountTag],
    ["CLOUDFLARE_ANALYTICS_D1_DATABASE_ID", databaseId]
  ].filter(([, value]) => !value).map(([name]) => name);
  if (missing.length) {
    return {
      status: "not-configured",
      missing,
      message: "未连接 Cloudflare 官方 D1 Analytics；站内估算和保护策略仍正常工作。"
    };
  }

  const now = new Date();
  const end = now.toISOString().slice(0, 10);
  const startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const start = startDate.toISOString().slice(0, 10);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OFFICIAL_ANALYTICS_TIMEOUT_MS);
  try {
    const response = await fetchImpl(CLOUDFLARE_GRAPHQL_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        query: `
          query D1TrafficControlMetrics(
            $accountTag: string!
            $databaseId: string!
            $start: Date!
            $end: Date!
          ) {
            viewer {
              accounts(filter: { accountTag: $accountTag }) {
                d1AnalyticsAdaptiveGroups(
                  limit: 31
                  filter: {
                    date_geq: $start
                    date_leq: $end
                    databaseId: $databaseId
                  }
                  orderBy: [date_ASC]
                ) {
                  dimensions { date databaseId }
                  sum { readQueries writeQueries rowsRead rowsWritten }
                }
              }
            }
          }
        `,
        variables: { accountTag, databaseId, start, end }
      }),
      signal: controller.signal
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.errors?.length) {
      return {
        status: "error",
        message: "Cloudflare 官方 D1 Analytics 暂时不可用，请检查只读 Token 权限或稍后重试。"
      };
    }
    const daily = payload?.data?.viewer?.accounts?.[0]?.d1AnalyticsAdaptiveGroups || [];
    const normalizedDaily = daily.map((item) => ({
      date: String(item?.dimensions?.date || ""),
      readQueries: Number(item?.sum?.readQueries || 0),
      writeQueries: Number(item?.sum?.writeQueries || 0),
      rowsRead: Number(item?.sum?.rowsRead || 0),
      rowsWritten: Number(item?.sum?.rowsWritten || 0)
    })).filter((item) => item.date);
    const today = normalizedDaily.find((item) => item.date === end) || null;
    return {
      status: "connected",
      generatedAt: now.toISOString(),
      today,
      daily: normalizedDaily,
      retentionDays: 31,
      message: "来自 Cloudflare GraphQL Analytics，与 Dashboard 使用同一 D1 指标数据集。"
    };
  } catch (error) {
    return {
      status: "error",
      message: error?.name === "AbortError"
        ? "读取 Cloudflare 官方 D1 Analytics 超时，站内保护策略未受影响。"
        : "读取 Cloudflare 官方 D1 Analytics 失败，站内保护策略未受影响。"
    };
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeStoredSettings(value) {
  try {
    return normalizeEditableSettings(JSON.parse(String(value || "{}")), cloneDefaults());
  } catch {
    return cloneDefaults();
  }
}

function normalizeEditableSettings(input, fallback) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TrafficControlError("流量策略格式不正确。", 400, "INVALID_TRAFFIC_CONTROL_SETTINGS");
  }
  const base = fallback && typeof fallback === "object" ? fallback : cloneDefaults();
  const next = {
    schemaVersion: TRAFFIC_CONTROL_SCHEMA_VERSION,
    analyticsEnabled: booleanField(input, "analyticsEnabled", base.analyticsEnabled),
    identifyEnabled: booleanField(input, "identifyEnabled", base.identifyEnabled),
    pageViewsEnabled: booleanField(input, "pageViewsEnabled", base.pageViewsEnabled),
    clicksEnabled: booleanField(input, "clicksEnabled", base.clicksEnabled),
    articleViewsEnabled: booleanField(input, "articleViewsEnabled", base.articleViewsEnabled),
    adaptiveProtectionEnabled: booleanField(
      input,
      "adaptiveProtectionEnabled",
      base.adaptiveProtectionEnabled
    ),
    warningRows: integerField(input, "warningRows", base.warningRows, 1000, 50000000),
    hardRows: integerField(input, "hardRows", base.hardRows, 2000, 100000000),
    sampling: {}
  };
  if (next.hardRows <= next.warningRows) {
    throw new TrafficControlError(
      "硬保护阈值必须大于预警阈值。",
      400,
      "INVALID_TRAFFIC_CONTROL_THRESHOLDS"
    );
  }
  for (const mode of ["normal", "warning", "hard"]) {
    const inputMode = input.sampling?.[mode];
    const baseMode = base.sampling?.[mode] || DEFAULT_TRAFFIC_CONTROL_SETTINGS.sampling[mode];
    next.sampling[mode] = {
      pageViews: percentField(inputMode, "pageViews", baseMode.pageViews),
      clicks: percentField(inputMode, "clicks", baseMode.clicks),
      articleViews: percentField(inputMode, "articleViews", baseMode.articleViews)
    };
  }
  return next;
}

function booleanField(input, name, fallback) {
  if (!(name in input)) {
    return Boolean(fallback);
  }
  if (typeof input[name] !== "boolean") {
    throw new TrafficControlError(`开关 ${name} 必须是布尔值。`, 400, "INVALID_TRAFFIC_CONTROL_SETTINGS");
  }
  return input[name];
}

function integerField(input, name, fallback, min, max) {
  const value = name in input ? Number(input[name]) : Number(fallback);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new TrafficControlError(
      `${name} 必须是 ${min}–${max} 之间的整数。`,
      400,
      "INVALID_TRAFFIC_CONTROL_SETTINGS"
    );
  }
  return value;
}

function percentField(input, name, fallback) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const value = name in source ? Number(source[name]) : Number(fallback);
  if (!Number.isInteger(value) || value < 0 || value > 100) {
    throw new TrafficControlError(
      `${name} 采样率必须是 0–100 之间的整数。`,
      400,
      "INVALID_TRAFFIC_CONTROL_SETTINGS"
    );
  }
  return value;
}

async function stableSampleBucket(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(value || "")));
  const bytes = new Uint8Array(digest);
  const number = ((bytes[0] << 8) | bytes[1]) >>> 0;
  return Math.floor((number / 65536) * 100);
}

function cloneDefaults() {
  return {
    schemaVersion: DEFAULT_TRAFFIC_CONTROL_SETTINGS.schemaVersion,
    analyticsEnabled: DEFAULT_TRAFFIC_CONTROL_SETTINGS.analyticsEnabled,
    identifyEnabled: DEFAULT_TRAFFIC_CONTROL_SETTINGS.identifyEnabled,
    pageViewsEnabled: DEFAULT_TRAFFIC_CONTROL_SETTINGS.pageViewsEnabled,
    clicksEnabled: DEFAULT_TRAFFIC_CONTROL_SETTINGS.clicksEnabled,
    articleViewsEnabled: DEFAULT_TRAFFIC_CONTROL_SETTINGS.articleViewsEnabled,
    adaptiveProtectionEnabled: DEFAULT_TRAFFIC_CONTROL_SETTINGS.adaptiveProtectionEnabled,
    warningRows: DEFAULT_TRAFFIC_CONTROL_SETTINGS.warningRows,
    hardRows: DEFAULT_TRAFFIC_CONTROL_SETTINGS.hardRows,
    sampling: {
      normal: { ...DEFAULT_TRAFFIC_CONTROL_SETTINGS.sampling.normal },
      warning: { ...DEFAULT_TRAFFIC_CONTROL_SETTINGS.sampling.warning },
      hard: { ...DEFAULT_TRAFFIC_CONTROL_SETTINGS.sampling.hard }
    }
  };
}

function trafficCacheKey(env) {
  const key = env?.DB;
  return (typeof key === "object" && key !== null) || typeof key === "function" ? key : null;
}

function nextTrafficControlRevision(currentValue) {
  const currentMs = Date.parse(String(currentValue || ""));
  const nextMs = Number.isFinite(currentMs)
    ? Math.max(Date.now(), currentMs + 1)
    : Date.now();
  return new Date(nextMs).toISOString();
}
