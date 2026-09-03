const { pool } = require('../config/database');

class Announcement {
    /**
     * Create announcement
     */
    static async create(data) {
        const { author_id, title, content, category, is_pinned, target_audience } = data;

        const result = await pool.query(
            `INSERT INTO announcements 
             (author_id, title, content, category, is_pinned, target_audience) 
             VALUES ($1, $2, $3, $4, $5, $6) 
             RETURNING id`,
            [
                author_id || null,
                title,
                content,
                category || 'general',
                is_pinned || false,
                target_audience || 'all'
            ]
        );

        return result.rows[0].id;
    }

    /**
     * Get all announcements with optional filters
     */
    static async findAll(filters = {}) {
        let query = `
            SELECT a.*,
                   u.name as author_name, u.role as author_role
            FROM announcements a
            LEFT JOIN users u ON a.author_id = u.id
            WHERE 1=1
        `;
        const values = [];
        let paramCount = 1;

        if (filters.category) {
            query += ` AND a.category = $${paramCount}`;
            values.push(filters.category);
            paramCount++;
        }

        if (filters.target_audience && filters.target_audience !== 'all') {
            query += ` AND (a.target_audience = 'all' OR a.target_audience = $${paramCount})`;
            values.push(filters.target_audience);
            paramCount++;
        }

        query += ' ORDER BY a.is_pinned DESC, a.created_at DESC';

        const result = await pool.query(query, values);
        return result.rows;
    }

    /**
     * Find single announcement by ID
     */
    static async findById(id) {
        const result = await pool.query(
            `SELECT a.*, u.name as author_name 
             FROM announcements a 
             LEFT JOIN users u ON a.author_id = u.id 
             WHERE a.id = $1`,
            [id]
        );
        return result.rows[0];
    }

    /**
     * Update announcement
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
            `UPDATE announcements SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP 
             WHERE id = $${paramCount} RETURNING *`,
            values
        );

        return result.rows[0];
    }

    /**
     * Delete announcement
     */
    static async delete(id) {
        const result = await pool.query('DELETE FROM announcements WHERE id = $1', [id]);
        return result.rowCount > 0;
    }
}

module.exports = Announcement;
