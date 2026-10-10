BEGIN;
ALTER TABLE stalls ADD COLUMN IF NOT EXISTS rent_type VARCHAR(10) NOT NULL DEFAULT 'monthly' CHECK (rent_type IN ('monthly', 'daily'));
ALTER TABLE stalls ADD COLUMN IF NOT EXISTS daily_rent NUMERIC(12,2) CHECK (daily_rent > 0);
UPDATE stalls SET rent_type = 'daily', daily_rent = monthly_rent
WHERE description LIKE '[Billing: DAILY]%' AND daily_rent IS NULL AND monthly_rent > 0;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS billing_type VARCHAR(10) CHECK (billing_type IN ('monthly','daily'));
ALTER TABLE payments ADD COLUMN IF NOT EXISTS billing_period DATE;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS received_by UUID REFERENCES users(id);
CREATE UNIQUE INDEX IF NOT EXISTS payments_generated_period_unique ON payments(tenant_id, stall_id, billing_type, billing_period) WHERE billing_type IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS payments_office_receipt_unique ON payments(LOWER(reference_number)) WHERE payment_method = 'cash_office' AND status = 'paid';
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin','tenant'));
COMMIT;
