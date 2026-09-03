const { pool } = require('../config/database');

class Notification {
    /**
     * Create a notification
     */
    static async create(data) {
        const { user_id, title, message, type, link } = data;

        const result = await pool.query(
            `INSERT INTO notifications (user_id, title, message, type, link) 
             VALUES ($1, $2, $3, $4, $5) 
             RETURNING id`,
            [user_id, title, message, type || 'general', link || null]
        );

        return result.rows[0].id;
    }

    /**
     * Get user notifications
     */
    static async findByUserId(userId) {
        const result = await pool.query(
            `SELECT * FROM notifications 
             WHERE user_id = $1 
             ORDER BY created_at DESC 
             LIMIT 50`,
            [userId]
        );
        return result.rows;
    }

    /**
     * Mark notification as read
     */
    static async markAsRead(id, userId) {
        const result = await pool.query(
            `UPDATE notifications 
             SET is_read = TRUE 
             WHERE id = $1 AND user_id = $2 
             RETURNING *`,
            [id, userId]
        );
        return result.rows[0];
    }

    /**
     * Mark all notifications as read for a user
     */
    static async markAllAsRead(userId) {
        const result = await pool.query(
            `UPDATE notifications 
             SET is_read = TRUE 
             WHERE user_id = $1`,
            [userId]
        );
        return result.rowCount;
    }

    /**
     * Get unread count
     */
    static async getUnreadCount(userId) {
        const result = await pool.query(
            `SELECT COUNT(*) as unread_count 
             FROM notifications 
             WHERE user_id = $1 AND is_read = FALSE`,
            [userId]
        );
        return parseInt(result.rows[0]?.unread_count || 0, 10);
    }
}

module.exports = Notification;
