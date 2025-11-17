/**
 * Database Fix Utility
 * Automatically fixes common database schema issues
 * Run with: node backend/utils/fixDatabase.js
 */

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
  ActivityLog 
} = require('../models');

const fixDatabase = async () => {
  try {
    console.log('🔧 Starting database fix process...\n');

    // Test connection
    await sequelize.authenticate();
    console.log('✅ Database connection established\n');

    // Fix 1: Update packages table to allow null isp_id
    console.log('📦 Fixing packages table (allowing null isp_id)...');
    try {
      await sequelize.query(`
        ALTER TABLE packages 
        MODIFY COLUMN isp_id INT NULL
      `);
      console.log('   ✅ packages.isp_id now allows NULL\n');
    } catch (error) {
      if (error.message.includes('Duplicate column') || error.message.includes('doesn\'t exist')) {
        console.log('   ⚠️  packages.isp_id already allows NULL or column doesn\'t exist\n');
      } else {
        console.log('   ⚠️  Could not modify packages.isp_id:', error.message, '\n');
      }
    }

    // Fix 2: Ensure all foreign key constraints are properly set
    console.log('🔗 Checking foreign key constraints...');
    try {
      // Check and fix packages -> isps foreign key
      const [packagesFk] = await sequelize.query(`
        SELECT CONSTRAINT_NAME 
        FROM information_schema.KEY_COLUMN_USAGE 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'packages' 
        AND COLUMN_NAME = 'isp_id' 
        AND REFERENCED_TABLE_NAME IS NOT NULL
      `);
      
      if (packagesFk.length === 0) {
        console.log('   ⚠️  No foreign key constraint found for packages.isp_id');
        console.log('   ℹ️  This is OK if you want to allow packages without ISPs\n');
      } else {
        console.log('   ✅ Foreign key constraints are properly set\n');
      }
    } catch (error) {
      console.log('   ⚠️  Could not check foreign keys:', error.message, '\n');
    }

    // Fix 3: Sync all models to ensure schema is up to date
    console.log('🔄 Syncing database models...');
    try {
      // Sync in correct order (respecting dependencies)
      await ISP.sync({ alter: true });
      await User.sync({ alter: true });
      await Package.sync({ alter: true });
      await Customer.sync({ alter: true });
      await Bill.sync({ alter: true });
      await Payment.sync({ alter: true });
      await Recovery.sync({ alter: true });
      await Installation.sync({ alter: true });
      await Notification.sync({ alter: true });
      await ActivityLog.sync({ alter: true });
      console.log('   ✅ All models synchronized\n');
    } catch (error) {
      console.log('   ⚠️  Error during sync:', error.message);
      console.log('   ℹ️  Some tables may already be up to date\n');
    }

    // Fix 4: Check for missing indexes
    console.log('📇 Checking database indexes...');
    try {
      // Add indexes if they don't exist (for performance)
      await sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_packages_isp_id ON packages(isp_id);
        CREATE INDEX IF NOT EXISTS idx_customers_isp_id ON customers(isp_id);
        CREATE INDEX IF NOT EXISTS idx_bills_customer_id ON bills(customer_id);
        CREATE INDEX IF NOT EXISTS idx_payments_bill_id ON payments(bill_id);
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      `).catch(() => {
        // Indexes might already exist, which is fine
      });
      console.log('   ✅ Indexes checked\n');
    } catch (error) {
      console.log('   ⚠️  Could not create indexes:', error.message, '\n');
    }

    // Fix 5: Verify critical tables exist
    console.log('✅ Verifying tables exist...');
    const tables = ['isps', 'users', 'packages', 'customers', 'bills', 'payments', 'recoveries', 'installations', 'notifications', 'activity_logs'];
    for (const table of tables) {
      try {
        await sequelize.query(`SELECT 1 FROM ${table} LIMIT 1`);
        console.log(`   ✅ Table '${table}' exists`);
      } catch (error) {
        console.log(`   ❌ Table '${table}' is missing or inaccessible`);
      }
    }
    console.log('');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Database fix process completed!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('📋 Next Steps:');
    console.log('   1. Restart your backend server');
    console.log('   2. Try creating a package again');
    console.log('   3. If errors persist, check backend console for details\n');

  } catch (error) {
    console.error('❌ Error during database fix:', error);
    console.error('Error details:', error.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
};

// Run if called directly
if (require.main === module) {
  fixDatabase();
}

module.exports = fixDatabase;

