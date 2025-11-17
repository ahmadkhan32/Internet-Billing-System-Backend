require('dotenv').config();

// Note: Install axios if you plan to use SMS service
// npm install axios
let axios = null;
try {
  axios = require('axios');
} catch (e) {
  // axios not installed, will use console logging
}

const sendSMS = async (phoneNumber, message) => {
  try {
    // This is a generic SMS service implementation
    // You'll need to integrate with your SMS provider's API (JazzCash, Twilio, etc.)
    
    if (!process.env.SMS_API_KEY || !process.env.SMS_API_URL) {
      console.log('📱 SMS service not configured. SMS would be sent to:', phoneNumber);
      console.log('📱 Message:', message.substring(0, 100) + (message.length > 100 ? '...' : ''));
      return { 
        success: true, 
        message: 'SMS service not configured (logged to console)',
        configured: false
      };
    }

    if (!axios) {
      console.log('📱 Axios not installed. SMS would be sent to:', phoneNumber);
      console.log('📱 Message:', message.substring(0, 100) + (message.length > 100 ? '...' : ''));
      return { 
        success: true, 
        message: 'Axios not installed (logged to console)',
        configured: false
      };
    }

    // Example SMS API integration (adjust based on your provider)
    const response = await axios.post(process.env.SMS_API_URL, {
      api_key: process.env.SMS_API_KEY,
      phone: phoneNumber,
      message: message
    });

    console.log('✅ SMS sent successfully');
    return { success: true, data: response.data, configured: true };
  } catch (error) {
    console.error('❌ Error sending SMS:', error.message);
    return { 
      success: false, 
      error: error.message,
      configured: true
    };
  }
};

const sendBillSMS = async (customer, bill) => {
  const message = `Dear ${customer.name}, your bill ${bill.bill_number} of PKR ${bill.amount} is due on ${new Date(bill.due_date).toLocaleDateString()}. Please pay to avoid service interruption.`;
  
  if (customer.phone) {
    return await sendSMS(customer.phone, message);
  }
  return { success: false, error: 'Customer phone not found' };
};

module.exports = sendSMS;
module.exports.sendSMS = sendSMS;
module.exports.sendBillSMS = sendBillSMS;
