const { Package, ISP, Customer } = require('../models');
const { validationResult } = require('express-validator');
const { Op } = require('sequelize');
const createActivityLog = require('../utils/activityLogger');

// @desc    Get all packages
// @route   GET /api/packages
// @access  Private
const getPackages = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', is_active = '' } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {};
    
    // Super admin can see all, others see only their ISP's packages
    if (req.user.role !== 'super_admin') {
      // req.ispId is set by middleware, but if null, use req.user.isp_id
      const ispId = req.ispId || req.user.isp_id;
      if (!ispId) {
        // Return empty array instead of error - user just doesn't have packages yet
        return res.json({
          success: true,
          packages: [],
          total: 0,
          page: parseInt(page),
          pages: 0
        });
      }
      whereClause.isp_id = ispId;
    } else if (req.query.isp_id) {
      // Super admin can filter by ISP
      whereClause.isp_id = req.query.isp_id;
    }
    // If super_admin and no isp_id filter, show all packages (including null isp_id)

    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { speed: { [Op.like]: `%${search}%` } }
      ];
    }

    if (is_active !== '') {
      whereClause.is_active = is_active === 'true';
    }

    const packages = await Package.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: ISP,
          as: 'isp',
          attributes: ['id', 'name'],
          required: false // LEFT JOIN - allows packages with null isp_id
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['price', 'ASC']]
    });

    res.json({
      success: true,
      packages: packages.rows,
      total: packages.count,
      page: parseInt(page),
      pages: Math.ceil(packages.count / limit)
    });
  } catch (error) {
    console.error('Error fetching packages:', error);
    
    // Provide more specific error messages
    if (error.name === 'SequelizeDatabaseError') {
      return res.status(500).json({ 
        message: 'Database error', 
        error: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred while fetching packages. Please check database connection and schema.',
        hint: 'Run "npm run fix-db" to fix database schema issues'
      });
    }
    
    if (error.name === 'SequelizeConnectionError') {
      return res.status(500).json({ 
        message: 'Database connection error',
        error: 'Unable to connect to database. Please check database configuration.'
      });
    }
    
    res.status(500).json({ 
      message: 'Server error', 
      error: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred'
    });
  }
};

// @desc    Get single package
// @route   GET /api/packages/:id
// @access  Private
const getPackage = async (req, res) => {
  try {
    const pkg = await Package.findByPk(req.params.id, {
      include: [
        {
          model: ISP,
          as: 'isp',
          attributes: ['id', 'name'],
          required: false // LEFT JOIN - allows packages with null isp_id
        },
        {
          model: Customer,
          as: 'customers',
          attributes: ['id', 'name', 'email', 'phone'],
          required: false
        }
      ]
    });

    if (!pkg) {
      return res.status(404).json({ message: 'Package not found' });
    }

    // Check access
    if (req.user.role !== 'super_admin' && pkg.isp_id !== req.user.isp_id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json({ success: true, package: pkg });
  } catch (error) {
    console.error('Error fetching package:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Create package
// @route   POST /api/packages
// @access  Private (Admin, Super Admin)
const createPackage = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, speed, price, data_limit, duration, description } = req.body;

    // Determine ISP ID
    let ispId;
    if (req.user.role === 'super_admin') {
      // Super admin can specify isp_id or use their own, or create without ISP (for testing)
      ispId = req.body.isp_id || req.user.isp_id || null;
    } else {
      // Non-super-admin users must have an ISP
      ispId = req.user.isp_id || req.ispId;
      
      if (!ispId) {
        return res.status(400).json({ 
          message: 'ISP ID is required. Your account must be associated with an ISP to create packages. Please contact your administrator.' 
        });
      }
    }

    // Validate price
    const priceValue = parseFloat(price);
    if (isNaN(priceValue) || priceValue < 0) {
      return res.status(400).json({ message: 'Price must be a valid positive number' });
    }

    const pkg = await Package.create({
      name: name.trim(),
      speed: speed.trim(),
      price: priceValue,
      data_limit: data_limit && data_limit !== '' && !isNaN(parseFloat(data_limit)) 
        ? parseFloat(data_limit) 
        : null,
      duration: duration ? parseInt(duration) : 1,
      description: description ? description.trim() : null,
      isp_id: ispId,
      is_active: true
    });

    // Log activity (handle error gracefully)
    try {
      await createActivityLog(
        req.user.id, 
        'CREATE_PACKAGE', 
        'Package', 
        pkg.id, 
        null, 
        { name, speed, price: priceValue, data_limit },
        req.user.isp_id || ispId, 
        req.ip, 
        req.get('user-agent')
      );
    } catch (logError) {
      console.error('Error logging activity:', logError);
      // Don't fail the request if logging fails
    }

    res.status(201).json({ success: true, package: pkg });
  } catch (error) {
    console.error('Error creating package:', error);
    
    // Provide more specific error messages
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({ 
        message: 'Validation error', 
        errors: error.errors.map(e => ({ field: e.path, message: e.message }))
      });
    }
    
    if (error.name === 'SequelizeForeignKeyConstraintError') {
      return res.status(400).json({ 
        message: 'Invalid ISP ID. Please ensure the ISP exists.' 
      });
    }
    
    if (error.name === 'SequelizeDatabaseError') {
      return res.status(500).json({ 
        message: 'Database error', 
        error: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred while saving the package'
      });
    }

    res.status(500).json({ 
      message: 'Server error', 
      error: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred'
    });
  }
};

