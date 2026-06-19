const pageParams = new URLSearchParams(window.location.search);

const translations = {
  zh: {
    siteName: "鲁肃个人站",
    siteDescription: "鲁肃的个人站，一个 Windows XP、Pixel Art 和 Y2K 风格的个人空间，用来记录 AI、游戏、工具、资源、视频、知识库和杂谈。",
    heroTitle: "鲁肃的个人站",
    homeLead: "开发施工中",
    navKnowledge: "知识库",
    navVideos: "视频区",
    navVideosBuilding: "视频区",
    navResources: "资源区",
    navResourcesBuilding: "资源区（待定）",
    navGames: "游戏区",
    navBlog: "杂谈区",
    navBlogBuilding: "杂谈区（待定）",
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
    notepadMenu: "文件  编辑  查看  帮助",
    chatroomTitle: "匿名聊天室",
    aboutTitle: "关于我",
    toolbarBack: "返回桌面",
    toolbarRefresh: "刷新",
    knowledgePath: "我的电脑 / 鲁肃 / 知识库",
    siteUpdateCategory: "网站更新记录",
    welcomeStatusTitle: "站长状态：正在施工中",
    welcomeStatusCopy: "这个网站会持续加入文章、资源、小游戏和一些奇怪的小功能。",
    welcomeRecommend: "目前推荐体验：匿名聊天室、游戏区、知识库。",
    articleLoading: "正在从数据库读取文章...",
    articleLoadFailed: "文章读取失败，请稍后再试。",
    articleEmpty: "数据库里暂时还没有已发布文章。",
    articleSearchLabel: "搜索知识库",
    articleSearchPlaceholder: "搜索标题、简介、标签...",
    articleSearchClear: "清空",
    articleSearchCount: "共 {count} 篇文章",
    articleSearchFiltered: "显示 {count} / {total} 篇",
    articleSearchNoResults: "没有找到匹配的文章。",
    articleBack: "返回文章列表",
    articleCopyLink: "复制文章链接",
    articleCopyDone: "链接已复制。",
    articleCopyFailed: "复制失败，请手动复制地址栏链接。",
    articleReadProgress: "阅读进度",
    articleTocTitle: "文章目录",
    articleTocTipTitle: "小贴士",
    articleTocTip: "点击目录项可快速跳转到对应章节",
    articleScrollTop: "回到顶部",
    articlePublished: "发布时间",
    articleCategory: "分类",
    articleFallback: "当前语言版本缺失，已显示备用语言版本。",
    readButton: "阅读",
    blogPending: "整理中",
    playButton: "播放",
    startGameButton: "开始",
    openGameButton: "打开",
    downloadButton: "下载",
    externalButton: "外部链接",
    resourcePending: "准备中",
    resourcePendingTitle: "这个资源还在整理中，暂时没有下载或外链。",
    resourceStatusReady: "可获取",
    resourceEmptyTitle: "这个分类还在整理中",
    resourceEmptyBody: "可以先切回全部资源，之后这里会补上下载、素材或文档。",
    resourceEmptyAction: "显示全部资源",
    openOriginal: "打开原地址",
    videoFullscreen: "全屏",
    videoRestore: "还原",
    languageSupportLabel: "语言支持",
    gameLanguageUnsupported: "不支持",
    gameSourceLabel: "来源",
    gameCloudSaveReady: "云存档",
    gameConfigLoading: "正在读取游戏配置...",
    gameConfigFailed: "游戏配置读取失败",
    videoPlaceholder: "这里预留 Bilibili / YouTube 嵌入播放器。",
    startButton: "首页",
    lastUpdatedLabel: "最近更新日期",
    brandHomeAria: "返回桌面",
    languageSwitcherAria: "语言切换",
    desktopIconsAria: "主要栏目",
    windowMinimizeAria: "最小化窗口",
    windowMaximizeAria: "最大化窗口",
    closeWindowAria: "关闭窗口",
    closeDialogAria: "关闭对话框",
    accountSignedInPrefix: "账号：",
    accountTitle: "云存档账号",
    accountSignedInNote: "网站可以正常浏览；进入游戏后会自动同步云端存档。",
    accountLogout: "退出账号",
    accountLogin: "登录",
    accountRegister: "注册",
    accountEmailPlaceholder: "邮箱",
    accountPasswordPlaceholder: "密码至少 8 位",
    accountGuestNote: "登录只用于游戏自动云存档，网站浏览不受影响。",
    accountUnavailable: "云存档接口暂时不可用。",
    accountLoggedIn: "已登录。",
    accountLoggedOut: "已退出账号。",
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
    welcomeTitle: "欢迎",
    welcomeHeading: "新头像和移动端整理完成啦！",
    welcomeCopy: "这次换上了新的电视机头像，公告、账号窗口、视频区、资源区和内置游戏也重新适配了手机端。",
    quickEntry: "快捷入口",
    goKnowledge: "进入知识库",
    goVideos: "看看视频",
    goGames: "打开游戏区",
    recentUpdates: "最近更新",
    moreUpdates: "查看更多更新",
    rssFeed: "订阅",
    rssFeedAria: "RSS 订阅",
    chatNicknameLabel: "我的昵称：",
    chatEditNickname: "修改昵称",
    chatSyncStatus: "自动增量刷新，空闲时会降低频率",
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
    chatNicknameTaken: "这个随机昵称已经被使用，正在为你换一个新昵称。",
    chatNicknamePrompt: "请输入 2-16 个字符的新昵称：",
    chatNicknameInvalid: "昵称需要 2-16 个字符，不能是空白。",
    chatNicknameSaved: "昵称已更新，后续发言会使用新昵称。",
    chatSent: "已发送。",
    placeholderMark: "（占位符）",
    greetingMorning: "早上好",
    greetingNoon: "白天好",
    greetingAfternoon: "傍晚好",
    greetingEvening: "晚上好",
    welcomeDateLine: "今天是{year}年{month}月{day}日，很高兴见到你。"
  },
  en: {
    siteName: "LuSu Site",
    siteDescription: "LuSu's personal site, a Windows XP, pixel art, and Y2K desktop space for AI notes, games, tools, resources, videos, knowledge, and thoughts.",
    heroTitle: "LuSu Site",
    homeLead: "A small XP pixel site under construction.",
    navKnowledge: "Knowledge",
    navVideos: "Videos",
    navVideosBuilding: "Videos",
    navResources: "Resources",
    navResourcesBuilding: "Resources TBD",
    navGames: "Games",
    navBlog: "Talk",
    navBlogBuilding: "Talk TBD",
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
    notepadMenu: "File  Edit  View  Help",
    chatroomTitle: "Chat Room",
    aboutTitle: "About",
    toolbarBack: "Back to Desktop",
    toolbarRefresh: "Refresh",
    knowledgePath: "My Computer / LuSu / Knowledge",
    siteUpdateCategory: "Site Update Log",
    welcomeStatusTitle: "Owner status: under construction",
    welcomeStatusCopy: "This site will keep adding articles, resources, small games, and a few odd little features.",
    welcomeRecommend: "Recommended now: anonymous chat room, games, and knowledge base.",
    articleLoading: "Loading articles from the database...",
    articleLoadFailed: "Could not load articles. Please try again later.",
    articleEmpty: "No published articles are in the database yet.",
    articleSearchLabel: "Search knowledge",
    articleSearchPlaceholder: "Search titles, summaries, tags...",
    articleSearchClear: "Clear",
    articleSearchCount: "{count} articles",
    articleSearchFiltered: "Showing {count} / {total}",
    articleSearchNoResults: "No matching articles found.",
    articleBack: "Back to article list",
    articleCopyLink: "Copy article link",
    articleCopyDone: "Link copied.",
    articleCopyFailed: "Copy failed. Please copy the address bar link manually.",
    articleReadProgress: "Reading progress",
    articleTocTitle: "Contents",
    articleTocTipTitle: "Tip",
    articleTocTip: "Click a contents item to jump to that section.",
    articleScrollTop: "Back to top",
    articlePublished: "Published",
    articleCategory: "Category",
    articleFallback: "This language is missing, so a fallback language is shown.",
    readButton: "Read",
    blogPending: "Drafting",
    playButton: "Play",
    startGameButton: "Start",
    openGameButton: "Open",
    downloadButton: "Download",
    externalButton: "External Link",
    resourcePending: "Coming soon",
    resourcePendingTitle: "This resource is still being organized and has no download or external link yet.",
    resourceStatusReady: "Ready",
    resourceEmptyTitle: "This category is still being organized",
    resourceEmptyBody: "Switch back to all resources for now. Downloads, assets, or docs can be added here later.",
    resourceEmptyAction: "Show all resources",
    openOriginal: "Open Original",
    videoFullscreen: "Full screen",
    videoRestore: "Restore",
    languageSupportLabel: "Language support",
    gameLanguageUnsupported: "not supported",
    gameSourceLabel: "Source",
    gameCloudSaveReady: "Cloud save",
    gameConfigLoading: "Loading game catalog...",
    gameConfigFailed: "Could not load game catalog",
    videoPlaceholder: "Bilibili / YouTube embed player is reserved here.",
    startButton: "Home",
    lastUpdatedLabel: "Last updated",
    brandHomeAria: "Back to desktop",
    languageSwitcherAria: "Language switcher",
    desktopIconsAria: "Main sections",
    windowMinimizeAria: "Minimize window",
    windowMaximizeAria: "Maximize window",
    closeWindowAria: "Close window",
    closeDialogAria: "Close dialog",
    accountSignedInPrefix: "Account: ",
    accountTitle: "Cloud Save Account",
    accountSignedInNote: "You can browse the site normally; games will sync cloud saves automatically after opening.",
    accountLogout: "Sign out",
    accountLogin: "Log in",
    accountRegister: "Register",
    accountEmailPlaceholder: "Email",
    accountPasswordPlaceholder: "At least 8 characters",
    accountGuestNote: "Login is only for automatic game cloud saves. Site browsing is not affected.",
    accountUnavailable: "Cloud save service is temporarily unavailable.",
    accountLoggedIn: "Logged in.",
    accountLoggedOut: "Signed out.",
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
    welcomeTitle: "Welcome",
    welcomeHeading: "New avatar and mobile layout are ready!",
    welcomeCopy: "The site now uses the new TV-head avatar, with refreshed announcements, account popover, video/resources areas, and embedded games tuned for mobile.",
    quickEntry: "Quick Entry",
    goKnowledge: "Open Knowledge",
    goVideos: "Watch Videos",
    goGames: "Open Games",
    recentUpdates: "Recent Updates",
    moreUpdates: "More updates",
    rssFeed: "Feed",
    rssFeedAria: "RSS Feed",
    chatNicknameLabel: "My nickname:",
    chatEditNickname: "Edit nickname",
    chatSyncStatus: "Incremental auto refresh, slower while idle",
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
    chatNicknameTaken: "This random nickname is already in use. Getting a new one for you.",
    chatNicknamePrompt: "Enter a new nickname, 2-16 characters:",
    chatNicknameInvalid: "Nickname must be 2-16 characters and cannot be blank.",
    chatNicknameSaved: "Nickname updated. Future messages will use it.",
    chatSent: "Sent.",
    placeholderMark: " (Placeholder)",
    greetingMorning: "Good morning",
    greetingNoon: "Good day",
    greetingAfternoon: "Good evening",
    greetingEvening: "Good night",
    welcomeDateLine: "Today is {year}-{month}-{day}. It is good to see you."
  },
  ja: {
    siteName: "魯粛サイト",
    siteDescription: "Windows XP、ピクセルアート、Y2K 風の個人サイトです。AI、ゲーム、ツール、リソース、動画、知識庫、雑談を記録しています。",
    heroTitle: "魯粛サイト",
    homeLead: "工事中の XP ピクセル小サイトです。",
    navKnowledge: "知識庫",
    navVideos: "動画",
    navVideosBuilding: "動画",
    navResources: "リソース",
    navResourcesBuilding: "リソース（未定）",
    navGames: "ゲーム",
    navBlog: "雑談",
    navBlogBuilding: "雑談（未定）",
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
    notepadMenu: "ファイル  編集  表示  ヘルプ",
    chatroomTitle: "匿名チャット",
    aboutTitle: "プロフィール",
    toolbarBack: "デスクトップへ戻る",
    toolbarRefresh: "更新",
    knowledgePath: "マイコンピュータ / 魯粛 / 知識庫",
    siteUpdateCategory: "サイト更新記録",
    welcomeStatusTitle: "管理人ステータス：工事中",
    welcomeStatusCopy: "このサイトには記事、リソース、ミニゲーム、少し変な機能を少しずつ追加していきます。",
    welcomeRecommend: "今のおすすめ：匿名チャット、ゲーム、知識庫。",
    articleLoading: "データベースから記事を読み込み中...",
    articleLoadFailed: "記事を読み込めません。あとで試してください。",
    articleEmpty: "公開済みの記事はまだデータベースにありません。",
    articleSearchLabel: "知識庫を検索",
    articleSearchPlaceholder: "タイトル・概要・タグを検索...",
    articleSearchClear: "クリア",
    articleSearchCount: "{count}件の記事",
    articleSearchFiltered: "{count} / {total} 件を表示",
    articleSearchNoResults: "一致する記事が見つかりません。",
    articleBack: "記事一覧へ戻る",
    articleCopyLink: "記事リンクをコピー",
    articleCopyDone: "リンクをコピーしました。",
    articleCopyFailed: "コピーできません。アドレスバーのリンクを手動でコピーしてください。",
    articleReadProgress: "読書進捗",
    articleTocTitle: "目次",
    articleTocTipTitle: "ヒント",
    articleTocTip: "目次項目をクリックすると対応する章へ移動できます。",
    articleScrollTop: "先頭へ戻る",
    articlePublished: "公開日",
    articleCategory: "分類",
    articleFallback: "この言語版がないため、別の言語版を表示しています。",
    readButton: "読む",
    blogPending: "準備中",
    playButton: "再生",
    startGameButton: "開始",
    openGameButton: "開く",
    downloadButton: "ダウンロード",
    externalButton: "外部リンク",
    resourcePending: "準備中",
    resourcePendingTitle: "このリソースはまだ整理中で、ダウンロードや外部リンクはありません。",
    resourceStatusReady: "利用可",
    resourceEmptyTitle: "この分類はまだ整理中です",
    resourceEmptyBody: "いったんすべてのリソースに戻れます。ここには後でダウンロード、素材、資料を追加できます。",
    resourceEmptyAction: "すべてのリソースを表示",
    openOriginal: "元のページを開く",
    videoFullscreen: "全画面",
    videoRestore: "元に戻す",
    languageSupportLabel: "言語対応",
    gameLanguageUnsupported: "未対応",
    gameSourceLabel: "出典",
    gameCloudSaveReady: "クラウド保存",
    gameConfigLoading: "ゲーム設定を読み込み中...",
    gameConfigFailed: "ゲーム設定を読み込めません",
    videoPlaceholder: "Bilibili / YouTube の埋め込みプレイヤー用スペースです。",
    startButton: "ホーム",
    lastUpdatedLabel: "最終更新日",
    brandHomeAria: "デスクトップへ戻る",
    languageSwitcherAria: "言語切り替え",
    desktopIconsAria: "主なセクション",
    windowMinimizeAria: "ウィンドウを最小化",
    windowMaximizeAria: "ウィンドウを最大化",
    closeWindowAria: "ウィンドウを閉じる",
    closeDialogAria: "ダイアログを閉じる",
    accountSignedInPrefix: "アカウント：",
    accountTitle: "クラウドセーブアカウント",
    accountSignedInNote: "サイトは通常どおり閲覧できます。ゲームを開くとクラウドセーブを自動同期します。",
    accountLogout: "ログアウト",
    accountLogin: "ログイン",
    accountRegister: "登録",
    accountEmailPlaceholder: "メール",
    accountPasswordPlaceholder: "8文字以上のパスワード",
    accountGuestNote: "ログインはゲームの自動クラウドセーブ専用です。サイト閲覧には影響しません。",
    accountUnavailable: "クラウドセーブサービスは一時的に利用できません。",
    accountLoggedIn: "ログインしました。",
    accountLoggedOut: "ログアウトしました。",
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
    welcomeTitle: "ようこそ",
    welcomeHeading: "新しいアバターとスマホ表示を整えました！",
    welcomeCopy: "新しいテレビ頭のアバターに差し替え、告知、アカウント画面、動画・リソース欄、内蔵ゲームをスマホ向けに調整しました。",
    quickEntry: "クイック入口",
    goKnowledge: "知識庫へ",
    goVideos: "動画を見る",
    goGames: "ゲームへ",
    recentUpdates: "最近の更新",
    moreUpdates: "もっと見る",
    rssFeed: "購読",
    rssFeedAria: "RSS フィードを購読",
    chatNicknameLabel: "ニックネーム：",
    chatEditNickname: "変更",
    chatSyncStatus: "差分自動更新、待機中は低頻度",
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
    chatNicknameTaken: "このランダム名はすでに使われています。新しい名前に変更します。",
    chatNicknamePrompt: "2-16文字の新しいニックネームを入力：",
    chatNicknameInvalid: "ニックネームは2-16文字で、空白のみは使えません。",
    chatNicknameSaved: "ニックネームを更新しました。次の発言から反映されます。",
    chatSent: "送信しました。",
    placeholderMark: "（プレースホルダー）",
    greetingMorning: "おはようございます",
    greetingNoon: "こんにちは",
    greetingAfternoon: "こんばんは",
    greetingEvening: "夜ですね",
    welcomeDateLine: "今日は{year}年{month}月{day}日です。お会いできてうれしいです。"
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
      icon: "🔗",
      date: "2026.06.20",
      title: { zh: "关于我社交图标上线", en: "About Social Icons", ja: "プロフィールのSNSアイコン" },
      desc: {
        zh: "关于我窗口新增 X、GitHub、Bilibili、Instagram 和 Discord 纯图标入口，后台可修改每个跳转链接",
        en: "The About window now has icon-only links for X, GitHub, Bilibili, Instagram, and Discord, with admin-editable URLs",
        ja: "プロフィール画面に X、GitHub、Bilibili、Instagram、Discord のアイコンリンクを追加し、管理画面でURLを変更できます"
      }
    },
    {
      icon: "🖥️",
      date: "2026.06.19",
      title: { zh: "四时段沉浸式桌面栏", en: "Immersive Time-of-Day Chrome", ja: "時間帯別の没入デスクトップバー" },
      desc: {
        zh: "首页顶部栏和底部任务栏改为无竖线的现代玻璃像素 HUD，morning、day、dusk、night 四套主题继续保留原有图标和功能",
        en: "The home top bar and taskbar now use four modern glass pixel HUD themes without vertical grid lines while keeping all existing icons and behavior",
        ja: "ホームの上部バーとタスクバーを縦線なしのモダンなガラス調ピクセル HUD に更新し、既存アイコンと動作はそのまま保ちました"
      }
    },
    {
      icon: "🧭",
      date: "2026.06.19",
      title: { zh: "主站发现与收口记录", en: "Main Site Discovery Wrap-up", ja: "メインサイト発見性の仕上げ" },
      desc: {
        zh: "本次主站循环补齐搜索发现配置、站点地图、manifest、robots、三语页面 meta 和语言按钮状态，并完成构建与多视口检查",
        en: "This cycle added discovery metadata, sitemap, manifest, robots, trilingual page meta sync, language button state, and final build plus viewport checks",
        ja: "今回のサイクルでは、検索向けメタ情報、サイトマップ、manifest、robots、三言語 meta 同期、言語ボタン状態、最終確認を追加しました"
      }
    },
    {
      icon: "🎨",
      date: "2026.06.18",
      title: { zh: "主端视觉改版循环更新", en: "Main Site Visual Polish Cycle", ja: "メインサイト視覚調整サイクル更新" },
      desc: {
        zh: "本次循环统一打磨首页、知识库、视频区、资源区、游戏区、聊天室、关于我和账号入口的 XP 桌面视觉与移动端排版",
        en: "This cycle polished the XP desktop visuals and responsive layout across Home, Knowledge, Videos, Resources, Games, Chat, About, and Account surfaces",
        ja: "今回のサイクルでは、ホーム、知識庫、動画、リソース、ゲーム、チャット、About、アカウント周りの XP デスクトップ表示とモバイル配置を整えました"
      }
    },
    {
      icon: "🪟",
      date: "2026.06.18",
      title: { zh: "主站夜间优化汇总", en: "Public Site Nightly Summary", ja: "メインサイト夜間更新まとめ" },
      desc: {
        zh: "合并昨晚主站优化记录，并按参考图完成知识库文章页 10 轮阅读布局复刻打磨；文章窗口不再拉伸占满全站",
        en: "Merged last night's public-site updates, completed ten reference-matching passes, and kept the article window inside the site frame",
        ja: "昨夜のメインサイト更新をまとめ、参考画像に合わせて知識庫の記事ページを10回調整し、記事ウィンドウはサイト内サイズに戻しました"
      }
    },
    {
      icon: "🗂️",
      date: "2026.06.18",
      title: { zh: "资源空分类提示", en: "Resource Empty Category State", ja: "リソース空分類表示" },
      desc: {
        zh: "资源区空分类现在会显示三语空状态和返回全部资源按钮，不再留下空白列表",
        en: "Empty resource categories now show a trilingual empty state with a button back to all resources",
        ja: "空のリソース分類に三言語の空状態とすべてへ戻るボタンを表示します"
      }
    },
    {
      icon: "📊",
      date: "2026.06.18",
      title: { zh: "资源分类数量徽标", en: "Resource Filter Counts", ja: "リソース分類数バッジ" },
      desc: {
        zh: "资源区分类按钮现在显示每类资源数量，筛选前就能看到占位和资源分布",
        en: "Resource category buttons now show item counts so the resource distribution is visible before filtering",
        ja: "リソース分類ボタンに件数を表示し、絞り込み前に配分が分かるようにしました"
      }
    },
    {
      icon: "📦",
      date: "2026.06.18",
      title: { zh: "资源卡片状态徽标", en: "Resource Status Badges", ja: "リソース状態バッジ" },
      desc: {
        zh: "资源区卡片会显示准备中或可获取状态，下载按钮逻辑继续走安全链接校验",
        en: "Resource cards now show pending or ready status badges while download actions still use safe link checks",
        ja: "リソースカードに準備中または利用可の状態バッジを追加し、リンク確認は従来どおりです"
      }
    },
    {
      icon: "🎮",
      date: "2026.06.18",
      title: { zh: "游戏卡片信息增强", en: "Game Card Info Badges", ja: "ゲームカード情報バッジ" },
      desc: {
        zh: "游戏区卡片新增云存档和源码徽标，进入游戏前能看到保存与开源状态",
        en: "Game cards now show cloud-save and source badges so save and open-source status are visible before launch",
        ja: "ゲームカードにクラウド保存とソースのバッジを追加し、起動前に状態を確認できます"
      }
    },
    {
      icon: "⬆️",
      date: "2026.06.18",
      title: { zh: "文章回到顶部按钮", en: "Article Back-to-Top Button", ja: "記事先頭へ戻るボタン" },
      desc: {
        zh: "知识库文章详情新增三语回到顶部按钮，目录跳转后可以快速回到标题区",
        en: "Knowledge article details now include a trilingual back-to-top button after jumping through contents",
        ja: "知識庫の記事詳細に三言語の先頭へ戻るボタンを追加し、目次移動後に戻りやすくしました"
      }
    },
    {
      icon: "🧭",
      date: "2026.06.18",
      title: { zh: "文章目录导航", en: "Article Contents Navigation", ja: "記事目次ナビ" },
      desc: {
        zh: "知识库文章详情会按正文标题生成三语目录，长文可以快速跳到对应段落",
        en: "Knowledge article details now build a trilingual contents strip from body headings for quicker jumps",
        ja: "知識庫の記事詳細で本文見出しから三言語の目次を作り、長文の移動を速くしました"
      }
    },
    {
      icon: "📊",
      date: "2026.06.18",
      title: { zh: "文章阅读进度条", en: "Article Reading Progress", ja: "記事の読書進捗バー" },
      desc: {
        zh: "知识库文章详情新增三语阅读进度条，长文滚动时能看到当前位置",
        en: "Knowledge article details now show a trilingual reading progress bar while long posts scroll",
        ja: "知識庫の記事詳細に三言語の読書進捗バーを追加し、長文の現在位置が分かります"
      }
    },
    {
      icon: "📶",
      date: "2026.06.18",
      title: { zh: "RSS 发现链接同步", en: "RSS Discovery Link Sync", ja: "RSS 検出リンク同期" },
      desc: {
        zh: "页面 head 里的 RSS alternate 链接会随当前语言同步，订阅发现不再固定中文",
        en: "The RSS alternate link in the page head now follows the active language for feed discovery",
        ja: "ページ head の RSS alternate リンクが現在の言語に合わせて更新されます"
      }
    },
    {
      icon: "🔗",
      date: "2026.06.18",
      title: { zh: "文章链接保留语言", en: "Article Links Keep Language", ja: "記事リンクの言語保持" },
      desc: {
        zh: "文章卡片和最近更新的真实链接会带上当前 lang，新开标签也保留语言",
        en: "Article cards and recent updates now include the active lang in their real links for new tabs",
        ja: "記事カードと最近の更新リンクに現在の lang を含め、新しいタブでも言語を保持します"
      }
    },
    {
      icon: "🧾",
      date: "2026.06.18",
      title: { zh: "最近更新完整提示", en: "Recent Update Full Labels", ja: "最近の更新ラベル補足" },
      desc: {
        zh: "最近更新链接补充完整 title 和 aria-label，截断标题也能读到完整内容",
        en: "Recent update links now include full title and aria-label text even when the visible title is truncated",
        ja: "最近の更新リンクに完全な title と aria-label を追加し、省略表示でも内容を確認できます"
      }
    },
    {
      icon: "📡",
      date: "2026.06.18",
      title: { zh: "RSS 按钮文案整理", en: "RSS Button Label Polish", ja: "RSS ボタン文言調整" },
      desc: {
        zh: "欢迎窗口里的 RSS 按钮改为徽标加短文案，并让 ?welcome=1 稳定重开欢迎窗口",
        en: "The welcome RSS button now uses a badge plus shorter label, and ?welcome=1 reliably reopens the welcome window",
        ja: "ウェルカム画面の RSS ボタンを短い文言に整え、?welcome=1 で確実に再表示できるようにしました"
      }
    },
    {
      icon: "🛰️",
      date: "2026.06.18",
      title: { zh: "RSS 订阅入口", en: "RSS Feed Entry", ja: "RSS フィード入口" },
      desc: {
        zh: "首页最近更新面板新增 RSS 链接，公开文章可通过 /api/rss.xml 按当前语言订阅",
        en: "The Recent Updates panel now includes an RSS link, and public articles can be subscribed to through /api/rss.xml in the current language",
        ja: "最近の更新パネルに RSS リンクを追加し、公開記事を現在の言語で /api/rss.xml から購読できます"
      }
    },
    {
      icon: "🖼️",
      date: "2026.06.18",
      title: { zh: "静态图片尺寸提示", en: "Static Image Dimensions", ja: "静的画像サイズ指定" },
      desc: {
        zh: "首屏品牌头像、聊天室头像、关于头像和 Start 图标补充真实 width / height，减少图片解码前的布局不确定性",
        en: "Brand, chat, profile, and Start images now declare real width / height values to reduce layout uncertainty before decoding",
        ja: "ブランド、チャット、プロフィール、Start 画像に実寸の width / height を追加し、デコード前のレイアウト揺れを減らします"
      }
    },
    {
      icon: "🏷️",
      date: "2026.06.18",
      title: { zh: "文章标签本地化", en: "Article Tag Locales", ja: "記事タグのローカライズ" },
      desc: {
        zh: "知识库和站点更新里的安全、iframe、聊天室、云存档等标签补齐三语显示",
        en: "Knowledge and site-update tags such as security, iframe, chat room, and cloud saves now have localized labels",
        ja: "知識庫とサイト更新の安全、iframe、チャット、クラウド保存などのタグに多言語表示を追加しました"
      }
    },
    {
      icon: "🎮",
      date: "2026.06.18",
      title: { zh: "游戏 iframe 启动守卫", en: "Game Frame Source Guard", ja: "ゲームフレーム起動ガード" },
      desc: {
        zh: "游戏入口页会校验 catalog 中的 iframe 启动路径和语言参数名，再加载本地 source 页面",
        en: "Game entry pages now validate catalog iframe launch paths and language query names before loading local source pages",
        ja: "ゲーム入口ページが catalog の iframe 起動パスと言語パラメータ名を確認してからローカル source ページを読み込みます"
      }
    },
    {
      icon: "💬",
      date: "2026.06.18",
      title: { zh: "聊天室昵称本地化", en: "Chat Nickname Locale", ja: "チャット名ロケール対応" },
      desc: {
        zh: "匿名聊天室的新随机昵称会跟随当前中文、英文、日文界面生成",
        en: "New random chat nicknames now follow the current Chinese, English, or Japanese interface",
        ja: "匿名チャットの新しいランダム名が現在の中国語・英語・日本語表示に合わせて生成されます"
      }
    },
    {
      icon: "🖼️",
      date: "2026.06.18",
      title: { zh: "文章图片路径守卫", en: "Article Image Path Guard", ja: "記事画像パスガード" },
      desc: {
        zh: "文章 Markdown 配图继续限制在项目文章图片目录，并显式拒绝路径穿越片段",
        en: "Markdown article images stay limited to the project article-image folder and now explicitly reject traversal segments",
        ja: "Markdown 記事画像は記事画像フォルダに限定し、パストラバーサル片を明示的に拒否します"
      }
    },
    {
      icon: "🧭",
      date: "2026.06.18",
      title: { zh: "资源链接白名单", en: "Resource URL Allowlist", ja: "リソースURL許可リスト" },
      desc: {
        zh: "资源下载和外链在渲染前会先规范化 URL，并只接受安全本地路径或 http(s) 链接",
        en: "Resource downloads and external links are normalized before rendering and only accept safe local paths or http(s) URLs",
        ja: "リソースのダウンロードと外部リンクは描画前に正規化し、安全なローカルパスまたは http(s) URL のみ受け付けます"
      }
    },
    {
      icon: "🎞️",
      date: "2026.06.18",
      title: { zh: "视频链接白名单", en: "Video Link Allowlist", ja: "動画リンク許可リスト" },
      desc: {
        zh: "视频缩略图、原地址和播放器 iframe 在前端也会经过域名白名单校验",
        en: "Video thumbnails, source links, and player iframes now pass frontend domain allowlist checks",
        ja: "動画サムネイル、元リンク、プレイヤー iframe にフロント側のドメイン許可リストを追加しました"
      }
    },
    {
      icon: "🔗",
      date: "2026.06.18",
      title: { zh: "游戏链接白名单", en: "Game Link Allowlist", ja: "ゲームリンク許可リスト" },
      desc: {
        zh: "游戏列表入口和封面路径补充白名单校验，避免不可信 URL 进入页面",
        en: "Game entry links and cover paths now use allowlist checks before rendering",
        ja: "ゲーム入口リンクとカバー画像パスに許可リスト確認を追加しました"
      }
    },
    {
      icon: "🎮",
      date: "2026.06.18",
      title: { zh: "游戏列表安全渲染", en: "Game List Safe DOM", ja: "ゲーム一覧の安全な DOM 描画" },
      desc: {
        zh: "游戏区卡片、语言标签、许可证和加载状态改为 DOM/textContent 构建",
        en: "Game cards, language tags, license labels, and loading states now render through DOM/textContent",
        ja: "ゲームカード、言語タグ、ライセンス、読み込み状態を DOM/textContent 構築にしました"
      }
    },
    {
      icon: "🧰",
      date: "2026.06.18",
      title: { zh: "资源筛选安全渲染", en: "Resource Filters Safe DOM", ja: "リソースフィルターの安全な DOM 描画" },
      desc: {
        zh: "资源区分类筛选按钮改为 DOM/textContent 构建，筛选值和 active 状态保持不变",
        en: "Resource filter buttons now render through DOM/textContent while keeping filter values and active state",
        ja: "リソースのフィルターボタンを DOM/textContent 構築にし、値と active 状態を維持します"
      }
    },
    {
      icon: "🧭",
      date: "2026.06.18",
      title: { zh: "知识库筛选安全渲染", en: "Knowledge Filters Safe DOM", ja: "知識庫フィルターの安全な DOM 描画" },
      desc: {
        zh: "知识库分类筛选按钮改为 DOM/textContent 构建，分类名和 active 状态保持不变",
        en: "Knowledge category filter buttons now render through DOM/textContent while preserving labels and active state",
        ja: "知識庫カテゴリーフィルターを DOM/textContent 構築にし、ラベルと active 状態を維持します"
      }
    },
    {
      icon: "🧾",
      date: "2026.06.18",
      title: { zh: "知识库列表安全渲染", en: "Knowledge List Safe DOM", ja: "知識庫リストの安全な DOM 描画" },
      desc: {
        zh: "知识库文章列表改为 DOM/textContent 构建，标题、摘要、标签、日期和阅读入口继续按纯文本渲染",
        en: "Knowledge article cards now render through DOM/textContent for titles, summaries, tags, dates, and read links",
        ja: "知識庫の記事カードを DOM/textContent 構築にし、タイトル、概要、タグ、日付、読む入口を純テキストで描画します"
      }
    },
    {
      icon: "🛡️",
      date: "2026.06.18",
      title: { zh: "最近更新安全渲染", en: "Recent Updates Safe DOM", ja: "最近更新の安全な DOM 描画" },
      desc: {
        zh: "首页最近更新列表改为 DOM/textContent 构建，标题、摘要、日期和图标都按纯文本渲染",
        en: "The home recent-update list now renders through DOM/textContent for titles, summaries, dates, and icons",
        ja: "ホームの最近更新リストを DOM/textContent 構築にし、タイトル、概要、日付、アイコンを純テキストで描画します"
      }
    },
    {
      icon: "🛠️",
      date: "2026.06.18",
      title: { zh: "最近更新图标优化", en: "Recent Update Icons", ja: "最近更新アイコンを調整" },
      desc: {
        zh: "首页最近更新会按站点更新类型显示工具图标，避免从文章 API 读取后全部显示书本图标",
        en: "The home recent-update list now shows a site-update tool icon instead of treating every API article as a book",
        ja: "ホームの最近更新で、記事 API 由来の更新もすべて本アイコンにならず、サイト更新らしいツールアイコンを表示します"
      }
    },
    {
      icon: "🔐",
      date: "2026.06.18",
      title: { zh: "账号弹窗安全 DOM 渲染", en: "Account Popover Safe DOM", ja: "アカウント表示の安全な DOM 描画" },
      desc: {
        zh: "顶部账号/云存档弹窗改为 DOM/textContent 构建，登录、注册和退出行为保持不变",
        en: "The top account and cloud-save popover now renders through DOM/textContent while keeping login flows unchanged",
        ja: "上部アカウント/クラウド保存表示を DOM/textContent 描画にし、ログイン動作は維持しました"
      }
    },
    {
      icon: "🛡️",
      date: "2026.06.18",
      title: { zh: "游戏外壳安全 DOM 渲染", en: "Game Shell Safe DOM", ja: "ゲームシェルの安全な DOM 描画" },
      desc: {
        zh: "游戏入口页的云存档面板和协议栏改为 DOM/textContent 构建，并限制协议链接格式",
        en: "Game entry cloud-save panels and license links now render through DOM/textContent with safer link checks",
        ja: "ゲーム入口のクラウド保存パネルとライセンス欄を DOM/textContent 描画にし、リンク形式も確認します"
      }
    },
    {
      icon: "🗂️",
      date: "2026.06.18",
      title: { zh: "资源入口文案对齐", en: "Resources Label Sync", ja: "リソース入口ラベル同期" },
      desc: {
        zh: "资源区桌面入口继续保留待定状态，但英文和日文名称与资源窗口标题保持一致",
        en: "The Resources desktop icon keeps its TBD state while matching the Resources window label",
        ja: "リソースのデスクトップ入口は未定表示を保ちつつ、リソースウィンドウ名と揃えました"
      }
    },
    {
      icon: "🎞️",
      date: "2026.06.18",
      title: { zh: "视频缩略图异步解码", en: "Async Video Thumbnail Decoding", ja: "動画サムネイルの非同期デコード" },
      desc: {
        zh: "公开视频卡片缩略图在懒加载基础上补充异步解码，和文章图、游戏封面保持一致",
        en: "Public video thumbnails now add async decoding on top of lazy loading, matching article images and game covers",
        ja: "公開動画カードのサムネイルに遅延読み込みに加えて非同期デコードを追加し、記事画像やゲームカバーと揃えました"
      }
    },
    {
      icon: "📦",
      date: "2026.06.18",
      title: { zh: "资源占位提示补齐", en: "Resource Placeholder Hints", ja: "リソース準備中ヒント" },
      desc: {
        zh: "资源区准备中按钮增加三语 title 与 aria 说明，明确暂时没有下载或外链",
        en: "Coming-soon resource buttons now include localized title and aria hints when no link is available",
        ja: "準備中のリソースボタンに、リンク未設定を示す多言語 title と aria 説明を追加しました"
      }
    },
    {
      icon: "💾",
      date: "2026.06.18",
      title: { zh: "游戏外壳三语同步", en: "Localized Game Shell", ja: "ゲームシェルの多言語同期" },
      desc: {
        zh: "游戏入口页的返回、存档工具、云存档、协议和状态文案会跟随当前语言显示",
        en: "Game entry pages now localize back links, save tools, cloud-save panels, license labels, and status text",
        ja: "ゲーム入口ページの戻るリンク、セーブツール、クラウド保存、ライセンス、状態表示が現在の言語に合わせて表示されます"
      }
    },
    {
      icon: "🌐",
      date: "2026.06.18",
      title: { zh: "游戏语言标记三语同步", en: "Game Language Labels", ja: "ゲーム言語ラベルの多言語同期" },
      desc: {
        zh: "游戏卡片里的中文、英文、日文支持标记会跟随当前站点语言显示名称和不支持提示",
        en: "Game language support tags now localize Chinese, English, Japanese, and unsupported labels",
        ja: "ゲームカードの対応言語タグが、中国語・英語・日本語・未対応表示を現在の言語に合わせます"
      }
    },
    {
      icon: "🎮",
      date: "2026.06.18",
      title: { zh: "游戏封面异步解码", en: "Async Game Cover Decoding", ja: "ゲームカバーの非同期デコード" },
      desc: {
        zh: "游戏区封面图在继续懒加载的基础上补充异步解码，减少打开游戏列表时的解码阻塞",
        en: "Game cover images now add async decoding on top of lazy loading to reduce decode pressure when opening the games list",
        ja: "ゲーム欄のカバー画像に遅延読み込みに加えて非同期デコードを追加し、一覧表示時の負荷を抑えます"
      }
    },
    {
      icon: "📝",
      date: "2026.06.18",
      title: { zh: "杂谈菜单三语同步", en: "Talk Menu Localization", ja: "雑談メニューの多言語同期" },
      desc: {
        zh: "杂谈区 Notepad 风格菜单从固定英文改为跟随中文、English、日本語 切换",
        en: "The Talk area Notepad-style menu now follows the Chinese, English, and Japanese language switch",
        ja: "雑談欄の Notepad 風メニューが中文、English、日本語 の切り替えに合わせて表示されます"
      }
    },
    {
      icon: "☁️",
      date: "2026.06.18",
      title: { zh: "账号弹窗三语同步", en: "Account Popover Localization", ja: "アカウント表示の多言語同期" },
      desc: {
        zh: "登录、注册、邮箱、密码、云存档说明和退出账号等账号弹窗文案会跟随当前语言显示",
        en: "Login, register, email, password, cloud-save notes, and sign-out copy now follow the active language",
        ja: "ログイン、登録、メール、パスワード、クラウドセーブ説明、ログアウト文言が現在の言語に合わせて表示されます"
      }
    },
    {
      icon: "♿",
      date: "2026.06.18",
      title: { zh: "无障碍标签三语同步", en: "Localized ARIA Labels", ja: "ARIAラベルの多言語同期" },
      desc: {
        zh: "品牌按钮、语言切换、桌面图标区和窗口关闭按钮的 aria-label 会跟随当前语言切换",
        en: "Brand, language switcher, desktop icon group, and close-button aria labels now follow the active language",
        ja: "ブランド、言語切り替え、デスクトップアイコン領域、閉じるボタンの aria-label が現在の言語に合わせて変わります"
      }
    },
    {
      icon: "💬",
      date: "2026.06.18",
      title: { zh: "聊天室标题三语同步", en: "Chat Title Localization", ja: "チャット題名の多言語同期" },
      desc: {
        zh: "聊天室窗口标题会跟随中文、English、日本語 切换，不再在英文和日文界面保留中文标题",
        en: "The chat room window title now follows the Chinese, English, and Japanese language switch",
        ja: "チャットルームのウィンドウ題名が中文、English、日本語 の切り替えに合わせて表示されます"
      }
    },
    {
      icon: "🖼️",
      date: "2026.06.18",
      title: { zh: "图片加载细节优化", en: "Image Loading Polish", ja: "画像読み込みの調整" },
      desc: {
        zh: "首屏外头像和文章配图补充懒加载与异步解码，继续保留本地图片白名单",
        en: "Off-screen avatars and article images now use lazy loading and async decoding while keeping the local image whitelist",
        ja: "初期表示外のアバターと記事画像に遅延読み込みと非同期デコードを加え、ローカル画像の許可リストは維持しました"
      }
    },
    {
      icon: "🏷️",
      date: "2026.06.18",
      title: { zh: "标签三语显示", en: "Trilingual Tag Labels", ja: "タグ三言語表示" },
      desc: {
        zh: "文章和杂谈卡片的常见标签会跟随中文、English、日本語 切换显示",
        en: "Common article and talk tags now follow the Chinese, English, and Japanese language switch",
        ja: "記事と雑談カードの主なタグが中文、English、日本語 の切り替えに合わせて表示されます"
      }
    },
    {
      icon: "📖",
      date: "2026.06.18",
      title: { zh: "文章详情搜索条隐藏修复", en: "Article Detail Search Hide", ja: "記事詳細の検索バー非表示" },
      desc: {
        zh: "阅读文章详情时隐藏知识库搜索条，避免搜索控件占用阅读区顶部空间",
        en: "Article detail pages now hide the knowledge search bar so reading space stays focused",
        ja: "記事詳細では知識庫検索バーを隠し、読書スペースをすっきり保ちます"
      }
    },
    {
      icon: "🔗",
      date: "2026.06.18",
      title: { zh: "语言链接参数同步", en: "Language URL Sync", ja: "言語URL同期" },
      desc: {
        zh: "切换语言会同步地址栏 lang 参数，复制当前页面链接时不再带旧语言",
        en: "Language switching now updates the address bar lang parameter so copied links keep the current language",
        ja: "言語切り替え時に URL の lang パラメータを同期し、コピーしたリンクが現在の言語を保ちます"
      }
    },
    {
      icon: "📝",
      date: "2026.06.18",
      title: { zh: "杂谈区占位按钮修复", en: "Talk Placeholder Buttons", ja: "雑談の準備中ボタン" },
      desc: {
        zh: "杂谈区没有真实文章入口时显示整理中按钮，并改用安全 DOM 渲染",
        en: "Talk cards without article targets now show a drafting button and render through safe DOM nodes",
        ja: "実際の記事リンクがない雑談カードは準備中ボタンを表示し、安全な DOM 描画にしました"
      }
    },
    {
      icon: "🖱️",
      date: "2026.06.18",
      title: { zh: "导航当前态增强", en: "Active Navigation State", ja: "ナビ現在状態を強化" },
      desc: {
        zh: "底部任务栏和首页 Start 按钮会标记当前页面，并同步 aria-current",
        en: "The taskbar and Start button now mark the current page and keep aria-current in sync",
        ja: "タスクバーと Start ボタンが現在ページを示し、aria-current も同期します"
      }
    },
    {
      icon: "📦",
      date: "2026.06.18",
      title: { zh: "资源区占位按钮修复", en: "Resource Placeholder Buttons", ja: "リソース準備中ボタン" },
      desc: {
        zh: "资源区没有真实下载或外链时显示准备中按钮，不再使用无效 # 链接",
        en: "Resource cards without real download or external URLs now show a coming-soon button instead of a dead # link",
        ja: "実際のダウンロードや外部リンクがないリソースは、無効な # リンクではなく準備中ボタンを表示します"
      }
    },
    {
      icon: "🪟",
      date: "2026.06.17",
      title: { zh: "文章直链不再弹欢迎窗", en: "Cleaner Article Deep Links", ja: "記事直リンクを読みやすく" },
      desc: {
        zh: "首次打开文章或其他非首页直链时，不再自动弹出欢迎窗口遮挡内容",
        en: "Article and non-home deep links no longer auto-open the welcome modal over the content",
        ja: "記事やホーム以外の直リンクでは、歓迎ウィンドウが内容を隠さないようにしました"
      }
    },
    {
      icon: "📺",
      date: "2026.06.17",
      title: { zh: "视频区空状态增强", en: "Video Empty State", ja: "動画欄の空状態を改善" },
      desc: {
        zh: "视频区没有公开视频时会显示 XP 风格提示，并提供查看网站更新记录的入口",
        en: "The videos area now shows an XP-style empty state with a shortcut to site updates when no videos are published",
        ja: "公開動画がない場合、動画欄に XP 風の空状態とサイト更新記録への入口を表示します"
      }
    },
    {
      icon: "🔗",
      date: "2026.06.17",
      title: { zh: "文章详情复制链接", en: "Article Link Copy", ja: "記事リンクコピー" },
      desc: {
        zh: "知识库文章详情新增复制直链按钮，便于分享当前语言的文章页面",
        en: "Knowledge articles now have a copy-link button for sharing the current language view",
        ja: "知識庫の記事詳細に、現在の言語ページを共有しやすいリンクコピーを追加しました"
      }
    },
    {
      icon: "📚",
      date: "2026.06.17",
      title: { zh: "知识库本地搜索上线", en: "Knowledge Search Added", ja: "知識庫検索を追加" },
      desc: {
        zh: "知识库顶部新增本地搜索，可按标题、简介、分类和标签快速过滤文章，并适配三语和手机端布局",
        en: "The knowledge base now has local search across titles, summaries, categories, and tags, with trilingual and mobile layouts",
        ja: "知識庫にローカル検索を追加し、タイトル・概要・分類・タグを三言語とモバイル表示で絞り込めるようにしました"
      }
    },
    {
      icon: "📺",
      date: "2026.06.16",
      title: { zh: "视频卡片与分类持久化修复", en: "Video Card and Category Persistence Fixes", ja: "動画カードとカテゴリ保持の修正" },
      desc: {
        zh: "视频卡片减少无用空白，视频分类默认 seed 不再补回已删除标签，聊天室桌面图标也与名称拉开距离",
        en: "Video cards use less empty space, default category seeds no longer restore deleted tags, and the chatroom icon has clearer label spacing",
        ja: "動画カードの余白を減らし、削除済みカテゴリを既定 seed が戻さないようにし、チャットアイコンとラベルの間隔も調整しました"
      }
    },
    {
      icon: "📺",
      date: "2026.06.16",
      title: { zh: "视频区窗口自适应放大", en: "Responsive Video Window", ja: "動画欄ウィンドウの自動拡大" },
      desc: {
        zh: "视频区列表窗口会跟随屏幕可用高度放大，减少桌面底部空白并显示更多视频卡片",
        en: "The videos window now grows with available screen height, reducing empty desktop space and showing more cards",
        ja: "動画欄のウィンドウが画面の高さに合わせて広がり、下部の空白を減らしてより多くのカードを表示します"
      }
    },
    {
      icon: "📱",
      date: "2026.06.16",
      title: { zh: "移动端与后台视频维护修复", en: "Mobile and Admin Video Maintenance Fixes", ja: "モバイル表示と動画管理を修正" },
      desc: {
        zh: "修复视频分类标签回退、B 站元数据抓取提示，并补强视频/资源/登录弹窗的手机端适配",
        en: "Fixed video category rollback, Bilibili metadata handling, and mobile layouts for videos, resources, and login popovers",
        ja: "動画カテゴリ名の戻り、Bilibili メタ情報取得、動画・リソース・ログイン周りのモバイル表示を調整しました"
      }
    },
    {
      icon: "📺",
      date: "2026.06.15",
      title: { zh: "视频管理排序与 B 站信息修复", en: "Video Sorting and Bilibili Metadata Fixes", ja: "動画管理の並び順と Bilibili 情報取得を修正" },
      desc: {
        zh: "修复 Bilibili 元数据兜底、视频排序、统一卡片尺寸和首页视频入口文案",
        en: "Improved Bilibili metadata fallback, video ordering, card sizing, and the home Videos label",
        ja: "Bilibili メタ情報の補完、動画の並び順、カードサイズ、ホームの動画ラベルを調整しました"
      }
    },
    {
      icon: "📺",
      date: "2026.06.15",
      title: { zh: "视频播放器窗口交互修复", en: "Video Player Window Controls", ja: "動画プレイヤーのウィンドウ操作修正" },
      desc: {
        zh: "站内全屏改为 XP 窗口最大化/还原，原地址按钮恢复真实链接，并收紧 iframe 控制区热区",
        en: "Changed site fullscreen into an XP window maximize toggle, restored original video links, and tightened iframe control hit zones",
        ja: "サイト内全画面を XP 風ウィンドウの最大化/復元に変更し、元リンクと iframe 操作範囲を調整しました"
      }
    },
    {
      icon: "🖼️",
      date: "2026.06.15",
      title: { zh: "首页底部长条修复", en: "Home Bottom Strip Fix", ja: "ホーム下部ライン修正" },
      desc: {
        zh: "修复任务栏上方露出的绿色长条，四个时间段壁纸现在都会填满首页中间区域",
        en: "Fixed the green strip above the taskbar so every time-of-day wallpaper fills the home area",
        ja: "タスクバー上の緑の線を修正し、4時間帯の壁紙がホーム領域を埋めるようにしました"
      }
    },
    {
      icon: "🪟",
      date: "2026.06.15",
      title: { zh: "窗口图标与云层残影修复", en: "Window Icons and Cloud Cleanup", ja: "ウィンドウアイコンと雲の残影修正" },
      desc: {
        zh: "补发窗口与任务栏图标更新记录，并修复夜晚/黄昏动态壁纸 clean 底图里的云层残影",
        en: "Added the missing window/taskbar icon update record and cleaned residual clouds from Night and Dusk wallpaper plates",
        ja: "ウィンドウとタスクバーのアイコン更新記録を補い、夜と夕方の壁紙ベースに残った雲の跡を修正しました"
      }
    },
    {
      icon: "📺",
      date: "2026.06.15",
      title: { zh: "视频区改造成可管理系统", en: "Managed Video System", ja: "動画欄を管理できる仕組みに変更" },
      desc: {
        zh: "后台现在可以管理 YouTube 和 Bilibili 链接，自动识别信息并在主站 XP 窗口内播放",
        en: "The admin can now manage YouTube and Bilibili links, fetch metadata, and play videos inline in the XP window",
        ja: "管理画面で YouTube と Bilibili のリンクを登録し、XP 風ウィンドウ内で再生できるようになりました"
      }
    },
    {
      icon: "☁️",
      date: "2026.06.15",
      title: { zh: "云层漂移提速与流畅度优化", en: "Smoother cloud drift", ja: "雲レイヤーの滑らかさ調整" },
      desc: { zh: "首页四时段云层漂移小幅加快，并优化合成层提示，减少卡顿和首帧跳动", en: "Slightly sped up the four time-of-day cloud drift and tuned compositor hints to reduce stutter and first-frame jumps", ja: "ホームの4時間帯の雲移動を少し速め、合成レイヤーの設定を整えてカクつきと初期フレームのずれを抑えました" }
    },
    {
      icon: "📝",
      date: "2026.06.15",
      title: { zh: "动态云层与维护记录补齐", en: "Clouds and maintenance log", ja: "雲と保守記録を補完" },
      desc: { zh: "补齐四时段动态云层上线记录、项目文档、Skill 规则和 site-updates 三语更新文章，让最近更新日期跟随真实记录", en: "Added the missing site-update article, project docs, Skill notes, and fallback update entry for the four-time cloud animation", ja: "4時間帯の雲アニメーションについて、更新記事、文書、Skill、fallback 最近更新を補完しました" }
    },
    {
      icon: "☁️",
      date: "2026.06.15",
      title: { zh: "四时段动态云层", en: "Four-time cloud animation", ja: "4時間帯の雲アニメーション" },
      desc: { zh: "首页 morning / day / dusk / night 都接入无云底图和独立云层，使用同一主风向的慢速错相漂移，并支持页面隐藏暂停和减少动态模式", en: "Morning, Day, Dusk, and Night wallpapers now use cloudless bases with independent slow-drifting cloud layers, pause-on-hidden, and reduced-motion support", ja: "朝・昼・夕方・夜の壁紙に無雲ベースと独立した低速雲レイヤーを追加し、非表示時の一時停止と低モーション設定に対応しました" }
    },
    {
      icon: "📖",
      date: "2026.06.15",
      title: { zh: "AI Agent 文章直链与阅读优化", en: "AI Agent article links and reading polish", ja: "AI Agent 記事リンクと閲覧体験を調整" },
      desc: { zh: "知识库长文窗口改为随浏览器扩展，文章支持域名直链、蓝色说明框和配图展示", en: "Long knowledge articles now use a larger responsive window with domain article links, blue callout boxes, and inline images", ja: "知識庫の長文ウィンドウを広くし、ドメイン直リンク、青い説明枠、本文画像に対応しました" }
    },
    {
      icon: "🌄",
      date: "2026.06.12",
      title: { zh: "首页壁纸高清替换", en: "Sharper home wallpapers", ja: "ホーム壁紙を高解像度化" },
      desc: { zh: "首页四时段壁纸改用 1672x941 原图，并调整裁切比例和缓存版本，减少全屏放大后的发糊", en: "The four home wallpapers now use the 1672x941 originals with an updated crop ratio and cache version to reduce fullscreen blur", ja: "ホームの4時間帯壁紙を1672x941の原寸画像に替え、裁切比率とキャッシュ版を更新して全画面時のぼやけを減らしました" }
    },
    {
      icon: "🎮",
      date: "2026.06.12",
      title: { zh: "人生重开模拟器本地接入", en: "Life Restart added locally", ja: "Life Restart をローカル追加" },
      desc: { zh: "Life Restart 已构建为本站静态游戏，接入统一游戏外壳、语言标记和云存档键", en: "Life Restart is now built as a local static game with the shared game shell, language tags, and cloud-save keys", ja: "Life Restart を本站内の静的ゲームとして追加し、共通シェル、言語表示、クラウド保存キーに対応しました" }
    },
    {
      icon: "🌅",
      date: "2026.06.12",
      title: { zh: "四时段静态像素壁纸接口", en: "Time-of-day wallpaper interface", ja: "時間帯別壁紙インターフェース" },
      desc: { zh: "首页新增 image2 重绘的四时段静态壁纸，并保留后续动画图层接口", en: "The home screen now uses redrawn static wallpapers across four local-time periods, with animation layer hooks kept for later", ja: "ホームに再描画した4時間帯の静的壁紙を追加し、今後のアニメーション層の入口を残しました" }
    },
    {
      icon: "🕒",
      date: "2026.06.11",
      title: { zh: "时间显示与窗口尺寸整理", en: "Time and window layout fixes", ja: "時刻表示とウィンドウ調整" },
      desc: { zh: "文章和聊天室时间改为按用户时区显示，知识库关闭后回首页，关于我窗口收紧", en: "Article and chat times now use the visitor timezone; knowledge resets on close and About is compact", ja: "記事とチャット時刻を閲覧者の時区に合わせ、知識庫とプロフィール表示を調整しました" }
    },
    {
      icon: "🎮",
      date: "2026.06.11",
      title: { zh: "游戏区改为本地直玩", en: "Games now play locally", ja: "ゲームをサイト内プレイに整理" },
      desc: { zh: "保留猫国建设者、小黑屋、2048 和 Hextris，2048 与 Hextris 已接入本站存档和三语界面", en: "Kept Kittens Game, A Dark Room, 2048, and Hextris; 2048 and Hextris now use site saves and trilingual UI", ja: "Kittens Game、A Dark Room、2048、Hextris を残し、2048 と Hextris は保存連携と三言語UIに対応しました" }
    },
    {
      icon: "🪟",
      date: "2026.06.11",
      title: { zh: "首页与知识库排版修复", en: "Home and knowledge layout fixes", ja: "ホームと知識庫の表示修正" },
      desc: { zh: "优化桌面图标、知识库阅读页、视频卡片和聊天室时间显示", en: "Refined desktop icons, article reading, video cards, and chat timestamps", ja: "デスクトップアイコン、記事閲覧、動画カード、チャット時刻を調整しました" }
    },
    {
      icon: "🎮",
      date: "2026.06.11",
      title: { zh: "游戏区扩展与发布时间精确到秒", en: "Game library and precise publish times", ja: "ゲーム欄拡張と秒単位の時刻" },
      desc: { zh: "新增多款开源游戏入口，并让知识库发布时间显示到秒", en: "Added open-source game entries and second-level article publish times", ja: "ゲーム入口を追加し、記事公開時刻を秒まで表示します" }
    },
    {
      icon: "📚",
      date: "2026.06.11",
      title: { zh: "数据库化三语文章系统", en: "Database-backed trilingual articles", ja: "DB対応三言語記事システム" },
      desc: { zh: "知识库文章改为从 Cloudflare D1 读取，支持中英日内容和 Markdown 详情", en: "Knowledge articles now load from Cloudflare D1 with zh/en/ja content and Markdown detail pages", ja: "知識庫の記事を Cloudflare D1 から読み込み、三言語本文と Markdown 詳細に対応しました" }
    },
    {
      icon: "🎮",
      date: "2026.06.11",
      title: { zh: "游戏区卡片整理", en: "Games section cards refined", ja: "ゲーム欄カードを整理" },
      desc: { zh: "删去临时说明和多余标签，游戏列表改为内容较多时内部滚动", en: "Temporary notes and extra tags were removed, with internal scrolling for longer game lists", ja: "一時説明と余分なタグを削除し、ゲーム一覧は多い時に内部スクロールします" }
    },
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
const articleState = {
  loading: false,
  requestId: 0,
  detailRequestId: 0,
  detailLoadingKey: "",
  detailCache: new Map(),
  articles: [],
  currentSlug: "",
  currentArticle: null,
  searchTerm: "",
  copyStatusTimer: 0,
  readProgressFrame: 0,
  error: ""
};
const videoState = {
  loading: false,
  requestId: 0,
  categories: [],
  videos: [],
  error: ""
};

const videoWindowState = {
  maximized: false
};

const languageStorageKey = "lusu-site-language";
const siteUpdateCategory = "site-updates";
const publicLoopNightlyUpdateSlug = "2026-06-18-main-visual-polish-cycle";
const publicLoopNightlyUpdateTitleEn = "Main Site Visual Polish Cycle";
const publicLoopNightlyCollapsedSlugs = new Set([
  "2026-06-17-knowledge-search",
  "2026-06-17-article-share-link",
  "2026-06-17-video-empty-state",
  "2026-06-17-route-aware-welcome"
]);
const publicLoopNightlyCollapsedFallbackTitlesEn = new Set([
  "Knowledge Search Added",
  "Article Link Copy",
  "Video Empty State",
  "Cleaner Article Deep Links"
]);
const articleCategoryLabels = {
  "site-updates": {
    zh: "网站更新记录",
    en: "Site Update Log",
    ja: "サイト更新記録"
  },
  site: {
    zh: "网站",
    en: "Site",
    ja: "サイト"
  },
  ai: {
    zh: "AI",
    en: "AI",
    ja: "AI"
  },
  note: {
    zh: "笔记",
    en: "Notes",
    ja: "メモ"
  }
};

const tagLabels = {
  "网站更新": { zh: "网站更新", en: "Site update", ja: "サイト更新" },
  "网站": { zh: "网站", en: "Site", ja: "サイト" },
  "首页": { zh: "首页", en: "Home", ja: "ホーム" },
  "日常": { zh: "日常", en: "Daily", ja: "日常" },
  "记录": { zh: "记录", en: "Log", ja: "記録" },
  "上线记录": { zh: "上线记录", en: "Launch log", ja: "公開記録" },
  "维护记录": { zh: "维护记录", en: "Maintenance", ja: "保守記録" },
  "修复记录": { zh: "修复记录", en: "Fix log", ja: "修正記録" },
  "经验": { zh: "经验", en: "Experience", ja: "経験" },
  "文章": { zh: "文章", en: "Article", ja: "記事" },
  "知识库": { zh: "知识库", en: "Knowledge", ja: "知識庫" },
  "标签": { zh: "标签", en: "Tag", ja: "タグ" },
  "搜索": { zh: "搜索", en: "Search", ja: "検索" },
  "文章详情": { zh: "文章详情", en: "Article detail", ja: "記事詳細" },
  "阅读体验": { zh: "阅读体验", en: "Reading", ja: "読書体験" },
  "分享": { zh: "分享", en: "Sharing", ja: "共有" },
  "链接分享": { zh: "链接分享", en: "Link sharing", ja: "リンク共有" },
  "多语言": { zh: "多语言", en: "Languages", ja: "多言語" },
  "路由": { zh: "路由", en: "Routing", ja: "ルート" },
  "导航": { zh: "导航", en: "Navigation", ja: "ナビ" },
  "任务栏": { zh: "任务栏", en: "Taskbar", ja: "タスクバー" },
  "可访问性": { zh: "可访问性", en: "Accessibility", ja: "アクセシビリティ" },
  "交互修复": { zh: "交互修复", en: "Interaction fix", ja: "操作修正" },
  "视频区": { zh: "视频区", en: "Videos", ja: "動画欄" },
  "播放器": { zh: "播放器", en: "Player", ja: "プレイヤー" },
  "空状态": { zh: "空状态", en: "Empty state", ja: "空状態" },
  "资源区": { zh: "资源区", en: "Resources", ja: "リソース" },
  "主站优化": { zh: "主站优化", en: "Main site", ja: "メインサイト" },
  "夜间汇总": { zh: "夜间汇总", en: "Nightly summary", ja: "夜間まとめ" },
  "下载": { zh: "下载", en: "Download", ja: "ダウンロード" },
  "占位按钮": { zh: "占位按钮", en: "Placeholder button", ja: "準備中ボタン" },
  "状态": { zh: "状态", en: "Status", ja: "状態" },
  "源码": { zh: "源码", en: "Source", ja: "ソース" },
  "目录": { zh: "目录", en: "Contents", ja: "目次" },
  "进度": { zh: "进度", en: "Progress", ja: "進捗" },
  "阅读": { zh: "阅读", en: "Reading", ja: "読書" },
  "杂谈区": { zh: "杂谈区", en: "Talk", ja: "雑談" },
  "安全渲染": { zh: "安全渲染", en: "Safe rendering", ja: "安全描画" },
  "后台": { zh: "后台", en: "Admin", ja: "管理画面" },
  "游戏区": { zh: "游戏区", en: "Games", ja: "ゲーム欄" },
  "移动端": { zh: "移动端", en: "Mobile", ja: "モバイル" },
  "桌面端": { zh: "桌面端", en: "Desktop", ja: "デスクトップ" },
  "桌面图标": { zh: "桌面图标", en: "Desktop icons", ja: "デスクトップアイコン" },
  "布局修复": { zh: "布局修复", en: "Layout fix", ja: "レイアウト修正" },
  "响应式布局": { zh: "响应式布局", en: "Responsive layout", ja: "レスポンシブ" },
  "窗口": { zh: "窗口", en: "Window", ja: "ウィンドウ" },
  "图标": { zh: "图标", en: "Icons", ja: "アイコン" },
  "动态壁纸": { zh: "动态壁纸", en: "Animated wallpaper", ja: "動く壁紙" },
  "像素壁纸": { zh: "像素壁纸", en: "Pixel wallpaper", ja: "ピクセル壁紙" },
  "欢迎窗": { zh: "欢迎窗", en: "Welcome modal", ja: "歓迎ウィンドウ" },
  "直链": { zh: "直链", en: "Deep link", ja: "直リンク" },
  "时间显示": { zh: "时间显示", en: "Time display", ja: "時刻表示" },
  "排序": { zh: "排序", en: "Sorting", ja: "並び替え" },
  "性能": { zh: "性能", en: "Performance", ja: "性能" },
  "观察": { zh: "观察", en: "Observations", ja: "観察" },
  "游戏": { zh: "游戏", en: "Games", ja: "ゲーム" },
  "碎碎念": { zh: "碎碎念", en: "Notes", ja: "メモ" },
  "最近更新": { zh: "最近更新", en: "Recent updates", ja: "最近の更新" },
  "界面": { zh: "界面", en: "Interface", ja: "表示" },
  "链接": { zh: "链接", en: "Links", ja: "リンク" },
  "安全": { zh: "安全", en: "Security", ja: "安全" },
  "图片": { zh: "图片", en: "Images", ja: "画像" },
  "iframe": { zh: "iframe", en: "iframe", ja: "iframe" },
  "聊天室": { zh: "聊天室", en: "Chat room", ja: "チャット" },
  "三语": { zh: "三语", en: "Trilingual", ja: "三言語" },
  "体验": { zh: "体验", en: "Experience", ja: "体験" },
  "筛选": { zh: "筛选", en: "Filters", ja: "フィルター" },
  "渲染": { zh: "渲染", en: "Rendering", ja: "描画" },
  "云存档": { zh: "云存档", en: "Cloud saves", ja: "クラウド保存" },
  "账号": { zh: "账号", en: "Account", ja: "アカウント" },
  "无障碍": { zh: "无障碍", en: "Accessibility", ja: "アクセシビリティ" },
  "AI": { zh: "AI", en: "AI", ja: "AI" },
  "Agent": { zh: "Agent", en: "Agent", ja: "Agent" },
  "Codex": { zh: "Codex", en: "Codex", ja: "Codex" },
  "fallback": { zh: "fallback", en: "Fallback", ja: "Fallback" },
  "测试": { zh: "测试", en: "Test", ja: "テスト" },
  "工具": { zh: "工具", en: "Tools", ja: "ツール" },
  "2048": { zh: "2048", en: "2048", ja: "2048" },
  "Hextris": { zh: "Hextris", en: "Hextris", ja: "Hextris" },
  "Bilibili": { zh: "Bilibili", en: "Bilibili", ja: "Bilibili" },
  "RSS": { zh: "RSS", en: "RSS", ja: "RSS" },
  "空状态": { zh: "空状态", en: "Empty state", ja: "空状態" },
  "筛选": { zh: "筛选", en: "Filters", ja: "フィルター" },
  "数量": { zh: "数量", en: "Counts", ja: "件数" },
  "订阅": { zh: "订阅", en: "Subscribe", ja: "購読" }
};

const pageIds = ["home", "knowledge", "videos", "resources", "games", "blog", "chatroom", "about"];

const socialLinkPlatforms = [
  { id: "x", label: "X", defaultUrl: "https://x.com/lusu575" },
  { id: "github", label: "GitHub", defaultUrl: "https://github.com/lusu575" },
  { id: "bilibili", label: "Bilibili", defaultUrl: "https://space.bilibili.com/" },
  { id: "instagram", label: "Instagram", defaultUrl: "https://www.instagram.com/lusu575/" },
  { id: "discord", label: "Discord", defaultUrl: "https://discord.com/" }
];
const socialLinkPlatformMap = new Map(socialLinkPlatforms.map((item) => [item.id, item]));

const chatStorageKeys = {
  visitorId: "lusu-chat-visitor-id",
  nickname: "lusu-chat-nickname",
  lastSentAt: "lusu-chat-last-sent-at"
};

const chatState = {
  initialized: false,
  loading: false,
  hasLoadedInitial: false,
  idlePolls: 0,
  visitorId: "",
  nickname: "",
  lastMessageId: "",
  seenMessageIds: new Set(),
  pollTimer: null,
  lastSentAt: Number(localStorage.getItem(chatStorageKeys.lastSentAt) || "0")
};

function t(key) {
  if (key === "videoFullscreen") {
    return translations[currentLang][key] || (currentLang === "en" ? "Full screen" : "全屏");
  }
  return translations[currentLang][key] || translations.zh[key] || key;
}

function label(key) {
  return labels[currentLang][key];
}

function localText(value) {
  if (typeof value === "string") {
    return value;
  }
  return value?.[currentLang] || value?.zh || value?.en || value?.ja || "";
}

function decodeHashValue(value) {
  try {
    return decodeURIComponent(String(value || ""));
  } catch {
    return String(value || "");
  }
}

function parseRouteHash(hash = window.location.hash) {
  const raw = decodeHashValue(String(hash || "").replace(/^#/, "")).replace(/^\/+/, "");
  if (!raw) {
    return { route: "home", articleSlug: "" };
  }
  const articleMatch = raw.match(/^knowledge\/article\/([a-z0-9][a-z0-9-]{0,119})$/);
  if (articleMatch) {
    return { route: "knowledge", articleSlug: articleMatch[1] };
  }
  return {
    route: pageIds.includes(raw) ? raw : "home",
    articleSlug: ""
  };
}

function parseRouteLocation() {
  const articleMatch = window.location.pathname.match(/^\/articles\/([a-z0-9][a-z0-9-]{0,119})\/?$/);
  if (articleMatch) {
    return { route: "knowledge", articleSlug: articleMatch[1] };
  }
  return parseRouteHash();
}

function articleRoutePath(slug) {
  return `/articles/${encodeURIComponent(slug)}`;
}

function articleRouteHref(slug, lang = currentLang) {
  const url = new URL(articleRoutePath(slug), window.location.origin);
  url.searchParams.set("lang", lang);
  return `${url.pathname}${url.search}`;
}

function routeUrl(route, articleSlug = "") {
  if (route === "knowledge" && articleSlug) {
    return articleRoutePath(articleSlug);
  }
  return route === "home" ? "/" : `/#${route}`;
}

function withLanguageQuery(path, lang = currentLang) {
  const nextUrl = new URL(path, window.location.origin);
  const params = new URLSearchParams(window.location.search);
  params.set("lang", lang);
  nextUrl.search = params.toString();
  return `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
}

function syncLanguageUrl(lang = currentLang) {
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set("lang", lang);
  const nextPath = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
  const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (currentPath !== nextPath) {
    window.history.replaceState(null, "", nextPath);
  }
}

function rssFeedPath(lang = currentLang) {
  return `/api/rss.xml?lang=${encodeURIComponent(lang)}`;
}

function syncRssLinks(lang = currentLang) {
  document.querySelectorAll("[data-rss-link]").forEach((link) => {
    link.href = rssFeedPath(lang);
  });
  document.querySelectorAll("[data-rss-alternate]").forEach((link) => {
    link.href = rssFeedPath(lang);
  });
}

function canonicalSiteUrl(lang = currentLang) {
  const pathname = window.location.pathname.startsWith("/articles/")
    ? window.location.pathname
    : "/";
  const params = new URLSearchParams();
  params.set("lang", lang);
  return `https://lusu575.com${pathname}?${params.toString()}`;
}

function setMetaContent(selector, content) {
  const node = document.querySelector(selector);
  if (node) {
    node.setAttribute("content", content);
  }
}

function setLinkHref(selector, href) {
  const node = document.querySelector(selector);
  if (node) {
    node.setAttribute("href", href);
  }
}

function syncDocumentMeta(lang = currentLang) {
  const title = t("heroTitle");
  const description = t("siteDescription");
  const canonicalUrl = canonicalSiteUrl(lang);
  const locale = { zh: "zh_CN", en: "en_US", ja: "ja_JP" }[lang] || "zh_CN";

  document.title = title;
  setLinkHref('link[rel="canonical"]', canonicalUrl);
  setMetaContent('meta[name="description"]', description);
  setMetaContent('meta[property="og:site_name"]', title);
  setMetaContent('meta[property="og:title"]', title);
  setMetaContent('meta[property="og:description"]', description);
  setMetaContent('meta[property="og:url"]', canonicalUrl);
  setMetaContent('meta[property="og:locale"]', locale);
  setMetaContent('meta[name="twitter:title"]', title);
  setMetaContent('meta[name="twitter:description"]', description);
}

function syncBrowserUrl(route, articleSlug = "") {
  const nextUrl = withLanguageQuery(routeUrl(route, articleSlug));
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (currentUrl !== nextUrl) {
    window.history.pushState(null, "", nextUrl);
  }
}

function sitePath(path) {
  const value = String(path || "").trim();
  if (!value || /^(https?:|data:|\/)/i.test(value)) {
    return value;
  }
  return `/${value.replace(/^\.?\//, "")}`;
}

function safeHttpUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch (error) {
    return "";
  }
}

function normalizeSocialLinksPayload(payload) {
  const source = Array.isArray(payload?.links) ? payload.links : [];
  return source.reduce((result, item) => {
    const platform = String(item?.platform || item?.id || "").trim();
    const url = safeHttpUrl(item?.url);
    if (platform && url) {
      result[platform] = url;
    }
    return result;
  }, {});
}

function syncSocialLinks(links = {}) {
  document.querySelectorAll("[data-social-link]").forEach((anchor) => {
    const platform = socialLinkPlatformMap.get(anchor.dataset.socialLink);
    if (!platform) {
      return;
    }
    const url = safeHttpUrl(links[platform.id]) || platform.defaultUrl;
    anchor.href = url;
    anchor.title = platform.label;
    anchor.setAttribute("aria-label", platform.label);
    anchor.rel = "noopener noreferrer";
    anchor.target = "_blank";
  });
}

async function loadSocialLinks() {
  syncSocialLinks();
  try {
    const response = await fetch("/api/social-links", { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || `HTTP ${response.status}`);
    }
    syncSocialLinks(normalizeSocialLinksPayload(payload));
  } catch (error) {
    syncSocialLinks();
  }
}

function contentTitle(value) {
  return `${localText(value)}${t("placeholderMark")}`;
}

function safeGameCoverSrc(value) {
  const fallback = "/assets/images/icon-games.png";
  const path = String(value || "").trim().replace(/^(\.\.\/)+/, "");
  if (/^assets\/images\/[a-z0-9._/-]+\.(png|jpe?g|webp|gif)(\?[a-z0-9=&._-]+)?$/i.test(path)) {
    return sitePath(path);
  }
  return fallback;
}

function safeGameEntry(value) {
  const entry = String(value || "").trim().replace(/^\/+/, "");
  return /^[a-z0-9][a-z0-9-]*\/?$/i.test(entry) ? entry.replace(/\/?$/, "/") : "";
}

function buildGameUrl(item) {
  if (item.playUrl) {
    const value = String(item.playUrl).trim();
    const external = safeHttpUrl(value);
    if (external) {
      return external;
    }
    const localPath = value.replace(/^\.?\//, "");
    return /^[a-z0-9._/-]+$/i.test(localPath) ? sitePath(localPath) : "";
  }
  if (item.externalUrl) {
    return safeHttpUrl(item.externalUrl);
  }
  if (item.repo && !item.entry) {
    return safeHttpUrl(item.repo);
  }
  const entry = safeGameEntry(item.entry);
  return entry ? `/games/${entry}?lang=${encodeURIComponent(currentLang)}` : "";
}

function languageSupportTagElements(item) {
  const supported = item.languageSupport || {};
  const languageNames = {
    zh: { zh: "中文", en: "英文", ja: "日文" },
    en: { zh: "Chinese", en: "English", ja: "Japanese" },
    ja: { zh: "中国語", en: "英語", ja: "日本語" }
  };

  return ["zh", "en", "ja"].map((lang) => {
    const name = languageNames[currentLang]?.[lang] || languageNames.zh[lang] || lang;
    const title = supported[lang] ? name : `${name} ${t("gameLanguageUnsupported")}`;
    const tag = document.createElement("span");
    tag.className = `tag language-tag${supported[lang] ? " supported" : " unsupported"}`;
    tag.title = title;
    tag.textContent = `${name} ${supported[lang] ? "✓" : "×"}`;
    return tag;
  });
}

function isExternalGameUrl(url) {
  return /^https?:\/\//i.test(url);
}

function setLanguage(lang, options = {}) {
  currentLang = lang;
  if (options.persist) {
    localStorage.setItem(languageStorageKey, lang);
  }
  if (options.syncUrl) {
    syncLanguageUrl(lang);
  }
  document.documentElement.lang = lang === "zh" ? "zh-CN" : lang;
  syncRssLinks(lang);
  syncDocumentMeta(lang);

  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    node.setAttribute("placeholder", t(node.dataset.i18nPlaceholder));
  });

  document.querySelectorAll("[data-i18n-aria-label]").forEach((node) => {
    node.setAttribute("aria-label", t(node.dataset.i18nAriaLabel));
  });

  document.querySelectorAll("[data-i18n-title]").forEach((node) => {
    node.setAttribute("title", t(node.dataset.i18nTitle));
  });

  document.querySelectorAll(".lang-button").forEach((button) => {
    const active = button.dataset.lang === lang;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  renderAll();
  loadArticles();
  loadVideos();
  updateWelcomeGreeting();
  updateVideoWindowButton();
  renderAccountWidget();
}

function navigate(route, options = {}) {
  const nextRoute = pageIds.includes(route) ? route : "home";
  if (nextRoute === "home" && articleState.currentSlug) {
    articleState.currentSlug = "";
    articleState.currentArticle = null;
    articleState.detailLoadingKey = "";
    renderKnowledge();
  }
  document.querySelectorAll(".page").forEach((page) => {
    page.classList.toggle("active", page.id === nextRoute);
  });
  updateNavigationState(nextRoute);
  if (nextRoute === "chatroom") {
    initChatroom();
  }
  if (options.updateUrl !== false && options.updateHash !== false) {
    syncBrowserUrl(nextRoute, nextRoute === "knowledge" ? options.articleSlug || "" : "");
  }
  window.scrollTo({ top: 0, behavior: "auto" });
}

function updateNavigationState(route) {
  document.querySelectorAll(".taskbar-tabs button[data-route], .start-button[data-route]").forEach((button) => {
    const active = button.dataset.route === route;
    button.classList.toggle("active", active);
    if (active) {
      button.setAttribute("aria-current", "page");
    } else {
      button.removeAttribute("aria-current");
    }
  });

  document.querySelectorAll(".desktop-icon[data-route]").forEach((button) => {
    const active = button.dataset.route === route;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function syncRouteFromLocation() {
  const parsed = parseRouteLocation();
  if (parsed.route === "knowledge") {
    if (parsed.articleSlug) {
      articleState.currentSlug = parsed.articleSlug;
      articleState.currentArticle = null;
      articleState.detailLoadingKey = "";
    } else {
      articleState.currentSlug = "";
      articleState.currentArticle = null;
      articleState.detailLoadingKey = "";
    }
  }
  navigate(parsed.route, { updateUrl: false });
  if (parsed.route === "knowledge") {
    closeWelcome();
    renderKnowledge();
  }
}

function renderCategoryButtons(targetId, type, categories) {
  const target = document.getElementById(targetId);
  const buttons = [t("all"), ...categories].map((name, index) => {
    const value = index === 0 ? "all" : String(index - 1);
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.filterType = type;
    button.dataset.filter = value;
    button.textContent = name;
    button.classList.toggle("active", activeFilters[type] === value);
    if (type === "knowledge") {
      button.classList.add("category-button");
    }
    return button;
  });
  target.replaceChildren(...buttons);
}

function renderKnowledge() {
  const list = document.getElementById("knowledge-list");
  const detail = document.getElementById("article-detail");
  const layout = document.querySelector("#knowledge .folder-layout");
  const searchBar = document.getElementById("knowledge-searchbar");
  const categories = sortArticleCategories([...new Set(articleState.articles.map((item) => item.category).filter(Boolean))]);

  if (articleState.currentSlug) {
    if (searchBar) {
      searchBar.hidden = true;
    }
    document.body.classList.add("is-article-reading");
    layout?.classList.add("is-reading");
    list.hidden = true;
    detail.hidden = false;
    const detailKey = `${articleState.currentSlug}:${currentLang}`;
    if (articleState.currentArticle && articleState.currentArticle.slug === articleState.currentSlug && articleState.currentArticle.requestedLang === currentLang) {
      renderArticleDetail(articleState.currentArticle);
    } else if (articleState.detailCache.has(detailKey)) {
      articleState.currentArticle = articleState.detailCache.get(detailKey);
      renderArticleDetail(articleState.currentArticle);
    } else if (articleState.detailLoadingKey !== detailKey) {
      loadArticleDetail(articleState.currentSlug);
    }
    return;
  }

  if (searchBar) {
    searchBar.hidden = false;
  }
  document.body.classList.remove("is-article-reading");
  document.body.classList.remove("is-article-window-restored");
  layout?.classList.remove("is-reading");
  renderKnowledgeCategoryButtons(categories);
  list.hidden = false;
  detail.hidden = true;
  if (articleState.loading) {
    renderKnowledgeSearchControls(null, null);
    renderListMessage(list, t("articleLoading"));
    return;
  }
  if (articleState.error) {
    renderKnowledgeSearchControls(null, null);
    renderListMessage(list, t("articleLoadFailed"));
    return;
  }

  const categoryItems = articleState.articles.filter((item) => activeFilters.knowledge === "all" || item.category === activeFilters.knowledge);
  const items = categoryItems.filter(articleMatchesSearch);
  renderKnowledgeSearchControls(items.length, categoryItems.length);
  if (!articleState.articles.length) {
    renderListMessage(list, t("articleEmpty"));
    return;
  }
  if (!items.length) {
    renderListMessage(list, t("articleSearchNoResults"));
    return;
  }

  list.replaceChildren(...items.map((item) => articleCardElement(item)));
}

function renderListMessage(list, message) {
  const note = document.createElement("p");
  note.className = "loading-text";
  note.textContent = message;
  list.replaceChildren(note);
}

function articleCardElement(item) {
  const card = document.createElement("article");
  card.className = "article-card";

  const title = document.createElement("h3");
  title.textContent = item.title || "";
  const summary = document.createElement("p");
  summary.textContent = item.summary || "";

  const meta = document.createElement("div");
  meta.className = "meta-row";
  const category = document.createElement("span");
  category.textContent = `${t("articleCategory")}：${articleCategoryName(item.category || "note")}`;
  meta.appendChild(category);
  (item.tags || []).forEach((tag) => {
    const tagNode = document.createElement("span");
    tagNode.className = "tag";
    tagNode.textContent = articleTagName(tag);
    meta.appendChild(tagNode);
  });
  const published = document.createElement("span");
  published.textContent = `${t("articlePublished")}：${formatArticleDate(item.published_at || item.created_at)}`;
  meta.appendChild(published);
  if (item.lang !== currentLang) {
    const fallback = document.createElement("span");
    fallback.className = "tag";
    fallback.textContent = t("articleFallback");
    meta.appendChild(fallback);
  }

  const action = document.createElement("a");
  action.className = "card-action";
  action.href = articleRouteHref(item.slug);
  action.dataset.articleSlug = item.slug;
  action.textContent = t("readButton");

  card.append(title, summary, meta, action);
  return card;
}

function renderKnowledgeSearchControls(count, total) {
  const input = document.getElementById("knowledge-search-input");
  const clearButton = document.querySelector("[data-article-search-clear]");
  const status = document.getElementById("knowledge-search-status");
  if (input && input.value !== articleState.searchTerm) {
    input.value = articleState.searchTerm;
  }
  if (clearButton) {
    clearButton.disabled = !articleState.searchTerm.trim();
  }
  if (!status) {
    return;
  }
  if (typeof count !== "number" || typeof total !== "number") {
    status.textContent = "";
    return;
  }
  const template = articleState.searchTerm.trim() || activeFilters.knowledge !== "all"
    ? t("articleSearchFiltered")
    : t("articleSearchCount");
  status.textContent = template
    .replace("{count}", String(count))
    .replace("{total}", String(total));
}

function normalizeSearchText(value) {
  return String(value || "").toLocaleLowerCase();
}

function articleMatchesSearch(item) {
  const term = normalizeSearchText(articleState.searchTerm.trim());
  if (!term) {
    return true;
  }
  const haystack = [
    item.title,
    item.summary,
    item.slug,
    item.category,
    articleCategoryName(item.category || "note"),
    ...(item.tags || []),
    ...(item.tags || []).map(articleTagName)
  ].map(normalizeSearchText).join(" ");
  return haystack.includes(term);
}

function renderKnowledgeCategoryButtons(categories) {
  const target = document.getElementById("knowledge-categories");
  const buttons = ["all", ...categories].map((category) => {
    const value = String(category);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `${activeFilters.knowledge === value ? "active " : ""}category-button`;
    button.dataset.filterType = "knowledge";
    button.dataset.filter = value;
    const labelText = articleCategoryName(value);
    button.title = labelText;
    button.setAttribute("aria-label", labelText);
    const labelNode = document.createElement("span");
    labelNode.textContent = labelText;
    button.appendChild(labelNode);
    return button;
  });
  target.replaceChildren(...buttons);
}

function sortArticleCategories(categories) {
  return categories.sort((a, b) => {
    if (a === siteUpdateCategory) return 1;
    if (b === siteUpdateCategory) return -1;
    return articleCategoryName(a).localeCompare(articleCategoryName(b));
  });
}

function articleCategoryName(category) {
  if (category === "all") {
    return t("all");
  }
  return articleCategoryLabels[category]?.[currentLang] || category || "note";
}

function articleTagName(tag) {
  return tagLabels[tag]?.[currentLang] || tag || "";
}

function isCollapsedPublicLoopUpdate(item) {
  const slug = String(item?.slug || "");
  if (slug === publicLoopNightlyUpdateSlug) {
    return false;
  }
  if (item?.category === siteUpdateCategory && publicLoopNightlyCollapsedSlugs.has(slug)) {
    return true;
  }
  if (item?.category === siteUpdateCategory && slug.startsWith("2026-06-18-")) {
    return true;
  }
  const fallbackTitleEn = typeof item?.title === "object" ? item.title.en : "";
  if (!slug && publicLoopNightlyCollapsedFallbackTitlesEn.has(fallbackTitleEn)) {
    return true;
  }
  return !slug && item?.date === "2026.06.18" && fallbackTitleEn !== publicLoopNightlyUpdateTitleEn;
}

function visiblePublicArticles(items) {
  return (items || []).filter((item) => !isCollapsedPublicLoopUpdate(item));
}

function visibleLocalUpdates() {
  return visiblePublicArticles(content.updates);
}

async function loadArticles() {
  const requestId = articleState.requestId + 1;
  articleState.requestId = requestId;
  articleState.loading = true;
  articleState.error = "";
  renderKnowledge();
  try {
    const payload = await articleApi(`/api/articles?lang=${encodeURIComponent(currentLang)}`);
    if (requestId !== articleState.requestId) {
      return;
    }
    articleState.articles = visiblePublicArticles(payload.articles || []);
    renderUpdates();
  } catch (error) {
    if (requestId !== articleState.requestId) {
      return;
    }
    articleState.articles = [];
    articleState.error = error.message || "failed";
    const list = document.getElementById("knowledge-list");
    list.hidden = false;
    document.getElementById("article-detail").hidden = true;
    renderListMessage(list, t("articleLoadFailed"));
  } finally {
    if (requestId === articleState.requestId) {
      articleState.loading = false;
      renderKnowledge();
      renderUpdates();
      document.getElementById("top-updated").textContent = latestUpdateDate();
    }
  }
}

async function loadVideos() {
  const requestId = videoState.requestId + 1;
  videoState.requestId = requestId;
  videoState.loading = true;
  videoState.error = "";
  renderVideos();
  try {
    const response = await fetch(`/api/videos?lang=${encodeURIComponent(currentLang)}`, { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || `HTTP ${response.status}`);
    }
    if (requestId !== videoState.requestId) {
      return;
    }
    videoState.categories = payload.categories || [];
    videoState.videos = payload.videos || [];
    const known = new Set(["all", ...videoState.categories.map((category) => category.category_id)]);
    if (!known.has(activeFilters.videos)) {
      activeFilters.videos = "all";
    }
  } catch (error) {
    if (requestId !== videoState.requestId) {
      return;
    }
    videoState.categories = [];
    videoState.videos = [];
    videoState.error = error.message || "failed";
  } finally {
    if (requestId === videoState.requestId) {
      videoState.loading = false;
      renderVideos();
    }
  }
}

async function loadArticleDetail(slug) {
  const requestId = articleState.detailRequestId + 1;
  const detailKey = `${slug}:${currentLang}`;
  const cachedArticle = articleState.detailCache.get(detailKey);
  if (cachedArticle) {
    articleState.currentArticle = cachedArticle;
    renderArticleDetail(cachedArticle);
    return;
  }

  articleState.detailRequestId = requestId;
  articleState.detailLoadingKey = detailKey;
  const detail = document.getElementById("article-detail");
  const title = document.getElementById("article-detail-title");
  const summary = document.getElementById("article-detail-summary");
  const meta = document.getElementById("article-detail-meta");
  const body = document.getElementById("article-detail-body");

  clearArticleCopyStatus();
  title.textContent = t("articleLoading");
  summary.textContent = "";
  meta.replaceChildren();
  body.replaceChildren();
  resetArticleReadProgress();
  resetArticleToc();

  try {
    const payload = await articleApi(`/api/articles/${encodeURIComponent(slug)}?lang=${encodeURIComponent(currentLang)}`);
    if (articleState.currentSlug !== slug || requestId !== articleState.detailRequestId) {
      return;
    }
    articleState.currentArticle = { ...payload.article, requestedLang: currentLang };
    articleState.detailCache.set(detailKey, articleState.currentArticle);
    renderArticleDetail(articleState.currentArticle);
  } catch {
    if (requestId === articleState.detailRequestId) {
      title.textContent = t("articleLoadFailed");
    }
  } finally {
    if (requestId === articleState.detailRequestId) {
      articleState.detailLoadingKey = "";
    }
  }
}

function renderArticleDetail(article) {
  const title = document.getElementById("article-detail-title");
  const summary = document.getElementById("article-detail-summary");
  const meta = document.getElementById("article-detail-meta");
  const body = document.getElementById("article-detail-body");

  clearArticleCopyStatus();
  resetArticleReadProgress();
  resetArticleToc();
  title.textContent = article.title || "";
  summary.textContent = article.summary || "";
  meta.replaceChildren();
  [
    { text: `${t("articleCategory")}：${articleCategoryName(article.category || "note")}`, className: "article-meta-item article-meta-category" },
    { text: `${t("articlePublished")}：${formatArticleDate(article.published_at || article.created_at)}`, className: "article-meta-item article-meta-published" },
    ...(article.tags || []).map((tag) => ({ text: `#${articleTagName(tag)}`, className: "tag" })),
    article.lang !== currentLang ? { text: t("articleFallback"), className: "tag" } : null
  ].filter(Boolean).forEach(({ text, className }) => {
    const item = document.createElement("span");
    item.className = className;
    item.textContent = text;
    meta.appendChild(item);
  });
  renderMarkdownSafe(body, stripRepeatedArticleHeading(article.content_markdown || "", article.title || ""));
  renderArticleToc();
  scheduleArticleReadProgressUpdate();
}

function resetArticleToc() {
  const toc = document.getElementById("article-detail-toc");
  const list = document.getElementById("article-detail-toc-list");
  if (list) {
    list.replaceChildren();
  }
  if (toc) {
    toc.hidden = true;
  }
}

function articleHeadingId(index) {
  return `article-heading-${index + 1}`;
}

function renderArticleToc() {
  const toc = document.getElementById("article-detail-toc");
  const list = document.getElementById("article-detail-toc-list");
  const body = document.getElementById("article-detail-body");
  if (!toc || !list || !body) {
    return;
  }
  const headings = [...body.querySelectorAll("h2, h3")]
    .map((heading, index) => ({ heading, index, text: heading.textContent.trim() }))
    .filter((item) => item.text);
  if (headings.length < 2) {
    resetArticleToc();
    return;
  }
  const buttons = headings.map(({ heading, index, text }, itemIndex) => {
    const id = articleHeadingId(index);
    heading.id = id;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `article-toc-link level-${heading.tagName === "H3" ? "3" : "2"}`;
    if (itemIndex === 0) {
      button.classList.add("is-active");
    }
    button.dataset.articleHeadingTarget = id;
    button.textContent = text;
    return button;
  });
  list.replaceChildren(...buttons);
  toc.hidden = false;
  updateArticleTocActive();
}

function updateArticleTocActive() {
  const detail = document.getElementById("article-detail");
  const body = document.getElementById("article-detail-body");
  const list = document.getElementById("article-detail-toc-list");
  if (!detail || detail.hidden || !body || !list) {
    return;
  }
  const headings = [...body.querySelectorAll("h2[id], h3[id]")];
  const links = [...list.querySelectorAll("[data-article-heading-target]")];
  if (!headings.length || !links.length) {
    return;
  }
  const detailTop = detail.getBoundingClientRect().top;
  let activeId = headings[0].id;
  headings.forEach((heading) => {
    if (heading.getBoundingClientRect().top - detailTop <= 108) {
      activeId = heading.id;
    }
  });
  links.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.articleHeadingTarget === activeId);
  });
}

function scrollToArticleHeading(targetId) {
  if (!/^article-heading-\d+$/.test(targetId || "")) {
    return;
  }
  const heading = document.getElementById(targetId);
  if (!heading) {
    return;
  }
  heading.scrollIntoView({ block: "start", behavior: "smooth" });
  updateArticleTocActive();
  scheduleArticleReadProgressUpdate();
}

function scrollArticleToTop() {
  const detail = document.getElementById("article-detail");
  if (!detail || detail.hidden) {
    return;
  }
  detail.scrollTo({ top: 0, behavior: "smooth" });
  scheduleArticleReadProgressUpdate();
}

function toggleArticleWindowSize() {
  if (!document.body.classList.contains("is-article-reading")) {
    return;
  }
  document.body.classList.toggle("is-article-window-restored");
  const button = document.querySelector("[data-article-window-toggle]");
  if (button) {
    button.setAttribute("aria-pressed", document.body.classList.contains("is-article-window-restored") ? "false" : "true");
  }
}

function clearArticleCopyStatus() {
  window.clearTimeout(articleState.copyStatusTimer);
  articleState.copyStatusTimer = 0;
  const status = document.getElementById("article-copy-status");
  const button = document.querySelector("[data-article-copy-link]");
  if (status) {
    status.textContent = "";
  }
  button?.classList.remove("is-done");
}

function setArticleReadProgress(percent) {
  const bounded = Math.min(100, Math.max(0, Math.round(percent)));
  const fill = document.getElementById("article-read-progress-fill");
  const value = document.getElementById("article-read-progress-value");
  const bar = document.getElementById("article-read-progress-bar");
  const topButton = document.querySelector("[data-article-scroll-top]");
  if (fill) {
    fill.style.transform = `scaleX(${bounded / 100})`;
  }
  if (value) {
    value.textContent = `${bounded}%`;
  }
  if (bar) {
    bar.setAttribute("aria-valuenow", String(bounded));
    bar.style.setProperty("--article-progress", String(bounded));
  }
  topButton?.classList.toggle("is-at-article-top", bounded <= 2);
}

function resetArticleReadProgress() {
  const detail = document.getElementById("article-detail");
  if (detail) {
    detail.scrollTop = 0;
  }
  setArticleReadProgress(0);
}

function updateArticleReadProgress() {
  articleState.readProgressFrame = 0;
  const detail = document.getElementById("article-detail");
  if (!detail || detail.hidden) {
    return;
  }
  const scrollable = Math.max(0, detail.scrollHeight - detail.clientHeight);
  if (scrollable <= 1) {
    setArticleReadProgress(100);
    updateArticleTocActive();
    return;
  }
  setArticleReadProgress((detail.scrollTop / scrollable) * 100);
  updateArticleTocActive();
}

function scheduleArticleReadProgressUpdate() {
  if (articleState.readProgressFrame) {
    return;
  }
  articleState.readProgressFrame = window.requestAnimationFrame(updateArticleReadProgress);
}

function articleShareLink(slug) {
  const url = new URL(articleRouteHref(slug), window.location.origin);
  return url.toString();
}

function fallbackCopyText(text) {
  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.top = "-1000px";
  field.style.left = "-1000px";
  document.body.appendChild(field);
  field.focus();
  field.select();
  const copied = document.execCommand("copy");
  field.remove();
  if (!copied) {
    throw new Error("copy failed");
  }
}

async function copyArticleLink() {
  const slug = articleState.currentArticle?.slug || articleState.currentSlug;
  const status = document.getElementById("article-copy-status");
  const button = document.querySelector("[data-article-copy-link]");
  if (!slug || !status) {
    return;
  }
  const shareUrl = articleShareLink(slug);
  try {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      await navigator.clipboard.writeText(shareUrl);
    } else {
      fallbackCopyText(shareUrl);
    }
    status.textContent = t("articleCopyDone");
    button?.classList.add("is-done");
  } catch {
    status.textContent = t("articleCopyFailed");
    button?.classList.remove("is-done");
  }
  window.clearTimeout(articleState.copyStatusTimer);
  articleState.copyStatusTimer = window.setTimeout(() => {
    status.textContent = "";
    button?.classList.remove("is-done");
  }, 2400);
}

function showArticle(slug) {
  articleState.currentSlug = slug;
  articleState.currentArticle = null;
  articleState.detailLoadingKey = "";
  navigate("knowledge", { articleSlug: slug });
  closeWelcome();
  renderKnowledge();
}

function showArticleList() {
  articleState.currentSlug = "";
  articleState.currentArticle = null;
  articleState.detailLoadingKey = "";
  resetArticleReadProgress();
  resetArticleToc();
  navigate("knowledge");
  renderKnowledge();
}

function showArticleCategory(category) {
  activeFilters.knowledge = category;
  articleState.currentSlug = "";
  articleState.currentArticle = null;
  articleState.detailLoadingKey = "";
  navigate("knowledge");
  closeWelcome();
  renderKnowledge();
}

async function articleApi(path) {
  const response = await fetch(path, { headers: { "Accept": "application/json" } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `HTTP ${response.status}`);
  }
  return payload;
}

function normalizeDateInput(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  if (/^\d{4}\.\d{2}\.\d{2}$/.test(raw)) {
    return raw.replace(/^(\d{4})\.(\d{2})\.(\d{2})$/, "$1-$2-$3T00:00:00");
  }
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(raw)) {
    return raw.replace(" ", "T") + (/[zZ]|[+-]\d{2}:?\d{2}$/.test(raw) ? "" : "Z");
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?$/.test(raw)) {
    return `${raw}Z`;
  }
  return raw;
}

function localTimeZoneLabel() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "Local";
}

