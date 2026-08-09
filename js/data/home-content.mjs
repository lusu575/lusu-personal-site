// Home-only update summaries; intentionally excludes article bodies and non-Home route data.
export const homeContent = Object.freeze({
  "updates": [
    {
      "article_id": "seed-update-2026-08-09-game-video-mcp-candidate",
      "slug": "2026-08-09-game-video-mcp-candidate",
      "category": "site-updates",
      "tags": ["网站更新", "AI 能力", "游戏", "视频区", "MCP", "安全"],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-08-09T09:30:00.000Z",
      "updated_at": "2026-08-09T09:30:00.000Z",
      "published_at": "2026-08-09T09:30:00.000Z",
      "fallbackOnly": true,
      "icon": "games",
      "date": "2026.08.09",
      "title": {
        "zh": "游戏 MCP 保活修复候选与视频闭环点检",
        "en": "Game MCP Heartbeat Fix Candidate and Video Lifecycle Check",
        "ja": "ゲーム MCP 保活修正候補と動画ライフサイクル検証"
      },
      "summary": {
        "zh": "当前生产站长 Worker 为 377d494b-8f90-40ad-998f-863d209e1978；外链视频管理闭环已在该精确 bundle 通过，但远程可用性尚未晋级。2048 点检在暂停后暴露空闲 WebSocket 断线；本次 Pages 发布加入每 8 秒严格 ping／pong 保活，Worker 已具备边缘自动应答。精确线上字节与四游戏闭环仍待核验，Kittens Game 与真视频上传不开放。",
        "en": "The current production owner Worker is 377d494b-8f90-40ad-998f-863d209e1978. Its external-video management lifecycle passed for that exact bundle, but remote availability is not promoted. A 2048 check exposed an idle WebSocket disconnect after pause. This Pages release adds an exact eight-second ping/pong heartbeat, while the Worker already provides the edge auto-response. Exact live bytes and the four-game lifecycle still require verification; Kittens Game and true video upload remain unavailable.",
        "ja": "現在の本番所有者 Worker は 377d494b-8f90-40ad-998f-863d209e1978 です。この正確な bundle で外部動画管理のライフサイクルは合格しましたが、リモート可用性はまだ昇格していません。2048 の点検では停止後の待機中に WebSocket 切断が判明しました。今回の Pages 公開は8秒ごとの厳密な ping／pong 保活を追加し、Worker は既にエッジ自動応答を備えています。正確な本番バイトと4ゲームの完全検証は未完了で、Kittens Game と実動画アップロードは利用できません。"
      }
    },
    {
      "article_id": "seed-update-2026-08-09-wallpaper-time-switch",
      "slug": "2026-08-09-wallpaper-time-switch",
      "category": "site-updates",
      "tags": ["网站更新", "壁纸", "动效", "无障碍", "移动端"],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-08-09T05:40:00.000Z",
      "updated_at": "2026-08-09T05:40:00.000Z",
      "published_at": "2026-08-09T05:40:00.000Z",
      "fallbackOnly": true,
      "icon": "system",
      "date": "2026.08.09",
      "title": {
        "zh": "四时段壁纸开关",
        "en": "Four-Stage Wallpaper Time Switch",
        "ja": "4段階の壁紙時間スイッチ"
      },
      "summary": {
        "zh": "网站右上角新增由生成素材组成的早上、中午、下午和晚上四段壁纸开关；它默认按本地时间自动切换，手动选择会保留到下一个真实时段边界，并用可中断的选择环移动与壁纸交叉淡化完成过渡。",
        "en": "A generated-art four-stage wallpaper switch now sits at the site's upper right for morning, noon, afternoon, and night. It follows local time by default; a manual choice lasts until the next real schedule boundary, with an interruptible moving lens and wallpaper crossfade.",
        "ja": "サイト右上に、生成素材で作った朝・昼・夕方・夜の4段階壁紙スイッチを追加しました。通常はローカル時刻に従い、手動選択は次の実際の時間境界まで維持され、中断可能なレンズ移動と壁紙のクロスフェードで切り替わります。"
      }
    },
    {
      "article_id": "seed-update-2026-08-09-motion-polish",
      "slug": "2026-08-09-motion-polish",
      "category": "site-updates",
      "tags": ["网站更新", "界面", "动效", "移动端", "无障碍"],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-08-09T02:50:00.000Z",
      "updated_at": "2026-08-09T02:50:00.000Z",
      "published_at": "2026-08-09T02:50:00.000Z",
      "fallbackOnly": true,
      "icon": "system",
      "date": "2026.08.09",
      "title": {
        "zh": "主站动效与移动交互精修",
        "en": "Public-Site Motion and Mobile Interaction Polish",
        "ja": "公開サイトのモーションとモバイル操作を改善"
      },
      "summary": {
        "zh": "主站弹层、窗口切换与移动 Dock 采用更快且可中断的动效；知识库骨架屏、阅读进度和聊天室未读提示改用低成本合成路径，键盘操作即时完成，reduced-motion 保留必要的淡入与颜色反馈。",
        "en": "Public popovers, window changes, and the mobile Dock now use faster, interruptible motion. Knowledge skeletons, reading progress, and chat unread feedback use cheaper compositor paths, while keyboard actions complete instantly and reduced motion keeps only helpful fades and color cues.",
        "ja": "公開サイトのポップオーバー、ウィンドウ切り替え、モバイル Dock をより速く中断可能な動きに調整しました。Knowledge のスケルトン、読書進捗、Chat の未読表示は軽量な合成処理を使い、キーボード操作は即時、視差軽減時は必要なフェードと色だけを残します。"
      }
    },
    {
      "article_id": "seed-update-2026-08-07-remote-mcp-oauth",
      "slug": "2026-08-07-remote-mcp-oauth",
      "category": "site-updates",
      "tags": ["网站更新", "AI 能力", "知识库", "MCP", "安全"],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-08-07T10:10:00.000Z",
      "updated_at": "2026-08-09T01:00:00.000Z",
      "published_at": "2026-08-09T01:00:00.000Z",
      "fallbackOnly": true,
      "icon": "knowledge",
      "date": "2026.08.09",
      "title": {
        "zh": "远程 MCP OAuth 与知识库原子工具完成生产验收",
        "en": "Remote MCP OAuth and Atomic Knowledge Tools Pass Production Acceptance",
        "ja": "リモート MCP OAuth と知識ベース原子ツールの本番検証完了"
      },
      "summary": {
        "zh": "正式域名端到端生产验收已通过：OAuth Allow 后精确发现 9 项工具与 4 项公开能力，并完成原子发布、同载荷重放、管理读取、CAS 更新、三语公开回读、确认删除、删除后 404、令牌撤销和临时数据清理；文件发布仍仅限本地，全站工具及游戏远程接管尚未完成。",
        "en": "End-to-end production acceptance on the live domain has passed: OAuth Allow exposed exactly 9 tools and 4 public capabilities, followed by atomic publish, same-payload replay, management reads, CAS update, zh/en/ja public readback, confirmed delete, post-delete 404, token revocation, and temporary-data cleanup. File publishing remains local, while whole-site tool and game takeover is not complete.",
        "ja": "本番ドメインのエンドツーエンド検証が完了しました。OAuth Allow 後に9ツールと4つの公開機能を正確に確認し、原子的公開、同一ペイロード再実行、管理一覧・取得、CAS 更新、zh／en／ja 公開再取得、確認付き削除、削除後404、トークン失効、一時データ消去まで合格しています。ファイル公開はローカル限定で、サイト全体のツールやゲームの遠隔操作は未完成です。"
      }
    },
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
    }
  ]
});
