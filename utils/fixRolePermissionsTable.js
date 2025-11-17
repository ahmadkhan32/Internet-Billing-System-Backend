/**
 * Fix role_permissions table to remove excess indexes
 * MySQL has a limit of 64 indexes per table
 * This script drops redundant indexes and keeps only the essential ones
 */

require('dotenv').config();
const { sequelize } = require('../config/db');

const fixRolePermissionsTable = async () => {
  try {
    console.log('🔧 Fixing role_permissions table indexes...');
    
    await sequelize.authenticate();
    console.log('✅ Database connection established');

    // Get all indexes on role_permissions table
    const [indexes] = await sequelize.query(`
      SHOW INDEXES FROM role_permissions
    `);

    console.log(`\n📋 Found ${indexes.length} indexes on role_permissions table:`);
    indexes.forEach(idx => {
      console.log(`   - ${idx.Key_name} on ${idx.Column_name} (${idx.Non_unique === 0 ? 'UNIQUE' : 'INDEX'})`);
    });

    // Drop redundant indexes, keeping only:
    // 1. PRIMARY (id)
    // 2. unique_role_permission (role_id, permission_id) - our composite unique index
    // 3. Foreign key indexes (created automatically by MySQL)

    const indexesToKeep = ['PRIMARY', 'unique_role_permission'];
    const foreignKeyIndexes = indexes.filter(idx => 
      idx.Key_name.includes('role_id') || idx.Key_name.includes('permission_id')
    ).map(idx => idx.Key_name);

    const indexesToDrop = indexes
      .filter(idx => 
        !indexesToKeep.includes(idx.Key_name) && 
        !idx.Key_name.startsWith('PRIMARY') &&
        idx.Key_name !== 'unique_role_permission'
      )
      .map(idx => idx.Key_name)
      .filter((name, index, self) => self.indexOf(name) === index); // Remove duplicates

    if (indexesToDrop.length > 0) {
      console.log(`\n🗑️  Dropping ${indexesToDrop.length} redundant indexes...`);
      for (const indexName of indexesToDrop) {
        try {
          await sequelize.query(`DROP INDEX \`${indexName}\` ON role_permissions`);
          console.log(`   ✅ Dropped index: ${indexName}`);
        } catch (error) {
          console.log(`   ⚠️  Could not drop index ${indexName}: ${error.message}`);
        }
      }
    } else {
      console.log('\n✅ No redundant indexes found');
    }

    // Ensure the unique composite index exists
    console.log('\n🔍 Checking for unique_role_permission index...');
    const uniqueIndexExists = indexes.some(idx => idx.Key_name === 'unique_role_permission');
    
    if (!uniqueIndexExists) {
      console.log('   Creating unique_role_permission index...');
      try {
        await sequelize.query(`
          CREATE UNIQUE INDEX unique_role_permission 
          ON role_permissions (role_id, permission_id)
        `);
        console.log('   ✅ Created unique_role_permission index');
      } catch (error) {
        if (error.message.includes('Duplicate entry')) {
          console.log('   ⚠️  Index already exists or duplicate data found');
        } else {
          throw error;
        }
      }
    } else {
      console.log('   ✅ unique_role_permission index already exists');
    }

    // Verify final state
    const [finalIndexes] = await sequelize.query(`SHOW INDEXES FROM role_permissions`);
    console.log(`\n✅ Final state: ${finalIndexes.length} indexes on role_permissions table`);
    finalIndexes.forEach(idx => {
      console.log(`   - ${idx.Key_name} on ${idx.Column_name}`);
    });

    console.log('\n✅ role_permissions table fixed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing role_permissions table:', error);
    console.error('Error details:', error.message);
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  fixRolePermissionsTable();
}

module.exports = fixRolePermissionsTable;

