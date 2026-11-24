// Home-only update summaries; no article bodies.
export const homeContent = Object.freeze({
  "updates": [
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
    },
    {
      "article_id": "seed-update-2026-11-24-autumn-lotus-withered-yellow",
      "slug": "2026-11-24-autumn-lotus-withered-yellow",
      "category": "site-updates",
      "tags": [
        "site-updates",
        "pond",
        "ui"
      ],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-11-24T14:47:00+08:00",
      "updated_at": "2026-11-24T14:47:00+08:00",
      "published_at": "2026-11-24T14:47:00+08:00",
      "fallbackOnly": true,
      "icon": "system",
      "title": {
        "zh": "秋季池塘荷叶枯黄变色与卷边质感实装",
        "en": "Autumn Pond Withered Yellow & Curled Lotus Pads",
        "ja": "秋の池・蓮葉の黄変と縁カール質感を追加"
      },
      "summary": {
        "zh": "将秋季终态荷叶由暗绿实装为枯黄/赭金色，并叠加干枯微卷叶缘细节，单次烘焙进静态纹理保持 120 FPS 零额外开销。",
        "en": "Updated settled autumn lotus pads from dark green to warm withered golden-ochre with subtle curled rim highlights, baked once into the static GPU texture at zero per-frame cost.",
        "ja": "秋の蓮葉を暗緑色から枯れ黄色・黄土色へ刷新し、乾燥してわずかに反り返った縁の質感を追加しました。起動時に一度だけベイクするためフレーム負荷はゼロです。"
      }
    },
    {
      "article_id": "seed-update-2026-11-24-window-morph-border-and-about-size",
      "slug": "2026-11-24-window-morph-border-and-about-size",
      "category": "site-updates",
      "tags": [
        "site-updates",
        "animation",
        "ui"
      ],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-11-24T14:40:00+08:00",
      "updated_at": "2026-11-24T14:40:00+08:00",
      "published_at": "2026-11-24T14:40:00+08:00",
      "fallbackOnly": true,
      "icon": "system",
      "title": {
        "zh": "窗口开合动画双向无残影修复与「关于 / 游戏」精准定尺",
        "en": "Window Morph Zero-Ghosting Border Fix & Exact About/Games Sizing",
        "ja": "ウィンドウ開閉の枠残像解消と「概要／ゲーム」サイズ安定化"
      },
      "summary": {
        "zh": "修复开合动画期间窗口本体外框优先级穿透导致的双向边框残影，以及「关于」窗口冷开误用通用大图退路引起的先大后缩问题，并对齐游戏区终态定高。",
        "en": "Fixed CSS specificity leakage that caused outer border ghosting during open and close transitions, and added exact per-section fallback sizing so the About and Games windows never pop larger or jump height.",
        "ja": "開閉アニメーション中の外枠 CSS 詳細度競合による残像を解消し、「概要」ウィンドウの一時的な拡大および「ゲーム」画面の高さジャンプを修正しました。"
      }
    }
  ]
});
