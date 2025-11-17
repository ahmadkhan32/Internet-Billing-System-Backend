/**
 * Initialize default roles and permissions for RBAC system
 * Run this when setting up the system for the first time
 */

const { Role, Permission, RolePermission } = require('../models');

// Default permissions organized by resource
const defaultPermissions = [
  // User Management
  { name: 'view_users', display_name: 'View Users', resource: 'users', action: 'read' },
  { name: 'create_users', display_name: 'Create Users', resource: 'users', action: 'create' },
  { name: 'update_users', display_name: 'Update Users', resource: 'users', action: 'update' },
  { name: 'delete_users', display_name: 'Delete Users', resource: 'users', action: 'delete' },
  
  // Customer Management
  { name: 'view_customers', display_name: 'View Customers', resource: 'customers', action: 'read' },
  { name: 'create_customers', display_name: 'Create Customers', resource: 'customers', action: 'create' },
  { name: 'update_customers', display_name: 'Update Customers', resource: 'customers', action: 'update' },
  { name: 'delete_customers', display_name: 'Delete Customers', resource: 'customers', action: 'delete' },
  
  // Package Management
  { name: 'view_packages', display_name: 'View Packages', resource: 'packages', action: 'read' },
  { name: 'create_packages', display_name: 'Create Packages', resource: 'packages', action: 'create' },
  { name: 'update_packages', display_name: 'Update Packages', resource: 'packages', action: 'update' },
  { name: 'delete_packages', display_name: 'Delete Packages', resource: 'packages', action: 'delete' },
  
  // Bill Management
  { name: 'view_bills', display_name: 'View Bills', resource: 'bills', action: 'read' },
  { name: 'create_bills', display_name: 'Create Bills', resource: 'bills', action: 'create' },
  { name: 'update_bills', display_name: 'Update Bills', resource: 'bills', action: 'update' },
  { name: 'delete_bills', display_name: 'Delete Bills', resource: 'bills', action: 'delete' },
  { name: 'generate_bills', display_name: 'Generate Bills', resource: 'bills', action: 'generate' },
  
  // Payment Management
  { name: 'view_payments', display_name: 'View Payments', resource: 'payments', action: 'read' },
  { name: 'create_payments', display_name: 'Create Payments', resource: 'payments', action: 'create' },
  { name: 'update_payments', display_name: 'Update Payments', resource: 'payments', action: 'update' },
  { name: 'approve_payments', display_name: 'Approve Payments', resource: 'payments', action: 'approve' },
  
  // Recovery Management
  { name: 'view_recoveries', display_name: 'View Recoveries', resource: 'recoveries', action: 'read' },
  { name: 'create_recoveries', display_name: 'Create Recoveries', resource: 'recoveries', action: 'create' },
  { name: 'update_recoveries', display_name: 'Update Recoveries', resource: 'recoveries', action: 'update' },
  
  // Installation Management
  { name: 'view_installations', display_name: 'View Installations', resource: 'installations', action: 'read' },
  { name: 'create_installations', display_name: 'Create Installations', resource: 'installations', action: 'create' },
  { name: 'update_installations', display_name: 'Update Installations', resource: 'installations', action: 'update' },
  { name: 'delete_installations', display_name: 'Delete Installations', resource: 'installations', action: 'delete' },
  
  // Reports
  { name: 'view_reports', display_name: 'View Reports', resource: 'reports', action: 'read' },
  { name: 'generate_reports', display_name: 'Generate Reports', resource: 'reports', action: 'generate' },
  
  // ISP Management (Super Admin only)
  { name: 'view_isps', display_name: 'View ISPs', resource: 'isps', action: 'read' },
  { name: 'create_isps', display_name: 'Create ISPs', resource: 'isps', action: 'create' },
  { name: 'update_isps', display_name: 'Update ISPs', resource: 'isps', action: 'update' },
  { name: 'delete_isps', display_name: 'Delete ISPs', resource: 'isps', action: 'delete' },
  
  // Role & Permission Management (Super Admin only)
  { name: 'view_roles', display_name: 'View Roles', resource: 'roles', action: 'read' },
  { name: 'create_roles', display_name: 'Create Roles', resource: 'roles', action: 'create' },
  { name: 'update_roles', display_name: 'Update Roles', resource: 'roles', action: 'update' },
  { name: 'delete_roles', display_name: 'Delete Roles', resource: 'roles', action: 'delete' },
  { name: 'manage_permissions', display_name: 'Manage Permissions', resource: 'permissions', action: 'manage' },
  
  // Notifications
  { name: 'view_notifications', display_name: 'View Notifications', resource: 'notifications', action: 'read' },
  { name: 'create_notifications', display_name: 'Create Notifications', resource: 'notifications', action: 'create' },
  
  // Activity Logs
  { name: 'view_activity_logs', display_name: 'View Activity Logs', resource: 'activity_logs', action: 'read' },
  
  // Marketing & Promotions
  { name: 'view_promotions', display_name: 'View Promotions', resource: 'promotions', action: 'read' },
  { name: 'create_promotions', display_name: 'Create Promotions', resource: 'promotions', action: 'create' },
  { name: 'update_promotions', display_name: 'Update Promotions', resource: 'promotions', action: 'update' },
  { name: 'delete_promotions', display_name: 'Delete Promotions', resource: 'promotions', action: 'delete' },
  { name: 'manage_campaigns', display_name: 'Manage Campaigns', resource: 'campaigns', action: 'manage' },
  
  // Automation & AI
  { name: 'view_automation', display_name: 'View Automation', resource: 'automation', action: 'read' },
  { name: 'manage_automation', display_name: 'Manage Automation', resource: 'automation', action: 'manage' },
  { name: 'view_ai_insights', display_name: 'View AI Insights', resource: 'ai_insights', action: 'read' },
];

