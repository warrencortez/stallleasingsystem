const { pool } = require('../config/database');
const bcrypt = require('bcryptjs');

class User {
    /**
     * Create a new user
     * @param {Object} userData - User information
     * @returns {string} - New user's ID
     */
    static async create(userData) {
        const { name, email, password, role, phone, address } = userData;
        
        // Hash the password (encrypt it)
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        
        // Insert into database
        const result = await pool.query(
            `INSERT INTO users (name, email, password, role, phone, address) 
             VALUES ($1, $2, $3, $4, $5, $6) 
             RETURNING id`,
            [name, email, hashedPassword, role || 'tenant', phone, address]
        );
        
        return result.rows[0].id;
    }

    /**
     * Find a user by email (for login)
     * @param {string} email - User's email
     * @returns {Object} - User object or undefined
     */
    static async findByEmail(email) {
        const result = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );
        return result.rows[0];
    }

    /**
     * Find a user by ID
     * @param {string} id - User's UUID
     * @returns {Object} - User object (without password)
     */
    static async findById(id) {
        const result = await pool.query(
            `SELECT id, name, email, role, phone, address, 
                    profile_image, is_active, created_at, updated_at 
             FROM users WHERE id = $1`,
            [id]
        );
        return result.rows[0];
    }

    /**
     * Compare a plain password with a hashed password
     * @param {string} password - Plain text password
     * @param {string} hashedPassword - Hashed password from database
     * @returns {boolean} - True if passwords match
     */
    static async comparePassword(password, hashedPassword) {
        return await bcrypt.compare(password, hashedPassword);
    }

    /**
     * Update user information
     * @param {string} id - User's UUID
     * @param {Object} updateData - Fields to update
     * @returns {boolean} - True if update was successful
     */
    static async update(id, updateData) {
        const fields = [];
        const values = [];
        let paramCount = 1;
        
        // Build the update query dynamically
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
            `UPDATE users SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP 
             WHERE id = $${paramCount}`,
            values
        );
        
        return result.rowCount > 0;
    }

    /**
     * Update user's password
     * @param {string} id - User's UUID
     * @param {string} newPassword - New password
     * @returns {boolean} - True if update was successful
     */
    static async updatePassword(id, newPassword) {
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
        
        const result = await pool.query(
            'UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [hashedPassword, id]
        );
        
        return result.rowCount > 0;
    }

    /**
     * Get all users (with optional filters)
     * @param {Object} filters - Filter options
     * @returns {Array} - List of users
     */
    static async getAll(filters = {}) {
        let query = `SELECT id, name, email, role, phone, address, 
                            is_active, created_at 
                     FROM users WHERE 1=1`;
        const values = [];
        let paramCount = 1;
        
        if (filters.role) {
            query += ` AND role = $${paramCount}`;
            values.push(filters.role);
            paramCount++;
        }
        
        if (filters.is_active !== undefined) {
            query += ` AND is_active = $${paramCount}`;
            values.push(filters.is_active);
            paramCount++;
        }
        
        if (filters.search) {
            query += ` AND (name ILIKE $${paramCount} OR email ILIKE $${paramCount + 1})`;
            values.push(`%${filters.search}%`, `%${filters.search}%`);
            paramCount += 2;
        }
        
        query += ' ORDER BY created_at DESC';
        
        const result = await pool.query(query, values);
        return result.rows;
    }

    /**
     * Delete a user
     * @param {string} id - User's UUID
     * @returns {boolean} - True if deletion was successful
     */
    static async delete(id) {
        const result = await pool.query('DELETE FROM users WHERE id = $1', [id]);
        return result.rowCount > 0;
    }

    /**
     * Check if a user exists by email
     * @param {string} email - Email to check
     * @returns {boolean} - True if user exists
     */
    static async exists(email) {
        const result = await pool.query(
            'SELECT id FROM users WHERE email = $1',
            [email]
        );
        return result.rowCount > 0;
    }
}

module.exports = User;