const { pool } = require('../config/database');

class Payment {
    /**
     * Create a new payment record / invoice
     */
    static async create(paymentData) {
        const {
            tenant_id,
            stall_id,
            amount,
            due_date,
            payment_date,
            status,
            payment_method,
            reference_number,
            proof_image,
            paymongo_checkout_id,
            paymongo_checkout_url,
            description,
            late_fee
        } = paymentData;

        const result = await pool.query(
            `INSERT INTO payments 
             (tenant_id, stall_id, amount, due_date, payment_date, 
              status, payment_method, reference_number, proof_image, 
              paymongo_checkout_id, paymongo_checkout_url, 
              description, late_fee) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) 
             RETURNING id`,
            [
                tenant_id,
                stall_id || null,
                amount,
                due_date,
                payment_date || null,
                status || 'unpaid',
                payment_method || null,
                reference_number || null,
                proof_image || null,
                paymongo_checkout_id || null,
                paymongo_checkout_url || null,
                description || 'Stall Lease Rental',
                late_fee || 0
            ]
        );

        return result.rows[0].id;
    }

    /**
     * Get all payments with filters
     */
    static async findAll(filters = {}) {
        let query = `
            SELECT p.*,
                   t.name as tenant_name, t.email as tenant_email, t.business_name,
                   s.stall_number, s.location as stall_location
            FROM payments p
            LEFT JOIN tenants t ON p.tenant_id = t.id
            LEFT JOIN stalls s ON p.stall_id = s.id
            WHERE 1=1
        `;
        const values = [];
        let paramCount = 1;

        if (filters.user_id !== undefined) {
            query += ` AND t.user_id = $${paramCount}`;
            values.push(filters.user_id);
            paramCount++;
        }

        if (filters.status) {
            query += ` AND p.status = $${paramCount}`;
            values.push(filters.status);
            paramCount++;
        }

        if (filters.tenant_id) {
            query += ` AND p.tenant_id = $${paramCount}`;
            values.push(filters.tenant_id);
            paramCount++;
        }

        if (filters.stall_id) {
            query += ` AND p.stall_id = $${paramCount}`;
            values.push(filters.stall_id);
            paramCount++;
        }

        if (filters.month) {
            query += ` AND EXTRACT(MONTH FROM p.due_date) = $${paramCount}`;
            values.push(filters.month);
            paramCount++;
        }

        if (filters.year) {
            query += ` AND EXTRACT(YEAR FROM p.due_date) = $${paramCount}`;
            values.push(filters.year);
            paramCount++;
        }

        query += ' ORDER BY p.due_date DESC, p.created_at DESC';

        const result = await pool.query(query, values);
        return result.rows;
    }

    /**
     * Get a single payment by ID
     */
    static async findById(id) {
        const result = await pool.query(
            `SELECT p.*,
                    t.name as tenant_name, t.email as tenant_email, t.phone as tenant_phone, t.business_name,
                    s.stall_number, s.location as stall_location
             FROM payments p
             LEFT JOIN tenants t ON p.tenant_id = t.id
             LEFT JOIN stalls s ON p.stall_id = s.id
             WHERE p.id = $1`,
            [id]
        );
        return result.rows[0];
    }

    /**
     * Get payments by tenant ID
     */
    static async findByTenantId(tenantId) {
        const result = await pool.query(
            `SELECT p.*,
                    s.stall_number, s.location as stall_location
             FROM payments p
             LEFT JOIN stalls s ON p.stall_id = s.id
             WHERE p.tenant_id = $1
             ORDER BY p.due_date DESC`,
            [tenantId]
        );
        return result.rows;
    }

