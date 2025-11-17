const { Payment, Bill, Customer, Notification } = require('../models');
const { validationResult } = require('express-validator');
const { Op } = require('sequelize');
const { Sequelize } = require('sequelize');
const moment = require('moment');
const generateReceipt = require('../utils/generateReceipt');
const createActivityLog = require('../utils/activityLogger');
const sendEmail = require('../utils/sendEmail');

// Generate unique receipt number
const generateReceiptNumber = async (ispId) => {
  if (!ispId) {
    // Fallback for cases where ISP ID is not available
    const prefix = 'RCP-';
    const year = new Date().getFullYear();
    const count = await Payment.count({
      where: {
        createdAt: {
          [Op.gte]: new Date(`${year}-01-01`)
        }
      }
    });
    return `${prefix}${year}-${String(count + 1).padStart(6, '0')}`;
  }
  
  const prefix = `RCP${ispId}-`;
  const year = new Date().getFullYear();
  const count = await Payment.count({
    where: {
      isp_id: ispId,
      createdAt: {
        [Op.gte]: new Date(`${year}-01-01`)
      }
    }
  });
  return `${prefix}${year}-${String(count + 1).padStart(6, '0')}`;
};

// @desc    Get all payments
// @route   GET /api/payments
// @access  Private
const getPayments = async (req, res) => {
  try {
    const { page = 1, limit = 10, status = '', method = '', start_date = '', end_date = '' } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {};
    
    // Super admin can see all payments, others see only their ISP's payments
    if (req.user.role !== 'super_admin') {
      // req.ispId is set by middleware, but if null, use req.user.isp_id
      const ispId = req.ispId || req.user.isp_id;
      if (!ispId) {
        return res.status(400).json({ 
          message: 'Your account is not associated with an ISP. Please contact your administrator.' 
        });
      }
      whereClause.isp_id = ispId;
    }
    // For super_admin, no ISP filter (can see all payments)

    if (status) {
      whereClause.status = status;
    }

    if (method) {
      whereClause.method = method;
    }

    if (start_date && end_date) {
      whereClause.payment_date = {
        [Op.between]: [new Date(start_date), new Date(end_date)]
      };
    }

    const payments = await Payment.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Bill,
          as: 'bill',
          attributes: ['id', 'bill_number', 'amount', 'due_date']
        },
        {
          model: Customer,
          as: 'customer',
          attributes: ['id', 'name', 'phone', 'email']
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['payment_date', 'DESC']]
    });

    res.json({
      success: true,
      payments: payments.rows,
      total: payments.count,
      page: parseInt(page),
      pages: Math.ceil(payments.count / limit)
    });
  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get single payment
