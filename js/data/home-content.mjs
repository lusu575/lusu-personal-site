// Home-only update summaries; intentionally excludes article bodies and non-Home route data.
export const homeContent = Object.freeze({
  "updates": [
    {
      "article_id": "seed-update-2026-07-26-chatroom-icon-redraw",
      "slug": "2026-07-26-chatroom-icon-redraw",
      "category": "site-updates",
      "tags": ["UI", "Chat", "icon", "Pixel Art", "QA"],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-07-26T10:58:00.000Z",
      "updated_at": "2026-07-26T10:58:00.000Z",
      "published_at": "2026-07-26T10:58:00.000Z",
      "fallbackOnly": true,
      "icon": "system",
      "date": "2026.07.26",
      "title": {
        "zh": "匿名聊天室图标重绘",
        "en": "Anonymous Chat Icon Redrawn",
        "ja": "匿名チャットアイコンを再描画"
      },
      "summary": {
        "zh": "重新绘制匿名聊天室图标，缩小可见主体并增加均衡透明留白；Home、窗口、任务栏、欢迎入口与聊天头像现统一使用新图，旧图资源已移除。",
        "en": "Redrew the Anonymous Chat icon with a smaller silhouette and balanced transparent padding. Home, windows, the taskbar, welcome shortcuts, and chat avatars now share the new asset, and the legacy artwork is removed.",
        "ja": "匿名チャットアイコンを描き直し、見える輪郭を小さくして透明余白を均等化しました。Home、ウィンドウ、タスクバー、ウェルカム入口、チャットのアバターを新しい素材へ統一し、旧素材は削除しました。"
      }
    },
    {
      "article_id": "seed-update-2026-07-26-interface-audit-fixes",
      "slug": "2026-07-26-interface-audit-fixes",
      "category": "site-updates",
      "tags": ["mobile", "Games", "UI", "privacy", "QA"],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-07-26T08:58:00.000Z",
      "updated_at": "2026-07-26T08:58:00.000Z",
      "published_at": "2026-07-26T08:58:00.000Z",
      "fallbackOnly": true,
      "icon": "system",
      "date": "2026.07.26",
      "title": {
        "zh": "全界面移动适配与游戏体验修复",
        "en": "Sitewide Mobile and Game Experience Fixes",
        "ja": "全画面のモバイル・ゲーム体験修正"
      },
      "summary": {
        "zh": "完成全部公开界面复检，修复 A Dark Room、Kittens Game、Life Restart、2048 与 Hextris 五款游戏的手机适配、触控和滚动问题，并收紧弹窗层级与第三方请求边界。",
        "en": "Completed a full public-interface recheck, fixing mobile layout, touch, and scrolling across five games—A Dark Room, Kittens Game, Life Restart, 2048, and Hextris—while tightening modal hierarchy and third-party request boundaries.",
        "ja": "公開画面を全面再点検し、A Dark Room、Kittens Game、Life Restart、2048、Hextris の5ゲームでモバイル配置・タッチ・スクロールを修正。モーダル階層と外部通信の境界も整えました。"
      }
    },
    {
      "article_id": "seed-update-2026-07-26-resources-to-tools",
      "slug": "2026-07-26-resources-to-tools",
      "category": "site-updates",
      "tags": ["UI", "i18n", "Tools", "compatibility", "QA"],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-07-26T06:55:36.099Z",
      "updated_at": "2026-07-26T06:55:36.099Z",
      "published_at": "2026-07-26T06:55:36.099Z",
      "fallbackOnly": true,
      "icon": "system",
      "date": "2026.07.26",
      "title": {
        "zh": "资源区正式更名为工具区",
        "en": "Resources Area Renamed to Tools",
        "ja": "リソース欄をツールへ名称変更"
      },
      "summary": {
        "zh": "公开栏目名称已统一为“工具区 / Tools / ツール”，内部 resources 路由、旧 #resources 链接、临时互传和全部功能保持不变。",
        "en": "The public section name is now Tools across Chinese, English, and Japanese, while the resources route, existing #resources links, Quick Transfer, and all behavior remain unchanged.",
        "ja": "公開欄の名称を中国語・英語・日本語で「ツール」に統一し、resources ルート、既存の #resources リンク、一時転送、すべての機能は変更していません。"
      }
    },
    {
      "article_id": "seed-update-2026-07-26-mobile-article-first-screen",
      "slug": "2026-07-26-mobile-article-first-screen",
      "category": "site-updates",
      "tags": ["mobile", "Knowledge", "accessibility", "QA", "UI"],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-07-26T06:31:45.722Z",
      "updated_at": "2026-07-26T06:31:45.722Z",
      "published_at": "2026-07-26T06:31:45.722Z",
      "fallbackOnly": true,
      "icon": "system",
      "date": "2026.07.26",
      "title": {
        "zh": "手机文章首屏与全站点检修复",
        "en": "Mobile Article First-Screen and Sitewide QA Fix",
        "ja": "モバイル記事初期画面と全体点検の修正"
      },
      "summary": {
        "zh": "修复手机知识库文章首屏大面积空白、短横屏英文资源卡裁切，并补齐 Dock、回顶按钮、目录语言与图片说明等无障碍细节。",
        "en": "Fixed the large blank area above mobile Knowledge articles and clipped English resource cards in short landscape, while completing Dock, back-to-top, TOC-language, and image-caption accessibility details.",
        "ja": "モバイルのナレッジ記事上部に生じる大きな空白と短い横画面での英語リソースカードの欠けを修正し、Dock、先頭へ戻る操作、目次言語、画像説明のアクセシビリティも整えました。"
      }
    },
    {
      "article_id": "seed-update-2026-07-26-trust-safety-status",
      "slug": "2026-07-26-trust-safety-status",
      "category": "site-updates",
      "tags": ["Games", "Quick Transfer", "reliability", "security", "UI"],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-07-26T04:54:16.752Z",
      "updated_at": "2026-07-26T04:54:16.752Z",
      "published_at": "2026-07-26T04:54:16.752Z",
      "fallbackOnly": true,
      "icon": "system",
      "date": "2026.07.26",
      "title": {
        "zh": "30 项功能与界面优化完成",
        "en": "30 Functional and UI Improvements Completed",
        "ja": "機能・UI 改善 30 項目を完了"
      },
      "summary": {
        "zh": "完成云存档与互传安全、真实连接与恢复流程、搜索筛选、三语无障碍，以及资源和游戏卡片等 30 项可验证优化。",
        "en": "Thirty verified improvements now cover cloud-save and transfer safety, truthful connection and recovery flows, search and filtering, trilingual accessibility, plus resource and game cards.",
        "ja": "クラウド保存と転送の安全性、正確な接続・復旧、検索と絞り込み、3言語アクセシビリティ、リソースとゲームカードを含む検証可能な30項目を改善しました。"
      }
    }
  ]
});
