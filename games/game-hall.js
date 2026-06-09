(async function () {
  const grid = document.getElementById("game-grid");

  async function loadCatalog() {
    const response = await fetch("catalog.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`catalog load failed: ${response.status}`);
    }
    return response.json();
  }

  try {
    const catalog = await loadCatalog();
    grid.innerHTML = catalog.games.map((game) => `
      <article class="game-tile">
        <img src="${game.cover}" alt="${game.titleZh} 封面" loading="lazy">
        <div class="game-tile-body">
          <h2>${game.titleZh}</h2>
          <p class="latin">${game.title}</p>
          <p>${game.summary}</p>
          <div class="meta-line">
            <span>${game.language}</span>
            <span>${game.license.name}</span>
          </div>
          <a class="play-button" href="${game.entry}">开始游戏</a>
        </div>
      </article>
    `).join("");
  } catch (error) {
    grid.innerHTML = `<p class="error-box">游戏配置读取失败：${error.message}</p>`;
  }
})();
