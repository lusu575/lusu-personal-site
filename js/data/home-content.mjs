// Home-only update summaries; intentionally excludes article bodies and non-Home route data.
export const homeContent = Object.freeze({
  "updates": [
    {
      "article_id": "seed-update-2026-08-07-life-restart-agent",
      "slug": "2026-08-07-life-restart-agent",
      "category": "site-updates",
      "tags": ["网站更新", "AI 能力", "知识库", "原子发布", "MCP", "CLI", "人生重开模拟器", "安全"],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-08-07T08:00:00.000Z",
      "updated_at": "2026-08-07T08:00:00.000Z",
      "published_at": "2026-08-07T08:00:00.000Z",
      "fallbackOnly": true,
      "icon": "knowledge",
      "date": "2026.08.07",
      "title": {
        "zh": "知识库原子发布 MCP 与人生重开语义会话上线",
        "en": "Atomic Knowledge Publishing MCP and Life Restart Sessions",
        "ja": "知識ベース原子公開 MCP と Life Restart セッションを追加"
      },
      "summary": {
        "zh": "本地 stdio MCP 现已支持三语知识库文章的原子发布、Markdown 文件发布、CAS 更新和确认删除，并继续提供可复现的人生重开游戏会话；写入仅接受管理员批准的独立 scope。",
        "en": "The local stdio MCP now atomically publishes trilingual knowledge articles, publishes Markdown files, performs CAS updates and confirmed deletes, and also runs reproducible Life Restart sessions. Writes require separately administrator-approved scopes.",
        "ja": "ローカル stdio MCP で、3言語の知識記事の原子的公開、Markdown ファイル公開、CAS 更新、確認付き削除に対応し、再現可能な Life Restart セッションも利用できます。書き込みには管理者が別途承認した scope が必要です。"
      }
    },
    {
      "article_id": "seed-update-2026-08-07-hextris-agent",
      "slug": "2026-08-07-hextris-agent",
      "category": "site-updates",
      "tags": ["网站更新", "AI 能力", "Hextris", "游戏", "CLI", "MCP", "开源许可"],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-08-07T00:30:00.000Z",
      "updated_at": "2026-08-07T00:30:00.000Z",
      "published_at": "2026-08-07T00:30:00.000Z",
      "fallbackOnly": true,
      "icon": "games",
      "date": "2026.08.07",
      "title": {
        "zh": "Hextris 现在支持独立 AI 游戏会话",
        "en": "Hextris Now Supports a Dedicated AI Game Session",
        "ja": "Hextris が独立 AI ゲームセッションに対応"
      },
      "summary": {
        "zh": "新增确定性的 Hextris 隔离会话、专用 CLI 与 stdio MCP，并补全 GPL 分发说明；它以独立进程运行，不接管已打开的浏览器，也不静态并入通用 CLI／MCP。",
        "en": "Adds deterministic isolated Hextris sessions, a dedicated CLI and stdio MCP, plus complete GPL distribution notices. It runs as a separate process, does not take over an open browser, and is not statically linked into the general CLI or MCP.",
        "ja": "決定論的な Hextris 分離セッション、専用 CLI／stdio MCP、GPL 配布表示を追加しました。独立プロセスとして動作し、開いているブラウザーを操作せず、共通 CLI／MCP に静的統合もしません。"
      }
    },
    {
      "article_id": "seed-update-2026-08-06-whiteboard-agent-images",
      "slug": "2026-08-06-whiteboard-agent-images",
      "category": "site-updates",
      "tags": ["网站更新", "AI 能力", "在线画板", "图片", "CLI", "MCP", "安全"],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-08-06T13:20:00.000Z",
      "updated_at": "2026-08-06T15:53:00.000Z",
      "published_at": "2026-08-06T13:20:00.000Z",
      "fallbackOnly": true,
      "icon": "resources",
      "date": "2026.08.06",
      "title": {
        "zh": "AI 现在可以给在线画板添加图片",
        "en": "AI Can Now Add Images to the Online Whiteboard",
        "ja": "AI がオンラインホワイトボードに画像を追加可能に"
      },
      "summary": {
        "zh": "本地 CLI／stdio MCP 可上传、下载并在当前房追加真实图片；生产热修已让精确图片上传与 Yjs 场景更新进入完整 Agent 鉴权，其他来源、路径、方法与 MIME 继续拒绝，远程 MCP 仍未部署。",
        "en": "The local CLI and stdio MCP can upload, download, and append real images in the current room. Production fixes now pass only exact image uploads and Yjs scene updates into full Agent authorization; other origins, paths, methods, and MIME types remain rejected, and remote MCP remains undeployed.",
        "ja": "ローカル CLI／stdio MCP から現在のルームへ実画像をアップロード・取得・追記できます。本番修正により正確な画像アップロードと Yjs シーン更新だけが完全な Agent 認可へ進み、他の送信元・パス・メソッド・MIME は拒否されます。リモート MCP は未展開です。"
      }
    },
    {
      "article_id": "seed-update-2026-08-06-agent-auth-form-origin",
      "slug": "2026-08-06-agent-auth-form-origin",
      "category": "site-updates",
      "tags": ["网站更新", "AI 能力", "设备授权", "安全", "CLI", "MCP", "临时互传"],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-08-06T12:00:00.000Z",
      "updated_at": "2026-08-06T12:00:00.000Z",
      "published_at": "2026-08-06T12:00:00.000Z",
      "fallbackOnly": true,
      "icon": "resources",
      "date": "2026.08.06",
      "title": {
        "zh": "AI／CLI 授权确认页恢复正常",
        "en": "AI and CLI Authorization Forms Restored",
        "ja": "AI／CLI 認証フォームを復旧"
      },
      "summary": {
        "zh": "修复浏览器点击 Allow 时被 no-referrer 变成 Origin:null 而误拒绝的问题；授权与令牌管理表单恢复，精确同源、登录态和 CSRF 边界不变。",
        "en": "Fixes browser Allow submissions that no-referrer turned into Origin:null; authorization and token-management forms work again while exact-origin, session, and CSRF checks remain unchanged.",
        "ja": "no-referrer により Allow 送信の Origin が null となり拒否される問題を修正しました。認証・トークン管理フォームを復旧し、厳密な同一オリジン、セッション、CSRF 検査は維持します。"
      }
    },
    {
      "article_id": "seed-update-2026-08-06-japanese-agent-progress",
      "slug": "2026-08-06-japanese-agent-progress",
      "category": "site-updates",
      "tags": ["网站更新", "AI 能力", "MCP", "CLI", "日语", "账号进度"],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-08-06T08:30:00.000Z",
      "updated_at": "2026-08-06T08:30:00.000Z",
      "published_at": "2026-08-06T08:30:00.000Z",
      "fallbackOnly": true,
      "icon": "resources",
      "date": "2026.08.06",
      "title": {
        "zh": "AI 已可读取日语进度并受控提交答题",
        "en": "AI Can Read Japanese Progress and Submit Checked Attempts",
        "ja": "AI が日本語学習進捗の取得と検証済み解答送信に対応"
      },
      "summary": {
        "zh": "第四阶段为本地 CLI／stdio MCP 加入账号日语进度读取和服务端判分的答题提交；新增权限、版本冲突与幂等保护，远程 MCP 仍未部署。",
        "en": "Phase four adds account-bound Japanese progress reads and server-scored attempt submission to the local CLI/stdio MCP, with dedicated scopes, revision checks, and idempotency. The remote MCP remains undeployed.",
        "ja": "第4段階ではローカル CLI／stdio MCP にアカウント連携の学習進捗取得とサーバー採点の解答送信を追加しました。専用権限、リビジョン検査、冪等性を備え、リモート MCP は未展開のままです。"
      }
    }
  ]
});
