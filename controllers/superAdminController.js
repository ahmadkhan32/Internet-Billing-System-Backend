const { ISP, Customer, User, Bill, Payment, SaaSPackage } = require('../models');
const { Op } = require('sequelize');
const { sequelize } = require('../config/db');
const { generateBusinessId } = require('../utils/generateBusinessId');
const { validationResult } = require('express-validator');
const { generateSRSFile, seedBusinessData, createBusinessStructure } = require('../utils/seedBusiness');

// @desc    Get Super Admin dashboard analytics
// @route   GET /api/super-admin/dashboard
// @access  Private (Super Admin)
const getDashboard = async (req, res) => {
  try {
    // Total ISPs
    const totalISPs = await ISP.count();
    const activeISPs = await ISP.count({ where: { subscription_status: 'active' } });
    const pendingISPs = await ISP.count({ where: { subscription_status: 'pending' } });
    const suspendedISPs = await ISP.count({ where: { subscription_status: 'suspended' } });

    // Total customers across all ISPs
    const totalCustomers = await Customer.count();
    
    // Total active packages
    const totalSaaSPackages = await SaaSPackage.count({ where: { status: 'active' } });

    // Revenue analytics (from ISP subscription payments - if you track this)
    // For now, calculate based on SaaS package prices
    const activeSubscriptions = await ISP.findAll({
      where: { subscription_status: 'active' },
      include: [{
        model: SaaSPackage,
        as: 'saasPackage',
        attributes: ['id', 'name', 'price', 'duration'],
        required: false
      }]
    });

    let monthlyRevenue = 0;
    let annualRevenue = 0;
    activeSubscriptions.forEach(isp => {
      if (isp.saasPackage) {
        const packagePrice = parseFloat(isp.saasPackage.price) || 0;
        monthlyRevenue += packagePrice;
        annualRevenue += packagePrice * 12;
      }
    });

    // Recent ISPs
    const recentISPs = await ISP.findAll({
      order: [['createdAt', 'DESC']],
      limit: 5,
      include: [{
        model: SaaSPackage,
        as: 'saasPackage',
        attributes: ['id', 'name', 'price'],
        required: false
      }]
    });

    // ISPs by package
    const ispsByPackage = await ISP.findAll({
      include: [{
        model: SaaSPackage,
        as: 'saasPackage',
        attributes: ['id', 'name'],
        required: false
      }],
      attributes: ['id', 'saas_package_id']
    });

    const packageStats = {};
    ispsByPackage.forEach(isp => {
      const packageName = isp.saasPackage?.name || 'No Package';
      packageStats[packageName] = (packageStats[packageName] || 0) + 1;
    });

    // Pending invoices (bills) across all ISPs
    const pendingBills = await Bill.count({
      where: {
        status: { [Op.in]: ['pending', 'overdue'] }
      }
    });

    res.json({
      success: true,
      dashboard: {
        isps: {
          total: totalISPs,
          active: activeISPs,
          pending: pendingISPs,
          suspended: suspendedISPs
        },
        customers: {
          total: totalCustomers
        },
        packages: {
          total: totalSaaSPackages
        },
        revenue: {
          monthly: monthlyRevenue,
          annual: annualRevenue
        },
        bills: {
          pending: pendingBills
        },
        recentISPs,
        packageStats
      }
    });
  } catch (error) {
    console.error('Error fetching Super Admin dashboard:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get all ISPs with details
// @route   GET /api/super-admin/isps
// @access  Private (Super Admin)
const getAllISPs = async (req, res) => {
  try {
    const { status = '', package_id = '', page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {};
    if (status) {
      whereClause.subscription_status = status;
    }
    if (package_id) {
      whereClause.saas_package_id = package_id;
    }

    const isps = await ISP.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: SaaSPackage,
          as: 'saasPackage',
          attributes: ['id', 'name', 'price', 'duration', 'max_customers', 'max_users'],
          required: false
        },
        {
          model: Customer,
          as: 'customers',
          attributes: ['id'],
          required: false
        },
        {
          model: User,
          as: 'users',
          attributes: ['id'],
          required: false
        }
      ],
      attributes: ['id', 'business_id', 'name', 'email', 'contact', 'address', 'subscription_status', 'subscription_start_date', 'subscription_end_date', 'saas_package_id', 'registration_date', 'createdAt'],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    // Add customer and user counts
    const ispsWithCounts = isps.rows.map(isp => {
      const ispData = isp.toJSON();
      ispData.customer_count = isp.customers?.length || 0;
      ispData.user_count = isp.users?.length || 0;
      delete ispData.customers;
      delete ispData.users;
      return ispData;
    });

    res.json({
      success: true,
      isps: ispsWithCounts,
      total: isps.count,
      page: parseInt(page),
      pages: Math.ceil(isps.count / limit)
    });
  } catch (error) {
    console.error('Error fetching ISPs:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Assign SaaS package to ISP
// @route   POST /api/super-admin/isps/:id/subscribe
// @access  Private (Super Admin)
const subscribeISP = async (req, res) => {
  try {
    const { package_id, start_date, end_date } = req.body;

    const isp = await ISP.findByPk(req.params.id);
    if (!isp) {
      return res.status(404).json({ message: 'ISP not found' });
    }

    const saasPackage = await SaaSPackage.findByPk(package_id);
    if (!saasPackage) {
      return res.status(404).json({ message: 'SaaS package not found' });
    }

    // Calculate dates
    const startDate = start_date ? new Date(start_date) : new Date();
    const endDate = end_date ? new Date(end_date) : new Date(startDate);
    endDate.setMonth(endDate.getMonth() + (saasPackage.duration || 1));

    await isp.update({
      saas_package_id: package_id,
      subscription_status: 'active',
      subscription_start_date: startDate,
      subscription_end_date: endDate
    });

    // Auto-generate subscription invoice
    try {
      const { generateSubscriptionInvoice } = require('./automationController');
      await generateSubscriptionInvoice(isp.id, 'api');
      console.log(`✅ Auto-generated subscription invoice for ${isp.name}`);
    } catch (error) {
      console.error(`⚠️  Error generating subscription invoice:`, error.message);
      // Don't fail the subscription if invoice generation fails
    }

    res.json({
      success: true,
      message: 'ISP subscribed to package successfully',
      isp
    });
  } catch (error) {
    console.error('Error subscribing ISP:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Update ISP subscription status
// @route   PUT /api/super-admin/isps/:id/status
// @access  Private (Super Admin)
const updateISPStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!['active', 'suspended', 'cancelled', 'expired'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const isp = await ISP.findByPk(req.params.id);
    if (!isp) {
      return res.status(404).json({ message: 'ISP not found' });
    }

    await isp.update({ subscription_status: status });

    res.json({
      success: true,
      message: 'ISP status updated successfully',
      isp
    });
  } catch (error) {
    console.error('Error updating ISP status:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Create new business (ISP)
// @route   POST /api/super-admin/isps
// @access  Private (Super Admin)
const createISP = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, contact, address, owner_name, status, saas_package_id, password, additional_users } = req.body;

    // Check if ISP with same email already exists
    const existingISP = await ISP.findOne({ where: { email } });
    if (existingISP) {
      return res.status(400).json({ message: 'Business with this email already exists' });
    }

    // Validate password if provided
    if (password && password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    // Generate unique business_id
    const business_id = await generateBusinessId();

    // Create ISP (Business)
    const isp = await ISP.create({
      business_id,
      name: name || owner_name, // Use name or owner_name
      email,
      contact,
      address,
      subscription_status: status || 'pending',
      saas_package_id: saas_package_id || null,
      registration_date: new Date()
    });

    // Auto-seed business: Create directory structure and SRS file
    try {
      // Get package name if saas_package_id is provided
      let packageName = null;
      if (saas_package_id) {
        const saasPackage = await SaaSPackage.findByPk(saas_package_id);
        if (saasPackage) {
          packageName = saasPackage.name;
        }
      }

      // Create business directory structure
      const businessDirs = createBusinessStructure(business_id);
      console.log(`✅ Created directory structure for business ${business_id}`);

      // Generate SRS file
      const srsFilePath = await generateSRSFile({
        business_id,
        business_name: isp.name,
        email: isp.email,
        package: packageName
      });
      console.log(`✅ Generated SRS file: ${srsFilePath}`);

      // Seed default data (optional - can be extended)
      const seededData = await seedBusinessData({
        business_id,
        business_name: isp.name
      }, isp.id);
      console.log(`✅ Seeded default data for business ${business_id}`);
    } catch (seedError) {
      console.error('⚠️  Error during business seeding (non-critical):', seedError.message);
      // Don't fail business creation if seeding fails
    }

    // Automatically create admin user for this ISP
    // Use ISP email as admin email, or create a default admin email
    const adminEmail = email; // Use ISP email as admin email
    const adminPassword = password || 'admin123'; // Use custom password or default
    
    // Check if user with this email already exists
    let adminUser = await User.findOne({ where: { email: adminEmail } });
    
    if (!adminUser) {
      // Create admin user for this ISP
      // Note: Password will be automatically hashed by User model's beforeCreate hook
      adminUser = await User.create({
        name: owner_name || name || 'ISP Admin',
        email: adminEmail,
        password: adminPassword, // Pass plain password - model hook will hash it
        role: 'admin',
        isp_id: isp.id,
        is_active: true
      });
      
      console.log(`✅ Created admin user for ISP ${isp.name}: ${adminEmail} / ${adminPassword}`);
    } else {
      // Update existing user to be admin for this ISP
      // If password was provided, update it (will be hashed by beforeUpdate hook)
      const updateData = {
        isp_id: isp.id,
        role: 'admin',
        is_active: true
      };
      
      // Only update password if a new one was provided
      if (password) {
        updateData.password = adminPassword; // Model hook will hash it
      }
      
      await adminUser.update(updateData);
      console.log(`✅ Updated user ${adminEmail} to be admin for ISP ${isp.name}${password ? ' with new password' : ''}`);
    }

    // Create additional users with specified roles
    const createdAdditionalUsers = [];
    if (additional_users && Array.isArray(additional_users) && additional_users.length > 0) {
      for (const userData of additional_users) {
        try {
          // Validate user data
          if (!userData.name || !userData.email || !userData.password || !userData.role) {
            console.warn(`⚠️  Skipping invalid user data:`, userData);
            continue;
          }

          // Validate role
          const allowedRoles = ['account_manager', 'technical_officer', 'recovery_officer'];
          if (!allowedRoles.includes(userData.role)) {
            console.warn(`⚠️  Invalid role ${userData.role} for additional user. Skipping.`);
            continue;
          }

          // Validate password length
          if (userData.password.length < 6) {
            console.warn(`⚠️  Password too short for user ${userData.email}. Skipping.`);
            continue;
          }

          // Check if user already exists
          const existingUser = await User.findOne({ where: { email: userData.email } });
          
          if (!existingUser) {
            // Create user - password will be hashed by User model hook
            const newUser = await User.create({
              name: userData.name,
              email: userData.email,
              password: userData.password, // Plain password - model hook will hash it
              role: userData.role,
              isp_id: isp.id,
              is_active: true
            });

            createdAdditionalUsers.push({
              name: newUser.name,
              email: newUser.email,
              password: userData.password, // Return plain password for display
              role: newUser.role
            });

            console.log(`✅ Created ${userData.role} user for ISP ${isp.name}: ${userData.email}`);
          } else {
            // Update existing user
            await existingUser.update({
              isp_id: isp.id,
              role: userData.role,
              password: userData.password, // Model hook will hash it
              is_active: true
            });

            createdAdditionalUsers.push({
              name: existingUser.name,
              email: existingUser.email,
              password: userData.password, // Return plain password for display
              role: userData.role
            });

            console.log(`✅ Updated user ${userData.email} to ${userData.role} for ISP ${isp.name}`);
          }
        } catch (error) {
          console.error(`❌ Error creating additional user ${userData.email}:`, error.message);
          // Continue with other users even if one fails
        }
      }
    }

    // Get SRS file path if it was created
    let srsFilePath = null;
    try {
      const path = require('path');
      srsFilePath = path.join('uploads', 'businesses', business_id, 'SRS.md');
    } catch (e) {
      // Ignore
    }

    res.status(201).json({
      success: true,
      message: `Business created successfully! Business ID: ${isp.business_id}`,
      business: {
        id: isp.id,
        business_id: isp.business_id,
        business_name: isp.name,
        owner_name: owner_name || isp.name,
        email: isp.email,
        contact: isp.contact,
        address: isp.address,
        status: isp.subscription_status,
        created_at: isp.createdAt
      },
      admin_user: {
        email: adminEmail,
        password: adminPassword,
        note: 'Admin user created. Please change password after first login.'
      },
      login_info: {
        business_id: isp.business_id,
        email: adminEmail,
        password: adminPassword,
        message: 'Use these credentials to login as Business Admin. Business ID is optional but recommended for enhanced security.'
      },
      additional_users: createdAdditionalUsers,
      seeded_data: {
        srs_file: srsFilePath,
        directory_structure: `uploads/businesses/${business_id}/`,
        message: 'Business directory structure and SRS file have been auto-generated.'
      }
    });
  } catch (error) {
    console.error('Error creating business:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Update business (ISP)
// @route   PUT /api/super-admin/isps/:id
// @access  Private (Super Admin)
const updateISP = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const isp = await ISP.findByPk(req.params.id);
    if (!isp) {
      return res.status(404).json({ message: 'Business not found' });
    }

    const { name, email, contact, address, owner_name, status, saas_package_id, password } = req.body;

    // Check email uniqueness if changed
    if (email && email !== isp.email) {
      const existingISP = await ISP.findOne({ where: { email } });
      if (existingISP) {
        return res.status(400).json({ message: 'Business with this email already exists' });
      }
    }

    // Validate password if provided
    if (password && password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    // Update ISP
    await isp.update({
      name: name || owner_name || isp.name,
      email: email || isp.email,
      contact: contact || isp.contact,
      address: address || isp.address,
      subscription_status: status || isp.subscription_status,
      saas_package_id: saas_package_id !== undefined ? saas_package_id : isp.saas_package_id
    });

    // Update admin user password if provided
    if (password) {
      try {
        const adminUser = await User.findOne({ 
          where: { 
            email: isp.email,
            isp_id: isp.id,
            role: 'admin'
          } 
        });
        
        if (adminUser) {
          // Update password - User model hook will hash it
          await adminUser.update({ password });
          console.log(`✅ Updated admin password for ISP ${isp.name} (${isp.email})`);
        } else {
          console.warn(`⚠️  Admin user not found for ISP ${isp.name} (${isp.email})`);
        }
      } catch (passwordError) {
        console.error('Error updating admin password:', passwordError);
        // Don't fail the entire update if password update fails
      }
    }

    res.json({
      success: true,
      message: 'Business updated successfully',
      business: {
        id: isp.id,
        business_id: isp.business_id,
        business_name: isp.name,
        owner_name: owner_name || isp.name,
        email: isp.email,
        contact: isp.contact,
        address: isp.address,
        status: isp.subscription_status
      }
    });
  } catch (error) {
    console.error('Error updating business:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get ISP analytics
// @route   GET /api/super-admin/isps/:id/analytics
// @access  Private (Super Admin)
const getISPAnalytics = async (req, res) => {
  try {
    const isp = await ISP.findByPk(req.params.id, {
      include: [
        {
          model: Customer,
          as: 'customers',
          required: false
        },
        {
          model: Bill,
          as: 'bills',
          required: false
        },
        {
          model: Payment,
          as: 'payments',
          required: false
        }
      ]
    });

    if (!isp) {
      return res.status(404).json({ message: 'ISP not found' });
    }

    const customerCount = isp.customers?.length || 0;
    const billCount = isp.bills?.length || 0;
    const paymentCount = isp.payments?.length || 0;
    
    const totalRevenue = isp.payments?.reduce((sum, payment) => {
      return sum + parseFloat(payment.amount || 0);
    }, 0) || 0;

    const paidBills = isp.bills?.filter(b => b.status === 'paid').length || 0;
    const pendingBills = isp.bills?.filter(b => b.status === 'pending').length || 0;

    res.json({
      success: true,
      analytics: {
        customers: customerCount,
        bills: {
          total: billCount,
          paid: paidBills,
          pending: pendingBills
        },
        payments: paymentCount,
        revenue: totalRevenue
      }
    });
  } catch (error) {
    console.error('Error fetching ISP analytics:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Download SRS file for a business
// @route   GET /api/super-admin/isps/:id/srs
// @access  Private (Super Admin)
const downloadSRS = async (req, res) => {
  try {
    const isp = await ISP.findByPk(req.params.id);
    if (!isp) {
      return res.status(404).json({ message: 'Business not found' });
    }

    const path = require('path');
    const fs = require('fs');
    const srsFilePath = path.join(__dirname, '..', 'uploads', 'businesses', isp.business_id, 'SRS.md');

    if (!fs.existsSync(srsFilePath)) {
      return res.status(404).json({ message: 'SRS file not found. It may not have been generated yet.' });
    }

    res.download(srsFilePath, `SRS-${isp.business_id}.md`, (err) => {
      if (err) {
        console.error('Error downloading SRS file:', err);
        res.status(500).json({ message: 'Error downloading SRS file' });
      }
    });
  } catch (error) {
    console.error('Error downloading SRS file:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Delete business (ISP) - Hard delete (permanently remove from database)
// @route   DELETE /api/super-admin/isps/:id
// @access  Private (Super Admin only)
const deleteISP = async (req, res) => {
  try {
    // Verify user is super admin (additional check beyond middleware)
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ message: 'Access denied. Only Super Admin can delete businesses.' });
    }

    const isp = await ISP.findByPk(req.params.id);
    if (!isp) {
      return res.status(404).json({ message: 'Business not found' });
    }

    const businessId = isp.business_id;
    const businessName = isp.name;

    // Get counts for confirmation message
    const customerCount = await Customer.count({ where: { isp_id: isp.id } });
    const billCount = await Bill.count({ where: { isp_id: isp.id } });
    const paymentCount = await Payment.count({ where: { isp_id: isp.id } });
    const userCount = await User.count({ where: { isp_id: isp.id } });

    // Delete in correct order to avoid foreign key constraint errors
    // 1. Delete Payments (references bills and customers)
    try {
      const deletedPayments = await Payment.destroy({ where: { isp_id: isp.id } });
      console.log(`✅ Deleted ${deletedPayments} payment(s) for business ${businessName}`);
    } catch (error) {
      console.error('Error deleting payments:', error);
    }

    // 2. Delete Recoveries (references bills, customers, ISP)
    try {
      const { Recovery } = require('../models');
      const deletedRecoveries = await Recovery.destroy({ where: { isp_id: isp.id } });
      console.log(`✅ Deleted ${deletedRecoveries} recovery record(s) for business ${businessName}`);
    } catch (error) {
      console.error('Error deleting recoveries:', error);
    }

    // 3. Delete Installations (references customers, ISP)
    try {
      const { Installation } = require('../models');
      const deletedInstallations = await Installation.destroy({ where: { isp_id: isp.id } });
      console.log(`✅ Deleted ${deletedInstallations} installation(s) for business ${businessName}`);
    } catch (error) {
      console.error('Error deleting installations:', error);
    }

    // 4. Delete Notifications (references ISP, customers, bills, users)
    try {
      const { Notification } = require('../models');
      const deletedNotifications = await Notification.destroy({ where: { isp_id: isp.id } });
      console.log(`✅ Deleted ${deletedNotifications} notification(s) for business ${businessName}`);
    } catch (error) {
      console.error('Error deleting notifications:', error);
    }

    // 5. Delete Activity Logs (references ISP, users)
    try {
      const { ActivityLog } = require('../models');
      const deletedLogs = await ActivityLog.destroy({ where: { isp_id: isp.id } });
      console.log(`✅ Deleted ${deletedLogs} activity log(s) for business ${businessName}`);
    } catch (error) {
      console.error('Error deleting activity logs:', error);
    }

    // 6. Delete Automation Logs (references ISP via business_id which is ISP.id)
    try {
      const { AutomationLog } = require('../models');
      const deletedAutomationLogs = await AutomationLog.destroy({ where: { business_id: isp.id } });
      console.log(`✅ Deleted ${deletedAutomationLogs} automation log(s) for business ${businessName}`);
    } catch (error) {
      console.error('Error deleting automation logs:', error);
    }

    // 7. Delete Bills (references customers and ISP)
    try {
      const deletedBills = await Bill.destroy({ where: { isp_id: isp.id } });
      console.log(`✅ Deleted ${deletedBills} bill(s) for business ${businessName}`);
    } catch (error) {
      console.error('Error deleting bills:', error);
    }

    // 8. Delete Packages (references ISP)
    try {
      const { Package } = require('../models');
      const deletedPackages = await Package.destroy({ where: { isp_id: isp.id } });
      console.log(`✅ Deleted ${deletedPackages} package(s) for business ${businessName}`);
    } catch (error) {
      console.error('Error deleting packages:', error);
    }

    // 9. Delete Customers (references ISP)
    try {
      const deletedCustomers = await Customer.destroy({ where: { isp_id: isp.id } });
      console.log(`✅ Deleted ${deletedCustomers} customer(s) for business ${businessName}`);
    } catch (error) {
      console.error('Error deleting customers:', error);
    }

    // 10. Delete Users (references ISP)
    try {
      const deletedUsers = await User.destroy({ where: { isp_id: isp.id } });
      console.log(`✅ Deleted ${deletedUsers} user(s) for business ${businessName}`);
    } catch (error) {
      console.error('Error deleting users:', error);
    }

    // 11. Delete Role Permissions and Roles (references ISP via business_id)
    try {
      const { Role, RolePermission } = require('../models');
      // First, get all roles for this business
      const roles = await Role.findAll({ where: { business_id: isp.business_id } });
      const roleIds = roles.map(r => r.id);
      
      // Delete role permissions for these roles
      if (roleIds.length > 0) {
        const deletedRolePermissions = await RolePermission.destroy({ 
          where: { role_id: roleIds } 
        });
        console.log(`✅ Deleted ${deletedRolePermissions} role permission(s) for business ${businessName}`);
      }
      
      // Then delete the roles
      const deletedRoles = await Role.destroy({ where: { business_id: isp.business_id } });
      console.log(`✅ Deleted ${deletedRoles} role(s) for business ${businessName}`);
    } catch (error) {
      console.error('Error deleting roles:', error);
    }

    // 12. Delete SRS file and directory structure
    try {
      const path = require('path');
      const fs = require('fs');
      const businessDir = path.join(__dirname, '..', 'uploads', 'businesses', businessId);
      
      if (fs.existsSync(businessDir)) {
        // Delete entire directory recursively
        const deleteDir = (dirPath) => {
          if (fs.existsSync(dirPath)) {
            fs.readdirSync(dirPath).forEach((file) => {
              const curPath = path.join(dirPath, file);
              if (fs.lstatSync(curPath).isDirectory()) {
                deleteDir(curPath);
              } else {
                fs.unlinkSync(curPath);
              }
            });
            fs.rmdirSync(dirPath);
          }
        };
        deleteDir(businessDir);
        console.log(`✅ Deleted directory structure for business ${businessName} (${businessId})`);
      }
    } catch (error) {
      console.error('Error deleting business directory:', error);
      // Don't fail the deletion if directory deletion fails
    }

    // 13. Delete the ISP (Business) itself
    await isp.destroy();
    console.log(`✅ Permanently deleted business: ${businessName} (${businessId})`);

    res.json({
      success: true,
      message: `Business "${businessName}" has been permanently deleted from the database.`,
      deleted_data: {
        business: businessName,
        business_id: businessId,
        customers: customerCount,
        bills: billCount,
        payments: paymentCount,
        users: userCount
      },
      note: 'All related data (customers, bills, payments, users, and files) have been permanently removed.'
    });
  } catch (error) {
    console.error('Error deleting business:', error);
    res.status(500).json({ 
      message: 'Server error while deleting business', 
      error: error.message 
    });
  }
};

module.exports = {
  getDashboard,
  getAllISPs,
  createISP,
  updateISP,
  deleteISP,
  downloadSRS,
  subscribeISP,
  updateISPStatus,
  getISPAnalytics
};

