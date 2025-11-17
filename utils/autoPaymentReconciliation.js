/**
 * Auto Payment Reconciliation Utility
 * Automatically matches payments from payment gateways with pending bills
 */

const { Bill, Payment, Customer } = require('../models');
const { Op } = require('sequelize');
const moment = require('moment');
const createActivityLog = require('./activityLogger');

/**
 * Reconcile payment from gateway with customer bills
 * @param {Object} paymentData - Payment data from gateway
 * @param {string} paymentData.transactionId - Transaction ID from gateway
 * @param {string} paymentData.customerEmail - Customer email
 * @param {string} paymentData.customerPhone - Customer phone
 * @param {number} paymentData.amount - Payment amount
 * @param {string} paymentData.method - Payment method
 * @param {Date} paymentData.paymentDate - Payment date
 * @returns {Object} Reconciliation result
 */
const reconcilePayment = async (paymentData) => {
  try {
    const { transactionId, customerEmail, customerPhone, amount, method, paymentDate } = paymentData;

    // Find customer by email or phone
    const customerWhere = {};
    if (customerEmail) {
      customerWhere.email = customerEmail;
    } else if (customerPhone) {
      customerWhere.phone = customerPhone;
    } else {
      throw new Error('Customer email or phone is required');
    }

    const customer = await Customer.findOne({ where: customerWhere });
    if (!customer) {
      return {
        success: false,
        message: 'Customer not found',
        matched: false
      };
    }

    // Check if payment already exists
    const existingPayment = await Payment.findOne({
      where: {
        transaction_id: transactionId
      }
    });

    if (existingPayment) {
      return {
        success: false,
        message: 'Payment already reconciled',
        matched: true,
        payment: existingPayment
      };
    }

    // Find matching unpaid bills (prioritize overdue, then pending)
    const unpaidBills = await Bill.findAll({
      where: {
        customer_id: customer.id,
        status: {
          [Op.in]: ['pending', 'partial', 'overdue']
        }
      },
      order: [
        ['due_date', 'ASC'], // Oldest due date first
        ['status', 'DESC'] // Overdue first
      ]
    });

    if (unpaidBills.length === 0) {
      return {
        success: false,
        message: 'No unpaid bills found for customer',
        matched: false,
        customer: customer
      };
    }

    const paymentAmount = parseFloat(amount);
    let remainingAmount = paymentAmount;
    const matchedBills = [];
    const paymentsCreated = [];

    // Match payment to bills
    for (const bill of unpaidBills) {
      if (remainingAmount <= 0) break;

      const billAmount = parseFloat(bill.total_amount || bill.amount || 0);
      const paidAmount = parseFloat(bill.paid_amount || 0);
      const remainingBillAmount = billAmount - paidAmount;

      if (remainingBillAmount <= 0) continue;

      const paymentForBill = Math.min(remainingAmount, remainingBillAmount);
      const newPaidAmount = paidAmount + paymentForBill;

      // Create payment record
      const payment = await Payment.create({
        bill_id: bill.id,
        customer_id: customer.id,
        amount: paymentForBill,
        method: method || 'online',
        payment_date: paymentDate || new Date(),
        transaction_id: transactionId,
        status: 'completed',
        notes: `Auto-reconciled from gateway`,
        isp_id: customer.isp_id
      });

      paymentsCreated.push(payment);

      // Update bill
      if (newPaidAmount >= billAmount) {
        bill.status = 'paid';
        bill.paid_amount = billAmount;
      } else {
        bill.status = 'partial';
        bill.paid_amount = newPaidAmount;
      }
      await bill.save();

      matchedBills.push({
        bill: bill,
        paymentAmount: paymentForBill
      });

      remainingAmount -= paymentForBill;

      // Log activity
      await createActivityLog({
        user_id: null,
        action: 'auto_payment_reconciled',
        entity_type: 'payment',
        entity_id: payment.id,
        description: `Auto-reconciled payment ${transactionId} for bill ${bill.bill_number}`,
        isp_id: customer.isp_id
      });
    }

    // If there's remaining amount, create a credit or refund record
    if (remainingAmount > 0) {
      // Could create a credit record here
      console.log(`⚠️  Payment amount ${paymentAmount} exceeds bill amount. Remaining: ${remainingAmount}`);
    }

    return {
      success: true,
      message: `Payment reconciled successfully. Matched ${matchedBills.length} bill(s)`,
      matched: true,
      customer: customer,
      bills: matchedBills,
      payments: paymentsCreated,
      remainingAmount: remainingAmount
    };
  } catch (error) {
    console.error('Error in reconcilePayment:', error);
    throw error;
  }
};

/**
 * Batch reconcile payments from gateway
 * @param {Array} payments - Array of payment data
 * @returns {Object} Batch reconciliation result
 */
const batchReconcilePayments = async (payments) => {
  try {
    const results = {
      total: payments.length,
      successful: 0,
      failed: 0,
      alreadyMatched: 0,
      details: []
    };

    for (const paymentData of payments) {
      try {
        const result = await reconcilePayment(paymentData);
        results.details.push(result);

        if (result.success) {
          results.successful++;
        } else if (result.matched) {
          results.alreadyMatched++;
        } else {
          results.failed++;
        }
      } catch (error) {
        console.error('Error reconciling payment:', error);
        results.failed++;
        results.details.push({
          success: false,
          error: error.message,
          paymentData: paymentData
        });
      }
    }

    return results;
  } catch (error) {
    console.error('Error in batchReconcilePayments:', error);
    throw error;
  }
};

/**
 * Auto-reconcile payments from Stripe webhook
 */
const reconcileStripePayment = async (stripeEvent) => {
  try {
    if (stripeEvent.type !== 'payment_intent.succeeded') {
      return { success: false, message: 'Event type not supported' };
    }

    const paymentIntent = stripeEvent.data.object;
    const customerEmail = paymentIntent.receipt_email || paymentIntent.metadata?.customerEmail;
    const customerPhone = paymentIntent.metadata?.customerPhone;
    const amount = paymentIntent.amount / 100; // Convert from cents
    const transactionId = paymentIntent.id;

    return await reconcilePayment({
      transactionId,
      customerEmail,
      customerPhone,
      amount,
      method: 'stripe',
      paymentDate: new Date(paymentIntent.created * 1000)
    });
  } catch (error) {
    console.error('Error in reconcileStripePayment:', error);
    throw error;
  }
};

module.exports = {
  reconcilePayment,
  batchReconcilePayments,
  reconcileStripePayment
};

