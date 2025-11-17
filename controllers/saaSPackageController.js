const { SaaSPackage, ISP } = require('../models');
const { validationResult } = require('express-validator');
const { Op } = require('sequelize');
const createActivityLog = require('../utils/activityLogger');

// @desc    Get all SaaS packages
// @route   GET /api/saas-packages
// @access  Private (Super Admin)
const getSaaSPackages = async (req, res) => {
  try {
    const { status = '' } = req.query;
    
    const whereClause = {};
    if (status) {
      whereClause.status = status;
    }

    const packages = await SaaSPackage.findAll({
      where: whereClause,
      include: [{
        model: ISP,
        as: 'isps',
        attributes: ['id', 'name', 'subscription_status'],
        required: false
      }],
      order: [['price', 'ASC']]
    });

    res.json({
      success: true,
      packages
    });
  } catch (error) {
    console.error('Error fetching SaaS packages:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get single SaaS package
// @route   GET /api/saas-packages/:id
// @access  Private (Super Admin)
const getSaaSPackage = async (req, res) => {
  try {
    const pkg = await SaaSPackage.findByPk(req.params.id, {
      include: [{
        model: ISP,
        as: 'isps',
        attributes: ['id', 'name', 'email', 'subscription_status', 'subscription_start_date', 'subscription_end_date'],
        required: false
      }]
    });

    if (!pkg) {
      return res.status(404).json({ message: 'SaaS package not found' });
    }

    res.json({ success: true, package: pkg });
  } catch (error) {
    console.error('Error fetching SaaS package:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Create SaaS package
// @route   POST /api/saas-packages
// @access  Private (Super Admin)
const createSaaSPackage = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, price, duration, features_json, max_customers, max_users, commission_rate, is_featured } = req.body;

    // Check if package name already exists
    const existingPackage = await SaaSPackage.findOne({ where: { name } });
    if (existingPackage) {
      return res.status(400).json({ message: 'Package with this name already exists' });
    }

    const pkg = await SaaSPackage.create({
      name: name.trim(),
      description: description?.trim() || null,
      price: parseFloat(price),
      duration: parseInt(duration) || 1,
      features_json: features_json || {},
      max_customers: max_customers ? parseInt(max_customers) : null,
      max_users: max_users ? parseInt(max_users) : 5,
      commission_rate: commission_rate ? parseFloat(commission_rate) : 0,
      is_featured: is_featured || false,
      status: 'active'
    });

    await createActivityLog(
      req.user.id,
      'CREATE_SAAS_PACKAGE',
      'SaaSPackage',
      pkg.id,
      null,
      { name, price, duration },
      req.user.isp_id,
      req.ip,
      req.get('user-agent')
    );

    res.status(201).json({ success: true, package: pkg });
  } catch (error) {
    console.error('Error creating SaaS package:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Update SaaS package
// @route   PUT /api/saas-packages/:id
// @access  Private (Super Admin)
const updateSaaSPackage = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const pkg = await SaaSPackage.findByPk(req.params.id);

    if (!pkg) {
      return res.status(404).json({ message: 'SaaS package not found' });
    }

    const oldValues = pkg.toJSON();
    await pkg.update(req.body);
    const newValues = pkg.toJSON();

    await createActivityLog(
      req.user.id,
      'UPDATE_SAAS_PACKAGE',
      'SaaSPackage',
      pkg.id,
      oldValues,
      newValues,
      req.user.isp_id,
      req.ip,
      req.get('user-agent')
    );

    res.json({ success: true, package: pkg });
  } catch (error) {
    console.error('Error updating SaaS package:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Delete SaaS package
// @route   DELETE /api/saas-packages/:id
// @access  Private (Super Admin)
const deleteSaaSPackage = async (req, res) => {
  try {
    const pkg = await SaaSPackage.findByPk(req.params.id);

    if (!pkg) {
      return res.status(404).json({ message: 'SaaS package not found' });
    }

    // Check if any ISPs are using this package
    const ispsUsingPackage = await ISP.count({
      where: { saas_package_id: pkg.id }
    });

    if (ispsUsingPackage > 0) {
      return res.status(400).json({ 
        message: `Cannot delete package. ${ispsUsingPackage} ISP(s) are subscribed to this package.` 
      });
    }

    await createActivityLog(
      req.user.id,
      'DELETE_SAAS_PACKAGE',
      'SaaSPackage',
      pkg.id,
      pkg.toJSON(),
      null,
      req.user.isp_id,
      req.ip,
      req.get('user-agent')
    );

    await pkg.destroy();

    res.json({ success: true, message: 'SaaS package deleted successfully' });
  } catch (error) {
    console.error('Error deleting SaaS package:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  getSaaSPackages,
  getSaaSPackage,
  createSaaSPackage,
  updateSaaSPackage,
  deleteSaaSPackage
};

