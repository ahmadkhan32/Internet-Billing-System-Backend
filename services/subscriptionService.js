const { ISP, Notification, SaaSPackage } = require('../models');
const { Op } = require('sequelize');
const moment = require('moment');
const sendEmail = require('../utils/sendEmail');
const { sendBillNotification } = require('../utils/sendEmail');
const { sendBillSMS } = require('../utils/smsService');

/**
 * Check subscription status and handle lifecycle events
 * Called by cron job or n8n automation
 */
const checkSubscriptionStatus = async () => {
  try {
    const today = new Date();
    const threeDaysFromNow = moment(today).add(3, 'days').toDate();

    // Find subscriptions expiring in 3 days
    const expiringSoon = await ISP.findAll({
      where: {
        subscription_status: 'active',
        subscription_end_date: {
          [Op.between]: [today, threeDaysFromNow]
        }
      },
      include: [{
        model: SaaSPackage,
        as: 'saasPackage',
        required: false
      }]
    });

    // Find expired subscriptions
    const expired = await ISP.findAll({
      where: {
        subscription_status: 'active',
        subscription_end_date: {
          [Op.lt]: today
        }
      },
      include: [{
        model: SaaSPackage,
        as: 'saasPackage',
        required: false
      }]
    });

    // Send notifications for expiring soon
    for (const isp of expiringSoon) {
      await sendSubscriptionExpiryWarning(isp);
    }

    // Suspend expired subscriptions
    for (const isp of expired) {
      await suspendBusiness(isp);
    }

    return {
      expiringSoon: expiringSoon.length,
      expired: expired.length,
      suspended: expired.length
    };
  } catch (error) {
    console.error('Error checking subscription status:', error);
    throw error;
  }
};

/**
 * Send expiry warning notification (3 days before)
 */
const sendSubscriptionExpiryWarning = async (isp) => {
  try {
    // Check if notification already sent
    const existingNotification = await Notification.findOne({
      where: {
        isp_id: isp.id,
        type: 'subscription_expiring',
        createdAt: {
          [Op.gte]: moment().subtract(1, 'day').toDate()
        }
      }
    });

    if (existingNotification) {
      return; // Already notified today
    }

    // Create notification
    await Notification.create({
      isp_id: isp.id,
      type: 'subscription_expiring',
      title: 'Subscription Expiring Soon',
      message: `Your subscription will expire on ${moment(isp.subscription_end_date).format('MMM DD, YYYY')}. Please renew to avoid service interruption.`,
      channel: 'both',
      scheduled_at: new Date()
    });

    // Send email to Business Admin
    if (isp.email) {
      const subject = `Subscription Expiring Soon - ${isp.name}`;
      const text = `
        Dear ${isp.name} Admin,
        
        Your subscription will expire on ${moment(isp.subscription_end_date).format('MMM DD, YYYY')}.
        
        Please renew your subscription to avoid service interruption.
        
        Current Package: ${isp.saasPackage?.name || 'N/A'}
        Expiry Date: ${moment(isp.subscription_end_date).format('MMM DD, YYYY')}
        
        Thank you!
      `;

      await sendEmail(isp.email, subject, text);
    }

    console.log(`Expiry warning sent to ISP ${isp.id} (${isp.name})`);
  } catch (error) {
    console.error(`Error sending expiry warning to ISP ${isp.id}:`, error);
  }
};

/**
 * Suspend business when subscription expires
 */
