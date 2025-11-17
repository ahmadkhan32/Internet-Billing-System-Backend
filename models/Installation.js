const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Installation = sequelize.define('Installation', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  customer_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'customers',
      key: 'id'
    }
  },
  technical_officer_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  request_date: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  scheduled_date: {
    type: DataTypes.DATE,
    allowNull: true
  },
  installation_date: {
    type: DataTypes.DATE,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('pending', 'scheduled', 'in_progress', 'completed', 'cancelled', 'on_hold'),
    defaultValue: 'pending'
  },
  connection_type: {
    type: DataTypes.ENUM('fiber', 'wireless', 'cable', 'dsl'),
    allowNull: true
  },
  bandwidth: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'e.g., 10Mbps, 20Mbps'
  },
  ip_address: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  equipment_details: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  installation_notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  service_address: {
    type: DataTypes.TEXT,
    allowNull: false
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
  tableName: 'installations',
  timestamps: true
});

module.exports = Installation;

