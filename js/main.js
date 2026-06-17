const pageParams = new URLSearchParams(window.location.search);

const translations = {
  zh: {
    siteName: "鲁肃个人站",
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
    openOriginal: "打开原地址",
    videoFullscreen: "全屏",
    videoRestore: "还原",
    languageSupportLabel: "语言支持",
    gameSourceLabel: "来源",
    gameConfigLoading: "正在读取游戏配置...",
    gameConfigFailed: "游戏配置读取失败",
    videoPlaceholder: "这里预留 Bilibili / YouTube 嵌入播放器。",
    startButton: "首页",
    lastUpdatedLabel: "最近更新日期",
    brandHomeAria: "返回桌面",
    languageSwitcherAria: "语言切换",
    desktopIconsAria: "主要栏目",
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
    heroTitle: "LuSu Site",
    homeLead: "A small XP pixel site under construction.",
    navKnowledge: "Knowledge",
    navVideos: "Videos",
    navVideosBuilding: "Videos",
    navResources: "Resources",
    navResourcesBuilding: "Files TBD",
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
    openOriginal: "Open Original",
    videoFullscreen: "Full screen",
    videoRestore: "Restore",
    languageSupportLabel: "Language support",
    gameSourceLabel: "Source",
    gameConfigLoading: "Loading game catalog...",
    gameConfigFailed: "Could not load game catalog",
    videoPlaceholder: "Bilibili / YouTube embed player is reserved here.",
    startButton: "Home",
    lastUpdatedLabel: "Last updated",
    brandHomeAria: "Back to desktop",
    languageSwitcherAria: "Language switcher",
    desktopIconsAria: "Main sections",
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
    heroTitle: "魯粛サイト",
    homeLead: "工事中の XP ピクセル小サイトです。",
    navKnowledge: "知識庫",
    navVideos: "動画",
    navVideosBuilding: "動画",
    navResources: "リソース",
    navResourcesBuilding: "資料（未定）",
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
    openOriginal: "元のページを開く",
    videoFullscreen: "全画面",
    videoRestore: "元に戻す",
    languageSupportLabel: "言語対応",
    gameSourceLabel: "出典",
    gameConfigLoading: "ゲーム設定を読み込み中...",
    gameConfigFailed: "ゲーム設定を読み込めません",
    videoPlaceholder: "Bilibili / YouTube の埋め込みプレイヤー用スペースです。",
    startButton: "ホーム",
    lastUpdatedLabel: "最終更新日",
    brandHomeAria: "デスクトップへ戻る",
    languageSwitcherAria: "言語切り替え",
    desktopIconsAria: "主なセクション",
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
  "下载": { zh: "下载", en: "Download", ja: "ダウンロード" },
  "占位按钮": { zh: "占位按钮", en: "Placeholder button", ja: "準備中ボタン" },
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
  "碎碎念": { zh: "碎碎念", en: "Notes", ja: "メモ" }
};

const pageIds = ["home", "knowledge", "videos", "resources", "games", "blog", "chatroom", "about"];

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

function contentTitle(value) {
  return `${localText(value)}${t("placeholderMark")}`;
}

function buildGameUrl(item) {
  if (item.playUrl) {
    return sitePath(item.playUrl);
  }
  if (item.externalUrl) {
    return item.externalUrl;
  }
  if (item.repo && !item.entry) {
    return item.repo;
  }
  return `/games/${item.entry}?lang=${encodeURIComponent(currentLang)}`;
}

function renderLanguageSupportTags(item) {
  const supported = item.languageSupport || {};
  const languageNames = {
    zh: "中文",
    en: "EN",
    ja: "日本語"
  };

  return ["zh", "en", "ja"].map((lang) => `
    <span class="tag language-tag${supported[lang] ? " supported" : " unsupported"}" title="${languageNames[lang]}${supported[lang] ? "" : " not supported"}">
      ${languageNames[lang]} ${supported[lang] ? "✓" : "×"}
    </span>
  `).join("");
}

function gameLinkAttributes(item) {
  return item.external || item.playUrl || item.externalUrl || (!item.entry && item.repo)
    ? ' target="_blank" rel="noreferrer"'
    : "";
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
  document.title = t("heroTitle");

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
    button.classList.toggle("active", button.dataset.lang === lang);
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
    return `<button class="${activeFilters[type] === value ? "active " : ""}${type === "knowledge" ? "category-button" : ""}" data-filter-type="${type}" data-filter="${value}">${name}</button>`;
  });
  target.innerHTML = buttons.join("");
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
  layout?.classList.remove("is-reading");
  renderKnowledgeCategoryButtons(categories);
  list.hidden = false;
  detail.hidden = true;
  if (articleState.loading) {
    renderKnowledgeSearchControls(null, null);
    list.innerHTML = `<p class="loading-text">${t("articleLoading")}</p>`;
    return;
  }
  if (articleState.error) {
    renderKnowledgeSearchControls(null, null);
    list.innerHTML = `<p class="loading-text">${t("articleLoadFailed")}</p>`;
    return;
  }

  const categoryItems = articleState.articles.filter((item) => activeFilters.knowledge === "all" || item.category === activeFilters.knowledge);
  const items = categoryItems.filter(articleMatchesSearch);
  renderKnowledgeSearchControls(items.length, categoryItems.length);
  if (!articleState.articles.length) {
    list.innerHTML = `<p class="loading-text">${t("articleEmpty")}</p>`;
    return;
  }
  if (!items.length) {
    list.innerHTML = `<p class="loading-text">${t("articleSearchNoResults")}</p>`;
    return;
  }

  list.innerHTML = items.map((item) => `
    <article class="article-card">
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.summary || "")}</p>
      <div class="meta-row">
        <span>${t("articleCategory")}：${escapeHtml(articleCategoryName(item.category || "note"))}</span>
              ${(item.tags || []).map((tag) => `<span class="tag">${escapeHtml(articleTagName(tag))}</span>`).join("")}
        <span>${t("articlePublished")}：${escapeHtml(formatArticleDate(item.published_at || item.created_at))}</span>
        ${item.lang !== currentLang ? `<span class="tag">${t("articleFallback")}</span>` : ""}
      </div>
      <a class="card-action" href="${escapeHtml(articleRoutePath(item.slug))}" data-article-slug="${escapeHtml(item.slug)}">${t("readButton")}</a>
    </article>
  `).join("");
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
  const buttons = [t("all"), ...categories].map((name, index) => {
    const value = index === 0 ? "all" : String(name);
    return `<button class="${activeFilters.knowledge === value ? "active " : ""}category-button" data-filter-type="knowledge" data-filter="${escapeHtml(value)}">${escapeHtml(articleCategoryName(value))}</button>`;
  });
  target.innerHTML = buttons.join("");
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
    articleState.articles = payload.articles || [];
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
    list.innerHTML = `<p class="loading-text">${t("articleLoadFailed")}</p>`;
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
  title.textContent = article.title || "";
  summary.textContent = article.summary || "";
  meta.replaceChildren();
  [
    `${t("articleCategory")}：${articleCategoryName(article.category || "note")}`,
    `${t("articlePublished")}：${formatArticleDate(article.published_at || article.created_at)}`,
    ...(article.tags || []).map((tag) => `#${articleTagName(tag)}`),
    article.lang !== currentLang ? t("articleFallback") : ""
  ].filter(Boolean).forEach((text) => {
    const item = document.createElement("span");
    item.className = text.startsWith("#") || text === t("articleFallback") ? "tag" : "";
    item.textContent = text;
    meta.appendChild(item);
  });
  renderMarkdownSafe(body, stripRepeatedArticleHeading(article.content_markdown || "", article.title || ""));
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

