const { createRegistrationService } = require('../services/registrationVerification');
const service = createRegistrationService({ pool: require('../config/database').pool,
    ...require('../services/verificationEmail') });
const endpoint = fn => async (req,res) => {
    res.set('Cache-Control','no-store');
    try { return res.json({ success:true, data:await fn(req.body) }); }
    catch(error) {
        if (error.retryAfter) res.set('Retry-After',String(error.retryAfter));
        const conflict=error.code==='23505';
        if (!error.status && !conflict) console.error('[Registration]',error.code || error.name);
        return res.status(error.status || (conflict?409:503)).json({ success:false,
            retryAfter:error.retryAfter, message:error.status?error.message:conflict?'An account with this email or mobile number already exists.':'Registration is temporarily unavailable.' });
    }
};
module.exports = {
    register: endpoint(body=>service.start(body)),
    verify: endpoint(body=>service.verify(body.challengeId,body.code)),
    resend: endpoint(body=>service.resend(body.challengeId))
};
