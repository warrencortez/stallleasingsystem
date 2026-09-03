const Message = require('../models/Message');
const User = require('../models/User');

/**
 * Get contacts / recent conversations
 * GET /api/v1/messages/conversations
 */
const getConversations = async (req, res) => {
    try {
        const conversations = await Message.getUserConversations(req.userId);
        res.status(200).json({
            success: true,
            data: conversations
        });
    } catch (error) {
        console.error('Get conversations error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch conversations.'
        });
    }
};

/**
 * Get message thread between current user and target user
 * GET /api/v1/messages/thread/:contactId
 */
const getThread = async (req, res) => {
    try {
        const { contactId } = req.params;
        const messages = await Message.getConversation(req.userId, contactId);

        // Mark incoming messages as read
        await Message.markAsRead(contactId, req.userId);

        res.status(200).json({
            success: true,
            data: messages
        });
    } catch (error) {
        console.error('Get thread error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch messages.'
        });
    }
};

/**
 * Send a message
 * POST /api/v1/messages
 */
const sendMessage = async (req, res) => {
    try {
        const { receiver_id, message } = req.body;

        if (!receiver_id || !message) {
            return res.status(400).json({
                success: false,
                message: 'Receiver ID and message text are required.'
            });
        }

        const newMessage = await Message.create({
            sender_id: req.userId,
            receiver_id,
            message
        });

        res.status(201).json({
            success: true,
            message: 'Message sent! 💬',
            data: newMessage
        });
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send message.'
        });
    }
};

module.exports = {
    getConversations,
    getThread,
    sendMessage
};
