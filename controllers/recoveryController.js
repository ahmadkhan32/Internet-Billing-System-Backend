const { Recovery, Customer, Bill, User, Package } = require('../models');
const { validationResult } = require('express-validator');
const { Op } = require('sequelize');

// @desc    Get all recoveries
// @route   GET /api/recoveries
// @access  Private (Admin, Recovery Officer)
const getRecoveries = async (req, res) => {
  try {
    const { page = 1, limit = 10, status = '', recovery_officer_id = '' } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {};

    // Super admin can see all recoveries, others are filtered by ISP
    const ispId = req.ispId || req.user.isp_id;
    if (req.user.role !== 'super_admin' && ispId) {
      whereClause.isp_id = ispId;
    }

    if (status) {
      whereClause.status = status;
    }

    if (recovery_officer_id) {
      whereClause.recovery_officer_id = recovery_officer_id;
    } else if (req.user.role === 'recovery_officer') {
      // Recovery officers can only see their own recoveries
      whereClause.recovery_officer_id = req.user.id;
    }

    const recoveries = await Recovery.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'recoveryOfficer',
          attributes: ['id', 'name', 'email']
        },
        {
          model: Customer,
          as: 'customer',
          attributes: ['id', 'name', 'phone', 'address']
        },
        {
          model: Bill,
          as: 'bill',
          attributes: ['id', 'bill_number', 'amount', 'due_date', 'status']
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      recoveries: recoveries.rows,
      total: recoveries.count,
      page: parseInt(page),
      pages: Math.ceil(recoveries.count / limit)
    });
  } catch (error) {
    console.error('Get recoveries error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get single recovery
// @route   GET /api/recoveries/:id
// @access  Private
const getRecovery = async (req, res) => {
  try {
    const whereClause = { id: req.params.id };
    // Super admin can access any recovery, others are filtered by ISP
    const ispId = req.ispId || req.user.isp_id;
    if (req.user.role !== 'super_admin' && ispId) {
      whereClause.isp_id = ispId;
    }

    const recovery = await Recovery.findOne({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'recoveryOfficer',
          attributes: ['id', 'name', 'email', 'phone']
        },
        {
          model: Customer,
          as: 'customer'
        },
        {
          model: Bill,
          as: 'bill'
        }
      ]
    });

    if (!recovery) {
      return res.status(404).json({ message: 'Recovery not found' });
    }

    res.json({
      success: true,
      recovery
    });
  } catch (error) {
    console.error('Get recovery error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Create recovery assignment
// @route   POST /api/recoveries
// @access  Private (Admin, Super Admin)
const createRecovery = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { recovery_officer_id, customer_id, bill_id, remarks } = req.body;

    // Get ISP ID once for the entire function
    const ispId = req.ispId || req.user.isp_id;

    // Verify recovery officer
    const officerWhere = {
      id: recovery_officer_id,
      role: 'recovery_officer'
    };
    
    // Super admin can assign to any recovery officer, others are filtered by ISP
    if (req.user.role !== 'super_admin' && ispId) {
      officerWhere.isp_id = ispId;
    }

    const officer = await User.findOne({
      where: officerWhere
    });

    if (!officer) {
      return res.status(404).json({ message: 'Recovery officer not found or not assigned to your ISP' });
    }

    // Verify customer
    const customerWhere = { id: customer_id };
    // Super admin can assign to any customer, others are filtered by ISP
    if (req.user.role !== 'super_admin' && ispId) {
      customerWhere.isp_id = ispId;
    }

    const customer = await Customer.findOne({
      where: customerWhere
    });

    if (!customer) {
      return res.status(404).json({ message: 'Customer not found or not assigned to your ISP' });
    }

    // Verify bill
    const billWhere = { id: bill_id };
    if (req.user.role !== 'super_admin' && ispId) {
      billWhere.isp_id = ispId;
    }

    const bill = await Bill.findOne({
      where: billWhere
    });

    if (!bill) {
      return res.status(404).json({ message: 'Bill not found or not assigned to your ISP' });
    }

    // Check if recovery already exists for this bill
    const existingRecovery = await Recovery.findOne({
      where: { bill_id }
    });

    if (existingRecovery) {
      return res.status(400).json({ 
        message: 'A recovery assignment already exists for this bill. Please update the existing recovery instead.' 
      });
    }

    // Determine ISP ID for recovery
    const finalIspId = req.user.role === 'super_admin' 
      ? (req.body.isp_id || customer.isp_id || bill.isp_id) 
      : (ispId || customer.isp_id || bill.isp_id);

    const recovery = await Recovery.create({
      recovery_officer_id,
      customer_id,
      bill_id,
      remarks,
      isp_id: finalIspId,
      status: 'assigned'
    });

    res.status(201).json({
      success: true,
      message: 'Recovery assignment created successfully',
      recovery
    });
  } catch (error) {
    console.error('Create recovery error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Update recovery status
// @route   PUT /api/recoveries/:id
// @access  Private (Admin, Recovery Officer)
const updateRecovery = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const whereClause = { id: req.params.id };
    // Super admin can update any recovery, others are filtered by ISP
    const ispId = req.ispId || req.user.isp_id;
    if (req.user.role !== 'super_admin' && ispId) {
      whereClause.isp_id = ispId;
    }

    const recovery = await Recovery.findOne({
      where: whereClause
    });

    if (!recovery) {
      return res.status(404).json({ message: 'Recovery not found' });
    }

    // Recovery officers can only update their own recoveries
    if (req.user.role === 'recovery_officer' && recovery.recovery_officer_id !== req.user.id) {
      return res.status(403).json({ message: 'You can only update your own recoveries' });
    }

    const { status, visit_date, amount_collected, remarks, next_visit_date } = req.body;

    await recovery.update({
      status: status || recovery.status,
      visit_date: visit_date || recovery.visit_date,
      amount_collected: amount_collected !== undefined ? amount_collected : recovery.amount_collected,
      remarks: remarks || recovery.remarks,
      next_visit_date: next_visit_date || recovery.next_visit_date
    });

    // If payment was collected, create payment record
    if (status === 'paid' && amount_collected > 0) {
      const { Payment } = require('../models');
      
      const bill = await Bill.findByPk(recovery.bill_id);
      if (bill) {
        const ispId = req.ispId || req.user.isp_id || recovery.isp_id;
        const receipt_number = `RCP${ispId || 'UNK'}-${Date.now()}`;
        await Payment.create({
          bill_id: recovery.bill_id,
          customer_id: recovery.customer_id,
          amount: amount_collected,
          method: 'cash',
          receipt_number,
          notes: `Payment collected by recovery officer: ${remarks || ''}`,
          isp_id: ispId,
          status: 'completed',
          payment_date: visit_date || new Date()
        });

        // Update bill status
        const totalPaid = await Payment.sum('amount', {
          where: {
            bill_id: recovery.bill_id,
            status: 'completed'
          }
        });

        const billAmount = parseFloat(bill.total_amount || bill.amount);
        const paidAmount = parseFloat(totalPaid);

        // Determine if bill is being completed
        const wasCompleted = bill.status === 'paid';
        const isNowCompleted = paidAmount >= billAmount;

        if (isNowCompleted) {
          // Bill is fully paid - set status to 'paid' and update paid_amount
          await bill.update({ 
            status: 'paid', 
            paid_amount: paidAmount,
            // Set completion timestamp if not already set
            ...(wasCompleted ? {} : { completed_at: new Date() })
          });
        } else if (paidAmount > 0) {
          // Partial payment
          await bill.update({ status: 'partial', paid_amount: paidAmount });
        } else {
          // No payment yet
          await bill.update({ status: 'pending', paid_amount: paidAmount });
        }
      }
    }

    // Reload recovery with associations
    await recovery.reload({
      include: [
        {
          model: User,
          as: 'recoveryOfficer',
          attributes: ['id', 'name', 'email']
        },
        {
          model: Customer,
          as: 'customer',
          attributes: ['id', 'name', 'phone', 'address']
        },
        {
          model: Bill,
          as: 'bill',
          attributes: ['id', 'bill_number', 'amount', 'due_date', 'status']
        }
      ]
    });

    res.json({
      success: true,
      message: 'Recovery updated successfully',
      recovery
    });
  } catch (error) {
    console.error('Update recovery error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get overdue bills for recovery
// @route   GET /api/recoveries/overdue
// @access  Private (Admin)
const getOverdueBills = async (req, res) => {
  try {
    const whereClause = {
      status: {
        [Op.in]: ['pending', 'overdue', 'partial']
      },
      due_date: {
        [Op.lt]: new Date()
      }
    };

    // Super admin can see all overdue bills, others are filtered by ISP
    const ispId = req.ispId || req.user.isp_id;
    if (req.user.role !== 'super_admin' && ispId) {
      whereClause.isp_id = ispId;
    }

    const overdueBills = await Bill.findAll({
      where: whereClause,
      include: [
        {
          model: Customer,
          as: 'customer',
          attributes: ['id', 'name', 'phone', 'address']
        },
        {
          model: Package,
          as: 'package',
          attributes: ['id', 'name', 'speed', 'price']
        }
      ],
      order: [['due_date', 'ASC']]
    });

    res.json({
      success: true,
      overdueBills
    });
  } catch (error) {
    console.error('Get overdue bills error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Delete recovery
// @route   DELETE /api/recoveries/:id
// @access  Private (Admin)
const deleteRecovery = async (req, res) => {
  try {
    const whereClause = { id: req.params.id };
    // Super admin can delete any recovery, others are filtered by ISP
    const ispId = req.ispId || req.user.isp_id;
    if (req.user.role !== 'super_admin' && ispId) {
      whereClause.isp_id = ispId;
    }

    const recovery = await Recovery.findOne({
      where: whereClause
    });

    if (!recovery) {
      return res.status(404).json({ message: 'Recovery not found' });
    }

    await recovery.destroy();

    res.json({
      success: true,
      message: 'Recovery deleted successfully'
    });
  } catch (error) {
    console.error('Delete recovery error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  getRecoveries,
  getRecovery,
  createRecovery,
  updateRecovery,
  deleteRecovery,
  getOverdueBills
};

