const User = require('../models/User');
const { generateToken } = require('../config/jwt');

/**
 * REGISTER - Create a new user account
 * POST /api/v1/auth/register
 */
const register = async (req, res) => {
    try {
        // 1. Get data from request body
        const { name, email, password, role, phone, address } = req.body;

        // 2. Validate required fields
        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide name, email and password.'
            });
        }

        // 3. Validate email format (basic check)
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a valid email address.'
            });
        }

        // 4. Validate password length
        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters long.'
            });
        }

        // 5. Check if user already exists
        const existingUser = await User.findByEmail(email);
        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: 'Email is already registered. Please use a different email.'
            });
        }

        // 6. Create the user
        const userId = await User.create({
            name,
            email,
            password,
            role: role || 'tenant', // Default role is 'tenant'
            phone,
            address
        });

        // 7. Get the created user (without password)
        const user = await User.findById(userId);

        // 8. Generate JWT token
        const token = generateToken(userId, user.role);

        // 9. Send response
        res.status(201).json({
            success: true,
            message: 'Registration successful! Welcome aboard! 🎉',
            data: {
                user,
                token
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        
        // Handle duplicate email error (just in case)
        if (error.code === '23505') { // PostgreSQL unique violation
            return res.status(409).json({
                success: false,
                message: 'Email is already registered.'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Registration failed. Please try again.'
        });
    }
};

/**
 * LOGIN - Sign in to account
 * POST /api/v1/auth/login
 */
const login = async (req, res) => {
    try {
        // 1. Get data from request body
        const { email, password } = req.body;

        // 2. Validate required fields
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide email and password.'
            });
        }

        // 3. Find user by email
        const user = await User.findByEmail(email);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password.'
            });
        }

        // 4. Check password
        const isPasswordValid = await User.comparePassword(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password.'
            });
        }

        // 5. Check if account is active
        if (!user.is_active) {
            return res.status(403).json({
                success: false,
                message: 'Your account has been deactivated. Please contact support.'
            });
        }

        // 6. Generate JWT token
        const token = generateToken(user.id, user.role);

        // 7. Remove password from response
        delete user.password;

        // 8. Send response
        res.status(200).json({
            success: true,
            message: 'Login successful! Welcome back! 👋',
            data: {
                user,
                token
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Login failed. Please try again.'
        });
    }
};

/**
 * GET CURRENT USER - Get logged in user's profile
 * GET /api/v1/auth/me
 */
const getCurrentUser = async (req, res) => {
    try {
        // req.user is set by the authenticate middleware
        res.status(200).json({
            success: true,
            data: { user: req.user }
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user data.'
        });
    }
};

/**
 * LOGOUT - Client will remove the token
 * POST /api/v1/auth/logout
 */
const logout = async (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Logged out successfully. See you soon! 👋'
    });
};

/**
 * UPDATE PROFILE - Update user profile
 * PUT /api/v1/auth/profile
 */
const updateProfile = async (req, res) => {
    try {
        const { name, phone, address, profile_image } = req.body;
        
        // Update user
        const updated = await User.update(req.userId, {
            name,
            phone,
            address,
            profile_image
        });

        if (!updated) {
            return res.status(400).json({
                success: false,
                message: 'Failed to update profile.'
            });
        }

        // Get updated user
        const user = await User.findById(req.userId);

        res.status(200).json({
            success: true,
            message: 'Profile updated successfully! ✅',
            data: { user }
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update profile.'
        });
    }
};

/**
 * CHANGE PASSWORD - Change user's password
 * PUT /api/v1/auth/change-password
 */
const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        // Validate required fields
        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Please provide current and new password.'
            });
        }

        // Validate new password length
        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'New password must be at least 6 characters long.'
            });
        }

        // Get user with password
        const user = await User.findByEmail(req.user.email);
        
        // Verify current password
        const isValid = await User.comparePassword(currentPassword, user.password);
        if (!isValid) {
            return res.status(401).json({
                success: false,
                message: 'Current password is incorrect.'
            });
        }

        // Update password
        const updated = await User.updatePassword(req.userId, newPassword);
        
        if (!updated) {
            return res.status(400).json({
                success: false,
                message: 'Failed to update password.'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Password changed successfully! 🔒'
        });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to change password.'
        });
    }
};

module.exports = {
    register,
    login,
    getCurrentUser,
    logout,
    updateProfile,
    changePassword
};