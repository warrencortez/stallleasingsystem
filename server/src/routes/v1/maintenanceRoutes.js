const express = require('express');
const router = express.Router();
const maintenanceController = require('../../controllers/maintenanceController');
const { authenticate, authorize } = require('../../middleware/auth');
const upload = require('../../middleware/upload');

// Protect all maintenance routes
router.use(authenticate);

// Get stats (admin/staff)
router.get('/stats', authorize('admin', 'staff'), maintenanceController.getStats);

// List & Get
router.get('/', maintenanceController.getAllRequests);
router.get('/:id', maintenanceController.getRequestById);

// Submit new request (supports photo upload)
router.post('/', upload.single('photo'), maintenanceController.createRequest);

// Update status / technician assignment (admin/staff)
router.patch('/:id/status', authorize('admin', 'staff'), maintenanceController.updateStatus);

// Delete request (admin only)
router.delete('/:id', authorize('admin'), maintenanceController.deleteRequest);

module.exports = router;
