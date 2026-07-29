const Payment = require('../models/Payment');
const Tenant = require('../models/Tenant');
const Stall = require('../models/Stall');

/**
 * Get all payments
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
 * Get a single payment
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
 * Get payments by tenant
 * GET /api/v1/payments/tenant/:tenantId
 */
const getTenantPayments = async (req, res) => {
    try {
        const { tenantId } = req.params;
        const { status } = req.query;
        
        // Check if tenant exists
        const tenant = await Tenant.findById(tenantId);
        if (!tenant) {
            return res.status(404).json({
                success: false,
                message: 'Tenant not found.'
            });
        }

        let payments;
        if (status) {
            payments = await Payment.findByTenantIdAndStatus(tenantId, status);
        } else {
            payments = await Payment.findByTenantId(tenantId);
        }

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
 * Create a new payment
 * POST /api/v1/payments
 */
const createPayment = async (req, res) => {
    try {
        const paymentData = req.body;
        
        // Validate required fields
        if (!paymentData.tenant_id || !paymentData.amount || !paymentData.due_date) {
            return res.status(400).json({
                success: false,
                message: 'Tenant ID, amount, and due date are required.'
            });
        }

        // Check if tenant exists
        const tenant = await Tenant.findById(paymentData.tenant_id);
        if (!tenant) {
            return res.status(404).json({
                success: false,
                message: 'Tenant not found.'
            });
        }

        // Get stall ID from tenant if not provided
        if (!paymentData.stall_id && tenant.stall_id) {
            paymentData.stall_id = tenant.stall_id;
        }

        const paymentId = await Payment.create(paymentData);
        const payment = await Payment.findById(paymentId);

        res.status(201).json({
            success: true,
            message: 'Payment record created successfully! 💰',
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
        
        // Check if payment exists
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

        const updatedPayment = await Payment.findById(id);

        res.status(200).json({
            success: true,
            message: 'Payment updated successfully! ✅',
            data: updatedPayment
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
 * Record payment (mark as paid)
 * PATCH /api/v1/payments/:id/record
 */
const recordPayment = async (req, res) => {
    try {
        const { id } = req.params;
        const { payment_method, reference_number, proof_image } = req.body;

        // Check if payment exists
        const payment = await Payment.findById(id);
        if (!payment) {
            return res.status(404).json({
                success: false,
                message: 'Payment record not found.'
            });
        }

        if (payment.status === 'paid') {
            return res.status(400).json({
                success: false,
                message: 'Payment has already been recorded.'
            });
        }

        const recorded = await Payment.recordPayment(id, {
            payment_method,
            reference_number,
            proof_image
        });

        if (!recorded) {
            return res.status(400).json({
                success: false,
                message: 'Failed to record payment.'
            });
        }

        const updatedPayment = await Payment.findById(id);

        res.status(200).json({
            success: true,
            message: 'Payment recorded successfully! ✅💰',
            data: updatedPayment
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
 * Generate monthly bills
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

        // Validate month (1-12)
        if (month < 1 || month > 12) {
            return res.status(400).json({
                success: false,
                message: 'Month must be between 1 and 12.'
            });
        }

        const bills = await Payment.generateMonthlyBills(month, year);

        res.status(201).json({
            success: true,
            message: `${bills.length} bills generated for ${month}/${year} ✅`,
            data: {
                count: bills.length,
                bills
            }
        });
    } catch (error) {
        console.error('Generate bills error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate bills.'
        });
    }
};

/**
 * Apply late fees
 * POST /api/v1/payments/apply-late-fees
 */
const applyLateFees = async (req, res) => {
    try {
        const updated = await Payment.applyLateFees();

        res.status(200).json({
            success: true,
            message: `${updated.length} payments updated with late fees ✅`,
            data: {
                count: updated.length,
                updated
            }
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
 * Get tenant payment summary
 * GET /api/v1/payments/tenant/:tenantId/summary
 */
const getTenantSummary = async (req, res) => {
    try {
        const { tenantId } = req.params;
        
        // Check if tenant exists
        const tenant = await Tenant.findById(tenantId);
        if (!tenant) {
            return res.status(404).json({
                success: false,
                message: 'Tenant not found.'
            });
        }

        const summary = await Payment.getTenantSummary(tenantId);

        res.status(200).json({
            success: true,
            data: summary
        });
    } catch (error) {
        console.error('Get tenant summary error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch tenant payment summary.'
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
 * Get monthly report
 * GET /api/v1/payments/report
 */
const getMonthlyReport = async (req, res) => {
    try {
        const { month, year } = req.query;

        if (!month || !year) {
            return res.status(400).json({
                success: false,
                message: 'Month and year are required.'
            });
        }

        const report = await Payment.getMonthlyReport(month, year);

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
 * Delete a payment
 * DELETE /api/v1/payments/:id
 */
const deletePayment = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Check if payment exists
        const payment = await Payment.findById(id);
        if (!payment) {
            return res.status(404).json({
                success: false,
                message: 'Payment record not found.'
            });
        }

        const deleted = await Payment.delete(id);
        if (!deleted) {
            return res.status(400).json({
                success: false,
                message: 'Failed to delete payment.'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Payment deleted successfully! ✅'
        });
    } catch (error) {
        console.error('Delete payment error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete payment.'
        });
    }
};

module.exports = {
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
};