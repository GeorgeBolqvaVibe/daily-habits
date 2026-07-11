-- AI coaching — insights table. Run after schema.sql (same SQL Editor flow).
-- Stores generated nudges and reflection reports per user.

create table if not exists public.coach_insights (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  kind       text not null,                 -- 'nudge' | 'reflection'
  period     text,                          -- 'weekly' | 'monthly' | null (for nudges)
  content    text not null,                 -- the model's message
  stats      jsonb not null default '{}'::jsonb,  -- the numbers we fed the model
  created_at timestamptz not null default now()
);

create index if not exists coach_insights_user_idx
  on public.coach_insights (user_id, created_at desc);

alter table public.coach_insights enable row level security;

drop policy if exists "own insights" on public.coach_insights;
create policy "own insights" on public.coach_insights
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
