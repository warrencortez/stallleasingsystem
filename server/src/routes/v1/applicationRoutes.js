const express = require('express');
const router = express.Router();
const {
    getAllApplications,
    getApplication,
    createApplication,
    reviewApplication,
    getApplicationStats,
    deleteApplication
} = require('../../controllers/applicationController');
const { authenticate, authorize } = require('../../middleware/auth');

// ==================================================
// ALL ROUTES REQUIRE AUTHENTICATION
// ==================================================

// Get application statistics (Admin/Staff only)
router.get('/stats', authenticate, authorize('admin', 'staff'), getApplicationStats);

// Get all applications (Admin/Staff only)
router.get('/', authenticate, authorize('admin', 'staff'), getAllApplications);

// Get a single application (Admin/Staff only)
router.get('/:id', authenticate, authorize('admin', 'staff'), getApplication);

// Create a new application (Anyone can apply)
router.post('/', authenticate, createApplication);

// Review application (Admin/Staff only)
router.patch('/:id/review', authenticate, authorize('admin', 'staff'), reviewApplication);

// Delete an application (Admin only)
router.delete('/:id', authenticate, authorize('admin'), deleteApplication);

module.exports = router;