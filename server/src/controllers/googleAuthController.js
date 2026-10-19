const { profile: validateProfile } = require('../services/registrationVerification');
const { randomBytes } = require('node:crypto');
const { pool } = require('../config/database');
const supabase = require('../config/supabase');
const User = require('../models/User');
const { generateToken } = require('../config/jwt');
function fail(status, message, code) { throw Object.assign(new Error(message), { status, code }); }
async function googleLogin(req, res) {
    res.set('Cache-Control', 'no-store');
    try {
        const { accessToken, audience = 'tenant', existingPassword, existingIdentifier, profile } = req.body;
        if (typeof accessToken !== 'string' || accessToken.length > 16384 || !['tenant', 'admin'].includes(audience)) fail(400, 'Invalid Google sign-in request.');
        if (existingIdentifier !== undefined && (typeof existingIdentifier !== 'string' || !existingIdentifier.trim() || existingIdentifier.length > 254)) fail(400, 'Enter your existing mobile number or email.');
        // Verify against this project's Auth server, never a client-supplied email or role.
        const { data, error } = await supabase.auth().auth.getUser(accessToken);
        const identity = data?.user;
        const google = identity?.identities?.find(item => item.provider === 'google');
        if (error || !identity?.id || !identity.email_confirmed_at || !google ||
            google.identity_data?.email_verified !== true || !identity.email ||
            google.identity_data.email?.toLowerCase() !== identity.email.toLowerCase()) {
            fail(401, 'Google sign-in could not be verified. Please try again.');
        }
        const email = identity.email.toLowerCase().trim();
        const user = await pool.withTransaction(async client => {
            await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`google:${email}`]);
            let account = (await client.query('SELECT * FROM users WHERE supabase_user_id=$1 FOR UPDATE', [identity.id])).rows[0];
            if (existingIdentifier) {
                const target = (await client.query('SELECT * FROM users WHERE LOWER(email)=LOWER($1) OR phone=$1 FOR UPDATE', [existingIdentifier.trim()])).rows[0];
                if (!target || !await User.comparePassword(existingPassword, target.password)) fail(401, 'The existing account credentials are incorrect.');
                if (account && account.id !== target.id) fail(409, 'This Google identity is already connected to another account.');
                if (!account) account = target;
                if (account.supabase_user_id && account.supabase_user_id !== identity.id) fail(409, 'This account is connected to another Google identity.');
                if (!account.is_active || account.role !== audience) fail(403, 'This account cannot access this portal.');
                await client.query('UPDATE users SET supabase_user_id=$1, updated_at=NOW() WHERE id=$2', [identity.id, account.id]);
            }
            if (!account) {
                account = (await client.query('SELECT * FROM users WHERE LOWER(email)=$1 FOR UPDATE', [email])).rows[0];
                if (account) {
                    if (!account.is_active || account.role !== audience) fail(403, 'This account cannot access this portal.');
                    if (account.supabase_user_id) fail(409, 'This account is connected to a different Google identity.');
                    if (!existingPassword) fail(409, 'Enter your existing account password to connect Google securely.', 'GOOGLE_LINK_REQUIRED');
                    if (!await User.comparePassword(existingPassword, account.password)) fail(401, 'The existing account password is incorrect.');
                    await client.query('UPDATE users SET supabase_user_id=$1, updated_at=NOW() WHERE id=$2', [identity.id, account.id]);
                } else {
                    if (audience === 'admin') fail(403, 'An existing administrator account is required.');
                    if (!profile) return { profileRequired: true, email, name: String(google.identity_data.full_name || '').slice(0,100) };
                    const contact = validateProfile(profile);
                    for (const key of ['email:' + email, 'phone:' + contact.phone].sort()) await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [key]);
                    if ((await client.query('SELECT id FROM users WHERE phone=$1', [contact.phone])).rows.length) fail(409, 'This mobile number is already registered. Sign in to that account to connect Google.');
                    const id = await User.create({ ...contact,
                        email, password: randomBytes(36).toString('hex'), role: 'tenant' });
                    await client.query('UPDATE users SET supabase_user_id=$1 WHERE id=$2', [identity.id, id]);
                    account = await User.findById(id);
                }
            }
            if (!account.is_active || account.role !== audience) fail(403, 'This account cannot access this portal.');
            return User.toPublic(account);
        });
        if (user.profileRequired) return res.json({ success: true, data: user });
        return res.json({ success: true, data: { user, token: generateToken(user.id, user.role) } });
    } catch (error) {
        if (!error.status) console.error('[Google sign-in]', error.code || error.name);
        return res.status(error.status || 503).json({ success: false, code: error.status ? error.code : undefined,
            message: error.status ? error.message : 'Google sign-in is temporarily unavailable.' });
    }
}
module.exports = { googleLogin };
