/**
 * Tenant Isolation Middleware
 * Ensures all queries are filtered by business_id (tenant isolation)
 * Super Admin can access all businesses, others can only access their own business
 */

const { ISP } = require('../models');

/**
 * Middleware to enforce tenant isolation
 * Adds business_id filter to request for use in controllers
 */
const tenantMiddleware = async (req, res, next) => {
  try {
    // Super Admin bypasses tenant isolation (can access all businesses)
    if (req.user && req.user.role === 'super_admin') {
      // Super Admin can optionally specify a business_id or business_id (VARCHAR) in query/body for impersonation
      const requestedBusinessId = req.query.business_id || req.body.business_id || req.params.business_id;
      const requestedISPId = req.query.isp_id || req.body.isp_id || req.params.isp_id;
      
      if (requestedBusinessId) {
        // Lookup ISP by business_id (VARCHAR)
        const business = await ISP.findOne({ where: { business_id: requestedBusinessId } });
        if (business) {
          req.tenantId = business.id; // Use numeric ID for filtering
          req.ispId = business.id; // Backward compatibility
          req.businessId = business.business_id; // Store VARCHAR business_id
        } else {
          req.tenantId = null;
          req.ispId = null;
          req.businessId = null;
        }
      } else if (requestedISPId) {
        // Lookup by numeric ISP ID
        const business = await ISP.findByPk(requestedISPId);
        if (business) {
          req.tenantId = business.id;
          req.ispId = business.id; // Backward compatibility
          req.businessId = business.business_id;
        } else {
          req.tenantId = null;
          req.ispId = null;
          req.businessId = null;
        }
      } else {
        req.tenantId = null;
        req.ispId = null;
        req.businessId = null;
      }
      
      req.isSuperAdmin = true;
      return next();
    }

    // For non-Super Admin users, enforce business_id from their user record
    if (req.user && req.user.isp_id) {
      req.tenantId = req.user.isp_id;
      req.ispId = req.user.isp_id; // Backward compatibility
      req.isSuperAdmin = false;
      
      // Verify business exists and is active
      const business = await ISP.findByPk(req.user.isp_id);
      if (!business) {
        return res.status(404).json({ message: 'Business not found' });
      }
      
      // Attach business_id to request for use in queries
      req.businessId = business.business_id;
      
      if (business.subscription_status !== 'active') {
        return res.status(403).json({ 
          message: 'Business subscription is not active. Please contact support.' 
        });
      }
      
      return next();
    }

    // Users without business_id (should only be Super Admin)
    if (req.user && !req.user.isp_id && req.user.role === 'super_admin') {
      req.tenantId = null;
      req.ispId = null; // Backward compatibility
      req.isSuperAdmin = true;
      return next();
    }

    // No user or invalid setup
    return res.status(403).json({ 
      message: 'Access denied. No business context found.' 
    });
  } catch (error) {
    console.error('Tenant middleware error:', error);
    return res.status(500).json({ 
      message: 'Error in tenant isolation', 
      error: error.message 
    });
  }
};

/**
 * Helper function to build where clause with tenant isolation
 * @param {Object} baseWhere - Base where clause
 * @param {Number|null} tenantId - Business ID (null for Super Admin)
 * @returns {Object} Where clause with tenant isolation
 */
const buildTenantWhere = (baseWhere = {}, tenantId) => {
  if (tenantId === null || tenantId === undefined) {
    // Super Admin - no tenant filter (can see all)
    return baseWhere;
  }
  
  // Add business_id filter for tenant isolation
  return {
    ...baseWhere,
    isp_id: tenantId // Using isp_id as business_id (same field)
  };
};

/**
 * Middleware to verify business access
 * Ensures user can only access their own business data
 */
const verifyBusinessAccess = async (req, res, next) => {
  try {
    const requestedBusinessId = req.params.business_id || req.query.business_id || req.body.business_id;
    
    // Super Admin can access any business
    if (req.user && req.user.role === 'super_admin') {
      return next();
    }

    // Non-Super Admin must match their business_id
    if (requestedBusinessId && req.user.isp_id !== parseInt(requestedBusinessId)) {
      return res.status(403).json({ 
        message: 'Access denied. You can only access your own business data.' 
      });
    }

    next();
  } catch (error) {
    console.error('Business access verification error:', error);
    return res.status(500).json({ 
      message: 'Error verifying business access', 
      error: error.message 
    });
  }
};

module.exports = {
  tenantMiddleware,
  buildTenantWhere,
  verifyBusinessAccess
};

