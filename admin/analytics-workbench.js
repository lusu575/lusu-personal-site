/* Read-only analytics controls. No drafts, credentials, or visitor identifiers are persisted. */
(function attachAnalyticsWorkbench(root) {
  "use strict";

  const allowedDays = new Set([1, 7, 14, 30]);
  const analyticsPanels = new Set(["dashboard", "visits", "clicks"]);
  let days = 14;
  let paused = false;
  let context = null;
  let lastOverview = null;
  let pendingFocus = null;
  let workSummary = null;
  let workSummaryError = "";
  let workSummaryLoading = false;
  let renderedHistorySummary;
  let requestPending = false;

  function metricRows(rows, metric) {
    if (!Array.isArray(rows) || !rows.length) return [];
    // A missing metric is unknown, not a measured zero.
    if (rows.some((row) => row?.[metric] == null || !Number.isFinite(Number(row[metric])))) return [];
    return rows.map((row) => ({
      at: String(row.hour || row.day || ""),
      value: Math.max(0, Number(row[metric]))
    })).filter((row) => row.at).sort((a, b) => a.at.localeCompare(b.at));
  }

  function metricModels(overview = {}) {
    const cards = overview.cards || {};
    const windowDays = overview.windowDays || 14;
    const model = (key, label, hint, source, metric, period) => ({
      key, label, hint, value: cards[key], metric, period,
      rows: source ? metricRows(overview[source], metric) : []
    });
    return [
      model("todayPv", "今日页面浏览", "今日已采集的页面打开次数，刷新计入。", "hourly", "pv", "今日逐时浏览"),
      model("todayUv", "今日独立访客", "今日按账号或匿名访客标识去重；逐时访客不可相加。", "hourly", "uv", "今日逐时访客"),
      model("totalPv", `近 ${windowDays} 天浏览`, "所选日期范围内已采集的页面打开次数。", "daily", "pv", "逐日浏览"),
      model("totalUv", `近 ${windowDays} 天访客`, "整个日期范围去重；每天的访客数不可相加作为总访客。", "daily", "uv", "逐日访客"),
      model("todayClicks", "今日点击动作", "今日已采集的按钮、卡片、筛选和播放等操作。", "hourly", "clicks", "今日逐时点击"),
      model("onlineVisitors", "近 5 分钟活跃", "近 5 分钟有已采集活动的去重访客，不等于实时连接；无历史在线序列。", null, null, "当前快照"),
      model("todayMessages", "今日聊天消息", "今日发出且当前仍保留的消息；删除或过期清理会减少历史数量。", "hourly", "messages", "今日逐时保留消息")
    ];
  }

  function csvCell(value) {
    let text = value == null ? "" : String(value);
    // Spreadsheet formula prefixes remain dangerous after whitespace/control characters.
    if (typeof value !== "number" && (/^[\s\p{Cc}]*[=+\-@]/u.test(text) || /^[\t\r\n]/u.test(text))) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  }

  function overviewCsv(overview = {}) {
    const rows = [
      ["鲁肃个人站访问统计", "已采集事件，不还原历史未采集流量"],
      ["时区", overview.timeZone || "UTC"],
      ["统计开始（包含）", overview.range?.start || "未提供"],
      ["统计截至（不包含）", overview.range?.end || overview.generatedAt || "未提供"],
      ["生成时间", overview.generatedAt || "未提供"],
      ["历史采样", overview.collection?.note || "历史采样率未保存，不能还原完整流量"],
      [], ["指标", "值"]
    ];
    metricModels(overview).forEach((item) => rows.push([item.label, item.value ?? "未提供"]));
    for (const [label, source, dateKey] of [["每日已采集事件", "daily", "day"], ["今日逐时已采集事件", "hourly", "hour"]]) {
      rows.push([], [label], ["时间", "页面浏览", "独立访客（不可累加）", "点击", "聊天消息"]);
      [...(overview[source] || [])].sort((a, b) => String(a[dateKey]).localeCompare(String(b[dateKey]))).forEach((row) => (
        rows.push([row[dateKey], row.pv, row.uv, row.clicks, row.messages])
      ));
    }
    rows.push([], ["期间页面排行（API 返回的排行范围）"], ["页面", "浏览", "访客"]);
    (overview.topPages || []).forEach((row) => rows.push([row.path || row.route, row.pv, row.uv]));
    return `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
  }

  function formatDate(value, timeZone = "Asia/Shanghai") {
    if (!value || Number.isNaN(new Date(value).getTime())) return "未记录";
    return new Intl.DateTimeFormat("zh-CN", {
      timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
    }).format(new Date(value));
  }

  function nextPlannedAt(channelKey, now = Date.now()) {
    const timestamp = new Date(now).getTime();
    if (!Number.isFinite(timestamp)) return null;
    // These two documented plans use Asia/Shanghai (UTC+08:00, no daylight saving).
    const local = new Date(timestamp + 8 * 3600000);
    const target = new Date(local);
    target.setUTCHours(channelKey === "tool-radar" ? 22 : 7, 0, 0, 0);
    if (channelKey === "tool-radar") target.setUTCDate(target.getUTCDate() + (2 - target.getUTCDay() + 7) % 7);
    if (target.getTime() <= local.getTime()) target.setUTCDate(target.getUTCDate() + (channelKey === "tool-radar" ? 7 : 1));
    return new Date(target.getTime() - 8 * 3600000).toISOString();
  }

  function samplingNote(overview = {}) {
    const collection = overview.collection || {};
    const note = collection.note || "仅显示已采集事件；历史采样率未保存，不能还原完整流量。";
    const current = collection.current;
    if (collection.status !== "available" || !current) return `${note} 当前采集策略未读取。`;
    if (!current.analyticsEnabled) return `${note} 当前非必要遥测已关闭。`;
    const sampling = current.sampling || {};
    const percent = (value) => value == null ? "未知" : `${value}%`;
    return `${note} 当前采样：页面 ${percent(sampling.pageViews)}／点击 ${percent(sampling.clicks)}／文章 ${percent(sampling.articleViews)}；该比例不能代表历史。`;
  }

  function element(tag, text, className) {
    const node = root.document.createElement(tag);
    if (text != null) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  function captureFocus() {
    const doc = root.document;
    const active = doc?.activeElement;
    const host = active?.closest?.("#dashboard-panel, #visits-panel, #clicks-panel");
    if (!host || active === doc.body) return null;
    if (active.id) return { id: active.id };
    if (active.dataset.analyticsKey) return { key: active.dataset.analyticsKey };
    // Preserve a stable semantic label when a read-only ranking item is regenerated.
    const title = active.querySelector?.("strong, h3")?.textContent;
    const container = active.parentElement;
    return container?.id && title ? { containerId: container.id, title } : null;
  }

  function restoreFocus(snapshot) {
    if (!snapshot) return;
    const doc = root.document;
    let target = snapshot.id ? doc.getElementById(snapshot.id) : null;
    if (!target && snapshot.key) target = [...doc.querySelectorAll("[data-analytics-key]")].find((node) => node.dataset.analyticsKey === snapshot.key);
    if (!target && snapshot.containerId) target = [...(doc.getElementById(snapshot.containerId)?.children || [])].find((node) => node.querySelector?.("strong, h3")?.textContent === snapshot.title);
    target?.focus?.({ preventScroll: true });
  }

  function init(options) {
    context = options;
    const doc = root.document;
    if (doc.getElementById("analytics-workbench-toolbar")) return;
    const toolbar = element("section", null, "analytics-workbench-toolbar xp-panel");
    toolbar.id = "analytics-workbench-toolbar";
    toolbar.setAttribute("aria-label", "统计范围与刷新控制");
    const control = element("label", "统计日期", "analytics-control");
    const select = element("select");
    select.id = "analytics-window-days";
    for (const count of allowedDays) {
      const option = element("option", count === 1 ? "今天" : `近 ${count} 天（含今天）`);
      option.value = String(count);
      option.selected = count === days;
      select.append(option);
    }
    control.append(select);
    select.addEventListener("change", async () => {
      if (requestPending) return;
      const next = Number(select.value);
      if (!allowedDays.has(next)) return;
      days = next;
      requestPending = true;
      select.disabled = true;
      doc.getElementById("analytics-export-csv").disabled = true;
      doc.getElementById("analytics-change-note").textContent = "正在读取所选日期范围…";
      try {
        const pending = context.getState?.().loadingPanels?.overview;
        if (pending) await pending;
        await context.reload();
      } finally {
        requestPending = false;
        select.disabled = false;
        const matched = Number(lastOverview?.windowDays) === days;
        doc.getElementById("analytics-export-csv").disabled = !matched;
        if (!matched) doc.getElementById("analytics-change-note").textContent = "新日期范围未读取成功；当前仍为上次成功结果，请点击刷新重试。";
      }
    });
    const pause = element("button", "暂停自动刷新", "xp-button");
    pause.id = "analytics-pause-refresh";
    pause.type = "button";
    pause.setAttribute("aria-pressed", "false");
    pause.addEventListener("click", () => {
      paused = !paused;
      pause.textContent = paused ? "恢复自动刷新" : "暂停自动刷新";
      pause.setAttribute("aria-pressed", String(paused));
      doc.getElementById("analytics-change-note").textContent = paused ? "自动刷新已暂停；仍可手动刷新。" : "自动刷新已恢复，每 30 秒检查一次。";
    });
    const exportButton = element("button", "导出统计 CSV", "xp-button");
    exportButton.type = "button";
    exportButton.id = "analytics-export-csv";
    exportButton.disabled = true;
    exportButton.addEventListener("click", () => {
      if (!lastOverview || requestPending || Number(lastOverview.windowDays) !== days) return;
      const url = root.URL.createObjectURL(new Blob([overviewCsv(lastOverview)], { type: "text/csv;charset=utf-8" }));
      const anchor = element("a");
      anchor.href = url;
      anchor.download = `lusu-analytics-${lastOverview.windowDays}days-${String(lastOverview.generatedAt || "snapshot").slice(0, 10)}.csv`;
      doc.body.append(anchor);
      anchor.click();
      anchor.remove();
      root.setTimeout(() => root.URL.revokeObjectURL(url), 1000);
      doc.getElementById("analytics-change-note").textContent = "CSV 已生成，含时区、统计区间、采集声明与聚合数据。";
    });
    const note = element("p", "统计时区与截至时间将在读取后显示。", "analytics-range-note");
    note.id = "analytics-range-note";
    const change = element("p", "每 30 秒自动刷新；页面隐藏时暂停。", "analytics-change-note");
    change.id = "analytics-change-note";
    change.setAttribute("role", "status");
    change.setAttribute("aria-live", "polite");
    toolbar.append(control, pause, exportButton, note, change);
    doc.getElementById("dashboard-panel")?.prepend(toolbar);
    createWorkQueue();
    syncPanel();
  }

  function syncPanel() {
    const toolbar = root.document?.getElementById("analytics-workbench-toolbar");
    const panel = context?.getState?.().activePanel;
    if (toolbar) {
      toolbar.hidden = !analyticsPanels.has(panel);
      const host = root.document.getElementById(`${panel}-panel`);
      if (!toolbar.hidden && host && toolbar.parentElement !== host) host.prepend(toolbar);
    }
    renderWorkQueue();
  }

  function beforeOverview() {
    pendingFocus = captureFocus();
  }

  function afterOverview(overview) {
    const doc = root.document;
    const note = doc?.getElementById("analytics-range-note");
    const change = doc?.getElementById("analytics-change-note");
    if (note) {
      const zone = overview.timeZone || "UTC";
      const start = overview.range?.start;
      const end = overview.range?.end || overview.generatedAt;
      note.textContent = `${zone} · ${start ? `${formatDate(start, zone)} 至 ` : "截至 "}${formatDate(end, zone)}（结束时刻不含） · ${samplingNote(overview)} 无可比历史采样基线，暂不展示环比／同比。`;
    }
    if (change && lastOverview) {
      const changes = metricModels(overview).filter((item) => item.value !== lastOverview.cards?.[item.key]);
      change.textContent = Number(lastOverview.windowDays) !== Number(overview.windowDays)
        ? `已切换至 ${overview.windowDays} 天范围。`
        : changes.length ? `已更新：${changes.map((item) => `${item.label} ${item.value ?? "未提供"}`).join("；")}` : "已检查，核心指标暂无变化。";
      if (paused) change.textContent += " 自动刷新保持暂停。";
    }
    lastOverview = overview;
    const exportButton = doc?.getElementById("analytics-export-csv");
    if (exportButton) exportButton.disabled = Number(overview.windowDays) !== days;
    restoreFocus(pendingFocus);
    pendingFocus = null;
    renderWorkQueue();
  }

  function createWorkQueue() {
    const doc = root.document;
    if (doc.getElementById("admin-work-queue")) return;
    const queue = element("section", null, "xp-panel admin-work-queue");
    queue.id = "admin-work-queue";
    const header = element("div", null, "panel-head");
    const title = element("h2", "待办与任务");
    const refresh = element("button", "更新待办", "xp-button");
    refresh.type = "button";
    refresh.id = "admin-work-queue-refresh";
    refresh.addEventListener("click", refreshWorkSummary);
    header.append(title, refresh);
    const items = element("div", null, "admin-work-items");
    items.id = "admin-work-items";
    const note = element("p", "按需读取管理摘要，不加载文章或文件正文。", "panel-head-note");
    note.id = "admin-work-queue-note";
    note.setAttribute("role", "status");
    const history = element("details", null, "admin-work-history");
    const historyTitle = element("summary", "近期任务与操作记录");
    const historyBody = element("div", null, "event-list");
    historyBody.id = "admin-work-history";
    history.append(historyTitle, historyBody);
    queue.append(header, items, note, history);
    doc.querySelector("#dashboard-panel .property-section")?.after(queue);
    if (!queue.isConnected) doc.getElementById("dashboard-panel")?.append(queue);
    renderWorkQueue();
  }

  async function refreshWorkSummary() {
    if (!context?.api || workSummaryLoading) return;
    workSummaryLoading = true;
    workSummaryError = "";
    renderWorkQueue();
    try { workSummary = await context.api("/api/admin/workbench-summary"); }
    catch (error) { workSummaryError = `读取待办失败：${error.message}。`; }
    finally { workSummaryLoading = false; renderWorkQueue(); }
  }

  function workItems(state = {}, summary = null) {
    const loaded = state.loadedPanels || {};
    const draftCount = summary ? summary.draftArticleCount : loaded.articles ? (state.articles || []).filter((row) => row.status === "draft").length : null;
    const videoCount = summary ? summary.videoNeedsMetadataCount : loaded.videos ? (state.videos || []).filter((row) => !row.title || !row.thumbnail_url || row.metadata_error).length : null;
    const cleanupCount = summary ? summary.whiteboardCleanupFailedCount : loaded.whiteboards ? (state.whiteboardRooms || []).filter((row) => row.status === "deleting").length : null;
    return [
      { key: "articles", label: "待审草稿", count: draftCount, note: summary ? "当前全部草稿" : "已读取文章列表", panel: "articles" },
      { key: "videos", label: "视频资料待补", count: videoCount, note: summary ? "标题／封面缺失或抓取异常" : "已读取列表：资料缺失或抓取异常", panel: "videos" },
      { key: "whiteboards", label: "画板清理待完成", count: cleanupCount, note: "删除尚未完成的房间", panel: "whiteboards" },
      { key: "transfer", label: "互传删除待完成", count: summary?.transferPendingDeletionCount, note: "进行中或待重试的文件删除", href: "/admin/transfer.html" },
      { key: "h3", label: "H3 失败任务", count: summary?.h3FailedJobCount, note: "本人任务中的真实失败记录", href: "/admin/minimax-h3.html?from=admin" },
      { key: "automation", label: "自动投递", count: null, note: "查看通道配置、最近送达与计划时间", panel: "automation" }
    ];
  }

  function renderWorkQueue() {
    const doc = root.document;
    const list = doc?.getElementById("admin-work-items");
    if (!list || !context) return;
    const activeKey = doc.activeElement?.dataset.workKey;
    list.replaceChildren(...workItems(context.getState(), workSummary).map((item) => {
      const button = element("button", null, "admin-work-item");
      button.type = "button";
      button.dataset.workKey = item.key;
      button.append(element("span", item.label), element("strong", item.count == null ? (item.key === "automation" ? "查看任务" : workSummary ? "不可用" : "待读取") : String(item.count)), element("small", item.note));
      button.addEventListener("click", () => {
        if (item.panel) context.openPanel(item.panel);
        else [...doc.querySelectorAll("[data-admin-href]")].find((node) => node.dataset.adminHref === item.href)?.click();
      });
      return button;
    }));
    const refresh = doc.getElementById("admin-work-queue-refresh");
    refresh.disabled = workSummaryLoading;
    refresh.setAttribute("aria-busy", String(workSummaryLoading));
    const note = doc.getElementById("admin-work-queue-note");
    note.textContent = workSummaryLoading ? "正在读取待办摘要…" : workSummaryError || (workSummary ? `截至 ${formatDate(workSummary.generatedAt)}；打开相应模块处理。` : "尚未读取的模块不显示为零；点击“更新待办”读取完整计数。");
    if (activeKey) [...list.children].find((node) => node.dataset.workKey === activeKey)?.focus({ preventScroll: true });
    renderWorkHistory();
  }

  function renderWorkHistory() {
    const box = root.document?.getElementById("admin-work-history");
    if (!box) return;
    if (renderedHistorySummary === workSummary) return;
    renderedHistorySummary = workSummary;
    if (!workSummary) {
      box.replaceChildren(element("p", "更新待办后，显示已记录的任务和操作。"));
      return;
    }
    const sourceLabels = { "daily-ai-news": "每日 AI 新闻", "tool-radar": "工具雷达", whiteboard: "在线画板", transfer: "临时互传", h3: "H3" };
    const statusLabels = { published: "已公开", draft: "草稿", archived: "已归档", failed: "失败", succeeded: "成功", success: "成功", completed: "完成", recorded: "已记录", running: "运行中", pending: "等待中", queued: "排队中", sent: "已发送", cancelled: "已取消", skipped: "已跳过", partial: "部分完成" };
    const actionLabels = { "article-delivered": "文章送达", clear: "清空", lock: "切换只读", kick: "移除连接", ban: "禁言", delete: "删除", "room-delete": "删除房间", "delete-room": "删除房间", "item-delete": "删除文件", "delete-item": "删除文件", created: "任务建立", queued: "任务排队", started: "任务启动", completed: "任务完成", failed: "任务失败" };
    const nodes = [element("p", workSummary.operationHistoryNote || "仅覆盖已有来源记录。", "panel-head-note")];
    for (const task of workSummary.tasks?.automation || []) {
      nodes.push(element("p", `${sourceLabels[task.channelKey] || "投递通道"}：投递${task.enabled ? "启用" : "暂停"}，自动公开${task.autoPublish ? "开启" : "关闭"}；最近送达 ${formatDate(task.lastDeliveryAt)}。执行状态未接入。`));
    }
    for (const run of (workSummary.tasks?.transferCleanup || []).slice(0, 3)) {
      nodes.push(element("p", `互传清理：${statusLabels[run.status] || "状态待核对"} · ${formatDate(run.startedAt)} · 失败操作 ${Number(run.failedOperations || 0)} 次`));
    }
    for (const alert of (workSummary.tasks?.transferAlerts || []).slice(0, 3)) {
      nodes.push(element("p", `互传提醒：${statusLabels[alert.status] || "状态待核对"} · ${formatDate(alert.sentAt || alert.createdAt)}`));
    }
    for (const row of (workSummary.recentOperations || []).slice(0, 12)) {
      const item = element("article", null, "event-item");
      item.append(element("strong", `${sourceLabels[row.source] || "管理操作"} · ${actionLabels[row.action] || "操作事件"}`), element("small", `${statusLabels[row.status] || "状态待核对"} · ${formatDate(row.createdAt)}（Asia/Shanghai）`));
      const details = element("details");
      details.append(element("summary", "事件类型"), element("code", [row.action, row.code].filter(Boolean).join(" · ")));
      item.append(details);
      nodes.push(item);
    }
    if (!(workSummary.recentOperations || []).length) nodes.push(element("p", "暂未取得近期操作记录；不可用来源不会显示为成功。"));
    box.replaceChildren(...nodes);
  }

  root.AdminAnalyticsWorkbench = Object.freeze({
    init, syncPanel, beforeOverview, afterOverview, renderWorkQueue, refreshWorkSummary,
    isPaused: () => paused, overviewUrl: () => `/api/admin/analytics/overview?days=${days}`,
    metricModels, metricRows, csvCell, overviewCsv, nextPlannedAt, formatDate, samplingNote, workItems
  });
})(globalThis);
