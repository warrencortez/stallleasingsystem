const express = require('express');
const router = express.Router();
const userController = require('../../controllers/userController');
const { authenticate, authorize } = require('../../middleware/auth');

// Admin only routes for managing user accounts
router.use(authenticate);
router.use(authorize('admin'));

router.get('/', userController.getAllUsers);
router.put('/:id', userController.updateUser);
router.delete('/:id', userController.deleteUser);

module.exports = router;
