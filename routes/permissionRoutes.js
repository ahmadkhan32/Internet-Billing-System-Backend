const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  getPermissions,
  getPermission,
  createPermission,
  updatePermission,
  deletePermission
} = require('../controllers/permissionController');
const authMiddleware = require('../middlewares/authMiddleware');
const { roleMiddleware } = require('../middlewares/roleMiddleware');

// Validation rules
const permissionValidation = [
  body('name').notEmpty().withMessage('Permission name is required'),
  body('display_name').notEmpty().withMessage('Display name is required'),
  body('resource').notEmpty().withMessage('Resource is required'),
  body('action').notEmpty().withMessage('Action is required')
];

router.use(authMiddleware);

// GET routes - allow Super Admin and Business Admin to view permissions
router.get('/', (req, res, next) => {
  if (req.user.role === 'super_admin' || req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Access denied. Only Super Admin and Business Admin can view permissions.' });
  }
}, getPermissions);

router.get('/:id', (req, res, next) => {
  if (req.user.role === 'super_admin' || req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Access denied. Only Super Admin and Business Admin can view permissions.' });
  }
}, getPermission);

// POST, PUT, DELETE routes - only Super Admin can manage permissions
router.post('/', roleMiddleware('super_admin'), permissionValidation, createPermission);
router.put('/:id', roleMiddleware('super_admin'), permissionValidation, updatePermission);
router.delete('/:id', roleMiddleware('super_admin'), deletePermission);

module.exports = router;

