create table if not exists users (
  id text primary key,
  email text not null unique,
  password_hash text not null,
  role text not null default 'user',
  created_at text not null,
  updated_at text not null
);

create table if not exists sessions (
  token_hash text primary key,
  user_id text not null references users(id) on delete cascade,
  created_at text not null,
  expires_at text not null
);

create index if not exists sessions_user_id_idx on sessions(user_id);
create index if not exists sessions_expires_at_idx on sessions(expires_at);

create table if not exists game_saves (
  user_id text not null references users(id) on delete cascade,
  game_id text not null,
  save_data text not null,
  updated_at text not null,
  primary key (user_id, game_id)
);

create index if not exists game_saves_updated_at_idx on game_saves(updated_at);

create table if not exists anonymous_chat_messages (
  message_id text primary key,
  visitor_id text not null,
  nickname text not null,
  content text not null,
  created_at text not null,
  hidden integer not null default 0,
  ip_hash text not null
);

create index if not exists anonymous_chat_messages_visible_idx
  on anonymous_chat_messages(hidden, created_at, message_id);
create index if not exists anonymous_chat_messages_visitor_idx
  on anonymous_chat_messages(visitor_id, created_at);
create index if not exists anonymous_chat_messages_ip_idx
  on anonymous_chat_messages(ip_hash, created_at);

create table if not exists articles (
  article_id text primary key,
  slug text not null unique,
  category text not null default 'note',
  tags text not null default '[]',
  cover_image text not null default '',
  status text not null default 'draft',
  is_pinned integer not null default 0,
  view_count integer not null default 0,
  created_at text not null,
  updated_at text not null,
  published_at text
);

create table if not exists article_translations (
  translation_id text primary key,
  article_id text not null references articles(article_id) on delete cascade,
  lang text not null,
  title text not null,
  summary text not null default '',
  content_markdown text not null default '',
  created_at text not null,
  updated_at text not null,
  unique(article_id, lang)
);

create index if not exists articles_status_published_idx
  on articles(status, published_at, article_id);
create index if not exists articles_category_idx
  on articles(category);
create index if not exists article_translations_article_lang_idx
  on article_translations(article_id, lang);

insert into articles (
  article_id, slug, category, tags, cover_image, status, is_pinned,
  view_count, created_at, updated_at, published_at
) values
  (
    'seed-xp-site-notes',
    'xp-site-notes',
    'site',
    '["个人站","记录"]',
    '',
    'published',
    1,
    0,
    '2026-06-11T00:00:00.000Z',
    '2026-06-11T00:00:00.000Z',
    '2026-06-11T00:00:00.000Z'
  ),
  (
    'seed-local-ai-workflow',
    'local-ai-workflow',
    'ai',
    '["AI","工具"]',
    '',
    'published',
    0,
    0,
    '2026-06-11T00:01:00.000Z',
    '2026-06-11T00:01:00.000Z',
    '2026-06-11T00:01:00.000Z'
  ),
  (
    'seed-fallback-check',
    'fallback-check',
    'note',
    '["fallback","测试"]',
    '',
    'published',
    0,
    0,
    '2026-06-11T00:02:00.000Z',
    '2026-06-11T00:02:00.000Z',
    '2026-06-11T00:02:00.000Z'
  ),
  (
    'seed-update-2026-06-11-site-update-articles',
    '2026-06-11-site-update-articles',
    'site-updates',
    '["网站更新","上线记录"]',
    '',
    'published',
    0,
    0,
    '2026-06-11T00:03:00.000Z',
    '2026-06-11T00:03:00.000Z',
    '2026-06-11T00:03:00.000Z'
  )
on conflict(article_id) do update set
  slug = excluded.slug,
  category = excluded.category,
  tags = excluded.tags,
  cover_image = excluded.cover_image,
  status = excluded.status,
  is_pinned = excluded.is_pinned,
  updated_at = excluded.updated_at,
  published_at = excluded.published_at;

