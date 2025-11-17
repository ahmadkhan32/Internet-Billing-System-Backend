const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const RolePermission = sequelize.define('RolePermission', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  role_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'roles',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  permission_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'permissions',
      key: 'id'
    },
    onDelete: 'CASCADE'
  }
}, {
  tableName: 'role_permissions',
  timestamps: true,
  // Simplified indexes - only keep the unique composite index
  // MySQL has a limit of 64 indexes per table
  // The composite index (role_id, permission_id) can be used for:
  // - Queries on role_id alone (leftmost prefix)
  // - Queries on both role_id and permission_id
  // We remove individual indexes to avoid hitting the 64 key limit
  indexes: [
    { 
      unique: true, 
      fields: ['role_id', 'permission_id'],
      name: 'unique_role_permission'
    }
  ]
});

module.exports = RolePermission;

