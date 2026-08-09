const articleImageDimensionMap = Object.freeze({
  "assets/images/articles/ai-agent-codex-project-brief.png": Object.freeze({ width: 1910, height: 1226 }),
  "assets/images/articles/ai-agent-codex-update-thread.png": Object.freeze({ width: 1910, height: 1226 }),
  "assets/images/articles/ai-agent-gpt-chatroom-prompt.png": Object.freeze({ width: 1745, height: 1465 }),
  "assets/images/articles/ai-agent-gpt-project-context.png": Object.freeze({ width: 1539, height: 1349 }),
  "assets/images/articles/tool-radar/2026-07-28/60fps-official-gallery.webp": Object.freeze({ width: 1280, height: 800 }),
  "assets/images/articles/tool-radar/2026-07-28/mobbin-official-patterns.webp": Object.freeze({ width: 1440, height: 900 }),
  "assets/images/articles/tool-radar/2026-07-28/chatcut-official-ai-timeline.webp": Object.freeze({ width: 1440, height: 900 }),
  "assets/images/articles/tool-radar/2026-07-28/remotion-official-studio.webp": Object.freeze({ width: 1440, height: 810 }),
  "assets/images/articles/tool-radar/2026-07-28/repomix-official-browser-pack.webp": Object.freeze({ width: 1280, height: 800 }),
  "assets/images/articles/tool-radar/2026-07-28/context7-official-doc-chat.webp": Object.freeze({ width: 1020, height: 1554 }),
  "assets/images/articles/tool-radar/2026-07-28/pinokio-official-install-check.webp": Object.freeze({ width: 1440, height: 825 }),
  "assets/images/articles/site-guides/password-room-chat-desktop.png": Object.freeze({ width: 1440, height: 900 }),
  "assets/images/articles/site-guides/password-room-chat-mobile.png": Object.freeze({ width: 390, height: 844 }),
  "assets/images/articles/site-guides/password-room-whiteboard-desktop.png": Object.freeze({ width: 1440, height: 900 }),
  "assets/images/articles/site-guides/password-room-whiteboard-mobile.png": Object.freeze({ width: 390, height: 844 })
});

export const PUBLIC_ARTICLE_ARCHIVE_LIMIT = 500;

export function normalizeArticleHeadingAnchor(text) {
  const normalized = String(text || "")
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[’']/gu, "")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return `article-${normalized || "section"}`;
}

export function deduplicateArticleHeadingAnchors(texts) {
  const counts = new Map();
  return [...texts].map((text) => {
    const base = normalizeArticleHeadingAnchor(text);
    const occurrence = (counts.get(base) || 0) + 1;
    counts.set(base, occurrence);
    return occurrence === 1 ? base : `${base}-${occurrence}`;
  });
}

export function articleImageDimensions(src) {
  const key = String(src || "").split("?", 1)[0];
  return articleImageDimensionMap[key] || null;
}

export function safeArticleLinkHref(value) {
  const raw = String(value || "").trim();
  if (!/^https:\/\//i.test(raw)) {
    return "";
  }
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password) {
      return "";
    }
    return url.href;
  } catch {
    return "";
  }
}

export function normalizeKnowledgeSearchText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/\s+/gu, " ")
    .trim();
}

export function knowledgeSearchTokens(value) {
  const normalized = normalizeKnowledgeSearchText(value);
  return normalized ? normalized.split(" ") : [];
}

export function articleLanguageTag(value) {
  const lang = String(value || "").trim().toLowerCase();
  if (lang === "zh" || lang === "zh-cn") return "zh-CN";
  if (lang === "en") return "en";
  if (lang === "ja") return "ja";
  return "";
}

export function articleDetailShowsSummary(category) {
  return String(category || "") !== "daily-ai-news";
}

export function articleTocHeadingSelector(category) {
  return String(category || "") === "daily-ai-news" ? "h4" : "h2, h3";
}

export function articleReadProgressPercent({
  scrollTop = 0,
  clientHeight = 0,
  contentEnd = 0,
  endInset = 24
} = {}) {
  const readableDistance = Math.max(
    0,
    Number(contentEnd || 0) - Number(clientHeight || 0) + Number(endInset || 0)
  );
  if (readableDistance <= 1) {
    return 100;
  }
  return Math.min(100, Math.max(0, (Number(scrollTop || 0) / readableDistance) * 100));
}

export function knowledgeArticlesForCategory(
  items,
  activeCategory,
  siteUpdateCategory = "site-updates"
) {
  const category = String(activeCategory || "all");
  const updatesCategory = String(siteUpdateCategory || "site-updates");
  const articles = Array.isArray(items) ? items : [];
  if (category === "all") {
    return articles.filter((item) => String(item?.category || "") !== updatesCategory);
  }
  return articles.filter((item) => String(item?.category || "") === category);
}

export function sortKnowledgeArticles(items) {
  return [...items].sort((left, right) => {
    const isPinned = (item) => item?.category !== "site-updates" && Boolean(item?.is_pinned);
    const pinnedDelta = Number(isPinned(right)) - Number(isPinned(left));
    if (pinnedDelta) {
      return pinnedDelta;
    }
    const rightDate = Date.parse(right?.published_at || right?.created_at || 0) || 0;
    const leftDate = Date.parse(left?.published_at || left?.created_at || 0) || 0;
    if (rightDate !== leftDate) {
      return rightDate - leftDate;
    }
    return String(right?.slug || "").localeCompare(String(left?.slug || ""));
  });
}

export function knowledgeCategoryValues(items, {
  fixedCategories = [],
  firstCategory = "",
  lastCategory = "",
  labelFor = (value) => String(value || "")
} = {}) {
  const categories = [
    ...new Set([
      ...fixedCategories,
      ...(Array.isArray(items) ? items : []).map((item) => item?.category)
    ].filter(Boolean))
  ];
  const priorityCategories = [
    ...new Set([firstCategory, ...fixedCategories].filter(Boolean))
  ];
  return categories.sort((left, right) => {
    if (left === right) return 0;
    if (left === lastCategory) return 1;
    if (right === lastCategory) return -1;
    const leftPriority = priorityCategories.indexOf(left);
    const rightPriority = priorityCategories.indexOf(right);
    if (leftPriority !== rightPriority) {
      if (leftPriority === -1) return 1;
      if (rightPriority === -1) return -1;
      return leftPriority - rightPriority;
    }
    return labelFor(left).localeCompare(labelFor(right));
  });
}

