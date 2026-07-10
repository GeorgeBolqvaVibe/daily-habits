-- Daily Habits — Supabase schema + Row-Level Security.
-- Run this once in the Supabase dashboard → SQL Editor → New query → Run.
-- Safe to re-run: everything is idempotent.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.habits (
  id            text primary key,
  user_id       uuid not null references auth.users (id) on delete cascade,
  name          text not null default '',
  emoji         text not null default '⭐',
  type          text not null default 'binary',        -- 'binary' | 'count'
  target        integer not null default 1,
  reminder_time text,                                   -- 'HH:MM' (24h) or null
  created_at    timestamptz not null default now(),
  completions   jsonb not null default '{}'::jsonb,     -- { 'YYYY-MM-DD': count }
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz                             -- soft delete (tombstone)
);

create table if not exists public.challenges (
  id           text primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  title        text not null default '',
  habit_id     text not null,
  days         integer not null default 3,
  start_date   text not null,                           -- 'YYYY-MM-DD'
  completed_at text,                                     -- 'YYYY-MM-DD' or null
  reward_emoji text not null default '🏆',
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

create index if not exists habits_user_id_idx on public.habits (user_id);
create index if not exists challenges_user_id_idx on public.challenges (user_id);

-- ---------------------------------------------------------------------------
-- Row-Level Security — a user can only touch their own rows.
-- ---------------------------------------------------------------------------

alter table public.habits enable row level security;
alter table public.challenges enable row level security;

drop policy if exists "own habits" on public.habits;
create policy "own habits" on public.habits
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "own challenges" on public.challenges;
create policy "own challenges" on public.challenges
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
