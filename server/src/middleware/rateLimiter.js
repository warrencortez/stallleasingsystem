/**
 * OWASP A07: Authentication & Identification Failure Protection
 * In-Memory Sliding Window Rate Limiter for sensitive endpoints (/auth/login, /auth/register)
 */

const loginAttempts = new Map();
const MAX_ATTEMPTS = 15; // 15 attempts
const WINDOW_MS = 15 * 60 * 1000; // per 15 minutes

const authRateLimiter = (req, res, next) => {
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