function formatZonedDateTime(value, options = {}) {
  const normalizedValue = normalizeDateInput(value);
  const date = new Date(normalizedValue);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const includeDate = options.includeDate ?? true;
  const includeTimeZone = options.includeTimeZone ?? false;
  const parts = new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(date).reduce((result, part) => {
    result[part.type] = part.value;
    return result;
  }, {});
  const dateText = includeDate ? `${parts.year}-${parts.month}-${parts.day} ` : "";
  const zoneText = includeTimeZone ? ` ${localTimeZoneLabel()}` : "";
  return `${dateText}${parts.hour}:${parts.minute}:${parts.second}${zoneText}`;
}

function formatArticleDate(value) {
  return formatZonedDateTime(value, { includeDate: true, includeTimeZone: false });
}

function formatLocalDateKey(value) {
  const normalizedValue = normalizeDateInput(value);
  const date = new Date(normalizedValue);
  if (Number.isNaN(date.getTime())) {
    return String(value || "").slice(0, 10).replace(/-/g, ".");
  }
  const parts = new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date).reduce((result, part) => {
    result[part.type] = part.value;
    return result;
  }, {});
  return `${parts.year}.${parts.month}.${parts.day}`;
}

function renderMarkdownSafe(target, markdown) {
  target.replaceChildren();
  const lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (/^```/.test(line.trim())) {
      const fence = line.trim().replace(/^```/, "").trim().toLowerCase();
      const codeLines = [];
      index += 1;
      while (index < lines.length && !/^```/.test(lines[index].trim())) {
        codeLines.push(lines[index]);
        index += 1;
      }
      index += 1;
      if (fence === "text") {
        target.appendChild(renderArticleCallout(codeLines));
        continue;
      }
      const pre = document.createElement("pre");
      const code = document.createElement("code");
      code.textContent = codeLines.join("\n");
      pre.appendChild(code);
      target.appendChild(pre);
      continue;
    }

    const image = line.trim().match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
    if (image) {
      const figure = renderArticleFigure(image[1], image[2]);
      if (figure) {
        target.appendChild(figure);
      }
      index += 1;
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const node = document.createElement(`h${heading[1].length}`);
      appendInlineMarkdown(node, heading[2]);
      target.appendChild(node);
      index += 1;
      continue;
    }

    if (/^>\s+/.test(line)) {
      const quote = document.createElement("blockquote");
      appendInlineMarkdown(quote, line.replace(/^>\s+/, ""));
      target.appendChild(quote);
      index += 1;
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const list = document.createElement("ol");
      while (index < lines.length && /^\d+\.\s+/.test(lines[index])) {
        const item = document.createElement("li");
        appendInlineMarkdown(item, lines[index].replace(/^\d+\.\s+/, ""));
        list.appendChild(item);
        index += 1;
      }
      target.appendChild(list);
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const list = document.createElement("ul");
      while (index < lines.length && /^[-*]\s+/.test(lines[index])) {
        const item = document.createElement("li");
        appendInlineMarkdown(item, lines[index].replace(/^[-*]\s+/, ""));
        list.appendChild(item);
        index += 1;
      }
      target.appendChild(list);
      continue;
    }

    const paragraphLines = [];
    while (
      index < lines.length
      && lines[index].trim()
      && !/^(#{1,3})\s+/.test(lines[index])
      && !/^\d+\.\s+/.test(lines[index])
      && !/^[-*]\s+/.test(lines[index])
      && !/^!\[[^\]]*\]\([^)]+\)$/.test(lines[index].trim())
      && !/^>\s+/.test(lines[index])
      && !/^```/.test(lines[index].trim())
    ) {
      paragraphLines.push(lines[index]);
      index += 1;
    }
    const paragraph = document.createElement("p");
    appendInlineMarkdown(paragraph, paragraphLines.join(" "));
    target.appendChild(paragraph);
  }
}

