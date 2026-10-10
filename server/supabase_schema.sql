-- ==========================================================
-- STALL LEASING MANAGEMENT SYSTEM - FRESH SUPABASE SCHEMA
-- Zero Sample Data - Ready for Real Production Setup
-- ==========================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Clean existing tables in reverse dependency order for fresh reset
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS announcements CASCADE;
DROP TABLE IF EXISTS maintenance_requests CASCADE;
DROP TABLE IF EXISTS applications CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS tenants CASCADE;
DROP TABLE IF EXISTS stalls CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ==========================================================
-- 2. USERS & ROLES TABLE
-- ==========================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'tenant' CHECK (role IN ('admin', 'staff', 'tenant')),
    phone VARCHAR(50),
    address TEXT,
    profile_image TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================================
-- 3. STALLS TABLE
-- ==========================================================
CREATE TABLE stalls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stall_number VARCHAR(50) UNIQUE NOT NULL,
    location VARCHAR(255) NOT NULL,
    size VARCHAR(100),
    monthly_rent NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(50) NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'maintenance', 'reserved')),
    description TEXT,
    image_url TEXT,
    qr_code_data TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================================
-- 4. TENANTS TABLE
-- ==========================================================
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    stall_id UUID REFERENCES stalls(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    business_name VARCHAR(255),
    business_type VARCHAR(100),
    contract_start DATE,
    contract_end DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending', 'terminated')),
    emergency_contact VARCHAR(255),
    emergency_phone VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================================
-- 5. PAYMENTS & BILLING TABLE (Supports PayMongo & Manual Proof)
-- ==========================================================
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    stall_id UUID REFERENCES stalls(id) ON DELETE SET NULL,
    amount NUMERIC(12, 2) NOT NULL,
    due_date DATE NOT NULL,
    payment_date DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid', 'overdue', 'partial', 'pending_verification')),
    payment_method VARCHAR(50),
    reference_number VARCHAR(255),
    proof_image TEXT,
    paymongo_checkout_id VARCHAR(255),
    paymongo_checkout_url TEXT,
    description VARCHAR(255),
    late_fee NUMERIC(12, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================================
-- 6. APPLICATIONS TABLE
-- ==========================================================
CREATE TABLE applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stall_id UUID REFERENCES stalls(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    business_name VARCHAR(255) NOT NULL,
    business_type VARCHAR(100) NOT NULL,
    valid_id_url TEXT,
    business_permit_url TEXT,
    notes TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'under_review')),
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================================
-- 7. MAINTENANCE REQUESTS TABLE
-- ==========================================================
CREATE TABLE maintenance_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    stall_id UUID REFERENCES stalls(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(100) NOT NULL DEFAULT 'general' CHECK (category IN ('roof_leak', 'electrical', 'plumbing', 'structural', 'pest_control', 'general')),
    priority VARCHAR(50) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    photo_url TEXT,
    assigned_to VARCHAR(255),
    resolution_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================================
-- 8. ANNOUNCEMENTS TABLE
-- ==========================================================
CREATE TABLE announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id UUID REFERENCES users(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'general' CHECK (category IN ('event', 'market_advisory', 'billing_reminder', 'maintenance_notice', 'general')),
    is_pinned BOOLEAN DEFAULT FALSE,
    target_audience VARCHAR(50) DEFAULT 'all' CHECK (target_audience IN ('all', 'tenants', 'staff')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================================
-- 9. NOTIFICATIONS TABLE
-- ==========================================================
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'general' CHECK (type IN ('payment_success', 'rent_due', 'maintenance_update', 'application_status', 'announcement', 'general')),
    is_read BOOLEAN DEFAULT FALSE,
    link VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================================
-- 10. DIRECT MESSAGES / CHAT TABLE
-- ==========================================================
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
    receiver_id UUID REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================================
-- INDEXES FOR FAST QUERYING
-- ==========================================================
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_stalls_status ON stalls(status);
CREATE INDEX idx_stalls_number ON stalls(stall_number);
CREATE INDEX idx_tenants_user_id ON tenants(user_id);
CREATE INDEX idx_tenants_stall_id ON tenants(stall_id);
CREATE INDEX idx_tenants_status ON tenants(status);
CREATE INDEX idx_payments_tenant ON payments(tenant_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_due_date ON payments(due_date);
CREATE INDEX idx_applications_status ON applications(status);
CREATE INDEX idx_maintenance_status ON maintenance_requests(status);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX idx_messages_pair ON messages(sender_id, receiver_id);

-- ==========================================================
-- Administrator accounts must be provisioned explicitly in the database.
-- From server: set ADMIN_EMAIL and ADMIN_NAME, then run node scripts/provision-admin.cjs.
-- No shared default administrator password is installed.

-- Daily rent and office receipts upgrade (also safe for a fresh schema).
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

-- Automatic lease billing and verified provider payments
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
