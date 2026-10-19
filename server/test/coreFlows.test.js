process.env.DEMO_MODE = 'true';
process.env.JWT_SECRET = 'isolated-regression-secret';
require('dotenv').config = () => ({});
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const User = require('../src/models/User');
const Tenant = require('../src/models/Tenant');
const Stall = require('../src/models/Stall');
const Application = require('../src/models/Application');
const Payment = require('../src/models/Payment');
const Notification = require('../src/models/Notification');
const provider = require('../src/services/paymongoService');
provider.secretKey = 'sk_test_fixture';
const { generateToken } = require('../src/config/jwt');
let server, base, admin, owner, other, stall, lease, invoice;
async function request(route, token, body, method = body ? 'POST' : 'GET') {
    const res = await fetch(base + route, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: res.status, body: await res.json() };
}
test.before(async () => {
    const app = express(); app.use(express.json());
    for (const [url, file] of [['auth','auth'],['tenants','tenant'],['stalls','stall'],['applications','application'],['payments','payment'],['maintenance','maintenance']]) app.use('/' + url, require('../src/routes/v1/' + file + 'Routes'));
    server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r));
    base = `http://127.0.0.1:${server.address().port}`;
    const adminId = await User.create({ name: 'QA admin', email: 'qa-admin@example.invalid', password: 'QaPass123', role: 'admin' });
    admin = generateToken(adminId, 'admin');
    // Core business-flow fixtures represent already verified tenants; registration is
    // exercised separately against transactional PostgreSQL and a fake OTP provider.
    const ownerId = await User.create({name:'Owner',email:'owner@example.invalid',phone:'+639111111111',password:'QaPass123',role:'tenant'});
    const otherId = await User.create({name:'Other',email:'other@example.invalid',phone:'09999999999',password:'QaPass123',role:'tenant'});
    owner = {user:await User.findById(ownerId),token:generateToken(ownerId,'tenant')};
    other = {user:await User.findById(otherId),token:generateToken(otherId,'tenant')};
    stall = await Stall.create({ stall_number: 'QA-01', monthly_rent: 1000, status: 'available' });
    lease = await Tenant.create({ user_id: owner.user.id, stall_id: stall, name: 'Owner', email: owner.user.email, status: 'active' });
    invoice = await Payment.create({ tenant_id: lease, stall_id: stall, amount: 1000, due_date: '2026-10-28' });
});
test.after(() => server?.close());
test('public signup cannot bypass email verification with the old registration payload', async () => {
    const response=await request('/auth/register',null,{name:'Unverified',email:'unverified@example.invalid',phone:'+639222222222',password:'QaPass123',role:'admin'});
    assert.equal(response.status,400);
    assert.equal(response.body.data,undefined);
    assert.equal(await User.findByEmail('unverified@example.invalid'),undefined);
    assert.equal(owner.user.password,undefined);
});
test('repeat login works, wrong demo passwords fail, profiles hide hashes', async () => {
    for (let i = 0; i < 2; i++) assert.equal((await request('/auth/login', null, { email: owner.user.email, password: 'QaPass123' })).status, 200);
    assert.equal((await request('/auth/login', null, { email: owner.user.email, password: 'tenant123' })).status, 401);
    assert.equal((await request('/auth/me', owner.token)).body.data.user.password, undefined);
    const hash = await require('bcryptjs').hash('DifferentPassword', 10);
    assert.equal(await User.comparePassword('admin123', '$2a$' + hash.slice(4)), false);
    assert.equal(await User.comparePassword('plaintext', 'plaintext'), false);
});
test('partial profile edits preserve name and password changes use internal hash', async () => {
    const edit = await request('/auth/profile', owner.token, { phone: '09123456789' }, 'PUT');
    assert.equal(edit.status, 200); assert.equal(edit.body.data.user.name, 'Owner'); assert.equal(edit.body.data.user.phone, '09123456789');
    assert.equal((await request('/auth/change-password', owner.token, { currentPassword: 'QaPass123', newPassword: 'NewPass123' }, 'PUT')).status, 200);
    assert.equal((await request('/auth/login', null, { email: owner.user.email, password: 'NewPass123' })).status, 200);
    assert.equal((await request('/auth/login', null, { email: owner.user.email, password: 'QaPass123' })).status, 401);
});
test('tenant lists, invoice IDs and checkout deny foreign accounts', async () => {
    assert.equal((await request('/tenants', other.token)).body.data.length, 0);
    assert.equal((await request('/tenants/' + lease, other.token)).status, 403);
    assert.equal((await request('/payments', other.token)).body.data.length, 0);
    assert.equal((await request('/payments/' + invoice, other.token)).status, 403);
    assert.equal((await request('/payments/' + invoice + '/paymongo-checkout', other.token, {})).status, 403);
    assert.equal((await request('/stalls/' + stall + '/details', other.token)).status, 403);
});
test('invalid invoice amounts and dates are rejected', async () => {
    for (const amount of [-1, 0, 'NaN', 1.001]) assert.equal((await request('/payments', admin, { tenant_id: lease, amount, due_date: '2026-10-28' })).status, 400);
    assert.equal((await request('/payments', admin, { tenant_id: lease, amount: 100, due_date: '2026-02-30' })).status, 400);
});
test('manual references rejected, missing/unpaid/mismatched provider sessions never settle', async () => {
    const prefix = '/payments/' + invoice;
    assert.equal((await request(prefix + '/record', owner.token, { is_manual_verify: true, reference_number: 'actual-ref' }, 'PATCH')).status, 400);
    await Payment.setCheckoutSession(invoice, 'cs_owned', 'https://example.invalid/checkout', 'ref-owned');
    const original = provider.retrieveCheckoutSession;
    try {
        for (const session of [null, { id: 'cs_owned', attributes: { payments: [] } }, { id: 'cs_foreign', attributes: { payments: [{ attributes: { status: 'paid', amount: 100000, currency: 'PHP' } }] } }, { id: 'cs_owned', attributes: { payments: [{ attributes: { status: 'paid', amount: 1, currency: 'PHP' } }] } }]) {
            provider.retrieveCheckoutSession = async () => session;
            assert.equal((await request(prefix + '/verify-paymongo', owner.token, { checkout_id: 'cs_owned' })).status, session ? 409 : 503);
            assert.notEqual((await Payment.findById(invoice)).status, 'paid');
        }
        provider.retrieveCheckoutSession = async () => ({ id: 'cs_owned', attributes: {livemode:provider.secretKey.startsWith('sk_live_'),metadata:{invoice_id:invoice}, payments: [{ id: 'pay_owned', attributes: { status: 'paid', amount: 100000, currency: 'PHP' } }] } });
        assert.equal((await request(prefix + '/verify-paymongo', owner.token, { checkout_id: 'cs_owned' })).status, 200);
        assert.equal((await Payment.findById(invoice)).status, 'paid');
        assert.equal((await request(prefix + '/record', owner.token, {}, 'PATCH')).status, 400);
    } finally { provider.retrieveCheckoutSession = original; }
});
test('application submission, ownership, approval and competing rejection are consistent', async () => {
    const available = await Stall.create({ stall_number: 'QA-02', monthly_rent: 500, status: 'available' });
    const apply = token => request('/applications', token, { full_name: 'Applicant', business_name: 'Shop', stall_id: available, user_id: 'forged' });
    const a = await apply(owner.token), b = await apply(other.token);
    assert.equal(a.status, 201); assert.equal(b.status, 201);
    assert.equal(a.body.data.user_id, owner.user.id);
    const list = await request('/applications?user_id=' + other.user.id, owner.token);
    assert.ok(list.body.data.every(x => x.user_id === owner.user.id));
    assert.equal((await request('/applications/' + b.body.data.id, owner.token)).status, 403);
    const approved = await request('/applications/' + a.body.data.id + '/review', admin, { status: 'approved' }, 'PATCH');
    assert.equal(approved.status, 200);
    assert.equal((await Stall.findById(available)).status, 'occupied');
    assert.equal((await Application.findById(b.body.data.id)).status, 'rejected');
    const leases = (await request('/tenants', owner.token)).body.data;
    assert.equal(leases.length, 2); assert.ok(leases.some(t => t.id === lease));
    const ticket = await request('/maintenance', owner.token, { title: 'Repair', description: 'Broken light', stall_id: available });
    assert.equal(ticket.status, 201);
    assert.equal((await request('/maintenance', owner.token)).body.data.length, 1);
    assert.equal((await request('/maintenance', other.token)).body.data.length, 0);
    assert.equal((await request('/maintenance/' + ticket.body.data.id, other.token)).status, 403);
    assert.equal((await request('/maintenance', other.token, { title: 'Foreign', description: 'Forged', stall_id: available, tenant_id: leases[0].id })).status, 403);
});
test('approval rolls back all changes on failure and serializes competing approvals', async () => {
    const available = await Stall.create({ stall_number: 'QA-03', monthly_rent: 500, status: 'available' });
    const a = await Application.create({ user_id: owner.user.id, stall_id: available, full_name: 'Owner', business_name: 'Shop' });
    const b = await Application.create({ user_id: other.user.id, stall_id: available, full_name: 'Other', business_name: 'Shop' });
    const review = require('../src/services/applicationReview').review;
    const original = Notification.create;
    Notification.create = async () => { throw new Error('Forced notification failure'); };
    try { await assert.rejects(review(a, 'approved', '', owner.user.id), /Forced/); } finally { Notification.create = original; }
    assert.equal((await Application.findById(a)).status, 'pending');
    assert.equal((await Stall.findById(available)).status, 'available');
    assert.equal((await Tenant.findAll()).filter(t => t.stall_id === available).length, 0);
    const outcomes = await Promise.allSettled([review(a, 'approved', '', owner.user.id), review(b, 'approved', '', owner.user.id)]);
    assert.equal(outcomes.filter(x => x.status === 'fulfilled').length, 1);
    assert.equal((await Tenant.findAll()).filter(t => t.stall_id === available).length, 1);
});

