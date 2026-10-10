const crypto = require('node:crypto');
const { pool } = require('../config/database');
const provider = require('./paymongoService');
const Notification = require('../models/Notification');

function confirmedPayment(invoice, session) {
    const attrs = session?.attributes;
    const expected = Math.round((Number(invoice.amount) + Number(invoice.late_fee || 0)) * 100);
    const live = provider.secretKey.startsWith('sk_live_');
    if (session?.id !== invoice.paymongo_checkout_id || attrs?.metadata?.invoice_id !== invoice.id ||
        attrs.livemode !== live || !provider.modeAllowed()) return null;
    return attrs.payments?.find(p => p.id && p.attributes?.status === 'paid' &&
        p.attributes.amount === expected && p.attributes.currency === 'PHP') || null;
}

async function settleInvoice(id, checkoutId) {
    // Verify using the provider API, never a redirect or client-supplied reference.
    const session = await provider.retrieveCheckoutSession(checkoutId);
    if (!session) throw Object.assign(new Error('Payment provider verification unavailable. Please retry.'), {status:503});
    return pool.withTransaction(async client => {
        const invoice = (await client.query('SELECT * FROM payments WHERE id = $1 FOR UPDATE', [id])).rows[0];
        if (!invoice) throw Object.assign(new Error('Invoice not found.'), {status:404});
        if (invoice.paymongo_checkout_id !== checkoutId) throw Object.assign(new Error('Checkout session does not match this invoice.'), {status:409});
        if (invoice.status === 'paid') return invoice;
        const paid = confirmedPayment(invoice, session);
        if (!paid) throw Object.assign(new Error('Payment is not confirmed. Your bill remains outstanding.'), {status:409});
        const result = await client.query(`UPDATE payments SET status='paid', payment_date=(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date,
            payment_method='paymongo_online', reference_number=$1, paymongo_payment_id=$1, updated_at=CURRENT_TIMESTAMP
            WHERE id=$2 AND status<>'paid' RETURNING *`, [paid.id, id]);
        const tenant = (await client.query('SELECT user_id FROM tenants WHERE id = $1', [invoice.tenant_id])).rows[0];
        if (tenant?.user_id) await Notification.create({user_id:tenant.user_id, title:'Payment confirmed',
            message:`Your rent payment of PHP ${(Number(invoice.amount)+Number(invoice.late_fee||0)).toFixed(2)} was confirmed by PayMongo.`, type:'payment_success', link:'/payments'});
        return result.rows[0];
    });
}

function validSignature(raw, header, secret, live, now = Date.now()) {
    if (!Buffer.isBuffer(raw) || !header || !secret) return false;
    const fields = Object.fromEntries(header.split(',').map(part => part.trim().split('=')));
    const timestamp = Number(fields.t);
    const signature = fields[live ? 'li' : 'te'];
    if (!Number.isInteger(timestamp) || Math.abs(now/1000-timestamp)>300 || !/^[a-f0-9]{64}$/i.test(signature || '')) return false;
    const expected = crypto.createHmac('sha256',secret).update(`${fields.t}.`).update(raw).digest();
    return crypto.timingSafeEqual(expected,Buffer.from(signature,'hex'));
}

async function webhook(req,res) {
    if (!process.env.PAYMONGO_WEBHOOK_SECRET) return res.status(503).json({success:false});
    if (!validSignature(req.body,req.get('Paymongo-Signature'),process.env.PAYMONGO_WEBHOOK_SECRET,provider.secretKey.startsWith('sk_live_'))) return res.status(400).json({success:false});
    try {
        const event = JSON.parse(req.body.toString('utf8')).data?.attributes;
        if (event?.type !== 'checkout_session.payment.paid') return res.sendStatus(200);
        const sessionId = event.data?.id;
        if (typeof sessionId !== 'string') return res.sendStatus(400);
        const invoices = (await pool.query('SELECT id FROM payments WHERE paymongo_checkout_id=$1',[sessionId])).rows;
        for (const invoice of invoices) await settleInvoice(invoice.id, sessionId);
        return res.sendStatus(200);
    } catch(error) {
        console.error('[PayMongo webhook]',error.message);
        return res.sendStatus(error instanceof SyntaxError ? 400 : 503);
    }
}

let reconciling = false;
async function reconcile({ throwOnError = false } = {}) {
    if (reconciling || !provider.secretKey) return;
    reconciling = true;
    try {
        const pending = (await pool.query(`SELECT id,paymongo_checkout_id FROM payments WHERE status<>'paid'
            AND paymongo_checkout_id IS NOT NULL ORDER BY updated_at ASC LIMIT 20`)).rows;
        for (const invoice of pending) {
            try { await settleInvoice(invoice.id,invoice.paymongo_checkout_id); }
            catch(error) { if (error.status !== 409) { if (throwOnError) throw error; console.error('[PayMongo reconciliation]',error.message); } }
            // Rotate the queue so an abandoned checkout cannot starve newer payments.
            await pool.query('UPDATE payments SET updated_at=CURRENT_TIMESTAMP WHERE id=$1',[invoice.id]);
        }
    } catch(error) { if (throwOnError) throw error; console.error('[PayMongo reconciliation]',error.message); }
    finally { reconciling = false; }
}
function start() { void reconcile(); const timer=setInterval(reconcile,60000);timer.unref();return ()=>clearInterval(timer); }
module.exports={confirmedPayment,settleInvoice,validSignature,webhook,start,reconcile};
