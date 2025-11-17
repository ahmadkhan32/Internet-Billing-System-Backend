const cron = require('node-cron');
const { Customer, Bill, Package, Notification, ISP } = require('../models');
const { Op } = require('sequelize');
const moment = require('moment');
const sendEmail = require('./sendEmail');
const sendSMS = require('./smsService');
const createActivityLog = require('./activityLogger');

/**
 * Generate unique bill number
 */
const generateBillNumber = (ispId, customerId) => {
  const timestamp = Date.now();
  const prefix = `ISP${ispId.toString().padStart(3, '0')}`;
  const customer = customerId.toString().padStart(4, '0');
  return `${prefix}-${customer}-${timestamp}`;
};

/**
 * Generate monthly bills for all active customers
 */
const generateMonthlyBills = async () => {
  try {
    console.log('🔄 Starting monthly bill generation...');
    
    const activeCustomers = await Customer.findAll({
      where: {
        status: 'active',
        package_id: { [Op.ne]: null }
      },
      include: [
        { model: Package, as: 'package' },
        { model: ISP, as: 'isp' }
      ]
    });

    let billsGenerated = 0;
    let billsSkipped = 0;

    for (const customer of activeCustomers) {
      try {
        // Check if bill already exists for current month
        const currentMonthStart = moment().startOf('month').toDate();
        const currentMonthEnd = moment().endOf('month').toDate();

        const existingBill = await Bill.findOne({
          where: {
            customer_id: customer.id,
            billing_period_start: {
              [Op.between]: [currentMonthStart, currentMonthEnd]
            },
            status: { [Op.ne]: 'cancelled' }
          }
        });

        if (existingBill) {
          console.log(`⏭️  Bill already exists for customer ${customer.id} this month`);
          billsSkipped++;
          continue;
        }

        // Calculate bill amount
        const pkg = customer.package;
        if (!pkg) {
          console.log(`⚠️  Customer ${customer.id} has no package assigned`);
          billsSkipped++;
          continue;
        }

        const billAmount = parseFloat(pkg.price);
        const dueDate = moment().add(7, 'days').toDate(); // 7 days from now
        const billingPeriodStart = moment().startOf('month').toDate();
        const billingPeriodEnd = moment().endOf('month').toDate();

        // Create bill
        const bill = await Bill.create({
          bill_number: generateBillNumber(customer.isp_id, customer.id),
          customer_id: customer.id,
          package_id: customer.package_id,
          amount: billAmount,
          total_amount: billAmount, // Will be updated with late fees if overdue
          paid_amount: 0,
          late_fee: 0,
          due_date: dueDate,
          billing_period_start: billingPeriodStart,
          billing_period_end: billingPeriodEnd,
          status: 'pending',
          isp_id: customer.isp_id
        });

        // Update customer's next billing date
        customer.next_billing_date = moment().add(1, 'month').startOf('month').toDate();
        await customer.save();

        // Find customer's user account for notification
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

        // Create notification (will be sent 7 days before due date)
        await Notification.create({
          customer_id: customer.id,
          user_id: customerUser ? customerUser.id : null, // Link to user account if exists
          bill_id: bill.id,
          type: 'bill_generated',
          title: 'New Bill Generated',
          message: `Your monthly bill ${bill.bill_number} has been generated. Amount: PKR ${billAmount.toFixed(2)}. Due date: ${moment(dueDate).format('MMM DD, YYYY')}. You can view and download the invoice from your portal.`,
          channel: 'both',
          scheduled_at: moment().toDate(),
          isp_id: customer.isp_id
        });

        // Send immediate notification
        if (customer.email) {
          try {
            await sendEmail.sendEmail(
              customer.email,
              'New Bill Generated',
              `Dear ${customer.name},\n\nYour monthly bill ${bill.bill_number} has been generated.\nAmount: $${billAmount.toFixed(2)}\nDue Date: ${moment(dueDate).format('MMM DD, YYYY')}\n\nPlease make payment before the due date.`
            );
          } catch (error) {
            console.error(`Error sending email to customer ${customer.id}:`, error);
          }
        }

        if (customer.phone) {
          try {
            await sendSMS(
              customer.phone,
              `New bill ${bill.bill_number} generated. Amount: $${billAmount.toFixed(2)}. Due: ${moment(dueDate).format('MMM DD')}`
            );
          } catch (error) {
            console.error(`Error sending SMS to customer ${customer.id}:`, error);
          }
        }

        billsGenerated++;
        console.log(`✅ Bill generated for customer ${customer.id}: ${bill.bill_number}`);
      } catch (error) {
        console.error(`❌ Error generating bill for customer ${customer.id}:`, error);
      }
    }

    console.log(`✅ Monthly bill generation completed. Generated: ${billsGenerated}, Skipped: ${billsSkipped}`);
    return { billsGenerated, billsSkipped };
  } catch (error) {
    console.error('❌ Error in generateMonthlyBills:', error);
    throw error;
  }
};

