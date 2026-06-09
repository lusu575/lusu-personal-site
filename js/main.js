// 第一版使用静态示例数据，后续可以直接替换这里的标题、链接和简介。
const translations = {
  zh: {
    siteName: "鲁肃的个人站",
    homeLead: "欢迎来到我的 XP 像素桌面，随便点开一个文件夹看看吧。",
    navKnowledge: "知识库",
    navVideos: "视频区",
    navResources: "资源区",
    navBlog: "杂谈区",
    navAbout: "关于我",
    knowledgeTitle: "知识库",
    videosTitle: "视频区",
    resourcesTitle: "资源区",
    blogTitle: "杂谈区",
    aboutTitle: "关于我",
    toolbarBack: "返回桌面",
    toolbarRefresh: "刷新",
    knowledgePath: "我的电脑 / 鲁肃 / 知识库",
    readButton: "阅读",
    playButton: "播放",
    downloadButton: "下载",
    externalButton: "外部链接",
    openOriginal: "打开原地址",
    videoPlaceholder: "这里预留 Bilibili / YouTube 嵌入播放器。",
    startButton: "开始 Start",
    lastUpdated: "最后更新：2026.06.09",
    all: "全部",
    nicknameLabel: "昵称",
    nicknameValue: "鲁肃",
    interestLabel: "兴趣",
    interestValue: "AI / 游戏 / VRChat / 工具折腾",
    contactLabel: "联系方式",
    contactValue: "暂留空",
    statusLabel: "网站状态",
    statusValue: "持续建设中",
    aboutCopy: "你好，我是鲁肃。这里是我的个人站，用来记录 AI、游戏、VRChat、工具、资源和一些杂谈。"
  },
  en: {
    siteName: "LuSu's Personal Site",
    homeLead: "Welcome to my XP pixel desktop. Pick a folder and have a look around.",
    navKnowledge: "Knowledge Base",
    navVideos: "Videos",
    navResources: "Resources",
    navBlog: "Blog / Talk",
    navAbout: "About Me",
    knowledgeTitle: "Knowledge Base",
    videosTitle: "Videos",
    resourcesTitle: "Resources",
    blogTitle: "Blog / Talk",
    aboutTitle: "About Me",
    toolbarBack: "Back to Desktop",
    toolbarRefresh: "Refresh",
    knowledgePath: "My Computer / LuSu / Knowledge Base",
    readButton: "Read",
    playButton: "Play",
    downloadButton: "Download",
    externalButton: "External Link",
    openOriginal: "Open Original",
    videoPlaceholder: "Bilibili / YouTube embed player is reserved here.",
    startButton: "Start",
    lastUpdated: "Last updated: 2026.06.09",
    all: "All",
    nicknameLabel: "Nickname",
    nicknameValue: "LuSu",
    interestLabel: "Interests",
    interestValue: "AI / Games / VRChat / Tool experiments",
    contactLabel: "Contact",
    contactValue: "Blank for now",
    statusLabel: "Site Status",
    statusValue: "Under construction",
    aboutCopy: "Hi, I'm LuSu. This is my personal site for AI notes, games, VRChat projects, tools, resources and random thoughts."
  },
  ja: {
    siteName: "魯粛の個人サイト",
    homeLead: "XP風ピクセルデスクトップへようこそ。フォルダーを開いて見てください。",
    navKnowledge: "知識ベース",
    navVideos: "動画エリア",
    navResources: "リソース",
    navBlog: "雑談",
    navAbout: "プロフィール",
    knowledgeTitle: "知識ベース",
    videosTitle: "動画エリア",
    resourcesTitle: "リソース",
    blogTitle: "雑談",
    aboutTitle: "プロフィール",
    toolbarBack: "デスクトップへ戻る",
    toolbarRefresh: "更新",
    knowledgePath: "マイコンピュータ / 魯粛 / 知識ベース",
    readButton: "読む",
    playButton: "再生",
    downloadButton: "ダウンロード",
    externalButton: "外部リンク",
    openOriginal: "元のページを開く",
    videoPlaceholder: "Bilibili / YouTube の埋め込みプレイヤー用スペースです。",
    startButton: "スタート",
    lastUpdated: "最終更新：2026.06.09",
    all: "すべて",
    nicknameLabel: "ニックネーム",
    nicknameValue: "魯粛",
    interestLabel: "興味",
    interestValue: "AI / ゲーム / VRChat / ツールいじり",
    contactLabel: "連絡先",
    contactValue: "未設定",
    statusLabel: "サイト状態",
    statusValue: "建設中",
    aboutCopy: "こんにちは、魯粛です。ここはAI、ゲーム、VRChat、ツール、リソース、雑談を記録する個人サイトです。"
  }
};

