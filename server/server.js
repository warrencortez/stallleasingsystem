const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');
const path = require('path');
const { testConnection } = require('./src/config/database');
const routes = require('./src/routes');

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;
if (process.env.VERCEL) app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(morgan('dev'));
app.get('/health', (req, res) => res.json({ success: true }));

let databaseReady;
app.use(async (req, res, next) => {
    databaseReady ||= testConnection();
    if (!await databaseReady) {
        databaseReady = null;
        return res.status(503).json({ success: false, message: 'Database temporarily unavailable.' });
    }
    next();
});
app.get('/api/cron/maintenance', require('./src/services/scheduledJobs').handle);
// Signature verification must receive the original bytes, before JSON parsing.
app.post('/api/v1/payments/paymongo-webhook', express.raw({ type: 'application/json', limit: '1mb' }), require('./src/services/paymentSettlement').webhook);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
if (!process.env.VERCEL) app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/v1', routes);
app.get('/payments/return', (req, res) => res.type('html').send('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Dela Costa HOA Payments</title><body><main><h1>Return to the tenant app</h1><p>You can close this page and check Billing in the app. A receipt appears after the server confirms your payment.</p><p>If you cancelled checkout, your bill remains outstanding.</p></main></body></html>'));
app.get('/', (req, res) => res.json({ success: true, message: 'Dela Costa HOA Stall Leasing API (API)', version: '1.0.0', documentation: '/api/v1' }));
app.use((req, res) => res.status(404).json({ success: false, message: `Route not found: ${req.originalUrl}` }));
app.use((err, req, res, next) => {
    const status = err.status || err.statusCode || (err.code === 'LIMIT_FILE_SIZE' ? 413 : 500);
    console.error('[API]', err.code || err.name, err.message);
    res.status(status).json({ success: false, error_code: err.code || 'ERR_INTERNAL_SERVER',
        message: status >= 500 && process.env.NODE_ENV === 'production' ? 'An unexpected server error occurred.' : err.message,
        ...(process.env.NODE_ENV !== 'production' && { details: err.details || null, stack: err.stack }) });
});

module.exports = app;
if (!process.env.VERCEL && require.main === module) testConnection().then(ready => {
    if (!ready) { process.exitCode = 1; return; }
    if (process.env.DEMO_MODE !== 'true') {
        require('./src/services/recurringBilling').start();
        require('./src/services/paymentSettlement').start();
    }
    app.listen(PORT, () => console.log(`Dela Costa HOA API running at http://localhost:${PORT}/api/v1`));
});
