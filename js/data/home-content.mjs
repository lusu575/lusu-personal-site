// Home-only update summaries; intentionally excludes article bodies and non-Home route data.
export const homeContent = Object.freeze({
  "updates": [
    {
      "article_id": "seed-update-2026-07-19-historical-video-thumbnail-cache",
      "slug": "2026-07-19-historical-video-thumbnail-cache",
      "category": "site-updates",
      "tags": ["Videos", "Bilibili", "cache", "ETag", "reliability"],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-07-19T11:56:27.825Z",
      "updated_at": "2026-07-19T11:56:27.825Z",
      "published_at": "2026-07-19T11:56:27.825Z",
      "fallbackOnly": true,
      "icon": "system",
      "date": "2026.07.19",
      "title": {
        "zh": "历史视频封面缓存恢复",
        "en": "Historical Video Thumbnail Cache Recovery",
        "ja": "過去の動画サムネイルキャッシュ復旧"
      },
      "summary": {
        "zh": "历史上传的 B 站封面并未丢失；公开视频 ETag 与封面代理地址现已完整版本化，旧浏览器会自动丢弃曾缓存的空封面，无需重新上传。",
        "en": "Previously uploaded Bilibili covers were still intact; complete response ETags and versioned thumbnail proxy URLs now make existing browsers discard cached empty covers without requiring another upload.",
        "ja": "以前アップロードした Bilibili サムネイルは失われていません。完全なレスポンス ETag とバージョン付きプロキシ URL により、既存ブラウザーもキャッシュ済みの空表示を破棄し、再アップロードなしで復旧します。"
      }
    },
    {
      "article_id": "seed-update-2026-07-19-content-experience-fixes",
      "slug": "2026-07-19-content-experience-fixes",
      "category": "site-updates",
      "tags": ["Knowledge", "Videos", "Resources", "Games", "account", "UI"],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-07-19T04:04:44.666Z",
      "updated_at": "2026-07-19T04:04:44.666Z",
      "published_at": "2026-07-19T04:04:44.666Z",
      "fallbackOnly": true,
      "icon": "system",
      "date": "2026.07.19",
      "title": {
        "zh": "知识库、视频、图标与账号体验修复",
        "en": "Knowledge, Video, Icon, and Account Fixes",
        "ja": "ナレッジ・動画・アイコン・アカウントの修正"
      },
      "summary": {
        "zh": "网站更新日志全部取消置顶，知识库窗口只保留关闭键；恢复后台上传的 B 站封面并移除封面圆圈，替换临时互传和五款游戏的独立图标，同时修正登录、注册与登录后账号界面。",
        "en": "Site update logs are no longer pinned and the Knowledge window keeps only Close; uploaded Bilibili covers are restored, thumbnail circles removed, Quick Transfer and five games receive distinct icons, and account login, registration, and signed-in states are corrected.",
        "ja": "サイト更新ログの固定を解除し、ナレッジ画面は閉じる操作だけにしました。Bilibili のアップロード済みサムネイルを復旧し、円形表示を削除。一時転送と5ゲームに個別アイコンを追加し、ログイン・登録・ログイン後表示も修正しました。"
      }
    },
    {
      "article_id": "seed-update-2026-07-19-service-recovery",
      "slug": "2026-07-19-service-recovery",
      "category": "site-updates",
      "tags": ["Knowledge", "Japanese", "Quick Transfer", "reliability", "QA"],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-07-18T17:35:00.000Z",
      "updated_at": "2026-07-18T17:35:00.000Z",
      "published_at": "2026-07-18T17:35:00.000Z",
      "fallbackOnly": true,
      "icon": "system",
      "date": "2026.07.19",
      "title": {
        "zh": "知识库、日语与互传服务恢复",
        "en": "Knowledge, Japanese, and Transfer Service Recovery",
        "ja": "ナレッジ・日本語・転送サービスの復旧"
      },
      "summary": {
        "zh": "修复知识库文章种子中的无效 D1 参数，兼容 Cloudflare 无扩展名互传片段地址，并补齐本地预览隐私配置检查；日语工具、知识库与互传入口已重新联调。",
        "en": "An invalid D1 article-seed parameter is fixed, Quick Transfer now accepts Cloudflare's canonical extensionless fragment path, and local-preview privacy configuration is checked; Japanese, Knowledge, and Transfer flows are reverified together.",
        "ja": "記事 seed の不正な D1 引数を修正し、Quick Transfer が Cloudflare の拡張子なし canonical fragment を受け入れるようにしました。ローカル preview の privacy 設定も補い、日本語・ナレッジ・転送を一括で再確認しています。"
      }
    },
    {
      "article_id": "seed-update-2026-07-18-resource-icons-layout",
      "slug": "2026-07-18-resource-icons-layout",
      "category": "site-updates",
      "tags": ["Resources", "Quick Transfer", "UI", "mobile", "QA"],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-07-18T15:35:00.000Z",
      "updated_at": "2026-07-18T15:35:00.000Z",
      "published_at": "2026-07-18T15:35:00.000Z",
      "fallbackOnly": true,
      "icon": "system",
      "date": "2026.07.18",
      "title": {
        "zh": "资源区图标与排版修复",
        "en": "Resources Icon and Layout Fixes",
        "ja": "リソースのアイコンとレイアウト修正"
      },
      "summary": {
        "zh": "修复临时互传整套图标的洋红底色，收紧资源卡片与互传登录布局，并保证关闭互传后准确恢复资源列表；安全、API 与数据边界不变。",
        "en": "The magenta background across the Quick Transfer icon atlas is removed, Resources cards and the sign-in layout are tightened, and closing Transfer now restores the exact Resources list state; security, API, and data boundaries are unchanged.",
        "ja": "一時転送のアイコン atlas 全体に残っていたマゼンタ背景を除去し、リソースカードとログイン画面を整理しました。転送を閉じるとリソース一覧の状態を正確に復元し、安全性、API、データ境界は変更していません。"
      }
    },
    {
      "article_id": "seed-update-2026-07-18-public-site-100-complete",
      "slug": "2026-07-18-public-site-100-complete",
      "category": "site-updates",
      "tags": ["performance", "UX", "accessibility", "mobile", "security", "QA"],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-07-18T04:00:00.000Z",
      "updated_at": "2026-07-18T04:00:00.000Z",
      "published_at": "2026-07-18T04:00:00.000Z",
      "fallbackOnly": true,
      "icon": "system",
      "date": "2026.07.18",
      "title": {
        "zh": "公开主站 100 项优化与稳定性复查完成",
        "en": "100 Public-Site Improvements and Stability Recheck",
        "ja": "公開サイト 100 項目の改善と安定性再確認"
      },
      "summary": {
        "zh": "公开主站 100 项优化及稳定性复查已完成：修复冷启动 Chat 图标、短屏头像和移动 Dock 切换闪失，并以全动效中间帧、快速连续切换及竖横屏截图重新验证。",
        "en": "All 100 public-site improvements and the stability recheck are complete: cold-start Chat icons, short-screen avatars, and mobile Dock flicker are fixed and reverified with full-motion intermediate frames, rapid switching, and portrait/landscape screenshots.",
        "ja": "公開サイト 100 項目の改善と安定性再確認を完了しました。初回表示の Chat アイコン、短画面のアバター、モバイル Dock の切替時の消失を修正し、フルモーションの中間フレーム、連続切替、縦横画面のスクリーンショットで再検証しています。"
      }
    }
  ]
});
