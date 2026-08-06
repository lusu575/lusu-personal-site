import {
  labels,
  isI18nNodeInScope,
  normalizeLanguage,
  translationFor
} from "./core/i18n.mjs?v=20260806-agent-capabilities-quick-transfer-r1";
import { homeContent } from "./data/home-content.mjs?v=20260806-whiteboard-2048-agent-r1";
import { blogManifest } from "./data/blog-manifest.mjs?v=20260718-resource-icons-layout-r1";
import { createRouteLifecycle, isAbortError } from "./core/route-lifecycle.mjs?v=20260718-resource-icons-layout-r1";
import { createRouter } from "./core/router.mjs?v=20260718-resource-icons-layout-r1";
import { createRouteModuleRegistry } from "./core/route-modules.mjs?v=20260718-resource-icons-layout-r1";
import { createJsonResourceCache } from "./core/content-cache.mjs?v=20260718-resource-icons-layout-r1";
import { createAccountFeature } from "./features/account.mjs?v=20260726-security-reliability-r1";
import { createConnectionStatus } from "./features/connection-status.mjs?v=20260726-security-reliability-r1";

const pageParams = new URLSearchParams(window.location.search);
const defaultShareImageUrl = "https://lusu575.com/assets/images/homepage-pixel-coast.png?v=20260612-hd-wallpapers";
const defaultShareImageSize = Object.freeze({ width: "1672", height: "941" });
const localeByLanguage = Object.freeze({ zh: "zh_CN", en: "en_US", ja: "ja_JP" });
const routeMetaConfig = Object.freeze({
  home: Object.freeze({ titleKey: "heroTitle", descriptionKey: "siteDescription" }),
  knowledge: Object.freeze({ titleKey: "knowledgeTitle", descriptionKey: "metaKnowledgeDescription" }),
  videos: Object.freeze({ titleKey: "videosTitle", descriptionKey: "metaVideosDescription" }),
  resources: Object.freeze({ titleKey: "resourcesTitle", descriptionKey: "metaResourcesDescription" }),
  games: Object.freeze({ titleKey: "gamesTitle", descriptionKey: "metaGamesDescription" }),
  blog: Object.freeze({ titleKey: "blogTitle", descriptionKey: "metaBlogDescription" }),
  chatroom: Object.freeze({ titleKey: "chatroomTitle", descriptionKey: "metaChatDescription" }),
  about: Object.freeze({ titleKey: "aboutTitle", descriptionKey: "metaAboutDescription" })
});

let currentLang = "zh";
const activeFilters = {
  knowledge: "all",
  videos: "all",
  resources: "all"
};
const articleState = {
  loading: false,
  requestId: 0,
  detailRequestId: 0,
  detailLoadingKey: "",
  detailCache: new Map(),
  articles: [],
  currentSlug: "",
  currentArticle: null,
  focusDetailOnRender: false,
  detailFocusReady: false,
  pendingListScrollTop: null,
  pendingDetailScrollTop: null,
  historySyncFrame: 0,
  renderedDetailKey: "",
  searchTerm: "",
  searchDebounceTimer: 0,
  searchIndex: new Map(),
  searchIndexLanguage: "",
  visibleCount: 12,
  copyStatusTimer: 0,
  readProgressFrame: 0,
  summaryMeasureFrame: 0,
  tocHashFrame: 0,
  tocObserver: null,
  tocIntersecting: new Map(),
  error: ""
};
const videoState = {
  loading: false,
  requestId: 0,
  categories: [],
  videos: [],
  activeVideoId: "",
  playerRequestId: 0,
  playerTimer: 0,
  error: ""
};
const gameState = {
  catalog: null,
  pending: null,
  error: "",
  refreshing: false
};
const blogState = {
  items: [],
  loading: false,
  loaded: false,
  pending: null
};

const videoWindowState = {
  maximized: false
};
const modalFocusState = {
  videoTrigger: null,
  welcomeTrigger: null
};
const modalBackgroundOriginalInert = new Map();
const publicJsonCache = createJsonResourceCache({ maxEntries: 32 });
window.__lusuContentCacheAudit = publicJsonCache.snapshot;

const languageStorageKey = "lusu-site-language";
const welcomeStorageKey = "lusu-welcome-day";
let welcomeSeenDayInMemory = "";
const siteUpdateCategory = "site-updates";
const dailyAiNewsCategory = "daily-ai-news";
const toolRadarCategory = "tool-radar";
const siteGuidesCategory = "site-guides";
const publicLoopNightlyUpdateSlug = "2026-06-18-main-visual-polish-cycle";
const publicLoopNightlyUpdateTitleEn = "Main Site Visual Polish Cycle";
const publicLoopNightlyCollapsedSlugs = new Set([
  "2026-06-17-knowledge-search",
  "2026-06-17-article-share-link",
  "2026-06-17-video-empty-state",
  "2026-06-17-route-aware-welcome"
]);
const publicLoopNightlyCollapsedFallbackTitlesEn = new Set([
  "Knowledge Search Added",
  "Article Link Copy",
  "Video Empty State",
  "Cleaner Article Deep Links"
]);
const articleCategoryLabels = {
  "daily-ai-news": {
    zh: "每日 AI 新闻",
    en: "Daily AI News",
    ja: "毎日AIニュース"
  },
  "tool-radar": {
    zh: "工具雷达",
    en: "Tool Radar",
    ja: "ツールレーダー"
  },
  "site-guides": {
    zh: "网站使用指南",
    en: "Website Guides",
    ja: "サイト利用ガイド"
  },
  "site-updates": {
    zh: "网站更新记录",
    en: "Site Update Log",
    ja: "サイト更新記録"
  },
  site: {
    zh: "网站",
    en: "Site",
    ja: "サイト"
  },
  ai: {
    zh: "AI",
    en: "AI",
    ja: "AI"
  },
  note: {
    zh: "笔记",
    en: "Notes",
    ja: "メモ"
  }
};

const tagLabels = {
  "网站更新": { zh: "网站更新", en: "Site update", ja: "サイト更新" },
  "网站": { zh: "网站", en: "Site", ja: "サイト" },
  "首页": { zh: "首页", en: "Home", ja: "ホーム" },
  "日常": { zh: "日常", en: "Daily", ja: "日常" },
  "记录": { zh: "记录", en: "Log", ja: "記録" },
  "上线记录": { zh: "上线记录", en: "Launch log", ja: "公開記録" },
  "维护记录": { zh: "维护记录", en: "Maintenance", ja: "保守記録" },
  "修复记录": { zh: "修复记录", en: "Fix log", ja: "修正記録" },
  "经验": { zh: "经验", en: "Experience", ja: "経験" },
  "文章": { zh: "文章", en: "Article", ja: "記事" },
  "知识库": { zh: "知识库", en: "Knowledge", ja: "知識庫" },
  "网站使用指南": { zh: "网站使用指南", en: "Website guide", ja: "サイト利用ガイド" },
  "密码房": { zh: "密码房", en: "Password room", ja: "パスワードルーム" },
  "匿名聊天室": { zh: "匿名聊天室", en: "Anonymous chat", ja: "匿名チャット" },
  "在线画板": { zh: "在线画板", en: "Online whiteboard", ja: "オンラインホワイトボード" },
  "标签": { zh: "标签", en: "Tag", ja: "タグ" },
  "搜索": { zh: "搜索", en: "Search", ja: "検索" },
  "文章详情": { zh: "文章详情", en: "Article detail", ja: "記事詳細" },
  "阅读体验": { zh: "阅读体验", en: "Reading", ja: "読書体験" },
  "分享": { zh: "分享", en: "Sharing", ja: "共有" },
  "链接分享": { zh: "链接分享", en: "Link sharing", ja: "リンク共有" },
  "多语言": { zh: "多语言", en: "Languages", ja: "多言語" },
  "路由": { zh: "路由", en: "Routing", ja: "ルート" },
  "导航": { zh: "导航", en: "Navigation", ja: "ナビ" },
  "任务栏": { zh: "任务栏", en: "Taskbar", ja: "タスクバー" },
  "可访问性": { zh: "可访问性", en: "Accessibility", ja: "アクセシビリティ" },
  "交互修复": { zh: "交互修复", en: "Interaction fix", ja: "操作修正" },
  "视频区": { zh: "视频区", en: "Videos", ja: "動画欄" },
  "播放器": { zh: "播放器", en: "Player", ja: "プレイヤー" },
  "空状态": { zh: "空状态", en: "Empty state", ja: "空状態" },
  "工具区": { zh: "工具区", en: "Tools", ja: "ツール" },
  "资源区": { zh: "工具区", en: "Tools", ja: "ツール" },
  "Resources": { zh: "工具区", en: "Tools", ja: "ツール" },
  "リソース": { zh: "工具区", en: "Tools", ja: "ツール" },
  "主站优化": { zh: "主站优化", en: "Main site", ja: "メインサイト" },
  "夜间汇总": { zh: "夜间汇总", en: "Nightly summary", ja: "夜間まとめ" },
  "下载": { zh: "下载", en: "Download", ja: "ダウンロード" },
  "占位按钮": { zh: "占位按钮", en: "Placeholder button", ja: "準備中ボタン" },
  "状态": { zh: "状态", en: "Status", ja: "状態" },
  "源码": { zh: "源码", en: "Source", ja: "ソース" },
  "目录": { zh: "目录", en: "Contents", ja: "目次" },
  "进度": { zh: "进度", en: "Progress", ja: "進捗" },
  "阅读": { zh: "阅读", en: "Reading", ja: "読書" },
  "杂谈区": { zh: "杂谈区", en: "Talk", ja: "雑談" },
  "安全渲染": { zh: "安全渲染", en: "Safe rendering", ja: "安全描画" },
  "后台": { zh: "后台", en: "Admin", ja: "管理画面" },
  "游戏区": { zh: "游戏区", en: "Games", ja: "ゲーム欄" },
  "移动端": { zh: "移动端", en: "Mobile", ja: "モバイル" },
  "桌面端": { zh: "桌面端", en: "Desktop", ja: "デスクトップ" },
  "桌面图标": { zh: "桌面图标", en: "Desktop icons", ja: "デスクトップアイコン" },
  "布局修复": { zh: "布局修复", en: "Layout fix", ja: "レイアウト修正" },
  "响应式布局": { zh: "响应式布局", en: "Responsive layout", ja: "レスポンシブ" },
  "窗口": { zh: "窗口", en: "Window", ja: "ウィンドウ" },
  "图标": { zh: "图标", en: "Icons", ja: "アイコン" },
  "动态壁纸": { zh: "动态壁纸", en: "Animated wallpaper", ja: "動く壁紙" },
  "像素壁纸": { zh: "像素壁纸", en: "Pixel wallpaper", ja: "ピクセル壁紙" },
  "欢迎窗": { zh: "欢迎窗", en: "Welcome modal", ja: "歓迎ウィンドウ" },
  "直链": { zh: "直链", en: "Deep link", ja: "直リンク" },
  "时间显示": { zh: "时间显示", en: "Time display", ja: "時刻表示" },
  "排序": { zh: "排序", en: "Sorting", ja: "並び替え" },
  "性能": { zh: "性能", en: "Performance", ja: "性能" },
  "观察": { zh: "观察", en: "Observations", ja: "観察" },
  "游戏": { zh: "游戏", en: "Games", ja: "ゲーム" },
  "碎碎念": { zh: "碎碎念", en: "Notes", ja: "メモ" },
  "最近更新": { zh: "最近更新", en: "Recent updates", ja: "最近の更新" },
  "界面": { zh: "界面", en: "Interface", ja: "表示" },
  "链接": { zh: "链接", en: "Links", ja: "リンク" },
  "安全": { zh: "安全", en: "Security", ja: "安全" },
  "图片": { zh: "图片", en: "Images", ja: "画像" },
  "iframe": { zh: "iframe", en: "iframe", ja: "iframe" },
  "聊天室": { zh: "聊天室", en: "Chat room", ja: "チャット" },
  "三语": { zh: "三语", en: "Trilingual", ja: "三言語" },
  "体验": { zh: "体验", en: "Experience", ja: "体験" },
  "筛选": { zh: "筛选", en: "Filters", ja: "フィルター" },
  "渲染": { zh: "渲染", en: "Rendering", ja: "描画" },
  "云存档": { zh: "云存档", en: "Cloud saves", ja: "クラウド保存" },
  "账号": { zh: "账号", en: "Account", ja: "アカウント" },
  "无障碍": { zh: "无障碍", en: "Accessibility", ja: "アクセシビリティ" },
  "UI": { zh: "界面", en: "UI", ja: "UI" },
  "mobile": { zh: "移动端", en: "Mobile", ja: "モバイル" },
  "desktop": { zh: "桌面端", en: "Desktop", ja: "デスクトップ" },
  "attachments": { zh: "附件", en: "Attachments", ja: "添付ファイル" },
  "accessibility": { zh: "无障碍", en: "Accessibility", ja: "アクセシビリティ" },
  "AI": { zh: "AI", en: "AI", ja: "AI" },
  "Agent": { zh: "Agent", en: "Agent", ja: "Agent" },
  "Codex": { zh: "Codex", en: "Codex", ja: "Codex" },
  "fallback": { zh: "fallback", en: "Fallback", ja: "Fallback" },
  "测试": { zh: "测试", en: "Test", ja: "テスト" },
  "工具": { zh: "工具", en: "Tools", ja: "ツール" },
  "2048": { zh: "2048", en: "2048", ja: "2048" },
  "Hextris": { zh: "Hextris", en: "Hextris", ja: "Hextris" },
  "Bilibili": { zh: "Bilibili", en: "Bilibili", ja: "Bilibili" },
  "数量": { zh: "数量", en: "Counts", ja: "件数" }
};
const normalizedTagLabelKeys = new Map(Object.keys(tagLabels).map((key) => [key.toLocaleLowerCase(), key]));

