const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Recovery = sequelize.define('Recovery', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  recovery_officer_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  customer_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
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
  status: {
    type: DataTypes.ENUM('assigned', 'visited', 'paid', 'partial', 'not_available', 'refused'),
    defaultValue: 'assigned'
  },
  visit_date: {
    type: DataTypes.DATE,
    allowNull: true
  },
  amount_collected: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  remarks: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  next_visit_date: {
    type: DataTypes.DATE,
    allowNull: true
  },
  isp_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'isps',
      key: 'id'
    }
  }
}, {
  tableName: 'recoveries',
  timestamps: true
});

module.exports = Recovery;