function renderArticleCallout(lines) {
  const box = document.createElement("div");
  box.className = "article-callout";
  String(lines.join("\n")).split("\n").forEach((line) => {
    const item = document.createElement("p");
    appendInlineMarkdown(item, line);
    box.appendChild(item);
  });
  return box;
}

function safeArticleImageSrc(src) {
  const value = String(src || "").trim();
  if (/(^|\/)\.\.(\/|$)/.test(value)) {
    return "";
  }
  if (/^assets\/images\/articles\/[a-z0-9._/-]+\.(png|jpe?g|webp|gif)(\?[a-z0-9=&._-]+)?$/i.test(value)) {
    return value;
  }
  return "";
}

function renderArticleFigure(alt, src) {
  const safeSrc = safeArticleImageSrc(src);
  if (!safeSrc) {
    return null;
  }
  const figure = document.createElement("figure");
  figure.className = "article-figure";
  const image = document.createElement("img");
  image.src = sitePath(safeSrc);
  image.alt = alt || "";
  image.loading = "lazy";
  image.decoding = "async";
  figure.appendChild(image);
  if (alt) {
    const caption = document.createElement("figcaption");
    caption.textContent = alt;
    figure.appendChild(caption);
  }
  return figure;
}

function stripRepeatedArticleHeading(markdown, title) {
  const lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");
  const firstContentIndex = lines.findIndex((line) => line.trim());
  if (firstContentIndex < 0) {
    return "";
  }
  const first = lines[firstContentIndex].trim();
  if (first.replace(/^#\s+/, "") === String(title || "").trim()) {
    lines.splice(firstContentIndex, 1);
    return lines.join("\n").replace(/^\n+/, "");
  }
  return markdown;
}

function appendInlineMarkdown(parent, text) {
  const parts = String(text).split(/(`[^`]+`|\*\*[^*]+\*\*)/g).filter(Boolean);
  parts.forEach((part) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      const code = document.createElement("code");
      code.textContent = part.slice(1, -1);
      parent.appendChild(code);
      return;
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      const strong = document.createElement("strong");
      strong.textContent = part.slice(2, -2);
      parent.appendChild(strong);
      return;
    }
    parent.appendChild(document.createTextNode(part));
  });
}

function renderVideos() {
  const list = document.getElementById("video-list");
  renderVideoCategoryButtons();
  list.replaceChildren();
  if (videoState.loading) {
    list.appendChild(renderVideoStatusState("loading"));
    return;
  }
  if (videoState.error) {
    list.appendChild(renderVideoStatusState("failed"));
    return;
  }
  const items = videoState.videos.filter((item) => (
    activeFilters.videos === "all"
      || (item.categories || []).some((category) => category.category_id === activeFilters.videos)
  ));
  if (!items.length) {
    list.appendChild(renderVideoEmptyState(videoState.videos.length > 0));
    return;
  }
  items.forEach((item) => list.appendChild(videoCardElement(item)));
}

function renderVideoStatusState(kind) {
  const state = document.createElement("article");
  state.className = "video-empty-state video-status-state";

  const icon = document.createElement("span");
  icon.className = "video-empty-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = kind === "loading" ? "▣" : "!";

  const copy = document.createElement("div");
  copy.className = "video-empty-copy";
  const title = document.createElement("h3");
  title.textContent = videoUiText(kind);

  copy.appendChild(title);
  state.append(icon, copy);
  return state;
}

function renderVideoEmptyState(isFiltered = false) {
  const state = document.createElement("article");
  state.className = "video-empty-state";

  const icon = document.createElement("span");
  icon.className = "video-empty-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = "▣";

  const copy = document.createElement("div");
  copy.className = "video-empty-copy";
  const title = document.createElement("h3");
  title.textContent = videoUiText("emptyTitle");
  const text = document.createElement("p");
  text.textContent = videoUiText(isFiltered ? "emptyFiltered" : "emptyBody");
  copy.append(title, text);

  const action = document.createElement("button");
  action.type = "button";
  action.className = "xp-button";
  action.dataset.articleCategory = siteUpdateCategory;
  action.textContent = videoUiText("emptyAction");

  state.append(icon, copy, action);
  return state;
}

function renderVideoCategoryButtons() {
  const target = document.getElementById("video-categories");
  target.replaceChildren();
  const categories = [{ category_id: "all", name: t("all") }, ...videoState.categories];
  categories.forEach((category) => {
    const button = document.createElement("button");
    const name = category.name || category.name_zh || category.slug || t("all");
    button.type = "button";
    button.dataset.filterType = "videos";
    button.dataset.filter = category.category_id;
    button.title = name;
    button.setAttribute("aria-label", name);
    button.classList.toggle("active", activeFilters.videos === category.category_id);
    const labelNode = document.createElement("span");
    labelNode.textContent = name;
    button.appendChild(labelNode);
    target.appendChild(button);
  });
}

function videoCardElement(item) {
  const card = document.createElement("article");
  card.className = "video-card";

  const thumb = document.createElement("button");
  thumb.type = "button";
  thumb.className = "video-thumb";
  thumb.dataset.videoId = item.video_id;
  thumb.setAttribute("aria-label", videoUiText("playAria"));
  const thumbnailUrl = safeVideoThumbnailSrc(item.thumbnail_url);
  if (thumbnailUrl) {
    const image = document.createElement("img");
    image.src = thumbnailUrl;
    image.alt = "";
    image.loading = "lazy";
    image.decoding = "async";
    image.addEventListener("error", () => {
      thumb.classList.add("is-fallback");
      image.remove();
    }, { once: true });
    thumb.appendChild(image);
  } else {
    thumb.classList.add("is-fallback");
  }

  const body = document.createElement("div");
  body.className = "video-body";
  const platform = document.createElement("span");
  platform.className = `platform ${String(item.platform || "").toLowerCase()}`;
  platform.textContent = item.platform === "youtube" ? "YouTube" : "Bilibili";
  const title = document.createElement("h3");
  title.textContent = item.title || videoUiText("untitled");
  const desc = document.createElement("p");
  desc.textContent = item.description || videoUiText("noDescription");
  const meta = document.createElement("div");
  meta.className = "video-meta";
  [item.author_name, formatArticleDate(item.published_at)].filter(Boolean).forEach((text) => {
    const span = document.createElement("span");
    span.textContent = text;
    meta.appendChild(span);
  });
  const button = document.createElement("button");
  button.className = "card-action";
  button.type = "button";
  button.dataset.videoId = item.video_id;
  button.textContent = t("playButton");

  body.append(platform, title, desc, meta, button);
  card.append(thumb, body);
  return card;
}

function safeVideoThumbnailSrc(src) {
  const value = String(src || "").trim();
  if (!value) {
    return "";
  }
  if (/^data:image\/(avif|jpe?g|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/i.test(value)) {
    return value;
  }
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    const allowed = new Set([
      "i.ytimg.com",
      "img.youtube.com",
      "i0.hdslb.com",
      "i1.hdslb.com",
      "i2.hdslb.com",
      "archive.biliimg.com"
    ]);
    return url.protocol === "https:" && allowed.has(host) ? url.toString() : "";
  } catch (error) {
    return "";
  }
}

function safeVideoSourceUrl(src) {
  const url = safeHttpUrl(src);
  if (!url) {
    return "";
  }
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    return host === "youtube.com"
      || host === "youtu.be"
      || host === "bilibili.com"
      || host.endsWith(".bilibili.com")
      || host === "b23.tv"
      ? parsed.toString()
      : "";
  } catch (error) {
    return "";
  }
}

function safeVideoEmbedUrl(src) {
  const url = safeHttpUrl(src);
  if (!url) {
    return null;
  }
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    const isYoutube = host === "youtube.com" && parsed.pathname.startsWith("/embed/");
    const isBilibili = host === "player.bilibili.com" && parsed.pathname === "/player.html";
    return isYoutube || isBilibili ? parsed : null;
  } catch (error) {
    return null;
  }
}

function videoAutoplayUrl(src) {
  const url = safeVideoEmbedUrl(src);
  if (!url) {
    return "";
  }
  if (url.hostname.toLowerCase().includes("youtube.com")) {
    url.searchParams.set("autoplay", "1");
    url.searchParams.set("playsinline", "1");
    url.searchParams.set("rel", "0");
    url.searchParams.set("modestbranding", "1");
    url.searchParams.set("iv_load_policy", "3");
  }
  if (url.hostname.toLowerCase().includes("bilibili.com")) {
    url.searchParams.set("autoplay", "1");
    url.searchParams.set("high_quality", "1");
    url.searchParams.set("as_wide", "1");
    url.searchParams.set("danmaku", "0");
  }
  return url.toString();
}

function videoClickShield() {
  const shield = document.createElement("div");
  shield.className = "video-click-shield";
  shield.setAttribute("aria-hidden", "true");
  [
    "middle-left",
    "middle-right",
    "middle-top",
    "middle-bottom",
    "bottom-center"
  ].forEach((name) => {
    const blocker = document.createElement("span");
    blocker.className = `video-click-blocker--${name}`;
    shield.appendChild(blocker);
  });
  return shield;
}

function videoUiText(key) {
  const copy = {
    loading: { zh: "正在读取视频...", en: "Loading videos...", ja: "動画を読み込み中..." },
    failed: { zh: "视频读取失败，请稍后再试。", en: "Videos failed to load. Please try again later.", ja: "動画を読み込めませんでした。後でお試しください。" },
    empty: { zh: "这里还没有发布的视频。", en: "No published videos yet.", ja: "公開済みの動画はまだありません。" },
    emptyTitle: { zh: "视频还在整理中", en: "Videos are being organized", ja: "動画を整理中です" },
    emptyBody: { zh: "这里会放 Bilibili / YouTube 作品、收藏和网站施工记录。可以先查看最近的网站更新。", en: "Bilibili / YouTube works, favorites, and build logs will live here. You can check recent site updates first.", ja: "ここには Bilibili / YouTube の作品、保存動画、制作記録を置く予定です。まずは最近のサイト更新を確認できます。" },
    emptyFiltered: { zh: "当前分类暂时没有公开视频，换个分类或先看看网站更新记录。", en: "This category has no published videos yet. Try another category or check site updates.", ja: "このカテゴリには公開動画がまだありません。別のカテゴリ、またはサイト更新記録を確認してください。" },
    emptyAction: { zh: "查看网站更新", en: "View site updates", ja: "サイト更新を見る" },
    untitled: { zh: "未命名视频", en: "Untitled video", ja: "無題の動画" },
    noDescription: { zh: "暂无简介。", en: "No description yet.", ja: "説明はまだありません。" },
    unsupported: { zh: "该视频暂不支持站内播放", en: "This video cannot be played inline right now.", ja: "この動画は現在サイト内再生に対応していません。" },
    playAria: { zh: "播放视频", en: "Play video", ja: "動画を再生" }
  };
  return copy[key]?.[currentLang] || copy[key]?.zh || key;
}

function safeResourceUrl(item) {
  const value = String(item.url || item.href || item.downloadUrl || "").trim();
  if (!value) {
    return "";
  }
  const httpUrl = safeHttpUrl(value);
  if (httpUrl) {
    return httpUrl;
  }
  const localPath = value.replace(/^\/+/, "").replace(/^\.\//, "");
  if (/(^|\/)\.\.(\/|$)/.test(localPath)) {
    return "";
  }
  if (/^(assets|downloads)\/[a-z0-9][a-z0-9._/-]*(\?[a-z0-9=&._-]+)?$/i.test(localPath)) {
    return sitePath(localPath);
  }
  return "";
}

function resourceActionElement(item, url = safeResourceUrl(item)) {
  const text = url
    ? item.external ? t("externalButton") : t("downloadButton")
    : t("resourcePending");
  if (!url) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "card-action is-disabled";
    button.disabled = true;
    button.setAttribute("aria-disabled", "true");
    button.setAttribute("aria-label", t("resourcePendingTitle"));
    button.setAttribute("title", t("resourcePendingTitle"));
    button.textContent = text;
    return button;
  }
  const link = document.createElement("a");
  link.className = "card-action";
  link.href = url;
  link.textContent = text;
  if (item.external || /^https?:\/\//i.test(url)) {
    link.target = "_blank";
    link.rel = "noreferrer noopener";
  }
  return link;
}

function resourceStatusElement(url) {
  const status = document.createElement("span");
  status.className = `tag resource-status-tag ${url ? "is-ready" : "is-pending"}`;
  status.textContent = url ? t("resourceStatusReady") : t("resourcePending");
  return status;
}

function resourceEmptyStateElement() {
  const state = document.createElement("div");
  state.className = "resource-empty-state";

  const icon = document.createElement("span");
  icon.className = "resource-empty-icon";
  icon.textContent = "🗂️";

  const copy = document.createElement("div");
  copy.className = "resource-empty-copy";
  const title = document.createElement("h3");
  title.textContent = t("resourceEmptyTitle");
  const body = document.createElement("p");
  body.textContent = t("resourceEmptyBody");
  copy.append(title, body);

  const action = document.createElement("button");
  action.type = "button";
  action.className = "xp-button";
  action.dataset.resourceShowAll = "true";
  action.textContent = t("resourceEmptyAction");

  state.append(icon, copy, action);
  return state;
}

function resourceCardElement(item) {
  const card = document.createElement("article");
  card.className = "resource-card";
  const resourceUrl = safeResourceUrl(item);

  const main = document.createElement("div");
  main.className = "resource-main";

  const title = document.createElement("h3");
  const icon = document.createElement("span");
  icon.className = "resource-icon";
  icon.textContent = item.icon || "";
  title.append(icon, document.createTextNode(contentTitle(item.title)));

  const desc = document.createElement("p");
  desc.textContent = localText(item.desc);

  const meta = document.createElement("div");
  meta.className = "meta-row";
  [
    `${label("type")}：${label("resourceCategories")[item.category] || ""}`,
    `${label("version")}：${item.version || ""}`,
    `${label("size")}：${item.size || ""}`,
    `${label("updated")}：${item.updated || ""}`
  ].forEach((text) => {
    const itemNode = document.createElement("span");
    itemNode.textContent = text;
    meta.appendChild(itemNode);
  });
  meta.appendChild(resourceStatusElement(resourceUrl));

  main.append(title, desc, meta);
  card.append(main, resourceActionElement(item, resourceUrl));
  return card;
}

function renderResourceCategoryButtons() {
  const target = document.getElementById("resource-categories");
  const categories = label("resourceCategories");
  const counts = new Map(categories.map((_, index) => [String(index), 0]));
  content.resources.forEach((item) => {
    const key = String(item.category);
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  const entries = [
    { name: t("all"), value: "all", count: content.resources.length },
    ...categories.map((name, index) => ({
      name,
      value: String(index),
      count: counts.get(String(index)) || 0
    }))
  ];

  const buttons = entries.map((entry) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.filterType = "resources";
    button.dataset.filter = entry.value;
    button.classList.toggle("active", activeFilters.resources === entry.value);
    button.setAttribute("aria-label", `${entry.name} ${entry.count}`);

    const name = document.createElement("span");
    name.textContent = entry.name;
    const count = document.createElement("span");
    count.className = "filter-count";
    count.textContent = String(entry.count);

    button.append(name, count);
    return button;
  });
  target.replaceChildren(...buttons);
}

function renderResources() {
  renderResourceCategoryButtons();
  const list = document.getElementById("resource-list");
  const items = content.resources.filter((item) => activeFilters.resources === "all" || String(item.category) === activeFilters.resources);

  list.replaceChildren();
  if (items.length === 0) {
    list.appendChild(resourceEmptyStateElement());
    return;
  }
  items.forEach((item) => list.appendChild(resourceCardElement(item)));
}

async function loadGameCatalog() {
  const response = await fetch("/games/catalog.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

async function renderGames() {
  const list = document.getElementById("game-list");
  const loading = document.createElement("p");
  loading.className = "loading-text";
  loading.textContent = t("gameConfigLoading");
  list.replaceChildren(loading);
  try {
    const catalog = await loadGameCatalog();
    list.replaceChildren();
    catalog.games.forEach((item) => list.appendChild(gameCardElement(item)));
  } catch (error) {
    const failed = document.createElement("p");
    failed.className = "loading-text";
    failed.textContent = `${t("gameConfigFailed")}：${error.message}`;
    list.replaceChildren(failed);
  }
}

function gameCardElement(item) {
  const card = document.createElement("article");
  card.className = "game-card";

  const titleText = localText(item.titles || item.titleZh);
  const cover = document.createElement("img");
  cover.className = "game-cover";
  cover.src = safeGameCoverSrc(item.cover || "assets/images/icon-games.png");
  cover.alt = titleText;
  cover.loading = "lazy";
  cover.decoding = "async";

  const main = document.createElement("div");
  main.className = "game-main";
  const title = document.createElement("h3");
  title.textContent = titleText;
  const summary = document.createElement("p");
  summary.textContent = localText(item.summaries || item.summary);
  const meta = document.createElement("div");
  meta.className = "meta-row";
  const languageLabel = document.createElement("span");
  languageLabel.className = "language-support-label";
  languageLabel.textContent = `${t("languageSupportLabel")}:`;
  meta.append(languageLabel, ...languageSupportTagElements(item));
  if (item.license?.name) {
    const license = document.createElement("span");
    license.className = "tag";
    license.textContent = item.license.name;
    meta.appendChild(license);
  }
  if (item.storage?.keys?.length || item.storage?.scoreOnly) {
    const save = document.createElement("span");
    save.className = "tag game-save-tag";
    save.textContent = t("gameCloudSaveReady");
    meta.appendChild(save);
  }
  const repoUrl = safeHttpUrl(item.repo);
  if (repoUrl) {
    const source = document.createElement("a");
    source.className = "tag game-source-link";
    source.href = repoUrl;
    source.target = "_blank";
    source.rel = "noreferrer noopener";
    source.textContent = t("gameSourceLabel");
    meta.appendChild(source);
  }
  main.append(title, summary, meta);

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

  card.append(cover, main, action);
  return card;
}

function blogCardElement(item) {
  const card = document.createElement("article");
  card.className = "blog-card";

  const title = document.createElement("h3");
  title.textContent = contentTitle(item.title);

  const desc = document.createElement("p");
  desc.textContent = localText(item.desc);

  const meta = document.createElement("div");
  meta.className = "meta-row";
  const date = document.createElement("span");
  date.textContent = `${label("date")}：${item.date || ""}`;
  meta.appendChild(date);
  (item.tags || []).forEach((tag) => {
    const tagNode = document.createElement("span");
    tagNode.className = "tag";
    tagNode.textContent = articleTagName(tag);
    meta.appendChild(tagNode);
  });

  const action = document.createElement("button");
  action.type = "button";
  action.className = "card-action is-disabled";
  action.disabled = true;
  action.textContent = t("blogPending");

  card.append(title, desc, meta, action);
  return card;
}

function renderBlog() {
  const list = document.getElementById("blog-list");
  list.replaceChildren();
  content.blog.forEach((item) => list.appendChild(blogCardElement(item)));
}

function renderUpdates() {
  const list = document.getElementById("recent-updates");
  const updateArticles = siteUpdateArticles().length
    ? siteUpdateArticles().slice(0, 5)
    : visibleLocalUpdates().slice(0, 5);
  if (!updateArticles.length) {
    const emptyItem = document.createElement("li");
    const icon = document.createElement("span");
    icon.className = "update-icon";
    icon.textContent = "📚";
    const copy = document.createElement("span");
    const title = document.createElement("strong");
    title.textContent = t("articleLoading");
    const detail = document.createElement("small");
    detail.textContent = t("articleEmpty");
    copy.append(title, detail);
    emptyItem.append(icon, copy);
    list.replaceChildren(emptyItem);
    return;
  }
  list.replaceChildren(...updateArticles.map((item) => recentUpdateElement(item)));
}

function recentUpdateElement(item) {
  const row = document.createElement("li");
  const link = document.createElement("a");
  link.className = "recent-update-link";
  if (item.slug) {
    link.href = articleRouteHref(item.slug);
    link.dataset.articleSlug = item.slug;
  } else {
    link.href = "/#knowledge";
  }

  const icon = document.createElement("span");
  icon.className = "update-icon";
  icon.textContent = recentUpdateIcon(item);

  const copy = document.createElement("span");
  const title = document.createElement("strong");
  const fullTitle = localText(item.title);
  const fullSummary = item.summary || localText(item.desc) || "";
  const publishedDate = formatArticleDate(item.published_at || item.created_at || item.date);
  title.textContent = truncateText(fullTitle, 28);
  const detail = document.createElement("small");
  detail.append(document.createTextNode(truncateText(fullSummary, 52)));
  detail.appendChild(document.createElement("br"));
  detail.append(document.createTextNode(publishedDate));

  const accessibleLabel = [fullTitle, fullSummary, publishedDate].filter(Boolean).join(" - ");
  if (accessibleLabel) {
    link.title = accessibleLabel;
    link.setAttribute("aria-label", accessibleLabel);
  }

  copy.append(title, detail);
  link.append(icon, copy);
  row.appendChild(link);
  return row;
}

function recentUpdateIcon(item) {
  if (item?.category === siteUpdateCategory) {
    return "🛠️";
  }
  return localText(item?.icon) || "📚";
}

function latestUpdateDate() {
  const dates = siteUpdateArticles().length ? siteUpdateArticles() : visibleLocalUpdates();
  return dates.reduce((latest, item) => {
    const date = formatLocalDateKey(item.published_at || item.created_at || item.date);
    return date > latest ? date : latest;
  }, "");
}

function siteUpdateArticles() {
  return visiblePublicArticles(articleState.articles)
    .filter((item) => item.category === siteUpdateCategory)
    .sort((a, b) => String(b.published_at || b.created_at || "").localeCompare(String(a.published_at || a.created_at || "")));
}

function truncateText(value, maxLength) {
  const chars = Array.from(String(value || ""));
  return chars.length > maxLength ? `${chars.slice(0, maxLength - 3).join("")}...` : chars.join("");
}

function renderAll() {
  document.getElementById("top-updated").textContent = latestUpdateDate();
  renderKnowledge();
  renderVideos();
  renderResources();
  renderGames();
  renderBlog();
  renderUpdates();
}

function openVideo(index) {
  const video = typeof index === "number"
    ? content.videos[index]
    : videoState.videos.find((item) => item.video_id === index);
  const modal = document.getElementById("video-modal");
  const frame = document.getElementById("video-frame");
  const sourceLink = document.getElementById("video-link");
  frame.replaceChildren();
  if (!video) {
    window.lusuTrackClick?.("video:play-failed", "video not found", { route: "videos" });
    return;
  }
  const videoTitle = localText(video.title) || "Video Player";
  document.getElementById("modal-title").textContent = videoTitle;
  if (sourceLink) {
    const originalUrl = safeVideoSourceUrl(video.original_url || video.url || "");
    if (originalUrl) {
      sourceLink.href = originalUrl;
      sourceLink.target = "_blank";
      sourceLink.rel = "noreferrer noopener";
      sourceLink.hidden = false;
    } else {
      sourceLink.hidden = true;
      sourceLink.removeAttribute("href");
    }
  }
  const embedUrl = videoAutoplayUrl(video.embed_url);
  if (embedUrl) {
    const shell = document.createElement("div");
    shell.className = "video-embed-shell";
    const iframe = document.createElement("iframe");
    iframe.src = embedUrl;
    iframe.title = videoTitle;
    iframe.loading = "lazy";
    iframe.allow = "autoplay; fullscreen; accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    iframe.addEventListener("error", () => {
      window.lusuTrackClick?.("video:play-failed", video.video_id || video.external_id || "video", { route: "videos" });
    }, { once: true });
    shell.append(iframe, videoClickShield());
    frame.appendChild(shell);
    window.lusuTrackClick?.("video:player-open", video.video_id || video.external_id || "video", { route: "videos" });
  } else {
    const placeholder = document.createElement("div");
    placeholder.className = "video-placeholder";
    const icon = document.createElement("span");
    icon.textContent = "!";
    const text = document.createElement("p");
    text.textContent = video.metadata_error || videoUiText("unsupported");
    placeholder.append(icon, text);
    frame.appendChild(placeholder);
    window.lusuTrackClick?.("video:play-failed", video.video_id || video.external_id || "video", { route: "videos" });
  }
  modal.hidden = false;
  setVideoWindowMaximized(false);
}

function updateVideoWindowButton() {
  const button = document.getElementById("video-window-maximize");
  if (!button) {
    return;
  }
  const labelText = videoWindowState.maximized ? t("videoRestore") : t("videoFullscreen");
  button.setAttribute("aria-label", labelText);
  button.setAttribute("title", labelText);
  button.setAttribute("aria-pressed", String(videoWindowState.maximized));
}

function setVideoWindowMaximized(maximized) {
  const modal = document.getElementById("video-modal");
  videoWindowState.maximized = Boolean(maximized);
  modal?.classList.toggle("is-video-maximized", videoWindowState.maximized);
  updateVideoWindowButton();
}

function fullscreenVideo() {
  setVideoWindowMaximized(!videoWindowState.maximized);
}

function closeVideo() {
  setVideoWindowMaximized(false);
  document.getElementById("video-modal").hidden = true;
  const frame = document.getElementById("video-frame");
  const sourceLink = document.getElementById("video-link");
  frame.replaceChildren();
  if (sourceLink) {
    sourceLink.hidden = true;
    sourceLink.removeAttribute("href");
  }
  const placeholder = document.createElement("div");
  placeholder.className = "video-placeholder";
  const icon = document.createElement("span");
  icon.textContent = "▶";
  const text = document.createElement("p");
  text.textContent = t("videoPlaceholder");
  placeholder.append(icon, text);
  frame.appendChild(placeholder);
}

function closeWelcome() {
  document.getElementById("welcome-modal").hidden = true;
}

const wallpaperMotionMedia = typeof window.matchMedia === "function"
  ? window.matchMedia("(prefers-reduced-motion: reduce)")
  : null;
const wallpaperPreviewTheme = ["morning", "day", "dusk", "night"].includes(pageParams.get("wallpaper"))
  ? pageParams.get("wallpaper")
  : "";

function currentTimeTheme(date = new Date()) {
  const minutes = date.getHours() * 60 + date.getMinutes();
  if (minutes >= 5 * 60 && minutes < 11 * 60) {
    return "morning";
  }
  if (minutes >= 11 * 60 && minutes < 17 * 60) {
    return "day";
  }
  if (minutes >= 17 * 60 && minutes < 20 * 60) {
    return "dusk";
  }
  return "night";
}

function layoutWallpaperStage() {
  const root = document.getElementById("wallpaper-root");
  const stage = document.getElementById("wallpaper-stage");
  if (!root || !stage) {
    return;
  }
  const rootWidth = root.clientWidth || window.innerWidth;
  const rootHeight = root.clientHeight || window.innerHeight;
  const wallpaperRatio = 1672 / 941;
  const rootRatio = rootWidth / Math.max(rootHeight, 1);
  const stageWidth = rootRatio > wallpaperRatio ? rootWidth : rootHeight * wallpaperRatio;
  const stageHeight = rootRatio > wallpaperRatio ? rootWidth / wallpaperRatio : rootHeight;
  root.style.setProperty("--wallpaper-stage-width", `${Math.ceil(stageWidth)}px`);
  root.style.setProperty("--wallpaper-stage-height", `${Math.ceil(stageHeight)}px`);
}

function updateWallpaperMotionState() {
  const root = document.getElementById("wallpaper-root");
  if (!root) {
    return;
  }
  root.dataset.motion = wallpaperMotionMedia?.matches ? "reduced" : "full";
  root.dataset.paused = document.hidden ? "true" : "false";
  root.dataset.previewMotion = wallpaperPreviewTheme ? "true" : "false";
}

function updateHomeTimeTheme() {
  const home = document.getElementById("home");
  const root = document.getElementById("wallpaper-root");
  if (!home) {
    return;
  }
  const theme = wallpaperPreviewTheme || currentTimeTheme();
  home.dataset.timeTheme = theme;
  document.body.dataset.timeTheme = theme;
  if (root) {
    root.dataset.time = theme;
  }
  layoutWallpaperStage();
  updateWallpaperMotionState();
}

function updateWelcomeGreeting() {
  const heading = document.querySelector("[data-i18n='welcomeHeading']");
  if (!heading) {
    return;
  }
  const now = new Date();
  const theme = currentTimeTheme(now);
  const greetingKey = theme === "morning"
    ? "greetingMorning"
    : theme === "day"
      ? "greetingNoon"
      : theme === "dusk"
        ? "greetingAfternoon"
        : "greetingEvening";
  const dateLine = t("welcomeDateLine")
    .replace("{year}", String(now.getFullYear()))
    .replace("{month}", String(now.getMonth() + 1))
    .replace("{day}", String(now.getDate()));
  heading.textContent = `${t(greetingKey)}，${dateLine}`;
}

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function maybeShowWelcome() {
  const welcomeMode = pageParams.get("welcome");
  const forceWelcome = welcomeMode === "1";
  if (welcomeMode === "0") {
    return;
  }
  const route = parseRouteLocation();
  if (!forceWelcome && (route.route !== "home" || route.articleSlug)) {
    return;
  }
  const today = localDateKey(new Date());
  const key = `lusu-welcome-seen-${today}`;
  if (!forceWelcome && localStorage.getItem(key) === "1") {
    return;
  }
  updateWelcomeGreeting();
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
  updateHomeTimeTheme();
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
  widget.replaceChildren();

  const toggle = document.createElement("button");
  toggle.className = authUser ? "account-button signed-in" : "account-button";
  toggle.type = "button";
  toggle.dataset.accountToggle = "";
  const toggleText = document.createElement("span");
  toggleText.textContent = authUser
    ? `${t("accountSignedInPrefix")}${authUser.email}`
    : t("accountLogin");
  toggle.appendChild(toggleText);

  const popover = document.createElement("div");
  popover.className = "account-popover";
  popover.id = "account-popover";
  popover.hidden = true;

  if (authUser) {
    const signedInPanel = document.createElement("div");
    signedInPanel.className = "account-signed-in";
    const title = document.createElement("strong");
    title.textContent = t("accountTitle");
    const email = document.createElement("p");
    email.className = "account-note";
    email.textContent = authUser.email || "";
    const note = document.createElement("p");
    note.className = "account-note";
    note.textContent = t("accountSignedInNote");
    signedInPanel.append(title, email, note);
    if (message) {
      const messageNode = document.createElement("p");
      messageNode.className = "account-note";
      messageNode.textContent = message;
      signedInPanel.appendChild(messageNode);
    }
    const actions = document.createElement("div");
    actions.className = "account-actions";
    const logoutButton = document.createElement("button");
    logoutButton.className = "account-button";
    logoutButton.type = "button";
    logoutButton.dataset.accountLogout = "";
    logoutButton.textContent = t("accountLogout");
    actions.appendChild(logoutButton);
    signedInPanel.appendChild(actions);
    popover.appendChild(signedInPanel);
    widget.append(toggle, popover);
    return;
  }

  const form = document.createElement("form");
  form.className = "account-form";
  form.id = "account-form";
  const title = document.createElement("strong");
  title.textContent = t("accountTitle");
  const emailInput = document.createElement("input");
  emailInput.name = "email";
  emailInput.type = "email";
  emailInput.autocomplete = "email";
  emailInput.placeholder = t("accountEmailPlaceholder");
  emailInput.required = true;
  const passwordInput = document.createElement("input");
  passwordInput.name = "password";
  passwordInput.type = "password";
  passwordInput.autocomplete = "current-password";
  passwordInput.placeholder = t("accountPasswordPlaceholder");
  passwordInput.required = true;
  const actions = document.createElement("div");
  actions.className = "account-actions";
  const loginButton = document.createElement("button");
  loginButton.className = "account-button";
  loginButton.type = "submit";
  loginButton.dataset.mode = "login";
  loginButton.textContent = t("accountLogin");
  const registerButton = document.createElement("button");
  registerButton.className = "account-button";
  registerButton.type = "submit";
  registerButton.dataset.mode = "register";
  registerButton.textContent = t("accountRegister");
  actions.append(loginButton, registerButton);
  const note = document.createElement("p");
  note.className = "account-note";
  note.textContent = message || t("accountGuestNote");
  form.append(title, emailInput, passwordInput, actions, note);
  form.addEventListener("submit", submitAccountForm);
  popover.appendChild(form);
  widget.append(toggle, popover);
}

async function initAccountWidget() {
  renderAccountWidget();
  try {
    const payload = await accountApi("/api/auth/me");
    authUser = payload.user || null;
    renderAccountWidget();
  } catch {
    renderAccountWidget(t("accountUnavailable"));
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
    renderAccountWidget(t("accountLoggedIn"));
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
  renderAccountWidget(t("accountLoggedOut"));
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

async function ensureChatIdentity() {
  let visitorId = localStorage.getItem(chatStorageKeys.visitorId);
  if (!visitorId) {
    visitorId = crypto.randomUUID ? crypto.randomUUID() : `visitor-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(chatStorageKeys.visitorId, visitorId);
  }

  let nickname = localStorage.getItem(chatStorageKeys.nickname);
  if (!isValidChatNickname(nickname)) {
    nickname = await fetchAvailableChatNickname();
    localStorage.setItem(chatStorageKeys.nickname, nickname);
  }

  chatState.visitorId = visitorId;
  chatState.nickname = nickname.trim();
  updateChatNicknameDisplay();
}

async function fetchAvailableChatNickname() {
  try {
    const payload = await chatApi(`/api/chat/nickname?lang=${encodeURIComponent(currentLang)}`);
    if (isValidChatNickname(payload.nickname)) {
      return payload.nickname.trim();
    }
  } catch {
    // Local fallback keeps the chat usable if the nickname endpoint is unavailable.
  }
  return randomChatNickname();
}

function randomChatNickname() {
  const pools = {
    zh: ["蓝屏像素", "像素幽灵", "草地路人A", "CRT访客", "电视小粉", "泡泡旅人"],
    en: ["BluePixel", "PixelGhost", "CRTGuest", "GrassWalk", "BubbleTrip", "TVHead"],
    ja: ["青いピクセル", "ピクセル幽霊", "CRT旅人", "草原の人", "テレビ旅人", "泡の旅人"]
  };
  const names = pools[currentLang] || pools.zh;
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
  await ensureChatIdentity();
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
  scheduleChatPolling(5000);
}

function scheduleChatPolling(delay) {
  if (chatState.pollTimer) {
    window.clearTimeout(chatState.pollTimer);
  }
  chatState.pollTimer = window.setTimeout(async () => {
    chatState.pollTimer = null;
    const chatVisible = !document.hidden && document.getElementById("chatroom")?.classList.contains("active");
    if (!chatVisible) {
      scheduleChatPolling(30000);
      return;
    }
    const newCount = await refreshChatMessages();
    scheduleChatPolling(nextChatPollDelay(newCount));
  }, delay);
}

function nextChatPollDelay(newCount) {
  if (newCount > 0) {
    chatState.idlePolls = 0;
    return 5000;
  }
  chatState.idlePolls += 1;
  if (chatState.idlePolls >= 3) {
    return 30000;
  }
  return 15000;
}

function resetChatLog(message) {
  const list = document.getElementById("chat-message-list");
  if (!list) {
    return;
  }
  list.replaceChildren();
  appendChatSystemMessage(message || t("chatWelcome"));
  chatState.lastMessageId = "";
  chatState.hasLoadedInitial = false;
  chatState.idlePolls = 0;
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
    return 0;
  }
  chatState.loading = true;
  let appendedCount = 0;
  try {
    const params = new URLSearchParams({ limit: "100" });
    if (!options.initial && chatState.lastMessageId) {
      params.set("after", chatState.lastMessageId);
    } else if (!options.initial && chatState.hasLoadedInitial) {
      params.set("after", "__no_messages_loaded__");
    }
    const payload = await chatApi(`/api/chat/messages?${params.toString()}`);
    if (options.initial) {
      resetChatLog(t("chatWelcome"));
    }
    appendedCount = appendChatMessages(payload.messages || []);
    chatState.hasLoadedInitial = true;
  } catch {
    if (options.initial) {
      resetChatLog(t("chatLoadFailed"));
    } else {
      setChatFeedback(t("chatLoadFailed"), true);
    }
  } finally {
    chatState.loading = false;
  }
  return appendedCount;
}