function articleShareLink(slug) {
  const url = new URL(articleRoutePath(slug), window.location.origin);
  url.searchParams.set("lang", currentLang);
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
    const loading = document.createElement("p");
    loading.className = "loading-text";
    loading.textContent = videoUiText("loading");
    list.appendChild(loading);
    return;
  }
  if (videoState.error) {
    const error = document.createElement("p");
    error.className = "loading-text";
    error.textContent = videoUiText("failed");
    list.appendChild(error);
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
    button.type = "button";
    button.dataset.filterType = "videos";
    button.dataset.filter = category.category_id;
    button.textContent = category.name || category.name_zh || category.slug || t("all");
    button.classList.toggle("active", activeFilters.videos === category.category_id);
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
  if (item.thumbnail_url) {
    const image = document.createElement("img");
    image.src = item.thumbnail_url;
    image.alt = "";
    image.loading = "lazy";
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

function videoAutoplayUrl(src) {
  try {
    const url = new URL(src);
    if (url.hostname.includes("youtube.com")) {
      url.searchParams.set("autoplay", "1");
      url.searchParams.set("playsinline", "1");
      url.searchParams.set("rel", "0");
      url.searchParams.set("modestbranding", "1");
      url.searchParams.set("iv_load_policy", "3");
    }
    if (url.hostname.includes("bilibili.com")) {
      url.searchParams.set("autoplay", "1");
      url.searchParams.set("high_quality", "1");
      url.searchParams.set("as_wide", "1");
      url.searchParams.set("danmaku", "0");
    }
    return url.toString();
  } catch {
    return src;
  }
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
  if (/^https?:\/\//i.test(value)) {
    return value;
  }
  if (/^\/?(assets|downloads)\//i.test(value)) {
    return sitePath(value);
  }
  return "";
}

function resourceActionElement(item) {
  const url = safeResourceUrl(item);
  const text = url
    ? item.external ? t("externalButton") : t("downloadButton")
    : t("resourcePending");
  if (!url) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "card-action is-disabled";
    button.disabled = true;
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

function resourceCardElement(item) {
  const card = document.createElement("article");
  card.className = "resource-card";

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

  main.append(title, desc, meta);
  card.append(main, resourceActionElement(item));
  return card;
}

function renderResources() {
  renderCategoryButtons("resource-categories", "resources", label("resourceCategories"));
  const list = document.getElementById("resource-list");
  const items = content.resources.filter((item) => activeFilters.resources === "all" || String(item.category) === activeFilters.resources);

  list.replaceChildren();
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
  list.innerHTML = `<p class="loading-text">${t("gameConfigLoading")}</p>`;
  try {
    const catalog = await loadGameCatalog();
    list.innerHTML = catalog.games.map((item) => `
        <article class="game-card">
          <img class="game-cover" src="${escapeHtml(sitePath(String(item.cover || "assets/images/icon-games.png").replace("../", "")))}" alt="${escapeHtml(localText(item.titles || item.titleZh))}" loading="lazy">
          <div class="game-main">
            <h3>${escapeHtml(localText(item.titles || item.titleZh))}</h3>
            <p>${escapeHtml(localText(item.summaries || item.summary))}</p>
            <div class="meta-row">
              <span class="language-support-label">${t("languageSupportLabel")}:</span>
              ${renderLanguageSupportTags(item)}
              ${item.license?.name ? `<span class="tag">${escapeHtml(item.license.name)}</span>` : ""}
            </div>
          </div>
          <a class="card-action" href="${escapeHtml(buildGameUrl(item))}"${gameLinkAttributes(item)}>${item.external || item.playUrl || item.externalUrl ? t("openGameButton") : t("startGameButton")}</a>
        </article>
      `).join("");
  } catch (error) {
    list.innerHTML = `<p class="loading-text">${t("gameConfigFailed")}：${escapeHtml(error.message)}</p>`;
  }
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
    : content.updates.slice(0, 5);
  if (!updateArticles.length) {
    list.innerHTML = `<li><span class="update-icon">📚</span><span><strong>${t("articleLoading")}</strong><small>${t("articleEmpty")}</small></span></li>`;
    return;
  }
  list.innerHTML = updateArticles.map((item) => `
    <li>
      <a class="recent-update-link"${item.slug ? ` href="${escapeHtml(articleRoutePath(item.slug))}" data-article-slug="${escapeHtml(item.slug)}"` : ' href="/#knowledge"'}>
        <span class="update-icon">📚</span>
        <span>
          <strong>${escapeHtml(truncateText(localText(item.title), 28))}</strong>
          <small>${escapeHtml(truncateText(item.summary || localText(item.desc) || "", 52))}<br>${escapeHtml(formatArticleDate(item.published_at || item.created_at || item.date))}</small>
        </span>
      </a>
    </li>
  `).join("");
}

function latestUpdateDate() {
  const dates = siteUpdateArticles().length ? siteUpdateArticles() : content.updates;
  return dates.reduce((latest, item) => {
    const date = formatLocalDateKey(item.published_at || item.created_at || item.date);
    return date > latest ? date : latest;
  }, "");
}

function siteUpdateArticles() {
  return articleState.articles
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
    const originalUrl = video.original_url || video.url || "";
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
  if (video.embed_url) {
    const shell = document.createElement("div");
    shell.className = "video-embed-shell";
    const iframe = document.createElement("iframe");
    iframe.src = videoAutoplayUrl(video.embed_url);
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
  if (pageParams.get("welcome") === "0") {
    return;
  }
  const route = parseRouteLocation();
  if (pageParams.get("welcome") !== "1" && (route.route !== "home" || route.articleSlug)) {
    return;
  }
  const today = localDateKey(new Date());
  const key = `lusu-welcome-seen-${today}`;
  if (localStorage.getItem(key) === "1") {
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

  if (authUser) {
    widget.innerHTML = `
      <button class="account-button signed-in" type="button" data-account-toggle>
        <span>${escapeHtml(t("accountSignedInPrefix"))}${escapeHtml(authUser.email)}</span>
      </button>
      <div class="account-popover" id="account-popover" hidden>
        <div class="account-signed-in">
          <strong>${escapeHtml(t("accountTitle"))}</strong>
          <p class="account-note">${escapeHtml(authUser.email)}</p>
          <p class="account-note">${escapeHtml(t("accountSignedInNote"))}</p>
          ${message ? `<p class="account-note">${escapeHtml(message)}</p>` : ""}
          <div class="account-actions">
            <button class="account-button" type="button" data-account-logout>${escapeHtml(t("accountLogout"))}</button>
          </div>
        </div>
      </div>
    `;
    return;
  }

  widget.innerHTML = `
    <button class="account-button" type="button" data-account-toggle>
      <span>${escapeHtml(t("accountLogin"))}</span>
    </button>
    <div class="account-popover" id="account-popover" hidden>
      <form class="account-form" id="account-form">
        <strong>${escapeHtml(t("accountTitle"))}</strong>
        <input name="email" type="email" autocomplete="email" placeholder="${escapeHtml(t("accountEmailPlaceholder"))}" required>
        <input name="password" type="password" autocomplete="current-password" placeholder="${escapeHtml(t("accountPasswordPlaceholder"))}" required>
        <div class="account-actions">
          <button class="account-button" type="submit" data-mode="login">${escapeHtml(t("accountLogin"))}</button>
          <button class="account-button" type="submit" data-mode="register">${escapeHtml(t("accountRegister"))}</button>
        </div>
        <p class="account-note">${message ? escapeHtml(message) : escapeHtml(t("accountGuestNote"))}</p>
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
    const payload = await chatApi("/api/chat/nickname");
    if (isValidChatNickname(payload.nickname)) {
      return payload.nickname.trim();
    }
  } catch {
    // Local fallback keeps the chat usable if the nickname endpoint is unavailable.
  }
  return randomChatNickname();
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

  const filterButton = event.target.closest("[data-filter-type]");
  if (filterButton) {
    activeFilters[filterButton.dataset.filterType] = filterButton.dataset.filter;
    renderAll();
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
window.addEventListener("resize", layoutWallpaperStage);

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
initAccountWidget();
updateClock();
setInterval(updateClock, 1000);
syncRouteFromLocation();
const hoverRoute = pageParams.get("hover");
if (hoverRoute) {
  document.querySelector(`.desktop-icon[data-route="${hoverRoute}"]`)?.classList.add("is-hovered");
}
window.addEventListener("load", maybeShowWelcome);