test('simultaneous monthly generation does not create duplicate invoices', async () => {
    const results = await Promise.all([Payment.generateMonthlyBills(1, 2027), Payment.generateMonthlyBills(1, 2027)]);
    const invoices = await Payment.findAll({ month: 1, year: 2027 });
    assert.equal(results[0].length + results[1].length, invoices.length);
    const keys = invoices.map(p => `${p.tenant_id}:${p.stall_id}`);
    assert.equal(new Set(keys).size, keys.length);
});
test('provider failure never creates simulated checkout or simulated settlement', async () => {
    const originalFetch = global.fetch, originalKey = provider.secretKey, originalReady=provider.assertReady;
    provider.assertReady=()=>{};
    provider.secretKey = 'sk_test_fixture_only';
    global.fetch = async () => { throw new Error('Fixture network outage'); };
    try {
        await assert.rejects(provider.createCheckoutSession({ paymentId: invoice, amount: 1000 }), /could not create checkout/);
        assert.equal(await provider.retrieveCheckoutSession('cs_sim_fake'), null);
    } finally { global.fetch = originalFetch; provider.secretKey = originalKey; provider.assertReady=originalReady; }
});

test('invoice edits reject negative values, invalid dates, and ownership reassignment', async () => {
    for (const body of [{ amount: -1 }, { late_fee: -10 }, { due_date: '2026-02-30' }, { tenant_id: 'foreign' }]) {
        assert.equal((await request('/payments/' + invoice, admin, body, 'PUT')).status, 409);
    }
    const settled = await Payment.recordPayment(invoice, { status: 'pending_verification', reference_number: 'late-upload' });
    assert.equal(settled.status, 'paid');
});

