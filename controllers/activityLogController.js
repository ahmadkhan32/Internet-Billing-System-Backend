const { ActivityLog, User, ISP } = require('../models');
const { Op } = require('sequelize');

// @desc    Get all activity logs
// @route   GET /api/activity-logs
// @access  Private (Admin, Super Admin)
const getActivityLogs = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      action = '', 
      entity_type = '', 
      user_id = '',
      start_date = '',
      end_date = ''
    } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {};
    
    // Super admin can see all, others see only their ISP's logs
    if (req.user.role !== 'super_admin') {
      whereClause.isp_id = req.user.isp_id;
    } else if (req.query.isp_id) {
      whereClause.isp_id = req.query.isp_id;
    }

    if (action) {
      whereClause.action = action;
    }

    if (entity_type) {
      whereClause.entity_type = entity_type;
    }

    if (user_id) {
      whereClause.user_id = user_id;
    }

    if (start_date || end_date) {
      whereClause.createdAt = {};
      if (start_date) {
        whereClause.createdAt[Op.gte] = new Date(start_date);
      }
      if (end_date) {
        whereClause.createdAt[Op.lte] = new Date(end_date);
      }
    }

    const logs = await ActivityLog.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email', 'role']
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
      logs: logs.rows,
      total: logs.count,
      page: parseInt(page),
      pages: Math.ceil(logs.count / limit)
    });
  } catch (error) {
    console.error('Error fetching activity logs:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get single activity log
// @route   GET /api/activity-logs/:id
// @access  Private (Admin, Super Admin)
const getActivityLog = async (req, res) => {
  try {
    const log = await ActivityLog.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email', 'role']
        },
        {
          model: ISP,
          as: 'isp',
          attributes: ['id', 'name']
        }
      ]
    });

    if (!log) {
      return res.status(404).json({ message: 'Activity log not found' });
    }

    // Check access
    if (req.user.role !== 'super_admin' && log.isp_id !== req.user.isp_id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json({ success: true, log });
  } catch (error) {
    console.error('Error fetching activity log:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get activity logs for specific entity
// @route   GET /api/activity-logs/entity/:entity_type/:entity_id
// @access  Private (Admin, Super Admin)
const getEntityActivityLogs = async (req, res) => {
  try {
    const { entity_type, entity_id } = req.params;

    const whereClause = {
      entity_type,
      entity_id
    };

    // Super admin can see all, others see only their ISP's logs
    if (req.user.role !== 'super_admin') {
      whereClause.isp_id = req.user.isp_id;
    }

    const logs = await ActivityLog.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email', 'role']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: 100
    });

    res.json({ success: true, logs });
  } catch (error) {
    console.error('Error fetching entity activity logs:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  getActivityLogs,
  getActivityLog,
  getEntityActivityLogs
};