function appendChatMessages(messages) {
  const list = document.getElementById("chat-message-list");
  if (!list || !messages.length) {
    return 0;
  }

  let appendedCount = 0;
  messages.forEach((message) => {
    if (!message.message_id || chatState.seenMessageIds.has(message.message_id)) {
      return;
    }
    chatState.seenMessageIds.add(message.message_id);
    chatState.lastMessageId = message.message_id;
    list.appendChild(createChatMessageNode(message));
    appendedCount += 1;
  });

  const autoscroll = document.getElementById("chat-autoscroll");
  if (!autoscroll || autoscroll.checked) {
    list.scrollTop = list.scrollHeight;
  }
  return appendedCount;
}

function createChatMessageNode(message) {
  const own = message.visitor_id === chatState.visitorId;
  const item = document.createElement("article");
  item.className = `chat-message${own ? " is-own" : ""}`;

  const avatar = document.createElement("img");
  avatar.className = "chat-message-avatar";
  avatar.src = "/assets/images/icon-chatroom-clean.png";
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
  const date = new Date(normalizeDateInput(value));
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const now = new Date();
  const sameDay = date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();
  return formatZonedDateTime(value, { includeDate: !sameDay, includeTimeZone: false });
}

async function submitChatMessage(event) {
  event.preventDefault();
  await ensureChatIdentity();

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
    chatState.idlePolls = 0;
    await refreshChatMessages({ immediate: true });
    scheduleChatPolling(5000);
  } catch (error) {
    if (error.code === "nickname_taken") {
      setChatFeedback(t("chatNicknameTaken"), true);
      const nickname = await fetchAvailableChatNickname();
      chatState.nickname = nickname;
      localStorage.setItem(chatStorageKeys.nickname, nickname);
      updateChatNicknameDisplay();
      return;
    }
    setChatFeedback(error.message || t("chatLoadFailed"), true);
  }
}

