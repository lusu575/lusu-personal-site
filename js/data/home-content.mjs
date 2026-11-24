// Home-only update summaries; no article bodies.
export const homeContent = Object.freeze({
  "updates": [
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
    },
    {
      "article_id": "seed-update-2026-11-24-window-crisp-native-dpr",
      "slug": "2026-11-24-window-crisp-native-dpr",
      "category": "site-updates",
      "tags": [
        "site-updates",
        "ui",
        "performance"
      ],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-11-24T15:19:00+08:00",
      "updated_at": "2026-11-24T15:19:00+08:00",
      "published_at": "2026-11-24T15:19:00+08:00",
      "fallbackOnly": true,
      "icon": "system",
      "title": {
        "zh": "修复知识库及全站窗口打开后文字图标发糊问题",
        "en": "Fix Blurry Window Text & Icons After Unified Zoom (1:1 Native DPR Reset)",
        "ja": "ウィンドウ拡大後の文字・アイコンぼやけ修正（1:1 ネイティブ解像度再描画）"
      },
      "summary": {
        "zh": "移除初帧极小缩放时的 will-change: transform 并在动画结束执行两帧原生像素层重置，确保知识库及全部板块窗口定格后严格按 1:1 原生分辨率锐利重绘，同时保持 120 FPS 一体缩放。",
        "en": "Removed will-change: transform during initial tiny-scale frames and added a two-frame native-DPI layer reset on settle so Knowledge and all section windows crisp up at exact 1:1 native resolution.",
        "ja": "縮小開始時の will-change: transform を外し、アニメーション終了時に2フレームのネイティブ解像度リセットを行うことで、知識庫を含む全ウィンドウの文字・アイコンを鮮明に定格させました。"
      }
    },
    {
      "article_id": "seed-update-2026-11-24-window-unified-content-zoom",
      "slug": "2026-11-24-window-unified-content-zoom",
      "category": "site-updates",
      "tags": [
        "site-updates",
        "animation",
        "ui",
        "performance"
      ],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-11-24T14:55:00+08:00",
      "updated_at": "2026-11-24T14:55:00+08:00",
      "published_at": "2026-11-24T14:55:00+08:00",
      "fallbackOnly": true,
      "icon": "system",
      "title": {
        "zh": "窗口外壳与内容一体化同步缩放开合动画上线",
        "en": "Unified Single-Layer GPU Window & Content Zoom Animation",
        "ja": "ウィンドウ枠・コンテンツ一体型 120 FPS 同期ズーム開閉実装"
      },
      "summary": {
        "zh": "改为单层 GPU 整窗同步缩放路线：打开时窗口边框、图标与全部内容从第 0 帧即随窗口一起从图标处连续放大长出，关闭时一起缩回原图标，无外壳/内容脱节、无边框残影、保持 120 FPS 合成。",
        "en": "Switched window open/close transitions to unified single-layer GPU scaling so window borders, icons, and content grow and shrink together from Frame 0 with zero shell/content disconnect, zero border ghosting, and 120 FPS compositor performance.",
        "ja": "別枠フェードを廃止し、ウィンドウ枠と内部のアイコン・テキストを単一 GPU レイヤーとして 0 フレームからアイコン位置より一体で拡大展開・縮小収納する方式へ刷新しました。"
      }
    }
  ]
});
