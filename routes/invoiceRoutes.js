const express = require('express');
const router = express.Router();
const {
  getInvoices,
  getInvoice,
  autoGenerateInvoiceForBill,
  regenerateInvoice
} = require('../controllers/invoiceController');
const authMiddleware = require('../middlewares/authMiddleware');
const { roleMiddleware } = require('../middlewares/roleMiddleware');
const { tenantMiddleware } = require('../middlewares/tenantMiddleware');

router.use(authMiddleware);
router.use(tenantMiddleware);

// Get all invoices (accessible to all authenticated users)
router.get('/', getInvoices);

// Get single invoice (accessible to all authenticated users)
router.get('/:id', getInvoice);

// Auto-generate invoice for a bill (Admin, Account Manager)
router.post('/auto-generate/:billId', roleMiddleware('super_admin', 'admin', 'account_manager'), autoGenerateInvoiceForBill);

// Re-generate invoice (Admin, Account Manager)
router.post('/:id/regenerate', roleMiddleware('super_admin', 'admin', 'account_manager'), regenerateInvoice);

module.exports = router;

