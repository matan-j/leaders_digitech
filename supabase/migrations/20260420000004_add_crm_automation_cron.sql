-- Schedule daily CRM automation cron at 09:00
SELECT cron.schedule(
  'crm-automation-daily',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://icwidsqbydgycuedhznc.supabase.co/functions/v1/crm-automation-cron',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.service_role_key', true) || '"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
