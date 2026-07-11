-- Schedule the daily nudge push. Requires pg_cron + pg_net (both available on Supabase).
-- Adjust the cron expression to your preferred UTC hour.
--
-- Placeholders (replace before running or set as Vault secrets):
--   {PROJECT_REF} = your Supabase project ref
--   {SERVICE_ROLE_KEY} = your service_role key (Project Settings → API)

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Remove any prior schedule with the same name (idempotent).
select cron.unschedule('daily-nudge')
where exists (select 1 from cron.job where jobname = 'daily-nudge');

-- Runs every day at 15:00 UTC. Change the cron expression to shift the hour.
select cron.schedule(
  'daily-nudge',
  '0 15 * * *',
  $$
  select net.http_post(
    url := 'https://{PROJECT_REF}.supabase.co/functions/v1/send-daily-nudge',
    headers := jsonb_build_object(
      'Authorization', 'Bearer {SERVICE_ROLE_KEY}',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);
