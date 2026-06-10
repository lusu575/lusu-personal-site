create table if not exists users (
  id text primary key,
  email text not null unique,
  password_hash text not null,
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
