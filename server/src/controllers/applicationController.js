const Application = require('../models/Application');
const Stall = require('../models/Stall');
const { pool } = require('../config/database');

/**
 * Get all applications
 * GET /api/v1/applications
 */
const getAllApplications = async (req, res) => {
    try {
        let { status, user_id, search } = req.query;
        if ((req.userRole === 'tenant' || req.userRole === 'applicant')) {
            user_id = req.userId;
        }
        const rows = await Application.findAll({ status, user_id, search });
        const applications = req.userRole === 'tenant' ? rows.filter(a => a.user_id === req.userId) : rows;
        
        res.status(200).json({
            success: true,
            data: applications,
            count: applications.length
        });
    } catch (error) {
        console.error('Get applications error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch applications.'
        });
    }
};

/**
 * Get a single application
 * GET /api/v1/applications/:id
 */
const getApplication = async (req, res) => {
    try {
        const { id } = req.params;
        const application = await Application.findById(id);
        
        if (!application) {
            return res.status(404).json({
                success: false,
                message: 'Application not found.'
            });
        }

        if (req.userRole === 'tenant' && application.user_id !== req.userId) return res.status(403).json({ success: false, message: 'You can only view your own applications.' });

        res.status(200).json({
            success: true,
            data: application
        });
    } catch (error) {
        console.error('Get application error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch application.'
        });
    }
};

/**
 * Create a new stall application
 * POST /api/v1/applications
 */
const createApplication = async (req, res) => {
    try {
        const data = { ...req.body, user_id: req.userId || null };
        if (req.user) {
            data.email = req.user.email;
            data.phone = req.user.phone || data.phone;
        }
        if (['full_name', 'business_name', 'email', 'phone'].some(key => typeof data[key] !== 'string' || !data[key].trim()) || !data.stall_id) {
            return res.status(400).json({ success: false, message: 'Stall, full name, business name, email and phone are required.' });
        }
        const application = await pool.withTransaction(async client => {
            await client.query('SELECT id FROM stalls WHERE id = $1 FOR UPDATE', [data.stall_id]);
            const stall = await Stall.findById(data.stall_id);
            if (!stall || stall.status !== 'available') throw Object.assign(new Error('Stall is no longer available for application.'), { status: 409 });
            const pending = (await Application.findAll()).some(a => a.stall_id === data.stall_id && a.status === 'pending' &&
                (data.user_id ? a.user_id === data.user_id : a.email === data.email));
            if (pending) throw Object.assign(new Error('You already have a pending application for this stall.'), { status: 409 });
            const id = await Application.create(data);
            return Application.findById(id);
        });
        res.status(201).json({ success: true, message: 'Application submitted successfully.', data: application });
    } catch (error) {
        console.error('Create application error:', error);
        res.status(error.status || 500).json({ success: false, message: error.status ? error.message : 'Failed to submit application.' });
    }
};

/**
 * Review application (approve/reject)
 * PATCH /api/v1/applications/:id/review
 */
const reviewApplication = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, notes } = req.body;

        // Validate status
        const validStatuses = ['approved', 'rejected'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status. Must be: approved or rejected.'
            });
        }

        const updatedApplication = await require('../services/applicationReview').review(id, status, notes, req.userId);

        res.status(200).json({
            success: true,
            message: `Application ${status} successfully! ✅`,
            data: updatedApplication
        });
    } catch (error) {
        console.error('Review application error:', error);
        res.status(error.status || 500).json({
            success: false,
            message: error.status ? error.message : 'Failed to review application.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get application statistics
 * GET /api/v1/applications/stats
 */
const getApplicationStats = async (req, res) => {
    try {
        const stats = await Application.getStats();
        
        res.status(200).json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Get application stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch application statistics.'
        });
    }
};

/**
 * Delete an application
 * DELETE /api/v1/applications/:id
 */
const deleteApplication = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Check if application exists
        const application = await Application.findById(id);
        if (!application) {
            return res.status(404).json({
                success: false,
                message: 'Application not found.'
            });
        }

        const deleted = await Application.delete(id);
        if (!deleted) {
            return res.status(400).json({
                success: false,
                message: 'Failed to delete application.'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Application deleted successfully! ✅'
        });
    } catch (error) {
        console.error('Delete application error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete application.'
        });
    }
};

module.exports = {
    getAllApplications,
    getApplication,
    createApplication,
    reviewApplication,
    getApplicationStats,
    deleteApplication
};