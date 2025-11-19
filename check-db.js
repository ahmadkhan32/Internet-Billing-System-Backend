// Quick Database Connection Check
// Run this from backend directory: node check-db.js

require('dotenv').config();
const { Sequelize } = require('sequelize');

console.log('🔍 Quick Database Connection Check\n');
console.log('=====================================\n');

// Check if .env file is loaded
console.log('📋 Environment Variables:\n');
const vars = {
  'DB_DIALECT': process.env.DB_DIALECT,
  'DB_HOST': process.env.DB_HOST,
  'DB_PORT': process.env.DB_PORT,
  'DB_USER': process.env.DB_USER,
  'DB_PASSWORD': process.env.DB_PASSWORD ? '***SET***' : '❌ NOT SET',
  'DB_NAME': process.env.DB_NAME,
  'DB_SSL': process.env.DB_SSL,
  'DB_SSL_REJECT_UNAUTHORIZED': process.env.DB_SSL_REJECT_UNAUTHORIZED
};

let allSet = true;
Object.entries(vars).forEach(([key, value]) => {
  if (!value || value === '❌ NOT SET') {
    console.log(`  ❌ ${key}: NOT SET`);
    allSet = false;
  } else {
    console.log(`  ✅ ${key}: ${value}`);
  }
});

if (!allSet) {
  console.log('\n❌ Missing environment variables!');
  console.log('💡 Make sure .env file exists in backend directory with all required variables.\n');
  process.exit(1);
}

console.log('\n✅ All environment variables are set!\n');

// Test connection
console.log('🔌 Testing Database Connection...\n');

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
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

sequelize.authenticate()
  .then(() => {
    console.log('✅ SUCCESS! Database connection is working!\n');
    console.log('📋 Connection Details:');
    console.log(`   Host: ${process.env.DB_HOST}`);
    console.log(`   Port: ${process.env.DB_PORT}`);
    console.log(`   Database: ${process.env.DB_NAME}`);
    console.log(`   User: ${process.env.DB_USER}`);
    console.log(`   SSL: ${process.env.DB_SSL}\n`);
    console.log('✅ Your database is ready to use!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.log('❌ Connection Failed!\n');
    console.log(`Error: ${error.message}\n`);
    
    // Specific error analysis
    if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
      console.log('🔍 Issue: Cannot resolve database hostname');
      console.log('💡 Possible causes:');
      console.log('   1. Wrong DB_HOST value');
      console.log('   2. Network connectivity issue');
      console.log('   3. Supabase project might be paused');
      console.log('\n🔧 Try:');
      console.log('   1. Double-check DB_HOST in .env file');
      console.log('   2. Try using port 6543 (connection pooling)');
      console.log('   3. Check Supabase project status');
    } else if (error.message.includes('password') || error.message.includes('authentication')) {
      console.log('🔍 Issue: Authentication failed');
      console.log('💡 Wrong username or password');
      console.log('\n🔧 Fix:');
      console.log('   1. Go to Supabase Dashboard → Settings → Database');
      console.log('   2. Click "Reset database password"');
      console.log('   3. Copy new password');
      console.log('   4. Update DB_PASSWORD in .env file');
    } else if (error.message.includes('timeout') || error.message.includes('ECONNREFUSED')) {
      console.log('🔍 Issue: Connection timeout or refused');
      console.log('💡 Database is not accessible');
      console.log('\n🔧 Fix:');
      console.log('   1. Try using port 6543 instead of 5432');
      console.log('   2. Update DB_PORT=6543 in .env file');
      console.log('   3. Check Supabase project is active');
    } else if (error.message.includes('SSL')) {
      console.log('🔍 Issue: SSL/TLS configuration');
      console.log('\n🔧 Fix:');
      console.log('   Ensure in .env file:');
      console.log('   DB_SSL=true');
      console.log('   DB_SSL_REJECT_UNAUTHORIZED=false');
    } else {
      console.log('🔍 Unknown error - check error message above');
    }
    
    console.log('\n📋 Current Configuration:');
    console.log(`   DB_HOST: ${process.env.DB_HOST}`);
    console.log(`   DB_PORT: ${process.env.DB_PORT}`);
    console.log(`   DB_USER: ${process.env.DB_USER}`);
    console.log(`   DB_NAME: ${process.env.DB_NAME}`);
    console.log(`   DB_SSL: ${process.env.DB_SSL}`);
    console.log(`   DB_SSL_REJECT_UNAUTHORIZED: ${process.env.DB_SSL_REJECT_UNAUTHORIZED}\n`);
    
    process.exit(1);
  });

