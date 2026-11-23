// Home-only update summaries; no article bodies.
export const homeContent = Object.freeze({
  "updates": [
    {
      "article_id": "seed-update-2026-11-23-pond-chat-input-scrollbar",
      "slug": "2026-11-23-pond-chat-input-scrollbar",
      "category": "site-updates",
      "tags": [
        "site-updates",
        "chatroom",
        "ui"
      ],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-11-23T20:20:00+08:00",
      "updated_at": "2026-11-23T20:20:00+08:00",
      "published_at": "2026-11-23T20:20:00+08:00",
      "fallbackOnly": true,
      "icon": "system",
      "title": {
        "zh": "聊天室输入框荧光细滚动条统一与发送按钮防重叠修复",
        "en": "Chatroom Input Phosphor Scrollbar & Send Button Overlap Fix",
        "ja": "チャット入力欄の蛍光細スクロールバー統一と送信ボタン重なり修正"
      },
      "summary": {
        "zh": "将聊天室输入框滚动条统一为深青荧光细条样式，隔离输入域与右侧字数统计及圆形发送按钮的弹性布局，彻底消除旧版白色滚动条遮挡按钮的问题。",
        "en": "Unified the chatroom textarea scrollbar with the dark phosphor thin scrollbar style and isolated the input field from the counter and circular send button to prevent overlap.",
        "ja": "チャット入力欄のスクロールバーをサイト統一の深青蛍光細スタイルへ刷新し、文字数表示と丸型送信ボタンとの重なりを解消しました。"
      }
    },
    {
      "article_id": "seed-update-2026-11-23-pond-crt-glass-pilot",
      "slug": "2026-11-23-pond-crt-glass-pilot",
      "category": "site-updates",
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-11-23T18:15:00+08:00",
      "updated_at": "2026-11-23T18:15:00+08:00",
      "published_at": "2026-11-23T18:15:00+08:00",
      "fallbackOnly": true,
      "icon": "system",
      "title": {
        "zh": "CRT 折射玻璃统一参数表与欢迎窗主按钮按压波纹试点上线",
        "en": "CRT Refractive Glass Unified Config & Welcome Modal Button Press Pilot",
        "ja": "CRT 屈折ガラス統一パラメータ表＆ようこそボタン波紋パイロット実装"
      },
      "summary": {
        "zh": "按 CRT 折射玻璃适配方案落地步骤 2–3：建立全站唯一权威玻璃与阻尼弹簧参数表，并在欢迎窗快捷按钮试点接触点高斯凹陷、320ms 非线性释放波与边缘吃光反馈，静默零重绘。",
        "en": "Implemented Steps 2–3 of the CRT Refractive Glass specification: single authoritative optical/spring token table and Welcome modal quick-link button pilot with off-center Gaussian indent, 320ms non-linear release wave, 70ms rim catch, and idle-stop.",
        "ja": "CRT 屈折ガラス仕様のステップ 2–3 を反映：光学・バネ物理の単一パラメータ定義を作成し、ようこそ画面ボタンで接触点ガウス凹み・320ms 非線形リリース波・縁発光をパイロット実装しました。"
      }
    },
    {
      "article_id": "seed-update-2026-11-23-pond-remove-corner-dock",
      "slug": "2026-11-23-pond-remove-corner-dock",
      "category": "site-updates",
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-11-23T16:12:00+08:00",
      "updated_at": "2026-11-23T16:12:00+08:00",
      "published_at": "2026-11-23T16:12:00+08:00",
      "fallbackOnly": true,
      "icon": "system",
      "title": {
        "zh": "下线首页右下角「在线 / 公告」胶囊并清理专属样式",
        "en": "Removed Bottom-Right Online & Notice Capsules and Dedicated Styles",
        "ja": "右下「オンライン／お知らせ」カプセルと専用スタイルを完全撤去"
      },
      "summary": {
        "zh": "彻底移除桌面与移动端首页右下角「在线」状态胶囊与「公告」入口按钮及其容器、脚本与全部专属 CSS，画面更纯净；欢迎窗弹窗本体保留不变。",
        "en": "Completely removed the bottom-right #pond-corner-dock container (Online status pill and Notice button) along with all dedicated scripts and CSS; the Welcome modal itself remains intact.",
        "ja": "ホーム右下の #pond-corner-dock（オンライン表示・お知らせボタン）と関連スクリプト・専用 CSS をすべて削除し画面をすっきり整理しました。ようこそモーダル本体はそのまま維持しています。"
      }
    },
    {
      "article_id": "seed-update-2026-11-23-pond-crt-boot-preloader",
      "slug": "2026-11-23-pond-crt-boot-preloader",
      "category": "site-updates",
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-11-23T15:00:00+08:00",
      "updated_at": "2026-11-23T15:00:00+08:00",
      "published_at": "2026-11-23T15:00:00+08:00",
      "fallbackOnly": true,
      "icon": "system",
      "title": {
        "zh": "纯代码 CRT 进站启动动画与全站 32 项素材预加载上线",
        "en": "Pure-Code CRT Pond Boot Sequence & 32-Asset Site-Wide Preloader",
        "ja": "純コード CRT 起動アニメーションと全サイト 32 素材プリロード実装"
      },
      "summary": {
        "zh": "交互与动画专项第一项上线：纯代码复用池塘自身 WebGL2 CRT 管线绘制无边框荧光亮线展开与分层显影，从冷加载第 0 帧接管画面，启动期间并行预加载并解码全站 32 项素材，结尾无缝交接首页本体。",
        "en": "Animation Phase Item 1: pure-code borderless CRT power-on beam reusing the live WebGL2 Pond pipeline, taking over from Frame 0 on cold load while preloading and decoding all 32 site assets with seamless final-frame handoff.",
        "ja": "アニメーション強化第1弾：動画を使わず池本体の WebGL2 CRT パイプラインで起動演出を生成し、初回ロード0フレーム目から黒画面を防止。全32素材を並列プリロード＆デコードし、最終フレームがそのままホームへシームレス接続します。"
      }
    },
    {
      "article_id": "seed-update-2026-11-23-pond-game-covers-webp-zero-flash",
      "slug": "2026-11-23-pond-game-covers-webp-zero-flash",
      "category": "site-updates",
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-11-23T14:37:00+08:00",
      "updated_at": "2026-11-23T14:37:00+08:00",
      "published_at": "2026-11-23T14:37:00+08:00",
      "fallbackOnly": true,
      "icon": "system",
      "title": {
        "zh": "游戏封面 WebP 瘦身 93 倍、下架旧彩色图标与全站首帧防闪跳",
        "en": "93x Smaller WebP/SVG Game Covers, Legacy Icon Removal & Zero-Flash First Paint",
        "ja": "ゲーム表紙 WebP 93倍軽量化・旧カラーアイコン撤去と初回描画ちらつき解消"
      },
      "summary": {
        "zh": "将游戏区封面从 5.53 MB PNG 压缩为 59.3 KB WebP 与独立 SVG，目录配置直指新版封面并彻底删除 5 张旧彩色 PNG，同时加入首帧同步模式初始化脚本消除页面闪跳。",
        "en": "Compressed game covers from 5.53 MB PNGs into 59.3 KB WebP and standalone SVGs, updated games/catalog.json directly, removed 5 legacy colorful PNG icons, and added synchronous head mode initialization to prevent first-frame layout flashes.",
        "ja": "ゲーム表紙を 5.53 MB PNG から 59.3 KB WebP と独立 SVG へ圧縮し、catalog.json を新版へ直結・旧カラー PNG 5枚を完全削除。head 同期初期化で初回フレームのレイアウトちらつきも解消しました。"
      }
    }
  ]
});
