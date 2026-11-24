const { setTimeout: delay } = require('node:timers/promises');
const { createPasswordRecovery } = require('../services/passwordRecovery');
const recovery = createPasswordRecovery({ pool: require('../config/database').pool, ...require('../services/recoveryEmail') });

const endpoint = (operation, minimumMs = 0) => async (req, res) => {
    res.set('Cache-Control', 'no-store');
    // Provider contact depends on eligibility. Hold fast results to reduce timing differences.
    const minimum = delay(minimumMs);
    try {
        const data = await operation(req.body || {});
        await minimum;
        if (data.serverNow) data.serverNow = new Date();
        return res.json({ success: true, data });
    } catch (error) {
        await minimum;
        if (error.retryAfter) res.set('Retry-After', String(error.retryAfter));
        return res.status(error.status || 503).json({ success: false, retryAfter: error.retryAfter,
            message: error.status ? error.message : 'Password recovery is temporarily unavailable. Please try again.' });
    }
};

module.exports = {
    start: endpoint(body => recovery.start(body.email), 4500),
    resend: endpoint(body => recovery.resend(body.challengeId), 4500),
    verify: endpoint(body => recovery.verify(body.challengeId, body.code), 4500),
    reset: endpoint(body => recovery.reset(body))
};
