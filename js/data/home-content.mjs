// Home-only update summaries; no article bodies.
export const homeContent = Object.freeze({
  "updates": [
    {
      "article_id": "seed-update-2026-11-22-pond-icons-close-sync",
      "slug": "2026-11-22-pond-icons-close-sync",
      "category": "site-updates",
      "tags": [
        "site-update",
        "ui"
      ],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-11-22T03:54:00+08:00",
      "updated_at": "2026-11-22T03:54:00+08:00",
      "published_at": "2026-11-22T03:54:00+08:00",
      "fallbackOnly": true,
      "icon": "system",
      "date": "2026.11.22",
      "title": {
        "zh": "统一登录窗关闭按钮、优化知识库翻书图标与聊天室顶沿柔化",
        "en": "Unified Login Close Button, Crisp Open-Book Title Icon & Chatroom Top Fade",
        "ja": "ログイン閉じるボタン統一・知識庫アイコン刷新・チャット上端フェード追加"
      },
      "summary": {
        "zh": "将登录浮层右上角关闭按钮统一为圆形虚线 × 控件、重绘知识库与文章标题栏翻书图标消除方块观感，并为聊天室滚动区增加顶沿渐隐过渡。",
        "en": "Matched the login modal close button to the circular dashed x style, redrew the Knowledge/Article open-book title icon for crispness, and added a soft top-edge scroll fade to the Chatroom log.",
        "ja": "ログイン窓右上の閉じるボタンを他窓と同じ点線丸 × へ統一し、知識庫と記事タイトルの本アイコンを鮮明な見開き SVG へ刷新、チャット上端に自然なフェードマスクを追加しました。"
      }
    },
    {
      "article_id": "seed-update-2026-11-22-pond-home-shell-clear",
      "slug": "2026-11-22-pond-home-shell-clear",
      "category": "site-updates",
      "tags": [
        "site-update",
        "ui"
      ],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-11-22T03:42:00+08:00",
      "updated_at": "2026-11-22T03:42:00+08:00",
      "published_at": "2026-11-22T03:42:00+08:00",
      "fallbackOnly": true,
      "icon": "system",
      "date": "2026.11.22",
      "title": {
        "zh": "修复首页容器背景透明透出池塘画布并统一显示密码按钮",
        "en": "Transparent Home Shell Pass-Through for Pond Canvas & Dark Password Toggle",
        "ja": "ホーム画面の透過調整（池キャンバス表示維持）とパスワード表示ボタン暗色化"
      },
      "summary": {
        "zh": "将首页 .site-shell 及其伪元素背景设为完全透明，确保首页 WebGL2 深夜池塘画布与登录浮层同时完整呈现，并同步将「显示密码」按钮统一为暗色点阵胶囊。",
        "en": "Made .site-shell and its pseudo-elements transparent on Home so the WebGL2 pond canvas renders beneath the centered login modal, and styled the Show Password button in dark CRT glass.",
        "ja": "ホーム画面の .site-shell と疑似要素の背景を完全透過にして WebGL2 の池キャンバスがログイン窓の背後にそのまま表示されるよう修正し、パスワード表示ボタンも暗色点陣スタイルへ統一しました。"
      }
    },
    {
      "article_id": "seed-update-2026-11-22-pond-home-login-z",
      "slug": "2026-11-22-pond-home-login-z",
      "category": "site-updates",
      "tags": [
        "site-update",
        "ui"
      ],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-11-22T03:38:00+08:00",
      "updated_at": "2026-11-22T03:38:00+08:00",
      "published_at": "2026-11-22T03:38:00+08:00",
      "fallbackOnly": true,
      "icon": "system",
      "date": "2026.11.22",
      "title": {
        "zh": "修复首页登录浮层被画布压住的问题并统一登录框暗色点阵控件",
        "en": "Fixed Home Login Popover Z-Index Stacking & Darkened Inner Login Controls",
        "ja": "ホーム画面ログイン窓の重なり順修正と内部コントロール暗色統一"
      },
      "summary": {
        "zh": "调整首页 .site-shell 与池塘背景画布的层级顺序，确保点击左下角 ID 后登录窗直接浮在首页最顶层，同时将登录框内标签页、密码框与底部提示盒统一为暗色 CRT 风格。",
        "en": "Placed .site-shell above the Home pond canvas while preserving pointer passthrough so the login modal renders cleanly on top of Home, and themed the login tabs, password input, and footer note.",
        "ja": "ホーム画面で池キャンバスがログイン窓を覆っていた重なり順を修正し、左下 ID クリック時に画面最前面中央へ確実に表示されるようにしました。タブ・パスワード欄・注記も暗色化しています。"
      }
    },
    {
      "article_id": "seed-update-2026-11-22-pond-qa-sweep",
      "slug": "2026-11-22-pond-qa-sweep",
      "category": "site-updates",
      "tags": [
        "site-update",
        "ui"
      ],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-11-22T03:31:00+08:00",
      "updated_at": "2026-11-22T03:31:00+08:00",
      "published_at": "2026-11-22T03:31:00+08:00",
      "fallbackOnly": true,
      "icon": "system",
      "date": "2026.11.22",
      "title": {
        "zh": "深夜池塘全站桌面端细节精修：视频高对比文字、工具/游戏卡片紧致、聊天室与临时互传换装",
        "en": "Midnight Pond Full Desktop QA Sweep: Bright Video Copy, Compact Tool/Game Cards, Chatroom & Quick Transfer Skin",
        "ja": "深夜の池デスクトップ全窓品質総仕上げ：動画文字視認性・ツール／ゲーム配置・チャット・一時転送対応"
      },
      "summary": {
        "zh": "按全站桌面端逐窗验收清单完成精修：视频高对比标题简介与去遮挡播放徽标、工具/游戏去空白、知识库同行等高齐平、聊天室单行顶栏、关于点阵标题图标、左下语言提亮与临时互传暗色换装。",
        "en": "Resolved every desktop QA checklist item across Videos, Tools, Games, Knowledge, Article Reader, Chatroom, About, Home corner contrast, and the Quick Transfer sub-panel.",
        "ja": "デスクトップ全窓の実機チェック項目を一括修正：動画カード文字の高コントラスト化とサムネイル中央アイコン除去、ツール／ゲーム余白整理、知識庫行揃え、チャット単行ヘッダ、一時転送の暗色対応を完了しました。"
      }
    },
    {
      "article_id": "seed-update-2026-11-22-pond-final-fit",
      "slug": "2026-11-22-pond-final-fit",
      "category": "site-updates",
      "tags": [
        "site-update",
        "ui"
      ],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-11-22T03:28:00+08:00",
      "updated_at": "2026-11-22T03:28:00+08:00",
      "published_at": "2026-11-22T03:28:00+08:00",
      "fallbackOnly": true,
      "icon": "system",
      "date": "2026.11.22",
      "title": {
        "zh": "深夜池塘最终实测收尾：登录窗正居中、视频卡片完整展示与暗色骨架屏",
        "en": "Midnight Pond Final Live-QA Polish: Viewport-Centered Login, Full Video Cards & Dark Skeletons",
        "ja": "深夜の池最終実機調整：ログイン窓中央配置・動画カード全文表示・暗色スケルトン"
      },
      "summary": {
        "zh": "解除顶栏层叠上下文使登录浮层正居中于视口、恢复视频卡片标题与简介完整高度，并将知识库加载骨架条切换为柔和深青点阵色。",
        "en": "Removed header containing-block traps so the login modal centers in the viewport, restored full video card title/description height, and switched Knowledge loading skeletons to soft dark cyan bars.",
        "ja": "隠しヘッダーの包含ブロックを解除してログイン窓を画面中央へ配置し、動画カードのタイトルと概要の高さを復元、知識庫ロード時の白スケルトンを暗色シアンへ統一しました。"
      }
    }
  ]
});
