const state = {
  user: null,
  activePanel: "dashboard",
  overview: null,
  articles: [],
  selectedArticleId: "",
  articleLang: "zh",
  articleSaving: false,
  articleSavingMode: "",
  articleDeleting: false,
  videos: [],
  selectedVideoId: "",
  videoCategories: [],
  selectedVideoCategoryId: "",
  videoCategoryBusy: false,
  videoCategoryBusyMode: "",
  videoPreviewing: false,
  videoMetadataRefreshing: false,
  videoSaving: false,
  videoSavingMode: "",
  videoDeleting: false,
  chatMessages: [],
  selectedMessageId: "",
  chatActionBusy: false,
  chatActionBusyMode: "",
  bans: [],
  banListBusy: false,
  banListBusyMode: "",
  banBusyId: "",
  accounts: [],
  selectedAccountId: "",
  accountDetail: null,
  accountSaving: false,
  loadedPanels: {},
  loadingPanels: {},
  loggingOut: false,
  statusHoldUntil: 0,
  timer: null
};

const ACTIVE_PANEL_STORAGE_KEY = "lusu-admin-active-panel";
const LOCAL_COVER_ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/avif"]);
const LOCAL_COVER_ALLOWED_IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "avif"]);
const LOCAL_COVER_ALLOWED_VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/ogg", "video/quicktime"]);
const LOCAL_COVER_ALLOWED_VIDEO_EXTENSIONS = new Set(["mp4", "m4v", "mov", "webm", "ogv"]);
const LOCAL_COVER_MAX_SOURCE_BYTES = 12 * 1024 * 1024;
const LOCAL_VIDEO_FRAME_MAX_SOURCE_BYTES = 768 * 1024 * 1024;
const LOCAL_COVER_MAX_DATA_URL_CHARS = 360000;
const LOCAL_COVER_SIZES = [
  [960, 540],
  [768, 432],
  [640, 360]
];

const panelMeta = {
  dashboard: ["实时监控大屏", "访问、点击、文章和聊天室状态集中查看。"],
  visits: ["访问来源", "按国家、省份、地区和 IP 前缀查看每日访问。"],
  clicks: ["点击埋点", "查看站内各位置点击、PV/UV 和最近事件。"],
  articles: ["知识库文章", "一次编辑 zh / en / ja 三种版本，按当前选择语言显示编辑区。"],
  videos: ["视频管理", "输入 YouTube / Bilibili 链接，服务端识别并缓存标题、简介、发布时间和封面，也可上传本地封面。"],
  videoCategories: ["视频分类管理", "维护视频区顶部标签，支持新增、编辑、停用、排序和安全删除。"],
  chat: ["聊天室管理", "编辑、隐藏、删除聊天记录，按隐藏用户 ID 或 IP 来源禁言。"],
  accounts: ["账号管理", "查看注册账号、重置密码、确认登录履历和近期活跃。"],
  updates: ["后台更新记录", "后台自己的私有更新说明，每次后台更新后同步记录。"],
  docs: ["后台说明", "后台项目说明，不混入主站知识库。"]
};

const overviewPanels = new Set(["dashboard", "visits", "clicks"]);
const staticPanels = new Set(["updates", "docs"]);
const validPanels = new Set(Object.keys(panelMeta));

const adminUpdates = [
  {
    date: "2026-06-18",
    title: "聊天室消息列表渲染安全优化",
    body: "聊天室管理的昵称、消息摘要、可见状态和来源徽标改用 DOM API 写入，进一步避免聊天内容被误当作 HTML。"
  },
  {
    date: "2026-06-18",
    title: "聊天室禁言列表渲染安全优化",
    body: "聊天室管理的禁言类型、禁言对象、原因、时间和停用按钮改用 DOM API 写入，避免禁言审计字段被误当作 HTML。"
  },
  {
    date: "2026-06-18",
    title: "聊天室元信息渲染安全优化",
    body: "聊天室管理的隐藏用户 ID、client id、IP hash、IP 前缀和来源信息改用 DOM API 写入，避免审计字段被误当作 HTML。"
  },
  {
    date: "2026-06-18",
    title: "后台更新记录渲染安全优化",
    body: "后台更新记录改用 DOM API 写入日期、标题和正文，减少后续维护时误把更新文案当作 HTML 执行的风险。"
  },
  {
    date: "2026-06-18",
    title: "后台表单状态换行稳定性优化",
    body: "文章、视频、视频分类和账号表单的状态提示增加最小宽度、换行和移动端整行约束，长错误文案不再挤压操作按钮。"
  },
  {
    date: "2026-06-18",
    title: "后台表单状态可访问性优化",
    body: "文章、视频、视频分类和账号表单的状态提示补充礼貌播报语义，保存、删除和错误提示更容易被辅助技术感知。"
  },
  {
    date: "2026-06-18",
    title: "聊天室禁言列表忙碌态优化",
    body: "禁言列表刷新和停用禁言时会显示刷新中或停用中，并临时禁用列表操作，避免重复请求和状态误读。"
  },
  {
    date: "2026-06-18",
    title: "聊天室禁言按钮忙碌态优化",
    body: "聊天室管理按隐藏用户 ID 或 IP 来源禁言时会临时禁用治理按钮，并在对应按钮显示禁言中，避免慢网络下重复提交禁言请求。"
  },
  {
    date: "2026-06-18",
    title: "聊天室治理按钮忙碌态优化",
    body: "聊天室管理保存、隐藏恢复或删除消息时会临时禁用治理按钮，并显示保存中、隐藏中、恢复中或删除中，减少慢网络下重复提交。"
  },
  {
    date: "2026-06-18",
    title: "视频删除防重复操作优化",
    body: "视频管理删除请求进行中会临时禁用保存、发布和删除按钮，并显示删除中，避免慢网络下重复删除同一个视频。"
  },
  {
    date: "2026-06-18",
    title: "文章删除防重复操作优化",
    body: "知识库文章删除请求进行中会临时禁用保存、发布和删除按钮，并显示删除中，避免慢网络下重复删除同一篇文章。"
  },
  {
    date: "2026-06-18",
    title: "视频分类保存删除防重复操作优化",
    body: "视频分类管理保存或删除分类时会临时禁用保存、删除按钮，并显示保存中或删除中，减少慢网络下重复提交分类变更。"
  },
  {
    date: "2026-06-18",
    title: "文章保存防重复提交优化",
    body: "知识库文章保存或保存并发布时会临时禁用保存、发布和删除按钮，并显示保存中或发布中，避免慢网络下重复提交文章写入。"
  },
  {
    date: "2026-06-18",
    title: "视频保存防重复提交优化",
    body: "视频管理保存或保存并发布时会临时禁用保存、发布和删除按钮，并显示保存中或发布中，避免慢网络下重复提交视频写入。"
  },
  {
    date: "2026-06-18",
    title: "视频元数据按钮忙碌态优化",
    body: "视频管理在自动识别或刷新元数据时会临时禁用识别和刷新按钮，并显示识别中或刷新中，避免慢请求下重复抓取外部元数据。"
  },
  {
    date: "2026-06-18",
    title: "账号保存防重复提交优化",
    body: "账号管理保存时会临时禁用保存按钮并显示保存中，避免慢网络下重复提交角色修改或密码重置；未选择账号时保存按钮也会保持不可用。"
  },
  {
    date: "2026-06-18",
    title: "聊天室治理操作状态优化",
    body: "聊天室管理在未选择记录时会禁用保存、隐藏、删除和禁言操作，选择记录后再恢复可用；隐藏按钮会按当前状态显示隐藏或恢复，减少误点和空操作。"
  },
  {
    date: "2026-06-18",
    title: "后台顶部状态文本换行优化",
    body: "后台顶部状态提示增加宽度和换行约束，长错误文案在窄屏和中等宽度窗口下不再挤压刷新、退出按钮。"
  },
  {
    date: "2026-06-18",
    title: "后台退出中手动刷新防护",
    body: "后台退出流程开始后会同步禁用顶部刷新按钮，并拦截手动刷新入口，避免退出挂起时继续触发后台统计请求；退出失败提示会短暂保留，避免被刷新状态覆盖。"
  },
  {
    date: "2026-06-18",
    title: "后台退出中暂停自动刷新",
    body: "后台退出流程开始后会暂停 30 秒自动刷新，避免退出挂起时继续发送统计面板请求；退出失败后会恢复自动刷新。"
  },
  {
    date: "2026-06-18",
    title: "后台导航当前项语义优化",
    body: "后台侧边栏会为当前标签同步 aria-current，键盘浏览和辅助技术能更清楚地识别当前所在模块。"
  },
  {
    date: "2026-06-18",
    title: "后台退出按钮防连点优化",
    body: "点击退出后按钮会进入“退出中...”状态并临时禁用，避免慢网络下重复提交登出请求；失败时会恢复按钮并显示错误。"
  },
  {
    date: "2026-06-18",
    title: "后台刷新状态可访问性优化",
    body: "顶部刷新状态改为可被辅助技术感知的状态区域，刷新按钮会按当前标签、读取中和无需刷新三种状态更新无障碍说明。"
  },
  {
    date: "2026-06-18",
    title: "后台标签页记忆优化",
    body: "后台会在当前浏览器会话中记住最后打开的标签页，刷新页面后回到上次工作位置；旧值或异常值会自动回到实时大屏。"
  },
  {
    date: "2026-06-18",
    title: "后台静态面板刷新状态优化",
    body: "后台更新记录和后台说明属于本地静态内容，进入后顶部刷新按钮会显示“无需刷新”并禁用，避免误以为会重新请求后台接口。"
  },
  {
    date: "2026-06-18",
    title: "后台自动刷新可见性优化",
    body: "后台实时大屏、访问来源和点击埋点的 30 秒自动刷新会在页面隐藏时暂停，回到前台后再补一次刷新，减少后台标签页长期打开时的无效请求。"
  },
  {
    date: "2026-06-18",
    title: "后台刷新忙碌状态优化",
    body: "后台面板数据读取中会同步禁用顶部刷新按钮，并显示“刷新中...”，避免快速连点造成误解；请求结束或失败后按钮会自动恢复，可继续手动重试。"
  },
  {
    date: "2026-06-18",
    title: "后台面板请求合并优化",
    body: "后台同一标签页数据正在读取时，快速切换或连续点击刷新会复用当前请求，不再并发打出重复后台请求；失败后仍会释放状态，方便再次刷新重试。"
  },
  {
    date: "2026-06-17",
    title: "后台凭据表单语义优化",
    body: "后台登录页和账号重置密码表单的邮箱输入保留邮箱格式校验，同时补齐浏览器标准 username 自动填充语义，减少浏览器表单提示；站长登录、账号保存和 admin 权限复查保持不变。"
  },
  {
    date: "2026-06-17",
    title: "后台首屏按需加载优化",
    body: "后台打开时只读取管理员身份和当前实时大屏数据；文章、视频、聊天室、禁言和账号资料会在进入对应标签页或手动刷新时再加载，减少首屏请求和敏感数据的无谓读取；概览读取失败后仍可切换或手动刷新重试。"
  },
  {
    date: "2026-06-16",
    title: "视频分类 seed 持久化修复",
    body: "视频分类默认标签改为只在全新视频分类表首次创建时初始化；已有后台分类表会写入 seed 状态标记，之后删除默认标签或调整排序都不会被冷启动自动补回。"
  },
  {
    date: "2026-06-16",
    title: "视频置顶独立队列排序修复",
    body: "视频管理新增独立置顶排序值；勾选置顶的视频会先进入置顶队列，公开视频和后台列表都优先显示置顶队列，多个置顶视频再按置顶排序值从大到小排列，未置顶视频继续按普通排序显示。"
  },
  {
    date: "2026-06-16",
    title: "视频封面本地上传与首帧生成",
    body: "视频管理支持上传 JPG、PNG、WEBP、AVIF 本地图片作为封面，并会压缩成适合卡片展示的封面数据；也可从本地视频文件读取第一帧生成封面，保存时如果封面为空会优先使用已选择的视频首帧。"
  },
  {
    date: "2026-06-16",
    title: "视频分类与 Bilibili 元数据维护修复",
    body: "默认视频分类初始化改为只补缺失项，不再覆盖后台改过的分类名称；视频保存时如果链接没有变化，不再反复抓取外部元数据。Bilibili 抓取补强请求头、详情接口、移动页和页面数据兜底，抓取失败时会提示可手动补全；同时新增重复视频拦截和停用分类标识。"
  },
  {
    date: "2026-06-15",
    title: "账号管理和统计口径优化",
    body: "新增后台账号管理页，可查看邮箱、角色、密码加密状态、登录履历、活跃会话和近期站内活跃；密码只允许重置，不展示明文或哈希。统计埋点改为登录账号优先识别，同一登录账号的访问统一计为 1 个 UV，并补充自然语言说明。"
  },
  {
    date: "2026-06-15",
    title: "视频排序和 Bilibili 元数据兜底修复",
    body: "视频和视频分类改为置顶优先、排序值越大越靠前，新建默认追加 +10；Bilibili 抓取在 API 412 后继续尝试页面 meta、结构化数据和页面状态解析；默认分类 seed 不再覆盖后台维护过的排序和启用状态。"
  },
  {
    date: "2026-06-15",
    title: "视频元数据和后台更新记录优化",
    body: "压缩后台视频播放器预览尺寸，增强 YouTube / Bilibili 标题、简介、作者、发布时间和封面抓取；Bilibili 增加浏览器化请求头、页面备用解析和 b23 短链兜底；新增独立“后台更新记录”标签页并调整后台导航顺序。"
  },
  {
    date: "2026-06-15",
    title: "后台视觉优化第一版",
    body: "完成保守型后台视觉优化：统一侧边栏、顶部栏、卡片、按钮、表格、状态标签、空状态和移动端布局，后台更新记录继续独立于主站网站更新记录。"
  },
  {
    date: "2026-06-15",
    title: "文章访问 PV/UV 统计",
    body: "文章详情接口新增服务端访问事件记录，后台大屏新增热门文章表，文章列表和编辑详情显示每篇文章的总 PV/UV 与今日 PV/UV。"
  },
  {
    date: "2026-06-15",
    title: "管理后台 MVP 接入",
    body: "新增独立 /admin/ 后台、实时监控大屏、三语文章编辑、访问来源地图、点击埋点、聊天室编辑删除和禁言能力。"
  }
];

