// Active migration bundle. Keep the immediately preceding insert-only release here so
// databases upgrading across either release retain both public update records.
export function articleReleaseSeedStatements(env, { articleTranslationsStatements }) {
  return [
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-22-pond-tools', '2026-11-22-pond-tools', 'site-updates', '["网站更新","工具区","在线画板","界面"]', '', 'published', 0, 0, '2026-11-21T17:52:00.000Z', '2026-11-21T17:52:00.000Z', '2026-11-21T17:52:00.000Z') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-22-pond-tools", {
  "zh": {
    "title": "工具区与三个工具子页面换装深夜终端 CRT 视觉",
    "summary": "逐步视觉替换第 4 批上线：桌面端工具区（#resources）换装提亮版 CRT 玻璃卡片并接入 6 枚点阵虚线 SVG 图标，同时为临时互传弹窗、在线画板与日语的言外之意统一套用深夜池塘 CRT 视觉主题；全部功能与交互逻辑保持原样。",
    "content_markdown": "# 工具区与三个工具子页面换装深夜终端 CRT 视觉\n\n本次为全站视觉逐步替换的第 4 批上线，仅替换工具区与三个工具子页面的视觉呈现层，不改动任何工具逻辑、协作协议或子项目数据。\n\n- 整体提亮了 CRT 玻璃窗的通透度与边框辉光，工具区三列卡片接入点阵虚线风调色盘、电脑⇄手机、鸟居及下载行 SVG 图标。\n- 临时互传弹窗、在线画板（`/tools/whiteboard/`）与日语的言外之意（`/tools/japanese-subtext/`）统一挂接深夜池塘 CRT 视觉层，画布与答题逻辑零改动。\n- 游戏、聊天室、关于、登录、欢迎窗及手机端继续按顺序逐批推进。"
  },
  "en": {
    "title": "Tools Window and Three Tool Sub-Pages Refreshed with Midnight Pond CRT Visuals",
    "summary": "Batch 4 of the visual refresh is live: the desktop Tools window (#resources) adopts the brightened CRT glass skin with 6 dotted SVG icons, and Quick Transfer, Online Whiteboard, and Behind the Japanese share the Midnight Pond CRT visual theme without changing any tool logic.",
    "content_markdown": "# Tools Window and Three Tool Sub-Pages Refreshed with Midnight Pond CRT Visuals\n\nBatch 4 updates only the visual presentation layer for Tools (`#resources`) and all three public tool sub-pages while keeping every tool feature and protocol intact.\n\n- Lifted CRT glass translucency and luminous border glow across windows, integrating the 6 dotted SVG icons for tools and download cards.\n- Applied the Midnight Pond CRT visual theme to the Quick Transfer modal, Online Whiteboard (`/tools/whiteboard/`), and Behind the Japanese (`/tools/japanese-subtext/`).\n- Games, Chatroom, About, Login, Welcome, and mobile continue rolling out next."
  },
  "ja": {
    "title": "ツール欄と3つのツール子ページを深夜端末CRTビジュアルへ刷新",
    "summary": "段階的ビジュアル刷新の第4弾を公開しました。デスクトップのツール欄（#resources）を明るく透過感のあるCRTガラス窓と6種の点線SVGアイコンへ換装し、一時転送・ホワイトボード・日本語の裏側にも共通CRTテーマを適用しました。",
    "content_markdown": "# ツール欄と3つのツール子ページを深夜端末CRTビジュアルへ刷新\n\n段階的ビジュアル刷新の第4弾として、ツール欄（`#resources`）と3つのツール子ページの表示レイヤーのみを更新しました。既存機能・通信・データは一切変更していません。\n\n- CRTガラス窓の透過感と枠線発光を底上げし、パレット・転送・鳥居など6種の点線SVGアイコンを適用しました。\n- 一時転送モーダル・オンラインホワイトボード・日本語の裏側にも深夜池塘CRTテーマを統一適用しています。\n- ゲーム・チャット・概要・ログイン・歓迎窓・モバイル版へ順次進みます。"
  }
}, "2026-11-21T17:52:00.000Z"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-22-pond-videos', '2026-11-22-pond-videos', 'site-updates', '["网站更新","视频区","界面"]', '', 'published', 0, 0, '2026-11-21T17:46:00.000Z', '2026-11-21T17:46:00.000Z', '2026-11-21T17:46:00.000Z') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-22-pond-videos", {
  "zh": {
    "title": "视频区换装深夜终端 CRT 玻璃卡片窗",
    "summary": "逐步视觉替换第 3 批上线：桌面端视频区（#videos）与播放弹窗换装半透明 CRT 玻璃窗，保留现站 /api/videos 接口、分类筛选、平台徽标与外链播放逻辑；工具、游戏、聊天室、关于、登录、欢迎窗及手机端保持原样。",
    "content_markdown": "# 视频区换装深夜终端 CRT 玻璃卡片窗\n\n本次为全站视觉逐步替换的第 3 批上线，仅替换桌面端视频区（`#videos`）与视频弹窗的视觉呈现层，不改动任何视频数据接口、分类逻辑或外链播放行为。\n\n- 悬浮于四季池塘 CRT 背景之上，采用三列 16:9 卡片网格、点阵虚线播放徽标与分类胶囊筛选。\n- 保留现站 `/api/videos` 实时拉取、平台标识（Bilibili / YouTube）与外链播放能力。\n- 工具、游戏、聊天室、关于、登录、欢迎窗及手机端均保持原样，继续按顺序逐批替换。"
  },
  "en": {
    "title": "Videos Section Refreshed with Midnight Pond CRT Cards",
    "summary": "Batch 3 of the visual refresh is live: the desktop Videos window (#videos) and player modal adopt translucent CRT glass styling with 3-column 16:9 cards and dotted play badges while keeping live /api/videos data and playback links untouched.",
    "content_markdown": "# Videos Section Refreshed with Midnight Pond CRT Cards\n\nBatch 3 updates only the presentation layer for the desktop Videos section (`#videos`) and player modal, keeping all `/api/videos` requests, category filters, platform badges, and external links intact.\n\n- Renders a 3-column 16:9 CRT glass card grid over the live Pond background with dotted play overlays and glowing category pills.\n- Tools, Games, Chatroom, About, Login, Welcome, and mobile remain untouched and continue rolling out next."
  },
  "ja": {
    "title": "動画セクションを深夜端末・CRTガラスカードへ刷新",
    "summary": "段階的ビジュアル刷新の第3弾を公開しました。デスクトップの動画欄（#videos）と再生モーダルを半透明CRTガラス窓へ換装し、既存の/api/videos連携・カテゴリ絞り込み・外部リンク再生はそのまま維持しています。",
    "content_markdown": "# 動画セクションを深夜端末・CRTガラスカードへ刷新\n\n段階的ビジュアル刷新の第3弾として、デスクトップの動画セクション（`#videos`）と再生モーダルの表示レイヤーのみを更新しました。`/api/videos` 取得・分類フィルタ・外部再生リンクは一切変更していません。\n\n- 四季池塘CRT背景の上に3列16:9カードグリッドと点線再生アイコン、カテゴリピルを配置しました。\n- ツール・ゲーム・チャット・概要・ログイン・歓迎窓・モバイル版は従来のまま維持し、順次置き換えます。"
  }
}, "2026-11-21T17:46:00.000Z"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-22-pond-article-reader', '2026-11-22-pond-article-reader', 'site-updates', '["网站更新","知识库","文章详情","阅读体验","界面"]', '', 'published', 0, 0, '2026-11-21T17:38:00.000Z', '2026-11-21T17:38:00.000Z', '2026-11-21T17:38:00.000Z') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-22-pond-article-reader", {
  "zh": {
    "title": "文章阅读页换装深夜终端 CRT 玻璃阅读窗",
    "summary": "逐步视觉替换第 2 批上线：桌面端文章阅读页（#article-detail）换装半透明 CRT 玻璃阅读窗，保留现站目录 TOC、顶部阅读进度条、摘要框、复制链接与正文排版逻辑；其余未替换栏目与手机端保持原样。",
    "content_markdown": "# 文章阅读页换装深夜终端 CRT 玻璃阅读窗\n\n本次为全站视觉逐步替换的第 2 批上线，仅替换桌面端文章阅读页（`#article-detail`）的视觉呈现层，不改动现站文章拉取接口、目录生成、进度计算或任何交互逻辑。\n\n- 阅读窗直接悬浮于四季池塘 CRT 背景之上，顶部阅读进度条升级为青→紫→粉荧光点阵渐变条。\n- 左侧目录区采用点阵竖线与荧光高亮当前章节，右侧正文区配点阵虚线摘要框与深色高对比 Markdown 排版。\n- 视频、工具、游戏、聊天室、关于、登录、欢迎窗及手机端 iOS Shell 均保持原样，继续按顺序逐批替换。"
  },
  "en": {
    "title": "Article Reader Refreshed with Midnight Pond CRT Glass Styling",
    "summary": "Batch 2 of the visual refresh is live: the desktop Article Reader (#article-detail) adopts the translucent CRT glass layout over the live Pond background while keeping TOC, reading progress, summary toggle, link copying, and markdown rendering untouched.",
    "content_markdown": "# Article Reader Refreshed with Midnight Pond CRT Glass Styling\n\nBatch 2 of the gradual visual replacement updates only the presentation layer of the desktop Article Reader (`#article-detail`), leaving all article APIs, TOC generation, scroll progress math, and interactions untouched.\n\n- The reader floats cleanly over the four-season Pond CRT background with a cyan-to-pink glowing reading progress bar.\n- The left TOC sidebar uses dotted guides and phosphor active states, paired with a dotted summary callout and high-contrast dark CRT markdown typography.\n- Videos, Tools, Games, Chatroom, About, Login, Welcome, and mobile remain unchanged and will roll out next."
  },
  "ja": {
    "title": "記事リーダーを深夜端末・CRTガラス表示へ刷新",
    "summary": "段階的ビジュアル刷新の第2弾を公開しました。デスクトップの記事閲覧ページ（#article-detail）を池塘背景上の半透明CRTガラス窓へ換装し、目次・読書進捗・要約・リンクコピー等の機能はすべて従来のまま維持しています。",
    "content_markdown": "# 記事リーダーを深夜端末・CRTガラス表示へ刷新\n\n段階的ビジュアル刷新の第2弾として、デスクトップの記事閲覧ページ（`#article-detail`）の表示レイヤーのみを更新しました。記事取得API・目次生成・進捗計算・各種操作は一切変更していません。\n\n- 四季池塘CRT背景の上に半透明ガラス窓を重ね、上部の読書進捗バーを青〜ピンクの発光グラデーションへ統一しました。\n- 左側の目次サイドバーと右側の点線要約枠・高コントラストMarkdown本文をCRT端末風に整えています。\n- 動画・ツール・ゲーム・チャット・概要・ログイン・歓迎窓・モバイル版は従来のまま維持し、順次置き換えます。"
  }
}, "2026-11-21T17:38:00.000Z"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-11-21-pond-home-knowledge', '2026-11-21-pond-home-knowledge', 'site-updates', '["网站更新","首页","知识库","界面"]', '', 'published', 0, 0, '2026-11-21T15:30:00.000Z', '2026-11-21T15:30:00.000Z', '2026-11-21T15:30:00.000Z') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-11-21-pond-home-knowledge", {
  "zh": {
    "title": "桌面首页与知识库列表换装深夜终端池塘视觉",
    "summary": "逐步视觉替换第 1 批上线：桌面端首页替换为四季池塘 CRT 点阵桌面（接入按时段自动切换与手动滑块），桌面端知识库列表换装半透明 CRT 玻璃窗口；全部数据、接口、分类、排序、搜索、分页及未替换栏目与移动端均保持原样。",
    "content_markdown": "# 桌面首页与知识库列表换装深夜终端池塘视觉\n\n本次为全站视觉逐步替换的第 1 批上线，仅替换桌面端首页与知识库列表的视觉呈现层，不改动任何线上数据、后端接口或既有交互逻辑。\n\n- 桌面端首页替换为 WebGL2 四季池塘 CRT 桌面，接入现站时段壁纸规则（早/昼/暮/夜自动对应春/夏/秋/冬），右上角保留手动滑块切换。\n- 桌面端知识库列表在现站真实 DOM 与 `/api/articles` 接口之上换装半透明发光 CRT 玻璃窗口，沿用现站分类顺序、计数、置顶、搜索与分页逻辑。\n- 文章阅读页、视频、工具、游戏、聊天室、关于、账号浮层、欢迎窗及移动端 iOS Shell 均保持现状，后续按窗口逐一替换。"
  },
  "en": {
    "title": "Desktop Home and Knowledge List Refresh with Midnight Pond CRT Visuals",
    "summary": "Batch 1 of the visual refresh is live: desktop Home adopts the four-season WebGL2 Pond CRT desktop (synced with the time-of-day schedule and manual slider), and the desktop Knowledge list uses the translucent CRT glass skin. All data, APIs, sorting, search, pagination, other sections, and mobile remain unchanged.",
    "content_markdown": "# Desktop Home and Knowledge List Refresh with Midnight Pond CRT Visuals\n\nThis is Batch 1 of the gradual visual replacement, updating only the presentation layer for desktop Home and the Knowledge list while keeping all live data, backend APIs, and existing logic untouched.\n\n- Desktop Home now renders the four-season WebGL2 Pond CRT scene connected to the site's time-of-day wallpaper schedule (morning/day/dusk/night -> spring/summer/autumn/winter) with a manual top-right slider.\n- Desktop Knowledge list applies the translucent CRT glass window skin directly over the existing DOM and live `/api/articles` flow, preserving category order, counts, pinning, search, and pagination.\n- Article Reader, Videos, Tools, Games, Chatroom, About, Account popover, Welcome modal, and the mobile shell remain unchanged and will be updated incrementally."
  },
  "ja": {
    "title": "デスクトップのホームと知識庫一覧を深夜端末・池塘CRTビジュアルへ刷新",
    "summary": "段階的ビジュアル刷新の第1弾を公開しました。デスクトップのホームを時間帯連動の四季池塘CRTへ、知識庫一覧を半透明CRTガラス窓へ切り替えました。データ・API・並び順・検索・ページングおよび他ページとモバイルは従来のままです。",
    "content_markdown": "# デスクトップのホームと知識庫一覧を深夜端末・池塘CRTビジュアルへ刷新\n\n全サイト段階的ビジュアル刷新の第1弾として、デスクトップのホーム画面と知識庫一覧の表示レイヤーのみを更新しました。既存データ・API・機能ロジックは一切変更していません。\n\n- デスクトップのホームに WebGL2 四季池塘 CRT を導入し、既存の時刻壁紙ルール（朝・昼・夕・夜→春・夏・秋・冬）と右上の手動スライダーを接続しました。\n- デスクトップの知識庫一覧は既存 DOM と `/api/articles` のまま半透明 CRT ガラス窓へスキン適用し、カテゴリ順・件数・固定表示・検索・ページングを維持しています。\n- 記事本文、動画、ツール、ゲーム、チャット、概要、アカウント、歓迎ウィンドウ、モバイル版は従来のまま維持し、順次置き換えます。"
  }
}, "2026-11-21T15:30:00.000Z"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-10-29-tool-maintenance', '2026-10-29-tool-maintenance', 'site-updates', '["网站更新","工具"]', '', 'published',0,0,'2026-10-29T15:00:00.000Z', '2026-10-29T15:00:00.000Z', '2026-10-29T15:00:00.000Z') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-10-29-tool-maintenance", {
  "zh": {
    "title": "工具维护与完整画板导出准备",
    "summary": "本地候选在现有画板和互传基础上完善完整图片导出与管理适配，保留现有大厅、帮助、上传和草稿保护；尚未部署。",
    "content_markdown": "# 工具维护与完整画板导出准备\n\n本地候选在现有画板和互传基础上完善完整图片导出与管理适配，保留现有大厅、帮助、上传和草稿保护；尚未部署。\n\n画板导出覆盖当前场景全部未删除元素和已加载的图片，包括屏幕视口外的内容。素材尚未加载时明确失败，不把只有文字或元数据的结果当作完整图片。\n\n继续保留主线已经验证的紧凑大厅、键盘与触屏帮助、三语界面以及密码房生命周期。互传继续保留切换标签页时的上传、离房草稿清理、失败重试和安全删除语义。本条是本地候选维护记录，线上功能与版本以正式部署为准；没有在测试中发布文章、发送真实消息或覆盖个人游戏存档。"
  },
  "en": {
    "title": "Tool Maintenance and Full Whiteboard Export Preparation",
    "summary": "The local candidate adds full whiteboard image export and administration integration while retaining the existing lobby, help, uploads and draft protection. It has not been deployed.",
    "content_markdown": "# Tool Maintenance and Full Whiteboard Export Preparation\n\nThe local candidate adds full whiteboard image export and administration integration while retaining the existing lobby, help, uploads and draft protection. It has not been deployed.\n\nWhiteboard export includes all undeleted scene elements and loaded image assets, including content beyond the viewport. Missing image assets produce an explicit failure. The existing lobby, keyboard and touch help, room lifecycle, background uploads and draft cleanup remain intact. This is a local candidate maintenance record, not a production release announcement."
  },
  "ja": {
    "title": "ツール保守とホワイトボード全体画像の準備",
    "summary": "ローカル候補版で全体画像の書き出しと管理連携を整備しました。既存のロビー、ヘルプ、アップロード、下書き保護を維持しています。まだ公開していません。",
    "content_markdown": "# ツール保守とホワイトボード全体画像の準備\n\nローカル候補版で全体画像の書き出しと管理連携を整備しました。既存のロビー、ヘルプ、アップロード、下書き保護を維持しています。まだ公開していません。\n\n書き出しには、画面の表示範囲外も含め、削除されていない全要素と読み込み済み画像が含まれます。画像素材が不足している場合は明確に失敗を返します。既存のロビー、キーボードやタッチでのヘルプ、部屋の有効期限、バックグラウンドでのアップロードと下書き消去を維持します。これはローカル候補の保守記録であり、本番公開の告知ではありません。実際のサイトの状態は正式なデプロイに従います。"
  }
}, "2026-10-29T15:00:00.000Z"),
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-09-28-mobile-layout', '2026-09-28-mobile-layout', 'site-updates', '["网站更新","移动端","聊天室","界面"]', '', 'published', 0, 0, '2026-09-28T02:00:00.000Z', '2026-09-28T02:00:00.000Z', '2026-09-28T02:00:00.000Z') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-09-28-mobile-layout", {
  "zh": {
    "title": "手机界面重新排版",
    "summary": "首页入口、栏目卡片和底部导航统一调整；聊天室重新划分身份、房间、消息与输入区，改善短屏和横屏下的阅读与操作。",
    "content_markdown": "# 手机界面重新排版\n\n首页入口、栏目卡片和底部导航统一调整；聊天室重新划分身份、房间、消息与输入区，改善短屏和横屏下的阅读与操作。\n\n- 首页竖屏采用三列入口，横屏采用一排入口，保留像素图标和时段壁纸。\n- 栏目窗口和卡片使用更简洁的边框、统一的字号和自然换行。\n- 视频卡保留完整的 16:9 大封面，下方排列标题和简介，作者日期与播放按钮并排。\n- 聊天室采用固定语义分区，消息列表独立滚动；短屏计数与发送按钮并排，横屏使用左侧房间栏。\n- 底部 Dock 提高文字对比，继续支持横滑与收起。\n- 保留中文、英文和日文界面。"
  },
  "en": {
    "title": "A Reworked Mobile Layout",
    "summary": "Home shortcuts, content cards, and navigation now share a clearer layout. Chat separates identity, room controls, messages, and composition for easier use on short and landscape screens.",
    "content_markdown": "# A Reworked Mobile Layout\n\nHome shortcuts, content cards, and navigation now share a clearer layout. Chat separates identity, room controls, messages, and composition for easier use on short and landscape screens.\n\n- Home uses three columns in portrait and one row in landscape, with pixel icons and time-based wallpapers.\n- Windows and cards use simpler borders, consistent type sizes, and natural wrapping.\n- Video cards retain a full-width 16:9 cover, followed by the title and description, with author and date beside the play button.\n- Chat has explicit layout areas and a separately scrolling conversation. Compact screens place the counter beside Send; landscape uses a room sidebar.\n- Dock labels have higher contrast, with scrolling and collapse controls retained.\n- Chinese, English, and Japanese remain available."
  },
  "ja": {
    "title": "モバイル画面のレイアウトを刷新",
    "summary": "ホームの入口、各ページのカード、下部ナビゲーションを整理。チャットの名前・部屋・メッセージ・入力欄を分け、小さな画面や横向きでも使いやすくしました。",
    "content_markdown": "# モバイル画面のレイアウトを刷新\n\nホームの入口、各ページのカード、下部ナビゲーションを整理。チャットの名前・部屋・メッセージ・入力欄を分け、小さな画面や横向きでも使いやすくしました。\n\n- ホームは縦向きで3列、横向きで1行に配置。ピクセルアイコンと時間帯の壁紙を維持しました。\n- ウィンドウとカードの枠線、文字サイズ、折り返しを統一しました。\n- 動画カードは横幅いっぱいの16:9カバーを表示し、下にタイトルと説明、作者・日時と再生ボタンを配置します。\n- チャットを明確な領域に分け、メッセージだけをスクロールできます。小画面では文字数と送信ボタンを横に配置し、横向きでは部屋操作を左側に表示します。\n- Dockの文字のコントラストを改善し、横スクロールと折りたたみを維持しました。\n- 中国語・英語・日本語に対応しています。"
  }
}, "2026-09-28T02:00:00.000Z"),
    env.DB.prepare(`
    insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values (
      'seed-update-2026-09-08-site-review-optimization',
      '2026-09-08-site-review-optimization',
      'site-updates',
      '["网站更新","界面","移动端","工具","可靠性"]',
      '',
      'published',
      0,
      0,
      '2026-09-07T23:00:00.000Z',
      '2026-09-07T23:00:00.000Z',
      '2026-09-07T23:00:00.000Z'
    ) on conflict(article_id) do nothing
    `),
    ...articleTranslationsStatements(env, "seed-update-2026-09-08-site-review-optimization", {
      zh: {
        title: "全站体验与可靠性优化",
        summary: "欢迎窗改为主动查看，工具与画板入口更清晰，手机手势和动效更稳定；知识库支持完整分页搜索，临时互传修复跨房草稿与后台上传，发布增加精确版本校验。",
        content_markdown: "# 全站体验与可靠性优化\n\n这次根据全站审查，集中改善适配、界面、交互和代码可靠性。继续保留桌面的 XP／像素风格与手机端独立布局。\n\n## 阅读与导航\n\n- 欢迎窗改为主动打开，可通过首页的欢迎与更新入口查看；文章直链不会被自动弹窗打断。\n- 知识库增加分页与服务端搜索，分类数量覆盖全部已发布文章；相同标签只显示一次。\n- 文章链接支持 Ctrl／Command 点击和浏览器的新标签页操作。\n\n## 工具与移动端\n\n- 工具卡片先说明用途，版本和技术说明按需展开；视频缩略图去掉内框，标题、简介、时间与播放按钮重新对齐。\n- 在线画板 1.0.10 整理身份、公共房、密码房和最近使用；帮助支持鼠标、键盘与触控，展开时不遮挡输入。\n- 临时互传 1.0.14 离房清空未发送草稿，切后台不主动取消上传，暂停与继续能正确衔接；启动失败可直接重试。\n- 手机返回首页手势仅从 Home 指示条触发，输入、键盘或弹层开启时不会误退出；快速切换时取消过期动效。\n\n## 可靠性与维护\n\n- 注册、登录不再被非关键访问统计写入失败阻断。\n- 后端拆出会话、清理和内容迁移服务；清理分批继续，失败允许重试。\n- 第一方代码统一静态检查，发布核对实际提交与资源哈希，避免把旧站点当作本次上线。\n"
      },
      en: {
        title: "A Clearer, More Reliable Personal Site",
        summary: "Welcome is now optional, tool and whiteboard entries are clearer, and mobile gestures are more predictable. Knowledge gains complete pagination and search; Transfer fixes room drafts and background uploads, with exact release checks.",
        content_markdown: "# A Clearer, More Reliable Personal Site\n\nThis release follows a site-wide review of responsive layout, visual design, interaction, and reliability. The desktop keeps its XP and pixel style, with a separate layout for phones.\n\n## Reading and navigation\n\n- Welcome opens on request from the Home welcome and updates entry. Direct article links are no longer interrupted by an automatic dialog.\n- Knowledge now has pagination and server-side search across published articles, complete category counts, and deduplicated tags.\n- Article links preserve Control/Command-click and the browser's native new-tab behavior.\n\n## Tools and mobile\n\n- Tool cards explain their purpose first, with version and technical details available on demand. Video thumbnails lose the inner frame, and card titles, summaries, dates, and playback actions align more consistently.\n- Whiteboard 1.0.10 organizes identity, public rooms, password rooms, and recent boards. Help works with mouse, keyboard, and touch without covering inputs.\n- Transfer 1.0.14 clears unsent drafts when leaving a room, keeps uploads running when the page becomes hidden, and handles pause and resume consistently. A failed startup can be retried.\n- The mobile Home gesture starts only on its indicator and stays disabled during typing or dialogs. Fast navigation cancels outdated motion.\n\n## Reliability and maintenance\n\n- Nonessential analytics failures no longer block registration or login.\n- Session, cleanup, and content migration services are separated. Cleanup proceeds in bounded batches and remains retryable after failure.\n- First-party code receives consistent static checks. Release validation compares the deployed commit and asset hashes so an old deployment cannot pass as the new release.\n"
      },
      ja: {
        title: "サイト全体の使いやすさと信頼性を改善",
        summary: "歓迎画面を任意表示にし、ツールと画板の入口を整理しました。モバイル操作を安定させ、Knowledgeの全件ページングと検索、転送の下書き・バックグラウンド送信、公開バージョン確認を改善しています。",
        content_markdown: "# サイト全体の使いやすさと信頼性を改善\n\nレスポンシブ表示、見た目、操作、コードの信頼性を全体的に見直しました。デスクトップの XP・ピクセル調と、スマホ専用のレイアウトは維持しています。\n\n## 読む・移動する\n\n- 歓迎画面はホームの「ようこそ・最近の更新」から任意で開けます。記事への直リンクを自動ダイアログで遮りません。\n- Knowledge にページングと公開記事全体を対象としたサーバー検索を追加しました。カテゴリ件数を全件で集計し、同じタグの重複表示をなくしました。\n- 記事リンクで Control／Command クリックなどの標準的な新規タブ操作が使えます。\n\n## ツールとモバイル\n\n- ツールカードは用途を先に説明し、バージョンと技術説明を折りたたみました。動画の内枠をなくし、見出し・概要・日時・再生操作の配置を整えました。\n- 画板 1.0.10 は名前、公開ルーム、合言葉ルーム、最近のボードを整理しました。ヘルプはマウス・キーボード・タッチで利用でき、入力を覆いません。\n- 一時転送 1.0.14 は退室時に未送信の下書きを消去し、ページが隠れてもアップロードを自動中断しません。一時停止と再開、起動失敗後の再試行も改善しました。\n- ホームへ戻るジェスチャーは専用インジケーターからのみ開始します。入力中やダイアログ表示中は無効になり、素早い移動で古いアニメーションが残りません。\n\n## 信頼性と保守\n\n- 補助的なアクセス集計の失敗が登録・ログインを妨げないようにしました。\n- セッション、削除処理、コンテンツ移行を独立したサービスへ分離しました。削除は制限付きのバッチで継続し、失敗時も再試行できます。\n- 自作コードの静的検査を統一し、公開されたコミットと資産ハッシュを照合して古い公開版の誤認を防ぎます。\n"
      },
    }, "2026-09-07T23:00:00.000Z", "2026-09-07T23:00:00.000Z", { insertOnly: true }),
    env.DB.prepare(`
    insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values (
      'seed-update-2026-09-22-cloud-save-10min',
      '2026-09-22-cloud-save-10min',
      'site-updates',
      '["网站更新","游戏区","云存档","可靠性"]',
      '',
      'published',
      0,
      0,
      '2026-09-21T16:24:26.443Z',
      '2026-09-21T16:24:26.443Z',
      '2026-09-21T16:24:26.443Z'
    ) on conflict(article_id) do nothing
    `),
    ...articleTranslationsStatements(env, "seed-update-2026-09-22-cloud-save-10min", {
      zh: {
        title: "游戏云存档调整为每10分钟同步",
        summary: "登录后的游戏自动云同步由30秒调整为10分钟，减少长时间挂机产生的 Cloudflare 请求和 D1 写入；手动“立即同步”和切出页面时的补同步保持不变。",
        content_markdown: "# 游戏云存档调整为每10分钟同步\n\n游戏本地存档仍由浏览器和游戏本体持续保存，只有上传到账号云端的自动同步频率发生变化。\n\n## 本次调整\n\n- 登录后的自动云同步由每30秒一次改为每10分钟一次。\n- 点击“立即同步”仍会立刻尝试上传，不需要等待下一轮计时。\n- 页面切到后台时仍会刷新游戏本地存档并尝试补同步。\n- 云端版本冲突检测、JSON导入导出和本地存档均保持不变。\n\n这项调整主要减少长时间挂机产生的 Pages Functions 请求与 D1 写入，同时继续保留手动同步和离开页面时的保护。"
      },
      en: {
        title: "Game Cloud Saves Now Sync Every 10 Minutes",
        summary: "Signed-in games now auto-sync to the cloud every 10 minutes instead of every 30 seconds, reducing Cloudflare requests and D1 writes during long sessions. Manual Sync Now and the page-hide sync remain immediate.",
        content_markdown: "# Game Cloud Saves Now Sync Every 10 Minutes\n\nGames continue to save locally through the browser and their own save logic. Only the automatic upload cadence for account cloud saves has changed.\n\n## What changed\n\n- Signed-in automatic cloud sync now runs every 10 minutes instead of every 30 seconds.\n- Selecting Sync Now still attempts an upload immediately without waiting for the timer.\n- Moving the page to the background still flushes the local game save and attempts an extra sync.\n- Cloud-version conflict handling, JSON import/export, and local saves are unchanged.\n\nThis reduces Pages Functions requests and D1 writes during long-running sessions while retaining manual and page-exit protection."
      },
      ja: {
        title: "ゲームのクラウド保存を10分間隔に変更",
        summary: "ログイン中のゲームの自動クラウド同期を30秒から10分間隔へ変更し、長時間プレイ時のCloudflareリクエストとD1書き込みを削減しました。手動同期とページを離れる際の補助同期は従来どおり即時です。",
        content_markdown: "# ゲームのクラウド保存を10分間隔に変更\n\nゲーム本体とブラウザーによるローカル保存はこれまでどおり継続します。変更したのは、アカウントのクラウド保存へ自動アップロードする間隔だけです。\n\n## 変更内容\n\n- ログイン中の自動クラウド同期を30秒ごとから10分ごとへ変更しました。\n- 「今すぐ同期」はタイマーを待たず、引き続き即座にアップロードを試みます。\n- ページがバックグラウンドへ移る際も、ローカル保存を更新して補助同期を試みます。\n- クラウド版の競合処理、JSONの入出力、ローカル保存は変更していません。\n\n長時間プレイ時のPages FunctionsリクエストとD1書き込みを減らしながら、手動同期とページ離脱時の保護を維持します。"
      }
    }, "2026-09-21T16:24:26.443Z", "2026-09-21T16:24:26.443Z", { insertOnly: true })
  ];
}
