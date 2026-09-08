// Current release only. Historical seed data lives in article-seeds.mjs.
export function articleReleaseSeedStatements(env, { articleTranslationsStatements }) {
  return [
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
    }, "2026-09-07T23:00:00.000Z", "2026-09-07T23:00:00.000Z", { insertOnly: true })
  ];
}
