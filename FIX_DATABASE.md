# Fix Database Connection Error

## Current Error
```
Access denied for user ''@'localhost' (using password: NO)
```

This means:
- Database user is empty (should be 'root')
- No password is being used
- Environment variables are not loading correctly

## Quick Fix Steps

### Option 1: Check MySQL is Running

1. **Start MySQL Service:**
   ```powershell
   # Check if MySQL is running
   Get-Service -Name MySQL*
   
   # If not running, start it
   net start MySQL
   # or
   Start-Service MySQL
   ```

### Option 2: Verify Database Credentials

1. **Test MySQL connection manually:**
   ```bash
   mysql -u root -p
   ```
   - If it asks for password, enter your MySQL root password
   - If it connects without password, your root has no password

2. **Create the database:**
   ```sql
   CREATE DATABASE IF NOT EXISTS internet_billing_db;
   SHOW DATABASES;
   EXIT;
   ```

### Option 3: Update .env File

Edit `backend/.env` file and make sure:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password_here
DB_NAME=internet_billing_db
```

**Important:**
- If MySQL root has **NO password**, use: `DB_PASSWORD=`
- If MySQL root has **a password**, use: `DB_PASSWORD=yourpassword`
- **NO SPACES** around the `=` sign
- **NO QUOTES** around values

### Option 4: Common Issues

**Issue: Empty user in error**
- `.env` file might have encoding issues
- Try recreating the `.env` file
- Make sure it's saved as plain text (not UTF-8 with BOM)

**Issue: "Unknown database"**
- Database doesn't exist
- Create it: `CREATE DATABASE internet_billing_db;`

**Issue: "Access denied"**
- Wrong password
- MySQL user doesn't have permissions
- MySQL not running

## Step-by-Step Fix

1. **Stop the server** (Ctrl+C if running)

2. **Verify MySQL:**
   ```bash
   mysql -u root -p
   ```
   Enter your password (or press Enter if no password)

3. **Create database:**
   ```sql
   CREATE DATABASE IF NOT EXISTS internet_billing_db;
   EXIT;
   ```

4. **Update .env:**
   - Open `backend/.env`
   - Set `DB_PASSWORD=` (if no password) or `DB_PASSWORD=yourpassword`
   - Make sure `DB_USER=root` (no spaces)
   - Save the file

5. **Restart server:**
   ```bash
   npm start
   ```

## Test Connection

After fixing, you should see:
```
✅ Database connection established successfully
✅ Database models synchronized
🚀 Server running on port 8000
```

If you still see errors, check:
- MySQL service is running
- Database exists
- Credentials in .env are correct
- No special characters in .env file

