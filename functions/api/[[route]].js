import { ContentMigrationError, runArticleDataMigrations } from "./content-migrations.mjs";
import { runPeriodicDataCleanup } from "./data-cleanup-service.mjs";
import { persistAuthenticationSession, scheduleAuthenticationSideEffects } from "./auth-session-service.mjs";
import { normalizeArticleTags } from "./article-tags.mjs";
import { handleTransferApi } from "./transfer-service.mjs";
import {
  authenticateAgentBearer,
  handleAgentAuthApi,
  isAgentAuthApiPath
} from "./agent-auth.mjs";
import {
  handleAgentArticlesApi,
  isAgentArticlesApiPath
} from "./agent-articles.mjs";
import {
  handleAgentVideosApi,
  isAgentVideosApiPath
} from "./agent-videos.mjs";
import {
  JapaneseSubtextAgentEvaluationError,
  canonicalJapaneseSubtextAgentPayload,
  evaluateJapaneseSubtextAgentAttempt,
  normalizeJapaneseSubtextAgentOperationId,
  parseJapaneseSubtextAgentAttempt
} from "./japanese-subtext-agent-evaluator.mjs";
import {
  AnonymousIdentityError,
  ensureAnonymousIdentity,
  handleAnonymousIdentityApi,
  withAnonymousIdentityCookie
} from "./anonymous-identity.mjs";
import { handleWhiteboardApi } from "./whiteboard-service.mjs";
import {
  H3ProtocolError,
  handleMinimaxH3Api,
  isMinimaxH3ApiPath
} from "./minimax-h3-service.mjs";
import {
  TrafficControlError,
  getTrafficControlAdminSnapshot,
  ensureTrafficControlSettings,
  getTrafficUsageSnapshot,
  telemetryWriteDecision,
  updateTrafficControlSettings
} from "./traffic-control.mjs";
import {
  PUBLIC_LOOP_NIGHTLY_UPDATE_FILTER,
  PublicArticleQueryError,
  queryPublishedArticlePage,
  queryPublishedArticle,
  queryPublishedArticles,
  toPublicArticle
} from "./public-content-service.mjs";
import { shouldSkipAnalyticsRequest } from "./analytics-traffic-classifier.mjs";
import {
  buildDailyAiNewsRss,
  normalizeDailyAiNewsFeedLanguage
} from "./daily-ai-news-feed.mjs";

import { readAdminWorkbench } from "./admin-workbench-service.mjs";
import {
  adminDateRange, adminPagination, adminPageResult, adminListFilter,
  adminArticleMetricScope, readAdminAnalyticsOverview
} from "./admin-query-service.mjs";

export const PUBLIC_API_REPRESENTATION_VERSION = "20260908-site-review-r1";
export const PUBLIC_ARTICLE_ARCHIVE_LIMIT = 500;
const PUBLIC_SITE_ORIGIN = "https://lusu575.com";
const PUBLIC_RELEASE_DATE = "2026-09-08";
const SESSION_COOKIE = "lusu_session";
const SESSION_DAYS = 30;
const MAX_SAVE_BYTES = 1024 * 1024;
const MAX_JAPANESE_SUBTEXT_PROGRESS_BYTES = 1024 * 1024;
const MAX_JAPANESE_SUBTEXT_AGENT_ATTEMPT_BYTES = 64 * 1024;
const MAX_JAPANESE_SUBTEXT_AGENT_ASSET_BYTES = 640 * 1024;
const JAPANESE_SUBTEXT_AGENT_ASSET_TIMEOUT_MS = 5000;
const JAPANESE_SUBTEXT_AGENT_ACTIVITY_DEFAULT_DAYS = 30;
const JAPANESE_SUBTEXT_AGENT_ACTIVITY_MAX_DAYS = 90;
const JAPANESE_SUBTEXT_AGENT_ACTIVITY_TIME_ZONE = "Asia/Shanghai";
const JAPANESE_SUBTEXT_AGENT_ACTIVITY_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;
const JAPANESE_SUBTEXT_SCHEMA_VERSION = 1;
const JAPANESE_SUBTEXT_CONTENT_VERSION = "1.0.2";
const JAPANESE_SUBTEXT_EMPTY_TIMESTAMP = "1970-01-01T00:00:00.000Z";
const JAPANESE_SUBTEXT_STAGE_LIMIT = 250;
const JAPANESE_SUBTEXT_COUNTER_LIMIT = 1000000;
const JAPANESE_SUBTEXT_ACTIVITY_DAY_LIMIT = 400;
const JAPANESE_SUBTEXT_ACTIVITY_ROW_LIMIT = 5000;
const JAPANESE_SUBTEXT_LANGUAGES = new Set(["zh", "en", "ja"]);
const JAPANESE_SUBTEXT_DISPLAY_MODES = new Set(["listening", "japanese", "bilingual"]);
const JAPANESE_SUBTEXT_PLAYBACK_RATES = new Set([0.75, 1, 1.15]);
const JAPANESE_SUBTEXT_MEDAL_RANK = Object.freeze({ none: 0, bronze: 1, silver: 2, gold: 3 });
const JAPANESE_SUBTEXT_MEDAL_NAME = Object.freeze(["none", "bronze", "silver", "gold"]);

export function japaneseSubtextActivityDate(isoTimestamp) {
  const timestamp = Date.parse(isoTimestamp);
  if (!Number.isFinite(timestamp)) {
    throw new TypeError("Japanese Subtext activity timestamp must be a valid ISO date.");
  }
  return new Date(timestamp + JAPANESE_SUBTEXT_AGENT_ACTIVITY_UTC_OFFSET_MS)
    .toISOString()
    .slice(0, 10);
}

