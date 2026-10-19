BEGIN;
CREATE TABLE IF NOT EXISTS registration_verifications (
 id UUID PRIMARY KEY,
 email TEXT NOT NULL UNIQUE,
 name TEXT NOT NULL,
 phone TEXT NOT NULL,
 password_hash TEXT NOT NULL,
 expires_at TIMESTAMPTZ NOT NULL,
 resend_at TIMESTAMPTZ NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE registration_verifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON registration_verifications FROM PUBLIC, anon, authenticated;
COMMIT;
