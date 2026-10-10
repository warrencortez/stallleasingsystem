BEGIN;
CREATE TABLE IF NOT EXISTS lease_billing_schedules (
 tenant_id UUID PRIMARY KEY REFERENCES tenants(id),
 stall_id UUID NOT NULL REFERENCES stalls(id),
 frequency VARCHAR(10) NOT NULL CHECK (frequency IN ('daily','monthly')),
 amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
 anchor_date DATE NOT NULL,
 next_billing_date DATE NOT NULL,
 activated_on DATE NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS lease_billing_due ON lease_billing_schedules(next_billing_date);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS paymongo_payment_id VARCHAR(150);
CREATE UNIQUE INDEX IF NOT EXISTS payments_provider_payment_unique ON payments(paymongo_payment_id) WHERE paymongo_payment_id IS NOT NULL;
-- Capture a new lease immediately, even if the worker is offline on its first due date.
CREATE OR REPLACE FUNCTION initialize_lease_billing() RETURNS trigger AS $$
DECLARE rental stalls%ROWTYPE; first_due DATE;
BEGIN
 IF NEW.status='active' AND NEW.stall_id IS NOT NULL AND NEW.contract_start IS NOT NULL THEN
  SELECT * INTO rental FROM stalls WHERE id=NEW.stall_id;
  first_due := CASE WHEN rental.rent_type='daily' THEN NEW.contract_start + 1
                    ELSE (NEW.contract_start + INTERVAL '1 month')::date END;
  INSERT INTO lease_billing_schedules(tenant_id,stall_id,frequency,amount,anchor_date,next_billing_date,activated_on)
  VALUES(NEW.id,NEW.stall_id,CASE WHEN rental.rent_type='daily' THEN 'daily' ELSE 'monthly' END,
         CASE WHEN rental.rent_type='daily' THEN rental.daily_rent ELSE rental.monthly_rent END,
         NEW.contract_start,first_due,(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date)
  ON CONFLICT(tenant_id) DO NOTHING;
 END IF;
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS tenant_billing_schedule ON tenants;
CREATE TRIGGER tenant_billing_schedule AFTER INSERT OR UPDATE OF status,stall_id,contract_start
ON tenants FOR EACH ROW EXECUTE FUNCTION initialize_lease_billing();
COMMIT;
