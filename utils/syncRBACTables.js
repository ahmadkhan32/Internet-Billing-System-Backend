/**
 * Script to manually sync RBAC tables (roles, permissions, role_permissions)
 * Run: node backend/utils/syncRBACTables.js
 */

require('dotenv').config();
const { sequelize } = require('../config/db');
const { Role, Permission, RolePermission } = require('../models');
const initializeRBAC = require('./initializeRBAC');

const syncRBACTables = async () => {
  try {
    console.log('🔄 Syncing RBAC tables...');
    
    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection established');

    // Sync tables in order (respecting dependencies)
    console.log('\n📋 Syncing tables...');
    
    // 1. Permission table (no dependencies)
    console.log('   Syncing permissions table...');
    await Permission.sync({ alter: true, force: false });
    console.log('   ✅ Permissions table synced');

    // 2. Role table (no dependencies)
    console.log('   Syncing roles table...');
    await Role.sync({ alter: true, force: false });
    console.log('   ✅ Roles table synced');

    // 3. RolePermission junction table (depends on Role and Permission)
    console.log('   Syncing role_permissions table...');
    await RolePermission.sync({ alter: true, force: false });
    console.log('   ✅ Role_permissions table synced');

    console.log('\n✅ All RBAC tables synced successfully!');

    // Initialize default roles and permissions
    console.log('\n🔐 Initializing default roles and permissions...');
    await initializeRBAC();
    console.log('\n✅ RBAC system fully initialized!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error syncing RBAC tables:', error);
    process.exit(1);
  }
};

syncRBACTables();

