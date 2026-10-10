const fs = require('node:fs');
const path = require('node:path');
const { pool } = require('../src/config/database');
(async () => {
    const client = await pool.connect();
    try {
        await client.query(fs.readFileSync(path.join(__dirname, '../migrations/20261002_recurring_billing.sql'), 'utf8').replace(/^\uFEFF/, ''));
        console.log('Recurring billing schema is ready.');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
})().then(() => process.exit(0)).catch(error => { console.error(error.message); process.exit(1); });
