BEGIN;
ALTER TABLE public.registration_verifications ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
COMMIT;