const labels = {
  zh: {
    knowledgeCategories: ["AI工具", "本地模型", "VRChat / Unity", "应用商店运营", "日语学习", "踩坑记录"],
    videoCategories: ["VRChat作品", "AI实验", "游戏录像", "收藏视频", "网站更新记录"],
    resourceCategories: ["软件工具", "配置文件", "素材包", "文档资料", "插件", "模型链接"],
    version: "版本",
    size: "大小",
    updated: "更新时间",
    type: "类型",
    date: "日期"
  },
  en: {
    knowledgeCategories: ["AI Tools", "Local Models", "VRChat / Unity", "App Store Ops", "Japanese Study", "Pitfall Notes"],
    videoCategories: ["VRChat Works", "AI Experiments", "Game Records", "Saved Videos", "Site Updates"],
    resourceCategories: ["Software Tools", "Config Files", "Asset Packs", "Docs", "Plugins", "Model Links"],
    version: "Version",
    size: "Size",
    updated: "Updated",
    type: "Type",
    date: "Date"
  },
  ja: {
    knowledgeCategories: ["AIツール", "ローカルモデル", "VRChat / Unity", "アプリストア運用", "日本語学習", "失敗メモ"],
    videoCategories: ["VRChat作品", "AI実験", "ゲーム録画", "お気に入り動画", "サイト更新記録"],
    resourceCategories: ["ソフトウェア", "設定ファイル", "素材パック", "資料", "プラグイン", "モデルリンク"],
    version: "バージョン",
    size: "サイズ",
    updated: "更新日",
    type: "種類",
    date: "日付"
  }
};

