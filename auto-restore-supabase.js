// Auto-Restore Supabase Project Checker
// This script checks if Supabase project is accessible and provides restore instructions
// Run: node auto-restore-supabase.js

require('dotenv').config();
const dns = require('dns').promises;
const { Sequelize } = require('sequelize');

console.log('🔍 Supabase Auto-Restore Checker\n');
console.log('=====================================\n');

// Get database host from environment
const dbHost = process.env.DB_HOST;

if (!dbHost) {
  console.error('❌ DB_HOST not set in .env file!');
  console.error('💡 Run: .\\get-supabase-credentials.ps1 to set up credentials\n');
  process.exit(1);
}

console.log(`📋 Checking hostname: ${dbHost}\n`);

// Step 1: DNS Lookup Test
async function checkDNS() {
  try {
    console.log('🔍 Step 1: Testing DNS resolution...');
    const addresses = await dns.resolve4(dbHost);
    console.log(`✅ DNS resolution successful!`);
    console.log(`   IP addresses: ${addresses.join(', ')}\n`);
    return true;
  } catch (error) {
    console.log(`❌ DNS resolution failed!`);
    console.log(`   Error: ${error.message}\n`);
    
    if (error.code === 'ENOTFOUND' || error.code === 'EAI_AGAIN') {
      console.log('🔍 Diagnosis: Hostname cannot be resolved');
      console.log('💡 This usually means:');
      console.log('   1. Supabase project is PAUSED (most common)');
      console.log('   2. Wrong hostname in .env file');
      console.log('   3. Network connectivity issue\n');
      
      console.log('✅ Solution:');
      console.log('   1. Go to https://supabase.com/dashboard');
      console.log('   2. Click your project');
      console.log('   3. If "Paused" → Click "Restore"');
      console.log('   4. If "Active" → Click "Pause" → Wait 30s → Click "Restore"');
      console.log('   5. Wait 3-5 minutes for database to start');
      console.log('   6. Run this script again: node auto-restore-supabase.js\n');
    }
    
    return false;
  }
}

// Step 2: Database Connection Test
async function checkDatabase() {
  try {
    console.log('🔍 Step 2: Testing database connection...');
    
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
    console.log('✅ Database connection successful!\n');
    await sequelize.close();
    return true;
  } catch (error) {
    console.log(`❌ Database connection failed!`);
    console.log(`   Error: ${error.message}\n`);
    
    if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
      console.log('🔍 Diagnosis: Cannot resolve hostname');
      console.log('💡 Supabase project is likely PAUSED\n');
      
      console.log('✅ Fix Steps:');
      console.log('   1. Go to https://supabase.com/dashboard');
      console.log('   2. Click your project');
      console.log('   3. Click "Restore" (even if it shows "Active")');
      console.log('   4. Wait 3-5 minutes');
      console.log('   5. Run: node auto-restore-supabase.js\n');
    } else if (error.message.includes('password') || error.message.includes('authentication')) {
      console.log('🔍 Diagnosis: Authentication failed');
      console.log('💡 Wrong password or credentials\n');
      
      console.log('✅ Fix Steps:');
      console.log('   1. Go to Supabase Dashboard → Settings → Database');
      console.log('   2. Click "Reset database password"');
      console.log('   3. Copy new password');
      console.log('   4. Run: .\\get-supabase-credentials.ps1');
      console.log('   5. Paste new connection string\n');
    } else if (error.message.includes('timeout') || error.message.includes('ECONNREFUSED')) {
      console.log('🔍 Diagnosis: Connection timeout');
      console.log('💡 Try using port 6543 (connection pooling)\n');
      
      console.log('✅ Fix Steps:');
      console.log('   1. Update backend/.env: DB_PORT=6543');
      console.log('   2. Run: node auto-restore-supabase.js\n');
    }
    
    return false;
  }
}

// Main check function
async function runCheck() {
  const dnsOk = await checkDNS();
  
  if (!dnsOk) {
    console.log('❌ DNS check failed. Cannot proceed with database test.\n');
    console.log('📋 Next Steps:');
    console.log('   1. Restore Supabase project (see instructions above)');
    console.log('   2. Wait 3-5 minutes');
    console.log('   3. Run this script again: node auto-restore-supabase.js\n');
    process.exit(1);
  }
  
  const dbOk = await checkDatabase();
  
  if (dbOk) {
    console.log('✅ All checks passed!');
    console.log('✅ Your Supabase project is active and accessible!\n');
    console.log('💡 To prevent this error:');
    console.log('   1. Set up monitoring to ping your API weekly');
    console.log('   2. Or upgrade to Supabase Pro (no auto-pause)');
    console.log('   3. Or use a cron job to keep project active\n');
    process.exit(0);
  } else {
    console.log('❌ Database connection failed. See error details above.\n');
    process.exit(1);
  }
}

// Run the check
runCheck().catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});