test('daily generation charges only leased days, skips monthly leases, and is repeat-safe', async () => {
    const id = await Stall.create({ stall_number: 'QA-DAILY', monthly_rent: 125, daily_rent: 125, rent_type: 'daily', status: 'occupied' });
    const dailyLease = await Tenant.create({ user_id: owner.user.id, stall_id: id, name: 'Daily renter', status: 'active', contract_start: '2026-10-02', contract_end: '2026-10-04' });
    assert.equal((await Payment.generateDailyBills('2026-10-01')).length, 0);
    const outputs = await Promise.all([Payment.generateDailyBills('2026-10-02'), Payment.generateDailyBills('2026-10-02')]);
    assert.equal(outputs.flat().length, 1); assert.equal(Number(outputs.flat()[0].amount), 125);
    assert.equal((await Payment.generateDailyBills('2026-10-03')).length, 1);
    assert.equal((await Payment.generateDailyBills('2026-10-05')).length, 0);
    await Payment.generateMonthlyBills(10, 2026);
    assert.ok((await Payment.findByTenantId(dailyLease)).every(p => p.billing_type === 'daily'));
    assert.equal((await request('/payments/generate-bills', admin, { billing_type: 'daily', date: '2026-02-30' })).status, 400);
    assert.equal((await request('/payments/generate-bills', owner.token, { billing_type: 'daily', date: '2026-10-04' })).status, 403);
});
test('office payments require admin, exact full amount, unique receipt, and cannot settle twice', async () => {
    const id = await Payment.create({ tenant_id: lease, stall_id: stall, amount: 700, due_date: '2026-10-02' });
    const url = '/payments/' + id + '/office-payment';
    assert.equal((await request(url, owner.token, { amount_received: 700, receipt_number: 'OR-TEST' })).status, 403);
    assert.equal((await request(url, admin, { amount_received: 699, receipt_number: 'OR-TEST' })).status, 400);
    assert.equal((await request(url, admin, { amount_received: 700, receipt_number: '' })).status, 400);
    const outcomes = await Promise.all([request(url, admin, { amount_received: 700, receipt_number: 'OR-TEST' }), request(url, admin, { amount_received: 700, receipt_number: 'OR-TEST' })]);
    assert.deepEqual(outcomes.map(r=>r.status).sort(), [200,409]);
    const paid = await Payment.findById(id); assert.equal(paid.status, 'paid'); assert.equal(paid.payment_method, 'cash_office'); assert.ok(paid.received_by);
    const next = await Payment.create({ tenant_id: lease, stall_id: stall, amount: 700, due_date: '2026-10-03' });
    assert.equal((await request('/payments/'+next+'/office-payment', admin, { amount_received: 700, receipt_number: 'or-test' })).status, 409);
});

