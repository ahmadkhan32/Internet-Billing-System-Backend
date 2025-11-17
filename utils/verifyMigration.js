const { sequelize } = require('../config/db');

async function verifyMigration() {
  try {
    console.log('🔍 Verifying migration...');
    
    // Check if completed_at column exists
    const [results] = await sequelize.query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_COMMENT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'bills'
      AND COLUMN_NAME = 'completed_at'
    `);
    
    if (results.length > 0) {
      console.log('✅ Column "completed_at" exists in bills table');
      console.log('   Type:', results[0].DATA_TYPE);
      console.log('   Nullable:', results[0].IS_NULLABLE);
      console.log('   Comment:', results[0].COLUMN_COMMENT);
      
      // Check if index exists
      const [indexResults] = await sequelize.query(`
        SELECT INDEX_NAME
        FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'bills'
        AND INDEX_NAME = 'idx_bills_completed_at'
      `);
      
      if (indexResults.length > 0) {
        console.log('✅ Index "idx_bills_completed_at" exists');
      } else {
        console.log('⚠️  Index "idx_bills_completed_at" not found');
      }
      
      // Count existing paid bills
      const [paidBills] = await sequelize.query(`
        SELECT COUNT(*) as count
        FROM bills
        WHERE status = 'paid'
      `);
      
      console.log(`📊 Found ${paidBills[0].count} paid bills`);
      
      // Count bills with completed_at set
      const [completedBills] = await sequelize.query(`
        SELECT COUNT(*) as count
        FROM bills
        WHERE status = 'paid' AND completed_at IS NOT NULL
      `);
      
      console.log(`✅ ${completedBills[0].count} paid bills have completion timestamp`);
      
    } else {
      console.log('❌ Column "completed_at" NOT found in bills table');
      console.log('   Migration may have failed. Please run it again.');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    process.exit(1);
  }
}

verifyMigration();

