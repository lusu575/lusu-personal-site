const pageParams = new URLSearchParams(window.location.search);
const defaultShareImageUrl = "https://lusu575.com/assets/images/homepage-pixel-coast.png?v=20260612-hd-wallpapers";

const translations = {
  zh: {
    siteName: "鲁肃个人站",
    siteDescription: "鲁肃的个人站，一个 Windows XP、Pixel Art 和 Y2K 风格的个人空间，用来记录 AI、游戏、工具、资源、视频、知识库和杂谈。",
    heroTitle: "鲁肃的个人站",
    navKnowledge: "知识库",
    navVideos: "视频区",
    navVideosBuilding: "视频区",
    navResources: "资源区",
    navResourcesBuilding: "资源区",
    navGames: "游戏区",
    navBlog: "杂谈区",
    navBlogBuilding: "杂谈区",
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
    articleRetryAction: "重新读取文章",
    articleEmpty: "数据库里暂时还没有已发布文章。",
    articleSearchLabel: "搜索知识库",
    articleSearchPlaceholder: "搜索标题、简介、标签...",
    articleSearchClear: "清空",
    articleSearchReset: "显示全部文章",
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
    profileAvatarAlt: "鲁肃头像",
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
    resourcePending: "待补链接",
    resourcePendingTitle: "这个资源还在整理中，暂时没有下载或外链。",
    resourceStatusReady: "可获取",
    resourceEmptyTitle: "这个分类还在整理中",
    resourceEmptyBody: "可以先切回全部资源，之后这里会补上下载、素材或文档。",
    resourceEmptyAction: "显示全部资源",
    resourceEmptyAllTitle: "资源区正在整理中",
    resourceEmptyAllBody: "这里之后会放真实可下载的工具、素材和文档。可以先去知识库看看已经发布的内容。",
    resourceEmptyAllAction: "查看知识库",
    blogEmptyTitle: "杂谈区正在整理中",
    blogEmptyBody: "这里会保留正式随笔和站点记录。内容发布前，可以先查看知识库和最近更新。",
    blogEmptyAction: "查看知识库",
    openOriginal: "打开原地址",
    videoFullscreen: "全屏",
    videoRestore: "还原",
    languageSupportLabel: "语言支持",
    gameLanguageUnsupported: "不支持",
    gameSourceLabel: "来源",
    gameCloudSaveReady: "云存档",
    gameConfigLoading: "正在读取游戏配置...",
    gameConfigFailed: "游戏配置读取失败",
    gameRetryAction: "重新读取游戏列表",
    gameEmptyTitle: "游戏目录正在整理中",
    gameEmptyBody: "可以稍后重新读取，或先看看知识库和网站更新记录。",
    videoPlaceholder: "这里预留 Bilibili / YouTube 嵌入播放器。",
    startButton: "首页",
    lastUpdatedLabel: "最近更新日期",
    brandHomeAria: "返回桌面",
    mobileDockToggleAria: "收起或展开底部导航",
    languageSwitcherAria: "语言切换",
    desktopIconsAria: "主要栏目",
    taskbarNavAria: "底部主导航",
    windowMinimizeAria: "最小化窗口",
    windowMaximizeAria: "最大化窗口",
    windowRestoreAria: "还原窗口",
    closeWindowAria: "关闭窗口",
    closeDialogAria: "关闭对话框",
    accountSignedInPrefix: "账号：",
    accountTitle: "云存档账号",
    accountSignedInNote: "网站可以正常浏览；进入游戏后会自动同步云端存档。",
    accountLogout: "退出账号",
    accountLogin: "登录",
    accountRegister: "注册",
    accountEmailPlaceholder: "邮箱",
    accountEmailLabel: "邮箱",
    accountPasswordPlaceholder: "密码至少 8 位",
    accountPasswordLabel: "密码",
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
    socialLinksAria: "社交链接",
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
    chatNicknameLabel: "我的昵称：",
    chatEditNickname: "修改昵称",
    chatRoomPublicLabel: "普通房间",
    chatRoomPrivateLabel: "密码房",
    chatEnterPrivateRoom: "密码房",
    chatSwitchPublicRoom: "普通房间",
    chatPrivatePasswordLabel: "密码房密码",
    chatPrivatePasswordPlaceholder: "至少 6 个字符",
    chatPrivateRoomEnter: "进入",
    chatPrivateRoomCancel: "取消",
    chatPrivateRoomHint: "同一密码进入同一暗色房间；请使用不容易猜到的密码。",
    chatPrivatePasswordTooShort: "密码至少需要 6 个字符。",
    chatPrivateCryptoUnavailable: "当前浏览器不支持前端加密，无法进入密码房。",
    chatPrivateRoomReady: "已进入暗色密码房，消息会在浏览器端加密。",
    chatPublicRoomReady: "已切回普通匿名大厅。",
    chatDecryptFailed: "这条消息无法用当前密码解开。",
    chatEncryptFailed: "消息加密失败，请稍后再试。",
    chatSyncStatus: "自动增量刷新，空闲时会降低频率",
    chatSyncStatusActive: "约 5 秒刷新",
    chatSyncStatusIdle: "约 15 秒刷新",
    chatSyncStatusSlow: "约 30 秒低频刷新",
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
    chatSending: "正在发送...",
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
    navKnowledge: "Knowledge",
    navVideos: "Videos",
    navVideosBuilding: "Videos",
    navResources: "Resources",
    navResourcesBuilding: "Resources",
    navGames: "Games",
    navBlog: "Talk",
    navBlogBuilding: "Talk",
    navChatroom: "Chat Room",
    navAbout: "About",
    capKnowledge: "Notes · Tutorials · Ideas",
    capVideos: "Works · Translation · Favorites",
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
    articleRetryAction: "Retry loading articles",
    articleEmpty: "No published articles are in the database yet.",
    articleSearchLabel: "Search knowledge",
    articleSearchPlaceholder: "Search titles, summaries, tags...",
    articleSearchClear: "Clear",
    articleSearchReset: "Show all articles",
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
    profileAvatarAlt: "LuSu avatar",
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
    resourcePending: "Link pending",
    resourcePendingTitle: "This resource is still being organized and has no download or external link yet.",
    resourceStatusReady: "Ready",
    resourceEmptyTitle: "This category is still being organized",
    resourceEmptyBody: "Switch back to all resources for now. Downloads, assets, or docs can be added here later.",
    resourceEmptyAction: "Show all resources",
    resourceEmptyAllTitle: "Resources are being organized",
    resourceEmptyAllBody: "Real downloadable tools, assets, and docs will appear here. For now, check the Knowledge window for published notes.",
    resourceEmptyAllAction: "Open Knowledge",
    blogEmptyTitle: "Notes are being organized",
    blogEmptyBody: "Published essays and site notes will live here. Until then, the Knowledge window has the current public writing.",
    blogEmptyAction: "Open Knowledge",
    openOriginal: "Open Original",
    videoFullscreen: "Full screen",
    videoRestore: "Restore",
    languageSupportLabel: "Language support",
    gameLanguageUnsupported: "not supported",
    gameSourceLabel: "Source",
    gameCloudSaveReady: "Cloud save",
    gameConfigLoading: "Loading game catalog...",
    gameConfigFailed: "Could not load game catalog",
    gameRetryAction: "Retry loading games",
    gameEmptyTitle: "The game catalog is being organized",
    gameEmptyBody: "Retry later, or visit the knowledge base and site updates for now.",
    videoPlaceholder: "Bilibili / YouTube embed player is reserved here.",
    startButton: "Home",
    lastUpdatedLabel: "Last updated",
    brandHomeAria: "Back to desktop",
    mobileDockToggleAria: "Collapse or expand bottom navigation",
    languageSwitcherAria: "Language switcher",
    desktopIconsAria: "Main sections",
    taskbarNavAria: "Taskbar navigation",
    windowMinimizeAria: "Minimize window",
    windowMaximizeAria: "Maximize window",
    windowRestoreAria: "Restore window",
    closeWindowAria: "Close window",
    closeDialogAria: "Close dialog",
    accountSignedInPrefix: "Account: ",
    accountTitle: "Cloud Save Account",
    accountSignedInNote: "You can browse the site normally; games will sync cloud saves automatically after opening.",
    accountLogout: "Sign out",
    accountLogin: "Log in",
    accountRegister: "Register",
    accountEmailPlaceholder: "Email",
    accountEmailLabel: "Email address",
    accountPasswordPlaceholder: "At least 8 characters",
    accountPasswordLabel: "Password",
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
    socialLinksAria: "Social links",
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
    chatNicknameLabel: "My nickname:",
    chatEditNickname: "Edit nickname",
    chatRoomPublicLabel: "Public room",
    chatRoomPrivateLabel: "Password room",
    chatEnterPrivateRoom: "Password room",
    chatSwitchPublicRoom: "Public room",
    chatPrivatePasswordLabel: "Room password",
    chatPrivatePasswordPlaceholder: "At least 6 characters",
    chatPrivateRoomEnter: "Enter",
    chatPrivateRoomCancel: "Cancel",
    chatPrivateRoomHint: "The same password opens the same dark room. Use a password that is hard to guess.",
    chatPrivatePasswordTooShort: "Password must be at least 6 characters.",
    chatPrivateCryptoUnavailable: "This browser does not support client-side encryption, so password rooms are unavailable.",
    chatPrivateRoomReady: "Entered the dark password room. Messages are encrypted in your browser.",
    chatPublicRoomReady: "Switched back to the public anonymous room.",
    chatDecryptFailed: "This message could not be decrypted with the current password.",
    chatEncryptFailed: "Message encryption failed. Please try again.",
    chatSyncStatus: "Incremental auto refresh, slower while idle",
    chatSyncStatusActive: "Refreshes about every 5 seconds",
    chatSyncStatusIdle: "Refreshes about every 15 seconds",
    chatSyncStatusSlow: "Low-frequency refresh, about every 30 seconds",
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
    chatSending: "Sending...",
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
    navKnowledge: "知識庫",
    navVideos: "動画",
    navVideosBuilding: "動画",
    navResources: "リソース",
    navResourcesBuilding: "リソース",
    navGames: "ゲーム",
    navBlog: "雑談",
    navBlogBuilding: "雑談",
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
    articleRetryAction: "記事を再読み込み",
    articleEmpty: "公開済みの記事はまだデータベースにありません。",
    articleSearchLabel: "知識庫を検索",
    articleSearchPlaceholder: "タイトル・概要・タグを検索...",
    articleSearchClear: "クリア",
    articleSearchReset: "すべての記事を表示",
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
    profileAvatarAlt: "魯粛のアバター",
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
    resourcePending: "リンク待ち",
    resourcePendingTitle: "このリソースはまだ整理中で、ダウンロードや外部リンクはありません。",
    resourceStatusReady: "利用可",
    resourceEmptyTitle: "この分類はまだ整理中です",
    resourceEmptyBody: "いったんすべてのリソースに戻れます。ここには後でダウンロード、素材、資料を追加できます。",
    resourceEmptyAction: "すべてのリソースを表示",
    resourceEmptyAllTitle: "リソースを整理中です",
    resourceEmptyAllBody: "実際に入手できるツール、素材、資料をここに置く予定です。今はナレッジ欄の公開済み記事をご覧ください。",
    resourceEmptyAllAction: "ナレッジを見る",
    blogEmptyTitle: "雑談欄を整理中です",
    blogEmptyBody: "正式な随筆やサイト記録をここに置く予定です。公開前はナレッジ欄と最近の更新をご覧ください。",
    blogEmptyAction: "ナレッジを見る",
    openOriginal: "元のページを開く",
    videoFullscreen: "全画面",
    videoRestore: "元に戻す",
    languageSupportLabel: "言語対応",
    gameLanguageUnsupported: "未対応",
    gameSourceLabel: "出典",
    gameCloudSaveReady: "クラウド保存",
    gameConfigLoading: "ゲーム設定を読み込み中...",
    gameConfigFailed: "ゲーム設定を読み込めません",
    gameRetryAction: "ゲーム一覧を再読み込み",
    gameEmptyTitle: "ゲーム一覧を整理中です",
    gameEmptyBody: "あとで再読み込みするか、知識ベースとサイト更新記録をご覧ください。",
    videoPlaceholder: "Bilibili / YouTube の埋め込みプレイヤー用スペースです。",
    startButton: "ホーム",
    lastUpdatedLabel: "最終更新日",
    brandHomeAria: "デスクトップへ戻る",
    mobileDockToggleAria: "下部ナビゲーションを折りたたむ、または展開する",
    languageSwitcherAria: "言語切り替え",
    desktopIconsAria: "主なセクション",
    taskbarNavAria: "下部メインナビゲーション",
    windowMinimizeAria: "ウィンドウを最小化",
    windowMaximizeAria: "ウィンドウを最大化",
    windowRestoreAria: "ウィンドウを元に戻す",
    closeWindowAria: "ウィンドウを閉じる",
    closeDialogAria: "ダイアログを閉じる",
    accountSignedInPrefix: "アカウント：",
    accountTitle: "クラウドセーブアカウント",
    accountSignedInNote: "サイトは通常どおり閲覧できます。ゲームを開くとクラウドセーブを自動同期します。",
    accountLogout: "ログアウト",
    accountLogin: "ログイン",
    accountRegister: "登録",
    accountEmailPlaceholder: "メール",
    accountEmailLabel: "メールアドレス",
    accountPasswordPlaceholder: "8文字以上のパスワード",
    accountPasswordLabel: "パスワード",
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
    socialLinksAria: "SNSリンク",
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
    chatNicknameLabel: "ニックネーム：",
    chatEditNickname: "変更",
    chatRoomPublicLabel: "通常ルーム",
    chatRoomPrivateLabel: "パスワード部屋",
    chatEnterPrivateRoom: "パスワード部屋",
    chatSwitchPublicRoom: "通常ルーム",
    chatPrivatePasswordLabel: "部屋のパスワード",
    chatPrivatePasswordPlaceholder: "6文字以上",
    chatPrivateRoomEnter: "入る",
    chatPrivateRoomCancel: "キャンセル",
    chatPrivateRoomHint: "同じパスワードで同じ暗色部屋に入ります。推測されにくいパスワードを使ってください。",
    chatPrivatePasswordTooShort: "パスワードは6文字以上にしてください。",
    chatPrivateCryptoUnavailable: "このブラウザはフロントエンド暗号化に対応していないため、パスワード部屋を利用できません。",
    chatPrivateRoomReady: "暗色のパスワード部屋に入りました。メッセージはブラウザ側で暗号化されます。",
    chatPublicRoomReady: "通常の匿名ルームに戻りました。",
    chatDecryptFailed: "このメッセージは現在のパスワードでは復号できません。",
    chatEncryptFailed: "メッセージの暗号化に失敗しました。もう一度試してください。",
    chatSyncStatus: "差分自動更新、待機中は低頻度",
    chatSyncStatusActive: "約5秒ごとに更新",
    chatSyncStatusIdle: "約15秒ごとに更新",
    chatSyncStatusSlow: "低頻度更新、約30秒ごと",
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
    chatSending: "送信中...",
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
      article_id: "seed-update-2026-07-17-mobile-transfer-send-fix",
      slug: "2026-07-17-mobile-transfer-send-fix",
      category: "site-updates",
      tags: ["mobile", "Quick Transfer", "attachments", "UI"],
      cover_image: "",
      status: "published",
      is_pinned: 0,
      created_at: "2026-07-16T18:45:00.000Z",
      updated_at: "2026-07-16T18:45:00.000Z",
      published_at: "2026-07-16T18:45:00.000Z",
      fallbackOnly: true,
      icon: "system",
      date: "2026.07.17",
      title: {
        zh: "手机顶栏与临时互传发送体验修复",
        en: "Mobile Header and Quick Transfer Send Fixes",
        ja: "モバイル上部バーと一時転送の送信修正"
      },
      summary: {
        zh: "移除手机端重复状态与阅读文字，临时互传改为附件先暂存再发送，并补齐相册选择、缩略图、下载和文字复制操作。",
        en: "Removes duplicated mobile status and reading labels, stages Quick Transfer attachments until Send, and adds photo selection, thumbnails, downloads, and text copy actions.",
        ja: "モバイルの重複した状態・読書表示を整理し、一時転送で添付を送信前に保持して、写真選択、縮小表示、ダウンロード、文字コピーを追加しました。"
      },
      content_markdown: {
        zh: "# 手机顶栏与临时互传发送体验修复\n\n本轮修复手机阅读和临时互传的直接操作问题，不改变登录、房间口令、加密、R2、配额、24 小时过期或下载鉴权。\n\n## 手机阅读\n\n- 手机虚拟 OS 移除顶部时间与 LUSU OS 状态行，释放正文空间；栏目 Appbar、首页入口和桌面顶栏保持不变。\n- 知识库文章不再同时显示栏目文字、百分比和进度条，只保留进度条以及可操作的返回、复制与回到顶部控件。\n\n## 临时互传\n\n- 从相册或文件选择器添加的附件会先显示在输入区，用户再次点击发送后才开始上传。\n- 待发送图片以小缩略图显示并可单独移除；发送后的图片限制在消息卡片内，普通文件使用文件卡片与类型图标。\n- 每个图片或文件都保留下载按钮，每条已解密文字末尾提供复制按钮。\n\n## 边界不变\n\n房间明文口令仍不会发送到服务器；文字继续在浏览器使用 AES-GCM，文件继续由 HTTPS、私有 R2 与服务端鉴权保护。普通账号配额、管理员 Multipart、24 小时过期和现有 API 保持不变。",
        en: "# Mobile Header and Quick Transfer Send Fixes\n\nThis release fixes direct mobile-reading and Quick Transfer interactions without changing sign-in, passphrases, encryption, R2, quotas, 24-hour expiry, or download authorization.\n\n## Mobile reading\n\n- The mobile virtual OS removes the time and LUSU OS status row to return space to content. The Appbar, Home entry, and desktop top bar stay unchanged.\n- Knowledge articles no longer repeat the route label, percentage, and progress bar together. The progress bar and real Back, Copy, and Back to Top controls remain.\n\n## Quick Transfer\n\n- Attachments added from the photo library or file picker stay in the composer until the user presses Send again.\n- Pending images use small removable thumbnails. Sent images stay bounded inside message cards, while regular files use a file card and type icon.\n- Every image or file keeps a Download action, and each decrypted text message ends with a Copy action.\n\n## Unchanged boundaries\n\nPlaintext room passphrases still never reach the server. Text continues to use browser AES-GCM, while files remain protected by HTTPS, private R2, and server authorization. Standard quotas, admin Multipart, 24-hour expiry, and existing APIs are unchanged.",
        ja: "# モバイル上部バーと一時転送の送信修正\n\n今回はモバイル記事と一時転送の直接操作を修正し、ログイン、合言葉、暗号化、R2、割り当て、24 時間の有効期限、ダウンロード認可は変更していません。\n\n## モバイル記事\n\n- モバイル仮想 OS から時刻と LUSU OS の状態行を外し、本文の表示領域を広げました。Appbar、Home 入口、デスクトップ上部バーは維持します。\n- ナレッジ記事では、ルート名、百分率、進捗バーの重複表示をやめ、進捗バーと実際に操作できる戻る・コピー・トップへ戻るを残しました。\n\n## 一時転送\n\n- 写真ライブラリまたはファイル選択から追加した添付は入力欄に保持され、もう一度送信を押してからアップロードを開始します。\n- 送信待ち画像は削除できる小さなサムネイルで表示します。送信済み画像はメッセージカード内に収め、通常ファイルは種類アイコン付きファイルカードにします。\n- 画像とファイルにはダウンロード、復号済みテキストの末尾にはコピー操作を用意しました。\n\n## 変更していない境界\n\n部屋の平文合言葉は引き続きサーバーへ送りません。文字はブラウザ AES-GCM、ファイルは HTTPS、非公開 R2、サーバー認可で保護します。一般割り当て、管理者 Multipart、24 時間期限、既存 API は変更していません。"
      }
    },
    {
      article_id: "seed-update-2026-07-16-mobile-transfer-ui-polish",
      slug: "2026-07-16-mobile-transfer-ui-polish",
      category: "site-updates",
      tags: ["mobile", "Quick Transfer", "UI", "accessibility"],
      cover_image: "",
      status: "published",
      is_pinned: 0,
      created_at: "2026-07-16T13:30:00.000Z",
      updated_at: "2026-07-16T13:30:00.000Z",
      published_at: "2026-07-16T13:30:00.000Z",
      fallbackOnly: true,
      icon: "system",
      date: "2026.07.16",
      title: {
        zh: "手机文章与临时互传界面修复",
        en: "Mobile Reading and Transfer UI Fixes",
        ja: "モバイル記事と一時転送 UI の修正"
      },
      summary: {
        zh: "修复手机端知识库文章回顶触控，并统一资源卡片尺寸与互传页面在窄屏、短屏和软键盘下的布局；安全、配额与 API 边界保持不变。",
        en: "Fixes mobile article back-to-top touch handling, aligns Resource cards, and adapts Quick Transfer to narrow, short, and keyboard-constrained screens without changing security, quotas, or APIs.",
        ja: "モバイル記事のトップへ戻る操作を修正し、リソースカードと一時転送を狭い画面・短い画面・ソフトキーボード向けに整えました。安全・割り当て・API の境界は変更していません。"
      },
      content_markdown: {
        zh: "# 手机文章与临时互传界面修复\n\n本轮针对手机阅读和资源区互传做可见体验修复，不改变后端能力与权限模型。\n\n## 知识库文章\n\n- 手机阅读文章时，回到顶部按钮不再被固定 Appbar 的触控层拦截，点击后可以正常返回文章开头。\n- Appbar 中真实可操作的返回、复制等控件仍然可以正常使用。\n\n## 资源区与互传\n\n- 临时互传卡片与日语学习卡片使用一致的网格宽度和卡片节奏，标题、元信息、说明与入口重新对齐。\n- 互传入口、房间、消息、上传任务、文件预览和输入区适配窄竖屏、短屏与手机横屏；软键盘出现时输入控件保持可见。\n- 非首页手机 App 中的登录入口仍然可达，关键控件保持合适的触控尺寸，不通过裁剪隐藏排版问题。\n\n## 边界不变\n\n本次只调整公开交互和响应式 UI。房间口令派生、HttpOnly 会话、私有 R2、24 小时过期、普通账号配额、管理员 Multipart 权限、下载鉴权以及现有 API 均未改变。",
        en: "# Mobile Reading and Transfer UI Fixes\n\nThis release improves mobile reading and the Resources transfer experience without changing backend capabilities or the permission model.\n\n## Knowledge articles\n\n- The Back to Top control is no longer blocked by the fixed Appbar touch layer while reading an article on mobile, so it returns to the article start as expected.\n- Real Appbar controls such as Back and Copy remain interactive.\n\n## Resources and Quick Transfer\n\n- The Quick Transfer and Japanese learning cards now share a consistent grid width and card rhythm, with aligned headings, metadata, descriptions, and actions.\n- Entry, room, message, upload task, file preview, and composer layouts now adapt to narrow portrait screens, short screens, and mobile landscape; focused inputs remain visible when the software keyboard opens.\n- Sign-in remains reachable from a non-Home mobile App, and key controls retain practical touch sizes without clipping content to hide layout problems.\n\n## Unchanged boundaries\n\nThis release changes only public interaction and responsive UI. Passphrase derivation, HttpOnly sessions, private R2 storage, 24-hour expiry, standard-account quotas, admin Multipart permissions, download authorization, and existing APIs are unchanged.",
        ja: "# モバイル記事と一時転送 UI の修正\n\n今回はモバイルでの記事閲覧とリソース欄の一時転送を改善し、バックエンド機能や権限モデルは変更していません。\n\n## ナレッジ記事\n\n- モバイルで記事を読む際、トップへ戻る操作が固定 Appbar のタッチ層に遮られなくなり、記事の先頭へ正しく戻ります。\n- 戻る・コピーなど Appbar 上の実際の操作ボタンは引き続き利用できます。\n\n## リソースと一時転送\n\n- 一時転送カードと日本語学習カードのグリッド幅とカードのリズムを揃え、見出し、メタ情報、説明、操作を整列しました。\n- 入口、部屋、メッセージ、アップロードタスク、ファイルプレビュー、入力欄を、狭い縦画面、短い画面、モバイル横画面に対応させました。ソフトキーボード表示中も入力欄を確認できます。\n- Home 以外のモバイル App からもログインへ進め、主要操作は内容を切り捨てずに十分なタッチ領域を保ちます。\n\n## 変更していない境界\n\n今回は公開操作とレスポンシブ UI のみの変更です。合言葉の派生、HttpOnly セッション、非公開 R2、24 時間の有効期限、一般アカウントの割り当て、管理者 Multipart 権限、ダウンロード認可、既存 API は変更していません。"
      }
    },
    {
      article_id: "seed-update-2026-07-16-quick-transfer",
      slug: "2026-07-16-quick-transfer",
      category: "site-updates",
      tags: ["Quick Transfer", "R2", "files", "security"],
      cover_image: "",
      status: "published",
      is_pinned: 0,
      created_at: "2026-07-16T10:00:00.000Z",
      updated_at: "2026-07-16T10:00:00.000Z",
      published_at: "2026-07-16T10:00:00.000Z",
      fallbackOnly: true,
      icon: "system",
      date: "2026.07.16",
      title: {
        zh: "临时互传进入资源区",
        en: "Quick Transfer Arrives in Resources",
        ja: "リソースに一時転送を追加"
      },
      summary: {
        zh: "资源区新增登录限定的临时互传房间，支持加密文字、图片、视频和文件；普通账号受免费池保护，管理员可使用分片大文件上传。",
        en: "Resources now includes signed-in temporary rooms for encrypted text, images, video, and files, with a guarded free pool for standard accounts and multipart large files for admins.",
        ja: "リソースにログイン限定の一時転送部屋を追加し、暗号化テキスト・画像・動画・ファイル、一般ユーザーの無料枠保護、管理者の大容量分割送信に対応しました。"
      },
      content_markdown: {
        zh: "# 临时互传进入资源区\n\n已登录用户输入同一房间口令后，可以临时交换加密文字、图片、视频和普通文件。房间明文口令不会发送到服务器；文件通过 HTTPS、私有 R2、随机对象键和服务端鉴权保护。普通账号单文件上限 95 MiB，并受个人、房间、频率及全站 8 GiB 免费池保护；只有数据库角色为 admin 的账号可用 Multipart Upload 发送数百 MB 到数 GB 文件。内容发布完成 24 小时后立即不可读取，下载支持 Range 和视频拖动。R2 桶、Pages 绑定、独立清理 Worker、生命周期规则和 Cloudflare 官方预算提醒仍需站长在 Dashboard 完成人工配置。",
        en: "# Quick Transfer Arrives in Resources\n\nSigned-in users who enter the same passphrase can exchange encrypted text, images, video, and regular files. Plaintext passphrases never reach the server; files use HTTPS, private R2, random object keys, and server authorization. Standard accounts are limited to 95 MiB per file and guarded by personal, room, rate, and shared 8 GiB free-pool limits. Only database admins may use Multipart Upload for hundreds of megabytes through multi-GB files. Items become unreadable after 24 hours, and downloads support Range requests and video seeking. The owner must still configure R2, Pages bindings, the cleanup Worker, lifecycle rules, and official Cloudflare budget alerts.",
        ja: "# リソースに一時転送を追加\n\n同じ合言葉を入力したログイン済みユーザー同士で、暗号化テキスト、画像、動画、通常ファイルを一時共有できます。一般アカウントは1件 95 MiB までで、個人・部屋・頻度・全体 8 GiB の無料枠保護を受けます。Multipart Upload で数百 MB から数 GB を送れるのはデータベースの admin のみです。公開完了から24時間後にアクセス不可となり、Range ダウンロードと動画シークに対応します。R2、Pages バインド、清理 Worker、ライフサイクル、Cloudflare 公式予算通知は Dashboard で手動設定が必要です。"
      }
    },
    {
      article_id: "seed-update-2026-07-14-japanese-subtext-retry-hotfix",
      slug: "2026-07-14-japanese-subtext-retry-hotfix",
      category: "site-updates",
      tags: ["Japanese", "learning", "accessibility", "bugfix"],
      cover_image: "",
      status: "published",
      is_pinned: 0,
      created_at: "2026-07-14T02:20:00.000Z",
      updated_at: "2026-07-14T02:20:00.000Z",
      published_at: "2026-07-14T02:20:00.000Z",
      fallbackOnly: true,
      icon: "system",
      date: "2026.07.14",
      title: {
        zh: "日语潜台词训练器 1.0.3 重答修复",
        en: "Japanese Subtext Trainer 1.0.3 Retry Fix",
        ja: "日本語の裏側 1.0.3 再回答修正"
      },
      summary: {
        zh: "修复错答后关闭结果弹窗、点击弹窗外或查看解析时可能失去重新答题入口的问题；题库、音频和云存档兼容版本继续保持 1.0.2。",
        en: "Fixes the dead end that could hide retry after a wrong answer when the result dialog was dismissed or analysis was opened; course, audio, and save compatibility remain on 1.0.2.",
        ja: "誤答後に結果ダイアログを閉じたり解説を開いたりすると再回答できなくなる問題を修正しました。問題集・音声・セーブ互換版は 1.0.2 のままです。"
      },
      content_markdown: {
        zh: "# 日语潜台词训练器 1.0.3 重答修复\n\n“日语的言外之意”应用更新至 1.0.3，集中修复错答后的操作死路。\n\n## 错答后始终可以继续\n\n- 结果弹窗不再允许通过关闭按钮、Escape 或点击弹窗外绕过必选操作。\n- 即使弹窗被浏览器或其他代码强制关闭，题面仍会显示重新答题按钮。\n- 查看解析后，重新答题入口会放在解析正文之前；只有本次答对时才显示进入下一关。\n\n## 版本边界\n\n本次只更新应用界面与交互。250 关题库、10,088 段静态音频以及云存档兼容边界继续使用 contentVersion 1.0.2，没有伪造内容迁移或重录记录。",
        en: "# Japanese Subtext Trainer 1.0.3 Retry Fix\n\nBehind the Japanese moves to app version 1.0.3 with a focused fix for the wrong-answer dead end.\n\n## Retry always remains available\n\n- The result dialog can no longer bypass its required actions through the close button, Escape, or an outside click.\n- If the browser or another script forcibly closes the dialog, the question area still exposes Try Again.\n- After View Analysis, Try Again appears before the explanation content; Next Stage appears only when the current attempt is correct.\n\n## Version boundary\n\nThis release changes only the application interface and interaction. The 250-stage course, 10,088 static audio files, and cloud-save compatibility boundary remain on contentVersion 1.0.2, with no fabricated content migration or rerecording claim.",
        ja: "# 日本語の裏側 1.0.3 再回答修正\n\n「日本語の裏側」をアプリ版 1.0.3 に更新し、誤答後に操作できなくなる経路を修正しました。\n\n## いつでも再回答できる導線\n\n- 結果ダイアログは、閉じるボタン、Escape、外側クリックで必須操作を回避できないようにしました。\n- ブラウザや別のスクリプトがダイアログを強制的に閉じても、問題欄には再回答ボタンが残ります。\n- 解説を開いた後は本文より前に再回答を表示し、今回の回答が正解した場合だけ次のステージを表示します。\n\n## バージョン境界\n\n今回はアプリ画面と操作だけの更新です。250 ステージの問題集、10,088 件の静的音声、クラウドセーブの互換境界は contentVersion 1.0.2 のままで、内容移行や再録を行ったとは扱いません。"
      }
    },
    {
      article_id: "seed-update-2026-07-11-japanese-subtext-trainer",
      slug: "2026-07-11-japanese-subtext-trainer",
      category: "site-updates",
      tags: ["Japanese", "listening", "learning", "tools"],
      cover_image: "",
      status: "published",
      is_pinned: 0,
      created_at: "2026-07-10T17:30:00.000Z",
      updated_at: "2026-07-10T17:30:00.000Z",
      published_at: "2026-07-10T17:30:00.000Z",
      fallbackOnly: true,
      icon: "system",
      date: "2026.07.11",
      title: {
        zh: "日语潜台词训练工具更新至 1.0.2",
        en: "Japanese Subtext Trainer 1.0.2 Update",
        ja: "日本語の裏側 1.0.2 アップデート"
      },
      summary: {
        zh: "“日语的言外之意”更新至 1.0.2：重置全库语音读音链路，修复句尾异常“いい”和“今日”漏读；重做 PC 布局、打卡记录、解析续关与四格漫画配图。",
        en: "Behind the Japanese 1.0.2 rebuilds the speech pipeline to fix detached ending sounds and missing consonants, then adds a denser PC shell, calendar check-ins, analysis-to-next-stage flow, and four-panel manga scenes.",
        ja: "「日本語の裏側」1.0.2 では、語尾の異音と子音欠落を直すため音声生成を全面更新し、PC レイアウト、カレンダー式学習記録、解説後の次ステージ導線、四コマ漫画を追加しました。"
      },
      content_markdown: {
        zh: "# 日语潜台词训练工具更新至 1.0.2\n\n“日语的言外之意”继续使用 250 关数据题库，这次重点重置语音生成、桌面布局和学习记录，让听力训练更可靠也更紧凑。\n\n## 语音读音全量重置\n\n- 句子、选项和词块先保存可审校的假名读音，再交给离线模型；画面仍显示原来的日语汉字。\n- 生成器会分离 Misaki 的音高标记、规范化特殊辅音并拒绝未知音素，不再把末尾标记读成额外的“いい”，也不会把“きょう”的辅音丢掉后读成“おう”。\n- 语音管线升级到 v4 后强制重建全库静态音频。浏览器训练时仍不加载 TTS，批处理结束后模型保持关闭且不自启动。\n\n## 更紧凑的 PC 训练界面\n\n- 桌面端复用游戏区的壳层思路：左上角返回个人站，右上角显示名称，中间突出存档同步。\n- 关卡内容取消重复的整屏最小高度，场景、题目和解析重新排布，减少大块空白。\n- 查看解析后可直接进入下一关；资源区入口改为“开始”，标题、按钮和卡片文案不再被误拖选。\n\n## 月历打卡与四格场景\n\n- 学习记录改为月历打卡，显示当前连续、最长连续、总打卡天数和最近活动；登录后通过独立日活动表同步。\n- 每关配一张贴合题目情境的原创黑白四格漫画，统一人物、线条、网点和分镜，并适配桌面、平板和手机窗口。",
        en: "# Japanese Subtext Trainer 1.0.2 Update\n\nBehind the Japanese keeps its 250-stage data-driven course while rebuilding speech generation, desktop layout, and learning history for a more reliable and compact listening experience.\n\n## Full speech-reading reset\n\n- Sentences, answer choices, and phrase tokens now store reviewable kana readings before they reach the offline model, while the interface continues to display the original kanji.\n- The generator separates Misaki pitch metadata, normalizes special consonants, and rejects unknown phonemes. This removes the detached ending sound and prevents kyou from losing its ky consonant and becoming ou.\n- Pipeline v4 forces the static audio library to be regenerated. The browser still never loads TTS during training, and the local model remains stopped with no autostart after the batch.\n\n## A denser PC training shell\n\n- The desktop tool adopts the game-area shell pattern: Back to Site at top left, the tool name at top right, and save synchronization centered in the frame.\n- Repeated viewport-height constraints were removed, and the scene, questions, and analysis were rearranged to eliminate large unused gaps.\n- Analysis now leads directly to the next stage. The Resources action is Start, and non-input headings, buttons, and card labels no longer become accidentally selected.\n\n## Calendar check-ins and four-panel scenes\n\n- Learning history is now a monthly check-in calendar with current streak, longest streak, total days, and recent activity, synchronized through a dedicated daily-activity table after sign-in.\n- Every stage receives an original black-and-white four-panel manga scene matched to its prompt, with consistent characters, line work, screentones, and responsive placement.",
        ja: "# 日本語の裏側 1.0.2 アップデート\n\n250 ステージのデータ式問題はそのままに、音声生成、PC レイアウト、学習記録を作り直し、聴解練習をより確実でコンパクトにしました。\n\n## 読みを固定した全音声の再生成\n\n- 文、選択肢、語句は、オフラインモデルへ渡す前に確認可能なかな読みを保存します。画面には従来どおり漢字を含む日本語を表示します。\n- Misaki の音高メタデータを音素から分離し、特殊な子音を正規化して未知音素を拒否します。語尾の余分な「いい」を除き、「きょう」の ky が欠けて「おう」になる問題も防ぎます。\n- 音声パイプライン v4 で静的音声を全件再生成します。練習中のブラウザーは TTS を読み込まず、処理後のローカルモデルは停止したままで自動起動しません。\n\n## 空白を減らした PC 画面\n\n- ゲーム欄のシェル構成を取り入れ、左上にサイトへ戻る操作、右上にツール名、中央にセーブ同期を配置しました。\n- 重複していた画面高の制約を外し、場面、問題、解説を再配置して大きな空白を減らしました。\n- 解説から次のステージへ直接進めます。リソース欄の操作は「開始」とし、見出し、ボタン、カード文字の誤選択も防ぎます。\n\n## カレンダー式記録と四コマ場面\n\n- 学習記録を月間カレンダーに変更し、現在・最長の連続日数、合計日数、最近の活動を表示します。ログイン後は専用の日別活動テーブルで同期します。\n- 各ステージに、設問の状況に合うオリジナル白黒四コマ漫画を用意し、人物、線、スクリーントーン、配置を統一して各画面幅に対応します。"
      }
    },
    {
      article_id: "seed-update-2026-07-10-premium-interaction-mobile-os",
      slug: "2026-07-10-premium-interaction-mobile-os",
      category: "site-updates",
      tags: ["design", "mobile", "interaction", "accessibility"],
      cover_image: "",
      status: "published",
      is_pinned: 0,
      created_at: "2026-07-10T16:20:00.000Z",
      updated_at: "2026-07-10T16:20:00.000Z",
      published_at: "2026-07-10T16:20:00.000Z",
      fallbackOnly: true,
      icon: "system",
      date: "2026.07.11",
      title: {
        zh: "GPT-5.6 高级交互与移动 OS 重设计",
        en: "GPT-5.6 Premium Interaction & Mobile OS Redesign",
        ja: "GPT-5.6 プレミアム操作とモバイル OS 再設計"
      },
      summary: {
        zh: "桌面任务栏选中态随模块切换即时同步；手机 Dock 按六个高频入口重新适配为更短的栏体与更清晰的图标尺寸。",
        en: "Desktop taskbar selection now follows module changes immediately, while the six-item mobile Dock uses a shorter bar and clearer icon sizing.",
        ja: "デスクトップのタスクバー選択状態を切り替えと同時に同期し、6 項目のモバイル Dock を短いバーと見やすいアイコン寸法に最適化しました。"
      },
      content_markdown: {
        zh: "# GPT-5.6 高级交互与移动 OS 重设计\n\n这次汇总更新继续保留桌面端 Windows XP、像素艺术与 Y2K 识别度，并把手机端完善为更紧凑、更易读的原创虚拟手机 OS。\n\n## 全站轻动效重置\n\n- 桌面 Home 图标打开 App 时不再创建 Home 全屏快照，只让目标窗口用 200ms 淡入并上移 3px 归位；实时壁纸、顶栏和任务栏保持不动。\n- 桌面任务栏在模块间切换时只显示新活动页面的约 200ms、±6px 轻滑入；返回 Home 时仅让图标区轻滑入，Home 快照不会进入顶层遮住任务栏。\n- 手机 Dock 切换使用约 220ms、±12px 的方向滑动；一个共享选中底板在入口间连续移动，快速连续点击会中止旧转场，不再硬切或留下重影。\n- 弹窗、窗口、按钮和主题统一为低位移反馈；减少动态与关闭动效模式立即完成导航。\n\n## 真实可用的手机导航\n\n- 手机 Appbar 左上角使用带文字的 Home 返回按钮，当前模块名移到右上角，账号和语言仍只在 Home 显示。\n- 底部 Dock 在所有模块内保持悬浮，只保留 Home、知识库、视频、资源、游戏和聊天室六个高频入口；375px 以上居中排列，359px 可短距离横滑，杂谈与关于仍从 Home 图标进入。\n- 网页无法可靠读取 iPhone 的真实信号、Wi-Fi 与电量，因此移除装饰性状态图标，避免把模拟状态误认为设备状态。\n\n## 更紧凑的首页与分层模块\n\n- Home 图标按从左到右、从上到下排列，固定行高，热区贴合图标与标题并保持至少 44px。\n- 知识库、视频、资源、游戏、杂谈、聊天室与关于页继续使用统一的外框、工具区、标签区和内容区层级。\n- 边框使用本站四时段和 Neo-XP 色彩，不复制参考图配色或图标；卡片、文案和按钮继续适配短竖屏与横屏。\n\n所有原有路由、API、D1 数据、账户登录、游戏云存档、普通与密码聊天室、三语内容、视频系统和遥测隐私边界保持不变。",
        en: "# GPT-5.6 Premium Interaction & Mobile OS Redesign\n\nThis consolidated update keeps the Windows XP, pixel-art, and Y2K identity on desktop while refining mobile into a tighter and more readable original virtual phone OS.\n\n## Site-wide calm motion reset\n\n- Desktop Home App launches no longer create a full Home-screen snapshot. Only the destination window fades in and settles upward by 3px over 200ms, while the live wallpaper, top bar, and taskbar remain still.\n- Desktop taskbar module changes reveal only the new active page with an approximately 200ms, ±6px slide. Returning Home animates only the icon group, so no Home snapshot can cover the taskbar.\n- Mobile Dock changes use an approximately 220ms directional ±12px slide. One shared selection pill moves continuously between routes, and rapid taps skip the previous transition instead of producing a hard cut or ghost frame.\n- Dialogs, windows, buttons, and theme changes now share low-displacement feedback. Reduced-motion and motion-off modes navigate immediately.\n\n## A real mobile navigation Dock\n\n- The mobile Appbar has a labeled Home button on the left and the current module name aligned on the right. Account and language controls remain Home-only.\n- The frosted Dock persists across Apps with six high-frequency routes: Home, Knowledge, Videos, Resources, Games, and Chat. They center from 375px upward and briefly scroll at 359px; Notes and About remain available from Home.\n- Browsers cannot reliably read an iPhone's real signal, Wi-Fi, or battery status, so decorative status glyphs were removed to avoid presenting simulated values as device state.\n\n## Tighter Home and layered Apps\n\n- Home icons fill left to right and top to bottom with fixed rows; hit areas hug the visible icon and label while retaining a 44px minimum.\n- Knowledge, Videos, Resources, Games, Notes, Chat, and About keep a shared outer-frame, toolbar, tab, and content hierarchy.\n- Frames use this site's four-time Neo-XP palette rather than copying reference colors or icons, and content remains adaptive in short portrait and landscape layouts.\n\nExisting routes, APIs, D1 data, account sessions, game cloud saves, public and password chat, three-language content, video delivery, and telemetry privacy boundaries remain unchanged.",
        ja: "# GPT-5.6 プレミアム操作とモバイル OS 再設計\n\n今回の統合更新では、デスクトップの Windows XP、ピクセルアート、Y2K の個性を保ちながら、モバイルをよりコンパクトで読みやすい独自の仮想スマートフォン OS に整えました。\n\n## 全体を軽い動きに再設計\n\n- デスクトップの Home から App を開くときは全画面スナップショットを作らず、対象ウィンドウだけを 200ms のフェードと 3px の上移動で整えます。壁紙、上部バー、タスクバーは動きません。\n- デスクトップ下部ナビのモジュール切り替えは、新しい活動ページだけを約 200ms、±6px で軽く表示します。Home 復帰ではアイコン領域だけを動かし、Home のスナップショットがタスクバーを覆うことはありません。\n- モバイル Dock は約 220ms、±12px の方向付きスライドを使います。一つの共有選択プレートが項目間を連続して移動し、素早い連続操作では古い遷移を中止するため、硬い切り替えや残像が出ません。\n- ダイアログ、ウィンドウ、ボタン、テーマも低移動量の反応に統一しました。動きを減らす設定では直ちに移動します。\n\n## 実際に使えるモバイル Dock\n\n- Appbar 左上に文字付き Home ボタンを置き、現在のモジュール名を右上に揃えました。アカウントと言語操作は Home のみに残します。\n- 半透明 Dock は Home、知識庫、動画、リソース、ゲーム、チャットの高頻度 6 項目に整理しました。375px 以上では中央に並び、359px では短く横スクロールできます。雑談とプロフィールは Home から開けます。\n- ブラウザーは iPhone の実際の電波、Wi-Fi、バッテリーを安定して取得できないため、模擬値と誤解される装飾表示を削除しました。\n\n## コンパクトな Home と多層 App\n\n- Home アイコンは左から右、上から下へ固定行高で並び、タップ範囲は見えるアイコンとラベルに沿わせつつ 44px 以上を保ちます。\n- 知識庫、動画、リソース、ゲーム、雑談、チャット、プロフィールは、外枠、ツール、タブ、内容領域の共通階層を維持します。\n- 参考画像の色やアイコンはコピーせず、このサイトの四時間帯 Neo-XP 配色を使い、短い縦画面と横画面にも適応します。\n\n既存のルート、API、D1 データ、アカウント、ゲームのクラウドセーブ、公開・パスワードチャット、三言語コンテンツ、動画、テレメトリーのプライバシー境界は変更していません。"
      }
    },
    {
      icon: "🔒",
      date: "2026.07.06",
      title: {
        zh: "暗色加密密码房上线",
        en: "Dark Encrypted Password Rooms",
        ja: "暗色の暗号化パスワード部屋"
      },
      desc: {
        zh: "匿名聊天室新增暗色密码房，并修复旧库自动补字段时普通大厅读取失败的问题",
        en: "Anonymous chat now has dark encrypted password rooms, with a migration fix for existing public rooms",
        ja: "匿名チャットに暗色の暗号化パスワード部屋を追加し、既存ルームの移行時読み込み不具合も修正しました"
      }
    },
    {
      icon: "🪟",
      date: "2026.06.30",
      title: {
        zh: "账号弹窗层级修复",
        en: "Account Popover Layer Fix",
        ja: "アカウント表示の重なり修正"
      },
      desc: {
        zh: "右上角账号入口现在会显示在首页和各栏目窗口之上，登录、注册和退出流程保持不变",
        en: "The top-right account entry now opens above the home page and section windows while keeping login, registration, and sign-out behavior unchanged",
        ja: "右上のアカウント入口がホームや各セクションのウィンドウより前面に表示され、ログイン、登録、ログアウトの動作はそのままです"
      }
    },
    {
      icon: "🧩",
      date: "2026.06.24",
      title: {
        zh: "账号流程与合并上线整理",
        en: "Account Flow and Merge Launch",
        ja: "アカウント操作とマージ公開の整理"
      },
      desc: {
        zh: "账号登录、注册和退出改为更稳定的按钮流程，最近更新操作区完成精简，发布方式回到合并 main 后自动上线",
        en: "Account sign-in, registration, and sign-out now use steadier button handling, the recent-update actions are simplified, and releases return to merge-to-main deployment",
        ja: "ログイン、登録、ログアウトのボタン処理を安定させ、最近の更新の操作欄を簡潔にし、main へのマージで公開する流れに戻しました"
      }
    },
    {
      icon: "🛠️",
      date: "2026.06.23",
      title: {
        zh: "公开体验、无障碍和隐私收尾",
        en: "Public UX, Accessibility, and Privacy Wrap-up",
        ja: "公開体験・アクセシビリティ・プライバシー仕上げ"
      },
      desc: {
        zh: "主站按钮点击、弹窗焦点、资源空状态、社交入口、游戏来源链接和访问统计隐私做了一轮集中收口",
        en: "The public site received a wrap-up pass for button clicks, modal focus, honest empty states, social links, game source links, and analytics privacy",
        ja: "公開サイトのボタン操作、モーダルのフォーカス、空状態、SNS入口、ゲーム出典リンク、アクセス解析のプライバシーをまとめて整えました"
      }
    },
    {
      icon: "🧭",
      date: "2026.06.22",
      title: { zh: "底部导航与四时段窗口背景", en: "Pinned Taskbar and Window Backdrops", ja: "固定タスクバーと時間帯背景" },
      desc: {
        zh: "底部导航固定贴合屏幕下沿，窗口页改用随时间切换的专用低干扰背景，并补齐窄屏手机窗口避让",
        en: "The bottom taskbar now stays pinned to the viewport edge, with dedicated quiet backdrops and small-phone window spacing",
        ja: "下部タスクバーを画面下端に固定し、専用の控えめな背景と狭いスマホ幅での余白を整えました"
      }
    },
    {
      icon: "📇",
      date: "2026.06.22",
      title: { zh: "联系方式图标归位", en: "Contact Icons Aligned", ja: "連絡先アイコンを整理" },
      desc: {
        zh: "关于我窗口删除联系方式占位文案，把 X、GitHub、Bilibili、Instagram 和 Discord 原应用图标移入联系方式行",
        en: "The About window removes the contact placeholder and moves the X, GitHub, Bilibili, Instagram, and Discord app icons into the Contact row",
        ja: "プロフィール画面の連絡先プレースホルダーを削除し、X、GitHub、Bilibili、Instagram、Discord のアプリアイコンを連絡先行へ移動しました"
      }
    },
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
      action: "quick-transfer",
      iconSprite: "app",
      version: "v1.0.0",
      size: "24 HOURS",
      updated: "2026.07.16",
      external: false,
      title: { zh: "临时互传", en: "Quick Transfer", ja: "一時転送" },
      desc: {
        zh: "登录后通过房间口令临时发送加密文字、图片、视频和文件，内容 24 小时后失效。",
        en: "Share encrypted text, images, video, and files in a passphrase room after signing in. Items expire after 24 hours.",
        ja: "ログイン後、合言葉の部屋で暗号化テキスト・画像・動画・ファイルを一時共有し、24時間後に失効します。"
      },
      actionLabel: { zh: "打开", en: "Open", ja: "開く" },
      tags: [
        { zh: "登录限定", en: "Sign-in required", ja: "ログイン限定" },
        { zh: "24小时", en: "24 hours", ja: "24時間" },
        { zh: "管理员大文件", en: "Admin large files", ja: "管理者の大容量送信" }
      ]
    },
    {
      category: 0,
      iconSrc: "tools/japanese-subtext/assets/icons/tool-icon-64.webp",
      version: "v1.0.3",
      updated: "2026.07.14",
      external: false,
      showReadyStatus: false,
      url: "/tools/japanese-subtext/",
      title: { zh: "日语的言外之意", en: "Behind the Japanese", ja: "日本語の裏側" },
      desc: {
        zh: "通过语气、上下文和人物关系，判断日语对话中真正想表达的意思。",
        en: "Infer what Japanese speakers really mean through tone, context, and relationships.",
        ja: "口調、文脈、人間関係から、日本語の会話で本当に伝えたいことを読み取ります。"
      },
      actionLabel: { zh: "开始", en: "Start", ja: "開始" },
      tags: [
        { zh: "听力训练", en: "Listening", ja: "聴解" },
        { zh: "潜台词", en: "Subtext", ja: "含意" },
        { zh: "支持（云存档）", en: "Cloud Save Supported", ja: "クラウドセーブ対応" }
      ]
    },
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
let accountSubmitting = false;
let accountPopoverReturnFocus = null;
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
const gameState = {
  catalog: null,
  pending: null
};