/**
 * Send bill reminders (7 days before due date)
 */
const sendBillReminders = async () => {
  try {
    console.log('📧 Sending bill reminders...');
    
    const sevenDaysFromNow = moment().add(7, 'days').toDate();
    const startOfDay = moment(sevenDaysFromNow).startOf('day').toDate();
    const endOfDay = moment(sevenDaysFromNow).endOf('day').toDate();

    const pendingBills = await Bill.findAll({
      where: {
        status: 'pending',
        due_date: {
          [Op.between]: [startOfDay, endOfDay]
        }
      },
      include: [
        {
          model: Customer,
          as: 'customer',
          attributes: ['id', 'name', 'email', 'phone']
        }
      ]
    });

    let remindersSent = 0;

    for (const bill of pendingBills) {
      try {
        const customer = bill.customer;
        if (!customer) continue;

        // Check if reminder already sent
        const existingReminder = await Notification.findOne({
          where: {
            bill_id: bill.id,
            type: 'bill_reminder',
            scheduled_at: {
              [Op.between]: [startOfDay, endOfDay]
            }
          }
        });

        if (existingReminder) {
          continue;
        }

        // Find customer's user account for notification
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

        // Create reminder notification
        const billAmount = parseFloat(bill.total_amount || bill.amount || 0);
        const reminderMessage = `Reminder: Your bill ${bill.bill_number} (PKR ${billAmount.toFixed(2)}) is due on ${moment(bill.due_date).format('MMM DD, YYYY')}. Please make payment to avoid service interruption.`;

        await Notification.create({
          customer_id: customer.id,
          user_id: customerUser ? customerUser.id : null, // Link to user account if exists
          bill_id: bill.id,
          type: 'bill_reminder',
          title: 'Bill Payment Reminder',
          message: reminderMessage,
          channel: 'both',
          scheduled_at: new Date(),
          isp_id: bill.isp_id
        });

        // Send email
        if (customer.email) {
          try {
            await sendEmail.sendEmail(
              customer.email,
              'Bill Payment Reminder',
              `Dear ${customer.name},\n\n${reminderMessage}\n\nThank you!`
            );
          } catch (error) {
            console.error(`Error sending reminder email to customer ${customer.id}:`, error);
          }
        }

        // Send SMS
        if (customer.phone) {
          try {
            await sendSMS(customer.phone, reminderMessage);
          } catch (error) {
            console.error(`Error sending reminder SMS to customer ${customer.id}:`, error);
          }
        }

        remindersSent++;
        console.log(`📧 Reminder sent for bill ${bill.bill_number}`);
      } catch (error) {
        console.error(`Error sending reminder for bill ${bill.id}:`, error);
      }
    }

    console.log(`✅ Bill reminders sent: ${remindersSent}`);
    return remindersSent;
  } catch (error) {
    console.error('❌ Error in sendBillReminders:', error);
    throw error;
  }
};

/**
 * Mark overdue bills and apply late fees
 */
