/**
 * WhatsApp Notification Service
 * Sends notifications via WhatsApp API (Twilio, WhatsApp Business API, etc.)
 */

require('dotenv').config();

let axios = null;
try {
  axios = require('axios');
} catch (e) {
  // axios not installed
}

/**
 * Send WhatsApp message
 * @param {string} phoneNumber - Phone number (with country code)
 * @param {string} message - Message content
 * @returns {Object} Send result
 */
const sendWhatsApp = async (phoneNumber, message) => {
  try {
    // Format phone number (remove + if present, add country code if missing)
    let formattedPhone = phoneNumber.replace(/[^0-9]/g, '');
    
    // If phone doesn't start with country code, add default (Pakistan: 92)
    if (!formattedPhone.startsWith('92') && formattedPhone.length === 10) {
      formattedPhone = '92' + formattedPhone;
    }

    if (!process.env.WHATSAPP_API_KEY || !process.env.WHATSAPP_API_URL) {
      console.log('💬 WhatsApp service not configured. Message would be sent to:', formattedPhone);
      console.log('💬 Message:', message.substring(0, 100) + (message.length > 100 ? '...' : ''));
      return {
        success: true,
        message: 'WhatsApp service not configured (logged to console)',
        configured: false
      };
    }

    if (!axios) {
      console.log('💬 Axios not installed. WhatsApp message would be sent to:', formattedPhone);
      console.log('💬 Message:', message.substring(0, 100) + (message.length > 100 ? '...' : ''));
      return {
        success: true,
        message: 'Axios not installed (logged to console)',
        configured: false
      };
    }

    // Example WhatsApp API integration (Twilio WhatsApp, WhatsApp Business API, etc.)
    // Adjust based on your provider
    const response = await axios.post(process.env.WHATSAPP_API_URL, {
      api_key: process.env.WHATSAPP_API_KEY,
      to: formattedPhone,
      message: message,
      type: 'text'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.WHATSAPP_API_KEY}`
      }
    });

    console.log('✅ WhatsApp message sent successfully');
    return {
      success: true,
      data: response.data,
      configured: true
    };
  } catch (error) {
    console.error('❌ Error sending WhatsApp message:', error.message);
    return {
      success: false,
      error: error.message,
      configured: true
    };
  }
};

/**
 * Send bill notification via WhatsApp
 */
const sendBillWhatsApp = async (customer, bill) => {
  const message = `📋 *Bill Notification*\n\nDear ${customer.name},\n\nYour bill *${bill.bill_number}* has been generated.\n\n💰 Amount: PKR ${parseFloat(bill.total_amount || bill.amount).toFixed(2)}\n📅 Due Date: ${new Date(bill.due_date).toLocaleDateString()}\n\nPlease make payment before the due date to avoid service interruption.\n\nThank you!`;
  
  if (customer.phone) {
    return await sendWhatsApp(customer.phone, message);
  }
  return { success: false, error: 'Customer phone not found' };
};

/**
 * Send payment confirmation via WhatsApp
 */
const sendPaymentConfirmationWhatsApp = async (customer, payment, bill) => {
  const message = `✅ *Payment Confirmed*\n\nDear ${customer.name},\n\nYour payment has been received successfully!\n\n💰 Amount: PKR ${parseFloat(payment.amount).toFixed(2)}\n📋 Bill: ${bill.bill_number}\n📅 Date: ${new Date(payment.payment_date).toLocaleDateString()}\n\nReceipt Number: ${payment.receipt_number || 'N/A'}\n\nThank you for your payment!`;
  
  if (customer.phone) {
    return await sendWhatsApp(customer.phone, message);
  }
  return { success: false, error: 'Customer phone not found' };
};

/**
 * Send service suspension notification via WhatsApp
 */
const sendSuspensionWhatsApp = async (customer, bill) => {
  const message = `⚠️ *Service Suspended*\n\nDear ${customer.name},\n\nYour internet service has been suspended due to overdue bill *${bill.bill_number}*.\n\n💰 Amount Due: PKR ${parseFloat(bill.total_amount || bill.amount).toFixed(2)}\n\nPlease make payment immediately to reactivate your service.\n\nThank you!`;
  
  if (customer.phone) {
    return await sendWhatsApp(customer.phone, message);
  }
  return { success: false, error: 'Customer phone not found' };
};

/**
 * Send service reactivation notification via WhatsApp
 */
const sendReactivationWhatsApp = async (customer) => {
  const message = `✅ *Service Reactivated*\n\nDear ${customer.name},\n\nYour internet service has been reactivated!\n\nThank you for your payment. Your service is now active and ready to use.\n\nIf you have any questions, please contact our support team.`;
  
  if (customer.phone) {
    return await sendWhatsApp(customer.phone, message);
  }
  return { success: false, error: 'Customer phone not found' };
};

module.exports = {
  sendWhatsApp,
  sendBillWhatsApp,
  sendPaymentConfirmationWhatsApp,
  sendSuspensionWhatsApp,
  sendReactivationWhatsApp
};

