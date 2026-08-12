-- MiniMax H3 production-only additive migration.
-- This file intentionally does not replay the historical full schema seed.

create table if not exists minimax_h3_runners (
  runner_id text primary key,
  owner_user_id text not null references users(id) on delete cascade,
  installation_id_hash text not null,
  label text not null,
  status text not null default 'active' check (status in ('active', 'disabled')),
  protocol_version text not null,
  agent_version text not null,
  controller_version text not null,
  capabilities_json text not null default '{}',
  ready_state text not null default 'offline' check (ready_state in ('offline', 'agent_only', 'bridge_only', 'comfy_unready', 'ready', 'busy', 'disk_low', 'error')),
  busy_job_id text not null default '',
  current_token_id text not null default '',
  last_seen_at text not null,
  last_persisted_heartbeat_at text not null,
  revision integer not null default 0,
  created_at text not null,
  updated_at text not null,
  unique(owner_user_id, installation_id_hash)
);

create table if not exists minimax_h3_jobs (
  job_id text primary key,
  owner_user_id text not null references users(id) on delete cascade,
  runner_id text not null references minimax_h3_runners(runner_id) on delete restrict,
  operation_id text not null,
  payload_sha256 text not null,
  protocol_version text not null,
  template_version text not null,
  spec_json text not null,
  prompt_sha256 text not null,
  state text not null check (state in ('awaiting_assets', 'queued', 'leased', 'validating', 'submitted', 'running', 'retrieving', 'ready', 'failed', 'stalled', 'cancelled', 'expired', 'deleted')),
  revision integer not null default 0,
  attempt integer not null default 1,
  retry_of_job_id text not null default '',
  lease_id_hash text not null default '',
  lease_generation integer not null default 0,
  lease_token_id text not null default '',
  lease_expires_at text not null default '',
  stage_code text not null default '',
  progress_basis_points integer not null default 0,
  error_code text not null default '',
  error_summary text not null default '',
  result_available integer not null default 0,
  result_name text not null default '',
  result_mime text not null default '',
  result_bytes integer not null default 0,
  result_sha256 text not null default '',
  retain_until text not null default '',
  prompt_purge_after text not null default '',
  created_at text not null,
  queued_at text not null default '',
  claimed_at text not null default '',
  started_at text not null default '',
  finished_at text not null default '',
  updated_at text not null,
  unique(owner_user_id, operation_id)
);

create table if not exists minimax_h3_job_assets (
  asset_id text primary key,
  job_id text not null references minimax_h3_jobs(job_id) on delete cascade,
  owner_user_id text not null references users(id) on delete cascade,
  role text not null check (role in ('first_frame', 'last_frame', 'ref_image', 'ref_video', 'ref_audio', 'storyboard_grid')),
  ordinal integer not null,
  display_name text not null default '',
  declared_mime text not null default '',
  declared_bytes integer not null default 0,
  verified_mime text not null default '',
  verified_bytes integer not null default 0,
  verified_sha256 text not null default '',
  upload_state text not null default 'declared' check (upload_state in ('declared', 'uploading', 'verifying', 'ready', 'failed', 'expired', 'deleted')),
  chunk_size integer not null default 8388608,
  chunk_count integer not null default 0,
  error_code text not null default '',
  created_at text not null,
  completed_at text not null default '',
  updated_at text not null,
  unique(job_id, ordinal)
);

create table if not exists minimax_h3_job_events (
  event_id text primary key,
  job_id text not null references minimax_h3_jobs(job_id) on delete cascade,
  seq integer not null,
  actor_type text not null check (actor_type in ('admin', 'runner', 'system')),
  actor_ref text not null default '',
  event_type text not null,
  from_state text not null default '',
  to_state text not null default '',
  code text not null default '',
  summary text not null default '',
  created_at text not null,
  unique(job_id, seq)
);

create table if not exists minimax_h3_operation_receipts (
  receipt_id text primary key,
  actor_type text not null,
  actor_ref text not null,
  operation_id text not null,
  action text not null,
  payload_sha256 text not null,
  response_json text not null,
  created_at text not null,
  unique(actor_type, actor_ref, operation_id)
);

create table if not exists minimax_h3_transfer_tickets (
  ticket_id text primary key,
  owner_user_id text not null references users(id) on delete cascade,
  runner_id text not null references minimax_h3_runners(runner_id) on delete restrict,
  job_id text not null references minimax_h3_jobs(job_id) on delete cascade,
  asset_id text not null default '',
  direction text not null check (direction in ('upload', 'download', 'preview')),
  secret_sha256 text not null,
  allowed_methods_json text not null,
  max_bytes integer not null default 0,
  status text not null default 'issued' check (status in ('issued', 'consumed', 'revoked', 'expired')),
  expires_at text not null,
  consumed_at text not null default '',
  created_at text not null,
  consumed_by_token_id text not null default ''
);

create index if not exists minimax_h3_runners_owner_status_idx
  on minimax_h3_runners(owner_user_id, status);
create index if not exists minimax_h3_jobs_runner_state_created_idx
  on minimax_h3_jobs(runner_id, state, created_at);