const PASSWORD_HASH_ITERATIONS = 100000;
const PASSWORD_HASH_MAX_RUNTIME_ITERATIONS = 100000;
const MAX_AUTH_JSON_BYTES = 8 * 1024;
const MAX_ANALYTICS_JSON_BYTES = 16 * 1024;
const MAX_CHAT_JSON_BYTES = 16 * 1024;
const MAX_ADMIN_JSON_BYTES = 2 * 1024 * 1024;
const MAX_DEFAULT_JSON_BYTES = 2 * 1024 * 1024;
const MAX_ARTICLE_DELIVERY_JSON_BYTES = 700 * 1024;
const API_RATE_LIMIT_RETENTION_MS = 2 * 24 * 60 * 60 * 1000;
const DATA_CLEANUP_DELETE_LIMIT = 5000;
const JAPANESE_SUBTEXT_AGENT_ATTEMPT_RATE_LIMITS = Object.freeze({
  token: Object.freeze({ limit: 120, windowMs: 60 * 1000, backoffMs: 60 * 1000, maxBackoffMs: 15 * 60 * 1000 }),
  user: Object.freeze({ limit: 240, windowMs: 60 * 1000, backoffMs: 60 * 1000, maxBackoffMs: 15 * 60 * 1000 }),
  ip: Object.freeze({ limit: 360, windowMs: 60 * 1000, backoffMs: 60 * 1000, maxBackoffMs: 15 * 60 * 1000 })
});
const JAPANESE_SUBTEXT_AGENT_READ_RATE_LIMITS = Object.freeze({
  token: Object.freeze({ limit: 300, windowMs: 60 * 1000, backoffMs: 30 * 1000, maxBackoffMs: 5 * 60 * 1000 }),
  user: Object.freeze({ limit: 600, windowMs: 60 * 1000, backoffMs: 30 * 1000, maxBackoffMs: 5 * 60 * 1000 }),
  ip: Object.freeze({ limit: 900, windowMs: 60 * 1000, backoffMs: 30 * 1000, maxBackoffMs: 5 * 60 * 1000 })
});
const AUTH_RATE_LIMITS = Object.freeze({
  loginIp: Object.freeze({ limit: 30, windowMs: 10 * 60 * 1000, backoffMs: 30 * 1000, maxBackoffMs: 15 * 60 * 1000 }),
  loginEmail: Object.freeze({ limit: 8, windowMs: 15 * 60 * 1000, backoffMs: 60 * 1000, maxBackoffMs: 30 * 60 * 1000 }),
  loginPair: Object.freeze({ limit: 5, windowMs: 15 * 60 * 1000, backoffMs: 60 * 1000, maxBackoffMs: 30 * 60 * 1000 }),
  registerIp: Object.freeze({ limit: 5, windowMs: 60 * 60 * 1000, backoffMs: 5 * 60 * 1000, maxBackoffMs: 60 * 60 * 1000 }),
  registerEmail: Object.freeze({ limit: 3, windowMs: 60 * 60 * 1000, backoffMs: 10 * 60 * 1000, maxBackoffMs: 60 * 60 * 1000 })
});
const ANALYTICS_RATE_LIMITS = Object.freeze({
  identifyIp: Object.freeze({ limit: 30, windowMs: 5 * 60 * 1000, backoffMs: 5 * 60 * 1000 }),
  identifyVisitor: Object.freeze({ limit: 2, windowMs: 5 * 60 * 1000, backoffMs: 5 * 60 * 1000 }),
  pageViewIp: Object.freeze({ limit: 90, windowMs: 60 * 1000, backoffMs: 60 * 1000 }),
  pageViewVisitor: Object.freeze({ limit: 45, windowMs: 60 * 1000, backoffMs: 60 * 1000 }),
  pageViewDuplicate: Object.freeze({ limit: 1, windowMs: 15 * 1000, backoffMs: 15 * 1000 }),
  clickIp: Object.freeze({ limit: 180, windowMs: 60 * 1000, backoffMs: 60 * 1000 }),
  clickVisitor: Object.freeze({ limit: 120, windowMs: 60 * 1000, backoffMs: 60 * 1000 }),
  clickDuplicate: Object.freeze({ limit: 1, windowMs: 1000, backoffMs: 1000 }),
  articleIp: Object.freeze({ limit: 90, windowMs: 60 * 1000, backoffMs: 60 * 1000 }),
  articleVisitor: Object.freeze({ limit: 1, windowMs: 5 * 60 * 1000, backoffMs: 5 * 60 * 1000 })
});
const ARTICLE_DELIVERY_RATE_LIMITS = Object.freeze({
  ip: Object.freeze({ limit: 30, windowMs: 60 * 60 * 1000, backoffMs: 60 * 60 * 1000 }),
  channel: Object.freeze({ limit: 10, windowMs: 10 * 60 * 1000, backoffMs: 10 * 60 * 1000 })
});
const MAX_CHAT_MESSAGE_CHARS = 300;
const MAX_CHAT_NICKNAME_CHARS = 16;
const CHAT_COOLDOWN_MS = 3000;
const CHAT_IP_WINDOW_MS = 60000;
const CHAT_IP_WINDOW_LIMIT = 20;
const PUBLIC_CHAT_ROOM_KEY = "public";
const CHAT_PRIVATE_ROOM_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CHAT_ROOM_KEY_CHARS = 80;
const MAX_CHAT_ENCRYPTED_CONTENT_CHARS = 3200;
const REQUIRED_RUNTIME_SECRETS = Object.freeze([
  "CHAT_IP_HASH_SALT",
  "ANALYTICS_IP_HASH_SALT"
]);
const MIN_RUNTIME_SECRET_BYTES = 32;
const CHAT_IP_HASH_ALGORITHM = "hmac-sha256-v1";
const LEGACY_IP_HASH_KEY_ID = "legacy";
const VISITOR_COOKIE = "lusu_visitor";
const VISITOR_DAYS = 365;
const MAX_VIDEO_THUMBNAIL_TEXT_CHARS = 420000;
const MAX_LOCAL_THUMBNAIL_BYTES = 320 * 1024;
const MAX_PUBLIC_VIDEO_THUMBNAIL_BYTES = 320 * 1024;
const MAX_PUBLIC_VIDEO_THUMBNAIL_WIDTH = 960;
const MAX_PUBLIC_VIDEO_THUMBNAIL_HEIGHT = 540;
const LOCAL_THUMBNAIL_MIME_TYPES = new Set(["jpeg", "jpg", "png", "webp", "avif"]);
const EMAIL_LIKE_TEXT_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
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
const SOCIAL_LINKS_STATE_KEY = "about_social_links";
const ARTICLE_DELIVERY_CHANNELS = Object.freeze({
  "daily-ai-news": Object.freeze({
    channelKey: "daily-ai-news",
    category: "daily-ai-news",
    tokenPrefix: "lusu_ai_news_",
    createdAt: "2026-07-27T00:00:00.000Z",
    defaultTags: Object.freeze(["每日AI新闻", "AI"]),
    disabledMessage: "每日 AI 新闻投递目前已暂停。",
    bodyTooLargeMessage: "每日 AI 新闻投递内容过大。",
    ipRateLimitScope: "article-delivery:ip",
    sourceMaxLength: 80,
    summaryMaxLength: 500,
    usesToolCatalog: false
  }),
  "tool-radar": Object.freeze({
    channelKey: "tool-radar",
    category: "tool-radar",
    tokenPrefix: "lusu_tool_radar_",
    createdAt: "2026-07-28T00:00:00.000Z",
    defaultTags: Object.freeze(["工具雷达", "工具"]),
    disabledMessage: "工具雷达投递目前已暂停。",
    bodyTooLargeMessage: "工具雷达投递内容过大。",
    ipRateLimitScope: "article-delivery:tool-radar:ip",
    sourceMaxLength: 160,
    summaryMaxLength: 500,
    usesToolCatalog: true
  })
});
const TOOL_RADAR_CHANNEL = ARTICLE_DELIVERY_CHANNELS["tool-radar"].channelKey;
const DEFAULT_VIDEO_CATEGORIES = [
  ["video-cat-vrchat", "vrchat", "VRChat作品", "VRChat Works", "VRChat作品", 10],
  ["video-cat-ai", "ai-experiments", "AI实验", "AI Experiments", "AI実験", 20],
  ["video-cat-games", "game-records", "游戏录像", "Game Records", "ゲーム録画", 30],
  ["video-cat-favorites", "favorites", "收藏视频", "Saved Videos", "お気に入り動画", 40]
];
const SOCIAL_LINK_PLATFORMS = [
  ["x", "X", "https://x.com/lusu575"],
  ["github", "GitHub", "https://github.com/lusu575"],
  ["bilibili", "Bilibili", ""],
  ["instagram", "Instagram", "https://www.instagram.com/lusu575/"],
  ["discord", "Discord", ""]
];
let coreSchemaReady = false;
let chatSchemaReady = false;
let articleSchemaReady = false;
let articleDeliveryChannelSchemaReady = false;
let articleDeliverySchemaReady = false;
let analyticsSchemaReady = false;
let videoSchemaReady = false;
let japaneseSubtextSchemaReady = false;

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/?/, "");
  const parts = path.split("/").filter(Boolean);

  if (previewApiIsDisabled(env, url.hostname)) {
    return json({
      error: "Preview API is disabled until isolated data bindings are configured.",
      code: "PREVIEW_API_DISABLED"
    }, 503);
  }

  if (!env.DB) {
    return json({ error: "D1 database binding DB is not configured." }, 500);
  }

  const invalidRuntimeSecrets = invalidRuntimeSecretNames(env);
  if (invalidRuntimeSecrets.length) {
    console.error("API runtime secret validation failed.", { variables: invalidRuntimeSecrets });
    return json({ error: "Service privacy configuration is unavailable." }, 503);
  }

  try {
    const transferRoute = isTransferApiPath(parts);
    const agentAuthRoute = isAgentAuthApiPath(parts);
    const minimaxH3AgentRoute = parts[0] === "agent" && parts[1] === "minimax-h3";
    if (!transferRoute && !agentAuthRoute && !minimaxH3AgentRoute) {
      assertMainApiMutationRequest(request, parts);
    }

    if (
      request.method === "POST"
      && parts[0] === "analytics"
      && ["identify", "page-view", "click"].includes(parts[1])
      && shouldSkipAnalyticsRequest(request)
    ) {
      return json({ ok: true, recorded: false });
    }

    await ensureCoreSchema(env);

    const agentAuthResponse = await handleAgentAuthApi(context, parts);
    if (agentAuthResponse) {
      return agentAuthResponse;
    }

    const transferResponse = await handleTransferApi(context, parts);
    if (transferResponse) {
      return transferResponse;
    }

    if (isAgentArticlesApiPath(parts)) {
      await ensureArticleSchema(env);
      await seedArticleTestData(env);
      return await handleAgentArticlesApi(context, parts);
    }

    if (isAgentVideosApiPath(parts)) {
      await ensureVideoSchema(env);
      return await handleAgentVideosApi(context, parts);
    }

    const adminSession = parts[0] === "admin"
      ? await requireAdmin(request, env)
      : null;
    const minimaxH3AgentPrincipal = minimaxH3AgentRoute
      ? await authenticateAgentBearer(request, env, ["minimax-h3:execute"])
      : null;
    const minimaxH3Response = isMinimaxH3ApiPath(parts)
      ? await handleMinimaxH3Api({
        request,
        env,
        parts,
        adminSession,
        agentPrincipal: minimaxH3AgentPrincipal
      })
      : null;
    if (minimaxH3Response) {
      return minimaxH3Response;
    }

    const anonymousIdentityResponse = await handleAnonymousIdentityApi(context, parts);
    if (anonymousIdentityResponse) {
      return anonymousIdentityResponse;
    }

    const whiteboardResponse = await handleWhiteboardApi(context, parts, {
      isAdmin: Boolean(adminSession),
      adminUser: adminSession?.user || null
    });
    if (whiteboardResponse) {
      return whiteboardResponse;
    }

    if (request.method === "GET" && parts[0] === "health") {
      if (typeof context.waitUntil === "function") {
        context.waitUntil(runPeriodicDataCleanup(env).catch(() => {
          console.error("Periodic API data cleanup will retry on the next health check.");
        }));
      }
      return await health(env);
    }
    if (request.method === "POST" && parts[0] === "auth" && parts[1] === "register") {
      return await register(request, env, context);
    }
    if (request.method === "POST" && parts[0] === "auth" && parts[1] === "login") {
      return await login(request, env, context);
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
      return await getChatNickname(request, env);
    }
    if (request.method === "POST" && parts[0] === "analytics") {
      if (parts[1] === "identify") {
        await ensureAnalyticsSchema(env);
        return await identifyVisitor(request, env);
      }
      if (parts[1] === "page-view") {
        await ensureAnalyticsSchema(env);
        return await recordPageView(request, env);
      }
      if (parts[1] === "click") {
        await ensureAnalyticsSchema(env);
        return await recordClickEvent(request, env);
      }
    }
    if (request.method === "GET" && parts[0] === "sitemap.xml") {
      await ensureArticleSchema(env);
      await seedArticleTestData(env);
      return await getSitemap(request, env);
    }
    if (
      request.method === "GET"
      && parts[0] === "feeds"
      && parts[1] === "daily-ai-news.xml"
      && !parts[2]
    ) {
      await ensureArticleSchema(env);
      await seedArticleTestData(env);
      return await getDailyAiNewsFeed(request, env);
    }
    const machineDeliveryChannel = parts[0] === "automation"
      ? articleDeliveryChannelConfig(parts[1])
      : null;
    if (machineDeliveryChannel && !parts[3]) {
      if (request.method === "POST" && !parts[2]) {
        await ensureArticleDeliveryChannelSchema(env);
        return await deliverArticleAutomation(request, env, machineDeliveryChannel);
      }
      if (
        request.method === "GET"
        && machineDeliveryChannel.channelKey === TOOL_RADAR_CHANNEL
        && parts[2] === "catalog"
      ) {
        await ensureArticleDeliveryChannelSchema(env);
        return await getToolRadarAutomationCatalog(request, env, machineDeliveryChannel);
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
      if (request.method === "GET" && parts[1] && parts[2] === "thumbnail") {
        return await getVideoThumbnail(request, env, parts[1]);
      }
      if (request.method === "GET" && parts[1]) {
        return await getVideo(request, env, parts[1]);
      }
    }
    if (request.method === "GET" && parts[0] === "social-links") {
      return await getSocialLinks(request, env);
    }
    if (
      parts[0] === "tools"
      && parts[1] === "japanese-subtext"
      && parts[2] === "agent-progress"
      && !parts[3]
      && request.method === "GET"
    ) {
      return await getJapaneseSubtextAgentProgress(request, env);
    }
    if (
      parts[0] === "tools"
      && parts[1] === "japanese-subtext"
      && parts[2] === "attempts"
      && !parts[3]
      && request.method === "POST"
    ) {
      return await createJapaneseSubtextAgentAttempt(request, env);
    }
    if (
      parts[0] === "tools"
      && parts[1] === "japanese-subtext"
      && parts[2] === "progress"
      && !parts[3]
    ) {
      if (request.method === "GET") {
        return await getJapaneseSubtextProgress(request, env);
      }
      if (request.method === "PUT") {
        return await putJapaneseSubtextProgress(request, env);
      }
    }
    if (parts[0] === "admin" && request.method === "GET" && parts[1] === "me") {
      return await adminMe(request, env);
    }
    if (parts[0] === "admin" && parts[1] === "workbench-summary" && !parts[2] && request.method === "GET") {
      const session = await requireAdmin(request, env);
      return json(await readAdminWorkbench(env.DB, session.user.id));
    }
    if (parts[0] === "admin" && parts[1] === "social-links") {
      if (request.method === "GET") {
        return await getAdminSocialLinks(request, env);
      }
      if (request.method === "PUT") {
        return await updateAdminSocialLinks(request, env);
      }
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
    if (parts[0] === "admin" && parts[1] === "traffic-control" && !parts[2]) {
      await ensureAnalyticsSchema(env);
      if (request.method === "GET") {
        return await getAdminTrafficControl(request, env);
      }
      if (request.method === "PUT") {
        return await updateAdminTrafficControl(request, env);
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
      if (request.method === "DELETE" && parts[2] === "rooms" && parts[3]) {
        return await deleteAdminPrivateChatRoom(request, env, parts[3]);
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
    const adminDeliveryChannel = parts[0] === "admin" && parts[1] === "automation"
      ? articleDeliveryChannelConfig(parts[2])
      : null;
    if (adminDeliveryChannel && !parts[4]) {
      await ensureArticleSchema(env);
      await ensureArticleDeliverySchema(env);
      if (request.method === "GET" && !parts[3]) {
        return await getAdminArticleAutomation(request, env, adminDeliveryChannel);
      }
      if (request.method === "PUT" && !parts[3]) {
        return await updateAdminArticleAutomation(request, env, adminDeliveryChannel);
      }
      if (request.method === "POST" && parts[3] === "token") {
        return await rotateAdminArticleAutomationToken(request, env, adminDeliveryChannel);
      }
      if (request.method === "DELETE" && parts[3] === "token") {
        return await revokeAdminArticleAutomationToken(request, env, adminDeliveryChannel);
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
    const expectedError = error instanceof HttpError
      || error instanceof JapaneseSubtextAgentEvaluationError
      || error instanceof AnonymousIdentityError
      || error instanceof TrafficControlError
      || error instanceof H3ProtocolError
      || error instanceof PublicArticleQueryError
      || error instanceof ContentMigrationError;
    const status = expectedError ? error.status : 500;
    if (status >= 500) {
      console.error(JSON.stringify({
        message: "api request failed",
        method: request.method,
        path: url.pathname,
        status,
        error: error instanceof Error ? error.message : String(error)
      }));
    }
    const response = json({
      error: expectedError
        ? error.message
        : "服务暂时不可用，请稍后重试。",
      ...(expectedError && error.code ? { code: error.code } : {}),
      ...(expectedError && error.details ? { details: error.details } : {})
    }, status);
    if (expectedError && Number(error.retryAfter || 0) > 0) {
      response.headers.set("Retry-After", String(Math.ceil(error.retryAfter)));
    }
    if (status === 401 && String(error?.code || "").startsWith("AGENT_TOKEN_")) {
      response.headers.set("WWW-Authenticate", "Bearer realm=\"lusu-agent\"");
    }
    return response;
  }
}

async function health(env) {
  const row = await env.DB.prepare("select 1 as db_ok").first();
  const dbAvailable = Number(row?.db_ok || 0) === 1;
  return json({ ok: dbAvailable, db: dbAvailable }, dbAvailable ? 200 : 503);
}

async function register(request, env, context) {
  const body = await readJson(request, MAX_AUTH_JSON_BYTES, "账号请求内容过大。");
  const email = normalizeEmail(body.email);
  const password = String(body.password || "");
  validateEmail(email);
  validatePassword(password);

  const rateContext = await authRateLimitContext(request, env, "register", email);
  const limited = await consumeFirstExceededRateLimit(env, [
    [rateContext.ipBucket, AUTH_RATE_LIMITS.registerIp],
    [rateContext.emailBucket, AUTH_RATE_LIMITS.registerEmail]
  ]);
  if (limited) {
    return rateLimitedResponse(limited.retryAfterSeconds);
  }

  // Always perform the expensive derivation before revealing whether the account can be created.
  const passwordHash = await hashPassword(password);
  const existing = await env.DB.prepare("select id from users where email = ?").bind(email).first();
  if (existing || ownerAdminEmails(env).has(email)) {
    return registrationFailedResponse();
  }

  const userId = crypto.randomUUID();
  const now = nowIso();
  let response;
  try {
    const userStatement = env.DB.prepare(
      "insert into users (id, email, password_hash, created_at, updated_at) values (?, ?, ?, ?, ?)"
    ).bind(userId, email, passwordHash, now, now);
    response = await createSessionResponse(env, request, userId, email, 201, "user", userStatement);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return registrationFailedResponse();
    }
    throw error;
  }

  await scheduleAuthenticationSideEffects(context, [
    () => recordUserLoginEvent(env, request, { id: userId, email, role: "user" }, "register")
  ]);
  return response;
}

async function login(request, env, context) {
  const body = await readJson(request, MAX_AUTH_JSON_BYTES, "账号请求内容过大。");
  const email = normalizeEmail(body.email);
  const password = String(body.password || "");
  validateEmail(email);

  const rateContext = await authRateLimitContext(request, env, "login", email);
  const limited = await consumeFirstExceededRateLimit(env, [
    [rateContext.ipBucket, AUTH_RATE_LIMITS.loginIp],
    [rateContext.emailBucket, AUTH_RATE_LIMITS.loginEmail],
    [rateContext.pairBucket, AUTH_RATE_LIMITS.loginPair]
  ]);
  if (limited) {
    return rateLimitedResponse(limited.retryAfterSeconds);
  }

  const user = await env.DB.prepare("select id, email, password_hash, role from users where email = ?").bind(email).first();
  const passwordMatches = user
    ? await verifyPassword(password, user.password_hash)
    : false;
  if (!user) {
    await hashPassword(password);
  } else if (!passwordMatches && passwordHashNeedsUpgrade(user.password_hash)) {
    await hashPassword(password);
  }
  if (!user || !passwordMatches) {
    return json({ error: "邮箱或密码不正确。" }, 401);
  }

  if (passwordHashNeedsUpgrade(user.password_hash)) {
    const upgradedHash = await hashPassword(password);
    await env.DB.prepare(`
      update users
      set password_hash = ?, updated_at = ?
      where id = ? and password_hash = ?
    `).bind(upgradedHash, nowIso(), user.id, user.password_hash).run();
  }
  const response = await createSessionResponse(env, request, user.id, user.email, 200, user.role || "user");
  await scheduleAuthenticationSideEffects(context, [
    () => clearRateLimitBuckets(env, [rateContext.emailBucket, rateContext.pairBucket]),
    () => recordUserLoginEvent(env, request, user, "login")
  ]);
  return response;
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
    return json({ save: null, updatedAt: null });
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
  if (!Object.prototype.hasOwnProperty.call(body, "expectedUpdatedAt")) {
    return json({ error: "存档同步前提不正确。" }, 400);
  }

  const expectedUpdatedAt = body.expectedUpdatedAt;
  if (
    expectedUpdatedAt !== null
    && (
      typeof expectedUpdatedAt !== "string"
      || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(expectedUpdatedAt)
      || Number.isNaN(Date.parse(expectedUpdatedAt))
    )
  ) {
    return json({ error: "存档同步前提不正确。" }, 400);
  }

  const saveData = JSON.stringify(body.saveData);
  if (new TextEncoder().encode(saveData).length > MAX_SAVE_BYTES) {
    return json({ error: "存档太大，暂时不能同步。" }, 413);
  }

  const currentTime = Date.now();
  const expectedTime = expectedUpdatedAt === null ? -1 : Date.parse(expectedUpdatedAt);
  const now = new Date(Math.max(currentTime, expectedTime + 1)).toISOString();
  const result = expectedUpdatedAt === null
    ? await env.DB.prepare(`
        insert or ignore into game_saves (user_id, game_id, save_data, updated_at)
        values (?, ?, ?, ?)
      `).bind(session.user.id, gameId, saveData, now).run()
    : await env.DB.prepare(`
        update game_saves
        set save_data = ?, updated_at = ?
        where user_id = ? and game_id = ? and updated_at = ?
      `).bind(saveData, now, session.user.id, gameId, expectedUpdatedAt).run();

  if (Number(result?.meta?.changes || 0) !== 1) {
    const current = await env.DB.prepare(
      "select updated_at from game_saves where user_id = ? and game_id = ?"
    ).bind(session.user.id, gameId).first();
    return json({
      error: "云端存档状态已变化，请重新获取后再试。",
      code: "SAVE_CONFLICT",
      updatedAt: current?.updated_at || null
    }, 409);
  }

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

async function getJapaneseSubtextAgentProgress(request, env) {
  const principal = await requireJapaneseSubtextAgentScope(
    request,
    env,
    "japanese-subtext:progress:read"
  );
  const limited = await consumeJapaneseSubtextAgentRateLimit(
    request,
    env,
    principal,
    "read",
    JAPANESE_SUBTEXT_AGENT_READ_RATE_LIMITS
  );
  if (limited) return rateLimitedResponse(limited.retryAfterSeconds);
  const options = japaneseSubtextAgentProgressOptions(request);
  const [profileRow, stageResult, activityResult] = await Promise.all([
    env.DB.prepare(`
      select revision, current_level, current_stage, progress_updated_at, updated_at
      from japanese_subtext_profiles
      where user_id = ?
      limit 1
    `).bind(principal.user.id).first(),
    env.DB.prepare(`
      select stage_id, level, stage, cleared, best_score, best_medal, attempts,
        first_accuracy, first_clear_mode, used_translation, used_kana,
        used_listening_mode, replay_count, hint_count, progress_updated_at, updated_at
      from japanese_subtext_stage_progress
      where user_id = ?
      order by level asc, stage asc
      limit ?
    `).bind(principal.user.id, JAPANESE_SUBTEXT_STAGE_LIMIT + 1).all(),
    env.DB.prepare(`
      select local_date,
        count(*) as stage_count,
        sum(cleared) as cleared_count,
        max(best_medal) as best_medal,
        max(activity_updated_at) as activity_updated_at,
        max(updated_at) as updated_at
      from japanese_subtext_daily_activity
      where user_id = ?
      group by local_date
      order by local_date desc
      limit ?
    `).bind(principal.user.id, options.days).all()
  ]);
  const stageRows = stageResult?.results || [];
  if (stageRows.length > JAPANESE_SUBTEXT_STAGE_LIMIT) {
    throw new HttpError(
      "Stored Japanese Subtext progress exceeds the supported stage limit.",
      500,
      "JAPANESE_SUBTEXT_AGENT_PROGRESS_INVALID"
    );
  }
  const stages = stageRows.map(japaneseSubtextStageFromRow).filter(Boolean);
  const unlockedStageIds = japaneseSubtextUnlockedStageIds(stages);
  const requestedCurrentStageId = profileRow
    ? japaneseSubtextStageId(profileRow.current_level, profileRow.current_stage)
    : "L1-001";
  const currentStageId = unlockedStageIds.includes(requestedCurrentStageId)
    ? requestedCurrentStageId
    : unlockedStageIds.at(-1) || "L1-001";
  const stageById = new Map(stages.map((stage) => [stage.stageId, stage]));
  const selectedStage = options.stageId
    ? japaneseSubtextAgentStageProjection(
      stageById.get(options.stageId),
      options.stageId,
      unlockedStageIds.includes(options.stageId)
    )
    : null;
  const activityRows = activityResult?.results || [];
  const activity = activityRows
    .filter((row) => isJapaneseSubtextLocalDate(row.local_date))
    .map((row) => {
      const medalRank = boundedStoredInteger(row.best_medal, 0, 3, 0);
      return {
        localDate: row.local_date,
        stageCount: boundedStoredInteger(row.stage_count, 0, JAPANESE_SUBTEXT_STAGE_LIMIT, 0),
        clearedStages: boundedStoredInteger(row.cleared_count, 0, JAPANESE_SUBTEXT_STAGE_LIMIT, 0),
        bestMedal: JAPANESE_SUBTEXT_MEDAL_NAME[medalRank] || "none",
        updatedAt: normalizedStoredIso(
          row.activity_updated_at,
          JAPANESE_SUBTEXT_EMPTY_TIMESTAMP
        )
      };
    });
  const medalCounts = { bronze: 0, silver: 0, gold: 0 };
  stages.forEach((stage) => {
    if (Object.hasOwn(medalCounts, stage.medal)) medalCounts[stage.medal] += 1;
  });
  const updatedAt = [
    normalizedStoredIso(profileRow?.updated_at, JAPANESE_SUBTEXT_EMPTY_TIMESTAMP),
    normalizedStoredIso(profileRow?.progress_updated_at, JAPANESE_SUBTEXT_EMPTY_TIMESTAMP),
    ...stageRows.map((row) => normalizedStoredIso(row.updated_at, JAPANESE_SUBTEXT_EMPTY_TIMESTAMP)),
    ...activityRows.map((row) => normalizedStoredIso(row.updated_at, JAPANESE_SUBTEXT_EMPTY_TIMESTAMP))
  ].sort().at(-1) || JAPANESE_SUBTEXT_EMPTY_TIMESTAMP;

  return json({
    schemaVersion: JAPANESE_SUBTEXT_SCHEMA_VERSION,
    contentVersion: JAPANESE_SUBTEXT_CONTENT_VERSION,
    revision: boundedStoredInteger(
      profileRow?.revision,
      1,
      JAPANESE_SUBTEXT_COUNTER_LIMIT,
      1
    ),
    currentStageId,
    unlockedStageIds,
    summary: {
      trackedStages: stages.length,
      clearedStages: stages.filter((stage) => stage.cleared).length,
      totalAttempts: Math.min(
        JAPANESE_SUBTEXT_STAGE_LIMIT * JAPANESE_SUBTEXT_COUNTER_LIMIT,
        stages.reduce((sum, stage) => sum + stage.attempts, 0)
      ),
      bestScore: stages.reduce((best, stage) => Math.max(best, stage.bestScore), 0),
      medals: medalCounts
    },
    ...(selectedStage ? { stage: selectedStage } : {}),
    activity: {
      days: options.days,
      timeZone: JAPANESE_SUBTEXT_AGENT_ACTIVITY_TIME_ZONE,
      entries: activity
    },
    updatedAt
  });
}

async function requireJapaneseSubtextAgentScope(request, env, scope) {
  try {
    return await authenticateAgentBearer(request, env, [scope]);
  } catch (error) {
    if (
      [401, 403].includes(Number(error?.status))
      && /^AGENT_[A-Z0-9_]+$/.test(String(error.code || ""))
    ) {
      throw new HttpError(error.message, error.status, error.code, error.details || null);
    }
    throw error;
  }
}

async function consumeJapaneseSubtextAgentRateLimit(request, env, principal, action, policies) {
  const ipInfo = await requestIpInfo(request, env, "analytics");
  return consumeFirstExceededRateLimit(env, [
    [
      await rateLimitBucketKey(`japanese-subtext:agent-${action}:token`, principal.tokenId),
      policies.token
    ],
    [
      await rateLimitBucketKey(`japanese-subtext:agent-${action}:user`, principal.user.id),
      policies.user
    ],
    [
      await rateLimitBucketKey(`japanese-subtext:agent-${action}:ip`, ipInfo.ipHash),
      policies.ip
    ]
  ]);
}

function japaneseSubtextAgentProgressOptions(request) {
  const params = new URL(request.url).searchParams;
  for (const key of params.keys()) {
    if (key !== "stageId" && key !== "days") {
      throw new HttpError(
        `Unsupported Japanese Subtext Agent progress query parameter: ${key}.`,
        400,
        "JAPANESE_SUBTEXT_AGENT_QUERY_INVALID"
      );
    }
  }
  if (params.getAll("stageId").length > 1 || params.getAll("days").length > 1) {
    throw new HttpError(
      "Japanese Subtext Agent progress query parameters cannot be repeated.",
      400,
      "JAPANESE_SUBTEXT_AGENT_QUERY_INVALID"
    );
  }
  const stageIdValue = params.get("stageId");
  const stageId = stageIdValue === null ? "" : stageIdValue;
  if (stageIdValue !== null && !parseJapaneseSubtextStageId(stageId)) {
    throw new HttpError(
      "stageId must be a canonical Japanese Subtext stage ID.",
      400,
      "JAPANESE_SUBTEXT_AGENT_QUERY_INVALID",
      { field: "stageId" }
    );
  }
  const daysValue = params.get("days");
  let days = JAPANESE_SUBTEXT_AGENT_ACTIVITY_DEFAULT_DAYS;
  if (daysValue !== null) {
    if (!/^[0-9]{1,2}$/.test(daysValue)) {
      throw new HttpError(
        `days must be an integer from 1 through ${JAPANESE_SUBTEXT_AGENT_ACTIVITY_MAX_DAYS}.`,
        400,
        "JAPANESE_SUBTEXT_AGENT_QUERY_INVALID",
        { field: "days" }
      );
    }
    days = Number(daysValue);
    if (days < 1 || days > JAPANESE_SUBTEXT_AGENT_ACTIVITY_MAX_DAYS) {
      throw new HttpError(
        `days must be an integer from 1 through ${JAPANESE_SUBTEXT_AGENT_ACTIVITY_MAX_DAYS}.`,
        400,
        "JAPANESE_SUBTEXT_AGENT_QUERY_INVALID",
        { field: "days" }
      );
    }
  }
  return { stageId, days };
}

function japaneseSubtextAgentStageProjection(stage, stageId, unlocked) {
  const parsed = parseJapaneseSubtextStageId(stageId) || { level: 1, stage: 1 };
  return {
    stageId,
    level: parsed.level,
    stage: parsed.stage,
    unlocked,
    cleared: Boolean(stage?.cleared),
    bestScore: boundedStoredInteger(stage?.bestScore, 0, 100, 0),
    medal: JAPANESE_SUBTEXT_MEDAL_RANK[stage?.medal] === undefined ? "none" : stage.medal,
    attempts: boundedStoredInteger(stage?.attempts, 0, JAPANESE_SUBTEXT_COUNTER_LIMIT, 0),
    firstAccuracy: boundedStoredInteger(stage?.firstAccuracy, 0, 100, 0),
    firstClearMode: JAPANESE_SUBTEXT_DISPLAY_MODES.has(stage?.firstClearMode)
      ? stage.firstClearMode
      : "",
    usedTranslation: Boolean(stage?.usedTranslation),
    usedKana: Boolean(stage?.usedKana),
    usedListeningMode: Boolean(stage?.usedListeningMode),
    replayCount: boundedStoredInteger(stage?.replayCount, 0, JAPANESE_SUBTEXT_COUNTER_LIMIT, 0),
    hintCount: boundedStoredInteger(stage?.hintCount, 0, JAPANESE_SUBTEXT_COUNTER_LIMIT, 0),
    updatedAt: normalizedStoredIso(stage?.updatedAt, JAPANESE_SUBTEXT_EMPTY_TIMESTAMP)
  };
}

async function readJapaneseSubtextAgentState(env, userId) {
  const [profile, stageResult] = await Promise.all([
    env.DB.prepare(`
      select revision, current_level, current_stage
      from japanese_subtext_profiles
      where user_id = ?
      limit 1
    `).bind(userId).first(),
    env.DB.prepare(`
      select stage_id, level, stage, cleared, best_score, best_medal, attempts,
        first_accuracy, first_clear_mode, used_translation, used_kana,
        used_listening_mode, replay_count, hint_count, progress_updated_at, updated_at
      from japanese_subtext_stage_progress
      where user_id = ?
      order by level asc, stage asc
      limit ?
    `).bind(userId, JAPANESE_SUBTEXT_STAGE_LIMIT + 1).all()
  ]);
  const rows = stageResult?.results || [];
  if (rows.length > JAPANESE_SUBTEXT_STAGE_LIMIT) {
    throw new HttpError(
      "Stored Japanese Subtext progress exceeds the supported stage limit.",
      500,
      "JAPANESE_SUBTEXT_AGENT_PROGRESS_INVALID"
    );
  }
  return {
    profile,
    revision: boundedStoredInteger(profile?.revision, 1, JAPANESE_SUBTEXT_COUNTER_LIMIT, 1),
    stages: rows.map(japaneseSubtextStageFromRow).filter(Boolean)
  };
}

function japaneseSubtextAgentCurrentStageId(profile, unlockedStageIds, attemptedStageId, cleared) {
  const requestedCurrent = profile
    ? japaneseSubtextStageId(profile.current_level, profile.current_stage)
    : "L1-001";
  let currentStageId = unlockedStageIds.includes(requestedCurrent)
    ? requestedCurrent
    : unlockedStageIds.at(-1) || "L1-001";
  if (cleared) {
    const nextStageId = nextJapaneseSubtextStageId(attemptedStageId);
    if (nextStageId && japaneseSubtextStageIdSort(nextStageId, currentStageId) > 0) {
      currentStageId = nextStageId;
    }
  }
  return currentStageId;
}

async function createJapaneseSubtextAgentAttempt(request, env) {
  const principal = await requireJapaneseSubtextAgentScope(
    request,
    env,
    "japanese-subtext:progress:write"
  );
  const limited = await consumeJapaneseSubtextAgentRateLimit(
    request,
    env,
    principal,
    "attempt",
    JAPANESE_SUBTEXT_AGENT_ATTEMPT_RATE_LIMITS
  );
  if (limited) return rateLimitedResponse(limited.retryAfterSeconds);
  const body = await readJson(
    request,
    MAX_JAPANESE_SUBTEXT_AGENT_ATTEMPT_BYTES,
    "Japanese Subtext Agent attempt payload is too large."
  );
  const operationId = normalizeJapaneseSubtextAgentOperationId(body?.operationId);
  const preflightCanonicalPayload = canonicalJapaneseSubtextAgentPayload(body);
  const payloadHash = await sha256Hex(JSON.stringify(preflightCanonicalPayload));

  await ensureJapaneseSubtextSchema(env);
  const existingReceipt = await readJapaneseSubtextAgentReceipt(
    env,
    principal.user.id,
    operationId
  );
  if (existingReceipt) {
    return japaneseSubtextAgentReceiptResponse(existingReceipt, payloadHash);
  }

  const stage = await loadJapaneseSubtextAgentStage(request, env, body.stageId);
  const parsed = parseJapaneseSubtextAgentAttempt(body, stage);
  const canonicalPayload = canonicalJapaneseSubtextAgentPayload(parsed);
  const validatedPayloadHash = await sha256Hex(JSON.stringify(canonicalPayload));
  if (validatedPayloadHash !== payloadHash) {
    throw new HttpError(
      "Japanese Subtext Agent attempt normalization is inconsistent.",
      500,
      "JAPANESE_SUBTEXT_AGENT_CANONICALIZATION_FAILED"
    );
  }

  const state = await readJapaneseSubtextAgentState(env, principal.user.id);
  if (parsed.expectedRevision !== state.revision) {
    const racedReceipt = await readJapaneseSubtextAgentReceipt(
      env,
      principal.user.id,
      operationId
    );
    if (racedReceipt) {
      return japaneseSubtextAgentReceiptResponse(racedReceipt, payloadHash);
    }
    throw japaneseSubtextAgentRevisionConflict(state.revision);
  }
  if (state.revision >= JAPANESE_SUBTEXT_COUNTER_LIMIT) {
    throw new HttpError(
      "Japanese Subtext progress revision has reached its supported limit.",
      409,
      "JAPANESE_SUBTEXT_AGENT_PROGRESS_LIMIT",
      { currentRevision: state.revision }
    );
  }
  const unlockedStageIds = japaneseSubtextUnlockedStageIds(state.stages);
  if (!unlockedStageIds.includes(parsed.stageId)) {
    throw new HttpError(
      "The requested Japanese Subtext stage is still locked.",
      409,
      "JAPANESE_SUBTEXT_AGENT_STAGE_LOCKED",
      { stageId: parsed.stageId, currentRevision: state.revision }
    );
  }
  const existingStage = state.stages.find((item) => item.stageId === parsed.stageId);
  if (existingStage?.attempts >= JAPANESE_SUBTEXT_COUNTER_LIMIT) {
    throw new HttpError(
      "Japanese Subtext stage attempts have reached the supported limit.",
      409,
      "JAPANESE_SUBTEXT_AGENT_PROGRESS_LIMIT",
      { stageId: parsed.stageId, currentRevision: state.revision }
    );
  }

  const evaluation = evaluateJapaneseSubtextAgentAttempt(parsed, stage);
  const resultingRevision = state.revision + 1;
  const currentStageId = japaneseSubtextAgentCurrentStageId(
    state.profile,
    unlockedStageIds,
    parsed.stageId,
    evaluation.cleared
  );
  const currentStage = parseJapaneseSubtextStageId(currentStageId) || { level: 1, stage: 1 };
  const attemptId = `jst_attempt_${crypto.randomUUID()}`;
  const createdAt = nowIso();
  const localDate = japaneseSubtextActivityDate(createdAt);
  const medalRank = JAPANESE_SUBTEXT_MEDAL_RANK[evaluation.medal] || 0;
  const responsePayload = {
    schemaVersion: JAPANESE_SUBTEXT_SCHEMA_VERSION,
    contentVersion: JAPANESE_SUBTEXT_CONTENT_VERSION,
    revision: resultingRevision,
    attempt: {
      attemptId,
      operationId,
      stageId: parsed.stageId,
      stageRevision: parsed.stageRevision,
      contentHash: parsed.contentHash,
      score: evaluation.score,
      cleared: evaluation.cleared,
      medal: evaluation.medal,
      attemptMode: evaluation.attemptMode,
      usedTranslation: evaluation.usedTranslation,
      usedKana: evaluation.usedKana,
      usedListeningMode: evaluation.usedListeningMode,
      replayCount: evaluation.replayCount,
      hintCount: evaluation.hintCount,
      createdAt
    }
  };
  const responseText = JSON.stringify(responsePayload);
  const commitGuardSql = `
    select 1
    from japanese_subtext_profiles
    where user_id = ?
      and revision = ?
      and last_agent_operation_id = ?
      and last_agent_payload_hash = ?
      and not exists (
        select 1
        from japanese_subtext_agent_receipts
        where user_id = ? and operation_id = ?
      )
  `;
  const guardBindings = [
    principal.user.id,
    resultingRevision,
    operationId,
    payloadHash,
    principal.user.id,
    operationId
  ];
  const statements = [
    japaneseSubtextAgentProfileCasStatement(env, {
      userId: principal.user.id,
      resultingRevision,
      currentStage,
      operationId,
      payloadHash,
      createdAt,
      stageId: parsed.stageId,
      expectedRevision: parsed.expectedRevision
    }),
    env.DB.prepare(`
      insert into japanese_subtext_stage_progress (
        user_id, stage_id, level, stage, cleared, best_score, best_medal, attempts,
        first_accuracy, first_clear_mode, used_translation, used_kana,
        used_listening_mode, replay_count, hint_count, progress_updated_at, updated_at
      )
      select ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?
      where exists (${commitGuardSql})
      on conflict(user_id, stage_id) do update set
        cleared = max(japanese_subtext_stage_progress.cleared, excluded.cleared),
        best_score = max(japanese_subtext_stage_progress.best_score, excluded.best_score),
        best_medal = max(japanese_subtext_stage_progress.best_medal, excluded.best_medal),
        attempts = japanese_subtext_stage_progress.attempts + 1,
        first_accuracy = case
          when japanese_subtext_stage_progress.attempts = 0 then excluded.first_accuracy
          else japanese_subtext_stage_progress.first_accuracy
        end,
        first_clear_mode = case
          when japanese_subtext_stage_progress.first_clear_mode = '' and excluded.cleared = 1
            then excluded.first_clear_mode
          else japanese_subtext_stage_progress.first_clear_mode
        end,
        used_translation = max(japanese_subtext_stage_progress.used_translation, excluded.used_translation),
        used_kana = max(japanese_subtext_stage_progress.used_kana, excluded.used_kana),
        used_listening_mode = max(japanese_subtext_stage_progress.used_listening_mode, excluded.used_listening_mode),
        replay_count = japanese_subtext_stage_progress.replay_count + excluded.replay_count,
        hint_count = japanese_subtext_stage_progress.hint_count + excluded.hint_count,
        progress_updated_at = excluded.progress_updated_at,
        updated_at = excluded.updated_at
    `).bind(
      principal.user.id,
      parsed.stageId,
      stage.level,
      stage.stage,
      evaluation.cleared ? 1 : 0,
      evaluation.score,
      medalRank,
      evaluation.score,
      evaluation.cleared ? evaluation.attemptMode : "",
      evaluation.usedTranslation ? 1 : 0,
      evaluation.usedKana ? 1 : 0,
      evaluation.usedListeningMode ? 1 : 0,
      evaluation.replayCount,
      evaluation.hintCount,
      createdAt,
      createdAt,
      ...guardBindings
    ),
    env.DB.prepare(`
      insert into japanese_subtext_agent_attempts (
        attempt_id, user_id, token_id, operation_id, payload_hash, stage_id,
        stage_revision, content_hash, expected_revision, resulting_revision,
        answers_json, score, cleared, medal, attempt_mode, used_translation,
        used_kana, used_listening_mode, replay_count, hint_count, created_at
      )
      select ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      where exists (${commitGuardSql})
    `).bind(
      attemptId,
      principal.user.id,
      principal.tokenId,
      operationId,
      payloadHash,
      parsed.stageId,
      parsed.stageRevision,
      parsed.contentHash,
      parsed.expectedRevision,
      resultingRevision,
      JSON.stringify(parsed.answers),
      evaluation.score,
      evaluation.cleared ? 1 : 0,
      medalRank,
      evaluation.attemptMode,
      evaluation.usedTranslation ? 1 : 0,
      evaluation.usedKana ? 1 : 0,
      evaluation.usedListeningMode ? 1 : 0,
      evaluation.replayCount,
      evaluation.hintCount,
      createdAt,
      ...guardBindings
    ),
    env.DB.prepare(`
      insert into japanese_subtext_daily_activity (
        user_id, local_date, stage_id, cleared, best_medal, activity_updated_at, updated_at
      )
      select ?, ?, ?, ?, ?, ?, ?
      where exists (${commitGuardSql})
      on conflict(user_id, local_date, stage_id) do update set
        cleared = max(japanese_subtext_daily_activity.cleared, excluded.cleared),
        best_medal = max(japanese_subtext_daily_activity.best_medal, excluded.best_medal),
        activity_updated_at = excluded.activity_updated_at,
        updated_at = excluded.updated_at
    `).bind(
      principal.user.id,
      localDate,
      parsed.stageId,
      evaluation.cleared ? 1 : 0,
      medalRank,
      createdAt,
      createdAt,
      ...guardBindings
    ),
    env.DB.prepare(`
      insert into agent_audit_log (
        event_id, actor_user_id, token_id, action, target_type, target_id,
        scopes, result, created_at
      )
      select ?, ?, ?, ?, ?, ?, ?, ?, ?
      where exists (${commitGuardSql})
    `).bind(
      crypto.randomUUID(),
      principal.user.id,
      principal.tokenId,
      "japanese-subtext-agent-attempt",
      "japanese-subtext-stage",
      parsed.stageId,
      JSON.stringify(principal.scopes),
      evaluation.cleared ? "cleared" : "attempted",
      createdAt,
      ...guardBindings
    ),
    env.DB.prepare(`
      insert into japanese_subtext_agent_receipts (
        user_id, operation_id, payload_hash, attempt_id, response_json, created_at
      )
      select ?, ?, ?, ?, ?, ?
      where exists (${commitGuardSql})
    `).bind(
      principal.user.id,
      operationId,
      payloadHash,
      attemptId,
      responseText,
      createdAt,
      ...guardBindings
    )
  ];

  let batchResults;
  try {
    batchResults = await env.DB.batch(statements);
  } catch (error) {
    const racedReceipt = await readJapaneseSubtextAgentReceipt(
      env,
      principal.user.id,
      operationId
    );
    if (racedReceipt) {
      return japaneseSubtextAgentReceiptResponse(racedReceipt, payloadHash);
    }
    throw error;
  }

  const casChanges = Number(batchResults?.[0]?.meta?.changes || 0);
  if (casChanges !== 1) {
    const racedReceipt = await readJapaneseSubtextAgentReceipt(
      env,
      principal.user.id,
      operationId
    );
    if (racedReceipt) {
      return japaneseSubtextAgentReceiptResponse(racedReceipt, payloadHash);
    }
    const current = await env.DB.prepare(`
      select revision
      from japanese_subtext_profiles
      where user_id = ?
      limit 1
    `).bind(principal.user.id).first();
    throw japaneseSubtextAgentRevisionConflict(
      boundedStoredInteger(current?.revision, 1, JAPANESE_SUBTEXT_COUNTER_LIMIT, 1)
    );
  }

  return japaneseSubtextStoredJsonResponse(responseText);
}

function japaneseSubtextAgentProfileCasStatement(env, options) {
  return env.DB.prepare(`
    insert into japanese_subtext_profiles (
      user_id, schema_version, content_version, revision, current_level, current_stage,
      settings_json, last_agent_operation_id, last_agent_payload_hash,
      progress_updated_at, settings_updated_at, created_at, updated_at
    )
    select ?, ?, ?, ?, ?, ?, '{}', ?, ?, ?, ?, ?, ?
    where not exists (
      select 1
      from japanese_subtext_stage_progress
      where user_id = ? and stage_id = ? and attempts >= ?
    )
    on conflict(user_id) do update set
      schema_version = excluded.schema_version,
      content_version = excluded.content_version,
      revision = excluded.revision,
      current_level = case
        when excluded.current_level * 100 + excluded.current_stage
          >= japanese_subtext_profiles.current_level * 100 + japanese_subtext_profiles.current_stage
          then excluded.current_level
        else japanese_subtext_profiles.current_level
      end,
      current_stage = case
        when excluded.current_level * 100 + excluded.current_stage
          >= japanese_subtext_profiles.current_level * 100 + japanese_subtext_profiles.current_stage
          then excluded.current_stage
        else japanese_subtext_profiles.current_stage
      end,
      last_agent_operation_id = excluded.last_agent_operation_id,
      last_agent_payload_hash = excluded.last_agent_payload_hash,
      progress_updated_at = excluded.progress_updated_at,
      updated_at = excluded.updated_at
    where japanese_subtext_profiles.revision = ?
      and not exists (
        select 1
        from japanese_subtext_stage_progress
        where user_id = ? and stage_id = ? and attempts >= ?
      )
  `).bind(
    options.userId,
    JAPANESE_SUBTEXT_SCHEMA_VERSION,
    JAPANESE_SUBTEXT_CONTENT_VERSION,
    options.resultingRevision,
    options.currentStage.level,
    options.currentStage.stage,
    options.operationId,
    options.payloadHash,
    options.createdAt,
    JAPANESE_SUBTEXT_EMPTY_TIMESTAMP,
    options.createdAt,
    options.createdAt,
    options.userId,
    options.stageId,
    JAPANESE_SUBTEXT_COUNTER_LIMIT,
    options.expectedRevision,
    options.userId,
    options.stageId,
    JAPANESE_SUBTEXT_COUNTER_LIMIT
  );
}

async function readJapaneseSubtextAgentReceipt(env, userId, operationId) {
  return env.DB.prepare(`
    select payload_hash, response_json
    from japanese_subtext_agent_receipts
    where user_id = ? and operation_id = ?
    limit 1
  `).bind(userId, operationId).first();
}

function japaneseSubtextAgentReceiptResponse(receipt, payloadHash) {
  if (receipt.payload_hash !== payloadHash) {
    throw new HttpError(
      "operationId was already used with a different Japanese Subtext attempt payload.",
      409,
      "JAPANESE_SUBTEXT_AGENT_OPERATION_CONFLICT"
    );
  }
  return japaneseSubtextStoredJsonResponse(receipt.response_json);
}

function japaneseSubtextStoredJsonResponse(value) {
  const responseText = String(value || "");
  if (textBytes(responseText).byteLength > MAX_JAPANESE_SUBTEXT_AGENT_ATTEMPT_BYTES) {
    throw new HttpError(
      "Stored Japanese Subtext Agent receipt is invalid.",
      500,
      "JAPANESE_SUBTEXT_AGENT_RECEIPT_INVALID"
    );
  }
  try {
    const payload = JSON.parse(responseText);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("invalid");
  } catch {
    throw new HttpError(
      "Stored Japanese Subtext Agent receipt is invalid.",
      500,
      "JAPANESE_SUBTEXT_AGENT_RECEIPT_INVALID"
    );
  }
  return new Response(responseText, {
    status: 200,
    headers: apiSecurityHeaders({
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    })
  });
}

function japaneseSubtextAgentRevisionConflict(currentRevision) {
  return new HttpError(
    "Japanese Subtext progress revision is stale.",
    409,
    "JAPANESE_SUBTEXT_AGENT_REVISION_CONFLICT",
    { currentRevision }
  );
}

async function loadJapaneseSubtextAgentStage(request, env, stageId) {
  const parsed = parseJapaneseSubtextStageId(stageId);
  if (!parsed || stageId !== japaneseSubtextStageId(parsed.level, parsed.stage)) {
    throw new JapaneseSubtextAgentEvaluationError(
      "stageId must be a canonical Japanese Subtext stage ID.",
      { details: { field: "stageId" } }
    );
  }
  const start = Math.floor((parsed.stage - 1) / 10) * 10 + 1;
  const end = start + 9;
  const range = `${String(start).padStart(3, "0")}-${String(end).padStart(3, "0")}`;
  const batchFilename = `batch-${range}.json`;
  const basePath = `/tools/japanese-subtext/content/level-${parsed.level}`;
  const [index, batch] = await Promise.all([
    fetchJapaneseSubtextAgentAssetJson(request, env, `${basePath}/index.json`),
    fetchJapaneseSubtextAgentAssetJson(request, env, `${basePath}/${batchFilename}`)
  ]);
  if (
    !isPlainJsonRecord(index)
    || index.schemaVersion !== JAPANESE_SUBTEXT_SCHEMA_VERSION
    || index.contentVersion !== JAPANESE_SUBTEXT_CONTENT_VERSION
    || index.level !== parsed.level
    || !Array.isArray(index.stages)
    || index.stages.length !== 50
  ) {
    throw japaneseSubtextAgentLockedStageError("The deployed level index is invalid.");
  }
  const indexMatches = index.stages.filter((entry) => entry?.id === stageId);
  const indexEntry = indexMatches.length === 1 ? indexMatches[0] : null;
  if (
    !isPlainJsonRecord(indexEntry)
    || indexEntry.stage !== parsed.stage
    || indexEntry.batch !== batchFilename
    || !/^[a-f0-9]{64}$/.test(String(indexEntry.contentHash || ""))
  ) {
    throw japaneseSubtextAgentLockedStageError("The deployed level index stage entry is invalid.");
  }
  if (
    !isPlainJsonRecord(batch)
    || batch.schemaVersion !== JAPANESE_SUBTEXT_SCHEMA_VERSION
    || batch.contentVersion !== JAPANESE_SUBTEXT_CONTENT_VERSION
    || batch.level !== parsed.level
    || batch.batch !== range
    || !Array.isArray(batch.stages)
    || batch.stages.length !== 10
  ) {
    throw japaneseSubtextAgentLockedStageError("The deployed stage batch is invalid.");
  }
  const stageMatches = batch.stages.filter((entry) => entry?.id === stageId);
  const stage = stageMatches.length === 1 ? stageMatches[0] : null;
  if (
    !isPlainJsonRecord(stage)
    || stage.schemaVersion !== JAPANESE_SUBTEXT_SCHEMA_VERSION
    || stage.contentVersion !== JAPANESE_SUBTEXT_CONTENT_VERSION
    || stage.level !== parsed.level
    || stage.stage !== parsed.stage
    || stage.textLocked !== true
    || stage.contentHash !== indexEntry.contentHash
  ) {
    throw japaneseSubtextAgentLockedStageError("The deployed locked stage is invalid.");
  }
  const hashInput = { ...stage };
  delete hashInput.contentHash;
  const actualHash = await sha256Hex(japaneseSubtextStableStringify(hashInput));
  if (actualHash !== stage.contentHash) {
    throw japaneseSubtextAgentLockedStageError("The deployed locked stage content hash is invalid.");
  }
  return stage;
}

async function fetchJapaneseSubtextAgentAssetJson(request, env, pathname) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), JAPANESE_SUBTEXT_AGENT_ASSET_TIMEOUT_MS);
  const assetRequest = new Request(new URL(pathname, request.url), {
    method: "GET",
    headers: { Accept: "application/json" },
    redirect: "error",
    signal: controller.signal
  });
  let response;
  try {
    response = env.ASSETS && typeof env.ASSETS.fetch === "function"
      ? await env.ASSETS.fetch(assetRequest)
      : await fetch(assetRequest);
  } catch {
    clearTimeout(timeout);
    throw new HttpError(
      "Japanese Subtext locked content is temporarily unavailable.",
      503,
      "JAPANESE_SUBTEXT_AGENT_CONTENT_UNAVAILABLE"
    );
  }
  if (!response?.ok) {
    clearTimeout(timeout);
    throw new HttpError(
      "Japanese Subtext locked content is temporarily unavailable.",
      503,
      "JAPANESE_SUBTEXT_AGENT_CONTENT_UNAVAILABLE"
    );
  }
  let raw;
  try {
    raw = await readBoundedRequestText(
      response,
      MAX_JAPANESE_SUBTEXT_AGENT_ASSET_BYTES,
      "Japanese Subtext locked content exceeds the supported size."
    );
  } finally {
    clearTimeout(timeout);
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw japaneseSubtextAgentLockedStageError("The deployed Japanese Subtext content is not valid JSON.");
  }
}

function japaneseSubtextStableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(japaneseSubtextStableStringify).join(",")}]`;
  }
  if (isPlainJsonRecord(value)) {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${japaneseSubtextStableStringify(value[key])}`
    )).join(",")}}`;
  }
  return JSON.stringify(value);
}

function isPlainJsonRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function japaneseSubtextAgentLockedStageError(message) {
  return new HttpError(message, 500, "JAPANESE_SUBTEXT_AGENT_STAGE_INVALID");
}

async function getJapaneseSubtextProgress(request, env) {
  const session = await requireSession(request, env);
  await ensureJapaneseSubtextSchema(env);
  return json(await readJapaneseSubtextProgress(env, session.user.id));
}

async function putJapaneseSubtextProgress(request, env) {
  const session = await requireSession(request, env);
  await ensureJapaneseSubtextSchema(env);
  const input = normalizeJapaneseSubtextPayload(
    await readBoundedJson(request, MAX_JAPANESE_SUBTEXT_PROGRESS_BYTES)
  );
  const now = nowIso();
  const profile = input.profile;

  await env.DB.prepare(`
    insert into japanese_subtext_profiles (
      user_id, schema_version, content_version, revision, current_level, current_stage,
      settings_json, progress_updated_at, settings_updated_at, created_at, updated_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    on conflict(user_id)
    do update set
      schema_version = excluded.schema_version,
      content_version = excluded.content_version,
      revision = max(japanese_subtext_profiles.revision, excluded.revision),
      current_level = case
        when excluded.current_level * 100 + excluded.current_stage
          >= japanese_subtext_profiles.current_level * 100 + japanese_subtext_profiles.current_stage
          then excluded.current_level
        else japanese_subtext_profiles.current_level
      end,
      current_stage = case
        when excluded.current_level * 100 + excluded.current_stage
          >= japanese_subtext_profiles.current_level * 100 + japanese_subtext_profiles.current_stage
          then excluded.current_stage
        else japanese_subtext_profiles.current_stage
      end,
      settings_json = case
        when excluded.settings_updated_at >= japanese_subtext_profiles.settings_updated_at
          then excluded.settings_json
        else japanese_subtext_profiles.settings_json
      end,
      progress_updated_at = max(japanese_subtext_profiles.progress_updated_at, excluded.progress_updated_at),
      settings_updated_at = max(japanese_subtext_profiles.settings_updated_at, excluded.settings_updated_at),
      updated_at = excluded.updated_at
  `).bind(
    session.user.id,
    JAPANESE_SUBTEXT_SCHEMA_VERSION,
    JAPANESE_SUBTEXT_CONTENT_VERSION,
    profile.revision,
    profile.currentLevel,
    profile.currentStage,
    JSON.stringify(input.settings),
    profile.updatedAt,
    input.settings.updatedAt,
    now,
    now
  ).run();

  const stageStatements = input.stages.map((stage) => env.DB.prepare(`
    insert into japanese_subtext_stage_progress (
      user_id, stage_id, level, stage, cleared, best_score, best_medal, attempts,
      first_accuracy, first_clear_mode, used_translation, used_kana,
      used_listening_mode, replay_count, hint_count, progress_updated_at, updated_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    on conflict(user_id, stage_id)
    do update set
      cleared = max(japanese_subtext_stage_progress.cleared, excluded.cleared),
      best_score = max(japanese_subtext_stage_progress.best_score, excluded.best_score),
      best_medal = max(japanese_subtext_stage_progress.best_medal, excluded.best_medal),
      attempts = max(japanese_subtext_stage_progress.attempts, excluded.attempts),
      first_accuracy = max(japanese_subtext_stage_progress.first_accuracy, excluded.first_accuracy),
      first_clear_mode = case
        when japanese_subtext_stage_progress.first_clear_mode <> ''
          then japanese_subtext_stage_progress.first_clear_mode
        else excluded.first_clear_mode
      end,
      used_translation = max(japanese_subtext_stage_progress.used_translation, excluded.used_translation),
      used_kana = max(japanese_subtext_stage_progress.used_kana, excluded.used_kana),
      used_listening_mode = max(japanese_subtext_stage_progress.used_listening_mode, excluded.used_listening_mode),
      replay_count = max(japanese_subtext_stage_progress.replay_count, excluded.replay_count),
      hint_count = max(japanese_subtext_stage_progress.hint_count, excluded.hint_count),
      progress_updated_at = max(japanese_subtext_stage_progress.progress_updated_at, excluded.progress_updated_at),
      updated_at = excluded.updated_at
  `).bind(
    session.user.id,
    stage.stageId,
    stage.level,
    stage.stage,
    stage.cleared ? 1 : 0,
    stage.bestScore,
    JAPANESE_SUBTEXT_MEDAL_RANK[stage.medal],
    stage.attempts,
    stage.firstAccuracy,
    stage.firstClearMode,
    stage.usedTranslation ? 1 : 0,
    stage.usedKana ? 1 : 0,
    stage.usedListeningMode ? 1 : 0,
    stage.replayCount,
    stage.hintCount,
    stage.updatedAt,
    now
  ));

  for (let index = 0; index < stageStatements.length; index += 50) {
    await env.DB.batch(stageStatements.slice(index, index + 50));
  }

  const activityStatements = input.activities.map((activity) => env.DB.prepare(`
    insert into japanese_subtext_daily_activity (
      user_id, local_date, stage_id, cleared, best_medal, activity_updated_at, updated_at
    ) values (?, ?, ?, ?, ?, ?, ?)
    on conflict(user_id, local_date, stage_id)
    do update set
      cleared = max(japanese_subtext_daily_activity.cleared, excluded.cleared),
      best_medal = max(japanese_subtext_daily_activity.best_medal, excluded.best_medal),
      activity_updated_at = max(japanese_subtext_daily_activity.activity_updated_at, excluded.activity_updated_at),
      updated_at = excluded.updated_at
  `).bind(
    session.user.id,
    activity.localDate,
    activity.stageId,
    activity.cleared ? 1 : 0,
    JAPANESE_SUBTEXT_MEDAL_RANK[activity.medal],
    activity.updatedAt,
    now
  ));

  for (let index = 0; index < activityStatements.length; index += 50) {
    await env.DB.batch(activityStatements.slice(index, index + 50));
  }

  // Keep the cloud union bounded without trusting one device to know the
  // complete multi-device history. Cleanup runs against the merged server
  // state, retaining the newest 400 local dates and at most 5,000 rows.
  await env.DB.batch([
    env.DB.prepare(`
      delete from japanese_subtext_daily_activity
      where user_id = ?
        and local_date not in (
          select local_date from (
            select local_date
            from japanese_subtext_daily_activity
            where user_id = ?
            group by local_date
            order by local_date desc
            limit ?
          )
        )
    `).bind(session.user.id, session.user.id, JAPANESE_SUBTEXT_ACTIVITY_DAY_LIMIT),
    env.DB.prepare(`
      delete from japanese_subtext_daily_activity
      where user_id = ?
        and rowid in (
          select rowid
          from japanese_subtext_daily_activity
          where user_id = ?
          order by local_date desc, activity_updated_at desc, stage_id asc
          limit -1 offset ?
        )
    `).bind(session.user.id, session.user.id, JAPANESE_SUBTEXT_ACTIVITY_ROW_LIMIT)
  ]);

  return json(await readJapaneseSubtextProgress(env, session.user.id));
}

async function readJapaneseSubtextProgress(env, userId) {
  const profileRow = await env.DB.prepare(`
    select schema_version, content_version, revision, current_level, current_stage,
      settings_json, progress_updated_at, settings_updated_at, created_at, updated_at
    from japanese_subtext_profiles
    where user_id = ?
  `).bind(userId).first();

  if (!profileRow) {
    const settings = defaultJapaneseSubtextSettings(JAPANESE_SUBTEXT_EMPTY_TIMESTAMP);
    return {
      profile: null,
      stages: [],
      updatedAt: JAPANESE_SUBTEXT_EMPTY_TIMESTAMP,
      progress: defaultJapaneseSubtextProgress(JAPANESE_SUBTEXT_EMPTY_TIMESTAMP),
      settings
    };
  }

  const rows = (await env.DB.prepare(`
    select stage_id, level, stage, cleared, best_score, best_medal, attempts,
      first_accuracy, first_clear_mode, used_translation, used_kana,
      used_listening_mode, replay_count, hint_count, progress_updated_at, updated_at
    from japanese_subtext_stage_progress
    where user_id = ?
    order by level asc, stage asc
  `).bind(userId).all()).results || [];
  const stages = rows.map(japaneseSubtextStageFromRow).filter(Boolean);
  const activityRows = (await env.DB.prepare(`
    with recent_days as (
      select local_date
      from japanese_subtext_daily_activity
      where user_id = ?
      group by local_date
      order by local_date desc
      limit ?
    )
    select activity.local_date, activity.stage_id, activity.cleared, activity.best_medal,
      activity.activity_updated_at, activity.updated_at
    from japanese_subtext_daily_activity activity
    join recent_days on recent_days.local_date = activity.local_date
    where activity.user_id = ?
    order by activity.local_date asc, activity.stage_id asc
    limit ?
  `).bind(
    userId,
    JAPANESE_SUBTEXT_ACTIVITY_DAY_LIMIT,
    userId,
    JAPANESE_SUBTEXT_ACTIVITY_ROW_LIMIT
  ).all()).results || [];
  const activityDays = japaneseSubtextActivityDaysFromRows(activityRows);
  const unlockedStageIds = japaneseSubtextUnlockedStageIds(stages);
  const requestedCurrentId = japaneseSubtextStageId(profileRow.current_level, profileRow.current_stage);
  const currentId = unlockedStageIds.includes(requestedCurrentId)
    ? requestedCurrentId
    : unlockedStageIds.at(-1) || "L1-001";
  const current = parseJapaneseSubtextStageId(currentId) || { level: 1, stage: 1 };
  const settings = storedJapaneseSubtextSettings(profileRow.settings_json, profileRow.settings_updated_at);
  const stageProgress = Object.fromEntries(stages.map((stage) => [stage.stageId, japaneseSubtextStageProgress(stage)]));
  const progressUpdatedAt = normalizedStoredIso(profileRow.progress_updated_at, JAPANESE_SUBTEXT_EMPTY_TIMESTAMP);
  const settingsUpdatedAt = normalizedStoredIso(profileRow.settings_updated_at, settings.updatedAt);
  const updatedAt = [
    normalizedStoredIso(profileRow.updated_at, JAPANESE_SUBTEXT_EMPTY_TIMESTAMP),
    ...rows.map((row) => normalizedStoredIso(row.updated_at, JAPANESE_SUBTEXT_EMPTY_TIMESTAMP)),
    ...activityRows.map((row) => normalizedStoredIso(row.updated_at, JAPANESE_SUBTEXT_EMPTY_TIMESTAMP))
  ].sort().at(-1);

  return {
    profile: {
      schemaVersion: JAPANESE_SUBTEXT_SCHEMA_VERSION,
      contentVersion: JAPANESE_SUBTEXT_CONTENT_VERSION,
      revision: boundedStoredInteger(profileRow.revision, 1, JAPANESE_SUBTEXT_COUNTER_LIMIT, 1),
      currentLevel: current.level,
      currentStage: current.stage,
      unlockedStageIds,
      progressUpdatedAt,
      settingsUpdatedAt,
      updatedAt
    },
    stages,
    updatedAt,
    progress: {
      schemaVersion: JAPANESE_SUBTEXT_SCHEMA_VERSION,
      contentVersion: JAPANESE_SUBTEXT_CONTENT_VERSION,
      revision: boundedStoredInteger(profileRow.revision, 1, JAPANESE_SUBTEXT_COUNTER_LIMIT, 1),
      currentLevel: current.level,
      currentStage: current.stage,
      unlockedStageIds,
      stageProgress,
      activityDays,
      updatedAt: progressUpdatedAt
    },
    settings: { ...settings, updatedAt: settingsUpdatedAt }
  };
}

function normalizeJapaneseSubtextPayload(body) {
  assertJapaneseSubtextObject(body, "云端进度");
  assertJapaneseSubtextKeys(body, ["progress", "settings"], "云端进度");
  const profile = normalizeJapaneseSubtextProgress(body.progress);
  const settings = normalizeJapaneseSubtextSettings(body.settings);
  return { profile, settings, stages: profile.stages, activities: profile.activities };
}

function normalizeJapaneseSubtextProgress(value) {
  const keys = [
    "schemaVersion", "contentVersion", "revision", "currentLevel", "currentStage",
    "unlockedStageIds", "stageProgress", "activityDays", "updatedAt"
  ];
  assertJapaneseSubtextObject(value, "进度");
  assertJapaneseSubtextKeys(value, keys, "进度");
  assertJapaneseSubtextVersion(value, "进度");
  const revision = japaneseSubtextInteger(value.revision, 1, JAPANESE_SUBTEXT_COUNTER_LIMIT, "revision");
  const currentLevel = japaneseSubtextInteger(value.currentLevel, 1, 5, "currentLevel");
  const currentStage = japaneseSubtextInteger(value.currentStage, 1, 50, "currentStage");
  const updatedAt = japaneseSubtextIso(value.updatedAt, "progress.updatedAt");

  if (!Array.isArray(value.unlockedStageIds) || value.unlockedStageIds.length > JAPANESE_SUBTEXT_STAGE_LIMIT) {
    throw new HttpError("已解锁关卡列表不正确。", 400);
  }
  const unlockedStageIds = value.unlockedStageIds.map((stageId) => {
    if (!parseJapaneseSubtextStageId(stageId)) {
      throw new HttpError("已解锁关卡编号不正确。", 400);
    }
    return stageId;
  });
  if (new Set(unlockedStageIds).size !== unlockedStageIds.length) {
    throw new HttpError("已解锁关卡不能重复。", 400);
  }

  assertJapaneseSubtextObject(value.stageProgress, "关卡进度");
  const entries = Object.entries(value.stageProgress);
  if (entries.length > JAPANESE_SUBTEXT_STAGE_LIMIT) {
    throw new HttpError("关卡进度超过 250 关。", 400);
  }
  const stages = entries.map(([stageId, stageValue]) => {
    const parsed = parseJapaneseSubtextStageId(stageId);
    if (!parsed) {
      throw new HttpError("关卡编号不正确。", 400);
    }
    return normalizeJapaneseSubtextStage(stageId, parsed, stageValue);
  }).sort(japaneseSubtextStageSort);
  const activities = normalizeJapaneseSubtextActivityDays(value.activityDays);

  const derivedUnlocked = japaneseSubtextUnlockedStageIds(stages);
  const suppliedUnlocked = [...unlockedStageIds].sort(japaneseSubtextStageIdSort);
  if (
    derivedUnlocked.length !== suppliedUnlocked.length
    || derivedUnlocked.some((stageId, index) => stageId !== suppliedUnlocked[index])
  ) {
    throw new HttpError("已解锁关卡与通关记录不一致。", 400);
  }
  if (stages.some((stage) => !derivedUnlocked.includes(stage.stageId))) {
    throw new HttpError("未解锁关卡不能上传进度。", 400);
  }
  if (activities.some((activity) => !derivedUnlocked.includes(activity.stageId))) {
    throw new HttpError("未解锁关卡不能写入学习打卡。", 400);
  }
  const currentId = japaneseSubtextStageId(currentLevel, currentStage);
  if (!derivedUnlocked.includes(currentId)) {
    throw new HttpError("当前关卡尚未解锁。", 400);
  }

  return { revision, currentLevel, currentStage, updatedAt, stages, activities };
}

function normalizeJapaneseSubtextActivityDays(value) {
  assertJapaneseSubtextObject(value, "学习打卡");
  const days = Object.entries(value);
  if (days.length > JAPANESE_SUBTEXT_ACTIVITY_DAY_LIMIT) {
    throw new HttpError("学习打卡日期过多。", 400);
  }
  const activities = [];
  days.forEach(([localDate, day]) => {
    if (!isJapaneseSubtextLocalDate(localDate)) {
      throw new HttpError("学习打卡日期不正确。", 400);
    }
    assertJapaneseSubtextObject(day, `学习打卡 ${localDate}`);
    assertJapaneseSubtextKeys(day, ["stages", "updatedAt"], `学习打卡 ${localDate}`);
    assertJapaneseSubtextObject(day.stages, `学习打卡 ${localDate} 的关卡`);
    japaneseSubtextIso(day.updatedAt, `activityDays.${localDate}.updatedAt`);
    Object.entries(day.stages).forEach(([stageId, stage]) => {
      const parsed = parseJapaneseSubtextStageId(stageId);
      if (!parsed) {
        throw new HttpError("学习打卡关卡编号不正确。", 400);
      }
      assertJapaneseSubtextObject(stage, `学习打卡 ${localDate} ${stageId}`);
      assertJapaneseSubtextKeys(stage, ["cleared", "medal", "updatedAt"], `学习打卡 ${localDate} ${stageId}`);
      if (typeof stage.cleared !== "boolean" || !Object.hasOwn(JAPANESE_SUBTEXT_MEDAL_RANK, stage.medal)) {
        throw new HttpError(`学习打卡 ${stageId} 状态不正确。`, 400);
      }
      if (stage.cleared !== (stage.medal !== "none")) {
        throw new HttpError(`学习打卡 ${stageId} 的通关状态与奖牌不一致。`, 400);
      }
      activities.push({
        localDate,
        stageId,
        cleared: stage.cleared,
        medal: stage.medal,
        updatedAt: japaneseSubtextIso(stage.updatedAt, `activityDays.${localDate}.${stageId}.updatedAt`)
      });
    });
  });
  if (activities.length > JAPANESE_SUBTEXT_ACTIVITY_ROW_LIMIT) {
    throw new HttpError("学习打卡记录过多。", 400);
  }
  return activities.sort((left, right) => left.localDate.localeCompare(right.localDate) || japaneseSubtextStageIdSort(left.stageId, right.stageId));
}

function isJapaneseSubtextLocalDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function normalizeJapaneseSubtextSettings(value) {
  const keys = [
    "schemaVersion", "contentVersion", "uiLanguage", "displayMode", "optionLanguage",
    "kana", "optionText", "optionAudio", "autoReadOptions", "autoplay", "playbackRate",
    "muted", "updatedAt"
  ];
  assertJapaneseSubtextObject(value, "设置");
  assertJapaneseSubtextKeys(value, keys, "设置");
  assertJapaneseSubtextVersion(value, "设置");
  if (!JAPANESE_SUBTEXT_LANGUAGES.has(value.uiLanguage)) {
    throw new HttpError("界面语言不正确。", 400);
  }
  if (!JAPANESE_SUBTEXT_DISPLAY_MODES.has(value.displayMode)) {
    throw new HttpError("场景显示模式不正确。", 400);
  }
  if (!JAPANESE_SUBTEXT_LANGUAGES.has(value.optionLanguage)) {
    throw new HttpError("选项语言不正确。", 400);
  }
  if (!JAPANESE_SUBTEXT_PLAYBACK_RATES.has(value.playbackRate)) {
    throw new HttpError("播放速度不正确。", 400);
  }
  for (const key of ["kana", "optionText", "optionAudio", "autoReadOptions", "autoplay", "muted"]) {
    if (typeof value[key] !== "boolean") {
      throw new HttpError(`${key} 必须是布尔值。`, 400);
    }
  }
  return {
    schemaVersion: JAPANESE_SUBTEXT_SCHEMA_VERSION,
    contentVersion: JAPANESE_SUBTEXT_CONTENT_VERSION,
    uiLanguage: value.uiLanguage,
    displayMode: value.displayMode,
    optionLanguage: value.optionLanguage,
    kana: value.kana,
    optionText: value.optionText,
    optionAudio: value.optionAudio,
    autoReadOptions: value.autoReadOptions,
    autoplay: false,
    playbackRate: value.playbackRate,
    muted: false,
    updatedAt: japaneseSubtextIso(value.updatedAt, "settings.updatedAt")
  };
}

function normalizeJapaneseSubtextStage(stageId, parsed, value) {
  const keys = [
    "cleared", "bestScore", "medal", "attempts", "firstAccuracy", "firstClearMode",
    "usedTranslation", "usedKana", "usedListeningMode", "replayCount", "hintCount", "updatedAt"
  ];
  assertJapaneseSubtextObject(value, `关卡 ${stageId}`);
  assertJapaneseSubtextKeys(value, keys, `关卡 ${stageId}`);
  for (const key of ["cleared", "usedTranslation", "usedKana", "usedListeningMode"]) {
    if (typeof value[key] !== "boolean") {
      throw new HttpError(`关卡 ${stageId} 的 ${key} 必须是布尔值。`, 400);
    }
  }
  if (!Object.hasOwn(JAPANESE_SUBTEXT_MEDAL_RANK, value.medal)) {
    throw new HttpError(`关卡 ${stageId} 的奖章不正确。`, 400);
  }
  if (value.cleared !== (value.medal !== "none")) {
    throw new HttpError(`关卡 ${stageId} 的通关状态与奖章不一致。`, 400);
  }
  const firstClearMode = String(value.firstClearMode || "");
  if (
    (value.cleared && !JAPANESE_SUBTEXT_DISPLAY_MODES.has(firstClearMode))
    || (!value.cleared && firstClearMode !== "")
  ) {
    throw new HttpError(`关卡 ${stageId} 的首次通关模式不正确。`, 400);
  }
  const attempts = japaneseSubtextInteger(value.attempts, 0, JAPANESE_SUBTEXT_COUNTER_LIMIT, `${stageId}.attempts`);
  const firstAccuracy = japaneseSubtextInteger(value.firstAccuracy, 0, 100, `${stageId}.firstAccuracy`);
  if (attempts === 0 && (value.cleared || firstAccuracy !== 0)) {
    throw new HttpError(`关卡 ${stageId} 的尝试次数与成绩不一致。`, 400);
  }
  return {
    stageId,
    level: parsed.level,
    stage: parsed.stage,
    cleared: value.cleared,
    bestScore: japaneseSubtextInteger(value.bestScore, 0, 100, `${stageId}.bestScore`),
    medal: value.medal,
    attempts,
    firstAccuracy,
    firstClearMode,
    usedTranslation: value.usedTranslation,
    usedKana: value.usedKana,
    usedListeningMode: value.usedListeningMode,
    replayCount: japaneseSubtextInteger(value.replayCount, 0, JAPANESE_SUBTEXT_COUNTER_LIMIT, `${stageId}.replayCount`),
    hintCount: japaneseSubtextInteger(value.hintCount, 0, JAPANESE_SUBTEXT_COUNTER_LIMIT, `${stageId}.hintCount`),
    updatedAt: japaneseSubtextIso(value.updatedAt, `${stageId}.updatedAt`)
  };
}

function assertJapaneseSubtextObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(`${label}格式不正确。`, 400);
  }
}

function assertJapaneseSubtextKeys(value, expectedKeys, label) {
  const actualKeys = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (actualKeys.length !== expected.length || actualKeys.some((key, index) => key !== expected[index])) {
    throw new HttpError(`${label}字段不正确。`, 400);
  }
}

function assertJapaneseSubtextVersion(value, label) {
  if (
    value.schemaVersion !== JAPANESE_SUBTEXT_SCHEMA_VERSION
    || value.contentVersion !== JAPANESE_SUBTEXT_CONTENT_VERSION
  ) {
    throw new HttpError(`${label}版本不受支持。`, 409);
  }
}

function japaneseSubtextInteger(value, min, max, label) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new HttpError(`${label} 不正确。`, 400);
  }
  return value;
}

function japaneseSubtextIso(value, label) {
  if (typeof value !== "string" || value.length > 40) {
    throw new HttpError(`${label} 时间不正确。`, 400);
  }
  const time = Date.parse(value);
  if (!Number.isFinite(time)) {
    throw new HttpError(`${label} 时间不正确。`, 400);
  }
  return new Date(time).toISOString();
}

function parseJapaneseSubtextStageId(value) {
  const match = String(value || "").match(/^L([1-5])-([0-9]{3})$/);
  if (!match) {
    return null;
  }
  const level = Number(match[1]);
  const stage = Number(match[2]);
  return stage >= 1 && stage <= 50 ? { level, stage } : null;
}

function japaneseSubtextStageId(level, stage) {
  return `L${Number(level)}-${String(Number(stage)).padStart(3, "0")}`;
}

function nextJapaneseSubtextStageId(stageId) {
  const parsed = parseJapaneseSubtextStageId(stageId);
  if (!parsed) {
    return "";
  }
  if (parsed.stage < 50) {
    return japaneseSubtextStageId(parsed.level, parsed.stage + 1);
  }
  return parsed.level < 5 ? japaneseSubtextStageId(parsed.level + 1, 1) : "";
}

function japaneseSubtextUnlockedStageIds(stages) {
  const progressByStageId = new Map(stages.map((stage) => [stage.stageId, stage]));
  const unlocked = new Set(["L1-001"]);
  let currentStageId = "L1-001";
  for (let index = 0; index < JAPANESE_SUBTEXT_STAGE_LIMIT; index += 1) {
    const progress = progressByStageId.get(currentStageId);
    if (!progress?.cleared) {
      break;
    }
    const next = nextJapaneseSubtextStageId(currentStageId);
    if (!next) {
      break;
    }
    unlocked.add(next);
    currentStageId = next;
  }
  return [...unlocked].sort(japaneseSubtextStageIdSort);
}

function japaneseSubtextStageIdSort(left, right) {
  const a = parseJapaneseSubtextStageId(left) || { level: 0, stage: 0 };
  const b = parseJapaneseSubtextStageId(right) || { level: 0, stage: 0 };
  return (a.level - b.level) || (a.stage - b.stage);
}

function japaneseSubtextStageSort(left, right) {
  return japaneseSubtextStageIdSort(left.stageId, right.stageId);
}

function japaneseSubtextStageFromRow(row) {
  const parsed = parseJapaneseSubtextStageId(row.stage_id);
  if (!parsed) {
    return null;
  }
  const medalRank = boundedStoredInteger(row.best_medal, 0, 3, 0);
  return {
    stageId: row.stage_id,
    level: parsed.level,
    stage: parsed.stage,
    cleared: Number(row.cleared || 0) === 1,
    bestScore: boundedStoredInteger(row.best_score, 0, 100, 0),
    medal: JAPANESE_SUBTEXT_MEDAL_NAME[medalRank] || "none",
    attempts: boundedStoredInteger(row.attempts, 0, JAPANESE_SUBTEXT_COUNTER_LIMIT, 0),
    firstAccuracy: boundedStoredInteger(row.first_accuracy, 0, 100, 0),
    firstClearMode: JAPANESE_SUBTEXT_DISPLAY_MODES.has(row.first_clear_mode) ? row.first_clear_mode : "",
    usedTranslation: Number(row.used_translation || 0) === 1,
    usedKana: Number(row.used_kana || 0) === 1,
    usedListeningMode: Number(row.used_listening_mode || 0) === 1,
    replayCount: boundedStoredInteger(row.replay_count, 0, JAPANESE_SUBTEXT_COUNTER_LIMIT, 0),
    hintCount: boundedStoredInteger(row.hint_count, 0, JAPANESE_SUBTEXT_COUNTER_LIMIT, 0),
    updatedAt: normalizedStoredIso(row.progress_updated_at, JAPANESE_SUBTEXT_EMPTY_TIMESTAMP)
  };
}

function japaneseSubtextStageProgress(stage) {
  const progress = { ...stage };
  delete progress.stageId;
  delete progress.level;
  delete progress.stage;
  return progress;
}

function japaneseSubtextActivityDaysFromRows(rows) {
  const activityDays = {};
  rows.forEach((row) => {
    if (!isJapaneseSubtextLocalDate(row.local_date) || !parseJapaneseSubtextStageId(row.stage_id)) return;
    const medalRank = boundedStoredInteger(row.best_medal, 0, 3, 0);
    const cleared = Number(row.cleared || 0) === 1;
    const medal = cleared ? (JAPANESE_SUBTEXT_MEDAL_NAME[Math.max(1, medalRank)] || "bronze") : "none";
    const updatedAt = normalizedStoredIso(row.activity_updated_at, JAPANESE_SUBTEXT_EMPTY_TIMESTAMP);
    const day = activityDays[row.local_date] || { stages: {}, updatedAt };
    day.stages[row.stage_id] = { cleared, medal, updatedAt };
    day.updatedAt = [day.updatedAt, updatedAt].sort().at(-1);
    activityDays[row.local_date] = day;
  });
  return activityDays;
}

function storedJapaneseSubtextSettings(raw, fallbackUpdatedAt) {
  try {
    return normalizeJapaneseSubtextSettings(JSON.parse(raw));
  } catch {
    return defaultJapaneseSubtextSettings(normalizedStoredIso(fallbackUpdatedAt, JAPANESE_SUBTEXT_EMPTY_TIMESTAMP));
  }
}

function defaultJapaneseSubtextSettings(updatedAt) {
  return {
    schemaVersion: JAPANESE_SUBTEXT_SCHEMA_VERSION,
    contentVersion: JAPANESE_SUBTEXT_CONTENT_VERSION,
    uiLanguage: "zh",
    displayMode: "japanese",
    optionLanguage: "ja",
    kana: false,
    optionText: true,
    optionAudio: true,
    autoReadOptions: false,
    autoplay: false,
    playbackRate: 1,
    muted: false,
    updatedAt
  };
}

function defaultJapaneseSubtextProgress(updatedAt) {
  return {
    schemaVersion: JAPANESE_SUBTEXT_SCHEMA_VERSION,
    contentVersion: JAPANESE_SUBTEXT_CONTENT_VERSION,
    revision: 1,
    currentLevel: 1,
    currentStage: 1,
    unlockedStageIds: ["L1-001"],
    stageProgress: {},
    activityDays: {},
    updatedAt
  };
}

function normalizedStoredIso(value, fallback) {
  const time = Date.parse(String(value || ""));
  return Number.isFinite(time) ? new Date(time).toISOString() : fallback;
}

function boundedStoredInteger(value, min, max, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number >= min && number <= max ? number : fallback;
}

async function getChatMessages(request, env) {
  await ensureChatSchema(env);
  const url = new URL(request.url);
  const limit = clampLimit(url.searchParams.get("limit"), 100);
  const after = String(url.searchParams.get("after") || "").trim();
  const roomKey = normalizeChatRoomKey(url.searchParams.get("room"));
  await cleanupExpiredPrivateChatRooms(env);

  let rows;
  if (after) {
    const cursor = await env.DB.prepare(
      "select created_at from anonymous_chat_messages where message_id = ? and room_key = ?"
    ).bind(after, roomKey).first();

    if (!cursor) {
      const recoveredCreatedAt = createdAtFromChatMessageId(after);
      rows = recoveredCreatedAt
        ? await getChatMessagesAfter(env, recoveredCreatedAt, after, limit, roomKey)
        : await getRecentChatMessages(env, limit, roomKey);
    } else {
      rows = await getChatMessagesAfter(env, cursor.created_at, after, limit, roomKey);
    }
  } else {
    rows = await getRecentChatMessages(env, limit, roomKey);
  }

  return json({ messages: rows });
}

async function getChatMessagesAfter(env, createdAt, after, limit, roomKey = PUBLIC_CHAT_ROOM_KEY) {
  return (await env.DB.prepare(`
    select message_id, coalesce(nullif(client_id, ''), '') as visitor_id, nickname, content, created_at, encrypted
    from anonymous_chat_messages
    where hidden = 0
      and room_key = ?
      and (created_at > ? or (created_at = ? and message_id > ?))
    order by created_at asc, message_id asc
    limit ?
  `).bind(roomKey, createdAt, createdAt, after, limit).all()).results || [];
}

async function getRecentChatMessages(env, limit, roomKey = PUBLIC_CHAT_ROOM_KEY) {
  return (await env.DB.prepare(`
    select message_id, visitor_id, nickname, content, created_at, encrypted
    from (
      select message_id, coalesce(nullif(client_id, ''), '') as visitor_id, nickname, content, created_at, encrypted
      from anonymous_chat_messages
      where hidden = 0 and room_key = ?
      order by created_at desc, message_id desc
      limit ?
    )
    order by created_at asc, message_id asc
  `).bind(roomKey, limit).all()).results || [];
}

async function postChatMessage(request, env) {
  await ensureChatSchema(env);
  await ensureAnalyticsSchema(env);
  const body = await readJson(request, MAX_CHAT_JSON_BYTES, "聊天请求内容过大。");
  const clientId = normalizeVisitorId(body.visitorId);
  const identity = await ensureAnonymousIdentity(request, env);
  const nickname = normalizeChatNickname(identity.displayName);
  const roomKey = normalizeChatRoomKey(body.room);
  const clientRequestId = normalizeChatRequestId(body.clientRequestId);
  const encrypted = isPrivateChatRoom(roomKey);
  const content = encrypted
    ? normalizeChatEncryptedContent(body.encryptedContent, body.content)
    : normalizeChatContent(body.content);
  const ipInfo = await requestIpInfo(request, env, "chat");
  const ipHash = ipInfo.ipHash;
  const ipHashKeyId = ipInfo.ipHashKeyId;
  const now = new Date();
  const nowText = now.toISOString();
  const visitorSince = new Date(now.getTime() - CHAT_COOLDOWN_MS).toISOString();
  const ipSince = new Date(now.getTime() - CHAT_IP_WINDOW_MS).toISOString();

  const replay = await findChatRequestReplay(env, identity.anonymousId, roomKey, clientRequestId);
  if (replay) {
    return withAnonymousIdentityCookie(json({ message: publicChatMessage(replay), idempotentReplay: true }), request, identity);
  }

  await cleanupExpiredPrivateChatRooms(env);
  await ensureVisitorProfile(env, request, identity.anonymousId, {}, false);
  const ban = await activeChatBan(env, identity.anonymousId, ipHash, ipHashKeyId);
  if (ban) {
    const expires = ban.expires_at ? `，到 ${ban.expires_at} 结束` : "";
    return withAnonymousIdentityCookie(json({ error: `当前访客已被禁言${expires}。` }, 403), request, identity);
  }

  const recentVisitor = await env.DB.prepare(`
    select created_at
    from anonymous_chat_messages
    where visitor_id = ? and room_key = ? and created_at > ?
    order by created_at desc
    limit 1
  `).bind(identity.anonymousId, roomKey, visitorSince).first();
  if (recentVisitor) {
    return withAnonymousIdentityCookie(json({ error: "发送太快啦，请等 3 秒。" }, 429), request, identity);
  }

  const ipRow = await env.DB.prepare(`
    select count(*) as count
    from anonymous_chat_messages
    where ip_hash = ? and ip_hash_key_id = ? and room_key = ? and created_at > ?
  `).bind(ipHash, ipHashKeyId, roomKey, ipSince).first();
  if (Number(ipRow?.count || 0) >= CHAT_IP_WINDOW_LIMIT) {
    return withAnonymousIdentityCookie(json({ error: "当前网络发送过于频繁，请稍后再试。" }, 429), request, identity);
  }

  const nicknameOwner = await env.DB.prepare(`
    select visitor_id
    from anonymous_chat_messages
    where hidden = 0 and room_key = ? and nickname = ? and visitor_id <> ?
    order by created_at desc
    limit 1
  `).bind(roomKey, nickname, identity.anonymousId).first();
  if (nicknameOwner) {
    return withAnonymousIdentityCookie(json({ error: "这个随机昵称已经被使用，请换一个名字后重试。", code: "nickname_taken" }, 409), request, identity);
  }

  const messageId = chatMessageId(now);
  try {
    await env.DB.prepare(`
      insert into anonymous_chat_messages (
        message_id, visitor_id, client_id, nickname, content, created_at,
        hidden, ip_hash, ip_hash_key_id, ip_prefix, room_key, encrypted, client_request_id
      )
      values (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)
    `).bind(
      messageId,
      identity.anonymousId,
      clientId,
      nickname,
      content,
      nowText,
      ipHash,
      ipHashKeyId,
      ipInfo.ipPrefix,
      roomKey,
      encrypted ? 1 : 0,
      clientRequestId
    ).run();
  } catch (error) {
    const concurrentReplay = await findChatRequestReplay(env, identity.anonymousId, roomKey, clientRequestId);
    if (!concurrentReplay) throw error;
    return withAnonymousIdentityCookie(json({ message: publicChatMessage(concurrentReplay), idempotentReplay: true }), request, identity);
  }

  return withAnonymousIdentityCookie(json({
    message: {
      message_id: messageId,
      visitor_id: clientId,
      nickname,
      content,
      created_at: nowText,
      encrypted: encrypted ? 1 : 0
    }
  }, 201), request, identity);
}

async function findChatRequestReplay(env, visitorId, roomKey, clientRequestId) {
  if (!clientRequestId) return null;
  return env.DB.prepare(`
    select message_id, coalesce(nullif(client_id, ''), '') as visitor_id,
      nickname, content, created_at, encrypted
    from anonymous_chat_messages
    where visitor_id = ? and room_key = ? and client_request_id = ?
    limit 1
  `).bind(visitorId, roomKey, clientRequestId).first();
}

function publicChatMessage(row) {
  return {
    message_id: row.message_id,
    visitor_id: row.visitor_id || "",
    nickname: row.nickname,
    content: row.content,
    created_at: row.created_at,
    encrypted: Number(row.encrypted || 0)
  };
}

async function getChatNickname(request, env) {
  const identity = await ensureAnonymousIdentity(request, env);
  return withAnonymousIdentityCookie(json({
    nickname: identity.displayName,
    color: identity.color,
    version: identity.version
  }), request, identity);
}

async function getArticles(request, env) {
  const url = new URL(request.url);
  const lang = normalizeArticleLang(url.searchParams.get("lang"));
  const limit = clampLimit(url.searchParams.get("limit"), PUBLIC_ARTICLE_ARCHIVE_LIMIT);
  const category = normalizeOptionalText(url.searchParams.get("category"), 80);
  const search = normalizeOptionalText(url.searchParams.get("search"), 200);
  let payload;
  if (url.searchParams.get("paginated") === "1") {
    const page = await queryPublishedArticlePage(env, {
      lang,
      category: url.searchParams.get("category") || "",
      search: url.searchParams.get("search") || "",
      limit: url.searchParams.get("limit") || 12,
      cursor: url.searchParams.get("cursor") || "",
      excludeCategory: url.searchParams.get("excludeCategory") || ""
    });
    payload = {
      articles: page.rows.map((row) => toPublicArticle(row)), lang,
      pagination: { total: page.total, hasMore: page.hasMore, nextCursor: page.nextCursor },
      categoryCounts: page.categoryCounts
    };
  } else {
    const rows = await queryPublishedArticles(env, { lang, category, limit, search });
    payload = { articles: rows.map((row) => toPublicArticle(row)), lang };
  }
  return cacheableJson(request, payload, {
    maxAge: 30,
    staleWhileRevalidate: 120,
    etagSeed: JSON.stringify(payload, (key, value) => key === "view_count" ? 0 : value)
  });
}

async function getDailyAiNewsFeed(request, env) {
  const url = new URL(request.url);
  const lang = normalizeDailyAiNewsFeedLanguage(url.searchParams.get("lang"));
  const articles = await queryPublishedArticles(env, {
    lang,
    category: "daily-ai-news",
    limit: 50
  });
  const feedUrl = new URL("/api/feeds/daily-ai-news.xml", PUBLIC_SITE_ORIGIN);
  feedUrl.searchParams.set("lang", lang);
  const xml = buildDailyAiNewsRss({
    articles: articles.map((row) => toPublicArticle(row)),
    lang,
    origin: PUBLIC_SITE_ORIGIN,
    feedUrl: feedUrl.toString()
  });
  return cacheableResponse(request, xml, {
    contentType: "application/rss+xml; charset=utf-8",
    maxAge: 300,
    staleWhileRevalidate: 1800,
    etagSeed: [PUBLIC_API_REPRESENTATION_VERSION, xml]
  });
}

async function getSitemap(_request, env) {
  const langs = ["zh", "en", "ja"];
  const rows = (await env.DB.prepare(`
    select slug, created_at, updated_at, published_at
    from articles
    where status = 'published'
      and ${PUBLIC_LOOP_NIGHTLY_UPDATE_FILTER}
    order by coalesce(published_at, created_at) desc, article_id desc
    limit 500
  `).all()).results || [];

  const rootLastmod = latestSitemapLastmod(rows, PUBLIC_RELEASE_DATE);
  const rootAlternates = sitemapLanguageAlternates(
    langs,
    (lang) => new URL(`/?lang=${encodeURIComponent(lang)}`, PUBLIC_SITE_ORIGIN).toString()
  );
  const rootEntries = langs.map((lang) => sitemapUrlEntry(
    new URL(`/?lang=${encodeURIComponent(lang)}`, PUBLIC_SITE_ORIGIN).toString(),
    rootLastmod,
    "daily",
    "1.0",
    rootAlternates
  ));
  const japaneseSubtextAlternates = sitemapLanguageAlternates(
    langs,
    (lang) => new URL(`/tools/japanese-subtext/?lang=${encodeURIComponent(lang)}`, PUBLIC_SITE_ORIGIN).toString()
  );
  const japaneseSubtextEntries = langs.map((lang) => sitemapUrlEntry(
    new URL(`/tools/japanese-subtext/?lang=${encodeURIComponent(lang)}`, PUBLIC_SITE_ORIGIN).toString(),
    "2026-07-11",
    "monthly",
    "0.9",
    japaneseSubtextAlternates
  ));
  const articleEntries = rows.flatMap((article) => {
    const alternates = sitemapLanguageAlternates(
      langs,
      (lang) => new URL(
        `/articles/${encodeURIComponent(article.slug)}?lang=${encodeURIComponent(lang)}`,
        PUBLIC_SITE_ORIGIN
      ).toString()
    );
    return langs.map((lang) => sitemapUrlEntry(
      new URL(
        `/articles/${encodeURIComponent(article.slug)}?lang=${encodeURIComponent(lang)}`,
        PUBLIC_SITE_ORIGIN
      ).toString(),
      article.updated_at || article.published_at || article.created_at,
      "weekly",
      "0.8",
      alternates
    ));
  });

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...rootEntries,
    ...japaneseSubtextEntries,
    ...articleEntries,
    '</urlset>'
  ].join("\n");

  return new Response(xml, {
    headers: apiSecurityHeaders({
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=300"
    })
  });
}

function sitemapLanguageAlternates(langs, locationForLanguage) {
  const localized = langs.map((lang) => ({
    lang,
    location: locationForLanguage(lang)
  }));
  return [
    ...localized,
    { lang: "x-default", location: locationForLanguage("zh") }
  ];
}

function sitemapUrlEntry(location, lastmod, changefreq, priority, alternates = []) {
  const normalizedLastmod = sitemapDate(lastmod);
  return [
    "  <url>",
    `    <loc>${xmlEscape(location)}</loc>`,
    normalizedLastmod ? `    <lastmod>${xmlEscape(normalizedLastmod)}</lastmod>` : "",
    ...alternates.map(({ lang, location: alternateLocation }) => (
      `    <xhtml:link rel="alternate" hreflang="${xmlEscape(lang)}" href="${xmlEscape(alternateLocation)}"/>`
    )),
    `    <changefreq>${xmlEscape(changefreq)}</changefreq>`,
    `    <priority>${xmlEscape(priority)}</priority>`,
    "  </url>"
  ].filter(Boolean).join("\n");
}

function sitemapDate(value) {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString().slice(0, 10);
}

function latestSitemapLastmod(rows, fallback) {
  const timestamps = rows.flatMap((row) => [row.updated_at, row.published_at, row.created_at])
    .map((value) => Date.parse(value || ""))
    .filter(Number.isFinite);
  return timestamps.length ? new Date(Math.max(...timestamps)).toISOString() : fallback;
}

function xmlEscape(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function getArticle(request, env, slug) {
  const url = new URL(request.url);
  const lang = normalizeArticleLang(url.searchParams.get("lang"));
  const normalizedSlug = normalizeSlug(slug);
  const row = await queryPublishedArticle(env, { lang, slug: normalizedSlug });

  if (!row || !row.title) {
    return json({ error: "文章不存在。" }, 404);
  }

  const payload = { article: toPublicArticle(row, { includeContent: true }), lang };
  const response = await cacheableJson(request, payload, {
    maxAge: 30,
    staleWhileRevalidate: 120,
    cacheScope: "private",
    etagSeed: `${row.article_id}:${row.updated_at || ""}:${row.lang || lang}`
  });
  if (response.status === 304) {
    return response;
  }

  if (shouldSkipAnalyticsRequest(request)) {
    return response;
  }

  let cookieIdentity = getOrCreateVisitorIdentity(request);
  try {
    const view = await recordArticleView(request, env, row, row.lang || lang);
    cookieIdentity = view.cookieIdentity;
    if (view.recorded) {
      await env.DB.prepare("update articles set view_count = view_count + 1 where article_id = ?")
        .bind(row.article_id).run();
    }
  } catch (error) {
    console.error(JSON.stringify({
      message: "article view telemetry failed",
      path: url.pathname,
      error: error instanceof Error ? error.message : String(error)
    }));
  }
  return withVisitorCookie(response, request, cookieIdentity);
}

async function getAdminArticles(request, env) {
  await requireAdmin(request, env);
  await ensureAnalyticsSchema(env);
  const params = new URL(request.url).searchParams;
  const pagination = adminPagination(params, 100);
  const paginated = params.size > 0;
  const filter = adminListFilter(params, "articles");
  const total = await env.DB.prepare(`select count(*) as count from articles ${filter.sql}`).bind(...filter.values).first();
  const retentionStart = new Date(Date.now() - 180 * 86400000).toISOString();
  const rows = (await env.DB.prepare(`
    select
      articles.*,
      coalesce(zh.title, fallback.title, articles.slug) as title,
      count(distinct article_translations.translation_id) as translation_count,
      (
        select count(*)
        from article_view_events
        where article_view_events.article_id = articles.article_id and article_view_events.created_at >= ?
      ) as article_pv,
      (
        select count(distinct visitor_id)
        from article_view_events
        where article_view_events.article_id = articles.article_id and article_view_events.created_at >= ?
      ) as article_uv
    from articles
    left join article_translations on article_translations.article_id = articles.article_id
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
    ${filter.sql}
    group by articles.article_id
    order by articles.updated_at desc, articles.article_id desc
    ${paginated ? "limit ? offset ?" : ""}
  `).bind(retentionStart, retentionStart, ...filter.values, ...(paginated ? [pagination.pageSize, pagination.offset] : [])).all()).results || [];
  return json({ articles: rows.map((row) => ({ ...row, tags: parseTags(row.tags) })), ...adminPageResult(paginated ? pagination : { page: 1, pageSize: Math.max(1, rows.length), offset: 0 }, total?.count), metrics: adminArticleMetricScope() });
}

async function createArticle(request, env) {
  await requireAdmin(request, env);
  const body = await readJson(request);
  const article = normalizeArticlePayload(body);
  assertGenericAdminArticleCategoryMutation(null, article.category, { create: true });
  const now = nowIso();
  const articleId = crypto.randomUUID();
  const publishedAt = article.status === "published" ? (article.published_at || now) : (article.published_at || null);

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

  return json({ ok: true, articleId, slug: article.slug, updatedAt: now }, 201);
}

function assertGenericAdminArticleCategoryMutation(
  existingCategory,
  requestedCategory,
  { create = false } = {}
) {
  const nextCategory = requestedCategory ?? existingCategory;
  if (create && nextCategory === TOOL_RADAR_CHANNEL) {
    throw new HttpError("工具雷达文章必须通过专用自动投递接口创建。", 400);
  }
  if (!create
    && existingCategory !== nextCategory
    && (existingCategory === TOOL_RADAR_CHANNEL || nextCategory === TOOL_RADAR_CHANNEL)) {
    throw new HttpError("工具雷达文章分类由专用自动投递工作流固定管理，不能在通用文章接口中转换。", 400);
  }
}

async function updateArticle(request, env, articleId) {
  await requireAdmin(request, env);
  const body = await readJson(request, MAX_ADMIN_JSON_BYTES, "文章内容过大。");
  const expectedUpdatedAt = expectedUpdatedAtFromBody(body);
  const article = normalizeArticlePayload(body, { partial: true });
  const existing = await env.DB.prepare(
    "select article_id, published_at, category, updated_at from articles where article_id = ?"
  )
    .bind(articleId).first();
  if (!existing) {
    return json({ error: "文章不存在。" }, 404);
  }
  assertGenericAdminArticleCategoryMutation(existing.category, article.category);
  if (existing.updated_at !== expectedUpdatedAt) {
    return contentConflictResponse(existing.updated_at);
  }
  if ((article.category ?? existing.category) === "site-updates") {
    article.is_pinned = 0;
  }

  const now = nextMutationUpdatedAt(existing.updated_at);
  const publishedAt = article.status === "published" && !existing.published_at
    ? (article.published_at || now)
    : (article.published_at === undefined ? existing.published_at : article.published_at);

  const updateStatement = env.DB.prepare(`
    update articles
    set slug = coalesce(?, slug),
        category = coalesce(?, category),
        tags = coalesce(?, tags),
        cover_image = coalesce(?, cover_image),
        status = coalesce(?, status),
        is_pinned = coalesce(?, is_pinned),
        updated_at = ?,
        published_at = ?
    where article_id = ? and updated_at = ?
  `).bind(
    article.slug ?? null,
    article.category ?? null,
    article.tags ? JSON.stringify(article.tags) : null,
    article.cover_image ?? null,
    article.status ?? null,
    article.is_pinned ?? null,
    now,
    publishedAt,
    articleId,
    expectedUpdatedAt
  );
  const mutationResults = await env.DB.batch([
    ...(article.translations
      ? conditionalArticleTranslationsStatements(env, articleId, article.translations, now, expectedUpdatedAt)
      : []),
    updateStatement
  ]);
  const updated = mutationResults[mutationResults.length - 1];
  if (Number(updated?.meta?.changes || 0) !== 1) {
    const current = await env.DB.prepare("select updated_at from articles where article_id = ?")
      .bind(articleId).first();
    return contentConflictResponse(current?.updated_at || null);
  }

  return json({ ok: true, articleId, updatedAt: now });
}

async function deleteArticle(request, env, articleId) {
  await requireAdmin(request, env);
  const normalizedId = normalizeRecordId(articleId, "文章编号不正确。");
  const body = await readJson(request, MAX_ADMIN_JSON_BYTES, "删除请求过大。");
  const expectedUpdatedAt = expectedUpdatedAtFromBody(body);
  const result = await env.DB.prepare(
    "delete from articles where article_id = ? and updated_at = ?"
  ).bind(normalizedId, expectedUpdatedAt).run();
  if (Number(result.meta?.changes || 0) !== 1) {
    const current = await env.DB.prepare("select updated_at from articles where article_id = ?")
      .bind(normalizedId).first();
    if (current) {
      return contentConflictResponse(current.updated_at || null);
    }
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
  const todayIso = adminDateRange(1).todayStart;
  const retentionStart = new Date(Date.now() - 180 * 86400000).toISOString();
  const metrics = await env.DB.prepare(`
    select
      count(*) as article_pv,
      count(distinct visitor_id) as article_uv,
      sum(case when created_at >= ? then 1 else 0 end) as article_today_pv,
      count(distinct case when created_at >= ? then visitor_id end) as article_today_uv
    from article_view_events
    where article_id = ? and created_at >= ?
  `).bind(todayIso, todayIso, normalizedId, retentionStart).first();
  return json({
    metrics: adminArticleMetricScope(),
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

function articleDeliveryChannelConfig(channelKey) {
  const key = String(channelKey || "");
  return Object.prototype.hasOwnProperty.call(ARTICLE_DELIVERY_CHANNELS, key)
    ? ARTICLE_DELIVERY_CHANNELS[key]
    : null;
}

async function getAdminArticleAutomation(request, env, config) {
  await requireAdmin(request, env);
  return json(await articleAutomationAdminSnapshot(env, config));
}

async function updateAdminArticleAutomation(request, env, config) {
  await requireAdmin(request, env);
  const body = await readJson(request, MAX_ADMIN_JSON_BYTES, "自动投递设置内容过大。");
  const expectedUpdatedAt = expectedUpdatedAtFromBody(body);
  if (body.enabled !== undefined && typeof body.enabled !== "boolean") {
    throw new HttpError("请选择启用或暂停自动投递。", 400);
  }
  if (body.autoPublish !== undefined && typeof body.autoPublish !== "boolean") {
    throw new HttpError("请选择是否自动公开文章。", 400);
  }
  if (body.enabled === undefined && body.autoPublish === undefined) {
    throw new HttpError("请提供需要修改的自动投递设置。", 400);
  }
  const channel = await articleDeliveryChannelRow(env, config);
  if (!channel) {
    throw new HttpError("自动投递通道尚未初始化。", 503);
  }
  if (channel.updated_at !== expectedUpdatedAt) {
    return contentConflictResponse(channel.updated_at);
  }
  const enabled = body.enabled === undefined
    ? Number(channel.enabled || 0) === 1
    : body.enabled;
  const autoPublish = body.autoPublish === undefined
    ? Number(channel.auto_publish || 0) === 1
    : body.autoPublish;
  if ((enabled || autoPublish) && !channel.token_hash) {
    return json({
      error: "请先生成连接凭证，再启用自动投递或自动公开。",
      code: "AUTOMATION_TOKEN_REQUIRED"
    }, 400);
  }

  const updatedAt = nextMutationUpdatedAt(channel.updated_at);
  const result = await env.DB.prepare(`
    update article_delivery_channels
    set enabled = ?, auto_publish = ?, updated_at = ?
    where channel_key = ? and updated_at = ?
  `).bind(
    enabled ? 1 : 0,
    autoPublish ? 1 : 0,
    updatedAt,
    config.channelKey,
    expectedUpdatedAt
  ).run();
  if (Number(result.meta?.changes || 0) !== 1) {
    const current = await articleDeliveryChannelRow(env, config);
    return contentConflictResponse(current?.updated_at || null);
  }
  return json({
    ok: true,
    channel: await articleAutomationAdminChannel(env, config)
  });
}

async function rotateAdminArticleAutomationToken(request, env, config) {
  await requireAdmin(request, env);
  const body = await readJson(request, MAX_ADMIN_JSON_BYTES, "凭证请求内容过大。");
  const expectedUpdatedAt = expectedUpdatedAtFromBody(body);
  const channel = await articleDeliveryChannelRow(env, config);
  if (!channel) {
    throw new HttpError("自动投递通道尚未初始化。", 503);
  }
  if (channel.updated_at !== expectedUpdatedAt) {
    return contentConflictResponse(channel.updated_at);
  }

  const token = `${config.tokenPrefix}${randomToken(32)}`;
  const tokenHash = await sha256Hex(token);
  const tokenHint = token.slice(-6);
  const tokenCreatedAt = nowIso();
  const updatedAt = nextMutationUpdatedAt(channel.updated_at);
  const result = await env.DB.prepare(`
    update article_delivery_channels
    set token_hash = ?,
        token_hint = ?,
        token_created_at = ?,
        updated_at = ?
    where channel_key = ? and updated_at = ?
  `).bind(
    tokenHash,
    tokenHint,
    tokenCreatedAt,
    updatedAt,
    config.channelKey,
    expectedUpdatedAt
  ).run();
  if (Number(result.meta?.changes || 0) !== 1) {
    const current = await articleDeliveryChannelRow(env, config);
    return contentConflictResponse(current?.updated_at || null);
  }
  return json({
    ok: true,
    token,
    channel: await articleAutomationAdminChannel(env, config)
  });
}

async function revokeAdminArticleAutomationToken(request, env, config) {
  await requireAdmin(request, env);
  const body = await readJson(request, MAX_ADMIN_JSON_BYTES, "凭证请求内容过大。");
  const expectedUpdatedAt = expectedUpdatedAtFromBody(body);
  const channel = await articleDeliveryChannelRow(env, config);
  if (!channel) {
    throw new HttpError("自动投递通道尚未初始化。", 503);
  }
  if (channel.updated_at !== expectedUpdatedAt) {
    return contentConflictResponse(channel.updated_at);
  }

  const updatedAt = nextMutationUpdatedAt(channel.updated_at);
  const result = await env.DB.prepare(`
    update article_delivery_channels
    set enabled = 0,
        auto_publish = 0,
        token_hash = '',
        token_hint = '',
        token_created_at = null,
        updated_at = ?
    where channel_key = ? and updated_at = ?
  `).bind(
    updatedAt,
    config.channelKey,
    expectedUpdatedAt
  ).run();
  if (Number(result.meta?.changes || 0) !== 1) {
    const current = await articleDeliveryChannelRow(env, config);
    return contentConflictResponse(current?.updated_at || null);
  }
  return json({
    ok: true,
    channel: await articleAutomationAdminChannel(env, config)
  });
}

async function articleAutomationAdminSnapshot(env, config) {
  const [channel, deliveryResult] = await Promise.all([
    articleAutomationAdminChannel(env, config),
    env.DB.prepare(`
      select
        event_id,
        article_delivery_events.article_id,
        article_delivery_events.slug,
        article_delivery_events.title_zh,
        article_delivery_events.source_label,
        coalesce(articles.status, article_delivery_events.status) as status,
        article_delivery_events.created_at
      from article_delivery_events
      left join articles
        on articles.article_id = article_delivery_events.article_id
      where article_delivery_events.channel_key = ?
      order by article_delivery_events.created_at desc, article_delivery_events.event_id desc
      limit 20
    `).bind(config.channelKey).all()
  ]);
  return {
    channel,
    deliveries: (deliveryResult.results || []).map((item) => ({
      eventId: item.event_id,
      articleId: item.article_id || "",
      slug: item.slug,
      title: item.title_zh || item.slug,
      source: item.source_label || "",
      status: item.status || "draft",
      createdAt: item.created_at
    }))
  };
}

async function articleAutomationAdminChannel(env, config) {
  const channel = await articleDeliveryChannelRow(env, config);
  if (!channel) {
    throw new HttpError("自动投递通道尚未初始化。", 503);
  }
  const draft = await env.DB.prepare(`
    select count(*) as count
    from articles
    where category = ? and status = 'draft'
  `).bind(config.category).first();
  return {
    channelKey: config.channelKey,
    category: config.category,
    enabled: Number(channel.enabled || 0) === 1,
    autoPublish: Number(channel.auto_publish || 0) === 1,
    tokenConfigured: Boolean(channel.token_hash),
    tokenHint: channel.token_hint || "",
    tokenCreatedAt: channel.token_created_at || null,
    lastUsedAt: channel.last_used_at || null,
    updatedAt: channel.updated_at,
    draftCount: Number(draft?.count || 0)
  };
}

async function articleDeliveryChannelRow(env, config) {
  return env.DB.prepare(`
    select
      channel_key,
      category,
      enabled,
      auto_publish,
      token_hash,
      token_hint,
      token_created_at,
      last_used_at,
      created_at,
      updated_at
    from article_delivery_channels
    where channel_key = ?
    limit 1
  `).bind(config.channelKey).first();
}

async function authorizeArticleAutomationRequest(request, env, config) {
  const ipInfo = await requestIpInfo(request, env, "analytics");
  const ipLimit = await consumeRateLimit(
    env,
    await rateLimitBucketKey(config.ipRateLimitScope, ipInfo.ipHash),
    ARTICLE_DELIVERY_RATE_LIMITS.ip
  );
  if (!ipLimit.allowed) {
    return { response: rateLimitedResponse(ipLimit.retryAfterSeconds) };
  }

  const token = readArticleAutomationBearerToken(request, config);
  const tokenHash = token ? await sha256Hex(token) : "";
  const channel = await articleDeliveryChannelRow(env, config);
  const validToken = Boolean(
    channel?.token_hash
    && tokenHash
    && timingSafeEqualBytes(
      new TextEncoder().encode(channel.token_hash),
      new TextEncoder().encode(tokenHash)
    )
  );
  if (!validToken) {
    return { response: articleDeliveryUnauthorizedResponse(config) };
  }
  if (Number(channel.enabled || 0) !== 1) {
    return { response: json({
      error: config.disabledMessage,
      code: "AUTOMATION_DISABLED"
    }, 409) };
  }

  const channelLimit = await consumeRateLimit(
    env,
    await rateLimitBucketKey("article-delivery:channel", channel.token_hash),
    ARTICLE_DELIVERY_RATE_LIMITS.channel
  );
  if (!channelLimit.allowed) {
    return { response: rateLimitedResponse(channelLimit.retryAfterSeconds) };
  }
  return { channel };
}

async function deliverArticleAutomation(request, env, config) {
  const authorization = await authorizeArticleAutomationRequest(request, env, config);
  if (authorization.response) {
    return authorization.response;
  }
  const channel = authorization.channel;
  await ensureArticleSchema(env);
  await ensureArticleDeliverySchema(env);
  const body = await readJson(
    request,
    MAX_ARTICLE_DELIVERY_JSON_BYTES,
    config.bodyTooLargeMessage
  );
  const delivery = normalizeArticleAutomationPayload(request, body, config);
  const payloadHash = await articleAutomationPayloadHash(delivery, config);
  // Old receipts hashed the pre-deduplication tag array. Accept that exact legacy
  // representation only for replay; all new writes use normalized tags and hash.
  const legacyPayloadHash = await articleAutomationPayloadHash({
    ...delivery, article: { ...delivery.article, tags: delivery.legacyTags }
  }, config);
  const duplicate = await findArticleAutomationDelivery(env, config, delivery.idempotencyKey);
  if (duplicate) {
    return articleAutomationReplayResponse(duplicate, payloadHash, config, legacyPayloadHash);
  }

  if (config.usesToolCatalog) {
    const featuredTools = await findToolRadarCatalogConflicts(env, delivery.tools);
    if (featuredTools.length) {
      return toolRadarCatalogConflictResponse(featuredTools);
    }
  }

  const slugConflict = await env.DB.prepare(
    "select article_id, slug from articles where slug = ? limit 1"
  ).bind(delivery.article.slug).first();
  if (slugConflict) {
    return json({
      error: "文章路径标识已存在，请更换后重试。",
      code: "ARTICLE_SLUG_CONFLICT"
    }, 409);
  }

  const now = nowIso();
  const articleId = crypto.randomUUID();
  const eventId = crypto.randomUUID();
  const status = Number(channel.auto_publish || 0) === 1 ? "published" : "draft";
  const publishedAt = status === "published" ? now : null;
  try {
    await env.DB.batch([
      env.DB.prepare(`
        insert into articles (
          article_id, slug, category, tags, cover_image, status, is_pinned,
          view_count, created_at, updated_at, published_at
        ) values (?, ?, ?, ?, '', ?, 0, 0, ?, ?, ?)
      `).bind(
        articleId,
        delivery.article.slug,
        config.category,
        JSON.stringify(delivery.article.tags),
        status,
        now,
        now,
        publishedAt
      ),
      ...articleTranslationsStatements(env, articleId, delivery.article.translations, now),
      env.DB.prepare(`
        insert into article_delivery_events (
          event_id, channel_key, idempotency_key, payload_hash, article_id, slug,
          title_zh, source_label, status, created_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        eventId,
        config.channelKey,
        delivery.idempotencyKey,
        payloadHash,
        articleId,
        delivery.article.slug,
        delivery.article.translations.zh.title,
        delivery.source,
        status,
        now
      ),
      env.DB.prepare(`
        update article_delivery_channels
        set last_used_at = ?
        where channel_key = ?
      `).bind(now, config.channelKey),
      ...toolRadarCatalogInsertStatements(env, config, delivery.tools, articleId, now)
    ]);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const repeated = await findArticleAutomationDelivery(env, config, delivery.idempotencyKey);
      if (repeated) {
        return articleAutomationReplayResponse(repeated, payloadHash, config, legacyPayloadHash);
      }
      const conflictingArticle = await env.DB.prepare(
        "select article_id from articles where slug = ? limit 1"
      ).bind(delivery.article.slug).first();
      if (conflictingArticle) {
        return json({
          error: "文章路径标识已存在，请更换后重试。",
          code: "ARTICLE_SLUG_CONFLICT"
        }, 409);
      }
      if (config.usesToolCatalog) {
        const featuredTools = await findToolRadarCatalogConflicts(env, delivery.tools);
        if (featuredTools.length) {
          return toolRadarCatalogConflictResponse(featuredTools);
        }
      }
    }
    throw error;
  }

  return json({
    ok: true,
    duplicate: false,
    articleId,
    slug: delivery.article.slug,
    category: config.category,
    status
  }, 201);
}

