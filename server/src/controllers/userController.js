const User = require('../models/User');

/**
 * Get all users (Admin only)
 * GET /api/v1/users
 */
const getAllUsers = async (req, res) => {
    try {
        const { role, is_active, search } = req.query;
        const users = await User.getAll({ role, is_active, search });

        res.status(200).json({
            success: true,
            data: users,
            count: users.length
        });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch users.'
        });
    }
};

/**
 * Update user account / role / active state (Admin only)
 * PUT /api/v1/users/:id
 */
const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, role, phone, address, is_active } = req.body;

        const updated = await User.update(id, {
            name,
            email,
            role,
            phone,
            address,
            is_active
        });

        if (!updated) {
            return res.status(404).json({
                success: false,
                message: 'User not found or update failed.'
            });
        }

        const user = await User.findById(id);

        res.status(200).json({
            success: true,
            message: 'User account updated successfully! ✅',
            data: user
        });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update user.'
        });
    }
};

/**
 * Delete user account
 * DELETE /api/v1/users/:id
 */
const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        if (id === req.userId) {
            return res.status(400).json({
                success: false,
                message: 'You cannot delete your own admin account.'
            });
        }

        await User.delete(id);

        res.status(200).json({
            success: true,
            message: 'User account deleted successfully.'
        });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete user.'
        });
    }
};

module.exports = {
    getAllUsers,
    updateUser,
    deleteUser
};
