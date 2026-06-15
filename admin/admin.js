const state = {
  user: null,
  activePanel: "dashboard",
  overview: null,
  articles: [],
  selectedArticleId: "",
  articleLang: "zh",
  videos: [],
  selectedVideoId: "",
  videoCategories: [],
  selectedVideoCategoryId: "",
  chatMessages: [],
  selectedMessageId: "",
  bans: [],
  timer: null
};

const panelMeta = {
  videos: ["视频管理", "输入 YouTube / Bilibili 链接，服务端识别并缓存标题、简介和封面。"],
  videoCategories: ["视频分类管理", "维护视频区顶部标签，支持新增、编辑、停用、排序和安全删除。"],
  dashboard: ["实时监控大屏", "访问、点击、文章和聊天室状态集中查看。"],
  articles: ["知识库文章", "一次编辑 zh / en / ja 三种版本，按当前选择语言显示编辑区。"],
  visits: ["访问来源", "按国家、省份、地区和 IP 前缀查看每日访问。"],
  clicks: ["点击埋点", "查看站内各位置点击、PV/UV 和最近事件。"],
  chat: ["聊天室管理", "编辑、隐藏、删除聊天记录，按隐藏用户 ID 或 IP 来源禁言。"],
  docs: ["后台说明", "后台自己的项目介绍和私有更新记录，不混入主站知识库。"]
};

const adminUpdates = [
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

function emptyRow(colspan, text) {
  return `<tr><td colspan="${colspan}"><span class="empty-inline">${escapeHtml(text)}</span></td></tr>`;
}

function statusBadge(text, tone = "neutral") {
  return `<span class="status-badge ${escapeHtml(tone)}">${escapeHtml(text)}</span>`;
}

function articleStatusLabel(status) {
  const labels = {
    draft: "草稿",
    published: "已发布",
    archived: "已归档"
  };
  return labels[status] || status || "未知";
}

function setStatus(text) {
  $("#refresh-state").textContent = text;
}

function switchPanel(panel) {
  state.activePanel = panel;
  $$(".nav-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.panel === panel);
  });
  $$(".panel").forEach((item) => {
    item.classList.toggle("active", item.id === `${panel}-panel`);
  });
  $("#panel-title").textContent = panelMeta[panel][0];
  $("#panel-subtitle").textContent = panelMeta[panel][1];

  if (panel === "dashboard" || panel === "visits" || panel === "clicks") {
    loadOverview();
  }
  if (panel === "articles") {
    loadArticles();
  }
  if (panel === "videos") {
    loadVideoCategories().then(loadVideos);
  }
  if (panel === "videoCategories") {
    loadVideoCategories();
  }
  if (panel === "chat") {
    loadChatMessages();
    loadBans();
  }
}

async function loadMe() {
  const payload = await api("/api/admin/me");
  state.user = payload.user;
  $("#admin-email").textContent = payload.user.email;
}

async function loadOverview() {
  try {
    setStatus("正在刷新数据...");
    const payload = await api("/api/admin/analytics/overview?days=14");
    state.overview = payload;
    renderOverview();
    setStatus(`已刷新 ${formatTime(payload.generatedAt)}`);
  } catch (error) {
    setStatus(error.message);
  }
}

