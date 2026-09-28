const express = require('express');
const router = express.Router();
const {
    getAllStalls,
    getStall,
    getStallDetails,
    createStall,
    updateStall,
    updateStallStatus,
    deleteStall,
    getStallStats,
    getStallQRCode
} = require('../../controllers/stallController');
const { authenticate, authorize } = require('../../middleware/auth');

// ==================================================
// ALL ROUTES REQUIRE AUTHENTICATION
// ==================================================

// Get stall statistics (Admin only)
router.get('/stats', authenticate, authorize('admin', 'staff'), getStallStats);

// Get stall QR code payload
router.get('/:id/qrcode', authenticate, getStallQRCode);

// Get comprehensive stall details and history
router.get('/:id/details', authenticate, authorize('admin', 'staff'), getStallDetails);

// Get all stalls
router.get('/', authenticate, getAllStalls);

// Get a single stall
router.get('/:id', authenticate, getStall);

// Create a new stall (Admin only)
router.post('/', authenticate, authorize('admin', 'staff'), createStall);

// Update a stall (Admin only)
router.put('/:id', authenticate, authorize('admin', 'staff'), updateStall);

// Update stall status (Admin only)
router.patch('/:id/status', authenticate, authorize('admin', 'staff'), updateStallStatus);

// Delete a stall (Admin only)
router.delete('/:id', authenticate, authorize('admin'), deleteStall);

module.exports = router;