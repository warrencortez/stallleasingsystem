const express = require('express');
const router = express.Router();

// Import routes
const authRoutes = require('./v1/authRoutes');
const stallRoutes = require('./v1/stallRoutes');
const tenantRoutes = require('./v1/tenantRoutes');
const applicationRoutes = require('./v1/applicationRoutes');
const paymentRoutes = require('./v1/paymentRoutes'); // ✅ NEW

// ==================================================
// API ROUTES
// ==================================================

// Auth routes
router.use('/auth', authRoutes);

// Stall routes
router.use('/stalls', stallRoutes);

// Tenant routes
router.use('/tenants', tenantRoutes);

// Application routes
router.use('/applications', applicationRoutes);

// Payment routes ✅ NEW
router.use('/payments', paymentRoutes);

// Health check
router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'API is running smoothly 🚀',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});

// Welcome route
router.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Welcome to Stall Leasing Management System API',
        version: '1.0.0',
        endpoints: {
            auth: {
                register: 'POST /api/v1/auth/register',
                login: 'POST /api/v1/auth/login',
                me: 'GET /api/v1/auth/me (protected)'
            },
            stalls: {
                all: 'GET /api/v1/stalls (protected)',
                create: 'POST /api/v1/stalls (admin)',
                update: 'PUT /api/v1/stalls/:id (admin)',
                delete: 'DELETE /api/v1/stalls/:id (admin)'
            },
            tenants: {
                all: 'GET /api/v1/tenants (protected)',
                create: 'POST /api/v1/tenants (admin)',
                update: 'PUT /api/v1/tenants/:id (admin)',
                delete: 'DELETE /api/v1/tenants/:id (admin)'
            },
            applications: {
                all: 'GET /api/v1/applications (admin)',
                create: 'POST /api/v1/applications (protected)',
                review: 'PATCH /api/v1/applications/:id/review (admin)'
            },
            payments: {
                all: 'GET /api/v1/payments (admin)',
                create: 'POST /api/v1/payments (admin)',
                record: 'PATCH /api/v1/payments/:id/record (tenant)',
                generate: 'POST /api/v1/payments/generate-bills (admin)',
                stats: 'GET /api/v1/payments/stats (admin)'
            }
        }
    });
});

module.exports = router;