async function editChatNickname() {
  await ensureChatIdentity();
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
    const error = new Error(payload.error || `HTTP ${response.status}`);
    error.code = payload.code || "";
    throw error;
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
    setLanguage(langButton.dataset.lang, { persist: true, syncUrl: true });
    return;
  }

  if (event.target.closest("[data-resource-show-all]")) {
    activeFilters.resources = "all";
    renderResources();
    return;
  }

  const filterButton = event.target.closest("[data-filter-type]");
  if (filterButton) {
    activeFilters[filterButton.dataset.filterType] = filterButton.dataset.filter;
    renderAll();
    return;
  }

  const articleHeadingButton = event.target.closest("[data-article-heading-target]");
  if (articleHeadingButton) {
    scrollToArticleHeading(articleHeadingButton.dataset.articleHeadingTarget);
    return;
  }

  if (event.target.closest("[data-article-scroll-top]")) {
    scrollArticleToTop();
    return;
  }

  if (event.target.closest("[data-article-window-toggle]")) {
    toggleArticleWindowSize();
    return;
  }

  const articleButton = event.target.closest("[data-article-slug]");
  if (articleButton) {
    event.preventDefault();
    showArticle(articleButton.dataset.articleSlug);
    return;
  }

  const articleCategoryButton = event.target.closest("[data-article-category]");
  if (articleCategoryButton) {
    showArticleCategory(articleCategoryButton.dataset.articleCategory);
    return;
  }

  if (event.target.closest("[data-article-back]")) {
    showArticleList();
    return;
  }

  if (event.target.closest("[data-article-copy-link]")) {
    copyArticleLink();
    return;
  }

  if (event.target.closest("[data-article-search-clear]")) {
    articleState.searchTerm = "";
    renderKnowledge();
    document.getElementById("knowledge-search-input")?.focus();
    return;
  }

  const videoButton = event.target.closest("[data-video-index]");
  if (videoButton) {
    openVideo(Number(videoButton.dataset.videoIndex));
    return;
  }

  const managedVideoButton = event.target.closest("[data-video-id]");
  if (managedVideoButton) {
    openVideo(managedVideoButton.dataset.videoId);
    return;
  }

  if (event.target.closest("[data-video-window-toggle], [data-video-fullscreen]")) {
    fullscreenVideo();
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
    const videoModal = document.getElementById("video-modal");
    if (videoWindowState.maximized && videoModal && !videoModal.hidden) {
      setVideoWindowMaximized(false);
      return;
    }
    closeVideo();
    closeWelcome();
    closeAccountPopover();
  }
});