const content = {
  knowledge: [
    {
      category: 0,
      tags: ["AI", "Local Model"],
      updated: "2026.06.09",
      title: { zh: "LM Studio 入门记录", en: "LM Studio Starter Notes", ja: "LM Studio 入門メモ" },
      desc: {
        zh: "记录本地模型工具的安装、加载模型和基础聊天流程。",
        en: "Notes on installing a local model tool, loading models, and starting basic chats.",
        ja: "ローカルモデルツールの導入、モデル読み込み、基本チャットの記録。"
      }
    },
    {
      category: 0,
      tags: ["Bot", "Translate"],
      updated: "2026.06.09",
      title: { zh: "Discord 翻译机器人搭建笔记", en: "Discord Translation Bot Notes", ja: "Discord 翻訳ボット構築メモ" },
      desc: {
        zh: "整理频道翻译、权限配置和常见报错的处理方式。",
        en: "Channel translation setup, permission notes, and common error handling.",
        ja: "チャンネル翻訳、権限設定、よくあるエラー対応のまとめ。"
      }
    },
    {
      category: 2,
      tags: ["VRChat", "Unity"],
      updated: "2026.06.08",
      title: { zh: "VRChat 世界制作踩坑", en: "VRChat World Building Pitfalls", ja: "VRChat ワールド制作の失敗メモ" },
      desc: {
        zh: "记录 Unity 场景、材质、碰撞体和上传流程里遇到的问题。",
        en: "Issues found in Unity scenes, materials, colliders, and upload flow.",
        ja: "Unityシーン、マテリアル、コライダー、アップロード手順の問題記録。"
      }
    },
    {
      category: 3,
      tags: ["Store", "Ads"],
      updated: "2026.06.07",
      title: { zh: "应用商店广告收入探索", en: "App Store Ad Revenue Exploration", ja: "アプリストア広告収益の探索" },
      desc: {
        zh: "把广告、转化和资源投放的观察先记成轻量笔记。",
        en: "Light notes on ads, conversion, and resource placement.",
        ja: "広告、転換率、リソース配置についての軽い観察メモ。"
      }
    },
    {
      category: 4,
      tags: ["JP", "Phrase"],
      updated: "2026.06.06",
      title: { zh: "日语常用表达整理", en: "Common Japanese Expressions", ja: "日本語のよく使う表現整理" },
      desc: {
        zh: "收集日常沟通、游戏聊天和视频评论中常见的说法。",
        en: "Everyday phrases for chat, games, and video comments.",
        ja: "日常会話、ゲームチャット、動画コメントで使う表現集。"
      }
    }
  ],
  videos: [
    {
      category: 0,
      platform: "Bilibili",
      color: "linear-gradient(135deg, #9fe7ff, #1d8bd1)",
      url: "https://www.bilibili.com/",
      title: { zh: "VRChat 小世界展示", en: "VRChat Small World Showcase", ja: "VRChat 小さなワールド紹介" },
      desc: { zh: "示例视频卡片，后续替换为真实 B站链接。", en: "A sample card to be replaced with a real Bilibili link.", ja: "あとで実際のBilibiliリンクに置き換えるサンプルカード。" }
    },
    {
      category: 1,
      platform: "YouTube",
      color: "linear-gradient(135deg, #ff9b9b, #d71818)",
      url: "https://www.youtube.com/",
      title: { zh: "AI 工具实验记录", en: "AI Tool Experiment Log", ja: "AIツール実験記録" },
      desc: { zh: "用于展示 AI 测试、模型对比或工作流演示。", en: "For AI tests, model comparisons, or workflow demos.", ja: "AIテスト、モデル比較、ワークフローデモ用。" }
    },
    {
      category: 2,
      platform: "Bilibili",
      color: "linear-gradient(135deg, #ffe680, #73c957)",
      url: "https://www.bilibili.com/",
      title: { zh: "游戏录像片段", en: "Gameplay Clip", ja: "ゲーム録画クリップ" },
      desc: { zh: "放一些游戏体验和高光时刻。", en: "Game moments and highlight clips.", ja: "ゲーム体験やハイライトを置く場所。" }
    },
    {
      category: 4,
      platform: "YouTube",
      color: "linear-gradient(135deg, #b5a8ff, #245edc)",
      url: "https://www.youtube.com/",
      title: { zh: "网站更新记录 001", en: "Site Update Log 001", ja: "サイト更新記録 001" },
      desc: { zh: "记录个人站的版本变化和施工进度。", en: "Version changes and build progress for the site.", ja: "個人サイトのバージョン変更と制作進捗。" }
    }
  ],
  resources: [
    {
      category: 0,
      icon: "🧰",
      version: "v1.0.0",
      size: "12MB",
      updated: "2026.06.09",
      external: false,
      title: { zh: "示例工具包", en: "Sample Toolkit", ja: "サンプルツールキット" },
      desc: { zh: "用于整理本地 AI 工具的小工具占位。", en: "A placeholder utility for organizing local AI tools.", ja: "ローカルAIツール整理用のサンプル。" }
    },
    {
      category: 2,
      icon: "📦",
      version: "v0.2.1",
      size: "128MB",
      updated: "2026.06.08",
      external: true,
      title: { zh: "VRChat 素材包", en: "VRChat Asset Pack", ja: "VRChat 素材パック" },
      desc: { zh: "较大的素材包建议放网盘、R2 或 GitHub Release。", en: "Large packs can live on cloud drive, R2, or GitHub Releases.", ja: "大きい素材はクラウド、R2、GitHub Releaseに置く想定。" }
    },
    {
      category: 1,
      icon: "⚙️",
      version: "v1.3",
      size: "24KB",
      updated: "2026.06.07",
      external: false,
      title: { zh: "本地模型配置模板", en: "Local Model Config Template", ja: "ローカルモデル設定テンプレート" },
      desc: { zh: "保存常用参数和启动配置的示例文件。", en: "Sample file for common parameters and launch settings.", ja: "よく使うパラメータと起動設定のサンプル。" }
    }
  ],
  blog: [
    {
      tags: ["网站", "日常", "记录"],
      date: "2026.06.09",
      title: { zh: "网站更新日志 001", en: "Site Update Log 001", ja: "サイト更新ログ 001" },
      desc: { zh: "第一版个人站原型开始施工，目标是打开像进入 XP 桌面。", en: "The first prototype begins, aiming to feel like entering an XP desktop.", ja: "初版プロトタイプ制作開始。XPデスクトップに入る感覚を目指す。" }
    },
    {
      tags: ["AI", "观察"],
      date: "2026.06.08",
      title: { zh: "最近对 AI 工具的一点观察", en: "Recent Notes on AI Tools", ja: "最近のAIツール観察" },
      desc: { zh: "把零散体验写在这里，不追求严肃但保留有用细节。", en: "Loose impressions live here, casual but still useful.", ja: "ゆるい感想をここに残す。気軽だけど役に立つ細部も残す。" }
    },
    {
      tags: ["游戏", "碎碎念"],
      date: "2026.06.06",
      title: { zh: "游戏体验临时记录", en: "Temporary Game Notes", ja: "ゲーム体験の一時メモ" },
      desc: { zh: "适合放游戏里的想法、截图说明和短记录。", en: "For game thoughts, screenshot notes, and short records.", ja: "ゲームの感想、スクショ説明、短い記録用。" }
    }
  ]
};