    /**
     * Update payment
     */
    static async update(id, updateData) {
        const fields = [];
        const values = [];
        let paramCount = 1;

        Object.entries(updateData).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                fields.push(`${key} = $${paramCount}`);
                values.push(value);
                paramCount++;
            }
        });

        if (fields.length === 0) return false;

        values.push(id);
        const result = await pool.query(
            `UPDATE payments SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP 
             WHERE id = $${paramCount} RETURNING *`,
            values
        );

        return result.rows[0];
    }

    /**
     * Record payment (mark as paid via PayMongo or manual verification)
     */
    static async recordPayment(id, paymentData) {
        const {
            payment_method,
            reference_number,
            proof_image,
            paymongo_checkout_id,
            status = 'paid'
        } = paymentData;

        const result = await pool.query(
            `UPDATE payments 
             SET status = $1, 
                 payment_date = CASE WHEN $1 = 'paid' THEN CURRENT_DATE ELSE NULL END,
                 payment_method = COALESCE($2, payment_method, 'cash'),
                 reference_number = COALESCE($3, reference_number, 'SETTLED-' || TO_CHAR(CURRENT_TIMESTAMP, 'YYYYMMDD-HH24MI')),
                 proof_image = COALESCE($4, proof_image),
                 paymongo_checkout_id = COALESCE($5, paymongo_checkout_id),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $6 AND status <> 'paid'
             RETURNING *`,
            [
                status,
                payment_method || null,
                reference_number || null,
                proof_image || null,
                paymongo_checkout_id || null,
                id
            ]
        );

        return result.rows[0] || await Payment.findById(id);
    }

    /**
     * Save PayMongo checkout session URL
     */
    static async setCheckoutSession(id, checkoutId, checkoutUrl, refNumber) {
        const result = await pool.query(
            `UPDATE payments 
             SET paymongo_checkout_id = $1,
                 paymongo_checkout_url = $2,
                 reference_number = COALESCE($3, reference_number),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $4
             RETURNING *`,
            [checkoutId, checkoutUrl, refNumber, id]
        );
        return result.rows[0];
    }

    /**
     * Delete payment
     */
    static async delete(id) {
        const result = await pool.query('DELETE FROM payments WHERE id = $1', [id]);
        return result.rowCount > 0;
    }

    /**
     * Generate monthly bills for all active tenants
     */
    static async generateMonthlyBills(month, year) {
        return pool.withTransaction(async client => {
            await client.query('SELECT pg_advisory_xact_lock(739105)');
            return Payment.generateMonthlyBillsInTransaction(month, year);
        });
    }

    static async generateMonthlyBillsInTransaction(month, year) {
        month = Number(month);
        year = Number(year);
        if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 1900 || year > 9999) {
            throw new RangeError('Invalid billing month or year.');
        }
        const periodStart = `${year}-${String(month).padStart(2, '0')}-01`;
        const periodEnd = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`;
        const dateOnly = value => value instanceof Date ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}` : String(value).slice(0, 10);
        // 1. Get all active tenants with their stall monthly rents
        const activeTenantsResult = await pool.query(`
            SELECT t.id as tenant_id, t.stall_id, t.name as tenant_name, 
                   s.stall_number, s.monthly_rent, t.status, t.contract_start, t.contract_end
            FROM tenants t
            INNER JOIN stalls s ON t.stall_id = s.id
            WHERE t.status = 'active'
        `);

        const tenants = activeTenantsResult.rows.filter(t =>
            t.status === 'active' && t.stall_id && t.stall_number &&
            (!t.contract_start || dateOnly(t.contract_start) <= periodEnd) &&
            (!t.contract_end || dateOnly(t.contract_end) >= periodStart));
        const insertedBills = [];
        const dueDate = `${year}-${String(month).padStart(2, '0')}-28`; // Due on 28th of the specified month

        for (const tenant of tenants) {
            // Check if bill already exists for this tenant and month/year
            const checkResult = await pool.query(`
                SELECT id FROM payments 
                WHERE tenant_id = $1 
                AND EXTRACT(MONTH FROM due_date) = $2 
                AND EXTRACT(YEAR FROM due_date) = $3
                AND stall_id = $4
            `, [tenant.tenant_id, month, year, tenant.stall_id]);

            if (checkResult.rows.length === 0) {
                const insertResult = await pool.query(`
                    INSERT INTO payments 
                    (tenant_id, stall_id, amount, due_date, status, description)
                    VALUES ($1, $2, $3, $4, 'unpaid', $5)
                    RETURNING id
                `, [
                    tenant.tenant_id,
                    tenant.stall_id,
                    tenant.monthly_rent,
                    dueDate,
                    `Monthly Lease Rent for ${tenant.stall_number} (${month}/${year})`
                ]);

                insertedBills.push({
                    id: insertResult.rows[0].id,
                    stall: tenant.stall_number,
                    amount: tenant.monthly_rent
                });
            }
        }

        return insertedBills;
    }

    /**
     * Get payment statistics
     */
    static async getStats() {
        const result = await pool.query(`
            SELECT 
                COUNT(*) as total,
                COALESCE(SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END), 0) as paid,
                COALESCE(SUM(CASE WHEN status = 'unpaid' THEN 1 ELSE 0 END), 0) as unpaid,
                COALESCE(SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END), 0) as overdue,
                COALESCE(SUM(CASE WHEN status = 'pending_verification' THEN 1 ELSE 0 END), 0) as pending_verification,
                COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) as total_collected,
                COALESCE(SUM(CASE WHEN status IN ('unpaid', 'overdue') THEN amount + COALESCE(late_fee, 0) ELSE 0 END), 0) as total_outstanding,
                COALESCE(SUM(CASE WHEN status IN ('unpaid', 'overdue') AND (due_date = CURRENT_DATE OR due_date < CURRENT_DATE) THEN amount + COALESCE(late_fee, 0) ELSE 0 END), 0) as today_unpaid_amount,
                COALESCE(SUM(CASE WHEN status IN ('unpaid', 'overdue') AND (due_date = CURRENT_DATE OR due_date < CURRENT_DATE) THEN 1 ELSE 0 END), 0) as today_unpaid_count
            FROM payments
        `);
        return result.rows[0];
    }

    /**
     * Get summary for single tenant
     */
    static async getTenantSummary(tenantId) {
        const result = await pool.query(`
            SELECT 
                COUNT(*) as total,
                COALESCE(SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END), 0) as paid_count,
                COALESCE(SUM(CASE WHEN status = 'unpaid' THEN 1 ELSE 0 END), 0) as unpaid_count,
                COALESCE(SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END), 0) as overdue_count,
                COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) as total_paid,
                COALESCE(SUM(CASE WHEN status IN ('unpaid', 'overdue') THEN amount + COALESCE(late_fee, 0) ELSE 0 END), 0) as total_balance
            FROM payments
            WHERE tenant_id = $1
        `, [tenantId]);
        return result.rows[0];
    }

    /**
     * Get overdue payments
     */
    static async getOverduePayments() {
        const result = await pool.query(`
            SELECT p.*,
                   t.name as tenant_name, t.email as tenant_email, t.phone as tenant_phone,
                   s.stall_number, s.location as stall_location
            FROM payments p
            LEFT JOIN tenants t ON p.tenant_id = t.id
            LEFT JOIN stalls s ON p.stall_id = s.id
            WHERE p.status IN ('unpaid', 'overdue')
            AND p.due_date < CURRENT_DATE
            ORDER BY p.due_date ASC
        `);
        return result.rows;
    }

    /**
     * Apply late fees automatically to overdue bills
     */
    static async applyLateFees() {
        const result = await pool.query(`
            UPDATE payments 
            SET late_fee = CASE 
                WHEN (CURRENT_DATE - due_date) <= 15 THEN ROUND((amount * 0.03)::numeric, 2)
                WHEN (CURRENT_DATE - due_date) <= 30 THEN ROUND((amount * 0.05)::numeric, 2)
                ELSE ROUND((amount * 0.10)::numeric, 2)
            END,
            status = 'overdue',
            updated_at = CURRENT_TIMESTAMP
            WHERE status = 'unpaid' 
            AND due_date < CURRENT_DATE
            RETURNING id, late_fee
        `);
        return result.rows;
    }

    /**
     * Monthly collection analytics report
     */
    static async getMonthlyReport(month, year) {
        const result = await pool.query(`
            SELECT 
                COUNT(*) as total_bills,
                COALESCE(SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END), 0) as paid_count,
                COALESCE(SUM(CASE WHEN status = 'unpaid' THEN 1 ELSE 0 END), 0) as unpaid_count,
                COALESCE(SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END), 0) as overdue_count,
                COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) as total_collected,
                COALESCE(SUM(CASE WHEN status IN ('unpaid', 'overdue') THEN amount + COALESCE(late_fee, 0) ELSE 0 END), 0) as total_outstanding
            FROM payments
            WHERE EXTRACT(MONTH FROM due_date) = $1 
            AND EXTRACT(YEAR FROM due_date) = $2
        `, [month, year]);

        return result.rows[0] || {
            total_bills: 0,
            paid_count: 0,
            unpaid_count: 0,
            overdue_count: 0,
            total_collected: 0,
            total_outstanding: 0
        };
    }

    /**
     * Comprehensive Analytics Engine for Daily, Weekly, Monthly, and Yearly Reporting
     */
    static async getAnalyticsReport(timeframe = 'monthly', targetYear = new Date().getFullYear()) {
        // 1. Quick Glance Real-Time Metrics
        const quickGlanceRes = await pool.query(`
            SELECT 
                COALESCE(SUM(CASE WHEN (DATE(payment_date) = CURRENT_DATE OR (payment_date IS NULL AND DATE(updated_at) = CURRENT_DATE)) AND status = 'paid' THEN amount ELSE 0 END), 0) as today_collected,
                COALESCE(SUM(CASE WHEN (payment_date >= CURRENT_DATE - INTERVAL '7 days' OR updated_at >= CURRENT_DATE - INTERVAL '7 days') AND status = 'paid' THEN amount ELSE 0 END), 0) as week_collected,
                COALESCE(SUM(CASE WHEN EXTRACT(MONTH FROM COALESCE(payment_date, updated_at)) = EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(YEAR FROM COALESCE(payment_date, updated_at)) = EXTRACT(YEAR FROM CURRENT_DATE) AND status = 'paid' THEN amount ELSE 0 END), 0) as month_collected,
                COALESCE(SUM(CASE WHEN EXTRACT(YEAR FROM COALESCE(payment_date, updated_at)) = $1 AND status = 'paid' THEN amount ELSE 0 END), 0) as year_collected,
                COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) as all_time_collected,
                COALESCE(SUM(CASE WHEN status IN ('unpaid', 'overdue') THEN amount + COALESCE(late_fee, 0) ELSE 0 END), 0) as total_outstanding,
                COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_count,
                COUNT(CASE WHEN status IN ('unpaid', 'overdue') THEN 1 END) as unpaid_count,
                COUNT(*) as total_invoices
            FROM payments
        `, [targetYear]);

        const summary = quickGlanceRes.rows[0] || {};
        const totalBills = parseInt(summary.total_invoices || 0, 10);
        const paidBills = parseInt(summary.paid_count || 0, 10);
        summary.collection_rate = totalBills > 0 ? Math.round((paidBills / totalBills) * 100) : 100;

        // 2. Payment Method Distribution Breakdown
        const methodRes = await pool.query(`
            SELECT 
                COALESCE(payment_method, 'unsettled') as method,
                COUNT(*) as count,
                COALESCE(SUM(amount), 0) as total_amount
            FROM payments
            WHERE status = 'paid'
            GROUP BY payment_method
        `);
        const paymentMethods = methodRes.rows;

        // 3. Timeframe Detailed Breakdown
        let chartData = [];

        if (timeframe === 'daily') {
            // Last 14 days
            const dailyRes = await pool.query(`
                SELECT 
                    TO_CHAR(d.date, 'Mon DD') as label,
                    TO_CHAR(d.date, 'YYYY-MM-DD') as full_date,
                    COALESCE(SUM(CASE WHEN p.status = 'paid' THEN p.amount ELSE 0 END), 0) as collected,
                    COALESCE(SUM(p.amount), 0) as expected,
                    COUNT(p.id) as count
                FROM (
                    SELECT CURRENT_DATE - (n || ' days')::interval as date
                    FROM generate_series(13, 0, -1) n
                ) d
                LEFT JOIN payments p ON DATE(COALESCE(p.payment_date, p.created_at)) = DATE(d.date)
                GROUP BY d.date
                ORDER BY d.date ASC
            `);
            chartData = dailyRes.rows;
        } else if (timeframe === 'weekly') {
            // Last 8 weeks
            const weeklyRes = await pool.query(`
                SELECT 
                    'Week ' || TO_CHAR(w.week_start, 'WW (Mon DD)') as label,
                    COALESCE(SUM(CASE WHEN p.status = 'paid' THEN p.amount ELSE 0 END), 0) as collected,
                    COALESCE(SUM(p.amount), 0) as expected,
                    COUNT(p.id) as count
                FROM (
                    SELECT (DATE_TRUNC('week', CURRENT_DATE) - (n || ' weeks')::interval)::date as week_start
                    FROM generate_series(7, 0, -1) n
                ) w
                LEFT JOIN payments p ON DATE_TRUNC('week', COALESCE(p.payment_date, p.created_at)) = w.week_start
                GROUP BY w.week_start
                ORDER BY w.week_start ASC
            `);
            chartData = weeklyRes.rows;
        } else if (timeframe === 'yearly') {
            // 4-year trend
            const yearlyRes = await pool.query(`
                SELECT 
                    y.year::text as label,
                    COALESCE(SUM(CASE WHEN p.status = 'paid' THEN p.amount ELSE 0 END), 0) as collected,
                    COALESCE(SUM(p.amount), 0) as expected,
                    COUNT(p.id) as count
                FROM (
                    SELECT generate_series($1 - 3, $1 + 1) as year
                ) y
                LEFT JOIN payments p ON EXTRACT(YEAR FROM COALESCE(p.payment_date, p.due_date)) = y.year
                GROUP BY y.year
                ORDER BY y.year ASC
            `, [targetYear]);
            chartData = yearlyRes.rows;
        } else {
            // Monthly for target year (Jan to Dec)
            const monthlyRes = await pool.query(`
                SELECT 
                    TO_CHAR(TO_DATE(m.month::text, 'MM'), 'Mon') as label,
                    m.month as month_num,
                    COALESCE(SUM(CASE WHEN p.status = 'paid' THEN p.amount ELSE 0 END), 0) as collected,
                    COALESCE(SUM(p.amount), 0) as expected,
                    COALESCE(SUM(CASE WHEN p.status IN ('unpaid', 'overdue') THEN p.amount ELSE 0 END), 0) as outstanding,
                    COUNT(p.id) as count
                FROM (
                    SELECT generate_series(1, 12) as month
                ) m
                LEFT JOIN payments p ON EXTRACT(MONTH FROM COALESCE(p.payment_date, p.due_date)) = m.month 
                                    AND EXTRACT(YEAR FROM COALESCE(p.payment_date, p.due_date)) = $1
                GROUP BY m.month
                ORDER BY m.month ASC
            `, [targetYear]);
            chartData = monthlyRes.rows;
        }

        return {
            summary,
            paymentMethods,
            timeframe,
            year: targetYear,
            chartData
        };
    }

    /**
     * Get Stalls Billing & Dues Master Overview
     * Returns all stalls alphabetically, with stalls having due/unpaid rent floated to the top!
     */
    static async getStallsBillingOverview(search = '') {
        let query = `
            SELECT 
                s.id as stall_id,
                s.stall_number,
                s.location as stall_location,
                s.size as stall_size,
                s.monthly_rent,
                CASE WHEN s.description LIKE '[Billing: DAILY]%' THEN 'daily' ELSE 'monthly' END as rent_type,
                s.status as stall_status,
                t.id as tenant_id,
                t.name as tenant_name,
                t.business_name,
                t.phone as tenant_phone,
                t.email as tenant_email,
                -- Active due info
                due_p.id as active_due_id,
                due_p.amount as active_due_amount,
                due_p.due_date as active_due_date,
                due_p.status as active_due_status,
                due_p.late_fee as active_late_fee,
                due_p.description as active_due_description,
                -- Aggregates
                COALESCE(agg.total_unpaid_amount, 0) as total_unpaid_amount,
                COALESCE(agg.unpaid_invoices_count, 0) as unpaid_invoices_count,
                COALESCE(agg.total_paid_amount, 0) as total_paid_amount,
                COALESCE(agg.paid_invoices_count, 0) as paid_invoices_count,
                agg.latest_payment_date,
                agg.latest_payment_method,
                agg.latest_reference_number
            FROM stalls s
            LEFT JOIN tenants t ON t.stall_id = s.id AND t.status = 'active'
            LEFT JOIN LATERAL (
                SELECT * FROM payments 
                WHERE (stall_id = s.id OR (tenant_id = t.id AND tenant_id IS NOT NULL))
                  AND status IN ('overdue', 'unpaid', 'pending_verification')
                ORDER BY 
                    CASE WHEN status = 'overdue' THEN 1 WHEN status = 'unpaid' THEN 2 ELSE 3 END ASC,
                    due_date ASC
                LIMIT 1
            ) due_p ON true
            LEFT JOIN LATERAL (
                SELECT 
                    SUM(CASE WHEN status IN ('unpaid', 'overdue') THEN amount + COALESCE(late_fee, 0) ELSE 0 END) as total_unpaid_amount,
                    SUM(CASE WHEN status IN ('unpaid', 'overdue') THEN 1 ELSE 0 END) as unpaid_invoices_count,
                    SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as total_paid_amount,
                    SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_invoices_count,
                    MAX(CASE WHEN status = 'paid' THEN payment_date ELSE NULL END) as latest_payment_date,
                    (SELECT payment_method FROM payments WHERE (stall_id = s.id OR tenant_id = t.id) AND status = 'paid' ORDER BY payment_date DESC, created_at DESC LIMIT 1) as latest_payment_method,
                    (SELECT reference_number FROM payments WHERE (stall_id = s.id OR tenant_id = t.id) AND status = 'paid' ORDER BY payment_date DESC, created_at DESC LIMIT 1) as latest_reference_number
                FROM payments
                WHERE stall_id = s.id OR (tenant_id = t.id AND tenant_id IS NOT NULL)
            ) agg ON true
        `;

        const values = [];
        if (search) {
            query += ` WHERE s.stall_number ILIKE $1 OR s.location ILIKE $1 OR t.name ILIKE $1 OR t.business_name ILIKE $1`;
            values.push(`%${search}%`);
        }

        query += `
            ORDER BY 
                CASE 
                    WHEN due_p.status = 'overdue' THEN 1
                    WHEN due_p.status = 'unpaid' THEN 2
                    WHEN due_p.status = 'pending_verification' THEN 3
                    ELSE 4
                END ASC,
                s.stall_number ASC
        `;

        const result = await pool.query(query, values);
        return result.rows;
    }
}

module.exports = Payment;
