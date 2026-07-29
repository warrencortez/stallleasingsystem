const express = require('express');
const router = express.Router();
const {
    getAllPayments,
    getPayment,
    getTenantPayments,
    createPayment,
    updatePayment,
    recordPayment,
    generateBills,
    applyLateFees,
    getPaymentStats,
    getTenantSummary,
    getOverduePayments,
    getMonthlyReport,
    deletePayment
} = require('../../controllers/paymentController');
const { authenticate, authorize } = require('../../middleware/auth');

// ==================================================
// ALL ROUTES REQUIRE AUTHENTICATION
// ==================================================

// Get payment statistics (Admin/Staff only)
router.get('/stats', authenticate, authorize('admin', 'staff'), getPaymentStats);

// Get overdue payments (Admin/Staff only)
router.get('/overdue', authenticate, authorize('admin', 'staff'), getOverduePayments);

// Get monthly report (Admin/Staff only)
router.get('/report', authenticate, authorize('admin', 'staff'), getMonthlyReport);

// Generate monthly bills (Admin only)
router.post('/generate-bills', authenticate, authorize('admin'), generateBills);

// Apply late fees (Admin only)
router.post('/apply-late-fees', authenticate, authorize('admin'), applyLateFees);

// Get all payments (Admin/Staff only)
router.get('/', authenticate, authorize('admin', 'staff'), getAllPayments);

// Get payments by tenant (Admin/Staff/Tenant can view their own)
router.get('/tenant/:tenantId', authenticate, async (req, res, next) => {
    // Allow tenant to view their own payments
    const { tenantId } = req.params;
    const tenant = await require('../../models/Tenant').findById(tenantId);
    
    if (req.userRole === 'tenant' && tenant && tenant.user_id !== req.userId) {
        return res.status(403).json({
            success: false,
            message: 'You can only view your own payments.'
        });
    }
    next();
}, getTenantPayments);

// Get tenant payment summary
router.get('/tenant/:tenantId/summary', authenticate, async (req, res, next) => {
    const { tenantId } = req.params;
    const tenant = await require('../../models/Tenant').findById(tenantId);
    
    if (req.userRole === 'tenant' && tenant && tenant.user_id !== req.userId) {
        return res.status(403).json({
            success: false,
            message: 'You can only view your own payment summary.'
        });
    }
    next();
}, getTenantSummary);

// Get a single payment
router.get('/:id', authenticate, getPayment);

// Create a new payment (Admin/Staff only)
router.post('/', authenticate, authorize('admin', 'staff'), createPayment);

// Update a payment (Admin/Staff only)
router.put('/:id', authenticate, authorize('admin', 'staff'), updatePayment);

// Record payment (mark as paid) - Tenant can record their own
router.patch('/:id/record', authenticate, async (req, res, next) => {
    const { id } = req.params;
    const payment = await require('../../models/Payment').findById(id);
    
    if (payment && req.userRole === 'tenant') {
        // Check if this payment belongs to the tenant's tenant record
        const tenant = await require('../../models/Tenant').findByUserId(req.userId);
        if (tenant && payment.tenant_id !== tenant.id) {
            return res.status(403).json({
                success: false,
                message: 'You can only record payments for your own stall.'
            });
        }
    }
    next();
}, recordPayment);

// Delete a payment (Admin only)
router.delete('/:id', authenticate, authorize('admin'), deletePayment);

module.exports = router;