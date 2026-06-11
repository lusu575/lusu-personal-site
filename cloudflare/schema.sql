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
  )
on conflict(article_id, lang) do update set
  title = excluded.title,
  summary = excluded.summary,
  content_markdown = excluded.content_markdown,
  updated_at = excluded.updated_at;
