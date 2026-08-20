// Home-only update summaries; intentionally excludes article bodies and non-Home route data.
export const homeContent = Object.freeze({
  "updates": [
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
        "zh": "聊天室移除消息区和输入区的异常留白，把发送按钮收进输入框；聊天室与在线画板的密码房均新增三语说明，画板大厅也使用 Image2 像素背景重绘并修正卡片对齐。",
        "en": "Chat no longer leaves oversized gaps around the log and composer, and its send action now sits inside the input. Chat and Whiteboard add trilingual password-room help, while the Whiteboard lobby gains an Image2 pixel background and aligned cards.",
        "ja": "チャットのログ・入力欄にあった大きな余白をなくし、送信ボタンを入力欄内へ移しました。チャットとオンライン画板に三言語のパスワード説明を追加し、画板の入口もImage2のピクセル背景と整列したカードへ刷新しました。"
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
    {
      "article_id": "seed-update-2026-08-12-wallpaper-game-display-fix",
      "slug": "2026-08-12-wallpaper-game-display-fix",
      "category": "site-updates",
      "tags": ["网站更新", "视频壁纸", "游戏区", "响应式", "流畅度"],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-08-12T07:30:00.000Z",
      "updated_at": "2026-08-12T07:30:00.000Z",
      "published_at": "2026-08-12T07:30:00.000Z",
      "fallbackOnly": true,
      "icon": "system",
      "date": "2026.08.12",
      "title": {
        "zh": "视频壁纸叠层、返回闪烁与游戏显示修复",
        "en": "Wallpaper Layering, Return Flash, and Game Display Fixes",
        "ja": "動画壁紙の重なり・復帰時のちらつき・ゲーム表示を修正"
      },
      "summary": {
        "zh": "视频壁纸启用时不再创建或预热额外的 CSS 动态云，避免出现两层云；离开 Home 只暂停当前视频并保留解码器，返回后直接续播。游戏外壳移除 1280px 固定宽度上限，短屏默认收起存档与 AI 工具并可通过 44px 按钮展开，让人生重开等游戏在浏览器缩放、横屏和窄屏下获得更大的可玩区域。",
        "en": "When video wallpaper is eligible, the page no longer creates or warms the separate CSS cloud layer, preventing duplicate clouds. Leaving Home now pauses the current video in place and resumes it on return without rebuilding the decoder. The game shell also removes its fixed 1280px cap and collapses save/AI tools by default on short screens behind a 44px toggle, giving Life Restart and other games more usable space under browser zoom, landscape, and narrow layouts.",
        "ja": "動画壁紙を利用できる場合は別の CSS 雲レイヤーを生成・先読みせず、雲の二重表示を防ぎます。Home を離れると現在の動画をその場で一時停止し、戻った際はデコーダーを作り直さず再開します。ゲーム枠の固定 1280px 上限も削除し、短い画面ではセーブ／AI ツールを 44px ボタンの後ろへ初期収納して、人生重開などをブラウザー拡大縮小・横画面・狭い画面で広く表示します。"
      }
    },
  ]
});
