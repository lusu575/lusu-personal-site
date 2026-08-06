// Home-only update summaries; intentionally excludes article bodies and non-Home route data.
export const homeContent = Object.freeze({
  "updates": [
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
    },
    {
      "article_id": "seed-update-2026-08-06-agent-read-breadth",
      "slug": "2026-08-06-agent-read-breadth",
      "category": "site-updates",
      "tags": ["网站更新", "AI 能力", "MCP", "CLI", "工具", "游戏", "日语"],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-08-06T05:30:00.000Z",
      "updated_at": "2026-08-06T05:30:00.000Z",
      "published_at": "2026-08-06T05:30:00.000Z",
      "fallbackOnly": true,
      "icon": "resources",
      "date": "2026.08.06",
      "title": {
        "zh": "AI 只读能力扩展到工具、游戏与日语关卡",
        "en": "AI Read Access Expands to Tools, Games, and Japanese Stages",
        "ja": "AI の読み取り機能をツール・ゲーム・日本語問題へ拡張"
      },
      "summary": {
        "zh": "第三阶段为本地 CLI／stdio MCP 补齐视频详情、三项真实工具、五个游戏的安全目录和 250 个日语潜台词关卡；远程 MCP 仍未部署，也没有新增远程写入。",
        "en": "Phase three adds video details, three real tools, a safe catalog of five games, and 250 Japanese subtext stages to the local CLI/stdio MCP. The remote MCP remains undeployed with no new remote writes.",
        "ja": "第3段階ではローカル CLI／stdio MCP に動画詳細、3つの実用ツール、5ゲームの安全な一覧、250問の日本語含意問題を追加しました。リモート MCP は未展開で、遠隔書き込みも追加していません。"
      }
    },
    {
      "article_id": "seed-update-2026-08-06-whiteboard-2048-agent",
      "slug": "2026-08-06-whiteboard-2048-agent",
      "category": "site-updates",
      "tags": ["网站更新", "AI 能力", "在线画板", "2048", "MCP", "CLI"],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-08-06T03:50:00.000Z",
      "updated_at": "2026-08-06T03:50:00.000Z",
      "published_at": "2026-08-06T03:50:00.000Z",
      "fallbackOnly": true,
      "icon": "resources",
      "date": "2026.08.06",
      "title": {
        "zh": "AI 已可操作在线画板与 2048",
        "en": "AI Can Now Draw on Whiteboards and Play 2048",
        "ja": "AI がホワイトボード描画と 2048 操作に対応"
      },
      "summary": {
        "zh": "第二阶段把在线画板与 2048 接入本地 CLI／stdio MCP：画板可安全追加高层元素并在本地导出 JSON、SVG、PNG；2048 运行在隔离的本地会话中。远程 MCP 仍未部署且保持只读。",
        "en": "Phase two connects Online Whiteboard and 2048 to the local CLI/stdio MCP: the board safely appends high-level elements and exports JSON, SVG, or PNG locally, while 2048 runs in an isolated local session. The remote MCP remains undeployed and read-only.",
        "ja": "第2段階としてオンラインホワイトボードと 2048 をローカル CLI／stdio MCP に接続しました。ホワイトボードは安全な高レベル要素の追記とローカル JSON／SVG／PNG 書き出し、2048 は分離されたローカルセッションに対応します。リモート MCP は未展開の読み取り専用のままです。"
      }
    }
  ]
});
