const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Package = sequelize.define('Package', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  speed: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: 'e.g., 10Mbps, 20Mbps'
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  data_limit: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true,
    comment: 'Monthly data limit in GB (null = unlimited)'
  },
  duration: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    comment: 'Duration in months'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  isp_id: {
    type: DataTypes.INTEGER,
    allowNull: true, // Allow null for super_admin testing scenarios
    references: {
      model: 'isps',
      key: 'id'
    }
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'packages',
  timestamps: true
});

module.exports = Package;

