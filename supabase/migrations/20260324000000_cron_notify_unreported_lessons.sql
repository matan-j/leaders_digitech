CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'notify-unreported-lessons-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://icwidsqbydgycuedhznc.supabase.co/functions/v1/notify-admins-unreported-lessons',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