const countryPositions = {
  CN: [104, 35],
  US: [-98, 39],
  JP: [139, 36],
  KR: [127, 36],
  SG: [104, 1.3],
  GB: [-2, 54],
  DE: [10, 51],
  FR: [2, 47],
  CA: [-106, 56],
  AU: [134, -25],
  RU: [90, 61],
  IN: [78, 22],
  BR: [-51, -10]
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) {
      window.location.reload();
    }
    throw new Error(payload.error || `HTTP ${response.status}`);
  }
  return payload;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("zh-CN");
}

function formatTime(value) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(date);
}

function fileExtension(file) {
  return String(file?.name || "").split(".").pop()?.toLowerCase() || "";
}

function assertAllowedFile(file, typeSet, extensionSet, maxBytes, label) {
  if (!file) {
    throw new Error(`请选择${label}。`);
  }
  const type = String(file.type || "").toLowerCase();
  const extension = fileExtension(file);
  if ((!type || !typeSet.has(type)) && !extensionSet.has(extension)) {
    throw new Error(`${label}格式不支持。`);
  }
  if (file.size > maxBytes) {
    throw new Error(`${label}文件过大，请先压缩后再选择。`);
  }
}

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("封面图片读取失败，请换一张图片。"));
    image.src = src;
  });
}

function onceMediaEvent(target, eventName, timeoutMs, message) {
  if (eventName === "loadedmetadata" && target.readyState >= 1) {
    return Promise.resolve();
  }
  if (eventName === "loadeddata" && target.readyState >= 2) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error(message));
    }, timeoutMs);
    const done = () => {
      cleanup();
      resolve();
    };
    const fail = () => {
      cleanup();
      reject(new Error(message));
    };
    const cleanup = () => {
      window.clearTimeout(timer);
      target.removeEventListener(eventName, done);
      target.removeEventListener("error", fail);
    };
    target.addEventListener(eventName, done, { once: true });
    target.addEventListener("error", fail, { once: true });
  });
}

function drawCoverToCanvas(source, width, height, targetWidth, targetHeight) {
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context = canvas.getContext("2d");
  context.fillStyle = "#f7fbff";
  context.fillRect(0, 0, targetWidth, targetHeight);
  const scale = Math.max(targetWidth / width, targetHeight / height);
  const drawWidth = width * scale;
  const drawHeight = height * scale;
  const x = (targetWidth - drawWidth) / 2;
  const y = (targetHeight - drawHeight) / 2;
  context.drawImage(source, x, y, drawWidth, drawHeight);
  return canvas;
}

function coverCanvasDataUrl(source, sourceWidth, sourceHeight) {
  if (!sourceWidth || !sourceHeight) {
    throw new Error("无法读取封面尺寸。");
  }
  const qualities = [0.86, 0.76, 0.66, 0.56];
  for (const [width, height] of LOCAL_COVER_SIZES) {
    const canvas = drawCoverToCanvas(source, sourceWidth, sourceHeight, width, height);
    for (const quality of qualities) {
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      if (dataUrl.length <= LOCAL_COVER_MAX_DATA_URL_CHARS) {
        return dataUrl;
      }
    }
  }
  throw new Error("封面压缩后仍然过大，请换一张更简单的图片。");
}

