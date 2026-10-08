// Active migration bundle. Keep the immediately preceding insert-only release here so
// databases upgrading across either release retain both public update records.
export function articleReleaseSeedStatements(env, { articleTranslationsStatements }) {
  return [
    env.DB.prepare(`insert into articles (article_id, slug, category, tags, cover_image, status, is_pinned, view_count, created_at, updated_at, published_at) values ('seed-update-2026-10-08-dynamic-protection', '2026-10-08-dynamic-protection', 'site-updates', '["网站更新","可靠性","工具"]', '', 'published', 0, 0, '2026-10-08T15:00:00.000Z', '2026-10-08T15:00:00.000Z', '2026-10-08T15:00:00.000Z') on conflict(article_id) do nothing`),
    ...articleTranslationsStatements(env, "seed-update-2026-10-08-dynamic-protection", {
  "zh": {
    "title": "动态功能增加资源保护",
    "summary": "需要联网保存、协作和互传的功能在保护暂停时暂不可用，首页、静态内容与本地游戏仍可使用。恢复后也会在预算或计量异常时停止操作。",
    "content_markdown": "# 动态功能增加资源保护\n\n需要联网保存、协作和互传的功能在保护暂停时暂不可用，首页、静态内容与本地游戏仍可使用。恢复后也会在预算或计量异常时停止操作。\n\n- 在线画板 1.0.11 与临时互传 1.0.15 在额度不足时暂停上传、下载和协作；管理员遵守相同的资源保护。\n- 动态功能暂停不删除已有账号、云存档或画板。未确认的云保存不能视为已成功；请保留本地进度，恢复后再同步。\n- 静态页面、工具资源和支持本地运行的游戏继续提供。需要数据库的文章、搜索和账号功能可能暂不可用。\n- 过期文件只有确认物理删除后才移除对应记录，清理每次处理有限数量。画板开始清理后暂不允许重新入房或编辑；删除完成后，同一密码可进入全新空画板。\n- 此保护用于降低意外按量消耗风险，不构成零账单承诺。"
  },
  "en": {
    "title": "Resource Protection for Dynamic Features",
    "summary": "Cloud saves, collaboration, and file transfer pause when resource protection is active. Home, static content, and local games remain available. Restored features also stop when budgets or metering cannot be trusted.",
    "content_markdown": "# Resource Protection for Dynamic Features\n\nCloud saves, collaboration, and file transfer pause when resource protection is active. Home, static content, and local games remain available. Restored features also stop when budgets or metering cannot be trusted.\n\n- Whiteboard 1.0.11 and Quick Transfer 1.0.15 pause uploads, downloads, and collaboration when capacity runs out. Administrators follow the same resource protection.\n- Pausing dynamic features does not delete accounts, cloud saves, or boards. An unconfirmed cloud save is not a successful save; keep local progress and synchronize after service resumes.\n- Static pages, tool assets, and games that support local play remain available. Database articles, search, and account features may be unavailable.\n- Expired file records remain until physical deletion is confirmed. Cleanup runs in bounded batches. Boards undergoing cleanup cannot be rejoined or edited; after deletion finishes, the same password opens a new empty board.\n- This protection reduces unexpected usage risk; it is not a promise of zero charges."
  },
  "ja": {
    "title": "動的機能のリソース保護",
    "summary": "リソース保護の停止中はクラウド保存、共同作業、一時転送を利用できません。ホーム、静的コンテンツ、ローカルゲームは引き続き使えます。再開後も予算や計測に問題があると処理を停止します。",
    "content_markdown": "# 動的機能のリソース保護\n\nリソース保護の停止中はクラウド保存、共同作業、一時転送を利用できません。ホーム、静的コンテンツ、ローカルゲームは引き続き使えます。再開後も予算や計測に問題があると処理を停止します。\n\n- 画板 1.0.11 と一時転送 1.0.15 は、上限に達するとアップロード、ダウンロード、共同編集を停止します。管理者にも同じ保護が適用されます。\n- 動的機能の停止だけで、アカウント、クラウドセーブ、画板を削除することはありません。確認されていない保存は成功扱いにせず、ローカルの進行状況を保持して再開後に同期してください。\n- 静的ページ、ツールのファイル、ローカル実行に対応したゲームは引き続き使えます。データベースを使う記事、検索、アカウント機能は一時的に利用できない場合があります。\n- 期限切れファイルは物理削除の確認後に記録を削除します。清掃は有限件数ずつ進めます。清掃中の画板には再入室や編集ができません。削除完了後、同じパスワードで新しい空の画板に入れます。\n- この保護は想定外の従量利用を減らすものであり、請求がゼロになる保証ではありません。"
  }
}, "2026-10-08T15:00:00.000Z"),
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
