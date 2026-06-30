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

create table if not exists user_login_events (
  event_id text primary key,
  user_id text not null references users(id) on delete cascade,
  email text not null default '',
  event_type text not null default 'login',
  visitor_id text not null default '',
  ip_hash text not null default '',
  ip_prefix text not null default '',
  country text not null default '',
  region text not null default '',
  city text not null default '',
  timezone text not null default '',
  colo text not null default '',
  user_agent text not null default '',
  created_at text not null
);

create index if not exists user_login_events_user_created_idx
  on user_login_events(user_id, created_at);
create index if not exists user_login_events_created_idx
  on user_login_events(created_at);
create index if not exists user_login_events_email_created_idx
  on user_login_events(email, created_at);

create table if not exists game_saves (
  user_id text not null references users(id) on delete cascade,
  game_id text not null,
  save_data text not null,
  updated_at text not null,
  primary key (user_id, game_id)
);

create index if not exists game_saves_updated_at_idx on game_saves(updated_at);

create table if not exists site_runtime_state (
  key text primary key,
  value text not null,
  updated_at text not null
);

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

create table if not exists videos (
  video_id text primary key,
  platform text not null,
  original_url text not null,
  external_id text not null,
  embed_url text not null,
  title text not null,
  description text not null default '',
  thumbnail_url text not null default '',
  author_name text not null default '',
  published_at text,
  status text not null default 'draft',
  sort_order integer not null default 0,
  pinned integer not null default 0,
  pinned_sort_order integer not null default 0,
  metadata_error text not null default '',
  created_at text not null,
  updated_at text not null
);

create index if not exists videos_public_idx
  on videos(status, pinned, sort_order, published_at);
create index if not exists videos_platform_external_idx
  on videos(platform, external_id);

create table if not exists video_categories (
  category_id text primary key,
  slug text not null unique,
  name_zh text not null,
  name_en text not null default '',
  name_ja text not null default '',
  sort_order integer not null default 0,
  enabled integer not null default 1,
  created_at text not null,
  updated_at text not null
);

create index if not exists video_categories_enabled_idx
  on video_categories(enabled, sort_order);

create table if not exists video_category_relations (
  video_id text not null references videos(video_id) on delete cascade,
  category_id text not null references video_categories(category_id) on delete cascade,
  sort_order integer not null default 0,
  created_at text not null,
  primary key (video_id, category_id)
);

create index if not exists video_category_relations_category_idx
  on video_category_relations(category_id, sort_order);

with default_video_categories(category_id, slug, name_zh, name_en, name_ja, sort_order) as (
  values
    ('video-cat-vrchat', 'vrchat', 'VRChat作品', 'VRChat Works', 'VRChat作品', 10),
    ('video-cat-ai', 'ai-experiments', 'AI实验', 'AI Experiments', 'AI実験', 20),
    ('video-cat-games', 'game-records', '游戏录像', 'Game Records', 'ゲーム録画', 30),
    ('video-cat-favorites', 'favorites', '收藏视频', 'Saved Videos', 'お気に入り動画', 40)
)
insert into video_categories (
  category_id, slug, name_zh, name_en, name_ja, sort_order, enabled, created_at, updated_at
)
select
  category_id, slug, name_zh, name_en, name_ja, sort_order, 1,
  '2026-06-15T00:00:00.000Z',
  '2026-06-15T00:00:00.000Z'
from default_video_categories
where not exists (
    select 1 from site_runtime_state where key = 'video_categories_default_seeded'
  )
  and not exists (select 1 from video_categories)
  and not exists (select 1 from users)
on conflict(category_id) do nothing;

insert into site_runtime_state (key, value, updated_at)
values ('video_categories_default_seeded', '1', '2026-06-16T08:20:00.000Z')
on conflict(key) do update set
  value = excluded.value,
  updated_at = excluded.updated_at;

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
  'seed-update-2026-06-30-account-popover-layer-fix',
  '2026-06-30-account-popover-layer-fix',
  'site-updates',
  '["网站更新","账号","弹窗","层级修复"]',
  '',
  'published',
  0,
  0,
  '2026-06-30T08:00:00.000Z',
  '2026-06-30T08:00:00.000Z',
  '2026-06-30T08:00:00.000Z'
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

