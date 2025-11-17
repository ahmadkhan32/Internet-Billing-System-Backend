/**
 * Automation Routes
 */

const express = require('express');
const router = express.Router();
const automationController = require('../controllers/automationController');
const authMiddleware = require('../middlewares/authMiddleware');
const { roleMiddleware, ispMiddleware } = require('../middlewares/roleMiddleware');

// Stripe payment reconciliation (webhook - public, no auth required)
router.post('/reconcile-stripe',
  automationController.reconcileStripePayment
);

// All other routes require authentication
router.use(authMiddleware);

// AI Insights - Admin, Super Admin
router.get('/insights', 
  roleMiddleware(['super_admin', 'admin']),
  ispMiddleware,
  automationController.getAIInsights
);

// High-risk customers - Admin, Super Admin, Recovery Officer
router.get('/high-risk-customers',
  roleMiddleware(['super_admin', 'admin', 'recovery_officer']),
  ispMiddleware,
  automationController.getHighRiskCustomers
);

// Customer churn risk - Admin, Super Admin, Account Manager
router.get('/churn-risk/:customerId',
  roleMiddleware(['super_admin', 'admin', 'account_manager']),
  ispMiddleware,
  automationController.getCustomerChurnRisk
);

// Fraud detection - Admin, Super Admin, Account Manager
router.post('/detect-fraud',
  roleMiddleware(['super_admin', 'admin', 'account_manager']),
  ispMiddleware,
  automationController.detectFraud
);

// Revenue projection - Admin, Super Admin
router.get('/revenue-projection',
  roleMiddleware(['super_admin', 'admin']),
  ispMiddleware,
  automationController.getRevenueProjection
);

// Payment reconciliation - Admin, Super Admin (or public for webhooks)
router.post('/reconcile-payment',
  roleMiddleware(['super_admin', 'admin']),
  automationController.reconcilePayment
);

// Auto-suspension trigger - Admin, Super Admin
router.post('/auto-suspend',
  roleMiddleware(['super_admin', 'admin']),
  ispMiddleware,
  automationController.triggerAutoSuspension
);

// Backup trigger - Super Admin only
router.post('/backup',
  roleMiddleware(['super_admin']),
  automationController.triggerBackup
);

module.exports = router;
