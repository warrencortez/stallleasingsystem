BEGIN;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS auth_version INTEGER NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS public.password_recoveries (
    id UUID PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    auth_version INTEGER,
    expires_at TIMESTAMPTZ NOT NULL,
    resend_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    verified_identity UUID,
    grant_hash TEXT,
    grant_expires_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS password_recoveries_expiration_idx ON public.password_recoveries(expires_at);
ALTER TABLE public.password_recoveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.password_recoveries FROM PUBLIC, anon, authenticated;
COMMIT;
