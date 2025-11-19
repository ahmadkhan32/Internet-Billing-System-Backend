// Test Supabase Connection
// Run: node test-supabase-connection.js

require('dotenv').config();
const { Sequelize } = require('sequelize');

console.log('🔍 Testing Supabase Connection...\n');
console.log('📋 Current Configuration:');
console.log('   DB_DIALECT:', process.env.DB_DIALECT || 'NOT SET');
console.log('   DB_HOST:', process.env.DB_HOST || 'NOT SET');
console.log('   DB_PORT:', process.env.DB_PORT || 'NOT SET');
console.log('   DB_USER:', process.env.DB_USER || 'NOT SET');
console.log('   DB_PASSWORD:', process.env.DB_PASSWORD ? 'SET (' + process.env.DB_PASSWORD.length + ' chars)' : 'NOT SET');
console.log('   DB_NAME:', process.env.DB_NAME || 'NOT SET');
console.log('   DB_SSL:', process.env.DB_SSL || 'NOT SET');
console.log('');

// Check if pg is installed
try {
  require('pg');
} catch (error) {
  console.error('❌ pg package not installed!');
  console.error('💡 Run: npm install pg pg-hstore');
  process.exit(1);
}

// Create Sequelize instance
const sequelize = new Sequelize(
  process.env.DB_NAME || 'postgres',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    dialect: 'postgres',
    dialectModule: require('pg'),
    logging: console.log,
    dialectOptions: {
      ssl: process.env.DB_SSL === 'true' ? {
        require: true,
        rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false'
      } : false
    }
  }
);

// Test connection
(async () => {
  try {
    console.log('🔄 Attempting to connect...\n');
    await sequelize.authenticate();
    console.log('✅ Connection successful!');
    console.log('✅ Supabase database is accessible');
    console.log('\n💡 Your .env file is correct!');
    console.log('💡 You can now start the server with: npm start');
    process.exit(0);
  } catch (error) {
    console.error('❌ Connection failed!\n');
    console.error('Error:', error.message);
    console.error('Error Code:', error.code || 'UNKNOWN');
    console.error('');
    
    if (error.message.includes('ENOTFOUND')) {
      console.error('🔍 Diagnosis: Cannot resolve hostname');
      console.error('');
      console.error('💡 This usually means:');
      console.error('   1. Supabase project is PAUSED (most common)');
      console.error('   2. Wrong hostname in .env file');
      console.error('   3. Supabase project was deleted');
      console.error('');
      console.error('✅ Solutions:');
      console.error('   1. Go to https://supabase.com');
      console.error('   2. Check if project is paused → Click "Restore"');
      console.error('   3. Get fresh connection string from Settings → Database');
      console.error('   4. Update .env file with correct DB_HOST');
      console.error('');
      console.error('💡 Run: .\get-supabase-credentials.ps1 to update credentials');
    } else if (error.message.includes('password') || error.message.includes('authentication')) {
      console.error('🔍 Diagnosis: Authentication failed');
      console.error('');
      console.error('💡 Check:');
      console.error('   1. DB_USER is correct (usually "postgres")');
      console.error('   2. DB_PASSWORD is correct');
      console.error('   3. Get fresh password from Supabase Dashboard');
    } else if (error.message.includes('SSL')) {
      console.error('🔍 Diagnosis: SSL connection issue');
      console.error('');
      console.error('💡 Check:');
      console.error('   1. DB_SSL=true in .env');
      console.error('   2. DB_SSL_REJECT_UNAUTHORIZED=false');
    }
    
    process.exit(1);
  } finally {
    await sequelize.close();
  }
})();

