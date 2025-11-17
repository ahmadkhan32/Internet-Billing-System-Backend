const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Bill = sequelize.define('Bill', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  bill_number: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  customer_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'customers',
      key: 'id'
    }
  },
  package_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'packages',
      key: 'id'
    }
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  due_date: {
    type: DataTypes.DATE,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('pending', 'paid', 'partial', 'overdue', 'cancelled'),
    defaultValue: 'pending'
  },
  billing_period_start: {
    type: DataTypes.DATE,
    allowNull: false
  },
  billing_period_end: {
    type: DataTypes.DATE,
    allowNull: false
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  late_fee: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    comment: 'Late fee amount (5% of bill if overdue)'
  },
  total_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: 'Total amount including late fees'
  },
  paid_amount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    comment: 'Total amount paid so far'
  },
  isp_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'isps',
      key: 'id'
    }
  },
  completed_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Timestamp when bill status changed to paid (completed)'
  }
}, {
  tableName: 'bills',
  timestamps: true
});

module.exports = Bill;