insert into articles (
  article_id, slug, category, tags, cover_image, status, is_pinned,
  view_count, created_at, updated_at, published_at
) values (
  'seed-update-2026-06-24-account-cleanup-merge-launch',
  '2026-06-24-account-cleanup-merge-launch',
  'site-updates',
  '["网站更新","账号","合并上线","发布流程"]',
  '',
  'published',
  0,
  0,
  '2026-06-24T08:00:00.000Z',
  '2026-06-24T08:00:00.000Z',
  '2026-06-24T08:00:00.000Z'
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

insert into articles (
  article_id, slug, category, tags, cover_image, status, is_pinned,
  view_count, created_at, updated_at, published_at
) values (
  'seed-update-2026-06-23-public-ux-accessibility-privacy-wrap-up',
  '2026-06-23-public-ux-accessibility-privacy-wrap-up',
  'site-updates',
  '["网站更新","公开体验","无障碍","隐私","按钮修复"]',
  '',
  'published',
  0,
  0,
  '2026-06-23T06:00:00.000Z',
  '2026-06-23T06:00:00.000Z',
  '2026-06-23T06:00:00.000Z'
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

insert into articles (
  article_id, slug, category, tags, cover_image, status, is_pinned,
  view_count, created_at, updated_at, published_at
) values (
  'seed-update-2026-06-22-fixed-dock-window-backdrops',
  '2026-06-22-fixed-dock-window-backdrops',
  'site-updates',
  '["网站更新","主端视觉","任务栏","四时段","窗口背景"]',
  '',
  'published',
  0,
  0,
  '2026-06-22T14:30:00.000Z',
  '2026-06-22T14:30:00.000Z',
  '2026-06-22T14:30:00.000Z'
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

insert into articles (
  article_id, slug, category, tags, cover_image, status, is_pinned,
  view_count, created_at, updated_at, published_at
) values (
  'seed-update-2026-06-22-about-contact-icons',
  '2026-06-22-about-contact-icons',
  'site-updates',
  '["网站更新","关于我","联系方式","社交图标","品牌图标"]',
  '',
  'published',
  0,
  0,
  '2026-06-22T00:00:00.000Z',
  '2026-06-22T00:00:00.000Z',
  '2026-06-22T00:00:00.000Z'
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

insert into articles (
  article_id, slug, category, tags, cover_image, status, is_pinned,
  view_count, created_at, updated_at, published_at
) values (
  'seed-update-2026-06-20-about-social-links',
  '2026-06-20-about-social-links',
  'site-updates',
  '["网站更新","关于我","社交链接","后台"]',
  '',
  'published',
  0,
  0,
  '2026-06-19T18:00:00.000Z',
  '2026-06-19T18:00:00.000Z',
  '2026-06-19T18:00:00.000Z'
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

insert into articles (
  article_id, slug, category, tags, cover_image, status, is_pinned,
  view_count, created_at, updated_at, published_at
) values (
  'seed-update-2026-06-19-immersive-time-chrome',
  '2026-06-19-immersive-time-chrome',
  'site-updates',
  '["网站更新","主端视觉","XP桌面","四时段","任务栏"]',
  '',
  'published',
  0,
  0,
  '2026-06-19T12:00:00.000Z',
  '2026-06-19T12:00:00.000Z',
  '2026-06-19T12:00:00.000Z'
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

insert into articles (
  article_id, slug, category, tags, cover_image, status, is_pinned,
  view_count, created_at, updated_at, published_at
) values (
  'seed-update-2026-06-19-main-discovery-wrap-up',
  '2026-06-19-main-discovery-wrap-up',
  'site-updates',
  '["网站更新","SEO","站点地图","PWA","循环汇总"]',
  '',
  'published',
  0,
  0,
  '2026-06-19T00:15:00.000Z',
  '2026-06-19T00:15:00.000Z',
  '2026-06-19T00:15:00.000Z'
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

insert into articles (
  article_id, slug, category, tags, cover_image, status, is_pinned,
  view_count, created_at, updated_at, published_at
) values (
  'seed-update-2026-06-18-main-visual-polish-cycle',
  '2026-06-18-main-visual-polish-cycle',
  'site-updates',
  '["网站更新","主端视觉","XP桌面","移动端","循环汇总"]',
  '',
  'published',
  0,
  0,
  '2026-06-18T11:30:00.000Z',
  '2026-06-18T11:30:00.000Z',
  '2026-06-18T11:30:00.000Z'
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
  ('seed-update-2026-06-30-account-popover-layer-fix-zh', 'seed-update-2026-06-30-account-popover-layer-fix', 'zh', '账号弹窗层级修复', '右上角账号入口现在会显示在首页和各栏目窗口之上，登录、注册和退出流程保持不变。', '# 账号弹窗层级修复

这次修复集中处理右上角账号入口的显示层级，让登录弹窗在首页和其他栏目里都能稳定露出。

## 更新内容

- 顶栏整体层级现在高于主内容窗口，账号弹窗不会再被首页内容、知识库、视频区、资源区、游戏区、聊天室或关于我窗口遮挡。
- 顶栏继续允许账号弹窗从按钮下方展开，避免点击后弹窗被顶栏自身裁剪。
- 登录、注册、退出、会话 cookie、云存档和账号接口逻辑保持不变，本次只调整账号入口的前端显示层级。
- 同步更新前端 fallback、Functions seed、schema seed、缓存版本和项目记录，让首页最近更新日期能读取到本次修复。', '2026-06-30T08:00:00.000Z', '2026-06-30T08:00:00.000Z'),
  ('seed-update-2026-06-30-account-popover-layer-fix-en', 'seed-update-2026-06-30-account-popover-layer-fix', 'en', 'Account Popover Layer Fix', 'The top-right account entry now opens above the home page and section windows while login, registration, and sign-out stay unchanged.', '# Account Popover Layer Fix

This update fixes the top-right account entry so the login popover reliably appears above the home page and every section window.

## Changes

- The top bar now sits above the main content windows, so the account popover is no longer hidden behind Home, Knowledge, Videos, Resources, Games, Chat, or About surfaces.
- The top bar continues to allow the account popover to extend below the button instead of clipping it.
- Login, registration, sign-out, session cookies, cloud saves, and account APIs are unchanged; this is a front-end layering fix.
- The front-end fallback, Functions seed, schema seed, cache versions, and project records were updated so the recent-update date reflects this fix.', '2026-06-30T08:00:00.000Z', '2026-06-30T08:00:00.000Z'),
  ('seed-update-2026-06-30-account-popover-layer-fix-ja', 'seed-update-2026-06-30-account-popover-layer-fix', 'ja', 'アカウント表示の重なり修正', '右上のアカウント入口がホームや各セクションのウィンドウより前面に表示され、ログイン、登録、ログアウトの動作はそのままです。', '# アカウント表示の重なり修正

今回の更新では、右上のアカウント入口がホーム画面や各セクションのウィンドウに隠れないよう、表示の重なり順を修正しました。

## 更新内容

- トップバー全体をメインコンテンツのウィンドウより前面に配置し、アカウント表示がホーム、知識庫、動画、リソース、ゲーム、チャット、プロフィール画面の後ろに隠れないようにしました。
- アカウント表示は引き続きボタンの下に展開され、トップバー自身に切り取られません。
- ログイン、登録、ログアウト、セッション cookie、クラウドセーブ、アカウント API の動作は変更していません。今回は前端の表示階層だけの修正です。
- フロントエンド fallback、Functions seed、schema seed、キャッシュ版、プロジェクト記録も更新し、最近の更新日が今回の修正を反映するようにしました。', '2026-06-30T08:00:00.000Z', '2026-06-30T08:00:00.000Z'),
  ('seed-update-2026-06-24-account-cleanup-merge-launch-zh', 'seed-update-2026-06-24-account-cleanup-merge-launch', 'zh', '账号流程与合并上线整理', '账号登录、注册和退出更稳定，最近更新操作区完成精简，发布方式回到合并 main 后自动上线。', '# 账号流程与合并上线整理

这次更新把主站右上角账号入口和发布流程重新收拢，让日常访问时的账号操作更明确，也让上线方式回到项目约定的 GitHub main 自动发布链路。

## 更新内容

- 账号登录和注册按钮改为显式记录当前操作，回车默认登录，点击注册就按注册流程提交。
- 账号请求期间会临时锁定登录、注册和退出按钮，减少慢网或重复点击造成的状态错乱。
- 退出账号继续优先清理服务端会话，网络异常时也会让前端回到未登录状态，避免界面卡住。
- 欢迎窗口最近更新操作区完成精简，只保留查看网站更新记录的入口。
- 常规上线方式回到合并到 GitHub main 后由 Cloudflare Pages 自动发布，`npm run deploy` 只保留提示，不再执行手动发布命令。

这轮没有改变游戏存档格式、聊天接口、后台权限或文章发布权限。', '2026-06-24T08:00:00.000Z', '2026-06-24T08:00:00.000Z'),
  ('seed-update-2026-06-24-account-cleanup-merge-launch-en', 'seed-update-2026-06-24-account-cleanup-merge-launch', 'en', 'Account Flow and Merge Launch', 'Account sign-in, registration, and sign-out are steadier, recent-update actions are simpler, and deployment returns to merge-to-main publishing.', '# Account Flow and Merge Launch

This update tightens the top-right account entry and brings release handling back to the project main auto-publish path.

## Changes

- The sign-in and registration buttons now record the intended action explicitly: Enter defaults to sign-in, while clicking Register submits the registration flow.
- Account requests briefly lock sign-in, registration, and sign-out buttons to avoid stale UI during slow or repeated clicks.
- Sign-out still clears the server session first, while the front end returns to the signed-out state even if the network is unavailable.
- The welcome window recent-update action area is simplified to keep only the site update log entry point.
- Normal releases now point back to merging into GitHub main so Cloudflare Pages publishes automatically; `npm run deploy` only prints that reminder instead of running a manual publish command.

This round does not change game save formats, chat APIs, admin permissions, or article publishing permissions.', '2026-06-24T08:00:00.000Z', '2026-06-24T08:00:00.000Z'),
  ('seed-update-2026-06-24-account-cleanup-merge-launch-ja', 'seed-update-2026-06-24-account-cleanup-merge-launch', 'ja', 'アカウント操作とマージ公開の整理', 'ログイン、登録、ログアウトを安定させ、最近の更新の操作欄を簡潔にし、main へのマージ公開に戻しました。', '# アカウント操作とマージ公開の整理

今回の更新では、右上のアカウント入口と公開手順を整理し、通常利用時の操作を分かりやすくしながら、GitHub main から Cloudflare Pages が自動公開する流れに戻しました。

## 更新内容

- ログインと登録ボタンは、どちらの操作かを明示してから送信します。Enter はログイン、登録ボタンのクリックは登録として扱います。
- アカウント操作中は、ログイン、登録、ログアウトボタンを一時的にロックし、遅い通信や連打による表示のずれを減らします。
- ログアウトは引き続きサーバー側セッションの削除を優先し、通信に失敗しても画面は未ログイン状態へ戻します。
- ようこそ画面の最近の更新の操作欄を簡潔にし、サイト更新記録への入口だけを残しました。
- 通常公開は GitHub main へマージしたあと Cloudflare Pages が自動公開する方式に戻し、`npm run deploy` は手動公開ではなく注意メッセージだけを表示します。

今回、ゲーム保存形式、チャット API、管理画面権限、記事公開権限は変更していません。', '2026-06-24T08:00:00.000Z', '2026-06-24T08:00:00.000Z')
on conflict(article_id, lang) do update set
  title = excluded.title,
  summary = excluded.summary,
  content_markdown = excluded.content_markdown,
  updated_at = excluded.updated_at;

insert into article_translations (
  translation_id, article_id, lang, title, summary, content_markdown, created_at, updated_at
) values
  (
    'seed-update-2026-06-23-public-ux-accessibility-privacy-wrap-up-zh',
    'seed-update-2026-06-23-public-ux-accessibility-privacy-wrap-up',
    'zh',
    '公开体验、无障碍和隐私收尾',
    '主站按钮点击、弹窗焦点、资源空状态、社交入口、游戏来源链接和访问统计隐私做了一轮集中收口。',
    '# 公开体验、无障碍和隐私收尾

这次更新集中整理主站公开页面里最容易影响日常浏览的交互细节，让按钮、弹窗和入口的反馈更加明确。

## 更新内容

- 主站按钮点击处理顺序重新梳理，账号、重试、语言、筛选、文章、视频、弹窗关闭等具体操作会优先响应，通用页面跳转作为最后的兜底处理。
- 欢迎弹窗和视频弹窗打开后会把焦点放到真正可操作的关闭按钮上，关闭时也会更稳定地回到合适的位置。
- 资源区和杂谈区只展示已有真实入口的内容；暂时没有可打开内容时，会显示明确的整理中空状态，不再把示例占位伪装成可点击资源。
- 关于我里的 Bilibili 和 Discord 在没有真实配置时保持隐藏，社交链接会按已知平台归一化处理，减少空图标和错误跳转。
- 游戏来源链接和游戏外壳里的仓库入口继续限制为可信 GitHub 地址，游戏本地存档读取也优先使用真实浏览器存储。
- 前端访问统计继续收紧隐私边界，页面路径、来源和点击标记会在发送前做规范化和脱敏处理。',
    '2026-06-23T06:00:00.000Z',
    '2026-06-23T06:00:00.000Z'
  ),
  (
    'seed-update-2026-06-23-public-ux-accessibility-privacy-wrap-up-en',
    'seed-update-2026-06-23-public-ux-accessibility-privacy-wrap-up',
    'en',
    'Public UX, Accessibility, and Privacy Wrap-up',
    'Button clicks, modal focus, honest empty states, social links, game source links, and analytics privacy were tightened across the public site.',
    '# Public UX, Accessibility, and Privacy Wrap-up

This update tightens the public site interactions that matter most during everyday browsing, with clearer feedback for buttons, dialogs, and content entry points.

## Changes

- Button click handling now prioritizes specific actions such as account controls, retries, language switching, filters, article actions, video playback, and dialog closing before falling back to general page navigation.
- The welcome dialog and video dialog move focus to a real close button when opened, then restore focus more predictably when closed.
- Resources and Talk now show only entries with real usable destinations. When there is nothing ready to open, visitors see a clear in-progress empty state instead of placeholder cards that look downloadable.
- Bilibili and Discord remain hidden until real URLs are configured, and social links are normalized by known platform names to reduce empty icons or wrong destinations.
- Game source links and game-shell repository links stay limited to trusted GitHub URLs, while local save reads prefer real browser storage before falling back.
- Public analytics keeps a tighter privacy boundary by normalizing paths, referrers, links, and click labels before anything is sent.',
    '2026-06-23T06:00:00.000Z',
    '2026-06-23T06:00:00.000Z'
  ),
  (
    'seed-update-2026-06-23-public-ux-accessibility-privacy-wrap-up-ja',
    'seed-update-2026-06-23-public-ux-accessibility-privacy-wrap-up',
    'ja',
    '公開体験・アクセシビリティ・プライバシー仕上げ',
    '公開サイトのボタン操作、モーダルのフォーカス、空状態、SNS入口、ゲーム出典リンク、アクセス解析のプライバシーをまとめて整えました。',
    '# 公開体験・アクセシビリティ・プライバシー仕上げ

今回の更新では、普段の閲覧で迷いやすいボタン、ダイアログ、入口まわりの反応をまとめて整えました。

## 更新内容

- クリック処理の順序を整理し、アカウント、再試行、言語切替、フィルター、記事、動画、ダイアログを閉じる操作が、通常のページ移動より先に反応するようにしました。
- 歓迎ダイアログと動画ダイアログを開いたとき、フォーカスが実際に操作できる閉じるボタンへ移動し、閉じたあとも戻り先が安定します。
- リソース欄と雑談欄は、実際に開ける入口がある内容だけを表示します。まだ公開できる内容がない場合は、整理中であることが分かる空状態を表示します。
- Bilibili と Discord は実際のURLが設定されるまで非表示のままにし、SNSリンクは既知のプラットフォーム名で整理して、空アイコンや誤った移動先を減らしました。
- ゲームの出典リンクとゲームシェル内のリポジトリ入口は、信頼できる GitHub URL に限定したままです。ゲームのローカル保存も、まずブラウザーの本来の保存先を優先して読みます。
- 公開側のアクセス解析は、送信前にページパス、参照元、リンク、クリックラベルを正規化し、プライバシー境界をさらに明確にしました。',
    '2026-06-23T06:00:00.000Z',
    '2026-06-23T06:00:00.000Z'
  ),
  (
    'seed-update-2026-06-22-fixed-dock-window-backdrops-zh',
    'seed-update-2026-06-22-fixed-dock-window-backdrops',
    'zh',
    '底部导航与四时段窗口背景',
    '底部导航固定贴合屏幕下沿，窗口页改用专用低干扰四时段背景，并补齐手机窄屏避让。',
    '# 底部导航与四时段窗口背景

本次更新整理主站窗口页的桌面底层和底部导航位置，让不同页面之间的视觉基线保持一致。

## 更新内容

- 底部导航栏改为固定贴合浏览器视口下沿，不再被不同页面内容高度顶下去。
- 知识库、视频区、资源区、游戏区、杂谈区、聊天室和关于我等窗口页统一预留底栏空间，避免正常窗口被底栏遮住或互相重叠。
- 460px 以下窄屏手机补足顶部栏换行后的高度预留，避免 iPhone SE / 390px 宽度下窗口底部压进底部任务栏。
- 非首页窗口页改用 `assets/images/window-backdrops/<time>.png` 专用四时段背景图，并增加低对比度遮罩，让背景更现代、更简单。
- 首页仍保留原有动态壁纸舞台、云层和四时段预览参数。
- 更新主站 CSS / JS 缓存版本，减少线上继续加载旧任务栏或旧背景的概率。',
    '2026-06-22T14:30:00.000Z',
    '2026-06-22T14:30:00.000Z'
  ),
  (
    'seed-update-2026-06-22-fixed-dock-window-backdrops-en',
    'seed-update-2026-06-22-fixed-dock-window-backdrops',
    'en',
    'Pinned Taskbar and Window Backdrops',
    'The bottom taskbar pins to the viewport edge, with dedicated quiet backdrops and small-phone spacing.',
    '# Pinned Taskbar and Window Backdrops

This update tidies the desktop layer behind the main windows and keeps the bottom navigation aligned across routes.

## Changes

- The bottom taskbar now pins to the browser viewport edge instead of being pushed down by different page heights.
- Knowledge, Videos, Resources, Games, Blog, Chatroom, and About now reserve space for the taskbar so normal windows are not covered or overlapped.
- Narrow phones below 460px now reserve extra height for the wrapped top bar, preventing windows from pressing into the bottom taskbar on iPhone SE / 390px widths.
- Non-home window pages now use dedicated `assets/images/window-backdrops/<time>.png` backdrops for morning, day, dusk, and night, with a low-contrast wash to keep them modern and quiet.
- The home screen keeps the existing animated wallpaper stage, cloud layers, and preview query parameter.
- The public CSS / JS cache version was updated to avoid stale taskbar or backdrop styles online.',
    '2026-06-22T14:30:00.000Z',
    '2026-06-22T14:30:00.000Z'
  ),
  (
    'seed-update-2026-06-22-fixed-dock-window-backdrops-ja',
    'seed-update-2026-06-22-fixed-dock-window-backdrops',
    'ja',
    '固定タスクバーと時間帯背景',
    '下部タスクバーを画面下端に固定し、専用背景と狭いスマホ幅での余白を整えました。',
    '# 固定タスクバーと時間帯背景

今回の更新では、各ウィンドウ画面の背面レイヤーと下部ナビゲーションの位置を整え、ページを切り替えても表示の基準がずれないようにしました。

## 更新内容

- 下部タスクバーをブラウザ画面の下端に固定し、ページ内容の高さで押し下げられないようにしました。
- 知識庫、動画、リソース、ゲーム、雑談、匿名チャット、プロフィールなどのウィンドウ画面にタスクバー分の余白を確保し、通常のウィンドウを隠したり重ねたりしないようにしました。
- 460px 未満の狭いスマホ幅では、折り返した上部バーの高さを追加で確保し、iPhone SE / 390px 幅でウィンドウ下部が下部タスクバーに入り込まないようにしました。
- ホーム以外のウィンドウ画面に、`assets/images/window-backdrops/<time>.png` の専用4時間帯背景を適用し、低コントラストのベールで現代的かつ控えめにしました。
- ホーム画面の既存の動く壁紙ステージ、雲レイヤー、時間帯プレビュー用クエリはそのまま保ちます。
- 公開側 CSS / JS のキャッシュ版を更新し、オンラインで古いタスクバーや背景が残りにくくしました。',
    '2026-06-22T14:30:00.000Z',
    '2026-06-22T14:30:00.000Z'
  ),
  (
    'seed-update-2026-06-22-about-contact-icons-zh',
    'seed-update-2026-06-22-about-contact-icons',
    'zh',
    '联系方式图标归位',
    '关于我窗口删除联系方式占位文案，把五个平台原应用图标移入联系方式行。',
    '# 联系方式图标归位

本次更新继续整理关于我窗口，把联系方式从占位文案改成真实可点击的社交图标入口。

## 更新内容

- 删除联系方式里的空占位文字。
- 将 X、GitHub、Bilibili、Instagram 和 Discord 图标移入联系方式这一行，不再单独占用一条底部图标栏。
- 五个平台图标改为项目内本地 SVG 品牌图标资源，保留图标按钮和 XP 风格外框。
- 社交链接仍通过公开只读接口读取后台配置，按钮继续在新标签打开并保留 `aria-label`。
- 更新主站 CSS / JS 缓存版本，移动端窄屏下图标会在联系方式行内自动换行。',
    '2026-06-22T00:00:00.000Z',
    '2026-06-22T00:00:00.000Z'
  ),
  (
    'seed-update-2026-06-22-about-contact-icons-en',
    'seed-update-2026-06-22-about-contact-icons',
    'en',
    'Contact Icons Aligned',
    'The About window now removes the contact placeholder and moves the five app icons into the Contact row.',
    '# Contact Icons Aligned

This update tidies the About window by replacing the contact placeholder with real clickable social icon entries.

## Changes

- Removed the placeholder contact text.
- Moved the X, GitHub, Bilibili, Instagram, and Discord icons into the Contact row instead of keeping a separate icon strip below the intro copy.
- Switched the five platforms to local SVG brand icon assets while keeping the small XP-style icon buttons.
- Social links still read admin-configured URLs through the public read-only endpoint, open in a new tab, and keep `aria-label` text.
- Updated the public CSS / JS cache version, with icons wrapping inside the Contact row on narrow screens.',
    '2026-06-22T00:00:00.000Z',
    '2026-06-22T00:00:00.000Z'
  ),
  (
    'seed-update-2026-06-22-about-contact-icons-ja',
    'seed-update-2026-06-22-about-contact-icons',
    'ja',
    '連絡先アイコンを整理',
    'プロフィール画面の連絡先プレースホルダーを削除し、5つのアプリアイコンを連絡先行へ移動しました。',
    '# 連絡先アイコンを整理

今回の更新では、プロフィール画面の連絡先を空の文言ではなく、実際にクリックできるSNSアイコンにしました。

## 更新内容

- 連絡先の空プレースホルダー文言を削除しました。
- X、GitHub、Bilibili、Instagram、Discord のアイコンを、紹介文下の独立した列ではなく連絡先行へ移動しました。
- 5つのプラットフォームは、プロジェクト内のローカル SVG ブランドアイコンを使い、XP 風の小さなボタン表示を保ちます。
- SNSリンクは引き続き公開読み取り専用APIから管理画面の設定を読み込み、新しいタブで開き、`aria-label` も保持します。
- 公開側 CSS / JS のキャッシュ版を更新し、狭い画面では連絡先行の中でアイコンが折り返します。',
    '2026-06-22T00:00:00.000Z',
    '2026-06-22T00:00:00.000Z'
  ),
  (
    'seed-update-2026-06-20-about-social-links-zh',
    'seed-update-2026-06-20-about-social-links',
    'zh',
    '关于我社交图标上线',
    '关于我窗口新增五个纯图标社交入口，并可在后台修改每个跳转链接。',
    '# 关于我社交图标上线

关于我窗口现在多了一排纯图标社交入口，不额外增加可见文字，继续保持个人站的 XP 像素桌面排版。

## 更新内容

- 新增 X、GitHub、Bilibili、Instagram 和 Discord 五个图标按钮。
- 每个图标都是可点击超链接，并默认跳转到对应平台页面。
- 后台新增“社交链接”页，可替换和修改每个平台的跳转地址。
- 社交链接配置保存到 D1 的 `site_runtime_state`，主站通过公开只读接口读取。
- 图标按钮保留 `aria-label`，移动端会自动换行，避免撑开关于我窗口。',
    '2026-06-19T18:00:00.000Z',
    '2026-06-19T18:00:00.000Z'
  ),
  (
    'seed-update-2026-06-20-about-social-links-en',
    'seed-update-2026-06-20-about-social-links',
    'en',
    'About Social Icons',
    'The About window now has five icon-only social links with admin-editable URLs.',
    '# About Social Icons

The About window now includes an icon-only row of social links, without adding visible text inside the panel.

## Changes

- Added icon buttons for X, GitHub, Bilibili, Instagram, and Discord.
- Each icon opens its configured external page in a new tab.
- The admin area now has a Social Links page for editing every destination URL.
- Social link settings are stored in D1 `site_runtime_state`, and the public site reads them through a read-only endpoint.
- The buttons keep `aria-label` text and wrap on small screens so the About window stays tidy.',
    '2026-06-19T18:00:00.000Z',
    '2026-06-19T18:00:00.000Z'
  ),
  (
    'seed-update-2026-06-20-about-social-links-ja',
    'seed-update-2026-06-20-about-social-links',
    'ja',
    'プロフィールのSNSアイコン',
    'プロフィール画面に5つのアイコンリンクを追加し、管理画面でURLを変更できます。',
    '# プロフィールのSNSアイコン

プロフィール画面に、文字を増やさないアイコンだけのSNSリンク列を追加しました。

## 更新内容

- X、GitHub、Bilibili、Instagram、Discord の5つのアイコンボタンを追加しました。
- 各アイコンはクリックでき、設定された外部ページを新しいタブで開きます。
- 管理画面に「社交リンク」ページを追加し、各リンク先URLを変更できます。
- SNSリンク設定は D1 の `site_runtime_state` に保存し、公開側は読み取り専用APIから取得します。
- ボタンには `aria-label` を残し、小画面では折り返してプロフィール画面を崩さないようにしています。',
    '2026-06-19T18:00:00.000Z',
    '2026-06-19T18:00:00.000Z'
  ),
  (
    'seed-update-2026-06-19-immersive-time-chrome-zh',
    'seed-update-2026-06-19-immersive-time-chrome',
    'zh',
    '四时段沉浸式桌面栏',
    '首页顶部栏和底部任务栏改为四套无竖线的现代玻璃像素 HUD。',
    '# 四时段沉浸式桌面栏

本次更新重新设计了首页最上方和最下方两排，去掉旧版竖向栅格，改成更现代的玻璃像素 HUD。

## 更新内容

- 顶部栏继续跟随 morning、day、dusk、night 四个时间段，但背景改为柔和光斑、横向光带和半透明玻璃层。
- 底部任务栏改为更轻的 dock 式像素轨道，Start、任务按钮和右侧状态托盘会跟随当前时间段换色。
- 保留所有原有图标资源、入口、语言切换、账号入口、时间显示和在线状态逻辑。
- 本地预览仍可用 `?wallpaper=morning`、`?wallpaper=day`、`?wallpaper=dusk`、`?wallpaper=night` 检查四套效果。
- 同步更新 CSS / JS 缓存版本，避免线上继续加载旧样式。

本轮只调整公开主站顶部栏和任务栏视觉，没有修改后台、账号、聊天、文章接口或游戏存档逻辑。',
    '2026-06-19T12:00:00.000Z',
    '2026-06-19T12:00:00.000Z'
  ),
  (
    'seed-update-2026-06-19-immersive-time-chrome-en',
    'seed-update-2026-06-19-immersive-time-chrome',
    'en',
    'Immersive Time-of-Day Chrome',
    'The home top bar and taskbar now use four modern glass pixel HUD themes without vertical grid lines.',
    '# Immersive Time-of-Day Chrome

This update redesigns the top and bottom rows of the home screen, removing the old vertical grid texture and replacing it with a more modern glass pixel HUD.

## Changes

- The top bar still follows morning, day, dusk, and night, but now uses soft glints, horizontal light bands, and translucent glass layers.
- The taskbar is now a lighter dock-like pixel rail, with Start, task buttons, and the status tray following the active time theme.
- Existing icon assets, navigation entries, language switching, account entry, local clock, and online status behavior are unchanged.
- Local previews still support `?wallpaper=morning`, `?wallpaper=day`, `?wallpaper=dusk`, and `?wallpaper=night` for checking the four styles.
- CSS and JS cache versions were updated so production browsers do not keep the old chrome.

This pass only changes the public main-site chrome visuals. Admin pages, account APIs, chat APIs, article APIs, and game-save logic were not changed.',
    '2026-06-19T12:00:00.000Z',
    '2026-06-19T12:00:00.000Z'
  ),
  (
    'seed-update-2026-06-19-immersive-time-chrome-ja',
    'seed-update-2026-06-19-immersive-time-chrome',
    'ja',
    '時間帯別の没入デスクトップバー',
    'ホームの上部バーとタスクバーを、縦線なしの4種類のモダンなガラス調ピクセル HUD に更新しました。',
    '# 時間帯別の没入デスクトップバー

今回の更新では、ホーム画面の上部と下部の2列を見直し、旧版の縦方向グリッドを外して、よりモダンなガラス調ピクセル HUD にしました。

## 更新内容

- 上部バーは morning、day、dusk、night に引き続き連動しつつ、柔らかい光点、横方向の光帯、半透明のガラス層で表現します。
- 下部タスクバーは軽い dock 風のピクセルレールにし、Start、タスクボタン、右側ステータストレイが現在の時間帯に合わせて変化します。
- 既存のアイコン素材、入口、言語切り替え、アカウント入口、時計、オンライン表示の動作はそのままです。
- ローカル確認では引き続き `?wallpaper=morning`、`?wallpaper=day`、`?wallpaper=dusk`、`?wallpaper=night` で4種類を確認できます。
- CSS / JS のキャッシュ版を更新し、公開環境で古い表示が残りにくいようにしました。

この作業では公開メインサイトの上部バーとタスクバーの見た目だけを調整し、管理画面、アカウント API、チャット API、記事 API、ゲーム保存ロジックは変更していません。',
    '2026-06-19T12:00:00.000Z',
    '2026-06-19T12:00:00.000Z'
  ),
  (
    'seed-update-2026-06-19-main-discovery-wrap-up-zh',
    'seed-update-2026-06-19-main-discovery-wrap-up',
    'zh',
    '主站发现与收口记录',
    '本次主站循环补齐搜索发现配置、站点地图、manifest、robots、三语页面 meta 和语言按钮状态，并完成最终验证。',
    '# 主站发现与收口记录

这篇记录合并 2026 年 6 月 19 日早上 8 点前的主站公开侧循环结果。循环期间只处理公开主站与公开文章接口，避开 `/admin/` 页面、后台私有更新、后台权限和管理接口。

## 更新内容

- 首页补齐 canonical、Open Graph、Twitter Card、主题色、manifest 和移动端 PWA 发现信息。
- 新增 `robots.txt`、`manifest.webmanifest`、`/api/sitemap.xml` 和根路径 `/sitemap.xml`，站点地图会输出三语首页与公开文章 URL。
- 语言切换会同步 `html lang`、页面标题、description、canonical、OG/Twitter meta 和语言按钮 `aria-pressed` 状态。
- 构建检查覆盖文章、视频、站点地图、manifest、robots、主站脚本与遥测脚本，减少上线前遗漏。
- 本地多视口扫描覆盖首页、知识库、文章详情、视频、资源、游戏、杂谈、聊天室、关于我和账号入口，没有发现页面错误或横向溢出。

后续如果继续优化，建议优先补真实线上 Search Console / 社交分享卡片抓取结果，再决定是否扩展结构化数据。',
    '2026-06-19T00:15:00.000Z',
    '2026-06-19T00:15:00.000Z'
  ),
  (
    'seed-update-2026-06-19-main-discovery-wrap-up-en',
    'seed-update-2026-06-19-main-discovery-wrap-up',
    'en',
    'Main Site Discovery Wrap-up',
    'This public-site cycle added discovery metadata, sitemap, manifest, robots, trilingual page meta sync, language button state, and final validation.',
    '# Main Site Discovery Wrap-up

This entry consolidates the public-site loop that ended before 8:00 AM on June 19, 2026. The work stayed on the public main site and public article API, while avoiding `/admin/`, private admin updates, admin permissions, and admin APIs.

## Changes

- The home page now has canonical, Open Graph, Twitter Card, theme-color, manifest, and mobile PWA discovery metadata.
- `robots.txt`, `manifest.webmanifest`, `/api/sitemap.xml`, and root `/sitemap.xml` were added; the sitemap emits trilingual home URLs and public article URLs.
- Language switching now syncs `html lang`, page title, description, canonical, OG/Twitter meta, and language-button `aria-pressed` state.
- Build checks now cover articles, videos, sitemap, manifest, robots, the main script, and the telemetry script to reduce pre-release misses.
- Local viewport scanning covered Home, Knowledge, article details, Videos, Resources, Games, Talk, Chat, About, and Account with no page errors or horizontal overflow found.

For the next pass, live Search Console checks and social-card crawler previews are the best follow-up before expanding structured data.',
    '2026-06-19T00:15:00.000Z',
    '2026-06-19T00:15:00.000Z'
  ),
  (
    'seed-update-2026-06-19-main-discovery-wrap-up-ja',
    'seed-update-2026-06-19-main-discovery-wrap-up',
    'ja',
    'メインサイト発見性の仕上げ',
    '今回の公開側サイクルでは、検索向けメタ情報、サイトマップ、manifest、robots、三言語 meta 同期、言語ボタン状態、最終確認を追加しました。',
    '# メインサイト発見性の仕上げ

この記録では、2026年6月19日午前8時までの公開サイト側ループ結果をまとめます。作業範囲は公開メインサイトと公開記事 API に限定し、`/admin/`、管理側の非公開更新、管理権限、管理 API には触れていません。

## 更新内容

- ホームに canonical、Open Graph、Twitter Card、テーマカラー、manifest、モバイル PWA 向けの発見情報を追加しました。
- `robots.txt`、`manifest.webmanifest`、`/api/sitemap.xml`、ルートの `/sitemap.xml` を追加し、サイトマップには三言語ホーム URL と公開記事 URL を出力します。
- 言語切り替え時に `html lang`、ページタイトル、description、canonical、OG/Twitter meta、言語ボタンの `aria-pressed` 状態を同期します。
- ビルド確認では記事、動画、サイトマップ、manifest、robots、メインスクリプト、テレメトリスクリプトを確認します。
- ローカルの複数ビューポート確認では、ホーム、知識庫、記事詳細、動画、リソース、ゲーム、雑談、チャット、About、アカウント入口でページエラーや横方向のはみ出しは見つかりませんでした。

次に進めるなら、実際の Search Console と SNS カードの取得結果を確認してから構造化データを広げるのがよさそうです。',
    '2026-06-19T00:15:00.000Z',
    '2026-06-19T00:15:00.000Z'
  ),
  (
    'seed-update-2026-06-18-main-visual-polish-cycle-zh',
    'seed-update-2026-06-18-main-visual-polish-cycle',
    'zh',
    '主端视觉改版循环更新',
    '本次主端视觉改版循环统一打磨首页、知识库、视频、资源、游戏、聊天室、关于我和账号入口的展示体验。',
    '# 主端视觉改版循环更新

这篇记录合并本线程的主端视觉改版循环结果。循环期间只处理公开主站页面，避开 `/admin/` 管理后台、后台接口和 D1 权限逻辑，继续保留 Windows XP + Pixel Art + Y2K + 可爱复古互联网桌面风格。

## 主要变化

- 首页桌面、顶部栏、任务栏、桌面图标和欢迎弹窗继续保持 XP 桌面感，同时补充长文案、省略显示、短屏和移动端安全间距。
- 欢迎弹窗的最近更新区域在手机竖屏和短横屏下改为更紧凑的三段式布局，更新列表内部滚动，`查看更多更新` 操作更早可见。
- 知识库列表、分类栏、文章详情、复制链接状态、阅读进度和长文排版补齐长词换行与短屏保护，避免文章卡片被极端标题撑宽。
- 视频区、资源区和游戏区卡片统一加强标题、简介、元信息、分类标签和操作按钮的最大宽度与换行规则，减少按钮不齐、卡片挤压和横向溢出。
- 游戏外壳在移动端和短横屏下压缩本地存档工具、云存档提示、协议栏和 iframe 起点，保留导入导出、云存档和游戏本体逻辑不变。
- 匿名聊天室继续使用纯文本渲染；昵称区、状态行、消息输入、发送按钮和底部提示在三语与窄屏下都补充宽度保护。
- 关于我窗口、账号入口和登录弹窗补齐长字段、长邮箱、短横屏和移动端下的换行与高度保护。

## 验证记录

- 已执行构建检查，`build-check` 通过。
- 已用桌面、移动竖屏、平板和短横屏尺寸扫描首页、知识库、视频、资源、游戏、杂谈、聊天室、关于我八个主端区域，中文 / English / 日本語 三语均无页面级横向溢出。
- 本轮没有修改管理后台页面、后台权限、聊天发送接口、账号登录接口或游戏存档逻辑。

后续如果继续打磨，建议优先接入真实视频数据后的播放器弹窗复验、游戏外壳缓存版本策略，以及更多真实长文章内容的阅读截图验收。',
    '2026-06-18T11:30:00.000Z',
    '2026-06-18T11:30:00.000Z'
  ),
  (
    'seed-update-2026-06-18-main-visual-polish-cycle-en',
    'seed-update-2026-06-18-main-visual-polish-cycle',
    'en',
    'Main Site Visual Polish Cycle',
    'This public-site visual cycle polished Home, Knowledge, Videos, Resources, Games, Chat, About, and Account layouts as one unified update.',
    '# Main Site Visual Polish Cycle

This entry consolidates the public-site visual polish cycle from this thread. The work stayed on the visible main site, avoided `/admin/`, admin APIs, and D1 permission logic, and kept the Windows XP + Pixel Art + Y2K + cute retro desktop identity intact.

## Highlights

- Home, the top bar, taskbar, desktop icons, and welcome dialog keep the XP desktop mood while gaining safer long-label handling, ellipsis behavior, short-screen spacing, and mobile guards.
- The welcome dialog''s Recent Updates panel is more compact on phones and short landscape screens: the update list scrolls inside the panel, while `More updates` is visible much sooner.
- Knowledge lists, category tabs, article details, copy-link status, reading progress, and long-form typography now have stronger long-word wrapping and short-screen protection.
- Video, Resource, and Game cards gained more consistent title, summary, metadata, category-label, and action-button width rules to reduce uneven buttons, cramped cards, and horizontal overflow.
- The game shell is tighter on mobile and short landscape screens, with compact save tools, cloud-save notes, license rows, and iframe placement while import/export, cloud saves, and game logic remain unchanged.
- The anonymous chat room still renders visitor content as plain text; nickname, status, message input, send button, and footer copy now have stronger width protection across languages and small screens.
- About, Account, and login popovers gained wrapping and height guards for long fields, long email addresses, mobile layouts, and short landscape screens.

## Validation

- Build checks passed with `build-check`.
- Home, Knowledge, Videos, Resources, Games, Talk, Chat, and About were scanned across desktop, mobile portrait, tablet, and short landscape viewports in Chinese, English, and Japanese with no page-level horizontal overflow.
- This cycle did not change admin pages, admin permissions, chat sending APIs, account login APIs, or game save logic.

Next visual passes should focus on player modal QA once real video data is available locally, cache busting for game-shell CSS, and screenshot acceptance against more real long-form article content.',
    '2026-06-18T11:30:00.000Z',
    '2026-06-18T11:30:00.000Z'
  ),
  (
    'seed-update-2026-06-18-main-visual-polish-cycle-ja',
    'seed-update-2026-06-18-main-visual-polish-cycle',
    'ja',
    'メインサイト視覚調整サイクル更新',
    '今回の公開側視覚調整では、ホーム、知識庫、動画、リソース、ゲーム、チャット、About、アカウント周りをまとめて整えました。',
    '# メインサイト視覚調整サイクル更新

この記録では、本スレッドで行った公開サイト側の視覚調整サイクルを一つにまとめます。作業範囲は主端の見た目に限定し、`/admin/` 管理画面、管理 API、D1 権限ロジックには触れず、Windows XP + Pixel Art + Y2K + かわいいレトロインターネットデスクトップの雰囲気を保ちました。

## 主な変更

- ホーム、上部バー、タスクバー、デスクトップアイコン、歓迎ウィンドウは XP デスクトップ感を保ちながら、長い文言、省略表示、短い画面、モバイル余白に強くしました。
- 歓迎ウィンドウの最近の更新欄は、スマホ縦画面と短い横画面でよりコンパクトになりました。更新リストをパネル内スクロールにし、`もっと見る` を早く見える位置に置きました。
- 知識庫一覧、分類バー、記事詳細、リンクコピー状態、読書進捗、長文組版では、長い単語の折り返しと短画面保護を強化しました。
- 動画、リソース、ゲームのカードでは、タイトル、説明、メタ情報、分類ラベル、操作ボタンの幅と折り返しをそろえ、ボタンの不揃い、カードの圧迫、横方向のはみ出しを減らしました。
- ゲーム外枠はモバイルと短横画面で、ローカルセーブ工具、クラウドセーブ表示、ライセンス欄、iframe の開始位置をコンパクトにしつつ、インポート/エクスポート、クラウド保存、ゲーム本体の動作は変えていません。
- 匿名チャットは引き続きユーザー内容を純テキストで描画します。ニックネーム、状態行、入力欄、送信ボタン、下部表示は三言語と小画面で幅保護を強化しました。
- About、アカウント入口、ログイン表示では、長い項目、長いメールアドレス、モバイル、短横画面向けに折り返しと高さの保護を追加しました。

## 検証

- `build-check` は通過しました。
- ホーム、知識庫、動画、リソース、ゲーム、雑談、チャット、About を、デスクトップ、スマホ縦画面、タブレット、短横画面で確認し、中国語 / English / 日本語の三言語でページ全体の横はみ出しがないことを確認しました。
- 今回のサイクルでは、管理画面、管理権限、チャット送信 API、アカウントログイン API、ゲーム保存ロジックは変更していません。

次回の視覚調整では、ローカルに実動画データがある状態でのプレイヤーウィンドウ確認、game-shell CSS のキャッシュ対策、実際の長文記事スクリーンショットでの受け入れ確認を優先するとよさそうです。',
    '2026-06-18T11:30:00.000Z',
    '2026-06-18T11:30:00.000Z'
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

insert into articles (
  article_id, slug, category, tags, cover_image, status, is_pinned,
  view_count, created_at, updated_at, published_at
) values (
  'seed-update-2026-06-17-knowledge-search',
  '2026-06-17-knowledge-search',
  'site-updates',
  '["网站更新","知识库","搜索","移动端"]',
  '',
  'published',
  0,
  0,
  '2026-06-17T15:25:00.000Z',
  '2026-06-17T15:25:00.000Z',
  '2026-06-17T15:25:00.000Z'
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

insert into articles (
  article_id, slug, category, tags, cover_image, status, is_pinned,
  view_count, created_at, updated_at, published_at
) values (
  'seed-update-2026-06-18-public-site-nightly-update',
  '2026-06-18-public-site-nightly-update',
  'site-updates',
  '["网站更新","主站优化","夜间汇总","阅读体验","资源区","游戏区"]',
  '',
  'published',
  0,
  0,
  '2026-06-18T00:00:00.000Z',
  '2026-06-18T00:00:00.000Z',
  '2026-06-18T00:00:00.000Z'
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
    'seed-update-2026-06-18-public-site-nightly-update-zh',
    'seed-update-2026-06-18-public-site-nightly-update',
    'zh',
    '主站夜间优化汇总',
    '合并昨晚主站优化记录，并按参考图完成知识库文章页 10 轮阅读布局复刻打磨；文章窗口不再拉伸占满全站。',
    '# 主站夜间优化汇总

这篇记录把昨晚主站公开侧的小步优化合并到一起，避免网站更新记录被一串细项刷屏。

## 汇总内容

- 知识库文章详情补齐目录、阅读进度、复制链接和回到顶部能力；本轮参考验收图重排为左侧目录/小贴士、右侧正文卡片，并把底部进度条与回到顶部按钮并排悬浮。
- 追加 10 轮视觉复刻打磨：阅读态知识库窗口保持站内 XP 窗口尺寸，不再拉伸占满整个网站；标题栏补最小化/最大化/关闭三按钮，底部进度条改为单行蓝色分段条，正文节奏和左侧小贴士位置更贴近参考图。
- 资源区补齐分类数量、卡片状态、空分类提示和更严格的资源链接白名单。
- 游戏区补齐云存档、源码徽标、语言标记、入口路径守卫和游戏外壳安全 DOM 渲染。
- 首页最近更新、知识库列表、筛选、资源筛选和游戏列表继续收紧为 DOM / textContent 渲染，降低公开内容的 XSS 风险。
- 语言同步、文章链接保留语言和最近更新提示统一整理，分享更稳定。
- 图片懒加载、异步解码、固定图片尺寸和移动端布局细节继续做轻量优化。

旧的单项记录会保留为历史数据和可回退内容，但公开列表只展示这一篇汇总。',
    '2026-06-18T00:00:00.000Z',
    '2026-06-18T00:00:00.000Z'
  ),
  (
    'seed-update-2026-06-18-public-site-nightly-update-en',
    'seed-update-2026-06-18-public-site-nightly-update',
    'en',
    'Public Site Nightly Summary',
    'Merged last night''s public-site updates, completed ten reference-matching passes, and kept the article window inside the site frame.',
    '# Public Site Nightly Summary

This entry merges last night''s small public-site updates into one readable record, so the site update log no longer gets flooded by one article per tiny adjustment.

## Summary

- Knowledge articles gained contents navigation, reading progress, copy-link, and back-to-top controls; this round rebuilds the article view from the reference image with a left contents/tip sidebar, a right reading card, and bottom progress plus back-to-top controls floating side by side.
- Ten visual matching passes were added: the article reading window now stays inside the site''s XP window frame instead of stretching across the whole site, the titlebar has minimize/maximize/close controls, the progress bar is a single-row segmented blue strip, and the body rhythm plus left tip placement are closer to the reference image.
- The Resources area gained category counts, status badges, empty-category guidance, and stricter resource link allowlists.
- The Games area gained cloud-save and source badges, localized language labels, launch-path guards, and safer DOM rendering in the game shell.
- Recent updates, the knowledge list, filters, resource filters, and the game list continue to render through DOM / textContent to reduce XSS risk for public content.
- Language-aware links, article share URLs, and recent-update labels were aligned for more stable sharing behavior.
- Lazy loading, async image decoding, fixed image dimensions, and mobile layout details received lightweight polish.

The old single-topic entries remain as historical and rollback data, but public lists now show this one summary instead.',
    '2026-06-18T00:00:00.000Z',
    '2026-06-18T00:00:00.000Z'
  ),
  (
    'seed-update-2026-06-18-public-site-nightly-update-ja',
    'seed-update-2026-06-18-public-site-nightly-update',
    'ja',
    'メインサイト夜間更新まとめ',
    '昨夜のメインサイト更新をまとめ、参考画像に合わせて知識庫の記事ページを10回調整し、記事ウィンドウはサイト内サイズに戻しました。',
    '# メインサイト夜間更新まとめ

この記録では、昨夜の公開サイト側の小さな更新を一つにまとめました。更新記録が細かな記事で埋まりすぎないようにするためです。

## まとめ

- 知識庫の記事詳細に、目次、読書進捗、リンクコピー、先頭へ戻る操作を追加しました。今回、参考画像に合わせて左側の目次/ヒント、右側の本文カード、下部の進捗バーと先頭へ戻るボタンを並べた表示に整えました。
- さらに10回の視覚調整を行い、記事閲覧ウィンドウはサイト内の XP ウィンドウサイズに戻し、全体へ引き伸ばさない表示にしました。タイトルバーに最小化/最大化/閉じるボタンを追加し、進捗バーを1行の青い分割バーにし、本文の余白と左側ヒントの位置も参考画像に近づけました。
- リソース欄には分類件数、状態バッジ、空分類の案内、より厳しいリンク許可リストを追加しました。
- ゲーム欄にはクラウド保存、ソース表示、言語ラベル、起動パスの確認、ゲームシェルの安全な DOM 描画を追加しました。
- 最近の更新、知識庫一覧、フィルター、リソースフィルター、ゲーム一覧は DOM / textContent 描画を続け、公開内容の XSS リスクを下げます。
- 言語付きリンク、記事共有 URL、最近の更新ラベルをそろえ、共有を安定させました。
- 画像の遅延読み込み、非同期デコード、固定画像サイズ、モバイル表示の細部も軽く調整しました。

古い単項目の記事は履歴と回退用データとして残しますが、公開一覧ではこのまとめ記事だけを表示します。',
    '2026-06-18T00:00:00.000Z',
    '2026-06-18T00:00:00.000Z'
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
  'seed-update-2026-06-18-recent-update-icons',
  '2026-06-18-recent-update-icons',
  'site-updates',
  '["网站更新","首页","最近更新","界面"]',
  '',
  'published',
  0,
  0,
  '2026-06-17T18:25:00.000Z',
  '2026-06-17T18:25:00.000Z',
  '2026-06-17T18:25:00.000Z'
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

insert into articles (
  article_id, slug, category, tags, cover_image, status, is_pinned,
  view_count, created_at, updated_at, published_at
) values (
  'seed-update-2026-06-18-resource-url-allowlist',
  '2026-06-18-resource-url-allowlist',
  'site-updates',
  '["网站更新","资源区","链接","安全"]',
  '',
  'published',
  0,
  0,
  '2026-06-17T20:05:00.000Z',
  '2026-06-17T20:05:00.000Z',
  '2026-06-17T20:05:00.000Z'
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

insert into articles (
  article_id, slug, category, tags, cover_image, status, is_pinned,
  view_count, created_at, updated_at, published_at
) values (
  'seed-update-2026-06-18-article-image-path-guard',
  '2026-06-18-article-image-path-guard',
  'site-updates',
  '["网站更新","知识库","图片","安全"]',
  '',
  'published',
  0,
  0,
  '2026-06-17T20:20:00.000Z',
  '2026-06-17T20:20:00.000Z',
  '2026-06-17T20:20:00.000Z'
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

insert into articles (
  article_id, slug, category, tags, cover_image, status, is_pinned,
  view_count, created_at, updated_at, published_at
) values (
  'seed-update-2026-06-18-resource-empty-state',
  '2026-06-18-resource-empty-state',
  'site-updates',
  '["网站更新","资源区","空状态","筛选"]',
  '',
  'published',
  0,
  0,
  '2026-06-17T23:58:00.000Z',
  '2026-06-17T23:58:00.000Z',
  '2026-06-17T23:58:00.000Z'
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

insert into articles (
  article_id, slug, category, tags, cover_image, status, is_pinned,
  view_count, created_at, updated_at, published_at
) values (
  'seed-update-2026-06-18-resource-filter-counts',
  '2026-06-18-resource-filter-counts',
  'site-updates',
  '["网站更新","资源区","筛选","数量"]',
  '',
  'published',
  0,
  0,
  '2026-06-17T23:55:00.000Z',
  '2026-06-17T23:55:00.000Z',
  '2026-06-17T23:55:00.000Z'
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

insert into articles (
  article_id, slug, category, tags, cover_image, status, is_pinned,
  view_count, created_at, updated_at, published_at
) values (
  'seed-update-2026-06-18-resource-status-badges',
  '2026-06-18-resource-status-badges',
  'site-updates',
  '["网站更新","资源区","状态","链接"]',
  '',
  'published',
  0,
  0,
  '2026-06-17T23:50:00.000Z',
  '2026-06-17T23:50:00.000Z',
  '2026-06-17T23:50:00.000Z'
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

insert into articles (
  article_id, slug, category, tags, cover_image, status, is_pinned,
  view_count, created_at, updated_at, published_at
) values (
  'seed-update-2026-06-18-game-info-badges',
  '2026-06-18-game-info-badges',
  'site-updates',
  '["网站更新","游戏区","云存档","源码"]',
  '',
  'published',
  0,
  0,
  '2026-06-17T23:35:00.000Z',
  '2026-06-17T23:35:00.000Z',
  '2026-06-17T23:35:00.000Z'
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

insert into articles (
  article_id, slug, category, tags, cover_image, status, is_pinned,
  view_count, created_at, updated_at, published_at
) values (
  'seed-update-2026-06-18-article-scroll-top',
  '2026-06-18-article-scroll-top',
  'site-updates',
  '["网站更新","知识库","阅读","导航"]',
  '',
  'published',
  0,
  0,
  '2026-06-17T23:20:00.000Z',
  '2026-06-17T23:20:00.000Z',
  '2026-06-17T23:20:00.000Z'
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

insert into articles (
  article_id, slug, category, tags, cover_image, status, is_pinned,
  view_count, created_at, updated_at, published_at
) values (
  'seed-update-2026-06-18-article-toc',
  '2026-06-18-article-toc',
  'site-updates',
  '["网站更新","知识库","目录","阅读"]',
  '',
  'published',
  0,
  0,
  '2026-06-17T23:05:00.000Z',
  '2026-06-17T23:05:00.000Z',
  '2026-06-17T23:05:00.000Z'
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

insert into articles (
  article_id, slug, category, tags, cover_image, status, is_pinned,
  view_count, created_at, updated_at, published_at
) values (
  'seed-update-2026-06-18-article-progress',
  '2026-06-18-article-progress',
  'site-updates',
  '["网站更新","知识库","阅读","进度"]',
  '',
  'published',
  0,
  0,
  '2026-06-17T22:50:00.000Z',
  '2026-06-17T22:50:00.000Z',
  '2026-06-17T22:50:00.000Z'
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

insert into articles (
  article_id, slug, category, tags, cover_image, status, is_pinned,
  view_count, created_at, updated_at, published_at
) values (
  'seed-update-2026-06-18-article-link-lang',
  '2026-06-18-article-link-lang',
  'site-updates',
  '["网站更新","链接","三语","知识库"]',
  '',
  'published',
  0,
  0,
  '2026-06-17T22:20:00.000Z',
  '2026-06-17T22:20:00.000Z',
  '2026-06-17T22:20:00.000Z'
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

insert into articles (
  article_id, slug, category, tags, cover_image, status, is_pinned,
  view_count, created_at, updated_at, published_at
) values (
  'seed-update-2026-06-18-recent-update-labels',
  '2026-06-18-recent-update-labels',
  'site-updates',
  '["网站更新","最近更新","可访问性","首页"]',
  '',
  'published',
  0,
  0,
  '2026-06-17T22:05:00.000Z',
  '2026-06-17T22:05:00.000Z',
  '2026-06-17T22:05:00.000Z'
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

insert into articles (
  article_id, slug, category, tags, cover_image, status, is_pinned,
  view_count, created_at, updated_at, published_at
) values (
  'seed-update-2026-06-18-static-image-dimensions',
  '2026-06-18-static-image-dimensions',
  'site-updates',
  '["网站更新","性能","图片","首页"]',
  '',
  'published',
  0,
  0,
  '2026-06-17T21:20:00.000Z',
  '2026-06-17T21:20:00.000Z',
  '2026-06-17T21:20:00.000Z'
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

insert into articles (
  article_id, slug, category, tags, cover_image, status, is_pinned,
  view_count, created_at, updated_at, published_at
) values (
  'seed-update-2026-06-18-article-tag-locales',
  '2026-06-18-article-tag-locales',
  'site-updates',
  '["网站更新","多语言","标签","知识库"]',
  '',
  'published',
  0,
  0,
  '2026-06-17T21:05:00.000Z',
  '2026-06-17T21:05:00.000Z',
  '2026-06-17T21:05:00.000Z'
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

insert into articles (
  article_id, slug, category, tags, cover_image, status, is_pinned,
  view_count, created_at, updated_at, published_at
) values (
  'seed-update-2026-06-18-game-frame-source-guard',
  '2026-06-18-game-frame-source-guard',
  'site-updates',
  '["网站更新","游戏区","安全","iframe"]',
  '',
  'published',
  0,
  0,
  '2026-06-17T20:50:00.000Z',
  '2026-06-17T20:50:00.000Z',
  '2026-06-17T20:50:00.000Z'
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

insert into articles (
  article_id, slug, category, tags, cover_image, status, is_pinned,
  view_count, created_at, updated_at, published_at
) values (
  'seed-update-2026-06-18-chat-nickname-locale',
  '2026-06-18-chat-nickname-locale',
  'site-updates',
  '["网站更新","聊天室","三语","体验"]',
  '',
  'published',
  0,
  0,
  '2026-06-17T20:35:00.000Z',
  '2026-06-17T20:35:00.000Z',
  '2026-06-17T20:35:00.000Z'
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
  ('seed-update-2026-06-18-recent-update-icons-zh', 'seed-update-2026-06-18-recent-update-icons', 'zh', '最近更新图标优化', '首页最近更新会按站点更新类型显示工具图标。', '# 最近更新图标优化

本次更新让首页“最近更新”列表更像一个网站更新窗口：从文章 API 读取的站点更新记录会显示工具图标，而不是全部显示成书本图标。

## 更新内容

- `site-updates` 类型的文章在首页最近更新列表中显示工具图标，普通文章仍回退为书本图标。
- 本地 fallback 最近更新继续使用每条记录自己的图标，不影响无网络或接口失败时的展示。
- 列表标题、摘要、日期和文章直链逻辑保持不变；只调整公开首页的视觉提示和更新记录。
- 本轮没有触碰后台目录或管理接口。', '2026-06-17T18:25:00.000Z', '2026-06-17T18:25:00.000Z'),
  ('seed-update-2026-06-18-recent-update-icons-en', 'seed-update-2026-06-18-recent-update-icons', 'en', 'Recent Update Icons', 'The home recent-update list now shows a site-update tool icon.', '# Recent Update Icons

This update makes the home Recent Updates list feel more like a site-update window: site update records loaded from the article API now show a tool icon instead of every API-backed article looking like a book.

## Changes

- `site-updates` articles use a tool icon in the home Recent Updates list, while regular articles still fall back to the book icon.
- Local fallback updates keep their per-item icons, so offline or failed API states stay readable.
- Titles, summaries, dates, and article deep links are unchanged; only the public home visual hint and update record changed.
- Admin folders and admin APIs were not touched.', '2026-06-17T18:25:00.000Z', '2026-06-17T18:25:00.000Z'),
  ('seed-update-2026-06-18-recent-update-icons-ja', 'seed-update-2026-06-18-recent-update-icons', 'ja', '最近更新アイコンを調整', 'ホームの最近更新でサイト更新らしいツールアイコンを表示します。', '# 最近更新アイコンを調整

今回の更新では、ホームの「最近更新」リストをサイト更新ウィンドウらしく整えました。記事 API から読み込んだサイト更新記録は、すべて本アイコンになるのではなく、ツールアイコンで表示します。

## 更新内容

- `site-updates` の記事はホームの最近更新リストでツールアイコンを使い、通常の記事は引き続き本アイコンに戻ります。
- ローカル fallback の最近更新は各項目のアイコンを保ち、オフライン時や API 失敗時の表示も変えません。
- タイトル、概要、日付、記事直リンクの動作はそのままで、公開ホームの視覚ヒントと更新記録だけを調整しました。
- 管理画面ディレクトリや管理 API には触れていません。', '2026-06-17T18:25:00.000Z', '2026-06-17T18:25:00.000Z')
on conflict(article_id, lang) do update set
  title = excluded.title,
  summary = excluded.summary,
  content_markdown = excluded.content_markdown,
  updated_at = excluded.updated_at;

insert into articles (
  article_id, slug, category, tags, cover_image, status, is_pinned,
  view_count, created_at, updated_at, published_at
) values (
  'seed-update-2026-06-17-article-share-link',
  '2026-06-17-article-share-link',
  'site-updates',
  '["网站更新","知识库","分享","文章"]',
  '',
  'published',
  0,
  0,
  '2026-06-17T15:40:00.000Z',
  '2026-06-17T15:40:00.000Z',
  '2026-06-17T15:40:00.000Z'
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

insert into articles (
  article_id, slug, category, tags, cover_image, status, is_pinned,
  view_count, created_at, updated_at, published_at
) values (
  'seed-update-2026-06-17-video-empty-state',
  '2026-06-17-video-empty-state',
  'site-updates',
  '["网站更新","视频区","空状态","移动端"]',
  '',
  'published',
  0,
  0,
  '2026-06-17T15:53:00.000Z',
  '2026-06-17T15:53:00.000Z',
  '2026-06-17T15:53:00.000Z'
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

insert into articles (
  article_id, slug, category, tags, cover_image, status, is_pinned,
  view_count, created_at, updated_at, published_at
) values (
  'seed-update-2026-06-17-route-aware-welcome',
  '2026-06-17-route-aware-welcome',
  'site-updates',
  '["网站更新","文章","直链","欢迎窗"]',
  '',
  'published',
  0,
  0,
  '2026-06-17T16:02:00.000Z',
  '2026-06-17T16:02:00.000Z',
  '2026-06-17T16:02:00.000Z'
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

insert into articles (
  article_id, slug, category, tags, cover_image, status, is_pinned,
  view_count, created_at, updated_at, published_at
) values (
  'seed-update-2026-06-18-resource-actions',
  '2026-06-18-resource-actions',
  'site-updates',
  '["网站更新","资源区","占位按钮","安全渲染"]',
  '',
  'published',
  0,
  0,
  '2026-06-17T16:09:00.000Z',
  '2026-06-17T16:09:00.000Z',
  '2026-06-17T16:09:00.000Z'
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

insert into articles (
  article_id, slug, category, tags, cover_image, status, is_pinned,
  view_count, created_at, updated_at, published_at
) values (
  'seed-update-2026-06-18-nav-active-state',
  '2026-06-18-nav-active-state',
  'site-updates',
  '["网站更新","导航","任务栏","可访问性"]',
  '',
  'published',
  0,
  0,
  '2026-06-17T16:18:00.000Z',
  '2026-06-17T16:18:00.000Z',
  '2026-06-17T16:18:00.000Z'
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

insert into articles (
  article_id, slug, category, tags, cover_image, status, is_pinned,
  view_count, created_at, updated_at, published_at
) values (
  'seed-update-2026-06-18-blog-placeholders',
  '2026-06-18-blog-placeholders',
  'site-updates',
  '["网站更新","杂谈区","占位按钮","安全渲染"]',
  '',
  'published',
  0,
  0,
  '2026-06-17T16:23:00.000Z',
  '2026-06-17T16:23:00.000Z',
  '2026-06-17T16:23:00.000Z'
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

insert into articles (
  article_id, slug, category, tags, cover_image, status, is_pinned,
  view_count, created_at, updated_at, published_at
) values (
  'seed-update-2026-06-18-language-url-sync',
  '2026-06-18-language-url-sync',
  'site-updates',
  '["网站更新","多语言","链接分享","路由"]',
  '',
  'published',
  0,
  0,
  '2026-06-17T16:41:00.000Z',
  '2026-06-17T16:41:00.000Z',
  '2026-06-17T16:41:00.000Z'
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

insert into articles (
  article_id, slug, category, tags, cover_image, status, is_pinned,
  view_count, created_at, updated_at, published_at
) values (
  'seed-update-2026-06-18-article-detail-search-hide',
  '2026-06-18-article-detail-search-hide',
  'site-updates',
  '["网站更新","知识库","文章详情","阅读体验"]',
  '',
  'published',
  0,
  0,
  '2026-06-17T16:50:00.000Z',
  '2026-06-17T16:50:00.000Z',
  '2026-06-17T16:50:00.000Z'
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

insert into articles (
  article_id, slug, category, tags, cover_image, status, is_pinned,
  view_count, created_at, updated_at, published_at
) values (
  'seed-update-2026-06-18-trilingual-tags',
  '2026-06-18-trilingual-tags',
  'site-updates',
  '["网站更新","多语言","标签","知识库"]',
  '',
  'published',
  0,
  0,
  '2026-06-17T16:56:00.000Z',
  '2026-06-17T16:56:00.000Z',
  '2026-06-17T16:56:00.000Z'
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

insert into articles (
  article_id, slug, category, tags, cover_image, status, is_pinned,
  view_count, created_at, updated_at, published_at
) values (
  'seed-update-2026-06-18-image-loading-polish',
  '2026-06-18-image-loading-polish',
  'site-updates',
  '["网站更新","性能","阅读体验","移动端"]',
  '',
  'published',
  0,
  0,
  '2026-06-17T17:06:00.000Z',
  '2026-06-17T17:06:00.000Z',
  '2026-06-17T17:06:00.000Z'
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

insert into articles (
  article_id, slug, category, tags, cover_image, status, is_pinned,
  view_count, created_at, updated_at, published_at
) values (
  'seed-update-2026-06-18-chatroom-title-locale',
  '2026-06-18-chatroom-title-locale',
  'site-updates',
  '["网站更新","多语言","修复记录","移动端"]',
  '',
  'published',
  0,
  0,
  '2026-06-17T17:16:00.000Z',
  '2026-06-17T17:16:00.000Z',
  '2026-06-17T17:16:00.000Z'
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

insert into articles (
  article_id, slug, category, tags, cover_image, status, is_pinned,
  view_count, created_at, updated_at, published_at
) values (
  'seed-update-2026-06-18-aria-label-localization',
  '2026-06-18-aria-label-localization',
  'site-updates',
  '["网站更新","多语言","修复记录","移动端"]',
  '',
  'published',
  0,
  0,
  '2026-06-17T17:22:00.000Z',
  '2026-06-17T17:22:00.000Z',
  '2026-06-17T17:22:00.000Z'
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

insert into articles (
  article_id, slug, category, tags, cover_image, status, is_pinned,
  view_count, created_at, updated_at, published_at
) values (
  'seed-update-2026-06-18-account-widget-locale',
  '2026-06-18-account-widget-locale',
  'site-updates',
  '["网站更新","多语言","修复记录","移动端"]',
  '',
  'published',
  0,
  0,
  '2026-06-17T17:28:00.000Z',
  '2026-06-17T17:28:00.000Z',
  '2026-06-17T17:28:00.000Z'
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

insert into articles (
  article_id, slug, category, tags, cover_image, status, is_pinned,
  view_count, created_at, updated_at, published_at
) values (
  'seed-update-2026-06-18-notepad-menu-locale',
  '2026-06-18-notepad-menu-locale',
  'site-updates',
  '["网站更新","多语言","杂谈区","修复记录"]',
  '',
  'published',
  0,
  0,
  '2026-06-17T17:33:00.000Z',
  '2026-06-17T17:33:00.000Z',
  '2026-06-17T17:33:00.000Z'
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

insert into articles (
  article_id, slug, category, tags, cover_image, status, is_pinned,
  view_count, created_at, updated_at, published_at
) values (
  'seed-update-2026-06-18-game-cover-decoding',
  '2026-06-18-game-cover-decoding',
  'site-updates',
  '["网站更新","性能","游戏区","移动端"]',
  '',
  'published',
  0,
  0,
  '2026-06-17T17:38:00.000Z',
  '2026-06-17T17:38:00.000Z',
  '2026-06-17T17:38:00.000Z'
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

insert into articles (
  article_id, slug, category, tags, cover_image, status, is_pinned,
  view_count, created_at, updated_at, published_at
) values (
  'seed-update-2026-06-18-game-language-labels',
  '2026-06-18-game-language-labels',
  'site-updates',
  '["网站更新","多语言","游戏区","修复记录"]',
  '',
  'published',
  0,
  0,
  '2026-06-17T17:43:00.000Z',
  '2026-06-17T17:43:00.000Z',
  '2026-06-17T17:43:00.000Z'
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

insert into articles (
  article_id, slug, category, tags, cover_image, status, is_pinned,
  view_count, created_at, updated_at, published_at
) values (
  'seed-update-2026-06-18-game-shell-locale',
  '2026-06-18-game-shell-locale',
  'site-updates',
  '["网站更新","多语言","游戏区","云存档"]',
  '',
  'published',
  0,
  0,
  '2026-06-17T17:55:00.000Z',
  '2026-06-17T17:55:00.000Z',
  '2026-06-17T17:55:00.000Z'
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

insert into articles (
  article_id, slug, category, tags, cover_image, status, is_pinned,
  view_count, created_at, updated_at, published_at
) values (
  'seed-update-2026-06-18-resource-placeholder-hints',
  '2026-06-18-resource-placeholder-hints',
  'site-updates',
  '["网站更新","资源区","多语言","无障碍"]',
  '',
  'published',
  0,
  0,
  '2026-06-17T18:00:00.000Z',
  '2026-06-17T18:00:00.000Z',
  '2026-06-17T18:00:00.000Z'
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

insert into articles (
  article_id, slug, category, tags, cover_image, status, is_pinned,
  view_count, created_at, updated_at, published_at
) values (
  'seed-update-2026-06-18-video-thumb-decoding',
  '2026-06-18-video-thumb-decoding',
  'site-updates',
  '["网站更新","视频区","性能","图片"]',
  '',
  'published',
  0,
  0,
  '2026-06-17T18:07:00.000Z',
  '2026-06-17T18:07:00.000Z',
  '2026-06-17T18:07:00.000Z'
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

insert into articles (
  article_id, slug, category, tags, cover_image, status, is_pinned,
  view_count, created_at, updated_at, published_at
) values (
  'seed-update-2026-06-18-resource-label-sync',
  '2026-06-18-resource-label-sync',
  'site-updates',
  '["网站更新","资源区","多语言","界面"]',
  '',
  'published',
  0,
  0,
  '2026-06-17T18:10:00.000Z',
  '2026-06-17T18:10:00.000Z',
  '2026-06-17T18:10:00.000Z'
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

insert into articles (
  article_id, slug, category, tags, cover_image, status, is_pinned,
  view_count, created_at, updated_at, published_at
) values (
  'seed-update-2026-06-18-game-shell-safe-dom',
  '2026-06-18-game-shell-safe-dom',
  'site-updates',
  '["网站更新","游戏区","安全","云存档"]',
  '',
  'published',
  0,
  0,
  '2026-06-17T18:15:00.000Z',
  '2026-06-17T18:15:00.000Z',
  '2026-06-17T18:15:00.000Z'
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

insert into articles (
  article_id, slug, category, tags, cover_image, status, is_pinned,
  view_count, created_at, updated_at, published_at
) values (
  'seed-update-2026-06-18-account-safe-dom',
  '2026-06-18-account-safe-dom',
  'site-updates',
  '["网站更新","账号","安全","云存档"]',
  '',
  'published',
  0,
  0,
  '2026-06-17T18:20:00.000Z',
  '2026-06-17T18:20:00.000Z',
  '2026-06-17T18:20:00.000Z'
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
insert into articles (
  article_id, slug, category, tags, cover_image, status, is_pinned,
  view_count, created_at, updated_at, published_at
) values (
  'seed-update-2026-06-15-cloud-speed-smoothness',
  '2026-06-15-cloud-speed-smoothness',
  'site-updates',
  '["网站更新","首页","动态壁纸","性能"]',
  '',
  'published',
  0,
  0,
  '2026-06-15T12:41:45.000Z',
  '2026-06-15T12:41:45.000Z',
  '2026-06-15T12:41:45.000Z'
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

insert into articles (
  article_id, slug, category, tags, cover_image, status, is_pinned,
  view_count, created_at, updated_at, published_at
) values (
  'seed-update-2026-06-15-managed-video-system',
  '2026-06-15-managed-video-system',
  'site-updates',
  '["网站更新","视频区","后台"]',
  '',
  'published',
  0,
  0,
  '2026-06-15T08:30:00.000Z',
  '2026-06-15T08:30:00.000Z',
  '2026-06-15T08:30:00.000Z'
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

insert into articles (
  article_id, slug, category, tags, cover_image, status, is_pinned,
  view_count, created_at, updated_at, published_at
) values (
  'seed-update-2026-06-18-recent-updates-safe-dom',
  '2026-06-18-recent-updates-safe-dom',
  'site-updates',
  '["网站更新","首页","最近更新","安全"]',
  '',
  'published',
  0,
  0,
  '2026-06-17T18:40:00.000Z',
  '2026-06-17T18:40:00.000Z',
  '2026-06-17T18:40:00.000Z'
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

insert into articles (
  article_id, slug, category, tags, cover_image, status, is_pinned,
  view_count, created_at, updated_at, published_at
) values (
  'seed-update-2026-06-18-knowledge-list-safe-dom',
  '2026-06-18-knowledge-list-safe-dom',
  'site-updates',
  '["网站更新","知识库","安全","文章"]',
  '',
  'published',
  0,
  0,
  '2026-06-17T18:45:00.000Z',
  '2026-06-17T18:45:00.000Z',
  '2026-06-17T18:45:00.000Z'
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

insert into articles (
  article_id, slug, category, tags, cover_image, status, is_pinned,
  view_count, created_at, updated_at, published_at
) values (
  'seed-update-2026-06-18-knowledge-filters-safe-dom',
  '2026-06-18-knowledge-filters-safe-dom',
  'site-updates',
  '["网站更新","知识库","筛选","安全"]',
  '',
  'published',
  0,
  0,
  '2026-06-17T18:55:00.000Z',
  '2026-06-17T18:55:00.000Z',
  '2026-06-17T18:55:00.000Z'
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

insert into articles (
  article_id, slug, category, tags, cover_image, status, is_pinned,
  view_count, created_at, updated_at, published_at
) values (
  'seed-update-2026-06-18-resource-filters-safe-dom',
  '2026-06-18-resource-filters-safe-dom',
  'site-updates',
  '["网站更新","资源区","筛选","安全"]',
  '',
  'published',
  0,
  0,
  '2026-06-17T19:05:00.000Z',
  '2026-06-17T19:05:00.000Z',
  '2026-06-17T19:05:00.000Z'
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

insert into articles (
  article_id, slug, category, tags, cover_image, status, is_pinned,
  view_count, created_at, updated_at, published_at
) values (
  'seed-update-2026-06-18-game-list-safe-dom',
  '2026-06-18-game-list-safe-dom',
  'site-updates',
  '["网站更新","游戏区","安全","渲染"]',
  '',
  'published',
  0,
  0,
  '2026-06-17T19:20:00.000Z',
  '2026-06-17T19:20:00.000Z',
  '2026-06-17T19:20:00.000Z'
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

insert into articles (
  article_id, slug, category, tags, cover_image, status, is_pinned,
  view_count, created_at, updated_at, published_at
) values (
  'seed-update-2026-06-18-game-url-allowlist',
  '2026-06-18-game-url-allowlist',
  'site-updates',
  '["网站更新","游戏区","链接","安全"]',
  '',
  'published',
  0,
  0,
  '2026-06-17T19:35:00.000Z',
  '2026-06-17T19:35:00.000Z',
  '2026-06-17T19:35:00.000Z'
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

insert into articles (
  article_id, slug, category, tags, cover_image, status, is_pinned,
  view_count, created_at, updated_at, published_at
) values (
  'seed-update-2026-06-18-video-url-allowlist',
  '2026-06-18-video-url-allowlist',
  'site-updates',
  '["网站更新","视频区","链接","安全"]',
  '',
  'published',
  0,
  0,
  '2026-06-17T19:50:00.000Z',
  '2026-06-17T19:50:00.000Z',
  '2026-06-17T19:50:00.000Z'
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
  ('seed-update-2026-06-18-knowledge-filters-safe-dom-zh', 'seed-update-2026-06-18-knowledge-filters-safe-dom', 'zh', '知识库筛选安全渲染', '知识库分类筛选按钮改为 DOM/textContent 构建。', '# 知识库筛选安全渲染

本次更新继续收紧公开知识库，把分类筛选按钮从字符串拼接改为 DOM / `textContent` 构建。

## 更新内容

- 知识库分类按钮现在通过 `document.createElement(''button'')` 创建，分类名用 `textContent` 写入。
- `data-filter`、`data-filter-type`、active 状态和点击筛选行为保持不变。
- 和上一轮文章卡片 DOM 渲染配合后，知识库列表与筛选控件都不再依赖文章/分类字符串拼接输出。
- 本轮只调整公开知识库筛选控件和更新记录，不触碰后台目录或管理接口。', '2026-06-17T18:55:00.000Z', '2026-06-17T18:55:00.000Z'),
  ('seed-update-2026-06-18-knowledge-filters-safe-dom-en', 'seed-update-2026-06-18-knowledge-filters-safe-dom', 'en', 'Knowledge Filters Safe DOM', 'Knowledge category filter buttons now render through DOM/textContent.', '# Knowledge Filters Safe DOM

This update keeps tightening the public Knowledge area by changing category filter buttons from string-built markup to DOM / `textContent` construction.

## Changes

- Knowledge category buttons are now created with `document.createElement(''button'')`, with labels assigned through `textContent`.
- `data-filter`, `data-filter-type`, active state, and click filtering behavior are unchanged.
- Together with the previous article-card DOM rendering pass, the Knowledge list and filter controls no longer rely on article/category string-built output.
- Only the public Knowledge filter controls and update records changed; admin folders and admin APIs were not touched.', '2026-06-17T18:55:00.000Z', '2026-06-17T18:55:00.000Z'),
  ('seed-update-2026-06-18-knowledge-filters-safe-dom-ja', 'seed-update-2026-06-18-knowledge-filters-safe-dom', 'ja', '知識庫フィルターの安全な DOM 描画', '知識庫カテゴリーフィルターを DOM/textContent 構築にしました。', '# 知識庫フィルターの安全な DOM 描画

今回の更新では、公開知識庫をさらに引き締め、カテゴリーフィルターボタンを文字列連結から DOM / `textContent` 構築へ変更しました。

## 更新内容

- 知識庫カテゴリーボタンは `document.createElement(''button'')` で作成し、ラベルは `textContent` で入れます。
- `data-filter`、`data-filter-type`、active 状態、クリック絞り込み動作は変えていません。
- 前回の記事カード DOM 描画と合わせて、知識庫リストとフィルター操作は記事/カテゴリ文字列の組み立て出力に依存しなくなりました。
- 公開知識庫フィルターと更新記録だけを調整し、管理画面ディレクトリや管理 API には触れていません。', '2026-06-17T18:55:00.000Z', '2026-06-17T18:55:00.000Z')
on conflict(article_id, lang) do update set
  title = excluded.title,
  summary = excluded.summary,
  content_markdown = excluded.content_markdown,
  updated_at = excluded.updated_at;

insert into article_translations (
  translation_id, article_id, lang, title, summary, content_markdown, created_at, updated_at
) values
  ('seed-update-2026-06-18-video-url-allowlist-zh', 'seed-update-2026-06-18-video-url-allowlist', 'zh', '视频链接白名单', '视频缩略图、原地址和播放器 iframe 补充前端白名单。', '# 视频链接白名单

本次更新继续收紧公开主站视频区，让视频缩略图、原地址和播放器 iframe 在前端也经过白名单校验。

## 更新内容

- 视频卡片缩略图只接受 YouTube / Bilibili 图片域或后台上传的本地 `data:image` 封面。
- “打开原地址”只接受 YouTube、Bilibili 和 b23 链接，无效 URL 会隐藏按钮。
- 播放器 iframe 只接受 YouTube embed 或 Bilibili player 地址，无效 embed 会显示原有不支持提示。
- 公开视频 API、后台视频管理、视频空状态和移动端布局保持不变。', '2026-06-17T19:50:00.000Z', '2026-06-17T19:50:00.000Z'),
  ('seed-update-2026-06-18-video-url-allowlist-en', 'seed-update-2026-06-18-video-url-allowlist', 'en', 'Video Link Allowlist', 'Video thumbnails, source links, and player iframes now have frontend allowlist checks.', '# Video Link Allowlist

This update keeps tightening the public Videos area by validating video thumbnails, source links, and player iframes on the frontend too.

## Changes

- Video card thumbnails only accept YouTube / Bilibili image hosts or local `data:image` thumbnails uploaded through the admin flow.
- Open Original only accepts YouTube, Bilibili, and b23 links; invalid URLs hide the button.
- Player iframes only accept YouTube embed or Bilibili player URLs; invalid embeds fall back to the existing unsupported-video notice.
- Public video APIs, admin video management, the empty video state, and mobile layout are unchanged.', '2026-06-17T19:50:00.000Z', '2026-06-17T19:50:00.000Z'),
  ('seed-update-2026-06-18-video-url-allowlist-ja', 'seed-update-2026-06-18-video-url-allowlist', 'ja', '動画リンク許可リスト', '動画サムネイル、元リンク、プレイヤー iframe にフロント側の許可リスト確認を追加しました。', '# 動画リンク許可リスト

今回の更新では、公開動画欄をさらに引き締め、動画サムネイル、元リンク、プレイヤー iframe をフロント側でも許可リストで確認します。

## 更新内容

- 動画カードのサムネイルは YouTube / Bilibili の画像ホスト、または管理画面でアップロードされたローカル `data:image` 封面だけを受け付けます。
- 「元のページを開く」は YouTube、Bilibili、b23 リンクだけを受け付け、無効な URL ではボタンを隠します。
- プレイヤー iframe は YouTube embed または Bilibili player の URL だけを受け付け、無効な embed は既存の未対応表示へ戻します。
- 公開動画 API、管理画面の動画管理、動画空状態、モバイル表示は変更していません。', '2026-06-17T19:50:00.000Z', '2026-06-17T19:50:00.000Z')
on conflict(article_id, lang) do update set
  title = excluded.title,
  summary = excluded.summary,
  content_markdown = excluded.content_markdown,
  updated_at = excluded.updated_at;

insert into article_translations (
  translation_id, article_id, lang, title, summary, content_markdown, created_at, updated_at
) values
  ('seed-update-2026-06-18-resource-url-allowlist-zh', 'seed-update-2026-06-18-resource-url-allowlist', 'zh', '资源链接白名单', '资源下载和外链 URL 增加更严格的前端白名单。', '# 资源链接白名单

本次更新继续收紧公开主站资源区，让资源下载和外链地址在渲染前经过更明确的 URL 白名单。

## 更新内容

- 资源区下载/外链 URL 先经过 `safeHttpUrl()` 规范化，只接受 `http(s)` 外链。
- 本地资源路径只接受安全的 `assets/` 或 `downloads/` 路径，并拒绝 `..` 路径穿越片段。
- 无效 URL 继续显示原有的准备中按钮，不会输出不可信链接。
- 现有 3 个资源占位卡、分类筛选、移动端布局和后台目录保持不变。', '2026-06-17T20:05:00.000Z', '2026-06-17T20:05:00.000Z'),
  ('seed-update-2026-06-18-resource-url-allowlist-en', 'seed-update-2026-06-18-resource-url-allowlist', 'en', 'Resource URL Allowlist', 'Resource downloads and external links now use stricter frontend URL allowlist checks.', '# Resource URL Allowlist

This update keeps tightening the public Resources area by checking resource download and external-link URLs against a clearer frontend allowlist before rendering.

## Changes

- Resource download and external URLs now pass through `safeHttpUrl()` normalization and only accept `http(s)` external links.
- Local resource paths only accept safe `assets/` or `downloads/` paths and reject `..` traversal segments.
- Invalid URLs keep showing the existing coming-soon button instead of writing untrusted links into the page.
- The three current resource placeholder cards, category filters, mobile layout, and admin folders are unchanged.', '2026-06-17T20:05:00.000Z', '2026-06-17T20:05:00.000Z'),
  ('seed-update-2026-06-18-resource-url-allowlist-ja', 'seed-update-2026-06-18-resource-url-allowlist', 'ja', 'リソースURL許可リスト', 'リソースのダウンロードと外部リンクに、より厳しいフロント側URL許可リスト確認を追加しました。', '# リソースURL許可リスト

今回の更新では、公開リソース欄をさらに引き締め、リソースのダウンロードと外部リンクの URL を描画前により明確な許可リストで確認します。

## 更新内容

- リソースのダウンロード/外部 URL は `safeHttpUrl()` で正規化し、外部リンクは `http(s)` のみ受け付けます。
- ローカルリソースパスは安全な `assets/` または `downloads/` パスだけを受け付け、`..` のパストラバーサル片を拒否します。
- 無効な URL は既存の準備中ボタンを表示し続け、不審なリンクをページに出力しません。
- 既存 3 件のリソース占位カード、カテゴリーフィルター、モバイル表示、管理画面ディレクトリは変更していません。', '2026-06-17T20:05:00.000Z', '2026-06-17T20:05:00.000Z')
on conflict(article_id, lang) do update set
  title = excluded.title,
  summary = excluded.summary,
  content_markdown = excluded.content_markdown,
  updated_at = excluded.updated_at;

insert into article_translations (
  translation_id, article_id, lang, title, summary, content_markdown, created_at, updated_at
) values
  ('seed-update-2026-06-18-article-image-path-guard-zh', 'seed-update-2026-06-18-article-image-path-guard', 'zh', '文章图片路径守卫', '文章 Markdown 配图白名单补充路径穿越片段拒绝。', '# 文章图片路径守卫

本次更新继续收紧公开知识库的文章图片渲染规则，让 Markdown 配图路径更明确地留在项目文章图片目录内。

## 更新内容

- 文章 Markdown 图片仍只允许 `assets/images/articles/` 下的项目资源。
- `safeArticleImageSrc()` 新增 `..` 路径片段拒绝，避免图片路径逃出文章图片目录。
- 图片仍通过 `document.createElement(''img'')`、安全 `src`、`alt` 和 `figcaption` 渲染，不插入未处理 HTML。
- 现有 AI Agent 长文配图、知识库列表、文章直链和后台目录保持不变。', '2026-06-17T20:20:00.000Z', '2026-06-17T20:20:00.000Z'),
  ('seed-update-2026-06-18-article-image-path-guard-en', 'seed-update-2026-06-18-article-image-path-guard', 'en', 'Article Image Path Guard', 'Markdown article image allowlist now rejects traversal path segments.', '# Article Image Path Guard

This update keeps tightening public Knowledge article image rendering so Markdown image paths stay clearly inside the project article-image folder.

## Changes

- Markdown article images are still limited to project assets under `assets/images/articles/`.
- `safeArticleImageSrc()` now rejects `..` traversal segments so image paths cannot escape the article-image folder.
- Images still render through `document.createElement(''img'')`, safe `src`, `alt`, and `figcaption` instead of raw HTML insertion.
- The existing AI Agent article images, Knowledge list, article deep links, and admin folders are unchanged.', '2026-06-17T20:20:00.000Z', '2026-06-17T20:20:00.000Z'),
  ('seed-update-2026-06-18-article-image-path-guard-ja', 'seed-update-2026-06-18-article-image-path-guard', 'ja', '記事画像パスガード', 'Markdown 記事画像の許可リストが、パストラバーサル片を拒否するようになりました。', '# 記事画像パスガード

今回の更新では、公開知識庫の記事画像描画をさらに引き締め、Markdown 画像パスがプロジェクトの記事画像フォルダ内に留まるよう明確にしました。

## 更新内容

- Markdown 記事画像は引き続き `assets/images/articles/` 配下のプロジェクト資源だけを受け付けます。
- `safeArticleImageSrc()` が `..` のパストラバーサル片を拒否し、画像パスが記事画像フォルダから外へ出ないようにしました。
- 画像は今後も `document.createElement(''img'')`、安全な `src`、`alt`、`figcaption` で描画し、未処理 HTML は挿入しません。
- 既存の AI Agent 長文画像、知識庫一覧、記事直リンク、管理画面ディレクトリは変更していません。', '2026-06-17T20:20:00.000Z', '2026-06-17T20:20:00.000Z')
on conflict(article_id, lang) do update set
  title = excluded.title,
  summary = excluded.summary,
  content_markdown = excluded.content_markdown,
  updated_at = excluded.updated_at;

insert into article_translations (
  translation_id, article_id, lang, title, summary, content_markdown, created_at, updated_at
) values
  ('seed-update-2026-06-18-resource-empty-state-zh', 'seed-update-2026-06-18-resource-empty-state', 'zh', '资源空分类提示', '资源区空分类现在会显示三语空状态和返回全部资源按钮。', '# 资源空分类提示

本次更新继续整理资源区筛选体验，点击暂无资源的分类时不再只看到空白列表。

## 更新内容

- 资源区空分类会显示 XP 风格空状态，说明该分类仍在整理中。
- 空状态提供“显示全部资源”按钮，可直接回到全部资源列表。
- 标题、说明和按钮都通过 DOM / `textContent` 构建，不插入未处理 HTML。
- 本轮只调整公开资源区、前端样式、缓存版本和更新记录；后台目录和管理 API 不受影响。', '2026-06-17T23:58:00.000Z', '2026-06-17T23:58:00.000Z'),
  ('seed-update-2026-06-18-resource-empty-state-en', 'seed-update-2026-06-18-resource-empty-state', 'en', 'Resource Empty Category State', 'Empty resource categories now show a trilingual empty state with a button back to all resources.', '# Resource Empty Category State

This update keeps polishing the Resources filter flow so categories with no items no longer leave a blank list behind.

## Changes

- Empty resource categories now show an XP-style empty state explaining that the category is still being organized.
- The empty state includes a `Show all resources` button that returns the filter to the full list.
- The title, copy, and button are built through DOM / `textContent`, with no raw HTML insertion.
- This round only changes the public Resources area, frontend styling, cache version, and update records; admin folders and admin APIs are untouched.', '2026-06-17T23:58:00.000Z', '2026-06-17T23:58:00.000Z'),
  ('seed-update-2026-06-18-resource-empty-state-ja', 'seed-update-2026-06-18-resource-empty-state', 'ja', 'リソース空分類表示', '空のリソース分類に三言語の空状態とすべてへ戻るボタンを表示します。', '# リソース空分類表示

今回の更新ではリソース欄のフィルター体験を整え、項目がない分類でも空白だけにならないようにしました。

## 更新内容

- 空のリソース分類では XP 風の空状態を表示し、その分類が整理中であることを伝えます。
- 空状態には「すべてのリソースを表示」ボタンを追加し、全件表示へ戻れるようにしました。
- タイトル、説明、ボタンは DOM / `textContent` で構築し、未処理 HTML は挿入しません。
- 今回は公開リソース欄、フロント側スタイル、キャッシュ版、更新記録だけを調整し、管理画面や管理 API には触れていません。', '2026-06-17T23:58:00.000Z', '2026-06-17T23:58:00.000Z'),
  ('seed-update-2026-06-18-resource-filter-counts-zh', 'seed-update-2026-06-18-resource-filter-counts', 'zh', '资源分类数量徽标', '资源区分类按钮现在显示每类资源数量，筛选前就能看到占位和资源分布。', '# 资源分类数量徽标

本次更新继续整理资源区，让分类筛选按钮直接显示每一类里有多少资源项。

## 更新内容

- 资源区筛选按钮新增数量徽标：全部显示资源总数，各分类显示当前分类数量。
- 数量来自本地 `content.resources`，不会改变资源卡片、下载按钮或外链安全校验。
- 按钮继续通过 DOM / `textContent` 构建，分类名和数量都不会当作 HTML 插入。
- 本轮只调整公开资源区、前端样式、缓存版本和更新记录；后台目录和管理 API 不受影响。', '2026-06-17T23:55:00.000Z', '2026-06-17T23:55:00.000Z'),
  ('seed-update-2026-06-18-resource-filter-counts-en', 'seed-update-2026-06-18-resource-filter-counts', 'en', 'Resource Filter Counts', 'Resource category buttons now show item counts before filtering.', '# Resource Filter Counts

This update keeps polishing the Resources area by showing how many items sit behind each category filter.

## Changes

- Resource filter buttons now include compact count badges: All shows the total, and each category shows its own count.
- Counts come from local `content.resources`; resource cards, download buttons, and safe link checks are unchanged.
- Buttons still render through DOM / `textContent`, so category labels and counts are never inserted as HTML.
- This round only changes the public Resources area, frontend styling, cache version, and update records; admin folders and admin APIs are untouched.', '2026-06-17T23:55:00.000Z', '2026-06-17T23:55:00.000Z'),
  ('seed-update-2026-06-18-resource-filter-counts-ja', 'seed-update-2026-06-18-resource-filter-counts', 'ja', 'リソース分類数バッジ', 'リソース分類ボタンに件数を表示し、絞り込み前に配分が分かるようにしました。', '# リソース分類数バッジ

今回の更新ではリソース欄を少し整え、分類フィルターごとの件数をボタン上で分かるようにしました。

## 更新内容

- リソース分類ボタンに小さな件数バッジを追加しました。すべては総数、各分類はその分類の件数を表示します。
- 件数はローカルの `content.resources` から数え、リソースカード、ダウンロードボタン、リンク安全確認は変更しません。
- ボタンは引き続き DOM / `textContent` で構築し、分類名や件数を HTML として挿入しません。
- 今回は公開リソース欄、フロント側スタイル、キャッシュ版、更新記録だけを調整し、管理画面や管理 API には触れていません。', '2026-06-17T23:55:00.000Z', '2026-06-17T23:55:00.000Z'),
  ('seed-update-2026-06-18-resource-status-badges-zh', 'seed-update-2026-06-18-resource-status-badges', 'zh', '资源卡片状态徽标', '资源区卡片会显示准备中或可获取状态，下载按钮逻辑继续走安全链接校验。', '# 资源卡片状态徽标

本次更新继续整理资源区，让每张资源卡在按钮之外也能看到当前状态。

## 更新内容

- 资源卡片 meta row 新增状态徽标：没有安全 URL 时显示“准备中”，有可用 URL 时显示“可获取”。
- 状态判断复用 `safeResourceUrl()`，下载/外链按钮继续只接受安全项目路径或 `http(s)` 链接。
- 资源标题、简介、版本、大小和原有禁用按钮行为保持不变。
- 本轮只调整公开资源区、前端文案、样式和更新记录，不触碰后台目录或管理 API。', '2026-06-17T23:50:00.000Z', '2026-06-17T23:50:00.000Z'),
  ('seed-update-2026-06-18-resource-status-badges-en', 'seed-update-2026-06-18-resource-status-badges', 'en', 'Resource Status Badges', 'Resource cards now show pending or ready status badges while download actions still use safe link checks.', '# Resource Status Badges

This update continues polishing the Resources area so each card shows its current availability outside the action button too.

## Changes

- Resource card meta rows now include a status badge: `Coming soon` when no safe URL exists, and `Ready` when one is available.
- Status detection reuses `safeResourceUrl()`, so download/external actions still only accept safe project paths or `http(s)` links.
- Resource titles, summaries, versions, sizes, and disabled action behavior are unchanged.
- This round only changes the public Resources area, frontend text, styling, and update records; admin folders and admin APIs are untouched.', '2026-06-17T23:50:00.000Z', '2026-06-17T23:50:00.000Z'),
  ('seed-update-2026-06-18-resource-status-badges-ja', 'seed-update-2026-06-18-resource-status-badges', 'ja', 'リソース状態バッジ', 'リソースカードに準備中または利用可の状態バッジを追加し、リンク確認は従来どおりです。', '# リソース状態バッジ

今回の更新では、リソース欄を少し整え、各カードの状態をボタン以外からも分かるようにしました。

## 更新内容

- リソースカードの meta row に状態バッジを追加しました。安全な URL がない場合は「準備中」、利用できる URL がある場合は「利用可」を表示します。
- 状態判定は `safeResourceUrl()` を再利用し、ダウンロード/外部リンクは引き続き安全なプロジェクト内パスまたは `http(s)` のみ受け付けます。
- リソースのタイトル、概要、バージョン、サイズ、無効ボタンの動作は変更していません。
- 今回は公開リソース欄、フロント文言、スタイル、更新記録だけを調整し、管理画面ディレクトリや管理 API には触れていません。', '2026-06-17T23:50:00.000Z', '2026-06-17T23:50:00.000Z'),
  ('seed-update-2026-06-18-game-info-badges-zh', 'seed-update-2026-06-18-game-info-badges', 'zh', '游戏卡片信息增强', '游戏区卡片新增云存档和源码徽标，进入游戏前能看到保存与开源状态。', '# 游戏卡片信息增强

本次更新继续整理公开游戏区，让游戏入口卡片在进入前展示更清楚的状态信息。

## 更新内容

- 游戏卡片会根据 catalog 的 `storage` 字段显示“云存档”徽标。
- 有 `repo` 的游戏会显示“源码”链接，并且链接会先通过 `safeHttpUrl()` 校验，只接受 `http(s)`。
- 语言支持、license、开始按钮、iframe 入口和云存档同步逻辑保持不变。
- 本轮只调整公开游戏列表、前端文案、样式和更新记录，不触碰后台目录或管理 API。', '2026-06-17T23:35:00.000Z', '2026-06-17T23:35:00.000Z'),
  ('seed-update-2026-06-18-game-info-badges-en', 'seed-update-2026-06-18-game-info-badges', 'en', 'Game Card Info Badges', 'Game cards now show cloud-save and source badges before launch.', '# Game Card Info Badges

This update continues polishing the public games area so entry cards show clearer status before launch.

## Changes

- Game cards now show a `Cloud save` badge when the catalog entry declares storage keys or score storage.
- Games with a `repo` now show a `Source` link, with the URL normalized through `safeHttpUrl()` and limited to `http(s)`.
- Language support tags, license tags, start buttons, iframe entry points, and cloud-save sync behavior are unchanged.
- This round only changes the public game list, frontend text, styling, and update records; admin folders and admin APIs are untouched.', '2026-06-17T23:35:00.000Z', '2026-06-17T23:35:00.000Z'),
  ('seed-update-2026-06-18-game-info-badges-ja', 'seed-update-2026-06-18-game-info-badges', 'ja', 'ゲームカード情報バッジ', 'ゲームカードにクラウド保存とソースのバッジを追加し、起動前に状態を確認できます。', '# ゲームカード情報バッジ

今回の更新では、公開ゲーム欄を少し整え、起動前に入口カードで状態を確認しやすくしました。

## 更新内容

- catalog の `storage` があるゲームカードに「クラウド保存」バッジを表示します。
- `repo` があるゲームには「出典」リンクを表示し、URL は `safeHttpUrl()` で確認して `http(s)` のみ受け付けます。
- 言語対応タグ、ライセンスタグ、開始ボタン、iframe 入口、クラウド保存同期の動作は変更していません。
- 今回は公開ゲーム一覧、フロント文言、スタイル、更新記録だけを調整し、管理画面ディレクトリや管理 API には触れていません。', '2026-06-17T23:35:00.000Z', '2026-06-17T23:35:00.000Z'),
  ('seed-update-2026-06-18-article-scroll-top-zh', 'seed-update-2026-06-18-article-scroll-top', 'zh', '文章回到顶部按钮', '知识库文章详情新增回到顶部按钮，目录跳转后可以快速回到标题区。', '# 文章回到顶部按钮

本次更新继续整理知识库长文阅读工具，在文章详情动作区新增一个轻量的回到顶部按钮。

## 更新内容

- 文章详情复制链接按钮旁新增“回到顶部 / Back to top / 先頭へ戻る”三语按钮。
- 点击后只滚动当前文章详情容器，并同步阅读进度条，不改变页面路由或正文内容。
- 按钮使用现有 DOM 事件代理和 `data-i18n` 文案，不插入外部 HTML。
- 目录导航、Markdown 安全渲染、聊天和后台接口保持不变。', '2026-06-17T23:20:00.000Z', '2026-06-17T23:20:00.000Z'),
  ('seed-update-2026-06-18-article-scroll-top-en', 'seed-update-2026-06-18-article-scroll-top', 'en', 'Article Back-to-Top Button', 'Knowledge article details now include a back-to-top button after jumping through contents.', '# Article Back-to-Top Button

This update continues refining long-form Knowledge reading tools with a lightweight back-to-top action in article detail windows.

## Changes

- Article details now show a trilingual `回到顶部 / Back to top / 先頭へ戻る` button beside the copy-link action.
- Clicking it scrolls only the current article detail container and keeps the reading progress bar in sync, without changing the route or article body.
- The button uses the existing DOM event delegation and `data-i18n` text, with no external HTML insertion.
- Contents navigation, safe Markdown rendering, chat, and admin APIs are unchanged.', '2026-06-17T23:20:00.000Z', '2026-06-17T23:20:00.000Z'),
  ('seed-update-2026-06-18-article-scroll-top-ja', 'seed-update-2026-06-18-article-scroll-top', 'ja', '記事先頭へ戻るボタン', '知識庫の記事詳細に先頭へ戻るボタンを追加し、目次移動後に戻りやすくしました。', '# 記事先頭へ戻るボタン

今回の更新では、知識庫の長文閲覧ツールをもう少し整え、記事詳細の操作列に軽い先頭へ戻るボタンを追加しました。

## 更新内容

- 記事詳細のリンクコピーボタン横に `回到顶部 / Back to top / 先頭へ戻る` の三言語ボタンを追加しました。
- クリック時は現在の記事詳細コンテナだけを先頭へスクロールし、読書進捗バーも同期します。ルートや本文は変更しません。
- ボタンは既存の DOM イベント委譲と `data-i18n` 文言を使い、外部 HTML は挿入しません。
- 目次ナビ、安全な Markdown 描画、チャット、管理 API は変更していません。', '2026-06-17T23:20:00.000Z', '2026-06-17T23:20:00.000Z'),
  ('seed-update-2026-06-18-article-toc-zh', 'seed-update-2026-06-18-article-toc', 'zh', '文章目录导航', '知识库文章详情会按正文标题生成目录，长文可以快速跳到对应段落。', '# 文章目录导航

本次更新继续优化知识库长文阅读，在文章详情里新增由正文标题生成的目录导航。

## 更新内容

- 文章 Markdown 安全渲染完成后，会读取正文里的 `h2` / `h3` 标题生成目录按钮。
- 目录按钮使用 DOM / `textContent` 创建，并只允许滚动到 `article-heading-N` 这种内部目标。
- 少于两个标题的文章不会显示目录，避免短文多出无意义控件。
- 阅读进度条、复制链接、语言切换和后台目录保持不变。', '2026-06-17T23:05:00.000Z', '2026-06-17T23:05:00.000Z'),
  ('seed-update-2026-06-18-article-toc-en', 'seed-update-2026-06-18-article-toc', 'en', 'Article Contents Navigation', 'Knowledge article details now build a contents strip from body headings for quicker jumps.', '# Article Contents Navigation

This update continues improving long-form Knowledge reading with a contents strip generated from article body headings.

## Changes

- After safe Markdown rendering finishes, `h2` / `h3` headings are read and turned into contents buttons.
- Contents buttons are created through DOM / `textContent` and only scroll to internal `article-heading-N` targets.
- Articles with fewer than two headings hide the contents strip, so short posts do not gain extra controls.
- The reading progress bar, copy link, language switching, and admin folders are unchanged.', '2026-06-17T23:05:00.000Z', '2026-06-17T23:05:00.000Z'),
  ('seed-update-2026-06-18-article-toc-ja', 'seed-update-2026-06-18-article-toc', 'ja', '記事目次ナビ', '知識庫の記事詳細で本文見出しから目次を作り、長文の移動を速くしました。', '# 記事目次ナビ

今回の更新では、知識庫の長文を読みやすくするため、記事本文の見出しから作る目次ナビを追加しました。

## 更新内容

- 安全な Markdown 描画が終わったあと、本文内の `h2` / `h3` 見出しを読み取り、目次ボタンを生成します。
- 目次ボタンは DOM / `textContent` で作り、`article-heading-N` 形式の内部目標だけへスクロールします。
- 見出しが2つ未満の記事では目次を非表示にし、短い記事に余分な操作を増やしません。
- 読書進捗バー、リンクコピー、言語切り替え、管理画面ディレクトリは変更していません。', '2026-06-17T23:05:00.000Z', '2026-06-17T23:05:00.000Z'),
  ('seed-update-2026-06-18-article-progress-zh', 'seed-update-2026-06-18-article-progress', 'zh', '文章阅读进度条', '知识库文章详情新增阅读进度条，长文滚动时可以看到当前位置。', '# 文章阅读进度条

本次更新继续打磨知识库阅读体验，在文章详情窗口里加入一个轻量的阅读进度提示。

## 更新内容

- 文章详情头部下方新增三语“阅读进度”槽条和百分比。
- 长文滚动时进度条通过 `transform: scaleX()` 更新，不改变文章正文布局。
- 进度条的文字、数值和 `progressbar` 可访问状态都通过 DOM / `textContent` 更新。
- Markdown 正文仍使用安全渲染流程，后台目录和管理接口不受影响。', '2026-06-17T22:50:00.000Z', '2026-06-17T22:50:00.000Z'),
  ('seed-update-2026-06-18-article-progress-en', 'seed-update-2026-06-18-article-progress', 'en', 'Article Reading Progress', 'Knowledge article details now show a reading progress bar while long posts scroll.', '# Article Reading Progress

This update continues polishing the Knowledge reading experience with a lightweight progress indicator inside article detail windows.

## Changes

- Article details now show a trilingual reading-progress strip and percentage below the header.
- While long posts scroll, the fill updates with `transform: scaleX()` without changing the article body layout.
- The label, percentage, and `progressbar` accessibility state update through DOM / `textContent` paths.
- Markdown article content still uses the safe rendering flow, with admin folders and admin APIs untouched.', '2026-06-17T22:50:00.000Z', '2026-06-17T22:50:00.000Z'),
  ('seed-update-2026-06-18-article-progress-ja', 'seed-update-2026-06-18-article-progress', 'ja', '記事の読書進捗バー', '知識庫の記事詳細に読書進捗バーを追加し、長文スクロール中の位置が分かるようになりました。', '# 記事の読書進捗バー

今回の更新では、知識庫の記事詳細ウィンドウに軽い読書進捗表示を追加し、長文を読みやすくしました。

## 更新内容

- 記事詳細のヘッダー下に三言語の「読書進捗」バーとパーセント表示を追加しました。
- 長文スクロール時は `transform: scaleX()` でバーだけを更新し、本文レイアウトは動かしません。
- ラベル、数値、`progressbar` のアクセシビリティ状態は DOM / `textContent` 経由で更新します。
- Markdown 本文は引き続き安全な描画フローを使い、管理画面ディレクトリや管理 API には触れていません。', '2026-06-17T22:50:00.000Z', '2026-06-17T22:50:00.000Z'),
  ('seed-update-2026-06-18-article-link-lang-zh', 'seed-update-2026-06-18-article-link-lang', 'zh', '文章链接保留语言', '文章卡片和最近更新链接现在会带上当前 lang 参数。', '# 文章链接保留语言

本次更新继续整理公开文章入口，让复制链接、右键新开标签和普通点击保持一致的语言上下文。

## 更新内容

- 知识库文章卡片的真实 `href` 会带上当前 `lang` 参数。
- 欢迎窗口最近更新列表的文章链接也会带上当前 `lang` 参数，右键新开标签不会掉回默认语言。
- 文章详情里的“复制文章链接”复用同一条链接生成逻辑，继续输出当前语言直链。
- 点击拦截、文章安全渲染和后台目录保持不变。', '2026-06-17T22:20:00.000Z', '2026-06-17T22:20:00.000Z'),
  ('seed-update-2026-06-18-article-link-lang-en', 'seed-update-2026-06-18-article-link-lang', 'en', 'Article Links Keep Language', 'Article cards and recent-update links now include the active lang parameter.', '# Article Links Keep Language

This update keeps public article entry points aligned so copied links, new tabs, and normal clicks preserve the same language context.

## Changes

- Knowledge article card `href` values now include the active `lang` parameter.
- Welcome-window Recent Updates article links also include the active `lang`, so opening in a new tab does not fall back to the default language.
- The article detail copy-link button reuses the same link helper and still outputs a current-language deep link.
- Click interception, safe article rendering, and admin folders are unchanged.', '2026-06-17T22:20:00.000Z', '2026-06-17T22:20:00.000Z'),
  ('seed-update-2026-06-18-article-link-lang-ja', 'seed-update-2026-06-18-article-link-lang', 'ja', '記事リンクの言語保持', '記事カードと最近の更新リンクに現在の lang パラメータを含めました。', '# 記事リンクの言語保持

今回の更新では、公開記事への入口を整え、コピーしたリンク、新しいタブ、通常クリックで同じ言語コンテキストを保てるようにしました。

## 更新内容

- 知識庫の記事カードの実際の `href` に現在の `lang` パラメータを含めます。
- ウェルカム画面の最近の更新リンクにも現在の `lang` を含め、新しいタブで開いても既定言語に戻りません。
- 記事詳細の「記事リンクをコピー」ボタンも同じリンク生成処理を使い、現在言語の直リンクを出力します。
- クリック処理、安全な記事描画、管理画面ディレクトリは変更していません。', '2026-06-17T22:20:00.000Z', '2026-06-17T22:20:00.000Z')
on conflict(article_id, lang) do update set
  title = excluded.title,
  summary = excluded.summary,
  content_markdown = excluded.content_markdown,
  updated_at = excluded.updated_at;

insert into article_translations (
  translation_id, article_id, lang, title, summary, content_markdown, created_at, updated_at
) values
  ('seed-update-2026-06-18-recent-update-labels-zh', 'seed-update-2026-06-18-recent-update-labels', 'zh', '最近更新完整提示', '最近更新链接补充完整 title 和 aria-label，截断标题也能读到完整内容。', '# 最近更新完整提示

本次更新继续打磨欢迎窗口里的最近更新面板，让被截断的更新标题也能被完整读取。

## 更新内容

- 每条最近更新链接新增完整 `title` 和 `aria-label`，包含标题、摘要和日期。
- 屏幕上仍保留紧凑的截断标题与摘要，窗口布局和 XP 面板样式不变。
- 标题、摘要和日期继续通过 DOM / `textContent` 输出，不插入未处理 HTML。
- 本轮只调整公开最近更新面板、前端缓存版本和更新记录，不触碰后台目录或管理接口。', '2026-06-17T22:05:00.000Z', '2026-06-17T22:05:00.000Z'),
  ('seed-update-2026-06-18-recent-update-labels-en', 'seed-update-2026-06-18-recent-update-labels', 'en', 'Recent Update Full Labels', 'Recent update links now include full title and aria-label text when visible text is truncated.', '# Recent Update Full Labels

This update continues polishing the welcome-window Recent Updates panel so truncated update titles still expose the full context.

## Changes

- Each recent-update link now gets a full `title` and `aria-label` containing the title, summary, and date.
- The visible panel keeps its compact truncated title and summary, so the XP layout stays unchanged.
- Titles, summaries, and dates still render through DOM / `textContent`, with no raw HTML insertion.
- This round only changes the public Recent Updates panel, frontend cache version, and update records; admin folders and admin APIs are untouched.', '2026-06-17T22:05:00.000Z', '2026-06-17T22:05:00.000Z'),
  ('seed-update-2026-06-18-recent-update-labels-ja', 'seed-update-2026-06-18-recent-update-labels', 'ja', '最近の更新ラベル補足', '最近の更新リンクに完全な title と aria-label を追加しました。', '# 最近の更新ラベル補足

今回の更新では、ウェルカム画面の「最近の更新」パネルを少し整え、省略された更新タイトルでも内容を確認しやすくしました。

## 更新内容

- 各最近更新リンクに、タイトル・概要・日付を含む完全な `title` と `aria-label` を追加しました。
- 画面上はこれまで通りコンパクトな省略表示のまま、XP 風パネルのレイアウトは変更していません。
- タイトル、概要、日付は引き続き DOM / `textContent` で描画し、未処理 HTML は挿入しません。
- 今回は公開側の最近の更新パネル、フロントのキャッシュ版、更新記録だけを調整し、管理画面ディレクトリや管理 API には触れていません。', '2026-06-17T22:05:00.000Z', '2026-06-17T22:05:00.000Z')
on conflict(article_id, lang) do update set
  title = excluded.title,
  summary = excluded.summary,
  content_markdown = excluded.content_markdown,
  updated_at = excluded.updated_at;

insert into article_translations (
  translation_id, article_id, lang, title, summary, content_markdown, created_at, updated_at
) values
  ('seed-update-2026-06-18-static-image-dimensions-zh', 'seed-update-2026-06-18-static-image-dimensions', 'zh', '静态图片尺寸提示', '首屏和固定 UI 的静态图片补充了真实尺寸属性。', '# 静态图片尺寸提示

本次更新继续做轻量性能打磨，为公开主站里几处固定 UI 图片补充真实尺寸属性。

## 更新内容

- 顶部品牌头像、聊天室头像、关于页头像和底部 Start 图标新增 `width` / `height`。
- 属性使用图片自身像素尺寸，现有 CSS 展示尺寸和响应式布局保持不变。
- 浏览器可以在图片解码前预留稳定比例，减少首屏和固定 UI 的布局不确定性。
- 本轮只调整公开首页标记、更新记录和本地 fallback，不触碰后台目录或管理接口。', '2026-06-17T21:20:00.000Z', '2026-06-17T21:20:00.000Z'),
  ('seed-update-2026-06-18-static-image-dimensions-en', 'seed-update-2026-06-18-static-image-dimensions', 'en', 'Static Image Dimensions', 'Static images in the first-screen and fixed UI now declare real dimensions.', '# Static Image Dimensions

This update continues lightweight performance polish by adding real dimensions to several fixed UI images on the public site.

## Changes

- The top brand avatar, chat room avatar, about-page avatar, and bottom Start icon now declare `width` / `height`.
- The attributes use each image''s intrinsic pixel size; existing CSS display sizes and responsive behavior are unchanged.
- Browsers can reserve a stable ratio before image decoding, reducing layout uncertainty in the first-screen and fixed UI.
- This round only changes public homepage markup, update records, and local fallback data; admin folders and admin APIs are untouched.', '2026-06-17T21:20:00.000Z', '2026-06-17T21:20:00.000Z'),
  ('seed-update-2026-06-18-static-image-dimensions-ja', 'seed-update-2026-06-18-static-image-dimensions', 'ja', '静的画像サイズ指定', '初期画面と固定 UI の静的画像に実寸属性を追加しました。', '# 静的画像サイズ指定

今回の更新では、公開サイトの固定 UI 画像に実寸属性を追加し、軽量なパフォーマンス調整を続けました。

## 更新内容

- 上部ブランド画像、チャット画像、プロフィール画像、下部 Start アイコンに `width` / `height` を追加しました。
- 属性は画像本来のピクセルサイズを使い、既存 CSS の表示サイズとレスポンシブ挙動は変更していません。
- ブラウザーが画像デコード前に安定した比率を確保でき、初期画面と固定 UI のレイアウト揺れを減らします。
- 今回は公開ホームのマークアップ、更新記録、ローカル fallback のみを調整し、管理画面ディレクトリや管理 API には触れていません。', '2026-06-17T21:20:00.000Z', '2026-06-17T21:20:00.000Z')
on conflict(article_id, lang) do update set
  title = excluded.title,
  summary = excluded.summary,
  content_markdown = excluded.content_markdown,
  updated_at = excluded.updated_at;

insert into article_translations (
  translation_id, article_id, lang, title, summary, content_markdown, created_at, updated_at
) values
  ('seed-update-2026-06-18-article-tag-locales-zh', 'seed-update-2026-06-18-article-tag-locales', 'zh', '文章标签本地化', '公开知识库和站点更新标签补齐了更多三语显示。', '# 文章标签本地化

本次更新继续打磨知识库和站点更新的阅读细节，让更多公开文章标签跟随当前语言显示。

## 更新内容

- `tagLabels` 补齐安全、iframe、聊天室、云存档、筛选、图片、账号等常见标签。
- 知识库列表、文章详情和首页最近更新会继续通过 `articleTagName()` 输出对应语言标签。
- 标签仍由 DOM / `textContent` 渲染，不改变文章内容、文章接口或管理后台数据。
- `index.html` 的主脚本缓存版本已更新，帮助浏览器加载新的标签映射。', '2026-06-17T21:05:00.000Z', '2026-06-17T21:05:00.000Z'),
  ('seed-update-2026-06-18-article-tag-locales-en', 'seed-update-2026-06-18-article-tag-locales', 'en', 'Article Tag Locales', 'More public knowledge and site-update tags now have localized labels.', '# Article Tag Locales

This update continues polishing the reading details in the knowledge base and site update log so more public article tags follow the active language.

## Changes

- `tagLabels` now covers common tags such as security, iframe, chat room, cloud saves, filters, images, and account.
- The knowledge list, article detail view, and home recent updates continue to use `articleTagName()` for localized tag labels.
- Tags still render through DOM / `textContent`, with no change to article content, article APIs, or admin data.
- `index.html` now points at a new main-script cache version so browsers load the updated tag map.', '2026-06-17T21:05:00.000Z', '2026-06-17T21:05:00.000Z'),
  ('seed-update-2026-06-18-article-tag-locales-ja', 'seed-update-2026-06-18-article-tag-locales', 'ja', '記事タグのローカライズ', '公開知識庫とサイト更新のタグに、さらに多言語表示を追加しました。', '# 記事タグのローカライズ

今回の更新では、知識庫とサイト更新ログの読書細部をさらに整え、より多くの公開記事タグが現在の言語に合わせて表示されるようにしました。

## 更新内容

- `tagLabels` に安全、iframe、チャット、クラウド保存、フィルター、画像、アカウントなどの一般的なタグを追加しました。
- 知識庫一覧、記事詳細、ホームの最近更新は引き続き `articleTagName()` で言語別タグを表示します。
- タグは引き続き DOM / `textContent` で描画し、記事本文、記事 API、管理画面データは変更していません。
- `index.html` のメインスクリプトのキャッシュ版を更新し、新しいタグマップを読み込めるようにしました。', '2026-06-17T21:05:00.000Z', '2026-06-17T21:05:00.000Z')
on conflict(article_id, lang) do update set
  title = excluded.title,
  summary = excluded.summary,
  content_markdown = excluded.content_markdown,
  updated_at = excluded.updated_at;

insert into article_translations (
  translation_id, article_id, lang, title, summary, content_markdown, created_at, updated_at
) values
  ('seed-update-2026-06-18-game-frame-source-guard-zh', 'seed-update-2026-06-18-game-frame-source-guard', 'zh', '游戏 iframe 启动守卫', '游戏入口页会先校验 iframe 启动路径和语言参数名。', '# 游戏 iframe 启动守卫

本次更新继续收紧公开游戏入口页，让游戏 iframe 只从可信的本地 source 页面启动。

## 更新内容

- `game-shell.js` 新增 `safeGameSourceEntry()`，只接受 catalog 中的 `source/...html` 本地页面路径。
- `languageQueryParam` 新增格式校验，异常配置会回退到 `lang`，避免未校验参数名直接进入 iframe URL。
- 5 个游戏入口页更新 `game-shell.js` 缓存版本，确保浏览器加载新的守卫逻辑。
- 游戏列表、云存档、存档导入导出、语言选择和现有游戏内容保持不变。', '2026-06-17T20:50:00.000Z', '2026-06-17T20:50:00.000Z'),
  ('seed-update-2026-06-18-game-frame-source-guard-en', 'seed-update-2026-06-18-game-frame-source-guard', 'en', 'Game Frame Source Guard', 'Game entry pages now validate iframe launch paths and language query names first.', '# Game Frame Source Guard

This update tightens the public game entry pages so game iframes only launch trusted local source pages.

## Changes

- `game-shell.js` now includes `safeGameSourceEntry()`, accepting only local `source/...html` paths from the catalog.
- `languageQueryParam` is format-checked and falls back to `lang` when the catalog value is invalid.
- All five game entry pages now request a new `game-shell.js` cache version so browsers load the guard.
- The game list, cloud saves, save import/export, language selection, and existing game content are unchanged.', '2026-06-17T20:50:00.000Z', '2026-06-17T20:50:00.000Z'),
  ('seed-update-2026-06-18-game-frame-source-guard-ja', 'seed-update-2026-06-18-game-frame-source-guard', 'ja', 'ゲームフレーム起動ガード', 'ゲーム入口ページが iframe 起動パスと言語パラメータ名を先に確認します。', '# ゲームフレーム起動ガード

今回の更新では、公開ゲーム入口ページをさらに引き締め、ゲーム iframe が信頼できるローカル source ページだけから起動するようにしました。

## 更新内容

- `game-shell.js` に `safeGameSourceEntry()` を追加し、catalog の `source/...html` ローカルページだけを受け付けます。
- `languageQueryParam` は形式を確認し、無効な値は `lang` に戻します。
- 5 つのゲーム入口ページで `game-shell.js` のキャッシュ版を更新し、新しいガードを読み込ませます。
- ゲーム一覧、クラウド保存、セーブのインポート/エクスポート、言語選択、既存ゲーム内容は変更していません。', '2026-06-17T20:50:00.000Z', '2026-06-17T20:50:00.000Z')
on conflict(article_id, lang) do update set
  title = excluded.title,
  summary = excluded.summary,
  content_markdown = excluded.content_markdown,
  updated_at = excluded.updated_at;

insert into article_translations (
  translation_id, article_id, lang, title, summary, content_markdown, created_at, updated_at
) values
  ('seed-update-2026-06-18-chat-nickname-locale-zh', 'seed-update-2026-06-18-chat-nickname-locale', 'zh', '聊天室昵称本地化', '匿名聊天室的新随机昵称会跟随当前语言生成。', '# 聊天室昵称本地化

本次更新继续打磨公开匿名聊天室，让新访客拿到的随机昵称更贴合当前语言界面。

## 更新内容

- 前端请求 `/api/chat/nickname` 时会带上当前 `lang` 参数。
- 公开昵称接口按中文、English、日本語分别选择随机昵称词库。
- 接口不可用时，本地 fallback 也会使用当前语言对应的词库。
- 已保存或手动编辑过的昵称不会被强制替换，聊天室消息仍通过安全 DOM / `textContent` 渲染。', '2026-06-17T20:35:00.000Z', '2026-06-17T20:35:00.000Z'),
  ('seed-update-2026-06-18-chat-nickname-locale-en', 'seed-update-2026-06-18-chat-nickname-locale', 'en', 'Chat Nickname Locale', 'New anonymous chat random nicknames now follow the current language.', '# Chat Nickname Locale

This update continues polishing the public anonymous chat room so new visitors receive random nicknames that better match the current interface language.

## Changes

- The frontend now sends the current `lang` parameter when requesting `/api/chat/nickname`.
- The public nickname endpoint chooses separate nickname pools for Chinese, English, and Japanese.
- If the endpoint is unavailable, the local fallback also uses the current language pool.
- Saved or manually edited nicknames are not forcibly replaced, and chat messages still render through safe DOM / `textContent`.', '2026-06-17T20:35:00.000Z', '2026-06-17T20:35:00.000Z'),
  ('seed-update-2026-06-18-chat-nickname-locale-ja', 'seed-update-2026-06-18-chat-nickname-locale', 'ja', 'チャット名ロケール対応', '匿名チャットの新しいランダム名が現在の言語に合わせて生成されます。', '# チャット名ロケール対応

今回の更新では、公開匿名チャットをさらに磨き、新しい訪問者のランダム名が現在の表示言語に合うようにしました。

## 更新内容

- フロントエンドが `/api/chat/nickname` を呼ぶとき、現在の `lang` パラメータを送ります。
- 公開ニックネーム API は中国語、English、日本語ごとのランダム名リストを選びます。
- API が使えない場合のローカル fallback も、現在の言語リストを使います。
- 保存済み、または手動編集済みのニックネームは強制変更せず、チャットメッセージは引き続き安全な DOM / `textContent` で描画します。', '2026-06-17T20:35:00.000Z', '2026-06-17T20:35:00.000Z')
on conflict(article_id, lang) do update set
  title = excluded.title,
  summary = excluded.summary,
  content_markdown = excluded.content_markdown,
  updated_at = excluded.updated_at;

insert into article_translations (
  translation_id, article_id, lang, title, summary, content_markdown, created_at, updated_at
) values
  ('seed-update-2026-06-18-game-url-allowlist-zh', 'seed-update-2026-06-18-game-url-allowlist', 'zh', '游戏链接白名单', '游戏列表入口和封面路径补充白名单校验。', '# 游戏链接白名单

本次更新继续收紧公开主站游戏区，让游戏列表的入口链接和封面路径在渲染前经过白名单校验。

## 更新内容

- 本地游戏入口只接受 `games/catalog.json` 中的安全目录名，继续生成 `/games/<entry>?lang=...` 链接。
- 外部游戏链接和仓库链接只接受 `http(s)`，无效 URL 不会输出到页面。
- 游戏封面只接受 `assets/images/` 下的常见图片路径，无效封面会回退到游戏图标。
- 5 个现有游戏入口、iframe、云存档同步和导入导出逻辑保持不变。', '2026-06-17T19:35:00.000Z', '2026-06-17T19:35:00.000Z'),
  ('seed-update-2026-06-18-game-url-allowlist-en', 'seed-update-2026-06-18-game-url-allowlist', 'en', 'Game Link Allowlist', 'Game entry links and cover paths now use allowlist checks.', '# Game Link Allowlist

This update keeps tightening the public Games area by validating game entry links and cover paths before rendering them.

## Changes

- Local game entries only accept safe directory names from `games/catalog.json` and still produce `/games/<entry>?lang=...` links.
- External game links and repository links only accept `http(s)`, so invalid URLs are not written into the page.
- Game covers only accept common image paths under `assets/images/`; invalid covers fall back to the games icon.
- The five existing game entries, iframes, cloud-save sync, and import/export behavior are unchanged.', '2026-06-17T19:35:00.000Z', '2026-06-17T19:35:00.000Z'),
  ('seed-update-2026-06-18-game-url-allowlist-ja', 'seed-update-2026-06-18-game-url-allowlist', 'ja', 'ゲームリンク許可リスト', 'ゲーム入口リンクとカバー画像パスに許可リスト確認を追加しました。', '# ゲームリンク許可リスト

今回の更新では、公開ゲーム欄をさらに引き締め、ゲーム入口リンクとカバー画像パスを描画前に許可リストで確認します。

## 更新内容

- ローカルゲーム入口は `games/catalog.json` の安全なディレクトリ名だけを受け付け、引き続き `/games/<entry>?lang=...` リンクを生成します。
- 外部ゲームリンクとリポジトリリンクは `http(s)` のみ受け付け、無効な URL はページに出力しません。
- ゲームカバーは `assets/images/` 配下の一般的な画像パスのみ受け付け、無効な場合はゲームアイコンへ戻します。
- 既存 5 件のゲーム入口、iframe、クラウド保存同期、インポート/エクスポート動作は変更していません。', '2026-06-17T19:35:00.000Z', '2026-06-17T19:35:00.000Z')
on conflict(article_id, lang) do update set
  title = excluded.title,
  summary = excluded.summary,
  content_markdown = excluded.content_markdown,
  updated_at = excluded.updated_at;

insert into article_translations (
  translation_id, article_id, lang, title, summary, content_markdown, created_at, updated_at
) values
  ('seed-update-2026-06-18-game-list-safe-dom-zh', 'seed-update-2026-06-18-game-list-safe-dom', 'zh', '游戏列表安全渲染', '游戏区列表卡片改为 DOM/textContent 构建。', '# 游戏列表安全渲染

本次更新继续收紧公开主站游戏区，把游戏列表卡片从字符串模板改为 DOM / `textContent` 构建。

## 更新内容

- 游戏标题、简介、语言支持标签、许可证标签和加载/失败提示都改为 DOM 节点与文本节点输出。
- 游戏封面仍保留懒加载与异步解码，入口链接和外部链接打开方式保持不变。
- 游戏入口页、iframe、云存档同步、导入导出和游戏目录不变。
- 本轮只调整公开游戏列表和更新记录，不触碰后台目录或管理接口。', '2026-06-17T19:20:00.000Z', '2026-06-17T19:20:00.000Z'),
  ('seed-update-2026-06-18-game-list-safe-dom-en', 'seed-update-2026-06-18-game-list-safe-dom', 'en', 'Game List Safe DOM', 'Game list cards now render through DOM/textContent.', '# Game List Safe DOM

This update keeps tightening the public Games area by changing game-list cards from string templates to DOM / `textContent` construction.

## Changes

- Game titles, summaries, language-support tags, license tags, and loading/failure states now render through DOM nodes and text nodes.
- Game covers keep lazy loading and async decoding, and entry links plus external-link behavior are unchanged.
- Game entry pages, iframes, cloud-save sync, import/export, and the game catalog are unchanged.
- Only the public Games list and update records changed; admin folders and admin APIs were not touched.', '2026-06-17T19:20:00.000Z', '2026-06-17T19:20:00.000Z'),
  ('seed-update-2026-06-18-game-list-safe-dom-ja', 'seed-update-2026-06-18-game-list-safe-dom', 'ja', 'ゲーム一覧の安全な DOM 描画', 'ゲーム一覧カードを DOM/textContent 構築にしました。', '# ゲーム一覧の安全な DOM 描画

今回の更新では、公開ゲーム欄をさらに引き締め、ゲーム一覧カードを文字列テンプレートから DOM / `textContent` 構築へ変更しました。

## 更新内容

- ゲームタイトル、概要、言語対応タグ、ライセンスタグ、読み込み/失敗表示を DOM ノードとテキストノードで出力します。
- ゲームカバーの遅延読み込みと非同期デコード、入口リンク、外部リンクの開き方は変えていません。
- ゲーム入口ページ、iframe、クラウド保存同期、インポート/エクスポート、ゲームカタログは変更していません。
- 公開ゲーム一覧と更新記録だけを調整し、管理画面ディレクトリや管理 API には触れていません。', '2026-06-17T19:20:00.000Z', '2026-06-17T19:20:00.000Z')
on conflict(article_id, lang) do update set
  title = excluded.title,
  summary = excluded.summary,
  content_markdown = excluded.content_markdown,
  updated_at = excluded.updated_at;

insert into article_translations (
  translation_id, article_id, lang, title, summary, content_markdown, created_at, updated_at
) values
  ('seed-update-2026-06-18-resource-filters-safe-dom-zh', 'seed-update-2026-06-18-resource-filters-safe-dom', 'zh', '资源筛选安全渲染', '资源区分类筛选按钮改为 DOM/textContent 构建。', '# 资源筛选安全渲染

本次更新继续收紧公开主站资源区，把分类筛选按钮从字符串拼接改为 DOM / `textContent` 构建。

## 更新内容

- 资源区分类按钮现在通过 `document.createElement(''button'')` 创建，按钮文案用 `textContent` 写入。
- `data-filter`、`data-filter-type`、active 状态和点击筛选行为保持不变。
- 视频区筛选本来已经使用 DOM 构建，本轮只补齐通用资源筛选按钮。
- 本轮只调整公开资源区筛选控件和更新记录，不触碰后台目录或管理接口。', '2026-06-17T19:05:00.000Z', '2026-06-17T19:05:00.000Z'),
  ('seed-update-2026-06-18-resource-filters-safe-dom-en', 'seed-update-2026-06-18-resource-filters-safe-dom', 'en', 'Resource Filters Safe DOM', 'Resource category filter buttons now render through DOM/textContent.', '# Resource Filters Safe DOM

This update keeps tightening the public Resources area by changing category filter buttons from string-built markup to DOM / `textContent` construction.

## Changes

- Resource category buttons are now created with `document.createElement(''button'')`, with labels assigned through `textContent`.
- `data-filter`, `data-filter-type`, active state, and click filtering behavior are unchanged.
- Video filters were already DOM-built; this pass only completes the shared resource-filter path.
- Only the public Resources filter controls and update records changed; admin folders and admin APIs were not touched.', '2026-06-17T19:05:00.000Z', '2026-06-17T19:05:00.000Z'),
  ('seed-update-2026-06-18-resource-filters-safe-dom-ja', 'seed-update-2026-06-18-resource-filters-safe-dom', 'ja', 'リソースフィルターの安全な DOM 描画', 'リソースカテゴリーフィルターを DOM/textContent 構築にしました。', '# リソースフィルターの安全な DOM 描画

今回の更新では、公開リソース欄をさらに引き締め、カテゴリーフィルターボタンを文字列連結から DOM / `textContent` 構築へ変更しました。

## 更新内容

- リソースカテゴリーボタンは `document.createElement(''button'')` で作成し、ラベルは `textContent` で入れます。
- `data-filter`、`data-filter-type`、active 状態、クリック絞り込み動作は変えていません。
- 動画フィルターはすでに DOM 構築のため、本輪では共通のリソースフィルター経路だけを補いました。
- 公開リソースフィルターと更新記録だけを調整し、管理画面ディレクトリや管理 API には触れていません。', '2026-06-17T19:05:00.000Z', '2026-06-17T19:05:00.000Z')
on conflict(article_id, lang) do update set
  title = excluded.title,
  summary = excluded.summary,
  content_markdown = excluded.content_markdown,
  updated_at = excluded.updated_at;

insert into article_translations (
  translation_id, article_id, lang, title, summary, content_markdown, created_at, updated_at
) values
  ('seed-update-2026-06-18-knowledge-list-safe-dom-zh', 'seed-update-2026-06-18-knowledge-list-safe-dom', 'zh', '知识库列表安全渲染', '知识库文章列表改为 DOM/textContent 构建。', '# 知识库列表安全渲染

本次更新把公开知识库的文章卡片列表从字符串拼接改为 DOM / `textContent` 构建，继续降低公开文章字段进入页面时的 XSS 风险。

## 更新内容

- 文章标题、摘要、分类、标签、发布日期、fallback 提示和阅读按钮都改为 DOM 节点与文本节点输出。
- 搜索、分类筛选、文章详情直链和阅读按钮行为保持不变。
- 加载、失败、空列表和无搜索结果提示也改为纯文本节点渲染。
- 本轮只调整公开知识库列表和更新记录，不触碰后台目录或管理接口。', '2026-06-17T18:45:00.000Z', '2026-06-17T18:45:00.000Z'),
  ('seed-update-2026-06-18-knowledge-list-safe-dom-en', 'seed-update-2026-06-18-knowledge-list-safe-dom', 'en', 'Knowledge List Safe DOM', 'Knowledge article cards now render through DOM/textContent.', '# Knowledge List Safe DOM

This update changes the public Knowledge article-card list from string-built markup to DOM / `textContent` construction, reducing XSS risk as public article fields enter the page.

## Changes

- Article titles, summaries, categories, tags, published dates, fallback notices, and read buttons now render through DOM nodes and text nodes.
- Search, category filters, article deep links, and read-button behavior are unchanged.
- Loading, failure, empty-list, and no-result states also render as plain text nodes.
- Only the public Knowledge list and update records changed; admin folders and admin APIs were not touched.', '2026-06-17T18:45:00.000Z', '2026-06-17T18:45:00.000Z'),
  ('seed-update-2026-06-18-knowledge-list-safe-dom-ja', 'seed-update-2026-06-18-knowledge-list-safe-dom', 'ja', '知識庫リストの安全な DOM 描画', '知識庫の記事カードを DOM/textContent 構築にしました。', '# 知識庫リストの安全な DOM 描画

今回の更新では、公開知識庫の記事カード一覧を文字列連結から DOM / `textContent` 構築へ変更し、公開記事フィールドがページに入るときの XSS リスクをさらに下げます。

## 更新内容

- 記事タイトル、概要、カテゴリ、タグ、公開日、fallback 表示、読むボタンを DOM ノードとテキストノードで出力します。
- 検索、カテゴリ絞り込み、記事詳細直リンク、読むボタンの動作は変えていません。
- 読み込み中、失敗、空リスト、検索結果なしの表示も純テキストノードで描画します。
- 公開知識庫リストと更新記録だけを調整し、管理画面ディレクトリや管理 API には触れていません。', '2026-06-17T18:45:00.000Z', '2026-06-17T18:45:00.000Z')
on conflict(article_id, lang) do update set
  title = excluded.title,
  summary = excluded.summary,
  content_markdown = excluded.content_markdown,
  updated_at = excluded.updated_at;

insert into article_translations (
  translation_id, article_id, lang, title, summary, content_markdown, created_at, updated_at
) values
  ('seed-update-2026-06-18-recent-updates-safe-dom-zh', 'seed-update-2026-06-18-recent-updates-safe-dom', 'zh', '最近更新安全渲染', '首页最近更新列表改为 DOM/textContent 构建。', '# 最近更新安全渲染

本次更新把首页“最近更新”列表从字符串拼接改为 DOM / `textContent` 构建，让公开更新记录继续以纯文本方式渲染。

## 更新内容

- 最近更新的标题、摘要、日期和图标都改为 DOM 节点与文本节点输出，不再用模板字符串 `innerHTML` 组装列表。
- `site-updates` 工具图标、普通文章书本图标、本地 fallback 图标和文章直链行为保持不变。
- 列表仍显示最新 5 条站点更新；接口失败时仍回退到本地最近更新。
- 本轮只调整公开首页最近更新列表和更新记录，不触碰后台目录或管理接口。', '2026-06-17T18:40:00.000Z', '2026-06-17T18:40:00.000Z'),
  ('seed-update-2026-06-18-recent-updates-safe-dom-en', 'seed-update-2026-06-18-recent-updates-safe-dom', 'en', 'Recent Updates Safe DOM', 'The home recent-update list now renders through DOM/textContent.', '# Recent Updates Safe DOM

This update changes the home Recent Updates list from string-built markup to DOM / `textContent` construction, keeping public update records rendered as plain text.

## Changes

- Recent-update titles, summaries, dates, and icons now render through DOM nodes and text nodes instead of template-string `innerHTML`.
- The `site-updates` tool icon, regular article book fallback, local fallback icons, and article deep links are unchanged.
- The list still shows the latest five site updates and still falls back to local updates if the API fails.
- Only the public home Recent Updates list and update records changed; admin folders and admin APIs were not touched.', '2026-06-17T18:40:00.000Z', '2026-06-17T18:40:00.000Z'),
  ('seed-update-2026-06-18-recent-updates-safe-dom-ja', 'seed-update-2026-06-18-recent-updates-safe-dom', 'ja', '最近更新の安全な DOM 描画', 'ホームの最近更新リストを DOM/textContent 構築にしました。', '# 最近更新の安全な DOM 描画

今回の更新では、ホームの「最近更新」リストを文字列連結から DOM / `textContent` 構築へ変更し、公開更新記録を純テキストとして描画し続けます。

## 更新内容

- 最近更新のタイトル、概要、日付、アイコンはテンプレート文字列の `innerHTML` ではなく、DOM ノードとテキストノードで出力します。
- `site-updates` のツールアイコン、通常記事の本アイコン fallback、ローカル fallback アイコン、記事直リンクの動作は変えていません。
- リストは引き続き最新 5 件のサイト更新を表示し、API 失敗時はローカル最近更新へ戻ります。
- 公開ホームの最近更新リストと更新記録だけを調整し、管理画面ディレクトリや管理 API には触れていません。', '2026-06-17T18:40:00.000Z', '2026-06-17T18:40:00.000Z')
on conflict(article_id, lang) do update set
  title = excluded.title,
  summary = excluded.summary,
  content_markdown = excluded.content_markdown,
  updated_at = excluded.updated_at;

insert into article_translations (
  translation_id, article_id, lang, title, summary, content_markdown, created_at, updated_at
) values
  (
    'seed-update-2026-06-15-managed-video-system-zh',
    'seed-update-2026-06-15-managed-video-system',
    'zh',
    '视频区改造成可管理系统',
    '视频区现在支持后台管理 YouTube 和 Bilibili 链接，并可在站内播放。',
    '# 视频区改造成可管理系统

这次更新把原来的占位视频卡片改成真实的视频管理系统。

## 更新内容

- 后台新增视频管理，可以输入 YouTube、Bilibili 或 b23.tv 链接并自动识别平台。
- 服务端会规范化播放器地址，抓取标题、作者、简介和封面，并缓存到 D1。
- 主站视频区改为读取 `/api/videos`，分类标签由后台视频分类动态生成。
- 视频点击后在 XP 风格窗口内播放，不再跳转外站。
- 后台新增视频分类管理，可以新增、编辑、停用、排序和安全删除分类。',
    '2026-06-15T08:30:00.000Z',
    '2026-06-15T08:30:00.000Z'
  ),
  (
    'seed-update-2026-06-15-managed-video-system-en',
    'seed-update-2026-06-15-managed-video-system',
    'en',
    'Managed Video System',
    'The videos section now supports managed YouTube and Bilibili links with inline playback.',
    '# Managed Video System

This update turns the old placeholder video cards into a real managed video system.

## What changed

- The admin area can now create and edit videos from YouTube, Bilibili, or b23.tv links.
- The server normalizes embed URLs, fetches metadata, and caches title, author, description, and thumbnail data in D1.
- The public videos section now reads from `/api/videos`, with category tabs generated from admin-managed video categories.
- Videos open inside the XP-style site window instead of jumping to an external site.
- A new admin category manager supports creating, editing, disabling, sorting, and safely deleting video categories.',
    '2026-06-15T08:30:00.000Z',
    '2026-06-15T08:30:00.000Z'
  ),
  (
    'seed-update-2026-06-15-managed-video-system-ja',
    'seed-update-2026-06-15-managed-video-system',
    'ja',
    '動画欄を管理できる仕組みに変更',
    '動画欄で YouTube と Bilibili のリンクを管理し、サイト内で再生できるようになりました。',
    '# 動画欄を管理できる仕組みに変更

今回の更新で、仮置きだった動画カードを実際に管理できる動画システムに変更しました。

## 変更内容

- 管理画面から YouTube、Bilibili、b23.tv のリンクを登録できるようになりました。
- サーバー側で埋め込み URL を正規化し、タイトル、作者、説明、サムネイルを取得して D1 に保存します。
- 公開側の動画欄は `/api/videos` から読み込み、分類タブも管理画面の動画分類から生成します。
- 動画は外部サイトへ移動せず、XP 風のウィンドウ内で再生します。
- 動画分類の追加、編集、停止、並び替え、安全な削除に対応しました。',
    '2026-06-15T08:30:00.000Z',
    '2026-06-15T08:30:00.000Z'
  )
on conflict(article_id, lang) do update set
  title = excluded.title,
  summary = excluded.summary,
  content_markdown = excluded.content_markdown,
  updated_at = excluded.updated_at;

insert into article_translations (
  translation_id, article_id, lang, title, summary, content_markdown, created_at, updated_at
) values
  ('seed-update-2026-06-15-cloud-speed-smoothness-zh', 'seed-update-2026-06-15-cloud-speed-smoothness', 'zh', '云层漂移提速与流畅度优化', '首页四时段云层移动小幅加快，并优化合成层提示，减少卡顿和首帧跳动。', '# 云层漂移提速与流畅度优化

本次更新继续微调首页动态壁纸，让云层移动更容易被看见，同时保持慢速、像素风的桌面氛围。

## 更新内容

- 四个时间段的云层漂移周期小幅缩短，整体速度略微加快。
- 云层元素增加初始 `translate3d`、`backface-visibility`、`contain` 和动画填充设置，帮助浏览器更稳定地走合成层。
- 仍然只使用 CSS `transform` 和 `opacity`，保留减少动态、页面隐藏暂停和小屏静态降级。', '2026-06-15T12:41:45.000Z', '2026-06-15T12:41:45.000Z'),
  ('seed-update-2026-06-15-cloud-speed-smoothness-en', 'seed-update-2026-06-15-cloud-speed-smoothness', 'en', 'Smoother Cloud Drift', 'The home clouds now drift a little faster with compositor hints tuned for smoother frames.', '# Smoother Cloud Drift

This update keeps tuning the home wallpaper animation so the clouds are easier to notice while preserving the slow XP pixel desktop mood.

## Changes

- Slightly shortened the drift cycle for all four time-of-day cloud sets.
- Added initial `translate3d`, `backface-visibility`, `contain`, and animation fill settings to help browsers keep the clouds on stable compositor layers.
- The animation still only uses CSS `transform` and `opacity`, with reduced-motion, pause-on-hidden, and small-screen static fallbacks preserved.', '2026-06-15T12:41:45.000Z', '2026-06-15T12:41:45.000Z'),
  ('seed-update-2026-06-15-cloud-speed-smoothness-ja', 'seed-update-2026-06-15-cloud-speed-smoothness', 'ja', '雲レイヤーの速度と滑らかさを調整', 'ホームの4時間帯の雲移動を少し速め、合成レイヤー設定で初期フレームのずれを抑えました。', '# 雲レイヤーの速度と滑らかさを調整

今回の更新では、ホームの雲アニメーションを少しだけ見えやすくしながら、XP風の静かな雰囲気を保つように調整しました。

## 更新内容

- 4時間帯の雲レイヤーの移動周期を少し短くし、漂う速度をわずかに上げました。
- 雲要素に初期 `translate3d`、`backface-visibility`、`contain`、アニメーションの fill 設定を追加し、合成レイヤーを安定させました。
- CSS の `transform` と `opacity` だけで動かし、低モーション設定、ページ非表示時の一時停止、小画面での静的降級は維持しています。', '2026-06-15T12:41:45.000Z', '2026-06-15T12:41:45.000Z')
on conflict(article_id, lang) do update set
  title = excluded.title,
  summary = excluded.summary,
  content_markdown = excluded.content_markdown,
  updated_at = excluded.updated_at;
insert into articles (
  article_id, slug, category, tags, cover_image, status, is_pinned,
  view_count, created_at, updated_at, published_at
) values (
  'seed-update-2026-06-15-icons-cloud-fixes',
  '2026-06-15-icons-cloud-fixes',
  'site-updates',
  '["网站更新","图标","首页","动态壁纸"]',
  '',
  'published',
  0,
  0,
  '2026-06-15T13:49:12.000Z',
  '2026-06-15T13:49:12.000Z',
  '2026-06-15T13:49:12.000Z'
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

insert into articles (
  article_id, slug, category, tags, cover_image, status, is_pinned,
  view_count, created_at, updated_at, published_at
) values (
  'seed-update-2026-06-15-home-wallpaper-gap-fix',
  '2026-06-15-home-wallpaper-gap-fix',
  'site-updates',
  '["网站更新","首页","动态壁纸","布局修复"]',
  '',
  'published',
  0,
  0,
  '2026-06-15T15:08:00.000Z',
  '2026-06-15T15:08:00.000Z',
  '2026-06-15T15:08:00.000Z'
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

insert into articles (
  article_id, slug, category, tags, cover_image, status, is_pinned,
  view_count, created_at, updated_at, published_at
) values (
  'seed-update-2026-06-15-video-player-window-controls',
  '2026-06-15-video-player-window-controls',
  'site-updates',
  '["网站更新","视频区","播放器","交互修复"]',
  '',
  'published',
  0,
  0,
  '2026-06-15T15:30:00.000Z',
  '2026-06-15T15:30:00.000Z',
  '2026-06-15T15:30:00.000Z'
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

insert into articles (
  article_id, slug, category, tags, cover_image, status, is_pinned,
  view_count, created_at, updated_at, published_at
) values (
  'seed-update-2026-06-15-video-management-sort-metadata',
  '2026-06-15-video-management-sort-metadata',
  'site-updates',
  '["网站更新","视频区","后台","排序","Bilibili"]',
  '',
  'published',
  0,
  0,
  '2026-06-15T16:20:00.000Z',
  '2026-06-15T16:20:00.000Z',
  '2026-06-15T16:20:00.000Z'
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

insert into articles (
  article_id, slug, category, tags, cover_image, status, is_pinned,
  view_count, created_at, updated_at, published_at
) values (
  'seed-update-2026-06-16-mobile-admin-video-fixes',
  '2026-06-16-mobile-admin-video-fixes',
  'site-updates',
  '["网站更新","移动端","视频区","后台","Bilibili"]',
  '',
  'published',
  0,
  0,
  '2026-06-16T02:20:00.000Z',
  '2026-06-16T02:20:00.000Z',
  '2026-06-16T02:20:00.000Z'
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

insert into articles (
  article_id, slug, category, tags, cover_image, status, is_pinned,
  view_count, created_at, updated_at, published_at
) values (
  'seed-update-2026-06-16-responsive-video-window',
  '2026-06-16-responsive-video-window',
  'site-updates',
  '["网站更新","视频区","响应式布局","桌面端"]',
  '',
  'published',
  0,
  0,
  '2026-06-16T02:40:13.000Z',
  '2026-06-16T02:40:13.000Z',
  '2026-06-16T02:40:13.000Z'
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

insert into articles (
  article_id, slug, category, tags, cover_image, status, is_pinned,
  view_count, created_at, updated_at, published_at
) values (
  'seed-update-2026-06-16-video-card-category-icon-fixes',
  '2026-06-16-video-card-category-icon-fixes',
  'site-updates',
  '["网站更新","视频区","后台","桌面图标"]',
  '',
  'published',
  0,
  0,
  '2026-06-16T08:20:00.000Z',
  '2026-06-16T08:20:00.000Z',
  '2026-06-16T08:20:00.000Z'
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
  ('seed-update-2026-06-15-icons-cloud-fixes-zh', 'seed-update-2026-06-15-icons-cloud-fixes', 'zh', '窗口图标与云层残影修复', '补齐窗口/任务栏图标更新记录，并修复夜晚与黄昏动态壁纸 clean 底图里的云层残影。', '# 窗口图标与云层残影修复

本次更新把几项已经完成但还没有合并进公开更新文章的内容补到同一篇记录里，方便之后从知识库追踪。

## 更新内容

- 为知识库、视频区、资源区、游戏区、杂谈区、关于我补齐新的窗口标题栏图标和任务栏图标资源。
- 微调分区窗口左上角标题图标的显示盒子、缩放和垂直对齐，让图标在标题文字前更清楚。
- 修复夜晚动态壁纸 `base-clean.png` 里残留的中景云片，避免云层漂移后背景上留下分离的小云盖。
- 同步检查 morning / day / dusk / night 四个时段：morning 和 day 没有同类残留，dusk 的淡残影也已一并清理。
- 更新首页 CSS 缓存版本，减少浏览器继续加载旧图标样式或旧 clean 底图的可能。', '2026-06-15T13:49:12.000Z', '2026-06-15T13:49:12.000Z'),
  ('seed-update-2026-06-15-icons-cloud-fixes-en', 'seed-update-2026-06-15-icons-cloud-fixes', 'en', 'Window Icons and Cloud Cleanup', 'Added the missing icon update record and cleaned residual cloud fragments from the Night and Dusk wallpaper plates.', '# Window Icons and Cloud Cleanup

This update records a few shipped visual fixes that were not yet grouped into a public site update article.

## Changes

- Added new window titlebar and taskbar icon assets for Knowledge, Videos, Resources, Games, Talk, and About.
- Tuned the section title icon box, scale, and vertical alignment so the icons read more clearly before the title text.
- Cleaned the Night wallpaper `base-clean.png` plate so the moving mid-distance cloud no longer leaves a separated cap behind.
- Checked all four time-of-day wallpapers: Morning and Day did not show the same issue, while a faint Dusk remnant was cleaned at the same time.
- Updated the home CSS cache version to reduce the chance of browsers keeping older icon styles or clean plates.', '2026-06-15T13:49:12.000Z', '2026-06-15T13:49:12.000Z'),
  ('seed-update-2026-06-15-icons-cloud-fixes-ja', 'seed-update-2026-06-15-icons-cloud-fixes', 'ja', 'ウィンドウアイコンと雲の残影修正', '未記録だったアイコン更新を補い、夜と夕方の壁紙ベースに残った雲の跡を修正しました。', '# ウィンドウアイコンと雲の残影修正

今回の更新では、すでに反映済みだったいくつかの見た目の調整を、公開用の更新記事としてまとめて記録しました。

## 更新内容

- 知識庫、動画区、リソース区、ゲーム区、雑談区、About 用に、新しいウィンドウタイトルバーとタスクバーのアイコン素材を追加しました。
- セクションタイトル左側のアイコン表示枠、拡大率、縦位置を調整し、タイトル前のアイコンを見やすくしました。
- 夜の壁紙 `base-clean.png` に残っていた中景雲の小さな残片を修正し、雲が動いた後に背景へ切れ端が残らないようにしました。
- morning / day / dusk / night の4時間帯を確認し、morning と day には同種の残りはなく、dusk の薄い残影も同時に消しました。
- ホーム CSS のキャッシュ版を更新し、古いアイコン表示や古い clean ベース画像が残りにくいようにしました。', '2026-06-15T13:49:12.000Z', '2026-06-15T13:49:12.000Z')
on conflict(article_id, lang) do update set
  title = excluded.title,
  summary = excluded.summary,
  content_markdown = excluded.content_markdown,
  updated_at = excluded.updated_at;

insert into article_translations (
  translation_id, article_id, lang, title, summary, content_markdown, created_at, updated_at
) values
  ('seed-update-2026-06-15-home-wallpaper-gap-fix-zh', 'seed-update-2026-06-15-home-wallpaper-gap-fix', 'zh', '首页底部长条修复', '修复任务栏上方露出的绿色长条，四个时间段壁纸都会填满首页中间区域。', '# 首页底部长条修复

本次更新修复首页任务栏上方偶尔露出的绿色长条，让四个时间段的桌面壁纸和任务栏衔接更干净。

## 更新内容

- 确认绿色长条不是 night 壁纸图片里的像素，而是外层页面草地渐变从首页底部缝隙露出。
- 检查 morning、day、dusk、night 四个时间段，同一布局缝隙都会存在，只是白天和早晨更接近草色所以不明显。
- 首页中间区域现在直接填满站点网格剩余高度，不再用固定像素估算顶部栏和任务栏高度。
- 小屏分支也同步改为使用父级高度，避免移动端出现同类露底。', '2026-06-15T15:08:00.000Z', '2026-06-15T15:08:00.000Z'),
  ('seed-update-2026-06-15-home-wallpaper-gap-fix-en', 'seed-update-2026-06-15-home-wallpaper-gap-fix', 'en', 'Home Bottom Strip Fix', 'Fixed the green strip above the taskbar so every time-of-day wallpaper fills the home area.', '# Home Bottom Strip Fix

This update removes the green strip that could appear above the taskbar on the home screen.

## Changes

- Confirmed the strip was not part of the Night wallpaper image. It came from the outer page grass gradient showing through a small layout gap.
- Checked Morning, Day, Dusk, and Night. The same gap could exist in all themes, but it was most visible at night.
- The home page now fills the remaining site grid height instead of relying on a fixed pixel estimate for the top bar and taskbar.
- The small-screen rule now uses the same parent-height behavior to avoid the same exposed strip on mobile.', '2026-06-15T15:08:00.000Z', '2026-06-15T15:08:00.000Z'),
  ('seed-update-2026-06-15-home-wallpaper-gap-fix-ja', 'seed-update-2026-06-15-home-wallpaper-gap-fix', 'ja', 'ホーム下部ライン修正', 'タスクバー上の緑の線を修正し、4時間帯の壁紙がホーム領域を埋めるようにしました。', '# ホーム下部ライン修正

今回の更新では、ホーム画面のタスクバー上に出ることがあった緑の線を修正しました。

## 更新内容

- 緑の線は night 壁紙画像の一部ではなく、外側ページの草地グラデーションが小さな隙間から見えていたものだと確認しました。
- morning、day、dusk、night の4時間帯を確認し、同じ隙間は全テーマで起こり得ますが、夜がもっとも目立っていました。
- ホーム画面はトップバーとタスクバーの高さを固定値で推定せず、サイトのグリッド残り領域を埋めるようにしました。
- 小画面用の分岐も同じ高さルールにそろえ、モバイルでも同種の線が出にくいようにしました。', '2026-06-15T15:08:00.000Z', '2026-06-15T15:08:00.000Z'),
  ('seed-update-2026-06-15-video-player-window-controls-zh', 'seed-update-2026-06-15-video-player-window-controls', 'zh', '视频播放器窗口交互修复', '站内视频播放器修复了窗口全屏、原地址链接和 iframe 控制区误触问题。', '# 视频播放器窗口交互修复

本次更新集中修复视频区 XP 播放器窗口，让站内窗口控制和 YouTube / Bilibili 自带控制不再互相混淆。

## 更新内容

- 站内“全屏”改为标题栏右上角的 XP 风格最大化按钮，可再次点击或按 Escape 还原窗口。
- 不再优先对 iframe 执行浏览器 Fullscreen API，YouTube / Bilibili 自带全屏仍由播放器自己处理。
- 公开视频接口继续返回真实 `original_url`，所以“打开原地址”会打开 YouTube / Bilibili 原页面，而不是空链接或 embed 地址。
- iframe 顶部和底部信息层默认用站内遮罩收起，鼠标进入播放器区域时再露出平台控件。
- 底部空白区域增加透明点击防护，视频卡片的播放按钮热区也收窄到按钮本身，减少误触“保存到待看”等平台按钮。', '2026-06-15T15:30:00.000Z', '2026-06-15T15:30:00.000Z'),
  ('seed-update-2026-06-15-video-player-window-controls-en', 'seed-update-2026-06-15-video-player-window-controls', 'en', 'Video Player Window Controls', 'The embedded video window now separates site window controls from YouTube and Bilibili controls.', '# Video Player Window Controls

This update fixes the XP-style video player window so site-level controls no longer fight with YouTube or Bilibili''s own player controls.

## Changes

- The site fullscreen button is now a titlebar maximize/restore icon, and it can be toggled again or restored with Escape.
- The site no longer fullscreen-requests the iframe first; YouTube and Bilibili native fullscreen remains inside the embedded player.
- The public videos API keeps returning the real `original_url`, so Open Original goes to the source page instead of an empty or embed-only link.
- The iframe top and bottom information bars are covered by the site by default and revealed when the user moves over the player area.
- Transparent click blockers protect bottom blank areas, and video-card play buttons now only use the actual button as their hit target.', '2026-06-15T15:30:00.000Z', '2026-06-15T15:30:00.000Z'),
  ('seed-update-2026-06-15-video-player-window-controls-ja', 'seed-update-2026-06-15-video-player-window-controls', 'ja', '動画プレイヤーのウィンドウ操作修正', 'サイト側の動画ウィンドウ操作と YouTube / Bilibili 側の操作が混ざらないように調整しました。', '# 動画プレイヤーのウィンドウ操作修正

今回の更新では、動画欄の XP 風プレイヤーウィンドウを調整し、サイト側のウィンドウ操作と YouTube / Bilibili のプレイヤー操作が混ざらないようにしました。

## 更新内容

- サイト内の「全画面」は、タイトルバー右上の XP 風の最大化/復元ボタンに変更しました。もう一度クリックするか Escape で元に戻せます。
- iframe を優先してブラウザ全画面にしないようにし、YouTube / Bilibili の全画面はプレイヤー側に任せます。
-- 下部の空白部分には透明のクリック保護を置き、動画カードの再生ボタンもボタン本体だけが反応するようにして、プラットフォーム側ボタンの誤触を減らしました。', '2026-06-15T15:30:00.000Z', '2026-06-15T15:30:00.000Z'),
  ('seed-update-2026-06-15-video-management-sort-metadata-zh', 'seed-update-2026-06-15-video-management-sort-metadata', 'zh', '视频管理排序与 B 站信息修复', '修复 Bilibili 元数据兜底、视频排序、统一卡片尺寸和首页视频入口文案。', '# 视频管理排序与 B 站信息修复

本次更新继续修复视频区和后台视频管理，让新视频更容易排在前面，Bilibili 链接也能尽量补齐公开信息。

## 更新内容

- Bilibili 元数据抓取增加页面 meta、结构化数据和更多页面状态兜底，遇到接口 412 时也会尽量补齐标题、简介、作者、发布时间和封面。
- 视频列表改为置顶优先，未置顶视频按排序值从大到小显示；后台新建视频默认使用当前最大排序 + 10。
- 视频分类管理使用同样的排序语义，默认新建分类也会自动追加 +10，并避免默认分类 seed 覆盖后台维护过的排序和启用状态。
- 主站视频卡片统一高度，封面按钮清除默认内边距并让图片完全铺满，缺少封面时显示同尺寸像素风占位卡。
- 视频播放器的“打开原地址”保持真实外链，并兼容旧 fallback 数据；首页视频区入口去掉“待定”文案。', '2026-06-15T16:20:00.000Z', '2026-06-15T16:20:00.000Z'),
  ('seed-update-2026-06-15-video-management-sort-metadata-en', 'seed-update-2026-06-15-video-management-sort-metadata', 'en', 'Video Sorting and Bilibili Metadata Fixes', 'Improved Bilibili metadata fallback, video ordering, card sizing, and the home Videos label.', '# Video Sorting and Bilibili Metadata Fixes

This update tightens the managed video workflow so newer videos can stay at the front and Bilibili links keep more of their public metadata.

## Changes

- Bilibili metadata now falls back to page meta tags, structured data, and broader page-state parsing when the API returns HTTP 412.
- Video lists keep pinned items first, then sort unpinned videos by higher sort values first; new admin videos default to the current max sort + 10.
- Video categories use the same sort meaning, new categories also default to +10, and default category seeds no longer overwrite admin-managed sort/enabled values.
- Public video cards now share one stable height, thumbnails remove button padding and fully cover their frame, and missing thumbnails use a same-size pixel placeholder.
- Open Original remains a real source link, including old fallback data, and the home Videos icon no longer says TBD.', '2026-06-15T16:20:00.000Z', '2026-06-15T16:20:00.000Z'),
  ('seed-update-2026-06-15-video-management-sort-metadata-ja', 'seed-update-2026-06-15-video-management-sort-metadata', 'ja', '動画管理の並び順と Bilibili 情報取得を修正', 'Bilibili メタ情報の補完、動画の並び順、カードサイズ、ホームの動画ラベルを調整しました。', '# 動画管理の並び順と Bilibili 情報取得を修正

今回の更新では、動画欄と管理画面の動画管理を続けて調整し、新しい動画を前に出しやすくし、Bilibili リンクの公開情報もできるだけ補えるようにしました。

## 更新内容

- Bilibili API が HTTP 412 を返した場合も、ページ meta、構造化データ、ページ状態からタイトル、概要、作者、公開時刻、サムネイルをできるだけ補完します。
- 動画一覧は固定表示を最優先し、その下で並び順の数値が大きいものほど前に表示します。管理画面の新規動画は現在の最大値 +10 を初期値にします。
- 動画分類も同じ並び順の意味にそろえ、新規分類も +10 で追加します。既定分類の seed は管理画面で変更した並び順と有効状態を上書きしません。
- 公開側の動画カードは高さを統一し、サムネイル画像は余白なく枠いっぱいに表示します。サムネイルがない場合も同じサイズのピクセル風プレースホルダーを表示します。
- 「元のページを開く」は実際の外部リンクとして維持し、ホームの動画アイコンから「未定」表記を外しました。', '2026-06-15T16:20:00.000Z', '2026-06-15T16:20:00.000Z')
on conflict(article_id, lang) do update set
  title = excluded.title,
  summary = excluded.summary,
  content_markdown = excluded.content_markdown,
  updated_at = excluded.updated_at;

insert into article_translations (
  translation_id, article_id, lang, title, summary, content_markdown, created_at, updated_at
) values
  ('seed-update-2026-06-16-mobile-admin-video-fixes-zh', 'seed-update-2026-06-16-mobile-admin-video-fixes', 'zh', '移动端与后台视频维护修复', '修复视频分类标签回退、B 站元数据抓取提示和主站视频/资源/登录弹窗的手机端适配。', '# 移动端与后台视频维护修复

本次更新继续打磨视频区和后台管理，让手机端浏览和后台维护更稳定。

## 更新内容

- 默认视频分类 seed 改为只插入缺失分类，不再覆盖后台已经改过的分类名称。
- Bilibili 元数据抓取移除不必要的 Origin 请求头，增加详情接口、移动页和新版页面数据兜底；URL 没变时保存视频不再反复抓外部元数据。
- 后台视频识别失败时会提示“播放器地址已生成，可手动补全标题、作者和封面”，并增加重复视频提示。
- 视频列表、资源区、登录弹窗、登录成功提示和视频播放窗口补齐手机端换行、单列和防溢出规则。
- 后台视频分类勾选区会标识停用分类，避免新视频继续误选停用标签。', '2026-06-16T02:20:00.000Z', '2026-06-16T02:20:00.000Z'),
  ('seed-update-2026-06-16-mobile-admin-video-fixes-en', 'seed-update-2026-06-16-mobile-admin-video-fixes', 'en', 'Mobile and Admin Video Maintenance Fixes', 'Fixed video category rollback, Bilibili metadata handling, and mobile layout for videos, resources, and login popovers.', '# Mobile and Admin Video Maintenance Fixes

This update continues polishing the videos area and admin workflow so mobile browsing and video maintenance feel steadier.

## Changes

- Default video category seeds now only insert missing categories, so admin-edited category names are no longer overwritten.
- Bilibili metadata fetching removes the unnecessary Origin header and adds detail API, mobile-page, and newer page-data fallbacks; unchanged video URLs no longer refetch metadata on every save.
- Admin video recognition now explains when the player URL was generated but metadata needs manual title, author, or thumbnail entry, and duplicate videos are blocked with a clear message.
- The videos list, resources area, login popover, signed-in account message, and video player window now have stronger mobile wrapping, single-column, and overflow protection.
- Disabled video categories are marked in the admin checkbox list so new videos are less likely to reuse disabled tags.', '2026-06-16T02:20:00.000Z', '2026-06-16T02:20:00.000Z'),
  ('seed-update-2026-06-16-mobile-admin-video-fixes-ja', 'seed-update-2026-06-16-mobile-admin-video-fixes', 'ja', 'モバイル表示と動画管理を修正', '動画カテゴリ名の戻り、Bilibili メタ情報取得、動画・リソース・ログイン周りのモバイル表示を調整しました。', '# モバイル表示と動画管理を修正

今回の更新では、動画欄と管理画面を続けて調整し、スマートフォンでの閲覧と動画メンテナンスを安定させました。

## 更新内容

- 既定の動画カテゴリ seed は不足分だけを追加するようにし、管理画面で変更したカテゴリ名を上書きしないようにしました。
- Bilibili メタ情報取得では不要な Origin ヘッダーを外し、詳細 API、モバイルページ、新しいページデータの補完を追加しました。URL が変わらない保存では外部メタ情報を毎回取り直しません。
- 管理画面では、プレイヤー URL は生成できたがタイトル・作者・サムネイルを手入力する必要がある場合を分かりやすく表示し、重複動画も明確に止めます。
- 動画一覧、リソース欄、ログインポップオーバー、ログイン済み表示、動画再生ウィンドウにモバイル向けの折り返し、単列、防溢出ルールを追加しました。
- 管理画面の動画カテゴリ選択では停止中カテゴリを表示し、新しい動画で誤って再利用しにくくしました。', '2026-06-16T02:20:00.000Z', '2026-06-16T02:20:00.000Z')
on conflict(article_id, lang) do update set
  title = excluded.title,
  summary = excluded.summary,
  content_markdown = excluded.content_markdown,
  updated_at = excluded.updated_at;

insert into article_translations (
  translation_id, article_id, lang, title, summary, content_markdown, created_at, updated_at
) values
  ('seed-update-2026-06-16-responsive-video-window-zh', 'seed-update-2026-06-16-responsive-video-window', 'zh', '视频区窗口自适应放大', '视频区列表窗口会跟随屏幕可用高度放大，减少桌面底部空白并显示更多视频卡片。', '# 视频区窗口自适应放大

本次更新调整主站视频区列表窗口，让它在桌面端更充分利用屏幕高度。

## 更新内容

- 视频区 XP 窗口不再被固定的 760px 高度上限限制，而是按当前浏览器可用高度计算。
- 宽屏桌面端窗口宽度略微放大，让三列视频卡片更舒展。
- 视频列表内部继续滚动，标题栏、分类筛选和卡片安全渲染逻辑保持不变。
- 手机端仍使用原有小屏断点，保持单列布局和防横向溢出规则。', '2026-06-16T02:40:13.000Z', '2026-06-16T02:40:13.000Z'),
  ('seed-update-2026-06-16-responsive-video-window-en', 'seed-update-2026-06-16-responsive-video-window', 'en', 'Responsive Video Window', 'The videos window now grows with available screen height, reducing empty desktop space and showing more cards.', '# Responsive Video Window

This update lets the main videos window use more of the available desktop screen.

## Changes

- The videos XP window is no longer capped by the old 760px height limit and now follows the browser''s available height.
- Wide desktop screens get a slightly wider window so the three-column video cards have more room.
- The video list still scrolls inside the window, with the titlebar, filters, and safe card rendering unchanged.
- Mobile keeps the existing small-screen breakpoint, single-column layout, and overflow protection.', '2026-06-16T02:40:13.000Z', '2026-06-16T02:40:13.000Z'),
  ('seed-update-2026-06-16-responsive-video-window-ja', 'seed-update-2026-06-16-responsive-video-window', 'ja', '動画欄ウィンドウの自動拡大', '動画欄のウィンドウが画面の高さに合わせて広がり、下部の空白を減らしてより多くのカードを表示します。', '# 動画欄ウィンドウの自動拡大

今回の更新では、メインサイトの動画欄ウィンドウがデスクトップ画面をより広く使えるようにしました。

## 更新内容

- 動画欄の XP ウィンドウは従来の 760px 上限に固定されず、ブラウザの利用可能な高さに合わせて伸びます。
- ワイドなデスクトップ画面ではウィンドウ幅も少し広げ、3列の動画カードに余裕を持たせました。
- 動画一覧は引き続きウィンドウ内でスクロールし、タイトルバー、カテゴリ絞り込み、安全なカード描画はそのままです。
- モバイルでは既存の小画面ブレークポイントを維持し、単列表示と横方向のはみ出し防止を保っています。', '2026-06-16T02:40:13.000Z', '2026-06-16T02:40:13.000Z')
on conflict(article_id, lang) do update set
  title = excluded.title,
  summary = excluded.summary,
  content_markdown = excluded.content_markdown,
  updated_at = excluded.updated_at;

insert into article_translations (
  translation_id, article_id, lang, title, summary, content_markdown, created_at, updated_at
) values
  ('seed-update-2026-06-16-video-card-category-icon-fixes-zh', 'seed-update-2026-06-16-video-card-category-icon-fixes', 'zh', '视频卡片与分类持久化修复', '视频卡片减少下方空白，视频分类删除和排序会被保留，聊天室桌面图标也稍微缩小。', '# 视频卡片与分类持久化修复

本次更新继续修复视频区和首页桌面图标的细节，让显示更紧凑，后台维护结果也更稳定。

## 更新内容

- 主站视频卡片缩短整体高度，并压缩封面、正文和按钮间距，减少卡片下方无用空白。
- 视频分类默认 seed 改为首次建表初始化，之后不再把后台已经删除的默认标签补回来，也不影响后台排序。
- 构建检查新增公开视频接口路径，避免视频 schema guard 的运行时问题漏检。
- 首页匿名聊天室桌面图标略微缩小，并和名称保留更多间距。', '2026-06-16T08:20:00.000Z', '2026-06-16T08:20:00.000Z'),
  ('seed-update-2026-06-16-video-card-category-icon-fixes-en', 'seed-update-2026-06-16-video-card-category-icon-fixes', 'en', 'Video Card and Category Persistence Fixes', 'Video cards are more compact, deleted or reordered video categories stay intact, and the chatroom desktop icon is slightly smaller.', '# Video Card and Category Persistence Fixes

This update continues tightening the videos area and desktop icons so the public page is cleaner and admin-managed data stays stable.

## Changes

- Public video cards now use a shorter fixed height with tighter thumbnail, text, and button spacing to remove unnecessary lower blank space.
- Default video category seeds now run only during first table creation, so deleted default tags are not restored and admin ordering is preserved.
- The build check now exercises the public videos API path so video schema guard problems are less likely to slip through.
- The anonymous chatroom desktop icon is slightly smaller and leaves clearer spacing above its label.', '2026-06-16T08:20:00.000Z', '2026-06-16T08:20:00.000Z'),
  ('seed-update-2026-06-16-video-card-category-icon-fixes-ja', 'seed-update-2026-06-16-video-card-category-icon-fixes', 'ja', '動画カードとカテゴリ保持の修正', '動画カードをコンパクトにし、削除・並べ替えた動画カテゴリを保持し、チャットルームのデスクトップアイコンも少し小さくしました。', '# 動画カードとカテゴリ保持の修正

今回の更新では、動画欄とホームのデスクトップアイコンをさらに調整し、表示をコンパクトにしつつ、管理画面の変更が戻らないようにしました。

## 更新内容

- 公開側の動画カードは固定高さを短くし、サムネイル、本文、ボタンの間隔を詰めて下部の不要な余白を減らしました。
- 既定の動画カテゴリ seed は初回テーブル作成時だけ動くようにし、削除済みの既定タグを戻さず、管理画面の並び順も保持します。
- ビルドチェックで公開動画 API の経路も確認し、動画 schema guard の実行時問題を見落としにくくしました。
- 匿名チャットルームのデスクトップアイコンを少し小さくし、ラベルとの間隔を確保しました。', '2026-06-16T08:20:00.000Z', '2026-06-16T08:20:00.000Z')
on conflict(article_id, lang) do update set
  title = excluded.title,
  summary = excluded.summary,
  content_markdown = excluded.content_markdown,
  updated_at = excluded.updated_at;

insert into article_translations (
  translation_id, article_id, lang, title, summary, content_markdown, created_at, updated_at
) values
  ('seed-update-2026-06-17-knowledge-search-zh', 'seed-update-2026-06-17-knowledge-search', 'zh', '知识库本地搜索上线', '知识库顶部新增本地搜索，可按标题、简介、分类和标签快速过滤文章。', '# 知识库本地搜索上线

本次更新给主站知识库增加了轻量搜索条，方便在文章和网站更新记录越来越多时快速定位内容。

## 更新内容

- 知识库窗口顶部新增搜索框，可按文章标题、简介、分类、slug 和标签即时过滤。
- 搜索结果会显示当前命中数量，清空按钮可以一键恢复完整列表。
- 搜索文案同步维护中文、English、日本語，切换语言后会更新标签、占位提示和结果数量。
- 手机端搜索条会自动换行，继续保持无横向溢出。
- 文章详情、直链、Markdown 安全渲染和聊天室纯文本规则保持不变。', '2026-06-17T15:25:00.000Z', '2026-06-17T15:25:00.000Z'),
  ('seed-update-2026-06-17-knowledge-search-en', 'seed-update-2026-06-17-knowledge-search', 'en', 'Knowledge Search Added', 'The knowledge base now has local search across titles, summaries, categories, and tags.', '# Knowledge Search Added

This update adds a lightweight search bar to the public knowledge base so articles and site update logs are easier to find as the archive grows.

## Changes

- The knowledge window now has a search field that filters by article title, summary, category, slug, and tags instantly in the browser.
- Result text shows the current match count, and the clear button restores the full list in one click.
- Search labels, placeholders, and count text are maintained in Chinese, English, and Japanese.
- The mobile search bar wraps cleanly and keeps the page free of horizontal overflow.
- Article detail links, Markdown safe rendering, and chatroom plain-text rules are unchanged.', '2026-06-17T15:25:00.000Z', '2026-06-17T15:25:00.000Z'),
  ('seed-update-2026-06-17-knowledge-search-ja', 'seed-update-2026-06-17-knowledge-search', 'ja', '知識庫検索を追加', '知識庫に、タイトル・概要・分類・タグで絞り込めるローカル検索を追加しました。', '# 知識庫検索を追加

今回の更新では、記事とサイト更新記録が増えても探しやすいように、公開側の知識庫へ軽量な検索バーを追加しました。

## 更新内容

- 知識庫ウィンドウ上部に検索欄を追加し、記事タイトル、概要、分類、slug、タグをブラウザ内で即時に絞り込めます。
- 結果件数を表示し、クリアボタンで一覧全体にすぐ戻せます。
- 検索ラベル、プレースホルダー、件数表示は中文、English、日本語で同期しています。
- モバイルでは検索バーが自然に折り返し、横方向にはみ出さないようにしました。
- 記事詳細リンク、Markdown の安全描画、チャットルームの純テキスト表示ルールはそのままです。', '2026-06-17T15:25:00.000Z', '2026-06-17T15:25:00.000Z')
on conflict(article_id, lang) do update set
  title = excluded.title,
  summary = excluded.summary,
  content_markdown = excluded.content_markdown,
  updated_at = excluded.updated_at;

insert into article_translations (
  translation_id, article_id, lang, title, summary, content_markdown, created_at, updated_at
) values
  ('seed-update-2026-06-17-article-share-link-zh', 'seed-update-2026-06-17-article-share-link', 'zh', '文章详情复制链接', '知识库文章详情新增复制直链按钮，便于分享当前语言的文章页面。', '# 文章详情复制链接

本次更新继续打磨知识库阅读体验，让文章详情页更适合分享和回访。

## 更新内容

- 文章详情头部新增“复制文章链接”按钮，会生成当前文章的直链。
- 复制链接会保留当前语言参数，中文、English、日本語 页面都能分享对应语言视图。
- 成功和失败提示均使用三语文案，并通过安全 DOM 文本更新。
- 手机端按钮和提示会自然换行，避免文章页横向溢出。', '2026-06-17T15:40:00.000Z', '2026-06-17T15:40:00.000Z'),
  ('seed-update-2026-06-17-article-share-link-en', 'seed-update-2026-06-17-article-share-link', 'en', 'Article Link Copy', 'Knowledge article pages now include a copy-link button for sharing the current language view.', '# Article Link Copy

This update keeps improving the knowledge reading flow so article detail pages are easier to share and revisit.

## Changes

- Article detail headers now include a copy-link button that creates a direct URL for the current article.
- The copied link keeps the current language parameter, so Chinese, English, and Japanese views can be shared directly.
- Success and failure messages are maintained in all three languages and update through safe DOM text.
- On mobile, the button and status text wrap cleanly without horizontal overflow.', '2026-06-17T15:40:00.000Z', '2026-06-17T15:40:00.000Z'),
  ('seed-update-2026-06-17-article-share-link-ja', 'seed-update-2026-06-17-article-share-link', 'ja', '記事リンクコピー', '知識庫の記事詳細に、現在の言語表示を共有しやすいリンクコピーボタンを追加しました。', '# 記事リンクコピー

今回の更新では、知識庫の記事詳細ページを共有しやすくするため、読み物まわりの操作を少し整えました。

## 更新内容

- 記事詳細のヘッダーに、現在の記事の直リンクをコピーするボタンを追加しました。
- コピーされるリンクには現在の言語パラメータが含まれ、中文、English、日本語の表示をそのまま共有できます。
- 成功・失敗メッセージは三言語で用意し、安全な DOM テキストとして更新します。
- モバイルではボタンと状態表示が自然に折り返し、横方向にはみ出さないようにしました。', '2026-06-17T15:40:00.000Z', '2026-06-17T15:40:00.000Z')
on conflict(article_id, lang) do update set
  title = excluded.title,
  summary = excluded.summary,
  content_markdown = excluded.content_markdown,
  updated_at = excluded.updated_at;

insert into article_translations (
  translation_id, article_id, lang, title, summary, content_markdown, created_at, updated_at
) values
  ('seed-update-2026-06-17-video-empty-state-zh', 'seed-update-2026-06-17-video-empty-state', 'zh', '视频区空状态增强', '视频区没有公开视频时，会显示 XP 风格提示并提供网站更新入口。', '# 视频区空状态增强

本次更新给主站视频区补上更清晰的空状态，让没有公开视频或筛选无结果时也不显得像页面坏掉了。

## 更新内容

- 视频区无公开视频时显示 XP 风格提示卡片，说明视频内容正在整理中。
- 筛选到空分类时会提示换分类或查看网站更新记录。
- 空状态按钮会跳转到知识库的网站更新记录分类，方便继续浏览施工进度。
- 手机端空状态改为单列布局，保持视频区无横向溢出。
- 已有视频卡片、播放窗口、公开 API 和后台视频数据不受影响。', '2026-06-17T15:53:00.000Z', '2026-06-17T15:53:00.000Z'),
  ('seed-update-2026-06-17-video-empty-state-en', 'seed-update-2026-06-17-video-empty-state', 'en', 'Video Empty State', 'The videos area now shows an XP-style empty state with a shortcut to site updates when no videos are published.', '# Video Empty State

This update adds a clearer empty state to the public videos area, so the page still feels intentional when no videos are published or a filter has no results.

## Changes

- When no public videos are available, the videos area now shows an XP-style message card explaining that the archive is being organized.
- Empty filtered categories suggest trying another category or checking site updates.
- The empty-state button opens the knowledge base site update category so visitors can keep browsing recent build notes.
- On mobile, the empty state switches to a single-column layout and keeps the videos area free of horizontal overflow.
- Existing video cards, the playback window, public API behavior, and admin-managed video data are unchanged.', '2026-06-17T15:53:00.000Z', '2026-06-17T15:53:00.000Z'),
  ('seed-update-2026-06-17-video-empty-state-ja', 'seed-update-2026-06-17-video-empty-state', 'ja', '動画欄の空状態を改善', '公開動画がない場合、動画欄に XP 風の空状態とサイト更新記録への入口を表示します。', '# 動画欄の空状態を改善

今回の更新では、公開動画がない場合やフィルター結果が空の場合でも、動画欄が壊れて見えないように空状態を整えました。

## 更新内容

- 公開動画がないとき、動画を整理中であることを伝える XP 風の案内カードを表示します。
- 空のカテゴリを選んだ場合は、別カテゴリまたはサイト更新記録を見る案内を出します。
- 空状態ボタンから、知識庫のサイト更新記録カテゴリへ移動できます。
- モバイルでは空状態を一列にし、動画欄が横方向にはみ出さないようにしました。
- 既存の動画カード、再生ウィンドウ、公開 API、管理画面の動画データには影響しません。', '2026-06-17T15:53:00.000Z', '2026-06-17T15:53:00.000Z')
on conflict(article_id, lang) do update set
  title = excluded.title,
  summary = excluded.summary,
  content_markdown = excluded.content_markdown,
  updated_at = excluded.updated_at;

insert into article_translations (
  translation_id, article_id, lang, title, summary, content_markdown, created_at, updated_at
) values
  ('seed-update-2026-06-17-route-aware-welcome-zh', 'seed-update-2026-06-17-route-aware-welcome', 'zh', '文章直链不再弹欢迎窗', '首次打开文章或其他非首页直链时，不再自动弹出欢迎窗口遮挡内容。', '# 文章直链不再弹欢迎窗

本次更新修复文章详情直链的首次访问体验，让链接打开后直接看到目标内容。

## 更新内容

- 首次打开文章详情、知识库、视频区等非首页直链时，不再自动弹出欢迎窗口遮挡内容。
- 首页首次访问仍保留欢迎窗口，用于展示快捷入口和最近更新。
- `?welcome=0` 继续禁用欢迎窗，`?welcome=1` 可显式触发欢迎窗，方便人工检查。
- 文章详情、搜索、视频区、聊天室和游戏区路由逻辑保持不变。', '2026-06-17T16:02:00.000Z', '2026-06-17T16:02:00.000Z'),
  ('seed-update-2026-06-17-route-aware-welcome-en', 'seed-update-2026-06-17-route-aware-welcome', 'en', 'Cleaner Article Deep Links', 'Article and non-home deep links no longer auto-open the welcome modal over the content.', '# Cleaner Article Deep Links

This update fixes the first-visit experience for article detail URLs so deep links open directly on the target content.

## Changes

- Article detail, knowledge, videos, and other non-home deep links no longer auto-open the welcome modal over the page content.
- First visits to the home page still keep the welcome modal for quick links and recent updates.
- `?welcome=0` still disables the modal, while `?welcome=1` can explicitly open it for manual checks.
- Article detail, search, videos, chatroom, and games route behavior is otherwise unchanged.', '2026-06-17T16:02:00.000Z', '2026-06-17T16:02:00.000Z'),
  ('seed-update-2026-06-17-route-aware-welcome-ja', 'seed-update-2026-06-17-route-aware-welcome', 'ja', '記事直リンクを読みやすく', '記事やホーム以外の直リンクでは、歓迎ウィンドウが内容を隠さないようにしました。', '# 記事直リンクを読みやすく

今回の更新では、記事詳細への直リンクを初めて開いたときも、目的の記事をすぐ読めるようにしました。

## 更新内容

- 記事詳細、知識庫、動画欄などホーム以外の直リンクでは、歓迎ウィンドウを自動表示しません。
- ホームの初回訪問では、快捷入口と最近の更新を案内する歓迎ウィンドウを引き続き表示します。
- `?welcome=0` は引き続き歓迎ウィンドウを無効化し、`?welcome=1` で明示的に表示できます。
- 記事詳細、検索、動画欄、チャット、ゲーム区のルート処理はそのままです。', '2026-06-17T16:02:00.000Z', '2026-06-17T16:02:00.000Z')
on conflict(article_id, lang) do update set
  title = excluded.title,
  summary = excluded.summary,
  content_markdown = excluded.content_markdown,
  updated_at = excluded.updated_at;

insert into article_translations (
  translation_id, article_id, lang, title, summary, content_markdown, created_at, updated_at
) values
  ('seed-update-2026-06-18-resource-actions-zh', 'seed-update-2026-06-18-resource-actions', 'zh', '资源区占位按钮修复', '资源区没有真实下载或外链时显示准备中按钮，不再使用无效 # 链接。', '# 资源区占位按钮修复

本次更新整理了主站资源区的占位卡片，让还没有真实下载或外链的资源不会表现得像可点击链接。

## 更新内容

- 资源卡片没有真实 URL 时，动作按钮显示“准备中”并进入禁用态。
- 后续资源配置补上真实 `http(s)`、`assets/` 或 `downloads/` 地址后，仍会显示下载或外链按钮。
- 资源卡片改为使用 DOM 和 `textContent` 构建，减少未来接入动态资源数据时的 XSS 风险。
- 右上角最近更新日期改为按用户本地日期计算，避免北京时间 00:00 后发布的更新仍显示前一天。
- 中文、English、日本語 的按钮文案和移动端布局同步维护。', '2026-06-17T16:09:00.000Z', '2026-06-17T16:09:00.000Z'),
  ('seed-update-2026-06-18-resource-actions-en', 'seed-update-2026-06-18-resource-actions', 'en', 'Resource Placeholder Buttons', 'Resource cards without real download or external URLs now show a coming-soon button instead of a dead # link.', '# Resource Placeholder Buttons

This update tidies the public resources area so placeholder cards without real downloads or external URLs no longer behave like clickable dead links.

## Changes

- Resource cards without a real URL now show a disabled coming-soon action.
- When a future resource gets a real `http(s)`, `assets/`, or `downloads/` URL, the card still renders a download or external-link button.
- Resource cards now render through DOM nodes and `textContent`, reducing XSS risk if resource data becomes dynamic later.
- The top-right latest update date now uses the local date, so updates published after midnight in China no longer show the previous UTC day.
- Chinese, English, and Japanese button text and mobile layout behavior are maintained together.', '2026-06-17T16:09:00.000Z', '2026-06-17T16:09:00.000Z'),
  ('seed-update-2026-06-18-resource-actions-ja', 'seed-update-2026-06-18-resource-actions', 'ja', 'リソース準備中ボタン', '実際のダウンロードや外部リンクがないリソースは、無効な # リンクではなく準備中ボタンを表示します。', '# リソース準備中ボタン

今回の更新では、公開側のリソース欄を整理し、実際のダウンロードや外部リンクがないカードが無効なリンクのように見えないようにしました。

## 更新内容

- 実際の URL がないリソースカードは、「準備中」の無効ボタンを表示します。
- 今後 `http(s)`、`assets/`、`downloads/` の実リンクを設定すると、ダウンロードまたは外部リンクボタンとして表示されます。
- リソースカードは DOM と `textContent` で構築するようにし、将来リソースデータを動的化する場合の XSS リスクを下げました。
- 右上の最新更新日は閲覧者のローカル日付で計算し、中国時間 00:00 以降の更新が UTC の前日表示にならないようにしました。
- 中文、English、日本語 のボタン文言とモバイル表示を合わせて維持しています。', '2026-06-17T16:09:00.000Z', '2026-06-17T16:09:00.000Z')
on conflict(article_id, lang) do update set
  title = excluded.title,
  summary = excluded.summary,
  content_markdown = excluded.content_markdown,
  updated_at = excluded.updated_at;

insert into article_translations (
  translation_id, article_id, lang, title, summary, content_markdown, created_at, updated_at
) values
  ('seed-update-2026-06-18-nav-active-state-zh', 'seed-update-2026-06-18-nav-active-state', 'zh', '导航当前态增强', '底部任务栏和首页 Start 按钮会标记当前页面，并同步 aria-current。', '# 导航当前态增强

本次更新继续打磨 XP 桌面导航反馈，让当前打开的页面更容易识别。

## 更新内容

- 底部任务栏按钮继续跟随当前 route 高亮，并同步 `aria-current="page"`。
- 首页 Start 按钮在桌面首页时显示更明确的当前态。
- 首页桌面图标同步 `aria-pressed` 状态，便于键盘和辅助技术识别。
- 路由、文章直链、聊天室轮询、视频窗口和游戏入口行为保持不变。', '2026-06-17T16:18:00.000Z', '2026-06-17T16:18:00.000Z'),
  ('seed-update-2026-06-18-nav-active-state-en', 'seed-update-2026-06-18-nav-active-state', 'en', 'Active Navigation State', 'The taskbar and Start button now mark the current page and keep aria-current in sync.', '# Active Navigation State

This update refines the XP desktop navigation feedback so the currently open page is easier to identify.

## Changes

- Taskbar buttons continue to highlight the current route and now keep `aria-current="page"` in sync.
- The Start button now shows a clearer active state when the desktop home page is open.
- Desktop icons keep `aria-pressed` synchronized for keyboard and assistive technology users.
- Routing, article deep links, chat polling, video windows, and game entry behavior are unchanged.', '2026-06-17T16:18:00.000Z', '2026-06-17T16:18:00.000Z'),
  ('seed-update-2026-06-18-nav-active-state-ja', 'seed-update-2026-06-18-nav-active-state', 'ja', 'ナビ現在状態を強化', 'タスクバーと Start ボタンが現在ページを示し、aria-current も同期します。', '# ナビ現在状態を強化

今回の更新では、XP デスクトップ風のナビゲーション表示を整え、現在開いているページを分かりやすくしました。

## 更新内容

- タスクバーのボタンは現在 route のハイライトを維持し、`aria-current="page"` も同期します。
- ホーム画面では Start ボタンに、より分かりやすい現在状態を表示します。
- デスクトップアイコンは `aria-pressed` を同期し、キーボード操作や支援技術でも状態を把握しやすくしました。
- ルート処理、記事直リンク、チャットの更新、動画ウィンドウ、ゲーム入口の動作はそのままです。', '2026-06-17T16:18:00.000Z', '2026-06-17T16:18:00.000Z')
on conflict(article_id, lang) do update set
  title = excluded.title,
  summary = excluded.summary,
  content_markdown = excluded.content_markdown,
  updated_at = excluded.updated_at;

insert into article_translations (
  translation_id, article_id, lang, title, summary, content_markdown, created_at, updated_at
) values
  ('seed-update-2026-06-18-blog-placeholders-zh', 'seed-update-2026-06-18-blog-placeholders', 'zh', '杂谈区占位按钮修复', '杂谈区没有真实文章入口时显示整理中按钮，并改用安全 DOM 渲染。', '# 杂谈区占位按钮修复

本次更新整理了主站杂谈区的占位卡片，避免还没有文章详情时出现没有效果的阅读按钮。

## 更新内容

- 杂谈区卡片没有真实文章入口时，动作按钮显示“整理中”并进入禁用态。
- 杂谈区卡片改为使用 DOM 和 `textContent` 构建，减少未来接入动态杂谈数据时的 XSS 风险。
- 中文、English、日本語 的按钮文案同步维护。
- 知识库文章系统、文章直链和现有首页导航行为保持不变。', '2026-06-17T16:23:00.000Z', '2026-06-17T16:23:00.000Z'),
  ('seed-update-2026-06-18-blog-placeholders-en', 'seed-update-2026-06-18-blog-placeholders', 'en', 'Talk Placeholder Buttons', 'Talk cards without article targets now show a drafting button and render through safe DOM nodes.', '# Talk Placeholder Buttons

This update tidies the public Talk area so placeholder cards without article detail targets no longer show a read button that does nothing.

## Changes

- Talk cards without a real article target now show a disabled drafting action.
- Talk cards now render through DOM nodes and `textContent`, reducing XSS risk if talk data becomes dynamic later.
- Chinese, English, and Japanese button text are maintained together.
- The knowledge article system, article deep links, and existing home navigation behavior are unchanged.', '2026-06-17T16:23:00.000Z', '2026-06-17T16:23:00.000Z'),
  ('seed-update-2026-06-18-blog-placeholders-ja', 'seed-update-2026-06-18-blog-placeholders', 'ja', '雑談の準備中ボタン', '実際の記事リンクがない雑談カードは準備中ボタンを表示し、安全な DOM 描画にしました。', '# 雑談の準備中ボタン

今回の更新では、公開側の雑談欄を整理し、記事詳細がまだないカードに効果のない読むボタンを出さないようにしました。

## 更新内容

- 実際の記事入口がない雑談カードは、「準備中」の無効ボタンを表示します。
- 雑談カードは DOM と `textContent` で構築するようにし、将来データを動的化する場合の XSS リスクを下げました。
- 中文、English、日本語 のボタン文言を合わせて維持しています。
- 知識庫の記事システム、記事直リンク、既存のホームナビゲーション動作はそのままです。', '2026-06-17T16:23:00.000Z', '2026-06-17T16:23:00.000Z'),
  ('seed-update-2026-06-18-language-url-sync-zh', 'seed-update-2026-06-18-language-url-sync', 'zh', '语言链接参数同步', '切换语言时会同步地址栏 lang 参数，复制当前页面链接不再带旧语言。', '# 语言链接参数同步

本次更新修正了主站三语切换后的链接状态，让地址栏和页面语言保持一致。

## 更新内容

- 点击中文 / English / 日本語 语言按钮时，地址栏 `lang=` 参数会同步更新为当前语言。
- 主站窗口路由跳转会保留当前查询参数并刷新 `lang=`，复制当前页面链接时不再带旧语言。
- 语言切换只使用 `replaceState` 更新当前地址，不额外制造浏览历史层级。
- 知识库文章、视频区、聊天室和游戏入口继续使用现有公开渲染逻辑，不影响后台接口。', '2026-06-17T16:41:00.000Z', '2026-06-17T16:41:00.000Z'),
  ('seed-update-2026-06-18-language-url-sync-en', 'seed-update-2026-06-18-language-url-sync', 'en', 'Language URL Sync', 'Language switching now updates the address bar lang parameter so copied page links keep the current language.', '# Language URL Sync

This update keeps the address bar in sync with the current language after switching between the three site languages.

## Changes

- Clicking Chinese / English / Japanese now updates the `lang=` parameter in the address bar.
- Public route changes preserve the current query parameters and refresh `lang=`, so copied page links no longer carry an old language.
- Language switching uses `replaceState`, so it updates the current URL without adding extra browser history entries.
- Knowledge articles, videos, chat room, and game entries continue using the existing public rendering paths, with no admin API changes.', '2026-06-17T16:41:00.000Z', '2026-06-17T16:41:00.000Z'),
  ('seed-update-2026-06-18-language-url-sync-ja', 'seed-update-2026-06-18-language-url-sync', 'ja', '言語URL同期', '言語切り替え時にアドレスバーの lang パラメータを同期し、コピーしたリンクが現在の言語を保ちます。', '# 言語URL同期

今回の更新では、三言語を切り替えた後もアドレスバーと表示言語がずれないようにしました。

## 更新内容

- 中文 / English / 日本語 の言語ボタンを押すと、アドレスバーの `lang=` パラメータも現在の言語に更新します。
- 公開ページのルート移動では現在のクエリパラメータを保ちつつ `lang=` を更新し、コピーしたリンクが古い言語を持たないようにしました。
- 言語切り替えは `replaceState` で現在の URL だけを更新し、余分な履歴を増やしません。
- 知識庫の記事、動画欄、チャット、ゲーム入口は既存の公開描画ロジックを使い、管理 API には触れていません。', '2026-06-17T16:41:00.000Z', '2026-06-17T16:41:00.000Z'),
  ('seed-update-2026-06-18-article-detail-search-hide-zh', 'seed-update-2026-06-18-article-detail-search-hide', 'zh', '文章详情搜索条隐藏修复', '知识库文章详情页会隐藏顶部搜索条，让阅读区更专注。', '# 文章详情搜索条隐藏修复

本次更新修正了知识库文章详情页顶部仍显示搜索条的问题，让阅读页更像独立文章窗口。

## 更新内容

- 打开文章详情或文章直链时，知识库搜索条会真正隐藏，不再占用详情顶部空间。
- 为 `.knowledge-searchbar[hidden]`、`.content-list[hidden]` 和 `.article-detail[hidden]` 补充明确隐藏规则，避免组件 display 样式覆盖 HTML `hidden` 状态。
- 返回文章列表后，搜索条会按原逻辑恢复，知识库本地搜索功能不受影响。
- 只调整公开主站 CSS 和更新记录，不触碰后台目录或管理接口。', '2026-06-17T16:50:00.000Z', '2026-06-17T16:50:00.000Z'),
  ('seed-update-2026-06-18-article-detail-search-hide-en', 'seed-update-2026-06-18-article-detail-search-hide', 'en', 'Article Detail Search Hide', 'Knowledge article detail pages now hide the top search bar so the reading area stays focused.', '# Article Detail Search Hide

This update fixes the knowledge article detail view so the search bar no longer stays visible above the article body.

## Changes

- Opening an article detail page or deep link now fully hides the knowledge search bar.
- Explicit hidden-state rules were added for `.knowledge-searchbar[hidden]`, `.content-list[hidden]`, and `.article-detail[hidden]` so component display styles cannot override HTML `hidden` state.
- Returning to the article list restores the search bar through the existing logic, so local knowledge search still works.
- Only the public site CSS and update records changed; admin folders and admin APIs were not touched.', '2026-06-17T16:50:00.000Z', '2026-06-17T16:50:00.000Z'),
  ('seed-update-2026-06-18-article-detail-search-hide-ja', 'seed-update-2026-06-18-article-detail-search-hide', 'ja', '記事詳細の検索バー非表示', '知識庫の記事詳細では上部検索バーを隠し、読みやすい表示にしました。', '# 記事詳細の検索バー非表示

今回の更新では、知識庫の記事詳細で検索バーが本文の上に残ってしまう表示を修正しました。

## 更新内容

- 記事詳細または記事直リンクを開いたとき、知識庫検索バーを完全に非表示にします。
- `.knowledge-searchbar[hidden]`、`.content-list[hidden]`、`.article-detail[hidden]` に明示的な非表示ルールを追加し、コンポーネント側の display 指定が HTML の `hidden` 状態を上書きしないようにしました。
- 記事一覧へ戻ると既存ロジックで検索バーが復帰し、知識庫のローカル検索はそのまま使えます。
- 公開側の CSS と更新記録だけを調整し、管理画面ディレクトリや管理 API には触れていません。', '2026-06-17T16:50:00.000Z', '2026-06-17T16:50:00.000Z'),
  ('seed-update-2026-06-18-trilingual-tags-zh', 'seed-update-2026-06-18-trilingual-tags', 'zh', '标签三语显示', '文章列表、文章详情和杂谈卡片的常见标签会跟随三语切换显示。', '# 标签三语显示

本次更新继续整理主站公开阅读体验，让文章和杂谈卡片里的常见标签跟随当前语言显示。

## 更新内容

- 文章列表、文章详情和杂谈卡片的常见中文 seed 标签会显示为当前语言标签。
- 知识库本地搜索会同时匹配原始标签和当前语言标签，方便用 English / 日本語 搜索标签词。
- 标签仍通过安全 DOM / `textContent` 或已有 HTML escape 渲染，不引入动态脚本执行风险。
- 只调整公开主站渲染和更新记录，不触碰后台目录或管理接口。', '2026-06-17T16:56:00.000Z', '2026-06-17T16:56:00.000Z'),
  ('seed-update-2026-06-18-trilingual-tags-en', 'seed-update-2026-06-18-trilingual-tags', 'en', 'Trilingual Tag Labels', 'Common tags on article lists, article details, and talk cards now follow the site language switch.', '# Trilingual Tag Labels

This update keeps common article and talk tags aligned with the active public site language.

## Changes

- Common Chinese seed tags on article cards, article details, and talk cards now render in the current language.
- Local knowledge search matches both the original tag text and the current-language tag label, so English and Japanese tag terms can still be used.
- Tags continue to render through safe DOM / `textContent` or existing HTML escaping, without adding script execution risk.
- Only public site rendering and update records changed; admin folders and admin APIs were not touched.', '2026-06-17T16:56:00.000Z', '2026-06-17T16:56:00.000Z'),
  ('seed-update-2026-06-18-trilingual-tags-ja', 'seed-update-2026-06-18-trilingual-tags', 'ja', 'タグ三言語表示', '記事一覧、記事詳細、雑談カードの主なタグがサイト言語に合わせて表示されます。', '# タグ三言語表示

今回の更新では、公開側の記事と雑談カードの主なタグを現在の言語に合わせて表示するようにしました。

## 更新内容

- 記事カード、記事詳細、雑談カードの主な中国語 seed タグを現在の言語ラベルで表示します。
- 知識庫のローカル検索は元のタグ文字列と現在言語のタグラベルの両方に一致し、English / 日本語 のタグ語でも検索できます。
- タグは引き続き安全な DOM / `textContent` または既存の HTML escape で描画し、スクリプト実行リスクは増やしません。
- 公開側の描画と更新記録だけを調整し、管理画面ディレクトリや管理 API には触れていません。', '2026-06-17T16:56:00.000Z', '2026-06-17T16:56:00.000Z'),
  ('seed-update-2026-06-18-image-loading-polish-zh', 'seed-update-2026-06-18-image-loading-polish', 'zh', '图片加载细节优化', '首屏外头像和文章配图补充懒加载与异步解码，阅读体验更平滑。', '# 图片加载细节优化

本次更新对公开主站的非关键图片加载做小幅整理，优先减少首屏外图片对加载和解码路径的影响。

## 更新内容

- 聊天室头像和关于页头像补充 `loading="lazy"` 与 `decoding="async"`，只在需要显示对应窗口时再参与加载。
- 文章 Markdown 配图继续使用 `assets/images/articles/` 白名单和安全 DOM 渲染，同时补充异步解码。
- 首屏品牌图标和开始按钮图标保持原加载方式，避免影响首页视觉信号。
- 只调整公开主站图片属性、fallback 更新和公开文章 seed，不触碰后台目录或管理接口。', '2026-06-17T17:06:00.000Z', '2026-06-17T17:06:00.000Z'),
  ('seed-update-2026-06-18-image-loading-polish-en', 'seed-update-2026-06-18-image-loading-polish', 'en', 'Image Loading Polish', 'Off-screen avatars and article images now use lazy loading and async decoding for smoother reading.', '# Image Loading Polish

This update makes a small pass over non-critical public site images so off-screen assets put less pressure on the initial load and decode path.

## Changes

- The chatroom avatar and about-page avatar now use `loading="lazy"` and `decoding="async"`, so they load closer to when their windows are opened.
- Markdown article images still use the `assets/images/articles/` whitelist and safe DOM rendering, with async decoding added.
- First-screen brand and Start button icons keep their current loading behavior so the home screen remains immediate.
- Only public site image attributes, fallback updates, and public article seeds changed; admin folders and admin APIs were not touched.', '2026-06-17T17:06:00.000Z', '2026-06-17T17:06:00.000Z'),
  ('seed-update-2026-06-18-image-loading-polish-ja', 'seed-update-2026-06-18-image-loading-polish', 'ja', '画像読み込みの調整', '初期表示外のアバターと記事画像に遅延読み込みと非同期デコードを追加しました。', '# 画像読み込みの調整

今回の更新では、公開側の重要度が低い画像読み込みを少し整理し、初期表示外の画像が読み込みとデコードに与える負荷を抑えました。

## 更新内容

- チャットルームのアバターとプロフィール画像に `loading="lazy"` と `decoding="async"` を追加し、対応するウィンドウを開くタイミングに近づけて読み込みます。
- Markdown 記事画像は引き続き `assets/images/articles/` の許可リストと安全な DOM 描画を使い、非同期デコードも追加しました。
- ホームのブランドアイコンと Start ボタン画像は現在の読み込み方式を維持し、初期表示の見え方を保ちます。
- 公開側の画像属性、fallback 更新、公開記事 seed のみを調整し、管理画面ディレクトリや管理 API には触れていません。', '2026-06-17T17:06:00.000Z', '2026-06-17T17:06:00.000Z'),
  ('seed-update-2026-06-18-chatroom-title-locale-zh', 'seed-update-2026-06-18-chatroom-title-locale', 'zh', '聊天室标题三语同步', '聊天室窗口标题现在会跟随中文、English、日本語 切换。', '# 聊天室标题三语同步

本次更新修复公开聊天室窗口标题的多语言细节，让它和页面里的其它聊天室文案保持一致。

## 更新内容

- English 界面下，聊天室窗口标题从中文“匿名聊天室”改为 `Chat Room`。
- 日本語界面下，聊天室窗口标题从中文“匿名聊天室”改为 `匿名チャット`。
- 聊天消息列表、昵称、轮询和发送逻辑不变，继续使用安全 DOM / `textContent` 渲染公开文本。
- 只调整公开主站翻译和更新记录，不触碰后台目录或管理接口。', '2026-06-17T17:16:00.000Z', '2026-06-17T17:16:00.000Z'),
  ('seed-update-2026-06-18-chatroom-title-locale-en', 'seed-update-2026-06-18-chatroom-title-locale', 'en', 'Chat Title Localization', 'The chat room window title now follows the Chinese, English, and Japanese language switch.', '# Chat Title Localization

This update fixes a small localization gap in the public chat room window title so it matches the rest of the chat UI.

## Changes

- In English, the chat room window title now shows `Chat Room` instead of the Chinese title.
- In Japanese, the chat room window title now shows `匿名チャット` instead of the Chinese title.
- Chat messages, nicknames, polling, and sending behavior are unchanged and continue to render public text through safe DOM / `textContent` paths.
- Only public site translations and update records changed; admin folders and admin APIs were not touched.', '2026-06-17T17:16:00.000Z', '2026-06-17T17:16:00.000Z'),
  ('seed-update-2026-06-18-chatroom-title-locale-ja', 'seed-update-2026-06-18-chatroom-title-locale', 'ja', 'チャット題名の多言語同期', 'チャットルームのウィンドウ題名が中文、English、日本語の切り替えに合わせて表示されます。', '# チャット題名の多言語同期

今回の更新では、公開チャットルームのウィンドウ題名に残っていた翻訳漏れを修正し、ほかのチャット文言と揃えました。

## 更新内容

- English 表示では、チャットルームのウィンドウ題名を中国語のままではなく `Chat Room` と表示します。
- 日本語表示では、チャットルームのウィンドウ題名を中国語のままではなく `匿名チャット` と表示します。
- チャットメッセージ、ニックネーム、ポーリング、送信処理は変更せず、公開テキストは引き続き安全な DOM / `textContent` 経路で描画します。
- 公開側の翻訳と更新記録だけを調整し、管理画面ディレクトリや管理 API には触れていません。', '2026-06-17T17:16:00.000Z', '2026-06-17T17:16:00.000Z'),
  ('seed-update-2026-06-18-aria-label-localization-zh', 'seed-update-2026-06-18-aria-label-localization', 'zh', '无障碍标签三语同步', '品牌、语言切换、桌面图标区和关闭按钮的 aria-label 会跟随当前语言更新。', '# 无障碍标签三语同步

本次更新把公开主站的无障碍标签也纳入语言切换，让键盘和读屏用户听到的控件名称更一致。

## 更新内容

- 新增 `data-i18n-aria-label` 与 `data-i18n-title` 同步逻辑，复用现有三语翻译表。
- 品牌返回按钮、语言切换区域、桌面图标区域和各类关闭按钮补充当前语言的 `aria-label`。
- 视频窗口最大化按钮继续使用已有 `videoFullscreen` / `videoRestore` 文案动态更新。
- 只调整公开主站 HTML / JS 与更新记录，不触碰后台目录或管理接口。', '2026-06-17T17:22:00.000Z', '2026-06-17T17:22:00.000Z'),
  ('seed-update-2026-06-18-aria-label-localization-en', 'seed-update-2026-06-18-aria-label-localization', 'en', 'Localized ARIA Labels', 'Brand, language switcher, desktop icon group, and close-button aria labels now follow the active language.', '# Localized ARIA Labels

This update brings public site accessibility labels into the language-switching path, so keyboard and screen-reader users get control names in the active language.

## Changes

- Added `data-i18n-aria-label` and `data-i18n-title` synchronization using the existing trilingual translation table.
- The brand home button, language switcher, desktop icon group, and close buttons now receive active-language `aria-label` text.
- The video window maximize button keeps using the existing dynamic `videoFullscreen` / `videoRestore` labels.
- Only public site HTML / JS and update records changed; admin folders and admin APIs were not touched.', '2026-06-17T17:22:00.000Z', '2026-06-17T17:22:00.000Z'),
  ('seed-update-2026-06-18-aria-label-localization-ja', 'seed-update-2026-06-18-aria-label-localization', 'ja', 'ARIAラベルの多言語同期', 'ブランド、言語切り替え、デスクトップアイコン領域、閉じるボタンの aria-label が現在の言語に合わせて変わります。', '# ARIAラベルの多言語同期

今回の更新では、公開サイトのアクセシビリティラベルも言語切り替えの対象にし、キーボード操作や読み上げで聞こえる名前を現在の言語に揃えました。

## 更新内容

- 既存の三言語翻訳表を使う `data-i18n-aria-label` と `data-i18n-title` の同期処理を追加しました。
- ブランドのホームボタン、言語切り替え、デスクトップアイコン領域、各種閉じるボタンに現在言語の `aria-label` を設定します。
- 動画ウィンドウの最大化ボタンは、既存の `videoFullscreen` / `videoRestore` 文言による動的更新を維持します。
- 公開側の HTML / JS と更新記録だけを調整し、管理画面ディレクトリや管理 API には触れていません。', '2026-06-17T17:22:00.000Z', '2026-06-17T17:22:00.000Z'),
  ('seed-update-2026-06-18-account-widget-locale-zh', 'seed-update-2026-06-18-account-widget-locale', 'zh', '账号弹窗三语同步', '顶部账号/云存档弹窗的登录、注册、邮箱和云存档说明会跟随当前语言显示。', '# 账号弹窗三语同步

本次更新继续整理公开主站的三语体验，把顶部账号/云存档弹窗里的静态文案接入当前语言。

## 更新内容

- 登录、注册、邮箱、密码、云存档说明、退出账号和本地状态提示改为中文 / English / 日本語 文案。
- 用户切换语言时会重新渲染账号控件，避免弹窗保留上一种语言的静态文字。
- 邮箱、后端错误信息和动态提示继续通过 `escapeHtml` 输出，避免外部文本被当作 HTML 执行。
- 只调整公开主站账号弹窗渲染和更新记录，不触碰后台目录或管理接口。', '2026-06-17T17:28:00.000Z', '2026-06-17T17:28:00.000Z'),
  ('seed-update-2026-06-18-account-widget-locale-en', 'seed-update-2026-06-18-account-widget-locale', 'en', 'Account Popover Localization', 'The account and cloud-save popover now localizes login, register, email, and cloud-save copy.', '# Account Popover Localization

This update continues the public site''s trilingual polish by moving static account and cloud-save popover copy into the active language.

## Changes

- Login, register, email, password, cloud-save notes, sign-out, and local status messages now have Chinese, English, and Japanese copy.
- Switching languages re-renders the account widget so the popover does not keep stale static text.
- Email addresses, backend error messages, and dynamic notices still pass through `escapeHtml`, so external text is not executed as HTML.
- Only public site account popover rendering and update records changed; admin folders and admin APIs were not touched.', '2026-06-17T17:28:00.000Z', '2026-06-17T17:28:00.000Z'),
  ('seed-update-2026-06-18-account-widget-locale-ja', 'seed-update-2026-06-18-account-widget-locale', 'ja', 'アカウント表示の多言語同期', 'アカウントとクラウドセーブのポップオーバー文言が現在の言語に合わせて表示されます。', '# アカウント表示の多言語同期

今回の更新では、公開サイトの三言語体験を整えるため、上部のアカウント / クラウドセーブ表示の固定文言を現在の言語に接続しました。

## 更新内容

- ログイン、登録、メール、パスワード、クラウドセーブ説明、ログアウト、ローカル状態メッセージを中文 / English / 日本語で用意しました。
- 言語を切り替えたときにアカウントウィジェットを再描画し、ポップオーバーに前の言語の固定文言が残らないようにしました。
- メールアドレス、バックエンドのエラーメッセージ、動的通知は引き続き `escapeHtml` を通し、外部テキストを HTML として実行しません。
- 公開側のアカウント表示と更新記録だけを調整し、管理画面ディレクトリや管理 API には触れていません。', '2026-06-17T17:28:00.000Z', '2026-06-17T17:28:00.000Z'),
  ('seed-update-2026-06-18-notepad-menu-locale-zh', 'seed-update-2026-06-18-notepad-menu-locale', 'zh', '杂谈菜单三语同步', '杂谈区 Notepad 风格菜单现在会跟随当前语言显示。', '# 杂谈菜单三语同步

本次更新修正杂谈区顶部 Notepad 风格菜单的静态语言，让它和杂谈区标题、卡片按钮一起跟随站点语言切换。

## 更新内容

- 中文界面显示 `文件  编辑  查看  帮助`。
- English 界面继续显示 `File  Edit  View  Help`。
- 日本語界面显示 `ファイル  編集  表示  ヘルプ`。
- 只调整公开主站静态菜单文案和更新记录，不改杂谈卡片 DOM / `textContent` 安全渲染逻辑。', '2026-06-17T17:33:00.000Z', '2026-06-17T17:33:00.000Z'),
  ('seed-update-2026-06-18-notepad-menu-locale-en', 'seed-update-2026-06-18-notepad-menu-locale', 'en', 'Talk Menu Localization', 'The Talk area Notepad-style menu now follows the active site language.', '# Talk Menu Localization

This update fixes the static language on the Talk area''s Notepad-style menu so it follows the site language with the rest of the Talk window.

## Changes

- Chinese shows `文件  编辑  查看  帮助`.
- English keeps `File  Edit  View  Help`.
- Japanese shows `ファイル  編集  表示  ヘルプ`.
- Only public site static menu copy and update records changed; the Talk card DOM / `textContent` safe rendering path was not changed.', '2026-06-17T17:33:00.000Z', '2026-06-17T17:33:00.000Z'),
  ('seed-update-2026-06-18-notepad-menu-locale-ja', 'seed-update-2026-06-18-notepad-menu-locale', 'ja', '雑談メニューの多言語同期', '雑談欄の Notepad 風メニューが現在のサイト言語に合わせて表示されます。', '# 雑談メニューの多言語同期

今回の更新では、雑談欄上部の Notepad 風メニューに残っていた固定言語を修正し、雑談ウィンドウのほかの文言と同じようにサイト言語へ合わせました。

## 更新内容

- 中文表示では `文件  编辑  查看  帮助` を表示します。
- English 表示では `File  Edit  View  Help` を維持します。
- 日本語表示では `ファイル  編集  表示  ヘルプ` を表示します。
- 公開側の静的メニュー文言と更新記録だけを調整し、雑談カードの DOM / `textContent` 安全描画経路は変更していません。', '2026-06-17T17:33:00.000Z', '2026-06-17T17:33:00.000Z'),
  ('seed-update-2026-06-18-game-cover-decoding-zh', 'seed-update-2026-06-18-game-cover-decoding', 'zh', '游戏封面异步解码', '游戏区封面图在懒加载基础上补充异步解码。', '# 游戏封面异步解码

本次更新继续补齐公开主站的轻量性能细节，让游戏区封面图在懒加载之外也使用异步解码。

## 更新内容

- 游戏区动态渲染的 `game-cover` 图片补充 `decoding="async"`。
- 保留已有 `loading="lazy"`，减少打开游戏列表时的图片加载和解码压力。
- 游戏目录、云存档、入口链接和游戏运行逻辑保持不变。
- 只调整公开主站游戏列表图片属性和更新记录，不触碰后台目录或管理接口。', '2026-06-17T17:38:00.000Z', '2026-06-17T17:38:00.000Z'),
  ('seed-update-2026-06-18-game-cover-decoding-en', 'seed-update-2026-06-18-game-cover-decoding', 'en', 'Async Game Cover Decoding', 'Game cover images now add async decoding on top of lazy loading.', '# Async Game Cover Decoding

This update continues the public site''s lightweight performance polish by adding async decoding to game cover images.

## Changes

- Dynamically rendered `game-cover` images now include `decoding="async"`.
- Existing `loading="lazy"` behavior stays in place, reducing image load and decode pressure when the games list opens.
- Game catalog data, cloud saves, entry links, and game runtime behavior are unchanged.
- Only public site game-list image attributes and update records changed; admin folders and admin APIs were not touched.', '2026-06-17T17:38:00.000Z', '2026-06-17T17:38:00.000Z'),
  ('seed-update-2026-06-18-game-cover-decoding-ja', 'seed-update-2026-06-18-game-cover-decoding', 'ja', 'ゲームカバーの非同期デコード', 'ゲーム欄のカバー画像に、遅延読み込みに加えて非同期デコードを追加しました。', '# ゲームカバーの非同期デコード

今回の更新では、公開サイトの軽量な性能調整として、ゲーム欄のカバー画像に非同期デコードを追加しました。

## 更新内容

- 動的に描画される `game-cover` 画像に `decoding="async"` を追加しました。
- 既存の `loading="lazy"` は維持し、ゲーム一覧を開くときの画像読み込みとデコード負荷を抑えます。
- ゲームカタログ、クラウドセーブ、入口リンク、ゲーム実行ロジックは変更していません。
- 公開側のゲーム一覧画像属性と更新記録だけを調整し、管理画面ディレクトリや管理 API には触れていません。', '2026-06-17T17:38:00.000Z', '2026-06-17T17:38:00.000Z'),
  ('seed-update-2026-06-18-game-language-labels-zh', 'seed-update-2026-06-18-game-language-labels', 'zh', '游戏语言标记三语同步', '游戏卡片里的语言支持标记现在会跟随当前站点语言显示。', '# 游戏语言标记三语同步

本次更新整理游戏区卡片里的语言支持标记，减少 English / 日本語 页面里的固定中文混杂。

## 更新内容

- 中文界面显示 `中文 / 英文 / 日文`。
- English 界面显示 `Chinese / English / Japanese`。
- 日本語界面显示 `中国語 / 英語 / 日本語`。
- 不支持状态的 `title` 提示也使用当前语言；✓ / × 状态、游戏目录、云存档和入口链接逻辑保持不变。', '2026-06-17T17:43:00.000Z', '2026-06-17T17:43:00.000Z'),
  ('seed-update-2026-06-18-game-language-labels-en', 'seed-update-2026-06-18-game-language-labels', 'en', 'Game Language Labels', 'Game-card language support tags now localize their language names and unsupported hints.', '# Game Language Labels

This update cleans up the language support tags on game cards so English and Japanese pages do not keep fixed Chinese labels.

## Changes

- Chinese shows `中文 / 英文 / 日文`.
- English shows `Chinese / English / Japanese`.
- Japanese shows `中国語 / 英語 / 日本語`.
- Unsupported-state `title` hints also use the active language; ✓ / × status, game catalog data, cloud saves, and entry links are unchanged.', '2026-06-17T17:43:00.000Z', '2026-06-17T17:43:00.000Z'),
  ('seed-update-2026-06-18-game-language-labels-ja', 'seed-update-2026-06-18-game-language-labels', 'ja', 'ゲーム言語ラベルの多言語同期', 'ゲームカードの対応言語タグが、現在のサイト言語に合わせて表示されます。', '# ゲーム言語ラベルの多言語同期

今回の更新では、ゲームカードの対応言語タグを整理し、English / 日本語 ページに固定の中国語ラベルが混ざらないようにしました。

## 更新内容

- 中文表示では `中文 / 英文 / 日文` を表示します。
- English 表示では `Chinese / English / Japanese` を表示します。
- 日本語表示では `中国語 / 英語 / 日本語` を表示します。
- 未対応状態の `title` ヒントも現在の言語を使います。✓ / × の状態、ゲームカタログ、クラウドセーブ、入口リンクは変更していません。', '2026-06-17T17:43:00.000Z', '2026-06-17T17:43:00.000Z'),
  ('seed-update-2026-06-18-game-shell-locale-zh', 'seed-update-2026-06-18-game-shell-locale', 'zh', '游戏外壳三语同步', '游戏入口页的共享外壳文案现在会跟随站点语言显示。', '# 游戏外壳三语同步

本次更新整理每个游戏入口页外层工具栏的三语体验，让 `?lang=en` 和 `?lang=ja` 不再混入固定中文外壳文案。

## 更新内容

- 返回游戏区、加载状态、本地存档工具、导入导出按钮、云端存档面板、协议链接和状态提示会跟随当前语言显示。
- 游戏标题、iframe 标题和语言支持副标题使用当前站点语言。
- 5 个游戏入口页的 `game-shell.js` 增加缓存版本，帮助浏览器获取新外壳脚本。
- 游戏本体 iframe、启动语言、云存档同步、导入导出逻辑保持不变。', '2026-06-17T17:55:00.000Z', '2026-06-17T17:55:00.000Z'),
  ('seed-update-2026-06-18-game-shell-locale-en', 'seed-update-2026-06-18-game-shell-locale', 'en', 'Localized Game Shell', 'The shared game entry shell now follows the active site language.', '# Localized Game Shell

This update localizes the shared wrapper around each game entry page, so `?lang=en` and `?lang=ja` no longer keep fixed Chinese shell controls.

## Changes

- Back links, loading text, local-save tools, import/export buttons, cloud-save panels, license links, and status messages follow the active language.
- Game titles, iframe titles, and language-support subtitles use the current site language.
- All five game entry pages now request `game-shell.js` with a new cache version.
- The embedded game iframe, launch language, cloud-save sync, and import/export behavior are unchanged.', '2026-06-17T17:55:00.000Z', '2026-06-17T17:55:00.000Z'),
  ('seed-update-2026-06-18-game-shell-locale-ja', 'seed-update-2026-06-18-game-shell-locale', 'ja', 'ゲームシェルの多言語同期', 'ゲーム入口ページの共通シェルが現在のサイト言語に合わせて表示されます。', '# ゲームシェルの多言語同期

今回の更新では、各ゲーム入口ページを包む共通シェルを多言語化し、`?lang=en` と `?lang=ja` で固定の中国語コントロールが混ざらないようにしました。

## 更新内容

- ゲーム一覧への戻るリンク、読み込み表示、ローカルセーブツール、インポート/エクスポートボタン、クラウドセーブパネル、ライセンスリンク、状態表示が現在の言語に合わせて表示されます。
- ゲームタイトル、iframe タイトル、対応言語のサブタイトルも現在のサイト言語を使います。
- 5 つのゲーム入口ページで `game-shell.js` に新しいキャッシュ版を付けました。
- 埋め込みゲーム iframe、起動言語、クラウドセーブ同期、インポート/エクスポートの動作は変更していません。', '2026-06-17T17:55:00.000Z', '2026-06-17T17:55:00.000Z'),
  ('seed-update-2026-06-18-resource-placeholder-hints-zh', 'seed-update-2026-06-18-resource-placeholder-hints', 'zh', '资源占位提示补齐', '资源区准备中的占位按钮现在会说明暂时没有下载或外链。', '# 资源占位提示补齐

本次更新继续整理资源区的占位体验，让没有真实 URL 的资源按钮不只显示“准备中”，也能说明原因。

## 更新内容

- 没有下载或外链的资源按钮增加中文 / English / 日本語 的 `title` 和 `aria-label`。
- 占位按钮继续保持 disabled，并补充 `aria-disabled="true"`。
- 既有 URL 白名单、资源数据结构和安全 DOM 渲染逻辑不变。
- 只调整公开主站资源区提示和更新记录，不触碰后台目录或管理接口。', '2026-06-17T18:00:00.000Z', '2026-06-17T18:00:00.000Z'),
  ('seed-update-2026-06-18-resource-placeholder-hints-en', 'seed-update-2026-06-18-resource-placeholder-hints', 'en', 'Resource Placeholder Hints', 'Coming-soon resource buttons now explain when no download or external link is available.', '# Resource Placeholder Hints

This update continues polishing the Resources area so placeholder buttons explain why they are not clickable yet.

## Changes

- Resource buttons without a download or external link now include localized `title` and `aria-label` text in Chinese, English, and Japanese.
- Placeholder buttons remain disabled and now include `aria-disabled="true"`.
- The existing URL allowlist, resource data shape, and safe DOM rendering path are unchanged.
- Only public Resources hints and update records changed; admin folders and admin APIs were not touched.', '2026-06-17T18:00:00.000Z', '2026-06-17T18:00:00.000Z'),
  ('seed-update-2026-06-18-resource-placeholder-hints-ja', 'seed-update-2026-06-18-resource-placeholder-hints', 'ja', 'リソース準備中ヒント', '準備中のリソースボタンが、ダウンロードや外部リンクがまだないことを説明します。', '# リソース準備中ヒント

今回の更新では、リソース欄の占位表示を少し整え、リンクのないボタンがなぜクリックできないのかを分かりやすくしました。

## 更新内容

- ダウンロードや外部リンクがないリソースボタンに、中文 / English / 日本語 の `title` と `aria-label` を追加しました。
- 占位ボタンは引き続き disabled のまま、`aria-disabled="true"` も追加しました。
- 既存の URL 許可リスト、リソースデータ構造、安全な DOM 描画経路は変更していません。
- 公開側のリソース欄ヒントと更新記録だけを調整し、管理画面ディレクトリや管理 API には触れていません。', '2026-06-17T18:00:00.000Z', '2026-06-17T18:00:00.000Z'),
  ('seed-update-2026-06-18-video-thumb-decoding-zh', 'seed-update-2026-06-18-video-thumb-decoding', 'zh', '视频缩略图异步解码', '公开视频卡片缩略图现在会在懒加载之外使用异步解码。', '# 视频缩略图异步解码

本次更新继续做公开主站的轻量性能整理，把视频区缩略图的图片加载策略和文章配图、游戏封面对齐。

## 更新内容

- 公开视频卡片缩略图在已有 `loading="lazy"` 基础上增加 `decoding="async"`。
- 视频列表、视频分类、播放窗口、外链白名单和公开视频 API 行为不变。
- 当前没有公开视频时，视频区仍显示原有 XP 风格空状态。
- 只调整公开主站视频卡片图片属性和更新记录，不触碰后台目录或管理接口。', '2026-06-17T18:07:00.000Z', '2026-06-17T18:07:00.000Z'),
  ('seed-update-2026-06-18-video-thumb-decoding-en', 'seed-update-2026-06-18-video-thumb-decoding', 'en', 'Async Video Thumbnail Decoding', 'Public video card thumbnails now use async decoding in addition to lazy loading.', '# Async Video Thumbnail Decoding

This update continues lightweight public-site performance polish by aligning video thumbnails with article images and game covers.

## Changes

- Public video card thumbnails now add `decoding="async"` alongside the existing `loading="lazy"` behavior.
- Video lists, categories, playback windows, external-link allowlists, and public video API behavior are unchanged.
- When there are no public videos, the Videos area keeps the existing XP-style empty state.
- Only public video-card image attributes and update records changed; admin folders and admin APIs were not touched.', '2026-06-17T18:07:00.000Z', '2026-06-17T18:07:00.000Z'),
  ('seed-update-2026-06-18-video-thumb-decoding-ja', 'seed-update-2026-06-18-video-thumb-decoding', 'ja', '動画サムネイルの非同期デコード', '公開動画カードのサムネイルが、遅延読み込みに加えて非同期デコードを使うようになりました。', '# 動画サムネイルの非同期デコード

今回の更新では、公開サイトの軽量な性能調整として、動画サムネイルの画像読み込み方を記事画像やゲームカバーと揃えました。

## 更新内容

- 公開動画カードのサムネイルに、既存の `loading="lazy"` に加えて `decoding="async"` を追加しました。
- 動画一覧、カテゴリ、再生ウィンドウ、外部リンク許可リスト、公開動画 API の動作は変更していません。
- 公開動画がない場合、動画欄はこれまで通り XP 風の空状態を表示します。
- 公開側の動画カード画像属性と更新記録だけを調整し、管理画面ディレクトリや管理 API には触れていません。', '2026-06-17T18:07:00.000Z', '2026-06-17T18:07:00.000Z'),
  ('seed-update-2026-06-18-resource-label-sync-zh', 'seed-update-2026-06-18-resource-label-sync', 'zh', '资源入口文案对齐', '资源区桌面入口的英文和日文名称现在与资源窗口标题一致。', '# 资源入口文案对齐

本次更新修正资源区桌面图标的英文和日文名称，让入口名称与打开后的资源窗口标题保持一致。

## 更新内容

- English 桌面入口从 `Files TBD` 改为 `Resources TBD`。
- 日本語桌面入口从 `資料（未定）` 改为 `リソース（未定）`。
- 中文入口继续显示 `资源区（待定）`。
- 资源区路由、占位状态、资源数据和安全 DOM 渲染逻辑保持不变。', '2026-06-17T18:10:00.000Z', '2026-06-17T18:10:00.000Z'),
  ('seed-update-2026-06-18-resource-label-sync-en', 'seed-update-2026-06-18-resource-label-sync', 'en', 'Resources Label Sync', 'The Resources desktop icon now matches the Resources window label in English and Japanese.', '# Resources Label Sync

This update aligns the Resources desktop icon text with the title of the Resources window that opens from it.

## Changes

- The English desktop icon now says `Resources TBD` instead of `Files TBD`.
- The Japanese desktop icon now says `リソース（未定）` instead of `資料（未定）`.
- The Chinese icon keeps `资源区（待定）`.
- Resource routes, placeholder state, resource data, and safe DOM rendering are unchanged.', '2026-06-17T18:10:00.000Z', '2026-06-17T18:10:00.000Z'),
  ('seed-update-2026-06-18-resource-label-sync-ja', 'seed-update-2026-06-18-resource-label-sync', 'ja', 'リソース入口ラベル同期', 'リソースのデスクトップ入口名を、リソースウィンドウの名称に合わせました。', '# リソース入口ラベル同期

今回の更新では、リソース欄のデスクトップアイコン名を、開いた後のリソースウィンドウ名と揃えました。

## 更新内容

- English 表示のデスクトップ入口を `Files TBD` から `Resources TBD` に変更しました。
- 日本語表示のデスクトップ入口を `資料（未定）` から `リソース（未定）` に変更しました。
- 中文入口は `资源区（待定）` のままです。
- リソース欄のルート、占位状態、リソースデータ、安全な DOM 描画経路は変更していません。', '2026-06-17T18:10:00.000Z', '2026-06-17T18:10:00.000Z'),
  ('seed-update-2026-06-18-game-shell-safe-dom-zh', 'seed-update-2026-06-18-game-shell-safe-dom', 'zh', '游戏外壳安全 DOM 渲染', '游戏入口页的云存档面板和协议栏改为更安全的 DOM/textContent 构建。', '# 游戏外壳安全 DOM 渲染

本次更新收紧游戏入口页外层工具栏的公开渲染路径，让云存档信息和协议链接都通过 DOM API 构建。

## 更新内容

- 云存档面板不再用字符串 `innerHTML` 拼接，邮箱、状态提示和按钮文案都通过 `textContent` 渲染。
- 协议栏改为 DOM 构建，协议文件只接受相对路径，上游仓库只接受 `http(s)` 链接。
- 5 个游戏入口页更新 `game-shell.js` 缓存版本，帮助浏览器获取新脚本。
- 游戏 iframe、启动语言、云存档同步和导入导出逻辑保持不变。', '2026-06-17T18:15:00.000Z', '2026-06-17T18:15:00.000Z'),
  ('seed-update-2026-06-18-game-shell-safe-dom-en', 'seed-update-2026-06-18-game-shell-safe-dom', 'en', 'Game Shell Safe DOM', 'Game entry cloud-save panels and license links now render through safer DOM/textContent paths.', '# Game Shell Safe DOM

This update tightens the public rendering path around the shared game-entry toolbar so cloud-save information and license links are built with DOM APIs.

## Changes

- The cloud-save panel no longer builds strings with `innerHTML`; email, status text, and button labels render through `textContent`.
- The license panel now uses DOM construction, accepts only relative license-file paths, and accepts only `http(s)` upstream repository links.
- All five game entry pages now request `game-shell.js` with a new cache version.
- Game iframes, launch language, cloud-save sync, and import/export behavior are unchanged.', '2026-06-17T18:15:00.000Z', '2026-06-17T18:15:00.000Z'),
  ('seed-update-2026-06-18-game-shell-safe-dom-ja', 'seed-update-2026-06-18-game-shell-safe-dom', 'ja', 'ゲームシェルの安全な DOM 描画', 'ゲーム入口ページのクラウド保存パネルとライセンス欄を、より安全な DOM/textContent 経路にしました。', '# ゲームシェルの安全な DOM 描画

今回の更新では、ゲーム入口ページ共通ツールバーの公開描画経路を引き締め、クラウド保存情報とライセンスリンクを DOM API で構築するようにしました。

## 更新内容

- クラウド保存パネルは文字列の `innerHTML` 組み立てをやめ、メール、状態表示、ボタン文言を `textContent` で描画します。
- ライセンス欄は DOM 構築に変更し、ライセンスファイルは相対パスのみ、上流リポジトリは `http(s)` リンクのみ受け付けます。
- 5 つのゲーム入口ページで `game-shell.js` のキャッシュ版を更新しました。
- ゲーム iframe、起動言語、クラウドセーブ同期、インポート/エクスポート動作は変更していません。', '2026-06-17T18:15:00.000Z', '2026-06-17T18:15:00.000Z'),
  ('seed-update-2026-06-18-account-safe-dom-zh', 'seed-update-2026-06-18-account-safe-dom', 'zh', '账号弹窗安全 DOM 渲染', '顶部账号/云存档弹窗改为 DOM/textContent 构建。', '# 账号弹窗安全 DOM 渲染

本次更新收紧公开主站右上角账号入口的渲染方式，让账号和云存档提示继续以纯文本方式显示。

## 更新内容

- 账号弹窗不再用模板字符串 `innerHTML` 拼接，按钮、邮箱、接口错误和状态提示改为 DOM / `textContent` 构建。
- 登录、注册、退出账号、语言切换后的重渲染和云存档说明逻辑保持不变。
- 邮箱和接口错误只作为文本节点渲染，不会被当作 HTML 执行。
- 只调整公开主站账号弹窗和更新记录，不触碰后台目录或管理接口。', '2026-06-17T18:20:00.000Z', '2026-06-17T18:20:00.000Z'),
  ('seed-update-2026-06-18-account-safe-dom-en', 'seed-update-2026-06-18-account-safe-dom', 'en', 'Account Popover Safe DOM', 'The top account and cloud-save popover now renders through DOM/textContent.', '# Account Popover Safe DOM

This update tightens the rendering path for the public site''s top-right account entry so account and cloud-save notices stay plain text.

## Changes

- The account popover no longer builds markup with template-string `innerHTML`; buttons, email, API errors, and status notices are created through DOM / `textContent`.
- Login, registration, sign-out, language-switch re-rendering, and cloud-save copy are unchanged.
- Email addresses and API errors render only as text nodes and are not interpreted as HTML.
- Only the public account popover and update records changed; admin folders and admin APIs were not touched.', '2026-06-17T18:20:00.000Z', '2026-06-17T18:20:00.000Z'),
  ('seed-update-2026-06-18-account-safe-dom-ja', 'seed-update-2026-06-18-account-safe-dom', 'ja', 'アカウント表示の安全な DOM 描画', '上部アカウント/クラウド保存表示を DOM/textContent 描画にしました。', '# アカウント表示の安全な DOM 描画

今回の更新では、公開サイト右上のアカウント入口の描画経路を引き締め、アカウントとクラウド保存の案内を純テキストとして表示します。

## 更新内容

- アカウント表示はテンプレート文字列の `innerHTML` 組み立てをやめ、ボタン、メール、API エラー、状態表示を DOM / `textContent` で構築します。
- ログイン、登録、ログアウト、言語切り替え後の再描画、クラウド保存説明は変更していません。
- メールアドレスと API エラーはテキストノードとしてのみ描画され、HTML として解釈されません。
- 公開側のアカウント表示と更新記録だけを調整し、管理画面ディレクトリや管理 API には触れていません。', '2026-06-17T18:20:00.000Z', '2026-06-17T18:20:00.000Z')
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
insert into articles (
  article_id, slug, category, tags, cover_image, status, is_pinned,
  view_count, created_at, updated_at, published_at
) values (
  'seed-update-2026-06-15-managed-video-system',
  '2026-06-15-managed-video-system',
  'site-updates',
  '["网站更新","视频区","后台"]',
  '',
  'published',
  0,
  0,
  '2026-06-15T08:30:00.000Z',
  '2026-06-15T08:30:00.000Z',
  '2026-06-15T08:30:00.000Z'
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
