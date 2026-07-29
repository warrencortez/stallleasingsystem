const jwt = require('jsonwebtoken');

// Get secret from environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-change-this';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '7d';

/**
 * Generate a JWT token for a user
 * @param {string} userId - The user's ID
 * @param {string} role - The user's role (admin, staff, tenant)
 * @returns {string} - JWT token
 */
const generateToken = (userId, role) => {
    return jwt.sign(
        { 
            id: userId,      // Store user ID in token
            role: role       // Store user role in token
        },
        JWT_SECRET,          // Our secret key
        { expiresIn: JWT_EXPIRY } // When token expires
    );
};

/**
 * Verify a JWT token
 * @param {string} token - The token to verify
 * @returns {object|null} - Decoded token data or null if invalid
 */
const verifyToken = (token) => {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null; // Token is invalid or expired
    }
};

/**
 * Decode a JWT token without verifying
 * @param {string} token - The token to decode
 * @returns {object|null} - Decoded token data
 */
const decodeToken = (token) => {
    try {
        return jwt.decode(token);
    } catch (error) {
        return null;
    }
};

module.exports = {
    JWT_SECRET,
    JWT_EXPIRY,
    generateToken,
    verifyToken,
    decodeToken
};