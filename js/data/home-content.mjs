// Home-only update summaries; no article bodies.
export const homeContent = Object.freeze({
  "updates": [
    {
      "article_id": "seed-update-2026-11-22-pond-icons-digits-fit",
      "slug": "2026-11-22-pond-icons-digits-fit",
      "category": "site-updates",
      "tags": [
        "site-update",
        "ui"
      ],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-11-22T04:50:00+08:00",
      "updated_at": "2026-11-22T04:50:00+08:00",
      "published_at": "2026-11-22T04:50:00+08:00",
      "fallbackOnly": true,
      "icon": "system",
      "date": "2026.11.22",
      "title": {
        "zh": "放大提亮工具区点阵图标、优化分类计数字形与游戏页顶栏边距",
        "en": "Larger Brighter Tool Dotted Icons, Open-Zero Filter Digits & Game Topbar Padding",
        "ja": "ツール点陣アイコン拡大明度向上・件数数字視認性改善・ゲーム上端余白調整"
      },
      "summary": {
        "zh": "将工具卡三枚点阵 SVG 图标加粗放大并增强辉光、为分类计数切换无斜杠无衬线数字以清晰区分 0 与 8，并增加游戏内页顶栏右边距。",
        "en": "Thickened and enlarged the three dotted tool SVG icons with brighter glow, switched filter counts to clean open-zero sans-serif numerals, and added right padding to the game topbar.",
        "ja": "ツールカードのパレット・転送・鳥居点陣アイコンを太線拡大して発光を強化し、分類件数に斜線なしの明瞭な数字を適用、ゲーム内ページ上端の右余白を広げました。"
      }
    },
    {
      "article_id": "seed-update-2026-11-22-pond-videos-explicit-h",
      "slug": "2026-11-22-pond-videos-explicit-h",
      "category": "site-updates",
      "tags": [
        "site-update",
        "ui"
      ],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-11-22T04:36:00+08:00",
      "updated_at": "2026-11-22T04:36:00+08:00",
      "published_at": "2026-11-22T04:36:00+08:00",
      "fallbackOnly": true,
      "icon": "system",
      "date": "2026.11.22",
      "title": {
        "zh": "明确视频区 3 列封面 174px 显式高度以根治行间叠压",
        "en": "Explicit 174px 16:9 Thumbnail Height to Eliminate 3-Column Video Row Overlap",
        "ja": "動画区 3 列サムネイルの 174px 明示高さ指定で縦重なりを解消"
      },
      "summary": {
        "zh": "为 3 列视频卡片指定 174px 显式 16:9 封面高度与 320px 最小卡片高度，彻底解决 Chromium 网格自动行高下 aspect-ratio 折叠为 0 引发的封面重叠问题。",
        "en": "Set explicit 174px 16:9 thumbnail height and 320px minimum card height in the 3-column Videos grid so Chromium never collapses auto-sized rows.",
        "ja": "3 列動画グリッドのサムネイルに 16:9 対応の 174px 明示高さとカード最小高さ 320px を指定し、Chromium の自動行高計算による縦重なりを完全に解消しました。"
      }
    },
    {
      "article_id": "seed-update-2026-11-22-pond-videos-row-height",
      "slug": "2026-11-22-pond-videos-row-height",
      "category": "site-updates",
      "tags": [
        "site-update",
        "ui"
      ],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-11-22T04:32:00+08:00",
      "updated_at": "2026-11-22T04:32:00+08:00",
      "published_at": "2026-11-22T04:32:00+08:00",
      "fallbackOnly": true,
      "icon": "system",
      "date": "2026.11.22",
      "title": {
        "zh": "修复视频区 3 列卡片高度塌陷重叠问题",
        "en": "Fixed 3-Column Video Card Row Collapse in CSS Grid",
        "ja": "動画区 3 列カードの縦重なりを修正"
      },
      "summary": {
        "zh": "将 3 列视频网格中视频卡片高度由 100% 改为 auto，彻底消除行间重叠，完整呈现 16:9 无裁切封面、标题、简介与齐平播放按钮。",
        "en": "Changed video card height from 100% to auto inside the auto-sized 3-column grid so 16:9 thumbnails, titles, descriptions, and aligned Play buttons never overlap vertically.",
        "ja": "CSS Grid の自動行高における動画カードの height を 100% から auto へ修正し、16:9 表紙・タイトル・概要・再生ボタンの縦重なりを完全に解消しました。"
      }
    },
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
    }
  ]
});
