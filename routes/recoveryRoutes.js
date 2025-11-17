const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  getRecoveries,
  getRecovery,
  createRecovery,
  updateRecovery,
  deleteRecovery,
  getOverdueBills
} = require('../controllers/recoveryController');
const authMiddleware = require('../middlewares/authMiddleware');
const { roleMiddleware } = require('../middlewares/roleMiddleware');
const { tenantMiddleware } = require('../middlewares/tenantMiddleware');

// Validation rules
const recoveryValidation = [
  body('recovery_officer_id').notEmpty().withMessage('Recovery officer ID is required'),
  body('customer_id').notEmpty().withMessage('Customer ID is required')
];

router.use(authMiddleware);
router.use(tenantMiddleware); // Apply tenant isolation
const { ispMiddleware } = require('../middlewares/roleMiddleware');
router.use(ispMiddleware); // Ensure req.ispId is set

router.get('/', roleMiddleware('admin', 'super_admin', 'recovery_officer'), getRecoveries);
router.get('/overdue', roleMiddleware('admin', 'super_admin'), getOverdueBills);
router.get('/:id', roleMiddleware('admin', 'super_admin', 'recovery_officer'), getRecovery);
router.post('/', roleMiddleware('admin', 'super_admin'), recoveryValidation, createRecovery);
router.put('/:id', roleMiddleware('admin', 'super_admin', 'recovery_officer'), updateRecovery);
router.delete('/:id', roleMiddleware('admin', 'super_admin'), deleteRecovery);

module.exports = router;

