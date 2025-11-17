const { User, ISP, Customer } = require('../models');
const { validationResult } = require('express-validator');
const { Op } = require('sequelize');
const createActivityLog = require('../utils/activityLogger');
const { buildTenantWhere } = require('../middlewares/tenantMiddleware');

// @desc    Get all users (with tenant isolation)
// @route   GET /api/users
// @access  Private (Super Admin, Admin)
// @note    Super Admin sees all users, Admin sees only their business users
const getUsers = async (req, res) => {
  try {
    const { role, isp_id, is_active } = req.query;
    let whereClause = {};

    // Super Admin can see all users (optional business_id filter)
    // Admin can only see users from their business
    if (req.user.role === 'admin') {
      whereClause.isp_id = req.user.isp_id;
    } else if (req.user.role !== 'super_admin') {
      return res.status(403).json({ message: 'Access denied' });
    } else {
      // Super Admin: optional business_id filter
      if (req.query.business_id || req.tenantId) {
        whereClause.isp_id = req.query.business_id || req.tenantId;
      }
    }

    // Apply filters
    if (role) whereClause.role = role;
    if (isp_id && req.user.role === 'super_admin') whereClause.isp_id = isp_id;
    if (is_active !== undefined) whereClause.is_active = is_active === 'true';

    const users = await User.findAll({
      where: whereClause,
      attributes: { exclude: ['password'] },
      include: [{
        model: ISP,
        as: 'isp',
        attributes: ['id', 'name', 'email'],
        required: false // LEFT JOIN - allows users with null isp_id
      }],
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      count: users.length,
      users
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get single user by ID
// @route   GET /api/users/:id
// @access  Private (Super Admin, Admin, or self)
const getUserById = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password'] },
      include: [{
        model: ISP,
        as: 'isp',
        attributes: ['id', 'name', 'email'],
        required: false // LEFT JOIN - allows users with null isp_id
      }]
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check access: Super admin can access all, Admin can access their ISP users, users can access themselves
    if (req.user.role !== 'super_admin') {
      if (req.user.role === 'admin' && user.isp_id !== req.user.isp_id) {
        return res.status(403).json({ message: 'Access denied' });
      }
      if (req.user.role !== 'admin' && user.id !== req.user.id) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Create new user (role-based access)
// @route   POST /api/users
// @access  Private (Super Admin, Admin)
const createUser = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password, role, isp_id, phone, address } = req.body;

    // Role-based permission check
    const allowedRoles = ['super_admin', 'admin'];
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied - insufficient permissions' });
    }

    // Super admin can create any role, Admin can only create staff roles (not super_admin or admin)
    if (req.user.role === 'admin') {
      const adminAllowedRoles = ['account_manager', 'technical_officer', 'recovery_officer', 'customer'];
      if (!adminAllowedRoles.includes(role)) {
        return res.status(403).json({ message: 'Admin can only create staff and customer accounts' });
      }
      // Admin can only create users for their ISP
      if (isp_id && isp_id !== req.user.isp_id) {
        return res.status(403).json({ message: 'Admin can only create users for their ISP' });
      }
    }

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    // For non-super-admin users, require ISP ID
    let finalIspId = role === 'super_admin' ? null : (isp_id || req.user.isp_id);
    
    // Handle empty string or 0 as null
    if (finalIspId === '' || finalIspId === 0) {
      finalIspId = null;
    }
    
    // Convert to integer if it's a string
    if (finalIspId && typeof finalIspId === 'string') {
      finalIspId = parseInt(finalIspId);
      if (isNaN(finalIspId)) {
        finalIspId = null;
      }
    }
    
    if (role !== 'super_admin' && !finalIspId) {
      return res.status(400).json({ message: 'ISP ID is required for this role' });
    }

    // Validate ISP exists if ISP ID is provided
    if (finalIspId) {
      const isp = await ISP.findByPk(finalIspId);
      if (!isp) {
        return res.status(400).json({ 
          message: `Invalid ISP ID. ISP with ID ${finalIspId} does not exist. Please select a valid ISP or create one first.` 
        });
      }
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password,
      role: role || 'customer',
      isp_id: finalIspId,
      is_active: true
    });

    // If customer role, also create customer record (handle errors gracefully)
    if (role === 'customer' && phone && address) {
      try {
        // Check if customer already exists with this phone/email
        const existingCustomer = await Customer.findOne({
          where: {
            [Op.or]: [
              { phone, isp_id: finalIspId },
              { email, isp_id: finalIspId }
            ]
          }
        });

        if (!existingCustomer) {
          await Customer.create({
            name,
            email,
            phone,
            address,
            isp_id: finalIspId,
            connection_date: new Date()
          });
        }
      } catch (customerError) {
        console.error('Error creating customer record:', customerError);
        // Don't fail user creation if customer record creation fails
        // User is already created, just log the error
      }
    }

    // Log activity (handle errors gracefully)
    try {
      await createActivityLog(
        req.user.id,
        'CREATE_USER',
        'User',
        user.id,
        null,
        { name, email, role, isp_id: finalIspId },
        finalIspId || req.user.isp_id,
        req.ip,
        req.get('user-agent'),
        `Created user: ${name} (${role})`
      );
    } catch (logError) {
      console.error('Error logging activity:', logError);
      // Don't fail user creation if logging fails
    }

    const userResponse = await User.findByPk(user.id, {
      attributes: { exclude: ['password'] },
      include: [{
        model: ISP,
        as: 'isp',
        attributes: ['id', 'name', 'email'],
        required: false // LEFT JOIN - allows users with null isp_id
      }]
    });

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: userResponse
    });
  } catch (error) {
    console.error('Create user error:', error);
    
    // Provide more specific error messages
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({ 
        message: 'Validation error', 
        errors: error.errors.map(e => ({ field: e.path, message: e.message }))
      });
    }
    
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ 
        message: 'User already exists with this email' 
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
        error: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred while creating the user. Please check database connection and schema.'
      });
    }
    
    res.status(500).json({ 
      message: 'Server error during user creation', 
      error: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred'
    });
  }
};

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private (Super Admin, Admin, or self for profile updates)
const updateUser = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, role, isp_id, is_active, password } = req.body;
    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check access permissions
    const isSelf = user.id === req.user.id;
    const isSuperAdmin = req.user.role === 'super_admin';
    const isAdmin = req.user.role === 'admin';
    const isAdminOfSameISP = isAdmin && user.isp_id === req.user.isp_id;

    // Users can only update their own profile (name, email, password)
    if (!isSelf && !isSuperAdmin && !isAdminOfSameISP) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Only super admin and admin can change role and isp_id
    if ((role !== undefined || isp_id !== undefined) && !isSuperAdmin && !isAdminOfSameISP) {
      return res.status(403).json({ message: 'Only admin can change role and ISP assignment' });
    }

    // Admin cannot change role to super_admin or admin
    if (isAdmin && role && ['super_admin', 'admin'].includes(role)) {
      return res.status(403).json({ message: 'Admin cannot assign super_admin or admin roles' });
    }

    // Prevent changing Super Admin's own role (unless by another Super Admin)
    if (user.role === 'super_admin' && user.id === req.user.id && role && role !== 'super_admin') {
      return res.status(403).json({ message: 'You cannot change your own Super Admin role' });
    }

    // Only Super Admin can change roles to/from super_admin
    if (role && (role === 'super_admin' || user.role === 'super_admin') && req.user.role !== 'super_admin') {
      return res.status(403).json({ message: 'Only Super Admin can manage Super Admin roles' });
    }

    // Get old values for logging before updating
    const oldValues = {
      name: user.name,
      email: user.email,
      role: user.role,
      isp_id: user.isp_id,
      is_active: user.is_active
    };

    // Update fields
    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email;
    if (password !== undefined) user.password = password;
    if (role !== undefined && (isSuperAdmin || isAdminOfSameISP)) user.role = role;
    if (isp_id !== undefined && isSuperAdmin) user.isp_id = isp_id;
    if (is_active !== undefined && (isSuperAdmin || isAdminOfSameISP)) user.is_active = is_active;

    await user.save();

    // Prepare new values for logging (exclude password)
    const newValues = {
      name: user.name,
      email: user.email,
      role: user.role,
      isp_id: user.isp_id,
      is_active: user.is_active
    };
    if (password !== undefined) newValues.password = '[REDACTED]';

    // Log activity
    await createActivityLog(
      req.user.id,
      'UPDATE_USER',
      'User',
      user.id,
      oldValues,
      newValues,
      user.isp_id || req.user.isp_id,
      req.ip,
      req.get('user-agent'),
      `Updated user: ${user.name}`
    );

    const userResponse = await User.findByPk(user.id, {
      attributes: { exclude: ['password'] },
      include: [{
        model: ISP,
        as: 'isp',
        attributes: ['id', 'name', 'email'],
        required: false // LEFT JOIN - allows users with null isp_id
      }]
    });

    res.json({
      success: true,
      message: 'User updated successfully',
      user: userResponse
    });
  } catch (error) {
    console.error('Update user error:', error);
    
    // Provide more specific error messages
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({ 
        message: 'Validation error', 
        errors: error.errors.map(e => ({ field: e.path, message: e.message }))
      });
    }
    
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ 
        message: 'User already exists with this email' 
      });
    }
    
    if (error.name === 'SequelizeForeignKeyConstraintError') {
      return res.status(400).json({ 
        message: 'Invalid ISP ID. Please ensure the ISP exists.' 
      });
    }
    
    res.status(500).json({ 
      message: 'Server error during user update', 
      error: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred'
    });
  }
};

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private (Super Admin, Admin)
const deleteUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent self-deletion
    if (user.id === req.user.id) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }

    // Check access permissions
    if (req.user.role === 'admin' && user.isp_id !== req.user.isp_id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Prevent deleting super admin
    if (user.role === 'super_admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ message: 'Cannot delete super admin account' });
    }

    // Log activity before deletion
    const userData = user.toJSON();
    await createActivityLog(
      req.user.id,
      'DELETE_USER',
      'User',
      user.id,
      userData,
      null,
      user.isp_id || req.user.isp_id,
      req.ip,
      req.get('user-agent'),
      `Deleted user: ${user.name} (${user.email})`
    );

    await user.destroy();

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Server error during user deletion', error: error.message });
  }
};

module.exports = {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser
};

