BEGIN;
ALTER TABLE public.applications DROP CONSTRAINT IF EXISTS applications_status_check;
ALTER TABLE public.applications ADD CONSTRAINT applications_status_check
CHECK (status IN ('pending','approved','rejected','under_review','cancelled'));
COMMIT;
