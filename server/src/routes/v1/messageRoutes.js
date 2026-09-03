const express = require('express');
const router = express.Router();
const messageController = require('../../controllers/messageController');
const { authenticate } = require('../../middleware/auth');

router.use(authenticate);

router.get('/conversations', messageController.getConversations);
router.get('/thread/:contactId', messageController.getThread);
router.post('/', messageController.sendMessage);

module.exports = router;