let currentLang = "zh";
const activeFilters = {
  knowledge: "all",
  videos: "all",
  resources: "all"
};

const pageIds = ["home", "knowledge", "videos", "resources", "blog", "about"];

function t(key) {
  return translations[currentLang][key] || translations.zh[key] || key;
}

function label(key) {
  return labels[currentLang][key];
}

function localText(value) {
  return value[currentLang] || value.zh || "";
}

function setLanguage(lang) {
  currentLang = lang;
  document.documentElement.lang = lang === "zh" ? "zh-CN" : lang;
  document.title = t("siteName");

  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });

  document.querySelectorAll(".lang-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.lang === lang);
  });

  document.getElementById("tray-lang").textContent = lang === "zh" ? "中文" : lang === "en" ? "EN" : "日本語";
  renderAll();
}

function navigate(route) {
  const nextRoute = pageIds.includes(route) ? route : "home";
  document.querySelectorAll(".page").forEach((page) => {
    page.classList.toggle("active", page.id === nextRoute);
  });
  document.querySelectorAll(".taskbar-tabs button").forEach((button) => {
    button.classList.toggle("active", button.dataset.route === nextRoute);
  });
  window.location.hash = nextRoute === "home" ? "" : nextRoute;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderCategoryButtons(targetId, type, categories) {
  const target = document.getElementById(targetId);
  const allLabel = t("all");
  const buttons = [allLabel, ...categories].map((name, index) => {
    const value = index === 0 ? "all" : String(index - 1);
    return `<button class="${activeFilters[type] === value ? "active " : ""}${type === "knowledge" ? "category-button" : ""}" data-filter-type="${type}" data-filter="${value}">${name}</button>`;
  });
  target.innerHTML = buttons.join("");
}

function renderKnowledge() {
  renderCategoryButtons("knowledge-categories", "knowledge", label("knowledgeCategories"));
  const list = document.getElementById("knowledge-list");
  const items = content.knowledge.filter((item) => activeFilters.knowledge === "all" || String(item.category) === activeFilters.knowledge);

  list.innerHTML = items.map((item) => `
    <article class="article-card">
      <h3>${localText(item.title)}</h3>
      <p>${localText(item.desc)}</p>
      <div class="meta-row">
        ${item.tags.map((tag) => `<span class="tag">${tag}</span>`).join("")}
        <span>${label("updated")}：${item.updated}</span>
      </div>
      <button class="card-action">${t("readButton")}</button>
    </article>
  `).join("");
}

function renderVideos() {
  renderCategoryButtons("video-categories", "videos", label("videoCategories"));
  const list = document.getElementById("video-list");
  const items = content.videos.filter((item) => activeFilters.videos === "all" || String(item.category) === activeFilters.videos);

  list.innerHTML = items.map((item, index) => `
    <article class="video-card">
      <div class="video-thumb" style="--thumb-bg: ${item.color}"></div>
      <div class="video-body">
        <span class="platform ${item.platform.toLowerCase()}">${item.platform}</span>
        <h3>${localText(item.title)}</h3>
        <p>${localText(item.desc)}</p>
        <button class="card-action" data-video-index="${content.videos.indexOf(item)}">${t("playButton")}</button>
      </div>
    </article>
  `).join("");
}

function renderResources() {
  renderCategoryButtons("resource-categories", "resources", label("resourceCategories"));
  const list = document.getElementById("resource-list");
  const items = content.resources.filter((item) => activeFilters.resources === "all" || String(item.category) === activeFilters.resources);

  list.innerHTML = items.map((item) => `
    <article class="resource-card">
      <div class="resource-main">
        <h3><span class="resource-icon">${item.icon}</span>${localText(item.title)}</h3>
        <p>${localText(item.desc)}</p>
        <div class="meta-row">
          <span>${label("type")}：${label("resourceCategories")[item.category]}</span>
          <span>${label("version")}：${item.version}</span>
          <span>${label("size")}：${item.size}</span>
          <span>${label("updated")}：${item.updated}</span>
        </div>
      </div>
      <a class="card-action" href="#" aria-label="${localText(item.title)}">${item.external ? t("externalButton") : t("downloadButton")}</a>
    </article>
  `).join("");
}

function renderBlog() {
  const list = document.getElementById("blog-list");
  list.innerHTML = content.blog.map((item) => `
    <article class="blog-card">
      <h3>${localText(item.title)}</h3>
      <p>${localText(item.desc)}</p>
      <div class="meta-row">
        <span>${label("date")}：${item.date}</span>
        ${item.tags.map((tag) => `<span class="tag">${tag}</span>`).join("")}
      </div>
      <button class="card-action">${t("readButton")}</button>
    </article>
  `).join("");
}

function renderAll() {
  renderKnowledge();
  renderVideos();
  renderResources();
  renderBlog();
}

function openVideo(index) {
  const video = content.videos[index];
  const modal = document.getElementById("video-modal");
  document.getElementById("modal-title").textContent = localText(video.title);
  document.getElementById("video-link").href = video.url;
  modal.hidden = false;
}

function closeVideo() {
  document.getElementById("video-modal").hidden = true;
}

document.addEventListener("click", (event) => {
  const routeButton = event.target.closest("[data-route]");
  if (routeButton) {
    navigate(routeButton.dataset.route);
    return;
  }

  const langButton = event.target.closest("[data-lang]");
  if (langButton) {
    setLanguage(langButton.dataset.lang);
    return;
  }

  const filterButton = event.target.closest("[data-filter-type]");
  if (filterButton) {
    activeFilters[filterButton.dataset.filterType] = filterButton.dataset.filter;
    renderAll();
    return;
  }

  const videoButton = event.target.closest("[data-video-index]");
  if (videoButton) {
    openVideo(Number(videoButton.dataset.videoIndex));
    return;
  }

  if (event.target.closest("[data-close-modal]")) {
    closeVideo();
  }
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeVideo();
  }
});

window.addEventListener("hashchange", () => {
  navigate(window.location.hash.replace("#", ""));
});

setLanguage("zh");
navigate(window.location.hash.replace("#", "") || "home");
