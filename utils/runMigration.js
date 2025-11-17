const fs = require('fs');
const path = require('path');
const { sequelize } = require('../config/db');

async function runMigration() {
  try {
    console.log('🔄 Starting database migration...');
    
    // Read the SQL file
    const sqlFilePath = path.join(__dirname, '../database/add_completed_at_to_bills.sql');
    const sql = fs.readFileSync(sqlFilePath, 'utf8');
    
    // Remove comments and split into statements
    const cleanedSql = sql
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('--'))
      .join('\n');
    
    // Split by semicolon and filter empty statements
    const statements = cleanedSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement) {
        try {
          await sequelize.query(statement);
          const preview = statement.length > 60 ? statement.substring(0, 60) + '...' : statement;
          console.log(`✅ [${i + 1}/${statements.length}] Executed: ${preview}`);
        } catch (error) {
          // Ignore "Duplicate column" and "Duplicate key" errors
          if (error.message.includes('Duplicate column') || 
              error.message.includes('Duplicate key') ||
              error.message.includes('already exists') ||
              error.message.includes('Duplicate index')) {
            const preview = statement.length > 60 ? statement.substring(0, 60) + '...' : statement;
            console.log(`⚠️  [${i + 1}/${statements.length}] Skipped (already exists): ${preview}`);
          } else {
            console.error(`❌ Error executing statement ${i + 1}:`, error.message);
            throw error;
          }
        }
      }
    }
    
    console.log('✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

// Run migration
runMigration();

