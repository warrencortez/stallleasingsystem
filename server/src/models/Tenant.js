const { pool } = require('../config/database');

class Tenant {
    /**
     * Create a new tenant
     */
    static async create(tenantData) {
        const {
            user_id,
            stall_id,
            name,
            email,
            phone,
            address,
            business_name,
            business_type,
            contract_start,
            contract_end,
            status
        } = tenantData;

        const result = await pool.query(
            `INSERT INTO tenants 
             (user_id, stall_id, name, email, phone, address, 
              business_name, business_type, contract_start, contract_end, status) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
             RETURNING id`,
            [
                user_id || null,
                stall_id || null,
                name,
                email,
                phone,
                address,
                business_name,
                business_type,
                contract_start,
                contract_end,
                status || 'pending'
            ]
        );

        return result.rows[0].id;
    }

    /**
     * Get all tenants with optional filters
     */
    static async findAll(filters = {}) {
        let query = `
            SELECT t.*, 
                   s.stall_number, s.location, s.monthly_rent,
                   u.name as user_name, u.email as user_email
            FROM tenants t
            LEFT JOIN stalls s ON t.stall_id = s.id
            LEFT JOIN users u ON t.user_id = u.id
            WHERE 1=1
        `;
        const values = [];
        let paramCount = 1;

        if (filters.status) {
            query += ` AND t.status = $${paramCount}`;
            values.push(filters.status);
            paramCount++;
        }

        if (filters.stall_id) {
            query += ` AND t.stall_id = $${paramCount}`;
            values.push(filters.stall_id);
            paramCount++;
        }

        if (filters.search) {
            query += ` AND (t.name ILIKE $${paramCount} OR t.email ILIKE $${paramCount + 1} OR t.business_name ILIKE $${paramCount + 2})`;
            values.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
            paramCount += 3;
        }

        query += ' ORDER BY t.created_at DESC';

        const result = await pool.query(query, values);
        return result.rows;
    }

    /**
     * Get a single tenant by ID
     */
    static async findById(id) {
        const result = await pool.query(
            `SELECT t.*, 
                    s.stall_number, s.location, s.monthly_rent, s.status as stall_status,
                    u.name as user_name, u.email as user_email, u.phone as user_phone
             FROM tenants t
             LEFT JOIN stalls s ON t.stall_id = s.id
             LEFT JOIN users u ON t.user_id = u.id
             WHERE t.id = $1`,
            [id]
        );
        return result.rows[0];
    }

    /**
     * Get tenant by user ID
     */
    static async findByUserId(userId) {
        const result = await pool.query(
            `SELECT t.*, 
                    s.stall_number, s.location, s.monthly_rent,
                    u.name as user_name, u.email as user_email
             FROM tenants t
             LEFT JOIN stalls s ON t.stall_id = s.id
             LEFT JOIN users u ON t.user_id = u.id
             WHERE t.user_id = $1`,
            [userId]
        );
        return result.rows[0];
    }

    /**
     * Get tenant by stall ID
     */
    static async findByStallId(stallId) {
        const result = await pool.query(
            `SELECT t.*, 
                    u.name as user_name, u.email as user_email
             FROM tenants t
             LEFT JOIN users u ON t.user_id = u.id
             WHERE t.stall_id = $1 AND t.status = 'active'`,
            [stallId]
        );
        return result.rows[0];
    }

    /**
     * ✅ NEW: Find tenant by email
     */
    static async findByEmail(email) {
        const result = await pool.query(
            'SELECT * FROM tenants WHERE email = $1',
            [email]
        );
        return result.rows[0];
    }

    /**
     * Update a tenant
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
            `UPDATE tenants SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP 
             WHERE id = $${paramCount}`,
            values
        );

        return result.rowCount > 0;
    }

    /**
     * Update tenant status
     */
    static async updateStatus(id, status) {
        const result = await pool.query(
            'UPDATE tenants SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [status, id]
        );
        return result.rowCount > 0;
    }

    /**
     * Assign tenant to stall
     */
    static async assignStall(tenantId, stallId) {
        const result = await pool.query(
            'UPDATE tenants SET stall_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [stallId, tenantId]
        );
        return result.rowCount > 0;
    }

    /**
     * Delete a tenant
     */
    static async delete(id) {
        const result = await pool.query('DELETE FROM tenants WHERE id = $1', [id]);
        return result.rowCount > 0;
    }

    /**
     * Get tenant statistics
     */
    static async getStats() {
        const result = await pool.query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
                SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) as inactive,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
            FROM tenants
        `);
        return result.rows[0];
    }

    /**
     * Get tenants with expiring contracts
     */
    static async getExpiringContracts(days = 30) {
        const result = await pool.query(
            `SELECT t.*, s.stall_number, s.location
             FROM tenants t
             LEFT JOIN stalls s ON t.stall_id = s.id
             WHERE t.status = 'active' 
               AND t.contract_end <= CURRENT_DATE + INTERVAL '${days} days'
               AND t.contract_end >= CURRENT_DATE
             ORDER BY t.contract_end ASC`,
            []
        );
        return result.rows;
    }
}

module.exports = Tenant;