const { Installation, Customer, User, ISP } = require('../models');
const { validationResult } = require('express-validator');
const { Op } = require('sequelize');
const createActivityLog = require('../utils/activityLogger');

// @desc    Get all installations
// @route   GET /api/installations
// @access  Private
const getInstallations = async (req, res) => {
  try {
    const { page = 1, limit = 10, status = '', search = '' } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {};
    
    // Technical officers see only their assignments
    if (req.user.role === 'technical_officer') {
      whereClause.technical_officer_id = req.user.id;
    } else if (req.user.role !== 'super_admin') {
      whereClause.isp_id = req.user.isp_id;
    } else if (req.query.isp_id) {
      whereClause.isp_id = req.query.isp_id;
    }

    if (status) {
      whereClause.status = status;
    }

    if (search) {
      whereClause[Op.or] = [
        { service_address: { [Op.like]: `%${search}%` } },
        { ip_address: { [Op.like]: `%${search}%` } }
      ];
    }

    const installations = await Installation.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Customer,
          as: 'customer',
          attributes: ['id', 'name', 'email', 'phone', 'address']
        },
        {
          model: User,
          as: 'technicalOfficer',
          attributes: ['id', 'name', 'email']
        },
        {
          model: ISP,
          as: 'isp',
          attributes: ['id', 'name']
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      installations: installations.rows,
      total: installations.count,
      page: parseInt(page),
      pages: Math.ceil(installations.count / limit)
    });
  } catch (error) {
    console.error('Error fetching installations:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get single installation
// @route   GET /api/installations/:id
// @access  Private
const getInstallation = async (req, res) => {
  try {
    const installation = await Installation.findByPk(req.params.id, {
      include: [
        {
          model: Customer,
          as: 'customer',
          include: [{ model: ISP, as: 'isp', attributes: ['id', 'name'] }]
        },
        {
          model: User,
          as: 'technicalOfficer',
          attributes: ['id', 'name', 'email']
        },
        {
          model: ISP,
          as: 'isp',
          attributes: ['id', 'name']
        }
      ]
    });

    if (!installation) {
      return res.status(404).json({ message: 'Installation not found' });
    }

    // Check access
    if (req.user.role === 'technical_officer' && installation.technical_officer_id !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }
    if (req.user.role !== 'super_admin' && installation.isp_id !== req.user.isp_id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json({ success: true, installation });
  } catch (error) {
    console.error('Error fetching installation:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Create installation request
// @route   POST /api/installations
// @access  Private
const createInstallation = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { customer_id, service_address, connection_type, bandwidth, scheduled_date } = req.body;

    const customer = await Customer.findByPk(customer_id);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    // Check access
    if (req.user.role !== 'super_admin' && customer.isp_id !== req.user.isp_id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const installation = await Installation.create({
      customer_id,
      service_address,
      connection_type,
      bandwidth,
      scheduled_date,
      status: 'pending',
      isp_id: customer.isp_id
    });

    await createActivityLog(req.user.id, 'CREATE_INSTALLATION', 'Installation', installation.id, null, {
      customer_id, service_address, connection_type, bandwidth
    }, req.user.isp_id, req.ip, req.get('user-agent'));

    res.status(201).json({ success: true, installation });
  } catch (error) {
    console.error('Error creating installation:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Update installation
// @route   PUT /api/installations/:id
// @access  Private
const updateInstallation = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const installation = await Installation.findByPk(req.params.id);

    if (!installation) {
      return res.status(404).json({ message: 'Installation not found' });
    }

    // Check access
    if (req.user.role === 'technical_officer' && installation.technical_officer_id !== req.user.id && installation.status !== 'pending') {
      return res.status(403).json({ message: 'Access denied' });
    }
    if (req.user.role !== 'super_admin' && installation.isp_id !== req.user.isp_id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const oldValues = installation.toJSON();
    
    // If assigning technical officer
    if (req.body.technical_officer_id && !installation.technical_officer_id) {
      req.body.status = 'scheduled';
    }

    // If marking as completed
    const wasCompleted = installation.status === 'completed';
    if (req.body.status === 'completed' && !installation.installation_date) {
      req.body.installation_date = new Date();
    }

    await installation.update(req.body);
    const newValues = installation.toJSON();

    // Auto-generate invoice when installation is completed (first time only)
    if (req.body.status === 'completed' && !wasCompleted && installation.customer_id) {
      try {
        const { generateInstallationInvoice } = require('./automationController');
        await generateInstallationInvoice(installation.customer_id, installation.id, 'api');
        console.log(`✅ Auto-generated installation invoice for customer ${installation.customer_id}`);
      } catch (error) {
        console.error(`⚠️  Error generating installation invoice:`, error.message);
        // Don't fail the update if invoice generation fails
      }
    }

    await createActivityLog(req.user.id, 'UPDATE_INSTALLATION', 'Installation', installation.id, oldValues, newValues, req.user.isp_id, req.ip, req.get('user-agent'));

    res.json({ success: true, installation });
  } catch (error) {
    console.error('Error updating installation:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Delete installation
// @route   DELETE /api/installations/:id
// @access  Private (Admin, Super Admin)
const deleteInstallation = async (req, res) => {
  try {
    const installation = await Installation.findByPk(req.params.id);

    if (!installation) {
      return res.status(404).json({ message: 'Installation not found' });
    }

    // Check access
    if (req.user.role !== 'super_admin' && installation.isp_id !== req.user.isp_id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (installation.status === 'completed') {
      return res.status(400).json({ message: 'Cannot delete completed installation' });
    }

    await createActivityLog(req.user.id, 'DELETE_INSTALLATION', 'Installation', installation.id, installation.toJSON(), null, req.user.isp_id, req.ip, req.get('user-agent'));

    await installation.destroy();

    res.json({ success: true, message: 'Installation deleted successfully' });
  } catch (error) {
    console.error('Error deleting installation:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  getInstallations,
  getInstallation,
  createInstallation,
  updateInstallation,
  deleteInstallation
};

