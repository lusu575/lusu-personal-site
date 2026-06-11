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

  let authUser = null;
  let currentGame = null;
  let syncTimer = null;
  let syncInFlight = false;

  document.documentElement.lang = requestedSiteLang === "zh" ? "zh-CN" : requestedSiteLang;
  document.querySelectorAll(".back-link, a[href='../../index.html#games']").forEach((link) => {
    link.setAttribute("href", backToGamesUrl);
  });

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
    const siteLang = support[requestedSiteLang] ? requestedSiteLang : "zh";
    return languageMap[siteLang] || siteLang;
  }

  function buildEntry(game) {
    const params = new URLSearchParams(game.launchQuery || "");
    params.set("lang", getGameLanguage(game));
    const query = params.toString();
    return `${game.sourceEntry}${query ? `?${query}` : ""}`;
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

  function getStorageKeys(game) {
    return getConfiguredKeys(game).filter((key) => localStorage.getItem(key) !== null);
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
        localStorage.setItem(key, value);
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

    if (authUser) {
      cloudPanel.innerHTML = `
        <div class="cloud-account">
          <strong>云端存档</strong>
          <span>${escapeHtml(authUser.email)}</span>
          <div class="cloud-actions">
            <button class="tool-button" id="sync-cloud-save" type="button">立即同步</button>
            <button class="tool-button subtle" id="logout-account" type="button">退出</button>
          </div>
          ${message ? `<p>${escapeHtml(message)}</p>` : ""}
        </div>
      `;
      document.getElementById("sync-cloud-save").addEventListener("click", () => syncToCloud(currentGame, true));
      document.getElementById("logout-account").addEventListener("click", logout);
      return;
    }

    cloudPanel.innerHTML = `
      <div class="cloud-account">
        <strong>云端存档</strong>
        <span>未登录，当前使用本地存档。</span>
        <p>${message ? escapeHtml(message) : "如需自动云存档，请回主界面右上角登录账号。"}</p>
        <div class="cloud-actions">
          <a class="tool-button" href="${backToGamesUrl}">回主界面登录</a>
        </div>
      </div>
    `;
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
    renderCloudPanel("已退出，当前仍会保留本地存档。");
    setStatus("已退出账号，本地存档仍在当前浏览器。");
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

      if (cloudSave && (!localExists || cloudTime > knownCloudTime)) {
        const shouldRestore = !localExists || window.confirm("检测到云端存档较新，要恢复云端存档吗？");
        if (shouldRestore) {
          applySaveData(game, cloudSave);
          rememberCloudTime(game, payload.updatedAt);
          setStatus("已恢复云端存档，正在加载游戏。");
          return;
        }
      }

      if (localExists) {
        await syncToCloud(game, false);
      } else {
        setStatus("已登录云端存档，暂时没有可恢复的云端数据。");
      }
    } catch (error) {
      setStatus(`云端存档暂不可用：${error.message}`);
    }
  }

  async function syncToCloud(game, visible) {
    if (!authUser || !game || syncInFlight) {
      return;
    }
    const saveData = collectSaveData(game);
    if (!Object.keys(saveData).length) {
      if (visible) {
        setStatus("还没有找到本地存档，先玩一会儿再同步。");
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
      setStatus(`云端存档已同步：${new Date(payload.updatedAt).toLocaleTimeString()}`);
      renderCloudPanel("云端同步正常。");
    } catch (error) {
      if (visible) {
        setStatus(`云端同步失败：${error.message}`);
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
    setStatus(keys.length ? `已导出 ${keys.length} 项本地存档。` : "未找到该游戏的本地存档。");
  }

  async function importSave(game, file) {
    const text = await file.text();
    const payload = JSON.parse(text);
    if (payload.type !== "lusu-game-save" || payload.gameId !== game.id || !payload.storage) {
      throw new Error("存档文件与当前游戏不匹配。");
    }
    applySaveData(game, payload.storage);
    setStatus("存档已导入，正在刷新游戏。");
    if (authUser) {
      await syncToCloud(game, false);
    }
    frame.contentWindow.location.reload();
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  try {
    const catalog = await loadCatalog();
    const game = catalog.games.find((item) => item.id === slug);
    if (!game) {
      throw new Error(`unknown game: ${slug}`);
    }
    currentGame = game;

    const displayTitle = localText(game.titles || game.titleZh);
    document.title = `${displayTitle} · 鲁肃的个人站`;
    title.textContent = displayTitle;
    subtitle.textContent = `${game.title} · ${game.language}`;
    license.innerHTML = `
      <span>开源协议：<strong>${game.license.name}</strong></span>
      <a href="${game.license.file}" target="_blank" rel="noreferrer">查看协议文件</a>
      <a href="${game.repo}" target="_blank" rel="noreferrer">上游仓库</a>
    `;

    applyStorageDefaults(game);
    await loadAuthSession();
    await restoreOrUpload(game);
    if (authUser) {
      startAutoSync(game);
    }

    applyLanguagePreference(game);
    frame.src = buildEntry(game);
    frame.addEventListener("load", () => {
      setStatus(authUser ? "游戏已加载，云端存档会自动同步。" : "游戏已加载，本地存档会保存在当前浏览器。");
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
        setStatus(`导入失败：${error.message}`);
      } finally {
        importInput.value = "";
      }
    });
  } catch (error) {
    title.textContent = "游戏加载失败";
    subtitle.textContent = error.message;
    setStatus(error.message);
  }
})();
