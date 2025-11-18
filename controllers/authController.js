const User = require('../models/User');
const ISP = require('../models/ISP');
const generateToken = require('../utils/generateToken');
const { validationResult } = require('express-validator');
const { sequelize } = require('../config/db');

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public (for customers only) / Private (for admin creating staff via /api/users)
const register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password, role, isp_id, phone, address } = req.body;

    // Public registration is only for customers
    // Staff accounts must be created by admin via /api/users endpoint
    const requestedRole = role || 'customer';
    if (requestedRole !== 'customer') {
      return res.status(403).json({ 
        message: 'Staff accounts must be created by admin. Please use /api/users endpoint or contact your administrator.' 
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    // For customer registration, ISP ID is required
    if (!isp_id) {
      return res.status(400).json({ message: 'ISP ID is required for customer registration' });
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password,
      role: 'customer',
      isp_id: isp_id
    });

    // Create customer record
    if (phone && address) {
      const Customer = require('../models/Customer');
      await Customer.create({
        name,
        email,
        phone,
        address,
        isp_id,
        connection_date: new Date()
      });
    }

    const token = generateToken(user.id);

    res.status(201).json({
      success: true,
      message: 'Customer registered successfully',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isp_id: user.isp_id
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during registration', error: error.message });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        message: 'Validation failed',
        errors: errors.array() 
      });
    }

    const { email, password, business_id } = req.body;

    console.log('🔐 Login attempt:', { email, hasPassword: !!password, hasBusinessId: !!business_id });

    // Find user with timeout protection for serverless
    // First, ensure database connection is ready
    try {
      await sequelize.authenticate();
    } catch (connError) {
      console.error('❌ Database connection failed before query:', connError.message);
      console.error('📋 Connection Details:', {
        hasDB_HOST: !!process.env.DB_HOST,
        hasDB_USER: !!process.env.DB_USER,
        hasDB_PASSWORD: !!process.env.DB_PASSWORD,
        hasDB_NAME: !!process.env.DB_NAME,
        DB_DIALECT: process.env.DB_DIALECT || 'mysql',
        VERCEL: !!process.env.VERCEL
      });
      
      // Check for missing environment variables
      const missingVars = [];
      if (!process.env.DB_HOST || process.env.DB_HOST.trim() === '') missingVars.push('DB_HOST');
      if (!process.env.DB_USER || process.env.DB_USER.trim() === '') missingVars.push('DB_USER');
      if (!process.env.DB_PASSWORD || process.env.DB_PASSWORD.trim() === '') missingVars.push('DB_PASSWORD');
      if (!process.env.DB_NAME || process.env.DB_NAME.trim() === '') missingVars.push('DB_NAME');
      
      let errorMessage = 'Database connection failed. Please check your database configuration.';
      let troubleshooting = [];
      
      if (missingVars.length > 0) {
        errorMessage = `Missing environment variables: ${missingVars.join(', ')}. Please set these in Vercel project settings.`;
        troubleshooting.push('Go to Vercel Dashboard → Settings → Environment Variables');
        troubleshooting.push('Add all required database variables');
        troubleshooting.push('Redeploy after adding variables');
      } else {
        troubleshooting.push('Verify database credentials are correct in Vercel environment variables');
        troubleshooting.push('Check database is accessible from internet (not private network)');
        troubleshooting.push('For Supabase: Verify project is active (not paused) and credentials are correct');
        troubleshooting.push('Check database firewall allows connections from 0.0.0.0/0');
        troubleshooting.push('Verify database is running and not paused');
        
        // Add specific hints based on error
        if (connError.message.includes('ECONNREFUSED') || connError.message.includes('timeout')) {
          troubleshooting.push('Network issue: Database host might be unreachable or firewall blocking');
        }
        if (connError.message.includes('Access denied') || connError.message.includes('password')) {
          troubleshooting.push('Authentication failed: Check DB_USER and DB_PASSWORD are correct');
        }
        if (connError.message.includes('Unknown database')) {
          troubleshooting.push('Database does not exist: Verify DB_NAME is correct');
        }
      }
      
      return res.status(503).json({
        success: false,
        message: errorMessage,
        error: process.env.VERCEL ? connError.message : undefined,
        missingVariables: missingVars.length > 0 ? missingVars : undefined,
        troubleshooting: troubleshooting,
        hint: 'See VERCEL_DEPLOYMENT_READY.md for detailed setup instructions'
      });
    }

    // Find user with timeout protection (increased to 15s for slow connections)
    let user;
    try {
      user = await Promise.race([
        User.findOne({ where: { email } }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Database query timeout - user lookup took too long')), 15000)
        )
      ]);
    } catch (timeoutError) {
      console.error('❌ User query timeout:', timeoutError.message);
      return res.status(504).json({
        success: false,
        message: 'Database query timeout. The database is responding slowly.',
        error: timeoutError.message,
        hint: 'This might indicate network latency or database performance issues. Please try again or check database status.'
      });
    }
    if (!user) {
      console.error(`❌ Login failed: User not found for email: ${email}`);
      return res.status(401).json({ 
        success: false,
        message: 'Invalid credentials' 
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      console.error(`❌ Login failed for ${email}: Invalid password`);
      return res.status(401).json({ 
        success: false,
        message: 'Invalid credentials' 
      });
    }

    // Check if user is active
    if (!user.is_active) {
      console.error(`❌ Login failed for ${email}: Account is inactive`);
      return res.status(401).json({ 
        success: false,
        message: 'Account is inactive' 
      });
    }

    // Validate Business ID if provided (for Business Admin login)
    if (business_id) {
      if (user.role !== 'admin') {
        return res.status(403).json({ 
          success: false,
          message: 'Business ID login is only available for Business Admin accounts' 
        });
      }

      if (!user.isp_id) {
        return res.status(400).json({ 
          success: false,
          message: 'Your account is not associated with a business. Please contact support.' 
        });
      }

      // Verify Business ID matches user's ISP with timeout (increased to 10s)
      let isp;
      try {
        isp = await Promise.race([
          ISP.findByPk(user.isp_id),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Database query timeout - ISP lookup took too long')), 10000)
          )
        ]);
      } catch (timeoutError) {
        console.error('❌ ISP query timeout:', timeoutError.message);
        return res.status(504).json({
          success: false,
          message: 'Database query timeout while verifying Business ID.',
          error: timeoutError.message,
          hint: 'Please try again or contact support if the issue persists.'
        });
      }
      if (!isp) {
        return res.status(400).json({ 
          success: false,
          message: 'Business not found. Please contact support.' 
        });
      }

      // Check if Business ID matches
      if (isp.business_id && isp.business_id !== business_id) {
        return res.status(401).json({ 
          success: false,
          message: 'Invalid Business ID. Please check and try again.' 
        });
      }

      // If ISP doesn't have business_id set, allow login but log warning
      if (!isp.business_id) {
        console.warn(`⚠️  Business Admin ${email} logged in but ISP ${isp.id} has no business_id set`);
      }
    }

    // Update last login (with timeout for serverless - non-critical)
    try {
      await Promise.race([
        (async () => {
          user.last_login = new Date();
          await user.save();
        })(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Save timeout')), 5000)
        )
      ]);
    } catch (error) {
      console.warn('⚠️  Could not update last_login (non-critical):', error.message);
      // Continue - last_login update is not critical for login
    }

    // Generate token
    let token;
    try {
      token = generateToken(user.id);
    } catch (error) {
      console.error('Token generation error:', error);
      return res.status(500).json({ message: 'Server error: JWT_SECRET not configured', error: error.message });
    }

    // Include ISP info if user belongs to an ISP (with timeout for serverless)
    // This is non-critical, so we use a shorter timeout and continue on failure
    let ispInfo = null;
    if (user.isp_id) {
      try {
        ispInfo = await Promise.race([
          ISP.findByPk(user.isp_id),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('ISP info query timeout')), 8000)
          )
        ]);
      } catch (error) {
        console.warn('⚠️  Could not fetch ISP info (non-critical):', error.message);
        // Continue without ISP info - not critical for login
        ispInfo = null;
      }
    }

    // Ensure consistent response format
    const responseData = {
      success: true,
      message: 'Login successful',
      token: token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isp_id: user.isp_id,
        isp: ispInfo
      }
    };
    
    console.log('✅ Login successful for:', email, 'Role:', user.role);
    console.log('📦 Response data:', {
      hasSuccess: !!responseData.success,
      hasToken: !!responseData.token,
      hasUser: !!responseData.user,
      userId: responseData.user.id
    });
    
    res.json(responseData);
  } catch (error) {
    console.error('Login error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    });
    
    // Always show error message in Vercel for debugging
    const isDev = process.env.NODE_ENV === 'development' || 
                  process.env.VERCEL_ENV === 'development' || 
                  process.env.VERCEL_ENV === 'preview' ||
                  process.env.VERCEL;
    
    // Provide more helpful error messages
    let errorMessage = 'Server error during login';
    let statusCode = 500;
    
    if (error.name === 'SequelizeConnectionError' || error.name === 'SequelizeConnectionRefusedError') {
      // Check if it's a missing environment variable issue
      // Check for undefined (not set), not just falsy values
      const missingVars = [];
      if (process.env.DB_HOST === undefined || process.env.DB_HOST.trim() === '') {
        missingVars.push('DB_HOST');
      }
      if (process.env.DB_USER === undefined || process.env.DB_USER.trim() === '') {
        missingVars.push('DB_USER');
      }
      if (process.env.DB_NAME === undefined || process.env.DB_NAME.trim() === '') {
        missingVars.push('DB_NAME');
      }
      // In production/Vercel, DB_PASSWORD must be set and non-empty
      if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
        if (process.env.DB_PASSWORD === undefined || process.env.DB_PASSWORD.trim() === '') {
          missingVars.push('DB_PASSWORD');
        }
      } else {
        // In local dev, just check if it's undefined (empty string is OK)
        if (process.env.DB_PASSWORD === undefined) {
          missingVars.push('DB_PASSWORD');
        }
      }
      
      if (missingVars.length > 0) {
        errorMessage = `Missing environment variables: ${missingVars.join(', ')}. Please set these in Vercel project settings.`;
      } else {
        errorMessage = 'Database connection failed. Please check your database configuration and ensure database is accessible from Vercel.';
      }
      statusCode = 503;
    } else if (error.name === 'SequelizeDatabaseError') {
      errorMessage = 'Database error. Please check your database configuration.';
      statusCode = 503;
    } else if (error.name === 'SequelizeValidationError') {
      errorMessage = 'Validation error: ' + (error.message || 'Invalid data');
      statusCode = 400;
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    const errorResponse = {
      success: false,
      message: errorMessage,
      error: isDev ? error.message : errorMessage,
      name: error.name || 'Error'
    };
    
    // Add more details in development/Vercel
    if (isDev) {
      errorResponse.stack = error.stack;
      errorResponse.code = error.code;
      errorResponse.details = {
        errno: error.errno,
        sqlState: error.sqlState,
        sqlMessage: error.sqlMessage
      };
    }
    
    console.error('❌ Login error response:', {
      statusCode,
      message: errorMessage,
      errorName: error.name
    });
    
    res.status(statusCode).json(errorResponse);
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] },
      include: [{
        model: ISP,
        as: 'isp',
        attributes: ['id', 'name', 'email', 'contact']
      }]
    });

    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = { register, login, getMe };

