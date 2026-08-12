create index if not exists anonymous_chat_messages_room_ip_generation_idx
  on anonymous_chat_messages(room_key, ip_hash_key_id, ip_hash, created_at);

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

create index if not exists chat_bans_active_ip_generation_idx
  on chat_bans(active, ip_hash_key_id, ip_hash, expires_at);

create unique index if not exists transfer_items_idempotency_idx
  on transfer_items(uploader_user_id, idempotency_key)
  where idempotency_key <> '';

create unique index if not exists anonymous_chat_messages_request_idx
  on anonymous_chat_messages(visitor_id, room_key, client_request_id)
  where client_request_id <> '';

create index if not exists whiteboard_rooms_live_overview_idx
  on whiteboard_rooms(room_type, status, online_count, updated_at);

update whiteboard_bans
set
  active = 0,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
where active = 1
  and expires_at <= strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

drop index if exists whiteboard_bans_active_scope_subject_idx;

delete from whiteboard_bans
where rowid in (
  select rowid
  from (
    select
      rowid,
      row_number() over (
        partition by room_id, subject_type, subject_value
        order by active desc, expires_at desc, updated_at desc, created_at desc, rowid desc
      ) as duplicate_rank
    from whiteboard_bans
  )
  where duplicate_rank > 1
);

create unique index if not exists whiteboard_bans_scope_subject_idx
  on whiteboard_bans(room_id, subject_type, subject_value);
