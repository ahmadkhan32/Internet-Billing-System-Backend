const { Sequelize } = require('sequelize');
require('dotenv').config();

// Check if pg (PostgreSQL) is installed
let pgAvailable = false;
try {
  require('pg');
  pgAvailable = true;
} catch (pgError) {
  console.error('❌ pg package is not installed!');
  console.error('💡 Run: cd backend && npm install pg pg-hstore');
  console.warn('⚠️  Creating Sequelize instance without pg - install pg for PostgreSQL support');
  // Don't throw - create sequelize instance anyway so models can load
  pgAvailable = false;
}

// This file is only loaded when DB_DIALECT=postgres is set
// No need to check dialect here - db.js handles the routing

// Validate required environment variables
const checkEnvVar = (varName) => {
  return process.env[varName] !== undefined;
};

const requiredEnvVars = ['DB_NAME', 'DB_USER', 'DB_HOST'];
const missingVars = requiredEnvVars.filter(varName => !checkEnvVar(varName));

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingVars.join(', '));
  console.error('💡 Please set these in your .env file');
}

// Database configuration
const dbName = process.env.DB_NAME;
const dbUser = process.env.DB_USER;
const dbPassword = process.env.DB_PASSWORD || '';
const dbHost = process.env.DB_HOST;
const dbPort = process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 5432; // Default PostgreSQL port

// Configure SSL for Supabase (required)
const sslConfig = {};
const useSSL = process.env.DB_SSL !== 'false'; // Default to true for Supabase

if (useSSL) {
  sslConfig.ssl = {
    require: true,
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
  };
  console.log('🔒 SSL enabled for PostgreSQL connection (Supabase)');
}

// Always create sequelize instance, even with missing env vars
// This ensures models can load (connection will fail later if vars are missing)
let sequelize;
try {
  const sequelizeConfig = {
    database: dbName || 'postgres',
    username: dbUser || 'postgres',
    password: dbPassword || '',
    host: dbHost || 'localhost',
    port: dbPort,
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    dialectOptions: {
      ...sslConfig,
      // PostgreSQL specific options
    },
    pool: {
      max: process.env.VERCEL ? 1 : 5, // Single connection for serverless
      min: 0,
      acquire: process.env.VERCEL ? 10000 : 30000, // Faster timeout for serverless
      idle: process.env.VERCEL ? 5000 : 10000 // Shorter idle for serverless
    },
    retry: {
      max: 3,
      match: [
        /ETIMEDOUT/,
        /EHOSTUNREACH/,
        /ECONNRESET/,
        /ECONNREFUSED/,
        /ESOCKETTIMEDOUT/,
        /SequelizeConnectionError/,
        /SequelizeConnectionRefusedError/,
        /SequelizeHostNotFoundError/,
        /SequelizeHostNotReachableError/,
        /SequelizeInvalidConnectionError/,
        /SequelizeConnectionTimedOutError/
      ]
    }
  };

  // Only add dialectModule if pg is available
  if (pgAvailable) {
    sequelizeConfig.dialectModule = require('pg');
  }

  sequelize = new Sequelize(
    sequelizeConfig.database,
    sequelizeConfig.username,
    sequelizeConfig.password,
    sequelizeConfig
  );
} catch (seqError) {
  // If Sequelize creation fails, create a minimal instance
  console.error('❌ Error creating Sequelize instance:', seqError.message);
  console.warn('⚠️  Creating minimal Sequelize instance for model loading');
  try {
    sequelize = new Sequelize('postgres', 'postgres', '', {
      host: 'localhost',
      dialect: 'postgres',
      logging: false,
      retry: { max: 0 },
      pool: { max: 0, min: 0 }
    });
  } catch (fallbackError) {
    // Last resort: create with minimal config
    sequelize = new Sequelize({
      dialect: 'postgres',
      logging: false
    });
  }
}