function renderOverview() {
  if (!state.overview) {
    return;
  }
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
    ["今日 PV", cards.todayPv],
    ["今日 UV", cards.todayUv],
    ["周期 PV", cards.totalPv],
    ["周期 UV", cards.totalUv],
    ["今日点击", cards.todayClicks],
    ["在线访客", cards.onlineVisitors],
    ["今日聊天", cards.todayMessages]
  ];
  $("#kpi-grid").innerHTML = items.map(([label, value]) => `
    <article class="kpi-card">
      <span>${escapeHtml(label)}</span>
      <strong>${formatNumber(value)}</strong>
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
    }
  } catch (error) {
    status.textContent = error.message;
  }
}

async function deleteArticle() {
  if (!state.selectedArticleId || !window.confirm("确定删除这篇文章？")) {
    return;
  }
  await api(`/api/admin/articles/${encodeURIComponent(state.selectedArticleId)}`, { method: "DELETE" });
  resetArticleForm();
  await loadArticles();
}

function videoStatusLabel(status) {
  return ({ draft: "草稿", published: "已发布", hidden: "隐藏" })[status] || status || "未知";
}

async function loadVideos() {
  const payload = await api("/api/admin/videos");
  state.videos = payload.videos || [];
  renderVideoList();
  renderVideoCategoryChecks();
}

async function loadVideoCategories() {
  const payload = await api("/api/admin/video-categories");
  state.videoCategories = payload.categories || [];
  renderVideoCategoryList();
  renderVideoCategoryChecks();
}

function renderVideoList() {
  $("#video-list-admin").innerHTML = state.videos.map((video) => `
    <button class="list-item ${video.video_id === state.selectedVideoId ? "active" : ""}" type="button" data-admin-video-id="${escapeHtml(video.video_id)}">
      <span class="list-title">${escapeHtml(video.title || video.original_url || "未命名视频")}</span>
      <span class="list-meta">
        ${statusBadge(videoStatusLabel(video.status), video.status || "neutral")}
        ${statusBadge(video.platform || "未知平台", "neutral")}
        ${video.pinned ? statusBadge("置顶", "visible") : ""}
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
    <label class="mini-check">
      <input type="checkbox" value="${escapeHtml(category.category_id)}" ${selected.has(category.category_id) ? "checked" : ""}>
      ${escapeHtml(category.name_zh || category.slug)}
    </label>
  `).join("") || `<span class="empty-inline">暂无分类</span>`;
}

function selectedVideo() {
  return state.videos.find((item) => item.video_id === state.selectedVideoId);
}

function resetVideoForm() {
  state.selectedVideoId = "";
  $("#video-editor-title").textContent = "新建视频";
  $("#video-form").reset();
  $("#video-form").elements.status.value = "draft";
  $("#delete-video").disabled = true;
  $("#refresh-video-metadata").disabled = true;
  $("#video-status").textContent = "";
  $("#admin-video-preview").replaceChildren();
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
  form.elements.title.value = video.title || "";
  form.elements.description.value = video.description || "";
  $("#delete-video").disabled = false;
  $("#refresh-video-metadata").disabled = false;
  $("#video-status").textContent = video.metadata_error || "";
  renderVideoList();
  renderVideoCategoryChecks();
  renderAdminVideoPreview(video.embed_url);
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
  $("#video-status").textContent = video.metadata_error || "识别完成";
  renderAdminVideoPreview(video.embed_url);
}

async function previewVideoUrl() {
  const form = $("#video-form");
  $("#video-status").textContent = "正在识别...";
  try {
    const payload = await api("/api/admin/videos/preview-url", {
      method: "POST",
      body: JSON.stringify({ url: form.elements.original_url.value })
    });
    applyPreviewToVideoForm(payload.video || {});
  } catch (error) {
    $("#video-status").textContent = error.message;
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
    category_ids: Array.from($("#video-category-checks").querySelectorAll("input:checked")).map((input) => input.value)
  };
}

async function saveVideo(statusOverride = "") {
  const status = $("#video-status");
  try {
    status.textContent = "正在保存...";
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
    }
  } catch (error) {
    status.textContent = error.message;
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
  if (!state.selectedVideoId || !window.confirm("确定删除这个视频吗？")) {
    return;
  }
  await api(`/api/admin/videos/${encodeURIComponent(state.selectedVideoId)}`, { method: "DELETE" });
  resetVideoForm();
  await loadVideos();
}

async function refreshVideoMetadata() {
  if (!state.selectedVideoId) {
    return previewVideoUrl();
  }
  $("#video-status").textContent = "正在刷新元数据...";
  try {
    const payload = await api(`/api/admin/videos/${encodeURIComponent(state.selectedVideoId)}/refresh-metadata`, { method: "POST" });
    applyPreviewToVideoForm(payload.video || {});
    await loadVideos();
  } catch (error) {
    $("#video-status").textContent = error.message;
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
  $("#delete-video-category").disabled = true;
  $("#video-category-status").textContent = "";
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
    }
  } catch (error) {
    status.textContent = error.message;
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
  try {
    await api(`/api/admin/video-categories/${encodeURIComponent(category.category_id)}`, { method: "DELETE" });
    resetVideoCategoryForm();
    await loadVideoCategories();
  } catch (error) {
    $("#video-category-status").textContent = error.message;
  }
}

async function loadChatMessages() {
  const includeHidden = $("#include-hidden-chat")?.checked ? "1" : "0";
  const payload = await api(`/api/admin/chat/messages?limit=100&includeHidden=${includeHidden}`);
  state.chatMessages = payload.messages || [];
  renderChatMessages();
}

function renderChatMessages() {
  $("#chat-list").innerHTML = state.chatMessages.map((message) => `
    <button class="list-item ${message.message_id === state.selectedMessageId ? "active" : ""}" type="button" data-message-id="${escapeHtml(message.message_id)}">
      <span class="list-title">${escapeHtml(message.nickname)}</span>
      <span class="list-meta">
        ${Number(message.hidden) ? statusBadge("已隐藏", "hidden") : statusBadge("可见", "visible")}
        ${statusBadge([message.country, message.region, message.city].filter(Boolean).join(" / ") || "未知来源", "neutral")}
      </span>
      <span class="list-subtle">${escapeHtml(message.content)}</span>
      <span class="list-subtle">${formatTime(message.created_at)}</span>
    </button>
  `).join("") || emptyState("暂无聊天记录");
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
  $("#chat-meta").innerHTML = `
    <span>隐藏用户 ID：${escapeHtml(message.visitor_id || "")}</span>
    <span>前端 client id：${escapeHtml(message.client_id || "")}</span>
    <span>IP hash：${escapeHtml(message.ip_hash || "")}</span>
    <span>IP 前缀：${escapeHtml(message.ip_prefix || "")}</span>
    <span>来源：${escapeHtml([message.country, message.region, message.city].filter(Boolean).join(" / ") || "未知")}</span>
  `;
}

function selectedChatMessage() {
  return state.chatMessages.find((item) => item.message_id === state.selectedMessageId);
}

async function saveChatMessage(event) {
  event.preventDefault();
  const message = selectedChatMessage();
  if (!message) {
    return;
  }
  const form = $("#chat-form-admin");
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
}

async function toggleChatHidden() {
  const message = selectedChatMessage();
  if (!message) {
    return;
  }
  await api(`/api/admin/chat/messages/${encodeURIComponent(message.message_id)}`, {
    method: "PUT",
    body: JSON.stringify({ hidden: Number(message.hidden) !== 1 })
  });
  await loadChatMessages();
  selectChatMessage(message.message_id);
}

async function deleteChatMessage() {
  const message = selectedChatMessage();
  if (!message || !window.confirm("确定删除这条聊天记录？")) {
    return;
  }
  await api(`/api/admin/chat/messages/${encodeURIComponent(message.message_id)}`, { method: "DELETE" });
  state.selectedMessageId = "";
  $("#chat-form-admin").reset();
  $("#chat-meta").textContent = "";
  await loadChatMessages();
}

async function banSelectedChat(type) {
  const message = selectedChatMessage();
  if (!message) {
    return;
  }
  const form = $("#chat-form-admin");
  const body = {
    type,
    reason: form.elements.ban_reason.value || "后台禁言",
    durationHours: Number(form.elements.ban_hours.value || 0),
    visitorId: message.visitor_id,
    ipHash: message.ip_hash,
    ipPrefix: message.ip_prefix
  };
  await api("/api/admin/chat/bans", { method: "POST", body: JSON.stringify(body) });
  await loadBans();
}

async function loadBans() {
  const payload = await api("/api/admin/chat/bans");
  state.bans = payload.bans || [];
  renderBans();
}

function renderBans() {
  $("#ban-list").innerHTML = state.bans.map((ban) => `
    <article class="ban-item">
      <div class="list-meta">
        ${statusBadge(ban.active ? "生效中" : "已停用", ban.active ? "active" : "off")}
        ${statusBadge(ban.ban_type, "neutral")}
      </div>
      <small>${escapeHtml(ban.visitor_id || ban.ip_prefix || ban.ip_hash)} · ${escapeHtml(ban.reason || "")}</small>
      <small>${formatTime(ban.created_at)}${ban.expires_at ? ` 到 ${formatTime(ban.expires_at)}` : " · 长期"}</small>
      ${ban.active ? `<button class="xp-button" type="button" data-disable-ban="${escapeHtml(ban.ban_id)}">停用</button>` : ""}
    </article>
  `).join("") || emptyState("暂无禁言记录");
}

async function disableBan(banId) {
  await api(`/api/admin/chat/bans/${encodeURIComponent(banId)}`, { method: "DELETE" });
  await loadBans();
}

function renderDocs() {
  $("#admin-updates").innerHTML = adminUpdates.map((item) => `
    <article class="event-item">
      <strong>${escapeHtml(item.date)} · ${escapeHtml(item.title)}</strong>
      <small>${escapeHtml(item.body)}</small>
    </article>
  `).join("");
}

function bindEvents() {
  $$(".nav-button").forEach((button) => {
    button.addEventListener("click", () => switchPanel(button.dataset.panel));
  });
  $("#manual-refresh").addEventListener("click", () => {
    if (["dashboard", "visits", "clicks"].includes(state.activePanel)) {
      loadOverview();
    } else if (state.activePanel === "articles") {
      loadArticles();
    } else if (state.activePanel === "videos") {
      loadVideoCategories().then(loadVideos);
    } else if (state.activePanel === "videoCategories") {
      loadVideoCategories();
    } else if (state.activePanel === "chat") {
      loadChatMessages();
      loadBans();
    }
  });
  $("#logout-button").addEventListener("click", async () => {
    await api("/api/auth/logout", { method: "POST", body: "{}" });
    window.location.reload();
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
  $("#refresh-bans").addEventListener("click", loadBans);
  $("#ban-list").addEventListener("click", (event) => {
    const item = event.target.closest("[data-disable-ban]");
    if (item) {
      disableBan(item.dataset.disableBan);
    }
  });
}

async function init() {
  bindEvents();
  renderDocs();
  resetArticleForm();
  resetVideoForm();
  resetVideoCategoryForm();
  try {
    await loadMe();
    await Promise.all([loadOverview(), loadArticles(), loadVideoCategories(), loadVideos(), loadChatMessages(), loadBans()]);
    state.timer = window.setInterval(() => {
      if (["dashboard", "visits", "clicks"].includes(state.activePanel)) {
        loadOverview();
      }
    }, 30000);
  } catch (error) {
    setStatus(error.message);
  }
}

init();
