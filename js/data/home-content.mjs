// Home-only update summaries; no article bodies.
export const homeContent = Object.freeze({
  "updates": [
    {
      "article_id": "seed-update-2026-11-22-pond-button-spacing-system",
      "slug": "2026-11-22-pond-button-spacing-system",
      "category": "site-updates",
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-11-22T23:41:00+08:00",
      "updated_at": "2026-11-22T23:41:00+08:00",
      "published_at": "2026-11-22T23:41:00+08:00",
      "fallbackOnly": true,
      "icon": "system",
      "title": {
        "zh": "全站按钮尺寸、光学居中与间距体系统一重构",
        "en": "Site-Wide Button Sizing, Optical Centering, and Spacing System",
        "ja": "全サイト共通のボタンサイズ・中央揃え・余白設計の統一"
      },
      "summary": {
        "zh": "桌面与手机端全站拉网排查：消除标题栏横线压过关闭键问题，统一按钮最小尺寸、对称内边距与元素间距，并修复游戏展开溢边与移动端触碰。",
        "en": "Full desktop and mobile audit fixing titlebar close-button line overlap, uneven quick-link alignment, undersized buttons, expanded card overflow, and tight gaps.",
        "ja": "デスクトップとモバイル全画面のボタンを総点検し、閉じるボタンと線の重なり、サイズ不足、左右余白の偏り、ゲーム展開枠のはみ出しや要素接触を修正しました。"
      }
    },
    {
      "article_id": "seed-update-2026-11-22-pond-welcome-rebuild-notice",
      "slug": "2026-11-22-pond-welcome-rebuild-notice",
      "category": "site-updates",
      "tags": [
        "视觉升级",
        "欢迎窗",
        "公告"
      ],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-11-22T21:01:00+08:00",
      "updated_at": "2026-11-22T21:01:00+08:00",
      "published_at": "2026-11-22T21:01:00+08:00",
      "fallbackOnly": true,
      "icon": "system",
      "title": {
        "zh": "欢迎弹窗顶部新增前端重构临时公告条（三语）",
        "en": "Added Temporary Frontend Redesign Notice Banner to Welcome Modal (zh/en/ja)",
        "ja": "ウェルカムウィンドウ上部にフロントエンド再構築のお知らせ枠を追加（3言語対応）"
      },
      "summary": {
        "zh": "在欢迎窗最上方加入点阵虚线暖金临时公告条提示前端重构与逐步修复中，配齐中英日三语并保留独立撤除标记。",
        "en": "Added a removable dotted amber notice banner at the top of the Welcome modal in Chinese, English, and Japanese without altering existing sections.",
        "ja": "ウェルカム窓の最上部に点陣デザインの一時お知らせ枠（中・英・日）を追加し、後で一括撤去しやすい独立構成にしました。"
      }
    },
    {
      "article_id": "seed-update-2026-11-22-pond-home-icon-isolation",
      "slug": "2026-11-22-pond-home-icon-isolation",
      "category": "site-updates",
      "tags": [
        "视觉升级",
        "首页"
      ],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-11-22T20:49:00+08:00",
      "updated_at": "2026-11-22T20:49:00+08:00",
      "published_at": "2026-11-22T20:49:00+08:00",
      "fallbackOnly": true,
      "icon": "system",
      "title": {
        "zh": "首页桌面图标悬停与点击完全独立零连带位移",
        "en": "Home Desktop Icon Hover & Click Isolation (Zero Sibling Movement)",
        "ja": "ホームデスクトップアイコンのホバー・クリック独立化（他アイコンの位置ずれゼロ）"
      },
      "summary": {
        "zh": "移除首页非悬停图标受全局时钟驱动的浮动与闪烁，确保悬停或点击单个图标时仅目标图标响应、其余图标纹丝不动。",
        "en": "Removed global-time drift from non-hovered home desktop icons so hovering or clicking one icon never moves or flickers any other icon.",
        "ja": "非ホバー時のグローバル時刻連動の揺れを除去し、1つのアイコンにホバー・クリックしても他のアイコンが一切動かないよう修正しました。"
      }
    },
    {
      "article_id": "seed-update-2026-11-22-pond-kittens-widescreen-fix",
      "slug": "2026-11-22-pond-kittens-widescreen-fix",
      "category": "site-updates",
      "tags": [
        "视觉升级",
        "游戏区",
        "猫国建设者"
      ],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-11-22T12:44:00+08:00",
      "updated_at": "2026-11-22T12:44:00+08:00",
      "published_at": "2026-11-22T12:44:00+08:00",
      "fallbackOnly": true,
      "icon": "system",
      "title": {
        "zh": "猫国建设者宽屏居中布局、小按钮暗色化与标签栏防裁修复",
        "en": "Kittens Game Widescreen Centering, Dark Sub-Buttons, and Wrapping Tab Bar",
        "ja": "Kittens Game ワイド画面中央配置・小ボタン暗色化・タブ折り返し修正"
      },
      "summary": {
        "zh": "修复猫国建设者宽屏贴左留空问题，将建筑行右侧 sell/+/- 白块暗色化，并让顶部标签栏自动换行完整显示 Stats。",
        "en": "Centered Kittens Game's 3-column layout for widescreen displays, dark-themed sell/+/- sub-buttons, and wrapped the top tab bar so Stats is never clipped.",
        "ja": "ワイド画面での左寄り余白を解消して中央3欄へ広げ、sell/+/-の白ボタンを暗色化し、上部タブ欄を折り返してStatsまで完全表示しました。"
      }
    },
    {
      "article_id": "seed-update-2026-11-22-pond-chat-footer-sync-dot",
      "slug": "2026-11-22-pond-chat-footer-sync-dot",
      "category": "site-updates",
      "tags": [
        "视觉升级",
        "聊天室"
      ],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-11-22T12:21:00+08:00",
      "updated_at": "2026-11-22T12:21:00+08:00",
      "published_at": "2026-11-22T12:21:00+08:00",
      "fallbackOnly": true,
      "icon": "system",
      "title": {
        "zh": "聊天室底栏提示提亮留距与同步状态指示灯补齐",
        "en": "Chatroom Footer Contrast, Padding, and Sync Status Indicator Dot",
        "ja": "チャット下部ヒントの高コントラスト化・余白調整と同期インジケーター追加"
      },
      "summary": {
        "zh": "提亮聊天室底部冷却提示文字并增加四周呼吸边距防止贴边，同时为右上角同步状态补充在线/离线/重连三态荧光指示灯。",
        "en": "Brightened the chatroom bottom cooldown hint with balanced padding and added a glowing online/reconnecting/offline status dot beside the sync label.",
        "ja": "チャット下部のクールダウン案内文字を明るくし余白を確保するとともに、右上の同期表示へ接続状態ランプを追加しました。"
      }
    }
  ]
});
