const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { sequelize, testConnection } = require('./config/db');

// Load models - must always succeed for routes to work
// Models don't connect to database until used, so they can be loaded safely
const models = require('./models');
const { User, ISP, Customer, Package, Bill, Payment, Recovery, Installation, Notification, ActivityLog, Role, Permission } = models;

// Import routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const customerRoutes = require('./routes/customerRoutes');
const billingRoutes = require('./routes/billingRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const recoveryRoutes = require('./routes/recoveryRoutes');
const reportRoutes = require('./routes/reportRoutes');
const packageRoutes = require('./routes/packageRoutes');
const installationRoutes = require('./routes/installationRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const activityLogRoutes = require('./routes/activityLogRoutes');
const ispRoutes = require('./routes/ispRoutes');
const superAdminRoutes = require('./routes/superAdminRoutes');
const saaSPackageRoutes = require('./routes/saaSPackageRoutes');
const roleRoutes = require('./routes/roleRoutes');
const permissionRoutes = require('./routes/permissionRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const automationRoutes = require('./routes/automationRoutes');
const { initializeScheduler } = require('./utils/monthlyScheduler');
const initializeRBAC = require('./utils/initializeRBAC');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
// Default localhost origins for development
const defaultLocalhostOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:3002'
];

const allowedOrigins = process.env.FRONTEND_URL 
  ? [process.env.FRONTEND_URL, ...defaultLocalhostOrigins]
  : defaultLocalhostOrigins;

// Add Vercel URL to allowed origins if in Vercel environment
if (process.env.VERCEL_URL) {
  allowedOrigins.push(`https://${process.env.VERCEL_URL}`);
}
if (process.env.VERCEL) {
  // Allow all Vercel preview and production URLs
  allowedOrigins.push(/^https:\/\/.*\.vercel\.app$/);
}

// Enhanced CORS configuration for Vercel
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // In development, always allow localhost
    if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        console.log('✅ CORS: Allowing localhost origin:', origin);
        return callback(null, true);
      }
    }
    
    // In Vercel environment, allow all Vercel URLs (preview and production)
    if (process.env.VERCEL) {
      // Allow any Vercel domain
      if (origin.includes('.vercel.app')) {
        return callback(null, true);
      }
    }
    
    // Check if origin matches allowed origins
    const isAllowed = allowedOrigins.some(allowed => {
      if (typeof allowed === 'string') {
        return allowed === origin;
      } else if (allowed instanceof RegExp) {
        return allowed.test(origin);
      }
      return false;
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      // In development or Vercel, allow all origins
      if (process.env.NODE_ENV !== 'production' || process.env.VERCEL) {
        console.log('✅ CORS: Allowing origin (development/Vercel):', origin);
        callback(null, true);
      } else {
        console.warn('⚠️  CORS: Origin not allowed:', origin);
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (for invoice downloads)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Database connection check middleware for serverless (before routes)
// Only check on first request, allow routes to handle their own errors
// Optimized for speed - no blocking checks
if (process.env.VERCEL) {
  let dbConnectionChecked = false;
  let dbConnectionStatus = null;
  
  app.use('/api', async (req, res, next) => {
    // Skip health check and diagnostic - they handle their own connection check
    if (req.path === '/health' || req.path === '/diagnose') {
      return next();
    }
    
    // Only check connection once, then cache the result
    // Use a quick timeout to avoid blocking
    if (!dbConnectionChecked) {
      dbConnectionChecked = true; // Set immediately to prevent concurrent checks
      try {
        // Quick connection test with 5 second timeout (increased for slow connections)
        await Promise.race([
          sequelize.authenticate(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Connection check timeout')), 5000)
          )
        ]);
        dbConnectionStatus = true;
        console.log('✅ Database connection verified in serverless mode');
      } catch (error) {
        dbConnectionStatus = false;
        console.warn('⚠️  Database connection check skipped (will connect on first query):', error.message);
        // Don't block - let routes handle the error
        // This allows the app to start even if DB is temporarily unavailable
      }
    }
    
    // Continue to route immediately - don't wait for connection
    next();
  });
}

// Handle preflight OPTIONS requests explicitly
app.options('*', cors());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/bills', billingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/recoveries', recoveryRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/packages', packageRoutes);
app.use('/api/installations', installationRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/activity-logs', activityLogRoutes);
app.use('/api/isps', ispRoutes);
app.use('/api/super-admin', superAdminRoutes);
app.use('/api/saas-packages', saaSPackageRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/automation', automationRoutes);

// Health check route
app.get('/api/health', async (req, res) => {
  try {
    // Test database connection
    const isConnected = await testConnection();
    if (isConnected) {
      res.json({ 
        status: 'OK', 
        message: 'Server is running',
        database: 'connected'
      });
    } else {
      res.status(503).json({ 
        status: 'ERROR', 
        message: 'Server is running but database connection failed',
        database: 'disconnected',
        error: process.env.VERCEL ? 'Check environment variables and database configuration' : undefined
      });
    }
  } catch (error) {
    const isDev = process.env.NODE_ENV === 'development' || process.env.VERCEL;
    res.status(503).json({ 
      status: 'ERROR', 
      message: 'Server is running but database connection failed',
      database: 'disconnected',
      error: isDev ? error.message : 'Database connection error',
      hint: 'Check environment variables: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME',
      troubleshooting: [
        'Verify database credentials are correct in Vercel environment variables',
        'Check database is accessible from internet (not private network)',
        'For Supabase: Verify project is active (not paused) and credentials are correct',
        'Check database firewall allows connections from 0.0.0.0/0',
        'Verify database is running and not paused'
      ]
    });
  }
});

// Health check endpoint - simple status check
app.get('/api/health', async (req, res) => {
  try {
    const dbStatus = await testConnection();
    res.json({
      status: 'ok',
      database: dbStatus ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    // Provide detailed error information
    const missingVars = [];
    const requiredVars = ['DB_HOST', 'DB_USER', 'DB_NAME', 'DB_PASSWORD'];
    requiredVars.forEach(v => {
      if (!process.env[v] || process.env[v].trim() === '') {
        missingVars.push(v);
      }
    });
    
    res.status(503).json({
      status: 'error',
      database: 'disconnected',
      error: error.message,
      missingVariables: missingVars.length > 0 ? missingVars : undefined,
      troubleshooting: {
        steps: [
          '1. Check environment variables in Vercel Settings → Environment Variables',
          '2. Verify Supabase project is active (not paused)',
          '3. Check database credentials are correct',
          '4. Ensure DB_SSL=true is set for Supabase',
          '5. Redeploy after setting environment variables'
        ],
        guides: [
          'See FIX_DATABASE_CONNECTION_NOW.md for quick fix',
          'See DATABASE_CONNECTION_TROUBLESHOOTING.md for detailed help'
        ]
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Diagnostic endpoint - provides detailed connection information
app.get('/api/diagnose', async (req, res) => {
  const diagnostics = {
    timestamp: new Date().toISOString(),
    environment: {
      NODE_ENV: process.env.NODE_ENV || 'not set',
      VERCEL: !!process.env.VERCEL,
      VERCEL_ENV: process.env.VERCEL_ENV || 'not set'
    },
    environmentVariables: {
      DB_HOST: process.env.DB_HOST ? `${process.env.DB_HOST.substring(0, 20)}...` : '❌ NOT SET',
      DB_USER: process.env.DB_USER ? process.env.DB_USER : '❌ NOT SET',
      DB_PASSWORD: process.env.DB_PASSWORD ? '✅ SET' : '❌ NOT SET',
      DB_NAME: process.env.DB_NAME ? process.env.DB_NAME : '❌ NOT SET',
      JWT_SECRET: process.env.JWT_SECRET ? '✅ SET' : '❌ NOT SET'
    },
    connectionTest: null,
    recommendations: []
  };

  // Check for missing variables
  const missingVars = [];
  if (!process.env.DB_HOST) missingVars.push('DB_HOST');
  if (!process.env.DB_USER) missingVars.push('DB_USER');
  if (!process.env.DB_PASSWORD) missingVars.push('DB_PASSWORD');
  if (!process.env.DB_NAME) missingVars.push('DB_NAME');
  if (!process.env.JWT_SECRET) missingVars.push('JWT_SECRET');

  if (missingVars.length > 0) {
    diagnostics.recommendations.push({
      priority: 'HIGH',
      issue: `Missing environment variables: ${missingVars.join(', ')}`,
      fix: 'Go to Vercel Dashboard → Settings → Environment Variables → Add missing variables → Redeploy'
    });
  }

  // Test database connection
  try {
    const connectionResult = await testConnection();
    diagnostics.connectionTest = {
      status: connectionResult ? 'SUCCESS' : 'FAILED',
      message: connectionResult ? 'Database connection successful' : 'Database connection failed'
    };
  } catch (error) {
    diagnostics.connectionTest = {
      status: 'FAILED',
      message: error.message,
      errorCode: error.code,
      errorName: error.name
    };

    // Provide specific recommendations based on error
    if (error.message.includes('ECONNREFUSED') || error.message.includes('timeout')) {
      diagnostics.recommendations.push({
        priority: 'HIGH',
        issue: 'Database firewall blocking connections',
        fix: 'Allow connections from 0.0.0.0/0 in your database firewall settings. See FIX_DATABASE_CONNECTION_NOW.md for provider-specific steps.'
      });
    } else if (error.message.includes('Access denied') || error.message.includes('password')) {
      diagnostics.recommendations.push({
        priority: 'HIGH',
        issue: 'Database authentication failed',
        fix: 'Verify DB_USER and DB_PASSWORD are correct in Vercel environment variables'
      });
    } else if (error.message.includes('Unknown database')) {
      diagnostics.recommendations.push({
        priority: 'HIGH',
        issue: 'Database does not exist',
        fix: 'Verify DB_NAME is correct or create the database'
      });
    } else if (error.message.includes('SSL') || error.message.includes('certificate')) {
      diagnostics.recommendations.push({
        priority: 'MEDIUM',
        issue: 'SSL/TLS connection issue',
        fix: 'SSL is automatically enabled for cloud databases. Verify your database supports SSL connections.'
      });
    } else if (error.message && (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo'))) {
      diagnostics.recommendations.push({
        priority: 'CRITICAL',
        issue: 'DNS lookup failed - Cannot resolve database hostname (ENOTFOUND)',
        errorDetails: error.message,
        likelyCause: 'Supabase project is paused or hostname is incorrect',
        fix: '1. Go to Supabase Dashboard (supabase.com/dashboard), 2. Check if project is paused and click "Restore", 3. Verify DB_HOST is correct (db.xxxxx.supabase.co), 4. Get fresh credentials from Supabase Dashboard if needed',
        guide: 'See FIX_SUPABASE_ENOTFOUND_ERROR.md for detailed steps'
      });
    } else if (missingVars.length === 0) {
      diagnostics.recommendations.push({
        priority: 'HIGH',
        issue: 'Database connection failed despite all variables being set',
        errorDetails: error.message || 'Unknown error',
        fix: '1. Check database firewall allows 0.0.0.0/0, 2. Verify database is running, 3. Test connection locally, 4. Check Vercel function logs for details'
      });
    }
  }

  // Add general recommendations
  if (process.env.VERCEL && diagnostics.connectionTest?.status === 'FAILED') {
    diagnostics.recommendations.push({
      priority: 'INFO',
      issue: 'Vercel deployment detected',
      fix: 'After fixing issues, redeploy in Vercel: Deployments → Latest → Redeploy'
    });
  }

  const statusCode = diagnostics.connectionTest?.status === 'SUCCESS' ? 200 : 503;
  res.status(statusCode).json(diagnostics);
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Express error handler:', err);
  console.error('Error stack:', err.stack);
  console.error('Request details:', {
    method: req.method,
    url: req.url,
    path: req.path,
    body: req.body
  });
  
  const isDev = process.env.NODE_ENV === 'development' || 
                process.env.VERCEL_ENV === 'development' || 
                process.env.VERCEL_ENV === 'preview' ||
                process.env.VERCEL;
  
  const errorResponse = {
    message: err.message || 'Internal server error',
    error: isDev ? err.message : 'Internal server error',
    name: err.name || 'Error'
  };
  
  if (isDev) {
    errorResponse.stack = err.stack;
    errorResponse.code = err.code;
  }
  
  res.status(err.status || 500).json(errorResponse);
});

// Root route handler
app.get('/', (req, res) => {
  res.json({
    message: 'Internet Billing System API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/api/health',
      diagnose: '/api/diagnose',
      auth: '/api/auth',
      docs: 'API endpoints are available under /api/*'
    },
    note: 'This is the backend API. Frontend should be accessed separately.'
  });
});

// 404 handler for API routes
app.use('/api', (req, res) => {
  res.status(404).json({ 
    message: 'API route not found',
    path: req.path,
    method: req.method,
    hint: 'Available API endpoints: /api/health, /api/auth/login, /api/auth/register, etc.',
    availableRoutes: [
      '/api/health',
      '/api/auth/login',
      '/api/auth/register',
      '/api/auth/me',
      '/api/customers',
      '/api/billing',
      '/api/payments'
    ]
  });
});

// 404 handler for all other routes (non-API)
app.use((req, res) => {
  // Don't return 404 for frontend routes - let Vercel handle them
  if (process.env.VERCEL && !req.path.startsWith('/api')) {
    // In Vercel, frontend routes should be handled by rewrites
    // Return a helpful message instead of 404
    res.status(200).json({ 
      message: 'Internet Billing System API',
      note: 'This is a frontend route. The frontend should handle this route.',
      apiEndpoint: '/api/health'
    });
  } else {
    res.status(404).json({ 
      message: 'Route not found',
      path: req.path,
      hint: 'API endpoints are available under /api/*. Example: /api/health'
    });
  }
});

// Serve frontend static files in production (for Railway deployment)
// This must be AFTER all API routes
if (process.env.NODE_ENV === 'production' && !process.env.VERCEL) {
  const frontendBuildPath = path.join(__dirname, '../frontend/dist');
  app.use(express.static(frontendBuildPath));
  
  // Serve React app for all non-API routes
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendBuildPath, 'index.html'));
  });
}

// Export app for serverless functions (Vercel)
// Only start server if not in serverless mode
// Check if VERCEL is explicitly set to "1" or "true", not just any value
// Also check if we're actually running in Vercel environment (not localhost)
const isVercel = (process.env.VERCEL === '1' || process.env.VERCEL === 'true') || 
                 (process.env.AWS_LAMBDA_FUNCTION_NAME) ||
                 (process.env.VERCEL_URL && !process.env.VERCEL_URL.includes('localhost'));

// Sync database and start server
const startServer = async () => {
  try {
    // Test database connection (skip in serverless mode during initialization)
    // In local dev, allow server to start even if DB is not available
    if (!isVercel) {
      try {
        const connected = await testConnection();
        if (!connected) {
          console.warn('⚠️  Database connection failed during startup (local development)');
          console.warn('💡 Server will start but database operations will fail');
          console.warn('💡 Check your .env file and ensure database is running');
          console.warn('💡 For Supabase: Verify DB_HOST, DB_USER, DB_PASSWORD, DB_NAME are set');
        }
      } catch (dbError) {
        console.warn('⚠️  Database connection failed during startup (local development)');
        console.warn('💡 Server will start but database operations will fail');
        console.warn('💡 Error:', dbError.message);
        console.warn('💡 Check your .env file and ensure database is accessible');
        console.warn('💡 For Supabase: Verify connection credentials in .env file');
        // Don't crash in local dev - allow server to start
      }
    } else {
      // In serverless mode, just try to authenticate without throwing
      try {
        await testConnection();
      } catch (dbError) {
        console.warn('⚠️  Database connection not ready during initialization (serverless mode)');
        console.warn('💡 Connection will be established on first request');
      }
    }

    // Sync database models (create tables if they don't exist)
    // In production, use migrations instead
    // Skip sync in Vercel serverless mode (tables should already exist)
    if (process.env.NODE_ENV !== 'production' && !isVercel) {
      try {
        // Use sequelize.sync() which handles dependencies automatically
        // force: false = don't drop existing tables
        // alter: true = update table structure if needed (fixes schema mismatches)
        await sequelize.sync({ alter: true, force: false });
        console.log('✅ Database models synchronized');
        
        // Automatically fix packages table to allow null isp_id
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
            console.log('✅ Fixed packages table: isp_id now allows NULL');
          }
        } catch (alterError) {
          // Ignore - might already be correct or table doesn't exist
        }
      } catch (syncError) {
        // If sync fails, try creating tables individually in order
        console.log('⚠️  Standard sync failed, trying individual table creation...');
        try {
          await ISP.sync({ alter: true, force: false });
          await User.sync({ alter: true, force: false });
          await Package.sync({ alter: true, force: false });
          await Customer.sync({ alter: true, force: false });
          await Bill.sync({ alter: true, force: false });
          await Payment.sync({ alter: true, force: false });
          await Recovery.sync({ alter: true, force: false });
          await Installation.sync({ alter: true, force: false });
          await Notification.sync({ alter: true, force: false });
          await ActivityLog.sync({ alter: true, force: false });
          // Sync RBAC tables
          await Permission.sync({ alter: true, force: false });
          await Role.sync({ alter: true, force: false });
          const RolePermission = require('./models/RolePermission');
          await RolePermission.sync({ alter: true, force: false });
          console.log('✅ Database models synchronized (individual sync)');
          
          // Automatically fix packages table after sync
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
              console.log('✅ Fixed packages table: isp_id now allows NULL');
            }
          } catch (alterError) {
            // Ignore - might already be correct
          }
        } catch (individualError) {
          console.error('❌ Error syncing database:', individualError.message);
          // Continue anyway - tables might already exist
          console.log('⚠️  Continuing with existing tables...');
          console.log('💡 Tip: Run "node backend/utils/fixDatabase.js" to fix schema issues');
        }
      }
    }

    // Check JWT_SECRET
    if (!process.env.JWT_SECRET) {
      console.warn('⚠️  WARNING: JWT_SECRET is not set in environment variables. Please set it in .env file.');
      console.warn('⚠️  Authentication will fail without JWT_SECRET.');
    }

    // Skip default data creation in serverless mode (tables should already exist)
    if (isVercel) {
      console.log('🚀 Running in serverless mode (Vercel) - skipping default data creation');
      return; // Exit early in serverless mode
    }

    // Create default ISPs if they don't exist
    // Wrap in try-catch to allow server to start even if database is unavailable
    try {
      console.log('🌐 Creating default ISPs...');
      const defaultISPs = [
        {
          name: 'ISP 1',
          email: 'isp1@example.com',
          contact: '+1234567890',
          subscription_plan: 'premium',
          subscription_status: 'active'
        },
        {
          name: 'ISP 2',
          email: 'isp2@example.com',
          contact: '+1234567891',
          subscription_plan: 'basic',
          subscription_status: 'active'
        }
      ];

      for (const ispData of defaultISPs) {
        try {
          const existingISP = await ISP.findOne({ where: { email: ispData.email } });
          if (!existingISP) {
            try {
              const isp = await ISP.create(ispData);
              console.log(`   ✅ Created ISP: ${isp.name} (ID: ${isp.id})`);
            } catch (error) {
              console.error(`   ❌ Error creating ISP ${ispData.name}:`, error.message);
            }
          } else {
            console.log(`   ℹ️  ISP already exists: ${ispData.name}`);
          }
        } catch (error) {
          console.error(`   ❌ Error checking ISP ${ispData.name}:`, error.message);
        }
      }

      // Create default users for all roles if they don't exist
      const defaultUsers = [
        {
          name: 'Super Admin',
          email: 'admin@billing.com',
          password: 'admin123',
          role: 'super_admin',
          isp_id: null
        },
        {
          name: 'ISP Admin',
          email: 'ispadmin@billing.com',
          password: 'admin123',
          role: 'admin',
          isp_id: null // Will be assigned when ISP is created
        },
        {
          name: 'Account Manager',
          email: 'accountmanager@billing.com',
          password: 'admin123',
          role: 'account_manager',
          isp_id: null
        },
        {
          name: 'Technical Officer',
          email: 'technical@billing.com',
          password: 'admin123',
          role: 'technical_officer',
          isp_id: null
        },
        {
          name: 'Recovery Officer',
          email: 'recovery@billing.com',
          password: 'admin123',
          role: 'recovery_officer',
          isp_id: null
        },
        {
          name: 'Test Customer',
          email: 'customer@billing.com',
          password: 'admin123',
          role: 'customer',
          isp_id: null
        }
      ];

      console.log('🔐 Creating default users...');
      for (const userData of defaultUsers) {
        try {
          const existingUser = await User.findOne({ where: { email: userData.email } });
          if (!existingUser) {
            try {
              await User.create({
                ...userData,
                is_active: true
              });
              console.log(`✅ Created ${userData.role}: ${userData.email} / admin123`);
            } catch (error) {
              console.error(`❌ Error creating ${userData.role}:`, error.message);
            }
          } else {
            console.log(`✅ ${userData.role} already exists: ${userData.email}`);
          }
        } catch (error) {
          console.error(`❌ Error checking user ${userData.email}:`, error.message);
        }
      }
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📋 Default Login Credentials:');
      console.log('   All users use password: admin123');
      console.log('   Super Admin: admin@billing.com');
      console.log('   ISP Admin: ispadmin@billing.com');
      console.log('   Account Manager: accountmanager@billing.com');
      console.log('   Technical Officer: technical@billing.com');
      console.log('   Recovery Officer: recovery@billing.com');
      console.log('   Customer: customer@billing.com');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      // Initialize RBAC roles and permissions
      console.log('🔐 Initializing RBAC system...');
      try {
        // Ensure Role and Permission tables exist
        await Role.sync({ alter: true, force: false });
        await Permission.sync({ alter: true, force: false });
        const RolePermission = require('./models/RolePermission');
        await RolePermission.sync({ alter: true, force: false });
        
        // Initialize default roles and permissions
        await initializeRBAC();
        console.log('✅ RBAC system initialized successfully');
      } catch (rbacError) {
        console.error('❌ Error initializing RBAC:', rbacError.message);
        
        // Check if it's the "Too many keys" error
        if (rbacError.message && rbacError.message.includes('Too many keys')) {
          console.error('\n🔧 Detected "Too many keys" error - this is a MySQL index limit issue.');
          console.error('💡 Solution: Run the following command to fix the role_permissions table:');
          console.error('   npm run fix:rbac');
          console.error('   OR: cd backend && node utils/fixRolePermissionsTable.js');
          console.error('\n⚠️  After running the fix, restart the server.');
        } else {
          console.error('❌ RBAC Error Stack:', rbacError.stack);
        }
        
        console.log('\n⚠️  Continuing without RBAC initialization...');
        console.log('💡 You can manually initialize by calling POST /api/roles/initialize');
      }
    } catch (defaultDataError) {
      console.error('❌ Error creating default data:', defaultDataError.message);
      console.warn('⚠️  Server will start but default data may not be created');
      console.warn('💡 Make sure MySQL is running and database is accessible');
      console.warn('💡 You can create default data later by running: npm run init-db');
    }

    // Initialize monthly scheduler (skip in serverless mode)
    if (!isVercel) {
      initializeScheduler();
    }

    // Start server only if not in serverless mode
    if (!isVercel) {
      const port = process.env.PORT || PORT;
      
      // Check if port is already in use
      const server = app.listen(port, '0.0.0.0', () => {
        console.log(`🚀 Server running on port ${port}`);
        console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
        if (process.env.NODE_ENV === 'production') {
          console.log(`🌐 Frontend served from: ${path.join(__dirname, '../frontend/dist')}`);
        }
      });
      
      // Handle port already in use error
      server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.error(`❌ Port ${port} is already in use!`);
          console.error('💡 Solutions:');
          console.error(`   1. Kill the process using port ${port}:`);
          console.error(`      Windows: npm run kill-port`);
          console.error(`      Or: netstat -ano | findstr :${port}`);
          console.error(`      Then: taskkill /PID <PID> /F`);
          console.error(`   2. Use a different port: PORT=8001 npm start`);
          console.error(`   3. Find and stop the other server process`);
          process.exit(1);
        } else {
          console.error('❌ Server error:', err);
          process.exit(1);
        }
      });
    } else {
      console.log('🚀 Running in serverless mode (Vercel)');
    }
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    if (!isVercel) {
      process.exit(1);
    }
  }
};

// Only start server if not in serverless mode
if (!isVercel) {
  startServer().catch(err => {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  });
} else {
  // In serverless mode, don't initialize anything synchronously
  // The app will be initialized on first request via api/index.js
  // Database connection will be established on first API request
  console.log('🚀 Serverless mode detected - app will initialize on first request');
}

// Graceful shutdown (only in traditional server mode)
if (!isVercel) {
  process.on('SIGTERM', async () => {
    console.log('SIGTERM signal received: closing HTTP server');
    await sequelize.close();
    process.exit(0);
  });
}

// Export app for serverless functions
module.exports = app;