window.addEventListener("hashchange", () => {
  syncRouteFromLocation();
});

window.addEventListener("popstate", () => {
  syncRouteFromLocation();
});

document.getElementById("chat-form")?.addEventListener("submit", submitChatMessage);
document.getElementById("chat-message-input")?.addEventListener("input", updateChatCounter);
document.getElementById("chat-edit-nickname")?.addEventListener("click", editChatNickname);
document.getElementById("knowledge-search-input")?.addEventListener("input", (event) => {
  articleState.searchTerm = event.target.value;
  renderKnowledge();
});
document.getElementById("article-detail")?.addEventListener("scroll", scheduleArticleReadProgressUpdate, { passive: true });
window.addEventListener("resize", layoutWallpaperStage);
window.addEventListener("resize", scheduleArticleReadProgressUpdate);

document.addEventListener("visibilitychange", () => {
  updateWallpaperMotionState();
  if (!document.hidden && document.getElementById("chatroom")?.classList.contains("active")) {
    chatState.idlePolls = 0;
    refreshChatMessages().then((newCount) => {
      scheduleChatPolling(nextChatPollDelay(newCount || 0));
    });
  } else if (chatState.pollTimer) {
    scheduleChatPolling(30000);
  }
});

if (wallpaperMotionMedia) {
  const syncWallpaperMotionPreference = () => updateWallpaperMotionState();
  if (typeof wallpaperMotionMedia.addEventListener === "function") {
    wallpaperMotionMedia.addEventListener("change", syncWallpaperMotionPreference);
  } else if (typeof wallpaperMotionMedia.addListener === "function") {
    wallpaperMotionMedia.addListener(syncWallpaperMotionPreference);
  }
}

