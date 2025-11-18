const { Sequelize } = require('sequelize');
require('dotenv').config();

// Get database dialect from environment
// Auto-detect Supabase if DB_HOST contains 'supabase'
let dbDialect = process.env.DB_DIALECT;
if (!dbDialect && process.env.DB_HOST && process.env.DB_HOST.includes('supabase')) {
  dbDialect = 'postgres';
  console.log('🔍 Auto-detected Supabase (PostgreSQL) from DB_HOST');
}
// Default to postgres for Supabase (cloud database)
if (!dbDialect) {
  dbDialect = 'postgres';
}

// If PostgreSQL is requested, use postgres config
if (dbDialect === 'postgres') {
  try {
    module.exports = require('./db-postgres');
    return;
  } catch (error) {
    console.error('❌ Error loading PostgreSQL config:', error.message);
    // Don't throw - create a dummy sequelize instance so models can load
    // Connection will fail later, but at least Sequelize will be defined
    const { Sequelize } = require('sequelize');
    try {
      const dummySequelize = new Sequelize('postgres', 'postgres', '', {
        host: 'localhost',
        dialect: 'postgres',
        logging: false,
        retry: { max: 0 }
      });
      const testConnection = async () => {
        throw new Error('PostgreSQL config failed to load. Check environment variables.');
      };
      module.exports = { sequelize: dummySequelize, testConnection };
      return;
    } catch (dummyError) {
      // If even dummy creation fails, fall through to MySQL config
      console.warn('⚠️  Could not create dummy PostgreSQL instance, falling back to MySQL');
    }
  }
}

// Check if mysql2 is installed (for MySQL)
try {
  require('mysql2');
} catch (mysql2Error) {
  console.error('❌ mysql2 package is not installed!');
  console.error('💡 Run: cd backend && npm install mysql2');
  if (process.env.VERCEL) {
    console.error('💡 Vercel: Check that backend dependencies are installed in build command');
    throw new Error('Please install mysql2 package manually. Check Vercel build logs and ensure backend/node_modules exists.');
  } else {
    throw mysql2Error;
  }
}

// Validate required environment variables
// Check if variables are undefined (not set), not just falsy
// This allows empty strings for local development (e.g., DB_PASSWORD= for no password)
const checkEnvVar = (varName) => {
  return process.env[varName] !== undefined;
};

const requiredEnvVars = ['DB_NAME', 'DB_USER', 'DB_HOST'];
const missingVars = requiredEnvVars.filter(varName => !checkEnvVar(varName));

// For DB_PASSWORD, check differently based on environment
// In Vercel/production, DB_PASSWORD must be set AND non-empty (security requirement)
// In local development, DB_PASSWORD can be empty string (DB_PASSWORD= means no password)
if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
  // In production, DB_PASSWORD must be set and non-empty
  if (!checkEnvVar('DB_PASSWORD') || process.env.DB_PASSWORD.trim() === '') {
    missingVars.push('DB_PASSWORD');
  }
} else {
  // In local development, DB_PASSWORD just needs to be defined (can be empty)
  if (!checkEnvVar('DB_PASSWORD')) {
    missingVars.push('DB_PASSWORD');
  }
}

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingVars.join(', '));
  if (process.env.VERCEL) {
    console.error('💡 Please set these in your Vercel project settings');
    console.error('💡 Go to: Vercel Dashboard → Settings → Environment Variables');
    console.error('💡 After adding variables, you MUST redeploy for them to take effect!');
  } else if (process.env.RAILWAY_ENVIRONMENT) {
    console.error('💡 Please set these in your Railway project settings');
    console.error('💡 Go to: Railway Dashboard → Your Project → Variables');
    console.error('💡 After adding variables, you MUST redeploy for them to take effect!');
  } else {
    console.error('💡 Please set these in your .env file');
    console.error('💡 Note: DB_PASSWORD can be empty (DB_PASSWORD=) if MySQL has no password');
  }
  // Don't exit in production/serverless mode - let it fail gracefully on first request
  if (process.env.VERCEL || process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV === 'production') {
    console.warn('⚠️  Server will continue but database operations will fail');
  } else {
    console.error('⚠️  Server will continue but database operations will fail');
  }
}

// In Vercel/production, don't use localhost defaults - require explicit values
const dbName = process.env.DB_NAME;
const dbUser = process.env.DB_USER;
const dbPassword = process.env.DB_PASSWORD;
const dbHost = process.env.DB_HOST;
const dbPort = process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306; // Default MySQL port

