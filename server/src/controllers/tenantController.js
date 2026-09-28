const Tenant = require('../models/Tenant');
const Stall = require('../models/Stall');

/**
 * Get all tenants
 * GET /api/v1/tenants
 */
const getAllTenants = async (req, res) => {
    try {
        const { status, stall_id, search } = req.query;
        const rows = await Tenant.findAll({ status, stall_id, search });
        const tenants = req.userRole === 'tenant' ? rows.filter(t => t.user_id === req.userId) : rows;
        
        res.status(200).json({
            success: true,
            data: tenants,
            count: tenants.length
        });
    } catch (error) {
        console.error('Get tenants error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch tenants.'
        });
    }
};

/**
 * Get a single tenant
 * GET /api/v1/tenants/:id
 */
const getTenant = async (req, res) => {
    try {
        const { id } = req.params;
        const tenant = await Tenant.findById(id);
        
        if (!tenant) {
            return res.status(404).json({
                success: false,
                message: 'Tenant not found.'
            });
        }

        if (req.userRole === 'tenant' && tenant.user_id !== req.userId) {
            return res.status(403).json({ success: false, message: 'You can only view your own lease.' });
        }

        res.status(200).json({
            success: true,
            data: tenant
        });
    } catch (error) {
        console.error('Get tenant error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch tenant.'
        });
    }
};

/**
 * Create a new tenant
 * POST /api/v1/tenants
 */
const createTenant = async (req, res) => {
    try {
        const tenantData = req.body;
        
        // Validate required fields
        if (!tenantData.name) {
            return res.status(400).json({
                success: false,
                message: 'Tenant name is required.'
            });
        }

        // Check if stall is available if assigned
        if (tenantData.stall_id) {
            const stall = await Stall.findById(tenantData.stall_id);
            if (!stall) {
                return res.status(404).json({
                    success: false,
                    message: 'Stall not found.'
                });
            }
            if (stall.status !== 'available') {
                return res.status(400).json({
                    success: false,
                    message: 'Stall is not available. Current status: ' + stall.status
                });
            }
        }

        const tenantId = await Tenant.create(tenantData);
        const tenant = await Tenant.findById(tenantId);

        // If stall is assigned, update stall status
        if (tenantData.stall_id) {
            await Stall.updateStatus(tenantData.stall_id, 'occupied');
        }

        res.status(201).json({
            success: true,
            message: 'Tenant created successfully! ✅',
            data: tenant
        });
    } catch (error) {
        console.error('Create tenant error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create tenant.'
        });
    }
};

/**
 * Update a tenant
 * PUT /api/v1/tenants/:id
 */
const updateTenant = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        
        // Check if tenant exists
        const tenant = await Tenant.findById(id);
        if (!tenant) {
            return res.status(404).json({
                success: false,
                message: 'Tenant not found.'
            });
        }

        // If stall is being changed
        if (updateData.stall_id && updateData.stall_id !== tenant.stall_id) {
            // Check new stall availability
            const stall = await Stall.findById(updateData.stall_id);
            if (!stall) {
                return res.status(404).json({
                    success: false,
                    message: 'New stall not found.'
                });
            }
            if (stall.status !== 'available') {
                return res.status(400).json({
                    success: false,
                    message: 'New stall is not available.'
                });
            }

            // Free up old stall
            if (tenant.stall_id) {
                await Stall.updateStatus(tenant.stall_id, 'available');
            }
            // Occupy new stall
            await Stall.updateStatus(updateData.stall_id, 'occupied');
        }

        const updated = await Tenant.update(id, updateData);
        if (!updated) {
            return res.status(400).json({
                success: false,
                message: 'Failed to update tenant.'
            });
        }

        const updatedTenant = await Tenant.findById(id);

        res.status(200).json({
            success: true,
            message: 'Tenant updated successfully! ✅',
            data: updatedTenant
        });
    } catch (error) {
        console.error('Update tenant error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update tenant.'
        });
    }
};

/**
 * Update tenant status
 * PATCH /api/v1/tenants/:id/status
 */
const updateTenantStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        // Validate status
        const validStatuses = ['active', 'inactive', 'pending'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status. Must be: active, inactive, or pending.'
            });
        }

        // Check if tenant exists
        const tenant = await Tenant.findById(id);
        if (!tenant) {
            return res.status(404).json({
                success: false,
                message: 'Tenant not found.'
            });
        }

        // If tenant is being deactivated, free up their stall
        if (status === 'inactive' && tenant.stall_id) {
            await Stall.updateStatus(tenant.stall_id, 'available');
        }

        const updated = await Tenant.updateStatus(id, status);
        if (!updated) {
            return res.status(400).json({
                success: false,
                message: 'Failed to update tenant status.'
            });
        }

        const updatedTenant = await Tenant.findById(id);

        res.status(200).json({
            success: true,
            message: 'Tenant status updated successfully! ✅',
            data: updatedTenant
        });
    } catch (error) {
        console.error('Update tenant status error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update tenant status.'
        });
    }
};

/**
 * Delete a tenant
 * DELETE /api/v1/tenants/:id
 */
const deleteTenant = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Check if tenant exists
        const tenant = await Tenant.findById(id);
        if (!tenant) {
            return res.status(404).json({
                success: false,
                message: 'Tenant not found.'
            });
        }

        // Free up their stall if assigned
        if (tenant.stall_id) {
            await Stall.updateStatus(tenant.stall_id, 'available');
        }

        const deleted = await Tenant.delete(id);
        if (!deleted) {
            return res.status(400).json({
                success: false,
                message: 'Failed to delete tenant.'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Tenant deleted successfully! ✅'
        });
    } catch (error) {
        console.error('Delete tenant error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete tenant.'
        });
    }
};

/**
 * Get tenant statistics
 * GET /api/v1/tenants/stats
 */
const getTenantStats = async (req, res) => {
    try {
        const stats = await Tenant.getStats();
        
        res.status(200).json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Get tenant stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch tenant statistics.'
        });
    }
};

/**
 * Get tenants with expiring contracts
 * GET /api/v1/tenants/expiring
 */
const getExpiringContracts = async (req, res) => {
    try {
        const { days } = req.query;
        const expiring = await Tenant.getExpiringContracts(days || 30);
        
        res.status(200).json({
            success: true,
            data: expiring,
            count: expiring.length
        });
    } catch (error) {
        console.error('Get expiring contracts error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch expiring contracts.'
        });
    }
};

/**
 * Assign tenant to stall
 * PATCH /api/v1/tenants/:id/assign-stall
 */
const assignStall = async (req, res) => {
    try {
        const { id } = req.params;
        const { stall_id } = req.body;

        // Check if tenant exists
        const tenant = await Tenant.findById(id);
        if (!tenant) {
            return res.status(404).json({
                success: false,
                message: 'Tenant not found.'
            });
        }

        // Check if stall exists and is available
        const stall = await Stall.findById(stall_id);
        if (!stall) {
            return res.status(404).json({
                success: false,
                message: 'Stall not found.'
            });
        }
        if (stall.status !== 'available') {
            return res.status(400).json({
                success: false,
                message: 'Stall is not available.'
            });
        }

        // If tenant already has a stall, free it
        if (tenant.stall_id) {
            await Stall.updateStatus(tenant.stall_id, 'available');
        }

        // Assign tenant to stall
        await Tenant.assignStall(id, stall_id);
        await Stall.updateStatus(stall_id, 'occupied');

        const updatedTenant = await Tenant.findById(id);

        res.status(200).json({
            success: true,
            message: 'Stall assigned successfully! ✅',
            data: updatedTenant
        });
    } catch (error) {
        console.error('Assign stall error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to assign stall to tenant.'
        });
    }
};

module.exports = {
    getAllTenants,
    getTenant,
    createTenant,
    updateTenant,
    updateTenantStatus,
    deleteTenant,
    getTenantStats,
    getExpiringContracts,
    assignStall
};