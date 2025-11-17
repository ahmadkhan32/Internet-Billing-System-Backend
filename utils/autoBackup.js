/**
 * Auto Backup Utility
 * Automatically backs up database and invoice files
 */

const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const moment = require('moment');

/**
 * Backup database
 * @param {Object} options - Backup options
 * @param {string} options.backupDir - Backup directory path
 * @param {string} options.dbHost - Database host
 * @param {string} options.dbUser - Database user
 * @param {string} options.dbPassword - Database password
 * @param {string} options.dbName - Database name
 * @returns {Object} Backup result
 */
const backupDatabase = async (options = {}) => {
  try {
    const {
      backupDir = path.join(__dirname, '../../backups'),
      dbHost = process.env.DB_HOST || 'localhost',
      dbUser = process.env.DB_USER || 'root',
      dbPassword = process.env.DB_PASSWORD || '',
      dbName = process.env.DB_NAME || 'internet_billing'
    } = options;

    // Create backup directory if it doesn't exist
    await fs.mkdir(backupDir, { recursive: true });

    const timestamp = moment().format('YYYY-MM-DD_HH-mm-ss');
    const backupFileName = `db_backup_${timestamp}.sql`;
    const backupPath = path.join(backupDir, backupFileName);

    // Build mysqldump command
    const mysqldumpCmd = `mysqldump -h ${dbHost} -u ${dbUser} ${dbPassword ? `-p${dbPassword}` : ''} ${dbName} > "${backupPath}"`;

    console.log('💾 Starting database backup...');

    try {
      await execAsync(mysqldumpCmd);
      console.log(`✅ Database backup created: ${backupPath}`);

      // Get file size
      const stats = await fs.stat(backupPath);
      const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

      return {
        success: true,
        backupPath: backupPath,
        fileName: backupFileName,
        size: fileSizeMB,
        timestamp: timestamp
      };
    } catch (error) {
      // If mysqldump is not available, create a JSON backup instead
      console.log('⚠️  mysqldump not available, creating JSON backup...');
      return await backupDatabaseJSON(backupDir, timestamp);
    }
  } catch (error) {
    console.error('❌ Error backing up database:', error);
    throw error;
  }
};

/**
 * Backup database as JSON (fallback method)
 */
const backupDatabaseJSON = async (backupDir, timestamp) => {
  try {
    const { sequelize } = require('../config/db');
    const { User, ISP, Customer, Package, Bill, Payment, Notification } = require('../models');

    const backupData = {
      timestamp: new Date(),
      version: '1.0',
      data: {
        users: await User.findAll({ raw: true }),
        isps: await ISP.findAll({ raw: true }),
        customers: await Customer.findAll({ raw: true }),
        packages: await Package.findAll({ raw: true }),
        bills: await Bill.findAll({ raw: true }),
        payments: await Payment.findAll({ raw: true }),
        notifications: await Notification.findAll({ raw: true })
      }
    };

    const backupFileName = `db_backup_${timestamp}.json`;
    const backupPath = path.join(backupDir, backupFileName);

    await fs.writeFile(backupPath, JSON.stringify(backupData, null, 2));

    const stats = await fs.stat(backupPath);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

    console.log(`✅ JSON backup created: ${backupPath}`);

    return {
      success: true,
      backupPath: backupPath,
      fileName: backupFileName,
      size: fileSizeMB,
      timestamp: timestamp,
      format: 'json'
    };
  } catch (error) {
    console.error('Error creating JSON backup:', error);
    throw error;
  }
};

/**
 * Backup invoice files
 * @param {Object} options - Backup options
 * @param {string} options.invoiceDir - Invoice directory path
 * @param {string} options.backupDir - Backup directory path
 * @returns {Object} Backup result
 */
