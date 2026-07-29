const express = require('express');
const router = express.Router();
const { 
    register, 
    login, 
    getCurrentUser, 
    logout,
    updateProfile,
    changePassword
} = require('../../controllers/authController');
const { authenticate } = require('../../middleware/auth');

// ==================================================
// PUBLIC ROUTES (No authentication needed)
// ==================================================

// Register a new user
router.post('/register', register);

// Login user
router.post('/login', login);

// ==================================================
// PROTECTED ROUTES (Need authentication)
// ==================================================

// Get current user's profile
router.get('/me', authenticate, getCurrentUser);

// Logout user
router.post('/logout', authenticate, logout);

// Update profile
router.put('/profile', authenticate, updateProfile);

// Change password
router.put('/change-password', authenticate, changePassword);

module.exports = router;