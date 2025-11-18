/**
 * Test Database Connection Script
 * Run: node test-db-connection.js
 * 
 * This script tests the database connection and shows what's missing
 */

require('dotenv').config();
const { sequelize, testConnection } = require('./config/db');

async function testConnectionScript() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 Database Connection Test');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Check environment variables
  console.log('📋 Checking Environment Variables...\n');
  
  const requiredVars = {
    'DB_DIALECT': process.env.DB_DIALECT,
    'DB_HOST': process.env.DB_HOST,
    'DB_PORT': process.env.DB_PORT,
    'DB_USER': process.env.DB_USER,
    'DB_PASSWORD': process.env.DB_PASSWORD ? '***SET***' : undefined,
    'DB_NAME': process.env.DB_NAME,
    'DB_SSL': process.env.DB_SSL,
    'JWT_SECRET': process.env.JWT_SECRET ? '***SET***' : undefined
  };

  let allSet = true;
  for (const [key, value] of Object.entries(requiredVars)) {
    if (value) {
      console.log(`   ✅ ${key} = ${value}`);
    } else {
      console.log(`   ❌ ${key} = NOT SET`);
      allSet = false;
    }
  }

  console.log('');

  if (!allSet) {
    console.log('❌ Missing environment variables!');
    console.log('💡 Set these in your .env file or Vercel environment variables\n');
    return;
  }

  // Test Sequelize instance
  console.log('🔌 Testing Sequelize Instance...\n');
  if (!sequelize) {
    console.error('   ❌ Sequelize instance is undefined!');
    return;
  }
  console.log('   ✅ Sequelize instance created');
  console.log(`   ✅ Dialect: ${sequelize.getDialect()}`);
  console.log(`   ✅ Database: ${sequelize.config.database}`);
  console.log(`   ✅ Host: ${sequelize.config.host}`);
  console.log('');

  // Test connection
  console.log('🌐 Testing Database Connection...\n');
  try {
    const result = await testConnection();
    if (result) {
      console.log('   ✅ Database connection successful!');
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('✅ All checks passed! Database is ready.');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    } else {
      console.log('   ❌ Database connection failed');
    }
  } catch (error) {
    console.error('   ❌ Connection Error:', error.message);
    console.error('\n💡 Troubleshooting:');
    
    if (error.message.includes('Missing environment variables')) {
      console.error('   - Set all required environment variables');
      console.error('   - See SIMPLE_SUPABASE_SETUP.md for instructions');
    } else if (error.message.includes('ECONNREFUSED') || error.message.includes('timeout')) {
      console.error('   - Check DB_HOST is correct');
      console.error('   - Verify Supabase project is active (not paused)');
      console.error('   - Check database firewall settings');
    } else if (error.message.includes('password') || error.message.includes('authentication')) {
      console.error('   - Verify DB_USER and DB_PASSWORD are correct');
      console.error('   - Check password has no extra spaces');
    } else if (error.message.includes('SSL')) {
      console.error('   - Set DB_SSL=true');
      console.error('   - Set DB_SSL_REJECT_UNAUTHORIZED=false');
    }
    
    console.log('');
  } finally {
    await sequelize.close();
  }
}

testConnectionScript().catch(console.error);