const pageIds = ["home", "knowledge", "videos", "resources", "games", "blog", "chatroom", "about"];
const blogRouteAvailable = Number(blogManifest.publishedCount) > 0;
const coreRouter = createRouter({ routes: pageIds });
const {
  parseRouteHash,
  parseRouteLocation,
  articleRoutePath,
  routeUrl,
  withLanguageQuery: buildLanguageRouteUrl
} = coreRouter;

const routeLifecycle = createRouteLifecycle({
  routes: pageIds,
  onEnter({ route, reason }) {
    window.LusuMobileShell?.enterRoute?.(route);
    window.LusuUiMotion?.enterRoute?.(route);
    window.dispatchEvent(new CustomEvent("lusu:routeenter", { detail: { route, reason } }));
  },
  onLeave({ route, reason }) {
    window.LusuMobileShell?.leaveRoute?.(route);
    window.LusuUiMotion?.leaveRoute?.(route);
    window.dispatchEvent(new CustomEvent("lusu:routeleave", { detail: { route, reason } }));
  },
  onError({ route, reason }) {
    window.dispatchEvent(new CustomEvent("lusu:routeerror", { detail: { route, reason } }));
  }
});
const {
  register: registerRouteLifecycle,
  activeScope: activeRouteScope,
  transition: transitionRouteLifecycle,
  restart: restartActiveRouteLifecycle,
  routeFetch,
  snapshot: routeLifecycleSnapshot
} = routeLifecycle;
window.__lusuRouteLifecycleAudit = routeLifecycleSnapshot;

function cachedRouteJson(route, url, options = {}) {
  const key = `${route}:${url}`;
  return publicJsonCache.request(key, (init) => routeFetch(route, url, init), {
    signal: options.signal,
    force: options.force === true,
    maxAgeMs: options.maxAgeMs,
    staleWhileRevalidate: options.staleWhileRevalidate,
    onRevalidated: options.onRevalidated
  });
}

const socialLinkPlatforms = [
  { id: "x", label: "X", defaultUrl: "https://x.com/lusu575" },
  { id: "github", label: "GitHub", defaultUrl: "https://github.com/lusu575" },
  { id: "bilibili", label: "Bilibili", defaultUrl: "" },
  { id: "instagram", label: "Instagram", defaultUrl: "https://www.instagram.com/lusu575/" },
  { id: "discord", label: "Discord", defaultUrl: "" }
];
const socialLinkPlatformMap = new Map(socialLinkPlatforms.map((item) => [item.id, item]));
let socialLinksLastKnownGood = {};

function socialNetworkText(kind) {
  const copy = {
    loading: { zh: "正在检查社交链接…", en: "Checking social links…", ja: "ソーシャルリンクを確認中…" },
    failed: { zh: "暂时无法刷新，已保留上次可用链接。", en: "Refresh failed; the last available links are kept.", ja: "更新できないため、前回利用できたリンクを保持しています。" },
    retry: { zh: "重试", en: "Retry", ja: "再試行" }
  };
  return copy[kind]?.[currentLang] || copy[kind]?.zh || "";
}

function renderSocialNetworkStatus(kind = "") {
  const links = document.getElementById("about-social-links");
  if (!links) return;
  let status = document.getElementById("about-social-network-status");
  if (!kind) {
    status?.remove();
    links.removeAttribute("aria-busy");
    return;
  }
  if (!status) {
    status = document.createElement("div");
    status.id = "about-social-network-status";
    status.className = "content-state content-recovery-notice about-social-network-status";
    links.insertAdjacentElement("afterend", status);
  }
  status.classList.toggle("is-error", kind === "failed");
  status.classList.toggle("is-loading", kind === "loading");
  markStatusMessage(status, kind === "failed" ? "error" : "status");
  const message = document.createElement("p");
  message.textContent = socialNetworkText(kind);
  status.replaceChildren(message);
  if (kind === "failed") {
    const retry = document.createElement("button");
    retry.type = "button";
    retry.className = "xp-button";
    retry.dataset.socialRetry = "";
    retry.textContent = socialNetworkText("retry");
    status.appendChild(retry);
  }
  links.setAttribute("aria-busy", String(kind === "loading"));
}
const trustedResourceExternalHosts = new Set(["github.com", "www.github.com", "raw.githubusercontent.com", "gist.github.com"]);
const trustedGameExternalHosts = new Set(["github.com", "www.github.com", "github.io"]);

function translatedText(lang, key) {
  return translationFor(key, lang);
}

function t(key) {
  return translatedText(currentLang, key);
}

function requestMobileFocusReveal(reason) {
  window.LusuMobileShell?.requestFocusReveal?.(reason);
}

function label(key) {
  return labels[currentLang]?.[key] ?? labels.zh?.[key] ?? "";
}

function localText(value) {
  if (typeof value === "string") {
    return value;
  }
  return value?.[currentLang] || value?.zh || value?.en || value?.ja || "";
}

