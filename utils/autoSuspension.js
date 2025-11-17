/**
 * Auto Suspension and Reactivation Utility
 * Automatically suspends customers with overdue bills and reactivates after payment
 */

const { Customer, Bill, Payment, Notification } = require('../models');
const { Op } = require('sequelize');
const moment = require('moment');
const sendEmail = require('./sendEmail');
const sendSMS = require('./smsService');
const createActivityLog = require('./activityLogger');

/**
 * Auto-suspend customers with overdue bills
 * @param {Object} options - Suspension options
 * @param {number} options.gracePeriodDays - Days after due date before suspension (default: 7)
 * @param {boolean} options.sendNotification - Send notification before suspension (default: true)
 * @returns {Object} Suspension result
 */
const autoSuspendCustomers = async (options = {}) => {
  try {
    const {
      gracePeriodDays = 7,
      sendNotification = true
    } = options;

    console.log('🚫 Starting auto-suspension process...');

    const suspensionDate = moment().subtract(gracePeriodDays, 'days').toDate();

    // Find customers with overdue bills beyond grace period
    const overdueBills = await Bill.findAll({
      where: {
        status: 'overdue',
        due_date: {
          [Op.lt]: suspensionDate
        }
      },
      include: [
        {
          model: Customer,
          as: 'customer',
          where: {
            status: {
              [Op.in]: ['active', 'inactive']
            }
          }
        }
      ]
    });

    let suspended = 0;
    let alreadySuspended = 0;
    const suspensionDetails = [];

    for (const bill of overdueBills) {
      try {
        const customer = bill.customer;
        if (!customer) continue;

        // Skip if already suspended
        if (customer.status === 'suspended') {
          alreadySuspended++;
          continue;
        }

        // Check if customer has any paid bills in the last 30 days (might be recent payment)
        const recentPayment = await Payment.findOne({
          where: {
            customer_id: customer.id,
            payment_date: {
              [Op.gte]: moment().subtract(30, 'days').toDate()
            },
            status: 'completed'
          },
          include: [
            {
              model: Bill,
              as: 'bill',
              where: {
                status: 'paid'
              }
            }
          ]
        });

        // If recent payment exists, skip suspension (might be processing delay)
        if (recentPayment) {
          console.log(`⏭️  Skipping suspension for customer ${customer.id} - recent payment found`);
          continue;
        }

        // Suspend customer
        customer.status = 'suspended';
        customer.suspended_at = new Date();
        customer.suspension_reason = `Auto-suspended due to overdue bill ${bill.bill_number}`;
        await customer.save();

        // Create notification
        const User = require('../models/User');
        let customerUser = null;
        if (customer.email) {
          customerUser = await User.findOne({
            where: {
              email: customer.email,
              role: 'customer'
            }
          });
        }

        await Notification.create({
          customer_id: customer.id,
          user_id: customerUser ? customerUser.id : null,
          bill_id: bill.id,
          type: 'service_suspended',
          title: 'Service Suspended',
          message: `Your service has been suspended due to overdue bill ${bill.bill_number}. Please make payment to reactivate your service.`,
          channel: 'both',
          scheduled_at: new Date(),
          isp_id: customer.isp_id
        });

        // Send notifications
        if (sendNotification) {
          if (customer.email) {
            try {
              await sendEmail.sendEmail(
                customer.email,
                'Service Suspended - Payment Required',
                `Dear ${customer.name},\n\nYour internet service has been suspended due to overdue bill ${bill.bill_number}.\n\nPlease make payment immediately to reactivate your service.\n\nThank you.`
              );
            } catch (error) {
              console.error(`Error sending suspension email to customer ${customer.id}:`, error);
            }
          }

          if (customer.phone) {
            try {
              await sendSMS(
                customer.phone,
                `Service suspended due to overdue bill ${bill.bill_number}. Please pay to reactivate.`
              );
            } catch (error) {
              console.error(`Error sending suspension SMS to customer ${customer.id}:`, error);
            }
          }
        }

        // Log activity
        await createActivityLog({
          user_id: null,
          action: 'auto_suspend_customer',
          entity_type: 'customer',
          entity_id: customer.id,
          description: `Auto-suspended customer ${customer.name} due to overdue bill ${bill.bill_number}`,
          isp_id: customer.isp_id
        });

        suspended++;
        suspensionDetails.push({
          customer: customer,
          bill: bill
        });

        console.log(`✅ Auto-suspended customer ${customer.id}: ${customer.name}`);
      } catch (error) {
        console.error(`Error suspending customer for bill ${bill.id}:`, error);
      }
    }

    console.log(`✅ Auto-suspension completed. Suspended: ${suspended}, Already suspended: ${alreadySuspended}`);
    return {
      success: true,
      suspended,
      alreadySuspended,
      details: suspensionDetails
    };
  } catch (error) {
    console.error('❌ Error in autoSuspendCustomers:', error);
    throw error;
  }
};