async function imageFileToCoverDataUrl(file) {
  assertAllowedFile(
    file,
    LOCAL_COVER_ALLOWED_IMAGE_TYPES,
    LOCAL_COVER_ALLOWED_IMAGE_EXTENSIONS,
    LOCAL_COVER_MAX_SOURCE_BYTES,
    "封面图片"
  );
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImageElement(objectUrl);
    return coverCanvasDataUrl(image, image.naturalWidth, image.naturalHeight);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function videoFileToCoverDataUrl(file) {
  assertAllowedFile(
    file,
    LOCAL_COVER_ALLOWED_VIDEO_TYPES,
    LOCAL_COVER_ALLOWED_VIDEO_EXTENSIONS,
    LOCAL_VIDEO_FRAME_MAX_SOURCE_BYTES,
    "本地视频"
  );
  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "metadata";
  try {
    video.src = objectUrl;
    video.load();
    await onceMediaEvent(video, "loadedmetadata", 12000, "视频信息读取失败，无法截取首帧。");
    const targetTime = Number.isFinite(video.duration) && video.duration > 0.2 ? 0.08 : 0;
    if (targetTime > 0) {
      video.currentTime = targetTime;
      await onceMediaEvent(video, "seeked", 12000, "视频首帧定位失败，请换一个视频文件。");
    } else {
      await onceMediaEvent(video, "loadeddata", 12000, "视频画面读取失败，请换一个视频文件。");
    }
    return coverCanvasDataUrl(video, video.videoWidth, video.videoHeight);
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(objectUrl);
  }
}

function thumbnailSourceLabel(value) {
  if (!value) {
    return "暂无封面";
  }
  if (/^data:image\//i.test(value)) {
    return "本地封面预览";
  }
  return "链接封面预览";
}

function toLocalDateTimeInputValue(value) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const parts = new Intl.DateTimeFormat("zh-CN", {
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
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}

function normalizePublishedAtForApi(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return undefined;
  }
  const date = new Date(raw.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) {
    throw new Error("发布时间格式不正确，请使用日期时间选择器或 ISO 时间。");
  }
  return date.toISOString();
}

function emptyState(text) {
  return `<div class="empty-state">${escapeHtml(text)}</div>`;
}

function createEmptyStateElement(text) {
  const empty = document.createElement("div");
  empty.className = "empty-state";
  empty.textContent = text;
  return empty;
}

function emptyRow(colspan, text) {
  return `<tr><td colspan="${colspan}"><span class="empty-inline">${escapeHtml(text)}</span></td></tr>`;
}

function statusBadge(text, tone = "neutral") {
  return `<span class="status-badge ${escapeHtml(tone)}">${escapeHtml(text)}</span>`;
}

function createStatusBadgeElement(text, tone = "neutral") {
  const safeTone = String(tone || "neutral").replace(/[^a-z0-9_-]/gi, "");
  const badge = document.createElement("span");
  badge.className = "status-badge";
  if (safeTone) {
    badge.classList.add(safeTone);
  }
  badge.textContent = text;
  return badge;
}

function articleStatusLabel(status) {
  const labels = {
    draft: "草稿",
    published: "已发布",
    archived: "已归档"
  };
  return labels[status] || status || "未知";
}

function setStatus(text, options = {}) {
  const force = Boolean(options.force);
  if (!force && (state.loggingOut || Date.now() < state.statusHoldUntil)) {
    return;
  }
  $("#refresh-state").textContent = text;
  if (options.holdMs) {
    state.statusHoldUntil = Date.now() + options.holdMs;
  } else if (force) {
    state.statusHoldUntil = 0;
  }
}

function panelDataKey(panel) {
  return overviewPanels.has(panel) ? "overview" : panel;
}

function updateRefreshButton() {
  const button = $("#manual-refresh");
  const panelName = panelMeta[state.activePanel]?.[0] || "当前标签";
  if (state.loggingOut) {
    button.disabled = true;
    button.setAttribute("aria-busy", "false");
    button.setAttribute("aria-label", "正在退出后台，暂停刷新");
    button.title = "正在退出后台，暂停刷新";
    button.textContent = "暂停刷新";
    return;
  }
  const staticPanel = staticPanels.has(state.activePanel);
  const busy = !staticPanel && Boolean(state.loadingPanels[panelDataKey(state.activePanel)]);
  const buttonText = staticPanel ? "无需刷新" : (busy ? "刷新中..." : "刷新");
  const buttonLabel = staticPanel ? `${panelName}无需刷新` : (busy ? `${panelName}正在刷新` : `刷新${panelName}`);
  button.disabled = staticPanel || busy;
  button.setAttribute("aria-busy", busy ? "true" : "false");
  button.setAttribute("aria-label", buttonLabel);
  button.title = staticPanel ? `${panelName}为本地内容，无需刷新` : buttonLabel;
  button.textContent = buttonText;
}

function getStoredActivePanel() {
  try {
    const panel = window.sessionStorage.getItem(ACTIVE_PANEL_STORAGE_KEY);
    return validPanels.has(panel) ? panel : "dashboard";
  } catch (error) {
    return "dashboard";
  }
}

function rememberActivePanel(panel) {
  try {
    window.sessionStorage.setItem(ACTIVE_PANEL_STORAGE_KEY, panel);
  } catch (error) {
    // 忽略浏览器隐私模式或存储策略导致的写入失败。
  }
}

async function loadPanelData(panel, options = {}) {
  if (state.loggingOut) {
    updateRefreshButton();
    return;
  }

  if (staticPanels.has(panel)) {
    setStatus("当前标签为本地内容，无需刷新。");
    updateRefreshButton();
    return;
  }

  const key = panelDataKey(panel);
  const force = Boolean(options.force);
  if (state.loadingPanels[key]) {
    if (!overviewPanels.has(panel)) {
      setStatus("当前标签正在读取，请稍候...");
    }
    updateRefreshButton();
    return state.loadingPanels[key];
  }
  if (!force && state.loadedPanels[key]) {
    return;
  }

  state.loadingPanels[key] = (async () => {
    try {
      if (!overviewPanels.has(panel)) {
        setStatus(force ? "正在刷新当前标签..." : "正在读取当前标签...");
      }

      if (overviewPanels.has(panel)) {
        await loadOverview();
      } else if (panel === "articles") {
        await loadArticles();
      } else if (panel === "videos") {
        await loadVideoCategories();
        await loadVideos();
      } else if (panel === "videoCategories") {
        await loadVideoCategories();
      } else if (panel === "chat") {
        await Promise.all([loadChatMessages(), loadBans()]);
      } else if (panel === "accounts") {
        await loadAccounts();
      }

      state.loadedPanels[key] = Date.now();
      if (!overviewPanels.has(panel)) {
        setStatus(`已读取 ${panelMeta[panel][0]}`);
      }
    } catch (error) {
      setStatus(error.message);
    } finally {
      delete state.loadingPanels[key];
      updateRefreshButton();
    }
  })();

  updateRefreshButton();
  return state.loadingPanels[key];
}

function applyActivePanel(panel) {
  state.activePanel = panel;
  $$(".nav-button").forEach((button) => {
    const active = button.dataset.panel === panel;
    button.classList.toggle("active", active);
    if (active) {
      button.setAttribute("aria-current", "page");
    } else {
      button.removeAttribute("aria-current");
    }
  });
  $$(".panel").forEach((item) => {
    item.classList.toggle("active", item.id === `${panel}-panel`);
  });
  $("#panel-title").textContent = panelMeta[panel][0];
  $("#panel-subtitle").textContent = panelMeta[panel][1];
}

function switchPanel(panel) {
  if (!validPanels.has(panel)) {
    return;
  }
  applyActivePanel(panel);
  rememberActivePanel(panel);
  updateRefreshButton();
  loadPanelData(panel);
}

function autoRefreshActivePanel() {
  if (state.loggingOut || document.hidden || !overviewPanels.has(state.activePanel)) {
    return false;
  }
  loadPanelData(state.activePanel, { force: true });
  return true;
}

async function loadMe() {
  const payload = await api("/api/admin/me");
  state.user = payload.user;
  $("#admin-email").textContent = payload.user.email;
}

async function loadOverview() {
  setStatus("正在刷新数据...");
  const payload = await api("/api/admin/analytics/overview?days=14");
  state.overview = payload;
  renderOverview();
  setStatus(`已刷新 ${formatTime(payload.generatedAt)}`);
}

function renderOverview() {
  if (!state.overview) {
    return;
  }
  $("#analytics-explainer").textContent = "统计口径：PV 是页面被打开的次数，UV 是独立访客数。已登录账号按账号合并，同一账号多设备、多次访问也只算 1 个 UV；匿名访问继续按隐藏访客标识统计。";
  renderKpis(state.overview.cards);
  renderDailyChart(state.overview.daily || []);
  renderHourlyChart(state.overview.hourly || []);
  renderMap(state.overview.regions || state.overview.countries || []);
  renderTopPages(state.overview.topPages || []);
  renderTopArticles(state.overview.topArticles || []);
  renderVisitTables();
  renderClickPanels();
}

function renderKpis(cards) {
  const items = [
    ["今日页面浏览", cards.todayPv, "所有页面打开次数，刷新也会计入。"],
    ["今日独立访客", cards.todayUv, "登录账号按账号合并；匿名访客按隐藏访客标识计算。"],
    [`最近 ${state.overview?.windowDays || 14} 天浏览`, cards.totalPv, "这段时间内站内页面被打开的总次数。"],
    [`最近 ${state.overview?.windowDays || 14} 天访客`, cards.totalUv, "用于判断真实触达人数，登录用户多设备仍合并为 1 个 UV。"],
    ["今日点击动作", cards.todayClicks, "按钮、卡片、筛选和播放等可点击操作次数。"],
    ["正在活跃", cards.onlineVisitors, "最近 5 分钟内有访问记录的访客或登录账号。"],
    ["今日聊天消息", cards.todayMessages, "匿名聊天室今天实际发出的消息数。"]
  ];
  $("#kpi-grid").innerHTML = items.map(([label, value, hint]) => `
    <article class="kpi-card">
      <span>${escapeHtml(label)}</span>
      <strong>${formatNumber(value)}</strong>
      <small>${escapeHtml(hint)}</small>
    </article>
  `).join("");
}

function renderDailyChart(rows) {
  $("#daily-range").textContent = `最近 ${state.overview.windowDays} 天`;
  renderBars($("#daily-chart"), rows, "day");
}

function renderHourlyChart(rows) {
  renderBars($("#hourly-chart"), rows, "hour");
}

function renderBars(container, rows, labelKey) {
  const max = Math.max(1, ...rows.map((row) => Number(row.pv || 0)));
  container.innerHTML = rows.map((row) => {
    const height = Math.max(2, Math.round((Number(row.pv || 0) / max) * 100));
    const label = labelKey === "hour" ? String(row.hour || "").slice(11, 16) : String(row.day || "").slice(5);
    return `
      <div class="bar-cell" title="PV ${formatNumber(row.pv)} / UV ${formatNumber(row.uv)}">
        <div class="bar-stack"><div class="bar-fill" style="height:${height}%"></div></div>
        <div class="bar-label">${escapeHtml(label)}</div>
      </div>
    `;
  }).join("") || emptyState("暂无图表数据");
}

function renderMap(rows) {
  const map = $("#visitor-map");
  const data = rows.filter((row) => Number(row.pv || 0) > 0).slice(0, 40);
  if (!data.length) {
    map.innerHTML = `<span class="muted" style="position:absolute;z-index:3;left:12px;top:12px;">等待访问数据</span>`;
    return;
  }
  const max = Math.max(...data.map((row) => Number(row.pv || 0)), 1);
  map.innerHTML = data.map((row, index) => {
    const [lon, lat] = coordinatesFor(row, index);
    const left = Math.min(94, Math.max(6, ((lon + 180) / 360) * 100));
    const top = Math.min(88, Math.max(10, ((90 - lat) / 180) * 100));
    const size = 10 + Math.round((Number(row.pv || 0) / max) * 22);
    const label = [row.country || "未知", row.region, row.city].filter(Boolean).join(" / ");
    return `
      <button class="map-point" type="button" style="left:${left}%;top:${top}%;--size:${size}px" title="${escapeHtml(label)} PV ${formatNumber(row.pv)} UV ${formatNumber(row.uv)}">
        <span>${escapeHtml(row.country || "未知")} ${formatNumber(row.pv)}</span>
      </button>
    `;
  }).join("");
}

function coordinatesFor(row, index) {
  const lat = Number(row.latitude);
  const lon = Number(row.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lon) && (lat || lon)) {
    return [lon, lat];
  }
  const fallback = countryPositions[String(row.country || "").toUpperCase()] || [20 + index * 17, 25 - (index % 5) * 8];
  return [fallback[0] + (index % 3) * 3, fallback[1] - (index % 4) * 2];
}

function renderTopPages(rows) {
  $("#top-pages").innerHTML = rows.map((row) => `
    <tr>
      <td>${escapeHtml(row.path || "/")}<br><small>${escapeHtml(row.route || "")}</small></td>
      <td>${formatNumber(row.pv)}</td>
      <td>${formatNumber(row.uv)}</td>
      <td>${formatTime(row.last_seen_at)}</td>
    </tr>
  `).join("") || emptyRow(4, "暂无热门页面数据");
}

function renderTopArticles(rows) {
  $("#top-articles").innerHTML = rows.map((row) => `
    <tr>
      <td>${escapeHtml(row.title || row.slug || "未命名文章")}<br><small>${escapeHtml(row.slug || "")} ${escapeHtml(row.category || "")}</small></td>
      <td>${formatNumber(row.pv)}</td>
      <td>${formatNumber(row.uv)}</td>
      <td>${formatTime(row.last_seen_at)}</td>
    </tr>
  `).join("") || emptyRow(4, "暂无热门文章数据");
}

function renderVisitTables() {
  const overview = state.overview || {};
  $("#country-table").innerHTML = (overview.countries || []).map((row) => `
    <tr>
      <td>${escapeHtml(row.country || "未知")}</td>
      <td>${formatNumber(row.pv)}</td>
      <td>${formatNumber(row.uv)}</td>
      <td>${formatTime(row.last_seen_at)}</td>
    </tr>
  `).join("") || emptyRow(4, "暂无国家来源数据");

  $("#region-table").innerHTML = (overview.regions || []).map((row) => {
    const place = [row.country || "未知", row.region, row.city].filter(Boolean).join(" / ");
    return `
      <tr>
        <td>${escapeHtml(place)}</td>
        <td>${escapeHtml(row.ip_prefix || "")}</td>
        <td>${formatNumber(row.pv)}</td>
        <td>${formatNumber(row.uv)}</td>
        <td>${formatTime(row.last_seen_at)}</td>
      </tr>
    `;
  }).join("") || emptyRow(5, "暂无地区来源数据");
}

function renderClickPanels() {
  const overview = state.overview || {};
  $("#top-clicks").innerHTML = (overview.topClicks || []).map((row) => `
    <tr>
      <td>${escapeHtml(row.target_text || row.target_key || row.tag_name || "未知目标")}<br><small>${escapeHtml(row.data_route || row.target_key || "")}</small></td>
      <td>${escapeHtml(row.path || "")}</td>
      <td>${formatNumber(row.clicks)}</td>
      <td>${formatNumber(row.uv)}</td>
      <td>${formatTime(row.last_seen_at)}</td>
    </tr>
  `).join("") || emptyRow(5, "暂无点击热点数据");

  $("#recent-clicks").innerHTML = (overview.recentClicks || []).map((row) => `
    <article class="event-item">
      <strong>${escapeHtml(row.target_text || row.target_key || row.tag_name || "未知点击")}</strong>
      <small>${formatTime(row.created_at)} · ${escapeHtml(row.path || "")} · ${escapeHtml([row.country, row.region, row.city].filter(Boolean).join(" / "))}</small>
    </article>
  `).join("") || emptyState("暂无点击事件");
}

