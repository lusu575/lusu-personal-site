// Home-only update summaries; no article bodies.
export const homeContent = Object.freeze({
  "updates": [
    {
      "article_id": "seed-update-2026-11-24-glass-dynamic-pilot-r76",
      "slug": "crt-glass-pilot-dynamic-hover-and-expanding-wave-r76",
      "category": "site-updates",
      "tags": [
        "视觉更新",
        "液态玻璃试点",
        "按钮动效"
      ],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-11-24T19:00:00+08:00",
      "updated_at": "2026-11-24T19:00:00+08:00",
      "published_at": "2026-11-24T19:00:00+08:00",
      "fallbackOnly": true,
      "icon": "system",
      "title": {
        "zh": "视觉优化：欢迎窗液态玻璃按钮试点动态化升级（r76）",
        "en": "Visual Polish: Dynamic Liquid Glass Pilot for Welcome Buttons (r76)",
        "ja": "ビジュアル調整：ようこそ画面ガラス試作ボタンの動的屈折強化（r76）"
      },
      "summary": {
        "zh": "清除旧版 transition 对弹簧形变的阻尼干扰，新增随指针流动的液态玻璃高光、按住呼吸扩散折光环与清晰的 440ms 释放扩散波，严格限定在第 3 步试点范围。",
        "en": "Removes legacy CSS transition lag on the Step-3 pilot buttons and adds live pointer-tracking liquid sheen, breathing hold refraction, and a 440ms expanding release wave.",
        "ja": "旧 CSS transition 干渉を除去し、ポインタ追従の液状ハイライト・押下中の呼吸屈折リング・440ms 拡散リリース波をステップ3試作範囲のみに実装しました。"
      }
    },
    {
      "article_id": "seed-update-2026-11-24-wind-water-and-shift-enter-r75",
      "slug": "pond-wind-sweep-water-caustics-and-shift-enter-r75",
      "category": "site-updates",
      "tags": [
        "视觉更新",
        "水面水光",
        "季节风吹过渡",
        "聊天室"
      ],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-11-24T18:05:00+08:00",
      "updated_at": "2026-11-24T18:05:00+08:00",
      "published_at": "2026-11-24T18:05:00+08:00",
      "fallbackOnly": true,
      "icon": "system",
      "title": {
        "zh": "视觉与交互优化：水面水光质感重做、季节风吹式过渡与聊天室 Shift+Enter 同步换行（r75）",
        "en": "Visual & UX Polish: Silk Pond Caustics, Wind-Sweep Seasons & Synchronous Shift+Enter (r75)",
        "ja": "ビジュアル＆操作改善：水面光の刷新・風吹き季節切替・チャット Shift+Enter 同期改行（r75）"
      },
      "summary": {
        "zh": "重做池塘低频柔和霓虹水光并改用连续相位消除切季抽动；撤掉发光光波，改为一阵风携带当季碎屑横向吹过、景物原地换季；修复聊天室连打 Shift+Enter 丢换行。",
        "en": "Replaces aliased water stripes with soft low-frequency cross-caustics and continuous phase integration, swaps the season glow ring for a 1.0s wind gust carrying seasonal debris, and fixes rapid Shift+Enter newlines in Chat.",
        "ja": "水面光を低周波の滑らかな光と連続位相へ刷新し、季節切替の発光リングを撤去して当季の粒子を運ぶ一陣の風へ変更、さらにチャット連続入力時の Shift+Enter 改行落ちを修正しました。"
      }
    },
    {
      "article_id": "seed-update-2026-11-24-glass-pilot-visibility-r74",
      "slug": "crt-glass-pilot-button-refraction-and-specificity-r74",
      "category": "site-updates",
      "tags": [
        "视觉更新",
        "液态玻璃试点",
        "按钮动效"
      ],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-11-24T16:25:00+08:00",
      "updated_at": "2026-11-24T16:25:00+08:00",
      "published_at": "2026-11-24T16:25:00+08:00",
      "fallbackOnly": true,
      "icon": "system",
      "title": {
        "zh": "视觉优化：修复欢迎窗液态玻璃按钮试点优先级覆盖并提升按压折光可见度（r74）",
        "en": "Visual Polish: Fix Welcome CRT Glass Pilot Specificity & Press Refraction (r74)",
        "ja": "ビジュアル調整：ようこそ画面ガラス試作ボタンの優先度上書きと押下屈折の視認性を修正（r74）"
      },
      "summary": {
        "zh": "修复 #welcome-modal .quick-link:hover 覆盖液态玻璃边缘亮边规则的问题，补齐按下第 0 帧同步下压与局部折光反馈，保持深色点阵克制质感。",
        "en": "Fixes CSS specificity where :hover overrode the CRT glass rim-catch glow on #welcome-modal .quick-link and adds synchronous Frame-0 press refraction.",
        "ja": "ようこそ画面クイックボタンのホバー規則がガラス縁発光を上書きしていた不具合を修正し、押下第0フレームからの沈み込みと局所屈折を視認可能に調整しました。"
      }
    },
    {
      "article_id": "seed-update-2026-11-24-welcome-lock-and-scrollbar-r73",
      "slug": "welcome-modal-zero-jitter-and-zero-legacy-scrollbar-r73",
      "category": "site-updates",
      "tags": [
        "视觉更新",
        "窗口动效",
        "滚动条",
        "性能"
      ],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-11-24T15:55:00+08:00",
      "updated_at": "2026-11-24T15:55:00+08:00",
      "published_at": "2026-11-24T15:55:00+08:00",
      "fallbackOnly": true,
      "icon": "system",
      "title": {
        "zh": "视觉优化：修复欢迎窗开合抖动与关于窗老版滚动条闪现（r73）",
        "en": "Visual Polish: Fix Welcome Modal Jitter & Legacy Scrollbar Flash (r73)",
        "ja": "ビジュアル調整：ようこそ画面のガタつきと旧スクロールバー瞬間表示を修正（r73）"
      },
      "summary": {
        "zh": "同步拦截并取消触发欢迎窗时挂载的旧版 WAAPI 弹窗动画，同时彻底隐藏关于窗及所有窗口缩放过程中的老版原生滚动条闪现。",
        "en": "Synchronously cancels the legacy WAAPI modal animation that hijacked the Welcome window zoom and eliminates the 15px native scrollbar flash during About and window open animations.",
        "ja": "ようこそ画面の開閉を妨げていた旧 WAAPI モーダルアニメーションを即時キャンセルし、概要ウィンドウ開閉時のネイティブスクロールバー瞬間表示を完全に解消しました。"
      }
    },
    {
      "article_id": "seed-update-2026-11-24-window-zero-jitter-settle",
      "slug": "2026-11-24-window-zero-jitter-settle",
      "category": "site-updates",
      "tags": [
        "site-updates",
        "ui",
        "performance"
      ],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-11-24T15:29:00+08:00",
      "updated_at": "2026-11-24T15:29:00+08:00",
      "published_at": "2026-11-24T15:29:00+08:00",
      "fallbackOnly": true,
      "icon": "system",
      "title": {
        "zh": "消除窗口定格末帧抖动与「关于」高度跳变",
        "en": "Eliminate Window Settle Jitter & About Height Shift",
        "ja": "ウィンドウ定格時の微振動および「概要」高さジャンプ解消"
      },
      "summary": {
        "zh": "移除窗口打开结束时的 1 帧毛玻璃切换跳变，防止底层水光透过毛玻璃引起静止窗口微颤，并锁定「关于」窗口定高消除异步加载跳位。",
        "en": "Removed the end-of-open 1-frame backdrop-filter toggle snap, stabilized window surface against moving pond light underneath, and locked About window height to eliminate post-open vertical jumps.",
        "ja": "開閉終了時の 1 フレーム backdrop-filter 切替によるブレを廃止し、「概要」ウィンドウの高さを固定して非同期読み込み後の縦ズレを解消しました。"
      }
    }
  ]
});
