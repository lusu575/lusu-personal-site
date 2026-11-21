// Home-only update summaries; no article bodies.
export const homeContent = Object.freeze({
  "updates": [
    {
      "article_id": "seed-update-2026-11-22-pond-cascade-root",
      "slug": "2026-11-22-pond-cascade-root",
      "category": "site-updates",
      "tags": [
        "site-update",
        "ui"
      ],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-11-22T04:01:00+08:00",
      "updated_at": "2026-11-22T04:01:00+08:00",
      "published_at": "2026-11-22T04:01:00+08:00",
      "fallbackOnly": true,
      "icon": "system",
      "date": "2026.11.22",
      "title": {
        "zh": "根治路由样式后插层叠顺序问题并彻底移除视频封面中央播放覆盖层",
        "en": "Root Fix for Lazy Route CSS Cascade Order & Removed Center Video Play Overlay",
        "ja": "遅延読み込みルート CSS のカスケード順を根本修正・動画中央再生枠を削除"
      },
      "summary": {
        "zh": "在桥接层监听 document.head 并将 pond-windows.css 固定维持为最后一个样式表，从根源解决 main.js 懒加载 routes/*.css 与 transfer.css 覆盖新视觉层的问题，并直接删除视频封面中央播放覆盖层规则。",
        "en": "Pinned pond-windows.css as the final stylesheet in document.head whenever main.js lazily injects route CSS or transfer.css, and deleted the source center video-thumb play overlay.",
        "ja": "main.js がルート専用 CSS や transfer.css を後から <head> 末尾へ追加しても pond-windows.css が常に最後尾に維持されるよう修正し、動画サムネイル中央の再生枠定義を元から削除しました。"
      }
    },
    {
      "article_id": "seed-update-2026-11-22-pond-eager-covers",
      "slug": "2026-11-22-pond-eager-covers",
      "category": "site-updates",
      "tags": [
        "site-update",
        "ui"
      ],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-11-22T03:59:00+08:00",
      "updated_at": "2026-11-22T03:59:00+08:00",
      "published_at": "2026-11-22T03:59:00+08:00",
      "fallbackOnly": true,
      "icon": "system",
      "date": "2026.11.22",
      "title": {
        "zh": "修复游戏区封面与关于页头像在窗口切换时懒加载停滞的问题",
        "en": "Fixed Lazy-Image Stall on Game Covers & About Avatar After Route Switch",
        "ja": "ゲーム表紙・概要アバターのルート切替時遅延読み込み停滞を修正"
      },
      "summary": {
        "zh": "在游戏区封面换装、工具区图标与关于页激活时强制切换图片为 eager 即时加载，彻底解决切换路由后封面与头像偶发黑框未解码的问题。",
        "en": "Forced eager loading on game covers, tool icons, and the About avatar when activating those windows so covers and avatars never stall as blank frames.",
        "ja": "ゲーム表紙・ツールアイコン・概要アバターのウィンドウ表示時に即時読み込み（eager）を強制し、黒い空枠のまま止まる現象を解消しました。"
      }
    },
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
    }
  ]
});
