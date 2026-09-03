const Notification = require('../models/Notification');

/**
 * Get user notifications
 * GET /api/v1/notifications
 */
const getNotifications = async (req, res) => {
    try {
        const notifications = await Notification.findByUserId(req.userId);
        const unreadCount = await Notification.getUnreadCount(req.userId);

        res.status(200).json({
            success: true,
            data: notifications,
            unreadCount
        });
    } catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch notifications.'
        });
    }
};

/**
 * Mark single notification as read
 * PATCH /api/v1/notifications/:id/read
 */
const markAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        const updated = await Notification.markAsRead(id, req.userId);

        res.status(200).json({
            success: true,
            message: 'Notification marked as read.',
            data: updated
        });
    } catch (error) {
        console.error('Mark read error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update notification.'
        });
    }
};

/**
 * Mark all notifications as read
 * POST /api/v1/notifications/mark-all-read
 */
const markAllAsRead = async (req, res) => {
    try {
        await Notification.markAllAsRead(req.userId);

        res.status(200).json({
            success: true,
            message: 'All notifications marked as read.'
        });
    } catch (error) {
        console.error('Mark all read error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to mark all as read.'
        });
    }
};

module.exports = {
    getNotifications,
    markAsRead,
    markAllAsRead
};
