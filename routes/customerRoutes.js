const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  getCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer
} = require('../controllers/customerController');
const authMiddleware = require('../middlewares/authMiddleware');
const { roleMiddleware, ispMiddleware } = require('../middlewares/roleMiddleware');

// Validation rules
const customerValidation = [
  body('name').notEmpty().withMessage('Name is required'),
  body('phone').notEmpty().withMessage('Phone is required'),
  body('address').notEmpty().withMessage('Address is required'),
  body('email').optional().isEmail().withMessage('Please provide a valid email')
];

router.use(authMiddleware);
// Apply ISP middleware to all routes (it handles super_admin and customers gracefully)
router.use(ispMiddleware);

// Customer can access their own info
router.get('/me', roleMiddleware('customer'), require('../controllers/customerController').getMyInfo);

router.get('/', roleMiddleware('super_admin', 'admin', 'account_manager', 'technical_officer', 'recovery_officer'), getCustomers);
router.get('/:id', roleMiddleware('super_admin', 'admin', 'account_manager', 'technical_officer', 'recovery_officer'), getCustomer);
router.post('/', roleMiddleware('super_admin', 'admin', 'account_manager'), customerValidation, createCustomer);
router.put('/:id', roleMiddleware('super_admin', 'admin', 'account_manager'), customerValidation, updateCustomer);
router.delete('/:id', roleMiddleware('super_admin', 'admin'), deleteCustomer);

module.exports = router;

