const express = require('express');
const path = require('node:path');
const { authenticate } = require('../../middleware/auth');
const { SupportStore } = require('../../services/supportStore');
const { createSupportService } = require('../../services/supportService');
const { createSystemAssistant } = require('../../services/systemAssistant');
const User = require('../../models/User');
const Notification = require('../../models/Notification');
const models = Object.fromEntries(['Stall', 'Tenant', 'Payment', 'Maintenance', 'Application', 'Announcement'].map(name => [name, require(`../../models/${name}`)]));
const service = createSupportService({
    store: new SupportStore(process.env.SUPPORT_CHAT_FILE || path.join(__dirname, '../../../data/support-chat.json')),
    User, notify: data => Notification.create(data), answer: createSystemAssistant(models),
});
const router = express.Router();
router.use(authenticate);
const route = fn => async (req, res) => {
    try { res.json({ success: true, data: await fn(req) }); }
    catch (error) {
        if (!error.status) console.error('Support conversation error:', error.message);
        res.status(error.status || 503).json({ success: false, message: error.status ? error.message : 'Chat is temporarily unavailable. Your message was not confirmed. Please retry.' });
    }
};
router.get('/inbox', route(req => service.inbox(req.user)));
router.get('/thread', route(req => service.get(req.user, req.userId, req.query.read === 'true')));
router.post('/request-agent', route(req => service.requestAgent(req.user)));
router.post('/messages', route(req => service.send(req.user, req.userId, req.body?.message, req.body?.client_id)));
router.post('/resume', route(req => service.resume(req.user, req.userId)));
router.get('/threads/:tenantId', route(req => service.get(req.user, req.params.tenantId, req.query.read === 'true')));
router.post('/threads/:tenantId/claim', route(req => service.claim(req.user, req.params.tenantId)));
router.post('/threads/:tenantId/resume', route(req => service.resume(req.user, req.params.tenantId)));
router.post('/threads/:tenantId/messages', route(req => service.send(req.user, req.params.tenantId, req.body?.message, req.body?.client_id)));
module.exports = router;
