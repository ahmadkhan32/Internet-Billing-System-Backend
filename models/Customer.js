const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Customer = sequelize.define('Customer', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: true,
    validate: {
      isEmail: true
    }
  },
  phone: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  cnic: {
    type: DataTypes.STRING(20),
    allowNull: true,
    unique: true
  },
  package_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'packages',
      key: 'id'
    }
  },
  isp_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'isps',
      key: 'id'
    }
  },
  connection_date: {
    type: DataTypes.DATE,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive', 'suspended', 'disconnected'),
    defaultValue: 'active'
  },
  billing_cycle: {
    type: DataTypes.INTEGER,
    defaultValue: 1, // 1 = monthly
    comment: 'Billing cycle in months'
  },
  next_billing_date: {
    type: DataTypes.DATE,
    allowNull: true
  },
  data_usage: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
    comment: 'Current month data usage in GB'
  },
  data_limit: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true,
    comment: 'Monthly data limit in GB (null = unlimited)'
  },
  data_reset_date: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Date when data usage resets'
  },
  customer_id: {
    type: DataTypes.STRING(50),
    allowNull: true,
    unique: true,
    comment: 'Unique customer identifier for login'
  },
  points: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    comment: 'Loyalty points earned from payments (0.01 points per PKR paid)'
  }
}, {
  tableName: 'customers',
  timestamps: true
});

module.exports = Customer;

