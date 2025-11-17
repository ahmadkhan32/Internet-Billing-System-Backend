const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Permission = sequelize.define('Permission', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    comment: 'Permission name: create_bill, view_payment, etc.'
  },
  display_name: {
    type: DataTypes.STRING(200),
    allowNull: false,
    comment: 'Display name: Create Bill, View Payment, etc.'
  },
  resource: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: 'Resource: bills, payments, customers, etc.'
  },
  action: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: 'Action: create, read, update, delete, etc.'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'permissions',
  timestamps: true,
  indexes: [
    { fields: ['resource'] },
    { fields: ['action'] },
    { fields: ['resource', 'action'] }
  ]
});

module.exports = Permission;

