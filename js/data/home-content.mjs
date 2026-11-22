// Home-only update summaries; no article bodies.
export const homeContent = Object.freeze({
  "updates": [
    {
      "article_id": "seed-update-2026-11-22-pond-titlebar-close-final",
      "slug": "2026-11-22-pond-titlebar-close-final",
      "category": "site-updates",
      "tags": [
        "视觉升级",
        "全站图标"
      ],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-11-22T11:40:00+08:00",
      "updated_at": "2026-11-22T11:40:00+08:00",
      "published_at": "2026-11-22T11:40:00+08:00",
      "fallbackOnly": true,
      "icon": "system",
      "title": {
        "zh": "主窗口标题栏点阵关闭叉号优先级最终补齐",
        "en": "Main Window Titlebar Dotted Close X Final Specificity Fix",
        "ja": "主要ウィンドウタイトルバー点陣閉じるボタン最終修正"
      },
      "summary": {
        "zh": "补齐六个主窗口 .window-titlebar .close-button 同级优先级，彻底解决关于、工具等窗口关闭圆圈内叉号被旧规则清空的问题。",
        "en": "Matched .window-titlebar .close-button specificity across all six main windows so every circular close button renders its dotted X crisply.",
        "ja": "主要6ウィンドウの .window-titlebar .close-button 詳細度を揃え、閉じる円ボタン内の点陣×が全画面で確実に表示されるよう仕上げました。"
      }
    },
    {
      "article_id": "seed-update-2026-11-22-pond-close-id-specificity",
      "slug": "2026-11-22-pond-close-id-specificity",
      "category": "site-updates",
      "tags": [
        "视觉升级",
        "全站图标"
      ],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-11-22T11:32:00+08:00",
      "updated_at": "2026-11-22T11:32:00+08:00",
      "published_at": "2026-11-22T11:32:00+08:00",
      "fallbackOnly": true,
      "icon": "system",
      "title": {
        "zh": "全站九个窗口点阵关闭图标优先级收口",
        "en": "Unified Dotted Close Button ID-Specificity Fix Across All Windows",
        "ja": "全9ウィンドウ・モーダルの点陣閉じるアイコン詳細度修正"
      },
      "summary": {
        "zh": "为全站所有窗口与弹窗的点阵关闭按钮补齐 ID 级选择器优先级，确保每个窗口右上角 30px 点阵叉号清晰可见且悬停零偏移。",
        "en": "Applied ID-level specificity so the unified 30x30 dotted close X renders crisply with zero hover shift in all nine windows and modals.",
        "ja": "全ウィンドウおよびモーダルにID詳細度で統一30px点陣×アイコンを適用し、確実に視認できホバー時に位置ずれしないよう修正しました。"
      }
    },
    {
      "article_id": "seed-update-2026-11-22-pond-video-modal-details",
      "slug": "2026-11-22-pond-video-modal-details",
      "category": "site-updates",
      "tags": [
        "视觉升级",
        "视频区",
        "工具区"
      ],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-11-22T11:25:00+08:00",
      "updated_at": "2026-11-22T11:25:00+08:00",
      "published_at": "2026-11-22T11:25:00+08:00",
      "fallbackOnly": true,
      "icon": "system",
      "title": {
        "zh": "视频播放浮层与工具游戏展开详情暗色点阵换装",
        "en": "Video Playback Modal and Expanded Tool/Game Details Dark CRT Theme",
        "ja": "動画再生モーダルとツール・ゲーム展開詳細の暗色点陣テーマ化"
      },
      "summary": {
        "zh": "将视频播放浮层标题栏与打开原地址按钮统一换装为深夜池塘点阵风，并将工具卡和游戏卡展开详情里的白底信息框全部暗色化。",
        "en": "Restyled the video playback modal titlebar and Open Original button in Midnight Pond CRT style and dark-themed expanded tool and game detail badges.",
        "ja": "動画再生モーダルのタイトルバーと元ページボタンを月夜池ダーク点陣風へ刷新し、ツール・ゲーム詳細展開枠の白背景も暗色化しました。"
      }
    },
    {
      "article_id": "seed-update-2026-11-22-pond-account-signedin-states",
      "slug": "2026-11-22-pond-account-signedin-states",
      "category": "site-updates",
      "tags": [
        "视觉升级",
        "云存档",
        "全站状态"
      ],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-11-22T11:23:00+08:00",
      "updated_at": "2026-11-22T11:23:00+08:00",
      "published_at": "2026-11-22T11:23:00+08:00",
      "fallbackOnly": true,
      "icon": "system",
      "title": {
        "zh": "云存档账号浮层已登录态重做与全站低频状态面暗色统一",
        "en": "Signed-In Cloud Account Popover Redesign and Low-Frequency Status Surfaces",
        "ja": "クラウドアカウントログイン済みポップオーバー刷新と低頻度状態面の暗色統一"
      },
      "summary": {
        "zh": "彻底去掉账号浮层已登录态白色底块，重排双列均衡按钮与紧凑留白，并同步暗色化全站空态、错误态、恢复提示与气泡说明。",
        "en": "Replaced the bright white signed-in account strips with dark CRT panels, balanced 2-column buttons, and unified all empty/error/recovery/popover status surfaces.",
        "ja": "ログイン済みアカウント浮層の白帯を撤廃し2列均等ボタンへ再配置するとともに、全サイトの空・エラー・復帰通知などの状態面を暗色統一しました。"
      }
    },
    {
      "article_id": "seed-update-2026-11-22-pond-center-close-games-polish",
      "slug": "2026-11-22-pond-center-close-games-polish",
      "category": "site-updates",
      "tags": [
        "视觉升级",
        "关于页",
        "游戏区"
      ],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-11-22T11:18:00+08:00",
      "updated_at": "2026-11-22T11:18:00+08:00",
      "published_at": "2026-11-22T11:18:00+08:00",
      "fallbackOnly": true,
      "icon": "system",
      "title": {
        "zh": "内容适配窗口居中对齐、点阵关闭键与游戏暗色细节收口",
        "en": "Centered Content-Fit Windows, Dotted Close Icon Priority, and Game Dark-Mode Polish",
        "ja": "内容サイズ窓の中央揃え・点陣閉じるボタンとゲーム暗色微調整"
      },
      "summary": {
        "zh": "修复关于/工具/游戏收紧窗口居中定位与右上角点阵关闭图标优先级，清除小黑屋白条并还原2048数字方块亮色与Hextris底栏暗色。",
        "en": "Centered About, Tools, and Games windows, raised dotted close-button SVG specificity, removed A Dark Room white gradient, restored 2048 tile colors, and darkened Hextris hint bar.",
        "ja": "概要・ツール・ゲーム窓を画面中央へ揃え、点陣閉じるアイコンを全窓で確実に表示し、小黒屋・2048・Hextrisの暗色細部を整えました。"
      }
    }
  ]
});
