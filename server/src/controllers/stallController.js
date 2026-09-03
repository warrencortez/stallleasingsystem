const Stall = require('../models/Stall');
const Notification = require('../models/Notification');
const { pool } = require('../config/database');

/**
 * Get all stalls
 * GET /api/v1/stalls
 */
const getAllStalls = async (req, res) => {
    try {
        const { status, search } = req.query;
        const stalls = await Stall.findAll({ status, search });
        
        res.status(200).json({
            success: true,
            data: stalls,
            count: stalls.length
        });
    } catch (error) {
        console.error('Get stalls error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch stalls.'
        });
    }
};

/**
 * Get a single stall
 * GET /api/v1/stalls/:id
 */
const getStall = async (req, res) => {
    try {
        const { id } = req.params;
        const stall = await Stall.findById(id);
        
        if (!stall) {
            return res.status(404).json({
                success: false,
                message: 'Stall not found.'
            });
        }

        res.status(200).json({
            success: true,
            data: stall
        });
    } catch (error) {
        console.error('Get stall error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch stall.'
        });
    }
};

/**
 * Get comprehensive stall details and history
 * GET /api/v1/stalls/:id/details
 */
const getStallDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const details = await Stall.getDetails(id);
        
        if (!details) {
            return res.status(404).json({
                success: false,
                message: 'Stall not found.'
            });
        }

        res.status(200).json({
            success: true,
            data: details
        });
    } catch (error) {
        console.error('Get stall details error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch stall history and details.'
        });
    }
};

/**
 * Create a new stall
 * POST /api/v1/stalls
 */
const createStall = async (req, res) => {
    try {
        const stallData = req.body;
        
        // Validate required fields
        if (!stallData.stall_number || !stallData.monthly_rent) {
            return res.status(400).json({
                success: false,
                message: 'Stall number and monthly rent are required.'
            });
        }

        const stallId = await Stall.create(stallData);
        const stall = await Stall.findById(stallId);

        // Broadcast notification to all tenants & users
        try {
            const usersRes = await pool.query("SELECT id FROM users WHERE role NOT IN ('admin') OR role IS NULL");
            const rentFormatted = Number(stall?.monthly_rent || stallData.monthly_rent || 0).toLocaleString();
            const locationStr = stall?.location ? ` in ${stall.location}` : '';
            const sizeStr = stall?.floor_area_sqm ? ` (${stall.floor_area_sqm} sqm)` : '';

            for (const u of (usersRes.rows || [])) {
                await Notification.create({
                    user_id: u.id,
                    title: 'New Stall Added! 🏪',
                    message: `Stall ${stall?.stall_number || stallData.stall_number}${sizeStr}${locationStr} is now open for lease at ₱${rentFormatted}/month!`,
                    type: 'stall_added',
                    link: '/stalls'
                });
            }
            console.log(`[Stall Notification] Broadcasted new stall alert to ${usersRes.rows.length} users.`);
        } catch (notifErr) {
            console.error('Error broadcasting stall notification:', notifErr);
        }

        res.status(201).json({
            success: true,
            message: 'Stall created successfully! ✅',
            data: stall
        });
    } catch (error) {
        console.error('Create stall error:', error);
        
        // Check for duplicate stall number
        if (error.code === '23505') {
            return res.status(409).json({
                success: false,
                message: 'Stall number already exists. Please use a different number.'
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Failed to create stall.'
        });
    }
};

/**
 * Update a stall
 * PUT /api/v1/stalls/:id
 */
const updateStall = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        
        // Check if stall exists
        const stall = await Stall.findById(id);
        if (!stall) {
            return res.status(404).json({
                success: false,
                message: 'Stall not found.'
            });
        }

        const updated = await Stall.update(id, updateData);
        if (!updated) {
            return res.status(400).json({
                success: false,
                message: 'Failed to update stall.'
            });
        }

        const updatedStall = await Stall.findById(id);

        // If stall became available, broadcast to tenants
        if (updateData.status === 'available' && stall.status !== 'available') {
            try {
                const usersRes = await pool.query("SELECT id FROM users WHERE role IN ('tenant', 'applicant')");
                for (const u of (usersRes.rows || [])) {
                    await Notification.create({
                        user_id: u.id,
                        title: 'Stall Available for Lease! 🏪',
                        message: `Stall ${stall.stall_number} is now vacant and ready for new lease applications!`,
                        type: 'stall_available',
                        link: '/stalls'
                    });
                }
            } catch (notifErr) {
                console.error('Error broadcasting stall status notification:', notifErr);
            }
        }

        res.status(200).json({
            success: true,
            message: 'Stall updated successfully! ✅',
            data: updatedStall
        });
    } catch (error) {
        console.error('Update stall error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update stall.'
        });
    }
};

