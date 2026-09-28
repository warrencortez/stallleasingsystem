const Maintenance = require('../models/Maintenance');
const Tenant = require('../models/Tenant');
const Notification = require('../models/Notification');
const { pool } = require('../config/database');

/**
 * Get all maintenance requests
 * GET /api/v1/maintenance
 */
const getAllRequests = async (req, res) => {
    try {
        const { status, category, priority, tenant_id, stall_id } = req.query;

        let requests;
        if (req.userRole === 'tenant') {
            const leases = (await Tenant.findAll()).filter(t => t.user_id === req.userId);
            const ids = new Set(leases.map(t => t.id));
            if (!ids.size) return res.json({ success: true, data: [], count: 0 });
            requests = (await Maintenance.findAll({ status, category, priority, stall_id })).filter(r => ids.has(r.tenant_id));
        } else {
            requests = await Maintenance.findAll({ status, category, priority, tenant_id, stall_id });
        }

        res.status(200).json({
            success: true,
            data: requests,
            count: requests.length
        });
    } catch (error) {
        console.error('Get maintenance requests error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch maintenance requests.'
        });
    }
};

/**
 * Get single maintenance request
 * GET /api/v1/maintenance/:id
 */
const getRequestById = async (req, res) => {
    try {
        const { id } = req.params;
        const request = await Maintenance.findById(id);

        if (!request) {
            return res.status(404).json({
                success: false,
                message: 'Maintenance request not found.'
            });
        }

        if (req.userRole === 'tenant') {
            const tenant = await Tenant.findById(request.tenant_id);
            if (!tenant || tenant.user_id !== req.userId) return res.status(403).json({ success: false, message: 'You can only view your own maintenance requests.' });
        }

        res.status(200).json({
            success: true,
            data: request
        });
    } catch (error) {
        console.error('Get maintenance request error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch maintenance request.'
        });
    }
};

/**
 * Create a new maintenance request
 * POST /api/v1/maintenance
 */
const createRequest = async (req, res) => {
    try {
        const { title, description, category, priority, stall_id } = req.body;

        if (!title || !description) {
            return res.status(400).json({
                success: false,
                message: 'Title and description are required.'
            });
        }

        // Determine tenant ID with resilient user-to-tenant lookup
        let tenantId = req.body.tenant_id;
        let stallId = stall_id;

        if (req.userRole === 'tenant') {
            const leases = (await Tenant.findAll()).filter(t => t.user_id === req.userId && t.status === 'active' && t.stall_id);
            const tenant = leases.find(t => !stallId || t.stall_id === stallId);
            if (!tenant) return res.status(403).json({ success: false, message: 'An active lease for this stall is required.' });
            tenantId = tenant.id;
            stallId = tenant.stall_id;
        }

        let photoUrl = req.body.photo_url || null;
        if (req.file) {
            photoUrl = `/uploads/maintenance/${req.file.filename}`;
        }

        const requestId = await Maintenance.create({
            tenant_id: tenantId,
            stall_id: stallId,
            title,
            description,
            category,
            priority,
            photo_url: photoUrl
        });

        const newRequest = await Maintenance.findById(requestId);

        // 🔔 Notify all Admins and Staff about the new maintenance report!
        try {
            const adminUsers = await pool.query(
                "SELECT id FROM users WHERE role IN ('admin', 'staff')"
            );

            let stallLabel = 'Assigned Stall';
            let tenantLabel = 'A tenant';
            if (stallId) {
                const s = await pool.query("SELECT stall_number, location FROM stalls WHERE id = $1", [stallId]);
                if (s.rows[0]) stallLabel = `Stall ${s.rows[0].stall_number}`;
            }
            if (tenantId) {
                const t = await Tenant.findById(tenantId);
                if (t) tenantLabel = t.name || t.business_name || 'Tenant';
            }

            const priorityUpper = (priority || 'medium').toUpperCase();
            const notifTitle = `New Maintenance Report: ${stallLabel} ⚠️`;
            const notifMessage = `${tenantLabel} filed a ${priorityUpper} priority ticket for "${title}" (${category || 'General'}). Description: ${description}`;

            for (const admin of (adminUsers.rows || [])) {
                await Notification.create({
                    user_id: admin.id,
                    title: notifTitle,
                    message: notifMessage,
                    type: 'maintenance_update',
                    link: '/maintenance'
                });
            }
        } catch (notifErr) {
            console.error('Error creating admin maintenance notification:', notifErr);
        }

        res.status(201).json({
            success: true,
            message: 'Maintenance request submitted successfully! 🛠️',
            data: newRequest
        });
    } catch (error) {
        console.error('Create maintenance request error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to submit maintenance request.'
        });
    }
};