insert into article_translations (
  translation_id, article_id, lang, title, summary, content_markdown, created_at, updated_at
) values
  (
    'seed-xp-site-notes-zh',
    'seed-xp-site-notes',
    'zh',
    '数据库化文章系统测试',
    '这篇文章用于验证中文文章列表和详情展示。',
    '# 数据库化文章系统测试

这是中文正文，保存在 Cloudflare D1 中。

## 验证点

- 文章列表来自数据库
- 正文使用 Markdown 保存
- 网站切换语言时会重新读取对应语言',
    '2026-06-11T00:00:00.000Z',
    '2026-06-11T00:00:00.000Z'
  ),
  (
    'seed-xp-site-notes-en',
    'seed-xp-site-notes',
    'en',
    'Database-backed Article Test',
    'This post verifies the English article list and detail view.',
    '# Database-backed Article Test

This English body is stored in Cloudflare D1.

## Checks

- The article list comes from the database
- The body is saved as Markdown
- Switching site language reloads the matching language',
    '2026-06-11T00:00:00.000Z',
    '2026-06-11T00:00:00.000Z'
  ),
  (
    'seed-xp-site-notes-ja',
    'seed-xp-site-notes',
    'ja',
    'データベース記事システムのテスト',
    '日本語の記事一覧と詳細表示を確認するための記事です。',
    '# データベース記事システムのテスト

この日本語本文は Cloudflare D1 に保存されています。

## 確認点

- 記事一覧はデータベースから読み込みます
- 本文は Markdown で保存します
- サイト言語を切り替えると対応言語を再読み込みします',
    '2026-06-11T00:00:00.000Z',
    '2026-06-11T00:00:00.000Z'
  ),
  (
    'seed-local-ai-workflow-zh',
    'seed-local-ai-workflow',
    'zh',
    '本地 AI 工作流记录',
    '记录本地模型、工具和个人站内容发布流程。',
    '# 本地 AI 工作流记录

这里可以记录模型下载、提示词、工具配置和发布步骤。

## 后续

以后 Codex 发布文章时，会一次性写入 zh / en / ja 三种版本。',
    '2026-06-11T00:01:00.000Z',
    '2026-06-11T00:01:00.000Z'
  ),
  (
    'seed-local-ai-workflow-en',
    'seed-local-ai-workflow',
    'en',
    'Local AI Workflow Notes',
    'Notes about local models, tools, and the site publishing flow.',
    '# Local AI Workflow Notes

This article can track model downloads, prompts, tool settings, and publishing steps.

## Later

When Codex publishes posts later, it will write zh / en / ja versions together.',
    '2026-06-11T00:01:00.000Z',
    '2026-06-11T00:01:00.000Z'
  ),
  (
    'seed-local-ai-workflow-ja',
    'seed-local-ai-workflow',
    'ja',
    'ローカルAIワークフロー記録',
    'ローカルモデル、ツール、サイト投稿フローのメモです。',
    '# ローカルAIワークフロー記録

モデルのダウンロード、プロンプト、ツール設定、投稿手順を記録できます。

## 今後

あとで Codex が記事を投稿するときは、zh / en / ja を同時に書き込みます。',
    '2026-06-11T00:01:00.000Z',
    '2026-06-11T00:01:00.000Z'
  ),
  (
    'seed-fallback-check-zh',
    'seed-fallback-check',
    'zh',
    'Fallback 逻辑测试',
    '这篇文章只有中文内容，用于验证英文和日文缺失时回退到中文。',
    '# Fallback 逻辑测试

这篇文章故意只提供中文版本。

当请求 `lang=en` 或 `lang=ja` 时，接口应该回退到中文内容。',
    '2026-06-11T00:02:00.000Z',
    '2026-06-11T00:02:00.000Z'
  ),
  (
    'seed-update-2026-06-11-site-update-articles-zh',
    'seed-update-2026-06-11-site-update-articles',
    'zh',
    '网站更新记录接入知识库',
    '网站更新记录成为知识库文章分类，首页欢迎弹窗会自动读取最近更新文章。',
    '# 网站更新记录接入知识库

本次更新把网站更新记录接入数据库化三语文章系统。

## 更新内容

- 知识库新增网站更新记录分类，并排在分类列表最后
- 首页欢迎弹窗右侧最近更新自动读取该分类文章
- 查看更多更新会跳转到知识库的网站更新记录分类
- 欢迎弹窗左侧改为站长施工公告
- 视频区和资源区卡片滚动与按钮间距得到整理
- 默认语言会优先跟随浏览器或系统语言，用户手动切换后会记住选择',
    '2026-06-11T00:03:00.000Z',
    '2026-06-11T00:03:00.000Z'
  ),
  (
    'seed-update-2026-06-11-site-update-articles-en',
    'seed-update-2026-06-11-site-update-articles',
    'en',
    'Site Update Log joins the knowledge base',
    'Site updates are now real knowledge-base articles, and the welcome popup reads the latest update posts automatically.',
    '# Site Update Log joins the knowledge base

This update connects the site update log to the database-backed trilingual article system.

## Changes

- Added a Site Update Log category to the knowledge base and placed it last
- The welcome popup now reads recent update articles from that category
- More updates opens the Site Update Log category in the knowledge base
- The left side of the welcome popup now shows an owner status notice
- Video and resource cards now have better scrolling and button spacing
- The default language follows the browser or system language, then remembers manual user choices',
    '2026-06-11T00:03:00.000Z',
    '2026-06-11T00:03:00.000Z'
  ),
  (
    'seed-update-2026-06-11-site-update-articles-ja',
    'seed-update-2026-06-11-site-update-articles',
    'ja',
    'サイト更新記録を知識庫に接続',
    'サイト更新記録を知識庫の記事分類にし、歓迎ポップアップが最新更新記事を自動で読み込みます。',
    '# サイト更新記録を知識庫に接続

今回の更新で、サイト更新記録をデータベース対応の三言語記事システムに接続しました。

## 更新内容

- 知識庫にサイト更新記録カテゴリを追加し、分類一覧の最後に配置
- 歓迎ポップアップ右側の最近の更新が、このカテゴリの記事を自動で読み込みます
- もっと見るから知識庫のサイト更新記録カテゴリへ移動できます
- 歓迎ポップアップ左側を管理人の工事中お知らせに変更
- 動画とリソースのカード表示、スクロール、ボタン余白を整理
- 初期言語はブラウザまたはシステム言語に合わせ、手動変更後はその選択を保存します',
    '2026-06-11T00:03:00.000Z',
    '2026-06-11T00:03:00.000Z'
  )
