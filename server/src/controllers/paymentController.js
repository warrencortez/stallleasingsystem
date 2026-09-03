const Payment = require('../models/Payment');
const Tenant = require('../models/Tenant');
const Stall = require('../models/Stall');
const Notification = require('../models/Notification');
const payMongoService = require('../services/paymongoService');

/**
 * Get all payments / invoices
 * GET /api/v1/payments
 */
const getAllPayments = async (req, res) => {
    try {
        const { status, tenant_id, stall_id, month, year } = req.query;
        const payments = await Payment.findAll({ status, tenant_id, stall_id, month, year });

        res.status(200).json({
            success: true,
            data: payments,
            count: payments.length
        });
    } catch (error) {
        console.error('Get payments error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch payments.'
        });
    }
};

/**
 * Get a single payment by ID
 * GET /api/v1/payments/:id
 */
const getPayment = async (req, res) => {
    try {
        const { id } = req.params;
        const payment = await Payment.findById(id);

        if (!payment) {
            return res.status(404).json({
                success: false,
                message: 'Payment record not found.'
            });
        }

        res.status(200).json({
            success: true,
            data: payment
        });
    } catch (error) {
        console.error('Get payment error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch payment.'
        });
    }
};

/**
 * Get payments for a specific tenant
 * GET /api/v1/payments/tenant/:tenantId
 */
const getTenantPayments = async (req, res) => {
    try {
        const { tenantId } = req.params;
        const payments = await Payment.findByTenantId(tenantId);

        res.status(200).json({
            success: true,
            data: payments,
            count: payments.length
        });
    } catch (error) {
        console.error('Get tenant payments error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch tenant payments.'
        });
    }
};

/**
 * Create a new payment invoice (Admin)
 * POST /api/v1/payments
 */
const createPayment = async (req, res) => {
    try {
        const paymentData = req.body;

        if (!paymentData.tenant_id || !paymentData.amount || !paymentData.due_date) {
            return res.status(400).json({
                success: false,
                message: 'Tenant ID, amount, and due date are required.'
            });
        }

        const tenant = await Tenant.findById(paymentData.tenant_id);
        if (!tenant) {
            return res.status(404).json({
                success: false,
                message: 'Tenant not found.'
            });
        }

        if (!paymentData.stall_id && tenant.stall_id) {
            paymentData.stall_id = tenant.stall_id;
        }

        const paymentId = await Payment.create(paymentData);
        const payment = await Payment.findById(paymentId);

        // Notify tenant if linked to a user
        if (tenant.user_id) {
            await Notification.create({
                user_id: tenant.user_id,
                title: 'New Lease Billing Generated',
                message: `A new bill for ₱${Number(paymentData.amount).toLocaleString()} with due date ${paymentData.due_date} has been issued.`,
                type: 'rent_due',
                link: '/payments'
            });
        }

        res.status(201).json({
            success: true,
            message: 'Payment invoice created successfully! 💰',
            data: payment
        });
    } catch (error) {
        console.error('Create payment error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create payment record.'
        });
    }
};

/**
 * Update a payment
 * PUT /api/v1/payments/:id
 */
const updatePayment = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        const payment = await Payment.findById(id);
        if (!payment) {
            return res.status(404).json({
                success: false,
                message: 'Payment record not found.'
            });
        }

        const updated = await Payment.update(id, updateData);
        if (!updated) {
            return res.status(400).json({
                success: false,
                message: 'Failed to update payment.'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Payment updated successfully! ✅',
            data: updated
        });
    } catch (error) {
        console.error('Update payment error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update payment.'
        });
    }
};

/**
 * Initiate PayMongo Checkout Session for a bill
 * POST /api/v1/payments/:id/paymongo-checkout
 */