const backupInvoices = async (options = {}) => {
  try {
    const {
      invoiceDir = path.join(__dirname, '../../uploads/invoices'),
      backupDir = path.join(__dirname, '../../backups/invoices')
    } = options;

    // Create backup directory if it doesn't exist
    await fs.mkdir(backupDir, { recursive: true });

    const timestamp = moment().format('YYYY-MM-DD_HH-mm-ss');
    const backupFolderName = `invoices_${timestamp}`;
    const backupPath = path.join(backupDir, backupFolderName);

    // Create backup folder
    await fs.mkdir(backupPath, { recursive: true });

    // Check if invoice directory exists
    try {
      await fs.access(invoiceDir);
    } catch {
      console.log('⚠️  Invoice directory does not exist, skipping invoice backup');
      return {
        success: false,
        message: 'Invoice directory does not exist'
      };
    }

    // Copy all invoice files
    const files = await fs.readdir(invoiceDir);
    let filesCopied = 0;
    let totalSize = 0;

    for (const file of files) {
      try {
        const sourcePath = path.join(invoiceDir, file);
        const destPath = path.join(backupPath, file);

        const stats = await fs.stat(sourcePath);
        if (stats.isFile()) {
          await fs.copyFile(sourcePath, destPath);
          filesCopied++;
          totalSize += stats.size;
        }
      } catch (error) {
        console.error(`Error copying file ${file}:`, error);
      }
    }

    const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);

    console.log(`✅ Invoice backup created: ${backupPath} (${filesCopied} files, ${totalSizeMB} MB)`);

    return {
      success: true,
      backupPath: backupPath,
      folderName: backupFolderName,
      filesCopied: filesCopied,
      size: totalSizeMB,
      timestamp: timestamp
    };
  } catch (error) {
    console.error('❌ Error backing up invoices:', error);
    throw error;
  }
};

/**
 * Clean old backups (keep only last N backups)
 * @param {Object} options - Cleanup options
 * @param {string} options.backupDir - Backup directory
 * @param {number} options.keepCount - Number of backups to keep (default: 7)
 * @returns {Object} Cleanup result
 */
const cleanOldBackups = async (options = {}) => {
  try {
    const {
      backupDir = path.join(__dirname, '../../backups'),
      keepCount = 7
    } = options;

    // Get all backup files
    const files = await fs.readdir(backupDir);
    const backupFiles = files
      .filter(file => file.startsWith('db_backup_') && (file.endsWith('.sql') || file.endsWith('.json')))
      .map(file => ({
        name: file,
        path: path.join(backupDir, file)
      }));

    // Sort by modification time (newest first)
    const filesWithStats = await Promise.all(
      backupFiles.map(async (file) => {
        const stats = await fs.stat(file.path);
        return {
          ...file,
          mtime: stats.mtime
        };
      })
    );

    filesWithStats.sort((a, b) => b.mtime - a.mtime);

    // Delete old backups
    const filesToDelete = filesWithStats.slice(keepCount);
    let deleted = 0;

    for (const file of filesToDelete) {
      try {
        await fs.unlink(file.path);
        deleted++;
        console.log(`🗑️  Deleted old backup: ${file.name}`);
      } catch (error) {
        console.error(`Error deleting backup ${file.name}:`, error);
      }
    }

    return {
      success: true,
      deleted: deleted,
      kept: filesWithStats.length - deleted
    };
  } catch (error) {
    console.error('❌ Error cleaning old backups:', error);
    throw error;
  }
};

/**
 * Full backup (database + invoices)
 */
const fullBackup = async (options = {}) => {
  try {
    console.log('🔄 Starting full backup...');

    const [dbBackup, invoiceBackup] = await Promise.all([
      backupDatabase(options),
      backupInvoices(options)
    ]);

    // Clean old backups
    await cleanOldBackups(options);

    return {
      success: true,
      database: dbBackup,
      invoices: invoiceBackup,
      timestamp: new Date()
    };
  } catch (error) {
    console.error('❌ Error in full backup:', error);
    throw error;
  }
};

module.exports = {
  backupDatabase,
  backupInvoices,
  cleanOldBackups,
  fullBackup
};

