const Announcement = require('../models/Announcement');
const Notification = require('../models/Notification');
const User = require('../models/User');

/**
 * Get all announcements
 * GET /api/v1/announcements
 */
const getAllAnnouncements = async (req, res) => {
    try {
        const { category, target_audience } = req.query;
        const audience = req.userRole === 'admin' ? target_audience : (req.userRole === 'tenant' ? 'tenants' : 'staff');

        const announcements = await Announcement.findAll({
            category,
            target_audience: audience
        });

        res.status(200).json({
            success: true,
            data: announcements,
            count: announcements.length
        });
    } catch (error) {
        console.error('Get announcements error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch announcements.'
        });
    }
};

/**
 * Get announcement by ID
 * GET /api/v1/announcements/:id
 */
const getAnnouncementById = async (req, res) => {
    try {
        const { id } = req.params;
        const announcement = await Announcement.findById(id);

        if (!announcement) {
            return res.status(404).json({
                success: false,
                message: 'Announcement not found.'
            });
        }

        res.status(200).json({
            success: true,
            data: announcement
        });
    } catch (error) {
        console.error('Get announcement error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch announcement.'
        });
    }
};

/**
 * Create announcement (Admin/Staff)
 * POST /api/v1/announcements
 */
const createAnnouncement = async (req, res) => {
    try {
        const { title, content, category, is_pinned, target_audience } = req.body;

        if (!title || !content) {
            return res.status(400).json({
                success: false,
                message: 'Title and content are required.'
            });
        }

        const announcementId = await Announcement.create({
            author_id: req.userId,
            title,
            content,
            category: category || 'general',
            is_pinned: !!is_pinned,
            target_audience: target_audience || 'all'
        });

        const newAnnouncement = await Announcement.findById(announcementId);

        // Broadcast notifications to targeted users
        try {
            const allUsers = await User.getAll();
            const relevantUsers = allUsers.filter(u => {
                if (target_audience === 'tenants') return u.role === 'tenant';
                if (target_audience === 'staff') return u.role === 'staff' || u.role === 'admin';
                return true;
            });

            for (const u of relevantUsers) {
                if (u.id !== req.userId) {
                    await Notification.create({
                        user_id: u.id,
                        title: `Announcement: ${title}`,
                        message: content.substring(0, 120) + (content.length > 120 ? '...' : ''),
                        type: 'announcement',
                        link: '/announcements'
                    });
                }
            }
        } catch (notifErr) {
            console.warn('Broadcast notification warning:', notifErr.message);
        }

        res.status(201).json({
            success: true,
            message: 'Announcement broadcasted successfully! 📢',
            data: newAnnouncement
        });
    } catch (error) {
        console.error('Create announcement error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create announcement.'
        });
    }
};

/**
 * Update announcement
 * PUT /api/v1/announcements/:id
 */
const updateAnnouncement = async (req, res) => {
    try {
        const { id } = req.params;
        const updated = await Announcement.update(id, req.body);

        if (!updated) {
            return res.status(404).json({
                success: false,
                message: 'Announcement not found or update failed.'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Announcement updated successfully! ✅',
            data: updated
        });
    } catch (error) {
        console.error('Update announcement error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update announcement.'
        });
    }
};

/**
 * Delete announcement
 * DELETE /api/v1/announcements/:id
 */
const deleteAnnouncement = async (req, res) => {
    try {
        const { id } = req.params;
        await Announcement.delete(id);

        res.status(200).json({
            success: true,
            message: 'Announcement deleted successfully.'
        });
    } catch (error) {
        console.error('Delete announcement error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete announcement.'
        });
    }
};

module.exports = {
    getAllAnnouncements,
    getAnnouncementById,
    createAnnouncement,
    updateAnnouncement,
    deleteAnnouncement
};
