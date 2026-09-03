const { verifyToken } = require('../config/jwt');
const User = require('../models/User');

/**
 * Authentication Middleware
 * Checks if the user has a valid JWT token
 */
const authenticate = async (req, res, next) => {
    try {
        // 1. Get the token from the Authorization header
        const authHeader = req.headers.authorization;
        
        // 2. Check if token exists
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Please login to access this resource.'
            });
        }

        // 3. Extract the token (remove "Bearer " prefix)
        const token = authHeader.split(' ')[1];
        
        // 4. Verify the token
        const decoded = verifyToken(token);
        
        if (!decoded) {
            return res.status(401).json({
                success: false,
                message: 'Invalid or expired token. Please login again.'
            });
        }

        // 5. Get the user from the database
        const user = await User.findById(decoded.id);
        
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User not found. Please login again.'
            });
        }

        // 6. Check if account is active
        if (!user.is_active) {
            return res.status(403).json({
                success: false,
                message: 'Your account has been deactivated.'
            });
        }

        // 7. Attach user to request object
        req.user = user;
        req.userId = user.id;
        req.userRole = user.role;
        
        // 8. Proceed to the next middleware/route handler
        next();
    } catch (error) {
        console.error('Authentication error:', error);
        return res.status(500).json({
            success: false,
            message: 'Authentication failed. Please try again.'
        });
    }
};

/**
 * Authorization Middleware
 * Checks if the user has the required role
 * @param {...string} roles - Allowed roles
 */
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Please login first.'
            });
        }

        // Check if user's role is in the allowed roles
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to access this resource.'
            });
        }

        next();
    };
};

/**
 * Optional Authentication Middleware
 * If token is provided, attaches user; otherwise proceeds as guest
 */
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            const decoded = verifyToken(token);
            if (decoded) {
                const user = await User.findById(decoded.id);
                if (user && user.is_active) {
                    req.user = user;
                    req.userId = user.id;
                    req.userRole = user.role;
                }
            }
        }
        next();
    } catch (error) {
        next();
    }
};

module.exports = {
    authenticate,
    authorize,
    optionalAuth
};