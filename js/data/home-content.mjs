// Home-only update summaries; intentionally excludes article bodies and non-Home route data.
export const homeContent = Object.freeze({
  "updates": [
    {
      "article_id": "seed-update-2026-09-22-cloud-save-10min",
      "slug": "2026-09-22-cloud-save-10min",
      "category": "site-updates",
      "tags": ["网站更新", "游戏区", "云存档", "可靠性"],
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
    },
    {
      "article_id": "seed-update-2026-08-27-password-room-reset",
      "slug": "2026-08-27-password-room-reset",
      "category": "site-updates",
      "tags": [
        "网站更新",
        "密码房",
        "文件互传",
        "在线画板",
        "移动端"
      ],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-08-27T04:00:00.000Z",
      "updated_at": "2026-08-27T04:00:00.000Z",
      "published_at": "2026-08-27T04:00:00.000Z",
      "fallbackOnly": true,
      "icon": "system",
      "date": "2026.08.27",
      "title": {
        "zh": "密码房可彻底删除并重新开始",
        "en": "Password Rooms Can Be Deleted and Restarted Cleanly",
        "ja": "合言葉の部屋を完全削除して新しく開始可能に"
      },
      "summary": {
        "zh": "互传、聊天室和在线画板的密码房在过期或管理删除后彻底清除存储，同一密码再进入会得到新空房；手机上取消或拒绝上传选择后也可立即重试。",
        "en": "Expired or admin-deleted password rooms in Transfer, Chat, and Whiteboard now release their stored data so the same password starts a clean room. Mobile upload pickers can also be reopened after cancellation, a denied permission, or a wrong choice.",
        "ja": "転送・チャット・オンライン画板の合言葉ルームは、期限切れまたは管理削除後に保存データを完全に解放し、同じ合言葉で新しい空ルームを開始します。モバイルの選択をキャンセル・拒否・間違えた後もすぐ再実行できます。"
      }
    },
    {
      "article_id": "seed-update-2026-08-20-chat-whiteboard-ui-fixes",
      "slug": "2026-08-20-chat-whiteboard-ui-fixes",
      "category": "site-updates",
      "tags": [
        "网站更新",
        "匿名聊天室",
        "在线画板",
        "界面优化"
      ],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-08-20T08:00:00.000Z",
      "updated_at": "2026-08-20T08:00:00.000Z",
      "published_at": "2026-08-20T08:00:00.000Z",
      "fallbackOnly": true,
      "icon": "system",
      "date": "2026.08.20",
      "title": {
        "zh": "聊天室与在线画板界面修复",
        "en": "Chat and Whiteboard Interface Fixes",
        "ja": "チャットとオンライン画板のUI修正"
      },
      "summary": {
        "zh": "聊天室移除消息区和输入区的异常留白，把发送按钮收进输入框并改为清晰的方角 XP 操作；聊天室密码房说明改为悬浮显示，在线画板保留三语说明和 Image2 像素大厅。",
        "en": "Chat removes oversized gaps and places a clearer square-corner XP send key inside the input. Its password-room guide now appears on hover, while Whiteboard keeps trilingual help and its Image2 pixel lobby.",
        "ja": "チャットの余分な空白をなくし、入力欄内の送信操作を見やすい角型XPボタンにしました。チャットのパスワード説明はホバー表示となり、画板は三言語説明とImage2のピクセル入口を維持します。"
      }
    }
  ]
});