function normalizeArticleAutomationPayload(request, body, config) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError("投递内容格式不正确。", 400);
  }
  const forbiddenFields = [
    "article_id",
    "category",
    "status",
    "is_pinned",
    "pinned",
    "published_at",
    "published",
    "cover_image",
    "cover_image_url"
  ].filter((field) => Object.prototype.hasOwnProperty.call(body, field));
  if (forbiddenFields.length) {
    throw new HttpError("投递目标和发布状态由网站固定管理，请移除相关字段。", 400);
  }

  const headerKey = normalizeOptionalText(request.headers.get("Idempotency-Key"), 120);
  const bodyKey = normalizeOptionalText(body.idempotencyKey ?? body.idempotency_key, 120);
  if (headerKey && bodyKey && headerKey !== bodyKey) {
    throw new HttpError("重复保护标记不一致。", 400);
  }
  const idempotencyKey = headerKey || bodyKey;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{7,119}$/.test(idempotencyKey)) {
    throw new HttpError("请提供 8 至 120 位的唯一投递标记。", 400);
  }

  const tagValues = [
    ...config.defaultTags,
    ...(Array.isArray(body.tags) ? body.tags : [])
  ];
  const legacyValues = tagValues.map((tag) => String(tag || "").trim()).filter(Boolean);
  const legacyTags = (config.usesToolCatalog ? [...new Set(legacyValues)] : legacyValues)
    .slice(0, config.usesToolCatalog ? 16 : 12)
    .map((tag) => Array.from(tag).slice(0, config.usesToolCatalog ? 48 : 40).join(""))
    .slice(0, 12).map((tag) => Array.from(tag).slice(0, 40).join(""));
  const tags = config.usesToolCatalog
    ? normalizeTags(tagValues, { maxItems: 16, maxLength: 48, dedupe: true })
    : normalizeTags(tagValues);
  const article = normalizeArticlePayload({
    slug: body.slug,
    category: config.category,
    tags,
    cover_image: "",
    status: "draft",
    is_pinned: false,
    translations: body.translations
  }, {
    summaryMaxLength: config.summaryMaxLength
  });
  article.category = config.category;
  article.cover_image = "";
  article.status = "draft";
  article.is_pinned = 0;
  article.published_at = null;
  const delivery = {
    idempotencyKey,
    legacyTags,
    source: normalizeOptionalText(body.source, config.sourceMaxLength) || "Codex",
    article
  };
  if (config.usesToolCatalog) {
    delivery.tools = normalizeToolRadarTools(body.tools);
    for (const lang of ["zh", "en", "ja"]) {
      if (!delivery.article.translations[lang].summary) {
        throw new HttpError("工具雷达投递需要同时提供 zh / en / ja 三种语言摘要。", 400);
      }
    }
  }
  return delivery;
}

