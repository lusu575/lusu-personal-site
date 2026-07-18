// Home-only update summaries; intentionally excludes article bodies and non-Home route data.
export const homeContent = Object.freeze({
  "updates": [
    {
      "article_id": "seed-update-2026-07-18-resource-icons-layout",
      "slug": "2026-07-18-resource-icons-layout",
      "category": "site-updates",
      "tags": ["Resources", "Quick Transfer", "UI", "mobile", "QA"],
      "cover_image": "",
      "status": "published",
      "is_pinned": 1,
      "created_at": "2026-07-18T15:35:00.000Z",
      "updated_at": "2026-07-18T15:35:00.000Z",
      "published_at": "2026-07-18T15:35:00.000Z",
      "fallbackOnly": true,
      "icon": "system",
      "date": "2026.07.18",
      "title": {
        "zh": "资源区图标与排版修复",
        "en": "Resources Icon and Layout Fixes",
        "ja": "リソースのアイコンとレイアウト修正"
      },
      "summary": {
        "zh": "修复临时互传整套图标的洋红底色，收紧资源卡片与互传登录布局，并保证关闭互传后准确恢复资源列表；安全、API 与数据边界不变。",
        "en": "The magenta background across the Quick Transfer icon atlas is removed, Resources cards and the sign-in layout are tightened, and closing Transfer now restores the exact Resources list state; security, API, and data boundaries are unchanged.",
        "ja": "一時転送のアイコン atlas 全体に残っていたマゼンタ背景を除去し、リソースカードとログイン画面を整理しました。転送を閉じるとリソース一覧の状態を正確に復元し、安全性、API、データ境界は変更していません。"
      }
    },
    {
      "article_id": "seed-update-2026-07-18-public-site-100-complete",
      "slug": "2026-07-18-public-site-100-complete",
      "category": "site-updates",
      "tags": ["performance", "UX", "accessibility", "mobile", "security", "QA"],
      "cover_image": "",
      "status": "published",
      "is_pinned": 1,
      "created_at": "2026-07-18T04:00:00.000Z",
      "updated_at": "2026-07-18T04:00:00.000Z",
      "published_at": "2026-07-18T04:00:00.000Z",
      "fallbackOnly": true,
      "icon": "system",
      "date": "2026.07.18",
      "title": {
        "zh": "公开主站 100 项优化与稳定性复查完成",
        "en": "100 Public-Site Improvements and Stability Recheck",
        "ja": "公開サイト 100 項目の改善と安定性再確認"
      },
      "summary": {
        "zh": "公开主站 100 项优化及稳定性复查已完成：修复冷启动 Chat 图标、短屏头像和移动 Dock 切换闪失，并以全动效中间帧、快速连续切换及竖横屏截图重新验证。",
        "en": "All 100 public-site improvements and the stability recheck are complete: cold-start Chat icons, short-screen avatars, and mobile Dock flicker are fixed and reverified with full-motion intermediate frames, rapid switching, and portrait/landscape screenshots.",
        "ja": "公開サイト 100 項目の改善と安定性再確認を完了しました。初回表示の Chat アイコン、短画面のアバター、モバイル Dock の切替時の消失を修正し、フルモーションの中間フレーム、連続切替、縦横画面のスクリーンショットで再検証しています。"
      }
    },
    {
      "article_id": "seed-update-2026-07-18-reliable-forms-reading-chat",
      "slug": "2026-07-18-reliable-forms-reading-chat",
      "category": "site-updates",
      "tags": [
        "account",
        "reading",
        "chat",
        "privacy",
        "accessibility",
        "QA"
      ],
      "cover_image": "",
      "status": "published",
      "is_pinned": 1,
      "created_at": "2026-07-18T00:26:00.000Z",
      "updated_at": "2026-07-18T00:26:00.000Z",
      "published_at": "2026-07-18T00:26:00.000Z",
      "fallbackOnly": true,
      "icon": "system",
      "date": "2026.07.18",
      "title": {
        "zh": "账号、阅读与聊天可靠性升级",
        "en": "More Reliable Account, Reading, and Chat Flows",
        "ja": "アカウント・閲覧・Chat の信頼性向上"
      },
      "summary": {
        "zh": "账号表单改为稳定 DOM 与明确登录/注册模式，文章只保留正文滚动并使用 4px 进度条；Chat 保留在途新草稿和私聊安全说明，公共隐私闸门同步加固。",
        "en": "Account forms now keep a stable DOM with explicit sign-in and registration modes; articles use one content scroller and a 4px progress track; Chat preserves in-flight drafts and private-room safety guidance while public privacy gates are tightened.",
        "ja": "アカウントフォームを安定 DOM と明確なログイン／登録モードに変更し、記事は一つの本文スクロールと 4px の進捗線を使用します。Chat は送信中の新しい下書きと非公開ルームの安全説明を保持し、公開プライバシー境界も強化しました。"
      }
    },
    {
      "article_id": "seed-update-2026-07-18-route-lazy-transfer",
      "slug": "2026-07-18-route-lazy-transfer",
      "category": "site-updates",
      "tags": [
        "performance",
        "lazy-loading",
        "routes",
        "transfer",
        "UX",
        "QA"
      ],
      "cover_image": "",
      "status": "published",
      "is_pinned": 1,
      "created_at": "2026-07-17T23:35:00.000Z",
      "updated_at": "2026-07-17T23:35:00.000Z",
      "published_at": "2026-07-17T23:35:00.000Z",
      "fallbackOnly": true,
      "icon": "system",
      "date": "2026.07.18",
      "title": {
        "zh": "路由与临时互传按需加载",
        "en": "On-Demand Routes and Quick Transfer",
        "ja": "ルートと一時転送のオンデマンド読込"
      },
      "summary": {
        "zh": "Home 初始数据缩至约 8 KB 的五条更新摘要；五个业务路由与四份重样式首次进入时加载并复用，Quick Transfer 只在真实 CTA 点击后加载完整链路，失败可重试且离开不误初始化。",
        "en": "Home now starts with about 8 KB of five update summaries; five route modules and four heavy styles load once on first entry, while Quick Transfer loads its full chain only after a real CTA click with retry-safe, leave-safe initialization.",
        "ja": "Home の初期データを約 8 KB・5 件の更新要約に縮小し、5 つのルートモジュールと 4 つの重い CSS は初回進入時だけ読み込みます。一時転送は実際の CTA 操作後に全構成を読み込み、再試行と離脱競合にも対応します。"
      }
    },
    {
      "article_id": "seed-update-2026-07-18-mobile-viewport-keyboard",
      "slug": "2026-07-18-mobile-viewport-keyboard",
      "category": "site-updates",
      "tags": [
        "mobile",
        "viewport",
        "keyboard",
        "focus",
        "accessibility",
        "QA"
      ],
      "cover_image": "",
      "status": "published",
      "is_pinned": 1,
      "created_at": "2026-07-17T22:08:00.000Z",
      "updated_at": "2026-07-17T22:08:00.000Z",
      "published_at": "2026-07-17T22:08:00.000Z",
      "fallbackOnly": true,
      "icon": "system",
      "date": "2026.07.18",
      "title": {
        "zh": "移动视口与软键盘统一避让",
        "en": "Unified Mobile Viewport and Keyboard Avoidance",
        "ja": "モバイルビューポートとキーボード回避の統合"
      },
      "summary": {
        "zh": "移动端现在统一处理安全区、地址栏收放、旋转、页面缩放与软键盘状态；Chat、账号、搜索和 Transfer 会在同一滚动容器内保持输入、提交与反馈可见。",
        "en": "Mobile safe areas, browser chrome, rotation, page zoom, and on-screen keyboard states now share one viewport model, keeping Chat, account, search, and Transfer controls visible inside one scroll owner.",
        "ja": "モバイルのセーフエリア、ブラウザー UI、回転、ページ拡大、画面キーボードを一つのビューポートモデルで扱い、Chat、アカウント、検索、Transfer の操作を同じスクロール領域内で表示します。"
      }
    }
  ]
});