// @desc    Update package
// @route   PUT /api/packages/:id
// @access  Private (Admin, Super Admin)
const updatePackage = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const pkg = await Package.findByPk(req.params.id);

    if (!pkg) {
      return res.status(404).json({ message: 'Package not found' });
    }

    // Check access
    if (req.user.role !== 'super_admin' && pkg.isp_id !== req.user.isp_id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Prepare update data
    const updateData = {};
    if (req.body.name !== undefined) updateData.name = req.body.name.trim();
    if (req.body.speed !== undefined) updateData.speed = req.body.speed.trim();
    if (req.body.price !== undefined) {
      const priceValue = parseFloat(req.body.price);
      if (isNaN(priceValue) || priceValue < 0) {
        return res.status(400).json({ message: 'Price must be a valid positive number' });
      }
      updateData.price = priceValue;
    }
    if (req.body.data_limit !== undefined) {
      updateData.data_limit = req.body.data_limit && req.body.data_limit !== '' && !isNaN(parseFloat(req.body.data_limit))
        ? parseFloat(req.body.data_limit)
        : null;
    }
    if (req.body.duration !== undefined) updateData.duration = parseInt(req.body.duration) || 1;
    if (req.body.description !== undefined) updateData.description = req.body.description ? req.body.description.trim() : null;
    if (req.body.is_active !== undefined) updateData.is_active = req.body.is_active;

    const oldValues = pkg.toJSON();
    await pkg.update(updateData);
    const newValues = pkg.toJSON();

    // Log activity (handle error gracefully)
    try {
      await createActivityLog(
        req.user.id, 
        'UPDATE_PACKAGE', 
        'Package', 
        pkg.id, 
        oldValues, 
        newValues, 
        req.user.isp_id || pkg.isp_id, 
        req.ip, 
        req.get('user-agent')
      );
    } catch (logError) {
      console.error('Error logging activity:', logError);
      // Don't fail the request if logging fails
    }

    res.json({ success: true, package: pkg });
  } catch (error) {
    console.error('Error updating package:', error);
    
    // Provide more specific error messages
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({ 
        message: 'Validation error', 
        errors: error.errors.map(e => ({ field: e.path, message: e.message }))
      });
    }
    
    res.status(500).json({ 
      message: 'Server error', 
      error: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred'
    });
  }
};

// @desc    Delete package
// @route   DELETE /api/packages/:id
// @access  Private (Admin, Super Admin)
const deletePackage = async (req, res) => {
  try {
    const pkg = await Package.findByPk(req.params.id);

    if (!pkg) {
      return res.status(404).json({ message: 'Package not found' });
    }

    // Check access
    if (req.user.role !== 'super_admin' && pkg.isp_id !== req.user.isp_id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Check if package has active customers
    const activeCustomers = await Customer.count({
      where: { package_id: pkg.id, status: 'active' }
    });

    if (activeCustomers > 0) {
      return res.status(400).json({ 
        message: `Cannot delete package. ${activeCustomers} active customer(s) are using this package.` 
      });
    }

    await createActivityLog(req.user.id, 'DELETE_PACKAGE', 'Package', pkg.id, pkg.toJSON(), null, req.user.isp_id, req.ip, req.get('user-agent'));

    await pkg.destroy();

    res.json({ success: true, message: 'Package deleted successfully' });
  } catch (error) {
    console.error('Error deleting package:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  getPackages,
  getPackage,
  createPackage,
  updatePackage,
  deletePackage
};

