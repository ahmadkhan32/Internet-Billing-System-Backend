const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Role = sequelize.define('Role', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: 'Role name: super_admin, admin, account_manager, etc.'
  },
  display_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: 'Display name: Super Admin, ISP Admin, etc.'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  business_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'isps',
      key: 'id'
    },
    comment: 'FK to business (ISP). NULL for system-wide roles (Super Admin). Business-specific roles have business_id.'
  },
  is_system_role: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'System roles cannot be deleted'
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'roles',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['name', 'business_id'],
      name: 'unique_role_per_business'
    }
  ]
});

module.exports = Role;

