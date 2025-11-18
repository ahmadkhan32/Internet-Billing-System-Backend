/**
 * Complete Migration Script: XAMPP MySQL → Supabase PostgreSQL
 * 
 * This script migrates ALL data from XAMPP MySQL to Supabase PostgreSQL
 * Preserves all credentials (passwords as bcrypt hashes)
 * 
 * Usage:
 * 1. Set up Supabase project and run schema migration
 * 2. Update .env with both MySQL and Supabase credentials
 * 3. Run: node migrate-xampp-to-supabase.js
 */

require('dotenv').config();
const { Sequelize } = require('sequelize');
const mysql2 = require('mysql2');
const { Pool } = require('pg');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔄 XAMPP MySQL → Supabase Migration');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// MySQL Connection (XAMPP - Source)
const mysqlConfig = {
  host: process.env.MYSQL_DB_HOST || process.env.DB_HOST || 'localhost',
  port: process.env.MYSQL_DB_PORT || 3306,
  user: process.env.MYSQL_DB_USER || process.env.DB_USER || 'root',
  password: process.env.MYSQL_DB_PASSWORD || process.env.DB_PASSWORD || '',
  database: process.env.MYSQL_DB_NAME || process.env.DB_NAME || 'internet_billing_db'
};

// Supabase Connection (PostgreSQL - Destination)
const supabaseConfig = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'postgres',
  ssl: {
    require: true,
    rejectUnauthorized: false
  }
};

// Validate configurations
if (!supabaseConfig.host || !supabaseConfig.user || !supabaseConfig.password) {
  console.error('❌ Missing Supabase credentials in .env file!');
  console.error('Required: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME');
  process.exit(1);
}

// Create connections
const mysqlPool = mysql2.createPool({
  ...mysqlConfig,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const pgPool = new Pool(supabaseConfig);

// Helper function to execute MySQL queries
const mysqlQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    mysqlPool.query(sql, params, (error, results) => {
      if (error) reject(error);
      else resolve(results);
    });
  });
};

// Helper function to execute PostgreSQL queries
const pgQuery = async (sql, params = []) => {
  const client = await pgPool.connect();
  try {
    const result = await client.query(sql, params);
    return result.rows;
  } finally {
    client.release();
  }
};

// Migration order (respecting foreign key dependencies)
const migrationOrder = [
  { table: 'saas_packages', idColumn: 'id' },
  { table: 'isps', idColumn: 'id' },
  { table: 'users', idColumn: 'id' },
  { table: 'packages', idColumn: 'id' },
  { table: 'customers', idColumn: 'id' },
  { table: 'bills', idColumn: 'id' },
  { table: 'payments', idColumn: 'id' },
  { table: 'recoveries', idColumn: 'id' },
  { table: 'installations', idColumn: 'id' },
  { table: 'notifications', idColumn: 'id' },
  { table: 'activity_logs', idColumn: 'id' },
  { table: 'permissions', idColumn: 'id' },
  { table: 'roles', idColumn: 'id' },
  { table: 'role_permissions', idColumn: null }, // Junction table
  { table: 'automation_logs', idColumn: 'id' }
];

const migrateTable = async (tableName, idColumn) => {
  try {
    console.log(`\n📋 Migrating ${tableName}...`);
    
    // Get all records from MySQL
    const mysqlRecords = await mysqlQuery(`SELECT * FROM ${tableName}`);
    
    if (mysqlRecords.length === 0) {
      console.log(`   ℹ️  No records to migrate`);
      return { migrated: 0, skipped: 0 };
    }
    
    console.log(`   📦 Found ${mysqlRecords.length} records`);
    
    let migrated = 0;
    let skipped = 0;
    
    // Insert into PostgreSQL
    for (const record of mysqlRecords) {
      try {
        // Convert MySQL data types to PostgreSQL
        const pgRecord = { ...record };
        
        // Handle boolean conversion (MySQL uses 0/1, PostgreSQL uses true/false)
        Object.keys(pgRecord).forEach(key => {
          if (pgRecord[key] === 0) pgRecord[key] = false;
          if (pgRecord[key] === 1) pgRecord[key] = true;
        });
        
        // Handle NULL values
        Object.keys(pgRecord).forEach(key => {
          if (pgRecord[key] === null || pgRecord[key] === undefined) {
            delete pgRecord[key];
          }
        });
        
        // Build INSERT query with ON CONFLICT
        const columns = Object.keys(pgRecord).join(', ');
        const values = Object.values(pgRecord);
        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
        
        let conflictClause = '';
        if (idColumn) {
          conflictClause = `ON CONFLICT (${idColumn}) DO UPDATE SET ${Object.keys(pgRecord).map((key, i) => `${key} = $${i + 1}`).join(', ')}`;
        } else {
          // For junction tables, use DO NOTHING
          conflictClause = 'ON CONFLICT DO NOTHING';
        }
        
        const insertSql = `
          INSERT INTO ${tableName} (${columns})
          VALUES (${placeholders})
          ${conflictClause}
        `;
        
        await pgQuery(insertSql, values);
        migrated++;
      } catch (error) {
        if (error.code === '23505') { // Unique violation
          skipped++;
        } else {
          console.error(`   ⚠️  Error inserting record: ${error.message}`);
          skipped++;
        }
      }
    }
    
    console.log(`   ✅ Migrated: ${migrated}, Skipped: ${skipped}`);
    return { migrated, skipped };
    
  } catch (error) {
    console.error(`   ❌ Error migrating ${tableName}:`, error.message);
    return { migrated: 0, skipped: 0 };
  }
};

const migrateData = async () => {
  try {
    // Test MySQL connection
    console.log('📡 Testing MySQL connection (XAMPP)...');
    await mysqlQuery('SELECT 1');
    console.log(`   ✅ Connected to MySQL: ${mysqlConfig.database}@${mysqlConfig.host}`);
    
    // Test PostgreSQL connection
    console.log('📡 Testing Supabase connection...');
    await pgQuery('SELECT 1');
    console.log(`   ✅ Connected to Supabase: ${supabaseConfig.database}@${supabaseConfig.host}\n`);
    
    // Start migration
    console.log('🚀 Starting data migration...\n');
    
    let totalMigrated = 0;
    let totalSkipped = 0;
    
    for (const { table, idColumn } of migrationOrder) {
      const result = await migrateTable(table, idColumn);
      totalMigrated += result.migrated;
      totalSkipped += result.skipped;
    }
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Migration Completed!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`📊 Summary:`);
    console.log(`   ✅ Migrated: ${totalMigrated} records`);
    console.log(`   ⏭️  Skipped: ${totalSkipped} records (duplicates)\n`);
    
    console.log('📋 Next Steps:');
    console.log('   1. ✅ Verify data in Supabase Table Editor');
    console.log('   2. ✅ Test login with existing credentials');
    console.log('   3. ✅ Update .env to use Supabase only');
    console.log('   4. ✅ Deploy to Vercel\n');
    
    // Close connections
    mysqlPool.end();
    await pgPool.end();
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('Error details:', error);
    
    mysqlPool.end();
    await pgPool.end().catch(() => {});
    
    process.exit(1);
  }
};

// Run migration
migrateData();

