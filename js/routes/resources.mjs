export function createResourcesRoute({
  content,
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
}) {
  let quickTransferLoader = null;
  let quickTransferPending = null;
  let quickTransferRouteActive = false;
  let quickTransferLanguage = document.documentElement.lang;

  async function ensureQuickTransferLoader() {
    if (quickTransferLoader) return quickTransferLoader;
    quickTransferPending ||= import("../features/quick-transfer-loader.mjs?v=20260801-whiteboard-calm-sync-r1")
      .then(({ createQuickTransferLoader }) => {
        quickTransferLoader = createQuickTransferLoader();
        quickTransferLoader.setLanguage(quickTransferLanguage);
        if (quickTransferRouteActive) quickTransferLoader.routeEnter();
        return quickTransferLoader;
      })
      .catch((error) => {
        quickTransferPending = null;
        throw error;
      });
    return quickTransferPending;
  }

  const quickTransfer = Object.freeze({
    async open() {
      const loader = await ensureQuickTransferLoader();
      if (!quickTransferRouteActive) return false;
      return loader.open();
    },
    close(options) {
      quickTransferLoader?.close(options);
    },
    setLanguage(language) {
      quickTransferLanguage = language;
      quickTransferLoader?.setLanguage(language);
    },
    routeEnter() {
      quickTransferRouteActive = true;
      quickTransferLoader?.routeEnter();
    },
    routeLeave() {
      quickTransferRouteActive = false;
      quickTransferLoader?.routeLeave();
    },
    lifecycleSnapshot() {
      return quickTransferLoader?.lifecycleSnapshot() || Object.freeze({
        initialized: false,
        routeActive: quickTransferRouteActive,
        open: false,
        listeners: 0,
        timers: 0,
        requests: 0,
        xhr: 0,
        loader: "idle"
      });
    }
  });

  function safeResourceUrl(item) {
    const value = String(item.url || item.href || item.downloadUrl || "").trim();
    if (!value) return "";
    const httpUrl = safeHttpUrl(value);
    if (httpUrl) return item.external === true ? safeTrustedExternalUrl(value, trustedResourceExternalHosts) : "";
    const localPath = value.replace(/^\/+/, "").replace(/^\.\//, "");
    if (/(^|\/)\.\.(\/|$)/.test(localPath)) return "";
    if (/^tools\/japanese-subtext\/?$/i.test(localPath)) return sitePath("tools/japanese-subtext/");
    if (/^tools\/whiteboard\/?$/i.test(localPath)) {
      const language = ["zh", "en", "ja"].includes(document.documentElement.lang)
        ? document.documentElement.lang
        : "zh";
      return `${sitePath("tools/whiteboard/")}?lang=${encodeURIComponent(language)}`;
    }
    if (/^(assets|downloads)\/[a-z0-9][a-z0-9._/-]*(\?[a-z0-9=&._-]+)?$/i.test(localPath)) return sitePath(localPath);
    return "";
  }

  function resourceActionElement(item, url = safeResourceUrl(item)) {
    const internalAction = item.action === "quick-transfer";
    const available = Boolean(url || internalAction);
    const resourceTitle = available ? localText(item.title) : contentTitle(item.title);
    const customLabel = localText(item.actionLabel).trim();
    const text = available ? customLabel || (item.external ? t("externalButton") : t("downloadButton")) : t("resourcePending");
    if (!available) {
      const status = document.createElement("span");
      status.className = "card-action resource-pending-action";
      status.setAttribute("role", "status");
      status.setAttribute("aria-label", `${t("resourcePendingTitle")}: ${resourceTitle}`);
      status.setAttribute("title", t("resourcePendingTitle"));
      status.textContent = text;
      return status;
    }
    if (internalAction) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "card-action";
      button.dataset.quickTransferOpen = "true";
      button.textContent = text;
      button.setAttribute("aria-label", `${text}: ${resourceTitle}`);
      return button;
    }
    const link = document.createElement("a");
    link.className = "card-action";
    link.href = url;
    link.textContent = text;
    link.setAttribute("aria-label", `${text}: ${resourceTitle}`);
    if (/\/tools\/whiteboard\/$/i.test(new URL(url, location.origin).pathname)) {
      link.dataset.analyticsLabel = "tools:whiteboard:open";
    }
    if (item.external || /^https?:\/\//i.test(url)) {
      link.target = "_blank";
      link.rel = "noreferrer noopener";
    }
    return link;
  }

  function resourceStatusElement(url, title) {
    const status = document.createElement("span");
    status.className = `tag resource-status-tag ${url ? "is-ready" : "is-pending"}`;
    const text = url ? t("resourceStatusReady") : t("resourcePending");
    status.textContent = text;
    status.setAttribute("aria-label", `${text}: ${title}`);
    status.setAttribute("title", `${text}: ${title}`);
    return status;
  }

  function resourceEmptyStateElement({ hasAnyReady = true } = {}) {
    const state = document.createElement("div");
    state.className = "resource-empty-state";
    state.classList.add("content-state", "is-empty");
    state.setAttribute("role", "status");
    state.setAttribute("aria-live", "polite");
    state.setAttribute("aria-atomic", "true");
    const icon = document.createElement("span");
    icon.className = "resource-empty-icon";
    icon.setAttribute("aria-hidden", "true");
    const copy = document.createElement("div");
    copy.className = "resource-empty-copy";
    const title = document.createElement("h2");
    title.textContent = hasAnyReady ? t("resourceEmptyTitle") : t("resourceEmptyAllTitle");
    const body = document.createElement("p");
    body.textContent = hasAnyReady ? t("resourceEmptyBody") : t("resourceEmptyAllBody");
    copy.append(title, body);
    const action = document.createElement("button");
    action.type = "button";
    action.className = "xp-button";
    if (hasAnyReady) {
      action.dataset.resourceShowAll = "true";
      action.textContent = t("resourceEmptyAction");
    } else {
      action.dataset.route = "knowledge";
      action.textContent = t("resourceEmptyAllAction");
    }
    state.append(icon, copy, action);
    return state;
  }

  function readyResourceItems() {
    return content.resources.filter((item) => safeResourceUrl(item) || item.action === "quick-transfer");
  }

  function resourceCardElement(item) {
    const card = document.createElement("article");
    card.className = "resource-card";
    const resourceUrl = safeResourceUrl(item);
    const resourceAvailable = Boolean(resourceUrl || item.action === "quick-transfer");
    const main = document.createElement("div");
    main.className = "resource-main";
    const title = document.createElement("h2");
    const resourceIconSrc = safeResourceIconSrc(item.iconSrc);
    const icon = resourceIconSrc ? document.createElement("img") : document.createElement("span");
    icon.className = resourceIconSrc
      ? "resource-icon-image"
      : item.iconSprite === "app" ? "resource-icon transfer-icon transfer-icon-app" : "resource-icon";
    icon.setAttribute("aria-hidden", "true");
    if (resourceIconSrc) {
      icon.src = resourceIconSrc;
      icon.width = 40;
      icon.height = 40;
      icon.alt = "";
      icon.loading = "lazy";
      icon.decoding = "async";
    } else {
      icon.textContent = String(item.icon || "");
    }
    const resourceTitle = resourceAvailable ? localText(item.title) : contentTitle(item.title);
    title.append(icon, document.createTextNode(resourceTitle));
    const desc = document.createElement("p");
    desc.className = "resource-description";
    desc.textContent = localText(item.desc);
    const facts = document.createElement("div");
    facts.className = "resource-facts";
    const metaItems = [`${label("type")}: ${label("resourceCategories")[item.category] || ""}`];
    if (resourceAvailable) {
      if (item.version) metaItems.push(`${label("version")}: ${item.version}`);
      if (item.retention) metaItems.push(`${label("retention")}: ${localText(item.retention)}`);
      if (item.size) metaItems.push(`${label("size")}: ${item.size}`);
      if (item.updated) metaItems.push(`${label("updated")}: ${item.updated}`);
    }
    metaItems.forEach((text) => {
      const itemNode = document.createElement("span");
      itemNode.className = "resource-fact";
      itemNode.textContent = text;
      facts.appendChild(itemNode);
    });
    const tags = document.createElement("div");
    tags.className = "meta-row resource-tags";
    (Array.isArray(item.tags) ? item.tags : []).slice(0, 6).forEach((tag) => {
      const tagNode = document.createElement("span");
      tagNode.className = "tag";
      tagNode.textContent = localText(tag);
      tags.appendChild(tagNode);
    });
    if (item.showReadyStatus === true) tags.appendChild(resourceStatusElement(resourceAvailable, resourceTitle));
    main.append(title, desc, facts);
    card.append(main, resourceActionElement(item, resourceUrl), tags);
    return card;
  }

  function renderResourceCategoryButtons(items = readyResourceItems()) {
    const target = document.getElementById("resource-categories");
    const activeFilterButton = document.activeElement?.closest?.('[data-filter-type="resources"]');
    const focusFilter = activeFilterButton && target.contains(activeFilterButton)
      ? String(activeFilterButton.dataset.filter || "")
      : "";
    const categories = label("resourceCategories");
    const counts = new Map(categories.map((_, index) => [String(index), 0]));
    items.forEach((item) => {
      const key = String(item.category);
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    const availableCategoryValues = [...counts.entries()]
      .filter(([, count]) => count > 0)
      .map(([value]) => value);
    if (availableCategoryValues.length <= 1) {
      activeFilters.resources = "all";
      target.hidden = true;
      target.replaceChildren();
      return;
    }
    target.hidden = false;
    const entries = [
      { name: t("all"), value: "all", count: items.length },
      ...categories.map((name, index) => ({ name, value: String(index), count: counts.get(String(index)) || 0 }))
        .filter((entry) => entry.count > 0 || activeFilters.resources === entry.value)
    ];
    const buttons = entries.map((entry) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.filterType = "resources";
      button.dataset.filter = entry.value;
      button.classList.toggle("active", activeFilters.resources === entry.value);
      button.setAttribute("aria-pressed", String(activeFilters.resources === entry.value));
      button.setAttribute("aria-label", `${entry.name} ${entry.count}`);
      const name = document.createElement("span");
      name.textContent = entry.name;
      const count = document.createElement("span");
      count.className = "filter-count";
      count.textContent = String(entry.count);
      button.append(name, count);
      return button;
    });
    target.replaceChildren(...buttons);
    if (focusFilter) {
      buttons.find((button) => button.dataset.filter === focusFilter)?.focus({ preventScroll: true });
    }
  }

  function renderResources() {
    const list = document.getElementById("resource-list");
    const readyItems = readyResourceItems();
    if (activeFilters.resources !== "all" && !readyItems.some((item) => String(item.category) === activeFilters.resources)) {
      activeFilters.resources = "all";
    }
    renderResourceCategoryButtons(readyItems);
    const items = readyItems.filter((item) => activeFilters.resources === "all" || String(item.category) === activeFilters.resources);
    list.replaceChildren();
    if (items.length === 0) {
      list.appendChild(resourceEmptyStateElement({ hasAnyReady: readyItems.length > 0 }));
      return;
    }
    items.forEach((item) => list.appendChild(resourceCardElement(item)));
  }

  return Object.freeze({ safeResourceUrl, readyResourceItems, renderResources, renderResourceCategoryButtons, quickTransfer });
}
