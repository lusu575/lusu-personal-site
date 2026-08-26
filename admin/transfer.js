(function () {
  "use strict";

  const SETTINGS_FIELDS = Object.freeze({
    normal_max_file_bytes: "normalMaxFileBytes",
    normal_user_24h_bytes: "normalUser24hBytes",
    normal_user_daily_files: "normalUserDailyFiles",
    normal_user_init_per_minute: "normalUserInitPerMinute",
    normal_room_active_bytes: "normalRoomActiveBytes",
    normal_pool_active_bytes: "normalPoolActiveBytes",
    normal_pool_yellow_ratio: "normalPoolYellowRatio",
    normal_pool_red_ratio: "normalPoolRedRatio",
    alert_thresholds: "alertThresholds"
  });

  const state = {
    overview: null,
    settings: null,
    settingsVersion: null,
    settingsBaseline: "",
    settingsDirty: false,
    mutationLocked: false,
    mutationBusyButton: null,
    itemLimit: 50,
    itemOffset: 0,
    itemTotal: 0,
    itemSearch: "",
    roomSearch: "",
    requestChannels: {
      item: { sequence: 0, controller: null, timer: 0 },
      room: { sequence: 0, controller: null, timer: 0 }
    },
    tableBusyCounts: new Map(),
    failedLoads: new Map(),
    retryOperation: null,
    confirmResolver: null,
    noticeHideTimer: 0,
    dialogCloseCleanup: null,
    dialogMotionGeneration: 0
  };

  const byId = (id) => document.getElementById(id);
  const TRANSFER_DIALOG_MOTION_MS = 180;

  function transferMotionIsOff() {
    return document.documentElement.dataset.motion === "off"
      || document.body.dataset.motion === "off";
  }

  function transferMotionShouldBeImmediate(options = {}) {
    return Boolean(options.immediate)
      || transferMotionIsOff()
      || document.body.dataset.inputMethod === "keyboard";
  }

  class ApiError extends Error {
    constructor(message, response, payload) {
      super(message);
      this.name = "ApiError";
      this.status = Number(response?.status || 0);
      this.code = String(payload?.code || "");
      this.payload = payload || {};
    }
  }

  async function api(url, options = {}) {
    const headers = new Headers(options.headers || {});
    let body = options.body;
    if (options.json !== undefined) {
      headers.set("Content-Type", "application/json");
      body = JSON.stringify(options.json);
    }
    const response = await fetch(url, {
      method: options.method || "GET",
      headers,
      body,
      credentials: "same-origin",
      signal: options.signal
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new ApiError(payload.error || `HTTP ${response.status}`, response, payload);
    }
    return payload;
  }

  function setTableBusy(bodyId, busy) {
    const tableWrap = byId(bodyId)?.closest(".table-wrap");
    if (!tableWrap) {
      return;
    }
    const current = state.tableBusyCounts.get(bodyId) || 0;
    const next = Math.max(0, current + (busy ? 1 : -1));
    if (next) {
      state.tableBusyCounts.set(bodyId, next);
    } else {
      state.tableBusyCounts.delete(bodyId);
    }
    const active = next > 0;
    tableWrap.setAttribute("aria-busy", active ? "true" : "false");
    tableWrap.classList.toggle("is-busy", active);
    tableWrap.classList.toggle("is-loading", active);
  }

  async function withTableBusy(bodyId, operation) {
    setTableBusy(bodyId, true);
    try {
      return await operation();
    } finally {
      setTableBusy(bodyId, false);
    }
  }

  function loadDefinitions(options = {}) {
    return [
      ["概览", async () => {
        state.overview = await api("/api/admin/transfer/overview");
        renderOverview();
      }],
      ["设置", async () => {
        const payload = await api("/api/admin/transfer/settings");
        if (!state.settingsDirty || options.forceSettings) {
          applySettings(payload.settings, { force: true });
        }
      }],
      ["房间", async () => loadRoomRows(state.roomSearch)],
      ["文件", async () => loadItemRows()],
      ["分片上传", async () => {
        await withTableBusy("uploads", async () => {
          const payload = await api("/api/admin/transfer/uploads?limit=100");
          renderUploads(payload.uploads || []);
        });
      }],
      ["报警", async () => {
        await withTableBusy("alerts", async () => {
          const payload = await api("/api/admin/transfer/alerts");
          renderAlerts(payload.alerts || []);
        });
      }]
    ];
  }

  async function load(options = {}) {
    if (!options.quiet) {
      notice("正在读取互传数据……");
    }
    return executeLoaders(loadDefinitions(options), options);
  }

  async function executeLoaders(definitions, options = {}) {
    const failures = [];
    await Promise.all(definitions.map(async ([label, loader]) => {
      try {
        await loader();
        state.failedLoads.delete(label);
      } catch (error) {
        if (error?.name === "AbortError") {
          return;
        }
        state.failedLoads.set(label, loader);
        failures.push([label, error]);
      }
    }));
    if (failures.length) {
      const labels = failures.map(([label]) => label).join("、");
      notice(`部分数据读取失败：${labels}。已成功的区域仍可继续使用。`, true, { retry: true });
    } else if (!options.quiet) {
      notice("");
    }
    return failures;
  }

  async function retryFailedLoads() {
    const definitions = [...state.failedLoads.entries()];
    if (!definitions.length) {
      notice("");
      return;
    }
    notice("正在重试失败的数据……");
    await executeLoaders(definitions);
    if (!state.failedLoads.size) {
      notice("失败的数据已重新载入。");
    }
  }

  function renderOverview() {
    if (!state.overview?.usage) {
      return;
    }
    const usage = state.overview.usage;
    const values = [
      ["有效文件", usage.active.activeItems],
      ["当前总存储", bytes(usage.active.totalBytes)],
      ["普通用户占用", bytes(usage.active.normalBytes)],
      ["管理员占用", bytes(usage.active.adminBytes)],
      ["正在上传", usage.active.uploadingItems],
      ["清理失败", usage.active.cleanupFailedItems],
      ["待清理", state.overview.expiredPendingCleanup],
      ["估算费用", `$${Number(usage.monthly.estimatedCostUsd).toFixed(2)}`]
    ];
    byId("metrics").replaceChildren(...values.map(([label, value]) => metric(label, value)));
    const cost = usage.monthly.costBreakdown;
    byId("cost-grid").replaceChildren(
      costItem("计费月", usage.monthly.billingMonth),
      costItem("估算 GB-month", usage.monthly.estimatedStorageGbMonth),
      costItem("Class A", usage.monthly.classAOperations),
      costItem("Class B", usage.monthly.classBOperations),
      costItem("存储费", `$${cost.storage.toFixed(2)}`),
      costItem("操作费", `$${(cost.operationsA + cost.operationsB).toFixed(2)}`),
      costItem("普通池", usage.normalPool.status.toUpperCase()),
      costItem("总估算", `$${usage.monthly.estimatedCostUsd.toFixed(2)}`)
    );
    const notification = state.overview.notification;
    byId("notification-status").textContent = notification.webhookConfigured
      ? "Webhook 已配置"
      : "邮件/Webhook 报警尚未配置";
    byId("normal-switch").textContent = usage.normalPool.normalUploadEnabled
      ? "暂停普通用户上传"
      : "恢复普通用户上传";
    byId("normal-switch").dataset.next = String(!usage.normalPool.normalUploadEnabled);
    byId("global-switch").textContent = usage.normalPool.globalUploadEnabled
      ? "暂停全部上传"
      : "恢复全部上传";
    byId("global-switch").dataset.next = String(!usage.normalPool.globalUploadEnabled);
  }

  function applySettings(settings, options = {}) {
    if (!settings || (state.settingsDirty && !options.force)) {
      return;
    }
    state.settings = settings;
    state.settingsVersion = settings.updatedAt || null;
    const form = byId("settings-form");
    for (const [name, key] of Object.entries(SETTINGS_FIELDS)) {
      if (form.elements[name]) {
        form.elements[name].value = settings[key];
      }
    }
    state.settingsBaseline = settingsSnapshot();
    state.settingsDirty = false;
    byId("settings-conflict").hidden = true;
    syncSettingsDirty();
  }

  function settingsSnapshot() {
    const form = byId("settings-form");
    return JSON.stringify(Object.keys(SETTINGS_FIELDS).map((name) => [
      name,
      String(form.elements[name]?.value ?? "").trim()
    ]));
  }

  function syncSettingsDirty() {
    state.settingsDirty = Boolean(
      state.settingsBaseline
      && settingsSnapshot() !== state.settingsBaseline
    );
    const status = byId("settings-dirty");
    status.textContent = state.settingsDirty ? "有未保存修改" : "已保存";
    status.classList.toggle("is-dirty", state.settingsDirty);
    byId("settings-save").disabled = state.mutationLocked || !state.settingsDirty;
  }

  function renderRooms(rows) {
    const body = byId("rooms");
    body.replaceChildren();
    if (!rows.length) {
      body.append(emptyRow(6, state.roomSearch ? "没有匹配的房间。" : "当前没有互传房间。"));
      return;
    }
    rows.forEach((row) => {
      const actions = actionCell();
      actions.append(
        action("清空", true, (button) => roomAction(row, "clear", button)),
        action("删除房间", true, (button) => roomAction(row, "close", button))
      );
      body.append(tableRow([
        code(row.id),
        row.status,
        row.item_count,
        bytes(row.active_bytes),
        time(row.last_activity_at),
        actions
      ]));
    });
  }

  function renderItems(rows, pagination = {}) {
    const body = byId("items");
    body.replaceChildren();
    state.itemTotal = Number(pagination.total || 0);
    state.itemLimit = Number(pagination.limit || state.itemLimit);
    state.itemOffset = Number(pagination.offset || 0);
    if (!rows.length) {
      body.append(emptyRow(
        8,
        state.itemSearch
          ? "没有匹配的互传文件或内容。"
          : "当前没有保存中的互传文件或内容。"
      ));
    }
    rows.forEach((row) => {
      const actions = actionCell();
      actions.append(action("永久删除", true, (button) => deleteItem(row, button)));
      body.append(tableRow([
        row.display_filename || "加密文字",
        row.uploader_email || row.uploader_user_id || "账号已删除",
        itemTypeLabel(row),
        bytes(row.size_bytes),
        itemStatusLabel(row.upload_status),
        time(row.created_at),
        expiry(row.expires_at),
        actions
      ]));
    });
    renderItemPagination(rows.length);
  }

  function renderItemPagination(rowCount) {
    const start = state.itemTotal && rowCount ? state.itemOffset + 1 : 0;
    const end = state.itemOffset + rowCount;
    byId("items-page-status").textContent = state.itemTotal
      ? `显示 ${start}–${end} / 共 ${state.itemTotal} 项`
      : "0 项";
    byId("items-previous").disabled = state.itemOffset <= 0;
    byId("items-next").disabled = state.itemOffset + state.itemLimit >= state.itemTotal;
  }

  function itemsUrl() {
    const query = new URLSearchParams({
      limit: String(state.itemLimit),
      offset: String(state.itemOffset)
    });
    if (state.itemSearch) {
      query.set("search", state.itemSearch);
    }
    return `/api/admin/transfer/items?${query}`;
  }

  async function loadItemRows() {
    return channelRequest("item", itemsUrl(), (payload) => {
      renderItems(payload.items || [], payload.pagination || {});
    });
  }

  async function loadRoomRows(searchValue) {
    const query = new URLSearchParams({ limit: "100" });
    if (searchValue) {
      query.set("search", searchValue);
    }
    return channelRequest("room", `/api/admin/transfer/rooms?${query}`, (payload) => {
      renderRooms(payload.rooms || []);
    });
  }

  async function channelRequest(kind, url, render) {
    const channel = state.requestChannels[kind];
    channel.controller?.abort();
    const controller = new AbortController();
    const sequence = channel.sequence + 1;
    channel.sequence = sequence;
    channel.controller = controller;
    try {
      const bodyId = kind === "item" ? "items" : "rooms";
      const payload = await withTableBusy(bodyId, () => api(url, { signal: controller.signal }));
      if (channel.sequence !== sequence) {
        return null;
      }
      render(payload);
      return payload;
    } finally {
      if (channel.sequence === sequence) {
        channel.controller = null;
      }
    }
  }

  function renderUploads(rows) {
    const body = byId("uploads");
    body.replaceChildren();
    if (!rows.length) {
      body.append(emptyRow(7, "当前没有分片上传任务。"));
      return;
    }
    rows.forEach((row) => {
      const actions = actionCell();
      if (["active", "completing", "failed"].includes(row.status)) {
        actions.append(action("中止", true, (button) => abortUpload(row, button)));
      }
      body.append(tableRow([
        code(row.id),
        row.filename,
        bytes(row.declared_size_bytes),
        `${row.completed_parts}/${row.expected_parts}`,
        row.status,
        time(row.updated_at),
        actions
      ]));
    });
  }

  function renderAlerts(rows) {
    const body = byId("alerts");
    body.replaceChildren();
    if (!rows.length) {
      body.append(emptyRow(5, "当前没有费用报警记录。"));
      return;
    }
    rows.forEach((row) => body.append(tableRow([
      row.billing_month,
      `$${row.threshold_usd}`,
      row.alert_type,
      row.status,
      time(row.sent_at || row.created_at)
    ])));
  }

  function scheduleSearch(kind) {
    const channel = state.requestChannels[kind];
    window.clearTimeout(channel.timer);
    channel.timer = window.setTimeout(() => {
      channel.timer = 0;
      void search(kind);
    }, 250);
  }

  async function search(kind) {
    try {
      if (kind === "item") {
        state.itemSearch = byId("item-search").value.trim();
        state.itemOffset = 0;
        await loadItemRows();
        return;
      }
      state.roomSearch = byId("room-search").value.trim();
      await loadRoomRows(state.roomSearch);
    } catch (error) {
      if (error?.name !== "AbortError") {
        notice(error.message, true);
      }
    }
  }

  async function roomAction(row, actionName, busyTarget) {
    const clearing = actionName === "clear";
    const confirmed = await confirmAction({
      title: clearing ? "清空互传房间" : "永久删除互传房间",
      message: clearing
        ? "系统会逐项删除房间中的 R2 文件和数据库记录。某项失败时会保留该项并列出重试信息。"
        : "房间、加密文字、R2 文件和未完成的 Multipart 上传都会永久删除。",
      details: [
        `房间：${row.id}`,
        `当前项目：${row.item_count || 0} 项`,
        clearing ? `预计释放：${bytes(row.active_bytes)}` : `预计释放：${bytes(row.active_bytes)}`,
        clearing ? "不可撤销；删除失败的项目会原样保留。" : "不可恢复；同一密码再进入时会创建全新空房间，删除失败时可直接重试。"
      ],
      confirmLabel: clearing ? "确认清空房间" : "确认永久删除"
    });
    if (!confirmed) {
      return;
    }
    const endpoint = `/api/admin/transfer/room/${encodeURIComponent(row.id)}/${actionName}`;
    const operation = () => api(endpoint, { method: "POST", json: {} });
    await runMutation(operation, {
      successMessage: clearing ? "房间内容已全部清空。" : "房间与全部存储已永久删除。",
      partialRetry: operation,
      busyTarget
    });
  }

  async function deleteItem(row, busyTarget) {
    const filename = row.display_filename || "加密文字";
    const sender = row.uploader_email || row.uploader_user_id || "账号已删除";
    const storageImpact = row.item_type === "text"
      ? "立即删除数据库中的加密文字记录。"
      : "先删除私有 R2 对象，再删除数据库记录并释放对应空间。";
    const confirmed = await confirmAction({
      title: "永久删除互传项目",
      message: "此操作无法撤销。R2 删除失败时，记录会保留为“删除失败，待重试”，不会伪报空间已经释放。",
      details: [
        `对象：${filename}`,
        `发送者：${sender}`,
        `大小：${bytes(row.size_bytes)}`,
        storageImpact
      ],
      confirmLabel: "确认永久删除"
    });
    if (!confirmed) {
      return;
    }
    await runMutation(
      () => api(`/api/admin/transfer/item/${encodeURIComponent(row.id)}`, { method: "DELETE" }),
      { successMessage: "互传项目已永久删除。", busyTarget }
    );
  }

  async function abortUpload(row, busyTarget) {
    const confirmed = await confirmAction({
      title: "中止分片上传",
      message: "系统会中止 R2 Multipart 任务、删除已记录分片，并移除尚未就绪的项目记录。",
      details: [
        `文件：${row.filename || "未命名文件"}`,
        `任务：${row.id}`,
        `进度：${row.completed_parts}/${row.expected_parts}`,
        "中止后需要由发送者重新开始上传。"
      ],
      confirmLabel: "确认中止上传"
    });
    if (!confirmed) {
      return;
    }
    await runMutation(
      () => api("/api/admin/transfer/upload/abort", {
        method: "POST",
        json: { sessionId: row.id, roomKey: row.room_key }
      }),
      { successMessage: "分片上传已中止。", busyTarget }
    );
  }

  async function cleanup(busyTarget) {
    const confirmed = await confirmAction({
      title: "立即执行存储清理",
      message: "系统会删除过期文件、重试删除失败项，并核对 48 小时前的孤立 R2 对象。",
      details: [
        "最多处理 500 个数据库对象和当前一页 R2 对象。",
        "成功删除的内容无法恢复。",
        "失败对象会保留标识和原因，可从本提示直接重试。"
      ],
      confirmLabel: "确认立即清理"
    });
    if (!confirmed) {
      return;
    }
    const operation = () => api("/api/admin/transfer/cleanup", {
      method: "POST",
      json: { reconcile: true, limit: 500 }
    });
    await runMutation(operation, {
      successMessage: "存储清理已完成。",
      partialRetry: operation,
      busyTarget
    });
  }

  async function toggleUpload(kind, busyTarget) {
    const global = kind === "global";
    const button = byId(global ? "global-switch" : "normal-switch");
    const enabled = button.dataset.next === "true";
    const confirmed = await confirmAction({
      title: global ? "切换全部文件上传" : "切换普通用户上传",
      message: enabled
        ? "恢复后，新上传会重新按当前配额和存储状态受理。"
        : global
          ? "暂停后所有账号都不能开始新文件上传；已保存内容仍可下载和删除。"
          : "暂停后普通账号不能开始新文件上传；管理员大文件能力不受此开关影响。",
      details: [
        `目标状态：${enabled ? "允许上传" : "暂停上传"}`,
        global ? "范围：普通账号与管理员账号" : "范围：仅普通账号",
        "此操作不会删除现有文件。"
      ],
      confirmLabel: enabled ? "确认恢复上传" : "确认暂停上传"
    });
    if (!confirmed) {
      return;
    }
    const endpoint = global
      ? "/api/admin/transfer/global-upload-switch"
      : "/api/admin/transfer/normal-upload-switch";
    await runMutation(
      () => api(endpoint, {
        method: "POST",
        json: { enabled, expectedUpdatedAt: state.settingsVersion }
      }),
      {
        successMessage: enabled ? "上传已恢复。" : "上传已暂停。",
        busyTarget,
        onSuccess(payload) {
          acceptOwnSettingsRevision(payload.settings);
        }
      }
    );
  }

  function settingsPayload() {
    const values = Object.fromEntries(new FormData(byId("settings-form")));
    Object.keys(values)
      .filter((key) => key !== "alert_thresholds")
      .forEach((key) => {
        values[key] = Number(values[key]);
      });
    values.expectedUpdatedAt = state.settingsVersion;
    return values;
  }

  async function saveSettings(busyTarget) {
    if (!state.settingsDirty) {
      notice("设置没有变化。");
      return;
    }
    await runMutation(
      () => api("/api/admin/transfer/settings", {
        method: "PUT",
        json: settingsPayload()
      }),
      {
        successMessage: "互传设置已保存。",
        busyTarget,
        onSuccess(payload) {
          applySettings(payload.settings, { force: true });
        }
      }
    );
  }

  function acceptOwnSettingsRevision(settings) {
    if (!settings) {
      return;
    }
    if (state.settingsDirty) {
      state.settings = settings;
      state.settingsVersion = settings.updatedAt || state.settingsVersion;
      return;
    }
    applySettings(settings, { force: true });
  }

  async function runMutation(operation, options = {}) {
    if (state.mutationLocked) {
      return null;
    }
    setMutationLocked(true, options.busyTarget);
    notice("正在执行管理操作……");
    try {
      const payload = await operation();
      if (payload?.ok === false || payload?.status === "partial") {
        throw new ApiError("操作只完成了一部分。", { status: 502 }, payload);
      }
      if (typeof options.onSuccess === "function") {
        await options.onSuccess(payload);
      }
      hideOperationResult();
      let refreshFailures = [];
      if (options.refresh !== false) {
        refreshFailures = await load({ quiet: true });
      }
      if (refreshFailures.length) {
        notice(
          `${options.successMessage || "操作已完成。"} 但部分数据刷新失败，可单独重试。`,
          true,
          { retry: true }
        );
      } else {
        notice(options.successMessage || "操作已完成。");
      }
      return payload;
    } catch (error) {
      if (error?.name === "AbortError") {
        return null;
      }
      if (error?.code === "TRANSFER_SETTINGS_CONFLICT") {
        byId("settings-conflict").hidden = false;
        notice(error.message, true);
        return null;
      }
      const partial = error?.payload?.status === "partial"
        || Number(error?.payload?.failed || 0) > 0;
      if (partial) {
        renderOperationFailure(error.payload, options.partialRetry);
        await load({ quiet: true });
      }
      notice(error.message || "操作失败。", true, { retry: state.failedLoads.size > 0 });
      return null;
    } finally {
      setMutationLocked(false);
    }
  }

  function renderOperationFailure(payload, retryOperation) {
    const failures = Array.isArray(payload?.failures) ? payload.failures : [];
    const failedCount = Number(payload?.failed || failures.length);
    byId("operation-result-title").textContent = payload?.runId
      ? "清理操作未完全完成"
      : "房间操作未完全完成";
    byId("operation-result-summary").textContent =
      `已完成 ${Number(payload?.deletedItems ?? payload?.deleted ?? 0)} 项，`
      + `${failedCount} 项失败并保留等待重试。`;
    const list = byId("operation-result-failures");
    list.replaceChildren(...failures.map((failure) => {
      const item = document.createElement("li");
      const label = failure.label || failure.id || "未命名对象";
      item.textContent = `${label}：${failure.message || "操作失败"}（${failure.code || "未知错误"}）`;
      return item;
    }));
    if (payload?.failuresTruncated) {
      const item = document.createElement("li");
      item.textContent = "失败列表较长，页面仅显示前 100 项；再次清理会继续处理其余对象。";
      list.append(item);
    }
    state.retryOperation = typeof retryOperation === "function" ? retryOperation : null;
    byId("operation-retry").hidden = !state.retryOperation;
    byId("operation-result").hidden = false;
    byId("operation-result").focus?.();
  }

  function hideOperationResult() {
    state.retryOperation = null;
    byId("operation-result").hidden = true;
  }

  function setMutationLocked(locked, busyTarget = null) {
    state.mutationLocked = Boolean(locked);
    state.mutationBusyButton = state.mutationLocked && busyTarget instanceof HTMLButtonElement
      ? busyTarget
      : null;
    document.querySelectorAll("[data-mutation]").forEach((button) => {
      button.disabled = state.mutationLocked;
      if (state.mutationLocked && button === state.mutationBusyButton) {
        button.setAttribute("aria-busy", "true");
      } else {
        button.removeAttribute("aria-busy");
      }
    });
    syncSettingsDirty();
  }

  function confirmAction(options) {
    if (state.confirmResolver) {
      return Promise.resolve(false);
    }
    const dialog = byId("context-dialog");
    byId("context-dialog-title").textContent = options.title || "确认操作";
    byId("context-dialog-message").textContent = options.message || "";
    const details = byId("context-dialog-details");
    details.replaceChildren(...(options.details || []).map((value) => {
      const item = document.createElement("li");
      item.textContent = String(value);
      return item;
    }));
    byId("context-dialog-confirm").textContent = options.confirmLabel || "确认操作";
    dialog.returnValue = "";
    state.dialogCloseCleanup?.();
    state.dialogCloseCleanup = null;
    state.dialogMotionGeneration += 1;
    dialog.classList.remove("is-dialog-closing");
    dialog.classList.add("is-dialog-entering");
    dialog.showModal();
    if (transferMotionShouldBeImmediate()) {
      dialog.classList.remove("is-dialog-entering");
      byId("context-dialog-cancel").focus();
    } else {
      void dialog.offsetWidth;
      window.requestAnimationFrame(() => {
        if (dialog.open && !dialog.classList.contains("is-dialog-closing")) {
          dialog.classList.remove("is-dialog-entering");
          byId("context-dialog-cancel").focus();
        }
      });
    }
    return new Promise((resolve) => {
      state.confirmResolver = resolve;
    });
  }

  function closeConfirmDialog(value, options = {}) {
    const dialog = byId("context-dialog");
    if (!dialog.open) {
      return;
    }
    state.dialogCloseCleanup?.();
    state.dialogCloseCleanup = null;
    const generation = state.dialogMotionGeneration + 1;
    state.dialogMotionGeneration = generation;
    const finish = () => {
      if (generation !== state.dialogMotionGeneration) {
        return;
      }
      state.dialogCloseCleanup?.();
      state.dialogCloseCleanup = null;
      dialog.classList.remove("is-dialog-entering", "is-dialog-closing");
      if (dialog.open) {
        dialog.close(value);
      }
    };
    if (transferMotionShouldBeImmediate(options)) {
      finish();
      return;
    }
    dialog.returnValue = value;
    dialog.classList.remove("is-dialog-entering");
    dialog.classList.add("is-dialog-closing");
    const windowNode = dialog.querySelector(".context-dialog-window");
    const onTransitionEnd = (event) => {
      if (event.target === windowNode && event.propertyName === "opacity") {
        finish();
      }
    };
    const timeout = window.setTimeout(finish, TRANSFER_DIALOG_MOTION_MS + 60);
    windowNode?.addEventListener("transitionend", onTransitionEnd);
    state.dialogCloseCleanup = () => {
      window.clearTimeout(timeout);
      windowNode?.removeEventListener("transitionend", onTransitionEnd);
    };
  }

  function resolveConfirm(confirmed) {
    const resolver = state.confirmResolver;
    state.confirmResolver = null;
    resolver?.(Boolean(confirmed));
  }

  async function discardAndReloadSettings() {
    const confirmed = await confirmAction({
      title: "载入服务器最新设置",
      message: "本页尚未保存的配额输入会被服务器最新值替换。",
      details: ["此操作只丢弃本页草稿，不会修改服务器设置。"],
      confirmLabel: "放弃本页草稿并载入"
    });
    if (!confirmed) {
      return;
    }
    try {
      const payload = await api("/api/admin/transfer/settings");
      applySettings(payload.settings, { force: true });
      notice("已载入服务器最新设置。");
    } catch (error) {
      notice(error.message, true);
    }
  }

  async function keepSettingsDraftAgainstLatest() {
    if (!state.settingsDirty) {
      await discardAndReloadSettings();
      return;
    }
    const confirmed = await confirmAction({
      title: "保留本页输入并准备覆盖",
      message: "系统只会更新本页的并发版本基线，不会立即保存。再次点击“保存设置”时，本页输入将覆盖服务器最新设置。",
      details: [
        "本页当前输入会完整保留。",
        "其他页面刚刚保存的同名设置可能被覆盖。",
        "取消是安全默认，不会修改任何数据。"
      ],
      confirmLabel: "确认准备覆盖"
    });
    if (!confirmed) {
      return;
    }
    try {
      const payload = await api("/api/admin/transfer/settings");
      state.settings = payload.settings;
      state.settingsVersion = payload.settings?.updatedAt || null;
      byId("settings-conflict").hidden = true;
      syncSettingsDirty();
      notice("已同步服务器版本；请核对输入后再次保存。", true);
    } catch (error) {
      notice(error.message, true);
    }
  }

  async function protectRefresh() {
    if (state.settingsDirty) {
      const confirmed = await confirmAction({
        title: "刷新全部互传数据",
        message: "刷新会用服务器设置替换本页尚未保存的配额输入。",
        details: ["未保存的设置草稿将丢失。", "文件、房间和上传数据不会被修改。"],
        confirmLabel: "放弃草稿并刷新"
      });
      if (!confirmed) {
        return;
      }
    }
    await load({ forceSettings: true });
  }

  async function protectAdminNavigation(event) {
    if (!state.settingsDirty) {
      return;
    }
    event.preventDefault();
    const target = event.currentTarget.href;
    const confirmed = await confirmAction({
      title: "离开互传文件管理",
      message: "普通用户配额还有未保存修改。",
      details: ["离开后本页设置草稿无法恢复。", "服务器现有设置不会改变。"],
      confirmLabel: "放弃草稿并离开"
    });
    if (confirmed) {
      state.settingsDirty = false;
      window.location.assign(target);
    }
  }

  function bindDialog() {
    const dialog = byId("context-dialog");
    byId("context-dialog-cancel").addEventListener("click", () => closeConfirmDialog("cancel"));
    byId("context-dialog-confirm").addEventListener("click", () => closeConfirmDialog("confirm"));
    dialog.addEventListener("close", () => resolveConfirm(dialog.returnValue === "confirm"));
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      closeConfirmDialog("cancel", { immediate: true });
    });
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) {
        closeConfirmDialog("cancel");
      }
    });
  }

  function bind() {
    const restorePointerInputMethod = () => {
      document.body.dataset.inputMethod = "pointer";
    };
    document.addEventListener("pointerdown", restorePointerInputMethod, { capture: true, passive: true });
    document.addEventListener("pointerover", restorePointerInputMethod, { capture: true, passive: true });
    document.addEventListener("pointermove", restorePointerInputMethod, { capture: true, passive: true });
    document.addEventListener("keydown", () => {
      document.body.dataset.inputMethod = "keyboard";
    }, { capture: true });
    bindDialog();
    byId("back-admin").addEventListener("click", protectAdminNavigation);
    byId("refresh").addEventListener("click", protectRefresh);
    byId("notice-retry").addEventListener("click", retryFailedLoads);
    byId("items-previous").addEventListener("click", () => {
      state.itemOffset = Math.max(0, state.itemOffset - state.itemLimit);
      void loadItemRows().catch((error) => {
        if (error?.name !== "AbortError") notice(error.message, true);
      });
    });
    byId("items-next").addEventListener("click", () => {
      state.itemOffset += state.itemLimit;
      void loadItemRows().catch((error) => {
        if (error?.name !== "AbortError") notice(error.message, true);
      });
    });
    byId("cleanup").addEventListener("click", (event) => cleanup(event.currentTarget));
    byId("test-alert").addEventListener("click", (event) => runMutation(
      () => api("/api/admin/transfer/alert/test", { method: "POST", json: {} }),
      { successMessage: "测试报警已创建。", busyTarget: event.currentTarget }
    ));
    byId("normal-switch").addEventListener("click", (event) => toggleUpload("normal", event.currentTarget));
    byId("global-switch").addEventListener("click", (event) => toggleUpload("global", event.currentTarget));
    byId("settings-form").addEventListener("submit", (event) => {
      event.preventDefault();
      void saveSettings(event.submitter || byId("settings-save"));
    });
    byId("settings-form").addEventListener("input", syncSettingsDirty);
    byId("settings-form").addEventListener("change", syncSettingsDirty);
    byId("settings-reload").addEventListener("click", discardAndReloadSettings);
    byId("settings-keep").addEventListener("click", keepSettingsDraftAgainstLatest);
    byId("operation-retry").addEventListener("click", () => {
      const retry = state.retryOperation;
      if (retry) {
        void runMutation(retry, {
          successMessage: "失败对象已重试完成。",
          partialRetry: retry,
          busyTarget: byId("operation-retry")
        });
      }
    });
    byId("operation-dismiss").addEventListener("click", hideOperationResult);
    ["room", "item"].forEach((kind) => {
      byId(`${kind}-search`).addEventListener("input", () => scheduleSearch(kind));
    });
    window.addEventListener("beforeunload", (event) => {
      if (!state.settingsDirty) {
        return;
      }
      event.preventDefault();
      event.returnValue = "";
    });
  }

  function metric(label, value) {
    const node = document.createElement("article");
    node.className = "metric";
    const name = document.createElement("span");
    name.textContent = label;
    const strong = document.createElement("strong");
    strong.textContent = value;
    node.append(name, strong);
    return node;
  }

  function costItem(label, value) {
    const node = document.createElement("div");
    const name = document.createElement("span");
    name.textContent = label;
    const strong = document.createElement("strong");
    strong.textContent = value;
    node.append(name, strong);
    return node;
  }

  function tableRow(values) {
    const row = document.createElement("tr");
    values.forEach((value) => {
      const cell = document.createElement("td");
      if (value instanceof Node) {
        cell.append(value);
      } else {
        cell.textContent = String(value ?? "");
      }
      row.append(cell);
    });
    return row;
  }

  function emptyRow(columns, message) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = columns;
    cell.textContent = message;
    row.append(cell);
    return row;
  }

  function actionCell() {
    const node = document.createElement("div");
    node.className = "actions";
    return node;
  }

  function action(label, danger, handler) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.dataset.mutation = "";
    button.disabled = state.mutationLocked;
    if (danger) {
      button.className = "danger";
    }
    button.addEventListener("click", (event) => handler(event.currentTarget));
    return button;
  }

  function code(value) {
    const node = document.createElement("code");
    node.textContent = value || "";
    return node;
  }

  function bytes(value) {
    const size = Number(value) || 0;
    if (size < 1024) {
      return `${size} B`;
    }
    const units = ["KiB", "MiB", "GiB", "TiB"];
    let number = size / 1024;
    let unit = units[0];
    for (let index = 1; index < units.length && number >= 1024; index += 1) {
      number /= 1024;
      unit = units[index];
    }
    return `${number.toFixed(number >= 10 ? 1 : 2)} ${unit}`;
  }

  function time(value) {
    return value
      ? new Intl.DateTimeFormat("zh-CN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value))
      : "—";
  }

  function expiry(value) {
    if (!value) {
      return "—";
    }
    const remainingMs = new Date(value).getTime() - Date.now();
    if (!Number.isFinite(remainingMs)) {
      return time(value);
    }
    if (remainingMs <= 0) {
      return `${time(value)}（已过期，待清理）`;
    }
    const hours = Math.ceil(remainingMs / 3600000);
    const remaining = hours >= 24 ? `约 ${Math.ceil(hours / 24)} 天` : `约 ${hours} 小时`;
    return `${time(value)}（剩余 ${remaining}）`;
  }

  function itemTypeLabel(row) {
    if (row.item_type === "text") {
      return "加密文字";
    }
    return row.mime_type
      || ({ image: "图片", video: "视频", audio: "音频", pdf: "PDF", file: "文件" })[row.item_type]
      || "文件";
  }

  function itemStatusLabel(value) {
    return ({
      ready: "已保存",
      uploading: "上传中",
      delete_failed: "删除失败，待重试",
      failed: "上传失败",
      deleted: "已删除"
    })[value] || value || "未知";
  }

  function notice(value, error, options = {}) {
    const node = byId("notice");
    const visible = Boolean(value) || options.retry === true;
    const busy = visible && /正在|读取中|保存中|刷新中|重试中/.test(String(value || ""));
    const immediate = transferMotionShouldBeImmediate();
    window.clearTimeout(state.noticeHideTimer);
    state.noticeHideTimer = 0;
    byId("notice-text").textContent = value || "";
    node.classList.toggle("error", Boolean(error));
    node.classList.toggle("is-busy", busy);
    node.classList.toggle("is-loading", busy);
    node.setAttribute("aria-busy", busy ? "true" : "false");
    byId("notice-retry").hidden = !options.retry;
    if (visible) {
      const wasMounted = node.classList.contains("is-mounted");
      node.classList.add("is-mounted");
      if (!wasMounted) {
        node.dataset.visible = "false";
        if (!immediate) {
          void node.offsetWidth;
        }
      }
      node.dataset.visible = "true";
      return;
    }
    node.dataset.visible = "false";
    const unmount = () => {
      state.noticeHideTimer = 0;
      if (node.dataset.visible !== "true") {
        node.classList.remove("is-mounted");
      }
    };
    if (immediate) {
      unmount();
    } else {
      state.noticeHideTimer = window.setTimeout(unmount, 170);
    }
  }

  bind();
  syncSettingsDirty();
  void load();
})();