async function loadArticles() {
  const payload = await api("/api/admin/articles");
  state.articles = payload.articles || [];
  renderArticleList();
}

function renderArticleList() {
  $("#article-list").innerHTML = state.articles.map((article) => `
    <button class="list-item ${article.article_id === state.selectedArticleId ? "active" : ""}" type="button" data-article-id="${escapeHtml(article.article_id)}">
      <span class="list-title">${escapeHtml(article.slug)}</span>
      <span class="list-meta">
        ${statusBadge(articleStatusLabel(article.status), article.status || "neutral")}
        ${statusBadge(`${article.translation_count || 0}/3 语种`, Number(article.translation_count || 0) >= 3 ? "visible" : "warning")}
        ${statusBadge(article.category || "未分类", "neutral")}
      </span>
      <span class="list-subtle">PV ${formatNumber(article.article_pv)} / UV ${formatNumber(article.article_uv)} · 更新 ${formatTime(article.updated_at)}</span>
    </button>
  `).join("") || emptyState("暂无文章，点击右上角“新建”开始。");
}

async function selectArticle(articleId) {
  state.selectedArticleId = articleId;
  renderArticleList();
  const payload = await api(`/api/admin/articles/${encodeURIComponent(articleId)}`);
  fillArticleForm(payload.article);
}

function resetArticleForm() {
  state.selectedArticleId = "";
  $("#article-editor-title").textContent = "新建文章";
  $("#article-form").reset();
  $("#article-form").elements.category.value = "note";
  $("#article-form").elements.status.value = "draft";
  $("#delete-article").disabled = true;
  $("#article-status").textContent = "";
  syncArticleSaveButtons();
  renderArticleList();
}

function fillArticleForm(article) {
  const form = $("#article-form");
  $("#article-editor-title").textContent = `编辑：${article.slug}`;
  form.elements.slug.value = article.slug || "";
  form.elements.category.value = article.category || "note";
  form.elements.tags.value = (article.tags || []).join(", ");
  form.elements.cover_image.value = article.cover_image || "";
  form.elements.status.value = article.status || "draft";
  form.elements.published_at.value = toLocalDateTimeInputValue(article.published_at);
  form.elements.is_pinned.checked = Number(article.is_pinned || 0) === 1;
  ["zh", "en", "ja"].forEach((lang) => {
    const item = article.translations?.[lang] || {};
    form.elements[`title_${lang}`].value = item.title || "";
    form.elements[`summary_${lang}`].value = item.summary || "";
    form.elements[`content_${lang}`].value = item.content_markdown || "";
  });
  $("#delete-article").disabled = false;
  $("#article-status").textContent = `文章访问：PV ${formatNumber(article.article_pv)} / UV ${formatNumber(article.article_uv)}，今日 PV ${formatNumber(article.article_today_pv)} / UV ${formatNumber(article.article_today_uv)}`;
  syncArticleSaveButtons();
}

function setArticleLang(lang) {
  state.articleLang = lang;
  $$(".lang-tab").forEach((button) => button.classList.toggle("active", button.dataset.articleLang === lang));
  $$(".language-editor").forEach((panel) => panel.classList.toggle("active", panel.dataset.langPanel === lang));
}

function articlePayload(statusOverride = "") {
  const form = $("#article-form");
  const translations = {};
  ["zh", "en", "ja"].forEach((lang) => {
    const title = form.elements[`title_${lang}`].value.trim();
    const summary = form.elements[`summary_${lang}`].value.trim();
    const content = form.elements[`content_${lang}`].value.trim();
    if (!title || !content) {
      throw new Error(`请补齐 ${lang} 的标题和正文。`);
    }
    translations[lang] = { title, summary, content_markdown: content };
  });
  return {
    slug: form.elements.slug.value.trim(),
    category: form.elements.category.value.trim() || "note",
    tags: form.elements.tags.value.split(/[，,]/).map((item) => item.trim()).filter(Boolean),
    cover_image: form.elements.cover_image.value.trim(),
    status: statusOverride || form.elements.status.value,
    is_pinned: form.elements.is_pinned.checked,
    published_at: normalizePublishedAtForApi(form.elements.published_at.value),
    translations
  };
}

async function saveArticle(statusOverride = "") {
  if (state.articleSaving) {
    return;
  }
  state.articleSaving = true;
  state.articleSavingMode = statusOverride === "published" ? "publish" : "save";
  syncArticleSaveButtons();
  const status = $("#article-status");
  try {
    status.textContent = "正在保存...";
    const payload = articlePayload(statusOverride);
    const path = state.selectedArticleId
      ? `/api/admin/articles/${encodeURIComponent(state.selectedArticleId)}`
      : "/api/admin/articles";
    const method = state.selectedArticleId ? "PUT" : "POST";
    const result = await api(path, { method, body: JSON.stringify(payload) });
    state.selectedArticleId = result.articleId || state.selectedArticleId;
    status.textContent = "已保存。";
    await loadArticles();
    if (state.selectedArticleId) {
      await selectArticle(state.selectedArticleId);
      status.textContent = "已保存。";
    }
  } catch (error) {
    status.textContent = error.message;
  } finally {
    state.articleSaving = false;
    state.articleSavingMode = "";
    syncArticleSaveButtons();
  }
}

function syncArticleSaveButtons() {
  const saveButton = $("#save-article");
  const publishButton = $("#publish-article");
  const deleteButton = $("#delete-article");
  const busy = state.articleSaving || state.articleDeleting;
  if (saveButton) {
    const savingDraft = state.articleSaving && state.articleSavingMode !== "publish";
    saveButton.disabled = busy;
    saveButton.textContent = savingDraft ? "保存中..." : "保存";
    saveButton.setAttribute("aria-busy", savingDraft ? "true" : "false");
    saveButton.title = state.articleDeleting
      ? "正在删除文章"
      : (state.articleSaving ? "正在保存文章" : "保存当前文章");
  }
  if (publishButton) {
    const publishing = state.articleSaving && state.articleSavingMode === "publish";
    publishButton.disabled = busy;
    publishButton.textContent = publishing ? "发布中..." : "保存并发布";
    publishButton.setAttribute("aria-busy", publishing ? "true" : "false");
    publishButton.title = state.articleDeleting
      ? "正在删除文章"
      : (state.articleSaving ? "正在保存文章" : "保存并发布当前文章");
  }
  if (deleteButton) {
    deleteButton.disabled = busy || !state.selectedArticleId;
    deleteButton.textContent = state.articleDeleting ? "删除中..." : "删除";
    deleteButton.setAttribute("aria-busy", state.articleDeleting ? "true" : "false");
    deleteButton.title = busy
      ? (state.articleDeleting ? "正在删除文章" : "正在保存文章")
      : (state.selectedArticleId ? "删除当前文章" : "请先选择已保存文章");
  }
}

async function deleteArticle() {
  if (state.articleSaving || state.articleDeleting || !state.selectedArticleId || !window.confirm("确定删除这篇文章？")) {
    return;
  }
  state.articleDeleting = true;
  syncArticleSaveButtons();
  const status = $("#article-status");
  try {
    status.textContent = "正在删除...";
    await api(`/api/admin/articles/${encodeURIComponent(state.selectedArticleId)}`, { method: "DELETE" });
    resetArticleForm();
    await loadArticles();
    status.textContent = "已删除。";
  } catch (error) {
    status.textContent = error.message;
  } finally {
    state.articleDeleting = false;
    syncArticleSaveButtons();
  }
}

function videoStatusLabel(status) {
  return ({ draft: "草稿", published: "已发布", hidden: "隐藏" })[status] || status || "未知";
}

async function loadVideos() {
  const payload = await api("/api/admin/videos");
  state.videos = payload.videos || [];
  renderVideoList();
  renderVideoCategoryChecks();
  if (!state.selectedVideoId) {
    applyNewVideoSortDefault();
  }
}

async function loadVideoCategories() {
  const payload = await api("/api/admin/video-categories");
  state.videoCategories = payload.categories || [];
  renderVideoCategoryList();
  renderVideoCategoryChecks();
  if (!state.selectedVideoCategoryId) {
    applyNewVideoCategorySortDefault();
  }
}

function renderVideoList() {
  $("#video-list-admin").innerHTML = state.videos.map((video) => `
    <button class="list-item ${video.video_id === state.selectedVideoId ? "active" : ""}" type="button" data-admin-video-id="${escapeHtml(video.video_id)}">
      <span class="list-title">${escapeHtml(video.title || video.original_url || "未命名视频")}</span>
      <span class="list-meta">
        ${statusBadge(videoStatusLabel(video.status), video.status || "neutral")}
        ${statusBadge(video.platform || "未知平台", "neutral")}
        ${statusBadge(`排序 ${formatNumber(video.sort_order)}`, "neutral")}
        ${video.pinned ? statusBadge(`置顶排序 ${formatNumber(pinnedSortOrderValue(video))}`, "visible") : ""}
      </span>
      <span class="list-subtle">${escapeHtml(video.author_name || "")} ${formatTime(video.published_at)} · 更新 ${formatTime(video.updated_at)}</span>
      ${video.metadata_error ? `<span class="list-subtle">${escapeHtml(video.metadata_error)}</span>` : ""}
    </button>
  `).join("") || emptyState("暂无视频，先粘贴一个 YouTube 或 Bilibili 链接。");
}

function renderVideoCategoryChecks() {
  const box = $("#video-category-checks");
  if (!box) {
    return;
  }
  const selected = new Set(selectedVideo()?.category_ids || []);
  box.innerHTML = state.videoCategories.map((category) => `
    <label class="mini-check ${category.enabled ? "" : "is-disabled"}">
      <input type="checkbox" value="${escapeHtml(category.category_id)}" ${selected.has(category.category_id) ? "checked" : ""} ${!category.enabled && !selected.has(category.category_id) ? "disabled" : ""}>
      ${escapeHtml(category.name_zh || category.slug)}
      ${category.enabled ? "" : statusBadge("停用", "hidden")}
    </label>
  `).join("") || `<span class="empty-inline">暂无分类</span>`;
}

function selectedVideo() {
  return state.videos.find((item) => item.video_id === state.selectedVideoId);
}

function nextSortOrder(items) {
  const max = items.reduce((result, item) => Math.max(result, Number(item.sort_order || 0)), 0);
  return max + 10;
}

function pinnedSortOrderValue(video) {
  return Number(video?.pinned_sort_order ?? video?.sort_order ?? 0);
}

function nextPinnedSortOrder(items) {
  const pinnedVideos = items.filter((item) => Number(item.pinned || 0) === 1);
  const max = pinnedVideos.reduce((result, item) => Math.max(result, pinnedSortOrderValue(item)), 0);
  return max + 10;
}

