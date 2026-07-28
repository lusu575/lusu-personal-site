// Home-only update summaries; intentionally excludes article bodies and non-Home route data.
export const homeContent = Object.freeze({
  "updates": [
    {
      "article_id": "seed-update-2026-07-28-daily-ai-news-coverage-review",
      "slug": "2026-07-28-daily-ai-news-coverage-review",
      "category": "site-updates",
      "tags": ["网站更新", "每日AI新闻", "新闻覆盖", "多语言", "质量复核"],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-07-28T01:03:00.000Z",
      "updated_at": "2026-07-28T01:03:00.000Z",
      "published_at": "2026-07-28T01:03:00.000Z",
      "fallbackOnly": true,
      "icon": "knowledge",
      "date": "2026.07.28",
      "title": {
        "zh": "每日 AI 新闻覆盖与复核升级",
        "en": "Daily AI News Coverage and Review Expanded",
        "ja": "毎日AIニュースの収集・再確認を強化"
      },
      "summary": {
        "zh": "每日 AI 新闻新增重点厂商与产业主题覆盖审阅、低产出二次检查及多语言可靠来源，并让标题直接显示当天头条。",
        "en": "Daily AI News now reviews priority companies and industry topics, performs a second pass for thin editions, accepts reliable multilingual sources, and surfaces the lead story in each title.",
        "ja": "毎日AIニュースに重点企業・産業テーマの網羅確認、件数が少ない場合の再確認、多言語の信頼できる情報源を追加し、タイトルには当日のトップニュースを表示します。"
      }
    },
    {
      "article_id": "seed-update-2026-07-28-daily-ai-news-reader-format",
      "slug": "2026-07-28-daily-ai-news-reader-format",
      "category": "site-updates",
      "tags": ["网站更新", "知识库", "每日AI新闻", "阅读体验"],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-07-27T20:40:00.000Z",
      "updated_at": "2026-07-27T20:40:00.000Z",
      "published_at": "2026-07-27T20:40:00.000Z",
      "fallbackOnly": true,
      "icon": "knowledge",
      "date": "2026.07.28",
      "title": {
        "zh": "每日 AI 新闻阅读格式调整",
        "en": "Daily AI News Reading Format Updated",
        "ja": "毎日AIニュースの閲覧形式を更新"
      },
      "summary": {
        "zh": "每日 AI 新闻详情不再重复摘要和采集窗口，正文直接进入要闻；目录改为列出每条新闻标题，测试占位文章已删除。",
        "en": "Daily AI News now opens directly with the stories, without a repeated summary or collection-window paragraph. Its contents list every headline, and the test placeholder is removed.",
        "ja": "毎日AIニュースは概要や収集時間を繰り返さず記事へ直接入り、目次には全ニュース見出しを表示します。テスト用記事も削除しました。"
      }
    },
    {
      "article_id": "seed-update-2026-07-27-daily-ai-news-inbox",
      "slug": "2026-07-27-daily-ai-news-inbox",
      "category": "site-updates",
      "tags": ["网站更新", "知识库", "AI新闻", "Admin"],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-07-27T13:06:00.000Z",
      "updated_at": "2026-07-27T16:05:00.000Z",
      "published_at": "2026-07-27T16:05:00.000Z",
      "fallbackOnly": true,
      "icon": "knowledge",
      "date": "2026.07.27",
      "title": {
        "zh": "每日 AI 新闻正式上线",
        "en": "Daily AI News Goes Live",
        "ja": "毎日AIニュース正式稼働"
      },
      "summary": {
        "zh": "知识库“每日 AI 新闻”正式接入 Horizon 与 Codex：每天北京时间 7 点开始整理前 24 小时内容，三语稿通过检查后在 8 点前自动公开。",
        "en": "Daily AI News now runs through Horizon and Codex: each Beijing-time day starts at 07:00, covers the prior 24 hours, and publishes the validated Chinese, English, and Japanese edition by 08:00.",
        "ja": "「毎日AIニュース」は Horizon と Codex に正式接続され、北京時間の毎朝7時に直前24時間分の処理を始め、検証済みの中・英・日3言語版を8時までに自動公開します。"
      }
    },
    {
      "article_id": "seed-update-2026-07-26-security-reliability-hardening",
      "slug": "2026-07-26-security-reliability-hardening",
      "category": "site-updates",
      "tags": ["security", "reliability", "Admin", "Cloudflare", "QA"],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-07-26T14:58:00.000Z",
      "updated_at": "2026-07-26T14:58:00.000Z",
      "published_at": "2026-07-26T14:58:00.000Z",
      "fallbackOnly": true,
      "icon": "system",
      "date": "2026.07.26",
      "title": {
        "zh": "全站安全与可靠性加固",
        "en": "Sitewide Security and Reliability Hardening",
        "ja": "サイト全体のセキュリティと信頼性を強化"
      },
      "summary": {
        "zh": "一次性加固账号入口、统计写入、D1 迁移、后台并发编辑与互传治理，并为文章分享、游戏和日语工具补齐超时、降级与离线回退。",
        "en": "Hardened account entry, analytics writes, D1 migrations, concurrent admin editing, and Transfer governance while adding timeouts, degradation paths, and offline fallbacks for articles, games, and the Japanese tool.",
        "ja": "アカウント入口、分析書き込み、D1 移行、管理画面の同時編集、転送管理を強化し、記事・ゲーム・日本語ツールへタイムアウト、縮退、オフライン復帰を追加しました。"
      }
    },
    {
      "article_id": "seed-update-2026-07-26-chatroom-icon-redraw",
      "slug": "2026-07-26-chatroom-icon-redraw",
      "category": "site-updates",
      "tags": ["UI", "Chat", "icon", "Pixel Art", "QA"],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-07-26T10:58:00.000Z",
      "updated_at": "2026-07-26T10:58:00.000Z",
      "published_at": "2026-07-26T10:58:00.000Z",
      "fallbackOnly": true,
      "icon": "system",
      "date": "2026.07.26",
      "title": {
        "zh": "匿名聊天室图标重绘",
        "en": "Anonymous Chat Icon Redrawn",
        "ja": "匿名チャットアイコンを再描画"
      },
      "summary": {
        "zh": "重新绘制匿名聊天室图标，缩小可见主体并增加均衡透明留白；Home、窗口、任务栏、欢迎入口与聊天头像现统一使用新图，旧图资源已移除。",
        "en": "Redrew the Anonymous Chat icon with a smaller silhouette and balanced transparent padding. Home, windows, the taskbar, welcome shortcuts, and chat avatars now share the new asset, and the legacy artwork is removed.",
        "ja": "匿名チャットアイコンを描き直し、見える輪郭を小さくして透明余白を均等化しました。Home、ウィンドウ、タスクバー、ウェルカム入口、チャットのアバターを新しい素材へ統一し、旧素材は削除しました。"
      }
    }
  ]
});
