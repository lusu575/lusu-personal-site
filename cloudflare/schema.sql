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
  client_id text not null default '',
  nickname text not null,
  content text not null,
  created_at text not null,
  edited_at text,
  hidden integer not null default 0,
  ip_hash text not null,
  ip_prefix text not null default ''
);

create index if not exists anonymous_chat_messages_visible_idx
  on anonymous_chat_messages(hidden, created_at, message_id);
create index if not exists anonymous_chat_messages_visitor_idx
  on anonymous_chat_messages(visitor_id, created_at);
create index if not exists anonymous_chat_messages_ip_idx
  on anonymous_chat_messages(ip_hash, created_at);
create table if not exists chat_bans (
  ban_id text primary key,
  ban_type text not null,
  visitor_id text not null default '',
  ip_hash text not null default '',
  ip_prefix text not null default '',
  reason text not null default '',
  active integer not null default 1,
  created_by text not null,
  created_at text not null,
  expires_at text
);

create index if not exists chat_bans_active_visitor_idx
  on chat_bans(active, visitor_id, expires_at);
create index if not exists chat_bans_active_ip_idx
  on chat_bans(active, ip_hash, expires_at);

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

create table if not exists site_visitors (
  visitor_id text primary key,
  first_seen_at text not null,
  last_seen_at text not null,
  visit_count integer not null default 0,
  ip_hash text not null default '',
  ip_prefix text not null default '',
  country text not null default '',
  region text not null default '',
  city text not null default '',
  timezone text not null default '',
  colo text not null default '',
  latitude real,
  longitude real,
  user_agent text not null default '',
  language text not null default ''
);

create index if not exists site_visitors_last_seen_idx
  on site_visitors(last_seen_at);

create table if not exists analytics_page_views (
  event_id text primary key,
  visitor_id text not null,
  path text not null,
  route text not null default '',
  referrer text not null default '',
  title text not null default '',
  lang text not null default 'zh',
  screen_width integer not null default 0,
  screen_height integer not null default 0,
  country text not null default '',
  region text not null default '',
  city text not null default '',
  timezone text not null default '',
  colo text not null default '',
  latitude real,
  longitude real,
  ip_hash text not null default '',
  ip_prefix text not null default '',
  created_at text not null
);

create index if not exists analytics_page_views_created_idx
  on analytics_page_views(created_at);
create index if not exists analytics_page_views_visitor_idx
  on analytics_page_views(visitor_id, created_at);
create index if not exists analytics_page_views_geo_idx
  on analytics_page_views(country, region, city, created_at);

create table if not exists analytics_click_events (
  event_id text primary key,
  visitor_id text not null,
  path text not null,
  route text not null default '',
  target_key text not null default '',
  target_text text not null default '',
  tag_name text not null default '',
  element_id text not null default '',
  element_classes text not null default '',
  href text not null default '',
  data_route text not null default '',
  screen_width integer not null default 0,
  screen_height integer not null default 0,
  click_x integer not null default 0,
  click_y integer not null default 0,
  country text not null default '',
  region text not null default '',
  city text not null default '',
  timezone text not null default '',
  colo text not null default '',
  ip_hash text not null default '',
  ip_prefix text not null default '',
  created_at text not null
);

create index if not exists analytics_click_events_created_idx
  on analytics_click_events(created_at);
create index if not exists analytics_click_events_target_idx
  on analytics_click_events(target_key, created_at);
create index if not exists analytics_click_events_visitor_idx
  on analytics_click_events(visitor_id, created_at);

create table if not exists article_view_events (
  event_id text primary key,
  article_id text not null,
  slug text not null,
  lang text not null default 'zh',
  visitor_id text not null,
  country text not null default '',
  region text not null default '',
  city text not null default '',
  timezone text not null default '',
  colo text not null default '',
  latitude real,
  longitude real,
  ip_hash text not null default '',
  ip_prefix text not null default '',
  created_at text not null
);

create index if not exists article_view_events_article_idx
  on article_view_events(article_id, created_at);
create index if not exists article_view_events_slug_idx
  on article_view_events(slug, created_at);
create index if not exists article_view_events_visitor_idx
  on article_view_events(visitor_id, created_at);

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

