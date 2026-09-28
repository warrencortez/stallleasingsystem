process.env.DEMO_MODE = 'true';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
function load(file, dependencies) {
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {
        module, exports: module.exports, require: name => {
            if (!(name in dependencies)) throw new Error(`Unexpected dependency ${name}`);
            return dependencies[name];
        }, console, process, Date, structuredClone
    });
    return module.exports;
}
const { pool } = load('config/database.js', {
    pg: { Pool: class {} }, dotenv: { config() {} }, bcryptjs: { hashSync: () => 'hash' }, crypto: require('node:crypto'), 'node:async_hooks': require('node:async_hooks')
});
const Payment = load('models/Payment.js', { '../config/database': { pool } });
const Tenant = load('models/Tenant.js', { '../config/database': { pool } });
const Stall = load('models/Stall.js', { '../config/database': { pool } });
let tenant, other, stall, invoice;
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
const controller = load('controllers/paymentController.js', {
    '../models/Payment': Payment, '../models/Tenant': Tenant, '../models/Stall': Stall,
    '../models/Notification': { create: async () => {} }, '../services/paymongoService': {}
});
test.before(async () => {
    stall = await Stall.create({ stall_number: 'A-1', monthly_rent: 1000 });
    tenant = await Tenant.create({ user_id: 'owner', stall_id: stall, status: 'active', contract_start: '2026-09-01', contract_end: '2026-10-31' });
    other = await Tenant.create({ user_id: 'other', stall_id: stall, status: 'active' });
    invoice = await Payment.create({ tenant_id: tenant, stall_id: stall, amount: 1000, due_date: '2026-09-28' });
    await Payment.create({ tenant_id: other, stall_id: stall, amount: 2000, due_date: '2026-09-28' });
});
test('unlinked account receives no invoices, even with another tenant filter', async () => {
    const res = response();
    await controller.getAllPayments({ query: { tenant_id: tenant }, userRole: 'tenant', userId: 'unlinked' }, res);
    assert.equal(res.body.data.length, 0);
});
test('account only receives owned bills and admin retains all bills', async () => {
    const res = response();
    await controller.getAllPayments({ query: {}, userRole: 'tenant', userId: 'owner' }, res);
    assert.equal(res.body.data.length, 1);
    assert.equal(res.body.data[0].id, invoice);
    assert.equal((await Payment.findAll()).length, 2);
    assert.equal((await Payment.findAll({ user_id: 'owner', tenant_id: other })).length, 0);
});
test('invoice routes deny unlinked and foreign accounts before upload or checkout', async () => {
    const routes = [];
    const router = Object.fromEntries(['use', 'get', 'post', 'put', 'patch', 'delete'].map(method => [method, (...args) => routes.push({ method, args })]));
    load('routes/v1/paymentRoutes.js', {
        express: { Router: () => router }, '../../controllers/paymentController': controller,
        '../../middleware/auth': { authenticate() {}, authorize: () => () => {} },
        '../../middleware/upload': { single: () => () => {} }, '../../models/Tenant': Tenant, '../../models/Payment': Payment
    });
    for (const route of routes.filter(r => ['/:id', '/:id/record', '/:id/paymongo-checkout', '/:id/verify-paymongo'].includes(r.args[0]) && ['get', 'patch', 'post'].includes(r.method))) {
        for (const userId of ['unlinked', 'other', 'owner']) {
            const res = response(); let proceeded = false;
            await route.args[1]({ params: { id: invoice }, userRole: 'tenant', userId }, res, () => { proceeded = true; });
            assert.equal(proceeded, userId === 'owner');
            if (!proceeded) assert.equal(res.statusCode, 403);
        }
    }
});
test('missing checkout invoice never selects a different bill', async () => {
    const res = response();
    await controller.createPaymongoCheckout({ params: { id: 'missing' } }, res);
    assert.equal(res.statusCode, 404);
});
test('tenants cannot mark receipts paid using manual verification flag', async () => {
    const res = response();
    await controller.recordPayment({ params: { id: invoice }, userRole: 'tenant', body: { is_manual_verify: true } }, res);
    assert.equal(res.body.data.status, 'pending_verification');
});
test('manual invoice requires an active assigned matching stall', async () => {
    const unassigned = await Tenant.create({ user_id: 'new', status: 'active' });
    for (const data of [{ tenant_id: unassigned }, { tenant_id: tenant, stall_id: 'wrong' }]) {
        const res = response();
        await controller.createPayment({ body: { ...data, amount: 100, due_date: '2026-09-28' } }, res);
        assert.equal(res.statusCode, 400);
    }
});
test('generation respects contract dates, assigned stalls, and duplicate month', async () => {
    const first = await Payment.generateMonthlyBills(10, 2026);
    assert.equal(first.length, 2);
    assert.equal((await Payment.generateMonthlyBills(10, 2026)).length, 0);
    assert.equal((await Payment.generateMonthlyBills(11, 2026)).length, 1);
    assert.equal((await Payment.generateMonthlyBills(8, 2026)).length, 1);
    await assert.rejects(Payment.generateMonthlyBills(13, 2026), /Invalid billing/);
});