/**
 * Update status / assign technician (Admin/Staff)
 * PATCH /api/v1/maintenance/:id/status
 */
const updateStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, assigned_to, resolution_notes } = req.body;

        const request = await Maintenance.findById(id);
        if (!request) {
            return res.status(404).json({
                success: false,
                message: 'Maintenance request not found.'
            });
        }

        const updated = await Maintenance.updateStatus(id, {
            status,
            assigned_to,
            resolution_notes
        });

        // Notify tenant about the update with clear titles and messages
        try {
            const { pool } = require('../config/database');
            let targetUserId = null;
            const tenant = await Tenant.findById(request.tenant_id);
            if (tenant?.user_id) {
                targetUserId = tenant.user_id;
            } else if (tenant?.email) {
                const userRes = await pool.query("SELECT id FROM users WHERE lower(email) = lower($1)", [tenant.email]);
                targetUserId = userRes.rows[0]?.id;
            }

            if (!targetUserId && request.stall_id) {
                const tenRes = await pool.query("SELECT user_id, email FROM tenants WHERE stall_id = $1 LIMIT 1", [request.stall_id]);
                if (tenRes.rows.length > 0) {
                    targetUserId = tenRes.rows[0].user_id;
                    if (!targetUserId && tenRes.rows[0].email) {
                        const userRes = await pool.query("SELECT id FROM users WHERE lower(email) = lower($1)", [tenRes.rows[0].email]);
                        targetUserId = userRes.rows[0]?.id;
                    }
                }
            }

            if (targetUserId) {
                const isCompleted = status === 'completed';
                const notifTitle = isCompleted
                    ? 'Maintenance Completed! 🛠️✅'
                    : status === 'in_progress'
                        ? 'Technician Dispatched! 🛠️'
                        : 'Maintenance Status Update 🛠️';

                const notifMessage = isCompleted
                    ? `Your maintenance ticket "${request.title}" has been marked as COMPLETED! ${resolution_notes ? 'Notes: ' + resolution_notes : 'The reported issue has been resolved by our maintenance team.'}`
                    : `Ticket "${request.title}" is now "${status.toUpperCase().replace('_', ' ')}". ${assigned_to ? 'Assigned to: ' + assigned_to + '.' : ''} ${resolution_notes ? 'Notes: ' + resolution_notes : ''}`;

                await Notification.create({
                    user_id: targetUserId,
                    title: notifTitle,
                    message: notifMessage.trim(),
                    type: 'maintenance_update',
                    link: '/maintenance'
                });
            }
        } catch (notifErr) {
            console.error('Error creating maintenance status notification:', notifErr);
        }

        res.status(200).json({
            success: true,
            message: 'Maintenance ticket updated successfully! ✅',
            data: updated
        });
    } catch (error) {
        console.error('Update maintenance status error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update maintenance request.'
        });
    }
};

/**
 * Get maintenance statistics
 * GET /api/v1/maintenance/stats
 */
const getStats = async (req, res) => {
    try {
        const stats = await Maintenance.getStats();
        res.status(200).json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Get maintenance stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch maintenance statistics.'
        });
    }
};

/**
 * Delete request
 * DELETE /api/v1/maintenance/:id
 */
const deleteRequest = async (req, res) => {
    try {
        const { id } = req.params;
        await Maintenance.delete(id);
        res.status(200).json({
            success: true,
            message: 'Maintenance request deleted successfully.'
        });
    } catch (error) {
        console.error('Delete maintenance error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete maintenance request.'
        });
    }
};

module.exports = {
    getAllRequests,
    getRequestById,
    createRequest,
    updateStatus,
    getStats,
    deleteRequest
};
