const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const bcrypt = require('bcryptjs');
const { createPasswordRecovery } = require('../src/services/passwordRecovery');

function load(relative, mocks, env = {}) {
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src', relative), 'utf8'), {
        module, process: { env }, console: { warn() {}, error() {} }, require: name => mocks[name]
    });
    return module.exports;
}

test('existing password login issues the current session version and both middleware paths reject revoked sessions', async () => {
    const jwt = load('config/jwt.js', { jsonwebtoken: require('jsonwebtoken') }, { JWT_SECRET: 'disposable-local-fixture-signing-key' });
    const account = { id: randomUUID(), role: 'tenant', is_active: true, auth_version: 0, password: await bcrypt.hash('Before123', 4) };
    const User = {
        findByEmailOrPhone: async () => ({ ...account }), findForAuthentication: async () => ({ ...account }),
        comparePassword: bcrypt.compare, toPublic: ({ id, role }) => ({ id, role })
    };
    const mock = { '../config/jwt': jwt, '../models/User': User, './registrationController': {} };
    const { login } = load('controllers/authController.js', mock);
    const { authenticate, optionalAuth } = load('middleware/auth.js', mock);
    const response = () => ({ code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });
    const signIn = async password => {
        const res = response();
        await login({ body: { email: 'tenant@example.test', password } }, res);
        return res;
    };
    const oldToken = (await signIn('Before123')).body.data.token;
    account.auth_version = 1;
    account.password = await bcrypt.hash('After123', 4);
    assert.equal((await signIn('Before123')).code, 401);
    const token = (await signIn('After123')).body.data.token;
    const req = value => ({ headers: { authorization: `Bearer ${value}` } });
    const denied = response();
    await authenticate(req(oldToken), denied, () => assert.fail('Revoked token was accepted'));
    assert.equal(denied.code, 401);
    const guest = req(oldToken);
    await optionalAuth(guest, response(), () => assert.equal(guest.user, undefined));
    const authorized = req(token);
    await authenticate(authorized, response(), () => assert.equal(authorized.user.id, account.id));
    assert.equal(authorized.user.password, undefined);
});

test('recovery email uses the recovery template API and verifies only recovery OTPs', async () => {
    const template = fs.readFileSync(path.join(__dirname, '../templates/password-recovery.html'), 'utf8');
    assert.match(template, /\{\{ \.Token \}\}/);
    assert.doesNotMatch(template, /ConfirmationURL|<a\b/i);
    const calls = [];
    const identity = randomUUID();
    const email = 'tenant@example.test';
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/services/recoveryEmail.js'), 'utf8'), {
        module, process: { env: { SUPABASE_URL: 'https://example.test', SUPABASE_PUBLISHABLE_KEY: 'test-public' } },
        require: () => ({ createClient: (_url, _key, { auth }) => {
            assert.equal(auth.persistSession, false);
            return { auth: {
                resetPasswordForEmail: async address => { calls.push(['recover', address]); return {}; },
                verifyOtp: async args => { calls.push([args.type, args.token]); return { data: { user: { id: identity, email, email_confirmed_at: '2026-11-25' } } }; }
            } };
        } })
    });
    assert.equal(await module.exports.sendRecoveryCode(email), true);
    assert.equal(await module.exports.verifyRecoveryCode(email, '012345'), identity);
    assert.deepEqual(calls, [['recover', email], ['recovery', '012345']]);
});

