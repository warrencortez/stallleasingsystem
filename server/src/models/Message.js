const { pool } = require('../config/database');

class Message {
    /**
     * Send a message
     */
    static async create(data) {
        const { sender_id, receiver_id, message } = data;

        const result = await pool.query(
            `INSERT INTO messages (sender_id, receiver_id, message) 
             VALUES ($1, $2, $3) 
             RETURNING id, sender_id, receiver_id, message, is_read, created_at`,
            [sender_id, receiver_id, message]
        );

        return result.rows[0];
    }

    /**
     * Get conversation thread between two users
     */
    static async getConversation(user1, user2) {
        const result = await pool.query(
            `SELECT m.*, 
                    s.name as sender_name, s.role as sender_role,
                    r.name as receiver_name, r.role as receiver_role
             FROM messages m
             LEFT JOIN users s ON m.sender_id = s.id
             LEFT JOIN users r ON m.receiver_id = r.id
             WHERE (m.sender_id = $1 AND m.receiver_id = $2)
                OR (m.sender_id = $2 AND m.receiver_id = $1)
             ORDER BY m.created_at ASC`,
            [user1, user2]
        );
        return result.rows;
    }

    /**
     * Mark messages in conversation as read
     */
    static async markAsRead(senderId, receiverId) {
        const result = await pool.query(
            `UPDATE messages 
             SET is_read = TRUE 
             WHERE sender_id = $1 AND receiver_id = $2 AND is_read = FALSE`,
            [senderId, receiverId]
        );
        return result.rowCount;
    }

    /**
     * Get list of conversations for a user (Admin/Tenant)
     */
    static async getUserConversations(userId) {
        const result = await pool.query(
            `WITH ranked_messages AS (
                SELECT m.*,
                       CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END as contact_id,
                       ROW_NUMBER() OVER (
                           PARTITION BY CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END 
                           ORDER BY m.created_at DESC
                       ) as rn
                FROM messages m
                WHERE m.sender_id = $1 OR m.receiver_id = $1
            )
            SELECT rm.id, rm.contact_id, rm.message as last_message, rm.created_at as last_message_at, rm.is_read,
                   u.name as contact_name, u.email as contact_email, u.role as contact_role
            FROM ranked_messages rm
            LEFT JOIN users u ON rm.contact_id = u.id
            WHERE rm.rn = 1
            ORDER BY rm.created_at DESC`,
            [userId]
        );
        return result.rows;
    }
}

module.exports = Message;