on conflict(article_id, lang) do update set
  title = excluded.title,
  summary = excluded.summary,
  content_markdown = excluded.content_markdown,
  updated_at = excluded.updated_at;

insert into articles (
  article_id, slug, category, tags, cover_image, status, is_pinned,
  view_count, created_at, updated_at, published_at
) values (
  'seed-update-2026-06-11-sync-layout-chat',
  '2026-06-11-sync-layout-chat',
  'site-updates',
  '["网站更新","修复记录"]',
  '',
  'published',
  0,
  0,
  '2026-06-11T00:04:00.000Z',
  '2026-06-11T00:04:00.000Z',
  '2026-06-11T00:04:00.000Z'
)
on conflict(article_id) do update set
  slug = excluded.slug,
  category = excluded.category,
  tags = excluded.tags,
  cover_image = excluded.cover_image,
  status = excluded.status,
  is_pinned = excluded.is_pinned,
  updated_at = excluded.updated_at,
  published_at = excluded.published_at;

insert into article_translations (
  translation_id, article_id, lang, title, summary, content_markdown, created_at, updated_at
) values
  (
    'seed-update-2026-06-11-sync-layout-chat-zh',
    'seed-update-2026-06-11-sync-layout-chat',
    'zh',
    '同步部署与页面显示修复',
    '修复线上线下版本核对、视频和资源卡片布局、小黑屋事件翻译、知识库读取与聊天室轮询。',
    '# 同步部署与页面显示修复

本次更新集中处理线上线下显示不一致和几个页面交互问题。

## 更新内容

- 更新 CSS / JS 资源版本号，减少浏览器继续使用旧资源导致的线上线下不同步。
- 视频区和资源区卡片改为固定缩略图比例、固定按钮高度和一致的网格布局。
- 删除知识库三篇测试文章，只保留真实的网站更新记录文章。
- 知识库详情增加请求状态保护，避免频繁切换语言后一直停留在读取中。
- 小黑屋补充 Penrose 事件缺失的中文和日文翻译。
- 首页视频区、资源区、杂谈区桌面图标加上建设中标记。
- 匿名聊天室改为 after/message_id 增量拉取，并根据空闲和后台状态自动降低轮询频率。',
    '2026-06-11T00:04:00.000Z',
    '2026-06-11T00:04:00.000Z'
  ),
  (
    'seed-update-2026-06-11-sync-layout-chat-en',
    'seed-update-2026-06-11-sync-layout-chat',
    'en',
    'Deployment sync and layout fixes',
    'This update fixes deployment verification, video/resource card layout, A Dark Room event localization, article loading, and chat polling.',
    '# Deployment sync and layout fixes

This update focuses on local/production consistency and several visible interaction issues.

## Changes

- Bumped CSS / JS asset versions so browsers do not keep using stale production resources.
- Video and resource cards now use fixed thumbnail ratios, stable button heights, and consistent grid behavior.
- Removed the three test knowledge-base articles and kept real site update posts.
- Added request-state guards to article detail loading so language switching cannot leave the page stuck.
- Added missing Chinese and Japanese translations for the Penrose event in A Dark Room.
- Marked the home desktop icons for Videos, Resources, and Talk as under construction.
- Anonymous chat now keeps after/message_id incremental pulls and slows polling while idle or in the background.',
    '2026-06-11T00:04:00.000Z',
    '2026-06-11T00:04:00.000Z'
  ),
  (
    'seed-update-2026-06-11-sync-layout-chat-ja',
    'seed-update-2026-06-11-sync-layout-chat',
    'ja',
    'デプロイ同期と表示修正',
    '本更新では、本番との同期確認、動画・リソースカード、小黑屋イベント翻訳、記事読み込み、チャット更新頻度を修正しました。',
    '# デプロイ同期と表示修正

今回の更新では、ローカルと本番の表示差分、そしていくつかの画面上の問題をまとめて直しました。

## 更新内容

- CSS / JS のバージョン番号を更新し、古い本番リソースが残り続ける問題を減らしました。
- 動画とリソースのカードに固定サムネイル比率、安定したボタン高さ、統一したグリッドを適用しました。
- 知識庫のテスト記事 3 件を削除し、実際のサイト更新記事だけを残しました。
- 記事詳細にリクエスト状態の保護を追加し、言語切り替え後に読み込み中のまま残る問題を防ぎました。
- 小黑屋の Penrose イベントに不足していた中国語と日本語の翻訳を追加しました。
- ホームの動画、リソース、雑談アイコンに工事中の表示を追加しました。
- 匿名チャットは after/message_id の差分取得を維持し、待機中やバックグラウンドでは更新頻度を下げるようにしました。',
    '2026-06-11T00:04:00.000Z',
    '2026-06-11T00:04:00.000Z'
  )
