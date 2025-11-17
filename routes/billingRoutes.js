const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  getBills,
  getBill,
  createBill,
  updateBill,
  autoGenerateBills,
  generateInvoice,
  updateBillStatus,
  deleteBill
} = require('../controllers/billingController');
const authMiddleware = require('../middlewares/authMiddleware');
const { roleMiddleware, ispMiddleware } = require('../middlewares/roleMiddleware');

// Validation rules
const billValidation = [
  body('customer_id').notEmpty().withMessage('Customer ID is required'),
  body('amount').isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
  body('due_date').optional().isISO8601().withMessage('Invalid date format')
];

router.use(authMiddleware);
// Apply ISP middleware to all routes (it handles super_admin and customers gracefully)
router.use(ispMiddleware);

// Routes accessible to all authenticated users (including customers)
router.get('/', getBills); // Customers see their own bills, admins see ISP bills
router.get('/:id', getBill); // Customers can view their own bill details
router.get('/:id/invoice', generateInvoice); // Customers can download their own invoices

// Admin/Account Manager only routes
router.post('/', roleMiddleware('super_admin', 'admin', 'account_manager'), billValidation, createBill);
router.put('/:id', roleMiddleware('super_admin', 'admin', 'account_manager'), updateBill);
router.post('/auto-generate', roleMiddleware('super_admin', 'admin', 'account_manager'), autoGenerateBills);
router.put('/:id/status', roleMiddleware('super_admin', 'admin', 'account_manager'), updateBillStatus);
router.delete('/:id', roleMiddleware('super_admin', 'admin'), deleteBill);

module.exports = router;

