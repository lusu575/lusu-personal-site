// Home-only update summaries; no article bodies.
export const homeContent = Object.freeze({
  "updates": [
    {
      "article_id": "seed-update-2026-10-29-tool-maintenance",
      "slug": "2026-10-29-tool-maintenance",
      "category": "site-updates",
      "tags": [
        "网站更新",
        "工具"
      ],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-10-29T15:00:00.000Z",
      "updated_at": "2026-10-29T15:00:00.000Z",
      "published_at": "2026-10-29T15:00:00.000Z",
      "fallbackOnly": true,
      "icon": "system",
      "date": "2026.10.29",
      "title": {
        "zh": "工具维护与完整画板导出准备",
        "en": "Tool Maintenance and Full Whiteboard Export Preparation",
        "ja": "ツール保守とホワイトボード全体画像の準備"
      },
      "summary": {
        "zh": "本地候选在现有画板和互传基础上完善完整图片导出与管理适配，保留现有大厅、帮助、上传和草稿保护；尚未部署。",
        "en": "The local candidate adds full whiteboard image export and administration integration while retaining the existing lobby, help, uploads and draft protection. It has not been deployed.",
        "ja": "ローカル候補版で全体画像の書き出しと管理連携を整備しました。既存のロビー、ヘルプ、アップロード、下書き保護を維持しています。まだ公開していません。"
      }
    },
    {
      "article_id": "seed-update-2026-09-28-mobile-layout",
      "slug": "2026-09-28-mobile-layout",
      "category": "site-updates",
      "tags": [
        "网站更新",
        "移动端",
        "聊天室",
        "界面"
      ],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-09-28T02:00:00.000Z",
      "updated_at": "2026-09-28T02:00:00.000Z",
      "published_at": "2026-09-28T02:00:00.000Z",
      "fallbackOnly": true,
      "icon": "system",
      "date": "2026.09.28",
      "title": {
        "zh": "手机界面重新排版",
        "en": "A Reworked Mobile Layout",
        "ja": "モバイル画面のレイアウトを刷新"
      },
      "summary": {
        "zh": "首页入口、栏目卡片和底部导航统一调整；聊天室重新划分身份、房间、消息与输入区，改善短屏和横屏下的阅读与操作。",
        "en": "Home shortcuts, content cards, and navigation now share a clearer layout. Chat separates identity, room controls, messages, and composition for easier use on short and landscape screens.",
        "ja": "ホームの入口、各ページのカード、下部ナビゲーションを整理。チャットの名前・部屋・メッセージ・入力欄を分け、小さな画面や横向きでも使いやすくしました。"
      }
    },
    {
      "article_id": "seed-update-2026-09-22-cloud-save-10min",
      "slug": "2026-09-22-cloud-save-10min",
      "category": "site-updates",
      "tags": [
        "网站更新",
        "游戏区",
        "云存档",
        "可靠性"
      ],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-09-21T16:24:26.443Z",
      "updated_at": "2026-09-21T16:24:26.443Z",
      "published_at": "2026-09-21T16:24:26.443Z",
      "fallbackOnly": true,
      "icon": "system",
      "date": "2026.09.22",
      "title": {
        "zh": "游戏云存档调整为每10分钟同步",
        "en": "Game Cloud Saves Now Sync Every 10 Minutes",
        "ja": "ゲームのクラウド保存を10分間隔に変更"
      },
      "summary": {
        "zh": "登录后的游戏自动云同步由30秒调整为10分钟，减少长时间挂机产生的 Cloudflare 请求和 D1 写入；手动“立即同步”和切出页面时的补同步保持不变。",
        "en": "Signed-in games now auto-sync to the cloud every 10 minutes instead of every 30 seconds, reducing Cloudflare requests and D1 writes during long sessions. Manual Sync Now and the page-hide sync remain immediate.",
        "ja": "ログイン中のゲームの自動クラウド同期を30秒から10分間隔へ変更し、長時間プレイ時のCloudflareリクエストとD1書き込みを削減しました。手動同期とページを離れる際の補助同期は従来どおり即時です。"
      }
    },
    {
      "article_id": "seed-update-2026-09-08-site-review-optimization",
      "slug": "2026-09-08-site-review-optimization",
      "category": "site-updates",
      "tags": [
        "网站更新",
        "界面",
        "移动端",
        "工具",
        "可靠性"
      ],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-09-07T23:00:00.000Z",
      "updated_at": "2026-09-07T23:00:00.000Z",
      "published_at": "2026-09-07T23:00:00.000Z",
      "fallbackOnly": true,
      "icon": "system",
      "date": "2026.09.08",
      "title": {
        "zh": "全站体验与可靠性优化",
        "en": "A Clearer, More Reliable Personal Site",
        "ja": "サイト全体の使いやすさと信頼性を改善"
      },
      "summary": {
        "zh": "欢迎窗改为主动查看，工具与画板入口更清晰，手机手势和动效更稳定；知识库支持完整分页搜索，临时互传修复跨房草稿与后台上传，发布增加精确版本校验。",
        "en": "Welcome is now optional, tool and whiteboard entries are clearer, and mobile gestures are more predictable. Knowledge gains complete pagination and search; Transfer fixes room drafts and background uploads, with exact release checks.",
        "ja": "歓迎画面を任意表示にし、ツールと画板の入口を整理しました。モバイル操作を安定させ、Knowledgeの全件ページングと検索、転送の下書き・バックグラウンド送信、公開バージョン確認を改善しています。"
      }
    },
    {
      "article_id": "seed-update-2026-09-02-mobile-blog-retired",
      "slug": "2026-09-02-mobile-blog-retired",
      "category": "site-updates",
      "tags": [
        "网站更新",
        "移动端",
        "杂谈区",
        "导航",
        "界面"
      ],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-09-02T07:20:00.000Z",
      "updated_at": "2026-09-02T07:20:00.000Z",
      "published_at": "2026-09-02T07:20:00.000Z",
      "fallbackOnly": true,
      "icon": "system",
      "date": "2026.09.02",
      "title": {
        "zh": "手机端杂谈区入口下线",
        "en": "Talk Removed from Mobile Home",
        "ja": "モバイルホームから雑談入口を削除"
      },
      "summary": {
        "zh": "手机端首页已移除“杂谈区”入口，避免未开放栏目继续占用 App 网格；桌面端导航、既有路由与内容数据保持不变。",
        "en": "The Talk entry has been removed from mobile Home so an unpublished section no longer occupies the App grid. Desktop navigation, route behavior, and content data remain unchanged.",
        "ja": "モバイルのホーム画面から「雑談」の入口を外し、未公開の項目が App グリッドを占有しないようにしました。デスクトップのナビゲーション、ルート動作、コンテンツデータは変更していません。"
      }
    }
  ]
});