async function findArticleAutomationDelivery(env, config, idempotencyKey) {
  return env.DB.prepare(`
    select
      article_delivery_events.article_id,
      article_delivery_events.slug,
      coalesce(articles.status, article_delivery_events.status) as status,
      article_delivery_events.payload_hash,
      case when articles.article_id is null then 0 else 1 end as article_exists
    from article_delivery_events
    left join articles
      on articles.article_id = article_delivery_events.article_id
    where article_delivery_events.channel_key = ?
      and article_delivery_events.idempotency_key = ?
    limit 1
  `).bind(config.channelKey, idempotencyKey).first();
}

function articleAutomationReplayResponse(row, payloadHash, config, legacyPayloadHash = "") {
  if (Number(row.article_exists || 0) !== 1 || !row.article_id) {
    return json({
      error: "原投递对应的草稿已不存在，请使用新的唯一投递标记。",
      code: "IDEMPOTENCY_TARGET_MISSING"
    }, 409);
  }
  if (!sameSha256Hash(row.payload_hash, payloadHash) && !sameSha256Hash(row.payload_hash, legacyPayloadHash)) {
    return json({
      error: "该唯一投递标记已用于不同内容，请更换后重试。",
      code: "IDEMPOTENCY_CONFLICT"
    }, 409);
  }
  return json(articleAutomationDeliveryResponse(row, true, config));
}

