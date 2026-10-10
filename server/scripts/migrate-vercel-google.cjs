const fs = require('node:fs');
const path = require('node:path');
const { pool } = require('../src/config/database');
(async () => {
    const client = await pool.connect();
    try {
        await client.query(fs.readFileSync(path.join(__dirname, '../migrations/20261010_vercel_google.sql'), 'utf8'));
        console.log('Google identity, support storage, rate limit and scheduler tables are ready.');
        const file = process.env.SUPPORT_CHAT_FILE || path.join(__dirname, '../data/support-chat.json');
        if (fs.existsSync(file)) {
            const state = JSON.parse(fs.readFileSync(file, 'utf8'));
            if (state.version !== 1 || !state.threads || Array.isArray(state.threads)) throw new Error('Invalid existing support store.');
            if (Object.keys(state.threads).length) {
                const imported = await client.query(`UPDATE support_conversation_store SET state=$1
                    WHERE id=1 AND state->'threads'='{}'::jsonb RETURNING id`, [JSON.stringify(state)]);
                console.log(imported.rowCount ? 'Existing support conversations imported.' : 'Database already has conversations; local file retained without overwriting.');
            }
        }
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
})().then(() => process.exit(0)).catch(error => { console.error(error.message); process.exit(1); });
