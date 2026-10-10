// Run locally by an authorized administrator; never expose this as a public route.
const crypto = require('node:crypto');
const {pool,testConnection} = require('../src/config/database');
const User = require('../src/models/User');
(async () => {
    if (process.env.DEMO_MODE === 'true') throw new Error('Administrator provisioning requires the real database.');
    const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Set ADMIN_EMAIL to the administrator email.');
    if (!await testConnection()) throw new Error('Database unavailable.');
    const password = process.env.ADMIN_PASSWORD || crypto.randomBytes(18).toString('base64url');
    if (password.length < 16) throw new Error('Use a password of at least 16 characters.');
    let action;
    await pool.withTransaction(async client => {
        const existing = (await client.query('SELECT id,role FROM users WHERE LOWER(email)=LOWER($1) FOR UPDATE',[email])).rows[0];
        if (existing) {
            if (existing.role !== 'admin') throw new Error('This email belongs to a non-admin account. No changes made.');
            if (!process.argv.includes('--reset-password')) throw new Error('Admin already exists. Use --reset-password only for an authorized reset.');
            await User.updatePassword(existing.id,password);
            action='Updated existing database administrator password';
        } else {
            await User.create({name:process.env.ADMIN_NAME || 'HOA Administrator',email,password,role:'admin'});
            action='Created database administrator';
        }
    });
    console.log(JSON.stringify({action,email,password}));
})().then(()=>process.exit(0)).catch(error=>{console.error(error.message);process.exit(1);});
