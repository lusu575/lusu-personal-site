(function () {
  "use strict";
  const state = { overview: null, settings: null };
  const byId = (id) => document.getElementById(id);

  async function api(url, options = {}) {
    const headers = new Headers(options.headers || {});
    let body = options.body;
    if (options.json !== undefined) { headers.set("Content-Type", "application/json"); body = JSON.stringify(options.json); }
    const response = await fetch(url, { method: options.method || "GET", headers, body, credentials: "same-origin" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
    return payload;
  }

  async function load() {
    notice("正在读取互传数据……");
    try {
      const [overview, settings, rooms, items, uploads, alerts] = await Promise.all([
        api("/api/admin/transfer/overview"), api("/api/admin/transfer/settings"), api("/api/admin/transfer/rooms?limit=100"),
        api("/api/admin/transfer/items?limit=100"), api("/api/admin/transfer/uploads?limit=100"), api("/api/admin/transfer/alerts")
      ]);
      state.overview = overview;
      state.settings = settings.settings;
      renderOverview();
      renderSettings();
      renderRooms(rooms.rooms || []);
      renderItems(items.items || []);
      renderUploads(uploads.uploads || []);
      renderAlerts(alerts.alerts || []);
      notice("");
    } catch (error) { notice(error.message, true); }
  }

  function renderOverview() {
    const usage = state.overview.usage;
    const values = [
      ["有效文件", usage.active.activeItems], ["当前总存储", bytes(usage.active.totalBytes)], ["普通用户占用", bytes(usage.active.normalBytes)],
      ["管理员占用", bytes(usage.active.adminBytes)], ["正在上传", usage.active.uploadingItems], ["清理失败", usage.active.cleanupFailedItems],
      ["待清理", state.overview.expiredPendingCleanup], ["估算费用", `$${Number(usage.monthly.estimatedCostUsd).toFixed(2)}`]
    ];
    byId("metrics").replaceChildren(...values.map(([label, value]) => metric(label, value)));
    const cost = usage.monthly.costBreakdown;
    byId("cost-grid").replaceChildren(
      costItem("计费月", usage.monthly.billingMonth), costItem("估算 GB-month", usage.monthly.estimatedStorageGbMonth),
      costItem("Class A", usage.monthly.classAOperations), costItem("Class B", usage.monthly.classBOperations),
      costItem("存储费", `$${cost.storage.toFixed(2)}`), costItem("操作费", `$${(cost.operationsA + cost.operationsB).toFixed(2)}`),
      costItem("普通池", usage.normalPool.status.toUpperCase()), costItem("总估算", `$${usage.monthly.estimatedCostUsd.toFixed(2)}`)
    );
    const notification = state.overview.notification;
    byId("notification-status").textContent = notification.webhookConfigured ? "Webhook 已配置" : "邮件/Webhook 报警尚未配置";
    byId("normal-switch").textContent = usage.normalPool.normalUploadEnabled ? "暂停普通用户上传" : "恢复普通用户上传";
    byId("normal-switch").dataset.next = String(!usage.normalPool.normalUploadEnabled);
    byId("global-switch").textContent = usage.normalPool.globalUploadEnabled ? "暂停全部上传" : "恢复全部上传";
    byId("global-switch").dataset.next = String(!usage.normalPool.globalUploadEnabled);
  }

  function renderSettings() {
    const form = byId("settings-form");
    const map = {
      normal_max_file_bytes: "normalMaxFileBytes", normal_user_24h_bytes: "normalUser24hBytes", normal_user_daily_files: "normalUserDailyFiles",
      normal_user_init_per_minute: "normalUserInitPerMinute", normal_room_active_bytes: "normalRoomActiveBytes", normal_pool_active_bytes: "normalPoolActiveBytes",
      normal_pool_yellow_ratio: "normalPoolYellowRatio", normal_pool_red_ratio: "normalPoolRedRatio", alert_thresholds: "alertThresholds"
    };
    Object.entries(map).forEach(([name, key]) => { if (form.elements[name]) form.elements[name].value = state.settings[key]; });
  }

  function renderRooms(rows) {
    const body = byId("rooms"); body.replaceChildren();
    rows.forEach((row) => {
      const actions = actionCell();
      actions.append(action("清空", true, () => roomAction(row.id, "clear")), action("关闭", true, () => roomAction(row.id, "close")));
      body.append(tableRow([code(row.id), row.status, row.item_count, bytes(row.active_bytes), time(row.last_activity_at), actions]));
    });
  }

  function renderItems(rows) {
    const body = byId("items"); body.replaceChildren();
    rows.forEach((row) => {
      const actions = actionCell(); actions.append(action("删除", true, () => deleteItem(row.id)));
      body.append(tableRow([row.display_filename || "加密文字", row.uploader_email || row.uploader_user_id, row.mime_type || row.item_type, bytes(row.size_bytes), row.upload_status, time(row.expires_at), actions]));
    });
  }

  function renderUploads(rows) {
    const body = byId("uploads"); body.replaceChildren();
    rows.forEach((row) => {
      const actions = actionCell();
      if (["active", "completing", "failed"].includes(row.status)) actions.append(action("中止", true, () => abortUpload(row)));
      body.append(tableRow([code(row.id), row.filename, bytes(row.declared_size_bytes), `${row.completed_parts}/${row.expected_parts}`, row.status, time(row.updated_at), actions]));
    });
  }

  function renderAlerts(rows) {
    const body = byId("alerts"); body.replaceChildren();
    rows.forEach((row) => body.append(tableRow([row.billing_month, `$${row.threshold_usd}`, row.alert_type, row.status, time(row.sent_at || row.created_at)])));
  }

  async function search(kind) {
    const input = byId(`${kind}-search`);
    try {
      const payload = await api(`/api/admin/transfer/${kind === "room" ? "rooms" : "items"}?limit=100&search=${encodeURIComponent(input.value.trim())}`);
      if (kind === "room") renderRooms(payload.rooms || []); else renderItems(payload.items || []);
    } catch (error) { notice(error.message, true); }
  }

  async function roomAction(id, actionName) {
    if (!confirm(`确定${actionName === "clear" ? "清空" : "关闭"}房间 ${id}？`)) return;
    await run(() => api(`/api/admin/transfer/room/${encodeURIComponent(id)}/${actionName}`, { method: "POST", json: {} }));
  }
  async function deleteItem(id) { if (confirm(`确定删除项目 ${id}？`)) await run(() => api(`/api/admin/transfer/item/${encodeURIComponent(id)}`, { method: "DELETE" })); }
  async function abortUpload(row) { if (confirm(`确定中止 ${row.filename}？`)) await run(() => api("/api/admin/transfer/upload/abort", { method: "POST", json: { sessionId: row.id, roomKey: row.room_key } })); }

  async function run(operation) {
    try { notice("正在执行……"); await operation(); await load(); } catch (error) { notice(error.message, true); }
  }

  function bind() {
    byId("refresh").addEventListener("click", load);
    byId("cleanup").addEventListener("click", () => { if (confirm("立即执行过期文件与孤立对象清理？")) run(() => api("/api/admin/transfer/cleanup", { method: "POST", json: { reconcile: true, limit: 500 } })); });
    byId("test-alert").addEventListener("click", () => run(() => api("/api/admin/transfer/alert/test", { method: "POST", json: {} })));
    byId("normal-switch").addEventListener("click", () => run(() => api("/api/admin/transfer/normal-upload-switch", { method: "POST", json: { enabled: byId("normal-switch").dataset.next === "true" } })));
    byId("global-switch").addEventListener("click", () => { if (confirm("确认切换全部文件上传状态？")) run(() => api("/api/admin/transfer/global-upload-switch", { method: "POST", json: { enabled: byId("global-switch").dataset.next === "true" } })); });
    byId("settings-form").addEventListener("submit", (event) => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(event.currentTarget));
      Object.keys(values).filter((key) => key !== "alert_thresholds").forEach((key) => { values[key] = Number(values[key]); });
      run(() => api("/api/admin/transfer/settings", { method: "PUT", json: values }));
    });
    let timer;
    ["room", "item"].forEach((kind) => byId(`${kind}-search`).addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(() => search(kind), 250); }));
  }

  function metric(label, value) { const node = document.createElement("article"); node.className = "metric"; const name = document.createElement("span"); name.textContent = label; const strong = document.createElement("strong"); strong.textContent = value; node.append(name, strong); return node; }
  function costItem(label, value) { const node = document.createElement("div"); const name = document.createElement("span"); name.textContent = label; const strong = document.createElement("strong"); strong.textContent = value; node.append(name, strong); return node; }
  function tableRow(values) { const row = document.createElement("tr"); values.forEach((value) => { const cell = document.createElement("td"); if (value instanceof Node) cell.append(value); else cell.textContent = String(value ?? ""); row.append(cell); }); return row; }
  function actionCell() { const node = document.createElement("div"); node.className = "actions"; return node; }
  function action(label, danger, handler) { const button = document.createElement("button"); button.type = "button"; button.textContent = label; if (danger) button.className = "danger"; button.addEventListener("click", handler); return button; }
  function code(value) { const node = document.createElement("code"); node.textContent = value || ""; return node; }
  function bytes(value) { const size = Number(value) || 0; if (size < 1024) return `${size} B`; const units = ["KiB","MiB","GiB","TiB"]; let number = size / 1024, unit = units[0]; for (let i=1;i<units.length&&number>=1024;i+=1){number/=1024;unit=units[i];} return `${number.toFixed(number>=10?1:2)} ${unit}`; }
  function time(value) { return value ? new Intl.DateTimeFormat("zh-CN",{dateStyle:"short",timeStyle:"short"}).format(new Date(value)) : "—"; }
  function notice(value, error) { byId("notice").textContent = value || ""; byId("notice").classList.toggle("error", Boolean(error)); }

  bind();
  load();
})();
