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
const { authRateLimiter } = require('../../middleware/rateLimiter');

// ==================================================
// PUBLIC ROUTES (No authentication needed - Rate Limited)
// ==================================================

// Register a new user
router.post('/register', authRateLimiter, register);

// Login user
router.post('/login', authRateLimiter, login);

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