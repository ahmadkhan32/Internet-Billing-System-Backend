/**
 * Automation Controller
 * Handles automation features: AI insights, payment reconciliation, backups, etc.
 */

const { Op } = require('sequelize');
const aiAnalytics = require('../utils/aiAnalytics');
const autoPaymentReconciliation = require('../utils/autoPaymentReconciliation');
const autoSuspension = require('../utils/autoSuspension');
const autoBackup = require('../utils/autoBackup');
const { Customer, Bill, Payment, ISP } = require('../models');

// @desc    Get AI insights for ISP
// @route   GET /api/automation/insights
// @access  Private (Admin, Super Admin)
const getAIInsights = async (req, res) => {
  try {
    let ispId = null;
    
    if (req.user.role === 'super_admin') {
      // Super admin can specify ISP or get global insights
      ispId = req.query.isp_id || null;
    } else {
      ispId = req.ispId || req.user.isp_id;
    }

    if (!ispId && req.user.role !== 'super_admin') {
      return res.status(400).json({ 
        message: 'ISP ID is required' 
      });
    }

    const insights = await aiAnalytics.generateInsights(ispId);
    
    res.json({
      success: true,
      insights
    });
  } catch (error) {
    console.error('Get AI insights error:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message 
    });
  }
};

// @desc    Get high-risk customers
// @route   GET /api/automation/high-risk-customers
// @access  Private (Admin, Super Admin, Recovery Officer)
const getHighRiskCustomers = async (req, res) => {
  try {
    let ispId = null;
    
    if (req.user.role === 'super_admin') {
      ispId = req.query.isp_id || null;
    } else {
      ispId = req.ispId || req.user.isp_id;
    }

    if (!ispId && req.user.role !== 'super_admin') {
      return res.status(400).json({ 
        message: 'ISP ID is required' 
      });
    }

    const limit = parseInt(req.query.limit) || 20;
    const highRiskCustomers = await aiAnalytics.getHighRiskCustomers(ispId, limit);
    
      res.json({
        success: true,
      customers: highRiskCustomers
      });
  } catch (error) {
    console.error('Get high-risk customers error:', error);
      res.status(500).json({ 
      message: 'Server error', 
        error: error.message 
      });
  }
};

// @desc    Get customer churn risk
// @route   GET /api/automation/churn-risk/:customerId
// @access  Private (Admin, Super Admin, Account Manager)
const getCustomerChurnRisk = async (req, res) => {
  try {
    const { customerId } = req.params;

    // Verify customer belongs to ISP (unless super admin)
    const customerWhere = { id: customerId };
    if (req.user.role !== 'super_admin') {
      const ispId = req.ispId || req.user.isp_id;
      if (ispId) {
        customerWhere.isp_id = ispId;
      }
    }

    const customer = await Customer.findOne({ where: customerWhere });
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    const churnRisk = await aiAnalytics.calculateChurnRisk(customerId);
    
      res.json({
        success: true,
      customer: {
        id: customer.id,
        name: customer.name
      },
      churnRisk
    });
  } catch (error) {
    console.error('Get churn risk error:', error);
      res.status(500).json({ 
      message: 'Server error', 
        error: error.message 
      });
  }
};

// @desc    Detect fraud in payment
// @route   POST /api/automation/detect-fraud
// @access  Private (Admin, Super Admin, Account Manager)
const detectFraud = async (req, res) => {
  try {
    const { customer_id, amount, method, transaction_id } = req.body;

    if (!customer_id || !amount) {
      return res.status(400).json({ 
        message: 'Customer ID and amount are required' 
      });
    }

    const fraudDetection = await aiAnalytics.detectFraud({
      customerId: customer_id,
      amount,
      method: method || 'online',
      transactionId: transaction_id
    });

    res.json({
      success: true,
      fraudDetection
    });
      } catch (error) {
    console.error('Fraud detection error:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message 
    });
  }
};