const videoWindowState = {
  maximized: false
};
const modalFocusState = {
  videoTrigger: null,
  welcomeTrigger: null
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
  "空状态": { zh: "空状态", en: "Empty state", ja: "空状態" },
  "筛选": { zh: "筛选", en: "Filters", ja: "フィルター" },
  "数量": { zh: "数量", en: "Counts", ja: "件数" }
};

const pageIds = ["home", "knowledge", "videos", "resources", "games", "blog", "chatroom", "about"];

const socialLinkPlatforms = [
  { id: "x", label: "X", defaultUrl: "https://x.com/lusu575" },
  { id: "github", label: "GitHub", defaultUrl: "https://github.com/lusu575" },
  { id: "bilibili", label: "Bilibili", defaultUrl: "" },
  { id: "instagram", label: "Instagram", defaultUrl: "https://www.instagram.com/lusu575/" },
  { id: "discord", label: "Discord", defaultUrl: "" }
];
const socialLinkPlatformMap = new Map(socialLinkPlatforms.map((item) => [item.id, item]));
const trustedResourceExternalHosts = new Set(["github.com", "www.github.com", "raw.githubusercontent.com", "gist.github.com"]);
const trustedGameExternalHosts = new Set(["github.com", "www.github.com", "github.io"]);

const chatStorageKeys = {
  visitorId: "lusu-chat-visitor-id",
  nickname: "lusu-chat-nickname",
  lastSentAt: "lusu-chat-last-sent-at"
};

