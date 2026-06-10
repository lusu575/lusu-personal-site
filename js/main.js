const siteUpdated = "2026.06.10";
const pageParams = new URLSearchParams(window.location.search);

const translations = {
  zh: {
    siteName: "鲁肃的个人站 · LuSu's Personal Site",
    heroTitle: "鲁肃的个人站",
    homeLead: "欢迎来到我的小站，还在施工中，您可以四处浏览一下。",
    navKnowledge: "知识库",
    navVideos: "视频区",
    navResources: "资源区",
    navGames: "游戏区",
    navBlog: "杂谈区",
    navChatroom: "匿名聊天室",
    navAbout: "关于我",
    capKnowledge: "笔记 · 教程 · 想法",
    capVideos: "作品 · 翻译 · 收藏",
    capResources: "软件 · 素材 · 工具",
    capGames: "H5游戏 · 挂机游戏",
    capBlog: "随想 · 日常 · 分享",
    capAbout: "个人介绍 · 联系方式",
    knowledgeTitle: "知识库",
    videosTitle: "视频区",
    resourcesTitle: "资源区",
    gamesTitle: "游戏区",
    blogTitle: "杂谈区",
    chatroomTitle: "XP 匿名聊天室 - LuSu's Chat Room",
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
    startButton: "首页",
    lastUpdatedLabel: "最近更新日期",
    all: "全部",
    nicknameLabel: "昵称",
    nicknameValue: "鲁肃",
    interestLabel: "兴趣",
    interestValue: "AI / 游戏 / 工具折腾",
    contactLabel: "联系方式",
    contactValue: "暂留空",
    statusLabel: "网站状态",
    statusValue: "持续建设中",
    aboutCopy: "你好，我是鲁肃。这里是我的个人站，用来记录 AI、游戏、工具、资源和一些杂谈。",
    welcomeTitle: "欢迎来到鲁肃的像素桌面",
    welcomeHeading: "新头像和移动端整理完成啦！",
    welcomeCopy: "这次换上了新的电视机头像，公告、账号窗口、视频区、资源区和内置游戏也重新适配了手机端。",
    quickEntry: "快捷入口",
    goKnowledge: "进入知识库",
    goVideos: "看看视频",
    goGames: "打开游戏区",
    recentUpdates: "最近更新",
    moreUpdates: "查看更多更新",
    chatNicknameLabel: "我的昵称：",
    chatEditNickname: "修改昵称",
    chatSyncStatus: "每 5 秒自动刷新",
    chatInputLabel: "聊天内容",
    chatPlaceholder: "说点什么吧...",
    chatSend: "发送",
    chatCooldownHint: "每 3 秒可发送一条消息哦~",
    chatAutoscroll: "自动滚动",
    chatWelcome: "欢迎来到鲁肃的匿名聊天室！请文明发言哦~",
    chatLoading: "正在连接聊天室...",
    chatLoadFailed: "聊天室读取失败，请稍后再试。",
    chatEmptyMessage: "空消息不可发送。",
    chatTooLong: "单条消息最多 300 字。",
    chatCooldown: "发送太快啦，请等 3 秒。",
    chatNicknamePrompt: "请输入 2-16 个字符的新昵称：",
    chatNicknameInvalid: "昵称需要 2-16 个字符，不能是空白。",
    chatNicknameSaved: "昵称已更新，后续发言会使用新昵称。",
    chatSent: "已发送。"
  },
  en: {
    siteName: "LuSu's Personal Site",
    heroTitle: "LuSu's Personal Site",
    homeLead: "Welcome to my little site. It is still under construction, but feel free to look around.",
    navKnowledge: "Knowledge",
    navVideos: "Videos",
    navResources: "Resources",
    navGames: "Games",
    navBlog: "Talk",
    navChatroom: "Chat Room",
    navAbout: "About",
    capKnowledge: "Notes · Tutorials · Ideas",
    capVideos: "Works · Translation · Saves",
    capResources: "Software · Assets · Tools",
    capGames: "H5 · Idle games",
    capBlog: "Thoughts · Daily · Sharing",
    capAbout: "Profile · Contact",
    knowledgeTitle: "Knowledge",
    videosTitle: "Videos",
    resourcesTitle: "Resources",
    gamesTitle: "Games",
    blogTitle: "Talk",
    chatroomTitle: "XP Anonymous Chat Room - LuSu's Chat Room",
    aboutTitle: "About",
    toolbarBack: "Back to Desktop",
    toolbarRefresh: "Refresh",
    knowledgePath: "My Computer / LuSu / Knowledge",
    readButton: "Read",
    playButton: "Play",
    downloadButton: "Download",
    externalButton: "External Link",
    openOriginal: "Open Original",
    videoPlaceholder: "Bilibili / YouTube embed player is reserved here.",
    startButton: "Home",
    lastUpdatedLabel: "Last updated",
    all: "All",
    nicknameLabel: "Nickname",
    nicknameValue: "LuSu",
    interestLabel: "Interests",
    interestValue: "AI / Games / Tool experiments",
    contactLabel: "Contact",
    contactValue: "Blank for now",
    statusLabel: "Site Status",
    statusValue: "Under construction",
    aboutCopy: "Hi, I'm LuSu. This is my personal site for AI notes, games, tools, resources and random thoughts.",
    welcomeTitle: "Welcome to LuSu's pixel desktop",
    welcomeHeading: "New avatar and mobile layout are ready!",
    welcomeCopy: "The site now uses the new TV-head avatar, with refreshed announcements, account popover, video/resources areas, and embedded games tuned for mobile.",
    quickEntry: "Quick Entry",
    goKnowledge: "Open Knowledge",
    goVideos: "Watch Videos",
    goGames: "Open Games",
    recentUpdates: "Recent Updates",
    moreUpdates: "More updates",
    chatNicknameLabel: "My nickname:",
    chatEditNickname: "Edit nickname",
    chatSyncStatus: "Auto refresh every 5 seconds",
    chatInputLabel: "Chat message",
    chatPlaceholder: "Say something...",
    chatSend: "Send",
    chatCooldownHint: "One message every 3 seconds.",
    chatAutoscroll: "Auto scroll",
    chatWelcome: "Welcome to LuSu's anonymous chat room. Keep it friendly!",
    chatLoading: "Connecting to chat room...",
    chatLoadFailed: "Could not load chat. Please try again later.",
    chatEmptyMessage: "Empty messages cannot be sent.",
    chatTooLong: "Messages can be up to 300 characters.",
    chatCooldown: "Too fast. Please wait 3 seconds.",
    chatNicknamePrompt: "Enter a new nickname, 2-16 characters:",
    chatNicknameInvalid: "Nickname must be 2-16 characters and cannot be blank.",
    chatNicknameSaved: "Nickname updated. Future messages will use it.",
    chatSent: "Sent."
  },
  ja: {
    siteName: "魯粛の個人サイト",
    heroTitle: "魯粛の個人サイト",
    homeLead: "私の小さなサイトへようこそ。まだ工事中ですが、自由に見て回ってください。",
    navKnowledge: "知識庫",
    navVideos: "動画",
    navResources: "リソース",
    navGames: "ゲーム",
    navBlog: "雑談",
    navChatroom: "匿名チャット",
    navAbout: "プロフィール",
    capKnowledge: "メモ · チュートリアル · 考え",
    capVideos: "作品 · 翻訳 · 保存",
    capResources: "ソフト · 素材 · ツール",
    capGames: "H5 · 放置ゲーム",
    capBlog: "思いつき · 日常 · 共有",
    capAbout: "紹介 · 連絡先",
    knowledgeTitle: "知識庫",
    videosTitle: "動画",
    resourcesTitle: "リソース",
    gamesTitle: "ゲーム",
    blogTitle: "雑談",
    chatroomTitle: "XP 匿名チャット - LuSu's Chat Room",
    aboutTitle: "プロフィール",
    toolbarBack: "デスクトップへ戻る",
    toolbarRefresh: "更新",
    knowledgePath: "マイコンピュータ / 魯粛 / 知識庫",
    readButton: "読む",
    playButton: "再生",
    downloadButton: "ダウンロード",
    externalButton: "外部リンク",
    openOriginal: "元のページを開く",
    videoPlaceholder: "Bilibili / YouTube の埋め込みプレイヤー用スペースです。",
    startButton: "ホーム",
    lastUpdatedLabel: "最終更新日",
    all: "すべて",
    nicknameLabel: "ニックネーム",
    nicknameValue: "魯粛",
    interestLabel: "興味",
    interestValue: "AI / ゲーム / ツールいじり",
    contactLabel: "連絡先",
    contactValue: "未設定",
    statusLabel: "サイト状態",
    statusValue: "建設中",
    aboutCopy: "こんにちは、魯粛です。ここはAI、ゲーム、ツール、リソース、雑談を記録する個人サイトです。",
    welcomeTitle: "魯粛のピクセルデスクトップへようこそ",
    welcomeHeading: "新しいアバターとスマホ表示を整えました！",
    welcomeCopy: "新しいテレビ頭のアバターに差し替え、告知、アカウント画面、動画・リソース欄、内蔵ゲームをスマホ向けに調整しました。",
    quickEntry: "クイック入口",
    goKnowledge: "知識庫へ",
    goVideos: "動画を見る",
    goGames: "ゲームへ",
    recentUpdates: "最近の更新",
    moreUpdates: "もっと見る",
    chatNicknameLabel: "ニックネーム：",
    chatEditNickname: "変更",
    chatSyncStatus: "5秒ごとに自動更新",
    chatInputLabel: "チャット本文",
    chatPlaceholder: "何か話してみよう...",
    chatSend: "送信",
    chatCooldownHint: "3秒に1通送れます。",
    chatAutoscroll: "自動スクロール",
    chatWelcome: "魯粛の匿名チャットへようこそ！やさしく話しましょう。",
    chatLoading: "チャットに接続中...",
    chatLoadFailed: "チャットを読み込めません。あとで試してください。",
    chatEmptyMessage: "空のメッセージは送れません。",
    chatTooLong: "1通は最大300文字です。",
    chatCooldown: "送信が速すぎます。3秒待ってください。",
    chatNicknamePrompt: "2-16文字の新しいニックネームを入力：",
    chatNicknameInvalid: "ニックネームは2-16文字で、空白のみは使えません。",
    chatNicknameSaved: "ニックネームを更新しました。次の発言から反映されます。",
    chatSent: "送信しました。"
  }
};

