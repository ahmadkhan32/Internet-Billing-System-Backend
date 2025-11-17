const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  getRoles,
  getRole,
  createRole,
  updateRole,
  deleteRole,
  assignPermissions,
  getRolePermissions
} = require('../controllers/roleController');
const authMiddleware = require('../middlewares/authMiddleware');
const { roleMiddleware } = require('../middlewares/roleMiddleware');
const { tenantMiddleware } = require('../middlewares/tenantMiddleware');

// Validation rules
const roleValidation = [
  body('name').notEmpty().withMessage('Role name is required'),
  body('display_name').notEmpty().withMessage('Display name is required'),
  body('permission_ids').optional().isArray().withMessage('Permission IDs must be an array')
];

router.use(authMiddleware);

// Initialize endpoint (before other middleware to allow access)
router.post('/initialize', async (req, res) => {
  try {
    // Only Super Admin can initialize
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Only Super Admin can initialize roles and permissions' });
    }
    const initializeRBAC = require('../utils/initializeRBAC');
    await initializeRBAC();
    res.json({ success: true, message: 'Roles and permissions initialized successfully' });
  } catch (error) {
    console.error('Error initializing RBAC:', error);
    res.status(500).json({ success: false, message: 'Error initializing roles and permissions', error: error.message });
  }
});

router.use(tenantMiddleware); // Apply tenant isolation
// Allow Super Admin and Business Admin (admin role) to manage roles
router.use((req, res, next) => {
  if (req.user.role === 'super_admin' || req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Access denied. Only Super Admin and Business Admin can manage roles.' });
  }
});

router.get('/', getRoles);
router.get('/:id', getRole);
router.get('/:id/permissions', getRolePermissions);
router.post('/', roleValidation, createRole);
router.post('/:id/permissions', [
  body('permission_ids').isArray().withMessage('Permission IDs must be an array')
], assignPermissions);
router.put('/:id', roleValidation, updateRole);
router.delete('/:id', deleteRole);

module.exports = router;

