const { timingSafeEqual } = require('node:crypto');
const { pool } = require('../config/database');
const billing = require('./recurringBilling');
const payments = require('./paymentSettlement');

function authorized(header, secret) {
    if (!secret || secret.length < 32 || typeof header !== 'string') return false;
    const expected = Buffer.from(`Bearer ${secret}`), actual = Buffer.from(header);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
}
async function handle(req, res) {
    res.set('Cache-Control', 'no-store');
    if (!authorized(req.get('Authorization'), process.env.CRON_SECRET)) return res.sendStatus(401);
    try {
        const result = await billing.runDueBilling();
        await payments.reconcile({ throwOnError: true });
        await pool.query('DELETE FROM auth_rate_limits WHERE expires_at < NOW()');
        await pool.query(`INSERT INTO scheduled_job_runs(name, last_success, details)
            VALUES ('maintenance', NOW(), $1) ON CONFLICT(name)
            DO UPDATE SET last_success=NOW(), details=EXCLUDED.details`, [JSON.stringify(result)]);
        return res.json({ success: true, data: result });
    } catch (error) {
        console.error('[Scheduled jobs]', error.message);
        return res.status(503).json({ success: false, message: 'Scheduled tasks did not finish. Retry the request.' });
    }
}
module.exports = { authorized, handle };