function applyNewVideoSortDefault() {
  const form = $("#video-form");
  const sortField = form?.elements?.sort_order;
  const pinnedSortField = form?.elements?.pinned_sort_order;
  if (sortField) {
    sortField.value = String(nextSortOrder(state.videos));
  }
  if (pinnedSortField) {
    pinnedSortField.value = String(nextPinnedSortOrder(state.videos));
  }
}

function applyNewVideoCategorySortDefault() {
  const field = $("#video-category-form")?.elements?.sort_order;
  if (field) {
    field.value = String(nextSortOrder(state.videoCategories));
  }
}

function resetVideoForm() {
  state.selectedVideoId = "";
  $("#video-editor-title").textContent = "新建视频";
  $("#video-form").reset();
  $("#video-form").elements.status.value = "draft";
  applyNewVideoSortDefault();
  $("#delete-video").disabled = true;
  $("#video-status").textContent = "";
  $("#admin-video-preview").replaceChildren();
  $("#video-cover-file").value = "";
  $("#video-frame-file").value = "";
  syncVideoMetadataButtons();
  syncVideoSaveButtons();
  renderVideoThumbnailPreview();
  renderVideoList();
  renderVideoCategoryChecks();
}

function fillVideoForm(video) {
  const form = $("#video-form");
  $("#video-editor-title").textContent = `编辑：${video.title || video.video_id}`;
  form.elements.original_url.value = video.original_url || "";
  form.elements.platform.value = video.platform || "";
  form.elements.external_id.value = video.external_id || "";
  form.elements.embed_url.value = video.embed_url || "";
  form.elements.thumbnail_url.value = video.thumbnail_url || "";
  form.elements.author_name.value = video.author_name || "";
  form.elements.published_at.value = toLocalDateTimeInputValue(video.published_at);
  form.elements.status.value = video.status || "draft";
  form.elements.sort_order.value = Number(video.sort_order || 0);
  form.elements.pinned.checked = Boolean(video.pinned);
  form.elements.pinned_sort_order.value = video.pinned ? pinnedSortOrderValue(video) : "";
  form.elements.title.value = video.title || "";
  form.elements.description.value = video.description || "";
  $("#delete-video").disabled = false;
  $("#video-status").textContent = video.metadata_error || "";
  syncVideoMetadataButtons();
  syncVideoSaveButtons();
  renderVideoList();
  renderVideoCategoryChecks();
  renderAdminVideoPreview(video.embed_url);
  $("#video-cover-file").value = "";
  $("#video-frame-file").value = "";
  renderVideoThumbnailPreview(video.thumbnail_url || "");
}

function renderAdminVideoPreview(embedUrl) {
  const preview = $("#admin-video-preview");
  preview.replaceChildren();
  if (!embedUrl) {
    return;
  }
  const iframe = document.createElement("iframe");
  iframe.src = embedUrl;
  iframe.loading = "lazy";
  iframe.allowFullscreen = true;
  iframe.title = "后台播放器预览";
  iframe.referrerPolicy = "strict-origin-when-cross-origin";
  iframe.allow = "accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
  preview.appendChild(iframe);
}

function renderVideoThumbnailPreview(value = "") {
  const preview = $("#video-thumbnail-preview");
  if (!preview) {
    return;
  }
  const thumbnail = String(value || $("#video-form")?.elements?.thumbnail_url?.value || "").trim();
  preview.replaceChildren();
  preview.classList.toggle("is-empty", !thumbnail);
  const label = document.createElement("span");
  label.textContent = thumbnailSourceLabel(thumbnail);
  preview.appendChild(label);
  if (!thumbnail) {
    return;
  }
  const image = document.createElement("img");
  image.alt = "视频封面预览";
  image.loading = "lazy";
  image.src = thumbnail;
  image.addEventListener("error", () => {
    image.remove();
    label.textContent = "封面无法预览，请检查链接或重新上传。";
    preview.classList.add("is-empty");
  }, { once: true });
  preview.appendChild(image);
}

function setVideoThumbnailValue(value, message = "") {
  const form = $("#video-form");
  form.elements.thumbnail_url.value = value || "";
  renderVideoThumbnailPreview(value || "");
  if (message) {
    $("#video-status").textContent = message;
  }
}

async function handleLocalCoverFileChange(event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }
  $("#video-status").textContent = "正在压缩本地封面...";
  try {
    const dataUrl = await imageFileToCoverDataUrl(file);
    setVideoThumbnailValue(dataUrl, "本地封面已填入，保存后会显示在视频卡片中。");
  } catch (error) {
    $("#video-status").textContent = error.message;
  } finally {
    event.target.value = "";
  }
}

async function handleVideoFrameFileChange(event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }
  $("#video-status").textContent = "正在截取本地视频首帧...";
  try {
    const dataUrl = await videoFileToCoverDataUrl(file);
    setVideoThumbnailValue(dataUrl, "已截取第一帧作为封面，保存后生效。");
  } catch (error) {
    $("#video-status").textContent = error.message;
  }
}

async function ensureVideoThumbnailBeforeSave() {
  const form = $("#video-form");
  if (form.elements.thumbnail_url.value.trim()) {
    return;
  }
  const file = $("#video-frame-file").files?.[0];
  if (!file) {
    return;
  }
  $("#video-status").textContent = "封面为空，正在从本地视频截取首帧...";
  const dataUrl = await videoFileToCoverDataUrl(file);
  setVideoThumbnailValue(dataUrl);
}

function clearVideoThumbnail() {
  setVideoThumbnailValue("", "封面已清空。");
  $("#video-cover-file").value = "";
  $("#video-frame-file").value = "";
}

function applyPreviewToVideoForm(video) {
  const form = $("#video-form");
  form.elements.platform.value = video.platform || "";
  form.elements.external_id.value = video.external_id || "";
  form.elements.embed_url.value = video.embed_url || "";
  form.elements.title.value = video.title || form.elements.title.value;
  form.elements.description.value = video.description || form.elements.description.value;
  form.elements.thumbnail_url.value = video.thumbnail_url || form.elements.thumbnail_url.value;
  form.elements.author_name.value = video.author_name || form.elements.author_name.value;
  form.elements.published_at.value = toLocalDateTimeInputValue(video.published_at) || form.elements.published_at.value;
  $("#video-status").textContent = video.metadata_error
    ? `已生成播放器地址；元数据受限，请手动补全：${video.metadata_error}`
    : "识别完成";
  renderAdminVideoPreview(video.embed_url);
  renderVideoThumbnailPreview(form.elements.thumbnail_url.value);
}

async function previewVideoUrl() {
  if (state.videoPreviewing || state.videoMetadataRefreshing) {
    return;
  }
  const form = $("#video-form");
  state.videoPreviewing = true;
  syncVideoMetadataButtons();
  $("#video-status").textContent = "正在识别...";
  try {
    const payload = await api("/api/admin/videos/preview-url", {
      method: "POST",
      body: JSON.stringify({ url: form.elements.original_url.value })
    });
    applyPreviewToVideoForm(payload.video || {});
  } catch (error) {
    $("#video-status").textContent = error.message;
  } finally {
    state.videoPreviewing = false;
    syncVideoMetadataButtons();
  }
}

function syncVideoMetadataButtons() {
  const previewButton = $("#preview-video-url");
  const refreshButton = $("#refresh-video-metadata");
  const busy = state.videoPreviewing || state.videoMetadataRefreshing;
  if (previewButton) {
    previewButton.disabled = busy;
    previewButton.textContent = state.videoPreviewing ? "识别中..." : "自动识别/获取信息";
    previewButton.setAttribute("aria-busy", state.videoPreviewing ? "true" : "false");
    previewButton.title = state.videoPreviewing ? "正在识别视频链接" : "自动识别视频链接并获取元数据";
  }
  if (refreshButton) {
    const hasVideo = Boolean(state.selectedVideoId);
    refreshButton.disabled = busy || !hasVideo;
    refreshButton.textContent = state.videoMetadataRefreshing ? "刷新中..." : "刷新元数据";
    refreshButton.setAttribute("aria-busy", state.videoMetadataRefreshing ? "true" : "false");
    if (!hasVideo) {
      refreshButton.title = "请先选择已保存视频";
    } else if (state.videoMetadataRefreshing) {
      refreshButton.title = "正在刷新外部元数据";
    } else {
      refreshButton.title = "刷新当前视频的外部元数据";
    }
  }
}

function videoPayload(statusOverride = "") {
  const form = $("#video-form");
  return {
    original_url: form.elements.original_url.value.trim(),
    title: form.elements.title.value.trim(),
    description: form.elements.description.value.trim(),
    thumbnail_url: form.elements.thumbnail_url.value.trim(),
    author_name: form.elements.author_name.value.trim(),
    published_at: normalizePublishedAtForApi(form.elements.published_at.value),
    status: statusOverride || form.elements.status.value,
    sort_order: Number(form.elements.sort_order.value || 0),
    pinned: form.elements.pinned.checked,
    pinned_sort_order: form.elements.pinned.checked ? Number(form.elements.pinned_sort_order.value || 0) : 0,
    category_ids: Array.from($("#video-category-checks").querySelectorAll("input:checked")).map((input) => input.value)
  };
}

function handleVideoPinnedChange() {
  const form = $("#video-form");
  if (!form?.elements?.pinned?.checked) {
    return;
  }
  const field = form.elements.pinned_sort_order;
  if (field && Number(field.value || 0) === 0) {
    field.value = String(nextPinnedSortOrder(state.videos));
  }
}

async function saveVideo(statusOverride = "") {
  if (state.videoSaving) {
    return;
  }
  state.videoSaving = true;
  state.videoSavingMode = statusOverride === "published" ? "publish" : "save";
  syncVideoSaveButtons();
  const status = $("#video-status");
  try {
    status.textContent = "正在保存...";
    await ensureVideoThumbnailBeforeSave();
    const path = state.selectedVideoId
      ? `/api/admin/videos/${encodeURIComponent(state.selectedVideoId)}`
      : "/api/admin/videos";
    const method = state.selectedVideoId ? "PUT" : "POST";
    const result = await api(path, { method, body: JSON.stringify(videoPayload(statusOverride)) });
    state.selectedVideoId = result.videoId || state.selectedVideoId;
    status.textContent = "已保存";
    await loadVideos();
    const video = selectedVideo();
    if (video) {
      fillVideoForm(video);
      status.textContent = video.metadata_error ? `已保存；${video.metadata_error}` : "已保存";
    }
  } catch (error) {
    status.textContent = error.message;
  } finally {
    state.videoSaving = false;
    state.videoSavingMode = "";
    syncVideoSaveButtons();
  }
}