// In production (Vercel or Railway), check for missing variables but don't crash
// Allow the app to start and show helpful error messages on first request
if (process.env.VERCEL || process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV === 'production') {
  const missing = [];
  if (!dbHost || dbHost.trim() === '') missing.push('DB_HOST');
  if (!dbUser || dbUser.trim() === '') missing.push('DB_USER');
  // In production, DB_PASSWORD must be set and non-empty
  if (!dbPassword || dbPassword.trim() === '') missing.push('DB_PASSWORD');
  if (!dbName || dbName.trim() === '') missing.push('DB_NAME');
  
  if (missing.length > 0) {
    const platform = process.env.VERCEL ? 'Vercel' : process.env.RAILWAY_ENVIRONMENT ? 'Railway' : 'production';
    const errorMsg = `Missing required environment variables: ${missing.join(', ')}. Please set these in ${platform} project settings.`;
    console.error('❌', errorMsg);
    
    if (process.env.VERCEL) {
      console.error('💡 Go to: Vercel Dashboard → Settings → Environment Variables');
    } else if (process.env.RAILWAY_ENVIRONMENT) {
      console.error('💡 Go to: Railway Dashboard → Your Project → Variables');
    } else {
      console.error('💡 Set these environment variables in your deployment platform');
    }
    
    console.error('💡 See SET_ENV_VARIABLES_URGENT.md for step-by-step instructions');
    console.error('💡 After adding variables, you MUST redeploy for them to take effect!');
    
    // Don't throw in production - let the request handler show the error
    // This allows the app to start and show helpful error messages
    // The database connection will fail gracefully on first request
    console.warn('⚠️  Continuing without database connection - will fail on first database request');
  }
}

// Configure SSL for cloud databases
// Most cloud databases (PlanetScale, AWS RDS, etc.) require SSL
// ngrok tunnels don't use SSL, so disable for ngrok hosts
const sslConfig = {};
const useSSL = process.env.DB_SSL !== 'false'; // Default to true unless explicitly disabled
const isNgrok = dbHost?.includes('ngrok.io') || dbHost?.includes('ngrok-free.app');
// PlanetScale and other cloud databases require SSL
const isCloudDatabase = dbHost?.includes('.psdb.cloud') || dbHost?.includes('.rds.amazonaws.com') || dbHost?.includes('.railway.app') || dbHost?.includes('planetscale.com');

if (isNgrok) {
  // ngrok tunnels don't support SSL for TCP connections
  console.log('🌐 ngrok tunnel detected - SSL disabled');
} else if (useSSL && (process.env.VERCEL || process.env.NODE_ENV === 'production' || isCloudDatabase)) {
  // Cloud databases typically require SSL
  sslConfig.ssl = {
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false', // Default to true for security
    // For PlanetScale and most cloud providers, we don't need to provide certs
    // They use public CA certificates
  };
  console.log('🔒 SSL enabled for database connection (cloud database detected)');
} else if (useSSL && process.env.DB_SSL === 'true') {
  // Explicitly enabled via environment variable
  sslConfig.ssl = {
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
  };
  console.log('🔒 SSL enabled for database connection (explicitly configured)');
}

// Always create sequelize instance, even with missing env vars
// This ensures models can load (connection will fail later if vars are missing)
const sequelize = new Sequelize(
  dbName || 'internet_billing_db',
  dbUser || 'root',
  dbPassword || '',
  {
    host: dbHost || 'localhost',
    port: dbPort,
    dialect: 'mysql',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    dialectOptions: {
      ...sslConfig,
      // Additional connection options
      // Reduce timeout for serverless - 10 seconds max for faster failure
      connectTimeout: process.env.VERCEL ? 10000 : 30000,
      // Support for timezone
      timezone: '+00:00',
    },
    pool: {
      max: process.env.VERCEL ? 1 : 5, // Single connection for serverless
      min: 0,
      // Reduce acquire timeout for serverless - 10 seconds max for faster failure
      acquire: process.env.VERCEL ? 10000 : 30000,
      idle: process.env.VERCEL ? 5000 : 10000 // Shorter idle for serverless
    },
    // Add connection retry for serverless
    retry: {
      max: 3,
      match: [
        /ETIMEDOUT/,
        /EHOSTUNREACH/,
        /ECONNRESET/,
        /ECONNREFUSED/,
        /ETIMEDOUT/,
        /ESOCKETTIMEDOUT/,
        /EHOSTUNREACH/,
        /EPIPE/,
        /EAI_AGAIN/,
        /SequelizeConnectionError/,
        /SequelizeConnectionRefusedError/,
        /SequelizeHostNotFoundError/,
        /SequelizeHostNotReachableError/,
        /SequelizeInvalidConnectionError/,
        /SequelizeConnectionTimedOutError/
      ]
    }
  }
);

