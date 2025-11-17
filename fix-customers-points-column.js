const { sequelize } = require('./config/db');

async function addPointsColumn() {
  try {
    console.log('Checking if points column exists in customers table...');
    
    // Check if column exists
    const [columns] = await sequelize.query(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'customers' 
      AND COLUMN_NAME = 'points'
    `);
    
    if (columns.length === 0) {
      console.log('Adding points column to customers table...');
      await sequelize.query(`
        ALTER TABLE customers 
        ADD COLUMN points DECIMAL(10, 2) DEFAULT 0 
        COMMENT 'Loyalty points earned from payments (0.01 points per PKR paid)' 
        AFTER customer_id
      `);
      console.log('✅ Successfully added points column to customers table');
    } else {
      console.log('✅ Points column already exists in customers table');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding points column:', error.message);
    process.exit(1);
  }
}

addPointsColumn();

