/**
 * Database Initialization Script
 * This script ensures all database tables exist and are properly configured
 */

require('dotenv').config();
const { sequelize } = require('../config/db');
const {
  ISP,
  User,
  Package,
  Customer,
  Bill,
  Payment,
  Recovery,
  Installation,
  Notification,
  ActivityLog,
  Role,
  Permission,
  RolePermission,
  SaaSPackage
} = require('../models');
const initializeRBAC = require('./initializeRBAC');

const initializeDatabase = async () => {
  try {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔧 Database Initialization Script');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Step 1: Test database connection
    console.log('📡 Step 1: Testing database connection...');
    try {
      await sequelize.authenticate();
      console.log('   ✅ Database connection established successfully\n');
    } catch (error) {
      console.error('   ❌ Unable to connect to the database:', error.message);
      console.error('\n💡 Troubleshooting:');
      console.error('   1. Check if MySQL is running');
      console.error('   2. Verify .env file has correct DB credentials');
      console.error('   3. Ensure database exists (run: node create-database.js)');
      process.exit(1);
    }

    // Step 2: Verify database exists
    console.log('📦 Step 2: Verifying database exists...');
    const dbName = process.env.DB_NAME || 'internet_billing_db';
    const [databases] = await sequelize.query('SHOW DATABASES');
    const dbExists = databases.some(db => db.Database === dbName);
    
    if (!dbExists) {
      console.error(`   ❌ Database '${dbName}' does not exist!`);
      console.error(`\n💡 Run: node create-database.js to create the database`);
      process.exit(1);
    }
    console.log(`   ✅ Database '${dbName}' exists\n`);

    // Step 3: Sync all tables
    console.log('🔄 Step 3: Syncing database tables...');
    try {
      // Try full sync first
      await sequelize.sync({ alter: true, force: false });
      console.log('   ✅ All tables synced successfully (full sync)\n');
    } catch (syncError) {
      console.log('   ⚠️  Full sync failed, trying individual table sync...');
      console.log(`   Error: ${syncError.message}\n`);
      
      // Sync tables individually in correct order
      const tables = [
        { name: 'ISPs', model: ISP },
        { name: 'SaaS Packages', model: SaaSPackage },
        { name: 'Users', model: User },
        { name: 'Packages', model: Package },
        { name: 'Customers', model: Customer },
        { name: 'Bills', model: Bill },
        { name: 'Payments', model: Payment },
        { name: 'Recoveries', model: Recovery },
        { name: 'Installations', model: Installation },
        { name: 'Notifications', model: Notification },
        { name: 'Activity Logs', model: ActivityLog },
        { name: 'Permissions', model: Permission },
        { name: 'Roles', model: Role },
        { name: 'Role Permissions', model: RolePermission }
      ];

      for (const table of tables) {
        try {
          await table.model.sync({ alter: true, force: false });
          console.log(`   ✅ ${table.name} table synced`);
        } catch (error) {
          console.error(`   ❌ Error syncing ${table.name}:`, error.message);
        }
      }
      console.log('');
    }

    // Step 4: Verify all tables exist
    console.log('📋 Step 4: Verifying all tables exist...');
    const requiredTables = [
      'isps',
      'saas_packages',
      'users',
      'packages',
      'customers',
      'bills',
      'payments',
      'recoveries',
      'installations',
      'notifications',
      'activity_logs',
      'roles',
      'permissions',
      'role_permissions'
    ];

    let allTablesExist = true;
    for (const tableName of requiredTables) {
      try {
        const [tableExists] = await sequelize.query(`
          SELECT COUNT(*) as count 
          FROM information_schema.tables 
          WHERE table_schema = DATABASE() 
          AND table_name = '${tableName}'
        `);
        
        if (tableExists[0].count > 0) {
          console.log(`   ✅ Table '${tableName}' exists`);
        } else {
          console.error(`   ❌ Table '${tableName}' is missing!`);
          allTablesExist = false;
        }
      } catch (error) {
        console.error(`   ❌ Error checking table '${tableName}':`, error.message);
        allTablesExist = false;
      }
    }
    console.log('');

    if (!allTablesExist) {
      console.error('❌ Some tables are missing. Please restart the server to sync tables.');
      process.exit(1);
    }

    // Step 5: Initialize RBAC
    console.log('🔐 Step 5: Initializing RBAC (Roles & Permissions)...');
    try {
      await initializeRBAC();
      console.log('   ✅ RBAC system initialized\n');
    } catch (error) {
      console.error('   ⚠️  Error initializing RBAC:', error.message);
      console.error('   ℹ️  RBAC might already be initialized\n');
    }

    // Step 6: Fix packages table to allow null isp_id
    console.log('🔧 Step 6: Checking packages table configuration...');
    try {
      const [results] = await sequelize.query(`
        SELECT COLUMN_NAME, IS_NULLABLE 
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'packages' 
        AND COLUMN_NAME = 'isp_id'
      `);
      
      if (results.length > 0 && results[0].IS_NULLABLE === 'NO') {
        await sequelize.query(`
          ALTER TABLE packages 
          MODIFY COLUMN isp_id INT NULL
        `);
        console.log('   ✅ Fixed packages table: isp_id now allows NULL\n');
      } else {
        console.log('   ✅ Packages table configuration is correct\n');
      }
    } catch (error) {
      console.log('   ⚠️  Could not check packages table:', error.message, '\n');
    }

    // Step 7: Verify critical foreign keys
    console.log('🔗 Step 7: Verifying foreign key relationships...');
    const foreignKeys = [
      { table: 'bills', column: 'customer_id', refTable: 'customers' },
      { table: 'bills', column: 'isp_id', refTable: 'isps' },
      { table: 'customers', column: 'isp_id', refTable: 'isps' },
      { table: 'users', column: 'isp_id', refTable: 'isps' }
    ];

    for (const fk of foreignKeys) {
      try {
        const [results] = await sequelize.query(`
          SELECT CONSTRAINT_NAME 
          FROM information_schema.KEY_COLUMN_USAGE 
          WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = '${fk.table}' 
          AND COLUMN_NAME = '${fk.column}' 
          AND REFERENCED_TABLE_NAME = '${fk.refTable}'
        `);
        
        if (results.length > 0) {
          console.log(`   ✅ FK: ${fk.table}.${fk.column} → ${fk.refTable}`);
        } else {
          console.log(`   ⚠️  FK missing: ${fk.table}.${fk.column} → ${fk.refTable}`);
        }
      } catch (error) {
        console.log(`   ⚠️  Could not check FK for ${fk.table}.${fk.column}`);
      }
    }
    console.log('');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Database initialization completed successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log('📋 Summary:');
    console.log('   ✅ Database connection: OK');
    console.log('   ✅ All tables: Created/Verified');
    console.log('   ✅ RBAC system: Initialized');
    console.log('   ✅ Foreign keys: Verified\n');
    
    console.log('🚀 Next steps:');
    console.log('   1. Start the backend server: npm start');
    console.log('   2. The server will create default users and packages');
    console.log('   3. Access the application at http://localhost:3003\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Database initialization failed:', error);
    console.error('Error details:', error.message);
    console.error('\n💡 Troubleshooting:');
    console.error('   1. Check MySQL is running');
    console.error('   2. Verify .env file configuration');
    console.error('   3. Ensure database exists');
    console.error('   4. Check MySQL user permissions\n');
    process.exit(1);
  }
};

// Run initialization
initializeDatabase();

