// Home-only update summaries; no article bodies.
export const homeContent = Object.freeze({
  "updates": [
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
    },
    {
      "article_id": "seed-update-2026-11-24-season-wavefront-in-place",
      "slug": "2026-11-24-season-wavefront-in-place",
      "category": "site-updates",
      "tags": [
        "site-updates",
        "animation",
        "pond",
        "ui"
      ],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-11-24T14:33:00+08:00",
      "updated_at": "2026-11-24T14:33:00+08:00",
      "published_at": "2026-11-24T14:33:00+08:00",
      "fallbackOnly": true,
      "icon": "system",
      "title": {
        "zh": "首页池塘季节切换「就地演变」波前与粒子重做上线",
        "en": "Pond Season Switch In-Place Wavefront Evolution & Particle Redesign",
        "ja": "池の季節切替「その場変化」波面エフェクト＆パーティクル刷新"
      },
      "summary": {
        "zh": "彻底废弃旧版中心聚拢星尘漩涡，改用 1.0 秒风纹波前扫过池面：荷叶、花瓣、霜纹与水色全部钉在原位渐变枯荣，波前经过锦鲤触发轻微受惊加速，过渡微粒精简至 42 颗克制点阵微尘且可随时反向打断。",
        "en": "Replaced the center-gather stardust vortex with a 1.0s interruptible breeze wavefront: flora, lotus pads, frost edges, and water colors evolve strictly in-place with 42 restrained wavefront motes and natural koi startle reactions.",
        "ja": "中央収束の星屑渦を廃止し、1.0 秒の風波面で池の景物がその場で変化する演出へ刷新しました。42 粒の控えめなドット微塵、四季ごとのその場変化、波面通過時の錦鯉の驚き加速に対応しています。"
      }
    },
    {
      "article_id": "seed-update-2026-11-24-window-morph-single-shell-polish",
      "slug": "2026-11-24-window-morph-single-shell-polish",
      "category": "site-updates",
      "tags": [
        "site-updates",
        "animation",
        "ui"
      ],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-11-24T10:58:00+08:00",
      "updated_at": "2026-11-24T10:58:00+08:00",
      "published_at": "2026-11-24T10:58:00+08:00",
      "fallbackOnly": true,
      "icon": "system",
      "title": {
        "zh": "窗口开合动画单外壳无重影交接与定高优化",
        "en": "Window Morph Single-Shell Handoff & Fixed Height Polish",
        "ja": "ウィンドウ開閉の単一シェル引き継ぎ＆高さ固定調整"
      },
      "summary": {
        "zh": "消除窗口展开中段外壳与内容层的双边框重影，并为游戏区与工具区补充定高约束，确保冷打开全程几何稳定不跳高。",
        "en": "Eliminated double-border ghosting during L2-to-L3 content handoff and added fixed min-height constraints for Games and Tools windows to prevent cold-load height jumps.",
        "ja": "L2 シェルと L3 コンテンツ切り替え時の二重枠を解消し、ゲーム・ツール画面の初回読み込み時の高さジャンプを防止しました。"
      }
    },
    {
      "article_id": "seed-update-2026-11-24-window-morph-steps3-8",
      "slug": "2026-11-24-window-morph-steps3-8",
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
      "created_at": "2026-11-24T10:52:00+08:00",
      "updated_at": "2026-11-24T10:52:00+08:00",
      "published_at": "2026-11-24T10:52:00+08:00",
      "fallbackOnly": true,
      "icon": "system",
      "title": {
        "zh": "全站板块窗口 Matched Geometry Shell 开合动画正式上线",
        "en": "Matched Geometry Shell Window Open & Close Animation (Steps 3–8)",
        "ja": "全ウィンドウ Matched Geometry Shell 開閉アニメーション正式公開"
      },
      "summary": {
        "zh": "完成窗口开合动画第三至第八步重构：独立外壳层按解析二阶阻尼弹簧（开 480ms / 关 400ms）在六枚图标与真实窗口间连续形变，外壳与内容分层交接无闪烁，支持随时打断与 120 FPS 合成。",
        "en": "Completed the full Matched Geometry Shell window transition: independent L2 morph shell driven by analytic damped springs (open 480ms / close 400ms), 1:1 L3 content handoff, live icon re-measurement on close, and 120 FPS compositor discipline.",
        "ja": "ウィンドウ開閉アニメーションの第3〜第8ステップを完了しました。解析2次減衰バネ（開 480ms／閉 400ms）による独立シェル層と 1:1 実コンテンツ層の滑らかな引き継ぎ、割り込み対応、120 FPS 最適化を実現しています。"
      }
    }
  ]
});