// Default roles with their permissions
const defaultRoles = [
  {
    name: 'super_admin',
    display_name: 'Super Admin',
    description: 'System owner with full access to all features',
    is_system_role: true,
    permissions: ['*'] // All permissions
  },
  {
    name: 'admin',
    display_name: 'ISP Admin',
    description: 'ISP owner with full access to their ISP operations',
    is_system_role: true,
    permissions: [
      'view_users', 'create_users', 'update_users', 'delete_users',
      'view_customers', 'create_customers', 'update_customers', 'delete_customers',
      'view_packages', 'create_packages', 'update_packages', 'delete_packages',
      'view_bills', 'create_bills', 'update_bills', 'delete_bills', 'generate_bills',
      'view_payments', 'create_payments', 'update_payments', 'approve_payments',
      'view_recoveries', 'create_recoveries', 'update_recoveries',
      'view_installations', 'create_installations', 'update_installations', 'delete_installations',
      'view_reports', 'generate_reports',
      'view_notifications', 'create_notifications'
    ]
  },
  {
    name: 'account_manager',
    display_name: 'Account Manager',
    description: 'Handles billing and customer accounts',
    is_system_role: true,
    permissions: [
      'view_customers', 'create_customers', 'update_customers',
      'view_bills', 'create_bills', 'update_bills', 'generate_bills',
      'view_payments', 'create_payments', 'update_payments', 'approve_payments',
      'view_reports', 'generate_reports',
      'view_notifications'
    ]
  },
  {
    name: 'technical_officer',
    display_name: 'Technical Officer',
    description: 'Manages installations and technical services',
    is_system_role: true,
    permissions: [
      'view_customers',
      'view_installations', 'create_installations', 'update_installations',
      'view_notifications'
    ]
  },
  {
    name: 'recovery_officer',
    display_name: 'Recovery Officer',
    description: 'Handles payment collection and recovery',
    is_system_role: true,
    permissions: [
      'view_customers',
      'view_bills',
      'view_recoveries', 'create_recoveries', 'update_recoveries',
      'view_payments', 'create_payments',
      'view_notifications'
    ]
  },
  {
    name: 'marketing_officer',
    display_name: 'Marketing / Promotion Officer',
    description: 'Manages customer engagement, campaigns, and promotions',
    is_system_role: true,
    permissions: [
      'view_customers',
      'view_promotions', 'create_promotions', 'update_promotions', 'delete_promotions',
      'manage_campaigns',
      'view_notifications', 'create_notifications',
      'view_reports'
    ]
  },
  {
    name: 'customer',
    display_name: 'Customer',
    description: 'End-user with access to personal portal',
    is_system_role: true,
    permissions: [
      'view_bills',
      'view_payments',
      'view_notifications',
      'view_promotions'
    ]
  }
];

const initializeRBAC = async () => {
  try {
    console.log('🔐 Initializing RBAC system...');

    // Create or update permissions
    const createdPermissions = [];
    for (const permData of defaultPermissions) {
      const [permission, created] = await Permission.findOrCreate({
        where: { name: permData.name },
        defaults: permData
      });
      
      // Update permission if it exists but data might have changed
      if (!created) {
        await permission.update(permData);
        console.log(`   🔄 Updated permission: ${permData.name}`);
      } else {
        console.log(`   ✅ Created permission: ${permData.name}`);
      }
      
      createdPermissions.push(permission);
    }

    // Create roles and assign permissions
    for (const roleData of defaultRoles) {
      const { permissions: permissionNames, ...roleFields } = roleData;
      
      // Ensure system roles have business_id set to null
      const roleDataToCreate = {
        ...roleFields,
        business_id: null // System roles are not tied to any business
      };
      
      const [role, roleCreated] = await Role.findOrCreate({
        where: { name: roleData.name },
        defaults: roleDataToCreate
      });
      
      // Update existing roles to ensure business_id is null for system roles
      if (!roleCreated && role.business_id !== null && roleData.is_system_role) {
        await role.update({ business_id: null });
        console.log(`   🔄 Updated role ${roleData.display_name} to be system role`);
      }
      
      // Update role fields if they exist (to keep descriptions current)
      if (!roleCreated) {
        await role.update({
          display_name: roleData.display_name,
          description: roleData.description,
          is_system_role: roleData.is_system_role
        });
        console.log(`   🔄 Updated role: ${roleData.display_name}`);
      } else {
        console.log(`   ✅ Created role: ${roleData.display_name}`);
      }

      // Assign permissions (always update to ensure they're current)
      if (permissionNames.includes('*')) {
        // Super admin gets all permissions
        await role.setPermissions(createdPermissions.map(p => p.id));
        console.log(`   ✅ Assigned all ${createdPermissions.length} permissions to ${roleData.display_name}`);
      } else {
        // Assign specific permissions
        const permissionsToAssign = createdPermissions.filter(p => 
          permissionNames.includes(p.name)
        );
        await role.setPermissions(permissionsToAssign.map(p => p.id));
        console.log(`   ✅ Assigned ${permissionsToAssign.length} permissions to ${roleData.display_name}`);
      }
    }

    console.log('✅ RBAC system initialized successfully');
    return { success: true };
  } catch (error) {
    console.error('❌ Error initializing RBAC:', error);
    throw error;
  }
};

module.exports = initializeRBAC;

