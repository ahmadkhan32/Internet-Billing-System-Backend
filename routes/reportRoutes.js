const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getRevenueReport,
  getCustomerReport,
  getBillReport
} = require('../controllers/reportController');
const authMiddleware = require('../middlewares/authMiddleware');
const { roleMiddleware, ispMiddleware } = require('../middlewares/roleMiddleware');

router.use(authMiddleware);

// Dashboard accessible to all authenticated users (customers and admins)
// For non-customers, we need to set req.ispId manually if not set by ispMiddleware
router.get('/dashboard', async (req, res, next) => {
  // Set req.ispId for non-customer users if not already set
  if (req.user.role !== 'customer' && req.user.role !== 'super_admin' && !req.ispId) {
    req.ispId = req.user.isp_id;
  }
  next();
}, getDashboardStats);

// Other routes require ISP middleware (staff only)
router.use(ispMiddleware);
router.get('/revenue', roleMiddleware('admin', 'account_manager'), getRevenueReport);
router.get('/customers', roleMiddleware('admin', 'account_manager'), getCustomerReport);
router.get('/bills', roleMiddleware('admin', 'account_manager'), getBillReport);

module.exports = router;

