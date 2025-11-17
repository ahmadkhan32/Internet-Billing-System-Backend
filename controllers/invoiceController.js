const { Bill, Customer, Package, Payment, ISP, User, Notification } = require('../models');
const { sequelize } = require('../config/db');
const { validationResult } = require('express-validator');
const { Op } = require('sequelize');
const moment = require('moment');
const generateInvoicePDF = require('../utils/generateInvoice');
const createActivityLog = require('../utils/activityLogger');

/**
 * Generate unique invoice number
 * Format: INV-{BUSINESS_ID}-{YYYYMMDD}-{XXXX}
 */
const generateInvoiceNumber = async (ispId) => {
  const isp = await ISP.findByPk(ispId);
  const businessId = isp?.business_id || `ISP${ispId}`;
  const dateStr = moment().format('YYYYMMDD');
  
  // Count invoices for today
  const today = moment().startOf('day');
  const count = await Bill.count({
    where: {
      isp_id: ispId,
      createdAt: {
        [Op.gte]: today.toDate()
      }
    }
  });
  
  const sequence = String(count + 1).padStart(4, '0');
  return `INV-${businessId}-${dateStr}-${sequence}`;
};

/**
 * Auto-generate invoice for a bill
 * This creates/updates invoice with current payment status
 */
const autoGenerateInvoice = async (billId, triggeredBy = 'api') => {
  try {
    const bill = await Bill.findOne({
      where: { id: billId },
      include: [
        {
          model: Customer,
          as: 'customer',
          attributes: ['id', 'name', 'phone', 'email', 'address'],
          required: false
        },
        {
          model: Package,
          as: 'package',
          attributes: ['id', 'name', 'speed', 'price'],
          required: false
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
      throw new Error('Bill not found');
    }

    // Get ISP separately
    const ISP = require('../models/ISP');
    const isp = await ISP.findByPk(bill.isp_id);
    
    if (!isp) {
      throw new Error('ISP not found');
    }

    // Calculate payment totals
    const totalAmount = parseFloat(bill.total_amount || bill.amount || 0);
    const paidAmount = bill.payments
      ? bill.payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0)
      : parseFloat(bill.paid_amount || 0);
    
    const remainingAmount = totalAmount - paidAmount;
    const paymentPercentage = totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0;

    // Determine invoice status
    let invoiceStatus = 'pending';
    if (paidAmount >= totalAmount) {
      invoiceStatus = 'completed';
      // Set completion timestamp if not already set
      if (!bill.completed_at) {
        await bill.update({ completed_at: new Date() });
      }
    } else if (paidAmount > 0) {
      invoiceStatus = 'partial';
    }

    // Update bill status and paid_amount
    await bill.update({
      status: invoiceStatus === 'completed' ? 'paid' : (invoiceStatus === 'partial' ? 'partial' : 'pending'),
      paid_amount: paidAmount
    });

    // Generate PDF invoice
    let pdfPath = null;
    try {
      // Create customer object for PDF (handle null customer for SaaS invoices)
      const customerForPDF = bill.customer || {
        name: isp.name,
        address: isp.address || 'N/A',
        phone: isp.contact || 'N/A',
        email: isp.email || 'N/A'
      };
      
      // Create package object for PDF (handle null package)
      const packageForPDF = bill.package || {
        name: 'Service',
        speed: 'N/A',
        price: bill.total_amount || bill.amount
      };
      
      const { filePath } = await generateInvoicePDF(bill, customerForPDF, packageForPDF, isp);
      pdfPath = filePath;
      console.log(`   📄 Invoice PDF generated: ${filePath}`);
    } catch (error) {
      console.error(`   ⚠️  Error generating PDF:`, error.message);
    }

    // Create notification for customer (if exists)
    if (bill.customer) {
      const customerUser = await User.findOne({
        where: {
          email: bill.customer.email,
          role: 'customer'
        }
      });

      await Notification.create({
        customer_id: bill.customer_id,
        user_id: customerUser ? customerUser.id : null,
        bill_id: bill.id,
        type: invoiceStatus === 'completed' ? 'payment_received' : 'bill_generated',
        title: invoiceStatus === 'completed' 
          ? 'Invoice Completed' 
          : invoiceStatus === 'partial'
          ? 'Partial Payment Received'
          : 'New Invoice Generated',
        message: invoiceStatus === 'completed'
          ? `Invoice ${bill.bill_number} has been fully paid. Thank you!`
          : invoiceStatus === 'partial'
          ? `Partial payment of PKR ${paidAmount.toFixed(2)} received for invoice ${bill.bill_number}. Remaining: PKR ${remainingAmount.toFixed(2)}.`
          : `Invoice ${bill.bill_number} has been generated. Amount: PKR ${totalAmount.toFixed(2)}. Due date: ${moment(bill.due_date).format('MMM DD, YYYY')}.`,
        channel: 'both',
        scheduled_at: new Date(),
        isp_id: bill.isp_id
      });
    }

    // Create activity log
    await createActivityLog(
      null, // user_id (system generated)
      'AUTO_GENERATE_INVOICE',
      'Bill',
      bill.id,
      null,
      {
        invoice_number: bill.bill_number,
        status: invoiceStatus,
        total_amount: totalAmount,
        paid_amount: paidAmount,
        remaining_amount: remainingAmount,
        payment_percentage: paymentPercentage.toFixed(2),
        triggered_by: triggeredBy
      },
      bill.isp_id,
      null,
      null
    );

    return {
      success: true,
      bill: {
        ...bill.toJSON(),
        paidAmount: paidAmount,
        remainingAmount: remainingAmount,
        paymentPercentage: paymentPercentage,
        invoiceStatus,
        pdfPath
      }
    };
  } catch (error) {
    console.error('Auto-generate invoice error:', error);
    throw error;
  }
};

/**
 * @desc    Get all invoices (bills with invoice data)
 * @route   GET /api/invoices
 * @access  Private
 */
const getInvoices = async (req, res) => {
  try {
    const { page = 1, limit = 20, status = '', customer_id = '' } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {};

    // For customers, only show their own invoices
    if (req.user.role === 'customer') {
      const customer = await Customer.findOne({ 
        where: { 
          [Op.or]: [
            { email: req.user.email },
            { phone: req.user.email }
          ],
          ...(req.user.isp_id ? { isp_id: req.user.isp_id } : {})
        }
      });
      
      if (!customer) {
        return res.json({
          success: true,
          invoices: [],
          total: 0,
          page: parseInt(page),
          pages: 0
        });
      }
      
      whereClause.customer_id = customer.id;
    } else if (req.user.role !== 'super_admin') {
      // For staff, filter by ISP
      const ispId = req.tenantId || req.user.isp_id;
      if (ispId) {
        whereClause.isp_id = ispId;
      }
    }

    if (status) {
      whereClause.status = status;
    }

    if (customer_id && req.user.role !== 'customer') {
      whereClause.customer_id = customer_id;
    }

    const bills = await Bill.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Customer,
          as: 'customer',
          attributes: ['id', 'name', 'phone', 'email', 'address']
        },
        {
          model: Package,
          as: 'package',
          attributes: ['id', 'name', 'speed', 'price']
        },
        {
          model: Payment,
          as: 'payments',
          attributes: ['id', 'amount', 'method', 'payment_date', 'receipt_number', 'status'],
          where: { status: 'completed' },
          required: false
        },
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    // Calculate invoice data for each bill
    // First, get all unique ISP IDs
    const ispIds = [...new Set(bills.rows.map(bill => bill.isp_id).filter(Boolean))];
    
    // Fetch all ISPs in one query
    const ISP = require('../models/ISP');
    const isps = await ISP.findAll({
      where: { id: { [Op.in]: ispIds } },
      attributes: ['id', 'business_id']
    });
    
    // Create a map for quick lookup
    const ispMap = new Map(isps.map(isp => [isp.id, isp]));
    
    // Now process bills synchronously
    const invoices = bills.rows.map(bill => {
      const billData = bill.toJSON();
      const totalAmount = parseFloat(billData.total_amount || billData.amount || 0);
      const paidAmount = billData.payments
        ? billData.payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0)
        : parseFloat(billData.paid_amount || 0);
      
      const remainingAmount = totalAmount - paidAmount;
      const paymentPercentage = totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0;

      let invoiceStatus = 'pending';
      if (paidAmount >= totalAmount) {
        invoiceStatus = 'completed';
      } else if (paidAmount > 0) {
        invoiceStatus = 'partial';
      }

      // Get ISP from map
      const isp = ispMap.get(billData.isp_id);
      
      return {
        ...billData,
        invoiceNumber: billData.bill_number,
        invoiceDate: billData.createdAt,
        paidAmount: parseFloat(paidAmount.toFixed(2)),
        remainingAmount: parseFloat(remainingAmount.toFixed(2)),
        paymentPercentage: parseFloat(paymentPercentage.toFixed(2)),
        invoiceStatus,
        completionTimestamp: billData.completed_at,
        businessId: isp?.business_id || null
      };
    });

    res.json({
      success: true,
      invoices,
      total: bills.count,
      page: parseInt(page),
      pages: Math.ceil(bills.count / limit)
    });
  } catch (error) {
    console.error('Get invoices error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * @desc    Get single invoice
 * @route   GET /api/invoices/:id
 * @access  Private
 */
const getInvoice = async (req, res) => {
  try {
    const billWhere = { id: req.params.id };

    if (req.user.role === 'customer') {
      const customer = await Customer.findOne({ 
        where: { 
          [Op.or]: [
            { email: req.user.email },
            { phone: req.user.email }
          ]
        }
      });
      
      if (customer) {
        billWhere.customer_id = customer.id;
      }
    } else if (req.user.role !== 'super_admin') {
      const ispId = req.tenantId || req.user.isp_id;
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
          required: false,
          order: [['payment_date', 'DESC']]
        },
        {
          model: ISP,
          as: 'isp'
        }
      ]
    });

    if (!bill) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    const billData = bill.toJSON();
    const totalAmount = parseFloat(billData.total_amount || billData.amount || 0);
    const paidAmount = billData.payments
      ? billData.payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0)
      : parseFloat(billData.paid_amount || 0);
    
    const remainingAmount = totalAmount - paidAmount;
    const paymentPercentage = totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0;

    let invoiceStatus = 'pending';
    if (paidAmount >= totalAmount) {
      invoiceStatus = 'completed';
    } else if (paidAmount > 0) {
      invoiceStatus = 'partial';
    }

    res.json({
      success: true,
      invoice: {
        ...billData,
        invoiceNumber: billData.bill_number,
        invoiceDate: billData.createdAt,
        paidAmount: parseFloat(paidAmount.toFixed(2)),
        remainingAmount: parseFloat(remainingAmount.toFixed(2)),
        paymentPercentage: parseFloat(paymentPercentage.toFixed(2)),
        invoiceStatus,
        completionTimestamp: billData.completed_at
      }
    });
  } catch (error) {
    console.error('Get invoice error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * @desc    Auto-generate invoice for a bill
 * @route   POST /api/invoices/auto-generate/:billId
 * @access  Private (Admin, Account Manager)
 */
const autoGenerateInvoiceForBill = async (req, res) => {
  try {
    const { billId } = req.params;
    
    const result = await autoGenerateInvoice(billId, 'api');
    
    res.json({
      success: true,
      message: 'Invoice generated successfully',
      invoice: result.bill
    });
  } catch (error) {
    console.error('Auto-generate invoice error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * @desc    Re-generate invoice (create new invoice number and timestamp)
 * @route   POST /api/invoices/:id/regenerate
 * @access  Private (Admin, Account Manager)
 */
const regenerateInvoice = async (req, res) => {
  try {
    const bill = await Bill.findByPk(req.params.id, {
      include: [
        {
          model: Customer,
          as: 'customer',
          required: false
        },
        {
          model: Package,
          as: 'package',
          required: false
        }
      ]
    });

    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    // Get ISP separately
    const ISP = require('../models/ISP');
    const isp = await ISP.findByPk(bill.isp_id);
    
    if (!isp) {
      return res.status(404).json({ message: 'ISP not found' });
    }

    // Generate new invoice number
    const newInvoiceNumber = await generateInvoiceNumber(bill.isp_id);
    
    // Update bill with new invoice number (keep same bill, just update number)
    // Note: This will create a new invoice with updated timestamp
    await bill.update({
      bill_number: newInvoiceNumber,
      updatedAt: new Date() // Update timestamp for regeneration
    });

    // Generate PDF with new invoice number
    const result = await autoGenerateInvoice(bill.id, 'api');

    res.json({
      success: true,
      message: 'Invoice regenerated successfully',
      invoice: result.bill
    });
  } catch (error) {
    console.error('Regenerate invoice error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  getInvoices,
  getInvoice,
  autoGenerateInvoiceForBill,
  regenerateInvoice,
  autoGenerateInvoice // Export for use in payment controller
};