function syncVideoSaveButtons() {
  const saveButton = $("#video-form button[type='submit']");
  const publishButton = $("#publish-video");
  const deleteButton = $("#delete-video");
  const busy = state.videoSaving || state.videoDeleting;
  if (saveButton) {
    const savingDraft = state.videoSaving && state.videoSavingMode !== "publish";
    saveButton.disabled = busy;
    saveButton.textContent = savingDraft ? "保存中..." : "保存";
    saveButton.setAttribute("aria-busy", savingDraft ? "true" : "false");
    saveButton.title = state.videoDeleting
      ? "正在删除视频"
      : (state.videoSaving ? "正在保存视频" : "保存当前视频");
  }
  if (publishButton) {
    const publishing = state.videoSaving && state.videoSavingMode === "publish";
    publishButton.disabled = busy;
    publishButton.textContent = publishing ? "发布中..." : "保存并发布";
    publishButton.setAttribute("aria-busy", publishing ? "true" : "false");
    publishButton.title = state.videoDeleting
      ? "正在删除视频"
      : (state.videoSaving ? "正在保存视频" : "保存并发布当前视频");
  }
  if (deleteButton) {
    deleteButton.disabled = busy || !state.selectedVideoId;
    deleteButton.textContent = state.videoDeleting ? "删除中..." : "删除";
    deleteButton.setAttribute("aria-busy", state.videoDeleting ? "true" : "false");
    deleteButton.title = busy
      ? (state.videoDeleting ? "正在删除视频" : "正在保存视频")
      : (state.selectedVideoId ? "删除当前视频" : "请先选择已保存视频");
  }
}

function selectVideo(videoId) {
  state.selectedVideoId = videoId;
  const video = selectedVideo();
  if (video) {
    fillVideoForm(video);
  }
}

async function deleteVideo() {
  if (state.videoSaving || state.videoDeleting || !state.selectedVideoId || !window.confirm("确定删除这个视频吗？")) {
    return;
  }
  state.videoDeleting = true;
  syncVideoSaveButtons();
  const status = $("#video-status");
  try {
    status.textContent = "正在删除...";
    await api(`/api/admin/videos/${encodeURIComponent(state.selectedVideoId)}`, { method: "DELETE" });
    resetVideoForm();
    await loadVideos();
    status.textContent = "已删除。";
  } catch (error) {
    status.textContent = error.message;
  } finally {
    state.videoDeleting = false;
    syncVideoSaveButtons();
  }
}

async function refreshVideoMetadata() {
  if (state.videoPreviewing || state.videoMetadataRefreshing) {
    return;
  }
  if (!state.selectedVideoId) {
    return previewVideoUrl();
  }
  state.videoMetadataRefreshing = true;
  syncVideoMetadataButtons();
  $("#video-status").textContent = "正在刷新元数据...";
  try {
    const payload = await api(`/api/admin/videos/${encodeURIComponent(state.selectedVideoId)}/refresh-metadata`, { method: "POST" });
    applyPreviewToVideoForm(payload.video || {});
    await loadVideos();
  } catch (error) {
    $("#video-status").textContent = error.message;
  } finally {
    state.videoMetadataRefreshing = false;
    syncVideoMetadataButtons();
  }
}

function renderVideoCategoryList() {
  $("#video-category-list-admin").innerHTML = state.videoCategories.map((category) => `
    <button class="list-item ${category.category_id === state.selectedVideoCategoryId ? "active" : ""}" type="button" data-admin-video-category-id="${escapeHtml(category.category_id)}">
      <span class="list-title">${escapeHtml(category.name_zh || category.slug)}</span>
      <span class="list-meta">
        ${statusBadge(category.enabled ? "启用" : "停用", category.enabled ? "visible" : "hidden")}
        ${statusBadge(`${category.video_count || 0} 个视频`, "neutral")}
      </span>
      <span class="list-subtle">${escapeHtml(category.slug)} · 排序 ${formatNumber(category.sort_order)}</span>
    </button>
  `).join("") || emptyState("暂无视频分类。");
}

function selectedVideoCategory() {
  return state.videoCategories.find((item) => item.category_id === state.selectedVideoCategoryId);
}

function resetVideoCategoryForm() {
  state.selectedVideoCategoryId = "";
  $("#video-category-editor-title").textContent = "新建分类";
  $("#video-category-form").reset();
  $("#video-category-form").elements.enabled.checked = true;
  applyNewVideoCategorySortDefault();
  $("#delete-video-category").disabled = true;
  $("#video-category-status").textContent = "";
  syncVideoCategoryButtons();
  renderVideoCategoryList();
}

function fillVideoCategoryForm(category) {
  const form = $("#video-category-form");
  $("#video-category-editor-title").textContent = `编辑：${category.name_zh || category.slug}`;
  form.elements.slug.value = category.slug || "";
  form.elements.name_zh.value = category.name_zh || "";
  form.elements.name_en.value = category.name_en || "";
  form.elements.name_ja.value = category.name_ja || "";
  form.elements.sort_order.value = Number(category.sort_order || 0);
  form.elements.enabled.checked = Boolean(category.enabled);
  $("#delete-video-category").disabled = false;
  $("#video-category-status").textContent = category.video_count ? `已有 ${category.video_count} 个视频使用，删除前请先取消关联。` : "";
  syncVideoCategoryButtons();
  renderVideoCategoryList();
}

function videoCategoryPayload() {
  const form = $("#video-category-form");
  return {
    slug: form.elements.slug.value.trim(),
    name_zh: form.elements.name_zh.value.trim(),
    name_en: form.elements.name_en.value.trim(),
    name_ja: form.elements.name_ja.value.trim(),
    sort_order: Number(form.elements.sort_order.value || 0),
    enabled: form.elements.enabled.checked
  };
}

async function saveVideoCategory(event) {
  event.preventDefault();
  if (state.videoCategoryBusy) {
    return;
  }
  state.videoCategoryBusy = true;
  state.videoCategoryBusyMode = "save";
  syncVideoCategoryButtons();
  const status = $("#video-category-status");
  try {
    status.textContent = "正在保存...";
    const path = state.selectedVideoCategoryId
      ? `/api/admin/video-categories/${encodeURIComponent(state.selectedVideoCategoryId)}`
      : "/api/admin/video-categories";
    const method = state.selectedVideoCategoryId ? "PUT" : "POST";
    const result = await api(path, { method, body: JSON.stringify(videoCategoryPayload()) });
    state.selectedVideoCategoryId = result.categoryId || state.selectedVideoCategoryId;
    status.textContent = "已保存";
    await loadVideoCategories();
    const category = selectedVideoCategory();
    if (category) {
      fillVideoCategoryForm(category);
      status.textContent = "已保存";
    }
  } catch (error) {
    status.textContent = error.message;
  } finally {
    state.videoCategoryBusy = false;
    state.videoCategoryBusyMode = "";
    syncVideoCategoryButtons();
  }
}

function syncVideoCategoryButtons() {
  const saveButton = $("#save-video-category");
  const deleteButton = $("#delete-video-category");
  if (saveButton) {
    const saving = state.videoCategoryBusy && state.videoCategoryBusyMode === "save";
    saveButton.disabled = state.videoCategoryBusy;
    saveButton.textContent = saving ? "保存中..." : "保存分类";
    saveButton.setAttribute("aria-busy", saving ? "true" : "false");
    saveButton.title = state.videoCategoryBusy ? "正在处理视频分类" : "保存当前视频分类";
  }
  if (deleteButton) {
    const deleting = state.videoCategoryBusy && state.videoCategoryBusyMode === "delete";
    deleteButton.disabled = state.videoCategoryBusy || !state.selectedVideoCategoryId;
    deleteButton.textContent = deleting ? "删除中..." : "删除分类";
    deleteButton.setAttribute("aria-busy", deleting ? "true" : "false");
    deleteButton.title = state.videoCategoryBusy
      ? "正在处理视频分类"
      : (state.selectedVideoCategoryId ? "删除当前视频分类" : "请先选择已保存分类");
  }
}

function selectVideoCategory(categoryId) {
  state.selectedVideoCategoryId = categoryId;
  const category = selectedVideoCategory();
  if (category) {
    fillVideoCategoryForm(category);
  }
}

async function deleteVideoCategory() {
  if (state.videoCategoryBusy) {
    return;
  }
  const category = selectedVideoCategory();
  if (!category) {
    return;
  }
  if (Number(category.video_count || 0) > 0) {
    $("#video-category-status").textContent = `已有 ${category.video_count} 个视频使用，不能直接删除。`;
    return;
  }
  if (!window.confirm("确定删除这个视频分类吗？")) {
    return;
  }
  state.videoCategoryBusy = true;
  state.videoCategoryBusyMode = "delete";
  syncVideoCategoryButtons();
  try {
    $("#video-category-status").textContent = "正在删除...";
    await api(`/api/admin/video-categories/${encodeURIComponent(category.category_id)}`, { method: "DELETE" });
    resetVideoCategoryForm();
    await loadVideoCategories();
    $("#video-category-status").textContent = "已删除。";
  } catch (error) {
    $("#video-category-status").textContent = error.message;
  } finally {
    state.videoCategoryBusy = false;
    state.videoCategoryBusyMode = "";
    syncVideoCategoryButtons();
  }
}

async function loadChatMessages() {
  const includeHidden = $("#include-hidden-chat")?.checked ? "1" : "0";
  const payload = await api(`/api/admin/chat/messages?limit=100&includeHidden=${includeHidden}`);
  state.chatMessages = payload.messages || [];
  if (state.selectedMessageId && !state.chatMessages.some((message) => message.message_id === state.selectedMessageId)) {
    state.selectedMessageId = "";
    resetChatForm();
  }
  renderChatMessages();
}

function renderChatMessages() {
  const list = $("#chat-list");
  if (!state.chatMessages.length) {
    list.replaceChildren(createEmptyStateElement("暂无聊天记录"));
    syncChatActionState();
    return;
  }

  list.replaceChildren(...state.chatMessages.map((message) => {
    const item = document.createElement("button");
    const title = document.createElement("span");
    const meta = document.createElement("span");
    const content = document.createElement("span");
    const createdAt = document.createElement("span");
    item.className = "list-item";
    if (message.message_id === state.selectedMessageId) {
      item.classList.add("active");
    }
    item.type = "button";
    item.dataset.messageId = message.message_id || "";
    title.className = "list-title";
    title.textContent = message.nickname || "";
    meta.className = "list-meta";
    meta.append(
      Number(message.hidden) ? createStatusBadgeElement("已隐藏", "hidden") : createStatusBadgeElement("可见", "visible"),
      createStatusBadgeElement([message.country, message.region, message.city].filter(Boolean).join(" / ") || "未知来源", "neutral")
    );
    content.className = "list-subtle";
    content.textContent = message.content || "";
    createdAt.className = "list-subtle";
    createdAt.textContent = formatTime(message.created_at);
    item.append(title, meta, content, createdAt);
    return item;
  }));
  syncChatActionState();
}

function selectChatMessage(messageId) {
  const message = state.chatMessages.find((item) => item.message_id === messageId);
  if (!message) {
    return;
  }
  state.selectedMessageId = messageId;
  renderChatMessages();
  const form = $("#chat-form-admin");
  form.elements.nickname.value = message.nickname || "";
  form.elements.content.value = message.content || "";
  $("#chat-selected-id").textContent = message.message_id;
  $("#chat-meta").replaceChildren(...[
    ["隐藏用户 ID", message.visitor_id || ""],
    ["前端 client id", message.client_id || ""],
    ["IP hash", message.ip_hash || ""],
    ["IP 前缀", message.ip_prefix || ""],
    ["来源", [message.country, message.region, message.city].filter(Boolean).join(" / ") || "未知"]
  ].map(([label, value]) => {
    const item = document.createElement("span");
    item.textContent = `${label}：${value}`;
    return item;
  }));
  syncChatActionState();
}

