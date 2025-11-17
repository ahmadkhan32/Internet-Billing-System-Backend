const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  getSaaSPackages,
  getSaaSPackage,
  createSaaSPackage,
  updateSaaSPackage,
  deleteSaaSPackage
} = require('../controllers/saaSPackageController');
const authMiddleware = require('../middlewares/authMiddleware');
const { roleMiddleware } = require('../middlewares/roleMiddleware');

// Validation rules
const packageValidation = [
  body('name').notEmpty().withMessage('Package name is required'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('duration').optional().isInt({ min: 1 }).withMessage('Duration must be at least 1 month')
];

router.use(authMiddleware);
router.use(roleMiddleware('super_admin')); // Only Super Admin can manage SaaS packages

router.get('/', getSaaSPackages);
router.get('/:id', getSaaSPackage);
router.post('/', packageValidation, createSaaSPackage);
router.put('/:id', packageValidation, updateSaaSPackage);
router.delete('/:id', deleteSaaSPackage);

module.exports = router;

