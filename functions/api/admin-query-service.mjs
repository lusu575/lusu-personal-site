// Read-only admin query helpers. SQL identifiers come only from fixed call sites.
export const ADMIN_TIME_ZONE = "Asia/Shanghai";
const DAY_MS = 86400000;
const SHANGHAI_OFFSET = 8 * 3600000;

export function adminDateRange(daysValue = 14, nowValue = new Date()) {
  const parsed = Number(daysValue || 14);
  const days = Number.isFinite(parsed) ? Math.min(90, Math.max(1, Math.trunc(parsed))) : 14;
  const now = new Date(nowValue);
  const shifted = new Date(now.getTime() + SHANGHAI_OFFSET);
  const dayStart = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - SHANGHAI_OFFSET;
  return {
    days, timeZone: ADMIN_TIME_ZONE,
    start: new Date(dayStart - (days - 1) * DAY_MS).toISOString(),
    end: now.toISOString(), todayStart: new Date(dayStart).toISOString(),
    onlineStart: new Date(now.getTime() - 5 * 60000).toISOString()
  };
}

export function adminPagination(params, defaultSize = 100) {
  const sizeValue = Number(params.get("pageSize") || params.get("limit") || defaultSize);
  const pageSize = Number.isFinite(sizeValue) ? Math.min(500, Math.max(1, Math.trunc(sizeValue))) : defaultSize;
  const pageValue = Number(params.get("page") || 1);
  const maxOffset = Number.MAX_SAFE_INTEGER - pageSize;
  const requestedPage = Number.isFinite(pageValue) ? Math.min(Math.floor(maxOffset / pageSize), Math.max(1, Math.trunc(pageValue))) : 1;
  const offsetValue = Number(params.get("offset"));
  const offset = params.has("offset") && Number.isFinite(offsetValue)
    ? Math.min(maxOffset, Math.max(0, Math.trunc(offsetValue))) : (requestedPage - 1) * pageSize;
  return { page: Math.floor(offset / pageSize) + 1, pageSize, offset };
}

export function adminPageResult(pagination, totalValue) {
  const total = Number(totalValue || 0);
  return { total, pagination: { ...pagination, total, totalPages: Math.ceil(total / pagination.pageSize), hasMore: pagination.offset + pagination.pageSize < total } };
}

