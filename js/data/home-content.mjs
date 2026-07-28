// Home-only update summaries; intentionally excludes article bodies and non-Home route data.
export const homeContent = Object.freeze({
  "updates": [
    {
      "article_id": "seed-update-2026-07-28-knowledge-archive-visibility",
      "slug": "2026-07-28-knowledge-archive-visibility",
      "category": "site-updates",
      "tags": ["网站更新", "知识库", "文章列表", "分类", "QA"],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-07-28T05:30:00.000Z",
      "updated_at": "2026-07-28T05:30:00.000Z",
      "published_at": "2026-07-28T05:30:00.000Z",
      "fallbackOnly": true,
      "icon": "knowledge",
      "date": "2026.07.28",
      "title": {
        "zh": "知识库完整归档恢复",
        "en": "Knowledge Archive Visibility Restored",
        "ja": "知識庫の全記事表示を復元"
      },
      "summary": {
        "zh": "公共文章列表不再被 50 条上限截断；取消置顶的旧文章及其分类会继续出现在知识库，并可通过搜索与加载更多访问。",
        "en": "The public article list no longer stops at 50 items. Older unpinned articles and their categories remain available through search and Load more.",
        "ja": "公開記事一覧の50件制限を解消し、固定解除した過去記事と分類を検索や「さらに表示」から引き続き参照できるようにしました。"
      }
    },
    {
      "article_id": "seed-update-2026-07-28-article-pin-sidebar-navigation",
      "slug": "2026-07-28-article-pin-sidebar-navigation",
      "category": "site-updates",
      "tags": ["网站更新", "知识库", "文章管理", "阅读体验", "QA"],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-07-28T05:20:00.000Z",
      "updated_at": "2026-07-28T05:20:00.000Z",
      "published_at": "2026-07-28T05:20:00.000Z",
      "fallbackOnly": true,
      "icon": "knowledge",
      "date": "2026.07.28",
      "title": {
        "zh": "文章置顶与目录定位修复",
        "en": "Article Pinning and Contents Navigation Fixes",
        "ja": "記事の固定表示と目次移動を修正"
      },
      "summary": {
        "zh": "后台取消置顶不再被种子还原；返回按钮与目录合并为同一固定侧栏，目录点击会把目标标题对齐并同步高亮。",
        "en": "Admin pin choices now survive seed refreshes. The back control and contents share one anchored sidebar, and contents clicks align and highlight the requested heading.",
        "ja": "管理画面の固定表示設定を seed が戻さないようにし、戻る操作と目次を同じ固定サイドバーへまとめ、目次移動時の見出し位置と選択表示を同期しました。"
      }
    },
    {
      "article_id": "seed-update-2026-07-28-knowledge-reader-welcome-fixes",
      "slug": "2026-07-28-knowledge-reader-welcome-fixes",
      "category": "site-updates",
      "tags": ["网站更新", "知识库", "阅读体验", "筛选", "欢迎弹窗", "QA"],
      "cover_image": "",
      "status": "published",
      "is_pinned": 0,
      "created_at": "2026-07-28T03:15:00.000Z",
      "updated_at": "2026-07-28T03:15:00.000Z",
      "published_at": "2026-07-28T03:15:00.000Z",
      "fallbackOnly": true,
      "icon": "knowledge",
      "date": "2026.07.28",
      "title": {
        "zh": "知识库阅读与每日欢迎修复",
        "en": "Knowledge Reading and Daily Welcome Fixes",
        "ja": "知識庫の閲覧と毎日のウェルカム表示を修正"
      },
      "summary": {
        "zh": "修复文章目录多行高亮与底部裁切，固定返回和回顶控件，更新日志仅留在专属 Tab，并恢复每天首次打开时的欢迎弹窗。",
        "en": "Fixed multiline contents highlighting and bottom clipping, anchored article navigation, limited Site Updates to its dedicated tab, and restored the welcome window on the first open of each day.",
        "ja": "複数行目次の強調表示と末尾の切れを直し、記事ナビゲーションを固定し、更新履歴を専用タブだけに限定して、毎日の初回表示でウェルカム画面が開くようにしました。"
      }
    },
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
    }
  ]
});
