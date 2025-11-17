/**
 * Migration Script: Add business_id to existing ISPs
 * This script generates unique business_id for all existing ISPs that don't have one
 */

require('dotenv').config();
const { sequelize } = require('../config/db');
const { ISP } = require('../models');
const { generateBusinessId } = require('./generateBusinessId');

const migrateBusinessId = async () => {
  try {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔄 Migrating Business IDs');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection established\n');

    // Check if business_id column exists
    const [columns] = await sequelize.query(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'isps' 
      AND COLUMN_NAME = 'business_id'
    `);

    if (columns.length === 0) {
      console.log('📋 Adding business_id column to isps table...');
      await sequelize.query(`
        ALTER TABLE isps 
        ADD COLUMN business_id VARCHAR(50) NULL UNIQUE 
        COMMENT 'Unique business identifier (e.g., BIZ-2024-0001)' 
        AFTER id
      `);
      console.log('✅ business_id column added\n');
    } else {
      console.log('✅ business_id column already exists\n');
    }

    // Find all ISPs without business_id
    const ispsWithoutBusinessId = await ISP.findAll({
      where: {
        business_id: null
      }
    });

    console.log(`📊 Found ${ispsWithoutBusinessId.length} ISPs without business_id\n`);

    if (ispsWithoutBusinessId.length === 0) {
      console.log('✅ All ISPs already have business_id assigned\n');
      process.exit(0);
    }

    // Generate and assign business_id to each ISP
    console.log('🔧 Generating business IDs...\n');
    for (const isp of ispsWithoutBusinessId) {
      try {
        const businessId = await generateBusinessId();
        await isp.update({ business_id: businessId });
        console.log(`   ✅ ${isp.name} (ID: ${isp.id}) → ${businessId}`);
      } catch (error) {
        console.error(`   ❌ Error assigning business_id to ${isp.name}:`, error.message);
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Migration completed successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Verify all ISPs have business_id
    const remaining = await ISP.count({ where: { business_id: null } });
    if (remaining === 0) {
      console.log('✅ All ISPs now have business_id assigned\n');
    } else {
      console.log(`⚠️  Warning: ${remaining} ISPs still missing business_id\n`);
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error('Error details:', error.message);
    process.exit(1);
  }
};

// Run migration
migrateBusinessId();