function safeStorageGet(key, fallback = "") {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function safeStorageSet(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

const routeStyleVersion = "20260728-knowledge-archive-r1";
const routeStyleHrefs = Object.freeze({
  knowledge: `/css/routes/knowledge.css?v=${routeStyleVersion}`,
  videos: `/css/routes/videos.css?v=${routeStyleVersion}`,
  games: `/css/routes/games.css?v=${routeStyleVersion}`,
  chatroom: `/css/routes/chatroom.css?v=${routeStyleVersion}`
});
const routeStylePromises = new Map();

function ensureRouteStylesheet(route) {
  const href = routeStyleHrefs[route];
  if (!href) return Promise.resolve(null);
  const readyLink = document.head.querySelector(`link[data-route-style="${route}"][data-ready="true"]`);
  if (readyLink) return Promise.resolve(readyLink);
  if (routeStylePromises.has(route)) return routeStylePromises.get(route);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  link.dataset.routeStyle = route;
  const pending = new Promise((resolve, reject) => {
    link.addEventListener("load", () => {
      link.dataset.ready = "true";
      resolve(link);
    }, { once: true });
    link.addEventListener("error", () => {
      routeStylePromises.delete(route);
      link.remove();
      reject(new TypeError(`Unable to load route stylesheet: ${route}`));
    }, { once: true });
  });
  routeStylePromises.set(route, pending);
  const mobileShellStyle = document.head.querySelector("link[data-mobile-shell-style]");
  if (mobileShellStyle?.parentNode === document.head) {
    document.head.insertBefore(link, mobileShellStyle);
  } else {
    document.head.appendChild(link);
  }
  return pending;
}

function safeSessionGet(key, fallback = "") {
  try {
    return sessionStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function safeSessionSet(key, value) {
  try {
    sessionStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function loadStyledRoute(route, moduleLoader, instantiate) {
  return Promise.all([ensureRouteStylesheet(route), moduleLoader()])
    .then(([, routeModule]) => instantiate(routeModule));
}

const routeModuleRegistry = createRouteModuleRegistry({
  loaders: {
    knowledge: () => loadStyledRoute("knowledge", () => import("./routes/knowledge.mjs?v=20260806-agent-capabilities-quick-transfer-r1"),
      ({ createKnowledgeRoute }) => instantiateKnowledgeRoute(createKnowledgeRoute)),
    videos: () => loadStyledRoute("videos", () => Promise.all([
      import("./routes/videos.mjs?v=20260726-security-reliability-r1"),
      import("./data/videos-content.mjs?v=20260718-resource-icons-layout-r1")
    ]), ([{ createVideosRoute }, { videosContent }]) => instantiateVideosRoute(createVideosRoute, videosContent)),
    resources: () => Promise.all([
      import("./routes/resources.mjs?v=20260726-security-reliability-r1"),
      import("./data/resources-content.mjs?v=20260806-whiteboard-2048-agent-r1")
    ]).then(([{ createResourcesRoute }, { resourcesContent }]) => instantiateResourcesRoute(createResourcesRoute, resourcesContent)),
    games: () => loadStyledRoute("games", () => import("./routes/games.mjs?v=20260726-security-reliability-r1"),
      ({ createGamesRoute }) => instantiateGamesRoute(createGamesRoute)),
    chatroom: () => loadStyledRoute("chatroom", () => import("./routes/chatroom.mjs?v=20260726-security-reliability-r1"),
      ({ createChatroomRoute }) => instantiateChatroomRoute(createChatroomRoute))
  },
  onStatus({ route, status, error }) {
    if (document.body.dataset.route === route && status !== "ready") {
      renderRouteModuleStatus(route, status, error);
    }
  }
});
window.__lusuRouteModulesAudit = routeModuleRegistry.snapshot;

function ensureRouteModule(route) {
  return routeModuleRegistry.ensure(route);
}

function hideChatPrivateRoomForm(options = {}) {
  routeModuleRegistry.get("chatroom")?.hideChatPrivateRoomForm(options);
}

function instantiateChatroomRoute(createChatroomRoute) {
  return createChatroomRoute({
    t,
    getCurrentLang: () => currentLang,
    safeStorageGet,
    safeStorageSet,
    requestMobileFocusReveal,
    normalizeDateInput,
    formatZonedDateTime,
    routeFetch,
    activeRouteScope,
    isAbortError
  });
}

function routeModuleStatusTarget(route) {
  return document.getElementById({
    knowledge: "knowledge-list",
    videos: "video-list",
    resources: "resource-list",
    games: "game-list",
    chatroom: "chat-message-list"
  }[route] || "");
}

function renderRouteModuleStatus(route, status, error = null) {
  const target = routeModuleStatusTarget(route);
  if (!target) return;
  const state = document.createElement("div");
  state.className = `content-state route-module-status is-${status === "failed" ? "error" : "loading"}`;
  const note = document.createElement("p");
  note.className = "content-state-copy loading-text";
  note.textContent = status === "failed" ? t("routeModuleFailed") : t("routeModuleLoading");
  markStatusMessage(state, status === "failed" ? "error" : "status");
  state.appendChild(note);
  if (status !== "failed") {
    target.replaceChildren(state);
    return;
  }
  const retry = document.createElement("button");
  retry.type = "button";
  retry.className = "xp-button";
  retry.dataset.routeModuleRetry = route;
  retry.textContent = t("routeModuleRetry");
  retry.setAttribute("aria-label", `${t("routeModuleRetry")}: ${t(`${route}Title`)}`);
  if (error) retry.dataset.errorKind = error instanceof TypeError ? "network" : "module";
  state.appendChild(retry);
  target.replaceChildren(state);
}

function waitForRouteModuleRetryResult(route, target) {
  return new Promise((resolve) => {
    let timeout = 0;
    const observer = new MutationObserver(check);
    const finish = () => {
      observer.disconnect();
      window.clearTimeout(timeout);
      resolve();
    };
    function check() {
      if (document.body.dataset.route !== route || !document.contains(target)) {
        finish();
        return;
      }
      const status = target.querySelector(".route-module-status");
      if (!status || status.classList.contains("is-error") || !status.classList.contains("is-loading")) {
        finish();
      }
    }
    observer.observe(target, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    timeout = window.setTimeout(finish, 10_000);
    window.queueMicrotask(check);
  });
}


const publicHistoryStateKey = "lusuPublicState";
const publicHistoryStateVersion = 1;
let publicHistoryEntrySequence = 0;
let lastLocationProjectionKey = "";

function boundedHistoryScrollTop(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(10_000_000, Math.max(0, number)) : 0;
}

function defaultKnowledgeHistorySnapshot() {
  return { category: "all", searchTerm: "", scrollTop: 0 };
}

function normalizeKnowledgeHistorySnapshot(value) {
  const fallback = defaultKnowledgeHistorySnapshot();
  if (!value || typeof value !== "object") {
    return fallback;
  }
  const category = String(value.category || "all");
  return {
    category: /^[a-z0-9-]{1,80}$/i.test(category) ? category : "all",
    searchTerm: String(value.searchTerm || "").slice(0, 200),
    scrollTop: boundedHistoryScrollTop(value.scrollTop)
  };
}

function currentPublicHistoryState(value = window.history.state) {
  const state = value && typeof value === "object" ? value[publicHistoryStateKey] : null;
  if (!state || state.version !== publicHistoryStateVersion || typeof state.entryId !== "string") {
    return null;
  }
  return {
    ...state,
    route: pageIds.includes(state.route) ? state.route : "home",
    articleSlug: /^[a-z0-9][a-z0-9-]{0,119}$/.test(state.articleSlug || "") ? state.articleSlug : "",
    knowledge: normalizeKnowledgeHistorySnapshot(state.knowledge),
    articleScrollTop: boundedHistoryScrollTop(state.articleScrollTop),
    articleReturnMode: state.articleReturnMode === "history" ? "history" : "default"
  };
}

function nextPublicHistoryEntryId() {
  publicHistoryEntrySequence += 1;
  return `${Date.now().toString(36)}-${publicHistoryEntrySequence.toString(36)}`;
}

function captureKnowledgeHistorySnapshot(options = {}) {
  const list = document.getElementById("knowledge-list");
  const existing = currentPublicHistoryState()?.knowledge;
  const visibleList = list && !list.hidden
    && document.body.dataset.route === "knowledge"
    && !articleState.currentSlug;
  const scrollTop = options.scrollTop ?? (visibleList
    ? list.scrollTop
    : existing?.scrollTop ?? list?.scrollTop ?? 0);
  return normalizeKnowledgeHistorySnapshot({
    category: activeFilters.knowledge,
    searchTerm: articleState.searchTerm,
    scrollTop
  });
}

function publicHistoryStateFor(route, articleSlug = "", options = {}) {
  const currentState = currentPublicHistoryState();
  const existingRoot = window.history.state && typeof window.history.state === "object"
    ? window.history.state
    : {};
  const detail = document.getElementById("article-detail");
  const articleScrollTop = options.articleScrollTop ?? (
    route === "knowledge" && articleSlug && detail && !detail.hidden
      ? detail.scrollTop
      : 0
  );
  return {
    ...existingRoot,
    [publicHistoryStateKey]: {
      version: publicHistoryStateVersion,
      entryId: options.preserveEntry && currentState?.entryId
        ? currentState.entryId
        : nextPublicHistoryEntryId(),
      route: pageIds.includes(route) ? route : "home",
      articleSlug: route === "knowledge" ? articleSlug : "",
      knowledge: normalizeKnowledgeHistorySnapshot(options.knowledge || captureKnowledgeHistorySnapshot()),
      articleScrollTop: boundedHistoryScrollTop(articleScrollTop),
      articleReturnMode: route === "knowledge" && articleSlug && options.articleReturnMode === "history"
        ? "history"
        : "default"
    }
  };
}

function replaceCurrentPublicHistoryState(options = {}) {
  const parsed = parseRouteLocation();
  const currentState = currentPublicHistoryState();
  const nextState = publicHistoryStateFor(parsed.route, parsed.articleSlug, {
    preserveEntry: true,
    knowledge: options.knowledge,
    articleScrollTop: options.articleScrollTop,
    articleReturnMode: options.articleReturnMode || currentState?.articleReturnMode
  });
  window.history.replaceState(
    nextState,
    "",
    `${window.location.pathname}${window.location.search}${window.location.hash}`
  );
}

function schedulePublicHistoryStateSync() {
  if (articleState.historySyncFrame) {
    return;
  }
  articleState.historySyncFrame = window.requestAnimationFrame(() => {
    articleState.historySyncFrame = 0;
    const parsed = parseRouteLocation();
    const state = currentPublicHistoryState();
    if (!state || state.route !== parsed.route || state.articleSlug !== parsed.articleSlug) {
      return;
    }
    replaceCurrentPublicHistoryState({
      knowledge: captureKnowledgeHistorySnapshot(),
      articleScrollTop: parsed.articleSlug
        ? document.getElementById("article-detail")?.scrollTop || 0
        : 0,
      articleReturnMode: state.articleReturnMode
    });
  });
}

function locationProjectionKey() {
  const entryId = currentPublicHistoryState()?.entryId || "";
  return `${window.location.pathname}${window.location.search}${window.location.hash}|${entryId}`;
}

function articleRouteHref(slug, lang = currentLang) {
  const url = new URL(articleRoutePath(slug), window.location.origin);
  url.searchParams.set("lang", lang);
  return `${url.pathname}${url.search}`;
}

function withLanguageQuery(path, lang = currentLang) {
  return buildLanguageRouteUrl(path, lang);
}

function syncLanguageUrl(lang = currentLang) {
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set("lang", lang);
  const nextPath = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
  const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (currentPath !== nextPath) {
    window.history.replaceState(window.history.state, "", nextPath);
    lastLocationProjectionKey = locationProjectionKey();
  }
}

function canonicalSiteUrl(route = "home", lang = currentLang) {
  const normalizedRoute = routeMetaConfig[route] ? route : "home";
  const normalizedLang = ["zh", "en", "ja"].includes(lang) ? lang : "zh";
  const hash = normalizedRoute === "home" ? "" : `#${normalizedRoute}`;
  return `https://lusu575.com/?lang=${normalizedLang}${hash}`;
}

function setMetaContent(selector, content) {
  const node = document.querySelector(selector);
  if (node) {
    node.setAttribute("content", content);
  }
}

function setOptionalMetaContent(selector, content) {
  const node = document.querySelector(selector);
  if (!node) {
    return;
  }
  if (content) {
    node.setAttribute("content", content);
  } else {
    node.removeAttribute("content");
  }
}

function setLinkHref(selector, href) {
  const node = document.querySelector(selector);
  if (node) {
    node.setAttribute("href", href);
  }
}

function applyDocumentMeta({
  documentTitle,
  siteTitle,
  shareTitle,
  description,
  canonicalUrl,
  type,
  imageUrl,
  imageWidth = "",
  imageHeight = "",
  imageAlt,
  locale
}) {
  document.title = documentTitle;
  setLinkHref('link[rel="canonical"]', canonicalUrl);
  setMetaContent('meta[name="description"]', description);
  setMetaContent('meta[property="og:type"]', type);
  setMetaContent('meta[property="og:site_name"]', siteTitle);
  setMetaContent('meta[property="og:title"]', shareTitle);
  setMetaContent('meta[property="og:description"]', description);
  setMetaContent('meta[property="og:url"]', canonicalUrl);
  setMetaContent('meta[property="og:image"]', imageUrl);
  setOptionalMetaContent('meta[property="og:image:width"]', imageWidth);
  setOptionalMetaContent('meta[property="og:image:height"]', imageHeight);
  setMetaContent('meta[property="og:image:alt"]', imageAlt);
  setMetaContent('meta[property="og:locale"]', locale);
  setMetaContent('meta[name="twitter:card"]', "summary_large_image");
  setMetaContent('meta[name="twitter:title"]', shareTitle);
  setMetaContent('meta[name="twitter:description"]', description);
  setMetaContent('meta[name="twitter:image"]', imageUrl);
  setMetaContent('meta[name="twitter:image:alt"]', imageAlt);
}

function syncDocumentMeta(lang = currentLang, route = document.body?.dataset?.route || "home") {
  const normalizedLang = ["zh", "en", "ja"].includes(lang) ? lang : "zh";
  const normalizedRoute = routeMetaConfig[route] ? route : "home";
  const config = routeMetaConfig[normalizedRoute];
  const siteTitle = translatedText(normalizedLang, "heroTitle");
  const routeTitle = translatedText(normalizedLang, config.titleKey);
  const description = translatedText(normalizedLang, config.descriptionKey);

  applyDocumentMeta({
    documentTitle: normalizedRoute === "home" ? siteTitle : `${routeTitle} | ${siteTitle}`,
    siteTitle,
    shareTitle: routeTitle,
    description,
    canonicalUrl: canonicalSiteUrl(normalizedRoute, normalizedLang),
    type: "website",
    imageUrl: defaultShareImageUrl,
    imageWidth: defaultShareImageSize.width,
    imageHeight: defaultShareImageSize.height,
    imageAlt: translatedText(normalizedLang, "metaShareImageAlt"),
    locale: localeByLanguage[normalizedLang]
  });
}

function articleShareImageDescriptor(article, articleTitle) {
  const safeCover = safeArticleImageSrc(article?.cover_image || "");
  if (safeCover) {
    return {
      url: `https://lusu575.com/${safeCover}`,
      width: "",
      height: "",
      alt: articleTitle
    };
  }
  return {
    url: defaultShareImageUrl,
    width: defaultShareImageSize.width,
    height: defaultShareImageSize.height,
    alt: t("metaShareImageAlt")
  };
}

function syncArticleDocumentMeta(article) {
  const siteTitle = t("heroTitle");
  const articleTitle = String(article?.title || "").trim() || siteTitle;
  const description = String(article?.summary || "").trim() || t("siteDescription");
  const canonicalUrl = new URL(articleRouteHref(article?.slug || articleState.currentSlug, currentLang), "https://lusu575.com").href;
  const image = articleShareImageDescriptor(article, articleTitle);

  applyDocumentMeta({
    documentTitle: articleTitle === siteTitle ? siteTitle : `${articleTitle} | ${siteTitle}`,
    siteTitle,
    shareTitle: articleTitle,
    description,
    canonicalUrl,
    type: "article",
    imageUrl: image.url,
    imageWidth: image.width,
    imageHeight: image.height,
    imageAlt: image.alt,
    locale: localeByLanguage[currentLang] || localeByLanguage.zh
  });
}

function syncBrowserUrl(route, articleSlug = "", historyOptions = {}) {
  const nextUrl = withLanguageQuery(routeUrl(route, articleSlug));
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const replaceEntry = historyOptions?.replaceEntry === true;
  const changesEntry = currentUrl !== nextUrl && !replaceEntry;
  const nextState = publicHistoryStateFor(route, articleSlug, {
    ...historyOptions,
    preserveEntry: !changesEntry
  });
  if (changesEntry) {
    window.history.pushState(nextState, "", nextUrl);
  } else {
    window.history.replaceState(nextState, "", nextUrl);
  }
  lastLocationProjectionKey = locationProjectionKey();
}

function sitePath(path) {
  const value = String(path || "").trim();
  if (!value || /^(https?:|data:|\/)/i.test(value)) {
    return value;
  }
  return `/${value.replace(/^\.?\//, "")}`;
}

function safeHttpUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch (error) {
    return "";
  }
}

function hostMatches(hostname, allowedHosts) {
  const host = String(hostname || "").toLowerCase();
  return [...allowedHosts].some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

function safeTrustedExternalUrl(value, allowedHosts) {
  try {
    const url = new URL(String(value || "").trim());
    return url.protocol === "https:" && hostMatches(url.hostname, allowedHosts) ? url.href : "";
  } catch {
    return "";
  }
}

function safeGithubUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    if (url.protocol !== "https:" || !["github.com", "www.github.com"].includes(url.hostname.toLowerCase())) {
      return "";
    }
    if (!/^\/[a-z0-9_.-]+\/[a-z0-9_.-]+\/?$/i.test(url.pathname)) {
      return "";
    }
    url.search = "";
    url.hash = "";
    return url.href;
  } catch {
    return "";
  }
}

function normalizeSocialLinksPayload(payload) {
  const source = Array.isArray(payload?.links) ? payload.links : [];
  return source.reduce((result, item) => {
    const platform = String(item?.platform || item?.id || "").trim().toLowerCase();
    const url = safeHttpUrl(item?.url);
    if (socialLinkPlatformMap.has(platform) && url) {
      result[platform] = url;
    }
    return result;
  }, {});
}

function syncSocialLinks(links = {}) {
  document.querySelectorAll("[data-social-link]").forEach((anchor) => {
    const platform = socialLinkPlatformMap.get(anchor.dataset.socialLink);
    if (!platform) {
      return;
    }
    const url = safeHttpUrl(links[platform.id]) || safeHttpUrl(platform.defaultUrl);
    anchor.hidden = !url;
    if (!url) {
      anchor.removeAttribute("href");
      anchor.removeAttribute("title");
      anchor.removeAttribute("aria-label");
      return;
    }
    anchor.href = url;
    const accessibleLabel = `${platform.label} · ${t("externalButton")}`;
    anchor.title = accessibleLabel;
    anchor.setAttribute("aria-label", accessibleLabel);
    anchor.rel = "noopener noreferrer";
    anchor.target = "_blank";
  });
}

async function loadSocialLinks(options = {}) {
  syncSocialLinks(socialLinksLastKnownGood);
  renderSocialNetworkStatus("loading");
  const applyResult = (result) => {
    socialLinksLastKnownGood = normalizeSocialLinksPayload(result.data);
    syncSocialLinks(socialLinksLastKnownGood);
    renderSocialNetworkStatus(result.error ? "failed" : "");
  };
  try {
    const result = await cachedRouteJson("about", "/api/social-links", {
      signal: options.signal,
      force: options.force === true,
      maxAgeMs: 5 * 60 * 1000,
      staleWhileRevalidate: options.force !== true,
      onRevalidated: applyResult
    });
    applyResult(result);
    if (result.revalidating) renderSocialNetworkStatus("loading");
  } catch (error) {
    if (isAbortError(error)) return;
    syncSocialLinks(socialLinksLastKnownGood);
    renderSocialNetworkStatus("failed");
  }
}

function contentTitle(value) {
  return `${localText(value)}${t("placeholderMark")}`;
}

function safeResourceIconSrc(value) {
  const path = String(value || "").trim().replace(/^\/+/, "").replace(/^\.\//, "");
  if (path === "tools/japanese-subtext/assets/icons/tool-icon-64.webp") {
    return sitePath(path);
  }
  if (/^assets\/images\/[a-z0-9][a-z0-9._/-]+\.(png|jpe?g|webp|gif)(\?[a-z0-9=&._-]+)?$/i.test(path)) {
    return sitePath(path);
  }
  return "";
}

function safeGameCoverSrc(value) {
  const fallback = "/assets/images/icon-games.png?v=20260719-content-experience-fixes-r1";
  const path = String(value || "").trim().replace(/^(\.\.\/)+/, "");
  if (/^assets\/images\/[a-z0-9._/-]+\.(png|jpe?g|webp|gif)(\?[a-z0-9=&._-]+)?$/i.test(path)) {
    return sitePath(path);
  }
  return fallback;
}

function safeGameEntry(value) {
  const entry = String(value || "").trim().replace(/^\/+/, "");
  return /^[a-z0-9][a-z0-9-]*\/?$/i.test(entry) ? entry.replace(/\/?$/, "/") : "";
}

function buildGameUrl(item) {
  if (item.playUrl) {
    const value = String(item.playUrl).trim();
    const external = safeTrustedExternalUrl(value, trustedGameExternalHosts);
    if (external) {
      return external;
    }
    return "";
  }
  if (item.externalUrl) {
    return safeTrustedExternalUrl(item.externalUrl, trustedGameExternalHosts);
  }
  if (item.repo && !item.entry) {
    return safeGithubUrl(item.repo);
  }
  const entry = safeGameEntry(item.entry);
  return entry ? `/games/${entry}?lang=${encodeURIComponent(currentLang)}` : "";
}

function languageSupportTagElements(item, options = {}) {
  const supported = item.languageSupport || {};
  const languageNames = {
    zh: { zh: "中文", en: "英文", ja: "日文" },
    en: { zh: "Chinese", en: "English", ja: "Japanese" },
    ja: { zh: "中国語", en: "英語", ja: "日本語" }
  };

  const languages = options.onlyCurrent === true ? [currentLang] : ["zh", "en", "ja"];
  return languages.map((lang) => {
    const name = languageNames[currentLang]?.[lang] || languageNames.zh[lang] || lang;
    const title = supported[lang] ? name : `${name} ${t("gameLanguageUnsupported")}`;
    const tag = document.createElement("span");
    tag.className = `tag language-tag${supported[lang] ? " supported" : " unsupported"}`;
    tag.title = title;
    tag.setAttribute("aria-label", title);
    tag.textContent = title;
    return tag;
  });
}

function isExternalGameUrl(url) {
  return /^https?:\/\//i.test(url);
}

function localizeRouteLanguage(route) {
  const page = pageIds.includes(route) ? document.getElementById(route) : null;
  if (!page) return;

  page.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  page.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    node.setAttribute("placeholder", t(node.dataset.i18nPlaceholder));
  });
  page.querySelectorAll("[data-i18n-aria-label]").forEach((node) => {
    node.setAttribute("aria-label", t(node.dataset.i18nAriaLabel));
  });
  page.querySelectorAll("[data-i18n-title]").forEach((node) => {
    node.setAttribute("title", t(node.dataset.i18nTitle));
  });
  page.querySelectorAll("[data-i18n-alt]").forEach((node) => {
    node.setAttribute("alt", t(node.dataset.i18nAlt));
  });
}

function captureLanguageSwitchContext(route, options = {}) {
  if (route !== "knowledge" || options.captureHistory === false) return;
  const knowledge = captureKnowledgeHistorySnapshot();
  if (articleState.currentSlug) {
    const detail = document.getElementById("article-detail");
    if (!detail || detail.hidden) return;
    articleState.pendingDetailScrollTop = detail.scrollTop;
    replaceCurrentPublicHistoryState({
      knowledge,
      articleScrollTop: detail.scrollTop,
      articleReturnMode: currentPublicHistoryState()?.articleReturnMode
    });
    return;
  }
  const list = document.getElementById("knowledge-list");
  if (!list || list.hidden) return;
  articleState.pendingListScrollTop = list.scrollTop;
  replaceCurrentPublicHistoryState({
    knowledge: { ...knowledge, scrollTop: list.scrollTop },
    articleScrollTop: 0,
    articleReturnMode: currentPublicHistoryState()?.articleReturnMode
  });
}

function syncActiveRouteLanguage(route, language) {
  if (route === "home") {
    renderUpdates();
    return;
  }
  if (route === "knowledge") {
    const module = knowledgeRoute();
    if (module) void module.loadArticles({ signal: activeRouteScope("knowledge")?.signal });
    return;
  }
  if (route === "videos") {
    updateVideoWindowButton();
    const module = videosRoute();
    if (module) void module.loadVideos({ signal: activeRouteScope("videos")?.signal });
    return;
  }
  if (route === "resources") {
    const module = resourcesRoute();
    module?.renderResources();
    module?.quickTransfer.setLanguage(language);
    return;
  }
  if (route === "games") {
    gamesRoute()?.renderGames({ load: false });
    return;
  }
  if (route === "blog") {
    renderBlog();
    return;
  }
  if (route === "chatroom") {
    routeModuleRegistry.get("chatroom")?.syncLanguage();
    return;
  }
  if (route === "about") {
    syncSocialLinks(socialLinksLastKnownGood);
    const status = document.getElementById("about-social-network-status");
    if (status) renderSocialNetworkStatus(status.classList.contains("is-error") ? "failed" : "loading");
  }
}

function setLanguage(lang, options = {}) {
  const nextLanguage = normalizeLanguage(lang);
  const previousLanguage = currentLang;
  const activeRoute = pageIds.includes(document.body.dataset.route) ? document.body.dataset.route : "home";
  const activePage = document.getElementById(activeRoute);
  captureLanguageSwitchContext(activeRoute, options);
  currentLang = nextLanguage;
  if (options.persist) {
    safeStorageSet(languageStorageKey, nextLanguage);
  }
  if (options.syncUrl) {
    syncLanguageUrl(nextLanguage);
  }
  document.documentElement.lang = nextLanguage === "zh" ? "zh-CN" : nextLanguage;
  syncDocumentMeta(nextLanguage);

  document.querySelectorAll("[data-i18n]").forEach((node) => {
    if (!isI18nNodeInScope(node, activePage)) return;
    node.textContent = t(node.dataset.i18n);
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    if (!isI18nNodeInScope(node, activePage)) return;
    node.setAttribute("placeholder", t(node.dataset.i18nPlaceholder));
  });

  document.querySelectorAll("[data-i18n-aria-label]").forEach((node) => {
    if (!isI18nNodeInScope(node, activePage)) return;
    node.setAttribute("aria-label", t(node.dataset.i18nAriaLabel));
  });

  document.querySelectorAll("[data-i18n-title]").forEach((node) => {
    if (!isI18nNodeInScope(node, activePage)) return;
    node.setAttribute("title", t(node.dataset.i18nTitle));
  });

  document.querySelectorAll("[data-i18n-alt]").forEach((node) => {
    if (!isI18nNodeInScope(node, activePage)) return;
    node.setAttribute("alt", t(node.dataset.i18nAlt));
  });

  document.querySelectorAll(".lang-button").forEach((button) => {
    const active = button.dataset.lang === nextLanguage;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  renderLatestUpdateDate();
  updateWelcomeGreeting();
  renderAccountWidget();
  siteConnectionStatus.syncLanguage();
  if (previousLanguage !== nextLanguage) syncActiveRouteLanguage(activeRoute, nextLanguage);
}

function routeReturnTarget(route, motionKind) {
  if (!pageIds.includes(route)) {
    return null;
  }
  const selector = motionKind === "window-minimize"
    ? ".taskbar-tabs button[data-route]"
    : ".desktop-icon[data-route]";
  return Array.from(document.querySelectorAll(selector)).find((element) => element.dataset.route === route) || null;
}

const routeIconRectCache = new Map();

function elementMotionRect(element) {
  if (!(element instanceof Element)) {
    return null;
  }
  const rect = element.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) {
    return null;
  }
  return {
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    left: rect.left,
    width: rect.width,
    height: rect.height
  };
}

function measureRouteIconRects() {
  if (document.body.dataset.route !== "home") {
    return [];
  }
  const shell = document.documentElement.dataset.uiShell || "";
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  return [...document.querySelectorAll(".desktop-icon[data-route]")]
    .map((element) => ({ route: element.dataset.route, rect: elementMotionRect(element) }))
    .filter(({ route, rect }) => Boolean(rect) && pageIds.includes(route))
    .map(({ route, rect }) => ({ route, rect, shell, viewportWidth, viewportHeight }));
}

function storeRouteIconRects(entries) {
  entries.forEach(({ route, rect, shell, viewportWidth, viewportHeight }) => {
    routeIconRectCache.set(route, { rect, shell, viewportWidth, viewportHeight });
  });
}

function captureRouteIconRects() {
  storeRouteIconRects(measureRouteIconRects());
}

function cachedRouteIconRect(route) {
  const cached = routeIconRectCache.get(route);
  if (!cached
    || cached.shell !== (document.documentElement.dataset.uiShell || "")
    || cached.viewportWidth !== window.innerWidth
    || cached.viewportHeight !== window.innerHeight) {
    return null;
  }
  return cached.rect;
}

function routeExitOriginRect(route, motionKind, returnTarget) {
  if (motionKind === "window-minimize") {
    return elementMotionRect(returnTarget);
  }
  const cachedIcon = cachedRouteIconRect(route);
  if (cachedIcon) {
    return cachedIcon;
  }
  const taskButton = Array.from(document.querySelectorAll(".taskbar-tabs button[data-route]"))
    .find((element) => element.dataset.route === route && elementMotionRect(element));
  return elementMotionRect(taskButton) || elementMotionRect(document.querySelector(".start-button"));
}

function routeWindowFocusTarget(route) {
  const page = pageIds.includes(route) ? document.getElementById(route) : null;
  if (!page) {
    return null;
  }
  const heading = page.querySelector(":scope > h1");
  if (heading) {
    heading.tabIndex = -1;
    return heading;
  }
  const windowSurface = page.querySelector(":scope > .xp-window");
  if (windowSurface) {
    windowSurface.tabIndex = -1;
  }
  return windowSurface;
}

function focusTargetIsVisible(element) {
  if (!(element instanceof Element) || element === document.body || element === document.documentElement) {
    return false;
  }
  if (element.closest("[hidden]")) {
    return false;
  }
  const page = element.closest(".page");
  return (!page || page.classList.contains("active")) && element.getClientRects().length > 0;
}

let navigationRequestId = 0;

function navigate(route, options = {}) {
  const requestId = ++navigationRequestId;
  const requestedRoute = pageIds.includes(route) ? route : "home";
  const nextRoute = requestedRoute === "blog" && !blogRouteAvailable ? "knowledge" : requestedRoute;
  const previousRoute = pageIds.includes(document.body.dataset.route) ? document.body.dataset.route : "home";
  if (previousRoute === "home") {
    captureRouteIconRects();
  }
  const isSameRouteNoop = previousRoute === nextRoute
    && !(nextRoute === "knowledge" && (options.articleSlug || articleState.currentSlug));
  if (isSameRouteNoop) {
    transitionRouteLifecycle(nextRoute, "same-route");
    updateNavigationState(nextRoute);
    if (options.updateUrl !== false && options.updateHash !== false) {
      syncBrowserUrl(
        nextRoute,
        nextRoute === "knowledge" ? options.articleSlug || "" : "",
        options.historyState
      );
    }
    syncDocumentMeta(currentLang, nextRoute);
    if (options.focusWindow === true) {
      window.requestAnimationFrame(() => {
        if (requestId !== navigationRequestId || document.body.dataset.route !== nextRoute) {
          return;
        }
        const focusTarget = routeWindowFocusTarget(nextRoute);
        focusTarget?.focus?.({ preventScroll: true });
      });
    }
    return;
  }
  let motionKind = typeof options.motionKind === "string" ? options.motionKind : "route";
  if (motionKind === "route"
    && document.documentElement.dataset.uiShell === "mobile"
    && !options.trigger?.matches?.(".desktop-icon")) {
    motionKind = "mobile-tab";
  }
  const isExitMotion = motionKind === "window-close" || motionKind === "window-minimize";
  const returnTarget = isExitMotion && nextRoute === "home" && previousRoute !== "home"
    ? routeReturnTarget(previousRoute, motionKind)
    : null;
  const mobileHomeReturnTarget = nextRoute === "home"
    && previousRoute !== "home"
    && options.trigger?.matches?.(".mobile-home-button")
    ? routeReturnTarget(previousRoute, "window-close")
    : null;
  const focusReturnTarget = returnTarget || mobileHomeReturnTarget;
  const exitOriginRect = isExitMotion
    ? routeExitOriginRect(previousRoute, motionKind, returnTarget)
    : null;
  let navigationCommitted = false;
  const commitNavigation = () => {
    if (navigationCommitted || requestId !== navigationRequestId) {
      return;
    }
    navigationCommitted = true;
    if (!(nextRoute === "knowledge" && options.articleSlug) && articleState.currentSlug) {
      articleState.currentSlug = "";
      articleState.currentArticle = null;
      articleState.detailLoadingKey = "";
      articleState.focusDetailOnRender = false;
      articleState.detailFocusReady = false;
      renderKnowledge();
    }
    document.querySelectorAll(".page").forEach((page) => {
      page.classList.toggle("active", page.id === nextRoute);
    });
    document.body.dataset.route = nextRoute;
    updateWallpaperMotionState();
    localizeRouteLanguage(nextRoute);
    transitionRouteLifecycle(nextRoute, options.lifecycleReason || "navigation");
    updateNavigationState(nextRoute);
    if (nextRoute === "knowledge" && options.articleSlug) {
      focusArticleDetailTitle();
    }
    if (nextRoute === "knowledge") {
      restorePendingKnowledgeScroll();
    }
    if (options.updateUrl !== false && options.updateHash !== false) {
      syncBrowserUrl(
        nextRoute,
        nextRoute === "knowledge" ? options.articleSlug || "" : "",
        options.historyState
      );
    }
    if (!(nextRoute === "knowledge" && options.articleSlug)) {
      syncDocumentMeta(currentLang, nextRoute);
    }
    window.scrollTo({ top: 0, behavior: "auto" });
    window.dispatchEvent(new CustomEvent("lusu:navigation", {
      detail: { route: nextRoute }
    }));
    const shouldFocusWindow = ["route", "app-open", "mobile-tab", "window-close", "window-minimize"].includes(motionKind)
      && options.focusWindow !== false;
    if (shouldFocusWindow) {
      window.requestAnimationFrame(() => {
        if (requestId !== navigationRequestId || document.body.dataset.route !== nextRoute) {
          return;
        }
        const focusTarget = routeWindowFocusTarget(nextRoute);
        if (focusTarget && typeof focusTarget.focus === "function") {
          focusTarget.focus({ preventScroll: true });
        }
      });
    } else if (focusReturnTarget && options.restoreFocus !== false) {
      window.requestAnimationFrame(() => {
        if (requestId === navigationRequestId && document.body.dataset.route === nextRoute
          && document.contains(focusReturnTarget) && typeof focusReturnTarget.focus === "function") {
          focusReturnTarget.focus({ preventScroll: true });
        }
      });
    }
    window.requestAnimationFrame(() => {
      if (requestId !== navigationRequestId || document.body.dataset.route !== nextRoute) {
        return;
      }
      const activeElement = document.activeElement;
      const hadInteractiveFocus = activeElement instanceof Element
        && activeElement !== document.body
        && activeElement !== document.documentElement;
      if (!hadInteractiveFocus || focusTargetIsVisible(activeElement)) {
        return;
      }
      const fallbackTarget = nextRoute === "home"
        ? routeReturnTarget(previousRoute, "window-close") || document.querySelector(".start-button")
        : routeWindowFocusTarget(nextRoute);
      fallbackTarget?.focus?.({ preventScroll: true });
    });
    if (nextRoute === "home") {
      window.requestAnimationFrame(captureRouteIconRects);
    }
  };

  if (options.motion === false || !window.LusuUiMotion?.run) {
    commitNavigation();
    return;
  }

  window.LusuUiMotion.run(motionKind, {
    route: nextRoute,
    trigger: options.trigger || null,
    originRect: exitOriginRect,
    deferCommit: isExitMotion,
    useViewTransition: false
  }, commitNavigation).catch(() => {
    commitNavigation();
  });
}

function updateNavigationState(route) {
  document.querySelectorAll(".taskbar-tabs button[data-route], .start-button[data-route], .mobile-home-button[data-route]").forEach((button) => {
    const active = button.dataset.route === route;
    button.classList.toggle("active", active);
    if (active) {
      button.setAttribute("aria-current", "page");
    } else {
      button.removeAttribute("aria-current");
    }
  });

  document.querySelectorAll(".desktop-icon[data-route]").forEach((button) => {
    const active = button.dataset.route === route;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function syncRouteFromLocation(options = {}) {
  let parsed = parseRouteLocation();
  const redirectedUnavailableBlog = parsed.route === "blog" && !blogRouteAvailable;
  if (redirectedUnavailableBlog) {
    parsed = { route: "knowledge", articleSlug: "" };
    syncBrowserUrl("knowledge", "", { replaceEntry: true });
  }
  const shouldFocusRoute = options.focusWindow === true;
  const projectionKey = locationProjectionKey();
  if (!redirectedUnavailableBlog && shouldFocusRoute && projectionKey === lastLocationProjectionKey) {
    return;
  }
  const locationLang = new URLSearchParams(window.location.search).get("lang");
  if (["zh", "en", "ja"].includes(locationLang) && locationLang !== currentLang) {
    setLanguage(locationLang, { captureHistory: false });
  }
  let historyState = currentPublicHistoryState();
  const historyMatchesLocation = historyState
    && historyState.route === parsed.route
    && historyState.articleSlug === parsed.articleSlug;
  if (!historyMatchesLocation) {
    const nextState = publicHistoryStateFor(parsed.route, parsed.articleSlug, {
      knowledge: defaultKnowledgeHistorySnapshot(),
      articleScrollTop: 0,
      articleReturnMode: "default"
    });
    window.history.replaceState(
      nextState,
      "",
      `${window.location.pathname}${window.location.search}${window.location.hash}`
    );
    historyState = currentPublicHistoryState();
  }
  if (parsed.route === "knowledge") {
    const knowledgeSnapshot = historyState?.knowledge || defaultKnowledgeHistorySnapshot();
    activeFilters.knowledge = knowledgeSnapshot.category;
    articleState.searchTerm = knowledgeSnapshot.searchTerm;
    if (parsed.articleSlug) {
      articleState.currentSlug = parsed.articleSlug;
      articleState.currentArticle = null;
      articleState.detailLoadingKey = "";
      articleState.focusDetailOnRender = shouldFocusRoute;
      articleState.detailFocusReady = false;
      articleState.pendingListScrollTop = null;
      articleState.pendingDetailScrollTop = historyState?.articleScrollTop || 0;
    } else {
      articleState.currentSlug = "";
      articleState.currentArticle = null;
      articleState.detailLoadingKey = "";
      articleState.focusDetailOnRender = false;
      articleState.detailFocusReady = false;
      articleState.pendingListScrollTop = knowledgeSnapshot.scrollTop;
      articleState.pendingDetailScrollTop = null;
    }
  } else {
    articleState.pendingListScrollTop = null;
    articleState.pendingDetailScrollTop = null;
  }
  navigate(parsed.route, {
    updateUrl: false,
    articleSlug: parsed.articleSlug || "",
    focusWindow: shouldFocusRoute && !parsed.articleSlug
  });
  if (parsed.route === "knowledge") {
    closeWelcome({ restoreFocus: false });
    renderKnowledge();
  }
  lastLocationProjectionKey = locationProjectionKey();
}

function instantiateKnowledgeRoute(createKnowledgeRoute) {
  return createKnowledgeRoute({
    articleState,
    activeFilters,
    siteUpdateCategory,
    dailyAiNewsCategory,
    toolRadarCategory,
    siteGuidesCategory,
    getCurrentLang: () => currentLang,
    t,
    boundedHistoryScrollTop,
    markStatusMessage,
    articleCategoryName,
    articleTagName,
    formatArticleDate,
    articleRouteHref,
    requestMobileFocusReveal,
    visiblePublicArticles,
    renderUpdates,
    isAbortError,
    renderLatestUpdateDate,
    syncDocumentMeta,
    syncArticleDocumentMeta,
    captureKnowledgeHistorySnapshot,
    defaultKnowledgeHistorySnapshot,
    replaceCurrentPublicHistoryState,
    currentPublicHistoryState,
    normalizeKnowledgeHistorySnapshot,
    navigate,
    closeWelcome,
    requestJson: cachedRouteJson,
    sitePath,
    schedulePublicHistoryStateSync
  });
}

function knowledgeRoute() {
  return routeModuleRegistry.get("knowledge");
}

function renderKnowledge(...args) { return knowledgeRoute()?.renderKnowledge(...args); }
function restorePendingKnowledgeScroll(...args) { return knowledgeRoute()?.restorePendingKnowledgeScroll(...args); }
function resetKnowledgeListScroll(...args) { return knowledgeRoute()?.resetKnowledgeListScroll(...args); }
function focusArticleDetailTitle(...args) { return knowledgeRoute()?.focusArticleDetailTitle(...args); }
function syncArticleSummaryControl(...args) { return knowledgeRoute()?.syncArticleSummaryControl(...args); }
function toggleArticleSummary(...args) { return knowledgeRoute()?.toggleArticleSummary(...args); }
function resetArticleToc(...args) { return knowledgeRoute()?.resetArticleToc(...args); }
function disconnectArticleTocObserver(...args) { return knowledgeRoute()?.disconnectArticleTocObserver(...args); }
function updateArticleTocActive(...args) { return knowledgeRoute()?.updateArticleTocActive(...args); }
function measureArticleReadState(...args) { return knowledgeRoute()?.measureArticleReadState(...args) || null; }
function applyArticleReadState(...args) { return knowledgeRoute()?.applyArticleReadState(...args); }
function scrollToArticleHeading(...args) { return knowledgeRoute()?.scrollToArticleHeading(...args); }
function scrollArticleToTop(...args) { return knowledgeRoute()?.scrollArticleToTop(...args); }
function clearArticleCopyStatus(...args) { return knowledgeRoute()?.clearArticleCopyStatus(...args); }
function resetArticleReadProgress(...args) { return knowledgeRoute()?.resetArticleReadProgress(...args); }
function scheduleArticleReadProgressUpdate(...args) { return knowledgeRoute()?.scheduleArticleReadProgressUpdate(...args); }
function copyArticleLink(...args) { return knowledgeRoute()?.copyArticleLink(...args); }
function safeArticleImageSrc(...args) { return knowledgeRoute()?.safeArticleImageSrc(...args) || ""; }
function showMoreArticles(...args) { return knowledgeRoute()?.showMoreArticles(...args); }
function syncKnowledgeCategoryRail(...args) { return knowledgeRoute()?.syncKnowledgeCategoryRail(...args); }
async function showArticle(...args) { return (await ensureRouteModule("knowledge")).showArticle(...args); }
async function showArticleList(...args) { return (await ensureRouteModule("knowledge")).showArticleList(...args); }
async function showArticleCategory(...args) { return (await ensureRouteModule("knowledge")).showArticleCategory(...args); }
function handleKnowledgeSearchInput(...args) { return knowledgeRoute()?.handleKnowledgeSearchInput(...args); }
function handleArticleDetailScroll(...args) { return knowledgeRoute()?.handleArticleDetailScroll(...args); }
async function loadArticles(...args) { return (await ensureRouteModule("knowledge")).loadArticles(...args); }
async function loadArticleDetail(...args) { return (await ensureRouteModule("knowledge")).loadArticleDetail(...args); }




function markStatusMessage(node, kind = "status") {
  const isError = kind === "error";
  node.setAttribute("role", isError ? "alert" : "status");
  node.setAttribute("aria-live", isError ? "assertive" : "polite");
  node.setAttribute("aria-atomic", "true");
}

function restoreRetryFocus(operation, retrySelector, containerSelector) {
  const settle = () => window.requestAnimationFrame(() => {
    const container = document.querySelector(containerSelector);
    if (!container || !document.contains(container)) return;
    const active = document.activeElement;
    if (active instanceof HTMLElement
      && active !== document.body
      && active !== document.documentElement
      && document.contains(active)
      && focusTargetIsVisible(active)) {
      return;
    }
    const target = document.querySelector(retrySelector)
      || container.querySelector("[role='alert'], [role='status']")
      || container.querySelector("button:not(:disabled), a[href]")
      || container;
    if (!(target instanceof HTMLElement) || !focusTargetIsVisible(target)) return;
    const needsTemporaryTabIndex = target.tabIndex < 0 && !target.hasAttribute("tabindex");
    if (needsTemporaryTabIndex) target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
    if (needsTemporaryTabIndex) {
      target.addEventListener("blur", () => target.removeAttribute("tabindex"), { once: true });
    }
  });
  Promise.resolve(operation).then(settle, settle);
}







function articleCategoryName(category) {
  if (category === "all") {
    return t("all");
  }
  return articleCategoryLabels[category]?.[currentLang] || category || "note";
}

function articleTagName(tag) {
  const rawTag = String(tag || "").trim();
  const labelKey = tagLabels[rawTag] ? rawTag : normalizedTagLabelKeys.get(rawTag.toLocaleLowerCase());
  return tagLabels[labelKey]?.[currentLang] || rawTag;
}

function isCollapsedPublicLoopUpdate(item) {
  const slug = String(item?.slug || "");
  if (slug === publicLoopNightlyUpdateSlug) {
    return false;
  }
  if (item?.category === siteUpdateCategory && publicLoopNightlyCollapsedSlugs.has(slug)) {
    return true;
  }
  if (item?.category === siteUpdateCategory && slug.startsWith("2026-06-18-")) {
    return true;
  }
  const fallbackTitleEn = typeof item?.title === "object" ? item.title.en : "";
  if (!slug && publicLoopNightlyCollapsedFallbackTitlesEn.has(fallbackTitleEn)) {
    return true;
  }
  return !slug && item?.date === "2026.06.18" && fallbackTitleEn !== publicLoopNightlyUpdateTitleEn;
}

function visiblePublicArticles(items) {
  return (items || []).filter((item) => !isCollapsedPublicLoopUpdate(item));
}

function visibleLocalUpdates() {
  return visiblePublicArticles(homeContent.updates);
}


function instantiateVideosRoute(createVideosRoute, videosContent) {
  return createVideosRoute({
    state: videoState,
    activeFilters,
    content: videosContent,
    siteUpdateCategory,
    requestJson: cachedRouteJson,
    isAbortError,
    t,
    localText,
    formatArticleDate,
    safeHttpUrl,
    markStatusMessage,
    getCurrentLang: () => currentLang,
    videoWindowState,
    modalFocusState,
    cancelSurfaceClose,
    modalTriggerCandidate,
    syncModalIsolation,
    runWindowLayoutTransition,
    runSurfaceClose,
    restoreModalFocus
  });
}

function videosRoute() { return routeModuleRegistry.get("videos"); }
function renderVideos(...args) { return videosRoute()?.renderVideos(...args); }
function focusVideoCategory(...args) { return videosRoute()?.focusVideoCategory(...args); }
function showAllVideos(...args) { return videosRoute()?.showAllVideos(...args); }
function updateVideoWindowButton(...args) { return videosRoute()?.updateVideoWindowButton(...args); }
function openVideo(...args) { return videosRoute()?.openVideo(...args); }
function retryVideoPlayer(...args) { return videosRoute()?.retryVideoPlayer(...args); }
function fullscreenVideo(...args) { return videosRoute()?.fullscreenVideo(...args); }
function closeVideo(...args) { return videosRoute()?.closeVideo(...args); }
async function loadVideos(...args) { return (await ensureRouteModule("videos")).loadVideos(...args); }














function runWindowLayoutTransition(kind, target, commit) {
  let committed = false;
  const commitOnce = () => {
    if (committed) {
      return;
    }
    committed = true;
    commit();
  };
  if (!window.LusuUiMotion?.run) {
    commitOnce();
    return;
  }
  window.LusuUiMotion.run(kind, { target }, commitOnce).catch(commitOnce);
}















function normalizeDateInput(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  if (/^\d{4}\.\d{2}\.\d{2}$/.test(raw)) {
    return raw.replace(/^(\d{4})\.(\d{2})\.(\d{2})$/, "$1-$2-$3T00:00:00");
  }
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(raw)) {
    return raw.replace(" ", "T") + (/[zZ]|[+-]\d{2}:?\d{2}$/.test(raw) ? "" : "Z");
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?$/.test(raw)) {
    return `${raw}Z`;
  }
  return raw;
}

function localTimeZoneLabel() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "Local";
}

function formatZonedDateTime(value, options = {}) {
  const normalizedValue = normalizeDateInput(value);
  const date = new Date(normalizedValue);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const includeDate = options.includeDate ?? true;
  const includeTimeZone = options.includeTimeZone ?? false;
  const parts = new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(date).reduce((result, part) => {
    result[part.type] = part.value;
    return result;
  }, {});
  const dateText = includeDate ? `${parts.year}-${parts.month}-${parts.day} ` : "";
  const zoneText = includeTimeZone ? ` ${localTimeZoneLabel()}` : "";
  return `${dateText}${parts.hour}:${parts.minute}:${parts.second}${zoneText}`;
}

function formatArticleDate(value, options = {}) {
  const formatted = formatZonedDateTime(value, { includeDate: true, includeTimeZone: false });
  return options.includeSeconds === false ? formatted.replace(/:\d{2}$/, "") : formatted;
}

function formatLocalDateKey(value) {
  const normalizedValue = normalizeDateInput(value);
  const date = new Date(normalizedValue);
  if (Number.isNaN(date.getTime())) {
    return String(value || "").slice(0, 10).replace(/-/g, ".");
  }
  const parts = new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date).reduce((result, part) => {
    result[part.type] = part.value;
    return result;
  }, {});
  return `${parts.year}.${parts.month}.${parts.day}`;
}


















function instantiateResourcesRoute(createResourcesRoute, resourcesContent) {
  return createResourcesRoute({
    content: resourcesContent,
    activeFilters,
    trustedExternalHosts: trustedResourceExternalHosts,
    safeHttpUrl,
    safeTrustedExternalUrl,
    sitePath,
    safeResourceIconSrc,
    localText,
    contentTitle,
    t,
    label
  });
}

function resourcesRoute() { return routeModuleRegistry.get("resources"); }
function renderResources(...args) { return resourcesRoute()?.renderResources(...args); }

function instantiateGamesRoute(createGamesRoute) {
  return createGamesRoute({
    state: gameState,
    requestJson: cachedRouteJson,
    isAbortError,
    t,
    localText,
    markStatusMessage,
    safeGameCoverSrc,
    safeGithubUrl,
    buildGameUrl,
    isExternalGameUrl,
    languageSupportTagElements
  });
}

function gamesRoute() { return routeModuleRegistry.get("games"); }
function renderGames(...args) { return gamesRoute()?.renderGames(...args); }

function blogCardElement(item) {
  const card = document.createElement("article");
  card.className = "blog-card";
  const titleText = localText(item.title);

  const title = document.createElement("h2");
  title.textContent = titleText;

  const desc = document.createElement("p");
  desc.textContent = localText(item.desc);

  const meta = document.createElement("div");
  meta.className = "meta-row";
  const date = document.createElement("span");
  date.textContent = `${label("date")}: ${item.date || ""}`;
  meta.appendChild(date);
  (item.tags || []).forEach((tag) => {
    const tagNode = document.createElement("span");
    tagNode.className = "tag";
    tagNode.textContent = articleTagName(tag);
    meta.appendChild(tagNode);
  });

  card.append(title, desc, meta);
  const blogUrl = String(item.url || "").trim();
  if (/^\/articles\/[a-z0-9][a-z0-9-]{0,119}\/?$/i.test(blogUrl)) {
    const action = document.createElement("a");
    action.className = "card-action";
    action.href = blogUrl;
    action.textContent = t("readButton");
    action.setAttribute("aria-label", `${t("readButton")}: ${titleText}`);
    card.appendChild(action);
  }
  return card;
}

function blogEmptyStateElement() {
  const state = document.createElement("article");
  state.className = "resource-empty-state blog-empty-state";
  state.classList.add("content-state", "is-empty");
  markStatusMessage(state);

  const icon = document.createElement("span");
  icon.className = "resource-empty-icon blog-empty-icon";
  icon.setAttribute("aria-hidden", "true");

  const copy = document.createElement("div");
  copy.className = "resource-empty-copy";
  const title = document.createElement("h2");
  title.textContent = t("blogEmptyTitle");
  const body = document.createElement("p");
  body.textContent = t("blogEmptyBody");
  copy.append(title, body);

  const action = document.createElement("button");
  action.type = "button";
  action.className = "xp-button";
  action.dataset.route = "knowledge";
  action.textContent = t("blogEmptyAction");

  state.append(icon, copy, action);
  return state;
}

function publishedBlogItems() {
  return blogState.items.filter((item) => item.published === true && (item.url || item.content));
}

function syncOptionalRouteEntries() {
  document.querySelectorAll("[data-blog-entry]").forEach((entry) => {
    entry.hidden = !blogRouteAvailable;
  });
  const blogPage = document.getElementById("blog");
  if (blogPage) blogPage.setAttribute("aria-hidden", String(!blogRouteAvailable));
  syncDesktopIconRovingTabindex();
}

function visibleDesktopIcons() {
  return [...document.querySelectorAll(".desktop-icons .desktop-icon")]
    .filter((button) => !button.hidden && button.getClientRects().length > 0);
}

function syncDesktopIconRovingTabindex(preferredButton = null) {
  const icons = visibleDesktopIcons();
  if (!icons.length) {
    return;
  }
  const current = preferredButton && icons.includes(preferredButton)
    ? preferredButton
    : icons.find((button) => button.tabIndex === 0)
      || icons.find((button) => button.dataset.route === document.body.dataset.route)
      || icons[0];
  icons.forEach((button) => {
    button.tabIndex = button === current ? 0 : -1;
  });
}

function desktopIconDirectionalTarget(origin, key) {
  const icons = visibleDesktopIcons();
  if (!icons.includes(origin)) {
    return null;
  }
  if (key === "Home") return icons[0];
  if (key === "End") return icons.at(-1);

  const originRect = origin.getBoundingClientRect();
  const originX = originRect.left + originRect.width / 2;
  const originY = originRect.top + originRect.height / 2;
  const direction = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1]
  }[key];
  if (!direction) {
    return null;
  }

  return icons
    .filter((candidate) => candidate !== origin)
    .map((candidate) => {
      const rect = candidate.getBoundingClientRect();
      const deltaX = rect.left + rect.width / 2 - originX;
      const deltaY = rect.top + rect.height / 2 - originY;
      const primary = direction[0] ? deltaX * direction[0] : deltaY * direction[1];
      const secondary = direction[0] ? Math.abs(deltaY) : Math.abs(deltaX);
      return { candidate, primary, secondary };
    })
    .filter(({ primary }) => primary > 1)
    .sort((a, b) => (a.primary - b.primary) || (a.secondary - b.secondary))[0]?.candidate || null;
}

function handleDesktopIconKeydown(event) {
  const origin = event.target instanceof Element ? event.target.closest(".desktop-icon") : null;
  if (!origin || !event.currentTarget?.contains(origin)) {
    return;
  }
  const target = desktopIconDirectionalTarget(origin, event.key);
  if (!target) {
    return;
  }
  event.preventDefault();
  syncDesktopIconRovingTabindex(target);
  target.focus({ preventScroll: true });
}

function renderBlog() {
  const list = document.getElementById("blog-list");
  list.replaceChildren();
  if (blogState.loading) {
    const status = document.createElement("div");
    status.className = "content-state is-loading";
    const copy = document.createElement("p");
    copy.className = "content-state-copy loading-text";
    copy.textContent = t("routeModuleLoading");
    markStatusMessage(status);
    status.appendChild(copy);
    list.appendChild(status);
    return;
  }
  const items = publishedBlogItems();
  if (!items.length) {
    list.appendChild(blogEmptyStateElement());
    return;
  }
  items.forEach((item) => list.appendChild(blogCardElement(item)));
}

function renderUpdates() {
  const list = document.getElementById("recent-updates");
  const updateArticles = siteUpdateArticles().length
    ? siteUpdateArticles().slice(0, 3)
    : visibleLocalUpdates().slice(0, 3);
  if (!updateArticles.length) {
    const emptyItem = document.createElement("li");
    const icon = document.createElement("span");
    icon.className = "update-icon update-icon-knowledge";
    icon.setAttribute("aria-hidden", "true");
    const copy = document.createElement("span");
    const title = document.createElement("strong");
    title.textContent = t("articleLoading");
    const detail = document.createElement("small");
    detail.textContent = t("articleEmpty");
    copy.append(title, detail);
    emptyItem.append(icon, copy);
    list.replaceChildren(emptyItem);
    return;
  }
  list.replaceChildren(...updateArticles.map((item) => recentUpdateElement(item)));
}

function recentUpdateElement(item) {
  const row = document.createElement("li");
  const link = document.createElement("a");
  link.className = "recent-update-link";
  if (item.slug && !item.fallbackOnly) {
    link.href = articleRouteHref(item.slug);
    link.dataset.articleSlug = item.slug;
  } else {
    link.href = "/#knowledge";
  }

  const icon = document.createElement("span");
  icon.className = `update-icon ${recentUpdateIconClass(item)}`;
  icon.setAttribute("aria-hidden", "true");

  const copy = document.createElement("span");
  const title = document.createElement("strong");
  const fullTitle = localText(item.title);
  const publishedDate = formatArticleDate(item.published_at || item.created_at || item.date);
  title.textContent = fullTitle;
  const detail = document.createElement("small");
  detail.textContent = publishedDate;

  const accessibleLabel = [fullTitle, publishedDate].filter(Boolean).join(" - ");
  if (accessibleLabel) {
    link.title = accessibleLabel;
    link.setAttribute("aria-label", accessibleLabel);
  }

  copy.append(title, detail);
  link.append(icon, copy);
  row.appendChild(link);
  return row;
}

function recentUpdateIconClass(item) {
  return item?.category === siteUpdateCategory || item?.icon === "system"
    ? "update-icon-system"
    : "update-icon-knowledge";
}

function latestUpdateDate() {
  const dates = siteUpdateArticles().length ? siteUpdateArticles() : visibleLocalUpdates();
  return dates.reduce((latest, item) => {
    const date = formatLocalDateKey(item.published_at || item.created_at || item.date);
    return date > latest ? date : latest;
  }, "");
}

function renderLatestUpdateDate(node = document.getElementById("top-updated")) {
  if (!node) return "";
  const value = latestUpdateDate();
  node.textContent = value;
  if (node.localName === "time") {
    if (/^\d{4}\.\d{2}\.\d{2}$/.test(value)) {
      node.setAttribute("datetime", value.replace(/\./g, "-"));
    } else {
      node.removeAttribute("datetime");
    }
  }
  return value;
}

function siteUpdateArticles() {
  return visiblePublicArticles(articleState.articles)
    .filter((item) => item.category === siteUpdateCategory)
    .sort((a, b) => String(b.published_at || b.created_at || "").localeCompare(String(a.published_at || a.created_at || "")));
}

function truncateText(value, maxLength) {
  const chars = Array.from(String(value || ""));
  return chars.length > maxLength ? `${chars.slice(0, maxLength - 3).join("")}...` : chars.join("");
}

function renderAll() {
  renderLatestUpdateDate();
  const route = document.body.dataset.route || "home";
  if (route === "knowledge") renderKnowledge();
  if (route === "videos") renderVideos();
  if (route === "resources") renderResources();
  if (route === "games") renderGames({ load: false });
  if (route === "blog") renderBlog();
  if (route === "home") renderUpdates();
}





function activeModalSurface() {
  const videoModal = document.getElementById("video-modal");
  if (videoModal && !videoModal.hidden) {
    return videoModal;
  }
  const welcomeModal = document.getElementById("welcome-modal");
  return welcomeModal && !welcomeModal.hidden ? welcomeModal : null;
}

function syncModalIsolation() {
  const activeSurface = activeModalSurface();
  const backgrounds = document.querySelectorAll("[data-modal-background]");
  backgrounds.forEach((background) => {
    if (activeSurface) {
      if (!modalBackgroundOriginalInert.has(background)) {
        modalBackgroundOriginalInert.set(background, Boolean(background.inert));
      }
      background.inert = true;
      return;
    }
    if (modalBackgroundOriginalInert.has(background)) {
      background.inert = modalBackgroundOriginalInert.get(background);
      modalBackgroundOriginalInert.delete(background);
    }
  });
  [document.getElementById("welcome-modal"), document.getElementById("video-modal")].forEach((surface) => {
    if (surface) {
      surface.inert = Boolean(activeSurface && !surface.hidden && surface !== activeSurface);
    }
  });
}

function modalTriggerCandidate(candidate, modal) {
  return candidate instanceof Element
    && document.contains(candidate)
    && candidate !== document.body
    && candidate !== document.documentElement
    && !modal?.contains(candidate)
    ? candidate
    : null;
}

function usableModalFocusTarget(target) {
  return target instanceof Element
    && document.contains(target)
    && target !== document.body
    && target !== document.documentElement
    && !target.closest("[inert]")
    && typeof target.focus === "function";
}

function restoreModalFocus(key) {
  const target = modalFocusState[key];
  modalFocusState[key] = null;
  if (usableModalFocusTarget(target)) {
    target.focus({ preventScroll: true });
    return;
  }
  const activeDialog = activeModalSurface()?.querySelector("[role='dialog']");
  const fallback = activeDialog?.querySelector("button[data-close-modal], button[data-close-welcome]")
    || activeDialog
    || routeWindowFocusTarget(document.body.dataset.route || "home");
  if (usableModalFocusTarget(fallback)) {
    fallback.focus({ preventScroll: true });
  }
}

const surfaceCloseRequests = new WeakMap();

function surfaceMotionTarget(surface) {
  return surface?.querySelector?.(".xp-window") || surface || null;
}

function cancelSurfaceClose(surface) {
  if (!surface) {
    return;
  }
  surfaceCloseRequests.delete(surface);
  surface.removeAttribute("data-ui-closing");
  const target = surfaceMotionTarget(surface);
  target?.getAnimations?.().forEach((animation) => animation.cancel());
}

function runSurfaceClose(surface, options, commit) {
  if (!surface || typeof commit !== "function") {
    commit?.();
    return;
  }
  if (surface.getAttribute("data-ui-closing") === "true") {
    return;
  }
  const request = {};
  const origin = options?.origin instanceof Element ? options.origin : null;
  const commitOnce = () => {
    if (surfaceCloseRequests.get(surface) !== request) {
      return;
    }
    surfaceCloseRequests.delete(surface);
    surface.removeAttribute("data-ui-closing");
    commit();
  };
  surfaceCloseRequests.set(surface, request);
  surface.setAttribute("data-ui-closing", "true");
  if (options?.motion === false || !window.LusuUiMotion?.run) {
    commitOnce();
    return;
  }
  window.LusuUiMotion.run("modal-close", {
    target: surfaceMotionTarget(surface),
    originRect: origin?.getBoundingClientRect() || null,
    deferCommit: true
  }, commitOnce).catch(commitOnce);
}

function localWelcomeDayStamp(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function markWelcomeSeen(dayStamp = localWelcomeDayStamp()) {
  welcomeSeenDayInMemory = dayStamp;
  safeStorageSet(welcomeStorageKey, dayStamp);
  safeSessionSet(welcomeStorageKey, dayStamp);
}

function closeWelcome(options = {}) {
  const modal = document.getElementById("welcome-modal");
  const wasOpen = modal && !modal.hidden;
  const finalizeClose = () => {
    if (modal) {
      modal.hidden = true;
    }
    syncModalIsolation();
    if (wasOpen && options.restoreFocus !== false) {
      restoreModalFocus("welcomeTrigger");
    }
  };
  if (!wasOpen) {
    finalizeClose();
    return;
  }
  runSurfaceClose(modal, {
    motion: options.motion,
    origin: modalFocusState.welcomeTrigger
  }, finalizeClose);
}

function focusableDialogElements(dialog) {
  return [...dialog.querySelectorAll([
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "iframe",
    "[tabindex]:not([tabindex='-1'])"
  ].join(","))].filter((element) => {
    if (element.hidden || element.getAttribute("aria-hidden") === "true") {
      return false;
    }
    const rects = element.getClientRects();
    return rects.length > 0;
  });
}

function activeModalDialog() {
  return activeModalSurface()?.querySelector("[role='dialog']") || null;
}

function trapDialogFocus(event) {
  if (event.key !== "Tab") {
    return false;
  }
  const dialog = activeModalDialog();
  if (!dialog) {
    return false;
  }
  const focusable = focusableDialogElements(dialog);
  if (!focusable.length) {
    event.preventDefault();
    dialog.focus?.({ preventScroll: true });
    return true;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;
  if (!dialog.contains(active)) {
    event.preventDefault();
    first.focus({ preventScroll: true });
    return true;
  }
  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus({ preventScroll: true });
    return true;
  }
  if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus({ preventScroll: true });
    return true;
  }
  return false;
}

const wallpaperMotionMedia = typeof window.matchMedia === "function"
  ? window.matchMedia("(prefers-reduced-motion: reduce)")
  : null;
const wallpaperPreviewTheme = ["morning", "day", "dusk", "night"].includes(pageParams.get("wallpaper"))
  ? pageParams.get("wallpaper")
  : "";
const initialTimeTheme = ["morning", "day", "dusk", "night"].includes(document.documentElement.dataset.timeTheme)
  ? document.documentElement.dataset.timeTheme
  : "";
let renderedHomeTimeTheme = "";
const wallpaperCloudLayers = Object.freeze({
  morning: Object.freeze(["top-left", "high-left", "top-right", "upper-right", "left-mid", "center-mid", "right-mid"]),
  day: Object.freeze(["top-left", "top-center", "top-right", "mid-left", "mid-right"]),
  dusk: Object.freeze(["top-left", "high-left", "top-right", "upper-right", "left-mid", "center-mid", "right-mid"]),
  night: Object.freeze(["top-right", "upper-right", "left-mid", "high-left", "center-mid", "right-mid", "left-low"])
});

function currentTimeTheme(date = new Date()) {
  const minutes = date.getHours() * 60 + date.getMinutes();
  if (minutes >= 5 * 60 && minutes < 11 * 60) {
    return "morning";
  }
  if (minutes >= 11 * 60 && minutes < 17 * 60) {
    return "day";
  }
  if (minutes >= 17 * 60 && minutes < 20 * 60) {
    return "dusk";
  }
  return "night";
}

function measureHomeViewportLayout() {
  const root = document.getElementById("wallpaper-root");
  const stage = document.getElementById("wallpaper-stage");
  if (!root || !stage) {
    return null;
  }
  const rootWidth = root.clientWidth || window.innerWidth;
  const rootHeight = root.clientHeight || window.innerHeight;
  const wallpaperRatio = 1672 / 941;
  const rootRatio = rootWidth / Math.max(rootHeight, 1);
  const stageWidth = rootRatio > wallpaperRatio ? rootWidth : rootHeight * wallpaperRatio;
  const stageHeight = rootRatio > wallpaperRatio ? rootWidth / wallpaperRatio : rootHeight;
  return {
    root,
    stageWidth: Math.ceil(stageWidth),
    stageHeight: Math.ceil(stageHeight),
    routeIconRects: measureRouteIconRects()
  };
}

function applyHomeViewportLayout(measurement) {
  if (!measurement) {
    return;
  }
  measurement.root.style.setProperty("--wallpaper-stage-width", `${measurement.stageWidth}px`);
  measurement.root.style.setProperty("--wallpaper-stage-height", `${measurement.stageHeight}px`);
  storeRouteIconRects(measurement.routeIconRects);
  syncDynamicWallpaperLayers();
}

function layoutWallpaperStage(reason = "home-layout") {
  const pipeline = window.LusuFramePipeline;
  if (typeof pipeline?.schedule === "function") {
    pipeline.schedule("main:home-layout", {
      measure: measureHomeViewportLayout,
      mutate: applyHomeViewportLayout
    }, reason);
    return;
  }
  applyHomeViewportLayout(measureHomeViewportLayout());
}

function updateWallpaperMotionState() {
  const root = document.getElementById("wallpaper-root");
  if (!root) {
    return;
  }
  const managedMode = document.documentElement.dataset.motion;
  root.dataset.motion = ["full", "reduced", "off"].includes(managedMode)
    ? managedMode
    : wallpaperMotionMedia?.matches ? "reduced" : "full";
  root.dataset.paused = document.hidden ? "true" : "false";
  root.dataset.previewMotion = wallpaperPreviewTheme ? "true" : "false";
  syncDynamicWallpaperLayers();
}

function dynamicWallpaperIsActive(root) {
  return root?.dataset.motion === "full"
    && !document.hidden
    && document.body.dataset.route === "home"
    && document.documentElement.dataset.uiShell !== "mobile"
    && document.documentElement.dataset.performanceTier !== "low";
}

function syncDynamicWallpaperLayers() {
  const root = document.getElementById("wallpaper-root");
  const stage = document.getElementById("wallpaper-stage");
  if (!root || !stage) return;
  const theme = wallpaperCloudLayers[root.dataset.time] ? root.dataset.time : "";
  const active = Boolean(theme) && dynamicWallpaperIsActive(root);
  const mountedTheme = stage.dataset.cloudTheme || "";
  if (active && mountedTheme === theme) return;
  stage.querySelectorAll("[data-wallpaper-dynamic-layer]").forEach((layer) => layer.remove());
  delete stage.dataset.cloudTheme;
  if (!active) return;

  const fragment = document.createDocumentFragment();
  wallpaperCloudLayers[theme].forEach((name) => {
    const layer = document.createElement("span");
    layer.className = `wallpaper-cloud wallpaper-cloud-${theme} wallpaper-cloud-${theme}-${name}`;
    layer.dataset.wallpaperDynamicLayer = theme;
    fragment.appendChild(layer);
  });
  stage.insertBefore(fragment, stage.querySelector(".wallpaper-tree-canopy"));
  stage.dataset.cloudTheme = theme;
}

function updateHomeTimeTheme() {
  const home = document.getElementById("home");
  const root = document.getElementById("wallpaper-root");
  if (!home) {
    return;
  }
  const theme = wallpaperPreviewTheme || (!renderedHomeTimeTheme && initialTimeTheme) || currentTimeTheme();
  if (theme === renderedHomeTimeTheme) {
    return;
  }

  const applyTheme = () => {
    renderedHomeTimeTheme = theme;
    document.documentElement.dataset.timeTheme = theme;
    home.dataset.timeTheme = theme;
    document.body.dataset.timeTheme = theme;
    if (root) {
      root.dataset.time = theme;
    }
    layoutWallpaperStage();
    updateWallpaperMotionState();
  };

  if (renderedHomeTimeTheme && window.LusuUiMotion?.run) {
    window.LusuUiMotion.run("theme", { theme }, applyTheme).catch(applyTheme);
    return;
  }
  applyTheme();
}

function updateWelcomeGreeting() {
  const heading = document.querySelector("[data-i18n='welcomeHeading']");
  if (!heading) {
    return;
  }
  const now = new Date();
  const theme = currentTimeTheme(now);
  const greetingKey = theme === "morning"
    ? "greetingMorning"
    : theme === "day"
      ? "greetingNoon"
      : theme === "dusk"
        ? "greetingAfternoon"
        : "greetingEvening";
  const dateLine = t("welcomeDateOnly")
    .replace("{year}", String(now.getFullYear()))
    .replace("{month}", String(now.getMonth() + 1))
    .replace("{day}", String(now.getDate()));
  const greeting = document.createElement("span");
  greeting.className = "welcome-greeting-line";
  greeting.textContent = t(greetingKey);
  const date = document.createElement("span");
  date.className = "welcome-date-line";
  date.textContent = dateLine;
  const glad = document.createElement("span");
  glad.className = "welcome-glad-line";
  glad.textContent = t("welcomeGladLine");
  heading.replaceChildren(greeting, date, glad);
}

function maybeShowWelcome() {
  const welcomeMode = pageParams.get("welcome");
  const forceWelcome = welcomeMode === "1";
  if (welcomeMode === "0") {
    return;
  }
  const today = localWelcomeDayStamp();
  const hasSeenToday = welcomeSeenDayInMemory === today
    || safeStorageGet(welcomeStorageKey) === today
    || safeSessionGet(welcomeStorageKey) === today;
  if (!forceWelcome && hasSeenToday) {
    return;
  }
  updateWelcomeGreeting();
  const modal = document.getElementById("welcome-modal");
  modalFocusState.welcomeTrigger = modalTriggerCandidate(document.activeElement, modal);
  if (modal) {
    cancelSurfaceClose(modal);
    modal.hidden = false;
    markWelcomeSeen(today);
    syncModalIsolation();
    modal.querySelector("button[data-close-welcome]")?.focus({ preventScroll: true });
  }
}

const fullClockFormatter = new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
const compactClockFormatter = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });

function updateClock() {
  const now = new Date();
  const fullTime = fullClockFormatter.format(now).replace(/\//g, ".");
  const compactTime = compactClockFormatter.format(now);
  document.querySelectorAll("[data-local-time]").forEach((node) => {
    node.textContent = node.dataset.localTime === "compact" ? compactTime : fullTime;
    if (node.tagName === "TIME") {
      node.setAttribute("datetime", now.toISOString());
    }
  });
  updateHomeTimeTheme();
}

const accountFeature = createAccountFeature({
  t,
  requestMobileFocusReveal,
  cancelSurfaceClose,
  runSurfaceClose,
  fetchImpl: window.fetch.bind(window)
});
const {
  renderAccountWidget,
  initAccountWidget,
  logoutAccount,
  openAccountPopover,
  closeAccountPopover,
  toggleAccountPopover,
  syncAccountPopoverState
} = accountFeature;

const siteConnectionStatus = createConnectionStatus({
  tray: document.querySelector(".status-tray"),
  button: document.getElementById("site-connection-status"),
  label: document.getElementById("site-connection-label"),
  liveRegion: document.getElementById("site-connection-live"),
  translate: t,
  fetchImpl: window.fetch.bind(window)
});
























































registerRouteLifecycle("home", {
  enter(scope) {
    renderUpdates();
    updateWallpaperMotionState();
    const pipeline = window.LusuFramePipeline;
    if (typeof pipeline?.subscribeViewport === "function") {
      scope.addCleanup(pipeline.subscribeViewport("main:home-layout", {
        measure: measureHomeViewportLayout,
        mutate: applyHomeViewportLayout
      }));
      pipeline.requestViewport?.("route-enter:home");
    } else {
      layoutWallpaperStage("route-enter:home");
    }
  },
  leave() {
    updateWallpaperMotionState();
  }
});

registerRouteLifecycle("knowledge", {
  enter(scope) {
    return ensureRouteModule("knowledge").then((route) => {
      if (!scope.isActive()) return;
      const search = document.getElementById("knowledge-search-input");
      const categories = document.getElementById("knowledge-categories");
      const list = document.getElementById("knowledge-list");
      const detail = document.getElementById("article-detail");
      scope.listen(search, "input", handleKnowledgeSearchInput);
      scope.listen(categories, "scroll", syncKnowledgeCategoryRail, { passive: true });
      scope.listen(list, "scroll", schedulePublicHistoryStateSync, { passive: true });
      scope.listen(detail, "scroll", handleArticleDetailScroll, { passive: true });
      scope.listen(window, "resize", () => {
        route.syncArticleSummaryControl({ preserveExpansion: true });
        route.syncKnowledgeCategoryRail({ revealActive: true });
      }, { passive: true });
      scope.addCleanup(disconnectArticleTocObserver);
      scope.addCleanup(() => {
        window.clearTimeout(articleState.searchDebounceTimer);
        articleState.searchDebounceTimer = 0;
      });
      const pipeline = window.LusuFramePipeline;
      if (typeof pipeline?.subscribeViewport === "function") {
        scope.addCleanup(pipeline.subscribeViewport("main:article-read", {
          measure: measureArticleReadState,
          mutate: applyArticleReadState
        }));
      }
      route.renderKnowledge();
      pipeline?.requestViewport?.("route-enter:knowledge");
      return route.loadArticles({ signal: scope.signal });
    });
  }
});

registerRouteLifecycle("videos", {
  enter(scope) {
    return ensureRouteModule("videos").then((route) => {
      if (!scope.isActive()) return;
      route.renderVideos();
      return route.loadVideos({ signal: scope.signal });
    });
  },
  leave() {
    videosRoute()?.closeVideo({ restoreFocus: false, motion: "off" });
  }
});

registerRouteLifecycle("resources", {
  enter(scope) {
    return ensureRouteModule("resources").then((route) => {
      if (!scope.isActive()) return;
      route.renderResources();
      route.quickTransfer.routeEnter();
    });
  },
  leave() {
    resourcesRoute()?.quickTransfer.routeLeave();
  }
});

registerRouteLifecycle("games", {
  enter(scope) {
    return ensureRouteModule("games").then((route) => {
      if (!scope.isActive()) return;
      return route.renderGames({ load: true, signal: scope.signal });
    });
  },
  leave() {
    gameState.pending = null;
  }
});

registerRouteLifecycle("blog", {
  enter(scope) {
    if (blogState.loaded) {
      renderBlog();
      return;
    }
    blogState.loading = true;
    renderBlog();
    blogState.pending ||= import("./data/blog-content.mjs?v=20260718-resource-icons-layout-r1");
    return blogState.pending.then(({ blogContent }) => {
      if (!scope.isActive()) return;
      blogState.items = blogContent;
      blogState.loaded = true;
      blogState.loading = false;
      renderBlog();
    }).catch((error) => {
      blogState.pending = null;
      blogState.loading = false;
      if (!isAbortError(error) && scope.isActive()) renderBlog();
      throw error;
    });
  }
});

registerRouteLifecycle("chatroom", {
  enter(scope) {
    return ensureRouteModule("chatroom").then((route) => {
      if (!scope.isActive()) return;
      return route.enter(scope);
    });
  },
  leave() {
    routeModuleRegistry.get("chatroom")?.leave();
  }
});

registerRouteLifecycle("about", {
  enter(scope) {
    syncSocialLinks();
    return loadSocialLinks({ signal: scope.signal });
  }
});

const desktopIconGrid = document.querySelector(".desktop-icons");
desktopIconGrid?.addEventListener("keydown", handleDesktopIconKeydown);
desktopIconGrid?.addEventListener("focusin", (event) => {
  const button = event.target instanceof Element ? event.target.closest(".desktop-icon") : null;
  if (button) {
    syncDesktopIconRovingTabindex(button);
  }
});

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

document.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target : event.target?.parentElement;
  if (!target) {
    return;
  }

  if (!target.closest("#account-widget")) {
    const popover = document.getElementById("account-popover");
    closeAccountPopover({ restoreFocus: Boolean(popover?.contains(document.activeElement)) });
  }

  const accountToggle = target.closest("[data-account-toggle]");
  if (accountToggle) {
    toggleAccountPopover(accountToggle);
    return;
  }

  if (target.closest("[data-account-logout]")) {
    logoutAccount();
    return;
  }

  if (target.closest("[data-video-retry]")) {
    restoreRetryFocus(
      loadVideos({ force: true }),
      "[data-video-retry]",
      "#video-list"
    );
    return;
  }

  const videoPlayerRetry = target.closest("[data-video-player-retry]");
  if (videoPlayerRetry) {
    retryVideoPlayer(videoPlayerRetry.dataset.videoPlayerRetry);
    return;
  }

  if (target.closest("[data-article-retry]")) {
    restoreRetryFocus(
      loadArticles({ force: true }),
      "[data-article-retry]",
      "#knowledge-list"
    );
    return;
  }

  const articleDetailRetryButton = target.closest("[data-article-detail-retry]");
  if (articleDetailRetryButton) {
    restoreRetryFocus(
      loadArticleDetail(articleDetailRetryButton.dataset.articleDetailRetry || articleState.currentSlug, { force: true }),
      "[data-article-detail-retry]",
      "#article-detail-body"
    );
    return;
  }

  if (target.closest("[data-game-retry]")) {
    restoreRetryFocus(
      renderGames({ forceRefresh: true }),
      "[data-game-retry]",
      "#game-list"
    );
    return;
  }

  if (target.closest("[data-social-retry]")) {
    restoreRetryFocus(
      loadSocialLinks({ force: true, signal: activeRouteScope("about")?.signal }),
      "[data-social-retry]",
      "#about-social-network-status, #about-social-links"
    );
    return;
  }

  const routeModuleRetryButton = target.closest("[data-route-module-retry]");
  if (routeModuleRetryButton) {
    const route = routeModuleRetryButton.dataset.routeModuleRetry;
    const statusTarget = routeModuleStatusTarget(route);
    if (route === document.body.dataset.route && statusTarget) {
      restartActiveRouteLifecycle("module-retry");
      restoreRetryFocus(
        waitForRouteModuleRetryResult(route, statusTarget),
        `[data-route-module-retry="${route}"]`,
        `#${statusTarget.id}`
      );
    }
    return;
  }

  const langButton = target.closest("[data-lang]");
  if (langButton) {
    setLanguage(langButton.dataset.lang, { persist: true, syncUrl: true });
    return;
  }

  if (target.closest("[data-resource-show-all]")) {
    activeFilters.resources = "all";
    renderResources();
    return;
  }

  if (target.closest("[data-video-show-all]")) {
    showAllVideos();
    return;
  }

  if (target.closest("[data-quick-transfer-open]")) {
    resourcesRoute()?.quickTransfer.open();
    return;
  }

  const filterButton = target.closest("[data-filter-type]");
  if (filterButton) {
    const filterType = filterButton.dataset.filterType;
    const filterValue = filterButton.dataset.filter;
    activeFilters[filterType] = filterValue;
    if (filterType === "knowledge") {
      articleState.visibleCount = 12;
      resetKnowledgeListScroll({ syncHistory: true });
      renderKnowledge();
      window.requestAnimationFrame(() => {
        [...document.querySelectorAll('[data-filter-type="knowledge"]')]
          .find((button) => button.dataset.filter === activeFilters.knowledge)
          ?.focus({ preventScroll: true });
      });
      schedulePublicHistoryStateSync();
      return;
    }
    if (filterType === "videos") {
      renderVideos();
      focusVideoCategory(filterValue);
      return;
    }
    renderAll();
    return;
  }

  if (target.closest("[data-article-load-more]")) {
    showMoreArticles();
    return;
  }

  const articleHeadingButton = target.closest("[data-article-heading-target]");
  if (articleHeadingButton) {
    scrollToArticleHeading(articleHeadingButton.dataset.articleHeadingTarget, { behavior: "auto" });
    return;
  }

  if (target.closest("[data-article-summary-toggle]")) {
    toggleArticleSummary();
    return;
  }

  if (target.closest("[data-article-scroll-top]")) {
    scrollArticleToTop();
    return;
  }

  const articleButton = target.closest("[data-article-slug]");
  if (articleButton) {
    event.preventDefault();
    showArticle(articleButton.dataset.articleSlug, { trigger: articleButton });
    return;
  }

  const articleCategoryButton = target.closest("[data-article-category]");
  if (articleCategoryButton) {
    showArticleCategory(articleCategoryButton.dataset.articleCategory, { trigger: articleCategoryButton });
    return;
  }

  const articleBackButton = target.closest("[data-article-back]");
  if (articleBackButton) {
    showArticleList({ trigger: articleBackButton });
    return;
  }

  if (target.closest("[data-article-copy-link]")) {
    copyArticleLink();
    return;
  }

  if (target.closest("[data-article-search-clear]")) {
    window.clearTimeout(articleState.searchDebounceTimer);
    articleState.searchDebounceTimer = 0;
    articleState.searchTerm = "";
    articleState.visibleCount = 12;
    resetKnowledgeListScroll({ syncHistory: true });
    renderKnowledge();
    schedulePublicHistoryStateSync();
    document.getElementById("knowledge-search-input")?.focus();
    return;
  }

  if (target.closest("[data-article-search-reset]")) {
    window.clearTimeout(articleState.searchDebounceTimer);
    articleState.searchDebounceTimer = 0;
    articleState.searchTerm = "";
    articleState.visibleCount = 12;
    activeFilters.knowledge = "all";
    resetKnowledgeListScroll({ syncHistory: true });
    renderKnowledge();
    schedulePublicHistoryStateSync();
    document.getElementById("knowledge-search-input")?.focus();
    return;
  }

  const videoButton = target.closest("[data-video-index]");
  if (videoButton) {
    openVideo(Number(videoButton.dataset.videoIndex), { trigger: videoButton });
    return;
  }

  const managedVideoButton = target.closest("[data-video-id]");
  if (managedVideoButton) {
    openVideo(managedVideoButton.dataset.videoId, { trigger: managedVideoButton });
    return;
  }

  if (target.closest("[data-video-window-toggle], [data-video-fullscreen]")) {
    fullscreenVideo();
    return;
  }

  if (target.closest("[data-close-modal]")) {
    closeVideo();
    return;
  }

  if (target.closest("[data-close-welcome]")) {
    closeWelcome();
    return;
  }

  const routeButton = target.closest("[data-route]:not(body)");
  if (routeButton) {
    event.preventDefault();
    const motionKind = routeButton.matches(".minimize-button")
      ? "window-minimize"
      : routeButton.matches(".close-button") && routeButton.dataset.route === "home"
        ? "window-close"
        : routeButton.matches(".desktop-icon")
          ? "app-open"
          : document.documentElement.dataset.uiShell === "mobile"
            && routeButton.matches(".taskbar-tabs button, .start-button, .mobile-home-button")
            ? "mobile-tab"
            : "route";
    navigate(routeButton.dataset.route, { trigger: routeButton, motionKind });
    closeWelcome({ restoreFocus: false, motion: false });
    return;
  }
});

