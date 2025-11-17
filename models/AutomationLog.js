const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const AutomationLog = sequelize.define('AutomationLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  type: {
    type: DataTypes.ENUM(
      'subscription_start',
      'subscription_expiry_reminder',
      'subscription_expired',
      'subscription_renewed',
      'auto_invoice_generated',
      'business_suspended',
      'business_reactivated',
      'installation_invoice',
      'n8n_webhook'
    ),
    allowNull: false,
    comment: 'Type of automation event'
  },
  business_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'isps',
      key: 'id'
    },
    comment: 'FK to business (ISP) - null for system-wide events'
  },
  customer_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'customers',
      key: 'id'
    }
  },
  invoice_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'bills',
      key: 'id'
    }
  },
  status: {
    type: DataTypes.ENUM('success', 'failed', 'pending'),
    defaultValue: 'pending'
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Description of what was done'
  },
  error_message: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Error details if status is failed'
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Additional data about the automation (e.g., webhook payload, cron details)'
  },
  triggered_by: {
    type: DataTypes.ENUM('cron', 'n8n', 'api', 'system'),
    defaultValue: 'system',
    comment: 'What triggered this automation'
  },
  triggered_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'When the automation was triggered'
  }
}, {
  tableName: 'automation_logs',
  timestamps: true,
  indexes: [
    {
      fields: ['type', 'status']
    },
    {
      fields: ['business_id']
    },
    {
      fields: ['createdAt']
    }
  ]
});

module.exports = AutomationLog;