export function adminListFilter(params, kind, { currentIpHashKeyId = "", now = new Date().toISOString() } = {}) {
  const conditions = [];
  const values = [];
  const add = (condition, ...parameters) => { conditions.push(condition); values.push(...parameters); };
  const q = String(params.get("q") || "").trim().slice(0, 200);
  // Escape LIKE metacharacters so a search for '%' is a literal search.
  const term = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
  const search = (columns) => q && add(`(${columns.map((column) => `${column} like ? escape '\\'`).join(" or ")})`, ...columns.map(() => term));
  const choice = (name, choices, column) => {
    const value = params.get(name);
    if (choices.includes(value)) add(`${column} = ?`, value);
  };
  if (kind === "articles") {
    if (q) add("(articles.category like ? escape '\\' or articles.tags like ? escape '\\' or articles.slug like ? escape '\\' or exists (select 1 from article_translations as search_translation where search_translation.article_id = articles.article_id and search_translation.title like ? escape '\\'))", term, term, term, term);
    choice("status", ["draft", "published", "archived"], "articles.status");
    if (params.get("category") && params.get("category") !== "all") add("articles.category = ?", params.get("category"));
  } else if (kind === "videos") {
    search(["videos.title", "videos.description", "videos.author_name", "videos.external_id", "videos.original_url"]);
    choice("status", ["draft", "published", "hidden"], "videos.status");
    choice("platform", ["youtube", "bilibili"], "videos.platform");
    if (params.get("category") && params.get("category") !== "all") add("exists (select 1 from video_category_relations as filter_relation join video_categories as filter_category on filter_category.category_id = filter_relation.category_id where filter_relation.video_id = videos.video_id and (filter_category.category_id = ? or filter_category.slug = ?))", params.get("category"), params.get("category"));
    const metadata = params.get("metadata");
    if (metadata === "error") add("coalesce(videos.metadata_error, '') <> ''");
    if (metadata === "missing") add("(trim(videos.title) = '' or trim(videos.thumbnail_url) = '' or coalesce(videos.metadata_error, '') <> '')");
    if (metadata === "ready") add("(trim(videos.title) <> '' and trim(videos.thumbnail_url) <> '' and coalesce(videos.metadata_error, '') = '')");
  } else if (kind === "accounts") {
    search(["users.email", "users.id"]);
    choice("role", ["admin", "user"], "users.role");
  } else if (kind === "messages") {
    if (q) {
      const messageColumns = ["anonymous_chat_messages.nickname", "anonymous_chat_messages.message_id", "anonymous_chat_messages.room_key", "case when anonymous_chat_messages.encrypted = 0 then anonymous_chat_messages.content else '' end"];
      const locationColumns = ["search_visitor.country", "search_visitor.region", "search_visitor.city"];
      const matches = (columns) => columns.map((column) => `${column} like ? escape '\\'`).join(" or ");
      add(`(${matches(messageColumns)} or exists (
        select 1 from site_visitors as search_visitor
        where search_visitor.visitor_id = anonymous_chat_messages.visitor_id
          and (${matches(locationColumns)})
      ))`, ...[...messageColumns, ...locationColumns].map(() => term));
    }
    const status = params.get("status");
    if (status === "hidden") add("anonymous_chat_messages.hidden = 1");
    else if (status === "visible" || (status !== "all" && params.get("includeHidden") !== "1")) add("anonymous_chat_messages.hidden = 0");
    const room = params.get("room");
    if (room === "private") add("anonymous_chat_messages.room_key <> 'public'");
    else if (room && room !== "all") add("anonymous_chat_messages.room_key = ?", room);
  } else if (kind === "bans") {
    search(["chat_bans.reason", "chat_bans.ban_id", "chat_bans.visitor_id", "chat_bans.ip_prefix"]);
    const status = params.get("status");
    if (status === "effective") add("chat_bans.active = 1 and (chat_bans.expires_at is null or chat_bans.expires_at > ?) and (chat_bans.ban_type not in ('ip_hash', 'ip') or chat_bans.ip_hash_key_id = ?)", now, currentIpHashKeyId);
    if (status === "expired") add("chat_bans.expires_at is not null and chat_bans.expires_at <= ?", now);
    if (status === "inactive") add("chat_bans.active = 0");
    if (status === "stale") add("chat_bans.ban_type in ('ip_hash', 'ip') and chat_bans.ip_hash_key_id <> ?", currentIpHashKeyId);
  }
  const after = params.get("updatedAfter");
  if (after && Number.isFinite(Date.parse(after)) && ["articles", "videos", "accounts"].includes(kind)) {
    const table = kind === "accounts" ? "users" : kind;
    add(`${table}.updated_at >= ?`, new Date(after).toISOString());
  }
  return { sql: conditions.length ? `where ${conditions.join(" and ")}` : "", values };
}

export function adminArticleMetricScope() {
  return { scope: "retained-events", retentionDays: 180, timeZone: ADMIN_TIME_ZONE,
    note: "PV/UV 为保留的近 180 天已采集阅读事件，不是全历史总访问；历史采样率未保存。" };
}

function countValue(value) { return Number(value || 0); }
function seriesRows(pv, clicks, messages, keys, keyName) {
  const pages = new Map(pv.map((row) => [row[keyName], row]));
  const clickMap = new Map(clicks.map((row) => [row[keyName], row.clicks]));
  const messageMap = new Map(messages.map((row) => [row[keyName], row.messages]));
  return keys.map((key) => ({ [keyName]: key, pv: countValue(pages.get(key)?.pv), uv: countValue(pages.get(key)?.uv), clicks: countValue(clickMap.get(key)), messages: countValue(messageMap.get(key)) }));
}