window.addEventListener("keydown", (event) => {
  if (trapDialogFocus(event)) {
    return;
  }
  if (event.key === "Escape") {
    const videoModal = document.getElementById("video-modal");
    const welcomeModal = document.getElementById("welcome-modal");
    if (videoWindowState.maximized && videoModal && !videoModal.hidden) {
      fullscreenVideo();
      return;
    }
    if (videoModal && !videoModal.hidden) {
      closeVideo();
      return;
    }
    if (welcomeModal && !welcomeModal.hidden) {
      closeWelcome();
      return;
    }
    const privateRoomForm = document.getElementById("chat-private-room-form");
    if (privateRoomForm && !privateRoomForm.hidden) {
      hideChatPrivateRoomForm();
      return;
    }
    closeAccountPopover();
  }
});

window.addEventListener("lusu:language-request", (event) => {
  const lang = event.detail?.lang;
  if (["zh", "en", "ja"].includes(lang)) {
    setLanguage(lang, { persist: true, syncUrl: true });
  }
});

window.addEventListener("hashchange", () => {
  syncRouteFromLocation({ focusWindow: true });
});

window.addEventListener("popstate", () => {
  syncRouteFromLocation({ focusWindow: true });
});

document.querySelector(".skip-link")?.addEventListener("click", (event) => {
  const main = document.getElementById("main-content");
  if (!main) {
    return;
  }

  event.preventDefault();
  main.focus({ preventScroll: true });
  main.scrollIntoView({ block: "start", behavior: "auto" });
});

