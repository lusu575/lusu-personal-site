// Home-only update summaries; no article bodies.
export const homeContent = Object.freeze({
  "updates": [
    {
      "article_id": "seed-update-2026-11-22-pond-videos-16x9",
      "slug": "2026-11-22-pond-videos-16x9",
      "category": "site-updates",
      "tags": [
        "site-update",
        "ui"
      ],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-11-22T04:23:00+08:00",
      "updated_at": "2026-11-22T04:23:00+08:00",
      "published_at": "2026-11-22T04:23:00+08:00",
      "fallbackOnly": true,
      "icon": "system",
      "date": "2026.11.22",
      "title": {
        "zh": "恢复视频区 3 列标准 16:9 封面排布并确保标题与播放按钮完整呈现",
        "en": "Restored 3-Column True 16:9 Video Grid with Unclipped Titles & Aligned Play Buttons",
        "ja": "動画区 3 列 16:9 レイアウト復元・タイトルと再生ボタン完全表示"
      },
      "summary": {
        "zh": "将视频区恢复为 3 列网格并保持标准 16:9 封面比例，消除 2 列高封面挤出文字区的问题，实现封面无裁切且标题、简介与播放按钮完整对齐。",
        "en": "Switched Videos back to a 3-column grid with true 16:9 thumbnails and unclipped card bodies so covers, titles, descriptions, and Play buttons all render cleanly.",
        "ja": "動画区を 3 列グリッドの標準 16:9 サムネイルへ戻し、カードの切り抜きを解除して表紙・タイトル・概要・再生ボタンをすべて見切れなく整列させました。"
      }
    },
    {
      "article_id": "seed-update-2026-11-22-pond-final-finish",
      "slug": "2026-11-22-pond-final-finish",
      "category": "site-updates",
      "tags": [
        "site-update",
        "ui"
      ],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-11-22T04:15:00+08:00",
      "updated_at": "2026-11-22T04:15:00+08:00",
      "published_at": "2026-11-22T04:15:00+08:00",
      "fallbackOnly": true,
      "icon": "system",
      "date": "2026.11.22",
      "title": {
        "zh": "深夜池塘最终细节收尾：视频 16:9 完整封面、聊天室防叠字、游戏封面与手机端留白",
        "en": "Midnight Pond Final Visual Finish: 16:9 Uncropped Video Covers, Chatroom Spacing, Bright Game Art & Mobile Dock Clearance",
        "ja": "深夜の池最終ディテール仕上げ：動画 16:9 表紙・チャット重なり解消・ゲーム表紙・モバイル余白"
      },
      "summary": {
        "zh": "恢复视频 16:9 完整封面比例消除裁切、消除聊天室右上房间标签叠字、提亮猫国封面并升级 Hextris 霓虹六边形封面、优化知识库 3 排显示与手机端 Dock 底部留白。",
        "en": "Restored 16:9 uncropped video thumbnails, fixed the chatroom room-label overlap, brightened Kittens Game cover and upgraded Hextris art, and refined Knowledge & mobile Dock bottom spacing.",
        "ja": "動画サムネイルを 16:9 比率へ戻して見切れを解消し、チャット右上の文字重なり修正、猫国表紙の明度向上と Hextris 表紙刷新、知識庫とモバイル Dock 下部余白を整えました。"
      }
    },
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
    }
  ]
});
