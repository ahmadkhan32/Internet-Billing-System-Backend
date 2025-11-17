/**
 * Quick fix script to add missing proof_file column to payments table
 * Run with: node fix-payments-table.js
 */

require('dotenv').config();
const { sequelize } = require('./config/db');

const fixPaymentsTable = async () => {
  try {
    console.log('🔧 Fixing payments table...\n');
    
    // Check if proof_file column exists
    const [columns] = await sequelize.query(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'payments' 
      AND COLUMN_NAME = 'proof_file'
    `);
    
    if (columns.length === 0) {
      console.log('📝 Adding proof_file column to payments table...');
      await sequelize.query(`
        ALTER TABLE payments 
        ADD COLUMN proof_file VARCHAR(500) NULL 
        COMMENT 'Path to uploaded payment proof (screenshot/receipt)' 
        AFTER notes
      `);
      console.log('✅ proof_file column added successfully!\n');
    } else {
      console.log('✅ proof_file column already exists\n');
    }
    
    console.log('✅ Payments table is up to date!');
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing payments table:', error.message);
    await sequelize.close();
    process.exit(1);
  }
};

fixPaymentsTable();