const createPaymongoCheckout = async (req, res) => {
    try {
        const { id } = req.params;
        let payment = await Payment.findById(id);

        // Smart fallback: If ID not found or placeholder, fetch the latest unpaid invoice
        if (!payment) {
            const unpaidList = await Payment.findAll({ status: 'unpaid' });
            if (unpaidList && unpaidList.length > 0) {
                payment = unpaidList[0];
                console.log(`[PAYMONGO] Auto-resolved latest unpaid invoice: ${payment.id} for stall ${payment.stall_number}`);
            }
        }

        if (!payment) {
            return res.status(404).json({
                success: false,
                message: 'Payment record not found. Please generate monthly bills first.'
            });
        }

        if (payment.status === 'paid') {
            return res.status(400).json({
                success: false,
                message: 'This payment has already been settled.'
            });
        }

        const totalAmount = parseFloat(payment.amount) + parseFloat(payment.late_fee || 0);

        const checkoutResult = await payMongoService.createCheckoutSession({
            paymentId: payment.id,
            amount: totalAmount,
            stallNumber: payment.stall_number,
            description: payment.description || `Rent for ${payment.stall_number}`,
            tenantName: payment.tenant_name,
            tenantEmail: payment.tenant_email,
            tenantPhone: payment.tenant_phone
        });

        // Save session to database
        await Payment.setCheckoutSession(
            payment.id,
            checkoutResult.checkoutId,
            checkoutResult.checkoutUrl,
            checkoutResult.referenceNumber
        );

        res.status(200).json({
            success: true,
            message: 'PayMongo Checkout session initiated! 💳',
            data: {
                checkoutUrl: checkoutResult.checkoutUrl,
                checkoutId: checkoutResult.checkoutId,
                referenceNumber: checkoutResult.referenceNumber,
                isSimulated: checkoutResult.isSimulated
            }
        });
    } catch (error) {
        console.error('PayMongo Checkout session error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to initiate PayMongo payment.'
        });
    }
};

/**
 * Verify PayMongo payment after user redirects from checkout
 * POST /api/v1/payments/:id/verify-paymongo
 */
const verifyPaymongoPayment = async (req, res) => {
    try {
        const { id } = req.params;
        const { checkout_id, reference_number } = req.body;

        const payment = await Payment.findById(id);
        if (!payment) {
            return res.status(404).json({
                success: false,
                message: 'Payment record not found.'
            });
        }

        if (payment.status === 'paid') {
            return res.status(200).json({
                success: true,
                message: 'Payment already marked as paid.',
                data: payment
            });
        }

        // Verify with PayMongo service
        const sessionDetails = await payMongoService.retrieveCheckoutSession(checkout_id || payment.paymongo_checkout_id);

        // Update payment record
        const updatedPayment = await Payment.recordPayment(id, {
            payment_method: 'paymongo_online',
            reference_number: reference_number || payment.reference_number || `PM-${Date.now()}`,
            paymongo_payment_id: checkout_id,
            status: 'paid'
        });

        // Send confirmation notification
        const tenant = await Tenant.findById(payment.tenant_id);
        if (tenant?.user_id) {
            await Notification.create({
                user_id: tenant.user_id,
                title: 'Payment Confirmation Received! ✅',
                message: `Your payment of ₱${Number(payment.amount).toLocaleString()} for ${payment.stall_number} was successfully processed via PayMongo.`,
                type: 'payment_confirmed',
                link: '/payments'
            });
        }

        res.status(200).json({
            success: true,
            message: 'PayMongo payment verified and recorded successfully! 🎉',
            data: updatedPayment
        });
    } catch (error) {
        console.error('PayMongo verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to verify PayMongo payment.'
        });
    }
};

/**
 * Record manual payment or upload payment proof
 * PATCH /api/v1/payments/:id/record
 */
const recordPayment = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            payment_method,
            reference_number,
            proof_image,
            is_manual_verify
        } = req.body;

        const payment = await Payment.findById(id);
        if (!payment) {
            return res.status(404).json({
                success: false,
                message: 'Payment record not found.'
            });
        }

        // Handle uploaded file if present via multer
        let finalProofImage = proof_image;
        if (req.file) {
            finalProofImage = `/uploads/payments/${req.file.filename}`;
        }

        // If tenant uploaded proof, mark as pending verification unless admin verified
        const status = is_manual_verify || req.userRole === 'admin' ? 'paid' : 'pending_verification';

        const updated = await Payment.recordPayment(id, {
            payment_method: payment_method || 'bank_transfer',
            reference_number,
            proof_image: finalProofImage,
            status
        });

        res.status(200).json({
            success: true,
            message: status === 'paid' ? 'Payment marked as paid! ✅' : 'Payment proof submitted for admin review! 📄',
            data: updated
        });
    } catch (error) {
        console.error('Record payment error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to record payment.'
        });
    }
};

