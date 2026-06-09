(async function () {
  const slug = window.GAME_SLUG;
  const frame = document.getElementById("game-frame");
  const title = document.getElementById("game-title");
  const subtitle = document.getElementById("game-subtitle");
  const license = document.getElementById("game-license");
  const status = document.getElementById("game-status");
  const importInput = document.getElementById("save-import");

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

  function buildEntry(game) {
    const query = game.launchQuery ? `?${game.launchQuery}` : "";
    return `${game.sourceEntry}${query}`;
  }

  function applyStorageDefaults(game) {
    const defaults = game.storage?.defaults || {};
    Object.entries(defaults).forEach(([key, value]) => {
      if (localStorage.getItem(key) === null) {
        localStorage.setItem(key, value);
      }
    });
  }

  function getStorageKeys(game) {
    const configured = game.storage?.keys || [];
    return configured.filter((key) => localStorage.getItem(key) !== null);
  }

  function exportSave(game) {
    const keys = getStorageKeys(game);
    const data = {};
    keys.forEach((key) => {
      data[key] = localStorage.getItem(key);
    });

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
    Object.entries(payload.storage).forEach(([key, value]) => {
      if ((game.storage?.keys || []).includes(key)) {
        localStorage.setItem(key, value);
      }
    });
    setStatus("存档已导入，正在刷新游戏。");
    frame.contentWindow.location.reload();
  }

  try {
    const catalog = await loadCatalog();
    const game = catalog.games.find((item) => item.id === slug);
    if (!game) {
      throw new Error(`unknown game: ${slug}`);
    }

    document.title = `${game.titleZh} · 游戏馆`;
    title.textContent = game.titleZh;
    subtitle.textContent = `${game.title} · ${game.language}`;
    license.innerHTML = `
      <span>开源协议：<strong>${game.license.name}</strong></span>
      <a href="${game.license.file}" target="_blank" rel="noreferrer">查看协议文件</a>
      <a href="${game.repo}" target="_blank" rel="noreferrer">上游仓库</a>
    `;
    applyStorageDefaults(game);
    frame.src = buildEntry(game);

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
