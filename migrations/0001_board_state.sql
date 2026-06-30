create table if not exists mysteries (
  id text primary key,
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pins (
  id text primary key,
  mystery_id text not null references mysteries(id) on delete cascade,
  text text not null,
  x double precision not null,
  y double precision not null,
  memory_status text not null default 'ready_for_connection' check (
    memory_status in ('remembering', 'ready_for_connection', 'memory_failed')
  ),
  memory_error text,
  event_time timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists strings (
  id text primary key,
  mystery_id text not null references mysteries(id) on delete cascade,
  from_pin_id text not null references pins(id) on delete cascade,
  to_pin_id text not null references pins(id) on delete cascade,
  kind text not null check (kind in ('discovered', 'manual')),
  clue_type text not null check (
    clue_type in (
      'shared_entity',
      'temporal_proximity',
      'semantic_relation',
      'manual_connection'
    )
  ),
  explanation text not null,
  created_at timestamptz not null default now()
);

create table if not exists events (
  id text primary key,
  mystery_id text not null references mysteries(id) on delete cascade,
  name text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