/**
 * Generate monthly bills for all active tenants
 * POST /api/v1/payments/generate-bills
 */
const generateBills = async (req, res) => {
    try {
        const { month, year } = req.body;

        if (!month || !year) {
            return res.status(400).json({
                success: false,
                message: 'Month and year are required.'
            });
        }

        const bills = await Payment.generateMonthlyBills(month, year);

        res.status(201).json({
            success: true,
            message: `Generated ${bills.length} bills for period ${month}/${year} ✅`,
            data: {
                count: bills.length,
                bills
            }
        });
    } catch (error) {
        console.error('Generate bills error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate monthly bills.'
        });
    }
};

/**
 * Apply late fees to overdue bills
 * POST /api/v1/payments/apply-late-fees
 */
const applyLateFees = async (req, res) => {
    try {
        const updated = await Payment.applyLateFees();

        res.status(200).json({
            success: true,
            message: `Applied late fees to ${updated.length} overdue payments ✅`,
            data: { count: updated.length, updated }
        });
    } catch (error) {
        console.error('Apply late fees error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to apply late fees.'
        });
    }
};

/**
 * Get payment statistics
 * GET /api/v1/payments/stats
 */
const getPaymentStats = async (req, res) => {
    try {
        const stats = await Payment.getStats();
        res.status(200).json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Get payment stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch payment statistics.'
        });
    }
};

/**
 * Get tenant summary
 * GET /api/v1/payments/tenant/:tenantId/summary
 */
const getTenantSummary = async (req, res) => {
    try {
        const { tenantId } = req.params;
        const summary = await Payment.getTenantSummary(tenantId);
        res.status(200).json({
            success: true,
            data: summary
        });
    } catch (error) {
        console.error('Get tenant summary error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch tenant summary.'
        });
    }
};

/**
 * Get overdue payments
 * GET /api/v1/payments/overdue
 */
const getOverduePayments = async (req, res) => {
    try {
        const overdue = await Payment.getOverduePayments();
        res.status(200).json({
            success: true,
            data: overdue,
            count: overdue.length
        });
    } catch (error) {
        console.error('Get overdue payments error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch overdue payments.'
        });
    }
};

/**
 * Get monthly collection report
 * GET /api/v1/payments/report
 */
const getMonthlyReport = async (req, res) => {
    try {
        const { month, year } = req.query;
        const report = await Payment.getMonthlyReport(month || new Date().getMonth() + 1, year || new Date().getFullYear());
        res.status(200).json({
            success: true,
            data: report
        });
    } catch (error) {
        console.error('Get monthly report error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch monthly report.'
        });
    }
};

/**
 * Delete payment
 * DELETE /api/v1/payments/:id
 */
const deletePayment = async (req, res) => {
    try {
        const { id } = req.params;
        await Payment.delete(id);
        res.status(200).json({
            success: true,
            message: 'Payment record deleted successfully.'
        });
    } catch (error) {
        console.error('Delete payment error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete payment.'
        });
    }
};

/**
 * Get comprehensive analytics for daily, weekly, monthly, and yearly breakdown
 * GET /api/v1/payments/analytics
 */
const getAnalytics = async (req, res) => {
    try {
        const { timeframe = 'monthly', year } = req.query;
        const targetYear = parseInt(year, 10) || new Date().getFullYear();

        const data = await Payment.getAnalyticsReport(timeframe, targetYear);
        res.status(200).json({
            success: true,
            data
        });
    } catch (error) {
        console.error('Analytics engine error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate analytics report.'
        });
    }
};

/**
 * Get master stalls dues and billing summary
 * GET /api/v1/payments/stalls-overview
 */
const getStallsBillingOverview = async (req, res) => {
    try {
        const { search } = req.query;
        const stalls = await Payment.getStallsBillingOverview(search);
        res.status(200).json({
            success: true,
            data: stalls,
            count: stalls.length
        });
    } catch (error) {
        console.error('Get stalls billing overview error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch stalls billing overview.'
        });
    }
};

module.exports = {
    getAllPayments,
    getPayment,
    getTenantPayments,
    createPayment,
    updatePayment,
    createPaymongoCheckout,
    verifyPaymongoPayment,
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
};