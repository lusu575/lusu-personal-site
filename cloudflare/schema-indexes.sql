create index if not exists anonymous_chat_messages_room_ip_generation_idx
  on anonymous_chat_messages(room_key, ip_hash_key_id, ip_hash, created_at);

create index if not exists chat_bans_active_ip_generation_idx
  on chat_bans(active, ip_hash_key_id, ip_hash, expires_at);
