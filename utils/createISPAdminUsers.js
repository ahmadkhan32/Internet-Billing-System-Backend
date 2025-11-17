/**
 * Script to create admin users for existing ISPs
 * This ensures all ISPs have admin users with their email addresses
 */

require('dotenv').config();
const { sequelize } = require('../config/db');
const { ISP, User } = require('../models');
const bcrypt = require('bcryptjs');

const createISPAdminUsers = async () => {
  try {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔐 Creating Admin Users for ISPs');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection established\n');

    // Get all ISPs
    const isps = await ISP.findAll({
      order: [['id', 'ASC']]
    });

    console.log(`📊 Found ${isps.length} ISPs\n`);

    if (isps.length === 0) {
      console.log('⚠️  No ISPs found. Please create ISPs first.\n');
      process.exit(0);
    }

    // Create admin user for each ISP
    console.log('🔧 Creating admin users...\n');
    for (const isp of isps) {
      if (!isp.email) {
        console.log(`   ⚠️  ISP ${isp.name} (ID: ${isp.id}) has no email, skipping...`);
        continue;
      }

      const adminEmail = isp.email;
      const adminPassword = 'admin123';

      // Check if user with this email already exists
      let adminUser = await User.findOne({ where: { email: adminEmail } });

      if (!adminUser) {
        try {
          // Hash password
          const salt = await bcrypt.genSalt(10);
          const hashedPassword = await bcrypt.hash(adminPassword, salt);

          // Create admin user for this ISP
          adminUser = await User.create({
            name: isp.name + ' Admin',
            email: adminEmail,
            password: hashedPassword,
            role: 'admin',
            isp_id: isp.id,
            is_active: true
          });

          console.log(`   ✅ Created admin user for ${isp.name}:`);
          console.log(`      Email: ${adminEmail}`);
          console.log(`      Password: ${adminPassword}`);
          console.log(`      Business ID: ${isp.business_id || 'N/A'}\n`);
        } catch (error) {
          console.error(`   ❌ Error creating admin user for ${isp.name}:`, error.message);
        }
      } else {
        // Update existing user to be admin for this ISP if not already
        if (adminUser.isp_id !== isp.id || adminUser.role !== 'admin') {
          try {
            await adminUser.update({
              isp_id: isp.id,
              role: 'admin',
              is_active: true
            });
            console.log(`   ✅ Updated user ${adminEmail} to be admin for ${isp.name}`);
            console.log(`      Business ID: ${isp.business_id || 'N/A'}\n`);
          } catch (error) {
            console.error(`   ❌ Error updating user for ${isp.name}:`, error.message);
          }
        } else {
          console.log(`   ℹ️  Admin user already exists for ${isp.name}: ${adminEmail}`);
          console.log(`      Business ID: ${isp.business_id || 'N/A'}\n`);
        }
      }
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Admin user creation completed!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Summary
    console.log('📋 Login Credentials Summary:');
    console.log('   All ISP admin users use password: admin123\n');
    
    const ispsWithUsers = await ISP.findAll({
      include: [{
        model: User,
        as: 'users',
        where: { role: 'admin' },
        required: false
      }]
    });

    for (const isp of ispsWithUsers) {
      const adminUser = await User.findOne({
        where: {
          email: isp.email,
          role: 'admin'
        }
      });
      
      if (adminUser) {
        console.log(`   ${isp.name} (${isp.business_id || 'N/A'}):`);
        console.log(`      Email: ${isp.email}`);
        console.log(`      Password: admin123\n`);
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error creating admin users:', error);
    console.error('Error details:', error.message);
    process.exit(1);
  }
};

// Run script
createISPAdminUsers();