const suspendBusiness = async (isp) => {
  try {
    // Generate subscription end invoice before suspending
    try {
      const { generateSubscriptionEndInvoice } = require('../controllers/automationController');
      await generateSubscriptionEndInvoice(isp.id, 'api');
      console.log(`✅ Auto-generated subscription end invoice for ${isp.name}`);
    } catch (error) {
      console.error(`⚠️  Error generating subscription end invoice:`, error.message);
      // Don't fail suspension if invoice generation fails
    }

    // Update subscription status
    await isp.update({
      subscription_status: 'suspended'
    });

    // Create notification
    await Notification.create({
      isp_id: isp.id,
      type: 'subscription_expired',
      title: 'Subscription Expired - Business Suspended',
      message: `Your subscription has expired. Your business has been suspended. Please renew to reactivate.`,
      channel: 'both',
      scheduled_at: new Date()
    });

    // Send email to Business Admin
    if (isp.email) {
      const subject = `Subscription Expired - ${isp.name} Suspended`;
      const text = `
        Dear ${isp.name} Admin,
        
        Your subscription has expired and your business has been suspended.
        
        To reactivate your account, please renew your subscription.
        
        Expired Date: ${moment(isp.subscription_end_date).format('MMM DD, YYYY')}
        
        A final invoice has been generated for your subscription period.
        Please contact support to renew your subscription.
        
        Thank you!
      `;

      await sendEmail(isp.email, subject, text);
    }

    console.log(`Business ${isp.id} (${isp.name}) suspended due to expired subscription`);
  } catch (error) {
    console.error(`Error suspending business ${isp.id}:`, error);
  }
};

/**
 * Activate subscription when business subscribes
 */
const activateSubscription = async (ispId, packageId, startDate, endDate) => {
  try {
    const isp = await ISP.findByPk(ispId, {
      include: [{
        model: SaaSPackage,
        as: 'saasPackage',
        required: false
      }]
    });

    if (!isp) {
      throw new Error('ISP not found');
    }

    // Update subscription
    await isp.update({
      subscription_status: 'active',
      subscription_start_date: startDate,
      subscription_end_date: endDate,
      saas_package_id: packageId
    });

    // Auto-generate subscription start invoice
    try {
      const { generateSubscriptionInvoice } = require('../controllers/automationController');
      await generateSubscriptionInvoice(ispId, 'api');
      console.log(`✅ Auto-generated subscription start invoice for ${isp.name}`);
    } catch (error) {
      console.error(`⚠️  Error generating subscription start invoice:`, error.message);
      // Don't fail activation if invoice generation fails
    }

    // Create notification
    await Notification.create({
      isp_id: isp.id,
      type: 'subscription_started',
      title: 'Subscription Activated',
      message: `Your subscription has been activated. Your business is now active.`,
      channel: 'both',
      scheduled_at: new Date()
    });

    // Send email to Business Admin
    if (isp.email) {
      const subject = `Subscription Activated - ${isp.name}`;
      const text = `
        Dear ${isp.name} Admin,
        
        Your subscription has been activated successfully!
        
        Package: ${isp.saasPackage?.name || 'N/A'}
        Start Date: ${moment(startDate).format('MMM DD, YYYY')}
        End Date: ${moment(endDate).format('MMM DD, YYYY')}
        
        Your business is now active and you can start managing your customers.
        A subscription invoice has been generated for your records.
        
        Thank you!
      `;

      await sendEmail(isp.email, subject, text);
    }

    console.log(`Subscription activated for ISP ${ispId} (${isp.name})`);
    return isp;
  } catch (error) {
    console.error(`Error activating subscription for ISP ${ispId}:`, error);
    throw error;
  }
};

/**
 * Generate invoice when subscription starts
 */
const generateSubscriptionInvoice = async (isp, packageData) => {
  try {
    // This would integrate with your invoice generation system
    // For now, we'll create a notification
    await Notification.create({
      isp_id: isp.id,
      type: 'invoice_generated',
      title: 'Subscription Invoice Generated',
      message: `Invoice for your subscription has been generated. Amount: ${packageData?.price || 'N/A'}`,
      channel: 'email',
      scheduled_at: new Date()
    });

    console.log(`Invoice notification created for ISP ${isp.id}`);
  } catch (error) {
    console.error(`Error generating subscription invoice for ISP ${isp.id}:`, error);
  }
};

module.exports = {
  checkSubscriptionStatus,
  sendSubscriptionExpiryWarning,
  suspendBusiness,
  activateSubscription,
  generateSubscriptionInvoice
};

