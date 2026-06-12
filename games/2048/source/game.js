const params = new URLSearchParams(window.location.search);
const lang = ["zh", "en", "ja"].includes(params.get("lang")) ? params.get("lang") : "zh";
const saveKey = "lusu.2048.save";
const bestKey = "lusu.2048.best";
const langKey = "lusu.2048.lang";

const dict = {
  zh: {
    eyebrow: "LuSu 游戏舱",
    score: "分数",
    best: "最佳",
    newGame: "新游戏",
    hint: "使用方向键或滑动移动方块。",
    keepPlaying: "继续玩",
    win: "合成成功！",
    winCopy: "你已经拼出 2048，还可以继续挑战更高分。",
    over: "游戏结束",
    overCopy: "没有可移动的方块了，重新开一局吧。"
  },
  en: {
    eyebrow: "LuSu Games",
    score: "Score",
    best: "Best",
    newGame: "New Game",
    hint: "Use arrow keys or swipe to move tiles.",
    keepPlaying: "Keep Playing",
    win: "Tile reached!",
    winCopy: "You made 2048. Keep going for a higher score.",
    over: "Game Over",
    overCopy: "No moves left. Start a fresh run."
  },
  ja: {
    eyebrow: "LuSu ゲーム",
    score: "スコア",
    best: "ベスト",
    newGame: "新規ゲーム",
    hint: "矢印キーまたはスワイプでタイルを動かします。",
    keepPlaying: "続ける",
    win: "合成成功！",
    winCopy: "2048 ができました。さらに高得点を目指せます。",
    over: "ゲーム終了",
    overCopy: "動かせるタイルがありません。新しく始めましょう。"
  }
};

const boardEl = document.getElementById("board");
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayCopy = document.getElementById("overlay-copy");
let grid = [];
let score = 0;
let best = Number(localStorage.getItem(bestKey) || "0");
let won = false;
let over = false;

function text(key) {
  return dict[lang][key] || dict.zh[key] || key;
}

function applyLang() {
  document.documentElement.lang = lang === "zh" ? "zh-CN" : lang;
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = text(node.dataset.i18n);
  });
  localStorage.setItem(langKey, lang);
}

function emptyGrid() {
  return Array.from({ length: 4 }, () => Array(4).fill(0));
}

function addTile() {
  const empty = [];
  grid.forEach((row, r) => row.forEach((value, c) => {
    if (!value) empty.push([r, c]);
  }));
  if (!empty.length) return;
  const [r, c] = empty[Math.floor(Math.random() * empty.length)];
  grid[r][c] = Math.random() < 0.9 ? 2 : 4;
}

function draw() {
  boardEl.replaceChildren();
  grid.flat().forEach((value) => {
    const cell = document.createElement("div");
    cell.className = `cell tile-${value || 0}`;
    cell.textContent = value || "";
    boardEl.appendChild(cell);
  });
  scoreEl.textContent = score;
  best = Math.max(best, score);
  bestEl.textContent = best;
  localStorage.setItem(bestKey, String(best));
  save();
}

function compress(line) {
  const values = line.filter(Boolean);
  const result = [];
  for (let i = 0; i < values.length; i += 1) {
    if (values[i] === values[i + 1]) {
      const merged = values[i] * 2;
      result.push(merged);
      score += merged;
      i += 1;
    } else {
      result.push(values[i]);
    }
  }
  while (result.length < 4) result.push(0);
  return result;
}

function move(direction) {
  if (over) return;
  const before = JSON.stringify(grid);
  if (direction === "left" || direction === "right") {
    grid = grid.map((row) => {
      const line = direction === "right" ? [...row].reverse() : [...row];
      const moved = compress(line);
      return direction === "right" ? moved.reverse() : moved;
    });
  } else {
    for (let c = 0; c < 4; c += 1) {
      const line = grid.map((row) => row[c]);
      const moved = compress(direction === "down" ? line.reverse() : line);
      const finalLine = direction === "down" ? moved.reverse() : moved;
      for (let r = 0; r < 4; r += 1) grid[r][c] = finalLine[r];
    }
  }
  if (JSON.stringify(grid) === before) return;
  addTile();
  if (!won && grid.flat().includes(2048)) {
    won = true;
    showOverlay(text("win"), text("winCopy"));
  }
  if (!canMove()) {
    over = true;
    showOverlay(text("over"), text("overCopy"));
  }
  draw();
}

function canMove() {
  if (grid.flat().some((value) => !value)) return true;
  for (let r = 0; r < 4; r += 1) {
    for (let c = 0; c < 4; c += 1) {
      if (grid[r][c] === grid[r]?.[c + 1] || grid[r][c] === grid[r + 1]?.[c]) return true;
    }
  }
  return false;
}

function showOverlay(title, copy) {
  overlayTitle.textContent = title;
  overlayCopy.textContent = copy;
  overlay.hidden = false;
}

function newGame() {
  grid = emptyGrid();
  score = 0;
  won = false;
  over = false;
  overlay.hidden = true;
  addTile();
  addTile();
  draw();
}

function save() {
  localStorage.setItem(saveKey, JSON.stringify({ grid, score, won, over, savedAt: new Date().toISOString() }));
}

function load() {
  const raw = localStorage.getItem(saveKey);
  try {
    const data = raw ? JSON.parse(raw) : null;
    if (Array.isArray(data?.grid) && data.grid.length === 4) {
      grid = data.grid;
      score = Number(data.score || 0);
      won = Boolean(data.won);
      over = Boolean(data.over);
      if (over || !canMove()) {
        newGame();
      }
      return;
    }
  } catch {}
  newGame();
}

window.gamePage = { save };
applyLang();
load();
draw();

document.getElementById("new-game").addEventListener("click", newGame);
document.getElementById("keep-playing").addEventListener("click", () => {
  overlay.hidden = true;
  over = false;
  draw();
});

window.addEventListener("keydown", (event) => {
  const map = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" };
  if (map[event.key]) {
    event.preventDefault();
    move(map[event.key]);
  }
});

let touchStart = null;
boardEl.addEventListener("touchstart", (event) => {
  const touch = event.touches[0];
  touchStart = { x: touch.clientX, y: touch.clientY };
}, { passive: true });

boardEl.addEventListener("touchend", (event) => {
  if (!touchStart) return;
  const touch = event.changedTouches[0];
  const dx = touch.clientX - touchStart.x;
  const dy = touch.clientY - touchStart.y;
  touchStart = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 28) return;
  move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
}, { passive: true });
