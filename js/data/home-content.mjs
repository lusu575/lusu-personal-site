// Home-only update summaries; intentionally excludes article bodies and non-Home route data.
export const homeContent = Object.freeze({
  "updates": [
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
    },
    {
      "article_id": "seed-update-2026-08-02-traffic-discovery-monitoring",
      "slug": "2026-08-02-traffic-discovery-monitoring",
      "category": "site-updates",
      "tags": ["网站更新", "流量保护", "SEO", "线上监控", "D1"],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-08-02T08:20:00.000Z",
      "updated_at": "2026-08-02T08:20:00.000Z",
      "published_at": "2026-08-02T08:20:00.000Z",
      "fallbackOnly": true,
      "icon": "knowledge",
      "date": "2026.08.02",
      "title": {
        "zh": "流量发现与线上监控优化",
        "en": "Traffic Discovery and Production Monitoring",
        "ja": "流入発見性と本番監視の改善"
      },
      "summary": {
        "zh": "减少重复遥测请求并提前收紧 D1 免费额度保护，补齐文章访问留存、三语 sitemap 与文章结构化数据，同时加入低频生产冒烟检查。",
        "en": "Reduces duplicate telemetry requests, reserves more of the D1 free tier, completes article-view retention and multilingual SEO signals, and adds a low-frequency production smoke check.",
        "ja": "重複テレメトリ要求を減らして D1 無料枠の余裕を広げ、記事閲覧の保存期限、多言語 SEO、本番の低頻度スモーク監視を追加しました。"
      }
    },
    {
      "article_id": "seed-update-2026-08-01-whiteboard-calm-efficient-sync",
      "slug": "2026-08-01-whiteboard-calm-efficient-sync",
      "category": "site-updates",
      "tags": ["网站更新", "在线画板", "节省资源", "连接体验", "铅笔草图"],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-08-01T12:50:00.000Z",
      "updated_at": "2026-08-01T12:50:00.000Z",
      "published_at": "2026-08-01T12:50:00.000Z",
      "fallbackOnly": true,
      "icon": "resources",
      "date": "2026.08.01",
      "title": {
        "zh": "在线画板安静同步与空房休眠",
        "en": "Calmer Whiteboard Sync and Idle-Room Hibernation",
        "ja": "ホワイトボードの静かな同期と空室休止"
      },
      "summary": {
        "zh": "画板 v1.0.2 统一所有房间的铅笔草图默认值，并用边缘自动心跳、后台停放、按变化批处理和空房无周期轮询降低 Cloudflare 用量；短暂重连不再弹大错误。",
        "en": "Whiteboard v1.0.2 gives every room the same pencil-sketch defaults and lowers Cloudflare usage through edge auto-responses, hidden-tab parking, change-only batching, and no recurring empty-room polling; brief reconnects no longer show large errors.",
        "ja": "ホワイトボード v1.0.2 は全ルームで鉛筆スケッチの既定値を統一し、エッジ自動応答、非表示タブの休止、変更時だけの一括同期、空室の定期巡回停止で Cloudflare 使用量を抑えます。短い再接続では大きなエラーを表示しません。"
      }
    }
  ]
});
