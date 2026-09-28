const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
function database(env = {}) {
    const calls = [];
    const client = { query: async sql => { calls.push(sql); if (sql.includes('broken')) throw new Error('SQL constraint failure'); return { rows: [], rowCount: 0 }; }, release() { calls.push('release'); } };
    class Pool { async connect() { return client; } async query(sql) { return client.query(sql); } }
    const dependencies = { pg: { Pool }, dotenv: { config() {} }, bcryptjs: { hashSync: () => 'hash' }, crypto: require('node:crypto'), 'node:async_hooks': require('node:async_hooks') };
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/config/database.js'), 'utf8'), {
        module, exports: module.exports, require: name => dependencies[name], process: { env }, structuredClone,
        console: { log() {}, warn() {} }
    });
    return { ...module.exports, calls };
}
test('database unavailability cannot silently become an in-memory write', async () => {
    const db = database();
    await assert.rejects(db.pool.query('INSERT INTO users VALUES ($1)', ['record']), /Database unavailable/);
});
test('production ignores DEMO_MODE and requires a persistent database', async () => {
    const db = database({ NODE_ENV: 'production', DEMO_MODE: 'true' });
    await assert.rejects(db.pool.query('SELECT * FROM users'), /Database unavailable/);
});
test('live SQL errors propagate, and transaction model writes use the same connection and roll back', async () => {
    const db = database();
    assert.equal(await db.testConnection(), true);
    await assert.rejects(db.pool.query('broken query'), /SQL constraint/);
    db.calls.length = 0;
    await assert.rejects(db.pool.withTransaction(async () => { await db.pool.query('first write'); await db.pool.query('broken write'); }), /SQL constraint/);
    assert.deepEqual(db.calls, ['BEGIN', 'first write', 'broken write', 'ROLLBACK', 'release']);
});

test('missing or default JWT secrets cannot silently enable predictable sessions', () => {
    const source = fs.readFileSync(path.join(__dirname, '../src/config/jwt.js'), 'utf8');
    for (const env of [{}, { JWT_SECRET: 'your-super-secret-key-change-this' }, { NODE_ENV: 'production', DEMO_MODE: 'true' }]) {
        assert.throws(() => vm.runInNewContext(source, { require: () => ({}), module: { exports: {} }, process: { env } }), /Configure a private JWT_SECRET/);
    }
});
