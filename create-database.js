/**
 * Script to create the database if it doesn't exist
 * Run with: node create-database.js
 */

require('dotenv').config();
const mysql = require('mysql2/promise');

const createDatabase = async () => {
  let connection;
  
  try {
    console.log('🔌 Connecting to MySQL...');
    
    // Connect without specifying database
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
    });

    console.log('✅ Connected to MySQL server');

    // Create database if it doesn't exist
    const dbName = process.env.DB_NAME || 'internet_billing_db';
    console.log(`📦 Creating database '${dbName}'...`);
    
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    console.log(`✅ Database '${dbName}' created successfully!`);

    // Verify database exists
    const [databases] = await connection.query('SHOW DATABASES');
    const dbExists = databases.some(db => db.Database === dbName);
    
    if (dbExists) {
      console.log(`✅ Verified: Database '${dbName}' exists`);
      console.log('\n🎉 Database setup complete!');
      console.log('You can now start the backend server with: npm start');
    } else {
      console.log(`❌ Warning: Database '${dbName}' was not created`);
    }

  } catch (error) {
    console.error('❌ Error creating database:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 MySQL is not running. Please start MySQL service first.');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('\n💡 Access denied. Check your DB_USER and DB_PASSWORD in .env file.');
    } else {
      console.error('\n💡 Check your MySQL connection settings in .env file.');
    }
    
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Connection closed');
    }
  }
};

createDatabase();

