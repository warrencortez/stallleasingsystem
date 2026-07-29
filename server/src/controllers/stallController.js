const Stall = require('../models/Stall');

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

module.exports = {
    getAllStalls,
    getStall,
    createStall,
    updateStall,
    updateStallStatus,
    deleteStall,
    getStallStats
};