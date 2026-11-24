const { randomBytes, randomUUID, createHash } = require('node:crypto');
const Joi = require('joi');
const bcrypt = require('bcryptjs');

const emailSchema = Joi.string().trim().lowercase().email({ tlds: { allow: false } }).max(254).required();
const idSchema = Joi.string().uuid().required();
const hashGrant = value => createHash('sha256').update(value).digest('hex');
const invalidGrant = 'This reset authorization is invalid or expired. Start again.';
function fail(status, message, retryAfter) { throw Object.assign(new Error(message), { status, retryAfter }); }

function createPasswordRecovery({ pool, sendRecoveryCode, verifyRecoveryCode }) {
    const metadata = row => ({ challengeId: row.id, serverNow: row.server_now, expiresAt: row.expires_at, resendAt: row.resend_at });
    const load = async (db, id) => (await db.query(`SELECT *, clock_timestamp() AS server_now
        FROM password_recoveries WHERE id=$1 FOR UPDATE`, [id])).rows[0];
    async function issue(db, email, challengeId) {
        const accounts = await db.query('SELECT id, auth_version, role, is_active FROM users WHERE lower(email)=$1 LIMIT 2', [email]);
        const account = accounts.rows.length === 1 && accounts.rows[0].role === 'tenant' && accounts.rows[0].is_active &&
            !email.endsWith('@tenant.stalllease.com') ? accounts.rows[0] : null;
        const { rows: [{ requested_at: requestedAt }] } = await db.query('SELECT clock_timestamp() AS requested_at');
        let delivered = false;
        if (account) {
            try { delivered = await sendRecoveryCode(email); }
            catch { /* Account eligibility and delivery errors share the public response. */ }
        }
        const { rows: [row] } = await db.query(`INSERT INTO password_recoveries
            (id,email,user_id,auth_version,expires_at,resend_at,created_at)
            VALUES($1,$2,$3,$4,$5::timestamptz+INTERVAL '5 minutes',$5::timestamptz+INTERVAL '60 seconds',$5)
            ON CONFLICT(email) DO UPDATE SET id=EXCLUDED.id,user_id=EXCLUDED.user_id,auth_version=EXCLUDED.auth_version,
            expires_at=EXCLUDED.expires_at,resend_at=EXCLUDED.resend_at,created_at=EXCLUDED.created_at,
            attempts=0,verified_identity=NULL,grant_hash=NULL,grant_expires_at=NULL
            RETURNING *, clock_timestamp() AS server_now`, [challengeId, email, delivered ? account.id : null, delivered ? account.auth_version : null, requestedAt]);
        return metadata(row);
    }
    return {
        async start(input) {
            const { value: email, error } = emailSchema.validate(input);
            if (error) fail(400, 'Enter a valid email address.');
            return pool.withTransaction(async db => {
                await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`password-recovery:${email}`]);
                const { rows: [row] } = await db.query(`SELECT *, clock_timestamp() AS server_now
                    FROM password_recoveries WHERE email=$1 FOR UPDATE`, [email]);
                if (row?.grant_hash && row.grant_expires_at > row.server_now) {
                    const now = row.server_now.getTime();
                    return { challengeId: randomUUID(), serverNow: row.server_now, expiresAt: new Date(now + 300000), resendAt: new Date(now + 60000) };
                }
                if (row && row.resend_at > row.server_now) return metadata(row);
                return issue(db, email, randomUUID());
            });
        },
        async resend(id) {
            if (idSchema.validate(id).error) fail(400, 'Start a new password reset request.');
            return pool.withTransaction(async db => {
                const row = await load(db, id);
                if (!row || row.grant_hash || row.server_now - row.created_at > 86400000) fail(400, 'Start a new password reset request.');
                if (row.resend_at > row.server_now) fail(429, 'Wait before requesting another code.', Math.ceil((row.resend_at - row.server_now) / 1000));
                return issue(db, row.email, randomUUID());
            });
        },
        async verify(id, code) {
            if (idSchema.validate(id).error || typeof code !== 'string' || !/^\d{6}$/.test(code)) fail(400, 'Enter a six-digit code.');
            const outcome = await pool.withTransaction(async db => {
                const row = await load(db, id);
                if (!row || row.grant_hash || row.expires_at <= row.server_now) return { message: 'This code has expired. Request a new code.' };
                if (row.attempts >= 5) return { message: 'Too many incorrect attempts. Request a new code.' };
                const invalidCode = { message: 'That code is incorrect or expired. Check the latest email or request another code.' };
                let identity;
                try { identity = row.user_id && await verifyRecoveryCode(row.email, code); }
                catch { return invalidCode; }
                const account = identity && (await db.query(`SELECT id FROM users WHERE id=$1 AND lower(email)=$2 AND role='tenant'
                    AND is_active AND auth_version=$3 AND (supabase_user_id IS NULL OR supabase_user_id=$4)`,
                [row.user_id, row.email, row.auth_version, identity])).rows[0];
                if (!account) {
                    await db.query('UPDATE password_recoveries SET attempts=attempts+1 WHERE id=$1', [id]);
                    return invalidCode;
                }
                const resetToken = randomBytes(32).toString('base64url');
                const issued = await db.query(`UPDATE password_recoveries SET grant_hash=$2, verified_identity=$3,
                    grant_expires_at=clock_timestamp()+INTERVAL '5 minutes' WHERE id=$1 AND expires_at > clock_timestamp()`,
                [id, hashGrant(resetToken), identity]);
                return issued.rowCount ? { resetToken } : { message: 'This code has expired. Request a new code.' };
            });
            if (outcome.message) fail(400, outcome.message);
            return outcome;
        },
        async reset({ challengeId, resetToken, password, confirmPassword }) {
            if (idSchema.validate(challengeId).error || typeof resetToken !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(resetToken)) fail(400, invalidGrant);
            if (typeof password !== 'string' || !/^[a-zA-Z0-9]{6,72}$/.test(password)) fail(400, 'Use 6 to 72 letters or digits for your password.');
            if (password !== confirmPassword) fail(400, 'Passwords do not match.');
            return pool.withTransaction(async db => {
                const row = await load(db, challengeId);
                if (!row || row.grant_hash !== hashGrant(resetToken) || row.grant_expires_at <= row.server_now) fail(400, invalidGrant);
                const account = (await db.query(`SELECT password FROM users WHERE id=$1 AND lower(email)=$2 AND role='tenant' AND is_active
                    AND auth_version=$3 AND (supabase_user_id IS NULL OR supabase_user_id=$4) FOR UPDATE`,
                [row.user_id, row.email, row.auth_version, row.verified_identity])).rows[0];
                if (!account) fail(400, invalidGrant);
                if (await bcrypt.compare(password, account.password || '')) fail(400, 'Choose a password different from your previous password.');
                const passwordHash = await bcrypt.hash(password, 10);
                const consumed = await db.query(`DELETE FROM password_recoveries WHERE id=$1 AND grant_expires_at > clock_timestamp()`, [challengeId]);
                if (!consumed.rowCount) fail(400, invalidGrant);
                await db.query('UPDATE users SET password=$1, auth_version=auth_version+1, updated_at=NOW() WHERE id=$2', [passwordHash, row.user_id]);
                return { reset: true };
            });
        }
    };
}

module.exports = { createPasswordRecovery };
