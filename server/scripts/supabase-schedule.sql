-- Run manually in Supabase SQL Editor AFTER deploying the API and saving these Vault secrets:
-- stall_api_url = https://YOUR-API.vercel.app (no trailing slash)
-- stall_cron_secret = the same random 32+ character value as the backend CRON_SECRET.
-- Do not paste secrets into this tracked file.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name='stall_api_url') OR
     NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name='stall_cron_secret') THEN
    RAISE EXCEPTION 'Create stall_api_url and stall_cron_secret in Supabase Vault first.';
  END IF;
END $$;

-- Every 15 minutes reduces free-tier usage. PayMongo webhooks still confirm immediately.
SELECT cron.schedule('stall-maintenance', '*/15 * * * *', $$
  SELECT net.http_get(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='stall_api_url') || '/api/cron/maintenance',
    headers := jsonb_build_object('Authorization', 'Bearer ' ||
      (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='stall_cron_secret')),
    timeout_milliseconds := 55000
  );
$$);
-- A successful cron invocation queues HTTP; inspect net._http_response for actual HTTP results.
-- Verify scheduled_job_runs.last_success advances. To stop: SELECT cron.unschedule('stall-maintenance');
