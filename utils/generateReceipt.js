const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * Generate PDF receipt for payment
 * @param {object} payment - Payment object with related data
 * @param {string} outputPath - Path to save the receipt
 * @returns {Promise<string>} - Path to the generated receipt
 */
const generateReceipt = async (payment, outputPath = null) => {
  return new Promise((resolve, reject) => {
    try {
      // Create uploads directory if it doesn't exist
      const uploadsDir = path.join(__dirname, '../uploads/receipts');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const filename = `receipt-${payment.receipt_number}-${Date.now()}.pdf`;
      const filepath = outputPath || path.join(uploadsDir, filename);

      const doc = new PDFDocument({ margin: 50 });

      // Pipe PDF to file
      const stream = fs.createWriteStream(filepath);
      doc.pipe(stream);

      // Header
      doc.fontSize(24).font('Helvetica-Bold').text('PAYMENT RECEIPT', { align: 'center' });
      doc.moveDown();

      // Receipt details
      doc.fontSize(12).font('Helvetica');
      doc.text(`Receipt Number: ${payment.receipt_number}`, { align: 'left' });
      doc.text(`Date: ${new Date(payment.payment_date).toLocaleDateString()}`, { align: 'left' });
      doc.text(`Time: ${new Date(payment.payment_date).toLocaleTimeString()}`, { align: 'left' });
      doc.moveDown();

      // Customer information
      if (payment.customer) {
        doc.fontSize(14).font('Helvetica-Bold').text('Customer Information', { underline: true });
        doc.fontSize(12).font('Helvetica');
        doc.text(`Name: ${payment.customer.name}`);
        if (payment.customer.email) {
          doc.text(`Email: ${payment.customer.email}`);
        }
        if (payment.customer.phone) {
          doc.text(`Phone: ${payment.customer.phone}`);
        }
        doc.moveDown();
      }

      // Payment details
      doc.fontSize(14).font('Helvetica-Bold').text('Payment Details', { underline: true });
      doc.fontSize(12).font('Helvetica');
      
      if (payment.bill) {
        doc.text(`Bill Number: ${payment.bill.bill_number}`);
        doc.text(`Billing Period: ${new Date(payment.bill.billing_period_start).toLocaleDateString()} - ${new Date(payment.bill.billing_period_end).toLocaleDateString()}`);
      }
      
      doc.text(`Amount Paid: PKR ${parseFloat(payment.amount).toFixed(2)}`);
      doc.text(`Payment Method: ${payment.method.toUpperCase()}`);
      
      if (payment.transaction_id) {
        doc.text(`Transaction ID: ${payment.transaction_id}`);
      }
      
      doc.text(`Status: ${payment.status.toUpperCase()}`);
      doc.moveDown();

      // Footer
      doc.fontSize(10).font('Helvetica-Oblique');
      doc.text('This is a computer-generated receipt. No signature required.', { align: 'center' });
      doc.moveDown();
      doc.text('Thank you for your payment!', { align: 'center' });

      // Finalize PDF
      doc.end();

      stream.on('finish', () => {
        resolve(filepath);
      });

      stream.on('error', (error) => {
        reject(error);
      });
    } catch (error) {
      reject(error);
    }
  });
};

module.exports = generateReceipt;

