const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  getPayments,
  getPayment,
  createPayment,
  processOnlinePayment,
  getPaymentStats,
  generatePaymentReceipt
} = require('../controllers/paymentController');
const authMiddleware = require('../middlewares/authMiddleware');
const { roleMiddleware, ispMiddleware } = require('../middlewares/roleMiddleware');

// Validation rules
const paymentValidation = [
  body('bill_id').notEmpty().withMessage('Bill ID is required'),
  body('amount').isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
  body('method').isIn(['cash', 'card', 'online', 'bank_transfer', 'jazzcash', 'easypaisa', 'stripe']).withMessage('Invalid payment method')
];

router.use(authMiddleware);

// Customer can access their own payment history
router.get('/my-payments', roleMiddleware('customer'), require('../controllers/paymentController').getMyPayments);

// Online payment (public for customers)
router.post('/online', processOnlinePayment);

// Payment creation - allow customers to record their own payments
router.post('/', paymentValidation, createPayment);

// Other payment routes (private, require ISP middleware)
router.use(ispMiddleware);

router.get('/', getPayments);
router.get('/stats', roleMiddleware('admin', 'account_manager'), getPaymentStats);
router.get('/:id', getPayment);
router.get('/:id/receipt', generatePaymentReceipt);

module.exports = router;

