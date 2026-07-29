const { pool } = require('../config/database');

class Payment {
    /**
     * Create a new payment record
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
            description,
            late_fee
        } = paymentData;

        const result = await pool.query(
            `INSERT INTO payments 
             (tenant_id, stall_id, amount, due_date, payment_date, 
              status, payment_method, reference_number, proof_image, description, late_fee) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
             RETURNING id`,
            [
                tenant_id,
                stall_id,
                amount,
                due_date,
                payment_date || null,
                status || 'unpaid',
                payment_method,
                reference_number,
                proof_image,
                description,
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
                   t.name as tenant_name, t.email as tenant_email,
                   s.stall_number, s.location
            FROM payments p
            LEFT JOIN tenants t ON p.tenant_id = t.id
            LEFT JOIN stalls s ON p.stall_id = s.id
            WHERE 1=1
        `;
        const values = [];
        let paramCount = 1;

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

        query += ' ORDER BY p.due_date DESC';

        const result = await pool.query(query, values);
        return result.rows;
    }

    /**
     * Get a single payment by ID
     */
    static async findById(id) {
        const result = await pool.query(
            `SELECT p.*,
                    t.name as tenant_name, t.email as tenant_email,
                    s.stall_number, s.location
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
                    s.stall_number, s.location
             FROM payments p
             LEFT JOIN stalls s ON p.stall_id = s.id
             WHERE p.tenant_id = $1
             ORDER BY p.due_date DESC`,
            [tenantId]
        );
        return result.rows;
    }

    /**
     * Get payments by tenant ID with status filter
     */
    static async findByTenantIdAndStatus(tenantId, status) {
        const result = await pool.query(
            `SELECT p.*,
                    s.stall_number, s.location
             FROM payments p
             LEFT JOIN stalls s ON p.stall_id = s.id
             WHERE p.tenant_id = $1 AND p.status = $2
             ORDER BY p.due_date DESC`,
            [tenantId, status]
        );
        return result.rows;
    }

    /**
     * Update a payment
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
             WHERE id = $${paramCount}`,
            values
        );

        return result.rowCount > 0;
    }

    /**
     * Update payment status
     */
    static async updateStatus(id, status, paymentDate = null) {
        const result = await pool.query(
            `UPDATE payments 
             SET status = $1, 
                 payment_date = COALESCE($2, payment_date),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $3`,
            [status, paymentDate, id]
        );
        return result.rowCount > 0;
    }

    /**
     * Record payment (mark as paid)
     */
    static async recordPayment(id, paymentData) {
        const { payment_method, reference_number, proof_image } = paymentData;
        
        const result = await pool.query(
            `UPDATE payments 
             SET status = 'paid', 
                 payment_date = CURRENT_DATE,
                 payment_method = $1,
                 reference_number = $2,
                 proof_image = COALESCE($3, proof_image),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $4
             RETURNING id, status, payment_date, payment_method, reference_number`,
            [payment_method, reference_number, proof_image, id]
        );
        
        if (result.rows.length === 0) {
            console.log('⚠️ No payment found with ID:', id);
            return false;
        }
        
        console.log('✅ Payment recorded:', result.rows[0]);
        return result.rowCount > 0;
    }

    /**
     * Delete a payment
     */
    static async delete(id) {
        const result = await pool.query('DELETE FROM payments WHERE id = $1', [id]);
        return result.rowCount > 0;
    }

