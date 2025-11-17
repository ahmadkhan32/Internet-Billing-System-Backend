const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const ISP = sequelize.define('ISP', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  business_id: {
    type: DataTypes.STRING(50),
    allowNull: true,
    unique: true,
    comment: 'Unique business identifier (e.g., BIZ-2024-0001)'
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  contact: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  subscription_plan: {
    type: DataTypes.ENUM('basic', 'premium', 'enterprise'),
    defaultValue: 'basic'
  },
  subscription_status: {
    type: DataTypes.ENUM('active', 'suspended', 'cancelled', 'pending', 'expired'),
    defaultValue: 'pending'
  },
  subscription_start_date: {
    type: DataTypes.DATE,
    allowNull: true
  },
  subscription_end_date: {
    type: DataTypes.DATE,
    allowNull: true
  },
  saas_package_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'saas_packages',
      key: 'id'
    },
    comment: 'FK to SaaS package subscription'
  },
  domain: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'ISP custom domain or subdomain'
  },
  registration_date: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'isps',
  timestamps: true
});

module.exports = ISP;