const labels = {
  zh: {
    knowledgeCategories: ["AI工具", "本地模型", "VRChat / Unity", "日语学习", "踩坑记录"],
    videoCategories: ["VRChat作品", "AI实验", "游戏录像", "收藏视频", "网站更新记录"],
    resourceCategories: ["软件工具", "配置文件", "素材包", "文档资料", "插件", "模型链接"],
    version: "版本",
    size: "大小",
    updated: "更新时间",
    type: "类型",
    date: "日期"
  },
  en: {
    knowledgeCategories: ["AI Tools", "Local Models", "VRChat / Unity", "Japanese Study", "Pitfall Notes"],
    videoCategories: ["VRChat Works", "AI Experiments", "Game Records", "Saved Videos", "Site Updates"],
    resourceCategories: ["Software Tools", "Config Files", "Asset Packs", "Docs", "Plugins", "Model Links"],
    version: "Version",
    size: "Size",
    updated: "Updated",
    type: "Type",
    date: "Date"
  },
  ja: {
    knowledgeCategories: ["AIツール", "ローカルモデル", "VRChat / Unity", "日本語学習", "失敗メモ"],
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
  updates: [
    {
      icon: "💬",
      date: "2026.06.10",
      title: { zh: "匿名聊天室 MVP 上线", en: "Anonymous chat MVP added", ja: "匿名チャットMVPを追加" },
      desc: { zh: "访客可用随机昵称直接发言，消息保存到 Cloudflare D1", en: "Visitors can chat with random nicknames, backed by Cloudflare D1", ja: "ランダム名で発言でき、Cloudflare D1に保存されます" }
    },
    {
      icon: "📺",
      date: "2026.06.10",
      title: { zh: "电视机头像与站点图标更新", en: "TV avatar and site icon updated", ja: "テレビ頭アバターとサイトアイコンを更新" },
      desc: { zh: "首页品牌、关于我入口和头像已换新", en: "Brand icon, About entry, and profile avatar are refreshed", ja: "ブランド、プロフィール入口、头像を差し替えました" }
    },
    {
      icon: "📱",
      date: "2026.06.10",
      title: { zh: "手机端显示重新适配", en: "Mobile layout retuned", ja: "スマホ表示を再調整" },
      desc: { zh: "顶部、登录窗口、公告窗口、视频区和资源区更省空间", en: "Top bar, login, announcements, videos, and resources now use space better", ja: "上部栏、ログイン、告知、動画、リソース欄を省スペース化" }
    },
    {
      icon: "🎮",
      date: "2026.06.10",
      title: { zh: "内置游戏窗口适配小屏幕", en: "Embedded games fit small screens better", ja: "内蔵ゲームを小画面向けに調整" },
      desc: { zh: "游戏工具栏和 iframe 高度会跟随屏幕调整", en: "Game tools and iframe height now respond to the viewport", ja: "ゲームツールと iframe 高さが画面に合わせて変化します" }
    }
  ],
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
  games: [],
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
let authUser = null;

const pageIds = ["home", "knowledge", "videos", "resources", "games", "blog", "chatroom", "about"];

const chatStorageKeys = {
  visitorId: "lusu-chat-visitor-id",
  nickname: "lusu-chat-nickname",
  lastSentAt: "lusu-chat-last-sent-at"
};

const chatState = {
  initialized: false,
  loading: false,
  visitorId: "",
  nickname: "",
  lastMessageId: "",
  seenMessageIds: new Set(),
  pollTimer: null,
  lastSentAt: Number(localStorage.getItem(chatStorageKeys.lastSentAt) || "0")
};

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
  document.title = t("heroTitle");

  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    node.setAttribute("placeholder", t(node.dataset.i18nPlaceholder));
  });

  document.querySelectorAll(".lang-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.lang === lang);
  });

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
  if (nextRoute === "chatroom") {
    initChatroom();
  }
  window.location.hash = nextRoute === "home" ? "" : nextRoute;
  window.scrollTo({ top: 0, behavior: "auto" });
}

