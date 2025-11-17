const { Permission, Role } = require('../models');
const { sequelize } = require('../config/db');
const { validationResult } = require('express-validator');
const { Op } = require('sequelize');

// @desc    Get all permissions
// @route   GET /api/permissions
// @access  Private (Super Admin)
const getPermissions = async (req, res) => {
  try {
    // Check if Permission table exists
    const [tableExists] = await sequelize.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE() 
      AND table_name = 'permissions'
    `);
    
    if (tableExists[0].count === 0) {
      return res.status(500).json({ 
        message: 'Permissions table does not exist. Please restart the server to initialize the database.',
        error: 'Table not found'
      });
    }

    const { resource = '', action = '' } = req.query;

    const whereClause = {};
    if (resource) {
      whereClause.resource = resource;
    }
    if (action) {
      whereClause.action = action;
    }

    const permissions = await Permission.findAll({
      where: whereClause,
      include: [
        {
          model: Role,
          as: 'roles',
          through: { attributes: [] },
          attributes: ['id', 'name', 'display_name'],
          required: false // LEFT JOIN - allows permissions without roles
        }
      ],
      order: [['resource', 'ASC'], ['action', 'ASC']]
    });

    // Group by resource for better organization
    const grouped = permissions.reduce((acc, perm) => {
      if (!acc[perm.resource]) {
        acc[perm.resource] = [];
      }
      acc[perm.resource].push(perm);
      return acc;
    }, {});

    res.json({
      success: true,
      permissions: permissions || [],
      grouped
    });
  } catch (error) {
    console.error('Error fetching permissions:', error);
    
    // Provide more specific error messages
    if (error.name === 'SequelizeDatabaseError') {
      return res.status(500).json({ 
        message: 'Database error. Please ensure the database is properly initialized.',
        error: error.message 
      });
    }
    
    res.status(500).json({ 
      message: 'Server error while fetching permissions', 
      error: error.message 
    });
  }
};

// @desc    Get single permission
// @route   GET /api/permissions/:id
// @access  Private (Super Admin)
const getPermission = async (req, res) => {
  try {
    const permission = await Permission.findByPk(req.params.id, {
      include: [
        {
          model: Role,
          as: 'roles',
          through: { attributes: [] },
          attributes: ['id', 'name', 'display_name']
        }
      ]
    });

    if (!permission) {
      return res.status(404).json({ message: 'Permission not found' });
    }

    res.json({ success: true, permission });
  } catch (error) {
    console.error('Error fetching permission:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Create permission
// @route   POST /api/permissions
// @access  Private (Super Admin)
const createPermission = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, display_name, resource, action, description } = req.body;

    // Check if permission already exists
    const existingPermission = await Permission.findOne({ where: { name } });
    if (existingPermission) {
      return res.status(400).json({ message: 'Permission with this name already exists' });
    }

    const permission = await Permission.create({
      name,
      display_name,
      resource,
      action,
      description
    });

    res.status(201).json({ success: true, permission });
  } catch (error) {
    console.error('Error creating permission:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Update permission
// @route   PUT /api/permissions/:id
// @access  Private (Super Admin)
const updatePermission = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const permission = await Permission.findByPk(req.params.id);

    if (!permission) {
      return res.status(404).json({ message: 'Permission not found' });
    }

    await permission.update(req.body);

    res.json({ success: true, permission });
  } catch (error) {
    console.error('Error updating permission:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Delete permission
// @route   DELETE /api/permissions/:id
// @access  Private (Super Admin)
const deletePermission = async (req, res) => {
  try {
    const permission = await Permission.findByPk(req.params.id);

    if (!permission) {
      return res.status(404).json({ message: 'Permission not found' });
    }

    // Check if permission is assigned to any role
    const rolesWithPermission = await Role.count({
      include: [{
        model: Permission,
        as: 'permissions',
        where: { id: permission.id }
      }]
    });

    if (rolesWithPermission > 0) {
      return res.status(400).json({ 
        message: `Cannot delete permission. It is assigned to ${rolesWithPermission} role(s).` 
      });
    }

    await permission.destroy();

    res.json({ success: true, message: 'Permission deleted successfully' });
  } catch (error) {
    console.error('Error deleting permission:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  getPermissions,
  getPermission,
  createPermission,
  updatePermission,
  deletePermission
};

