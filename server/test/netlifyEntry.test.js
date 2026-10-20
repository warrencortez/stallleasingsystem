const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const express = require('express');

test('Netlify adapter routes API requests and preserves signed webhook bytes', async () => {
    let connections = 0;
    const routes = express.Router();
    routes.get('/', (req, res) => res.json({ success: true }));
    const mocks = {
        express, cors: require('cors'), helmet: require('helmet'), morgan: () => (req, res, next) => next(),
        dotenv: { config() {} }, path,
        './src/config/database': { testConnection: async () => { connections++; return true; } },
        './src/routes': routes,
        './src/services/scheduledJobs': { handle: (req, res) => res.sendStatus(401) },
        './src/services/paymentSettlement': { webhook: (req, res) => {
            assert.ok(Buffer.isBuffer(req.body));
            const signature = crypto.createHmac('sha256', 'test-only').update(req.body).digest('hex');
            res.sendStatus(signature === req.get('Paymongo-Signature') ? 200 : 400);
        } }
    };
    const appModule = { exports: {} };
    const env = { NODE_ENV: 'production' };
    const entryModule = { exports: {} };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../netlify/functions/api.js'), 'utf8'), {
        exports: entryModule.exports, process: { env }, require(name) {
            if (name === 'serverless-http') return require(name);
            assert.equal(name, '../../server');
            const mockRequire = name => { if (!(name in mocks)) throw new Error('Unexpected import ' + name); return mocks[name]; };
            mockRequire.main = appModule;
            vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8'), {
                module: appModule, exports: appModule.exports, require: mockRequire, process: { env },
                __dirname: path.resolve(__dirname, '..'), console,
                setInterval() { throw new Error('No background timers in functions'); }
            });
            return appModule.exports;
        }
    });
    assert.equal(env.NETLIFY, 'true');
    assert.equal(connections, 0);
    const invoke = (url, extra = {}) => entryModule.exports.handler({ path: url, httpMethod: 'GET', headers: {}, body: '', ...extra }, {});
    assert.equal((await invoke('/health')).statusCode, 200);
    assert.equal(connections, 0);
    assert.equal((await invoke('/api/v1')).statusCode, 200);
    assert.equal((await invoke('/payments/return')).statusCode, 200);
    assert.equal((await invoke('/api/cron/maintenance')).statusCode, 401);
    const raw = '{ "data": {"message":"PHP payment"} }';
    const signature = crypto.createHmac('sha256', 'test-only').update(raw).digest('hex');
    for (const encoded of [false, true]) {
        const event = { httpMethod: 'POST', headers: { 'content-type': 'application/json', 'Paymongo-Signature': signature },
            body: encoded ? Buffer.from(raw).toString('base64') : raw, isBase64Encoded: encoded };
        assert.equal((await invoke('/api/v1/payments/paymongo-webhook', event)).statusCode, 200);
        event.body = encoded ? Buffer.from(raw + ' ').toString('base64') : raw + ' ';
        assert.equal((await invoke('/api/v1/payments/paymongo-webhook', event)).statusCode, 400);
    }
    assert.equal(connections, 1);
});
