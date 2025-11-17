-- Internet Billing System Database Setup
-- Run this script to create the database (if not using Sequelize sync)

CREATE DATABASE IF NOT EXISTS internet_billing_db;
USE internet_billing_db;

-- Note: Sequelize will automatically create tables based on models
-- This script is provided for reference only
-- The application will sync models automatically when started

-- Tables will be created by Sequelize:
-- - users
-- - isps
-- - customers
-- - packages
-- - bills
-- - payments
-- - recoveries

-- If you want to manually create tables, you can use the following structure
-- (but it's recommended to let Sequelize handle it)

-- Example: Users table structure
/*
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('super_admin', 'admin', 'account_manager', 'technical_officer', 'recovery_officer', 'customer') NOT NULL DEFAULT 'customer',
  isp_id INT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  last_login DATETIME NULL,
  createdAt DATETIME NOT NULL,
  updatedAt DATETIME NOT NULL,
  FOREIGN KEY (isp_id) REFERENCES isps(id) ON DELETE SET NULL
);
*/

-- The application will automatically create all tables and relationships
-- when you run: npm start

