const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function fixture({ accounts = [], valid = true, google = true, confirmed = true } = {}) {
    const records = structuredClone(accounts);
    const identity = { id: 'google-user', email: 'tenant@example.com', email_confirmed_at: confirmed ? '2026-10-10' : null,
        identities: google ? [{ provider: 'google', identity_data: { email_verified: true, email: 'tenant@example.com', full_name: 'Tenant' } }] : [] };
    let lookups = 0;
    const query = async (sql, args) => {
        lookups++;
        if (sql.includes('pg_advisory')) return { rows: [] };
        if (sql.startsWith('SELECT')) {
            const found = sql.includes('supabase_user_id') ? records.find(u => u.supabase_user_id === args[0]) :
                records.find(u => u.email.toLowerCase() === args[0].toLowerCase() || (sql.includes('phone=') && u.phone === args[0]));
            return { rows: found ? [found] : [] };
        }
        if (sql.startsWith('UPDATE users')) { records.find(u => u.id === args[1]).supabase_user_id = args[0]; return { rows: [] }; }
        throw new Error(`Unexpected query ${sql}`);
    };
    const dependencies = {
        'node:crypto': crypto,
        '../config/database': { pool: { withTransaction: async fn => {
            const before = structuredClone(records);
            try { return await fn({ query }); } catch (error) { records.splice(0, records.length, ...before); throw error; }
        } } },
        '../config/supabase': { auth: () => ({ auth: { getUser: async token => ({ data: { user: identity }, error: valid && token === 'verified-token' ? null : new Error('Invalid') }) } }) },
        '../models/User': {
            comparePassword: async (password, hash) => password === 'correct-password' && hash === 'hashed-password',
            toPublic: ({ id, role, email, is_active }) => ({ id, role, email, is_active }),
            create: async data => { records.push({ ...data, id: 'new-user', is_active: true }); return 'new-user'; },
            findById: async id => records.find(u => u.id === id)
        },
        '../config/jwt': { generateToken: (id, role) => `${id}:${role}` }
    };
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/controllers/googleAuthController.js'), 'utf8'), {
        module, exports: module.exports, require: name => dependencies[name], console
    });
    return { records, get lookups() { return lookups; }, async login(body = {}) {
        const res = { statusCode: 200, set() {}, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
        await module.exports.googleLogin({ body: { accessToken: 'verified-token', ...body } }, res);
        return res;
    } };
}
const account = { id: 'existing', email: 'tenant@example.com', role: 'tenant', is_active: true, password: 'hashed-password' };

test('forged, non-Google and unconfirmed identities never reach account storage', async () => {
    for (const options of [{ valid: false }, { google: false }, { confirmed: false }]) {
        const app = fixture(options);
        assert.equal((await app.login()).statusCode, 401);
        assert.equal(app.lookups, 0);
    }
});
test('new Google users are tenants and cannot self-provision an administrator', async () => {
    const app = fixture();
    const result = await app.login({ role: 'admin', email: 'forged@example.com' });
    assert.equal(result.statusCode, 200);
    assert.equal(result.body.data.user.role, 'tenant');
    assert.equal(result.body.data.user.email, 'tenant@example.com');
    assert.equal(result.body.data.user.password, undefined);
    assert.equal(app.records[0].supabase_user_id, 'google-user');
    const admin = fixture();
    assert.equal((await admin.login({ audience: 'admin' })).statusCode, 403);
    assert.equal(admin.records.length, 0);
});
test('matching email alone never takes over an existing account', async () => {
    const app = fixture({ accounts: [account] });
    const required = await app.login();
    assert.equal(required.statusCode, 409);
    assert.equal(required.body.code, 'GOOGLE_LINK_REQUIRED');
    assert.equal((await app.login({ existingPassword: 'wrong' })).statusCode, 401);
    assert.equal(app.records[0].supabase_user_id, undefined);
    assert.equal((await app.login({ existingPassword: 'correct-password' })).body.data.user.id, 'existing');
    assert.equal((await app.login()).body.data.user.id, 'existing');
    assert.equal(app.records.length, 1);
});
test('phone-only accounts link with proof of their existing credentials and keep their ID', async () => {
    const app = fixture({ accounts: [{ ...account, email: '639123456789@tenant.stalllease.com', phone: '+639123456789' }] });
    assert.equal((await app.login({ existingIdentifier: '+639123456789', existingPassword: 'wrong' })).statusCode, 401);
    const linked = await app.login({ existingIdentifier: '+639123456789', existingPassword: 'correct-password' });
    assert.equal(linked.body.data.user.id, 'existing');
    assert.equal(app.records.length, 1);
    assert.equal((await app.login()).body.data.user.id, 'existing');
});
test('disabled accounts, wrong portals and already-linked accounts remain inaccessible', async () => {
    for (const record of [{ ...account, is_active: false }, { ...account, role: 'admin' }, { ...account, supabase_user_id: 'different-google' }]) {
        const app = fixture({ accounts: [record] });
        const response = await app.login({ existingPassword: 'correct-password' });
        assert.ok([403, 409].includes(response.statusCode));
        assert.equal(response.body.data, undefined);
    }
});
test('only an existing administrator with proof can connect Google to the admin portal', async () => {
    const app = fixture({ accounts: [{ ...account, role: 'admin' }] });
    assert.equal((await app.login({ audience: 'admin' })).statusCode, 409);
    const response = await app.login({ audience: 'admin', existingPassword: 'correct-password' });
    assert.equal(response.body.data.user.role, 'admin');
    assert.equal((await app.login({ audience: 'tenant' })).statusCode, 403);
});