// Test connection with retry logic
// Reduce retries for serverless to avoid timeouts
const testConnection = async (retries = process.env.VERCEL ? 1 : 2) => {
  try {
    // Check environment variables first
    // In local development, DB_PASSWORD can be empty (no password)
    // In Vercel/production, all variables must be explicitly set
    const requiredVars = ['DB_HOST', 'DB_USER', 'DB_NAME'];
    const missingVars = requiredVars.filter(v => !process.env[v] || process.env[v].trim() === '');
    
    // For Vercel/production, DB_PASSWORD must be set AND non-empty (security requirement)
    if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
      if (process.env.DB_PASSWORD === undefined || process.env.DB_PASSWORD.trim() === '') {
        missingVars.push('DB_PASSWORD');
      }
    }
    // For local development, DB_PASSWORD can be empty string (means no password)
    // Empty string is valid for local MySQL with no password
    // But it still needs to be defined (DB_PASSWORD=)
    if (!process.env.VERCEL && process.env.NODE_ENV !== 'production') {
      if (process.env.DB_PASSWORD === undefined) {
        missingVars.push('DB_PASSWORD');
      }
    }
    
    if (missingVars.length > 0) {
      const errorMsg = `Missing environment variables: ${missingVars.join(', ')}`;
      console.error('❌', errorMsg);
      if (process.env.VERCEL) {
        console.error('💡 Go to: Vercel Dashboard → Settings → Environment Variables');
        console.error('💡 Add these variables and redeploy');
      } else {
        console.error('💡 Please set these in your .env file');
        console.error('💡 Note: DB_PASSWORD can be empty (DB_PASSWORD=) if MySQL has no password');
      }
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
        console.log('✅ Database connection established successfully.');
        return true;
      } catch (connError) {
        lastError = connError;
        if (attempt < retries) {
          // Shorter delays for serverless
          const delay = process.env.VERCEL 
            ? 500 * (attempt + 1) // 500ms, 1000ms for serverless
            : Math.pow(2, attempt) * 1000; // Exponential backoff: 1s, 2s, 4s for local
          console.warn(`⚠️  Connection attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // All retries failed, throw the last error
    throw lastError;
  } catch (error) {
    // Preserve error code and details for diagnostics
    if (!error.code) {
      error.code = error.original?.code || error.parent?.code || 'UNKNOWN';
    }
    
    console.error('❌ Unable to connect to the database:', error.message);
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
      console.error('   2. ✅ Verify database allows connections from Vercel IPs (0.0.0.0/0)');
      console.error('   3. ✅ Check database credentials are correct');
      console.error('   4. ✅ Ensure database is accessible from the internet');
      console.error('   5. ✅ Check database firewall/security groups allow external connections');
      console.error('   6. ✅ For cloud databases (PlanetScale, AWS RDS), SSL is automatically enabled');
      console.error('   7. ✅ If SSL issues, set DB_SSL=false (not recommended for production)');
      
      // Provide specific guidance based on error
      if (error.message.includes('SSL') || error.message.includes('certificate')) {
        console.error('\n   🔒 SSL/TLS Issues:');
        console.error('   - Cloud databases require SSL connections');
        console.error('   - SSL is automatically enabled for: .psdb.cloud, .rds.amazonaws.com, .railway.app');
        console.error('   - If you see SSL errors, verify your database supports SSL');
        console.error('   - Check database provider documentation for SSL requirements');
      }
      
      if (error.message.includes('ECONNREFUSED') || error.message.includes('timeout')) {
        console.error('\n   🌐 Network/Firewall Issues:');
        console.error('   - Database must allow connections from anywhere (0.0.0.0/0)');
        console.error('   - Vercel uses dynamic IPs, so IP whitelisting won\'t work');
        console.error('   - Check database provider firewall settings');
        console.error('   - Verify database is publicly accessible (not private network only)');
      }
      
      if (error.message.includes('Access denied') || error.message.includes('password')) {
        console.error('\n   🔐 Authentication Issues:');
        console.error('   - Verify DB_USER and DB_PASSWORD are correct');
        console.error('   - Check if database user has proper permissions');
        console.error('   - Ensure user can connect from external IPs');
      }
    } else {
      console.error('   1. Check if MySQL is running');
      console.error('   2. Verify .env file has correct DB credentials');
      console.error('   3. Ensure database exists (run: npm run init-db)');
      console.error('   4. Check MySQL user permissions');
      console.error('   5. For local MySQL, SSL is disabled by default');
    }
    
    // In serverless mode or local dev, don't throw - let the request handler deal with it
    if (process.env.VERCEL || process.env.RAILWAY_ENVIRONMENT) {
      console.warn('⚠️  Continuing without database connection (serverless mode)');
      return false;
    }
    // In local dev, return false instead of throwing to allow server to start
    if (process.env.NODE_ENV !== 'production') {
      console.warn('⚠️  Continuing without database connection (local development)');
      console.warn('💡 Server will start but database operations will fail');
      return false;
    }
    throw error; // Re-throw in production (non-serverless)
  }
};

// Ensure sequelize is always defined before exporting
if (!sequelize) {
  console.error('❌ CRITICAL: Sequelize instance is undefined! Creating fallback instance.');
  try {
    sequelize = new Sequelize({
      dialect: 'mysql',
      logging: false
    });
  } catch (finalError) {
    // Absolute last resort
    const { Sequelize: SequelizeClass } = require('sequelize');
    sequelize = new SequelizeClass({
      dialect: 'mysql',
      logging: false
    });
  }
}

module.exports = { sequelize, testConnection };