create index if not exists minimax_h3_jobs_owner_created_idx
  on minimax_h3_jobs(owner_user_id, created_at desc);
create index if not exists minimax_h3_jobs_lease_state_idx
  on minimax_h3_jobs(lease_expires_at, state);
create index if not exists minimax_h3_job_assets_job_ordinal_idx
  on minimax_h3_job_assets(job_id, ordinal);
create index if not exists minimax_h3_job_events_job_seq_idx
  on minimax_h3_job_events(job_id, seq);
create index if not exists minimax_h3_transfer_tickets_job_status_idx
  on minimax_h3_transfer_tickets(job_id, status, expires_at);
create index if not exists minimax_h3_transfer_tickets_runner_status_idx
  on minimax_h3_transfer_tickets(runner_id, status, expires_at);

insert into articles (
  article_id, slug, category, tags, cover_image, status, is_pinned,
  view_count, created_at, updated_at, published_at
) values (
  'seed-update-2026-08-12-minimax-h3-console',
  'seed-update-2026-08-12-minimax-h3-console',
  'site-updates',
  '["网站更新","工具区","ComfyUI","MiniMax H3","AI"]',
  '', 'published', 0, 0,
  '2026-08-12T08:00:00.000Z',
  '2026-08-12T08:00:00.000Z',
  '2026-08-12T08:00:00.000Z'
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
) values (
  'seed-update-2026-08-12-minimax-h3-console-zh',
  'seed-update-2026-08-12-minimax-h3-console',
  'zh',
  '在线 ComfyUI 控制面上线准备',
  '工具区新增站长专用的在线 ComfyUI · MiniMax H3 控制台，接入受保护的 Runner、本机 ComfyUI、Bridge 与任务状态读取；执行和传输开关仍默认关闭。',
  '# 在线 ComfyUI 控制面上线准备\n\n工具区现在提供站长专用的在线 ComfyUI · MiniMax H3 入口，打开的是现有 /admin/ 保护下的控制台，不是公网 ComfyUI 页面。\n\n执行、传输、Tunnel/Access、Runner token 和 GPU canary 仍需分别配置并验证；证据完成前，页面不会把未接入组件显示为在线。',
  '2026-08-12T08:00:00.000Z', '2026-08-12T08:00:00.000Z'
)
on conflict(article_id, lang) do update set title = excluded.title, summary = excluded.summary, content_markdown = excluded.content_markdown, updated_at = excluded.updated_at;

insert into article_translations (
  translation_id, article_id, lang, title, summary, content_markdown, created_at, updated_at
) values (
  'seed-update-2026-08-12-minimax-h3-console-en',
  'seed-update-2026-08-12-minimax-h3-console',
  'en',
  'Online ComfyUI Control Plane Ready for Launch',
  'Tools now includes a private Online ComfyUI · MiniMax H3 console with protected Runner, local ComfyUI, Bridge, and job-state checks; execution and transfer remain disabled by default.',
  '# Online ComfyUI Control Plane Ready for Launch\n\nTools now provides a private Online ComfyUI · MiniMax H3 entry for the site owner. It opens a protected console, not a public ComfyUI page.\n\nExecution, transfer, Tunnel/Access, the Runner token, and the GPU canary still require separate configuration and evidence; unconnected components are not shown as online before that evidence.',
  '2026-08-12T08:00:00.000Z', '2026-08-12T08:00:00.000Z'
)
on conflict(article_id, lang) do update set title = excluded.title, summary = excluded.summary, content_markdown = excluded.content_markdown, updated_at = excluded.updated_at;

insert into article_translations (
  translation_id, article_id, lang, title, summary, content_markdown, created_at, updated_at
) values (
  'seed-update-2026-08-12-minimax-h3-console-ja',
  'seed-update-2026-08-12-minimax-h3-console',
  'ja',
  'オンライン ComfyUI 制御面の公開準備',
  'ツールに所有者専用のオンライン ComfyUI · MiniMax H3 コンソールを追加しました。保護された Runner、ローカル ComfyUI、Bridge、ジョブ状態を確認できますが、実行と転送は既定で無効です。',
  '# オンライン ComfyUI 制御面の公開準備\n\nツールに所有者専用の Online ComfyUI · MiniMax H3 入口を追加しました。保護されたコンソールを開きますが、ComfyUI の画面を公開するものではありません。\n\n実行、転送、Tunnel/Access、Runner token、GPU canary は個別の設定と検証が必要です。未接続のコンポーネントはオンラインとして表示しません。',
  '2026-08-12T08:00:00.000Z', '2026-08-12T08:00:00.000Z'
)
on conflict(article_id, lang) do update set title = excluded.title, summary = excluded.summary, content_markdown = excluded.content_markdown, updated_at = excluded.updated_at;

insert into site_runtime_state (key, value, updated_at)
values ('article_seed_version', '20260812-minimax-h3-control-plane-r1', '2026-08-12T08:00:00.000Z')
on conflict(key) do update set
  value = excluded.value,
  updated_at = excluded.updated_at
where site_runtime_state.value <> excluded.value;
