const { Role, Permission, RolePermission, User, ISP } = require('../models');
const { sequelize } = require('../config/db');
const { validationResult } = require('express-validator');
const { Op } = require('sequelize');
const createActivityLog = require('../utils/activityLogger');
const { buildTenantWhere } = require('../middlewares/tenantMiddleware');

// @desc    Get all roles (business-aware)
// @route   GET /api/roles
// @access  Private (Super Admin, Business Admin)
// @note    Super Admin sees all roles, Business Admin sees only their business roles
const getRoles = async (req, res) => {
  try {
    // Check if Role table exists
    const [tableExists] = await sequelize.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE() 
      AND table_name = 'roles'
    `);
    
    if (tableExists[0].count === 0) {
      return res.status(500).json({ 
        message: 'Roles table does not exist. Please restart the server to initialize the database.',
        error: 'Table not found'
      });
    }

    // Build where clause with tenant isolation
    // System roles (business_id IS NULL) should be visible to everyone
    // Business-specific roles are filtered by business_id
    
    let whereClause;
    
    if (req.user.role !== 'super_admin') {
      // Business Admin: see system roles + roles for their business
      whereClause = {
        [Op.or]: [
          { business_id: null }, // System roles
          { business_id: req.user.isp_id } // Business-specific roles
        ]
      };
    } else {
      // Super Admin: can optionally filter by business_id, otherwise see all
      if (req.query.business_id) {
        whereClause = { business_id: parseInt(req.query.business_id) };
      } else {
        // Super Admin sees all roles (system + all business roles)
        whereClause = undefined;
      }
    }

    const roles = await Role.findAll({
      where: whereClause,
      include: [
        {
          model: Permission,
          as: 'permissions',
          through: { attributes: [] },
          attributes: ['id', 'name', 'display_name', 'resource', 'action'],
          required: false // LEFT JOIN - allows roles without permissions
        },
        {
          model: ISP,
          as: 'business',
          attributes: ['id', 'name', 'email'],
          required: false
        }
      ],
      order: [['name', 'ASC']]
    });

    res.json({
      success: true,
      roles: roles || []
    });
  } catch (error) {
    console.error('Error fetching roles:', error);
    
    // Provide more specific error messages
    if (error.name === 'SequelizeDatabaseError') {
      return res.status(500).json({ 
        message: 'Database error. Please ensure the database is properly initialized.',
        error: error.message 
      });
    }
    
    res.status(500).json({ 
      message: 'Server error while fetching roles', 
      error: error.message 
    });
  }
};

// @desc    Get single role with permissions (business-aware)
// @route   GET /api/roles/:id
// @access  Private (Super Admin, Business Admin)
const getRole = async (req, res) => {
  try {
    const role = await Role.findByPk(req.params.id, {
      include: [
        {
          model: Permission,
          as: 'permissions',
          through: { attributes: [] },
          attributes: ['id', 'name', 'display_name', 'resource', 'action']
        },
        {
          model: ISP,
          as: 'business',
          attributes: ['id', 'name', 'email'],
          required: false
        }
      ]
    });

    if (!role) {
      return res.status(404).json({ message: 'Role not found' });
    }

    // Business Admin can only access roles for their business
    if (req.user.role !== 'super_admin' && role.business_id !== req.user.isp_id) {
      return res.status(403).json({ 
        message: 'Access denied. You can only access roles for your business.' 
      });
    }

    res.json({ success: true, role });
  } catch (error) {
    console.error('Error fetching role:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Create role (business-aware)
// @route   POST /api/roles
// @access  Private (Super Admin, Business Admin)
// @note    Business Admin can only create roles for their business
const createRole = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, display_name, description, permission_ids, business_id } = req.body;
    
    // Determine business_id for the role
    let roleBusinessId = null;
    
    if (req.user.role === 'super_admin') {
      // Super Admin can create system roles (business_id = null) or business-specific roles
      roleBusinessId = business_id || null;
    } else {
      // Business Admin can only create roles for their own business
      roleBusinessId = req.user.isp_id;
    }
    
    // Check if role with same name already exists for this business
    const existingRole = await Role.findOne({
      where: {
        name,
        business_id: roleBusinessId
      }
    });
    
    if (existingRole) {
      return res.status(400).json({ 
        message: `Role with name "${name}" already exists for this business` 
      });
    }

    const role = await Role.create({
      name,
      display_name,
      description,
      business_id: roleBusinessId,
      is_system_role: false,
      is_active: true
    });

    // Assign permissions if provided
    if (permission_ids && permission_ids.length > 0) {
      await role.setPermissions(permission_ids);
    }

    // Reload with permissions
    await role.reload({
      include: [{ model: Permission, as: 'permissions', through: { attributes: [] } }]
    });

    await createActivityLog(
      req.user.id,
      'CREATE_ROLE',
      'Role',
      role.id,
      null,
      { name, display_name, permission_ids },
      req.user.isp_id,
      req.ip,
      req.get('user-agent')
    );

    res.status(201).json({ success: true, role });
  } catch (error) {
    console.error('Error creating role:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Update role (business-aware)
// @route   PUT /api/roles/:id
// @access  Private (Super Admin, Business Admin)
const updateRole = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const role = await Role.findByPk(req.params.id);
    
    if (!role) {
      return res.status(404).json({ message: 'Role not found' });
    }
    
    // Business Admin can only update roles for their business
    if (req.user.role !== 'super_admin' && role.business_id !== req.user.isp_id) {
      return res.status(403).json({ 
        message: 'Access denied. You can only update roles for your business.' 
      });
    }

    // Prevent modification of system roles
    if (role.is_system_role && (req.body.name || req.body.is_system_role)) {
      return res.status(400).json({ message: 'Cannot modify system role properties' });
    }

    const oldValues = role.toJSON();
    await role.update(req.body);
    const newValues = role.toJSON();

    // Update permissions if provided
    if (req.body.permission_ids !== undefined) {
      await role.setPermissions(req.body.permission_ids || []);
      await role.reload({
        include: [{ model: Permission, as: 'permissions', through: { attributes: [] } }]
      });
    }

    await createActivityLog(
      req.user.id,
      'UPDATE_ROLE',
      'Role',
      role.id,
      oldValues,
      newValues,
      req.user.isp_id,
      req.ip,
      req.get('user-agent')
    );

    res.json({ success: true, role });
  } catch (error) {
    console.error('Error updating role:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Delete role (business-aware)
// @route   DELETE /api/roles/:id
// @access  Private (Super Admin, Business Admin)
const deleteRole = async (req, res) => {
  try {
    const role = await Role.findByPk(req.params.id);

    if (!role) {
      return res.status(404).json({ message: 'Role not found' });
    }
    
    // Business Admin can only delete roles for their business
    if (req.user.role !== 'super_admin' && role.business_id !== req.user.isp_id) {
      return res.status(403).json({ 
        message: 'Access denied. You can only delete roles for your business.' 
      });
    }

    // Prevent deletion of system roles
    if (role.is_system_role) {
      return res.status(400).json({ message: 'Cannot delete system role' });
    }

    // Check if role is in use
    const usersWithRole = await User.count({ where: { role: role.name } });
    if (usersWithRole > 0) {
      return res.status(400).json({ 
        message: `Cannot delete role. ${usersWithRole} user(s) are using this role.` 
      });
    }

    await createActivityLog(
      req.user.id,
      'DELETE_ROLE',
      'Role',
      role.id,
      role.toJSON(),
      null,
      req.user.isp_id,
      req.ip,
      req.get('user-agent')
    );

    await role.destroy();

    res.json({ success: true, message: 'Role deleted successfully' });
  } catch (error) {
    console.error('Error deleting role:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Assign permissions to role
// @route   POST /api/roles/:id/permissions
// @access  Private (Super Admin)
const assignPermissions = async (req, res) => {
  try {
    const { permission_ids } = req.body;

    if (!Array.isArray(permission_ids)) {
      return res.status(400).json({ message: 'permission_ids must be an array' });
    }

    const role = await Role.findByPk(req.params.id);
    if (!role) {
      return res.status(404).json({ message: 'Role not found' });
    }

    // Verify all permissions exist
    const permissions = await Permission.findAll({
      where: { id: { [Op.in]: permission_ids } }
    });

    if (permissions.length !== permission_ids.length) {
      return res.status(400).json({ message: 'One or more permissions not found' });
    }

    // Assign permissions
    await role.setPermissions(permission_ids);

    await role.reload({
      include: [{ model: Permission, as: 'permissions', through: { attributes: [] } }]
    });

    await createActivityLog(
      req.user.id,
      'ASSIGN_PERMISSIONS',
      'Role',
      role.id,
      null,
      { permission_ids },
      req.user.isp_id,
      req.ip,
      req.get('user-agent')
    );

    res.json({ success: true, role });
  } catch (error) {
    console.error('Error assigning permissions:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get role permissions
// @route   GET /api/roles/:id/permissions
// @access  Private (Super Admin)
const getRolePermissions = async (req, res) => {
  try {
    const role = await Role.findByPk(req.params.id, {
      include: [
        {
          model: Permission,
          as: 'permissions',
          through: { attributes: [] }
        }
      ]
    });

    if (!role) {
      return res.status(404).json({ message: 'Role not found' });
    }

    res.json({ success: true, permissions: role.permissions });
  } catch (error) {
    console.error('Error fetching role permissions:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  getRoles,
  getRole,
  createRole,
  updateRole,
  deleteRole,
  assignPermissions,
  getRolePermissions
};

