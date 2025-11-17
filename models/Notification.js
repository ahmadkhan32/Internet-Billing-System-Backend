const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Notification = sequelize.define('Notification', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  customer_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'customers',
      key: 'id'
    }
  },
  bill_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'bills',
      key: 'id'
    }
  },
  type: {
    type: DataTypes.ENUM(
      'bill_reminder', 
      'payment_received', 
      'bill_generated', 
      'overdue', 
      'service_update', 
      'system',
      'subscription_start',
      'subscription_expiry_reminder',
      'subscription_expired',
      'subscription_renewed',
      'business_suspended',
      'business_reactivated',
      'installation_completed'
    ),
    allowNull: false
  },
  title: {
    type: DataTypes.STRING(200),
    allowNull: false
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  channel: {
    type: DataTypes.ENUM('email', 'sms', 'in_app', 'both'),
    defaultValue: 'both'
  },
  email_sent: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  sms_sent: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  email_sent_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  sms_sent_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  is_read: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  read_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  scheduled_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'For scheduled notifications (e.g., 7 days before due date)'
  },
  isp_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'isps',
      key: 'id'
    }
  }
}, {
  tableName: 'notifications',
  timestamps: true
});

module.exports = Notification;

