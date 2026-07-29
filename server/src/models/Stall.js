const { pool } = require('../config/database');

class Stall {
    /**
     * Create a new stall
     */
    static async create(stallData) {
        const { 
            stall_number, location, size, monthly_rent, 
            status, description, image_url 
        } = stallData;
        
        const result = await pool.query(
            `INSERT INTO stalls 
             (stall_number, location, size, monthly_rent, status, description, image_url) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) 
             RETURNING id`,
            [stall_number, location, size, monthly_rent, status || 'available', description, image_url]
        );
        
        return result.rows[0].id;
    }

    /**
     * Get all stalls with optional filters
     */
    static async findAll(filters = {}) {
        let query = `SELECT * FROM stalls WHERE 1=1`;
        const values = [];
        let paramCount = 1;
        
        if (filters.status) {
            query += ` AND status = $${paramCount}`;
            values.push(filters.status);
            paramCount++;
        }
        
        if (filters.search) {
            query += ` AND (stall_number ILIKE $${paramCount} OR location ILIKE $${paramCount + 1})`;
            values.push(`%${filters.search}%`, `%${filters.search}%`);
            paramCount += 2;
        }
        
        query += ' ORDER BY stall_number ASC';
        
        const result = await pool.query(query, values);
        return result.rows;
    }

    /**
     * Get a single stall by ID
     */
    static async findById(id) {
        const result = await pool.query(
            `SELECT s.*, 
                    t.id as tenant_id, t.name as tenant_name, t.business_name
             FROM stalls s
             LEFT JOIN tenants t ON s.id = t.stall_id AND t.status = 'active'
             WHERE s.id = $1`,
            [id]
        );
        return result.rows[0];
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