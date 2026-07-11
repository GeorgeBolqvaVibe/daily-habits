-- Push notification tokens. Run after schema.sql and coach.sql.

create table if not exists public.push_tokens (
  user_id     uuid not null references auth.users (id) on delete cascade,
  token       text not null,
  platform    text not null default 'unknown',   -- 'ios' | 'android' | 'web'
  updated_at  timestamptz not null default now(),
  primary key (user_id, token)
);

create index if not exists push_tokens_user_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

drop policy if exists "own push tokens" on public.push_tokens;
create policy "own push tokens" on public.push_tokens
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
