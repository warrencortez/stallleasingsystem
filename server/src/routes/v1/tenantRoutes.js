const express = require('express');
const router = express.Router();
const {
    getAllTenants,
    getTenant,
    createTenant,
    updateTenant,
    updateTenantStatus,
    deleteTenant,
    getTenantStats,
    getExpiringContracts,
    assignStall
} = require('../../controllers/tenantController');
const { authenticate, authorize } = require('../../middleware/auth');

// ==================================================
// ALL ROUTES REQUIRE AUTHENTICATION
// ==================================================

// Get tenant statistics (Admin/Staff only)
router.get('/stats', authenticate, authorize('admin', 'staff'), getTenantStats);

// Get tenants with expiring contracts (Admin/Staff only)
router.get('/expiring', authenticate, authorize('admin', 'staff'), getExpiringContracts);

// Get all tenants
router.get('/', authenticate, getAllTenants);

// Get a single tenant
router.get('/:id', authenticate, getTenant);

// Create a new tenant (Admin/Staff only)
router.post('/', authenticate, authorize('admin', 'staff'), createTenant);

// Update a tenant (Admin/Staff only)
router.put('/:id', authenticate, authorize('admin', 'staff'), updateTenant);

// Update tenant status (Admin/Staff only)
router.patch('/:id/status', authenticate, authorize('admin', 'staff'), updateTenantStatus);

// Assign stall to tenant (Admin/Staff only)
router.patch('/:id/assign-stall', authenticate, authorize('admin', 'staff'), assignStall);

// Delete a tenant (Admin only)
router.delete('/:id', authenticate, authorize('admin'), deleteTenant);

module.exports = router;