on conflict(article_id, lang) do update set
  title = excluded.title,
  summary = excluded.summary,
  content_markdown = excluded.content_markdown,
  updated_at = excluded.updated_at;

insert into articles (
  article_id, slug, category, tags, cover_image, status, is_pinned,
  view_count, created_at, updated_at, published_at
) values (
  'seed-update-2026-06-11-time-window-library-fix',
  '2026-06-11-time-window-library-fix',
  'site-updates',
  '["网站更新","时间显示","知识库","窗口"]',
  '',
  'published',
  0,
  0,
  '2026-06-11T14:25:00.000Z',
  '2026-06-11T14:25:00.000Z',
  '2026-06-11T14:25:00.000Z'
)
on conflict(article_id) do update set
  slug = excluded.slug,
  category = excluded.category,
  tags = excluded.tags,
  cover_image = excluded.cover_image,
  status = excluded.status,
  is_pinned = excluded.is_pinned,
  updated_at = excluded.updated_at,
  published_at = excluded.published_at;

insert into article_translations (
  translation_id, article_id, lang, title, summary, content_markdown, created_at, updated_at
) values
  (
    'seed-update-2026-06-11-time-window-library-fix-zh',
    'seed-update-2026-06-11-time-window-library-fix',
    'zh',
    '时间显示、知识库返回与窗口尺寸整理',
    '按用户所在时区显示文章和聊天室时间，关闭知识库后回到首页，并收紧关于我窗口。',
    '# 时间显示、知识库返回与窗口尺寸整理

本次更新继续整理几个日常使用时容易出戏的小问题。

## 更新内容

- 知识库文章发布时间按用户所在时区显示，并显示到秒和时区名。
- 匿名聊天室消息时间也按用户所在时区显示，今天只显示时间，旧消息显示日期、时间和时区。
- 从文章详情关闭知识库后，再打开知识库会回到知识库首页。
- 关于我页面改为更紧凑的窗口，其它普通板块统一为稍大的内容窗口，聊天室保持原本尺寸。
- 首页中文三个待建设入口从“施工中”改为“待定”，并放宽图标文字区域，尽量显示完整。',
    '2026-06-11T14:25:00.000Z',
    '2026-06-11T14:25:00.000Z'
  ),
  (
    'seed-update-2026-06-11-time-window-library-fix-en',
    'seed-update-2026-06-11-time-window-library-fix',
    'en',
    'Time display, knowledge reset, and window sizing',
    'Article and chat times now respect the visitor timezone, knowledge detail closes back to the home view, and About is more compact.',
    '# Time display, knowledge reset, and window sizing

This update polishes a few everyday browsing details.

## Changes

- Knowledge-base publish times now render in the visitor timezone, down to seconds, with the timezone label.
- Anonymous chat message times also use the visitor timezone; today shows time only, older messages show date, time, and timezone.
- Closing the knowledge base from an article detail resets it to the knowledge home view for the next open.
- The About page is now a compact window, while other regular sections share a slightly larger content window; chat keeps its own size.
- The three pending home entries now use TBD wording, with wider desktop icon labels so text can fit more naturally.',
    '2026-06-11T14:25:00.000Z',
    '2026-06-11T14:25:00.000Z'
  ),
  (
    'seed-update-2026-06-11-time-window-library-fix-ja',
    'seed-update-2026-06-11-time-window-library-fix',
    'ja',
    '時刻表示、知識庫の戻り先、ウィンドウサイズ調整',
    '記事とチャットの時刻を閲覧者のタイムゾーンに合わせ、知識庫詳細から閉じた後は一覧に戻るようにしました。',
    '# 時刻表示、知識庫の戻り先、ウィンドウサイズ調整

今回の更新では、普段の閲覧で気になる細かな表示を整えました。

## 更新内容

- 知識庫の記事公開時刻を閲覧者のタイムゾーンで秒まで表示し、タイムゾーン名も表示します。
- 匿名チャットの時刻も閲覧者のタイムゾーンに合わせ、当日は時刻のみ、古いメッセージは日付・時刻・タイムゾーンを表示します。
- 記事詳細から知識庫を閉じた後、次に開くと知識庫トップに戻ります。
- プロフィール画面をコンパクトにし、他の通常セクションは少し広い共通ウィンドウに整理しました。チャットは従来サイズのままです。
- ホームの3つの未完成入口は「未定」表記にし、アイコン文字領域を広げて文言を表示しやすくしました。',
    '2026-06-11T14:25:00.000Z',
    '2026-06-11T14:25:00.000Z'
  )
on conflict(article_id, lang) do update set
  title = excluded.title,
  summary = excluded.summary,
  content_markdown = excluded.content_markdown,
  updated_at = excluded.updated_at;

delete from article_translations
where article_id in ('seed-xp-site-notes', 'seed-local-ai-workflow', 'seed-fallback-check');

delete from articles
where article_id in ('seed-xp-site-notes', 'seed-local-ai-workflow', 'seed-fallback-check');
