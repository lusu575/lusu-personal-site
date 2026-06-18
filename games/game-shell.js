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

  document.documentElement.lang = requestedSiteLang === "zh" ? "zh-CN" : requestedSiteLang;

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

  function safeExternalHref(value) {
    try {
      const url = new URL(String(value || "").trim());
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
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

    const repoHref = safeExternalHref(game.repo);
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
      if (localStorage.getItem(key) === null) {
        localStorage.setItem(key, value);
      }
    });
  }

  function applyLanguagePreference(game) {
    const gameLang = getGameLanguage(game);
    if (game.id === "kittens-game") {
      localStorage.setItem("com.nuclearunicorn.kittengame.language", gameLang);
    }
    if (game.id === "a-dark-room") {
      localStorage.setItem("lang", gameLang);
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
    return getConfiguredKeys(game).filter((key) => isMeaningfulStorageValue(game, localStorage.getItem(key)));
  }

  function collectSaveData(game) {
    flushGameSave();
    const data = {};
    getStorageKeys(game).forEach((key) => {
      data[key] = localStorage.getItem(key);
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
          const nextValue = Math.max(Number(localStorage.getItem(key) || 0), Number(value || 0));
          if (nextValue > 0) {
            localStorage.setItem(key, String(nextValue));
          }
        } else {
          localStorage.setItem(key, value);
        }
      }
    });
  }

  function getCloudMetaKey(game) {
    return `${cloudMetaPrefix}${game.id}.updatedAt`;
  }

  function getKnownCloudTime(game) {
    return Date.parse(localStorage.getItem(getCloudMetaKey(game)) || "") || 0;
  }

  function rememberCloudTime(game, updatedAt) {
    if (updatedAt) {
      localStorage.setItem(getCloudMetaKey(game), updatedAt);
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
    actions.appendChild(loginLink);
    account.appendChild(actions);
    cloudPanel.appendChild(account);
  }

  async function logout() {
    try {
      await syncToCloud(currentGame, false);
      await apiFetch("/api/auth/logout", { method: "POST", body: "{}" });
    } catch (error) {
      console.warn("Logout failed", error);
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
    if (!authUser || !game || syncInFlight) {
      return;
    }
    const saveData = collectSaveData(game);
    if (!Object.keys(saveData).length) {
      if (visible) {
        setStatus(t("noLocalSave"));
      }
      return;
    }

    syncInFlight = true;
    try {
      const payload = await apiFetch(`/api/saves/${game.id}`, {
        method: "PUT",
        body: JSON.stringify({ saveData })
      });
      rememberCloudTime(game, payload.updatedAt);
      setStatus(t("cloudSynced", { time: new Date(payload.updatedAt).toLocaleTimeString() }));
      renderCloudPanel(t("cloudOk"));
    } catch (error) {
      if (visible) {
        setStatus(t("cloudSyncFailed", { message: error.message }));
        renderCloudPanel(error.message);
      }
    } finally {
      syncInFlight = false;
    }
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
    await loadAuthSession();
    await restoreOrUpload(game);
    if (authUser) {
      startAutoSync(game);
    }

    applyLanguagePreference(game);
    frame.src = buildEntry(game);
    frame.addEventListener("load", () => {
      setStatus(authUser ? t("loadedCloud") : t("loadedLocal"));
    });
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
  } catch (error) {
    title.textContent = t("gameLoadFailed");
    subtitle.textContent = error.message;
    setStatus(error.message);
  }
})();
