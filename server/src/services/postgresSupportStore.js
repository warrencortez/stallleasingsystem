const { pool } = require('../config/database');
class PostgresSupportStore {
    async snapshot() {
        const result = await pool.query('SELECT state FROM support_conversation_store WHERE id=1');
        if (!result.rows[0]) throw new Error('Run the Vercel/Google migration before using support.');
        return structuredClone(result.rows[0].state);
    }
    async mutate(fn) {
        return pool.withTransaction(async client => {
            const result = await client.query('SELECT state FROM support_conversation_store WHERE id=1 FOR UPDATE');
            if (!result.rows[0]) throw new Error('Support storage is not initialized.');
            const draft = result.rows[0].state;
            const value = await fn(draft);
            await client.query('UPDATE support_conversation_store SET state=$1 WHERE id=1', [JSON.stringify(draft)]);
            return structuredClone(value);
        });
    }
}
module.exports = { PostgresSupportStore };