insert into articles (
  article_id, slug, category, tags, cover_image, status, is_pinned,
  view_count, created_at, updated_at, published_at
) values
  ('seed-ai-agent-workflow-guide-2026-06-14', 'ai-agent-workflow-guide', 'ai', '["AI","Agent","Codex","经验"]', '', 'published', 1, 0, '2026-06-14T15:00:00.000Z', '2026-06-14T15:00:00.000Z', '2026-06-14T15:00:00.000Z'),
  ('seed-update-2026-06-14-ai-agent-article', '2026-06-14-ai-agent-article', 'site-updates', '["网站更新","AI","文章"]', '', 'published', 0, 0, '2026-06-14T15:01:00.000Z', '2026-06-14T15:01:00.000Z', '2026-06-14T15:01:00.000Z'),
  ('seed-update-2026-06-14-article-reading-links', '2026-06-14-article-reading-links', 'site-updates', '["网站更新","知识库","文章"]', '', 'published', 0, 0, '2026-06-14T16:20:00.000Z', '2026-06-14T16:20:00.000Z', '2026-06-14T16:20:00.000Z'),
  ('seed-update-2026-06-15-clouds-docs-maintenance', '2026-06-15-clouds-docs-maintenance', 'site-updates', '["网站更新","首页","动态壁纸","维护记录"]', '', 'published', 0, 0, '2026-06-15T05:00:00.000Z', '2026-06-15T05:00:00.000Z', '2026-06-15T05:00:00.000Z')
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
  ('seed-ai-agent-workflow-guide-2026-06-14-zh', 'seed-ai-agent-workflow-guide-2026-06-14', 'zh', '从提问到上线：普通人如何用 AI Agent 放大执行力', '一篇面向普通人的 AI Agent 实战笔记，解释大模型原理、线程拆分、Agent、Skill、MCP、Git、模型选择和使用经验。', '# 从提问到上线：普通人如何用 AI Agent 放大执行力

> 核心观点：AI 不是替代人，而是放大人的执行力。会用 AI 的关键，不是会写代码，而是会把工作拆清楚、讲清楚、验收清楚。

很多人用 AI，还停留在“问一句，答一句”。这当然有用，但真正能改变工作效率的，是把 AI 当成一个能协助推进任务的 Agent：你给它背景、目标、限制和验收标准，它帮你拆解、执行、检查、记录。

我做个人站的过程就是这个逻辑：先用 GPT 把模糊想法整理成网站定位、页面结构、视觉风格和功能范围，再用 Codex 进入项目现场，读取项目文件，按规则修改、检查、更新记录。最后由人来判断方向、取舍范围、验收结果。

这不是“一句话让 AI 变出网站”，而是一个更实用的流程：人负责判断，AI 放大执行。

## 1. AI 的基础原理：它本质上是在预测下一个 Token

大模型回答问题，可以粗略理解为“根据上下文预测下一个字”。更准确地说，是预测下一个 Token。Token 可以是字、词、数字、符号或代码片段。

这件事很重要，因为它解释了 AI 的几个特点：

1. 它不是全知全能，而是基于当前上下文生成最可能合适的内容。
2. 你给的信息越清楚，它越容易沿着正确方向预测。
3. 你给的信息越乱，它越容易抓错重点。
4. 你没有提供的事实，它可能会猜。
5. 旧对话太长时，关键内容可能被稀释，甚至被挤出上下文。

所以，使用 AI 的第一原则不是“写神奇咒语”，而是管理上下文。

## 2. 为什么长项目要拆线程

很多人把一个项目从头聊到尾，最后发现 AI 越来越不稳。原因很简单：同一个聊天线程里塞了太多历史，模型每次都要在一堆旧信息里判断什么重要、什么已经过时、什么只是中间方案。

我的经验是：长项目不要一直堆在同一个线程里，要按阶段拆。

可以这样拆：

```text
需求澄清线程：只聊目标、用户、范围、优先级
方案设计线程：只聊架构、页面、流程、风险
执行线程：只让 Agent 按明确任务动手
修 bug 线程：只放现象、复现步骤、期望结果
总结线程：只整理变更、经验、文档和下一步
```

每开一个新线程，都带一份“项目交接包”：

```text
项目背景：这是一个什么项目
当前状态：已经完成什么，还缺什么
本次目标：这次只要做什么
限制条件：不能做什么，必须遵守什么
相关文件：需要读哪些资料
验收标准：做到什么算完成
输出格式：我要清单、方案、代码、文章还是 PPT
```

换线程不是为了重新开始，而是为了让 AI 的上下文变干净。

## 3. Agent 的工作原理

模型像大脑，Agent 像一个带工具的工作角色。

普通聊天主要是回答；Agent 可以在授权范围内读文件、调用工具、执行命令、打开浏览器、修改文档、生成图片、导出 PPT、跑检查。它的工作循环通常是：

```text
理解任务 -> 读取上下文 -> 制定步骤 -> 调用工具 -> 检查结果 -> 汇报或继续修正
```

这就是 Codex 有价值的地方。它不是只告诉我“你可以这样改”，而是能进入项目目录，读取 README、PROJECT_CONTEXT、CHANGELOG 和项目 Skill，再按已有规则执行。

但 Agent 也不是自动可靠。它需要权限、工具、上下文和验收标准。没有边界的 Agent，容易把简单问题做复杂；没有验收标准的 Agent，做完了也不知道对不对。

## 4. 几个必须知道的概念

大模型：负责理解、推理、生成内容的核心能力。不同模型擅长的任务不一样，一般来说，参数规模、训练质量和推理能力都会影响模型表现，但不是“体积越大就一定更好”。

Token：AI 处理文字的基本单位。输入越长、输出越长，成本和时间通常越高。

上下文窗口：AI 当前能看到的信息范围。窗口外的信息，它就像没看见。

Prompt：你给 AI 的任务说明。好 Prompt 的本质是好交代。

RAG：让 AI 先从指定资料里检索，再基于资料回答。适合公司知识库、文档问答。

微调：用专门数据训练模型，让它更适合某类任务。多数普通团队一开始不需要，先把 Prompt、知识库和流程做好更划算。

Tool Calling：让模型调用外部工具，比如搜索、查表、读文件、发请求、操作浏览器。

Skill：给 Agent 的专项工作说明。它把某类任务的流程、规则、参考资料和脚本打包起来，让 Codex 更稳定地执行重复工作。OpenAI 文档里也把 Skill 描述为给 Codex 增加特定能力和工作流的方式。Skill 本质就是文档和提示词工程，是提前把一段规则输入给 AI。

MCP：Model Context Protocol，可以理解成 AI 连接外部工具和上下文的标准接口。通过 MCP，Codex 可以访问第三方文档、浏览器、Figma、GitHub 等工具。

Git：版本管理工具。它记录项目每次改了什么，方便回退、比较、协作。

GitHub：托管代码和协作的平台。仓库是项目文件夹，commit 是一次保存记录，branch 是分支，PR 是把分支合并回主线前的审查申请。

## 5. 最好用的提示词公式

我最常用的是这套：

```text
背景 + 目标 + 当前状态 + 限制条件 + 验收标准 + 输出格式 + 不要做什么
```

例子，不要这样问：

```text
帮我做个匿名聊天室。
```

更好的问法是：

```text
我想在个人站加入轻量匿名聊天室。目标是让访客公开留言。
当前网站部署在 Cloudflare Pages，已有 D1 数据库。
第一版只做公开房间、纯文本、随机昵称、本地记住昵称、字数限制、发送冷却和轮询刷新。
不要做私聊、图片上传、多房间和复杂后台。
验收标准是手机和电脑都能发消息，刷新后消息仍存在，用户输入不会执行脚本，界面符合现有 XP 像素风。
请先给方案，再执行最小可用版本，并更新项目文档。
```

AI 不是怕任务难，是怕你让它猜。

## 6. 使用 AI 的实战技巧

第一，先让 AI 反问你。需求不清时，不要急着让它做，先说：“请先指出缺失信息和风险，不要直接执行。”

第二，把大任务拆成小任务。比如“做网站”要拆成结构、视觉、首页、登录、数据库、移动端、部署、文档。每次只让 AI 处理一块。

第三，明确不要做什么。很多跑偏都不是 AI 不会，而是你没说边界。

第四，让 AI 输出验收清单。比如“做完后请列出我应该检查哪些地方”。这会让结果更容易落地。

第五，重要任务先要方案。涉及账号、数据、安全、费用、发布时，不要直接执行，先让 AI 写方案和风险。

第六，反复沉淀项目规则。把长期规则写进 README、PROJECT_CONTEXT、CHANGELOG 或 Skill，不要每次靠口头补充。

第七，经常让 AI 总结交接包。一个线程结束前，让它总结“已完成、未完成、关键决策、下一步、注意事项”，方便开新线程。

## 7. AI 市场现在是什么状态

截至 2026 年 6 月 14 日，AI 模型市场已经非常拥挤，不是一家独大。竞争大概分成几类：

1. 通用闭源旗舰：OpenAI GPT、Anthropic Claude、Google Gemini、xAI Grok。
2. 国内大模型与平台：Qwen/阿里百炼、DeepSeek、智谱 GLM、豆包/火山方舟、Kimi、MiniMax、腾讯混元等。
3. 开放权重生态：Meta Llama、Mistral 等，适合本地部署、私有化和二次开发。
4. 多模态与媒体模型：图像、视频、音频、语音、文档理解正在快速竞争。
5. Agent 平台：不只是模型强弱，还要看工具调用、上下文管理、权限、安全、可观测性和工作流。

主流模型大致可以这样理解：

OpenAI：综合能力强，适合复杂推理、代码、Agent 和工具调用。官方模型文档建议复杂推理和编码从旗舰模型开始，成本和延迟敏感时选小模型。

Claude：长文档、写作、代码和复杂分析很强，适合需要稳重表达和长上下文理解的任务。

Gemini：多模态生态强，文本、图像、语音、视频、实时能力覆盖广，适合 Google 生态和多媒体任务。

DeepSeek：中文和代码场景关注度高，成本、长上下文和工具调用是常见优势点。

Qwen/阿里百炼：国内平台化能力强，模型种类多，文本、图像、音频、视频、向量等覆盖广。

Llama：开放生态重要，适合研究、本地化、私有部署和可控环境。

Mistral：开源和企业模型并行，代码、Agent、文档和多模态方向都有布局。

Grok：xAI 生态模型，偏通用对话、工具调用和 X 相关生态。

GLM、豆包、Kimi、MiniMax、混元：国内常见选择，具体要看中文能力、上下文、价格、接口、合规和所在平台生态。

## 8. 什么是“好模型”

好模型不是排行榜第一，而是适合你的任务。

判断模型好不好，可以看这几项：

1. 准确性：在你的真实问题上是否少犯错。
2. 指令遵循：能不能按格式、边界和角色要求输出。
3. 长上下文：能不能读长文档、长项目、长对话而不乱。
4. 推理能力：能不能拆复杂问题、发现矛盾、给出取舍。
5. 工具调用：能不能稳定使用搜索、文件、代码、浏览器、数据库等工具。
6. 代码能力：能不能读懂项目、少改错、会测试、会解释风险。
7. 中文能力：是否符合中文表达习惯，是否能处理中文业务语境。
8. 成本和速度：高频任务不能只看能力，也要看价格和响应时间。
9. 稳定性：同样任务多试几次，结果是否稳定。
10. 安全与合规：数据是否能进外部模型，是否需要本地或企业方案。

最实用的方法是用自己的任务做小型盲测。选 3 到 5 个真实问题，让不同模型回答，再按准确、可用、格式、速度、成本打分。别只看网上榜单。

## 9. 该怎么选 AI 和 Agent

普通写作、总结、头脑风暴：选你用得顺、表达稳定的通用模型。

长文档分析：优先看上下文长度、引用能力和长文稳定性。

代码项目：选能读项目、会改文件、能跑检查的 Agent，比如 Codex 这类工作流工具。

做 PPT、图片、视频：选有对应插件或多模态能力的工具，不要指望纯聊天模型包办所有视觉细节。注意不同模型支持多模态能力情况不同，比如 DeepSeek 的主流文本模型暂时不适合直接处理图片任务。

公司知识库：优先考虑 RAG、权限、审计和数据安全，而不是一上来微调。

高频低风险任务：可以用便宜快的小模型。

重要决策材料：用强模型，但必须人工复核。

涉及隐私、合同、客户和内部系统：先看公司规则，必要时用企业版、私有化或本地模型。

## 10. 我的经验总结

第一，AI 最能放大的不是懒，而是清晰。你越会表达目标、边界和验收标准，AI 越好用。可以把模糊的需求先交给对话型 AI，然后让它帮你完善。中间不认识的关键词，及时问 AI。尽量让 AI 给你多个可选的执行选项，从中挑选。

第二，Agent 适合执行明确任务，不适合替你决定方向。方向、取舍、责任还是人的。

第三，长项目一定要文档化。项目背景、规则、变更记录、下一步，比一次漂亮输出更重要。要有项目文档，注意事项和 Skill，更新记录文档。每次开新线程。让 AI 读取这些文档就可以。

第四，别迷信单一插件技能，但是 Skill 也不是越多越好，过多 Skill 会导致上下文过长。写作、代码、图片、PPT、知识库、部署，可能需要不同工具组合。

第五，缺信息就标出来。靠谱的 AI 协作不是把空白编满，而是把不确定性暴露出来。', '2026-06-14T15:00:00.000Z', '2026-06-14T15:00:00.000Z'),
  ('seed-ai-agent-workflow-guide-2026-06-14-en', 'seed-ai-agent-workflow-guide-2026-06-14', 'en', 'From Prompt to Launch: How Non-Technical People Can Use AI Agents to Amplify Execution', 'A practical AI Agent guide for non-technical readers, covering model basics, thread splitting, Agents, Skills, MCP, Git, model selection, and field experience.', '# From Prompt to Launch: How Non-Technical People Can Use AI Agents to Amplify Execution

> Core idea: AI does not replace people. It amplifies execution. The key is not knowing how to code, but knowing how to clarify work, describe it well, and check the result.

Many people still use AI as a one-question, one-answer tool. That is useful, but the bigger productivity shift happens when you treat AI as an Agent that can help move work forward. You give it context, goals, constraints, and acceptance criteria. It helps break the task down, execute, check, and record what changed.

That is how I build my personal site. I first use GPT to turn vague ideas into positioning, page structure, visual direction, and feature scope. Then I use Codex inside the actual project. Codex reads the project files, follows rules, edits, checks, and updates records. The human still decides direction, scope, and whether the final result is acceptable.

This is not “one sentence creates a website.” The practical workflow is: humans judge, AI multiplies execution.

## 1. The Basic Principle: AI Predicts the Next Token

A large model can be roughly understood as predicting the next word from context. More accurately, it predicts the next token. A token can be a character, word, number, symbol, or piece of code.

This matters because it explains several AI behaviors:

1. It is not all-knowing. It generates what is most likely to fit the current context.
2. The clearer your input is, the easier it is for the model to continue in the right direction.
3. The messier your input is, the easier it is for the model to focus on the wrong thing.
4. If facts are missing, it may guess.
5. When a conversation gets too long, key facts can be diluted or pushed out of context.

So the first rule of using AI is not writing magic prompts. It is managing context.

## 2. Why Long Projects Need Separate Threads

Many people keep one project inside one endless chat. Later, the AI becomes less stable. The reason is simple: the thread contains too much old history. Each response must decide what still matters, what is outdated, and what was only a temporary idea.

My experience is to split long projects by stage.

A practical split looks like this:

```text
Requirement thread: goals, users, scope, priorities
Design thread: architecture, pages, flows, risks
Execution thread: clear tasks for the Agent to perform
Bug-fix thread: symptoms, reproduction steps, expected result
Summary thread: changes, lessons, docs, next steps
```

Every new thread should start with a handoff package:

```text
Project background: what this project is
Current state: what is done and what is missing
Goal for this thread: what should be done now
Constraints: what must not be changed, what rules must be followed
Related files: what materials the AI should read
Acceptance criteria: what counts as finished
Output format: checklist, plan, code, article, or deck
```

Switching threads is not starting over. It keeps the AI context clean.

## 3. How an Agent Works

The model is like the brain. The Agent is a work role with tools.

A normal chat mainly answers. An Agent can read files, call tools, run commands, open a browser, edit documents, generate images, export slides, and run checks within the permissions you give it. The loop usually looks like this:

```text
Understand the task -> Read context -> Plan steps -> Use tools -> Check results -> Report or keep fixing
```

That is why Codex is useful. It does not only say “you can change it this way.” It can enter the project folder, read README, PROJECT_CONTEXT, CHANGELOG, and the project Skill, then work according to existing rules.

But an Agent is not automatically reliable. It needs permissions, tools, context, and acceptance criteria. An Agent with no boundary can make simple problems complicated. An Agent with no acceptance criteria does not know whether the work is actually done.

## 4. Concepts Worth Knowing

Large model: the core system that understands, reasons, and generates content. Different models are good at different tasks. Parameters, training quality, data, tools, and reasoning design all affect performance. Bigger is not always better.

Token: the basic unit AI processes. Longer input and output usually mean more time and cost.

Context window: the information range the AI can see right now. Outside the window, it is as if the information does not exist.

Prompt: the instruction you give AI. A good prompt is a clear handoff.

RAG: retrieval-augmented generation. The AI first searches specified materials, then answers from those materials. It fits company knowledge bases and document Q&A.

Fine-tuning: training a model on specialized data so it fits a certain task better. Most small teams should first improve prompts, knowledge bases, and workflow before fine-tuning.

Tool Calling: letting the model call external tools, such as search, tables, files, HTTP requests, browsers, or databases.

Skill: a specialized work instruction for an Agent. It packages process, rules, references, and scripts for a repeatable task, so Codex can execute more consistently. In practice, a Skill is documentation and prompt engineering: you prepare the rules before the task starts.

MCP: Model Context Protocol. It is a standard way for AI to connect to external tools and context. Through MCP, Codex can reach tools such as docs, browsers, Figma, and GitHub.

Git: a version control tool. It records what changed each time, making rollback, comparison, and collaboration easier.

GitHub: a platform for hosting code and collaborating. A repository is the project folder, a commit is a saved change, a branch is a separate work line, and a PR is a review request before merging work back into the main line.

## 5. The Prompt Formula I Use Most

My usual formula is:

```text
Background + Goal + Current state + Constraints + Acceptance criteria + Output format + What not to do
```

A weak request looks like this:

```text
Help me build an anonymous chat room.
```

A stronger request looks like this:

```text
I want to add a lightweight anonymous chat room to my personal site. The goal is public visitor messages.
The site is deployed on Cloudflare Pages and already has a D1 database.
For version one, only build a public room, plain text, random nickname, local nickname memory, character limit, send cooldown, and polling refresh.
Do not build private chat, image upload, multiple rooms, or a complex admin panel.
Acceptance criteria: messages work on mobile and desktop, messages still exist after refresh, user input cannot execute scripts, and the interface matches the current XP pixel style.
Please give the plan first, then build the minimum usable version and update the project docs.
```

AI is not afraid of hard work. It is afraid of guessing.

## 6. Practical AI Techniques

First, ask AI to question you before it acts. When requirements are unclear, say: “Please point out missing information and risks first. Do not execute yet.”

Second, break large work into small tasks. “Build a website” should become structure, visual design, home page, login, database, mobile view, deployment, and documentation. Ask AI to handle one piece at a time.

Third, say what not to do. Many mistakes happen because the boundary was never stated.

Fourth, ask for an acceptance checklist. For example: “After finishing, list what I should check.” This makes the result easier to review.

Fifth, ask for a plan before important work. For accounts, data, security, cost, or publishing, do not execute immediately. Ask for the plan and risks first.

Sixth, turn long-term rules into documents. Put durable rules in README, PROJECT_CONTEXT, CHANGELOG, or Skills instead of repeating them by memory.

Seventh, ask AI to summarize a handoff package often. Before a thread ends, ask for completed work, unfinished work, decisions, next steps, and cautions. The next thread will be much cleaner.

## 7. The AI Market Right Now

As of June 14, 2026, the AI model market is crowded and highly competitive. It is not controlled by one company. The competition is roughly split into these groups:

1. General closed flagship models: OpenAI GPT, Anthropic Claude, Google Gemini, and xAI Grok.
2. Chinese model platforms: Qwen / Alibaba Cloud Model Studio, DeepSeek, Zhipu GLM, Doubao / Volcano Engine, Kimi, MiniMax, Tencent Hunyuan, and others.
3. Open-weight ecosystems: Meta Llama, Mistral, and similar models for local deployment, private use, and customization.
4. Multimodal and media models: image, video, audio, speech, and document understanding are all moving quickly.
5. Agent platforms: model quality matters, but so do tool use, context management, permissions, safety, observability, and workflow.

A simple way to read the market:

OpenAI: strong general capability, complex reasoning, coding, Agent workflows, and tool use.

Claude: strong at long documents, writing, code, and careful analysis.

Gemini: strong multimodal coverage and a broad Google ecosystem.

DeepSeek: widely discussed in Chinese and coding scenarios, often valued for cost and long-context options.

Qwen / Alibaba Cloud Model Studio: strong platform coverage in China, with text, image, audio, video, embedding, and model service options.

Llama: important open ecosystem for research, local deployment, private environments, and controllability.

Mistral: combines open and enterprise models, with focus areas such as code, Agents, documents, and multimodal work.

Grok: a general model line from xAI, tied to its own ecosystem and tool use.

GLM, Doubao, Kimi, MiniMax, and Hunyuan: common Chinese choices. Compare them by Chinese ability, context length, pricing, API access, compliance, and platform ecosystem.

Model names change quickly. Do not memorize names only. Learn how to evaluate fit.

## 8. What Makes a Good Model

A good model is not simply the top model on a leaderboard. It is the model that fits your task.

Judge models by these items:

1. Accuracy: does it make fewer mistakes on your real questions?
2. Instruction following: can it follow format, boundaries, and role requirements?
3. Long context: can it read long documents, projects, or conversations without losing track?
4. Reasoning: can it break down complex problems, find contradictions, and explain tradeoffs?
5. Tool use: can it reliably use search, files, code, browser, database, or other tools?
6. Coding ability: can it understand a project, edit carefully, test, and explain risks?
7. Chinese ability: does it understand Chinese expression and Chinese business context?
8. Cost and speed: frequent tasks need price and latency control.
9. Stability: if you try the same task several times, is the result consistent?
10. Safety and compliance: can your data go into this model, or do you need enterprise, private, or local deployment?

The most useful method is a small blind test with your own tasks. Pick three to five real questions, ask several models, then score accuracy, usability, format, speed, and cost. Do not rely only on public rankings.

## 9. How to Choose AI and Agents

Writing, summarizing, brainstorming: choose a general model that feels stable and easy for you to use.

Long-document analysis: prioritize context length, citation behavior, and long-form stability.

Code projects: choose an Agent that can read the project, edit files, and run checks, such as Codex-style workflows.

Slides, images, and video: use tools with the right plugin or multimodal capability. A pure chat model should not be expected to handle every visual detail. Also check whether the model actually supports images, video, or files for your task.

Company knowledge bases: prioritize RAG, permissions, audit logs, and data safety before thinking about fine-tuning.

High-frequency low-risk work: use smaller, faster, cheaper models.

Important decision materials: use stronger models, but always review manually.

Privacy, contracts, customers, and internal systems: follow company rules first. Use enterprise, private, or local options when needed.

## 10. My Takeaways

First, AI amplifies clarity more than laziness. The clearer your goal, boundary, and acceptance criteria are, the better AI works. You can give a vague requirement to a chat model first and ask it to help refine it. If you meet a keyword you do not understand, ask immediately. Ask for several execution options, then choose.

Second, Agents are good at executing clear tasks. They should not decide direction for you. Direction, tradeoffs, and responsibility still belong to the human.

Third, long projects must become documents. Project background, rules, change logs, and next steps matter more than one beautiful answer. Keep project docs, cautions, Skills, and update logs. When a new thread starts, ask AI to read them.

Fourth, do not worship one plugin or one Skill. Writing, code, images, slides, knowledge bases, and deployment often need different tool combinations. But too many Skills can also overload context, so keep them focused.

Fifth, expose missing information. Reliable AI collaboration does not fill every blank with fiction. It makes uncertainty visible.', '2026-06-14T15:00:00.000Z', '2026-06-14T15:00:00.000Z'),
  ('seed-ai-agent-workflow-guide-2026-06-14-ja', 'seed-ai-agent-workflow-guide-2026-06-14', 'ja', '質問から公開まで：普通の人が AI Agent で実行力を広げる方法', '普通の読者向けに、大規模モデルの仕組み、スレッド分割、Agent、Skill、MCP、Git、モデル選び、実践経験を整理した AI Agent 活用記事です。', '# 質問から公開まで：普通の人が AI Agent で実行力を広げる方法

> 核心：AI は人を置き換えるものではなく、人の実行力を広げるものです。大事なのはコードを書けることではなく、仕事を分解し、正しく伝え、結果を確認できることです。

多くの人はまだ、AI を「一問一答」の道具として使っています。それも役に立ちますが、本当に効率を変えるのは、AI を作業を前に進める Agent として使うことです。背景、目標、制約、受け入れ基準を渡すと、AI はタスクを分解し、実行し、確認し、記録する手助けをしてくれます。

私が個人サイトを作る流れも同じです。まず GPT で曖昧なアイデアをサイトの位置づけ、ページ構成、ビジュアル方向、機能範囲に整理します。次に Codex を実際のプロジェクトに入れ、ファイルを読み、ルールに沿って修正、確認、記録更新を行います。最後の方向判断、範囲の取捨選択、受け入れ判断は人間が行います。

これは「一文で AI がサイトを作る」という話ではありません。実用的な流れは、人が判断し、AI が実行を増幅する、ということです。

## 1. AI の基本原理：次の Token を予測している

大規模モデルの回答は、ざっくり言えば「文脈から次の文字を予測する」ことです。より正確には、次の Token を予測しています。Token は文字、単語、数字、記号、コード片などです。

この理解は重要です。AI の特徴が見えてくるからです。

1. AI は全知ではなく、現在の文脈に合いそうな内容を生成します。
2. 入力が明確なほど、正しい方向に続けやすくなります。
3. 入力が乱れているほど、重要点を取り違えやすくなります。
4. 与えられていない事実は、推測してしまうことがあります。
5. 会話が長くなりすぎると、重要な情報が薄まり、文脈の外に出ることがあります。

つまり、AI 活用の第一原則は魔法のプロンプトではなく、文脈管理です。

## 2. 長いプロジェクトをスレッド分割する理由

多くの人は、一つのプロジェクトを最初から最後まで同じチャットで進めます。すると後半で AI が不安定になります。理由は単純で、古い履歴が多すぎるからです。AI は毎回、何が重要で、何が古く、何が途中案だったのかを判断しなければなりません。

私の経験では、長いプロジェクトは段階ごとに分けるべきです。

たとえばこう分けます。

```text
要件整理スレッド：目標、ユーザー、範囲、優先度
設計スレッド：構成、ページ、流れ、リスク
実行スレッド：明確なタスクを Agent に実行させる
バグ修正スレッド：現象、再現手順、期待結果
まとめスレッド：変更、経験、文書、次の一手
```

新しいスレッドを開くたびに、引き継ぎパックを渡します。

```text
プロジェクト背景：何のプロジェクトか
現在の状態：完了済みと未完了
今回の目標：今回だけで何をするか
制約条件：変えてはいけないこと、守るルール
関連ファイル：読むべき資料
受け入れ基準：何ができれば完了か
出力形式：一覧、案、コード、記事、PPT など
```

スレッドを替えるのは、最初からやり直すためではありません。AI の文脈をきれいに保つためです。

## 3. Agent の動き方

モデルは脳のようなものです。Agent は道具を持った作業担当者のようなものです。

普通のチャットは主に回答します。Agent は許可された範囲で、ファイルを読み、ツールを呼び、コマンドを実行し、ブラウザを開き、文書を編集し、画像を作り、PPT を出力し、チェックを走らせることができます。基本的な流れはこうです。

```text
タスク理解 -> 文脈読み込み -> 手順作成 -> ツール使用 -> 結果確認 -> 報告または修正継続
```

ここに Codex の価値があります。Codex は「こう直せます」と言うだけではありません。プロジェクトフォルダに入り、README、PROJECT_CONTEXT、CHANGELOG、プロジェクト Skill を読み、既存ルールに沿って作業できます。

ただし、Agent は自動的に信頼できるわけではありません。権限、ツール、文脈、受け入れ基準が必要です。境界のない Agent は単純な問題を複雑にしがちです。受け入れ基準のない Agent は、完了したかどうかを判断できません。

## 4. 知っておきたい基本概念

大規模モデル：理解、推論、生成を担う中心能力です。モデルごとに得意分野は違います。パラメータ規模、学習品質、データ、ツール、推論設計が性能に影響します。大きければ必ず良いわけではありません。

Token：AI が処理する基本単位です。入力や出力が長いほど、時間と費用は増えやすくなります。

コンテキストウィンドウ：AI が今見られる情報範囲です。範囲外の情報は、見えていないのと同じです。

Prompt：AI に渡す作業説明です。良い Prompt とは、良い引き継ぎです。

RAG：検索拡張生成です。AI が指定資料を先に検索し、その資料に基づいて答えます。社内知識庫や文書 Q&A に向いています。

微調整：専用データでモデルを追加学習し、特定タスクに合わせる方法です。多くの小さなチームでは、まず Prompt、知識庫、作業フローを整えるほうが効果的です。

Tool Calling：モデルに外部ツールを呼ばせる仕組みです。検索、表、ファイル、HTTP リクエスト、ブラウザ、データベースなどを使えます。

Skill：Agent 向けの専門作業手順です。ある種類のタスクについて、流れ、ルール、参考資料、スクリプトをまとめ、Codex が繰り返し安定して実行しやすくします。実務では、Skill は文書化されたプロンプトエンジニアリングです。

MCP：Model Context Protocol です。AI が外部ツールや文脈につながるための標準インターフェースと考えられます。MCP により、Codex は文書、ブラウザ、Figma、GitHub などに接続できます。

Git：バージョン管理ツールです。何を変更したかを記録し、戻す、比べる、共同作業することを楽にします。

GitHub：コードを置き、共同作業するためのプラットフォームです。repository はプロジェクトフォルダ、commit は保存記録、branch は作業分岐、PR は main に戻す前のレビュー依頼です。

## 5. 一番よく使う Prompt 公式

私がよく使う形はこれです。

```text
背景 + 目標 + 現在の状態 + 制約条件 + 受け入れ基準 + 出力形式 + やらないこと
```

弱い依頼はこうです。

```text
匿名チャットを作って。
```

より良い依頼はこうです。

```text
個人サイトに軽量な匿名チャットを追加したいです。目的は訪問者が公開メッセージを残せることです。
現在のサイトは Cloudflare Pages にデプロイされており、D1 データベースがあります。
第一版では、公開ルーム、テキストのみ、ランダムニックネーム、ローカルでのニックネーム記憶、文字数制限、送信クールダウン、ポーリング更新だけを作ります。
個別チャット、画像アップロード、複数ルーム、複雑な管理画面は作りません。
受け入れ基準は、スマホと PC で送信できること、更新後もメッセージが残ること、入力がスクリプトとして実行されないこと、既存の XP ピクセル風に合うことです。
まず案を出し、その後で最小利用可能版を実装し、プロジェクト文書も更新してください。
```

AI は難しいタスクが苦手なのではありません。推測させられるのが苦手です。

## 6. AI 活用の実践テクニック

第一に、先に AI に質問させます。要件が曖昧なときは、「不足情報とリスクを先に指摘し、まだ実行しないでください」と伝えます。

第二に、大きな仕事を小さく分けます。「サイトを作る」は、構成、ビジュアル、ホーム、ログイン、データベース、スマホ表示、デプロイ、文書化に分けられます。一度に一つだけ任せます。

第三に、やらないことを明確にします。多くのズレは、AI ができないからではなく、境界が書かれていないから起きます。

第四に、受け入れチェックリストを出してもらいます。「完了後、私が確認すべき点を列挙してください」と頼むと、結果を確認しやすくなります。

第五に、重要作業は先に案を出してもらいます。アカウント、データ、安全、費用、公開に関わる場合は、すぐ実行せず、案とリスクを先に出してもらいます。

第六に、長期ルールを文書に残します。README、PROJECT_CONTEXT、CHANGELOG、Skill に入れておくと、毎回口頭で説明し直す必要がありません。

第七に、こまめに引き継ぎパックを作らせます。スレッド終了前に、完了、未完了、重要決定、次の手順、注意点をまとめてもらうと、次のスレッドが安定します。

## 7. 現在の AI 市場

2026 年 6 月 14 日時点で、AI モデル市場は非常に混み合っており、一社独占ではありません。競争は大きく分けると次のようになります。

1. 汎用クローズド旗艦モデル：OpenAI GPT、Anthropic Claude、Google Gemini、xAI Grok。
2. 中国の大規模モデルと平台：Qwen / Alibaba Cloud Model Studio、DeepSeek、智譜 GLM、豆包 / 火山方舟、Kimi、MiniMax、Tencent Hunyuan など。
3. オープンウェイトの生態系：Meta Llama、Mistral など。ローカル実行、私有化、二次開発に向いています。
4. マルチモーダルとメディアモデル：画像、動画、音声、音声会話、文書理解が速く競争しています。
5. Agent 平台：モデルの強さだけでなく、ツール呼び出し、文脈管理、権限、安全、観測性、ワークフローが重要です。

ざっくり見るとこうです。

OpenAI：総合力、複雑な推論、コード、Agent、ツール利用に強い。

Claude：長文書、文章作成、コード、慎重な分析に強い。

Gemini：マルチモーダル範囲と Google エコシステムが広い。

DeepSeek：中国語とコード場面でよく注目され、コストや長文脈の選択肢として語られます。

Qwen / Alibaba Cloud Model Studio：中国での平台能力が強く、テキスト、画像、音声、動画、ベクトル、モデルサービスの範囲が広い。

Llama：研究、ローカル化、私有環境、制御性で重要なオープン生態系。

Mistral：オープンモデルと企業向けモデルを併せ持ち、コード、Agent、文書、マルチモーダル領域に展開しています。

Grok：xAI の汎用モデル群で、同社のエコシステムやツール利用と結びついています。

GLM、豆包、Kimi、MiniMax、Hunyuan：中国でよく使われる選択肢です。中国語能力、文脈長、価格、API、コンプライアンス、平台生態系で比較します。

モデル名はすぐ変わります。名前だけを覚えるより、選び方を覚えるほうが大切です。

## 8. 良いモデルとは何か

良いモデルとは、ランキング一位のモデルではありません。自分のタスクに合うモデルです。

見るべき項目は次の通りです。

1. 正確性：実際の質問で間違いが少ないか。
2. 指示追従：形式、境界、役割を守れるか。
3. 長文脈：長い文書、プロジェクト、会話を読んでも乱れないか。
4. 推論能力：複雑な問題を分解し、矛盾を見つけ、取捨選択を説明できるか。
5. ツール利用：検索、ファイル、コード、ブラウザ、データベースなどを安定して使えるか。
6. コード能力：プロジェクトを読み、慎重に編集し、テストし、リスクを説明できるか。
7. 中国語能力：中国語表現や業務文脈を理解できるか。
8. 費用と速度：高頻度タスクでは能力だけでなく価格と応答速度も重要です。
9. 安定性：同じタスクを複数回試して、結果が安定するか。
10. 安全とコンプライアンス：そのデータを外部モデルに渡してよいか。企業版、私有化、ローカルが必要か。

一番実用的なのは、自分の実タスクで小さな盲検比較をすることです。3 から 5 個の実問題を選び、複数モデルに答えさせ、正確性、使いやすさ、形式、速度、費用で採点します。公開ランキングだけに頼らないことです。

## 9. AI と Agent の選び方

文章作成、要約、ブレスト：自分にとって使いやすく、表現が安定した汎用モデルを選びます。

長文書分析：文脈長、引用の扱い、長文での安定性を優先します。

コードプロジェクト：プロジェクトを読み、ファイルを編集し、チェックを走らせられる Agent を選びます。Codex のようなワークフローが向いています。

PPT、画像、動画：対応するプラグインやマルチモーダル能力を持つツールを使います。純粋なチャットモデルだけで視覚作業の細部まで任せるべきではありません。画像、動画、ファイルに対応しているかも確認します。

社内知識庫：微調整より先に、RAG、権限、監査、データ安全を考えます。

高頻度で低リスクの作業：速くて安い小さめのモデルで十分なことがあります。

重要な意思決定資料：強いモデルを使ってよいですが、必ず人間が確認します。

プライバシー、契約、顧客、社内システム：まず会社のルールを確認し、必要なら企業版、私有化、ローカルモデルを使います。

## 10. 私の経験まとめ

第一に、AI が一番広げるのは怠けではなく明確さです。目標、境界、受け入れ基準が明確なほど、AI は使いやすくなります。曖昧な要件はまず対話型 AI に渡し、整理してもらうとよいです。知らないキーワードが出たらすぐ聞きます。複数の実行案を出してもらい、自分で選びます。

第二に、Agent は明確なタスクの実行に向いています。方向を決める役割ではありません。方向、取捨選択、責任は人間に残ります。

第三に、長いプロジェクトは必ず文書化します。背景、ルール、変更記録、次の一手は、一回のきれいな回答より重要です。プロジェクト文書、注意点、Skill、更新記録を用意し、新しいスレッドでは AI にそれらを読ませます。

第四に、一つのプラグインや Skill を過信しません。文章、コード、画像、PPT、知識庫、デプロイは、違う道具の組み合わせが必要なことがあります。ただし Skill が多すぎると文脈が重くなるので、絞って使います。

第五に、足りない情報は明示します。信頼できる AI 協作とは、空白を作り話で埋めることではなく、不確実性を見えるようにすることです。', '2026-06-14T15:00:00.000Z', '2026-06-14T15:00:00.000Z'),
  ('seed-update-2026-06-14-ai-agent-article-zh', 'seed-update-2026-06-14-ai-agent-article', 'zh', '新增 AI Agent 工作赋能文章', '知识库新增一篇三语 AI Agent 实战文章，整理从提问到上线的工作方法。', '# 新增 AI Agent 工作赋能文章

本次更新在知识库发布了一篇新的 AI Agent 实战文章。

## 更新内容

- 新增《从提问到上线：普通人如何用 AI Agent 放大执行力》文章。
- 文章提供中文、English、日本語三种版本。
- 内容整理 AI 基础原理、线程拆分、Agent、Skill、MCP、Git、模型选择和实战经验。
- 文章放入 AI 分类，方便后续继续沉淀 AI 工作流笔记。', '2026-06-14T15:01:00.000Z', '2026-06-14T15:01:00.000Z'),
  ('seed-update-2026-06-14-ai-agent-article-en', 'seed-update-2026-06-14-ai-agent-article', 'en', 'New AI Agent enablement article', 'The knowledge base now includes a trilingual AI Agent article about moving from prompt to launch.', '# New AI Agent Enablement Article

This update adds a practical AI Agent article to the knowledge base.

## Changes

- Added “From Prompt to Launch: How Non-Technical People Can Use AI Agents to Amplify Execution.”
- Published Chinese, English, and Japanese versions.
- Covered AI basics, thread splitting, Agents, Skills, MCP, Git, model selection, and practical experience.
- Filed the article under the AI category for future AI workflow notes.', '2026-06-14T15:01:00.000Z', '2026-06-14T15:01:00.000Z'),
  ('seed-update-2026-06-14-ai-agent-article-ja', 'seed-update-2026-06-14-ai-agent-article', 'ja', 'AI Agent 活用記事を追加', '知識庫に、質問から公開までの流れを整理した三言語の AI Agent 実践記事を追加しました。', '# AI Agent 活用記事を追加

今回の更新では、知識庫に AI Agent の実践記事を追加しました。

## 更新内容

- 「質問から公開まで：普通の人が AI Agent で実行力を広げる方法」を追加しました。
- 中国語、English、日本語の三言語版を公開しました。
- AI の基本原理、スレッド分割、Agent、Skill、MCP、Git、モデル選び、実践経験を整理しました。
- 今後の AI ワークフローメモを蓄積しやすいよう、AI カテゴリに配置しました。', '2026-06-14T15:01:00.000Z', '2026-06-14T15:01:00.000Z'),
  ('seed-update-2026-06-14-article-reading-links-zh', 'seed-update-2026-06-14-article-reading-links', 'zh', '知识库文章阅读体验优化', '知识库长文章窗口、正文排版、文章图片和独立文章链接完成优化。', '# 知识库文章阅读体验优化

本次更新继续整理知识库长文阅读体验，让文章更适合分享和长时间阅读。

## 更新内容

- 知识库文章详情公开地址支持 `/articles/<slug>`，可以通过域名直接分享单篇文章。
- 内部 `article_id` 只用于数据库和后台管理，不在公开链接或公开 API 中外显。
- 长文章阅读窗口会随浏览器大小扩展，桌面端可看到更多正文内容。
- Markdown 渲染补充有序列表、文章图片和 `text` 蓝色说明框，避免编号内容挤成一行。
- 《从提问到上线：普通人如何用 AI Agent 放大执行力》加入 Codex 与 GPT 聊天截图，减少纯文字阅读疲劳。
- 更新项目上下文、专用 Skill、Cloudflare Pages 重写规则和缓存版本，方便后续维护。', '2026-06-14T16:20:00.000Z', '2026-06-14T16:20:00.000Z'),
  ('seed-update-2026-06-14-article-reading-links-en', 'seed-update-2026-06-14-article-reading-links', 'en', 'Knowledge Article Reading Polish', 'Improved long article windows, article typography, inline images, and shareable article links.', '# Knowledge Article Reading Polish

This update makes long knowledge-base articles easier to read and share.

## Changes

- Public article detail URLs now support `/articles/<slug>` for direct sharing from the domain.
- Internal `article_id` values stay in the database and admin workflow, not in public links or public API responses.
- The long article window expands with the browser on desktop, showing more content at once.
- Markdown rendering now supports ordered lists, article images, and blue `text` callout boxes, so numbered points no longer collapse into one line.
- The AI Agent article now includes Codex and GPT chat screenshots to break up long text.
- Project context, the site Skill, Cloudflare Pages rewrite rules, and cache versions were updated for future maintenance.', '2026-06-14T16:20:00.000Z', '2026-06-14T16:20:00.000Z'),
  ('seed-update-2026-06-14-article-reading-links-ja', 'seed-update-2026-06-14-article-reading-links', 'ja', '知識庫記事の閲覧体験を改善', '長文記事ウィンドウ、本文組版、記事画像、記事別共有リンクを改善しました。', '# 知識庫記事の閲覧体験を改善

今回の更新では、知識庫の長文記事を読みやすく、共有しやすくしました。

## 更新内容

- 公開記事詳細 URL が `/articles/<slug>` に対応し、ドメインから単独記事を直接共有できます。
- 内部 `article_id` はデータベースと管理作業だけで使い、公開リンクや公開 API には出しません。
- 長文記事ウィンドウがデスクトップのブラウザサイズに合わせて広がり、一度に読める本文量が増えました。
- Markdown 表示に番号付きリスト、記事画像、青い `text` 説明枠を追加し、番号付き内容が一行に潰れる問題を防ぎました。
- AI Agent 記事に Codex と GPT のチャット画面を追加し、長文だけにならないようにしました。
- 今後の保守のため、プロジェクト文脈、専用 Skill、Cloudflare Pages のリライト規則、キャッシュ版も更新しました。', '2026-06-14T16:20:00.000Z', '2026-06-14T16:20:00.000Z'),
  ('seed-update-2026-06-15-clouds-docs-maintenance-zh', 'seed-update-2026-06-15-clouds-docs-maintenance', 'zh', '四时段动态云层与维护记录补齐', '首页四时段动态云层上线记录、项目文档和更新时间维护闭环完成补齐。', '# 四时段动态云层与维护记录补齐

本次更新补齐首页动态云层和项目维护记录，让公开最近更新与实际上线内容保持一致。

## 更新内容

- 首页 morning / day / dusk / night 四个时段都接入无云底图和独立云层。
- 云层按同一主风向慢速错相漂移，并保留减少动态、页面隐藏暂停和小屏降级。
- 本地预览仍可用 `?wallpaper=morning`、`?wallpaper=day`、`?wallpaper=dusk`、`?wallpaper=night` 强制查看指定时段。
- 补齐 README、PROJECT_CONTEXT、CHANGELOG 和项目专用 Skill 的维护说明。
- 新增本篇 `site-updates` 三语更新文章，并同步本地 fallback 最近更新，确保首页最近更新日期来自真实更新记录。', '2026-06-15T05:00:00.000Z', '2026-06-15T05:00:00.000Z'),
  ('seed-update-2026-06-15-clouds-docs-maintenance-en', 'seed-update-2026-06-15-clouds-docs-maintenance', 'en', 'Time-of-day Clouds and Maintenance Log', 'The four home cloud layers, project docs, and site update timestamp flow are now recorded properly.', '# Time-of-day Clouds and Maintenance Log

This update closes the public maintenance loop for the home cloud animation and project records, so the visible recent updates match what was actually shipped.

## Changes

- Morning, Day, Dusk, and Night now use cloudless base images with independent cloud layers.
- Clouds drift slowly in one main wind direction with staggered timing, plus reduced-motion, pause-on-hidden, and small-screen fallbacks.
- Local previews still support `?wallpaper=morning`, `?wallpaper=day`, `?wallpaper=dusk`, and `?wallpaper=night`.
- README, PROJECT_CONTEXT, CHANGELOG, and the project Skill were brought back in sync.
- This trilingual `site-updates` article and the local fallback recent-update list were added so the home update date comes from a real update record.', '2026-06-15T05:00:00.000Z', '2026-06-15T05:00:00.000Z'),
  ('seed-update-2026-06-15-clouds-docs-maintenance-ja', 'seed-update-2026-06-15-clouds-docs-maintenance', 'ja', '4時間帯の雲レイヤーと保守記録を補完', 'ホームの4時間帯雲レイヤー、プロジェクト文書、更新日時の流れを公開更新記録に反映しました。', '# 4時間帯の雲レイヤーと保守記録を補完

今回の更新では、ホームの雲アニメーションとプロジェクト保守記録を補い、公開される最近の更新と実際の公開内容をそろえました。

## 更新内容

- morning / day / dusk / night の4時間帯に、無雲ベース画像と独立した雲レイヤーを接続しました。
- 雲は同じ主風向でゆっくり時間差移動し、低モーション設定、非表示時の一時停止、小画面での降級にも対応します。
- ローカル確認では `?wallpaper=morning`、`?wallpaper=day`、`?wallpaper=dusk`、`?wallpaper=night` で時間帯を指定できます。
- README、PROJECT_CONTEXT、CHANGELOG、プロジェクト専用 Skill の保守説明を同期しました。
- この三言語 `site-updates` 記事とローカル fallback の最近更新を追加し、ホームの更新日が実際の更新記録から出るようにしました。', '2026-06-15T05:00:00.000Z', '2026-06-15T05:00:00.000Z')
on conflict(article_id, lang) do update set
  title = excluded.title,
  summary = excluded.summary,
  content_markdown = excluded.content_markdown,
  updated_at = excluded.updated_at;
delete from article_translations
where article_id in ('seed-xp-site-notes', 'seed-local-ai-workflow', 'seed-fallback-check');

delete from articles
where article_id in ('seed-xp-site-notes', 'seed-local-ai-workflow', 'seed-fallback-check');

update article_translations
set content_markdown = replace(content_markdown, char(13) || char(10), char(10))
where article_id = 'seed-ai-agent-workflow-guide-2026-06-14';

update article_translations
set content_markdown = replace(
    content_markdown,
    '这不是“一句话让 AI 变出网站”，而是一个更实用的流程：人负责判断，AI 放大执行。

## 1. AI 的基础原理：它本质上是在预测下一个 Token',
    '这不是“一句话让 AI 变出网站”，而是一个更实用的流程：人负责判断，AI 放大执行。

![Codex 把一次网站更新拆成待办、执行和验收记录](assets/images/articles/ai-agent-codex-update-thread.png)

## 1. AI 的基础原理：它本质上是在预测下一个 Token'
  ),
  updated_at = '2026-06-14T16:20:00.000Z'
where article_id = 'seed-ai-agent-workflow-guide-2026-06-14'
  and lang = 'zh'
  and instr(content_markdown, '这不是“一句话让 AI 变出网站”，而是一个更实用的流程：人负责判断，AI 放大执行。

## 1. AI 的基础原理：它本质上是在预测下一个 Token') > 0;

update article_translations
set content_markdown = replace(
    content_markdown,
    '换线程不是为了重新开始，而是为了让 AI 的上下文变干净。

## 3. Agent 的工作原理',
    '换线程不是为了重新开始，而是为了让 AI 的上下文变干净。

![给 Codex 的项目背景、目标、范围和验收标准示例](assets/images/articles/ai-agent-codex-project-brief.png)

## 3. Agent 的工作原理'
  ),
  updated_at = '2026-06-14T16:20:00.000Z'
where article_id = 'seed-ai-agent-workflow-guide-2026-06-14'
  and lang = 'zh'
  and instr(content_markdown, '换线程不是为了重新开始，而是为了让 AI 的上下文变干净。

## 3. Agent 的工作原理') > 0;

update article_translations
set content_markdown = replace(
    content_markdown,
    'GitHub：托管代码和协作的平台。仓库是项目文件夹，commit 是一次保存记录，branch 是分支，PR 是把分支合并回主线前的审查申请。

## 5. 最好用的提示词公式',
    'GitHub：托管代码和协作的平台。仓库是项目文件夹，commit 是一次保存记录，branch 是分支，PR 是把分支合并回主线前的审查申请。

![先用对话型 AI 把模糊需求整理成项目上下文](assets/images/articles/ai-agent-gpt-project-context.png)

## 5. 最好用的提示词公式'
  ),
  updated_at = '2026-06-14T16:20:00.000Z'
where article_id = 'seed-ai-agent-workflow-guide-2026-06-14'
  and lang = 'zh'
  and instr(content_markdown, 'GitHub：托管代码和协作的平台。仓库是项目文件夹，commit 是一次保存记录，branch 是分支，PR 是把分支合并回主线前的审查申请。

## 5. 最好用的提示词公式') > 0;

update article_translations
set content_markdown = replace(
    content_markdown,
    'AI 不是怕任务难，是怕你让它猜。

## 6. 使用 AI 的实战技巧',
    'AI 不是怕任务难，是怕你让它猜。

![把随口需求压缩成可执行提示词，再交给 Agent](assets/images/articles/ai-agent-gpt-chatroom-prompt.png)

## 6. 使用 AI 的实战技巧'
  ),
  updated_at = '2026-06-14T16:20:00.000Z'
where article_id = 'seed-ai-agent-workflow-guide-2026-06-14'
  and lang = 'zh'
  and instr(content_markdown, 'AI 不是怕任务难，是怕你让它猜。

## 6. 使用 AI 的实战技巧') > 0;

update article_translations
set content_markdown = replace(
    content_markdown,
    'This is not “one sentence creates a website.” The practical workflow is: humans judge, AI multiplies execution.

## 1. The Basic Principle: AI Predicts the Next Token',
    'This is not “one sentence creates a website.” The practical workflow is: humans judge, AI multiplies execution.

![Codex turns one site update into tasks, execution, and acceptance notes](assets/images/articles/ai-agent-codex-update-thread.png)

## 1. The Basic Principle: AI Predicts the Next Token'
  ),
  updated_at = '2026-06-14T16:20:00.000Z'
where article_id = 'seed-ai-agent-workflow-guide-2026-06-14'
  and lang = 'en'
  and instr(content_markdown, 'This is not “one sentence creates a website.” The practical workflow is: humans judge, AI multiplies execution.

## 1. The Basic Principle: AI Predicts the Next Token') > 0;

update article_translations
set content_markdown = replace(
    content_markdown,
    'Switching threads is not starting over. It keeps the AI context clean.

## 3. How an Agent Works',
    'Switching threads is not starting over. It keeps the AI context clean.

![A project handoff example for Codex: context, goals, scope, and checks](assets/images/articles/ai-agent-codex-project-brief.png)

## 3. How an Agent Works'
  ),
  updated_at = '2026-06-14T16:20:00.000Z'
where article_id = 'seed-ai-agent-workflow-guide-2026-06-14'
  and lang = 'en'
  and instr(content_markdown, 'Switching threads is not starting over. It keeps the AI context clean.

## 3. How an Agent Works') > 0;

update article_translations
set content_markdown = replace(
    content_markdown,
    'GitHub: a platform for hosting code and collaborating. A repository is the project folder, a commit is a saved change, a branch is a separate work line, and a PR is a review request before merging work back into the main line.

## 5. The Prompt Formula I Use Most',
    'GitHub: a platform for hosting code and collaborating. A repository is the project folder, a commit is a saved change, a branch is a separate work line, and a PR is a review request before merging work back into the main line.

![Use chat AI first to turn vague requirements into project context](assets/images/articles/ai-agent-gpt-project-context.png)

## 5. The Prompt Formula I Use Most'
  ),
  updated_at = '2026-06-14T16:20:00.000Z'
where article_id = 'seed-ai-agent-workflow-guide-2026-06-14'
  and lang = 'en'
  and instr(content_markdown, 'GitHub: a platform for hosting code and collaborating. A repository is the project folder, a commit is a saved change, a branch is a separate work line, and a PR is a review request before merging work back into the main line.

## 5. The Prompt Formula I Use Most') > 0;

update article_translations
set content_markdown = replace(
    content_markdown,
    'AI is not afraid of hard work. It is afraid of guessing.

## 6. Practical AI Techniques',
    'AI is not afraid of hard work. It is afraid of guessing.

![Compress a rough request into an executable prompt before handing it to an Agent](assets/images/articles/ai-agent-gpt-chatroom-prompt.png)

## 6. Practical AI Techniques'
  ),
  updated_at = '2026-06-14T16:20:00.000Z'
where article_id = 'seed-ai-agent-workflow-guide-2026-06-14'
  and lang = 'en'
  and instr(content_markdown, 'AI is not afraid of hard work. It is afraid of guessing.

## 6. Practical AI Techniques') > 0;

update article_translations
set content_markdown = replace(
    content_markdown,
    'これは「一文で AI がサイトを作る」という話ではありません。実用的な流れは、人が判断し、AI が実行を増幅する、ということです。

## 1. AI の基本原理：次の Token を予測している',
    'これは「一文で AI がサイトを作る」という話ではありません。実用的な流れは、人が判断し、AI が実行を増幅する、ということです。

![Codex が一つのサイト更新をタスク、実行、確認記録に分ける例](assets/images/articles/ai-agent-codex-update-thread.png)

## 1. AI の基本原理：次の Token を予測している'
  ),
  updated_at = '2026-06-14T16:20:00.000Z'
where article_id = 'seed-ai-agent-workflow-guide-2026-06-14'
  and lang = 'ja'
  and instr(content_markdown, 'これは「一文で AI がサイトを作る」という話ではありません。実用的な流れは、人が判断し、AI が実行を増幅する、ということです。

## 1. AI の基本原理：次の Token を予測している') > 0;

update article_translations
set content_markdown = replace(
    content_markdown,
    'スレッドを替えるのは、最初からやり直すためではありません。AI の文脈をきれいに保つためです。

## 3. Agent の動き方',
    'スレッドを替えるのは、最初からやり直すためではありません。AI の文脈をきれいに保つためです。

![Codex に渡すプロジェクト背景、目標、範囲、確認基準の例](assets/images/articles/ai-agent-codex-project-brief.png)

## 3. Agent の動き方'
  ),
  updated_at = '2026-06-14T16:20:00.000Z'
where article_id = 'seed-ai-agent-workflow-guide-2026-06-14'
  and lang = 'ja'
  and instr(content_markdown, 'スレッドを替えるのは、最初からやり直すためではありません。AI の文脈をきれいに保つためです。

## 3. Agent の動き方') > 0;

update article_translations
set content_markdown = replace(
    content_markdown,
    'GitHub：コードを置き、共同作業するためのプラットフォームです。repository はプロジェクトフォルダ、commit は保存記録、branch は作業分岐、PR は main に戻す前のレビュー依頼です。

## 5. 一番よく使う Prompt 公式',
    'GitHub：コードを置き、共同作業するためのプラットフォームです。repository はプロジェクトフォルダ、commit は保存記録、branch は作業分岐、PR は main に戻す前のレビュー依頼です。

![まず対話型 AI で曖昧な要望をプロジェクト文脈に整理する例](assets/images/articles/ai-agent-gpt-project-context.png)

## 5. 一番よく使う Prompt 公式'
  ),
  updated_at = '2026-06-14T16:20:00.000Z'
where article_id = 'seed-ai-agent-workflow-guide-2026-06-14'
  and lang = 'ja'
  and instr(content_markdown, 'GitHub：コードを置き、共同作業するためのプラットフォームです。repository はプロジェクトフォルダ、commit は保存記録、branch は作業分岐、PR は main に戻す前のレビュー依頼です。

## 5. 一番よく使う Prompt 公式') > 0;

update article_translations
set content_markdown = replace(
    content_markdown,
    'AI は難しいタスクが苦手なのではありません。推測させられるのが苦手です。

## 6. AI 活用の実践テクニック',
    'AI は難しいタスクが苦手なのではありません。推測させられるのが苦手です。

![ざっくりした依頼を Agent に渡せる実行用プロンプトへ圧縮する例](assets/images/articles/ai-agent-gpt-chatroom-prompt.png)

## 6. AI 活用の実践テクニック'
  ),
  updated_at = '2026-06-14T16:20:00.000Z'
where article_id = 'seed-ai-agent-workflow-guide-2026-06-14'
  and lang = 'ja'
  and instr(content_markdown, 'AI は難しいタスクが苦手なのではありません。推測させられるのが苦手です。

## 6. AI 活用の実践テクニック') > 0;

update article_translations
set content_markdown = replace(content_markdown, '## 1. AI 的基础原理：它本质上是在预测下一个 Token', '![Codex 把一次网站更新拆成待办、执行和验收记录](assets/images/articles/ai-agent-codex-update-thread.png)

## 1. AI 的基础原理：它本质上是在预测下一个 Token'),
  updated_at = '2026-06-14T16:20:00.000Z'
where article_id = 'seed-ai-agent-workflow-guide-2026-06-14'
  and lang = 'zh'
  and instr(content_markdown, '## 1. AI 的基础原理：它本质上是在预测下一个 Token') > 0
  and instr(content_markdown, 'ai-agent-codex-update-thread.png') = 0;

update article_translations
set content_markdown = replace(content_markdown, '## 3. Agent 的工作原理', '![给 Codex 的项目背景、目标、范围和验收标准示例](assets/images/articles/ai-agent-codex-project-brief.png)

## 3. Agent 的工作原理'),
  updated_at = '2026-06-14T16:20:00.000Z'
where article_id = 'seed-ai-agent-workflow-guide-2026-06-14'
  and lang = 'zh'
  and instr(content_markdown, '## 3. Agent 的工作原理') > 0
  and instr(content_markdown, 'ai-agent-codex-project-brief.png') = 0;

update article_translations
set content_markdown = replace(content_markdown, '## 5. 最好用的提示词公式', '![先用对话型 AI 把模糊需求整理成项目上下文](assets/images/articles/ai-agent-gpt-project-context.png)

## 5. 最好用的提示词公式'),
  updated_at = '2026-06-14T16:20:00.000Z'
where article_id = 'seed-ai-agent-workflow-guide-2026-06-14'
  and lang = 'zh'
  and instr(content_markdown, '## 5. 最好用的提示词公式') > 0
  and instr(content_markdown, 'ai-agent-gpt-project-context.png') = 0;

update article_translations
set content_markdown = replace(content_markdown, '## 6. 使用 AI 的实战技巧', '![把随口需求压缩成可执行提示词，再交给 Agent](assets/images/articles/ai-agent-gpt-chatroom-prompt.png)

## 6. 使用 AI 的实战技巧'),
  updated_at = '2026-06-14T16:20:00.000Z'
where article_id = 'seed-ai-agent-workflow-guide-2026-06-14'
  and lang = 'zh'
  and instr(content_markdown, '## 6. 使用 AI 的实战技巧') > 0
  and instr(content_markdown, 'ai-agent-gpt-chatroom-prompt.png') = 0;

update article_translations
set content_markdown = replace(content_markdown, '## 1. The Basic Principle: AI Predicts the Next Token', '![Codex turns one site update into tasks, execution, and acceptance notes](assets/images/articles/ai-agent-codex-update-thread.png)

## 1. The Basic Principle: AI Predicts the Next Token'),
  updated_at = '2026-06-14T16:20:00.000Z'
where article_id = 'seed-ai-agent-workflow-guide-2026-06-14'
  and lang = 'en'
  and instr(content_markdown, '## 1. The Basic Principle: AI Predicts the Next Token') > 0
  and instr(content_markdown, 'ai-agent-codex-update-thread.png') = 0;

update article_translations
set content_markdown = replace(content_markdown, '## 3. How an Agent Works', '![A project handoff example for Codex: context, goals, scope, and checks](assets/images/articles/ai-agent-codex-project-brief.png)

## 3. How an Agent Works'),
  updated_at = '2026-06-14T16:20:00.000Z'
where article_id = 'seed-ai-agent-workflow-guide-2026-06-14'
  and lang = 'en'
  and instr(content_markdown, '## 3. How an Agent Works') > 0
  and instr(content_markdown, 'ai-agent-codex-project-brief.png') = 0;

update article_translations
set content_markdown = replace(content_markdown, '## 5. The Prompt Formula I Use Most', '![Use chat AI first to turn vague requirements into project context](assets/images/articles/ai-agent-gpt-project-context.png)

## 5. The Prompt Formula I Use Most'),
  updated_at = '2026-06-14T16:20:00.000Z'
where article_id = 'seed-ai-agent-workflow-guide-2026-06-14'
  and lang = 'en'
  and instr(content_markdown, '## 5. The Prompt Formula I Use Most') > 0
  and instr(content_markdown, 'ai-agent-gpt-project-context.png') = 0;

update article_translations
set content_markdown = replace(content_markdown, '## 6. Practical AI Techniques', '![Compress a rough request into an executable prompt before handing it to an Agent](assets/images/articles/ai-agent-gpt-chatroom-prompt.png)

## 6. Practical AI Techniques'),
  updated_at = '2026-06-14T16:20:00.000Z'
where article_id = 'seed-ai-agent-workflow-guide-2026-06-14'
  and lang = 'en'
  and instr(content_markdown, '## 6. Practical AI Techniques') > 0
  and instr(content_markdown, 'ai-agent-gpt-chatroom-prompt.png') = 0;

update article_translations
set content_markdown = replace(content_markdown, '## 1. AI の基本原理：次の Token を予測している', '![Codex が一つのサイト更新をタスク、実行、確認記録に分ける例](assets/images/articles/ai-agent-codex-update-thread.png)

## 1. AI の基本原理：次の Token を予測している'),
  updated_at = '2026-06-14T16:20:00.000Z'
where article_id = 'seed-ai-agent-workflow-guide-2026-06-14'
  and lang = 'ja'
  and instr(content_markdown, '## 1. AI の基本原理：次の Token を予測している') > 0
  and instr(content_markdown, 'ai-agent-codex-update-thread.png') = 0;

update article_translations
set content_markdown = replace(content_markdown, '## 3. Agent の動き方', '![Codex に渡すプロジェクト背景、目標、範囲、確認基準の例](assets/images/articles/ai-agent-codex-project-brief.png)

## 3. Agent の動き方'),
  updated_at = '2026-06-14T16:20:00.000Z'
where article_id = 'seed-ai-agent-workflow-guide-2026-06-14'
  and lang = 'ja'
  and instr(content_markdown, '## 3. Agent の動き方') > 0
  and instr(content_markdown, 'ai-agent-codex-project-brief.png') = 0;

update article_translations
set content_markdown = replace(content_markdown, '## 5. 一番よく使う Prompt 公式', '![まず対話型 AI で曖昧な要望をプロジェクト文脈に整理する例](assets/images/articles/ai-agent-gpt-project-context.png)

## 5. 一番よく使う Prompt 公式'),
  updated_at = '2026-06-14T16:20:00.000Z'
where article_id = 'seed-ai-agent-workflow-guide-2026-06-14'
  and lang = 'ja'
  and instr(content_markdown, '## 5. 一番よく使う Prompt 公式') > 0
  and instr(content_markdown, 'ai-agent-gpt-project-context.png') = 0;

update article_translations
set content_markdown = replace(content_markdown, '## 6. AI 活用の実践テクニック', '![ざっくりした依頼を Agent に渡せる実行用プロンプトへ圧縮する例](assets/images/articles/ai-agent-gpt-chatroom-prompt.png)

## 6. AI 活用の実践テクニック'),
  updated_at = '2026-06-14T16:20:00.000Z'
where article_id = 'seed-ai-agent-workflow-guide-2026-06-14'
  and lang = 'ja'
  and instr(content_markdown, '## 6. AI 活用の実践テクニック') > 0
  and instr(content_markdown, 'ai-agent-gpt-chatroom-prompt.png') = 0;
