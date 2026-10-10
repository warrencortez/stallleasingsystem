const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const express = require('express');

test('Vercel import exports an idle app, lazily initializes DB and preserves webhook bytes', async () => {
    let connections = 0;
    const routes = express.Router();
    routes.get('/', (req, res) => res.json({ success: true }));
    const mocks = {
        express, cors: require('cors'), helmet: require('helmet'), morgan: () => (req, res, next) => next(),
        dotenv: { config() {} }, path,
        './src/config/database': { testConnection: async () => { connections++; return true; } },
        './src/routes': routes,
        './src/services/scheduledJobs': { handle: (req, res) => res.sendStatus(401) },
        './src/services/paymentSettlement': { webhook: (req, res) => res.json({ raw: Buffer.isBuffer(req.body), text: req.body.toString('utf8') }) }
    };
    const module = { exports: {} };
    const requireMock = name => { if (!(name in mocks)) throw new Error(`Unexpected import ${name}`); return mocks[name]; };
    requireMock.main = module;
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8'), {
        module, exports: module.exports, require: requireMock, process: { env: { VERCEL: '1', NODE_ENV: 'production' } },
        __dirname: path.resolve(__dirname, '..'), console,
        setInterval() { throw new Error('Vercel must not start timers'); }
    });
    assert.equal(connections, 0);
    const server = module.exports.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    try {
        const base = `http://127.0.0.1:${server.address().port}`;
        assert.equal((await fetch(base + '/health')).status, 200);
        assert.equal(connections, 0);
        const raw = '{ "data": {"exact":"bytes"} }';
        const response = await fetch(base + '/api/v1/payments/paymongo-webhook', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: raw });
        assert.deepEqual(await response.json(), { raw: true, text: raw });
        assert.equal((await fetch(base + '/api/v1')).status, 200);
        assert.equal(connections, 1);
        assert.equal((await fetch(base + '/api/cron/maintenance')).status, 401);
    } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
