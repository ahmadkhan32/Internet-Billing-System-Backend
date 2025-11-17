const { Notification, User, Customer, Bill, ISP } = require('../models');
const { validationResult } = require('express-validator');
const { Op } = require('sequelize');
const sendEmail = require('../utils/sendEmail');
const sendSMS = require('../utils/smsService');

// @desc    Get all notifications
// @route   GET /api/notifications
// @access  Private
const getNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20, type = '', is_read = '', channel = '' } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {};
    
    // Customers see only their notifications
    if (req.user.role === 'customer') {
      const customer = await Customer.findOne({ 
        where: { 
          [Op.or]: [
            { email: req.user.email },
            { phone: req.user.email }
          ],
          ...(req.user.isp_id ? { isp_id: req.user.isp_id } : {})
        } 
      });
      if (customer) {
        whereClause[Op.or] = [
          { customer_id: customer.id },
          { user_id: req.user.id }
        ];
      } else {
        whereClause.user_id = req.user.id;
      }
    } else if (req.user.role !== 'super_admin') {
      whereClause.isp_id = req.user.isp_id;
    } else if (req.query.isp_id) {
      whereClause.isp_id = req.query.isp_id;
    }

    if (type) {
      whereClause.type = type;
    }

    if (is_read !== '') {
      whereClause.is_read = is_read === 'true';
    }

    if (channel) {
      whereClause.channel = channel;
    }

    const notifications = await Notification.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email']
        },
        {
          model: Customer,
          as: 'customer',
          attributes: ['id', 'name', 'email', 'phone']
        },
        {
          model: Bill,
          as: 'bill',
          attributes: ['id', 'bill_number', 'amount', 'due_date']
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
      notifications: notifications.rows,
      total: notifications.count,
      unread: await Notification.count({ where: { ...whereClause, is_read: false } }),
      page: parseInt(page),
      pages: Math.ceil(notifications.count / limit)
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get single notification
// @route   GET /api/notifications/:id
// @access  Private
const getNotification = async (req, res) => {
  try {
    const notification = await Notification.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email']
        },
        {
          model: Customer,
          as: 'customer',
          attributes: ['id', 'name', 'email', 'phone']
        },
        {
          model: Bill,
          as: 'bill',
          attributes: ['id', 'bill_number', 'amount', 'due_date']
        }
      ]
    });

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    // Check access
    if (req.user.role === 'customer') {
      const customer = await Customer.findOne({ 
        where: { 
          [Op.or]: [
            { email: req.user.email },
            { phone: req.user.email }
          ],
          ...(req.user.isp_id ? { isp_id: req.user.isp_id } : {})
        } 
      });
      if (notification.customer_id !== customer?.id && notification.user_id !== req.user.id) {
        return res.status(403).json({ message: 'Access denied' });
      }
    } else if (req.user.role !== 'super_admin' && notification.isp_id !== req.user.isp_id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Mark as read
    if (!notification.is_read) {
      notification.is_read = true;
      notification.read_at = new Date();
      await notification.save();
    }

    res.json({ success: true, notification });
  } catch (error) {
    console.error('Error fetching notification:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Create notification
// @route   POST /api/notifications
// @access  Private
const createNotification = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { user_id, customer_id, bill_id, type, title, message, channel, scheduled_at } = req.body;

    let ispId = req.user.isp_id;
    if (customer_id) {
      const customer = await Customer.findByPk(customer_id);
      if (customer) ispId = customer.isp_id;
    } else if (bill_id) {
      const bill = await Bill.findByPk(bill_id);
      if (bill) ispId = bill.isp_id;
    }

    const notification = await Notification.create({
      user_id,
      customer_id,
      bill_id,
      type,
      title,
      message,
      channel: channel || 'both',
      scheduled_at,
      isp_id: ispId
    });

    // Send email/SMS if not scheduled
    if (!scheduled_at || new Date(scheduled_at) <= new Date()) {
      await sendNotificationChannels(notification);
    }

    res.status(201).json({ success: true, notification });
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Mark notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
const markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findByPk(req.params.id);

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    // Check access
    if (req.user.role === 'customer') {
      const customer = await Customer.findOne({ 
        where: { 
          [Op.or]: [
            { email: req.user.email },
            { phone: req.user.email }
          ],
          ...(req.user.isp_id ? { isp_id: req.user.isp_id } : {})
        } 
      });
      if (notification.customer_id !== customer?.id && notification.user_id !== req.user.id) {
        return res.status(403).json({ message: 'Access denied' });
      }
    } else if (req.user.role !== 'super_admin' && notification.isp_id !== req.user.isp_id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    notification.is_read = true;
    notification.read_at = new Date();
    await notification.save();

    res.json({ success: true, notification });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Mark all notifications as read
// @route   PUT /api/notifications/read-all
// @access  Private
const markAllAsRead = async (req, res) => {
  try {
    const whereClause = { is_read: false };
    
    if (req.user.role === 'customer') {
      const customer = await Customer.findOne({ 
        where: { 
          [Op.or]: [
            { email: req.user.email },
            { phone: req.user.email }
          ],
          ...(req.user.isp_id ? { isp_id: req.user.isp_id } : {})
        } 
      });
      if (customer) {
        whereClause[Op.or] = [
          { customer_id: customer.id },
          { user_id: req.user.id }
        ];
      } else {
        whereClause.user_id = req.user.id;
      }
    } else if (req.user.role !== 'super_admin') {
      whereClause.isp_id = req.user.isp_id;
    }

    await Notification.update(
      { is_read: true, read_at: new Date() },
      { where: whereClause }
    );

    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Delete notification
// @route   DELETE /api/notifications/:id
// @access  Private
const deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findByPk(req.params.id);

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    // Check access
    if (req.user.role === 'customer') {
      const customer = await Customer.findOne({ 
        where: { 
          [Op.or]: [
            { email: req.user.email },
            { phone: req.user.email }
          ],
          ...(req.user.isp_id ? { isp_id: req.user.isp_id } : {})
        } 
      });
      if (notification.customer_id !== customer?.id && notification.user_id !== req.user.id) {
        return res.status(403).json({ message: 'Access denied' });
      }
    } else if (req.user.role !== 'super_admin' && notification.isp_id !== req.user.isp_id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await notification.destroy();

    res.json({ success: true, message: 'Notification deleted successfully' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Helper function to send notification via email/SMS
const sendNotificationChannels = async (notification) => {
  try {
    let email = null;
    let phone = null;

    if (notification.user_id) {
      const user = await User.findByPk(notification.user_id);
      if (user) email = user.email;
    }

    if (notification.customer_id) {
      const customer = await Customer.findByPk(notification.customer_id);
      if (customer) {
        email = customer.email || email;
        phone = customer.phone;
      }
    }

    // Send email
    if ((notification.channel === 'email' || notification.channel === 'both') && email && !notification.email_sent) {
      try {
        await sendEmail(email, notification.title, notification.message);
        notification.email_sent = true;
        notification.email_sent_at = new Date();
        await notification.save();
      } catch (error) {
        console.error('Error sending email notification:', error);
      }
    }

    // Send SMS
    if ((notification.channel === 'sms' || notification.channel === 'both') && phone && !notification.sms_sent) {
      try {
        await sendSMS(phone, notification.message);
        notification.sms_sent = true;
        notification.sms_sent_at = new Date();
        await notification.save();
      } catch (error) {
        console.error('Error sending SMS notification:', error);
      }
    }
  } catch (error) {
    console.error('Error in sendNotificationChannels:', error);
  }
};

module.exports = {
  getNotifications,
  getNotification,
  createNotification,
  markAsRead,
  markAllAsRead,
  deleteNotification
};

