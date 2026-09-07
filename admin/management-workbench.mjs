// Pagination state stays in this tab. No account data or message content is persisted.
export function managementListUrl(endpoint, { page = 1, pageSize = 50, query = "", filters = {}, offsetMode = false } = {}) {
  const safeSize = Number.isFinite(Number(pageSize)) ? Math.min(500, Math.max(1, Math.trunc(Number(pageSize)))) : 50;
  const safePage = Number.isFinite(Number(page)) ? Math.min(Math.floor(Number.MAX_SAFE_INTEGER / safeSize), Math.max(1, Math.trunc(Number(page)))) : 1;
  const params = new URLSearchParams(filters);
  if (offsetMode) {
    params.set("limit", String(safeSize));
    params.set("offset", String((safePage - 1) * safeSize));
  } else {
    params.set("page", String(safePage));
    params.set("pageSize", String(safeSize));
    if (query.trim()) params.set("q", query.trim());
  }
  return `${endpoint}?${params}`;
}

export function createManagementWorkbench(configs, { guard, reportError }) {
  const entries = new Map();
  for (const [kind, config] of Object.entries(configs)) {
    const list = document.getElementById(config.listId);
    if (!list) continue;
    const controls = document.createElement("div");
    controls.className = "management-pagination";
    controls.setAttribute("aria-label", `${config.label}分页`);
    const previous = document.createElement("button");
    const next = document.createElement("button");
    const info = document.createElement("span");
    info.setAttribute("role", "status");
    for (const button of [previous, next]) { button.type = "button"; button.className = "xp-button"; button.disabled = true; }
    previous.textContent = "上一页";
    next.textContent = "下一页";
    controls.append(previous, info, next);
    list.after(controls);
    const entry = { config, page: 1, pageSize: 50, previous, next, info, controls, loading: false, request: null, sequence: 0, timer: null, filter: null, accepted: null, pendingReload: false };
    entries.set(kind, entry);
    previous.addEventListener("click", () => reload(kind, entry.page - 1));
    next.addEventListener("click", () => reload(kind, entry.page + 1));
    if (config.options) {
      const label = document.createElement("label");
      label.className = "management-filter";
      label.append(`${config.label}状态`);
      const select = document.createElement("select");
      for (const [value, text] of config.options) {
        const option = document.createElement("option");
        option.value = value; option.textContent = text; select.append(option);
      }
      label.append(select); list.before(label); entry.filter = select;
      select.addEventListener("change", async () => {
        if (!await reload(kind, 1)) select.value = entry.accepted?.filterValue || "";
      });
    }
  }

  function syncControls(entry) {
    const busy = entry.loading || Boolean(entry.request);
    entry.controls.setAttribute("aria-busy", String(busy));
    entry.previous.disabled = busy || (entry.accepted?.previousDisabled ?? true);
    entry.next.disabled = busy || (entry.accepted?.nextDisabled ?? true);
    if (entry.filter) entry.filter.disabled = busy;
  }

  function currentQuery(entry) {
    return managementListUrl(entry.config.endpoint, {
      page: entry.page, pageSize: entry.pageSize, query: entry.config.query?.() || "",
      filters: { ...entry.config.extras?.(), ...(entry.filter ? { [entry.config.filterKey]: entry.filter.value } : {}) },
      offsetMode: entry.config.offsetMode
    });
  }

  function drain(kind, entry) {
    if (!entry.pendingReload || entry.loading || entry.request || entry.timer) return;
    entry.pendingReload = false;
    // Run the latest search after the active read/guard settles; never drop it.
    void reload(kind, 1, true);
  }

  function restore(entry, message) {
    entry.page = entry.accepted?.page || 1;
    entry.pageSize = entry.accepted?.pageSize || 50;
    if (entry.filter) entry.filter.value = entry.accepted?.filterValue || "";
    entry.info.textContent = `${entry.accepted?.text || "尚未读取列表"}${message ? ` · ${message}` : ""}`;
  }

  async function reload(kind, page = 1, queueIfBusy = false) {
    const entry = entries.get(kind);
    if (!entry) return false;
    if (entry.loading || entry.request) {
      if (queueIfBusy) entry.pendingReload = true;
      return false;
    }
    // Lock before awaiting the dirty-form guard so two clicks cannot open two reads.
    entry.loading = true;
    syncControls(entry);
    try {
      if (!await guard(entry.config.panel, "调整筛选或翻页会离开当前列表，请先处理未保存内容。")) {
        restore(entry, "筛选尚未应用");
        return false;
      }
      entry.page = Math.max(1, page);
      entry.info.textContent = "正在读取…";
      const result = await entry.config.load();
      if (result === false) { restore(entry, "读取未完成，请重试"); return false; }
      return true;
    } catch (error) {
      restore(entry, "读取失败，保留上次结果，可重试");
      reportError(error);
      return false;
    } finally {
      entry.loading = false;
      syncControls(entry);
      drain(kind, entry);
    }
  }

  function accept(kind, payload, ticket = null) {
    const entry = entries.get(kind);
    if (!entry || (ticket && entry.request !== ticket)) return false;
    const pagination = payload.pagination || {};
    const rawTotal = pagination.total ?? payload.total;
    const hasTotal = rawTotal != null && Number.isFinite(Number(rawTotal)) && Number(rawTotal) >= 0;
    const total = hasTotal ? Number(rawTotal) : 0;
    const size = Math.max(1, Number(pagination.pageSize || pagination.limit) || entry.pageSize);
    const pages = Math.max(1, Number(pagination.totalPages) || Math.ceil(total / size));
    const page = Number(pagination.page) || (pagination.offset != null ? Math.floor(Number(pagination.offset) / size) + 1 : ticket?.page || entry.page);
    const text = hasTotal ? `第 ${page} / ${pages} 页 · 共 ${total} 条`
      : `第 ${page} 页${entry.config.offsetMode ? " · 搜索仅筛选本页" : ""}`;
    entry.page = page;
    entry.pageSize = size;
    entry.accepted = { page, pageSize: size, text, filterValue: ticket?.filterValue ?? entry.filter?.value ?? "", previousDisabled: page <= 1,
      nextDisabled: hasTotal ? (pagination.hasMore === false || page >= pages) : !(pagination.hasMore ?? payload.hasMore) };
    entry.info.textContent = text;
    syncControls(entry);
    return true;
  }

  return {
    query(kind) { const entry = entries.get(kind); return entry ? currentQuery(entry) : null; },
    // Direct refresh and pager reads share a ticket so late responses cannot roll back results.
    begin(kind) {
      const entry = entries.get(kind);
      if (!entry) return null;
      const ticket = { sequence: ++entry.sequence, page: entry.page, filterValue: entry.filter?.value || "", url: currentQuery(entry) };
      entry.request = ticket;
      syncControls(entry);
      return {
        url: ticket.url,
        isCurrent: () => entry.request === ticket,
        accept: (payload) => accept(kind, payload, ticket),
        finish(error = null) {
          if (entry.request !== ticket) return;
          entry.request = null;
          if (error) restore(entry, "读取失败，保留上次结果，可重试");
          syncControls(entry);
          drain(kind, entry);
        }
      };
    },
    accept,
    schedule(kind) {
      const entry = entries.get(kind);
      if (!entry) return;
      clearTimeout(entry.timer);
      entry.timer = setTimeout(() => { entry.timer = null; void reload(kind, 1, true); }, 350);
    },
    reset(kind) { const entry = entries.get(kind); if (entry) entry.page = 1; }
  };
}
