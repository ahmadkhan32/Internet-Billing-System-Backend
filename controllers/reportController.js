const { Bill, Payment, Customer, Package } = require('../models');
const { Op } = require('sequelize');
const { Sequelize } = require('sequelize');
const moment = require('moment');

// @desc    Get dashboard statistics
// @route   GET /api/reports/dashboard
// @access  Private (Different stats for customers vs admins)
const getDashboardStats = async (req, res) => {
  try {
    const today = new Date();
    const startOfMonth = moment().startOf('month').toDate();
    const endOfMonth = moment().endOf('month').toDate();

    // For customers, show their own stats
    if (req.user.role === 'customer') {
      // Find customer record by email
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
          stats: {
            totalCustomers: 0,
            activeCustomers: 0,
            totalBills: 0,
            pendingBills: 0,
            overdueBills: 0,
            totalRevenue: 0,
            monthlyRevenue: 0,
            overdueAmount: 0,
            recentPayments: []
          }
        });
      }

      // Customer's own bills
      const totalBills = await Bill.count({
        where: { customer_id: customer.id }
      });

      const pendingBills = await Bill.count({
        where: {
          customer_id: customer.id,
          status: { [Op.in]: ['pending', 'overdue'] }
        }
      });

      // Customer's payments
      const totalRevenue = await Payment.sum('amount', {
        where: {
          customer_id: customer.id,
          status: 'completed'
        }
      }) || 0;

      const monthlyRevenue = await Payment.sum('amount', {
        where: {
          customer_id: customer.id,
          status: 'completed',
          payment_date: {
            [Op.between]: [startOfMonth, endOfMonth]
          }
        }
      }) || 0;

      // Customer's overdue bills
      const overdueBills = await Bill.count({
        where: {
          customer_id: customer.id,
          status: { [Op.in]: ['pending', 'overdue', 'partial'] },
          due_date: {
            [Op.lt]: today
          }
        }
      });

      const overdueAmount = await Bill.sum('total_amount', {
        where: {
          customer_id: customer.id,
          status: { [Op.in]: ['pending', 'overdue', 'partial'] },
          due_date: {
            [Op.lt]: today
          }
        }
      }) || 0;

      // Customer's recent payments
      const recentPayments = await Payment.findAll({
        where: {
          customer_id: customer.id,
          status: 'completed'
        },
        include: [
          {
            model: Customer,
            as: 'customer',
            attributes: ['id', 'name']
          }
        ],
        limit: 5,
        order: [['payment_date', 'DESC']]
      });

      return res.json({
        success: true,
        stats: {
          totalCustomers: 0, // Customers don't see customer count
          activeCustomers: 0,
          totalBills,
          pendingBills,
          overdueBills,
          totalRevenue,
          monthlyRevenue,
          overdueAmount,
          recentPayments
        }
      });
    }

    // For admin/staff - show ISP-wide stats
    // For super_admin, no filter; for others, use req.ispId if available
    let ispFilter = {};
    if (req.user.role !== 'super_admin') {
      if (req.ispId) {
        ispFilter = { isp_id: req.ispId };
      } else if (req.user.isp_id) {
        // Fallback to user's isp_id if req.ispId is not set
        ispFilter = { isp_id: req.user.isp_id };
      } else {
        // If no ISP ID available, return empty stats
        return res.json({
          success: true,
          stats: {
            totalCustomers: 0,
            activeCustomers: 0,
            totalBills: 0,
            pendingBills: 0,
            overdueBills: 0,
            totalRevenue: 0,
            monthlyRevenue: 0,
            overdueAmount: 0,
            recentPayments: []
          }
        });
      }
    }

    // Total customers
    const totalCustomers = await Customer.count({
      where: ispFilter
    });

    const activeCustomers = await Customer.count({
      where: {
        ...ispFilter,
        status: 'active'
      }
    });

    // Total bills
    const totalBills = await Bill.count({
      where: ispFilter
    });

    const pendingBills = await Bill.count({
      where: {
        ...ispFilter,
        status: { [Op.in]: ['pending', 'overdue'] }
      }
    });

    // Revenue
    const totalRevenue = await Payment.sum('amount', {
      where: {
        ...ispFilter,
        status: 'completed'
      }
    }) || 0;

    const monthlyRevenue = await Payment.sum('amount', {
      where: {
        ...ispFilter,
        status: 'completed',
        payment_date: {
          [Op.between]: [startOfMonth, endOfMonth]
        }
      }
    }) || 0;

    // Overdue bills
    const overdueBills = await Bill.count({
      where: {
        ...ispFilter,
        status: { [Op.in]: ['pending', 'overdue', 'partial'] },
        due_date: {
          [Op.lt]: today
        }
      }
    });

    const overdueAmount = await Bill.sum('total_amount', {
      where: {
        ...ispFilter,
        status: { [Op.in]: ['pending', 'overdue', 'partial'] },
        due_date: {
          [Op.lt]: today
        }
      }
    }) || 0;

    // Recent payments
    const recentPayments = await Payment.findAll({
      where: {
        ...ispFilter,
        status: 'completed'
      },
      include: [
        {
          model: Customer,
          as: 'customer',
          attributes: ['id', 'name']
        }
      ],
      limit: 5,
      order: [['payment_date', 'DESC']]
    });

    res.json({
      success: true,
      stats: {
        totalCustomers,
        activeCustomers,
        totalBills,
        pendingBills,
        overdueBills,
        totalRevenue,
        monthlyRevenue,
        overdueAmount,
        recentPayments
      }
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get revenue report
// @route   GET /api/reports/revenue
// @access  Private (Admin, Account Manager)
const getRevenueReport = async (req, res) => {
  try {
    const { start_date, end_date, group_by = 'day' } = req.query;

    const startDate = start_date ? new Date(start_date) : moment().startOf('month').toDate();
    const endDate = end_date ? new Date(end_date) : new Date();

    let dateFormat;
    switch (group_by) {
      case 'day':
        dateFormat = '%Y-%m-%d';
        break;
      case 'week':
        dateFormat = '%Y-%u';
        break;
      case 'month':
        dateFormat = '%Y-%m';
        break;
      default:
        dateFormat = '%Y-%m-%d';
    }

    const revenue = await Payment.findAll({
      where: {
        isp_id: req.ispId,
        status: 'completed',
        payment_date: {
          [Op.between]: [startDate, endDate]
        }
      },
      attributes: [
        [Sequelize.fn('DATE_FORMAT', Sequelize.col('payment_date'), dateFormat), 'period'],
        [Sequelize.fn('SUM', Sequelize.col('amount')), 'total'],
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
      ],
      group: ['period'],
      order: [['period', 'ASC']]
    });

    res.json({
      success: true,
      revenue
    });
  } catch (error) {
    console.error('Get revenue report error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get customer report
// @route   GET /api/reports/customers
// @access  Private (Admin, Account Manager)
const getCustomerReport = async (req, res) => {
  try {
    const { status = '', package_id = '' } = req.query;

    const whereClause = {
      isp_id: req.ispId
    };

    if (status) {
      whereClause.status = status;
    }

    if (package_id) {
      whereClause.package_id = package_id;
    }

    const customers = await Customer.findAll({
      where: whereClause,
      include: [
        {
          model: Package,
          as: 'package',
          attributes: ['id', 'name', 'speed', 'price']
        },
        {
          model: Bill,
          as: 'bills',
          attributes: ['id', 'amount', 'status', 'due_date']
        }
      ]
    });

    // Calculate statistics for each customer
    const customerReport = customers.map(customer => {
      const bills = customer.bills || [];
      const totalBills = bills.length;
      const paidBills = bills.filter(b => b.status === 'paid').length;
      const pendingBills = bills.filter(b => ['pending', 'overdue'].includes(b.status)).length;
      const totalAmount = bills.reduce((sum, b) => sum + parseFloat(b.amount || 0), 0);

      return {
        ...customer.toJSON(),
        statistics: {
          totalBills,
          paidBills,
          pendingBills,
          totalAmount
        }
      };
    });

    res.json({
      success: true,
      customers: customerReport
    });
  } catch (error) {
    console.error('Get customer report error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get bill report
// @route   GET /api/reports/bills
// @access  Private (Admin, Account Manager)
const getBillReport = async (req, res) => {
  try {
    const { start_date, end_date, status = '' } = req.query;

    const whereClause = {
      isp_id: req.ispId
    };

    if (status) {
      whereClause.status = status;
    }

    if (start_date && end_date) {
      whereClause.createdAt = {
        [Op.between]: [new Date(start_date), new Date(end_date)]
      };
    }

    const bills = await Bill.findAll({
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
        },
        {
          model: Payment,
          as: 'payments',
          attributes: ['id', 'amount', 'payment_date', 'method']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    // Calculate paid amount for each bill
    const billReport = bills.map(bill => {
      const payments = bill.payments || [];
      const paidAmount = payments
        .filter(p => p.status === 'completed')
        .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
      const remainingAmount = parseFloat(bill.amount) - paidAmount;

      return {
        ...bill.toJSON(),
        paidAmount,
        remainingAmount
      };
    });

    res.json({
      success: true,
      bills: billReport
    });
  } catch (error) {
    console.error('Get bill report error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  getDashboardStats,
  getRevenueReport,
  getCustomerReport,
  getBillReport
};

