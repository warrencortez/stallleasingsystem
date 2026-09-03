const express = require('express');
const router = express.Router();
const {
    getAllPayments,
    getPayment,
    getTenantPayments,
    createPayment,
    createPaymongoCheckout,
    verifyPaymongoPayment,
    updatePayment,
    recordPayment,
    generateBills,
    applyLateFees,
    getPaymentStats,
    getTenantSummary,
    getOverduePayments,
    getMonthlyReport,
    getAnalytics,
    getStallsBillingOverview,
    deletePayment
} = require('../../controllers/paymentController');
const { authenticate, authorize } = require('../../middleware/auth');
const upload = require('../../middleware/upload');
const Tenant = require('../../models/Tenant');
const Payment = require('../../models/Payment');

// ==================================================
// ALL ROUTES REQUIRE AUTHENTICATION
// ==================================================
router.use(authenticate);

// Get comprehensive analytics report (Daily, Weekly, Monthly, Yearly)
router.get('/analytics', getAnalytics);

// Get master stalls dues and billing summary (Admin/Staff only)
router.get('/stalls-overview', authorize('admin', 'staff'), getStallsBillingOverview);

// Get payment statistics (Admin/Staff only)
router.get('/stats', authorize('admin', 'staff'), getPaymentStats);

// Get overdue payments (Admin/Staff only)
router.get('/overdue', authorize('admin', 'staff'), getOverduePayments);

// Get monthly report (Admin/Staff only)
router.get('/report', authorize('admin', 'staff'), getMonthlyReport);

// Generate monthly bills (Admin only)
router.post('/generate-bills', authorize('admin'), generateBills);

// Apply late fees (Admin only)
router.post('/apply-late-fees', authorize('admin'), applyLateFees);

// Get all payments (Admin/Staff or Filtered)
router.get('/', async (req, res, next) => {
    if (req.userRole === 'tenant') {
        const tenant = await Tenant.findByUserId(req.userId);
        if (tenant) {
            req.query.tenant_id = tenant.id;
        }
    }
    next();
}, getAllPayments);

// PayMongo Checkout Session generation
router.post('/:id/paymongo-checkout', createPaymongoCheckout);

// PayMongo Payment verification
router.post('/:id/verify-paymongo', verifyPaymongoPayment);

// Get payments by tenant
router.get('/tenant/:tenantId', async (req, res, next) => {
    const { tenantId } = req.params;
    const tenant = await Tenant.findById(tenantId);
    
    if (req.userRole === 'tenant' && tenant && tenant.user_id !== req.userId) {
        return res.status(403).json({
            success: false,
            message: 'You can only view your own payments.'
        });
    }
    next();
}, getTenantPayments);

// Get tenant payment summary
router.get('/tenant/:tenantId/summary', async (req, res, next) => {
    const { tenantId } = req.params;
    const tenant = await Tenant.findById(tenantId);
    
    if (req.userRole === 'tenant' && tenant && tenant.user_id !== req.userId) {
        return res.status(403).json({
            success: false,
            message: 'You can only view your own payment summary.'
        });
    }
    next();
}, getTenantSummary);

// Get a single payment
router.get('/:id', getPayment);

// Create a new payment (Admin/Staff only)
router.post('/', authorize('admin', 'staff'), createPayment);

// Update a payment (Admin/Staff only)
router.put('/:id', authorize('admin', 'staff'), updatePayment);

// Record payment or submit proof upload
router.patch('/:id/record', upload.single('proof_image'), async (req, res, next) => {
    const { id } = req.params;
    const payment = await Payment.findById(id);
    
    if (payment && req.userRole === 'tenant') {
        const tenant = await Tenant.findByUserId(req.userId);
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
router.delete('/:id', authorize('admin'), deletePayment);

module.exports = router;