const processOverdueBills = async () => {
  try {
    console.log('⏰ Processing overdue bills...');
    
    const today = moment().startOf('day').toDate();
    
    const overdueBills = await Bill.findAll({
      where: {
        status: 'pending',
        due_date: {
          [Op.lt]: today
        }
      },
      include: [
        {
          model: Customer,
          as: 'customer',
          attributes: ['id', 'name', 'email', 'phone']
        }
      ]
    });

    let processed = 0;
    const lateFeePercentage = 0.05; // 5%

    for (const bill of overdueBills) {
      try {
        // Only apply late fee if not already applied
        if (bill.late_fee === 0 && bill.status === 'pending') {
          const lateFee = bill.amount * lateFeePercentage;
          bill.late_fee = lateFee;
          bill.total_amount = bill.amount + lateFee;
          bill.status = 'overdue';
          await bill.save();

          // Create overdue notification
          await Notification.create({
            customer_id: bill.customer_id,
            bill_id: bill.id,
            type: 'overdue',
            title: 'Bill Overdue',
            message: `Your bill ${bill.bill_number} is now overdue. Late fee of $${lateFee.toFixed(2)} has been applied. Total amount: $${bill.total_amount.toFixed(2)}`,
            channel: 'both',
            scheduled_at: new Date(),
            isp_id: bill.isp_id
          });

          // Send notification
          const customer = bill.customer;
          if (customer?.email) {
            try {
              await sendEmail.sendEmail(
                customer.email,
                'Bill Overdue - Late Fee Applied',
                `Dear ${customer.name},\n\nYour bill ${bill.bill_number} is now overdue. A late fee of $${lateFee.toFixed(2)} has been applied.\n\nTotal amount due: $${bill.total_amount.toFixed(2)}\n\nPlease make payment immediately to avoid service suspension.`
              );
            } catch (error) {
              console.error(`Error sending overdue email to customer ${customer.id}:`, error);
            }
          }

          if (customer?.phone) {
            try {
              await sendSMS(
                customer.phone,
                `Bill ${bill.bill_number} overdue. Late fee: $${lateFee.toFixed(2)}. Total: $${bill.total_amount.toFixed(2)}`
              );
            } catch (error) {
              console.error(`Error sending overdue SMS to customer ${customer.id}:`, error);
            }
          }

          processed++;
          console.log(`⏰ Processed overdue bill ${bill.bill_number}`);
        }
      } catch (error) {
        console.error(`Error processing overdue bill ${bill.id}:`, error);
      }
    }

    console.log(`✅ Processed ${processed} overdue bills`);
    return processed;
  } catch (error) {
    console.error('❌ Error in processOverdueBills:', error);
    throw error;
  }
};

/**
 * Reset monthly data usage for customers
 */
const resetMonthlyDataUsage = async () => {
  try {
    console.log('🔄 Resetting monthly data usage...');
    
    const today = moment().date();
    const customers = await Customer.findAll({
      where: {
        status: 'active'
      }
    });

    let reset = 0;

    for (const customer of customers) {
      try {
        // Reset on the 1st of each month
        if (today === 1) {
          customer.data_usage = 0;
          customer.data_reset_date = new Date();
          await customer.save();
          reset++;
        }
      } catch (error) {
        console.error(`Error resetting data for customer ${customer.id}:`, error);
      }
    }

    console.log(`✅ Reset data usage for ${reset} customers`);
    return reset;
  } catch (error) {
    console.error('❌ Error in resetMonthlyDataUsage:', error);
    throw error;
  }
};

/**
 * Initialize cron jobs
 */
const initializeScheduler = () => {
  // Generate monthly bills on the 1st of each month at 12:00 AM
  cron.schedule('0 0 1 * *', async () => {
    console.log('📅 Scheduled: Monthly bill generation');
    await generateMonthlyBills();
  }, {
    scheduled: true,
    timezone: 'UTC'
  });

  // Send bill reminders daily at 9:00 AM
  cron.schedule('0 9 * * *', async () => {
    console.log('📅 Scheduled: Bill reminders');
    await sendBillReminders();
  }, {
    scheduled: true,
    timezone: 'UTC'
  });

  // Process overdue bills daily at 10:00 AM
  cron.schedule('0 10 * * *', async () => {
    console.log('📅 Scheduled: Process overdue bills');
    await processOverdueBills();
  }, {
    scheduled: true,
    timezone: 'UTC'
  });

  // Reset data usage on the 1st of each month at 12:01 AM
  cron.schedule('1 0 1 * *', async () => {
    console.log('📅 Scheduled: Reset monthly data usage');
    await resetMonthlyDataUsage();
  }, {
    scheduled: true,
    timezone: 'UTC'
  });

  // Auto-suspend customers with overdue bills daily at 11:00 AM
  cron.schedule('0 11 * * *', async () => {
    console.log('📅 Scheduled: Auto-suspend customers');
    const autoSuspension = require('./autoSuspension');
    await autoSuspension.autoSuspendCustomers({ gracePeriodDays: 7 });
  }, {
    scheduled: true,
    timezone: 'UTC'
  });

  // Auto backup daily at 2:00 AM
  cron.schedule('0 2 * * *', async () => {
    console.log('📅 Scheduled: Auto backup');
    const autoBackup = require('./autoBackup');
    try {
      await autoBackup.fullBackup();
    } catch (error) {
      console.error('Error in scheduled backup:', error);
    }
  }, {
    scheduled: true,
    timezone: 'UTC'
  });

  console.log('✅ Monthly scheduler initialized with automation features');
};

module.exports = {
  generateMonthlyBills,
  sendBillReminders,
  processOverdueBills,
  resetMonthlyDataUsage,
  initializeScheduler
};

