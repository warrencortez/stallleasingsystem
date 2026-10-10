const fs = require('node:fs/promises');
const path = require('node:path');
const { pool, testConnection } = require('../src/config/database');
const storage = require('../src/services/uploadStorage');
const types = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.pdf': 'application/pdf' };
(async () => {
    if (!await testConnection()) throw new Error('Connect to the deployment database first.');
    const root = path.resolve(__dirname, '../uploads');
    let count = 0;
    for (const [table, field, folder] of [['maintenance_requests', 'photo_url', 'maintenance'], ['payments', 'proof_image', 'payments']]) {
        const { rows } = await pool.query(`SELECT id, ${field} AS attachment FROM ${table} WHERE ${field} LIKE '/uploads/%'`);
        for (const row of rows) {
            const filename = path.resolve(root, row.attachment.slice('/uploads/'.length));
            const relative = path.relative(root, filename);
            if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Invalid legacy attachment path.');
            const mimetype = types[path.extname(filename).toLowerCase()];
            if (!mimetype) throw new Error('Unsupported legacy attachment type.');
            const buffer = await fs.readFile(filename);
            if (buffer.length > 3 * 1024 * 1024) throw new Error('A legacy attachment exceeds 3 MB; compress it before migration.');
            const reference = await storage.save({ buffer, mimetype, originalname: filename }, folder, 'legacy');
            const result = await pool.query(`UPDATE ${table} SET ${field}=$1 WHERE id=$2 AND ${field}=$3`, [reference, row.id, row.attachment]);
            count += result.rowCount;
        }
    }
    console.log(`Migrated ${count} attachment references. Original files were retained.`);
})().then(() => process.exit(0)).catch(error => { console.error(error.message); process.exit(1); });
