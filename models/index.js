const User = require('./User');
const ISP = require('./ISP');
const Customer = require('./Customer');
const Package = require('./Package');
const Bill = require('./Bill');
const Payment = require('./Payment');
const Recovery = require('./Recovery');
const Installation = require('./Installation');
const Notification = require('./Notification');
const ActivityLog = require('./ActivityLog');
const Role = require('./Role');
const Permission = require('./Permission');
const RolePermission = require('./RolePermission');
const SaaSPackage = require('./SaaSPackage');
const AutomationLog = require('./AutomationLog');

// Define associations
User.belongsTo(ISP, { foreignKey: 'isp_id', as: 'isp' });
ISP.hasMany(User, { foreignKey: 'isp_id', as: 'users' });

Customer.belongsTo(ISP, { foreignKey: 'isp_id', as: 'isp' });
ISP.hasMany(Customer, { foreignKey: 'isp_id', as: 'customers' });

Customer.belongsTo(Package, { foreignKey: 'package_id', as: 'package' });
Package.hasMany(Customer, { foreignKey: 'package_id', as: 'customers' });

Package.belongsTo(ISP, { foreignKey: 'isp_id', as: 'isp' });
ISP.hasMany(Package, { foreignKey: 'isp_id', as: 'packages' });

Bill.belongsTo(Customer, { foreignKey: 'customer_id', as: 'customer' });
Customer.hasMany(Bill, { foreignKey: 'customer_id', as: 'bills' });

Bill.belongsTo(Package, { foreignKey: 'package_id', as: 'package' });
Package.hasMany(Bill, { foreignKey: 'package_id', as: 'bills' });

Bill.belongsTo(ISP, { foreignKey: 'isp_id', as: 'isp' });
ISP.hasMany(Bill, { foreignKey: 'isp_id', as: 'bills' });

Payment.belongsTo(Bill, { foreignKey: 'bill_id', as: 'bill' });
Bill.hasMany(Payment, { foreignKey: 'bill_id', as: 'payments' });

Payment.belongsTo(Customer, { foreignKey: 'customer_id', as: 'customer' });
Customer.hasMany(Payment, { foreignKey: 'customer_id', as: 'payments' });

Payment.belongsTo(ISP, { foreignKey: 'isp_id', as: 'isp' });
ISP.hasMany(Payment, { foreignKey: 'isp_id', as: 'payments' });

Recovery.belongsTo(User, { foreignKey: 'recovery_officer_id', as: 'recoveryOfficer' });
User.hasMany(Recovery, { foreignKey: 'recovery_officer_id', as: 'recoveries' });

Recovery.belongsTo(Customer, { foreignKey: 'customer_id', as: 'customer' });
Customer.hasMany(Recovery, { foreignKey: 'customer_id', as: 'recoveries' });

Recovery.belongsTo(Bill, { foreignKey: 'bill_id', as: 'bill' });
Bill.hasMany(Recovery, { foreignKey: 'bill_id', as: 'recoveries' });

Recovery.belongsTo(ISP, { foreignKey: 'isp_id', as: 'isp' });
ISP.hasMany(Recovery, { foreignKey: 'isp_id', as: 'recoveries' });

Installation.belongsTo(Customer, { foreignKey: 'customer_id', as: 'customer' });
Customer.hasMany(Installation, { foreignKey: 'customer_id', as: 'installations' });

Installation.belongsTo(User, { foreignKey: 'technical_officer_id', as: 'technicalOfficer' });
User.hasMany(Installation, { foreignKey: 'technical_officer_id', as: 'installations' });

Installation.belongsTo(ISP, { foreignKey: 'isp_id', as: 'isp' });
ISP.hasMany(Installation, { foreignKey: 'isp_id', as: 'installations' });

Notification.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(Notification, { foreignKey: 'user_id', as: 'notifications' });

Notification.belongsTo(Customer, { foreignKey: 'customer_id', as: 'customer' });
Customer.hasMany(Notification, { foreignKey: 'customer_id', as: 'notifications' });

Notification.belongsTo(Bill, { foreignKey: 'bill_id', as: 'bill' });
Bill.hasMany(Notification, { foreignKey: 'bill_id', as: 'notifications' });

Notification.belongsTo(ISP, { foreignKey: 'isp_id', as: 'isp' });
ISP.hasMany(Notification, { foreignKey: 'isp_id', as: 'notifications' });

ActivityLog.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(ActivityLog, { foreignKey: 'user_id', as: 'activityLogs' });

ActivityLog.belongsTo(ISP, { foreignKey: 'isp_id', as: 'isp' });
ISP.hasMany(ActivityLog, { foreignKey: 'isp_id', as: 'activityLogs' });

// SaaS Package Associations
ISP.belongsTo(SaaSPackage, { foreignKey: 'saas_package_id', as: 'saasPackage' });
SaaSPackage.hasMany(ISP, { foreignKey: 'saas_package_id', as: 'isps' });

// RBAC Associations
Role.belongsTo(ISP, { foreignKey: 'business_id', as: 'business' });
ISP.hasMany(Role, { foreignKey: 'business_id', as: 'roles' });

Role.belongsToMany(Permission, { through: RolePermission, foreignKey: 'role_id', as: 'permissions' });
Permission.belongsToMany(Role, { through: RolePermission, foreignKey: 'permission_id', as: 'roles' });

RolePermission.belongsTo(Role, { foreignKey: 'role_id', as: 'role' });
RolePermission.belongsTo(Permission, { foreignKey: 'permission_id', as: 'permission' });

// AutomationLog Associations
AutomationLog.belongsTo(ISP, { foreignKey: 'business_id', as: 'business' });
ISP.hasMany(AutomationLog, { foreignKey: 'business_id', as: 'automationLogs' });

AutomationLog.belongsTo(Customer, { foreignKey: 'customer_id', as: 'customer' });
Customer.hasMany(AutomationLog, { foreignKey: 'customer_id', as: 'automationLogs' });

AutomationLog.belongsTo(Bill, { foreignKey: 'invoice_id', as: 'invoice' });
Bill.hasMany(AutomationLog, { foreignKey: 'invoice_id', as: 'automationLogs' });

// User to Role relationship (optional - for future use)
// User.belongsTo(Role, { foreignKey: 'role_id', as: 'roleDetails' });

module.exports = {
  User,
  ISP,
  Customer,
  Package,
  Bill,
  Payment,
  Recovery,
  Installation,
  Notification,
  ActivityLog,
  Role,
  Permission,
  RolePermission,
  SaaSPackage,
  AutomationLog
};

