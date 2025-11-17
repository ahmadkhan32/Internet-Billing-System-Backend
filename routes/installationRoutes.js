const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  getInstallations,
  getInstallation,
  createInstallation,
  updateInstallation,
  deleteInstallation
} = require('../controllers/installationController');
const authMiddleware = require('../middlewares/authMiddleware');
const { roleMiddleware, ispMiddleware } = require('../middlewares/roleMiddleware');

// Validation rules
const installationValidation = [
  body('customer_id').isInt().withMessage('Customer ID is required'),
  body('service_address').notEmpty().withMessage('Service address is required'),
  body('connection_type').optional().isIn(['fiber', 'wireless', 'cable', 'dsl']).withMessage('Invalid connection type'),
  body('bandwidth').optional().notEmpty().withMessage('Bandwidth is required if provided')
];

router.use(authMiddleware);
router.use(ispMiddleware);

router.get('/', getInstallations);
router.get('/:id', getInstallation);
router.post('/', roleMiddleware('admin', 'account_manager', 'technical_officer', 'super_admin'), installationValidation, createInstallation);
router.put('/:id', roleMiddleware('admin', 'account_manager', 'technical_officer', 'super_admin'), updateInstallation);
router.delete('/:id', roleMiddleware('admin', 'super_admin'), deleteInstallation);

module.exports = router;