document.addEventListener("visibilitychange", () => {
  updateWallpaperMotionState();
});

if (wallpaperMotionMedia) {
  const syncWallpaperMotionPreference = () => updateWallpaperMotionState();
  if (typeof wallpaperMotionMedia.addEventListener === "function") {
    wallpaperMotionMedia.addEventListener("change", syncWallpaperMotionPreference);
  } else if (typeof wallpaperMotionMedia.addListener === "function") {
    wallpaperMotionMedia.addListener(syncWallpaperMotionPreference);
  }
}

function browserPreferredLanguage() {
  const candidates = [navigator.language, ...(navigator.languages || [])].filter(Boolean);
  const matched = candidates.map((lang) => lang.toLowerCase()).find((lang) => (
    lang.startsWith("zh") || lang.startsWith("en") || lang.startsWith("ja")
  ));
  if (!matched) {
    return "zh";
  }
  if (matched.startsWith("en")) {
    return "en";
  }
  if (matched.startsWith("ja")) {
    return "ja";
  }
  return "zh";
}

function initialLanguage() {
  const requestedLang = pageParams.get("lang");
  if (["zh", "en", "ja"].includes(requestedLang)) {
    return requestedLang;
  }
  const storedLang = safeStorageGet(languageStorageKey);
  if (["zh", "en", "ja"].includes(storedLang)) {
    return storedLang;
  }
  return browserPreferredLanguage();
}

const publicApi = Object.freeze({
  navigate,
  syncRouteFromLocation,
  focusableDialogElements,
  openAccountPopover,
  closeAccountPopover
});
Object.defineProperty(window, "LusuPublicApi", {
  configurable: false,
  enumerable: false,
  writable: false,
  value: publicApi
});
Object.assign(window, publicApi);

const initialLang = initialLanguage();

syncOptionalRouteEntries();
setLanguage(initialLang);
initAccountWidget();
siteConnectionStatus.start();
updateClock();
setInterval(updateClock, 1000);
if ("scrollRestoration" in window.history) {
  window.history.scrollRestoration = "manual";
}
syncRouteFromLocation({ focusWindow: false });
const hoverRoute = pageParams.get("hover");
if (pageIds.includes(hoverRoute)) {
  document.querySelector(`.desktop-icon[data-route="${hoverRoute}"]`)?.classList.add("is-hovered");
}
window.addEventListener("load", maybeShowWelcome);
