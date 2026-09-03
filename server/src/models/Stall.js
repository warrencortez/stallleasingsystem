const { pool } = require('../config/database');

class Stall {
    /**
     * Create a new stall (supports daily / monthly rent frequency)
     */
    static async create(stallData) {
        const { 
            stall_number, location, size, monthly_rent, 
            status, description, image_url, rent_type
        } = stallData;
        
        // Append rent_type to description or store if column exists
        let formattedDesc = description || '';
        if (rent_type) {
            formattedDesc = `[Billing: ${rent_type.toUpperCase()}] ${formattedDesc}`.trim();
        }

        const result = await pool.query(
            `INSERT INTO stalls 
             (stall_number, location, size, monthly_rent, status, description, image_url) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) 
             RETURNING id`,
            [stall_number, location, size, monthly_rent, status || 'available', formattedDesc, image_url]
        );
        
        return result.rows[0].id;
    }

    /**
     * Get all stalls with tenant and active maintenance report priority indicators
     */
    static async findAll(filters = {}) {
        let query = `
            SELECT s.*, 
                   t.id as tenant_id, t.name as tenant_name, t.business_name, t.email as tenant_email, t.phone as tenant_phone,
                   COALESCE(m.active_reports_count, 0) as active_reports_count,
                   m.highest_priority as highest_report_priority,
                   m.highest_priority_rank
            FROM stalls s
            LEFT JOIN tenants t ON s.id = t.stall_id AND t.status = 'active'
            LEFT JOIN (
                SELECT stall_id,
                       COUNT(*) as active_reports_count,
                       CASE 
                           WHEN bool_or(priority = 'urgent') THEN 'urgent'
                           WHEN bool_or(priority = 'high') THEN 'high'
                           WHEN bool_or(priority = 'medium') THEN 'medium'
                           ELSE 'low'
                       END as highest_priority,
                       MAX(
                           CASE priority 
                               WHEN 'urgent' THEN 4
                               WHEN 'high' THEN 3
                               WHEN 'medium' THEN 2
                               ELSE 1
                           END
                       ) as highest_priority_rank
                FROM maintenance_requests
                WHERE status IN ('pending', 'in_progress')
                GROUP BY stall_id
            ) m ON s.id = m.stall_id
            WHERE 1=1
        `;
        const values = [];
        let paramCount = 1;
        
        if (filters.status) {
            query += ` AND s.status = $${paramCount}`;
            values.push(filters.status);
            paramCount++;
        }
        
        if (filters.search) {
            query += ` AND (s.stall_number ILIKE $${paramCount} OR s.location ILIKE $${paramCount + 1})`;
            values.push(`%${filters.search}%`, `%${filters.search}%`);
            paramCount += 2;
        }
        
        // Priority override sorting: Stalls with active maintenance tickets appear first, ranked by highest priority (urgent > high > medium > low), then alphabetical
        query += `
            ORDER BY 
                COALESCE(m.highest_priority_rank, 0) DESC,
                s.stall_number ASC
        `;
        
        const result = await pool.query(query, values);
        return result.rows;
    }

    /**
     * Get a single stall by ID
     */
    static async findById(id) {
        const result = await pool.query(
            `SELECT s.*, 
                    t.id as tenant_id, t.name as tenant_name, t.business_name, t.email as tenant_email, t.phone as tenant_phone,
                    t.contract_start, t.contract_end, t.status as tenant_status
             FROM stalls s
             LEFT JOIN tenants t ON s.id = t.stall_id AND t.status = 'active'
             WHERE s.id = $1`,
            [id]
        );
        return result.rows[0];
    }

    /**
     * Get comprehensive details & history for a stall
     */
    static async getDetails(id) {
        // 1. Basic Stall Info + Active Tenant
        const stallResult = await pool.query(
            `SELECT s.*, 
                    t.id as active_tenant_id, t.name as active_tenant_name, 
                    t.business_name as active_business_name, t.email as active_tenant_email, 
                    t.phone as active_tenant_phone, t.contract_start, t.contract_end, 
                    t.status as active_tenant_status
             FROM stalls s
             LEFT JOIN tenants t ON s.id = t.stall_id AND t.status = 'active'
             WHERE s.id = $1`,
            [id]
        );

        if (stallResult.rows.length === 0) return null;
        const stall = stallResult.rows[0];

        // 2. Lease History (Past and Present Tenants)
        const tenantsResult = await pool.query(
            `SELECT id, name, business_name, email, phone, contract_start, contract_end, status, created_at
             FROM tenants
             WHERE stall_id = $1
             ORDER BY created_at DESC`,
            [id]
        );

        // 3. Maintenance History
        const maintenanceResult = await pool.query(
            `SELECT id, title, description, category, priority, status, created_at, updated_at, resolution_notes
             FROM maintenance_requests
             WHERE stall_id = $1
             ORDER BY created_at DESC`,
            [id]
        );

        // 4. Payment History
        const paymentsResult = await pool.query(
            `SELECT p.id, p.amount, p.due_date, p.payment_date, p.status, p.payment_method, p.reference_number,
                    t.name as tenant_name, t.business_name
             FROM payments p
             LEFT JOIN tenants t ON p.tenant_id = t.id
             WHERE p.stall_id = $1
             ORDER BY p.due_date DESC
             LIMIT 20`,
            [id]
        );

        // 5. Applications History
        const applicationsResult = await pool.query(
            `SELECT id, full_name, business_name, email, phone, business_type, status, created_at, notes
             FROM applications
             WHERE stall_id = $1
             ORDER BY created_at DESC`,
            [id]
        );

        return {
            ...stall,
            tenants_history: tenantsResult.rows,
            maintenance_history: maintenanceResult.rows,
            payments_history: paymentsResult.rows,
            applications_history: applicationsResult.rows
        };
    }

    /**
     * Update a stall
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
            `UPDATE stalls SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP 
             WHERE id = $${paramCount}`,
            values
        );
        
        return result.rowCount > 0;
    }

    /**
     * Update stall status only
     */
    static async updateStatus(id, status) {
        const result = await pool.query(
            'UPDATE stalls SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [status, id]
        );
        return result.rowCount > 0;
    }

    /**
     * Delete a stall
     */
    static async delete(id) {
        const result = await pool.query('DELETE FROM stalls WHERE id = $1', [id]);
        return result.rowCount > 0;
    }

    /**
     * Get stall statistics
     */
    static async getStats() {
        const result = await pool.query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available,
                SUM(CASE WHEN status = 'occupied' THEN 1 ELSE 0 END) as occupied,
                SUM(CASE WHEN status = 'maintenance' THEN 1 ELSE 0 END) as maintenance,
                SUM(CASE WHEN status = 'reserved' THEN 1 ELSE 0 END) as reserved
            FROM stalls
        `);
        return result.rows[0];
    }
}

module.exports = Stall;