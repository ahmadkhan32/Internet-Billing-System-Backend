const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  getPackages,
  getPackage,
  createPackage,
  updatePackage,
  deletePackage
} = require('../controllers/packageController');
const authMiddleware = require('../middlewares/authMiddleware');
const { roleMiddleware } = require('../middlewares/roleMiddleware');
const { tenantMiddleware } = require('../middlewares/tenantMiddleware');

// Validation rules
const packageValidation = [
  body('name').notEmpty().withMessage('Package name is required'),
  body('speed').notEmpty().withMessage('Speed is required'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('data_limit').optional().isFloat({ min: 0 }).withMessage('Data limit must be a positive number'),
  body('duration').optional().isInt({ min: 1 }).withMessage('Duration must be at least 1 month')
];

router.use(authMiddleware);
router.use(tenantMiddleware); // Apply tenant isolation

router.get('/', getPackages);
router.get('/:id', getPackage);
router.post('/', roleMiddleware('admin', 'super_admin'), packageValidation, createPackage);
router.put('/:id', roleMiddleware('admin', 'super_admin'), packageValidation, updatePackage);
router.delete('/:id', roleMiddleware('admin', 'super_admin'), deletePackage);

module.exports = router;

