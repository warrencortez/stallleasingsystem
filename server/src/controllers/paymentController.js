const Payment = require('../models/Payment');
const Tenant = require('../models/Tenant');
const Stall = require('../models/Stall');
const Notification = require('../models/Notification');
const payMongoService = require('../services/paymongoService');
const uploadStorage = require('../services/uploadStorage');

/**
 * Get all payments / invoices
 * GET /api/v1/payments
 */
const getAllPayments = async (req, res) => {
    try {
        const { status, tenant_id, stall_id, month, year } = req.query;
        const payments = await Payment.findAll({ status, tenant_id, stall_id, month, year, user_id: req.userRole === 'tenant' ? req.userId : undefined });

        res.status(200).json({
            success: true,
            data: await uploadStorage.signRecords(payments, 'proof_image'),
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
            data: await uploadStorage.signRecords(payment, 'proof_image')
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
        const paymentData = { ...req.body };

        if (!paymentData.tenant_id || !paymentData.amount || !paymentData.due_date) {
            return res.status(400).json({
                success: false,
                message: 'Tenant ID, amount, and due date are required.'
            });
        }

        const amount = Number(paymentData.amount);
        const due = paymentData.due_date;
        if (!Number.isFinite(amount) || amount <= 0 || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.000001 ||
            typeof due !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(due) ||
            !Number.isFinite(Date.parse(due)) || new Date(due).toISOString().slice(0, 10) !== due) {
            return res.status(400).json({ success: false, message: 'Enter a positive amount with at most two decimals and a valid due date.' });
        }
        paymentData.amount = amount;
        paymentData.status = 'unpaid';
        paymentData.late_fee = 0;
        delete paymentData.payment_date;

        const tenant = await Tenant.findById(paymentData.tenant_id);
        if (!tenant) {
            return res.status(404).json({
                success: false,
                message: 'Tenant not found.'
            });
        }

        if (tenant.status !== 'active' || !tenant.stall_id ||
            (paymentData.stall_id && paymentData.stall_id !== tenant.stall_id)) {
            return res.status(400).json({ success: false, message: 'Billing requires an active lease for the specified stall.' });
        }
        paymentData.stall_id = tenant.stall_id;

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

        if(payment.status==='paid' || payment.paymongo_checkout_id) return res.status(409).json({success:false,message:'Paid invoices and invoices with online checkout cannot be edited.'});
        const fields = ['amount', 'late_fee', 'due_date', 'description', 'status', 'payment_method', 'reference_number', 'proof_image'];
        if (Object.keys(updateData).some(key => !fields.includes(key)) ||
            ['amount', 'late_fee'].some(key => updateData[key] !== undefined &&
                (!Number.isFinite(Number(updateData[key])) || Number(updateData[key]) < (key === 'amount' ? 0.01 : 0) ||
                 Math.abs(Number(updateData[key]) * 100 - Math.round(Number(updateData[key]) * 100)) > 0.000001)) ||
            (updateData.status && !['unpaid', 'overdue'].includes(updateData.status)) ||
            (updateData.due_date !== undefined && (typeof updateData.due_date !== 'string' ||
                !/^\d{4}-\d{2}-\d{2}$/.test(updateData.due_date) || !Number.isFinite(Date.parse(updateData.due_date)) ||
                new Date(updateData.due_date).toISOString().slice(0, 10) !== updateData.due_date))) {
            return res.status(400).json({ success: false, message: 'Invalid invoice fields, amount, status or due date.' });
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
        if(!await Payment.findById(req.params.id)) return res.status(404).json({success:false,message:"Invoice not found."});
        payMongoService.assertReady();
        const result = await require('../config/database').pool.withTransaction(async client => {
            const locked=(await client.query('SELECT * FROM payments WHERE id = $1 FOR UPDATE',[req.params.id])).rows[0];
            if(!locked) throw Object.assign(new Error('Invoice not found.'),{status:404});
            if(locked.status==='paid' || locked.status==='pending_verification') throw Object.assign(new Error('This bill is already paid or awaiting verification.'),{status:409});
            if(locked.paymongo_checkout_id) {
                const session=await payMongoService.retrieveCheckoutSession(locked.paymongo_checkout_id);
                if(!session) throw Object.assign(new Error('Unable to check existing checkout. Please retry.'),{status:503});
                if(session.attributes?.payments?.some(p=>p.attributes?.status==='paid')) throw Object.assign(new Error('Payment received; confirmation is processing. Refresh your bills shortly.'),{status:409});
                if(session.attributes?.status==='expired' && ['awaiting_next_action','processing','succeeded'].includes(session.attributes?.payment_intent?.attributes?.status)) throw Object.assign(new Error('A previous payment attempt is still being resolved. Please contact the HOA office before trying again.'),{status:409});
                if(session.attributes?.status!=='expired') {
                    if(!session.attributes?.checkout_url) throw Object.assign(new Error('Checkout is unavailable. Please contact the HOA office.'),{status:409});
                    return {checkoutId:session.id,checkoutUrl:session.attributes.checkout_url,referenceNumber:locked.reference_number};
                }
            }
            const payment=await Payment.findById(req.params.id);
            const checkout=await payMongoService.createCheckoutSession({paymentId:payment.id,
                amount:Number(payment.amount)+Number(payment.late_fee||0),stallNumber:payment.stall_number,
                description:payment.description,tenantName:payment.tenant_name,tenantEmail:payment.tenant_email,tenantPhone:payment.tenant_phone});
            await Payment.setCheckoutSession(payment.id,checkout.checkoutId,checkout.checkoutUrl,checkout.referenceNumber);
            return checkout;
        });
        res.json({success:true,data:result});
    } catch(error) {
        res.status(error.status || 503).json({success:false,message:error.message || 'Online payment is unavailable.'});
    }
};

const verifyPaymongoPayment = async (req,res) => {
    try {
        const payment=await Payment.findById(req.params.id);
        if(!payment) return res.status(404).json({success:false,message:'Invoice not found.'});
        if(payment.status==='paid') return res.json({success:true,data:payment});
        if(!payment.paymongo_checkout_id || (req.body.checkout_id && req.body.checkout_id!==payment.paymongo_checkout_id)) return res.status(400).json({success:false,message:'Checkout session does not match this invoice.'});
        const updated=await require('../services/paymentSettlement').settleInvoice(payment.id,payment.paymongo_checkout_id);
        res.json({success:true,data:updated});
    } catch(error) {
        res.status(error.status||500).json({success:false,message:error.message||'Unable to verify payment.'});
    }
};

/**
 * Record manual payment or upload payment proof
 * PATCH /api/v1/payments/:id/record
 */
const recordPayment = async (req, res) => {
    try {
        if(req.userRole!=='admin') return res.status(400).json({success:false,message:'Use PayMongo checkout or pay at the HOA office. No manual payment reference is required.'});
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

        if(payment.paymongo_checkout_id || payment.status!=='pending_verification') return res.status(409).json({success:false,message:'Use verified online checkout or the office payment form. Only existing manual submissions can be reviewed here.'});
        if (payment.status === 'paid') return res.status(409).json({ success: false, message: 'This invoice is already paid.' });

        // Handle uploaded file if present via multer
        let finalProofImage = proof_image;
        if (req.file) {
            finalProofImage = req.file.buffer ? await uploadStorage.save(req.file, 'payments', req.userId) : `/uploads/payments/${req.file.filename}`;
        }

        // If tenant uploaded proof, mark as pending verification unless admin verified
        const canVerify = req.userRole === 'admin';
        const status = canVerify && (is_manual_verify || req.userRole === 'admin') ? 'paid' : 'pending_verification';

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
        if(Object.keys(req.body || {}).length) return res.status(400).json({success:false,message:'Billing follows lease schedules. Arbitrary dates and frequencies are no longer accepted.'});
        if(process.env.DEMO_MODE==='true') return res.status(503).json({success:false,message:'Scheduled billing requires PostgreSQL.'});
        const result = await require('../services/recurringBilling').runDueBilling();
        res.status(201).json({success:true, message:`Issued ${result.count} scheduled bills.`, data:result});
    } catch (error) {
        if (error instanceof RangeError) return res.status(400).json({ success: false, message: error.message });
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
        if(!await Payment.delete(id)) return res.status(409).json({success:false,message:'Invoice is missing, paid, or has online checkout and cannot be deleted.'});
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

const recordOfficePayment = async (req, res) => {
    try {
        const payment = await Payment.recordOfficePayment(req.params.id, req.body.amount_received, req.body.receipt_number, req.userId);
        res.json({ success: true, message: 'Office payment recorded.', data: payment });
    } catch (error) {
        res.status(error.code === '23505' ? 409 : error.status || 500).json({ success: false, message: error.code === '23505' ? 'Receipt number already used.' : error.status ? error.message : 'Could not record office payment.' });
    }
};

module.exports = {
    recordOfficePayment,
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