function selectedChatMessage() {
  return state.chatMessages.find((item) => item.message_id === state.selectedMessageId);
}

function resetChatForm() {
  $("#chat-form-admin").reset();
  $("#chat-selected-id").textContent = "未选择";
  $("#chat-meta").textContent = "";
  syncChatActionState();
}

function syncChatActionState() {
  const message = selectedChatMessage();
  const hasMessage = Boolean(message);
  const busy = state.chatActionBusy;
  const saveButton = $("#chat-form-admin button[type='submit']");
  const toggleButton = $("#toggle-chat-hidden");
  const deleteButton = $("#delete-chat-message");
  const visitorBanButton = $("#ban-chat-visitor");
  const ipBanButton = $("#ban-chat-ip");
  const actionButtons = [
    saveButton,
    toggleButton,
    deleteButton,
    visitorBanButton,
    ipBanButton
  ].filter(Boolean);
  actionButtons.forEach((button) => {
    button.disabled = busy || !hasMessage;
    button.setAttribute("aria-busy", busy ? "true" : "false");
    if (!hasMessage) {
      button.title = "请先选择聊天记录";
      button.setAttribute("aria-disabled", "true");
    } else if (busy) {
      button.title = "正在处理聊天记录";
      button.removeAttribute("aria-disabled");
    } else {
      button.removeAttribute("title");
      button.removeAttribute("aria-disabled");
    }
  });
  if (saveButton) {
    saveButton.textContent = state.chatActionBusyMode === "save" ? "保存中..." : "保存修改";
  }
  if (toggleButton) {
    const hidden = hasMessage && Number(message.hidden) === 1;
    const label = hidden ? "恢复消息" : "隐藏消息";
    const busyLabel = hidden ? "恢复中..." : "隐藏中...";
    toggleButton.textContent = state.chatActionBusyMode === "toggle" ? busyLabel : label;
    if (hasMessage && !busy) {
      toggleButton.title = label;
    }
  }
  if (deleteButton) {
    deleteButton.textContent = state.chatActionBusyMode === "delete" ? "删除中..." : "删除";
    if (hasMessage && !busy) {
      deleteButton.title = "删除当前聊天记录";
    }
  }
  if (visitorBanButton) {
    visitorBanButton.textContent = state.chatActionBusyMode === "banVisitor" ? "禁言中..." : "禁言用户ID";
    if (hasMessage && !busy) {
      visitorBanButton.title = "按隐藏用户 ID 禁言";
    }
  }
  if (ipBanButton) {
    ipBanButton.textContent = state.chatActionBusyMode === "banIp" ? "禁言中..." : "禁言IP来源";
    if (hasMessage && !busy) {
      ipBanButton.title = "按 IP hash 禁言";
    }
  }
}

function setChatActionBusy(mode) {
  state.chatActionBusy = Boolean(mode);
  state.chatActionBusyMode = mode || "";
  syncChatActionState();
}

function showChatActionError(error) {
  $("#chat-selected-id").textContent = `操作失败：${error.message}`;
}

async function saveChatMessage(event) {
  event.preventDefault();
  if (state.chatActionBusy) {
    return;
  }
  const message = selectedChatMessage();
  if (!message) {
    return;
  }
  setChatActionBusy("save");
  const form = $("#chat-form-admin");
  try {
    await api(`/api/admin/chat/messages/${encodeURIComponent(message.message_id)}`, {
      method: "PUT",
      body: JSON.stringify({
        nickname: form.elements.nickname.value,
        content: form.elements.content.value,
        hidden: Number(message.hidden) === 1
      })
    });
    await loadChatMessages();
    selectChatMessage(message.message_id);
  } catch (error) {
    showChatActionError(error);
  } finally {
    setChatActionBusy("");
  }
}

async function toggleChatHidden() {
  if (state.chatActionBusy) {
    return;
  }
  const message = selectedChatMessage();
  if (!message) {
    return;
  }
  setChatActionBusy("toggle");
  try {
    await api(`/api/admin/chat/messages/${encodeURIComponent(message.message_id)}`, {
      method: "PUT",
      body: JSON.stringify({ hidden: Number(message.hidden) !== 1 })
    });
    await loadChatMessages();
    selectChatMessage(message.message_id);
  } catch (error) {
    showChatActionError(error);
  } finally {
    setChatActionBusy("");
  }
}

async function deleteChatMessage() {
  if (state.chatActionBusy) {
    return;
  }
  const message = selectedChatMessage();
  if (!message || !window.confirm("确定删除这条聊天记录？")) {
    return;
  }
  setChatActionBusy("delete");
  try {
    await api(`/api/admin/chat/messages/${encodeURIComponent(message.message_id)}`, { method: "DELETE" });
    state.selectedMessageId = "";
    resetChatForm();
    await loadChatMessages();
  } catch (error) {
    showChatActionError(error);
  } finally {
    setChatActionBusy("");
  }
}

async function banSelectedChat(type) {
  if (state.chatActionBusy) {
    return;
  }
  const message = selectedChatMessage();
  if (!message) {
    return;
  }
  setChatActionBusy(type === "ip_hash" || type === "ip" ? "banIp" : "banVisitor");
  const form = $("#chat-form-admin");
  const body = {
    type,
    reason: form.elements.ban_reason.value || "后台禁言",
    durationHours: Number(form.elements.ban_hours.value || 0),
    visitorId: message.visitor_id,
    ipHash: message.ip_hash,
    ipPrefix: message.ip_prefix
  };
  try {
    await api("/api/admin/chat/bans", { method: "POST", body: JSON.stringify(body) });
    await loadBans();
  } catch (error) {
    showChatActionError(error);
  } finally {
    setChatActionBusy("");
  }
}

async function loadBans() {
  const payload = await api("/api/admin/chat/bans");
  state.bans = payload.bans || [];
  renderBans();
}

function renderBans() {
  const list = $("#ban-list");
  if (!state.bans.length) {
    list.replaceChildren(createEmptyStateElement("暂无禁言记录"));
    syncBanListButtons();
    return;
  }

  list.replaceChildren(...state.bans.map((ban) => {
    const item = document.createElement("article");
    const meta = document.createElement("div");
    const target = document.createElement("small");
    const duration = document.createElement("small");
    item.className = "ban-item";
    meta.className = "list-meta";
    meta.append(
      createStatusBadgeElement(ban.active ? "生效中" : "已停用", ban.active ? "active" : "off"),
      createStatusBadgeElement(ban.ban_type || "", "neutral")
    );
    target.textContent = `${ban.visitor_id || ban.ip_prefix || ban.ip_hash || ""} · ${ban.reason || ""}`;
    duration.textContent = `${formatTime(ban.created_at)}${ban.expires_at ? ` 到 ${formatTime(ban.expires_at)}` : " · 长期"}`;
    item.append(meta, target, duration);
    if (ban.active) {
      const button = document.createElement("button");
      button.className = "xp-button";
      button.type = "button";
      button.dataset.disableBan = ban.ban_id || "";
      button.textContent = "停用";
      item.append(button);
    }
    return item;
  }));
  syncBanListButtons();
}

function setBanListBusy(mode = "", banId = "") {
  state.banListBusy = Boolean(mode);
  state.banListBusyMode = mode;
  state.banBusyId = banId;
  syncBanListButtons();
}

function syncBanListButtons() {
  const refreshButton = $("#refresh-bans");
  if (refreshButton) {
    const refreshing = state.banListBusyMode === "refresh";
    refreshButton.disabled = state.banListBusy;
    refreshButton.textContent = refreshing ? "刷新中..." : "刷新";
    refreshButton.setAttribute("aria-busy", refreshing ? "true" : "false");
    refreshButton.title = state.banListBusy ? "正在读取禁言列表" : "刷新禁言列表";
  }
  $$("[data-disable-ban]").forEach((button) => {
    const disabling = state.banListBusyMode === "disable" && button.dataset.disableBan === state.banBusyId;
    button.disabled = state.banListBusy;
    button.textContent = disabling ? "停用中..." : "停用";
    button.setAttribute("aria-busy", disabling ? "true" : "false");
    button.title = state.banListBusy ? "正在处理禁言记录" : "停用这条禁言";
  });
}

async function refreshBans() {
  if (state.banListBusy) {
    return;
  }
  setBanListBusy("refresh");
  try {
    await loadBans();
  } catch (error) {
    $("#ban-list").textContent = `读取禁言列表失败：${error.message}`;
  } finally {
    setBanListBusy("");
  }
}

async function disableBan(banId) {
  if (state.banListBusy) {
    return;
  }
  setBanListBusy("disable", banId);
  try {
    await api(`/api/admin/chat/bans/${encodeURIComponent(banId)}`, { method: "DELETE" });
    await loadBans();
  } catch (error) {
    $("#ban-list").textContent = `停用禁言失败：${error.message}`;
  } finally {
    setBanListBusy("");
  }
}

async function loadAccounts() {
  const payload = await api("/api/admin/accounts");
  state.accounts = payload.accounts || [];
  renderAccountSummary();
  renderAccountList();
  if (!state.selectedAccountId && state.accounts[0]) {
    await selectAccount(state.accounts[0].id);
  } else if (state.selectedAccountId && !state.accounts.some((account) => account.id === state.selectedAccountId)) {
    state.selectedAccountId = "";
    state.accountDetail = null;
    renderAccountDetail();
    syncAccountSaveButton();
  }
}

function renderAccountSummary() {
  const total = state.accounts.length;
  const admins = state.accounts.filter((account) => account.role === "admin").length;
  const active = state.accounts.filter((account) => Number(account.active_sessions || 0) > 0).length;
  $("#account-summary").innerHTML = `
    <span>共 ${formatNumber(total)} 个注册账号</span>
    <span>${formatNumber(admins)} 个管理员</span>
    <span>${formatNumber(active)} 个账号有活跃会话</span>
  `;
}

function renderAccountList() {
  $("#account-list").innerHTML = state.accounts.map((account) => `
    <button class="list-item ${account.id === state.selectedAccountId ? "active" : ""}" type="button" data-account-id="${escapeHtml(account.id)}">
      <span class="list-title">${escapeHtml(account.email)}</span>
      <span class="list-meta">
        ${statusBadge(account.role === "admin" ? "管理员" : "普通用户", account.role === "admin" ? "active" : "neutral")}
        ${statusBadge(account.password_status || "已加密保存", "visible")}
        ${statusBadge(`${formatNumber(account.active_sessions)} 个活跃会话`, Number(account.active_sessions || 0) ? "active" : "off")}
      </span>
      <span class="list-subtle">最近登录：${formatTime(account.last_login_at) || "暂无记录"} · 登录 ${formatNumber(account.login_count)} 次 · 云存档 ${formatNumber(account.save_slots)} 个</span>
    </button>
  `).join("") || emptyState("还没有注册账号。");
}

