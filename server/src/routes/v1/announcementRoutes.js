const express = require('express');
const router = express.Router();
const announcementController = require('../../controllers/announcementController');
const { authenticate, authorize } = require('../../middleware/auth');

// Protect all routes
router.use(authenticate);

// List & Read
router.get('/', announcementController.getAllAnnouncements);
router.get('/:id', announcementController.getAnnouncementById);

// Create, Update, Delete (admin/staff only)
router.post('/', authorize('admin', 'staff'), announcementController.createAnnouncement);
router.put('/:id', authorize('admin', 'staff'), announcementController.updateAnnouncement);
router.delete('/:id', authorize('admin'), announcementController.deleteAnnouncement);

module.exports = router;
