const { randomUUID } = require('node:crypto');
const bcrypt = require('bcryptjs');
const Joi = require('joi');
const profileSchema = Joi.object({
    name: Joi.string().trim().min(2).max(100).required(),
    phone: Joi.string().pattern(/^\+639\d{9}$/).required()
});
function fail(status, message, extra = {}) { throw Object.assign(new Error(message), { status, ...extra }); }
function profile(input) {
    const { value, error } = profileSchema.validate({ name: input?.name, phone: input?.phone });
    if (error) fail(400, 'Enter your full name and a valid Philippine mobile number (+639XXXXXXXXX).');
    return value;
}
function createRegistrationService({ pool, sendCode, verifyCode }) {
    const metadata = row => ({ challengeId: row.id, email: row.email, expiresAt: row.expires_at, resendAt: row.resend_at, serverNow: row.server_now });
    async function available(client, email, phone) {
        // Shared with Google creation, including phone uniqueness across concurrent requests.
        for (const key of ['email:' + email, 'phone:' + phone].sort()) await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [key]);
        const existing = await client.query('SELECT id FROM users WHERE LOWER(email)=$1 OR phone=$2', [email, phone]);
        if (existing.rowCount) fail(409, 'An account with this email or mobile number already exists. Please sign in.');
    }
    async function issue(client, row) {
        // Keep a row lock through delivery so concurrent resend/verify requests cannot race.
        await sendCode(row.email);
        const result = await client.query(`UPDATE registration_verifications SET attempts=0,
            expires_at=clock_timestamp()+INTERVAL '60 seconds', resend_at=clock_timestamp()+INTERVAL '60 seconds'
            WHERE id=$1 RETURNING *, clock_timestamp() AS server_now`, [row.id]);
        return metadata(result.rows[0]);
    }
    return {
        async start(input) {
            const contact = profile(input);
            const { value: email, error } = Joi.string().trim().lowercase().email({ tlds: { allow: false } }).max(254).required().validate(input.email);
            if (error) fail(400, 'Enter a valid email address.');
            if (typeof input.password !== 'string' || !/^[a-zA-Z0-9]{6,72}$/.test(input.password)) fail(400, 'Password must contain 6 to 72 letters or digits.');
            if (input.password !== input.confirmPassword) fail(400, 'Passwords do not match.');
            const passwordHash = await bcrypt.hash(input.password, 10);
            return pool.withTransaction(async client => {
                await available(client, email, contact.phone);
                const previous = (await client.query('SELECT *, clock_timestamp() AS server_now FROM registration_verifications WHERE email=$1 FOR UPDATE', [email])).rows[0];
                if (previous && new Date(previous.resend_at) > new Date(previous.server_now)) fail(429, 'Wait before requesting another code.', { retryAfter: Math.ceil((new Date(previous.resend_at)-new Date(previous.server_now))/1000) });
                // A new registration invalidates all earlier challenge IDs for this email.
                await client.query('DELETE FROM registration_verifications WHERE email=$1', [email]);
                const id = randomUUID();
                const row = (await client.query(`INSERT INTO registration_verifications
                    (id,email,name,phone,password_hash,expires_at,resend_at)
                    VALUES($1,$2,$3,$4,$5,NOW(),NOW()) RETURNING *`, [id,email,contact.name,contact.phone,passwordHash])).rows[0];
                return issue(client, row);
            });
        },
        async resend(id) {
            if (!Joi.string().uuid().required().validate(id).error) return pool.withTransaction(async client => {
                const row = (await client.query('SELECT *, clock_timestamp() AS server_now FROM registration_verifications WHERE id=$1 FOR UPDATE', [id])).rows[0];
                if (!row || new Date(row.server_now)-new Date(row.created_at)>86400000) fail(400, 'Registration expired. Please register again.');
                if (new Date(row.resend_at)>new Date(row.server_now)) fail(429, 'Wait before requesting another code.', { retryAfter: Math.ceil((new Date(row.resend_at)-new Date(row.server_now))/1000) });
                return issue(client, row);
            });
            fail(400, 'Invalid verification request.');
        },
        async verify(id, code) {
            if (Joi.string().uuid().required().validate(id).error || typeof code !== 'string' || !/^\d{6}$/.test(code)) fail(400, 'Enter the six-digit code from your email.');
            const result = await pool.withTransaction(async client => {
                const candidate = (await client.query('SELECT * FROM registration_verifications WHERE id=$1', [id])).rows[0];
                if (!candidate) return { error: 'This code is no longer available. Please register again.' };
                await available(client,candidate.email,candidate.phone);
                const row = (await client.query('SELECT *, clock_timestamp() AS server_now FROM registration_verifications WHERE id=$1 FOR UPDATE', [id])).rows[0];
                if (!row) return { error: 'This code is no longer available. Please register again.' };
                if (new Date(row.expires_at)<=new Date(row.server_now)) return { error: 'Code expired. Request a new code.' };
                if (row.attempts>=5) return { error: 'Too many incorrect codes. Request a new code.' };
                const identity = await verifyCode(row.email,code);
                if (!identity) {
                    await client.query('UPDATE registration_verifications SET attempts=attempts+1 WHERE id=$1', [id]);
                    return { error: 'Incorrect code. Check your email and try again.' };
                }
                const stillValid = (await client.query('SELECT expires_at > clock_timestamp() AS valid FROM registration_verifications WHERE id=$1', [id])).rows[0]?.valid;
                if (!stillValid) return { error: 'Code expired. Request a new code.' };
                await client.query(`INSERT INTO users(name,email,phone,password,role,supabase_user_id) VALUES($1,$2,$3,$4,'tenant',$5)`, [row.name,row.email,row.phone,row.password_hash,identity.id]);
                // Creation and consumption commit together: replay can never create a second account.
                await client.query('DELETE FROM registration_verifications WHERE id=$1', [id]);
                return { verified: true };
            });
            if (result.error) fail(400,result.error);
            return result;
        }
    };
}
module.exports = { createRegistrationService, profile };
