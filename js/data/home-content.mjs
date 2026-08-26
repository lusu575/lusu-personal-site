// Home-only update summaries; intentionally excludes article bodies and non-Home route data.
export const homeContent = Object.freeze({
  "updates": [
    {
      "article_id": "seed-update-2026-08-27-password-room-reset",
      "slug": "2026-08-27-password-room-reset",
      "category": "site-updates",
      "tags": ["网站更新", "密码房", "文件互传", "在线画板", "移动端"],
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
      "tags": ["网站更新", "匿名聊天室", "在线画板", "界面优化"],
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
    },
    {
      "article_id": "seed-update-2026-08-19-daily-ai-news-rss",
      "slug": "2026-08-19-daily-ai-news-rss",
      "category": "site-updates",
      "tags": ["网站更新", "每日 AI 新闻", "RSS", "Agent"],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-08-19T09:00:00.000Z",
      "updated_at": "2026-08-19T09:00:00.000Z",
      "published_at": "2026-08-19T09:00:00.000Z",
      "fallbackOnly": true,
      "icon": "system",
      "date": "2026.08.19",
      "title": {
        "zh": "每日 AI 新闻 RSS 订阅入口",
        "en": "Daily AI News RSS Feed",
        "ja": "毎日AIニュースのRSS配信"
      },
      "summary": {
        "zh": "“关于我”介绍文字下方新增一个低调的 RSS 订阅入口；公开 feed 仅输出已发布的每日 AI 新闻，提供中英日三种语言，供 RSS 阅读器和只读 Agent 每日抓取。",
        "en": "A low-profile RSS entry now sits below the About introduction. The public feed contains only published Daily AI News in Chinese, English, or Japanese for RSS readers and read-only agents.",
        "ja": "「About」の紹介文の下に控えめなRSS入口を追加しました。公開feedは公開済みの毎日AIニュースだけを中・英・日の三言語で配信し、RSSリーダーと読み取り専用Agentが利用できます。"
      }
    },
    {
      "article_id": "seed-update-2026-08-13-hide-minimax-h3-tools",
      "slug": "2026-08-13-hide-minimax-h3-tools",
      "category": "site-updates",
      "tags": ["网站更新", "工具区", "ComfyUI", "MiniMax H3", "暂时隐藏"],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-08-13T02:00:00.000Z",
      "updated_at": "2026-08-13T02:00:00.000Z",
      "published_at": "2026-08-13T02:00:00.000Z",
      "fallbackOnly": true,
      "icon": "system",
      "date": "2026.08.13",
      "title": {
        "zh": "在线 ComfyUI 工具入口暂时隐藏",
        "en": "Online ComfyUI Tools Entry Temporarily Hidden",
        "ja": "オンライン ComfyUI のツール入口を一時非表示"
      },
      "summary": {
        "zh": "工具区暂时隐藏在线 ComfyUI · MiniMax H3 入口；管理员控制台、后端接口和本地执行配置保留，待 Tunnel、Runner 与 GPU canary 完成验收后再重新开放。",
        "en": "The public Tools area temporarily hides the Online ComfyUI · MiniMax H3 entry; the protected admin console, backend interfaces, and local execution configuration remain available until Tunnel, Runner, and GPU canary acceptance is complete.",
        "ja": "公開ツール区ではオンライン ComfyUI · MiniMax H3 の入口を一時的に非表示にしました。保護された管理コンソール、バックエンド API、ローカル実行設定は保持し、Tunnel、Runner、GPU canary の受入れ完了後に再公開します。"
      }
    },
    {
      "article_id": "seed-update-2026-08-12-minimax-h3-console",
      "slug": "2026-08-12-minimax-h3-console",
      "category": "site-updates",
      "tags": ["网站更新", "工具区", "ComfyUI", "MiniMax H3", "AI"],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-08-12T08:00:00.000Z",
      "updated_at": "2026-08-12T08:00:00.000Z",
      "published_at": "2026-08-12T08:00:00.000Z",
      "fallbackOnly": true,
      "icon": "system",
      "date": "2026.08.12",
      "title": {
        "zh": "在线 ComfyUI 控制面上线准备",
        "en": "Online ComfyUI Control Plane Ready for Launch",
        "ja": "オンライン ComfyUI 制御面の公開準備"
      },
      "summary": {
        "zh": "工具区新增站长专用的在线 ComfyUI · MiniMax H3 控制台，接入受保护的 Runner、固定控制器、本机 ComfyUI、Bridge 与任务状态读取；执行和传输开关仍默认关闭。",
        "en": "Tools now includes a private Online ComfyUI · MiniMax H3 console with protected Runner, pinned controller, local ComfyUI, Bridge, and job-state checks; execution and transfer remain disabled by default.",
        "ja": "ツールに所有者専用のオンライン ComfyUI · MiniMax H3 コンソールを追加しました。保護された Runner、固定コントローラー、ローカル ComfyUI、Bridge、ジョブ状態を確認できますが、実行と転送は既定で無効です。"
      }
    },
  ]
});