function renderCategoryButtons(targetId, type, categories) {
  const target = document.getElementById(targetId);
  const buttons = [t("all"), ...categories].map((name, index) => {
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

  list.innerHTML = items.map((item) => `
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

async function loadGameCatalog() {
  const response = await fetch("games/catalog.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

async function renderGames() {
  const list = document.getElementById("game-list");
  list.innerHTML = `<p class="loading-text">正在读取游戏配置...</p>`;
  try {
    const catalog = await loadGameCatalog();
    list.innerHTML = catalog.games.map((item) => `
        <article class="game-card">
          <img class="game-cover" src="${item.cover.replace("../", "")}" alt="${item.titleZh} 封面" loading="lazy">
          <div>
            <h3>${item.titleZh}</h3>
            <p>${item.summary}</p>
            <div class="meta-row">
              <span class="tag">${item.title}</span>
              <span class="tag">${item.license.name}</span>
              <span>${item.language}</span>
            </div>
          </div>
          <a class="card-action" href="games/${item.entry}">开始</a>
        </article>
      `).join("");
  } catch (error) {
    list.innerHTML = `<p class="loading-text">游戏配置读取失败：${error.message}</p>`;
  }
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

function renderUpdates() {
  const list = document.getElementById("recent-updates");
  list.innerHTML = content.updates.map((item) => `
    <li>
      <span class="update-icon">${item.icon}</span>
      <span>
        <strong>${localText(item.title)}</strong>
        <small>${localText(item.desc)}<br>${item.date}</small>
      </span>
    </li>
  `).join("");
}

function renderAll() {
  document.getElementById("top-updated").textContent = siteUpdated;
  renderKnowledge();
  renderVideos();
  renderResources();
  renderGames();
  renderBlog();
  renderUpdates();
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

function closeWelcome() {
  document.getElementById("welcome-modal").hidden = true;
}

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function maybeShowWelcome() {
  if (pageParams.get("welcome") === "0") {
    return;
  }
  const today = localDateKey(new Date());
  const key = `lusu-welcome-seen-${today}`;
  if (localStorage.getItem(key) === "1") {
    return;
  }
  document.getElementById("welcome-modal").hidden = false;
  localStorage.setItem(key, "1");
}

function updateClock() {
  const formatter = new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
  document.getElementById("local-time").textContent = formatter.format(new Date()).replace(/\//g, ".");
}

async function accountApi(path, options = {}) {
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

function renderAccountWidget(message = "") {
  const widget = document.getElementById("account-widget");
  if (!widget) {
    return;
  }

  if (authUser) {
    widget.innerHTML = `
      <button class="account-button signed-in" type="button" data-account-toggle>
        <span>账号：${escapeHtml(authUser.email)}</span>
      </button>
      <div class="account-popover" id="account-popover" hidden>
        <div class="account-signed-in">
          <strong>云存档账号</strong>
          <p class="account-note">${escapeHtml(authUser.email)}</p>
          <p class="account-note">网站可以正常浏览；进入游戏后会自动同步云端存档。</p>
          ${message ? `<p class="account-note">${escapeHtml(message)}</p>` : ""}
          <div class="account-actions">
            <button class="account-button" type="button" data-account-logout>退出账号</button>
          </div>
        </div>
      </div>
    `;
    return;
  }

  widget.innerHTML = `
    <button class="account-button" type="button" data-account-toggle>
      <span>登录</span>
    </button>
    <div class="account-popover" id="account-popover" hidden>
      <form class="account-form" id="account-form">
        <strong>云存档账号</strong>
        <input name="email" type="email" autocomplete="email" placeholder="邮箱" required>
        <input name="password" type="password" autocomplete="current-password" placeholder="密码至少 8 位" required>
        <div class="account-actions">
          <button class="account-button" type="submit" data-mode="login">登录</button>
          <button class="account-button" type="submit" data-mode="register">注册</button>
        </div>
        <p class="account-note">${message ? escapeHtml(message) : "登录只用于游戏自动云存档，网站浏览不受影响。"}</p>
      </form>
    </div>
  `;

  document.getElementById("account-form")?.addEventListener("submit", submitAccountForm);
}

async function initAccountWidget() {
  renderAccountWidget();
  try {
    const payload = await accountApi("/api/auth/me");
    authUser = payload.user || null;
    renderAccountWidget();
  } catch {
    renderAccountWidget("云存档接口暂时不可用。");
  }
}

async function submitAccountForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const mode = event.submitter?.dataset.mode || "login";
  try {
    const payload = await accountApi(`/api/auth/${mode}`, {
      method: "POST",
      body: JSON.stringify({
        email: form.email.value.trim(),
        password: form.password.value
      })
    });
    authUser = payload.user;
    renderAccountWidget("已登录。");
    openAccountPopover();
  } catch (error) {
    renderAccountWidget(error.message);
    openAccountPopover();
  }
}

async function logoutAccount() {
  try {
    await accountApi("/api/auth/logout", { method: "POST", body: "{}" });
  } catch {
    // Keep the UI responsive even if the network is gone.
  }
  authUser = null;
  renderAccountWidget("已退出账号。");
  openAccountPopover();
}

function openAccountPopover() {
  const popover = document.getElementById("account-popover");
  if (popover) {
    popover.hidden = false;
  }
}

function closeAccountPopover() {
  const popover = document.getElementById("account-popover");
  if (popover) {
    popover.hidden = true;
  }
}

function toggleAccountPopover() {
  const popover = document.getElementById("account-popover");
  if (popover) {
    popover.hidden = !popover.hidden;
  }
}

function ensureChatIdentity() {
  let visitorId = localStorage.getItem(chatStorageKeys.visitorId);
  if (!visitorId) {
    visitorId = crypto.randomUUID ? crypto.randomUUID() : `visitor-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(chatStorageKeys.visitorId, visitorId);
  }

  let nickname = localStorage.getItem(chatStorageKeys.nickname);
  if (!isValidChatNickname(nickname)) {
    nickname = randomChatNickname();
    localStorage.setItem(chatStorageKeys.nickname, nickname);
  }

  chatState.visitorId = visitorId;
  chatState.nickname = nickname.trim();
  updateChatNicknameDisplay();
}

function randomChatNickname() {
  const names = [
    "蓝屏小企鹅", "像素幽灵", "草地路人A", "CRT访客", "电视小粉", "泡泡旅人",
    "BluePenguin", "PixelGhost", "CRTGuest", "GrassWalker",
    "ピクセル幽霊", "CRT旅人", "草原の人"
  ];
  const suffixes = ["9527", "1024", "2333", "404", "88", "7"];
  const name = names[Math.floor(Math.random() * names.length)];
  return `${name}${suffixes[Math.floor(Math.random() * suffixes.length)]}`;
}

function isValidChatNickname(value) {
  const text = String(value || "").trim();
  const length = Array.from(text).length;
  return length >= 2 && length <= 16;
}

function updateChatNicknameDisplay() {
  const display = document.getElementById("chat-nickname-display");
  if (display) {
    display.textContent = chatState.nickname;
  }
}

function setChatFeedback(message, isError = false) {
  const feedback = document.getElementById("chat-feedback");
  if (!feedback) {
    return;
  }
  feedback.textContent = message;
  feedback.classList.toggle("is-error", isError);
}

function updateChatCounter() {
  const input = document.getElementById("chat-message-input");
  const count = document.getElementById("chat-char-count");
  if (input && count) {
    count.textContent = String(Array.from(input.value).length);
  }
}

async function initChatroom() {
  ensureChatIdentity();
  updateChatCounter();

  if (!chatState.initialized) {
    chatState.initialized = true;
    resetChatLog(t("chatLoading"));
    await refreshChatMessages({ initial: true });
  } else {
    refreshChatMessages();
  }

  startChatPolling();
}

function startChatPolling() {
  if (chatState.pollTimer) {
    return;
  }
  chatState.pollTimer = window.setInterval(() => {
    if (!document.hidden && document.getElementById("chatroom")?.classList.contains("active")) {
      refreshChatMessages();
    }
  }, 5000);
}

function resetChatLog(message) {
  const list = document.getElementById("chat-message-list");
  if (!list) {
    return;
  }
  list.replaceChildren();
  appendChatSystemMessage(message || t("chatWelcome"));
  chatState.lastMessageId = "";
  chatState.seenMessageIds.clear();
}

function appendChatSystemMessage(message) {
  const list = document.getElementById("chat-message-list");
  if (!list) {
    return;
  }
  const row = document.createElement("div");
  row.className = "chat-system-message";
  row.textContent = `— ${message} —`;
  list.appendChild(row);
}

async function refreshChatMessages(options = {}) {
  if (chatState.loading) {
    return;
  }
  chatState.loading = true;
  try {
    const params = new URLSearchParams({ limit: "100" });
    if (!options.initial && chatState.lastMessageId) {
      params.set("after", chatState.lastMessageId);
    }
    const payload = await chatApi(`/api/chat/messages?${params.toString()}`);
    if (options.initial) {
      resetChatLog(t("chatWelcome"));
    }
    appendChatMessages(payload.messages || []);
  } catch {
    if (options.initial) {
      resetChatLog(t("chatLoadFailed"));
    } else {
      setChatFeedback(t("chatLoadFailed"), true);
    }
  } finally {
    chatState.loading = false;
  }
}

function appendChatMessages(messages) {
  const list = document.getElementById("chat-message-list");
  if (!list || !messages.length) {
    return;
  }

  messages.forEach((message) => {
    if (!message.message_id || chatState.seenMessageIds.has(message.message_id)) {
      return;
    }
    chatState.seenMessageIds.add(message.message_id);
    chatState.lastMessageId = message.message_id;
    list.appendChild(createChatMessageNode(message));
  });

  const autoscroll = document.getElementById("chat-autoscroll");
  if (!autoscroll || autoscroll.checked) {
    list.scrollTop = list.scrollHeight;
  }
}

function createChatMessageNode(message) {
  const own = message.visitor_id === chatState.visitorId;
  const item = document.createElement("article");
  item.className = `chat-message${own ? " is-own" : ""}`;

  const avatar = document.createElement("img");
  avatar.className = "chat-message-avatar";
  avatar.src = "assets/images/icon-chatroom-clean.png";
  avatar.alt = "";
  avatar.setAttribute("aria-hidden", "true");

  const body = document.createElement("div");
  body.className = "chat-message-body";

  const meta = document.createElement("div");
  meta.className = "chat-message-meta";

  const name = document.createElement("strong");
  name.textContent = String(message.nickname || "");

  const time = document.createElement("time");
  time.dateTime = message.created_at || "";
  time.textContent = formatChatTime(message.created_at);

  meta.append(name, time);

  const bubble = document.createElement("p");
  bubble.className = "chat-bubble";
  bubble.textContent = String(message.content || "");

  body.append(meta, bubble);
  item.append(avatar, body);
  return item;
}

function formatChatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(date);
}

async function submitChatMessage(event) {
  event.preventDefault();
  ensureChatIdentity();

  const input = document.getElementById("chat-message-input");
  const contentText = input.value.trim();
  const contentLength = Array.from(contentText).length;
  if (!contentText) {
    setChatFeedback(t("chatEmptyMessage"), true);
    return;
  }
  if (contentLength > 300) {
    setChatFeedback(t("chatTooLong"), true);
    return;
  }
  if (Date.now() - chatState.lastSentAt < 3000) {
    setChatFeedback(t("chatCooldown"), true);
    return;
  }

  try {
    const payload = await chatApi("/api/chat/messages", {
      method: "POST",
      body: JSON.stringify({
        visitorId: chatState.visitorId,
        nickname: chatState.nickname,
        content: contentText
      })
    });
    chatState.lastSentAt = Date.now();
    localStorage.setItem(chatStorageKeys.lastSentAt, String(chatState.lastSentAt));
    input.value = "";
    updateChatCounter();
    setChatFeedback(t("chatSent"));
    appendChatMessages(payload.message ? [payload.message] : []);
    refreshChatMessages();
  } catch (error) {
    setChatFeedback(error.message || t("chatLoadFailed"), true);
  }
}

function editChatNickname() {
  ensureChatIdentity();
  const next = window.prompt(t("chatNicknamePrompt"), chatState.nickname);
  if (next === null) {
    return;
  }
  const normalized = next.trim();
  if (!isValidChatNickname(normalized)) {
    setChatFeedback(t("chatNicknameInvalid"), true);
    return;
  }
  chatState.nickname = normalized;
  localStorage.setItem(chatStorageKeys.nickname, normalized);
  updateChatNicknameDisplay();
  setChatFeedback(t("chatNicknameSaved"));
}

async function chatApi(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `HTTP ${response.status}`);
  }
  return payload;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

