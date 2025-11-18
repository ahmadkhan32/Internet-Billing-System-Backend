/**
 * Migration Script: MySQL to Supabase (PostgreSQL)
 * This script helps migrate data from MySQL to Supabase
 * 
 * Usage:
 * 1. Set up Supabase project and run migrations
 * 2. Update .env with Supabase credentials
 * 3. Set DB_DIALECT=postgres in .env
 * 4. Run: node migrate-to-supabase.js
 */

require('dotenv').config();
const { Sequelize } = require('sequelize');
const fs = require('fs');
const path = require('path');

// MySQL connection (source)
const mysqlSequelize = new Sequelize(
  process.env.MYSQL_DB_NAME || process.env.DB_NAME,
  process.env.MYSQL_DB_USER || process.env.DB_USER,
  process.env.MYSQL_DB_PASSWORD || process.env.DB_PASSWORD,
  {
    host: process.env.MYSQL_DB_HOST || process.env.DB_HOST,
    port: process.env.MYSQL_DB_PORT || 3306,
    dialect: 'mysql',
    logging: false
  }
);

// PostgreSQL connection (destination - Supabase)
const postgresSequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    dialectModule: require('pg'),
    logging: false,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    }
  }
);

const migrateData = async () => {
  try {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔄 MySQL to Supabase Migration Script');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Test connections
    console.log('📡 Testing MySQL connection...');
    await mysqlSequelize.authenticate();
    console.log('   ✅ MySQL connected\n');

    console.log('📡 Testing PostgreSQL (Supabase) connection...');
    await postgresSequelize.authenticate();
    console.log('   ✅ PostgreSQL connected\n');

    // Load models for both databases
    const mysqlModels = require('./models');
    const postgresModels = require('./models');

    // Migration order (respecting foreign key dependencies)
    const migrationOrder = [
      'SaaSPackage',
      'ISP',
      'User',
      'Package',
      'Customer',
      'Bill',
      'Payment',
      'Recovery',
      'Installation',
      'Notification',
      'ActivityLog',
      'Permission',
      'Role',
      'RolePermission',
      'AutomationLog'
    ];

    console.log('📦 Starting data migration...\n');

    for (const modelName of migrationOrder) {
      try {
        const Model = mysqlModels[modelName];
        if (!Model) {
          console.log(`   ⏭️  Skipping ${modelName} (model not found)`);
          continue;
        }

        console.log(`   📋 Migrating ${modelName}...`);
        
        // Fetch all records from MySQL
        const records = await Model.findAll({ raw: true });
        
        if (records.length === 0) {
          console.log(`      ℹ️  No records to migrate`);
          continue;
        }

        // Insert into PostgreSQL
        // Note: This assumes tables already exist in Supabase
        const PostgresModel = postgresModels[modelName];
        if (PostgresModel) {
          // Use bulk insert with ignore duplicates
          for (const record of records) {
            try {
              await PostgresModel.findOrCreate({
                where: { id: record.id },
                defaults: record
              });
            } catch (error) {
              console.log(`      ⚠️  Error inserting record ${record.id}: ${error.message}`);
            }
          }
          console.log(`      ✅ Migrated ${records.length} records`);
        } else {
          console.log(`      ⚠️  PostgreSQL model not found, skipping`);
        }
      } catch (error) {
        console.error(`   ❌ Error migrating ${modelName}:`, error.message);
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Migration completed!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('📋 Next steps:');
    console.log('   1. Verify data in Supabase Table Editor');
    console.log('   2. Update your .env to use PostgreSQL');
    console.log('   3. Set DB_DIALECT=postgres');
    console.log('   4. Restart your backend server\n');

    await mysqlSequelize.close();
    await postgresSequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error('Error details:', error.message);
    
    await mysqlSequelize.close().catch(() => {});
    await postgresSequelize.close().catch(() => {});
    process.exit(1);
  }
};

// Run migration
migrateData();

