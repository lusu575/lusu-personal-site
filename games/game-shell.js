(async function () {
  const slug = window.GAME_SLUG;
  const shellParams = new URLSearchParams(window.location.search);
  const requestedSiteLang = ["zh", "en", "ja"].includes(shellParams.get("lang")) ? shellParams.get("lang") : "zh";
  const frame = document.getElementById("game-frame");
  const title = document.getElementById("game-title");
  const subtitle = document.getElementById("game-subtitle");
  const license = document.getElementById("game-license");
  const status = document.getElementById("game-status");
  const importInput = document.getElementById("save-import");
  const cloudPanel = document.getElementById("cloud-panel");
  const cloudMetaPrefix = "lusu.cloudSave.";
  const backToGamesUrl = `../../index.html?lang=${encodeURIComponent(requestedSiteLang)}#games`;
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
      mergedCloudScore: "已合并云端历史分数，游戏会从新对局开始。",
      cloudChecking: "正在核对云端版本…",
      cloudConflictTitle: "发现更新的云端存档",
      cloudConflictBody: "当前浏览器里的本地进度与较新的云端版本不同。自动上传已经暂停，直到你明确选择。",
      cloudConflictRemoteTime: "云端更新时间：{time}",
      cloudConflictAdvice: "建议先下载本地备份。恢复云端会替换当前本地存档；保留本地会覆盖当前云端版本。",
      restoreCloud: "恢复云端",
      keepLocalOverwrite: "保留本地并覆盖云端",
      downloadLocalBackup: "先下载本地备份",
      cancelConflict: "暂不处理",
      reviewConflict: "处理冲突",
      cloudConflictPaused: "检测到较新的云端存档。当前本地存档未被修改，所有云端上传已暂停。",
      cloudConflictBlocked: "为防止覆盖较新的云端存档，本次同步已阻止。",
      cloudChangedElsewhere: "云端存档已被其他页面或设备更新，自动同步已暂停。",
      restoredCloud: "已恢复云端存档，正在加载游戏。",
      signedInNoCloud: "已登录云端存档，暂时没有可恢复的云端数据。",
      cloudUnavailable: "云端存档暂不可用：{message}",
      retryCloud: "重试云端连接",
      requestTimedOut: "请求超时，请重试。",
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
      invalidGameSource: "游戏启动路径无效"
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
      mergedCloudScore: "Cloud score history merged. The game will start from a new round.",
      cloudChecking: "Checking the cloud version…",
      cloudConflictTitle: "Newer Cloud Save Found",
      cloudConflictBody: "This browser's local progress differs from a newer cloud version. Automatic uploads are paused until you make an explicit choice.",
      cloudConflictRemoteTime: "Cloud updated: {time}",
      cloudConflictAdvice: "Download a local backup first. Restoring replaces this browser's local save; keeping local overwrites the current cloud version.",
      restoreCloud: "Restore Cloud",
      keepLocalOverwrite: "Keep Local & Overwrite Cloud",
      downloadLocalBackup: "Download Local Backup",
      cancelConflict: "Decide Later",
      reviewConflict: "Resolve Conflict",
      cloudConflictPaused: "A newer cloud save was found. Your local save is unchanged and all cloud uploads are paused.",
      cloudConflictBlocked: "Sync was blocked to avoid overwriting the newer cloud save.",
      cloudChangedElsewhere: "The cloud save was updated by another page or device. Automatic sync is paused.",
      restoredCloud: "Cloud save restored. Loading the game...",
      signedInNoCloud: "Cloud saves are signed in, but there is no cloud data to restore yet.",
      cloudUnavailable: "Cloud saves are unavailable: {message}",
      retryCloud: "Retry Cloud Connection",
      requestTimedOut: "The request timed out. Please retry.",
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
      invalidGameSource: "Invalid game launch path"
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
      mergedCloudScore: "クラウドの履歴スコアを統合しました。ゲームは新しい対局から始まります。",
      cloudChecking: "クラウドの版を確認しています…",
      cloudConflictTitle: "新しいクラウドセーブを検出",
      cloudConflictBody: "このブラウザーのローカル進捗と、より新しいクラウド版が異なります。明示的に選択するまで自動アップロードを停止します。",
      cloudConflictRemoteTime: "クラウド更新日時：{time}",
      cloudConflictAdvice: "先にローカルのバックアップを保存してください。クラウドを復元すると現在のローカルセーブが置き換わり、ローカルを保持すると現在のクラウド版を上書きします。",
      restoreCloud: "クラウドを復元",
      keepLocalOverwrite: "ローカルを保持してクラウドを上書き",
      downloadLocalBackup: "ローカルをバックアップ",
      cancelConflict: "後で決める",
      reviewConflict: "競合を解決",
      cloudConflictPaused: "新しいクラウドセーブを検出しました。ローカルセーブは変更せず、クラウドへのアップロードを停止しました。",
      cloudConflictBlocked: "新しいクラウドセーブの上書きを防ぐため、今回の同期を停止しました。",
      cloudChangedElsewhere: "クラウドセーブが別のページまたは端末で更新されたため、自動同期を停止しました。",
      restoredCloud: "クラウドセーブを復元しました。ゲームを読み込んでいます。",
      signedInNoCloud: "クラウドセーブにログイン済みですが、復元できるデータはまだありません。",
      cloudUnavailable: "クラウドセーブを利用できません: {message}",
      retryCloud: "クラウド接続を再試行",
      requestTimedOut: "リクエストがタイムアウトしました。もう一度お試しください。",
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
      invalidGameSource: "ゲーム起動パスが無効です"
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
  let syncInFlight = false;
  let cloudVersionReady = false;
  let expectedCloudUpdatedAt = null;
  let cloudConflict = null;
  let conflictDialogPromise = null;
  let localStorageReadBlocked = false;
  let localStorageWarningShown = false;
  let cloudRetryPending = false;
  let cloudRetryMessage = "";
  const cloudRequestTimeoutMs = 7000;
  const sessionStorageFallback = new Map();
  const tabStorageFallback = new Map();

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

  function safeGetTabStorageItem(key) {
    try {
      return window.sessionStorage.getItem(key) ?? tabStorageFallback.get(key) ?? null;
    } catch {
      return tabStorageFallback.get(key) ?? null;
    }
  }

  function safeSetTabStorageItem(key, value) {
    const textValue = String(value);
    try {
      window.sessionStorage.setItem(key, textValue);
      tabStorageFallback.delete(key);
      return true;
    } catch {
      tabStorageFallback.set(key, textValue);
      return false;
    }
  }

  function t(key, values = {}) {
    const template = shellTranslations[requestedSiteLang]?.[key] || shellTranslations.zh[key] || key;
    return Object.entries(values).reduce((text, [name, value]) => text.split(`{${name}}`).join(String(value)), template);
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

  function setStatus(text) {
    status.textContent = text;
  }

  async function loadCatalog() {
    const response = await fetch("../catalog.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`catalog load failed: ${response.status}`);
    }
    return response.json();
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
      throw new Error(t("invalidGameSource"));
    }
    const params = new URLSearchParams(game.launchQuery || "");
    params.set(safeQueryParamName(game.languageQueryParam), getGameLanguage(game));
    const query = params.toString();
    return `${sourceEntry}${query ? `?${query}` : ""}`;
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
    return Date.parse(safeGetTabStorageItem(getCloudMetaKey(game)) || "") || 0;
  }

  function rememberCloudTime(game, updatedAt) {
    if (updatedAt) {
      safeSetTabStorageItem(getCloudMetaKey(game), updatedAt);
    }
  }

  function formatCloudTime(updatedAt) {
    const date = new Date(updatedAt);
    if (Number.isNaN(date.getTime())) {
      return updatedAt || "—";
    }
    const locale = requestedSiteLang === "zh" ? "zh-CN" : requestedSiteLang === "ja" ? "ja-JP" : "en";
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(date);
  }

  async function apiFetch(path, options = {}) {
    const {
      headers = {},
      signal: callerSignal,
      timeoutMs = cloudRequestTimeoutMs,
      ...requestOptions
    } = options;
    const controller = new AbortController();
    let timedOut = false;
    const abortFromCaller = () => controller.abort(callerSignal?.reason);
    if (callerSignal?.aborted) {
      abortFromCaller();
    } else {
      callerSignal?.addEventListener("abort", abortFromCaller, { once: true });
    }
    const timer = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    try {
      const response = await fetch(path, {
        credentials: "include",
        ...requestOptions,
        headers: { "Content-Type": "application/json", ...headers },
        signal: controller.signal
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(payload.error || `HTTP ${response.status}`);
        error.status = response.status;
        error.code = payload.code || "";
        error.updatedAt = payload.updatedAt ?? null;
        throw error;
      }
      return payload;
    } catch (error) {
      if (timedOut) {
        const timeoutError = new Error(t("requestTimedOut"));
        timeoutError.name = "TimeoutError";
        timeoutError.code = "REQUEST_TIMEOUT";
        throw timeoutError;
      }
      throw error;
    } finally {
      window.clearTimeout(timer);
      callerSignal?.removeEventListener("abort", abortFromCaller);
    }
  }

  async function loadAuthSession() {
    let requestError = null;
    try {
      const payload = await apiFetch("/api/auth/me");
      authUser = payload.user || null;
      cloudRetryMessage = "";
    } catch (error) {
      authUser = null;
      requestError = error;
      cloudRetryMessage = t("cloudUnavailable", { message: error.message });
    }
    cloudVersionReady = !authUser;
    expectedCloudUpdatedAt = null;
    cloudConflict = null;
    renderCloudPanel(cloudRetryMessage);
    return requestError === null;
  }

  function addCloudRetryButton(actions) {
    const retryButton = textElement("button", cloudRetryPending ? t("cloudChecking") : t("retryCloud"), "tool-button");
    retryButton.id = "retry-cloud-access";
    retryButton.type = "button";
    retryButton.disabled = cloudRetryPending;
    retryButton.addEventListener("click", () => {
      void retryCloudAccess();
    });
    actions.appendChild(retryButton);
  }

  function renderCloudPanel(message = "") {
    if (!cloudPanel) {
      return;
    }
    cloudPanel.replaceChildren();

    const account = document.createElement("div");
    account.className = "cloud-account";
    account.classList.toggle("is-conflict", Boolean(cloudConflict));
    account.appendChild(textElement("strong", t("cloudSave")));

    if (authUser) {
      account.appendChild(textElement("span", authUser.email || ""));

      const actions = document.createElement("div");
      actions.className = "cloud-actions";
      const syncButton = textElement("button", t("syncNow"), "tool-button");
      syncButton.id = "sync-cloud-save";
      syncButton.type = "button";
      syncButton.disabled = !cloudVersionReady || Boolean(cloudConflict);
      syncButton.title = cloudConflict
        ? t("cloudConflictBlocked")
        : !cloudVersionReady
          ? t("cloudChecking")
          : t("syncNow");
      if (cloudConflict) {
        const reviewButton = textElement("button", t("reviewConflict"), "tool-button cloud-review-button");
        reviewButton.id = "review-cloud-conflict";
        reviewButton.type = "button";
        actions.appendChild(reviewButton);
        reviewButton.addEventListener("click", () => {
          void resolveCloudConflict(currentGame);
        });
      }
      if (!cloudVersionReady && !cloudConflict) {
        addCloudRetryButton(actions);
      }
      const logoutButton = textElement("button", t("logout"), "tool-button subtle");
      logoutButton.id = "logout-account";
      logoutButton.type = "button";
      actions.append(syncButton, logoutButton);
      account.appendChild(actions);

      const panelMessage = cloudConflict ? t("cloudConflictPaused") : message || (!cloudVersionReady ? t("cloudChecking") : "");
      if (panelMessage) {
        const messageNode = textElement("p", panelMessage, cloudConflict ? "cloud-conflict-message" : "");
        if (cloudConflict) {
          messageNode.setAttribute("role", "alert");
        }
        account.appendChild(messageNode);
      }
      cloudPanel.appendChild(account);
      syncButton.addEventListener("click", () => {
        void syncToCloud(currentGame, true);
      });
      logoutButton.addEventListener("click", logout);
      return;
    }

    account.appendChild(textElement("span", t("notSignedIn")));
    account.appendChild(textElement("p", message || t("signinHint")));
    const actions = document.createElement("div");
    actions.className = "cloud-actions";
    const loginLink = textElement("a", t("loginFromHome"), "tool-button");
    loginLink.href = backToGamesUrl;
    actions.appendChild(loginLink);
    if (cloudRetryMessage) {
      addCloudRetryButton(actions);
    }
    account.appendChild(actions);
    cloudPanel.appendChild(account);
  }

  async function initializeCloudAccess(game) {
    const authAvailable = await loadAuthSession();
    if (!authAvailable || !authUser) {
      return;
    }
    await restoreOrUpload(game);
    if (authUser && cloudVersionReady && !cloudConflict) {
      startAutoSync(game);
    }
  }

  async function retryCloudAccess() {
    if (cloudRetryPending || !currentGame) {
      return;
    }
    cloudRetryPending = true;
    cloudRetryMessage = "";
    setStatus(t("cloudChecking"));
    renderCloudPanel(t("cloudChecking"));
    try {
      const authAvailable = authUser ? true : await loadAuthSession();
      if (!authAvailable) {
        return;
      }
      if (authUser) {
        await restoreOrUpload(currentGame);
        if (cloudVersionReady && !cloudConflict) {
          startAutoSync(currentGame);
        }
      }
    } finally {
      cloudRetryPending = false;
      renderCloudPanel(cloudRetryMessage);
    }
  }

  function markCloudConflict(game, details = {}, statusKey = "cloudConflictPaused") {
    cloudVersionReady = true;
    expectedCloudUpdatedAt = details.updatedAt ?? null;
    cloudConflict = {
      gameId: game?.id || "",
      updatedAt: details.updatedAt ?? null,
      save: details.save && typeof details.save === "object" ? details.save : null
    };
    stopAutoSync();
    renderCloudPanel(t(statusKey));
    setStatus(t(statusKey));
  }

  function showCloudConflictDialog(game, conflict) {
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "cloud-conflict-overlay";

      const dialog = document.createElement("section");
      dialog.className = "cloud-conflict-dialog";
      dialog.setAttribute("role", "dialog");
      dialog.setAttribute("aria-modal", "true");
      dialog.setAttribute("aria-labelledby", "cloud-conflict-title");
      dialog.setAttribute("aria-describedby", "cloud-conflict-description");
      dialog.tabIndex = -1;

      const titlebar = document.createElement("div");
      titlebar.className = "cloud-conflict-titlebar";
      titlebar.appendChild(textElement("span", t("cloudConflictTitle")));

      const body = document.createElement("div");
      body.className = "cloud-conflict-body";
      const heading = textElement("h2", t("cloudConflictTitle"));
      heading.id = "cloud-conflict-title";
      const description = textElement("p", t("cloudConflictBody"));
      description.id = "cloud-conflict-description";
      const remoteTime = textElement("p", t("cloudConflictRemoteTime", {
        time: formatCloudTime(conflict.updatedAt)
      }), "cloud-conflict-time");
      const advice = textElement("p", t("cloudConflictAdvice"), "cloud-conflict-advice");

      const actions = document.createElement("div");
      actions.className = "cloud-conflict-actions";
      const backupButton = textElement("button", t("downloadLocalBackup"), "tool-button cloud-conflict-backup");
      backupButton.type = "button";
      const restoreButton = textElement("button", t("restoreCloud"), "tool-button cloud-conflict-restore");
      restoreButton.type = "button";
      const keepButton = textElement("button", t("keepLocalOverwrite"), "tool-button cloud-conflict-overwrite");
      keepButton.type = "button";
      const cancelButton = textElement("button", t("cancelConflict"), "tool-button subtle cloud-conflict-cancel");
      cancelButton.type = "button";
      actions.append(backupButton, restoreButton, keepButton, cancelButton);
      body.append(heading, description, remoteTime, advice, actions);
      dialog.append(titlebar, body);
      overlay.appendChild(dialog);

      const previousFocus = document.activeElement;
      const isolatedElements = [...document.body.children]
        .filter((element) => element !== overlay && !["SCRIPT"].includes(element.tagName))
        .map((element) => ({ element, wasInert: element.hasAttribute("inert") }));
      isolatedElements.forEach(({ element }) => {
        element.setAttribute("inert", "");
      });

      let settled = false;
      const settle = (choice) => {
        if (settled) {
          return;
        }
        settled = true;
        document.removeEventListener("keydown", handleKeydown, true);
        isolatedElements.forEach(({ element, wasInert }) => {
          if (!wasInert) {
            element.removeAttribute("inert");
          }
        });
        overlay.remove();
        if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
          previousFocus.focus({ preventScroll: true });
        }
        resolve(choice);
      };
      const handleKeydown = (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          settle("cancel");
          return;
        }
        if (event.key !== "Tab") {
          return;
        }
        const focusable = [...dialog.querySelectorAll("button:not([disabled])")];
        if (!focusable.length) {
          event.preventDefault();
          dialog.focus();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      };

      backupButton.addEventListener("click", () => exportSave(game));
      restoreButton.addEventListener("click", () => settle("restore"));
      keepButton.addEventListener("click", () => settle("keep-local"));
      cancelButton.addEventListener("click", () => settle("cancel"));
      overlay.addEventListener("click", (event) => {
        if (event.target === overlay) {
          settle("cancel");
        }
      });
      document.addEventListener("keydown", handleKeydown, true);
      document.body.appendChild(overlay);
      backupButton.focus({ preventScroll: true });
    });
  }

  async function runCloudConflictResolution(game, initialPayload = null) {
    if (!authUser || !game) {
      return;
    }
    let payload = initialPayload;
    while (authUser && game) {
      try {
        if (!payload) {
          payload = await apiFetch(`/api/saves/${game.id}`);
        }
      } catch (error) {
        setStatus(t("cloudUnavailable", { message: error.message }));
        renderCloudPanel(t("cloudConflictPaused"));
        return;
      }

      if (!payload.save) {
        cloudConflict = null;
        expectedCloudUpdatedAt = null;
        cloudVersionReady = true;
        renderCloudPanel();
        setStatus(t("signedInNoCloud"));
        return;
      }

      markCloudConflict(game, payload);
      const choice = await showCloudConflictDialog(game, cloudConflict);
      if (choice === "cancel") {
        renderCloudPanel(t("cloudConflictPaused"));
        setStatus(t("cloudConflictPaused"));
        return;
      }

      if (choice === "restore") {
        let currentPayload;
        try {
          currentPayload = await apiFetch(`/api/saves/${game.id}`);
        } catch (error) {
          setStatus(t("cloudUnavailable", { message: error.message }));
          renderCloudPanel(t("cloudConflictPaused"));
          return;
        }
        if (!currentPayload.save) {
          cloudConflict = null;
          expectedCloudUpdatedAt = null;
          cloudVersionReady = true;
          renderCloudPanel();
          setStatus(t("signedInNoCloud"));
          return;
        }
        if (currentPayload.updatedAt !== payload.updatedAt) {
          payload = currentPayload;
          markCloudConflict(game, payload, "cloudChangedElsewhere");
          continue;
        }

        applySaveData(game, currentPayload.save);
        expectedCloudUpdatedAt = currentPayload.updatedAt || null;
        rememberCloudTime(game, currentPayload.updatedAt);
        cloudConflict = null;
        renderCloudPanel(t("cloudOk"));
        setStatus(t("restoredCloud"));
        if (frame.getAttribute("src")) {
          frame.contentWindow.location.reload();
          startAutoSync(game);
        }
        return;
      }

      const attemptedUpdatedAt = payload.updatedAt || null;
      expectedCloudUpdatedAt = attemptedUpdatedAt;
      const uploaded = await syncToCloud(game, true, { allowConflict: true });
      if (uploaded) {
        if (frame.getAttribute("src")) {
          startAutoSync(game);
        }
        return;
      }
      if (cloudConflict?.updatedAt !== attemptedUpdatedAt) {
        payload = null;
        continue;
      }
      return;
    }
  }

  function resolveCloudConflict(game, initialPayload = null) {
    if (conflictDialogPromise) {
      return conflictDialogPromise;
    }
    conflictDialogPromise = runCloudConflictResolution(game, initialPayload)
      .finally(() => {
        conflictDialogPromise = null;
      });
    return conflictDialogPromise;
  }

  async function logout() {
    try {
      await syncToCloud(currentGame, false);
      await apiFetch("/api/auth/logout", { method: "POST", body: "{}" });
    } catch (error) {
      console.warn("Logout failed", error);
    }
    authUser = null;
    cloudVersionReady = true;
    expectedCloudUpdatedAt = null;
    cloudConflict = null;
    cloudRetryMessage = "";
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
      cloudRetryMessage = "";
      const cloudSave = payload.save;
      const cloudTime = Date.parse(payload.updatedAt || "") || 0;
      const knownCloudTime = getKnownCloudTime(game);
      const localExists = hasLocalSave(game);
      expectedCloudUpdatedAt = payload.updatedAt || null;
      cloudVersionReady = true;
      renderCloudPanel();

      if (cloudSave && isScoreOnlyStorage(game)) {
        applySaveData(game, cloudSave);
        rememberCloudTime(game, payload.updatedAt);
        setStatus(t("mergedCloudScore"));
        if (frame.getAttribute("src")) {
          frame.contentWindow.location.reload();
        }
        if (hasLocalSave(game)) {
          await syncToCloud(game, false);
        }
        return;
      }

      if (cloudSave && !localExists) {
        applySaveData(game, cloudSave);
        rememberCloudTime(game, payload.updatedAt);
        setStatus(t("restoredCloud"));
        if (frame.getAttribute("src")) {
          frame.contentWindow.location.reload();
        }
        return;
      }

      if (cloudSave && localExists && cloudTime > knownCloudTime) {
        await resolveCloudConflict(game, payload);
        return;
      }

      if (localExists) {
        await syncToCloud(game, false);
      } else {
        setStatus(t("signedInNoCloud"));
      }
    } catch (error) {
      cloudVersionReady = false;
      cloudRetryMessage = t("cloudUnavailable", { message: error.message });
      renderCloudPanel(cloudRetryMessage);
      setStatus(cloudRetryMessage);
    }
  }

  async function syncToCloud(game, visible, options = {}) {
    if (!authUser || !game || syncInFlight) {
      return false;
    }
    if (cloudConflict && !options.allowConflict) {
      if (visible) {
        setStatus(t("cloudConflictBlocked"));
        renderCloudPanel(t("cloudConflictPaused"));
      }
      return false;
    }
    if (!cloudVersionReady) {
      if (visible) {
        setStatus(t("cloudChecking"));
        renderCloudPanel(t("cloudChecking"));
      }
      return false;
    }
    const saveData = collectSaveData(game);
    if (!Object.keys(saveData).length) {
      if (visible) {
        setStatus(t("noLocalSave"));
      }
      return false;
    }

    syncInFlight = true;
    try {
      const payload = await apiFetch(`/api/saves/${game.id}`, {
        method: "PUT",
        body: JSON.stringify({
          saveData,
          expectedUpdatedAt: expectedCloudUpdatedAt
        })
      });
      expectedCloudUpdatedAt = payload.updatedAt || null;
      rememberCloudTime(game, payload.updatedAt);
      cloudConflict = null;
      setStatus(t("cloudSynced", { time: new Date(payload.updatedAt).toLocaleTimeString() }));
      renderCloudPanel(t("cloudOk"));
      return true;
    } catch (error) {
      if (error.status === 409 && error.code === "SAVE_CONFLICT") {
        markCloudConflict(game, { updatedAt: error.updatedAt }, "cloudChangedElsewhere");
        return false;
      }
      if (visible) {
        setStatus(t("cloudSyncFailed", { message: error.message }));
        renderCloudPanel(error.message);
      }
      return false;
    } finally {
      syncInFlight = false;
    }
  }

  function startAutoSync(game) {
    stopAutoSync();
    if (!authUser || !cloudVersionReady || cloudConflict) {
      return;
    }
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

  try {
    const catalog = await loadCatalog();
    const game = catalog.games.find((item) => item.id === slug);
    if (!game) {
      throw new Error(`unknown game: ${slug}`);
    }
    currentGame = game;

    const displayTitle = localText(game.titles || game.titleZh);
    document.title = `${displayTitle} · ${t("shellTitleSuffix")}`;
    title.textContent = displayTitle;
    subtitle.textContent = `${game.title} · ${formatLanguageSupport(game)}`;
    frame.setAttribute("title", displayTitle);
    renderLicensePanel(game);

    applyStorageDefaults(game);
    applyLanguagePreference(game);
    frame.addEventListener("load", () => {
      setStatus(cloudConflict
        ? t("cloudConflictPaused")
        : authUser
          ? t("loadedCloud")
          : t("loadedLocal"));
    });
    frame.src = buildEntry(game);
    renderCloudPanel();
    window.addEventListener("beforeunload", flushGameSave);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        flushGameSave();
        syncToCloud(game, false);
      }
    });

    document.getElementById("export-save").addEventListener("click", () => exportSave(game));
    importInput.addEventListener("change", async () => {
      const file = importInput.files[0];
      if (!file) {
        return;
      }
      try {
        await importSave(game, file);
      } catch (error) {
        setStatus(t("importFailed", { message: error.message }));
      } finally {
        importInput.value = "";
      }
    });
    void initializeCloudAccess(game);
  } catch (error) {
    title.textContent = t("gameLoadFailed");
    subtitle.textContent = error.message;
    setStatus(error.message);
  }
})();