    /**
     * Generate monthly bills for all active tenants
     */
    static async generateMonthlyBills(month, year) {
        try {
            // Build the date string (e.g., "2026-07-30")
            const monthStr = String(month).padStart(2, '0');
            const dateStr = `${year}-${monthStr}-30`;
            
            // Get all active tenants with their stalls
            const tenantsResult = await pool.query(
                `SELECT t.id as tenant_id, t.stall_id, s.monthly_rent
                 FROM tenants t
                 LEFT JOIN stalls s ON t.stall_id = s.id
                 WHERE t.status = 'active' 
                 AND t.stall_id IS NOT NULL`
            );

            const tenants = tenantsResult.rows;
            
            if (tenants.length === 0) {
                console.log('ℹ️ No active tenants found to generate bills');
                return [];
            }

            const insertedBills = [];

            // Loop through each tenant and create a bill
            for (const tenant of tenants) {
                // Check if bill already exists for this month
                const checkResult = await pool.query(
                    `SELECT id FROM payments 
                     WHERE tenant_id = $1 
                     AND EXTRACT(MONTH FROM due_date) = $2 
                     AND EXTRACT(YEAR FROM due_date) = $3`,
                    [tenant.tenant_id, month, year]
                );

                if (checkResult.rows.length === 0) {
                    // Create the bill
                    const insertResult = await pool.query(
                        `INSERT INTO payments 
                         (tenant_id, stall_id, amount, due_date, status, description) 
                         VALUES ($1, $2, $3, $4, 'unpaid', $5) 
                         RETURNING id`,
                        [
                            tenant.tenant_id,
                            tenant.stall_id,
                            parseFloat(tenant.monthly_rent),
                            dateStr,
                            `Monthly rent for ${month}/${year}`
                        ]
                    );
                    
                    insertedBills.push({ id: insertResult.rows[0].id });
                }
            }

            console.log(`✅ Generated ${insertedBills.length} bills for ${month}/${year}`);
            return insertedBills;
        } catch (error) {
            console.error('Generate bills error:', error);
            throw error;
        }
    }

    /**
     * Get payment statistics
     */
    static async getStats() {
        const result = await pool.query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid,
                SUM(CASE WHEN status = 'unpaid' THEN 1 ELSE 0 END) as unpaid,
                SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) as overdue,
                SUM(CASE WHEN status = 'partial' THEN 1 ELSE 0 END) as partial,
                SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as total_collected,
                SUM(CASE WHEN status IN ('unpaid', 'overdue') THEN amount + COALESCE(late_fee, 0) ELSE 0 END) as total_outstanding
            FROM payments
        `);
        return result.rows[0];
    }

    /**
     * Get payment summary for a tenant
     */
    static async getTenantSummary(tenantId) {
        const result = await pool.query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_count,
                SUM(CASE WHEN status = 'unpaid' THEN 1 ELSE 0 END) as unpaid_count,
                SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) as overdue_count,
                SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as total_paid,
                SUM(CASE WHEN status IN ('unpaid', 'overdue') THEN amount + COALESCE(late_fee, 0) ELSE 0 END) as total_balance
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
                   t.name as tenant_name, t.email as tenant_email,
                   s.stall_number, s.location
            FROM payments p
            LEFT JOIN tenants t ON p.tenant_id = t.id
            LEFT JOIN stalls s ON p.stall_id = s.id
            WHERE p.status IN ('unpaid', 'partial')
            AND p.due_date < CURRENT_DATE
            ORDER BY p.due_date ASC
        `);
        return result.rows;
    }

    /**
     * Calculate and apply late fees - FIXED
     */
    static async applyLateFees() {
        const result = await pool.query(`
            UPDATE payments 
            SET late_fee = CASE 
                WHEN (CURRENT_DATE - due_date) <= 30 THEN ROUND((amount * 0.05)::numeric, 2)
                WHEN (CURRENT_DATE - due_date) <= 60 THEN ROUND((amount * 0.10)::numeric, 2)
                ELSE ROUND((amount * 0.15)::numeric, 2)
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
     * Get monthly collection report
     */
    static async getMonthlyReport(month, year) {
        const result = await pool.query(`
            SELECT 
                COUNT(*) as total_bills,
                SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_count,
                SUM(CASE WHEN status = 'unpaid' THEN 1 ELSE 0 END) as unpaid_count,
                SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) as overdue_count,
                SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as total_collected,
                SUM(CASE WHEN status IN ('unpaid', 'overdue') THEN amount + COALESCE(late_fee, 0) ELSE 0 END) as total_outstanding
            FROM payments
            WHERE EXTRACT(MONTH FROM due_date) = $1 
            AND EXTRACT(YEAR FROM due_date) = $2
        `, [month, year]);
        
        return result.rows[0] || {
            total_bills: '0',
            paid_count: '0',
            unpaid_count: '0',
            overdue_count: '0',
            total_collected: '0',
            total_outstanding: '0'
        };
    }
}

module.exports = Payment;