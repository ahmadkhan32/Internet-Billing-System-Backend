/**
 * Migration script to add business_id to existing roles
 * Run: node backend/utils/migrateRolesToBusiness.js
 * 
 * This script:
 * 1. Adds business_id column to roles table if it doesn't exist
 * 2. Sets business_id = NULL for system roles (Super Admin, Admin, etc.)
 * 3. Assigns business_id to business-specific roles based on their usage
 */

require('dotenv').config();
const { sequelize } = require('../config/db');
const { Role, User, ISP } = require('../models');

const migrateRolesToBusiness = async () => {
  try {
    console.log('🔄 Starting roles migration to business-aware structure...');
    
    await sequelize.authenticate();
    console.log('✅ Database connection established');

    // Check if business_id column exists
    const [columns] = await sequelize.query(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'roles' 
      AND COLUMN_NAME = 'business_id'
    `);

    if (columns.length === 0) {
      console.log('📋 Adding business_id column to roles table...');
      await sequelize.query(`
        ALTER TABLE roles 
        ADD COLUMN business_id INT NULL,
        ADD FOREIGN KEY (business_id) REFERENCES isps(id) ON DELETE SET NULL
      `);
      console.log('✅ Added business_id column');
    } else {
      console.log('✅ business_id column already exists');
    }

    // Add unique index if it doesn't exist
    try {
      await sequelize.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS unique_role_per_business 
        ON roles (name, business_id)
      `);
      console.log('✅ Unique index created/verified');
    } catch (error) {
      if (!error.message.includes('Duplicate key')) {
        console.log('⚠️  Index might already exist, continuing...');
      }
    }

    // Get all roles
    const roles = await Role.findAll();
    console.log(`\n📋 Found ${roles.length} roles to process`);

    // System roles that should have business_id = NULL
    const systemRoleNames = ['super_admin', 'admin', 'account_manager', 'technical_officer', 'recovery_officer', 'customer'];

    for (const role of roles) {
      if (systemRoleNames.includes(role.name)) {
        // System role - set business_id to NULL
        if (role.business_id !== null) {
          await role.update({ business_id: null });
          console.log(`   ✅ Updated system role: ${role.name} → business_id = NULL`);
        }
      } else {
        // Custom role - try to determine business_id from users
        const usersWithRole = await User.findAll({
          where: { role: role.name },
          attributes: ['isp_id'],
          limit: 1
        });

        if (usersWithRole.length > 0 && usersWithRole[0].isp_id) {
          const businessId = usersWithRole[0].isp_id;
          // Verify business exists
          const business = await ISP.findByPk(businessId);
          if (business) {
            await role.update({ business_id: businessId });
            console.log(`   ✅ Updated custom role: ${role.name} → business_id = ${businessId} (${business.name})`);
          } else {
            console.log(`   ⚠️  Role ${role.name} has users with invalid business_id, setting to NULL`);
            await role.update({ business_id: null });
          }
        } else {
          // No users with this role, leave as NULL (will be set when role is used)
          console.log(`   ℹ️  Role ${role.name} has no users, leaving business_id as NULL`);
        }
      }
    }

    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  }
};

migrateRolesToBusiness();

