// Home-only update summaries; intentionally excludes article bodies and non-Home route data.
export const homeContent = Object.freeze({
  "updates": [
    {
      "article_id": "seed-update-2026-08-01-service-reliability",
      "slug": "2026-08-01-service-reliability",
      "category": "site-updates",
      "tags": ["网站更新", "账号", "登录", "D1", "稳定性"],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-08-01T07:10:00.000Z",
      "updated_at": "2026-08-01T07:10:00.000Z",
      "published_at": "2026-08-01T07:10:00.000Z",
      "fallbackOnly": true,
      "icon": "games",
      "date": "2026.08.01",
      "title": {
        "zh": "账号与实时工具稳定性修复",
        "en": "Account and Real-Time Tool Reliability Fixes",
        "ja": "アカウントとリアルタイムツールの安定性を修正"
      },
      "summary": {
        "zh": "修复 Cloudflare 密码派生兼容性导致的登录失败，并停止文章种子在冷启动时重复写入 D1，降低账号、匿名身份和在线画板共用数据库时的写入压力。",
        "en": "Fixes sign-in failures caused by a Cloudflare password-derivation incompatibility and stops article seeds from rewriting D1 on cold starts, reducing shared write pressure for accounts, anonymous identity, and Whiteboard.",
        "ja": "Cloudflare のパスワード導出互換性によるログイン失敗を修正し、コールドスタート時の記事 seed による D1 の反復書き込みを止め、アカウント・匿名ID・ホワイトボード共通DBの負荷を下げました。"
      }
    },
    {
      "article_id": "seed-update-2026-07-30-multiplayer-whiteboard",
      "slug": "2026-07-30-multiplayer-whiteboard",
      "category": "site-updates",
      "tags": ["网站更新", "工具区", "在线画板", "实时协作", "匿名身份"],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-07-30T08:30:00.000Z",
      "updated_at": "2026-07-30T08:30:00.000Z",
      "published_at": "2026-07-30T08:30:00.000Z",
      "fallbackOnly": true,
      "icon": "resources",
      "date": "2026.07.30",
      "title": {
        "zh": "工具区多人在线画板上线",
        "en": "Multiplayer Whiteboard Is Live in Tools",
        "ja": "ツールに共同オンラインホワイトボードを追加"
      },
      "summary": {
        "zh": "工具区新增免登录多人在线画板，支持公共与密码房、实时鼠标和临时名字、统一匿名身份、图片、PNG/SVG 导出，以及密码房无人后24小时保留。",
        "en": "Tools now includes a sign-in-free multiplayer whiteboard with public and password rooms, live cursors and temporary names, one shared anonymous identity, images, PNG/SVG export, and 24-hour retention for empty password rooms.",
        "ja": "ツールにログイン不要の共同ホワイトボードを追加しました。公開・パスワードルーム、リアルタイムカーソルと一時名、共通匿名ID、画像、PNG/SVG出力、空室後24時間の保持に対応します。"
      }
    },
    {
      "article_id": "seed-update-2026-07-29-knowledge-markdown-links",
      "slug": "2026-07-29-knowledge-markdown-links",
      "category": "site-updates",
      "tags": ["网站更新", "知识库", "Markdown", "链接", "图片"],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-07-29T02:14:00.000Z",
      "updated_at": "2026-07-29T02:14:00.000Z",
      "published_at": "2026-07-29T02:14:00.000Z",
      "fallbackOnly": true,
      "icon": "knowledge",
      "date": "2026.07.29",
      "title": {
        "zh": "知识库正文与图注链接恢复",
        "en": "Knowledge Article and Caption Links Restored",
        "ja": "知識庫の本文と画像キャプションのリンクを復元"
      },
      "summary": {
        "zh": "Tool Radar 正文与显式图片图注中的绝对 HTTPS Markdown 链接已恢复为安全可点击链接；七张真实配图同时登记实际尺寸并完善截图等待。",
        "en": "Absolute HTTPS Markdown links in Tool Radar body copy and explicit image captions are safely clickable again, while all seven real visuals now carry real dimensions and more reliable capture waits.",
        "ja": "Tool Radar の本文と明示的な画像キャプションにある絶対 HTTPS Markdown リンクを安全にクリックできるよう復元し、7枚の実画像に実寸と安定した取得待機を追加しました。"
      }
    },
    {
      "article_id": "seed-update-2026-07-29-tool-radar-real-visuals",
      "slug": "2026-07-29-tool-radar-real-visuals",
      "category": "site-updates",
      "tags": ["网站更新", "工具雷达", "真实界面", "图片来源", "自动化"],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-07-29T01:10:00.000Z",
      "updated_at": "2026-07-29T01:10:00.000Z",
      "published_at": "2026-07-29T01:10:00.000Z",
      "fallbackOnly": true,
      "icon": "knowledge",
      "date": "2026.07.29",
      "title": {
        "zh": "工具雷达改用真实官方界面图",
        "en": "Tool Radar Now Uses Real Official Product Visuals",
        "ja": "ツールレーダーを実際の公式画面へ更新"
      },
      "summary": {
        "zh": "首期 7 张自绘概念图已换成官网、官方文档或官方仓库里的真实界面、案例与成果；每周工作流同步禁止自绘、生成和统一模板图。",
        "en": "Seven site-drawn concept diagrams have been replaced with real interfaces, examples, and outputs from official sites, docs, or repositories, while the weekly workflow now rejects drawn, generated, and template visuals.",
        "ja": "初回の自作概念図7枚を、公式サイト・文書・リポジトリの実画面、事例、成果へ置き換え、週次フローでも自作・生成・共通テンプレート画像を禁止しました。"
      }
    },
    {
      "article_id": "seed-update-2026-07-29-tool-radar-live",
      "slug": "2026-07-29-tool-radar-live",
      "category": "site-updates",
      "tags": ["网站更新", "工具雷达", "知识库", "自动化", "多语言"],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-07-28T16:45:00.000Z",
      "updated_at": "2026-07-28T16:45:00.000Z",
      "published_at": "2026-07-28T16:45:00.000Z",
      "fallbackOnly": true,
      "icon": "knowledge",
      "date": "2026.07.29",
      "title": {
        "zh": "工具雷达正式上线并开启周更",
        "en": "Tool Radar Is Live with Weekly Publishing",
        "ja": "ツールレーダーを公開し、週次更新を開始"
      },
      "summary": {
        "zh": "知识库“工具雷达”正式上线，首期 7 工具三语文章已发布；独立去重、原创说明图与每周二 22:00 自动任务同步启用。",
        "en": "Tool Radar is live in Knowledge with a trilingual first edition covering seven tools; independent deduplication, original explanatory visuals, and the Tuesday 22:00 automation are active.",
        "ja": "知識庫の「ツールレーダー」を正式公開し、7ツールの初回3言語記事を掲載しました。独立重複防止、オリジナル説明図、毎週火曜22時の自動タスクも有効です。"
      }
    }
  ]
});
