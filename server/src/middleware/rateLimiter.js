/**
 * OWASP A07: Authentication & Identification Failure Protection
 * In-Memory Sliding Window Rate Limiter for sensitive endpoints (/auth/login, /auth/register)
 */

const loginAttempts = new Map();
const MAX_ATTEMPTS = 15; // 15 attempts
const WINDOW_MS = 15 * 60 * 1000; // per 15 minutes

const authRateLimiter = async (req, res, next) => {
    if ((process.env.VERCEL || process.env.NETLIFY) || process.env.AUTH_RATE_LIMIT_STORE === 'postgres') {
        try {
            const { pool } = require('../config/database');
            const key = require('node:crypto').createHash('sha256').update(req.ip || 'unknown').digest('hex');
            const result = await pool.query(`INSERT INTO auth_rate_limits(key,attempts,expires_at)
                VALUES($1,1,NOW()+INTERVAL '15 minutes') ON CONFLICT(key) DO UPDATE SET
                attempts=CASE WHEN auth_rate_limits.expires_at<NOW() THEN 1 ELSE auth_rate_limits.attempts+1 END,
                expires_at=CASE WHEN auth_rate_limits.expires_at<NOW() THEN NOW()+INTERVAL '15 minutes' ELSE auth_rate_limits.expires_at END
                RETURNING attempts,expires_at`, [key]);
            if (result.rows[0].attempts > MAX_ATTEMPTS) {
                res.set('Retry-After', '900');
                return res.status(429).json({ success: false, message: 'Too many authentication attempts. Please try again in 15 minutes.' });
            }
            return next();
        } catch { return res.status(503).json({ success: false, message: 'Sign-in is temporarily unavailable.' }); }
    }
    const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown-ip';
    const now = Date.now();

    if (!loginAttempts.has(clientIp)) {
        loginAttempts.set(clientIp, []);
    }

    const timestamps = loginAttempts.get(clientIp);
    // Remove expired attempts older than WINDOW_MS
    const validTimestamps = timestamps.filter((t) => now - t < WINDOW_MS);
    loginAttempts.set(clientIp, validTimestamps);

    if (validTimestamps.length >= MAX_ATTEMPTS) {
        const retryAfterSeconds = Math.ceil((WINDOW_MS - (now - validTimestamps[0])) / 1000);
        return res.status(429).json({
            success: false,
            error_code: 'ERR_RATE_LIMIT_EXCEEDED',
            message: `Too many authentication attempts. Please try again in ${Math.ceil(retryAfterSeconds / 60)} minute(s).`,
            retry_after_seconds: retryAfterSeconds
        });
    }

    // Add current attempt
    validTimestamps.push(now);
    loginAttempts.set(clientIp, validTimestamps);
    next();
};

module.exports = {
    authRateLimiter
};
