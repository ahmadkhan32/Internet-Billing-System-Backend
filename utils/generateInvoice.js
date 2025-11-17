const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const moment = require('moment');

const generateInvoicePDF = async (bill, customer, packageData, isp) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const invoiceDir = path.join(__dirname, '../uploads/invoices');
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(invoiceDir)) {
        fs.mkdirSync(invoiceDir, { recursive: true });
      }

      const fileName = `invoice_${bill.bill_number}_${Date.now()}.pdf`;
      const filePath = path.join(invoiceDir, fileName);
      const stream = fs.createWriteStream(filePath);

      doc.pipe(stream);

      // Header
      doc.fontSize(20).text('INVOICE', { align: 'center' });
      doc.moveDown();

      // ISP Information
      doc.fontSize(12);
      doc.text(isp.name, { align: 'left' });
      if (isp.address) doc.text(isp.address);
      if (isp.contact) doc.text(`Phone: ${isp.contact}`);
      if (isp.email) doc.text(`Email: ${isp.email}`);
      doc.moveDown();

      // Invoice Details
      doc.text(`Invoice Number: ${bill.bill_number}`, { align: 'right' });
      doc.text(`Date: ${moment(bill.createdAt).format('DD/MM/YYYY')}`, { align: 'right' });
      doc.text(`Billing Period: ${moment(bill.billing_period_start).format('DD/MM/YYYY')} - ${moment(bill.billing_period_end).format('DD/MM/YYYY')}`, { align: 'right' });
      doc.text(`Due Date: ${moment(bill.due_date).format('DD/MM/YYYY')}`, { align: 'right' });
      doc.moveDown();

      // Customer Information
      doc.fontSize(14).text('Bill To:', { underline: true });
      doc.fontSize(12);
      doc.text(customer.name);
      doc.text(customer.address);
      doc.text(`Phone: ${customer.phone}`);
      if (customer.email) doc.text(`Email: ${customer.email}`);
      doc.moveDown();

      // Bill Details Table
      doc.fontSize(14).text('Bill Details:', { underline: true });
      doc.moveDown(0.5);

      const tableTop = doc.y;
      doc.fontSize(10);
      
      // Table Header
      doc.text('Description', 50, tableTop);
      doc.text('Amount', 400, tableTop, { align: 'right' });

      // Table Line
      doc.moveTo(50, tableTop + 15)
         .lineTo(550, tableTop + 15)
         .stroke();

      // Table Content
      const itemTop = tableTop + 25;
      const packageDescription = packageData 
        ? `${packageData.name} - ${packageData.speed}${packageData.speed ? ' Mbps' : ''}`
        : 'Internet Service';
      doc.text(packageDescription, 50, itemTop);
      doc.text(`PKR ${parseFloat(bill.total_amount || bill.amount).toFixed(2)}`, 400, itemTop, { align: 'right' });

      // Payment information if paid
      let paymentInfoY = itemTop + 20;
      if (bill.paid_amount && parseFloat(bill.paid_amount) > 0) {
        paymentInfoY += 20;
        doc.text(`Paid Amount: PKR ${parseFloat(bill.paid_amount).toFixed(2)}`, 50, paymentInfoY);
        const remainingAmount = parseFloat(bill.total_amount || bill.amount) - parseFloat(bill.paid_amount);
        if (remainingAmount > 0) {
          paymentInfoY += 15;
          doc.text(`Remaining Balance: PKR ${remainingAmount.toFixed(2)}`, 50, paymentInfoY);
        }
        
        // Show payment details if payments exist
        if (bill.payments && bill.payments.length > 0) {
          paymentInfoY += 20;
          doc.fontSize(12).text('Payment Details:', 50, paymentInfoY, { underline: true });
          paymentInfoY += 15;
          doc.fontSize(10);
          bill.payments.forEach((payment, index) => {
            if (index < 3) { // Show max 3 payments
              paymentInfoY += 15;
              const paymentDate = moment(payment.payment_date).format('DD/MM/YYYY');
              const paymentMethod = payment.method ? payment.method.toUpperCase() : 'N/A';
              doc.text(`${paymentDate} - PKR ${parseFloat(payment.amount).toFixed(2)} (${paymentMethod})`, 50, paymentInfoY);
            }
          });
        }
      }

      // Total Line
      const totalTop = paymentInfoY + 20;
      doc.moveTo(50, totalTop)
         .lineTo(550, totalTop)
         .stroke();

      doc.fontSize(12).text('Total Amount:', 350, totalTop + 10);
      doc.fontSize(14).text(`PKR ${parseFloat(bill.total_amount || bill.amount).toFixed(2)}`, 400, totalTop + 10, { align: 'right' });
      
      // Payment Status
      if (bill.status === 'paid') {
        doc.fontSize(12).fillColor('green').text('✓ PAID', 400, totalTop + 30, { align: 'right' });
        doc.fillColor('black');
      } else if (bill.status === 'partial') {
        doc.fontSize(12).fillColor('orange').text('PARTIAL PAYMENT', 400, totalTop + 30, { align: 'right' });
        doc.fillColor('black');
      } else {
        doc.fontSize(12).fillColor('red').text('PENDING', 400, totalTop + 30, { align: 'right' });
        doc.fillColor('black');
      }

      // Footer
      doc.fontSize(10)
         .text('Thank you for your business!', 50, doc.page.height - 100, { align: 'center' });

      doc.end();

      stream.on('finish', () => {
        resolve({ filePath, fileName });
      });

      stream.on('error', (error) => {
        reject(error);
      });
    } catch (error) {
      reject(error);
    }
  });
};

module.exports = generateInvoicePDF;

