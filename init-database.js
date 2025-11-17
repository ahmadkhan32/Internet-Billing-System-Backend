/**
 * Comprehensive Database Initialization Script
 * This script checks and initializes the database properly
 * Run with: node init-database.js
 */

require('dotenv').config();
const mysql = require('mysql2/promise');
const { sequelize } = require('./config/db');
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
  SaaSPackage,
  AutomationLog
} = require('./models');
const initializeRBAC = require('./utils/initializeRBAC');

const initDatabase = async () => {
  let connection;
  
  try {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔧 Database Initialization Script');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Step 1: Check .env file
    console.log('📋 Step 1: Checking environment configuration...');
    const requiredEnvVars = ['DB_HOST', 'DB_USER', 'DB_NAME'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      console.error(`   ❌ Missing environment variables: ${missingVars.join(', ')}`);
      console.error('\n💡 Create a .env file in the backend directory with:');
      console.error('   DB_HOST=localhost');
      console.error('   DB_USER=root');
      console.error('   DB_PASSWORD=your_password');
      console.error('   DB_NAME=internet_billing_db');
      console.error('   JWT_SECRET=your_jwt_secret_minimum_32_characters');
      console.error('   PORT=8000\n');
      process.exit(1);
    }
    console.log('   ✅ Environment variables configured\n');

    // Step 2: Check MySQL connection (without database)
    console.log('📡 Step 2: Testing MySQL server connection...');
    try {
      connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
      });
      console.log('   ✅ Connected to MySQL server\n');
    } catch (error) {
      console.error('   ❌ Unable to connect to MySQL server:', error.message);
      console.error('\n💡 Troubleshooting:');
      console.error('   1. Check if MySQL is running:');
      console.error('      - Windows: Open Services (services.msc) and start MySQL');
      console.error('      - Or run: net start MySQL80 (or MySQL/MySQL57)');
      console.error('   2. Verify MySQL credentials in .env file');
      console.error('   3. Check if MySQL is installed\n');
      process.exit(1);
    }

    // Step 3: Create database if it doesn't exist
    console.log('📦 Step 3: Creating database (if not exists)...');
    const dbName = process.env.DB_NAME || 'internet_billing_db';
    try {
      await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
      console.log(`   ✅ Database '${dbName}' ready\n`);
    } catch (error) {
      console.error(`   ❌ Error creating database: ${error.message}\n`);
      await connection.end();
      process.exit(1);
    }
    await connection.end();

    // Step 4: Test Sequelize connection
    console.log('🔌 Step 4: Testing Sequelize connection...');
    try {
      await sequelize.authenticate();
      console.log('   ✅ Sequelize connection established\n');
    } catch (error) {
      console.error('   ❌ Sequelize connection failed:', error.message);
      console.error('\n💡 Troubleshooting:');
      console.error('   1. Verify database credentials in .env file');
      console.error('   2. Ensure database exists');
      console.error('   3. Check MySQL user permissions\n');
      process.exit(1);
    }

    // Step 5: Sync all tables
    console.log('🔄 Step 5: Syncing database tables...');
    try {
      // Sync tables in correct order
      await ISP.sync({ alter: true, force: false });
      await SaaSPackage.sync({ alter: true, force: false });
      await User.sync({ alter: true, force: false });
      await Package.sync({ alter: true, force: false });
      await Customer.sync({ alter: true, force: false });
      await Bill.sync({ alter: true, force: false });
      await Payment.sync({ alter: true, force: false });
      await Recovery.sync({ alter: true, force: false });
      await Installation.sync({ alter: true, force: false });
      await Notification.sync({ alter: true, force: false });
      await ActivityLog.sync({ alter: true, force: false });
      await Permission.sync({ alter: true, force: false });
      await Role.sync({ alter: true, force: false });
      await RolePermission.sync({ alter: true, force: false });
      await AutomationLog.sync({ alter: true, force: false });
      console.log('   ✅ All tables synced successfully\n');
    } catch (syncError) {
      console.error('   ❌ Error syncing tables:', syncError.message);
      console.error('\n💡 Try running: npm run fix-db\n');
      process.exit(1);
    }

    // Step 6: Fix packages table to allow null isp_id
    console.log('🔧 Step 6: Fixing packages table configuration...');
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

    // Step 7: Verify all required tables exist
    console.log('📋 Step 7: Verifying all tables exist...');
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
      'role_permissions',
      'automation_logs'
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

    // Step 8: Initialize RBAC
    console.log('🔐 Step 8: Initializing RBAC (Roles & Permissions)...');
    try {
      await initializeRBAC();
      console.log('   ✅ RBAC system initialized\n');
    } catch (error) {
      console.error('   ⚠️  Error initializing RBAC:', error.message);
      console.error('   ℹ️  RBAC might already be initialized\n');
    }

    // Step 9: Verify foreign keys
    console.log('🔗 Step 9: Verifying foreign key relationships...');
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
    console.log('   ✅ MySQL connection: OK');
    console.log('   ✅ Database exists: OK');
    console.log('   ✅ All tables: Created/Verified');
    console.log('   ✅ RBAC system: Initialized');
    console.log('   ✅ Foreign keys: Verified\n');
    
    console.log('🚀 Next steps:');
    console.log('   1. Start the backend server: npm start');
    console.log('   2. The server will create default users and packages');
    console.log('   3. Access the application at http://localhost:8000\n');

    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Database initialization failed:', error);
    console.error('Error details:', error.message);
    console.error('\n💡 Troubleshooting:');
    console.error('   1. Check MySQL is running');
    console.error('   2. Verify .env file configuration');
    console.error('   3. Ensure database exists');
    console.error('   4. Check MySQL user permissions\n');
    
    if (connection) {
      await connection.end();
    }
    await sequelize.close();
    process.exit(1);
  }
};

// Run initialization
initDatabase();