/**
 * Update stall status
 * PATCH /api/v1/stalls/:id/status
 */
const updateStallStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        // Validate status
        const validStatuses = ['available', 'occupied', 'maintenance', 'reserved'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status. Must be: available, occupied, maintenance, or reserved.'
            });
        }

        // Check if stall exists
        const stall = await Stall.findById(id);
        if (!stall) {
            return res.status(404).json({
                success: false,
                message: 'Stall not found.'
            });
        }

        const updated = await Stall.updateStatus(id, status);
        if (!updated) {
            return res.status(400).json({
                success: false,
                message: 'Failed to update stall status.'
            });
        }

        // If stall status changed to available, broadcast notification
        if (status === 'available' && stall.status !== 'available') {
            try {
                const usersRes = await pool.query("SELECT id FROM users WHERE role NOT IN ('admin') OR role IS NULL");
                for (const u of (usersRes.rows || [])) {
                    await Notification.create({
                        user_id: u.id,
                        title: 'Stall Available for Lease! 🏪',
                        message: `Stall ${stall.stall_number} is now available for lease applications!`,
                        type: 'stall_available',
                        link: '/stalls'
                    });
                }
            } catch (notifErr) {
                console.error('Error broadcasting stall status notification:', notifErr);
            }
        }

        const updatedStall = await Stall.findById(id);

        res.status(200).json({
            success: true,
            message: 'Stall status updated successfully! ✅',
            data: updatedStall
        });
    } catch (error) {
        console.error('Update stall status error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update stall status.'
        });
    }
};

/**
 * Delete a stall
 * DELETE /api/v1/stalls/:id
 */
const deleteStall = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Check if stall exists
        const stall = await Stall.findById(id);
        if (!stall) {
            return res.status(404).json({
                success: false,
                message: 'Stall not found.'
            });
        }

        const deleted = await Stall.delete(id);
        if (!deleted) {
            return res.status(400).json({
                success: false,
                message: 'Failed to delete stall.'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Stall deleted successfully! ✅'
        });
    } catch (error) {
        console.error('Delete stall error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete stall.'
        });
    }
};

/**
 * Get stall statistics
 * GET /api/v1/stalls/stats
 */
const getStallStats = async (req, res) => {
    try {
        const stats = await Stall.getStats();
        
        res.status(200).json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Get stall stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch stall statistics.'
        });
    }
};

/**
 * Get stall QR code payload
 * GET /api/v1/stalls/:id/qrcode
 */
const getStallQRCode = async (req, res) => {
    try {
        const { id } = req.params;
        const stall = await Stall.findById(id);

        if (!stall) {
            return res.status(404).json({
                success: false,
                message: 'Stall not found.'
            });
        }

        const qrData = {
            stallId: stall.id,
            stallNumber: stall.stall_number,
            location: stall.location,
            monthlyRent: stall.monthly_rent,
            status: stall.status,
            tenantName: stall.tenant_name || null,
            quickActionUrl: `${process.env.CLIENT_URL || 'http://localhost:5173'}/stalls/${stall.id}`
        };

        res.status(200).json({
            success: true,
            data: {
                qrCodePayload: JSON.stringify(qrData),
                stall
            }
        });
    } catch (error) {
        console.error('Get QR Code error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate QR code data.'
        });
    }
};

module.exports = {
    getAllStalls,
    getStall,
    getStallDetails,
    createStall,
    updateStall,
    updateStallStatus,
    deleteStall,
    getStallStats,
    getStallQRCode
};