export async function readAdminAnalyticsOverview(db, daysValue, now = new Date()) {
  const range = adminDateRange(daysValue, now);
  const { start, end, todayStart, onlineStart } = range;
  const query = (sql, ...values) => db.prepare(sql).bind(...values).all().then((result) => result.results || []);
  const totals = (table, since, extra = "") => db.prepare(`select count(*) as count ${extra} from ${table} where created_at >= ? and created_at < ?`).bind(since, end).first();
  const daily = (table, columns, since, key = "day") => query(`select strftime('${key === "day" ? "%Y-%m-%d" : "%Y-%m-%dT%H:00"}', created_at, '+8 hours') as ${key}, ${columns} from ${table} where created_at >= ? and created_at < ? group by ${key} order by ${key} asc`, since, end);
  const [todayViews, periodViews, todayClicks, periodClicks, online, todayMessages, periodMessages, periodArticles, coverage, dailyViews, dailyClicks, dailyMessages, hourlyViews, hourlyClicks, hourlyMessages, countries, cities, regions, topPages, topArticles, topClicks, recentViews, recentClicks] = await Promise.all([
    totals("analytics_page_views", todayStart, ", count(distinct visitor_id) as uv"),
    totals("analytics_page_views", start, ", count(distinct visitor_id) as uv"),
    totals("analytics_click_events", todayStart), totals("analytics_click_events", start),
    db.prepare("select count(*) as count from site_visitors where last_seen_at >= ? and last_seen_at <= ?").bind(onlineStart, end).first(),
    totals("anonymous_chat_messages", todayStart), totals("anonymous_chat_messages", start),
    totals("article_view_events", start, ", count(distinct article_id) as articles"),
    db.prepare(`select count(distinct nullif(trim(country), '')) as countries,
      (select count(*) from (select path, route from analytics_page_views where created_at >= ? and created_at < ? group by path, route)) as pages,
      (select count(*) from (select country, region, city from analytics_page_views where created_at >= ? and created_at < ? and trim(coalesce(city, '')) <> '' group by country, region, city)) as cities
      from analytics_page_views where created_at >= ? and created_at < ?`).bind(start, end, start, end, start, end).first(),
    daily("analytics_page_views", "count(*) as pv, count(distinct visitor_id) as uv", start),
    daily("analytics_click_events", "count(*) as clicks", start), daily("anonymous_chat_messages", "count(*) as messages", start),
    daily("analytics_page_views", "count(*) as pv, count(distinct visitor_id) as uv", todayStart, "hour"),
    daily("analytics_click_events", "count(*) as clicks", todayStart, "hour"), daily("anonymous_chat_messages", "count(*) as messages", todayStart, "hour"),
    query(`select country, count(*) as pv, count(distinct visitor_id) as uv, max(created_at) as last_seen_at, avg(latitude) as latitude, avg(longitude) as longitude from analytics_page_views where created_at >= ? and created_at < ? group by country order by pv desc, country asc limit 80`, start, end),
    query(`select country, region, city, count(*) as pv, count(distinct visitor_id) as uv, max(created_at) as last_seen_at, avg(latitude) as latitude, avg(longitude) as longitude from analytics_page_views where created_at >= ? and created_at < ? and latitude is not null and longitude is not null and latitude between -90 and 90 and longitude between -180 and 180 and (abs(latitude) > 0.0001 or abs(longitude) > 0.0001) and (coalesce(trim(country), '') <> '' or coalesce(trim(region), '') <> '' or coalesce(trim(city), '') <> '') group by country, region, city order by pv desc, uv desc, country, region, city limit 200`, start, end),
    query(`select country, region, city, ip_prefix, count(*) as pv, count(distinct visitor_id) as uv, max(created_at) as last_seen_at, avg(latitude) as latitude, avg(longitude) as longitude from analytics_page_views where created_at >= ? and created_at < ? group by country, region, city, ip_prefix order by pv desc, uv desc limit 200`, start, end),
    query(`select path, route, count(*) as pv, count(distinct visitor_id) as uv, max(created_at) as last_seen_at from analytics_page_views where created_at >= ? and created_at < ? group by path, route order by pv desc, uv desc limit 30`, start, end),
    query(`select e.article_id, e.slug, a.category, coalesce(zh.title, e.slug) as title, count(*) as pv, count(distinct e.visitor_id) as uv, max(e.created_at) as last_seen_at from article_view_events e left join articles a on a.article_id = e.article_id left join article_translations zh on zh.article_id = e.article_id and zh.lang = 'zh' where e.created_at >= ? and e.created_at < ? group by e.article_id, e.slug, a.category, zh.title order by pv desc, uv desc limit 30`, start, end),
    query(`select target_key, target_text, tag_name, data_route, path, count(*) as clicks, count(distinct visitor_id) as uv, max(created_at) as last_seen_at from analytics_click_events where created_at >= ? and created_at < ? group by target_key, target_text, tag_name, data_route, path order by clicks desc, uv desc limit 40`, start, end),
    query(`select created_at, visitor_id, path, route, country, region, city, ip_prefix from analytics_page_views where created_at >= ? and created_at < ? order by created_at desc limit 30`, start, end),
    query(`select created_at, visitor_id, path, target_text, target_key, tag_name, data_route, screen_width, screen_height, country, region, city from analytics_click_events where created_at >= ? and created_at < ? order by created_at desc limit 30`, start, end)
  ]);
  const dayKeys = Array.from({ length: range.days }, (_, index) => new Date(Date.parse(start) + SHANGHAI_OFFSET + index * DAY_MS).toISOString().slice(0, 10));
  const hourCount = new Date(Date.parse(end) + SHANGHAI_OFFSET).getUTCHours() + 1;
  const hourKeys = Array.from({ length: hourCount }, (_, index) => `${dayKeys.at(-1)}T${String(index).padStart(2, "0")}:00`);
  return {
    generatedAt: end, windowDays: range.days, timeZone: ADMIN_TIME_ZONE, range,
    cards: { todayPv: countValue(todayViews?.count), todayUv: countValue(todayViews?.uv), totalPv: countValue(periodViews?.count), totalUv: countValue(periodViews?.uv), todayClicks: countValue(todayClicks?.count), totalClicks: countValue(periodClicks?.count), onlineVisitors: countValue(online?.count), todayMessages: countValue(todayMessages?.count), totalMessages: countValue(periodMessages?.count), totalArticles: countValue(periodArticles?.articles), totalArticleViews: countValue(periodArticles?.count), totalCountries: countValue(coverage?.countries), totalCities: countValue(coverage?.cities), totalPages: countValue(coverage?.pages) },
    coverage: { pageCount: countValue(coverage?.pages), countryCount: countValue(coverage?.countries), cityCount: countValue(coverage?.cities), articleCount: countValue(periodArticles?.articles) },
    daily: seriesRows(dailyViews, dailyClicks, dailyMessages, dayKeys, "day"),
    hourly: seriesRows(hourlyViews, hourlyClicks, hourlyMessages, hourKeys, "hour"),
    trends: { onlineVisitors: null, onlineVisitorsReason: "只保存最近活跃状态，没有历史在线人数序列。" },
    countries, cities, regions, topPages, topArticles, topClicks, recentViews, recentClicks,
    definitions: { uv: "所选区间内 visitor_id 去重，不能逐日相加。", messages: "当前仍保留的聊天消息数，删除与私密房过期清理会减少历史记录。", onlineVisitors: "近 5 分钟有已采集活动的访客数，不等于实时连接数。", rankings: "榜单有行数上限；统计总数来自独立完整查询。" }
  };
}
