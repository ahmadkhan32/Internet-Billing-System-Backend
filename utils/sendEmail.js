const nodemailer = require('nodemailer');
require('dotenv').config();

// Check if email is configured
const isEmailConfigured = () => {
  return !!(process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS);
};

// Create transporter only if email is configured
let transporter = null;
if (isEmailConfigured()) {
  try {
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT || 587,
      secure: process.env.EMAIL_PORT == 465,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  } catch (error) {
    console.warn('⚠️  Email transporter creation failed:', error.message);
    transporter = null;
  }
}

const sendEmail = async (to, subject, text, html = null) => {
  // Check if email is configured
  if (!isEmailConfigured()) {
    console.log('📧 Email service not configured. Email would be sent to:', to);
    console.log('📧 Subject:', subject);
    console.log('📧 Message:', text.substring(0, 100) + '...');
    return { 
      success: true, 
      message: 'Email service not configured (logged to console)',
      configured: false
    };
  }

  // Check if transporter exists
  if (!transporter) {
    console.log('📧 Email transporter not available. Email would be sent to:', to);
    console.log('📧 Subject:', subject);
    return { 
      success: true, 
      message: 'Email transporter not available (logged to console)',
      configured: false
    };
  }

  try {
    const mailOptions = {
      from: `"Internet Billing System" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
      html: html || text
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId, configured: true };
  } catch (error) {
    console.error('❌ Error sending email:', error.message);
    // Don't throw - return error so caller can handle gracefully
    return { 
      success: false, 
      error: error.message,
      configured: true
    };
  }
};

const sendBillNotification = async (customer, bill) => {
  if (!customer.email) {
    console.log('⚠️  Customer email not found for bill notification');
    return { success: false, error: 'Customer email not found' };
  }

  const subject = `New Bill Generated - ${bill.bill_number}`;
  const text = `
    Dear ${customer.name},
    
    Your new bill has been generated.
    Bill Number: ${bill.bill_number}
    Amount: PKR ${bill.amount}
    Due Date: ${new Date(bill.due_date).toLocaleDateString()}
    
    Please make the payment before the due date to avoid service interruption.
    
    Thank you!
  `;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>New Bill Generated</h2>
      <p>Dear ${customer.name},</p>
      <p>Your new bill has been generated.</p>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>Bill Number:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${bill.bill_number}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>Amount:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">PKR ${bill.amount}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>Due Date:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${new Date(bill.due_date).toLocaleDateString()}</td>
        </tr>
      </table>
      <p>Please make the payment before the due date to avoid service interruption.</p>
      <p>Thank you!</p>
    </div>
  `;

  return await sendEmail(customer.email, subject, text, html);
};

module.exports = { sendEmail, sendBillNotification };