function articleAutomationDeliveryResponse(row, duplicate, config) {
  return {
    ok: true,
    duplicate: Boolean(duplicate),
    articleId: row.article_id || "",
    slug: row.slug,
    category: config.category,
    status: row.status || "draft"
  };
}

async function articleAutomationPayloadHash(delivery, config) {
  const translations = {};
  for (const lang of ["zh", "en", "ja"]) {
    const item = delivery.article.translations[lang];
    translations[lang] = {
      title: item.title,
      summary: item.summary,
      content_markdown: item.content_markdown
    };
  }
  const payload = {
    slug: delivery.article.slug,
    tags: [...delivery.article.tags].sort(),
    source: delivery.source,
    translations
  };
  if (config.usesToolCatalog) {
    payload.tools = delivery.tools.map((tool) => ({
      toolKey: tool.toolKey,
      canonicalUrl: tool.canonicalUrl,
      name: tool.name
    }));
  }
  return sha256Hex(JSON.stringify(payload));
}

function normalizeToolRadarTools(value) {
  if (!Array.isArray(value) || value.length < 3 || value.length > 10) {
    throw new HttpError("工具雷达投递需要提供 3 至 10 个 tools 条目。", 400);
  }
  const toolKeys = new Set();
  const canonicalUrls = new Set();
  const tools = value.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new HttpError("工具目录条目格式不正确。", 400);
    }
    const toolKey = normalizeRequiredText(
      item.toolKey ?? item.tool_key,
      180,
      "工具目录条目需要 toolKey。"
    ).toLowerCase();
    if (!/^[a-z0-9.-]+\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(toolKey)) {
      throw new HttpError("toolKey 需要使用 <规范官网域名>/<产品标识> 格式。", 400);
    }
    const canonicalUrl = normalizeToolRadarCanonicalUrl(
      item.canonicalUrl ?? item.canonical_url,
      toolKey
    );
    const name = normalizeRequiredText(item.name, 120, "工具名称不能为空。");
    if (toolKeys.has(toolKey) || canonicalUrls.has(canonicalUrl)) {
      throw new HttpError("同一次工具雷达投递不能重复提交相同工具或规范网址。", 400);
    }
    toolKeys.add(toolKey);
    canonicalUrls.add(canonicalUrl);
    return { toolKey, canonicalUrl, name };
  });
  return tools.sort((left, right) => left.toolKey.localeCompare(right.toolKey, "en"));
}

function normalizeToolRadarCanonicalUrl(value, toolKey) {
  const raw = normalizeRequiredText(value, 500, "工具目录条目需要 canonicalUrl。");
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new HttpError("工具规范网址格式不正确。", 400);
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new HttpError("工具规范网址必须是无账号信息的 HTTPS 地址。", 400);
  }
  if (url.hash || url.search) {
    throw new HttpError("工具规范网址不能包含查询参数或 hash。", 400);
  }
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  if (toolKey.split("/")[0] !== url.hostname) {
    throw new HttpError("toolKey 的官网域名必须与 canonicalUrl 一致。", 400);
  }
  url.pathname = url.pathname.replace(/\/{2,}/g, "/");
  if (url.pathname !== "/") {
    url.pathname = url.pathname.replace(/\/+$/, "");
  }
  return url.toString();
}

async function findToolRadarCatalogConflicts(env, tools) {
  if (!Array.isArray(tools) || !tools.length) {
    return [];
  }
  const placeholders = tools.map(() => "?").join(", ");
  const result = await env.DB.prepare(`
    select tool_key, canonical_url, name, article_id, created_at
    from tool_radar_catalog
    where tool_key in (${placeholders})
       or canonical_url in (${placeholders})
    order by created_at desc, tool_key asc
  `).bind(
    ...tools.map((tool) => tool.toolKey),
    ...tools.map((tool) => tool.canonicalUrl)
  ).all();
  return result.results || [];
}

function toolRadarCatalogConflictResponse(rows) {
  return json({
    error: "本次投递包含已经介绍过的工具，请移除后使用新的唯一投递标记重试。",
    code: "TOOL_RADAR_TOOL_ALREADY_FEATURED",
    tools: rows.map(publicToolRadarCatalogRow)
  }, 409);
}

function publicToolRadarCatalogRow(row) {
  const item = {
    toolKey: row.tool_key,
    canonicalUrl: row.canonical_url,
    name: row.name,
    articleId: row.article_id || "",
    createdAt: row.created_at
  };
  if (row.article_slug) {
    item.articleSlug = row.article_slug;
  }
  if (row.first_published_at) {
    item.firstPublishedAt = row.first_published_at;
  }
  return item;
}

function toolRadarCatalogInsertStatements(env, config, tools, articleId, now) {
  if (!config.usesToolCatalog) {
    return [];
  }
  return tools.map((tool) => env.DB.prepare(`
    insert into tool_radar_catalog (
      tool_key, canonical_url, name, article_id, created_at
    ) values (?, ?, ?, ?, ?)
  `).bind(
    tool.toolKey,
    tool.canonicalUrl,
    tool.name,
    articleId,
    now
  ));
}

async function getToolRadarAutomationCatalog(request, env, config) {
  const authorization = await authorizeArticleAutomationRequest(request, env, config);
  if (authorization.response) {
    return authorization.response;
  }
  await ensureArticleSchema(env);
  await ensureArticleDeliverySchema(env);
  const maxRows = 5000;
  const result = await env.DB.prepare(`
    select
      tool_radar_catalog.tool_key,
      tool_radar_catalog.canonical_url,
      tool_radar_catalog.name,
      tool_radar_catalog.article_id,
      tool_radar_catalog.created_at,
      articles.slug as article_slug,
      articles.published_at as first_published_at
    from tool_radar_catalog
    left join articles on articles.article_id = tool_radar_catalog.article_id
    order by tool_radar_catalog.created_at desc, tool_radar_catalog.tool_key asc
    limit ?
  `).bind(maxRows + 1).all();
  const rows = result.results || [];
  return json({
    ok: true,
    channel: config.channelKey,
    category: config.category,
    truncated: rows.length > maxRows,
    tools: rows.slice(0, maxRows).map(publicToolRadarCatalogRow)
  });
}

function sameSha256Hash(left, right) {
  const normalizedLeft = String(left || "");
  const normalizedRight = String(right || "");
  if (!/^[a-f0-9]{64}$/.test(normalizedLeft) || !/^[a-f0-9]{64}$/.test(normalizedRight)) {
    return false;
  }
  return timingSafeEqualBytes(
    new TextEncoder().encode(normalizedLeft),
    new TextEncoder().encode(normalizedRight)
  );
}

function readArticleAutomationBearerToken(request, config) {
  const authorization = String(request.headers.get("Authorization") || "").trim();
  const match = authorization.match(/^Bearer\s+([^\s]+)$/i);
  if (!match || match[1].length > 180) {
    return "";
  }
  const token = match[1];
  if (!token.startsWith(config.tokenPrefix)) {
    return "";
  }
  const secret = token.slice(config.tokenPrefix.length);
  return /^[a-zA-Z0-9_-]{32,128}$/.test(secret) ? token : "";
}

