const { pool } = require('../config/database');

class Application {
    /**
     * Create a new stall application
     */
    static async create(applicationData) {
        const {
            user_id,
            stall_id,
            full_name,
            email,
            phone,
            business_name,
            business_type,
            notes,
            valid_id_url,
            business_permit_url
        } = applicationData;

        const result = await pool.query(
            `INSERT INTO applications 
             (user_id, stall_id, full_name, email, phone, 
              business_name, business_type, notes, valid_id_url, business_permit_url) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
             RETURNING id`,
            [
                user_id || null,
                stall_id || null,
                full_name,
                email || null,
                phone || null,
                business_name,
                business_type || 'General Retail',
                notes || null,
                valid_id_url || null,
                business_permit_url || null
            ]
        );

        return result.rows[0].id;
    }

    /**
     * Get all applications with filters
     */
    static async findAll(filters = {}) {
        let query = `
            SELECT a.*,
                   s.stall_number, s.location,
                   u.name as reviewer_name
            FROM applications a
            LEFT JOIN stalls s ON a.stall_id = s.id
            LEFT JOIN users u ON a.reviewed_by = u.id
            WHERE 1=1
        `;
        const values = [];
        let paramCount = 1;

        if (filters.status) {
            query += ` AND a.status = $${paramCount}`;
            values.push(filters.status);
            paramCount++;
        }

        if (filters.user_id) {
            query += ` AND a.user_id = $${paramCount}`;
            values.push(filters.user_id);
            paramCount++;
        }

        if (filters.search) {
            query += ` AND (a.full_name ILIKE $${paramCount} OR a.email ILIKE $${paramCount + 1} OR a.business_name ILIKE $${paramCount + 2})`;
            values.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
            paramCount += 3;
        }

        query += ' ORDER BY a.created_at DESC';

        const result = await pool.query(query, values);
        return result.rows;
    }

    /**
     * Get a single application by ID
     */
    static async findById(id) {
        const result = await pool.query(
            `SELECT a.*,
                    s.stall_number, s.location, s.monthly_rent,
                    u.name as reviewer_name
             FROM applications a
             LEFT JOIN stalls s ON a.stall_id = s.id
             LEFT JOIN users u ON a.reviewed_by = u.id
             WHERE a.id = $1`,
            [id]
        );
        return result.rows[0];
    }

    /**
     * Update application (for notes, etc.)
     * ✅ FIX: Added this method
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
            `UPDATE applications SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP 
             WHERE id = $${paramCount}`,
            values
        );

        return result.rowCount > 0;
    }

    /**
     * Update application status
     */
    static async updateStatus(id, status, reviewedBy) {
        const result = await pool.query(
            `UPDATE applications 
             SET status = $1, 
                 reviewed_by = $2, 
                 reviewed_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $3`,
            [status, reviewedBy, id]
        );
        return result.rowCount > 0;
    }

    /**
     * Get applications by status
     */
    static async getByStatus(status) {
        const result = await pool.query(
            `SELECT a.*, s.stall_number, s.location
             FROM applications a
             LEFT JOIN stalls s ON a.stall_id = s.id
             WHERE a.status = $1
             ORDER BY a.created_at ASC`,
            [status]
        );
        return result.rows;
    }

    /**
     * Delete an application
     */
    static async delete(id) {
        const result = await pool.query('DELETE FROM applications WHERE id = $1', [id]);
        return result.rowCount > 0;
    }

    /**
     * Get application statistics
     */
    static async getStats() {
        const result = await pool.query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
                SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
            FROM applications
        `);
        return result.rows[0];
    }
}

module.exports = Application;