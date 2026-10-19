const User = require('../models/User');
const { generateToken } = require('../config/jwt');

/**
 * REGISTER - Create a new user account
 * POST /api/v1/auth/register
 */
const { register } = require('./registrationController');

/**
 * LOGIN - Sign in to account (Supports Email or Mobile Number)
 * POST /api/v1/auth/login
 */
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide your mobile number/email and password.'
            });
        }

        let user = await User.findByEmailOrPhone(email);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password.'
            });
        }

        // Verify password
        let isPasswordValid = await User.comparePassword(password, user.password);

        if (!isPasswordValid) {
            console.warn(`[AUTH] Invalid password attempt for: ${email}`);
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password.'
            });
        }

        if (!user.is_active) {
            return res.status(403).json({
                success: false,
                message: 'Your account has been deactivated. Please contact support.'
            });
        }

        const token = generateToken(user.id, user.role);
        user = User.toPublic(user);

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
        res.status(200).json({
            success: true,
            data: { user: req.user }
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user profile.'
        });
    }
};

/**
 * LOGOUT - Invalidate session
 * POST /api/v1/auth/logout
 */
const logout = async (req, res) => {
    try {
        res.status(200).json({
            success: true,
            message: 'Logged out successfully.'
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            message: 'Logout failed.'
        });
    }
};

/**
 * UPDATE PROFILE - Update current user's profile
 * PUT /api/v1/auth/profile
 */
const updateProfile = async (req, res) => {
    try {
        const { name, phone, address, profile_image } = req.body;
        const userId = req.userId;

        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (phone !== undefined) updateData.phone = phone;
        if (address !== undefined) updateData.address = address;
        if (profile_image !== undefined) updateData.profile_image = profile_image;

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No fields to update.'
            });
        }

        const success = await User.update(userId, updateData);
        if (!success) {
            return res.status(400).json({
                success: false,
                message: 'Failed to update profile.'
            });
        }

        const updatedUser = await User.findById(userId);
        res.status(200).json({
            success: true,
            message: 'Profile updated successfully! ✅',
            data: { user: updatedUser }
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
 * CHANGE PASSWORD - Update current user's password
 * PUT /api/v1/auth/change-password
 */
const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.userId;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Please provide current and new password.'
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'New password must be at least 6 characters long.'
            });
        }

        const user = await User.findForAuthentication(userId);
        const isPasswordValid = await User.comparePassword(currentPassword, user?.password);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Current password is incorrect.'
            });
        }

        await User.updatePassword(userId, newPassword);

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