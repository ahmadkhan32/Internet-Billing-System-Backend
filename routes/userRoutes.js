const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { getUsers, getUserById, createUser, updateUser, deleteUser } = require('../controllers/userController');
const authMiddleware = require('../middlewares/authMiddleware');
const { roleMiddleware } = require('../middlewares/roleMiddleware');
const { tenantMiddleware } = require('../middlewares/tenantMiddleware');

// Validation rules
const createUserValidation = [
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').isIn(['super_admin', 'admin', 'account_manager', 'technical_officer', 'recovery_officer', 'customer']).withMessage('Invalid role'),
  body('isp_id').optional().isInt().withMessage('ISP ID must be an integer'),
  body('phone').optional().isString(),
  body('address').optional().isString()
];

const updateUserValidation = [
  body('name').optional().notEmpty().withMessage('Name cannot be empty'),
  body('email').optional().isEmail().withMessage('Please provide a valid email'),
  body('password').optional().isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').optional().isIn(['super_admin', 'admin', 'account_manager', 'technical_officer', 'recovery_officer', 'customer']).withMessage('Invalid role'),
  body('isp_id').optional().isInt().withMessage('ISP ID must be an integer'),
  body('is_active').optional().isBoolean().withMessage('is_active must be a boolean')
];

// All routes require authentication
router.use(authMiddleware);
router.use(tenantMiddleware); // Apply tenant isolation

// Get all users (Super Admin, Admin)
router.get('/', roleMiddleware('super_admin', 'admin'), getUsers);

// Get single user (Super Admin, Admin, or self)
router.get('/:id', getUserById);

// Create user (Super Admin, Admin)
router.post('/', roleMiddleware('super_admin', 'admin'), createUserValidation, createUser);

// Update user (Super Admin, Admin, or self)
router.put('/:id', updateUserValidation, updateUser);

// Delete user (Super Admin, Admin)
router.delete('/:id', roleMiddleware('super_admin', 'admin'), deleteUser);

module.exports = router;

