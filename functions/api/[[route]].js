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
  TrafficControlError,
  getTrafficControlAdminSnapshot,
  telemetryWriteDecision,
  updateTrafficControlSettings
} from "./traffic-control.mjs";
import {
  PUBLIC_LOOP_NIGHTLY_UPDATE_FILTER,
  queryPublishedArticle,
  queryPublishedArticles,
  toPublicArticle
} from "./public-content-service.mjs";

export const PUBLIC_API_REPRESENTATION_VERSION = "20260810-wallpaper-switch-route-motion-r1";
export const PUBLIC_ARTICLE_ARCHIVE_LIMIT = 500;
const PUBLIC_SITE_ORIGIN = "https://lusu575.com";
const PUBLIC_RELEASE_DATE = "2026-08-10";
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
const DATA_CLEANUP_STATE_KEY = "api_periodic_data_cleanup";
const DATA_CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const DATA_CLEANUP_DELETE_LIMIT = 5000;
const ARTICLE_SEED_STATE_KEY = "article_seed_version";
const ARTICLE_SEED_VERSION = "20260810-wallpaper-switch-route-motion-r1";
const LOGIN_EVENT_RETENTION_DAYS = 365;
const ANALYTICS_EVENT_RETENTION_DAYS = 180;
const AGENT_AUDIT_RETENTION_DAYS = 180;
const AGENT_ARTICLE_RECEIPT_RETENTION_DAYS = 180;
const AGENT_VIDEO_RECEIPT_RETENTION_DAYS = 180;
const JAPANESE_SUBTEXT_AGENT_RETENTION_DAYS = 180;
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
const CHAT_NICKNAME_LOOKBACK_LIMIT = 1000;
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
const AI_AGENT_WORKFLOW_ARTICLE_ID = "seed-ai-agent-workflow-guide-2026-06-14";
const AI_AGENT_WORKFLOW_PIN_REPAIR_KEY = "article_ai_agent_workflow_pin_repair_v1";
const AI_AGENT_WORKFLOW_PIN_REPAIR_TIME = "2026-07-28T05:20:00.000Z";
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
let articleSeedReady = false;
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
    if (!transferRoute && !agentAuthRoute) {
      assertMainApiMutationRequest(request, parts);
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
        context.waitUntil(runPeriodicDataCleanup(env).catch((error) => {
          console.error(JSON.stringify({
            message: "periodic api data cleanup failed",
            error: error instanceof Error ? error.message : String(error)
          }));
        }));
      }
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
      || error instanceof TrafficControlError;
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

async function register(request, env) {
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
  try {
    await env.DB.prepare(
      "insert into users (id, email, password_hash, created_at, updated_at) values (?, ?, ?, ?, ?)"
    ).bind(userId, email, passwordHash, now, now).run();
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return registrationFailedResponse();
    }
    throw error;
  }

  await recordUserLoginEvent(env, request, { id: userId, email, role: "user" }, "register");
  return createSessionResponse(env, request, userId, email, 201);
}

async function login(request, env) {
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
  await clearRateLimitBuckets(env, [rateContext.emailBucket, rateContext.pairBucket]);
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
  const { stageId, level, stage: stageNumber, ...progress } = stage;
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
  const rows = await queryPublishedArticles(env, { lang, category, limit });

  const payload = { articles: rows.map((row) => toPublicArticle(row)), lang };
  return cacheableJson(request, payload, {
    maxAge: 30,
    staleWhileRevalidate: 120,
    etagSeed: JSON.stringify(payload, (key, value) => key === "view_count" ? 0 : value)
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
  const rows = (await env.DB.prepare(`
    select
      articles.*,
      coalesce(zh.title, fallback.title, articles.slug) as title,
      count(distinct article_translations.translation_id) as translation_count,
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
    group by articles.article_id
    order by articles.updated_at desc, articles.article_id desc
  `).all()).results || [];
  return json({ articles: rows.map((row) => ({ ...row, tags: parseTags(row.tags) })) });
}

async function createArticle(request, env) {
  await requireAdmin(request, env);
  const body = await readJson(request);
  const article = normalizeArticlePayload(body);
  assertGenericAdminArticleCategoryMutation(null, article.category, { create: true });
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
  const duplicate = await findArticleAutomationDelivery(env, config, delivery.idempotencyKey);
  if (duplicate) {
    return articleAutomationReplayResponse(duplicate, payloadHash, config);
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
        return articleAutomationReplayResponse(repeated, payloadHash, config);
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

function articleAutomationReplayResponse(row, payloadHash, config) {
  if (Number(row.article_exists || 0) !== 1 || !row.article_id) {
    return json({
      error: "原投递对应的草稿已不存在，请使用新的唯一投递标记。",
      code: "IDEMPOTENCY_TARGET_MISSING"
    }, 409);
  }
  if (!sameSha256Hash(row.payload_hash, payloadHash)) {
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
    order by case when users.role = 'admin' then 0 else 1 end, users.updated_at desc
    limit 500
  `).bind(now).all()).results || [];
  return json({ accounts: rows.map(adminAccountRow) });
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
  const binds = [nextEmail, nextRole, nowIso()];
  if (passwordChanged) {
    fields.splice(2, 0, "password_hash = ?");
    binds.splice(2, 0, await hashPassword(password));
  }
  binds.push(existing.id, nextRole);
  const updateResult = await env.DB.prepare(`
    update users
    set ${fields.join(", ")}
    where id = ?
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
  `).bind(...binds).run();

  if (typeof updateResult?.meta?.changes === "number" && updateResult.meta.changes < 1) {
    const current = await env.DB.prepare("select id, role from users where id = ?").bind(existing.id).first();
    if (!current) {
      return json({ error: "账号不存在。" }, 404);
    }
    throw new HttpError("不能移除最后一个管理员；请先为其他账号授予管理员权限。", 409);
  }

  if (passwordChanged && revokeSessions) {
    if (existing.id === adminSession.user.id) {
      await env.DB.prepare("delete from sessions where user_id = ? and token_hash <> ?")
        .bind(existing.id, adminSession.tokenHash).run();
    } else {
      await env.DB.prepare("delete from sessions where user_id = ?").bind(existing.id).run();
    }
  }

  return await getAdminAccount(request, env, existing.id);
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
  const url = new URL(request.url);
  const requestedDays = Number(url.searchParams.get("days") || 14);
  const days = Number.isFinite(requestedDays)
    ? Math.min(Math.max(Math.trunc(requestedDays), 1), 90)
    : 14;
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
    cityRows,
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
      select country, region, city, count(*) as pv, count(distinct visitor_id) as uv,
             max(created_at) as last_seen_at, avg(latitude) as latitude, avg(longitude) as longitude
      from analytics_page_views
      where created_at >= ?
        and latitude is not null
        and longitude is not null
        and latitude between -90 and 90
        and longitude between -180 and 180
        and (abs(latitude) > 0.0001 or abs(longitude) > 0.0001)
        and (
          coalesce(trim(country), '') <> ''
          or coalesce(trim(region), '') <> ''
          or coalesce(trim(city), '') <> ''
        )
      group by country, region, city
      order by pv desc, uv desc
      limit 200
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
      select created_at, visitor_id, path, target_text, target_key, tag_name, data_route,
             screen_width, screen_height, country, region, city
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
    cities: (cityRows.results || []).map(adminAnalyticsCityRow),
    regions: regionRows.results || [],
    topPages: topPages.results || [],
    topArticles: topArticles.results || [],
    topClicks: topClicks.results || [],
    recentViews: recentViews.results || [],
    recentClicks: recentClicks.results || []
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
      anonymous_chat_messages.room_key,
      anonymous_chat_messages.encrypted,
      anonymous_chat_messages.created_at,
      anonymous_chat_messages.edited_at,
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
    ${where}
    order by anonymous_chat_messages.created_at desc, anonymous_chat_messages.message_id desc
    limit ?
  `).bind(currentIpHashKeyId, limit).all()).results || [];
  return json({ messages: rows });
}

async function updateAdminChatMessage(request, env, messageId) {
  await requireAdmin(request, env);
  const body = await readJson(request);
  const normalizedId = normalizeRecordId(messageId, "消息编号不正确。");
  const existing = await env.DB.prepare("select message_id, encrypted from anonymous_chat_messages where message_id = ?")
    .bind(normalizedId).first();
  if (!existing) {
    return json({ error: "消息不存在。" }, 404);
  }
  const nickname = body.nickname === undefined ? undefined : normalizeChatNickname(body.nickname);
  if (Number(existing.encrypted) === 1 && body.content !== undefined) {
    return json({ error: "加密消息内容不能在后台编辑。" }, 400);
  }
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
  const currentIpHashKeyId = await chatIpHashKeyId(runtimeSecret(env, "CHAT_IP_HASH_SALT"));
  const now = nowIso();
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
    order by chat_bans.created_at desc
    limit 100
  `).bind(currentIpHashKeyId, now, now, currentIpHashKeyId).all()).results || [];
  return json({ bans: rows });
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

async function recentChatNicknames(env, roomKey = PUBLIC_CHAT_ROOM_KEY) {
  const rows = (await env.DB.prepare(`
    select distinct nickname
    from (
      select nickname
      from anonymous_chat_messages
      where hidden = 0 and room_key = ?
      order by created_at desc, message_id desc
      limit ?
    )
  `).bind(roomKey, CHAT_NICKNAME_LOOKBACK_LIMIT).all()).results || [];
  return new Set(rows.map((row) => String(row.nickname || "").trim()).filter(Boolean));
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

function randomAvailableChatNickname(used, lang = "zh") {
  const pools = {
    zh: ["蓝屏像素", "像素幽灵", "草地路人A", "CRT访客", "电视小粉", "泡泡旅人"],
    en: ["BluePixel", "PixelGhost", "CRTGuest", "GrassWalk", "BubbleTrip", "TVHead"],
    ja: ["青いピクセル", "ピクセル幽霊", "CRT旅人", "草原の人", "テレビ旅人", "泡の旅人"]
  };
  const normalizedLang = normalizeArticleLang(lang);
  const names = pools[normalizedLang] || pools.zh;
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
  const fallbackPrefix = {
    zh: "访客",
    en: "Guest",
    ja: "ゲスト"
  }[normalizedLang] || "访客";
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const fallback = `${fallbackPrefix}${Math.floor(100000 + Math.random() * 900000)}`;
    if (!used.has(fallback) && isValidChatNicknameLength(fallback)) {
      return fallback;
    }
  }
  return `${fallbackPrefix}${Date.now().toString(36).slice(-6)}`;
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

async function runPeriodicDataCleanup(env) {
  const now = new Date();
  const dueBefore = new Date(now.getTime() - DATA_CLEANUP_INTERVAL_MS).toISOString();
  const state = await env.DB.prepare("select updated_at from site_runtime_state where key = ?")
    .bind(DATA_CLEANUP_STATE_KEY).first();
  if (state?.updated_at && Date.parse(state.updated_at) > Date.parse(dueBefore)) {
    return false;
  }

  const claimed = await env.DB.prepare(`
    insert into site_runtime_state (key, value, updated_at)
    values (?, '1', ?)
    on conflict(key) do update set
      value = excluded.value,
      updated_at = excluded.updated_at
    where site_runtime_state.updated_at <= ?
  `).bind(DATA_CLEANUP_STATE_KEY, now.toISOString(), dueBefore).run();
  if (Number(claimed?.meta?.changes || 0) !== 1) {
    return false;
  }

  const statements = [
    env.DB.prepare(`
      delete from sessions
      where token_hash in (
        select token_hash from sessions
        where expires_at <= ?
        order by expires_at asc
        limit ?
      )
    `).bind(now.toISOString(), DATA_CLEANUP_DELETE_LIMIT),
    env.DB.prepare(`
      delete from user_login_events
      where event_id in (
        select event_id from user_login_events
        where created_at < ?
        order by created_at asc
        limit ?
      )
    `).bind(
      new Date(now.getTime() - LOGIN_EVENT_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString(),
      DATA_CLEANUP_DELETE_LIMIT
    ),
    env.DB.prepare(`
      delete from api_rate_limits
      where bucket_key in (
        select bucket_key from api_rate_limits
        where updated_at < ?
        order by updated_at asc
        limit ?
      )
    `).bind(
      new Date(now.getTime() - API_RATE_LIMIT_RETENTION_MS).toISOString(),
      DATA_CLEANUP_DELETE_LIMIT
    ),
    env.DB.prepare(`
      delete from agent_device_authorizations
      where device_id in (
        select device_id from agent_device_authorizations
        where expires_at <= ?
        order by expires_at asc
        limit ?
      )
    `).bind(now.toISOString(), DATA_CLEANUP_DELETE_LIMIT),
    env.DB.prepare(`
      delete from agent_access_tokens
      where token_id in (
        select token_id from agent_access_tokens
        where expires_at <= ? or revoked_at <> ''
        order by expires_at asc
        limit ?
      )
    `).bind(now.toISOString(), DATA_CLEANUP_DELETE_LIMIT),
    env.DB.prepare(`
      delete from agent_audit_log
      where event_id in (
        select event_id from agent_audit_log
        where created_at < ?
        order by created_at asc
        limit ?
      )
    `).bind(
      new Date(now.getTime() - AGENT_AUDIT_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString(),
      DATA_CLEANUP_DELETE_LIMIT
    )
  ];
  const japaneseSubtextAgentCutoff = new Date(
    now.getTime() - JAPANESE_SUBTEXT_AGENT_RETENTION_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
  if (await tableExists(env, "agent_article_receipts")) {
    statements.push(
      env.DB.prepare(`
        delete from agent_article_receipts
        where rowid in (
          select rowid from agent_article_receipts
          where created_at < ?
          order by created_at asc
          limit ?
        )
      `).bind(
        new Date(
          now.getTime() - AGENT_ARTICLE_RECEIPT_RETENTION_DAYS * 24 * 60 * 60 * 1000
        ).toISOString(),
        DATA_CLEANUP_DELETE_LIMIT
      )
    );
  }
  if (await tableExists(env, "agent_video_receipts")) {
    statements.push(
      env.DB.prepare(`
        delete from agent_video_receipts
        where rowid in (
          select rowid from agent_video_receipts
          where created_at < ?
          order by created_at asc
          limit ?
        )
      `).bind(
        new Date(
          now.getTime() - AGENT_VIDEO_RECEIPT_RETENTION_DAYS * 24 * 60 * 60 * 1000
        ).toISOString(),
        DATA_CLEANUP_DELETE_LIMIT
      )
    );
  }
  if (
    await tableExists(env, "japanese_subtext_agent_receipts")
    && await tableExists(env, "japanese_subtext_agent_attempts")
  ) {
    statements.push(
      env.DB.prepare(`
        delete from japanese_subtext_agent_receipts
        where rowid in (
          select rowid from japanese_subtext_agent_receipts
          where created_at < ?
          order by created_at asc
          limit ?
        )
      `).bind(japaneseSubtextAgentCutoff, DATA_CLEANUP_DELETE_LIMIT),
      env.DB.prepare(`
        delete from japanese_subtext_agent_attempts
        where attempt_id in (
          select attempt_id from japanese_subtext_agent_attempts
          where created_at < ?
          order by created_at asc
          limit ?
        )
      `).bind(japaneseSubtextAgentCutoff, DATA_CLEANUP_DELETE_LIMIT)
    );
  }
  const analyticsCutoff = new Date(
    now.getTime() - ANALYTICS_EVENT_RETENTION_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
  if (await tableExists(env, "analytics_page_views")) {
    statements.push(
      env.DB.prepare(`
        delete from analytics_page_views
        where event_id in (
          select event_id from analytics_page_views
          where created_at < ?
          order by created_at asc
          limit ?
        )
      `).bind(analyticsCutoff, DATA_CLEANUP_DELETE_LIMIT)
    );
  }
  if (await tableExists(env, "analytics_click_events")) {
    statements.push(
      env.DB.prepare(`
        delete from analytics_click_events
        where event_id in (
          select event_id from analytics_click_events
          where created_at < ?
          order by created_at asc
          limit ?
        )
      `).bind(analyticsCutoff, DATA_CLEANUP_DELETE_LIMIT)
    );
  }
  if (await tableExists(env, "article_view_events")) {
    statements.push(
      env.DB.prepare(`
        delete from article_view_events
        where event_id in (
          select event_id from article_view_events
          where created_at < ?
          order by created_at asc
          limit ?
        )
      `).bind(analyticsCutoff, DATA_CLEANUP_DELETE_LIMIT)
    );
  }
  await env.DB.batch(statements);
  return true;
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

function articleTranslationsStatements(env, articleId, translations, createdAt, updatedAt = createdAt) {
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

const DAILY_AI_NEWS_2026_07_27_READER_PATCH = Object.freeze({
  slug: "daily-ai-news-2026-07-27",
  updatedAt: "2026-07-27T20:30:00.000Z",
  intros: Object.freeze({
    zh: "采集范围为北京时间 7 月 26 日 23:00 至 7 月 27 日 23:00。只保留在这一窗口内发布、且达到重要性门槛的消息。",
    en: "The collection window runs from 11:00 p.m. Beijing time on July 26 to 11:00 p.m. on July 27. Only material published inside that window and clearing the importance threshold is included.",
    ja: "収集期間は北京時間7月26日23時から7月27日23時までです。この24時間内に公開され、重要度の基準を満たした情報だけを掲載します。"
  })
});

function articleSeedStatements(env) {
  // Seed timestamps must be UTC ISO strings; the UI converts them to each visitor's local time.
  return [
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (
        'seed-update-2026-08-10-wallpaper-switch-slim-dawn',
        '2026-08-10-wallpaper-switch-slim-dawn',
        'site-updates',
        '["网站更新","壁纸","动效","Image2","无障碍"]',
        '', 'published', 0, 0,
        '2026-08-10T02:30:00.000Z',
        '2026-08-10T04:10:00.000Z',
        '2026-08-10T04:10:00.000Z'
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
    ...articleTranslationsStatements(env, "seed-update-2026-08-10-wallpaper-switch-slim-dawn", {
      zh: {
        title: "四段壁纸开关的细框晨曦精修",
        summary: "四段壁纸开关采用更轻薄清晰的陶瓷细框、滚轮环和低位暖橙半日晨雾，让清晨区别于白天。滚轮、场景、天体与四主题 accent 在所有可见桌面公共路由共享同一套可中断动画；整页壁纸 crossfade 与动态云仍由 Home 独占。",
        content_markdown: `# 四段壁纸开关的细框晨曦精修

网站右上角的四段壁纸开关继续沿用现有的自动时间与手动覆盖行为。这一轮只聚焦材质重量、清晰度，以及清晨和白天的辨识度。

## 更轻薄清晰的陶瓷轮廓

- Image2 重新制作外部椭圆陶瓷壳和选中滚轮环，减轻过粗边缘，同时保留清晰的陶瓷高光与对齐的内外轮廓。
- 四个 44px 触摸目标保持不变，没有缩小交互面积。
- 滚轮继续通过可中断的 transform 在四个节点间流畅移动，中心时段图案保持正向。

## 清晨不再像白天

清晨改为低位暖橙半日配合薄晨雾，强调太阳刚从地平线升起；白天继续使用高位、完整而明亮的太阳。选中和未选中的时段语义因此都能在小尺寸下快速分辨。

## 桌面各路由共享完整开关动效

开关内部的滚轮、当前场景、天体和四主题 accent 现在会在 Home、Knowledge、Videos、Tools、Games、Blog、Chat 与 About 等每个可见的桌面公共路由完整加载，并始终使用同一套可中断动画。这里扩展的是顶栏开关自身；首页整页壁纸的 crossfade 与动态云仍只在 Home 运行。移动 App 的紧凑栏继续隐藏开关，Android Home 的布局与行为保持不变。

## 行为与动效降级保持不变

开关继续按本地 05:00／11:00／17:00／20:00 自动换档，手动选择只覆盖到下一个真实时段边界。四个主题原有的晨光、白云、余晖和星群 accent 保留；keyboard 与 motion-off 立即提交，reduced-motion 移除位置移动，low 性能档和 Save-Data 跳过 accent，但保留完整时间行为与四个节点。`
      },
      en: {
        title: "Slim-Rim Dawn Polish for the Four-Stage Wallpaper Switch",
        summary: "The four-stage wallpaper switch now pairs a slimmer, crisper ceramic rim and roller ring with a low warm-orange half sun and dawn mist, clearly separating morning from day. Its roller, scene, celestial body, and four theme accents share one interruptible animation system across every visible desktop public route; full-page wallpaper crossfades and dynamic clouds remain exclusive to Home.",
        content_markdown: `# Slim-Rim Dawn Polish for the Four-Stage Wallpaper Switch

The four-stage wallpaper switch at the site's upper right keeps its existing automatic schedule and manual override behavior. This pass focuses only on visual weight, clarity, and the distinction between morning and day.

## A slimmer, clearer ceramic outline

- Image2 rebuilt the outer oval ceramic shell and active roller ring with lighter edges while preserving crisp ceramic highlights and aligned inner and outer contours.
- All four 44px touch targets remain unchanged, so the interactive area has not been reduced.
- The roller still moves fluidly between four stops with an interruptible transform while the time-of-day subject in its center stays upright.

## Morning no longer reads as day

Morning now uses a low warm-orange half sun with a thin layer of dawn mist, emphasizing a sun that has just reached the horizon. Day keeps a high, complete, bright sun. The selected and unselected time semantics are therefore easier to distinguish at the switch's actual size.

## Complete switch motion across desktop routes

The switch's roller, current scene, celestial body, and all four theme accents now load completely on every visible desktop public route, including Home, Knowledge, Videos, Tools, Games, Blog, Chat, and About, while always using the same interruptible animation system. This expansion applies only to the top-bar switch itself; full-page wallpaper crossfades and dynamic clouds remain Home-only. The compact mobile App bar continues to hide the switch, and Android Home keeps its existing layout and behavior.

## Timing and motion fallbacks are unchanged

The switch still changes automatically at local 05:00, 11:00, 17:00, and 20:00, while a manual choice lasts only until the next real period boundary. The four existing theme accents—morning light, day clouds, dusk afterglow, and night stars—remain. Keyboard and motion-off changes commit immediately, reduced motion removes positional travel, and low-performance mode and Save-Data skip accents while retaining the complete timing behavior and all four stops.`
      },
      ja: {
        title: "壁紙4段スイッチの細枠・朝焼け調整",
        summary: "壁紙4段スイッチは、より薄く鮮明なセラミック細枠とローラーリング、低い暖色の半円日と朝霧で朝を昼から明確に分けます。ローラー、シーン、天体、4テーマの accent は表示中の全デスクトップ公開ルートで同じ中断可能なアニメーションを共有し、ページ全体の壁紙 crossfade と動く雲は Home 専用です。",
        content_markdown: `# 壁紙4段スイッチの細枠・朝焼け調整

サイト右上の壁紙4段スイッチは、既存の自動時刻と手動上書きの動作をそのまま維持します。今回は素材の重さ、鮮明さ、朝と昼の識別だけに焦点を当てました。

## より薄く鮮明なセラミック輪郭

- Image2 で外側の楕円セラミックシェルと選択中のローラーリングを作り直し、鮮明なセラミックのハイライトと揃った内外輪郭を保ちながら、太すぎる縁を軽くしました。
- 4つの 44px タッチ領域は変えず、操作面積を縮小していません。
- ローラーは中断可能な transform で4つの停止位置を滑らかに移動し、中央の時間帯モチーフは正立を保ちます。

## 朝を昼と明確に区別

朝は低い位置の暖かなオレンジ色の半円日と薄い朝霧を使い、太陽が地平線から昇り始めた状態を強調します。昼は高い位置の完全で明るい太陽を維持します。これにより、選択中と未選択のどちらでも、実際の小さな表示サイズで時間帯を見分けやすくなります。

## デスクトップ各ルートで完全なスイッチ動作

スイッチ内部のローラー、現在のシーン、天体、4テーマすべての accent は、Home、Knowledge、Videos、Tools、Games、Blog、Chat、About を含む表示中のすべてのデスクトップ公開ルートで完全に読み込まれ、常に同じ中断可能なアニメーションを使用します。この拡張はトップバーのスイッチ本体だけに適用され、ページ全体の壁紙 crossfade と動く雲は引き続き Home のみで動作します。モバイル App のコンパクトバーではスイッチを非表示のままとし、Android Home のレイアウトと動作は変わりません。

## 時刻動作とモーションのフォールバックは維持

スイッチはローカル時刻の 05:00／11:00／17:00／20:00 に自動で切り替わり、手動選択は次の実際の時間帯境界までだけ続きます。朝の光、昼の雲、夕方の残光、夜の星という4テーマの accent は維持します。keyboard と motion-off は即時確定し、reduced-motion は位置移動をなくし、low モードと Save-Data は accent を省略しても、完全な時刻動作と4つの停止位置を保ちます。`
      }
    }, "2026-08-10T02:30:00.000Z", "2026-08-10T04:10:00.000Z"),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (
        'seed-update-2026-08-10-wallpaper-switch-ceramic-roll',
        '2026-08-10-wallpaper-switch-ceramic-roll',
        'site-updates',
        '["网站更新","壁纸","动效","Image2","无障碍"]',
        '', 'published', 0, 0,
        '2026-08-10T00:20:00.000Z',
        '2026-08-10T00:20:00.000Z',
        '2026-08-10T00:20:00.000Z'
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
    ...articleTranslationsStatements(env, "seed-update-2026-08-10-wallpaper-switch-ceramic-roll", {
      zh: {
        title: "四段壁纸开关的陶瓷滚动重制",
        summary: "四段壁纸开关按参考图重制为暖象牙陶瓷椭圆壳与统一内沿，并换上四个高辨识时段节点。36px 选中轮以可中断 transform 平移，独立外圈按物理距离滚转而内部天体保持正向；晨光上展、两朵白云横移、余晖横向展开、星群上升。键盘／motion-off 即时完成，reduced-motion 不做位置移动，low／Save-Data 跳过 accent。",
        content_markdown: `# 四段壁纸开关的陶瓷滚动重制

网站右上角的四段壁纸开关再次精修。时间自动切换、手动选择只持续到下一真实边界的行为保持不变，这次重点统一了参考图中的材质、轮廓和滚动手感。

## 暖象牙陶瓷椭圆

- Image2 重新制作暖象牙陶瓷外壳、统一对齐的椭圆内沿，以及更接近参考图的清透天空底色。
- 早上、白天、傍晚和夜晚使用四个高辨识语义节点，不再让未选中状态融进背景。
- 当前档位使用 36px 选中轮，在框内保留细小安全间距。

## 外圈滚动，天体保持正向

选中轮以可中断的 transform 在四个档位间平移。独立外圈按实际移动距离旋转，形成连续的物理滚动；圆心里的晨日、正午太阳、落日或月亮始终保持正向，不会跟着倒转。快速连续选择可以从当前帧重定向到最新目标。

## 四个时段，四种入场

- morning：晨光从下方向上展开。
- day：两朵白云沿水平方向轻快横移。
- dusk：余晖以低位水平带向两侧展开。
- night：稀疏星群从下方升起。

这些 accent 只服务当前主题，不堆叠额外场景元素。键盘操作和 motion-off 即时提交；reduced-motion 移除位置运动，只保留必要的短淡化；low 性能档与 Save-Data 跳过 accent，但保留完整色场、四个节点和时间切换。`
      },
      en: {
        title: "Ceramic Rolling Redesign for the Four-Stage Wallpaper Switch",
        summary: "The four-stage wallpaper switch now follows the reference's warm ivory ceramic oval shell and aligned inner rim, with four more recognizable time stops. A 36px selector travels with an interruptible transform while its independent outer ring rolls by physical distance and the celestial center stays upright. Morning light rises and opens, two white clouds cross during the day, dusk glow spreads sideways, and night stars rise. Keyboard/motion-off changes are immediate, reduced motion removes position travel, and low/Save-Data skips accents.",
        content_markdown: `# Ceramic Rolling Redesign for the Four-Stage Wallpaper Switch

The four-stage wallpaper switch at the site's upper right has received another focused polish pass. Automatic scheduling and manual selection until the next real boundary are unchanged; this revision aligns the material, contours, and rolling feel with the reference.

## A warm ivory ceramic oval

- Image2 rebuilt the warm ivory ceramic shell, one precisely aligned oval inner rim, and clearer sky fields closer to the reference.
- Morning, day, dusk, and night now use four highly recognizable semantic stops so inactive states do not disappear into the field.
- The active position uses a 36px selector with a small, consistent inset inside the frame.

## A rolling ring with an upright celestial center

The selector translates between four stops with an interruptible transform. Its independent outer ring rotates according to the real travel distance, creating continuous physical rolling, while the morning sun, noon sun, setting sun, or moon in the center remains upright. Rapid repeated choices can retarget from the current frame to the latest destination.

## Four periods, four entrances

- Morning light rises and opens upward.
- Two white clouds move lightly across the track during the day.
- Dusk afterglow expands sideways as a low horizontal band.
- A sparse night star field rises from below.

Each accent belongs only to the current theme, without extra scene clutter. Keyboard input and motion-off commit immediately. Reduced motion removes positional travel and keeps only a necessary short fade. Low-performance mode and Save-Data skip accents while retaining the complete field, all four stops, and time switching.`
      },
      ja: {
        title: "壁紙4段スイッチをセラミック調ローリング仕様に再設計",
        summary: "壁紙4段スイッチを、参考画像に合わせた暖かなアイボリーのセラミック楕円シェルと揃った内周へ作り直し、4時間帯のノードも識別しやすくしました。36px の選択輪は中断可能な transform で移動し、独立した外周だけが物理距離に応じて回転して中央の天体は正立を保ちます。朝の光は上へ開き、昼には2つの雲が横切り、夕方の残光は横へ広がり、夜の星群は上昇します。keyboard／motion-off は即時、reduced-motion は位置移動なし、low／Save-Data は accent を省略します。",
        content_markdown: `# 壁紙4段スイッチをセラミック調ローリング仕様に再設計

サイト右上の壁紙4段スイッチを、もう一度丁寧に磨き直しました。時刻による自動切り替えと、次の実際の時間境界まで維持する手動選択は変えず、今回は参考画像の素材感、輪郭、転がる感触を揃えています。

## 暖かなアイボリーのセラミック楕円

- Image2 で暖かなアイボリーのセラミック外枠、正確に揃った一つの楕円内周、参考画像に近い澄んだ空の色面を作り直しました。
- 朝・昼・夕方・夜は識別しやすい4種類の意味ノードを使い、未選択状態が背景に溶け込まないようにしました。
- 選択中の位置は 36px の選択輪を使い、枠内に小さく一定の余白を残します。

## 外周だけが転がり、天体は正立

選択輪は中断可能な transform で4つの位置を移動します。独立した外周は実際の移動距離に応じて回転し、連続した物理的なローリングを表現します。中央の朝日、真昼の太陽、夕日、月は常に正立したままです。素早く連続して選んでも、現在のフレームから最新の行き先へ再設定できます。

## 4時間帯に4種類の入場

- morning：朝の光が下から上へ開きます。
- day：2つの白い雲が水平方向へ軽く横切ります。
- dusk：低い残光の帯が左右へ広がります。
- night：まばらな星群が下から上昇します。

accent は現在のテーマだけに使い、余計な景物は重ねません。keyboard 操作と motion-off は即時確定します。reduced-motion では位置移動をなくし、必要な短いフェードだけを残します。low モードと Save-Data では accent を省略しても、色面、4ノード、時刻切り替えは維持します。`
      }
    }, "2026-08-10T00:20:00.000Z"),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (
        'seed-update-2026-08-10-wallpaper-switch-calm-redesign',
        '2026-08-10-wallpaper-switch-calm-redesign',
        'site-updates',
        '["网站更新","壁纸","动效","Image2","无障碍"]',
        '', 'published', 0, 0,
        '2026-08-09T16:00:00.000Z',
        '2026-08-09T16:00:00.000Z',
        '2026-08-09T16:00:00.000Z'
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
    ...articleTranslationsStatements(env, "seed-update-2026-08-10-wallpaper-switch-calm-redesign", {
      zh: {
        title: "四时段壁纸开关轻量重做",
        summary: "四时段壁纸开关再次轻量重做：Image2 重新生成极简色场、四个语义浮雕节点，以及每个主题唯一一层点题内容；移除多层风景、行星与错峰装饰。选择器可随快速操作中断并重定向，键盘和 motion-off 即时完成；reduced-motion 只保留淡化，low／Save-Data 跳过 accent 层。",
        content_markdown: `# 四时段壁纸开关轻量重做

经过多轮视觉复核，网站右上角的 176×44 四时段椭圆开关改为更安静、更轻量的版本，自动时段与手动到下一时间边界的行为不变。

## 更安静的 Image2 视觉

- Image2 重新生成早上、中午、下午和夜晚四组极简色场，整条轨道始终只呈现当前主题。
- 未选中位不再使用突兀的空白圆点，而是四个低对比、语义各异的浮雕节点；当前位继续使用对应天体主体。
- 每个主题只保留一层点题 accent，移除了多层风景、行星、密集元素和错峰入场。

## 流畅且可中断的切换

选择器只用 transform 移动，快速连续选择时可从当前帧中断并转向最新目标。整条场景使用简短交叉淡化，只让当前主题的单层 accent 进入，不再等待多层错峰。

## 键盘与性能降级

键盘操作和站内 motion-off 会立即提交目标状态。reduced-motion 只保留短暂透明度变化；low 性能档和 Save-Data 直接跳过 accent，仍保留完整色场、语义节点和时间切换功能。`
      },
      en: {
        title: "Four-Stage Wallpaper Switch Calm Redesign",
        summary: "The four-stage wallpaper switch has been rebuilt around a calmer, lighter system. Image2 regenerated four minimal color fields, four semantic embossed stops, and one accent layer per theme; layered scenery, planets, and staggered decoration are removed. The selector stays interruptible and retargetable, keyboard and motion-off changes are immediate, reduced motion keeps only a fade, and low/Save-Data skips the accent layer.",
        content_markdown: `# Four-Stage Wallpaper Switch Calm Redesign

After several visual reviews, the 176×44 four-stage oval switch at the upper right has been rebuilt as a calmer, lighter control. Its automatic schedule and manual override until the next real time boundary are unchanged.

## Calmer Image2 visuals

- Image2 regenerated minimal morning, day, dusk, and night color fields. The whole track always presents only the current theme.
- Unselected positions no longer use stark blank dots. They use four distinct, low-contrast embossed semantic stops, while the active position keeps its matching celestial subject.
- Each theme keeps exactly one accent layer. Layered scenery, planets, dense decoration, and staggered entrances have been removed.

## Smooth, interruptible switching

The selector moves only with transform and can be interrupted from its current frame and retargeted to the latest choice during rapid input. The full scene uses a short crossfade, and only the current theme's single accent enters; there is no multi-layer stagger to wait for.

## Keyboard and performance fallbacks

Keyboard input and the site's motion-off mode commit the target state immediately. Reduced motion keeps only a short opacity change. The low-performance and Save-Data modes skip the accent while retaining the complete color field, semantic stops, and time-switching behavior.`
      },
      ja: {
        title: "4段階壁紙スイッチの穏やかな再設計",
        summary: "4段階壁紙スイッチを、より穏やかで軽量な構成に再設計しました。Image2 で最小限の色面4種、意味の異なる浮き彫りノード4種、各テーマ一層の accent を生成し直し、多層の風景、惑星、時間差装飾を削除しました。selector は中断・再設定可能で、keyboard／motion-off は即時、reduced-motion はフェードのみ、low／Save-Data では accent を読み込みません。",
        content_markdown: `# 4段階壁紙スイッチの穏やかな再設計

複数回のビジュアル検証を受け、右上の 176×44 の4段階楕円スイッチを、より穏やかで軽量なコントロールに作り直しました。時刻による自動切り替えと、次の実際の時間境界まで維持する手動選択は変わりません。

## 穏やかな Image2 ビジュアル

- Image2 で朝・昼・夕方・夜の最小限の色面を再生成し、トラック全体は常に現在のテーマだけを表示します。
- 未選択位置の目立つ空白ドットをやめ、意味の異なる低コントラストの浮き彫りノード4種に変更しました。選択中の位置は対応する天体を保ちます。
- 各テーマに残す accent は一層だけです。多層の風景、惑星、密集した装飾、時間差入場を削除しました。

## 滑らかで中断可能な切り替え

selector は transform だけで移動し、素早い連続操作でも現在のフレームから中断し、最新の選択へ再設定できます。シーン全体は短くクロスフェードし、現在のテーマの一層の accent だけが入ります。

## キーボードと性能フォールバック

keyboard 操作とサイト内 motion-off は目標状態を即時に確定します。reduced-motion は短い透明度変化だけを残します。low モードと Save-Data では accent を読み込まず、色面、意味ノード、時間切り替えの機能はそのまま保ちます。`
      }
    }, "2026-08-09T16:00:00.000Z"),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (
        'seed-update-2026-08-09-wallpaper-switch-scene-redesign',
        '2026-08-09-wallpaper-switch-scene-redesign',
        'site-updates',
        '["网站更新","壁纸","动效","Image2","无障碍"]',
        '', 'published', 0, 0,
        '2026-08-09T11:15:00.000Z',
        '2026-08-09T11:15:00.000Z',
        '2026-08-09T11:15:00.000Z'
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
    ...articleTranslationsStatements(env, "seed-update-2026-08-09-wallpaper-switch-scene-redesign", {
      zh: {
        title: "四时段壁纸开关场景重做",
        summary: "四时段壁纸开关改为单场景椭圆：整条轨道始终只显示当前天空，四个节点常驻，活跃节点分别呈现半露朝阳、完整太阳、低位落日或月亮；只有当前时段的云、光芒、星星与行星分层进入。全部视觉使用 Image2 生成位图，并保留自动边界、手动到下一边界、键盘与减弱／关闭动效降级。",
        content_markdown: `# 四时段壁纸开关场景重做

网站右上角的四段壁纸开关改为一条完整的椭圆天空场景，不再同时铺开四种时段画面。

## 一条轨道，一个当前天空

- 整条椭圆始终只呈现当前时段的完整天空，切换时整条轨道一起进入目标主题。
- 早上、中午、下午和晚上四个节点常驻；当前节点分别使用半露朝阳、完整太阳、低位落日或月亮作为主体。
- 只有当前时段的云、光芒、星星与行星会分层进入，其他三个节点保持安静、可见并可选择。

## Image2 位图与时间行为

轨道天空、四种节点主体和分层装饰全部使用 Image2 生成的项目内位图。开关继续按设备本地时间在真实边界自动切换；用户手动选择后，目标壁纸立即生效，并只覆盖到下一个真实时间边界。

## 键盘与动效降级

四个节点支持键盘选择。键盘操作立即提交，不等待空间位移；reduced-motion 只保留短暂透明度变化，站内关闭动效时立即切换，不播放装饰入场。`
      },
      en: {
        title: "Four-Stage Wallpaper Switch Scene Redesign",
        summary: "The four-stage wallpaper switch is now a single-scene oval: the whole track shows only the current sky while four persistent stops remain visible. The active stop carries a partly risen morning sun, full daytime sun, low setting sun, or moon, and only the current period's clouds, rays, stars, and planet enter in layers. All visuals are Image2-generated bitmaps, with automatic boundaries, manual overrides until the next boundary, keyboard access, and reduced/off-motion fallbacks.",
        content_markdown: `# Four-Stage Wallpaper Switch Scene Redesign

The four-stage wallpaper switch at the site's upper right is now one complete oval sky scene instead of four time-of-day scenes shown at once.

## One track, one current sky

- The entire oval always presents the complete sky for the current period, and the whole track changes together when another period is selected.
- Four persistent stops remain for morning, day, dusk, and night. The active stop uses a partly risen morning sun, full daytime sun, low setting sun, or moon.
- Only the current period's clouds, rays, stars, and planet enter in layers. The other three stops stay quiet, visible, and selectable.

## Image2 bitmaps and time behavior

The track skies, four celestial subjects, and layered decorations are all project-local bitmaps generated with Image2. The switch continues to follow real device-local time boundaries automatically. A manual selection applies its wallpaper immediately and lasts only until the next real boundary.

## Keyboard and motion fallbacks

All four stops support keyboard selection. Keyboard input commits immediately without waiting for spatial travel; reduced motion keeps only a short opacity change, while the site's motion-off mode switches immediately without decorative entrances.`
      },
      ja: {
        title: "4段階壁紙スイッチのシーン再設計",
        summary: "4段階の壁紙スイッチを、現在の空だけを楕円全体に映す単一シーンへ再設計しました。4つのノードは常時表示し、選択中のノードは半分見える朝日、真昼の太陽、低い夕日、月に切り替わります。雲、光、星、惑星は現在の時間帯だけ段階的に現れます。ビジュアルはすべて Image2 生成ビットマップで、時刻境界の自動切り替え、次の境界までの手動選択、キーボード、モーション低減／オフ時のフォールバックに対応します。",
        content_markdown: `# 4段階壁紙スイッチのシーン再設計

サイト右上の4段階壁紙スイッチを、4つの時間帯を同時に並べる表示から、一つの完全な楕円形の空へ作り直しました。

## 一つのトラックに、現在の空だけ

- 楕円全体は常に現在の時間帯の空だけを表示し、別の時間帯を選ぶとトラック全体が対象テーマへ切り替わります。
- 朝・昼・夕方・夜の4ノードは常時表示します。選択中のノードは、半分見える朝日、真昼の太陽、低い夕日、月をそれぞれ主体にします。
- 雲、光、星、惑星は現在の時間帯だけ段階的に現れます。ほかの3ノードは静かなまま見えており、選択できます。

## Image2 ビットマップと時刻の動作

トラックの空、4種類の天体、レイヤー装飾はすべて Image2 で生成したプロジェクト内ビットマップです。スイッチは引き続き端末のローカル時刻にある実際の境界で自動切り替えします。手動で選ぶと対象壁紙がすぐ反映され、次の実際の境界までだけ維持されます。

## キーボードとモーションのフォールバック

4ノードはキーボードで選択できます。キーボード操作は空間移動を待たず即時確定します。モーション低減時は短い透明度変化だけを残し、サイト内のモーションオフでは装飾の入場を行わず即時切り替えします。`
      }
    }, "2026-08-09T11:15:00.000Z"),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (
        'seed-update-2026-08-09-game-video-mcp-candidate',
        '2026-08-09-game-video-mcp-candidate',
        'site-updates',
        '["网站更新","AI 能力","游戏","视频区","MCP","安全"]',
        '', 'published', 0, 0,
        '2026-08-09T09:30:00.000Z',
        '2026-08-09T09:30:00.000Z',
        '2026-08-09T09:30:00.000Z'
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
    ...articleTranslationsStatements(env, "seed-update-2026-08-09-game-video-mcp-candidate", {
      zh: {
        title: "游戏 MCP 保活修复候选与视频闭环点检",
        summary: "当前生产站长 Worker 为 377d494b-8f90-40ad-998f-863d209e1978；外链视频管理闭环已在该精确 bundle 通过，但远程可用性尚未晋级。2048 点检在暂停后暴露空闲 WebSocket 断线；本次 Pages 发布加入每 8 秒严格 ping／pong 保活，Worker 已具备边缘自动应答。精确线上字节与四游戏闭环仍待核验，Kittens Game 与真视频上传不开放。",
        content_markdown: `# 游戏 MCP 保活修复候选与视频闭环点检

当前生产站长 Worker 的精确 version ID 为 \`377d494b-8f90-40ad-998f-863d209e1978\`。该 bundle 已承载游戏／视频候选；视频条目的 \`availableTransports\` 尚未包含 \`remote-mcp\`，游戏条目的 \`availableTransports\` 仍为空，本记录不会把候选写成已对外可用。

## 游戏浏览器接管保活修复

- 2048、Hextris、A Dark Room 与人生重开继续只通过受审计的语义 bridge 返回有界 observation、当前 revision 和不透明 \`actionId\`；选择器、脚本、原始按键、坐标、URL、DOM 指令与原始存档继续失败关闭。
- 2048 生产点检已通过一次性配对、语义动作、revision CAS、暂停和旧令牌撤销，但暂停后等待玩家恢复时 WebSocket 空闲断开，最终得到 \`GAME_BROWSER_DISCONNECTED\`。因此四款游戏的完整真实验收仍未通过。
- 当前生产 Worker 已用 Cloudflare Hibernation \`setWebSocketAutoResponse("ping", "pong")\` 配置精确边缘自动应答。本次 Pages 发布让浏览器每 8 秒发送精确应用层文本 \`ping\` 并忽略精确 \`pong\`；自动应答不唤醒 Durable Object、不读取游戏 provider、不执行 observation 或 action、不改变 revision，也不写入中继存储，不能把保活误当作观察。
- 生产 Worker 保持 \`377d494b-8f90-40ad-998f-863d209e1978\`。精确 Pages commit 的线上字节核验后，必须把验收绑定到这一 Worker／Pages 组合，并在 \`games:play\` OAuth 下逐款完成配对、动作、暂停、玩家恢复、确认关闭与 grant 撤销。最终可用性 promotion 会产生新的 Worker，届时游戏与视频闭环都必须对该新 bundle 完整重验，才能讨论加入 \`availableTransports\`。
- Kittens Game 继续保持 \`NO_AGENT\`；WET PAWS LICENSE 未取得明确许可或法律确认前不得接管。

## 视频 MCP 第一阶段

同一 \`377d494b-8f90-40ad-998f-863d209e1978\` bundle 已完成 YouTube／Bilibili／b23.tv 外链记录的生产闭环：规范化、原子发布、同载荷 \`operationId\` 重放、管理读取、元数据刷新、\`expectedUpdatedAt\` CAS、\`confirm: true\` 删除、公开缺失回读和 RFC 7009 撤销均通过，临时记录已删除。该证据只绑定这一精确 bundle；在最终可用性 promotion 与新 bundle 复验前，视频条目的 \`availableTransports\` 继续不包含 \`remote-mcp\`。

这仍不是真视频文件上传。远程 MCP 不读取本机路径、Base64、原始字节或客户端文件；真实上传必须另建并验收私有 R2 二进制数据面。

## Quick Transfer 治理边界

当前分支继承主线已上线的 Quick Transfer v1.0.10。本次保活发布不修改 registry 或 Quick Transfer 受管路径，不再次升版；互传协议、房间、口令、AES-GCM、私有 R2、配额、Multipart、鉴权与 24 小时生命周期均不改变。

## 当前上线边界

生产 Worker 仍是 \`377d494b-8f90-40ad-998f-863d209e1978\`；本次发布加入 Pages 心跳资源，精确线上字节与四游戏真实闭环仍待按 Worker／Pages 组合核验。任何游戏或视频候选都没有在 registry 中提前标记为远程可用；历史知识库验收和当前视频点检都不能跨 Worker bundle 复用。`
      },
      en: {
        title: "Game MCP Heartbeat Fix Candidate and Video Lifecycle Check",
        summary: "The current production owner Worker is 377d494b-8f90-40ad-998f-863d209e1978. Its external-video management lifecycle passed for that exact bundle, but remote availability is not promoted. A 2048 check exposed an idle WebSocket disconnect after pause. This Pages release adds an exact eight-second ping/pong heartbeat, while the Worker already provides the edge auto-response. Exact live bytes and the four-game lifecycle still require verification; Kittens Game and true video upload remain unavailable.",
        content_markdown: `# Game MCP Heartbeat Fix Candidate and Video Lifecycle Check

The exact current production owner Worker version is \`377d494b-8f90-40ad-998f-863d209e1978\`. That bundle carries the game/video candidate. Video \`availableTransports\` does not yet include \`remote-mcp\`, and game \`availableTransports\` remains empty; this update does not describe the candidate as externally available.

## Browser-game connection-liveness fix

- 2048, Hextris, A Dark Room, and Life Restart continue to expose only audited semantic bridges with bounded observations, the current revision, and opaque \`actionId\` values. Selectors, scripts, raw keys, coordinates, URLs, DOM commands, and raw saves remain rejected.
- A production 2048 check passed one-time pairing, a semantic action, revision CAS, pause, and old-token revocation. While waiting for the player to resume after pause, the idle WebSocket disconnected and the run ended with \`GAME_BROWSER_DISCONNECTED\`; complete real acceptance for all four games has therefore not passed.
- The current production Worker already configures exact edge auto-response with Cloudflare Hibernation \`setWebSocketAutoResponse("ping", "pong")\`. This Pages release makes the browser send exact application-level text \`ping\` every eight seconds and ignore exact \`pong\`. Auto-response does not wake the Durable Object, read the game provider, perform an observation or action, change revision, or write relay storage; liveness must not be represented as observation.
- Production Worker remains \`377d494b-8f90-40ad-998f-863d209e1978\`. After live bytes for the exact Pages commit are verified, acceptance must bind this Worker/Pages pair and cover pairing, action, pause, player resume, confirmed close, and grant revocation for every game under \`games:play\` OAuth. Final availability promotion will create a new Worker; both video and game lifecycles must then be fully reaccepted against that new bundle before adding \`availableTransports\`.
- Kittens Game remains \`NO_AGENT\`; its WET PAWS LICENSE still requires explicit permission or legal confirmation.

## Video MCP phase one

The same \`377d494b-8f90-40ad-998f-863d209e1978\` bundle completed a production lifecycle for YouTube, Bilibili, and b23.tv external-link records: canonicalization, atomic publish, same-payload \`operationId\` replay, management readback, metadata refresh, \`expectedUpdatedAt\` CAS, \`confirm: true\` deletion, public absence readback, and RFC 7009 revocation all passed, and the temporary record was deleted. This evidence is exact-bundle only. Video \`availableTransports\` continues to omit \`remote-mcp\` until final availability promotion and acceptance of that final bundle.

This is still not real video-file upload. The remote MCP does not read local paths, Base64, raw bytes, or client files; true upload needs a separately accepted private R2 binary data plane.

## Quick Transfer governance boundary

This branch inherits the live Quick Transfer v1.0.10 from main. The heartbeat release does not change the registry or Quick Transfer governed paths and does not advance it again; its protocol, rooms, password handling, AES-GCM text, private R2, quotas, multipart, authorization, and 24-hour lifecycle are unchanged.

## Current release boundary

Production Worker remains \`377d494b-8f90-40ad-998f-863d209e1978\`. This release adds the Pages heartbeat asset; exact live bytes and real four-game acceptance still require verification against the Worker/Pages pair. No game or video candidate has been prematurely marked remote-available in the registry. Historical knowledge acceptance and the current video check cannot be reused across Worker bundles.`
      },
      ja: {
        title: "ゲーム MCP 保活修正候補と動画ライフサイクル検証",
        summary: "現在の本番所有者 Worker は 377d494b-8f90-40ad-998f-863d209e1978 です。この正確な bundle で外部動画管理のライフサイクルは合格しましたが、リモート可用性はまだ昇格していません。2048 の点検では停止後の待機中に WebSocket 切断が判明しました。今回の Pages 公開は8秒ごとの厳密な ping／pong 保活を追加し、Worker は既にエッジ自動応答を備えています。正確な本番バイトと4ゲームの完全検証は未完了で、Kittens Game と実動画アップロードは利用できません。",
        content_markdown: `# ゲーム MCP 保活修正候補と動画ライフサイクル検証

現在の本番所有者 Worker の正確な version ID は \`377d494b-8f90-40ad-998f-863d209e1978\` です。この bundle はゲーム／動画候補を含みます。動画の \`availableTransports\` はまだ \`remote-mcp\` を含まず、ゲームの \`availableTransports\` は空のままで、本記録は候補を外部利用可能とは記載しません。

## ブラウザーゲーム接続保活の修正

- 2048、Hextris、A Dark Room、Life Restart は、監査済みの意味操作ブリッジから有界な observation、現在の revision、不透明な \`actionId\` だけを返します。セレクター、スクリプト、生キー入力、座標、URL、DOM 命令、生の保存データは引き続き拒否します。
- 2048 の本番点検では1回限りのペアリング、意味操作、revision CAS、停止、旧トークン失効まで通過しましたが、停止後にプレイヤーの再開を待つ間にアイドル WebSocket が切れ、\`GAME_BROWSER_DISCONNECTED\` で終了しました。そのため4ゲームの実ブラウザー完全検証は未合格です。
- 現在の本番 Worker は Cloudflare Hibernation \`setWebSocketAutoResponse("ping", "pong")\` による厳密なエッジ自動応答を既に設定しています。今回の Pages 公開は、ブラウザーが8秒ごとに厳密なアプリケーション層テキスト \`ping\` を送り、厳密な \`pong\` を無視する処理を追加します。自動応答は Durable Object を起こさず、ゲーム provider を読まず、observation／action を実行せず、revision を変えず、中継ストレージにも書きません。保活を観察と表現してはいけません。
- 本番 Worker は \`377d494b-8f90-40ad-998f-863d209e1978\` のままです。正確な Pages commit の本番バイト確認後、この Worker／Pages の組み合わせに検証を固定し、\`games:play\` OAuth で4作品ごとにペアリング、操作、停止、プレイヤー再開、確認付き終了、grant 失効を完了する必要があります。最終可用性 promotion では新しい Worker が生じるため、その新 bundle で動画とゲームの両ライフサイクルを完全に再検証してから \`availableTransports\` を追加します。
- Kittens Game は \`NO_AGENT\` のままです。WET PAWS LICENSE について明示許可または法的確認が必要です。

## 動画 MCP 第1段階

同じ \`377d494b-8f90-40ad-998f-863d209e1978\` bundle で、YouTube／Bilibili／b23.tv 外部リンク記録の正規化、原子的公開、同一 payload の \`operationId\` 再生、管理読み取り、メタデータ更新、\`expectedUpdatedAt\` CAS、\`confirm: true\` 削除、公開側の消失確認、RFC 7009 失効が本番で合格し、一時記録も削除済みです。この証拠は正確な bundle にだけ有効です。最終可用性 promotion と最終 bundle の再検証までは、動画の \`availableTransports\` に \`remote-mcp\` を追加しません。

これは実動画ファイルのアップロードではありません。リモート MCP はローカルパス、Base64、生バイト、クライアントファイルを読まず、実アップロードには別途検証済みの非公開 R2 バイナリデータ面が必要です。

## Quick Transfer のガバナンス境界

このブランチは main で公開済みの Quick Transfer v1.0.10 を継承します。今回の保活公開は registry や Quick Transfer の管理対象パスを変更せず、再び版を上げません。プロトコル、部屋、合言葉、AES-GCM、非公開 R2、容量、Multipart、認可、24時間ライフサイクルは変わりません。

## 現在の公開境界

本番 Worker は \`377d494b-8f90-40ad-998f-863d209e1978\` のままです。今回の公開は Pages 心拍資産を追加しますが、正確な本番バイトと4ゲームの実検証は Worker／Pages の組み合わせで確認が必要です。ゲーム／動画候補を registry で先にリモート利用可能とはしていません。過去の知識ベース検証と現在の動画点検はいずれも別 Worker bundle に再利用できません。`
      }
    }, "2026-08-09T09:30:00.000Z"),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (
        'seed-update-2026-08-09-wallpaper-time-switch',
        '2026-08-09-wallpaper-time-switch',
        'site-updates',
        '["网站更新","壁纸","动效","无障碍","移动端"]',
        '', 'published', 0, 0,
        '2026-08-09T05:40:00.000Z',
        '2026-08-09T05:40:00.000Z',
        '2026-08-09T05:40:00.000Z'
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
    ...articleTranslationsStatements(env, "seed-update-2026-08-09-wallpaper-time-switch", {
      zh: {
        title: "四时段壁纸开关",
        summary: "网站右上角新增由生成素材组成的早上、中午、下午和晚上四段壁纸开关；它默认按本地时间自动切换，手动选择会保留到下一个真实时段边界，并用可中断的选择环移动与壁纸交叉淡化完成过渡。",
        content_markdown: `# 四时段壁纸开关

网站右上角现在有一个与桌面壁纸同步的四段开关，可直接选择早上、中午、下午和晚上。

## 自动时间与手动选择

- 默认继续使用设备本地时间：05:00、11:00、17:00 和 20:00 分别进入下一个壁纸时段。
- 手动选择会立即切换壁纸，并保留到下一个真实边界；到点后会自动回到对应的本地时段。
- 刷新和同浏览器标签会继续识别有效的手动选择，过期或被篡改的记录会被丢弃。

## 素材与动效

四幅时段插画和移动选择环都是生成的图像素材，CSS 只负责 44 像素触控分段和布局。选择环以强 ease-in-out 在四档之间移动，壁纸使用可快速重定向的交叉淡化。

## 键盘与减少动效

方向键、Home 和 End 可以操作四段单选组。键盘触发、reduced-motion 和站内关闭动效模式下不进行空间移动；移动端仅在 Home 右上角显示，不挤压账户与语言控件。`
      },
      en: {
        title: "Four-Stage Wallpaper Time Switch",
        summary: "A generated-art four-stage wallpaper switch now sits at the site's upper right for morning, noon, afternoon, and night. It follows local time by default; a manual choice lasts until the next real schedule boundary, with an interruptible moving lens and wallpaper crossfade.",
        content_markdown: `# Four-Stage Wallpaper Time Switch

The site's upper-right corner now contains a four-stage control synchronized with the desktop wallpaper: morning, noon, afternoon, and night.

## Automatic time and manual choice

- The default remains device-local time, with the next wallpaper period beginning at 05:00, 11:00, 17:00, and 20:00.
- A manual selection changes the wallpaper immediately and remains active only until the next real boundary, when local-time automation resumes.
- Refreshes and sibling browser tabs recognize a valid choice; expired or tampered records are discarded.

## Artwork and motion

The four period illustrations and moving lens are generated image assets. CSS only supplies the four 44-pixel hit areas and layout. The shared lens moves between positions with a strong ease-in-out curve, while the wallpaper uses a rapidly retargetable crossfade.

## Keyboard and reduced motion

Arrow keys, Home, and End operate the four-radio group. Keyboard activation, reduced motion, and the site's motion-off mode commit without spatial travel. On mobile the control appears only at Home's upper right, outside the crowded account and language row.`
      },
      ja: {
        title: "4段階の壁紙時間スイッチ",
        summary: "サイト右上に、生成素材で作った朝・昼・夕方・夜の4段階壁紙スイッチを追加しました。通常はローカル時刻に従い、手動選択は次の実際の時間境界まで維持され、中断可能なレンズ移動と壁紙のクロスフェードで切り替わります。",
        content_markdown: `# 4段階の壁紙時間スイッチ

サイト右上に、デスクトップ壁紙と同期する朝・昼・夕方・夜の4段階コントロールを追加しました。

## 自動時刻と手動選択

- 通常はデバイスのローカル時刻を使い、05:00、11:00、17:00、20:00 に次の壁紙時間帯へ進みます。
- 手動選択はすぐに反映され、次の実際の境界までだけ維持された後、ローカル時刻の自動モードに戻ります。
- 再読み込みや同じブラウザの別タブでも有効な選択を引き継ぎ、期限切れや改ざんされた記録は破棄します。

## 素材とモーション

4つの時間帯イラストと移動レンズは生成画像素材です。CSS は44ピクセルの操作領域と配置だけを担当します。共通レンズは強い ease-in-out で移動し、壁紙は途中からでも素早く向きを変えられるクロスフェードを使います。

## キーボードとモーション低減

矢印キー、Home、End で4段階のラジオグループを操作できます。キーボード操作、モーション低減、サイトのモーションオフでは空間移動を行いません。モバイルでは Home の右上だけに表示し、アカウントと言語操作を圧迫しません。`
      }
    }, "2026-08-09T05:40:00.000Z"),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (
        'seed-update-2026-08-09-motion-polish',
        '2026-08-09-motion-polish',
        'site-updates',
        '["网站更新","界面","动效","移动端","无障碍"]',
        '', 'published', 0, 0,
        '2026-08-09T02:50:00.000Z',
        '2026-08-09T02:50:00.000Z',
        '2026-08-09T02:50:00.000Z'
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
    ...articleTranslationsStatements(env, "seed-update-2026-08-09-motion-polish", {
      zh: {
        title: "主站动效与移动交互精修",
        summary: "主站弹层、窗口切换与移动 Dock 采用更快且可中断的动效；知识库骨架屏、阅读进度和聊天室未读提示改用低成本合成路径，键盘操作即时完成，reduced-motion 保留必要的淡入与颜色反馈。",
        content_markdown: `# 主站动效与移动交互精修

这次更新按照清晰、快速、可打断的原则统一整理公开主站的交互反馈，不改变路由、内容结构或数据接口。

## 弹层与窗口

- 账户弹层以及视频、欢迎窗口改为从当前画面继续的可中断过渡；关闭途中再次打开时会从当前帧反向衔接。
- 账户弹层从右上触发点展开，桌面窗口保持居中，移动窗口从底部进入。
- 键盘触发的打开、关闭、切换和 Escape 操作立即完成，不等待动画。

## 移动与内容反馈

- 移动 Dock 的选中底板固定为 48 像素，只更新自身 transform 和 opacity；折叠把手也不再改变宽度。
- Knowledge 骨架屏从多节点背景扫描改为每张卡片一层合成扫光；低性能与减弱动效模式保持静态。
- 阅读进度直接跟随滚动，不再拖尾；聊天室未读提示只在首次出现时做一次可中断的短入场，计数变化不会重播。

## 辅助功能

reduced-motion 移除位移，只保留短暂的透明度和颜色提示；站内“关闭动效”仍会完全停止动画与平滑滚动。所有界面动效都控制在 300 毫秒以内。`
      },
      en: {
        title: "Public-Site Motion and Mobile Interaction Polish",
        summary: "Public popovers, window changes, and the mobile Dock now use faster, interruptible motion. Knowledge skeletons, reading progress, and chat unread feedback use cheaper compositor paths, while keyboard actions complete instantly and reduced motion keeps only helpful fades and color cues.",
        content_markdown: `# Public-Site Motion and Mobile Interaction Polish

This update unifies public-site feedback around motion that is clear, fast, and interruptible without changing routes, content structure, or data APIs.

## Popovers and windows

- The account popover, video window, and welcome window now retarget from their current visual state, so reversing a close does not restart from zero.
- The account popover grows from its top-right trigger, desktop windows remain centered, and mobile sheets enter from the bottom.
- Keyboard-initiated opening, closing, switching, and Escape actions complete immediately.

## Mobile and content feedback

- The mobile Dock uses a fixed 48-pixel selection surface and updates only its own transform and opacity; the collapse handle no longer changes width.
- Knowledge skeletons replace many background scans with one compositor sweep per card and stay static on low-performance or reduced-motion devices.
- Reading progress follows scrolling without a delayed trail. The chat unread notice uses one short, interruptible entrance and does not replay when only its count changes.

## Accessibility

Reduced motion removes spatial travel while retaining short opacity and color cues. The site's motion-off setting still disables animation and smooth scrolling completely. Every UI transition remains below 300 milliseconds.`
      },
      ja: {
        title: "公開サイトのモーションとモバイル操作を改善",
        summary: "公開サイトのポップオーバー、ウィンドウ切り替え、モバイル Dock をより速く中断可能な動きに調整しました。Knowledge のスケルトン、読書進捗、Chat の未読表示は軽量な合成処理を使い、キーボード操作は即時、視差軽減時は必要なフェードと色だけを残します。",
        content_markdown: `# 公開サイトのモーションとモバイル操作を改善

今回の更新では、ルート、コンテンツ構造、データ API を変えずに、公開サイトの反応を明確・高速・中断可能な動きへ統一しました。

## ポップオーバーとウィンドウ

- アカウント表示、動画ウィンドウ、ウェルカム画面は現在の見た目から再接続するため、閉じる途中で開き直しても最初からやり直しません。
- アカウント表示は右上の起点から、デスクトップのウィンドウは中央から、モバイルのシートは下端から動きます。
- キーボードによる開閉、切り替え、Escape 操作はアニメーションを待たず即時に完了します。

## モバイルとコンテンツの反応

- モバイル Dock の選択面を 48 ピクセルに固定し、要素自身の transform と opacity だけを更新します。折りたたみハンドルも幅を変更しません。
- Knowledge のスケルトンは多数の背景走査をやめ、カードごとに一つの合成レイヤーだけを動かします。低性能端末と視差軽減時は静止します。
- 読書進捗はスクロールへ遅れず追従します。Chat の未読表示は初回だけ短く中断可能に入り、件数だけの更新では再生しません。

## アクセシビリティ

視差軽減時は移動を外し、短い透明度と色の変化だけを残します。サイト内のモーション無効設定では、アニメーションとスムーズスクロールを完全に停止します。すべての UI 遷移は 300 ミリ秒未満です。`
      }
    }, "2026-08-09T02:50:00.000Z"),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (
        'seed-update-2026-08-07-remote-mcp-oauth',
        '2026-08-07-remote-mcp-oauth',
        'site-updates',
        '["网站更新","AI 能力","知识库","MCP","安全"]',
        '', 'published', 0, 0,
        '2026-08-07T10:10:00.000Z',
        '2026-08-09T01:00:00.000Z',
        '2026-08-09T01:00:00.000Z'
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
    ...articleTranslationsStatements(env, "seed-update-2026-08-07-remote-mcp-oauth", {
      zh: {
        title: "远程 MCP OAuth 与知识库原子工具完成生产验收",
        summary: "正式域名端到端生产验收已通过：OAuth Allow 后精确发现 9 项工具与 4 项公开能力，并完成原子发布、同载荷重放、管理读取、CAS 更新、三语公开回读、确认删除、删除后 404、令牌撤销和临时数据清理；文件发布仍仅限本地，全站工具及游戏远程接管尚未完成。",
        content_markdown: `# 远程 MCP OAuth 与知识库原子工具完成生产验收

站长远程 MCP 已在正式域名完成端到端生产验收，并继续复用经过验证的文章服务边界。

## 已完成的生产验收

- 登录站长账号后的 OAuth Allow 成功回到本地 AI 客户端，authorization code、PKCE S256、精确 resource 与最小 scope 全部生效。
- MCP \`tools/list\` 精确返回 9 项工具：\`site_capabilities\`、\`article_list\`、\`article_search\`、\`article_get\`、\`article_manage_list\`、\`article_manage_get\`、\`article_publish\`、\`article_update\`、\`article_delete\`；公开能力清单精确为 4 项。
- \`article_publish\` 完成一次原子发布，并用相同 operationId 与相同规范载荷安全重放；随后通过 \`article_manage_list\` 与 \`article_manage_get\` 读回管理数据。
- \`article_update\` 通过 \`expectedUpdatedAt\` CAS 更新，公开接口以 zh／en／ja 三种语言逐一读回更新后的正文。
- \`article_delete\` 使用 CAS 和显式 \`confirm: true\` 完成删除，三语公开接口随后均返回 404。
- 验收结束后撤销授权，并清理临时客户端、grant、测试文章及收据，没有保留测试数据。

## 安全边界与后续范围

\`content:read\`、\`content:write\` 与 \`content:delete\` 继续分开授权；每次管理调用都会复核 grant、scope 与账号当前管理员角色。\`article_publish_files\` 仍仅属于本地 stdio MCP 的 allow-root 工具，不进入远程 MCP，也不会把本机路径发送到网站。当前远程入口已经覆盖公开内容读取与站长知识库原子管理，但全站其余工具和游戏的远程接管尚未完成，不能据此宣称 AI 已能接管整个网站或全部游戏。`
      },
      en: {
        title: "Remote MCP OAuth and Atomic Knowledge Tools Pass Production Acceptance",
        summary: "End-to-end production acceptance on the live domain has passed: OAuth Allow exposed exactly 9 tools and 4 public capabilities, followed by atomic publish, same-payload replay, management reads, CAS update, zh/en/ja public readback, confirmed delete, post-delete 404, token revocation, and temporary-data cleanup. File publishing remains local, while whole-site tool and game takeover is not complete.",
        content_markdown: `# Remote MCP OAuth and Atomic Knowledge Tools Pass Production Acceptance

The owner remote MCP has completed end-to-end acceptance on the live domain while continuing to reuse the verified article-service boundaries.

## Completed production acceptance

- OAuth Allow after owner sign-in returned successfully to the local AI client, with authorization code, PKCE S256, exact resource, and minimum scopes enforced.
- MCP \`tools/list\` returned exactly 9 tools: \`site_capabilities\`, \`article_list\`, \`article_search\`, \`article_get\`, \`article_manage_list\`, \`article_manage_get\`, \`article_publish\`, \`article_update\`, and \`article_delete\`; the public capability list contained exactly 4 entries.
- \`article_publish\` completed one atomic publication and safely replayed the same canonical payload under the same operationId; \`article_manage_list\` and \`article_manage_get\` then read back the management data.
- \`article_update\` passed its \`expectedUpdatedAt\` CAS update, and the public API read the updated body back in zh, en, and ja.
- \`article_delete\` completed with CAS and explicit \`confirm: true\`; every zh/en/ja public read then returned 404.
- The grant was revoked after acceptance, and the temporary client, grant, test article, and receipts were cleaned without retaining test data.

## Security boundary and remaining scope

\`content:read\`, \`content:write\`, and \`content:delete\` remain separately authorized. Every management call rechecks the grant, scopes, and current administrator role. \`article_publish_files\` remains a local stdio MCP allow-root tool; it is not exposed remotely, and local paths are never sent to the site. The remote endpoint now covers public content reads and atomic owner knowledge management, but remote takeover of the remaining site tools and games is not complete, so this release does not claim that AI can control the whole site or every game.`
      },
      ja: {
        title: "リモート MCP OAuth と知識ベース原子ツールの本番検証完了",
        summary: "本番ドメインのエンドツーエンド検証が完了しました。OAuth Allow 後に9ツールと4つの公開機能を正確に確認し、原子的公開、同一ペイロード再実行、管理一覧・取得、CAS 更新、zh／en／ja 公開再取得、確認付き削除、削除後404、トークン失効、一時データ消去まで合格しています。ファイル公開はローカル限定で、サイト全体のツールやゲームの遠隔操作は未完成です。",
        content_markdown: `# リモート MCP OAuth と知識ベース原子ツールの本番検証完了

サイト所有者向けリモート MCP は、検証済みの記事サービス境界を共有したまま、本番ドメインでエンドツーエンド検証を完了しました。

## 完了した本番検証

- 所有者ログイン後の OAuth Allow はローカル AI クライアントへ正常に戻り、authorization code、PKCE S256、正確な resource、最小 scope がすべて適用されました。
- MCP \`tools/list\` は \`site_capabilities\`、\`article_list\`、\`article_search\`、\`article_get\`、\`article_manage_list\`、\`article_manage_get\`、\`article_publish\`、\`article_update\`、\`article_delete\` の9ツールを正確に返し、公開機能一覧は4項目でした。
- \`article_publish\` で原子的公開を行い、同じ operationId と同じ正規化ペイロードを安全に再実行した後、\`article_manage_list\` と \`article_manage_get\` で管理データを再取得しました。
- \`article_update\` は \`expectedUpdatedAt\` CAS 更新に合格し、公開 API から zh／en／ja の更新本文をそれぞれ再取得しました。
- \`article_delete\` は CAS と明示的な \`confirm: true\` で削除を完了し、その後の zh／en／ja 公開取得はすべて404を返しました。
- 検証後に認可を失効させ、一時クライアント、grant、テスト記事、レシートを消去し、テストデータを残していません。

## セキュリティ境界と今後の範囲

\`content:read\`、\`content:write\`、\`content:delete\` は個別認可を維持し、管理呼び出しごとに grant、scope、現在の管理者権限を再確認します。\`article_publish_files\` はローカル stdio MCP の allow-root ツールに限定され、リモート MCP には公開せず、ローカルパスもサイトへ送信しません。現在のリモート入口は公開コンテンツ取得と所有者向け知識ベース原子管理を提供しますが、サイト内の残りのツールやゲームの遠隔操作は未完成であり、AI がサイト全体や全ゲームを操作できるとは宣言しません。`
      }
    }, "2026-08-09T01:00:00.000Z"),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (
        'seed-update-2026-08-07-life-restart-agent',
        '2026-08-07-life-restart-agent',
        'site-updates',
        '["网站更新","AI 能力","知识库","原子发布","MCP","CLI","人生重开模拟器","安全"]',
        '', 'published', 0, 0,
        '2026-08-07T08:00:00.000Z',
        '2026-08-07T08:00:00.000Z',
        '2026-08-07T08:00:00.000Z'
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
    ...articleTranslationsStatements(env, "seed-update-2026-08-07-life-restart-agent", {
      zh: {
        title: "知识库原子发布 MCP 与人生重开语义会话上线",
        summary: "本地 stdio MCP 现已支持三语知识库文章的原子发布、Markdown 文件发布、CAS 更新和确认删除，并继续提供可复现的人生重开游戏会话；写入仅接受管理员批准的独立 scope。",
        content_markdown: `# 知识库原子发布 MCP 与人生重开语义会话上线

AI 能力层第七阶段优先补齐本地 stdio MCP 的知识库管理，同时把人生重开模拟器接入通用 \`lusu game\` 会话。

## 知识库原子发布

- \`article_publish\` 在一次原子操作中写入文章元数据、zh／en／ja 三语正文、审计事件和幂等收据；任何一步失败都不会留下半发布文章。
- \`article_publish_files\` 只读取 MCP 配置的 allow-root 内真实、非符号链接、有效 UTF-8 的 Markdown 文件，本地绝对路径不会发送到站点 API。
- \`article_update\` 要求 \`expectedUpdatedAt\` CAS；\`article_delete\` 同样要求 CAS，并且必须显式提交 \`confirm: true\`。写入和删除分别需要管理员单独批准的 \`content:write\` 与 \`content:delete\` scope。
- 通用文章工具会拒绝受保护分类 \`site-updates\`、\`daily-ai-news\` 与 \`tool-radar\`，不能绕过公开更新和专用自动投递规则。

## 人生重开语义会话

AI 可以在隔离会话里选择三项天赋、分配颜值／智力／体质／家境、逐岁推进，并在终局选择可继承天赋后开启下一轮。版本化随机状态、revision CAS 和 clientActionId 让同一初始状态与动作序列可复现且可安全重试；输入只接受这些结构化语义动作，不接受选择器、脚本、URL、任意按键或原始存档。第一版仅支持 Custom 模式和已固定哈希的中文剧情数据。

## 当前边界

知识库写入只在本地 CLI／stdio MCP 与受管理员授权的站点 API 中提供。独立的远程 MCP Worker 仍未部署，也不包含这些写工具。人生重开会话与浏览器页面和云存档分离，\`browserBridge\` 与 \`browserPairing\` 均为 false，不会观看或接管已打开的游戏。`
      },
      en: {
        title: "Atomic Knowledge Publishing MCP and Life Restart Sessions",
        summary: "The local stdio MCP now atomically publishes trilingual knowledge articles, publishes Markdown files, performs CAS updates and confirmed deletes, and also runs reproducible Life Restart sessions. Writes require separately administrator-approved scopes.",
        content_markdown: `# Atomic Knowledge Publishing MCP and Life Restart Sessions

Phase seven of the AI capability layer prioritizes knowledge-base management in the local stdio MCP while integrating Life Restart with shared \`lusu game\` sessions.

## Atomic knowledge publishing

- \`article_publish\` writes article metadata, zh/en/ja bodies, an audit event, and an idempotency receipt in one atomic operation. If any step fails, no partially published article remains.
- \`article_publish_files\` reads only real, non-symlink, valid UTF-8 Markdown files beneath an MCP-configured allow-root. Local absolute paths are never sent to the site API.
- \`article_update\` requires \`expectedUpdatedAt\` CAS. \`article_delete\` also requires CAS and an explicit \`confirm: true\`. Writes and deletes require the separately administrator-approved \`content:write\` and \`content:delete\` scopes.
- General article tools reject the protected \`site-updates\`, \`daily-ai-news\`, and \`tool-radar\` categories, so they cannot bypass public-update or dedicated delivery rules.

## Life Restart semantic sessions

In an isolated session, an AI can select three talents, allocate charm, intelligence, strength, and money points, advance one year at a time, and start another life with an eligible inherited talent. Versioned random state, revision CAS, and clientActionId make the same initial state and action sequence reproducible and safely retryable. Inputs accept only those structured semantic actions, never selectors, scripts, URLs, arbitrary keys, or raw saves. Version one supports Custom mode and the pinned-hash Chinese story dataset.

## Current boundary

Knowledge writes are available only through the local CLI/stdio MCP and the administrator-authorized site API. The separate remote MCP Worker remains undeployed and does not expose these write tools. Life Restart sessions remain isolated from the browser page and cloud saves; both \`browserBridge\` and \`browserPairing\` are false, so they do not watch or take over an open game.`
      },
      ja: {
        title: "知識ベース原子公開 MCP と Life Restart セッションを追加",
        summary: "ローカル stdio MCP で、3言語の知識記事の原子的公開、Markdown ファイル公開、CAS 更新、確認付き削除に対応し、再現可能な Life Restart セッションも利用できます。書き込みには管理者が別途承認した scope が必要です。",
        content_markdown: `# 知識ベース原子公開 MCP と Life Restart セッションを追加

AI 機能レイヤー第7段階では、ローカル stdio MCP の知識ベース管理を優先して追加し、Life Restart を共通の \`lusu game\` セッションへ統合しました。

## 知識ベースの原子公開

- \`article_publish\` は、記事メタデータ、zh／en／ja の3言語本文、監査イベント、冪等レシートを1回の原子操作で書き込みます。途中で失敗しても半公開の記事は残りません。
- \`article_publish_files\` は MCP で設定した allow-root 配下にある、実体ファイルかつシンボリックリンクでない有効な UTF-8 Markdown だけを読み取ります。ローカル絶対パスはサイト API へ送信しません。
- \`article_update\` には \`expectedUpdatedAt\` CAS が必要です。\`article_delete\` にも CAS と明示的な \`confirm: true\` が必要です。書き込みと削除には、管理者が個別に承認した \`content:write\` と \`content:delete\` scope を使用します。
- 汎用記事ツールは保護対象の \`site-updates\`、\`daily-ai-news\`、\`tool-radar\` を拒否し、公開更新や専用自動配信の規則を迂回できません。

## Life Restart の意味操作セッション

分離セッション内で、3つの天賦を選択し、魅力・知力・体力・家境へポイントを配分し、1年ずつ進め、終局後に継承可能な天賦で次の人生を開始できます。版管理された乱数状態、revision CAS、clientActionId により、同じ初期状態と操作列を再現して安全に再試行できます。入力はこれらの構造化された意味操作だけを受け付け、セレクター、スクリプト、URL、任意キー、生のセーブデータは拒否します。初版は Custom モードと、ハッシュを固定した中国語物語データに対応します。

## 現在の境界

知識ベースへの書き込みは、ローカル CLI／stdio MCP と管理者が承認したサイト API だけで利用できます。独立したリモート MCP Worker は未展開で、これらの書き込みツールも公開していません。Life Restart セッションはブラウザーページやクラウドセーブから分離され、\`browserBridge\` と \`browserPairing\` はともに false のため、開いているゲームを監視・操作しません。`
      }
    }, "2026-08-07T08:00:00.000Z"),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (
        'seed-update-2026-08-07-hextris-agent',
        '2026-08-07-hextris-agent',
        'site-updates',
        '["网站更新","AI 能力","Hextris","游戏","CLI","MCP","开源许可"]',
        '', 'published', 0, 0,
        '2026-08-07T00:30:00.000Z',
        '2026-08-07T00:30:00.000Z',
        '2026-08-07T00:30:00.000Z'
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
    ...articleTranslationsStatements(env, "seed-update-2026-08-07-hextris-agent", {
      zh: {
        title: "Hextris 现在支持独立 AI 游戏会话",
        summary: "新增确定性的 Hextris 隔离会话、专用 CLI 与 stdio MCP，并补全 GPL 分发说明；它以独立进程运行，不接管已打开的浏览器，也不静态并入通用 CLI／MCP。",
        content_markdown: `# Hextris 现在支持独立 AI 游戏会话

AI 能力层第六阶段为 Hextris 增加了第二套可玩的语义游戏能力。AI 可以创建隔离会话、观察六条色块轨道和下一块颜色、查看合法动作，并按目标轨道放置色块。

## 确定性与安全边界

- 引擎使用版本化状态和确定性随机数；同一 seed 与动作序列会得到相同结果。
- 每次操作都检查 revision 与 clientActionId，相同请求可安全重试，换载荷复用 ID 会被拒绝。
- 本地状态有会话数、大小和空闲期限上限，并使用带所有权校验的锁与原子替换；只读观察不会偷偷续期或写盘。
- 重置与关闭都要求明确确认，动作只接受 0–5 的目标轨道，不接受选择器、脚本、按键或任意页面调用。

## 独立 GPL 进程

Hextris 专用引擎、CLI 与 stdio MCP 作为自包含的 GPL-3.0-or-later 进程运行，不 import 通用站点 CLI、通用 MCP 或游戏会话存储。浏览器版的完整 GPL 文本、上游署名、修改日期和本地源码说明也已补齐；现有 2048 同步恢复完整 MIT 许可与来源说明。

## 当前范围

这是独立本地模拟会话，不会观看或接管已经打开的 Hextris 标签页，也不连接云存档或未部署的远程 MCP。2048 继续使用原有通用 \`lusu game\`／本地 MCP 入口；Hextris 使用自己单独的 CLI 与 MCP 进程。`
      },
      en: {
        title: "Hextris Now Supports a Dedicated AI Game Session",
        summary: "Adds deterministic isolated Hextris sessions, a dedicated CLI and stdio MCP, plus complete GPL distribution notices. It runs as a separate process, does not take over an open browser, and is not statically linked into the general CLI or MCP.",
        content_markdown: `# Hextris Now Supports a Dedicated AI Game Session

Phase six of the AI capability layer adds a second playable semantic game surface for Hextris. An AI can create an isolated session, observe six color lanes and the incoming piece, list legal actions, and place the piece into a selected lane.

## Determinism and safety boundaries

- The engine uses versioned state and deterministic randomness, so the same seed and action sequence produce the same result.
- Every mutation checks a revision and clientActionId. Exact retries are safe, while reusing an ID for different input is rejected.
- Local state has session-count, size, and idle-lifetime limits, plus ownership-checked locks and atomic replacement. Read-only observation does not silently extend the session or write to disk.
- Reset and close both require explicit confirmation. Actions accept only destination lanes 0–5, never selectors, scripts, raw keys, or arbitrary page calls.

## Separate GPL process

The Hextris-specific engine, CLI, and stdio MCP run as a self-contained GPL-3.0-or-later process. They do not import the general site CLI, general MCP, or shared game session store. The browser game now also ships the full GPL text, upstream attribution, modification dates, and source notice. The existing 2048 distribution restores its complete MIT license and provenance notice as well.

## Current scope

This is an isolated local simulation. It does not watch or take over an already-open Hextris tab, connect to cloud saves, or extend the undeployed remote MCP. 2048 continues to use the integrated \`lusu game\` and local MCP tools, while Hextris uses its dedicated CLI and MCP process.`
      },
      ja: {
        title: "Hextris が独立 AI ゲームセッションに対応",
        summary: "決定論的な Hextris 分離セッション、専用 CLI／stdio MCP、GPL 配布表示を追加しました。独立プロセスとして動作し、開いているブラウザーを操作せず、共通 CLI／MCP に静的統合もしません。",
        content_markdown: `# Hextris が独立 AI ゲームセッションに対応

AI 機能レイヤー第6段階として、Hextris に2つ目のプレイ可能な意味操作ゲーム面を追加しました。AI は分離セッションを作成し、6本の色レーンと次のピースを観察し、許可された操作を確認して配置先レーンを選べます。

## 決定性と安全境界

- エンジンは版管理された状態と決定論的乱数を使い、同じ seed と操作列から同じ結果を生成します。
- 各更新は revision と clientActionId を検査します。同一要求は安全に再試行でき、異なる入力で同じ ID を使うと拒否されます。
- ローカル状態にはセッション数、サイズ、アイドル期限の上限があり、所有権を確認するロックと原子的置換を使います。読み取りだけでは期限延長や書き込みを行いません。
- リセットと終了には明示確認が必要です。操作は 0–5 の配置先レーンだけを受け付け、セレクター、スクリプト、生キー、任意のページ操作は受け付けません。

## 独立した GPL プロセス

Hextris 専用エンジン、CLI、stdio MCP は自己完結した GPL-3.0-or-later プロセスとして動作し、共通サイト CLI、共通 MCP、共有ゲームセッションストアを import しません。ブラウザー版にも GPL 全文、上流の帰属、変更日、ソース案内を追加しました。既存 2048 にも完全な MIT ライセンスと由来表示を復元しています。

## 現在の範囲

これは分離されたローカルシミュレーションです。開いている Hextris タブの監視・操作、クラウドセーブ、未展開のリモート MCP には接続しません。2048 は従来の共通 \`lusu game\`／ローカル MCP を使い、Hextris は専用 CLI と MCP プロセスを使います。`
      }
    }, "2026-08-07T00:30:00.000Z"),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (
        'seed-update-2026-08-06-whiteboard-agent-images',
        '2026-08-06-whiteboard-agent-images',
        'site-updates',
        '["网站更新","AI 能力","在线画板","图片","CLI","MCP","安全"]',
        '', 'published', 0, 0,
        '2026-08-06T13:20:00.000Z',
        '2026-08-06T15:53:00.000Z',
        '2026-08-06T13:20:00.000Z'
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
    ...articleTranslationsStatements(env, "seed-update-2026-08-06-whiteboard-agent-images", {
      zh: {
        title: "AI 现在可以给在线画板添加图片",
        summary: "本地 CLI／stdio MCP 可上传、下载并在当前房追加真实图片；生产热修已让精确图片上传与 Yjs 场景更新进入完整 Agent 鉴权，其他来源、路径、方法与 MIME 继续拒绝，远程 MCP 仍未部署。",
        content_markdown: `# AI 现在可以给在线画板添加图片

AI 能力层第五阶段补齐了在线画板的真实图片闭环。本地 CLI 与 stdio MCP 现在可以上传、下载当前房图片，并用高层 \`image\` 元素把已验证资源追加到画布。

## 图片能力

- 只接受最大 5 MiB、严格容器边界、关键块段、声明宽高和像素数均通过校验的 PNG、JPEG 与 WebP；这项检查不宣称完整像素解码。
- 上传使用 operation ID 与图片 SHA-256 幂等；相同字节可安全重试，不同字节复用同一 ID 会冲突。
- 下载默认不覆盖已有文件；stdio MCP 还会校验 allow-root、真实路径和常规文件，工具输出不回显本机路径或内部房间标识。

## 权限与房间隔离

\`whiteboard:assets\` 是独立且默认不授予的权限。上传要求它与 \`whiteboard:write\` 同时存在；下载原图要求它加场景 read（write 可满足 read）。Agent Bearer 之外仍必须使用绑定当前 tokenId 的房间令牌，图片只可在当前房的私有 R2 空间读写，不能跨房引用。

## 继续保持只追加

服务端只接受已经完成存储、元数据逐字段一致的当前房图片。普通 write-only 调用、pending 资源、URL、Base64、SVG、HTML、伪造元数据、孤立资源、既有元素或资源的改删、链接、绑定和任意 Yjs 注入都会被拒绝。同一规范资源可以被多次放置；简化 SVG／PNG Agent 导出仍不嵌入图片并会明确告警。

## 生产入口点检修复

首次生产点检发现 Pages 全局 mutation gate 漏列 Agent 图片上传路径，使安全 raster 请求在 Bearer 鉴权前返回 415。1.0.6 仅把精确 \`POST /api/whiteboard/agent/assets\` 的 PNG／JPEG／WebP 交给完整 Agent 鉴权。

随后授权线上闭环发现同一门禁还漏列 Agent 场景更新使用的 Yjs 媒体类型。1.0.7 只让精确 \`POST /api/whiteboard/agent/scene\` 且 \`Content-Type: application/vnd.yjs-update\` 的请求跳过 JSON 门禁；同源检查仍先执行，之后继续进入既有 Agent Bearer、write scope、tokenId 绑定房间令牌、operation ID、正文上限和只追加场景校验。与 raster 特例相同，跨源、相邻路径、非 POST 与其他 MIME 继续失败关闭。

在线画板版本更新为 1.0.7。Quick Transfer 保持 1.0.6，互传协议没有变化。独立远程 MCP Worker 仍未部署。`
      },
      en: {
        title: "AI Can Now Add Images to the Online Whiteboard",
        summary: "The local CLI and stdio MCP can upload, download, and append real images in the current room. Production fixes now pass only exact image uploads and Yjs scene updates into full Agent authorization; other origins, paths, methods, and MIME types remain rejected, and remote MCP remains undeployed.",
        content_markdown: `# AI Can Now Add Images to the Online Whiteboard

Phase five of the AI capability layer completes a real-image loop for Online Whiteboard. The local CLI and stdio MCP can upload and download current-room images, then append a verified asset through a high-level \`image\` element.

## Image operations

- Inputs are limited to PNG, JPEG, or WebP files up to 5 MiB whose container boundaries, critical chunks or segments, declared dimensions, and pixel limits pass strict checks; this does not claim full pixel decoding.
- Uploads use an operation ID plus the image SHA-256 for idempotency. Identical bytes can be retried safely; reusing the ID for different bytes conflicts.
- Downloads never overwrite an existing file by default. The stdio MCP also enforces allow-root, real-path, and regular-file checks, while tool output omits local paths and internal room identifiers.

## Authorization and room isolation

\`whiteboard:assets\` is a separate, non-default permission. Upload requires it together with \`whiteboard:write\`; raw image download requires it plus scene read, which write already satisfies. A token-bound room credential is still required in addition to the Agent Bearer. Images remain in the current room's private R2 namespace and cannot be referenced across rooms.

## Still append-only

The server accepts only current-room images whose storage commit is complete and whose metadata matches field by field. A write-only caller, pending asset, URL, Base64 data, SVG, HTML, forged metadata, orphan asset record, modification or deletion of existing data, link, binding, or arbitrary Yjs input is rejected. One canonical asset may be placed more than once. Simplified Agent SVG and PNG exports still omit image bytes and report a warning.

## Production entry-point fix

Initial production checks found that the Pages mutation gate omitted the Agent image-upload path, causing safe raster requests to return 415 before Bearer authorization. Version 1.0.6 passes only exact \`POST /api/whiteboard/agent/assets\` PNG, JPEG, and WebP requests into full Agent authorization.

The subsequent authorized production loop found that the same gate also omitted the Yjs media type used by Agent scene updates. Version 1.0.7 skips the JSON gate only for exact \`POST /api/whiteboard/agent/scene\` requests with \`Content-Type: application/vnd.yjs-update\`. Same-origin validation still runs first, followed by the existing Agent Bearer, write scope, token-bound room credential, operation ID, body limit, and append-only scene checks. As with the raster exception, cross-origin requests, adjacent paths, non-POST methods, and other MIME types remain fail-closed.

Online Whiteboard is now version 1.0.7. Quick Transfer remains 1.0.6 with no transfer-protocol change. The separate remote MCP Worker remains undeployed.`
      },
      ja: {
        title: "AI がオンラインホワイトボードに画像を追加可能に",
        summary: "ローカル CLI／stdio MCP から現在のルームへ実画像をアップロード・取得・追記できます。本番修正により正確な画像アップロードと Yjs シーン更新だけが完全な Agent 認可へ進み、他の送信元・パス・メソッド・MIME は拒否されます。リモート MCP は未展開です。",
        content_markdown: `# AI がオンラインホワイトボードに画像を追加可能に

AI 機能レイヤー第5段階として、オンラインホワイトボードの実画像フローを完成させました。ローカル CLI と stdio MCP から現在のルームの画像をアップロード・取得し、高レベルの \`image\` 要素として検証済み素材を追記できます。

## 画像操作

- 最大 5 MiB の PNG、JPEG、WebP のみを受け付け、コンテナ境界、主要チャンク／セグメント、宣言寸法、総画素数を厳格に検証します。これは全画素の完全デコードを保証するものではありません。
- アップロードは operation ID と画像 SHA-256 で冪等化します。同じバイト列は安全に再試行でき、異なる内容で同じ ID を使うと競合になります。
- ダウンロードは既存ファイルを既定で上書きしません。stdio MCP は allow-root、実パス、通常ファイルも確認し、ツール出力にはローカルパスや内部ルーム識別子を含めません。

## 権限とルーム分離

\`whiteboard:assets\` は既定では付与されない独立権限です。アップロードには \`whiteboard:write\` との両方が必要で、原画像の取得には assets とシーン read（write は read を満たす）が必要です。Agent Bearer に加えて現在の tokenId に結び付いたルーム資格情報も必要です。画像は現在のルーム専用の非公開 R2 名前空間に保存され、別ルームから参照できません。

## 追記専用を維持

サーバーは保存完了済みで、全メタデータが一致する現在ルームの画像だけを受け付けます。通常の write-only 呼び出し、pending 素材、URL、Base64、SVG、HTML、偽造メタデータ、孤立した素材記録、既存要素や素材の変更・削除、リンク、バインディング、任意 Yjs 入力は拒否します。同じ正規素材は複数回配置できます。簡易 Agent SVG／PNG 書き出しは引き続き画像バイトを埋め込まず、警告を返します。

## 本番入口の点検修正

最初の本番点検で Pages の mutation gate に Agent 画像アップロードパスが含まれず、安全な raster 要求が Bearer 認可前に 415 となることを確認しました。1.0.6 では正確な \`POST /api/whiteboard/agent/assets\` の PNG／JPEG／WebP だけを完全な Agent 認可へ渡します。

その後の認可済み本番ループで、同じ gate が Agent シーン更新に使う Yjs メディアタイプも除外していたことが分かりました。1.0.7 では、正確な \`POST /api/whiteboard/agent/scene\` かつ \`Content-Type: application/vnd.yjs-update\` の要求だけが JSON gate を通過します。同一オリジン検証は先に実行され、その後も既存の Agent Bearer、write scope、tokenId に結び付くルーム資格情報、operation ID、本文上限、追記専用シーン検証をすべて行います。raster 例外と同様、クロスオリジン、隣接パス、POST 以外、他の MIME は fail-closed のままです。

オンラインホワイトボードは 1.0.7 になりました。Quick Transfer は 1.0.6 のままで、転送プロトコルに変更はありません。独立リモート MCP Worker は引き続き未展開です。`
      }
    }, "2026-08-06T15:53:00.000Z"),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (
        'seed-update-2026-08-06-agent-auth-form-origin',
        '2026-08-06-agent-auth-form-origin',
        'site-updates',
        '["网站更新","AI 能力","设备授权","安全","CLI","MCP","临时互传"]',
        '', 'published', 0, 0,
        '2026-08-06T12:00:00.000Z',
        '2026-08-06T12:00:00.000Z',
        '2026-08-06T12:00:00.000Z'
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
    ...articleTranslationsStatements(env, "seed-update-2026-08-06-agent-auth-form-origin", {
      zh: {
        title: "AI／CLI 授权确认页恢复正常",
        summary: "修复浏览器点击 Allow 时被 no-referrer 变成 Origin:null 而误拒绝的问题；授权与令牌管理表单恢复，精确同源、登录态和 CSRF 边界不变。",
        content_markdown: `# AI／CLI 授权确认页恢复正常

浏览器中的设备授权确认已恢复。此前点击 Allow 时，授权 HTML 继承的 \`no-referrer\` 策略会让表单 POST 带上 \`Origin: null\`，因而被服务端的精确同源检查正确地拒绝。

## 修复方式

- 仅设备授权与令牌管理 HTML 改用 \`strict-origin\`，让表单提交保留精确站点来源。
- 浏览器只会发送 \`https://lusu575.com\` 这样的来源，不会泄露包含 \`user_code\` 的路径或查询字符串。
- JSON 接口继续使用 \`no-referrer\`，没有放宽数据接口的隐私策略。
- \`/tokens/manage\` 的撤销表单同步修复。

## 安全边界不变

POST 仍必须通过精确 \`Origin\`、账号登录态和 CSRF 检查。缺失来源、\`Origin: null\`、与当前授权页 origin 不同的来源或攻击者来源仍会被拒绝。从 CLI、Codex 或外部链接打开的顶层授权 GET 现在可正常进入，而 iframe 和其他子资源加载仍被拒绝。

Quick Transfer 版本更新为 1.0.5，互传协议未改变。独立远程 MCP Worker 仍未部署。`
      },
      en: {
        title: "AI and CLI Authorization Forms Restored",
        summary: "Fixes browser Allow submissions that no-referrer turned into Origin:null; authorization and token-management forms work again while exact-origin, session, and CSRF checks remain unchanged.",
        content_markdown: `# AI and CLI Authorization Forms Restored

Browser device authorization works again. Previously, the authorization HTML inherited a \`no-referrer\` policy that caused the Allow form POST to carry \`Origin: null\`, so the server's exact same-origin check correctly rejected it.

## What changed

- Only the device-authorization and token-management HTML pages now use \`strict-origin\`, preserving the exact site origin required by their form submissions.
- The browser sends only an origin such as \`https://lusu575.com\`; it does not expose the path or query string containing \`user_code\`.
- JSON endpoints remain on \`no-referrer\`, so their privacy policy has not been relaxed.
- The revoke forms under \`/tokens/manage\` receive the same fix.

## Security boundary unchanged

POST requests must still pass exact \`Origin\`, signed-in session, and CSRF checks. Missing origins, \`Origin: null\`, any origin different from the authorization page, and attacker origins remain rejected. Top-level authorization GET navigations opened from a CLI, Codex, or another external link are now accepted, while iframe and other subresource loads remain blocked.

Quick Transfer is now version 1.0.5 with no change to its transfer protocol. The separate remote MCP Worker remains undeployed.`
      },
      ja: {
        title: "AI／CLI 認証フォームを復旧",
        summary: "no-referrer により Allow 送信の Origin が null となり拒否される問題を修正しました。認証・トークン管理フォームを復旧し、厳密な同一オリジン、セッション、CSRF 検査は維持します。",
        content_markdown: `# AI／CLI 認証フォームを復旧

ブラウザーのデバイス認証を復旧しました。これまでは認証 HTML が継承した \`no-referrer\` により、Allow フォームの POST が \`Origin: null\` となっていました。そのため、サーバーの厳密な同一オリジン検査によって正しく拒否されていました。

## 変更内容

- デバイス認証とトークン管理の HTML だけを \`strict-origin\` に変更し、フォーム送信に必要な正確なサイトオリジンを保持します。
- ブラウザーが送るのは \`https://lusu575.com\` のようなオリジンのみで、\`user_code\` を含むパスやクエリーは漏れません。
- JSON エンドポイントは引き続き \`no-referrer\` を使用します。
- \`/tokens/manage\` の取り消しフォームも同時に復旧しました。

## 安全境界は維持

POST には、厳密な \`Origin\`、ログインセッション、CSRF 検査が引き続き必要です。Origin の欠落、\`Origin: null\`、認証ページと異なるオリジン、攻撃者のオリジンは今後も拒否されます。CLI、Codex、外部リンクから開くトップレベルの認証 GET は許可し、iframe やその他のサブリソース読み込みは引き続き拒否します。

Quick Transfer はバージョン 1.0.5 となり、転送プロトコルに変更はありません。独立リモート MCP Worker は引き続き未展開です。`
      }
    }, "2026-08-06T12:00:00.000Z"),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (
        'seed-update-2026-08-06-japanese-agent-progress',
        '2026-08-06-japanese-agent-progress',
        'site-updates',
        '["网站更新","AI 能力","MCP","CLI","日语","账号进度"]',
        '', 'published', 0, 0,
        '2026-08-06T08:30:00.000Z',
        '2026-08-06T08:30:00.000Z',
        '2026-08-06T08:30:00.000Z'
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
    ...articleTranslationsStatements(env, "seed-update-2026-08-06-japanese-agent-progress", {
      zh: {
        title: "AI 已可读取日语进度并受控提交答题",
        summary: "第四阶段为本地 CLI／stdio MCP 加入账号日语进度读取和服务端判分的答题提交；新增权限、版本冲突与幂等保护，远程 MCP 仍未部署。",
        content_markdown: `# AI 已可读取日语进度并受控提交答题

AI 能力层第四阶段为“日语的言外之意”补上账号进度闭环，同时保留浏览器原有云同步行为。

## 新增能力

- 本地 CLI 与 stdio MCP 可读取当前关卡、已解锁关卡、通关与奖牌汇总、单关进度和有界的近期活动。
- AI 可提交关卡 ID、题库版本、内容哈希和逐题选项；分数、通关、奖牌、尝试次数和下一关解锁全部由服务端计算，调用方不能自行填写。
- Agent 辅助答题固定记录为双语辅助模式，奖牌最高为铜牌，不能冒充纯听训练成绩。

## 权限与一致性

进度读取和答题写入使用两个独立且非默认的最小权限 scope。写入同时检查账号、关卡解锁状态、题库哈希、进度 revision 和 operation ID；相同请求可安全重试，不同载荷复用同一 ID 会被拒绝。设备码轮询也会从短暂网络失败中有界恢复。

独立远程 MCP Worker 仍未部署，也没有获得这些账号能力。`
      },
      en: {
        title: "AI Can Read Japanese Progress and Submit Checked Attempts",
        summary: "Phase four adds account-bound Japanese progress reads and server-scored attempt submission to the local CLI/stdio MCP, with dedicated scopes, revision checks, and idempotency. The remote MCP remains undeployed.",
        content_markdown: `# AI Can Read Japanese Progress and Submit Checked Attempts

Phase four closes the account progress loop for Behind the Japanese while preserving the browser application's existing cloud-sync behavior.

## New capabilities

- The local CLI and stdio MCP can read the current stage, unlocked stages, clear and medal totals, optional per-stage progress, and a bounded recent-activity view.
- An AI client can submit a stage ID, content revision and hash, plus selected options for every question. Score, clear status, medal, attempt count, and the next unlock are computed by the server; callers cannot supply them.
- Agent-assisted attempts are recorded as bilingual assisted mode and can earn at most bronze, so they cannot be presented as verified listening-only results.

## Authorization and consistency

Progress reads and attempt writes use separate, non-default least-privilege scopes. Writes verify the account, unlock state, content hash, progress revision, and operation ID. An identical request can be retried safely, while reusing an ID for different input is rejected. Device authorization polling now also recovers from bounded transient network failures.

The separate remote MCP Worker remains undeployed and has not received these account capabilities.`
      },
      ja: {
        title: "AI が日本語学習進捗の取得と検証済み解答送信に対応",
        summary: "第4段階ではローカル CLI／stdio MCP にアカウント連携の学習進捗取得とサーバー採点の解答送信を追加しました。専用権限、リビジョン検査、冪等性を備え、リモート MCP は未展開のままです。",
        content_markdown: `# AI が日本語学習進捗の取得と検証済み解答送信に対応

第4段階では「日本語の裏側」にアカウント進捗の閉ループを追加し、ブラウザー版の既存クラウド同期動作は維持しました。

## 新しい機能

- ローカル CLI と stdio MCP で、現在の問題、解放済み問題、クリア数・メダル集計、任意の問題別進捗、上限付きの最近の活動を取得できます。
- AI は問題 ID、題庫リビジョン、内容ハッシュ、各設問の選択肢だけを送信します。得点、クリア、メダル、挑戦回数、次の問題の解放はすべてサーバーが計算し、呼び出し側は指定できません。
- Agent 補助による解答はバイリンガル補助モードとして記録し、獲得できるメダルは銅までです。純粋なリスニング成績として扱うことはできません。

## 権限と整合性

進捗取得と解答書き込みには、既定では付与されない個別の最小権限 scope を使います。書き込み時はアカウント、解放状態、内容ハッシュ、進捗 revision、operation ID を検査します。同一要求は安全に再試行できますが、異なる内容で同じ ID を再利用すると拒否されます。デバイス認証のポーリングも、一時的なネットワーク障害から上限付きで復旧します。

独立リモート MCP Worker は引き続き未展開で、これらのアカウント機能も追加されていません。`
      }
    }, "2026-08-06T08:30:00.000Z"),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (
        'seed-update-2026-08-06-agent-read-breadth',
        '2026-08-06-agent-read-breadth',
        'site-updates',
        '["网站更新","AI 能力","MCP","CLI","工具","游戏","日语"]',
        '', 'published', 0, 0,
        '2026-08-06T05:30:00.000Z',
        '2026-08-06T05:30:00.000Z',
        '2026-08-06T05:30:00.000Z'
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
    ...articleTranslationsStatements(env, "seed-update-2026-08-06-agent-read-breadth", {
      zh: {
        title: "AI 只读能力扩展到工具、游戏与日语关卡",
        summary: "第三阶段为本地 CLI／stdio MCP 补齐视频详情、三项真实工具、五个游戏的安全目录和 250 个日语潜台词关卡；远程 MCP 仍未部署，也没有新增远程写入。",
        content_markdown: `# AI 只读能力扩展到工具、游戏与日语关卡

AI 能力层第三阶段先扩展公开只读范围，让 AI 能先准确发现网站有什么，再决定是否需要更高风险的操作能力。

## 新增查询

- 视频列表现在可继续读取单个视频详情。
- 工具目录只返回在线画板、临时互传和日语的言外之意三项真实入口，不把示例占位卡片当成可用工具。
- 游戏目录可安全读取五个站内游戏的三语信息、语言支持、入口和许可证；只有 2048 标记为已有隔离 Agent 会话。
- 日语工具可读取 5 个等级、250 个锁定关卡的目录和单关公开内容，不读取或修改学习进度。

## 安全边界

所有目录都限制语言、ID、查询长度、条目数、响应大小和允许路径。游戏不会暴露存储键或源文件入口；日语关卡会校验版本、数量、内容哈希和锁定状态，也不会输出内部批次路径或音频构建文本。

## 当前仍未开放

这些能力只加入本地 CLI 与 stdio MCP。独立远程 MCP Worker 仍未部署且保持原来的公开文章只读范围；其他游戏控制、浏览器配对、日语进度写入和聊天写入仍未开放。`
      },
      en: {
        title: "AI Read Access Expands to Tools, Games, and Japanese Stages",
        summary: "Phase three adds video details, three real tools, a safe catalog of five games, and 250 Japanese subtext stages to the local CLI/stdio MCP. The remote MCP remains undeployed with no new remote writes.",
        content_markdown: `# AI Read Access Expands to Tools, Games, and Japanese Stages

Phase three expands the public read-only surface first, so AI clients can accurately discover what the site offers before any higher-risk operation is considered.

## New queries

- A video list result can now be followed by a single-video detail read.
- The tools catalog returns only Online Whiteboard, Quick Transfer, and Behind the Japanese, without presenting sample placeholder cards as usable tools.
- The games catalog safely exposes localized details, language support, launch paths, and licenses for five local games. Only 2048 is marked as having an isolated Agent session.
- The Japanese tool exposes five levels and 250 locked stage summaries and details without reading or changing learning progress.

## Safety boundary

Every catalog limits languages, IDs, query length, item counts, response bytes, and allowed paths. Game storage keys and source entries stay private. Japanese content is checked for version, count, hash, and lock state, while internal batch paths and audio build text are omitted.

## Still unavailable

These capabilities are available only in the local CLI and stdio MCP. The separate remote MCP Worker remains undeployed with its original public-article-only scope. Other game control, browser pairing, Japanese progress writes, and chat writes remain unavailable.`
      },
      ja: {
        title: "AI の読み取り機能をツール・ゲーム・日本語問題へ拡張",
        summary: "第3段階ではローカル CLI／stdio MCP に動画詳細、3つの実用ツール、5ゲームの安全な一覧、250問の日本語含意問題を追加しました。リモート MCP は未展開で、遠隔書き込みも追加していません。",
        content_markdown: `# AI の読み取り機能をツール・ゲーム・日本語問題へ拡張

第3段階では、より危険度の高い操作を検討する前に、AI がサイトの内容を正確に把握できるよう、公開読み取り範囲を先に広げました。

## 新しい照会

- 動画一覧から、個別の動画詳細を取得できるようになりました。
- ツール一覧はオンラインホワイトボード、一時転送、日本語の裏側だけを返し、サンプルのプレースホルダーを利用可能なツールとして扱いません。
- ゲーム一覧では、5つのローカルゲームの多言語情報、対応言語、起動パス、ライセンスを安全に取得できます。分離 Agent セッション対応を示すのは 2048 だけです。
- 日本語ツールでは、5レベル・250問のロック済み問題一覧と詳細を、学習進捗の読み書きなしで取得できます。

## 安全境界

すべての一覧で言語、ID、検索長、件数、応答サイズ、許可パスを制限します。ゲームの保存キーやソース入口は公開しません。日本語問題はバージョン、件数、ハッシュ、ロック状態を検証し、内部 batch パスや音声生成用テキストを省きます。

## まだ利用できないもの

これらはローカル CLI と stdio MCP だけの機能です。独立リモート MCP Worker は未展開で、従来の公開記事読み取り範囲のままです。他ゲームの操作、ブラウザー接続、日本語進捗の書き込み、チャット書き込みはまだ利用できません。`
      }
    }, "2026-08-06T05:30:00.000Z"),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (
        'seed-update-2026-08-06-whiteboard-2048-agent',
        '2026-08-06-whiteboard-2048-agent',
        'site-updates',
        '["网站更新","AI 能力","在线画板","2048","MCP","CLI"]',
        '', 'published', 0, 0,
        '2026-08-06T03:50:00.000Z',
        '2026-08-06T03:50:00.000Z',
        '2026-08-06T03:50:00.000Z'
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
    ...articleTranslationsStatements(env, "seed-update-2026-08-06-whiteboard-2048-agent", {
      zh: {
        title: "AI 已可操作在线画板与 2048",
        summary: "第二阶段把在线画板与 2048 接入本地 CLI／stdio MCP：画板可安全追加高层元素并在本地导出 JSON、SVG、PNG；2048 运行在隔离的本地会话中。远程 MCP 仍未部署且保持只读。",
        content_markdown: `# AI 已可操作在线画板与 2048

AI 能力层进入第二阶段，先接入在线画板和第一个可操作游戏。当前入口严格限定在本地 CLI 与 stdio MCP，能力边界会与实际实现保持一致。

## 在线画板

- AI 可加入公共或密码房，读取场景摘要，并安全追加文字、矩形、椭圆、菱形、直线和箭头等高层元素。
- 写入采用只追加规则；现有元素的编辑和删除、图片嵌入目前都不支持。
- 场景可在本地导出为 JSON、SVG 或 PNG；SVG 与 PNG 是简化的可视化导出。

## 2048

- AI 可创建隔离的本地 2048 会话，观察棋盘和可用动作，并通过带版本检查的操作完成移动、重置和关闭。
- 这不是对已经在浏览器中打开的游戏页面进行连接或接管，也不会混用访客的浏览器存档。

## 接口边界

这些新能力只通过本地 CLI／stdio MCP 提供。远程 MCP Worker 仍未部署且保持只读，没有公开连接地址，也没有远程写入能力。网站其余工具和游戏会继续按权限与数据边界分批接入。`
      },
      en: {
        title: "AI Can Now Draw on Whiteboards and Play 2048",
        summary: "Phase two connects Online Whiteboard and 2048 to the local CLI/stdio MCP: the board safely appends high-level elements and exports JSON, SVG, or PNG locally, while 2048 runs in an isolated local session. The remote MCP remains undeployed and read-only.",
        content_markdown: `# AI Can Now Draw on Whiteboards and Play 2048

The AI capability layer has entered its second phase with Online Whiteboard and the first controllable game. Access is deliberately limited to the local CLI and stdio MCP, and the published capability boundary matches what is implemented.

## Online Whiteboard

- AI clients can join a public or password room, read a scene summary, and safely append high-level elements such as text, rectangles, ellipses, diamonds, lines, and arrows.
- Writes are append-only. Editing or deleting existing elements and embedding images are not supported.
- A scene can be exported locally as JSON, SVG, or PNG. The SVG and PNG outputs are simplified visual exports.

## 2048

- AI clients can create an isolated local 2048 session, observe the board and available actions, and use revision-checked operations to move, reset, or close it.
- This does not connect to or take over a game page that is already open in a browser, and it does not reuse a visitor browser save.

## Interface boundary

These capabilities are available only through the local CLI and stdio MCP. The remote MCP Worker remains undeployed and read-only, with no public connection URL and no remote write operations. Other site tools and games will be connected in stages according to their permission and data boundaries.`
      },
      ja: {
        title: "AI がホワイトボード描画と 2048 操作に対応",
        summary: "第2段階としてオンラインホワイトボードと 2048 をローカル CLI／stdio MCP に接続しました。ホワイトボードは安全な高レベル要素の追記とローカル JSON／SVG／PNG 書き出し、2048 は分離されたローカルセッションに対応します。リモート MCP は未展開の読み取り専用のままです。",
        content_markdown: `# AI がホワイトボード描画と 2048 操作に対応

AI 機能レイヤーの第2段階として、オンラインホワイトボードと最初の操作可能なゲームを接続しました。入口はローカル CLI と stdio MCP に限定し、公開する機能範囲を実装済みの内容と一致させています。

## オンラインホワイトボード

- AI は公開ルームまたはパスワードルームに参加し、シーンの概要を読み取り、テキスト、長方形、楕円、ひし形、線、矢印などの高レベル要素を安全に追記できます。
- 書き込みは追記専用です。既存要素の編集や削除、画像の埋め込みには対応していません。
- シーンはローカルで JSON、SVG、PNG に書き出せます。SVG と PNG は簡略化した表示用の書き出しです。

## 2048

- AI は分離されたローカル 2048 セッションを作成し、盤面と利用可能な操作を確認して、リビジョン検査付きの操作で移動、リセット、終了を実行できます。
- すでにブラウザーで開いているゲーム画面への接続や乗っ取りではなく、訪問者のブラウザー保存データも再利用しません。

## インターフェースの境界

これらの新機能はローカル CLI と stdio MCP だけで利用できます。リモート MCP Worker は未展開の読み取り専用のままで、公開接続 URL もリモート書き込み機能もありません。ほかのサイトツールとゲームは、権限とデータ境界に応じて段階的に接続します。`
      }
    }, "2026-08-06T03:50:00.000Z"),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (
        'seed-update-2026-08-06-agent-capabilities',
        '2026-08-06-agent-capabilities',
        'site-updates',
        '["网站更新","AI 能力","MCP","CLI","临时互传"]',
        '', 'published', 0, 0,
        '2026-08-06T02:20:00.000Z',
        '2026-08-06T02:20:00.000Z',
        '2026-08-06T02:20:00.000Z'
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
    ...articleTranslationsStatements(env, "seed-update-2026-08-06-agent-capabilities", {
      zh: {
        title: "AI 能力层第一阶段：MCP、CLI 与临时互传",
        summary: "建立统一能力注册表、设备码和最小权限令牌，新增本地 CLI／stdio MCP 与尚未部署的只读远程 MCP；AI 现在可安全收发临时互传的文字和文件，白板与游戏控制仍在后续计划中。",
        content_markdown: `# AI 能力层第一阶段：MCP、CLI 与临时互传

网站开始补上一层面向 AI 的统一能力入口。第一阶段先把能力清单、授权边界和可复用客户端搭稳，再逐步接入更多工具。

## 已经完成

- 统一能力注册表会同时记录未来希望支持的入口和当前真正可用的入口，CLI、MCP 与文档都从同一份清单读取，避免把计划能力误报成已上线。
- 本地 CLI 和 stdio MCP 已可读取文章、搜索公开内容、查看每日 AI 新闻与视频列表。
- 临时互传已接入加入房间、列出内容、收发文字、上传下载文件和删除项目；密码只在本机输入或从明确指定的环境变量读取，不进入命令参数、能力清单或远程服务。
- 设备码登录与最小权限令牌把公开内容、互传读取、写入和删除分开授权，管理接口仍只接受管理员浏览器会话。

## 远程 MCP 的当前状态

只读远程 MCP Worker 的代码和测试已经完成，可提供能力清单、公开文章列表、搜索与文章读取。它目前没有部署到生产环境，也没有开放远程写操作，因此本次更新不提供可连接的线上 MCP 地址。

## 下一步

在线画板、游戏控制以及其余工具已经登记为后续适配目标，但现在还不能由 AI 直接接管。后续会按权限风险和数据边界分批实现，并只在真实可用后标记为已支持。`
      },
      en: {
        title: "AI Capability Layer: MCP, CLI, and Quick Transfer",
        summary: "Adds a governed capability registry, device authorization and scoped tokens, a local CLI/stdio MCP, and an undeployed read-only remote MCP; AI clients can now exchange Quick Transfer text and files, while Whiteboard and game control remain planned.",
        content_markdown: `# AI Capability Layer: MCP, CLI, and Quick Transfer

The site now has a shared capability layer for AI clients. This first phase establishes one inventory, authorization boundaries, and reusable clients before more tools are connected.

## Available now

- The capability registry records both intended transports and transports that are actually available. The CLI, MCP servers, and documentation read the same inventory so planned features are not presented as live.
- The local CLI and stdio MCP can list and search public content, read articles and Daily AI News, and list videos.
- Quick Transfer supports joining a room, listing items, sending and receiving text, uploading and downloading files, and deleting items. Passwords are entered locally or read from an explicitly named environment variable; they are not placed in command arguments, the registry, or the remote service.
- Device authorization and least-privilege tokens separate public-content access from Transfer read, write, and delete scopes. Administrator routes still require an administrator browser session.

## Remote MCP status

The read-only remote MCP Worker is implemented and tested for capability discovery, public article lists, search, and article reads. It has not been deployed to production and exposes no remote write operation, so this release does not provide a live remote MCP URL.

## Next

Online Whiteboard, game control, and the remaining tools are registered as adapter targets, but AI clients cannot control them yet. They will be added in stages according to permission risk and data boundaries, and will be marked available only after they actually work.`
      },
      ja: {
        title: "AI 機能レイヤー第1段階：MCP・CLI・一時転送",
        summary: "統一機能レジストリ、デバイス認証、最小権限トークン、ローカル CLI／stdio MCP、未展開の読み取り専用リモート MCP を追加しました。AI は一時転送のテキストとファイルを扱えますが、ホワイトボードとゲーム操作はまだ計画段階です。",
        content_markdown: `# AI 機能レイヤー第1段階：MCP・CLI・一時転送

AI クライアント向けの共通機能レイヤーをサイトに追加しました。第1段階では、より多くのツールを接続する前に、機能一覧、認可境界、再利用できるクライアントを整えています。

## 現在利用できるもの

- 機能レジストリは、将来対応したい入口と、現在実際に利用できる入口を分けて記録します。CLI、MCP、文書が同じ一覧を参照し、計画中の機能を公開済みとして表示しません。
- ローカル CLI と stdio MCP では、公開コンテンツの一覧・検索、記事と Daily AI News の取得、動画一覧の取得ができます。
- 一時転送では、ルーム参加、項目一覧、テキスト送受信、ファイルのアップロード・ダウンロード、項目削除に対応しました。パスワードはローカル入力または明示した環境変数からだけ読み取り、コマンド引数、レジストリ、リモートサービスには保存しません。
- デバイス認証と最小権限トークンで、公開コンテンツと一時転送の読み取り・書き込み・削除を分離しました。管理機能は引き続き管理者のブラウザーセッションだけを受け付けます。

## リモート MCP の状態

読み取り専用リモート MCP Worker は実装とテストを完了し、機能一覧、公開記事一覧、検索、記事取得を提供できます。ただし本番環境にはまだ展開しておらず、リモート書き込みもありません。そのため、今回の更新では接続可能な公開 MCP URL を案内しません。

## 次の段階

オンラインホワイトボード、ゲーム操作、そのほかのツールは今後のアダプター対象として登録済みですが、現時点で AI が直接操作することはできません。権限リスクとデータ境界に合わせて段階的に実装し、実際に動作した機能だけを利用可能として表示します。`
      }
    }, "2026-08-06T02:20:00.000Z"),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (
        'seed-update-2026-08-06-site-guides-password-rooms',
        '2026-08-06-site-guides-password-rooms',
        'site-updates',
        '["网站更新","知识库","网站使用指南","密码房"]',
        '', 'published', 0, 0,
        '2026-08-06T00:55:00.000Z',
        '2026-08-06T00:55:00.000Z',
        '2026-08-06T00:55:00.000Z'
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
    ...articleTranslationsStatements(env, "seed-update-2026-08-06-site-guides-password-rooms", {
      zh: {
        title: "新增“网站使用指南”和密码房攻略",
        summary: "知识库新增固定“网站使用指南”专区，并用一篇轻松攻略讲清匿名聊天室和在线画板的密码房，配有电脑端、手机端实拍图。",
        content_markdown: `# 新增“网站使用指南”和密码房攻略

知识库现在多了一个固定的“网站使用指南”专区，先从大家比较容易问到的密码房开始。

## 这次加了什么

- 新增“网站使用指南”固定分类，后面的网站功能攻略会继续放在这里。
- 发布《密码房怎么用：匿名聊天室 + 在线画板轻松上手》。
- 同一篇文章分别说明聊天室和画板的用法，不会把两个功能混成一个房间。
- 加入电脑端、手机端共四张线上实拍图，密码框保持安全，截图不包含真实密码。
- 中文、English、日本語三种版本一起上线。`
      },
      en: {
        title: "Website Guides and Password Room Guide",
        summary: "Knowledge now has a permanent Website Guides section and one relaxed password-room walkthrough for Anonymous Chat and Online Whiteboard, with real desktop and mobile screenshots.",
        content_markdown: `# Website Guides and Password Room Guide

Knowledge now has a permanent Website Guides section, starting with one of the most common questions: how password rooms work.

## What is new

- Added a permanent Website Guides category for future site walkthroughs.
- Published “How to Use Password Rooms: Anonymous Chat + Online Whiteboard.”
- One article explains both tools separately, without suggesting that their rooms are connected.
- Added four real production screenshots covering desktop and mobile, with no real password visible.
- Published Chinese, English, and Japanese versions together.`
      },
      ja: {
        title: "「サイト利用ガイド」とパスワードルーム案内を追加",
        summary: "知識庫に固定の「サイト利用ガイド」を追加し、匿名チャットとオンラインホワイトボードのパスワードルームを実際のPC・スマホ画像でやさしく案内します。",
        content_markdown: `# 「サイト利用ガイド」とパスワードルーム案内を追加

知識庫に固定の「サイト利用ガイド」を追加しました。最初の記事では、よく質問されるパスワードルームの使い方を案内します。

## 今回の追加内容

- 今後のサイト機能案内をまとめる固定カテゴリ「サイト利用ガイド」を追加しました。
- 「パスワードルームの使い方：匿名チャット＋オンラインホワイトボード」を公開しました。
- 一つの記事で二つのツールを別々に説明し、同じルームだと誤解しない構成にしました。
- PC・スマホ合計4枚の本番画面を追加し、実際のパスワードは画像に残していません。
- 中国語、English、日本語の3言語版を同時に追加しました。`
      }
    }, "2026-08-06T00:55:00.000Z"),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (
        'seed-site-guide-whiteboard-chat-password-rooms-2026-08-06',
        'whiteboard-chat-password-room-guide',
        'site-guides',
        '["网站使用指南","密码房","匿名聊天室","在线画板"]',
        '', 'published', 0, 0,
        '2026-08-06T00:54:00.000Z',
        '2026-08-06T00:54:00.000Z',
        '2026-08-06T00:54:00.000Z'
      )
      on conflict(article_id) do nothing
    `),
    ...articleTranslationsStatements(env, "seed-site-guide-whiteboard-chat-password-rooms-2026-08-06", {
      zh: {
        title: "密码房怎么用：匿名聊天室 + 在线画板轻松上手",
        summary: "一篇讲清匿名聊天室和在线画板的密码房：怎么进、怎么邀请朋友、手机上怎么用，以及两种房间各自的24小时清理规则。",
        content_markdown: `# 密码房怎么用：匿名聊天室 + 在线画板轻松上手

想和朋友单独聊几句，或者开一块只有你们知道的画板？用“密码房”就行。

先说清楚：这篇把匿名聊天室和在线画板放在一起讲，只是为了方便看。它们还是两个完全独立的工具。同一个密码填进两边，也不会把聊天和画板合成一个房间。

## 开始前，先记住三件事

1. 在同一个工具里，大家输入完全相同的密码，就会进入同一个密码房。
2. 密码不会自动放进分享链接，也不会替你保存在浏览器里。把入口和密码分开发给朋友，会更稳妥。
3. 用一串够长、别人不容易猜到的新密码。别拿邮箱、银行卡或其他重要账号密码来复用。

## 匿名聊天室：怎么进密码房

电脑上打开“匿名聊天室”，右上角点“密码房”，就会出现密码输入框。

![电脑端匿名聊天室的密码房入口](assets/images/articles/site-guides/password-room-chat-desktop.png?v=1375ed179bd8672af824c272f806f71d350d0485ab57067d9b4baaaca8a57440)

操作很简单：

1. 输入至少 6 个字符的密码。
2. 点“进入”。
3. 界面变成暗色，顶部显示“密码房”，就算进去了。
4. 让朋友也打开匿名聊天室，输入同一串密码，就能来到同一个聊天房。

手机上步骤一样，只是按钮排得更紧凑。进入后会看到暗色聊天界面，右上角的“普通房间”可以随时带你回大厅。

![手机端已经进入匿名聊天室密码房](assets/images/articles/site-guides/password-room-chat-mobile.png?v=15fa03aaa16b5f8670a14e15994c8d095d1f255af2a42c275e16cfd720c215ae)

每条消息最多 300 个字，3 秒可以发一条。刷新页面后会回到普通房间，想继续聊就要重新输入密码。

聊天室消息会在浏览器里加密后再发送，不过它不是“随便设个弱密码也绝对安全”的保险箱。密码太简单仍可能被猜到，当前网页代码也需要可信，所以特别敏感的内容还是别往里放。

## 在线画板：怎么进密码房

从首页进“工具”，打开“在线画板”。电脑端入口页里有一张很明显的“密码房”卡片。

![电脑端在线画板的密码房入口](assets/images/articles/site-guides/password-room-whiteboard-desktop.png?v=bc9e88c78701827241054ac9045a7b66874c7d2ac95c03cd3c1ae4b53a0a1ecd)

接着这样做：

1. 在“房间密码”里输入 4–128 个字符。
2. 点“进入密码房”。
3. 顶部看到“密码房”和“已连接”后，再开始画。
4. 朋友从同一个画板入口输入相同密码，就会进到同一块隔离画板。

手机上也是同一套流程。单指画画，双指缩放和平移；顶部的“导出”和“退出画板”都还在。

![手机端已经连接在线画板密码房](assets/images/articles/site-guides/password-room-whiteboard-mobile.png?v=44578f131f03ef3044dd87e69a53e2bcb1d9865fb761d9920cdd3bc96293894d)

要邀请别人时，打开“导出”菜单，复制或分享画板入口，再把密码单独告诉对方。链接本身不带密码。画完重要内容，建议先导出 PNG 或 SVG，等保存完成后再退出。

画板密码房是“用密码隔开房间”，画布内容仍会同步到服务器，不要把它理解成密码端到端加密的保险箱。

## 24 小时规则，怎么记最省事

- 聊天室看“最后一条新消息”：超过 24 小时没有新消息，密码房里的聊天记录会被清理。只是进入或看看，不会续期。
- 画板看“最后一个人离开”：最后一位真实连接者离开后开始算 24 小时。期间有人回来会取消倒计时；再次空房就重新计算。到期后整块画板和里面的图片一起清理。

一句话记住：聊天室看最后一条消息，画板看最后一个人离开。

## 卡住了，先检查这里

- 两个人有没有进同一个工具？聊天室密码和画板密码不会互通。
- 密码有没有完全一致？字母大小写、数字和符号都要对上。
- 刷新过页面吗？两边刷新后都要重新输入密码。
- 画板顶部还没显示“已连接”？先等一下再画。

就这些。密码房本身不复杂：选对工具、大家填同一个密码、用完记得导出或退出，就可以了。`
      },
      en: {
        title: "How to Use Password Rooms: Anonymous Chat + Online Whiteboard",
        summary: "A simple guide to entering password rooms in Anonymous Chat and Online Whiteboard, inviting friends, using them on mobile, and understanding each 24-hour cleanup rule.",
        content_markdown: `# How to Use Password Rooms: Anonymous Chat + Online Whiteboard

Want a separate place to chat with friends, or a whiteboard only your group knows about? Use a password room.

One important note first: this guide puts Anonymous Chat and Online Whiteboard in one article only for convenience. They are still two completely separate tools. Using the same password in both does not connect the chat room to the whiteboard.

## Three things to remember

1. Inside the same tool, people who enter the exact same password reach the same password room.
2. The password is not added to a share link or saved for you in the browser. Send the entry link and password separately.
3. Use a new, long password that is hard to guess. Do not reuse an email, banking, or other important account password.

## Anonymous Chat: entering a password room

On desktop, open Anonymous Chat and select “Password room” in the upper-right area. The password form appears below the room controls.

![Anonymous Chat password-room entry on desktop](assets/images/articles/site-guides/password-room-chat-desktop.png?v=1375ed179bd8672af824c272f806f71d350d0485ab57067d9b4baaaca8a57440)

Then:

1. Enter a password with at least 6 characters.
2. Select “Enter.”
3. When the interface turns dark and the header says “Password room,” you are in.
4. Ask your friend to open Anonymous Chat and enter the same password.

The mobile flow is the same, with a tighter layout. Once inside, the dark room and the “Public room” button make the current state clear.

![Anonymous Chat password room on mobile](assets/images/articles/site-guides/password-room-chat-mobile.png?v=15fa03aaa16b5f8670a14e15994c8d095d1f255af2a42c275e16cfd720c215ae)

Each message can contain up to 300 characters, and one message can be sent every 3 seconds. Refreshing returns you to the public room, so you need to enter the password again.

Chat messages are encrypted in the browser before they are sent, but this is not a magic vault that makes a weak password safe. A guessable password can still be attacked, and the current site code must be trusted. Avoid putting highly sensitive information here.

## Online Whiteboard: entering a password room

From Home, open Tools and then Online Whiteboard. On desktop, the lobby has a clear Password room card.

![Online Whiteboard password-room entry on desktop](assets/images/articles/site-guides/password-room-whiteboard-desktop.png?v=bc9e88c78701827241054ac9045a7b66874c7d2ac95c03cd3c1ae4b53a0a1ecd)

Next:

1. Enter 4–128 characters in the room-password field.
2. Select “Enter password room.”
3. Wait until the header shows “Password room” and “Connected” before drawing.
4. Anyone who opens the same whiteboard entry and uses the same password joins that isolated board.

The mobile controls work the same way. Draw with one finger, and use two fingers to zoom and pan. Export and Leave board remain in the top bar.

![Connected Online Whiteboard password room on mobile](assets/images/articles/site-guides/password-room-whiteboard-mobile.png?v=44578f131f03ef3044dd87e69a53e2bcb1d9865fb761d9920cdd3bc96293894d)

To invite someone, open Export and copy or share the whiteboard entry, then tell them the password separately. The link does not contain the password. For anything important, export a PNG or SVG and wait for saving to finish before leaving.

A whiteboard password room isolates access by password, but the canvas still synchronizes with the server. It is not password-based end-to-end encryption.

## The easy way to remember the 24-hour rules

- Chat follows the last new message. After 24 hours without a new message, that password room history is cleaned up. Entering or reading alone does not extend it.
- Whiteboard follows the last person leaving. Its 24-hour timer starts after the final real connection leaves. Re-entry cancels the timer; the next empty period starts it again. Expiry removes the whole board and its images.

In one line: Chat watches the last message; Whiteboard watches the last person leaving.

## If something does not work

- Are both people using the same tool? Chat and Whiteboard passwords do not cross over.
- Does the password match exactly, including case, numbers, and symbols?
- Did the page refresh? Both tools require the password again after a refresh.
- Does Whiteboard still say “Connecting”? Wait for “Connected” before drawing.

That is it: choose the right tool, enter the same password, and export or leave when you are done.`
      },
      ja: {
        title: "パスワードルームの使い方：匿名チャット＋オンラインホワイトボード",
        summary: "匿名チャットとオンラインホワイトボードのパスワードルームについて、入室、招待、スマホ操作、それぞれの24時間削除ルールをやさしく説明します。",
        content_markdown: `# パスワードルームの使い方：匿名チャット＋オンラインホワイトボード

友だちだけで少し話したい、または仲間だけが知っているホワイトボードを使いたい。そんなときは「パスワードルーム」を使います。

最初に一つだけ大事な点です。この案内は見やすいように匿名チャットとオンラインホワイトボードを一つの記事にまとめていますが、機能は完全に別です。両方に同じパスワードを入れても、チャットと画板が一つのルームになることはありません。

## 最初に覚える三つのこと

1. 同じツール内で、全員がまったく同じパスワードを入力すると同じパスワードルームに入れます。
2. パスワードは共有リンクに入らず、ブラウザーにも保存されません。入口とパスワードは分けて相手に伝えると安心です。
3. 長くて推測されにくい新しいパスワードを使いましょう。メール、銀行、重要なアカウントのパスワードは使い回さないでください。

## 匿名チャット：パスワードルームへの入り方

PCでは「匿名チャット」を開き、右上の「パスワードルーム」を押すと入力欄が表示されます。

![PC版匿名チャットのパスワードルーム入口](assets/images/articles/site-guides/password-room-chat-desktop.png?v=1375ed179bd8672af824c272f806f71d350d0485ab57067d9b4baaaca8a57440)

手順は簡単です。

1. 6文字以上のパスワードを入力します。
2. 「入る」を押します。
3. 画面が暗くなり、上部に「パスワードルーム」と表示されたら入室完了です。
4. 相手にも匿名チャットを開いて同じパスワードを入力してもらいます。

スマホも同じ流れです。入室後は暗いチャット画面になり、右上の「通常ルーム」からいつでも公開ルームへ戻れます。

![スマホ版匿名チャットのパスワードルーム](assets/images/articles/site-guides/password-room-chat-mobile.png?v=15fa03aaa16b5f8670a14e15994c8d095d1f255af2a42c275e16cfd720c215ae)

一通は最大300文字で、3秒ごとに一通送れます。ページを更新すると通常ルームへ戻るため、続けるときはもう一度パスワードを入力します。

メッセージはブラウザーで暗号化してから送信されますが、弱いパスワードまで絶対安全にする金庫ではありません。推測されやすいパスワードには危険があり、現在のサイトコードも信頼する必要があります。特に機密性の高い内容は入れないでください。

## オンラインホワイトボード：パスワードルームへの入り方

Homeから「ツール」を開き、「オンラインホワイトボード」へ進みます。PCの入口画面には「パスワードルーム」のカードがあります。

![PC版オンラインホワイトボードのパスワードルーム入口](assets/images/articles/site-guides/password-room-whiteboard-desktop.png?v=bc9e88c78701827241054ac9045a7b66874c7d2ac95c03cd3c1ae4b53a0a1ecd)

次の手順です。

1. ルームパスワード欄に4〜128文字を入力します。
2. 「パスワードルームへ」を押します。
3. 上部に「パスワードルーム」と「接続済み」が表示されてから描き始めます。
4. 相手も同じ画板入口で同じパスワードを入力すると、同じ隔離画板に入れます。

スマホも流れは同じです。1本指で描画し、2本指で拡大縮小と移動ができます。「出力」と「画板を退出」は上部にあります。

![接続済みのスマホ版オンラインホワイトボード](assets/images/articles/site-guides/password-room-whiteboard-mobile.png?v=44578f131f03ef3044dd87e69a53e2bcb1d9865fb761d9920cdd3bc96293894d)

招待するときは「出力」を開いて画板入口をコピーまたは共有し、パスワードは別に伝えます。リンクにはパスワードが入りません。大切な内容はPNGまたはSVGで出力し、保存完了を待ってから退出するのがおすすめです。

画板のパスワードルームはパスワードでアクセスを分ける仕組みですが、キャンバスはサーバーと同期します。パスワードによるエンドツーエンド暗号化ではありません。

## 24時間ルールの簡単な覚え方

- チャットは「最後の新しいメッセージ」を見ます。新しいメッセージがないまま24時間たつと、そのルームの履歴を削除します。入室や閲覧だけでは延長されません。
- 画板は「最後の人が退出した時」を見ます。最後の実接続が離れると24時間の計時が始まり、再入室で取り消され、再び空になると計り直します。期限になると画板全体と画像を削除します。

一言で覚えるなら、チャットは最後のメッセージ、画板は最後の人の退出です。

## うまくいかないとき

- 二人とも同じツールを開いていますか。チャットと画板のパスワードはつながりません。
- 大文字・小文字、数字、記号まで完全に同じですか。
- ページを更新しましたか。どちらも更新後はパスワードを入れ直します。
- 画板がまだ「接続中」ですか。「接続済み」になってから描いてください。

以上です。正しいツールを選び、全員が同じパスワードを入れ、終わったら出力または退出すれば大丈夫です。`
      }
    }, "2026-08-06T00:54:00.000Z"),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (
        'seed-update-2026-08-02-traffic-discovery-monitoring',
        '2026-08-02-traffic-discovery-monitoring',
        'site-updates',
        '["网站更新","流量保护","SEO","线上监控","D1"]',
        '', 'published', 0, 0,
        '2026-08-02T08:20:00.000Z',
        '2026-08-02T08:20:00.000Z',
        '2026-08-02T08:20:00.000Z'
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
    ...articleTranslationsStatements(env, "seed-update-2026-08-02-traffic-discovery-monitoring", {
      zh: {
        title: "流量发现与线上监控优化",
        summary: "减少重复遥测请求并提前收紧 D1 免费额度保护，补齐文章访问留存、三语 sitemap 与文章结构化数据，同时加入低频生产冒烟检查。",
        content_markdown: "# 流量发现与线上监控优化\n\n这次把访客统计、搜索引擎理解和生产故障发现串成一条更可靠的链路，不改变站点视觉与正常浏览方式。\n\n## 更准确的搜索入口\n\n- sitemap 固定输出正式主域名，不再因请求来自别名域名而生成重复 URL。\n- 首页更新时间来自最近一次已发布内容，而不是每次抓取都伪装成当天更新。\n- 首页、日语学习工具和每篇公开文章都声明中、英、日及默认语言对应关系。\n- 文章直达页补充作者、发布者和三语替代链接。\n\n## 有余量的免费额度保护\n\n- 首次访问不再先后发送访客识别和页面浏览两次请求；页面浏览本身会完成匿名身份与访客资料登记。\n- 浏览器会拦截一秒内同目标重复点击，减少无意义的 Pages Functions 请求和 D1 限频写入。\n- D1 预警／硬保护默认阈值从 60,000／80,000 收紧到 30,000／50,000 估算行；硬保护时停止页面与点击遥测，只保留 10% 文章阅读采样，为登录、存档、聊天、互传和画板等必要业务保留至少一半免费写入余量。只有仍等于旧默认值的配置会自动迁移，管理员自定义配置不被覆盖。\n- 180 天清理现同时覆盖页面、点击和文章访问事件，并继续在健康检查的后台任务中分批执行。\n\n## 线上故障更早暴露\n\nGitHub 在正式验证完成后以及每 12 小时运行一次低请求量冒烟检查，核对健康接口、首页、sitemap、文章直达页和内容哈希静态资源。短暂部署波动会有界重试，持续失败会让任务明确报错。www 到主域的永久跳转与真实用户性能监控仍需在 Cloudflare 控制台配置后单独验收，本次仓库更新不虚报已启用。"
      },
      en: {
        title: "Traffic Discovery and Production Monitoring",
        summary: "Reduces duplicate telemetry requests, reserves more of the D1 free tier, completes article-view retention and multilingual SEO signals, and adds a low-frequency production smoke check.",
        content_markdown: "# Traffic Discovery and Production Monitoring\n\nThis update connects visitor measurement, search-engine understanding, and production failure detection into a more reliable path without changing the site's visual design or normal browsing flow.\n\n## More accurate search entry points\n\n- The sitemap always emits the canonical production origin instead of copying whichever alias host requested it.\n- Home uses the latest published-content date rather than pretending it changed on every crawl.\n- Home, the Japanese learning tool, and every public article declare Chinese, English, Japanese, and default-language counterparts.\n- Direct article pages now include author, publisher, and language-alternate metadata.\n\n## Free-tier protection with real headroom\n\n- A first visit no longer sends separate identify and page-view requests; the page view already establishes the anonymous identity and visitor profile.\n- The browser suppresses repeat clicks on the same target within one second, avoiding needless Pages Functions requests and D1 rate-limit writes.\n- Default D1 warning and hard thresholds move from 60,000 / 80,000 to 30,000 / 50,000 estimated rows. Hard mode stops page and click telemetry and keeps only a 10% article-view sample, reserving at least half of the free write allowance for sign-in, saves, Chat, Transfer, and Whiteboard. Only untouched legacy defaults migrate; administrator custom settings remain unchanged.\n- The 180-day cleanup now covers page, click, and article-view events and continues in bounded background batches from the health check.\n\n## Earlier production failure detection\n\nA low-request GitHub smoke check runs after successful release verification and every 12 hours. It checks API and D1 health, Home, the sitemap, one direct article page, and an immutable hashed asset. Temporary deployment propagation is retried within a bound; sustained failures fail the task clearly. The permanent www redirect and real-user performance monitoring still require separate Cloudflare Dashboard configuration and verification, so this repository change does not claim they are enabled."
      },
      ja: {
        title: "流入発見性と本番監視の改善",
        summary: "重複テレメトリ要求を減らして D1 無料枠の余裕を広げ、記事閲覧の保存期限、多言語 SEO、本番の低頻度スモーク監視を追加しました。",
        content_markdown: "# 流入発見性と本番監視の改善\n\n今回の更新では、訪問計測、検索エンジン向け情報、本番障害の検知を一つの信頼できる流れにつなげました。サイトの見た目や通常の閲覧方法は変わりません。\n\n## より正確な検索入口\n\n- sitemap は要求に使われた別名ホストをコピーせず、常に正式な本番ドメインを出力します。\n- Home の更新日はクロール時刻ではなく、最後に公開された内容の日付を使います。\n- Home、日本語学習ツール、すべての公開記事で中国語・英語・日本語・既定言語の対応関係を宣言します。\n- 記事直達ページに著者、発行者、言語別 URL のメタデータを追加しました。\n\n## 無料枠に余裕を残す保護\n\n- 初回訪問で識別とページ表示を別々に送らず、ページ表示一回で匿名 ID と訪問者プロフィールを登録します。\n- 同じ対象への一秒以内の重複クリックをブラウザー側で抑え、不要な Pages Functions 要求と D1 制限記録を減らします。\n- D1 の既定の警告／強制保護しきい値を 60,000／80,000 から 30,000／50,000 推定行へ引き下げました。強制保護ではページとクリックの計測を止め、記事閲覧だけ 10% を残し、ログイン、保存、Chat、Transfer、Whiteboard など必要な処理に無料書き込み枠の半分以上を確保します。旧既定値のままの設定だけを移行し、管理者の独自設定は上書きしません。\n- 180 日の削除対象をページ、クリック、記事閲覧の全イベントへ広げ、ヘルスチェックのバックグラウンドで上限付きバッチとして実行します。\n\n## 本番障害を早めに検知\n\nGitHub の低リクエストなスモークチェックを、公開検証の成功後と 12 時間ごとに実行します。API／D1 の正常性、Home、sitemap、記事直達ページ、内容ハッシュ付き静的資産を確認します。一時的な反映遅延は上限付きで再試行し、継続障害は明確に失敗として表示します。www から正式ドメインへの恒久リダイレクトと実ユーザー性能監視は Cloudflare Dashboard での別設定と検証が必要であり、今回のリポジトリ更新では有効化済みと主張しません。"
      }
    }, "2026-08-02T08:20:00.000Z"),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (
        'seed-update-2026-08-01-whiteboard-calm-efficient-sync',
        '2026-08-01-whiteboard-calm-efficient-sync',
        'site-updates',
        '["网站更新","在线画板","节省资源","连接体验","铅笔草图"]',
        '', 'published', 0, 0,
        '2026-08-01T12:50:00.000Z',
        '2026-08-01T12:50:00.000Z',
        '2026-08-01T12:50:00.000Z'
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
    ...articleTranslationsStatements(env, "seed-update-2026-08-01-whiteboard-calm-efficient-sync", {
      zh: {
        title: "在线画板安静同步与空房休眠",
        summary: "画板 v1.0.2 统一所有房间的铅笔草图默认值，并用边缘自动心跳、后台停放、按变化批处理和空房无周期轮询降低 Cloudflare 用量；短暂重连不再弹大错误。",
        content_markdown: "# 在线画板安静同步与空房休眠\n\n画板升级到 v1.0.2。本次不改变公共画板永久保留、密码房空置24小时清理的边界，重点是让同步只在有意义时工作。\n\n## 所有房间统一草图风\n\n- 公共画板和全部密码房使用同一套暖白纸张、石墨线条、hachure 填充和手绘粗糙度默认值。\n- 当前不提供按房型切换的第二主题；颜色、线宽和绘图工具仍可自由修改。\n\n## 有变化才同步\n\n- 画布真实变化才会生成 Yjs 持久化更新，并按文档大小以250、500或1000毫秒合并发送；鼠标位置继续只作临时广播。\n- 可见页面每60秒发送一次轻量 ping，由 Cloudflare 边缘自动回复，不唤醒已经休眠的房间。\n- 标签页隐藏60秒后先等待未确认画线落盘，再主动停放连接；重新打开时会自动重连并同步差异。\n- 持续绘制期间，跨房管理用的 D1 摘要最多约每分钟更新一次，画布权威数据仍保存在 Durable Object。\n\n## 空房不做无效轮询\n\n- 空公共房不再运行周期生命周期闹钟，已画内容仍永久保留；只有票据、资源或限频状态确有到期任务时才安排一次性清理。\n- 密码房最后一人离开后仍只保留24小时删除计划，期间重入会取消并在再次为空时重计。\n- 有真实连接的房间以5分钟低频巡检兜底异常断线，正常离开会立即处理。\n\n## 更安静的连接提示\n\n不足3秒的连接波动不新增提示；持续重连只在画布角落显示小状态，不再用中央横幅或通用错误打断绘画。权限、协议、容量和文件错误仍会明确显示。"
      },
      en: {
        title: "Calmer Whiteboard Sync and Idle-Room Hibernation",
        summary: "Whiteboard v1.0.2 gives every room the same pencil-sketch defaults and lowers Cloudflare usage through edge auto-responses, hidden-tab parking, change-only batching, and no recurring empty-room polling; brief reconnects no longer show large errors.",
        content_markdown: "# Calmer Whiteboard Sync and Idle-Room Hibernation\n\nWhiteboard is now v1.0.2. Public-board permanence and the 24-hour cleanup boundary for empty password rooms are unchanged; this release makes synchronization work only when it has useful work to do.\n\n## One sketch style for every room\n\n- The public board and every password room share warm paper, graphite strokes, hachure fill, and hand-drawn roughness as their defaults.\n- There is currently no second theme selected by room type. Colors, stroke widths, and drawing tools remain editable.\n\n## Synchronize only after change\n\n- Only real canvas changes create durable Yjs updates. They are merged at 250, 500, or 1000 milliseconds according to document size, while pointer positions remain transient broadcasts.\n- A visible page sends one lightweight ping every 60 seconds. Cloudflare answers it at the edge without waking a hibernating room.\n- After a tab stays hidden for 60 seconds, it first drains unacknowledged strokes and then parks the connection. Returning reconnects and synchronizes the difference automatically.\n- During continuous drawing, the cross-room D1 summary is refreshed at most about once per minute; Durable Object storage remains authoritative for the canvas.\n\n## No useless polling in empty rooms\n\n- An empty public room has no recurring lifecycle alarm, while its drawing still persists. One-off cleanup is scheduled only when tickets, assets, or rate state actually expire.\n- A password room still keeps only its 24-hour deletion plan after the last participant leaves. Re-entry cancels it and a later departure restarts it.\n- Rooms with real connections use a five-minute low-frequency sweep only as a fallback for abnormal disconnects; normal departures are handled immediately.\n\n## Quieter connection feedback\n\nConnection changes shorter than three seconds add no notice. A longer reconnect shows only a small canvas-corner status instead of a central banner or generic error. Access, protocol, capacity, and file errors remain explicit."
      },
      ja: {
        title: "ホワイトボードの静かな同期と空室休止",
        summary: "ホワイトボード v1.0.2 は全ルームで鉛筆スケッチの既定値を統一し、エッジ自動応答、非表示タブの休止、変更時だけの一括同期、空室の定期巡回停止で Cloudflare 使用量を抑えます。短い再接続では大きなエラーを表示しません。",
        content_markdown: "# ホワイトボードの静かな同期と空室休止\n\nホワイトボードを v1.0.2 に更新しました。公開ボードの永続保持と、空になったパスワードルームを24時間後に削除する境界は変えず、必要なときだけ同期が動くようにしました。\n\n## 全ルームで一つのスケッチ風\n\n- 公開ボードとすべてのパスワードルームは、暖かい紙、黒鉛の線、ハッチング塗り、手描きの粗さを共通の既定値にします。\n- 現在はルーム種別ごとの第二テーマを用意しません。色、線幅、描画ツールは引き続き変更できます。\n\n## 変更時だけ同期\n\n- 実際にキャンバスが変わったときだけ永続 Yjs 更新を生成し、文書サイズに応じて250、500、1000ミリ秒でまとめます。ポインター位置は一時配信のままです。\n- 表示中のページは60秒ごとに軽量 ping を送り、Cloudflare がエッジで自動応答するため、休止中のルームを起こしません。\n- タブが60秒非表示になると、未確認の線を先に保存してから接続を休止します。再表示時は自動再接続して差分を同期します。\n- 連続描画中も、ルーム横断管理用の D1 要約は最大で約1分に1回だけ更新し、キャンバスの正本は Durable Object に残します。\n\n## 空室では無駄に巡回しない\n\n- 空の公開ルームには周期的なライフサイクル Alarm を置かず、描画内容はそのまま保持します。チケット、画像、制限状態に実際の期限がある場合だけ一回限りの清掃を予定します。\n- パスワードルームは最後の参加者が離れた後も24時間削除予定だけを保持し、再入室で取り消し、再び空になれば再計時します。\n- 実接続があるルームは異常切断の予備手段として5分間隔で低頻度確認し、通常の退出は即時処理します。\n\n## 静かな接続表示\n\n3秒未満の接続変動では追加表示を出しません。長引く再接続だけをキャンバス隅の小さな状態で示し、中央バナーや一般エラーで描画を遮りません。アクセス、プロトコル、容量、ファイルのエラーは明確に表示します。"
      }
    }, "2026-08-01T12:50:00.000Z"),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (
        'seed-update-2026-08-01-whiteboard-reliable-sketch',
        '2026-08-01-whiteboard-reliable-sketch',
        'site-updates',
        '["网站更新","在线画板","可靠保存","铅笔草图","版本治理"]',
        '', 'published', 0, 0,
        '2026-08-01T09:55:00.000Z',
        '2026-08-01T09:55:00.000Z',
        '2026-08-01T09:55:00.000Z'
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
    ...articleTranslationsStatements(env, "seed-update-2026-08-01-whiteboard-reliable-sketch", {
      zh: {
        title: "在线画板可靠保存与铅笔草图风",
        summary: "快速绘制现在会合并发送、等待服务端持久化确认并在断线后重传；公共画布持续保留，密码房空置24小时后整房清理，同时加入铅笔草图默认风格和画板、临时互传的独立版本记录。",
        content_markdown: "# 在线画板可靠保存与铅笔草图风\n\n快速画线时出现的通用错误和重进后内容消失，来自同一个未确认更新问题。本次把画板升级到 v1.0.1。\n\n## 画线只有落盘后才算完成\n\n- 连续绘制产生的 Yjs 更新会合并并按服务端建议间隔发送，避免短时间触发更新限流。\n- Worker 在 Durable Object 已保存增量和文档版本后才返回确认。确认前断线、限流或超时会保留数据，重连后安全重传。\n- 退出房间会短暂等待待确认更新排空；真实权限或协议错误仍会明确停止，而可恢复故障会自动重连。\n\n## 公共与私人房间的保存边界\n\n- 公共画板不按空房时间删除，画出的线条会在退出、重进和 Worker 重启后继续保留，只有管理员可以显式清空。\n- 密码房在最后一名真实连接离开后开始24小时倒计时；期间重新进入会取消，之后再次为空会重新计时，到期后整房画布、图片和索引一起清理。\n- 鼠标、选区和在线状态仍只实时广播，不写入长期存储。\n\n## 草图风格和独立版本\n\n- 新元素默认使用暖白纸张、石墨线条、手绘粗糙度和排线填充，仍可自由改颜色与工具。\n- 在线画板与临时互传现在分别维护版本、更新日志和 AI 维护文档；每次更新必须精确增加0.0.1并同步相关文档。"
      },
      en: {
        title: "Reliable Whiteboard Saving and Pencil Sketch Style",
        summary: "Rapid drawing is now batched, acknowledged only after durable storage, and retried after disconnects; the public canvas persists, empty password rooms are deleted after 24 hours, and Whiteboard plus Quick Transfer now have independent versions.",
        content_markdown: "# Reliable Whiteboard Saving and Pencil Sketch Style\n\nThe generic error during rapid drawing and missing content after re-entering came from the same unacknowledged-update problem. This release upgrades Whiteboard to v1.0.1.\n\n## A stroke is complete only after durable storage\n\n- Yjs updates from continuous drawing are merged and sent at the interval recommended by the service, avoiding short update-rate bursts.\n- The Worker acknowledges an update only after Durable Object storage contains both the increment and document version. Disconnects, rate limits, or timeouts before that acknowledgement keep the data for safe retransmission after reconnecting.\n- Leaving briefly waits for pending acknowledgements to drain. Real access or protocol violations still stop explicitly, while recoverable failures reconnect automatically.\n\n## Retention boundaries for public and private rooms\n\n- The public whiteboard is not deleted for being empty. Strokes persist across leaving, re-entry, and Worker restarts, and only an administrator can explicitly clear it.\n- A password room starts a 24-hour countdown after its last real connection leaves. Re-entry cancels it, becoming empty again restarts it, and expiry removes the room canvas, images, and indexes together.\n- Cursors, selections, and online status remain transient broadcasts and are not written to long-term storage.\n\n## Sketch defaults and independent versions\n\n- New elements default to warm paper, graphite strokes, hand-drawn roughness, and hachure fill, while colors and tools remain fully editable.\n- Whiteboard and Quick Transfer now maintain separate versions, changelogs, and AI maintenance guides. Every update must increase its version by exactly 0.0.1 and keep the related documents synchronized."
      },
      ja: {
        title: "ホワイトボードの確実な保存と鉛筆スケッチ風",
        summary: "高速描画をまとめて送信し、永続化後の確認と切断時の再送に対応しました。公開キャンバスは保持し、パスワードルームは空室24時間後に全削除します。鉛筆風の既定値と独立版管理も追加しました。",
        content_markdown: "# ホワイトボードの確実な保存と鉛筆スケッチ風\n\n高速描画中の一般エラーと再入室後の内容消失は、同じ未確認更新の問題が原因でした。今回ホワイトボードを v1.0.1 へ更新しました。\n\n## 永続保存後にだけ描画完了\n\n- 連続描画の Yjs 更新を統合し、サービスが推奨する間隔で送信して、短時間の制限超過を防ぎます。\n- Worker は Durable Object に増分と文書版が保存されてから確認を返します。それ以前の切断、速度制限、タイムアウトではデータを保持し、再接続後に安全に再送します。\n- 退室時は未確認更新の排出を短時間待ちます。実際のアクセスやプロトコル違反は明確に停止し、回復可能な障害は自動再接続します。\n\n## 公開と非公開ルームの保持境界\n\n- 公開ホワイトボードは空室時間で削除しません。退室、再入室、Worker 再起動後も線を保持し、管理者だけが明示的に消去できます。\n- パスワードルームは最後の実接続が離れてから24時間を計時します。再入室で取り消し、再度空室になれば再計時し、期限後はキャンバス、画像、索引をルームごと削除します。\n- カーソル、選択、オンライン状態は引き続き一時配信だけで、長期保存しません。\n\n## スケッチ既定値と独立版\n\n- 新規要素は暖かい紙、黒鉛の線、手描きの粗さ、ハッチング填りを既定とし、色とツールは自由に変更できます。\n- ホワイトボードと一時転送は、別々の版、更新履歴、AI 保守文書を管理します。更新ごとに版を正確に 0.0.1 上げ、関連文書を同期します。"
      }
    }, "2026-08-01T09:55:00.000Z"),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (
        'seed-update-2026-08-01-service-reliability',
        '2026-08-01-service-reliability',
        'site-updates',
        '["网站更新","账号","登录","D1","稳定性"]',
        '', 'published', 0, 0,
        '2026-08-01T07:10:00.000Z',
        '2026-08-01T07:10:00.000Z',
        '2026-08-01T07:10:00.000Z'
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
    ...articleTranslationsStatements(env, "seed-update-2026-08-01-service-reliability", {
      zh: {
        title: "账号与实时工具稳定性修复",
        summary: "修复 Cloudflare 密码派生兼容性导致的登录失败，并停止文章种子在冷启动时重复写入 D1，降低账号、匿名身份和在线画板共用数据库时的写入压力。",
        content_markdown: "# 账号与实时工具稳定性修复\n\n本次修复的是服务端兼容性和数据库写入放大，不需要访客更换电脑或网络。\n\n## 登录恢复\n\n- 新密码和旧密码升级现在使用 Cloudflare Workers 实际支持的 PBKDF2-HMAC-SHA256 100,000 次上限。\n- 旧 25,000 次记录成功登录后按条件升级；现有 100,000 次记录不再被重复改写。\n- 账号服务端故障与本地网络故障使用不同提示，避免把服务器问题误报为访客网络问题。\n\n## D1 写入降压\n\n- 文章初始化内容按发布版本写入持久标记；同一版本的后续冷启动只读标记，不再把整批文章和三语正文重复 upsert。\n- 这会减少与登录、匿名身份和画板加入共用 D1 时的无意义竞争，让实时工具更稳定。\n\n## 数据边界\n\n没有删除账号、文章、画板房间或历史内容；密码仍只保存派生哈希，画板实时文档仍由 Durable Object 管理。"
      },
      en: {
        title: "Account and Real-Time Tool Reliability Fixes",
        summary: "Fixes sign-in failures caused by a Cloudflare password-derivation incompatibility and stops article seeds from rewriting D1 on cold starts, reducing shared write pressure for accounts, anonymous identity, and Whiteboard.",
        content_markdown: "# Account and Real-Time Tool Reliability Fixes\n\nThis release fixes server compatibility and amplified database writes. Visitors do not need to change their computer or network.\n\n## Sign-in recovery\n\n- New password hashes and legacy upgrades now use the 100,000-iteration PBKDF2-HMAC-SHA256 ceiling actually supported by the Cloudflare Workers runtime.\n- Legacy 25,000-iteration records upgrade conditionally after a successful sign-in, while existing 100,000-iteration records are left unchanged.\n- Server-side account failures and local connection failures now use different messages instead of blaming the visitor's network for a backend problem.\n\n## Lower D1 write pressure\n\n- Article initialization now persists a release-version marker. Later cold starts for the same release read that marker instead of upserting the full article and trilingual-content set again.\n- Removing those unnecessary writes reduces contention in the D1 database shared by sign-in, anonymous identity, and Whiteboard entry.\n\n## Data boundary\n\nNo account, article, whiteboard room, or historical content is deleted. Passwords remain stored only as derived hashes, and live whiteboard documents remain managed by Durable Objects."
      },
      ja: {
        title: "アカウントとリアルタイムツールの安定性を修正",
        summary: "Cloudflare のパスワード導出互換性によるログイン失敗を修正し、コールドスタート時の記事 seed による D1 の反復書き込みを止め、アカウント・匿名ID・ホワイトボード共通DBの負荷を下げました。",
        content_markdown: "# アカウントとリアルタイムツールの安定性を修正\n\n今回はサーバー互換性とデータベースの書き込み増幅を修正しました。利用者がPCや回線を変更する必要はありません。\n\n## ログインの復旧\n\n- 新しいパスワードハッシュと旧記録の更新は、Cloudflare Workers ランタイムが実際に対応する上限である PBKDF2-HMAC-SHA256 100,000 回を使用します。\n- 旧 25,000 回の記録はログイン成功後に条件付きで更新し、既存の 100,000 回記録は再書き込みしません。\n- アカウントサーバー側の障害と端末の通信障害を別の案内にし、バックエンド問題を利用者の回線問題として表示しないようにしました。\n\n## D1 書き込み負荷の低減\n\n- 記事の初期化はリリース版マーカーを永続保存します。同じ版の後続コールドスタートではマーカーだけを読み、全記事と3言語本文を再度 upsert しません。\n- 不要な書き込みをなくすことで、ログイン、匿名ID、ホワイトボード入室が共有する D1 の競合を減らします。\n\n## データ境界\n\nアカウント、記事、ホワイトボードルーム、履歴データは削除しません。パスワードは引き続き導出ハッシュだけを保存し、ホワイトボードのリアルタイム文書は Durable Objects が管理します。"
      }
    }, "2026-08-01T07:10:00.000Z"),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (
        'seed-update-2026-07-30-multiplayer-whiteboard',
        '2026-07-30-multiplayer-whiteboard',
        'site-updates',
        '["网站更新","工具区","在线画板","实时协作","匿名身份"]',
        '', 'published', 0, 0,
        '2026-07-30T08:30:00.000Z',
        '2026-07-30T08:30:00.000Z',
        '2026-07-30T08:30:00.000Z'
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
    ...articleTranslationsStatements(env, "seed-update-2026-07-30-multiplayer-whiteboard", {
      zh: {
        title: "工具区多人在线画板上线",
        summary: "工具区新增免登录多人在线画板，支持公共与密码房、实时鼠标和临时名字、统一匿名身份、图片、PNG/SVG 导出，以及密码房无人后24小时保留。",
        content_markdown: "# 工具区多人在线画板上线\n\n工具区新增可直接使用的多人实时在线画板。它不是静态演示：进入房间会恢复已有内容，多个浏览器可以同时绘制并看到彼此的彩色鼠标和临时名字，暂不显示头像。\n\n## 公共画板与密码房\n\n- 公共画板供所有访客共同使用；管理员可以锁定、解锁和清空，但不会按24小时规则删除。\n- 双方输入相同密码会进入同一隔离房间，不同密码互不可见。密码经规范化后只在服务端参与 HMAC-SHA256 映射，不写入网址、本地长期存储、数据库主键或普通日志。\n- 密码房最后一人离开后保留24小时；期间重新进入会取消清理，再次为空后从新的离开时间重新计时。\n\n## 实时协作与统一匿名身份\n\n- 画板以 Excalidraw 提供绘图功能，以 Yjs 增量更新和 Durable Objects WebSocket 维护每个房间的权威状态；刷新、断线和网络切换后会自动恢复。\n- 匿名聊天室与画板共用同一个服务端验证的匿名ID、临时名字和颜色。安全词根可组合出超过一万种名字，同一房间由服务端原子查重，换名有冷却和频率限制。\n- 鼠标、选区和在线状态只实时广播而不写入 D1；画布更新会合并并定期生成快照。\n\n## 电脑、手机、图片与导出\n\n- 电脑、平板和手机均支持绘制、文本、选择、撤销重做、缩放和平移；移动端处理安全区域、键盘、横竖屏与双指手势。\n- 图片会校验真实类型、尺寸和像素数量后保存到房间隔离的 R2 对象，画布只保留资源引用，不长期保存大段 Base64。\n- 支持导出 PNG 和 SVG，并设置连接、消息、对象、图片和房间容量上限；管理员后台可查看公共画板状态、连接与容量，处理锁定、清空、异常连接和临时封禁。"
      },
      en: {
        title: "Multiplayer Whiteboard Is Live in Tools",
        summary: "Tools now includes a sign-in-free multiplayer whiteboard with public and password rooms, live cursors and temporary names, one shared anonymous identity, images, PNG/SVG export, and 24-hour retention for empty password rooms.",
        content_markdown: "# Multiplayer Whiteboard Is Live in Tools\n\nTools now includes a real-time multiplayer whiteboard that works without signing in. It restores existing room content, lets independent browsers draw together, and shows each remote participant's colored cursor and temporary name without an avatar.\n\n## Public and password rooms\n\n- The public whiteboard is shared by all visitors. Administrators can lock, unlock, or clear it, and the 24-hour deletion rule never applies to it.\n- People entering the same password reach the same isolated room, while different passwords cannot see one another. After normalization, a password is used only by the server for an HMAC-SHA256 mapping; it never enters the URL, long-term local storage, a database key, or ordinary logs.\n- A password room remains for 24 hours after its last participant leaves. Returning cancels cleanup; when it becomes empty again, a new 24-hour window begins.\n\n## Real-time collaboration and one anonymous identity\n\n- Excalidraw supplies the drawing tools, while Yjs incremental updates and Durable Objects WebSockets maintain authoritative state per room. Refreshes, disconnects, and network changes reconnect and restore safely.\n- Anonymous Chat and Whiteboard share one server-verified anonymous ID, temporary name, and color. Safe roots produce more than ten thousand name combinations, names are atomically unique within each room, and rotation has cooldown and rate limits.\n- Cursors, selections, and online state are broadcast only and never written to D1; document updates are compacted into periodic snapshots.\n\n## Desktop, mobile, images, and export\n\n- Desktop, tablet, and mobile support drawing, text, selection, undo and redo, zoom, and pan. Mobile behavior accounts for safe areas, the keyboard, orientation changes, and two-finger gestures.\n- Images are verified by real type, byte size, and pixel dimensions, then stored as room-isolated R2 objects. The canvas stores references instead of retaining large Base64 payloads.\n- PNG and SVG export are included. Connections, messages, objects, images, and room storage have bounded limits, while the admin panel exposes public-room state, connections, capacity, locking, clearing, abnormal-connection removal, and temporary bans."
      },
      ja: {
        title: "ツールに共同オンラインホワイトボードを追加",
        summary: "ツールにログイン不要の共同ホワイトボードを追加しました。公開・パスワードルーム、リアルタイムカーソルと一時名、共通匿名ID、画像、PNG/SVG出力、空室後24時間の保持に対応します。",
        content_markdown: "# ツールに共同オンラインホワイトボードを追加\n\nツールに、ログインせず使えるリアルタイム共同ホワイトボードを追加しました。既存のルーム内容を復元し、別々のブラウザから同時に描画でき、相手の色付きカーソルと一時名を表示します。アバターは表示しません。\n\n## 公開ルームとパスワードルーム\n\n- 公開ホワイトボードは全訪問者で共有します。管理者はロック、解除、消去ができ、24時間削除の対象にはなりません。\n- 同じパスワードを入力した人は同じ隔離ルームへ入り、異なるパスワードの内容は参照できません。正規化したパスワードはサーバー側の HMAC-SHA256 マッピングだけに使い、URL、長期ローカル保存、データベースキー、通常ログには残しません。\n- パスワードルームは最後の参加者が退出してから24時間保持します。再入室すると削除予定を取り消し、再び空になった時点から新しく24時間を数えます。\n\n## リアルタイム共同編集と共通匿名ID\n\n- 描画機能は Excalidraw、増分共同編集は Yjs、ルームごとの正本状態は Durable Objects WebSocket で管理します。更新、切断、ネットワーク切替後も再接続して復元します。\n- 匿名チャットとホワイトボードは、サーバー検証済みの同じ匿名ID、一時名、色を共有します。安全な語根から1万通り以上を生成し、同室内の重複はサーバーで原子的に防ぎ、名前変更には待機時間と回数制限があります。\n- カーソル、選択、オンライン状態はリアルタイム配信だけを行い D1 へ保存せず、文書更新は定期スナップショットへ統合します。\n\n## PC・モバイル・画像・出力\n\n- PC、タブレット、スマートフォンで描画、テキスト、選択、元に戻す／やり直し、拡大縮小、移動に対応します。モバイルでは安全領域、キーボード、画面回転、二本指操作を調整します。\n- 画像は実際の形式、容量、画素数を検証してルーム単位で隔離した R2 に保存し、キャンバスには大きな Base64 ではなく参照だけを保持します。\n- PNG と SVG に出力できます。接続、メッセージ、オブジェクト、画像、ルーム容量には上限があり、管理画面から公開ルーム状態、接続数、容量、ロック、消去、異常接続の切断、一時禁止を扱えます。"
      }
    }, "2026-07-30T08:30:00.000Z"),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (
        'seed-update-2026-07-29-knowledge-markdown-links',
        '2026-07-29-knowledge-markdown-links',
        'site-updates',
        '["网站更新","知识库","Markdown","链接","图片"]',
        '', 'published', 0, 0,
        '2026-07-29T02:14:00.000Z',
        '2026-07-29T02:14:00.000Z',
        '2026-07-29T02:14:00.000Z'
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
    ...articleTranslationsStatements(env, "seed-update-2026-07-29-knowledge-markdown-links", {
      zh: {
        title: "知识库正文与图注链接恢复",
        summary: "Tool Radar 正文与显式图片图注中的绝对 HTTPS Markdown 链接已恢复为安全可点击链接；七张真实配图同时登记实际尺寸并完善截图等待。",
        content_markdown: "# 知识库正文与图注链接恢复\n\nTool Radar 文章保留了已经核实的官网 Markdown 链接，但旧的行内渲染只处理粗体与代码，正文和显式图片图注中的链接会原样显示成标记。本次收尾恢复安全链接，并把七张真实配图的尺寸与截图稳定性一并补齐。\n\n## 链接恢复但不放宽安全边界\n\n- 正文与显式图注只把绝对 HTTPS Markdown 地址渲染为可点击链接。\n- `javascript:`、`data:` 等不安全协议、相对地址，以及带账号或密码的 URL 会被拒绝，不会变成可点击入口。\n- 链接继续使用 DOM 与 `textContent` 构造，不插入未处理 HTML；外部页面在新窗口打开并使用 `noreferrer noopener` 隔离。\n\n## 七张真实图片按真实比例预留空间\n\n- Tool Radar 首期七张官网、官方文档或官方仓库真实图片都登记了实际 `width` 与 `height`。\n- 浏览器会在懒加载开始前预留正确宽高比，减少长文阅读时图片出现造成的布局跳动。\n- 截图工具滚动到目标区域后，会在有限时间内等待可视图片完成加载，再保存最终截图；超时仍会明确失败，不会无限等待。\n\n## 保持原有文章与来源\n\n本次只修复安全 Markdown 呈现、图片尺寸和截图等待，不改变 Tool Radar 文章链接、正文顺序、官方图片来源或每周自动发布规则。"
      },
      en: {
        title: "Knowledge Article and Caption Links Restored",
        summary: "Absolute HTTPS Markdown links in Tool Radar body copy and explicit image captions are safely clickable again, while all seven real visuals now carry real dimensions and more reliable capture waits.",
        content_markdown: "# Knowledge Article and Caption Links Restored\n\nThe Tool Radar article kept its verified official Markdown links, but the previous inline renderer handled only bold text and code. Links in body copy and explicit image captions therefore appeared as raw markup. This update restores safe links and completes the sizing and capture behavior for all seven real visuals.\n\n## Links return without weakening the safety boundary\n\n- Body copy and explicit captions turn only absolute HTTPS Markdown addresses into clickable links.\n- Unsafe schemes such as `javascript:` and `data:`, relative addresses, and URLs containing a username or password are rejected and never become clickable entries.\n- Links are still built with DOM nodes and `textContent`, never unprocessed HTML. External pages open in a new window with `noreferrer noopener` isolation.\n\n## Seven real visuals reserve their real aspect ratios\n\n- All seven real Tool Radar images from official sites, documentation, or repositories now register their actual `width` and `height`.\n- The browser reserves the correct aspect ratio before lazy loading begins, reducing layout movement while reading a long article.\n- After the capture tool scrolls to its target, it waits for visible images for a bounded period before saving the final screenshot. A timeout still fails explicitly instead of waiting forever.\n\n## Existing content and sources stay intact\n\nThis update changes only safe Markdown presentation, image dimensions, and capture waiting. The Tool Radar article URL, narrative order, official image sources, and weekly publishing rules remain unchanged."
      },
      ja: {
        title: "知識庫の本文と画像キャプションのリンクを復元",
        summary: "Tool Radar の本文と明示的な画像キャプションにある絶対 HTTPS Markdown リンクを安全にクリックできるよう復元し、7枚の実画像に実寸と安定した取得待機を追加しました。",
        content_markdown: "# 知識庫の本文と画像キャプションのリンクを復元\n\nTool Radar 記事には確認済みの公式 Markdown リンクが残っていましたが、従来のインライン描画は太字とコードだけを処理していたため、本文と明示的な画像キャプションのリンクが記号のまま表示されていました。今回、安全なリンクを復元し、7枚の実画像の寸法と取得時の安定性も整えました。\n\n## 安全境界を緩めずにリンクを復元\n\n- 本文と明示的なキャプションでは、絶対 HTTPS の Markdown アドレスだけをクリック可能なリンクにします。\n- `javascript:` や `data:` などの危険なスキーム、相対アドレス、ユーザー名やパスワードを含む URL は拒否し、クリック可能にしません。\n- リンクは引き続き DOM と `textContent` で構築し、未処理 HTML は挿入しません。外部ページは新しいウィンドウで開き、`noreferrer noopener` で分離します。\n\n## 7枚の実画像で実際の縦横比を予約\n\n- 公式サイト、公式文書、公式リポジトリから採用した Tool Radar の実画像7枚に、実際の `width` と `height` を登録しました。\n- 遅延読み込みの開始前に正しい縦横比を予約し、長文閲覧中に画像が現れたときのレイアウト移動を減らします。\n- 取得ツールは対象位置までスクロールしたあと、表示中の画像が読み込まれるまで上限付きで待ってから最終スクリーンショットを保存します。時間切れは無限待機せず明示的に失敗します。\n\n## 既存の記事と出典は維持\n\n今回変更するのは安全な Markdown 表示、画像寸法、取得待機だけです。Tool Radar の記事 URL、本文順、公式画像の出典、週次公開ルールは変更しません。"
      }
    }, "2026-07-29T02:14:00.000Z"),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (
        'seed-update-2026-07-29-tool-radar-real-visuals',
        '2026-07-29-tool-radar-real-visuals',
        'site-updates',
        '["网站更新","工具雷达","真实界面","图片来源","自动化"]',
        '', 'published', 0, 0,
        '2026-07-29T01:10:00.000Z',
        '2026-07-29T01:10:00.000Z',
        '2026-07-29T01:10:00.000Z'
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
    ...articleTranslationsStatements(env, "seed-update-2026-07-29-tool-radar-real-visuals", {
      zh: {
        title: "工具雷达改用真实官方界面图",
        summary: "首期 7 张自绘概念图已换成官网、官方文档或官方仓库里的真实界面、案例与成果；每周工作流同步禁止自绘、生成和统一模板图。",
        content_markdown: "# 工具雷达改用真实官方界面图\n\n工具雷达首期文章保留原链接、标题、正文顺序和发布时间，只把七张难以看懂的自绘概念图换成与对应工具直接相关的真实图片。\n\n## 现在每张图都说明一件具体的事\n\n- 60fps 与 Mobbin 展示真实图库和产品流程分类，不再用抽象方框代替设计参考。\n- ChatCut 与 Remotion 展示实际编辑器、成片预览、AI 操作记录、参数和时间线。\n- Repomix、Context7 与 Pinokio 分别展示仓库打包结果、文档问答界面和安装前的脚本来源确认。\n- 每张图都增加了三语 alt 与图注，明确告诉读者应该看哪里，并链接对应的官方来源页。\n\n## 以后每周都按同一规则取图\n\n图片必须先从网上发现，再回到工具官网、官方功能页、官方文档、官方仓库或官方媒体核实。只接受真实产品界面、官方案例或真实成果；本站自绘说明图、AI 生成图、统一模板卡、仿界面图、搜索缩略图和第三方转载图都会被校验器拒绝。找不到合格实图时，文章保留文字，不再画一张替代图凑版面。\n\n## 来源与发布检查\n\n采用的图片保存官方来源、直接素材或精确截图位置、权利说明、核对时间和 SHA-256，并复制为本站资源而不是外链热链。新图片先随 GitHub 主分支部署，线上字节核对一致后再切换文章引用。"
      },
      en: {
        title: "Tool Radar Now Uses Real Official Product Visuals",
        summary: "Seven site-drawn concept diagrams have been replaced with real interfaces, examples, and outputs from official sites, docs, or repositories, while the weekly workflow now rejects drawn, generated, and template visuals.",
        content_markdown: "# Tool Radar Now Uses Real Official Product Visuals\n\nThe first Tool Radar article keeps its original link, title, narrative order, and publication time. Only the seven hard-to-read site-drawn concept diagrams have been replaced with real visuals directly tied to each tool.\n\n## Every image now has one concrete job\n\n- 60fps and Mobbin show real galleries and product-flow categories instead of abstract boxes standing in for design references.\n- ChatCut and Remotion show actual editors, output previews, AI action history, props, and timelines.\n- Repomix, Context7, and Pinokio show packed repository output, a documentation-question interface, and the source check before installation.\n- Every image has trilingual alt text and a caption that tells the reader what to inspect and links to the corresponding official source page.\n\n## The same rule applies every week\n\nImages must first be discovered online and then verified against the tool's official site, feature page, documentation, repository, or official media. Only real product interfaces, official examples, or real outputs are accepted. Site-drawn diagrams, AI-generated pictures, uniform template cards, simulated interfaces, search thumbnails, and third-party reposts fail validation. If no qualified real visual exists, the article keeps the text and uses no substitute image.\n\n## Source and release checks\n\nEach adopted image records its official source, direct asset or exact capture target, rights note, review time, and SHA-256. It is stored with the site rather than hotlinked. New bytes deploy from the GitHub main branch and the article switches only after the production file matches the reviewed hash."
      },
      ja: {
        title: "ツールレーダーを実際の公式画面へ更新",
        summary: "初回の自作概念図7枚を、公式サイト・文書・リポジトリの実画面、事例、成果へ置き換え、週次フローでも自作・生成・共通テンプレート画像を禁止しました。",
        content_markdown: "# ツールレーダーを実際の公式画面へ更新\n\n初回ツールレーダー記事は、元のリンク、タイトル、本文順、公開時刻を維持し、分かりにくかった自作概念図7枚だけを各ツールに直接関係する実画像へ置き換えました。\n\n## 各画像が一つの具体的な役割を持つ\n\n- 60fps と Mobbin は、抽象的な箱ではなく、実際のギャラリーと製品フローの分類を示します。\n- ChatCut と Remotion は、実際のエディター、完成プレビュー、AI の操作記録、Props、タイムラインを示します。\n- Repomix、Context7、Pinokio は、リポジトリのパック結果、文書質問画面、インストール前のスクリプト出所確認をそれぞれ示します。\n- すべての画像に3言語の alt とキャプションを付け、注目する場所と対応する公式情報源を明確にしました。\n\n## 毎週同じ規則で画像を選ぶ\n\n画像はまずオンラインで見つけ、ツールの公式サイト、機能ページ、文書、公式リポジトリ、公式メディアへ戻って確認します。実際の製品画面、公式事例、実際の成果だけを採用し、サイト自作図、AI 生成画像、共通テンプレートカード、模擬画面、検索サムネイル、第三者転載は検証で拒否します。合格する実画像がなければ、文章だけを残し、代替図は作りません。\n\n## 出典と公開確認\n\n採用画像には、公式出典、直接素材または正確な取得位置、権利上の説明、確認時刻、SHA-256 を保存し、外部ホットリンクではなくサイト資産として保持します。新しい画像を GitHub の main から先に配備し、本番上のバイト列が確認済みハッシュと一致してから記事を切り替えます。"
      }
    }, "2026-07-29T01:10:00.000Z"),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (
        'seed-update-2026-07-29-tool-radar-live',
        '2026-07-29-tool-radar-live',
        'site-updates',
        '["网站更新","工具雷达","知识库","自动化","多语言"]',
        '', 'published', 0, 0,
        '2026-07-28T16:45:00.000Z',
        '2026-07-28T16:45:00.000Z',
        '2026-07-28T16:45:00.000Z'
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
    ...articleTranslationsStatements(env, "seed-update-2026-07-29-tool-radar-live", {
      zh: {
        title: "工具雷达正式上线并开启周更",
        summary: "知识库“工具雷达”正式上线，首期 7 工具三语文章已发布；独立去重、原创说明图与每周二 22:00 自动任务同步启用。",
        content_markdown: "# 工具雷达正式上线并开启周更\n\n知识库新增固定分类“工具雷达”，并发布首期 7 个工具的中文、英文和日文完整文章。它面向不熟悉设计、动效、开发或部署术语的普通读者，重点讲清每个工具是什么、能做什么、能省下哪些步骤、怎么开始以及需要注意的限制。\n\n## 首期内容\n\n- 首期沿一条真实工作线介绍 60fps、Mobbin、ChatCut、Remotion、Repomix、Context7 与 Pinokio，从找参考、做视频、补代码上下文与最新文档，一直走到本地 AI 环境。\n- 每个工具都有收费、登录、中文支持、本地部署与 AI 接入的紧凑上手信息，不把文章排成冷冰冰的参数表。\n- 每项穿插一张基于已核实事实制作的本站原创说明图；图片不复制产品界面，先随站点部署，再由投递器核对线上 SHA-256 后公开正文。\n\n## 每周自动更新\n\n- 本机 Codex 任务固定在每周二北京时间 22:00 启动，广泛发现近期热门、实用、有趣或新奇的工具，并生成三语文章。\n- 每期目标介绍 6–10 个达到质量门槛的新工具，少于 3 个时不发布，也不会为了数量加入低价值内容。\n- 同类工具可以在不同周继续介绍，但同一个产品只收录一次。服务端目录阻止相同工具键和官网 URL；改名、换域名或被收购的候选还要人工核对历史名称和别名。\n\n## 发布安全\n\n工具事实优先回到官方网站、官方文档、价格页和可靠案例核对。专用投递通道、凭证与自动公开互相独立；运行记录、图片、三语结构、永久去重或线上回读任一失败，本期都会停止，不发布半成品。"
      },
      en: {
        title: "Tool Radar Is Live with Weekly Publishing",
        summary: "Tool Radar is live in Knowledge with a trilingual first edition covering seven tools; independent deduplication, original explanatory visuals, and the Tuesday 22:00 automation are active.",
        content_markdown: "# Tool Radar Is Live with Weekly Publishing\n\nKnowledge now has a permanent Tool Radar category and a complete first edition in Chinese, English, and Japanese covering seven tools. It is written for readers who may not know the vocabulary of design, motion, development, or deployment, so each section explains what a tool is, what it can do, which work it removes, how to begin, and what limits matter.\n\n## The first edition\n\n- The first issue follows one practical workflow through 60fps, Mobbin, ChatCut, Remotion, Repomix, Context7, and Pinokio: find references, make video, supply repository context and current documentation, then get local AI running.\n- Each tool includes compact pricing, sign-in, Chinese support, local deployment, and AI setup details without turning the article into a cold specification sheet.\n- Every entry uses one original explanatory visual based on verified facts. These visuals do not copy product interfaces; they are deployed with the site first, and the delivery client checks their production SHA-256 before publishing the article.\n\n## Weekly automation\n\n- A local Codex task starts every Tuesday at 22:00 Beijing time, searches broadly for useful, interesting, unusual, or recently discussed tools, and produces all three language editions.\n- Each issue targets 6–10 worthwhile tools, publishes nothing with fewer than three, and never fills space with low-value entries.\n- Similar tools may appear in different weeks, but the same product is covered once. The server blocks matching tool keys and canonical URLs, while suspected renames, domain moves, or acquisitions also require a manual historical-name and alias review.\n\n## Publishing safeguards\n\nClaims are checked against official product pages, documentation, pricing, and reliable examples. The dedicated channel, credential, and automatic-publishing switch remain independent; any failure in the run record, visuals, trilingual structure, permanent deduplication, or public readback closes the issue without publishing a partial article."
      },
      ja: {
        title: "ツールレーダーを公開し、週次更新を開始",
        summary: "知識庫の「ツールレーダー」を正式公開し、7ツールの初回3言語記事を掲載しました。独立重複防止、オリジナル説明図、毎週火曜22時の自動タスクも有効です。",
        content_markdown: "# ツールレーダーを公開し、週次更新を開始\n\n知識庫に固定分類「ツールレーダー」を追加し、7つのツールを扱う初回記事を中国語・英語・日本語で公開しました。デザイン、モーション、開発、導入の専門用語を知らない読者にも、各ツールが何か、何ができるか、どの手間を省けるか、どこから始めるか、どの制約に注意するかが分かる構成です。\n\n## 初回の記事\n\n- 60fps、Mobbin、ChatCut、Remotion、Repomix、Context7、Pinokio を、参考探し、動画制作、リポジトリ文脈と最新文書の補完、ローカル AI の起動という一つの作業順で紹介します。\n- 各ツールには、料金、ログイン、中国語対応、ローカル導入、AI 接続の情報を短くまとめ、冷たい仕様表にはしていません。\n- 各項目に、確認済みの事実を基に制作したサイト独自の説明図を1枚掲載します。製品画面は複製せず、画像を先にサイトへ配備し、配信前に本番上の SHA-256 を照合します。\n\n## 毎週の自動更新\n\n- ローカル Codex タスクは毎週火曜日の北京時間22時に開始し、便利、実用的、面白い、珍しい、または最近注目されたツールを広く探して3言語の記事を作成します。\n- 1回につき質を満たす6～10件を目安にし、3件未満なら公開せず、件数合わせの低価値な項目も追加しません。\n- 同分野の別製品は別の週に紹介できますが、同一製品は一度だけです。同じツールキーと公式 URL はサーバーが拒否し、改名、ドメイン移転、買収が疑われる候補は旧名称と別名も人手で確認します。\n\n## 公開時の安全策\n\n内容は公式製品ページ、文書、料金、信頼できる事例へ戻って確認します。専用チャンネル、認証情報、自動公開は独立したままです。実行記録、画像、3言語構造、恒久的な重複防止、公開後の読み戻しのどれかが失敗した場合、その回は途中の記事を公開せず停止します。"
      }
    }, "2026-07-28T16:45:00.000Z"),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (
        'seed-update-2026-07-28-knowledge-archive-visibility',
        '2026-07-28-knowledge-archive-visibility',
        'site-updates',
        '["网站更新","知识库","文章列表","分类","QA"]',
        '', 'published', 0, 0,
        '2026-07-28T05:30:00.000Z',
        '2026-07-28T05:30:00.000Z',
        '2026-07-28T05:30:00.000Z'
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
    ...articleTranslationsStatements(env, "seed-update-2026-07-28-knowledge-archive-visibility", {
      zh: {
        title: "知识库完整归档恢复",
        summary: "公共文章列表不再被 50 条上限截断；取消置顶的旧文章及其分类会继续出现在知识库，并可通过搜索与加载更多访问。",
        content_markdown: "# 知识库完整归档恢复\n\n本次修复取消置顶后旧文章在知识库列表中消失的问题。\n\n## 问题原因\n\n- 文章详情仍然是已发布状态，也没有被删除。\n- 公共列表接口只返回最新 50 条摘要；文章取消置顶后按原发布日期排序，刚好落在第 50 条之外。\n- 分类按钮由当前列表动态生成，因此唯一使用“AI”分类的文章被截断时，分类也会一起消失。\n\n## 修复内容\n\n- 公共文章摘要归档容量提升到 500 条，并由知识库前端明确请求同一容量。\n- 首屏仍只显示 12 条，继续通过“加载更多”逐批展开；搜索和分类则可以覆盖完整归档。\n- 取消置顶现在只改变排序，不会改变发布状态，也不会让旧文章或其分类从知识库消失。\n\n## 回归检查\n\n- 使用超过 50 条文章的受控数据验证旧文章和“AI”分类仍可发现。\n- 保留网站更新只出现在专属 Tab、置顶排序优先和三语文章回退等既有规则。"
      },
      en: {
        title: "Knowledge Archive Visibility Restored",
        summary: "The public article list no longer stops at 50 items. Older unpinned articles and their categories remain available through search and Load more.",
        content_markdown: "# Knowledge Archive Visibility Restored\n\nThis update fixes older articles disappearing from the Knowledge list after they are unpinned.\n\n## Cause\n\n- The article detail remained published and was never deleted.\n- The public list API returned only the newest 50 summaries. Once unpinned, the article returned to its original publication date and fell just beyond that boundary.\n- Category buttons are derived from the returned list, so the AI category disappeared with its only truncated article.\n\n## Fix\n\n- The public article-summary archive now supports 500 records, and the Knowledge client explicitly requests that same capacity.\n- The first screen still renders only 12 cards and expands in batches through Load more, while search and category discovery cover the complete archive.\n- Unpinning now changes ordering only; it does not change publication state or remove an older article or its category from Knowledge.\n\n## Regression coverage\n\n- Controlled data with more than 50 articles verifies that the older article and AI category remain discoverable.\n- Existing rules for the dedicated Site Updates tab, pinned ordering, and trilingual fallbacks remain intact."
      },
      ja: {
        title: "知識庫の全記事表示を復元",
        summary: "公開記事一覧の50件制限を解消し、固定解除した過去記事と分類を検索や「さらに表示」から引き続き参照できるようにしました。",
        content_markdown: "# 知識庫の全記事表示を復元\n\n固定表示を解除した過去記事が知識庫一覧から消える問題を修正しました。\n\n## 原因\n\n- 記事詳細は公開状態のままで、削除されていませんでした。\n- 公開一覧 API が最新 50 件の概要だけを返していたため、固定解除後に元の公開日順へ戻った記事が 50 件の境界外へ移動しました。\n- 分類ボタンは取得した一覧から生成するため、唯一の対象記事とともに「AI」分類も消えていました。\n\n## 修正内容\n\n- 公開記事概要の取得上限を 500 件へ広げ、知識庫側も同じ件数を明示して取得します。\n- 初期表示はこれまでどおり 12 件だけで、「さらに表示」により段階的に展開します。検索と分類は全取得範囲を対象にします。\n- 固定解除は並び順だけを変更し、公開状態や過去記事、分類の表示可否には影響しません。\n\n## 回帰確認\n\n- 50 件を超える制御データで、過去記事と「AI」分類を引き続き見つけられることを確認します。\n- 更新履歴の専用タブ、固定記事の優先表示、3 言語フォールバックの既存ルールも維持します。"
      }
    }, "2026-07-28T05:30:00.000Z"),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (
        'seed-update-2026-07-28-article-pin-sidebar-navigation',
        '2026-07-28-article-pin-sidebar-navigation',
        'site-updates',
        '["网站更新","知识库","文章管理","阅读体验","QA"]',
        '', 'published', 0, 0,
        '2026-07-28T05:20:00.000Z',
        '2026-07-28T05:20:00.000Z',
        '2026-07-28T05:20:00.000Z'
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
    ...articleTranslationsStatements(env, "seed-update-2026-07-28-article-pin-sidebar-navigation", {
      zh: {
        title: "文章置顶与目录定位修复",
        summary: "后台取消置顶不再被种子还原；返回按钮与目录合并为同一固定侧栏，目录点击会把目标标题对齐并同步高亮。",
        content_markdown: "# 文章置顶与目录定位修复\n\n本次继续修正知识库文章管理和长文阅读导航。\n\n## 后台置顶状态\n\n- “从提问到上线：普通人如何用 AI Agent 放大执行力”已恢复为未置顶。\n- 该文章的初始化种子改为只在首次建库时插入，不再在冷启动时覆盖后台保存的置顶状态和版本时间。\n- 线上已有错误状态通过一次性修复标记清理；以后在后台重新置顶或取消置顶都会保留。\n\n## 固定阅读侧栏\n\n- “返回文章列表”现在位于文章目录上方，并与目录共用同一个固定侧栏，不会在正文滚动后覆盖目录。\n- 桌面和横屏侧栏整体保持原位；窄屏按可读空间重新排版，按钮和目录仍保持独立间距。\n\n## 目录跳转\n\n- 点击目录时使用文章正文容器的精确滚动位置，将目标标题对齐到阅读区顶部安全线。\n- 跳转完成后，目录高亮、地址锚点和标题焦点同步到同一章节，不再停留在上一项。\n- 回归检查覆盖桌面、手机竖屏、短竖屏和手机横屏，并继续验证目录末项不裁切。"
      },
      en: {
        title: "Article Pinning and Contents Navigation Fixes",
        summary: "Admin pin choices now survive seed refreshes. The back control and contents share one anchored sidebar, and contents clicks align and highlight the requested heading.",
        content_markdown: "# Article Pinning and Contents Navigation Fixes\n\nThis update continues the Knowledge article-management and long-reading navigation fixes.\n\n## Admin pin state\n\n- “From Prompt to Production: How Ordinary People Can Amplify Execution with AI Agents” is restored to unpinned.\n- Its initialization seed now inserts metadata only on a fresh database, so cold starts no longer overwrite an admin pin choice or row revision.\n- A one-time repair marker clears the existing incorrect state; later pin and unpin actions remain under admin control.\n\n## Anchored reading sidebar\n\n- Back to Article List now sits above the contents and both controls belong to one anchored sidebar, so the back control cannot cover the contents after scrolling.\n- The whole sidebar stays in place on desktop and landscape layouts. Narrow screens reflow the same controls with independent spacing.\n\n## Contents navigation\n\n- A contents click scrolls the article detail container to an exact safe line near the top of the reader.\n- The selected contents item, URL anchor, and heading focus now move to the same chapter instead of remaining on the previous one.\n- Regression checks cover desktop, phone portrait, short portrait, and phone landscape while retaining the final-item clipping checks."
      },
      ja: {
        title: "記事の固定表示と目次移動を修正",
        summary: "管理画面の固定表示設定を seed が戻さないようにし、戻る操作と目次を同じ固定サイドバーへまとめ、目次移動時の見出し位置と選択表示を同期しました。",
        content_markdown: "# 記事の固定表示と目次移動を修正\n\n知識庫の記事管理と長文ナビゲーションを引き続き修正しました。\n\n## 管理画面の固定表示\n\n- 「質問から公開まで：AI Agent で実行力を広げる方法」を固定表示なしへ戻しました。\n- この文章の初期 seed は新規データベースへの初回挿入だけにし、コールドスタート時に管理画面の固定表示設定や更新時刻を上書きしません。\n- 既存の誤った状態は一度だけ実行する修正マーカーで解除し、その後の固定／解除は管理画面の選択を保持します。\n\n## 固定された閲覧サイドバー\n\n- 「記事一覧へ戻る」を目次の上へ移し、二つを同じ固定サイドバーにまとめました。本文を動かしても戻る操作が目次へ重なりません。\n- デスクトップと横画面ではサイドバー全体を固定し、狭い画面では同じ操作を読みやすい間隔で再配置します。\n\n## 目次からの移動\n\n- 目次を押すと記事詳細コンテナだけを動かし、対象見出しを閲覧領域上部の安全な位置へ正確に合わせます。\n- 選択中の目次、URL のアンカー、見出しフォーカスを同じ章へ同期し、前の項目に残らないようにしました。\n- デスクトップ、スマートフォン縦画面、短い縦画面、横画面で確認し、末尾項目の切れも引き続き検査します。"
      }
    }, "2026-07-28T05:20:00.000Z"),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (
        'seed-update-2026-07-28-knowledge-reader-welcome-fixes',
        '2026-07-28-knowledge-reader-welcome-fixes',
        'site-updates',
        '["网站更新","知识库","阅读体验","筛选","欢迎弹窗","QA"]',
        '', 'published', 0, 0,
        '2026-07-28T03:15:00.000Z',
        '2026-07-28T03:15:00.000Z',
        '2026-07-28T03:15:00.000Z'
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
    ...articleTranslationsStatements(env, "seed-update-2026-07-28-knowledge-reader-welcome-fixes", {
      zh: {
        title: "知识库阅读与每日欢迎修复",
        summary: "修复文章目录多行高亮与底部裁切，固定返回和回顶控件，更新日志仅留在专属 Tab，并恢复每天首次打开时的欢迎弹窗。",
        content_markdown: "# 知识库阅读与每日欢迎修复\n\n本次修复知识库长目录、文章内导航、更新记录筛选和欢迎窗口的日常触发。\n\n## 阅读区布局\n\n- 目录项取消固定高度，以统一行高和上下内边距随多行标题自然撑高；选中高亮不再压住文字。\n- 目录滚动区按可用高度布局，并在右侧和底部预留滚动安全空间，最后几条标题可以完整滚入视野。\n- “返回文章列表”固定在阅读区左上角，正文或目录滚动时保持原位。\n- “回到顶部”固定在正文阅读卡片右下角、任务栏或移动 Dock 上方；点击后只滚动文章正文容器。\n\n## 更新记录筛选\n\n- 网站更新日志不再出现在“全部”Tab 的列表与计数中。\n- 全部更新仍保留在“更新记录”专属 Tab，搜索和文章直链继续可用。\n\n## 每日欢迎与回归检查\n\n- 欢迎窗口按访问设备的本地自然日记录；每天首次打开任意公开页面时显示一次，打开后立即记录当天，避免同一天重复打扰。\n- 已覆盖桌面、窄屏竖向、短屏竖向和横向手机尺寸，检查标题换行、目录末尾、固定控件、正文回顶及 Tab 筛选。"
      },
      en: {
        title: "Knowledge Reading and Daily Welcome Fixes",
        summary: "Fixed multiline contents highlighting and bottom clipping, anchored article navigation, limited Site Updates to its dedicated tab, and restored the welcome window on the first open of each day.",
        content_markdown: "# Knowledge Reading and Daily Welcome Fixes\n\nThis update fixes long contents lists, in-article navigation, Site Updates filtering, and the daily welcome trigger.\n\n## Reader layout\n\n- Contents items no longer use a fixed height. Consistent line height and vertical padding let multiline titles grow naturally without the active highlight covering text.\n- The contents scroller uses its available height and keeps right and bottom safety space, so the final titles can scroll fully into view.\n- Back to Article List stays anchored at the upper-left of the reader while the article or contents list moves.\n- Back to Top stays at the lower-right of the reading card above the taskbar or mobile Dock, and it scrolls only the article detail container.\n\n## Site Updates filtering\n\n- Site Updates no longer appear in the All tab list or count.\n- Every update remains available in the dedicated Site Updates tab, while search and direct article links continue to work.\n\n## Daily welcome and regression coverage\n\n- The welcome window records the visitor device local calendar day. It opens once on the first public-page visit of each day and records that day immediately to avoid repeated prompts.\n- Desktop, narrow portrait, short portrait, and landscape phone sizes are covered for title wrapping, contents endings, anchored controls, article return-to-top behavior, and tab filtering."
      },
      ja: {
        title: "知識庫の閲覧と毎日のウェルカム表示を修正",
        summary: "複数行目次の強調表示と末尾の切れを直し、記事ナビゲーションを固定し、更新履歴を専用タブだけに限定して、毎日の初回表示でウェルカム画面が開くようにしました。",
        content_markdown: "# 知識庫の閲覧と毎日のウェルカム表示を修正\n\n長い目次、記事内ナビゲーション、更新履歴の絞り込み、ウェルカム画面の日次表示を修正しました。\n\n## 閲覧レイアウト\n\n- 目次項目の固定高さをなくし、統一した行間と上下余白で複数行タイトルが自然に伸びるようにしました。選択中の強調枠も文字に重なりません。\n- 目次のスクロール領域は利用可能な高さを使い、右側と末尾に安全余白を確保するため、最後の見出しまで完全に表示できます。\n- 「記事一覧へ戻る」は閲覧領域の左上に固定し、本文や目次を動かしても位置を保ちます。\n- 「トップへ戻る」は本文カード右下のタスクバーまたはモバイル Dock の上に固定し、記事詳細コンテナだけを先頭へ戻します。\n\n## 更新履歴の絞り込み\n\n- サイト更新履歴は「すべて」タブの一覧と件数に含めません。\n- すべての更新履歴は専用の「更新履歴」タブで引き続き表示し、検索と記事への直接リンクも利用できます。\n\n## 毎日のウェルカム表示と回帰確認\n\n- ウェルカム画面は閲覧端末のローカル日付を記録します。毎日の最初の公開ページ表示で一度だけ開き、その場で当日を記録して同日の再表示を防ぎます。\n- デスクトップ、狭い縦画面、短い縦画面、横向きスマートフォンで、タイトル折り返し、目次末尾、固定操作、本文の先頭復帰、タブ絞り込みを確認します。"
      }
    }, "2026-07-28T03:15:00.000Z"),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (
        'seed-update-2026-07-28-daily-ai-news-coverage-review',
        '2026-07-28-daily-ai-news-coverage-review',
        'site-updates',
        '["网站更新","每日AI新闻","新闻覆盖","多语言","质量复核"]',
        '', 'published', 0, 0,
        '2026-07-28T01:03:00.000Z',
        '2026-07-28T01:03:00.000Z',
        '2026-07-28T01:03:00.000Z'
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
    ...articleTranslationsStatements(env, "seed-update-2026-07-28-daily-ai-news-coverage-review", {
      zh: {
        title: "每日 AI 新闻覆盖与复核升级",
        summary: "每日 AI 新闻新增重点厂商与产业主题覆盖审阅、低产出二次检查及多语言可靠来源，并让标题直接显示当天头条。",
        content_markdown: "# 每日 AI 新闻覆盖与复核升级\n\n针对 7 月 28 日日报内容偏少的问题，本次加强了每日 AI 新闻的发现与发布前复核，并补充修订当天文章。\n\n## 覆盖范围更完整\n\n- 新增重点 AI 厂商、基础模型、芯片与存储、机器人、智能设备、数据中心、能源、网络及科技金融等主题的固定覆盖审阅。\n- 不再局限于中英文消息；其他语言的可靠报道和官方信息也会进入候选范围，之后再按时效、可信度和重要性统一筛选。\n\n## 低产出再次核对\n\n- 新闻数量仍不写死，也不会用低价值内容凑数；若初选结果异常偏少，发布前必须再次检查重点公司、主题和遗漏候选。\n- 去重会区分重复报道与真正的新进展，避免预告后的正式发布、权重开放或关键事实更新被一并忽略。\n\n## 7 月 28 日文章\n\n- 已重新核对此前 24 小时内的候选，补充重要进展并修订中、英、日三语文章。\n- 文章标题改为“每日 AI 新闻｜当天要闻标题”，不再只显示日期。\n- 正文继续保持完整文章、三段结构和逐条简短 AI 解读，不向读者堆放来源链接。"
      },
      en: {
        title: "Daily AI News Coverage and Review Expanded",
        summary: "Daily AI News now reviews priority companies and industry topics, performs a second pass for thin editions, accepts reliable multilingual sources, and surfaces the lead story in each title.",
        content_markdown: "# Daily AI News Coverage and Review Expanded\n\nAfter the July 28 edition proved too thin, this update strengthens discovery and the pre-publication review, and expands that day's article.\n\n## Broader coverage\n\n- A fixed coverage review now checks priority AI developers, foundation models, chips and storage, robotics, smart devices, data centers, energy, networking, and technology finance.\n- Reliable reporting and official information in other languages can enter the candidate pool alongside Chinese and English material, before a common review of recency, trustworthiness, and importance.\n\n## A second pass for thin editions\n\n- The article still has no fixed story count and will not use low-value filler. If the initial selection is unusually small, a second check of priority companies, topics, and possible omissions is required before publication.\n- Deduplication now distinguishes repeated coverage from a material new development, so an official release, open-weight milestone, or important factual update after an earlier announcement is not discarded with duplicates.\n\n## July 28 edition\n\n- Candidates from the exact preceding 24 hours were checked again, important developments were added, and the Chinese, English, and Japanese editions were revised.\n- Each title now uses “Daily AI News | lead-story headline” instead of showing only a date.\n- The article keeps its complete narrative, three-part structure, and short AI explanation for every story without piling source links into the reader-facing text."
      },
      ja: {
        title: "毎日AIニュースの収集・再確認を強化",
        summary: "毎日AIニュースに重点企業・産業テーマの網羅確認、件数が少ない場合の再確認、多言語の信頼できる情報源を追加し、タイトルには当日のトップニュースを表示します。",
        content_markdown: "# 毎日AIニュースの収集・再確認を強化\n\n7月28日版の記事数が少なすぎたことを受け、ニュース発見と公開前の確認を強化し、同日版も補足改訂しました。\n\n## 収集範囲を拡大\n\n- 重点AI企業、基盤モデル、半導体・ストレージ、ロボット、スマートデバイス、データセンター、エネルギー、ネットワーク、テクノロジー金融を固定の網羅確認対象に加えました。\n- 中国語と英語だけに限定せず、他言語の信頼できる報道や公式情報も候補へ含め、鮮度、信頼性、重要度を共通基準で確認します。\n\n## 件数が少ない場合は再確認\n\n- 掲載数は固定せず、価値の低い情報で埋めることもしません。初回選定が不自然に少ない場合は、重点企業、テーマ、見落とした候補を公開前にもう一度確認します。\n- 重複報道と実質的な新展開を区別し、予告後の正式公開、オープンウェイト化、重要事実の更新まで重複として除外しないようにします。\n\n## 7月28日版\n\n- 直前の正確な24時間に含まれる候補を再確認し、重要な動きを追加して中国語・英語・日本語版を改訂しました。\n- タイトルは日付だけでなく「毎日AIニュース｜当日のトップニュース見出し」を表示します。\n- 読者向け本文は、完結した記事、3部構成、各ニュースの短いAI解説を維持し、参照リンクを大量に並べません。"
      }
    }, "2026-07-28T01:03:00.000Z"),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (
        'seed-update-2026-07-28-daily-ai-news-reader-format',
        '2026-07-28-daily-ai-news-reader-format',
        'site-updates',
        '["网站更新","知识库","每日AI新闻","阅读体验"]',
        '', 'published', 0, 0,
        '2026-07-27T20:40:00.000Z',
        '2026-07-27T20:40:00.000Z',
        '2026-07-27T20:40:00.000Z'
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
    ...articleTranslationsStatements(env, "seed-update-2026-07-28-daily-ai-news-reader-format", {
      zh: {
        title: "每日 AI 新闻阅读格式调整",
        summary: "每日 AI 新闻详情不再重复摘要和采集窗口，正文直接进入要闻；目录改为列出每条新闻标题，测试占位文章已删除。",
        content_markdown: "# 每日 AI 新闻阅读格式调整\n\n本次根据实际阅读反馈，收紧了“每日 AI 新闻”的详情展示与固定生成格式。\n\n## 阅读更直接\n\n- 文章详情不再重复显示摘要。\n- 正文标题后直接进入“今日要闻”，不再向读者展示采集时间和筛选说明；严格的 24 小时窗口仍保留在内部工作流中。\n\n## 目录与内容清理\n\n- 文章目录改为逐条列出全部新闻的一句话标题，不再只显示“今日要闻 / 主要新闻 / 传闻”三个栏目。\n- 已删除用于早期链路验证的测试占位文章。\n\n## 后续规则\n\n工作流文档和自动校验已同步锁定这些要求，之后每天生成的三语日报都会沿用同一格式。"
      },
      en: {
        title: "Daily AI News Reading Format Updated",
        summary: "Daily AI News now opens directly with the stories, without a repeated summary or collection-window paragraph. Its contents list every headline, and the test placeholder is removed.",
        content_markdown: "# Daily AI News Reading Format Updated\n\nThis update tightens the Daily AI News reader and its permanent generation format based on real reading feedback.\n\n## A more direct reading flow\n\n- Article details no longer repeat the summary.\n- The body now moves from the title straight into Lead Story. Collection times and selection notes stay inside the workflow, while the exact 24-hour rule remains enforced.\n\n## Contents and cleanup\n\n- The contents panel now lists every one-line story headline instead of only Lead Story, More News, and Rumors.\n- The early test placeholder article has been removed.\n\n## Future editions\n\nThe workflow guide and validator now lock these rules, so future Chinese, English, and Japanese editions keep the same format."
      },
      ja: {
        title: "毎日AIニュースの閲覧形式を更新",
        summary: "毎日AIニュースは概要や収集時間を繰り返さず記事へ直接入り、目次には全ニュース見出しを表示します。テスト用記事も削除しました。",
        content_markdown: "# 毎日AIニュースの閲覧形式を更新\n\n実際の閲覧フィードバックに基づき、「毎日AIニュース」の表示と固定生成形式を整理しました。\n\n## すぐ本文へ\n\n- 記事詳細では概要を重ねて表示しません。\n- タイトルの直後から「今日のトップニュース」へ入り、収集時間や選定説明は読者向け本文に出しません。正確な24時間ルールは内部ワークフローで引き続き厳守します。\n\n## 目次と整理\n\n- 目次は「トップニュース / 主なニュース / 噂」の3区分だけでなく、すべてのニュース見出しを一件ずつ表示します。\n- 初期確認用のテスト記事を削除しました。\n\n## 今後の記事\n\nワークフロー文書と自動検証にも同じ規則を固定し、今後の中国語・英語・日本語版すべてでこの形式を継続します。"
      }
    }, "2026-07-27T20:40:00.000Z"),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (
        'seed-update-2026-07-27-daily-ai-news-inbox',
        '2026-07-27-daily-ai-news-inbox',
        'site-updates',
        '["网站更新","知识库","AI新闻","Admin"]',
        '', 'published', 0, 0,
        '2026-07-27T13:06:00.000Z',
        '2026-07-27T16:05:00.000Z',
        '2026-07-27T16:05:00.000Z'
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
    ...articleTranslationsStatements(env, "seed-update-2026-07-27-daily-ai-news-inbox", {
      zh: {
        title: "每日 AI 新闻正式上线",
        summary: "知识库“每日 AI 新闻”正式接入 Horizon 与 Codex：每天北京时间 7 点开始整理前 24 小时内容，三语稿通过检查后在 8 点前自动公开。",
        content_markdown: "# 每日 AI 新闻正式上线\n\n知识库“每日 AI 新闻”已经接入 Horizon 与 Codex 的固定日更流程，并以完整中文、英文、日文文章公开。\n\n## 每日流程\n\n- 每天北京时间 7 点开始，只处理此前精确 24 小时内发布的消息。\n- Horizon 必须先完成多来源采集、网址归一和重复合并；Codex 再做一手核实、重要性筛选、近 30 天去重和三语成文。\n- 正文继续使用“今日要闻 / 主要新闻 / 传闻”三段结构，每条保留简短、具体的 AI 解读，不向读者堆放来源链接。\n\n## 发布安全\n\n- 只有三语内容、时间窗口、来源记录、结构和去重检查全部通过，专用通道才会公开文章。\n- Horizon 不可用、验证失败或运行超过北京时间 8 点时，当天任务停止发布并留下失败记录，不用不完整内容凑数。\n- 后台仍可随时暂停通道、关闭自动公开、轮换或撤销凭证，并查看最近投递结果。\n\n## 首次上线\n\n正式上线使用 7 月 27 日三语样稿走完整生产链路验证；测试占位文章仍会明确标注，不会冒充真实新闻。"
      },
      en: {
        title: "Daily AI News Goes Live",
        summary: "Daily AI News now runs through Horizon and Codex: each Beijing-time day starts at 07:00, covers the prior 24 hours, and publishes the validated Chinese, English, and Japanese edition by 08:00.",
        content_markdown: "# Daily AI News Goes Live\n\nKnowledge’s Daily AI News is now connected to a fixed Horizon and Codex publishing flow, with complete Chinese, English, and Japanese editions.\n\n## Daily flow\n\n- Work starts every day at 07:00 Beijing time and only covers items published in the exact preceding 24 hours.\n- Horizon must first collect from multiple sources, normalize URLs, and merge duplicates. Codex then verifies primary material, applies the editorial threshold, checks the previous 30 days, and writes the three editions.\n- Each article keeps the Lead Story, More News, and Rumors structure, with one brief and specific AI take per item and no pile of source links for readers to open.\n\n## Publishing safeguards\n\n- The dedicated channel publishes only after all three languages, the time window, source record, structure, and duplicate checks pass.\n- If Horizon is unavailable, validation fails, or the run reaches 08:00 Beijing time, that day stops without publishing incomplete filler.\n- Admin can still pause the channel, disable automatic publishing, rotate or revoke its credential, and review recent delivery results.\n\n## First live run\n\nThe July 27 trilingual edition is used to verify the complete production path. The placeholder remains clearly labelled and cannot be mistaken for real news."
      },
      ja: {
        title: "毎日AIニュース正式稼働",
        summary: "「毎日AIニュース」は Horizon と Codex に正式接続され、北京時間の毎朝7時に直前24時間分の処理を始め、検証済みの中・英・日3言語版を8時までに自動公開します。",
        content_markdown: "# 毎日AIニュース正式稼働\n\n知識庫の「毎日AIニュース」は、Horizon と Codex による固定の日次公開フローへ接続され、中国語・英語・日本語の完全版を公開します。\n\n## 毎日の流れ\n\n- 毎日北京時間7時に開始し、直前の正確な24時間に公開された情報だけを扱います。\n- まず Horizon が複数ソースの収集、URL正規化、重複統合を行い、その後 Codex が一次情報の確認、重要度判定、過去30日との重複確認、3言語の記事作成を行います。\n- 本文は「今日のトップニュース / 主なニュース / 噂」の3部構成を保ち、各項目に短く具体的なAI解説を付け、読者向け本文には大量の参照リンクを並べません。\n\n## 公開時の安全策\n\n- 3言語、時間範囲、出典記録、構成、重複確認のすべてを通過した場合だけ、専用チャンネルが記事を公開します。\n- Horizon が利用できない、検証に失敗する、または北京時間8時を過ぎた場合は、不完全な記事を公開せず、その日の処理を停止して失敗を記録します。\n- 管理画面では引き続きチャンネルの一時停止、自動公開の無効化、認証情報の更新・失効、最近の配信結果の確認ができます。\n\n## 初回公開\n\n7月27日の3言語版で本番経路全体を検証します。プレースホルダー記事は引き続きテスト用と明記され、実際のニュースとは区別されます。"
      }
    }, "2026-07-27T16:05:00.000Z"),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (
        'seed-update-2026-07-26-security-reliability-hardening',
        '2026-07-26-security-reliability-hardening',
        'site-updates',
        '["security","reliability","Admin","Cloudflare","QA"]',
        '', 'published', 0, 0,
        '2026-07-26T14:58:00.000Z',
        '2026-07-26T14:58:00.000Z',
        '2026-07-26T14:58:00.000Z'
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
    ...articleTranslationsStatements(env, "seed-update-2026-07-26-security-reliability-hardening", {
      zh: {
        title: "全站安全与可靠性加固",
        summary: "一次性加固账号入口、统计写入、D1 迁移、后台并发编辑与互传治理，并为文章分享、游戏和日语工具补齐超时、降级与离线回退。",
        content_markdown: "# 全站安全与可靠性加固\n\n本轮把公开站点、Cloudflare 后端和管理后台作为一个完整系统复检，集中修复会影响账号安全、数据一致性、失败恢复和发布可信度的问题。\n\n## 账号、接口与统计\n\n- 账号与写接口限制请求体、来源和内容类型；登录、注册采用不暴露账号是否存在的响应，并按网络来源与账号标识实施退避限流。\n- 密码派生提高成本，旧密码在成功登录后渐进升级；服务端错误只返回稳定错误码，不把内部异常细节交给浏览器。\n- 页面、点击和文章浏览写入增加频率上限、重复抑制与有界保留，避免机器人或重复刷新无限放大 D1 写入。\n\n## 数据与后台一致性\n\n- 旧 D1 会先补齐缺失列，再执行依赖这些列的索引和完整 schema；全新数据库仍可一次初始化。\n- 文章、视频、视频分类与社交链接使用版本匹配写入；多个后台标签页同时编辑时，陈旧页面会收到冲突提示，不再静默覆盖较新的内容。\n- 临时互传管理区分部分成功与完全成功，设置写入使用条件更新，列表搜索、危险确认、重复操作锁和 R2 清理失败都有可恢复状态。\n\n## 公开访问与离线回退\n\n- 游戏目录和日语工具的可选 manifest 都有超时与本地回退；网络服务变慢时不会阻塞本地内容和已有存档。\n- 首页壁纸预载与真正渲染复用同一资源选择，避免重复下载。\n- `/articles/<slug>` 现在由边缘函数输出文章专属标题、摘要、Open Graph、Twitter、规范链接和结构化数据；脚本不可用时仍保留安全的可读正文回退。\n\n## 发布边界\n\n- 全站补齐基础安全响应头与采样可观测性；CI 的第三方 Actions 固定到不可变提交，并执行完整测试、构建、可重复产物和浏览器发布审计。\n- 这些改动不公开 session、密码、完整 IP、访客隐藏标识或后台草稿，也不改变 GitHub main 触发 Cloudflare Pages 自动部署的正式流程。"
      },
      en: {
        title: "Sitewide Security and Reliability Hardening",
        summary: "Hardened account entry, analytics writes, D1 migrations, concurrent admin editing, and Transfer governance while adding timeouts, degradation paths, and offline fallbacks for articles, games, and the Japanese tool.",
        content_markdown: "# Sitewide Security and Reliability Hardening\n\nThis pass reviews the public site, Cloudflare backend, and admin area as one system, fixing issues that could affect account security, data consistency, failure recovery, and release confidence.\n\n## Accounts, APIs, and analytics\n\n- Account and write endpoints now bound request bodies, origins, and content types. Sign-in and registration avoid revealing whether an account exists, with backoff limits applied by network source and account identifier.\n- Password derivation is more expensive, and older hashes upgrade gradually after a successful sign-in. Server errors expose stable codes instead of internal exception details.\n- Page, click, and article-view writes now have rate ceilings, duplicate suppression, and bounded retention so bots or repeated refreshes cannot grow D1 writes without limit.\n\n## Data and admin consistency\n\n- Legacy D1 databases add missing columns before dependent indexes and the complete schema run; fresh databases still initialize in one pass.\n- Articles, videos, video categories, and social links use version-matched writes. When multiple admin tabs edit the same record, a stale tab reports a conflict instead of silently overwriting newer content.\n- Quick Transfer governance distinguishes partial success from full success, uses conditional setting updates, and provides recoverable states for list search, dangerous confirmations, duplicate-action locks, and failed R2 cleanup.\n\n## Public access and offline fallback\n\n- The game catalog and optional Japanese-tool manifests have timeouts and local fallbacks, so slow network services do not block local content or existing saves.\n- Home wallpaper preload and rendering now share the same asset selection, avoiding duplicate downloads.\n- `/articles/<slug>` now receives article-specific title, summary, Open Graph, Twitter, canonical, and structured metadata at the edge, with a safe readable fallback when scripts are unavailable.\n\n## Release boundary\n\n- The site now ships baseline security headers and sampled observability. CI pins third-party Actions to immutable commits and runs the complete tests, build, reproducible-output check, and browser release audits.\n- These changes do not expose sessions, passwords, full IP addresses, hidden visitor identifiers, or admin drafts, and the official release path remains GitHub main triggering Cloudflare Pages."
      },
      ja: {
        title: "サイト全体のセキュリティと信頼性を強化",
        summary: "アカウント入口、分析書き込み、D1 移行、管理画面の同時編集、転送管理を強化し、記事・ゲーム・日本語ツールへタイムアウト、縮退、オフライン復帰を追加しました。",
        content_markdown: "# サイト全体のセキュリティと信頼性を強化\n\n公開サイト、Cloudflare バックエンド、管理画面を一つのシステムとして再点検し、アカウント安全性、データ整合性、障害復旧、公開品質に影響する問題をまとめて修正しました。\n\n## アカウント・API・分析\n\n- アカウント系と書き込み API は本文サイズ、送信元、Content-Type を制限します。ログインと登録ではアカウントの存在を推測できない応答を使い、ネットワーク元とアカウント識別子の両方で段階的に制限します。\n- パスワード導出コストを高め、古いハッシュはログイン成功後に順次更新します。サーバー内部の例外詳細はブラウザーへ返さず、安定したエラーコードだけを公開します。\n- ページ、クリック、記事閲覧の書き込みに上限、重複抑制、有限の保存期間を設け、ボットや連続更新で D1 書き込みが無制限に増えないようにしました。\n\n## データと管理画面の整合性\n\n- 旧 D1 は不足列を先に追加し、その後で依存インデックスと完全な schema を適用します。新規データベースは従来どおり一度で初期化できます。\n- 記事、動画、動画分類、ソーシャルリンクは版を照合して保存します。複数の管理タブで同じ項目を編集した場合、古い画面は新しい内容を黙って上書きせず競合を通知します。\n- 一時転送管理は部分成功と完全成功を区別し、設定を条件付きで更新します。検索、危険操作の確認、重複操作ロック、R2 削除失敗も復旧可能な状態として扱います。\n\n## 公開アクセスとオフライン復帰\n\n- ゲーム一覧と日本語ツールの任意 manifest にタイムアウトとローカル復帰を追加し、ネットワークが遅くてもローカル内容や既存保存を妨げません。\n- Home の壁紙は事前読み込みと実表示で同じ素材選択を使い、重複ダウンロードを避けます。\n- `/articles/<slug>` はエッジで記事固有のタイトル、概要、Open Graph、Twitter、canonical、構造化データを返し、スクリプトが使えない場合も安全な可読本文を残します。\n\n## 公開工程\n\n- 基本セキュリティヘッダーとサンプリング観測を追加しました。CI の外部 Actions は不変コミットへ固定し、全テスト、ビルド、再現可能な成果物、ブラウザー公開監査を実行します。\n- session、パスワード、完全な IP、非公開 visitor 識別子、管理下書きは公開せず、正式な公開経路も GitHub main から Cloudflare Pages を起動する方式のままです。"
      }
    }, "2026-07-26T14:58:00.000Z"),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (
        'seed-update-2026-07-26-chatroom-icon-redraw',
        '2026-07-26-chatroom-icon-redraw',
        'site-updates',
        '["UI","Chat","icon","Pixel Art","QA"]',
        '', 'published', 0, 0,
        '2026-07-26T10:58:00.000Z',
        '2026-07-26T10:58:00.000Z',
        '2026-07-26T10:58:00.000Z'
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
    ...articleTranslationsStatements(env, "seed-update-2026-07-26-chatroom-icon-redraw", {
      zh: {
        title: "匿名聊天室图标重绘",
        summary: "重新绘制匿名聊天室图标，缩小可见主体并增加均衡透明留白；Home、窗口、任务栏、欢迎入口与聊天头像现统一使用新图，旧图资源已移除。",
        content_markdown: "# 匿名聊天室图标重绘\n\n本轮更新匿名聊天室的完整公开图标身份：Home 入口的视觉重量与同组图标协调，窗口和聊天中的小尺寸槽位也统一使用同一张新图，旧图资源不再保留。\n\n## 图标调整\n\n- 新图继续使用小型 XP 聊天终端与粉色、青色双气泡，保持 Windows XP、Pixel Art 与 Y2K 桌面风格。\n- 唯一生产资源为 96×96 RGBA PNG `icon-chatroom.png`，可见主体从旧图的 93×90 缩小到 71×73，并在四边保留 10–13px 透明安全区。\n- 现有桌面 82px 与移动 Home 54px 映射继续使用；标题栏、任务栏、欢迎入口与头像保留各自既有的小槽位 contain 映射，因此不同位置都保持适度尺寸。\n- Home、窗口标题栏、桌面任务栏／移动 Dock、欢迎快捷入口、Chat 页头与消息头像现统一引用新图；`icon-chatroom-clean.png` 和旧原图均已移除。\n\n## 功能边界\n\n匿名聊天室路由、普通大厅、前端加密密码房、消息轮询、会话、发送与纯文本安全渲染均未修改。本轮只调整图标资产、缓存版本和对应视觉回归。"
      },
      en: {
        title: "Anonymous Chat Icon Redrawn",
        summary: "Redrew the Anonymous Chat icon with a smaller silhouette and balanced transparent padding. Home, windows, the taskbar, welcome shortcuts, and chat avatars now share the new asset, and the legacy artwork is removed.",
        content_markdown: "# Anonymous Chat Icon Redrawn\n\nThis pass updates the complete public icon identity for Anonymous Chat. The Home entry now matches the visual weight of its neighbors, while the smaller window and chat slots use the same new artwork. Legacy icon assets are no longer retained.\n\n## Icon adjustment\n\n- The new artwork keeps a compact XP chat terminal with coral and cyan speech bubbles, preserving the Windows XP, Pixel Art, and Y2K desktop style.\n- The sole production asset is the 96×96 RGBA PNG `icon-chatroom.png`. Its visible silhouette is reduced from the old 93×90 footprint to 71×73, with 10–13px of transparent safety padding on every side.\n- Existing 82px desktop and 54px mobile Home mappings remain in place. Titlebar, taskbar, welcome, and avatar slots keep their existing contain sizing, so every placement remains appropriately sized.\n- Home, window titlebars, the desktop taskbar and mobile Dock, welcome shortcuts, the Chat header, and message avatars now share the new asset. `icon-chatroom-clean.png` and the legacy source artwork have been removed.\n\n## Functional boundary\n\nThe Anonymous Chat route, public lobby, browser-encrypted password rooms, polling, sessions, sending, and plain-text safety rendering are unchanged. This update only changes icon assets, cache versions, and related visual regression coverage."
      },
      ja: {
        title: "匿名チャットアイコンを再描画",
        summary: "匿名チャットアイコンを描き直し、見える輪郭を小さくして透明余白を均等化しました。Home、ウィンドウ、タスクバー、ウェルカム入口、チャットのアバターを新しい素材へ統一し、旧素材は削除しました。",
        content_markdown: "# 匿名チャットアイコンを再描画\n\n今回は匿名チャットの公開アイコン全体を更新しました。Home 入口は周囲と同じ視覚的な重さに揃え、ウィンドウやチャット内の小さい枠も同じ新素材へ統一し、旧アイコン素材は残していません。\n\n## アイコン調整\n\n- 新しい絵は小型の XP チャット端末とピンク・シアンの2つの吹き出しを保ち、Windows XP、Pixel Art、Y2K のデスクトップ表現に合わせています。\n- 本番素材は 96×96 RGBA PNG の `icon-chatroom.png` だけです。見える輪郭を従来の 93×90 から 71×73 に縮め、四辺へ 10–13px の透明な安全余白を設けました。\n- デスクトップ 82px、モバイル Home 54px の既存表示設定は維持します。タイトルバー、タスクバー、ウェルカム入口、アバターも従来の小さい枠で contain 表示を続け、各位置で適度な大きさを保ちます。\n- Home、ウィンドウのタイトルバー、デスクトップのタスクバー／モバイル Dock、ウェルカムショートカット、Chat ヘッダー、メッセージのアバターを新素材へ統一し、`icon-chatroom-clean.png` と旧原画は削除しました。\n\n## 機能の境界\n\n匿名チャットのルート、公開ロビー、ブラウザー暗号化パスワード部屋、ポーリング、セッション、送信、プレーンテキスト安全描画は変更していません。今回はアイコン素材、キャッシュ版、関連する視覚回帰だけを更新しています。"
      }
    }, "2026-07-26T10:58:00.000Z"),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (
        'seed-update-2026-07-26-interface-audit-fixes',
        '2026-07-26-interface-audit-fixes',
        'site-updates',
        '["mobile","Games","UI","privacy","QA"]',
        '', 'published', 0, 0,
        '2026-07-26T08:58:00.000Z',
        '2026-07-26T08:58:00.000Z',
        '2026-07-26T08:58:00.000Z'
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
    ...articleTranslationsStatements(env, "seed-update-2026-07-26-interface-audit-fixes", {
      zh: {
        title: "全界面移动适配与游戏体验修复",
        summary: "完成全部公开界面复检，修复 A Dark Room、Kittens Game、Life Restart、2048 与 Hextris 五款游戏的手机适配、触控和滚动问题，并收紧弹窗层级与第三方请求边界。",
        content_markdown: "# 全界面移动适配与游戏体验修复\n\n本轮基于全界面截图和几何点检，集中修复移动游戏首屏、触控尺寸、嵌入页面宽度、弹窗层级及外部请求边界，同时保持桌面布局和现有存档功能不变。\n\n## 移动游戏\n\n- A Dark Room 与 Kittens Game 不再沿用固定桌面宽度，手机上可在当前视口内完整使用，并保留桌面原布局。A Dark Room 在同页横竖屏切换时会重算两层滑轨、当前偏移与资源面板归属；Kittens Game 顶部工具栏在窄屏自然换为两行，Steam 与 Version 信息不再裁切，全部可见关键控件保持至少 44px。\n- Life Restart 只在粗指针移动环境启用运行时适配：主操作与所有可见 `btn*` hitArea 至少 44px，竖屏把工具与主流程分开，短横屏改为底部横排；细指针桌面几何保持原样。\n- 2048 的“新游戏”和 Hextris 的核心控制扩大为移动端友好的触控尺寸。\n- 五个游戏共用壳在短屏上压缩工具区，让游戏画面成为主要滚动区域，避免外层页面与 iframe 同时纵向滚动。\n\n## 本地化与隐私\n\n- A Dark Room 的音频提示随中文、英文和日文界面切换。\n- Kittens Game 移除上游 Google Analytics，并禁用仅适用于原站的 KGNet 与 localhost 本地桥接请求；文档语言随站点同步，未选择主题不再预载或发起外部字体请求。本站自己的本地存档和账号云存档不受影响。\n\n## 公共界面细节\n\n- 短屏欢迎窗增加可读容量；视频无法内嵌时改用紧凑决策窗，不再留下大面积空白。\n- 桌面弹窗遮罩提高层级对比度，工具和关于页面的长文案使用更自然的换行。\n\n## 全面回归\n\n公开首页、知识库、视频、工具、游戏、聊天、关于、文章阅读器与五个游戏均按桌面和关键手机尺寸复检，并覆盖中文、英文与日文可见文案、横向溢出、滚动所有者和 44px 触控目标。"
      },
      en: {
        title: "Sitewide Mobile and Game Experience Fixes",
        summary: "Completed a full public-interface recheck, fixing mobile layout, touch, and scrolling across five games—A Dark Room, Kittens Game, Life Restart, 2048, and Hextris—while tightening modal hierarchy and third-party request boundaries.",
        content_markdown: "# Sitewide Mobile and Game Experience Fixes\n\nThis pass uses full-interface screenshots and geometry checks to fix mobile game first screens, touch sizes, embedded-document widths, modal hierarchy, and external request boundaries while preserving desktop layouts and existing save behavior.\n\n## Mobile games\n\n- A Dark Room and Kittens Game no longer inherit fixed desktop widths on phones. Their complete interfaces fit the current viewport, and their desktop layouts remain intact. A Dark Room now recomputes both sliders, the active offset, and store-panel ownership during same-page orientation changes; the Kittens Game top toolbar wraps naturally into two rows on narrow screens, keeps Steam and Version fully visible, and maintains at least 44px for every visible critical control.\n- Life Restart enables its runtime adaptation only for coarse pointers: the primary action and every visible `btn*` hit area are at least 44px, portrait separates tools from the main flow, and short landscape places them in a bottom row, while fine-pointer desktop geometry stays unchanged.\n- The New Game action in 2048 and the core Hextris controls now provide mobile-friendly touch targets.\n- The shared shell for all five games compacts its tools on short screens so the game surface owns the primary scroll instead of creating competing outer-page and iframe scrolling.\n\n## Localization and privacy\n\n- The A Dark Room audio prompt follows the Chinese, English, or Japanese interface language.\n- Kittens Game removes upstream Google Analytics and disables KGNet plus the localhost bridge that only applied to the original host. Its document language follows the site, and unselected themes no longer preload or trigger external font requests. This does not affect the site's own local saves or account cloud saves.\n\n## Public-interface details\n\n- The short-screen welcome sheet exposes more readable content. Failed video embeds now use a compact decision sheet instead of a mostly empty full-screen player.\n- Desktop modal dimming has clearer depth, and long copy on Tools and About wraps more naturally.\n\n## Full regression\n\nHome, Knowledge, Videos, Tools, Games, Chat, About, the article reader, and all five games were rechecked at desktop and critical phone sizes, covering Chinese, English, and Japanese copy, horizontal overflow, scroll ownership, and 44px touch targets."
      },
      ja: {
        title: "全画面のモバイル・ゲーム体験修正",
        summary: "公開画面を全面再点検し、A Dark Room、Kittens Game、Life Restart、2048、Hextris の5ゲームでモバイル配置・タッチ・スクロールを修正。モーダル階層と外部通信の境界も整えました。",
        content_markdown: "# 全画面のモバイル・ゲーム体験修正\n\n全画面のスクリーンショットと要素寸法の点検を基に、モバイルゲームの初期画面、タッチ寸法、埋め込み文書幅、モーダル階層、外部通信の境界を修正しました。デスクトップ配置と既存の保存機能は維持しています。\n\n## モバイルゲーム\n\n- A Dark Room と Kittens Game はスマートフォンで固定デスクトップ幅を使わず、現在の表示幅に収まり、デスクトップの元の配置も維持します。A Dark Room は同じ画面で端末を回転した時も、2段のスライダー、現在位置、資源パネルの所属を再計算します。Kittens Game の上部ツールバーは狭い画面で自然に2段へ折り返し、Steam と Version を欠けずに表示し、見えている主要操作をすべて44px以上に保ちます。\n- Life Restart は粗いポインター環境だけで実行時レイアウトを切り替えます。主操作と表示中のすべての `btn*` ヒット領域を44px以上にし、縦画面ではツールを主フローから分離、短い横画面では下部の横並びにします。細かいポインターのデスクトップ配置は変更しません。\n- 2048 の「新しいゲーム」と Hextris の主要操作を、モバイルで押しやすい寸法に広げました。\n- 5ゲーム共通シェルは短い画面でツール部を圧縮し、外側ページと iframe の二重縦スクロールを避けてゲーム面を主スクロールにします。\n\n## 多言語とプライバシー\n\n- A Dark Room の音声案内は中国語・英語・日本語の画面言語に合わせて表示します。\n- Kittens Game から上流の Google Analytics を削除し、元サイト専用の KGNet と localhost ブリッジを無効化しました。文書言語は当サイトに合わせ、未選択テーマの事前読み込みと外部フォント通信も行いません。当サイトのローカル保存とアカウント用クラウド保存には影響しません。\n\n## 公開画面の調整\n\n- 短い画面のウェルカムシートで読める範囲を増やしました。動画を埋め込めない場合は、大きな空白のある全画面ではなくコンパクトな選択シートを表示します。\n- デスクトップのモーダル背景を明確にし、ツールと About の長文を自然に折り返します。\n\n## 全面回帰\n\nHome、Knowledge、Videos、Tools、Games、Chat、About、記事リーダー、5ゲームをデスクトップと主要モバイル寸法で再点検し、中国語・英語・日本語、横方向のはみ出し、スクロール所有者、44px タッチ対象を確認しました。"
      }
    }, "2026-07-26T08:58:00.000Z"),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (
        'seed-update-2026-07-26-resources-to-tools',
        '2026-07-26-resources-to-tools',
        'site-updates',
        '["UI","i18n","Tools","compatibility","QA"]',
        '', 'published', 0, 0,
        '2026-07-26T06:55:36.099Z',
        '2026-07-26T06:55:36.099Z',
        '2026-07-26T06:55:36.099Z'
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
    ...articleTranslationsStatements(env, "seed-update-2026-07-26-resources-to-tools", {
      zh: {
        title: "资源区正式更名为工具区",
        summary: "公开栏目名称已统一为“工具区 / Tools / ツール”，内部 resources 路由、旧 #resources 链接、临时互传和全部功能保持不变。",
        content_markdown: "# 资源区正式更名为工具区\n\n公开栏目现在统一使用中文“工具区”、English “Tools”、日本語“ツール”，让入口名称更准确地对应当前的软件、临时互传和学习工具。\n\n## 显示名称\n\n- 首页桌面入口、窗口标题、任务栏、移动 Dock、Appbar、文档标题、空状态和临时互传返回操作已同步三种语言。\n- 旧文章标签中的“资源区 / Resources / リソース”会继续兼容，但显示时统一为新名称。\n\n## 功能兼容\n\n- 内部 route、hash、DOM、CSS、模块、API 和统计键继续使用稳定的 resources / resource-* 技术标识。\n- 既有 #resources 收藏链接、筛选状态、临时互传、工具卡片和后台统计归组均保持可用，不迁移或删除任何数据。\n\n## 点检\n\n构建和三语浏览器审计会同时检查首页入口、窗口标题、文档元信息、Dock、临时互传返回按钮及 #resources 深链，防止只改到部分界面。"
      },
      en: {
        title: "Resources Area Renamed to Tools",
        summary: "The public section name is now Tools across Chinese, English, and Japanese, while the resources route, existing #resources links, Quick Transfer, and all behavior remain unchanged.",
        content_markdown: "# Resources Area Renamed to Tools\n\nThe public section now uses Tools in English, 工具区 in Chinese, and ツール in Japanese so the label accurately matches the software, Quick Transfer, and learning tools available there.\n\n## Display name\n\n- The Home desktop entry, window title, taskbar, mobile Dock, Appbar, document metadata, empty states, and Quick Transfer return actions now use the same trilingual name.\n- Legacy article tags containing 资源区, Resources, or リソース remain accepted and render with the new display name.\n\n## Compatibility\n\n- Stable technical identifiers remain resources and resource-* across the route, hash, DOM, CSS, modules, APIs, analytics, and audits.\n- Existing #resources bookmarks, filters, Quick Transfer, tool cards, and analytics grouping continue to work without data migration or deletion.\n\n## QA\n\nBuild checks and trilingual browser audits now verify the Home entry, section title, document metadata, Dock, Quick Transfer return buttons, and the #resources deep link so partial renames are caught."
      },
      ja: {
        title: "リソース欄をツールへ名称変更",
        summary: "公開欄の名称を中国語・英語・日本語で「ツール」に統一し、resources ルート、既存の #resources リンク、一時転送、すべての機能は変更していません。",
        content_markdown: "# リソース欄をツールへ名称変更\n\n公開欄の表示名を日本語「ツール」、中文「工具区」、English「Tools」に統一し、ソフトウェア、一時転送、学習ツールという現在の内容に合わせました。\n\n## 表示名\n\n- Home のデスクトップ入口、ウィンドウタイトル、タスクバー、モバイル Dock、Appbar、文書メタデータ、空状態、一時転送の戻る操作を3言語で同期しました。\n- 過去の記事タグにある「资源区 / Resources / リソース」は互換入力として維持し、画面では新しい名称を表示します。\n\n## 互換性\n\n- route、hash、DOM、CSS、モジュール、API、統計、監査の技術識別子は resources / resource-* のままです。\n- 既存の #resources ブックマーク、絞り込み、一時転送、ツールカード、統計グループはデータ移行や削除なしで引き続き利用できます。\n\n## 点検\n\nビルドと3言語ブラウザー監査で Home 入口、欄タイトル、文書メタデータ、Dock、一時転送の戻るボタン、#resources 直リンクを確認し、一部だけ旧名称が残る回帰を防ぎます。"
      }
    }, "2026-07-26T06:55:36.099Z"),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (
        'seed-update-2026-07-26-mobile-article-first-screen',
        '2026-07-26-mobile-article-first-screen',
        'site-updates',
        '["mobile","Knowledge","accessibility","QA","UI"]',
        '', 'published', 0, 0,
        '2026-07-26T06:31:45.722Z',
        '2026-07-26T06:31:45.722Z',
        '2026-07-26T06:31:45.722Z'
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
    ...articleTranslationsStatements(env, "seed-update-2026-07-26-mobile-article-first-screen", {
      zh: {
        title: "手机文章首屏与全站点检修复",
        summary: "修复手机知识库文章首屏大面积空白、短横屏英文资源卡裁切，并补齐 Dock、回顶按钮、目录语言与图片说明等无障碍细节。",
        content_markdown: "# 手机文章首屏与全站点检修复\n\n本轮针对手机知识库文章首屏的大面积空白做了根因修复，并把同一批移动端、短屏和无障碍问题统一纳入回归点检。\n\n## 首屏与短屏布局\n\n- 根因是按需加载的知识库路由样式插到了移动端样式之后，同等优先级下重新写回了桌面阅读侧栏的最小高度。现在所有路由样式固定插在移动端样式之前，并保留高优先级移动端保护规则。\n- 359×500、390×844 与 844×390 三种关键手机尺寸都会在首屏直接露出正文，不再由目录区域撑出空白。\n- 短横屏英文资源卡改为按内容高度排布，说明、标签和 44px 主操作都保持在卡片内部。\n\n## 阅读与无障碍\n\n- 阅读进度按正文末尾计算，不再把 Dock 安全留白算进正文；回到顶部后焦点交还给文章标题。\n- 收起的 Dock 同时使用 inert、aria-hidden 与视觉隐藏，不再留下可聚焦的透明项目。\n- 目录使用文章实际语言，长标题可换行或横向显露，内部按钮存在时不再给容器增加重复 Tab 停靠点。\n- 图片由可见说明文字负责朗读，装饰性图片使用空替代文本，避免读屏重复播报。\n\n## 统一点检\n\n文章阅读器已覆盖三种关键手机尺寸、中文／英文／日文与回退语言；资源页同时复验三种语言和短横屏返回流程。构建门禁还会持续检查样式加载顺序、首屏正文容量、单一滚动所有者、触控尺寸与焦点行为。"
      },
      en: {
        title: "Mobile Article First-Screen and Sitewide QA Fix",
        summary: "Fixed the large blank area above mobile Knowledge articles and clipped English resource cards in short landscape, while completing Dock, back-to-top, TOC-language, and image-caption accessibility details.",
        content_markdown: "# Mobile Article First-Screen and Sitewide QA Fix\n\nThis pass fixes the root cause of the large blank area above mobile Knowledge articles and adds the related mobile, short-screen, and accessibility cases to the shared regression audit.\n\n## First-screen and short-screen layout\n\n- Lazy Knowledge route CSS was being inserted after the mobile stylesheet, allowing an equal-specificity desktop sidebar minimum height to win. Route styles now always load before the mobile authority, with a defensive mobile guard retained.\n- At 359×500, 390×844, and 844×390, article body copy is visible on the first screen instead of being pushed down by the TOC area.\n- English resource cards in short landscape now use content-sized rows, keeping descriptions, tags, and the 44px primary action inside each card.\n\n## Reading and accessibility\n\n- Reading progress ends at the article body instead of counting Dock safety padding, and back-to-top activation returns focus to the article title.\n- A collapsed Dock is inert, aria-hidden, and visually hidden, leaving no transparent focusable items.\n- The TOC follows the article's actual language, long titles wrap or reveal horizontally, and containers with interactive children no longer create a duplicate Tab stop.\n- Visible captions provide image descriptions while the corresponding image uses empty alt text, preventing duplicate screen-reader announcements.\n\n## Unified QA\n\nThe article reader now covers three critical mobile sizes, Chinese, English, Japanese, and fallback-language content. Resources are also rechecked across all three languages and the short-landscape return flow. Build gates continue to verify stylesheet order, first-screen body capacity, a single scroll owner, touch sizes, and focus behavior."
      },
      ja: {
        title: "モバイル記事初期画面と全体点検の修正",
        summary: "モバイルのナレッジ記事上部に生じる大きな空白と短い横画面での英語リソースカードの欠けを修正し、Dock、先頭へ戻る操作、目次言語、画像説明のアクセシビリティも整えました。",
        content_markdown: "# モバイル記事初期画面と全体点検の修正\n\nモバイルのナレッジ記事上部に大きな空白が生じる根本原因を修正し、関連するモバイル、短い画面、アクセシビリティの項目を共通回帰点検へ追加しました。\n\n## 初期画面と短い画面のレイアウト\n\n- 遅延読み込みされるナレッジのルート CSS がモバイル CSS の後ろに挿入され、同じ詳細度のデスクトップ用サイドバー最小高さが再適用されていました。ルート CSS は必ずモバイル CSS より前に読み込み、モバイル側の保護規則も維持します。\n- 359×500、390×844、844×390 の各サイズで、目次領域に押し下げられず初期画面から本文が見えるようになりました。\n- 短い横画面の英語リソースカードは内容に応じた高さとなり、説明、タグ、44px の主操作がカード内に収まります。\n\n## 閲覧とアクセシビリティ\n\n- 読了率は Dock 用の安全余白を含めず本文末尾で完了し、先頭へ戻る操作後は記事タイトルへフォーカスを移します。\n- 折りたたんだ Dock は inert、aria-hidden、視覚非表示を同時に使い、透明なフォーカス項目を残しません。\n- 目次は記事の実際の言語を使用し、長いタイトルは折り返しまたは横方向に表示します。内部に操作要素がある場合、コンテナへ重複した Tab 停止位置を追加しません。\n- 画像説明は表示中のキャプションが担当し、画像の alt は空にしてスクリーンリーダーの重複読み上げを防ぎます。\n\n## 統一点検\n\n記事リーダーは3つの主要モバイルサイズ、中国語・英語・日本語とフォールバック言語を対象にしました。リソース画面も3言語と短い横画面からの復帰を再確認します。ビルドゲートでは CSS 順序、初期画面の本文量、単一スクロール所有者、タッチサイズ、フォーカス挙動を継続して検証します。"
      }
    }, "2026-07-26T06:31:45.722Z"),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (
        'seed-update-2026-07-26-trust-safety-status',
        '2026-07-26-trust-safety-status',
        'site-updates',
        '["Games","Quick Transfer","reliability","security","UI"]',
        '', 'published', 0, 0,
        '2026-07-26T04:54:16.752Z',
        '2026-07-26T04:54:16.752Z',
        '2026-07-26T04:54:16.752Z'
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
    ...articleTranslationsStatements(env, "seed-update-2026-07-26-trust-safety-status", {
      zh: {
        title: "30 项功能与界面优化完成",
        summary: "完成云存档与互传安全、真实连接与恢复流程、搜索筛选、三语无障碍，以及资源和游戏卡片等 30 项可验证优化。",
        content_markdown: "# 30 项功能与界面优化完成\n\n本轮把功能可靠性、真实状态、搜索与筛选、三语无障碍和移动端卡片层级一起收口，并继续保持 Windows XP、Pixel Art 与 Y2K 桌面风格。\n\n## 云存档、互传与连接状态\n\n- 云存档写入加入 CAS 版本校验；冲突时暂停全部上传，并提供备份本地、恢复云端、保留本地覆盖云端和稍后决定。\n- 临时互传明确安全边界：文字使用浏览器端 AES-GCM；文件依靠 HTTPS、私有 R2 与服务端鉴权，不宣称口令端到端加密，也不提供病毒扫描。\n- 桌面托盘使用检测中、在线、服务降级和离线四种真实状态，严格校验数据库健康，并在后台暂停退避重试。\n\n## 恢复、搜索与筛选\n\n- 账号状态检查加入超时和原位重试；聊天室增加真实重连、手动重试，密码房切换防重复提交，历史读取失败不会误报进入成功。\n- 知识库搜索支持多关键词 AND 匹配，筛选和搜索会重置真实滚动位置与历史快照。\n- 视频与资源筛选重建后恢复键盘焦点；视频空分类把“显示全部”设为主操作，网站更新为次操作。\n\n## 三语与无障碍\n\n- 首屏会尽早同步页面语言；文章回退内容使用实际内容语言，移动语言按钮完整显示当前语言并播报下一语言。\n- 聊天密码错误、字数计数和互传口令说明都与对应控件关联；上传区域保留原生文件选择器，不再伪装成额外键盘按钮。\n\n## 资源与游戏卡片\n\n- 手机资源卡完整显示说明，把事实字段、标签和主操作分层，短横屏继续保持操作可见。\n- 游戏卡直接显示中、英、日支持情况，简介最多三行，更多信息使用 44px 原生展开控件；后台刷新失败时明确提示正在显示已缓存列表。"
      },
      en: {
        title: "30 Functional and UI Improvements Completed",
        summary: "Thirty verified improvements now cover cloud-save and transfer safety, truthful connection and recovery flows, search and filtering, trilingual accessibility, plus resource and game cards.",
        content_markdown: "# 30 Functional and UI Improvements Completed\n\nThis pass closes out functional reliability, truthful state, search and filtering, trilingual accessibility, and mobile card hierarchy while retaining the Windows XP, Pixel Art, and Y2K desktop style.\n\n## Cloud saves, transfer, and connection state\n\n- Cloud-save writes now use compare-and-swap version checks. A conflict pauses every upload path and offers local backup, restore cloud, keep local and overwrite cloud, or decide later.\n- Quick Transfer now states the real boundary: text uses browser-side AES-GCM; files rely on HTTPS, private R2 storage, and server authorization, with no passphrase end-to-end encryption or malware scanning claim.\n- The desktop tray uses four real states—checking, online, degraded, and offline—strictly verifies database health, and pauses backoff checks in the background.\n\n## Recovery, search, and filtering\n\n- Account checks have a timeout and in-place retry. Chat has truthful reconnect and manual retry, password-room switching is single-flight, and failed history never reports successful entry.\n- Knowledge search supports multi-token AND matching, while searches and filters reset the real scroll owner and history snapshot.\n- Video and resource filters restore keyboard focus after rebuilding. Empty video categories make Show all the primary action and site updates secondary.\n\n## Trilingual accessibility\n\n- The first paint applies the requested document language early. Fallback articles expose their actual content language, and the mobile language control shows the full current language while announcing the next one.\n- Chat password errors, character counts, and Transfer passphrase guidance are associated with their controls. The upload area keeps native file pickers instead of pretending to be another keyboard button.\n\n## Resource and game cards\n\n- Mobile resource cards show their full description and separate facts, tags, and the primary action; short landscape keeps the action visible.\n- Game cards expose Chinese, English, and Japanese support directly, allow three summary lines, and use a native 44px disclosure for secondary details. A failed background refresh clearly says the cached catalog is still on screen."
      },
      ja: {
        title: "機能・UI 改善 30 項目を完了",
        summary: "クラウド保存と転送の安全性、正確な接続・復旧、検索と絞り込み、3言語アクセシビリティ、リソースとゲームカードを含む検証可能な30項目を改善しました。",
        content_markdown: "# 機能・UI 改善 30 項目を完了\n\n機能の信頼性、正確な状態表示、検索と絞り込み、3言語アクセシビリティ、モバイルカードの階層をまとめて改善し、Windows XP、Pixel Art、Y2K のデスクトップ表現は維持しました。\n\n## クラウド保存・転送・接続状態\n\n- クラウド保存の書き込みに CAS 版照合を追加しました。競合時はすべてのアップロードを停止し、ローカルのバックアップ、クラウドの復元、ローカルを残して上書き、後で決める、を選べます。\n- 一時転送の境界を明記しました。テキストはブラウザー側 AES-GCM、ファイルは HTTPS・非公開 R2・サーバー認可で保護され、パスフレーズによる E2E 暗号化やマルウェア検査は行いません。\n- デスクトップトレイは確認中、オンライン、サービス低下、オフラインの4状態を実際に判定し、DB 健全性も確認。バックグラウンドでは再試行を停止します。\n\n## 復旧・検索・絞り込み\n\n- アカウント確認にタイムアウトとその場での再試行を追加。チャットは正確な再接続と手動再試行に対応し、パスワード部屋の切替は単一実行、履歴失敗時は入室成功と表示しません。\n- ナレッジ検索は複数語の AND 検索に対応し、検索・絞り込み時に実際のスクロール領域と履歴スナップショットを先頭へ戻します。\n- 動画とリソースの絞り込みは再描画後にキーボードフォーカスを復元。空の動画カテゴリでは「すべて表示」を主操作、サイト更新を副操作にしました。\n\n## 3言語アクセシビリティ\n\n- 初回描画で要求された文書言語を早めに適用し、フォールバック記事には実際の本文言語を設定。モバイル言語ボタンは現在の言語名を完全表示し、次の言語も読み上げます。\n- チャットのパスワードエラー、文字数、転送のパスフレーズ説明を各入力に関連付けました。アップロード領域は偽のキーボードボタンを持たず、標準のファイル選択を使います。\n\n## リソースとゲームカード\n\n- モバイルのリソースカードは説明を省略せず、事実情報・タグ・主操作を分離。短い横画面でも操作を表示します。\n- ゲームカードは中国語・英語・日本語対応を直接表示し、概要は3行、詳細は44pxの標準開閉操作に整理。バックグラウンド更新失敗時はキャッシュ済み一覧であることを明示します。"
      }
    }, "2026-07-26T04:54:16.752Z"),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (
        'seed-update-2026-07-21-desktop-taskbar-active',
        '2026-07-21-desktop-taskbar-active',
        'site-updates',
        '["UI","taskbar","desktop","accessibility"]',
        '', 'published', 0, 0,
        '2026-07-21T00:41:00.711Z',
        '2026-07-21T00:41:00.711Z',
        '2026-07-21T00:41:00.711Z'
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
    ...articleTranslationsStatements(env, "seed-update-2026-07-21-desktop-taskbar-active", {
      zh: {
        title: "桌面任务栏选中态降噪",
        summary: "移除 PC 端当前任务按钮的黄色底边、外描边和常亮光晕，保留蓝色按下层级与键盘焦点环；移动 Dock 不变。",
        content_markdown: "# 桌面任务栏选中态降噪\n\nPC 端底部任务栏的当前窗口按钮已移除黄色底边、黄色外描边与持续发光效果，让桌面更安静，也更贴近蓝色 Neo-XP 的窗口层级。\n\n## 调整内容\n\n- 当前任务继续使用蓝色按下背景、内凹边缘和清楚的文字对比，不会失去“当前窗口”识别。\n- 只有键盘操作触发的 focus-visible 焦点环继续保留，避免视觉降噪影响可访问性。\n- 移动端 Dock 的透明选中底板、滑动和触控范围完全不变。\n\n本次同步检查 Home 与 Knowledge 的桌面任务栏，并更新缓存版本，避免浏览器继续显示旧的黄色光晕。"
      },
      en: {
        title: "Desktop Taskbar Active-State Polish",
        summary: "The desktop active task button drops its yellow edge and persistent glow while retaining a blue pressed hierarchy and keyboard focus ring; the mobile Dock is unchanged.",
        content_markdown: "# Desktop Taskbar Active-State Polish\n\nThe active window button in the PC taskbar no longer uses a yellow bottom edge, yellow outer outline, or persistent glow. The desktop now reads more calmly while retaining its blue Neo-XP hierarchy.\n\n## What changed\n\n- The current task keeps its blue pressed background, inset edge, and clear text contrast, so the active window remains obvious.\n- The focus-visible ring still appears for keyboard navigation, preserving an explicit accessible focus indicator.\n- The mobile Dock selection surface, scrolling, and touch geometry are unchanged.\n\nHome and Knowledge were checked with the desktop taskbar, and the public cache version was advanced so browsers do not retain the old yellow glow."
      },
      ja: {
        title: "デスクトップタスクバーの選択表示調整",
        summary: "デスクトップの選択中タスクボタンから黄色の縁と常時グローを外し、青い押下階層とキーボードフォーカスリングを維持。モバイル Dock は変更しません。",
        content_markdown: "# デスクトップタスクバーの選択表示調整\n\nPC 版の下部タスクバーで、選択中ウィンドウのボタンに付いていた黄色の下線、外枠、常時グローを削除しました。青い Neo-XP の階層は維持しつつ、画面を落ち着かせています。\n\n## 変更内容\n\n- 現在のタスクは青い押下背景、内側の段差、十分な文字コントラストを保ち、選択中であることを明確に示します。\n- キーボード操作時の focus-visible リングは残し、アクセシブルなフォーカス表示を維持します。\n- モバイル Dock の選択面、横スクロール、タッチ領域は変更していません。\n\nHome と Knowledge のデスクトップタスクバーを確認し、古い黄色グローがキャッシュに残らないよう公開バージョンも更新しました。"
      }
    }, "2026-07-21T00:41:00.711Z"),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (
        'seed-update-2026-07-20-ui-motion-polish',
        '2026-07-20-ui-motion-polish',
        'site-updates',
        '["UI","motion","accessibility","mobile","Chat","Videos"]',
        '', 'published', 0, 0,
        '2026-07-20T14:53:30.199Z',
        '2026-07-20T14:53:30.199Z',
        '2026-07-20T14:53:30.199Z'
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
    ...articleTranslationsStatements(env, "seed-update-2026-07-20-ui-motion-polish", {
      zh: {
        title: "全站界面与动效精修",
        summary: "完成聊天短屏、视频卡片、知识库、资源区、欢迎窗口与移动 Dock 的系统化精修，并统一加载、错误、键盘焦点和减少动效体验。",
        content_markdown: "# 全站界面与动效精修\n\n本轮围绕美观度、UI 结构和动效反馈完成 30 项集中优化，继续保留 Windows XP、Pixel Art 与 Y2K 桌面语言。\n\n## 排版与布局\n\n- 聊天室在 1280×720、短竖屏和手机横屏中重新分配标题、房间切换、消息流与输入区空间，输入框和页脚不再被裁切。\n- 视频封面统一为真实 16:9，失败操作收进卡片；欢迎快捷入口、最近更新、知识库正文和资源元信息获得更清楚的层级与可读宽度。\n- 移动欢迎页只保留一个滚动容器，文章 Appbar 保留路由身份，Dock 字号、触控区和横屏排列同步校准。\n\n## 交互与状态\n\n- 视频封面改为原生按钮并支持键盘；加载、空状态与错误状态采用一致结构，重试后恢复焦点，慢速 iframe 也避免旧计时器覆盖新结果。\n- 禁用控件不再播放按压反馈，桌面 CTA 增加清楚的悬停状态，任务栏活动项、系统消息对比度和各路由强调色更容易辨认。\n\n## 动效与偏好\n\n- 最大化与还原改用真实前后几何差值，关闭与最小化反馈方向统一。\n- “减少动效”与“关闭动效”会同步停止 Dock 平滑移动、骨架循环和硬编码过渡；主题切换不再创建无效的整页快照。\n\n本轮同时复核首页与各 App 的桌面、窄竖屏、短屏和手机横屏组合，并保持中、英、日三语内容与 44px 触控边界。"
      },
      en: {
        title: "Site-wide UI and Motion Polish",
        summary: "Chat on short screens, video cards, Knowledge, Resources, the welcome window, and the mobile Dock are systematically refined, with unified loading, error, keyboard-focus, and reduced-motion behavior.",
        content_markdown: "# Site-wide UI and Motion Polish\n\nThis release completes 30 focused improvements across visual quality, UI structure, and motion feedback while retaining the Windows XP, Pixel Art, and Y2K desktop language.\n\n## Typography and layout\n\n- Chat now allocates title, room controls, message history, composer, and footer space correctly at 1280×720, short portrait screens, and mobile landscape, so the composer remains visible.\n- Video covers use a true 16:9 frame and failure actions stay inside each card. Welcome shortcuts, recent updates, Knowledge reading width, and Resources metadata now have clearer hierarchy.\n- Mobile Welcome keeps one scroll owner, article Appbars retain route identity, and Dock type, touch geometry, and landscape alignment are recalibrated.\n\n## Interaction and states\n\n- Video covers are native buttons with keyboard support. Loading, empty, and error states share one structure; retry restores focus, and stale iframe timers can no longer replace a newer result.\n- Disabled controls no longer animate as pressed. Desktop CTAs gain visible hover feedback, while active taskbar items, system-message contrast, and subtle route accents are easier to distinguish.\n\n## Motion preferences\n\n- Maximize and restore use real before-and-after geometry, with consistent close and minimize direction.\n- Reduced and off motion also stop Dock smoothing, skeleton loops, and hard-coded transitions. Theme changes no longer create a redundant full-page snapshot.\n\nThe pass rechecks Home and every App across desktop, narrow portrait, short-screen, and mobile-landscape layouts while preserving Chinese, English, and Japanese content and 44px touch targets."
      },
      ja: {
        title: "サイト全体の UI・モーション調整",
        summary: "短い画面のチャット、動画カード、ナレッジ、リソース、ウェルカム画面、モバイル Dock を整理し、読み込み・エラー・キーボードフォーカス・モーション低減の挙動も統一しました。",
        content_markdown: "# サイト全体の UI・モーション調整\n\nWindows XP、Pixel Art、Y2K のデスクトップ表現を維持しながら、見た目、UI 構造、モーションフィードバックを中心に 30 項目を改善しました。\n\n## 文字組みとレイアウト\n\n- 1280×720、短い縦画面、モバイル横画面のチャットで、タイトル、ルーム切替、履歴、入力欄、フッターの配分を調整し、入力欄が切れないようにしました。\n- 動画サムネイルを正しい 16:9 に統一し、失敗時の操作をカード内に整理。ウェルカムのショートカット、最近の更新、ナレッジ本文、リソースのメタ情報も読みやすくしました。\n- モバイルのウェルカムはスクロール領域を一つにし、記事 Appbar にはルート名を残しています。Dock の文字、タッチ領域、横画面配置も再調整しました。\n\n## 操作と状態表示\n\n- 動画サムネイルはキーボードで操作できる標準ボタンになりました。読み込み、空、エラー表示を統一し、再試行後のフォーカスを復元。古い iframe timer が新しい結果を上書きする競合も防ぎます。\n- 無効な操作には押下アニメーションを出さず、デスクトップ CTA の hover、タスクバーの選択状態、システムメッセージのコントラスト、各ルートの控えめな accent を明確にしました。\n\n## モーション設定\n\n- 最大化と復元は実際の前後座標を使い、閉じる・最小化の方向も統一しました。\n- モーション低減・停止時は Dock の滑らかな移動、スケルトンのループ、固定時間の transition も停止します。テーマ変更時の不要な全画面 snapshot も削除しました。\n\nHome と各 App をデスクトップ、狭い縦画面、短い画面、モバイル横画面で再確認し、中・英・日 3 言語と 44px のタッチ領域を維持しています。"
      }
    }, "2026-07-20T14:53:30.199Z"),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (
        'seed-update-2026-07-19-historical-video-thumbnail-cache',
        '2026-07-19-historical-video-thumbnail-cache',
        'site-updates',
        '["Videos","Bilibili","cache","ETag","reliability"]',
        '', 'published', 0, 0,
        '2026-07-19T11:56:27.825Z',
        '2026-07-19T11:56:27.825Z',
        '2026-07-19T11:56:27.825Z'
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
    ...articleTranslationsStatements(env, "seed-update-2026-07-19-historical-video-thumbnail-cache", {
      zh: {
        title: "历史视频封面缓存恢复",
        summary: "历史上传的 B 站封面并未丢失；公开视频 ETag 与封面代理地址现已完整版本化，旧浏览器会自动丢弃曾缓存的空封面，无需重新上传。",
        content_markdown: "# 历史视频封面缓存恢复\n\n历史 B 站视频的手动封面仍完整保存在数据库中，公开封面端点也能返回有效图片。本次修复针对旧浏览器仍显示空封面的缓存兼容问题。\n\n## 根因与恢复\n\n- 旧版 `/api/videos` 的 ETag 只根据视频行更新时间生成。封面解析逻辑更新后数据库没有变化，浏览器因此收到 304，并继续复用修复前的空封面响应。\n- 公开视频列表与单条详情的 ETag 现在根据完整公开响应生成，任何封面 URL、尺寸或分类表示变化都会得到新的缓存标识。\n- 本地上传封面的同源代理 URL 会携带视频更新时间版本；历史空缓存会立即失效，之后重新上传封面也不会继续看到旧图。\n\n## 验证\n\n线上 11 张历史 B 站封面逐一返回有效 JPEG，并在全新浏览器中正常显示。修复不修改或重新编码数据库中的原始封面，也不需要管理员再次上传。"
      },
      en: {
        title: "Historical Video Thumbnail Cache Recovery",
        summary: "Previously uploaded Bilibili covers were still intact; complete response ETags and versioned thumbnail proxy URLs now make existing browsers discard cached empty covers without requiring another upload.",
        content_markdown: "# Historical Video Thumbnail Cache Recovery\n\nThe manually uploaded covers for older Bilibili videos remain intact in the database, and every public thumbnail endpoint returns a valid image. This fix addresses cached empty covers in existing browsers.\n\n## Cause and recovery\n\n- The previous `/api/videos` ETag was derived only from video-row timestamps. When thumbnail interpretation changed without a database edit, browsers received 304 and reused the pre-fix response with empty cover fields.\n- Video-list and single-video ETags now derive from the complete public representation, so changes to cover URLs, dimensions, categories, or other public fields produce a new cache identity.\n- Same-origin proxy URLs for uploaded covers now carry the video update version. Historical empty caches are bypassed immediately, and later cover replacements cannot remain stuck on an older image.\n\n## Verification\n\nAll 11 historical Bilibili covers on the live site returned valid JPEG responses and rendered in a clean browser profile. The recovery neither rewrites the stored cover data nor requires another admin upload."
      },
      ja: {
        title: "過去の動画サムネイルキャッシュ復旧",
        summary: "以前アップロードした Bilibili サムネイルは失われていません。完全なレスポンス ETag とバージョン付きプロキシ URL により、既存ブラウザーもキャッシュ済みの空表示を破棄し、再アップロードなしで復旧します。",
        content_markdown: "# 過去の動画サムネイルキャッシュ復旧\n\n以前の Bilibili 動画に手動アップロードしたサムネイルはデータベースに残っており、公開サムネイル endpoint も有効な画像を返しています。今回は既存ブラウザーに残った空表示キャッシュを修正しました。\n\n## 原因と復旧\n\n- 旧 `/api/videos` の ETag は動画行の更新時刻だけから生成されていました。サムネイル解釈を修正しても DB 行が変わらないため、ブラウザーは 304 を受け取り、修正前の空サムネイル応答を再利用していました。\n- 動画一覧と単体動画の ETag は完全な公開レスポンスから生成するようになり、URL、寸法、分類などの公開表現が変われば新しいキャッシュ識別子になります。\n- アップロード済み画像の同一 origin プロキシ URL には動画更新版を付与します。過去の空キャッシュを直ちに回避し、今後サムネイルを差し替えた場合も古い画像に固定されません。\n\n## 検証\n\n本番サイトの過去の Bilibili サムネイル 11 枚がすべて有効な JPEG を返し、新規ブラウザープロファイルで表示されることを確認しました。保存済み画像の書き換えや管理画面からの再アップロードは不要です。"
      }
    }, "2026-07-19T11:56:27.825Z"),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (
        'seed-update-2026-07-19-content-experience-fixes',
        '2026-07-19-content-experience-fixes',
        'site-updates',
        '["Knowledge","Videos","Resources","Games","account","UI"]',
        '', 'published', 0, 0,
        '2026-07-19T04:04:44.666Z',
        '2026-07-19T04:04:44.666Z',
        '2026-07-19T04:04:44.666Z'
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
    ...articleTranslationsStatements(env, "seed-update-2026-07-19-content-experience-fixes", {
      zh: {
        title: "知识库、视频、图标与账号体验修复",
        summary: "网站更新日志全部取消置顶，知识库窗口只保留关闭键；恢复后台上传的 B 站封面并移除封面圆圈，替换临时互传和五款游戏的独立图标，同时修正登录、注册与登录后账号界面。",
        content_markdown: "# 知识库、视频、图标与账号体验修复\n\n本次修复集中处理知识库、视频、资源、游戏和账号入口中影响日常使用的显示问题。\n\n## 知识库\n\n- 已有的网站更新记录全部取消置顶，后台今后创建或修改 `site-updates` 时也会强制保持非置顶。前端同时忽略更新日志的旧置顶值，避免缓存数据重新露出置顶标记。\n- 知识库标题栏删除最小化和缩放／还原按钮，只保留真实可用的关闭操作。\n\n## 视频与图标\n\n- 公开视频接口现在接受后台上传流程实际会生成的最大 960×540 封面，同时继续限制文件为 320KB，B 站手动上传封面可以正常显示。\n- 视频卡片封面上的蓝色圆形覆盖层已移除。\n- 临时互传入口和五款游戏均换成图像生成的独立透明图标，不再复用通用图标或代码绘制几何图形。\n\n## 账号界面\n\n- 登录模式只显示邮箱和一次密码；确认密码只在注册模式出现。\n- 登录成功后完整隐藏登录／注册表单，只显示登录成功状态和退出账号按钮。"
      },
      en: {
        title: "Knowledge, Video, Icon, and Account Fixes",
        summary: "Site update logs are no longer pinned and the Knowledge window keeps only Close; uploaded Bilibili covers are restored, thumbnail circles removed, Quick Transfer and five games receive distinct icons, and account login, registration, and signed-in states are corrected.",
        content_markdown: "# Knowledge, Video, Icon, and Account Fixes\n\nThis release resolves visible daily-use issues across Knowledge, Videos, Resources, Games, and the account entry.\n\n## Knowledge\n\n- Every existing site update is unpinned. Future admin creates and edits in `site-updates` are also forced to remain unpinned, while the public list defensively ignores stale pinned values from cached data.\n- The Knowledge titlebar removes minimize and maximize/restore controls and keeps only the working Close action.\n\n## Video and icons\n\n- The public video API now accepts the 960×540 maximum generated by the admin upload flow while retaining the 320 KB byte limit, so manually uploaded Bilibili covers render again.\n- The blue circular overlay has been removed from video-card thumbnails.\n- Quick Transfer and all five games now use distinct generated transparent icons instead of shared generic art or code-drawn geometry.\n\n## Account interface\n\n- Login shows email and one password field; confirmation appears only during registration.\n- After sign-in, the complete login/registration form is hidden and only the signed-in success state and Log out action remain."
      },
      ja: {
        title: "ナレッジ・動画・アイコン・アカウントの修正",
        summary: "サイト更新ログの固定を解除し、ナレッジ画面は閉じる操作だけにしました。Bilibili のアップロード済みサムネイルを復旧し、円形表示を削除。一時転送と5ゲームに個別アイコンを追加し、ログイン・登録・ログイン後表示も修正しました。",
        content_markdown: "# ナレッジ・動画・アイコン・アカウントの修正\n\n今回は、ナレッジ、動画、リソース、ゲーム、アカウント入口で日常利用に影響する表示問題を修正しました。\n\n## ナレッジ\n\n- 既存のサイト更新をすべて固定解除しました。今後も管理画面で `site-updates` を作成・編集すると固定されず、公開一覧は古いキャッシュの固定値も無視します。\n- ナレッジのタイトルバーから最小化と最大化／復元を削除し、実際に動作する閉じる操作だけを残しました。\n\n## 動画とアイコン\n\n- 公開動画 API は管理画面のアップロード処理が生成する最大 960×540 を受け入れ、320KB の上限は維持します。手動アップロードした Bilibili サムネイルが再び表示されます。\n- 動画カードのサムネイル上にあった青い円形表示を削除しました。\n- 一時転送と5つのゲームは、共通アイコンやコード描画ではなく、それぞれ異なる生成済み透明アイコンを使用します。\n\n## アカウント画面\n\n- ログインはメールと1回のパスワードだけを表示し、確認用パスワードは登録時だけ表示します。\n- ログイン後はログイン／登録フォーム全体を隠し、ログイン成功表示とログアウト操作だけを残します。"
      }
    }, "2026-07-19T04:04:44.666Z"),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (
        'seed-update-2026-07-19-service-recovery',
        '2026-07-19-service-recovery',
        'site-updates',
        '["Knowledge","Japanese","Quick Transfer","reliability","QA"]',
        '', 'published', 0, 0,
        '2026-07-18T17:35:00.000Z',
        '2026-07-18T17:35:00.000Z',
        '2026-07-18T17:35:00.000Z'
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
        'seed-update-2026-07-18-resource-icons-layout',
        '2026-07-18-resource-icons-layout',
        'site-updates',
        '["Resources","Quick Transfer","UI","mobile","QA"]',
        '', 'published', 0, 0,
        '2026-07-18T15:35:00.000Z',
        '2026-07-18T15:35:00.000Z',
        '2026-07-18T15:35:00.000Z'
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
        'seed-update-2026-07-18-public-site-100-complete',
        '2026-07-18-public-site-100-complete',
        'site-updates',
        '["performance","UX","accessibility","mobile","security","QA"]',
        '', 'published', 0, 0,
        '2026-07-18T04:00:00.000Z',
        '2026-07-18T04:00:00.000Z',
        '2026-07-18T04:00:00.000Z'
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
        'seed-update-2026-07-18-reliable-forms-reading-chat',
        '2026-07-18-reliable-forms-reading-chat',
        'site-updates',
        '["account","reading","chat","privacy","accessibility","QA"]',
        '', 'published', 0, 0,
        '2026-07-18T00:26:00.000Z',
        '2026-07-18T00:26:00.000Z',
        '2026-07-18T00:26:00.000Z'
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
        'seed-update-2026-07-18-route-lazy-transfer',
        '2026-07-18-route-lazy-transfer',
        'site-updates',
        '["performance","lazy-loading","routes","transfer","UX","QA"]',
        '', 'published', 0, 0,
        '2026-07-17T23:35:00.000Z',
        '2026-07-17T23:35:00.000Z',
        '2026-07-17T23:35:00.000Z'
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
        'seed-update-2026-07-18-mobile-viewport-keyboard',
        '2026-07-18-mobile-viewport-keyboard',
        'site-updates',
        '["mobile","viewport","keyboard","focus","accessibility","QA"]',
        '', 'published', 0, 0,
        '2026-07-17T22:08:00.000Z',
        '2026-07-17T22:08:00.000Z',
        '2026-07-17T22:08:00.000Z'
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
        'seed-update-2026-07-18-mobile-scroll-recovery',
        '2026-07-18-mobile-scroll-recovery',
        'site-updates',
        '["mobile","scroll","focus","accessibility","QA"]',
        '', 'published', 0, 0,
        '2026-07-17T21:32:00.000Z',
        '2026-07-17T21:32:00.000Z',
        '2026-07-17T21:32:00.000Z'
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
        'seed-update-2026-07-18-frame-pipeline-low-performance',
        '2026-07-18-frame-pipeline-low-performance',
        'site-updates',
        '["performance","viewport","mobile","accessibility","QA"]',
        '', 'published', 0, 0,
        '2026-07-17T21:12:00.000Z',
        '2026-07-17T21:12:00.000Z',
        '2026-07-17T21:12:00.000Z'
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
        'seed-update-2026-07-18-route-lifecycle-mobile-css',
        '2026-07-18-route-lifecycle-mobile-css',
        'site-updates',
        '["performance","lifecycle","mobile","CSS","QA"]',
        '', 'published', 0, 0,
        '2026-07-17T20:48:00.000Z',
        '2026-07-17T20:48:00.000Z',
        '2026-07-17T20:48:00.000Z'
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
        'seed-update-2026-07-18-route-metadata-modal-focus',
        '2026-07-18-route-metadata-modal-focus',
        'site-updates',
        '["SEO","metadata","accessibility","dialog","navigation"]',
        '', 'published', 0, 0,
        '2026-07-17T20:22:00.000Z',
        '2026-07-17T20:22:00.000Z',
        '2026-07-17T20:22:00.000Z'
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
        'seed-update-2026-07-18-knowledge-history-restoration',
        '2026-07-18-knowledge-history-restoration',
        'site-updates',
        '["Knowledge","navigation","history","state","accessibility"]',
        '', 'published', 0, 0,
        '2026-07-17T20:01:00.000Z',
        '2026-07-17T20:01:00.000Z',
        '2026-07-17T20:01:00.000Z'
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
        'seed-update-2026-07-18-focus-popover-caret',
        '2026-07-18-focus-popover-caret',
        'site-updates',
        '["accessibility","navigation","account","Quick Transfer","UI"]',
        '', 'published', 0, 0,
        '2026-07-17T19:42:00.000Z',
        '2026-07-17T19:42:00.000Z',
        '2026-07-17T19:42:00.000Z'
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
        'seed-update-2026-07-18-theme-accessibility-foundation',
        '2026-07-18-theme-accessibility-foundation',
        'site-updates',
        '["performance","accessibility","theme","navigation","UI"]',
        '', 'published', 0, 0,
        '2026-07-17T18:53:00.000Z',
        '2026-07-17T18:53:00.000Z',
        '2026-07-17T18:53:00.000Z'
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
        'seed-update-2026-07-17-mobile-transfer-send-fix',
        '2026-07-17-mobile-transfer-send-fix',
        'site-updates',
        '["mobile","Knowledge","Quick Transfer","attachments","UI"]',
        '', 'published', 0, 0,
        '2026-07-16T18:45:00.000Z',
        '2026-07-16T18:45:00.000Z',
        '2026-07-16T18:45:00.000Z'
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
        'seed-update-2026-07-16-mobile-transfer-ui-polish',
        '2026-07-16-mobile-transfer-ui-polish',
        'site-updates',
        '["mobile","Quick Transfer","UI","accessibility"]',
        '', 'published', 0, 0,
        '2026-07-16T13:30:00.000Z',
        '2026-07-16T13:30:00.000Z',
        '2026-07-16T13:30:00.000Z'
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
        'seed-update-2026-07-16-quick-transfer',
        '2026-07-16-quick-transfer',
        'site-updates',
        '["Quick Transfer","R2","files","security"]',
        '', 'published', 0, 0,
        '2026-07-16T10:00:00.000Z',
        '2026-07-16T10:00:00.000Z',
        '2026-07-16T10:00:00.000Z'
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
        'seed-update-2026-07-14-japanese-subtext-retry-hotfix',
        '2026-07-14-japanese-subtext-retry-hotfix',
        'site-updates',
        '["Japanese","learning","accessibility","bugfix"]',
        '',
        'published',
        0,
        0,
        '2026-07-14T02:20:00.000Z',
        '2026-07-14T02:20:00.000Z',
        '2026-07-14T02:20:00.000Z'
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
        'seed-update-2026-07-11-japanese-subtext-trainer',
        '2026-07-11-japanese-subtext-trainer',
        'site-updates',
        '["Japanese","listening","learning","tools"]',
        '',
        'published',
        0,
        0,
        '2026-07-10T17:30:00.000Z',
        '2026-07-10T17:30:00.000Z',
        '2026-07-10T17:30:00.000Z'
      )
      on conflict(article_id) do update set
        slug = excluded.slug,
        category = excluded.category,
        tags = excluded.tags,
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
        'seed-update-2026-07-10-premium-interaction-mobile-os',
        '2026-07-10-premium-interaction-mobile-os',
        'site-updates',
        '["design","mobile","interaction","accessibility"]',
        '',
        'published',
        0,
        0,
        '2026-07-10T16:20:00.000Z',
        '2026-07-10T16:20:00.000Z',
        '2026-07-10T16:20:00.000Z'
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
        'seed-update-2026-07-06-private-chat-rooms',
        '2026-07-06-private-chat-rooms',
        'site-updates',
        '["网站更新","聊天室","隐私"]',
        '',
        'published',
        0,
        0,
        '2026-07-06T08:00:00.000Z',
        '2026-07-06T08:00:00.000Z',
        '2026-07-06T08:00:00.000Z'
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
      ) values (
        'seed-ai-agent-workflow-guide-2026-06-14',
        'ai-agent-workflow-guide',
        'ai',
        '["AI","Agent","Codex","经验"]',
        '',
        'published',
        0,
        0,
        '2026-06-14T15:00:00.000Z',
        '2026-06-14T15:00:00.000Z',
        '2026-06-14T15:00:00.000Z'
      )
      on conflict(article_id) do nothing
    `),
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values
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
      update articles
      set is_pinned = 0
      where article_id = ?
        and not exists (
          select 1
          from site_runtime_state
          where key = ?
        )
    `).bind(AI_AGENT_WORKFLOW_ARTICLE_ID, AI_AGENT_WORKFLOW_PIN_REPAIR_KEY),
    env.DB.prepare(`
      insert or ignore into site_runtime_state (key, value, updated_at)
      values (?, 'unpin-restored', ?)
    `).bind(AI_AGENT_WORKFLOW_PIN_REPAIR_KEY, AI_AGENT_WORKFLOW_PIN_REPAIR_TIME),
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
    env.DB.prepare(`
      insert into articles (
        article_id, slug, category, tags, cover_image, status, is_pinned,
        view_count, created_at, updated_at, published_at
      ) values (
        'seed-update-2026-06-18-game-cover-decoding',
        '2026-06-18-game-cover-decoding',
        'site-updates',
        '["网站更新","性能","游戏区","移动端"]',
        '',
        'published',
        0,
        0,
        '2026-06-17T17:38:00.000Z',
        '2026-06-17T17:38:00.000Z',
        '2026-06-17T17:38:00.000Z'
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
        'seed-update-2026-06-18-game-language-labels',
        '2026-06-18-game-language-labels',
        'site-updates',
        '["网站更新","多语言","游戏区","修复记录"]',
        '',
        'published',
        0,
        0,
        '2026-06-17T17:43:00.000Z',
        '2026-06-17T17:43:00.000Z',
        '2026-06-17T17:43:00.000Z'
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
        'seed-update-2026-06-18-game-shell-locale',
        '2026-06-18-game-shell-locale',
        'site-updates',
        '["网站更新","多语言","游戏区","云存档"]',
        '',
        'published',
        0,
        0,
        '2026-06-17T17:55:00.000Z',
        '2026-06-17T17:55:00.000Z',
        '2026-06-17T17:55:00.000Z'
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
        'seed-update-2026-06-18-resource-placeholder-hints',
        '2026-06-18-resource-placeholder-hints',
        'site-updates',
        '["网站更新","资源区","多语言","无障碍"]',
        '',
        'published',
        0,
        0,
        '2026-06-17T18:00:00.000Z',
        '2026-06-17T18:00:00.000Z',
        '2026-06-17T18:00:00.000Z'
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
        'seed-update-2026-06-18-video-thumb-decoding',
        '2026-06-18-video-thumb-decoding',
        'site-updates',
        '["网站更新","视频区","性能","图片"]',
        '',
        'published',
        0,
        0,
        '2026-06-17T18:07:00.000Z',
        '2026-06-17T18:07:00.000Z',
        '2026-06-17T18:07:00.000Z'
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
        'seed-update-2026-06-18-resource-label-sync',
        '2026-06-18-resource-label-sync',
        'site-updates',
        '["网站更新","资源区","多语言","界面"]',
        '',
        'published',
        0,
        0,
        '2026-06-17T18:10:00.000Z',
        '2026-06-17T18:10:00.000Z',
        '2026-06-17T18:10:00.000Z'
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
        'seed-update-2026-06-18-game-shell-safe-dom',
        '2026-06-18-game-shell-safe-dom',
        'site-updates',
        '["网站更新","游戏区","安全","云存档"]',
        '',
        'published',
        0,
        0,
        '2026-06-17T18:15:00.000Z',
        '2026-06-17T18:15:00.000Z',
        '2026-06-17T18:15:00.000Z'
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
        'seed-update-2026-06-18-account-safe-dom',
        '2026-06-18-account-safe-dom',
        'site-updates',
        '["网站更新","账号","安全","云存档"]',
        '',
        'published',
        0,
        0,
        '2026-06-17T18:20:00.000Z',
        '2026-06-17T18:20:00.000Z',
        '2026-06-17T18:20:00.000Z'
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
        'seed-update-2026-06-18-recent-update-icons',
        '2026-06-18-recent-update-icons',
        'site-updates',
        '["网站更新","首页","最近更新","界面"]',
        '',
        'published',
        0,
        0,
        '2026-06-17T18:25:00.000Z',
        '2026-06-17T18:25:00.000Z',
        '2026-06-17T18:25:00.000Z'
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
        'seed-update-2026-06-18-recent-updates-safe-dom',
        '2026-06-18-recent-updates-safe-dom',
        'site-updates',
        '["网站更新","首页","最近更新","安全"]',
        '',
        'published',
        0,
        0,
        '2026-06-17T18:40:00.000Z',
        '2026-06-17T18:40:00.000Z',
        '2026-06-17T18:40:00.000Z'
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
        'seed-update-2026-06-18-knowledge-list-safe-dom',
        '2026-06-18-knowledge-list-safe-dom',
        'site-updates',
        '["网站更新","知识库","安全","文章"]',
        '',
        'published',
        0,
        0,
        '2026-06-17T18:45:00.000Z',
        '2026-06-17T18:45:00.000Z',
        '2026-06-17T18:45:00.000Z'
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
        'seed-update-2026-06-18-knowledge-filters-safe-dom',
        '2026-06-18-knowledge-filters-safe-dom',
        'site-updates',
        '["网站更新","知识库","筛选","安全"]',
        '',
        'published',
        0,
        0,
        '2026-06-17T18:55:00.000Z',
        '2026-06-17T18:55:00.000Z',
        '2026-06-17T18:55:00.000Z'
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
        'seed-update-2026-06-18-resource-filters-safe-dom',
        '2026-06-18-resource-filters-safe-dom',
        'site-updates',
        '["网站更新","资源区","筛选","安全"]',
        '',
        'published',
        0,
        0,
        '2026-06-17T19:05:00.000Z',
        '2026-06-17T19:05:00.000Z',
        '2026-06-17T19:05:00.000Z'
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
        'seed-update-2026-06-18-game-list-safe-dom',
        '2026-06-18-game-list-safe-dom',
        'site-updates',
        '["网站更新","游戏区","安全","渲染"]',
        '',
        'published',
        0,
        0,
        '2026-06-17T19:20:00.000Z',
        '2026-06-17T19:20:00.000Z',
        '2026-06-17T19:20:00.000Z'
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
        'seed-update-2026-06-18-game-url-allowlist',
        '2026-06-18-game-url-allowlist',
        'site-updates',
        '["网站更新","游戏区","链接","安全"]',
        '',
        'published',
        0,
        0,
        '2026-06-17T19:35:00.000Z',
        '2026-06-17T19:35:00.000Z',
        '2026-06-17T19:35:00.000Z'
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
        'seed-update-2026-06-18-video-url-allowlist',
        '2026-06-18-video-url-allowlist',
        'site-updates',
        '["网站更新","视频区","链接","安全"]',
        '',
        'published',
        0,
        0,
        '2026-06-17T19:50:00.000Z',
        '2026-06-17T19:50:00.000Z',
        '2026-06-17T19:50:00.000Z'
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
        'seed-update-2026-06-18-resource-url-allowlist',
        '2026-06-18-resource-url-allowlist',
        'site-updates',
        '["网站更新","资源区","链接","安全"]',
        '',
        'published',
        0,
        0,
        '2026-06-17T20:05:00.000Z',
        '2026-06-17T20:05:00.000Z',
        '2026-06-17T20:05:00.000Z'
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
        'seed-update-2026-06-18-article-image-path-guard',
        '2026-06-18-article-image-path-guard',
        'site-updates',
        '["网站更新","知识库","图片","安全"]',
        '',
        'published',
        0,
        0,
        '2026-06-17T20:20:00.000Z',
        '2026-06-17T20:20:00.000Z',
        '2026-06-17T20:20:00.000Z'
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
        'seed-update-2026-06-18-resource-empty-state',
        '2026-06-18-resource-empty-state',
        'site-updates',
        '["网站更新","资源区","空状态","筛选"]',
        '',
        'published',
        0,
        0,
        '2026-06-17T23:58:00.000Z',
        '2026-06-17T23:58:00.000Z',
        '2026-06-17T23:58:00.000Z'
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
        'seed-update-2026-06-18-resource-filter-counts',
        '2026-06-18-resource-filter-counts',
        'site-updates',
        '["网站更新","资源区","筛选","数量"]',
        '',
        'published',
        0,
        0,
        '2026-06-17T23:55:00.000Z',
        '2026-06-17T23:55:00.000Z',
        '2026-06-17T23:55:00.000Z'
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
        'seed-update-2026-06-18-resource-status-badges',
        '2026-06-18-resource-status-badges',
        'site-updates',
        '["网站更新","资源区","状态","链接"]',
        '',
        'published',
        0,
        0,
        '2026-06-17T23:50:00.000Z',
        '2026-06-17T23:50:00.000Z',
        '2026-06-17T23:50:00.000Z'
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
        'seed-update-2026-06-18-game-info-badges',
        '2026-06-18-game-info-badges',
        'site-updates',
        '["网站更新","游戏区","云存档","源码"]',
        '',
        'published',
        0,
        0,
        '2026-06-17T23:35:00.000Z',
        '2026-06-17T23:35:00.000Z',
        '2026-06-17T23:35:00.000Z'
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
        'seed-update-2026-06-18-article-scroll-top',
        '2026-06-18-article-scroll-top',
        'site-updates',
        '["网站更新","知识库","阅读","导航"]',
        '',
        'published',
        0,
        0,
        '2026-06-17T23:20:00.000Z',
        '2026-06-17T23:20:00.000Z',
        '2026-06-17T23:20:00.000Z'
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
        'seed-update-2026-06-18-article-toc',
        '2026-06-18-article-toc',
        'site-updates',
        '["网站更新","知识库","目录","阅读"]',
        '',
        'published',
        0,
        0,
        '2026-06-17T23:05:00.000Z',
        '2026-06-17T23:05:00.000Z',
        '2026-06-17T23:05:00.000Z'
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
        'seed-update-2026-06-18-article-progress',
        '2026-06-18-article-progress',
        'site-updates',
        '["网站更新","知识库","阅读","进度"]',
        '',
        'published',
        0,
        0,
        '2026-06-17T22:50:00.000Z',
        '2026-06-17T22:50:00.000Z',
        '2026-06-17T22:50:00.000Z'
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
        'seed-update-2026-06-18-article-link-lang',
        '2026-06-18-article-link-lang',
        'site-updates',
        '["网站更新","链接","三语","知识库"]',
        '',
        'published',
        0,
        0,
        '2026-06-17T22:20:00.000Z',
        '2026-06-17T22:20:00.000Z',
        '2026-06-17T22:20:00.000Z'
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
        'seed-update-2026-06-18-recent-update-labels',
        '2026-06-18-recent-update-labels',
        'site-updates',
        '["网站更新","最近更新","可访问性","首页"]',
        '',
        'published',
        0,
        0,
        '2026-06-17T22:05:00.000Z',
        '2026-06-17T22:05:00.000Z',
        '2026-06-17T22:05:00.000Z'
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
        'seed-update-2026-06-18-static-image-dimensions',
        '2026-06-18-static-image-dimensions',
        'site-updates',
        '["网站更新","性能","图片","首页"]',
        '',
        'published',
        0,
        0,
        '2026-06-17T21:20:00.000Z',
        '2026-06-17T21:20:00.000Z',
        '2026-06-17T21:20:00.000Z'
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
        'seed-update-2026-06-18-article-tag-locales',
        '2026-06-18-article-tag-locales',
        'site-updates',
        '["网站更新","多语言","标签","知识库"]',
        '',
        'published',
        0,
        0,
        '2026-06-17T21:05:00.000Z',
        '2026-06-17T21:05:00.000Z',
        '2026-06-17T21:05:00.000Z'
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
        'seed-update-2026-06-18-game-frame-source-guard',
        '2026-06-18-game-frame-source-guard',
        'site-updates',
        '["网站更新","游戏区","安全","iframe"]',
        '',
        'published',
        0,
        0,
        '2026-06-17T20:50:00.000Z',
        '2026-06-17T20:50:00.000Z',
        '2026-06-17T20:50:00.000Z'
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
        'seed-update-2026-06-18-chat-nickname-locale',
        '2026-06-18-chat-nickname-locale',
        'site-updates',
        '["网站更新","聊天室","三语","体验"]',
        '',
        'published',
        0,
        0,
        '2026-06-17T20:35:00.000Z',
        '2026-06-17T20:35:00.000Z',
        '2026-06-17T20:35:00.000Z'
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
        'seed-update-2026-06-18-public-site-nightly-update',
        '2026-06-18-public-site-nightly-update',
        'site-updates',
        '["网站更新","主站优化","夜间汇总","阅读体验","资源区","游戏区"]',
        '',
        'published',
        0,
        0,
        '2026-06-18T00:00:00.000Z',
        '2026-06-18T00:00:00.000Z',
        '2026-06-18T00:00:00.000Z'
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
        'seed-update-2026-06-30-account-popover-layer-fix',
        '2026-06-30-account-popover-layer-fix',
        'site-updates',
        '["网站更新","账号","弹窗","层级修复"]',
        '',
        'published',
        0,
        0,
        '2026-06-30T08:00:00.000Z',
        '2026-06-30T08:00:00.000Z',
        '2026-06-30T08:00:00.000Z'
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
        'seed-update-2026-06-24-account-cleanup-merge-launch',
        '2026-06-24-account-cleanup-merge-launch',
        'site-updates',
        '["网站更新","账号","合并上线","发布流程"]',
        '',
        'published',
        0,
        0,
        '2026-06-24T08:00:00.000Z',
        '2026-06-24T08:00:00.000Z',
        '2026-06-24T08:00:00.000Z'
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
        'seed-update-2026-06-23-public-ux-accessibility-privacy-wrap-up',
        '2026-06-23-public-ux-accessibility-privacy-wrap-up',
        'site-updates',
        '["网站更新","公开体验","无障碍","隐私","按钮修复"]',
        '',
        'published',
        0,
        0,
        '2026-06-23T06:00:00.000Z',
        '2026-06-23T06:00:00.000Z',
        '2026-06-23T06:00:00.000Z'
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
        'seed-update-2026-06-22-fixed-dock-window-backdrops',
        '2026-06-22-fixed-dock-window-backdrops',
        'site-updates',
        '["网站更新","主端视觉","任务栏","四时段","窗口背景"]',
        '',
        'published',
        0,
        0,
        '2026-06-22T14:30:00.000Z',
        '2026-06-22T14:30:00.000Z',
        '2026-06-22T14:30:00.000Z'
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
        'seed-update-2026-06-22-about-contact-icons',
        '2026-06-22-about-contact-icons',
        'site-updates',
        '["网站更新","关于我","联系方式","社交图标","品牌图标"]',
        '',
        'published',
        0,
        0,
        '2026-06-22T00:00:00.000Z',
        '2026-06-22T00:00:00.000Z',
        '2026-06-22T00:00:00.000Z'
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
        'seed-update-2026-06-20-about-social-links',
        '2026-06-20-about-social-links',
        'site-updates',
        '["网站更新","关于我","社交链接","后台"]',
        '',
        'published',
        0,
        0,
        '2026-06-19T18:00:00.000Z',
        '2026-06-19T18:00:00.000Z',
        '2026-06-19T18:00:00.000Z'
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
        'seed-update-2026-06-19-immersive-time-chrome',
        '2026-06-19-immersive-time-chrome',
        'site-updates',
        '["网站更新","主端视觉","XP桌面","四时段","任务栏"]',
        '',
        'published',
        0,
        0,
        '2026-06-19T12:00:00.000Z',
        '2026-06-19T12:00:00.000Z',
        '2026-06-19T12:00:00.000Z'
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
        'seed-update-2026-06-19-main-discovery-wrap-up',
        '2026-06-19-main-discovery-wrap-up',
        'site-updates',
        '["网站更新","SEO","站点地图","PWA","循环汇总"]',
        '',
        'published',
        0,
        0,
        '2026-06-19T00:15:00.000Z',
        '2026-06-19T00:15:00.000Z',
        '2026-06-19T00:15:00.000Z'
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
        'seed-update-2026-06-18-main-visual-polish-cycle',
        '2026-06-18-main-visual-polish-cycle',
        'site-updates',
        '["网站更新","主端视觉","XP桌面","移动端","循环汇总"]',
        '',
        'published',
        0,
        0,
        '2026-06-18T11:30:00.000Z',
        '2026-06-18T11:30:00.000Z',
        '2026-06-18T11:30:00.000Z'
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
    ...articleTranslationsStatements(env, "seed-update-2026-07-19-service-recovery", {
      zh: {
        title: "知识库、日语与互传服务恢复",
        summary: "修复知识库文章种子中的无效 D1 参数，兼容 Cloudflare 无扩展名互传片段地址，并补齐本地预览隐私配置检查；日语工具、知识库与互传入口已重新联调。",
        content_markdown: "# 知识库、日语与互传服务恢复\n\n本次修复针对生产站与本地预览中叠加出现的服务异常，恢复知识库文章接口与资源区临时互传入口，并重新验证日语工具的静态资源和云端进度降级路径。\n\n## 知识库数据恢复\n\n- 修正一条三语网站更新 seed 漏传 UTC 时间戳的问题，避免 D1 收到 `undefined` 后让全部文章查询返回 500。\n- 新增全量 seed bind 回归测试，任何未来的未定义绑定参数都会在发布前直接失败。\n\n## 互传与本地预览恢复\n\n- Quick Transfer 继续只允许同源固定片段，但同时接受源文件 `.html` 路径和 Cloudflare clean URL 的无扩展名规范路径。\n- 本地 `.dev.vars` 必须具备两个独立、足够长度的隐私盐；健康检查会在 UI 验收前暴露缺失配置，秘密值不会进入仓库。\n\n## 验证范围\n\n回归覆盖中、英、日文章接口、资源区真实点击到互传登录门、日语课程目录与音频清单，并检查桌面和手机尺寸截图。匿名用户的互传登录提示与日语本地进度降级仍是设计行为。"
      },
      en: {
        title: "Knowledge, Japanese, and Transfer Service Recovery",
        summary: "An invalid D1 article-seed parameter is fixed, Quick Transfer now accepts Cloudflare's canonical extensionless fragment path, and local-preview privacy configuration is checked; Japanese, Knowledge, and Transfer flows are reverified together.",
        content_markdown: "# Knowledge, Japanese, and Transfer Service Recovery\n\nThis release addresses overlapping production and local-preview failures. It restores the Knowledge article API and the Resources Quick Transfer entry, then rechecks the Japanese tool's static assets and cloud-progress fallback.\n\n## Knowledge data recovery\n\n- A trilingual site-update seed now passes its missing UTC timestamp, preventing D1 from receiving `undefined` and failing every article query with HTTP 500.\n- A full seed-bind regression test now fails the release gate whenever any future binding argument is undefined.\n\n## Transfer and local-preview recovery\n\n- Quick Transfer remains restricted to a fixed same-origin fragment while accepting both the authored `.html` path and Cloudflare's extensionless clean-URL form.\n- Local `.dev.vars` must contain two independent, sufficiently long privacy salts. Health probing exposes missing configuration before UI review, while secret values stay outside Git.\n\n## Verification scope\n\nRegression coverage includes Chinese, English, and Japanese article APIs, a real Resources click into the Transfer sign-in gate, the Japanese course catalog and audio manifest, plus desktop and mobile screenshots. Anonymous Transfer sign-in prompts and Japanese local-progress fallback remain intentional behavior."
      },
      ja: {
        title: "ナレッジ・日本語・転送サービスの復旧",
        summary: "記事 seed の不正な D1 引数を修正し、Quick Transfer が Cloudflare の拡張子なし canonical fragment を受け入れるようにしました。ローカル preview の privacy 設定も補い、日本語・ナレッジ・転送を一括で再確認しています。",
        content_markdown: "# ナレッジ・日本語・転送サービスの復旧\n\n本リリースでは、本番環境とローカル preview で重なって発生した障害を修正しました。ナレッジの記事 API とリソース画面の Quick Transfer 入口を復旧し、日本語ツールの静的素材とクラウド進捗の fallback も再確認しています。\n\n## ナレッジデータの復旧\n\n- 3 言語のサイト更新 seed に不足していた UTC timestamp を渡し、D1 に `undefined` が bind されて全記事 query が HTTP 500 になる問題を防ぎました。\n- すべての seed bind を検査する回帰テストを追加し、今後未定義の引数があればリリース前に失敗します。\n\n## 転送とローカル preview の復旧\n\n- Quick Transfer は固定された同一 origin の fragment だけを許可しつつ、元の `.html` path と Cloudflare clean URL の拡張子なし canonical path の両方を受け入れます。\n- ローカル `.dev.vars` には、独立した十分な長さの privacy salt が 2 つ必要です。UI 確認前の health probe で不足を検出し、secret 値は Git に含めません。\n\n## 検証範囲\n\n中国語・英語・日本語の記事 API、リソースから転送ログイン画面までの実クリック、日本語 course catalog と audio manifest、デスクトップとモバイルの screenshot を確認します。匿名時の転送ログイン表示と日本語のローカル進捗 fallback は意図した動作です。"
      }
    }, "2026-07-18T17:35:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-07-18-resource-icons-layout", {
      zh: {
        title: "资源区图标与排版修复",
        summary: "修复临时互传整套图标的洋红底色，收紧资源卡片与互传登录布局，并保证关闭互传后准确恢复资源列表；安全、API 与数据边界不变。",
        content_markdown: `# 资源区图标与排版修复

本轮针对资源区中最明显的图标异常、卡片节奏和临时互传返回状态进行专项复查，继续沿用既有 Windows XP、Pixel Art 与 Y2K 视觉语言。

## 透明且可验证的图标资产

- 临时互传的原始素材是带洋红抠图底色的源图，不能直接缩放为生产图集。现在先完成柔和抠图与边缘去色，再生成 168×168 RGBA 透明图集。
- 16 个图标单元都加入透明角点与可见像素比例检查，避免只修入口图标而让房间、文件、图片或操作图标继续带紫色方块。
- 公开资源扫描未发现第二个同类运行时资产；洋红源图继续保留为构建输入，不作为页面资源引用。

## 更紧凑的资源与互传布局

- 桌面资源窗口收敛到与相邻 App 更协调的宽度，资源卡片按真实内容自然增高，不再用固定空白撑高；重复的“可获取”状态也从当前两张可用卡片中移除。
- 移动端去掉资源卡的强制高度，保留完整说明、元数据、标签与至少 44px 操作，并覆盖 359×500、375×667、390×844 和 844×390。
- 临时互传登录任务在可用区域内居中，窄屏不再重复显示标题图标。关闭互传时会恢复打开前的分类栏与列表可见状态，不再出现空分类条或列表闪失。

## 验证边界

精确 CDP 尺寸审计以中、英、日三语覆盖资源列表、互传登录和返回资源列表三个状态，并以 Home、Games 作为同壳参考；359×500、375×667、390×844、760×900、844×390 与 1280×720 共 58 个受控检查均通过。Headless 截图不等同真实设备或完整读屏器认证。本轮未连接生产数据，未 push，也未 deploy。`
      },
      en: {
        title: "Resources Icon and Layout Fixes",
        summary: "The magenta background across the Quick Transfer icon atlas is removed, Resources cards and the sign-in layout are tightened, and closing Transfer now restores the exact Resources list state; security, API, and data boundaries are unchanged.",
        content_markdown: `# Resources Icon and Layout Fixes

This pass focuses on the most visible Resources icon defect, card rhythm, and Quick Transfer return state while preserving the established Windows XP, Pixel Art, and Y2K visual language.

## Transparent, testable icon assets

- The original Quick Transfer artwork is a magenta-key source and must not be resized directly into the production atlas. It is now softly keyed and edge-despilled before generating a 168×168 RGBA transparent atlas.
- All 16 sprite cells have transparent-corner and visible-pixel-ratio checks, so fixing the entry icon cannot leave room, file, media, or action icons with purple blocks.
- A public asset sweep found no second affected runtime asset. The magenta source remains a build input and is not referenced by the page.

## Tighter Resources and Transfer layout

- The desktop Resources window now uses a width consistent with neighboring Apps, and cards grow from real content instead of fixed empty height. The redundant Available badge is removed from the two currently usable cards.
- Mobile cards no longer have forced height while retaining complete descriptions, metadata, tags, and actions of at least 44px across 359×500, 375×667, 390×844, and 844×390.
- The Quick Transfer sign-in task is centered in the usable area, and narrow screens no longer repeat the heading icon. Closing Transfer restores the exact category and list visibility that existed before opening, avoiding an empty category bar or list flash.

## Verification boundary

Exact CDP-size review covers the Resources list, Transfer sign-in, and returned Resources states in Chinese, English, and Japanese, with Home and Games used as same-shell references; all 58 controlled checks pass across 359×500, 375×667, 390×844, 760×900, 844×390, and 1280×720. Headless screenshots are not real-device or complete screen-reader certification. No production data was accessed, and nothing was pushed or deployed.`
      },
      ja: {
        title: "リソースのアイコンとレイアウト修正",
        summary: "一時転送のアイコン atlas 全体に残っていたマゼンタ背景を除去し、リソースカードとログイン画面を整理しました。転送を閉じるとリソース一覧の状態を正確に復元し、安全性、API、データ境界は変更していません。",
        content_markdown: `# リソースのアイコンとレイアウト修正

今回は、リソース画面で目立っていたアイコン異常、カードの間隔、一時転送から戻る際の状態を重点的に再確認しました。既存の Windows XP、Pixel Art、Y2K の表現は維持しています。

## 透明で検証可能なアイコン素材

- 一時転送の原画はマゼンタキー付きの素材であり、そのまま本番 atlas に縮小できません。現在はソフトなキー処理と輪郭の色除去を行ってから、168×168 の RGBA 透明 atlas を生成します。
- 16 個すべての sprite cell に透明な四隅と可視ピクセル比率の検査を追加し、入口だけを直してルーム、ファイル、メディア、操作アイコンに紫色の四角が残ることを防ぎます。
- 公開素材の走査では、同じ問題を持つ別の実行時素材は見つかりませんでした。マゼンタ原画はビルド入力としてのみ保持し、ページからは参照しません。

## 整理されたリソースと転送レイアウト

- デスクトップのリソースウィンドウを隣接 App と調和する幅にし、カードは固定された空白ではなく実際の内容に合わせて伸びます。現在利用可能な 2 枚のカードから重複する「利用可能」表示も外しました。
- モバイルカードの強制高さを廃止し、359×500、375×667、390×844、844×390 で説明、メタ情報、タグ、44px 以上の操作を維持します。
- 一時転送のログイン課題を利用可能領域の中央に置き、狭い画面では見出しアイコンを重複表示しません。転送を閉じると、開く前のカテゴリと一覧の表示状態を正確に復元し、空のカテゴリバーや一覧のちらつきを防ぎます。

## 検証範囲

正確な CDP サイズで、中国語・英語・日本語のリソース一覧、転送ログイン、リソースへ戻った状態を確認し、同じシェルの Home と Games も参照しました。359×500、375×667、390×844、760×900、844×390、1280×720 の計 58 件の制御済み検査はすべて成功しています。Headless のスクリーンショットは実機や完全なスクリーンリーダー認証ではありません。本番データへの接続、push、deploy は行っていません。`
      }
    }, "2026-07-18T15:35:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-07-18-public-site-100-complete", {
      zh: {
        title: "公开主站 100 项优化与稳定性复查完成",
        summary: "公开主站 100 项优化及稳定性复查已完成：修复冷启动 Chat 图标、短屏头像和移动 Dock 切换闪失，并以全动效中间帧、快速连续切换及竖横屏截图重新验证。",
        content_markdown: `# 公开主站 100 项优化与稳定性复查完成

公开主站的 UI、UX、动效、视觉、性能、响应式、无障碍、安全与发布质量 100 项计划已经完整收口，并继续保持 Windows XP、Pixel Art 与 Y2K 的既有身份。

## 更轻且可恢复

- 四时段壁纸、窗口背景、入口图标和 Quick Transfer 图集完成按槽位压缩，并提供响应式 AVIF / WebP 与可靠 fallback；首屏只预加载当前主题和当前壳。
- Knowledge、Videos、Games 与社交数据使用有界 ETag / SWR / last-known-good 缓存。短暂失败保留已成功内容，用户重试可绕过新鲜缓存。
- 生产构建提供内容哈希、白名单 manifest、可定位 sourcemap 与分层缓存策略，同时不改变根目录 Git 自动部署链。

## 核心流程与移动体验

- Home 欢迎、最近更新、桌面图标键盘导航、顶栏和 About 外链更清楚；Knowledge、文章、视频、资源、游戏与可选 Blog 的加载、空态、恢复、焦点和滚动路径统一。
- Chat 与 Quick Transfer 完成增量游标、单飞刷新、稳定 DOM、草稿保护、幂等、队列背压、取消/重试和旧 D1 安全迁移，并继续遵守 HttpOnly、纯文本渲染与隐私边界。
- 359×500、375×667、390×844、844×390 的中英日布局覆盖 App 高度、卡片包含、44px 触控、Dock、forced-colors、日文断行与四档动效。

## 稳定性复查补充

- Home 的 Chat 图标改由始终加载的主壳样式提供，聊天室标题栏与短屏头像统一使用真实 Chat 资产。
- 移动页面切换改为只动画当前 App 表面，不再让整页快照覆盖固定顶栏与 Dock；40ms 快速连续切换仍保持最终路由和选中状态一致。
- 在完整动效下采集切换前、起始、60ms、140ms 与稳定帧，并复拍 359×500、390×844、844×390 竖横屏布局。

## 验证边界

本地发布闸门覆盖自动化测试、公共模块图、静态构建检查、可复现生产构建、本地 D1 迁移和隔离 Headless UI 矩阵。Headless 结果不等同真实设备或完整读屏器认证；本轮未连接生产数据，未 push，也未 deploy。`
      },
      en: {
        title: "100 Public-Site Improvements and Stability Recheck",
        summary: "All 100 public-site improvements and the stability recheck are complete: cold-start Chat icons, short-screen avatars, and mobile Dock flicker are fixed and reverified with full-motion intermediate frames, rapid switching, and portrait/landscape screenshots.",
        content_markdown: `# 100 Public-Site Improvements and Stability Recheck

The 100-item public-site plan for UI, UX, motion, visuals, performance, responsive behavior, accessibility, security, and release quality is complete while preserving the established Windows XP, Pixel Art, and Y2K identity.

## Lighter and recoverable

- Four-time-period wallpapers, window backdrops, entry icons, and the Quick Transfer atlas are compressed for their real slots, with responsive AVIF / WebP and reliable fallbacks. The first view preloads only the current theme and shell.
- Knowledge, Videos, Games, and social data use bounded ETag / SWR / last-known-good caching. Temporary failures retain successful content, and an explicit retry bypasses fresh cache.
- The production build provides content hashes, an allowlisted manifest, traceable sourcemaps, and layered cache policy without replacing the repository-root Git deployment chain.

## Core flows and mobile experience

- Home welcome content, recent updates, desktop-icon keyboard navigation, top chrome, and About links are clearer. Knowledge, articles, videos, resources, games, and the optional Blog share consistent loading, empty, recovery, focus, and scroll behavior.
- Chat and Quick Transfer add incremental cursors, single-flight refresh, stable DOM updates, draft safety, idempotency, queue backpressure, cancel/retry, and safe legacy D1 migration while retaining HttpOnly, plain-text rendering, and privacy boundaries.
- The Chinese, English, and Japanese matrix at 359×500, 375×667, 390×844, and 844×390 covers App height, card containment, 44px targets, Dock behavior, forced colors, Japanese line breaking, and four motion tiers.

## Stability recheck addendum

- The Home Chat icon now belongs to the always-loaded shell stylesheet; the Chat titlebar and short-screen avatar use the real Chat asset consistently.
- Mobile page navigation animates only the active App surface, so a full-page snapshot can no longer cover the fixed topbar or Dock. A 40ms rapid double switch still settles on the correct final route and selected item.
- Full-motion evidence captures before, start, 60ms, 140ms, and stable frames, with additional portrait and landscape checks at 359×500, 390×844, and 844×390.

## Verification boundary

Local release gates cover automated tests, the public module graph, static build checks, reproducible production output, local D1 migration, and an isolated Headless UI matrix. Headless results are not real-device or complete screen-reader certification. No production data was accessed, and nothing was pushed or deployed.`
      },
      ja: {
        title: "公開サイト 100 項目の改善と安定性再確認",
        summary: "公開サイト 100 項目の改善と安定性再確認を完了しました。初回表示の Chat アイコン、短画面のアバター、モバイル Dock の切替時の消失を修正し、フルモーションの中間フレーム、連続切替、縦横画面のスクリーンショットで再検証しています。",
        content_markdown: `# 公開サイト 100 項目の改善と安定性再確認

UI、UX、モーション、ビジュアル、性能、レスポンシブ、アクセシビリティ、安全性、リリース品質に関する公開サイトの 100 項目を完了しました。既存の Windows XP、Pixel Art、Y2K の表現は維持しています。

## 軽量で復旧可能

- 4 時間帯の壁紙、ウィンドウ背景、入口アイコン、Quick Transfer atlas を実際の表示枠に合わせて圧縮し、レスポンシブ AVIF / WebP と確実な fallback を用意しました。初期表示は現在のテーマとシェルだけを先読みします。
- Knowledge、Videos、Games、ソーシャルデータは上限付き ETag / SWR / last-known-good キャッシュを使用します。一時的な失敗でも成功済み内容を保持し、明示的な再試行は新鮮なキャッシュを迂回します。
- 本番ビルドは内容ハッシュ、許可リスト manifest、追跡可能な sourcemap、階層別キャッシュ方針を提供し、リポジトリ直下の Git デプロイ経路は変更しません。

## 主要フローとモバイル体験

- Home の歓迎表示、最近の更新、デスクトップアイコンのキーボード操作、上部 UI、About リンクを整理しました。Knowledge、記事、動画、リソース、ゲーム、任意の Blog は読み込み、空状態、復旧、フォーカス、スクロールを統一しています。
- Chat と Quick Transfer は増分カーソル、単一通信、安定 DOM、下書き保護、冪等性、キュー制御、取消／再試行、旧 D1 の安全な移行を備え、HttpOnly、プレーンテキスト描画、プライバシー境界を維持します。
- 359×500、375×667、390×844、844×390 の中英日マトリクスで App 高さ、カード内包、44px 操作、Dock、forced-colors、日本語改行、4 段階モーションを確認します。

## 安定性再確認の追記

- Home の Chat アイコンを常時読み込むシェル用スタイルに移し、Chat のタイトルバーと短画面のアバターで実際の Chat 素材を統一して使用します。
- モバイルの画面遷移は現在の App 面だけをアニメーションし、全画面スナップショットが固定トップバーや Dock を覆わないようにしました。40ms 間隔の連続切替でも最終ルートと選択状態が一致します。
- フルモーションで切替前、開始、60ms、140ms、安定後のフレームを収集し、359×500、390×844、844×390 の縦横画面も再確認しました。

## 検証範囲

ローカルのリリースゲートは自動テスト、公開モジュールグラフ、静的ビルド検査、再現可能な本番成果物、ローカル D1 移行、分離 Headless UI マトリクスを対象にします。Headless の結果は実機や完全なスクリーンリーダー認証ではありません。本番データへの接続、push、deploy は行っていません。`
      }
    }, "2026-07-18T04:00:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-07-18-reliable-forms-reading-chat", {
      zh: {
        title: "账号、阅读与聊天可靠性升级",
        summary: "账号表单改为稳定 DOM 与明确登录/注册模式，文章只保留正文滚动并使用 4px 进度条；Chat 保留在途新草稿和私聊安全说明，公共隐私闸门同步加固。",
        content_markdown: "# 账号、阅读与聊天可靠性升级\n\n本轮集中修复公开主站中最容易造成输入丢失、内容遮挡和隐私回归的路径，同时延续 Windows XP、Pixel Art 与 Y2K 的既有界面语言。\n\n## 稳定且可恢复的账号流程\n\n- 账号表单现在只创建一次稳定 DOM。身份初始化、语言切换、模式切换、开关弹层和请求失败不会再重建字段或清空正在编辑的邮箱与密码。\n- 登录与注册成为明确模式，每种模式只有一个主提交动作；可见 label、正确 autocomplete、密码显示、注册确认与匹配校验均已补齐。\n- 字段错误、忙碌原因和退出失败会真实呈现并把焦点移到可恢复位置。Escape、外点与移动 44px 关闭入口都会把焦点归还触发源。\n- Quick Transfer 的未登录状态压缩为单一任务卡，登录后回到原 Transfer 上下文，不再重复表达门槛或使用含糊的红色关闭动作。\n\n## 不遮挡的文章与不丢草稿的 Chat\n\n- 文章阅读时 document 高度严格等于视口，正文详情成为唯一纵向滚动所有者；桌面与移动端的顶栏、任务栏和返回入口保持稳定。\n- 原先覆盖正文的阅读进度层改为窗口内状态，实际进度轨道为 4px、与正文零交叠，屏幕可见百分比和读屏数值误差不超过 2%。\n- Chat 发送期间只锁定提交按钮，输入框与软键盘继续可用；旧请求只会清空未被编辑过的原始草稿，不会删除用户在等待期间输入的新文字。\n- 359×500 下普通房日志保持 177px，私聊表单展开时保持至少 119px；口令用途、最短长度与风险说明通过 44px 折叠入口可达且不覆盖日志。\n\n## 隐私边界与验证\n\n公开 Chat 不再为旧消息回退暴露服务端隐藏访客标识。新增闸门同时约束安全 DOM、密码与草稿的存储/日志/遥测边界，以及外链、媒体、iframe 与 Transfer 片段白名单。当前 112/112 自动化测试、完整构建和 140/140 受控 Headless Chrome 审计均已通过；未访问生产数据，未 push，未 deploy。"
      },
      en: {
        title: "More Reliable Account, Reading, and Chat Flows",
        summary: "Account forms now keep a stable DOM with explicit sign-in and registration modes; articles use one content scroller and a 4px progress track; Chat preserves in-flight drafts and private-room safety guidance while public privacy gates are tightened.",
        content_markdown: "# More Reliable Account, Reading, and Chat Flows\n\nThis release fixes the public paths most likely to lose editing state, cover content, or regress privacy while retaining the site's established Windows XP, Pixel Art, and Y2K language.\n\n## Stable and recoverable account work\n\n- The account form now creates one stable DOM tree. Session initialization, language and mode changes, opening or closing the popover, and request failures no longer rebuild fields or clear an email or password being edited.\n- Sign-in and registration are explicit modes with one primary submit action each. Persistent labels, correct autocomplete values, password reveal controls, confirmation, and matching validation are included.\n- Field errors, busy reasons, and logout failures report the real state and move focus to a recoverable target. Escape, outside clicks, and the mobile 44px close action return focus to the originating control.\n- Quick Transfer reduces its signed-out gate to one task card and returns to the original Transfer context after sign-in, without duplicated instructions or an ambiguous red close action.\n\n## Unobstructed articles and draft-safe Chat\n\n- While reading, the document height exactly matches the viewport and the article detail is the only vertical scroll owner. Desktop and mobile chrome, taskbar, and return control stay stable.\n- The former content-covering progress overlay is now an in-window status with a 4px track and zero article overlap. Its visible percentage and screen-reader value stay within two percentage points.\n- During Chat sending, only the submit action is locked. The input and on-screen keyboard remain available, and an older request clears only an untouched submitted draft, never text entered while waiting.\n- At 359×500, the public-room log remains 177px and the private-room state remains at least 119px. Password purpose, minimum length, and risk guidance are reachable through a 44px disclosure without covering the log.\n\n## Privacy boundary and verification\n\nPublic Chat no longer falls back to a hidden server visitor identifier for legacy messages. New gates also lock safe DOM rendering, password and draft storage/logging/telemetry boundaries, and the narrow allowlists for links, media, iframes, and the Transfer fragment. All 112/112 automated tests, the complete build, and all 140/140 controlled Headless Chrome checks pass. No production data was accessed, and nothing was pushed or deployed."
      },
      ja: {
        title: "アカウント・閲覧・Chat の信頼性向上",
        summary: "アカウントフォームを安定 DOM と明確なログイン／登録モードに変更し、記事は一つの本文スクロールと 4px の進捗線を使用します。Chat は送信中の新しい下書きと非公開ルームの安全説明を保持し、公開プライバシー境界も強化しました。",
        content_markdown: "# アカウント・閲覧・Chat の信頼性向上\n\n今回の更新では、入力の消失、本文の遮蔽、プライバシー回帰が起きやすい公開経路を修正し、既存の Windows XP、Pixel Art、Y2K の表現を維持しました。\n\n## 安定して復旧できるアカウント操作\n\n- アカウントフォームは一度だけ安定した DOM を作成します。セッション初期化、言語・モード切替、ポップオーバーの開閉、通信失敗で編集中のメールやパスワードを再作成・消去しません。\n- ログインと登録を明確なモードに分け、各モードの主要送信操作を一つにしました。常時表示ラベル、適切な autocomplete、パスワード表示、登録確認、一致検証を備えます。\n- フィールドエラー、処理中の理由、ログアウト失敗を実状態のまま通知し、復旧可能な位置へフォーカスを移します。Escape、外側クリック、モバイルの 44px 閉じる操作は起点へフォーカスを返します。\n- Quick Transfer の未ログイン表示は一つのタスクカードに整理し、ログイン後は元の Transfer 文脈へ戻ります。重複説明や曖昧な赤い閉じる操作は使用しません。\n\n## 本文を隠さない記事と下書きを守る Chat\n\n- 記事閲覧中は document の高さをビューポートと一致させ、記事詳細だけを縦スクロール所有者にします。デスクトップとモバイルの上部 UI、タスクバー、戻る操作は安定します。\n- 本文を覆っていた進捗レイヤーをウィンドウ内の状態表示へ変更しました。実際の進捗線は 4px で本文との重なりはなく、表示値と読み上げ値の誤差は 2 ポイント以内です。\n- Chat の送信中は送信操作だけをロックし、入力欄と画面キーボードは使い続けられます。古い要求が消去できるのは未編集の送信済み下書きだけで、待機中に入力した新しい文章は失われません。\n- 359×500 では公開ルームのログを 177px、非公開ルームを 119px 以上に保ちます。パスワードの用途、最短長、危険性の説明は 44px の開閉操作から到達でき、ログを覆いません。\n\n## プライバシー境界と検証\n\n公開 Chat は古いメッセージでもサーバー内部の訪問者 ID へフォールバックしません。安全な DOM、パスワードと下書きの保存・ログ・テレメトリ境界、外部リンク、メディア、iframe、Transfer fragment の限定許可も自動検査で固定しました。112/112 の自動テスト、完全ビルド、140/140 の制御済み Headless Chrome 監査が成功しています。本番データへの接続、push、deploy は行っていません。"
      }
    }, "2026-07-18T00:26:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-07-18-route-lazy-transfer", {
      zh: {
        title: "路由与临时互传按需加载",
        summary: "Home 初始数据缩至约 8 KB 的五条更新摘要；五个业务路由与四份重样式首次进入时加载并复用，Quick Transfer 只在真实 CTA 点击后加载完整链路，失败可重试且离开不误初始化。",
        content_markdown: "# 路由与临时互传按需加载\n\n本轮把公开主站的非首屏业务与临时互传改为真正按需加载，同时保持 Windows XP、Pixel Art 与 Y2K 的视觉、三语界面和既有安全边界。\n\n## 更轻的 Home 与可复用路由\n\n- Home 初始数据只保留约 8 KB 的五条更新摘要，不再携带完整更新正文或未进入路由的业务数据。\n- Knowledge、Videos、Resources、Games 与 Chat 的 JavaScript 在首次进入对应路由时加载；Knowledge、Videos、Games 与 Chat 的四份重路由 CSS 同步按需加载。\n- 模块、样式和初始化承诺会被缓存并复用，返回已访问路由不会重复下载、重复初始化或产生闪烁。\n\n## 点击后才启动 Quick Transfer\n\n- Quick Transfer 的加载器、CSS、客户端、界面片段和 API 链路只在用户真实点击资源卡 CTA 后启动；点击前没有完整 DOM、轮询或 Transfer API 请求。\n- 首次加载保留 XP 风格进度与明确失败状态，失败后可以重试。若加载期间离开 Resources，竞态结果会被丢弃，不会在非活动路由初始化。\n- HttpOnly 会话、AES-GCM、上传与配额边界保持不变；访客内容仍使用安全 DOM API，三语文案完整保留。\n\n## 验证边界\n\n当前 97/97 自动化测试和完整构建已通过；Headless Chrome 精确视口与按需加载审计 137/137 通过。本批未访问生产数据，未 push，也未 deploy。"
      },
      en: {
        title: "On-Demand Routes and Quick Transfer",
        summary: "Home now starts with about 8 KB of five update summaries; five route modules and four heavy styles load once on first entry, while Quick Transfer loads its full chain only after a real CTA click with retry-safe, leave-safe initialization.",
        content_markdown: "# On-Demand Routes and Quick Transfer\n\nThis release moves non-Home work and Quick Transfer behind real demand boundaries while preserving the public site's Windows XP, Pixel Art, and Y2K visuals, trilingual interface, and existing security model.\n\n## A lighter Home and reusable routes\n\n- Home starts with only about 8 KB containing five update summaries. Full update bodies and unvisited route data are no longer part of its initial data.\n- JavaScript for Knowledge, Videos, Resources, Games, and Chat loads on the first entry to each route. Four heavy route styles for Knowledge, Videos, Games, and Chat load on the same demand boundary.\n- Module, style, and initialization promises are cached and reused, so returning to a visited route does not download or initialize it again and does not introduce a loading flicker.\n\n## Quick Transfer starts after a real click\n\n- The Quick Transfer loader, CSS, client, UI fragment, and API chain start only after the user actually clicks its resource-card CTA. Before that click there is no complete Transfer DOM, polling, or Transfer API request.\n- First load keeps an XP-style progress state and an explicit retryable failure state. If the user leaves Resources during loading, the stale result is discarded and cannot initialize on an inactive route.\n- HttpOnly sessions, AES-GCM, upload, and quota boundaries remain unchanged. Visitor content continues to use safe DOM APIs, and all three interface languages remain available.\n\n## Verification boundary\n\nAll 97/97 automated tests and the complete build pass, together with all 137/137 exact-viewport and demand-loading Headless Chrome audit checks. No production data was accessed, and nothing was pushed or deployed."
      },
      ja: {
        title: "ルートと一時転送のオンデマンド読込",
        summary: "Home の初期データを約 8 KB・5 件の更新要約に縮小し、5 つのルートモジュールと 4 つの重い CSS は初回進入時だけ読み込みます。一時転送は実際の CTA 操作後に全構成を読み込み、再試行と離脱競合にも対応します。",
        content_markdown: "# ルートと一時転送のオンデマンド読込\n\n今回の更新では、Home 以外の処理と一時転送を実際の利用時だけ読み込む構成に変更しました。公開サイトの Windows XP、Pixel Art、Y2K の表現、3 言語 UI、既存の安全境界は維持します。\n\n## 軽量な Home と再利用可能なルート\n\n- Home の初期データは約 8 KB、5 件の更新要約だけになり、更新の全文や未訪問ルートの業務データを含みません。\n- Knowledge、Videos、Resources、Games、Chat の JavaScript は各ルートへの初回進入時に読み込みます。Knowledge、Videos、Games、Chat の 4 つの重いルート CSS も同じ境界で読み込みます。\n- モジュール、スタイル、初期化 Promise をキャッシュして再利用するため、訪問済みルートへ戻っても再ダウンロード、重複初期化、読み込み時のちらつきは発生しません。\n\n## 実際のクリック後に一時転送を開始\n\n- 一時転送の loader、CSS、client、UI fragment、API 経路は、利用者がリソースカードの CTA を実際にクリックした後だけ開始します。クリック前には完全な Transfer DOM、ポーリング、Transfer API 通信はありません。\n- 初回読込には XP 形式の進捗表示と再試行可能な失敗状態があります。読込中に Resources から離れた場合、古い結果を破棄し、非アクティブルートでは初期化しません。\n- HttpOnly セッション、AES-GCM、アップロード、容量制限の境界は変更しません。訪問者データには安全な DOM API を使い続け、3 言語表示も維持します。\n\n## 検証範囲\n\n現在 97/97 の自動テストと完全ビルドが成功し、正確なビューポートとオンデマンド読込を検証する Headless Chrome 監査も 137/137 で成功しました。本番データにはアクセスせず、push と deploy も行っていません。"
      }
    }, "2026-07-17T23:35:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-07-18-mobile-viewport-keyboard", {
      zh: {
        title: "移动视口与软键盘统一避让",
        summary: "移动端现在统一处理安全区、地址栏收放、旋转、页面缩放与软键盘状态；Chat、账号、搜索和 Transfer 会在同一滚动容器内保持输入、提交与反馈可见。",
        content_markdown: "# 移动视口与软键盘统一避让\n\n本轮把公开主站移动壳的安全区、地址栏收放、旋转、页面缩放和软键盘避让收敛到唯一视口状态源，同时保留 Windows XP、Pixel Art 与 Y2K 的固定壳构图。\n\n## 一个视口状态源\n\n- FramePipeline 现在同时记录布局与可见视口宽高、偏移、页面缩放、方向、键盘状态，并区分 `stable`、`browser-ui`、`keyboard` 与 `zoom`。\n- 每个方向维护独立稳定高度基线；只有编辑控件聚焦且高度减少至少 96px 或 18% 时才进入键盘态。键盘关闭前会保持状态，恢复后布局与 Dock 自动回到用户原来的展开或折叠偏好。\n- 页面缩放使用布局视口尺寸并把键盘偏移保持为 0，避免把双指缩放误判成软键盘。统一 data 属性和 CSS 变量在同一写阶段提交。\n\n## 同一滚动所有者内的完整操作\n\n- Chat 输入、发送与反馈，私聊口令与进入动作，Knowledge 搜索、账号表单，以及 Transfer 房间入口和 composer 都按组合矩形测量。\n- 聚焦恢复只修改最近真实纵向滚动容器的 `scrollTop`，不会移动 document、Home、Appbar 或整站壳；键盘打开时 Dock 仅临时退出并释放占位。\n- 账号提交错误改为原地状态更新，保留邮箱、密码、焦点和键盘。Transfer 删除了自己的 viewport 订阅、几何恢复与 `scrollIntoView`，统一委托移动壳。\n\n## 验证边界\n\n受控 Headless Chrome 使用高度收缩、浏览器 UI 高度代理、方向往返、原生 page scale、safe-area 变量代理及 Dock 两种偏好验证状态、滚动所有者和控件可见性。它不等同真实 iOS / Android 软键盘、刘海安全区或浏览器地址栏认证，因此报告明确保留 `realSoftKeyboardTested:false`、`realSafeAreaTested:false` 和 `realBrowserChromeTested:false`。本批未连接生产数据，也未推送或部署。"
      },
      en: {
        title: "Unified Mobile Viewport and Keyboard Avoidance",
        summary: "Mobile safe areas, browser chrome, rotation, page zoom, and on-screen keyboard states now share one viewport model, keeping Chat, account, search, and Transfer controls visible inside one scroll owner.",
        content_markdown: "# Unified Mobile Viewport and Keyboard Avoidance\n\nThis release brings safe areas, browser chrome changes, rotation, page zoom, and on-screen keyboard avoidance into the public mobile shell's single viewport state source while preserving its fixed Windows XP, Pixel Art, and Y2K composition.\n\n## One viewport state source\n\n- FramePipeline now records layout and visual dimensions, offsets, page scale, orientation, and keyboard state, classifying each frame as `stable`, `browser-ui`, `keyboard`, or `zoom`.\n- Each orientation keeps its own stable-height baseline. Keyboard mode requires an editing control to have focus and a reduction of at least 96px or 18%. The state remains until height recovers, after which layout and the Dock return to the user's original expanded or collapsed preference.\n- Page zoom uses layout viewport dimensions and keeps keyboard offset at zero, so pinch zoom is not mistaken for an on-screen keyboard. Shared data attributes and CSS variables commit in the same write phase.\n\n## Complete actions inside one scroll owner\n\n- Chat input, send, and feedback; private-room password and enter action; Knowledge search; account forms; and Transfer room entry and composer are measured as contextual groups.\n- Focus recovery mutates only the nearest real vertical owner's `scrollTop`. It never moves the document, Home, App bar, or whole site shell. While the keyboard is open, the Dock temporarily leaves view and releases its reserved space.\n- Account submission errors now update status in place, preserving email, password, focus, and keyboard. Transfer removed its private viewport subscription, geometry recovery, and `scrollIntoView`, delegating to the mobile shell instead.\n\n## Verification boundary\n\nControlled Headless Chrome uses height contraction, a browser-UI height proxy, orientation round trips, native page scale, safe-area variable proxies, and both Dock preferences to verify state, scroll ownership, and control visibility. This is not certification on real iOS or Android keyboards, notches, or browser chrome, so the report explicitly keeps `realSoftKeyboardTested:false`, `realSafeAreaTested:false`, and `realBrowserChromeTested:false`. No production data is accessed, and nothing is pushed or deployed."
      },
      ja: {
        title: "モバイルビューポートとキーボード回避の統合",
        summary: "モバイルのセーフエリア、ブラウザー UI、回転、ページ拡大、画面キーボードを一つのビューポートモデルで扱い、Chat、アカウント、検索、Transfer の操作を同じスクロール領域内で表示します。",
        content_markdown: "# モバイルビューポートとキーボード回避の統合\n\n今回の更新では、公開サイトの固定モバイルシェルを維持したまま、セーフエリア、ブラウザー UI の伸縮、回転、ページ拡大、画面キーボード回避を一つのビューポート状態源に統合しました。Windows XP、Pixel Art、Y2K の構図は保持します。\n\n## 一つのビューポート状態源\n\n- FramePipeline はレイアウトと表示ビューポートの寸法、オフセット、ページ倍率、向き、キーボード状態を記録し、`stable`、`browser-ui`、`keyboard`、`zoom` を区別します。\n- 縦向きと横向きは別々の安定高さ基準を持ちます。編集操作にフォーカスがあり、高さが 96px または 18% 以上減った場合だけキーボード状態になります。高さが戻るまで状態を保持し、復元後はレイアウトと Dock が利用者の元の展開・折りたたみ設定へ戻ります。\n- ページ拡大時はレイアウトビューポートを使い、キーボードオフセットを 0 に保つため、ピンチズームを画面キーボードと誤判定しません。共通 data 属性と CSS 変数は同じ書き込み段階で反映されます。\n\n## 同じスクロール所有者内で操作を表示\n\n- Chat の入力・送信・フィードバック、非公開ルームのパスワードと入室操作、Knowledge 検索、アカウントフォーム、Transfer のルーム入口と composer を操作単位の矩形として測定します。\n- フォーカス復元は最寄りの実際の縦スクロール所有者の `scrollTop` だけを変更します。document、Home、App バー、サイト全体は移動しません。キーボード表示中は Dock だけが一時的に退避し、予約領域を解放します。\n- アカウント送信エラーはその場で状態だけを更新し、メール、パスワード、フォーカス、キーボードを保持します。Transfer の独自 viewport 購読、形状復元、`scrollIntoView` は削除し、モバイルシェルへ統一しました。\n\n## 検証範囲\n\n制御した Headless Chrome で、高さ縮小、ブラウザー UI 高さの代理、画面方向の往復、ネイティブ page scale、safe-area 変数の代理、Dock の二つの設定を確認します。実機 iOS / Android のキーボード、ノッチ、ブラウザー UI の認証ではないため、レポートは `realSoftKeyboardTested:false`、`realSafeAreaTested:false`、`realBrowserChromeTested:false` を明示します。本番データには接続せず、push や deploy も行っていません。"
      }
    }, "2026-07-17T22:08:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-07-18-mobile-scroll-recovery", {
      zh: {
        title: "移动固定壳的滚动与焦点恢复",
        summary: "移动 App 内容增长或可见高度受限时，会保留真实纵向滚动逃生路径；聚焦控件由统一帧管线滚入最近内容容器，同时不移动 Home、顶栏或 Dock。",
        content_markdown: "# 移动固定壳的滚动与焦点恢复\n\n本轮为公开主站的固定移动壳补齐内容增长与受限高度下的恢复路径，同时保留 Home 固定桌面构图、顶部 Appbar 和底部 Dock。\n\n## 真实滚动所有者\n\n- 非 Home 的活动 App 窗口现在提供休眠式纵向溢出兜底；只有内部内容确实增长时才成为可用滚动路径，默认视口和布局尺寸不变。\n- Knowledge、Videos、Resources、Games、Blog、About 与 Chat 的既有内部滚动区域允许在到达边界后把剩余滚动交给活动窗口。文章阅读态继续由正文详情独占滚动，避免重新出现双重滚动。\n- Quick Transfer 的登录、房间入口与房间内容沿用自身安全流程，只补齐纵向滚动链和聚焦留白，不改变会话、加密或上传协议。\n\n## 焦点恢复\n\n- 移动 App 的 `focusin` 会通过唯一帧管线测量最近一个真正可滚动的祖先和当前可见高度，再只写入该容器的 `scrollTop`。\n- Home 仅允许账号浮层参与这条恢复路径；普通 Home 构图、页面文档、Appbar 和 Dock 都不会被焦点恢复移动。\n- Transfer 继续使用自己的聚焦恢复逻辑，不建立第二套原生 VisualViewport 监听。\n\n## 验证边界\n\n受控 Headless Chrome 以内容增长、390×500 受限高度、2 倍页面缩放以及既有精确视口验证真实滚动所有者、焦点可见性、文档滚动为 0 与默认构图不回归。该测试不模拟真实 iOS / Android 屏幕软键盘；完整地址栏、安全区、旋转和键盘避让继续由后续专项处理。本批未连接生产数据，也未发布或部署。"
      },
      en: {
        title: "Mobile Fixed-Shell Scroll and Focus Recovery",
        summary: "Growing mobile App content and constrained viewports now retain a real vertical escape path, while the frame pipeline reveals focused controls inside the nearest content scroller without moving Home, the App bar, or the Dock.",
        content_markdown: "# Mobile Fixed-Shell Scroll and Focus Recovery\n\nThis release gives the public mobile fixed shell a recovery path for growing content and constrained height while preserving the fixed Home desktop composition, top App bar, and bottom Dock.\n\n## Real scroll ownership\n\n- The active non-Home App window now has a dormant vertical overflow fallback. It becomes a usable path only when its content truly grows, so default viewport geometry and layout dimensions remain unchanged.\n- Existing internal scrollers in Knowledge, Videos, Resources, Games, Blog, About, and Chat can hand remaining movement to the active window at their boundary. Article reading keeps the detail body as its exclusive scroll owner, preventing nested scrolling from returning.\n- Quick Transfer login, room entry, and room content retain their existing security flow. Only vertical chaining and focus padding change; session, encryption, and upload protocols do not.\n\n## Focus recovery\n\n- A mobile App `focusin` is measured through the single frame pipeline. It finds the nearest genuinely scrollable ancestor and the current visible height, then mutates only that container's `scrollTop`.\n- On Home, only the account popover may use this recovery path. The normal Home composition, document, App bar, and Dock are never moved by focus recovery.\n- Transfer continues to use its own focused-control recovery without creating a second native VisualViewport listener.\n\n## Verification boundary\n\nControlled Headless Chrome exercises growing content, a constrained 390×500 viewport, native 2× page scale, and the established exact viewport matrix. It verifies the real scroll owner, focused-control visibility, a zero document scroll position, and unchanged default composition. This does not emulate a real iOS or Android on-screen keyboard; complete address-bar, safe-area, rotation, and keyboard avoidance remain a follow-up. No production data, release, or deployment is involved."
      },
      ja: {
        title: "モバイル固定シェルのスクロールとフォーカス復元",
        summary: "モバイル App の内容増加や表示高さの制限時にも実際の縦スクロール経路を維持し、統合フレーム処理が Home、App バー、Dock を動かさず最寄りのコンテンツ領域へフォーカス中の操作を表示します。",
        content_markdown: "# モバイル固定シェルのスクロールとフォーカス復元\n\n今回の更新では、公開サイトの固定モバイルシェルに、内容増加と高さ制限時の復元経路を追加しました。Home の固定デスクトップ構図、上部 App バー、下部 Dock は維持します。\n\n## 実際のスクロール所有者\n\n- Home 以外のアクティブ App ウィンドウに、待機状態の縦オーバーフロー代替経路を追加しました。実際に内容が増えた時だけ有効になり、通常のビューポート形状とレイアウト寸法は変わりません。\n- Knowledge、Videos、Resources、Games、Blog、About、Chat の既存内部スクローラーは、端に達した後の移動をアクティブウィンドウへ渡せます。記事閲覧中は本文詳細を唯一のスクロール所有者とし、二重スクロールの再発を防ぎます。\n- Quick Transfer のログイン、ルーム入口、ルーム内容は既存の安全性フローを維持します。縦方向の連鎖とフォーカス余白だけを変更し、セッション、暗号化、アップロード方式は変更しません。\n\n## フォーカス復元\n\n- モバイル App の `focusin` は唯一のフレームパイプラインで計測されます。実際にスクロール可能な最寄りの祖先と現在の可視高さを取得し、そのコンテナの `scrollTop` だけを更新します。\n- Home ではアカウントポップオーバーだけがこの復元経路を使用できます。通常の Home 構図、ドキュメント、App バー、Dock はフォーカス復元で移動しません。\n- Transfer は 2 組目のネイティブ VisualViewport リスナーを作らず、独自のフォーカス中コントロール復元を維持します。\n\n## 検証範囲\n\n制御された Headless Chrome で、内容増加、390×500 の高さ制限、ネイティブ 2 倍ページ倍率、既存の正確なビューポート行列を確認します。実際のスクロール所有者、フォーカス中操作の可視性、ドキュメントのスクロール位置 0、通常構図の非回帰を検証します。この自動化は実際の iOS / Android 画面キーボードを再現しません。完全なアドレスバー、セーフエリア、回転、キーボード回避は後続の専門作業で扱います。本番データへの接続、公開、デプロイは行っていません。"
      }
    }, "2026-07-17T21:32:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-07-18-frame-pipeline-low-performance", {
      zh: {
        title: "统一帧管线与低性能绘制档",
        summary: "窗口、可视视口与关键滚动测量现在由同一帧管线统一先读后写；Save-Data 和明确低配设备会启用清晰的实色低性能绘制档。",
        content_markdown: "# 统一帧管线与低性能绘制档\n\n本轮把公开主站分散的窗口、VisualViewport 与关键滚动工作收敛到一个可审计的单帧调度器，同时为节省流量和明确低配设备提供不牺牲功能与对比度的绘制降级。\n\n## 单帧先读后写\n\n- `mobile-shell.js` 现在是窗口 resize、VisualViewport resize 与 scroll 的唯一原生监听者；同一事件风暴中的同键任务只保留最后一次，并在一帧内先完成全部布局读取，再完成全部样式写入。\n- Home 壁纸舞台与桌面图标几何、Knowledge 文章进度与目录、移动 Dock、动效层和 Quick Transfer 聚焦控件都接入同一管线；离开路由会退订对应任务。\n- 视口宽高、键盘偏移和 Dock 选中面在同一帧提交。原生页面缩放比例不为 1 时，缩小的 VisualViewport 不会被误判成软键盘。\n- 构建守卫会拒绝主脚本重新增加第二套原生 viewport 监听，并检查主消费者继续遵守 keyed measure/mutate 契约。\n\n## 清晰的低性能绘制档\n\n- 浏览器启用 Save-Data，或明确报告不超过 2 个逻辑核心 / 2GiB 设备内存时进入 `low`；能力未知的设备保持 `normal`，不会被猜测性降级。\n- `low` 关闭大面积 blur、backdrop-filter、壁纸 filter、循环云层、常驻 `will-change` 与全页 View Transition，并为顶部栏、任务栏、Dock、账户层和模态遮罩提供实色高对比回退。\n- `normal` 档的 XP、Pixel Art、Y2K 壁纸、玻璃层次和交互保持不变；小图标阴影与短暂 transform/opacity 反馈继续保留。\n\n## 验证边界\n\n受控 Headless Chrome 通过 117 项检查：40 组同帧事件只产生一次读阶段与一次写阶段，390×844 / 844×390 的视口变量和 Dock 几何一致，原生 2 倍页面缩放的键盘偏移为 0，Save-Data、2 核与未知能力三种档位判定正确，低性能截图无大面积滤镜残留且文字与控件清楚。该自动化没有模拟或声称验证真实 iOS / Android 屏幕软键盘；本批未连接生产数据，也未发布或部署。"
      },
      en: {
        title: "Unified Frame Pipeline and Low-Performance Paint Tier",
        summary: "Window, VisualViewport, and key scroll measurements now share one read-then-write frame pipeline, with a clear solid-surface tier for Save-Data and confirmed low-end devices.",
        content_markdown: "# Unified Frame Pipeline and Low-Performance Paint Tier\n\nThis release consolidates scattered window, VisualViewport, and key scroll work into one auditable frame scheduler, while giving data-saving and confirmed low-end devices a paint fallback that preserves function and contrast.\n\n## Read once, then write once per frame\n\n- `mobile-shell.js` is now the only native listener for window resize plus VisualViewport resize and scroll. Repeated requests for the same key within an event storm keep the latest job, all layout reads run first, and all style writes follow in the same frame.\n- The Home wallpaper stage and desktop-icon geometry, Knowledge reading progress and table of contents, mobile Dock, motion layer, and focused Quick Transfer control use the same pipeline. Route exits unsubscribe their related jobs.\n- Viewport dimensions, keyboard offset, and the Dock selection surface commit together. When native page scale differs from 1, the smaller VisualViewport is not misclassified as an on-screen keyboard.\n- Build guards reject a second native viewport listener in public scripts and verify that primary consumers retain the keyed measure/mutate contract.\n\n## A clear low-performance paint tier\n\n- `low` activates when Save-Data is enabled or the browser explicitly reports no more than 2 logical cores or 2 GiB of device memory. Devices with unknown capability remain `normal` instead of receiving a guessed downgrade.\n- The low tier removes large blur, backdrop filters, wallpaper filters, looping clouds, permanent `will-change`, and full-page View Transitions. Solid high-contrast fallbacks cover the top bar, taskbar, Dock, account layer, and modal backdrop.\n- The normal tier keeps the XP, Pixel Art, and Y2K wallpaper, glass depth, and interactions unchanged. Small icon shadows and short transform/opacity feedback remain available.\n\n## Verification boundary\n\nControlled Headless Chrome passes 117 checks: 40 same-frame event groups produce one read and one write phase; 390×844 and 844×390 viewport variables match final Dock geometry; native 2× page scale yields zero keyboard offset; Save-Data, two-core, and unknown-capability profiles select the correct tier; and the low-tier screenshot retains clear text and controls without large paint effects. This automation does not emulate or claim validation of a real iOS or Android on-screen keyboard. No production data, release, or deployment is involved."
      },
      ja: {
        title: "統合フレームパイプラインと低性能描画モード",
        summary: "Window、VisualViewport、主要スクロール計測を 1 つの読み取り・書き込みフレームへ統合し、Save-Data と明確な低性能端末には判読しやすい単色描画モードを適用します。",
        content_markdown: "# 統合フレームパイプラインと低性能描画モード\n\n今回の更新では、分散していた Window、VisualViewport、主要スクロール処理を監査可能な 1 つのフレームスケジューラへ統合し、通信量を節約する設定と明確な低性能端末に、機能とコントラストを維持した描画フォールバックを追加しました。\n\n## 1 フレームで先に読み取り、後で書き込み\n\n- `mobile-shell.js` が window resize、VisualViewport resize、scroll の唯一のネイティブリスナーになりました。同じイベント集中内の同一キーは最新ジョブだけを残し、すべてのレイアウト読み取り後に、同じフレームですべてのスタイル書き込みを行います。\n- Home の壁紙ステージとデスクトップアイコン形状、Knowledge の読書進捗と目次、モバイル Dock、モーション層、Quick Transfer のフォーカス中コントロールが同じパイプラインを使用します。ルート終了時には関連ジョブを解除します。\n- ビューポート寸法、キーボードオフセット、Dock 選択面を同じフレームで反映します。ネイティブページ倍率が 1 以外の時は、縮小した VisualViewport を画面キーボードと誤判定しません。\n- ビルドガードは公開スクリプトへの 2 組目のネイティブ viewport リスナーを拒否し、主要利用箇所の keyed measure/mutate 契約を確認します。\n\n## 判読しやすい低性能描画モード\n\n- Save-Data が有効、またはブラウザが論理コア 2 以下 / 端末メモリ 2GiB 以下を明示した場合に `low` を有効にします。能力が不明な端末は推測で低下させず `normal` を維持します。\n- `low` では大きな blur、backdrop-filter、壁紙 filter、雲のループ、常駐 `will-change`、全画面 View Transition を停止し、トップバー、タスクバー、Dock、アカウント層、モーダル背景へ高コントラストの単色フォールバックを適用します。\n- `normal` の XP、Pixel Art、Y2K 壁紙、ガラスの奥行き、操作感は変更しません。小さなアイコン影と短い transform/opacity フィードバックは維持します。\n\n## 検証範囲\n\n制御された Headless Chrome で 117 項目が成功しました。40 組の同一フレームイベントは読み取り 1 回・書き込み 1 回に統合され、390×844 / 844×390 のビューポート変数と Dock 形状が一致し、ネイティブ 2 倍ページ倍率ではキーボードオフセットが 0 になり、Save-Data、2 コア、能力不明の各プロファイルが正しいモードを選択します。低性能スクリーンショットにも大面積描画効果の残留はなく、文字と操作は明瞭です。この自動化は実際の iOS / Android 画面キーボードを再現したものではなく、その検証を主張しません。本番データへの接続、公開、デプロイは行っていません。"
      }
    }, "2026-07-17T21:12:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-07-18-route-lifecycle-mobile-css", {
      zh: {
        title: "路由生命周期与移动样式权威源",
        summary: "八个主路由现在显式进入与离开：非活动页会中止请求、定时器和临时监听；移动响应式布局也收敛到单一 CSS 权威文件并由构建守卫防止冲突回归。",
        content_markdown: "# 路由生命周期与移动样式权威源\n\n本轮补齐公开主站的路由资源生命周期，并把分散的移动响应式布局收敛到唯一权威文件，为后续懒加载、视口协调和软键盘避让建立可验证基础。\n\n## 路由资源按需启停\n\n- Home、Knowledge、Videos、Resources、Games、Blog、Chat 与 About 都使用显式 `enter/leave` 作用域。每次进入只创建一套监听、定时器、动画帧和 `AbortController`，同一路由重复导航不会再次绑定。\n- 离开 Knowledge、Videos、Games 或 About 时会中止尚未完成的列表请求；Home 不再提前读取这些隐藏路由的数据。返回目标路由时会重新建立干净作用域。\n- Chat 只在活动且可见时轮询；离开或页面隐藏后不保留后台定时器。Quick Transfer 的事件、轮询、请求、XHR 与重试等待也跟随 Resources 生命周期清理。\n- 移动壳和动效层继续作为全站基础设施运行，但会接收统一的路由进入/离开通知，并清理只属于旧路由的临时帧与状态。\n\n## 移动 CSS 单一权威源\n\n- 原先散落在 `style.css` 尾部的响应式媒体规则按原顺序迁入 `mobile-ios-shell.css`，选择器、声明和值保持不变，因此 XP、Pixel Art 与 Y2K 构图不被重画。\n- 动效样式中的移动层级越权被限定到桌面壳；移动关键组件的高度、溢出、定位、布局和层级现在只允许由移动壳文件定义。\n- 构建检查会解析三份主 CSS，逐条报告跨文件重复或越权的移动关键布局属性，防止以后用更高优先级补丁重新制造冲突。\n\n## 验证\n\n受控 Headless Chrome 在 1280×720 与 390×844 连续遍历八个路由，验证同路由不重复绑定、延迟请求在离开时被中止、Chat 与 Transfer 资源归零；完整三语语义、元信息、模态、历史、Caret 和精确视口截图共通过 110 项检查。该自动化验证不连接生产数据，也未执行发布或部署。"
      },
      en: {
        title: "Route Lifecycle and Mobile CSS Ownership",
        summary: "All eight routes now enter and leave explicitly, aborting inactive requests, timers, and temporary listeners; responsive mobile layout also has one guarded CSS owner.",
        content_markdown: "# Route Lifecycle and Mobile CSS Ownership\n\nThis release adds an explicit resource lifecycle to every public route and consolidates responsive mobile layout under one authoritative stylesheet, creating a testable base for later lazy loading, viewport coordination, and keyboard avoidance.\n\n## Route resources start and stop on demand\n\n- Home, Knowledge, Videos, Resources, Games, Blog, Chat, and About use explicit `enter/leave` scopes. Each entry creates one set of listeners, timers, animation frames, and an `AbortController`; navigating to the same route does not bind them again.\n- Leaving Knowledge, Videos, Games, or About aborts unfinished list requests. Home no longer preloads those hidden-route datasets, and a clean scope is created when the route is opened again.\n- Chat polls only while active and visible, leaving no background timer after a route exit or hidden page. Quick Transfer events, polling, requests, XHR, and retry waits are likewise cleared with the Resources lifecycle.\n- The mobile shell and motion layer remain global site infrastructure, but now receive consistent route enter and leave notifications and discard route-specific transient frames and state.\n\n## One owner for mobile CSS\n\n- Responsive media rules formerly scattered at the end of `style.css` moved, in the same order, into `mobile-ios-shell.css`. Selectors, declarations, and values are unchanged, so the XP, Pixel Art, and Y2K composition is not redesigned.\n- Mobile stacking overrides in the motion sheet are constrained to the desktop shell. Height, overflow, positioning, layout, and stacking for critical mobile components now belong only to the mobile shell stylesheet.\n- The build check parses all three primary stylesheets and reports every duplicate or out-of-bound critical mobile layout declaration, preventing future specificity patches from recreating the conflict.\n\n## Verification\n\nControlled Headless Chrome traverses all eight routes at 1280×720 and 390×844, checking same-route idempotence, delayed-request aborts, and zero inactive Chat and Transfer resources. The complete trilingual semantics, metadata, modal, history, caret, and exact-viewport suite passes 110 checks. No production data, release, or deployment is involved."
      },
      ja: {
        title: "ルートライフサイクルとモバイル CSS の一元管理",
        summary: "8 つの主要ルートに明示的な開始・終了処理を設け、非表示ページの通信、タイマー、一時リスナーを停止しました。モバイルレイアウトも 1 つの CSS 管理元へ統合しています。",
        content_markdown: "# ルートライフサイクルとモバイル CSS の一元管理\n\n今回の更新では、公開サイトの各ルートに明示的なリソースライフサイクルを追加し、分散していたレスポンシブなモバイルレイアウトを 1 つのスタイルシートへ統合しました。今後の遅延読み込み、ビューポート調整、キーボード回避を検証できる基盤になります。\n\n## ルートごとにリソースを開始・終了\n\n- Home、Knowledge、Videos、Resources、Games、Blog、Chat、About は明示的な `enter/leave` スコープを使います。開始時にリスナー、タイマー、アニメーションフレーム、`AbortController` を 1 組だけ作り、同じルートへの再ナビゲーションでは重複登録しません。\n- Knowledge、Videos、Games、About を離れると未完了の一覧通信を中止します。Home は非表示ルートのデータを先読みせず、再び開いた時に新しいスコープを作ります。\n- Chat は表示中のアクティブルートだけでポーリングし、離脱またはページ非表示後にタイマーを残しません。Quick Transfer のイベント、ポーリング、通信、XHR、再試行待機も Resources の終了時に解放します。\n- モバイルシェルとモーション層はサイト全体の基盤として維持しつつ、共通の開始・終了通知を受け取り、旧ルートだけに属する一時フレームと状態を破棄します。\n\n## モバイル CSS の管理元を 1 つに統一\n\n- `style.css` 末尾に分散していたレスポンシブ規則を、元の順序のまま `mobile-ios-shell.css` へ移しました。セレクター、宣言、値は変えていないため、XP、Pixel Art、Y2K の構図を作り直していません。\n- モーション用スタイルのモバイル階層上書きをデスクトップシェルへ限定しました。重要なモバイル部品の高さ、オーバーフロー、配置、レイアウト、重なり順はモバイルシェルだけが管理します。\n- ビルドチェックは 3 つの主要 CSS を解析し、重複または管理範囲外の重要レイアウト宣言を項目ごとに報告します。優先度の高い後付け規則で競合が再発することを防ぎます。\n\n## 検証\n\n制御された Headless Chrome で 1280×720 と 390×844 の全 8 ルートを連続移動し、同一ルートの重複登録防止、遅延通信の中止、非アクティブな Chat と Transfer のリソース解放を確認しました。3 言語の意味構造、メタデータ、モーダル、履歴、キャレット、正確なビューポートを含む全 110 項目が成功しています。本番データへの接続、公開、デプロイは行っていません。"
      }
    }, "2026-07-17T20:48:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-07-18-route-metadata-modal-focus", {
      zh: {
        title: "三语路由分享信息与模态焦点隔离",
        summary: "八个主路由与文章详情现在同步独立三语标题、描述、canonical、OG 和 Twitter 信息；欢迎窗与视频窗会隔离背景、圈定焦点并可靠归还触发源。",
        content_markdown: "# 三语路由分享信息与模态焦点隔离\n\n本轮完成路由级分享信息和两个公开模态窗口的键盘隔离，让地址、语言、页面语义与焦点生命周期保持一致。\n\n## 路由与文章元信息\n\n- Home、Knowledge、Videos、Resources、Games、Blog、Chat 与 About 都有独立三语标题、描述、canonical、Open Graph 与 Twitter 信息。\n- 临时壁纸、欢迎窗和审计参数不会进入 canonical；文章始终使用正式 `/articles/<slug>?lang=<lang>` 地址。\n- 文章安全封面会替换分享图并清除未知尺寸，离开文章后立即恢复目标栏目的网站类型、默认图片与尺寸，不残留旧文章标题、简介或封面。\n\n## 欢迎窗与视频窗\n\n- 模态打开时，skip link 与整个站点壳使用原生 `inert` 隔离；若两个模态异常重叠，只保留最上层可交互。\n- Tab 与 Shift+Tab 在对话框内循环，Escape 关闭；完整动效结束前背景继续隔离，减少动态或关闭动效时立即完成。\n- 视频卡显式记录真实点击按钮，关闭后优先归还该触发源；触发源失效时回到当前模态或路由稳定标题。手机关闭入口继续保持至少 44×44px。\n\n## 验证边界\n\n受控 Headless Chrome 在三语八路由、三语文章和桌面/短竖屏/标准竖屏/横屏模态场景共执行 108 项检查。运行时 Hash 元信息可保持浏览器状态一致，但不等同独立路径 SSR 或社交抓取器预渲染。"
      },
      en: {
        title: "Trilingual Route Metadata and Modal Focus Isolation",
        summary: "All eight routes and article details now synchronize distinct trilingual title, description, canonical, Open Graph, and Twitter data, while welcome and video dialogs isolate background focus.",
        content_markdown: "# Trilingual Route Metadata and Modal Focus Isolation\n\nThis release completes route-level sharing data and keyboard isolation for the two public modal windows, keeping addresses, language, semantics, and focus lifecycles aligned.\n\n## Route and article metadata\n\n- Home, Knowledge, Videos, Resources, Games, Blog, Chat, and About now expose distinct trilingual titles, descriptions, canonicals, Open Graph fields, and Twitter fields.\n- Temporary wallpaper, welcome, and audit parameters never enter canonical URLs. Articles always use `/articles/<slug>?lang=<lang>`.\n- A safe article cover replaces the share image and clears unknown dimensions. Leaving an article immediately restores the target route's website type, default image, and dimensions without retaining the old title, summary, or cover.\n\n## Welcome and video dialogs\n\n- While a modal is open, native `inert` isolates both the skip link and the complete site shell. If two modals overlap unexpectedly, only the top surface remains interactive.\n- Tab and Shift+Tab wrap inside the dialog, and Escape closes it. The background stays isolated through the full close animation, while reduced or disabled motion commits immediately.\n- Video cards pass the exact clicked button as the return target. Closing restores that trigger first, with the active modal or stable route heading as fallback. Mobile Close remains at least 44 by 44 pixels.\n\n## Verification boundary\n\nControlled Headless Chrome runs 108 checks across all eight routes in three languages, trilingual article metadata, and desktop, short portrait, standard portrait, and landscape modal scenarios. Runtime hash metadata keeps browser state coherent but is not equivalent to independent-path SSR or social-crawler prerendering."
      },
      ja: {
        title: "3 言語ルートメタデータとモーダルフォーカス分離",
        summary: "8 つの主要ルートと記事詳細で 3 言語のタイトル、説明、canonical、OG、Twitter 情報を同期し、ウェルカムと動画ダイアログは背景を分離してフォーカスを確実に戻します。",
        content_markdown: "# 3 言語ルートメタデータとモーダルフォーカス分離\n\n今回の更新では、ルート単位の共有情報と 2 つの公開モーダルのキーボード分離を完成させ、URL、言語、意味構造、フォーカスのライフサイクルを一致させました。\n\n## ルートと記事のメタデータ\n\n- Home、Knowledge、Videos、Resources、Games、Blog、Chat、About に、それぞれ異なる 3 言語のタイトル、説明、canonical、Open Graph、Twitter 情報を設定します。\n- 一時的な壁紙、ウェルカム、監査パラメータは canonical に含めません。記事は常に `/articles/<slug>?lang=<lang>` を使用します。\n- 安全な記事カバーは共有画像へ反映し、不明な寸法を消去します。記事を離れると、古いタイトル、概要、カバーを残さず、移動先ルートの website 種別、既定画像、寸法を復元します。\n\n## ウェルカムと動画ダイアログ\n\n- モーダル表示中は、ネイティブ `inert` で本文スキップとサイトシェル全体を分離します。2 つが予期せず重なった場合も、最上位だけを操作可能にします。\n- Tab と Shift+Tab はダイアログ内を循環し、Escape で閉じます。通常動作では閉じるアニメーション完了まで背景を分離し、動きを減らす設定または動作オフでは即座に完了します。\n- 動画カードは実際に押したボタンを戻り先として渡します。閉じるとそのトリガーを優先し、利用できない場合は表示中のモーダルまたはルートの安定した見出しへ戻します。モバイルの閉じる操作は 44×44px 以上を維持します。\n\n## 検証範囲\n\n制御された Headless Chrome で、3 言語の 8 ルート、3 言語の記事メタデータ、デスクトップ、短い縦画面、標準縦画面、横画面のモーダルを含む 108 項目を確認しました。実行時の Hash メタデータはブラウザ状態を一致させますが、独立パスの SSR やソーシャルクローラー向け事前描画と同等ではありません。"
      }
    }, "2026-07-17T20:22:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-07-18-knowledge-history-restoration", {
      zh: {
        title: "知识库列表与文章历史状态恢复",
        summary: "从筛选或搜索结果打开文章后，返回与前进会恢复原分类、搜索词、列表位置和文章阅读位置；直链返回默认知识库，并保持稳定焦点。",
        content_markdown: "# 知识库列表与文章历史状态恢复\n\n本轮让知识库的文章列表、详情和浏览器历史成为一条可预测、可恢复的导航路径。\n\n## 列表与文章往返\n\n- 从分类或 Unicode 搜索结果打开文章前，当前分类、搜索词和列表滚动位置会写入当前历史条目。\n- 返回列表后会恢复完整上下文；浏览器前进可再次打开同一篇文章，并恢复详情阅读位置。\n- 站内返回只回到来源列表，不额外创建重复历史条目。\n\n## 直链与安全回退\n\n- 直接访问 `/articles/<slug>` 时，返回操作会在当前条目中进入默认 Knowledge，不会把访客带离站点。\n- 未知版本、错误路由或异常滚动值会按当前 URL 重新建立安全默认状态，同时保留其他代码写入的根级 History 字段。\n- 搜索词只保存在浏览器 History 状态，不写进 URL；账号、Chat 草稿、互传口令和内容不会进入该状态。\n\n## 焦点与验证\n\n列表和详情恢复完成后，焦点只落在对应稳定标题且不会自动聚焦搜索框。桌面与手机无头审计覆盖站内返回、浏览器 Back / Forward、直链和损坏状态，共 99 项检查通过。"
      },
      en: {
        title: "Knowledge List and Article History Restoration",
        summary: "Back and Forward now restore the Knowledge category, search term, list position, and article reading position, while direct links return safely to the default Knowledge view.",
        content_markdown: "# Knowledge List and Article History Restoration\n\nThis release makes the Knowledge list, article detail, and browser history a predictable and recoverable navigation path.\n\n## List and article round trips\n\n- Before an article opens from a category or Unicode search result, the active category, search term, and list scroll position are stored in the current history entry.\n- Returning restores that complete context. Browser Forward reopens the same article and restores its reading position.\n- The in-app Back action returns to the source entry without creating a duplicate history item.\n\n## Direct links and safe fallback\n\n- When `/articles/<slug>` is opened directly, Back replaces the current entry with the default Knowledge view instead of taking the visitor away from the site.\n- Unknown versions, mismatched routes, and invalid scroll values are rebuilt from the current URL with safe defaults while unrelated root-level History fields are preserved.\n- Search terms stay in browser History rather than the URL. Account data, Chat drafts, Quick Transfer passphrases, and content are never stored there.\n\n## Focus and verification\n\nAfter list or detail restoration, focus moves once to the matching stable heading and never selects the search field automatically. Desktop and mobile headless audits cover in-app Back, browser Back and Forward, direct links, and malformed state, with all 99 checks passing."
      },
      ja: {
        title: "ナレッジ一覧と記事の履歴状態を復元",
        summary: "絞り込みや検索結果から記事を開いた後、戻る・進むで分類、検索語、一覧位置、記事の読書位置を復元し、直リンクは既定のナレッジへ安全に戻ります。",
        content_markdown: "# ナレッジ一覧と記事の履歴状態を復元\n\n今回の更新で、ナレッジ一覧、記事詳細、ブラウザ履歴を予測可能で復元できる移動経路にしました。\n\n## 一覧と記事の往復\n\n- 分類または Unicode 検索結果から記事を開く前に、現在の分類、検索語、一覧のスクロール位置を履歴エントリへ保存します。\n- 一覧へ戻ると文脈を完全に復元し、ブラウザの進む操作で同じ記事と読書位置を再表示します。\n- 画面内の戻る操作は元の一覧エントリへ戻り、重複する履歴を作りません。\n\n## 直リンクと安全なフォールバック\n\n- `/articles/<slug>` を直接開いた場合、戻る操作は訪問者をサイト外へ送らず、現在のエントリを既定の Knowledge 表示へ置き換えます。\n- 未知の版、URL と一致しないルート、不正なスクロール値は現在の URL から安全な既定値で再構築し、他のコードが持つルート階層の History フィールドは保持します。\n- 検索語は URL ではなくブラウザ履歴だけに保存します。アカウント情報、Chat 下書き、一時転送の合言葉や内容は保存しません。\n\n## フォーカスと検証\n\n一覧または詳細の復元後、フォーカスは対応する安定した見出しへ 1 回だけ移り、検索欄を自動選択しません。デスクトップとモバイルのヘッドレス監査で画面内の戻る、ブラウザの戻る・進む、直リンク、壊れた状態を確認し、99 項目すべてに合格しました。"
      }
    }, "2026-07-17T20:01:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-07-18-focus-popover-caret", {
      zh: {
        title: "路由焦点、账号浮层与输入光标修复",
        summary: "统一 8 个路由、文章详情/列表与历史导航的稳定标题焦点，补全账号非模态浮层语义和关闭归还，并恢复临时互传密码与输入区的可见光标；安全、API 与 D1 不变。",
        content_markdown: "# 路由焦点、账号浮层与输入光标修复\n\n本轮统一公开页面的键盘焦点、账号浮层语义和编辑光标，只修复前端交互与无障碍体验。\n\n## 路由与文章焦点\n\n- 8 个公开路由切换后，程序焦点只移动一次并落在新页面的稳定标题；首次 Tab 仍先到三语“跳到主内容”链接，不会自动聚焦搜索框、密码框或输入区。\n- 文章详情与列表切换、浏览器 history back / forward 后，焦点分别跟随文章标题或知识库标题，和当前 URL 保持一致。\n\n## 账号浮层\n\n- 账号入口继续使用非模态 popover，并补充带可访问名称的 `role=group`；触发器保持正确的 `aria-expanded` 与 `aria-controls`。\n- Escape 和点击浮层外都会关闭它，并把焦点归还到账号触发器。\n\n## 输入光标\n\n- 移除 body 级透明 caret，临时互传的密码框与 composer 恢复可见光标和正常编辑；公开文字仍按原有安全方式渲染。\n\n## 边界不变\n\n本轮不改变账号安全模型、会话、文章或临时互传 API、D1 数据结构与后端权限。"
      },
      en: {
        title: "Route Focus, Account Popover, and Caret Fixes",
        summary: "Aligns focus across eight routes, article views, and history navigation; strengthens the non-modal account popover; and restores visible carets in Quick Transfer without changing security, APIs, or D1.",
        content_markdown: "# Route Focus, Account Popover, and Caret Fixes\n\nThis release aligns keyboard focus, account-popover semantics, and editing carets across the public site. Only frontend interaction and accessibility behavior changed.\n\n## Route and article focus\n\n- Switching among all eight public routes moves programmatic focus once to the stable heading for the new route. The first Tab still reaches the trilingual Skip to main content link, and automatic focus never targets a search field, password field, or composer.\n- Article detail/list transitions and browser history back/forward now focus the article title or Knowledge heading to match the current URL.\n\n## Account popover\n\n- The account entry remains a non-modal popover and now exposes a labelled `role=group`; its trigger keeps accurate `aria-expanded` and `aria-controls` state.\n- Escape and outside click both close the popover and return focus to the account trigger.\n\n## Editing carets\n\n- The body-level transparent caret is removed, restoring visible carets and normal editing in the Quick Transfer passphrase field and composer while preserving the existing safe text-rendering path.\n\n## Unchanged boundaries\n\nAccount security, sessions, article and Quick Transfer APIs, the D1 schema, and backend permissions are unchanged."
      },
      ja: {
        title: "ルートフォーカス・アカウントポップオーバー・入力カーソル修正",
        summary: "8 ルート、記事表示、履歴移動のフォーカスを安定した見出しにそろえ、アカウントの非モーダルポップオーバーを補強し、一時転送の入力カーソルを復元しました。安全性、API、D1 は変更していません。",
        content_markdown: "# ルートフォーカス・アカウントポップオーバー・入力カーソル修正\n\n今回の更新では、公開サイトのキーボードフォーカス、アカウントポップオーバーの意味付け、編集カーソルを統一しました。変更はフロントエンドの操作性とアクセシビリティに限定しています。\n\n## ルートと記事のフォーカス\n\n- 8 つの公開ルートを切り替えると、プログラムによるフォーカスは 1 回だけ新しいルートの安定した見出しへ移ります。最初の Tab は引き続き 3 言語の「本文へスキップ」に到達し、検索欄、パスワード欄、入力欄を自動選択しません。\n- 記事詳細と一覧の切り替え、ブラウザの history back / forward 後は、現在の URL に合わせて記事タイトルまたは知識庫の見出しへフォーカスします。\n\n## アカウントポップオーバー\n\n- アカウント入口は非モーダルポップオーバーのまま、アクセシブルな名前を持つ `role=group` を公開します。トリガーの `aria-expanded` と `aria-controls` も正しい状態を維持します。\n- Escape または外側のクリックで閉じ、フォーカスをアカウントトリガーへ戻します。\n\n## 入力カーソル\n\n- body 全体の透明 caret を削除し、一時転送のパスワード欄と composer で見えるカーソルと通常の編集を復元しました。公開テキストの安全な描画方法は維持します。\n\n## 変更していない境界\n\nアカウントの安全モデル、セッション、記事と一時転送の API、D1 スキーマ、バックエンド権限は変更していません。"
      }
    }, "2026-07-17T19:42:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-07-18-theme-accessibility-foundation", {
      zh: {
        title: "四时段首屏与无障碍导航底座",
        summary: "首屏在阻塞样式前确定真实四时段主题，避免非日间先下载 day 壁纸；同时新增三语跳到主内容、语义 Landmark 与活动路由唯一 H1。",
        content_markdown: "# 四时段首屏与无障碍导航底座\n\n本轮完成首屏资源与页面语义的基础优化，让四时段主题从第一帧正确加载，并让键盘和辅助技术更快到达当前内容。\n\n## 首屏主题\n\n- 在阻塞样式加载前，根据 `?wallpaper=` 调试参数或本地时间确定 morning、day、dusk、night。\n- 首个样式计算直接从 `html[data-time-theme]` 读取正确主题，主脚本随后同步到 body、Home 与壁纸舞台；非 day 时段不再先请求 day 资源。\n- 桌面窗口背景、动态壁纸与移动壁纸均接受同一早期主题，调试参数继续有效。\n\n## 导航与语义\n\n- 首个 Tab 显示三语“跳到主内容”入口，并把焦点送到稳定的 main Landmark，不改变当前路由或地址。\n- 每个活动路由只暴露一个 H1，隐藏路由继续离开无障碍树，Home 构图和 Neo-XP 视觉不变。\n- 卡片标题与安全 Markdown 标题从 H2 开始，为后续统一路由焦点和语义烟测提供稳定层级。\n\n## 边界不变\n\n公开路由、账号、Chat、文章 API、D1 与四时段视觉资产均未改变。"
      },
      en: {
        title: "Theme Bootstrap and Accessible Navigation Foundation",
        summary: "Selects the real four-period theme before blocking styles to avoid a needless day-wallpaper request, and adds a trilingual skip link, landmarks, and one H1 for the active route.",
        content_markdown: "# Theme Bootstrap and Accessible Navigation Foundation\n\nThis release improves first-paint resources and page semantics so the correct four-period theme loads from the first frame and keyboard or assistive-technology users can reach the active content quickly.\n\n## First-paint theme\n\n- Before blocking styles load, an early bootstrap selects morning, day, dusk, or night from the `?wallpaper=` debug override or local time.\n- The first style calculation reads the correct `html[data-time-theme]`; the main script then synchronizes body, Home, and the wallpaper stage, so non-day sessions no longer request a day asset first.\n- Desktop window backdrops, dynamic wallpaper, and mobile wallpaper share the same early theme while the debug override remains available.\n\n## Navigation and semantics\n\n- The first Tab reveals a trilingual Skip to main content link that focuses the stable main landmark without changing the current route or address.\n- Only the active route exposes one H1. Hidden routes stay outside the accessibility tree, while the Home composition and Neo-XP appearance remain unchanged.\n- Card titles and safe Markdown headings now begin at H2, providing a stable hierarchy for later route-focus and semantic smoke tests.\n\n## Unchanged boundaries\n\nPublic routes, accounts, Chat, article APIs, D1, and four-period visual assets are unchanged."
      },
      ja: {
        title: "時間帯テーマとアクセシブルナビゲーション基盤",
        summary: "ブロッキング CSS より前に実際の時間帯テーマを確定して day 壁紙の余分な取得を防ぎ、3 言語の本文スキップ、ランドマーク、アクティブルートごとの唯一の H1 を追加しました。",
        content_markdown: "# 時間帯テーマとアクセシブルナビゲーション基盤\n\n今回は初回描画のリソースとページ構造を整え、4 つの時間帯テーマを最初のフレームから正しく表示し、キーボードや支援技術から現在の内容へ素早く移動できるようにしました。\n\n## 初回描画のテーマ\n\n- ブロッキング CSS を読み込む前に、`?wallpaper=` デバッグ指定または端末のローカル時刻から morning、day、dusk、night を決定します。\n- 最初のスタイル計算は正しい `html[data-time-theme]` を参照し、メインスクリプトが body、Home、壁紙ステージへ同期するため、day 以外で day の資産を先に取得しません。\n- デスクトップのウィンドウ背景、動的壁紙、モバイル壁紙は同じ初期テーマを使い、デバッグ指定も維持します。\n\n## ナビゲーションと構造\n\n- 最初の Tab で 3 言語の「本文へスキップ」を表示し、現在のルートや URL を変えずに安定した main ランドマークへフォーカスを移します。\n- アクティブなルートだけが 1 つの H1 を公開します。非表示ルートはアクセシビリティツリーから外れ、Home の構図と Neo-XP の外観は変わりません。\n- カード見出しと安全な Markdown 見出しを H2 から始め、今後のルートフォーカス統一とセマンティック smoke test の基準にします。\n\n## 変更していない境界\n\n公開ルート、アカウント、Chat、記事 API、D1、4 時間帯のビジュアル資産は変更していません。"
      }
    }, "2026-07-17T18:53:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-07-17-mobile-transfer-send-fix", {
      zh: {
        title: "手机顶栏与临时互传发送体验修复",
        summary: "修复手机进入知识库时误弹输入法，并整理移动顶栏与阅读信息；临时互传采用纵向正常流，让整个发送区始终排在完整消息卡之后。",
        content_markdown: "# 手机顶栏与临时互传发送体验修复\n\n本轮修复手机阅读和临时互传的直接操作问题，不改变登录、房间口令、加密、R2、配额、24 小时过期或下载鉴权。\n\n## 手机阅读\n\n- 手机虚拟 OS 移除顶部时间与 LUSU OS 状态行，释放正文空间；栏目 Appbar、首页入口和桌面顶栏保持不变。\n- 知识库文章不再同时显示栏目文字、百分比和进度条，只保留进度条以及可操作的返回、复制与回到顶部控件。\n- 从 Home、欢迎快捷入口或 Dock 进入知识库时，自动焦点只落在可见的非编辑控件或窗口表面，不再直接聚焦搜索框；主动点击搜索时输入法仍正常工作。\n\n## 临时互传\n\n- 从相册或文件选择器添加的附件会先显示在输入区，用户再次点击发送后才开始上传。\n- 手机竖屏房间使用纵向 Flex，toolbar、消息区、发送区和任务区等直接子项不可收缩；消息区按文字、图片和文件卡的实际高度完整撑开，发送区所有控件始终排在最后一条完整消息之后；短横屏显式恢复原有双栏布局。\n- 待发送图片以小缩略图显示并可单独移除；发送后的图片使用占满消息卡片宽度且高度稳定的预览框，普通文件卡片同步占满可用宽度。\n- 每个图片或文件都保留下载按钮，每条已解密文字末尾提供复制按钮。\n\n## 边界不变\n\n房间明文口令仍不会发送到服务器；文字继续在浏览器使用 AES-GCM，文件继续由 HTTPS、私有 R2 与服务端鉴权保护。普通账号配额、管理员 Multipart、24 小时过期和现有 API 保持不变。"
      },
      en: {
        title: "Mobile Header and Quick Transfer Send Fixes",
        summary: "Prevents Knowledge from opening the software keyboard on entry, streamlines mobile reading, and keeps the entire Quick Transfer composer after complete message cards in a non-shrinking vertical flow.",
        content_markdown: "# Mobile Header and Quick Transfer Send Fixes\n\nThis release fixes direct mobile-reading and Quick Transfer interactions without changing sign-in, passphrases, encryption, R2, quotas, 24-hour expiry, or download authorization.\n\n## Mobile reading\n\n- The mobile virtual OS removes the time and LUSU OS status row to return space to content. The Appbar, Home entry, and desktop top bar stay unchanged.\n- Knowledge articles no longer repeat the route label, percentage, and progress bar together. The progress bar and real Back, Copy, and Back to Top controls remain.\n- Opening Knowledge from Home, the welcome shortcut, or the Dock now moves automatic focus only to a visible non-editing control or the window surface instead of the search field. The keyboard still opens after a deliberate search tap.\n\n## Quick Transfer\n\n- Attachments added from the photo library or file picker stay in the composer until the user presses Send again.\n- In mobile portrait, the room uses a vertical flex layout whose toolbar, feed, composer, and task children cannot shrink. Text, image, and file cards contribute their full height, so every composer control begins after the final complete message card. Short landscape explicitly restores the existing two-column layout.\n- Pending images use small removable thumbnails. Sent images use a stable full-width preview inside the message card, and regular file cards fill the same available width.\n- Every image or file keeps a Download action, and each decrypted text message ends with a Copy action.\n\n## Unchanged boundaries\n\nPlaintext room passphrases still never reach the server. Text continues to use browser AES-GCM, while files remain protected by HTTPS, private R2, and server authorization. Standard quotas, admin Multipart, 24-hour expiry, and existing APIs are unchanged."
      },
      ja: {
        title: "モバイル上部バーと一時転送の送信修正",
        summary: "知識庫を開いた直後のキーボード表示を防ぎ、モバイル閲覧を整理しました。一時転送を縮まない縦方向の通常フローにし、入力欄全体を完全なメッセージカードの後へ確実に配置します。",
        content_markdown: "# モバイル上部バーと一時転送の送信修正\n\n今回はモバイル記事と一時転送の直接操作を修正し、ログイン、合言葉、暗号化、R2、割り当て、24 時間の有効期限、ダウンロード認可は変更していません。\n\n## モバイル記事\n\n- モバイル仮想 OS から時刻と LUSU OS の状態行を外し、本文の表示領域を広げました。Appbar、Home 入口、デスクトップ上部バーは維持します。\n- ナレッジ記事では、ルート名、百分率、進捗バーの重複表示をやめ、進捗バーと実際に操作できる戻る・コピー・トップへ戻るを残しました。\n- Home、ウェルカムのショートカット、Dock から知識庫を開いた際、自動フォーカスは表示中の非編集操作またはウィンドウ面にだけ移り、検索欄を直接選ばなくなりました。検索をタップした場合は従来どおりキーボードを利用できます。\n\n## 一時転送\n\n- 写真ライブラリまたはファイル選択から追加した添付は入力欄に保持され、もう一度送信を押してからアップロードを開始します。\n- モバイル縦画面の部屋は縦方向 Flex を使い、ツールバー・メッセージ欄・入力欄・タスク欄の直下要素を縮ませません。文字・画像・ファイルカードの実際の高さを確保し、入力欄内のすべての操作を最後の完全なメッセージカードの後に配置します。短い横画面では既存の 2 列配置を明示的に復元します。\n- 送信待ち画像は削除できる小さなサムネイルで表示します。送信済み画像はカード幅いっぱいの安定したプレビュー、通常ファイルは同じ利用可能幅のファイルカードで表示します。\n- 画像とファイルにはダウンロード、復号済みテキストの末尾にはコピー操作を用意しました。\n\n## 変更していない境界\n\n部屋の平文合言葉は引き続きサーバーへ送りません。文字はブラウザ AES-GCM、ファイルは HTTPS、非公開 R2、サーバー認可で保護します。一般割り当て、管理者 Multipart、24 時間期限、既存 API は変更していません。"
      }
    }, "2026-07-16T18:45:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-07-16-mobile-transfer-ui-polish", {
      zh: {
        title: "手机文章与临时互传界面修复",
        summary: "修复手机端知识库文章回顶触控，并统一资源卡片尺寸与互传页面在窄屏、短屏和软键盘下的布局；安全、配额与 API 边界保持不变。",
        content_markdown: "# 手机文章与临时互传界面修复\n\n本轮针对手机阅读和资源区互传做可见体验修复，不改变后端能力与权限模型。\n\n## 知识库文章\n\n- 手机阅读文章时，回到顶部按钮不再被固定 Appbar 的触控层拦截，点击后可以正常返回文章开头。\n- Appbar 中真实可操作的返回、复制等控件仍然可以正常使用。\n\n## 资源区与互传\n\n- 临时互传卡片与日语学习卡片使用一致的网格宽度和卡片节奏，标题、元信息、说明与入口重新对齐。\n- 互传入口、房间、消息、上传任务、文件预览和输入区适配窄竖屏、短屏与手机横屏；软键盘出现时输入控件保持可见。\n- 非首页手机 App 中的登录入口仍然可达，关键控件保持合适的触控尺寸，不通过裁剪隐藏排版问题。\n\n## 边界不变\n\n本次只调整公开交互和响应式 UI。房间口令派生、HttpOnly 会话、私有 R2、24 小时过期、普通账号配额、管理员 Multipart 权限、下载鉴权以及现有 API 均未改变。"
      },
      en: {
        title: "Mobile Reading and Transfer UI Fixes",
        summary: "Fixes mobile article back-to-top touch handling, aligns Resource cards, and adapts Quick Transfer to narrow, short, and keyboard-constrained screens without changing security, quotas, or APIs.",
        content_markdown: "# Mobile Reading and Transfer UI Fixes\n\nThis release improves mobile reading and the Resources transfer experience without changing backend capabilities or the permission model.\n\n## Knowledge articles\n\n- The Back to Top control is no longer blocked by the fixed Appbar touch layer while reading an article on mobile, so it returns to the article start as expected.\n- Real Appbar controls such as Back and Copy remain interactive.\n\n## Resources and Quick Transfer\n\n- The Quick Transfer and Japanese learning cards now share a consistent grid width and card rhythm, with aligned headings, metadata, descriptions, and actions.\n- Entry, room, message, upload task, file preview, and composer layouts now adapt to narrow portrait screens, short screens, and mobile landscape; focused inputs remain visible when the software keyboard opens.\n- Sign-in remains reachable from a non-Home mobile App, and key controls retain practical touch sizes without clipping content to hide layout problems.\n\n## Unchanged boundaries\n\nThis release changes only public interaction and responsive UI. Passphrase derivation, HttpOnly sessions, private R2 storage, 24-hour expiry, standard-account quotas, admin Multipart permissions, download authorization, and existing APIs are unchanged."
      },
      ja: {
        title: "モバイル記事と一時転送 UI の修正",
        summary: "モバイル記事のトップへ戻る操作を修正し、リソースカードと一時転送を狭い画面・短い画面・ソフトキーボード向けに整えました。安全・割り当て・API の境界は変更していません。",
        content_markdown: "# モバイル記事と一時転送 UI の修正\n\n今回はモバイルでの記事閲覧とリソース欄の一時転送を改善し、バックエンド機能や権限モデルは変更していません。\n\n## ナレッジ記事\n\n- モバイルで記事を読む際、トップへ戻る操作が固定 Appbar のタッチ層に遮られなくなり、記事の先頭へ正しく戻ります。\n- 戻る・コピーなど Appbar 上の実際の操作ボタンは引き続き利用できます。\n\n## リソースと一時転送\n\n- 一時転送カードと日本語学習カードのグリッド幅とカードのリズムを揃え、見出し、メタ情報、説明、操作を整列しました。\n- 入口、部屋、メッセージ、アップロードタスク、ファイルプレビュー、入力欄を、狭い縦画面、短い画面、モバイル横画面に対応させました。ソフトキーボード表示中も入力欄を確認できます。\n- Home 以外のモバイル App からもログインへ進め、主要操作は内容を切り捨てずに十分なタッチ領域を保ちます。\n\n## 変更していない境界\n\n今回は公開操作とレスポンシブ UI のみの変更です。合言葉の派生、HttpOnly セッション、非公開 R2、24 時間の有効期限、一般アカウントの割り当て、管理者 Multipart 権限、ダウンロード認可、既存 API は変更していません。"
      }
    }, "2026-07-16T13:30:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-07-16-quick-transfer", {
      zh: {
        title: "临时互传进入资源区",
        summary: "资源区新增登录限定的临时互传房间，支持浏览器端 AES-GCM 加密文字，以及通过 HTTPS、私有 R2 和服务端鉴权保护的图片、视频与文件；普通账号受免费池保护，管理员可使用分片大文件上传。",
        content_markdown: "# 临时互传进入资源区\n\n已登录用户输入同一房间口令后，可以临时交换浏览器端 AES-GCM 加密文字，以及通过 HTTPS、私有 R2、随机对象键和服务端鉴权保护的图片、视频与普通文件。房间明文口令不会发送到服务器，文件不使用该口令加密。普通账号单文件上限 95 MiB，并受个人、房间、频率及全站 8 GiB 免费池保护；只有数据库角色为 admin 的账号可用 Multipart Upload 发送数百 MB 到数 GB 文件。内容发布完成 24 小时后立即不可读取，下载支持 Range 和视频拖动。R2 桶、Pages 绑定、独立清理 Worker、生命周期规则和 Cloudflare 官方预算提醒仍需站长在 Dashboard 完成人工配置。"
      },
      en: {
        title: "Quick Transfer Arrives in Resources",
        summary: "Resources now includes signed-in temporary rooms for text encrypted in the browser with AES-GCM, plus images, video, and files protected by HTTPS, private R2 storage, and server-side authorization, with a guarded free pool for standard accounts and multipart large files for admins.",
        content_markdown: "# Quick Transfer Arrives in Resources\n\nSigned-in users who enter the same passphrase can exchange text encrypted in the browser with AES-GCM, plus images, video, and regular files protected by HTTPS, private R2 storage, random object keys, and server-side authorization. Plaintext passphrases never reach the server, and files are not encrypted with the passphrase. Standard accounts are limited to 95 MiB per file and guarded by personal, room, rate, and shared 8 GiB free-pool limits. Only database admins may use Multipart Upload for hundreds of megabytes through multi-GB files. Items become unreadable after 24 hours, and downloads support Range requests and video seeking. The owner must still configure R2, Pages bindings, the cleanup Worker, lifecycle rules, and official Cloudflare budget alerts."
      },
      ja: {
        title: "リソースに一時転送を追加",
        summary: "リソースにログイン限定の一時転送部屋を追加し、ブラウザー側で AES-GCM 暗号化するテキストと、HTTPS・非公開 R2・サーバー認可で保護する画像・動画・ファイル、一般ユーザーの無料枠保護、管理者の大容量分割送信に対応しました。",
        content_markdown: "# リソースに一時転送を追加\n\n同じ合言葉を入力したログイン済みユーザー同士で、ブラウザー側で AES-GCM 暗号化するテキストと、HTTPS・非公開 R2・ランダムなオブジェクトキー・サーバー認可で保護する画像、動画、通常ファイルを一時共有できます。平文の合言葉はサーバーへ送信されず、ファイルは合言葉では暗号化されません。一般アカウントは1件 95 MiB までで、個人・部屋・頻度・全体 8 GiB の無料枠保護を受けます。Multipart Upload で数百 MB から数 GB を送れるのはデータベースの admin のみです。公開完了から24時間後にアクセス不可となり、Range ダウンロードと動画シークに対応します。R2、Pages バインド、清理 Worker、ライフサイクル、Cloudflare 公式予算通知は Dashboard で手動設定が必要です。"
      }
    }, "2026-07-16T10:00:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-07-14-japanese-subtext-retry-hotfix", {
      zh: {
        title: "日语潜台词训练器 1.0.3 重答修复",
        summary: "修复错答后关闭结果弹窗、点击弹窗外或查看解析时可能失去重新答题入口的问题；题库、音频和云存档兼容版本继续保持 1.0.2。",
        content_markdown: "# 日语潜台词训练器 1.0.3 重答修复\n\n“日语的言外之意”应用更新至 1.0.3，集中修复错答后的操作死路。\n\n## 错答后始终可以继续\n\n- 结果弹窗不再允许通过关闭按钮、Escape 或点击弹窗外绕过必选操作。\n- 即使弹窗被浏览器或其他代码强制关闭，题面仍会显示重新答题按钮。\n- 查看解析后，重新答题入口会放在解析正文之前；只有本次答对时才显示进入下一关。\n\n## 版本边界\n\n本次只更新应用界面与交互。250 关题库、10,088 段静态音频以及云存档兼容边界继续使用 contentVersion 1.0.2，没有伪造内容迁移或重录记录。"
      },
      en: {
        title: "Japanese Subtext Trainer 1.0.3 Retry Fix",
        summary: "Fixes the dead end that could hide retry after a wrong answer when the result dialog was dismissed or analysis was opened; course, audio, and save compatibility remain on 1.0.2.",
        content_markdown: "# Japanese Subtext Trainer 1.0.3 Retry Fix\n\nBehind the Japanese moves to app version 1.0.3 with a focused fix for the wrong-answer dead end.\n\n## Retry always remains available\n\n- The result dialog can no longer bypass its required actions through the close button, Escape, or an outside click.\n- If the browser or another script forcibly closes the dialog, the question area still exposes Try Again.\n- After View Analysis, Try Again appears before the explanation content; Next Stage appears only when the current attempt is correct.\n\n## Version boundary\n\nThis release changes only the application interface and interaction. The 250-stage course, 10,088 static audio files, and cloud-save compatibility boundary remain on contentVersion 1.0.2, with no fabricated content migration or rerecording claim."
      },
      ja: {
        title: "日本語の裏側 1.0.3 再回答修正",
        summary: "誤答後に結果ダイアログを閉じたり解説を開いたりすると再回答できなくなる問題を修正しました。問題集・音声・セーブ互換版は 1.0.2 のままです。",
        content_markdown: "# 日本語の裏側 1.0.3 再回答修正\n\n「日本語の裏側」をアプリ版 1.0.3 に更新し、誤答後に操作できなくなる経路を修正しました。\n\n## いつでも再回答できる導線\n\n- 結果ダイアログは、閉じるボタン、Escape、外側クリックで必須操作を回避できないようにしました。\n- ブラウザや別のスクリプトがダイアログを強制的に閉じても、問題欄には再回答ボタンが残ります。\n- 解説を開いた後は本文より前に再回答を表示し、今回の回答が正解した場合だけ次のステージを表示します。\n\n## バージョン境界\n\n今回はアプリ画面と操作だけの更新です。250 ステージの問題集、10,088 件の静的音声、クラウドセーブの互換境界は contentVersion 1.0.2 のままで、内容移行や再録を行ったとは扱いません。"
      }
    }, "2026-07-14T02:20:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-07-11-japanese-subtext-trainer", {
      zh: {
        title: "日语潜台词训练工具更新至 1.0.2",
        summary: "“日语的言外之意”更新至 1.0.2：重置全库语音读音链路，修复句尾异常“いい”和“今日”漏读；重做 PC 布局、打卡记录、解析续关与四格漫画配图。",
        content_markdown: "# 日语潜台词训练工具更新至 1.0.2\n\n“日语的言外之意”继续使用 250 关数据题库，这次重点重置语音生成、桌面布局和学习记录，让听力训练更可靠也更紧凑。\n\n## 语音读音全量重置\n\n- 句子、选项和词块先保存可审校的假名读音，再交给离线模型；画面仍显示原来的日语汉字。\n- 生成器会分离 Misaki 的音高标记、规范化特殊辅音并拒绝未知音素，不再把末尾标记读成额外的“いい”，也不会把“きょう”的辅音丢掉后读成“おう”。\n- 语音管线升级到 v4 后强制重建全库静态音频。浏览器训练时仍不加载 TTS，批处理结束后模型保持关闭且不自启动。\n\n## 更紧凑的 PC 训练界面\n\n- 桌面端复用游戏区的壳层思路：左上角返回个人站，右上角显示名称，中间突出存档同步。\n- 关卡内容取消重复的整屏最小高度，场景、题目和解析重新排布，减少大块空白。\n- 查看解析后可直接进入下一关；资源区入口改为“开始”，标题、按钮和卡片文案不再被误拖选。\n\n## 月历打卡与四格场景\n\n- 学习记录改为月历打卡，显示当前连续、最长连续、总打卡天数和最近活动；登录后通过独立日活动表同步。\n- 每关配一张贴合题目情境的原创黑白四格漫画，统一人物、线条、网点和分镜，并适配桌面、平板和手机窗口。"
      },
      en: {
        title: "Japanese Subtext Trainer 1.0.2 Update",
        summary: "Behind the Japanese 1.0.2 rebuilds the speech pipeline to fix detached ending sounds and missing consonants, then adds a denser PC shell, calendar check-ins, analysis-to-next-stage flow, and four-panel manga scenes.",
        content_markdown: "# Japanese Subtext Trainer 1.0.2 Update\n\nBehind the Japanese keeps its 250-stage data-driven course while rebuilding speech generation, desktop layout, and learning history for a more reliable and compact listening experience.\n\n## Full speech-reading reset\n\n- Sentences, answer choices, and phrase tokens now store reviewable kana readings before they reach the offline model, while the interface continues to display the original kanji.\n- The generator separates Misaki pitch metadata, normalizes special consonants, and rejects unknown phonemes. This removes the detached ending sound and prevents kyou from losing its ky consonant and becoming ou.\n- Pipeline v4 forces the static audio library to be regenerated. The browser still never loads TTS during training, and the local model remains stopped with no autostart after the batch.\n\n## A denser PC training shell\n\n- The desktop tool adopts the game-area shell pattern: Back to Site at top left, the tool name at top right, and save synchronization centered in the frame.\n- Repeated viewport-height constraints were removed, and the scene, questions, and analysis were rearranged to eliminate large unused gaps.\n- Analysis now leads directly to the next stage. The Resources action is Start, and non-input headings, buttons, and card labels no longer become accidentally selected.\n\n## Calendar check-ins and four-panel scenes\n\n- Learning history is now a monthly check-in calendar with current streak, longest streak, total days, and recent activity, synchronized through a dedicated daily-activity table after sign-in.\n- Every stage receives an original black-and-white four-panel manga scene matched to its prompt, with consistent characters, line work, screentones, and responsive placement."
      },
      ja: {
        title: "日本語の裏側 1.0.2 アップデート",
        summary: "「日本語の裏側」1.0.2 では、語尾の異音と子音欠落を直すため音声生成を全面更新し、PC レイアウト、カレンダー式学習記録、解説後の次ステージ導線、四コマ漫画を追加しました。",
        content_markdown: "# 日本語の裏側 1.0.2 アップデート\n\n250 ステージのデータ式問題はそのままに、音声生成、PC レイアウト、学習記録を作り直し、聴解練習をより確実でコンパクトにしました。\n\n## 読みを固定した全音声の再生成\n\n- 文、選択肢、語句は、オフラインモデルへ渡す前に確認可能なかな読みを保存します。画面には従来どおり漢字を含む日本語を表示します。\n- Misaki の音高メタデータを音素から分離し、特殊な子音を正規化して未知音素を拒否します。語尾の余分な「いい」を除き、「きょう」の ky が欠けて「おう」になる問題も防ぎます。\n- 音声パイプライン v4 で静的音声を全件再生成します。練習中のブラウザーは TTS を読み込まず、処理後のローカルモデルは停止したままで自動起動しません。\n\n## 空白を減らした PC 画面\n\n- ゲーム欄のシェル構成を取り入れ、左上にサイトへ戻る操作、右上にツール名、中央にセーブ同期を配置しました。\n- 重複していた画面高の制約を外し、場面、問題、解説を再配置して大きな空白を減らしました。\n- 解説から次のステージへ直接進めます。リソース欄の操作は「開始」とし、見出し、ボタン、カード文字の誤選択も防ぎます。\n\n## カレンダー式記録と四コマ場面\n\n- 学習記録を月間カレンダーに変更し、現在・最長の連続日数、合計日数、最近の活動を表示します。ログイン後は専用の日別活動テーブルで同期します。\n- 各ステージに、設問の状況に合うオリジナル白黒四コマ漫画を用意し、人物、線、スクリーントーン、配置を統一して各画面幅に対応します。"
      }
    }, "2026-07-10T17:30:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-07-10-premium-interaction-mobile-os", {
      zh: {
        title: "GPT-5.6 高级交互与移动 OS 重设计",
        summary: "桌面任务栏选中态随模块切换即时同步；手机 Dock 按六个高频入口重新适配为更短的栏体与更清晰的图标尺寸。",
        content_markdown: "# GPT-5.6 高级交互与移动 OS 重设计\n\n这次汇总更新继续保留桌面端 Windows XP、像素艺术与 Y2K 识别度，并把手机端完善为更紧凑、更易读的原创虚拟手机 OS。\n\n## 全站轻动效重置\n\n- 桌面 Home 图标打开 App 时不再创建 Home 全屏快照，只让目标窗口用 200ms 淡入并上移 3px 归位；实时壁纸、顶栏和任务栏保持不动。\n- 桌面任务栏在模块间切换时只显示新活动页面的约 200ms、±6px 轻滑入；返回 Home 时仅让图标区轻滑入，Home 快照不会进入顶层遮住任务栏。\n- 手机 Dock 切换使用约 220ms、±12px 的方向滑动；一个共享选中底板在入口间连续移动，快速连续点击会中止旧转场，不再硬切或留下重影。\n- 弹窗、窗口、按钮和主题统一为低位移反馈；减少动态与关闭动效模式立即完成导航。\n\n## 真实可用的手机导航\n\n- 手机 Appbar 左上角使用带文字的 Home 返回按钮，当前模块名移到右上角，账号和语言仍只在 Home 显示。\n- 底部 Dock 在所有模块内保持悬浮，只保留 Home、知识库、视频、资源、游戏和聊天室六个高频入口；375px 以上居中排列，359px 可短距离横滑，杂谈与关于仍从 Home 图标进入。\n- 网页无法可靠读取 iPhone 的真实信号、Wi-Fi 与电量，因此移除装饰性状态图标，避免把模拟状态误认为设备状态。\n\n## 更紧凑的首页与分层模块\n\n- Home 图标按从左到右、从上到下排列，固定行高，热区贴合图标与标题并保持至少 44px。\n- 知识库、视频、资源、游戏、杂谈、聊天室与关于页继续使用统一的外框、工具区、标签区和内容区层级。\n- 边框使用本站四时段和 Neo-XP 色彩，不复制参考图配色或图标；卡片、文案和按钮继续适配短竖屏与横屏。\n\n所有原有路由、API、D1 数据、账户登录、游戏云存档、普通与密码聊天室、三语内容、视频系统和遥测隐私边界保持不变。"
      },
      en: {
        title: "GPT-5.6 Premium Interaction & Mobile OS Redesign",
        summary: "Desktop taskbar selection now follows module changes immediately, while the six-item mobile Dock uses a shorter bar and clearer icon sizing.",
        content_markdown: "# GPT-5.6 Premium Interaction & Mobile OS Redesign\n\nThis consolidated update keeps the Windows XP, pixel-art, and Y2K identity on desktop while refining mobile into a tighter and more readable original virtual phone OS.\n\n## Site-wide calm motion reset\n\n- Desktop Home App launches no longer create a full Home-screen snapshot. Only the destination window fades in and settles upward by 3px over 200ms, while the live wallpaper, top bar, and taskbar remain still.\n- Desktop taskbar module changes reveal only the new active page with an approximately 200ms, ±6px slide. Returning Home animates only the icon group, so no Home snapshot can cover the taskbar.\n- Mobile Dock changes use an approximately 220ms directional ±12px slide. One shared selection pill moves continuously between routes, and rapid taps skip the previous transition instead of producing a hard cut or ghost frame.\n- Dialogs, windows, buttons, and theme changes now share low-displacement feedback. Reduced-motion and motion-off modes navigate immediately.\n\n## A real mobile navigation Dock\n\n- The mobile Appbar has a labeled Home button on the left and the current module name aligned on the right. Account and language controls remain Home-only.\n- The frosted Dock persists across Apps with six high-frequency routes: Home, Knowledge, Videos, Resources, Games, and Chat. They center from 375px upward and briefly scroll at 359px; Notes and About remain available from Home.\n- Browsers cannot reliably read an iPhone's real signal, Wi-Fi, or battery status, so decorative status glyphs were removed to avoid presenting simulated values as device state.\n\n## Tighter Home and layered Apps\n\n- Home icons fill left to right and top to bottom with fixed rows; hit areas hug the visible icon and label while retaining a 44px minimum.\n- Knowledge, Videos, Resources, Games, Notes, Chat, and About keep a shared outer-frame, toolbar, tab, and content hierarchy.\n- Frames use this site's four-time Neo-XP palette rather than copying reference colors or icons, and content remains adaptive in short portrait and landscape layouts.\n\nExisting routes, APIs, D1 data, account sessions, game cloud saves, public and password chat, three-language content, video delivery, and telemetry privacy boundaries remain unchanged."
      },
      ja: {
        title: "GPT-5.6 プレミアム操作とモバイル OS 再設計",
        summary: "デスクトップのタスクバー選択状態を切り替えと同時に同期し、6 項目のモバイル Dock を短いバーと見やすいアイコン寸法に最適化しました。",
        content_markdown: "# GPT-5.6 プレミアム操作とモバイル OS 再設計\n\n今回の統合更新では、デスクトップの Windows XP、ピクセルアート、Y2K の個性を保ちながら、モバイルをよりコンパクトで読みやすい独自の仮想スマートフォン OS に整えました。\n\n## 全体を軽い動きに再設計\n\n- デスクトップの Home から App を開くときは全画面スナップショットを作らず、対象ウィンドウだけを 200ms のフェードと 3px の上移動で整えます。壁紙、上部バー、タスクバーは動きません。\n- デスクトップ下部ナビのモジュール切り替えは、新しい活動ページだけを約 200ms、±6px で軽く表示します。Home 復帰ではアイコン領域だけを動かし、Home のスナップショットがタスクバーを覆うことはありません。\n- モバイル Dock は約 220ms、±12px の方向付きスライドを使います。一つの共有選択プレートが項目間を連続して移動し、素早い連続操作では古い遷移を中止するため、硬い切り替えや残像が出ません。\n- ダイアログ、ウィンドウ、ボタン、テーマも低移動量の反応に統一しました。動きを減らす設定では直ちに移動します。\n\n## 実際に使えるモバイル Dock\n\n- Appbar 左上に文字付き Home ボタンを置き、現在のモジュール名を右上に揃えました。アカウントと言語操作は Home のみに残します。\n- 半透明 Dock は Home、知識庫、動画、リソース、ゲーム、チャットの高頻度 6 項目に整理しました。375px 以上では中央に並び、359px では短く横スクロールできます。雑談とプロフィールは Home から開けます。\n- ブラウザーは iPhone の実際の電波、Wi-Fi、バッテリーを安定して取得できないため、模擬値と誤解される装飾表示を削除しました。\n\n## コンパクトな Home と多層 App\n\n- Home アイコンは左から右、上から下へ固定行高で並び、タップ範囲は見えるアイコンとラベルに沿わせつつ 44px 以上を保ちます。\n- 知識庫、動画、リソース、ゲーム、雑談、チャット、プロフィールは、外枠、ツール、タブ、内容領域の共通階層を維持します。\n- 参考画像の色やアイコンはコピーせず、このサイトの四時間帯 Neo-XP 配色を使い、短い縦画面と横画面にも適応します。\n\n既存のルート、API、D1 データ、アカウント、ゲームのクラウドセーブ、公開・パスワードチャット、三言語コンテンツ、動画、テレメトリーのプライバシー境界は変更していません。"
      }
    }, "2026-07-10T16:20:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-07-06-private-chat-rooms", {
      zh: {
        title: "暗色加密密码房上线",
        summary: "匿名聊天室新增暗色密码房，并修复旧库自动补字段时普通大厅读取失败的问题。",
        content_markdown: "# 暗色加密密码房上线\n\n匿名聊天室现在增加了密码房模式：点击角落里的密码房按钮，输入同一个密码的人会进入同一个暗色聊天室。\n\n## 更新内容\n\n- 浏览器会用密码派生房间标识和 AES-GCM 密钥，后端只接收和保存密文。\n- 普通匿名大厅保持原来的浅色 XP 样式和明文聊天接口。\n- 密码房 24 小时没有新发言时，会自动删除该房间的密文消息并释放房间。\n- 后台只能看到“密码房加密消息”的占位说明，仍可隐藏、删除和禁言来源。\n- 修复现有 D1 聊天表首次自动补 `room_key` / `encrypted` 字段时，过早创建房间索引导致普通大厅读取失败的问题。\n- 这是前端加密：弱密码仍可能被猜到，网页端也需要信任当前加载的站点脚本。"
      },
      en: {
        title: "Dark Encrypted Password Rooms",
        summary: "Anonymous chat now has dark encrypted password rooms, with a migration fix for existing public rooms.",
        content_markdown: "# Dark Encrypted Password Rooms\n\nAnonymous chat now includes password rooms: click the password-room button, enter a password, and people using the same password enter the same dark chat room.\n\n## What changed\n\n- The browser derives the room identifier and AES-GCM key from the password, so the backend only receives encrypted messages.\n- The public anonymous room keeps its original light XP style and plaintext chat flow.\n- If a password room has no new messages for 24 hours, its encrypted messages are deleted and the room is released.\n- Admin chat management shows a placeholder for encrypted password-room messages while keeping hide, delete, and ban actions.\n- Fixed existing D1 chat table migration so room indexes are created only after `room_key` / `encrypted` columns exist, keeping the public room readable.\n- This is client-side encryption: weak passwords can still be guessed, and the web model still trusts the currently loaded site script."
      },
      ja: {
        title: "暗色の暗号化パスワード部屋",
        summary: "匿名チャットに暗色の暗号化パスワード部屋を追加し、既存ルームの移行時読み込み不具合も修正しました。",
        content_markdown: "# 暗色の暗号化パスワード部屋\n\n匿名チャットにパスワード部屋を追加しました。パスワード部屋ボタンを押して同じパスワードを入力すると、同じ暗色チャットルームに入ります。\n\n## 変更内容\n\n- ブラウザがパスワードから部屋識別子と AES-GCM 鍵を派生し、バックエンドには暗号文だけを送ります。\n- 通常の匿名ルームはこれまで通り、明るい XP 風 UI と平文チャットのままです。\n- パスワード部屋は24時間新しい発言がないと、その部屋の暗号文メッセージを削除して部屋を解放します。\n- 管理画面では暗号化メッセージを占位表示にし、非表示、削除、禁言は引き続き使えます。\n- 既存の D1 チャット表に `room_key` / `encrypted` 列を自動追加するとき、列追加前に部屋インデックスを作ろうとして通常ルームが読めなくなる問題を修正しました。\n- これはブラウザ側暗号化です。弱いパスワードは推測される可能性があり、Web では現在読み込んだサイトスクリプトを信頼する必要があります。"
      }
    }, "2026-07-06T08:00:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-06-30-account-popover-layer-fix", {
      zh: {
        title: "账号弹窗层级修复",
        summary: "右上角账号入口现在会显示在首页和各栏目窗口之上，登录、注册和退出流程保持不变。",
        content_markdown: "# 账号弹窗层级修复\n\n这次修复集中处理右上角账号入口的显示层级，让登录弹窗在首页和其他栏目里都能稳定露出。\n\n## 更新内容\n\n- 顶栏整体层级现在高于主内容窗口，账号弹窗不会再被首页内容、知识库、视频区、资源区、游戏区、聊天室或关于我窗口遮挡。\n- 顶栏继续允许账号弹窗从按钮下方展开，避免点击后弹窗被顶栏自身裁剪。\n- 登录、注册、退出、会话 cookie、云存档和账号接口逻辑保持不变，本次只调整账号入口的前端显示层级。\n- 同步更新前端 fallback、Functions seed、schema seed、缓存版本和项目记录，让首页最近更新日期能读取到本次修复。"
      },
      en: {
        title: "Account Popover Layer Fix",
        summary: "The top-right account entry now opens above the home page and section windows while login, registration, and sign-out stay unchanged.",
        content_markdown: "# Account Popover Layer Fix\n\nThis update fixes the top-right account entry so the login popover reliably appears above the home page and every section window.\n\n## Changes\n\n- The top bar now sits above the main content windows, so the account popover is no longer hidden behind Home, Knowledge, Videos, Resources, Games, Chat, or About surfaces.\n- The top bar continues to allow the account popover to extend below the button instead of clipping it.\n- Login, registration, sign-out, session cookies, cloud saves, and account APIs are unchanged; this is a front-end layering fix.\n- The front-end fallback, Functions seed, schema seed, cache versions, and project records were updated so the recent-update date reflects this fix."
      },
      ja: {
        title: "アカウント表示の重なり修正",
        summary: "右上のアカウント入口がホームや各セクションのウィンドウより前面に表示され、ログイン、登録、ログアウトの動作はそのままです。",
        content_markdown: "# アカウント表示の重なり修正\n\n今回の更新では、右上のアカウント入口がホーム画面や各セクションのウィンドウに隠れないよう、表示の重なり順を修正しました。\n\n## 更新内容\n\n- トップバー全体をメインコンテンツのウィンドウより前面に配置し、アカウント表示がホーム、知識庫、動画、リソース、ゲーム、チャット、プロフィール画面の後ろに隠れないようにしました。\n- アカウント表示は引き続きボタンの下に展開され、トップバー自身に切り取られません。\n- ログイン、登録、ログアウト、セッション cookie、クラウドセーブ、アカウント API の動作は変更していません。今回は前端の表示階層だけの修正です。\n- フロントエンド fallback、Functions seed、schema seed、キャッシュ版、プロジェクト記録も更新し、最近の更新日が今回の修正を反映するようにしました。"
      }
    }, "2026-06-30T08:00:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-06-24-account-cleanup-merge-launch", {
      zh: {
        title: "账号流程与合并上线整理",
        summary: "账号登录、注册和退出更稳定，最近更新操作区完成精简，发布方式回到合并 main 后自动上线。",
        content_markdown: "# 账号流程与合并上线整理\n\n这次更新把主站右上角账号入口和发布流程重新收拢，让日常访问时的账号操作更明确，也让上线方式回到项目约定的 GitHub main 自动发布链路。\n\n## 更新内容\n\n- 账号登录和注册按钮改为显式记录当前操作，回车默认登录，点击注册就按注册流程提交。\n- 账号请求期间会临时锁定登录、注册和退出按钮，减少慢网或重复点击造成的状态错乱。\n- 退出账号继续优先清理服务端会话，网络异常时也会让前端回到未登录状态，避免界面卡住。\n- 欢迎窗口最近更新操作区完成精简，只保留查看网站更新记录的入口。\n- 常规上线方式回到合并到 GitHub main 后由 Cloudflare Pages 自动发布，`npm run deploy` 只保留提示，不再执行手动发布命令。\n\n这轮没有改变游戏存档格式、聊天接口、后台权限或文章发布权限。"
      },
      en: {
        title: "Account Flow and Merge Launch",
        summary: "Account sign-in, registration, and sign-out are steadier, recent-update actions are simpler, and deployment returns to merge-to-main publishing.",
        content_markdown: "# Account Flow and Merge Launch\n\nThis update tightens the top-right account entry and brings release handling back to the project's GitHub main auto-publish path.\n\n## Changes\n\n- The sign-in and registration buttons now record the intended action explicitly: Enter defaults to sign-in, while clicking Register submits the registration flow.\n- Account requests briefly lock sign-in, registration, and sign-out buttons to avoid stale UI during slow or repeated clicks.\n- Sign-out still clears the server session first, while the front end returns to the signed-out state even if the network is unavailable.\n- The welcome window's recent-update action area is simplified to keep only the site update log entry point.\n- Normal releases now point back to merging into GitHub main so Cloudflare Pages publishes automatically; `npm run deploy` only prints that reminder instead of running a manual publish command.\n\nThis round does not change game save formats, chat APIs, admin permissions, or article publishing permissions."
      },
      ja: {
        title: "アカウント操作とマージ公開の整理",
        summary: "ログイン、登録、ログアウトを安定させ、最近の更新の操作欄を簡潔にし、main へのマージ公開に戻しました。",
        content_markdown: "# アカウント操作とマージ公開の整理\n\n今回の更新では、右上のアカウント入口と公開手順を整理し、通常利用時の操作を分かりやすくしながら、GitHub main から Cloudflare Pages が自動公開する流れに戻しました。\n\n## 更新内容\n\n- ログインと登録ボタンは、どちらの操作かを明示してから送信します。Enter はログイン、登録ボタンのクリックは登録として扱います。\n- アカウント操作中は、ログイン、登録、ログアウトボタンを一時的にロックし、遅い通信や連打による表示のずれを減らします。\n- ログアウトは引き続きサーバー側セッションの削除を優先し、通信に失敗しても画面は未ログイン状態へ戻します。\n- ようこそ画面の最近の更新の操作欄を簡潔にし、サイト更新記録への入口だけを残しました。\n- 通常公開は GitHub main へマージしたあと Cloudflare Pages が自動公開する方式に戻し、`npm run deploy` は手動公開ではなく注意メッセージだけを表示します。\n\n今回、ゲーム保存形式、チャット API、管理画面権限、記事公開権限は変更していません。"
      }
    }, "2026-06-24T08:00:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-06-23-public-ux-accessibility-privacy-wrap-up", {
      zh: {
        title: "公开体验、无障碍和隐私收尾",
        summary: "主站按钮点击、弹窗焦点、资源空状态、社交入口、游戏来源链接和访问统计隐私做了一轮集中收口。",
        content_markdown: "# 公开体验、无障碍和隐私收尾\n\n这次更新集中整理主站公开页面里最容易影响日常浏览的交互细节，让按钮、弹窗和入口的反馈更加明确。\n\n## 更新内容\n\n- 主站按钮点击处理顺序重新梳理，账号、重试、语言、筛选、文章、视频、弹窗关闭等具体操作会优先响应，通用页面跳转作为最后的兜底处理。\n- 欢迎弹窗和视频弹窗打开后会把焦点放到真正可操作的关闭按钮上，关闭时也会更稳定地回到合适的位置。\n- 资源区和杂谈区只展示已有真实入口的内容；暂时没有可打开内容时，会显示明确的整理中空状态，不再把示例占位伪装成可点击资源。\n- 关于我里的 Bilibili 和 Discord 在没有真实配置时保持隐藏，社交链接会按已知平台归一化处理，减少空图标和错误跳转。\n- 游戏来源链接和游戏外壳里的仓库入口继续限制为可信 GitHub 地址，游戏本地存档读取也优先使用真实浏览器存储。\n- 前端访问统计继续收紧隐私边界，页面路径、来源和点击标记会在发送前做规范化和脱敏处理。"
      },
      en: {
        title: "Public UX, Accessibility, and Privacy Wrap-up",
        summary: "Button clicks, modal focus, honest empty states, social links, game source links, and analytics privacy were tightened across the public site.",
        content_markdown: "# Public UX, Accessibility, and Privacy Wrap-up\n\nThis update tightens the public site interactions that matter most during everyday browsing, with clearer feedback for buttons, dialogs, and content entry points.\n\n## Changes\n\n- Button click handling now prioritizes specific actions such as account controls, retries, language switching, filters, article actions, video playback, and dialog closing before falling back to general page navigation.\n- The welcome dialog and video dialog move focus to a real close button when opened, then restore focus more predictably when closed.\n- Resources and Talk now show only entries with real usable destinations. When there is nothing ready to open, visitors see a clear in-progress empty state instead of placeholder cards that look downloadable.\n- Bilibili and Discord remain hidden until real URLs are configured, and social links are normalized by known platform names to reduce empty icons or wrong destinations.\n- Game source links and game-shell repository links stay limited to trusted GitHub URLs, while local save reads prefer real browser storage before falling back.\n- Public analytics keeps a tighter privacy boundary by normalizing paths, referrers, links, and click labels before anything is sent."
      },
      ja: {
        title: "公開体験・アクセシビリティ・プライバシー仕上げ",
        summary: "公開サイトのボタン操作、モーダルのフォーカス、空状態、SNS入口、ゲーム出典リンク、アクセス解析のプライバシーをまとめて整えました。",
        content_markdown: "# 公開体験・アクセシビリティ・プライバシー仕上げ\n\n今回の更新では、普段の閲覧で迷いやすいボタン、ダイアログ、入口まわりの反応をまとめて整えました。\n\n## 更新内容\n\n- クリック処理の順序を整理し、アカウント、再試行、言語切替、フィルター、記事、動画、ダイアログを閉じる操作が、通常のページ移動より先に反応するようにしました。\n- 歓迎ダイアログと動画ダイアログを開いたとき、フォーカスが実際に操作できる閉じるボタンへ移動し、閉じたあとも戻り先が安定します。\n- リソース欄と雑談欄は、実際に開ける入口がある内容だけを表示します。まだ公開できる内容がない場合は、整理中であることが分かる空状態を表示します。\n- Bilibili と Discord は実際のURLが設定されるまで非表示のままにし、SNSリンクは既知のプラットフォーム名で整理して、空アイコンや誤った移動先を減らしました。\n- ゲームの出典リンクとゲームシェル内のリポジトリ入口は、信頼できる GitHub URL に限定したままです。ゲームのローカル保存も、まずブラウザーの本来の保存先を優先して読みます。\n- 公開側のアクセス解析は、送信前にページパス、参照元、リンク、クリックラベルを正規化し、プライバシー境界をさらに明確にしました。"
      }
    }, "2026-06-23T06:00:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-06-18-public-site-nightly-update", {
      zh: {
        title: "主站夜间优化汇总",
        summary: "合并昨晚主站优化记录，并按参考图完成知识库文章页 10 轮阅读布局复刻打磨；文章窗口不再拉伸占满全站。",
        content_markdown: "# 主站夜间优化汇总\n\n这篇记录把昨晚主站公开侧的小步优化合并到一起，避免网站更新记录被一串细项刷屏。\n\n## 汇总内容\n\n- 知识库文章详情补齐目录、阅读进度、复制链接和回到顶部能力；本轮参考验收图重排为左侧目录/小贴士、右侧正文卡片，并把底部进度条与回到顶部按钮并排悬浮。\n- 追加 10 轮视觉复刻打磨：阅读态知识库窗口保持站内 XP 窗口尺寸，不再拉伸占满整个网站；标题栏补最小化/最大化/关闭三按钮，底部进度条改为单行蓝色分段条，正文节奏和左侧小贴士位置更贴近参考图。\n- 资源区补齐分类数量、卡片状态、空分类提示和更严格的资源链接白名单。\n- 游戏区补齐云存档、源码徽标、语言标记、入口路径守卫和游戏外壳安全 DOM 渲染。\n- 首页最近更新、知识库列表、筛选、资源筛选和游戏列表继续收紧为 DOM / textContent 渲染，降低公开内容的 XSS 风险。\n- 文章链接、语言同步和最近更新提示统一整理，分享更稳定。\n- 图片懒加载、异步解码、固定图片尺寸和移动端布局细节继续做轻量优化。\n\n旧的单项记录会保留为历史数据和可回退内容，公开列表只展示这一篇汇总。"
      },
      en: {
        title: "Public Site Nightly Summary",
        summary: "Merged last night's public-site updates, completed ten reference-matching passes, and kept the article window inside the site frame.",
        content_markdown: "# Public Site Nightly Summary\n\nThis entry merges last night's small public-site updates into one readable record, so the site update log no longer gets flooded by one article per tiny adjustment.\n\n## Summary\n\n- Knowledge articles gained contents navigation, reading progress, copy-link, and back-to-top controls; this round rebuilds the article view from the reference image with a left contents/tip sidebar, a right reading card, and bottom progress plus back-to-top controls floating side by side.\n- Ten visual matching passes were added: the article reading window now stays inside the site's XP window frame instead of stretching across the whole site, the titlebar has minimize/maximize/close controls, the progress bar is a single-row segmented blue strip, and the body rhythm plus left tip placement are closer to the reference image.\n- The Resources area gained category counts, status badges, empty-category guidance, and stricter resource link allowlists.\n- The Games area gained cloud-save and source badges, localized language labels, launch-path guards, and safer DOM rendering in the game shell.\n- Recent updates, the knowledge list, filters, resource filters, and the game list continue to render through DOM / textContent to reduce XSS risk for public content.\n- Language-aware links, article share URLs, and recent-update labels were aligned for more stable sharing behavior.\n- Lazy loading, async image decoding, fixed image dimensions, and mobile layout details received lightweight polish.\n\nThe old single-topic entries remain as historical and rollback data, but public lists now show this one summary instead."
      },
      ja: {
        title: "メインサイト夜間更新まとめ",
        summary: "昨夜のメインサイト更新をまとめ、参考画像に合わせて知識庫の記事ページを10回調整し、記事ウィンドウはサイト内サイズに戻しました。",
        content_markdown: "# メインサイト夜間更新まとめ\n\nこの記録では、昨夜の公開サイト側の小さな更新を一つにまとめました。更新記録が細かな記事で埋まりすぎないようにするためです。\n\n## まとめ\n\n- 知識庫の記事詳細に、目次、読書進捗、リンクコピー、先頭へ戻る操作を追加しました。今回、参考画像に合わせて左側の目次/ヒント、右側の本文カード、下部の進捗バーと先頭へ戻るボタンを並べた表示に整えました。\n- さらに10回の視覚調整を行い、記事閲覧ウィンドウはサイト内の XP ウィンドウサイズに戻し、全体へ引き伸ばさない表示にしました。タイトルバーに最小化/最大化/閉じるボタンを追加し、進捗バーを1行の青い分割バーにし、本文の余白と左側ヒントの位置も参考画像に近づけました。\n- リソース欄には分類件数、状態バッジ、空分類の案内、より厳しいリンク許可リストを追加しました。\n- ゲーム欄にはクラウド保存、ソース表示、言語ラベル、起動パスの確認、ゲームシェルの安全な DOM 描画を追加しました。\n- 最近の更新、知識庫一覧、フィルター、リソースフィルター、ゲーム一覧は DOM / textContent 描画を続け、公開内容の XSS リスクを下げます。\n- 言語付きリンク、記事共有 URL、最近の更新ラベルをそろえ、共有を安定させました。\n- 画像の遅延読み込み、非同期デコード、固定画像サイズ、モバイル表示の細部も軽く調整しました。\n\n古い単項目の記事は履歴と回退用データとして残しますが、公開一覧ではこのまとめ記事だけを表示します。"
      }
    }, "2026-06-18T00:00:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-06-22-fixed-dock-window-backdrops", {
      zh: {
        title: "底部导航与四时段窗口背景",
        summary: "底部导航固定贴合屏幕下沿，窗口页改用专用低干扰四时段背景，并补齐手机窄屏避让。",
        content_markdown: "# 底部导航与四时段窗口背景\n\n本次更新整理主站窗口页的桌面底层和底部导航位置，让不同页面之间的视觉基线保持一致。\n\n## 更新内容\n\n- 底部导航栏改为固定贴合浏览器视口下沿，不再被不同页面内容高度顶下去。\n- 知识库、视频区、资源区、游戏区、杂谈区、聊天室和关于我等窗口页统一预留底栏空间，避免正常窗口被底栏遮住或互相重叠。\n- 460px 以下窄屏手机补足顶部栏换行后的高度预留，避免 iPhone SE / 390px 宽度下窗口底部压进底部任务栏。\n- 非首页窗口页改用 `assets/images/window-backdrops/<time>.png` 专用四时段背景图，并增加低对比度遮罩，让背景更现代、更简单。\n- 首页仍保留原有动态壁纸舞台、云层和四时段预览参数。\n- 更新主站 CSS / JS 缓存版本，减少线上继续加载旧任务栏或旧背景的概率。"
      },
      en: {
        title: "Pinned Taskbar and Window Backdrops",
        summary: "The bottom taskbar pins to the viewport edge, with dedicated quiet backdrops and small-phone spacing.",
        content_markdown: "# Pinned Taskbar and Window Backdrops\n\nThis update tidies the desktop layer behind the main windows and keeps the bottom navigation aligned across routes.\n\n## Changes\n\n- The bottom taskbar now pins to the browser viewport edge instead of being pushed down by different page heights.\n- Knowledge, Videos, Resources, Games, Blog, Chatroom, and About now reserve space for the taskbar so normal windows are not covered or overlapped.\n- Narrow phones below 460px now reserve extra height for the wrapped top bar, preventing windows from pressing into the bottom taskbar on iPhone SE / 390px widths.\n- Non-home window pages now use dedicated `assets/images/window-backdrops/<time>.png` backdrops for morning, day, dusk, and night, with a low-contrast wash to keep them modern and quiet.\n- The home screen keeps the existing animated wallpaper stage, cloud layers, and preview query parameter.\n- The public CSS / JS cache version was updated to avoid stale taskbar or backdrop styles online."
      },
      ja: {
        title: "固定タスクバーと時間帯背景",
        summary: "下部タスクバーを画面下端に固定し、専用背景と狭いスマホ幅での余白を整えました。",
        content_markdown: "# 固定タスクバーと時間帯背景\n\n今回の更新では、各ウィンドウ画面の背面レイヤーと下部ナビゲーションの位置を整え、ページを切り替えても表示の基準がずれないようにしました。\n\n## 更新内容\n\n- 下部タスクバーをブラウザ画面の下端に固定し、ページ内容の高さで押し下げられないようにしました。\n- 知識庫、動画、リソース、ゲーム、雑談、匿名チャット、プロフィールなどのウィンドウ画面にタスクバー分の余白を確保し、通常のウィンドウを隠したり重ねたりしないようにしました。\n- 460px 未満の狭いスマホ幅では、折り返した上部バーの高さを追加で確保し、iPhone SE / 390px 幅でウィンドウ下部が下部タスクバーに入り込まないようにしました。\n- ホーム以外のウィンドウ画面に、`assets/images/window-backdrops/<time>.png` の専用4時間帯背景を適用し、低コントラストのベールで現代的かつ控えめにしました。\n- ホーム画面の既存の動く壁紙ステージ、雲レイヤー、時間帯プレビュー用クエリはそのまま保ちます。\n- 公開側 CSS / JS のキャッシュ版を更新し、オンラインで古いタスクバーや背景が残りにくくしました。"
      }
    }, "2026-06-22T14:30:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-06-22-about-contact-icons", {
      zh: {
        title: "联系方式图标归位",
        summary: "关于我窗口删除联系方式占位文案，把五个平台原应用图标移入联系方式行。",
        content_markdown: "# 联系方式图标归位\n\n本次更新继续整理关于我窗口，把联系方式从占位文案改成真实可点击的社交图标入口。\n\n## 更新内容\n\n- 删除联系方式里的空占位文字。\n- 将 X、GitHub、Bilibili、Instagram 和 Discord 图标移入联系方式这一行，不再单独占用一条底部图标栏。\n- 五个平台图标改为项目内本地 SVG 品牌图标资源，保留图标按钮和 XP 风格外框。\n- 社交链接仍通过公开只读接口读取后台配置，按钮继续在新标签打开并保留 `aria-label`。\n- 更新主站 CSS / JS 缓存版本，移动端窄屏下图标会在联系方式行内自动换行。"
      },
      en: {
        title: "Contact Icons Aligned",
        summary: "The About window now removes the contact placeholder and moves the five app icons into the Contact row.",
        content_markdown: "# Contact Icons Aligned\n\nThis update tidies the About window by replacing the contact placeholder with real clickable social icon entries.\n\n## Changes\n\n- Removed the placeholder contact text.\n- Moved the X, GitHub, Bilibili, Instagram, and Discord icons into the Contact row instead of keeping a separate icon strip below the intro copy.\n- Switched the five platforms to local SVG brand icon assets while keeping the small XP-style icon buttons.\n- Social links still read admin-configured URLs through the public read-only endpoint, open in a new tab, and keep `aria-label` text.\n- Updated the public CSS / JS cache version, with icons wrapping inside the Contact row on narrow screens."
      },
      ja: {
        title: "連絡先アイコンを整理",
        summary: "プロフィール画面の連絡先プレースホルダーを削除し、5つのアプリアイコンを連絡先行へ移動しました。",
        content_markdown: "# 連絡先アイコンを整理\n\n今回の更新では、プロフィール画面の連絡先を空の文言ではなく、実際にクリックできるSNSアイコンにしました。\n\n## 更新内容\n\n- 連絡先の空プレースホルダー文言を削除しました。\n- X、GitHub、Bilibili、Instagram、Discord のアイコンを、紹介文下の独立した列ではなく連絡先行へ移動しました。\n- 5つのプラットフォームは、プロジェクト内のローカル SVG ブランドアイコンを使い、XP 風の小さなボタン表示を保ちます。\n- SNSリンクは引き続き公開読み取り専用APIから管理画面の設定を読み込み、新しいタブで開き、`aria-label` も保持します。\n- 公開側 CSS / JS のキャッシュ版を更新し、狭い画面では連絡先行の中でアイコンが折り返します。"
      }
    }, "2026-06-22T00:00:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-06-20-about-social-links", {
      zh: {
        title: "关于我社交图标上线",
        summary: "关于我窗口新增五个纯图标社交入口，并可在后台修改每个跳转链接。",
        content_markdown: "# 关于我社交图标上线\n\n关于我窗口现在多了一排纯图标社交入口，不额外增加可见文字，继续保持个人站的 XP 像素桌面排版。\n\n## 更新内容\n\n- 新增 X、GitHub、Bilibili、Instagram 和 Discord 五个图标按钮。\n- 每个图标都是可点击超链接，并默认跳转到对应平台页面。\n- 后台新增“社交链接”页，可替换和修改每个平台的跳转地址。\n- 社交链接配置保存到 D1 的 `site_runtime_state`，主站通过公开只读接口读取。\n- 图标按钮保留 `aria-label`，移动端会自动换行，避免撑开关于我窗口。"
      },
      en: {
        title: "About Social Icons",
        summary: "The About window now has five icon-only social links with admin-editable URLs.",
        content_markdown: "# About Social Icons\n\nThe About window now includes an icon-only row of social links, without adding visible text inside the panel.\n\n## Changes\n\n- Added icon buttons for X, GitHub, Bilibili, Instagram, and Discord.\n- Each icon opens its configured external page in a new tab.\n- The admin area now has a Social Links page for editing every destination URL.\n- Social link settings are stored in D1 `site_runtime_state`, and the public site reads them through a read-only endpoint.\n- The buttons keep `aria-label` text and wrap on small screens so the About window stays tidy."
      },
      ja: {
        title: "プロフィールのSNSアイコン",
        summary: "プロフィール画面に5つのアイコンリンクを追加し、管理画面でURLを変更できます。",
        content_markdown: "# プロフィールのSNSアイコン\n\nプロフィール画面に、文字を増やさないアイコンだけのSNSリンク列を追加しました。\n\n## 更新内容\n\n- X、GitHub、Bilibili、Instagram、Discord の5つのアイコンボタンを追加しました。\n- 各アイコンはクリックでき、設定された外部ページを新しいタブで開きます。\n- 管理画面に「社交リンク」ページを追加し、各リンク先URLを変更できます。\n- SNSリンク設定は D1 の `site_runtime_state` に保存し、公開側は読み取り専用APIから取得します。\n- ボタンには `aria-label` を残し、小画面では折り返してプロフィール画面を崩さないようにしています。"
      }
    }, "2026-06-19T18:00:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-06-19-immersive-time-chrome", {
      zh: {
        title: "四时段沉浸式桌面栏",
        summary: "首页顶部栏和底部任务栏改为四套无竖线的现代玻璃像素 HUD。",
        content_markdown: "# 四时段沉浸式桌面栏\n\n本次更新重新设计了首页最上方和最下方两排，去掉旧版竖向栅格，改成更现代的玻璃像素 HUD。\n\n## 更新内容\n\n- 顶部栏继续跟随 morning、day、dusk、night 四个时间段，但背景改为柔和光斑、横向光带和半透明玻璃层。\n- 底部任务栏改为更轻的 dock 式像素轨道，Start、任务按钮和右侧状态托盘会跟随当前时间段换色。\n- 保留所有原有图标资源、入口、语言切换、账号入口、时间显示和在线状态逻辑。\n- 本地预览仍可用 `?wallpaper=morning`、`?wallpaper=day`、`?wallpaper=dusk`、`?wallpaper=night` 检查四套效果。\n- 同步更新 CSS / JS 缓存版本，避免线上继续加载旧样式。\n\n本轮只调整公开主站顶部栏和任务栏视觉，没有修改后台、账号、聊天、文章接口或游戏存档逻辑。"
      },
      en: {
        title: "Immersive Time-of-Day Chrome",
        summary: "The home top bar and taskbar now use four modern glass pixel HUD themes without vertical grid lines.",
        content_markdown: "# Immersive Time-of-Day Chrome\n\nThis update redesigns the top and bottom rows of the home screen, removing the old vertical grid texture and replacing it with a more modern glass pixel HUD.\n\n## Changes\n\n- The top bar still follows morning, day, dusk, and night, but now uses soft glints, horizontal light bands, and translucent glass layers.\n- The taskbar is now a lighter dock-like pixel rail, with Start, task buttons, and the status tray following the active time theme.\n- Existing icon assets, navigation entries, language switching, account entry, local clock, and online status behavior are unchanged.\n- Local previews still support `?wallpaper=morning`, `?wallpaper=day`, `?wallpaper=dusk`, and `?wallpaper=night` for checking the four styles.\n- CSS and JS cache versions were updated so production browsers do not keep the old chrome.\n\nThis pass only changes the public main-site chrome visuals. Admin pages, account APIs, chat APIs, article APIs, and game-save logic were not changed."
      },
      ja: {
        title: "時間帯別の没入デスクトップバー",
        summary: "ホームの上部バーとタスクバーを、縦線なしの4種類のモダンなガラス調ピクセル HUD に更新しました。",
        content_markdown: "# 時間帯別の没入デスクトップバー\n\n今回の更新では、ホーム画面の上部と下部の2列を見直し、旧版の縦方向グリッドを外して、よりモダンなガラス調ピクセル HUD にしました。\n\n## 更新内容\n\n- 上部バーは morning、day、dusk、night に引き続き連動しつつ、柔らかい光点、横方向の光帯、半透明のガラス層で表現します。\n- 下部タスクバーは軽い dock 風のピクセルレールにし、Start、タスクボタン、右側ステータストレイが現在の時間帯に合わせて変化します。\n- 既存のアイコン素材、入口、言語切り替え、アカウント入口、時計、オンライン表示の動作はそのままです。\n- ローカル確認では引き続き `?wallpaper=morning`、`?wallpaper=day`、`?wallpaper=dusk`、`?wallpaper=night` で4種類を確認できます。\n- CSS / JS のキャッシュ版を更新し、公開環境で古い表示が残りにくいようにしました。\n\nこの作業では公開メインサイトの上部バーとタスクバーの見た目だけを調整し、管理画面、アカウント API、チャット API、記事 API、ゲーム保存ロジックは変更していません。"
      }
    }, "2026-06-19T12:00:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-06-19-main-discovery-wrap-up", {
      zh: {
        title: "主站发现与收口记录",
        summary: "本次主站循环补齐搜索发现配置、站点地图、manifest、robots、三语页面 meta 和语言按钮状态，并完成最终验证。",
        content_markdown: "# 主站发现与收口记录\n\n这篇记录合并 2026 年 6 月 19 日早上 8 点前的主站公开侧循环结果。循环期间只处理公开主站与公开文章接口，避开 `/admin/` 页面、后台私有更新、后台权限和管理接口。\n\n## 更新内容\n\n- 首页补齐 canonical、Open Graph、Twitter Card、主题色、manifest 和移动端 PWA 发现信息。\n- 新增 `robots.txt`、`manifest.webmanifest`、`/api/sitemap.xml` 和根路径 `/sitemap.xml`，站点地图会输出三语首页与公开文章 URL。\n- 语言切换会同步 `html lang`、页面标题、description、canonical、OG/Twitter meta 和语言按钮 `aria-pressed` 状态。\n- 构建检查覆盖文章、视频、站点地图、manifest、robots、主站脚本与遥测脚本，减少上线前遗漏。\n- 本地多视口扫描覆盖首页、知识库、文章详情、视频、资源、游戏、杂谈、聊天室、关于我和账号入口，没有发现页面错误或横向溢出。\n\n后续如果继续优化，建议优先补真实线上 Search Console / 社交分享卡片抓取结果，再决定是否扩展结构化数据。"
      },
      en: {
        title: "Main Site Discovery Wrap-up",
        summary: "This public-site cycle added discovery metadata, sitemap, manifest, robots, trilingual page meta sync, language button state, and final validation.",
        content_markdown: "# Main Site Discovery Wrap-up\n\nThis entry consolidates the public-site loop that ended before 8:00 AM on June 19, 2026. The work stayed on the public main site and public article API, while avoiding `/admin/`, private admin updates, admin permissions, and admin APIs.\n\n## Changes\n\n- The home page now has canonical, Open Graph, Twitter Card, theme-color, manifest, and mobile PWA discovery metadata.\n- `robots.txt`, `manifest.webmanifest`, `/api/sitemap.xml`, and root `/sitemap.xml` were added; the sitemap emits trilingual home URLs and public article URLs.\n- Language switching now syncs `html lang`, page title, description, canonical, OG/Twitter meta, and language-button `aria-pressed` state.\n- Build checks now cover articles, videos, sitemap, manifest, robots, the main script, and the telemetry script to reduce pre-release misses.\n- Local viewport scanning covered Home, Knowledge, article details, Videos, Resources, Games, Talk, Chat, About, and Account with no page errors or horizontal overflow found.\n\nFor the next pass, live Search Console checks and social-card crawler previews are the best follow-up before expanding structured data."
      },
      ja: {
        title: "メインサイト発見性の仕上げ",
        summary: "今回の公開側サイクルでは、検索向けメタ情報、サイトマップ、manifest、robots、三言語 meta 同期、言語ボタン状態、最終確認を追加しました。",
        content_markdown: "# メインサイト発見性の仕上げ\n\nこの記録では、2026年6月19日午前8時までの公開サイト側ループ結果をまとめます。作業範囲は公開メインサイトと公開記事 API に限定し、`/admin/`、管理側の非公開更新、管理権限、管理 API には触れていません。\n\n## 更新内容\n\n- ホームに canonical、Open Graph、Twitter Card、テーマカラー、manifest、モバイル PWA 向けの発見情報を追加しました。\n- `robots.txt`、`manifest.webmanifest`、`/api/sitemap.xml`、ルートの `/sitemap.xml` を追加し、サイトマップには三言語ホーム URL と公開記事 URL を出力します。\n- 言語切り替え時に `html lang`、ページタイトル、description、canonical、OG/Twitter meta、言語ボタンの `aria-pressed` 状態を同期します。\n- ビルド確認では記事、動画、サイトマップ、manifest、robots、メインスクリプト、テレメトリスクリプトを確認します。\n- ローカルの複数ビューポート確認では、ホーム、知識庫、記事詳細、動画、リソース、ゲーム、雑談、チャット、About、アカウント入口でページエラーや横方向のはみ出しは見つかりませんでした。\n\n次に進めるなら、実際の Search Console と SNS カードの取得結果を確認してから構造化データを広げるのがよさそうです。"
      }
    }, "2026-06-19T00:15:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-06-18-main-visual-polish-cycle", {
      zh: {
        title: "主端视觉改版循环更新",
        summary: "本次主端视觉改版循环统一打磨首页、知识库、视频、资源、游戏、聊天室、关于我和账号入口的展示体验。",
        content_markdown: "# 主端视觉改版循环更新\n\n这篇记录合并本线程的主端视觉改版循环结果。循环期间只处理公开主站页面，避开 `/admin/` 管理后台、后台接口和 D1 权限逻辑，继续保留 Windows XP + Pixel Art + Y2K + 可爱复古互联网桌面风格。\n\n## 主要变化\n\n- 首页桌面、顶部栏、任务栏、桌面图标和欢迎弹窗继续保持 XP 桌面感，同时补充长文案、省略显示、短屏和移动端安全间距。\n- 欢迎弹窗的最近更新区域在手机竖屏和短横屏下改为更紧凑的三段式布局，更新列表内部滚动，`查看更多更新` 按钮更早可见。\n- 知识库列表、分类栏、文章详情、复制链接状态、阅读进度和长文排版补齐长词换行与短屏保护，避免文章卡片被极端标题撑宽。\n- 视频区、资源区和游戏区卡片统一加强标题、简介、元信息、分类标签和操作按钮的最大宽度与换行规则，减少按钮不齐、卡片挤压和横向溢出。\n- 游戏外壳在移动端和短横屏下压缩本地存档工具、云存档提示、协议栏和 iframe 起点，保留导入导出、云存档和游戏本体逻辑不变。\n- 匿名聊天室继续使用纯文本渲染；昵称区、状态行、消息输入、发送按钮和底部提示在三语与窄屏下都补充宽度保护。\n- 关于我窗口、账号入口和登录弹窗补齐长字段、长邮箱、短横屏和移动端下的换行与高度保护。\n\n## 验证记录\n\n- 已执行构建检查，`build-check` 通过。\n- 已用桌面、移动竖屏、平板和短横屏尺寸扫描首页、知识库、视频、资源、游戏、杂谈、聊天室、关于我八个主端区域，中文 / English / 日本語 三语均无页面级横向溢出。\n- 本轮没有修改管理后台页面、后台权限、聊天发送接口、账号登录接口或游戏存档逻辑。\n\n后续如果继续打磨，建议优先接入真实视频数据后的播放器弹窗复验、游戏外壳缓存版本策略，以及更多真实长文章内容的阅读截图验收。"
      },
      en: {
        title: "Main Site Visual Polish Cycle",
        summary: "This public-site visual cycle polished Home, Knowledge, Videos, Resources, Games, Chat, About, and Account layouts as one unified update.",
        content_markdown: "# Main Site Visual Polish Cycle\n\nThis entry consolidates the public-site visual polish cycle from this thread. The work stayed on the visible main site, avoided `/admin/`, admin APIs, and D1 permission logic, and kept the Windows XP + Pixel Art + Y2K + cute retro desktop identity intact.\n\n## Highlights\n\n- Home, the top bar, taskbar, desktop icons, and welcome dialog keep the XP desktop mood while gaining safer long-label handling, ellipsis behavior, short-screen spacing, and mobile guards.\n- The welcome dialog's Recent Updates panel is more compact on phones and short landscape screens: the update list scrolls inside the panel, while `More updates` stays easy to reach.\n- Knowledge lists, category tabs, article details, copy-link status, reading progress, and long-form typography now have stronger long-word wrapping and short-screen protection.\n- Video, Resource, and Game cards gained more consistent title, summary, metadata, category-label, and action-button width rules to reduce uneven buttons, cramped cards, and horizontal overflow.\n- The game shell is tighter on mobile and short landscape screens, with compact save tools, cloud-save notes, license rows, and iframe placement while import/export, cloud saves, and game logic remain unchanged.\n- The anonymous chat room still renders visitor content as plain text; nickname, status, message input, send button, and footer copy now have stronger width protection across languages and small screens.\n- About, Account, and login popovers gained wrapping and height guards for long fields, long email addresses, mobile layouts, and short landscape screens.\n\n## Validation\n\n- Build checks passed with `build-check`.\n- Home, Knowledge, Videos, Resources, Games, Talk, Chat, and About were scanned across desktop, mobile portrait, tablet, and short landscape viewports in Chinese, English, and Japanese with no page-level horizontal overflow.\n- This cycle did not change admin pages, admin permissions, chat sending APIs, account login APIs, or game save logic.\n\nNext visual passes should focus on player modal QA once real video data is available locally, cache busting for game-shell CSS, and screenshot acceptance against more real long-form article content."
      },
      ja: {
        title: "メインサイト視覚調整サイクル更新",
        summary: "今回の公開側視覚調整では、ホーム、知識庫、動画、リソース、ゲーム、チャット、About、アカウント周りをまとめて整えました。",
        content_markdown: "# メインサイト視覚調整サイクル更新\n\nこの記録では、本スレッドで行った公開サイト側の視覚調整サイクルを一つにまとめます。作業範囲は主端の見た目に限定し、`/admin/` 管理画面、管理 API、D1 権限ロジックには触れず、Windows XP + Pixel Art + Y2K + かわいいレトロインターネットデスクトップの雰囲気を保ちました。\n\n## 主な変更\n\n- ホーム、上部バー、タスクバー、デスクトップアイコン、歓迎ウィンドウは XP デスクトップ感を保ちながら、長い文言、省略表示、短い画面、モバイル余白に強くしました。\n- 歓迎ウィンドウの最近の更新欄は、スマホ縦画面と短い横画面でよりコンパクトになりました。更新リストをパネル内スクロールにし、`もっと見る` ボタンを見つけやすくしました。\n- 知識庫一覧、分類バー、記事詳細、リンクコピー状態、読書進捗、長文組版では、長い単語の折り返しと短画面保護を強化しました。\n- 動画、リソース、ゲームのカードでは、タイトル、説明、メタ情報、分類ラベル、操作ボタンの幅と折り返しをそろえ、ボタンの不揃い、カードの圧迫、横方向のはみ出しを減らしました。\n- ゲーム外枠はモバイルと短横画面で、ローカルセーブ工具、クラウドセーブ表示、ライセンス欄、iframe の開始位置をコンパクトにしつつ、インポート/エクスポート、クラウド保存、ゲーム本体の動作は変えていません。\n- 匿名チャットは引き続きユーザー内容を純テキストで描画します。ニックネーム、状態行、入力欄、送信ボタン、下部表示は三言語と小画面で幅保護を強化しました。\n- About、アカウント入口、ログイン表示では、長い項目、長いメールアドレス、モバイル、短横画面向けに折り返しと高さの保護を追加しました。\n\n## 検証\n\n- `build-check` は通過しました。\n- ホーム、知識庫、動画、リソース、ゲーム、雑談、チャット、About を、デスクトップ、スマホ縦画面、タブレット、短横画面で確認し、中国語 / English / 日本語の三言語でページ全体の横はみ出しがないことを確認しました。\n- 今回のサイクルでは、管理画面、管理権限、チャット送信 API、アカウントログイン API、ゲーム保存ロジックは変更していません。\n\n次回の視覚調整では、ローカルに実動画データがある状態でのプレイヤーウィンドウ確認、game-shell CSS のキャッシュ対策、実際の長文記事スクリーンショットでの受け入れ確認を優先するとよさそうです。"
      }
    }, "2026-06-18T11:30:00.000Z"),
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
    ...articleTranslationsStatements(env, "seed-update-2026-06-18-game-cover-decoding", {
      zh: {
        title: "游戏封面异步解码",
        summary: "游戏区封面图在懒加载基础上补充异步解码。",
        content_markdown: "# 游戏封面异步解码\n\n本次更新继续补齐公开主站的轻量性能细节，让游戏区封面图在懒加载之外也使用异步解码。\n\n## 更新内容\n\n- 游戏区动态渲染的 `game-cover` 图片补充 `decoding=\"async\"`。\n- 保留已有 `loading=\"lazy\"`，减少打开游戏列表时的图片加载和解码压力。\n- 游戏目录、云存档、入口链接和游戏运行逻辑保持不变。\n- 只调整公开主站游戏列表图片属性和更新记录，不触碰后台目录或管理接口。"
      },
      en: {
        title: "Async Game Cover Decoding",
        summary: "Game cover images now add async decoding on top of lazy loading.",
        content_markdown: "# Async Game Cover Decoding\n\nThis update continues the public site's lightweight performance polish by adding async decoding to game cover images.\n\n## Changes\n\n- Dynamically rendered `game-cover` images now include `decoding=\"async\"`.\n- Existing `loading=\"lazy\"` behavior stays in place, reducing image load and decode pressure when the games list opens.\n- Game catalog data, cloud saves, entry links, and game runtime behavior are unchanged.\n- Only public site game-list image attributes and update records changed; admin folders and admin APIs were not touched."
      },
      ja: {
        title: "ゲームカバーの非同期デコード",
        summary: "ゲーム欄のカバー画像に、遅延読み込みに加えて非同期デコードを追加しました。",
        content_markdown: "# ゲームカバーの非同期デコード\n\n今回の更新では、公開サイトの軽量な性能調整として、ゲーム欄のカバー画像に非同期デコードを追加しました。\n\n## 更新内容\n\n- 動的に描画される `game-cover` 画像に `decoding=\"async\"` を追加しました。\n- 既存の `loading=\"lazy\"` は維持し、ゲーム一覧を開くときの画像読み込みとデコード負荷を抑えます。\n- ゲームカタログ、クラウドセーブ、入口リンク、ゲーム実行ロジックは変更していません。\n- 公開側のゲーム一覧画像属性と更新記録だけを調整し、管理画面ディレクトリや管理 API には触れていません。"
      }
    }, "2026-06-17T17:38:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-06-18-game-language-labels", {
      zh: {
        title: "游戏语言标记三语同步",
        summary: "游戏卡片里的语言支持标记现在会跟随当前站点语言显示。",
        content_markdown: "# 游戏语言标记三语同步\n\n本次更新整理游戏区卡片里的语言支持标记，减少 English / 日本語 页面里的固定中文混杂。\n\n## 更新内容\n\n- 中文界面显示 `中文 / 英文 / 日文`。\n- English 界面显示 `Chinese / English / Japanese`。\n- 日本語界面显示 `中国語 / 英語 / 日本語`。\n- 不支持状态的 `title` 提示也使用当前语言；✓ / × 状态、游戏目录、云存档和入口链接逻辑保持不变。"
      },
      en: {
        title: "Game Language Labels",
        summary: "Game-card language support tags now localize their language names and unsupported hints.",
        content_markdown: "# Game Language Labels\n\nThis update cleans up the language support tags on game cards so English and Japanese pages do not keep fixed Chinese labels.\n\n## Changes\n\n- Chinese shows `中文 / 英文 / 日文`.\n- English shows `Chinese / English / Japanese`.\n- Japanese shows `中国語 / 英語 / 日本語`.\n- Unsupported-state `title` hints also use the active language; ✓ / × status, game catalog data, cloud saves, and entry links are unchanged."
      },
      ja: {
        title: "ゲーム言語ラベルの多言語同期",
        summary: "ゲームカードの対応言語タグが、現在のサイト言語に合わせて表示されます。",
        content_markdown: "# ゲーム言語ラベルの多言語同期\n\n今回の更新では、ゲームカードの対応言語タグを整理し、English / 日本語 ページに固定の中国語ラベルが混ざらないようにしました。\n\n## 更新内容\n\n- 中文表示では `中文 / 英文 / 日文` を表示します。\n- English 表示では `Chinese / English / Japanese` を表示します。\n- 日本語表示では `中国語 / 英語 / 日本語` を表示します。\n- 未対応状態の `title` ヒントも現在の言語を使います。✓ / × の状態、ゲームカタログ、クラウドセーブ、入口リンクは変更していません。"
      }
    }, "2026-06-17T17:43:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-06-18-game-shell-locale", {
      zh: {
        title: "游戏外壳三语同步",
        summary: "游戏入口页的共享外壳文案现在会跟随站点语言显示。",
        content_markdown: "# 游戏外壳三语同步\n\n本次更新整理每个游戏入口页外层工具栏的三语体验，让 `?lang=en` 和 `?lang=ja` 不再混入固定中文外壳文案。\n\n## 更新内容\n\n- 返回游戏区、加载状态、本地存档工具、导入导出按钮、云端存档面板、协议链接和状态提示会跟随当前语言显示。\n- 游戏标题、iframe 标题和语言支持副标题使用当前站点语言。\n- 5 个游戏入口页的 `game-shell.js` 增加缓存版本，帮助浏览器获取新外壳脚本。\n- 游戏本体 iframe、启动语言、云存档同步、导入导出逻辑保持不变。"
      },
      en: {
        title: "Localized Game Shell",
        summary: "The shared game entry shell now follows the active site language.",
        content_markdown: "# Localized Game Shell\n\nThis update localizes the shared wrapper around each game entry page, so `?lang=en` and `?lang=ja` no longer keep fixed Chinese shell controls.\n\n## Changes\n\n- Back links, loading text, local-save tools, import/export buttons, cloud-save panels, license links, and status messages follow the active language.\n- Game titles, iframe titles, and language-support subtitles use the current site language.\n- All five game entry pages now request `game-shell.js` with a new cache version.\n- The embedded game iframe, launch language, cloud-save sync, and import/export behavior are unchanged."
      },
      ja: {
        title: "ゲームシェルの多言語同期",
        summary: "ゲーム入口ページの共通シェルが現在のサイト言語に合わせて表示されます。",
        content_markdown: "# ゲームシェルの多言語同期\n\n今回の更新では、各ゲーム入口ページを包む共通シェルを多言語化し、`?lang=en` と `?lang=ja` で固定の中国語コントロールが混ざらないようにしました。\n\n## 更新内容\n\n- ゲーム一覧への戻るリンク、読み込み表示、ローカルセーブツール、インポート/エクスポートボタン、クラウドセーブパネル、ライセンスリンク、状態表示が現在の言語に合わせて表示されます。\n- ゲームタイトル、iframe タイトル、対応言語のサブタイトルも現在のサイト言語を使います。\n- 5 つのゲーム入口ページで `game-shell.js` に新しいキャッシュ版を付けました。\n- 埋め込みゲーム iframe、起動言語、クラウドセーブ同期、インポート/エクスポートの動作は変更していません。"
      }
    }, "2026-06-17T17:55:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-06-18-resource-placeholder-hints", {
      zh: {
        title: "资源占位提示补齐",
        summary: "资源区准备中的占位按钮现在会说明暂时没有下载或外链。",
        content_markdown: "# 资源占位提示补齐\n\n本次更新继续整理资源区的占位体验，让没有真实 URL 的资源按钮不只显示“准备中”，也能说明原因。\n\n## 更新内容\n\n- 没有下载或外链的资源按钮增加中文 / English / 日本語 的 `title` 和 `aria-label`。\n- 占位按钮继续保持 disabled，并补充 `aria-disabled=\"true\"`。\n- 既有 URL 白名单、资源数据结构和安全 DOM 渲染逻辑不变。\n- 只调整公开主站资源区提示和更新记录，不触碰后台目录或管理接口。"
      },
      en: {
        title: "Resource Placeholder Hints",
        summary: "Coming-soon resource buttons now explain when no download or external link is available.",
        content_markdown: "# Resource Placeholder Hints\n\nThis update continues polishing the Resources area so placeholder buttons explain why they are not clickable yet.\n\n## Changes\n\n- Resource buttons without a download or external link now include localized `title` and `aria-label` text in Chinese, English, and Japanese.\n- Placeholder buttons remain disabled and now include `aria-disabled=\"true\"`.\n- The existing URL allowlist, resource data shape, and safe DOM rendering path are unchanged.\n- Only public Resources hints and update records changed; admin folders and admin APIs were not touched."
      },
      ja: {
        title: "リソース準備中ヒント",
        summary: "準備中のリソースボタンが、ダウンロードや外部リンクがまだないことを説明します。",
        content_markdown: "# リソース準備中ヒント\n\n今回の更新では、リソース欄の占位表示を少し整え、リンクのないボタンがなぜクリックできないのかを分かりやすくしました。\n\n## 更新内容\n\n- ダウンロードや外部リンクがないリソースボタンに、中文 / English / 日本語 の `title` と `aria-label` を追加しました。\n- 占位ボタンは引き続き disabled のまま、`aria-disabled=\"true\"` も追加しました。\n- 既存の URL 許可リスト、リソースデータ構造、安全な DOM 描画経路は変更していません。\n- 公開側のリソース欄ヒントと更新記録だけを調整し、管理画面ディレクトリや管理 API には触れていません。"
      }
    }, "2026-06-17T18:00:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-06-18-video-thumb-decoding", {
      zh: {
        title: "视频缩略图异步解码",
        summary: "公开视频卡片缩略图现在会在懒加载之外使用异步解码。",
        content_markdown: "# 视频缩略图异步解码\n\n本次更新继续做公开主站的轻量性能整理，把视频区缩略图的图片加载策略和文章配图、游戏封面对齐。\n\n## 更新内容\n\n- 公开视频卡片缩略图在已有 `loading=\"lazy\"` 基础上增加 `decoding=\"async\"`。\n- 视频列表、视频分类、播放窗口、外链白名单和公开视频 API 行为不变。\n- 当前没有公开视频时，视频区仍显示原有 XP 风格空状态。\n- 只调整公开主站视频卡片图片属性和更新记录，不触碰后台目录或管理接口。"
      },
      en: {
        title: "Async Video Thumbnail Decoding",
        summary: "Public video card thumbnails now use async decoding in addition to lazy loading.",
        content_markdown: "# Async Video Thumbnail Decoding\n\nThis update continues lightweight public-site performance polish by aligning video thumbnails with article images and game covers.\n\n## Changes\n\n- Public video card thumbnails now add `decoding=\"async\"` alongside the existing `loading=\"lazy\"` behavior.\n- Video lists, categories, playback windows, external-link allowlists, and public video API behavior are unchanged.\n- When there are no public videos, the Videos area keeps the existing XP-style empty state.\n- Only public video-card image attributes and update records changed; admin folders and admin APIs were not touched."
      },
      ja: {
        title: "動画サムネイルの非同期デコード",
        summary: "公開動画カードのサムネイルが、遅延読み込みに加えて非同期デコードを使うようになりました。",
        content_markdown: "# 動画サムネイルの非同期デコード\n\n今回の更新では、公開サイトの軽量な性能調整として、動画サムネイルの画像読み込み方を記事画像やゲームカバーと揃えました。\n\n## 更新内容\n\n- 公開動画カードのサムネイルに、既存の `loading=\"lazy\"` に加えて `decoding=\"async\"` を追加しました。\n- 動画一覧、カテゴリ、再生ウィンドウ、外部リンク許可リスト、公開動画 API の動作は変更していません。\n- 公開動画がない場合、動画欄はこれまで通り XP 風の空状態を表示します。\n- 公開側の動画カード画像属性と更新記録だけを調整し、管理画面ディレクトリや管理 API には触れていません。"
      }
    }, "2026-06-17T18:07:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-06-18-resource-label-sync", {
      zh: {
        title: "资源入口文案对齐",
        summary: "资源区桌面入口的英文和日文名称现在与资源窗口标题一致。",
        content_markdown: "# 资源入口文案对齐\n\n本次更新修正资源区桌面图标的英文和日文名称，让入口名称与打开后的资源窗口标题保持一致。\n\n## 更新内容\n\n- English 桌面入口从 `Files TBD` 改为 `Resources TBD`。\n- 日本語桌面入口从 `資料（未定）` 改为 `リソース（未定）`。\n- 中文入口继续显示 `资源区（待定）`。\n- 资源区路由、占位状态、资源数据和安全 DOM 渲染逻辑保持不变。"
      },
      en: {
        title: "Resources Label Sync",
        summary: "The Resources desktop icon now matches the Resources window label in English and Japanese.",
        content_markdown: "# Resources Label Sync\n\nThis update aligns the Resources desktop icon text with the title of the Resources window that opens from it.\n\n## Changes\n\n- The English desktop icon now says `Resources TBD` instead of `Files TBD`.\n- The Japanese desktop icon now says `リソース（未定）` instead of `資料（未定）`.\n- The Chinese icon keeps `资源区（待定）`.\n- Resource routes, placeholder state, resource data, and safe DOM rendering are unchanged."
      },
      ja: {
        title: "リソース入口ラベル同期",
        summary: "リソースのデスクトップ入口名を、リソースウィンドウの名称に合わせました。",
        content_markdown: "# リソース入口ラベル同期\n\n今回の更新では、リソース欄のデスクトップアイコン名を、開いた後のリソースウィンドウ名と揃えました。\n\n## 更新内容\n\n- English 表示のデスクトップ入口を `Files TBD` から `Resources TBD` に変更しました。\n- 日本語表示のデスクトップ入口を `資料（未定）` から `リソース（未定）` に変更しました。\n- 中文入口は `资源区（待定）` のままです。\n- リソース欄のルート、占位状態、リソースデータ、安全な DOM 描画経路は変更していません。"
      }
    }, "2026-06-17T18:10:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-06-18-game-shell-safe-dom", {
      zh: {
        title: "游戏外壳安全 DOM 渲染",
        summary: "游戏入口页的云存档面板和协议栏改为更安全的 DOM/textContent 构建。",
        content_markdown: "# 游戏外壳安全 DOM 渲染\n\n本次更新收紧游戏入口页外层工具栏的公开渲染路径，让云存档信息和协议链接都通过 DOM API 构建。\n\n## 更新内容\n\n- 云存档面板不再用字符串 `innerHTML` 拼接，邮箱、状态提示和按钮文案都通过 `textContent` 渲染。\n- 协议栏改为 DOM 构建，协议文件只接受相对路径，上游仓库只接受 `http(s)` 链接。\n- 5 个游戏入口页更新 `game-shell.js` 缓存版本，帮助浏览器获取新脚本。\n- 游戏 iframe、启动语言、云存档同步和导入导出逻辑保持不变。"
      },
      en: {
        title: "Game Shell Safe DOM",
        summary: "Game entry cloud-save panels and license links now render through safer DOM/textContent paths.",
        content_markdown: "# Game Shell Safe DOM\n\nThis update tightens the public rendering path around the shared game-entry toolbar so cloud-save information and license links are built with DOM APIs.\n\n## Changes\n\n- The cloud-save panel no longer builds strings with `innerHTML`; email, status text, and button labels render through `textContent`.\n- The license panel now uses DOM construction, accepts only relative license-file paths, and accepts only `http(s)` upstream repository links.\n- All five game entry pages now request `game-shell.js` with a new cache version.\n- Game iframes, launch language, cloud-save sync, and import/export behavior are unchanged."
      },
      ja: {
        title: "ゲームシェルの安全な DOM 描画",
        summary: "ゲーム入口ページのクラウド保存パネルとライセンス欄を、より安全な DOM/textContent 経路にしました。",
        content_markdown: "# ゲームシェルの安全な DOM 描画\n\n今回の更新では、ゲーム入口ページ共通ツールバーの公開描画経路を引き締め、クラウド保存情報とライセンスリンクを DOM API で構築するようにしました。\n\n## 更新内容\n\n- クラウド保存パネルは文字列の `innerHTML` 組み立てをやめ、メール、状態表示、ボタン文言を `textContent` で描画します。\n- ライセンス欄は DOM 構築に変更し、ライセンスファイルは相対パスのみ、上流リポジトリは `http(s)` リンクのみ受け付けます。\n- 5 つのゲーム入口ページで `game-shell.js` のキャッシュ版を更新しました。\n- ゲーム iframe、起動言語、クラウドセーブ同期、インポート/エクスポート動作は変更していません。"
      }
    }, "2026-06-17T18:15:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-06-18-account-safe-dom", {
      zh: {
        title: "账号弹窗安全 DOM 渲染",
        summary: "顶部账号/云存档弹窗改为 DOM/textContent 构建。",
        content_markdown: "# 账号弹窗安全 DOM 渲染\n\n本次更新收紧公开主站右上角账号入口的渲染方式，让账号和云存档提示继续以纯文本方式显示。\n\n## 更新内容\n\n- 账号弹窗不再用模板字符串 `innerHTML` 拼接，按钮、邮箱、接口错误和状态提示改为 DOM / `textContent` 构建。\n- 登录、注册、退出账号、语言切换后的重渲染和云存档说明逻辑保持不变。\n- 邮箱和接口错误只作为文本节点渲染，不会被当作 HTML 执行。\n- 只调整公开主站账号弹窗和更新记录，不触碰后台目录或管理接口。"
      },
      en: {
        title: "Account Popover Safe DOM",
        summary: "The top account and cloud-save popover now renders through DOM/textContent.",
        content_markdown: "# Account Popover Safe DOM\n\nThis update tightens the rendering path for the public site's top-right account entry so account and cloud-save notices stay plain text.\n\n## Changes\n\n- The account popover no longer builds markup with template-string `innerHTML`; buttons, email, API errors, and status notices are created through DOM / `textContent`.\n- Login, registration, sign-out, language-switch re-rendering, and cloud-save copy are unchanged.\n- Email addresses and API errors render only as text nodes and are not interpreted as HTML.\n- Only the public account popover and update records changed; admin folders and admin APIs were not touched."
      },
      ja: {
        title: "アカウント表示の安全な DOM 描画",
        summary: "上部アカウント/クラウド保存表示を DOM/textContent 描画にしました。",
        content_markdown: "# アカウント表示の安全な DOM 描画\n\n今回の更新では、公開サイト右上のアカウント入口の描画経路を引き締め、アカウントとクラウド保存の案内を純テキストとして表示します。\n\n## 更新内容\n\n- アカウント表示はテンプレート文字列の `innerHTML` 組み立てをやめ、ボタン、メール、API エラー、状態表示を DOM / `textContent` で構築します。\n- ログイン、登録、ログアウト、言語切り替え後の再描画、クラウド保存説明は変更していません。\n- メールアドレスと API エラーはテキストノードとしてのみ描画され、HTML として解釈されません。\n- 公開側のアカウント表示と更新記録だけを調整し、管理画面ディレクトリや管理 API には触れていません。"
      }
    }, "2026-06-17T18:20:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-06-18-recent-update-icons", {
      zh: {
        title: "最近更新图标优化",
        summary: "首页最近更新会按站点更新类型显示工具图标。",
        content_markdown: "# 最近更新图标优化\n\n本次更新让首页“最近更新”列表更像一个网站更新窗口：从文章 API 读取的站点更新记录会显示工具图标，而不是全部显示成书本图标。\n\n## 更新内容\n\n- `site-updates` 类型的文章在首页最近更新列表中显示工具图标，普通文章仍回退为书本图标。\n- 本地 fallback 最近更新继续使用每条记录自己的图标，不影响无网络或接口失败时的展示。\n- 列表标题、摘要、日期和文章直链逻辑保持不变；只调整公开首页的视觉提示和更新记录。\n- 本轮没有触碰后台目录或管理接口。"
      },
      en: {
        title: "Recent Update Icons",
        summary: "The home recent-update list now shows a site-update tool icon.",
        content_markdown: "# Recent Update Icons\n\nThis update makes the home Recent Updates list feel more like a site-update window: site update records loaded from the article API now show a tool icon instead of every API-backed article looking like a book.\n\n## Changes\n\n- `site-updates` articles use a tool icon in the home Recent Updates list, while regular articles still fall back to the book icon.\n- Local fallback updates keep their per-item icons, so offline or failed API states stay readable.\n- Titles, summaries, dates, and article deep links are unchanged; only the public home visual hint and update record changed.\n- Admin folders and admin APIs were not touched."
      },
      ja: {
        title: "最近更新アイコンを調整",
        summary: "ホームの最近更新でサイト更新らしいツールアイコンを表示します。",
        content_markdown: "# 最近更新アイコンを調整\n\n今回の更新では、ホームの「最近更新」リストをサイト更新ウィンドウらしく整えました。記事 API から読み込んだサイト更新記録は、すべて本アイコンになるのではなく、ツールアイコンで表示します。\n\n## 更新内容\n\n- `site-updates` の記事はホームの最近更新リストでツールアイコンを使い、通常の記事は引き続き本アイコンに戻ります。\n- ローカル fallback の最近更新は各項目のアイコンを保ち、オフライン時や API 失敗時の表示も変えません。\n- タイトル、概要、日付、記事直リンクの動作はそのままで、公開ホームの視覚ヒントと更新記録だけを調整しました。\n- 管理画面ディレクトリや管理 API には触れていません。"
      }
    }, "2026-06-17T18:25:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-06-18-recent-updates-safe-dom", {
      zh: {
        title: "最近更新安全渲染",
        summary: "首页最近更新列表改为 DOM/textContent 构建。",
        content_markdown: "# 最近更新安全渲染\n\n本次更新把首页“最近更新”列表从字符串拼接改为 DOM / `textContent` 构建，让公开更新记录继续以纯文本方式渲染。\n\n## 更新内容\n\n- 最近更新的标题、摘要、日期和图标都改为 DOM 节点与文本节点输出，不再用模板字符串 `innerHTML` 组装列表。\n- `site-updates` 工具图标、普通文章书本图标、本地 fallback 图标和文章直链行为保持不变。\n- 列表仍显示最新 5 条站点更新；接口失败时仍回退到本地最近更新。\n- 本轮只调整公开首页最近更新列表和更新记录，不触碰后台目录或管理接口。"
      },
      en: {
        title: "Recent Updates Safe DOM",
        summary: "The home recent-update list now renders through DOM/textContent.",
        content_markdown: "# Recent Updates Safe DOM\n\nThis update changes the home Recent Updates list from string-built markup to DOM / `textContent` construction, keeping public update records rendered as plain text.\n\n## Changes\n\n- Recent-update titles, summaries, dates, and icons now render through DOM nodes and text nodes instead of template-string `innerHTML`.\n- The `site-updates` tool icon, regular article book fallback, local fallback icons, and article deep links are unchanged.\n- The list still shows the latest five site updates and still falls back to local updates if the API fails.\n- Only the public home Recent Updates list and update records changed; admin folders and admin APIs were not touched."
      },
      ja: {
        title: "最近更新の安全な DOM 描画",
        summary: "ホームの最近更新リストを DOM/textContent 構築にしました。",
        content_markdown: "# 最近更新の安全な DOM 描画\n\n今回の更新では、ホームの「最近更新」リストを文字列連結から DOM / `textContent` 構築へ変更し、公開更新記録を純テキストとして描画し続けます。\n\n## 更新内容\n\n- 最近更新のタイトル、概要、日付、アイコンはテンプレート文字列の `innerHTML` ではなく、DOM ノードとテキストノードで出力します。\n- `site-updates` のツールアイコン、通常記事の本アイコン fallback、ローカル fallback アイコン、記事直リンクの動作は変えていません。\n- リストは引き続き最新 5 件のサイト更新を表示し、API 失敗時はローカル最近更新へ戻ります。\n- 公開ホームの最近更新リストと更新記録だけを調整し、管理画面ディレクトリや管理 API には触れていません。"
      }
    }, "2026-06-17T18:40:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-06-18-knowledge-list-safe-dom", {
      zh: {
        title: "知识库列表安全渲染",
        summary: "知识库文章列表改为 DOM/textContent 构建。",
        content_markdown: "# 知识库列表安全渲染\n\n本次更新把公开知识库的文章卡片列表从字符串拼接改为 DOM / `textContent` 构建，继续降低公开文章字段进入页面时的 XSS 风险。\n\n## 更新内容\n\n- 文章标题、摘要、分类、标签、发布日期、fallback 提示和阅读按钮都改为 DOM 节点与文本节点输出。\n- 搜索、分类筛选、文章详情直链和阅读按钮行为保持不变。\n- 加载、失败、空列表和无搜索结果提示也改为纯文本节点渲染。\n- 本轮只调整公开知识库列表和更新记录，不触碰后台目录或管理接口。"
      },
      en: {
        title: "Knowledge List Safe DOM",
        summary: "Knowledge article cards now render through DOM/textContent.",
        content_markdown: "# Knowledge List Safe DOM\n\nThis update changes the public Knowledge article-card list from string-built markup to DOM / `textContent` construction, reducing XSS risk as public article fields enter the page.\n\n## Changes\n\n- Article titles, summaries, categories, tags, published dates, fallback notices, and read buttons now render through DOM nodes and text nodes.\n- Search, category filters, article deep links, and read-button behavior are unchanged.\n- Loading, failure, empty-list, and no-result states also render as plain text nodes.\n- Only the public Knowledge list and update records changed; admin folders and admin APIs were not touched."
      },
      ja: {
        title: "知識庫リストの安全な DOM 描画",
        summary: "知識庫の記事カードを DOM/textContent 構築にしました。",
        content_markdown: "# 知識庫リストの安全な DOM 描画\n\n今回の更新では、公開知識庫の記事カード一覧を文字列連結から DOM / `textContent` 構築へ変更し、公開記事フィールドがページに入るときの XSS リスクをさらに下げます。\n\n## 更新内容\n\n- 記事タイトル、概要、カテゴリ、タグ、公開日、fallback 表示、読むボタンを DOM ノードとテキストノードで出力します。\n- 検索、カテゴリ絞り込み、記事詳細直リンク、読むボタンの動作は変えていません。\n- 読み込み中、失敗、空リスト、検索結果なしの表示も純テキストノードで描画します。\n- 公開知識庫リストと更新記録だけを調整し、管理画面ディレクトリや管理 API には触れていません。"
      }
    }, "2026-06-17T18:45:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-06-18-knowledge-filters-safe-dom", {
      zh: {
        title: "知识库筛选安全渲染",
        summary: "知识库分类筛选按钮改为 DOM/textContent 构建。",
        content_markdown: "# 知识库筛选安全渲染\n\n本次更新继续收紧公开知识库，把分类筛选按钮从字符串拼接改为 DOM / `textContent` 构建。\n\n## 更新内容\n\n- 知识库分类按钮现在通过 `document.createElement('button')` 创建，分类名用 `textContent` 写入。\n- `data-filter`、`data-filter-type`、active 状态和点击筛选行为保持不变。\n- 和上一轮文章卡片 DOM 渲染配合后，知识库列表与筛选控件都不再依赖文章/分类字符串拼接输出。\n- 本轮只调整公开知识库筛选控件和更新记录，不触碰后台目录或管理接口。"
      },
      en: {
        title: "Knowledge Filters Safe DOM",
        summary: "Knowledge category filter buttons now render through DOM/textContent.",
        content_markdown: "# Knowledge Filters Safe DOM\n\nThis update keeps tightening the public Knowledge area by changing category filter buttons from string-built markup to DOM / `textContent` construction.\n\n## Changes\n\n- Knowledge category buttons are now created with `document.createElement('button')`, with labels assigned through `textContent`.\n- `data-filter`, `data-filter-type`, active state, and click filtering behavior are unchanged.\n- Together with the previous article-card DOM rendering pass, the Knowledge list and filter controls no longer rely on article/category string-built output.\n- Only the public Knowledge filter controls and update records changed; admin folders and admin APIs were not touched."
      },
      ja: {
        title: "知識庫フィルターの安全な DOM 描画",
        summary: "知識庫カテゴリーフィルターを DOM/textContent 構築にしました。",
        content_markdown: "# 知識庫フィルターの安全な DOM 描画\n\n今回の更新では、公開知識庫をさらに引き締め、カテゴリーフィルターボタンを文字列連結から DOM / `textContent` 構築へ変更しました。\n\n## 更新内容\n\n- 知識庫カテゴリーボタンは `document.createElement('button')` で作成し、ラベルは `textContent` で入れます。\n- `data-filter`、`data-filter-type`、active 状態、クリック絞り込み動作は変えていません。\n- 前回の記事カード DOM 描画と合わせて、知識庫リストとフィルター操作は記事/カテゴリ文字列の組み立て出力に依存しなくなりました。\n- 公開知識庫フィルターと更新記録だけを調整し、管理画面ディレクトリや管理 API には触れていません。"
      }
    }, "2026-06-17T18:55:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-06-18-resource-filters-safe-dom", {
      zh: {
        title: "资源筛选安全渲染",
        summary: "资源区分类筛选按钮改为 DOM/textContent 构建。",
        content_markdown: "# 资源筛选安全渲染\n\n本次更新继续收紧公开主站资源区，把分类筛选按钮从字符串拼接改为 DOM / `textContent` 构建。\n\n## 更新内容\n\n- 资源区分类按钮现在通过 `document.createElement('button')` 创建，按钮文案用 `textContent` 写入。\n- `data-filter`、`data-filter-type`、active 状态和点击筛选行为保持不变。\n- 视频区筛选本来已经使用 DOM 构建，本轮只补齐通用资源筛选按钮。\n- 本轮只调整公开资源区筛选控件和更新记录，不触碰后台目录或管理接口。"
      },
      en: {
        title: "Resource Filters Safe DOM",
        summary: "Resource category filter buttons now render through DOM/textContent.",
        content_markdown: "# Resource Filters Safe DOM\n\nThis update keeps tightening the public Resources area by changing category filter buttons from string-built markup to DOM / `textContent` construction.\n\n## Changes\n\n- Resource category buttons are now created with `document.createElement('button')`, with labels assigned through `textContent`.\n- `data-filter`, `data-filter-type`, active state, and click filtering behavior are unchanged.\n- Video filters were already DOM-built; this pass only completes the shared resource-filter path.\n- Only the public Resources filter controls and update records changed; admin folders and admin APIs were not touched."
      },
      ja: {
        title: "リソースフィルターの安全な DOM 描画",
        summary: "リソースカテゴリーフィルターを DOM/textContent 構築にしました。",
        content_markdown: "# リソースフィルターの安全な DOM 描画\n\n今回の更新では、公開リソース欄をさらに引き締め、カテゴリーフィルターボタンを文字列連結から DOM / `textContent` 構築へ変更しました。\n\n## 更新内容\n\n- リソースカテゴリーボタンは `document.createElement('button')` で作成し、ラベルは `textContent` で入れます。\n- `data-filter`、`data-filter-type`、active 状態、クリック絞り込み動作は変えていません。\n- 動画フィルターはすでに DOM 構築のため、本輪では共通のリソースフィルター経路だけを補いました。\n- 公開リソースフィルターと更新記録だけを調整し、管理画面ディレクトリや管理 API には触れていません。"
      }
    }, "2026-06-17T19:05:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-06-18-game-list-safe-dom", {
      zh: {
        title: "游戏列表安全渲染",
        summary: "游戏区列表卡片改为 DOM/textContent 构建。",
        content_markdown: "# 游戏列表安全渲染\n\n本次更新继续收紧公开主站游戏区，把游戏列表卡片从字符串模板改为 DOM / `textContent` 构建。\n\n## 更新内容\n\n- 游戏标题、简介、语言支持标签、许可证标签和加载/失败提示都改为 DOM 节点与文本节点输出。\n- 游戏封面仍保留懒加载与异步解码，入口链接和外部链接打开方式保持不变。\n- 游戏入口页、iframe、云存档同步、导入导出和游戏目录不变。\n- 本轮只调整公开游戏列表和更新记录，不触碰后台目录或管理接口。"
      },
      en: {
        title: "Game List Safe DOM",
        summary: "Game list cards now render through DOM/textContent.",
        content_markdown: "# Game List Safe DOM\n\nThis update keeps tightening the public Games area by changing game-list cards from string templates to DOM / `textContent` construction.\n\n## Changes\n\n- Game titles, summaries, language-support tags, license tags, and loading/failure states now render through DOM nodes and text nodes.\n- Game covers keep lazy loading and async decoding, and entry links plus external-link behavior are unchanged.\n- Game entry pages, iframes, cloud-save sync, import/export, and the game catalog are unchanged.\n- Only the public Games list and update records changed; admin folders and admin APIs were not touched."
      },
      ja: {
        title: "ゲーム一覧の安全な DOM 描画",
        summary: "ゲーム一覧カードを DOM/textContent 構築にしました。",
        content_markdown: "# ゲーム一覧の安全な DOM 描画\n\n今回の更新では、公開ゲーム欄をさらに引き締め、ゲーム一覧カードを文字列テンプレートから DOM / `textContent` 構築へ変更しました。\n\n## 更新内容\n\n- ゲームタイトル、概要、言語対応タグ、ライセンスタグ、読み込み/失敗表示を DOM ノードとテキストノードで出力します。\n- ゲームカバーの遅延読み込みと非同期デコード、入口リンク、外部リンクの開き方は変えていません。\n- ゲーム入口ページ、iframe、クラウド保存同期、インポート/エクスポート、ゲームカタログは変更していません。\n- 公開ゲーム一覧と更新記録だけを調整し、管理画面ディレクトリや管理 API には触れていません。"
      }
    }, "2026-06-17T19:20:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-06-18-game-url-allowlist", {
      zh: {
        title: "游戏链接白名单",
        summary: "游戏列表入口和封面路径补充白名单校验。",
        content_markdown: "# 游戏链接白名单\n\n本次更新继续收紧公开主站游戏区，让游戏列表的入口链接和封面路径在渲染前经过白名单校验。\n\n## 更新内容\n\n- 本地游戏入口只接受 `games/catalog.json` 中的安全目录名，继续生成 `/games/<entry>?lang=...` 链接。\n- 外部游戏链接和仓库链接只接受 `http(s)`，无效 URL 不会输出到页面。\n- 游戏封面只接受 `assets/images/` 下的常见图片路径，无效封面会回退到游戏图标。\n- 5 个现有游戏入口、iframe、云存档同步和导入导出逻辑保持不变。"
      },
      en: {
        title: "Game Link Allowlist",
        summary: "Game entry links and cover paths now use allowlist checks.",
        content_markdown: "# Game Link Allowlist\n\nThis update keeps tightening the public Games area by validating game entry links and cover paths before rendering them.\n\n## Changes\n\n- Local game entries only accept safe directory names from `games/catalog.json` and still produce `/games/<entry>?lang=...` links.\n- External game links and repository links only accept `http(s)`, so invalid URLs are not written into the page.\n- Game covers only accept common image paths under `assets/images/`; invalid covers fall back to the games icon.\n- The five existing game entries, iframes, cloud-save sync, and import/export behavior are unchanged."
      },
      ja: {
        title: "ゲームリンク許可リスト",
        summary: "ゲーム入口リンクとカバー画像パスに許可リスト確認を追加しました。",
        content_markdown: "# ゲームリンク許可リスト\n\n今回の更新では、公開ゲーム欄をさらに引き締め、ゲーム入口リンクとカバー画像パスを描画前に許可リストで確認します。\n\n## 更新内容\n\n- ローカルゲーム入口は `games/catalog.json` の安全なディレクトリ名だけを受け付け、引き続き `/games/<entry>?lang=...` リンクを生成します。\n- 外部ゲームリンクとリポジトリリンクは `http(s)` のみ受け付け、無効な URL はページに出力しません。\n- ゲームカバーは `assets/images/` 配下の一般的な画像パスのみ受け付け、無効な場合はゲームアイコンへ戻します。\n- 既存 5 件のゲーム入口、iframe、クラウド保存同期、インポート/エクスポート動作は変更していません。"
      }
    }, "2026-06-17T19:35:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-06-18-video-url-allowlist", {
      zh: {
        title: "视频链接白名单",
        summary: "视频缩略图、原地址和播放器 iframe 补充前端白名单。",
        content_markdown: "# 视频链接白名单\n\n本次更新继续收紧公开主站视频区，让视频缩略图、原地址和播放器 iframe 在前端也经过白名单校验。\n\n## 更新内容\n\n- 视频卡片缩略图只接受 YouTube / Bilibili 图片域或后台上传的本地 `data:image` 封面。\n- “打开原地址”只接受 YouTube、Bilibili 和 b23 链接，无效 URL 会隐藏按钮。\n- 播放器 iframe 只接受 YouTube embed 或 Bilibili player 地址，无效 embed 会显示原有不支持提示。\n- 公开视频 API、后台视频管理、视频空状态和移动端布局保持不变。"
      },
      en: {
        title: "Video Link Allowlist",
        summary: "Video thumbnails, source links, and player iframes now have frontend allowlist checks.",
        content_markdown: "# Video Link Allowlist\n\nThis update keeps tightening the public Videos area by validating video thumbnails, source links, and player iframes on the frontend too.\n\n## Changes\n\n- Video card thumbnails only accept YouTube / Bilibili image hosts or local `data:image` thumbnails uploaded through the admin flow.\n- Open Original only accepts YouTube, Bilibili, and b23 links; invalid URLs hide the button.\n- Player iframes only accept YouTube embed or Bilibili player URLs; invalid embeds fall back to the existing unsupported-video notice.\n- Public video APIs, admin video management, the empty video state, and mobile layout are unchanged."
      },
      ja: {
        title: "動画リンク許可リスト",
        summary: "動画サムネイル、元リンク、プレイヤー iframe にフロント側の許可リスト確認を追加しました。",
        content_markdown: "# 動画リンク許可リスト\n\n今回の更新では、公開動画欄をさらに引き締め、動画サムネイル、元リンク、プレイヤー iframe をフロント側でも許可リストで確認します。\n\n## 更新内容\n\n- 動画カードのサムネイルは YouTube / Bilibili の画像ホスト、または管理画面でアップロードされたローカル `data:image` 封面だけを受け付けます。\n- 「元のページを開く」は YouTube、Bilibili、b23 リンクだけを受け付け、無効な URL ではボタンを隠します。\n- プレイヤー iframe は YouTube embed または Bilibili player の URL だけを受け付け、無効な embed は既存の未対応表示へ戻します。\n- 公開動画 API、管理画面の動画管理、動画空状態、モバイル表示は変更していません。"
      }
    }, "2026-06-17T19:50:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-06-18-resource-url-allowlist", {
      zh: {
        title: "资源链接白名单",
        summary: "资源下载和外链 URL 增加更严格的前端白名单。",
        content_markdown: "# 资源链接白名单\n\n本次更新继续收紧公开主站资源区，让资源下载和外链地址在渲染前经过更明确的 URL 白名单。\n\n## 更新内容\n\n- 资源区下载/外链 URL 先经过 `safeHttpUrl()` 规范化，只接受 `http(s)` 外链。\n- 本地资源路径只接受安全的 `assets/` 或 `downloads/` 路径，并拒绝 `..` 路径穿越片段。\n- 无效 URL 继续显示原有的准备中按钮，不会输出不可信链接。\n- 现有 3 个资源占位卡、分类筛选、移动端布局和后台目录保持不变。"
      },
      en: {
        title: "Resource URL Allowlist",
        summary: "Resource downloads and external links now use stricter frontend URL allowlist checks.",
        content_markdown: "# Resource URL Allowlist\n\nThis update keeps tightening the public Resources area by checking resource download and external-link URLs against a clearer frontend allowlist before rendering.\n\n## Changes\n\n- Resource download and external URLs now pass through `safeHttpUrl()` normalization and only accept `http(s)` external links.\n- Local resource paths only accept safe `assets/` or `downloads/` paths and reject `..` traversal segments.\n- Invalid URLs keep showing the existing coming-soon button instead of writing untrusted links into the page.\n- The three current resource placeholder cards, category filters, mobile layout, and admin folders are unchanged."
      },
      ja: {
        title: "リソースURL許可リスト",
        summary: "リソースのダウンロードと外部リンクに、より厳しいフロント側URL許可リスト確認を追加しました。",
        content_markdown: "# リソースURL許可リスト\n\n今回の更新では、公開リソース欄をさらに引き締め、リソースのダウンロードと外部リンクの URL を描画前により明確な許可リストで確認します。\n\n## 更新内容\n\n- リソースのダウンロード/外部 URL は `safeHttpUrl()` で正規化し、外部リンクは `http(s)` のみ受け付けます。\n- ローカルリソースパスは安全な `assets/` または `downloads/` パスだけを受け付け、`..` のパストラバーサル片を拒否します。\n- 無効な URL は既存の準備中ボタンを表示し続け、不審なリンクをページに出力しません。\n- 既存 3 件のリソース占位カード、カテゴリーフィルター、モバイル表示、管理画面ディレクトリは変更していません。"
      }
    }, "2026-06-17T20:05:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-06-18-article-image-path-guard", {
      zh: {
        title: "文章图片路径守卫",
        summary: "文章 Markdown 配图白名单补充路径穿越片段拒绝。",
        content_markdown: "# 文章图片路径守卫\n\n本次更新继续收紧公开知识库的文章图片渲染规则，让 Markdown 配图路径更明确地留在项目文章图片目录内。\n\n## 更新内容\n\n- 文章 Markdown 图片仍只允许 `assets/images/articles/` 下的项目资源。\n- `safeArticleImageSrc()` 新增 `..` 路径片段拒绝，避免图片路径逃出文章图片目录。\n- 图片仍通过 `document.createElement('img')`、安全 `src`、`alt` 和 `figcaption` 渲染，不插入未处理 HTML。\n- 现有 AI Agent 长文配图、知识库列表、文章直链和后台目录保持不变。"
      },
      en: {
        title: "Article Image Path Guard",
        summary: "Markdown article image allowlist now rejects traversal path segments.",
        content_markdown: "# Article Image Path Guard\n\nThis update keeps tightening public Knowledge article image rendering so Markdown image paths stay clearly inside the project article-image folder.\n\n## Changes\n\n- Markdown article images are still limited to project assets under `assets/images/articles/`.\n- `safeArticleImageSrc()` now rejects `..` traversal segments so image paths cannot escape the article-image folder.\n- Images still render through `document.createElement('img')`, safe `src`, `alt`, and `figcaption` instead of raw HTML insertion.\n- The existing AI Agent article images, Knowledge list, article deep links, and admin folders are unchanged."
      },
      ja: {
        title: "記事画像パスガード",
        summary: "Markdown 記事画像の許可リストが、パストラバーサル片を拒否するようになりました。",
        content_markdown: "# 記事画像パスガード\n\n今回の更新では、公開知識庫の記事画像描画をさらに引き締め、Markdown 画像パスがプロジェクトの記事画像フォルダ内に留まるよう明確にしました。\n\n## 更新内容\n\n- Markdown 記事画像は引き続き `assets/images/articles/` 配下のプロジェクト資源だけを受け付けます。\n- `safeArticleImageSrc()` が `..` のパストラバーサル片を拒否し、画像パスが記事画像フォルダから外へ出ないようにしました。\n- 画像は今後も `document.createElement('img')`、安全な `src`、`alt`、`figcaption` で描画し、未処理 HTML は挿入しません。\n- 既存の AI Agent 長文画像、知識庫一覧、記事直リンク、管理画面ディレクトリは変更していません。"
      }
    }, "2026-06-17T20:20:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-06-18-resource-empty-state", {
      zh: {
        title: "资源空分类提示",
        summary: "资源区空分类现在会显示三语空状态和返回全部资源按钮。",
        content_markdown: "# 资源空分类提示\n\n本次更新继续整理资源区筛选体验，点击暂无资源的分类时不再只看到空白列表。\n\n## 更新内容\n\n- 资源区空分类会显示 XP 风格空状态，说明该分类仍在整理中。\n- 空状态提供“显示全部资源”按钮，可直接回到全部资源列表。\n- 标题、说明和按钮都通过 DOM / `textContent` 构建，不插入未处理 HTML。\n- 本轮只调整公开资源区、前端样式、缓存版本和更新记录；后台目录和管理 API 不受影响。"
      },
      en: {
        title: "Resource Empty Category State",
        summary: "Empty resource categories now show a trilingual empty state with a button back to all resources.",
        content_markdown: "# Resource Empty Category State\n\nThis update keeps polishing the Resources filter flow so categories with no items no longer leave a blank list behind.\n\n## Changes\n\n- Empty resource categories now show an XP-style empty state explaining that the category is still being organized.\n- The empty state includes a `Show all resources` button that returns the filter to the full list.\n- The title, copy, and button are built through DOM / `textContent`, with no raw HTML insertion.\n- This round only changes the public Resources area, frontend styling, cache version, and update records; admin folders and admin APIs are untouched."
      },
      ja: {
        title: "リソース空分類表示",
        summary: "空のリソース分類に三言語の空状態とすべてへ戻るボタンを表示します。",
        content_markdown: "# リソース空分類表示\n\n今回の更新ではリソース欄のフィルター体験を整え、項目がない分類でも空白だけにならないようにしました。\n\n## 更新内容\n\n- 空のリソース分類では XP 風の空状態を表示し、その分類が整理中であることを伝えます。\n- 空状態には「すべてのリソースを表示」ボタンを追加し、全件表示へ戻れるようにしました。\n- タイトル、説明、ボタンは DOM / `textContent` で構築し、未処理 HTML は挿入しません。\n- 今回は公開リソース欄、フロント側スタイル、キャッシュ版、更新記録だけを調整し、管理画面や管理 API には触れていません。"
      }
    }, "2026-06-17T23:58:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-06-18-resource-filter-counts", {
      zh: {
        title: "资源分类数量徽标",
        summary: "资源区分类按钮现在显示每类资源数量，筛选前就能看到占位和资源分布。",
        content_markdown: "# 资源分类数量徽标\n\n本次更新继续整理资源区，让分类筛选按钮直接显示每一类里有多少资源项。\n\n## 更新内容\n\n- 资源区筛选按钮新增数量徽标：全部显示资源总数，各分类显示当前分类数量。\n- 数量来自本地 `content.resources`，不会改变资源卡片、下载按钮或外链安全校验。\n- 按钮继续通过 DOM / `textContent` 构建，分类名和数量都不会当作 HTML 插入。\n- 本轮只调整公开资源区、前端样式、缓存版本和更新记录；后台目录和管理 API 不受影响。"
      },
      en: {
        title: "Resource Filter Counts",
        summary: "Resource category buttons now show item counts before filtering.",
        content_markdown: "# Resource Filter Counts\n\nThis update keeps polishing the Resources area by showing how many items sit behind each category filter.\n\n## Changes\n\n- Resource filter buttons now include compact count badges: All shows the total, and each category shows its own count.\n- Counts come from local `content.resources`; resource cards, download buttons, and safe link checks are unchanged.\n- Buttons still render through DOM / `textContent`, so category labels and counts are never inserted as HTML.\n- This round only changes the public Resources area, frontend styling, cache version, and update records; admin folders and admin APIs are untouched."
      },
      ja: {
        title: "リソース分類数バッジ",
        summary: "リソース分類ボタンに件数を表示し、絞り込み前に配分が分かるようにしました。",
        content_markdown: "# リソース分類数バッジ\n\n今回の更新ではリソース欄を少し整え、分類フィルターごとの件数をボタン上で分かるようにしました。\n\n## 更新内容\n\n- リソース分類ボタンに小さな件数バッジを追加しました。すべては総数、各分類はその分類の件数を表示します。\n- 件数はローカルの `content.resources` から数え、リソースカード、ダウンロードボタン、リンク安全確認は変更しません。\n- ボタンは引き続き DOM / `textContent` で構築し、分類名や件数を HTML として挿入しません。\n- 今回は公開リソース欄、フロント側スタイル、キャッシュ版、更新記録だけを調整し、管理画面や管理 API には触れていません。"
      }
    }, "2026-06-17T23:55:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-06-18-resource-status-badges", {
      zh: {
        title: "资源卡片状态徽标",
        summary: "资源区卡片会显示准备中或可获取状态，下载按钮逻辑继续走安全链接校验。",
        content_markdown: "# 资源卡片状态徽标\n\n本次更新继续整理资源区，让每张资源卡在按钮之外也能看到当前状态。\n\n## 更新内容\n\n- 资源卡片 meta row 新增状态徽标：没有安全 URL 时显示“准备中”，有可用 URL 时显示“可获取”。\n- 状态判断复用 `safeResourceUrl()`，下载/外链按钮继续只接受安全项目路径或 `http(s)` 链接。\n- 资源标题、简介、版本、大小和原有禁用按钮行为保持不变。\n- 本轮只调整公开资源区、前端文案、样式和更新记录，不触碰后台目录或管理 API。"
      },
      en: {
        title: "Resource Status Badges",
        summary: "Resource cards now show pending or ready status badges while download actions still use safe link checks.",
        content_markdown: "# Resource Status Badges\n\nThis update continues polishing the Resources area so each card shows its current availability outside the action button too.\n\n## Changes\n\n- Resource card meta rows now include a status badge: `Coming soon` when no safe URL exists, and `Ready` when one is available.\n- Status detection reuses `safeResourceUrl()`, so download/external actions still only accept safe project paths or `http(s)` links.\n- Resource titles, summaries, versions, sizes, and disabled action behavior are unchanged.\n- This round only changes the public Resources area, frontend text, styling, and update records; admin folders and admin APIs are untouched."
      },
      ja: {
        title: "リソース状態バッジ",
        summary: "リソースカードに準備中または利用可の状態バッジを追加し、リンク確認は従来どおりです。",
        content_markdown: "# リソース状態バッジ\n\n今回の更新では、リソース欄を少し整え、各カードの状態をボタン以外からも分かるようにしました。\n\n## 更新内容\n\n- リソースカードの meta row に状態バッジを追加しました。安全な URL がない場合は「準備中」、利用できる URL がある場合は「利用可」を表示します。\n- 状態判定は `safeResourceUrl()` を再利用し、ダウンロード/外部リンクは引き続き安全なプロジェクト内パスまたは `http(s)` のみ受け付けます。\n- リソースのタイトル、概要、バージョン、サイズ、無効ボタンの動作は変更していません。\n- 今回は公開リソース欄、フロント文言、スタイル、更新記録だけを調整し、管理画面ディレクトリや管理 API には触れていません。"
      }
    }, "2026-06-17T23:50:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-06-18-game-info-badges", {
      zh: {
        title: "游戏卡片信息增强",
        summary: "游戏区卡片新增云存档和源码徽标，进入游戏前能看到保存与开源状态。",
        content_markdown: "# 游戏卡片信息增强\n\n本次更新继续整理公开游戏区，让游戏入口卡片在进入前展示更清楚的状态信息。\n\n## 更新内容\n\n- 游戏卡片会根据 catalog 的 `storage` 字段显示“云存档”徽标。\n- 有 `repo` 的游戏会显示“源码”链接，并且链接会先通过 `safeHttpUrl()` 校验，只接受 `http(s)`。\n- 语言支持、license、开始按钮、iframe 入口和云存档同步逻辑保持不变。\n- 本轮只调整公开游戏列表、前端文案、样式和更新记录，不触碰后台目录或管理 API。"
      },
      en: {
        title: "Game Card Info Badges",
        summary: "Game cards now show cloud-save and source badges before launch.",
        content_markdown: "# Game Card Info Badges\n\nThis update continues polishing the public games area so entry cards show clearer status before launch.\n\n## Changes\n\n- Game cards now show a `Cloud save` badge when the catalog entry declares storage keys or score storage.\n- Games with a `repo` now show a `Source` link, with the URL normalized through `safeHttpUrl()` and limited to `http(s)`.\n- Language support tags, license tags, start buttons, iframe entry points, and cloud-save sync behavior are unchanged.\n- This round only changes the public game list, frontend text, styling, and update records; admin folders and admin APIs are untouched."
      },
      ja: {
        title: "ゲームカード情報バッジ",
        summary: "ゲームカードにクラウド保存とソースのバッジを追加し、起動前に状態を確認できます。",
        content_markdown: "# ゲームカード情報バッジ\n\n今回の更新では、公開ゲーム欄を少し整え、起動前に入口カードで状態を確認しやすくしました。\n\n## 更新内容\n\n- catalog の `storage` があるゲームカードに「クラウド保存」バッジを表示します。\n- `repo` があるゲームには「出典」リンクを表示し、URL は `safeHttpUrl()` で確認して `http(s)` のみ受け付けます。\n- 言語対応タグ、ライセンスタグ、開始ボタン、iframe 入口、クラウド保存同期の動作は変更していません。\n- 今回は公開ゲーム一覧、フロント文言、スタイル、更新記録だけを調整し、管理画面ディレクトリや管理 API には触れていません。"
      }
    }, "2026-06-17T23:35:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-06-18-article-scroll-top", {
      zh: {
        title: "文章回到顶部按钮",
        summary: "知识库文章详情新增回到顶部按钮，目录跳转后可以快速回到标题区。",
        content_markdown: "# 文章回到顶部按钮\n\n本次更新继续整理知识库长文阅读工具，在文章详情动作区新增一个轻量的回到顶部按钮。\n\n## 更新内容\n\n- 文章详情复制链接按钮旁新增“回到顶部 / Back to top / 先頭へ戻る”三语按钮。\n- 点击后只滚动当前文章详情容器，并同步阅读进度条，不改变页面路由或正文内容。\n- 按钮使用现有 DOM 事件代理和 `data-i18n` 文案，不插入外部 HTML。\n- 目录导航、Markdown 安全渲染、聊天和后台接口保持不变。"
      },
      en: {
        title: "Article Back-to-Top Button",
        summary: "Knowledge article details now include a back-to-top button after jumping through contents.",
        content_markdown: "# Article Back-to-Top Button\n\nThis update continues refining long-form Knowledge reading tools with a lightweight back-to-top action in article detail windows.\n\n## Changes\n\n- Article details now show a trilingual `回到顶部 / Back to top / 先頭へ戻る` button beside the copy-link action.\n- Clicking it scrolls only the current article detail container and keeps the reading progress bar in sync, without changing the route or article body.\n- The button uses the existing DOM event delegation and `data-i18n` text, with no external HTML insertion.\n- Contents navigation, safe Markdown rendering, chat, and admin APIs are unchanged."
      },
      ja: {
        title: "記事先頭へ戻るボタン",
        summary: "知識庫の記事詳細に先頭へ戻るボタンを追加し、目次移動後に戻りやすくしました。",
        content_markdown: "# 記事先頭へ戻るボタン\n\n今回の更新では、知識庫の長文閲覧ツールをもう少し整え、記事詳細の操作列に軽い先頭へ戻るボタンを追加しました。\n\n## 更新内容\n\n- 記事詳細のリンクコピーボタン横に `回到顶部 / Back to top / 先頭へ戻る` の三言語ボタンを追加しました。\n- クリック時は現在の記事詳細コンテナだけを先頭へスクロールし、読書進捗バーも同期します。ルートや本文は変更しません。\n- ボタンは既存の DOM イベント委譲と `data-i18n` 文言を使い、外部 HTML は挿入しません。\n- 目次ナビ、安全な Markdown 描画、チャット、管理 API は変更していません。"
      }
    }, "2026-06-17T23:20:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-06-18-article-toc", {
      zh: {
        title: "文章目录导航",
        summary: "知识库文章详情会按正文标题生成目录，长文可以快速跳到对应段落。",
        content_markdown: "# 文章目录导航\n\n本次更新继续优化知识库长文阅读，在文章详情里新增由正文标题生成的目录导航。\n\n## 更新内容\n\n- 文章 Markdown 安全渲染完成后，会读取正文里的 `h2` / `h3` 标题生成目录按钮。\n- 目录按钮使用 DOM / `textContent` 创建，并只允许滚动到 `article-heading-N` 这种内部目标。\n- 少于两个标题的文章不会显示目录，避免短文多出无意义控件。\n- 阅读进度条、复制链接、语言切换和后台目录保持不变。"
      },
      en: {
        title: "Article Contents Navigation",
        summary: "Knowledge article details now build a contents strip from body headings for quicker jumps.",
        content_markdown: "# Article Contents Navigation\n\nThis update continues improving long-form Knowledge reading with a contents strip generated from article body headings.\n\n## Changes\n\n- After safe Markdown rendering finishes, `h2` / `h3` headings are read and turned into contents buttons.\n- Contents buttons are created through DOM / `textContent` and only scroll to internal `article-heading-N` targets.\n- Articles with fewer than two headings hide the contents strip, so short posts do not gain extra controls.\n- The reading progress bar, copy link, language switching, and admin folders are unchanged."
      },
      ja: {
        title: "記事目次ナビ",
        summary: "知識庫の記事詳細で本文見出しから目次を作り、長文の移動を速くしました。",
        content_markdown: "# 記事目次ナビ\n\n今回の更新では、知識庫の長文を読みやすくするため、記事本文の見出しから作る目次ナビを追加しました。\n\n## 更新内容\n\n- 安全な Markdown 描画が終わったあと、本文内の `h2` / `h3` 見出しを読み取り、目次ボタンを生成します。\n- 目次ボタンは DOM / `textContent` で作り、`article-heading-N` 形式の内部目標だけへスクロールします。\n- 見出しが2つ未満の記事では目次を非表示にし、短い記事に余分な操作を増やしません。\n- 読書進捗バー、リンクコピー、言語切り替え、管理画面ディレクトリは変更していません。"
      }
    }, "2026-06-17T23:05:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-06-18-article-progress", {
      zh: {
        title: "文章阅读进度条",
        summary: "知识库文章详情新增阅读进度条，长文滚动时可以看到当前位置。",
        content_markdown: "# 文章阅读进度条\n\n本次更新继续打磨知识库阅读体验，在文章详情窗口里加入一个轻量的阅读进度提示。\n\n## 更新内容\n\n- 文章详情头部下方新增三语“阅读进度”槽条和百分比。\n- 长文滚动时进度条通过 `transform: scaleX()` 更新，不改变文章正文布局。\n- 进度条的文字、数值和 `progressbar` 可访问状态都通过 DOM / `textContent` 更新。\n- Markdown 正文仍使用安全渲染流程，后台目录和管理接口不受影响。"
      },
      en: {
        title: "Article Reading Progress",
        summary: "Knowledge article details now show a reading progress bar while long posts scroll.",
        content_markdown: "# Article Reading Progress\n\nThis update continues polishing the Knowledge reading experience with a lightweight progress indicator inside article detail windows.\n\n## Changes\n\n- Article details now show a trilingual reading-progress strip and percentage below the header.\n- While long posts scroll, the fill updates with `transform: scaleX()` without changing the article body layout.\n- The label, percentage, and `progressbar` accessibility state update through DOM / `textContent` paths.\n- Markdown article content still uses the safe rendering flow, with admin folders and admin APIs untouched."
      },
      ja: {
        title: "記事の読書進捗バー",
        summary: "知識庫の記事詳細に読書進捗バーを追加し、長文スクロール中の位置が分かるようになりました。",
        content_markdown: "# 記事の読書進捗バー\n\n今回の更新では、知識庫の記事詳細ウィンドウに軽い読書進捗表示を追加し、長文を読みやすくしました。\n\n## 更新内容\n\n- 記事詳細のヘッダー下に三言語の「読書進捗」バーとパーセント表示を追加しました。\n- 長文スクロール時は `transform: scaleX()` でバーだけを更新し、本文レイアウトは動かしません。\n- ラベル、数値、`progressbar` のアクセシビリティ状態は DOM / `textContent` 経由で更新します。\n- Markdown 本文は引き続き安全な描画フローを使い、管理画面ディレクトリや管理 API には触れていません。"
      }
    }, "2026-06-17T22:50:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-06-18-article-link-lang", {
      zh: {
        title: "文章链接保留语言",
        summary: "文章卡片和最近更新链接现在会带上当前 lang 参数。",
        content_markdown: "# 文章链接保留语言\n\n本次更新继续整理公开文章入口，让复制链接、右键新开标签和普通点击保持一致的语言上下文。\n\n## 更新内容\n\n- 知识库文章卡片的真实 `href` 会带上当前 `lang` 参数。\n- 欢迎窗口最近更新列表的文章链接也会带上当前 `lang` 参数，右键新开标签不会掉回默认语言。\n- 文章详情里的“复制文章链接”复用同一条链接生成逻辑，继续输出当前语言直链。\n- 点击拦截、文章安全渲染、站点地图和后台目录保持不变。"
      },
      en: {
        title: "Article Links Keep Language",
        summary: "Article cards and recent-update links now include the active lang parameter.",
        content_markdown: "# Article Links Keep Language\n\nThis update keeps public article entry points aligned so copied links, new tabs, and normal clicks preserve the same language context.\n\n## Changes\n\n- Knowledge article card `href` values now include the active `lang` parameter.\n- Welcome-window Recent Updates article links also include the active `lang`, so opening in a new tab does not fall back to the default language.\n- The article detail copy-link button reuses the same link helper and still outputs a current-language deep link.\n- Click interception, safe article rendering, sitemap output, and admin folders are unchanged."
      },
      ja: {
        title: "記事リンクの言語保持",
        summary: "記事カードと最近の更新リンクに現在の lang パラメータを含めました。",
        content_markdown: "# 記事リンクの言語保持\n\n今回の更新では、公開記事への入口を整え、コピーしたリンク、新しいタブ、通常クリックで同じ言語コンテキストを保てるようにしました。\n\n## 更新内容\n\n- 知識庫の記事カードの実際の `href` に現在の `lang` パラメータを含めます。\n- ウェルカム画面の最近の更新リンクにも現在の `lang` を含め、新しいタブで開いても既定言語に戻りません。\n- 記事詳細の「記事リンクをコピー」ボタンも同じリンク生成処理を使い、現在言語の直リンクを出力します。\n- クリック処理、安全な記事描画、サイトマップ、管理画面ディレクトリは変更していません。"
      }
    }, "2026-06-17T22:20:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-06-18-recent-update-labels", {
      zh: {
        title: "最近更新完整提示",
        summary: "最近更新链接补充完整 title 和 aria-label，截断标题也能读到完整内容。",
        content_markdown: "# 最近更新完整提示\n\n本次更新继续打磨欢迎窗口里的最近更新面板，让被截断的更新标题也能被完整读取。\n\n## 更新内容\n\n- 每条最近更新链接新增完整 `title` 和 `aria-label`，包含标题、摘要和日期。\n- 屏幕上仍保留紧凑的截断标题与摘要，窗口布局和 XP 面板样式不变。\n- 标题、摘要和日期继续通过 DOM / `textContent` 输出，不插入未处理 HTML。\n- 本轮只调整公开最近更新面板、前端缓存版本和更新记录，不触碰后台目录或管理接口。"
      },
      en: {
        title: "Recent Update Full Labels",
        summary: "Recent update links now include full title and aria-label text when visible text is truncated.",
        content_markdown: "# Recent Update Full Labels\n\nThis update continues polishing the welcome-window Recent Updates panel so truncated update titles still expose the full context.\n\n## Changes\n\n- Each recent-update link now gets a full `title` and `aria-label` containing the title, summary, and date.\n- The visible panel keeps its compact truncated title and summary, so the XP layout stays unchanged.\n- Titles, summaries, and dates still render through DOM / `textContent`, with no raw HTML insertion.\n- This round only changes the public Recent Updates panel, frontend cache version, and update records; admin folders and admin APIs are untouched."
      },
      ja: {
        title: "最近の更新ラベル補足",
        summary: "最近の更新リンクに完全な title と aria-label を追加しました。",
        content_markdown: "# 最近の更新ラベル補足\n\n今回の更新では、ウェルカム画面の「最近の更新」パネルを少し整え、省略された更新タイトルでも内容を確認しやすくしました。\n\n## 更新内容\n\n- 各最近更新リンクに、タイトル・概要・日付を含む完全な `title` と `aria-label` を追加しました。\n- 画面上はこれまで通りコンパクトな省略表示のまま、XP 風パネルのレイアウトは変更していません。\n- タイトル、概要、日付は引き続き DOM / `textContent` で描画し、未処理 HTML は挿入しません。\n- 今回は公開側の最近の更新パネル、フロントのキャッシュ版、更新記録だけを調整し、管理画面ディレクトリや管理 API には触れていません。"
      }
    }, "2026-06-17T22:05:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-06-18-static-image-dimensions", {
      zh: {
        title: "静态图片尺寸提示",
        summary: "首屏和固定 UI 的静态图片补充了真实尺寸属性。",
        content_markdown: "# 静态图片尺寸提示\n\n本次更新继续做轻量性能打磨，为公开主站里几处固定 UI 图片补充真实尺寸属性。\n\n## 更新内容\n\n- 顶部品牌头像、聊天室头像、关于页头像和底部 Start 图标新增 `width` / `height`。\n- 属性使用图片自身像素尺寸，现有 CSS 展示尺寸和响应式布局保持不变。\n- 浏览器可以在图片解码前预留稳定比例，减少首屏和固定 UI 的布局不确定性。\n- 本轮只调整公开首页标记、更新记录和本地 fallback，不触碰后台目录或管理接口。"
      },
      en: {
        title: "Static Image Dimensions",
        summary: "Static images in the first-screen and fixed UI now declare real dimensions.",
        content_markdown: "# Static Image Dimensions\n\nThis update continues lightweight performance polish by adding real dimensions to several fixed UI images on the public site.\n\n## Changes\n\n- The top brand avatar, chat room avatar, about-page avatar, and bottom Start icon now declare `width` / `height`.\n- The attributes use each image's intrinsic pixel size; existing CSS display sizes and responsive behavior are unchanged.\n- Browsers can reserve a stable ratio before image decoding, reducing layout uncertainty in the first-screen and fixed UI.\n- This round only changes public homepage markup, update records, and local fallback data; admin folders and admin APIs are untouched."
      },
      ja: {
        title: "静的画像サイズ指定",
        summary: "初期画面と固定 UI の静的画像に実寸属性を追加しました。",
        content_markdown: "# 静的画像サイズ指定\n\n今回の更新では、公開サイトの固定 UI 画像に実寸属性を追加し、軽量なパフォーマンス調整を続けました。\n\n## 更新内容\n\n- 上部ブランド画像、チャット画像、プロフィール画像、下部 Start アイコンに `width` / `height` を追加しました。\n- 属性は画像本来のピクセルサイズを使い、既存 CSS の表示サイズとレスポンシブ挙動は変更していません。\n- ブラウザーが画像デコード前に安定した比率を確保でき、初期画面と固定 UI のレイアウト揺れを減らします。\n- 今回は公開ホームのマークアップ、更新記録、ローカル fallback のみを調整し、管理画面ディレクトリや管理 API には触れていません。"
      }
    }, "2026-06-17T21:20:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-06-18-article-tag-locales", {
      zh: {
        title: "文章标签本地化",
        summary: "公开知识库和站点更新标签补齐了更多三语显示。",
        content_markdown: "# 文章标签本地化\n\n本次更新继续打磨知识库和站点更新的阅读细节，让更多公开文章标签跟随当前语言显示。\n\n## 更新内容\n\n- `tagLabels` 补齐安全、iframe、聊天室、云存档、筛选、图片、账号等常见标签。\n- 知识库列表、文章详情和首页最近更新会继续通过 `articleTagName()` 输出对应语言标签。\n- 标签仍由 DOM / `textContent` 渲染，不改变文章内容、文章接口或管理后台数据。\n- `index.html` 的主脚本缓存版本已更新，帮助浏览器加载新的标签映射。"
      },
      en: {
        title: "Article Tag Locales",
        summary: "More public knowledge and site-update tags now have localized labels.",
        content_markdown: "# Article Tag Locales\n\nThis update continues polishing the reading details in the knowledge base and site update log so more public article tags follow the active language.\n\n## Changes\n\n- `tagLabels` now covers common tags such as security, iframe, chat room, cloud saves, filters, images, and account.\n- The knowledge list, article detail view, and home recent updates continue to use `articleTagName()` for localized tag labels.\n- Tags still render through DOM / `textContent`, with no change to article content, article APIs, or admin data.\n- `index.html` now points at a new main-script cache version so browsers load the updated tag map."
      },
      ja: {
        title: "記事タグのローカライズ",
        summary: "公開知識庫とサイト更新のタグに、さらに多言語表示を追加しました。",
        content_markdown: "# 記事タグのローカライズ\n\n今回の更新では、知識庫とサイト更新ログの読書細部をさらに整え、より多くの公開記事タグが現在の言語に合わせて表示されるようにしました。\n\n## 更新内容\n\n- `tagLabels` に安全、iframe、チャット、クラウド保存、フィルター、画像、アカウントなどの一般的なタグを追加しました。\n- 知識庫一覧、記事詳細、ホームの最近更新は引き続き `articleTagName()` で言語別タグを表示します。\n- タグは引き続き DOM / `textContent` で描画し、記事本文、記事 API、管理画面データは変更していません。\n- `index.html` のメインスクリプトのキャッシュ版を更新し、新しいタグマップを読み込めるようにしました。"
      }
    }, "2026-06-17T21:05:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-06-18-game-frame-source-guard", {
      zh: {
        title: "游戏 iframe 启动守卫",
        summary: "游戏入口页会先校验 iframe 启动路径和语言参数名。",
        content_markdown: "# 游戏 iframe 启动守卫\n\n本次更新继续收紧公开游戏入口页，让游戏 iframe 只从可信的本地 source 页面启动。\n\n## 更新内容\n\n- `game-shell.js` 新增 `safeGameSourceEntry()`，只接受 catalog 中的 `source/...html` 本地页面路径。\n- `languageQueryParam` 新增格式校验，异常配置会回退到 `lang`，避免未校验参数名直接进入 iframe URL。\n- 5 个游戏入口页更新 `game-shell.js` 缓存版本，确保浏览器加载新的守卫逻辑。\n- 游戏列表、云存档、存档导入导出、语言选择和现有游戏内容保持不变。"
      },
      en: {
        title: "Game Frame Source Guard",
        summary: "Game entry pages now validate iframe launch paths and language query names first.",
        content_markdown: "# Game Frame Source Guard\n\nThis update tightens the public game entry pages so game iframes only launch trusted local source pages.\n\n## Changes\n\n- `game-shell.js` now includes `safeGameSourceEntry()`, accepting only local `source/...html` paths from the catalog.\n- `languageQueryParam` is format-checked and falls back to `lang` when the catalog value is invalid.\n- All five game entry pages now request a new `game-shell.js` cache version so browsers load the guard.\n- The game list, cloud saves, save import/export, language selection, and existing game content are unchanged."
      },
      ja: {
        title: "ゲームフレーム起動ガード",
        summary: "ゲーム入口ページが iframe 起動パスと言語パラメータ名を先に確認します。",
        content_markdown: "# ゲームフレーム起動ガード\n\n今回の更新では、公開ゲーム入口ページをさらに引き締め、ゲーム iframe が信頼できるローカル source ページだけから起動するようにしました。\n\n## 更新内容\n\n- `game-shell.js` に `safeGameSourceEntry()` を追加し、catalog の `source/...html` ローカルページだけを受け付けます。\n- `languageQueryParam` は形式を確認し、無効な値は `lang` に戻します。\n- 5 つのゲーム入口ページで `game-shell.js` のキャッシュ版を更新し、新しいガードを読み込ませます。\n- ゲーム一覧、クラウド保存、セーブのインポート/エクスポート、言語選択、既存ゲーム内容は変更していません。"
      }
    }, "2026-06-17T20:50:00.000Z"),
    ...articleTranslationsStatements(env, "seed-update-2026-06-18-chat-nickname-locale", {
      zh: {
        title: "聊天室昵称本地化",
        summary: "匿名聊天室的新随机昵称会跟随当前语言生成。",
        content_markdown: "# 聊天室昵称本地化\n\n本次更新继续打磨公开匿名聊天室，让新访客拿到的随机昵称更贴合当前语言界面。\n\n## 更新内容\n\n- 前端请求 `/api/chat/nickname` 时会带上当前 `lang` 参数。\n- 公开昵称接口按中文、English、日本語分别选择随机昵称词库。\n- 接口不可用时，本地 fallback 也会使用当前语言对应的词库。\n- 已保存或手动编辑过的昵称不会被强制替换，聊天室消息仍通过安全 DOM / `textContent` 渲染。"
      },
      en: {
        title: "Chat Nickname Locale",
        summary: "New anonymous chat random nicknames now follow the current language.",
        content_markdown: "# Chat Nickname Locale\n\nThis update continues polishing the public anonymous chat room so new visitors receive random nicknames that better match the current interface language.\n\n## Changes\n\n- The frontend now sends the current `lang` parameter when requesting `/api/chat/nickname`.\n- The public nickname endpoint chooses separate nickname pools for Chinese, English, and Japanese.\n- If the endpoint is unavailable, the local fallback also uses the current language pool.\n- Saved or manually edited nicknames are not forcibly replaced, and chat messages still render through safe DOM / `textContent`."
      },
      ja: {
        title: "チャット名ロケール対応",
        summary: "匿名チャットの新しいランダム名が現在の言語に合わせて生成されます。",
        content_markdown: "# チャット名ロケール対応\n\n今回の更新では、公開匿名チャットをさらに磨き、新しい訪問者のランダム名が現在の表示言語に合うようにしました。\n\n## 更新内容\n\n- フロントエンドが `/api/chat/nickname` を呼ぶとき、現在の `lang` パラメータを送ります。\n- 公開ニックネーム API は中国語、English、日本語ごとのランダム名リストを選びます。\n- API が使えない場合のローカル fallback も、現在の言語リストを使います。\n- 保存済み、または手動編集済みのニックネームは強制変更せず、チャットメッセージは引き続き安全な DOM / `textContent` で描画します。"
      }
    }, "2026-06-17T20:35:00.000Z"),
    env.DB.prepare(`
      update articles
      set is_pinned = 0
      where category = 'site-updates' and is_pinned <> 0
    `),
    env.DB.prepare(`
      update articles
      set updated_at = ?
      where slug = ?
        and category = 'daily-ai-news'
        and exists (
          select 1
          from article_translations
          where article_translations.article_id = articles.article_id
            and (
              instr(article_translations.content_markdown, ?) > 0
              or instr(article_translations.content_markdown, ?) > 0
              or instr(article_translations.content_markdown, ?) > 0
            )
        )
    `).bind(
      DAILY_AI_NEWS_2026_07_27_READER_PATCH.updatedAt,
      DAILY_AI_NEWS_2026_07_27_READER_PATCH.slug,
      DAILY_AI_NEWS_2026_07_27_READER_PATCH.intros.zh,
      DAILY_AI_NEWS_2026_07_27_READER_PATCH.intros.en,
      DAILY_AI_NEWS_2026_07_27_READER_PATCH.intros.ja
    ),
    env.DB.prepare(`
      update article_translations
      set content_markdown = case lang
            when 'zh' then replace(content_markdown, ?, '')
            when 'en' then replace(content_markdown, ?, '')
            when 'ja' then replace(content_markdown, ?, '')
            else content_markdown
          end,
          updated_at = ?
      where article_id = (
        select article_id
        from articles
        where slug = ? and category = 'daily-ai-news'
        limit 1
      )
        and lang in ('zh', 'en', 'ja')
        and (
          instr(content_markdown, ?) > 0
          or instr(content_markdown, ?) > 0
          or instr(content_markdown, ?) > 0
        )
    `).bind(
      `${DAILY_AI_NEWS_2026_07_27_READER_PATCH.intros.zh}\n\n`,
      `${DAILY_AI_NEWS_2026_07_27_READER_PATCH.intros.en}\n\n`,
      `${DAILY_AI_NEWS_2026_07_27_READER_PATCH.intros.ja}\n\n`,
      DAILY_AI_NEWS_2026_07_27_READER_PATCH.updatedAt,
      DAILY_AI_NEWS_2026_07_27_READER_PATCH.slug,
      DAILY_AI_NEWS_2026_07_27_READER_PATCH.intros.zh,
      DAILY_AI_NEWS_2026_07_27_READER_PATCH.intros.en,
      DAILY_AI_NEWS_2026_07_27_READER_PATCH.intros.ja
    ),
    env.DB.prepare(`
      delete from articles
      where article_id = 'seed-daily-ai-news-test-placeholder'
        and slug = 'daily-ai-news-test-placeholder'
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
  const state = await env.DB.prepare(
    "select value from site_runtime_state where key = ?"
  ).bind(ARTICLE_SEED_STATE_KEY).first();
  if (String(state?.value || "") === ARTICLE_SEED_VERSION) {
    articleSeedReady = true;
    return;
  }
  await env.DB.batch([
    ...articleSeedStatements(env),
    env.DB.prepare(`
      insert into site_runtime_state (key, value, updated_at)
      values (?, ?, ?)
      on conflict(key) do update set
        value = excluded.value,
        updated_at = excluded.updated_at
      where site_runtime_state.value <> excluded.value
    `).bind(ARTICLE_SEED_STATE_KEY, ARTICLE_SEED_VERSION, nowIso())
  ]);
  articleSeedReady = true;
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
  if (!Array.isArray(value)) {
    return [];
  }
  const normalized = value
    .map((tag) => String(tag || "").trim())
    .filter(Boolean);
  const tags = options.dedupe ? [...new Set(normalized)] : normalized;
  const maxItems = Number.isFinite(options.maxItems) ? options.maxItems : 12;
  const maxLength = Number.isFinite(options.maxLength) ? options.maxLength : 40;
  return tags
    .slice(0, maxItems)
    .map((tag) => Array.from(tag).slice(0, maxLength).join(""));
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
