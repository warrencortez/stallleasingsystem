BEGIN;
ALTER TABLE users ADD COLUMN IF NOT EXISTS supabase_user_id uuid UNIQUE;
CREATE TABLE IF NOT EXISTS support_conversation_store (
    id integer PRIMARY KEY CHECK (id = 1),
    state jsonb NOT NULL DEFAULT '{"version":1,"threads":{}}'::jsonb
);
INSERT INTO support_conversation_store(id) VALUES (1) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS auth_rate_limits (
    key text PRIMARY KEY, attempts integer NOT NULL, expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS scheduled_job_runs (
    name text PRIMARY KEY, last_success timestamptz, details jsonb
);
ALTER TABLE support_conversation_store ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_job_runs ENABLE ROW LEVEL SECURITY;
-- Browser/mobile Supabase keys are public. All application data goes through the
-- authenticated Express API; do not expose custom password hashes or tenant data via REST.
DO $$ DECLARE table_name text; BEGIN
  FOREACH table_name IN ARRAY ARRAY['users','stalls','tenants','payments','applications',
    'maintenance_requests','announcements','notifications','messages','lease_billing_schedules',
    'support_conversation_store','auth_rate_limits','scheduled_job_runs'] LOOP
    IF to_regclass('public.' || table_name) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', table_name);
    END IF;
  END LOOP;
END $$;
COMMIT;
