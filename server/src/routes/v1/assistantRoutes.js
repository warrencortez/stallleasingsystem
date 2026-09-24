const express = require('express');
const { authenticate } = require('../../middleware/auth');
const { createSystemAssistant } = require('../../services/systemAssistant');
const router = express.Router();
const answer = createSystemAssistant(Object.fromEntries(['Stall', 'Tenant', 'Payment', 'Maintenance', 'Application', 'Announcement'].map(name => [name, require(`../../models/${name}`)])));
router.post('/', authenticate, async (req, res) => {
    const message = req.body?.message;
    if (typeof message !== 'string' || !message.trim() || message.length > 500) {
        return res.status(400).json({ success: false, message: 'Please enter a question between 1 and 500 characters.' });
    }
    if (!['admin', 'staff', 'tenant'].includes(req.userRole)) return res.status(403).json({ success: false, message: 'This account cannot use the assistant.' });
    try {
        res.json({ success: true, data: await answer(message.trim(), req.user) });
    } catch (error) {
        console.error('System assistant lookup failed:', error.message);
        res.status(503).json({ success: false, message: 'I could not check the system records right now. Please try again shortly.' });
    }
});
module.exports = router;