// @desc    Get revenue projection
// @route   GET /api/automation/revenue-projection
// @access  Private (Admin, Super Admin)
const getRevenueProjection = async (req, res) => {
  try {
    let ispId = null;
    
    if (req.user.role === 'super_admin') {
      ispId = req.query.isp_id || null;
    } else {
      ispId = req.ispId || req.user.isp_id;
    }

    if (!ispId && req.user.role !== 'super_admin') {
      return res.status(400).json({ 
        message: 'ISP ID is required' 
      });
    }

    const months = parseInt(req.query.months) || 6;
    const projection = await aiAnalytics.generateRevenueProjection(ispId, months);
    
    res.json({
      success: true,
      projection
    });
      } catch (error) {
    console.error('Get revenue projection error:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message 
    });
  }
};

// @desc    Reconcile payment from gateway
// @route   POST /api/automation/reconcile-payment
// @access  Private (Admin, Super Admin) or Public (for webhooks)
const reconcilePayment = async (req, res) => {
  try {
    const { transactionId, customerEmail, customerPhone, amount, method, paymentDate } = req.body;

    if (!transactionId || !amount) {
      return res.status(400).json({ 
        message: 'Transaction ID and amount are required' 
      });
    }

    if (!customerEmail && !customerPhone) {
      return res.status(400).json({ 
        message: 'Customer email or phone is required' 
      });
    }

    const result = await autoPaymentReconciliation.reconcilePayment({
      transactionId,
      customerEmail,
      customerPhone,
      amount,
      method: method || 'online',
      paymentDate: paymentDate ? new Date(paymentDate) : new Date()
    });

    res.json({
      success: result.success,
      message: result.message,
      data: result
    });
  } catch (error) {
    console.error('Payment reconciliation error:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message 
    });
  }
};

// @desc    Reconcile Stripe payment (webhook)
// @route   POST /api/automation/reconcile-stripe
// @access  Public (webhook - no auth required)
const reconcileStripePayment = async (req, res) => {
  try {
    // Verify Stripe webhook signature here if needed
    // const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    // const sig = req.headers['stripe-signature'];
    // const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);

    const stripeEvent = req.body;

    const result = await autoPaymentReconciliation.reconcileStripePayment(stripeEvent);

    res.json({
      success: result.success,
      message: result.message,
      data: result
    });
  } catch (error) {
    console.error('Stripe payment reconciliation error:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message 
    });
  }
};

// @desc    Manually trigger auto-suspension
// @route   POST /api/automation/auto-suspend
// @access  Private (Admin, Super Admin)
const triggerAutoSuspension = async (req, res) => {
  try {
    const { gracePeriodDays = 7 } = req.body;

    const result = await autoSuspension.autoSuspendCustomers({
      gracePeriodDays,
      sendNotification: true
    });

    res.json({
      success: true,
      message: `Auto-suspension completed. Suspended: ${result.suspended}, Already suspended: ${result.alreadySuspended}`,
      result
    });
  } catch (error) {
    console.error('Auto-suspension error:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message 
    });
  }
};

// @desc    Manually trigger backup
// @route   POST /api/automation/backup
// @access  Private (Super Admin only)
const triggerBackup = async (req, res) => {
  try {
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ 
        message: 'Only Super Admin can trigger backups' 
      });
    }

    const { type = 'full' } = req.body; // 'full', 'database', 'invoices'

    let result;
    if (type === 'database') {
      result = await autoBackup.backupDatabase();
    } else if (type === 'invoices') {
      result = await autoBackup.backupInvoices();
    } else {
      result = await autoBackup.fullBackup();
    }

    res.json({
      success: true,
      message: 'Backup completed successfully',
      result
    });
    } catch (error) {
    console.error('Backup error:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message 
    });
  }
};

module.exports = {
  getAIInsights,
  getHighRiskCustomers,
  getCustomerChurnRisk,
  detectFraud,
  getRevenueProjection,
  reconcilePayment,
  reconcileStripePayment,
  triggerAutoSuspension,
  triggerBackup
};