// Test connection with retry logic
const testConnection = async (retries = 2) => {
  try {
    const requiredVars = ['DB_HOST', 'DB_USER', 'DB_NAME'];
    const missingVars = requiredVars.filter(v => !process.env[v] || process.env[v].trim() === '');
    
    if (process.env.DB_PASSWORD === undefined || process.env.DB_PASSWORD.trim() === '') {
      missingVars.push('DB_PASSWORD');
    }
    
    if (missingVars.length > 0) {
      const errorMsg = `Missing environment variables: ${missingVars.join(', ')}`;
      console.error('❌', errorMsg);
      console.error('💡 Please set these in your .env file');
      const err = new Error(errorMsg);
      err.code = 'MISSING_ENV_VARS';
      err.missingVars = missingVars;
      throw err;
    }
    
    // Attempt connection with retry logic
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        await sequelize.authenticate();
        console.log('✅ PostgreSQL connection established successfully.');
        return true;
      } catch (connError) {
        lastError = connError;
        if (attempt < retries) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff: 1s, 2s, 4s
          console.warn(`⚠️  Connection attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  } catch (error) {
    if (!error.code) {
      error.code = error.original?.code || error.parent?.code || 'UNKNOWN';
    }
    
    console.error('❌ Unable to connect to PostgreSQL database:', error.message);
    console.error('📋 Connection Details:');
    console.error('   Host:', process.env.DB_HOST || 'NOT SET');
    console.error('   User:', process.env.DB_USER || 'NOT SET');
    console.error('   Database:', process.env.DB_NAME || 'NOT SET');
    console.error('   Password:', process.env.DB_PASSWORD ? '***SET***' : 'NOT SET');
    console.error('   Error Code:', error.code);
    
    console.error('\n💡 Troubleshooting:');
    if (process.env.VERCEL) {
      console.error('   Vercel Deployment:');
      console.error('   1. ✅ Check environment variables in Vercel project settings');
      console.error('   2. ✅ Verify Supabase database credentials are correct');
      console.error('   3. ✅ Ensure SSL is enabled (DB_SSL=true)');
      console.error('   4. ✅ Check Supabase project is active (not paused)');
      console.error('   5. ✅ Verify connection string format from Supabase Dashboard');
      console.error('   6. ✅ For connection pooling, use port 6543 instead of 5432');
      
      // Provide specific guidance based on error
      if (error.message.includes('SSL') || error.message.includes('certificate')) {
        console.error('\n   🔒 SSL/TLS Issues:');
        console.error('   - Supabase requires SSL connections');
        console.error('   - Ensure DB_SSL=true and DB_SSL_REJECT_UNAUTHORIZED=false');
        console.error('   - Check Supabase connection string includes SSL parameters');
      }
      
      if (error.message.includes('ECONNREFUSED') || error.message.includes('timeout') || error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
        console.error('\n   🌐 Network/DNS Issues:');
        console.error('   - ERROR: Cannot resolve database hostname (ENOTFOUND)');
        console.error('   - This usually means:');
        console.error('     1. ❌ Supabase project is PAUSED (free tier auto-pauses after inactivity)');
        console.error('     2. ❌ Database hostname is incorrect');
        console.error('     3. ❌ Supabase project was deleted');
        console.error('   - Solutions:');
        console.error('     1. ✅ Go to Supabase Dashboard → Your Project');
        console.error('     2. ✅ Click "Restore" or "Resume" if project is paused');
        console.error('     3. ✅ Verify DB_HOST is correct: db.xxxxx.supabase.co');
        console.error('     4. ✅ Get fresh connection string from Supabase Dashboard');
        console.error('     5. ✅ Check Supabase project status (Settings → General)');
        console.error('   - Supabase allows connections from anywhere by default');
        console.error('   - Try using connection pooling port 6543');
      }
      
      if (error.message.includes('password') || error.message.includes('authentication')) {
        console.error('\n   🔐 Authentication Issues:');
        console.error('   - Verify DB_USER and DB_PASSWORD are correct');
        console.error('   - Get password from Supabase Dashboard → Settings → Database');
        console.error('   - Password is shown only once when project is created');
      }
    } else {
      console.error('   1. Check Supabase project settings');
      console.error('   2. Verify database credentials');
      console.error('   3. Ensure SSL is enabled (required for Supabase)');
      console.error('   4. Check database firewall settings');
      console.error('   5. Verify connection string format');
    }
    
    // In serverless mode, don't throw - let the request handler deal with it
    if (process.env.VERCEL || process.env.RAILWAY_ENVIRONMENT) {
      console.warn('⚠️  Continuing without database connection (serverless mode)');
      return false;
    }
    
    if (process.env.NODE_ENV !== 'production') {
      console.warn('⚠️  Continuing without database connection (local development)');
      return false;
    }
    throw error;
  }
};

// Ensure sequelize is always defined before exporting
if (!sequelize) {
  console.error('❌ CRITICAL: Sequelize instance is undefined! Creating fallback instance.');
  try {
    sequelize = new Sequelize({
      dialect: 'postgres',
      logging: false
    });
  } catch (finalError) {
    // Absolute last resort - create empty Sequelize
    const { Sequelize: SequelizeClass } = require('sequelize');
    sequelize = new SequelizeClass({
      dialect: 'postgres',
      logging: false
    });
  }
}

module.exports = { sequelize, testConnection };