function articleDeliveryUnauthorizedResponse(config) {
  const response = json({
    error: "自动投递凭证无效。",
    code: "AUTOMATION_UNAUTHORIZED"
  }, 401);
  response.headers.set("WWW-Authenticate", `Bearer realm="${config.channelKey}"`);
  return response;
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
  const payload = {
    lang,
    categories,
    videos: rows.map((row) => publicVideoRow(row, relations.get(row.video_id) || [], {
      publicThumbnail: true,
      origin: url.origin
    }))
  };
  return cacheableJson(request, payload, {
    maxAge: 30,
    staleWhileRevalidate: 120
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
  const payload = {
    video: publicVideoRow(row, relations.get(row.video_id) || [], {
      publicThumbnail: true,
      origin: new URL(request.url).origin
    })
  };
  return cacheableJson(request, payload, {
    maxAge: 60,
    staleWhileRevalidate: 300
  });
}

async function getVideoThumbnail(request, env, videoId) {
  const normalizedId = normalizeRecordId(videoId, "Video id is invalid.");
  const row = await env.DB.prepare("select video_id, thumbnail_url, updated_at from videos where video_id = ? and status = 'published'")
    .bind(normalizedId).first();
  if (!row) {
    return json({ error: "Video not found." }, 404);
  }
  const thumbnail = publicVideoThumbnail(row.thumbnail_url, row.video_id, new URL(request.url).origin);
  if (!thumbnail.url) {
    return json({ error: "Video thumbnail is unavailable." }, 404);
  }
  if (thumbnail.local) {
    const response = await cacheableBinary(request, thumbnail.bytes, {
      contentType: thumbnail.contentType,
      maxAge: 86400,
      staleWhileRevalidate: 604800,
      etagSeed: `${row.video_id}:${row.updated_at || ""}:${thumbnail.bytes.byteLength}`
    });
    if (response.status !== 304) {
      response.headers.set("Content-Length", String(thumbnail.bytes.byteLength));
    }
    return response;
  }
  return Response.redirect(thumbnail.url, 302);
}

async function getAdminVideos(request, env) {
  await requireAdmin(request, env);
  const params = new URL(request.url).searchParams;
  const pagination = adminPagination(params, 200);
  const filter = adminListFilter(params, "videos");
  const [total, sortOrder, pinnedSortOrder] = await Promise.all([
    env.DB.prepare(`select count(*) as count from videos ${filter.sql}`).bind(...filter.values).first(),
    nextVideoSortOrder(env), nextPinnedVideoSortOrder(env)
  ]);
  const rows = (await env.DB.prepare(`
    select *
    from videos
    ${filter.sql}
    order by
      pinned desc,
      case when pinned = 1 then pinned_sort_order else sort_order end desc,
      case when pinned = 1 then sort_order else 0 end desc,
      updated_at desc,
      created_at desc, video_id desc
    limit ? offset ?
  `).bind(...filter.values, pagination.pageSize, pagination.offset).all()).results || [];
  const relations = await videoRelations(env, rows.map((row) => row.video_id));
  return json({ videos: rows.map((row) => adminVideoRow(row, relations.get(row.video_id) || [])), ...adminPageResult(pagination, total?.count), sortDefaults: { sortOrder, pinnedSortOrder } });
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
  return json({ ok: true, videoId, updatedAt: now }, 201);
}

async function updateVideo(request, env, videoId) {
  await requireAdmin(request, env);
  const normalizedId = normalizeRecordId(videoId, "Video id is invalid.");
  const existing = await env.DB.prepare("select * from videos where video_id = ?").bind(normalizedId).first();
  if (!existing) {
    return json({ error: "Video not found." }, 404);
  }
  const body = await readJson(request, MAX_ADMIN_JSON_BYTES, "视频内容过大。");
  const expectedUpdatedAt = expectedUpdatedAtFromBody(body);
  if (existing.updated_at !== expectedUpdatedAt) {
    return contentConflictResponse(existing.updated_at);
  }
  const video = await normalizeVideoPayload(body, env, { existing });
  await assertVideoNotDuplicate(env, video, normalizedId);
  const now = nextMutationUpdatedAt(existing.updated_at);
  const updateStatement = env.DB.prepare(`
    update videos
    set platform = ?, original_url = ?, external_id = ?, embed_url = ?,
        title = ?, description = ?, thumbnail_url = ?, author_name = ?,
        published_at = ?, status = ?, sort_order = ?, pinned = ?, pinned_sort_order = ?,
        metadata_error = ?, updated_at = ?
    where video_id = ? and updated_at = ?
  `).bind(
    video.platform, video.original_url, video.external_id, video.embed_url,
    video.title, video.description, video.thumbnail_url, video.author_name,
    video.published_at, video.status, video.sort_order, video.pinned,
    video.pinned_sort_order, video.metadata_error, now, normalizedId, expectedUpdatedAt
  );
  const mutationResults = await env.DB.batch([
    env.DB.prepare(`
      delete from video_category_relations
      where video_id = ?
        and exists (
          select 1 from videos
          where video_id = ? and updated_at = ?
        )
    `).bind(normalizedId, normalizedId, expectedUpdatedAt),
    ...conditionalVideoCategoryRelationStatements(
      env,
      normalizedId,
      video.category_ids,
      expectedUpdatedAt
    ),
    updateStatement
  ]);
  const updated = mutationResults[mutationResults.length - 1];
  if (Number(updated?.meta?.changes || 0) !== 1) {
    const current = await env.DB.prepare("select updated_at from videos where video_id = ?")
      .bind(normalizedId).first();
    return contentConflictResponse(current?.updated_at || null);
  }
  return json({ ok: true, videoId: normalizedId, updatedAt: now });
}

async function deleteVideo(request, env, videoId) {
  await requireAdmin(request, env);
  const normalizedId = normalizeRecordId(videoId, "Video id is invalid.");
  const body = await readJson(request, MAX_ADMIN_JSON_BYTES, "删除请求过大。");
  const expectedUpdatedAt = expectedUpdatedAtFromBody(body);
  const result = await env.DB.prepare(
    "delete from videos where video_id = ? and updated_at = ?"
  ).bind(normalizedId, expectedUpdatedAt).run();
  if (Number(result.meta?.changes || 0) !== 1) {
    const current = await env.DB.prepare("select updated_at from videos where video_id = ?")
      .bind(normalizedId).first();
    if (current) {
      return contentConflictResponse(current.updated_at || null);
    }
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
  const body = await readJson(request, MAX_ADMIN_JSON_BYTES, "刷新请求过大。");
  const expectedUpdatedAt = expectedUpdatedAtFromBody(body);
  if (existing.updated_at !== expectedUpdatedAt) {
    return contentConflictResponse(existing.updated_at);
  }
  const metadata = await metadataForVideoUrl(existing.original_url);
  const title = metadata.title || existing.title;
  const description = metadata.description || existing.description;
  const thumbnail = metadata.thumbnail_url || existing.thumbnail_url;
  const author = metadata.author_name || existing.author_name;
  const now = nextMutationUpdatedAt(existing.updated_at);
  const result = await env.DB.prepare(`
    update videos
    set platform = ?, external_id = ?, embed_url = ?, title = ?, description = ?,
        thumbnail_url = ?, author_name = ?, published_at = coalesce(?, published_at),
        metadata_error = ?, updated_at = ?
    where video_id = ? and updated_at = ?
  `).bind(
    metadata.platform, metadata.external_id, metadata.embed_url, title, description,
    thumbnail, author, metadata.published_at || null, metadata.metadata_error || "",
    now, normalizedId, expectedUpdatedAt
  ).run();
  if (Number(result.meta?.changes || 0) !== 1) {
    const current = await env.DB.prepare("select updated_at from videos where video_id = ?")
      .bind(normalizedId).first();
    return contentConflictResponse(current?.updated_at || null);
  }
  return json({
    ok: true,
    updatedAt: now,
    video: { ...metadata, title, description, thumbnail_url: thumbnail, author_name: author }
  });
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
  const existing = await env.DB.prepare(
    "select category_id, sort_order, updated_at from video_categories where category_id = ?"
  )
    .bind(normalizedId).first();
  if (!existing) {
    return json({ error: "Category not found." }, 404);
  }
  const body = await readJson(request, MAX_ADMIN_JSON_BYTES, "分类内容过大。");
  const expectedUpdatedAt = expectedUpdatedAtFromBody(body);
  if (existing.updated_at !== expectedUpdatedAt) {
    return contentConflictResponse(existing.updated_at);
  }
  const category = normalizeVideoCategoryPayload(body, { defaultSortOrder: existing.sort_order });
  const now = nextMutationUpdatedAt(existing.updated_at);
  const updated = await env.DB.prepare(`
    update video_categories
    set slug = ?, name_zh = ?, name_en = ?, name_ja = ?, sort_order = ?, enabled = ?, updated_at = ?
    where category_id = ? and updated_at = ?
  `).bind(
    category.slug, category.name_zh, category.name_en, category.name_ja,
    category.sort_order, category.enabled, now, normalizedId, expectedUpdatedAt
  ).run();
  if (Number(updated?.meta?.changes || 0) !== 1) {
    const current = await env.DB.prepare("select updated_at from video_categories where category_id = ?")
      .bind(normalizedId).first();
    return contentConflictResponse(current?.updated_at || null);
  }
  return json({ ok: true, categoryId: normalizedId, updatedAt: now });
}

async function deleteVideoCategory(request, env, categoryId) {
  await requireAdmin(request, env);
  const normalizedId = normalizeRecordId(categoryId, "Category id is invalid.");
  const body = await readJson(request, MAX_ADMIN_JSON_BYTES, "删除请求过大。");
  const expectedUpdatedAt = expectedUpdatedAtFromBody(body);
  const result = await env.DB.prepare(`
    delete from video_categories
    where category_id = ? and updated_at = ?
      and not exists (
        select 1 from video_category_relations
        where video_category_relations.category_id = video_categories.category_id
      )
  `).bind(normalizedId, expectedUpdatedAt).run();
  if (Number(result.meta?.changes || 0) !== 1) {
    const current = await env.DB.prepare(
      "select updated_at from video_categories where category_id = ?"
    ).bind(normalizedId).first();
    if (!current) {
      return json({ error: "Category not found." }, 404);
    }
    if (current.updated_at !== expectedUpdatedAt) {
      return contentConflictResponse(current.updated_at || null);
    }
    const usage = await env.DB.prepare(
      "select count(*) as count from video_category_relations where category_id = ?"
    ).bind(normalizedId).first();
    if (Number(usage?.count || 0) > 0) {
      return json({
        error: "这个分类已有视频使用，请先移动或取消关联后再删除。",
        videoCount: Number(usage.count)
      }, 409);
    }
    return json({ error: "Category not found." }, 404);
  }
  return json({ ok: true });
}

async function getSocialLinks(request, env) {
  const links = await socialLinkRows(env);
  return cacheableJson(request, { links }, {
    maxAge: 60,
    staleWhileRevalidate: 300,
    etagSeed: links.map((link) => `${link.key || link.id || ""}:${link.url || ""}:${link.updated_at || ""}`).join("|")
  });
}

async function getAdminSocialLinks(request, env) {
  await requireAdmin(request, env);
  const state = await socialLinksState(env);
  return json({
    links: socialLinkRowsFromValue(state.value, state.updatedAt || ""),
    updatedAt: state.updatedAt
  });
}

async function updateAdminSocialLinks(request, env) {
  await requireAdmin(request, env);
  const body = await readJson(request, MAX_ADMIN_JSON_BYTES, "社交链接内容过大。");
  const expectedUpdatedAt = expectedUpdatedAtFromBody(body, { allowNull: true });
  const links = normalizeSocialLinksPayload(body);
  const state = await socialLinksState(env);
  if (state.updatedAt !== expectedUpdatedAt) {
    return contentConflictResponse(state.updatedAt);
  }
  const now = nextMutationUpdatedAt(state.updatedAt);
  const result = expectedUpdatedAt === null
    ? await env.DB.prepare(`
        insert or ignore into site_runtime_state (key, value, updated_at)
        values (?, ?, ?)
      `).bind(SOCIAL_LINKS_STATE_KEY, JSON.stringify(links), now).run()
    : await env.DB.prepare(`
        update site_runtime_state
        set value = ?, updated_at = ?
        where key = ? and updated_at = ?
      `).bind(JSON.stringify(links), now, SOCIAL_LINKS_STATE_KEY, expectedUpdatedAt).run();
  if (Number(result?.meta?.changes || 0) !== 1) {
    const current = await env.DB.prepare("select updated_at from site_runtime_state where key = ?")
      .bind(SOCIAL_LINKS_STATE_KEY).first();
    return contentConflictResponse(current?.updated_at || null);
  }
  return json({
    ok: true,
    links: socialLinkRowsFromValue(links, now),
    updatedAt: now
  });
}

async function socialLinkRows(env) {
  const state = await socialLinksState(env);
  return socialLinkRowsFromValue(state.value, state.updatedAt || "");
}

async function socialLinksState(env) {
  const row = await env.DB.prepare("select value, updated_at from site_runtime_state where key = ?")
    .bind(SOCIAL_LINKS_STATE_KEY).first();
  let stored = {};
  try {
    const parsed = row?.value ? JSON.parse(row.value) : {};
    stored = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    stored = {};
  }
  return {
    value: stored,
    updatedAt: row?.updated_at || null
  };
}

function socialLinkRowsFromValue(value, updatedAt = "") {
  return SOCIAL_LINK_PLATFORMS.map(([platform, label, defaultUrl]) => ({
    platform,
    label,
    url: normalizeStoredSocialLinkUrl(value?.[platform], label, defaultUrl),
    default_url: defaultUrl,
    updated_at: updatedAt
  }));
}

function normalizeSocialLinksPayload(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError("社交链接数据格式不正确。", 400);
  }
  const links = {};
  for (const [platform, label, defaultUrl] of SOCIAL_LINK_PLATFORMS) {
    links[platform] = normalizeSocialLinkUrl(socialLinkInputValue(body, platform), label, defaultUrl);
  }
  return links;
}

function socialLinkInputValue(body, platform) {
  const source = body.links && typeof body.links === "object" ? body.links : body;
  if (Array.isArray(source)) {
    const item = source.find((entry) => String(entry?.platform || entry?.id || "").trim().toLowerCase() === platform);
    return item?.url || "";
  }
  const value = source?.[platform] ?? Object.entries(source || {}).find(([key]) => key.trim().toLowerCase() === platform)?.[1];
  return value && typeof value === "object" ? value.url : value;
}

function normalizeStoredSocialLinkUrl(value, label, defaultUrl) {
  try {
    return normalizeSocialLinkUrl(value && typeof value === "object" ? value.url : value, label, defaultUrl);
  } catch {
    return defaultUrl;
  }
}

function normalizeSocialLinkUrl(value, label, defaultUrl) {
  const raw = normalizeOptionalText(value, 800);
  if (!raw) {
    return defaultUrl;
  }
  const withProtocol = /^[a-z][a-z0-9+.-]*:/i.test(raw)
    ? raw
    : `https://${raw.replace(/^\/+/, "")}`;
  try {
    const url = new URL(withProtocol);
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error("unsupported protocol");
    }
    return url.href;
  } catch {
    throw new HttpError(`${label} 链接必须是有效的 http(s) 地址。`, 400);
  }
}

async function adminMe(request, env) {
  const session = await requireAdmin(request, env);
  return json({ user: session.user });
}

async function getAdminAccounts(request, env) {
  await requireAdmin(request, env);
  const now = nowIso();
  const params = new URL(request.url).searchParams;
  const pagination = adminPagination(params, 500);
  const filter = adminListFilter(params, "accounts");
  const total = await env.DB.prepare(`select count(*) as count from users ${filter.sql}`).bind(...filter.values).first();
  const rows = (await env.DB.prepare(`
    select
      users.id,
      users.email,
      case
        when substr(users.password_hash, 1, 14) = 'pbkdf2_sha256$' then 'pbkdf2'
        when users.password_hash is not null and users.password_hash <> '' then 'legacy'
        else ''
      end as password_scheme,
      users.role,
      users.created_at,
      users.updated_at,
      (select count(*) from sessions where sessions.user_id = users.id and sessions.expires_at > ?) as active_sessions,
      (select max(created_at) from sessions where sessions.user_id = users.id) as last_session_at,
      (select max(created_at) from user_login_events where user_login_events.user_id = users.id) as last_login_at,
      (select count(*) from user_login_events where user_login_events.user_id = users.id) as login_count,
      (select count(*) from game_saves where game_saves.user_id = users.id) as save_slots
    from users
    ${filter.sql}
    order by case when users.role = 'admin' then 0 else 1 end, users.updated_at desc, users.id desc
    limit ? offset ?
  `).bind(now, ...filter.values, pagination.pageSize, pagination.offset).all()).results || [];
  return json({ accounts: rows.map(adminAccountRow), ...adminPageResult(pagination, total?.count) });
}

async function getAdminAccount(request, env, userId) {
  await requireAdmin(request, env);
  const normalizedId = normalizeRecordId(userId, "账号编号不正确。");
  const account = await env.DB.prepare(`
    select
      id,
      email,
      case
        when substr(password_hash, 1, 14) = 'pbkdf2_sha256$' then 'pbkdf2'
        when password_hash is not null and password_hash <> '' then 'legacy'
        else ''
      end as password_scheme,
      role,
      created_at,
      updated_at
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
  const expectedUpdatedAt = adminRequiredUpdatedAt(body);
  const existing = await env.DB.prepare(`
    select id, email, role, created_at, updated_at,
      case when substr(password_hash, 1, 14) = 'pbkdf2_sha256$' then 'pbkdf2'
           when password_hash is not null and password_hash <> '' then 'legacy'
           else '' end as password_scheme
    from users where id = ?
  `)
    .bind(normalizedId).first();
  if (!existing) {
    return json({ error: "账号不存在。" }, 404);
  }

  if (existing.updated_at !== expectedUpdatedAt) return contentConflictResponse(existing.updated_at);

  const nextEmail = body.email === undefined ? normalizeEmail(existing.email) : normalizeEmail(body.email);
  validateEmail(nextEmail);
  const nextRole = normalizeAccountRole(body.role === undefined ? existing.role : body.role);
  const password = String(body.password || body.newPassword || "");
  const passwordChanged = password.trim().length > 0;
  const revokeSessions = body.revokeSessions !== false;

  const ownerEmails = ownerAdminEmails(env);
  const existingEmail = normalizeEmail(existing.email);
  const existingIsOwner = ownerEmails.has(existingEmail);
  const nextIsOwner = ownerEmails.has(nextEmail);
  if ((existingIsOwner || nextIsOwner) && nextRole !== "admin") {
    throw new HttpError("站长账号必须保留管理员权限。", 400);
  }
  if (existingIsOwner && nextEmail !== existingEmail) {
    throw new HttpError("站长账号邮箱由运行时配置保护，不能在后台修改。", 400);
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
  const updatedAt = nextMutationUpdatedAt(existing.updated_at);
  const binds = [nextEmail, nextRole, updatedAt];
  if (passwordChanged) {
    fields.splice(2, 0, "password_hash = ?");
    binds.splice(2, 0, await hashPassword(password));
  }
  binds.push(existing.id, expectedUpdatedAt, nextRole);
  const statements = [env.DB.prepare(`
    update users
    set ${fields.join(", ")}
    where id = ? and updated_at = ?
      and (
        role <> 'admin'
        or ? = 'admin'
        or exists (
          select 1
          from users as other_admin
          where other_admin.role = 'admin'
            and other_admin.id <> users.id
        )
      )
  `).bind(...binds)];
  if (passwordChanged && revokeSessions) {
    // D1 batch is transactional; changes() refers to the immediately preceding CAS.
    statements.push(existing.id === adminSession.user.id
      ? env.DB.prepare("delete from sessions where user_id = ? and token_hash <> ? and changes() > 0")
        .bind(existing.id, adminSession.tokenHash)
      : env.DB.prepare("delete from sessions where user_id = ? and changes() > 0").bind(existing.id));
  }
  const [updateResult] = await env.DB.batch(statements);

  if (!updateResult?.meta?.changes) {
    const current = await env.DB.prepare("select id, role, updated_at from users where id = ?").bind(existing.id).first();
    if (!current) {
      return json({ error: "账号不存在。" }, 404);
    }
    if (current.updated_at !== expectedUpdatedAt) return contentConflictResponse(current.updated_at);
    throw new HttpError("不能移除最后一个管理员；请先为其他账号授予管理员权限。", 409);
  }

  try {
    const detail = await getAdminAccount(request, env, existing.id);
    if (!detail.ok) throw new Error("Account detail readback unavailable.");
    return detail;
  } catch {
    // The mutation has committed. A failed optional detail read must not invite a
    // retry of a password reset or make the editor discard its new revision.
    const safeAccount = adminAccountRow({
      ...existing, email: nextEmail, role: nextRole, updated_at: updatedAt,
      password_scheme: passwordChanged ? "pbkdf2" : existing.password_scheme
    });
    const account = { ...safeAccount };
    for (const field of ["last_login_at", "active_sessions", "login_count", "save_slots"]) delete account[field];
    return json({
      ok: true, updatedAt, account, passwordChanged,
      sessionsRevoked: passwordChanged && revokeSessions,
      readbackWarning: {
        code: "ACCOUNT_DETAIL_REFRESH_FAILED",
        message: "账号修改已保存，但详情读取失败，请稍后刷新。"
      }
    });
  }
}

async function getAdminTrafficControl(request, env) {
  await requireAdmin(request, env);
  return json(await getTrafficControlAdminSnapshot(env));
}

async function updateAdminTrafficControl(request, env) {
  const adminSession = await requireAdmin(request, env);
  const body = await readJson(request, MAX_ADMIN_JSON_BYTES, "流量策略内容过大。");
  await updateTrafficControlSettings(env, body, adminSession.user.id);
  return json(await getTrafficControlAdminSnapshot(env));
}

async function identifyVisitor(request, env) {
  const body = await readOptionalJson(request, MAX_ANALYTICS_JSON_BYTES, "统计请求内容过大。");
  const identity = await analyticsIdentityForRequest(request, env);
  const decision = await telemetryWriteDecision(env, {
    kind: "identify",
    identity: identity.visitorId,
    fingerprint: normalizeAnalyticsText(body?.language, 160)
  });
  if (!decision.record) {
    return withVisitorCookie(json({ ok: true, recorded: false }), request, identity.cookieIdentity);
  }
  const geo = await requestIpInfo(request, env, "analytics");
  const limited = await consumeFirstExceededRateLimit(env, [
    [await rateLimitBucketKey("analytics:identify:ip", geo.ipHash), ANALYTICS_RATE_LIMITS.identifyIp],
    [await rateLimitBucketKey("analytics:identify:visitor", identity.visitorId), ANALYTICS_RATE_LIMITS.identifyVisitor]
  ]);
  if (!limited) {
    await ensureVisitorProfile(env, request, identity.visitorId, body || {}, false, geo);
  }
  return withVisitorCookie(json({ ok: true }), request, identity.cookieIdentity);
}

async function recordPageView(request, env) {
  const body = await readOptionalJson(request, MAX_ANALYTICS_JSON_BYTES, "统计请求内容过大。");
  const identity = await analyticsIdentityForRequest(request, env);
  const now = nowIso();
  const path = normalizeAnalyticsPath(body?.path);
  const decision = await telemetryWriteDecision(env, {
    kind: "pageViews",
    identity: identity.visitorId,
    fingerprint: path
  });
  if (!decision.record) {
    return withVisitorCookie(json({ ok: true, recorded: false }), request, identity.cookieIdentity);
  }
  const geo = await requestIpInfo(request, env, "analytics");
  const limited = await consumeFirstExceededRateLimit(env, [
    [await rateLimitBucketKey("analytics:page-view:ip", geo.ipHash), ANALYTICS_RATE_LIMITS.pageViewIp],
    [await rateLimitBucketKey("analytics:page-view:visitor", identity.visitorId), ANALYTICS_RATE_LIMITS.pageViewVisitor],
    [await rateLimitBucketKey("analytics:page-view:dedupe", `${identity.visitorId}:${path}`), ANALYTICS_RATE_LIMITS.pageViewDuplicate]
  ]);
  if (limited) {
    return withVisitorCookie(json({ ok: true }), request, identity.cookieIdentity);
  }
  await ensureVisitorProfile(env, request, identity.visitorId, body || {}, true, geo);
  await env.DB.prepare(`
    insert into analytics_page_views (
      event_id, visitor_id, path, route, referrer, title, lang,
      screen_width, screen_height, country, region, city, timezone,
      colo, latitude, longitude, ip_hash, ip_prefix, created_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    crypto.randomUUID(),
    identity.visitorId,
    path,
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
  const body = await readOptionalJson(request, MAX_ANALYTICS_JSON_BYTES, "统计请求内容过大。");
  const identity = await analyticsIdentityForRequest(request, env);
  const now = nowIso();
  const path = normalizeAnalyticsPath(body?.path);
  const targetKey = normalizeAnalyticsText(body?.targetKey, 160);
  const clickFingerprint = [
    identity.visitorId,
    path,
    targetKey,
    normalizeAnalyticsText(body?.dataRoute, 80),
    normalizeInteger(body?.x, -100000, 100000),
    normalizeInteger(body?.y, -100000, 100000)
  ].join(":");
  const decision = await telemetryWriteDecision(env, {
    kind: "clicks",
    identity: identity.visitorId,
    fingerprint: clickFingerprint
  });
  if (!decision.record) {
    return withVisitorCookie(json({ ok: true, recorded: false }), request, identity.cookieIdentity);
  }
  const geo = await requestIpInfo(request, env, "analytics");
  const limited = await consumeFirstExceededRateLimit(env, [
    [await rateLimitBucketKey("analytics:click:ip", geo.ipHash), ANALYTICS_RATE_LIMITS.clickIp],
    [await rateLimitBucketKey("analytics:click:visitor", identity.visitorId), ANALYTICS_RATE_LIMITS.clickVisitor],
    [await rateLimitBucketKey("analytics:click:dedupe", clickFingerprint), ANALYTICS_RATE_LIMITS.clickDuplicate]
  ]);
  if (limited) {
    return withVisitorCookie(json({ ok: true }), request, identity.cookieIdentity);
  }
  await ensureVisitorProfile(env, request, identity.visitorId, body || {}, false, geo);
  await env.DB.prepare(`
    insert into analytics_click_events (
      event_id, visitor_id, path, route, target_key, target_text, tag_name,
      element_id, element_classes, href, data_route, screen_width, screen_height,
      click_x, click_y, country, region, city, timezone, colo, ip_hash, ip_prefix, created_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    crypto.randomUUID(),
    identity.visitorId,
    path,
    normalizeAnalyticsText(body?.route, 80),
    targetKey,
    normalizeAnalyticsTargetText(body?.targetText, 160),
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
  if (shouldSkipAnalyticsRequest(request)) {
    return { cookieIdentity: null, recorded: false };
  }
  await ensureAnalyticsSchema(env);
  const identity = await analyticsIdentityForRequest(request, env);
  if (!analyticsReadSourceIsTrusted(request)) {
    return { ...identity, recorded: false };
  }
  const decision = await telemetryWriteDecision(env, {
    kind: "articleViews",
    identity: identity.visitorId,
    fingerprint: `${article.article_id}:${normalizeArticleLang(lang)}`
  });
  if (!decision.record) {
    return { ...identity, recorded: false };
  }
  const now = nowIso();
  const geo = await requestIpInfo(request, env, "analytics");
  const limited = await consumeFirstExceededRateLimit(env, [
    [await rateLimitBucketKey("analytics:article:ip", geo.ipHash), ANALYTICS_RATE_LIMITS.articleIp],
    [await rateLimitBucketKey(
      "analytics:article:visitor",
      `${identity.visitorId}:${article.article_id}`
    ), ANALYTICS_RATE_LIMITS.articleVisitor]
  ]);
  if (limited) {
    return { ...identity, recorded: false };
  }
  await ensureVisitorProfile(env, request, identity.visitorId, {
    language: request.headers.get("Accept-Language") || ""
  }, false, geo);
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
  return { ...identity, recorded: true };
}

async function getAdminAnalyticsOverview(request, env) {
  await requireAdmin(request, env);
  const params = new URL(request.url).searchParams;
  const [overview, settingsResult, usageResult] = await Promise.all([
    readAdminAnalyticsOverview(env.DB, params.get("days")),
    ensureTrafficControlSettings(env).then((value) => ({ value }), () => ({ unavailable: true })),
    getTrafficUsageSnapshot(env, { useCache: false }).then((value) => ({ value }), () => ({ unavailable: true }))
  ]);
  const settings = settingsResult.value?.settings;
  const usage = usageResult.value;
  const mode = usage?.protectionMode;
  const sampling = settings && mode ? {
    pageViews: settings.analyticsEnabled && settings.pageViewsEnabled ? settings.sampling[mode].pageViews : 0,
    clicks: settings.analyticsEnabled && settings.clicksEnabled ? settings.sampling[mode].clicks : 0,
    articleViews: settings.analyticsEnabled && settings.articleViewsEnabled ? settings.sampling[mode].articleViews : 0
  } : null;
  return json({
    ...overview,
    cities: overview.cities.map(adminAnalyticsCityRow),
    collection: {
      mode: "observed", historicalSampling: "unknown",
      current: sampling ? { mode, sampling, generatedAt: usage.generatedAt,
        settingsUpdatedAt: settingsResult.value.updatedAt, budgetTimeZone: usage.timezone,
        analyticsEnabled: settings.analyticsEnabled, identifyEnabled: settings.identifyEnabled } : null,
      status: sampling ? "available" : "unavailable",
      note: "仅显示已采集事件；历史采样率未保存，不能还原完整流量。当前采样只说明此刻策略，不代表整个统计区间。"
    }
  });
}

function adminAnalyticsCityRow(row) {
  const latitude = Number(row?.latitude);
  const longitude = Number(row?.longitude);
  return {
    country: row?.country || "",
    region: row?.region || "",
    city: row?.city || "",
    pv: Number(row?.pv || 0),
    uv: Number(row?.uv || 0),
    last_seen_at: row?.last_seen_at || "",
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null
  };
}

async function getAdminChatMessages(request, env) {
  await requireAdmin(request, env);
  await ensureAnalyticsSchema(env);
  const currentIpHashKeyId = await chatIpHashKeyId(runtimeSecret(env, "CHAT_IP_HASH_SALT"));
  const url = new URL(request.url);
  const pagination = adminPagination(url.searchParams, 100);
  const filter = adminListFilter(url.searchParams, "messages");
  const total = await env.DB.prepare(`select count(*) as count from anonymous_chat_messages ${filter.sql}`).bind(...filter.values).first();
  const rows = (await env.DB.prepare(`
    select
      anonymous_chat_messages.message_id,
      anonymous_chat_messages.visitor_id,
      anonymous_chat_messages.client_id,
      anonymous_chat_messages.nickname,
      case when anonymous_chat_messages.encrypted = 1 then '' else anonymous_chat_messages.content end as content,
      anonymous_chat_messages.room_key,
      anonymous_chat_messages.encrypted,
      anonymous_chat_messages.created_at,
      anonymous_chat_messages.edited_at,
      coalesce(anonymous_chat_messages.edited_at, anonymous_chat_messages.created_at) as updated_at,
      anonymous_chat_messages.hidden,
      anonymous_chat_messages.ip_hash,
      case
        when anonymous_chat_messages.ip_hash_key_id = ? then 1
        else 0
      end as ip_hash_current,
      anonymous_chat_messages.ip_prefix,
      site_visitors.country,
      site_visitors.region,
      site_visitors.city,
      site_visitors.last_seen_at
    from anonymous_chat_messages
    left join site_visitors on site_visitors.visitor_id = anonymous_chat_messages.visitor_id
    ${filter.sql}
    order by anonymous_chat_messages.created_at desc, anonymous_chat_messages.message_id desc
    limit ? offset ?
  `).bind(currentIpHashKeyId, ...filter.values, pagination.pageSize, pagination.offset).all()).results || [];
  return json({ messages: rows, ...adminPageResult(pagination, total?.count) });
}

async function updateAdminChatMessage(request, env, messageId) {
  await requireAdmin(request, env);
  const body = await readJson(request);
  const expectedUpdatedAt = adminRequiredUpdatedAt(body);
  const normalizedId = normalizeRecordId(messageId, "消息编号不正确。");
  const existing = await env.DB.prepare("select message_id, encrypted, coalesce(edited_at, created_at) as updated_at from anonymous_chat_messages where message_id = ?")
    .bind(normalizedId).first();
  if (!existing) {
    return json({ error: "消息不存在。" }, 404);
  }
  if (existing.updated_at !== expectedUpdatedAt) return contentConflictResponse(existing.updated_at);
  const updatedAt = nextMutationUpdatedAt(existing.updated_at);
  const nickname = body.nickname === undefined ? undefined : normalizeChatNickname(body.nickname);
  if (Number(existing.encrypted) === 1 && body.content !== undefined) {
    return json({ error: "加密消息内容不能在后台编辑。" }, 400);
  }
  const content = body.content === undefined ? undefined : normalizeChatContent(body.content);
  const hidden = body.hidden === undefined ? undefined : (body.hidden ? 1 : 0);
  const result = await env.DB.prepare(`
    update anonymous_chat_messages
    set nickname = coalesce(?, nickname),
        content = coalesce(?, content),
        hidden = coalesce(?, hidden),
        edited_at = ?
    where message_id = ? and coalesce(edited_at, created_at) = ?
  `).bind(nickname ?? null, content ?? null, hidden ?? null, updatedAt, normalizedId, expectedUpdatedAt).run();
  if (!result.meta?.changes) {
    const current = await env.DB.prepare("select coalesce(edited_at, created_at) as updated_at from anonymous_chat_messages where message_id = ?").bind(normalizedId).first();
    return current ? contentConflictResponse(current.updated_at) : json({ error: "消息不存在。" }, 404);
  }
  return json({ ok: true, updatedAt });
}

async function deleteAdminChatMessage(request, env, messageId) {
  await requireAdmin(request, env);
  const expectedUpdatedAt = adminRequiredUpdatedAt(await readJson(request));
  const normalizedId = normalizeRecordId(messageId, "消息编号不正确。");
  const result = await env.DB.prepare("delete from anonymous_chat_messages where message_id = ? and coalesce(edited_at, created_at) = ?")
    .bind(normalizedId, expectedUpdatedAt).run();
  if (!result.meta?.changes) {
    const current = await env.DB.prepare("select coalesce(edited_at, created_at) as updated_at from anonymous_chat_messages where message_id = ?").bind(normalizedId).first();
    if (current) return contentConflictResponse(current.updated_at);
    return json({ error: "消息不存在。" }, 404);
  }
  return json({ ok: true });
}

async function deleteAdminPrivateChatRoom(request, env, roomKeyValue) {
  await requireAdmin(request, env);
  const roomKey = normalizeChatRoomKey(roomKeyValue);
  if (!isPrivateChatRoom(roomKey)) {
    return json({ error: "公共聊天室不能按房间删除。" }, 409);
  }
  const result = await env.DB.prepare("delete from anonymous_chat_messages where room_key = ?")
    .bind(roomKey).run();
  return json({
    ok: true,
    roomKey,
    deletedMessages: Number(result.meta?.changes || 0)
  });
}

async function getAdminChatBans(request, env) {
  await requireAdmin(request, env);
  const currentIpHashKeyId = await chatIpHashKeyId(runtimeSecret(env, "CHAT_IP_HASH_SALT"));
  const now = nowIso();
  const params = new URL(request.url).searchParams;
  const pagination = adminPagination(params, 100);
  const filter = adminListFilter(params, "bans", { currentIpHashKeyId, now });
  const total = await env.DB.prepare(`select count(*) as count from chat_bans ${filter.sql}`).bind(...filter.values).first();
  const rows = (await env.DB.prepare(`
    select
      chat_bans.*,
      users.email as created_by_email,
      case
        when chat_bans.ban_type not in ('ip_hash', 'ip') or chat_bans.ip_hash_key_id = ? then 1
        else 0
      end as target_current,
      case
        when chat_bans.expires_at is not null and chat_bans.expires_at <= ? then 1
        else 0
      end as expired,
      case
        when chat_bans.active = 1
          and (chat_bans.expires_at is null or chat_bans.expires_at > ?)
          and (chat_bans.ban_type not in ('ip_hash', 'ip') or chat_bans.ip_hash_key_id = ?)
        then 1
        else 0
      end as effective
    from chat_bans
    left join users on users.id = chat_bans.created_by
    ${filter.sql}
    order by chat_bans.created_at desc, chat_bans.ban_id desc
    limit ? offset ?
  `).bind(currentIpHashKeyId, now, now, currentIpHashKeyId, ...filter.values, pagination.pageSize, pagination.offset).all()).results || [];
  return json({ bans: rows, ...adminPageResult(pagination, total?.count) });
}

async function createAdminChatBan(request, env) {
  const session = await requireAdmin(request, env);
  const body = await readJson(request);
  const banType = String(body.type || body.ban_type || "").trim();
  if (!["visitor", "ip_hash"].includes(banType)) {
    return json({ error: "禁言类型只能是 visitor 或 ip_hash。" }, 400);
  }
  const visitorId = banType === "visitor"
    ? normalizeRecordId(body.visitorId || body.visitor_id, "访客 ID 不正确。")
    : "";
  let ipHash = "";
  let ipPrefix = "";
  let ipHashKeyId = LEGACY_IP_HASH_KEY_ID;
  if (banType === "ip_hash") {
    const messageId = normalizeRecordId(body.messageId || body.message_id, "消息编号不正确。");
    const target = await env.DB.prepare(`
      select ip_hash, ip_hash_key_id, ip_prefix
      from anonymous_chat_messages
      where message_id = ?
    `).bind(messageId).first();
    if (!target) {
      return json({ error: "消息不存在，无法按网络来源禁言。" }, 404);
    }
    const currentIpHashKeyId = await chatIpHashKeyId(runtimeSecret(env, "CHAT_IP_HASH_SALT"));
    if (target.ip_hash_key_id !== currentIpHashKeyId) {
      return json({ error: "这条消息使用旧代次网络指纹，不能新建网络来源禁言；请等待该来源产生新消息。" }, 409);
    }
    ipHash = normalizeIpHash(target.ip_hash);
    ipPrefix = normalizeIpPrefix(target.ip_prefix);
    ipHashKeyId = currentIpHashKeyId;
  }
  const reason = normalizeAnalyticsText(body.reason, 200) || "后台禁言";
  const durationHours = Number(body.durationHours || body.duration_hours || 0);
  const expiresAt = Number.isFinite(durationHours) && durationHours > 0
    ? new Date(Date.now() + Math.min(durationHours, 24 * 365) * 60 * 60 * 1000).toISOString()
    : null;

  const banId = crypto.randomUUID();
  await env.DB.prepare(`
    insert into chat_bans (
      ban_id, ban_type, visitor_id, ip_hash, ip_hash_key_id, ip_prefix, reason,
      active, created_by, created_at, expires_at
    ) values (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
  `).bind(
    banId,
    banType,
    visitorId,
    ipHash,
    ipHashKeyId,
    ipPrefix,
    reason,
    session.user.id,
    nowIso(),
    expiresAt
  ).run();
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

async function activeChatBan(env, visitorId, ipHash, ipHashKeyId) {
  return env.DB.prepare(`
    select ban_id, ban_type, reason, expires_at
    from chat_bans
    where active = 1
      and (expires_at is null or expires_at > ?)
      and (
        (visitor_id <> '' and visitor_id = ?)
        or (ip_hash <> '' and ip_hash_key_id = ? and ip_hash = ?)
      )
    order by created_at desc
    limit 1
  `).bind(nowIso(), visitorId, ipHashKeyId, ipHash).first();
}

async function cleanupExpiredPrivateChatRooms(env) {
  const cutoff = new Date(Date.now() - CHAT_PRIVATE_ROOM_TTL_MS).toISOString();
  const rows = (await env.DB.prepare(`
    select room_key
    from anonymous_chat_messages
    where room_key <> ?
    group by room_key
    having max(created_at) < ?
    limit 20
  `).bind(PUBLIC_CHAT_ROOM_KEY, cutoff).all()).results || [];
  if (!rows.length) {
    return;
  }
  const deletes = rows
    .map((row) => String(row.room_key || "").trim())
    .filter((roomKey) => roomKey && roomKey !== PUBLIC_CHAT_ROOM_KEY)
    .map((roomKey) => env.DB.prepare("delete from anonymous_chat_messages where room_key = ?").bind(roomKey));
  if (deletes.length) {
    await env.DB.batch(deletes);
  }
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
        ip_hash_key_id text not null default 'legacy',
        ip_prefix text not null default '',
        room_key text not null default 'public',
        encrypted integer not null default 0,
        client_request_id text not null default ''
      )
    `),
    env.DB.prepare(`
      create table if not exists chat_bans (
        ban_id text primary key,
        ban_type text not null,
        visitor_id text not null default '',
        ip_hash text not null default '',
        ip_hash_key_id text not null default 'legacy',
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
    ["ip_hash_key_id", "text not null default 'legacy'"],
    ["ip_prefix", "text not null default ''"],
    ["room_key", "text not null default 'public'"],
    ["encrypted", "integer not null default 0"],
    ["client_request_id", "text not null default ''"]
  ]);
  await ensureTableColumns(env, "chat_bans", [
    ["ip_hash_key_id", "text not null default 'legacy'"]
  ]);
  await env.DB.prepare("create index if not exists anonymous_chat_messages_client_idx on anonymous_chat_messages(client_id, created_at)").run();
  await env.DB.prepare("create index if not exists anonymous_chat_messages_room_visible_idx on anonymous_chat_messages(room_key, hidden, created_at, message_id)").run();
  await env.DB.prepare("create index if not exists anonymous_chat_messages_room_nickname_idx on anonymous_chat_messages(room_key, hidden, nickname, created_at)").run();
  await env.DB.prepare("create index if not exists anonymous_chat_messages_room_created_idx on anonymous_chat_messages(room_key, created_at)").run();
  await env.DB.prepare("create index if not exists anonymous_chat_messages_room_visitor_idx on anonymous_chat_messages(room_key, visitor_id, created_at)").run();
  await env.DB.prepare("create index if not exists anonymous_chat_messages_room_ip_idx on anonymous_chat_messages(room_key, ip_hash, created_at)").run();
  await env.DB.prepare("create index if not exists anonymous_chat_messages_room_ip_generation_idx on anonymous_chat_messages(room_key, ip_hash_key_id, ip_hash, created_at)").run();
  await env.DB.prepare("create index if not exists chat_bans_active_ip_generation_idx on chat_bans(active, ip_hash_key_id, ip_hash, expires_at)").run();
  await env.DB.prepare(`
    create unique index if not exists anonymous_chat_messages_request_idx
    on anonymous_chat_messages(visitor_id, room_key, client_request_id)
    where client_request_id <> ''
  `).run();
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
    env.DB.prepare(`
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
    `),
    env.DB.prepare(`
      create table if not exists site_runtime_state (
        key text primary key,
        value text not null,
        updated_at text not null
      )
    `),
    env.DB.prepare("create index if not exists articles_status_published_idx on articles(status, published_at, article_id)"),
    env.DB.prepare("create index if not exists articles_category_idx on articles(category)"),
    env.DB.prepare("create index if not exists article_translations_article_lang_idx on article_translations(article_id, lang)"),
    env.DB.prepare("create index if not exists agent_article_receipts_created_idx on agent_article_receipts(created_at)")
  ]);
  articleSchemaReady = true;
}

async function ensureArticleDeliveryChannelSchema(env) {
  if (articleDeliveryChannelSchemaReady) {
    return;
  }
  await env.DB.prepare(`
    create table if not exists article_delivery_channels (
      channel_key text primary key,
      category text not null,
      enabled integer not null default 0,
      auto_publish integer not null default 0,
      token_hash text not null default '',
      token_hint text not null default '',
      token_created_at text,
      last_used_at text,
      created_at text not null,
      updated_at text not null
    )
  `).run();
  await ensureTableColumns(env, "article_delivery_channels", [
    ["auto_publish", "integer not null default 0"]
  ]);
  for (const config of Object.values(ARTICLE_DELIVERY_CHANNELS)) {
    await env.DB.prepare(`
      insert into article_delivery_channels (
        channel_key, category, enabled, auto_publish, token_hash, token_hint,
        token_created_at, last_used_at, created_at, updated_at
      ) values (?, ?, 0, 0, '', '', null, null, ?, ?)
      on conflict(channel_key) do nothing
    `).bind(
      config.channelKey,
      config.category,
      config.createdAt,
      config.createdAt
    ).run();
  }
  articleDeliveryChannelSchemaReady = true;
}

async function ensureArticleDeliverySchema(env) {
  if (articleDeliverySchemaReady) {
    return;
  }
  await ensureArticleDeliveryChannelSchema(env);
  await env.DB.batch([
    env.DB.prepare(`
      create table if not exists article_delivery_events (
        event_id text primary key,
        channel_key text not null references article_delivery_channels(channel_key) on delete cascade,
        idempotency_key text not null,
        payload_hash text not null default '',
        article_id text references articles(article_id) on delete set null,
        slug text not null,
        title_zh text not null default '',
        source_label text not null default '',
        status text not null default 'draft',
        created_at text not null,
        unique(channel_key, idempotency_key)
      )
    `),
    env.DB.prepare(`
      create index if not exists article_delivery_events_channel_created_idx
        on article_delivery_events(channel_key, created_at desc)
    `),
    env.DB.prepare(`
      create table if not exists tool_radar_catalog (
        tool_key text primary key,
        canonical_url text not null unique,
        name text not null,
        article_id text references articles(article_id) on delete set null,
        created_at text not null
      )
    `),
    env.DB.prepare(`
      create index if not exists tool_radar_catalog_created_idx
        on tool_radar_catalog(created_at desc, tool_key)
    `)
  ]);
  await ensureTableColumns(env, "article_delivery_events", [
    ["payload_hash", "text not null default ''"]
  ]);
  articleDeliverySchemaReady = true;
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
    `),
    env.DB.prepare(`
      create table if not exists agent_video_receipts (
        receipt_id text primary key,
        user_id text not null,
        operation_id text not null,
        action text not null,
        payload_hash text not null,
        video_id text not null default '',
        response_json text not null,
        created_at text not null,
        unique(user_id, operation_id)
      )
    `),
    env.DB.prepare(`
      create table if not exists video_upload_sessions (
        upload_session_id text primary key,
        user_id text not null references users(id) on delete cascade,
        operation_id text not null,
        payload_hash text not null,
        video_id text not null default '',
        filename text not null,
        mime_type text not null,
        size_bytes integer not null,
        sha256 text not null,
        upload_token_hash text not null default '',
        object_key text not null default '',
        r2_upload_id text not null default '',
        part_size_bytes integer not null default 0,
        expected_parts integer not null default 0,
        uploaded_bytes integer not null default 0,
        status text not null default 'pending',
        expires_at text not null,
        created_at text not null,
        updated_at text not null,
        completed_at text not null default '',
        aborted_at text not null default '',
        last_error text not null default '',
        unique(user_id, operation_id)
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
    env.DB.prepare("create index if not exists video_category_relations_category_idx on video_category_relations(category_id, sort_order)"),
    env.DB.prepare("create index if not exists agent_video_receipts_created_idx on agent_video_receipts(created_at)"),
    env.DB.prepare("create index if not exists video_upload_sessions_user_status_idx on video_upload_sessions(user_id, status, updated_at)"),
    env.DB.prepare("create index if not exists video_upload_sessions_status_expires_idx on video_upload_sessions(status, expires_at)")
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

async function ensureJapaneseSubtextSchema(env) {
  if (japaneseSubtextSchemaReady) {
    return;
  }
  await env.DB.batch([
    env.DB.prepare(`
      create table if not exists japanese_subtext_profiles (
        user_id text primary key references users(id) on delete cascade,
        schema_version integer not null default 1 check(schema_version = 1),
        content_version text not null,
        revision integer not null default 1 check(revision between 1 and 1000000),
        current_level integer not null default 1 check(current_level between 1 and 5),
        current_stage integer not null default 1 check(current_stage between 1 and 50),
        settings_json text not null default '{}',
        last_agent_operation_id text not null default '',
        last_agent_payload_hash text not null default '',
        progress_updated_at text not null,
        settings_updated_at text not null,
        created_at text not null,
        updated_at text not null
      )
    `),
    env.DB.prepare(`
      create table if not exists japanese_subtext_agent_attempts (
        attempt_id text primary key,
        user_id text not null references users(id) on delete cascade,
        token_id text not null,
        operation_id text not null,
        payload_hash text not null,
        stage_id text not null,
        stage_revision integer not null check(stage_revision between 1 and 1000000),
        content_hash text not null,
        expected_revision integer not null check(expected_revision between 1 and 1000000),
        resulting_revision integer not null check(resulting_revision between 1 and 1000000),
        answers_json text not null,
        score integer not null check(score between 0 and 100),
        cleared integer not null check(cleared in (0, 1)),
        medal integer not null check(medal between 0 and 1),
        attempt_mode text not null check(attempt_mode = 'bilingual'),
        used_translation integer not null check(used_translation = 1),
        used_kana integer not null check(used_kana = 1),
        used_listening_mode integer not null check(used_listening_mode = 0),
        replay_count integer not null check(replay_count = 0),
        hint_count integer not null check(hint_count = 0),
        created_at text not null,
        unique (user_id, operation_id)
      )
    `),
    env.DB.prepare(`
      create table if not exists japanese_subtext_agent_receipts (
        user_id text not null references users(id) on delete cascade,
        operation_id text not null,
        payload_hash text not null,
        attempt_id text not null references japanese_subtext_agent_attempts(attempt_id) on delete cascade,
        response_json text not null,
        created_at text not null,
        primary key (user_id, operation_id)
      )
    `),
    env.DB.prepare(`
      create table if not exists japanese_subtext_stage_progress (
        user_id text not null references users(id) on delete cascade,
        stage_id text not null,
        level integer not null check(level between 1 and 5),
        stage integer not null check(stage between 1 and 50),
        cleared integer not null default 0 check(cleared in (0, 1)),
        best_score integer not null default 0 check(best_score between 0 and 100),
        best_medal integer not null default 0 check(best_medal between 0 and 3),
        attempts integer not null default 0 check(attempts between 0 and 1000000),
        first_accuracy integer not null default 0 check(first_accuracy between 0 and 100),
        first_clear_mode text not null default '',
        used_translation integer not null default 0 check(used_translation in (0, 1)),
        used_kana integer not null default 0 check(used_kana in (0, 1)),
        used_listening_mode integer not null default 0 check(used_listening_mode in (0, 1)),
        replay_count integer not null default 0 check(replay_count between 0 and 1000000),
        hint_count integer not null default 0 check(hint_count between 0 and 1000000),
        progress_updated_at text not null,
        updated_at text not null,
        primary key (user_id, stage_id)
      )
    `),
    env.DB.prepare(`
      create table if not exists japanese_subtext_daily_activity (
        user_id text not null references users(id) on delete cascade,
        local_date text not null,
        stage_id text not null,
        cleared integer not null default 0 check(cleared in (0, 1)),
        best_medal integer not null default 0 check(best_medal between 0 and 3),
        activity_updated_at text not null,
        updated_at text not null,
        primary key (user_id, local_date, stage_id)
      )
    `),
    env.DB.prepare(`
      create index if not exists japanese_subtext_profiles_updated_idx
        on japanese_subtext_profiles(updated_at)
    `),
    env.DB.prepare(`
      create index if not exists japanese_subtext_stage_progress_user_level_idx
        on japanese_subtext_stage_progress(user_id, level, stage)
    `),
    env.DB.prepare(`
      create index if not exists japanese_subtext_stage_progress_updated_idx
        on japanese_subtext_stage_progress(updated_at)
    `),
    env.DB.prepare(`
      create index if not exists japanese_subtext_daily_activity_user_date_idx
        on japanese_subtext_daily_activity(user_id, local_date)
    `),
    env.DB.prepare(`
      create index if not exists japanese_subtext_agent_attempts_created_idx
        on japanese_subtext_agent_attempts(created_at)
    `),
    env.DB.prepare(`
      create index if not exists japanese_subtext_agent_receipts_created_idx
        on japanese_subtext_agent_receipts(created_at)
    `)
  ]);
  await ensureTableColumns(env, "japanese_subtext_profiles", [
    ["last_agent_operation_id", "text not null default ''"],
    ["last_agent_payload_hash", "text not null default ''"]
  ]);
  japaneseSubtextSchemaReady = true;
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
      create table if not exists agent_device_authorizations (
        device_id text primary key,
        device_code_hash text not null unique,
        user_code_hash text not null unique,
        client_name text not null,
        requested_scopes text not null default '[]',
        granted_scopes text not null default '[]',
        user_id text references users(id) on delete cascade,
        status text not null default 'pending',
        csrf_hash text not null default '',
        ip_hash text not null default '',
        created_at text not null,
        expires_at text not null,
        approved_at text not null default '',
        consumed_at text not null default '',
        poll_count integer not null default 0,
        last_polled_at text not null default '',
        decision_event_id text not null default ''
      )
    `),
    env.DB.prepare(`
      create table if not exists agent_access_tokens (
        token_id text primary key,
        token_hash text not null unique,
        token_hint text not null default '',
        user_id text not null references users(id) on delete cascade,
        client_name text not null,
        scopes text not null default '[]',
        created_at text not null,
        expires_at text not null,
        last_used_at text not null default '',
        revoked_at text not null default '',
        revoked_event_id text not null default ''
      )
    `),
    env.DB.prepare(`
      create table if not exists agent_audit_log (
        event_id text primary key,
        actor_user_id text not null default '',
        token_id text not null default '',
        action text not null,
        target_type text not null default '',
        target_id text not null default '',
        scopes text not null default '[]',
        result text not null default '',
        created_at text not null
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
    env.DB.prepare("create index if not exists agent_device_status_expires_idx on agent_device_authorizations(status, expires_at)"),
    env.DB.prepare("create index if not exists agent_device_ip_created_idx on agent_device_authorizations(ip_hash, created_at)"),
    env.DB.prepare("create index if not exists agent_access_tokens_user_idx on agent_access_tokens(user_id, revoked_at, expires_at)"),
    env.DB.prepare("create index if not exists agent_access_tokens_expires_idx on agent_access_tokens(expires_at, revoked_at)"),
    env.DB.prepare("create index if not exists agent_audit_created_idx on agent_audit_log(created_at, action)"),
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
    env.DB.prepare(`
      create table if not exists site_runtime_state (
        key text primary key,
        value text not null,
        updated_at text not null
      )
    `),
    env.DB.prepare(`
      create table if not exists api_rate_limits (
        bucket_key text primary key,
        window_started_at integer not null,
        request_count integer not null default 0,
        blocked_until integer not null default 0,
        updated_at text not null
      )
    `),
    env.DB.prepare("create index if not exists api_rate_limits_updated_idx on api_rate_limits(updated_at)"),
    env.DB.prepare("create index if not exists game_saves_updated_at_idx on game_saves(updated_at)")
  ]);
  await ensureUserRoleColumn(env);
  await env.DB.prepare(`
    delete from api_rate_limits
    where bucket_key in (
      select bucket_key from api_rate_limits
      where updated_at < ?
      order by updated_at asc
      limit ?
    )
  `).bind(
    new Date(Date.now() - API_RATE_LIMIT_RETENTION_MS).toISOString(),
    DATA_CLEANUP_DELETE_LIMIT
  ).run();
  coreSchemaReady = true;
}

async function ensureUserRoleColumn(env) {
  const columns = (await env.DB.prepare("pragma table_info(users)").all()).results || [];
  if (!columns.some((column) => column.name === "role")) {
    await env.DB.prepare("alter table users add column role text not null default 'user'").run();
  }
}

async function authRateLimitContext(request, env, action, email) {
  const ipInfo = await requestIpInfo(request, env, "analytics");
  const emailHash = await sha256Hex(`auth-email:${email}`);
  return {
    ipBucket: await rateLimitBucketKey(`auth:${action}:ip`, ipInfo.ipHash),
    emailBucket: await rateLimitBucketKey(`auth:${action}:email`, emailHash),
    pairBucket: await rateLimitBucketKey(`auth:${action}:pair`, `${ipInfo.ipHash}:${emailHash}`)
  };
}

async function rateLimitBucketKey(scope, identity) {
  return `rl_${await sha256Hex(`${scope}:${identity}`)}`;
}

async function consumeFirstExceededRateLimit(env, entries) {
  for (const [bucketKey, policy] of entries) {
    const result = await consumeRateLimit(env, bucketKey, policy);
    if (!result.allowed) {
      return result;
    }
  }
  return null;
}

async function consumeRateLimit(env, bucketKey, policy) {
  const now = Date.now();
  const windowMs = Math.max(1000, Number(policy.windowMs) || 60000);
  const limit = Math.max(1, Number(policy.limit) || 1);
  const backoffMs = Math.max(1000, Number(policy.backoffMs) || windowMs);
  const maxBackoffMs = Math.max(backoffMs, Number(policy.maxBackoffMs) || backoffMs);
  const resetBefore = now - windowMs;
  const row = await env.DB.prepare(`
    insert into api_rate_limits (
      bucket_key, window_started_at, request_count, blocked_until, updated_at
    ) values (?, ?, 1, 0, ?)
    on conflict(bucket_key) do update set
      window_started_at = case
        when api_rate_limits.window_started_at <= ? then excluded.window_started_at
        else api_rate_limits.window_started_at
      end,
      request_count = case
        when api_rate_limits.window_started_at <= ? then 1
        else api_rate_limits.request_count + 1
      end,
      blocked_until = case
        when api_rate_limits.window_started_at <= ? then 0
        when api_rate_limits.blocked_until > ? then api_rate_limits.blocked_until
        when api_rate_limits.request_count + 1 > ? then
          ? + min(?, ? * (1 << min(api_rate_limits.request_count + 1 - ?, 4)))
        else 0
      end,
      updated_at = excluded.updated_at
    returning request_count, blocked_until
  `).bind(
    bucketKey,
    now,
    new Date(now).toISOString(),
    resetBefore,
    resetBefore,
    resetBefore,
    now,
    limit,
    now,
    maxBackoffMs,
    backoffMs,
    limit
  ).first();
  const blockedUntil = Number(row?.blocked_until || 0);
  return {
    allowed: blockedUntil <= now,
    retryAfterSeconds: blockedUntil > now
      ? Math.max(1, Math.ceil((blockedUntil - now) / 1000))
      : 0
  };
}

async function clearRateLimitBuckets(env, bucketKeys) {
  const keys = [...new Set(bucketKeys.filter(Boolean))];
  if (!keys.length) {
    return;
  }
  await env.DB.batch(keys.map((key) => (
    env.DB.prepare("delete from api_rate_limits where bucket_key = ?").bind(key)
  )));
}

function rateLimitedResponse(retryAfterSeconds) {
  const response = json({
    error: "请求过于频繁，请稍后再试。",
    code: "RATE_LIMITED"
  }, 429);
  response.headers.set("Retry-After", String(Math.max(1, Number(retryAfterSeconds) || 1)));
  return response;
}

function registrationFailedResponse() {
  return json({
    error: "无法完成注册，请检查填写的信息后重试。",
    code: "REGISTRATION_FAILED"
  }, 400);
}

function isUniqueConstraintError(error) {
  return /(?:unique|constraint failed)/i.test(
    error instanceof Error ? error.message : String(error || "")
  );
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

async function createSessionResponse(env, request, userId, email, status = 200, role = "user", userStatement = null) {
  const token = randomToken();
  const tokenHash = await sha256Hex(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  await persistAuthenticationSession(env, {
    userStatement, tokenHash, userId, createdAt: now.toISOString(), expiresAt
  });

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

  const role = row.role || "user";
  return { tokenHash, user: { id: row.id, email: row.email, role } };
}

function publicVideoRow(row, categories = [], options = {}) {
  const thumbnail = options.publicThumbnail
    ? publicVideoThumbnail(row.thumbnail_url, row.video_id, options.origin, row.updated_at || row.created_at)
    : { url: row.thumbnail_url || "", width: 0, height: 0 };
  return {
    video_id: row.video_id,
    platform: row.platform,
    original_url: row.original_url || "",
    external_id: row.external_id,
    embed_url: row.embed_url,
    title: row.title || "",
    description: row.description || "",
    thumbnail_url: thumbnail.url,
    thumbnail_width: thumbnail.width,
    thumbnail_height: thumbnail.height,
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

export function publicVideoThumbnail(value, videoId = "", origin = "https://example.invalid", cacheVersion = "") {
  const raw = String(value || "").trim();
  if (!raw) return { url: "", width: 0, height: 0, local: false };
  if (/^data:/i.test(raw)) {
    const local = decodePublicVideoThumbnail(raw);
    if (!local) return { url: "", width: 0, height: 0, local: false };
    const url = new URL(`/api/videos/${encodeURIComponent(videoId)}/thumbnail`, origin);
    const version = String(cacheVersion || "").trim();
    if (version) url.searchParams.set("v", version);
    return {
      ...local,
      url: url.toString(),
      local: true
    };
  }
  let url;
  try {
    url = new URL(raw);
  } catch {
    return { url: "", width: 0, height: 0, local: false };
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (url.protocol !== "https:") return { url: "", width: 0, height: 0, local: false };
  if (host === "i.ytimg.com" || host === "img.youtube.com") {
    url.pathname = url.pathname.replace(/\/[^/]+$/, "/mqdefault.jpg");
    url.search = "";
    return { url: url.toString(), width: 320, height: 180, local: false };
  }
  if (["i0.hdslb.com", "i1.hdslb.com", "i2.hdslb.com", "archive.biliimg.com"].includes(host)) {
    url.pathname = `${url.pathname.replace(/@[^/]*$/, "")}@640w_360h_1c.webp`;
    url.search = "";
    return { url: url.toString(), width: 640, height: 360, local: false };
  }
  return { url: "", width: 0, height: 0, local: false };
}

function decodePublicVideoThumbnail(raw) {
  const match = String(raw).match(/^data:image\/(jpe?g|png|webp|avif);base64,([A-Za-z0-9+/]+={0,2})$/i);
  if (!match) return null;
  const base64 = match[2];
  const padding = base64.endsWith("==") ? 2 : (base64.endsWith("=") ? 1 : 0);
  const byteLength = Math.floor((base64.length * 3) / 4) - padding;
  if (byteLength <= 0 || byteLength > MAX_PUBLIC_VIDEO_THUMBNAIL_BYTES) return null;
  let bytes;
  try {
    const binary = atob(base64);
    bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
  const dimensions = encodedImageDimensions(bytes, match[1].toLowerCase());
  if (!dimensions
    || dimensions.width > MAX_PUBLIC_VIDEO_THUMBNAIL_WIDTH
    || dimensions.height > MAX_PUBLIC_VIDEO_THUMBNAIL_HEIGHT) {
    return null;
  }
  const mime = match[1].toLowerCase().replace("jpg", "jpeg");
  return {
    bytes,
    contentType: `image/${mime}`,
    width: dimensions.width,
    height: dimensions.height
  };
}

function encodedImageDimensions(bytes, format) {
  if (format === "png" && bytes.length >= 24
    && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  if ((format === "jpg" || format === "jpeg") && bytes.length >= 10 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    for (let offset = 2; offset + 8 < bytes.length;) {
      if (bytes[offset] !== 0xff) break;
      const marker = bytes[offset + 1];
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        return { width: (bytes[offset + 7] << 8) | bytes[offset + 8], height: (bytes[offset + 5] << 8) | bytes[offset + 6] };
      }
      const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
      if (length < 2) break;
      offset += length + 2;
    }
  }
  if (format === "webp" && bytes.length >= 30
    && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
    && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") {
    const tag = String.fromCharCode(...bytes.slice(12, 16));
    if (tag === "VP8X") {
      return {
        width: 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16),
        height: 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16)
      };
    }
    if (tag === "VP8 " && bytes.length >= 30) {
      return {
        width: (bytes[26] | (bytes[27] << 8)) & 0x3fff,
        height: (bytes[28] | (bytes[29] << 8)) & 0x3fff
      };
    }
    if (tag === "VP8L" && bytes.length >= 25 && bytes[20] === 0x2f) {
      return {
        width: 1 + bytes[21] + ((bytes[22] & 0x3f) << 8),
        height: 1 + ((bytes[22] & 0xc0) >> 6) + (bytes[23] << 2) + ((bytes[24] & 0x0f) << 10)
      };
    }
  }
  return null;
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
    // An explicit admin acknowledgement after a successful same-URL preview can
    // clear an old fetch error. A changed source still reports its new fetch result.
    metadata_error: options.existing && !sourceChanged && Object.prototype.hasOwnProperty.call(body, "metadata_error")
      ? normalizeOptionalText(body.metadata_error, 500)
      : normalizeOptionalText(body.metadata_error, 500) || parsed.metadata_error || "",
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

function conditionalVideoCategoryRelationStatements(env, videoId, categoryIds, expectedUpdatedAt) {
  const now = nowIso();
  return categoryIds.map((categoryId, index) => env.DB.prepare(`
    insert into video_category_relations (video_id, category_id, sort_order, created_at)
    select ?, ?, ?, ?
    where exists (
      select 1 from videos
      where video_id = ? and updated_at = ?
    )
    on conflict(video_id, category_id) do update set sort_order = excluded.sort_order
  `).bind(
    videoId,
    categoryId,
    index,
    now,
    videoId,
    expectedUpdatedAt
  ));
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
    const bvid = cleanBilibiliBvid(raw);
    if (!bvid) {
      throw new HttpError("无法识别 Bilibili BV 号。", 400);
    }
    return parseVideoUrl(`https://www.bilibili.com/video/${bvid}`);
  }
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new HttpError("视频链接格式不正确。", 400);
  }
  if (url.protocol !== "https:") {
    throw new HttpError("视频链接必须使用 https。", 400);
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
    const bvid = cleanBilibiliBvid((url.pathname.match(/\/video\/(BV[a-zA-Z0-9]{10})(?:\/|$)/) || [])[1]);
    if (!bvid) {
      throw new HttpError("暂时只支持 bilibili.com/video/BV... 视频链接。", 400);
    }
    const page = normalizeBilibiliPage(url.searchParams.get("p") || url.searchParams.get("page"));
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

function normalizeBilibiliPage(value) {
  const page = Number(value || 1);
  if (!Number.isFinite(page)) {
    return 1;
  }
  return Math.max(1, Math.min(Math.round(page), 99));
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
  return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : "";
}

function cleanBilibiliBvid(value) {
  const id = String(value || "").trim();
  return /^BV[a-zA-Z0-9]{10}$/.test(id) ? id : "";
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
    return normalizeArticleTags(tags, { maxItems: Infinity, maxLength: Infinity });
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
  if (article.category === "site-updates") {
    article.is_pinned = 0;
  }
  if (body.published_at !== undefined) {
    article.published_at = normalizeOptionalDateTime(body.published_at);
  }
  if (!partial || body.translations !== undefined) {
    article.translations = normalizeArticleTranslations(body.translations, partial, {
      summaryMaxLength: options.summaryMaxLength
    });
  }
  return article;
}

function normalizeArticleTranslations(value, partial = false, options = {}) {
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
      summary: normalizeOptionalText(item.summary, options.summaryMaxLength || 500),
      content_markdown: normalizeRequiredText(item.content_markdown, 200000, `${lang} 正文不能为空。`)
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

function articleTranslationsStatements(env, articleId, translations, createdAt, updatedAt = createdAt, { insertOnly = false } = {}) {
  return Object.entries(translations).map(([lang, item]) => env.DB.prepare(`
    insert into article_translations (
      translation_id, article_id, lang, title, summary, content_markdown, created_at, updated_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?)
    on conflict(article_id, lang)
    ${insertOnly ? "do nothing" : `do update set
      title = excluded.title,
      summary = excluded.summary,
      content_markdown = excluded.content_markdown,
      updated_at = excluded.updated_at`}
  `).bind(
    `${articleId}-${lang}`,
    articleId,
    lang,
    item.title,
    item.summary,
    item.content_markdown,
    createdAt,
    updatedAt
  ));
}

function conditionalArticleTranslationsStatements(env, articleId, translations, now, expectedUpdatedAt) {
  return Object.entries(translations).map(([lang, item]) => env.DB.prepare(`
    insert into article_translations (
      translation_id, article_id, lang, title, summary, content_markdown, created_at, updated_at
    )
    select ?, ?, ?, ?, ?, ?, ?, ?
    where exists (
      select 1 from articles
      where article_id = ? and updated_at = ?
    )
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
    now,
    articleId,
    expectedUpdatedAt
  ));
}

async function seedArticleTestData(env) {
  await runArticleDataMigrations(env, { articleTranslationsStatements });
}

async function ensureVisitorProfile(env, request, visitorId, body = {}, incrementVisit = false, providedGeo = null) {
  const now = nowIso();
  const geo = providedGeo || await requestIpInfo(request, env, "analytics");
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
    password_status: passwordStatusLabel(row.password_scheme),
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
  return value === "pbkdf2"
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

function isTransferApiPath(parts) {
  return parts[0] === "transfer" || (parts[0] === "admin" && parts[1] === "transfer");
}

function assertMainApiMutationRequest(request, parts = []) {
  if (request.method === "GET" || request.method === "HEAD" || request.method === "OPTIONS") {
    return;
  }
  assertSameOriginRequest(request);
  if (
    request.method !== "DELETE"
    && !isWhiteboardRasterUploadRequest(request, parts)
    && !isWhiteboardAgentSceneUpdateRequest(request, parts)
  ) {
    assertApplicationJsonRequest(request);
  }
}

function isWhiteboardRasterUploadRequest(request, parts) {
  const isBrowserUpload = (
    parts.length === 2
    && parts[0] === "whiteboard"
    && parts[1] === "assets"
  );
  const isAgentUpload = (
    parts.length === 3
    && parts[0] === "whiteboard"
    && parts[1] === "agent"
    && parts[2] === "assets"
  );
  if (
    request.method !== "POST"
    || (!isBrowserUpload && !isAgentUpload)
  ) {
    return false;
  }
  const contentType = String(request.headers.get("Content-Type") || "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  return ["image/png", "image/jpeg", "image/webp"].includes(contentType);
}

function isWhiteboardAgentSceneUpdateRequest(request, parts) {
  if (
    request.method !== "POST"
    || parts.length !== 3
    || parts[0] !== "whiteboard"
    || parts[1] !== "agent"
    || parts[2] !== "scene"
  ) {
    return false;
  }
  const contentType = String(request.headers.get("Content-Type") || "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  return contentType === "application/vnd.yjs-update";
}

function assertSameOriginRequest(request) {
  const expectedOrigin = new URL(request.url).origin;
  const originHeader = String(request.headers.get("Origin") || "").trim();
  const fetchSite = String(request.headers.get("Sec-Fetch-Site") || "").trim().toLowerCase();
  if (originHeader) {
    let origin;
    try {
      origin = new URL(originHeader).origin;
    } catch {
      throw new HttpError("请求来源不受信任。", 403);
    }
    if (origin !== expectedOrigin) {
      throw new HttpError("请求来源不受信任。", 403);
    }
  }
  if (fetchSite && !["same-origin", "none"].includes(fetchSite)) {
    throw new HttpError("请求来源不受信任。", 403);
  }
}

function analyticsReadSourceIsTrusted(request) {
  try {
    assertSameOriginRequest(request);
    return true;
  } catch {
    return false;
  }
}

function assertApplicationJsonRequest(request) {
  const contentType = String(request.headers.get("Content-Type") || "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (contentType !== "application/json") {
    throw new HttpError("请求必须使用 application/json。", 415);
  }
}

async function readOptionalJson(request, maxBytes = MAX_DEFAULT_JSON_BYTES, tooLargeMessage = "请求内容过大。") {
  assertApplicationJsonRequest(request);
  const raw = await readBoundedRequestText(request, maxBytes, tooLargeMessage);
  if (!raw.trim()) {
    return {};
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new HttpError("请求内容不是有效 JSON。", 400);
  }
}

async function readBoundedJson(request, maxBytes) {
  return readJson(request, maxBytes, "云端进度数据过大。");
}

async function readJson(request, maxBytes = MAX_DEFAULT_JSON_BYTES, tooLargeMessage = "请求内容过大。") {
  assertApplicationJsonRequest(request);
  const raw = await readBoundedRequestText(request, maxBytes, tooLargeMessage);
  try {
    return JSON.parse(raw);
  } catch {
    throw new HttpError("请求内容不是有效 JSON。", 400);
  }
}

async function readBoundedRequestText(request, maxBytes, tooLargeMessage) {
  const limit = Math.max(1, Number(maxBytes) || MAX_DEFAULT_JSON_BYTES);
  const declaredLengthText = request.headers.get("Content-Length");
  const declaredLength = declaredLengthText === null ? NaN : Number(declaredLengthText);
  if (Number.isFinite(declaredLength) && declaredLength > limit) {
    throw new HttpError(tooLargeMessage, 413);
  }
  if (!request.body) {
    return "";
  }

  const reader = request.body.getReader();
  const chunks = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
      totalBytes += chunk.byteLength;
      if (totalBytes > limit) {
        await reader.cancel();
        throw new HttpError(tooLargeMessage, 413);
      }
      chunks.push(chunk);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  chunks.forEach((chunk) => {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  });
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new HttpError("请求内容不是有效 UTF-8。", 400);
  }
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: apiSecurityHeaders({
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    })
  });
}

function apiSecurityHeaders(headers = {}) {
  const secured = new Headers(headers);
  secured.set("Content-Security-Policy", "default-src 'none'; base-uri 'none'; frame-ancestors 'none'");
  secured.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  secured.set("Referrer-Policy", "no-referrer");
  secured.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  secured.set("X-Content-Type-Options", "nosniff");
  secured.set("X-Frame-Options", "DENY");
  return secured;
}

export async function cacheableJson(request, payload, options = {}) {
  const body = JSON.stringify(payload);
  const representationSeed = Object.prototype.hasOwnProperty.call(options, "etagSeed")
    ? options.etagSeed
    : body;
  return cacheableResponse(request, body, {
    ...options,
    etagSeed: [PUBLIC_API_REPRESENTATION_VERSION, representationSeed],
    contentType: "application/json; charset=utf-8"
  });
}

async function cacheableBinary(request, body, options = {}) {
  return cacheableResponse(request, body, options);
}

async function cacheableResponse(request, body, {
  contentType = "application/octet-stream",
  maxAge = 30,
  staleWhileRevalidate = 120,
  cacheScope = "public",
  etagSeed = body
} = {}) {
  const etag = await strongEtag(etagSeed);
  const headers = apiSecurityHeaders({
    "Content-Type": contentType,
    "Cache-Control": `${cacheScope}, max-age=${Math.max(0, Number(maxAge) || 0)}, stale-while-revalidate=${Math.max(0, Number(staleWhileRevalidate) || 0)}`,
    ETag: etag,
    Vary: "Accept-Encoding"
  });
  if (etagMatches(request.headers.get("If-None-Match"), etag)) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(body, { status: 200, headers });
}

async function strongEtag(value) {
  const source = typeof value === "string" ? value : JSON.stringify(value);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source));
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `"sha256-${hex}"`;
}

function etagMatches(header, etag) {
  return String(header || "")
    .split(",")
    .map((value) => value.trim().replace(/^W\//, ""))
    .some((value) => value === "*" || value === etag);
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function ownerAdminEmails(env) {
  const configured = typeof env?.OWNER_ADMIN_EMAILS === "string"
    ? env.OWNER_ADMIN_EMAILS
    : "";
  return new Set(configured
    .split(/[\s,;]+/u)
    .map(normalizeEmail)
    .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254));
}

function previewApiIsDisabled(env, hostname) {
  const host = String(hostname || "").trim().toLowerCase();
  const pagesPreviewHost = host.endsWith(".pages.dev") && host.split(".").length > 3;
  return String(env?.PREVIEW_API_DISABLED || "").trim().toLowerCase() === "true" || pagesPreviewHost;
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

function adminRequiredUpdatedAt(body) {
  if (!body || !Object.prototype.hasOwnProperty.call(body, "expectedUpdatedAt")) {
    const error = new HttpError("缺少内容版本，请重新读取后重试。", 428);
    error.code = "CONTENT_VERSION_REQUIRED";
    throw error;
  }
  return expectedUpdatedAtFromBody(body);
}

function expectedUpdatedAtFromBody(body, { allowNull = false } = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)
    || !Object.prototype.hasOwnProperty.call(body, "expectedUpdatedAt")) {
    throw new HttpError("缺少内容版本，请刷新后重试。", 400);
  }
  const value = body.expectedUpdatedAt;
  if (allowNull && value === null) {
    return null;
  }
  if (
    typeof value !== "string"
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)
    || Number.isNaN(Date.parse(value))
  ) {
    throw new HttpError("内容版本不正确，请刷新后重试。", 400);
  }
  return value;
}

function nextMutationUpdatedAt(previousValue) {
  const previousTime = Date.parse(String(previousValue || ""));
  const timestamp = Number.isFinite(previousTime)
    ? Math.max(Date.now(), previousTime + 1)
    : Date.now();
  return new Date(timestamp).toISOString();
}

function contentConflictResponse(updatedAt) {
  return json({
    error: "内容已被其他编辑更新，请刷新后重试。",
    code: "CONTENT_CONFLICT",
    updatedAt: updatedAt || null
  }, 409);
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
  const text = redactAnalyticsEmails(value).replace(/\s+/g, " ").trim();
  return Array.from(text).slice(0, maxLength).join("");
}

function redactAnalyticsEmails(value) {
  const text = String(value || "");
  return text
    .replace(EMAIL_LIKE_TEXT_PATTERN, "[email]")
    .replace(/[A-Z0-9._%+-]+(?:%40|%2540)[A-Z0-9.-]+(?:\.|%2E|%252E)[A-Z]{2,}/gi, "[email]");
}

function normalizeAnalyticsTargetText(value, maxLength) {
  return normalizeAnalyticsText(value, maxLength);
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

function normalizeIpPrefix(value) {
  const text = normalizeAnalyticsText(value, 80);
  if (!text) {
    return "";
  }
  if (isMaskedIpv4Prefix(text)) {
    return text;
  }
  if (isMaskedIpv6Prefix(text)) {
    return text;
  }
  return "";
}

function isMaskedIpv4Prefix(value) {
  const match = String(value || "").match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.0\/24$/);
  return Boolean(match && hasValidIpv4Octets(match.slice(1)));
}

function isFullIpv4Address(value) {
  const parts = String(value || "").split(".");
  return parts.length === 4
    && parts.every((part) => /^\d{1,3}$/.test(part))
    && hasValidIpv4Octets(parts);
}

function hasValidIpv4Octets(parts) {
  return parts.every((part) => Number(part) >= 0 && Number(part) <= 255);
}

function isMaskedIpv6Prefix(value) {
  const text = String(value || "").trim();
  const match = text.match(/^([0-9a-fA-F]{1,4}:){3}[0-9a-fA-F]{1,4}::\/64$/);
  return Boolean(match);
}

function normalizeTags(value, options = {}) {
  return normalizeArticleTags(value, options);
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

function normalizeChatRequestId(value) {
  const requestId = String(value || "").trim();
  if (!requestId) return "";
  if (!/^[A-Za-z0-9_-]{16,100}$/.test(requestId)) {
    throw new HttpError("消息请求编号不正确。", 400);
  }
  return requestId;
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

function normalizeChatRoomKey(value) {
  const roomKey = String(value || "").trim();
  if (!roomKey || roomKey === PUBLIC_CHAT_ROOM_KEY) {
    return PUBLIC_CHAT_ROOM_KEY;
  }
  if (
    roomKey.length > MAX_CHAT_ROOM_KEY_CHARS
    || !/^room_[A-Za-z0-9_-]{32,76}$/.test(roomKey)
  ) {
    throw new HttpError("聊天室房间标识不正确。", 400);
  }
  return roomKey;
}

function isPrivateChatRoom(roomKey) {
  return Boolean(roomKey && roomKey !== PUBLIC_CHAT_ROOM_KEY);
}

function normalizeChatEncryptedContent(encryptedContent, plainContent) {
  if (String(plainContent || "").trim()) {
    throw new HttpError("密码房只接收加密消息。", 400);
  }
  const content = String(encryptedContent || "").trim();
  if (
    !content
    || content.length > MAX_CHAT_ENCRYPTED_CONTENT_CHARS
    || !/^[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{16,}$/.test(content)
  ) {
    throw new HttpError("加密消息格式不正确。", 400);
  }
  return content;
}

function chatMessageId(date) {
  return `${date.getTime().toString(36)}-${randomToken(9)}`;
}

function createdAtFromChatMessageId(messageId) {
  const match = String(messageId || "").match(/^([a-z0-9]+)-[a-z0-9]+$/i);
  if (!match) {
    return "";
  }
  const timestamp = Number.parseInt(match[1], 36);
  if (!Number.isFinite(timestamp)) {
    return "";
  }
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

async function requestIpInfo(request, env, purpose = "analytics") {
  const ip = requestIp(request);
  const secretName = purpose === "chat" ? "CHAT_IP_HASH_SALT" : "ANALYTICS_IP_HASH_SALT";
  const secret = runtimeSecret(env, secretName);
  const cf = request.cf || {};
  const latitude = Number(cf.latitude);
  const longitude = Number(cf.longitude);
  return {
    ipHash: await hmacSha256Hex(secret, `${purpose}:${ip}`),
    ipHashKeyId: purpose === "chat" ? await chatIpHashKeyId(secret) : "",
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
  return cleanRequestIp(request.headers.get("CF-Connecting-IP"))
    || cleanRequestIp(request.headers.get("x-forwarded-for")?.split(",")[0])
    || "unknown";
}

function cleanRequestIp(value) {
  return String(value || "").trim();
}

function maskIp(ip) {
  const value = String(ip || "");
  if (isFullIpv4Address(value)) {
    const parts = value.split(".");
    return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
  }
  if (value.includes(":")) {
    return maskIpv6(value);
  }
  return "";
}

function maskIpv6(ip) {
  const groups = expandIpv6(ip);
  if (!groups) {
    return "";
  }
  return `${groups.slice(0, 4).map(compactIpv6Group).join(":")}::/64`;
}

function expandIpv6(ip) {
  const value = String(ip || "").trim().toLowerCase();
  if (!/^[0-9a-f:]+$/.test(value) || (value.match(/::/g) || []).length > 1) {
    return null;
  }
  const hasCompression = value.includes("::");
  const [headText, tailText = ""] = value.split("::");
  const head = headText ? headText.split(":") : [];
  const tail = tailText ? tailText.split(":") : [];
  const fillCount = 8 - head.length - tail.length;
  if (hasCompression && fillCount < 1) {
    return null;
  }
  const groups = hasCompression
    ? [...head, ...Array(fillCount).fill("0"), ...tail]
    : value.split(":");
  if (groups.length !== 8 || groups.some((group) => !/^[0-9a-f]{1,4}$/.test(group))) {
    return null;
  }
  return groups.map((group) => group.padStart(4, "0"));
}

function compactIpv6Group(group) {
  return String(group || "0").replace(/^0+([0-9a-f])$/i, "$1").replace(/^0+/, "") || "0";
}

async function hashPassword(password, iterations = PASSWORD_HASH_ITERATIONS) {
  const salt = randomToken(16);
  const normalizedIterations = Math.min(
    PASSWORD_HASH_MAX_RUNTIME_ITERATIONS,
    Math.max(PASSWORD_HASH_ITERATIONS, Math.floor(Number(iterations) || PASSWORD_HASH_ITERATIONS))
  );
  const key = await crypto.subtle.importKey("raw", textBytes(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: base64urlToBytes(salt), iterations: normalizedIterations, hash: "SHA-256" },
    key,
    256
  );
  return `pbkdf2_sha256$${normalizedIterations}$${salt}$${bytesToBase64url(new Uint8Array(bits))}`;
}

async function verifyPassword(password, stored) {
  const [scheme, iterationText, salt, expected] = String(stored || "").split("$");
  if (scheme !== "pbkdf2_sha256") {
    return false;
  }
  const iterations = Number(iterationText);
  if (
    !Number.isInteger(iterations)
    || iterations < 10000
    || iterations > PASSWORD_HASH_MAX_RUNTIME_ITERATIONS
  ) {
    return false;
  }
  try {
    const saltBytes = base64urlToBytes(salt);
    const expectedBytes = base64urlToBytes(expected);
    if (saltBytes.byteLength < 16 || expectedBytes.byteLength !== 32) {
      return false;
    }
    const key = await crypto.subtle.importKey("raw", textBytes(password), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt: saltBytes, iterations, hash: "SHA-256" },
      key,
      256
    );
    return timingSafeEqualBytes(new Uint8Array(bits), expectedBytes);
  } catch {
    return false;
  }
}

function passwordHashNeedsUpgrade(stored) {
  const [scheme, iterationText] = String(stored || "").split("$");
  return scheme !== "pbkdf2_sha256" || Number(iterationText) !== PASSWORD_HASH_ITERATIONS;
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", textBytes(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hmacSha256Hex(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    textBytes(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, textBytes(value));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function chatIpHashKeyId(secret) {
  const fingerprint = await hmacSha256Hex(secret, `${CHAT_IP_HASH_ALGORITHM}:key-id`);
  return `${CHAT_IP_HASH_ALGORITHM}:${fingerprint.slice(0, 24)}`;
}

function invalidRuntimeSecretNames(env) {
  const invalid = REQUIRED_RUNTIME_SECRETS.filter((name) => {
    const value = String(env?.[name] || "").trim();
    return textBytes(value).byteLength < MIN_RUNTIME_SECRET_BYTES;
  });
  if (
    !invalid.length
    && String(env.CHAT_IP_HASH_SALT).trim() === String(env.ANALYTICS_IP_HASH_SALT).trim()
  ) {
    return [...REQUIRED_RUNTIME_SECRETS];
  }
  return invalid;
}

function runtimeSecret(env, name) {
  const value = String(env?.[name] || "").trim();
  if (textBytes(value).byteLength < MIN_RUNTIME_SECRET_BYTES) {
    throw new HttpError("Service privacy configuration is unavailable.", 503);
  }
  return value;
}

function timingSafeEqualBytes(left, right) {
  const a = left instanceof Uint8Array ? left : new Uint8Array(left);
  const b = right instanceof Uint8Array ? right : new Uint8Array(right);
  const length = Math.max(a.byteLength, b.byteLength);
  let diff = a.byteLength ^ b.byteLength;
  for (let index = 0; index < length; index += 1) {
    diff |= (a[index] || 0) ^ (b[index] || 0);
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
  constructor(message, status, code = "", details = null) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
