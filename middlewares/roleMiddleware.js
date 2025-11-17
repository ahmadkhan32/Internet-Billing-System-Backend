const roleMiddleware = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized - no user found' });
    }

    const userRole = req.user.role;

    // Super Admin has access to everything
    if (userRole === 'super_admin') {
      return next();
    }

    // Business Admin (admin role) has full access to all routes except Super Admin only routes
    if (userRole === 'admin') {
      // If route is super_admin only (no other roles allowed), deny access
      if (allowedRoles.length === 1 && allowedRoles[0] === 'super_admin') {
        return res.status(403).json({ message: 'Forbidden - Super Admin only' });
      }
      // Business Admin can access all other routes (even if admin is not explicitly listed)
      // This gives Business Admin full system access
      return next();
    }

    // For other roles, check if role is in allowedRoles
    if (allowedRoles.includes(userRole)) {
      next();
    } else {
      res.status(403).json({ message: 'Forbidden - insufficient permissions' });
    }
  };
};

// Multi-tenant middleware - ensure users can only access their ISP's data
const ispMiddleware = async (req, res, next) => {
  try {
    // Super admin can access all ISPs
    if (req.user.role === 'super_admin') {
      return next();
    }

    // If ISP ID is provided in params or body, verify it matches (for non-super-admin)
    if (req.user.role !== 'super_admin') {
      const requestedIspId = req.params.ispId || req.body.isp_id || req.query.isp_id;
      
      if (requestedIspId && req.user.isp_id && parseInt(requestedIspId) !== req.user.isp_id) {
        return res.status(403).json({ message: 'Access denied - ISP mismatch' });
      }
    }

    // Attach ISP ID to request for use in controllers
    // For super_admin, this might be null, which is OK
    // For other roles, controllers will validate if isp_id is required
    req.ispId = req.user.isp_id;
    next();
  } catch (error) {
    res.status(500).json({ message: 'Error in ISP middleware', error: error.message });
  }
};

// Permission-based middleware - checks if user has specific permission
const permissionMiddleware = (requiredPermission) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized - no user found' });
      }

      // Super admin and Business Admin bypass all permission checks
      if (req.user.role === 'super_admin' || req.user.role === 'admin') {
        return next();
      }

      // Get user's role and check permissions
      const { Role, Permission } = require('../models');
      const role = await Role.findOne({
        where: { name: req.user.role, is_active: true },
        include: [{
          model: Permission,
          as: 'permissions',
          through: { attributes: [] },
          attributes: ['name']
        }]
      });

      if (!role) {
        return res.status(403).json({ message: 'Role not found or inactive' });
      }

      // Check if role has the required permission
      const hasPermission = role.permissions.some(
        perm => perm.name === requiredPermission
      );

      if (!hasPermission) {
        return res.status(403).json({ 
          message: `Access denied. Required permission: ${requiredPermission}` 
        });
      }

      next();
    } catch (error) {
      console.error('Permission middleware error:', error);
      res.status(500).json({ message: 'Error checking permissions', error: error.message });
    }
  };
};

// Check multiple permissions (user needs at least one)
const anyPermissionMiddleware = (...requiredPermissions) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized - no user found' });
      }

      // Super admin and Business Admin bypass all permission checks
      if (req.user.role === 'super_admin' || req.user.role === 'admin') {
        return next();
      }

      const { Role, Permission } = require('../models');
      const role = await Role.findOne({
        where: { name: req.user.role, is_active: true },
        include: [{
          model: Permission,
          as: 'permissions',
          through: { attributes: [] },
          attributes: ['name']
        }]
      });

      if (!role) {
        return res.status(403).json({ message: 'Role not found or inactive' });
      }

      const rolePermissions = role.permissions.map(p => p.name);
      const hasAnyPermission = requiredPermissions.some(perm => 
        rolePermissions.includes(perm)
      );

      if (!hasAnyPermission) {
        return res.status(403).json({ 
          message: `Access denied. Required one of: ${requiredPermissions.join(', ')}` 
        });
      }

      next();
    } catch (error) {
      console.error('Permission middleware error:', error);
      res.status(500).json({ message: 'Error checking permissions', error: error.message });
    }
  };
};

module.exports = { 
  roleMiddleware, 
  ispMiddleware, 
  permissionMiddleware, 
  anyPermissionMiddleware 
};

