const { Customer, Package, ISP, Bill } = require('../models');
const { validationResult } = require('express-validator');
const { Op } = require('sequelize');

// @desc    Get all customers
// @route   GET /api/customers
// @access  Private (Admin, Account Manager, Technical Officer, Recovery Officer)
const getCustomers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', status = '' } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {};
    
    // Super admin can see all customers, others see only their ISP's customers
    if (req.user.role !== 'super_admin') {
      // req.ispId is set by middleware, but if null, use req.user.isp_id
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
    // If super_admin and no isp_id filter, show all customers

    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { phone: { [Op.like]: `%${search}%` } }
      ];
    }

    if (status) {
      whereClause.status = status;
    }

    const customers = await Customer.findAndCountAll({
      where: whereClause,
      include: [
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
      customers: customers.rows,
      total: customers.count,
      page: parseInt(page),
      pages: Math.ceil(customers.count / limit)
    });
  } catch (error) {
    console.error('Get customers error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get single customer
// @route   GET /api/customers/:id
// @access  Private
const getCustomer = async (req, res) => {
  try {
    const whereClause = { id: req.params.id };
    
    // Super admin can access any customer, others only their ISP's
    if (req.user.role !== 'super_admin') {
      const ispId = req.ispId || req.user.isp_id;
      if (!ispId) {
        return res.status(400).json({ 
          message: 'Your account is not associated with an ISP. Please contact your administrator.' 
        });
      }
      whereClause.isp_id = ispId;
    }
    
    const customer = await Customer.findOne({
      where: whereClause,
      include: [
        {
          model: Package,
          as: 'package',
          attributes: ['id', 'name', 'speed', 'price', 'duration']
        },
        {
          model: Bill,
          as: 'bills',
          limit: 10,
          order: [['createdAt', 'DESC']]
        }
      ]
    });

    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    res.json({
      success: true,
      customer
    });
  } catch (error) {
    console.error('Get customer error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Create customer
// @route   POST /api/customers
// @access  Private (Admin, Account Manager)
const createCustomer = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, phone, address, cnic, package_id, connection_date, billing_cycle, isp_id } = req.body;

    // Determine ISP ID
    let ispId;
    if (req.user.role === 'super_admin') {
      // Super admin can specify isp_id or use their own, or must provide one
      ispId = isp_id || req.user.isp_id || req.ispId;
      if (!ispId) {
        return res.status(400).json({ 
          message: 'ISP ID is required. Please specify an ISP for this customer.' 
        });
      }
    } else {
      // Non-super-admin users must have an ISP
      // req.ispId is set by middleware, but if null, use req.user.isp_id
      ispId = req.ispId || req.user.isp_id;
      if (!ispId) {
        return res.status(400).json({ 
          message: 'Your account is not associated with an ISP. Please contact your administrator.' 
        });
      }
    }

    // Check if customer with same phone or CNIC exists (within the same ISP)
    const existingCustomer = await Customer.findOne({
      where: {
        [Op.or]: [
          { phone, isp_id: ispId },
          ...(cnic ? [{ cnic, isp_id: ispId }] : [])
        ]
      }
    });

    if (existingCustomer) {
      return res.status(400).json({ message: 'Customer with this phone or CNIC already exists in this ISP' });
    }

    const customer = await Customer.create({
      name,
      email,
      phone,
      address,
      cnic,
      package_id,
      isp_id: ispId,
      connection_date: connection_date || new Date(),
      billing_cycle: billing_cycle || 1,
      next_billing_date: new Date(Date.now() + (billing_cycle || 1) * 30 * 24 * 60 * 60 * 1000)
    });

    res.status(201).json({
      success: true,
      message: 'Customer created successfully',
      customer
    });
  } catch (error) {
    console.error('Create customer error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Update customer
// @route   PUT /api/customers/:id
// @access  Private (Admin, Account Manager, Super Admin)
const updateCustomer = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const whereClause = { id: req.params.id };
    
    // Super admin can update any customer, others only their ISP's
    if (req.user.role !== 'super_admin') {
      const ispId = req.ispId || req.user.isp_id;
      if (!ispId) {
        return res.status(400).json({ 
          message: 'Your account is not associated with an ISP. Please contact your administrator.' 
        });
      }
      whereClause.isp_id = ispId;
    }
    
    const customer = await Customer.findOne({
      where: whereClause
    });

    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    const { name, email, phone, address, package_id, status, billing_cycle } = req.body;

    await customer.update({
      name: name || customer.name,
      email: email || customer.email,
      phone: phone || customer.phone,
      address: address || customer.address,
      package_id: package_id !== undefined ? package_id : customer.package_id,
      status: status || customer.status,
      billing_cycle: billing_cycle || customer.billing_cycle
    });

    res.json({
      success: true,
      message: 'Customer updated successfully',
      customer
    });
  } catch (error) {
    console.error('Update customer error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Delete customer
// @route   DELETE /api/customers/:id
// @access  Private (Admin only)
const deleteCustomer = async (req, res) => {
  try {
    const whereClause = { id: req.params.id };
    
    // Super admin can delete any customer, others only their ISP's
    if (req.user.role !== 'super_admin') {
      const ispId = req.ispId || req.user.isp_id;
      if (!ispId) {
        return res.status(400).json({ 
          message: 'Your account is not associated with an ISP. Please contact your administrator.' 
        });
      }
      whereClause.isp_id = ispId;
    }
    
    const customer = await Customer.findOne({
      where: whereClause
    });

    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    await customer.destroy();

    res.json({
      success: true,
      message: 'Customer deleted successfully'
    });
  } catch (error) {
    console.error('Delete customer error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get current logged-in customer info
// @route   GET /api/customers/me
// @access  Private (Customer only)
const getMyInfo = async (req, res) => {
  try {
    if (req.user.role !== 'customer') {
      return res.status(403).json({ message: 'Access denied. This endpoint is for customers only.' });
    }

    // Find customer by email or phone
    const customer = await Customer.findOne({
      where: {
        [Op.or]: [
          { email: req.user.email },
          { phone: req.user.email }
        ],
        ...(req.user.isp_id ? { isp_id: req.user.isp_id } : {})
      },
      include: [
        {
          model: Package,
          as: 'package',
          attributes: ['id', 'name', 'speed', 'price', 'duration']
        },
        {
          model: ISP,
          as: 'isp',
          attributes: ['id', 'name', 'email', 'contact', 'address']
        }
      ]
    });

    if (!customer) {
      return res.status(404).json({ 
        message: 'Customer record not found. Please contact support to link your account.' 
      });
    }

    // Calculate total outstanding amount
    const unpaidBills = await Bill.findAll({
      where: {
        customer_id: customer.id,
        status: { [Op.in]: ['pending', 'partial', 'overdue'] }
      },
      attributes: ['id', 'total_amount', 'paid_amount', 'amount']
    });

    const totalOutstanding = unpaidBills.reduce((sum, bill) => {
      const billAmount = parseFloat(bill.total_amount || bill.amount || 0);
      const paidAmount = parseFloat(bill.paid_amount || 0);
      return sum + (billAmount - paidAmount);
    }, 0);

    res.json({
      success: true,
      customer: {
        ...customer.toJSON(),
        totalOutstanding
      }
    });
  } catch (error) {
    console.error('Get my info error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  getCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getMyInfo
};