const chatInitialMessageLimit = 100;
const chatUnanchoredRefreshLimit = 20;
const chatCooldownMs = 3000;
const chatPublicRoomKey = "public";
const chatPrivateRoomSalt = "lusu575-private-chat-v1";
const chatPrivateRoomIterations = 150000;

const chatState = {
  initialized: false,
  loading: false,
  sending: false,
  hasLoadedInitial: false,
  idlePolls: 0,
  visitorId: "",
  nickname: "",
  lastMessageId: "",
  seenMessageIds: new Set(),
  pollTimer: null,
  pollDelay: 5000,
  roomKey: chatPublicRoomKey,
  roomMode: "public",
  roomCryptoKey: null,
  roomRevision: 0,
  lastSentAt: sanitizeChatLastSentAt(safeStorageGet(chatStorageKeys.lastSentAt, "0"))
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

function safeStorageGet(key, fallback = "") {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function safeStorageSet(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function sanitizeChatLastSentAt(value, now = Date.now()) {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp) || timestamp < 0 || timestamp > now) {
    return 0;
  }
  return timestamp;
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
  const articleMatch = raw.match(/^knowledge\/(?:article\/)?([a-z0-9][a-z0-9-]{0,119})$/);
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
  setMetaContent('meta[property="og:type"]', "website");
  setMetaContent('meta[property="og:site_name"]', title);
  setMetaContent('meta[property="og:title"]', title);
  setMetaContent('meta[property="og:description"]', description);
  setMetaContent('meta[property="og:url"]', canonicalUrl);
  setMetaContent('meta[property="og:image"]', defaultShareImageUrl);
  setMetaContent('meta[property="og:locale"]', locale);
  setMetaContent('meta[name="twitter:title"]', title);
  setMetaContent('meta[name="twitter:description"]', description);
  setMetaContent('meta[name="twitter:image"]', defaultShareImageUrl);
}

function articleShareImageUrl(article) {
  const safeCover = safeArticleImageSrc(article?.cover_image || "");
  return safeCover ? `https://lusu575.com/${safeCover}` : defaultShareImageUrl;
}

function syncArticleDocumentMeta(article) {
  const siteTitle = t("heroTitle");
  const articleTitle = String(article?.title || "").trim() || siteTitle;
  const description = String(article?.summary || "").trim() || t("siteDescription");
  const canonicalUrl = new URL(articleRouteHref(article?.slug || articleState.currentSlug, currentLang), "https://lusu575.com").href;
  const locale = { zh: "zh_CN", en: "en_US", ja: "ja_JP" }[currentLang] || "zh_CN";
  const imageUrl = articleShareImageUrl(article);

  document.title = articleTitle === siteTitle ? siteTitle : `${articleTitle} | ${siteTitle}`;
  setLinkHref('link[rel="canonical"]', canonicalUrl);
  setMetaContent('meta[name="description"]', description);
  setMetaContent('meta[property="og:type"]', "article");
  setMetaContent('meta[property="og:site_name"]', siteTitle);
  setMetaContent('meta[property="og:title"]', articleTitle);
  setMetaContent('meta[property="og:description"]', description);
  setMetaContent('meta[property="og:url"]', canonicalUrl);
  setMetaContent('meta[property="og:image"]', imageUrl);
  setMetaContent('meta[property="og:locale"]', locale);
  setMetaContent('meta[name="twitter:title"]', articleTitle);
  setMetaContent('meta[name="twitter:description"]', description);
  setMetaContent('meta[name="twitter:image"]', imageUrl);
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

function hostMatches(hostname, allowedHosts) {
  const host = String(hostname || "").toLowerCase();
  return [...allowedHosts].some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

function safeTrustedExternalUrl(value, allowedHosts) {
  try {
    const url = new URL(String(value || "").trim());
    return url.protocol === "https:" && hostMatches(url.hostname, allowedHosts) ? url.href : "";
  } catch {
    return "";
  }
}

function safeGithubUrl(value) {
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

function normalizeSocialLinksPayload(payload) {
  const source = Array.isArray(payload?.links) ? payload.links : [];
  return source.reduce((result, item) => {
    const platform = String(item?.platform || item?.id || "").trim().toLowerCase();
    const url = safeHttpUrl(item?.url);
    if (socialLinkPlatformMap.has(platform) && url) {
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
    const url = safeHttpUrl(links[platform.id]) || safeHttpUrl(platform.defaultUrl);
    anchor.hidden = !url;
    if (!url) {
      anchor.removeAttribute("href");
      anchor.removeAttribute("title");
      anchor.removeAttribute("aria-label");
      return;
    }
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

function safeResourceIconSrc(value) {
  const path = String(value || "").trim().replace(/^\/+/, "").replace(/^\.\//, "");
  if (path === "tools/japanese-subtext/assets/icons/tool-icon-64.webp") {
    return sitePath(path);
  }
  if (/^assets\/images\/[a-z0-9][a-z0-9._/-]+\.(png|jpe?g|webp|gif)(\?[a-z0-9=&._-]+)?$/i.test(path)) {
    return sitePath(path);
  }
  return "";
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
    const external = safeTrustedExternalUrl(value, trustedGameExternalHosts);
    if (external) {
      return external;
    }
    return "";
  }
  if (item.externalUrl) {
    return safeTrustedExternalUrl(item.externalUrl, trustedGameExternalHosts);
  }
  if (item.repo && !item.entry) {
    return safeGithubUrl(item.repo);
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
    tag.setAttribute("aria-label", title);
    tag.textContent = title;
    return tag;
  });
}

function isExternalGameUrl(url) {
  return /^https?:\/\//i.test(url);
}

function setLanguage(lang, options = {}) {
  currentLang = lang;
  if (options.persist) {
    safeStorageSet(languageStorageKey, lang);
  }
  if (options.syncUrl) {
    syncLanguageUrl(lang);
  }
  document.documentElement.lang = lang === "zh" ? "zh-CN" : lang;
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

  document.querySelectorAll("[data-i18n-alt]").forEach((node) => {
    node.setAttribute("alt", t(node.dataset.i18nAlt));
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
  updateArticleWindowButton();
  updateVideoWindowButton();
  renderAccountWidget();
  updateChatSyncStatus();
  syncChatRoomUi();
}

function routeReturnTarget(route, motionKind) {
  if (!pageIds.includes(route)) {
    return null;
  }
  const selector = motionKind === "window-minimize"
    ? ".taskbar-tabs button[data-route]"
    : ".desktop-icon[data-route]";
  return Array.from(document.querySelectorAll(selector)).find((element) => element.dataset.route === route) || null;
}

const routeIconRectCache = new Map();

function elementMotionRect(element) {
  if (!(element instanceof Element)) {
    return null;
  }
  const rect = element.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) {
    return null;
  }
  return {
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    left: rect.left,
    width: rect.width,
    height: rect.height
  };
}

function captureRouteIconRects() {
  if (document.body.dataset.route !== "home") {
    return;
  }
  const shell = document.documentElement.dataset.uiShell || "";
  document.querySelectorAll(".desktop-icon[data-route]").forEach((element) => {
    const rect = elementMotionRect(element);
    if (rect && pageIds.includes(element.dataset.route)) {
      routeIconRectCache.set(element.dataset.route, {
        rect,
        shell,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight
      });
    }
  });
}

function cachedRouteIconRect(route) {
  const cached = routeIconRectCache.get(route);
  if (!cached
    || cached.shell !== (document.documentElement.dataset.uiShell || "")
    || cached.viewportWidth !== window.innerWidth
    || cached.viewportHeight !== window.innerHeight) {
    return null;
  }
  return cached.rect;
}

function routeExitOriginRect(route, motionKind, returnTarget) {
  if (motionKind === "window-minimize") {
    return elementMotionRect(returnTarget);
  }
  const cachedIcon = cachedRouteIconRect(route);
  if (cachedIcon) {
    return cachedIcon;
  }
  const taskButton = Array.from(document.querySelectorAll(".taskbar-tabs button[data-route]"))
    .find((element) => element.dataset.route === route && elementMotionRect(element));
  return elementMotionRect(taskButton) || elementMotionRect(document.querySelector(".start-button"));
}

function routeWindowFocusTarget(route) {
  const page = pageIds.includes(route) ? document.getElementById(route) : null;
  if (!page) {
    return null;
  }
  const candidate = Array.from(page.querySelectorAll(".close-button, [data-article-back], button, a[href], input, textarea"))
    .find((element) => focusTargetIsVisible(element));
  if (candidate) {
    return candidate;
  }
  const windowSurface = page.querySelector(":scope > .xp-window");
  if (windowSurface) {
    windowSurface.tabIndex = -1;
  }
  return windowSurface;
}

function focusTargetIsVisible(element) {
  if (!(element instanceof Element) || element === document.body || element === document.documentElement) {
    return false;
  }
  if (element.closest("[hidden]")) {
    return false;
  }
  const page = element.closest(".page");
  return (!page || page.classList.contains("active")) && element.getClientRects().length > 0;
}

let navigationRequestId = 0;

function navigate(route, options = {}) {
  const requestId = ++navigationRequestId;
  const nextRoute = pageIds.includes(route) ? route : "home";
  const previousRoute = pageIds.includes(document.body.dataset.route) ? document.body.dataset.route : "home";
  if (previousRoute === "home") {
    captureRouteIconRects();
  }
  const isSameRouteNoop = previousRoute === nextRoute
    && !(nextRoute === "knowledge" && (options.articleSlug || articleState.currentSlug));
  if (isSameRouteNoop) {
    updateNavigationState(nextRoute);
    return;
  }
  updateNavigationState(nextRoute);
  let motionKind = typeof options.motionKind === "string" ? options.motionKind : "route";
  if (motionKind === "route"
    && document.documentElement.dataset.uiShell === "mobile"
    && !options.trigger?.matches?.(".desktop-icon")) {
    motionKind = "mobile-tab";
  }
  const isExitMotion = motionKind === "window-close" || motionKind === "window-minimize";
  const returnTarget = isExitMotion && nextRoute === "home" && previousRoute !== "home"
    ? routeReturnTarget(previousRoute, motionKind)
    : null;
  const mobileHomeReturnTarget = nextRoute === "home"
    && previousRoute !== "home"
    && options.trigger?.matches?.(".mobile-home-button")
    ? routeReturnTarget(previousRoute, "window-close")
    : null;
  const focusReturnTarget = returnTarget || mobileHomeReturnTarget;
  const exitOriginRect = isExitMotion
    ? routeExitOriginRect(previousRoute, motionKind, returnTarget)
    : null;
  let navigationCommitted = false;
  const commitNavigation = () => {
    if (navigationCommitted || requestId !== navigationRequestId) {
      return;
    }
    navigationCommitted = true;
    if (!(nextRoute === "knowledge" && options.articleSlug) && articleState.currentSlug) {
      articleState.currentSlug = "";
      articleState.currentArticle = null;
      articleState.detailLoadingKey = "";
      renderKnowledge();
    }
    document.querySelectorAll(".page").forEach((page) => {
      page.classList.toggle("active", page.id === nextRoute);
    });
    document.body.dataset.route = nextRoute;
    updateNavigationState(nextRoute);
    if (nextRoute === "chatroom") {
      initChatroom();
    }
    if (options.updateUrl !== false && options.updateHash !== false) {
      syncBrowserUrl(nextRoute, nextRoute === "knowledge" ? options.articleSlug || "" : "");
    }
    if (!(nextRoute === "knowledge" && options.articleSlug)) {
      syncDocumentMeta();
    }
    window.scrollTo({ top: 0, behavior: "auto" });
    window.dispatchEvent(new CustomEvent("lusu:navigation", {
      detail: { route: nextRoute }
    }));
    const shouldFocusWindow = ["route", "app-open", "mobile-tab"].includes(motionKind) && nextRoute !== "home" && Boolean(
      options.focusWindow === true
        || options.trigger && (
          document.documentElement.dataset.inputMethod === "keyboard"
            || !focusTargetIsVisible(options.trigger) && previousRoute !== nextRoute
        )
    );
    if (focusReturnTarget && options.restoreFocus !== false) {
      window.requestAnimationFrame(() => {
        if (document.contains(focusReturnTarget) && typeof focusReturnTarget.focus === "function") {
          focusReturnTarget.focus({ preventScroll: true });
        }
      });
    } else if (shouldFocusWindow) {
      window.requestAnimationFrame(() => {
        const focusTarget = routeWindowFocusTarget(nextRoute);
        if (focusTarget && typeof focusTarget.focus === "function") {
          focusTarget.focus({ preventScroll: true });
        }
      });
    }
    window.requestAnimationFrame(() => {
      const activeElement = document.activeElement;
      const hadInteractiveFocus = activeElement instanceof Element
        && activeElement !== document.body
        && activeElement !== document.documentElement;
      if (!hadInteractiveFocus || focusTargetIsVisible(activeElement)) {
        return;
      }
      const fallbackTarget = nextRoute === "home"
        ? routeReturnTarget(previousRoute, "window-close") || document.querySelector(".start-button")
        : routeWindowFocusTarget(nextRoute);
      fallbackTarget?.focus?.({ preventScroll: true });
    });
    if (nextRoute === "home") {
      window.requestAnimationFrame(captureRouteIconRects);
    }
  };

  if (options.motion === false || !window.LusuUiMotion?.run) {
    commitNavigation();
    return;
  }

  const isDesktopShell = document.documentElement.dataset.uiShell !== "mobile";
  const keepsDesktopChromeLive = isDesktopShell && (
    motionKind === "app-open"
    || motionKind === "route" && nextRoute === "home"
  );

  window.LusuUiMotion.run(motionKind, {
    route: nextRoute,
    trigger: options.trigger || null,
    originRect: exitOriginRect,
    deferCommit: isExitMotion,
    useViewTransition: ["route", "app-open", "mobile-tab"].includes(motionKind)
      && !keepsDesktopChromeLive
  }, commitNavigation).catch(() => {
    commitNavigation();
  });
}

function updateNavigationState(route) {
  document.querySelectorAll(".taskbar-tabs button[data-route], .start-button[data-route], .mobile-home-button[data-route]").forEach((button) => {
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
  navigate(parsed.route, { updateUrl: false, articleSlug: parsed.articleSlug || "" });
  if (parsed.route === "knowledge") {
    closeWelcome({ restoreFocus: false });
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
    updateArticleWindowButton();
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
  updateArticleWindowButton();
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
    renderListMessage(list, t("articleLoadFailed"), {
      label: t("articleRetryAction"),
      dataset: { articleRetry: "" }
    });
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
    renderListMessage(list, t("articleSearchNoResults"), {
      label: t("articleSearchReset"),
      dataset: { articleSearchReset: "" }
    });
    return;
  }

  list.replaceChildren(...items.map((item) => articleCardElement(item)));
}

function renderListMessage(list, message, action = null) {
  const note = document.createElement("p");
  note.className = "loading-text";
  note.textContent = message;
  markStatusMessage(note);
  if (!action) {
    list.replaceChildren(note);
    return;
  }
  const button = document.createElement("button");
  button.type = "button";
  button.className = "xp-button";
  button.textContent = action.label;
  Object.entries(action.dataset || {}).forEach(([key, value]) => {
    button.dataset[key] = value;
  });
  list.replaceChildren(note, button);
}

function markStatusMessage(node) {
  node.setAttribute("role", "status");
  node.setAttribute("aria-live", "polite");
  node.setAttribute("aria-atomic", "true");
}

function articleCardElement(item) {
  const card = document.createElement("article");
  card.className = "article-card";
  const titleText = item.title || "";

  const title = document.createElement("h3");
  title.textContent = titleText;
  const summary = document.createElement("p");
  summary.textContent = item.summary || "";

  const meta = document.createElement("div");
  meta.className = "meta-row";
  const category = document.createElement("span");
  category.textContent = `${t("articleCategory")}: ${articleCategoryName(item.category || "note")}`;
  meta.appendChild(category);
  (item.tags || []).forEach((tag) => {
    const tagNode = document.createElement("span");
    tagNode.className = "tag";
    tagNode.textContent = articleTagName(tag);
    meta.appendChild(tagNode);
  });
  const published = document.createElement("span");
  published.textContent = `${t("articlePublished")}: ${formatArticleDate(item.published_at || item.created_at)}`;
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
  if (titleText) {
    const actionLabel = `${t("readButton")}: ${titleText}`;
    action.setAttribute("aria-label", actionLabel);
    action.setAttribute("title", actionLabel);
  }

  card.append(title, summary, meta, action);
  return card;
}

function renderKnowledgeSearchControls(count, total) {
  const input = document.getElementById("knowledge-search-input");
  const clearButton = document.querySelector("[data-article-search-clear]");
  const searchBar = document.getElementById("knowledge-searchbar");
  const status = document.getElementById("knowledge-search-status");
  const setSearchStatus = (value) => {
    if (!status) {
      return;
    }
    status.textContent = value;
    searchBar?.classList.toggle("has-search-status", Boolean(value));
  };
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
    setSearchStatus("");
    return;
  }
  if (!articleState.searchTerm.trim()) {
    setSearchStatus("");
    return;
  }
  setSearchStatus(t("articleSearchFiltered")
    .replace("{count}", String(count))
    .replace("{total}", String(total)));
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
  const counts = new Map(categories.map((category) => [String(category), 0]));
  articleState.articles.forEach((item) => {
    const key = String(item.category || "");
    if (counts.has(key)) {
      counts.set(key, counts.get(key) + 1);
    }
  });

  const buttons = ["all", ...categories].map((category) => {
    const value = String(category);
    const active = activeFilters.knowledge === value;
    const countValue = value === "all" ? articleState.articles.length : counts.get(value) || 0;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `${active ? "active " : ""}category-button`;
    button.dataset.filterType = "knowledge";
    button.dataset.filter = value;
    const labelText = articleCategoryName(value);
    button.title = labelText;
    button.setAttribute("aria-label", `${labelText} ${countValue}`);
    button.setAttribute("aria-pressed", String(active));
    const labelNode = document.createElement("span");
    labelNode.textContent = labelText;
    const countNode = document.createElement("span");
    countNode.className = "filter-count";
    countNode.textContent = String(countValue);
    button.append(labelNode, countNode);
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
    articleState.detailCache.clear();
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
  syncDocumentMeta();
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
    if (articleState.currentSlug === slug && requestId === articleState.detailRequestId) {
      renderArticleDetailFailure(slug);
    }
  } finally {
    if (requestId === articleState.detailRequestId) {
      articleState.detailLoadingKey = "";
    }
  }
}

function renderArticleDetailFailure(slug) {
  const title = document.getElementById("article-detail-title");
  const summary = document.getElementById("article-detail-summary");
  const meta = document.getElementById("article-detail-meta");
  const body = document.getElementById("article-detail-body");

  clearArticleCopyStatus();
  syncDocumentMeta();
  resetArticleReadProgress();
  resetArticleToc();
  title.textContent = t("articleLoadFailed");
  summary.textContent = "";
  meta.replaceChildren();

  const note = document.createElement("p");
  note.className = "loading-text";
  note.textContent = t("articleLoadFailed");
  markStatusMessage(note);
  const action = document.createElement("button");
  action.type = "button";
  action.className = "xp-button";
  action.dataset.articleDetailRetry = slug;
  action.textContent = t("articleRetryAction");
  body.replaceChildren(note, action);
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
    { text: `${t("articleCategory")}: ${articleCategoryName(article.category || "note")}`, className: "article-meta-item article-meta-category" },
    { text: `${t("articlePublished")}: ${formatArticleDate(article.published_at || article.created_at)}`, className: "article-meta-item article-meta-published" },
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
  syncArticleDocumentMeta(article);
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
    heading.tabIndex = -1;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `article-toc-link level-${heading.tagName === "H3" ? "3" : "2"}`;
    if (itemIndex === 0) {
      button.classList.add("is-active");
      button.setAttribute("aria-current", "location");
    }
    button.dataset.articleHeadingTarget = id;
    button.setAttribute("aria-controls", id);
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
    const active = button.dataset.articleHeadingTarget === activeId;
    button.classList.toggle("is-active", active);
    if (active) {
      button.setAttribute("aria-current", "location");
    } else {
      button.removeAttribute("aria-current");
    }
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
  heading.scrollIntoView({ block: "start", behavior: motionScrollBehavior() });
  heading.focus({ preventScroll: true });
  updateArticleTocActive();
  scheduleArticleReadProgressUpdate();
}

function scrollArticleToTop() {
  const detail = document.getElementById("article-detail");
  if (!detail || detail.hidden) {
    return;
  }
  detail.scrollTo({ top: 0, behavior: motionScrollBehavior() });
  scheduleArticleReadProgressUpdate();
}

function motionScrollBehavior() {
  const managedMode = window.LusuUiMotion?.getMode?.() || document.documentElement.dataset.motion;
  if (managedMode === "reduced" || managedMode === "off") {
    return "auto";
  }
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

function runWindowLayoutTransition(kind, target, commit) {
  let committed = false;
  const commitOnce = () => {
    if (committed) {
      return;
    }
    committed = true;
    commit();
  };
  if (!window.LusuUiMotion?.run) {
    commitOnce();
    return;
  }
  window.LusuUiMotion.run(kind, { target }, commitOnce).catch(commitOnce);
}

function updateArticleWindowButton() {
  const button = document.querySelector("[data-article-window-toggle]");
  if (!button) {
    return;
  }
  const reading = document.body.classList.contains("is-article-reading");
  const restored = document.body.classList.contains("is-article-window-restored");
  const actionLabel = t(restored ? "windowMaximizeAria" : "windowRestoreAria");
  button.hidden = !reading;
  button.setAttribute("aria-pressed", String(!restored));
  button.setAttribute("aria-label", actionLabel);
  button.setAttribute("title", actionLabel);
}

function toggleArticleWindowSize() {
  if (!document.body.classList.contains("is-article-reading")) {
    return;
  }
  const nextRestored = !document.body.classList.contains("is-article-window-restored");
  const windowSurface = document.querySelector("#knowledge .xp-window");
  runWindowLayoutTransition(nextRestored ? "window-restore" : "window-maximize", windowSurface, () => {
    document.body.classList.toggle("is-article-window-restored", nextRestored);
    updateArticleWindowButton();
  });
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

function showArticle(slug, options = {}) {
  articleState.currentSlug = slug;
  articleState.currentArticle = null;
  articleState.detailLoadingKey = "";
  navigate("knowledge", { articleSlug: slug, trigger: options.trigger, focusWindow: true });
  closeWelcome({ restoreFocus: false, motion: false });
  renderKnowledge();
}

function showArticleList(options = {}) {
  articleState.currentSlug = "";
  articleState.currentArticle = null;
  articleState.detailLoadingKey = "";
  resetArticleReadProgress();
  resetArticleToc();
  navigate("knowledge", { trigger: options.trigger, focusWindow: true });
  renderKnowledge();
}

function showArticleCategory(category, options = {}) {
  activeFilters.knowledge = category;
  articleState.currentSlug = "";
  articleState.currentArticle = null;
  articleState.detailLoadingKey = "";
  navigate("knowledge", { trigger: options.trigger });
  closeWelcome({ restoreFocus: false, motion: false });
  renderKnowledge();
}

async function articleApi(path) {
  const response = await fetch(path, { cache: "no-store", headers: { "Accept": "application/json" } });
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
  icon.className = `video-empty-icon${kind === "failed" ? " is-error" : ""}`;
  icon.setAttribute("aria-hidden", "true");

  const copy = document.createElement("div");
  copy.className = "video-empty-copy";
  markStatusMessage(copy);
  const title = document.createElement("h3");
  title.textContent = videoUiText(kind);

  copy.appendChild(title);
  state.append(icon, copy);
  if (kind === "failed") {
    const action = document.createElement("button");
    action.type = "button";
    action.className = "xp-button";
    action.dataset.videoRetry = "";
    action.textContent = videoUiText("retryAction");
    state.appendChild(action);
  }
  return state;
}

function renderVideoEmptyState(isFiltered = false) {
  const state = document.createElement("article");
  state.className = "video-empty-state";

  const icon = document.createElement("span");
  icon.className = "video-empty-icon";
  icon.setAttribute("aria-hidden", "true");

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
  const counts = new Map(videoState.categories.map((category) => [category.category_id, 0]));
  videoState.videos.forEach((item) => {
    (item.categories || []).forEach((category) => {
      const key = category.category_id;
      if (counts.has(key)) {
        counts.set(key, counts.get(key) + 1);
      }
    });
  });

  const categories = [{ category_id: "all", name: t("all") }, ...videoState.categories];
  categories.forEach((category) => {
    const button = document.createElement("button");
    const name = category.name || category.name_zh || category.slug || t("all");
    const countValue = category.category_id === "all" ? videoState.videos.length : counts.get(category.category_id) || 0;
    button.type = "button";
    button.dataset.filterType = "videos";
    button.dataset.filter = category.category_id;
    button.title = name;
    button.setAttribute("aria-label", `${name} ${countValue}`);
    const active = activeFilters.videos === category.category_id;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
    const labelNode = document.createElement("span");
    labelNode.textContent = name;
    const countNode = document.createElement("span");
    countNode.className = "filter-count";
    countNode.textContent = String(countValue);
    button.append(labelNode, countNode);
    target.appendChild(button);
  });
}

function videoCardElement(item) {
  const card = document.createElement("article");
  card.className = "video-card";
  const videoTitleText = item.title || videoUiText("untitled");
  const videoPlayLabel = `${videoUiText("playAria")}: ${videoTitleText}`;

  const thumb = document.createElement("button");
  thumb.type = "button";
  thumb.className = "video-thumb";
  thumb.dataset.videoId = item.video_id;
  thumb.setAttribute("aria-label", videoPlayLabel);
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
  title.textContent = videoTitleText;
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
  button.setAttribute("aria-label", videoPlayLabel);
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
    retryAction: { zh: "重新读取视频", en: "Retry loading videos", ja: "動画を再読み込み" },
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
    return item.external === true ? safeTrustedExternalUrl(value, trustedResourceExternalHosts) : "";
  }
  const localPath = value.replace(/^\/+/, "").replace(/^\.\//, "");
  if (/(^|\/)\.\.(\/|$)/.test(localPath)) {
    return "";
  }
  if (/^tools\/japanese-subtext\/?$/i.test(localPath)) {
    return sitePath("tools/japanese-subtext/");
  }
  if (/^(assets|downloads)\/[a-z0-9][a-z0-9._/-]*(\?[a-z0-9=&._-]+)?$/i.test(localPath)) {
    return sitePath(localPath);
  }
  return "";
}

function resourceActionElement(item, url = safeResourceUrl(item)) {
  const internalAction = item.action === "quick-transfer";
  const available = Boolean(url || internalAction);
  const resourceTitle = available ? localText(item.title) : contentTitle(item.title);
  const customLabel = localText(item.actionLabel).trim();
  const text = available
    ? customLabel || (item.external ? t("externalButton") : t("downloadButton"))
    : t("resourcePending");
  if (!available) {
    const status = document.createElement("span");
    status.className = "card-action resource-pending-action";
    status.setAttribute("role", "status");
    status.setAttribute("aria-label", `${t("resourcePendingTitle")}: ${resourceTitle}`);
    status.setAttribute("title", t("resourcePendingTitle"));
    status.textContent = text;
    return status;
  }
  if (internalAction) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "card-action";
    button.dataset.quickTransferOpen = "true";
    button.textContent = text;
    button.setAttribute("aria-label", `${text}: ${resourceTitle}`);
    return button;
  }
  const link = document.createElement("a");
  link.className = "card-action";
  link.href = url;
  link.textContent = text;
  link.setAttribute("aria-label", `${text}: ${resourceTitle}`);
  if (item.external || /^https?:\/\//i.test(url)) {
    link.target = "_blank";
    link.rel = "noreferrer noopener";
  }
  return link;
}

function resourceStatusElement(url, title) {
  const status = document.createElement("span");
  status.className = `tag resource-status-tag ${url ? "is-ready" : "is-pending"}`;
  const text = url ? t("resourceStatusReady") : t("resourcePending");
  status.textContent = text;
  status.setAttribute("aria-label", `${text}: ${title}`);
  status.setAttribute("title", `${text}: ${title}`);
  return status;
}

function resourceEmptyStateElement({ hasAnyReady = true } = {}) {
  const state = document.createElement("div");
  state.className = "resource-empty-state";

  const icon = document.createElement("span");
  icon.className = "resource-empty-icon";
  icon.setAttribute("aria-hidden", "true");

  const copy = document.createElement("div");
  copy.className = "resource-empty-copy";
  const title = document.createElement("h3");
  title.textContent = hasAnyReady ? t("resourceEmptyTitle") : t("resourceEmptyAllTitle");
  const body = document.createElement("p");
  body.textContent = hasAnyReady ? t("resourceEmptyBody") : t("resourceEmptyAllBody");
  copy.append(title, body);

  const action = document.createElement("button");
  action.type = "button";
  action.className = "xp-button";
  if (hasAnyReady) {
    action.dataset.resourceShowAll = "true";
    action.textContent = t("resourceEmptyAction");
  } else {
    action.dataset.route = "knowledge";
    action.textContent = t("resourceEmptyAllAction");
  }

  state.append(icon, copy, action);
  return state;
}

function readyResourceItems() {
  return content.resources.filter((item) => safeResourceUrl(item) || item.action === "quick-transfer");
}

function resourceCardElement(item) {
  const card = document.createElement("article");
  card.className = "resource-card";
  const resourceUrl = safeResourceUrl(item);
  const resourceAvailable = Boolean(resourceUrl || item.action === "quick-transfer");

  const main = document.createElement("div");
  main.className = "resource-main";

  const title = document.createElement("h3");
  const resourceIconSrc = safeResourceIconSrc(item.iconSrc);
  const icon = resourceIconSrc ? document.createElement("img") : document.createElement("span");
  icon.className = resourceIconSrc
    ? "resource-icon-image"
    : item.iconSprite === "app" ? "resource-icon transfer-icon transfer-icon-app" : "resource-icon";
  icon.setAttribute("aria-hidden", "true");
  if (resourceIconSrc) {
    icon.src = resourceIconSrc;
    icon.width = 40;
    icon.height = 40;
    icon.alt = "";
    icon.loading = "lazy";
    icon.decoding = "async";
  } else {
    icon.textContent = String(item.icon || "");
  }
  const resourceTitle = resourceAvailable ? localText(item.title) : contentTitle(item.title);
  title.append(icon, document.createTextNode(resourceTitle));

  const desc = document.createElement("p");
  desc.textContent = localText(item.desc);

  const meta = document.createElement("div");
  meta.className = "meta-row";
  const metaItems = [
    `${label("type")}: ${label("resourceCategories")[item.category] || ""}`
  ];
  if (resourceAvailable) {
    if (item.version) metaItems.push(`${label("version")}: ${item.version}`);
    if (item.size) metaItems.push(`${label("size")}: ${item.size}`);
    if (item.updated) metaItems.push(`${label("updated")}: ${item.updated}`);
  }
  metaItems.forEach((text) => {
    const itemNode = document.createElement("span");
    itemNode.textContent = text;
    meta.appendChild(itemNode);
  });
  (Array.isArray(item.tags) ? item.tags : []).slice(0, 6).forEach((tag) => {
    const tagNode = document.createElement("span");
    tagNode.className = "tag";
    tagNode.textContent = localText(tag);
    meta.appendChild(tagNode);
  });
  if (item.showReadyStatus !== false) meta.appendChild(resourceStatusElement(resourceAvailable, resourceTitle));

  main.append(title, desc, meta);
  card.append(main, resourceActionElement(item, resourceUrl));
  return card;
}

function renderResourceCategoryButtons(items = readyResourceItems()) {
  const target = document.getElementById("resource-categories");
  const categories = label("resourceCategories");
  const counts = new Map(categories.map((_, index) => [String(index), 0]));
  items.forEach((item) => {
    const key = String(item.category);
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  const entries = [
    { name: t("all"), value: "all", count: items.length },
    ...categories.map((name, index) => ({
      name,
      value: String(index),
      count: counts.get(String(index)) || 0
    })).filter((entry) => entry.count > 0 || activeFilters.resources === entry.value)
  ];

  const buttons = entries.map((entry) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.filterType = "resources";
    button.dataset.filter = entry.value;
    button.classList.toggle("active", activeFilters.resources === entry.value);
    button.setAttribute("aria-pressed", String(activeFilters.resources === entry.value));
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
  const list = document.getElementById("resource-list");
  const readyItems = readyResourceItems();
  if (activeFilters.resources !== "all" && !readyItems.some((item) => String(item.category) === activeFilters.resources)) {
    activeFilters.resources = "all";
  }
  renderResourceCategoryButtons(readyItems);
  const items = readyItems.filter((item) => activeFilters.resources === "all" || String(item.category) === activeFilters.resources);

  list.replaceChildren();
  if (items.length === 0) {
    list.appendChild(resourceEmptyStateElement({ hasAnyReady: readyItems.length > 0 }));
    return;
  }
  items.forEach((item) => list.appendChild(resourceCardElement(item)));
}

async function loadGameCatalog({ forceRefresh = false } = {}) {
  if (gameState.catalog && !forceRefresh) {
    return gameState.catalog;
  }
  if (gameState.pending && !forceRefresh) {
    return gameState.pending;
  }
  const pending = fetch("/games/catalog.json", { cache: "no-store" }).then(async (response) => {
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const catalog = await response.json();
    if (!Array.isArray(catalog.games)) {
      throw new Error("Invalid games catalog");
    }
    gameState.catalog = catalog;
    return catalog;
  });
  gameState.pending = pending;
  try {
    return await pending;
  } finally {
    if (gameState.pending === pending) {
      gameState.pending = null;
    }
  }
}

async function renderGames({ forceRefresh = false } = {}) {
  const list = document.getElementById("game-list");
  if (gameState.catalog && !forceRefresh) {
    renderGameCatalog(list, gameState.catalog);
    return;
  }
  const loading = document.createElement("p");
  loading.className = "loading-text";
  loading.textContent = t("gameConfigLoading");
  markStatusMessage(loading);
  list.replaceChildren(loading);
  try {
    const catalog = await loadGameCatalog({ forceRefresh });
    renderGameCatalog(list, catalog);
  } catch (error) {
    const failed = document.createElement("p");
    failed.className = "loading-text";
    failed.textContent = `${t("gameConfigFailed")}: ${error.message}`;
    markStatusMessage(failed);
    const action = document.createElement("button");
    action.type = "button";
    action.className = "xp-button";
    action.dataset.gameRetry = "";
    action.textContent = t("gameRetryAction");
    list.replaceChildren(failed, action);
  }
}

function renderGameCatalog(list, catalog) {
  if (!Array.isArray(catalog.games)) {
    throw new Error("Invalid games catalog");
  }
  list.replaceChildren();
  if (!catalog.games.length) {
    list.appendChild(renderGameEmptyState());
    return;
  }
  catalog.games.forEach((item) => list.appendChild(gameCardElement(item)));
}

function renderGameEmptyState() {
  const state = document.createElement("article");
  state.className = "game-empty-state";

  const icon = document.createElement("span");
  icon.className = "game-empty-icon";
  icon.setAttribute("aria-hidden", "true");

  const copy = document.createElement("div");
  copy.className = "game-empty-copy";
  markStatusMessage(copy);
  const title = document.createElement("h3");
  title.textContent = t("gameEmptyTitle");
  const body = document.createElement("p");
  body.textContent = t("gameEmptyBody");
  copy.append(title, body);

  const action = document.createElement("button");
  action.type = "button";
  action.className = "xp-button";
  action.dataset.gameRetry = "";
  action.textContent = t("gameRetryAction");

  state.append(icon, copy, action);
  return state;
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
    save.setAttribute("aria-label", `${titleText}: ${t("gameCloudSaveReady")}`);
    save.setAttribute("title", `${titleText}: ${t("gameCloudSaveReady")}`);
    meta.appendChild(save);
  }
  const repoUrl = safeGithubUrl(item.repo);
  if (repoUrl) {
    const source = document.createElement("a");
    source.className = "tag game-source-link";
    source.href = repoUrl;
    source.target = "_blank";
    source.rel = "noreferrer noopener";
    source.setAttribute("aria-label", `${t("gameSourceLabel")}: ${titleText}`);
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
  action.setAttribute("aria-label", `${action.textContent}: ${titleText}`);

  card.append(cover, main, action);
  return card;
}

function blogCardElement(item) {
  const card = document.createElement("article");
  card.className = "blog-card";
  const titleText = contentTitle(item.title);

  const title = document.createElement("h3");
  title.textContent = titleText;

  const desc = document.createElement("p");
  desc.textContent = localText(item.desc);

  const meta = document.createElement("div");
  meta.className = "meta-row";
  const date = document.createElement("span");
  date.textContent = `${label("date")}: ${item.date || ""}`;
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
  action.setAttribute("aria-disabled", "true");
  action.setAttribute("aria-label", `${t("blogPending")}: ${titleText}`);
  action.setAttribute("title", `${t("blogPending")}: ${titleText}`);
  action.textContent = t("blogPending");

  card.append(title, desc, meta, action);
  return card;
}

function blogEmptyStateElement() {
  const state = document.createElement("article");
  state.className = "resource-empty-state blog-empty-state";

  const icon = document.createElement("span");
  icon.className = "resource-empty-icon blog-empty-icon";
  icon.setAttribute("aria-hidden", "true");

  const copy = document.createElement("div");
  copy.className = "resource-empty-copy";
  const title = document.createElement("h3");
  title.textContent = t("blogEmptyTitle");
  const body = document.createElement("p");
  body.textContent = t("blogEmptyBody");
  copy.append(title, body);

  const action = document.createElement("button");
  action.type = "button";
  action.className = "xp-button";
  action.dataset.route = "knowledge";
  action.textContent = t("blogEmptyAction");

  state.append(icon, copy, action);
  return state;
}

function publishedBlogItems() {
  return content.blog.filter((item) => item.published === true || item.url || item.content);
}

function renderBlog() {
  const list = document.getElementById("blog-list");
  list.replaceChildren();
  const items = publishedBlogItems();
  if (!items.length) {
    list.appendChild(blogEmptyStateElement());
    return;
  }
  items.forEach((item) => list.appendChild(blogCardElement(item)));
}

function renderUpdates() {
  const list = document.getElementById("recent-updates");
  const updateArticles = siteUpdateArticles().length
    ? siteUpdateArticles().slice(0, 5)
    : visibleLocalUpdates().slice(0, 5);
  if (!updateArticles.length) {
    const emptyItem = document.createElement("li");
    const icon = document.createElement("span");
    icon.className = "update-icon update-icon-knowledge";
    icon.setAttribute("aria-hidden", "true");
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
  if (item.slug && !item.fallbackOnly) {
    link.href = articleRouteHref(item.slug);
    link.dataset.articleSlug = item.slug;
  } else {
    link.href = "/#knowledge";
  }

  const icon = document.createElement("span");
  icon.className = `update-icon ${recentUpdateIconClass(item)}`;
  icon.setAttribute("aria-hidden", "true");

  const copy = document.createElement("span");
  const title = document.createElement("strong");
  const fullTitle = localText(item.title);
  const fullSummary = localText(item.summary) || localText(item.desc) || "";
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

function recentUpdateIconClass(item) {
  return item?.category === siteUpdateCategory || item?.icon === "system"
    ? "update-icon-system"
    : "update-icon-knowledge";
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
  cancelSurfaceClose(modal);
  frame.replaceChildren();
  if (!video) {
    window.lusuTrackClick?.("video:play-failed", "video not found", { route: "videos" });
    return;
  }
  modalFocusState.videoTrigger = document.activeElement && !modal.contains(document.activeElement)
    ? document.activeElement
    : null;
  const videoTitle = localText(video.title) || "Video Player";
  document.getElementById("modal-title").textContent = videoTitle;
  if (sourceLink) {
    const originalUrl = safeVideoSourceUrl(video.original_url || video.url || "");
    if (originalUrl) {
      const sourceLabel = `${t("openOriginal")}: ${videoTitle}`;
      sourceLink.href = originalUrl;
      sourceLink.target = "_blank";
      sourceLink.rel = "noreferrer noopener";
      sourceLink.setAttribute("aria-label", sourceLabel);
      sourceLink.setAttribute("title", sourceLabel);
      sourceLink.hidden = false;
    } else {
      sourceLink.hidden = true;
      sourceLink.removeAttribute("href");
      sourceLink.removeAttribute("aria-label");
      sourceLink.removeAttribute("title");
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
    icon.className = "video-placeholder-asset";
    icon.setAttribute("aria-hidden", "true");
    const text = document.createElement("p");
    text.textContent = video.metadata_error || videoUiText("unsupported");
    placeholder.append(icon, text);
    frame.appendChild(placeholder);
    window.lusuTrackClick?.("video:play-failed", video.video_id || video.external_id || "video", { route: "videos" });
  }
  modal.hidden = false;
  setVideoWindowMaximized(false);
  modal.querySelector("button[data-close-modal]")?.focus({ preventScroll: true });
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
  const nextMaximized = !videoWindowState.maximized;
  const modal = document.getElementById("video-modal");
  const windowSurface = modal?.querySelector(".xp-window") || modal;
  runWindowLayoutTransition(nextMaximized ? "window-maximize" : "window-restore", windowSurface, () => {
    setVideoWindowMaximized(nextMaximized);
  });
}

function restoreModalFocus(key) {
  const target = modalFocusState[key];
  modalFocusState[key] = null;
  if (target && document.contains(target) && typeof target.focus === "function") {
    target.focus({ preventScroll: true });
  }
}

const surfaceCloseRequests = new WeakMap();

function surfaceMotionTarget(surface) {
  return surface?.querySelector?.(".xp-window") || surface || null;
}

function cancelSurfaceClose(surface) {
  if (!surface) {
    return;
  }
  surfaceCloseRequests.delete(surface);
  surface.removeAttribute("data-ui-closing");
  const target = surfaceMotionTarget(surface);
  target?.getAnimations?.().forEach((animation) => animation.cancel());
}

function runSurfaceClose(surface, options, commit) {
  if (!surface || typeof commit !== "function") {
    commit?.();
    return;
  }
  if (surface.getAttribute("data-ui-closing") === "true") {
    return;
  }
  const request = {};
  const origin = options?.origin instanceof Element ? options.origin : null;
  const commitOnce = () => {
    if (surfaceCloseRequests.get(surface) !== request) {
      return;
    }
    surfaceCloseRequests.delete(surface);
    surface.removeAttribute("data-ui-closing");
    commit();
  };
  surfaceCloseRequests.set(surface, request);
  surface.setAttribute("data-ui-closing", "true");
  if (options?.motion === false || !window.LusuUiMotion?.run) {
    commitOnce();
    return;
  }
  window.LusuUiMotion.run("modal-close", {
    target: surfaceMotionTarget(surface),
    originRect: origin?.getBoundingClientRect() || null,
    deferCommit: true
  }, commitOnce).catch(commitOnce);
}

function closeVideo(options = {}) {
  const modal = document.getElementById("video-modal");
  const wasOpen = modal && !modal.hidden;
  const finalizeClose = () => {
    setVideoWindowMaximized(false);
    if (modal) {
      modal.hidden = true;
    }
    const frame = document.getElementById("video-frame");
    const sourceLink = document.getElementById("video-link");
    frame.replaceChildren();
    if (sourceLink) {
      sourceLink.hidden = true;
      sourceLink.removeAttribute("href");
      sourceLink.removeAttribute("aria-label");
      sourceLink.removeAttribute("title");
    }
    const placeholder = document.createElement("div");
    placeholder.className = "video-placeholder";
    const icon = document.createElement("span");
    icon.className = "video-placeholder-asset";
    icon.setAttribute("aria-hidden", "true");
    const text = document.createElement("p");
    text.textContent = t("videoPlaceholder");
    placeholder.append(icon, text);
    frame.appendChild(placeholder);
    if (wasOpen && options.restoreFocus !== false) {
      restoreModalFocus("videoTrigger");
    }
  };
  if (!wasOpen) {
    finalizeClose();
    return;
  }
  runSurfaceClose(modal, {
    motion: options.motion,
    origin: modalFocusState.videoTrigger
  }, finalizeClose);
}

function closeWelcome(options = {}) {
  const modal = document.getElementById("welcome-modal");
  const wasOpen = modal && !modal.hidden;
  const finalizeClose = () => {
    if (modal) {
      modal.hidden = true;
    }
    if (wasOpen && options.restoreFocus !== false) {
      restoreModalFocus("welcomeTrigger");
    }
  };
  if (!wasOpen) {
    finalizeClose();
    return;
  }
  runSurfaceClose(modal, {
    motion: options.motion,
    origin: modalFocusState.welcomeTrigger
  }, finalizeClose);
}

function focusableDialogElements(dialog) {
  return [...dialog.querySelectorAll([
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "iframe",
    "[tabindex]:not([tabindex='-1'])"
  ].join(","))].filter((element) => {
    if (element.hidden || element.getAttribute("aria-hidden") === "true") {
      return false;
    }
    const rects = element.getClientRects();
    return rects.length > 0;
  });
}

function activeModalDialog() {
  const videoModal = document.getElementById("video-modal");
  if (videoModal && !videoModal.hidden) {
    return videoModal.querySelector("[role='dialog']");
  }
  const welcomeModal = document.getElementById("welcome-modal");
  if (welcomeModal && !welcomeModal.hidden) {
    return welcomeModal.querySelector("[role='dialog']");
  }
  return null;
}

function trapDialogFocus(event) {
  if (event.key !== "Tab") {
    return false;
  }
  const dialog = activeModalDialog();
  if (!dialog) {
    return false;
  }
  const focusable = focusableDialogElements(dialog);
  if (!focusable.length) {
    event.preventDefault();
    dialog.focus?.({ preventScroll: true });
    return true;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;
  if (!dialog.contains(active)) {
    event.preventDefault();
    first.focus({ preventScroll: true });
    return true;
  }
  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus({ preventScroll: true });
    return true;
  }
  if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus({ preventScroll: true });
    return true;
  }
  return false;
}

const wallpaperMotionMedia = typeof window.matchMedia === "function"
  ? window.matchMedia("(prefers-reduced-motion: reduce)")
  : null;
const wallpaperPreviewTheme = ["morning", "day", "dusk", "night"].includes(pageParams.get("wallpaper"))
  ? pageParams.get("wallpaper")
  : "";
let renderedHomeTimeTheme = "";

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
  const managedMode = document.documentElement.dataset.motion;
  root.dataset.motion = ["full", "reduced", "off"].includes(managedMode)
    ? managedMode
    : wallpaperMotionMedia?.matches ? "reduced" : "full";
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
  if (theme === renderedHomeTimeTheme) {
    return;
  }

  const applyTheme = () => {
    renderedHomeTimeTheme = theme;
    home.dataset.timeTheme = theme;
    document.body.dataset.timeTheme = theme;
    if (root) {
      root.dataset.time = theme;
    }
    layoutWallpaperStage();
    updateWallpaperMotionState();
  };

  if (renderedHomeTimeTheme && window.LusuUiMotion?.run) {
    window.LusuUiMotion.run("theme", { theme, useViewTransition: true }, applyTheme).catch(applyTheme);
    return;
  }
  applyTheme();
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
  if (!forceWelcome && safeStorageGet(key) === "1") {
    return;
  }
  updateWelcomeGreeting();
  const modal = document.getElementById("welcome-modal");
  modalFocusState.welcomeTrigger = document.activeElement && !modal?.contains(document.activeElement)
    ? document.activeElement
    : null;
  if (modal) {
    cancelSurfaceClose(modal);
    modal.hidden = false;
    modal.querySelector("button[data-close-welcome]")?.focus({ preventScroll: true });
  }
  safeStorageSet(key, "1");
}

const fullClockFormatter = new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
const compactClockFormatter = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });

function updateClock() {
  const now = new Date();
  const fullTime = fullClockFormatter.format(now).replace(/\//g, ".");
  const compactTime = compactClockFormatter.format(now);
  document.querySelectorAll("[data-local-time]").forEach((node) => {
    node.textContent = node.dataset.localTime === "compact" ? compactTime : fullTime;
    if (node.tagName === "TIME") {
      node.setAttribute("datetime", now.toISOString());
    }
  });
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
  toggle.dataset.analyticsLabel = authUser ? "account:signed-in-toggle" : "account:login-toggle";
  toggle.setAttribute("aria-controls", "account-popover");
  toggle.setAttribute("aria-expanded", "false");
  const toggleText = document.createElement("span");
  toggleText.textContent = authUser
    ? t("accountTitle")
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
  form.dataset.accountMode = "login";
  const title = document.createElement("strong");
  title.textContent = t("accountTitle");
  const emailInput = document.createElement("input");
  emailInput.name = "email";
  emailInput.type = "email";
  emailInput.autocomplete = "email";
  emailInput.placeholder = t("accountEmailPlaceholder");
  emailInput.setAttribute("aria-label", t("accountEmailLabel"));
  emailInput.required = true;
  const passwordInput = document.createElement("input");
  passwordInput.name = "password";
  passwordInput.type = "password";
  passwordInput.autocomplete = "current-password";
  passwordInput.placeholder = t("accountPasswordPlaceholder");
  passwordInput.setAttribute("aria-label", t("accountPasswordLabel"));
  passwordInput.required = true;
  const actions = document.createElement("div");
  actions.className = "account-actions";
  const loginButton = document.createElement("button");
  loginButton.className = "account-button";
  loginButton.type = "submit";
  loginButton.dataset.accountMode = "login";
  loginButton.textContent = t("accountLogin");
  const registerButton = document.createElement("button");
  registerButton.className = "account-button";
  registerButton.type = "submit";
  registerButton.dataset.accountMode = "register";
  registerButton.textContent = t("accountRegister");
  [loginButton, registerButton].forEach((button) => {
    button.addEventListener("click", () => {
      form.dataset.accountMode = button.dataset.accountMode || "login";
    });
  });
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
  if (accountSubmitting) {
    return;
  }
  const form = event.currentTarget;
  const mode = event.submitter?.dataset.accountMode || form.dataset.accountMode || "login";
  setAccountSubmitting(true);
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
    window.dispatchEvent(new CustomEvent("lusu:accountchange", { detail: { signedIn: true } }));
  } catch (error) {
    renderAccountWidget(error.message);
    openAccountPopover();
  } finally {
    accountSubmitting = false;
  }
}

async function logoutAccount() {
  if (accountSubmitting) {
    return;
  }
  setAccountSubmitting(true);
  try {
    await accountApi("/api/auth/logout", { method: "POST", body: "{}" });
  } catch {
    // Keep the UI responsive even if the network is gone.
  }
  authUser = null;
  renderAccountWidget(t("accountLoggedOut"));
  openAccountPopover();
  window.dispatchEvent(new CustomEvent("lusu:accountchange", { detail: { signedIn: false } }));
  accountSubmitting = false;
}

function setAccountSubmitting(isSubmitting) {
  accountSubmitting = isSubmitting;
  const form = document.getElementById("account-form");
  if (form) {
    form.setAttribute("aria-busy", String(isSubmitting));
  }
  document.querySelectorAll("#account-widget button:not([data-account-toggle])").forEach((button) => {
    button.disabled = isSubmitting;
  });
}

function openAccountPopover(options = {}) {
  const popover = document.getElementById("account-popover");
  if (popover) {
    if (options.returnFocus instanceof HTMLElement && options.returnFocus.isConnected) {
      accountPopoverReturnFocus = options.returnFocus;
    }
    cancelSurfaceClose(popover);
    popover.hidden = false;
    syncAccountPopoverState(popover);
  }
}

function closeAccountPopover(options = {}) {
  const popover = document.getElementById("account-popover");
  const wasOpen = popover && !popover.hidden;
  if (!popover || !wasOpen) {
    return;
  }
  const toggle = document.querySelector("[data-account-toggle]");
  const returnFocus = accountPopoverReturnFocus?.isConnected ? accountPopoverReturnFocus : toggle;
  runSurfaceClose(popover, {
    motion: options.motion,
    origin: returnFocus
  }, () => {
    popover.hidden = true;
    syncAccountPopoverState(popover);
    accountPopoverReturnFocus = null;
    if (options.restoreFocus !== false && returnFocus && typeof returnFocus.focus === "function") {
      returnFocus.focus({ preventScroll: true });
    } else if (options.restoreFocus !== false && toggle && typeof toggle.focus === "function") {
      toggle.focus({ preventScroll: true });
    }
  });
}

function toggleAccountPopover(trigger = null) {
  const popover = document.getElementById("account-popover");
  if (!popover) {
    return;
  }
  if (popover.hidden) {
    if (trigger instanceof HTMLElement && trigger.isConnected) {
      accountPopoverReturnFocus = trigger;
    }
    openAccountPopover();
  } else {
    closeAccountPopover();
  }
}

function syncAccountPopoverState(popover = document.getElementById("account-popover")) {
  const toggle = document.querySelector("[data-account-toggle]");
  if (!toggle || !popover) {
    return;
  }
  toggle.setAttribute("aria-expanded", String(!popover.hidden));
}

async function ensureChatIdentity() {
  let visitorId = safeStorageGet(chatStorageKeys.visitorId);
  if (!visitorId) {
    visitorId = crypto.randomUUID ? crypto.randomUUID() : `visitor-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    safeStorageSet(chatStorageKeys.visitorId, visitorId);
  }

  let nickname = safeStorageGet(chatStorageKeys.nickname);
  if (!isValidChatNickname(nickname)) {
    nickname = await fetchAvailableChatNickname();
    safeStorageSet(chatStorageKeys.nickname, nickname);
  }

  chatState.visitorId = visitorId;
  chatState.nickname = nickname.trim();
  updateChatNicknameDisplay();
}

async function fetchAvailableChatNickname() {
  try {
    const params = new URLSearchParams({ lang: currentLang });
    appendChatRoomParam(params);
    const payload = await chatApi(`/api/chat/nickname?${params.toString()}`);
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

function isPrivateChatRoomActive() {
  return chatState.roomMode === "private"
    && chatState.roomKey !== chatPublicRoomKey
    && Boolean(chatState.roomCryptoKey);
}

function appendChatRoomParam(params) {
  if (chatState.roomKey && chatState.roomKey !== chatPublicRoomKey) {
    params.set("room", chatState.roomKey);
  }
  return params;
}

function hasChatPrivateCrypto() {
  return Boolean(window.crypto?.subtle && window.crypto?.getRandomValues && window.TextEncoder && window.TextDecoder);
}

function base64UrlEncode(bytes) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function deriveChatPrivateRoom(password) {
  if (!hasChatPrivateCrypto()) {
    throw new Error(t("chatPrivateCryptoUnavailable"));
  }
  const encoder = new TextEncoder();
  const imported = await window.crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derivedBits = await window.crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: encoder.encode(chatPrivateRoomSalt),
      iterations: chatPrivateRoomIterations,
      hash: "SHA-256"
    },
    imported,
    512
  );
  const derived = new Uint8Array(derivedBits);
  const roomKey = `room_${base64UrlEncode(derived.slice(0, 32))}`;
  const roomCryptoKey = await window.crypto.subtle.importKey(
    "raw",
    derived.slice(32, 64),
    "AES-GCM",
    false,
    ["encrypt", "decrypt"]
  );
  return { roomKey, roomCryptoKey };
}

async function encryptChatContent(content) {
  if (!isPrivateChatRoomActive()) {
    return content;
  }
  try {
    const encoder = new TextEncoder();
    const iv = new Uint8Array(12);
    window.crypto.getRandomValues(iv);
    const encrypted = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      chatState.roomCryptoKey,
      encoder.encode(content)
    );
    return `${base64UrlEncode(iv)}.${base64UrlEncode(new Uint8Array(encrypted))}`;
  } catch {
    throw new Error(t("chatEncryptFailed"));
  }
}

async function decryptChatContent(content) {
  const parts = String(content || "").split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1] || !chatState.roomCryptoKey) {
    throw new Error(t("chatDecryptFailed"));
  }
  const decrypted = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64UrlDecode(parts[0]) },
    chatState.roomCryptoKey,
    base64UrlDecode(parts[1])
  );
  return new TextDecoder().decode(decrypted);
}

async function prepareChatMessagesForDisplay(messages) {
  if (!isPrivateChatRoomActive()) {
    return messages;
  }
  const prepared = [];
  for (const message of messages) {
    if (Number(message.encrypted) !== 1) {
      prepared.push(message);
      continue;
    }
    try {
      prepared.push({ ...message, content: await decryptChatContent(message.content) });
    } catch {
      prepared.push({ ...message, content: t("chatDecryptFailed") });
    }
  }
  return prepared;
}

function syncChatRoomUi() {
  const isPrivate = isPrivateChatRoomActive();
  const windowElement = document.querySelector(".chatroom-window");
  const labelElement = document.getElementById("chat-room-label");
  const toggleButton = document.getElementById("chat-room-toggle");
  windowElement?.classList.toggle("is-private-room", isPrivate);
  if (labelElement) {
    labelElement.dataset.i18n = isPrivate ? "chatRoomPrivateLabel" : "chatRoomPublicLabel";
    labelElement.textContent = t(labelElement.dataset.i18n);
  }
  if (toggleButton) {
    toggleButton.dataset.i18n = isPrivate ? "chatSwitchPublicRoom" : "chatEnterPrivateRoom";
    toggleButton.textContent = t(toggleButton.dataset.i18n);
  }
}

function showChatPrivateRoomForm() {
  const form = document.getElementById("chat-private-room-form");
  const input = document.getElementById("chat-private-password");
  if (!hasChatPrivateCrypto()) {
    setChatFeedback(t("chatPrivateCryptoUnavailable"), true);
    return;
  }
  if (form) {
    form.hidden = false;
  }
  input?.focus();
}

function hideChatPrivateRoomForm(options = {}) {
  const form = document.getElementById("chat-private-room-form");
  const input = document.getElementById("chat-private-password");
  const wasOpen = form && !form.hidden;
  if (form) {
    form.hidden = true;
  }
  if (input) {
    input.value = "";
  }
  if (wasOpen && options.restoreFocus !== false) {
    document.getElementById("chat-room-toggle")?.focus({ preventScroll: true });
  }
}

function prepareChatRoomSwitch() {
  if (chatState.pollTimer) {
    window.clearTimeout(chatState.pollTimer);
    chatState.pollTimer = null;
  }
  chatState.loading = false;
  chatState.roomRevision += 1;
}

async function enterChatPrivateRoom(event) {
  event?.preventDefault();
  const input = document.getElementById("chat-private-password");
  const password = String(input?.value || "");
  if (Array.from(password).length < 6) {
    setChatFeedback(t("chatPrivatePasswordTooShort"), true);
    input?.focus();
    return;
  }

  try {
    setChatFeedback(t("chatLoading"));
    const room = await deriveChatPrivateRoom(password);
    prepareChatRoomSwitch();
    chatState.roomKey = room.roomKey;
    chatState.roomCryptoKey = room.roomCryptoKey;
    chatState.roomMode = "private";
    hideChatPrivateRoomForm();
    syncChatRoomUi();
    resetChatLog(t("chatLoading"));
    await refreshChatMessages({ initial: true });
    setChatFeedback(t("chatPrivateRoomReady"));
    scheduleChatPolling(5000);
  } catch (error) {
    setChatFeedback(error.message || t("chatPrivateCryptoUnavailable"), true);
  }
}

async function switchChatPublicRoom() {
  prepareChatRoomSwitch();
  chatState.roomKey = chatPublicRoomKey;
  chatState.roomCryptoKey = null;
  chatState.roomMode = "public";
  hideChatPrivateRoomForm();
  syncChatRoomUi();
  resetChatLog(t("chatLoading"));
  await refreshChatMessages({ initial: true });
  setChatFeedback(t("chatPublicRoomReady"));
  scheduleChatPolling(5000);
}

async function handleChatRoomToggle() {
  if (isPrivateChatRoomActive()) {
    await switchChatPublicRoom();
    return;
  }
  showChatPrivateRoomForm();
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

function setChatSendingState(sending) {
  chatState.sending = sending;
  const form = document.getElementById("chat-form");
  const input = document.getElementById("chat-message-input");
  const button = document.querySelector(".chat-send-button");
  form?.setAttribute("aria-busy", String(sending));
  if (input) {
    input.disabled = sending;
  }
  if (button) {
    button.disabled = sending;
  }
}

function chatSyncStatusText(delay = chatState.pollDelay) {
  if (delay >= 30000) {
    return t("chatSyncStatusSlow");
  }
  if (delay >= 15000) {
    return t("chatSyncStatusIdle");
  }
  return t("chatSyncStatusActive");
}

function updateChatSyncStatus(delay = chatState.pollDelay) {
  const status = document.getElementById("chat-sync-status");
  if (!status) {
    return;
  }
  status.textContent = chatSyncStatusText(delay);
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
  updateChatSyncStatus();
  syncChatRoomUi();

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
  chatState.pollDelay = delay;
  updateChatSyncStatus(delay);
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
  const roomRevision = chatState.roomRevision;
  let appendedCount = 0;
  try {
    const shouldRefreshRecentMessages = !options.initial && chatState.hasLoadedInitial && !chatState.lastMessageId;
    const params = new URLSearchParams({
      limit: String(shouldRefreshRecentMessages ? chatUnanchoredRefreshLimit : chatInitialMessageLimit)
    });
    appendChatRoomParam(params);
    if (!options.initial && chatState.lastMessageId) {
      params.set("after", chatState.lastMessageId);
    }
    const payload = await chatApi(`/api/chat/messages?${params.toString()}`);
    if (roomRevision !== chatState.roomRevision) {
      return 0;
    }
    if (options.initial) {
      resetChatLog(t("chatWelcome"));
    }
    const messages = await prepareChatMessagesForDisplay(payload.messages || []);
    if (roomRevision !== chatState.roomRevision) {
      return 0;
    }
    appendedCount = appendChatMessages(messages);
    chatState.hasLoadedInitial = true;
  } catch {
    if (options.initial) {
      resetChatLog(t("chatLoadFailed"));
    } else {
      setChatFeedback(t("chatLoadFailed"), true);
    }
  } finally {
    if (roomRevision === chatState.roomRevision) {
      chatState.loading = false;
    }
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
  if (chatState.sending) {
    setChatFeedback(t("chatSending"));
    return;
  }

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
  if (Date.now() - chatState.lastSentAt < chatCooldownMs) {
    setChatFeedback(t("chatCooldown"), true);
    return;
  }

  try {
    setChatSendingState(true);
    setChatFeedback(t("chatSending"));
    await ensureChatIdentity();
    const body = {
      visitorId: chatState.visitorId,
      nickname: chatState.nickname
    };
    if (isPrivateChatRoomActive()) {
      body.room = chatState.roomKey;
      body.encryptedContent = await encryptChatContent(contentText);
    } else {
      body.content = contentText;
    }
    const payload = await chatApi("/api/chat/messages", {
      method: "POST",
      body: JSON.stringify(body)
    });
    chatState.lastSentAt = Date.now();
    safeStorageSet(chatStorageKeys.lastSentAt, String(chatState.lastSentAt));
    input.value = "";
    updateChatCounter();
    setChatFeedback(t("chatSent"));
    const messages = await prepareChatMessagesForDisplay(payload.message ? [payload.message] : []);
    appendChatMessages(messages);
    chatState.idlePolls = 0;
    await refreshChatMessages({ immediate: true });
    scheduleChatPolling(5000);
  } catch (error) {
    if (error.code === "nickname_taken") {
      setChatFeedback(t("chatNicknameTaken"), true);
      const nickname = await fetchAvailableChatNickname();
      chatState.nickname = nickname;
      safeStorageSet(chatStorageKeys.nickname, nickname);
      updateChatNicknameDisplay();
      return;
    }
    setChatFeedback(error.message || t("chatLoadFailed"), true);
  } finally {
    setChatSendingState(false);
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
  safeStorageSet(chatStorageKeys.nickname, normalized);
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
  const target = event.target instanceof Element ? event.target : event.target?.parentElement;
  if (!target) {
    return;
  }

  if (!target.closest("#account-widget")) {
    const popover = document.getElementById("account-popover");
    closeAccountPopover({ restoreFocus: Boolean(popover?.contains(document.activeElement)) });
  }

  const accountToggle = target.closest("[data-account-toggle]");
  if (accountToggle) {
    toggleAccountPopover(accountToggle);
    return;
  }

  if (target.closest("[data-account-logout]")) {
    logoutAccount();
    return;
  }

  if (target.closest("[data-video-retry]")) {
    loadVideos();
    return;
  }

  if (target.closest("[data-article-retry]")) {
    loadArticles();
    return;
  }

  const articleDetailRetryButton = target.closest("[data-article-detail-retry]");
  if (articleDetailRetryButton) {
    loadArticleDetail(articleDetailRetryButton.dataset.articleDetailRetry || articleState.currentSlug);
    return;
  }

  if (target.closest("[data-game-retry]")) {
    renderGames({ forceRefresh: true });
    return;
  }

  const langButton = target.closest("[data-lang]");
  if (langButton) {
    setLanguage(langButton.dataset.lang, { persist: true, syncUrl: true });
    return;
  }

  if (target.closest("[data-resource-show-all]")) {
    activeFilters.resources = "all";
    renderResources();
    return;
  }

  if (target.closest("[data-quick-transfer-open]")) {
    window.QuickTransfer?.open();
    return;
  }

  const filterButton = target.closest("[data-filter-type]");
  if (filterButton) {
    activeFilters[filterButton.dataset.filterType] = filterButton.dataset.filter;
    renderAll();
    return;
  }

  const articleHeadingButton = target.closest("[data-article-heading-target]");
  if (articleHeadingButton) {
    scrollToArticleHeading(articleHeadingButton.dataset.articleHeadingTarget);
    return;
  }

  if (target.closest("[data-article-scroll-top]")) {
    scrollArticleToTop();
    return;
  }

  if (target.closest("[data-article-window-toggle]")) {
    toggleArticleWindowSize();
    return;
  }

  const articleButton = target.closest("[data-article-slug]");
  if (articleButton) {
    event.preventDefault();
    showArticle(articleButton.dataset.articleSlug, { trigger: articleButton });
    return;
  }

  const articleCategoryButton = target.closest("[data-article-category]");
  if (articleCategoryButton) {
    showArticleCategory(articleCategoryButton.dataset.articleCategory, { trigger: articleCategoryButton });
    return;
  }

  const articleBackButton = target.closest("[data-article-back]");
  if (articleBackButton) {
    showArticleList({ trigger: articleBackButton });
    return;
  }

  if (target.closest("[data-article-copy-link]")) {
    copyArticleLink();
    return;
  }

  if (target.closest("[data-article-search-clear]")) {
    articleState.searchTerm = "";
    renderKnowledge();
    document.getElementById("knowledge-search-input")?.focus();
    return;
  }

  if (target.closest("[data-article-search-reset]")) {
    articleState.searchTerm = "";
    activeFilters.knowledge = "all";
    renderKnowledge();
    document.getElementById("knowledge-search-input")?.focus();
    return;
  }

  const videoButton = target.closest("[data-video-index]");
  if (videoButton) {
    openVideo(Number(videoButton.dataset.videoIndex));
    return;
  }

  const managedVideoButton = target.closest("[data-video-id]");
  if (managedVideoButton) {
    openVideo(managedVideoButton.dataset.videoId);
    return;
  }

  if (target.closest("[data-video-window-toggle], [data-video-fullscreen]")) {
    fullscreenVideo();
    return;
  }

  if (target.closest("[data-close-modal]")) {
    closeVideo();
    return;
  }

  if (target.closest("[data-close-welcome]")) {
    closeWelcome();
    return;
  }

  const routeButton = target.closest("[data-route]:not(body)");
  if (routeButton) {
    event.preventDefault();
    const motionKind = routeButton.matches(".minimize-button")
      ? "window-minimize"
      : routeButton.matches(".close-button") && routeButton.dataset.route === "home"
        ? "window-close"
        : routeButton.matches(".desktop-icon")
          ? "app-open"
          : document.documentElement.dataset.uiShell === "mobile"
            && routeButton.matches(".taskbar-tabs button, .start-button, .mobile-home-button")
            ? "mobile-tab"
            : "route";
    navigate(routeButton.dataset.route, { trigger: routeButton, motionKind });
    closeWelcome({ restoreFocus: false, motion: false });
    return;
  }
});

window.addEventListener("keydown", (event) => {
  if (trapDialogFocus(event)) {
    return;
  }
  if (event.key === "Escape") {
    const videoModal = document.getElementById("video-modal");
    const welcomeModal = document.getElementById("welcome-modal");
    if (videoWindowState.maximized && videoModal && !videoModal.hidden) {
      fullscreenVideo();
      return;
    }
    if (videoModal && !videoModal.hidden) {
      closeVideo();
      return;
    }
    if (welcomeModal && !welcomeModal.hidden) {
      closeWelcome();
      return;
    }
    const privateRoomForm = document.getElementById("chat-private-room-form");
    if (privateRoomForm && !privateRoomForm.hidden) {
      hideChatPrivateRoomForm();
      return;
    }
    closeAccountPopover();
  }
});

window.addEventListener("lusu:language-request", (event) => {
  const lang = event.detail?.lang;
  if (["zh", "en", "ja"].includes(lang)) {
    setLanguage(lang, { persist: true, syncUrl: true });
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
document.getElementById("chat-room-toggle")?.addEventListener("click", () => {
  handleChatRoomToggle().catch((error) => {
    setChatFeedback(error.message || t("chatLoadFailed"), true);
  });
});
document.getElementById("chat-private-room-form")?.addEventListener("submit", enterChatPrivateRoom);
document.getElementById("chat-private-room-cancel")?.addEventListener("click", hideChatPrivateRoomForm);
document.getElementById("knowledge-search-input")?.addEventListener("input", (event) => {
  articleState.searchTerm = event.target.value;
  renderKnowledge();
});
document.getElementById("article-detail")?.addEventListener("scroll", scheduleArticleReadProgressUpdate, { passive: true });
window.addEventListener("resize", layoutWallpaperStage);
window.addEventListener("resize", scheduleArticleReadProgressUpdate);
window.addEventListener("resize", () => window.requestAnimationFrame(captureRouteIconRects));

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
  const storedLang = safeStorageGet(languageStorageKey);
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
if (pageIds.includes(hoverRoute)) {
  document.querySelector(`.desktop-icon[data-route="${hoverRoute}"]`)?.classList.add("is-hovered");
}
window.addEventListener("load", maybeShowWelcome);