function browserPreferredLanguage() {
  const candidates = [navigator.language, ...(navigator.languages || [])].filter(Boolean);
  const matched = candidates.map((lang) => lang.toLowerCase()).find((lang) => (
    lang.startsWith("zh") || lang.startsWith("en") || lang.startsWith("ja")
  ));
  if (!matched) {
    return "zh";
  }
  if (matched.startsWith("en")) {
    return "en";
  }
  if (matched.startsWith("ja")) {
    return "ja";
  }
  return "zh";
}

function initialLanguage() {
  const requestedLang = pageParams.get("lang");
  if (["zh", "en", "ja"].includes(requestedLang)) {
    return requestedLang;
  }
  const storedLang = localStorage.getItem(languageStorageKey);
  if (["zh", "en", "ja"].includes(storedLang)) {
    return storedLang;
  }
  return browserPreferredLanguage();
}

const initialLang = initialLanguage();

setLanguage(initialLang);
loadSocialLinks();
initAccountWidget();
updateClock();
setInterval(updateClock, 1000);
syncRouteFromLocation();
const hoverRoute = pageParams.get("hover");
if (hoverRoute) {
  document.querySelector(`.desktop-icon[data-route="${hoverRoute}"]`)?.classList.add("is-hovered");
}
window.addEventListener("load", maybeShowWelcome);
