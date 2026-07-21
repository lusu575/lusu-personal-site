// Home-only update summaries; intentionally excludes article bodies and non-Home route data.
export const homeContent = Object.freeze({
  "updates": [
    {
      "article_id": "seed-update-2026-07-21-desktop-taskbar-active",
      "slug": "2026-07-21-desktop-taskbar-active",
      "category": "site-updates",
      "tags": ["UI", "taskbar", "desktop", "accessibility"],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-07-21T00:41:00.711Z",
      "updated_at": "2026-07-21T00:41:00.711Z",
      "published_at": "2026-07-21T00:41:00.711Z",
      "fallbackOnly": true,
      "icon": "system",
      "date": "2026.07.21",
      "title": {
        "zh": "桌面任务栏选中态降噪",
        "en": "Desktop Taskbar Active-State Polish",
        "ja": "デスクトップタスクバーの選択表示調整"
      },
      "summary": {
        "zh": "移除 PC 端当前任务按钮的黄色底边、外描边和常亮光晕，保留蓝色按下层级与键盘焦点环；移动 Dock 不变。",
        "en": "The desktop active task button drops its yellow edge and persistent glow while retaining a blue pressed hierarchy and keyboard focus ring; the mobile Dock is unchanged.",
        "ja": "デスクトップの選択中タスクボタンから黄色の縁と常時グローを外し、青い押下階層とキーボードフォーカスリングを維持。モバイル Dock は変更しません。"
      }
    },
    {
      "article_id": "seed-update-2026-07-20-ui-motion-polish",
      "slug": "2026-07-20-ui-motion-polish",
      "category": "site-updates",
      "tags": ["UI", "motion", "accessibility", "mobile", "Chat", "Videos"],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-07-20T14:53:30.199Z",
      "updated_at": "2026-07-20T14:53:30.199Z",
      "published_at": "2026-07-20T14:53:30.199Z",
      "fallbackOnly": true,
      "icon": "system",
      "date": "2026.07.20",
      "title": {
        "zh": "全站界面与动效精修",
        "en": "Site-wide UI and Motion Polish",
        "ja": "サイト全体の UI・モーション調整"
      },
      "summary": {
        "zh": "完成聊天短屏、视频卡片、知识库、资源区、欢迎窗口与移动 Dock 的系统化精修，并统一加载、错误、键盘焦点和减少动效体验。",
        "en": "Chat on short screens, video cards, Knowledge, Resources, the welcome window, and the mobile Dock are systematically refined, with unified loading, error, keyboard-focus, and reduced-motion behavior.",
        "ja": "短い画面のチャット、動画カード、ナレッジ、リソース、ウェルカム画面、モバイル Dock を整理し、読み込み・エラー・キーボードフォーカス・モーション低減の挙動も統一しました。"
      }
    },
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
    }
  ]
});