export function createKnowledgeRoute({
  articleState,
  activeFilters,
  siteUpdateCategory,
  dailyAiNewsCategory,
  toolRadarCategory,
  siteGuidesCategory,
  getCurrentLang,
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
  requestJson,
  sitePath,
  schedulePublicHistoryStateSync
}) {
  function applyArticleLanguage(node, lang) {
    if (!node) return;
    const languageTag = articleLanguageTag(lang);
    if (languageTag) {
      node.setAttribute("lang", languageTag);
    } else {
      node.removeAttribute("lang");
    }
  }

  function resetKnowledgeListScroll({ syncHistory = false } = {}) {
    articleState.pendingListScrollTop = null;
    const list = document.getElementById("knowledge-list");
    if (list) {
      list.scrollTop = 0;
    }
    if (syncHistory
      && document.body.dataset.route === "knowledge"
      && !articleState.currentSlug) {
      replaceCurrentPublicHistoryState({
        knowledge: normalizeKnowledgeHistorySnapshot({
          category: activeFilters.knowledge,
          searchTerm: articleState.searchTerm,
          scrollTop: 0
        }),
        articleScrollTop: 0
      });
    }
  }

  function restorePendingKnowledgeScroll() {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (document.body.dataset.route !== "knowledge") {
          return;
        }
        if (articleState.currentSlug) {
          if (articleState.pendingDetailScrollTop === null || !articleState.detailFocusReady) {
            return;
          }
          const detail = document.getElementById("article-detail");
          if (!detail || detail.hidden) {
            return;
          }
          detail.scrollTop = boundedHistoryScrollTop(articleState.pendingDetailScrollTop);
          articleState.pendingDetailScrollTop = null;
          scheduleArticleReadProgressUpdate();
          return;
        }
        if (articleState.pendingListScrollTop === null) {
          return;
        }
        const list = document.getElementById("knowledge-list");
        if (!list || list.hidden) {
          return;
        }
        if (articleState.loading) {
          return;
        }
        const target = boundedHistoryScrollTop(articleState.pendingListScrollTop);
        list.scrollTop = target;
        articleState.pendingListScrollTop = null;
      });
    });
  }

  function renderKnowledge() {
    const list = document.getElementById("knowledge-list");
    const detail = document.getElementById("article-detail");
    const layout = document.querySelector("#knowledge .folder-layout");
    const searchBar = document.getElementById("knowledge-searchbar");
    const categories = knowledgeCategoryValues(articleState.articles, {
      fixedCategories: [dailyAiNewsCategory, toolRadarCategory, siteGuidesCategory],
      firstCategory: dailyAiNewsCategory,
      lastCategory: siteUpdateCategory,
      labelFor: articleCategoryName
    });

    if (articleState.currentSlug) {
      if (searchBar) {
        searchBar.hidden = true;
      }
      document.body.classList.add("is-article-reading");
      layout?.classList.add("is-reading");
      list.hidden = true;
      detail.hidden = false;
      const detailKey = `${articleState.currentSlug}:${getCurrentLang()}`;
      if (articleState.currentArticle && articleState.currentArticle.slug === articleState.currentSlug && articleState.currentArticle.requestedLang === getCurrentLang()) {
        renderArticleDetail(articleState.currentArticle);
      } else if (articleState.detailCache.has(detailKey)) {
        articleState.currentArticle = articleState.detailCache.get(detailKey);
        renderArticleDetail(articleState.currentArticle);
      } else if (articleState.detailLoadingKey !== detailKey) {
        loadArticleDetail(articleState.currentSlug);
      }
      restorePendingKnowledgeScroll();
      return;
    }

    if (searchBar) {
      searchBar.hidden = false;
    }
    document.body.classList.remove("is-article-reading");
    layout?.classList.remove("is-reading");
    renderKnowledgeCategoryButtons(categories);
    list.hidden = false;
    detail.hidden = true;
    restorePendingKnowledgeScroll();
    if (articleState.loading && !articleState.articles.length) {
      renderKnowledgeSearchControls(null, null);
      renderArticleSkeletons(list);
      return;
    }
    if (articleState.error && !articleState.articles.length) {
      renderKnowledgeSearchControls(null, null);
      renderListMessage(list, t("articleLoadFailed"), {
        label: t("articleRetryAction"),
        dataset: { articleRetry: "" },
        state: "error"
      });
      return;
    }

    const categoryItems = knowledgeArticlesForCategory(
      articleState.articles,
      activeFilters.knowledge,
      siteUpdateCategory
    );
    const items = categoryItems.filter(articleMatchesSearch);
    renderKnowledgeSearchControls(items.length, categoryItems.length);
    if (!items.length) {
      const hasSearchTerm = Boolean(String(articleState.searchTerm || "").trim());
      if (
        activeFilters.knowledge === dailyAiNewsCategory
        && !hasSearchTerm
      ) {
        renderListMessage(list, t("dailyAiNewsEmpty"));
        return;
      }
      if (
        activeFilters.knowledge === toolRadarCategory
        && !hasSearchTerm
      ) {
        renderListMessage(list, t("toolRadarEmpty"));
        return;
      }
      if (
        activeFilters.knowledge === siteGuidesCategory
        && !hasSearchTerm
      ) {
        renderListMessage(list, t("siteGuidesEmpty"));
        return;
      }
      if (!articleState.articles.length) {
        renderListMessage(list, t("articleEmpty"));
        return;
      }
      renderListMessage(list, t("articleSearchNoResults"), {
        label: t("articleSearchReset"),
        dataset: { articleSearchReset: "" },
        state: "empty"
      });
      return;
    }

    renderArticleCollection(list, items);
    if (articleState.loading) {
      list.appendChild(articleListNotice(t("articleRefreshing"), null, "is-loading"));
    } else if (articleState.error) {
      list.appendChild(articleListNotice(t("articleRefreshFailed"), {
        label: t("articleRetryAction"),
        dataset: { articleRetry: "" }
      }, "is-error"));
    }
  }

  function renderArticleSkeletons(list) {
    const label = document.createElement("p");
    label.className = "content-state is-loading loading-text knowledge-skeleton-label";
    label.textContent = t("articleLoading");
    markStatusMessage(label);
    const skeletons = Array.from({ length: 6 }, () => {
      const skeleton = document.createElement("div");
      skeleton.className = "article-card article-card-skeleton";
      skeleton.setAttribute("aria-hidden", "true");
      skeleton.append(Object.assign(document.createElement("span"), { className: "skeleton-lines" }));
      return skeleton;
    });
    list.replaceChildren(label, ...skeletons);
  }

  function articleListNotice(message, action = null, modifier = "") {
    const notice = document.createElement("div");
    notice.className = `content-state knowledge-list-notice ${modifier}`.trim();
    const copy = document.createElement("p");
    copy.className = "content-state-copy";
    copy.textContent = message;
    markStatusMessage(copy, modifier === "is-error" ? "error" : "status");
    notice.appendChild(copy);
    if (action) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "xp-button";
      button.textContent = action.label;
      Object.entries(action.dataset || {}).forEach(([key, value]) => {
        button.dataset[key] = value;
      });
      notice.appendChild(button);
    }
    return notice;
  }

  function renderArticleCollection(list, items) {
    const visibleCount = Math.max(12, Number(articleState.visibleCount || 12));
    const visibleItems = items.slice(0, visibleCount);
    const cards = visibleItems.map((item, index) => articleCardElement(item, index));
    if (visibleItems.length < items.length) {
      const controls = document.createElement("div");
      controls.className = "knowledge-list-more";
      const status = document.createElement("p");
      status.textContent = t("articleShowingCount")
        .replace("{count}", String(visibleItems.length))
        .replace("{total}", String(items.length));
      const button = document.createElement("button");
      button.type = "button";
      button.className = "xp-button";
      button.dataset.articleLoadMore = "";
      button.textContent = t("articleLoadMore");
      controls.append(status, button);
      cards.push(controls);
    }
    list.replaceChildren(...cards);
  }

  function renderListMessage(list, message, action = null) {
    const state = document.createElement("div");
    const note = document.createElement("p");
    const stateKind = action?.state === "error" ? "error" : "empty";
    state.className = `content-state is-${stateKind}`;
    note.className = "content-state-copy loading-text";
    note.textContent = message;
    markStatusMessage(state, stateKind === "error" ? "error" : "status");
    state.appendChild(note);
    if (!action) {
      list.replaceChildren(state);
      return;
    }
    const button = document.createElement("button");
    button.type = "button";
    button.className = "xp-button";
    button.textContent = action.label;
    Object.entries(action.dataset || {}).forEach(([key, value]) => {
      button.dataset[key] = value;
    });
    state.appendChild(button);
    list.replaceChildren(state);
  }

  function articleCardElement(item, itemIndex = 0) {
    const card = document.createElement("a");
    card.className = "article-card";
    applyArticleLanguage(card, item.lang);
    const titleText = item.title || "";
    card.href = articleRouteHref(item.slug);
    card.dataset.articleSlug = item.slug;
    card.dataset.articleListPosition = String(itemIndex);

    const title = document.createElement("h2");
    title.id = `knowledge-article-title-${itemIndex}`;
    title.textContent = titleText;
    applyArticleLanguage(title, item.lang);
    card.setAttribute("aria-labelledby", title.id);
    const summary = document.createElement("p");
    summary.textContent = item.summary || "";
    applyArticleLanguage(summary, item.lang);

    const meta = document.createElement("div");
    meta.className = "meta-row";
    applyArticleLanguage(meta, getCurrentLang());
    if (item.category !== siteUpdateCategory && item.is_pinned) {
      const pinned = document.createElement("span");
      pinned.className = "tag article-pinned-badge";
      pinned.textContent = t("articlePinned");
      meta.appendChild(pinned);
    }
    const category = document.createElement("span");
    category.textContent = `${t("articleCategory")}: ${articleCategoryName(item.category || "note")}`;
    meta.appendChild(category);
    (item.tags || []).forEach((tag) => {
      const tagNode = document.createElement("span");
      tagNode.className = "tag";
      tagNode.textContent = articleTagName(tag);
      meta.appendChild(tagNode);
    });
    const publishedValue = item.published_at || item.created_at;
    const published = document.createElement("time");
    published.dateTime = publishedValue || "";
    published.title = formatArticleDate(publishedValue);
    published.textContent = `${t("articlePublished")}: ${formatArticleDate(publishedValue, { includeSeconds: false })}`;
    meta.appendChild(published);
    if (item.lang !== getCurrentLang()) {
      const fallback = document.createElement("span");
      fallback.className = "tag";
      fallback.textContent = t("articleFallback");
      meta.appendChild(fallback);
    }

    const action = document.createElement("span");
    action.className = "article-card-cta";
    action.textContent = t("readButton");
    action.setAttribute("aria-hidden", "true");
    applyArticleLanguage(action, getCurrentLang());

    card.append(title, summary, meta, action);
    return card;
  }

  function renderKnowledgeSearchControls(count, total) {
    const input = document.getElementById("knowledge-search-input");
    const clearButton = document.querySelector("[data-article-search-clear]");
    const searchBar = document.getElementById("knowledge-searchbar");
    const status = document.getElementById("knowledge-search-status");
    const setSearchStatus = (value) => {
      if (!status) {
        return;
      }
      status.textContent = value;
      searchBar?.classList.toggle("has-search-status", Boolean(value));
      requestMobileFocusReveal("knowledge-search-status");
    };
    if (input && input.value !== articleState.searchTerm) {
      input.value = articleState.searchTerm;
    }
    if (clearButton) {
      clearButton.disabled = !articleState.searchTerm.trim();
    }
    if (!status) {
      return;
    }
    if (typeof count !== "number" || typeof total !== "number") {
      setSearchStatus("");
      return;
    }
    if (!articleState.searchTerm.trim()) {
      setSearchStatus("");
      return;
    }
    setSearchStatus(t("articleSearchFiltered")
      .replace("{count}", String(count))
      .replace("{total}", String(total)));
  }

  function rebuildArticleSearchIndex() {
    articleState.searchIndex = new Map(articleState.articles.map((item) => [
      item.slug,
      normalizeKnowledgeSearchText([
        item.title,
        item.summary,
        item.slug,
        item.category,
        articleCategoryName(item.category || "note"),
        ...(item.tags || []),
        ...(item.tags || []).map(articleTagName)
      ].join(" "))
    ]));
    articleState.searchIndexLanguage = getCurrentLang();
  }

  function articleMatchesSearch(item) {
    const tokens = knowledgeSearchTokens(articleState.searchTerm);
    if (!tokens.length) {
      return true;
    }
    if (articleState.searchIndexLanguage !== getCurrentLang()) {
      rebuildArticleSearchIndex();
    }
    const haystack = articleState.searchIndex.get(item.slug) || "";
    return tokens.every((token) => haystack.includes(token));
  }

  function renderKnowledgeCategoryButtons(categories) {
    const target = document.getElementById("knowledge-categories");
    const counts = new Map(categories.map((category) => [String(category), 0]));
    articleState.articles.forEach((item) => {
      const key = String(item.category || "");
      if (counts.has(key)) {
        counts.set(key, counts.get(key) + 1);
      }
    });

    const buttons = ["all", ...categories].map((category) => {
      const value = String(category);
      const active = activeFilters.knowledge === value;
      const countValue = value === "all"
        ? knowledgeArticlesForCategory(articleState.articles, value, siteUpdateCategory).length
        : counts.get(value) || 0;
      const button = document.createElement("button");
      button.type = "button";
      button.className = `${active ? "active " : ""}category-button`;
      button.dataset.filterType = "knowledge";
      button.dataset.filter = value;
      const labelText = articleCategoryName(value);
      button.title = labelText;
      button.setAttribute("aria-label", `${labelText} ${countValue}`);
      button.setAttribute("aria-pressed", String(active));
      if (active) {
        button.setAttribute("aria-current", "true");
      }
      const labelNode = document.createElement("span");
      labelNode.textContent = labelText;
      const countNode = document.createElement("span");
      countNode.className = "filter-count";
      countNode.textContent = String(countValue);
      button.append(labelNode, countNode);
      return button;
    });
    target.replaceChildren(...buttons);
    window.requestAnimationFrame(() => syncKnowledgeCategoryRail({ revealActive: true }));
  }

  function syncKnowledgeCategoryRail({ revealActive = false } = {}) {
    const rail = document.getElementById("knowledge-categories");
    if (!rail) {
      return;
    }
    if (revealActive) {
      const active = rail.querySelector('[aria-current="true"]');
      if (active) {
        const railRect = rail.getBoundingClientRect();
        const activeRect = active.getBoundingClientRect();
        if (activeRect.left < railRect.left || activeRect.right > railRect.right) {
          rail.scrollLeft += activeRect.left - railRect.left - Math.max(0, (railRect.width - activeRect.width) / 2);
        }
      }
    }
    const maxScroll = Math.max(0, rail.scrollWidth - rail.clientWidth);
    rail.classList.toggle("has-overflow-before", rail.scrollLeft > 2);
    rail.classList.toggle("has-overflow-after", rail.scrollLeft < maxScroll - 2);
  }

  async function loadArticles(options = {}) {
    const requestId = articleState.requestId + 1;
    const requestedLang = getCurrentLang();
    articleState.requestId = requestId;
    articleState.loading = true;
    articleState.error = "";
    renderKnowledge();
    const applyResult = (result, { background = false } = {}) => {
      if (requestId !== articleState.requestId || getCurrentLang() !== requestedLang) return;
      articleState.detailCache.clear();
      articleState.articles = sortKnowledgeArticles(visiblePublicArticles(result.data?.articles || []));
      articleState.error = result.error ? (result.error.message || "failed") : "";
      rebuildArticleSearchIndex();
      articleState.visibleCount = Math.max(12, Math.min(articleState.visibleCount || 12, articleState.articles.length || 12));
      renderUpdates();
      if (background && document.body.dataset.route === "knowledge") renderKnowledge();
    };
    try {
      const result = await articleApi(`/api/articles?lang=${encodeURIComponent(requestedLang)}&limit=${PUBLIC_ARTICLE_ARCHIVE_LIMIT}`, {
        signal: options.signal,
        force: options.force === true,
        onRevalidated: (revalidated) => applyResult(revalidated, { background: true })
      });
      applyResult(result);
    } catch (error) {
      if (requestId !== articleState.requestId) {
        return;
      }
      if (isAbortError(error)) {
        return;
      }
      articleState.error = error.message || "failed";
    } finally {
      if (requestId === articleState.requestId) {
        articleState.loading = false;
        renderKnowledge();
        renderUpdates();
        renderLatestUpdateDate();
      }
    }
  }

  async function loadArticleDetail(slug, options = {}) {
    const requestId = articleState.detailRequestId + 1;
    const requestedLang = getCurrentLang();
    const detailKey = `${slug}:${requestedLang}`;
    articleState.detailRequestId = requestId;
    const cachedArticle = articleState.detailCache.get(detailKey);
    if (cachedArticle && !options.force) {
      articleState.detailLoadingKey = "";
      articleState.currentArticle = cachedArticle;
      renderArticleDetail(cachedArticle);
      return;
    }

    articleState.detailLoadingKey = detailKey;
    const detail = document.getElementById("article-detail");
    const title = document.getElementById("article-detail-title");
    const summary = document.getElementById("article-detail-summary");
    const meta = document.getElementById("article-detail-meta");
    const body = document.getElementById("article-detail-body");
    [title, summary, body].forEach((node) => applyArticleLanguage(node, ""));
    applyArticleLanguage(meta, getCurrentLang());

    if (articleState.pendingDetailScrollTop === null && detail && !detail.hidden && body.childElementCount) {
      articleState.pendingDetailScrollTop = detail.scrollTop;
    }
    clearArticleCopyStatus();
    syncDocumentMeta();
    title.textContent = t("articleLoading");
    articleState.detailFocusReady = false;
    summary.textContent = "";
    summary.classList.remove("is-expanded");
    summary.dataset.summaryExpanded = "false";
    syncArticleSummaryControl();
    meta.replaceChildren();
    body.replaceChildren();
    resetArticleReadProgress();
    resetArticleToc();

    try {
      const applyDetailResult = (result, { background = false } = {}) => {
        if (articleState.currentSlug !== slug
          || requestId !== articleState.detailRequestId
          || getCurrentLang() !== requestedLang) return;
        articleState.currentArticle = { ...result.data.article, requestedLang };
        articleState.detailCache.set(detailKey, articleState.currentArticle);
        while (articleState.detailCache.size > 12) {
          articleState.detailCache.delete(articleState.detailCache.keys().next().value);
        }
        if (!result.error || !background) renderArticleDetail(articleState.currentArticle);
      };
      const result = await articleApi(`/api/articles/${encodeURIComponent(slug)}?lang=${encodeURIComponent(requestedLang)}`, {
        signal: options.signal,
        force: options.force === true,
        onRevalidated: (revalidated) => applyDetailResult(revalidated, { background: true })
      });
      if (articleState.currentSlug !== slug
        || requestId !== articleState.detailRequestId
        || getCurrentLang() !== requestedLang) {
        return;
      }
      applyDetailResult(result);
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }
      if (articleState.currentSlug === slug
        && requestId === articleState.detailRequestId
        && getCurrentLang() === requestedLang) {
        renderArticleDetailFailure(slug);
      }
    } finally {
      if (requestId === articleState.detailRequestId) {
        articleState.detailLoadingKey = "";
      }
    }
  }

  function renderArticleDetailFailure(slug) {
    const title = document.getElementById("article-detail-title");
    const summary = document.getElementById("article-detail-summary");
    const meta = document.getElementById("article-detail-meta");
    const body = document.getElementById("article-detail-body");
    [title, summary, body].forEach((node) => applyArticleLanguage(node, ""));
    applyArticleLanguage(meta, getCurrentLang());

    articleState.renderedDetailKey = "";
    clearArticleCopyStatus();
    syncDocumentMeta();
    resetArticleReadProgress();
    resetArticleToc();
    title.textContent = t("articleLoadFailed");
    summary.textContent = "";
    summary.classList.remove("is-expanded");
    summary.dataset.summaryExpanded = "false";
    syncArticleSummaryControl();
    meta.replaceChildren();

    const state = document.createElement("div");
    state.className = "content-state is-error";
    const note = document.createElement("p");
    note.className = "content-state-copy loading-text";
    note.textContent = t("articleLoadFailed");
    markStatusMessage(state, "error");
    const action = document.createElement("button");
    action.type = "button";
    action.className = "xp-button";
    action.dataset.articleDetailRetry = slug;
    action.textContent = t("articleRetryAction");
    state.append(note, action);
    body.replaceChildren(state);
    articleState.detailFocusReady = true;
    focusArticleDetailTitle();
    restorePendingKnowledgeScroll();
  }

  function renderArticleDetail(article) {
    const title = document.getElementById("article-detail-title");
    const summary = document.getElementById("article-detail-summary");
    const meta = document.getElementById("article-detail-meta");
    const body = document.getElementById("article-detail-body");
    const renderedDetailKey = [
      article.slug || articleState.currentSlug,
      article.requestedLang || getCurrentLang(),
      article.category || "note",
      article.updated_at || ""
    ].join(":");
    const showSummary = articleDetailShowsSummary(article.category);
    [title, summary, body].forEach((node) => applyArticleLanguage(node, article.lang));
    applyArticleLanguage(meta, getCurrentLang());
    summary.hidden = !showSummary;

    if (articleState.renderedDetailKey === renderedDetailKey
      && body.childElementCount
      && title.textContent === (article.title || "")) {
      connectArticleTocObserver();
      syncArticleSummaryControl({ preserveExpansion: true });
      scheduleArticleReadProgressUpdate();
      syncArticleDocumentMeta(article);
      articleState.detailFocusReady = true;
      focusArticleDetailTitle();
      restorePendingKnowledgeScroll();
      return;
    }

    clearArticleCopyStatus();
    resetArticleReadProgress();
    resetArticleToc();
    title.textContent = article.title || "";
    summary.textContent = showSummary ? (article.summary || "") : "";
    summary.classList.remove("is-expanded");
    summary.dataset.summaryExpanded = "false";
    syncArticleSummaryControl();
    meta.replaceChildren();
    [
      { text: `${t("articleCategory")}: ${articleCategoryName(article.category || "note")}`, className: "article-meta-item article-meta-category" },
      { text: `${t("articlePublished")}: ${formatArticleDate(article.published_at || article.created_at)}`, className: "article-meta-item article-meta-published" },
      ...(article.tags || []).map((tag) => ({ text: `#${articleTagName(tag)}`, className: "tag" })),
      article.lang !== getCurrentLang() ? { text: t("articleFallback"), className: "tag" } : null
    ].filter(Boolean).forEach(({ text, className }) => {
      const item = document.createElement("span");
      item.className = className;
      item.textContent = text;
      meta.appendChild(item);
    });
    renderMarkdownSafe(body, stripRepeatedArticleHeading(article.content_markdown || "", article.title || ""));
    renderArticleToc(article.lang, article.category);
    scheduleArticleReadProgressUpdate();
    syncArticleDocumentMeta(article);
    articleState.renderedDetailKey = renderedDetailKey;
    articleState.detailFocusReady = true;
    focusArticleDetailTitle();
    restorePendingKnowledgeScroll();
  }

  function focusArticleDetailTitle() {
    if (!articleState.focusDetailOnRender || !articleState.detailFocusReady) {
      return;
    }
    const title = document.getElementById("article-detail-title");
    if (!title) {
      return;
    }
    title.tabIndex = -1;
    const pendingSlug = articleState.currentSlug;
    window.requestAnimationFrame(() => {
      const detail = document.getElementById("article-detail");
      if (articleState.focusDetailOnRender && articleState.detailFocusReady
        && pendingSlug && articleState.currentSlug === pendingSlug && detail && !detail.hidden
        && document.body.dataset.route === "knowledge") {
        articleState.focusDetailOnRender = false;
        title.focus({ preventScroll: true });
      }
    });
  }

  function setArticleSummaryControlLabel(expanded) {
    const toggle = document.getElementById("article-summary-toggle");
    if (!toggle) {
      return;
    }
    const label = toggle.querySelector(".article-summary-toggle-label") || toggle;
    label.textContent = t(expanded ? "articleSummaryCollapse" : "articleSummaryExpand");
    toggle.setAttribute("aria-expanded", String(expanded));
  }

  function syncArticleSummaryControl({ preserveExpansion = false } = {}) {
    const summary = document.getElementById("article-detail-summary");
    const toggle = document.getElementById("article-summary-toggle");
    if (!summary || !toggle) {
      return;
    }
    if (articleState.summaryMeasureFrame) {
      window.cancelAnimationFrame(articleState.summaryMeasureFrame);
    }
    articleState.summaryMeasureFrame = window.requestAnimationFrame(() => {
      articleState.summaryMeasureFrame = 0;
      const mobileShell = document.documentElement.dataset.uiShell === "mobile"
        || window.matchMedia?.("(max-width: 760px)").matches;
      const expanded = preserveExpansion && summary.dataset.summaryExpanded === "true";
      summary.classList.remove("is-expanded");
      summary.classList.remove("is-collapsible");
      summary.dataset.summaryExpanded = "false";
      if (!mobileShell || !summary.textContent.trim()) {
        toggle.hidden = true;
        setArticleSummaryControlLabel(false);
        return;
      }
      const expandedHeight = Math.ceil(summary.scrollHeight);
      const canExpand = expandedHeight > summary.clientHeight + 1;
      toggle.hidden = !canExpand;
      summary.classList.toggle("is-collapsible", canExpand);
      const nextExpanded = canExpand && expanded;
      summary.classList.toggle("is-expanded", nextExpanded);
      summary.dataset.summaryExpanded = String(nextExpanded);
      setArticleSummaryControlLabel(nextExpanded);
    });
  }

  function toggleArticleSummary() {
    const summary = document.getElementById("article-detail-summary");
    const toggle = document.getElementById("article-summary-toggle");
    if (!summary || !toggle || toggle.hidden) {
      return;
    }
    const expanded = summary.dataset.summaryExpanded !== "true";
    summary.classList.toggle("is-expanded", expanded);
    summary.dataset.summaryExpanded = String(expanded);
    setArticleSummaryControlLabel(expanded);
    requestMobileFocusReveal(toggle.id);
    scheduleArticleReadProgressUpdate();
  }

  function resetArticleToc() {
    disconnectArticleTocObserver();
    if (articleState.tocHashFrame) {
      window.cancelAnimationFrame(articleState.tocHashFrame);
      articleState.tocHashFrame = 0;
    }
    const toc = document.getElementById("article-detail-toc");
    const list = document.getElementById("article-detail-toc-list");
    if (list) {
      list.replaceChildren();
      applyArticleLanguage(list, "");
    }
    if (toc) {
      toc.hidden = true;
    }
  }

  function disconnectArticleTocObserver() {
    articleState.tocObserver?.disconnect();
    articleState.tocObserver = null;
    articleState.tocIntersecting?.clear();
  }

  function setActiveArticleTocHeading(targetId, { reveal = true } = {}) {
    const list = document.getElementById("article-detail-toc-list");
    if (!list || !targetId) {
      return;
    }
    const links = [...list.querySelectorAll("[data-article-heading-target]")];
    let activeLink = null;
    links.forEach((button) => {
      const active = button.dataset.articleHeadingTarget === targetId;
      button.classList.toggle("is-active", active);
      if (active) {
        button.setAttribute("aria-current", "location");
        activeLink = button;
      } else {
        button.removeAttribute("aria-current");
      }
    });
    if (!reveal || !activeLink) {
      return;
    }
    const listRect = list.getBoundingClientRect();
    const linkRect = activeLink.getBoundingClientRect();
    if (linkRect.top < listRect.top || linkRect.bottom > listRect.bottom) {
      list.scrollTop += linkRect.top - listRect.top - Math.max(0, (listRect.height - linkRect.height) / 2);
    }
    if (linkRect.left < listRect.left || linkRect.right > listRect.right) {
      list.scrollLeft += linkRect.left - listRect.left - Math.max(0, (listRect.width - linkRect.width) / 2);
    }
  }

  function resolveArticleTocObserverActive(headings) {
    const detail = document.getElementById("article-detail");
    if (!detail || detail.hidden || !headings.length) {
      return;
    }
    const rootTop = detail.getBoundingClientRect().top;
    const activationLine = rootTop + Math.min(32, Math.max(22, detail.clientHeight * 0.04));
    let activeHeading = headings[0];
    headings.forEach((heading) => {
      if (heading.getBoundingClientRect().top <= activationLine) {
        activeHeading = heading;
      }
    });
    setActiveArticleTocHeading(activeHeading.id);
  }

  function connectArticleTocObserver() {
    disconnectArticleTocObserver();
    const detail = document.getElementById("article-detail");
    const body = document.getElementById("article-detail-body");
    const headings = body ? [...body.querySelectorAll("[data-article-toc-heading][id]")] : [];
    if (!detail || detail.hidden || !headings.length || typeof window.IntersectionObserver !== "function") {
      return false;
    }
    articleState.tocIntersecting ||= new Map();
    articleState.tocObserver = new window.IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        articleState.tocIntersecting.set(entry.target.id, entry.isIntersecting);
      });
      resolveArticleTocObserverActive(headings);
    }, {
      root: detail,
      rootMargin: "-72px 0px -58% 0px",
      threshold: [0, 0.01, 0.5, 1]
    });
    headings.forEach((heading) => articleState.tocObserver.observe(heading));
    resolveArticleTocObserverActive(headings);
    return true;
  }

  function decodedArticleHash() {
    const rawHash = String(window.location.hash || "").replace(/^#/, "");
    if (!rawHash) {
      return "";
    }
    try {
      return decodeURIComponent(rawHash);
    } catch {
      return rawHash;
    }
  }

  function restoreArticleHashTarget() {
    const targetId = decodedArticleHash();
    if (!targetId.startsWith("article-")) {
      return;
    }
    articleState.tocHashFrame = window.requestAnimationFrame(() => {
      articleState.tocHashFrame = window.requestAnimationFrame(() => {
        articleState.tocHashFrame = 0;
        scrollToArticleHeading(targetId, { behavior: "auto", syncHash: false });
      });
    });
  }

  function renderArticleToc(articleLang = "", articleCategory = "") {
    const toc = document.getElementById("article-detail-toc");
    const list = document.getElementById("article-detail-toc-list");
    const body = document.getElementById("article-detail-body");
    if (!toc || !list || !body) {
      return;
    }
    applyArticleLanguage(list, articleLang);
    const selector = articleTocHeadingSelector(articleCategory);
    const headings = [...body.querySelectorAll(selector)]
      .map((heading) => ({ heading, text: heading.textContent.trim() }))
      .filter((item) => item.text);
    const headingIds = deduplicateArticleHeadingAnchors(headings.map(({ text }) => text));
    headings.forEach(({ heading }, index) => {
      heading.id = headingIds[index];
      heading.tabIndex = -1;
    });
    const minimumHeadings = String(articleCategory || "") === "daily-ai-news" ? 1 : 2;
    if (headings.length < minimumHeadings) {
      resetArticleToc();
      restoreArticleHashTarget();
      return;
    }
    const buttons = headings.map(({ heading, text }, itemIndex) => {
      const id = heading.id;
      heading.dataset.articleTocHeading = "";
      const button = document.createElement("button");
      button.type = "button";
      button.className = `article-toc-link level-${heading.tagName === "H2" ? "2" : "3"}`;
      if (itemIndex === 0) {
        button.classList.add("is-active");
        button.setAttribute("aria-current", "location");
      }
      button.dataset.articleHeadingTarget = id;
      button.setAttribute("aria-controls", id);
      button.textContent = text;
      button.title = text;
      applyArticleLanguage(button, articleLang);
      return button;
    });
    list.replaceChildren(...buttons);
    toc.hidden = false;
    setActiveArticleTocHeading(headings[0].heading.id, { reveal: false });
    connectArticleTocObserver();
    restoreArticleHashTarget();
  }

  function updateArticleTocActive() {
    scheduleArticleReadProgressUpdate("toc");
  }

  function measureArticleReadState() {
    const detail = document.getElementById("article-detail");
    const body = document.getElementById("article-detail-body");
    const list = document.getElementById("article-detail-toc-list");
    if (!detail || detail.hidden) {
      return null;
    }
    const detailRect = detail.getBoundingClientRect();
    const bodyRect = body?.getBoundingClientRect();
    const contentEnd = bodyRect
      ? detail.scrollTop + (bodyRect.bottom - detailRect.top)
      : detail.scrollHeight;
    const percent = articleReadProgressPercent({
      scrollTop: detail.scrollTop,
      clientHeight: detail.clientHeight,
      contentEnd
    });
    const links = list ? [...list.querySelectorAll("[data-article-heading-target]")] : [];
    const cardRect = document.querySelector(".article-detail-card")?.getBoundingClientRect();
    const taskbar = document.querySelector(".xp-taskbar");
    const taskbarRect = taskbar?.getBoundingClientRect();
    const taskbarOccludesDetail = Boolean(
      taskbarRect
      && taskbarRect.height > 0
      && taskbarRect.top > detailRect.top
      && taskbarRect.top < window.innerHeight
    );
    const readingRight = Math.min(
      window.innerWidth,
      detailRect.right,
      cardRect?.right ?? detailRect.right
    );
    const readingBottom = Math.min(
      window.innerHeight,
      detailRect.bottom,
      taskbarOccludesDetail ? taskbarRect.top : window.innerHeight
    );
    const topControl = {
      right: Math.max(8, Math.round(window.innerWidth - readingRight + 12)),
      bottom: Math.max(8, Math.round(window.innerHeight - readingBottom + 12))
    };
    if (!links.length || articleState.tocObserver) {
      return { percent, activeId: "", links, topControl };
    }
    const headings = body ? [...body.querySelectorAll("[data-article-toc-heading][id]")] : [];
    if (!headings.length) {
      return { percent, activeId: "", links, topControl };
    }
    const detailTop = detail.getBoundingClientRect().top;
    let activeId = headings[0].id;
    headings.forEach((heading) => {
      if (heading.getBoundingClientRect().top - detailTop <= 108) {
        activeId = heading.id;
      }
    });
    return { percent, activeId, links, topControl };
  }

  function applyArticleReadState(measurement) {
    if (!measurement) {
      return;
    }
    const topButton = document.querySelector("[data-article-scroll-top]");
    if (topButton && measurement.topControl) {
      topButton.style.setProperty(
        "--article-top-control-right",
        `${measurement.topControl.right}px`
      );
      topButton.style.setProperty(
        "--article-top-control-bottom",
        `${measurement.topControl.bottom}px`
      );
    }
    setArticleReadProgress(measurement.percent);
    if (measurement.activeId) {
      setActiveArticleTocHeading(measurement.activeId);
    }
  }

  function scrollToArticleHeading(targetId, { behavior = motionScrollBehavior(), syncHash = true } = {}) {
    if (!String(targetId || "").startsWith("article-")) {
      return;
    }
    const detail = document.getElementById("article-detail");
    const body = document.getElementById("article-detail-body");
    const heading = document.getElementById(targetId);
    if (!detail || detail.hidden || !body?.contains(heading)) {
      return;
    }
    const detailRect = detail.getBoundingClientRect();
    const headingRect = heading.getBoundingClientRect();
    const targetTop = Math.max(0, detail.scrollTop + headingRect.top - detailRect.top - 18);
    detail.scrollTo({ top: targetTop, behavior });
    heading.focus({ preventScroll: true });
    setActiveArticleTocHeading(targetId);
    if (syncHash) {
      const url = new URL(window.location.href);
      url.hash = targetId;
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }
    scheduleArticleReadProgressUpdate();
  }

  function scrollArticleToTop({ immediate = false } = {}) {
    const detail = document.getElementById("article-detail");
    if (!detail || detail.hidden) {
      return;
    }
    detail.scrollTo({ top: 0, behavior: immediate ? "auto" : motionScrollBehavior() });
    document.getElementById("article-detail-title")?.focus({ preventScroll: true });
    scheduleArticleReadProgressUpdate();
  }

  function motionScrollBehavior() {
    const managedMode = window.LusuUiMotion?.getMode?.() || document.documentElement.dataset.motion;
    if (managedMode === "reduced" || managedMode === "off") {
      return "auto";
    }
    return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  }

  function clearArticleCopyStatus() {
    window.clearTimeout(articleState.copyStatusTimer);
    articleState.copyStatusTimer = 0;
    const status = document.getElementById("article-copy-status");
    const button = document.querySelector("[data-article-copy-link]");
    if (status) {
      status.textContent = "";
    }
    button?.classList.remove("is-done");
  }

  function setArticleReadProgress(percent) {
    const bounded = Math.min(100, Math.max(0, Math.round(percent)));
    const fill = document.getElementById("article-read-progress-fill");
    const value = document.getElementById("article-read-progress-value");
    const bar = document.getElementById("article-read-progress-bar");
    const topButton = document.querySelector("[data-article-scroll-top]");
    const detail = document.getElementById("article-detail");
    const atArticleTop = !detail || detail.scrollTop <= 2;
    if (fill) {
      fill.style.transform = `scaleX(${bounded / 100})`;
    }
    if (value) {
      value.textContent = `${bounded}%`;
    }
    if (bar) {
      bar.setAttribute("aria-valuenow", String(bounded));
      bar.style.setProperty("--article-progress", String(bounded));
    }
    topButton?.classList.toggle("is-at-article-top", atArticleTop);
    topButton?.toggleAttribute("hidden", atArticleTop);
  }

  function resetArticleReadProgress() {
    const detail = document.getElementById("article-detail");
    if (detail) {
      detail.scrollTop = 0;
    }
    setArticleReadProgress(0);
  }

  function updateArticleReadProgress() {
    articleState.readProgressFrame = 0;
    applyArticleReadState(measureArticleReadState());
  }

  function scheduleArticleReadProgressUpdate(reason = "article-scroll") {
    const pipeline = window.LusuFramePipeline;
    if (typeof pipeline?.schedule === "function") {
      pipeline.schedule("main:article-read", {
        measure: measureArticleReadState,
        mutate: applyArticleReadState
      }, reason);
      return;
    }
    if (articleState.readProgressFrame) {
      return;
    }
    articleState.readProgressFrame = window.requestAnimationFrame(updateArticleReadProgress);
  }

  function articleShareLink(slug) {
    const url = new URL(articleRouteHref(slug), window.location.origin);
    const headingId = decodedArticleHash();
    const heading = headingId ? document.getElementById(headingId) : null;
    if (heading && document.getElementById("article-detail-body")?.contains(heading)) {
      url.hash = headingId;
    }
    return url.toString();
  }

  function fallbackCopyText(text) {
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.top = "-1000px";
    field.style.left = "-1000px";
    document.body.appendChild(field);
    field.focus();
    field.select();
    const copied = document.execCommand("copy");
    field.remove();
    if (!copied) {
      throw new Error("copy failed");
    }
  }

  async function copyArticleLink() {
    const slug = articleState.currentArticle?.slug || articleState.currentSlug;
    const status = document.getElementById("article-copy-status");
    const button = document.querySelector("[data-article-copy-link]");
    if (!slug || !status) {
      return;
    }
    const shareUrl = articleShareLink(slug);
    try {
      if (navigator.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        fallbackCopyText(shareUrl);
      }
      status.textContent = t("articleCopyDone");
      button?.classList.add("is-done");
    } catch {
      status.textContent = t("articleCopyFailed");
      button?.classList.remove("is-done");
    }
    window.clearTimeout(articleState.copyStatusTimer);
    articleState.copyStatusTimer = window.setTimeout(() => {
      status.textContent = "";
      button?.classList.remove("is-done");
    }, 2400);
  }

  function showArticle(slug, options = {}) {
    const sourceIsKnowledgeList = document.body.dataset.route === "knowledge"
      && !articleState.currentSlug
      && document.getElementById("knowledge-list")?.hidden === false;
    const knowledgeSnapshot = sourceIsKnowledgeList
      ? captureKnowledgeHistorySnapshot()
      : defaultKnowledgeHistorySnapshot();
    if (sourceIsKnowledgeList) {
      replaceCurrentPublicHistoryState({
        knowledge: knowledgeSnapshot,
        articleScrollTop: 0,
        articleReturnMode: "default"
      });
    }
    articleState.currentSlug = slug;
    articleState.currentArticle = null;
    articleState.detailLoadingKey = "";
    articleState.focusDetailOnRender = true;
    articleState.detailFocusReady = false;
    articleState.pendingListScrollTop = null;
    articleState.pendingDetailScrollTop = 0;
    navigate("knowledge", {
      articleSlug: slug,
      trigger: options.trigger,
      focusWindow: false,
      historyState: {
        knowledge: knowledgeSnapshot,
        articleScrollTop: 0,
        articleReturnMode: sourceIsKnowledgeList ? "history" : "default"
      }
    });
    closeWelcome({ restoreFocus: false, motion: false });
    renderKnowledge();
  }

  function showArticleList(options = {}) {
    const historyState = currentPublicHistoryState();
    if (historyState?.articleReturnMode === "history" && options.useHistory !== false) {
      window.history.back();
      return;
    }
    const knowledgeSnapshot = defaultKnowledgeHistorySnapshot();
    activeFilters.knowledge = knowledgeSnapshot.category;
    articleState.searchTerm = knowledgeSnapshot.searchTerm;
    articleState.currentSlug = "";
    articleState.currentArticle = null;
    articleState.detailLoadingKey = "";
    articleState.focusDetailOnRender = false;
    articleState.detailFocusReady = false;
    articleState.pendingListScrollTop = knowledgeSnapshot.scrollTop;
    articleState.pendingDetailScrollTop = null;
    resetArticleReadProgress();
    resetArticleToc();
    navigate("knowledge", {
      trigger: options.trigger,
      focusWindow: true,
      historyState: {
        knowledge: knowledgeSnapshot,
        articleScrollTop: 0,
        articleReturnMode: "default",
        replaceEntry: true
      }
    });
    renderKnowledge();
  }

  function showArticleCategory(category, options = {}) {
    activeFilters.knowledge = category;
    articleState.searchTerm = "";
    const knowledgeSnapshot = normalizeKnowledgeHistorySnapshot({
      category,
      searchTerm: "",
      scrollTop: 0
    });
    articleState.currentSlug = "";
    articleState.currentArticle = null;
    articleState.detailLoadingKey = "";
    articleState.focusDetailOnRender = false;
    articleState.detailFocusReady = false;
    articleState.pendingListScrollTop = 0;
    articleState.pendingDetailScrollTop = null;
    resetKnowledgeListScroll();
    navigate("knowledge", {
      trigger: options.trigger,
      historyState: {
        knowledge: knowledgeSnapshot,
        articleScrollTop: 0,
        articleReturnMode: "default"
      }
    });
    closeWelcome({ restoreFocus: false, motion: false });
    renderKnowledge();
  }

  async function articleApi(path, options = {}) {
    return requestJson("knowledge", path, {
      signal: options.signal,
      force: options.force === true,
      maxAgeMs: path.includes("/api/articles/") ? 60000 : 30000,
      staleWhileRevalidate: options.force !== true,
      onRevalidated: options.onRevalidated
    });
  }

  function renderMarkdownSafe(target, markdown) {
    target.replaceChildren();
    const lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");
    let index = 0;
    while (index < lines.length) {
      const line = lines[index];
      if (!line.trim()) {
        index += 1;
        continue;
      }

      if (/^```/.test(line.trim())) {
        const fence = line.trim().replace(/^```/, "").trim().toLowerCase();
        const codeLines = [];
        index += 1;
        while (index < lines.length && !/^```/.test(lines[index].trim())) {
          codeLines.push(lines[index]);
          index += 1;
        }
        index += 1;
        if (fence === "text") {
          target.appendChild(renderArticleCallout(codeLines));
          continue;
        }
        const pre = document.createElement("pre");
        const code = document.createElement("code");
        code.textContent = codeLines.join("\n");
        pre.appendChild(code);
        target.appendChild(pre);
        continue;
      }

      const image = line.trim().match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
      if (image) {
        let captionIndex = index + 1;
        while (captionIndex < lines.length && !lines[captionIndex].trim()) {
          captionIndex += 1;
        }
        const explicitCaption = lines[captionIndex]?.trim()
          .match(/^\*([^*\r\n]+)\*$/)?.[1] || "";
        const figure = renderArticleFigure(image[1], image[2], explicitCaption);
        if (figure) {
          target.appendChild(figure);
        }
        index = explicitCaption ? captionIndex + 1 : index + 1;
        continue;
      }

      const heading = line.match(/^(#{1,3})\s+(.+)$/);
      if (heading) {
        const node = document.createElement(`h${heading[1].length + 1}`);
        appendInlineMarkdown(node, heading[2]);
        target.appendChild(node);
        index += 1;
        continue;
      }

      if (/^>\s+/.test(line)) {
        const quote = document.createElement("blockquote");
        appendInlineMarkdown(quote, line.replace(/^>\s+/, ""));
        target.appendChild(quote);
        index += 1;
        continue;
      }

      if (/^\d+\.\s+/.test(line)) {
        const list = document.createElement("ol");
        while (index < lines.length && /^\d+\.\s+/.test(lines[index])) {
          const item = document.createElement("li");
          appendInlineMarkdown(item, lines[index].replace(/^\d+\.\s+/, ""));
          list.appendChild(item);
          index += 1;
        }
        target.appendChild(list);
        continue;
      }

      if (/^[-*]\s+/.test(line)) {
        const list = document.createElement("ul");
        while (index < lines.length && /^[-*]\s+/.test(lines[index])) {
          const item = document.createElement("li");
          appendInlineMarkdown(item, lines[index].replace(/^[-*]\s+/, ""));
          list.appendChild(item);
          index += 1;
        }
        target.appendChild(list);
        continue;
      }

      const paragraphLines = [];
      while (
        index < lines.length
        && lines[index].trim()
        && !/^(#{1,3})\s+/.test(lines[index])
        && !/^\d+\.\s+/.test(lines[index])
        && !/^[-*]\s+/.test(lines[index])
        && !/^!\[[^\]]*\]\([^)]+\)$/.test(lines[index].trim())
        && !/^>\s+/.test(lines[index])
        && !/^```/.test(lines[index].trim())
      ) {
        paragraphLines.push(lines[index]);
        index += 1;
      }
      const paragraph = document.createElement("p");
      appendInlineMarkdown(paragraph, paragraphLines.join(" "));
      target.appendChild(paragraph);
    }
  }

  function renderArticleCallout(lines) {
    const box = document.createElement("div");
    box.className = "article-callout";
    String(lines.join("\n")).split("\n").forEach((line) => {
      const item = document.createElement("p");
      appendInlineMarkdown(item, line);
      box.appendChild(item);
    });
    return box;
  }

  function safeArticleImageSrc(src) {
    const value = String(src || "").trim();
    if (/(^|\/)\.\.(\/|$)/.test(value)) {
      return "";
    }
    if (/^assets\/images\/articles\/[a-z0-9._/-]+\.(png|jpe?g|webp|gif)(\?[a-z0-9=&._-]+)?$/i.test(value)) {
      return value;
    }
    return "";
  }

  function renderArticleFigure(alt, src, explicitCaption = "") {
    const safeSrc = safeArticleImageSrc(src);
    if (!safeSrc) {
      return null;
    }
    const figure = document.createElement("figure");
    figure.className = "article-figure";
    const image = document.createElement("img");
    image.src = sitePath(safeSrc);
    image.alt = explicitCaption ? String(alt || "") : "";
    image.loading = "lazy";
    image.decoding = "async";
    const dimensions = articleImageDimensions(safeSrc);
    if (dimensions) {
      image.width = dimensions.width;
      image.height = dimensions.height;
    }
    figure.appendChild(image);
    const visibleCaption = explicitCaption || alt;
    if (visibleCaption) {
      const caption = document.createElement("figcaption");
      if (explicitCaption) {
        appendInlineMarkdown(caption, explicitCaption);
      } else {
        caption.textContent = alt;
      }
      figure.appendChild(caption);
    }
    return figure;
  }

  function stripRepeatedArticleHeading(markdown, title) {
    const lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");
    const firstContentIndex = lines.findIndex((line) => line.trim());
    if (firstContentIndex < 0) {
      return "";
    }
    const first = lines[firstContentIndex].trim();
    if (first.replace(/^#\s+/, "") === String(title || "").trim()) {
      lines.splice(firstContentIndex, 1);
      return lines.join("\n").replace(/^\n+/, "");
    }
    return markdown;
  }

  function appendInlineMarkdown(parent, text) {
    const parts = String(text)
      .split(/(`[^`\r\n]+`|\*\*[^*\r\n]+\*\*|(?<!!)\[[^\]\r\n]+\]\([^\s)\r\n]+\))/g)
      .filter(Boolean);
    parts.forEach((part) => {
      if (part.startsWith("`") && part.endsWith("`")) {
        const code = document.createElement("code");
        code.textContent = part.slice(1, -1);
        parent.appendChild(code);
        return;
      }
      if (part.startsWith("**") && part.endsWith("**")) {
        const strong = document.createElement("strong");
        strong.textContent = part.slice(2, -2);
        parent.appendChild(strong);
        return;
      }
      const link = part.match(/^\[([^\]\r\n]+)\]\(([^\s)\r\n]+)\)$/);
      if (link) {
        const href = safeArticleLinkHref(link[2]);
        if (href) {
          const anchor = document.createElement("a");
          anchor.href = href;
          anchor.textContent = link[1];
          anchor.target = "_blank";
          anchor.rel = "noreferrer noopener";
          parent.appendChild(anchor);
          return;
        }
      }
      parent.appendChild(document.createTextNode(part));
    });
  }

  function handleKnowledgeSearchInput(event) {
    articleState.searchTerm = event.target.value;
    articleState.visibleCount = 12;
    resetKnowledgeListScroll({ syncHistory: true });
    const clearButton = document.querySelector("[data-article-search-clear]");
    if (clearButton) {
      clearButton.disabled = !articleState.searchTerm.trim();
    }
    window.clearTimeout(articleState.searchDebounceTimer);
    articleState.searchDebounceTimer = window.setTimeout(() => {
      articleState.searchDebounceTimer = 0;
      renderKnowledge();
      schedulePublicHistoryStateSync();
    }, 120);
  }

  function showMoreArticles() {
    const previousCount = Math.max(12, Number(articleState.visibleCount || 12));
    articleState.visibleCount = previousCount + 12;
    renderKnowledge();
    window.requestAnimationFrame(() => {
      document.querySelector(`[data-article-list-position="${previousCount}"]`)?.focus({ preventScroll: true });
    });
  }

  function handleArticleDetailScroll() {
    scheduleArticleReadProgressUpdate();
    schedulePublicHistoryStateSync();
  }

  return Object.freeze({
    restorePendingKnowledgeScroll,
    resetKnowledgeListScroll,
    renderKnowledge,
    loadArticles,
    loadArticleDetail,
    renderArticleDetail,
    focusArticleDetailTitle,
    syncArticleSummaryControl,
    toggleArticleSummary,
    resetArticleToc,
    connectArticleTocObserver,
    disconnectArticleTocObserver,
    updateArticleTocActive,
    measureArticleReadState,
    applyArticleReadState,
    scrollToArticleHeading,
    scrollArticleToTop,
    clearArticleCopyStatus,
    resetArticleReadProgress,
    scheduleArticleReadProgressUpdate,
    copyArticleLink,
    safeArticleImageSrc,
    showArticle,
    showArticleList,
    showArticleCategory,
    handleKnowledgeSearchInput,
    showMoreArticles,
    syncKnowledgeCategoryRail,
    handleArticleDetailScroll
  });
}