async function selectAccount(accountId) {
  state.selectedAccountId = accountId;
  $("#account-status").textContent = "正在读取账号详情...";
  renderAccountList();
  syncAccountSaveButton();
  const detail = await api(`/api/admin/accounts/${encodeURIComponent(accountId)}`);
  state.accountDetail = detail;
  state.accounts = upsertById(state.accounts, detail.account, "id");
  fillAccountForm(detail.account);
  renderAccountSummary();
  renderAccountList();
  renderAccountDetail();
  $("#account-status").textContent = "";
  syncAccountSaveButton();
}

function fillAccountForm(account) {
  const form = $("#account-form");
  $("#account-editor-title").textContent = `编辑：${account.email}`;
  form.elements.email.value = account.email || "";
  form.elements.role.value = account.role || "user";
  form.elements.password.value = "";
  form.elements.password_status.value = account.password_status || "已加密保存，不能查看原文";
}

async function saveAccount(event) {
  event.preventDefault();
  if (state.accountSaving) {
    return;
  }
  if (!state.selectedAccountId) {
    $("#account-status").textContent = "请先选择一个账号。";
    syncAccountSaveButton();
    return;
  }
  const form = $("#account-form");
  const password = form.elements.password.value.trim();
  const payload = {
    email: form.elements.email.value.trim(),
    role: form.elements.role.value
  };
  if (password) {
    payload.password = password;
  }
  state.accountSaving = true;
  syncAccountSaveButton();
  $("#account-status").textContent = password ? "正在保存账号并重置密码..." : "正在保存账号...";
  try {
    const detail = await api(`/api/admin/accounts/${encodeURIComponent(state.selectedAccountId)}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
    state.accountDetail = detail;
    state.accounts = upsertById(state.accounts, detail.account, "id");
    fillAccountForm(detail.account);
    renderAccountSummary();
    renderAccountList();
    renderAccountDetail();
    $("#account-status").textContent = password ? "已保存，新密码已生效，相关旧会话已清理。" : "已保存账号信息。";
  } catch (error) {
    $("#account-status").textContent = error.message;
  } finally {
    state.accountSaving = false;
    syncAccountSaveButton();
  }
}

function syncAccountSaveButton() {
  const button = $("#account-form button[type='submit']");
  if (!button) {
    return;
  }
  const hasAccount = Boolean(state.selectedAccountId);
  button.disabled = state.accountSaving || !hasAccount;
  button.textContent = state.accountSaving ? "保存中..." : "保存账号";
  button.setAttribute("aria-busy", state.accountSaving ? "true" : "false");
  if (!hasAccount) {
    button.title = "请先选择账号";
  } else if (state.accountSaving) {
    button.title = "正在保存账号";
  } else {
    button.removeAttribute("title");
  }
}

function renderAccountDetail() {
  const detail = state.accountDetail;
  if (!detail) {
    $("#login-history").innerHTML = emptyState("选择账号后查看登录履历。");
    $("#account-activity").innerHTML = emptyState("选择账号后查看近期活跃。");
    $("#account-sessions").innerHTML = emptyState("选择账号后查看会话状态。");
    return;
  }

  $("#login-history").innerHTML = (detail.loginHistory || []).map((event) => `
    <article class="event-item">
      <strong>${escapeHtml(loginEventLabel(event.event_type))}</strong>
      <small>${formatTime(event.created_at)} · ${escapeHtml(locationText(event))}</small>
      <small>IP 来源：${escapeHtml(event.ip_prefix || "未记录")} · 设备：${escapeHtml(shortUserAgent(event.user_agent))}</small>
    </article>
  `).join("") || emptyState("这个账号还没有登录履历。");

  $("#account-activity").innerHTML = (detail.activity || []).map((item) => `
    <article class="event-item">
      <strong>${escapeHtml(activityLabel(item))}</strong>
      <small>${formatTime(item.created_at)} · ${escapeHtml(item.path || "")}</small>
      <small>${escapeHtml([item.detail, item.route, locationText(item)].filter(Boolean).join(" · "))}</small>
    </article>
  `).join("") || emptyState("这个账号近期没有站内活跃记录。");

  $("#account-sessions").innerHTML = (detail.sessions || []).map((session) => `
    <article class="event-item">
      <strong>${escapeHtml(session.active ? "当前有效" : "已过期")}</strong>
      <small>登录时间：${formatTime(session.created_at)}</small>
      <small>到期时间：${formatTime(session.expires_at)}</small>
    </article>
  `).join("") || emptyState("这个账号没有会话记录。");
}

function loginEventLabel(type) {
  return type === "register" ? "注册后自动登录" : "登录成功";
}

function activityLabel(item) {
  const labels = {
    page_view: "浏览页面",
    click: "点击操作",
    article_view: "阅读文章"
  };
  return labels[item.type] || "站内活跃";
}

function locationText(row) {
  return [row.country, row.region, row.city].filter(Boolean).join(" / ") || "未知位置";
}

function shortUserAgent(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "未记录";
  }
  if (/Edg\//.test(text)) {
    return "Edge 浏览器";
  }
  if (/Chrome\//.test(text)) {
    return "Chrome 浏览器";
  }
  if (/Firefox\//.test(text)) {
    return "Firefox 浏览器";
  }
  if (/Safari\//.test(text)) {
    return "Safari 浏览器";
  }
  return Array.from(text).slice(0, 80).join("");
}

function upsertById(items, nextItem, key) {
  if (!nextItem?.[key]) {
    return items;
  }
  const index = items.findIndex((item) => item[key] === nextItem[key]);
  if (index === -1) {
    return [nextItem, ...items];
  }
  const copy = [...items];
  copy[index] = nextItem;
  return copy;
}

function renderAdminUpdates() {
  const box = $("#admin-updates");
  box.replaceChildren(...adminUpdates.map((item) => {
    const article = document.createElement("article");
    const title = document.createElement("strong");
    const body = document.createElement("small");
    article.className = "event-item";
    title.textContent = `${item.date} · ${item.title}`;
    body.textContent = item.body;
    article.append(title, body);
    return article;
  }));
}

function bindEvents() {
  $$(".nav-button").forEach((button) => {
    button.addEventListener("click", () => switchPanel(button.dataset.panel));
  });
  $("#manual-refresh").addEventListener("click", () => {
    loadPanelData(state.activePanel, { force: true });
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      autoRefreshActivePanel();
    }
  });
  $("#logout-button").addEventListener("click", async () => {
    const button = $("#logout-button");
    if (state.loggingOut) {
      return;
    }
    const resumeAutoRefresh = Boolean(state.timer);
    state.loggingOut = true;
    if (state.timer) {
      window.clearInterval(state.timer);
      state.timer = null;
    }
    button.disabled = true;
    button.textContent = "退出中...";
    button.setAttribute("aria-busy", "true");
    button.setAttribute("aria-label", "正在退出后台");
    button.title = "正在退出后台";
    setStatus("正在退出后台...", { force: true });
    updateRefreshButton();
    try {
      await api("/api/auth/logout", { method: "POST", body: "{}" });
      window.location.reload();
    } catch (error) {
      state.loggingOut = false;
      button.disabled = false;
      button.textContent = "退出";
      button.setAttribute("aria-busy", "false");
      button.setAttribute("aria-label", "退出后台");
      button.title = "退出后台";
      setStatus(error.message, { force: true, holdMs: 4000 });
      updateRefreshButton();
      if (resumeAutoRefresh && !state.timer) {
        state.timer = window.setInterval(autoRefreshActivePanel, 30000);
      }
    }
  });
  $("#new-article").addEventListener("click", resetArticleForm);
  $("#article-list").addEventListener("click", (event) => {
    const item = event.target.closest("[data-article-id]");
    if (item) {
      selectArticle(item.dataset.articleId);
    }
  });
  $$(".lang-tab").forEach((button) => {
    button.addEventListener("click", () => setArticleLang(button.dataset.articleLang));
  });
  $("#article-form").addEventListener("submit", (event) => {
    event.preventDefault();
    saveArticle();
  });
  $("#publish-article").addEventListener("click", () => saveArticle("published"));
  $("#delete-article").addEventListener("click", deleteArticle);
  $("#new-video").addEventListener("click", resetVideoForm);
  $("#video-list-admin").addEventListener("click", (event) => {
    const item = event.target.closest("[data-admin-video-id]");
    if (item) {
      selectVideo(item.dataset.adminVideoId);
    }
  });
  $("#preview-video-url").addEventListener("click", previewVideoUrl);
  $("#refresh-video-metadata").addEventListener("click", refreshVideoMetadata);
  $("#video-cover-file").addEventListener("change", handleLocalCoverFileChange);
  $("#video-frame-file").addEventListener("change", handleVideoFrameFileChange);
  $("#clear-video-thumbnail").addEventListener("click", clearVideoThumbnail);
  $("#video-form").elements.pinned.addEventListener("change", handleVideoPinnedChange);
  $("#video-form").elements.thumbnail_url.addEventListener("input", (event) => {
    renderVideoThumbnailPreview(event.target.value);
  });
  $("#video-form").addEventListener("submit", (event) => {
    event.preventDefault();
    saveVideo();
  });
  $("#publish-video").addEventListener("click", () => saveVideo("published"));
  $("#delete-video").addEventListener("click", deleteVideo);
  $("#new-video-category").addEventListener("click", resetVideoCategoryForm);
  $("#video-category-list-admin").addEventListener("click", (event) => {
    const item = event.target.closest("[data-admin-video-category-id]");
    if (item) {
      selectVideoCategory(item.dataset.adminVideoCategoryId);
    }
  });
  $("#video-category-form").addEventListener("submit", saveVideoCategory);
  $("#delete-video-category").addEventListener("click", deleteVideoCategory);
  $("#include-hidden-chat").addEventListener("change", loadChatMessages);
  $("#chat-list").addEventListener("click", (event) => {
    const item = event.target.closest("[data-message-id]");
    if (item) {
      selectChatMessage(item.dataset.messageId);
    }
  });
  $("#chat-form-admin").addEventListener("submit", saveChatMessage);
  $("#toggle-chat-hidden").addEventListener("click", toggleChatHidden);
  $("#delete-chat-message").addEventListener("click", deleteChatMessage);
  $("#ban-chat-visitor").addEventListener("click", () => banSelectedChat("visitor"));
  $("#ban-chat-ip").addEventListener("click", () => banSelectedChat("ip_hash"));
  $("#refresh-bans").addEventListener("click", refreshBans);
  $("#ban-list").addEventListener("click", (event) => {
    const item = event.target.closest("[data-disable-ban]");
    if (item) {
      disableBan(item.dataset.disableBan);
    }
  });
  $("#account-list").addEventListener("click", (event) => {
    const item = event.target.closest("[data-account-id]");
    if (item) {
      selectAccount(item.dataset.accountId);
    }
  });
  $("#account-form").addEventListener("submit", saveAccount);
}

async function init() {
  bindEvents();
  renderAdminUpdates();
  resetArticleForm();
  resetVideoForm();
  resetVideoCategoryForm();
  resetChatForm();
  syncAccountSaveButton();
  try {
    applyActivePanel(getStoredActivePanel());
    await loadMe();
    await loadPanelData(state.activePanel, { force: true });
    state.timer = window.setInterval(autoRefreshActivePanel, 30000);
  } catch (error) {
    setStatus(error.message);
  }
}

init();
