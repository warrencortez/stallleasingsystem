const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');
const path = require('path');
const { randomBytes } = require('node:crypto');
const { testConnection } = require('./src/config/database');
const routes = require('./src/routes');

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;
if ((process.env.VERCEL || process.env.NETLIFY)) app.set('trust proxy', 1);
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
if (!(process.env.VERCEL || process.env.NETLIFY)) app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/v1', routes);

app.get('/payments/return', helmet.contentSecurityPolicy({
    directives: {
        scriptSrc: ["'self'", (_req, res) => {
            res.locals.paymentReturnNonce = randomBytes(16).toString('base64');
            return `'nonce-${res.locals.paymentReturnNonce}'`;
        }]
    }
}), (req, res) => {
    // Treat all return parameters as untrusted routing hints. Payment state is
    // only established by the authenticated verification API / signed webhook.
    const rawPaymentId = typeof req.query.payment_id === 'string' ? req.query.payment_id : '';
    const paymentId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(rawPaymentId)
        ? rawPaymentId
        : '';
    const rawStatus = typeof req.query.status === 'string' ? req.query.status : '';
    const status = ['success', 'cancelled', 'failed', 'pending'].includes(rawStatus) ? rawStatus : 'unknown';
    const returnQuery = `${paymentId ? `payment_id=${encodeURIComponent(paymentId)}&` : ''}status=${encodeURIComponent(status)}`;
    const deepLink = `leasehub://payment-return?${returnQuery}`;
    const intentLink = `intent://payment-return?${returnQuery}#Intent;scheme=leasehub;package=com.leasehub.tenant;end`;
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.type('html').send(`<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Returning to MR99 Mobile App</title>
</head>
<body>
    <main>
        <h2>Opening MR99 Mobile App…</h2>
        <p>Your payment will be checked securely in the app.</p>
        <a href="${intentLink}">Continue to MR99 Mobile App</a>
    </main>
    <script nonce="${res.locals.paymentReturnNonce}">
        // Android Chrome supports intent URLs with an explicit package target.
        // The custom scheme remains the fallback for browsers that do not.
        const intentUrl = ${JSON.stringify(intentLink)};
        const appUrl = ${JSON.stringify(deepLink)};
        window.location.href = intentUrl;
        setTimeout(() => {
            if (document.visibilityState === 'visible') window.location.href = appUrl;
        }, 900);
    </script>
</body>
</html>`);
});

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
if (!(process.env.VERCEL || process.env.NETLIFY) && require.main === module) testConnection().then(ready => {
    if (!ready) { process.exitCode = 1; return; }
    if (process.env.DEMO_MODE !== 'true') {
        require('./src/services/recurringBilling').start();
        require('./src/services/paymentSettlement').start();
    }
    app.listen(PORT, () => console.log(`Dela Costa HOA API running at http://localhost:${PORT}/api/v1`));
});
