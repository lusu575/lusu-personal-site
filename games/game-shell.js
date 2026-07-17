(async function () {
  const slug = window.GAME_SLUG;
  const shellParams = new URLSearchParams(window.location.search);
  const requestedSiteLang = ["zh", "en", "ja"].includes(shellParams.get("lang")) ? shellParams.get("lang") : "zh";
  let frame = document.getElementById("game-frame");
  const title = document.getElementById("game-title");
  const subtitle = document.getElementById("game-subtitle");
  const license = document.getElementById("game-license");
  const status = document.getElementById("game-status");
  const importInput = document.getElementById("save-import");
  const cloudPanel = document.getElementById("cloud-panel");
  const cloudMetaPrefix = "lusu.cloudSave.";
  const returnFocusStorageKey = "lusu.games.returnFocus";
  const backToGamesUrl = `../../index.html?lang=${encodeURIComponent(requestedSiteLang)}&focusGame=${encodeURIComponent(slug || "")}#games`;
  const shellTranslations = {
    zh: {
      backToGames: "返回个人站游戏区",
      loading: "加载中...",
      saveToolTitle: "本地存档工具",
      saveToolDesc: "游戏默认使用浏览器本地存储。你可以下载 JSON 备份，也可以导入备份。",
      exportSave: "下载存档",
      importSave: "导入存档",
      ready: "准备就绪",
      cloudSave: "云端存档",
      syncNow: "立即同步",
      logout: "退出",
      notSignedIn: "未登录，当前使用本地存档。",
      signinHint: "如需自动云存档，请回主界面右上角登录账号。",
      loginFromHome: "回主界面登录",
      loggedOutPanel: "已退出，当前仍会保留本地存档。",
      loggedOutStatus: "已退出账号，本地存档仍在当前浏览器。",
      logoutFailed: "退出未完成，账号仍保持登录。请确认云存档同步和网络正常后重试。",
      mergedCloudScore: "已合并云端历史分数，游戏会从新对局开始。",
      restoreCloudConfirm: "检测到云端存档较新，要恢复云端存档吗？",
      restoredCloud: "已恢复云端存档，正在加载游戏。",
      signedInNoCloud: "已登录云端存档，暂时没有可恢复的云端数据。",
      cloudUnavailable: "云端存档暂不可用：{message}",
      noLocalSave: "还没有找到本地存档，先玩一会儿再同步。",
      cloudSynced: "云端存档已同步：{time}",
      cloudOk: "云端同步正常。",
      cloudSyncFailed: "云端同步失败：{message}",
      exportSuccess: "已导出 {count} 项本地存档。",
      noGameSave: "未找到该游戏的本地存档。",
      saveMismatch: "存档文件与当前游戏不匹配。",
      saveImported: "存档已导入，正在刷新游戏。",
      importFailed: "导入失败：{message}",
      shellTitleSuffix: "鲁肃的个人站",
      licenseLabel: "开源协议：",
      licenseFile: "查看协议文件",
      upstreamRepo: "上游仓库",
      loadedCloud: "游戏已加载，云端存档会自动同步。",
      loadedLocal: "游戏已加载，本地存档会保存在当前浏览器。",
      gameLoadFailed: "游戏加载失败",
      invalidGameSource: "游戏启动路径无效",
      controlsLabel: "控制方式",
      saveScopeLabel: "存档范围",
      gameInfoAria: "游戏操作与存档说明",
      gameFrameTitle: "游戏画面：{title}",
      loadingGame: "正在启动 {title}…",
      networkErrorTitle: "网络连接失败",
      networkErrorBody: "网络暂不可用或服务器没有响应。请检查连接后重试。",
      missingErrorTitle: "游戏资源缺失",
      missingErrorBody: "游戏目录或启动文件暂时不存在。你可以重试，或返回游戏区选择其他游戏。",
      unsupportedErrorTitle: "当前浏览器不支持此游戏",
      unsupportedErrorBody: "浏览器缺少运行所需能力：{features}。请更新浏览器或改用较新的浏览器。",
      retryGame: "重新加载游戏",
      unknownGame: "目录中找不到这个游戏。",
      catalogUnavailable: "游戏目录暂时无法读取。",
      sourceUnavailable: "游戏启动文件暂时无法读取。"
    },
    en: {
      backToGames: "Back to Games",
      loading: "Loading...",
      saveToolTitle: "Local Save Tools",
      saveToolDesc: "Games use browser local storage by default. You can download a JSON backup or import one here.",
      exportSave: "Download Save",
      importSave: "Import Save",
      ready: "Ready",
      cloudSave: "Cloud Save",
      syncNow: "Sync Now",
      logout: "Log out",
      notSignedIn: "Not signed in. This game is using local saves.",
      signinHint: "To enable automatic cloud saves, return to the home screen and sign in from the top right.",
      loginFromHome: "Sign in from Home",
      loggedOutPanel: "You are signed out. Local saves are still kept here.",
      loggedOutStatus: "Signed out. Local saves remain in this browser.",
      logoutFailed: "Sign-out did not complete, so the account remains signed in. Check cloud sync and your connection, then try again.",
      mergedCloudScore: "Cloud score history merged. The game will start from a new round.",
      restoreCloudConfirm: "A newer cloud save was found. Restore it now?",
      restoredCloud: "Cloud save restored. Loading the game...",
      signedInNoCloud: "Cloud saves are signed in, but there is no cloud data to restore yet.",
      cloudUnavailable: "Cloud saves are unavailable: {message}",
      noLocalSave: "No local save found yet. Play for a bit, then sync.",
      cloudSynced: "Cloud save synced: {time}",
      cloudOk: "Cloud sync is healthy.",
      cloudSyncFailed: "Cloud sync failed: {message}",
      exportSuccess: "Exported {count} local save item(s).",
      noGameSave: "No local save found for this game.",
      saveMismatch: "This save file does not match the current game.",
      saveImported: "Save imported. Reloading the game...",
      importFailed: "Import failed: {message}",
      shellTitleSuffix: "LuSu's Personal Site",
      licenseLabel: "License: ",
      licenseFile: "View license file",
      upstreamRepo: "Upstream repository",
      loadedCloud: "Game loaded. Cloud saves will sync automatically.",
      loadedLocal: "Game loaded. Local saves stay in this browser.",
      gameLoadFailed: "Game failed to load",
      invalidGameSource: "Invalid game launch path",
      controlsLabel: "Controls",
      saveScopeLabel: "Save scope",
      gameInfoAria: "Game controls and save information",
      gameFrameTitle: "Game view: {title}",
      loadingGame: "Starting {title}…",
      networkErrorTitle: "Network connection failed",
      networkErrorBody: "The network is unavailable or the server did not respond. Check the connection and retry.",
      missingErrorTitle: "Game resource is missing",
      missingErrorBody: "The game directory or launch file is not available. Retry, or return to Games and choose another title.",
      unsupportedErrorTitle: "This browser cannot run the game",
      unsupportedErrorBody: "The browser is missing required capabilities: {features}. Update it or use a newer browser.",
      retryGame: "Reload game",
      unknownGame: "This game is not in the catalog.",
      catalogUnavailable: "The game catalog is unavailable.",
      sourceUnavailable: "The game launch file is unavailable."
    },
    ja: {
      backToGames: "ゲーム一覧へ戻る",
      loading: "読み込み中...",
      saveToolTitle: "ローカルセーブツール",
      saveToolDesc: "ゲームは既定でブラウザーのローカル保存を使います。JSON バックアップのダウンロードとインポートができます。",
      exportSave: "セーブをダウンロード",
      importSave: "セーブをインポート",
      ready: "準備完了",
      cloudSave: "クラウドセーブ",
      syncNow: "今すぐ同期",
      logout: "ログアウト",
      notSignedIn: "未ログインです。現在はローカルセーブを使用しています。",
      signinHint: "自動クラウドセーブを使うには、ホーム画面右上からログインしてください。",
      loginFromHome: "ホームでログイン",
      loggedOutPanel: "ログアウトしました。ローカルセーブは引き続き保存されます。",
      loggedOutStatus: "ログアウトしました。ローカルセーブはこのブラウザーに残ります。",
      logoutFailed: "ログアウトが完了していないため、アカウントはログイン状態のままです。クラウド同期と通信を確認して再試行してください。",
      mergedCloudScore: "クラウドの履歴スコアを統合しました。ゲームは新しい対局から始まります。",
      restoreCloudConfirm: "新しいクラウドセーブが見つかりました。復元しますか？",
      restoredCloud: "クラウドセーブを復元しました。ゲームを読み込んでいます。",
      signedInNoCloud: "クラウドセーブにログイン済みですが、復元できるデータはまだありません。",
      cloudUnavailable: "クラウドセーブを利用できません: {message}",
      noLocalSave: "ローカルセーブがまだありません。少し遊んでから同期してください。",
      cloudSynced: "クラウドセーブを同期しました: {time}",
      cloudOk: "クラウド同期は正常です。",
      cloudSyncFailed: "クラウド同期に失敗しました: {message}",
      exportSuccess: "{count} 件のローカルセーブをエクスポートしました。",
      noGameSave: "このゲームのローカルセーブは見つかりませんでした。",
      saveMismatch: "このセーブファイルは現在のゲームと一致しません。",
      saveImported: "セーブをインポートしました。ゲームを再読み込みしています。",
      importFailed: "インポートに失敗しました: {message}",
      shellTitleSuffix: "魯粛の個人サイト",
      licenseLabel: "ライセンス: ",
      licenseFile: "ライセンスファイルを見る",
      upstreamRepo: "上流リポジトリ",
      loadedCloud: "ゲームを読み込みました。クラウドセーブは自動同期されます。",
      loadedLocal: "ゲームを読み込みました。ローカルセーブはこのブラウザーに保存されます。",
      gameLoadFailed: "ゲームの読み込みに失敗しました",
      invalidGameSource: "ゲーム起動パスが無効です",
      controlsLabel: "操作方法",
      saveScopeLabel: "セーブ範囲",
      gameInfoAria: "ゲームの操作方法とセーブ情報",
      gameFrameTitle: "ゲーム画面：{title}",
      loadingGame: "{title} を起動しています…",
      networkErrorTitle: "ネットワーク接続に失敗しました",
      networkErrorBody: "ネットワークを利用できないか、サーバーが応答していません。接続を確認して再試行してください。",
      missingErrorTitle: "ゲームのリソースが見つかりません",
      missingErrorBody: "ゲームのディレクトリまたは起動ファイルを利用できません。再試行するか、ゲーム一覧へ戻ってください。",
      unsupportedErrorTitle: "このブラウザーではゲームを実行できません",
      unsupportedErrorBody: "必要な機能が不足しています：{features}。ブラウザーを更新するか、新しいブラウザーを使用してください。",
      retryGame: "ゲームを再読み込み",
      unknownGame: "このゲームはカタログにありません。",
      catalogUnavailable: "ゲームカタログを読み込めません。",
      sourceUnavailable: "ゲームの起動ファイルを読み込めません。"
    }
  };
  const languageNames = {
    zh: { zh: "中文", en: "英文", ja: "日文" },
    en: { zh: "Chinese", en: "English", ja: "Japanese" },
    ja: { zh: "中国語", en: "英語", ja: "日本語" }
  };

  let authUser = null;
  let currentGame = null;
  let syncTimer = null;
  let syncInFlight = null;
  let syncQueued = false;
  let syncQueuedVisible = false;
  let localStorageReadBlocked = false;
  let localStorageWarningShown = false;
  let initializeRequestId = 0;
  let frameLaunchId = 0;
  let frameLoadTimer = 0;
  let expectedFrameUrl = "";
  let shellEventsBound = false;
  const sessionStorageFallback = new Map();
  const gameStage = createGameStage();
  const loadState = gameStage.querySelector(".game-load-state");
  const loadStateTitle = gameStage.querySelector(".game-load-state-title");
  const loadStateBody = gameStage.querySelector(".game-load-state-body");
  const retryButton = gameStage.querySelector("[data-game-retry]");

  class GameShellError extends Error {
    constructor(kind, message, details = "") {
      super(message);
      this.name = "GameShellError";
      this.kind = kind;
      this.details = details;
    }
  }

  document.documentElement.lang = requestedSiteLang === "zh" ? "zh-CN" : requestedSiteLang;

  function warnLocalStorageFallback(error) {
    if (localStorageWarningShown) {
      return;
    }
    localStorageWarningShown = true;
    console.warn("Local storage is unavailable; using session-only game save fallback.", error);
  }

  function safeGetStorageItem(key) {
    if (localStorageReadBlocked) {
      return sessionStorageFallback.get(key) ?? null;
    }
    try {
      return window.localStorage.getItem(key) ?? sessionStorageFallback.get(key) ?? null;
    } catch (error) {
      localStorageReadBlocked = true;
      warnLocalStorageFallback(error);
      return sessionStorageFallback.get(key) ?? null;
    }
  }

  function safeSetStorageItem(key, value) {
    const textValue = String(value);
    try {
      window.localStorage.setItem(key, textValue);
      localStorageReadBlocked = false;
      sessionStorageFallback.delete(key);
      return true;
    } catch (error) {
      sessionStorageFallback.set(key, textValue);
      warnLocalStorageFallback(error);
      return false;
    }
  }

  function t(key, values = {}) {
    const template = shellTranslations[requestedSiteLang]?.[key] || shellTranslations.zh[key] || key;
    return Object.entries(values).reduce((text, [name, value]) => text.split(`{${name}}`).join(String(value)), template);
  }

  function createGameStage() {
    const existing = document.querySelector(".game-stage");
    if (existing) {
      return existing;
    }
    const stage = document.createElement("section");
    stage.className = "game-stage";
    stage.setAttribute("aria-busy", "true");

    const stateView = document.createElement("div");
    stateView.className = "game-load-state is-loading";
    stateView.setAttribute("role", "status");
    stateView.setAttribute("aria-live", "polite");
    stateView.setAttribute("aria-atomic", "true");

    const copy = document.createElement("div");
    copy.className = "game-load-state-copy";
    const stateTitle = document.createElement("strong");
    stateTitle.className = "game-load-state-title";
    stateTitle.textContent = t("loading");
    const stateBody = document.createElement("p");
    stateBody.className = "game-load-state-body";
    copy.append(stateTitle, stateBody);

    const retry = document.createElement("button");
    retry.className = "tool-button game-retry-button";
    retry.type = "button";
    retry.dataset.gameRetry = "";
    retry.textContent = t("retryGame");
    retry.hidden = true;
    stateView.append(copy, retry);

    frame.parentNode.insertBefore(stage, frame);
    stage.append(frame, stateView);
    frame.hidden = true;
    return stage;
  }

  function showGameLoading(game = currentGame) {
    const displayTitle = game ? localText(game.titles || game.titleZh || game.title) : "";
    gameStage.dataset.state = "loading";
    gameStage.setAttribute("aria-busy", "true");
    loadState.className = "game-load-state is-loading";
    loadState.setAttribute("role", "status");
    loadState.hidden = false;
    loadStateTitle.textContent = displayTitle ? t("loadingGame", { title: displayTitle }) : t("loading");
    loadStateBody.textContent = "";
    retryButton.hidden = true;
    retryButton.disabled = false;
    frame.hidden = true;
    setStatus(loadStateTitle.textContent);
  }

  function showGameReady() {
    gameStage.dataset.state = "ready";
    gameStage.setAttribute("aria-busy", "false");
    loadState.hidden = true;
    frame.hidden = false;
  }

  function normalizedGameShellError(error) {
    if (error instanceof GameShellError) {
      return error;
    }
    return new GameShellError("network", error?.message || t("catalogUnavailable"));
  }

  function gameLoadErrorCopy(error) {
    if (error.kind === "unsupported") {
      return {
        title: t("unsupportedErrorTitle"),
        body: t("unsupportedErrorBody", { features: error.details || "—" })
      };
    }
    if (error.kind === "missing") {
      return { title: t("missingErrorTitle"), body: t("missingErrorBody") };
    }
    return { title: t("networkErrorTitle"), body: t("networkErrorBody") };
  }

  function showGameLoadError(errorValue) {
    const error = normalizedGameShellError(errorValue);
    const copy = gameLoadErrorCopy(error);
    window.clearTimeout(frameLoadTimer);
    frameLoadTimer = 0;
    gameStage.dataset.state = `error-${error.kind}`;
    gameStage.setAttribute("aria-busy", "false");
    loadState.hidden = false;
    loadState.className = `game-load-state is-error is-${error.kind}`;
    loadState.setAttribute("role", "alert");
    loadStateTitle.textContent = copy.title;
    loadStateBody.textContent = copy.body;
    retryButton.textContent = t("retryGame");
    retryButton.hidden = false;
    retryButton.disabled = false;
    frame.hidden = true;
    title.textContent = currentGame ? localText(currentGame.titles || currentGame.titleZh || currentGame.title) : t("gameLoadFailed");
    subtitle.textContent = copy.title;
    setStatus(copy.body);
    console.warn("Game shell load failure", error.kind, error.message);
  }

  function rememberGameReturnFocus() {
    try {
      window.sessionStorage.setItem(returnFocusStorageKey, JSON.stringify({
        gameId: slug,
        createdAt: Date.now()
      }));
    } catch {
      // The focusGame query parameter remains as a storage-free fallback.
    }
  }

  function canReturnToGamesThroughHistory() {
    if (window.history.length <= 1 || !document.referrer) {
      return false;
    }
    try {
      const referrer = new URL(document.referrer);
      const sameOrigin = referrer.origin === window.location.origin;
      const isMainPage = referrer.pathname === "/" || referrer.pathname.endsWith("/index.html");
      return sameOrigin && isMainPage && referrer.hash === "#games";
    } catch {
      return false;
    }
  }

  function handleBackToGames(event) {
    rememberGameReturnFocus();
    if (!canReturnToGamesThroughHistory()) {
      return;
    }
    event.preventDefault();
    window.history.back();
  }

  function bindBackLink(link) {
    if (!link || link.dataset.gameBackBound === "true") {
      return;
    }
    link.dataset.gameBackBound = "true";
    link.dataset.focusGame = slug || "";
    link.addEventListener("click", handleBackToGames);
  }

  function formatLanguageSupport(game) {
    const support = game.languageSupport || {};
    const names = languageNames[requestedSiteLang] || languageNames.zh;
    return ["zh", "en", "ja"]
      .filter((lang) => support[lang])
      .map((lang) => names[lang] || languageNames.zh[lang] || lang)
      .join(" / ");
  }

  function setFileButtonText(label, text) {
    const input = label?.querySelector("input");
    if (!label || !input) {
      return;
    }
    label.textContent = text;
    label.appendChild(input);
  }

  function applyShellChrome() {
    document.querySelectorAll(".back-link, a[href='../../index.html#games']").forEach((link) => {
      link.setAttribute("href", backToGamesUrl);
      link.textContent = t("backToGames");
      bindBackLink(link);
    });
    const toolsTitle = document.querySelector(".game-title h1");
    const toolsDesc = document.querySelector(".game-title p");
    const exportButton = document.getElementById("export-save");
    if (subtitle) {
      subtitle.textContent = t("loading");
    }
    if (toolsTitle) {
      toolsTitle.textContent = t("saveToolTitle");
    }
    if (toolsDesc) {
      toolsDesc.textContent = t("saveToolDesc");
    }
    if (exportButton) {
      exportButton.textContent = t("exportSave");
    }
    setFileButtonText(document.querySelector(".file-button"), t("importSave"));
    setStatus(t("ready"));
  }

  applyShellChrome();

  function textElement(tagName, text, className = "") {
    const element = document.createElement(tagName);
    if (className) {
      element.className = className;
    }
    element.textContent = text;
    return element;
  }

  function safeRelativeHref(value) {
    const href = String(value || "").trim();
    if (!href || href.startsWith("//") || /^[a-z][a-z0-9+.-]*:/i.test(href) || href.includes("\\") || href.split("/").includes("..")) {
      return "";
    }
    return href;
  }

  function safeGithubHref(value) {
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

  function safeGameSourceEntry(value) {
    const entry = safeRelativeHref(value);
    if (!entry || !/^source\/[a-z0-9][a-z0-9._/-]*\.html$/i.test(entry)) {
      return "";
    }
    return entry;
  }

  function safeQueryParamName(value) {
    const name = String(value || "").trim();
    return /^[a-z0-9_-]{1,32}$/i.test(name) ? name : "lang";
  }

  function renderLicensePanel(game) {
    if (!license) {
      return;
    }
    license.replaceChildren();

    const licenseName = document.createElement("strong");
    licenseName.textContent = game.license?.name || "";
    const licenseSummary = document.createElement("span");
    licenseSummary.append(document.createTextNode(t("licenseLabel")), licenseName);
    license.appendChild(licenseSummary);

    const fileHref = safeRelativeHref(game.license?.file);
    if (fileHref) {
      const fileLink = textElement("a", t("licenseFile"));
      fileLink.href = fileHref;
      fileLink.target = "_blank";
      fileLink.rel = "noreferrer";
      license.appendChild(fileLink);
    }

    const repoHref = safeGithubHref(game.repo);
    if (repoHref) {
      const repoLink = textElement("a", t("upstreamRepo"));
      repoLink.href = repoHref;
      repoLink.target = "_blank";
      repoLink.rel = "noreferrer";
      license.appendChild(repoLink);
    }
  }

  function renderPlayInfo(game) {
    document.getElementById("game-play-info")?.remove();

    const info = document.createElement("section");
    info.id = "game-play-info";
    info.className = "game-play-info";
    info.setAttribute("aria-label", t("gameInfoAria"));

    const controlsCard = document.createElement("div");
    controlsCard.className = "game-info-card";
    controlsCard.append(
      textElement("strong", t("controlsLabel")),
      textElement("p", localText(game.controls))
    );

    const saveCard = document.createElement("div");
    saveCard.className = "game-info-card";
    saveCard.append(
      textElement("strong", t("saveScopeLabel")),
      textElement("p", localText(game.storage?.scope))
    );

    info.append(controlsCard, saveCard);
    gameStage.parentNode.insertBefore(info, gameStage);
  }

  function setStatus(text) {
    status.textContent = text;
  }

  async function loadCatalog() {
    let response;
    try {
      response = await fetch("../catalog.json", { cache: "no-store" });
    } catch (error) {
      throw new GameShellError("network", t("catalogUnavailable"), error?.message);
    }
    if (response.status === 404 || response.status === 410) {
      throw new GameShellError("missing", t("catalogUnavailable"));
    }
    if (!response.ok) {
      throw new GameShellError("network", `${t("catalogUnavailable")} HTTP ${response.status}`);
    }
    try {
      const catalog = await response.json();
      if (!catalog || !Array.isArray(catalog.games)) {
        throw new Error("catalog.games is missing");
      }
      return catalog;
    } catch (error) {
      throw new GameShellError("missing", t("catalogUnavailable"), error?.message);
    }
  }

  function localText(value) {
    if (typeof value === "string") {
      return value;
    }
    return value?.[requestedSiteLang] || value?.zh || "";
  }

  function getGameLanguage(game) {
    const support = game.languageSupport || {};
    const languageMap = game.languageMap || {};
    const siteLang = support[requestedSiteLang] ? requestedSiteLang : support.en ? "en" : "zh";
    return languageMap[siteLang] || siteLang;
  }

  function buildEntry(game) {
    const sourceEntry = safeGameSourceEntry(game.sourceEntry);
    if (!sourceEntry) {
      throw new GameShellError("missing", t("invalidGameSource"));
    }
    const params = new URLSearchParams(game.launchQuery || "");
    params.set(safeQueryParamName(game.languageQueryParam), getGameLanguage(game));
    const query = params.toString();
    return `${sourceEntry}${query ? `?${query}` : ""}`;
  }

  function browserFeatureLabel(feature) {
    const labels = {
      localStorage: { zh: "本地存储", en: "local storage", ja: "ローカルストレージ" },
      canvas2d: { zh: "Canvas 2D", en: "Canvas 2D", ja: "Canvas 2D" },
      webgl: { zh: "WebGL", en: "WebGL", ja: "WebGL" },
      moduleScripts: { zh: "JavaScript 模块", en: "JavaScript modules", ja: "JavaScript モジュール" },
      requestAnimationFrame: { zh: "流畅动画", en: "smooth animation", ja: "アニメーション機能" }
    };
    return localText(labels[feature]) || feature;
  }

  function supportsBrowserFeature(feature) {
    try {
      if (feature === "localStorage") {
        const key = `__lusu_game_support_test_${Date.now()}_${Math.random().toString(36).slice(2)}__`;
        window.localStorage.setItem(key, "1");
        window.localStorage.removeItem(key);
        return true;
      }
      if (feature === "canvas2d") {
        return Boolean(document.createElement("canvas").getContext("2d"));
      }
      if (feature === "webgl") {
        const canvas = document.createElement("canvas");
        return Boolean(canvas.getContext("webgl") || canvas.getContext("experimental-webgl"));
      }
      if (feature === "moduleScripts") {
        return "noModule" in document.createElement("script");
      }
      if (feature === "requestAnimationFrame") {
        return typeof window.requestAnimationFrame === "function";
      }
      return true;
    } catch {
      return false;
    }
  }

  function assertBrowserSupport(game) {
    const missing = (game.browserRequirements || []).filter((feature) => !supportsBrowserFeature(feature));
    if (missing.length) {
      throw new GameShellError(
        "unsupported",
        t("unsupportedErrorTitle"),
        missing.map(browserFeatureLabel).join(" / ")
      );
    }
  }

  async function verifyGameSource(entry) {
    let response;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    try {
      response = await fetch(entry, { method: "HEAD", cache: "no-store", signal: controller.signal });
    } catch (error) {
      throw new GameShellError("network", t("sourceUnavailable"), error?.message);
    } finally {
      window.clearTimeout(timeout);
    }
    if (response.ok || response.status === 405 || response.status === 501) {
      return;
    }
    if (response.status >= 400 && response.status < 500) {
      throw new GameShellError("missing", `${t("sourceUnavailable")} HTTP ${response.status}`);
    }
    throw new GameShellError("network", `${t("sourceUnavailable")} HTTP ${response.status}`);
  }

  function flushGameSave() {
    try {
      const gameWindow = frame.contentWindow;
      if (!gameWindow) {
        return;
      }
      if (gameWindow.gamePage && typeof gameWindow.gamePage.save === "function") {
        gameWindow.gamePage.save();
      } else if (gameWindow.game && typeof gameWindow.game.save === "function") {
        gameWindow.game.save();
      } else if (gameWindow.Engine && typeof gameWindow.Engine.saveGame === "function") {
        gameWindow.Engine.saveGame();
      }
    } catch (error) {
      console.warn("Unable to flush game save", error);
    }
  }

  function applyStorageDefaults(game) {
    const defaults = game.storage?.defaults || {};
    Object.entries(defaults).forEach(([key, value]) => {
      if (safeGetStorageItem(key) === null) {
        safeSetStorageItem(key, value);
      }
    });
  }

  function applyLanguagePreference(game) {
    const gameLang = getGameLanguage(game);
    if (game.id === "kittens-game") {
      safeSetStorageItem("com.nuclearunicorn.kittengame.language", gameLang);
    }
    if (game.id === "a-dark-room") {
      safeSetStorageItem("lang", gameLang);
    }
  }

  function getConfiguredKeys(game) {
    return game.storage?.keys || [];
  }

  function isScoreOnlyStorage(game) {
    return game.storage?.scoreOnly === true;
  }

  function isMeaningfulStorageValue(game, value) {
    if (!isScoreOnlyStorage(game)) {
      return value !== null;
    }
    return Number(value || 0) > 0;
  }

  function getStorageKeys(game) {
    return getConfiguredKeys(game).filter((key) => isMeaningfulStorageValue(game, safeGetStorageItem(key)));
  }

  function collectSaveData(game) {
    flushGameSave();
    const data = {};
    getStorageKeys(game).forEach((key) => {
      data[key] = safeGetStorageItem(key);
    });
    return data;
  }

  function hasLocalSave(game) {
    return getStorageKeys(game).length > 0;
  }

  function applySaveData(game, data) {
    if (!data || typeof data !== "object") {
      return;
    }
    Object.entries(data).forEach(([key, value]) => {
      if (getConfiguredKeys(game).includes(key) && typeof value === "string") {
        if (isScoreOnlyStorage(game)) {
          const nextValue = Math.max(Number(safeGetStorageItem(key) || 0), Number(value || 0));
          if (nextValue > 0) {
            safeSetStorageItem(key, String(nextValue));
          }
        } else {
          safeSetStorageItem(key, value);
        }
      }
    });
  }

  function getCloudMetaKey(game) {
    return `${cloudMetaPrefix}${game.id}.updatedAt`;
  }

  function getKnownCloudTime(game) {
    return Date.parse(safeGetStorageItem(getCloudMetaKey(game)) || "") || 0;
  }

  function rememberCloudTime(game, updatedAt) {
    if (updatedAt) {
      safeSetStorageItem(getCloudMetaKey(game), updatedAt);
    }
  }

  async function apiFetch(path, options = {}) {
    const response = await fetch(path, {
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || `HTTP ${response.status}`);
    }
    return payload;
  }

  async function loadAuthSession() {
    try {
      const payload = await apiFetch("/api/auth/me");
      authUser = payload.user || null;
    } catch {
      authUser = null;
    }
    renderCloudPanel();
  }

  function renderCloudPanel(message = "") {
    if (!cloudPanel) {
      return;
    }
    cloudPanel.replaceChildren();

    const account = document.createElement("div");
    account.className = "cloud-account";
    account.appendChild(textElement("strong", t("cloudSave")));

    if (authUser) {
      account.appendChild(textElement("span", authUser.email || ""));

      const actions = document.createElement("div");
      actions.className = "cloud-actions";
      const syncButton = textElement("button", t("syncNow"), "tool-button");
      syncButton.id = "sync-cloud-save";
      syncButton.type = "button";
      const logoutButton = textElement("button", t("logout"), "tool-button subtle");
      logoutButton.id = "logout-account";
      logoutButton.type = "button";
      actions.append(syncButton, logoutButton);
      account.appendChild(actions);

      if (message) {
        account.appendChild(textElement("p", message));
      }
      cloudPanel.appendChild(account);
      syncButton.addEventListener("click", () => syncToCloud(currentGame, true));
      logoutButton.addEventListener("click", logout);
      return;
    }

    account.appendChild(textElement("span", t("notSignedIn")));
    account.appendChild(textElement("p", message || t("signinHint")));
    const actions = document.createElement("div");
    actions.className = "cloud-actions";
    const loginLink = textElement("a", t("loginFromHome"), "tool-button");
    loginLink.href = backToGamesUrl;
    bindBackLink(loginLink);
    actions.appendChild(loginLink);
    account.appendChild(actions);
    cloudPanel.appendChild(account);
  }

  async function logout() {
    flushGameSave();
    try {
      const synced = await syncToCloud(currentGame, false);
      if (!synced) {
        renderCloudPanel(t("logoutFailed"));
        setStatus(t("logoutFailed"));
        return;
      }
      await apiFetch("/api/auth/logout", { method: "POST", body: "{}" });
    } catch (error) {
      console.warn("Logout failed", error);
      renderCloudPanel(t("logoutFailed"));
      setStatus(t("logoutFailed"));
      return;
    }
    authUser = null;
    stopAutoSync();
    renderCloudPanel(t("loggedOutPanel"));
    setStatus(t("loggedOutStatus"));
  }

  async function restoreOrUpload(game) {
    if (!authUser || !game) {
      return;
    }

    try {
      const payload = await apiFetch(`/api/saves/${game.id}`);
      const cloudSave = payload.save;
      const cloudTime = Date.parse(payload.updatedAt || "") || 0;
      const knownCloudTime = getKnownCloudTime(game);
      const localExists = hasLocalSave(game);

      if (cloudSave && isScoreOnlyStorage(game)) {
        applySaveData(game, cloudSave);
        rememberCloudTime(game, payload.updatedAt);
        setStatus(t("mergedCloudScore"));
        if (hasLocalSave(game)) {
          await syncToCloud(game, false);
        }
        return;
      }

      if (cloudSave && (!localExists || cloudTime > knownCloudTime)) {
        const shouldRestore = !localExists || window.confirm(t("restoreCloudConfirm"));
        if (shouldRestore) {
          applySaveData(game, cloudSave);
          rememberCloudTime(game, payload.updatedAt);
          setStatus(t("restoredCloud"));
          return;
        }
      }

      if (localExists) {
        await syncToCloud(game, false);
      } else {
        setStatus(t("signedInNoCloud"));
      }
    } catch (error) {
      setStatus(t("cloudUnavailable", { message: error.message }));
    }
  }

  async function syncToCloud(game, visible) {
    if (!authUser || !game) return true;
    syncQueued = true;
    syncQueuedVisible ||= Boolean(visible);
    if (!syncInFlight) {
      const settled = drainCloudSync(game).then(async (result) => {
        if (syncInFlight === settled) syncInFlight = null;
        if (syncQueued && authUser) {
          const queuedResult = await syncToCloud(game, false);
          return result && queuedResult;
        }
        return result;
      });
      syncInFlight = settled;
    }
    return syncInFlight;
  }

  async function drainCloudSync(game) {
    let succeeded = true;
    while (syncQueued && authUser && game) {
      const visible = syncQueuedVisible;
      syncQueued = false;
      syncQueuedVisible = false;
      const saveData = collectSaveData(game);
      if (!Object.keys(saveData).length) {
        if (visible) setStatus(t("noLocalSave"));
        continue;
      }
      try {
        const payload = await apiFetch(`/api/saves/${game.id}`, {
          method: "PUT",
          body: JSON.stringify({ saveData })
        });
        rememberCloudTime(game, payload.updatedAt);
        setStatus(t("cloudSynced", { time: new Date(payload.updatedAt).toLocaleTimeString() }));
        renderCloudPanel(t("cloudOk"));
      } catch (error) {
        succeeded = false;
        if (visible) {
          setStatus(t("cloudSyncFailed", { message: error.message }));
          renderCloudPanel(error.message);
        }
      }
    }
    return succeeded;
  }

  function startAutoSync(game) {
    stopAutoSync();
    syncTimer = window.setInterval(() => syncToCloud(game, false), 30000);
  }

  function stopAutoSync() {
    if (syncTimer) {
      window.clearInterval(syncTimer);
      syncTimer = null;
    }
  }

  function exportSave(game) {
    const data = collectSaveData(game);
    const keys = Object.keys(data);
    const payload = {
      type: "lusu-game-save",
      version: 1,
      gameId: game.id,
      title: game.titleZh,
      exportedAt: new Date().toISOString(),
      storage: data
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${game.id}-save-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
    setStatus(keys.length ? t("exportSuccess", { count: keys.length }) : t("noGameSave"));
  }

  async function importSave(game, file) {
    const text = await file.text();
    const payload = JSON.parse(text);
    if (payload.type !== "lusu-game-save" || payload.gameId !== game.id || !payload.storage) {
      throw new Error(t("saveMismatch"));
    }
    applySaveData(game, payload.storage);
    setStatus(t("saveImported"));
    if (authUser) {
      await syncToCloud(game, false);
    }
    frame.contentWindow.location.reload();
  }

  async function launchGame(game) {
    const launchId = ++frameLaunchId;
    expectedFrameUrl = "";
    window.clearTimeout(frameLoadTimer);
    showGameLoading(game);
    assertBrowserSupport(game);

    const entry = buildEntry(game);
    await verifyGameSource(entry);
    if (launchId !== frameLaunchId) {
      return;
    }

    const launchFrame = replaceGameFrame(launchId);
    const displayTitle = localText(game.titles || game.titleZh || game.title);
    expectedFrameUrl = new URL(entry, window.location.href).href;
    launchFrame.setAttribute("title", t("gameFrameTitle", { title: displayTitle }));
    launchFrame.hidden = false;
    launchFrame.src = expectedFrameUrl;
    frameLoadTimer = window.setTimeout(() => {
      if (launchId === frameLaunchId && gameStage.dataset.state === "loading") {
        showGameLoadError(new GameShellError("network", t("sourceUnavailable")));
      }
    }, 20000);
  }

  function replaceGameFrame(launchId) {
    const nextFrame = frame.cloneNode(false);
    nextFrame.removeAttribute("src");
    nextFrame.hidden = true;
    nextFrame.dataset.launchId = String(launchId);
    frame.replaceWith(nextFrame);
    frame = nextFrame;
    bindFrameEvents(nextFrame);
    return nextFrame;
  }

  function bindFrameEvents(target) {
    target.addEventListener("load", handleFrameLoad);
    target.addEventListener("error", handleFrameError);
  }

  function handleFrameLoad(event) {
    if (event.currentTarget !== frame
      || Number(frame.dataset.launchId) !== frameLaunchId
      || !expectedFrameUrl
      || frame.src !== expectedFrameUrl) {
      return;
    }
    window.clearTimeout(frameLoadTimer);
    frameLoadTimer = 0;
    showGameReady();
    setStatus(authUser ? t("loadedCloud") : t("loadedLocal"));
  }

  function handleFrameError(event) {
    if (event.currentTarget !== frame || Number(frame.dataset.launchId) !== frameLaunchId || !expectedFrameUrl) {
      return;
    }
    showGameLoadError(new GameShellError("network", t("sourceUnavailable")));
  }

  async function retryGame() {
    retryButton.disabled = true;
    try {
      if (currentGame) {
        applyLanguagePreference(currentGame);
        await launchGame(currentGame);
      } else {
        await initializeGameShell();
      }
    } catch (error) {
      showGameLoadError(error);
    }
  }

  function bindShellEvents() {
    if (shellEventsBound) {
      return;
    }
    shellEventsBound = true;
    retryButton.addEventListener("click", retryGame);
    bindFrameEvents(frame);
    window.addEventListener("beforeunload", flushGameSave);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden" && currentGame) {
        flushGameSave();
        syncToCloud(currentGame, false);
      }
    });

    document.getElementById("export-save")?.addEventListener("click", () => {
      if (currentGame) {
        exportSave(currentGame);
      }
    });
    importInput?.addEventListener("change", async () => {
      const file = importInput.files?.[0];
      if (!file || !currentGame) {
        return;
      }
      try {
        await importSave(currentGame, file);
      } catch (error) {
        setStatus(t("importFailed", { message: error.message }));
      } finally {
        importInput.value = "";
      }
    });
  }

  async function initializeGameShell() {
    const requestId = ++initializeRequestId;
    stopAutoSync();
    showGameLoading();
    try {
      const catalog = await loadCatalog();
      if (requestId !== initializeRequestId) {
        return;
      }
      const game = catalog.games.find((item) => item.id === slug);
      if (!game) {
        throw new GameShellError("missing", t("unknownGame"));
      }
      currentGame = game;

      const displayTitle = localText(game.titles || game.titleZh || game.title);
      document.title = `${displayTitle} · ${t("shellTitleSuffix")}`;
      title.textContent = displayTitle;
      subtitle.textContent = `${game.title} · ${formatLanguageSupport(game)}`;
      frame.setAttribute("title", t("gameFrameTitle", { title: displayTitle }));
      renderLicensePanel(game);
      renderPlayInfo(game);

      applyStorageDefaults(game);
      await loadAuthSession();
      if (requestId !== initializeRequestId) {
        return;
      }
      await restoreOrUpload(game);
      if (authUser) {
        startAutoSync(game);
      }

      applyLanguagePreference(game);
      await launchGame(game);
    } catch (error) {
      if (requestId === initializeRequestId) {
        showGameLoadError(error);
      }
    }
  }

  bindShellEvents();
  initializeGameShell();
})();