test('password recovery transaction only changes the eligible tenant and consumes the grant', { skip: process.env.RUN_DB_AUTH_TESTS !== '1' }, async () => {
    require('dotenv').config({ quiet: true });
    const { Client } = require('pg');
    const db = new Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 5432), user: process.env.DB_USER,
        password: process.env.DB_PASSWORD, database: process.env.DB_NAME, ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
        connectionTimeoutMillis: 10000 });
    await db.connect();
    try {
        await db.query('BEGIN');
        await db.query(`CREATE TEMP TABLE users (id UUID PRIMARY KEY, email TEXT UNIQUE, role TEXT, is_active BOOLEAN,
            supabase_user_id UUID, password TEXT, updated_at TIMESTAMPTZ, auth_version INTEGER DEFAULT 0)`);
        const migration = fs.readFileSync(path.join(__dirname, '../migrations/20261125_password_recovery.sql'), 'utf8');
        await db.query(migration.slice(migration.indexOf('CREATE TABLE'), migration.indexOf('CREATE INDEX'))
            .replace('CREATE TABLE IF NOT EXISTS public.', 'CREATE TEMP TABLE ').replace('REFERENCES public.users', 'REFERENCES pg_temp.users'));
        const email = 'legacy@example.test', admin = 'admin@example.test', unknown = 'unknown@example.test';
        const id = randomUUID(), authId = randomUUID();
        const oldPassword = 'Previous2026', password = 'NewPassword2026';
        const hash = await bcrypt.hash(oldPassword, 4);
        await db.query("INSERT INTO users(id,email,role,is_active,password) VALUES($1,$2,'tenant',true,$3),($4,$5,'admin',true,$3)", [id, email, hash, randomUUID(), admin]);
        let sendCount = 0;
        const pool = { async withTransaction(fn) {
            await db.query('SAVEPOINT recovery_test');
            try { const value = await fn(db); await db.query('RELEASE SAVEPOINT recovery_test'); return value; }
            catch (err) { await db.query('ROLLBACK TO SAVEPOINT recovery_test'); await db.query('RELEASE SAVEPOINT recovery_test'); throw err; }
        } };
        const service = createPasswordRecovery({ pool, sendRecoveryCode: async () => ++sendCount > 0,
            verifyRecoveryCode: async (address, code) => address === email && code === '012345' ? authId : null });
        for (const address of [admin, unknown]) {
            const challenge = await service.start(address);
            assert.deepEqual(Object.keys(challenge), ['challengeId', 'serverNow', 'expiresAt', 'resendAt']);
            await assert.rejects(service.verify(challenge.challengeId, '012345'), /incorrect or expired/);
        }
        assert.equal(sendCount, 0);
        const first = await service.start(email);
        assert.equal(sendCount, 1);
        assert.ok(first.expiresAt - first.serverNow > 295000);
        await assert.rejects(service.resend(first.challengeId), { status: 429 });
        for (let i = 0; i < 5; i++) await assert.rejects(service.verify(first.challengeId, '999999'), /incorrect or expired/);
        await assert.rejects(service.verify(first.challengeId, '012345'), /Too many/);
        await db.query("UPDATE password_recoveries SET expires_at=NOW()-INTERVAL '1 minute',resend_at=NOW()-INTERVAL '1 minute' WHERE id=$1", [first.challengeId]);
        await assert.rejects(service.verify(first.challengeId, '012345'), /expired/);
        const second = await service.resend(first.challengeId);
        assert.equal(sendCount, 2);
        const { resetToken } = await service.verify(second.challengeId, '012345');
        const request = { challengeId: second.challengeId, resetToken, password, confirmPassword: password };
        await assert.rejects(service.reset({ ...request, resetToken: 'x'.repeat(43) }), /invalid or expired/);
        await assert.rejects(service.reset({ ...request, password: 'short', confirmPassword: 'short' }), /6 to 72/);
        await assert.rejects(service.reset({ ...request, confirmPassword: 'Different2026' }), /match/);
        await db.query("UPDATE password_recoveries SET grant_expires_at=clock_timestamp()-INTERVAL '1 second' WHERE id=$1", [second.challengeId]);
        await assert.rejects(service.reset(request), /invalid or expired/);
        await db.query("UPDATE password_recoveries SET grant_expires_at=clock_timestamp()+INTERVAL '1 minute' WHERE id=$1", [second.challengeId]);
        assert.deepEqual(await service.reset(request), { reset: true });
        await assert.rejects(service.reset(request), /invalid or expired/);
        const { rows: [tenant] } = await db.query('SELECT * FROM users WHERE id=$1', [id]);
        assert.equal(tenant.supabase_user_id, null);
        assert.equal(tenant.auth_version, 1);
        assert.equal(await bcrypt.compare(password, tenant.password), true);
        assert.equal(await bcrypt.compare(oldPassword, tenant.password), false);
        const { rows: [administrator] } = await db.query('SELECT * FROM users WHERE email=$1', [admin]);
        assert.equal(administrator.auth_version, 0);
        assert.equal(administrator.password, hash);
    } finally {
        await db.query('ROLLBACK');
        await db.end();
    }
});
