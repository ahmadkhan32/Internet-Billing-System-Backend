/**
 * Script to fix Super Admin role in database
 * Run: node backend/utils/fixSuperAdminRole.js
 */

require('dotenv').config();
const { sequelize } = require('../config/db');
const { User } = require('../models');

const fixSuperAdminRole = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established');

    // Find Super Admin user by email
    const superAdmin = await User.findOne({
      where: { email: 'admin@billing.com' }
    });

    if (!superAdmin) {
      console.log('❌ Super Admin user not found');
      return;
    }

    console.log(`📋 Current Super Admin user:`);
    console.log(`   ID: ${superAdmin.id}`);
    console.log(`   Name: ${superAdmin.name}`);
    console.log(`   Email: ${superAdmin.email}`);
    console.log(`   Current Role: ${superAdmin.role}`);
    console.log(`   ISP ID: ${superAdmin.isp_id}`);

    // Check if role needs to be fixed
    if (superAdmin.role !== 'super_admin') {
      console.log(`\n⚠️  Role mismatch detected!`);
      console.log(`   Expected: super_admin`);
      console.log(`   Found: ${superAdmin.role}`);
      console.log(`\n🔧 Fixing role...`);

      await superAdmin.update({
        role: 'super_admin',
        isp_id: null // Super Admin should not have ISP
      });

      console.log('✅ Super Admin role fixed successfully!');
      console.log(`   New Role: ${superAdmin.role}`);
    } else {
      console.log('\n✅ Super Admin role is correct!');
    }

    // Also check and fix any other users that might have wrong roles
    const allUsers = await User.findAll();
    let fixedCount = 0;

    for (const user of allUsers) {
      // Fix users named "Super Admin" but with wrong role
      if (user.name === 'Super Admin' && user.role !== 'super_admin') {
        console.log(`\n🔧 Fixing user: ${user.email} (ID: ${user.id})`);
        await user.update({
          role: 'super_admin',
          isp_id: null
        });
        fixedCount++;
      }
    }

    if (fixedCount > 0) {
      console.log(`\n✅ Fixed ${fixedCount} additional user(s)`);
    }

    console.log('\n✅ All Super Admin roles verified!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing Super Admin role:', error);
    process.exit(1);
  }
};

fixSuperAdminRole();

