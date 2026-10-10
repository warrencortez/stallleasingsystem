const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
function fixture(fail = false) {
    const calls = [], secret = 'a'.repeat(48);
    const mocks = {
        'node:crypto': require('node:crypto'),
        '../config/database': { pool: { query: async sql => calls.push(sql) } },
        './recurringBilling': { runDueBilling: async () => { calls.push('billing'); if (fail) throw new Error('Database unavailable'); return { count: 1, skipped: [] }; } },
        './paymentSettlement': { reconcile: async () => calls.push('payments') }
    };
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/services/scheduledJobs.js'), 'utf8'), {
        module, exports: module.exports, Buffer, console, process: { env: { CRON_SECRET: secret } }, require: key => mocks[key]
    });
    return { calls, async run(header = `Bearer ${secret}`) {
        const res = { statusCode: 200, set() {}, status(code) { this.statusCode = code; return this; }, sendStatus(code) { this.statusCode = code; }, json(body) { this.body = body; } };
        await module.exports.handle({ get: () => header }, res); return res;
    } };
}
test('cron endpoint rejects unauthenticated callers without doing work', async () => {
    const app = fixture();
    for (const value of ['', 'Bearer wrong', 'Bearer ' + 'b'.repeat(48)]) assert.equal((await app.run(value)).statusCode, 401);
    assert.equal(app.calls.length, 0);
});
test('cron waits for billing and reconciliation before recording success', async () => {
    const app = fixture();
    assert.equal((await app.run()).statusCode, 200);
    assert.equal(app.calls[0], 'billing'); assert.equal(app.calls[1], 'payments');
    assert.match(app.calls.at(-1), /INSERT INTO scheduled_job_runs/);
    const failure = fixture(true);
    assert.equal((await failure.run()).statusCode, 503);
    assert.equal(failure.calls.length, 1);
});
