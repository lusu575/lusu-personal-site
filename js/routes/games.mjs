export function createGamesRoute({
  state: gameState,
  requestJson,
  isAbortError,
  t,
  localText,
  markStatusMessage,
  safeGameCoverSrc,
  safeGithubUrl,
  buildGameUrl,
  isExternalGameUrl,
  languageSupportTagElements
}) {
  async function loadGameCatalog({ forceRefresh = false, signal } = {}) {
    if (gameState.catalog && !forceRefresh) return gameState.catalog;
    if (gameState.pending && !forceRefresh) return gameState.pending;
    const pending = requestJson("games", "/games/catalog.json", {
      signal,
      force: forceRefresh,
      maxAgeMs: 5 * 60 * 1000,
      staleWhileRevalidate: !forceRefresh,
      onRevalidated(result) {
        if (result.error || !Array.isArray(result.data?.games)) return;
        gameState.catalog = result.data;
        if (document.body.dataset.route === "games") renderGames({ load: false });
      }
    }).then((result) => {
      const catalog = result.data;
      if (!Array.isArray(catalog.games)) throw new Error("Invalid games catalog");
      gameState.catalog = catalog;
      gameState.error = result.error ? (result.error.message || "failed") : "";
      return catalog;
    });
    gameState.pending = pending;
    try {
      return await pending;
    } finally {
      if (gameState.pending === pending) gameState.pending = null;
    }
  }

  async function renderGames({ forceRefresh = false, load = true, signal } = {}) {
    const list = document.getElementById("game-list");
    if (gameState.catalog && !forceRefresh) {
      renderGameCatalog(list, gameState.catalog);
      if (gameState.error) list.prepend(renderGameRecoveryNotice("failed"));
      return;
    }
    gameState.error = "";
    const loading = document.createElement("div");
    loading.className = "content-state is-loading";
    markStatusMessage(loading);
    const loadingCopy = document.createElement("p");
    loadingCopy.className = "content-state-copy loading-text";
    loadingCopy.textContent = t("gameConfigLoading");
    loading.appendChild(loadingCopy);
    if (gameState.catalog) {
      renderGameCatalog(list, gameState.catalog);
      list.prepend(renderGameRecoveryNotice("loading"));
    } else {
      list.replaceChildren(loading);
    }
    if (!load) return;
    try {
      const catalog = await loadGameCatalog({ forceRefresh, signal });
      renderGameCatalog(list, catalog);
    } catch (error) {
      if (isAbortError(error)) return;
      gameState.error = error.message || "failed";
      if (gameState.catalog) {
        renderGameCatalog(list, gameState.catalog);
        list.prepend(renderGameRecoveryNotice("failed"));
        return;
      }
      const failed = document.createElement("div");
      failed.className = "content-state is-error";
      markStatusMessage(failed, "error");
      const failedCopy = document.createElement("p");
      failedCopy.className = "content-state-copy loading-text";
      failedCopy.textContent = `${t("gameConfigFailed")}: ${error.message}`;
      const action = document.createElement("button");
      action.type = "button";
      action.className = "xp-button";
      action.dataset.gameRetry = "";
      action.textContent = t("gameRetryAction");
      failed.append(failedCopy, action);
      list.replaceChildren(failed);
    }
  }

  function renderGameRecoveryNotice(kind) {
    const notice = document.createElement("div");
    notice.className = `content-state content-recovery-notice ${kind === "failed" ? "is-error" : "is-loading"}`;
    markStatusMessage(notice, kind === "failed" ? "error" : "status");
    const copy = document.createElement("p");
    copy.textContent = kind === "failed" ? t("gameConfigFailed") : t("gameConfigLoading");
    notice.appendChild(copy);
    if (kind === "failed") {
      const action = document.createElement("button");
      action.type = "button";
      action.className = "xp-button";
      action.dataset.gameRetry = "";
      action.textContent = t("gameRetryAction");
      notice.appendChild(action);
    }
    return notice;
  }

  function renderGameCatalog(list, catalog) {
    if (!Array.isArray(catalog.games)) throw new Error("Invalid games catalog");
    list.replaceChildren();
    if (!catalog.games.length) {
      list.appendChild(renderGameEmptyState());
      return;
    }
    catalog.games.forEach((item) => list.appendChild(gameCardElement(item)));
  }

  function renderGameEmptyState() {
    const state = document.createElement("article");
    state.className = "game-empty-state";
    state.classList.add("content-state", "is-empty");
    const icon = document.createElement("span");
    icon.className = "game-empty-icon";
    icon.setAttribute("aria-hidden", "true");
    const copy = document.createElement("div");
    copy.className = "game-empty-copy";
    markStatusMessage(copy);
    const title = document.createElement("h2");
    title.textContent = t("gameEmptyTitle");
    const body = document.createElement("p");
    body.textContent = t("gameEmptyBody");
    copy.append(title, body);
    const action = document.createElement("button");
    action.type = "button";
    action.className = "xp-button";
    action.dataset.gameRetry = "";
    action.textContent = t("gameRetryAction");
    state.append(icon, copy, action);
    return state;
  }

  function gameCardElement(item) {
    const card = document.createElement("article");
    card.className = "game-card";
    const titleText = localText(item.titles || item.titleZh);
    const cover = document.createElement("img");
    cover.className = "game-cover";
    cover.src = safeGameCoverSrc(item.cover || "assets/images/icon-games.png?v=20260719-content-experience-fixes-r1");
    cover.alt = titleText;
    cover.width = 64;
    cover.height = 64;
    cover.loading = "lazy";
    cover.decoding = "async";
    const main = document.createElement("div");
    main.className = "game-main";
    const title = document.createElement("h2");
    title.textContent = titleText;
    const summary = document.createElement("p");
    summary.textContent = localText(item.summaries || item.summary);
    const meta = document.createElement("div");
    meta.className = "meta-row game-primary-meta";
    const currentLanguageLabel = document.createElement("span");
    currentLanguageLabel.className = "language-support-label";
    currentLanguageLabel.textContent = `${t("gameCurrentLanguageLabel")}:`;
    meta.append(currentLanguageLabel, ...languageSupportTagElements(item, { onlyCurrent: true }));
    if (item.storage?.keys?.length || item.storage?.scoreOnly) {
      const save = document.createElement("span");
      save.className = "tag game-save-tag";
      save.textContent = t("gameCloudSaveReady");
      save.setAttribute("aria-label", `${titleText}: ${t("gameCloudSaveReady")}`);
      save.setAttribute("title", `${titleText}: ${t("gameCloudSaveReady")}`);
      meta.appendChild(save);
    }

    const details = document.createElement("details");
    details.className = "game-secondary-details";
    const detailsSummary = document.createElement("summary");
    detailsSummary.textContent = t("gameDetailsLabel");
    const detailsMeta = document.createElement("div");
    detailsMeta.className = "meta-row game-secondary-meta";
    const languageLabel = document.createElement("span");
    languageLabel.className = "language-support-label";
    languageLabel.textContent = `${t("languageSupportLabel")}:`;
    detailsMeta.append(languageLabel, ...languageSupportTagElements(item));
    if (item.license?.name) {
      const license = document.createElement("span");
      license.className = "tag game-license-tag";
      license.textContent = `${t("gameLicenseLabel")}: ${item.license.name}`;
      detailsMeta.appendChild(license);
    }
    const repoUrl = safeGithubUrl(item.repo);
    if (repoUrl) {
      const source = document.createElement("a");
      source.className = "tag game-source-link";
      source.href = repoUrl;
      source.target = "_blank";
      source.rel = "noreferrer noopener";
      source.setAttribute("aria-label", `${t("gameSourceLabel")}: ${titleText}`);
      source.textContent = t("gameSourceLabel");
      detailsMeta.appendChild(source);
    }
    details.append(detailsSummary, detailsMeta);
    main.append(title, summary, meta, details);
    const actionUrl = buildGameUrl(item);
    const action = actionUrl ? document.createElement("a") : document.createElement("button");
    action.className = "card-action";
    if (actionUrl) {
      action.href = actionUrl;
    } else {
      action.type = "button";
      action.disabled = true;
      action.setAttribute("aria-disabled", "true");
    }
    if (isExternalGameUrl(actionUrl)) {
      action.target = "_blank";
      action.rel = "noreferrer";
    }
    action.textContent = item.external || item.playUrl || item.externalUrl ? t("openGameButton") : t("startGameButton");
    action.setAttribute("aria-label", `${action.textContent}: ${titleText}`);
    card.append(cover, main, action);
    return card;
  }

  return Object.freeze({ loadGameCatalog, renderGames, renderGameCatalog });
}
