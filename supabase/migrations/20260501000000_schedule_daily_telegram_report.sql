-- =============================================================
-- Schedule the daily Telegram execution report.
-- Runs at 15:00 Asia/Jerusalem year-round (DST-safe):
--   - Schedules at BOTH 12:00 UTC and 13:00 UTC
--   - The Edge Function self-aborts unless the local Israel hour is 15
-- =============================================================

-- Drop any prior schedules with these names (idempotent re-run)
SELECT cron.unschedule('daily-telegram-report-12utc')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-telegram-report-12utc');
SELECT cron.unschedule('daily-telegram-report-13utc')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-telegram-report-13utc');

-- Schedule 12:00 UTC (= 15:00 Israel during DST / summer)
SELECT cron.schedule(
  'daily-telegram-report-12utc',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://icwidsqbydgycuedhznc.supabase.co/functions/v1/daily-telegram-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true),
      'x-cron-secret', current_setting('app.cron_secret', true)
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Schedule 13:00 UTC (= 15:00 Israel during winter / no-DST)
SELECT cron.schedule(
  'daily-telegram-report-13utc',
  '0 13 * * *',
  $$
  SELECT net.http_post(
    url := 'https://icwidsqbydgycuedhznc.supabase.co/functions/v1/daily-telegram-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true),
      'x-cron-secret', current_setting('app.cron_secret', true)
    ),
    body := '{}'::jsonb
  );
  $$
);