// @route   GET /api/payments/:id
// @access  Private
const getPayment = async (req, res) => {
  try {
    const whereClause = { id: req.params.id };
    
    // Super admin can access any payment, others only their ISP's
    if (req.user.role !== 'super_admin') {
      const ispId = req.ispId || req.user.isp_id;
      if (ispId) {
        whereClause.isp_id = ispId;
      }
    }
    // For super_admin, no ISP filter
    
    const payment = await Payment.findOne({
      where: whereClause,
      include: [
        {
          model: Bill,
          as: 'bill',
          include: [{ model: Package, as: 'package' }]
        },
        {
          model: Customer,
          as: 'customer'
        }
      ]
    });

    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    res.json({
      success: true,
      payment
    });
  } catch (error) {
    console.error('Get payment error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Create payment
// @route   POST /api/payments
// @access  Private
const createPayment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { bill_id, amount, method, transaction_id, notes } = req.body;

    // Verify bill exists
    // For customers, get ISP ID from bill; for staff, use req.ispId
    const billWhere = { id: bill_id };
    if (req.user.role !== 'customer' && req.user.role !== 'super_admin') {
      const ispId = req.ispId || req.user.isp_id;
      if (ispId) {
        billWhere.isp_id = ispId;
      }
    }

    const bill = await Bill.findOne({
      where: billWhere,
      include: [{ model: Customer, as: 'customer' }]
    });

    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    // For customers, verify they own this bill
    if (req.user.role === 'customer') {
      // Find customer record by email or phone (not by user.id)
      const customer = await Customer.findOne({
        where: {
          [Op.or]: [
            { email: req.user.email },
            { phone: req.user.email } // Some users use phone as email
          ],
          ...(req.user.isp_id ? { isp_id: req.user.isp_id } : {})
        }
      });

      if (!customer || bill.customer_id !== customer.id) {
        return res.status(403).json({ message: 'Access denied - this bill does not belong to you' });
      }
    }

    // Use bill's ISP ID for customers, or user's ISP ID for staff
    const ispId = req.user.role === 'customer' 
      ? bill.isp_id 
      : (req.ispId || req.user.isp_id || bill.isp_id);

    // Generate receipt number
    const receipt_number = await generateReceiptNumber(ispId);

    // Create payment
    const payment = await Payment.create({
      bill_id,
      customer_id: bill.customer_id,
      amount,
      method,
      transaction_id,
      receipt_number,
      notes,
      isp_id: ispId,
      status: 'completed',
      payment_date: new Date()
    });

    // Update bill status based on payments
    const totalPaid = await Payment.sum('amount', {
      where: {
        bill_id,
        status: 'completed'
      }
    });

    const billAmount = parseFloat(bill.total_amount || bill.amount);
    const paidAmount = parseFloat(totalPaid);

    if (paidAmount >= billAmount) {
      await bill.update({ status: 'paid', paid_amount: paidAmount });
    } else if (paidAmount > 0) {
      await bill.update({ status: 'partial', paid_amount: paidAmount });
    } else {
      await bill.update({ paid_amount: paidAmount });
    }

    // Auto-reactivate customer if suspended and all bills are now paid
    try {
      const autoSuspension = require('../utils/autoSuspension');
      const reactivationResult = await autoSuspension.checkAndReactivateAfterPayment(bill.customer_id);
      if (reactivationResult.success) {
        console.log(`✅ Auto-reactivated customer ${bill.customer_id} after payment`);
      }
    } catch (error) {
      console.error('Error in auto-reactivation:', error);
      // Don't fail payment creation if reactivation fails
    }

    // Create payment notification
    if (bill.customer) {
      // Find customer's user account for notification
      const User = require('../models/User');
      let customerUser = null;
      if (bill.customer.email) {
        customerUser = await User.findOne({ 
          where: { 
            email: bill.customer.email,
            role: 'customer'
          }
        });
      }

      await Notification.create({
        customer_id: bill.customer_id,
        user_id: customerUser ? customerUser.id : null, // Link to user account if exists
        bill_id: bill.id,
        type: 'payment_received',
        title: 'Payment Received',
        message: `Payment of PKR ${amount.toFixed(2)} has been received for bill ${bill.bill_number}. Receipt: ${receipt_number}. You can download the invoice from your portal.`,
        channel: 'both',
        scheduled_at: new Date(),
        isp_id: ispId
      });
    }

    // Create activity log
    await createActivityLog(
      req.user?.id || null,
      'CREATE_PAYMENT',
      'Payment',
      payment.id,
      null,
      { amount, method, receipt_number },
      ispId,
      req.ip,
      req.get('user-agent')
    );

    res.status(201).json({
      success: true,
      message: 'Payment recorded successfully',
      payment
    });
  } catch (error) {
    console.error('Create payment error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Process online payment (Stripe integration)
// @route   POST /api/payments/online
// @access  Public (for customers)
const processOnlinePayment = async (req, res) => {
  try {
    const { bill_id, payment_method_id, amount } = req.body;

    // Verify bill
    const bill = await Bill.findOne({
      where: { id: bill_id },
      include: [{ model: Customer, as: 'customer' }]
    });

    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    // If user is authenticated and is a customer, verify they own this bill
    if (req.user && req.user.role === 'customer') {
      const customer = await Customer.findOne({
        where: {
          [Op.or]: [
            { email: req.user.email },
            { phone: req.user.email } // Some users use phone as email
          ],
          ...(req.user.isp_id ? { isp_id: req.user.isp_id } : {})
        }
      });

      if (!customer || bill.customer_id !== customer.id) {
        return res.status(403).json({ message: 'Access denied - this bill does not belong to you' });
      }
    }

    // Initialize Stripe (if configured)
    if (process.env.STRIPE_SECRET_KEY) {
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(parseFloat(amount) * 100), // Convert to cents
          currency: 'pkr',
          payment_method: payment_method_id,
          confirm: true,
          return_url: `${process.env.FRONTEND_URL}/payments/success`
        });

        // Create payment record
        const receipt_number = await generateReceiptNumber(bill.isp_id);
        const payment = await Payment.create({
          bill_id,
          customer_id: bill.customer_id,
          amount,
          method: 'stripe',
          transaction_id: paymentIntent.id,
          receipt_number,
          isp_id: bill.isp_id,
          status: paymentIntent.status === 'succeeded' ? 'completed' : 'pending',
          payment_date: new Date()
        });

        // Update bill status
        const totalPaid = await Payment.sum('amount', {
          where: {
            bill_id,
            status: 'completed'
          }
        });

        const billAmount = parseFloat(bill.total_amount || bill.amount);
        const paidAmount = parseFloat(totalPaid);

        if (paidAmount >= billAmount) {
          await bill.update({ status: 'paid', paid_amount: paidAmount });
        } else if (paidAmount > 0) {
          await bill.update({ status: 'partial', paid_amount: paidAmount });
        } else {
          await bill.update({ paid_amount: paidAmount });
        }

        // Create payment notification
        if (bill.customer) {
          await Notification.create({
            customer_id: bill.customer_id,
            bill_id: bill.id,
            type: 'payment_received',
            title: 'Payment Received',
            message: `Online payment of $${amount.toFixed(2)} has been received for bill ${bill.bill_number}. Receipt: ${receipt_number}`,
            channel: 'both',
            scheduled_at: new Date(),
            isp_id: bill.isp_id
          });

          // Send confirmation email
          if (bill.customer.email) {
            try {
              await sendEmail.sendEmail(
                bill.customer.email,
                'Payment Confirmation',
                `Dear ${bill.customer.name},\n\nYour payment of $${amount.toFixed(2)} has been successfully processed.\nReceipt Number: ${receipt_number}\nTransaction ID: ${paymentIntent.id}\n\nThank you!`
              );
            } catch (error) {
              console.error('Error sending payment confirmation email:', error);
            }
          }
        }

        res.json({
          success: true,
          message: 'Payment processed successfully',
          payment,
          paymentIntent
        });
      } catch (stripeError) {
        console.error('Stripe error:', stripeError);
        res.status(400).json({ message: 'Payment failed', error: stripeError.message });
      }
    } else {
      // If Stripe not configured, create payment record as pending
      const receipt_number = await generateReceiptNumber(bill.isp_id);
      const payment = await Payment.create({
        bill_id,
        customer_id: bill.customer_id,
        amount,
        method: 'online',
        transaction_id: `TXN-${Date.now()}`,
        receipt_number,
        isp_id: bill.isp_id,
        status: 'pending',
        payment_date: new Date()
      });

      res.json({
        success: true,
        message: 'Payment initiated (Stripe not configured)',
        payment
      });
    }
  } catch (error) {
    console.error('Process online payment error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get payment statistics
// @route   GET /api/payments/stats
// @access  Private (Admin, Account Manager)
const getPaymentStats = async (req, res) => {
  try {
    const { start_date = moment().startOf('month').toDate(), end_date = new Date() } = req.query;

    const stats = await Payment.findAll({
      where: {
        isp_id: req.ispId,
        status: 'completed',
        payment_date: {
          [Op.between]: [new Date(start_date), new Date(end_date)]
        }
      },
      attributes: [
        'method',
        [Sequelize.fn('SUM', Sequelize.col('amount')), 'total_amount'],
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
      ],
      group: ['method']
    });

    const totalRevenue = await Payment.sum('amount', {
      where: {
        isp_id: req.ispId,
        status: 'completed',
        payment_date: {
          [Op.between]: [new Date(start_date), new Date(end_date)]
        }
      }
    });

    res.json({
      success: true,
      stats,
      totalRevenue: totalRevenue || 0
    });
  } catch (error) {
    console.error('Get payment stats error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Generate payment receipt PDF
// @route   GET /api/payments/:id/receipt
// @access  Private
const generatePaymentReceipt = async (req, res) => {
  try {
    const payment = await Payment.findOne({
      where: {
        id: req.params.id,
        isp_id: req.ispId
      },
      include: [
        {
          model: Bill,
          as: 'bill',
          attributes: ['id', 'bill_number', 'billing_period_start', 'billing_period_end']
        },
        {
          model: Customer,
          as: 'customer',
          attributes: ['id', 'name', 'email', 'phone']
        }
      ]
    });

    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    // Generate receipt
    const receiptPath = await generateReceipt(payment);

    // Send file
    res.download(receiptPath, `receipt-${payment.receipt_number}.pdf`, (err) => {
      if (err) {
        console.error('Error sending receipt:', err);
        res.status(500).json({ message: 'Error generating receipt' });
      }
    });
  } catch (error) {
    console.error('Generate receipt error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get payment history for logged-in customer
// @route   GET /api/payments/my-payments
// @access  Private (Customer only)
const getMyPayments = async (req, res) => {
  try {
    if (req.user.role !== 'customer') {
      return res.status(403).json({ message: 'Access denied. This endpoint is for customers only.' });
    }

    // Find customer by email or phone
    const customer = await Customer.findOne({
      where: {
        [Op.or]: [
          { email: req.user.email },
          { phone: req.user.email }
        ],
        ...(req.user.isp_id ? { isp_id: req.user.isp_id } : {})
      }
    });

    if (!customer) {
      return res.status(404).json({ 
        message: 'Customer record not found. Please contact support to link your account.' 
      });
    }

    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const payments = await Payment.findAndCountAll({
      where: {
        customer_id: customer.id
      },
      include: [
        {
          model: Bill,
          as: 'bill',
          attributes: ['id', 'bill_number', 'amount', 'total_amount', 'due_date', 'status']
        }
      ],
      order: [['payment_date', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      payments: payments.rows,
      total: payments.count,
      page: parseInt(page),
      pages: Math.ceil(payments.count / limit)
    });
  } catch (error) {
    console.error('Get my payments error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  getPayments,
  getPayment,
  createPayment,
  processOnlinePayment,
  getMyPayments,
  getPaymentStats,
  generatePaymentReceipt
};

