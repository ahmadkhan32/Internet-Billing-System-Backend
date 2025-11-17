const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const SaaSPackage = sequelize.define('SaaSPackage', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    comment: 'Package name: Starter, Professional, Enterprise'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
    comment: 'Monthly subscription price'
  },
  duration: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
    comment: 'Duration in months (1, 3, 6, 12)'
  },
  features_json: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'JSON object with package features: {max_customers: 100, max_users: 5, analytics: true}'
  },
  max_customers: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Maximum number of end-customers allowed'
  },
  max_users: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 5,
    comment: 'Maximum number of ISP staff users'
  },
  commission_rate: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    defaultValue: 0.00,
    comment: 'Commission percentage (if applicable)'
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive', 'archived'),
    defaultValue: 'active'
  },
  is_featured: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Featured package for marketing'
  }
}, {
  tableName: 'saas_packages',
  timestamps: true
});

module.exports = SaaSPackage;

