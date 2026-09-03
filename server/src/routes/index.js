const express = require('express');
const router = express.Router();

// Import v1 routes
const authRoutes = require('./v1/authRoutes');
const stallRoutes = require('./v1/stallRoutes');
const tenantRoutes = require('./v1/tenantRoutes');
const applicationRoutes = require('./v1/applicationRoutes');
const paymentRoutes = require('./v1/paymentRoutes');
const maintenanceRoutes = require('./v1/maintenanceRoutes');
const announcementRoutes = require('./v1/announcementRoutes');
const notificationRoutes = require('./v1/notificationRoutes');
const messageRoutes = require('./v1/messageRoutes');
const userRoutes = require('./v1/userRoutes');

// ==================================================
// API V1 ROUTE MOUNTING
// ==================================================

router.use('/auth', authRoutes);
router.use('/stalls', stallRoutes);
router.use('/tenants', tenantRoutes);
router.use('/applications', applicationRoutes);
router.use('/payments', paymentRoutes);
router.use('/maintenance', maintenanceRoutes);
router.use('/announcements', announcementRoutes);
router.use('/notifications', notificationRoutes);
router.use('/messages', messageRoutes);
router.use('/users', userRoutes);

// Health check
router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Stall Leasing Management System API is running smoothly 🚀',
        version: '1.0.0',
        paymentGateway: 'PayMongo',
        database: 'Supabase PostgreSQL',
        timestamp: new Date().toISOString()
    });
});

// Welcome / API Documentation Route
router.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Welcome to Stall Leasing Management System REST API',
        version: '1.0.0',
        endpoints: {
            auth: {
                register: 'POST /api/v1/auth/register',
                login: 'POST /api/v1/auth/login',
                me: 'GET /api/v1/auth/me'
            },
            stalls: {
                list: 'GET /api/v1/stalls',
                qrcode: 'GET /api/v1/stalls/:id/qrcode',
                create: 'POST /api/v1/stalls',
                update: 'PUT /api/v1/stalls/:id'
            },
            tenants: {
                list: 'GET /api/v1/tenants',
                create: 'POST /api/v1/tenants',
                assignStall: 'PATCH /api/v1/tenants/:id/assign-stall'
            },
            applications: {
                list: 'GET /api/v1/applications',
                create: 'POST /api/v1/applications',
                review: 'PATCH /api/v1/applications/:id/review'
            },
            payments: {
                list: 'GET /api/v1/payments',
                paymongoCheckout: 'POST /api/v1/payments/:id/paymongo-checkout',
                verifyPaymongo: 'POST /api/v1/payments/:id/verify-paymongo',
                recordProof: 'PATCH /api/v1/payments/:id/record',
                generateBills: 'POST /api/v1/payments/generate-bills',
                stats: 'GET /api/v1/payments/stats'
            },
            maintenance: {
                list: 'GET /api/v1/maintenance',
                create: 'POST /api/v1/maintenance',
                updateStatus: 'PATCH /api/v1/maintenance/:id/status'
            },
            announcements: {
                list: 'GET /api/v1/announcements',
                create: 'POST /api/v1/announcements'
            },
            notifications: {
                list: 'GET /api/v1/notifications',
                markRead: 'PATCH /api/v1/notifications/:id/read'
            },
            messages: {
                conversations: 'GET /api/v1/messages/conversations',
                thread: 'GET /api/v1/messages/thread/:contactId',
                send: 'POST /api/v1/messages'
            },
            users: {
                list: 'GET /api/v1/users',
                update: 'PUT /api/v1/users/:id'
            }
        }
    });
});

module.exports = router;