document.addEventListener("click", (event) => {
  if (event.target.closest("[data-account-toggle]")) {
    toggleAccountPopover();
    return;
  }

  if (event.target.closest("[data-account-logout]")) {
    logoutAccount();
    return;
  }

  const routeButton = event.target.closest("[data-route]");
  if (routeButton) {
    navigate(routeButton.dataset.route);
    closeWelcome();
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

  if (event.target.closest("[data-close-welcome]")) {
    closeWelcome();
  }

  if (!event.target.closest("#account-widget")) {
    closeAccountPopover();
  }
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeVideo();
    closeWelcome();
    closeAccountPopover();
  }
});

window.addEventListener("hashchange", () => {
  navigate(window.location.hash.replace("#", ""));
});

document.getElementById("chat-form")?.addEventListener("submit", submitChatMessage);
document.getElementById("chat-message-input")?.addEventListener("input", updateChatCounter);
document.getElementById("chat-edit-nickname")?.addEventListener("click", editChatNickname);

document.addEventListener("visibilitychange", () => {
  if (!document.hidden && document.getElementById("chatroom")?.classList.contains("active")) {
    refreshChatMessages();
  }
});

const requestedLang = pageParams.get("lang");
const initialLang = ["zh", "en", "ja"].includes(requestedLang) ? requestedLang : "zh";

setLanguage(initialLang);
initAccountWidget();
updateClock();
setInterval(updateClock, 1000);
navigate(window.location.hash.replace("#", "") || "home");
const hoverRoute = pageParams.get("hover");
if (hoverRoute) {
  document.querySelector(`.desktop-icon[data-route="${hoverRoute}"]`)?.classList.add("is-hovered");
}
window.addEventListener("load", maybeShowWelcome);
