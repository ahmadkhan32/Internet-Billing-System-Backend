// Pre-Start Database Check
// Run this before starting the server to ensure database is ready
// Usage: node pre-start-check.js

require('dotenv').config();
const dns = require('dns').promises;
const { Sequelize } = require('sequelize');

console.log('');
console.log('🔍 Pre-Start Database Check');
console.log('=====================================');
console.log('');

const dbHost = process.env.DB_HOST;

if (!dbHost) {
  console.error('❌ DB_HOST not set in .env file!');
  console.error('💡 Run: .\\get-supabase-credentials.ps1 to set up credentials');
  process.exit(1);
}

// Check DNS resolution
async function checkDNS() {
  try {
    console.log('📋 Step 1: Checking DNS resolution...');
    const addresses = await dns.resolve4(dbHost);
    console.log(`✅ DNS resolution successful!`);
    console.log(`   IP: ${addresses[0]}`);
    console.log('');
    return true;
  } catch (error) {
    console.log(`❌ DNS resolution FAILED!`);
    console.log(`   Error: ${error.message}`);
    console.log('');
    console.log('🔍 This means your Supabase project is PAUSED!');
    console.log('');
    console.log('✅ FIX STEPS:');
    console.log('   1. Go to: https://supabase.com/dashboard');
    console.log('   2. Click your project');
    console.log('   3. If "Paused" → Click "Restore"');
    console.log('   4. If "Active" → Click "Pause" → Wait 30s → Click "Restore"');
    console.log('   5. Wait 3-5 minutes for database to start');
    console.log('   6. Run this script again: node pre-start-check.js');
    console.log('');
    return false;
  }
}

// Check database connection
async function checkDatabase() {
  try {
    console.log('📋 Step 2: Testing database connection...');
    
    const sequelize = new Sequelize(
      process.env.DB_NAME || 'postgres',
      process.env.DB_USER || 'postgres',
      process.env.DB_PASSWORD || '',
      {
        host: dbHost,
        port: parseInt(process.env.DB_PORT || '6543'),
        dialect: 'postgres',
        logging: false,
        dialectOptions: {
          ssl: process.env.DB_SSL !== 'false' ? {
            require: true,
            rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false'
          } : false
        },
        pool: {
          max: 1,
          min: 0,
          acquire: 10000,
          idle: 5000
        }
      }
    );
    
    await sequelize.authenticate();
    console.log('✅ Database connection successful!');
    console.log('');
    await sequelize.close();
    return true;
  } catch (error) {
    console.log(`❌ Database connection FAILED!`);
    console.log(`   Error: ${error.message}`);
    console.log('');
    
    if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
      console.log('🔍 Issue: Supabase project is PAUSED');
      console.log('');
      console.log('✅ FIX STEPS:');
      console.log('   1. Go to: https://supabase.com/dashboard');
      console.log('   2. Click your project');
      console.log('   3. Click "Restore" (even if it shows "Active")');
      console.log('   4. Wait 3-5 minutes');
      console.log('   5. Run this script again');
      console.log('');
    } else if (error.message.includes('password') || error.message.includes('authentication')) {
      console.log('🔍 Issue: Wrong password or credentials');
      console.log('');
      console.log('✅ FIX STEPS:');
      console.log('   1. Go to Supabase Dashboard → Settings → Database');
      console.log('   2. Click "Reset database password" if needed');
      console.log('   3. Copy new password');
      console.log('   4. Run: .\\get-supabase-credentials.ps1');
      console.log('   5. Paste new connection string');
      console.log('');
    }
    
    return false;
  }
}

// Main check
async function runCheck() {
  const dnsOk = await checkDNS();
  
  if (!dnsOk) {
    console.log('❌ DNS check failed. Cannot proceed.');
    console.log('');
    console.log('💡 Restore Supabase project first, then run this script again.');
    console.log('');
    process.exit(1);
  }
  
  const dbOk = await checkDatabase();
  
  if (dbOk) {
    console.log('✅ All checks passed!');
    console.log('✅ Your database is ready!');
    console.log('');
    console.log('💡 You can now start your server: npm start');
    console.log('');
    process.exit(0);
  } else {
    console.log('❌ Database connection failed.');
    console.log('');
    console.log('💡 Fix the issue above, then run this script again.');
    console.log('');
    process.exit(1);
  }
}

runCheck().catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});