test('cash cannot overlap a pending online checkout or submitted proof', async()=>{
    for(const details of [{paymongo_checkout_id:'cs_existing'},{status:'pending_verification'}]) {
        const id=await Payment.create({tenant_id:lease,stall_id:stall,amount:50,due_date:'2026-10-02',...details});
        const result=await request('/payments/'+id+'/office-payment',admin,{amount_received:50,receipt_number:'OR-CONFLICT'});
        assert.equal(result.status,409);assert.notEqual((await Payment.findById(id)).status,'paid');
    }
});

test('only the owning tenant can cancel pending applications, and can apply again', async () => {
    const id=await Stall.create({stall_number:'QA-CANCEL',monthly_rent:100,status:'available'});
    const body={stall_id:id,full_name:'Owner',business_name:'Shop',email:owner.user.email,phone:'+639111111111'};
    const created=await request('/applications',owner.token,body);
    assert.equal(created.status,201);
    const applicationId=created.body.data.id;
    const route='/applications/'+applicationId+'/cancel';
    assert.equal((await request(route,other.token,{},'PATCH')).status,403);
    assert.equal((await request(route,null,{},'PATCH')).status,401);
    assert.equal((await request(route,admin,{},'PATCH')).status,403);
    assert.equal((await request(route,owner.token,{},'PATCH')).body.data.status,'cancelled');
    assert.equal((await request(route,owner.token,{},'PATCH')).status,200);
    assert.equal((await request('/applications/'+applicationId+'/review',admin,{status:'approved'},'PATCH')).status,409);
    assert.equal((await Stall.findById(id)).status,'available');
    const again=await request('/applications',owner.token,body);
    assert.equal(again.status,201);
    assert.equal((await request('/applications/'+again.body.data.id+'/review',admin,{status:'approved'},'PATCH')).status,200);
    assert.equal((await request('/applications/'+again.body.data.id+'/cancel',owner.token,{},'PATCH')).status,409);
});
