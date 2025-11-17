const { Bill, Customer, Package, Payment } = require('../models');
const { validationResult } = require('express-validator');
const { Op } = require('sequelize');
const moment = require('moment');
const generateInvoicePDF = require('../utils/generateInvoice');
const { sendBillNotification } = require('../utils/sendEmail');
const { sendBillSMS } = require('../utils/smsService');

// Generate unique bill number
const generateBillNumber = async (ispId) => {
  if (!ispId) {
    // Fallback for cases where ISP ID is not available
    const prefix = 'BILL-';
    const year = new Date().getFullYear();
    const count = await Bill.count({
      where: {
        createdAt: {
          [Op.gte]: new Date(`${year}-01-01`)
        }
      }
    });
    return `${prefix}${year}-${String(count + 1).padStart(6, '0')}`;
  }
  
  const prefix = `ISP${ispId}-`;
  const year = new Date().getFullYear();
  const count = await Bill.count({
    where: {
      isp_id: ispId,
      createdAt: {
        [Op.gte]: new Date(`${year}-01-01`)
      }
    }
  });
  return `${prefix}${year}-${String(count + 1).padStart(6, '0')}`;
};

// @desc    Get all bills
// @route   GET /api/bills
// @access  Private (Customers see their own bills, Admins see their ISP's bills)
const getBills = async (req, res) => {
  try {
    const { page = 1, limit = 10, status = '', customer_id = '', start_date = '', end_date = '' } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {};

    // For customers, only show their own bills
    if (req.user.role === 'customer') {
      // Find customer record by user email or by user's isp_id
      const customer = await Customer.findOne({ 
        where: { 
          [Op.or]: [
            { email: req.user.email },
            { phone: req.user.email } // Fallback: some systems use phone as identifier
          ],
          ...(req.user.isp_id ? { isp_id: req.user.isp_id } : {})
        }
      });
      
      if (!customer) {
        // If no customer found, return empty list (customer might not have customer record yet)
        return res.json({
          success: true,
          bills: [],
          total: 0,
          page: parseInt(page),
          pages: 0,
          message: 'No customer record found. Please contact support to link your account.'
        });
      }
      
      whereClause.customer_id = customer.id;
    } else if (req.user.role !== 'super_admin') {
      // For staff, filter by ISP
      // req.ispId is set by middleware, but if null, use req.user.isp_id
      const ispId = req.ispId || req.user.isp_id;
      if (ispId) {
        whereClause.isp_id = ispId;
      } else {
        return res.status(400).json({ 
          message: 'Your account is not associated with an ISP. Please contact your administrator.' 
        });
      }
    }
    // For super_admin, no ISP filter (can see all bills)

    if (status) {
      whereClause.status = status;
    }

    if (customer_id && req.user.role !== 'customer') {
      whereClause.customer_id = customer_id;
    }

    if (start_date && end_date) {
      whereClause.createdAt = {
        [Op.between]: [new Date(start_date), new Date(end_date)]
      };
    }

    const bills = await Bill.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Customer,
          as: 'customer',
          attributes: ['id', 'name', 'phone', 'email']
        },
        {
          model: Package,
          as: 'package',
          attributes: ['id', 'name', 'speed', 'price']
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      bills: bills.rows,
      total: bills.count,
      page: parseInt(page),
      pages: Math.ceil(bills.count / limit)
    });
  } catch (error) {
    console.error('Get bills error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get single bill
// @route   GET /api/bills/:id
// @access  Private (Customers can access their own bills, Admins can access their ISP's bills)
const getBill = async (req, res) => {
  try {
    const billWhere = { id: req.params.id };

    // For customers, we'll verify ownership after fetching
    if (req.user.role !== 'customer' && req.user.role !== 'super_admin') {
      const ispId = req.ispId || req.user.isp_id;
      if (ispId) {
        billWhere.isp_id = ispId;
      }
    }

    const bill = await Bill.findOne({
      where: billWhere,
      include: [
        {
          model: Customer,
          as: 'customer',
          attributes: ['id', 'name', 'phone', 'email', 'address']
        },
        {
          model: Package,
          as: 'package',
          attributes: ['id', 'name', 'speed', 'price', 'duration']
        },
        {
          model: Payment,
          as: 'payments',
          order: [['payment_date', 'DESC']]
        }
      ]
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

    // Calculate paid amount
    const paidAmount = bill.payments
      ? bill.payments
      .filter(p => p.status === 'completed')
          .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0)
      : 0;

    const remainingAmount = parseFloat(bill.total_amount || bill.amount || 0) - paidAmount;

    res.json({
      success: true,
      bill: {
        ...bill.toJSON(),
        paidAmount,
        remainingAmount
      }
    });
  } catch (error) {
    console.error('Get bill error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Create bill
// @route   POST /api/bills
// @access  Private (Admin, Account Manager)
const createBill = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { customer_id, package_id, amount, due_date, billing_period_start, billing_period_end, notes } = req.body;

    // Verify customer exists and belongs to ISP
    // For super_admin, don't filter by isp_id; for others, use req.ispId
    const customerWhere = { id: customer_id };
    if (req.user.role !== 'super_admin') {
      const ispId = req.ispId || req.user.isp_id;
      if (ispId) {
        customerWhere.isp_id = ispId;
      }
    }

    const customer = await Customer.findOne({
      where: customerWhere,
      include: [{ model: Package, as: 'package' }]
    });

    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    // Get customer's ISP ID (required for bill creation)
    const customerIspId = customer.isp_id;
    if (!customerIspId) {
      return res.status(400).json({ message: 'Customer must be associated with an ISP' });
    }

    // For non-super-admin, verify customer belongs to their ISP
    if (req.user.role !== 'super_admin') {
      const ispId = req.ispId || req.user.isp_id;
      if (ispId && customerIspId !== ispId) {
        return res.status(403).json({ message: 'Access denied - customer does not belong to your ISP' });
      }
    }

    // Get package details
    // Package is required - either from form or customer's existing package
    let packageData = null;
    
    if (package_id) {
      // Package selected in form
      const packageWhere = { id: package_id };
      if (req.user.role !== 'super_admin') {
        const ispId = req.ispId || req.user.isp_id;
        if (ispId) {
          packageWhere.isp_id = ispId;
        }
      }
      packageData = await Package.findOne({ where: packageWhere });
    } else {
      // Use customer's existing package
      packageData = customer.package;
    }

    if (!packageData) {
      return res.status(400).json({ 
        message: 'Package is required. Please select a package for this customer or assign one to the customer first.' 
      });
    }

    // Generate bill number using customer's ISP ID
    const bill_number = await generateBillNumber(customerIspId);

    // Calculate dates - handle string dates properly
    let periodStart, periodEnd, dueDate;
    
    try {
      periodStart = billing_period_start 
        ? (typeof billing_period_start === 'string' ? new Date(billing_period_start) : billing_period_start)
        : new Date();
      
      if (billing_period_end) {
        periodEnd = typeof billing_period_end === 'string' ? new Date(billing_period_end) : billing_period_end;
      } else {
        periodEnd = moment(periodStart).add(customer.billing_cycle || 1, 'months').toDate();
      }
      
      if (due_date) {
        dueDate = typeof due_date === 'string' ? new Date(due_date) : due_date;
      } else {
        dueDate = moment(periodEnd).add(7, 'days').toDate();
      }
    } catch (dateError) {
      console.error('Date parsing error:', dateError);
      return res.status(400).json({ message: 'Invalid date format. Please check billing period and due date.' });
    }

    // Use package price if amount not provided
    const billAmount = amount || packageData.price;

    const bill = await Bill.create({
      bill_number,
      customer_id,
      package_id: package_id || customer.package_id,
      amount: billAmount,
      total_amount: billAmount, // Total amount (will include late fees if overdue)
      paid_amount: 0, // No payment yet
      late_fee: 0, // No late fee initially
      due_date: dueDate,
      billing_period_start: periodStart,
      billing_period_end: periodEnd,
      notes,
      isp_id: customerIspId,
      status: 'pending'
    });

    // Update customer's package if a new package is assigned
    if (package_id && package_id !== customer.package_id) {
      await customer.update({
        package_id: package_id,
        next_billing_date: moment(periodEnd).add(1, 'day').toDate()
      });
    } else {
    // Update customer's next billing date
    await customer.update({
      next_billing_date: moment(periodEnd).add(1, 'day').toDate()
      });
    }

    // Create notification for customer portal
    // Link notification to both customer record and user account (if exists)
    const Notification = require('../models/Notification');
    const User = require('../models/User');
    
    // Find customer's user account by email
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
      user_id: customerUser ? customerUser.id : null, // Link to user account if exists
      bill_id: bill.id,
      type: 'bill_generated',
      title: 'New Bill Generated',
      message: `Your bill ${bill_number} has been generated. Amount: PKR ${billAmount.toFixed(2)}. Due date: ${moment(dueDate).format('MMM DD, YYYY')}. You can view and download the invoice from your portal.`,
      channel: 'both',
      scheduled_at: new Date(),
      isp_id: customerIspId
    }).catch((error) => {
      console.error('Error creating notification:', error);
      // Don't fail bill creation if notification fails
    });

    // Send notifications (async, don't wait)
    sendBillNotification(customer, bill)
      .then(result => {
        if (!result.configured) {
          console.log('ℹ️  Email notification logged to console (service not configured)');
        }
      })
      .catch(error => {
        console.error('Error sending email notification:', error.message);
      });
    
    sendBillSMS(customer, bill)
      .then(result => {
        if (!result.configured) {
          console.log('ℹ️  SMS notification logged to console (service not configured)');
        }
      })
      .catch(error => {
        console.error('Error sending SMS notification:', error.message);
      });

    res.status(201).json({
      success: true,
      message: 'Bill created successfully',
      bill
    });
  } catch (error) {
    console.error('Create bill error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// @desc    Auto-generate bills for all active customers
// @route   POST /api/bills/auto-generate
// @access  Private (Admin, Account Manager)
const autoGenerateBills = async (req, res) => {
  try {
    const today = new Date();
    const whereClause = {
        status: 'active',
        next_billing_date: {
          [Op.lte]: today
        }
    };
    
    // Super admin can generate for all ISPs or filter by isp_id
    if (req.user.role !== 'super_admin') {
      const ispId = req.ispId || req.user.isp_id;
      if (!ispId) {
        return res.status(400).json({ 
          message: 'Your account is not associated with an ISP. Please contact your administrator.' 
        });
      }
      whereClause.isp_id = ispId;
    } else if (req.query.isp_id) {
      // Super admin can filter by ISP
      whereClause.isp_id = req.query.isp_id;
    }
    
    const customers = await Customer.findAll({
      where: whereClause,
      include: [{ model: Package, as: 'package' }]
    });

    const generatedBills = [];

    for (const customer of customers) {
      if (!customer.package) continue;

      const periodStart = customer.next_billing_date || new Date();
      const periodEnd = moment(periodStart).add(customer.billing_cycle || 1, 'months').toDate();
      const dueDate = moment(periodEnd).add(7, 'days').toDate();

      const ispId = req.ispId || req.user.isp_id || customer.isp_id;
      const bill_number = await generateBillNumber(ispId);

      const billAmount = parseFloat(customer.package.price);

      const bill = await Bill.create({
        bill_number,
        customer_id: customer.id,
        package_id: customer.package_id,
        amount: billAmount,
        total_amount: billAmount, // Total amount (will include late fees if overdue)
        paid_amount: 0, // No payment yet
        late_fee: 0, // No late fee initially
        due_date: dueDate,
        billing_period_start: periodStart,
        billing_period_end: periodEnd,
        isp_id: ispId,
        status: 'pending'
      });

      await customer.update({
        next_billing_date: moment(periodEnd).add(1, 'day').toDate()
      });

      generatedBills.push(bill);

      // Send notifications (async, don't wait)
      sendBillNotification(customer, bill)
        .then(result => {
          if (!result.configured) {
            console.log('ℹ️  Email notification logged to console (service not configured)');
          }
        })
        .catch(error => {
          console.error('Error sending email notification:', error.message);
        });
      
      sendBillSMS(customer, bill)
        .then(result => {
          if (!result.configured) {
            console.log('ℹ️  SMS notification logged to console (service not configured)');
          }
        })
        .catch(error => {
          console.error('Error sending SMS notification:', error.message);
        });
    }

    res.json({
      success: true,
      message: `Generated ${generatedBills.length} bills`,
      bills: generatedBills
    });
  } catch (error) {
    console.error('Auto-generate bills error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Generate invoice PDF
// @route   GET /api/bills/:id/invoice
// @access  Private (Customers can access their own bills, Admins can access their ISP's bills)
const generateInvoice = async (req, res) => {
  try {
    // Find bill - customers can only access their own bills
    const billWhere = { id: req.params.id };
    if (req.user.role === 'customer') {
      // For customers, verify they own this bill through customer_id
      // We'll check this after fetching the bill
    } else if (req.user.role !== 'super_admin') {
      // For staff, filter by ISP
      const ispId = req.ispId || req.user.isp_id;
      if (ispId) {
        billWhere.isp_id = ispId;
      }
    }

    const bill = await Bill.findOne({
      where: billWhere,
      include: [
        {
          model: Customer,
          as: 'customer'
        },
        {
          model: Package,
          as: 'package'
        },
        {
          model: Payment,
          as: 'payments',
          attributes: ['id', 'amount', 'method', 'payment_date', 'receipt_number', 'status'],
          where: { status: 'completed' },
          required: false
        }
      ]
    });

    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    // For customers, verify they own this bill
    if (req.user.role === 'customer') {
      // Get customer ID from user's customer record
      const customer = await Customer.findOne({ 
        where: { 
          [Op.or]: [
            { email: req.user.email },
            { phone: req.user.email }
          ],
          ...(req.user.isp_id ? { isp_id: req.user.isp_id } : {})
        }
      });
      
      if (!customer || bill.customer_id !== customer.id) {
        return res.status(403).json({ message: 'Access denied - this bill does not belong to you' });
      }
    }

    // Get ISP information from bill's ISP ID
    const ISP = require('../models/ISP');
    const isp = await ISP.findByPk(bill.isp_id);

    if (!isp) {
      return res.status(404).json({ message: 'ISP information not found' });
    }

    // Generate PDF invoice
    const { filePath, fileName } = await generateInvoicePDF(bill, bill.customer, bill.package, isp);

    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    res.download(filePath, fileName, (err) => {
      if (err) {
        console.error('Error downloading invoice:', err);
        if (!res.headersSent) {
          res.status(500).json({ message: 'Error downloading invoice', error: err.message });
        }
      }
      // Clean up file after download (optional - you may want to keep files)
      // fs.unlink(filePath, (unlinkErr) => {
      //   if (unlinkErr) console.error('Error deleting invoice file:', unlinkErr);
      // });
    });
  } catch (error) {
    console.error('Generate invoice error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      message: 'Server error generating invoice', 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// @desc    Update bill
// @route   PUT /api/bills/:id
// @access  Private (Admin, Account Manager)
const updateBill = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const whereClause = { id: req.params.id };
    
    // Super admin can update any bill, others only their ISP's
    if (req.user.role !== 'super_admin') {
      const ispId = req.ispId || req.user.isp_id;
      if (ispId) {
        whereClause.isp_id = ispId;
      }
    }

    const bill = await Bill.findOne({
      where: whereClause
    });

    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    const { amount, due_date, status, notes, billing_period_start, billing_period_end } = req.body;

    await bill.update({
      amount: amount !== undefined ? amount : bill.amount,
      due_date: due_date || bill.due_date,
      status: status || bill.status,
      notes: notes !== undefined ? notes : bill.notes,
      billing_period_start: billing_period_start || bill.billing_period_start,
      billing_period_end: billing_period_end || bill.billing_period_end
    });

    res.json({
      success: true,
      message: 'Bill updated successfully',
      bill
    });
  } catch (error) {
    console.error('Update bill error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Update bill status
// @route   PUT /api/bills/:id/status
// @access  Private (Admin, Account Manager)
const updateBillStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const whereClause = { id: req.params.id };
    
    // Super admin can update any bill, others only their ISP's
    if (req.user.role !== 'super_admin') {
      const ispId = req.ispId || req.user.isp_id;
      if (ispId) {
        whereClause.isp_id = ispId;
      }
    }

    const bill = await Bill.findOne({
      where: whereClause
    });

    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    await bill.update({ status });

    res.json({
      success: true,
      message: 'Bill status updated successfully',
      bill
    });
  } catch (error) {
    console.error('Update bill status error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Delete bill
// @route   DELETE /api/bills/:id
// @access  Private (Admin only)
const deleteBill = async (req, res) => {
  try {
    const whereClause = { id: req.params.id };
    
    // Super admin can delete any bill, others only their ISP's
    if (req.user.role !== 'super_admin') {
      const ispId = req.ispId || req.user.isp_id;
      if (ispId) {
        whereClause.isp_id = ispId;
      }
    }
    
    const bill = await Bill.findOne({
      where: whereClause,
      include: [{ model: Payment, as: 'payments' }]
    });

    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    // Check if bill has payments
    if (bill.payments && bill.payments.length > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete bill with existing payments. Please delete payments first.' 
      });
    }

    await bill.destroy();

    res.json({
      success: true,
      message: 'Bill deleted successfully'
    });
  } catch (error) {
    console.error('Delete bill error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  getBills,
  getBill,
  createBill,
  updateBill,
  autoGenerateBills,
  generateInvoice,
  updateBillStatus,
  deleteBill
};

