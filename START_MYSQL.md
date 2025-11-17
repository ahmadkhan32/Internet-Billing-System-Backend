# Start MySQL Service - Quick Guide

## Current Error
```
ConnectionRefusedError [SequelizeConnectionRefusedError]
code: 'ECONNREFUSED'
```

This means **MySQL is not running**.

## Quick Fix - Start MySQL

### Option 1: Using Services (Easiest)

1. Press `Win + R`
2. Type: `services.msc` and press Enter
3. Find **MySQL** service (might be named "MySQL80", "MySQL", "MySQL57", etc.)
4. Right-click → **Start**
5. If it's already running, right-click → **Restart**

### Option 2: Using Command Line

**Find MySQL service name:**
```powershell
Get-Service | Where-Object {$_.DisplayName -like "*mysql*"}
```

**Start MySQL:**
```powershell
# Try these commands (one should work):
net start MySQL80
# or
net start MySQL
# or
net start MySQL57
```

**If you get "Access Denied":**
- Run PowerShell as Administrator
- Right-click PowerShell → "Run as Administrator"

### Option 3: Using MySQL Installer

1. Open **MySQL Installer** (search in Start menu)
2. Click **Reconfigure** on your MySQL installation
3. Or use **MySQL Workbench** → Server Status

## Verify MySQL is Running

After starting, test connection:
```bash
mysql -u root -p
```

If it connects, MySQL is running!

## Common MySQL Service Names

- `MySQL80` (MySQL 8.0)
- `MySQL` (Generic)
- `MySQL57` (MySQL 5.7)
- `MySQL56` (MySQL 5.6)

## After Starting MySQL

1. **Create the database** (if not exists):
   ```sql
   mysql -u root -p
   CREATE DATABASE IF NOT EXISTS internet_billing_db;
   EXIT;
   ```

2. **Restart your Node.js server:**
   ```bash
   npm start
   ```

3. You should see:
   ```
   ✅ Database connection established successfully
   ✅ Database models synchronized
   🚀 Server running on port 8000
   ```

## If MySQL is Not Installed

If you don't have MySQL installed:

1. **Download MySQL:**
   - https://dev.mysql.com/downloads/installer/
   - Choose "MySQL Installer for Windows"

2. **Install MySQL:**
   - Choose "Developer Default" or "Server only"
   - Set root password (remember it!)
   - Complete installation

3. **Update .env file:**
   ```env
   DB_PASSWORD=your_mysql_root_password
   ```

4. **Start MySQL service** (see above)

## Troubleshooting

**"Service name not found"**
- MySQL might not be installed
- Check Programs and Features for MySQL

**"Access Denied" when starting service**
- Run command prompt/PowerShell as Administrator

**"Port 3306 already in use"**
- Another MySQL instance is running
- Or another service is using port 3306

