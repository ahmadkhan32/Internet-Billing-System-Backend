const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const ActivityLog = sequelize.define('ActivityLog', {
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
  action: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: 'e.g., CREATE_CUSTOMER, UPDATE_BILL, DELETE_PACKAGE'
  },
  entity_type: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'e.g., Customer, Bill, Payment'
  },
  entity_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'ID of the affected entity'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  old_values: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Previous values before change'
  },
  new_values: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'New values after change'
  },
  ip_address: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  user_agent: {
    type: DataTypes.STRING(500),
    allowNull: true
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
  tableName: 'activity_logs',
  timestamps: true,
  indexes: [
    { fields: ['user_id'] },
    { fields: ['entity_type', 'entity_id'] },
    { fields: ['action'] },
    { fields: ['isp_id'] },
    { fields: ['createdAt'] }
  ]
});

module.exports = ActivityLog;

