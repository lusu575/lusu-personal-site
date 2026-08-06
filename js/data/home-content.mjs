// Home-only update summaries; intentionally excludes article bodies and non-Home route data.
export const homeContent = Object.freeze({
  "updates": [
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
    },
    {
      "article_id": "seed-update-2026-08-06-agent-capabilities",
      "slug": "2026-08-06-agent-capabilities",
      "category": "site-updates",
      "tags": ["网站更新", "AI 能力", "MCP", "CLI", "临时互传"],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-08-06T02:20:00.000Z",
      "updated_at": "2026-08-06T02:20:00.000Z",
      "published_at": "2026-08-06T02:20:00.000Z",
      "fallbackOnly": true,
      "icon": "resources",
      "date": "2026.08.06",
      "title": {
        "zh": "AI 能力层第一阶段：MCP、CLI 与临时互传",
        "en": "AI Capability Layer: MCP, CLI, and Quick Transfer",
        "ja": "AI 機能レイヤー第1段階：MCP・CLI・一時転送"
      },
      "summary": {
        "zh": "建立统一能力注册表、设备码和最小权限令牌，新增本地 CLI／stdio MCP 与尚未部署的只读远程 MCP；AI 现在可安全收发临时互传的文字和文件，白板与游戏控制仍在后续计划中。",
        "en": "Adds a governed capability registry, device authorization and scoped tokens, a local CLI/stdio MCP, and an undeployed read-only remote MCP; AI clients can now exchange Quick Transfer text and files, while Whiteboard and game control remain planned.",
        "ja": "統一機能レジストリ、デバイス認証、最小権限トークン、ローカル CLI／stdio MCP、未展開の読み取り専用リモート MCP を追加しました。AI は一時転送のテキストとファイルを扱えますが、ホワイトボードとゲーム操作はまだ計画段階です。"
      }
    },
    {
      "article_id": "seed-update-2026-08-06-site-guides-password-rooms",
      "slug": "2026-08-06-site-guides-password-rooms",
      "category": "site-updates",
      "tags": ["网站更新", "知识库", "网站使用指南", "密码房"],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-08-06T00:55:00.000Z",
      "updated_at": "2026-08-06T00:55:00.000Z",
      "published_at": "2026-08-06T00:55:00.000Z",
      "fallbackOnly": true,
      "icon": "knowledge",
      "date": "2026.08.06",
      "title": {
        "zh": "新增“网站使用指南”和密码房攻略",
        "en": "Website Guides and Password Room Guide",
        "ja": "「サイト利用ガイド」とパスワードルーム案内を追加"
      },
      "summary": {
        "zh": "知识库新增固定“网站使用指南”专区，并用一篇轻松攻略讲清匿名聊天室和在线画板的密码房，配有电脑端、手机端实拍图。",
        "en": "Knowledge now has a permanent Website Guides section and one relaxed password-room walkthrough for Anonymous Chat and Online Whiteboard, with real desktop and mobile screenshots.",
        "ja": "知識庫に固定の「サイト利用ガイド」を追加し、匿名チャットとオンラインホワイトボードのパスワードルームを実際のPC・スマホ画像でやさしく案内します。"
      }
    }
  ]
});
