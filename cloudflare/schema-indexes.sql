create index if not exists anonymous_chat_messages_room_ip_generation_idx
  on anonymous_chat_messages(room_key, ip_hash_key_id, ip_hash, created_at);

create index if not exists chat_bans_active_ip_generation_idx
  on chat_bans(active, ip_hash_key_id, ip_hash, expires_at);

create unique index if not exists transfer_items_idempotency_idx
  on transfer_items(uploader_user_id, idempotency_key)
  where idempotency_key <> '';

create unique index if not exists anonymous_chat_messages_request_idx
  on anonymous_chat_messages(visitor_id, room_key, client_request_id)
  where client_request_id <> '';