/**
 * Auto-reactivate customers after payment
 * @param {number} customerId - Customer ID
 * @param {number} billId - Bill ID that was paid
 * @returns {Object} Reactivation result
 */
const autoReactivateCustomer = async (customerId, billId) => {
  try {
    const customer = await Customer.findByPk(customerId);
    if (!customer) {
      return {
        success: false,
        message: 'Customer not found'
      };
    }

    // Check if customer is suspended
    if (customer.status !== 'suspended') {
      return {
        success: false,
        message: 'Customer is not suspended',
        customer: customer
      };
    }

    // Check if all overdue bills are paid
    const overdueBills = await Bill.findAll({
      where: {
        customer_id: customerId,
        status: {
          [Op.in]: ['pending', 'partial', 'overdue']
        }
      }
    });

    // Check if any bills are still unpaid
    const hasUnpaidBills = overdueBills.some(bill => {
      const billAmount = parseFloat(bill.total_amount || bill.amount || 0);
      const paidAmount = parseFloat(bill.paid_amount || 0);
      return (billAmount - paidAmount) > 0;
    });

    if (hasUnpaidBills) {
      return {
        success: false,
        message: 'Customer still has unpaid bills',
        unpaidBills: overdueBills.length
      };
    }

    // Reactivate customer
    customer.status = 'active';
    customer.suspended_at = null;
    customer.suspension_reason = null;
    customer.reactivated_at = new Date();
    await customer.save();

    // Create notification
    const User = require('../models/User');
    let customerUser = null;
    if (customer.email) {
      customerUser = await User.findOne({
        where: {
          email: customer.email,
          role: 'customer'
        }
      });
    }

    const bill = await Bill.findByPk(billId);

    await Notification.create({
      customer_id: customer.id,
      user_id: customerUser ? customerUser.id : null,
      bill_id: billId,
      type: 'service_reactivated',
      title: 'Service Reactivated',
      message: `Your service has been reactivated. Thank you for your payment!`,
      channel: 'both',
      scheduled_at: new Date(),
      isp_id: customer.isp_id
    });

    // Send notifications
    if (customer.email) {
      try {
        await sendEmail.sendEmail(
          customer.email,
          'Service Reactivated',
          `Dear ${customer.name},\n\nYour internet service has been reactivated. Thank you for your payment!\n\nYour service is now active and ready to use.`
        );
      } catch (error) {
        console.error(`Error sending reactivation email to customer ${customer.id}:`, error);
      }
    }

    if (customer.phone) {
      try {
        await sendSMS(
          customer.phone,
          `Service reactivated! Thank you for your payment. Your internet is now active.`
        );
      } catch (error) {
        console.error(`Error sending reactivation SMS to customer ${customer.id}:`, error);
      }
    }

    // Log activity
    await createActivityLog({
      user_id: null,
      action: 'auto_reactivate_customer',
      entity_type: 'customer',
      entity_id: customer.id,
      description: `Auto-reactivated customer ${customer.name} after payment`,
      isp_id: customer.isp_id
    });

    console.log(`✅ Auto-reactivated customer ${customer.id}: ${customer.name}`);
    return {
      success: true,
      message: 'Customer reactivated successfully',
      customer: customer
    };
  } catch (error) {
    console.error('❌ Error in autoReactivateCustomer:', error);
    throw error;
  }
};

/**
 * Check and reactivate customers after payment (called from payment controller)
 */
const checkAndReactivateAfterPayment = async (customerId) => {
  try {
    const customer = await Customer.findByPk(customerId);
    if (!customer || customer.status !== 'suspended') {
      return { success: false, message: 'Customer not suspended' };
    }

    // Check all bills
    const allBills = await Bill.findAll({
      where: {
        customer_id: customerId
      }
    });

    // Check if all bills are paid
    const allPaid = allBills.every(bill => {
      if (bill.status === 'cancelled') return true;
      const billAmount = parseFloat(bill.total_amount || bill.amount || 0);
      const paidAmount = parseFloat(bill.paid_amount || 0);
      return (billAmount - paidAmount) <= 0;
    });

    if (allPaid) {
      return await autoReactivateCustomer(customerId, allBills[0]?.id);
    }

    return { success: false, message: 'Customer still has unpaid bills' };
  } catch (error) {
    console.error('Error in checkAndReactivateAfterPayment:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  autoSuspendCustomers,
  autoReactivateCustomer,
  checkAndReactivateAfterPayment
};

