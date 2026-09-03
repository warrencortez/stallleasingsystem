const { pool } = require('../config/database');

class Maintenance {
    /**
     * Create a new maintenance request
     */
    static async create(data) {
        const {
            tenant_id,
            stall_id,
            title,
            description,
            category,
            priority,
            photo_url
        } = data;

        const result = await pool.query(
            `INSERT INTO maintenance_requests 
             (tenant_id, stall_id, title, description, category, priority, status, photo_url) 
             VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7) 
             RETURNING id`,
            [
                tenant_id,
                stall_id || null,
                title,
                description,
                category || 'general',
                priority || 'medium',
                photo_url || null
            ]
        );

        return result.rows[0].id;
    }

    /**
     * Get all maintenance requests with filters
     */
    static async findAll(filters = {}) {
        let query = `
            SELECT m.*,
                   t.name as tenant_name, t.email as tenant_email, t.phone as tenant_phone,
                   s.stall_number, s.location as stall_location
            FROM maintenance_requests m
            LEFT JOIN tenants t ON m.tenant_id = t.id
            LEFT JOIN stalls s ON m.stall_id = s.id
            WHERE 1=1
        `;
        const values = [];
        let paramCount = 1;

        if (filters.status) {
            query += ` AND m.status = $${paramCount}`;
            values.push(filters.status);
            paramCount++;
        }

        if (filters.category) {
            query += ` AND m.category = $${paramCount}`;
            values.push(filters.category);
            paramCount++;
        }

        if (filters.priority) {
            query += ` AND m.priority = $${paramCount}`;
            values.push(filters.priority);
            paramCount++;
        }

        if (filters.tenant_id) {
            query += ` AND m.tenant_id = $${paramCount}`;
            values.push(filters.tenant_id);
            paramCount++;
        }

        if (filters.stall_id) {
            query += ` AND m.stall_id = $${paramCount}`;
            values.push(filters.stall_id);
            paramCount++;
        }

        query += ' ORDER BY m.created_at DESC';

        const result = await pool.query(query, values);
        return result.rows;
    }

    /**
     * Find single maintenance request by ID
     */
    static async findById(id) {
        const result = await pool.query(
            `SELECT m.*,
                    t.name as tenant_name, t.email as tenant_email, t.phone as tenant_phone,
                    s.stall_number, s.location as stall_location
             FROM maintenance_requests m
             LEFT JOIN tenants t ON m.tenant_id = t.id
             LEFT JOIN stalls s ON m.stall_id = s.id
             WHERE m.id = $1`,
            [id]
        );
        return result.rows[0];
    }

    /**
     * Update maintenance request status and notes
     */
    static async updateStatus(id, { status, assigned_to, resolution_notes }) {
        const result = await pool.query(
            `UPDATE maintenance_requests 
             SET status = COALESCE($1, status),
                 assigned_to = COALESCE($2, assigned_to),
                 resolution_notes = COALESCE($3, resolution_notes),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $4
             RETURNING *`,
            [status, assigned_to, resolution_notes, id]
        );
        return result.rows[0];
    }

    /**
     * Delete maintenance request
     */
    static async delete(id) {
        const result = await pool.query('DELETE FROM maintenance_requests WHERE id = $1', [id]);
        return result.rowCount > 0;
    }

    /**
     * Get maintenance summary statistics
     */
    static async getStats() {
        const result = await pool.query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN priority = 'urgent' THEN 1 ELSE 0 END) as urgent
            FROM maintenance_requests
        `);
        return result.rows[0];
    }
}

module.exports = Maintenance;
