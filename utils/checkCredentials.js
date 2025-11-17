/**
 * Utility script to check and verify login credentials
 * Run with: node -e "require('./utils/checkCredentials.js')"
 */

const User = require('../models/User');
const { sequelize } = require('../config/db');
const bcrypt = require('bcryptjs');

const checkCredentials = async () => {
  try {
    console.log('🔍 Checking login credentials...\n');
    
    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection OK\n');

    // Find super admin
    const superAdmin = await User.findOne({ 
      where: { email: 'admin@billing.com' } 
    });

    if (!superAdmin) {
      console.log('❌ Super admin user not found!');
      console.log('   The user should be created automatically when the server starts.');
      console.log('   Make sure to start the server at least once to create the default admin.\n');
      return;
    }

    console.log('✅ Super admin user found!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 Email:    admin@billing.com');
    console.log('🔑 Password: admin123');
    console.log('👤 Role:     Super Admin');
    console.log('📊 Status:   ', superAdmin.is_active ? '✅ Active' : '❌ Inactive');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Test password verification
    console.log('🧪 Testing password verification...');
    const testPassword = 'admin123';
    const isMatch = await superAdmin.comparePassword(testPassword);
    
    if (isMatch) {
      console.log('✅ Password verification: SUCCESS');
      console.log('   The password "admin123" is correctly hashed and can be verified.\n');
    } else {
      console.log('❌ Password verification: FAILED');
      console.log('   The password hash might be corrupted.');
      console.log('   Solution: Delete the user and restart the server to recreate it.\n');
    }

    // Check if password is hashed (should start with $2a$ or $2b$)
    if (superAdmin.password.startsWith('$2a$') || superAdmin.password.startsWith('$2b$')) {
      console.log('✅ Password is properly hashed (bcrypt)');
    } else {
      console.log('⚠️  WARNING: Password does not appear to be hashed!');
      console.log('   This is a security issue. The password should be hashed.');
    }

    console.log('\n📝 Summary:');
    console.log('   Email:    admin@billing.com');
    console.log('   Password: admin123');
    console.log('   Use these credentials to login to the system.\n');

  } catch (error) {
    console.error('❌ Error checking credentials:', error.message);
    console.error('\nPossible issues:');
    console.error('1. Database connection failed - check your .env file');
    console.error('2. Database tables not created - start the server first');
    console.error('3. User model not properly loaded\n');
  } finally {
    await sequelize.close();
  }
};

// Run if called directly
if (require.main === module) {
  require('dotenv').config();
  checkCredentials();
}

module.exports = checkCredentials;

